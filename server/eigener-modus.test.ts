// WAS DAS FENSTER ZEIGT, IST DER MODUS, DER STARTET (W3 Auftrag 21, Queue ae423df4): ein Sitz im eigenen Setup ohne gewählten Modus trägt auf
// seiner Zeile kein --permission-mode, also wählt Claude Code (code.claude.com/docs/en/permission-modes, „Which mode a session starts in“):
// permissions.defaultMode aus den Einstellungen, sonst seine eingebaute Voreinstellung, im Terminal auto. Fleet nannte im Startfenster
// „Before changes“ (Manual), und an der Selbst-Tür zählte so ein Sitz als auto. Jetzt lesen Startbrief, Fenster und Selbst-Tür denselben Modus
// (server/fassung-umfeld.ts#eigenerStartModus). Der Test-Server liest die Nutzereinstellungen dort, wo claudeConfigDir() hinzeigt: im
// Temp-Ordner des Kits (FLEET_CLAUDE_PROJECTS_DIR liegt darin).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { eigenerStartModus, lokaleWurzel } from "./fassung-umfeld";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

const { TMP, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: ReturnType<typeof post>) => ({ ...step, token: null, self });
const modusIm = (a: Answer | undefined): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === "darf")?.abschnitte.find((x) => x.id === "modus")?.text ?? null;
const ordner = (f: Fixture, name: string): string => { const d = join(dirname(f.repo), name); mkdirSync(d, { recursive: true }); return d; };

describe("der Modus eines Sitzes im eigenen Setup ohne gewählten Modus", () => {
  test("Claude Codes Reihenfolge: Einstellungen, auto und bypass nur aus Nutzer- und verwalteter Datei, disableAutoMode, sonst auto", () => {
    const dir = mkdtempSync(join(TMP, "modus-")), home = join(dir, "home"), repo = join(dir, "repo"), verwaltet = join(dir, "managed.json");
    mkdirSync(join(repo, ".claude"), { recursive: true });
    mkdirSync(home);
    const m = () => eigenerStartModus(repo, home, verwaltet).modus;
    const faelle: [string, string][] = [];
    faelle.push(["nichts gesetzt", m()]);
    writeFileSync(join(home, "settings.json"), JSON.stringify({ permissions: { defaultMode: "default" } }));
    faelle.push(["Nutzer default", m()]);
    writeFileSync(join(repo, ".claude/settings.json"), JSON.stringify({ permissions: { defaultMode: "auto" } }));
    faelle.push(["Projekt auto gilt nicht", m()]);
    writeFileSync(join(repo, ".claude/settings.json"), JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
    faelle.push(["Projekt acceptEdits", m()]);
    writeFileSync(verwaltet, JSON.stringify({ permissions: { defaultMode: "plan" } }));
    faelle.push(["verwaltet plan", m()]);
    rmSync(verwaltet);
    rmSync(join(repo, ".claude/settings.json"));
    writeFileSync(join(home, "settings.json"), JSON.stringify({ permissions: { disableAutoMode: "disable" } }));
    faelle.push(["disableAutoMode", m()]);
    expect(Object.fromEntries(faelle)).toEqual({ "nichts gesetzt": "auto", "Nutzer default": "manual", "Projekt auto gilt nicht": "auto",
      "Projekt acceptEdits": "acceptEdits", "verwaltet plan": "plan", disableAutoMode: "manual" });
  });

  test("Startbrief und Selbst-Tür nennen denselben Modus: auto ohne Einstellung, acceptEdits mit, und ein Kind ist nie weiter", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo), FLEET_SELF_SEAT_CAP: "3" };
    const nutzer = join(TMP, "settings.json");
    rmSync(nutzer, { force: true });
    // ohne Einstellung: Claude Codes eingebaute Voreinstellung, auto; sein Kind darf auto
    const [o1] = await life(f, [post("/api/slots/1/open", { cwd: ordner(f, "fremd-1"), label: "Fremd ohne Einstellung" }), "save"], env);
    expect(o1?.status).toBe(200);
    const [brief1, kind1] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"),
      als(tokenOf(f, 1), post("/api/self/seats/open", { cwd: ordner(f, "kind-1"), goal: "x", permissionMode: "auto" }))], env);
    // mit defaultMode acceptEdits in den Nutzereinstellungen: acceptEdits; sein Kind darf dontAsk, nicht auto
    writeFileSync(nutzer, JSON.stringify({ permissions: { defaultMode: "acceptEdits" } }));
    try {
      const [o2] = await life(f, [post("/api/slots/2/open", { cwd: ordner(f, "fremd-2"), label: "Fremd mit acceptEdits" }), "save"], env);
      expect(o2?.status).toBe(200);
      const [brief2, weiter, enger] = await life(f, [get("/api/slots/2/fassung?anlass=laufend"),
        als(tokenOf(f, 2), post("/api/self/seats/open", { cwd: ordner(f, "kind-2"), goal: "x", permissionMode: "auto" })),
        als(tokenOf(f, 2), post("/api/self/seats/open", { cwd: ordner(f, "kind-3"), goal: "x", permissionMode: "dontAsk" }))], env);
      expect({ brief1: modusIm(brief1), kind1: kind1?.status, brief2: modusIm(brief2), weiter: weiter?.status, enger: enger?.status })
        .toEqual({ brief1: "auto", kind1: 200, brief2: "acceptEdits", weiter: 409, enger: 200 });
      expect(String(weiter?.body.error)).toContain("wider than the opener's own (acceptEdits)");
    } finally { rmSync(nutzer, { force: true }); }
  }, LIFE_DEADLINE_MS * 6);
});

// AUFTRAG 22 (Prüfung von Slot 7, ~/local-notes/w2-start-setzen/w3-21-pruefung.md): drei Eingaben, bei denen Fleet einen anderen Modus
// nannte, als Claude Code wirklich startet, und eine Tür, die die Dateien bei jedem Aufruf neu las.
describe("Auftrag 22: was Claude Code wirklich wählt", () => {
  const sitz = () => {
    const dir = mkdtempSync(join(TMP, "a22-")), home = join(dir, "home"), repo = join(dir, "repo");
    mkdirSync(join(repo, ".claude"), { recursive: true });
    mkdirSync(home);
    return { dir, home, repo, m: (modell: string | null = null) => eigenerStartModus(repo, home, null, modell) };
  };
  const schreib = (pfad: string, mode: string) => { mkdirSync(dirname(pfad), { recursive: true }); writeFileSync(pfad, JSON.stringify({ permissions: { defaultMode: mode } })); };

  test("D1: bypassPermissions aus Projekt- oder lokaler Datei startet in Manual, auch wenn der Nutzer einen anderen Modus nennt", () => {
    const a = sitz();
    schreib(join(a.repo, ".claude/settings.json"), "bypassPermissions");
    const projekt = a.m().modus;
    schreib(join(a.home, "settings.json"), "acceptEdits");
    const projektUndNutzer = a.m().modus;
    rmSync(join(a.repo, ".claude/settings.json"));
    rmSync(join(a.home, "settings.json"));
    schreib(join(a.repo, ".claude/settings.local.json"), "bypassPermissions");
    const lokal = a.m().modus;
    rmSync(join(a.repo, ".claude/settings.local.json"));
    schreib(join(a.home, "settings.json"), "bypassPermissions");
    const nutzer = a.m().modus; // E1 bleibt: aus den Nutzereinstellungen gilt bypass
    expect({ projekt, projektUndNutzer, lokal, nutzer }).toEqual({ projekt: "manual", projektUndNutzer: "manual", lokal: "manual", nutzer: "bypassPermissions" });
  });

  test("P1: die lokale Datei an der Repo-Wurzel gilt für einen Unterordner und einen Worktree, und sie gewinnt vor der im Startordner", () => {
    const a = sitz();
    const git = (cwd: string, ...args: string[]) => { const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" }); if (r.exitCode) throw new Error(r.stderr.toString()); };
    git(a.repo, "init", "-q");
    git(a.repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "x");
    const wt = join(a.dir, "wt"), unter = join(a.repo, "unter");
    git(a.repo, "worktree", "add", "-q", wt);
    mkdirSync(unter);
    schreib(join(a.repo, ".claude/settings.local.json"), "acceptEdits");
    const imUnterordner = eigenerStartModus(unter, a.home, null).modus;
    const imWorktree = eigenerStartModus(wt, a.home, null).modus;
    schreib(join(wt, ".claude/settings.local.json"), "plan");
    const wurzelGewinnt = eigenerStartModus(wt, a.home, null).modus;
    rmSync(join(a.repo, ".claude/settings.local.json"));
    const alteDateiDaneben = eigenerStartModus(wt, a.home, null).modus;
    // ist die Wurzel das Home, bleibt die Datei im Startordner
    const wurzel = { worktree: lokaleWurzel(wt, a.home), alsHome: lokaleWurzel(unter, a.repo) };
    expect({ imUnterordner, imWorktree, wurzelGewinnt, alteDateiDaneben, wurzel }).toEqual({ imUnterordner: "acceptEdits", imWorktree: "acceptEdits",
      wurzelGewinnt: "acceptEdits", alteDateiDaneben: "plan", wurzel: { worktree: realpathSync(a.repo), alsHome: null } });
  });

  test("P3: auto gibt es erst ab Opus und Sonnet 4.6 und Haiku 5.5, nicht auf Haiku 4.5, Sonnet 4.5, Opus 4.5 oder claude-3: dort startet Claude Code in Manual", () => {
    const a = sitz();
    const je = (modell: string | null) => a.m(modell).modus;
    const ohne = { "claude-haiku-4-5-20251001": je("claude-haiku-4-5-20251001"), "claude-sonnet-4-5": je("claude-sonnet-4-5"),
      "claude-opus-4-5": je("claude-opus-4-5"), "claude-3-5-sonnet-20241022": je("claude-3-5-sonnet-20241022") };
    const aelter = { "claude-opus-4-1-20250805": je("claude-opus-4-1-20250805"), "claude-sonnet-4-20250514": je("claude-sonnet-4-20250514") };
    const mit = { "claude-haiku-5-5": je("claude-haiku-5-5"), "claude-opus-5-5": je("claude-opus-5-5"), "claude-sonnet-4-6": je("claude-sonnet-4-6"),
      "claude-fable-5-1": je("claude-fable-5-1"), opus: je("opus"), keins: je(null) };
    writeFileSync(join(a.home, "settings.json"), JSON.stringify({ model: "claude-sonnet-4-5" }));
    const ausDenEinstellungen = je(null);
    schreib(join(a.repo, ".claude/settings.json"), "acceptEdits");
    const benannterModusBleibt = je("claude-haiku-4-5-20251001");
    expect({ ohne, aelter, mit, ausDenEinstellungen, benannterModusBleibt }).toEqual({
      ohne: { "claude-haiku-4-5-20251001": "manual", "claude-sonnet-4-5": "manual", "claude-opus-4-5": "manual", "claude-3-5-sonnet-20241022": "manual" },
      aelter: { "claude-opus-4-1-20250805": "manual", "claude-sonnet-4-20250514": "manual" },
      mit: { "claude-haiku-5-5": "auto", "claude-opus-5-5": "auto", "claude-sonnet-4-6": "auto", "claude-fable-5-1": "auto", opus: "auto", keins: "auto" }, ausDenEinstellungen: "manual", benannterModusBleibt: "acceptEdits" });
  });

  test("E2: Startbrief und Selbst-Tür nennen den Modus, in dem der Sitz startete, auch wenn danach eine Einstellung dazukommt", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo), FLEET_SELF_SEAT_CAP: "3" };
    const nutzer = join(TMP, "settings.json");
    rmSync(nutzer, { force: true });
    const [o] = await life(f, [post("/api/slots/1/open", { cwd: ordner(f, "fremd-e2"), label: "Fremd E2" }), "save"], env);
    expect(o?.status).toBe(200);
    writeFileSync(nutzer, JSON.stringify({ permissions: { disableAutoMode: "disable" } }));
    try {
      const [brief, kind] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"),
        als(tokenOf(f, 1), post("/api/self/seats/open", { cwd: ordner(f, "kind-e2"), goal: "x", permissionMode: "auto" }))], env);
      expect({ brief: modusIm(brief), kind: kind?.status }).toEqual({ brief: "auto", kind: 200 });
    } finally { rmSync(nutzer, { force: true }); }
  }, LIFE_DEADLINE_MS * 4);
});

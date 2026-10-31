// DER FREMDE AGENT KENNT SEINE TÜREN (F3, Owner 24.10.: „[Zitat entfernt]“): ein Sitz in einem Ordner ohne Fleet bekommt mit seinem Self-Token auch die Zeile, die sagt, was das Token
// öffnet — den Tür-Pack als Skill, den Text erst beim Aufruf — und `setting-up-agents` und das Systemkonzept lassen sich dort wählen.
// Wie server/sitz-wissen.test.ts: die Panes starten ein Ersatz-`claude`, das seine Argumente in eine Datei schreibt; der Start, den der
// Test liest, ist die Zeile, die tmux wirklich ausgeführt hat.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sectionAt } from "../context-sections";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";
import { SEAT_START_HEAD } from "./sitz-wissen";

const ROOT = realpathSync(join(import.meta.dir, ".."));
const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
// ein Sitz in Fleets Repo sitzt in einem verknüpften Worktree von Fleet, der nur für diesen Test existiert
const FLEET_WT = join(realpathSync(mkdtempSync(join(tmpdir(), "tueren-wissen-"))), "fleet-wt");
const FLEET_WT_BRANCH = `test/tueren-wissen-${process.pid}-${Date.now()}`;
sh(ROOT, "worktree", "add", "-q", "-b", FLEET_WT_BRANCH, FLEET_WT, "HEAD");
afterAll(() => {
  Bun.spawnSync(["git", "-C", ROOT, "worktree", "remove", "--force", FLEET_WT]);
  Bun.spawnSync(["git", "-C", ROOT, "branch", "-D", FLEET_WT_BRANCH]);
  rmSync(join(FLEET_WT, ".."), { recursive: true, force: true });
  cleanup();
});
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\npwd > "$f.tmp"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f.tmp"; done\nmv "$f.tmp" "$f"\nexec sleep 600\n`, { mode: 0o755 });

interface RegisterPack { id: string; useWhen: string; triggers: string[]; sources: { path: string; anchor: string }[] }
const register = JSON.parse(sh(ROOT, "show", "HEAD:.fleet/context-packs.json")) as RegisterPack[];
const pack = (id: string): RegisterPack => register.find((p) => p.id === id)!;
const textOf = (id: string): string => pack(id).sources.map((s) =>
  sectionAt(Bun.spawnSync(["git", "-C", ROOT, "show", `HEAD:${s.path}`]).stdout.toString(), s.path, s.anchor) ?? "").join("\n");

const startOf = async (slot: number): Promise<{ appended: string; addDirs: string[] }> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !existsSync(file); i++) await Bun.sleep(50);
  const [, ...rest] = readFileSync(file, "utf8").split("\n");
  const args = rest.join("\n").split("\0");
  const at = args.indexOf("--append-system-prompt"), datei = args.indexOf("--append-system-prompt-file");
  return { appended: [at >= 0 ? args[at + 1]! : "", datei >= 0 ? readFileSync(args[datei + 1]!, "utf8") : ""].filter(Boolean).join("\n\n"),
    addDirs: args.flatMap((arg, i) => arg === "--add-dir" ? [args[i + 1]!] : []) };
};
const skillsIn = (dirs: string[]): Map<string, string> => new Map(dirs.flatMap((dir) => {
  const root = join(dir, ".claude", "skills");
  return existsSync(root) ? readdirSync(root).map((name) => [name, readFileSync(join(root, name, "SKILL.md"), "utf8")] as const) : [];
}));
const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }>)[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const borrow = (self: string, id: string) => ({ ...get(`/api/self/context/${id}`), token: null, self });
type Abschnitt = { id: string; quelle: string | null; text: string | null; grund?: string };
const wissenOf = (a: Answer | undefined): Abschnitt[] =>
  ((a?.body.teile as { id: string; abschnitte: Abschnitt[] }[] | undefined) ?? [])
    .find((t) => t.id === "liest")?.abschnitte.filter((x) => x.id === "wissen") ?? [];

// ein Ordner ohne Fleet: ein eigenes git-Repo, also ein Sitz im eigenen Setup
const fremd = (name: string): string => {
  const dir = join(TMP, name);
  mkdirSync(dir);
  sh(dir, "init", "-q", "-b", "main");
  writeFileSync(join(dir, "README"), "anderes Repo\n");
  sh(dir, "add", "README");
  sh(dir, "commit", "-q", "-m", "start");
  return dir;
};

describe("das Wissen, das jeder Ordner wählen kann", () => {
  test("setting-up-agents und das Systemkonzept: in einem fremden Ordner wählbar und ausleihbar, in Fleets Repo weiter von selbst", () => {
    for (const id of ["setting-up-agents", "system-concept"]) {
      expect(pack(id).triggers).toContain("seat-choice");
      expect(pack(id).triggers).not.toContain("seat-start-any-repo");
    }
    expect(pack("fleet-doors").triggers).toEqual(["seat-choice"]);
  });

  test("bibliothek: [setting-up-agents] in einem fremden Ordner: der Text steht im Start; ausleihen geht; in Fleets Repo kommt das Pack ohne Wahl als Skill", async () => {
    const f = fixture();
    const fremder = fremd("wahl-ordner");
    const [offen, unbekannt, imFleet] = await life(f, [post("/api/slots/10/open", { cwd: fremder, bibliothek: ["setting-up-agents", "system-concept"] }),
      post("/api/slots/11/open", { cwd: fremder, bibliothek: ["kein-solcher-pack"] }), post("/api/slots/12/open", { cwd: FLEET_WT }), "save"]);
    expect([offen?.status, offen?.body.error]).toEqual([200, undefined]);
    expect(unbekannt?.status).toBe(400);
    const start = await startOf(10);
    expect(start.appended).toContain(textOf("setting-up-agents"));
    expect(start.appended).toContain(textOf("system-concept"));
    // ausgewählt heißt: diese Packs wörtlich im Start; die Tür-Zeile, die er nicht gewählt hat, kommt als Skill dazu
    expect([...skillsIn(start.addDirs).keys()]).toEqual(["fleet-doors"]);
    // in Fleets Repo kommen beide ohne Wahl als Skill, wie bisher — seat-choice nimmt sie dort nicht aus der Voreinstellung
    expect(imFleet?.status).toBe(200);
    const imFleetSkills = skillsIn((await startOf(12)).addDirs);
    for (const id of ["setting-up-agents", "system-concept"]) expect(imFleetSkills.get(id)?.endsWith(textOf(id))).toBe(true);
    const [leih, leih2] = await life(f, [borrow(tokenOf(f, 10), "setting-up-agents"), borrow(tokenOf(f, 10), "system-concept")]);
    expect([leih?.status, leih2?.status]).toEqual([200, 200]);
    expect((leih?.body.sources as { content: string }[]).map((s) => s.content).join("\n")).toBe(textOf("setting-up-agents"));
  }, LIFE_DEADLINE_MS * 3);
});


describe("jeder Sitz mit Self-Token außerhalb von Fleets Repo bekommt die Tür-Zeile", () => {
  test("ohne Wahl: eine Skill-Zeile, der Text erst beim Aufruf; mit Wahl von fleet-doors im Start; mit einer anderen Liste oder false trotzdem beide Zeilen: sie gehören dem Token, nicht der Wahl", async () => {
    const f = fixture();
    const fremder = fremd("tueren-ordner");
    const [ohne, gewaehlt, liste, aus] = await life(f, [post("/api/slots/10/open", { cwd: fremder }),
      post("/api/slots/11/open", { cwd: fremder, bibliothek: ["fleet-doors"] }),
      post("/api/slots/12/open", { cwd: fremder, bibliothek: ["setting-up-agents"] }), post("/api/slots/13/open", { cwd: fremder, bibliothek: false }),
      "save"]);
    expect([ohne?.status, gewaehlt?.status, liste?.status, aus?.status]).toEqual([200, 200, 200, 200]);
    const [s10, s11, s12, s13] = [await startOf(10), await startOf(11), await startOf(12), await startOf(13)];

    // ohne Wahl: der Kopf nennt die Skill, der Text steht nicht im Start, die Skill-Datei trägt die useWhen-Zeile und den Pack
    expect(s10.appended).toContain(SEAT_START_HEAD);
    expect(s10.appended).toContain("As skills, open one when its description fits your moment (Skill tool): fleet-doors, setting-up-agents.");
    for (const id of ["fleet-doors", "setting-up-agents"]) {
      expect(s10.appended).not.toContain(textOf(id));
      const datei = skillsIn(s10.addDirs).get(id)!;
      expect(datei.startsWith(`---\nname: ${id}\ndescription: ${JSON.stringify(pack(id).useWhen)}\n---\n`)).toBe(true);
      expect(datei.endsWith(textOf(id))).toBe(true);
    }
    expect([...skillsIn(s10.addDirs).keys()].sort()).toEqual(["fleet-doors", "setting-up-agents"]);

    // gewählt: wörtlich im Start wie bisher, nicht zusätzlich als Skill; die andere Tür-Zeile kommt als Skill dazu
    expect(s11.appended).toContain(textOf("fleet-doors"));
    expect([...skillsIn(s11.addDirs).keys()]).toEqual(["setting-up-agents"]);
    // eine Liste ohne ihn: der gewählte Pack im Start, `fleet-doors` als Skill-Zeile, der Text erst beim Aufruf
    expect(s12.appended).toContain(textOf("setting-up-agents"));
    expect(s12.appended).not.toContain(textOf("fleet-doors"));
    expect([...skillsIn(s12.addDirs).keys()]).toEqual(["fleet-doors"]);
    // false: keine Bibliothek, aber beide Tür-Zeilen als Skill
    expect(s13.appended.includes(SEAT_START_HEAD)).toBe(true);
    expect(s13.appended).not.toContain(textOf("fleet-doors"));
    expect([...skillsIn(s13.addDirs).keys()].sort()).toEqual(["fleet-doors", "setting-up-agents"]);

    // die Fassung des Sitzes zeigt die Zeile mit ihrer Quelle, und die Ausleihe liefert den Text
    const [fassung, leih] = await life(f, [get("/api/slots/10/fassung?anlass=laufend"), borrow(tokenOf(f, 10), "fleet-doors")]);
    const zeile = wissenOf(fassung).find((a) => a.text === `- fleet-doors: ${pack("fleet-doors").useWhen}`);
    expect(zeile?.quelle?.split("\n")[0]).toBe(`${s10.addDirs[0]}/.claude/skills/fleet-doors/SKILL.md`);
    expect(zeile?.grund).toContain("Skill");
    expect(leih?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 3);
});

describe("der Start nennt die Server-Rechte des Sitzes", () => {
  test("die Zeile FLEET SERVER RIGHTS steht im Start jedes Sitzes ohne stehende Rolle, im fremden Ordner wie in Fleets Repo, und ist die der Fassung", async () => {
    const f = fixture();
    const fremder = fremd("rechte-ordner");
    const [frei, mit, imFleet, ohneBib] = await life(f, [post("/api/slots/10/open", { cwd: fremder }),
      post("/api/slots/11/open", { cwd: fremder, rechte: { recht: ["role.form"] } }), post("/api/slots/12/open", { cwd: FLEET_WT }),
      post("/api/slots/13/open", { cwd: fremder, bibliothek: false }), "save"]);
    expect([frei?.status, mit?.status, imFleet?.status, ohneBib?.status]).toEqual([200, 200, 200, 200]);
    const [fassung10, fassung11] = await life(f, [get("/api/slots/10/fassung?anlass=laufend"), get("/api/slots/11/fassung?anlass=laufend")]);
    const zeileDerFassung = (a: Answer | undefined): string => {
      const darf = ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[]).find((t) => t.id === "darf")?.abschnitte
        .find((x) => x.id === "darf")?.text ?? "").split("\n")[0]!;
      expect(darf).toStartWith("FLEET SERVER RIGHTS (checked at Fleet's doors):");
      return darf;
    };
    // jeder Start trägt genau die Zeile, die die Fassung nennt — auch ohne Bibliothek (ein Sitz mit bibliothek:false liest sie trotzdem)
    for (const [slot, fassung] of [[10, fassung10], [11, fassung11]] as const) {
      const start = await startOf(slot);
      expect(start.appended).toContain(zeileDerFassung(fassung));
    }
    expect((await startOf(11)).appended).toContain("role.form — ");
    expect((await startOf(10)).appended).not.toContain("role.form — ");
    expect((await startOf(12)).appended).toContain("FLEET SERVER RIGHTS (checked at Fleet's doors):");
    expect((await startOf(13)).appended).toContain("FLEET SERVER RIGHTS (checked at Fleet's doors):");
    // der Zaun gehört nicht in den Start: er ist die Auskunft der Fassung, was Fleet NICHT setzt
    expect((await startOf(10)).appended).not.toContain("FLEET'S FENCE");
  }, LIFE_DEADLINE_MS * 3);
});

describe("ein Sitz mit seat.open öffnet ein Kind und gibt ihm genau ein Pack und die Tür-Zeilen", () => {
  test("bibliothek: [setting-up-agents] an der Selbst-Tür: das Kind liest nur dieses Pack; eine unbekannte oder private Id ist 400; true heißt die Voreinstellung", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: join(f.repo, "..") };
    const als = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
    const kind = (name: string): string => { const d = join(f.repo, "..", name); mkdirSync(d, { recursive: true }); return d; };
    // der Ordner des Kindes: ein eigenes Repo, also ein eigenes Setup
    const ordner = kind("kind-ordner");
    sh(ordner, "init", "-q", "-b", "main");
    const [eltern] = await life(f, [post("/api/slots/1/open", { cwd: fremd("eltern-ordner") }), "save"], env);
    expect(eltern?.status).toBe(200);
    const self = tokenOf(f, 1);
    const [privat] = await life(f, [als(self, post("/api/self/packs", { id: "mein-privater-pack", useWhen: "Wenn ich ihn brauche.", text: "# Mein Pack\n\nNur für mich." }))], env);
    expect(privat?.status).toBe(200);
    const [eins, unbekannt, meinPack, voreinstellung] = await life(f, [
      als(self, post("/api/self/seats/open", { cwd: ordner, model: "claude-sonnet-5-5", effort: "high", bibliothek: ["setting-up-agents"] })),
      als(self, post("/api/self/seats/open", { cwd: ordner, bibliothek: ["kein-solcher-pack"] })),
      als(self, post("/api/self/seats/open", { cwd: ordner, bibliothek: ["mein-privater-pack"] })),
      als(self, post("/api/self/seats/open", { cwd: kind("kind-zwei"), bibliothek: true })), "save"], env);
    expect([eins?.status, eins?.body.error]).toEqual([200, undefined]);
    expect(unbekannt?.status).toBe(400);
    expect(String(unbekannt?.body.error)).toContain("no pack kein-solcher-pack");
    expect(meinPack?.status).toBe(400);
    expect(String(meinPack?.body.error)).toContain("mein-privater-pack");
    // das Kind liest genau dieses Pack wörtlich im Start, dazu `fleet-doors` als Skill-Zeile (der Text erst beim Aufruf): die Zeile gehört dem Token
    const start = await startOf(Number(eins?.body.slot));
    expect(start.appended).toContain(textOf("setting-up-agents"));
    expect(start.appended).not.toContain(textOf("fleet-doors"));
    expect([...skillsIn(start.addDirs).keys()]).toEqual(["fleet-doors"]);
    // `true` heißt an dieser Tür: die Voreinstellung, also die Tür-Zeilen
    expect([voreinstellung?.status, voreinstellung?.body.error]).toEqual([200, undefined]);
    const vor = await startOf(Number(voreinstellung?.body.slot));
    expect([...skillsIn(vor.addDirs).keys()].sort()).toEqual(["fleet-doors", "setting-up-agents"]);
  }, LIFE_DEADLINE_MS * 5);
});

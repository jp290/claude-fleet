// Owner 2026-10-29: ein Claude-Sitz darf über POST /api/self/branches/open einen GEZÄUNTEN pi-zai-Sitz öffnen (bwrap, nur sein Worktree
// beschreibbar). Gemessen an der Zeile, mit der tmux die Pane wirklich startete: das Ersatz-bwrap schreibt seine Argumente in eine
// Datei (ein Aufruf je Block: erst der Selbsttest des Zauns am /usr/bin/true, dann pi). Ein anderer Harness bleibt abgelehnt.
// Jedes `life` ist ein Leben des Servers in eigenem Prozess (branches.drive.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, get, persisted, post } from "./branches-testkit";
import { schreibEigenenPack } from "./eigene-packs";
import { weggelassenZeile } from "./datengrenze";

const { TMP, BIN, fixture, life, cleanup } = branchTestkit();
const ARGV = join(TMP, "argv");
mkdirSync(ARGV);
// das Ersatz-bwrap: je Aufruf eine Zeile `---` und jedes Argument mit NUL dahinter; es führt nichts aus und endet mit 0
writeFileSync(join(BIN, "bwrap"), `#!/bin/sh\nf="${ARGV}/slot-$FLEET_SELF_SLOT"\nprintf '%s\\n' '---' >> "$f"\n`
  + `for a in "$@"; do printf '%s\\0' "$a" >> "$f"; done\nexit 0\n`, { mode: 0o755 });
// das Ersatz-claude (nur für das Claude-Kind der Datengrenze-Probe): jedes Argument mit NUL dahinter in eine eigene Datei je Slot
writeFileSync(join(BIN, "claude"), `#!/bin/sh\nf="${ARGV}/claude-slot-$FLEET_SELF_SLOT"\nfor a in "$@"; do printf '%s\\0' "$a" >> "$f"; done\nexec sleep 600\n`, { mode: 0o755 });
afterAll(cleanup);

// der Zaun ist ohne Verbotswurzeln nicht zu bauen (server.ts#PI_ZAI_DENY_ROOTS); alles Private liegt im Temp-Ordner dieses Laufs
const ZAUN = { FLEET_PI_ZAI_BWRAP: join(BIN, "bwrap"), FLEET_PI_ZAI_DENY_ROOTS: join(TMP, "deny-test"),
  FLEET_PI_ZAI_AGENT_DIR: join(TMP, "pi-zai-agent"), FLEET_PI_ZAI_KEY_FILE: join(TMP, "pi-zai.key"),
  // pi-deepseek sitzt im selben Zaun (dieselben bwrap- und Verbots-Schalter), mit eigenem Agent-Verzeichnis und Schlüssel
  FLEET_PI_DEEPSEEK_AGENT_DIR: join(TMP, "pi-deepseek-agent"), FLEET_PI_DEEPSEEK_KEY_FILE: join(TMP, "pi-deepseek.key") };
// die Wache der Zeile verlangt eine nicht leere Schlüsseldatei; hier ein Platzhalter, nie ein echter Schlüssel
writeFileSync(ZAUN.FLEET_PI_ZAI_KEY_FILE, "platzhalter\n");
writeFileSync(ZAUN.FLEET_PI_DEEPSEEK_KEY_FILE, "platzhalter\n");
const tokenOf = (f: ReturnType<typeof fixture>, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: ReturnType<typeof post>) => ({ ...step, token: null, self });
// die Aufrufe des Ersatz-bwrap in dieser Pane: je Aufruf seine Argumente
const aufrufe = async (slot: number): Promise<string[][]> => {
  const file = join(ARGV, `slot-${slot}`);
  for (let i = 0; i < 200 && !(existsSync(file) && readFileSync(file, "utf8").split("---\n").length > 2); i++) await Bun.sleep(50);
  return readFileSync(file, "utf8").split("---\n").slice(1).map((c) => c.split("\0").slice(0, -1));
};

describe("ein Claude-Sitz öffnet über die Self-Tür einen pi-zai-Sitz", () => {
  test("die Startzeile trägt den Zaun: Selbsttest, nur der Worktree beschreibbar, pi darin", async () => {
    const f = fixture();
    const [b, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "Fremder Sitz" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin" }), "save"], ZAUN);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    const [c] = await life(f, [als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(b?.body.branch), harness: "pi-zai" })), "save"], ZAUN);
    expect(c?.status).toBe(200);
    const slot = Number(c?.body.slot);
    expect((persisted(f).slots as Record<string, { harness?: string }>)[String(slot)]?.harness).toBe("pi-zai");
    const [selbsttest, pi] = await aufrufe(slot);
    expect(selbsttest?.at(-1)).toBe("/usr/bin/true");
    expect(pi).toContain("--unshare-all");
    expect(pi?.slice(pi.indexOf("pi"), pi.indexOf("pi") + 3)).toEqual(["pi", "--provider", "zai"]);
    // den Worktree des Branches bindet der Zaun beschreibbar: `--bind <pfad> <pfad>`; das Repo daneben nicht
    const worktree = realpathSync(String(c?.body.path ?? c?.body.cwd));
    const binds = (pi ?? []).flatMap((a, i, all) => (a === "--bind" ? [all[i + 1]] : []));
    expect(binds).toContain(worktree);
    expect(binds).not.toContain(realpathSync(f.repo));
  }, 90_000);

  // Owner 2026-10-29 („[Zitat entfernt]“): derselbe Weg für den gezäunten DeepSeek-Sitz
  test("pi-deepseek: die Startzeile trägt denselben Zaun, und pi spricht mit deepseek", async () => {
    // die Aufruf-Dateien gehören dem Slot, und der erste freie Slot ist in jedem Test derselbe: die des pi-zai-Tests weg
    for (const name of readdirSync(ARGV)) rmSync(join(ARGV, name));
    const f = fixture();
    const [b, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "DeepSeek-Sitz" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin" }), "save"], ZAUN);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    const [c] = await life(f, [als(tokenOf(f, 12), post("/api/self/branches/open",
      { branch: String(b?.body.branch), harness: "pi-deepseek", model: "deepseek-v4-pro" })), "save"], ZAUN);
    expect(c?.status).toBe(200);
    const slot = Number(c?.body.slot);
    expect((persisted(f).slots as Record<string, { harness?: string }>)[String(slot)]?.harness).toBe("pi-deepseek");
    const [selbsttest, pi] = await aufrufe(slot);
    expect(selbsttest?.at(-1)).toBe("/usr/bin/true");
    expect(pi).toContain("--unshare-all");
    expect(pi?.slice(pi.indexOf("pi"), pi.indexOf("pi") + 3)).toEqual(["pi", "--provider", "deepseek"]);
    const worktree = realpathSync(String(c?.body.path ?? c?.body.cwd));
    const binds = (pi ?? []).flatMap((a, i, all) => (a === "--bind" ? [all[i + 1]] : []));
    expect(binds).toContain(worktree);
    expect(binds).not.toContain(realpathSync(f.repo));
  }, 90_000);

  test("ein anderer Harness bleibt abgelehnt, mit dem heutigen Satz", async () => {
    const f = fixture();
    const [b, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kein anderer" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin" }), "save"], ZAUN);
    expect([b?.status, o?.status]).toEqual([201, 200]);
    const antworten = await life(f, [...["pi-zai-unfenced", "pi", "pi-unfenced", "codex"].map((harness) =>
      als(tokenOf(f, 12), post("/api/self/branches/open", { branch: String(b?.body.branch), harness }))), "save"], ZAUN);
    for (const [i, harness] of ["pi-zai-unfenced", "pi", "pi-unfenced", "codex"].entries()) {
      expect(antworten[i]?.status).toBe(409);
      expect(String(antworten[i]?.body.error)).toContain(`harness ${harness} is not yours (claude)`);
    }
  }, 90_000);

  // Datengrenze (server/datengrenze.ts): der ganze Weg „Claude-Öffnerin trägt einen persönlichen Pack -> Branch-Tür -> gezäunter Sitz“.
  // Der Pack steht in ihren eigenen Packs (Slot.selbst) UND in ihrer Bibliotheks-Wahl; das Fixture-Pack ist erfunden.
  test("Datengrenze: das pi-deepseek- und das pi-zai-Kind einer Claude-Öffnerin mit persönlichem Pack bekommen dessen Text nicht, das Claude-Kind schon", async () => {
    for (const name of readdirSync(ARGV)) rmSync(join(ARGV, name));
    const PACK = "datengrenze-weg-probe", GEHEIM = "endet auf 4711";
    const f = fixture();
    schreibEigenenPack(f.state, { id: PACK, useWhen: "Wenn die Probe läuft.", text: `# Probe\n\nDas Konto des Owners ${GEHEIM}.`, personal: true }, "test");
    const [bDs, bZai, bClaude, o] = await life(f, [post("/api/branches", { repo: f.repo, name: "Weg deepseek" }),
      post("/api/branches", { repo: f.repo, name: "Weg zai" }), post("/api/branches", { repo: f.repo, name: "Weg claude" }),
      post("/api/slots/12/open", { cwd: f.repo, label: "Claude-Öffnerin", bibliothek: [PACK, "fleet-doors", "sharpen3"] }), "save"], ZAUN);
    expect([bDs?.status, bZai?.status, bClaude?.status, o?.status, o?.body.error]).toEqual([201, 201, 201, 200, undefined]);
    // ihre eigenen Packs, wie sie die Tür schreibt: der persönliche Pack steht in Slot.selbst
    const st = persisted(f);
    (st.slots as Record<string, Record<string, unknown>>)["12"]!.selbst = { jetzt: { packs: [PACK], zweck: null }, naechster: null, neu: [] };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify(st));
    const tok = tokenOf(f, 12);
    const [kDs, kZai, kClaude] = await life(f, [
      als(tok, post("/api/self/branches/open", { branch: String(bDs?.body.branch), harness: "pi-deepseek", model: "deepseek-v4-pro" })),
      als(tok, post("/api/self/branches/open", { branch: String(bZai?.body.branch), harness: "pi-zai" })),
      als(tok, post("/api/self/branches/open", { branch: String(bClaude?.body.branch) })), "save"], ZAUN);
    expect([kDs?.status, kZai?.status, kClaude?.status, kDs?.body.error, kZai?.body.error, kClaude?.body.error]).toEqual([200, 200, 200, undefined, undefined, undefined]);
    // die Startdatei, die pi hinter --append-system-prompt liest, und alles, was Fleet sonst in das Agent-Verzeichnis des Sitzes legte
    const alleDateien = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? alleDateien(join(dir, e.name)) : [join(dir, e.name)]));
    for (const [kind, agentDir] of [[kDs, ZAUN.FLEET_PI_DEEPSEEK_AGENT_DIR], [kZai, ZAUN.FLEET_PI_ZAI_AGENT_DIR]] as const) {
      const [, pi] = await aufrufe(Number(kind?.body.slot));
      const flag = (pi ?? []).indexOf("--append-system-prompt");
      expect(flag).toBeGreaterThan(-1);
      const startDatei = pi![flag + 1]!;
      expect(startDatei.startsWith(agentDir)).toBe(true);
      const start = readFileSync(startDatei, "utf8");
      // der Rest der Wahl kommt an (die Grenze nimmt nur den persönlichen Pack) ...
      expect(start).toContain("--- fleet-doors (");
      // ... der Text des persönlichen Packs nirgends: nicht in der Startdatei, in keiner Skill-Datei, in keiner Datei des Agent-Verzeichnisses
      expect(start).not.toContain(GEHEIM);
      expect(start).not.toContain(`--- ${PACK} `);
      expect(existsSync(join(agentDir, "skills", "sharpen3", "SKILL.md"))).toBe(true);
      for (const datei of alleDateien(agentDir)) expect(readFileSync(datei, "utf8")).not.toContain(GEHEIM);
    }
    // die Fassung des deepseek-Kindes nennt den Pack als Zeile statt als Text
    const [fassung] = await life(f, [get(`/api/slots/${Number(kDs?.body.slot)}/fassung?anlass=laufend`)], ZAUN);
    const wissen = ((fassung?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
      .filter((teil) => teil.id === "liest").flatMap((teil) => teil.abschnitte).filter((x) => x.id === "wissen").map((x) => x.text ?? "").join("\n");
    expect(wissen).toContain(weggelassenZeile(`pack ${PACK}`, "pi-deepseek", "deepseek-v4-pro"));
    // Gegenbeweis: das Claude-Kind derselben Öffnerin bekommt den Text
    const claudeFile = join(ARGV, `claude-slot-${Number(kClaude?.body.slot)}`);
    for (let i = 0; i < 200 && !existsSync(claudeFile); i++) await Bun.sleep(50);
    const args = readFileSync(claudeFile, "utf8").split("\0");
    const claudeStart = ["--append-system-prompt", "--append-system-prompt-file"].flatMap((flag) => {
      const wert = args[args.indexOf(flag) + 1];
      return args.includes(flag) && wert ? [wert.startsWith("/") && existsSync(wert) ? readFileSync(wert, "utf8") : wert] : [];
    }).join("\n\n");
    expect(claudeStart).toContain(GEHEIM);
    expect(claudeStart).toContain(`--- ${PACK} `);
  }, 120_000);
});

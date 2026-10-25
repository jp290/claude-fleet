// Die Agent-MD eines gespeicherten Profils kommt bei der gestarteten Session an (Harness 2.0 Schritt 2, modell.md Änderung 1: „die Tür nimmt
// das Profil ganz“). Geprüft an der Pane: an der Zeile, mit der tmux sie startete (wie server/rechte.test.ts), und an fleet.json.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";
import { agentMdDerTuer, agentMdText } from "./agentmd";
import { SPEICHER_DATEI } from "../src/k15-speicher";

const { SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const DATEI = { titel: "planer.md", v: 2, pfad: "eigene Datei", abschnitte: [
  { titel: "# Planer", text: "Du setzt selten ein Ziel und lässt Jev wählen." },
  { titel: "## Was du meldest", text: "Ein Satz Ergebnis." },
] };
const TEXT = "# Planer\nDu setzt selten ein Ziel und lässt Jev wählen.\n\n## Was du meldest\nEin Satz Ergebnis.";
const speicher = (dir: string): void => writeFileSync(join(dir, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [
  { id: "planer", rolle: "nur-ordner", schiene: "session", name: "Planer", datei: DATEI },
  { id: "leer", rolle: "nur-ordner", schiene: "session", name: "Ohne Datei" },
] }));

function startzeile(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  return zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").replaceAll("'\\''", "'");
}
// tmux hält Zeilenumbrüche maskiert: geprüft wird, dass jede Zeile des Blocks in der Startzeile steht
const traegt = (zeile: string, block: string): void => {
  for (const z of block.split("\n").filter(Boolean)) expect(zeile).toContain(z);
};
const offen = (a: Answer | undefined): void => {
  if (a?.status !== 200) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
};
const gespeichert = (f: Fixture, slot: number): unknown =>
  (persisted(f).slots as Record<string, { agentMd?: unknown }> | undefined)?.[String(slot)]?.agentMd;

describe("Agent-MD an der Tür", () => {
  test("die Datei eines Profils wird Abschnitt für Abschnitt zu Text; ohne Abschnitte gibt es keinen", () => {
    expect(agentMdText(DATEI)).toEqual({ titel: "planer.md", text: TEXT });
    expect(agentMdText({ titel: "x", abschnitte: [] })).toBeNull();
    expect(agentMdText("planer.md")).toBeNull();
  });
  test("fehlt, gehört zu einem gespeicherten Profil, gibt es nicht, hat keine Datei, gehört nicht zu Claude Code", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentmd-"));
    speicher(dir);
    expect(await agentMdDerTuer({}, "claude", dir)).toEqual({ ok: true, agentMd: null });
    expect(await agentMdDerTuer({ profil: "planer" }, "claude", dir)).toMatchObject({ ok: true, agentMd: { profil: "planer", titel: "planer.md", text: TEXT, name: "Planer" } });
    expect(await agentMdDerTuer({ profil: "fremd" }, "claude", dir)).toEqual({ ok: false, error: "no saved profile „fremd“" });
    expect(await agentMdDerTuer({ profil: "leer" }, "claude", dir)).toEqual({ ok: false, error: "profile „leer“ has no Agent-MD" });
    expect(await agentMdDerTuer({ profil: 7 }, "claude", dir)).toMatchObject({ ok: false });
    expect(await agentMdDerTuer({ profil: "planer" }, "pi", dir)).toMatchObject({ ok: false, error: expect.stringContaining("pi") });
    expect(await agentMdDerTuer({ profil: "planer" }, "claude", mkdtempSync(join(tmpdir(), "agentmd-leer-")))).toEqual({ ok: false, error: "no saved profiles to read" });
  });
});

describe("Agent-MD kommt bei der gestarteten Session an", () => {
  test("die Fassung nennt das Profil unter den Wahlen (`profil`), damit das Banner der laufenden Session es zeigt", async () => {
    const f = fixture();
    speicher(f.state);
    const [opened, laufend] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, profil: "planer" }), get("/api/slots/1/fassung?anlass=laufend")]);
    offen(opened);
    expect(laufend?.body.wahlen).toEqual({ profil: "planer" });
  }, LIFE_DEADLINE_MS * 2);
  test("/open mit profil: der Systemprompt trägt die Datei, fleet.json hält sie über ein Laden", async () => {
    const f = fixture();
    speicher(f.state);
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, profil: "planer" })]);
    offen(opened);
    expect(opened?.body.agentMd).toMatchObject({ profil: "planer", titel: "planer.md" });
    traegt(startzeile(f, f.repo), `AGENT-MD (profile “planer”, file “planer.md”, set by the owner at start):\n${TEXT}`);
    expect(gespeichert(f, 1)).toEqual({ profil: "planer", titel: "planer.md", text: TEXT, name: "Planer" });
    await life(f, ["save"]);
    expect(gespeichert(f, 1)).toEqual({ profil: "planer", titel: "planer.md", text: TEXT, name: "Planer" });
  }, LIFE_DEADLINE_MS * 2);

  test("/api/branches/open mit profil und Rechten: beides steht im Systemprompt", async () => {
    const f = fixture();
    speicher(f.state);
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Planer A" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/planer-a", profil: "planer", rechte: { stufe: "lesen" } })]);
    offen(opened);
    const zeile = startzeile(f, String(made?.body.path));
    expect(zeile).toContain("FLEET RIGHTS (level “read only”");
    traegt(zeile, TEXT);
    expect(gespeichert(f, Number(opened?.body.slot))).toMatchObject({ profil: "planer" });
  }, LIFE_DEADLINE_MS);

  test("ohne profil startet die Session wie bisher: kein Block, nichts in fleet.json", async () => {
    const f = fixture();
    speicher(f.state);
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    expect(startzeile(f, f.repo)).not.toContain("AGENT-MD");
    expect(opened?.body.agentMd).toBeUndefined();
    expect(gespeichert(f, 1)).toBeUndefined();
  }, LIFE_DEADLINE_MS);

  test("unbekanntes Profil, Profil ohne Datei oder ein anderer Agent: 400, und keine Session startet", async () => {
    const f = fixture();
    speicher(f.state);
    const [fremd, leer, pi] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, profil: "fremd" }),
      post("/api/slots/1/open", { cwd: f.repo, profil: "leer" }),
      post("/api/slots/1/open", { cwd: f.repo, harness: "pi", profil: "planer" })]);
    for (const a of [fremd, leer, pi]) expect(a).toMatchObject({ status: 400, body: { error: expect.stringContaining("profil") } });
    expect(() => startzeile(f, f.repo)).toThrow("keine Pane");
  }, LIFE_DEADLINE_MS);
});

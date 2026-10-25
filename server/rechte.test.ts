// Was eine Session darf, kommt bei ihr an (Auftrag session-ui-bau.md, Fertig: „die eingestellten Rechte kommen bei der gestarteten
// Session an (prüfbar an ihr, nicht am Fenster)“). Jedes `life` ist ein Leben des Servers in einem eigenen Prozess
// (server/branches.drive.ts); geprüft wird an der Pane der gestarteten Session: an der Zeile, mit der tmux sie startete.
import { afterAll, describe, expect, test } from "bun:test";
import { type Answer, branchTestkit, type Fixture, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";
import { rechteDerTuer } from "./rechte";

const { SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

// die Startzeile der Pane, wie tmux sie hält (in Anführungszeichen, `\`, `$` und `"` mit vorangestelltem `\`), und ihr `--settings`
function startzeile(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  return zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1");
}
function settings(zeile: string): Record<string, unknown> {
  // einfach gequotet (shellSingleQuote): ein `'` im Text steht als `'\''`
  const m = /--settings '((?:[^']|'\\'')*)'/.exec(zeile);
  if (!m?.[1]) throw new Error(`kein --settings in der Startzeile: ${zeile.slice(0, 400)}`);
  return JSON.parse(m[1].replaceAll("'\\''", "'")) as Record<string, unknown>;
}
const offen = (a: Answer | undefined): void => {
  if (a?.status !== 200) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
};
const gespeichert = (f: Fixture, slot: number): unknown =>
  (persisted(f).slots as Record<string, { rechte?: unknown }> | undefined)?.[String(slot)]?.rechte;

describe("Rechte an der Tür: nur lesbare und nur für Claude Code", () => {
  test("fehlt, ist lesbar, ist unlesbar, gehört nicht zu Claude Code", () => {
    expect(rechteDerTuer({}, "claude")).toEqual({ ok: true, rechte: null });
    expect(rechteDerTuer({ rechte: { stufe: "lesen" } }, "claude")).toEqual({ ok: true, rechte: { stufe: "lesen", an: [], aus: [] } });
    for (const rechte of [{ stufe: "alles" }, { stufe: "bauen", an: ["landen"], aus: ["landen"] }, { stufe: "bauen", an: ["rm"] }, ["bauen"], "bauen"])
      expect(rechteDerTuer({ rechte }, "claude").ok).toBe(false);
    expect(rechteDerTuer({ rechte: { stufe: "bauen" } }, "codex")).toMatchObject({ ok: false, error: expect.stringContaining("codex") });
  });
});

describe("Rechte kommen bei der gestarteten Session an", () => {
  test("/open: die Startzeile trägt allow, deny und den Satz; fleet.json hält sie über ein Laden", async () => {
    const f = fixture();
    const rechte = { stufe: "landen", an: ["deploy"], aus: [] };
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte })]);
    offen(opened);
    expect(opened?.body.rechte).toEqual(rechte);
    const zeile = startzeile(f, f.repo);
    expect(settings(zeile).permissions).toEqual({ allow: ["Bash(./ctl.sh land *)", "Bash(curl *api/deploy*)"],
      deny: ["Bash(curl *api/worktrees/discard*)"] });
    expect(zeile).toContain("FLEET RIGHTS (level “land”, set at start): allowed Edit, Write, ./ctl.sh land, POST /api/deploy; blocked POST /api/worktrees/discard.");
    expect(gespeichert(f, 1)).toEqual(rechte);
    await life(f, ["save"]);
    expect(gespeichert(f, 1)).toEqual(rechte);
  }, LIFE_DEADLINE_MS * 2);

  test("/api/branches/open mit „Nur lesen“: Dateien und alle Befehle gesperrt, nichts erlaubt", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Nur Lesen" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/nur-lesen", rechte: { stufe: "lesen" } })]);
    offen(opened);
    expect(settings(startzeile(f, String(made?.body.path))).permissions).toEqual({ allow: [],
      deny: ["Edit", "MultiEdit", "Write", "NotebookEdit", "Bash(./ctl.sh land *)", "Bash(curl *api/deploy*)", "Bash(curl *api/worktrees/discard*)"] });
    expect(gespeichert(f, Number(opened?.body.slot))).toEqual({ stufe: "lesen", an: [], aus: [] });
  }, LIFE_DEADLINE_MS);

  test("ohne Rechte startet die Session wie bisher: keine Regeln, kein Satz, nichts in fleet.json", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const zeile = startzeile(f, f.repo);
    // ein fremdes Repo, also eigenes Setup (server/eigenes-setup.ts): ohne Rechte trägt die Zeile gar kein --settings
    expect(zeile).not.toContain("--settings");
    expect(zeile).not.toContain("FLEET RIGHTS");
    expect(opened?.body.rechte).toBeUndefined();
    expect(gespeichert(f, 1)).toBeUndefined();
  }, LIFE_DEADLINE_MS);

  test("unlesbare Rechte oder ein anderer Agent: 400, und keine Session startet", async () => {
    const f = fixture();
    const [stufe, beides, pi] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { stufe: "alles" } }),
      post("/api/slots/1/open", { cwd: f.repo, rechte: { stufe: "bauen", an: ["deploy"], aus: ["deploy"] } }),
      post("/api/slots/1/open", { cwd: f.repo, harness: "pi", rechte: { stufe: "bauen" } })]);
    for (const a of [stufe, beides, pi]) expect(a).toMatchObject({ status: 400, body: { error: expect.stringContaining("rechte") } });
    expect(() => startzeile(f, f.repo)).toThrow("keine Pane");
  }, LIFE_DEADLINE_MS);
});

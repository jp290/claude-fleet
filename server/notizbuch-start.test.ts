// Das Notizbuch je Setup an der gestarteten Session (server/notizbuch.ts): an der Zeile, mit der tmux die Pane startete
// (wie server/agentmd.test.ts), und an der Fassung, die GET /api/slots/:n/fassung für dieselbe Session zeigt. Was die
// Fassung unter „Liest“ als Notizbuch nennt, ist der Ordner auf der Startzeile.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, post, sh } from "./branches-testkit";
import { SPEICHER_DATEI } from "../src/k15-speicher";

const { PROJECTS, SOCKETS, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const projekt = (repo: string): string => join(PROJECTS, repo.replace(/[^a-zA-Z0-9]/g, "-"));

function startzeile(f: Fixture, cwd: string): string {
  const r = Bun.spawnSync(["tmux", "-L", f.sock, "list-panes", "-a", "-F", "#{pane_current_path}\t#{pane_start_command}"],
    { env: { ...process.env, TMUX_TMPDIR: SOCKETS } });
  const zeile = r.stdout.toString().split("\n").find((z) => z.startsWith(`${cwd}\t`));
  if (!zeile) throw new Error(`keine Pane in ${cwd}: ${r.stdout.toString()}${r.stderr.toString()}`);
  return zeile.slice(cwd.length + 1).replace(/^"|"$/g, "").replace(/\\(.)/g, "$1").replaceAll("'\\''", "'");
}
const offen = (a: Answer | undefined): number => {
  if (a?.status !== 200 && a?.status !== 201) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return Number(a.body.slot ?? 1);
};
type Gedaechtnis = { bytes: number | "unknown"; text: string | null; dateien?: { pfad: string; bytes: number }[];
  notizbuch?: { art: string; pfad: string | null } };
async function gedaechtnis(f: Fixture, slot: number): Promise<Gedaechtnis> {
  const [antwort] = await life(f, [get(`/api/slots/${slot}/fassung?anlass=laufend`)]);
  const teile = (antwort?.body as { teile?: { id: string; abschnitte: ({ id: string } & Gedaechtnis)[] }[] }).teile ?? [];
  const abschnitt = teile.find((t) => t.id === "liest")?.abschnitte.find((a) => a.id === "gedaechtnis");
  if (!abschnitt) throw new Error(`keine Fassung: ${JSON.stringify(antwort).slice(0, 400)}`);
  return abschnitt;
}

describe("jedes Setup startet mit seinem Notizbuch", () => {
  test("eine Session auf einem Board-Branch: das Notizbuch ihres Branches auf der Zeile und in der Fassung, mit Größe", async () => {
    const f = fixture();
    // das Notizbuch steht vor dem Start da: `anlass=laufend` zeigt, womit die Session gestartet wurde (server/start-fassung.ts), nicht den Stand von jetzt
    const ordner = `${projekt(f.repo)}/notizbuecher/branch-branch%2Fnotiz-a`;
    mkdirSync(ordner, { recursive: true });
    const index = "- [Falle](falle.md) — der Port\n";
    writeFileSync(join(ordner, "MEMORY.md"), index);
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Notiz A" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/notiz-a" })]);
    const slot = offen(opened);
    const zeile = startzeile(f, String(made?.body.path));
    expect(zeile).toContain(`"autoMemoryDirectory":"${ordner}"`);
    expect(zeile).not.toContain("autoMemoryEnabled");
    const bytes = Buffer.byteLength(index);
    const erwartet = { bytes, text: index, notizbuch: { art: "eigen", pfad: ordner }, dateien: [{ pfad: `${ordner}/MEMORY.md`, bytes }] };
    expect(await gedaechtnis(f, slot)).toMatchObject(erwartet);
    // was die Session später dazuschreibt, ändert nicht, was sie beim Start las
    writeFileSync(join(ordner, "MEMORY.md"), `${index}- [Neu](neu.md) — nach dem Start\n`);
    expect(await gedaechtnis(f, slot)).toMatchObject(erwartet);
  }, LIFE_DEADLINE_MS * 4);

  test("ein Profil hat sein eigenes, auch auf einem Branch", async () => {
    const f = fixture();
    writeFileSync(join(f.state, SPEICHER_DATEI), JSON.stringify({ fassungen: [], packs: [], profile: [{ id: "planer", rolle: "nur-ordner",
      schiene: "session", name: "Planer", datei: { titel: "planer.md", v: 1, pfad: "eigene Datei", abschnitte: [{ titel: "# Planer", text: "Plane." }] } }] }));
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Planer B" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/planer-b", profil: "planer" })]);
    const slot = offen(opened);
    const ordner = `${projekt(f.repo)}/notizbuecher/profil-planer`;
    expect(startzeile(f, String(made?.body.path))).toContain(`"autoMemoryDirectory":"${ordner}"`);
    expect(await gedaechtnis(f, slot)).toMatchObject({ bytes: 0, text: "", notizbuch: { art: "eigen", pfad: ordner } });
  }, LIFE_DEADLINE_MS * 3);

  test("die Orchestratorin hat ihr eigenes, nicht den geteilten Projektordner", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: "🎛 Orchestratorin" })]);
    offen(opened);
    const ordner = `${projekt(f.repo)}/notizbuecher/orchestratorin`;
    expect(startzeile(f, f.repo)).toContain(`"autoMemoryDirectory":"${ordner}"`);
    expect((await gedaechtnis(f, 1)).notizbuch).toMatchObject({ art: "eigen", pfad: ordner });
  }, LIFE_DEADLINE_MS * 3);

  test("eine freie Session im Haupt-Checkout setzt nichts und liest den geteilten Projektordner", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    const zeile = startzeile(f, f.repo);
    expect(zeile).not.toContain("autoMemoryDirectory");
    expect(zeile).not.toContain("autoMemoryEnabled");
    expect((await gedaechtnis(f, 1)).notizbuch).toMatchObject({ art: "geteilt", pfad: `${projekt(f.repo)}/memory` });
  }, LIFE_DEADLINE_MS * 3);

  // ein eigenes Notizbuch hat nur ein Branch mit Board-Eintrag: ein beliebiger Worktree ist noch kein Setup
  test("eine Session in einem Worktree auf einem Branch ohne Board-Eintrag setzt nichts und liest den geteilten Projektordner", async () => {
    const f = fixture();
    const wt = join(f.repo, "..", "wt-ohne-board");
    sh(f.repo, "worktree", "add", "-q", "-b", "frei/ohne-board", wt);
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: wt })]);
    offen(opened);
    const zeile = startzeile(f, wt);
    expect(zeile).not.toContain("autoMemoryDirectory");
    expect(zeile).not.toContain("autoMemoryEnabled");
    expect((await gedaechtnis(f, 1)).notizbuch).toMatchObject({ art: "geteilt", pfad: `${projekt(f.repo)}/memory` });
  }, LIFE_DEADLINE_MS * 3);

  test("der Haupt-Checkout auf einem Board-Branch ist kein Sitz dieses Branches: geteilt", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Haupt C" })]);
    if (typeof made?.body.path === "string") sh(f.repo, "worktree", "remove", "--force", made.body.path);
    sh(f.repo, "checkout", "-q", "branch/haupt-c");
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo })]);
    offen(opened);
    expect(startzeile(f, f.repo)).not.toContain("autoMemoryDirectory");
    expect((await gedaechtnis(f, 1)).notizbuch).toMatchObject({ art: "geteilt", pfad: `${projekt(f.repo)}/memory` });
  }, LIFE_DEADLINE_MS * 3);
});

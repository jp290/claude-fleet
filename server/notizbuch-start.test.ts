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
  // DAS EIGENE SETUP (owner 23.10. ~22:00, server/eigenes-setup.ts): ein Board-Branch eines fremden Repos ist das Repo seines Nutzers, und
  // seine Session behält Claudes eigenes Gedächtnis; das Notizbuch des Branches gibt es nur in Fleets Repo (notizbuch.test.ts, notizbuchFuer)
  test("eine Session auf einem Board-Branch eines fremden Repos: kein Branch-Notizbuch, Claudes eigenes Gedächtnis", async () => {
    const f = fixture();
    const ordner = `${projekt(f.repo)}/notizbuecher/branch-branch%2Fnotiz-a`;
    mkdirSync(ordner, { recursive: true });
    writeFileSync(join(ordner, "MEMORY.md"), "- [Falle](falle.md) — der Port\n");
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Notiz A" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/notiz-a" })]);
    const slot = offen(opened);
    const zeile = startzeile(f, String(made?.body.path));
    expect(zeile).not.toContain("autoMemoryDirectory");
    expect(zeile).not.toContain("autoMemoryEnabled");
    expect((await gedaechtnis(f, slot)).notizbuch?.art).toBe("geteilt");
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

// DIE WAHL AN DER TÜR (Owner 23.10. ~22:30: im eigenen Setup gibt Fleet nur mit, was gewählt ist): das Feld `notizbuch` kommt bis auf die
// Startzeile, und die Fassung nennt es unter „[Zitat entfernt]“. Die Fixture ist ein fremdes Repo, also eigenes Setup.
async function mitgegeben(f: Fixture, slot: number): Promise<string | null> {
  const [antwort] = await life(f, [get(`/api/slots/${slot}/fassung?anlass=laufend`)]);
  const teile = (antwort?.body as { teile?: { id: string; abschnitte: { id: string; text: string | null }[] }[] }).teile ?? [];
  return teile.find((t) => t.id === "darf")?.abschnitte.find((a) => a.id === "mitgegeben")?.text ?? null;
}
describe("das Notizbuch ist eine Wahl an der Tür", () => {
  test("ohne Wahl: Claudes eigenes Gedächtnis und „mitgegeben“ ist nichts; der Plan nennt den Modus", async () => {
    const f = fixture();
    const [plan, lane, opened] = await life(f, [get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner`),
      get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=lane`), post("/api/slots/1/open", { cwd: f.repo })]);
    expect(plan?.body.modus).toBe("eigenes-setup");
    expect(lane?.body.modus).toBe("fleet-sitz");
    offen(opened);
    expect(startzeile(f, f.repo)).not.toContain("autoMemory");
    expect(await mitgegeben(f, 1)).toBe("nothing");
  }, LIFE_DEADLINE_MS * 3);

  test("„aus“ schaltet Claudes Gedächtnis ab und steht als Zeile da", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, notizbuch: "aus" })]);
    offen(opened);
    expect(startzeile(f, f.repo)).toContain('"autoMemoryEnabled":false');
    expect((await gedaechtnis(f, 1)).notizbuch?.art).toBe("aus");
    expect(await mitgegeben(f, 1)).toBe("notizbuch: aus");
  }, LIFE_DEADLINE_MS * 3);

  // ohne Board-Branch das des git-Branches (Slot 16 für den Owner, 24.10.; Prüfung Runde 7, B7: „[Zitat entfernt]“ im Checkout lehnte die Tür ab)
  test("„branch“ gibt einer Branch-Session im fremden Repo das Notizbuch ihres Branches; ohne Board-Branch das des git-Branches im Checkout", async () => {
    const f = fixture();
    const [made, opened, ohneBranch, falsch] = await life(f, [post("/api/branches", { repo: f.repo, name: "Notiz W" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/notiz-w", notizbuch: "branch" }),
      post("/api/slots/2/open", { cwd: f.repo, notizbuch: "branch" }), post("/api/slots/3/open", { cwd: f.repo, notizbuch: "an" })]);
    const slot = offen(opened);
    const ordner = `${projekt(f.repo)}/notizbuecher/branch-branch%2Fnotiz-w`;
    expect(startzeile(f, String(made?.body.path))).toContain(`"autoMemoryDirectory":"${ordner}"`);
    expect(await mitgegeben(f, slot)).toBe("notizbuch: branch");
    expect(ohneBranch?.status).toBe(200);
    expect(startzeile(f, f.repo)).toContain(`"autoMemoryDirectory":"${projekt(f.repo)}/notizbuecher/branch-main"`);
    expect(falsch?.status).toBe(400);
  }, LIFE_DEADLINE_MS * 4);
});

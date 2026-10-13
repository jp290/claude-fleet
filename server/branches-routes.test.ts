// Neuaufbau K5 · Task = Branch, die Routen. Owner 11.10.: „[Zitat entfernt]“; Plan K5:
// „Owner oder Orchestratorin öffnen vom Board aus eine Session auf einem benannten Branch … Punkte je
// Branch überleben das Schließen der Session“; Bauleitung 13.10.: Punkte gehören zu (Repo, Branch), sie
// überleben das Entfernen des Worktrees; „passt“ steht am Branch mit Zeit und Commit. Entwurf K2: ein
// doppelter Name wird abgewiesen; K4: kein Punkt geht verloren.
//
// Jedes `life` ist ein Leben des Servers in einem eigenen Prozess (server/branches.drive.ts): Zustand
// laden, Boot-Umschlüsselung, Anfragen. Zwei Leben nacheinander sind ein Neustart dazwischen.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DRIVE = join(import.meta.dir, "branches.drive.ts");
const LIFE_DEADLINE_MS = 30_000;
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-branches-")));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));

interface Answer { status: number; body: Record<string, unknown> }
interface Fixture { repo: string; state: string; token: string }
let fixtures = 0;

function sh(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync(["git", "-C", cwd, ...args], { env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t",
    GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}
function freePort(): number {
  const probe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = probe.port;
  probe.stop(true);
  if (port === undefined) throw new Error("kein freier Port");
  return port;
}
// ein Repo mit einem Commit auf main, ein leeres Zustandsverzeichnis, ein Owner-Token
function fixture(): Fixture {
  const dir = join(TMP, `f${++fixtures}`);
  const repo = join(dir, "repo"), state = join(dir, "state");
  mkdirSync(repo, { recursive: true });
  mkdirSync(state);
  sh(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "README"), "fixture\n");
  sh(repo, "add", "README");
  sh(repo, "commit", "-q", "-m", "start");
  return { repo, state, token: `owner-${process.pid}-${fixtures}` };
}
function commitIn(path: string, file: string, subject: string): string {
  writeFileSync(join(path, file), `${subject}\n`);
  sh(path, "add", file);
  sh(path, "commit", "-q", "-m", subject);
  return sh(path, "rev-parse", "HEAD");
}
async function life(f: Fixture, steps: unknown[]): Promise<Answer[]> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env))
    if (value !== undefined && !key.startsWith("FLEET_")) env[key] = value;
  const proc = Bun.spawn([process.execPath, DRIVE, JSON.stringify(steps)], { cwd: f.state, stdout: "pipe", stderr: "pipe",
    env: { ...env, FLEET_HOST: "127.0.0.1", FLEET_PORT: String(freePort()), FLEET_SOCK: `fleetbranch${process.pid}`,
      FLEET_STATE_DIR: f.state, FLEET_TOKEN: f.token, FLEET_DISPATCH_REPO: f.repo } });
  const deadline = setTimeout(() => proc.kill("SIGKILL"), LIFE_DEADLINE_MS);
  const code = await proc.exited;
  clearTimeout(deadline);
  const stdout = await new Response(proc.stdout).text();
  if (code !== 0) throw new Error(`Leben endete mit ${code}: ${(await new Response(proc.stderr).text()).slice(-2000)}`);
  return JSON.parse(stdout.trim().split("\n").at(-1) ?? "[]") as Answer[];
}
const post = (path: string, body: unknown, token?: string | null) => ({ method: "POST", path, body, ...(token === undefined ? {} : { token }) });
const get = (path: string) => ({ method: "GET", path });
type BranchRow = { branch: string; name: string; text: string; rev: number; path: string | null; head: string;
  seen: { head: string; via: string } | null; distance: { ahead: number; behind: number } | null };
function rowsOf(a: Answer, repo: string): { branches: BranchRow[]; others: { branch: string; path: string | null }[] } {
  const repos = (a.body as { repos?: { repo: string; branches: BranchRow[]; others: { branch: string; path: string | null }[] }[] }).repos ?? [];
  const r = repos.find((x) => x.repo === repo);
  if (!r) throw new Error(`Repo ${repo} fehlt in GET /api/branches: ${JSON.stringify(a.body).slice(0, 300)}`);
  return r;
}
const persisted = (f: Fixture): Record<string, unknown> =>
  JSON.parse(readFileSync(join(f.state, "fleet.json"), "utf8")) as Record<string, unknown>;

describe("Branch öffnen: Name und Punkte vom Board, der Name ist im Repo eindeutig", () => {
  test("ein neuer Branch bekommt Worktree, Namen und Punkte; ein zweiter mit demselben Namen legt nichts an", async () => {
    const f = fixture();
    const [made, twice, list] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Kritik Probe", points: ["Datei anlegen", "Readme ergänzen"] }),
      post("/api/branches", { repo: f.repo, name: "kritik  probe", points: ["Noch einer"] }),
      get("/api/branches")]);
    expect(made?.status).toBe(201);
    expect(made?.body).toMatchObject({ branch: "branch/kritik-probe", created: true, name: "Kritik Probe",
      text: "- [ ] Datei anlegen\n- [ ] Readme ergänzen", rev: 1 });
    expect(existsSync(String(made?.body.path))).toBe(true);
    expect(twice).toMatchObject({ status: 409, body: { existing: { branch: "branch/kritik-probe", name: "Kritik Probe" } } });
    expect(sh(f.repo, "branch", "--format=%(refname:short)").split("\n").sort()).toEqual(["branch/kritik-probe", "main"]);
    const row = rowsOf(list!, f.repo).branches;
    expect(row.map((r) => [r.name, r.text, r.path, r.distance])).toEqual([
      ["Kritik Probe", "- [ ] Datei anlegen\n- [ ] Readme ergänzen", String(made?.body.path), { ahead: 0, behind: 0 }]]);
  }, LIFE_DEADLINE_MS);

  test("die Linie des Repos (main) ist kein Branch zum Arbeiten; ohne Token kommt niemand herein", async () => {
    const f = fixture();
    const [onMain, noToken] = await life(f, [
      post("/api/branches", { repo: f.repo, branch: "main", name: "Hauptlinie" }),
      { ...post("/api/branches", { repo: f.repo, name: "Fremd" }), token: null }]);
    expect(onMain?.status).toBe(400);
    expect(noToken?.status).toBe(401);
    expect(sh(f.repo, "branch", "--format=%(refname:short)")).toBe("main");
  }, LIFE_DEADLINE_MS);
});

describe("Punkte gehören zum Branch: Worktree weg, Neustart, neu ausgecheckt — dieselben Punkte", () => {
  test("nach Entfernen des Worktrees und einem Neustart steht der Branch ohne Worktree da; Öffnen checkt ihn neu aus", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Probe", points: ["eins"] })]);
    const path = String(made?.body.path);
    commitIn(path, "datei.txt", "Datei anlegen");
    sh(f.repo, "worktree", "remove", path);
    const [before, reopened, after] = await life(f, [
      get("/api/branches"),
      post("/api/branches", { repo: f.repo, branch: "branch/probe", name: "Probe" }),
      get("/api/branches")]);
    expect(rowsOf(before!, f.repo).branches.map((r) => [r.name, r.text, r.path, r.distance?.ahead]))
      .toEqual([["Probe", "- [ ] eins", null, 1]]);
    expect(reopened).toMatchObject({ status: 200, body: { created: false, text: "- [ ] eins", rev: 1 } });
    expect(existsSync(join(String(reopened?.body.path), "datei.txt"))).toBe(true);
    expect(rowsOf(after!, f.repo).branches.map((r) => r.path)).toEqual([String(reopened?.body.path)]);
  }, LIFE_DEADLINE_MS);
});

describe("kein Punkt geht verloren: geschrieben wird gegen den gelesenen Stand", () => {
  test("ein Gerät auf altem Stand bekommt 409 und den Text des anderen; nach dem Neustart steht der Text des ersten", async () => {
    const f = fixture();
    const [, phone, desk] = await life(f, [
      post("/api/branches", { repo: f.repo, name: "Zwei Geräte", points: ["eins"] }),
      post("/api/branches/note", { repo: f.repo, branch: "branch/zwei-geraete", text: "- [ ] eins\n- [ ] vom Telefon", rev: 1 }),
      post("/api/branches/note", { repo: f.repo, branch: "branch/zwei-geraete", text: "- [x] eins", rev: 1 })]);
    expect(phone).toEqual({ status: 200, body: { ok: true, rev: 2, length: "- [ ] eins\n- [ ] vom Telefon".length } });
    expect(desk).toMatchObject({ status: 409, body: { current: { text: "- [ ] eins\n- [ ] vom Telefon", rev: 2 } } });
    const [list] = await life(f, [get("/api/branches")]);
    expect(rowsOf(list!, f.repo).branches.map((r) => [r.text, r.rev])).toEqual([["- [ ] eins\n- [ ] vom Telefon", 2]]);
  }, LIFE_DEADLINE_MS);
});

describe("Owner hat gesehen / passt: Zeit, Commit, Tür", () => {
  test("passt steht an der Spitze, über einen Neustart; ein Commit, der nicht auf dem Branch liegt, wird abgewiesen", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Gesehen" })]);
    const tip = commitIn(String(made?.body.path), "a.txt", "erste Arbeit");
    const onlyMain = commitIn(f.repo, "m.txt", "nur auf main");
    const [seen, foreign, short] = await life(f, [
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: tip }),
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: onlyMain }),
      post("/api/branches/seen", { repo: f.repo, branch: "branch/gesehen", head: tip.slice(0, 8) })]);
    expect(seen).toMatchObject({ status: 200, body: { seen: { head: tip, via: "bearer" } } });
    expect([foreign?.status, short?.status]).toEqual([409, 400]);
    const [list] = await life(f, [get("/api/branches")]);
    expect(rowsOf(list!, f.repo).branches.map((r) => [r.head, r.seen?.head, r.distance])).toEqual([[tip, tip, { ahead: 1, behind: 1 }]]);
  }, LIFE_DEADLINE_MS);
});

describe("Diff ohne Session", () => {
  test("Dateien, Commits und Diff des Branches gegen seine Basis, ohne dass eine Session läuft", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Mit Diff" })]);
    commitIn(String(made?.body.path), "neu.txt", "Datei neu");
    commitIn(f.repo, "m.txt", "main zieht weiter");
    const [diff] = await life(f, [get(`/api/branches/diff?repo=${encodeURIComponent(f.repo)}&branch=branch/mit-diff`)]);
    expect(diff?.status).toBe(200);
    expect(diff?.body).toMatchObject({ base: "main", files: ["neu.txt"], commits: [{ subject: "Datei neu" }], truncated: false });
    expect(String(diff?.body.diff)).toContain("+Datei neu");
    expect(String(diff?.body.diff)).not.toContain("main zieht weiter");
  }, LIFE_DEADLINE_MS);
});

describe("Altbestand: Notizblöcke je Pfad wandern auf ihren Branch, der alte Schlüssel bleibt", () => {
  test("die Übernahme läuft einmal: ein Branch, der später am alten Pfad steht, erbt den Notizblock nicht", async () => {
    const f = fixture();
    const path = join(`${f.repo}.worktrees`, "alt");
    sh(f.repo, "worktree", "add", "-q", "-b", "alt/notiz", path);
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify({ worktreeNotes: { [path]: "- [ ] alt" } }));
    await life(f, ["save"]);
    expect(typeof persisted(f).branchNotesAdoptedAt).toBe("number");
    sh(path, "checkout", "-q", "-b", "alt/anders");
    const [fresh] = await life(f, [post("/api/branches/note", { repo: f.repo, branch: "alt/anders", text: "- [ ] neu", rev: 0 })]);
    expect(fresh).toEqual({ status: 200, body: { ok: true, rev: 1, length: "- [ ] neu".length } });
  }, LIFE_DEADLINE_MS);

  test("zwei Boots ergeben denselben Stand; worktreeNotes steht unverändert in fleet.json; ein discard beendet den Datensatz", async () => {
    const f = fixture();
    const path = join(`${f.repo}.worktrees`, "alt");
    sh(f.repo, "worktree", "add", "-q", "-b", "alt/notiz", path);
    const legacy = { [path]: "- [ ] alt", [join(TMP, "gibt-es-nicht")]: "verwaist" };
    writeFileSync(join(f.state, "fleet.json"), JSON.stringify({ worktreeNotes: legacy }));
    const stale = post("/api/branches/note", { repo: f.repo, branch: "alt/notiz", text: "überschrieben?", rev: 0 });
    const [first] = await life(f, [stale, "save"]);
    expect(first).toMatchObject({ status: 409, body: { current: { text: "- [ ] alt", rev: 1 } } });
    const once = persisted(f);
    const [second] = await life(f, [stale, "save"]);
    expect(second).toEqual(first!);
    expect(persisted(f).branches).toEqual(once.branches);
    expect(persisted(f).worktreeNotes).toEqual(legacy);
    const [gone, after] = await life(f, [
      post("/api/worktrees/discard", { repo: f.repo, path, branch: "alt/notiz" }),
      post("/api/branches/note", { repo: f.repo, branch: "alt/notiz", text: "", rev: 1 })]);
    expect(gone).toMatchObject({ status: 200, body: { branchDeleted: true } });
    expect(after?.status).toBe(404);
    expect(persisted(f).branches).toBeUndefined();
    expect(persisted(f).worktreeNotes).toEqual(legacy);
  }, LIFE_DEADLINE_MS);
});

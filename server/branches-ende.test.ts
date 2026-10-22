// Das Ende gelandeter Branches im Server (server.ts#endLandedBranchesNow). Owner 22.10.: „[Zitat entfernt]“
// 
// . Ein gelandeter Branch, auf dem seither nichts dazukam, in dessen Worktree keine
// Session sitzt oder gerade hineinkommt (eine Nachfolge zwischen Kill und Öffnen), in dessen Worktree keine
// ignorierte Datei liegt (ein Upload in drops/), dessen Notizblock keinen offenen Punkt hat und aus dem keine
// Testinstanz läuft oder startet, endet ganz: Worktree, git-Branch, Board-Eintrag. Das Ledger branch-ends.jsonl
// (der ganze Datensatz mit Notizblock), die Zeile im Audit-Log und refs/fleet/ended/<branch> tragen seine
// Spitze, damit er zurückkommt. Alles in Fixture-Repos; der Durchgang läuft hier als Schritt "end", nicht per Timer.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, commitIn, get, LIFE_DEADLINE_MS, persisted, post, rowsOf, sh } from "./branches-testkit";

const { TMP, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

interface Ended { ended: { repo: string; branch: string; head: string; path: string | null; land: string }[]; kept: { branch: string; why: string }[] }
const sweep = (a: Answer | undefined): Ended => a?.body as unknown as Ended;
const hasRef = (repo: string, ref: string): boolean =>
  Bun.spawnSync(["git", "-C", repo, "rev-parse", "--verify", "--quiet", ref]).exitCode === 0;

async function landed(name: string, slug: string) {
  const f = fixture();
  const [made] = await life(f, [post("/api/branches", { repo: f.repo, name })]);
  const path = String(made?.body.path);
  const tip = commitIn(path, "a.txt", "Arbeit");
  const [l] = await life(f, [post("/api/branches/land", { repo: f.repo, branch: `branch/${slug}`, subject: name, unchecked: true })]);
  expect(l?.status).toBe(200);
  return { f, path, tip, branch: `branch/${slug}`, sha: String(l?.body.sha) };
}

describe("ein gelandeter Branch endet von selbst", () => {
  test("nichts seit dem Land, keine Session, keine Testinstanz: Worktree, Branch und Board-Eintrag gehen; das Log trägt die Spitze", async () => {
    const { f, path, tip, branch, sha } = await landed("Fertig", "fertig");
    const [noted, end, list] = await life(f, [post("/api/branches/note", { repo: f.repo, branch, text: "- [x] gebaut", rev: 0 }), "end",
      get("/api/branches")]);
    expect(noted?.status).toBe(200);
    expect(sweep(end).ended).toEqual([{ repo: f.repo, branch, head: tip, path, land: sha }]);
    expect(existsSync(path)).toBe(false);
    expect(hasRef(f.repo, `refs/heads/${branch}`)).toBe(false);
    const rows = rowsOf(list!, f.repo);
    expect([rows.branches.map((r) => r.branch), rows.others.map((r) => r.branch)]).toEqual([[], []]);
    expect(persisted(f).branches ?? []).toEqual([]);
    const lines = (file: string) => readFileSync(join(f.state, file), "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(lines("audit.jsonl").filter((r) => r.event === "branch_ended").map((r) => [r.branch, r.head, r.path, r.land]))
      .toEqual([[branch, tip, path, sha]]);
    // der Notizblock steht im Ledger, nie im Audit-Log
    expect(lines("branch-ends.jsonl").map((r) => [r.branch, r.head, (r.record as { text: string }).text])).toEqual([[branch, tip, "- [x] gebaut"]]);
    expect(readFileSync(join(f.state, "audit.jsonl"), "utf8")).not.toContain("gebaut");
    // zurückholen: die Spitze steht unter refs/fleet/ended/
    sh(f.repo, "branch", branch, `refs/fleet/ended/${branch}`);
    expect(sh(f.repo, "rev-parse", branch)).toBe(tip);
    // main trägt die Charge weiter
    expect(sh(f.repo, "rev-parse", "main")).toBe(sha);
  }, LIFE_DEADLINE_MS * 3);

  test("der Rückweg aus docs/packs/running-fleet.md: Branch, Board-Eintrag und Notizblock kommen zurück, die Lands nicht", async () => {
    const { f, tip, branch } = await landed("Zurück", "zurueck");
    await life(f, [post("/api/branches/note", { repo: f.repo, branch, text: "- [x] gebaut", rev: 0 }), "end"]);
    expect(hasRef(f.repo, `refs/heads/${branch}`)).toBe(false);
    const line = readFileSync(join(f.state, "branch-ends.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as
      { branch: string; record: { name: string; text: string; rev: number } }).find((r) => r.branch === branch);
    sh(f.repo, "branch", branch, `refs/fleet/ended/${branch}`);
    const [made, stale] = await life(f, [post("/api/branches", { repo: f.repo, name: line?.record.name, branch }),
      post("/api/branches/note", { repo: f.repo, branch, text: line?.record.text, rev: line?.record.rev })]);
    expect([made?.status, made?.body.rev, stale?.status]).toEqual([200, 0, 409]); // 200: den Branch gab es schon
    const [noted, list] = await life(f, [post("/api/branches/note", { repo: f.repo, branch, text: line?.record.text, rev: 0 }),
      get("/api/branches")]);
    expect(noted?.status).toBe(200);
    const row = rowsOf(list!, f.repo).branches.find((r) => r.branch === branch);
    expect([row?.name, row?.head, row?.text, row?.lands]).toEqual(["Zurück", tip, "- [x] gebaut", []]);
    // ohne Land bleibt er stehen
    const [again] = await life(f, ["end"]);
    expect(sweep(again)).toEqual({ ended: [], kept: [] });
    expect(hasRef(f.repo, `refs/heads/${branch}`)).toBe(true);
  }, LIFE_DEADLINE_MS * 5);

  test("ein Commit nach dem Land: der Branch bleibt, mit Worktree und Eintrag", async () => {
    const { f, path, branch } = await landed("Weiter", "weiter");
    const later = commitIn(path, "b.txt", "noch mehr");
    const [end, list] = await life(f, ["end", get("/api/branches")]);
    expect(sweep(end).ended).toEqual([]);
    expect(sweep(end).kept.map((k) => k.branch)).toEqual([branch]);
    expect([existsSync(path), sh(f.repo, "rev-parse", branch)]).toEqual([true, later]);
    expect(rowsOf(list!, f.repo).branches.map((r) => r.branch)).toEqual([branch]);
  }, LIFE_DEADLINE_MS * 3);

  test("ungesicherte Arbeit im Worktree: der Branch bleibt", async () => {
    const { f, path, branch } = await landed("Offen", "offen");
    writeFileSync(join(path, "entwurf.txt"), "noch nicht committet\n");
    const [end] = await life(f, ["end"]);
    expect(sweep(end).ended).toEqual([]);
    expect([existsSync(join(path, "entwurf.txt")), hasRef(f.repo, `refs/heads/${branch}`)]).toEqual([true, true]);
  }, LIFE_DEADLINE_MS * 3);

  test("eine Session sitzt im Worktree: er bleibt; ist sie geschlossen, endet er", async () => {
    const { f, path, branch, tip } = await landed("Sitzt", "sitzt");
    const [opened, held] = await life(f, [post("/api/branches/open", { repo: f.repo, branch }), "end"]);
    expect(opened?.status).toBe(200);
    expect(sweep(held).ended).toEqual([]);
    expect(existsSync(path)).toBe(true);
    const [killed, end] = await life(f, [post(`/api/slots/${Number(opened?.body.slot)}/kill`, {}), "end"]);
    expect(killed?.status).toBe(200);
    expect(sweep(end).ended.map((e) => [e.branch, e.head])).toEqual([[branch, tip]]);
    expect(existsSync(path)).toBe(false);
  }, LIFE_DEADLINE_MS * 4);

  test("ein offener Punkt im Notizblock: er bleibt; ist der Punkt erledigt, endet er", async () => {
    const { f, path, branch } = await landed("Punkt", "punkt");
    const [noted, held] = await life(f, [post("/api/branches/note", { repo: f.repo, branch, text: "- [ ] dem Owner zeigen", rev: 0 }), "end"]);
    expect(noted?.status).toBe(200);
    expect(sweep(held).kept.map((k) => k.why)).toEqual(["1 offene Punkte im Notizblock"]);
    const [, end] = await life(f, [post("/api/branches/note", { repo: f.repo, branch, text: "- [x] dem Owner zeigen", rev: 1 }), "end"]);
    expect(sweep(end).ended.map((e) => e.branch)).toEqual([branch]);
    expect(existsSync(path)).toBe(false);
  }, LIFE_DEADLINE_MS * 4);

  test("ein Upload in drops/ (ignoriert): er bleibt, mit der Datei", async () => {
    const { f, path, branch } = await landed("Upload", "upload");
    appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "info", "exclude"), "drops/\n");
    mkdirSync(join(path, "drops"));
    writeFileSync(join(path, "drops", "x.png"), "png");
    expect(sh(path, "status", "--porcelain")).toBe(""); // ohne --ignored sähe git nichts
    const [end] = await life(f, ["end"]);
    expect(sweep(end).kept.map((k) => k.why)).toEqual(["ignorierte Dateien im Worktree: drops/"]);
    expect([existsSync(join(path, "drops", "x.png")), hasRef(f.repo, `refs/heads/${branch}`)]).toEqual([true, true]);
  }, LIFE_DEADLINE_MS * 3);

  test("ein Bundle aus `bun run build` (public/app.js, ignoriert) hält ihn nicht, ein Upload in drops/ daneben schon", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Bundle" })]);
    const path = String(made?.body.path);
    mkdirSync(join(path, "public"));
    commitIn(path, "public/index.html", "Seite"); // public/ ist getrackt, wie im echten Repo: git nennt die Datei, nicht den Ordner
    const [l] = await life(f, [post("/api/branches/land", { repo: f.repo, branch: "branch/bundle", subject: "Bundle", unchecked: true })]);
    expect(l?.status).toBe(200);
    appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "info", "exclude"), "public/app.js\ndrops/\n");
    writeFileSync(join(path, "public", "app.js"), "bundle");
    mkdirSync(join(path, "drops"));
    writeFileSync(join(path, "drops", "x.png"), "png");
    const [held] = await life(f, ["end"]);
    expect(sweep(held).kept.map((k) => k.why)).toEqual(["ignorierte Dateien im Worktree: drops/"]);
    Bun.spawnSync(["rm", "-r", join(path, "drops")]);
    const [end] = await life(f, ["end"]);
    expect(sweep(end).ended.map((e) => e.branch)).toEqual(["branch/bundle"]);
    expect(existsSync(path)).toBe(false);
  }, LIFE_DEADLINE_MS * 4);

  test("eine Nachfolge zwischen Kill und Öffnen: er bleibt, und die Nachfolgerin sitzt im Worktree", async () => {
    const { f, path, branch } = await landed("Folge", "folge");
    const [opened] = await life(f, [post("/api/branches/open", { repo: f.repo, branch })]);
    const slot = Number(opened?.body.slot);
    const self = (persisted(f).slots as Record<string, { selfToken: string }>)[String(slot)]?.selfToken ?? "";
    const latch = join(TMP, `gap-${Date.now()}`);
    const [succeeded, reached, gap] = await life(f, [
      { background: { ...post("/api/self/succeed", { label: "Folge, zweite" }), token: null, self } },
      { until: `${latch}.reached`, ms: 15_000 }, "end", { touch: `${latch}.release` }],
    { FLEET_TEST_SUCCESSION_GAP_LATCH: latch, FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" });
    expect(reached?.status).toBe(200);
    expect(sweep(gap).kept.map((k) => k.why)).toEqual(["eine Session sitzt im Worktree"]);
    // die Nachfolgerin steht; ihr Brief bleibt hier liegen, weil das Ersatz-claude des Testkits nicht als lebend gilt
    expect(succeeded?.body.slot).toBe(slot);
    const seat = (persisted(f).slots as Record<string, { cwd: string | null; openedAt: number }>)[String(slot)];
    expect(seat?.cwd).toBe(path);
    expect(seat?.openedAt).not.toBe(Number(opened?.body.openedAt));
    expect([existsSync(path), hasRef(f.repo, `refs/heads/${branch}`)]).toEqual([true, true]);
    const [after] = await life(f, ["end"]);
    expect(sweep(after).ended).toEqual([]);
  }, LIFE_DEADLINE_MS * 4);

  test("eine Testinstanz läuft aus dem Worktree: er bleibt; ist ihr Prozess weg, endet er", async () => {
    const { f, path, branch } = await landed("Instanz", "instanz");
    const root = join(TMP, `ti-${Date.now()}`);
    mkdirSync(join(root, "fleet-testinstanz-1"), { recursive: true });
    const plant = (pid: number) => writeFileSync(join(root, "fleet-testinstanz-1", "testinstanz.state"), `src=${path}\nport=8999\npid=${pid}\n`);
    plant(process.pid);
    const [held] = await life(f, ["end"], { FLEET_TI_ROOT: root });
    expect(sweep(held).ended).toEqual([]);
    expect(existsSync(path)).toBe(true);
    // im Start: testinstanz.sh#up schreibt pid=0, bis ihr Server antwortet
    plant(0);
    const [starting] = await life(f, ["end"], { FLEET_TI_ROOT: root });
    expect(sweep(starting).kept.map((k) => k.why)).toEqual(["eine Testinstanz läuft aus dem Worktree"]);
    const gone = Bun.spawn(["true"]);
    await gone.exited;
    plant(gone.pid);
    const [end] = await life(f, ["end"], { FLEET_TI_ROOT: root });
    expect(sweep(end).ended.map((e) => e.branch)).toEqual([branch]);
  }, LIFE_DEADLINE_MS * 4);

  test("ein nie gelandeter Branch bleibt, auch ohne Commits und ohne Session", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Neu" })]);
    const [end] = await life(f, ["end"]);
    expect(sweep(end)).toEqual({ ended: [], kept: [] });
    expect(existsSync(String(made?.body.path))).toBe(true);
  }, LIFE_DEADLINE_MS * 2);
});

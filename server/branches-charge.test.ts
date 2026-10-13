// Neuaufbau K5 S3 · Charge mergen. Entwurf K5: „Je Charge kommt ein Commit auf main, und sein Betreff
// nennt die Charge … Branch, Worktree und Session bleiben bestehen.“ Bauleitung 13.10.: der Baum ist
// genau der geprüfte; main bewegt sich nur per ff-only im Checkout, der main hält; die nächste Charge
// zählt ab dem Tip der letzten; ein seither umgeschriebener Branch wird abgewiesen; Gleichstand mit main
// per `git merge main` gibt bei der nächsten Charge weder Konflikt noch Doppelung; ohne Merge-Check nur
// ausdrücklich. main bewegt sich hier nur in Fixture-Repos.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, commitIn, get, LIFE_DEADLINE_MS, persisted, post, rowsOf, sh } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const land = (repo: string, branch: string, subject: string, extra: Record<string, unknown> = {}) =>
  post("/api/branches/land", { repo, branch, subject, ...extra });
const mainLog = (repo: string): string[] => sh(repo, "log", "--format=%s", "main").split("\n");
const filesOn = (repo: string, rev: string): string[] => sh(repo, "ls-tree", "--name-only", rev).split("\n").sort();

describe("Charge mergen ohne Merge-Check (ein Repo ohne ci/merge-check.ts)", () => {
  test("ein Commit auf main mit dem Betreff, die Commits des Branches im Body; Branch, Worktree und Punkte bleiben", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Snappiness", points: ["messen", "zeigen"] })]);
    const path = String(made?.body.path);
    const tip1 = commitIn(path, "a.txt", "Messung vorher");
    const tip = commitIn(path, "b.txt", "Messung nachher");
    const [tick, seen, landed, list] = await life(f, [
      post("/api/branches/note", { repo: f.repo, branch: "branch/snappiness", text: "- [x] messen\n- [ ] zeigen", rev: 1 }),
      post("/api/branches/seen", { repo: f.repo, branch: "branch/snappiness", head: tip }),
      land(f.repo, "branch/snappiness", "Snappiness: messen", { unchecked: true }),
      get("/api/branches")]);
    expect([tick?.status, seen?.status]).toEqual([200, 200]);
    expect(landed).toMatchObject({ status: 200, body: { ok: true, main: "main", commits: 2, passt: true, checked: false } });
    expect(mainLog(f.repo)).toEqual(["Snappiness: messen", "start"]);
    const body = sh(f.repo, "log", "-1", "--format=%b", "main");
    expect(body).toContain(`${tip1.slice(0, 8)} Messung vorher`);
    expect(body).toContain("(ohne Merge-Check)");
    expect(body).toContain("passt");
    expect(filesOn(f.repo, "main")).toEqual(["README", "a.txt", "b.txt"]);
    expect(readFileSync(join(f.repo, "b.txt"), "utf8")).toBe("Messung nachher\n"); // der Haupt-Checkout zog mit
    expect(sh(f.repo, "status", "--porcelain")).toBe("");
    const row = rowsOf(list!, f.repo).branches[0];
    expect(row?.lands.map((l) => [l.subject, l.points, l.passt, l.checked])).toEqual([["Snappiness: messen", ["messen"], true, false]]);
    expect([row?.chargeBase, row?.chargeCommits, row?.path, row?.text]).toEqual([tip, 0, path, "- [x] messen\n- [ ] zeigen"]);
  }, LIFE_DEADLINE_MS);

  test("Charge, dann `git merge main` im Branch, dann zweite Charge: kein Konflikt, keine Doppelung", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Zwei Chargen" })]);
    const path = String(made?.body.path);
    commitIn(path, "a.txt", "erste Arbeit");
    const [first] = await life(f, [land(f.repo, "branch/zwei-chargen", "Charge eins", { unchecked: true })]);
    expect(first?.status).toBe(200);
    commitIn(f.repo, "fremd.txt", "main zieht weiter"); // jemand anderes auf main
    sh(path, "merge", "-q", "--no-edit", "main");
    writeFileSync(join(path, "a.txt"), "erste Arbeit\nweiter\n");
    sh(path, "commit", "-q", "-am", "zweite Arbeit an derselben Datei");
    const [diff, second] = await life(f, [
      get(`/api/branches/diff?repo=${encodeURIComponent(f.repo)}&branch=branch/zwei-chargen&charge=1`),
      land(f.repo, "branch/zwei-chargen", "Charge zwei", { unchecked: true })]);
    expect(diff?.body).toMatchObject({ files: ["a.txt"], commits: [{ subject: "zweite Arbeit an derselben Datei" }] });
    expect(String(diff?.body.diff)).not.toContain("main zieht weiter");
    expect(second).toMatchObject({ status: 200, body: { commits: 1 } });
    expect(mainLog(f.repo)).toEqual(["Charge zwei", "main zieht weiter", "Charge eins", "start"]);
    expect(sh(f.repo, "show", "--format=", "--name-only", "main")).toBe("a.txt"); // Charge zwei bringt nur ihre eigene Änderung
    expect(readFileSync(join(f.repo, "a.txt"), "utf8")).toBe("erste Arbeit\nweiter\n");
  }, LIFE_DEADLINE_MS);

  test("ein seit der letzten Charge umgeschriebener Branch wird abgewiesen, main bleibt", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Umgeschrieben" })]);
    const path = String(made?.body.path);
    commitIn(path, "a.txt", "Arbeit");
    await life(f, [land(f.repo, "branch/umgeschrieben", "Charge eins", { unchecked: true })]);
    const mainBefore = sh(f.repo, "rev-parse", "main");
    sh(path, "reset", "-q", "--hard", "HEAD~1"); // umgeschrieben: der Tip der Charge ist kein Vorfahr mehr
    commitIn(path, "c.txt", "andere Arbeit");
    const [refused] = await life(f, [land(f.repo, "branch/umgeschrieben", "Charge zwei", { unchecked: true })]);
    expect(refused).toEqual({ status: 409, body: { error: "Branch seit der letzten Charge umgeschrieben, Basis neu wählen" } });
    expect(sh(f.repo, "rev-parse", "main")).toBe(mainBefore);
  }, LIFE_DEADLINE_MS);

  test("ohne ausdrückliches „ohne Merge-Check“, ohne neue Commits, mit ungesicherter Arbeit im Haupt-Checkout: 409, main bleibt", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Abweisen" })]);
    const path = String(made?.body.path);
    const before = sh(f.repo, "rev-parse", "main");
    const [nothing] = await life(f, [land(f.repo, "branch/abweisen", "leer", { unchecked: true })]);
    expect(nothing?.status).toBe(409);
    expect(String(nothing?.body.error)).toContain("nichts zu mergen");
    commitIn(path, "README", "README geändert");
    const [bare] = await life(f, [land(f.repo, "branch/abweisen", "ohne Wort")]);
    expect(bare?.status).toBe(409);
    expect(String(bare?.body.error)).toContain("ohne Merge-Check");
    writeFileSync(join(f.repo, "README"), "ungesichert im Haupt-Checkout\n");
    const [dirty] = await life(f, [land(f.repo, "branch/abweisen", "trotzdem", { unchecked: true })]);
    expect(dirty?.status).toBe(409);
    expect(String(dirty?.body.error)).toContain("main wurde nicht bewegt");
    expect(sh(f.repo, "rev-parse", "main")).toBe(before);
    expect(readFileSync(join(f.repo, "README"), "utf8")).toBe("ungesichert im Haupt-Checkout\n");
  }, LIFE_DEADLINE_MS);
});

describe("Charge mergen mit Merge-Check: genau der geprüfte Baum", () => {
  // ein Repo mit ci/merge-check.ts; die Zeile des Merge-Checks pflanzt der Test, wie ci/merge-check.ts sie schreibt
  function checkedFixture() {
    const f = fixture();
    mkdirSync(join(f.repo, "ci"));
    writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe: das Urteil schreibt der Test\n");
    sh(f.repo, "add", "ci/merge-check.ts");
    sh(f.repo, "commit", "-q", "-m", "merge-check");
    return f;
  }
  function plantCheck(f: { repo: string }, row: Record<string, unknown>): void {
    appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"), `${JSON.stringify(row)}\n`);
  }
  // main plus die Commits, einer nach dem anderen, wie ci/merge-check.ts#candidateOf
  function candidate(repo: string, main: string, ...commits: string[]): { candidate: string; tree: string; commits: string[] } {
    let cur = main;
    for (const c of commits)
      cur = sh(repo, "commit-tree", sh(repo, "merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c).split("\n")[0]!, "-p", cur, "-m", "kandidat");
    return { candidate: cur, tree: sh(repo, "rev-parse", `${cur}^{tree}`), commits };
  }

  test("grün auf diesem Tip gegen diese Basis: main trägt genau den Baum des Kandidaten; rot oder veraltet: 409", async () => {
    const f = checkedFixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Geprüft" })]);
    const tip = commitIn(String(made?.body.path), "x.txt", "geprüfte Arbeit");
    const main = sh(f.repo, "rev-parse", "main");
    const c = candidate(f.repo, main, tip);
    const row = { at: 1, branch: "branch/geprueft", base: "main", tip, main, ...c, verdict: "green", mergeable: true, why: "main grün" };
    plantCheck(f, { ...row, verdict: "red", mergeable: false, why: "rot: s1" });
    const [red, view] = await life(f, [land(f.repo, "branch/geprueft", "Geprüft"), get("/api/branches")]);
    expect(red?.status).toBe(409);
    expect(String(red?.body.error)).toContain("rot: s1");
    expect(rowsOf(view!, f.repo).branches[0]?.check).toMatchObject({ state: "red" });
    plantCheck(f, { ...row, main: "9".repeat(40) });
    const [stale] = await life(f, [land(f.repo, "branch/geprueft", "Geprüft")]);
    expect(String(stale?.body.error)).toContain("main ist");
    plantCheck(f, row);
    const [ok, after] = await life(f, [land(f.repo, "branch/geprueft", "Geprüft: x"), get("/api/branches")]);
    expect(ok).toMatchObject({ status: 200, body: { checked: true } });
    expect(sh(f.repo, "rev-parse", "main^{tree}")).toBe(c.tree);
    expect(sh(f.repo, "log", "-1", "--format=%s", "main")).toBe("Geprüft: x");
    expect(rowsOf(after!, f.repo).branches[0]?.check).toMatchObject({ state: "stale" }); // die nächste Charge zählt ab dem Tip
  }, LIFE_DEADLINE_MS);

  // Bauleitung 13.10.: was der Owner sieht, wird gemergt. Die Basis ist ein Ref-Name; wandert er nach dem
  // Merge-Check (die Bauleitung holt einen Teil des Branches in die Basis), zählt der Live-Bereich anders,
  // als der Kandidat gebaut wurde. Mit einer verwendbaren Zeile zählen Diff, Anzahl und Body deren Commits.
  test("die Basis wandert nach dem Merge-Check: Diff, Anzahl und Charge-Commit nennen genau die geprüften Commits", async () => {
    const f = checkedFixture();
    sh(f.repo, "branch", "basis");
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Gewandert", base: "basis" })]);
    const path = String(made?.body.path);
    const k1 = commitIn(path, "k1.txt", "erster geprüfter Commit");
    const k2 = commitIn(path, "k2.txt", "zweiter geprüfter Commit");
    const main = sh(f.repo, "rev-parse", "main");
    const c = candidate(f.repo, main, k1, k2);
    sh(f.repo, "branch", "-f", "basis", k1);
    const diffOf = get(`/api/branches/diff?repo=${encodeURIComponent(f.repo)}&branch=branch/gewandert&charge=1`);
    const [liveDiff, live] = await life(f, [diffOf, get("/api/branches")]);
    expect(liveDiff?.body).toMatchObject({ files: ["k2.txt"], commits: [{ sha: k2 }] }); // ohne Zeile: was ein neuer Check prüfen würde
    expect(rowsOf(live!, f.repo).branches[0]?.chargeCommits).toBe(1);
    plantCheck(f, { at: 1, branch: "branch/gewandert", base: "basis", tip: k2, main, ...c, verdict: "green", mergeable: true, why: "main grün" });
    const [diff, list, landed] = await life(f, [diffOf, get("/api/branches"), land(f.repo, "branch/gewandert", "Gewandert")]);
    expect(diff?.body).toMatchObject({ files: ["k1.txt", "k2.txt"],
      commits: [{ sha: k1, subject: "erster geprüfter Commit" }, { sha: k2, subject: "zweiter geprüfter Commit" }] });
    expect(String(diff?.body.diff)).toContain("+erster geprüfter Commit");
    expect(rowsOf(list!, f.repo).branches[0]?.chargeCommits).toBe(2);
    expect(landed).toMatchObject({ status: 200, body: { commits: 2, checked: true } });
    expect(sh(f.repo, "rev-parse", "main^{tree}")).toBe(c.tree);
    expect(sh(f.repo, "log", "-1", "--format=%b", "main").split("\n").filter((l) => l.startsWith("- ")))
      .toEqual([`- ${k1.slice(0, 8)} erster geprüfter Commit`, `- ${k2.slice(0, 8)} zweiter geprüfter Commit`]);
  }, LIFE_DEADLINE_MS);

  test("alles schon per Cherry-Pick auf main, der Check nennt keine Commits: nichts zu zeigen, nichts zu mergen, main bleibt", async () => {
    const f = checkedFixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Schon drin" })]);
    const k1 = commitIn(String(made?.body.path), "k1.txt", "schon gepflückt");
    sh(f.repo, "cherry-pick", k1);
    const main = sh(f.repo, "rev-parse", "main");
    plantCheck(f, { at: 1, branch: "branch/schon-drin", base: "main", tip: k1, main, ...candidate(f.repo, main),
      alreadyOnMain: [k1], verdict: "green", mergeable: true, why: "main grün" });
    const [diff, list, refused] = await life(f, [get(`/api/branches/diff?repo=${encodeURIComponent(f.repo)}&branch=branch/schon-drin&charge=1`),
      get("/api/branches"), land(f.repo, "branch/schon-drin", "Leer")]);
    expect(diff?.body).toMatchObject({ files: [], commits: [], diff: "" });
    expect(rowsOf(list!, f.repo).branches[0]?.chargeCommits).toBe(0);
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.error)).toContain("nichts zu mergen");
    expect(sh(f.repo, "rev-parse", "main")).toBe(main);
  }, LIFE_DEADLINE_MS);

  test("„Merge-Check starten“ ruft ci/merge-check.ts des Repos mit Branch und Basis der Charge", async () => {
    const f = checkedFixture();
    writeFileSync(join(f.repo, "ci/merge-check.ts"),
      "import { appendFileSync } from \"node:fs\";\n"
      + "const [branch, , base] = process.argv.slice(2);\n"
      + "const git = (...a: string[]) => Bun.spawnSync([\"git\", ...a]).stdout.toString().trim();\n"
      + "appendFileSync(`${git(\"rev-parse\", \"--path-format=absolute\", \"--git-common-dir\")}/merge-checks.jsonl`, JSON.stringify({ at: Date.now(), branch, base, tip: git(\"rev-parse\", branch!), main: git(\"rev-parse\", \"main\"), verdict: \"red\", mergeable: false, why: \"Attrappe\" }) + \"\\n\");\n");
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Prüfen" })]);
    commitIn(String(made?.body.path), "y.txt", "Arbeit");
    const [started] = await life(f, [post("/api/branches/check", { repo: f.repo, branch: "branch/pruefen" })]);
    expect(started).toMatchObject({ status: 202, body: { base: "main" } });
    let view: Answer | undefined;
    for (let i = 0; i < 40; i++) {
      [view] = await life(f, [get("/api/branches")]);
      if (rowsOf(view!, f.repo).branches[0]?.check?.state === "red") break;
      await Bun.sleep(250);
    }
    expect(rowsOf(view!, f.repo).branches[0]?.check).toEqual({ state: "red", at: expect.any(Number), why: "Attrappe" });
  }, LIFE_DEADLINE_MS * 2);
});

describe("ein Land überdauert den Neustart", () => {
  test("der Land-Eintrag steht in fleet.json", async () => {
    const f = fixture();
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Bleibt" })]);
    commitIn(String(made?.body.path), "z.txt", "Arbeit");
    await life(f, [land(f.repo, "branch/bleibt", "Bleibt", { unchecked: true })]);
    const books = persisted(f).branches as { lands: { subject: string }[] }[];
    expect(books[0]?.lands.map((l) => l.subject)).toEqual(["Bleibt"]);
  }, LIFE_DEADLINE_MS);
});

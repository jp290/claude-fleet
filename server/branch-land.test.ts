// rechts-7 Punkt 5 · Owner Z132, 18.10.: „[Zitat entfernt]“. Die Self-Tür
// POST /api/self/branches/land landet nur den Branch im eigenen Worktree der Session, nur nach dem „passt“ des Owners auf
// genau dieser Spitze und nur mit einem brauchbaren Merge-Check — derselbe Kern wie die Owner-Tür (server/branch-land.ts).
// main bewegt sich hier nur in Fixture-Repos.
import { afterAll, describe, expect, test } from "bun:test";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, commitIn, type Fixture, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot} in fleet.json`);
  return t;
};
const slotOf = (a: Answer | undefined): number => {
  const n = Number(a?.body.slot);
  if (a?.status !== 200 || !Number.isInteger(n)) throw new Error(`Öffnen schlug fehl: ${JSON.stringify(a)}`);
  return n;
};
// the session's door: its self token alone, no owner bearer
const ownLand = (self: string, body: Record<string, unknown>) => ({ ...post("/api/self/branches/land", body), token: null, self });
const seen = (repo: string, branch: string, head: string) => post("/api/branches/seen", { repo, branch, head });
// ci/merge-check.ts as a stand-in: the test writes the verdict line as the real one would
function checkedFixture(): Fixture {
  const f = fixture();
  mkdirSync(join(f.repo, "ci"));
  writeFileSync(join(f.repo, "ci/merge-check.ts"), "// Attrappe: das Urteil schreibt der Test\n");
  sh(f.repo, "add", "ci/merge-check.ts");
  sh(f.repo, "commit", "-q", "-m", "merge-check");
  return f;
}
// a green merge check of the branch's tip against main, its candidate built commit by commit as ci/merge-check.ts does
function plantGreen(f: Fixture, branch: string): { tip: string; tree: string } {
  const tip = sh(f.repo, "rev-parse", branch), main = sh(f.repo, "rev-parse", "main");
  const commits = sh(f.repo, "rev-list", "--reverse", "--no-merges", tip, "^main").split("\n").filter(Boolean);
  let cur = main;
  for (const c of commits)
    cur = sh(f.repo, "commit-tree", sh(f.repo, "merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c).split("\n")[0]!, "-p", cur, "-m", "kandidat");
  const tree = sh(f.repo, "rev-parse", `${cur}^{tree}`);
  appendFileSync(join(sh(f.repo, "rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"),
    `${JSON.stringify({ at: Date.now(), branch, base: "main", tip, main, candidate: cur, tree, commits, verdict: "green", mergeable: true, why: "main grün" })}\n`);
  return { tip, tree };
}

describe("Eine Session landet ihren eigenen Branch selbst, nach „passt“ und mit Merge-Check", () => {
  test("ohne „passt“ 409, „passt“ auf alter Spitze 409, fremder Branch 403, ohne eigenen Branch 404; mit „passt“ und grünem Check 200 und main bewegt", async () => {
    const f = checkedFixture();
    const [made, opened, , other] = await life(f, [post("/api/branches", { repo: f.repo, name: "Eigen" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/eigen" }),
      post("/api/branches", { repo: f.repo, name: "Fremd" }),
      post("/api/slots/2/open", { cwd: f.repo })]);
    expect([made?.status, other?.status]).toEqual([201, 200]);
    const self = tokenOf(f, slotOf(opened)), inMain = tokenOf(f, 2);
    const path = String(made?.body.path);
    commitIn(path, "a.txt", "erste Arbeit");
    const first = plantGreen(f, "branch/eigen");
    const main0 = sh(f.repo, "rev-parse", "main");

    // ohne „passt“: grüner Check, aber der Owner hat den Stand nicht gesehen
    const [unseen] = await life(f, [ownLand(self, { subject: "Eigen: erste Charge" })]);
    expect(unseen?.status).toBe(409);
    expect(String(unseen?.body.error)).toContain("noch kein „passt“");
    expect(sh(f.repo, "rev-parse", "main")).toBe(main0);

    // „passt“ auf der ersten Spitze, danach ein neuer Commit mit grünem Check: das „passt“ zielt auf die alte Spitze
    await life(f, [seen(f.repo, "branch/eigen", first.tip)]);
    commitIn(path, "b.txt", "zweite Arbeit");
    const second = plantGreen(f, "branch/eigen");
    const [old, foreign, mainSession, noToken] = await life(f, [
      ownLand(self, { subject: "Eigen: erste Charge" }),
      ownLand(self, { subject: "Fremd: gelandet von Eigen", branch: "branch/fremd" }),
      ownLand(inMain, { subject: "aus dem Haupt-Checkout" }),
      { ...post("/api/self/branches/land", { subject: "ohne Ausweis" }), token: null }]);
    expect(old?.status).toBe(409);
    expect(String(old?.body.error)).toContain(`„passt“ gilt ${first.tip.slice(0, 8)}`);
    expect(foreign?.status).toBe(403);
    expect(mainSession?.status).toBe(404);
    expect(noToken?.status).toBe(401);
    expect(sh(f.repo, "rev-parse", "main")).toBe(main0);

    // „passt“ auf der Spitze von jetzt und ein grüner Check auf ihr: die Session landet, main trägt den geprüften Baum
    const [, landed] = await life(f, [seen(f.repo, "branch/eigen", second.tip), ownLand(self, { subject: "Eigen: erste Charge" })]);
    expect(landed).toMatchObject({ status: 200, body: { ok: true, main: "main", commits: 2, passt: true, checked: true, form: "squash" } });
    expect(sh(f.repo, "rev-parse", "main")).not.toBe(main0);
    expect(sh(f.repo, "rev-parse", "main^")).toBe(main0);
    expect(sh(f.repo, "rev-parse", "main^{tree}")).toBe(second.tree);
    expect(sh(f.repo, "log", "-1", "--format=%s", "main")).toBe("Eigen: erste Charge");
  }, LIFE_DEADLINE_MS * 5);

  test("ein Repo ohne Merge-Check: die Session landet nicht selbst, auch mit „passt“ — die Owner-Tür mit unchecked bleibt", async () => {
    const f = fixture();
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Ohne" }), post("/api/branches/open", { repo: f.repo, branch: "branch/ohne" })]);
    const self = tokenOf(f, slotOf(opened));
    const tip = commitIn(String(made?.body.path), "c.txt", "Arbeit ohne Check");
    const main0 = sh(f.repo, "rev-parse", "main");
    const [, refused, byOwner] = await life(f, [seen(f.repo, "branch/ohne", tip), ownLand(self, { subject: "Ohne: Charge" }),
      post("/api/branches/land", { repo: f.repo, branch: "branch/ohne", subject: "Ohne: Charge", unchecked: true })]);
    expect(refused?.status).toBe(409);
    expect(String(refused?.body.error)).toContain("ohne ihn landet eine Session nicht selbst");
    expect(byOwner).toMatchObject({ status: 200, body: { ok: true, passt: true, checked: false } });
    expect(sh(f.repo, "rev-parse", "main^")).toBe(main0);
  }, LIFE_DEADLINE_MS * 3);
});

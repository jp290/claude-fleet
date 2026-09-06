// The READ half of the trail family (trailstats.ts, docs/e2e-trail.md §7): the query that replaces
// the ~7-minute same-tree re-run CLAUDE.md obliges a lane to on every red check.
//
// Sits next to e2e/trail.ts, which asserts the rows get WRITTEN; this one asserts what they answer.
// The reader is pure — records, `now` and the window are arguments — so every semantic check here
// feeds a synthetic sequence and asserts exact numbers, with no filesystem and no server. Only the
// two routes need one, and they read a fixture directory planted inside this instance.
//
// The four traps, each with its own check, because each one has already produced a wrong answer
// somewhere: a fail on two CLEAN trees is not your diff; the same fail on two DIRTY trees is no
// evidence at all (a dirty run's sha does not describe the code that ran); the denominator is
// runs-that-ran-this-check and not all runs (queue row 32c89530 shipped a rate built from two
// different denominators); and `tree:null` is a third category, never folded into either.
import { mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { BASE, ROOT, TOKEN, check, get } from "./harness";
import { trailStats, type TrailRecord } from "../trailstats";
import type { Ctx } from "./ctx";

const T = 1_800_000_000_000; // fixed "now" — the reader takes it as an argument, so nothing here is clock-dependent
const h = 3_600_000;
const A = "a".repeat(40), B = "b".repeat(40); // two distinct clean trees
const day = 86_400_000;

/** one synthetic row; `dirty` is omitted exactly when `tree` is null, as the emitter does */
const row = (o: { run: string; check: string; ok: boolean; tree: string | null; dirty?: boolean;
  ts?: number; suite?: string; ms?: number }): TrailRecord => ({
  v: 1, run: o.run, suite: o.suite ?? "isolated", check: o.check, ok: o.ok,
  ...(o.tree === null ? { tree: null } : { tree: o.tree, dirty: o.dirty ?? false }),
  msSincePrev: o.ms ?? 10, ts: o.ts ?? T - h,
});

export async function run(ctx: Ctx): Promise<void> {
  const C = "the check under test";

  // (i) THE WHOLE TRICK: one failure on each of two distinct CLEAN trees. No single working tree
  // is two commits, so the failure cannot be the diff of whoever is asking.
  const twoClean = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A }),
    row({ run: "r2", check: C, ok: false, tree: B }),
    row({ run: "r3", check: C, ok: true, tree: A }),
  ], { now: T, check: C });
  check("trailstats: a fail on two distinct CLEAN trees is reported as not-your-diff",
    twoClean.flakes.length === 1 && twoClean.flakes[0]!.cleanTrees === 2
      && twoClean.flakes[0]!.notYourDiff === true && twoClean.flakes[0]!.failedRuns === 2
      && twoClean.point?.verdict === "not-your-diff" && twoClean.point.cleanTrees.length === 2,
    JSON.stringify({ f: twoClean.flakes[0], v: twoClean.point?.verdict }));
  // ...and the evidence travels with the verdict, so the claim can be re-checked by hand
  check("trailstats: the point answer names the run ids behind each clean tree",
    twoClean.point?.cleanTrees.find((t) => t.tree === A)?.runs.join() === "r1"
      && twoClean.point.cleanTrees.find((t) => t.tree === B)?.runs.join() === "r2",
    JSON.stringify(twoClean.point?.cleanTrees));

  // (ii) THE MIRROR, and the reason this reader exists rather than a grep: two DIRTY runs are the
  // common case (a lane measures its own uncommitted tree) and they prove NOTHING — the sha on the
  // row is not the code that ran. Same two run ids, same two shas, opposite verdict.
  const twoDirty = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A, dirty: true }),
    row({ run: "r2", check: C, ok: false, tree: B, dirty: true }),
  ], { now: T, check: C });
  check("trailstats: the same fail on two DIRTY trees is NOT not-your-diff — it is counted, not credited",
    twoDirty.flakes[0]!.cleanTrees === 0 && twoDirty.flakes[0]!.notYourDiff === false
      && twoDirty.flakes[0]!.dirtyFailRuns === 2 && twoDirty.point?.verdict === "insufficient-evidence"
      && twoDirty.point.dirtyFailRuns.length === 2 && twoDirty.trees.dirtyRows === 2,
    JSON.stringify({ f: twoDirty.flakes[0], v: twoDirty.point?.verdict }));
  // the same CLEAN sha twice is one tree either, or the proof would be minted by re-running
  const sameSha = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A }),
    row({ run: "r2", check: C, ok: false, tree: A }),
  ], { now: T, check: C });
  check("trailstats: two fails on the SAME clean tree are one tree — a re-run cannot mint the proof",
    sameSha.flakes[0]!.cleanTrees === 1 && sameSha.flakes[0]!.notYourDiff === false
      && sameSha.flakes[0]!.failedRuns === 2 && sameSha.point?.verdict === "insufficient-evidence",
    JSON.stringify(sameSha.flakes[0]));

  // (iii) THE DENOMINATOR. `other` ran in all four runs, `C` in two of them. Counting C against
  // four would halve its rate and make a young check read as healthy — the exact conflation that
  // put two different denominators behind one published "4 of 69 (~6%)".
  const denom = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A }),
    row({ run: "r2", check: C, ok: true, tree: B }),
    row({ run: "r1", check: "other", ok: true, tree: A }),
    row({ run: "r2", check: "other", ok: true, tree: B }),
    row({ run: "r3", check: "other", ok: true, tree: A }),
    row({ run: "r4", check: "other", ok: true, tree: A }),
  ], { now: T, check: C });
  check("trailstats: the denominator counts only the runs that RAN the check, not all runs",
    denom.runs === 4 && denom.flakes[0]!.runs === 2 && denom.flakes[0]!.failedRuns === 1
      && denom.point?.runs === 2,
    JSON.stringify({ runs: denom.runs, group: denom.flakes[0]!.runs, point: denom.point?.runs }));

  // (iv) tree:null — a post-land audit runs against a `git archive` snapshot that is no repository
  // at all. Its own category on both sides of the answer, never a zero and never folded into clean.
  const noTree = trailStats([
    row({ run: "r1", check: C, ok: false, tree: null }),
    row({ run: "r2", check: C, ok: false, tree: null }),
    row({ run: "r3", check: C, ok: false, tree: A }),
  ], { now: T, check: C });
  check("trailstats: tree:null is its own category — not a clean tree, not a zero",
    noTree.flakes[0]!.unknownTreeFailRuns === 2 && noTree.flakes[0]!.cleanTrees === 1
      && noTree.flakes[0]!.notYourDiff === false && noTree.trees.unknownRows === 2
      && noTree.trees.cleanRows === 1 && noTree.point?.unknownTreeFailRuns.length === 2,
    JSON.stringify({ f: noTree.flakes[0], trees: noTree.trees }));
  // a row that names a tree but cannot say whether it was dirty is unreadable, never optimistic
  const halfRow = trailStats([{ v: 1, run: "r1", suite: "isolated", check: C, ok: false, tree: A, ts: T - h, msSincePrev: 1 }],
    { now: T, check: C });
  check("trailstats: a tree with no dirty flag is unknown, never read as clean",
    halfRow.trees.unknownRows === 1 && halfRow.flakes[0]!.cleanTrees === 0
      && halfRow.flakes[0]!.unknownTreeFailRuns === 1, JSON.stringify(halfRow.trees));

  // scope vs damage, and the timing answer. A row outside the window is scope; a row missing a
  // field the whole schema guarantees is damage; a check that never failed is not in the ranking.
  const scoped = trailStats([
    row({ run: "old", check: C, ok: false, tree: A, ts: T - 40 * day }),
    row({ run: "r1", check: C, ok: false, tree: A, ms: 100 }),
    row({ run: "r2", check: C, ok: true, tree: B, ms: 300 }),
    row({ run: "r3", check: C, ok: true, tree: B, ms: 200 }),
    row({ run: "r1", check: "sib", ok: true, tree: A, suite: "security", ms: 5 }),
    { v: 1, run: "torn", suite: "isolated", check: C, tree: A, dirty: false, ts: T }, // no `ok`
  ], { now: T, windowMs: 30 * day });
  check("trailstats: a row outside the window is scope, a row missing a schema field is damage",
    scoped.outOfScope.beforeWindow === 1 && scoped.outOfScope.malformed === 1
      && scoped.rows === 4 && scoped.point === null,
    JSON.stringify({ oos: scoped.outOfScope, rows: scoped.rows }));
  check("trailstats: only failing checks enter the flake ranking; the timing answer covers all of them",
    scoped.flakes.length === 1 && scoped.flakes[0]!.check === C
      && scoped.slowest.length === 2
      && scoped.slowest[0]!.check === C && scoped.slowest[0]!.n === 3
      && scoped.slowest[0]!.totalMs === 600 && scoped.slowest[0]!.medianMs === 200,
    JSON.stringify(scoped.slowest));
  // a suite filter is exact and says so: the other suite is out of scope, not malformed
  const bySuite = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A }),
    row({ run: "r1", check: C, ok: false, tree: B, suite: "security" }),
  ], { now: T, suite: "security", check: C });
  check("trailstats: a suite filter is exact — the other suite is out of scope, never damage",
    bySuite.outOfScope.otherSuite === 1 && bySuite.outOfScope.malformed === 0
      && bySuite.rows === 1 && bySuite.point?.suite === "security",
    JSON.stringify(bySuite.outOfScope));
  // and a check that exists but never failed says so, rather than reading as "no data"
  const clean = trailStats([row({ run: "r1", check: C, ok: true, tree: A })], { now: T, check: C });
  check("trailstats: a check that ran and never failed reads never-failed, not insufficient-evidence",
    clean.point?.verdict === "never-failed" && clean.point.runs === 1 && clean.flakes.length === 0,
    JSON.stringify(clean.point));
  // ...but only when the caller actually read its material. The routes cap the trail at the newest
  // 400 files (server.ts, grep TRAIL_MAX_FILES) and hand the remainder over as `filesOmitted`; the
  // cut is newest-first, so what goes unread is the OLDER material — where a historical flake lives
  // by definition. Measured 2026-08-07 on the deployed tree: FIX1 answered "never-failed, runs 74,
  // failedRuns 0" over 400 files while the 741 omitted ones held 9 failing runs on 3 clean trees.
  // A lane reading that took positive evidence of absence from a partial read, which is exactly
  // what this file's direction discipline forbids everywhere else.
  const capped = trailStats([row({ run: "r1", check: C, ok: true, tree: A })],
    { now: T, check: C, filesOmitted: 741 });
  check("trailstats: never-failed is never claimed over unread files — a cap downgrades it to insufficient-evidence",
    capped.point?.verdict === "insufficient-evidence" && capped.point.runs === 1
      && capped.point.failedRuns === 0,
    JSON.stringify(capped.point));
  // the other half, and it is not decoration: without it "downgrade everything" would pass the
  // check above and destroy the verdict's only positive answer.
  const uncapped = trailStats([row({ run: "r1", check: C, ok: true, tree: A })],
    { now: T, check: C, filesOmitted: 0 });
  check("trailstats: a COMPLETE read still reads never-failed — the downgrade is the cap, not the question",
    uncapped.point?.verdict === "never-failed" && uncapped.point.runs === 1
      && uncapped.point.failedRuns === 0,
    JSON.stringify(uncapped.point));
  // and the asymmetry itself: a cap can only falsify a claim of ABSENCE. Two clean fails already
  // SEEN stay seen no matter how much went unread — unread files could only ever add a third.
  const cappedProof = trailStats([
    row({ run: "r1", check: C, ok: false, tree: A }),
    row({ run: "r2", check: C, ok: false, tree: B }),
  ], { now: T, check: C, filesOmitted: 741 });
  check("trailstats: a cap never weakens not-your-diff — unread files can only add evidence, never remove it",
    cappedProof.point?.verdict === "not-your-diff" && cappedProof.point.cleanTrees.length === 2,
    JSON.stringify(cappedProof.point));
  // ...and a name NOBODY ran is a fourth answer, not the third. This is the one that keeps the
  // renamed-check limit visible: ask about a name that no longer exists and the answer says it was
  // never observed, instead of handing back a clean bill of health nobody measured.
  const absent = trailStats([row({ run: "r1", check: C, ok: false, tree: A })], { now: T, check: "a name nothing ever ran" });
  check("trailstats: a check nobody ran reads not-in-window — absence is never a clean bill of health",
    absent.point?.verdict === "not-in-window" && absent.point.runs === 0 && absent.point.failedRuns === 0,
    JSON.stringify(absent.point));

  // --- and the two routes over it. A fixture trail dir inside THIS instance: the server resolves
  // its default from import.meta.dir, which is this instance's root. The rows carry their own
  // suite name so every assertion below is exact even though the machine's real post-land trail
  // ($TMPDIR/fleet-e2e-trail) is read alongside them.
  const SUITE = `trailstats-fixture-${process.pid}`;
  const dir = `${ROOT}/e2e-trail`;
  const now = Date.now();
  const F = "fixture: fails on two clean trees";
  const G = "fixture: fails only dirty";
  mkdirSync(dir, { recursive: true });
  const lines = (run: string, rows: TrailRecord[]) =>
    writeFileSync(`${dir}/${run}.jsonl`, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  lines("fx1", [
    row({ run: "fx1", check: F, ok: false, tree: A, ts: now - h, suite: SUITE }),
    row({ run: "fx1", check: G, ok: false, tree: A, dirty: true, ts: now - h, suite: SUITE }),
  ]);
  lines("fx2", [
    row({ run: "fx2", check: F, ok: false, tree: B, ts: now - h, suite: SUITE }),
    row({ run: "fx2", check: G, ok: false, tree: B, dirty: true, ts: now - h, suite: SUITE }),
  ]);
  lines("fx3", [
    row({ run: "fx3", check: F, ok: true, tree: A, ts: now - h, suite: SUITE }),
    row({ run: "fx3", check: G, ok: true, tree: A, ts: now - h, suite: SUITE }),
  ]);

  interface Flakes {
    runs: number; rows: number; files: number; dirs: string[];
    filesOmitted: number; filesOtherSuite: number; truncated: boolean; coveredFrom: number;
    window: { from: number; to: number; days: number };
    flakes: { check: string; runs: number; failedRuns: number; cleanTrees: number; notYourDiff: boolean }[];
    point: { verdict: string; cleanTrees: { tree: string }[] } | null;
  }
  const q = `?suite=${encodeURIComponent(SUITE)}&days=2`;
  const ownerRes = await get(`/api/flakes${q}`);
  const owner = (await ownerRes.json()) as Flakes;
  check("/api/flakes serves the flake ranking derived from the trail on disk",
    ownerRes.ok && owner.runs === 3 && owner.rows === 6 && owner.flakes.length === 2
      && owner.flakes[0]!.runs === 3 && owner.flakes[0]!.failedRuns === 2,
    JSON.stringify({ runs: owner.runs, rows: owner.rows, flakes: owner.flakes }));
  check("/api/flakes reads BOTH trail directories, so neither population is silently dropped",
    owner.dirs.length === 2 && owner.dirs.some((d) => d.endsWith("/e2e-trail"))
      && owner.dirs.some((d) => d.endsWith("/fleet-e2e-trail")), JSON.stringify(owner.dirs));
  check("/api/flakes carries the clean/dirty verdict through the route, not just through the reader",
    owner.flakes.find((f) => f.check === F)?.notYourDiff === true
      && owner.flakes.find((f) => f.check === F)?.cleanTrees === 2
      && owner.flakes.find((f) => f.check === G)?.notYourDiff === false
      && owner.flakes.find((f) => f.check === G)?.cleanTrees === 0,
    JSON.stringify(owner.flakes));
  const pt = (await (await get(`/api/flakes${q}&check=${encodeURIComponent(F)}`)).json()) as Flakes;
  check("/api/flakes?check= answers the point question with its evidence",
    pt.point?.verdict === "not-your-diff" && pt.point.cleanTrees.length === 2,
    JSON.stringify(pt.point));
  const anon = await fetch(`${BASE}/api/flakes`);
  check("/api/flakes rejects an unauthenticated read", anon.status === 401, String(anon.status));

  // --- the session-facing twin. It has to answer a LANE or it solves nothing: the proof order it
  // replaces is an obligation CLAUDE.md puts on lanes, at the moment a lane sees a red check. And
  // it answers a PLAIN session too — this route joins the every-session tier (/api/self,
  // /api/self/autos), not the lane-only four and not the non-lane-only /api/self/watch.
  const selfFlakes = (token?: string) => fetch(`${BASE}/api/self/flakes${q}`, {
    headers: token !== undefined ? { "x-fleet-self-token": token } : {},
  });
  const laneTok = ctx.restartSelfTok ?? "";
  const laneRes = await selfFlakes(laneTok);
  const laneBody = (await laneRes.json()) as Flakes;
  check("GET /api/self/flakes answers a LANE — the principal the proof order it replaces binds",
    laneRes.ok && laneBody.runs === 3 && laneBody.flakes.length === 2,
    `${laneRes.status} ${JSON.stringify({ runs: laneBody.runs, flakes: laneBody.flakes.length })}`);
  let plainSelf = "";
  try {
    plainSelf = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> }).slots?.["2"]?.selfToken ?? "";
  } catch { /* unreadable state → the check below reports it */ }
  const plainRes = await selfFlakes(plainSelf);
  check("GET /api/self/flakes answers a PLAIN session too — no 409, it is not one of the scoped four",
    plainRes.status === 200 && /^[0-9a-f]{32}$/.test(plainSelf), `${plainRes.status} tok=${plainSelf.slice(0, 8)}…`);
  check("GET /api/self/flakes: the owner token does not substitute for a selfToken",
    (await selfFlakes(TOKEN)).status === 401);
  check("GET /api/self/flakes: a missing selfToken header is rejected",
    (await selfFlakes(undefined)).status === 401);

  // --- THE CAP, measured THROUGH the route. Program "Audit-Determiniertheit 2026-09", queue row
  // `76d39cae`. The route is the instrument that program's success criterion is defined on (">= 10
  // runs on trees containing the fix"), and it had two defects, both from ONE ordering — the file
  // cap ran before the suite filter and before any window logic could matter:
  //   (a) SUITE SKEW. A suite-scoped question was answered from a sample the OTHER suites had
  //       already eaten. Measured 2026-09-06, HEAD and the fixed tree against the same real trail
  //       dirs: `?suite=isolated&days=7` reported 59 runs over 400 files of which 341 were other
  //       suites; fixed it reports 192, the exact count a direct scan of those two directories
  //       finds. The skew grew with everything else the machine ran.
  //   (b) A SILENT WINDOW. `?days=2` and `?days=30` returned byte-identical runs/rows/checks while
  //       each printed the `days` it was asked for; only `filesOmitted` differed, and nothing said
  //       in a word that the answer was a sample.
  // The checks below measure exactly that, and the FIRST is a PRECONDITION check that fails as
  // ITSELF — a probe that could not plant enough files must not read as a contract violation
  // (CLAUDE.md: "eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern").
  //
  // FLOOD must exceed server.ts#TRAIL_MAX_FILES or nothing here is exercised; raise the cap above
  // it and the precondition check goes red first, naming the reason.
  const FLOOD = 402;
  const P = `capflood-${process.pid}`;   // parseable as `${suite}-${stamp}-${pid}`, unlike fx1..fx3
  const P2 = `capscoped-${process.pid}`; // planted OLDER than the flood, so pre-fix the flood evicted it
  const CK = "cap probe: one row per planted run";
  const stampOf = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const plant = (suite: string, i: number, atMs: number): void => {
    const run = `${suite}-${stampOf(atMs)}-${i}`;
    writeFileSync(`${dir}/${run}.jsonl`,
      JSON.stringify(row({ run, check: CK, ok: true, tree: A, ts: atMs, suite })) + "\n");
    utimesSync(`${dir}/${run}.jsonl`, atMs / 1000, atMs / 1000); // mtime is what the route pre-filters and RANKS on
  };
  // fx1..fx3 above have served their checks and are dropped here on purpose: their names do not
  // parse, so they are fail-open candidates for EVERY suite, and the block below asserts an EXACT
  // planted population (`files + filesOmitted === FLOOD`) to pin `coveredFrom` to a known mtime.
  for (const r of ["fx1", "fx2", "fx3"]) rmSync(`${dir}/${r}.jsonl`, { force: true });
  for (let i = 0; i < FLOOD; i++) plant(P, i, now - (i + 1) * 60_000);   // the newest material, one file per minute back
  for (let i = 0; i < 3; i++) plant(P2, i, now - 2 * day - i * 60_000);  // older than every single flood file

  const capQ = async (suite: string, days: number) =>
    (await (await get(`/api/flakes?suite=${encodeURIComponent(suite)}&days=${days}`)).json()) as Flakes;
  const capWide = await capQ(P, 30);
  const capNarrow = await capQ(P, 1);
  const capScoped = await capQ(P2, 7);

  check("trail cap probe PRECONDITION: the fixture planted more files than the route's cap, so the cap is exercised",
    capWide.filesOmitted > 0 && capWide.files + capWide.filesOmitted >= FLOOD,
    `planted=${FLOOD} read=${capWide.files} omitted=${capWide.filesOmitted}`);

  // (a) the ordering itself: 402 files of another suite, ALL newer than the three asked for, and
  // the asked suite is still answered in full. Pre-fix this read `runs: 0` — the newest 400 files
  // were the flood, and the three P2 files never got opened.
  check("/api/flakes: the file cap is spent on the ASKED suite — newer foreign files never evict it",
    capScoped.runs === 3 && capScoped.filesOtherSuite >= FLOOD && capScoped.filesOmitted === 0
      // ...and the same ordering seen from the other side: asking for the flood reaches the flood
      // and NOTHING else, so the candidate population is exactly what this block planted.
      && capWide.files + capWide.filesOmitted === FLOOD,
    JSON.stringify({ scopedRuns: capScoped.runs, scopedFiles: capScoped.files,
      otherSuite: capScoped.filesOtherSuite, scopedOmitted: capScoped.filesOmitted,
      widePopulation: capWide.files + capWide.filesOmitted, planted: FLOOD }));

  // (b) two windows that MUST differ and do not: `days=30` and `days=1` return the same material,
  // because a cap is a cap. The contract is not that they differ — it is that the ANSWER SAYS SO,
  // in a field, so a caller cannot mistake a sample for the register. `coveredFrom` is the oldest
  // mtime actually opened: identical across both, while `window.from` is 29 days apart.
  const expectCovered = now - capWide.files * 60_000; // the oldest flood file that still fits the cap
  check("/api/flakes: a CUT answer names the window it really covers — `truncated` + `coveredFrom`, not the asked `days`",
    capWide.truncated === true && capNarrow.truncated === true
      && capWide.coveredFrom > capWide.window.from && capNarrow.coveredFrom > capNarrow.window.from
      && capWide.coveredFrom === capNarrow.coveredFrom
      && capWide.window.from < capNarrow.window.from && capWide.runs === capNarrow.runs
      && Math.abs(capWide.coveredFrom - expectCovered) <= 1500,
    JSON.stringify({ wideFrom: capWide.window.from, narrowFrom: capNarrow.window.from,
      covered: capWide.coveredFrom, expectCovered, runs: [capWide.runs, capNarrow.runs],
      truncated: [capWide.truncated, capNarrow.truncated] }));

  // ...and the other half, without which "always truncated" would pass the check above: an answer
  // that fits its window is NOT marked cut, and says so by `coveredFrom === window.from`.
  check("/api/flakes: a COMPLETE answer is not marked cut — coveredFrom === window.from is the register",
    capScoped.truncated === false && capScoped.coveredFrom === capScoped.window.from,
    JSON.stringify({ truncated: capScoped.truncated, covered: capScoped.coveredFrom, from: capScoped.window.from }));

  // the two routes share `trailStatsFromQuery`; this is the check that says so about the NEW fields,
  // so neither side can ever be repaired alone.
  const capSelf = (await (await fetch(`${BASE}/api/self/flakes?suite=${encodeURIComponent(P)}&days=30`,
    { headers: { "x-fleet-self-token": laneTok } })).json()) as Flakes;
  check("GET /api/self/flakes reports the SAME cut fields as the owner route — one handler, one answer",
    capSelf.truncated === capWide.truncated && capSelf.files === capWide.files
      && capSelf.coveredFrom === capWide.coveredFrom && capSelf.filesOtherSuite === capWide.filesOtherSuite,
    JSON.stringify({ self: { t: capSelf.truncated, f: capSelf.files, c: capSelf.coveredFrom, o: capSelf.filesOtherSuite },
      owner: { t: capWide.truncated, f: capWide.files, c: capWide.coveredFrom, o: capWide.filesOtherSuite } }));

  rmSync(dir, { recursive: true, force: true }); // the fixture leaves nothing behind
}

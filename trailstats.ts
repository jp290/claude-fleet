// The flake question — answered from the trail instead of from a seven-minute re-run.
//
// CLAUDE.md obliges every lane, on every red check, to a proof order whose first step is "run the
// same tree again" (docs/verify-tiering.md §11.7): ~425 s median, plus the suite mutex, per red.
// The rows that can answer it instead have been written since 2026-07-27 (docs/e2e-trail.md) and
// were read by nothing. This module reads them.
//
// THE WHOLE TRICK, in one sentence: a check that failed on >=2 DISTINCT CLEAN trees cannot be
// "my diff" — no single working tree is two commits. Everything else here is bookkeeping around
// that sentence.
//
// It is a READER. Nothing here collects, schedules, gates or alarms — same stance as slotstats.ts
// and continuity.ts, and the same shape: every input is an argument (records, `now`, the window,
// the caps), so a synthetic sequence yields a predictable summary and no test needs a filesystem.
// The trail DIRECTORIES are the caller's business too; this file names none.
//
// THREE QUESTIONS, and no field that does not answer one of them:
//   1. Which checks fail, how often, and is the failure mine?  → flakes[]
//   2. Where does the suite spend its wall clock?              → slowest[]
//   3. Did check X fail on trees without my change?            → point (with run ids as evidence)
//
// DIRECTION DISCIPLINE (inherited from slotstats.ts): an unknowable value is EXCLUDED and COUNTED,
// never folded in as zero or as a category.
//   - `dirty:true` is the COMMON case, not the edge: a lane measures its own uncommitted tree, so
//     the row's `tree` sha does not describe the code that ran. Two dirty runs on one sha are two
//     different trees, and the same sha twice is not two trees either. A dirty fail therefore can
//     never count toward the >=2-distinct-trees proof. Own category, counted, served.
//   - `tree:null` (a post-land audit runs against a `git archive` snapshot that is a tree and not
//     a repository — docs/e2e-trail.md §2) is a third category, never folded into either.
//   - THE DENOMINATOR IS NOT "all runs". It is "runs that ran THIS check". A check added last week
//     has a small denominator and would otherwise read as catastrophic; the same conflation put
//     two different denominators behind one "4 of 69 (~6%)" on a live comment (queue row 32c89530).
//   - A rate with no denominator is null, not 0.
//
// KNOWN LIMIT, deliberately not solved: a RENAMED check is two checks here. `check` is the join
// key verbatim and matching is exact — fuzzy matching would silently merge two genuinely different
// checks, which is a worse failure than an honest split the reader can see.

/** one row of the trail as it comes off disk — every field unknown, because a torn line is possible */
export interface TrailRecord {
  v?: unknown; run?: unknown; suite?: unknown; tree?: unknown; dirty?: unknown;
  check?: unknown; ok?: unknown; msSincePrev?: unknown; ts?: unknown; detail?: unknown;
}

/** how much a row's `tree` field can be trusted to identify the code that ran */
export type TreeKind = "clean" | "dirty" | "unknown";

export const TRAILSTATS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const TRAILSTATS_MAX_GROUPS = 20;   // payload cap; the omitted count is reported, never silently dropped
const TRAILSTATS_MAX_EVIDENCE = 10; // run ids kept per tree, so a claim can be re-checked by hand
// the suite x check group key's separator. A check name is free prose (it carries spaces, colons,
// parentheses, "—"), so any printable joiner could be produced by a real name and merge two groups.
const KEY_SEP = "\x1f"; // ASCII unit separator — the one byte no check name contains

/** the flake ranking's row: one suite x check group */
export interface CheckStat {
  suite: string;
  check: string;
  /** runs that RAN this check — the only honest denominator (see the header) */
  runs: number;
  /** runs in which it failed at least once */
  failedRuns: number;
  /** raw failing rows; differs from failedRuns only if a run checks one name twice */
  failRows: number;
  /** distinct CLEAN trees it failed on. >=2 is the proof; dirty and unknown trees cannot contribute */
  cleanTrees: number;
  /** fails whose tree cannot serve as evidence — excluded from cleanTrees, counted here */
  dirtyFailRuns: number;
  unknownTreeFailRuns: number;
  lastFailAt: number | null;
  /** cleanTrees >= 2 — "this cannot be your diff" */
  notYourDiff: boolean;
}

/** the time ranking's row. `msSincePrev` is cost-to-get-here, NOT the check's own runtime (docs §4) */
export interface SlowCheck {
  suite: string; check: string;
  /** rows carrying a usable msSincePrev — a row without one is skipped, not counted as 0 */
  n: number;
  totalMs: number;
  medianMs: number;
}

export interface PointAnswer {
  check: string;
  /** null = asked across all suites, and the answer says so rather than picking one */
  suite: string | null;
  runs: number;
  failedRuns: number;
  /** the evidence: which clean trees it failed on, and in which runs */
  cleanTrees: { tree: string; runs: string[] }[];
  dirtyFailRuns: string[];
  unknownTreeFailRuns: string[];
  // `not-in-window` is the fourth on purpose: a check nobody RAN has not "never failed", it has
  // not been observed — and reading absence as a clean bill of health is the exact move this
  // file's direction discipline forbids. A renamed check lands here, which is how the KNOWN LIMIT
  // above becomes visible instead of silent.
  verdict: "not-your-diff" | "insufficient-evidence" | "never-failed" | "not-in-window";
}

export interface TrailSummary {
  window: { from: number; to: number; days: number };
  /** in-scope totals — the context every number above is read against */
  runs: number;
  rows: number;
  checks: number;
  flakes: CheckStat[];
  flakesOmitted: number;
  slowest: SlowCheck[];
  slowestOmitted: number;
  /** null unless a `check` was asked for */
  point: PointAnswer | null;
  outOfScope: { beforeWindow: number; otherSuite: number; malformed: number };
  /** how the in-scope rows' trees split — the reason a fail count and a proof count differ */
  trees: { cleanRows: number; dirtyRows: number; unknownRows: number };
}

/** a 40-hex sha on a tree with NO uncommitted work is the only thing that identifies code */
function treeKind(tree: unknown, dirty: unknown): TreeKind {
  if (typeof tree !== "string" || !/^[0-9a-f]{40}$/.test(tree)) return "unknown";
  // `dirty` is omitted only when `tree` is null (docs/e2e-trail.md §2), so an absent one HERE is a
  // row we cannot read — unknown, never optimistically "clean".
  if (dirty === true) return "dirty";
  if (dirty === false) return "clean";
  return "unknown";
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

interface Group {
  suite: string; check: string;
  runs: Set<string>;
  failRuns: Set<string>;
  failRows: number;
  /** clean tree sha → the runs that failed on it */
  cleanFails: Map<string, Set<string>>;
  dirtyFails: Set<string>;
  unknownFails: Set<string>;
  lastFailAt: number | null;
  ms: number[];
}

/**
 * The trail, read as three answers over a bounded window.
 *
 * PURE: `now`, the window, the filters and the caps are arguments, and the malformed count the
 * caller's parser already had is passed in rather than re-derived. No clock, no filesystem, no
 * path — a synthetic sequence yields a predictable summary.
 */
export function trailStats(records: TrailRecord[], opts: {
  now: number;
  windowMs?: number;
  /** exact suite match, or null/undefined for all suites */
  suite?: string | null;
  /** exact check name — turns on the point answer. Exact by design (see KNOWN LIMIT). */
  check?: string | null;
  maxGroups?: number;
  maxEvidence?: number;
  /** torn mid-append lines the caller could not parse */
  malformed?: number;
}): TrailSummary {
  const windowMs = opts.windowMs ?? TRAILSTATS_WINDOW_MS;
  const maxGroups = opts.maxGroups ?? TRAILSTATS_MAX_GROUPS;
  const maxEvidence = opts.maxEvidence ?? TRAILSTATS_MAX_EVIDENCE;
  const from = opts.now - windowMs;
  const wantSuite = opts.suite ?? null;
  const wantCheck = opts.check ?? null;

  const outOfScope = { beforeWindow: 0, otherSuite: 0, malformed: opts.malformed ?? 0 };
  const trees = { cleanRows: 0, dirtyRows: 0, unknownRows: 0 };
  const groups = new Map<string, Group>();
  const allRuns = new Set<string>();
  let rows = 0;

  for (const r of records) {
    // every field a row needs to mean anything. Unlike audit.jsonl this file has exactly one row
    // shape, so an unreadable row here really is damage — there is no "was never ours" case.
    const suite = typeof r.suite === "string" && r.suite ? r.suite : null;
    const check = typeof r.check === "string" && r.check ? r.check : null;
    const run = typeof r.run === "string" && r.run ? r.run : null;
    const ts = typeof r.ts === "number" && Number.isFinite(r.ts) ? r.ts : null;
    if (suite === null || check === null || run === null || ts === null || typeof r.ok !== "boolean") {
      outOfScope.malformed++; continue;
    }
    if (wantSuite !== null && suite !== wantSuite) { outOfScope.otherSuite++; continue; }
    if (ts < from) { outOfScope.beforeWindow++; continue; }

    rows++;
    allRuns.add(run);
    const kind = treeKind(r.tree, r.dirty);
    if (kind === "clean") trees.cleanRows++;
    else if (kind === "dirty") trees.dirtyRows++;
    else trees.unknownRows++;

    const key = `${suite}${KEY_SEP}${check}`;
    let g = groups.get(key);
    if (!g) {
      g = { suite, check, runs: new Set(), failRuns: new Set(), failRows: 0, cleanFails: new Map(),
        dirtyFails: new Set(), unknownFails: new Set(), lastFailAt: null, ms: [] };
      groups.set(key, g);
    }
    g.runs.add(run); // the denominator: this run RAN this check
    if (typeof r.msSincePrev === "number" && Number.isFinite(r.msSincePrev) && r.msSincePrev >= 0)
      g.ms.push(r.msSincePrev); // an unusable one is skipped, never booked as 0

    if (r.ok) continue;
    g.failRows++;
    g.failRuns.add(run);
    g.lastFailAt = g.lastFailAt === null ? ts : Math.max(g.lastFailAt, ts);
    if (kind === "clean") {
      const tree = r.tree as string;
      const set = g.cleanFails.get(tree);
      if (set) set.add(run); else g.cleanFails.set(tree, new Set([run]));
    } else if (kind === "dirty") g.dirtyFails.add(run);
    else g.unknownFails.add(run);
  }

  const stat = (g: Group): CheckStat => ({
    suite: g.suite, check: g.check,
    runs: g.runs.size, failedRuns: g.failRuns.size, failRows: g.failRows,
    cleanTrees: g.cleanFails.size,
    dirtyFailRuns: g.dirtyFails.size, unknownTreeFailRuns: g.unknownFails.size,
    lastFailAt: g.lastFailAt,
    notYourDiff: g.cleanFails.size >= 2,
  });

  const failing = [...groups.values()].filter((g) => g.failRows > 0)
    .sort((a, b) => b.failRuns.size - a.failRuns.size || b.cleanFails.size - a.cleanFails.size
      || (b.lastFailAt ?? 0) - (a.lastFailAt ?? 0) || a.check.localeCompare(b.check));

  const timed = [...groups.values()].filter((g) => g.ms.length > 0)
    .map((g): SlowCheck => ({
      suite: g.suite, check: g.check, n: g.ms.length,
      totalMs: g.ms.reduce((s, x) => s + x, 0), medianMs: median(g.ms),
    }))
    .sort((a, b) => b.totalMs - a.totalMs || a.check.localeCompare(b.check));

  // THE POINT ANSWER. Built from the same groups, so it can never disagree with the ranking above:
  // one check may live in several suites, and when no suite was named the answer merges them and
  // says `suite: null` rather than silently picking one.
  let point: PointAnswer | null = null;
  if (wantCheck !== null) {
    const mine = [...groups.values()].filter((g) => g.check === wantCheck);
    const runs = new Set<string>(), failRuns = new Set<string>();
    const cleanFails = new Map<string, Set<string>>();
    const dirty = new Set<string>(), unknown = new Set<string>();
    for (const g of mine) {
      for (const x of g.runs) runs.add(x);
      for (const x of g.failRuns) failRuns.add(x);
      for (const [tree, rs] of g.cleanFails) {
        const set = cleanFails.get(tree) ?? new Set<string>();
        for (const x of rs) set.add(x);
        cleanFails.set(tree, set);
      }
      for (const x of g.dirtyFails) dirty.add(x);
      for (const x of g.unknownFails) unknown.add(x);
    }
    point = {
      check: wantCheck,
      suite: wantSuite,
      runs: runs.size,
      failedRuns: failRuns.size,
      cleanTrees: [...cleanFails].map(([tree, rs]) => ({ tree, runs: [...rs].slice(0, maxEvidence) })),
      dirtyFailRuns: [...dirty].slice(0, maxEvidence),
      unknownTreeFailRuns: [...unknown].slice(0, maxEvidence),
      verdict: runs.size === 0 ? "not-in-window" // never observed — NOT a clean bill of health
        : failRuns.size === 0 ? "never-failed"
        : cleanFails.size >= 2 ? "not-your-diff" : "insufficient-evidence",
    };
  }

  return {
    window: { from, to: opts.now, days: Math.round(windowMs / 86_400_000) },
    runs: allRuns.size, rows, checks: groups.size,
    flakes: failing.slice(0, maxGroups).map(stat),
    flakesOmitted: Math.max(0, failing.length - maxGroups),
    slowest: timed.slice(0, maxGroups),
    slowestOmitted: Math.max(0, timed.length - maxGroups),
    point,
    outOfScope,
    trees,
  };
}

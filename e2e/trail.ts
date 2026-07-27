// The suite's own per-check trail (docs/e2e-trail.md). Asserts the durable artifact exists, that
// it is written from the choke point rather than from scattered call sites (one row per check()
// call, exactly), that it OUTLIVES the wrapper's cleanup of a green run, and that a row carries
// the full shape — including the failure detail and its cap, which are checked on the pure row
// builder because a deliberately failing check would fail the run it is measuring.
//
// Runs LAST, after every other family, so the row/result counts it compares cover the whole run.
import { readFileSync } from "node:fs";
import { ROOT, check, results } from "./harness";
import {
  TRAIL_DETAIL_MAX,
  TRAIL_DIRTY,
  TRAIL_RUN,
  TRAIL_SCHEMA,
  TRAIL_SUITE,
  TRAIL_TREE,
  TRAIL_TRUNCATED,
  trailFile,
  trailRow,
  type TrailRow,
} from "./trail-emit";

const SENTINEL = "trail: sentinel check — its own row is asserted below";

const readRows = (): TrailRow[] => {
  if (!trailFile) return [];
  try {
    return readFileSync(trailFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as TrailRow);
  } catch {
    return []; // absent or unreadable trail — the assertions below report it as a FAIL
  }
};

export async function run(): Promise<void> {
  // snapshot both counters BEFORE this module's first check(), so they are comparable
  const rows = readRows();
  const seen = results.length;

  check("trail: the run wrote a durable per-check trail", rows.length > 0, `file=${trailFile} rows=${rows.length}`);
  // the choke point is the contract: one check() call ⇒ exactly one row, no call site opted out
  check("trail: one row per check() call — trail rows match the suite's result count",
    rows.length === seen, `rows=${rows.length} results=${seen}`);

  // SURVIVAL. e2e-isolated.sh `rm -rf`s its instance dir ($DIR = ROOT here) when the run is
  // GREEN — so a trail written inside it would be deleted on exactly the runs that form the
  // baseline. Asserted structurally here; the artifact is checked on disk after a green run.
  check("trail: the trail is outside the instance dir, so a GREEN run's rows survive its cleanup",
    !!trailFile && trailFile !== ROOT && !trailFile.startsWith(`${ROOT}/`),
    `trail=${trailFile} instance=${ROOT}`);

  check(SENTINEL, true);
  const s = readRows().find((r) => r.check === SENTINEL);
  check("trail: a known check's row carries the full shape (v/run/suite/tree/check/ok/msSincePrev/ts)",
    !!s && s.v === TRAIL_SCHEMA && s.run === TRAIL_RUN && s.suite === TRAIL_SUITE && s.tree === TRAIL_TREE
      && s.dirty === (TRAIL_DIRTY ?? undefined) && s.ok === true && s.detail === undefined
      && typeof s.msSincePrev === "number" && s.msSincePrev >= 0 && typeof s.ts === "number" && s.ts > 0,
    JSON.stringify(s ?? null));

  // the tree under test, resolved from inside a throwaway copy that has no .git of its own —
  // without it a row cannot say WHICH code a check failed on, which is the whole query
  check("trail: rows name the tree under test as a git sha",
    !!TRAIL_TREE && /^[0-9a-f]{40}$/.test(TRAIL_TREE), `tree=${TRAIL_TREE} dirty=${TRAIL_DIRTY}`);

  // detail is the only unbounded field: kept for a failing check, capped, dropped for a pass
  const long = trailRow("x", false, "d".repeat(TRAIL_DETAIL_MAX + 500), 5, 1);
  check("trail: a failing check's row keeps its detail, capped at TRAIL_DETAIL_MAX",
    long.detail === "d".repeat(TRAIL_DETAIL_MAX) + TRAIL_TRUNCATED,
    `len=${long.detail?.length} cap=${TRAIL_DETAIL_MAX}`);
  check("trail: a passing check's row carries no detail",
    trailRow("x", true, "some detail", 5, 1).detail === undefined,
    JSON.stringify(trailRow("x", true, "some detail", 5, 1)));
}

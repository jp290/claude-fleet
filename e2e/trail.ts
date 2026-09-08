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
  TRAIL_POINTER,
  TRAIL_SOURCE,
  TRAIL_SUITE,
  TRAIL_TREE,
  TRAIL_TREE_WHY,
  TRAIL_TRUNCATED,
  probeSourceTree,
  resolveSourceTree,
  workTreeVerdictOf,
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

  const stagedRoot = "/staged-wrapper";
  const stagedSource = resolveSourceTree(stagedRoot, "/non-work-tree/node_modules",
    (candidate) => candidate === stagedRoot);
  check("trail: a node_modules symlink whose target is not a work tree never falls back to the staged wrapper",
    stagedSource === null,
    `source=${stagedSource} instance=${stagedRoot}`);

  check(SENTINEL, true);
  const s = readRows().find((r) => r.check === SENTINEL);
  check("trail: a known check's row carries the full shape (v/run/suite/tree/check/ok/msSincePrev/ts)",
    !!s && s.v === TRAIL_SCHEMA && s.run === TRAIL_RUN && s.suite === TRAIL_SUITE && s.tree === TRAIL_TREE
      && s.dirty === (TRAIL_DIRTY ?? undefined) && s.treeWhy === (TRAIL_TREE_WHY ?? undefined)
      && s.ok === true && s.detail === undefined
      && typeof s.msSincePrev === "number" && s.msSincePrev >= 0 && typeof s.ts === "number" && s.ts > 0,
    JSON.stringify(s ?? null));

  // the tree under test, resolved from inside a staged wrapper only through its node_modules
  // symlink — without it a row cannot say WHICH code a check failed on, which is the whole query
  // Both branches of the emit's own contract, because both occur in production: a run under
  // e2e-isolated.sh resolves a tree, but the POST-LAND AUDIT runs against a `git archive` snapshot
  // that is a tree and not a repository (server.ts, snapshotIntegrationTree) — there `tree` is
  // legitimately null and the row "claims nothing". Asserting only the happy path made every audit
  // red (measured 2026-07-27, tip d6d77a8). When no tree resolves, `dirty` must be null too — that
  // pairing IS the claims-nothing invariant, and it was previously untested.
  check("trail: rows name the tree under test as a git sha, or null when no repo is resolvable",
    TRAIL_TREE === null ? TRAIL_DIRTY === null : /^[0-9a-f]{40}$/.test(TRAIL_TREE),
    `tree=${TRAIL_TREE} dirty=${TRAIL_DIRTY}`);

  // …AND IT SAYS WHY, IN THE ROW. `tree:null` is legitimate, so it must never be red — asserting
  // only the happy path made every audit red once already (2026-07-27, tip d6d77a8, the paragraph
  // above). But legitimate is not the same as legible: an anonymous row can never serve as flake
  // evidence (trailstats counts it under `unknownRows`), and a reader opening a trail file months
  // later has no tail left to consult. So the LOSS IS NAMED where the loss is — non-null exactly
  // when `tree` is null, which is the pairing this asserts in both directions.
  check("trail: a run that can name no tree says WHY, in the row itself",
    TRAIL_TREE === null
      ? typeof TRAIL_TREE_WHY === "string" && TRAIL_TREE_WHY.length > 0
      : TRAIL_TREE_WHY === null,
    `tree=${TRAIL_TREE} treeWhy=${TRAIL_TREE_WHY} source=${JSON.stringify(TRAIL_SOURCE)} pointer=${TRAIL_POINTER}`);

  // THREE ANSWERS, NOT TWO — on the pure probe, so it is measured on every run rather than only on
  // the box that happens to be missing a git. "This directory is not a work tree" describes the
  // post-land audit's `git archive` snapshot CORRECTLY; "git could not be asked at all" describes a
  // probe that measured nothing. Folded together they read as the same null, and the second then
  // wears the first's legitimacy.
  const notWorkTree = probeSourceTree("/staged-wrapper", "/snapshot/node_modules", () => "no");
  const noGit = probeSourceTree("/staged-wrapper", "/snapshot/node_modules", () => "git-unavailable");
  const direct = probeSourceTree("/checkout", null, () => "yes");
  check("trail: the source-tree probe tells 'not a work tree' apart from 'git could not be asked'",
    notWorkTree.tree === null && notWorkTree.why === "not-a-work-tree" && notWorkTree.via === "pointer"
      && notWorkTree.candidate === "/snapshot"
      && noGit.tree === null && noGit.why === "git-unavailable"
      && direct.tree === "/checkout" && direct.via === "root" && direct.why === null,
    `notWorkTree=${JSON.stringify(notWorkTree)} noGit=${JSON.stringify(noGit)} direct=${JSON.stringify(direct)}`);

  // …and the same three answers where they are actually PRODUCED, on the classification split off
  // the git spawn. Exit 0 saying `false` is a real answer too (a bare repo), so it must not become
  // "git could not be asked" either.
  check("trail: a git that never RAN is not classified as 'not a work tree'",
    workTreeVerdictOf(null, false, "") === "git-unavailable"
      && workTreeVerdictOf(null, true, "") === "git-unavailable"
      && workTreeVerdictOf(128, false, "") === "no"
      && workTreeVerdictOf(0, false, "false\n") === "no"
      && workTreeVerdictOf(0, false, "true\n") === "yes",
    `null=${workTreeVerdictOf(null, false, "")} 128=${workTreeVerdictOf(128, false, "")}`
      + ` bare=${workTreeVerdictOf(0, false, "false\n")} yes=${workTreeVerdictOf(0, false, "true\n")}`);

  // detail is the only unbounded field: kept for a failing check, capped, dropped for a pass
  const long = trailRow("x", false, "d".repeat(TRAIL_DETAIL_MAX + 500), 5, 1);
  check("trail: a failing check's row keeps its detail, capped at TRAIL_DETAIL_MAX",
    long.detail === "d".repeat(TRAIL_DETAIL_MAX) + TRAIL_TRUNCATED,
    `len=${long.detail?.length} cap=${TRAIL_DETAIL_MAX}`);
  check("trail: a passing check's row carries no detail",
    trailRow("x", true, "some detail", 5, 1).detail === undefined,
    JSON.stringify(trailRow("x", true, "some detail", 5, 1)));
}

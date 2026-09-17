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
  PHASES_ON,
  PHASE_PRIORITY,
  actorFields,
  callSiteOf,
  createPhaseClock,
  phaseClock,
  withPhases,
  TRAIL_BRANCH,
  TRAIL_DETAIL_MAX,
  TRAIL_DIRTY,
  TRAIL_OFFERED,
  TRAIL_SLOT,
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

  // WHERE msSincePrev WENT, on every row this run wrote: four exclusive phases plus `rest`, summing
  // to msSincePrev EXACTLY (rest is the remainder, both sides are the same integer Date.now ticks —
  // no tolerance), none negative. A negative `rest` is a double-booked second — the exact defect
  // exclusive attribution exists to prevent. Under FLEET_E2E_PHASES=0 the opposite must hold.
  const badPhases = rows.filter((r) => {
    const p = r.phases;
    if (!PHASES_ON) return p !== undefined || r.phaseTop !== undefined || r.phaseSum !== undefined;
    if (!p) return true;
    const parts = [p.boot, p.tmux, p.http, p.sleep, p.rest];
    return parts.some((n) => typeof n !== "number" || n < 0)
      || parts.reduce((s, n) => s + n, 0) !== r.msSincePrev;
  });
  check(PHASES_ON
    ? "trail: every row carries phases (boot/tmux/http/sleep/rest) that sum to its msSincePrev"
    : "trail: FLEET_E2E_PHASES=0 writes no phases field on any row",
  rows.length > 0 && badPhases.length === 0,
  `rows=${rows.length} bad=${badPhases.length} first=${JSON.stringify(badPhases[0] ?? null).slice(0, 300)}`);
  // ...and the probe is not vacuous: every shard of the runner drives tmux, polls over HTTP and
  // sleeps, so a phase with zero booked ms means a wrapper silently missed its primitive. `boot` is
  // left out on purpose — a shard need not restart srv, and it shares the one `timed` path anyway.
  const booked = PHASE_PRIORITY.filter((ph) => rows.some((r) => (r.phases?.[ph] ?? 0) > 0));
  check("trail: phases is not vacuous — tmux, http and sleep each booked time in this run",
    !PHASES_ON || (["tmux", "http", "sleep"] as const).every((ph) => booked.includes(ph)),
    `booked=${booked.join(",")} calls=${JSON.stringify(phaseClock.calls())}`);

  // the attribution itself, on a synthetic clock — the scenario the clock= lines below replay:
  let clock = 0;
  const pc = createPhaseClock(() => clock, "/r", "e2e/trail-emit.ts", "e2e/harness.ts");
  const hold = <T>(v: T): { p: Promise<T>; go: () => void } => {
    let go = (): void => {};
    const p = new Promise<T>((res) => { go = () => res(v); });
    return { p, go };
  };
  const bootH = hold(0), innerGet = hold(0), innerSleep = hold(0), lateFetch = hold(0), bareGet = hold(0);
  const poll1 = hold(0), poll2 = hold(0), lone = hold(0);
  const stackAt = (file: string, line: number): Error => {
    const e = new Error();
    e.stack = `Error\n    at timed (/r/e2e/trail-emit.ts:9:1)\n    at x (/r/e2e/harness.ts:1:1)\n    at run (/r/${file}:${line}:3)`;
    return e;
  };
  //   t        | event                                         | exclusive owner of the interval
  //   0→10     | boot starts (restart.ts:11)                   | boot
  //   10→40    | get() inside boot (restart.ts:12)             | boot  (not outermost: no top entry)
  //   40→60    | sleep inside boot (restart.ts:13)             | boot  (not outermost: no top entry)
  //   60→90    | boot still polling                            | boot
  //   90→100   | fetch starts inside boot (tasks.ts:21)        | boot  (started inside boot: no top entry)
  //   100→130  | boot ended, that fetch outlives it            | http  30
  //   130→150  | nothing running                               | rest  20
  //   150→160  | poll sleep #1 (watch.ts:31)                   | sleep 10
  //   160→170  | poll sleep #2, same line (watch.ts:31)        | sleep 10
  //   170→175  | nothing running                               | rest  5
  //   175→185  | bare fetch (tasks.ts:22)                      | http  10, top http 10 @ tasks.ts:22
  //   185→197  | one lone sleep (review.ts:9)                  | sleep 12
  //   197→200  | nothing running, cut at 200                   | rest  3
  //   totals   | boot 100 · http 40 · sleep 32 · tmux 0 · rest 28 (= 200) · top boot 100 @ restart.ts:11
  //   sleep    | longest single call: 12 @ review.ts:9 · largest sum: 20 over 2 calls @ watch.ts:31
  const boot = pc.timed("boot", () => bootH.p, stackAt("e2e/restart.ts", 11));
  clock = 10; const g = pc.timed("http", () => innerGet.p, stackAt("e2e/restart.ts", 12));
  clock = 40; innerGet.go(); await g;
  const s1 = pc.timed("sleep", () => innerSleep.p, stackAt("e2e/restart.ts", 13));
  clock = 60; innerSleep.go(); await s1;
  clock = 90; const lf = pc.timed("http", () => lateFetch.p, stackAt("e2e/tasks.ts", 21));
  clock = 100; bootH.go(); await boot;
  clock = 130; lateFetch.go(); await lf;
  clock = 150; const b1 = pc.timed("sleep", () => poll1.p, stackAt("e2e/watch.ts", 31));
  clock = 160; poll1.go(); await b1;
  const b2 = pc.timed("sleep", () => poll2.p, stackAt("e2e/watch.ts", 31));
  clock = 170; poll2.go(); await b2;
  clock = 175; const bg = pc.timed("http", () => bareGet.p, stackAt("e2e/tasks.ts", 22));
  clock = 185; bareGet.go(); await bg;
  const b3 = pc.timed("sleep", () => lone.p, stackAt("e2e/review.ts", 9));
  clock = 197; lone.go(); await b3;
  const synth = pc.cut(200);
  // one red, one claim: each check names the conjuncts that died, not a blob
  const died = (parts: [string, boolean][]): string => parts.filter(([, ok]) => !ok).map(([n]) => n).join(" · ");
  const totalsDied = died([
    [`boot=${synth.ms.boot}≠100`, synth.ms.boot === 100], [`http=${synth.ms.http}≠40`, synth.ms.http === 40],
    [`sleep=${synth.ms.sleep}≠32`, synth.ms.sleep === 32], [`tmux=${synth.ms.tmux}≠0`, synth.ms.tmux === 0],
  ]);
  check("trail: phase totals are exclusive by priority — nested and overlapping calls never double-book",
    totalsDied === "", totalsDied);
  // a call STARTED inside boot is boot's (a get() in restartSrv looks exactly like that), so the only
  // outermost http call is the bare one — its time counts, the overlapping one's site does not
  const siteDied = died([
    [`boot=${JSON.stringify(synth.top.boot)}`, synth.top.boot?.ms === 100 && synth.top.boot.at === "e2e/restart.ts:11"],
    [`http=${JSON.stringify(synth.top.http)}`, synth.top.http?.ms === 10 && synth.top.http.at === "e2e/tasks.ts:22"],
    [`sleep=${JSON.stringify(synth.top.sleep)}`, synth.top.sleep?.ms === 12 && synth.top.sleep.at === "e2e/review.ts:9"],
    [`tmux=${JSON.stringify(synth.top.tmux)}`, synth.top.tmux === undefined],
  ]);
  check("trail: phaseTop names the longest OUTERMOST call per phase and its call site",
    siteDied === "", siteDied);
  // the poll loop: two short sleeps from one line outweigh the longest single call from another
  const sumDied = died([
    [`sleep=${JSON.stringify(synth.sum.sleep)}`, synth.sum.sleep?.ms === 20 && synth.sum.sleep.n === 2 && synth.sum.sleep.at === "e2e/watch.ts:31"],
    [`http=${JSON.stringify(synth.sum.http)}`, synth.sum.http?.ms === 10 && synth.sum.http.n === 1 && synth.sum.http.at === "e2e/tasks.ts:22"],
  ]);
  check("trail: phaseSum names the site whose outermost calls sum to the most, with their count",
    sumDied === "", sumDied);
  const row = withPhases(trailRow("x", true, "", 200, 200), synth);
  check("trail: rest is msSincePrev minus the four phases, and a cut starts the next row empty",
    row.phases?.rest === 28 && JSON.stringify(pc.cut(260)) === JSON.stringify({ ms: { boot: 0, tmux: 0, http: 0, sleep: 0 }, top: {}, sum: {} }),
    JSON.stringify(row.phases));
  check("trail: the call site skips the probe, and falls back to the harness frame only when nothing else is on the stack",
    callSiteOf("Error\n    at timed (/r/e2e/trail-emit.ts:9:1)\n    at async plantScreen (/r/e2e/harness.ts:321:11)", "/r",
      "e2e/trail-emit.ts", "e2e/harness.ts") === "e2e/harness.ts:321"
      && callSiteOf("Error\n    at /r/e2e/trail-emit.ts:9:1\n    at post (/r/e2e/harness.ts:94:3)\n    at run (/r/e2e/tasks.ts:77:20)",
        "/r", "e2e/trail-emit.ts", "e2e/harness.ts") === "e2e/tasks.ts:77"
      && callSiteOf("Error\n    at sleep (native)", "/r", "e2e/trail-emit.ts", "e2e/harness.ts") === "unknown");

  const stagedRoot = "/staged-wrapper";
  const stagedSource = resolveSourceTree(stagedRoot, "/non-work-tree/node_modules",
    (candidate) => candidate === stagedRoot);
  check("trail: a node_modules symlink whose target is not a work tree never falls back to the staged wrapper",
    stagedSource === null,
    `source=${stagedSource} instance=${stagedRoot}`);

  check(SENTINEL, true);
  const s = readRows().find((r) => r.check === SENTINEL);
  // THE ACTOR — who started this run, on which branch, and whether it was offered first
  // (docs/e2e-trail.md §2a). Each field is present exactly when its source was there and absent
  // when it was not, which is why this is asserted in BOTH directions against the emit's own
  // constants: a run under the land gate or the post-land audit has no lane credentials and must
  // write none of the three, and a row from before 2026-09-17 has none either — the reader here
  // requires nothing, it requires AGREEMENT.
  const actorDied = died([
    [`slot=${JSON.stringify(s?.slot)} TRAIL_SLOT=${JSON.stringify(TRAIL_SLOT)}`, s?.slot === (TRAIL_SLOT ?? undefined)],
    [`branch=${JSON.stringify(s?.branch)} TRAIL_BRANCH=${JSON.stringify(TRAIL_BRANCH)}`, s?.branch === (TRAIL_BRANCH ?? undefined)],
    [`offered=${JSON.stringify(s?.offered)} TRAIL_OFFERED=${JSON.stringify(TRAIL_OFFERED)}`, s?.offered === (TRAIL_OFFERED ?? undefined)],
  ]);
  check("trail: a row names its actor — slot, branch and offered, each present exactly when its source was",
    !!s && actorDied === "", actorDied || `row=${JSON.stringify({ slot: s?.slot, branch: s?.branch, offered: s?.offered })}`);

  // …and the omit rule on ALL its branches, not only the one this run happens to be in. The two
  // asymmetries are the point: an empty string is an ABSENT source (an exported-but-empty
  // FLEET_E2E_SLOT would otherwise write `slot:""`, a run by nobody rather than a run whose actor
  // is unknown), while `offered:false` is an ANSWER — the lane asked the door and it had never
  // offered — and only null omits it.
  const allSet = actorFields("7", "fleet/abc", false);
  const noneSet = actorFields(null, null, null);
  const emptySrc = actorFields("", "", null);
  const actorPureDied = died([
    [`allSet=${JSON.stringify(allSet)}`, JSON.stringify(allSet) === JSON.stringify({ slot: "7", branch: "fleet/abc", offered: false })],
    [`noneSet=${JSON.stringify(noneSet)}`, Object.keys(noneSet).length === 0],
    [`emptySrc=${JSON.stringify(emptySrc)}`, Object.keys(emptySrc).length === 0],
    [`offeredTrue=${JSON.stringify(actorFields(null, null, true))}`,
      JSON.stringify(actorFields(null, null, true)) === JSON.stringify({ offered: true })],
  ]);
  check("trail: an absent actor source omits its field — and `offered:false` is an answer, not an absence",
    actorPureDied === "", actorPureDied);

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

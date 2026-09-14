// e2e for claude-fleet: run from the repo root with the server already up.
//   bun fleet-e2e.ts
//   bun fleet-e2e.ts --shard k/n      (or FLEET_E2E_SHARD=k/n — the wrapper passes no argv)
// Creates slots 1+2, kills them, and restarts the `srv` tmux session along the way.
//
// This file is the RUNNER only: the checks live in e2e/*.ts, one module per check family, and
// run here in exactly the order the single-file suite ran them (the suite is one sequential
// session against one server — order is load-bearing). Shared plumbing is e2e/harness.ts; the
// handful of fixtures that outlive their own section travel in the explicit context objects of
// e2e/ctx.ts. Check names are unchanged, so the "which check failed" contract is unchanged too.
//
// SHARDS. Every step below is tagged with the UNIT it belongs to (e2e/ctx.ts#SHARD_UNITS: the
// smallest set of modules that share a fixture, a server-state plant or a handed-on return value).
// `--shard k/n` runs only the units e2e/ctx.ts#shardPlan assigns to shard k, IN THIS SAME ORDER —
// no flag runs every step, byte-for-byte the sequence below. The trail family runs in every shard
// (it audits its own process's rows). Each shard needs its own server instance: e2e-isolated.sh
// derives SOCK/PORT/DIR from $$, so `FLEET_E2E_SHARD=k/n ./e2e-isolated.sh` per shard is enough.
import { REPO, SOCK, check, failures, post, results } from "./e2e/harness";
import { newCtx, parseShard, shardPlan, SHARD_UNITS, type LaneCtx, type StewardCtx } from "./e2e/ctx";
import * as contextPacks from "./e2e/context-packs";
import * as contextPlan from "./e2e/context-plan";
import * as prompts from "./e2e/prompts";
import * as briefstats from "./e2e/briefstats";
import * as auth from "./e2e/auth";
import * as dirsPins from "./e2e/dirs-pins";
import * as slots from "./e2e/slots";
import * as history from "./e2e/history";
import * as summary from "./e2e/summary";
import * as transport from "./e2e/transport";
import * as autos from "./e2e/autos";
import * as share from "./e2e/share";
import * as lanesBasic from "./e2e/lanes-basic";
import * as review from "./e2e/review";
import * as watch from "./e2e/watch";
import * as attention from "./e2e/attention";
import * as lanesLifecycle from "./e2e/lanes-lifecycle";
import * as merge from "./e2e/merge";
import * as laneRisk from "./e2e/lane-risk";
import * as explorer from "./e2e/explorer";
import * as drops from "./e2e/drops";
import * as landProvenance from "./e2e/land-provenance";
import * as ctl from "./e2e/ctl";
import * as concurrency from "./e2e/concurrency";
import * as selfToken from "./e2e/self-token";
import * as laneSuite from "./e2e/lane-suite";
import * as programs from "./e2e/programs";
import * as supervisor from "./e2e/supervisor";
import * as refAdvance from "./e2e/ref-advance";
import * as outcomes from "./e2e/outcomes";
import * as landDurability from "./e2e/land-durability";
import * as tasks from "./e2e/tasks";
import * as intake from "./e2e/intake";
import * as sweep from "./e2e/sweep";
import * as restart from "./e2e/restart";
import * as stewardCore from "./e2e/steward-core";
import * as stewardOutcomes from "./e2e/steward-outcomes";
import * as security from "./e2e/security";
import * as verifyQueue from "./e2e/verify-queue";
import * as deployFacts from "./e2e/deploy-facts";
import * as errors from "./e2e/errors";
import * as trail from "./e2e/trail";
import * as trailstats from "./e2e/trailstats";

// the suite kills slots 1-3 and restarts srv — a bare `bun fleet-e2e.ts` must never
// hit the live fleet by accident. The isolated wrappers set FLEET_SOCK to their own socket.
if (SOCK === "claudefleet" && !process.env.FLEET_E2E_ALLOW_LIVE)
  throw new Error("refusing to run against live socket 'claudefleet' — use ./e2e-isolated.sh (or set FLEET_E2E_ALLOW_LIVE=1)");

// --shard k/n on argv wins over FLEET_E2E_SHARD; a malformed value is an error, never "all".
const shardArg = ((): string | undefined => {
  const i = process.argv.indexOf("--shard");
  if (i >= 0) return process.argv[i + 1] ?? "";
  const eq = process.argv.find((a) => a.startsWith("--shard="));
  return eq ? eq.slice("--shard=".length) : process.env.FLEET_E2E_SHARD || undefined;
})();
const shard = shardArg === undefined ? null : parseShard(shardArg);
if (shardArg !== undefined && !shard)
  throw new Error(`--shard wants k/n with 1 ≤ k ≤ n, got '${shardArg}'`);
const myUnits: ReadonlySet<string> | null = shard
  ? new Set([...shardPlan(shard.n)].filter(([, s]) => s === shard.k).map(([u]) => u))
  : null;

const ctx = newCtx();
// the two fixtures the single-file suite passed between sections as local variables
const lc: LaneCtx = { lnSlot: 0, lnPath: "" };
let sc: StewardCtx | null = null;

// One step per contiguous run of same-unit modules, in the suite's original order; `lane` marks
// the steps of the worktree-lane block (skipped without FLEET_E2E_REPO, exactly as the `if (REPO)`
// bracket did). The comments are the sections' own — they explain the ORDER, which is why the
// order is kept even inside a shard. `alsoIn` names further units the step belongs to: it runs once
// in a shard holding ANY of them, and its time counts to the first of them that shard holds.
interface Step { unit: string; alsoIn?: readonly string[]; lane?: true; run: () => Promise<void> }
const steps: Step[] = [
  // --- PURE-function unit tests (no server needed) ---
  { unit: "pure", run: async () => {
    await contextPacks.run(check);
    await contextPlan.run(check);
    await prompts.run();
    // the brief-quality reader (briefstats.ts): pure over two synthetic ledgers, plus its CLI spawned
    // as the operator runs it. No server, so it sits with the other pure families.
    await briefstats.run();
  } },

  // --- auth, request guards, the ✨ enhance surface, and the directory/pin API ---
  { unit: "auth", run: async () => {
    await auth.run();
    await dirsPins.run();
  } },

  // --- slots, streaming, export, prompt history/log, transcript, brief, ✨ summary ---
  { unit: "core", run: async () => {
    await slots.run();
    await history.run();
    await summary.run();

    // --- transport: gzip, the app.js cache-buster chain, the per-connection byte ledger.
    // Needs an active slot 1 (for the ws.send half) and leaves no state behind — it restores the
    // bundle fixture it writes into this instance's public/ copy.
    await transport.run();

    // --- scheduled prompts: one-shots, perpetuals, the kill-switch, quiet hours ---
    await autos.run(ctx);

    // --- session sharing: guests, comments, mode flips, the reopen regression ---
    await share.run(ctx);
  } },

  // --- worktree lanes (Phase A/B/C). Uses a throwaway git repo from FLEET_E2E_REPO ---
  { unit: "lanes", lane: true, run: async () => {
    await lanesBasic.run(lc);
  } },
  { unit: "core", lane: true, run: async () => {
    await review.run(ctx);
  } },
  // the outbound side of the same predicate — right after the section that establishes it
  { unit: "watch", lane: true, run: async () => {
    await watch.run();
  } },
  // the owner-facing twin of the clarification edge watch.run() establishes: MAIN→owner attention.
  // Next to it because it plants the same kind of Program/MAIN binding fixture and tears it down.
  { unit: "attention", lane: true, run: async () => {
    await attention.run();
  } },
  { unit: "lanes", lane: true, run: async () => {
    await lanesLifecycle.run(lc);
    await merge.run(lc);
  } },
  { unit: "lane-risk", lane: true, run: async () => {
    await laneRisk.run();
  } },
  // the board's grundbedienung: the two commit lists' routes, and the explorer's own interaction
  // probes. In the lane block because both halves need a LANE — two disjoint commit lists exist
  // nowhere else — and it opens and kills its own slot, so it shares no fixture with its neighbours.
  { unit: "explorer", lane: true, run: async () => {
    await explorer.run();
  } },
  // the upload surface. In the lane block because its whole point is a property of a WORKTREE
  // (an untracked drop blocks the land), on its own slot and its own branch, and it tears both
  // down again — so it shares no fixture with the sections around it.
  { unit: "drops", lane: true, run: async () => {
    await drops.run();
  } },
  { unit: "land-provenance", lane: true, run: async () => {
    await landProvenance.run();
  } },
  // the controller's own verb layer, measured against the routes it wraps. Here because it LANDS
  // lanes and hand-starts a queued row — the same fixtures the two neighbours above and below use —
  // and because it must run while a receiver session can still be opened beside them. It opens and
  // kills every slot it uses and leaves no watch, lock or lane behind.
  { unit: "ctl", lane: true, run: async () => {
    await ctl.run();
  } },
  { unit: "concurrency", lane: true, run: async () => {
    await concurrency.run();
  } },
  // in `programs` too: its lane token is the one hand-on programs.run() reads (e2e/ctx.ts#SHARD_UNITS)
  { unit: "core", alsoIn: ["programs"], lane: true, run: async () => {
    await selfToken.run(ctx);
  } },
  // the LANE-SUITE half of the remote helper portal — right after the self-token family whose
  // credential drives it. It now restarts the scratch server once to prove claimWas/endedAt hydration
  // and remains before programs.run(); it opens and kills its own lanes and leaves no offer behind.
  { unit: "lane-suite", lane: true, run: async () => {
    await laneSuite.run();
  } },
  // Programs are planning-session artifacts above lanes. They use both the plain session and the
  // surviving lane self-token established immediately above, and restart the scratch server once.
  { unit: "programs", lane: true, run: async () => {
    await programs.run(ctx);
  } },
  // the cross-program Supervisor binding sits ABOVE the Program brackets, so it runs directly after
  // them: it reuses the same fleet-checkout git fixture and the same restart proof, and it leaves
  // no occupied slot behind for the sections that follow.
  { unit: "supervisor", lane: true, run: async () => {
    await supervisor.run();
  } },
  // the READ half of the trail family — here, not next to trail.run() at the end, because its
  // route checks need a LANE's selfToken alive (ctx.restartSelfTok, which restart.run() tears
  // down) to prove the query reaches the principal the proof order it replaces actually binds.
  { unit: "core", lane: true, run: async () => {
    await trailstats.run(ctx);
  } },
  { unit: "ref-advance", lane: true, run: async () => {
    await refAdvance.run();
  } },
  // `core`, not a unit of its own: it leaves the Program of its restart probe CONFIRMED, and
  // tasks.run() below reuses exactly that row (the first --shard run found the edge).
  { unit: "core", lane: true, run: async () => {
    await outcomes.run();
  } },
  // what the merge/land path can still say after the process running it was killed. Last in the
  // lane block on purpose: it restarts srv several times, so it must not sit between two sections
  // that share a live fixture — and it runs after outcomes.run() so its terminal rows never land
  // inside another module's ledger reads.
  { unit: "land-durability", lane: true, run: async () => {
    await landDurability.run();
  } },

  // --- task queue + dispatch gates, intake, the public share host ---
  { unit: "core", run: async () => {
    await tasks.run(ctx);
    await intake.run(ctx);
  } },

  // --- the deterministic cleanliness sweep (review-sweep.ts). Directly after the task family because
  // its --queue half mints rows through the same owner route those checks exercise — and it deletes
  // every row it minted again, so the sections after it see the queue the tasks family left behind.
  { unit: "sweep", run: async () => {
    await sweep.run();
  } },

  // --- file permissions, kill semantics, restart persistence, the audit log ---
  { unit: "core", run: async () => {
    await restart.run(ctx);
  } },

  // --- the verify gate made visible: the suite mutex projected on /api/sessions, and the phases
  // lanes report about their own gate runs. Next to restart.run() for the same reason — it too points
  // the server at a knob for a few checks (its own private lock dir) and restarts srv back to the
  // wrapper's env afterwards, so it must not sit between two sections sharing a live fixture.
  { unit: "verify-queue", run: async () => {
    await verifyQueue.run();
  } },

  // --- the deploy facts on the owner's poll. Next to verifyQueue for the same reason: it points the
  // server at a fixture repo (FLEET_REPO_DIR) for a few checks and restarts srv back to the
  // wrapper's env afterwards, so it must not sit between two sections sharing a live fixture.
  { unit: "deploy-facts", run: async () => {
    await deployFacts.run();
  } },

  // --- the server's own thrown errors, on the owner's poll. Next to deployFacts for the same
  // reason as its neighbours: it restarts srv three times and it briefly breaks two state-write
  // paths on purpose, so it must not sit between two sections sharing a live fixture. It repairs
  // both and leaves the server on the wrapper's env, exactly as it found it.
  { unit: "errors", run: async () => {
    await errors.run();
  } },

  // --- steward principal: scoped token, typed+capped sends, read-only fleet-wide access ---
  { unit: "core", run: async () => {
    sc = await stewardCore.run(ctx);
    await stewardOutcomes.run(sc);
    // --- the security perimeter: the pre-auth route pin, the principal × dangerous-route denial
    // matrix, credential revocation, and secret hygiene. Runs LAST — it needs every principal the
    // suite has minted (guest cookie, lane selfToken, steward token) alive at once.
    await security.run(ctx, sc);
  } },
];

// every step names a unit the table knows — the table is what a shard is computed from
{
  const known = new Set(SHARD_UNITS.map((u) => u.unit));
  const stray = steps.flatMap((s) => [s.unit, ...(s.alsoIn ?? [])]).filter((u) => !known.has(u));
  if (stray.length) throw new Error(`runner steps name units missing from e2e/ctx.ts#SHARD_UNITS: ${stray.join(", ")}`);
}

const unitMs = new Map<string, number>();
let completed = false;
try {

// THE BASE FIXTURE OF A SHARD WITHOUT `core`. The whole suite opens slot 1 and slot 2 in its first
// server-touching family (slots.ts, same two calls, same cwds) and never closes them before
// restart.ts — so every module in between meets an open PLAIN slot 2 and uses it as its
// non-worktree negative control (`/api/slots/2/diff|land|shelve|risk|commit|merge` → 400). A shard
// that skips slots.ts must re-create that world or those controls measure "no such slot" instead:
// `--shard 2/4` on 2026-09-13 failed `shelve rejects a non-worktree slot` exactly so. Shard mode
// only; the flag-less run reaches this state through slots.run() as before.
if (myUnits && !myUnits.has("core")) {
  const o1 = await post("/api/slots/1/open", { cwd: "~/claude-fleet" });
  const o2 = await post("/api/slots/2/open", { cwd: "~" });
  if (!o1.ok || !o2.ok) throw new Error(`shard base fixture: slot 1 → ${o1.status}, slot 2 → ${o2.status}`);
}

for (const step of steps) {
  if (step.lane && !REPO) continue;
  const owner = [step.unit, ...(step.alsoIn ?? [])].find((u) => !myUnits || myUnits.has(u));
  if (!owner) continue;
  const t0 = Date.now();
  await step.run();
  unitMs.set(owner, (unitMs.get(owner) ?? 0) + (Date.now() - t0));
}

// --- the run's own per-check trail. Last on purpose: it compares its row count against every
// check the suite has recorded, so it must see all of them.
await trail.run();
completed = true;
} finally {
  // A late section may still throw, but it must not erase the checks that already ran. Printing in
  // finally preserves that evidence; the original error is deliberately rethrown by try/finally.
  if (!completed && results.length) console.log(results.join("\n"));
}

// the shard's own measurement, BEFORE the results so the tail stays what every reader judges by
if (shard) {
  const ran = SHARD_UNITS.filter((u) => myUnits!.has(u.unit)).map((u) => u.unit);
  console.log(`shard ${shard.k}/${shard.n}: units=[${ran.join(" ")}]`);
  for (const u of ran) console.log(`shard-unit ${u} ${unitMs.get(u) ?? 0} ms`);
}
console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

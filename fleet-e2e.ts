// e2e for claude-fleet: run from the repo root with the server already up.
//   bun fleet-e2e.ts
// Creates slots 1+2, kills them, and restarts the `srv` tmux session along the way.
//
// This file is the RUNNER only: the checks live in e2e/*.ts, one module per check family, and
// run here in exactly the order the single-file suite ran them (the suite is one sequential
// session against one server — order is load-bearing). Shared plumbing is e2e/harness.ts; the
// handful of fixtures that outlive their own section travel in the explicit context objects of
// e2e/ctx.ts. Check names are unchanged, so the "which check failed" contract is unchanged too.
import { REPO, SOCK, failures, results } from "./e2e/harness";
import { newCtx, type LaneCtx } from "./e2e/ctx";
import * as prompts from "./e2e/prompts";
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
import * as lanesLifecycle from "./e2e/lanes-lifecycle";
import * as merge from "./e2e/merge";
import * as laneRisk from "./e2e/lane-risk";
import * as drops from "./e2e/drops";
import * as landProvenance from "./e2e/land-provenance";
import * as concurrency from "./e2e/concurrency";
import * as selfToken from "./e2e/self-token";
import * as refAdvance from "./e2e/ref-advance";
import * as outcomes from "./e2e/outcomes";
import * as landDurability from "./e2e/land-durability";
import * as tasks from "./e2e/tasks";
import * as intake from "./e2e/intake";
import * as restart from "./e2e/restart";
import * as stewardCore from "./e2e/steward-core";
import * as stewardOutcomes from "./e2e/steward-outcomes";
import * as security from "./e2e/security";
import * as guest from "./e2e/guest";
import * as verifyQueue from "./e2e/verify-queue";
import * as deployFacts from "./e2e/deploy-facts";
import * as errors from "./e2e/errors";
import * as trail from "./e2e/trail";
import * as trailstats from "./e2e/trailstats";

// the suite kills slots 1-3 and restarts srv — a bare `bun fleet-e2e.ts` must never
// hit the live fleet by accident. The isolated wrappers set FLEET_SOCK to their own socket.
if (SOCK === "claudefleet" && !process.env.FLEET_E2E_ALLOW_LIVE)
  throw new Error("refusing to run against live socket 'claudefleet' — use ./e2e-isolated.sh (or set FLEET_E2E_ALLOW_LIVE=1)");

const ctx = newCtx();

// --- PURE-function unit tests (no server needed) ---
await prompts.run();

// --- auth, request guards, the ✨ enhance surface, and the directory/pin API ---
await auth.run();
await dirsPins.run();

// --- slots, streaming, export, prompt history/log, transcript, brief, ✨ summary ---
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

// --- worktree lanes (Phase A/B/C). Uses a throwaway git repo from FLEET_E2E_REPO ---
if (REPO) {
  const lc: LaneCtx = { lnSlot: 0, lnPath: "" };
  await lanesBasic.run(lc);
  await review.run(ctx);
  // the outbound side of the same predicate — right after the section that establishes it
  await watch.run();
  await lanesLifecycle.run(lc);
  await merge.run(lc);
  await laneRisk.run();
  // the upload surface. In the lane block because its whole point is a property of a WORKTREE
  // (an untracked drop blocks the land), on its own slot and its own branch, and it tears both
  // down again — so it shares no fixture with the sections around it.
  await drops.run();
  await landProvenance.run();
  await concurrency.run();
  await selfToken.run(ctx);
  // the READ half of the trail family — here, not next to trail.run() at the end, because its
  // route checks need a LANE's selfToken alive (ctx.restartSelfTok, which restart.run() tears
  // down) to prove the query reaches the principal the proof order it replaces actually binds.
  await trailstats.run(ctx);
  await refAdvance.run();
  await outcomes.run();
  // what the merge/land path can still say after the process running it was killed. Last in the
  // lane block on purpose: it restarts srv several times, so it must not sit between two sections
  // that share a live fixture — and it runs after outcomes.run() so its terminal rows never land
  // inside another module's ledger reads.
  await landDurability.run();
}

// --- task queue + dispatch gates, intake, the public share host ---
await tasks.run(ctx);
await intake.run(ctx);

// --- file permissions, kill semantics, restart persistence, the audit log ---
await restart.run(ctx);

// --- the guest ops hook: the closed verb set and its owner-only position. Sits next to restart.run
// because it too restarts srv several times (to turn FLEET_GUEST_CMD on and off again), and it
// leaves the server unconfigured, exactly as it found it.
await guest.run();

// --- the verify gate made visible: the suite mutex projected on /api/sessions, and the phases
// lanes report about their own gate runs. Next to guest.run() for the same reason — it too points
// the server at a knob for a few checks (its own private lock dir) and restarts srv back to the
// wrapper's env afterwards, so it must not sit between two sections sharing a live fixture.
await verifyQueue.run();

// --- the deploy facts on the owner's poll. Next to verifyQueue for the same reason: it points the
// server at a fixture repo (FLEET_REPO_DIR) for a few checks and restarts srv back to the
// wrapper's env afterwards, so it must not sit between two sections sharing a live fixture.
await deployFacts.run();

// --- the server's own thrown errors, on the owner's poll. Next to deployFacts for the same
// reason as its neighbours: it restarts srv three times and it briefly breaks two state-write
// paths on purpose, so it must not sit between two sections sharing a live fixture. It repairs
// both and leaves the server on the wrapper's env, exactly as it found it.
await errors.run();

// --- steward principal: scoped token, typed+capped sends, read-only fleet-wide access ---
{
  const sc = await stewardCore.run(ctx);
  await stewardOutcomes.run(sc);
  // --- the security perimeter: the pre-auth route pin, the principal × dangerous-route denial
  // matrix, credential revocation, and secret hygiene. Runs LAST — it needs every principal the
  // suite has minted (guest cookie, lane selfToken, steward token) alive at once.
  await security.run(ctx, sc);
}

// --- the run's own per-check trail. Last on purpose: it compares its row count against every
// check the suite has recorded, so it must see all of them.
await trail.run();

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

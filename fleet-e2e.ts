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
import * as autos from "./e2e/autos";
import * as share from "./e2e/share";
import * as lanesBasic from "./e2e/lanes-basic";
import * as review from "./e2e/review";
import * as lanesLifecycle from "./e2e/lanes-lifecycle";
import * as merge from "./e2e/merge";
import * as laneRisk from "./e2e/lane-risk";
import * as landProvenance from "./e2e/land-provenance";
import * as concurrency from "./e2e/concurrency";
import * as selfToken from "./e2e/self-token";
import * as refAdvance from "./e2e/ref-advance";
import * as outcomes from "./e2e/outcomes";
import * as tasks from "./e2e/tasks";
import * as intake from "./e2e/intake";
import * as restart from "./e2e/restart";
import * as stewardCore from "./e2e/steward-core";
import * as stewardOutcomes from "./e2e/steward-outcomes";

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

// --- scheduled prompts: one-shots, perpetuals, the kill-switch, quiet hours ---
await autos.run(ctx);

// --- session sharing: guests, comments, mode flips, the reopen regression ---
await share.run(ctx);

// --- worktree lanes (Phase A/B/C). Uses a throwaway git repo from FLEET_E2E_REPO ---
if (REPO) {
  const lc: LaneCtx = { lnSlot: 0, lnPath: "" };
  await lanesBasic.run(lc);
  await review.run(ctx);
  await lanesLifecycle.run(lc);
  await merge.run(lc);
  await laneRisk.run();
  await landProvenance.run();
  await concurrency.run();
  await selfToken.run(ctx);
  await refAdvance.run();
  await outcomes.run();
}

// --- task queue + dispatch gates, intake, the public share host ---
await tasks.run(ctx);
await intake.run(ctx);

// --- file permissions, kill semantics, restart persistence, the audit log ---
await restart.run(ctx);

// --- steward principal: scoped token, typed+capped sends, read-only fleet-wide access ---
{
  const sc = await stewardCore.run(ctx);
  await stewardOutcomes.run(sc);
}

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

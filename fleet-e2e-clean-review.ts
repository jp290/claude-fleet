// e2e for the land gate's CHILD PROCESS on the clean path: which environment server.ts#runVerify
// hands the chain, and whether it runs inside the server's suite-mutex hold. Run via
// ./e2e-clean-review.sh — never a live fleet. The server boots with FLEET_CLEAN_REVIEW=off, the value
// watchdog.sh gives production, so the one clean land below takes the production path; the ②
// reviewer's gate and shadow scenarios this file used to drive are gone with that reviewer's
// retirement from production (docs/messungen/2026-10-10-ci-inventur.md, Karte 2). The DEFAULT-OFF
// auto-land itself is proven in the main suite.
// Plumbing — BASE, the owner token read out of the instance's fleet.json, post/get/check, and the
// live-fleet refusal — is e2e/harness.ts; that refusal fires on import and covers the live PORT as
// well as the live socket. The lane spine (seedRepo / openLane / driveMerge) is e2e/lane-helpers.ts,
// shared with fleet-e2e-postland-audit.ts.
// check() in harness.ts is the per-check trail's single emit site, so this suite leaves durable rows
// (docs/e2e-trail.md), stamped FLEET_E2E_SUITE=clean-review by the wrapper.
import { readFileSync } from "node:fs";
import { check, failures, results, srvEnv } from "./e2e/harness";
import { driveMerge, openLane, seedRepo } from "./e2e/lane-helpers";

// throwaway repo the lane forks from
const REPO = `${import.meta.dir}/testrepo`;
await seedRepo(REPO);

// a lane that rebases CLEANLY (its own file → no conflict, the merge agent is never consulted), its
// work committed, its merge driven to a settled verdict: the clean+green path, whose gate run is the
// verify stand-in that records the environment it was handed.
await driveMerge(await openLane(REPO, "alpha"), "alpha");

// WHICH ENVIRONMENT that gate run was handed — the half no local preview of these wrappers
// could see. The land gate's chain boots three fleet servers of its own, so the knobs THIS server
// was configured with are wrong for it; server.ts#auditChildEnv drops every FLEET_* from the
// tier-2 child for that reason, and until 2026-09-05 server.ts#runVerify passed no `env` at all,
// so Bun handed the gate `process.env` whole (watchdog.sh:155 arms FLEET_LANE_AUTOCLOSE=1,
// FLEET_HARNESS_AUTOMATION=1, FLEET_CLEAN_REVIEW, FLEET_DISPATCH_*, and `.env` adds more). The gate
// therefore measured a world no lane running these same three wrappers by hand can reproduce.
//
// Measured HERE because this suite is one of those three wrappers: a land gate re-reads its own
// child environment every time it runs, instead of a rule being asserted about source text alone.
//
// WITH A CONTROL IN THE SAME MEASUREMENT, so an absence can never be read as a null reading. The
// server's own FLEET_CLEAN_REVIEW (the production `off`) is read back off the live srv
// (e2e/harness.ts#srvEnv, names the pane's process and returns only the one assignment), which
// establishes that this server really does carry a FLEET_* knob — and PATH is compared across the
// same dump. A stand-in that never ran leaves no dump and fails the fixture line below under its
// own name, not as a scrub.
const gateEnv = ((): { fleet: string[]; path: string; heldBy: string; lockPid: string } | null => {
  try {
    const raw = readFileSync(`${import.meta.dir}/fakeverify.env`, "utf8").split("\n");
    const line = (k: string): string => (raw.find((l) => l.startsWith(`${k}=`)) ?? "").slice(k.length + 1);
    return { fleet: (raw[0] ?? "").trim().split(/\s+/).filter(Boolean),
      path: line("PATH"), heldBy: line("HELD_BY"), lockPid: line("LOCKPID") };
  } catch { return null; }
})();
const srvCleanReview = await srvEnv("FLEET_CLEAN_REVIEW");
check("gate-env fixture: the verify stand-in recorded the environment it was handed, and this server demonstrably carries a FLEET_* knob of its own",
  gateEnv !== null && srvCleanReview.readable && srvCleanReview.value === "off",
  JSON.stringify({ childFleet: gateEnv?.fleet ?? null, childPathLen: gateEnv?.path.length ?? null,
    srvReadable: srvCleanReview.readable, srvCleanReview: srvCleanReview.value }));

// The suite mutex is the one thing this server and its gate child take part in TOGETHER — the
// server holds the same lock (server.ts#SUITE_LOCK, from FLEET_SUITE_LOCK) and e2e-stage.sh honours
// a handed-over hold only if the pid it names is the one in `$FLEET_SUITE_LOCK/pid`. Those knobs
// ride along by rule; nothing else FLEET_* may. FLEET_SUITE_LOCK_HELD_BY is the third, and it is
// MINTED per spawn rather than carried: it is a fact about THIS process's hold, so an inherited
// value would hand a child a licence to skip a mutex nobody holds for it.
//
// UNTIL M1 (2026-09-06) it could not appear here at all — only the ff-retry chain ever ran a gate
// under a hold, and a gate driven from a merge POST queued for the mutex three times, once per
// wrapper. The clean path now runs its gate under a hold, so its presence is the cut itself and its
// ABSENCE would be the regression. WHOSE hold it is differs by deployment and the check does not
// care: on this box the server takes it; inside a suite THIS wrapper is already holding the machine
// and hands it down (FLEET_SUITE_LOCK_HELD_BY=$$ on the srv line above), so here the pid named is
// the wrapper's. What must hold either way is the shell's own test — the variable is worth nothing
// unless the lock on disk names that same pid — so both halves are read out of the dump.
//
// PATH is compared against THIS RUNNER'S, not re-read off the srv: the runner and the srv are
// siblings out of the same wrapper shell, so the value is one value, and comparing it exactly beats
// re-parsing it out of a process line. It is the dangerous half of the cut — the launchd context
// carries neither ~/.bun/bin nor ~/.local/bin nor brew, so a gate child that loses PATH dies at
// `bun install` on every land this machine attempts.
const GATE_ENV_ALLOWED = new Set(["FLEET_SUITE_LOCK", "FLEET_SUITE_POLL_SEC", "FLEET_SUITE_LOCK_HELD_BY"]);
const gateEnvStrays = (gateEnv?.fleet ?? []).filter((n) => !GATE_ENV_ALLOWED.has(n));
check("the land gate's chain is spawned with the server's FLEET_* scrubbed — and with PATH arriving unchanged",
  gateEnv !== null && gateEnvStrays.length === 0
    && gateEnv.path !== "" && gateEnv.path === (process.env.PATH ?? ""),
  JSON.stringify({ childFleet: gateEnv?.fleet ?? null, strays: gateEnvStrays,
    childPathLen: gateEnv?.path.length ?? null, runnerPathLen: (process.env.PATH ?? "").length,
    pathSame: gateEnv !== null && gateEnv.path === (process.env.PATH ?? "") }));
check("M1: the clean path's gate ran inside a suite-mutex hold — the holder's pid was handed to the chain and the lock on disk names that same pid, which is the only form e2e-stage.sh honours",
  gateEnv !== null && /^\d+$/.test(gateEnv.heldBy) && gateEnv.heldBy === gateEnv.lockPid,
  JSON.stringify({ heldBy: gateEnv?.heldBy ?? null, lockPid: gateEnv?.lockPid ?? null }));

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

// The suite is ONE sequential run against one server, so a handful of fixtures genuinely
// outlive the section that creates them (a share checked again after a restart, the lane whose
// selfToken must survive a redeploy, the throwaway repo the deploy-gap facts are measured
// against). This is that carry-over, made explicit: every module states what it needs and what
// it hands on, instead of the implicit top-level scope the single-file suite relied on.
export interface Ctx {
  // --- session sharing (share.ts → review.ts, intake.ts, restart.ts) ---
  shViewId: string;
  shCookie: string;
  shIntId: string;
  shICookie: string;
  // re-created after the revoke in intake.ts, re-authed after the restart
  shPersistId: string;

  // --- scheduled prompts whose survival across the restart is the point (autos.ts → restart.ts) ---
  aPersistId: string;
  aPerpPersistId: string;

  // --- the lane kept alive across the restart to prove its selfToken persists
  // (self-token.ts → tasks.ts, restart.ts) ---
  restartSelfTok: string | null;
  restartSelfSlot: number;

  // --- restart.ts → steward-core.ts ---
  // the env line both srv respawns are built from, and the deploy-gap repo they are pointed at
  cmdEnv: string;
  gapEnv: string;
  gapRepo: string;
  auditPath: string;
  // the uuid planted through the state file + the transcript written for it, read back as the
  // context-size proxy in the steward section
  plantedTranscript: string | null;
  plantedTranscriptBytes: number;
  // ...and the model planted on that same slot: deliberately NOT the fleet default (no [1m]
  // suffix), so the context-FILL check has a 200k denominator to divide by and a hardcoded 1M
  // one cannot pass by accident.
  plantedModel: string;
}

export const newCtx = (): Ctx => ({
  shViewId: "", shCookie: "", shIntId: "", shICookie: "", shPersistId: "",
  aPersistId: "", aPerpPersistId: "",
  restartSelfTok: null, restartSelfSlot: 0,
  cmdEnv: "", gapEnv: "", gapRepo: "", auditPath: "",
  plantedTranscript: null, plantedTranscriptBytes: 0, plantedModel: "",
});

// Fixtures that only cross module boundaries INSIDE the worktree-lane run (lanes/*.ts).
export interface LaneCtx {
  // the one-click lane opened in lanes-basic.ts and driven through the merge paths
  lnSlot: number;
  lnPath: string;
}

// Fixtures that cross the two halves of the steward section.
export interface StewardCtx {
  token: string;
  stewGet: (path: string) => Promise<Response>;
  stewPost: (path: string, body: unknown) => Promise<Response>;
  slot: number;
  cwd: string;
  settleForSteward: (slot: number) => Promise<void>;
}

// --- Sharding: the smallest sets of modules that must share ONE process and ONE server ---------
// (`bun fleet-e2e.ts --shard k/n`, or FLEET_E2E_SHARD=k/n through e2e-isolated.sh, whose runner
// line passes no argv; probe and numbers: docs/messungen/2026-09-14-suite-sharding-probe.md.)
//
// A UNIT is a set of modules with a fixture crossing their boundary, of one of three kinds:
//   · a Ctx/LaneCtx/StewardCtx field above (share.ts → review.ts, self-token.ts → programs.ts …);
//   · SERVER STATE one module plants and a later one reads without re-creating it — slots 1+2 are
//     opened once in slots.ts (`/api/slots/1/open`, `/api/slots/2/open`) and read by history,
//     summary, transport, autos, share and intake until restart.ts kills them (its "kill
//     semantics" section), which is why `core` carries the slots family too; and outcomes.ts leaves
//     the Program of its restart probe CONFIRMED, which tasks.ts reuses (its comment says so) — the
//     first `--shard` run found that edge: 3 FAILs + a TypeError at tasks.ts, run 2026-09-13 21:57;
//   · a return value handed on in the runner (stewardCore.run → stewardOutcomes/security).
// Everything else opens and kills its own slots and lanes (each module's header says so) and is a
// unit of its own. `seconds` is the measured SERIAL duration of the unit's modules in the reference
// trail isolated-20260913T155454Z-52907 (4 384 checks, 2 619 s, tree before 67c36fc8). It decides
// the BALANCE only — a wrong weight makes a shard slow, never wrong. Order here is irrelevant to
// execution: the runner keeps its own module order and merely skips units not in the shard.
//
// ONE MODULE IN TWO UNITS: self-token. Its only hand-on is ctx.restartSelfTok/restartSelfSlot — a
// lane it opens and keeps alive — and programs.ts is the one reader outside `core`'s chain. So
// `programs` carries its own self-token run instead of dragging `core` along: a shard holding both
// units runs it once (the runner tags that step with both), two shards run it twice, 23 s and the
// same check names. `core` and `programs` are weighted from the serial shard 1b/1c measurements
// (docs/messungen/2026-09-14-suite-sharding-probe.md §6: programs 613 s, self-token 23 s, core
// 1 239 s with programs), not from the reference trail — the trail never split them.
export interface ShardUnit { unit: string; seconds: number; modules: readonly string[] }
export const SHARD_UNITS: readonly ShardUnit[] = [
  { unit: "pure", seconds: 0, modules: ["context-plan", "prompts", "briefstats"] },
  { unit: "context-packs", seconds: 30, modules: ["context-packs"] },
  { unit: "auth", seconds: 1, modules: ["auth", "dirs-pins"] },
  { unit: "core", seconds: 626, modules: ["slots", "history", "summary", "transport", "autos", "share",
    "review", "self-token", "trailstats", "outcomes", "tasks", "intake", "restart", "steward-core",
    "steward-outcomes", "security"] },
  { unit: "programs", seconds: 636, modules: ["self-token", "programs"] },
  { unit: "lanes", seconds: 375, modules: ["lanes-basic", "lanes-lifecycle", "merge"] },
  { unit: "watch", seconds: 224, modules: ["watch"] },
  { unit: "attention", seconds: 19, modules: ["attention"] },
  { unit: "lane-risk", seconds: 16, modules: ["lane-risk"] },
  { unit: "explorer", seconds: 2, modules: ["explorer"] },
  { unit: "drops", seconds: 2, modules: ["drops"] },
  { unit: "land-provenance", seconds: 143, modules: ["land-provenance"] },
  { unit: "ctl", seconds: 16, modules: ["ctl"] },
  { unit: "concurrency", seconds: 13, modules: ["concurrency"] },
  { unit: "lane-suite", seconds: 5, modules: ["lane-suite"] },
  { unit: "supervisor", seconds: 47, modules: ["supervisor"] },
  { unit: "ref-advance", seconds: 5, modules: ["ref-advance"] },
  { unit: "land-durability", seconds: 98, modules: ["land-durability"] },
  { unit: "sweep", seconds: 1, modules: ["sweep"] },
  { unit: "verify-queue", seconds: 97, modules: ["verify-queue"] },
  { unit: "deploy-facts", seconds: 88, modules: ["deploy-facts"] },
  { unit: "errors", seconds: 6, modules: ["errors"] },
  { unit: "host-hygiene", seconds: 40, modules: ["host-hygiene"] },
  { unit: "state-snapshot", seconds: 12, modules: ["state-snapshot"] },
];

// `k/n`, 1 ≤ k ≤ n. Anything else is null — the caller decides whether that is "no flag" or an error.
export const parseShard = (raw: string | undefined): { k: number; n: number } | null => {
  const m = /^(\d+)\/(\d+)$/.exec((raw ?? "").trim());
  if (!m) return null;
  const k = Number(m[1]); const n = Number(m[2]);
  return n >= 1 && k >= 1 && k <= n ? { k, n } : null;
};

// Longest-processing-time first: heaviest unit to the emptiest shard, ties to the lower shard
// index. Deterministic for a given table and n, so every shard computes the same plan on its own.
export const shardPlan = (n: number): Map<string, number> => {
  const load = Array.from({ length: n }, () => 0);
  const plan = new Map<string, number>();
  const byWeight = SHARD_UNITS.map((u, i) => ({ u, i })).sort((a, b) => b.u.seconds - a.u.seconds || a.i - b.i);
  for (const { u } of byWeight) {
    let best = 0;
    for (let s = 1; s < n; s++) if (load[s]! < load[best]!) best = s;
    load[best] = load[best]! + u.seconds;
    plan.set(u.unit, best + 1);
  }
  return plan;
};

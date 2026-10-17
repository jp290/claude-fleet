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
//     first `--shard` run found that edge: 3 FAILs + a TypeError at tasks.ts, run 2026-09-13 21:57 —
//     which is why outcomes and tasks form a unit of their own, `core-tasks`, below;
//   · a return value handed on in the runner (stewardCore.run → stewardOutcomes/security);
//   · server state a module must find ABSENT, restored by a module between it and the one that
//     planted it: land-provenance.ts's "tier 2 default OFF" checks read the post-land-audit ledger
//     as empty, watch.ts and delivery-class.ts append rows to it, and merge.ts deletes it. So
//     land-provenance rides in `lanes`, behind merge — the first plan that put it behind watch
//     without merge (shard 3/3, preview 5f0f615ff53c, 2026-10-10) failed exactly those two checks.
// Everything else opens and kills its own slots and lanes (each module's header says so) and is a
// unit of its own. `seconds` is the Workhorse median of the `shard-unit <unit> <ms>` lines in the
// last 60 retained helper suite logs (2026-10-09 09:53 – 2026-10-10 01:53, 14–18 lines per unit,
// 4 333 s serial over all units). It decides the BALANCE only — a wrong weight makes a shard slow,
// never wrong. Order here is irrelevant to execution: the runner keeps its own module order and
// merely skips units not in the shard.
//
// ONE MODULE IN THREE UNITS: self-token. Its only hand-on is ctx.restartSelfTok/restartSelfSlot — a
// lane it opens and keeps alive. restart.ts reads it inside `core`; programs.ts and
// tasks.ts read it from outside. So `programs` and `core-tasks` each carry their own self-token run
// instead of dragging `core` along: a shard holding several of these units runs it once (the runner
// tags that step with all three), separate shards run it once each, ~67 s and the same check names.
//
// `core-tasks` (2026-10-10): `core` measured 1 970 s against the 626 s this table carried and was
// the long path of every run — its shard ran into the helper's 2 700 s claim window twice on
// 2026-10-09/10. outcomes and tasks are the part of it whose fixtures can travel: outcomes plants
// the CONFIRMED Program tasks reuses, self-token runs again for the lane token, and tasks plants its
// own Share when share.ts did not run. The rest of `core` stays one unit: restart.ts reads share,
// autos, intake and self-token and plants the world steward-core reads, and review.ts reads share's
// cookies. The two weights are their first sharded measurement (preview 5f0f615ff53c, shards 1/3
// and 2/3, 2026-10-10 03:0x): core 1 586 s, core-tasks 674 s; `lanes` is its median plus
// land-provenance's.
//
// `dom` (2026-10-10, first step of Z1 — docs/messungen/2026-10-10-verifikation-neu-zugeschnitten.md):
// every check that starts a browser, out of slots (core), lanes-lifecycle (lanes), drops and the
// former unit timeline-ui, so a run can leave the browser out by its unit or module choice. No
// fixture crosses its boundary: its one instance probe opens and kills its own slots and lanes.
// The weights of dom, core, lanes and drops are their first sharded measurement on the Workhorse
// (preview a4297f006a38, three co-resident shards, 2026-10-10 08:2x–09:0x): dom 1 092 s, core 701 s
// (1 586 s with the probes), lanes 617 s (681 s), drops 3 s (11 s); timeline-ui's 114 s are in dom.
export interface ShardUnit { unit: string; seconds: number; modules: readonly string[] }
export const SHARD_UNITS: readonly ShardUnit[] = [
  { unit: "pure", seconds: 1, modules: ["context-plan", "model-scan", "api-stall", "prompts"] },
  { unit: "context-packs", seconds: 14, modules: ["context-packs"] },
  { unit: "tmux-locale", seconds: 2, modules: ["tmux-locale"] },
  { unit: "bytes", seconds: 2, modules: ["bytes"] },
  { unit: "auth", seconds: 1, modules: ["auth", "dirs-pins"] },
  { unit: "core", seconds: 701, modules: ["slots", "history", "summary", "transport", "autos", "share",
    "review", "self-token", "intake", "restart", "steward-core", "steward-outcomes", "security"] },
  { unit: "core-tasks", seconds: 674, modules: ["self-token", "outcomes", "tasks"] },
  { unit: "programs", seconds: 653, modules: ["self-token", "programs"] },
  { unit: "lanes", seconds: 617, modules: ["lanes-basic", "lanes-lifecycle", "merge", "land-provenance"] },
  { unit: "watch", seconds: 421, modules: ["watch", "delivery-class"] },
  { unit: "attention", seconds: 25, modules: ["attention"] },
  { unit: "lane-risk", seconds: 1, modules: ["lane-risk"] },
  { unit: "explorer", seconds: 1, modules: ["explorer"] },
  { unit: "drops", seconds: 3, modules: ["drops"] },
  { unit: "dom", seconds: 1092, modules: ["dom"] },
  { unit: "ctl", seconds: 54, modules: ["ctl"] },
  { unit: "concurrency", seconds: 5, modules: ["concurrency"] },
  { unit: "lane-suite", seconds: 43, modules: ["lane-suite"] },
  { unit: "verify-rules", seconds: 1, modules: ["verify-rules"] },
  { unit: "ref-advance", seconds: 1, modules: ["ref-advance"] },
  { unit: "land-durability", seconds: 45, modules: ["land-durability"] },
  { unit: "sweep", seconds: 0, modules: ["sweep"] },
  { unit: "verify-queue", seconds: 31, modules: ["verify-queue"] },
  { unit: "deploy-facts", seconds: 36, modules: ["deploy-facts"] },
  { unit: "errors", seconds: 5, modules: ["errors"] },
  { unit: "host-hygiene", seconds: 54, modules: ["host-hygiene"] },
  { unit: "state-snapshot", seconds: 8, modules: ["state-snapshot"] },
  { unit: "trace", seconds: 2, modules: ["trace"] },
  { unit: "konzepte", seconds: 93, modules: ["konzepte"] },
  { unit: "role-address", seconds: 3, modules: ["role-address"] },
  { unit: "stuck-delivery", seconds: 39, modules: ["stuck-delivery"] },
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
// `skip` takes units OUT OF THE TABLE before the plan is made (FLEET_E2E_SKIP_UNITS, see
// selectSkipUnits below), so the plan of a skipping run is the plan of the smaller table — every
// shard still computes it alone, and no shard holds a skipped unit. Without `skip` (or with an
// empty one) the plan is the one this function always made, byte for byte; e2e/pins.ts holds both.
export const shardPlan = (n: number, skip?: ReadonlySet<string>): Map<string, number> => {
  const load = Array.from({ length: n }, () => 0);
  const plan = new Map<string, number>();
  const byWeight = SHARD_UNITS.map((u, i) => ({ u, i })).filter(({ u }) => !skip?.has(u.unit))
    .sort((a, b) => b.u.seconds - a.u.seconds || a.i - b.i);
  for (const { u } of byWeight) {
    let best = 0;
    for (let s = 1; s < n; s++) if (load[s]! < load[best]!) best = s;
    load[best] = load[best]! + u.seconds;
    plan.set(u.unit, best + 1);
  }
  return plan;
};

// THE UNIT SKIP, decided in one pure place like suite-modules.ts#selectModules: no skip, a set of
// units to leave out, or a refusal in words. FLEET_E2E_SKIP_UNITS=dom is what a `quiet` or `deploy`
// audit run carries (the helper daemon sets it from the claim, helper-daemon/daemon.ts#auditScopeEnv)
// so the browser unit stays for the `nightly` run. It CUTS THE TABLE, not the run: combined with a
// shard, every shard plans over SHARD_UNITS minus the skip (shardPlan above); alone, the run is every
// unit but the skipped ones. Each refusal is a case where running anyway would answer a different
// question than the one asked, so none of them falls back to a smaller or a full run — the caller stops:
//   · a value that names nothing (`,,`);
//   · together with --modules — a selection is a subset already, and nobody has measured the two at
//     once (the same words the shard+modules refusal uses);
//   · a name that is no unit of SHARD_UNITS — a typo would otherwise skip nothing and run the unit;
//   · a skip of every unit, which would be a green over no work at all.
// `raw` undefined (or empty, which the runner folds into undefined) is "no skip", byte for byte.
export const selectSkipUnits = (opts: { raw: string | undefined; modulesGiven: boolean }):
  { skip: ReadonlySet<string> | null; refusal: string | null } => {
  if (opts.raw === undefined) return { skip: null, refusal: null };
  const names = [...new Set(opts.raw.split(",").map((s) => s.trim()).filter(Boolean))];
  if (!names.length)
    return { skip: null, refusal: `FLEET_E2E_SKIP_UNITS wants a comma-separated list of shard units, got '${opts.raw}'` };
  if (opts.modulesGiven)
    return { skip: null, refusal: "FLEET_E2E_SKIP_UNITS and --modules together is a selection nobody has measured — use one" };
  const known = new Set(SHARD_UNITS.map((u) => u.unit));
  const unknown = names.filter((u) => !known.has(u));
  if (unknown.length)
    return { skip: null, refusal: `FLEET_E2E_SKIP_UNITS names no unit of e2e/ctx.ts#SHARD_UNITS: ${unknown.join(", ")}`
      + ` — known: ${[...known].join(" ")}` };
  if (names.length === known.size)
    return { skip: null, refusal: "FLEET_E2E_SKIP_UNITS skips every unit — a run of nothing is refused, never reported green" };
  return { skip: new Set(names), refusal: null };
};

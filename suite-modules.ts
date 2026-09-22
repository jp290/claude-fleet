// WHICH CHECK MODULES A LANE MAY PREVIEW ALONE — the fixture map behind FLEET_E2E_MODULES.
//
// `./e2e-isolated.sh` is one sequential session against one server, and the modules in it are not
// independent: a handful of fixtures outlive the module that creates them (e2e/ctx.ts says which,
// and why). `--shard k/n` already cuts the suite along those seams, but only at UNIT granularity —
// and the heaviest unit, `core`, is sixteen modules and 626 s of a 2 120 s suite
// (docs/messungen/2026-09-14-suite-sharding-probe.md §5), so a lane that touched e2e/tasks.ts has
// no way to see its own family answer without paying for the other fifteen.
//
// This file is the seam one level finer: per MODULE, what it READS that another module WROTE, and
// what it WRITES that a later one reads. `modulePlanFor(["slots", "tasks"])` returns the transitive
// closure over those edges — the smallest set that still MEETS THE WORLD each selected module was
// written against — plus, for every module left out, the reason it was left out. Nothing is ever
// silently dropped: an unknown module name is refused, and the runner prints the whole plan.
//
// THREE LIMITS, and they are why a filtered run is a PREVIEW and never a gate:
//   1. The edges below are DERIVED (the Ctx/LaneCtx/StewardCtx halves mechanically, from the
//      modules' own sources — e2e/pins.ts re-derives them and fails on drift; the server-state half
//      from the measured couplings in the sharding probe). Derived is not measured: the probe
//      proved unit-level independence, never module-level independence INSIDE a unit.
//   2. A fixture is something a module PRODUCES. The absence of state is not modelled — a check
//      that needs a slot to be GONE (restart.ts kills slots 1-3) can see one that is still open.
//   3. A filtered green says only that the checks that RAN passed — and a filtered RED alone does
//      not distinguish a product failure from missing setup, because a fixture a skipped module
//      would have planted is indistinguishable, from inside the run, from a broken product. That is
//      the evidence limit. What anyone is OBLIGED to do about it is not this file's to set: no rule
//      here, only the limit (docs/verify-tiering.md §16a).
// The land gate and the post-land audit therefore never set FLEET_E2E_MODULES, and e2e/pins.ts
// holds them to it.
//
// WHY THIS LIVES AT THE ROOT, imported by both halves: the gate's advisory
// (`verify-proportion.ts` → `localProof.modules`) and the runner's own filter must be ONE table, or
// a lane would be recommended a selection the runner resolves differently. It imports nothing, so
// it costs the server nothing but its own lines.

export type FixtureOrigin = "ctx" | "lane-ctx" | "steward-ctx" | "server-state";

export interface Fixture {
  name: string;
  origin: FixtureOrigin;
  /** what it is — and for a server-state fixture, what makes it an edge at all */
  what: string;
  /**
   * How the RUNNER can plant this itself before the first step, so a reader of it does not drag its
   * writer along. Absent means only the writing module can produce it. The one synthesizable pair
   * is the shard base fixture, which has run green as such since 2026-09-13 (K2/K4 below).
   */
  synthesized?: string;
}

// Every name a `reads`/`writes` entry below may use. A closed list: an edge naming a fixture that
// is not here is a typo that would quietly pull nothing, and e2e/pins.ts fails on it.
export const FIXTURES: readonly Fixture[] = [
  // --- Ctx: the carry-over the single-file suite kept in top-level scope (e2e/ctx.ts#Ctx) --------
  { name: "ctx.shViewId", origin: "ctx", what: "the view-mode share created on slot 2" },
  { name: "ctx.shCookie", origin: "ctx", what: "the guest cookie authenticated against that share" },
  { name: "ctx.shIntId", origin: "ctx", what: "the interact-mode share created on slot 1" },
  { name: "ctx.shICookie", origin: "ctx", what: "the guest cookie of the interact share — the suite's guest principal" },
  { name: "ctx.shPersistId", origin: "ctx", what: "the share re-created after the revoke, whose survival across the restart is the point" },
  { name: "ctx.aPersistId", origin: "ctx", what: "the one-shot scheduled prompt that must survive the restart" },
  { name: "ctx.aPerpPersistId", origin: "ctx", what: "the perpetual scheduled prompt that must survive the restart" },
  { name: "ctx.restartSelfTok", origin: "ctx", what: "the self token of a lane kept alive across the restart" },
  { name: "ctx.restartSelfSlot", origin: "ctx", what: "that lane's slot — every cleanup sweep has to spare it" },
  { name: "ctx.cmdEnv", origin: "ctx", what: "the env line both srv respawns are built from (written; nothing outside restart.ts reads it)" },
  { name: "ctx.gapEnv", origin: "ctx", what: "the env line pointing the server at the deploy-gap repo (written; nothing outside restart.ts reads it)" },
  { name: "ctx.gapRepo", origin: "ctx", what: "the throwaway repo the deploy-gap facts are measured against" },
  { name: "ctx.auditPath", origin: "ctx", what: "the audit log of the restarted server" },
  { name: "ctx.plantedTranscript", origin: "ctx", what: "the transcript planted through the state file, read back as the context-size proxy" },
  { name: "ctx.plantedTranscriptBytes", origin: "ctx", what: "its size, as the planter measured it" },
  { name: "ctx.plantedModel", origin: "ctx", what: "the deliberately non-default model on that slot, so the context-FILL check has a 200k denominator" },

  // --- LaneCtx: fixtures that only cross boundaries inside the worktree-lane block ---------------
  { name: "lc.lnSlot", origin: "lane-ctx", what: "the one-click lane's slot, driven through the merge paths" },
  { name: "lc.lnPath", origin: "lane-ctx", what: "that lane's worktree path on disk" },

  // --- StewardCtx: a RETURN VALUE handed on in the runner, not a field anyone assigns ------------
  { name: "sc.token", origin: "steward-ctx", what: "the steward principal's scoped token" },
  { name: "sc.stewGet", origin: "steward-ctx", what: "a GET bound to that token" },
  { name: "sc.stewPost", origin: "steward-ctx", what: "a POST bound to that token" },
  { name: "sc.slot", origin: "steward-ctx", what: "the steward session's slot" },
  { name: "sc.cwd", origin: "steward-ctx", what: "its cwd" },
  { name: "sc.settleForSteward", origin: "steward-ctx", what: "the idle-settle helper its typed sends need" },

  // --- SERVER STATE: no field carries these, so they are hand-declared, each with its measurement.
  // The couplings and their signatures: docs/messungen/2026-09-14-suite-sharding-probe.md §6 (K1-K5)
  {
    name: "server:slots-1-2-open", origin: "server-state",
    what: "slot 1 (cwd ~/claude-fleet) and slot 2 (cwd ~) OPEN — slot 2 is the non-worktree negative "
      + "control four lane families measure against (`/api/slots/2/diff|land|shelve|risk|commit|merge` → 400)",
    synthesized: "the runner opens both before the first step with slots.ts's own two calls — the "
      + "shard base fixture, green since 2026-09-13 (K2: `--shard 2/4` failed `shelve rejects a "
      + "non-worktree slot` without it; K4: supervisor needs any slot carrying a self credential)",
  },
  {
    name: "server:slots-1-2-driven", origin: "server-state",
    what: "what slots.ts DOES to those two slots beyond opening them: prompt history and log, "
      + "transcript, brief, the summary cache, an attached pane the ws.send half can reach",
    // deliberately NOT synthesizable: the base fixture opens two slots, and nobody has measured
    // that opening them is enough for these six readers. Conservative by choice — the cost of the
    // conservatism is that a filter naming one of them also runs slots (~1 min), and the cost of
    // the alternative is a green that was never earned.
  },
  {
    name: "server:program-confirmed", origin: "server-state",
    what: "a Program left in the CONFIRMED state by outcomes.ts's restart probe, which tasks.ts "
      + "reuses instead of minting its own (its own comment says so)",
    // K1, the first --shard run's own finding: 3 FAILs + a TypeError in tasks.ts, 2026-09-13 21:57.
  },
  {
    name: "server:srv-env-after-restart", origin: "server-state",
    what: "srv respawned from restart.ts's own env line — the one that carries "
      + "FLEET_STEWARD_MIN_IDLE_MS, without which the server gates 60 s while the steward probe waits 800 ms",
    // K5: 5 FAILs in steward-core, root `typed send … {"error":"target slot not idle"}`, in two of
    // two shard runs while 736 full runs were green — an order accident, never a contract.
  },
];

export interface ModuleFixtures {
  module: string;
  /** fixtures this module needs somebody else to have produced */
  reads?: readonly string[];
  /** fixtures a later module reads from it */
  writes?: readonly string[];
  /** a module of the runner's worktree-lane block: it needs FLEET_E2E_REPO and is skipped without it */
  lane?: true;
}

// EVERY MODULE THE RUNNER BOOTS, IN THE ORDER IT BOOTS THEM — that order is the printed plan's
// order, and e2e/pins.ts checks both the membership and the order against fleet-e2e.ts itself.
// A module with no edges is a module that opens and kills its own slots and lanes; its own header
// says so, and that is what makes it previewable alone.
export const MODULE_FIXTURES: readonly ModuleFixtures[] = [
  { module: "context-packs" },
  { module: "context-plan" },
  { module: "prompts" },
  { module: "briefstats" },
  { module: "auth" },
  { module: "dirs-pins" },
  { module: "slots", writes: ["server:slots-1-2-open", "server:slots-1-2-driven"] },
  { module: "history", reads: ["server:slots-1-2-driven"] },
  { module: "summary", reads: ["server:slots-1-2-driven"] },
  { module: "transport", reads: ["server:slots-1-2-driven"] },
  { module: "autos", reads: ["server:slots-1-2-driven"], writes: ["ctx.aPersistId", "ctx.aPerpPersistId"] },
  { module: "share", reads: ["server:slots-1-2-driven"],
    writes: ["ctx.shViewId", "ctx.shCookie", "ctx.shIntId", "ctx.shICookie"] },
  { module: "lanes-basic", lane: true, reads: ["server:slots-1-2-open"], writes: ["lc.lnSlot", "lc.lnPath"] },
  { module: "review", lane: true, reads: ["ctx.shIntId", "ctx.shICookie"] },
  { module: "watch", lane: true },
  { module: "attention", lane: true },
  { module: "lanes-lifecycle", lane: true, reads: ["lc.lnSlot", "lc.lnPath", "server:slots-1-2-open"] },
  { module: "merge", lane: true, reads: ["lc.lnSlot", "lc.lnPath", "server:slots-1-2-open"] },
  { module: "lane-risk", lane: true, reads: ["server:slots-1-2-open"] },
  { module: "explorer", lane: true },
  { module: "drops", lane: true },
  { module: "land-provenance", lane: true },
  { module: "ctl", lane: true },
  { module: "concurrency", lane: true },
  { module: "self-token", lane: true, reads: ["server:slots-1-2-open"],
    writes: ["ctx.restartSelfTok", "ctx.restartSelfSlot"] },
  { module: "lane-suite", lane: true },
  { module: "programs", lane: true, reads: ["ctx.restartSelfTok", "ctx.restartSelfSlot"] },
  { module: "supervisor", lane: true, reads: ["server:slots-1-2-open"] },
  { module: "trailstats", lane: true, reads: ["ctx.restartSelfTok"] },
  { module: "ref-advance", lane: true },
  { module: "outcomes", lane: true, writes: ["server:program-confirmed"] },
  { module: "land-durability", lane: true },
  { module: "tasks", reads: ["ctx.restartSelfTok", "ctx.restartSelfSlot", "server:program-confirmed"] },
  { module: "intake", reads: ["ctx.shViewId", "ctx.shCookie", "server:slots-1-2-driven"],
    writes: ["ctx.shPersistId"] },
  { module: "sweep" },
  { module: "restart",
    reads: ["ctx.shIntId", "ctx.shICookie", "ctx.shPersistId", "ctx.aPersistId", "ctx.aPerpPersistId",
      "ctx.restartSelfTok", "ctx.restartSelfSlot", "server:slots-1-2-driven"],
    writes: ["ctx.cmdEnv", "ctx.gapEnv", "ctx.gapRepo", "ctx.auditPath", "ctx.plantedTranscript",
      "ctx.plantedTranscriptBytes", "ctx.plantedModel", "server:srv-env-after-restart"] },
  { module: "verify-queue" },
  { module: "deploy-facts" },
  { module: "errors" },
  { module: "host-hygiene" },
  { module: "state-snapshot" },
  { module: "steward-core",
    reads: ["ctx.gapRepo", "ctx.auditPath", "ctx.plantedTranscript", "ctx.plantedTranscriptBytes",
      "ctx.plantedModel", "server:srv-env-after-restart"],
    writes: ["sc.token", "sc.stewGet", "sc.stewPost", "sc.slot", "sc.cwd", "sc.settleForSteward"] },
  { module: "steward-outcomes", reads: ["sc.stewGet", "sc.stewPost", "sc.slot", "sc.settleForSteward"] },
  { module: "security", reads: ["ctx.shICookie", "ctx.auditPath", "sc.token", "sc.stewGet"] },
];

const byModule = new Map(MODULE_FIXTURES.map((m) => [m.module, m]));
const fixtureByName = new Map(FIXTURES.map((f) => [f.name, f]));
const writersOf = (fixture: string): string[] =>
  MODULE_FIXTURES.filter((m) => (m.writes ?? []).includes(fixture)).map((m) => m.module);

/** The module a changed file belongs to, or null when the path is not a runner check module. */
const moduleForPath = (path: string): string | null => {
  const m = /^e2e\/([\w-]+)\.ts$/.exec(path);
  return m && byModule.has(m[1]!) ? m[1]! : null;
};

/**
 * The modules a committed footprint is ABOUT — and null for "no honest narrowing", which is the
 * answer for every footprint that is not entirely check modules. One file the map cannot place
 * (server.ts, a wrapper, e2e/harness.ts, the runner itself) can change what any module measures, so
 * it takes the whole suite with it rather than narrowing to the modules beside it. In table order.
 */
export const modulesForPaths = (paths: readonly string[]): string[] | null => {
  if (paths.length === 0) return null;
  const named = new Set<string>();
  for (const p of paths) {
    const mod = moduleForPath(p);
    if (!mod) return null;
    named.add(mod);
  }
  return MODULE_FIXTURES.filter((m) => named.has(m.module)).map((m) => m.module);
};

export interface ModulePlan {
  /** the modules to run, in the runner's own order */
  run: string[];
  /** what the caller asked for, in that same order */
  named: string[];
  /** what the closure added, each with the edge that added it */
  pulled: { module: string; why: string }[];
  /** every module NOT run, each with the reason — the runner prints these, one line apiece */
  skipped: { module: string; why: string }[];
  /** fixtures the runner must plant itself because a reader of one is running and its writer is not */
  planted: { fixture: string; how: string }[];
  /** names that are no module of this suite — the caller REFUSES on these, never runs a subset */
  unknown: string[];
  /**
   * A read this map cannot satisfy: the fixture has no writer and no synthesis. e2e/pins.ts fails
   * on the table that would produce one, so this is empty in a landed tree — it is here so that a
   * caller refuses out loud instead of running a selection whose world nobody plants.
   */
  unresolved: { module: string; fixture: string }[];
}

/**
 * The transitive closure of `named` over the read/write edges above. Fixed point, so a pulled
 * module's own reads pull too (tasks → self-token, and self-token's own reads after it).
 *
 * A read whose fixture the runner can synthesize does NOT pull its writer; it is reported in
 * `planted` instead, and the runner plants it before the first step.
 */
export const modulePlanFor = (named: readonly string[]): ModulePlan => {
  const unknown = named.filter((n) => !byModule.has(n));
  const run = new Set(named.filter((n) => byModule.has(n)));
  const pulledWhy = new Map<string, string>();
  const planted = new Map<string, string>();
  const unresolved: { module: string; fixture: string }[] = [];

  for (let grew = true; grew;) {
    grew = false;
    for (const mod of [...run]) {
      for (const fixture of byModule.get(mod)!.reads ?? []) {
        const writers = writersOf(fixture);
        if (writers.some((w) => run.has(w))) continue; // already covered by a running writer
        const synthesized = fixtureByName.get(fixture)?.synthesized;
        if (synthesized !== undefined) { planted.set(fixture, synthesized); continue; }
        if (writers.length === 0) {
          if (!unresolved.some((u) => u.module === mod && u.fixture === fixture))
            unresolved.push({ module: mod, fixture });
          continue;
        }
        for (const writer of writers) {
          run.add(writer);
          pulledWhy.set(writer, `${mod} reads ${fixture}, which only ${writer} writes`);
          grew = true;
        }
      }
    }
  }

  const order = MODULE_FIXTURES.map((m) => m.module);
  const inOrder = (xs: Iterable<string>): string[] => {
    const set = new Set(xs);
    return order.filter((m) => set.has(m));
  };
  return {
    run: inOrder(run),
    named: inOrder(named.filter((n) => byModule.has(n))),
    pulled: inOrder(pulledWhy.keys()).map((m) => ({ module: m, why: pulledWhy.get(m)! })),
    skipped: order.filter((m) => !run.has(m)).map((m) => ({
      module: m,
      why: "not named, and no running module reads a fixture it writes",
    })),
    planted: [...planted].map(([fixture, how]) => ({ fixture, how })),
    unknown,
    unresolved,
  };
};

/**
 * `a,b,c` → the names, whitespace and empty entries dropped. null for "nothing selected" — which
 * for an UNSET variable means "no filter" and for a value like `,,` means a filter that selects
 * nothing, and those two must not be confused: `selectModules` below separates them.
 */
const parseModules = (raw: string | undefined): string[] | null => {
  const names = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return names.length ? [...new Set(names)] : null;
};

/**
 * THE WHOLE DECISION, in one pure place: no filter, a plan, or a refusal in words. Every refusal is
 * a case where running a SUBSET would be a green over work nobody did, so none of them falls back
 * to "then run everything" either — the caller stops.
 *
 * `raw` is the flag or env value (`undefined` = not given at all). `shardGiven` and `repoSet` are
 * the two facts about the run that can invalidate an otherwise fine selection.
 */
export const selectModules = (opts: { raw: string | undefined; shardGiven: boolean; repoSet: boolean }):
  { plan: ModulePlan | null; refusal: string | null } => {
  if (opts.raw === undefined) return { plan: null, refusal: null };
  const named = parseModules(opts.raw);
  if (!named)
    return { plan: null, refusal: `--modules wants a comma-separated list of check modules, got '${opts.raw}'` };
  // One cut at a time. A shard is a partition of the WHOLE suite and a selection is a subset of it;
  // intersecting them can produce an empty run, or a shard whose base fixture no longer matches
  // what it holds — and nobody has measured either.
  if (opts.shardGiven)
    return { plan: null, refusal: "--shard and --modules together is a selection nobody has measured — use one" };
  const plan = modulePlanFor(named);
  if (plan.unknown.length)
    return { plan: null, refusal: `--modules names no check module of this suite: ${plan.unknown.join(", ")}`
      + ` — known: ${MODULE_FIXTURES.map((m) => m.module).join(" ")}` };
  // A read nothing can satisfy. e2e/pins.ts fails stage 1 on the table that would produce one, so
  // this is the refusal that never fires in a landed tree and is here for the tree that is not.
  if (plan.unresolved.length)
    return { plan: null, refusal: "suite-modules.ts has a read with no writer and no synthesis: "
      + plan.unresolved.map((u) => `${u.module} reads ${u.fixture}`).join(", ") };
  // The lane block needs FLEET_E2E_REPO. Without it the unfiltered run skips those steps and keeps
  // going (it always has), but a SELECTION that names or pulls one would run its neighbours against
  // a world its lane modules never built — so it is refused, by name.
  if (!opts.repoSet) {
    const blocked = plan.run.filter((m) => byModule.get(m)?.lane);
    if (blocked.length)
      return { plan: null, refusal: "FLEET_E2E_REPO is unset, so the worktree-lane block cannot run,"
        + ` and this selection needs it: ${blocked.join(" ")}` };
  }
  return { plan, refusal: null };
};

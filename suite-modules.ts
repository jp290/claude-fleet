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
      + "non-worktree slot` without it)",
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
    name: "server:share-persisted", origin: "server-state",
    what: "at least one Share persisted in fleet.json (shares[]) — since dcb2839e tasks.ts reads "
      + "shares[0] for its operational auth negative control and fails its own precondition without it",
    // deliberately NOT synthesizable: measured 2026-10-06 (Lane 22, freeze 27a8b43e) — a tasks-only
    // preview died on exactly that precondition while the same tree ran green with tasks,share.
    // Since 2026-10-10 tasks.ts plants its own Share on slot 2 when none is persisted, because the
    // `core-tasks` shard runs without share.ts (e2e/ctx.ts#SHARD_UNITS). The edge stays declared:
    // a module selection keeps pulling share, and only the shard relies on the plant.
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
  { module: "model-scan" },
  { module: "api-stall" },
  { module: "prompts" },
  { module: "briefstats" },
  { module: "tmux-locale" },
  { module: "bytes" },
  { module: "auth" },
  { module: "dirs-pins" },
  { module: "slots", writes: ["server:slots-1-2-open", "server:slots-1-2-driven"] },
  // every check that starts a browser (e2e/dom.ts). No edge: its one instance probe (runRightsDom)
  // opens and kills its own slots and lanes and needs only free band slots — previewable alone
  { module: "dom" },
  { module: "history", reads: ["server:slots-1-2-driven"] },
  { module: "summary", reads: ["server:slots-1-2-driven"] },
  { module: "transport", reads: ["server:slots-1-2-driven"] },
  { module: "autos", reads: ["server:slots-1-2-driven"], writes: ["ctx.aPersistId", "ctx.aPerpPersistId"] },
  { module: "share", reads: ["server:slots-1-2-driven"],
    writes: ["ctx.shViewId", "ctx.shCookie", "ctx.shIntId", "ctx.shICookie", "server:share-persisted"] },
  { module: "lanes-basic", lane: true, reads: ["server:slots-1-2-open"], writes: ["lc.lnSlot", "lc.lnPath"] },
  { module: "review", lane: true, reads: ["ctx.shIntId", "ctx.shICookie"] },
  { module: "watch", lane: true },
  { module: "delivery-class", lane: true },
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
  { module: "verify-rules", lane: true },
  { module: "programs", lane: true, reads: ["ctx.restartSelfTok", "ctx.restartSelfSlot"] },
  { module: "trailstats", lane: true, reads: ["ctx.restartSelfTok"] },
  { module: "ref-advance", lane: true },
  { module: "outcomes", lane: true, writes: ["server:program-confirmed"] },
  { module: "land-durability", lane: true },
  { module: "tasks", reads: ["ctx.restartSelfTok", "ctx.restartSelfSlot", "server:program-confirmed",
    "server:share-persisted"] },
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
  { module: "trace" },
  { module: "konzepte" },
  { module: "role-address" },
  { module: "stuck-delivery" },
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

// FILES WHOSE PROBES ANOTHER MODULE RUNS. The browser probes stay in their family's file as a
// library, and e2e/dom.ts drives them; a change in such a file is therefore answered by `dom` as
// well as by the file's own module — without this, a lane that touched runArbeitsorteDom in
// e2e/slots.ts would be offered a `slots` preview that never starts the browser it changed.
// e2e/timeline-ui.ts is no runner module of its own any more: it is ONLY a host.
export const PROBE_HOSTS: Readonly<Record<string, readonly string[]>> = {
  "e2e/slots.ts": ["dom"],
  "e2e/lanes-lifecycle.ts": ["dom"],
  "e2e/drops.ts": ["dom"],
  "e2e/timeline-ui.ts": ["dom"],
  "e2e/role-address.ts": ["dom"],
  "e2e/konstellation.ts": ["dom"],
  "e2e/uebergabe.ts": ["dom"],
};

/** The modules a changed file belongs to — its own and those running its probes; empty when none. */
const modulesForPath = (path: string): string[] => {
  const m = /^e2e\/([\w-]+)\.ts$/.exec(path);
  const own = m && byModule.has(m[1]!) ? [m[1]!] : [];
  return [...own, ...(PROBE_HOSTS[path] ?? [])];
};

export interface FootprintEvidence {
  server?: { before: string; after: string; patch: string };
  checks?: Record<string, string>;
}
export interface FootprintCoverage {
  state: "covered" | "unknown";
  named: string[];
  anchors: { source: string; check: string }[];
  reasons: string[];
}
export const SERVER_MODULE_ANCHORS = [
  { symbol: "laneSuiteView", module: "lane-suite", check: "(LS.6) the GET, POST and free-withdraw wire shapes stay byte-for-byte closed over their keys" },
  { symbol: "withOfferBody", module: "lane-suite", check: "(LP.api main) main-bound preview defaults to the full offer" },
  { symbol: "laneLocalProof", module: "lane-suite", check: "(LP.api target) the same committed diff on a non-main target defaults to its fixture closure" },
] as const;

const executable = (source: string): string | null => {
  try { return new Bun.Transpiler({ loader: "ts" }).transformSync(source); }
  catch { return null; }
};

// Only complete top-level function bodies are eligible. Both sides must retain the declaration;
// additions/deletions, imports, routes and globals remain unplaced. Compiling each span rejects
// comment-shaped boundaries; compiling the file confirms the declaration is executable.
const functionSpans = (source: string): { name: string; start: number; end: number }[] => {
  const code = executable(source);
  if (code === null) return [];
  const lines = source.split("\n");
  const spans: { name: string; start: number; end: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:export )?(?:async )?function (\w+)\(/.exec(lines[i]!);
    if (!m || !new RegExp(`^(?:export )?(?:async )?function ${m[1]}\\(`, "m").test(code)) continue;
    let end = i + 1;
    while (end < lines.length && !/^}/.test(lines[end]!)) {
      if (/^\S/.test(lines[end]!) && !/^(?:\/\/|\/\*|\*)/.test(lines[end]!)) break;
      end++;
    }
    if (end === lines.length || !/^}/.test(lines[end]!)) continue;
    const body = executable(lines.slice(i, end + 1).join("\n"));
    if (body === null || [...body.matchAll(/^(?:export )?(?:async )?function /gm)].length !== 1) continue;
    spans.push({ name: m[1]!, start: i + 1, end: end + 1 });
  }
  return spans;
};

const changedServerSymbols = (e: NonNullable<FootprintEvidence["server"]>):
  { symbols: string[]; reasons: string[] } => {
  const before = functionSpans(e.before), after = functionSpans(e.after);
  const symbols = new Set<string>(), reasons = new Set<string>();
  let hunks = 0;
  for (const m of e.patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    hunks++;
    for (const [spans, start, count, side] of [
      [before, Number(m[1]), Number(m[2] ?? 1), "before"],
      [after, Number(m[3]), Number(m[4] ?? 1), "after"],
    ] as const) {
      // Empty sides of insertions/deletions still have to sit INSIDE the same function.
      const end = start + Math.max(count, 1) - 1;
      const owners = spans.filter((s) => start >= s.start && end <= s.end
        && (count > 0 || start < s.end));
      if (owners.length !== 1) reasons.add(`server.ts:${side}:${start}-${end}: global or unrecognized symbol`);
      else symbols.add(owners[0]!.name);
    }
  }
  if (!hunks) reasons.add("server.ts: diff has no readable hunks");
  for (const symbol of symbols) {
    if (before.filter((s) => s.name === symbol).length !== 1 || after.filter((s) => s.name === symbol).length !== 1)
      reasons.add(`server.ts#${symbol}: missing or ambiguous declaration on one side`);
  }
  return { symbols: [...symbols], reasons: [...reasons] };
};

export function modulesForPaths(paths: readonly string[]): string[] | null;
export function modulesForPaths(paths: readonly string[], evidence: FootprintEvidence): FootprintCoverage;
export function modulesForPaths(paths: readonly string[], evidence?: FootprintEvidence): string[] | null | FootprintCoverage {
  const named = new Set<string>();
  const anchors: FootprintCoverage["anchors"] = [];
  const reasons: string[] = [];
  if (paths.length === 0) reasons.push("empty footprint: no coverage to narrow");
  for (const path of paths) {
    const mods = modulesForPath(path);
    if (mods.length) {
      // the evidence is the changed file itself, as the gate reads it: it must transpile, and where
      // it is the module's own file it must carry the check family; a host only lends its probes
      const code = evidence ? executable(evidence.checks?.[path] ?? "") : null;
      for (const mod of mods) {
        const own = path === `e2e/${mod}.ts`;
        if (evidence && (!code || (own && !/\bcheck\(/.test(code)))) {
          reasons.push(`${path}: missing executable check family`);
        } else {
          named.add(mod);
          anchors.push({ source: path, check: `e2e/${mod}.ts#run` });
        }
      }
      continue;
    }
    if (path !== "server.ts" || !evidence?.server) {
      reasons.push(`${path}: unmapped path, wrapper or global seam`);
      continue;
    }
    const changed = changedServerSymbols(evidence.server);
    reasons.push(...changed.reasons);
    for (const symbol of changed.symbols) {
      const anchor = SERVER_MODULE_ANCHORS.find((a) => a.symbol === symbol);
      if (!anchor) { reasons.push(`server.ts#${symbol}: no proven check family`); continue; }
      const code = executable(evidence.checks?.[`e2e/${anchor.module}.ts`] ?? "");
      const checkCall = `check(${JSON.stringify(anchor.check)}`;
      if (!code?.includes(checkCall)) {
        reasons.push(`server.ts#${symbol}: missing executable check anchor ${anchor.check}`);
        continue;
      }
      named.add(anchor.module);
      anchors.push({ source: `server.ts#${symbol}`, check: `e2e/${anchor.module}.ts#${anchor.check}` });
    }
  }
  const modules = MODULE_FIXTURES.filter((m) => named.has(m.module)).map((m) => m.module);
  if (!evidence) return reasons.length || !modules.length ? null : modules;
  return { state: reasons.length || !modules.length ? "unknown" : "covered", named: modules, anchors, reasons };
}

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

/**
 * THE SAME SELECTION, ARRIVING OVER THE WIRE — `modules` on POST /api/self/suite-offer, which a
 * helper daemon turns into FLEET_E2E_MODULES for the lane's `./e2e-isolated.sh`. It refuses exactly
 * what the runner would refuse and adds the two refusals only a JSON body can need:
 *   · a value that is not an array of strings (the comma-string form stays the env's own);
 *   · a name that is no module of this table — refused BY NAME before anything is joined, so a
 *     string carrying a comma, a space or an `=` can never reach the variable as more than one word.
 * Then it asks `selectModules` itself, with `repoSet: true` because `./e2e-isolated.sh` always
 * exports FLEET_E2E_REPO: a selection this door admits is one the runner on the other machine
 * resolves to the same plan, and one it refuses would have died there as a refusal wearing a red.
 * `modules` comes back deduplicated and in the runner's own order — the exact list the job carries.
 */
export const moduleListFrom = (raw: unknown):
  { ok: true; modules: string[] } | { ok: false; error: string } => {
  if (!Array.isArray(raw) || raw.some((m) => typeof m !== "string"))
    return { ok: false, error: "modules must be an array of check module names (strings) — omit the field for the full run" };
  if (raw.length === 0)
    return { ok: false, error: "modules is empty — a selection of nothing is refused, never run; omit the field for the full run" };
  if (raw.length > MODULE_FIXTURES.length)
    return { ok: false, error: `modules names ${raw.length} entries, but this suite has only ${MODULE_FIXTURES.length} modules` };
  const unknown = [...new Set(raw as string[])].filter((m) => !byModule.has(m));
  if (unknown.length)
    return { ok: false, error: `modules names no check module of this suite: ${unknown.slice(0, 5).map((m) => JSON.stringify(m.slice(0, 40))).join(", ")}`
      + ` — known: ${MODULE_FIXTURES.map((m) => m.module).join(" ")}` };
  const { plan, refusal } = selectModules({ raw: (raw as string[]).join(","), shardGiven: false, repoSet: true });
  if (refusal || !plan) return { ok: false, error: `modules: ${refusal ?? "no plan"}` };
  return { ok: true, modules: plan.named };
};

// ================================================================================================
// WHICH GATE SUITES A SOURCE DIFF OWES — the land gate's footprint, one level coarser than the above
// ================================================================================================
// The table above answers "which CHECK MODULES of ./e2e-isolated.sh does this diff touch"; the land
// gate asks the same question of its three suite links (`clean-review`, `security`, `claude-gate`).
// Each of those wrappers runs against an INSTANCE, not the checkout, and e2e-stage.sh#stage_instance
// says exactly what an instance holds: the import closure of its entry files, the whole of
// `public/`, `package.json`, `fleet-sync.sh` and `$STAGE_EXTRA` — plus a `node_modules` symlink
// back to the source tree. So a `src/` or `public/` file a suite can observe is one of:
//   1. a file in that closure (server.ts's own imports included — every gate suite boots one);
//   2. a file under `public/` (always staged whole) or under a `STAGE_EXTRA` path;
//   3. a file a check reaches THROUGH the symlink (`realpathSync(`${ROOT}/node_modules`)`, the way
//      e2e/history.ts reads src/client.ts) or the wrapper reads straight out of `$SRC`.
// gateSuitesForPaths derives all three from the CANDIDATE tree itself — the same regex
// _stage_closure greps, the same resolution order — so the footprint moves with the tree it judges
// and there is no hand-kept list to drift. A suite whose footprint holds no changed path is not
// owed; every suite whose footprint holds one is.
//
// ABSENCE IS NEVER HARMLESSNESS (docs/verify-tiering.md §6.0b): any wrapper, entry or import that
// cannot be read or resolved, a `stage_instance` line that cannot be parsed, a `STAGE_EXTRA` that is
// not a plain word list, or a path outside `src/` and `public/` makes the whole answer `null` — and
// a `null` buys the full chain at the caller, never a short one.
// THE LIMIT, stated: this is DERIVED, not measured. A check that reaches the source tree some third
// way (an absolute path, an env var naming $SRC) is invisible here; the post-land audit runs the
// whole suite on every non-docs land and is what catches it.
export const GATE_SUITES = [
  { step: "clean-review", wrapper: "e2e-clean-review.sh" },
  { step: "security", wrapper: "e2e-security.sh" },
  { step: "claude-gate", wrapper: "e2e-claude-gate.sh" },
] as const;
export type GateSuiteStep = (typeof GATE_SUITES)[number]["step"];
/** reads one repo-relative file of the candidate tree; null when it is absent or unreadable */
export type TreeReader = (path: string) => string | null;
export interface GateSuiteFootprint {
  step: GateSuiteStep;
  /** `src/` and `public/` files the suite observes */
  files: string[];
  /** directory prefixes (`public/`, `src/`) the suite observes whole */
  dirs: string[];
}
export interface GateSuiteSelection {
  owed: GateSuiteStep[];
  /** per owed suite, the changed paths that put it there */
  why: Partial<Record<GateSuiteStep, string[]>>;
  footprints: GateSuiteFootprint[];
}

const normPath = (p: string): string => {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "." || seg === "") continue;
    if (seg === ".." && out.length && out[out.length - 1] !== "..") { out.pop(); continue; }
    out.push(seg);
  }
  return out.join("/");
};

// e2e-stage.sh#_stage_resolve, in its order: the extensionless specifier this repo writes first
const resolveSpec = (read: TreeReader, p: string): string | null => {
  for (const ext of [".ts", ".tsx", "/index.ts", ""]) if (read(p + ext) !== null) return p + ext;
  return null;
};

// e2e-stage.sh#_stage_closure, import-ANCHORED for the reason it gives (a bare "../../escape" is
// test DATA in fleet-e2e-security.ts). Per line, as grep reads it: [ \t] never crosses a newline.
const stageClosure = (read: TreeReader, entries: readonly string[]): string[] | null => {
  const seen = new Set<string>();
  const pending = [...entries];
  while (pending.length) {
    const file = pending.shift()!;
    if (seen.has(file)) continue;
    const text = read(file);
    if (text === null) return null;
    seen.add(file);
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/")) : ".";
    for (const m of text.matchAll(/(?:from|import)[ \t]*\(?[ \t]*"(\.[^"]*)"/g)) {
      const hit = resolveSpec(read, normPath(`${dir}/${m[1]}`));
      if (hit === null) return null;
      pending.push(hit);
    }
  }
  return [...seen];
};

const SOURCE_DIRS = ["src", "public"] as const;
const isSourcePath = (p: string): boolean => SOURCE_DIRS.some((d) => p.startsWith(`${d}/`));

// the literal `src/x` / `public/x` paths a piece of code names, and the directories it builds a
// path into dynamically (`${ROOT}/src/${f}`, `${ROOT}/src` for a readdir) — the second is whole
const sourceMentions = (code: string, files: Set<string>, dirs: Set<string>): void => {
  for (const m of code.matchAll(/(?<=[\/"'`])(src|public)\/([\w-]+(?:\.[\w-]+)*)/g)) {
    files.add(`${m[1]}/${m[2]}`);
    files.add(`${m[1]}/${m[2]}.ts`);
  }
  for (const m of code.matchAll(/(?<=[\/"'`])(src|public)\/?(?=\$\{|["'`])/g)) dirs.add(`${m[1]}/`);
};

const footprintOf = (read: TreeReader, suite: (typeof GATE_SUITES)[number]): GateSuiteFootprint | null => {
  const text = read(suite.wrapper);
  if (text === null) return null;
  const lines = text.split("\n").filter((l) => !/^\s*#/.test(l));
  const entries = new Set<string>();
  const extras: string[] = [];
  const files = new Set<string>(), dirs = new Set<string>(["public/"]);
  for (const line of lines) {
    if (/\bstage_instance\b/.test(line) && !/^\s*stage_instance\(\)/.test(line)) {
      const m = /^\s*stage_instance "\$SRC" "\$\w+" ((?:[\w./-]+ ?)+?)\s*\|\| exit 1\s*$/.exec(line);
      if (!m) return null;
      for (const e of m[1]!.trim().split(/\s+/)) entries.add(e);
    }
    if (/\bSTAGE_EXTRA=/.test(line)) {
      const m = /^\s*(?:export\s+)?STAGE_EXTRA=(?:"([\w./ -]*)"|'([\w./ -]*)'|([\w./-]*))\s*$/.exec(line);
      if (!m) return null;
      extras.push(...(m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/).filter(Boolean));
    }
    for (const m of line.matchAll(/\$\{?SRC\}?\/((?:src|public)(?:\/[\w.-]*)?)/g)) {
      const p = m[1]!;
      if (/^(?:src|public)\/?$/.test(p)) dirs.add(`${p.replace(/\/$/, "")}/`); else files.add(p);
    }
  }
  if (!entries.size) return null;
  for (const x of extras) {
    const p = normPath(x);
    if (!p || p.startsWith("..")) return null;
    if (read(p) !== null) files.add(p); else dirs.add(`${p}/`);
  }
  const closure = stageClosure(read, [...entries]);
  if (closure === null) return null;
  for (const f of closure) {
    if (isSourcePath(f)) { files.add(f); continue; }
    // only a file that resolves THROUGH the node_modules symlink can see past the instance; every
    // other path a staged file builds is relative to the instance, which holds the closure alone
    const raw = read(f) ?? "";
    if (!raw.includes("node_modules")) continue;
    const code = executable(raw);
    if (code === null) return null;
    if (/(?:realpath|readlink)\w*\([^)]*node_modules/.test(code)) sourceMentions(code, files, dirs);
  }
  return {
    step: suite.step,
    files: [...files].filter(isSourcePath).sort(),
    dirs: [...dirs].filter((d) => SOURCE_DIRS.some((s) => d === `${s}/`)).sort(),
  };
};

/**
 * The gate suites a diff of `src/` and `public/` paths owes, derived from the candidate tree read
 * through `read`. `null` — the conservative answer, which buys the full chain — when any path is
 * outside those two directories, the list is empty, or any suite's footprint cannot be derived.
 */
export function gateSuitesForPaths(paths: readonly string[], readTree: TreeReader): GateSuiteSelection | null {
  if (!paths.length || !paths.every(isSourcePath)) return null;
  // every wrapper boots server.ts, so its closure is read three times without this
  const cache = new Map<string, string | null>();
  const read: TreeReader = (p) => {
    if (!cache.has(p)) cache.set(p, readTree(p));
    return cache.get(p)!;
  };
  const footprints: GateSuiteFootprint[] = [];
  for (const suite of GATE_SUITES) {
    const fp = footprintOf(read, suite);
    if (fp === null) return null;
    footprints.push(fp);
  }
  const owed: GateSuiteStep[] = [];
  const why: GateSuiteSelection["why"] = {};
  for (const fp of footprints) {
    const hits = paths.filter((p) => fp.files.includes(p) || fp.dirs.some((d) => p.startsWith(d)));
    if (!hits.length) continue;
    owed.push(fp.step);
    why[fp.step] = hits;
  }
  return { owed, why, footprints };
}

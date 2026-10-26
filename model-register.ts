// model-register.ts — the model policy, defaults, aliases and display windows for Fleet harnesses.
export type ModelHarness = "claude" | "codex" | "pi-zai" | "pi-deepseek" | "pi-zai-unfenced";
export type ModelStatus = "current" | "superseded";
export type FleetWorkerRole = "summary" | "commitMsg" | "enhance" | "digest" | "review" | "merge" | "repair" | "cleanReview" | "card";
export type ModelRole = "orchestrator" | "main" | "worker" | "denk" | FleetWorkerRole
  | "summaryExec" | "commitMsgExec" | "enhanceExec" | "digestExec"
  | "reviewExec" | "mergeExec" | "repairExec" | "cleanReviewExec" | "cardExec";
export interface ModelEntry {
  harness: ModelHarness;
  id: string;
  status: ModelStatus;
  supersededBy?: string;
  displayWindow?: number;
}

// WHICH HARNESSES THIS FLEET CAN RUN — a harness is PAUSED here, never removed (an ended
// subscription, an account its models refuse). Absent means available. While an entry says
// `unavailable`, every reader follows from here: MODEL_DEFAULTS leaves the harness's role choices out
// (CODEX_ROLE_DEFAULTS below keeps them), GET /api/harnesses publishes the reason, every door that
// would start a row or a session on it answers 409 with that reason, and a worker whose register
// role is not on it takes the Claude route. The adapter (server.ts#CODEX_HARNESS,
// server.ts#workerViaCodexExec) stays whole. Two ways back, by how much returns:
//   - FLEET_HARNESS_RESUME=codex (env, comma list, restart): the doors start it again on an explicit
//     choice; the role defaults stay where they are. The e2e suite runs this way, which keeps every
//     adapter check alive while the pause stands.
//   - delete the entry here: the doors open AND MODEL_DEFAULTS takes CODEX_ROLE_DEFAULTS back.
export type HarnessAvailability = { status: "available" } | { status: "unavailable"; since: string; reason: string };
export const HARNESS_AVAILABILITY: Readonly<Record<string, HarnessAvailability>> = {
  codex: { status: "unavailable", since: "2026-10-08",
    reason: "the Codex subscription ended (owner 2026-10-08): every Codex model answers 400 \"not supported when using Codex with a ChatGPT account\"" },
};
// What a door asks: the register's entry, lifted by FLEET_HARNESS_RESUME. Read per call, never cached.
export const harnessAvailability = (id: string, resume = process.env.FLEET_HARNESS_RESUME ?? ""): HarnessAvailability =>
  resume.split(",").map((x) => x.trim()).includes(id) ? { status: "available" } : HARNESS_AVAILABILITY[id] ?? { status: "available" };
// WHICH HARNESSES THIS MACHINE NEVER STARTS — a fact about the machine, not the adapter or the platform (Bauleitung 16.10. 23:05:
// GLM not on the Mac, a local rule; the owner may lift it again without code). FLEET_HARNESSES_OFF (env, comma
// list, default empty, restart). Read per call. The doors that start something refuse it (server.ts#harnessPausedError), GET
// /api/harnesses publishes it as `hier`/`grund`; a founding plan for it still computes.
//
// AND THE ONE HARNESS WHOSE DEFAULT IS THE OTHER WAY (owner 2026-10-26: „[Zitat entfernt]“
// , and he takes the device risk for this one seat): `pi-zai-unfenced` is off
// until the host names it in FLEET_HARNESSES_ON, and it stays off on every platform but the Workhorse's Linux. The risk is a
// deliberate owner choice, so it may not arrive by an empty FLEET_HARNESSES_OFF; the second condition keeps other-provider
// models on the Workhorse where they belong.
//
// `pi-deepseek` is the SAME platform rule with the opposite opt-in (owner 2026-10-26, stage 2 of the same decision): it runs
// behind the very bwrap fence `pi-zai` uses, so on the Workhorse it is on WITHOUT a switch — the fence is the admission, not
// a second word from the operator — and off on every other platform for the one reason above. Two shapes, one table, so the
// Mac rule cannot be spelled twice and drift.
type MachineRule =
  | { kind: "opt-in"; onPlatform: string; reason: string }
  | { kind: "platform-only"; onPlatform: string };
const OFF_BY_DEFAULT: Readonly<Record<string, MachineRule>> = {
  "pi-zai-unfenced": {
    kind: "opt-in",
    reason: "off by default: only after it is switched on for this machine (FLEET_HARNESSES_ON)",
    onPlatform: "linux",
  },
  "pi-deepseek": { kind: "platform-only", onPlatform: "linux" },
};
export const harnessOffReason = (
  id: string,
  off = process.env.FLEET_HARNESSES_OFF ?? "",
  on = process.env.FLEET_HARNESSES_ON ?? "",
  platform: string = process.platform,
): string | null => {
  if (id === "") return null;
  const listed = (value: string) => value.split(",").map((x) => x.trim()).includes(id);
  if (listed(off)) return "switched off on this machine (FLEET_HARNESSES_OFF)";
  const rule = OFF_BY_DEFAULT[id];
  if (!rule) return null;
  if (platform !== rule.onPlatform) return "not available on this machine: other providers' models run only on the Workhorse";
  return rule.kind === "opt-in" && !listed(on) ? rule.reason : null;
};

type RoleDefault = { harness: ModelHarness; id: string; effort: string | null };
const OPUS_WORKER = { harness: "claude", id: "claude-opus-5-5[1m]", effort: "high" } as const;
// The Codex role choices in force until 2026-10-08, kept as data: MODEL_DEFAULTS takes them back the
// moment HARNESS_AVAILABILITY.codex is available again. Edit them here, not by re-typing the table.
const CODEX_ROLE_DEFAULTS = {
  worker: { harness: "codex", id: "gpt-6.1-sol", effort: "high" },
  denk: { harness: "codex", id: "gpt-6-astra", effort: "medium" },
  summaryExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  commitMsgExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  enhanceExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  digestExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  reviewExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  mergeExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  repairExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  cleanReviewExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
  cardExec: { harness: "codex", id: "gpt-6.1-sol", effort: "medium" },
} as const satisfies Readonly<Partial<Record<ModelRole, RoleDefault>>>;

const ROLE_DEFAULTS = {
  orchestrator: { harness: "claude", id: "claude-opus-5-5[1m]", effort: "high" },
  main: { harness: "claude", id: "claude-opus-5-5[1m]", effort: "high" },
  // worker, denk and the nine *Exec roles: Opus 5.5 at high (owner 2026-10-09: „[Zitat entfernt]“)
  worker: OPUS_WORKER,
  denk: OPUS_WORKER,
  summary: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  commitMsg: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  enhance: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  digest: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  review: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  merge: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  repair: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  cleanReview: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: null },
  card: { harness: "claude", id: "claude-haiku-5-5", effort: null },
  summaryExec: OPUS_WORKER,
  commitMsgExec: OPUS_WORKER,
  enhanceExec: OPUS_WORKER,
  digestExec: OPUS_WORKER,
  reviewExec: OPUS_WORKER,
  mergeExec: OPUS_WORKER,
  repairExec: OPUS_WORKER,
  cleanReviewExec: OPUS_WORKER,
  cardExec: OPUS_WORKER,
} as const satisfies Readonly<Record<ModelRole, RoleDefault>>;

// The role table for a given Codex availability — exported so the way back is checked, not promised.
export const roleDefaultsFor = (codex: HarnessAvailability) =>
  codex.status === "available" ? { ...ROLE_DEFAULTS, ...CODEX_ROLE_DEFAULTS } : ROLE_DEFAULTS;
// the register entry alone — FLEET_HARNESS_RESUME never moves a default
export const MODEL_DEFAULTS = roleDefaultsFor(HARNESS_AVAILABILITY.codex ?? { status: "available" });

export const MODEL_REGISTER: readonly ModelEntry[] = [
  { harness: "claude", id: "claude-opus-5-5[1m]", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-opus-5-5", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-opus-5[1m]", status: "superseded", supersededBy: "claude-opus-5-5[1m]", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-opus-5", status: "superseded", supersededBy: "claude-opus-5-5[1m]", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-fable-5-1[1m]", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-fable-5-1", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-sonnet-5-5[1m]", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-sonnet-5-5", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-sonnet-5[1m]", status: "superseded", supersededBy: "claude-sonnet-5-5[1m]", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-sonnet-5", status: "superseded", supersededBy: "claude-sonnet-5-5[1m]", displayWindow: 1_000_000 },
  // Haiku 5.5: Claude Code's own result line names contextWindow 1000000 for the bare id (measured 2026-10-14, `claude -p
  // --output-format stream-json --model claude-haiku-5-5` → result.modelUsage); owner 14.10.: „[Zitat entfernt]“
  { harness: "claude", id: "claude-haiku-5-5", status: "current", displayWindow: 1_000_000 },
  { harness: "claude", id: "claude-haiku-4-5-20251001", status: "superseded", supersededBy: "claude-haiku-5-5", displayWindow: 200_000 },
  { harness: "codex", id: "gpt-6.1-sol", status: "current", displayWindow: 258_400 },
  { harness: "codex", id: "gpt-6-sol", status: "superseded", supersededBy: "gpt-6.1-sol", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-6-astra", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-6-luna", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-sol", status: "superseded", supersededBy: "gpt-6.1-sol", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-terra", status: "superseded", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-luna", status: "superseded", supersededBy: "gpt-6-luna", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.5", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.3-codex-spark", status: "current" },
  { harness: "pi-zai", id: "glm-5.3", status: "current", displayWindow: 1_000_000 },
  { harness: "pi-zai", id: "glm-5.3-flash", status: "current", displayWindow: 1_000_000 },
  // The same two models on the unfenced GLM seat: the model list is a fact about the provider, not
  // about the fence around it. Separate rows because the harness is separately choosable.
  { harness: "pi-zai-unfenced", id: "glm-5.3", status: "current", displayWindow: 1_000_000 },
  { harness: "pi-zai-unfenced", id: "glm-5.3-flash", status: "current", displayWindow: 1_000_000 },
  // The DeepSeek seat (owner 2026-10-26, stage 2): the ids and the 1M window are pi's OWN catalogue
  // (`dist/providers/data/deepseek.json` of the installed 1.0.2 — „[Zitat entfernt]“ and
  // "DeepSeek V4 Pro", both contextWindow 1000000), not this register's guesswork.
  { harness: "pi-deepseek", id: "deepseek-flash", status: "current", displayWindow: 1_000_000 },
  { harness: "pi-deepseek", id: "deepseek-v4-pro", status: "current", displayWindow: 1_000_000 },
];

export const MODEL_ALIASES: Readonly<Record<string, string>> = {
  opus: MODEL_DEFAULTS.main.id,
  "opus 5": "claude-opus-5[1m]", "claude opus 5": "claude-opus-5[1m]",
  "opus 5.5": MODEL_DEFAULTS.main.id, "claude opus 5.5": MODEL_DEFAULTS.main.id,
  sonnet: "claude-sonnet-5-5", "sonnet 5.5": "claude-sonnet-5-5", "claude sonnet 5.5": "claude-sonnet-5-5",
  haiku: "claude-haiku-5-5", "haiku 5.5": "claude-haiku-5-5", "claude haiku 5.5": "claude-haiku-5-5",
  "sonnet 5": "claude-sonnet-5", "claude sonnet 5": "claude-sonnet-5",
  fable: "claude-fable-5-1[1m]", "fable 5.1": "claude-fable-5-1[1m]", "claude fable 5.1": "claude-fable-5-1[1m]",
  // the Codex names point at their models, never at a role: a role can move off Codex, the name cannot
  astra: "gpt-6-astra", "gpt-6 astra": "gpt-6-astra",
  sol: "gpt-6.1-sol", "gpt-6 sol": "gpt-6.1-sol",
  "sol 6.1": "gpt-6.1-sol", "gpt-6.1 sol": "gpt-6.1-sol",
};

export const modelsForHarness = (harness: ModelHarness): string[] =>
  MODEL_REGISTER.filter((entry) => entry.harness === harness).map((entry) => entry.id);

export const modelEntry = (harness: string, id: string): ModelEntry | undefined =>
  MODEL_REGISTER.find((entry) => entry.harness === harness && entry.id === id);

export const supersededModel = (harness: string, id: string | null | undefined):
  { id: string; supersededBy?: string } | undefined => {
  const entry = id ? modelEntry(harness, id) : undefined;
  return entry?.status === "superseded"
    ? { id: entry.id, ...(entry.supersededBy ? { supersededBy: entry.supersededBy } : {}) }
    : undefined;
};

export type ModelAvailability = "available" | "unavailable" | "unknown";
export function codexAvailability(cache: unknown, id: string): ModelAvailability {
  if (!cache || typeof cache !== "object" || !("models" in cache) || !Array.isArray(cache.models)) return "unknown";
  if (!cache.models.every((model: unknown) => model && typeof model === "object" && "slug" in model && typeof model.slug === "string")) return "unknown";
  return cache.models.some((model: { slug: string }) => model.slug === id) ? "available" : "unavailable";
}

export const CODEX_MODEL_CACHE_MAX_AGE_MS = 300_000;
export interface CodexModelSupport {
  cwd: string | null;
  model: string | null;
  registerValid: true;
  registered: boolean;
  availability: ModelAvailability;
  source: "CODEX_HOME/models_cache.json";
  observedAt: number | null;
  cacheAgeMs: number | null;
  maxAgeMs: number;
  cliVersion: string | null;
  binary: string | null;
  cliObservedAt: number | null;
  provider: "openai" | null;
  reason: "model-unspecified" | "cache-missing-or-malformed" | "cache-time-unproven" | "cache-expired"
    | "cli-unproven" | "cli-version-mismatch" | "provider-binding-unproven" | "observation-target-mismatch" | "catalog-listed" | "catalog-excluded";
}
export function codexModelSupport(cache: unknown, id: string | null,
  cli: { binary: string | null; version: string | null; observedAt: number | null; reason: string | null },
  providerBound: boolean, now = Date.now(), cwd: string | null = null): CodexModelSupport {
  const fetched = cache && typeof cache === "object" && "fetched_at" in cache && typeof cache.fetched_at === "string"
    ? Date.parse(cache.fetched_at) : NaN;
  const observedAt = Number.isFinite(fetched) ? fetched : null;
  const age = observedAt === null ? null : now - observedAt;
  const base: CodexModelSupport = {
    cwd, model: id, registerValid: true, registered: id !== null && !!modelEntry("codex", id), availability: "unknown",
    source: "CODEX_HOME/models_cache.json", observedAt, cacheAgeMs: age,
    maxAgeMs: CODEX_MODEL_CACHE_MAX_AGE_MS, cliVersion: cli.version, binary: cli.binary,
    cliObservedAt: cli.observedAt, provider: providerBound ? "openai" : null, reason: "cache-missing-or-malformed",
  };
  const unknown = (reason: CodexModelSupport["reason"]): CodexModelSupport => ({ ...base, reason });
  if (id === null) return unknown("model-unspecified");
  const availability = codexAvailability(cache, id);
  if (availability === "unknown") return unknown("cache-missing-or-malformed");
  if (age === null || age < 0) return unknown("cache-time-unproven");
  // Freshness is measured from the catalogue fetch clock, never file mtime or the server's read.
  if (age > CODEX_MODEL_CACHE_MAX_AGE_MS) return unknown("cache-expired");
  if (!cli.binary || !cli.version || cli.reason !== null || cli.observedAt === null
    || now - cli.observedAt < 0 || now - cli.observedAt > 60_000) return unknown("cli-unproven");
  if (!cache || typeof cache !== "object" || !("client_version" in cache) || cache.client_version !== cli.version)
    return unknown("cli-version-mismatch");
  if (!providerBound || ("identity" in cache && cache.identity !== undefined && cache.identity !== null))
    return unknown("provider-binding-unproven");
  return { ...base, availability, reason: availability === "available" ? "catalog-listed" : "catalog-excluded" };
}

// `defaults` is the role table to resolve against: MODEL_DEFAULTS, or — for a worker whose operator
// names the codex-exec route explicitly — roleDefaultsFor({ status: "available" }).
export function resolveWorkerModel(role: ModelRole, envModel?: string, envEffort?: string,
  defaults: Readonly<Record<ModelRole, RoleDefault>> = MODEL_DEFAULTS) {
  const fallback = defaults[role];
  const entry = envModel ? modelEntry(fallback.harness, envModel) : undefined;
  const levels = fallback.harness === "claude"
    ? ["low", "medium", "high", "xhigh", "max"] : ["low", "medium", "high", "xhigh", "max", "ultra"];
  const validEffort = !!envEffort && levels.includes(envEffort);
  return {
    harness: fallback.harness, model: entry?.id ?? fallback.id,
    effort: validEffort ? envEffort : fallback.effort,
    modelSource: entry ? "env" as const : "register" as const,
    effortSource: validEffort ? "env" as const : "register" as const,
    warnings: [
      ...(envModel && !entry ? ["unregistered or wrong-harness model override rejected"] : []),
      ...(envEffort && !validEffort ? ["invalid effort override rejected"] : []),
    ],
  };
}

export function workerModelWarnings(selection: ReturnType<typeof resolveWorkerModel>, cache: unknown): string[] {
  const entry = modelEntry(selection.harness, selection.model);
  return [
    ...selection.warnings,
    ...(!entry ? ["model absent from MODEL_REGISTER"] : []),
    ...(entry?.status === "superseded" ? [`superseded model; successor=${entry.supersededBy ?? "unknown"}`] : []),
    ...((a) => a.status === "unavailable" ? [`harness ${selection.harness} unavailable since ${a.since}: ${a.reason}`] : [])(
      harnessAvailability(selection.harness)),
    ...(selection.harness === "codex" && codexAvailability(cache, selection.model) !== "available"
      ? [`codexAvailability=${codexAvailability(cache, selection.model)}`] : []),
  ];
}

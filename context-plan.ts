import {
  CONTEXT_PACKS,
  CONTEXT_PACK_HARNESSES,
  type ContextPackCapability,
  type ContextPackMode,
  type ContextPackSource,
  type ContextPackStatus,
  type ContextPackTrigger,
} from "./context-packs";
import { USE_WHEN_MAX, validateContextPacks, type ContextPackRepoFacts } from "./context-pack-validator";

// Ladder order is the contract: the FIRST rule a pack fails is the reason it is omitted.
// `manifest-invalid` leads because it is the only reason that disqualifies a pack before its
// declared facts may be believed at all — it can only arise for a repo-declared pack.
export const CONTEXT_PLAN_OMISSION_REASONS = [
  "manifest-invalid",
  "source-unavailable",
  "status-not-active",
  "harness-unsupported",
  "mode-unsupported",
  "trigger-not-matched",
  "capability-missing",
  // Not a rung of the ladder below: it can only arise for a Program-scoped pack, whose lifetime is its
  // Program's. It is written so the END of that lifetime is a receipt row, never a silent absence.
  "program-complete",
] as const;
export type ContextPlanOmissionReason = (typeof CONTEXT_PLAN_OMISSION_REASONS)[number];

export interface ContextPlanInput {
  readonly sourceTree: "fleet" | "foreign";
  readonly harness: string | null;
  readonly mode: ContextPackMode;
  readonly triggers: readonly ContextPackTrigger[];
  readonly capabilities: readonly ContextPackCapability[];
}

// `useWhen` is OPTIONAL on a selection although it is mandatory on a Fleet seed: a repo-declared
// pack may predate the field, and a plan that invented a purpose line for it would be stating a
// claim nobody made. Absent here means the renderer omits the line, never the pointer.
export type ContextPlanSelection = {
  readonly id: string;
  readonly useWhen?: string;
  readonly sources: readonly ContextPackSource[];
  readonly estimatedBytes: number;
  // Only a repo-declared pack carries its observation here; a Fleet seed's hash lives on its own
  // manifest entry and is read from there at receipt time.
  readonly sourceHash?: string;
  // Present ONLY on a Program-scoped pack, so every receipt without one keeps its exact bytes.
  readonly origin?: "program";
} | {
  readonly id: string;
  readonly useWhen?: string;
  readonly sources: { readonly privateSourceId: string };
  readonly estimatedBytes: number;
  readonly sourceHash?: string;
};

/** The rule facts a pack must state to be planned at all — Fleet seed and repo manifest alike. */
export interface ContextPlanRule {
  readonly status: ContextPackStatus;
  readonly harnesses: readonly string[];
  readonly modes: readonly ContextPackMode[];
  readonly triggers: readonly ContextPackTrigger[];
  readonly requiredCapabilities: readonly ContextPackCapability[];
}

export interface ContextPlanContext {
  readonly sourceAvailable: boolean;
  readonly harness: string;
  readonly mode: ContextPackMode;
  readonly triggers: ReadonlySet<ContextPackTrigger>;
  readonly capabilities: ReadonlySet<ContextPackCapability>;
}

// null and unrecognised harness ids are the legacy/default adapter, which is Claude. Keeping that
// resolution here makes every caller share the same total rule instead of special-casing old slots
// at the delivery boundary. Resolution is against the closed vocabulary rather than the harnesses
// the seeds happen to mention, so a repo-declared pack is judged by the same rule.
export function resolveContextHarness(harness: string | null): string {
  return (CONTEXT_PACK_HARNESSES as readonly string[]).includes(harness ?? "") ? harness as string : "claude";
}

/** The single omission ladder. Returns the first failed rule, or null when the pack is selected. */
export function contextOmissionFor(pack: ContextPlanRule, ctx: ContextPlanContext): ContextPlanOmissionReason | null {
  if (!ctx.sourceAvailable) return "source-unavailable";
  if (pack.status !== "active") return "status-not-active";
  if (!pack.harnesses.includes(ctx.harness)) return "harness-unsupported";
  if (!pack.modes.includes(ctx.mode)) return "mode-unsupported";
  if (!pack.triggers.some((trigger) => ctx.triggers.has(trigger))) return "trigger-not-matched";
  if (!pack.requiredCapabilities.every((capability) => ctx.capabilities.has(capability))) return "capability-missing";
  return null;
}

export interface ContextPlan {
  readonly selected: readonly ContextPlanSelection[];
  readonly omitted: readonly { readonly id: string; readonly why: ContextPlanOmissionReason }[];
}

/** Freshly derive advisory context pointers from plain facts. No result is persisted here. */
export function planContext(input: ContextPlanInput): ContextPlan {
  const harness = resolveContextHarness(input.harness);
  const triggers = new Set<ContextPackTrigger>(input.triggers);
  const capabilities = new Set<ContextPackCapability>(input.capabilities);
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];

  for (const pack of CONTEXT_PACKS) {
    const why = contextOmissionFor(pack, {
      sourceAvailable: input.sourceTree !== "foreign",
      harness, mode: input.mode, triggers, capabilities,
    });
    if (why) {
      omitted.push({ id: pack.id, why });
      continue;
    }
    selected.push("sources" in pack
      ? { id: pack.id, useWhen: pack.useWhen, sources: pack.sources.map((source) => ({ ...source })), estimatedBytes: pack.estimatedBytes }
      : { id: pack.id, useWhen: pack.useWhen, sources: { privateSourceId: pack.privateSourceId }, estimatedBytes: pack.estimatedBytes });
  }

  return { selected, omitted };
}

// --- PROGRAM-SCOPED PACKS: pointers that live exactly as long as their Program.
//
// The Fleet seeds and the repo manifest carry knowledge that holds for months; task-notes carry a
// note on a FILE. Between them sat knowledge that holds for one Program's work — a measurement note
// or a decision section its lanes all need. The Program is the only persisted bracket (a wave is a
// projection, task-land-waves.ts), so it is the lifetime: no clock, no expiry, no second store. A
// pack is id + purpose line + tracked pointers; the content stays in the source file.
export const PROGRAM_CONTEXT_PACKS_MAX = 5;
export const PROGRAM_CONTEXT_PACK_SOURCES_MAX = 4;
const PROGRAM_CONTEXT_PACK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PROGRAM_CONTEXT_PACK_KEYS: ReadonlySet<string> = new Set(["id", "useWhen", "sources"]);
const PROGRAM_CONTEXT_CONTENT_KEY = /^(?:content|contents|prose|text|passage|quote|body)$/i;

export interface ProgramContextPack {
  readonly id: string;
  readonly useWhen: string;
  readonly sources: readonly ContextPackSource[];
}

export interface ProgramContextPackIssue {
  readonly code: string;
  readonly packId: string;
  readonly detail: string;
}

export type ProgramContextPacksValidation =
  | { readonly ok: true; readonly packs: ProgramContextPack[] }
  | { readonly ok: false; readonly issues: readonly ProgramContextPackIssue[] };

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Validate a Program's pack list at WRITE time against the repo facts of the commit the writer
 * names. Every finding refuses the whole list — an anchor Fleet could not check is exactly as
 * undeliverable as one it checked and did not find. Pure: facts in, verdict out.
 *
 * The source checks are context-pack-validator.ts's own, run over a synthesized full pack: the
 * fields a Program pack does not state are fixed here (trigger `always`, every harness and mode,
 * guidance), so the validator judges only what the writer actually supplied.
 */
export function validateProgramContextPacks(raw: unknown, repo: ContextPackRepoFacts): ProgramContextPacksValidation {
  if (!Array.isArray(raw))
    return { ok: false, issues: [{ code: "PACK_FIELD_INVALID", packId: "@packs", detail: "packs must be an array" }] };
  if (raw.length > PROGRAM_CONTEXT_PACKS_MAX)
    return { ok: false, issues: [{ code: "PROGRAM_PACKS_TOO_MANY", packId: "@packs",
      detail: `a Program carries at most ${PROGRAM_CONTEXT_PACKS_MAX} packs (got ${raw.length})` }] };
  const issues: ProgramContextPackIssue[] = [];
  const seedIds: ReadonlySet<string> = new Set(CONTEXT_PACKS.map((pack) => pack.id));
  const seen = new Set<string>();
  for (let index = 0; index < raw.length; index++) {
    const entry = raw[index];
    if (!isPlainRecord(entry)) {
      issues.push({ code: "PACK_FIELD_INVALID", packId: `#${index}`, detail: "pack must be an object" });
      continue;
    }
    const packId = typeof entry.id === "string" && entry.id ? entry.id : `#${index}`;
    for (const key of Object.keys(entry).sort()) {
      if (PROGRAM_CONTEXT_PACK_KEYS.has(key)) continue;
      issues.push(PROGRAM_CONTEXT_CONTENT_KEY.test(key)
        ? { code: "PACK_CONTENT_FORBIDDEN", packId, detail: `content field is forbidden: ${key}` }
        : { code: "PACK_UNKNOWN_KEY", packId, detail: `unknown pack key: ${key}` });
    }
    if (typeof entry.id !== "string" || !PROGRAM_CONTEXT_PACK_ID.test(entry.id))
      issues.push({ code: "PROGRAM_PACK_ID_INVALID", packId, detail: "id must match ^[a-z0-9][a-z0-9-]{0,39}$" });
    else if (seedIds.has(entry.id))
      issues.push({ code: "PROGRAM_PACK_SEED_ID", packId, detail: "id is a Fleet seed id" });
    else if (seen.has(entry.id))
      issues.push({ code: "ID_DUPLICATE", packId, detail: "id occurs more than once" });
    else seen.add(entry.id);
    if (!("useWhen" in entry))
      issues.push({ code: "PACK_REQUIRED_FIELD_MISSING", packId, detail: "required field is missing: useWhen" });
    if (Array.isArray(entry.sources) && entry.sources.length > PROGRAM_CONTEXT_PACK_SOURCES_MAX)
      issues.push({ code: "PROGRAM_PACK_SOURCES_TOO_MANY", packId,
        detail: `a pack names at most ${PROGRAM_CONTEXT_PACK_SOURCES_MAX} sources (got ${entry.sources.length})` });
    const synthesized = {
      id: "program-pack", scope: "repo-contract", audience: "agent", triggers: ["always"], hardness: "guidance",
      requiredCapabilities: ["tracked-source-read"], harnesses: [...CONTEXT_PACK_HARNESSES], modes: ["read-only", "mutating", "monitoring"],
      estimatedBytes: 0, evidence: "tree-anchor", owner: "owner", status: "active",
      ...("useWhen" in entry ? { useWhen: entry.useWhen } : {}),
      ...("sources" in entry ? { sources: entry.sources } : {}),
    };
    for (const issue of validateContextPacks({ packs: [synthesized], repo, capabilities: new Map() }).issues)
      issues.push({ code: issue.code, packId, detail: issue.path ? `${issue.detail}: ${issue.path}` : issue.detail });
  }
  if (issues.length > 0) return { ok: false, issues };
  // The typed lift is the load reader's: everything it requires, the validator above has proven.
  const packs = programContextPacksFrom(raw);
  return packs ? { ok: true, packs }
    : { ok: false, issues: [{ code: "PACK_FIELD_INVALID", packId: "@packs", detail: "packs are not in persistable shape" }] };
}

/**
 * Lift a persisted list back into packs, SHAPE ONLY: the anchors were checked when they were written,
 * and a load has no commit to check them against. Anything unreadable is `null` — the caller loads
 * the Program without packs rather than refusing the Program.
 */
export function programContextPacksFrom(raw: unknown): ProgramContextPack[] | null {
  if (!Array.isArray(raw) || raw.length > PROGRAM_CONTEXT_PACKS_MAX) return null;
  const packs: ProgramContextPack[] = [];
  const ids = new Set<string>();
  for (const entry of raw) {
    if (!isPlainRecord(entry) || Object.keys(entry).some((key) => !PROGRAM_CONTEXT_PACK_KEYS.has(key))) return null;
    const { id, useWhen, sources } = entry;
    if (typeof id !== "string" || !PROGRAM_CONTEXT_PACK_ID.test(id) || ids.has(id)) return null;
    if (typeof useWhen !== "string" || /[\r\n]/.test(useWhen) || !useWhen.trim() || useWhen.trim().length > USE_WHEN_MAX) return null;
    if (!Array.isArray(sources) || sources.length === 0 || sources.length > PROGRAM_CONTEXT_PACK_SOURCES_MAX) return null;
    const lifted: ContextPackSource[] = [];
    for (const source of sources) {
      if (!isPlainRecord(source) || typeof source.path !== "string" || typeof source.anchor !== "string"
        || !source.path || !source.anchor || /[\r\n]/.test(source.anchor) || Object.keys(source).length !== 2) return null;
      lifted.push({ path: source.path, anchor: source.anchor });
    }
    ids.add(id);
    packs.push({ id, useWhen: useWhen.trim(), sources: lifted });
  }
  return packs;
}

export interface ProgramContextPlanInput {
  /** The lane's Program, or null for a lane outside every Program. */
  readonly program: { readonly status: string; readonly contextPacks?: readonly ProgramContextPack[] } | null;
  /** Tracked paths at the commit the receipt asserts — a pointer into a vanished path is omitted. */
  readonly trackedPaths: ReadonlySet<string>;
}

/**
 * The Program's packs for ONE lane delivery. A `complete` Program delivers nothing and says so per
 * pack; a pack whose source path is not tracked at the delivered commit (removed since the write, or
 * a lane in another repository) is `source-unavailable`. No Program, no packs: the empty plan, so a
 * lane outside every Program receives exactly the plan it received before this carrier existed.
 */
export function planProgramContext(input: ProgramContextPlanInput): ContextPlan {
  const packs = input.program?.contextPacks ?? [];
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];
  for (const pack of packs) {
    if (input.program?.status === "complete") omitted.push({ id: pack.id, why: "program-complete" });
    else if (!pack.sources.every((source) => input.trackedPaths.has(source.path))) omitted.push({ id: pack.id, why: "source-unavailable" });
    // estimatedBytes 0: a Program pack declares no size, and nothing here reads the source to guess one.
    else selected.push({ id: pack.id, useWhen: pack.useWhen, sources: pack.sources.map((source) => ({ ...source })),
      estimatedBytes: 0, origin: "program" });
  }
  return { selected, omitted };
}

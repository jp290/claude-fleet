import {
  CONTEXT_PACKS,
  CONTEXT_PACK_HARNESSES,
  type ContextPackCapability,
  type ContextPackMode,
  type ContextPackSource,
  type ContextPackStatus,
  type ContextPackTrigger,
} from "./context-packs";

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

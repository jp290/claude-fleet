import {
  CONTEXT_PACKS,
  type ContextPackCapability,
  type ContextPackMode,
  type ContextPackSource,
  type ContextPackTrigger,
} from "./context-packs";

export const CONTEXT_PLAN_OMISSION_REASONS = [
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

export type ContextPlanSelection = {
  readonly id: string;
  readonly sources: readonly ContextPackSource[];
  readonly estimatedBytes: number;
} | {
  readonly id: string;
  readonly sources: { readonly privateSourceId: string };
  readonly estimatedBytes: number;
};

export interface ContextPlan {
  readonly selected: readonly ContextPlanSelection[];
  readonly omitted: readonly { readonly id: string; readonly why: ContextPlanOmissionReason }[];
}

/** Freshly derive advisory context pointers from plain facts. No result is persisted here. */
export function planContext(input: ContextPlanInput): ContextPlan {
  // null and unrecognised harness ids are the legacy/default adapter, which is Claude. Keeping
  // that resolution here makes every caller share the same total rule instead of special-casing
  // old slots at the delivery boundary.
  const harness = CONTEXT_PACKS.some((pack) => (pack.harnesses as readonly string[]).includes(input.harness ?? ""))
    ? input.harness as string
    : "claude";
  const triggers = new Set<ContextPackTrigger>(input.triggers);
  const capabilities = new Set<ContextPackCapability>(input.capabilities);
  const selected: ContextPlanSelection[] = [];
  const omitted: { id: string; why: ContextPlanOmissionReason }[] = [];

  for (const pack of CONTEXT_PACKS) {
    let why: ContextPlanOmissionReason | null = null;
    if (input.sourceTree === "foreign") why = "source-unavailable";
    else if (pack.status !== "active") why = "status-not-active";
    else if (!(pack.harnesses as readonly string[]).includes(harness)) why = "harness-unsupported";
    else if (!(pack.modes as readonly ContextPackMode[]).includes(input.mode)) why = "mode-unsupported";
    else if (!pack.triggers.some((trigger) => triggers.has(trigger))) why = "trigger-not-matched";
    else if (!pack.requiredCapabilities.every((capability) => capabilities.has(capability))) why = "capability-missing";

    if (why) {
      omitted.push({ id: pack.id, why });
      continue;
    }
    selected.push("sources" in pack
      ? { id: pack.id, sources: pack.sources.map((source) => ({ ...source })), estimatedBytes: pack.estimatedBytes }
      : { id: pack.id, sources: { privateSourceId: pack.privateSourceId }, estimatedBytes: pack.estimatedBytes });
  }

  return { selected, omitted };
}

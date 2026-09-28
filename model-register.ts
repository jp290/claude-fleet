// model-register.ts — the model policy, defaults, aliases and display windows for Fleet harnesses.
export type ModelHarness = "claude" | "codex" | "pi-zai";
export type ModelStatus = "current" | "superseded";
export type ModelRole = "orchestrator" | "main" | "worker" | "denk" | "summary";
export interface ModelEntry {
  harness: ModelHarness;
  id: string;
  status: ModelStatus;
  supersededBy?: string;
  displayWindow?: number;
}

export const MODEL_DEFAULTS: Readonly<Record<ModelRole, { harness: ModelHarness; id: string; effort: string }>> = {
  orchestrator: { harness: "claude", id: "claude-opus-5-5[1m]", effort: "high" },
  main: { harness: "claude", id: "claude-opus-5-5[1m]", effort: "high" },
  worker: { harness: "codex", id: "gpt-6-sol", effort: "high" },
  denk: { harness: "codex", id: "gpt-6-astra", effort: "medium" },
  summary: { harness: "claude", id: "claude-sonnet-5-5[1m]", effort: "medium" },
};

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
  { harness: "claude", id: "claude-haiku-4-5-20251001", status: "current", displayWindow: 200_000 },
  { harness: "codex", id: "gpt-6-sol", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-6-astra", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-6-luna", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-sol", status: "superseded", supersededBy: "gpt-6-sol", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-terra", status: "superseded", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.6-luna", status: "superseded", supersededBy: "gpt-6-luna", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.5", status: "current", displayWindow: 272_000 },
  { harness: "codex", id: "gpt-5.3-codex-spark", status: "current" },
  { harness: "pi-zai", id: "glm-5.3", status: "current", displayWindow: 1_000_000 },
  { harness: "pi-zai", id: "glm-5.3-flash", status: "current", displayWindow: 1_000_000 },
];

export const MODEL_ALIASES: Readonly<Record<string, string>> = {
  opus: MODEL_DEFAULTS.main.id,
  "opus 5": "claude-opus-5[1m]", "claude opus 5": "claude-opus-5[1m]",
  "opus 5.5": MODEL_DEFAULTS.main.id, "claude opus 5.5": MODEL_DEFAULTS.main.id,
  sonnet: "claude-sonnet-5-5", "sonnet 5.5": "claude-sonnet-5-5", "claude sonnet 5.5": "claude-sonnet-5-5",
  "sonnet 5": "claude-sonnet-5", "claude sonnet 5": "claude-sonnet-5",
  fable: "claude-fable-5-1[1m]", "fable 5.1": "claude-fable-5-1[1m]", "claude fable 5.1": "claude-fable-5-1[1m]",
  astra: MODEL_DEFAULTS.denk.id, "gpt-6 astra": MODEL_DEFAULTS.denk.id,
  sol: MODEL_DEFAULTS.worker.id, "gpt-6 sol": MODEL_DEFAULTS.worker.id,
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

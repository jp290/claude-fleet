// model-scan.ts — read local harness model caches and propose a register comparison without writes.
import { readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { MODEL_REGISTER, type ModelEntry, type ModelHarness } from "./model-register";

type JsonObject = Record<string, unknown>;
export interface ScanEnvironment {
  CODEX_HOME?: string;
  CLAUDE_CONFIG_DIR?: string;
  FLEET_PI_ZAI_AGENT_DIR?: string;
}
export interface HarnessScan {
  harness: ModelHarness;
  sources: string[];
  status: "known" | "unknown";
  basis: "local-cache";
  reason: string | null;
  cacheTime: string | number | null;
  available: string[] | null;
  newlyAvailable: string[] | null;
  registeredButUnavailable: string[] | null;
}

const object = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const modelId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 160 && /^[a-zA-Z0-9][a-zA-Z0-9._:/\[\]-]*$/.test(value);

function ids(value: unknown, field: "slug" | "id"): string[] | null {
  if (!Array.isArray(value) || !value.every((row: unknown) => object(row) && modelId(row[field]))) return null;
  return [...new Set(value.map((row: JsonObject) => row[field] as string))].sort();
}

async function readSource(path: string, label: string): Promise<{ value: unknown; reason: string | null }> {
  let text: string;
  try { text = await readFile(path, "utf8"); }
  catch (error: unknown) {
    const code = object(error) && typeof error.code === "string" ? error.code : "read-error";
    const kind = code === "ENOENT" ? "missing" : code === "EACCES" || code === "EPERM" ? "unreadable" : "read failed";
    return { value: null, reason: `${label}: ${kind}` };
  }
  try { return { value: JSON.parse(text) as unknown, reason: null }; }
  catch { return { value: null, reason: `${label}: invalid JSON` }; }
}

function compare(harness: ModelHarness, sources: string[], available: string[] | null,
  reason: string | null, cacheTime: string | number | null, register: readonly ModelEntry[]): HarnessScan {
  const registered = new Set(register.filter((entry) => entry.harness === harness).map((entry) => entry.id));
  const canonical = (id: string) => harness === "claude" ? id.replace(/\[\d+[km]\]$/i, "") : id;
  const registeredModels = new Set([...registered].map(canonical));
  const observed = new Set((available ?? []).map(canonical));
  return {
    harness, sources, status: available === null ? "unknown" : "known", basis: "local-cache", reason, cacheTime,
    available,
    newlyAvailable: available === null ? null : available.filter((id) => !registeredModels.has(canonical(id))),
    registeredButUnavailable: available === null ? null : [...registered].filter((id) => !observed.has(canonical(id))).sort(),
  };
}

async function readClaudeCatalogue(dir: string, label: string, now: number): Promise<{
  available: string[] | null; reason: string | null; cacheTime: number | null;
}> {
  const unknown = (reason: string, cacheTime: number | null = null) =>
    ({ available: null, reason: `${label}: ${reason}`, cacheTime });
  let files: string[];
  try { files = (await readdir(dir)).filter((name) => name.endsWith("-cc.json")).sort(); }
  catch { return unknown("missing or unreadable directory"); }
  if (!files.length) return unknown("missing cc catalogue");
  const catalogues: { available: string[]; fetchedAt: number; staleAt: number }[] = [];
  for (const file of files) {
    const source = await readSource(join(dir, file), label);
    if (source.reason) return { available: null, reason: source.reason, cacheTime: null };
    const value = source.value;
    const catalogue = object(value) && object(value.catalog) ? value.catalog : null;
    const config = catalogue && object(catalogue.config) ? catalogue.config : null;
    const available = config ? ids(config.models, "id") : null;
    if (!object(value) || value.version !== 2 || catalogue?.surface !== "cc" || config?.id !== "cc"
      || available === null || available.length === 0
      || typeof value.fetchedAt !== "number" || !Number.isFinite(value.fetchedAt)
      || typeof value.staleAt !== "number" || !Number.isFinite(value.staleAt)
      || value.fetchedAt < 0 || value.fetchedAt > now || value.staleAt <= value.fetchedAt)
      return unknown("unknown schema (expected version 2, cc config.models[].id and valid cache times)");
    catalogues.push({ available, fetchedAt: value.fetchedAt, staleAt: value.staleAt });
  }
  const latest = Math.max(...catalogues.map((row) => row.fetchedAt));
  if (catalogues.some((row) => now >= row.staleAt)) return unknown("stale cc catalogue", latest);
  if (catalogues.some((row) => JSON.stringify(row.available) !== JSON.stringify(catalogues[0]!.available)))
    return unknown("ambiguous cc catalogues", latest);
  return { available: catalogues[0]!.available, reason: null, cacheTime: latest };
}

export async function scanModels(options: {
  home?: string; env?: ScanEnvironment; register?: readonly ModelEntry[]; now?: number;
} = {}): Promise<{ harnesses: HarnessScan[] }> {
  const home = options.home ?? homedir();
  const env = options.env ?? process.env;
  const register = options.register ?? MODEL_REGISTER;
  const harnesses: HarnessScan[] = [];
  for (const harness of [...new Set(register.map((entry) => entry.harness))]) {
    if (harness === "codex") {
      const label = "CODEX_HOME/models_cache.json";
      const source = await readSource(join(env.CODEX_HOME || join(home, ".codex"), "models_cache.json"), label);
      const available = object(source.value) ? ids(source.value.models, "slug") : null;
      const fetchedAt = object(source.value) && typeof source.value.fetched_at === "string"
        ? Date.parse(source.value.fetched_at) : NaN;
      const cacheTime = Number.isFinite(fetchedAt) ? new Date(fetchedAt).toISOString() : null;
      harnesses.push(compare(harness, [label], available,
        source.reason ?? (available === null ? `${label}: unknown schema (expected models[].slug)` : null), cacheTime, register));
    } else if (harness === "pi-zai") {
      const label = "FLEET_PI_ZAI_AGENT_DIR/models-store.json#zai";
      const source = await readSource(join(env.FLEET_PI_ZAI_AGENT_DIR || join(home, ".config/claude-fleet/pi-zai-agent"), "models-store.json"), label);
      const provider = object(source.value) && object(source.value.zai) ? source.value.zai : null;
      const available = provider ? ids(provider.models, "id") : null;
      const cacheTime = provider && typeof provider.checkedAt === "number" && Number.isFinite(provider.checkedAt)
        ? provider.checkedAt : null;
      const usable = available !== null && available.length > 0 && cacheTime !== null;
      harnesses.push(compare(harness, [label], usable ? available : null, source.reason ?? (usable ? null
        : `${label}: missing or incomplete zai catalogue (expected nonempty models[].id and checkedAt)`), cacheTime, register));
    } else {
      const label = "CLAUDE_CONFIG_DIR/cache/model-catalog/";
      const catalogue = await readClaudeCatalogue(join(env.CLAUDE_CONFIG_DIR || join(home, ".claude"),
        "cache/model-catalog"), label, options.now ?? Date.now());
      harnesses.push(compare(harness, [label], catalogue.available, catalogue.reason, catalogue.cacheTime, register));
    }
  }
  return { harnesses };
}

export const MODEL_SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000;
type ModelDifferences = { newlyAvailable: string[]; registeredButUnavailable: string[] };
export interface ModelScanState {
  lastScanAt: number | null;
  reported: Partial<Record<ModelHarness, ModelDifferences>>;
}

export function modelScanStateFrom(value: unknown): ModelScanState {
  const state: ModelScanState = { lastScanAt: null, reported: {} };
  if (!object(value)) return state;
  if (typeof value.lastScanAt === "number" && Number.isFinite(value.lastScanAt) && value.lastScanAt >= 0)
    state.lastScanAt = value.lastScanAt;
  if (object(value.reported)) for (const harness of ["claude", "codex", "pi-zai"] as const) {
    const row = value.reported[harness];
    if (object(row) && Array.isArray(row.newlyAvailable) && row.newlyAvailable.every(modelId)
      && Array.isArray(row.registeredButUnavailable) && row.registeredButUnavailable.every(modelId))
      state.reported[harness] = { newlyAvailable: [...new Set(row.newlyAvailable)].sort(),
        registeredButUnavailable: [...new Set(row.registeredButUnavailable)].sort() };
  }
  return state;
}

export function makeModelScanTick(options: {
  state: ModelScanState;
  scan: () => Promise<{ harnesses: HarnessScan[] }>;
  send: (message: string) => Promise<boolean>;
  persist: () => Promise<void>;
  now?: () => number;
}): () => Promise<void> {
  let busy = false;
  return async () => {
    const now = (options.now ?? Date.now)();
    const state = options.state;
    if (busy || state.lastScanAt !== null && now - state.lastScanAt < MODEL_SCAN_INTERVAL_MS) return;
    busy = true;
    try {
      state.lastScanAt = now;
      await options.persist();
      const { harnesses } = await options.scan();
      const changed: { harness: ModelHarness; differences: ModelDifferences }[] = [];
      for (const row of harnesses) {
        if (row.status !== "known" || row.newlyAvailable === null || row.registeredButUnavailable === null) continue;
        const differences = { newlyAvailable: [...new Set(row.newlyAvailable)].sort(),
          registeredButUnavailable: [...new Set(row.registeredButUnavailable)].sort() };
        const previous = state.reported[row.harness];
        if (!previous && !differences.newlyAvailable.length && !differences.registeredButUnavailable.length)
          state.reported[row.harness] = differences;
        else if (JSON.stringify(previous) !== JSON.stringify(differences)) changed.push({ harness: row.harness, differences });
      }
      if (changed.length) {
        const message = "Modell-Vorschlag (lokaler Cache; Register unveraendert): " + changed.map(({ harness, differences }) =>
          `${harness} newlyAvailable=${JSON.stringify(differences.newlyAvailable)} registeredButUnavailable=${JSON.stringify(differences.registeredButUnavailable)}`).join("; ");
        if (await options.send(message)) for (const { harness, differences } of changed) state.reported[harness] = differences;
      }
      await options.persist();
    } finally { busy = false; }
  };
}

if (import.meta.main) {
  if (process.argv.slice(2).some((arg) => arg !== "--json")) {
    console.error("Usage: bun model-scan.ts [--json]");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(await scanModels(), null, 2));
  }
}

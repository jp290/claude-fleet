import { readFile } from "node:fs/promises";
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
  const observed = new Set(available ?? []);
  return {
    harness, sources, status: available === null ? "unknown" : "known", basis: "local-cache", reason, cacheTime,
    available,
    newlyAvailable: available === null ? null : available.filter((id) => !registered.has(id)),
    registeredButUnavailable: available === null ? null : [...registered].filter((id) => !observed.has(id)).sort(),
  };
}

export async function scanModels(options: {
  home?: string; env?: ScanEnvironment; register?: readonly ModelEntry[];
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
      const dir = env.CLAUDE_CONFIG_DIR || join(home, ".claude");
      const labels = ["CLAUDE_CONFIG_DIR/cache/model-access.json", "CLAUDE_CONFIG_DIR/cache/model-capabilities.json"];
      const access = await readSource(join(dir, "cache/model-access.json"), labels[0]);
      const capabilities = await readSource(join(dir, "cache/model-capabilities.json"), labels[1]);
      const accessSchema = object(access.value) && access.value.version === 1 && object(access.value.entries)
        && Object.values(access.value.entries).every((group) => object(group)
          && Object.values(group).every((row) => object(row) && (row.s === "ok" || row.s === "refused")
            && typeof row.at === "number" && Number.isFinite(row.at)));
      const capabilitiesSchema = object(capabilities.value) && ids(capabilities.value.models, "id") !== null
        && typeof capabilities.value.timestamp === "number" && Number.isFinite(capabilities.value.timestamp);
      const sourceReasons = [access.reason, capabilities.reason].filter((reason) => reason !== null);
      const reason = sourceReasons.length ? sourceReasons.join("; ") : (!accessSchema || !capabilitiesSchema
        ? "Claude caches: unknown schema"
        : "Claude caches contain scoped access observations and token capabilities, not a complete harness availability catalogue");
      harnesses.push(compare(harness, labels, null, reason, null, register));
    }
  }
  return { harnesses };
}

if (import.meta.main) {
  if (process.argv.slice(2).some((arg) => arg !== "--json")) {
    console.error("Usage: bun model-scan.ts [--json]");
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(await scanModels(), null, 2));
  }
}

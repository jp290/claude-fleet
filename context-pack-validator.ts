import {
  CONTEXT_PACK_AUDIENCES,
  CONTEXT_PACK_CAPABILITIES,
  CONTEXT_PACK_EVIDENCE,
  CONTEXT_PACK_HARDNESS,
  CONTEXT_PACK_HARNESSES,
  CONTEXT_PACK_MODES,
  CONTEXT_PACK_SCOPES,
  CONTEXT_PACK_STATUSES,
  CONTEXT_PACK_TRIGGERS,
  type ContextPackCapability,
  type ContextPackHarness,
} from "./context-packs";

export const CONTEXT_PACK_VALIDATION_CODES = [
  "AUDIENCE_UNKNOWN",
  "CAPABILITY_AVAILABILITY_UNKNOWN",
  "CAPABILITY_SNAPSHOT_HARNESS_UNKNOWN",
  "CAPABILITY_SNAPSHOT_VALUE_UNKNOWN",
  "CAPABILITY_UNKNOWN",
  "EVIDENCE_UNKNOWN",
  "ESTIMATED_BYTES_INVALID",
  "HARNESS_UNKNOWN",
  "HARDNESS_UNKNOWN",
  "ID_DUPLICATE",
  "MODE_UNKNOWN",
  "OWNER_INVALID",
  "PACK_CONTENT_FORBIDDEN",
  "PACK_FIELD_INVALID",
  "PACK_REQUIRED_FIELD_MISSING",
  "PACK_UNKNOWN_KEY",
  "PRIVATE_SOURCE_HASH_INVALID",
  "PRIVATE_SOURCE_ID_INVALID",
  "PRIVATE_SOURCE_LEAK",
  "PUBLIC_SOURCE_REFERENCE_INVALID",
  "REQUIRED_CAPABILITY_MISSING",
  "SCOPE_UNKNOWN",
  "SET_VALUE_DUPLICATE",
  "SOURCE_ANCHOR_INVALID",
  "SOURCE_ANCHOR_MISSING",
  "SOURCE_BYTES_UNKNOWN",
  "SOURCE_CONTENT_FORBIDDEN",
  "SOURCE_OBSERVATION_INCOMPLETE",
  "SOURCE_OBSERVED_AT_INVALID",
  "SOURCE_PATH_INVALID",
  "SOURCE_PATH_MISSING",
  "SOURCE_SHAPE_INVALID",
  "SOURCE_UNKNOWN_KEY",
  "STATUS_UNKNOWN",
  "SUPERSEDES_CYCLE",
  "SUPERSEDES_TARGET_MISSING",
  "TRIGGER_UNKNOWN",
] as const;
export type ContextPackValidationCode = (typeof CONTEXT_PACK_VALIDATION_CODES)[number];

export interface ContextPackRepoFacts {
  readonly trackedPaths: ReadonlySet<string>;
  readonly sourceBytes: ReadonlyMap<string, string>;
}

// A missing harness key or null value means availability was not observed. An array is the
// complete set observed as present for that harness; absence from that set is a definite miss.
export type ContextPackCapabilitySnapshot = ReadonlyMap<string, readonly unknown[] | null>;

export interface ContextPackValidationInput {
  readonly packs: readonly unknown[];
  readonly repo: ContextPackRepoFacts;
  readonly capabilities: ContextPackCapabilitySnapshot;
}

export interface ContextPackValidationIssue {
  readonly code: ContextPackValidationCode;
  readonly severity: "error" | "unknown";
  readonly packId: string;
  readonly detail: string;
  readonly path?: string;
  readonly harness?: string;
  readonly capability?: string;
}

export interface ContextPackValidationResult {
  readonly verdict: "pass" | "fail" | "unknown";
  readonly issues: readonly ContextPackValidationIssue[];
}

type UnknownRecord = Record<string, unknown>;

const PACK_KEYS = new Set([
  "id", "scope", "audience", "triggers", "hardness", "sources", "requiredCapabilities",
  "harnesses", "modes", "estimatedBytes", "evidence", "owner", "status", "supersedes",
  "privateSourceId", "sourceHash", "observedAt",
]);
const BASE_REQUIRED = [
  "id", "scope", "audience", "triggers", "hardness", "requiredCapabilities", "harnesses",
  "modes", "estimatedBytes", "evidence", "owner", "status",
] as const;
const SOURCE_KEYS = new Set(["path", "anchor"]);
const CONTENT_KEY = /^(?:content|contents|prose|text|passage|quote|body)$/i;
const PRIVATE_LEAK_KEY = /^(?:path|anchor|privatePath|host|hostname|identity|version|versionClaim)$/i;
const PACK_ID = /^[a-z][a-z0-9-]*$/;
const PRIVATE_SOURCE_ID = /^opaque-[a-f0-9]{16,64}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const OBSERVED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const ANCHOR_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_.$:[\]`()/-]*$/;
const ANCHOR_DECLARATION = /^(?:export )?(?:const|let|function|class|interface|type) [A-Za-z_$][A-Za-z0-9_$]*(?:: readonly [A-Za-z_$][A-Za-z0-9_$]*\[\])? =?$/;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const inVocabulary = (value: unknown, vocabulary: readonly string[]): value is string =>
  typeof value === "string" && vocabulary.includes(value);
const validObservedAt = (value: unknown): value is string => {
  if (typeof value !== "string" || !OBSERVED_AT.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().replace(".000Z", "Z") === value;
};
const validAnchor = (value: unknown): value is string => {
  if (typeof value !== "string" || !value || value.length > 200 || /[\r\n]/.test(value)) return false;
  return /^#{1,6} \S/.test(value) || ANCHOR_IDENTIFIER.test(value) || ANCHOR_DECLARATION.test(value);
};

function canonicalCycle(ids: readonly string[]): string[] {
  if (ids.length < 2) return [...ids];
  const open = ids[0] === ids[ids.length - 1] ? ids.slice(0, -1) : [...ids];
  let best = open;
  for (let i = 1; i < open.length; i++) {
    const candidate = [...open.slice(i), ...open.slice(0, i)];
    if (candidate.join("\0") < best.join("\0")) best = candidate;
  }
  return [...best, best[0]];
}

/** Validate only injected facts. This function performs no filesystem, git, env, network, or server reads. */
export function validateContextPacks(input: ContextPackValidationInput): ContextPackValidationResult {
  const issues: ContextPackValidationIssue[] = [];
  const emit = (code: ContextPackValidationCode, severity: "error" | "unknown", packId: string,
    detail: string, extra: Partial<Pick<ContextPackValidationIssue, "path" | "harness" | "capability">> = {}): void => {
    issues.push({ code, severity, packId, detail, ...extra });
  };

  const packs: { index: number; id: string; value: UnknownRecord }[] = [];
  const ids = new Map<string, number>();

  for (let index = 0; index < input.packs.length; index++) {
    const raw = input.packs[index];
    const fallbackId = `#${index}`;
    if (!isRecord(raw)) {
      emit("PACK_FIELD_INVALID", "error", fallbackId, "pack must be an object");
      continue;
    }
    const packId = typeof raw.id === "string" ? raw.id : fallbackId;
    packs.push({ index, id: packId, value: raw });

    for (const key of Object.keys(raw).sort(textOrder)) {
      if (PACK_KEYS.has(key)) continue;
      if (CONTENT_KEY.test(key)) emit("PACK_CONTENT_FORBIDDEN", "error", packId, `content field is forbidden: ${key}`);
      else emit("PACK_UNKNOWN_KEY", "error", packId, `unknown pack key: ${key}`);
    }
    for (const field of BASE_REQUIRED) {
      if (!(field in raw)) emit("PACK_REQUIRED_FIELD_MISSING", "error", packId, `required field is missing: ${field}`);
    }

    if (typeof raw.id === "string") ids.set(raw.id, (ids.get(raw.id) ?? 0) + 1);
    if (typeof raw.id !== "string" || !PACK_ID.test(raw.id))
      emit("PACK_FIELD_INVALID", "error", packId, "id must be a lowercase kebab-case identifier");

    const scalarVocabulary = (field: string, vocabulary: readonly string[], code: ContextPackValidationCode): void => {
      if (!inVocabulary(raw[field], vocabulary)) emit(code, "error", packId, `unknown ${field}: ${String(raw[field])}`);
    };
    scalarVocabulary("scope", CONTEXT_PACK_SCOPES, "SCOPE_UNKNOWN");
    scalarVocabulary("audience", CONTEXT_PACK_AUDIENCES, "AUDIENCE_UNKNOWN");
    scalarVocabulary("hardness", CONTEXT_PACK_HARDNESS, "HARDNESS_UNKNOWN");
    scalarVocabulary("evidence", CONTEXT_PACK_EVIDENCE, "EVIDENCE_UNKNOWN");
    scalarVocabulary("status", CONTEXT_PACK_STATUSES, "STATUS_UNKNOWN");

    const arrayVocabulary = (field: string, vocabulary: readonly string[], code: ContextPackValidationCode): string[] => {
      const value = raw[field];
      if (!Array.isArray(value) || value.length === 0) {
        emit("PACK_FIELD_INVALID", "error", packId, `${field} must be a non-empty array`);
        return [];
      }
      const known: string[] = [];
      const seen = new Set<string>();
      for (const entry of value) {
        if (!inVocabulary(entry, vocabulary)) {
          emit(code, "error", packId, `unknown ${field} value: ${String(entry)}`);
          continue;
        }
        if (seen.has(entry)) emit("SET_VALUE_DUPLICATE", "error", packId, `duplicate ${field} value: ${entry}`);
        else { seen.add(entry); known.push(entry); }
      }
      return known;
    };
    arrayVocabulary("triggers", CONTEXT_PACK_TRIGGERS, "TRIGGER_UNKNOWN");
    arrayVocabulary("requiredCapabilities", CONTEXT_PACK_CAPABILITIES, "CAPABILITY_UNKNOWN");
    arrayVocabulary("harnesses", CONTEXT_PACK_HARNESSES, "HARNESS_UNKNOWN");
    arrayVocabulary("modes", CONTEXT_PACK_MODES, "MODE_UNKNOWN");

    if (raw.owner !== "owner") emit("OWNER_INVALID", "error", packId, "owner must be the promoting owner");
    if (typeof raw.estimatedBytes !== "number" || !Number.isFinite(raw.estimatedBytes) || raw.estimatedBytes < 0)
      emit("ESTIMATED_BYTES_INVALID", "error", packId, "estimatedBytes must be finite and nonnegative");
    if ("supersedes" in raw && (typeof raw.supersedes !== "string" || !PACK_ID.test(raw.supersedes)))
      emit("PACK_FIELD_INVALID", "error", packId, "supersedes must be a pack id");

    const isPrivate = raw.audience === "private-ops";
    if (isPrivate) {
      if ("sources" in raw) emit("PRIVATE_SOURCE_LEAK", "error", packId, "private pack must not carry sources");
      for (const key of Object.keys(raw).sort(textOrder)) {
        if (!PACK_KEYS.has(key) && PRIVATE_LEAK_KEY.test(key))
          emit("PRIVATE_SOURCE_LEAK", "error", packId, `private source reference leaks ${key}`);
      }
      for (const field of ["privateSourceId", "sourceHash", "observedAt"] as const)
        if (!(field in raw)) emit("PACK_REQUIRED_FIELD_MISSING", "error", packId, `private source field is missing: ${field}`);
      if (typeof raw.privateSourceId !== "string" || !PRIVATE_SOURCE_ID.test(raw.privateSourceId))
        emit("PRIVATE_SOURCE_ID_INVALID", "error", packId, "privateSourceId must be an opaque identifier");
      if (typeof raw.sourceHash !== "string" || !SHA256.test(raw.sourceHash))
        emit("PRIVATE_SOURCE_HASH_INVALID", "error", packId, "sourceHash must be a lowercase SHA-256");
      if (!validObservedAt(raw.observedAt))
        emit("SOURCE_OBSERVED_AT_INVALID", "error", packId, "observedAt must be a real UTC second timestamp");
    } else {
      if ("privateSourceId" in raw)
        emit("PUBLIC_SOURCE_REFERENCE_INVALID", "error", packId, "public pack must use tracked sources, not privateSourceId");
      if (!("sources" in raw)) emit("PACK_REQUIRED_FIELD_MISSING", "error", packId, "public source field is missing: sources");
      const hasHash = "sourceHash" in raw;
      const hasTime = "observedAt" in raw;
      if (hasHash !== hasTime)
        emit("SOURCE_OBSERVATION_INCOMPLETE", "error", packId, "sourceHash and observedAt must appear together");
      if (hasHash && (typeof raw.sourceHash !== "string" || !SHA256.test(raw.sourceHash)))
        emit("PRIVATE_SOURCE_HASH_INVALID", "error", packId, "sourceHash must be a lowercase SHA-256");
      if (hasTime && !validObservedAt(raw.observedAt))
        emit("SOURCE_OBSERVED_AT_INVALID", "error", packId, "observedAt must be a real UTC second timestamp");

      if (Array.isArray(raw.sources) && raw.sources.length === 0)
        emit("SOURCE_SHAPE_INVALID", "error", packId, "sources must be a non-empty array");
      else if (!Array.isArray(raw.sources)) {
        if ("sources" in raw) emit("SOURCE_SHAPE_INVALID", "error", packId, "sources must be an array");
      } else {
        for (let sourceIndex = 0; sourceIndex < raw.sources.length; sourceIndex++) {
          const source = raw.sources[sourceIndex];
          if (!isRecord(source)) {
            emit("SOURCE_SHAPE_INVALID", "error", packId, `source ${sourceIndex} must be an object`);
            continue;
          }
          for (const key of Object.keys(source).sort(textOrder)) {
            if (SOURCE_KEYS.has(key)) continue;
            if (CONTENT_KEY.test(key))
              emit("SOURCE_CONTENT_FORBIDDEN", "error", packId, `source content field is forbidden: ${key}`);
            else emit("SOURCE_UNKNOWN_KEY", "error", packId, `unknown source key: ${key}`);
          }
          const path = source.path;
          const anchor = source.anchor;
          const pathDetail = typeof path === "string" ? path : undefined;
          if (typeof path !== "string" || !path || path.startsWith("/") || path.split("/").includes("..")) {
            emit("SOURCE_PATH_INVALID", "error", packId, `source ${sourceIndex} path must be repo-relative`, pathDetail ? { path: pathDetail } : {});
            continue;
          }
          if (!validAnchor(anchor)) {
            emit("SOURCE_ANCHOR_INVALID", "error", packId, `source ${sourceIndex} anchor must be one heading, identifier, or symbol`, { path });
            continue;
          }
          if (!input.repo.trackedPaths.has(path)) {
            emit("SOURCE_PATH_MISSING", "error", packId, "source path is not tracked", { path });
            continue;
          }
          if (!input.repo.sourceBytes.has(path) || typeof input.repo.sourceBytes.get(path) !== "string") {
            emit("SOURCE_BYTES_UNKNOWN", "unknown", packId, "tracked source bytes were not supplied", { path });
            continue;
          }
          if (!input.repo.sourceBytes.get(path)!.includes(anchor))
            emit("SOURCE_ANCHOR_MISSING", "error", packId, "anchor is absent from supplied source bytes", { path });
        }
      }
    }
  }

  for (const [id, count] of [...ids].sort(([a], [b]) => textOrder(a, b)))
    if (count > 1) emit("ID_DUPLICATE", "error", id, `id occurs ${count} times`);

  const unique = new Map<string, UnknownRecord>();
  for (const pack of packs) if ((ids.get(pack.id) ?? 0) === 1) unique.set(pack.id, pack.value);
  for (const id of [...unique.keys()].sort(textOrder)) {
    const supersedes = unique.get(id)?.supersedes;
    if (typeof supersedes === "string" && !unique.has(supersedes))
      emit("SUPERSEDES_TARGET_MISSING", "error", id, `supersedes target does not exist uniquely: ${supersedes}`);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const emittedCycles = new Set<string>();
  const visit = (id: string): void => {
    const current = state.get(id);
    if (current === "done") return;
    if (current === "visiting") {
      const start = stack.indexOf(id);
      const cycle = canonicalCycle([...stack.slice(start), id]);
      const key = cycle.join(" -> ");
      if (!emittedCycles.has(key)) {
        emittedCycles.add(key);
        emit("SUPERSEDES_CYCLE", "error", cycle[0], key);
      }
      return;
    }
    state.set(id, "visiting");
    stack.push(id);
    const next = unique.get(id)?.supersedes;
    if (typeof next === "string" && unique.has(next)) visit(next);
    stack.pop();
    state.set(id, "done");
  };
  for (const id of [...unique.keys()].sort(textOrder)) visit(id);

  for (const [harness, available] of [...input.capabilities].sort(([a], [b]) => textOrder(a, b))) {
    if (!inVocabulary(harness, CONTEXT_PACK_HARNESSES)) {
      emit("CAPABILITY_SNAPSHOT_HARNESS_UNKNOWN", "error", "@capabilities", `unknown snapshot harness: ${harness}`, { harness });
      continue;
    }
    if (available === null) continue;
    if (!Array.isArray(available)) {
      emit("CAPABILITY_AVAILABILITY_UNKNOWN", "unknown", "@capabilities", "capability snapshot is not an array", { harness });
      continue;
    }
    for (const capability of available)
      if (!inVocabulary(capability, CONTEXT_PACK_CAPABILITIES))
        emit("CAPABILITY_SNAPSHOT_VALUE_UNKNOWN", "error", "@capabilities", `unknown available capability: ${String(capability)}`, { harness, capability: String(capability) });
  }

  for (const { id, value } of packs) {
    if (value.hardness !== "hard" || !Array.isArray(value.harnesses) || !Array.isArray(value.requiredCapabilities)) continue;
    const harnesses = value.harnesses.filter((entry): entry is ContextPackHarness => inVocabulary(entry, CONTEXT_PACK_HARNESSES));
    const required = value.requiredCapabilities.filter((entry): entry is ContextPackCapability => inVocabulary(entry, CONTEXT_PACK_CAPABILITIES));
    for (const harness of [...new Set(harnesses)].sort(textOrder)) {
      if (!input.capabilities.has(harness) || input.capabilities.get(harness) === null || !Array.isArray(input.capabilities.get(harness))) {
        emit("CAPABILITY_AVAILABILITY_UNKNOWN", "unknown", id, "required capability availability was not observed", { harness });
        continue;
      }
      const available = input.capabilities.get(harness)!;
      for (const capability of [...new Set(required)].sort(textOrder))
        if (!available.includes(capability))
          emit("REQUIRED_CAPABILITY_MISSING", "error", id, "hard pack requires a capability not observed as present", { harness, capability });
    }
  }

  issues.sort((a, b) => textOrder(a.code, b.code)
    || textOrder(a.packId, b.packId)
    || textOrder(a.path ?? "", b.path ?? "")
    || textOrder(a.harness ?? "", b.harness ?? "")
    || textOrder(a.capability ?? "", b.capability ?? "")
    || textOrder(a.detail, b.detail));
  const verdict = issues.some((issue) => issue.severity === "error")
    ? "fail" : issues.some((issue) => issue.severity === "unknown") ? "unknown" : "pass";
  return { verdict, issues };
}

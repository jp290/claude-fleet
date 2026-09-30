import type { SourceHorizon, TraceDetailRef, TraceEvent, TraceRefs } from "./trace-index";

export type NativeFormat = "claude-jsonl" | "codex-rollout-jsonl" | "pi-session-jsonl";
export interface NativeBinding {
  sessionId: string; cwd: string;
  occupation?: { sourceHost: string; sessionId: string; cwd: string; slot: number; openedAt: number; proofHash: string };
}
export interface NativeInput {
  sourceHost: string; sourceId: string; harness: string; format: string; version: string;
  bytes: Uint8Array; byteOffset: number; observedAt: number; binding: NativeBinding | null;
  redactions: readonly string[];
}
export interface NativeEvent extends TraceEvent {
  id: string; sourceHost: string; sourceVersion: string; sessionKey: string;
  occurredAt: number | null; observedAt: number; atClock: string; clockUncertainty: "unknown";
  record: { id: string | null; parent: string | null; offset: number; bytes: number; block: number; sidechain: boolean };
  tool: { name: string; namespace: string | null; family: string; innerCalls: "unsupported" | "not-applicable" };
  status: "ok" | "error" | "pending" | "late" | "unknown";
  outcome: "ok" | "error" | "unknown";
  pair: string | null;
  separation: { ms: number; clock: string; semantics: "record timestamp separation, not tool runtime" } | null;
  duration: null;
}
export interface NativeGap { code: string; offset?: number; bytes?: number }
export interface NativeSnapshot {
  schema: "fleet.trace-native/v1"; state: "read" | "pending" | "rejected" | "unsupported";
  format: string; harness: string; source: string; sourceHost: string; version: string;
  identity: { session: string; cwdHash: string; occupation: "unknown" | { slot: number; openedAt: number; proofHash: string };
    nativeVersion: 3 | "unknown"; parentSession: string | null } | null;
  identityKey: string | null; inputHash: string; inputBytes: number; completeBytes: number;
  events: NativeEvent[]; added: string[]; updated: string[]; invalidated: TraceDetailRef[];
  gaps: NativeGap[]; horizon: SourceHorizon;
}
interface Line { row: Record<string, unknown>; offset: number; bytes: number; fp: string }
interface ToolRecord { line: Line; block: number; call: string; name: string; namespace: string | null;
  family: string; result: boolean; outcome: NativeEvent["outcome"]; paths: string[] }
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
  ? v as Record<string, unknown> : {};
const text = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;
const timestamp = (v: unknown): number | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : null;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
async function hash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
const hashText = (s: string): Promise<string> => hash(encoder.encode(s));
const hasSecret = (s: string, input: NativeInput): boolean => input.redactions.some((m) => m.length > 0 && s.includes(m))
  || /(?:sk-[A-Za-z0-9]{12}|Bearer\s|x-fleet-self-token|-----BEGIN .*PRIVATE KEY)/i.test(s);
const token = (v: unknown, input: NativeInput): v is string => typeof v === "string"
  && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/.test(v) && !hasSecret(v, input);
const recordId = (line: Line, pi: boolean): string | null => text(line.row[pi ? "id" : "uuid"]);
const parentId = (line: Line, pi: boolean): string | null => text(line.row[pi ? "parentId" : "parentUuid"]);
const clockOf = (format: string): string => `${format} record.timestamp wallclock`;
const outcome = (v: unknown): NativeEvent["outcome"] => v === true ? "error" : v === false ? "ok" : "unknown";
function invalidatedRefs(previous: NativeSnapshot | undefined, input: NativeInput): TraceDetailRef[] {
  return previous?.events.flatMap((e) => {
    const ref = e.detailRef;
    return ref && token(ref.source, input) && /^native:[a-f0-9]{64}@\d+\+\d+#\d+$/.test(ref.locator)
      && /^[a-f0-9]{16}$/.test(ref.fp ?? "")
      ? [{ source: ref.source, locator: ref.locator, fp: ref.fp }] : [];
  }) ?? [];
}
function pathsOf(v: unknown, input: NativeInput): string[] {
  const p = text(v);
  if (!p || hasSecret(p, input) || p.startsWith("/") || p.includes("\\") || /[\x00-\x1f]/.test(p)
    || p.split("/").some((s) => s === ".." || s === "" || s === ".")) return [];
  return [p];
}
function toolRecords(line: Line, input: NativeInput, gaps: NativeGap[]): ToolRecord[] {
  const row = line.row, m = obj(row.message), p = obj(row.payload);
  const found: ToolRecord[] = [];
  const add = (block: number, family: string, result: boolean,
    call: unknown, name: unknown, namespace: unknown, error: unknown, path: unknown): void => {
    if (!token(call, input) || (!result && !token(name, input)) || (namespace != null && !token(namespace, input))) {
      gaps.push({ code: "invalid-tool-metadata", offset: line.offset, bytes: line.bytes }); return;
    }
    found.push({ line, block, family, result, call, name: result ? "unknown" : name as string,
      namespace: typeof namespace === "string" ? namespace : null, outcome: outcome(error), paths: pathsOf(path, input) });
  };
  if (input.format === "codex-rollout-jsonl" && row.type === "response_item") {
    if (p.type === "function_call" || p.type === "custom_tool_call")
      add(0, p.type, false, p.call_id, p.name, p.namespace, undefined, undefined);
    else if (p.type === "function_call_output" || p.type === "custom_tool_call_output")
      add(0, p.type.replace("_output", ""), true, p.call_id, null, null, undefined, undefined);
    else if (typeof p.type === "string" && /call|output/.test(p.type))
      gaps.push({ code: "unsupported-codex-item", offset: line.offset, bytes: line.bytes });
  } else if (input.format === "pi-session-jsonl" && row.type === "message" && m.role === "toolResult") {
    add(0, "toolCall", true, m.toolCallId, m.toolName, null, m.isError, undefined);
  } else if (Array.isArray(m.content)) {
    m.content.forEach((v: unknown, n: number) => {
      const b = obj(v);
      if (input.format === "claude-jsonl") {
        if (row.type === "assistant" && b.type === "tool_use")
          add(n, "tool_use", false, b.id, b.name, null, undefined,
            b.name === "Edit" || b.name === "Write" ? obj(b.input).file_path : undefined);
        if (row.type === "user" && b.type === "tool_result")
          add(n, "tool_use", true, b.tool_use_id, null, null, b.is_error, undefined);
      } else if (input.format === "pi-session-jsonl" && row.type === "message" && m.role === "assistant" && b.type === "toolCall")
        add(n, "toolCall", false, b.id, b.name, null, undefined, b.name === "edit" ? obj(b.arguments).path : undefined);
    });
  }
  return found;
}

// Snapshots contain the supplied generation only. The optional prior snapshot is evidence for
// append/replay/late detection, never a source of raw bytes or a permission to carry old events.
export async function normalizeNative(input: NativeInput, previous?: NativeSnapshot): Promise<NativeSnapshot> {
  const safe = (s: string): string => token(s, input) ? s : "redacted";
  const source = safe(input.sourceId), host = safe(input.sourceHost), version = safe(input.version);
  const observed = Number.isFinite(input.observedAt) ? input.observedAt : 0;
  const snapshot: NativeSnapshot = { schema: "fleet.trace-native/v1", state: "read", format: safe(input.format),
    harness: safe(input.harness), source, sourceHost: host, version, identity: null, identityKey: null, inputHash: await hash(input.bytes), inputBytes: input.bytes.length,
    completeBytes: 0, events: [], added: [], updated: [], invalidated: [], gaps: [],
    horizon: { source, state: "unmeasured", reason: "no complete bound native records", clock: clockOf(safe(input.format)) } };
  const stop = (state: NativeSnapshot["state"], code: string): NativeSnapshot => {
    snapshot.state = state; snapshot.gaps.push({ code });
    snapshot.events = []; snapshot.added = []; snapshot.updated = []; snapshot.identity = null; snapshot.identityKey = null;
    snapshot.invalidated = invalidatedRefs(previous, input);
    return snapshot;
  };
  const pi = input.format === "pi-session-jsonl";
  const supported = input.format === "claude-jsonl" && input.harness === "claude"
    || input.format === "codex-rollout-jsonl" && input.harness === "codex"
    || pi && ["pi", "pi-zai", "pi-ox"].includes(input.harness);
  if (!supported) return stop("unsupported", "unsupported-harness-format");
  if (![input.sourceId, input.sourceHost, input.version].every((s) => token(s, input))
    || input.byteOffset !== 0 || !Number.isFinite(input.observedAt)) return stop("rejected", "invalid-source-metadata");
  const binding = input.binding;
  if (!binding || !UUID.test(binding.sessionId) || hasSecret(binding.sessionId, input)
    || !binding.cwd.startsWith("/") || hasSecret(binding.cwd, input)) return stop("rejected", "missing-binding");
  const occupation = binding.occupation;
  if (occupation && (occupation.sourceHost !== input.sourceHost || occupation.sessionId !== binding.sessionId
    || occupation.cwd !== binding.cwd || !Number.isInteger(occupation.slot) || occupation.slot < 0
    || !Number.isFinite(occupation.openedAt) || !/^[0-9a-f]{64}$/.test(occupation.proofHash)))
    return stop("rejected", "occupation-mismatch");
  const lines: Line[] = [];
  let offset = 0;
  for (let end = input.bytes.indexOf(10); end >= 0; end = input.bytes.indexOf(10, offset)) {
    const raw = input.bytes.subarray(offset, end);
    try {
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      lines.push({ row: obj(parsed), offset, bytes: end - offset, fp: await hash(raw) });
    } catch { snapshot.gaps.push({ code: "malformed-record", offset, bytes: end - offset }); }
    offset = end + 1;
  }
  snapshot.completeBytes = offset;
  if (offset < input.bytes.length) snapshot.gaps.push({ code: "partial-record", offset, bytes: input.bytes.length - offset });
  if (!lines.length) return stop(offset < input.bytes.length ? "pending" : "rejected", "missing-identity-record");
  let parentSession: string | null = null;
  if (input.format === "codex-rollout-jsonl" || pi) {
    const first = lines[0]!, p = pi ? first.row : obj(first.row.payload);
    if (first.offset !== 0 || first.row.type !== (pi ? "session" : "session_meta")) return stop("rejected", "missing-header");
    if (pi && p.version !== 3) return stop("unsupported", "unsupported-pi-version");
    if (!pi && (!text(p.thread_source) || timestamp(p.timestamp) === null)) return stop("rejected", "invalid-codex-header");
    if (p.id !== binding.sessionId) return stop("rejected", "session-id-mismatch");
    if (p.cwd !== binding.cwd) return stop("rejected", "cwd-mismatch");
    if (!pi) {
      const parent = obj(obj(obj(p.source).subagent).thread_spawn).parent_thread_id;
      if (parent != null && (typeof parent !== "string" || !UUID.test(parent) || hasSecret(parent, input)))
        return stop("rejected", "invalid-parent-session");
      parentSession = text(parent);
      if (parentSession && p.thread_source !== "subagent") return stop("rejected", "contradictory-parent-session");
    }
  }
  let claudeIdentity = false;
  for (const line of lines) {
    const r = line.row, p = obj(r.payload);
    if (r.sessionId != null && r.sessionId !== binding.sessionId) return stop("rejected", "session-id-mismatch");
    if (r.cwd != null && r.cwd !== binding.cwd) return stop("rejected", "cwd-mismatch");
    if (input.format === "codex-rollout-jsonl" && r.type === "session_meta") {
      if (p.id !== binding.sessionId) return stop("rejected", "session-id-mismatch");
      if (p.cwd !== binding.cwd) return stop("rejected", "cwd-mismatch");
    }
    if (input.format === "codex-rollout-jsonl" && p.cwd != null && p.cwd !== binding.cwd)
      return stop("rejected", "cwd-mismatch");
    if (pi && r.type === "session" && r.version !== 3) return stop("unsupported", "unsupported-pi-version");
    if (pi && r.type === "session" && (r.id !== binding.sessionId || r.cwd !== binding.cwd))
      return stop("rejected", "conflicting-header");
    if (input.format === "claude-jsonl" && (r.type === "assistant" || r.type === "user")) {
      if (r.sessionId !== binding.sessionId) return stop("rejected", "session-id-mismatch");
      if (r.cwd !== binding.cwd) return stop("rejected", "cwd-mismatch");
      claudeIdentity = true;
    }
    const id = recordId(line, pi), parent = parentId(line, pi);
    if ((id !== null && !token(id, input)) || (parent !== null && !token(parent, input)))
      return stop("rejected", "invalid-record-identity");
  }
  if (input.format === "claude-jsonl" && !claudeIdentity) return stop("rejected", "missing-identity-record");
  snapshot.identityKey = await hashText(JSON.stringify([host, source, input.harness, input.format, version,
    binding.sessionId, binding.cwd, occupation ?? null]));
  snapshot.identity = { session: binding.sessionId, cwdHash: await hashText(binding.cwd),
    occupation: occupation ? { slot: occupation.slot, openedAt: occupation.openedAt, proofHash: occupation.proofHash } : "unknown",
    nativeVersion: pi ? 3 : "unknown", parentSession };
  const same = previous?.identityKey === snapshot.identityKey;
  const append = same && previous.inputBytes <= input.bytes.length
    && await hash(input.bytes.subarray(0, previous.inputBytes)) === previous.inputHash;
  const prior = append ? previous.events : [];
  if (previous && !append) {
    snapshot.invalidated = invalidatedRefs(previous, input);
    snapshot.gaps.push({ code: same ? "source-rewritten" : "source-generation-or-binding-changed" });
  }
  const nodes = new Map<string, string | null>();
  for (const line of lines) {
    if (pi && line.row.type === "session") continue;
    const id = recordId(line, pi);
    if (!id) continue;
    const parent = parentId(line, pi);
    if (nodes.has(id) && nodes.get(id) !== parent) return stop("rejected", "conflicting-record-parent");
    nodes.set(id, parent);
  }
  const ancestor = (from: string | null, target: string): boolean => {
    const seen = new Set<string>();
    for (let id = from; id && !seen.has(id); id = nodes.get(id) ?? null) {
      if (id === target) return true;
      seen.add(id);
    }
    return false;
  };
  const records = lines.flatMap((l) => toolRecords(l, input, snapshot.gaps));
  const calls = new Map<string, NativeEvent[]>();
  const seen = new Map<string, string>();
  const emit = async (r: ToolRecord): Promise<NativeEvent | null> => {
    const id = recordId(r.line, pi), parent = parentId(r.line, pi);
    if ((pi || input.format === "claude-jsonl") && !id) {
      snapshot.gaps.push({ code: "missing-record-id", offset: r.line.offset }); return null;
    }
    const key = JSON.stringify([r.family, r.call, r.result, pi ? id : null]);
    const replay = seen.get(key);
    if (replay) {
      if (replay !== r.line.fp) snapshot.gaps.push({ code: "conflicting-tool-replay", offset: r.line.offset });
      return null;
    }
    seen.set(key, r.line.fp);
    const eventId = await hashText(`${snapshot.identityKey}:${key}`);
    const occurredAt = timestamp(r.line.row.timestamp);
    const refs: TraceRefs = { session: binding.sessionId, call: r.call,
      ...(parent ? { parent } : {}), ...(occupation ? { slot: occupation.slot, openedAt: occupation.openedAt } : {}) };
    const detailRef: TraceDetailRef = { source, locator: `native:${snapshot.identityKey}@${r.line.offset}+${r.line.bytes}#${r.block}`,
      fp: r.line.fp.slice(0, 16) };
    const old = prior.find((e) => e.id === eventId && e.detailRef?.fp === detailRef.fp);
    const e: NativeEvent = { id: eventId, source, kind: r.result ? "tool.result" : "tool.call", at: occurredAt ?? (old?.observedAt ?? observed),
      refs, files: r.paths, detailRef, sourceHost: host, sourceVersion: version, sessionKey: snapshot.identityKey!,
      occurredAt, observedAt: old?.observedAt ?? observed, atClock: occurredAt === null ? "observer wallclock" : clockOf(input.format),
      clockUncertainty: "unknown", record: { id, parent, offset: r.line.offset, bytes: r.line.bytes, block: r.block,
        sidechain: r.line.row.isSidechain === true }, tool: { name: r.name, namespace: r.namespace, family: r.family,
        innerCalls: r.name === "exec" && input.format === "codex-rollout-jsonl" ? "unsupported" : "not-applicable" },
      status: r.result ? r.outcome : "pending", outcome: r.outcome, pair: null, separation: null, duration: null };
    if (parentSession) e.edge = { from: { kind: "occupant", session: parentSession },
      to: { kind: "occupant", session: binding.sessionId }, channel: "native-subagent-parent" };
    snapshot.events.push(e); return e;
  };
  for (const r of records.filter((r) => !r.result)) {
    const e = await emit(r);
    if (e) { const key = `${r.family}:${r.call}`; calls.set(key, [...calls.get(key) ?? [], e]); }
  }
  for (const r of records.filter((r) => r.result)) {
    const e = await emit(r);
    if (!e) continue;
    const candidates = (calls.get(`${r.family}:${r.call}`) ?? []).filter((c) => !pi
      || c.record.id !== null && ancestor(e.record.parent, c.record.id));
    if (candidates.length !== 1 || candidates[0]!.pair) {
      snapshot.gaps.push({ code: candidates.length > 1 ? "ambiguous-result" : "orphan-result", offset: r.line.offset }); continue;
    }
    const c = candidates[0]!;
    e.pair = c.id; c.pair = e.id; e.tool = c.tool;
    const wasPending = prior.some((p) => p.id === c.id && p.status === "pending");
    const wasLate = prior.some((p) => p.id === e.id && p.status === "late");
    e.status = wasPending || wasLate ? "late" : r.outcome; c.status = e.status; c.outcome = r.outcome;
    if (e.occurredAt !== null && c.occurredAt !== null && e.occurredAt >= c.occurredAt) {
      e.separation = c.separation = { ms: e.occurredAt - c.occurredAt, clock: clockOf(input.format),
        semantics: "record timestamp separation, not tool runtime" };
    }
  }
  if (snapshot.gaps.some((g) => g.code === "conflicting-tool-replay")) return stop("rejected", "ambiguous-call-identity");
  snapshot.events.sort((a, b) => a.at - b.at || a.record.offset - b.record.offset || a.record.block - b.record.block);
  for (const e of snapshot.events) {
    const old = prior.find((p) => p.id === e.id);
    if (!old) snapshot.added.push(e.id);
    else if (JSON.stringify(old) !== JSON.stringify(e)) snapshot.updated.push(e.id);
    if (e.status === "pending") snapshot.gaps.push({ code: "missing-result", offset: e.record.offset });
  }
  const times = lines.map((l) => timestamp(l.row.timestamp)).filter((t): t is number => t !== null);
  if (times.length) snapshot.horizon = { source, state: "read", oldestAt: times.reduce((a, b) => Math.min(a, b)), newestAt: times.reduce((a, b) => Math.max(a, b)),
    rows: lines.length, malformed: snapshot.gaps.filter((g) => g.code === "malformed-record").length,
    generations: [{ gen: version, rows: lines.length, bytes: input.bytes.length }], clock: clockOf(input.format) };
  return snapshot;
}

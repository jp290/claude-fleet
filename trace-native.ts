// Native trace projection from explicitly supplied, identity-bound JSONL bytes; no source discovery or detail reader.
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
  identityKey: string | null; inputHash: string; inputHashOffset: number; inputBytes: number; completeBytes: number;
  events: NativeEvent[]; added: string[]; updated: string[]; invalidated: TraceDetailRef[];
  gaps: NativeGap[]; horizon: SourceHorizon;
}
interface Line { row: Record<string, unknown>; offset: number; bytes: number; fp: string }
interface NativeReadState {
  tail: Uint8Array; skipping: boolean; binding: string; header: Line | undefined;
  chunks: { offset: number; bytes: number; hash: string }[]; rows: number;
  oldestAt: number | null; newestAt: number | null; claudeIdentity: boolean;
  nodes: Map<string, string | null>; seen: Map<string, string>; events: Map<string, NativeEvent>;
  calls: Map<string, NativeEvent[]>; results: Map<string, NativeEvent[]>;
  gaps: NativeGap[]; pairGaps: Map<string, NativeGap>; pending: Map<string, NativeEvent>;
}
const readStates = new WeakMap<NativeSnapshot, NativeReadState>();
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
const callToken = (v: unknown, input: NativeInput): v is string => typeof v === "string"
  && /^[A-Za-z0-9][A-Za-z0-9_.:|=-]{0,255}$/.test(v) && !hasSecret(v, input);
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
    if (!callToken(call, input) || (!result && !token(name, input)) || (namespace != null && !token(namespace, input))) {
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

// Contiguous deltas consume the prior parser state once; snapshots keep immutable event values.
// Full snapshots verify retained block hashes before carrying observation times or references.
export async function normalizeNative(input: NativeInput, previous?: NativeSnapshot): Promise<NativeSnapshot> {
  const bindingKey = JSON.stringify([input.sourceHost, input.sourceId, input.harness, input.format, input.version, input.binding, input.redactions]);
  const previousState = previous ? readStates.get(previous) : undefined;
  const candidateState = input.byteOffset > 0 && previous?.inputBytes === input.byteOffset ? previousState : undefined;
  const prefix = candidateState?.binding === bindingKey ? candidateState : undefined;
  if (prefix && previous) readStates.delete(previous);
  const safe = (s: string): string => token(s, input) ? s : "redacted";
  const source = safe(input.sourceId), host = safe(input.sourceHost), version = safe(input.version);
  const observed = Number.isFinite(input.observedAt) ? input.observedAt : 0;
  const snapshot: NativeSnapshot = { schema: "fleet.trace-native/v1", state: "read", format: safe(input.format),
    harness: safe(input.harness), source, sourceHost: host, version, identity: null, identityKey: null, inputHash: await hash(input.bytes), inputHashOffset: input.byteOffset, inputBytes: input.bytes.length,
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
    || (input.byteOffset !== 0 && !prefix) || !Number.isFinite(input.observedAt)) return stop("rejected", "invalid-source-metadata");
  const binding = input.binding;
  if (!binding || !UUID.test(binding.sessionId) || hasSecret(binding.sessionId, input)
    || !binding.cwd.startsWith("/") || hasSecret(binding.cwd, input)) return stop("rejected", "missing-binding");
  const occupation = binding.occupation;
  if (occupation && (occupation.sourceHost !== input.sourceHost || occupation.sessionId !== binding.sessionId
    || occupation.cwd !== binding.cwd || !Number.isInteger(occupation.slot) || occupation.slot < 0
    || !Number.isFinite(occupation.openedAt) || !/^[0-9a-f]{64}$/.test(occupation.proofHash)))
    return stop("rejected", "occupation-mismatch");
  const state: NativeReadState = prefix ?? { tail: new Uint8Array(), skipping: false, binding: bindingKey,
    header: undefined, chunks: [], rows: 0, oldestAt: null, newestAt: null, claudeIdentity: false,
    nodes: new Map(), seen: new Map(), events: new Map(), calls: new Map(), results: new Map(),
    gaps: [], pairGaps: new Map(), pending: new Map() };
  state.chunks.push({ offset: input.byteOffset, bytes: input.bytes.length, hash: snapshot.inputHash });
  const lines: Line[] = [];
  const bytes = prefix ? new Uint8Array(prefix.tail.length + input.bytes.length) : input.bytes;
  if (prefix) { bytes.set(prefix.tail); bytes.set(input.bytes, prefix.tail.length); }
  const baseOffset = prefix ? input.byteOffset - prefix.tail.length : 0;
  let offset = 0, skipping = prefix?.skipping ?? false;
  for (let end = bytes.indexOf(10); end >= 0; end = bytes.indexOf(10, offset)) {
    const raw = bytes.subarray(offset, end);
    if (skipping || raw.length > 8_388_608) {
      snapshot.gaps.push({ code: "oversized-record", offset: baseOffset + offset, bytes: raw.length });
      skipping = false; offset = end + 1; continue;
    }
    try {
      const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw));
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      const row = obj(parsed), message = obj(row.message), payload = obj(row.payload);
      const content = Array.isArray(message.content) ? message.content.map((v: unknown) => {
        const block = obj(v);
        return { type: block.type, id: block.id, name: block.name, tool_use_id: block.tool_use_id,
          is_error: block.is_error, input: { file_path: obj(block.input).file_path },
          arguments: { path: obj(block.arguments).path } };
      }) : undefined;
      lines.push({ row: { type: row.type, version: row.version, id: row.id, cwd: row.cwd,
        uuid: row.uuid, parentUuid: row.parentUuid, parentId: row.parentId, sessionId: row.sessionId,
        timestamp: row.timestamp, isSidechain: row.isSidechain,
        payload: { type: payload.type, id: payload.id, cwd: payload.cwd, timestamp: payload.timestamp,
          thread_source: payload.thread_source, source: { subagent: { thread_spawn: {
            parent_thread_id: obj(obj(obj(payload.source).subagent).thread_spawn).parent_thread_id } } }, call_id: payload.call_id,
          name: payload.name, namespace: payload.namespace },
        message: { role: message.role, toolCallId: message.toolCallId, toolName: message.toolName,
          isError: message.isError, content } }, offset: baseOffset + offset, bytes: end - offset, fp: await hash(raw) });
    } catch { snapshot.gaps.push({ code: "malformed-record", offset: baseOffset + offset, bytes: end - offset }); }
    offset = end + 1;
  }
  snapshot.inputBytes = input.byteOffset + input.bytes.length;
  snapshot.completeBytes = baseOffset + offset;
  state.gaps.push(...snapshot.gaps);
  if (offset < bytes.length) snapshot.gaps.push({ code: "partial-record", offset: baseOffset + offset, bytes: bytes.length - offset });
  let tail = bytes.slice(offset);
  if (skipping || tail.length > 8_388_608) {
    const gap = { code: "oversized-record", offset: baseOffset + offset, bytes: tail.length };
    snapshot.gaps.push(gap); state.gaps.push(gap);
    tail = new Uint8Array(); skipping = true;
  }
  state.tail = tail; state.skipping = skipping;
  state.header ??= lines[0];
  if (!state.header) {
    if (offset < bytes.length) readStates.set(snapshot, state);
    return stop(offset < bytes.length ? "pending" : "rejected", "missing-identity-record");
  }
  let parentSession: string | null = null;
  if (input.format === "codex-rollout-jsonl" || pi) {
    const first = state.header, p = pi ? first.row : obj(first.row.payload);
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
  let claudeIdentity = state.claudeIdentity;
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
  let prefixVerified = !!prefix, prefixUnknown = false;
  if (same && !prefix && previous.inputBytes <= input.bytes.length) {
    if (previousState?.binding === bindingKey) {
      prefixVerified = true;
      for (const chunk of previousState.chunks) {
        if (await hash(input.bytes.subarray(chunk.offset, chunk.offset + chunk.bytes)) !== chunk.hash) {
          prefixVerified = false; break;
        }
      }
    } else if (previous.inputHashOffset === 0) {
      prefixVerified = await hash(input.bytes.subarray(0, previous.inputBytes)) === previous.inputHash;
    } else prefixUnknown = true;
  }
  const append = same && prefixVerified;
  const prior = append ? previous.events : [];
  const priorById = prefix ? state.events : new Map(prior.map((e) => [e.id, e]));
  if (previous && !append) {
    snapshot.invalidated = invalidatedRefs(previous, input);
    snapshot.gaps.push({ code: same ? prefixUnknown ? "source-prefix-unverified" : "source-rewritten" : "source-generation-or-binding-changed" });
  }
  const nodes = state.nodes;
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
  const calls = state.calls, seen = state.seen;
  const touched = new Map<string, NativeEvent | undefined>();
  const changedKeys = new Set<string>();
  const remember = (event: NativeEvent): void => {
    if (!touched.has(event.id)) touched.set(event.id, priorById.get(event.id));
    state.events.set(event.id, event);
  };
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
    const candidate = priorById.get(eventId);
    const old = candidate?.detailRef?.fp === detailRef.fp ? candidate : undefined;
    const e: NativeEvent = { id: eventId, source, kind: r.result ? "tool.result" : "tool.call", at: occurredAt ?? (old?.observedAt ?? observed),
      refs, files: r.paths, detailRef, sourceHost: host, sourceVersion: version, sessionKey: snapshot.identityKey!,
      occurredAt, observedAt: old?.observedAt ?? observed, atClock: occurredAt === null ? "observer wallclock" : clockOf(input.format),
      clockUncertainty: "unknown", record: { id, parent, offset: r.line.offset, bytes: r.line.bytes, block: r.block,
        sidechain: r.line.row.isSidechain === true }, tool: { name: r.name, namespace: r.namespace, family: r.family,
        innerCalls: r.name === "exec" && input.format === "codex-rollout-jsonl" ? "unsupported" : "not-applicable" },
      status: r.result ? r.outcome : "pending", outcome: r.outcome, pair: null, separation: null, duration: null };
    if (parentSession) e.edge = { from: { kind: "occupant", session: parentSession },
      to: { kind: "occupant", session: binding.sessionId }, channel: "native-subagent-parent" };
    remember(e); return e;
  };
  for (const r of records.filter((r) => !r.result)) {
    const e = await emit(r);
    if (e) { const key = `${r.family}:${r.call}`; const bucket = calls.get(key) ?? [];
      bucket.push(e); calls.set(key, bucket); changedKeys.add(key); }
  }
  for (const r of records.filter((r) => r.result)) {
    const e = await emit(r);
    if (e) { const key = `${r.family}:${r.call}`; const bucket = state.results.get(key) ?? [];
      bucket.push(e); state.results.set(key, bucket); changedKeys.add(key); }
  }
  // A newly retained ancestor may bind an earlier orphan without revalidating old records.
  if (pi && lines.length) for (const id of state.pairGaps.keys()) {
    const e = state.events.get(id)!; changedKeys.add(`${e.tool.family}:${e.refs.call}`);
  }
  for (const key of changedKeys) {
    const callBucket: NativeEvent[] = (calls.get(key) ?? []).map((c) => ({ ...c, pair: null, separation: null }));
    const resultBucket = state.results.get(key) ?? [];
    for (let i = 0; i < resultBucket.length; i++) {
      const oldResult = resultBucket[i]!, e = { ...oldResult, pair: null, separation: null } as NativeEvent;
      state.pairGaps.delete(e.id);
      const candidates = callBucket.filter((c) => !pi || c.record.id !== null && ancestor(e.record.parent, c.record.id));
      if (candidates.length !== 1 || candidates[0]!.pair) {
        state.pairGaps.set(e.id, { code: candidates.length > 1 ? "ambiguous-result" : "orphan-result", offset: e.record.offset });
      } else {
        const c = candidates[0]!;
        e.pair = c.id; c.pair = e.id; e.tool = c.tool;
        const wasPending = (touched.has(c.id) ? touched.get(c.id) : priorById.get(c.id))?.status === "pending";
        const wasLate = oldResult.status === "late" || priorById.get(e.id)?.status === "late";
        e.status = wasPending || wasLate ? "late" : e.outcome; c.status = e.status; c.outcome = e.outcome;
        if (e.occurredAt !== null && c.occurredAt !== null && e.occurredAt >= c.occurredAt) {
          e.separation = c.separation = { ms: e.occurredAt - c.occurredAt, clock: clockOf(input.format),
            semantics: "record timestamp separation, not tool runtime" };
        }
      }
      resultBucket[i] = e; remember(e);
    }
    for (const c of callBucket) {
      if (!c.pair) { c.status = "pending"; c.outcome = "unknown"; state.pending.set(c.id, c); }
      else state.pending.delete(c.id);
      remember(c);
    }
    calls.set(key, callBucket);
  }
  if (snapshot.gaps.some((g) => g.code === "conflicting-tool-replay")) return stop("rejected", "ambiguous-call-identity");
  state.gaps.push(...snapshot.gaps.filter((g) => !["partial-record", "malformed-record", "oversized-record"].includes(g.code)));
  snapshot.gaps = [...state.gaps, ...snapshot.gaps.filter((g) => g.code === "partial-record"),
    ...state.pairGaps.values(), ...[...state.pending.values()].map((e) => ({ code: "missing-result", offset: e.record.offset }))];
  snapshot.events = [...state.events.values()].sort((a, b) => a.at - b.at || a.record.offset - b.record.offset || a.record.block - b.record.block);
  for (const [id, old] of touched) {
    if (!old) snapshot.added.push(id);
    else if (JSON.stringify(old) !== JSON.stringify(state.events.get(id))) snapshot.updated.push(id);
  }
  for (const line of lines) {
    const time = timestamp(line.row.timestamp);
    if (time !== null) {
      state.oldestAt = Math.min(state.oldestAt ?? time, time);
      state.newestAt = Math.max(state.newestAt ?? time, time);
    }
  }
  state.rows += lines.length; state.claudeIdentity = claudeIdentity;
  if (state.oldestAt !== null) snapshot.horizon = { source, state: "read", oldestAt: state.oldestAt, newestAt: state.newestAt!,
    rows: state.rows, malformed: state.gaps.filter((g) => g.code === "malformed-record").length,
    generations: [{ gen: version, rows: state.rows, bytes: snapshot.inputBytes }], clock: clockOf(input.format) };
  readStates.set(snapshot, state);
  return snapshot;
}

// THE DETAIL SIDE: one retained record's tool block, read back by a caller that already holds the
// exact byte range of an indexed event. The list above drops arguments and result text; this is the
// only place they are decoded again, and everything leaving it has passed redactDetail first.
export const DETAIL_FIELD_BYTES = 65_536;
const SECRET_KEY = /token$|secret|passw|api[_-]?key|authorization|cookie|credential|private[_-]?key/i;
const SECRET_SPANS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bsk-[A-Za-z0-9_-]{12,}/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(x-fleet-self-token["']?\s*[:=]\s*["']?)[^\s'"]+/gi,
  // what the markers above never knew: a secret-named assignment, a basic credential, a URL login, vendor key shapes
  /(\b[A-Za-z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|CREDENTIALS?)(?:_[A-Za-z0-9]+)*["']?\s*[=:]\s*["']?)[^\s'"&;,}]+/gi,
  /(Basic\s+)[A-Za-z0-9+/=]{8,}/g, /(:\/\/[^\s:/@]+:)[^\s@/]+(?=@)/g,
  /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g, /\bAKIA[0-9A-Z]{16}\b/g,
];
export function redactText(s: string, redactions: readonly string[]): string {
  let out = s;
  for (const m of [...redactions].filter((m) => m.length > 0).sort((a, b) => b.length - a.length))
    if (out.includes(m)) out = out.split(m).join("[redacted]");
  for (const re of SECRET_SPANS) out = out.replace(re, (_m: string, keep?: unknown) => `${typeof keep === "string" ? keep : ""}[redacted]`);
  return out;
}
export function redactDetail(v: unknown, redactions: readonly string[]): unknown {
  if (typeof v === "string") return redactText(v, redactions);
  if (Array.isArray(v)) return v.map((x) => redactDetail(x, redactions));
  if (v !== null && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [redactText(k, redactions),
      SECRET_KEY.test(k) && typeof x === "string" ? "[redacted]" : redactDetail(x, redactions)]));
  return v;
}
export type DetailField = { value: unknown; bytes: number; truncated: false }
  | { value: null; preview: string; bytes: number; truncated: true };
function field(v: unknown, redactions: readonly string[]): DetailField | null {
  if (v === undefined || v === null) return null;
  const clean = redactDetail(v, redactions), json = JSON.stringify(clean), bytes = encoder.encode(json).length;
  if (bytes <= DETAIL_FIELD_BYTES) return { value: clean, bytes, truncated: false };
  return { value: null, preview: new TextDecoder().decode(encoder.encode(json).slice(0, DETAIL_FIELD_BYTES)).replace(/�$/, ""),
    bytes, truncated: true };
}
export interface NativeDetailPart { arguments: DetailField | null; result: DetailField | null; error: DetailField | null }
// raw is the record WITHOUT its LF, exactly the bytes the event's fp was taken over.
export function nativeDetailOf(format: string, raw: Uint8Array, block: number, kind: string, call: string,
  redactions: readonly string[]): { ok: true; part: NativeDetailPart } | { ok: false; code: string } {
  let row: Record<string, unknown>;
  try { row = obj(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw))); } catch { return { ok: false, code: "malformed-record" }; }
  const m = obj(row.message), p = obj(row.payload), content = Array.isArray(m.content) ? m.content : [];
  const b = obj(content[block]);
  const none: NativeDetailPart = { arguments: null, result: null, error: null };
  const result = (v: unknown, isError: unknown): NativeDetailPart => isError === true
    ? { ...none, error: field(v, redactions) } : { ...none, result: field(v, redactions) };
  if (format === "claude-jsonl") {
    if (kind === "tool.call" && b.type === "tool_use" && b.id === call) return { ok: true, part: { ...none, arguments: field(b.input ?? {}, redactions) } };
    if (kind === "tool.result" && b.type === "tool_result" && b.tool_use_id === call) return { ok: true, part: result(b.content, b.is_error) };
  } else if (format === "codex-rollout-jsonl" && block === 0 && p.call_id === call) {
    if (kind === "tool.call" && (p.type === "function_call" || p.type === "custom_tool_call"))
      return { ok: true, part: { ...none, arguments: field(p.type === "function_call" ? p.arguments : p.input, redactions) } };
    if (kind === "tool.result" && (p.type === "function_call_output" || p.type === "custom_tool_call_output"))
      return { ok: true, part: result(p.output, undefined) };
  } else if (format === "pi-session-jsonl") {
    if (kind === "tool.call" && m.role === "assistant" && b.type === "toolCall" && b.id === call)
      return { ok: true, part: { ...none, arguments: field(b.arguments ?? {}, redactions) } };
    if (kind === "tool.result" && block === 0 && m.role === "toolResult" && m.toolCallId === call)
      return { ok: true, part: result(m.content, m.isError) };
  }
  return { ok: false, code: "record-block-mismatch" };
}

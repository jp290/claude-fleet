import { createHash, randomBytes } from "node:crypto";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { normalizeNative, type NativeBinding, type NativeGap, type NativeSnapshot } from "./trace-native";
import { TRACE_GENERATIONS, type TraceEvent, type TraceResult } from "./trace-index";

export const TIMELINE_BUDGET = { scanBytes: 1_048_576, pageBytes: 65_536, pageEvents: 100,
  rowBytes: 8_388_608, sessions: 20_000, cursorMs: 600_000, cursors: 300 } as const;
const digest = (v: string): string => createHash("sha256").update(v).digest("hex");
const obj = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v)
  ? v as Record<string, unknown> : {};
const str = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;
const num = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) ? v : null;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
export interface TimelineReceipt {
  session: string; cwd: string; slot: number; openedAt: number; harness: string | null;
  project: string | null; program: string | null; task: string | null; branch: string | null;
  at: number; proof: string;
}
export interface TimelineTask { id: string; repo: string | null; branch: string | null; program: string | null }
export interface TimelineSource { file: string; harness: string; format: string; cwd: string }
export interface TimelineDeps {
  host: string;
  carriers: { file: string; kind: "prompts" | "snapshots" | "tasks" | "outcomes" }[];
  live: () => TimelineReceipt[];
  tasks: () => TimelineTask[];
  resolve: (receipt: TimelineReceipt) => TimelineSource | null;
  worktreeOf: (repo: string, branch: string) => string;
  projectOf: (repo: string) => string;
  trace: (task: string) => Promise<TraceResult>;
  traceVersion: () => string;
  redactions: () => readonly string[];
}
interface FileStamp { key: string; inode: string; size: number }
export function timelineStamp(file: string): FileStamp | null {
  try {
    const s = statSync(file);
    return { key: `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`, inode: `${s.dev}:${s.ino}`, size: s.size };
  } catch { return null; }
}
function readRange(file: string, offset: number, bytes: number): Uint8Array {
  const fd = openSync(file, "r");
  try { const b = Buffer.alloc(bytes); return b.subarray(0, readSync(fd, b, 0, bytes, offset)); }
  finally { closeSync(fd); }
}
interface Carrier {
  file: string; kind: TimelineDeps["carriers"][number]["kind"]; stamp: FileStamp | null;
  offset: number; tail: Uint8Array; skipping: boolean; receipts: Map<string, TimelineReceipt>;
  tasks: Map<string, TimelineTask>; links: Map<string, { slot: number; openedAt: number; session: string;
    task: string | null; program: string | null; branch: string | null; project: string | null }>;
  gaps: Set<string>;
}
interface NativeState {
  file: string | null; stamp: FileStamp | null; offset: number; generation: number;
  snapshot?: NativeSnapshot; source?: TimelineSource;
  chunks: { offset: number; bytes: number; hash: string }[]; verifyTarget: string | null; verified: number; bindingKey: string; gaps: NativeGap[];
}
export interface TimelineSession {
  key: string; session: string; host: string; occupation: { slot: number; openedAt: number; proofHash: string };
  harness: string; project: string | null; program: string | null; task: string | null; branch: string | null;
  source: { id: string; version: string | null; state: string; completeBytes: number; indexedBytes: number;
    availableBytes: number | null; horizon: NativeSnapshot["horizon"] | null };
  gaps: NativeGap[]; observedAt: number; clockUncertainty: "unknown";
}
export interface TimelineEntry { id: string; at: number; sessionKey: string | null; event: TraceEvent | null }
export interface TimelinePage {
  schema: "fleet.timeline/v1"; host: string; revision: string; window: { from: number; to: number };
  sessions: TimelineSession[]; entries: TimelineEntry[]; nextCursor: string | null; pending: boolean;
  coverage: "incomplete"; gaps: string[]; ledger: { task: string; horizon: TraceResult["horizon"] }[];
  budget: typeof TIMELINE_BUDGET; work: { readBytes: number; sourceReads: number };
}
export class TimelineIndex {
  private carriers: Carrier[];
  private native = new Map<string, NativeState>();
  private receipts = new Map<string, TimelineReceipt>();
  private traces = new Map<string, TraceResult>();
  private ledgerVersion = "";
  private traceVersions = new Map<string, string>();
  private traceNext = 0;
  private revision = 0;
  private busy: Promise<void> | null = null;
  private failure: string | null = null;
  private scheduled = false;
  private dirty = true;
  private work = { readBytes: 0, sourceReads: 0 };
  private projections = new Map<string, { revision: string; sessions: TimelineSession[]; entries: TimelineEntry[]; ledger: TimelinePage["ledger"] }>();
  private cursors = new Map<string, { query: string; revision: string; offset: number; at: number }>();
  constructor(private deps: TimelineDeps) {
    this.carriers = deps.carriers.flatMap((c) => TRACE_GENERATIONS.map((gen): Carrier => ({
      ...c, file: c.file + gen, stamp: null, offset: 0, tail: new Uint8Array(), skipping: false,
      receipts: new Map(), tasks: new Map(), links: new Map(), gaps: new Set() })));
  }
  private key(r: Pick<TimelineReceipt, "session" | "slot" | "openedAt">): string {
    return digest(JSON.stringify([this.deps.host, r.session, r.slot, r.openedAt]));
  }
  private accept(carrier: Carrier, row: Record<string, unknown>, proof: string): void {
    if (carrier.kind === "prompts") {
      if (!uuid(row.sessionId) || !str(row.cwd) || !String(row.cwd).startsWith("/")
        || num(row.slot) === null || num(row.openedAt) === null || num(row.ts) === null) {
        carrier.gaps.add("unbound-prompt-record"); return;
      }
      const r: TimelineReceipt = { session: row.sessionId, cwd: String(row.cwd), slot: Number(row.slot),
        openedAt: Number(row.openedAt), at: Number(row.ts), harness: str(row.harness),
        project: null, program: null, task: null, branch: null, proof };
      const key = this.key(r), previous = carrier.receipts.get(key);
      if (previous && previous.cwd !== r.cwd) { carrier.gaps.add("conflicting-occupation-cwd"); return; }
      if (!previous || r.at < previous.at) carrier.receipts.set(key, r);
    } else if (carrier.kind === "snapshots" && Array.isArray(row.lanes)) {
      for (const item of row.lanes) {
        const l = obj(item);
        if (!uuid(l.sessionId) || num(l.s) === null || num(l.openedAt) === null) {
          carrier.gaps.add("unbound-snapshot-record"); continue;
        }
        const link = { session: l.sessionId, slot: Number(l.s), openedAt: Number(l.openedAt), task: str(l.taskId),
          program: str(l.programId), branch: str(l.branch), project: str(l.projectKey) };
        carrier.links.set(this.key(link), link);
      }
    } else if (carrier.kind === "tasks") {
      const t = obj(row.task), id = str(t.id);
      if (id) carrier.tasks.set(id, { id, repo: str(t.repo), branch: null, program: str(t.programId) });
    } else if (carrier.kind === "outcomes") {
      const id = str(row.taskId), branch = str(row.branch);
      if (id) carrier.tasks.set(id, { id, repo: str(row.repo), branch, program: str(row.programId) });
    }
  }
  private async refresh(): Promise<void> {
    this.work = { readBytes: 0, sourceReads: 0 };
    let left: number = TIMELINE_BUDGET.scanBytes;
    let changed = false;
    for (const c of this.carriers) {
      const stamp = timelineStamp(c.file);
      if (stamp && c.stamp?.key === stamp.key && c.offset === stamp.size) continue;
      if (!stamp) {
        if (c.stamp) changed = true;
        c.stamp = null; c.offset = 0; c.tail = new Uint8Array(); c.receipts.clear(); c.tasks.clear(); c.links.clear();
        c.gaps.add("carrier-missing"); continue;
      }
      if (c.stamp && (stamp.inode !== c.stamp.inode || stamp.size < c.offset
        || stamp.size === c.stamp.size && stamp.key !== c.stamp.key)) {
        c.offset = 0; c.tail = new Uint8Array(); c.skipping = false; c.receipts.clear(); c.tasks.clear(); c.links.clear();
        c.gaps.add("carrier-rewritten"); changed = true;
      }
      if (left <= 0) break;
      if (stamp.size > c.offset) {
        const b = readRange(c.file, c.offset, Math.min(left, stamp.size - c.offset));
        const joined = new Uint8Array(c.tail.length + b.length); joined.set(c.tail); joined.set(b, c.tail.length);
        let start = 0;
        for (let end = joined.indexOf(10); end >= 0; end = joined.indexOf(10, start)) {
          if (!c.skipping) {
            try {
              const raw = joined.subarray(start, end), row = obj(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
              this.accept(c, row, digest(Buffer.from(raw).toString("base64")));
            } catch { c.gaps.add("malformed-carrier-record"); }
          }
          c.skipping = false; start = end + 1;
        }
        c.tail = joined.slice(start);
        if (c.tail.length > TIMELINE_BUDGET.rowBytes) { c.tail = new Uint8Array(); c.skipping = true; c.gaps.add("oversized-carrier-record"); }
        c.offset += b.length; left -= b.length; this.work.readBytes += b.length; this.work.sourceReads++; changed = true;
      }
      c.stamp = stamp;
    }
    const taskMap = new Map<string, TimelineTask>();
    for (const c of this.carriers) for (const [id, t] of c.tasks) taskMap.set(id, { ...taskMap.get(id), ...t });
    for (const t of this.deps.tasks()) taskMap.set(t.id, { ...t, branch: t.branch ?? taskMap.get(t.id)?.branch ?? null });
    const links = new Map(this.carriers.flatMap((c) => [...c.links]));
    const receipts = new Map<string, TimelineReceipt>();
    for (const c of this.carriers) for (const [key, r] of c.receipts) receipts.set(key, { ...r });
    for (const r of this.deps.live()) receipts.set(this.key(r), { ...r });
    for (const [key, r] of receipts) {
      const link = links.get(key);
      if (link) Object.assign(r, { task: link.task, program: link.program, branch: link.branch, project: link.project });
      for (const t of taskMap.values()) {
        if (t.repo && t.branch && this.deps.worktreeOf(t.repo, t.branch) === r.cwd) {
          r.task = t.id; r.branch = t.branch; r.program ??= t.program; r.project ??= this.deps.projectOf(t.repo); break;
        }
      }
      r.project ??= this.deps.projectOf(r.cwd);
      r.proof = digest(JSON.stringify([this.deps.host, r.session, r.cwd, r.slot, r.openedAt]));
    }
    const previousReceipts = this.receipts;
    for (const [key, r] of receipts) r.harness ??= previousReceipts.get(key)?.harness ?? null;
    this.receipts = receipts;
    const indexedKeys = new Set([...receipts.keys()].slice(0, TIMELINE_BUDGET.sessions));
    for (const key of this.native.keys()) if (!indexedKeys.has(key)) { this.native.delete(key); changed = true; }
    for (const [key, r] of [...receipts].slice(0, TIMELINE_BUDGET.sessions)) {
      let n = this.native.get(key);
      const bindingKey = digest(JSON.stringify([r.session, r.cwd, r.slot, r.openedAt, r.harness]));
      if (!n || n.bindingKey !== bindingKey) {
        n = { file: null, stamp: null, offset: 0, generation: 1, bindingKey, gaps: [], chunks: [], verifyTarget: null, verified: 0 }; this.native.set(key, n); changed = true;
      }
      if (!n.file || !timelineStamp(n.file)) {
        const resolved = this.deps.resolve(r);
        if (resolved && timelineStamp(resolved.file)) { n.file = resolved.file; n.source = resolved; r.harness = resolved.harness; n.bindingKey = digest(JSON.stringify([r.session, r.cwd, r.slot, r.openedAt, r.harness])); }
        else {
          if (n.snapshot) { n.snapshot = undefined; n.offset = 0; n.stamp = null; n.generation++; changed = true; }
          n.gaps = [{ code: r.harness && !["claude", "codex", "pi", "pi-zai", "pi-ox"].includes(r.harness)
            ? "unsupported-source" : "source-missing" }]; continue;
        }
      }
      const stamp = timelineStamp(n.file!);
      if (!stamp) continue;
      if (stamp.key === n.stamp?.key && n.offset === stamp.size) continue;
      if (n.stamp && (stamp.inode !== n.stamp.inode || stamp.size < n.offset
        || stamp.size === n.stamp.size && stamp.key !== n.stamp.key)) {
        n.offset = 0; n.snapshot = undefined; n.generation++; n.chunks = []; n.verifyTarget = null; n.gaps = [{ code: "source-rewritten" }]; changed = true;
      }
      if (n.stamp && n.stamp.key !== stamp.key && stamp.size > n.stamp.size) {
        if (n.verifyTarget !== stamp.key) { n.verifyTarget = stamp.key; n.verified = 0; }
        n.gaps = [{ code: "source-change-unverified" }]; changed = true;
        while (n.verified < n.chunks.length && left >= n.chunks[n.verified]!.bytes) {
          const chunk = n.chunks[n.verified]!;
          const bytes = readRange(n.file!, chunk.offset, chunk.bytes);
          this.work.sourceReads++; this.work.readBytes += bytes.length; left -= bytes.length;
          if (digest(Buffer.from(bytes).toString("base64")) !== chunk.hash) {
            n.offset = 0; n.snapshot = undefined; n.generation++; n.chunks = []; n.verifyTarget = null;
            n.gaps = [{ code: "source-rewritten" }]; break;
          }
          n.verified++;
        }
        if (n.verifyTarget) {
          if (n.verified < n.chunks.length) continue;
          n.stamp = stamp; n.verifyTarget = null; n.gaps = [];
        }
      }
      if (left <= 0) continue;
      const source = n.source;
      if (!source) { n.gaps = [{ code: "source-binding-unresolved" }]; continue; }
      const b = readRange(n.file!, n.offset, Math.min(left, stamp.size - n.offset));
      const binding: NativeBinding = { sessionId: r.session, cwd: source.cwd,
        occupation: { sourceHost: this.deps.host, sessionId: r.session, cwd: source.cwd, slot: r.slot,
          openedAt: r.openedAt, proofHash: r.proof } };
      const snapshot = await normalizeNative({ sourceHost: this.deps.host, sourceId: `session-${key}`,
        harness: source.harness, format: source.format, version: `generation-${n.generation}`, bytes: b,
        byteOffset: n.offset, observedAt: Date.now(), binding, redactions: this.deps.redactions() }, n.snapshot);
      if (timelineStamp(n.file!)?.key !== stamp.key) {
        n.stamp = null; n.offset = 0; n.snapshot = undefined; n.chunks = []; n.verifyTarget = null; n.generation++;
        n.gaps = [{ code: "source-changed-during-read" }]; changed = true; continue;
      }
      n.chunks.push({ offset: n.offset, bytes: b.length, hash: digest(Buffer.from(b).toString("base64")) });
      n.snapshot = snapshot; n.offset += b.length; n.stamp = stamp;
      left -= b.length; this.work.readBytes += b.length; this.work.sourceReads++; changed = true;
    }
    if (JSON.stringify([...previousReceipts]) !== JSON.stringify([...receipts])) changed = true;
    const version = this.deps.traceVersion();
    if (version !== this.ledgerVersion) { this.ledgerVersion = version; changed = true; }
    const ids = new Set([...receipts.values()].map((r) => r.task).filter((id): id is string => !!id));
    const ordered = [...ids];
    const pendingTasks = [...ordered.slice(this.traceNext), ...ordered.slice(0, this.traceNext)];
    const next = pendingTasks.find((id) => this.traceVersions.get(id) !== version);
    if (next) {
      this.traces.set(next, await this.deps.trace(next)); this.traceVersions.set(next, version);
      this.traceNext = (ordered.indexOf(next) + 1) % ordered.length; changed = true;
    }
    for (const id of this.traces.keys()) if (!ids.has(id)) { this.traces.delete(id); this.traceVersions.delete(id); }
    this.dirty = this.carriers.some((c) => c.offset < (timelineStamp(c.file)?.size ?? 0))
      || [...this.native.values()].some((n) => n.file && n.offset < (timelineStamp(n.file)?.size ?? 0))
      || [...ids].some((id) => this.traceVersions.get(id) !== version);
    if (changed) this.revision++;
  }
  async update(): Promise<void> {
    if (this.busy) return this.busy;
    this.busy = this.refresh().then(() => { this.failure = null; }).catch(() => { this.failure = "refresh-failed"; })
      .finally(() => {
        this.busy = null;
        if (this.dirty && !this.failure && !this.scheduled) {
          this.scheduled = true; setTimeout(() => { this.scheduled = false; void this.update(); }, 100);
        }
      });
    return this.busy;
  }
  async page(url: URL): Promise<{ status: number; body: TimelinePage | { error: string } }> {
    const q = url.searchParams;
    if ([...q.keys()].some((k) => !["from", "to", "project", "program", "session", "harness", "limit", "cursor"].includes(k)))
      return { status: 400, body: { error: "unknown timeline parameter" } };
    const from = Number(q.get("from")), to = Number(q.get("to")), limit = Number(q.get("limit") ?? TIMELINE_BUDGET.pageEvents);
    if (!["from", "to"].every((k) => /^\d{1,16}$/.test(q.get(k) ?? ""))
      || !/^\d{1,3}$/.test(q.get("limit") ?? String(TIMELINE_BUDGET.pageEvents)) || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to < from
      || !Number.isInteger(limit) || limit < 1 || limit > TIMELINE_BUDGET.pageEvents
      || q.has("session") && !uuid(q.get("session"))
      || ["project", "program", "harness"].some((k) => q.has(k) && !/^[A-Za-z0-9_.:-]{1,160}$/.test(q.get(k)!)))
      return { status: 400, body: { error: "invalid timeline window, filter or limit" } };
    await this.update();
    const revision = String(this.revision);
    const query = digest(JSON.stringify([from, to, limit, ...["project", "program", "session", "harness"].map((k) => q.get(k))]));
    let offset = 0;
    const now = Date.now();
    for (const [id, c] of this.cursors) if (now - c.at > TIMELINE_BUDGET.cursorMs) this.cursors.delete(id);
    if (q.has("cursor")) {
      const c = this.cursors.get(q.get("cursor")!);
      if (!c || c.query !== query || c.revision !== revision) return { status: 409, body: { error: "cursor-stale: restart this window" } };
      offset = c.offset;
    }
    const cached = this.projections.get(query);
    const sessions: TimelineSession[] = cached?.revision === revision ? cached.sessions : [];
    const entries: TimelineEntry[] = cached?.revision === revision ? cached.entries : [];
    const ledger: TimelinePage["ledger"] = cached?.revision === revision ? cached.ledger : [];
    if (cached?.revision !== revision) {
      for (const [key, r] of this.receipts) {
        if (["project", "program", "session", "harness"].some((k) => q.has(k) && q.get(k) !== r[k as "project" | "program" | "session" | "harness"])) continue;
        const n = this.native.get(key), s = n?.snapshot;
        const events = s?.events.filter((e) => e.at >= from && e.at <= to) ?? [];
        if (!events.length && (r.at < from || r.at > to) && !(r.openedAt <= to && (!s?.horizon || s.horizon.state === "unmeasured"
          || s.horizon.newestAt === undefined || s.horizon.newestAt >= from))) continue;
        sessions.push({ key, session: r.session, host: this.deps.host,
          occupation: { slot: r.slot, openedAt: r.openedAt, proofHash: r.proof }, harness: r.harness ?? "unknown",
          project: r.project, program: r.program, task: r.task, branch: r.branch,
          source: { id: `session-${key}`, version: s?.version ?? null, state: s?.state ?? "unmeasured",
            completeBytes: s?.completeBytes ?? 0, indexedBytes: n?.offset ?? 0, availableBytes: n?.stamp?.size ?? null,
            horizon: s?.horizon ?? null }, gaps: [...n?.gaps ?? [{ code: "session-budget" }], ...(s?.gaps ?? []).slice(0, 16),
            ...(s && s.gaps.length > 16 ? [{ code: "additional-source-gaps", bytes: s.gaps.length - 16 }] : []),
            ...(n?.stamp && n.offset < n.stamp.size ? [{ code: "source-indexing" }] : [])], observedAt: r.at, clockUncertainty: "unknown" });
        entries.push({ id: `session:${key}`, at: Math.max(from, r.openedAt), sessionKey: key, event: null });
        for (const e of events) entries.push({ id: e.id, at: e.at, sessionKey: key, event: e });
      }
      const seen = new Set<string>();
      for (const [task, t] of this.traces) {
        const candidates = sessions.filter((s) => s.task === task);
        if (!candidates.length) continue;
        ledger.push({ task, horizon: t.horizon });
        if (t.result !== "trace") continue;
        for (const e of t.events) {
          if (e.at < from || e.at > to) continue;
          const exact = candidates.filter((s) => e.refs.session === s.session
            && e.refs.slot === s.occupation.slot && e.refs.openedAt === s.occupation.openedAt);
          if (q.has("session") && exact.length !== 1) continue;
          const id = digest(JSON.stringify([e.source, e.kind, e.at, e.detailRef, e.refs]));
          if (seen.has(id)) continue; seen.add(id);
          entries.push({ id, at: e.at, sessionKey: exact.length === 1 ? exact[0]!.key : null, event: e });
        }
      }
      entries.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
      if (this.projections.size >= 8) this.projections.delete(this.projections.keys().next().value!);
      this.projections.set(query, { revision, sessions, entries, ledger });
    }
    const headers = new Map(sessions.map((s) => [s.key, s]));
    const answer: TimelinePage = { schema: "fleet.timeline/v1", host: this.deps.host, revision, window: { from, to },
      sessions: [], entries: [], nextCursor: null, pending: this.dirty || !!this.failure, coverage: "incomplete",
      gaps: [...new Set(this.carriers.flatMap((c) => [...[...c.gaps].map((g) => `${c.file.slice(c.file.lastIndexOf("/") + 1)}:${g}`), ...(c.tail.length ? [`${c.file.slice(c.file.lastIndexOf("/") + 1)}:partial-carrier-record`] : [])])),
        "history-before-retained-sources-unknown", ...(this.failure ? [this.failure] : [])], ledger: [], budget: TIMELINE_BUDGET, work: this.work };
    const included = new Set<string>();
    let end = offset;
    for (const entry of entries.slice(offset, offset + limit)) {
      const header = entry.sessionKey && !included.has(entry.sessionKey) ? headers.get(entry.sessionKey) : undefined;
      if (header) answer.sessions.push(header);
      answer.entries.push(entry);
      if (Buffer.byteLength(JSON.stringify(answer)) > TIMELINE_BUDGET.pageBytes - 256) {
        answer.entries.pop(); if (header) answer.sessions.pop(); break;
      }
      if (header) included.add(header.key); end++;
    }
    if (end < entries.length) {
      if (end === offset) return { status: 413, body: { error: "timeline metadata exceeds page budget" } };
      const id = randomBytes(16).toString("hex");
      if (this.cursors.size >= TIMELINE_BUDGET.cursors) this.cursors.delete(this.cursors.keys().next().value!);
      this.cursors.set(id, { query, revision, offset: end, at: now }); answer.nextCursor = id;
    }
    const pageTasks = new Set(answer.entries.map((e) => e.event?.refs.task).filter(Boolean));
    for (const h of ledger) if (pageTasks.has(h.task)) {
      answer.ledger.push(h);
      if (Buffer.byteLength(JSON.stringify(answer)) > TIMELINE_BUDGET.pageBytes) { answer.ledger.pop(); answer.gaps.push("ledger-horizon-page-budget"); break; }
    }
    return { status: 200, body: answer };
  }
}

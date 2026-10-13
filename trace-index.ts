// One task's life as TraceEvents, projected from the ledgers every writer already keeps (Overhaul S5, first cut).
//
// A PROJECTION AND NOTHING ELSE: no writer, no new file, no field on any ledger. Every event below
// is read out of a line some existing writer appended, and points back at that line (`detailRef`)
// instead of copying it — report texts, verify output, task text and audit `out` never enter an
// event. docs/overhaul-plan-2026-09-25.md §2 S5 is the order, K5 §6
// (docs/messungen/2026-09-25-overhaul-kern-5-datenschichten.md) the event model, and
// docs/messungen/2026-09-25-full-trace-quellen.md §5/§7 the keys the later sources bring.
//
// THREE GENERATIONS, not two. server/persist.ts#readLedger reads `.1` + active on purpose (every
// poll uses it); history does not live there — `audit.jsonl` before its second rotation exists only
// in `.archive` (K5 Ä1: a 08-14 lane's dispatch and slot were invisible to the dossier). This file
// reads `.archive`, `.1` and active, oldest first, and says per source how far back that reaches.
//
// THE HORIZON IS PART OF THE ANSWER. A source that begins after a task began cannot say what
// happened before it began; "no row" there is not "nothing happened". Every source therefore
// carries `oldestAt` (or why it has none), and every task gets a per-source coverage verdict:
// `read` (the source covers the task's whole life, so a zero is a real zero), `partial` (it begins
// after the task did, and what it holds is shown), `unmeasured` (it could not be read, or begins
// after the task and holds nothing about it). A task older than every horizon answers with its
// sources named — never with an empty list that reads as a quiet task.
//
// OPEN FOR THE LATER SOURCES WITHOUT A SCHEMA CHANGE (full-trace-quellen §5, §7): `refs` already
// declares the transcript keys (`session`, `call`, `parent`) and the occupation key (`openedAt`),
// `kind` is `<family>.<verb>[.<qualifier>]` from an open set (T1 adds `tool.call`, `tool.result`,
// `file.write.observed`), `edge` names ACTORS with the door they used beside them (T6 — a
// credential is never the actor), and `detailRef` is an opaque locator plus a fingerprint, so a
// rotation or rewrite can never serve different bytes under the same pointer.
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";

// The actor a source PROVES, which is less than a UI would like to show: an occupant the source
// names by slot+openedAt is an `occupant` until something states its role, and a door that only
// proves a credential (the owner bearer) yields `unknown` with `via` saying which door it was.
export type TraceActorKind = "owner" | "orchestrator" | "main" | "lane" | "tick" | "sensor" | "server" | "extern"
  | "occupant" | "unknown";
export interface TraceActor {
  kind: TraceActorKind;
  via?: string;         // the door or credential the source recorded — beside the actor, never it
  slot?: number; openedAt?: number; session?: string; program?: string; task?: string; branch?: string;
}
export interface TraceEdge { from: TraceActor; to: TraceActor; channel: string }
// Every key optional, and every key a source KNOWS goes in. `session`/`call`/`parent` are unused by
// the ledger sources and reserved for the transcript adapters (T1), so they add no schema change.
export interface TraceRefs {
  task?: string; slot?: number; openedAt?: number; branch?: string; sha?: string; program?: string;
  session?: string; call?: string; parent?: string;
}
// `locator` addresses the line (`<file><gen>@<offset>+<bytes>`, or `<repo>@<sha>` for git); `fp` is
// the first 16 hex of the line's sha256. A rotation moves a line to another generation and offset —
// a resolver finds it again by `fp`, and a pointer whose bytes no longer hash to it is stale.
export interface TraceDetailRef { source: string; locator: string; fp?: string }
export interface TraceEvent {
  source: string;       // ledger, note or (later) transcript name
  kind: string;         // `<family>.<verb>[.<qualifier>]`, open set — see TRACE_FAMILIES
  at: number;           // ms, the source's own clock (SourceHorizon.clock)
  refs: TraceRefs;
  files: string[];      // repo-relative, observed; EMPTY means no path on record, not "no file touched"
  edge?: TraceEdge;
  detailRef?: TraceDetailRef;
}
export const TRACE_FAMILIES = ["task", "lane", "land", "audit", "report", "commit", "send", "event"] as const;

// oldest first — the append chain's own chronology (persist.ts#rotateEventLog: active → .1, the
// outgoing .1 appended to .archive). The mutation probe of e2e/trace.ts drops `.archive` from here.
export const TRACE_GENERATIONS = [".archive", ".1", ""] as const;

export interface TraceFiles { audit: string; outcomes: string; postLandAudits: string; reports: string; tasksArchive: string }
export interface TraceTaskRow {
  id: string; from: "live" | "archive"; created: number; status: string; kind: string; programId: string | null;
}
// a lane holding the task RIGHT NOW: the one place slot+openedAt is known without inference
export interface TraceLiveLane { slot: number; openedAt: number; session: string | null; repo: string; branch: string }
export type TraceGit = (repo: string, ...args: string[]) => Promise<{ code: number; out: string; err: string }>;
export interface TraceInput {
  task: string;
  files: TraceFiles;
  liveRow: TraceTaskRow | null;
  live: TraceLiveLane[];
  git: TraceGit;
  ledgerCache?: Map<string, { version: string; read: LedgerRead }>;
  maxLedgerBytes?: number;
  worktreeOf: (repo: string, branch: string) => string; // server.ts#worktreePathFor, injected so there is one derivation
}
export interface GenerationFacts { gen: string; rows: number; bytes: number }
export type SourceHorizon =
  // rows/malformed/generations for a ledger; a git source has an oldest commit and no row count
  | { source: string; state: "read"; oldestAt: number; newestAt?: number; rows?: number; malformed?: number;
      generations?: GenerationFacts[]; repo?: string; clock: string }
  | { source: string; state: "unmeasured"; reason: string; repo?: string; clock: string };
export type SourceCoverage =
  | { source: string; state: "read"; events: number; caveats?: string[]; repo?: string }
  | { source: string; state: "partial"; events: number; reason: string }
  | { source: string; state: "unmeasured"; reason: string; repo?: string };
export type TraceResult =
  | { result: "trace"; task: string; row: TraceTaskRow | null; anchorAt: number; events: TraceEvent[];
      horizon: SourceHorizon[]; coverage: SourceCoverage[] }
  | { result: "unknown-task"; task: string; searched: string[]; horizon: SourceHorizon[] };

const SERVER_CLOCK = "fleet server wallclock (Date.now at write)";
const iso = (ms: number): string => new Date(ms).toISOString();
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const base = (file: string): string => file.slice(file.lastIndexOf("/") + 1);

// --- the three-generation reader ----------------------------------------------------------------
interface LedgerLine { gen: string; offset: number; raw: Uint8Array; row: Record<string, unknown> }
type LedgerRead =
  | { state: "read"; name: string; lines: LedgerLine[]; malformed: number; generations: GenerationFacts[] }
  | { state: "unmeasured"; name: string; reason: string };

const identity = (path: string): { ino: number; size: number } | null => {
  if (!existsSync(path)) return null;
  const st = statSync(path);
  return { ino: Number(st.ino), size: st.size };
};
// A rotation between two generation reads would lose a whole generation (read `.archive`, then
// rotate, then read `.1` = the old active: the old `.1` was in neither read). So the identities are
// taken before and after, and a read that saw a rotation is repeated. `.archive` and `.1` change only
// at a rotation; the active file may GROW meanwhile, which is an append behind the read, not a race.
async function readGenerations(file: string, cache?: TraceInput["ledgerCache"], maxBytes?: number): Promise<LedgerRead> {
  if (maxBytes !== undefined && TRACE_GENERATIONS.reduce((sum, g) => sum + (identity(file + g)?.size ?? 0), 0) > maxBytes)
    return { state: "unmeasured", name: base(file), reason: `${base(file)} exceeds the timeline ledger byte budget` };
  const version = JSON.stringify(TRACE_GENERATIONS.map((g) => {
    try { const s = statSync(file + g); return [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs]; } catch { return null; }
  }));
  const hit = cache?.get(file);
  if (hit?.version === version) return hit.read;
  const read = await readGenerationsUncached(file);
  cache?.set(file, { version, read });
  return read;
}
async function readGenerationsUncached(file: string): Promise<LedgerRead> {
  const name = base(file);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = TRACE_GENERATIONS.map((g) => identity(`${file}${g}`));
    if (before.every((b) => b === null)) return { state: "unmeasured", name, reason: `no generation of ${name} exists on this server` };
    const lines: LedgerLine[] = [];
    const generations: GenerationFacts[] = [];
    let malformed = 0;
    for (const [i, gen] of TRACE_GENERATIONS.entries()) {
      if (!before[i]) continue;
      let bytes: Uint8Array;
      try { bytes = new Uint8Array(await Bun.file(`${file}${gen}`).arrayBuffer()); }
      catch (e: unknown) {
        if ((e as { code?: string }).code === "ENOENT") continue; // rotated away — the identity check below repeats the read
        throw e;
      }
      const decoder = new TextDecoder();
      let rows = 0;
      let start = 0;
      for (let at = bytes.indexOf(10); at >= 0; start = at + 1, at = bytes.indexOf(10, start)) {
        const raw = bytes.subarray(start, at);
        const text = decoder.decode(raw);
        if (!text.trim()) continue;
        let row: unknown;
        try { row = JSON.parse(text); } catch { malformed++; continue; }
        if (row === null || typeof row !== "object" || Array.isArray(row)) { malformed++; continue; }
        lines.push({ gen, offset: start, raw, row: row as Record<string, unknown> });
        rows++;
      }
      // an unterminated tail of the ACTIVE file is an append in flight, not a record yet; in a
      // rotated generation it can never complete, so there it is a hole
      if (start < bytes.length && gen !== "" && decoder.decode(bytes.subarray(start)).trim()) malformed++;
      generations.push({ gen: `${name}${gen}`, rows, bytes: bytes.length });
    }
    const after = TRACE_GENERATIONS.map((g) => identity(`${file}${g}`));
    const stable = TRACE_GENERATIONS.every((g, i) => {
      const b = before[i]; const a = after[i];
      if (!b || !a) return b === a;
      return a.ino === b.ino && (g === "" ? a.size >= b.size : a.size === b.size);
    });
    if (stable) return { state: "read", name, lines, malformed, generations };
  }
  return { state: "unmeasured", name, reason: `${name} rotated during three consecutive reads` };
}

const fingerprint = (raw: Uint8Array): string => createHash("sha256").update(raw).digest("hex").slice(0, 16);
const lineRef = (l: LedgerLine, name: string): TraceDetailRef =>
  ({ source: name, locator: `${name}${l.gen}@${l.offset}+${l.raw.length}`, fp: fingerprint(l.raw) });

function horizonOf(read: LedgerRead, timeKey: "ts" | "at"): SourceHorizon {
  if (read.state !== "read") return { source: read.name, state: "unmeasured", reason: read.reason, clock: SERVER_CLOCK };
  let oldest = Infinity; let newest = -Infinity;
  for (const l of read.lines) {
    const t = num(l.row[timeKey]);
    if (t === null) continue;
    if (t < oldest) oldest = t;
    if (t > newest) newest = t;
  }
  if (oldest === Infinity)
    return { source: read.name, state: "unmeasured", reason: `${read.name} holds no row with a numeric \`${timeKey}\``, clock: SERVER_CLOCK };
  return { source: read.name, state: "read", oldestAt: oldest, newestAt: newest, rows: read.lines.length,
    malformed: read.malformed, generations: read.generations, clock: SERVER_CLOCK };
}

// --- which audit.jsonl rows are this task's -------------------------------------------------------
// The audit trail keys by slot and writes the task id into free `detail` prose (K5 Ä2: `taskId` as a
// field on 298 of ~96 000 rows). Four rules, each one a fact about a WRITER, never a text search:
//   · the `taskId` field (dispatch_requeued/_parked);
//   · the LEADING id of the events whose writer starts `detail` with the row id (server.ts: main_task,
//     task_release, task_hold, self_land_start, task_dispatch …; waves join ids with `+`, lists with `,`);
//   · a `task=<id>` token (land_actor, merge_verdict_*, note_verdict, owner_token_ambient_use);
//   · the lane's SLOT WINDOW: `slot_open` writes the worktree path as its detail, and the window ends
//     at the next open of the same slot — so a recycled slot's later rows are never this lane's.
const LEAD_ID_EVENTS = new Set(["task_dispatch", "task_release", "main_task", "task_hold", "task_spawn",
  "main_brief", "task_files_confirm", "task_files_propose", "task_files_dismiss", "task_program", "task_kind",
  "task_note_attach", "task_note_detach", "task_wave_start", "task_wave_dispatch", "task_kill_archive",
  "task_cards_confirm", "dispatch_requeued", "dispatch_parked", "self_land_start", "criterion_proposed",
  "criterion_confirmed", "note_verdict"]);
// the stages a reader looks for by name; every other event keeps its own name under `event.`
const AUDIT_KINDS: Record<string, string> = {
  task_dispatch: "task.dispatched", main_task: "task.filed", task_release: "task.released", task_hold: "task.held",
  dispatch_requeued: "task.requeued", dispatch_parked: "task.parked", slot_open: "lane.opened", slot_kill: "lane.closed",
  self_land_start: "land.started", merge_verdict: "land.verdict", land_actor: "land.moved",
};
const leadIds = (detail: string): string[] => (detail.split(/\s/, 1)[0] ?? "").split(/[+,:]/).filter(Boolean);
const detailTokens = (detail: string): string[] =>
  detail.split(/\s+/).map((t) => t.replace(/^\(|[):]+$/g, "")).filter(Boolean);

interface SlotWindow { slot: number; from: number; to: number; branch: string; openedAt?: number; session?: string }
function slotWindows(lines: LedgerLine[], lanes: { repo: string; branch: string }[], worktreeOf: TraceInput["worktreeOf"]): SlotWindow[] {
  const opens = lines.filter((l) => l.row.event === "slot_open" && num(l.row.slot) !== null && num(l.row.ts) !== null);
  const byPath = new Map(lanes.map((ln) => [worktreeOf(ln.repo, ln.branch), ln.branch]));
  const wins: SlotWindow[] = [];
  for (const o of opens) {
    const branch = byPath.get(str(o.row.detail) ?? "");
    if (!branch) continue;
    const slot = o.row.slot as number;
    const from = o.row.ts as number;
    const to = opens.filter((e) => e.row.slot === slot && (e.row.ts as number) > from)
      .reduce((min, e) => Math.min(min, e.row.ts as number), Infinity);
    wins.push({ slot, from, to, branch });
  }
  return wins;
}

// --- the actors a report row names ------------------------------------------------------------------
function deciderActor(by: unknown, door: string): TraceActor {
  if (by === "owner") return { kind: "unknown", via: "owner credential" }; // the door proves a token, not a person (S2)
  if (by && typeof by === "object") {
    const b = by as Record<string, unknown>;
    if (typeof b.rule === "string") return { kind: "server", via: `rule ${b.rule}` };
    const slot = num(b.slot);
    if (slot !== null) return { kind: "occupant", via: door, slot,
      ...(num(b.openedAt) !== null ? { openedAt: b.openedAt as number } : {}),
      ...(str(b.sessionId) ? { session: b.sessionId as string } : {}) };
  }
  return { kind: "unknown" };
}
function receiverActor(basis: string | null, program: string | null): TraceActor {
  if (basis === "owner-inbox") return { kind: "owner", via: "owner inbox" };
  if (basis === "lane-watch") return { kind: "occupant", via: "lane watch" };
  if (program) return { kind: "main", via: basis === "program" ? "program inbox" : `receiver ${basis ?? "unknown"}`, program };
  return { kind: "unknown", ...(basis ? { via: basis } : {}) };
}

// --- git: land notes and the lane's commits ------------------------------------------------------
async function gitHorizon(git: TraceGit, repo: string, source: string, rev: string, clock: string): Promise<SourceHorizon> {
  const roots = await git(repo, "rev-list", "--max-parents=0", rev);
  const root = roots.code === 0 ? roots.out.split("\n").filter(Boolean).pop() : undefined;
  if (!root) return { source, state: "unmeasured", repo, clock,
    reason: `${rev} does not resolve in this repository: ${(roots.err || roots.out).trim().slice(0, 160) || "no root commit"}` };
  const t = await git(repo, "show", "-s", "--format=%ct", root);
  const at = Number(t.out.trim()) * 1000;
  return t.code === 0 && at > 0
    ? { source, state: "read", oldestAt: at, repo, clock }
    : { source, state: "unmeasured", repo, clock, reason: `the root commit's time is unreadable: ${(t.err || t.out).trim().slice(0, 160)}` };
}

interface GitFacts { horizon: SourceHorizon; events: TraceEvent[]; coverage: SourceCoverage }
const NOTE_SOURCE = "git-notes:fleet/land";
const LOG_SOURCE = "git-log";
async function landNoteFacts(git: TraceGit, id: string, repo: string, landed: { branch: string; sha: string }[]): Promise<GitFacts> {
  const [horizon, reads] = await Promise.all([
    gitHorizon(git, repo, NOTE_SOURCE, "refs/notes/fleet/land", "fleet server wallclock (note `at`)"),
    Promise.all(landed.map(async (x) => ({ x, r: await git(repo, "notes", "--ref=fleet/land", "show", x.sha) })))]);
  const events: TraceEvent[] = [];
  const caveats: string[] = [];
  for (const { x, r } of reads) {
    const short = x.sha.slice(0, 8);
    if (r.code !== 0) {
      caveats.push(/no note found/i.test(r.err || r.out) ? `${short}: landed, no note (the write is best-effort)` : `${short}: ${(r.err || r.out).trim().slice(0, 160)}`);
      continue;
    }
    let note: Record<string, unknown>;
    try { note = JSON.parse(r.out) as Record<string, unknown>; } catch { caveats.push(`${short}: the note is not JSON`); continue; }
    const at = num(note.at);
    if (at === null) { caveats.push(`${short}: the note carries no \`at\` — not placed`); continue; }
    // the gate verdict is the one fact the note adds to the outcome row; `verify.out` stays in the note
    const verify = note.verify && typeof note.verify === "object" ? (note.verify as Record<string, unknown>).ok : undefined;
    const gate = verify === true ? "green" : verify === false ? "red" : verify === null ? "unmeasured" : "absent";
    const actor = note.actor && typeof note.actor === "object" ? note.actor as Record<string, unknown> : {};
    const slot = num(actor.slot);
    const program = str(actor.program);
    events.push({ source: NOTE_SOURCE, kind: `land.gate.${gate}`, at,
      refs: { task: id, branch: x.branch, sha: x.sha, ...(slot !== null ? { slot } : {}), ...(program ? { program } : {}) },
      files: [], detailRef: { source: NOTE_SOURCE, locator: `${repo}@${x.sha}`,
        fp: createHash("sha256").update(r.out).digest("hex").slice(0, 16) } });
  }
  return { horizon, events, coverage: { source: NOTE_SOURCE, repo, state: "read", events: events.length, ...(caveats.length ? { caveats } : {}) } };
}
async function commitFacts(git: TraceGit, id: string, repo: string, ranges: { branch: string; base: string; head: string }[],
  known: string[]): Promise<GitFacts> {
  const [horizon, logs] = await Promise.all([
    gitHorizon(git, repo, LOG_SOURCE, ranges[0]?.head ?? "HEAD", "committer wallclock (%ct) — the committing machine's clock, not a write time"),
    Promise.all(ranges.map(async (x) => ({ x, lg: await git(repo, "log", "--no-color", "--format=%x00%H%x09%ct", "--name-only", `${x.base}..${x.head}`) })))]);
  const events: TraceEvent[] = [];
  const caveats = [...known];
  const seen = new Set<string>();
  let walked = false;
  for (const { x, lg } of logs) {
    if (lg.code !== 0) { caveats.push(`${x.base.slice(0, 8)}..${x.head.slice(0, 8)}: ${(lg.err || lg.out).trim().slice(0, 160)}`); continue; }
    walked = true;
    for (const block of lg.out.split("\0").filter((b) => b.trim())) {
      const [head, ...names] = block.split("\n");
      const [sha, ct] = (head ?? "").split("\t");
      const at = Number(ct) * 1000;
      if (!sha || !Number.isFinite(at) || seen.has(sha)) continue;
      seen.add(sha);
      // commit time is not a write time and names no causing call (full-trace-quellen §5 T2)
      events.push({ source: LOG_SOURCE, kind: "commit.lane", at, refs: { task: id, branch: x.branch, sha },
        files: names.map((n) => n.trim()).filter(Boolean), detailRef: { source: LOG_SOURCE, locator: `${repo}@${sha}` } });
    }
  }
  return { horizon, events, coverage: walked || !caveats.length
    ? { source: LOG_SOURCE, repo, state: "read", events: events.length, ...(caveats.length ? { caveats } : {}) }
    : { source: LOG_SOURCE, repo, state: "unmeasured", reason: caveats.join("; ") } };
}

export async function buildTrace(input: TraceInput): Promise<TraceResult> {
  const { task: id, files, git } = input;
  const [audit, outcomes, plAudits, reports, archive] = await Promise.all([
    readGenerations(files.audit, input.ledgerCache, input.maxLedgerBytes), readGenerations(files.outcomes, input.ledgerCache, input.maxLedgerBytes), readGenerations(files.postLandAudits, input.ledgerCache, input.maxLedgerBytes),
    readGenerations(files.reports, input.ledgerCache, input.maxLedgerBytes), readGenerations(files.tasksArchive, input.ledgerCache, input.maxLedgerBytes)]);
  const ledgers = [{ read: audit, h: horizonOf(audit, "ts") }, { read: outcomes, h: horizonOf(outcomes, "ts") },
    { read: plAudits, h: horizonOf(plAudits, "at") }, { read: reports, h: horizonOf(reports, "at") }];
  const horizon: SourceHorizon[] = [...ledgers.map((x) => x.h), horizonOf(archive, "ts")];
  const events: TraceEvent[] = [];
  const caveats = new Map<string, string[]>();
  const caveat = (source: string, text: string): void => { caveats.set(source, [...(caveats.get(source) ?? []), text]); };
  const rows = (r: LedgerRead): LedgerLine[] => (r.state === "read" ? r.lines : []);

  // the queue row: live first, else the youngest archive copy (archiveTaskLine writes terminal + evicted)
  let row = input.liveRow;
  if (!row) {
    const hit = rows(archive).filter((l) => (l.row.task as Record<string, unknown> | undefined)?.id === id).at(-1);
    const t = hit?.row.task as Record<string, unknown> | undefined;
    if (hit && t && num(t.created) !== null) {
      row = { id, from: "archive", created: t.created as number, status: str(t.status) ?? "unknown",
        kind: str(t.kind) ?? "unknown", programId: str(t.programId) };
      events.push({ source: archive.name, kind: "task.created", at: row.created, refs: { task: id,
        ...(row.programId ? { program: row.programId } : {}) }, files: [], detailRef: lineRef(hit, archive.name) });
    }
  } else {
    events.push({ source: "fleet.json", kind: "task.created", at: row.created,
      refs: { task: id, ...(row.programId ? { program: row.programId } : {}) }, files: [],
      detailRef: { source: "fleet.json", locator: `fleet.json#tasks/${id}` } });
  }

  // lane-outcomes.jsonl: how every lane of this task ended — and the branches and repos everything
  // below keys on
  const lanes = new Map<string, { repo: string | null; branch: string }>();
  for (const ln of input.live) lanes.set(ln.branch, { repo: ln.repo, branch: ln.branch });
  const landed: { repo: string; branch: string; sha: string }[] = [];
  const ranges: { repo: string; branch: string; base: string; head: string }[] = [];
  for (const l of rows(outcomes)) {
    const o = l.row;
    if (o.taskId !== id) continue;
    const at = num(o.ts);
    if (at === null) { caveat(outcomes.name, `a row at ${l.offset} names this task but carries no ts — not placed`); continue; }
    const repo = str(o.repo);
    if (o.origin === "main-direct") {
      events.push({ source: outcomes.name, kind: `land.main-direct.${str(o.result) ?? "unknown"}`, at,
        refs: { task: id, ...(num(o.slot) !== null ? { slot: o.slot as number } : {}),
          ...(num(o.openedAt) !== null ? { openedAt: o.openedAt as number } : {}),
          ...(str(o.sessionId) ? { session: o.sessionId as string } : {}), ...(str(o.mainAfter) ? { sha: o.mainAfter as string } : {}) },
        files: [], detailRef: lineRef(l, outcomes.name) });
      continue;
    }
    const branch = str(o.branch);
    if (!branch) continue;
    if (!lanes.get(branch)?.repo) lanes.set(branch, { repo, branch });
    const sha = str(o.mainAfter) ?? str(o.headSha);
    events.push({ source: outcomes.name, kind: `lane.${str(o.disposition) ?? "ended"}`, at,
      refs: { task: id, branch, ...(sha ? { sha } : {}), ...(str(o.programId) ? { program: o.programId as string } : {}) },
      files: Array.isArray(o.filesTouched) ? (o.filesTouched as unknown[]).filter((f): f is string => typeof f === "string") : [],
      detailRef: lineRef(l, outcomes.name) });
    if (repo && str(o.mainAfter) && o.disposition === "landed") landed.push({ repo, branch, sha: o.mainAfter as string });
    if (repo && str(o.base) && str(o.headSha)) ranges.push({ repo, branch, base: o.base as string, head: o.headSha as string });
    else if (repo) caveat(`git-log:${repo}`, `the ${branch} outcome at ${iso(at)} names no fork point — its commits cannot be separated from the base`);
  }

  // fleet-reports.jsonl (T5): one event per report, its status in the kind; the decision is its own
  // event, joined by the report id
  const opened = new Map<string, Record<string, unknown>>();
  for (const l of rows(reports)) {
    const r = l.row;
    const at = num(r.at);
    if (r.kind === "open" && r.taskId === id && at !== null) {
      opened.set(String(r.id), r);
      const branch = str(r.branch); const slot = num(r.slot); const program = str(r.programId);
      if (branch && !lanes.has(branch)) lanes.set(branch, { repo: null, branch });
      events.push({ source: reports.name, kind: `report.filed.${str(r.status) ?? "unknown"}`, at,
        refs: { task: id, ...(slot !== null ? { slot } : {}), ...(branch ? { branch } : {}), ...(program ? { program } : {}) },
        files: [], detailRef: lineRef(l, reports.name),
        edge: { from: { kind: branch ? "lane" : "occupant", ...(slot !== null ? { slot } : {}), ...(branch ? { branch, task: id } : {}) },
          to: receiverActor(str(r.basis), program), channel: "fleet-report" } });
    } else if (r.kind === "decision" && at !== null && opened.has(String(r.id))) {
      const open = opened.get(String(r.id))!;
      const filer: TraceActor = { kind: str(open.branch) ? "lane" : "occupant", ...(num(open.slot) !== null ? { slot: open.slot as number } : {}),
        ...(str(open.branch) ? { branch: open.branch as string } : {}) };
      events.push({ source: reports.name, kind: `report.decided.${str(r.disposition) ?? "unknown"}`, at,
        refs: { task: id, ...(str(open.branch) ? { branch: open.branch as string } : {}), ...(str(open.programId) ? { program: open.programId as string } : {}) },
        files: [], detailRef: lineRef(l, reports.name),
        edge: { from: deciderActor(r.by, "receiver door"), to: filer, channel: "fleet-report.decision" } });
    }
  }

  // post-land-audits.jsonl: every run whose `covers` names one of this task's branches
  for (const l of rows(plAudits)) {
    const a = l.row;
    const at = num(a.at);
    if (at === null || !Array.isArray(a.covers)) continue;
    const covered = (a.covers as unknown[]).map((c) => str((c as Record<string, unknown> | null)?.branch)).find((b) => b && lanes.has(b));
    if (!covered) continue;
    events.push({ source: plAudits.name, kind: `audit.${str(a.result) ?? "unknown"}`, at,
      refs: { task: id, branch: covered, ...(str(a.mainSha) ? { sha: a.mainSha as string } : {}) }, files: [],
      detailRef: lineRef(l, plAudits.name) });
  }

  // audit.jsonl: the four rules above, one event per line however many rules it matched
  const auditLines = rows(audit);
  const knownLanes = [...lanes.values()].filter((ln): ln is { repo: string; branch: string } => !!ln.repo);
  for (const ln of lanes.values()) if (!ln.repo) caveat(audit.name, `no source names the repository of ${ln.branch} — its slot window cannot be identified`);
  const windows = slotWindows(auditLines, knownLanes, input.worktreeOf);
  // the live occupancy is a window of its own, and the only one that knows its occupant
  for (const ln of input.live) windows.push({ slot: ln.slot, from: ln.openedAt, to: Infinity, branch: ln.branch,
    openedAt: ln.openedAt, ...(ln.session ? { session: ln.session } : {}) });
  const taskToken = new RegExp(`(?:^|\\s)task=${id}(?:\\s|$)`);
  const windowSlots = new Set(windows.map((w) => w.slot));
  // every rule needs the id or a branch in `detail`, or a window slot: a substring gate first keeps
  // the ~100 000-row walk to a string search for all the rows that cannot match
  const needles = [id, ...lanes.keys()];
  for (const l of auditLines) {
    const e = l.row;
    const at = num(e.ts);
    const event = str(e.event);
    if (at === null || !event) continue;
    const detail = str(e.detail) ?? "";
    const slot = num(e.slot);
    if (e.taskId !== id && !(slot !== null && windowSlots.has(slot)) && !needles.some((n) => detail.includes(n))) continue;
    const win = slot === null ? undefined : windows.filter((w) => w.slot === slot && at >= w.from && at < w.to)
      .sort((a, b) => Number(b.openedAt !== undefined) - Number(a.openedAt !== undefined))[0];
    const byId = e.taskId === id || (LEAD_ID_EVENTS.has(event) && leadIds(detail).includes(id)) || taskToken.test(detail);
    const branch = win?.branch ?? detailTokens(detail).find((t) => lanes.has(t));
    if (!byId && !win && !branch) continue;
    const program = /(?:^|\s)program=([0-9a-f]+)/.exec(detail)?.[1];
    const occupant = win && slot === win.slot && win.openedAt !== undefined && at >= win.openedAt;
    const path = str(e.path);
    events.push({ source: audit.name, kind: event === "send" ? `send.${path ?? "unknown"}` : AUDIT_KINDS[event] ?? `event.${event}`, at,
      refs: { task: id, ...(slot !== null ? { slot } : {}), ...(occupant ? { openedAt: win.openedAt } : {}),
        ...(occupant && win.session ? { session: win.session } : {}), ...(branch ? { branch } : {}), ...(program ? { program } : {}) },
      files: [], detailRef: lineRef(l, audit.name),
      // a send names its receiver occupant and its path; the SENDER is on no audit row (T6)
      ...(event === "send" && slot !== null ? { edge: { from: { kind: "unknown" as const, via: `send path=${path ?? "unknown"}` },
        to: { kind: branch ? "lane" as const : "occupant" as const, slot, ...(branch ? { branch } : {}), ...(occupant ? { openedAt: win.openedAt } : {}) },
        channel: "send" } } : {}) });
  }

  // git: the land note on every landed sha, and the lane's own commits with their files — per repo,
  // all of it at once (each lookup is a process spawn)
  const repos = [...new Set([...knownLanes.map((ln) => ln.repo), ...landed.map((x) => x.repo), ...ranges.map((x) => x.repo)])];
  const gitFacts = await Promise.all(repos.flatMap((repo) => [
    landNoteFacts(git, id, repo, landed.filter((x) => x.repo === repo)),
    commitFacts(git, id, repo, ranges.filter((x) => x.repo === repo), caveats.get(`git-log:${repo}`) ?? []),
  ]));
  for (const f of gitFacts) { horizon.push(f.horizon); events.push(...f.events); }

  const ledgerEvents = events.filter((e) => e.kind !== "task.created");
  if (!row && !ledgerEvents.length)
    return { result: "unknown-task", task: id, horizon,
      searched: ["fleet.json tasks", ...[audit, outcomes, plAudits, reports, archive].map((r) => r.name)] };
  const anchorAt = row?.created ?? Math.min(...ledgerEvents.map((e) => e.at));

  // per-source coverage: the horizon read against THIS task's anchor
  const coverage: SourceCoverage[] = ledgers.map(({ read: r, h }): SourceCoverage => {
    const n = events.filter((e) => e.source === r.name).length;
    if (h.state !== "read") return { source: r.name, state: "unmeasured", reason: h.reason };
    if (h.oldestAt > anchorAt) {
      const reason = `${r.name} holds rows from ${iso(h.oldestAt)} on; this task begins ${iso(anchorAt)} — nothing older is retained there`;
      return n ? { source: r.name, state: "partial", events: n, reason } : { source: r.name, state: "unmeasured", reason };
    }
    return { source: r.name, state: "read", events: n, ...(caveats.get(r.name) ? { caveats: caveats.get(r.name) } : {}) };
  });
  if (!repos.length) coverage.push({ source: "git", state: "unmeasured",
    reason: "no ledger row names this task's repository — land notes and commits cannot be looked up" });
  coverage.push(...gitFacts.map((f) => f.coverage));

  // time order; equal times keep a DETERMINISTIC order (source, then locator) — a tie is not causality
  events.sort((a, b) => a.at - b.at || a.source.localeCompare(b.source)
    || (a.detailRef?.locator ?? "").localeCompare(b.detailRef?.locator ?? ""));
  return { result: "trace", task: id, row, anchorAt, events, horizon, coverage };
}

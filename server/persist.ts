import { appendFile } from "node:fs/promises";
import { existsSync, statSync, chmodSync, renameSync, readFileSync, appendFileSync } from "node:fs";
import { logError } from "./errors";

// rotation threshold (x.jsonl -> x.jsonl.1, outgoing .1 appended to x.jsonl.archive) — override for tests
export const AUDIT_ROTATE_BYTES = Number(process.env.FLEET_AUDIT_ROTATE_BYTES ?? 5_000_000) | 0;
// generic append-only event-log chain: format (one JSON line), chmod 600, single-generation
// rotation. audit.jsonl is the first consumer but not the only shape this fits (automation-
// synergies.md finding 5 — journal/outcome logs later reuse this exact discipline instead of
// re-deriving it). One write chain + one failure flag shared across every file that goes
// through here: today that's just AUDIT_FILE, so serializing unrelated files on one chain
// costs nothing yet — split per-file if a second consumer's volume ever makes that a problem.
let auditChain: Promise<unknown> = Promise.resolve();
let auditWriteFailed = false; // report a wedged event log once, not on every subsequent event
let archiveRotateFailed = false; // report an unwritable archive once; rotation stays off afterwards
function queueEventWrite(file: string, obj: Record<string, unknown>): Promise<void> {
  const line = `${JSON.stringify(obj)}\n`;
  const raw = auditChain
    .then(async () => {
      if (existsSync(file) && statSync(file).size >= AUDIT_ROTATE_BYTES)
        rotateEventLog(file);
      await appendFile(file, line, { mode: 0o600 });
      chmodSync(file, 0o600); // append doesn't guarantee mode on a pre-existing file
    });
  auditChain = raw.catch((e: unknown) => {
      // the latch stays: this one is per-EVENT, so a wedged disk would otherwise call logError on
      // every audited action. logError's own repeat-suppression counts those; this one drops them,
      // which is the older and stricter promise and the one this file's readers already rely on.
      if (auditWriteFailed) return;
      auditWriteFailed = true;
      logError("eventLog", e);
    });
  return raw;
}
// x.jsonl -> x.jsonl.1, with the OUTGOING .1 appended to x.jsonl.archive first: the rename alone
// overwrote the previous .1 — the only old generation — on every rotation (S1, 2026-09-15). A
// failed archive append aborts the rotation (losing the .1 is worse than an over-threshold file)
// and is logged once; events keep appending without rotating until a restart.
function rotateEventLog(file: string): void {
  const one = `${file}.1`;
  if (existsSync(one)) {
    try {
      const archive = `${file}.archive`;
      appendFileSync(archive, readFileSync(one), { mode: 0o600 });
      chmodSync(archive, 0o600); // append doesn't guarantee mode on a pre-existing file
    } catch (e) {
      if (!archiveRotateFailed) {
        archiveRotateFailed = true;
        logError("eventLogArchive", e);
      }
      return;
    }
  }
  renameSync(file, one);
}
export function appendEvent(file: string, obj: Record<string, unknown>): Promise<void> {
  return queueEventWrite(file, obj).catch(() => undefined);
}
// Founding receipts are evidence promised by the authority transition, so their caller must see a
// failed append and roll back. Every unrelated event keeps the historical best-effort contract.
export function appendEventStrict(file: string, obj: Record<string, unknown>): Promise<void> {
  return queueEventWrite(file, obj);
}
// The state-file writer's scheduler: a burst of save requests collapses into one physical write,
// with no timer (docs/messungen/2026-09-11-knackpunkte-verschlankung-astra.md §K6). At most ONE
// run waits behind the running one; every request made while it waits joins it and gets its
// promise. The body is taken when the run STARTS, so it covers every mutation made before that —
// which is what makes joining sound: a joiner's intent is always in the snapshot it waits for.
// The converse is the barrier rule: a request made while a run is already writing never gets that
// run's promise (its snapshot predates the request) but the next one's. A failed run rejects every
// request joined to it — a barrier caller must see its write did not land — reports once, and
// leaves the chain usable, so the next request writes afresh. Injected, not imported: this file
// is a leaf, and the probe in e2e/land-durability.ts drives it with a fake write.
export function coalescedSaver(snapshot: () => string, write: (body: string) => void | Promise<void>,
  onError: (e: unknown) => void): () => Promise<void> {
  let tail: Promise<void> = Promise.resolve(); // settles after the latest scheduled run; never rejects
  let waiting: Promise<void> | null = null; // scheduled, not yet started
  return () => {
    if (waiting) return waiting;
    const run = tail.then(async () => {
      waiting = null; // from here a new request may postdate this snapshot, so it gets a new run
      await write(snapshot());
    });
    waiting = run;
    tail = run.catch(onError);
    return run;
  };
}

// The READ counterpart of appendEvent, rotation-aware (a single-file reader is invisible to
// rotation: at AUDIT_ROTATE_BYTES the whole history becomes `x.jsonl.1` and `x.jsonl` restarts
// empty, so it would return a near-empty answer with NO error — the ledger looks young rather
// than truncated; data-audit-2026-07-27 item 8) and the one place a torn line is counted instead
// of swallowed. Every ledger route used to drop unparseable lines silently and then answer
// `total: lines.length` — counting rows it had just discarded — so a torn mid-append row reached
// the client as a benign "latest 51 of 52, capped" instead of "one row is a hole". `total` is now
// what was actually PARSED across BOTH generations and `malformed` is the hole, reported
// separately; that is the same discipline continuityView already applies to this same prompt
// journal (continuity.ts, the `outOfScope.malformed` counter) — copied, not re-invented.
// A line that PARSES but is not a record (`null`, `42`, `"x"`, `[…]`) is a hole too: appendEvent
// only ever writes objects, and every caller reads fields off a row, so delivering one throws a
// TypeError in the consumer while `malformed` still says 0. Only the record SHAPE is checked here —
// each row type's fields stay the caller's business (validAuditRow, validDeployRow, …).
// Bounded by construction: exactly two files, each capped at the rotation threshold.
export interface Ledger<T> { rows: T[]; total: number; malformed: number }
export async function readLedger<T>(file: string): Promise<Ledger<T>> {
  const rows: T[] = [];
  let malformed = 0;
  for (const f of [`${file}.1`, file]) { // .1 is the OLDER generation → this order is chronological
    // No existsSync in front: rotateEventLog renames `file` to `.1` inside the await, so a check-
    // then-read threw ENOENT out of server.ts#seedInbound's top-level await, before Bun.serve. A
    // generation gone by read time is simply missing; any other read error still throws.
    let text: string;
    try { text = await Bun.file(f).text(); }
    catch (e: unknown) {
      if ((e as { code?: string }).code === "ENOENT") continue;
      throw e;
    }
    for (const line of text.split("\n")) {
      if (!line) continue;
      let row: unknown;
      try {
        row = JSON.parse(line);
      } catch {
        malformed++; // a torn mid-append line — a hole, and reported as one
        continue;
      }
      if (row === null || typeof row !== "object" || Array.isArray(row)) malformed++;
      else rows.push(row as T);
    }
  }
  return { rows, total: rows.length, malformed };
}
// same rotation-safe read, for the callers that only ever cared about `rows` (chronological,
// oldest generation first) and never adopted the malformed-count contract above.
export async function readEventLog(file: string): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const { rows, total } = await readLedger<Record<string, unknown>>(file);
  return { rows, total };
}

// THE EXPLICIT HISTORY PATH (memory M2, task 72dc4f35) — the bounded, BACKWARD reader beside
// readLedger. readLedger stays exactly what it was for every existing caller: two generations, read
// whole, oldest first. Nothing here is reached from a poll; the one caller is the memory door's
// evidence view, which reads page by page under a byte budget and says how far it got.
//
// THREE GENERATIONS PER CARRIER, newest first: the active file, `.1`, and `.archive` (rotateEventLog
// appends the outgoing `.1` there). Reading them backwards IN APPEND ORDER is the only order this
// claims — never a global sort by event time across carriers.
//
// THE CUT. A read fixes, per generation, the file identity (inode) and the byte just past the last
// COMPLETE line. Every later page reads only below that cut: an append behind it is allowed and
// simply not part of this read, a torn line at the tail is not a record yet. A rotation moves a
// generation to another path — it is followed by inode — and dissolves the old `.1` into the
// archive; a generation whose inode can no longer be found at or above its cut size is STALE, and
// the caller must say so instead of continuing on different bytes.
export const LEDGER_GENERATIONS = ["", ".1", ".archive"] as const;
export interface GenerationCut { gen: string; ino: number | null; end: number }
const SCAN_CHUNK = 64 * 1024;
const SCAN_LINE_MAX = 8 * 1024 * 1024; // a single record longer than this is reported, never read

async function lastLineEnd(path: string, size: number): Promise<number> {
  for (let chunk = SCAN_CHUNK; ; chunk *= 2) {
    const from = Math.max(0, size - chunk);
    const bytes = new Uint8Array(await Bun.file(path).slice(from, size).arrayBuffer());
    const nl = bytes.lastIndexOf(10);
    if (nl >= 0) return from + nl + 1;
    if (from === 0) return 0;
  }
}
export async function ledgerCut(file: string): Promise<GenerationCut[]> {
  const cut: GenerationCut[] = [];
  for (const gen of LEDGER_GENERATIONS) {
    const path = `${file}${gen}`;
    if (!existsSync(path)) { cut.push({ gen, ino: null, end: 0 }); continue; }
    const st = statSync(path);
    cut.push({ gen, ino: Number(st.ino), end: await lastLineEnd(path, st.size) });
  }
  return cut;
}
// where the bytes of one cut generation live NOW, or null when they cannot be found unchanged
export function resolveGeneration(file: string, cut: GenerationCut): string | null {
  for (const gen of LEDGER_GENERATIONS) {
    const path = `${file}${gen}`;
    if (!existsSync(path)) continue;
    const st = statSync(path);
    if (Number(st.ino) === cut.ino && st.size >= cut.end) return path;
  }
  return null;
}
export interface BackwardLine { start: number; bytes: number; row: Record<string, unknown> | null }
export type BackwardStop = "exhausted" | "budget" | "stopped" | "oversize";
// One generation, from `offset` (exclusive end, always a line boundary) towards byte 0. `visit`
// answers "take" (consumed) or "stop" (NOT consumed — the returned offset still includes it, so the
// next page reads it again). `row: null` is a line that is not a JSON record: counted by the
// caller, never dropped silently. The budget counts consumed bytes; it is exceeded only by the
// first line of a call, so a record is never split across pages.
export async function scanGenerationBackward(path: string, offset: number, budget: number,
  visit: (line: BackwardLine) => "take" | "stop"): Promise<{ offset: number; consumed: number; stop: BackwardStop }> {
  let consumed = 0;
  let chunk = SCAN_CHUNK;
  const decoder = new TextDecoder();
  while (offset > 0) {
    const from = Math.max(0, offset - chunk);
    const bytes = new Uint8Array(await Bun.file(path).slice(from, offset).arrayBuffer());
    let pos = bytes.length; // relative end of the unread region; bytes[pos - 1] is a newline
    for (;;) {
      if (pos === 0) break;
      const prev = pos >= 2 ? bytes.lastIndexOf(10, pos - 2) : -1; // a negative fromIndex counts from the END
      if (prev < 0 && from > 0) break; // this line starts before the chunk — read further back
      const start = prev + 1;
      const len = pos - start;
      if (consumed > 0 && consumed + len > budget) return { offset: from + pos, consumed, stop: "budget" };
      const text = decoder.decode(bytes.subarray(start, pos - 1));
      if (text.trim() !== "") {
        let row: Record<string, unknown> | null = null;
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) row = parsed as Record<string, unknown>;
        } catch { /* a hole, reported as row:null */ }
        if (visit({ start: from + start, bytes: len, row }) === "stop") return { offset: from + pos, consumed, stop: "stopped" };
      }
      consumed += len;
      pos = start;
    }
    if (pos === bytes.length) { // not one complete line in this chunk: the line is longer than it
      if (chunk >= SCAN_LINE_MAX) return { offset, consumed, stop: "oversize" };
      chunk *= 2;
      continue;
    }
    offset = from + pos;
    chunk = SCAN_CHUNK;
    if (consumed >= budget) return { offset, consumed, stop: offset > 0 ? "budget" : "exhausted" };
  }
  return { offset: 0, consumed, stop: "exhausted" };
}

// WHOSE PANES A STATE FILE DESCRIBES. Every slot row in fleet.json names a tmux session on ONE
// socket, and the SOCKET is the identity that carries it, not FLEET_INSTANCE: `tmux -L <sock>` is
// the only address those panes have, FLEET_INSTANCE is a display name that may be unset on both
// sides (then it compares null to null) and that a scratch copy inherits verbatim whenever it copies
// `.env` along (bun auto-loads it). A suite or scratch rig MUST move the socket to run safely at
// all, so the socket is the one field a copied state reliably disagrees on. The 2026-09-20 incident
// (report af1aa862) was exactly that shape: a scratch server on its own socket booted a copy of the
// live state, found none of those slots' panes on ITS socket, and self-heal resumed the live
// conversations there — slot 11's codex agent did not survive it.
//
// Returns null when the rows are this boot's to rehydrate, else a printable name of the owner.
//
// THE DANGEROUS LINE IS THE FIRST ONE. A state file WITHOUT the field — every fleet.json written
// before this check existed, including the live one at the first deploy that carries it — counts
// as OWNED BY WHOEVER READS IT. Reading absence as "foreign" would make that deploy boot the live
// fleet with zero slots: every lane, MAIN and session pin gone in one restart. So absence keeps
// today's behaviour, and the first saveState() of that boot writes the field, after which the file
// is protected. The price is honest and bounded: a copy taken from a file that predates the field
// is still adopted, exactly as before this change.
// A PRESENT field that is not a string was written by no server, so it is not read as ours: the
// hand-edit fails closed, towards an empty slot list, never towards foreign panes.
export function foreignStateOwner(field: unknown, ownSock: string): string | null {
  if (field === undefined) return null;
  if (field === ownSock) return null;
  return typeof field === "string" ? JSON.stringify(field.slice(0, 64)) : "an unreadable socket field";
}

import { appendFile } from "node:fs/promises";
import { existsSync, statSync, chmodSync, renameSync } from "node:fs";
import { logError } from "./errors";

// one rotation generation (audit.jsonl -> audit.jsonl.1, oldest overwritten) — override for tests
export const AUDIT_ROTATE_BYTES = Number(process.env.FLEET_AUDIT_ROTATE_BYTES ?? 5_000_000) | 0;
// generic append-only event-log chain: format (one JSON line), chmod 600, single-generation
// rotation. audit.jsonl is the first consumer but not the only shape this fits (automation-
// synergies.md finding 5 — journal/outcome logs later reuse this exact discipline instead of
// re-deriving it). One write chain + one failure flag shared across every file that goes
// through here: today that's just AUDIT_FILE, so serializing unrelated files on one chain
// costs nothing yet — split per-file if a second consumer's volume ever makes that a problem.
let auditChain: Promise<unknown> = Promise.resolve();
let auditWriteFailed = false; // report a wedged event log once, not on every subsequent event
function queueEventWrite(file: string, obj: Record<string, unknown>): Promise<void> {
  const line = `${JSON.stringify(obj)}\n`;
  const raw = auditChain
    .then(async () => {
      if (existsSync(file) && statSync(file).size >= AUDIT_ROTATE_BYTES)
        renameSync(file, `${file}.1`);
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
export function appendEvent(file: string, obj: Record<string, unknown>): Promise<void> {
  return queueEventWrite(file, obj).catch(() => undefined);
}
// Founding receipts are evidence promised by the authority transition, so their caller must see a
// failed append and roll back. Every unrelated event keeps the historical best-effort contract.
export function appendEventStrict(file: string, obj: Record<string, unknown>): Promise<void> {
  return queueEventWrite(file, obj);
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
// Bounded by construction: exactly two files, each capped at the rotation threshold.
export interface Ledger<T> { rows: T[]; total: number; malformed: number }
export async function readLedger<T>(file: string): Promise<Ledger<T>> {
  const rows: T[] = [];
  let malformed = 0;
  for (const f of [`${file}.1`, file]) { // .1 is the OLDER generation → this order is chronological
    if (!existsSync(f)) continue;
    for (const line of (await Bun.file(f).text()).split("\n")) {
      if (!line) continue;
      try {
        rows.push(JSON.parse(line) as T);
      } catch {
        malformed++; // a torn mid-append line — a hole, and reported as one
      }
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

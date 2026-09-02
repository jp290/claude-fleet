// --- THE ERROR CHANNEL -------------------------------------------------------------------------
// Everything above reports its failures the same way: a line on stdout, which watchdog.sh redirects
// into a `server.log` with no rotation and — measured, not guessed — no reader. e2e-stage.sh calls
// it "a server.log nobody reads" in its own source. What that costs is concrete: on 2026-08-07 the
// owner pressed ↩ kill, got a 500, and the only trace was a TypeError in that file; the same file
// carries eighteen `analysis: brief compile failed` lines, i.e. eighteen drafts that never got an
// analysis while their queue rows said `no-analysis` — indistinguishable from "not judged yet".
//
// This is the READING half, and it is deliberately small:
//   · IN MEMORY, never a ledger. A restart is a true fact about this server; a revived error list
//     would be an invented one. The durable history is server.log, which keeps its job.
//   · KEYED BY SIGNATURE, not a flat ring. The one real sample says why: a plain ring of the last
//     N would have been fifty copies of one repeating analysis failure, and the counter would read
//     "50 errors" for one broken thing. `n` per signature is the honest shape, and it is also what
//     lets a 2 s tick fail forever without flooding anything.
//   · SUMMARY on /api/sessions (the 2 s poll, the endpoint data-saver.md exists to keep small) and
//     `null` while nothing has failed, so the quiet case costs the poll ~14 bytes. The rows live
//     behind GET /api/errors, fetched on a click — the same split postLandAudit already uses.
//
// NOT here, and each absence is a decision:
//   · process.on("uncaughtException"/"unhandledRejection"). Measured on Bun 1.3.9: with no listener
//     both print and exit 1; with a listener the process SURVIVES (exit 0, execution continues).
//     So installing one converts "srv dies, the watchdog respawns it clean in ~60 s" into "srv
//     limps on in an undefined state" — a robustness regression wearing an observability costume.
//     Re-exiting from the handler avoids that but records into a buffer that dies microseconds
//     later, which no poll can ever read. Fatal errors stay fatal; server.log keeps them.
//   · most of the empty catches. `try { p.kill() } catch {}` is an already-dead process and the
//     input/resize chains fail visibly in the pane itself. What is wired below is the set where
//     silence hides a DECISION: a scheduler tick that threw did not do its round, and nothing
//     anywhere said so.
// The four state-write reporters above (saveHistory, promptLog, saveState, eventLog) were already
// PRINTING their failures and now report here instead — same events, a surface that has a reader.
// One deliberate loss in that swap: they printed every repeat and this prints only the first
// sighting of a signature. The count is not lost, it moves to `n`; what is lost is a repeating
// failure's ability to fill a log file that nothing rotates.
export const ERROR_KEEP = 50;          // distinct signatures held; the least-recently-seen is evicted
export const ERROR_MSG_MAX = 200;      // a message is a label here, not a payload — the stack goes to server.log
export const SERVER_BOOT_AT = Date.now();
export interface ServerErrorRow { where: string; msg: string; first: number; last: number; n: number }
export interface ErrorsInfo {
  total: number; distinct: number; since: number;
  last: { at: number; where: string; msg: string; n: number };
}
// insertion-ordered, and re-inserted on every repeat — so the first key is always the coldest
// signature and eviction is LRU-by-last-seen without a second index to keep in step
export const serverErrors = new Map<string, ServerErrorRow>();
export let errorTotal = 0;
export function logError(where: string, e: unknown): void {
  const raw = e instanceof Error ? (e.message || e.name) : String(e);
  const msg = raw.replace(/\s+/g, " ").trim().slice(0, ERROR_MSG_MAX);
  const at = Date.now();
  errorTotal++;
  // `where` is always a bare identifier from the call sites below — never a space — so this
  // separator cannot make two different (where, msg) pairs collide on one key
  const key = `${where} ${msg}`;
  const prev = serverErrors.get(key);
  if (prev) {
    prev.last = at;
    prev.n++;
    serverErrors.delete(key); // re-insert at the tail: this signature is now the freshest
    serverErrors.set(key, prev);
    return; // the count is the record; printing every repeat is what fills an unrotated file
  }
  serverErrors.set(key, { where, msg, first: at, last: at, n: 1 });
  if (serverErrors.size > ERROR_KEEP) {
    const coldest = serverErrors.keys().next();
    if (!coldest.done) serverErrors.delete(coldest.value);
  }
  // FIRST sighting of a signature, printed in full — server.log must not come out of this poorer
  // than it went in. The stack is where the line number lives, which is the whole reason the ↩ kill
  // incident was diagnosable at all; three frames is enough to name the site without a wall of text.
  const stack = e instanceof Error && e.stack ? e.stack.split("\n").slice(0, 3).map((l) => l.trim()).join(" | ") : msg;
  console.log(`error [${where}]: ${stack} — repeats of this are counted, not printed (GET /api/errors)`);
}
// One projection for /api/sessions, `null` while nothing has failed — same rule gateView follows,
// for the same reason. `since` is load-bearing rather than decorative: the counts are meaningless
// without the window they were counted over, and this buffer's window always starts at boot.
export function errorsView(): ErrorsInfo | null {
  if (serverErrors.size === 0) return null;
  const rows = [...serverErrors.values()];
  const last = rows.reduce((a, b) => (b.last > a.last ? b : a));
  return {
    total: errorTotal,
    distinct: rows.length,
    since: SERVER_BOOT_AT,
    last: { at: last.last, where: last.where, msg: last.msg, n: last.n },
  };
}

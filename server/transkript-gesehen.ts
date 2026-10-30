import { appendFileSync, existsSync, readFileSync } from "node:fs";

// WHAT FLEET HAS SEEN OF A SESSION'S FILE, made durable, and the reason a past session has no file.
// The past view (GET /api/slots/:id/succession/:n/transcript) used to say "no longer on disk" of
// every missing file, and that was false for the common case: pi writes its session file only once
// the session has its first user or assistant message (pi's SessionManager._persist), so an
// occupation that dies before its first turn — the heal respawn of 2026-10-27 — leaves no file, and
// nothing was ever deleted. The journal is one append-only line per session id whose file a reader
// resolved at least once; its first line, {"since": ms}, is when it began (written with the first session it records). A missing file is then
// one of three truths, most specific first:
//   deleted        Fleet read the file once and no longer finds it;
//   never-written  a pi occupation that started AFTER the journal began and was never seen — Fleet
//                  would have read its file had it existed, and pi/Fleet delete none;
//   unknown        anything else: a non-pi harness, or an occupation older than the journal, whose
//                  file the journal could not have seen — it may have existed and been removed.
// Tolerant on load like every append-only file here: a torn or bad line is skipped, never fatal.
// The journal may only ever make a reason more specific, never wrong.

// The journal lives in the state dir, which is the checkout itself (STATE_DIR): .gitignore must name it.
export const TRANSKRIPT_JOURNAL = "transcripts-seen.jsonl";

export type PastAbsent = "deleted" | "never-written" | "unknown";
export const PAST_DELETED = "This session's transcript file is no longer on disk — Fleet read it before, and it has been removed since";
export const PAST_NEVER_WRITTEN = "This occupation never wrote a session file — pi writes one only once the session has its first message, and this occupation ended before its first turn";
export const PAST_MISSING_UNKNOWN = "No transcript file exists for this session — none was ever written, or the file has been removed since";

export function openTranscriptJournal(file: string, now: () => number = Date.now) {
  const seen = new Set<string>();
  let since: number | null = null;
  // a crash can leave the last line without its newline: the next append must not glue itself to it
  let tornEnd = false;
  if (existsSync(file)) {
    try {
      const text = readFileSync(file, "utf8");
      tornEnd = text !== "" && !text.endsWith("\n");
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line) as { sessionId?: unknown; since?: unknown };
          if (typeof row.sessionId === "string" && row.sessionId) seen.add(row.sessionId);
          if (since === null && typeof row.since === "number" && Number.isFinite(row.since)) since = row.since;
        } catch { /* torn tail */ }
      }
    } catch { /* unreadable: as no journal, the reasons stay "unknown" */ }
  }
  // A journal that does not exist yet begins now, but leaves no file until it has something to say:
  // loading server.ts must leave no trace in the state directory.
  let headerPending = false;
  if (!existsSync(file)) { since = now(); headerPending = true; }
  return {
    noteSeen(sessionId: string | null): void {
      if (!sessionId || seen.has(sessionId)) return;
      seen.add(sessionId);
      try {
        if (tornEnd) { appendFileSync(file, "\n"); tornEnd = false; }
        if (headerPending) { appendFileSync(file, `${JSON.stringify({ since })}\n`); headerPending = false; }
        appendFileSync(file, `${JSON.stringify({ sessionId })}\n`);
      } catch { tornEnd = true; /* best effort — the in-memory fact still holds; a write that broke off may have left a torn end */ }
    },
    // startedAt: when the missing session's occupation began (null when no record names it)
    pastMissingOf(sessionId: string, harness: string | null, startedAt: number | null): { absent: PastAbsent; reason: string } {
      if (seen.has(sessionId)) return { absent: "deleted", reason: PAST_DELETED };
      const journalSawIt = since !== null && startedAt !== null && startedAt >= since;
      return (harness ?? "").startsWith("pi") && journalSawIt
        ? { absent: "never-written", reason: PAST_NEVER_WRITTEN }
        : { absent: "unknown", reason: PAST_MISSING_UNKNOWN };
    },
  };
}

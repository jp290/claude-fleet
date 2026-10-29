// A BUBBLE THAT NEVER ARRIVES CAN GO (brief 2026-10-29). The composer's own bubble waits until the
// transcript brings the turn (settlePending) or the session's queue names it (syncQueue gives it a
// key). A send that neither happens — the pane stood mid-restart and holds the text unsubmitted
// (docs/messungen/2026-10-03-terminal-vs-chat-warten.md §7), or the turn never took it — waits for
// good, and the owner cannot dismiss it. This leaf holds the rule for when such a bubble becomes
// REMOVABLE; the owner presses the button, the view never drops his send on its own.
//
// The moment is the one the queue sync already keeps time by: QUEUE_LEFT_MS after the first sync
// that does not name the send. The same grace today drops a bubble whose queue entry left without
// the transcript bringing it in the same read — the dequeue-to-transcript gap measured ~10 ms, the
// grace 5 s. A send the queue never named gets the same 5 s of syncs (the live poll comes every
// 2 s) to appear in queue or transcript; after that, at least two further syncs said it is nowhere.

// the shape of a waiting bubble the chat view holds (src/client.ts#PendingBubble): `key` is the
// session-queue entry that names it, `leftAt` when the queue last failed to name it
export interface TakeBackPending { key?: string; leftAt?: number }

// true = no queue entry and no transcript turn has named this send for longer than the grace,
// and its send was accepted (the caller checks the bubble's wait state): the owner may take it back
export function pendingTakeBack(p: TakeBackPending, now: number, graceMs: number): boolean {
  return p.key === undefined && p.leftAt !== undefined && now - p.leftAt > graceMs;
}

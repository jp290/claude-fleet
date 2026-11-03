// SENDING ON A BAD LINE. The answer to a send can get lost after the server typed the text, and a read on a dead
// connection hangs for minutes. So one press asks the server under one name (server/send-once.ts) as often as it takes
// to hear an answer, each try on a new connection: a server that already typed it answers from what it kept. The press
// ends with an answer, or after SEND_GIVE_UP_MS with „not known“, and then the text is still in the box and the name
// stays with it: pressing again asks about the same message. A message waits at most that long; a text that goes out
// long after he moved on would surprise him more than a box that still holds it.

export const SEND_TRY_MS = 15_000;
export const SEND_GIVE_UP_MS = 120_000;
export const SEND_ID_MS = 10 * 60_000; // shorter than the server keeps a name (server/send-once.ts)
const RETRY_PAUSE_MS = 2_000;
const WEAK_LINE_BYTES_PER_S = 2_000; // a long text on 64 kbit/s (6 KB/s, shared): its upload is not silence

export const sendTryMs = (bytes: number): number => SEND_TRY_MS + Math.ceil(bytes / WEAK_LINE_BYTES_PER_S) * 1000;

export type SendResult = { kind: "answer"; res: Response } | { kind: "not-known" };
export interface SendClock { now(): number; sleep(ms: number): Promise<void>; setTimeout(fn: () => void, ms: number): unknown; clearTimeout(t: unknown): void }
const realClock: SendClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((ok) => setTimeout(ok, ms)),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

export async function sendUntilAnswered(go: (signal: AbortSignal) => Promise<Response>, o: {
  bytes: number;
  stillWanted: () => boolean; // he changed the text: nothing more goes out for the old one
  onRetry: () => void;
  clock?: SendClock;
}): Promise<SendResult> {
  const clock = o.clock ?? realClock;
  const start = clock.now();
  const over = (): boolean => clock.now() - start >= SEND_GIVE_UP_MS;
  for (;;) {
    const ctrl = new AbortController();
    const limit = clock.setTimeout(() => ctrl.abort(), sendTryMs(o.bytes));
    try {
      return { kind: "answer", res: await go(ctrl.signal) };
    } catch { /* no answer: a dead connection, or the line is gone */ } finally {
      clock.clearTimeout(limit);
    }
    if (over() || !o.stillWanted()) return { kind: "not-known" };
    o.onRetry();
    await clock.sleep(RETRY_PAUSE_MS);
    if (over() || !o.stillWanted()) return { kind: "not-known" };
  }
}

// A NAME BELONGS TO ONE PRESS, never to the words: „ok“ twice is two messages. It stays only with the text still
// waiting in that box, so a press after the two minutes, or on a box a reload restored, asks about the same message.
// It goes two places. The tab's store: what this tab pressed. The draft's store (localStorage, as the draft itself): a
// tab closed with the answer out leaves its draft to the next tab, and the name goes with it. Only a box that still
// stands as the draft reads it: whatever a tab has typed is its own message, also with the same words, so a second tab
// is a second message. A browser that keeps nothing falls on the side of a new name: a doubled message beats a lost one.
export const newSendName = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16)); // randomUUID needs https, and an instance runs on http
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
};
const boxKey = (slot: number): string => `fleet.sendName.${slot}`;
export const BOX_NAME_MS = 23 * 60 * 60_000; // shorter than the server keeps a name (server/send-once.ts)
export type SendNameStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function heldName(slot: number, text: string, store: SendNameStore, now: number): string | null {
  try {
    const held = JSON.parse(store.getItem(boxKey(slot)) ?? "null") as { id?: unknown; text?: unknown; at?: unknown } | null;
    if (held && typeof held.id === "string" && held.text === text && typeof held.at === "number" && now - held.at < BOX_NAME_MS) return held.id;
  } catch { /* not ours: a new name */ }
  return null;
}
function hold(slot: number, id: string, text: string, store: SendNameStore, now: number): void {
  try { store.setItem(boxKey(slot), JSON.stringify({ id, text, at: now })); } catch { /* a full store: this press still has its name */ }
}
export function boxSendName(slot: number, text: string, tab: SendNameStore, draft: { store: SendNameStore; untouched: boolean }, now = Date.now()): { id: string; again: boolean } {
  const mine = heldName(slot, text, tab, now);
  if (mine) return { id: mine, again: true };
  const left = draft.untouched ? heldName(slot, text, draft.store, now) : null;
  const id = left ?? newSendName();
  hold(slot, id, text, tab, now);
  if (!left) hold(slot, id, text, draft.store, now);
  return { id, again: !!left };
}
export function dropBoxSendName(slot: number, ...stores: SendNameStore[]): void {
  for (const store of stores) try { store.removeItem(boxKey(slot)); } catch { /* nothing to drop */ }
}

// The data-saver poll plan, kept out of client.ts so it can be unit-tested without a DOM
// (e2e/slots.ts calls pollPlan directly).

// --- data saver: ONE per-device switch, and the only thing in Fleet that trades freshness
// for bytes. What it does NOT touch is the terminal: live output and typing ride the
// WebSocket, so they stay exactly as fast either way. What it slows are the metadata polls
// (sidebar/queue, chat, session brief) and what it shrinks is the scrollback the server
// seeds on reconnect. Per-number cost/gain is measured in the commit that added this.
const SAVER = { pollMs: 10_000, chatMs: 3_000, boardMs: 10_000, seed: 500 };
const NORMAL = { pollMs: 2_000, chatMs: 1_000, boardMs: 3_000, seed: 0 }; // seed 0 = server's SEED_LINES
// pure on purpose, and kept clear of the DOM/localStorage lines below it: the e2e suite has
// no DOM harness, so it cuts this function out and runs it for real. pollMs/chatMs/boardMs
// === 0 means "no timer at all" — a hidden tab polls NOTHING, in either mode. seed is
// deliberately unaffected by hidden: it is read at connect time, which only happens visible.
export function pollPlan(hidden: boolean, saver: boolean): { pollMs: number; chatMs: number; boardMs: number; seed: number } {
  const t = saver ? SAVER : NORMAL;
  return hidden ? { pollMs: 0, chatMs: 0, boardMs: 0, seed: t.seed } : { ...t };
}

// WS reconnect pacing, kept out of client.ts so it can be unit-tested without a DOM
// (e2e/slots.ts asserts the schedule directly).
//
// A reconnect is not free: the server answers every open with a scrollback seed
// (server.ts, websocket.open). A fixed fast retry means a phone on a dying radio buys that
// seed again every 1.5 s for as long as the radio stays bad, which is the shape of an
// unbounded data bill. So the interval escalates and stops at a ceiling — but the FIRST
// retry stays fast, because the common case is a one-off drop where anything slower is
// felt immediately as a dead terminal.
export const RECONNECT_FIRST_MS = 1500;
export const RECONNECT_MAX_MS = 15_000;
// a socket that stayed up this long was a working session, not a flap — its next drop
// starts the schedule over at RECONNECT_FIRST_MS. Resetting on open alone would defeat the
// whole point: open-then-drop IS the expensive loop, since each open pays for a seed.
export const RECONNECT_SETTLED_MS = 30_000;

// attempt 0 is the first retry after a drop: 1.5s, 3s, 6s, 12s, then 15s forever
export const reconnectDelay = (attempt: number): number =>
  Math.min(RECONNECT_MAX_MS, RECONNECT_FIRST_MS * 2 ** Math.max(0, attempt));

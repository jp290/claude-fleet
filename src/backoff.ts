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
// a seat came to the pane's slot: how long it may take to answer before the dot and the bar call the socket down, and how
// soon after a refusal to ask again. Its row is written before its pane exists, so the first socket can be refused
export const SEAT_SOCKET_MS = 3_000;
export const SEAT_ASK_AGAIN_MS = 500;
// how long a socket the server began closing counts as up while the browser waits for the TCP close behind the frame (src/client.ts#serverClosing). A hung CLOSING lasts Chrome's 2.1 s (measured), so 3 s outlasts it; held by a claim on a fixed clock (e2e/slots.ts)
export const SEAT_CLOSING_MS = 3_000;
// the close code the server ends a seat's sockets with (server.ts#killSlot)
export const SEAT_ENDED_CLOSE = 4000;

// attempt 0 is the first retry after a drop: 1.5s, 3s, 6s, 12s, then 15s forever
export const reconnectDelay = (attempt: number): number =>
  Math.min(RECONNECT_MAX_MS, RECONNECT_FIRST_MS * 2 ** Math.max(0, attempt));

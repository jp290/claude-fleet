// THE LINE: what this page knows about its way to the server, from the reads it makes anyway. A dropout on the
// phone used to look like nothing at all: a read on a dead connection hung with no word, the next one started only
// after it, and the dot looked at the terminal socket alone. Four facts come out of here, and nothing is stored:
//   silent()  asked and nothing came back for LINE_RED_MS: the dot says so
//   unconfirmed()  back from hidden and no answer yet: the dot isn't green, and isn't red either, it hasn't been long
//   weak      the sessions poll stays slow: the polls take the data saver's pace until it is quick again
//   onStall   a read got no byte for POLL_STALL_MS: it is cut, the next one takes a new connection, and the panes
//             check their sockets, because a socket on a dead line never closes on its own
// The limit counts silence, not length. A long transcript on 64 kbit/s takes longer than any fixed limit and is
// alive the whole time; a dead connection brings nothing. Only the three poll chains read through here: other
// routes are as long as they are (lane-outcomes needs about 17 s on 64 kbit/s), and /send has its own (src/send-once.ts).

export const POLL_STALL_MS = 20_000;
export const LINE_RED_MS = 10_000;
export const WEAK_POLL_MS = 1_000;
// a read this old when the page comes back began before it left, on whatever line there was then
const OLD_READ_MS = 2_000;
const WEAK_AFTER_READS = 2; // one slow read is a hiccup, a thawed page or a busy server

export interface PollGuard {
  signal: AbortSignal;
  life(): void; // a byte came: the line is alive
  json<T>(res: Response): Promise<T>;
  end(): void;
}

type Timer = ReturnType<typeof setTimeout>;
export interface LineClock { now(): number; setTimeout(fn: () => void, ms: number): Timer; clearTimeout(t: Timer): void }

export class Line {
  weak = false;
  onStall: () => void = () => {};
  onWeak: () => void = () => {};
  onConfirmed: () => void = () => {}; // back from hidden, and the first answer has come
  private heardOnce = false;
  private open = new Set<{ startedAt: number; heard: boolean; cut(): void }>();
  private waitingSince: number | null = null;
  private slowReads = 0;
  private cameBack = false;
  constructor(private clock: LineClock = { now: () => Date.now(), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t) }) {}

  begin(): PollGuard {
    const { clock } = this;
    const ctrl = new AbortController();
    const row = { startedAt: clock.now(), heard: false, cut: () => ctrl.abort() };
    this.open.add(row);
    this.waitingSince ??= row.startedAt;
    let timer: Timer;
    const arm = (): void => {
      clock.clearTimeout(timer);
      timer = clock.setTimeout(() => { ctrl.abort(); this.onStall(); }, POLL_STALL_MS);
    };
    arm();
    const life = (): void => {
      if (!this.open.has(row)) return;
      row.heard = true;
      this.heardOnce = true;
      if (this.cameBack) { this.cameBack = false; this.onConfirmed(); }
      this.waitingSince = clock.now();
      arm();
    };
    return {
      signal: ctrl.signal,
      life,
      json: async <T>(res: Response): Promise<T> => {
        life();
        if (!res.body) return await res.json() as T;
        const reader = res.body.getReader();
        const parts: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          size += value.length;
          life();
        }
        const whole = new Uint8Array(size);
        let at = 0;
        for (const p of parts) { whole.set(p, at); at += p.length; }
        return JSON.parse(new TextDecoder().decode(whole)) as T;
      },
      end: () => {
        if (!this.open.delete(row)) return;
        clock.clearTimeout(timer);
        const answered = row.heard && !ctrl.signal.aborted;
        // a read that failed leaves the clock running: asked, and nothing back. A read that came home stops it
        // unless another is still out, which then has its own time from here
        if (!answered) this.waitingSince ??= row.startedAt;
        else this.waitingSince = this.open.size ? clock.now() : null;
      },
    };
  }

  // the dot's half: red until the server has answered once, and when it has gone silent since
  silent(): boolean {
    if (!this.heardOnce) return true;
    return this.waitingSince !== null && this.clock.now() - this.waitingSince >= LINE_RED_MS;
  }

  // back from hidden and nothing has answered since: the old socket still reads open, so the dot may not say connected
  unconfirmed(): boolean { return this.cameBack; }

  // how long one sessions read took, from asking to its last byte
  read(ms: number): void {
    const slow = ms > WEAK_POLL_MS;
    this.slowReads = slow ? this.slowReads + 1 : 0;
    const weak = slow ? this.weak || this.slowReads >= WEAK_AFTER_READS : false;
    if (weak === this.weak) return;
    this.weak = weak;
    this.onWeak();
  }

  // back from hidden: the silence of a frozen page says nothing about the line. A read still out from before is
  // cut so the catch-up does not wait for its limit, and counts as a stall when it got no byte at all
  back(): void {
    const now = this.clock.now();
    let stalled = false;
    for (const row of this.open) {
      if (now - row.startedAt < OLD_READ_MS) continue;
      row.cut();
      if (!row.heard) stalled = true;
    }
    this.waitingSince = null;
    this.cameBack = true;
    if (stalled) this.onStall();
  }
}

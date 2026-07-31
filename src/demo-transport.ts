// src/demo-transport.ts — the demo's whole transport layer, and the only thing that separates
// the public replay demo from the real dashboard.
//
// WHY IT LOOKS LIKE THIS. The real client talks to the server through exactly two holes:
// `api()` (every REST read/write funnels through one fetch, src/client.ts) and `new WebSocket`
// (one per pane, src/client.ts's Pane.connect). Both are globals. Replacing the two globals
// BEFORE client.ts's module body runs therefore intercepts everything it will ever ask for,
// which is why src/demo.ts imports this file first and client.ts second: ES module bodies run
// in import order, so the stubs are installed before the first line of the client executes.
// The alternative — a `?demo` branch inside client.ts — was rejected: it ships demo code in the
// live bundle and puts a second code path through the file the whole dashboard depends on.
// The consequence worth stating plainly: client.ts is not modified by one line for this demo,
// so the demo cannot drift from the real UI, and the real UI cannot break because of the demo.
//
// This file MUST NOT be imported by anything but src/demo.ts and src/demo-chapters.ts — the
// chapters are the demo's presentation layer and this is its transport; nothing else may reach
// either, least of all the real client.
import { Terminal } from "@xterm/xterm";

// Nothing in this file may reach the network except the fixture loads below. `realFetch` is
// captured before the global is replaced; demoFetch never falls through to it, so the page is
// structurally incapable of issuing a request the demo did not author.
const realFetch: typeof fetch = globalThis.fetch.bind(globalThis);

// Fixtures are addressed RELATIVE to the page, never as "/fixtures/…": the demo has to work
// unchanged at a site root, under a subpath (example.com/demo/), and inside an iframe.
const fixture = (name: string): string => new URL(`fixtures/${name}`, document.baseURI).href;

// The dashboard's own breakpoint (src/client.ts:27), repeated because client.ts is not modified and
// its constant is therefore not reachable. It lives here rather than in the chapter layer because
// both halves of the demo now need it — the chapters for their layout, this file for the key that
// starts a replay, which is Enter on a desktop and ➤ on a phone.
export const MOBILE = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");

/** What every refused input says. One sentence, because there is one reason. */
const NOTHING_SENT = "This is a recorded replay — nothing is sent.";

interface DemoSlot {
  id: number; file: string; label: string; cwd: string;
  prompt: string; outcome: string; bytes: number;
}
interface DemoManifest {
  recorded: string; terminal: { cols: number; rows: number }; slots: DemoSlot[];
  // optional, and the demo's only feature switch: the file name of the captured git facts for the
  // ℹ brief. Declared here rather than probed for, so an absent brief costs no request and logs no
  // 404 in a visitor's console.
  briefs?: string;
  // the same switch for the 💬 conversation view, PER SLOT: the transcript route is per slot, so
  // the fixtures are too. A visitor who opens one session downloads that session's transcript and
  // no other — declared, never guessed, for the same reason as `briefs`.
  transcripts?: Record<string, string>;
}

// ---------------------------------------------------------------------------------------------
// Replay timing. pipe-pane records BYTES AND NO TIMESTAMPS, so there is no original timing to
// reproduce and no recorded inter-chunk gap to cap — the replay's pace is synthesised here, and
// the banner says so rather than implying this is how fast the session really ran.
//
// The unit is a FRAME, not a byte slice: Claude Code's TUI wraps every repaint in
// ESC[?25l … ESC[?25h (hide cursor, redraw, show cursor), and the two occur in exactly equal
// numbers in all four fixtures (678 / 5366 / 1421 / 926), so splitting after each cursor-show
// yields whole repaints. Byte-rate pacing was rejected for the reason those counts imply: a
// 16 KB repaint and a 42-byte spinner tick are one visual step each, so equal bytes-per-tick
// makes spinners crawl and real output flash past.
//
// Each stream is then paced to land near TARGET_MS regardless of how many frames it has, with
// per-frame bounds so a short stream cannot become a slideshow and a long one cannot become a
// blur. Measured against the four fixtures this yields ~54 s (s1), ~90 s (s2), ~90 s (s3),
// ~74 s (s4).
const TARGET_MS = 90_000;
const MIN_FRAME_MS = 16;
// 80 UNTIL 31.07., AND THAT CEILING WAS THE REAL SPEED LIMIT rather than the `secs` a chapter asks
// for. Owner, after watching it: the excerpt should run at roughly a third of that pace. It could
// not — step 1's first range is 151 frames, so 80 ms/frame capped it at 12.1 s no matter what `secs`
// said, and the second range at 7.2 s. Raised to the slowest step that still reads as a session
// working rather than a slideshow; the floor is what actually protects against a blur, and it is
// untouched.
// KNOWN CONSEQUENCE, and it is an improvement rather than a cost: the old ceiling guaranteed that
// the 18 frames from 2062 to the hold could not outlast the ℹ panel's 3 s poll, so the panel always
// filled in on a still picture (PLAN §2b). At 240 ms those 18 frames take 4.3 s, so the panel can
// now catch up WHILE the last lines are still printing. That is what a polling dashboard beside a
// working session actually looks like, and the panel still cannot change before frame 2062, which
// is the only bound that carries a truth claim (briefAfter).
const MAX_FRAME_MS = 240;

// --- excerpts ----------------------------------------------------------------------------------
// A chapter may play FRAME RANGES of a recording instead of the whole file, and pace each itself:
// the 90 s above is the budget of a whole stream, and a 15 s chapter that inherits it would either
// crawl or run out of pictures. `secs` is therefore per range, and the same clamp applies, so a
// short range still cannot become a slideshow.
//
// A range is stated in frames, not seconds or bytes, because the frame is the only unit the
// recordings actually have (see above): a chosen frame boundary is a whole repaint, so an excerpt
// can start and end on a complete picture instead of mid-redraw.
//
// WHY MORE THAN ONE RANGE. The pacing clamp bounds a frame at MIN_FRAME_MS, so lane.raw's 2120
// frames run at least 34 s however short a `secs` asks for — and 1839 of those frames are a spinner
// turning while the session thinks. Step 1 needs its two ends and not its middle: the order going
// out, and the commits coming back.
export interface DemoSpan { from: number; to?: number; secs?: number }
export interface DemoCut {
  spans: DemoSpan[];
  /** What stands between span i and span i+1. A silent jump would be the one claim in this demo
   *  nobody could check; a named one is not. */
  gaps?: string[];
  // `hold` used to live here and is gone: holding the first picture is a property of EVERY stream
  // now, not an option a cut may switch on, because the streams that had no cut were the ones that
  // autoplayed. Leaving the field as an accepted-but-ignored option is how a caller ends up setting
  // it and believing it did something.
}
const cuts = new Map<number, DemoCut>();
// Set by the chapter layer BEFORE the pane connects (src/demo-chapters.ts runs before the client's
// boot, and re-arms a pane by clicking its own ↻ when a chapter changes what it should play).
export function setCuts(next: ReadonlyMap<number, DemoCut>): void {
  cuts.clear();
  for (const [slot, cut] of next) cuts.set(slot, cut);
}
// One listener, not an event bus: the chapter bar wants to know when the picture stopped moving,
// so its "Weiter" can ask for attention instead of leaving a passive visitor sitting in chapter 1.
let streamEnd: ((slot: number) => void) | null = null;
export function onStreamEnd(fn: (slot: number) => void): void { streamEnd = fn; }
// The same shape, for the same reason, one step earlier: a chapter's hints may name a frame of the
// excerpt ("this one once the commits are on screen"), and the frame index exists only here. `i` is
// counted WITHIN the excerpt, so a hint's `at` means what a chapter author can see — the nth picture
// of this chapter — and does not move when a cut's `from` does.
let framePlayed: ((slot: number, i: number) => void) | null = null;
export function onFrame(fn: (slot: number, i: number) => void): void { framePlayed = fn; }

// ---------------------------------------------------------------------------------------------
// THE GATE — the one thing on this page a visitor does, and the one place a keystroke means what
// it looks like.
//
// A held chapter emits its first picture and then waits. That picture is not a still we made: in
// lane.raw frame 0 the order stands in the SESSION'S OWN input line, unsubmitted — read out of the
// stream, where the context bar still says `[----------] --%` and no spinner is running — and
// frame 1 is that same order echoed with "Transmuting…" under it. So the visitor's Enter lands
// exactly where the real one did, and nothing between the two is invented.
//
// It is a promise rather than a flag because the player awaits it: there is no second code path
// for "started" and none for "not yet", so a chapter cannot get stuck half-armed.
let openGate: (() => void) | null = null;

// WHAT ENTER DOES TO THE COMPOSE BAR, and why it is not cosmetic. The order stands in the box AND
// in the recording's own prompt line (frame 0 draws both). When the visitor presses Enter, the
// recording submits: frame 1 echoes the order into the transcript and the session's `❯` line goes
// empty. A box that keeps the text while the session is already working on it says the opposite of
// what just happened — it reads as "not sent yet", which is the one thing the gesture must not
// suggest. So the DOM field empties at the same moment the recorded one does, and the demo's own
// placeholder ("Recorded replay — nothing is sent") takes its place, which is the disclosure
// arriving exactly when the visitor acts.
// AND THE BOX BELONGS TO THE SLOT, not to the chapter. Found by the owner, 31.07.: clicking another
// session in the sidebar left the previous session's order standing in the compose bar, so the page
// showed `run the full test suite…` in the terminal with `in the 💬 conversation view **bold**…`
// underneath it as the order that produced it. That is a false statement rather than an untidiness,
// and it is exactly the failure applyUi's own comment describes for chapter switches — it just had
// no answer for a switch the VISITOR makes. So the order is now written from the manifest for
// whichever slot is about to play, at the moment that slot parks and waits.
// This also replaces the earlier remember-and-restore: there is nothing to remember when the answer
// can be looked up, and remembering was wrong the moment two slots were involved.
const composeBar = (): HTMLTextAreaElement | null =>
  document.getElementById("input") as HTMLTextAreaElement | null;
function clearCompose(): void {
  const ta = composeBar();
  if (!ta) return;
  ta.value = "";
  ta.style.height = ""; // applyUi grew it to fit two lines; let it shrink back
}
async function showPromptFor(slot: number): Promise<void> {
  const p = await slotPrompt(slot);
  const ta = composeBar();
  if (!ta) return;
  ta.value = p;
  // The compose box does not grow by itself (no auto-grow in client.ts); a two-line order would sit
  // half out of sight. The CSS max-height still caps it.
  ta.style.height = "auto";
  ta.style.height = `${ta.scrollHeight}px`;
}
/** True while a replay is parked on its first picture. The chapter layer needs no such query —
 *  a hint with `until: 1` is on screen exactly while the first frame stands — but the input
 *  handlers below do: an Enter with nothing waiting must not silently look like it worked. */
export function replayWaiting(): boolean { return openGate !== null; }
/** The visitor acted. False when nothing was waiting, so the caller can say so instead. */
export function startReplay(): boolean {
  const go = openGate;
  openGate = null;
  if (!go) return false;
  go();
  return true;
}

// How far each slot's replay has got, in ABSOLUTE frames of its recording — the excerpt-relative
// index the chapter layer counts cannot answer "have the commits been printed yet", because that
// is a fact about the recording. The ℹ brief route below reads this; nothing else does.
const frameAt = new Map<number, number>();
// From which absolute frame a slot's brief answers with its AFTER state. Set by the chapter that
// owns the excerpt, because that is where the recording's landmarks already live.
const briefSwitch = new Map<number, number>();
export function setBriefSwitch(slot: number, frame: number | null): void {
  if (frame === null) briefSwitch.delete(slot);
  else briefSwitch.set(slot, frame);
}

const CURSOR_SHOW = [0x1b, 0x5b, 0x3f, 0x32, 0x35, 0x68]; // ESC [ ? 2 5 h

// Split after every cursor-show. A trailing remainder (the recording ends mid-repaint — 42–120 B
// in the four fixtures) is emitted as a final frame rather than dropped.
function splitFrames(bytes: Uint8Array): ArrayBuffer[] {
  const frames: ArrayBuffer[] = [];
  let start = 0;
  outer: for (let i = 0; i + CURSOR_SHOW.length <= bytes.length; i++) {
    for (let k = 0; k < CURSOR_SHOW.length; k++) if (bytes[i + k] !== CURSOR_SHOW[k]) continue outer;
    const end = i + CURSOR_SHOW.length;
    frames.push(bytes.slice(start, end).buffer as ArrayBuffer);
    start = end;
    i = end - 1;
  }
  if (start < bytes.length) frames.push(bytes.slice(start).buffer as ArrayBuffer);
  return frames;
}

const enc = new TextEncoder();
const seq = (s: string): ArrayBuffer => enc.encode(s).buffer as ArrayBuffer;
// Mirrors the real server's first WS frame, which is always a scrollback seed: slots.json records
// that each stream starts mid-screen (the boot banner had already been drawn when recording
// began), so the terminal is cleared before the first recorded byte lands.
const CLEAR = seq("\x1b[H\x1b[2J\x1b[3J");
// SCROLLING BACK USED TO BE IMPOSSIBLE, and it was this file's doing rather than the recording's.
// The client gives every pane 50 000 lines of scrollback (src/client.ts:235) and the excerpt threw
// all of it away: CLEAR carries \x1b[3J, which erases the scrollback buffer itself, and it ran
// before every range — and the card between ranges wiped it a second time. Measured before the fix:
// the viewport reported scrollHeight 392 against clientHeight 392, i.e. nothing above the fold at
// all. A visitor who wanted to read back what he had just watched could not.
// So a range boundary now SCROLLS the old screen away instead of deleting it: park the cursor on
// the last row, push `rows` newlines (every one of them moves a line into the scrollback), then
// blank the visible screen. \x1b[3J is gone from everything except the very first clear, where
// there is genuinely nothing worth keeping — the stream starts mid-screen.
// The pleasant part is that the cards go into the scrollback too, in their place between the
// ranges. Scrolled back, the demo reads: first range, "── knapp vier Minuten später ──", second
// range, "── eine halbe Minute später ──", third range. The cut stays MARKED where it happened
// instead of being a claim made once and then gone, which is what PLAN §2's "sichtbar markiert,
// nicht still" was actually asking for.
const scrollAway = (): ArrayBuffer =>
  seq(`\x1b[999;1H${"\r\n".repeat(REC.rows)}\x1b[H\x1b[2J`);
const FINISHED = seq(
  "\r\n\x1b[2m── replay finished — this session's recording ends here. ↻ (top right of the pane) replays it. ──\x1b[0m\r\n",
);
// The card between two ranges. It is drawn on a CLEARED screen rather than appended to the last
// picture: the cursor sits wherever the TUI left it, and writing there would land the words inside
// the session's own compose box. Cleared, they are unmistakably ours.
//
// It says something true rather than merely owning up to the cut, and the number is the SESSION's
// own clock rather than our arithmetic on a byte count: its spinner reads 12s on the last picture
// before the cut and 4m 44s on the first one after it, so the jump is 4:32. (An earlier draft took
// the `Cogitated for 5m 8s` the recording prints at frame 2119; that is the whole run, not this
// gap.) Both ends re-measured on the rendered screen, not reconstructed from the stream — the
// spinner writes its digits into fixed columns, so the bytes of one frame do not carry the number.
//
// GOLD, and the exact gold of the labels (#d29922, demo/build.ts). The card is OUR sentence sitting
// inside the app's terminal, and it is the one place where that is unavoidable — so it wears the
// same colour as everything else we wrote, and no colour the recording itself ever uses. Truecolor
// rather than a 256-colour approximation, so the two really are the same. It does not blink: ANSI
// blink is unevenly supported and crude, and a card that stands alone on a cleared screen for 1.8 s
// is already the most conspicuous thing in the run.
const GAP_MS = 1800;
const gapCard = (text: string): ArrayBuffer => {
  const line = `── ${text} ──`;
  const pad = " ".repeat(Math.max(0, Math.floor((REC.cols - [...line].length) / 2)));
  // No clear of its own any more: the caller has just scrolled the previous range away and left a
  // blank screen, and a \x1b[3J here would delete the very scrollback that scroll just built.
  return seq(`${"\r\n".repeat(Math.max(0, (REC.rows >> 1) - 1))}${pad}\x1b[1m\x1b[38;2;210;153;34m${line}\x1b[0m`);
};

let manifestOnce: Promise<DemoManifest> | null = null;
function loadManifest(): Promise<DemoManifest> {
  return (manifestOnce ??= realFetch(fixture("slots.json")).then((r) => {
    if (!r.ok) throw new Error(`demo: fixtures/slots.json → ${r.status}`);
    return r.json() as Promise<DemoManifest>;
  }));
}

// The prompt a session was really given. The chapter layer puts it in the (disabled) compose bar
// instead of writing a caption about it — same source as the brief's prompt outline below, so the
// two can never disagree.
export async function slotPrompt(id: number): Promise<string> {
  return (await loadManifest()).slots.find((s) => s.id === id)?.prompt ?? "";
}

// One parse per stream, shared by every pane that shows it (the 2×2 layout plus a slot the
// visitor revisits would otherwise re-download and re-split the same 730 KB).
const framesOnce = new Map<string, Promise<ArrayBuffer[]>>();
function loadFrames(file: string): Promise<ArrayBuffer[]> {
  const hit = framesOnce.get(file);
  if (hit) return hit;
  const p = realFetch(fixture(file)).then(async (r) => {
    if (!r.ok) throw new Error(`demo: fixtures/${file} → ${r.status}`);
    return splitFrames(new Uint8Array(await r.arrayBuffer()));
  });
  framesOnce.set(file, p);
  return p;
}

// When each slot last painted — the sidebar's activity dot is `serverNow - lastOutput < 5000`,
// so a replaying slot reads as working and a finished one goes quiet, from the same signal the
// real dashboard uses. This is the only state /api/sessions reports that is not in slots.json.
const lastOutput = new Map<number, number>();

// ---------------------------------------------------------------------------------------------
// The socket. Feeds frames; accepts nothing.
class DemoSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = 0;
  binaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  readonly url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: { data: ArrayBuffer }) => void) | null = null;
  onclose: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private slot = 0;
  private cut: DemoCut | undefined;
  // Whatever the player is currently waiting on — a frame's delay or the visitor. close() calls it
  // so a discarded pane's player returns instead of parking forever on a promise nobody will keep.
  private wake: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    void this.run();
  }

  // Every input path in the client — typing into xterm, the mobile key row, the compose box —
  // ends at ws.send(). Refusing here is therefore ONE refusal that covers all of them, and the
  // place where the visitor learns why, rather than three disabled controls that each need
  // their own explanation.
  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    demoHint(NOTHING_SENT);
  }

  // Deliberately never fires onclose, on this path or in close(). The client's onclose handler
  // is a reconnect scheduler (src/client.ts, Pane.connect): a replay that reached its end is
  // not a dropped connection, and reporting it as one would restart every stream forever.
  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
    if (openGate === this.wake) openGate = null; // a pane discarded mid-wait takes its gate with it
    this.wake?.();
    this.readyState = DemoSocket.CLOSED;
  }

  addEventListener(): void { /* the client assigns onopen/onmessage/onclose directly */ }
  removeEventListener(): void { /* — */ }
  dispatchEvent(): boolean { return false; }

  private emit(data: ArrayBuffer): void {
    lastOutput.set(this.slot, Date.now());
    this.onmessage?.({ data });
  }

  private async run(): Promise<void> {
    // /ws/<slot>?cols=…&rows=… — the query is the client telling the server its size, which a
    // fixed-geometry recording cannot honour, so only the slot id is read. (Reflow at another
    // width is xterm's job and works; slots.json records the 76×28 the sessions really ran at.)
    this.slot = Number(/\/ws\/(\d+)/.exec(this.url)?.[1] ?? 0);
    // Where this replay stands, before it has painted anything. Without it a pane rebuilt for a
    // second look would inherit the last progress of the pane before it, and the ℹ panel would open
    // on the state the visitor has not reached yet.
    frameAt.set(this.slot, cuts.get(this.slot)?.spans[0]?.from ?? 0);
    try {
      const m = await loadManifest();
      const s = m.slots.find((x) => x.id === this.slot);
      if (!s) throw new Error(`demo: no fixture for slot ${this.slot}`);
      const all = await loadFrames(s.file);
      // The excerpt is cut here rather than in the chapter layer so the WHOLE file is still parsed
      // once and cached (framesOnce): two chapters showing two ranges of the same recording cost
      // one download, and switching back and forth costs none.
      this.cut = cuts.get(this.slot);
      // Both awaits above guarantee at least one microtask, so the client's synchronous
      // `ws.onopen = …` / `onmessage = …` assignments after `new WebSocket(…)` have landed by
      // the time anything is delivered. This ordering is load-bearing, not incidental.
      if (this.stopped) return;
      this.readyState = DemoSocket.OPEN;
      this.onopen?.(new Event("open"));
      await this.play(all);
    } catch (e) {
      // A missing or unreadable fixture must say so in the pane it belongs to instead of
      // leaving an empty terminal that looks like a hung connection.
      if (this.stopped) return;
      this.readyState = DemoSocket.OPEN;
      this.onopen?.(new Event("open"));
      this.emit(seq(`\x1b[31mdemo: could not load this session's recording — ${
        e instanceof Error ? e.message : String(e)}\x1b[0m\r\n`));
    }
  }

  /** Wait — for a frame's delay, or (`ms === null`) for the visitor. Awaited rather than chained
   *  through setTimeout for the same reason the chaining existed: the next frame is scheduled only
   *  after the current one has been handed over, so a slow paint delays the replay instead of
   *  building an unbounded write queue inside xterm. The gate needs the same shape, and one shape
   *  is fewer ways to be subtly wrong than two. */
  private park(ms: number | null): Promise<void> {
    return new Promise<void>((resolve) => {
      this.wake = () => { this.wake = null; resolve(); };
      // The hold gate is the only place the page waits for the visitor, so it is also the only
      // moment at which an order belongs in the box — and it is THIS stream's order, which is what
      // makes a visitor's slot switch correct as well as a ↻ that rebuilds the socket without
      // re-running the chapter.
      if (ms === null) { openGate = this.wake; void showPromptFor(this.slot); }
      else this.timer = setTimeout(() => this.wake?.(), ms);
    });
  }

  private async play(all: ArrayBuffer[]): Promise<void> {
    const spans = this.cut?.spans ?? [{ from: 0 }];
    let shown = 0; // pictures shown in THIS excerpt, across all its spans — a hint's `at` counts these
    for (let s = 0; s < spans.length; s++) {
      // The card owning up to the jump, before the range it precedes rather than after the one it
      // follows: it clears the screen, so putting it first leaves the previous range's last picture
      // standing for its full frame time instead of being wiped a moment early.
      const gap = s > 0 ? this.cut?.gaps?.[s - 1] : undefined;
      if (gap) {
        this.emit(scrollAway()); // the range just played moves up into the scrollback, not into nothing
        this.emit(gapCard(gap));
        await this.park(GAP_MS);
        if (this.stopped) return;
      }
      const span = spans[s]!;
      const from = Math.min(Math.max(0, span.from), all.length);
      const to = Math.min(Math.max(from, span.to ?? all.length), all.length);
      const frames = all.slice(from, to);
      // Starting on a blank screen is the same argument as at the start of a stream, and it binds
      // harder for an excerpt: frame `from` is a repaint that assumes whatever the frames before it
      // drew, so beginning on top of a screen that belongs to another moment would render garbage.
      // BLANK, THOUGH — not erased. Only the first range wipes the scrollback with it; every later
      // one scrolls what is on screen (the card, or the previous range if a gap was not declared)
      // up out of the way, so the visitor can still read back everything he was shown.
      this.emit(s === 0 ? CLEAR : scrollAway());
      const target = Math.max(1000, (span.secs ?? TARGET_MS / 1000) * 1000);
      const frameMs = Math.min(MAX_FRAME_MS,
        Math.max(MIN_FRAME_MS, Math.round(target / Math.max(1, frames.length))));
      for (let i = 0; i < frames.length; i++) {
        frameAt.set(this.slot, from + i);
        framePlayed?.(this.slot, shown++);
        this.emit(frames[i]!);
        // The hold is the FIRST picture of the FIRST range and nowhere else: it is the moment
        // before the order goes out, and there is only one of those.
        // EVERY STREAM HOLDS, not just the one the chapter cut. It used to depend on cut.hold, so
        // the four sidebar sessions had no gate at all and began playing the instant the visitor
        // clicked them — measured: slot 3 grew from 10 rows to 16 within three seconds of the click,
        // with nothing pressed. To a visitor that reads as "clicking a session sent its prompt",
        // which is the one thing this page must never appear to do, and it broke PLAN §2's "Kein
        // Autoplay" outright. Now the rule is the same everywhere: a session shows its first
        // picture, its order stands in the box, and it waits.
        await this.park(s === 0 && i === 0 ? null : frameMs);
        if (this.stopped) return;
      }
    }
    // A whole stream that reached its end says so. An EXCERPT does not: the session did not stop
    // there, and writing "replay finished" into it would claim something untrue. It holds on its
    // last picture instead — which is also what makes the last picture the chapter's exhibit.
    if (!this.cut) this.emit(FINISHED);
    streamEnd?.(this.slot);
  }
}

// ---------------------------------------------------------------------------------------------
// The REST side. Four routes exist; everything else is answered 404 locally, which is what the
// client already treats as "feature not available" (every caller checks res.ok, and only a 401
// raises the token gate — a status the demo never returns, so the gate can never appear).
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function sessions(): Promise<Response> {
  const m = await loadManifest();
  return json({
    now: Date.now(),
    chips: [],
    v: 1, // never changes → the client's stale-bundle self-reload can't fire on a static host
    autos: [], tasks: [], intake: false, postLandAudit: null, shareBase: "",
    dispatch: { available: false, on: false, maxLanes: 0, repo: "" },
    // git/worktree null keeps every lane affordance (± diff, land, shelve, the merge board) out
    // of a demo that has no repository behind it — V1 shows the terminal, the sidebar and mobile.
    slots: m.slots.map((s) => ({
      id: s.id, cwd: s.cwd, label: s.label,
      lastOutput: lastOutput.get(s.id) ?? 0,
      share: null, git: null, worktree: null, mergePending: false,
    })),
  });
}

// --- the ℹ session brief -----------------------------------------------------------------------
// The brief states a project's git facts, and the four recorded sessions' scratch repositories no
// longer exist, so those facts cannot be derived here and MUST NOT be invented — a demo that shows
// a visitor a fabricated diffstat is exactly the claim the honesty rule exists to prevent.
//
// So the demo consumes them instead: an OPTIONAL fixtures/briefs.json, whose per-slot shape is
// client.ts's own BriefInfo (see demo/README.md for the contract Session A fills). Absent, the ℹ
// control stays hidden and nothing about the demo changes; present, the panel lights up with real
// captured facts and no further code change. The feature appears exactly when its data does.
interface DemoBrief {
  branch: string | null; sessionStart?: number | null;
  // `string | null` and not `string` as the live route types it (server.ts:775, which sends "" when
  // there is nothing): the BEFORE state below is written out in PLAN §6 with an explicit null, and
  // it is copied rather than adjusted. Nothing reads it there — with `files: []` the section that
  // would print it does not render (src/client.ts:1375) — and both values are falsy to the one
  // check that ever looks.
  uncommitted: number; uncommittedFiles: string[]; files: string[]; shortstat: string | null;
  commits: { hash: string; ts: number; subject: string }[];
  ahead?: number; behind?: number;
  // A recorded LANE carries these three, and they are what makes the panel call itself a lane
  // (src/client.ts:1233, :1363, :1377). Absent on the plain repo sessions, which is why every one
  // of them has a default below rather than being required here.
  worktree?: { repo: string; branch: string; base: string; baseSha: string } | null;
  laneScoped?: boolean; laneBase?: string | null;
  // Only the BEFORE state carries this, and it travels with the data on purpose: that state is the
  // one value in the whole demo that was defined rather than fetched, and the sentence saying so
  // belongs next to it rather than in a document somebody would have to go and find.
  why?: string;
}
interface DemoBriefs { briefs: Record<string, DemoBrief> | null; before: Record<string, DemoBrief> }
let briefsOnce: Promise<DemoBriefs> | null = null;
function loadBriefs(): Promise<DemoBriefs> {
  return (briefsOnce ??= loadManifest().then(async (m) => {
    if (!m.briefs) return { briefs: null, before: {} };
    const r = await realFetch(fixture(m.briefs));
    if (!r.ok) return { briefs: null, before: {} };
    const j = (await r.json()) as { briefs?: Record<string, DemoBrief>; before?: Record<string, DemoBrief> };
    return { briefs: j.briefs ?? null, before: j.before ?? {} };
  }).catch(() => ({ briefs: null, before: {} })));
}
// Reveal the ℹ control once, if and only if the fixture is there. The demo's stylesheet hides it
// through `html:not(.has-briefs)` (demo/build.ts), so this class is what turns the feature on — and
// hands the control back to the dashboard's own rules, including the mobile one that keeps ℹ off a
// phone where renderBoard() would not render anything anyway.
void loadBriefs().then((b) => {
  if (b.briefs) document.documentElement.classList.add("has-briefs");
});

// --- the 💬 conversation view ------------------------------------------------------------------
// The recorded sessions' scratch repositories are gone, but their Claude Code transcripts are not,
// and they are what this view reads. Each fixture is the payload the real route would return —
// {entries, total, source}, already through server.ts's viewEntry filters and truncations — so the
// demo needs no parser and cannot render something the dashboard would render differently.
//
// One file PER SLOT, cached per file like framesOnce: the transcripts weigh 17-123 KB apiece, and
// switching one pane to 💬 must cost that pane's transcript, not all four.
interface DemoTEntry { n: number; role: string; ts: string | null; blocks: unknown[]; meta?: boolean }
interface DemoTranscript { entries: DemoTEntry[]; total: number; source: string | null }
const transcriptOnce = new Map<string, Promise<DemoTranscript | null>>();
function loadTranscript(file: string): Promise<DemoTranscript | null> {
  const hit = transcriptOnce.get(file);
  if (hit) return hit;
  const p = realFetch(fixture(file))
    .then(async (r) => (r.ok ? ((await r.json()) as DemoTranscript) : null))
    .catch(() => null);
  transcriptOnce.set(file, p);
  return p;
}
// Reveal the 💬 control if and only if the manifest declares transcripts — the mirror of the ℹ
// reveal below. On the DECLARATION, not on a successful load: fetching all four here to prove they
// exist would spend the very requests the per-slot split is for. Unlike ℹ, 💬 is deliberately left
// on for phones: it reflows at any width, which the fixed 76-column stream cannot.
void loadManifest().then((m) => {
  if (m.transcripts && Object.keys(m.transcripts).length)
    document.documentElement.classList.add("has-transcripts");
}).catch(() => { /* a broken manifest already reports itself in the pane */ });

async function demoFetch(input: RequestInfo | URL, _init?: RequestInit): Promise<Response> {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href, location.href);
  const path = url.pathname;
  if (path.endsWith("/api/sessions")) return sessions();
  if (path.endsWith("/api/dispositions")) return json({ dispositions: [] });
  if (path.endsWith("/resize")) return json({ ok: true });
  const slot = /\/api\/slots\/(\d+)\/(\w[\w-]*)$/.exec(path);
  if (slot) {
    const id = slot[1], route = slot[2];
    if (route === "brief") {
      const all = await loadBriefs();
      const after = all.briefs?.[id];
      if (!after) return json({ error: "no brief fixture for this slot" }, 404);
      // THE PANEL CHANGES BECAUSE THIS ROUTE DOES, and nothing else in the demo switches it. The
      // dashboard re-fetches its brief every 3 s of its own accord (src/client.ts:2647, boardMs
      // 3_000 at :36, both client-side and therefore live here), so a route that answers according
      // to how far the replay has got is the whole mechanism — the panel fills in with the same
      // poll a real one uses, a beat behind the terminal, exactly as a real one would.
      //
      // The threshold is the frame at which the session prints BOTH commits back (2062, read out of
      // the stream). Earlier would be false: between 1992 and 2061 there was exactly one commit, and
      // no diffstat for that state was ever fetched. Later is merely out of date, which is what a
      // polling panel is anyway.
      const switchAt = briefSwitch.get(Number(id));
      const before = all.before[id];
      const b = before !== undefined && switchAt !== undefined
        && (frameAt.get(Number(id)) ?? 0) < switchAt ? before : after;
      // The lane fields are PASSED THROUGH, not blanked. They used to be forced to null here
      // because no recording had ever been a lane; slot 2 is one, and forcing them made the panel
      // call it "· repo session" and head its commits "commits this session" — a false statement
      // about a fetched answer, and the one difference step 4's two states are built on. Every
      // field still has a default, because the plain repo sessions carry none of them.
      return json({ ...b,
        worktree: b.worktree ?? null,
        laneScoped: b.laneScoped ?? false,
        laneBase: b.laneBase ?? null,
        sessionStart: b.sessionStart ?? null, ahead: b.ahead ?? 0, behind: b.behind ?? 0 });
    }
    // The conversation view and the brief's prompt outline both read this feed. With a transcript
    // declared it serves the recorded session; without one it falls back to the single entry the
    // demo can state truly either way — the prompt the session was actually given, from slots.json.
    //
    // `after` is honoured on BOTH paths and is not optional: the client polls this route once a
    // second with after=<the total it last saw> and APPENDS whatever comes back (src/client.ts's
    // pollChat), so a route that ignores the cursor re-delivers the whole conversation every second.
    // `n` is an absolute JSONL line number and `total` the raw line count, exactly as server.ts's
    // transcriptPayload reports them, so the same `n > after` comparison is the correct filter here.
    if (route === "transcript") {
      const m = await loadManifest();
      const s = m.slots.find((x) => x.id === Number(id));
      if (!s) return json({ entries: [], total: 0, source: null });
      const after = Math.max(0, Number(url.searchParams.get("after") ?? 0) | 0);
      const file = m.transcripts?.[id];
      const t = file ? await loadTranscript(file) : null;
      if (t) return json({ total: t.total, source: t.source, entries: t.entries.filter((e) => e.n > after) });
      return json({ total: 1, source: "recorded",
        entries: after >= 1 ? []
          : [{ n: 1, role: "user", ts: null, blocks: [{ t: "text", text: s.prompt }] }] });
    }
  }
  return json({ error: "not available in the demo" }, 404);
}

// ---------------------------------------------------------------------------------------------
// The hint. One line, rate-limited: xterm's onData fires per keystroke, and a visitor holding a
// key down must not produce a stack of notices.
let hintAt = 0;
let hintTimer: ReturnType<typeof setTimeout> | undefined;
function demoHint(text: string): void {
  const now = Date.now();
  if (now - hintAt < 2500) return;
  hintAt = now;
  let el = document.getElementById("demohint");
  if (!el) {
    el = document.createElement("div");
    el.id = "demohint";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el?.classList.remove("on"), 2200);
}

// ---------------------------------------------------------------------------------------------
// Renderer. The demo forces xterm's DOM renderer, and this is the one place it overrules the
// dashboard's own choice.
//
// WHY. client.ts loads the WebGL renderer (falling back to the canvas one) because a live session
// streams output and the DOM renderer stutters on mobile Safari under that load. Both GPU renderers
// mis-scale here: on a devicePixelRatio-1 page they size their canvas backing store to 2x the CSS
// box and then draw glyphs at 1x metrics, so only about half the rows and columns land inside the
// canvas and the rest of the pane stays blank. Measured, not inferred: a bare 76x28 Terminal with
// 28 numbered rows and NO demo code renders all 28 rows under the DOM renderer, and half-scale
// under both canvas and WebGL — and the owner confirmed the blank panes in a real browser, so this
// is not a headless artifact. The DOM renderer's cost does not apply to a replay: nothing here is
// interactive, and the frame pacing above is bounded well below a live build log's output rate.
//
// loadAddon is filtered rather than replaced so the FitAddon still reaches the terminal — the pane
// must keep sizing itself to its box, which is what makes the layout buttons and the phone layout
// behave like the real dashboard. Identified by the `fit` PROPERTY, never by constructor.name:
// minification mangles class names, which silently defeated an earlier attempt at this check.
{
  const loadAddon = Terminal.prototype.loadAddon;
  Terminal.prototype.loadAddon = function demoLoadAddon(this: Terminal, addon: never): void {
    if (typeof (addon as unknown as { fit?: unknown }).fit !== "function") return;
    loadAddon.call(this, addon);
  };
}

// ---------------------------------------------------------------------------------------------
// Geometry. A recording is a FIXED-SIZE artifact: it must be rendered at the size it was recorded
// at, and then SCALED to the pane — never rewrapped to it. Both halves of that sentence are load-
// bearing, and each was established by getting it wrong first.
//
// Why not rewrap (what the live client does). The fixtures are 76 columns (slots.json); a pane in
// the 2x2 grid is about 71. Every full-width line then wraps and occupies one screen row more than
// the TUI believes it printed, so Claude Code's repaint — which moves the cursor UP by the number
// of rows it thinks it wrote — lands progressively off. Observed with the DOM renderer, i.e. with no
// renderer artifact in play: merged lines ("CalResolved, downloaded and…"), and whole rows drawn
// twice (two status bars in one pane). This is arithmetic, not a paint bug, and it cannot be fixed
// downstream of the wrap.
//
// Why scale rather than letting it be clipped. A fixed 76x28 block dropped into whatever pane it
// lands in reads as static — the terminal stops being a terminal that fills its pane, and the
// layout buttons stop appearing to do anything. Scaling restores that: one pane shows the session
// large, the 2x2 grid shows four smaller ones, a phone shows the whole 76-column session shrunk to
// fit. transform does not participate in layout, so .xterm keeps reporting its natural pixel size
// and the factor stays derivable from it.
//
// BOTH AXES ARE PINNED to the recorded geometry, and that is a correction of the rule that stood
// here before ("columns are pinned, rows follow the pane"). Letting rows follow the pane assumes a
// stream that keeps producing output, which is true of a live session and false of a replay: the
// recording paints a 28-row screen and nothing it can do will fill a 34-row one. Measured on the
// solo chapter at 1360x860 — the layout that rule never saw — it asked for 34 rows and the recording
// filled 18, so 47% of the pane was structurally empty, for good, and the picture read as a text
// block glued to the top of a black box. Pinning rows removes exactly that void; what is left inside
// the terminal is the recording's own emptiness, which is what the session really looked like.
//
// The claim that a 28-row terminal loses chapter 1's opening prompt (the reason rows were left free
// in d642ae3) does not reproduce: replayed INTO 28 rows, the prompt still stands in row 0, with one
// status bar and one ctx bar — i.e. no repaint desynchronisation either. 28 is not a guess, it is
// the geometry the stream was recorded at (slots.json's terminal.rows), so it is the one height at
// which the TUI's own cursor arithmetic is exactly right.
const REC = { cols: 76, rows: 28 };
// There is NO upper cap on the factor, and the 1.5 that used to be here was the actual cause of the
// solo chapter looking broken. .pane draws a real frame (1px border, 8px radius, its own background;
// public/index.html's .pane rule). Capped, the block sat 824 px wide inside a 1118 px frame — 147 px
// of pane background down each side, a border promising a surface its content did not fill. In the
// 2x2 grid the terminal is exactly as wide as its pane, the frame hugs it, and that is precisely why
// the grid always looked right and the single pane did not.
//
// Filling the pane instead hands the solo chapter a factor of 1.83 (the height binds first), i.e. the
// dashboard's 12 px type drawn at 22 px with 56 px of slack down each side. For a tutorial read by
// people without the vocabulary, large and legible is the point, not a defect: the earlier worry
// that this "reads as a zoomed screenshot" was a judgement about a dashboard, and this page is not
// one. Sizing the PANE to the terminal instead was tried and reverted: .pane's children are all
// absolutely positioned, so a pane that stops stretching has no intrinsic height and collapses to
// nothing — measured, the terminal vanished entirely.
const termOf = new WeakMap<HTMLElement, Terminal>();
{
  const open = Terminal.prototype.open;
  Terminal.prototype.open = function demoOpen(this: Terminal, el: HTMLElement): void {
    termOf.set(el, this); // client.ts passes its .paneterm div, so this keys the pane directly
    open.call(this, el);
  };
  const resize = Terminal.prototype.resize;
  Terminal.prototype.resize = function pinnedResize(this: Terminal, _cols: number, _rows: number): void {
    resize.call(this, REC.cols, REC.rows);
  };
}

// The recorded geometry is DECLARED in slots.json, and the constants above are only what the first
// terminal is built with — the client constructs one before any fetch resolves. When the manifest
// lands, it wins: a re-recording at another size would otherwise be rendered at this file's idea of
// the size, silently and wrongly, which is the failure mode a declared manifest exists to prevent.
void loadManifest().then((m) => {
  const cols = (m.terminal?.cols ?? 0) | 0, rows = (m.terminal?.rows ?? 0) | 0;
  if (!cols || !rows || (cols === REC.cols && rows === REC.rows)) return;
  REC.cols = cols;
  REC.rows = rows;
  for (const pt of document.querySelectorAll<HTMLElement>(".paneterm")) {
    termOf.get(pt)?.resize(cols, rows); // pinnedResize ignores the arguments; they document intent
    fitScale(pt);
  }
});

// The retry is the part that was broken before: a pane created by setLayout() has no measured size
// in the frame it is inserted in, so the first attempt reads 0 and must come back rather than give
// up. Giving up left the terminal unscaled, which is exactly what "every layout looks the same
// size" looks like.
// The measurement has to come from .xterm-screen, NOT .xterm: xterm stretches .xterm to its
// container (so its offsetWidth is the PANE's width, and min(paneW/paneW, …) collapses to 1 — the
// bug that made every layout render at the same size), while .xterm-screen is sized to the actual
// content, cols x cellWidth by rows x cellHeight. offsetWidth is a layout measure and ignores the
// transform this function sets, so reading it back is not circular.
//
// .xterm is then given that content size explicitly before being scaled, so the scaled element
// cannot spill its opaque background over the neighbouring pane at factors above 1.
function fitScale(paneterm: HTMLElement | null, tries = 0): void {
  if (!paneterm || !paneterm.isConnected) return;
  const term = paneterm.querySelector<HTMLElement>(".xterm");
  const screen = paneterm.querySelector<HTMLElement>(".xterm-screen");
  const box = paneterm.getBoundingClientRect();
  const natW = screen?.offsetWidth ?? 0, natH = screen?.offsetHeight ?? 0;
  if (!term || !natW || !natH || !box.width || !box.height) {
    // A pane inserted by setLayout() has no measured size in the frame it is inserted in, and the
    // monospace font may not have measured yet either. Come back rather than give up: giving up is
    // what left the terminal unscaled.
    if (tries < 30) requestAnimationFrame(() => fitScale(paneterm, tries + 1));
    return;
  }
  // One factor, from whichever axis runs out first: the whole recorded screen is always inside the
  // pane, and it fills the pane on the axis that bound. Because both axes are pinned, this is the
  // entire geometry — there is no row count to negotiate with the pane, so there is also no
  // resize()-feeds-the-observer loop to damp, which is what the removed oscillation guard was for.
  const s = Math.min(box.width / natW, box.height / natH);
  term.style.width = `${natW}px`;
  term.style.height = `${natH}px`;
  term.style.transformOrigin = "top left";
  term.style.transform = `scale(${s.toFixed(4)})`;
  // Centred on both axes in whatever the other axis left over. transform does not participate in
  // layout, so the offsets have to be margins on the un-transformed box, computed from the SCALED
  // size.
  term.style.marginLeft = `${Math.max(0, Math.round((box.width - natW * s) / 2))}px`;
  term.style.marginTop = `${Math.max(0, Math.round((box.height - natH * s) / 2))}px`;
}

{
  // Panes are destroyed and rebuilt by setLayout() on every layout switch, so the scaler watches for
  // them instead of being wired once at boot. Both elements are observed: .paneterm changes when the
  // layout or window does, and .xterm changes when the monospace font finally measures — either one
  // invalidates the factor.
  // closest(), not parentElement: a disposed pane's observed child is detached by the time the
  // observer runs, and parentElement is then null — which threw a TypeError out of the observer on
  // every layout switch.
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const t = e.target as HTMLElement;
      fitScale(t.classList.contains("paneterm") ? t : t.closest(".paneterm"));
    }
  });
  const attach = (): void => {
    for (const pt of document.querySelectorAll<HTMLElement>(".paneterm")) {
      ro.observe(pt);
      const screen = pt.querySelector(".xterm-screen");
      if (screen) ro.observe(screen); // fires when the monospace font finally measures
      fitScale(pt);
    }
  };
  const panesEl = document.getElementById("panes");
  if (panesEl) {
    new MutationObserver(attach).observe(panesEl, { childList: true, subtree: true });
    attach();
  }
}

// ---------------------------------------------------------------------------------------------
// Install. Module body: runs before client.ts by construction (see the file header).
globalThis.fetch = demoFetch as typeof fetch;
// A deliberate substitution of a DOM global, so a cast is the only way to state it. DemoSocket
// implements the surface the client actually uses (readyState, static OPEN, binaryType, the three
// handlers, send, close) — not the full WebSocket interface, which nothing here calls.
globalThis.WebSocket = DemoSocket as unknown as typeof WebSocket;

// The 2×2 seed that used to sit here is gone: chapters SET their layout rather than seeding it
// (src/demo-chapters.ts). Seeding wrote fleet.view only when the key was absent, so anyone who had
// already opened the four-panes-at-once version kept it forever — and would have met the guided
// tour with the one picture the tour is built to arrive at last.

{
  // THE COMPOSE BAR. Nothing typed here can go anywhere — but Enter is the one thing the visitor
  // does on this page, so the box cannot simply be dead either.
  //
  // readOnly, NOT disabled. A `disabled` textarea fires no keyboard events at all, so the demo's
  // own handler would never see the key that is supposed to start it. readOnly keeps typing just as
  // impossible (the element rejects every edit) and lets the event through.
  //
  // The placeholder is pinned because focusPane() rewrites it on every focus change ("Prompt for
  // slot 1… (Enter sends)"); shadowing the accessor makes the client's writes no-ops instead of
  // racing them with an observer. Its wording changed with this: "Input is disabled" stopped being
  // true the moment Enter did something, and the sentence a visitor reads has to survive that.
  const ta = document.getElementById("input") as HTMLTextAreaElement | null;
  const PLACEHOLDER = "Recorded replay — nothing is sent";
  if (ta) {
    ta.readOnly = true;
    ta.setAttribute("placeholder", PLACEHOLDER); // the attribute is what renders
    Object.defineProperty(ta, "placeholder", {
      configurable: true, get: () => PLACEHOLDER, set: () => {},
    });
  }

  // THE OPENING, AND WHY ITS DISMISSAL LIVES HERE. #dbintro (demo/build.ts) covers the page until
  // the visitor has read what he is about to watch. It answers to the same two controls as the
  // replay — Enter and a click — so the two behaviours have to be decided in one place, or the
  // keystroke that closes the opening would fall straight through and start the recording, and the
  // visitor would never see the first picture he was just told to look at.
  // The state is a class on <html> rather than a variable so the CSS reads it too, and so the guard
  // below cannot disagree with what is on screen.
  const introUp = (): boolean => !document.documentElement.classList.contains("dbintro-done");
  const closeIntro = (e?: Event): void => {
    e?.preventDefault();
    e?.stopImmediatePropagation();
    document.documentElement.classList.add("dbintro-done");
    // focus goes to the compose bar, so the next Enter is aimed at the thing the label points at
    (document.getElementById("input") as HTMLTextAreaElement | null)?.focus();
  };
  window.addEventListener("keydown", (e) => {
    if (!introUp()) return;
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") closeIntro(e);
  }, true);
  window.addEventListener("click", (e) => {
    if (introUp() && e.target instanceof Element && e.target.closest("#dbintro")) closeIntro(e);
  }, true);

  // WHY THE WINDOW AND WHY CAPTURE. client.ts's own handlers sit ON the two elements —
  // `ta.addEventListener("keydown", …)` (:3855) and `send.onclick = …` (:3854) — and a window
  // capture listener runs before anything at the target, whoever registered first. That is not a
  // nicety: doSend() posts to /send, this demo answers 404, and flashSendError() paints the button
  // RED (client.ts:3821-3827). An Enter we did not intercept would look like a failure.
  const trigger = (e: Event): void => {
    e.preventDefault();
    e.stopImmediatePropagation();
    // Belt and braces: the opening's own listeners are registered above this one and stop the event
    // before it arrives, and its overlay covers ➤ anyway. Stated here as well because "the recording
    // cannot start behind the opening" is an invariant of the page, not a side effect of two
    // listener registration orders.
    if (introUp()) return;
    // Only on a real start. A press that starts nothing (the excerpt is already running) must leave
    // the box alone — emptying it there would tell the visitor something was sent when nothing was.
    if (startReplay()) clearCompose();
    else demoHint(NOTHING_SENT);
  };
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return;
    // ON A PHONE ENTER IS NOT SENDING, and it must not be here either. client.ts:3856 guards its
    // Enter branch with !isMobile(), so there Enter is a newline and ➤ is what sends — a demo that
    // started on Enter would be teaching the wrong key. Nothing is swallowed: the textarea is
    // readOnly, so the newline this key would insert is refused by the element itself.
    if (MOBILE.matches) return;
    // Not only when the box has focus. The instruction says "press Enter", and a visitor who has
    // not clicked into a text field first is not wrong.
    if (replayWaiting() || e.target === ta) trigger(e);
  }, true);
  // ➤ IS THE SECOND TRIGGER, and on a phone the only one.
  window.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("#send")) trigger(e);
  }, true);

  document.getElementById("keys")?.addEventListener("click", () => demoHint(NOTHING_SENT));
}

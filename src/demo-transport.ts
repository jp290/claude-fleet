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
const MAX_FRAME_MS = 80;

// --- excerpts ----------------------------------------------------------------------------------
// A chapter may play a FRAME RANGE of a recording instead of the whole file, and pace it itself:
// the 90 s above is the budget of a whole stream, and a 15 s chapter that inherits it would either
// crawl or run out of pictures. `secs` is therefore per excerpt, and the same clamp applies, so a
// short range still cannot become a slideshow.
//
// The range is stated in frames, not seconds or bytes, because the frame is the only unit the
// recordings actually have (see above): a chosen frame boundary is a whole repaint, so an excerpt
// can start and end on a complete picture instead of mid-redraw.
export interface DemoCut { from: number; to?: number; secs?: number }
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
const FINISHED = seq(
  "\r\n\x1b[2m── replay finished — this session's recording ends here. ↻ (top right of the pane) replays it. ──\x1b[0m\r\n",
);

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
  private frameMs = MAX_FRAME_MS;
  private cut: DemoCut | undefined;

  constructor(url: string | URL) {
    this.url = String(url);
    void this.run();
  }

  // Every input path in the client — typing into xterm, the mobile key row, the compose box —
  // ends at ws.send(). Refusing here is therefore ONE refusal that covers all of them, and the
  // place where the visitor learns why, rather than three disabled controls that each need
  // their own explanation.
  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    demoHint("This is a recorded replay — input is disabled.");
  }

  // Deliberately never fires onclose, on this path or in close(). The client's onclose handler
  // is a reconnect scheduler (src/client.ts, Pane.connect): a replay that reached its end is
  // not a dropped connection, and reporting it as one would restart every stream forever.
  close(): void {
    this.stopped = true;
    clearTimeout(this.timer);
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
    try {
      const m = await loadManifest();
      const s = m.slots.find((x) => x.id === this.slot);
      if (!s) throw new Error(`demo: no fixture for slot ${this.slot}`);
      const all = await loadFrames(s.file);
      // The excerpt is cut here rather than in the chapter layer so the WHOLE file is still parsed
      // once and cached (framesOnce): two chapters showing two ranges of the same recording cost
      // one download, and switching back and forth costs none.
      this.cut = cuts.get(this.slot);
      const from = Math.min(Math.max(0, this.cut?.from ?? 0), all.length);
      const to = Math.min(Math.max(from, this.cut?.to ?? all.length), all.length);
      const frames = all.slice(from, to);
      // Both awaits above guarantee at least one microtask, so the client's synchronous
      // `ws.onopen = …` / `onmessage = …` assignments after `new WebSocket(…)` have landed by
      // the time anything is delivered. This ordering is load-bearing, not incidental.
      if (this.stopped) return;
      this.readyState = DemoSocket.OPEN;
      this.onopen?.(new Event("open"));
      // Clearing first is the same argument as at the start of a stream, and it binds harder for an
      // excerpt: frame `from` is a repaint that assumes whatever the frames before it drew, so
      // without a clear the range would start on top of a screen that belongs to another moment.
      this.emit(CLEAR);
      const target = Math.max(1000, (this.cut?.secs ?? TARGET_MS / 1000) * 1000);
      this.frameMs = Math.min(MAX_FRAME_MS,
        Math.max(MIN_FRAME_MS, Math.round(target / Math.max(1, frames.length))));
      this.play(frames, 0);
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

  // Chained timeouts rather than one interval: the next frame is scheduled only after the
  // current one has been handed over, so a slow paint delays the replay instead of building an
  // unbounded write queue inside xterm.
  private play(frames: ArrayBuffer[], i: number): void {
    if (this.stopped) return;
    if (i >= frames.length) {
      // A whole stream that reached its end says so. An EXCERPT does not: the session did not stop
      // there, and writing "replay finished" into it would claim something untrue. It holds on its
      // last picture instead — which is also what makes the last picture the chapter's exhibit.
      if (!this.cut) this.emit(FINISHED);
      streamEnd?.(this.slot);
      return;
    }
    this.emit(frames[i]);
    this.timer = setTimeout(() => this.play(frames, i + 1), this.frameMs);
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
  uncommitted: number; uncommittedFiles: string[]; files: string[]; shortstat: string;
  commits: { hash: string; ts: number; subject: string }[];
  ahead?: number; behind?: number;
}
let briefsOnce: Promise<Record<string, DemoBrief> | null> | null = null;
function loadBriefs(): Promise<Record<string, DemoBrief> | null> {
  return (briefsOnce ??= loadManifest().then(async (m) => {
    if (!m.briefs) return null;
    const r = await realFetch(fixture(m.briefs));
    if (!r.ok) return null;
    return ((await r.json()) as { briefs?: Record<string, DemoBrief> }).briefs ?? null;
  }).catch(() => null));
}
// Reveal the ℹ control once, if and only if the fixture is there. The demo's stylesheet hides it
// through `html:not(.has-briefs)` (demo/build.ts), so this class is what turns the feature on — and
// hands the control back to the dashboard's own rules, including the mobile one that keeps ℹ off a
// phone where renderBoard() would not render anything anyway.
void loadBriefs().then((b) => {
  if (b) document.documentElement.classList.add("has-briefs");
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
      const b = (await loadBriefs())?.[id];
      if (!b) return json({ error: "no brief fixture for this slot" }, 404);
      // the fields the brief renderer needs beyond the captured ones: these sessions are plain repo
      // sessions in the demo, never lanes, so there is no worktree and no lane base to report
      return json({ ...b, worktree: null, laneScoped: false, laneBase: null,
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
// COLUMNS are pinned; ROWS are not. Only the column count can break the recording: a wrapped line
// occupies an extra screen row and desynchronises the repaint. The row count is free — the stream
// simply scrolls inside whatever height it is given — so letting rows follow the pane is what makes
// a tall pane fill with scrollback instead of showing a letterboxed 28-row block, which is how the
// first version of this looked wrong in the 2-up layout.
const REC_COLS = 76;
const MIN_ROWS = 8;
// The scale is CAPPED, and only upwards. Scaling DOWN is what keeps 76 columns inside a pane too
// narrow for them, and that is not negotiable. Scaling UP is a presentation choice, and past a point
// a bad one: one pane at 1360 px hands the terminal a factor of 2.06, i.e. the dashboard's own 12 px
// type drawn at 25 px, which is what made a solo chapter read as a zoomed screenshot instead of a
// terminal. Above the cap the block is centred in what is left rather than stretched into it.
// Pinning the ROWS to the recorded 28 was tried here and rolled back: at exactly 28 rows the opening
// prompt has scrolled off the top by frame 151, and the order standing in the terminal is the one
// thing chapter 1 is about. Rows keep following the pane; only the magnification is capped.
const MAX_SCALE = 1.5;
const termOf = new WeakMap<HTMLElement, Terminal>();
{
  const open = Terminal.prototype.open;
  Terminal.prototype.open = function demoOpen(this: Terminal, el: HTMLElement): void {
    termOf.set(el, this); // client.ts passes its .paneterm div, so this keys the pane directly
    open.call(this, el);
  };
  const resize = Terminal.prototype.resize;
  Terminal.prototype.resize = function pinnedResize(this: Terminal, _cols: number, rows: number): void {
    resize.call(this, REC_COLS, Math.max(MIN_ROWS, rows | 0));
  };
}

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
  // Width sets the scale — 76 columns fill the pane exactly, which is the whole point of pinning
  // them — but never past MAX_SCALE. Height is then absorbed by asking for as many ROWS as fit at
  // that scale, so a tall pane fills with scrollback rather than with letterbox.
  const s = Math.min(box.width / natW, MAX_SCALE);
  const t = termOf.get(paneterm);
  if (t) {
    const cellH = natH / Math.max(1, t.rows);
    const want = Math.max(MIN_ROWS, Math.floor(box.height / (cellH * s)));
    // Only act on a real difference: resize() feeds this observer, and reacting to sub-row noise
    // would oscillate. The next observer pass re-derives everything from the new content size.
    if (want !== t.rows) { t.resize(REC_COLS, want); return; }
  }
  term.style.width = `${natW}px`;
  term.style.height = `${natH}px`;
  term.style.transformOrigin = "top left";
  term.style.transform = `scale(${s.toFixed(4)})`;
  // Centred horizontally in whatever the cap left over. transform does not participate in layout, so
  // the offset has to be a margin on the un-transformed box, computed from the SCALED width.
  term.style.marginLeft = `${Math.max(0, Math.round((box.width - natW * s) / 2))}px`;
  term.style.marginTop = "0px";
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
  // Input off, at the surface as well as at the socket. The placeholder is pinned because
  // focusPane() rewrites it on every focus change ("Prompt for slot 1… (Enter sends)") and that
  // sentence is not true here; shadowing the accessor makes the client's writes no-ops instead of
  // racing them with an observer.
  const ta = document.getElementById("input") as HTMLTextAreaElement | null;
  const send = document.getElementById("send");
  const PLACEHOLDER = "Input is disabled — recorded replay";
  if (ta) {
    ta.disabled = true;
    ta.setAttribute("placeholder", PLACEHOLDER); // the attribute is what renders
    Object.defineProperty(ta, "placeholder", {
      configurable: true, get: () => PLACEHOLDER, set: () => {},
    });
  }
  // addEventListener, not onclick: client.ts assigns send.onclick, and this has to coexist with
  // it rather than be overwritten when client.ts runs a moment later.
  send?.addEventListener("click", () => demoHint("This is a recorded replay — input is disabled."));
  document.getElementById("keys")?.addEventListener("click", () =>
    demoHint("This is a recorded replay — input is disabled."));
}

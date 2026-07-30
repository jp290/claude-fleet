// src/demo-chapters.ts — the guided tour: chapters as data, the chapter state, and the bar that
// carries the narration. This is the demo's whole presentation layer; demo-transport.ts is its
// transport, and src/client.ts is still not modified by one line.
//
// WHY A CHAPTER IS DATA AND NOT CODE. The tour's five chapters differ in exactly six things: which
// slot, which layout, which view, which otherwise-hidden control they explain, which frame range of
// the recording runs, and what the German narration says. Everything else — how a layout is set,
// how a stream is re-armed, how visibility is granted — is the same handful of moves. So the moves
// live here once and a chapter is a row in a list: the chapters that follow are entries, not code.
//
// WHY IT DRIVES THE UI BY CLICKING IT. The client's setLayout()/focusPane()/showSlot() are module-
// private and stay that way, because the one property this demo cannot lose is that client.ts is
// untouched. A chapter therefore does what a visitor does: it presses the layout button, clicks the
// slot in the sidebar, presses 💬. The state it produces is the real UI's own state, and the
// visitor can take over at any point without anything having to be handed back.
import { onStreamEnd, setCuts, slotPrompt, type DemoCut } from "./demo-transport";

// The dashboard's own breakpoint (src/client.ts:27), repeated because client.ts is not modified and
// its constant is therefore not reachable. It matters more here than anywhere else: setLayout() has
// NO mobile guard of its own (src/client.ts:1806) — the single-pane rule for phones lives only in
// the boot restore (:3965), the breakpoint handler (:1865) and a media query on the layout buttons
// (public/index.html:739). A chapter that asked for four panes without checking would get four on a
// 390 px screen, and pull four recordings down a phone connection to do it.
const MOBILE = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");

/** A control the demo hides by default and a chapter may grant, because that chapter explains it. */
type Control = "chat" | "brief";

export interface Chapter {
  /** 1, 2, 3 … — also the URL fragment (#/2). */
  id: number;
  /** Chapter title, German. Shown in the bar. */
  title: string;
  /** The narration, German, AT MOST TWO SENTENCES: the visitor reads it while the excerpt runs, and
   *  three sentences × five chapters overruns the 60–90 s the whole tour is allowed (PLAN §2). */
  text: string;
  /** The session this chapter is about — it gets the focused pane. */
  slot: number;
  /** Desktop layout. On a phone every chapter is single-pane, whatever this says. */
  layout: 1 | 2 | 4;
  /** Pane→slot assignment when the layout holds more than one. Defaults to [slot]. */
  panes?: number[];
  /** Terminal or the 💬 conversation view. Default "term". */
  view?: "term" | "chat";
  /** Open the ℹ session brief. Desktop only — renderBoard() bails out on mobile (client.ts:1204). */
  brief?: boolean;
  /** Controls to reveal beyond the ones `view`/`brief` already imply. */
  shows?: Control[];
  /** A frame range of the recording instead of the whole file. Absent = the whole stream. */
  cut?: DemoCut;
  /** An optional still, shown beside the app (the finale shows the page on a phone). The asset is
   *  loaded only in a chapter that names one, so the chapters before it pay nothing for it. */
  image?: string;
}

// ---------------------------------------------------------------------------------------------
// The tour. Chapters 2–5 are added here and nowhere else (PLAN §2 holds their outline and their
// material); each is one entry, and the machinery below already knows how to play it.
const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: "Ein Projekt, ein Auftrag",
    text: "Links stehen die Projekte; in jedem läuft eine eigene Sitzung. "
      + "Was sie tun soll, steht unten im Eingabefeld — ein normaler Satz, kein Kommando.",
    slot: 1,
    layout: 1,
    // The opening of s1. Where it ENDS was chosen by watching the stream, not by counting: frame 151
    // holds on the session having read the files and started thinking, which is the picture this
    // chapter wants — an order arrived in plain language and something is working on it. Twenty-five
    // frames later the session names the bug AND the second one nobody asked for, and that is
    // chapter 2's whole point; an excerpt that ran on would spend it here.
    cut: { from: 0, to: 151, secs: 12 },
  },
];

// ---------------------------------------------------------------------------------------------
// The chapter state lives in the URL fragment: it survives a reload, it can be linked, and it costs
// no storage. Anything unknown falls back to chapter 1 rather than to an error — and the address bar
// is corrected to match, so a visitor who lands on #/9 does not read a number that is not on screen.
const first = (): Chapter => CHAPTERS[0]!;

function fromHash(): Chapter {
  const m = /^#\/(\d+)$/.exec(location.hash);
  return CHAPTERS.find((c) => c.id === Number(m?.[1])) ?? first();
}

let current = fromHash();
let applied: Chapter | null = null;

const $ = (id: string): HTMLElement | null => document.getElementById(id);
const paneEls = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>("#panes .pane"));
const click = (el: Element | null | undefined): void => { if (el instanceof HTMLElement) el.click(); };
// focusPane() is reachable only through the pane's own mousedown handler (src/client.ts:282), which
// is exactly what a visitor's click does.
const focusPaneEl = (el: HTMLElement | undefined): void => {
  el?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
};

/** What this chapter shows on THIS viewport: a phone gets one pane, always. */
function shapeOf(ch: Chapter): { layout: number; slots: number[] } {
  if (MOBILE.matches) return { layout: 1, slots: [ch.slot] };
  const slots = (ch.panes ?? [ch.slot]).slice(0, ch.layout);
  return { layout: ch.layout, slots };
}

function controlsOf(ch: Chapter): Set<Control> {
  const s = new Set<Control>(ch.shows ?? []);
  if (ch.view === "chat") s.add("chat"); // a chapter cannot use a view whose control it hides
  if (ch.brief) s.add("brief");
  return s;
}

const cutKey = (ch: Chapter): string =>
  ch.cut ? `${ch.slot}:${ch.cut.from}-${ch.cut.to ?? ""}@${ch.cut.secs ?? ""}` : "";

// --- the half of a chapter that must be in place BEFORE the client boots ----------------------
// The client reads fleet.view once, at boot, and connects each pane immediately after. Both the
// excerpt and the layout therefore have to be set before its first line runs — a chapter that
// corrected them afterwards would download a stream it does not show and then throw it away.
function armState(ch: Chapter): void {
  const { layout, slots } = shapeOf(ch);
  const cuts = new Map<number, DemoCut>();
  if (ch.cut) cuts.set(ch.slot, ch.cut);
  setCuts(cuts);
  const controls = controlsOf(ch);
  document.documentElement.classList.toggle("show-chat", controls.has("chat"));
  document.documentElement.classList.toggle("show-brief", controls.has("brief"));
  // WRITTEN, never seeded. The old demo seeded this key only when it was absent, so a visitor who
  // had opened the four-panes version once kept it for good; a chapter that owns its layout has to
  // overwrite instead — which also makes the key self-correcting rather than versioned.
  localStorage.setItem("fleet.view", JSON.stringify({
    layout, panes: slots, focused: Math.max(0, slots.indexOf(ch.slot)),
  }));
}

// --- the half that drives the booted UI -------------------------------------------------------
function applyUi(ch: Chapter): void {
  const { layout, slots } = shapeOf(ch);
  const panesEl = $("panes");
  if (!panesEl) return;

  if (!panesEl.classList.contains(`l${layout}`))
    click(document.querySelector(`#layouts button[data-l="${layout}"]`));

  // A sidebar click assigns to the FOCUSED pane, so filling several panes means focusing each in
  // turn. Clicking a slot that is already in that pane is a no-op in the client, which is what
  // keeps a chapter change from restarting a stream it did not change.
  const panes = paneEls();
  for (let i = 0; i < slots.length && i < panes.length; i++) {
    focusPaneEl(panes[i]);
    click(document.querySelector(`#slots .slot[data-slot="${slots[i]}"]`));
  }
  const idx = slots.indexOf(ch.slot);
  if (idx >= 0) focusPaneEl(paneEls()[idx]);

  // showSlot() refuses to put a session into a second pane, so a set the visitor rearranged by hand
  // can be out of reach of clicks alone (two panes swapped). Rather than leave a chapter showing the
  // wrong session, fall back to the one path that always produces the exact state — the boot restore
  // — and only ever once per chapter, so a state that cannot be reached cannot loop either.
  const REPAIR = "fleet.demo.repair";
  const visible = new Set(Array.from(
    document.querySelectorAll<HTMLElement>("#slots .slot.current, #slots .slot.shown"),
    (r) => Number(r.dataset.slot),
  ));
  if (visible.size !== slots.length || !slots.every((s) => visible.has(s))) {
    if (sessionStorage.getItem(REPAIR) !== String(ch.id)) {
      sessionStorage.setItem(REPAIR, String(ch.id));
      location.reload();
      return;
    }
  } else if (sessionStorage.getItem(REPAIR)) sessionStorage.removeItem(REPAIR);

  const foc = document.querySelector<HTMLElement>("#panes .pane.focused");
  // Same session, different excerpt: nothing above reconnected, so the pane is still playing the
  // previous chapter's range. ↻ is the pane's own reload — the visitor's button, used the same way.
  if (applied && cutKey(applied) !== cutKey(ch)
    && applied.slot === ch.slot && shapeOf(applied).slots.length === slots.length)
    click(foc?.querySelector(".panereload"));

  if (foc) {
    const wantChat = ch.view === "chat";
    if (foc.classList.contains("chat") !== wantChat) click(foc.querySelector(".viewtoggle"));
    // The brief is a desktop surface: renderBoard() returns early on a phone, so asking for it
    // there would open an empty panel over the session it is supposed to describe.
    if (!MOBILE.matches && document.body.classList.contains("board") !== !!ch.brief)
      click(foc.querySelector(".boardtoggle"));
  }

  // The real prompt in the real (disabled) compose bar, instead of a caption saying what it was.
  void slotPrompt(ch.slot).then((p) => {
    const ta = $("input") as HTMLTextAreaElement | null;
    if (!ta || current.id !== ch.id) return;
    ta.value = p;
    // The compose box does not grow by itself (no auto-grow in client.ts); a two-line prompt would
    // sit half out of sight. CSS max-height still caps it.
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  });

  applied = ch;
}

// --- the bar ----------------------------------------------------------------------------------
// It replaces the demo banner rather than stacking under it (PLAN §1): one bar, one language, and
// on a 844 px phone not two competing blocks of text above the app. The honesty chip inside it is
// permanent and identical in every chapter — no chapter can push it out.
function renderBar(ch: Chapter): void {
  const i = CHAPTERS.indexOf(ch);
  const num = $("dbnum"), title = $("dbtitle"), cut = $("dbcut"), text = $("dbtext");
  if (num) num.textContent = `${ch.id} / ${CHAPTERS.length}`;
  if (title) title.textContent = ch.title;
  // "Ausschnitt" is stated where the visitor reads, not in a source comment: a cut recording that
  // does not say it is cut is the one claim in this demo nobody could check.
  if (cut) cut.hidden = !ch.cut;
  if (text) text.textContent = ch.text;
  const prev = $("dbprev") as HTMLButtonElement | null;
  const next = $("dbnext") as HTMLButtonElement | null;
  if (prev) prev.disabled = i <= 0;
  if (next) { next.disabled = i >= CHAPTERS.length - 1; next.classList.remove("pulse"); }
  showImage(ch);
}

function showImage(ch: Chapter): void {
  const existing = document.getElementById("dbshot");
  if (!ch.image) { existing?.remove(); return; }
  const img = (existing as HTMLImageElement | null) ?? document.createElement("img");
  if (!existing) {
    img.id = "dbshot";
    document.body.appendChild(img);
  }
  img.alt = ch.title;
  if (img.getAttribute("src") !== ch.image) img.setAttribute("src", ch.image);
}

function step(delta: number): void {
  const i = CHAPTERS.indexOf(current) + delta;
  const target = CHAPTERS[i];
  if (target) location.hash = `#/${target.id}`; // a history entry, so back/forward do what they look like
}

function go(ch: Chapter): void {
  current = ch;
  armState(ch);
  renderBar(ch);
  applyUi(ch);
  canonicalHash();
}

// The address bar must say what is on screen. It is corrected rather than obeyed, because the
// fragment is the one piece of state a visitor can type: #/9 shows chapter 1, and would otherwise
// leave a number in the URL that appears nowhere on the page — and a link that lies about itself.
function canonicalHash(): void {
  const want = `#/${current.id}`;
  if (location.hash !== want) history.replaceState(null, "", want + location.search);
}

// ---------------------------------------------------------------------------------------------
// Wiring. The state is armed in the module body — before client.ts's first line, by import order in
// src/demo.ts — and the UI half waits for the boot to have built panes and the sidebar.
armState(current);
renderBar(current); // the bar's markup is already in the page (demo/build.ts), so it never shows empty
canonicalHash();

function whenReady(fn: () => void): void {
  const ready = (): boolean =>
    !!document.querySelector("#panes .pane") && !!document.querySelector("#slots .slot");
  if (ready()) { fn(); return; }
  const obs = new MutationObserver(() => { if (ready()) { obs.disconnect(); fn(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}

whenReady(() => {
  renderBar(current);
  applyUi(current);

  const bar = $("demobar");
  if (bar) {
    // The bar owns its height and the app is shortened by exactly it — the banner's geometry, kept.
    // Measured rather than declared because German narration wraps to a different number of lines at
    // every width and in every chapter, and a fixed height would either clip a sentence or leave a
    // strip of empty bar above the app.
    const sync = (): void => document.documentElement.style
      .setProperty("--demo-bar-h", `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    new ResizeObserver(sync).observe(bar);
    sync();
  }

  $("dbprev")?.addEventListener("click", () => step(-1));
  $("dbnext")?.addEventListener("click", () => step(1));

  window.addEventListener("hashchange", () => {
    const ch = fromHash();
    if (ch.id !== current.id) go(ch);
    else canonicalHash(); // a fragment typed by hand that resolves to what is already shown
  });

  // Arrow keys, captured at the window: xterm listens on its own helper textarea, and a visitor who
  // clicked into the terminal would otherwise send → into the recording (which answers with the
  // input-disabled hint) instead of turning the page.
  window.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    step(d);
  }, true);

  // Crossing the breakpoint rebuilds every pane (src/client.ts:1865, the client's own handler), so
  // re-apply after it — a chapter's layout and view do not survive somebody else rebuilding the panes.
  MOBILE.addEventListener("change", () => { setTimeout(() => { applied = null; applyUi(current); }, 0); });

  // When the picture stops moving, the way on gets a quiet pulse. Autoplay stays rejected (PLAN §1b):
  // this asks, it does not act.
  onStreamEnd((slot) => {
    const next = $("dbnext") as HTMLButtonElement | null;
    if (slot === current.slot && next && !next.disabled) next.classList.add("pulse");
  });
});

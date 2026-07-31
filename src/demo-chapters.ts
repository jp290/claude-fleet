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
import {
  MOBILE, onFrame, onStreamEnd, setBriefSwitch, setCuts, slotPrompt, type DemoCut,
} from "./demo-transport";

// MOBILE is the dashboard's own breakpoint (src/client.ts:27), and it is imported rather than
// repeated here because the transport needs the same answer for a different question (Enter starts
// a replay on a desktop; on a phone ➤ does). It matters more here than anywhere else: setLayout()
// has NO mobile guard of its own (src/client.ts:1806) — the single-pane rule for phones lives only
// in the boot restore (:3965), the breakpoint handler (:1865) and a media query on the layout
// buttons (public/index.html:739). A chapter that asked for four panes without checking would get
// four on a 390 px screen, and pull four recordings down a phone connection to do it.

/** A control the demo hides by default and a chapter may grant, because that chapter explains it. */
type Control = "chat" | "brief";

/**
 * A label the demo writes BESIDE a piece of the app, so the narration's words have a place to
 * attach to: the bar can say "the projects are on the left" all it likes, and a visitor who does
 * not know this UI still has to guess which part "left" means.
 *
 * IT ANCHORS TO UI CHROME AND NEVER TO A TERMINAL LINE, and that is a repo finding rather than a
 * preference. Line-anchored markers were built here once and taken out again because they DRIFT
 * (src/client.ts:299): a recording scrolls, so a box over line 14 points at something else two
 * frames later. #slots cannot scroll out from under its label.
 */
export interface Hint {
  /** A CSS selector for a piece of UI CHROME — "#slots", "#board", "#board .bsec:first-child".
   *  Never a terminal row, and never the recording itself: nothing is drawn into the recording,
   *  so a visitor can always tell what the session did from what we wrote beside it. */
  anchor: string;
  /** Half a sentence, German. It says the POINT or the ACTION; it does not repeat the narration.
   *  A function when the sentence depends on the device — the key that starts the replay is Enter
   *  on a desktop and ➤ on a phone (src/client.ts:3856), so one fixed string would be wrong on one
   *  of them. Re-read on every reposition, so crossing the breakpoint corrects it. */
  text: string | (() => string);
  /** From which frame OF THIS CHAPTER'S EXCERPT it shows. Default: from the first. */
  at?: number;
  /** Up to which frame. Default: the end of the chapter. */
  until?: number;
  /** Which side of the anchor it sits on. Default "right". */
  place?: "above" | "below" | "left" | "right";
}

export interface Chapter {
  /** 1, 2 — also the URL fragment (#/2). */
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
  /** Stand this session's real prompt in the (disabled) compose bar. Chapter 1's whole exhibit,
   *  and opt-in rather than automatic: the manifest holds a session's FIRST prompt, and a chapter
   *  replaying a later question would otherwise put the wrong sentence under it. */
  prompt?: boolean;
  /** Controls to reveal beyond the ones `view`/`brief` already imply. */
  shows?: Control[];
  /** Frame ranges of the recording instead of the whole file. Absent = the whole stream. */
  cut?: DemoCut;
  /** The ABSOLUTE frame of this slot's recording from which its ℹ panel answers with its after
   *  state. The number belongs here, beside the ranges that contain it: both are landmarks of the
   *  same recording, and a reader who checks one should not have to go to another file for the
   *  other. Absent = the panel has one state, which is true of every slot but the lane. */
  briefAfter?: number;
  /** Labels beside the app. At most two are ever shown at once — three signs pointing at three
   *  places is not guidance, it is a diagram. */
  hints?: Hint[];
  /** An optional still, shown beside the app (the finale shows the page on a phone). The asset is
   *  loaded only in a chapter that names one, so the chapters before it pay nothing for it. */
  image?: string;
}

// ---------------------------------------------------------------------------------------------
// THE TOUR IS ONE STEP AND ONE ACTION (PLAN §1, owner 31.07.: "press enter to send the prompt and
// then show the i-tab until the commit comes through" · "Es muss nur einmal klick machen"). The
// four-step version showed a panel the commits were ALREADY on — a record handed to the visitor.
// Here it arrives while he watches, which is the same data as an event rather than as a claim.
//
// IT IS ONE STEP AND NOT TWO BECAUSE THE TEXT GATE TOOK THE SECOND ONE, and that outcome is written
// into PLAN §2 in advance: a cold reader without git is shown both steps and asked what changed
// between them; if one rewrite does not fix a "no answer", step 2 falls rather than being polished
// further. Two readers, one rewrite between them, and neither could say it.
//
//   before the rewrite  "Links in der Liste ist die Auswahl von Punkt 2 auf Punkt 5 gesprungen, und
//                        rechts in der Spalte stehen jetzt dieselben zwei Zeilen wie vorher, nur
//                        unter anderer Überschrift — was der Unterschied zwischen den beiden
//                        Punkten sein soll, sehe ich nicht."
//   after the rewrite   "…aber was das in der Sache bedeutet, kann ich nicht sagen, weil in beiden
//                        Bildern rechts dieselben zwei Zeilen mit denselben Kürzeln (c350f3e,
//                        06342a3) und dieselbe Zeile '4 files changed, 178 insertions' stehen, es
//                        also für mein Auge gleich aussieht."
//
// That is the exact risk PLAN §2 named — "für jemanden ohne Git-Wissen lesen sich beide als
// claude-fleet, und Schritt 2 wäre dann eine Wiederholung" — and the app's own labelling (·fleet
// lane against ·repo session, "commits on this lane (vs main)" against "commits this session") did
// not carry it either: he read those as two names, not as two places. The second reader did state
// the demo's point correctly on his own ("erst abgeschottet an einem Duplikat, und was dort fertig
// wurde, kommt danach unverändert und lückenlos protokolliert im echten Projekt an"), which is why
// the sentence PLAN §1 wants a visitor to leave with survives in one step: the tool keeps its own
// record. What does not survive is showing the landing, and nothing in the text now claims it.
//
// NOTHING WAS THROWN AWAY. project.raw, transcript-project.json and briefs["5"] all ship; slot 5 is
// the last row of the sidebar and a visitor who clicks it gets that real recording. Restoring the
// step is one entry in this list, and its measurements are the ones that cost the most to get:
// frames 153–308 of project.raw, opening on the second question and ending on "Two commits landed
// on main since this session started" — never past 342, where Claude Code paints its own grey
// `run the full e2e suite` into the empty prompt, and not past ~306 either, because the answer is
// ~40 rows on a 28-row screen and both hashes have scrolled off by then.
const CHAPTERS: Chapter[] = [
  {
    id: 1,
    title: "Der Auftrag läuft",
    // No copy-versus-project half-sentence any more: it existed to set up step 2, and a promise
    // whose payoff has been cut is worse than no promise. What is left is what this one step really
    // shows — an order in plain language, and a record that writes itself while it is carried out.
    // Rewritten with the opening in place. The old sentence spent its first half on "kein Kommando",
    // a distinction only somebody who expected a command line would notice, and its second half said
    // the same thing twice ("hält fest" / "schreibt mit"). The opening now carries what this is, so
    // the narration only has to say what happens: an order goes out, and two commits come back.
    text: "Die Sitzung nimmt den Auftrag an und arbeitet ihn ab. Am Ende stehen die zwei "
      + "Arbeitsschritte da, die verlangt waren — mit Kürzel, Betreff und Zeilenzahl.",
    slot: 2,
    layout: 1,
    brief: true, // open from the first picture: a panel that appears later is a second event
    prompt: true, // the real order in the real compose bar, which is what the visitor's Enter sends
    // TWO RANGES, BECAUSE THE MIDDLE IS A SPINNER. The recording is 2120 frames and the pacing
    // clamp floors a frame at 16 ms, so playing it whole takes at least 34 s — of which about 30
    // are a spinner turning while the session thinks. What the step needs is its two ends.
    //
    //   0      the order stands in the session's own input line, not yet submitted
    //   1      submitted, and the session starts reading
    //   150    still thinking — its own timer reads 12s
    //   1990   still thinking — its own timer reads 4m 44s
    //   1992   the first commit ·  2059  the second
    //   2062   both printed back — THE EARLIEST HONEST MOMENT FOR THE PANEL TO CHANGE, because
    //          between 1992 and 2061 there was exactly one commit and no diffstat for that state
    //          was ever fetched
    //   2076   "Done — two commits, working tree clean."
    //   2079   the last picture, and WHERE IT ENDS WAS MEASURED RATHER THAN ASSUMED. The obvious
    //          end is the recording's own last frame, 2119 — and rendered into a 28-row terminal
    //          that picture holds a wall of prose with both commit lines scrolled off it. This
    //          demo's exhibit is the two commits, and on a phone, where the ℹ panel does not
    //          render at all (src/client.ts:1204), the terminal is the ONLY place they appear. So
    //          the range ends on the one screen that carries both hashes, both subjects and the
    //          "Done" line at once. 2089 has already lost them; 2079 is the hold.
    //
    // THE PANEL THEREFORE FILLS IN ONTO A STILL PICTURE, and that is the choice rather than an
    // oversight. From 2062 to 2079 is 18 frames, and the pacing clamp caps a frame at 80 ms, so
    // those frames cannot be stretched past 1.4 s — no pace exists that outlasts the panel's own
    // 3 s poll. The alternative was running on to 2119 to keep the terminal moving while the panel
    // changed, at the price of ending on a picture that no longer shows what the step is about.
    // PLAN §2b describes this version as the better reading anyway: the terminal reports "Done",
    // holds, and a moment later the panel catches up — which is what a polling dashboard does.
    cut: {
      spans: [{ from: 0, to: 151, secs: 5 }, { from: 1990, to: 2080, secs: 6 }],
      // Read off the session's own two timers above — 12s and 4m 44s — and not from the recording's
      // total. PLAN §2b proposed "gut fünf Minuten" from the `Cogitated for 5m 8s` the session
      // prints at frame 2119; that is the whole run, while what this card skips is 4m 32s of it.
      gaps: ["gut viereinhalb Minuten später"],
      hold: true,
    },
    briefAfter: 2062,
    // BOTH LABELS SIT IN EMPTY SPACE, and that is a measurement rather than an aesthetic. At
    // 1360x860 with the ℹ panel open there is no free margin anywhere: the panel is 264 px of
    // packed text and the terminal fills 854 of its pane's 862 px, so a label placed beside either
    // one covers the exhibit it points at (measured — the first version sat squarely on the two
    // commit subjects). What IS empty is the strip below the app and the panel below its last
    // section, so the labels are anchored to what they name and placed BELOW it.
    hints: [
      // Exactly while the first picture stands. `until: 1` needs no new machinery for that: the
      // hold parks the replay after frame 0 and the next picture is frame 1, so this label is on
      // screen for precisely as long as the wait lasts.
      // "Der Auftrag steht im Feld" moved into the opening, which says it with room to spare. What
      // is left is the one thing this label has to do — name the key — plus what pressing it starts,
      // so the visitor knows he is beginning a recording and not sending a message.
      { anchor: "#input", place: "below", at: 0, until: 1,
        text: () => (MOBILE.matches
          ? "Tipp auf ➤ — dann läuft die Aufnahme los."
          : "Drück Enter — dann läuft die Aufnahme los.") },
      // 223 is the picture at which frame 2062 lands (151 in the first range, then 72 into the
      // second), i.e. the moment both commits stand in the terminal. The label says the POINT, not
      // where things are: a half-sentence that locates ("die Zahlen dazu stehen hier") only helps
      // somebody who already knows what he is looking at, and the one thing this demo has to land
      // is that the record keeps ITSELF. On a phone #board does not render at all and the label
      // takes itself off screen with it — which is why the sentence never says "daneben".
      // Said positively since the gate. Both labels used to end on what nobody had to do — "Niemand
      // notiert hier etwas", "Abgeschrieben hat sie niemand" — and the cold reader read exactly
      // those two as the only sentences trying to impress him: "für mich als Außenstehende ist das
      // kein Vorteil, den ich einordnen kann, weil ich gar nicht wusste, dass hier jemand etwas
      // notieren oder abschreiben müsste." It is also the shape the owner struck from a letter on
      // 30.07. — work is described by what it does, never against a straw man.
      // Past tense since the gate: it appears at the moment the panel has ALREADY changed, and a
      // present-tense sentence there reads as a promise about something the visitor is still waiting
      // for. "Niemand hat das eingetragen" is deliberately not here — see the note above on the cold
      // reader, who read exactly that shape as the one sentence trying to impress him.
      { anchor: "#board", place: "below", at: 223,
        text: "Fleet hat mitgeschrieben: beide Arbeitsschritte, jede geänderte Datei." },
      // The third label pointed at "Weiter" and went with step 2. There is nowhere to send the
      // visitor on now, and a sign to a door that is not there is worse than no sign.
    ],
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
  ch.cut ? `${ch.slot}:${ch.cut.spans.map((s) => `${s.from}-${s.to ?? ""}@${s.secs ?? ""}`).join("+")}` : "";

// ---------------------------------------------------------------------------------------------
// THE HINTS. Labels beside the app, positioned from the app's own boxes.
//
// Three properties carry the whole thing, and each answers a way this could have been dishonest:
//
//   MEASURED, never declared. getBoundingClientRect on every reposition, so a label cannot promise
//   a place the layout moved out from under it. An anchor that is not on screen — the sidebar is in
//   a drawer on a phone, the ℹ panel does not render there at all (src/client.ts:1204) — takes its
//   label with it rather than pointing at nothing.
//
//   NEVER OVER THE RECORDING. Not a rule a chapter author has to remember: a computed box that
//   would land on the terminal is pushed off it, and hidden if it cannot be. It matters because
//   the app leaves almost no free space — with the ℹ panel open the terminal block is 854 px wide
//   inside an 862 px pane, so "left of the panel" IS on the recording, and eyeballing placements
//   per chapter would get this wrong the first time a viewport changed.
//
//   NEVER IN THE WAY. pointer-events: none, so a label can never swallow a click meant for the app
//   underneath it, and at most two at a time.
const HINT_MAX = 2;
const HINT_GAP = 10;
let hintsEl: HTMLElement | null = null;
let frame = 0; // frames played of the CURRENT chapter's excerpt — the unit a Hint's `at` is in
let hintTimer: ReturnType<typeof setInterval> | undefined;

function hintLayer(): HTMLElement {
  if (hintsEl?.isConnected) return hintsEl;
  hintsEl = document.createElement("div");
  hintsEl.id = "dbhints";
  hintsEl.setAttribute("lang", "de");
  document.body.appendChild(hintsEl);
  return hintsEl;
}

/** Visible at all? A collapsed box catches display:none; the viewport test catches the off-canvas
 *  drawer, which has a perfectly good box that nobody can see. */
const onScreen = (r: DOMRect): boolean =>
  r.width >= 2 && r.height >= 2
  && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;

const overlaps = (a: DOMRect, l: number, t: number, w: number, h: number): boolean =>
  l < a.right && l + w > a.left && t < a.bottom && t + h > a.top;

/** The recording's own box — .xterm, the element demo-transport scales, not the pane around it. */
function recordingBox(): DOMRect | null {
  const t = document.querySelector<HTMLElement>("#panes .pane.focused .xterm")
    ?? document.querySelector<HTMLElement>("#panes .xterm");
  const r = t?.getBoundingClientRect();
  return r && onScreen(r) ? r : null;
}

/** THE TWO SURFACES A LABEL MUST NEVER COVER, and the list is exactly two because it is a list of
 *  EXHIBITS rather than of elements: the recording is what the session did, the compose box is the
 *  order it was given, and those are the two things on the page a visitor has to be able to read
 *  for himself. Everything else is chrome a label may sit in front of.
 *
 *  The compose box joined it when the order moved into step 1: at 390x844 the label naming ➤ was
 *  placed below its anchor, clamped up by the bar at the bottom of a phone, and landed squarely on
 *  the order it was pointing at — PLAN §8h, and the same failure the recording rule already had a
 *  name for. Not "never over its own anchor", which sounds more general and is worse: #app is an
 *  anchor too, and on a phone the app IS the screen, so that rule would hide every label there. */
function exhibits(): DOMRect[] {
  const out: DOMRect[] = [];
  const rec = recordingBox();
  if (rec) out.push(rec);
  const box = document.querySelector<HTMLElement>("#input")?.getBoundingClientRect();
  if (box && onScreen(box)) out.push(box);
  return out;
}

function placeHint(el: HTMLElement, h: Hint): void {
  const a = document.querySelector(h.anchor);
  const r = a instanceof HTMLElement ? a.getBoundingClientRect() : null;
  if (!r || !onScreen(r)) { el.classList.add("hid"); return; }
  const b = el.getBoundingClientRect();
  const w = b.width || 200, hgt = b.height || 28;
  const place = h.place ?? "right";
  let left = place === "left" ? r.left - w - HINT_GAP
    : place === "right" ? r.right + HINT_GAP
      : r.left + r.width / 2 - w / 2;
  let top = place === "above" ? r.top - hgt - HINT_GAP
    : place === "below" ? r.bottom + HINT_GAP
      : r.top + r.height / 2 - hgt / 2;

  // Never over the bar, never off an edge. The bar is at the top on a desktop and at the bottom on
  // a phone, which is exactly the difference between these two lines.
  const barH = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--demo-bar-h")) || 0;
  const lo = MOBILE.matches ? 8 : barH + 8;
  const hi = Math.max(lo, (MOBILE.matches ? innerHeight - barH : innerHeight) - 8 - hgt);
  left = Math.min(Math.max(8, left), innerWidth - w - 8);
  top = Math.min(Math.max(lo, top), hi);

  // Off both exhibits, whatever the chapter asked for — beside the recording if there is room
  // beside it, above or below it if there is not. The horizontal pair alone was enough while every
  // label belonged to a desktop chapter; it is not on a phone, where the recording is 378 of 390 px
  // wide and nothing fits either side of it. What a phone HAS is vertical slack, because the
  // recording is shrunk to 0.75 inside a pane taller than it. Those two candidates and the compose
  // box in `exhibits()` are together what PLAN §8h was asking for.
  const ex = exhibits();
  const rec = ex[0] ?? null;
  const clear = (l: number, t: number): boolean =>
    l >= 8 && l <= innerWidth - w - 8 && t >= lo && t <= hi
    && !ex.some((x) => overlaps(x, l, t, w, hgt));
  if (!clear(left, top) && rec) {
    const beside = r.left + r.width / 2 < rec.left + rec.width / 2
      ? [rec.left - w - 6, rec.right + 6] : [rec.right + 6, rec.left - w - 6];
    const along = r.top + r.height / 2 < rec.top + rec.height / 2
      ? [rec.top - hgt - 6, rec.bottom + 6] : [rec.bottom + 6, rec.top - hgt - 6];
    const spot = ([...beside.map((l) => [l, top]), ...along.map((t) => [left, t])] as [number, number][])
      .find(([l, t]) => clear(l, t));
    if (spot) { left = spot[0]; top = spot[1]; }
  }

  // It could not be got clear — say nothing rather than write over what the visitor came to read.
  if (!clear(left, top)) { el.classList.add("hid"); return; }
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
  el.classList.remove("hid");
}

function syncHints(): void {
  const layer = hintLayer();
  const hints = current.hints ?? [];
  const live = hints
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => frame >= (h.at ?? 0) && frame < (h.until ?? Infinity))
    .slice(0, HINT_MAX);
  // Keyed by CHAPTER and index, not index alone: two chapters both have a first hint, and a key
  // that ignored the chapter re-used the previous chapter's box — which kept its old text. Measured
  // in the browser: chapter 5 wore chapter 4's label.
  const key = (i: number): string => `${current.id}:${i}`;
  const want = new Set(live.map(({ i }) => key(i)));
  // Fading OUT is why a leaving label is marked and swept later instead of being removed here —
  // an element taken out of the document cannot animate on its way.
  for (const el of Array.from(layer.children) as HTMLElement[]) {
    if (el.classList.contains("going") || want.has(el.dataset.h ?? "")) continue;
    el.classList.add("going");
    el.classList.remove("on");
    setTimeout(() => el.remove(), 300);
  }
  for (const { h, i } of live) {
    const text = typeof h.text === "function" ? h.text() : h.text;
    let el = layer.querySelector<HTMLElement>(`[data-h="${key(i)}"]:not(.going)`);
    if (!el) {
      el = document.createElement("div");
      el.className = `dbhint p-${h.place ?? "right"}`;
      el.dataset.h = key(i);
      el.textContent = text;
      layer.appendChild(el);
      placeHint(el, h); // measure and place BEFORE the fade, so it never fades in mid-flight
      requestAnimationFrame(() => el?.classList.add("on"));
    } else {
      // Re-read rather than written once: a device-dependent sentence has to correct itself when
      // the window crosses the breakpoint, which is the only reason `text` may be a function.
      if (el.textContent !== text) el.textContent = text;
      placeHint(el, h);
    }
  }
}

/** A chapter change resets the frame count — `at` is counted within THIS chapter's excerpt — and
 *  arms the reposition poll, but only for a chapter that has labels at all. A poll rather than
 *  three observers because the boxes move for reasons no single observed element sees: the ℹ panel
 *  opening, the sidebar re-rendering, a pane being rebuilt by a layout switch. Two rect reads every
 *  250 ms is not a cost worth three observers' worth of ways to be subtly wrong. */
function armHints(): void {
  clearInterval(hintTimer);
  frame = 0;
  syncHints();
  if (current.hints?.length) hintTimer = setInterval(syncHints, 250);
}

// --- the half of a chapter that must be in place BEFORE the client boots ----------------------
// The client reads fleet.view once, at boot, and connects each pane immediately after. Both the
// excerpt and the layout therefore have to be set before its first line runs — a chapter that
// corrected them afterwards would download a stream it does not show and then throw it away.
function armState(ch: Chapter): void {
  const { layout, slots } = shapeOf(ch);
  const cuts = new Map<number, DemoCut>();
  if (ch.cut) cuts.set(ch.slot, ch.cut);
  setCuts(cuts);
  setBriefSwitch(ch.slot, ch.briefAfter ?? null);
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
  // Opt-in, and step 4 is why: slot 5 was asked twice and that chapter replays the SECOND question,
  // while the manifest carries a session's first. Left on, the box read "what is this project"
  // under a terminal answering "what came in" — not false, but the one thing on screen a visitor
  // could take for the command that produced the picture. Off, the box shows the demo's own
  // "Input is disabled" placeholder, which is true in every chapter.
  const ta = $("input") as HTMLTextAreaElement | null;
  if (!ch.prompt) {
    if (ta) { ta.value = ""; ta.style.height = ""; }
  } else void slotPrompt(ch.slot).then((p) => {
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
  // Counted from the list rather than from the id, so the two can never disagree — they happen to
  // be the same today, and a bar that says "2 / 2" while showing something else is the kind of
  // small lie nobody checks.
  if (num) num.textContent = `${i + 1} / ${CHAPTERS.length}`;
  if (title) title.textContent = ch.title;
  // "Ausschnitt" is stated where the visitor reads, not in a source comment: a cut recording that
  // does not say it is cut is the one claim in this demo nobody could check.
  if (cut) cut.hidden = !ch.cut;
  if (text) text.textContent = ch.text;
  const prev = $("dbprev") as HTMLButtonElement | null;
  const next = $("dbnext") as HTMLButtonElement | null;
  if (prev) prev.disabled = i <= 0;
  if (next) { next.disabled = i >= CHAPTERS.length - 1; next.classList.remove("pulse"); }
  // A ONE-CHAPTER TOUR SHOWS NO NAVIGATION AND NO COUNTER. Both buttons would be permanently
  // disabled and "1 / 1" is a number that answers nothing — and this demo's own rule is that a
  // control with nothing behind it is hidden rather than left on screen greyed out (PLAN §1b.4).
  // Written as a condition on the list rather than deleted, so the row returns with a second entry.
  const solo = CHAPTERS.length < 2;
  const nav = document.querySelector<HTMLElement>("#demobar .dbnav");
  // style.display, not the `hidden` attribute: DEMO_CSS gives .dbnav `display: flex`, and an author
  // rule beats the user agent's `[hidden] { display: none }`. Measured — the attribute was set and
  // both buttons stayed on screen, greyed out, which is the exact thing this is here to prevent.
  if (nav) nav.style.display = solo ? "none" : "";
  if (num) num.hidden = solo;
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

// ---------------------------------------------------------------------------------------------
// The three movements, and there are three because PLAN §4 allows three. Everything else on screen
// moves because the RECORDING moves: nothing is re-animated, sped up or re-staged, and
// prefers-reduced-motion switches all three off in CSS while the replay keeps running.

/** A chapter change cross-fades instead of cutting — the difference between "a page changed" and
 *  "somebody is showing me something". The reflow read restarts the animation when a visitor
 *  presses Weiter twice in a row, which a class that is already there would not do. */
function turn(): void {
  for (const el of [$("app"), $("demobar")]) {
    if (!el) continue;
    el.classList.remove("dbturn");
    void el.offsetWidth;
    el.classList.add("dbturn");
  }
}

/** The slot change in step 4 — the one place in the tour where something really CHANGES instead of
 *  being replayed, so it gets the longest movement. Tied to the moment the ℹ panel repaints rather
 *  than to the click: renderBoard fetches before it renders, so animating on the click would have
 *  faded in the panel that is about to be thrown away. */
function armSwap(): void {
  const panesEl = $("panes");
  if (panesEl) {
    panesEl.classList.remove("dbswap");
    void panesEl.offsetWidth;
    panesEl.classList.add("dbswap");
  }
  const body = $("boardbody"), board = $("board");
  if (!body || !board) return;
  let bail: ReturnType<typeof setTimeout>;
  const obs = new MutationObserver(() => {
    obs.disconnect();
    clearTimeout(bail);
    board.classList.remove("dbswap");
    void board.offsetWidth;
    board.classList.add("dbswap");
  });
  obs.observe(body, { childList: true });
  // The panel may never repaint (a slot with no brief, a closed panel) — an observer left armed
  // would fire on some later, unrelated render.
  bail = setTimeout(() => obs.disconnect(), 4000);
}

function go(ch: Chapter): void {
  const from = applied;
  current = ch;
  armState(ch);
  renderBar(ch);
  turn();
  if (from && from.slot !== ch.slot) armSwap();
  applyUi(ch);
  armHints();
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
  armHints();
  // A label's place is its anchor's place, so anything that moves the anchor has to move the label.
  addEventListener("resize", syncHints);

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
  MOBILE.addEventListener("change", () => {
    setTimeout(() => { applied = null; applyUi(current); syncHints(); }, 0);
  });

  // A hint may name a frame OF THIS CHAPTER'S EXCERPT ("once the commits are on screen"), which is
  // the only clock a replay has: the recordings carry no timestamps, so seconds would be a number
  // we invented and frames are what the material actually has.
  onFrame((slot, i) => {
    if (slot !== current.slot || i === frame) return;
    frame = i;
    syncHints();
  });

  // When the picture stops moving, the way on gets a quiet pulse. Autoplay stays rejected (PLAN §1b):
  // this asks, it does not act.
  onStreamEnd((slot) => {
    const next = $("dbnext") as HTMLButtonElement | null;
    if (slot === current.slot && next && !next.disabled) next.classList.add("pulse");
  });
});

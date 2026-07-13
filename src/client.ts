import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";

const $ = (id: string) => document.getElementById(id)!;
const slotsEl = $("slots"), dot = $("dot"),
  ta = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement,
  gate = $("gate"), gateIn = $("gatein") as HTMLInputElement,
  picker = $("picker"), pkTitle = $("pktitle"), pkPath = $("pkpath") as HTMLInputElement,
  pkLists = $("pklists"), chipsEl = $("chips"), panesEl = $("panes");

const RECENT_MS = 5000;
const MAX_CHUNK = 1000; // stay under the server's 1024-byte cap per WS message
const LAYOUTS: Record<string, number> = { "1": 1, "2": 2, "4": 4 };

// must match the mobile media query in index.html
const MOBILE_MQ = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");
const isMobile = () => MOBILE_MQ.matches;

const mdot = $("mdot"), mtitle = $("mtitle");
function setConn(on: boolean) {
  for (const d of [dot, mdot]) d.className = `dot ${on ? "on" : "off"}`;
}

function setDrawer(open: boolean) {
  document.body.classList.toggle("drawer", open);
}
$("menu").onclick = () => setDrawer(true);
$("shade").onclick = () => setDrawer(false);
// mobile's #refresh (no layout switcher to force a reconnect through) and desktop's
// #reload (quicker than toggling panes, and works in single-pane layout too) both
// force the focused pane to reconnect — the server re-seeds scrollback at the
// reconnecting client's width, so this is "fix my wrapping" on demand either way
for (const b of [$("refresh"), $("reload")]) b.onclick = () => panes[focused]?.reconnect();

// --- desktop sidebar collapse (persisted). The .collapsed class is desktop-only:
// on mobile #side is the slide-in drawer, so applyCollapsed strips it there ---
const sideEl = $("side"), collapseBtn = $("collapse");
let sideCollapsed = false;
function applyCollapsed() {
  sideEl.classList.toggle("collapsed", sideCollapsed && !isMobile());
  collapseBtn.textContent = sideCollapsed ? "›" : "‹"; // › when collapsed, ‹ when open
  collapseBtn.title = sideCollapsed ? "expand sidebar" : "collapse sidebar";
}
function setCollapsed(on: boolean) {
  sideCollapsed = on;
  localStorage.setItem("fleet.sidecollapsed", on ? "1" : "0");
  applyCollapsed();
  // the sidebar's width changed → terminals must refit to the freed/returned space
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
}
collapseBtn.onclick = () => setCollapsed(!sideCollapsed);

// all dynamic text goes through textContent — cwd/dir names are untrusted for the DOM
function el(tag: string, className: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

// --- auth gate: cookie is set by /?token=… or pasted here ---
function showGate() {
  gate.style.display = "flex";
  gateIn.focus();
}
gateIn.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = gateIn.value.trim();
  if (!t) return;
  document.cookie = `fleet=${t}; Path=/; SameSite=Strict; Max-Age=31536000`;
  location.reload();
});

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401) showGate();
  return res;
}
const post = (path: string, body: unknown) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// --- fleet state ---
interface SlotInfo { id: number; cwd: string | null; label: string | null; lastOutput: number }
let fleet: SlotInfo[] = [];
let serverNow = 0;

// --- panes: each visible terminal owns its Terminal, WS, and resize state ---
class Pane {
  slot = 0; // 0 = unassigned
  private gen = 0; // bump to suppress a stale socket's reconnect loop
  private ws: WebSocket | null = null;
  private lastCols = 0;
  private lastRows = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  readonly root: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly jump: HTMLElement;
  readonly term: Terminal;
  private readonly fit: FitAddon;

  constructor(readonly index: number) {
    this.root = el("div", "pane");
    const termEl = el("div", "paneterm");
    this.hint = el("div", "panehint", "no session — click a slot");
    this.jump = el("button", "jump", "▼");
    this.root.append(termEl, this.hint, this.jump);
    this.term = new Terminal({
      scrollback: 50000,
      fontSize: isMobile() ? 11 : 12,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      theme: { background: "#141414", foreground: "#d8d8d8" },
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.open(termEl);
    // default DOM renderer paints every visible cell as a real DOM node — on mobile Safari,
    // with a busy Claude session streaming output while the user scrolls, that DOM churn is
    // the likely source of scroll stutter. Canvas renderer paints the same content to a
    // <canvas>, avoiding per-cell DOM updates. Loaded after open() per xterm's addon contract;
    // it's disposed automatically when this.term.dispose() runs (Terminal.dispose disposes
    // all loaded addons).
    this.term.loadAddon(new CanvasAddon());
    // on touch devices all input goes through the compose bar + key row; inputMode=none
    // lets xterm keep focus for scrolling without popping the on-screen keyboard
    if (isMobile() && this.term.textarea) this.term.textarea.inputMode = "none";
    this.term.onData((d) => this.sendRaw(d));
    this.term.attachCustomKeyEventHandler((e) => {
      // ⌃digit switches slots even while the terminal has keyboard focus — without this,
      // xterm would send the digit to the pty as if it were typed
      if (slotHotkey(e) !== null) return false;
      return !e.metaKey; // ⌘ combos stay with the browser (copy, paste, reload)
    });
    const updateJump = () => {
      const b = this.term.buffer.active;
      this.jump.style.display = b.viewportY < b.baseY - 1 ? "flex" : "none";
    };
    this.term.onScroll(updateJump);
    this.term.onWriteParsed(updateJump);
    // touch momentum scroll drives the native viewport directly and doesn't emit
    // xterm's onScroll — listen to the DOM scroll so the jump pill stays in sync
    termEl.querySelector(".xterm-viewport")?.addEventListener("scroll", updateJump, { passive: true });
    this.jump.onclick = () => { this.term.scrollToBottom(); this.focus(); };
    this.root.addEventListener("mousedown", () => focusPane(this.index));
    this.root.addEventListener("animationend", () => this.root.classList.remove("flash"));
  }

  // briefly rings the pane in the focus-blue accent — desktop only (mobile only ever
  // shows one pane, so there's no "which one changed" ambiguity to clear up)
  flash() {
    if (isMobile()) return;
    this.root.classList.remove("flash");
    void this.root.offsetWidth; // force reflow so re-adding the class retriggers the CSS animation
    this.root.classList.add("flash");
  }

  sendRaw(s: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const bytes = new TextEncoder().encode(s);
    // splitting mid-codepoint is safe: tmux relays raw bytes to the pty, which
    // reassembles UTF-8 the same way it would from fast individual keystrokes
    for (let i = 0; i < bytes.length; i += MAX_CHUNK) this.ws.send(bytes.slice(i, i + MAX_CHUNK));
  }

  private connect(force = false) {
    if (!this.slot) return;
    this.gen++;
    const g = this.gen;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    // cols/rows tell the server our real size synchronously at connect time, so it can
    // seed correctly-wrapped scrollback instead of racing the separate /resize POST.
    // force (set only by reconnect(), i.e. the reload/refresh button) skips the server's
    // width-mismatch check — otherwise "reload" is a silent no-op whenever this client's
    // width already happens to match the pane's, which is the common case
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/${this.slot}?cols=${this.term.cols}&rows=${this.term.rows}${force ? "&force=1" : ""}`,
    );
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      if (focused === this.index) setConn(true);
      this.sendResize(true);
    };
    ws.onmessage = (e) => this.term.write(new Uint8Array(e.data as ArrayBuffer));
    ws.onclose = () => {
      if (g !== this.gen) return; // superseded by a reassign or dispose
      if (focused === this.index) setConn(false);
      setTimeout(() => {
        if (g === this.gen && fleet[this.slot - 1]?.cwd) this.connect();
      }, 1500);
    };
  }

  assign(slot: number) {
    if (slot === this.slot) { this.focus(); return; }
    this.slot = slot;
    this.gen++; // orphan the old socket before close so its onclose can't reconnect
    this.ws?.close();
    this.term.reset();
    this.hint.style.display = slot ? "none" : "flex";
    // size the terminal to its container before connecting — the WS URL carries
    // this size, and connecting at a stale default (e.g. 80x24) would seed scrollback
    // at the wrong width and force an immediate second reseed once refit() catches up
    if (slot) { this.fit.fit(); this.connect(); }
    this.focus();
    renderSlots(); // focusPane skips no-op renders, but an assignment always changes the sidebar
    saveView();
  }

  focus() {
    focusPane(this.index);
    if (!isMobile()) this.term.focus(); // focusing would be pointless without a hardware keyboard
  }

  // the reload/refresh button: forces a fresh WS connection that always re-seeds from a
  // resize+capture-pane, even if this client's width already matches the pane's — a plain
  // reconnect skips reseeding in that case, which would make "reload" a no-op whenever
  // nothing about the size changed, i.e. the exact case this button exists to fix
  reconnect() {
    if (!this.slot) return;
    this.gen++; // orphan the old socket before close so its onclose can't reconnect
    this.ws?.close();
    this.term.reset();
    this.fit.fit();
    this.connect(true);
  }

  refit() {
    this.fit.fit();
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.sendResize(), 500);
  }

  private sendResize(force = false) {
    if (!this.slot) return;
    if (!force && this.term.cols === this.lastCols && this.term.rows === this.lastRows) return;
    this.lastCols = this.term.cols;
    this.lastRows = this.term.rows;
    void post("/resize", { slot: this.slot, cols: this.term.cols, rows: this.term.rows });
  }

  dispose() {
    this.gen++;
    this.ws?.close();
    clearTimeout(this.resizeTimer);
    this.term.dispose();
    this.root.remove();
  }
}

let panes: Pane[] = [];
let focused = 0;
let layout = 1;

function focusPane(index: number) {
  const changed = focused !== index;
  focused = index;
  for (const p of panes) p.root.classList.toggle("focused", p.index === focused);
  const slot = panes[focused]?.slot;
  const hint = isMobile() ? "" : " (Enter sends)";
  ta.placeholder = slot ? `Prompt for slot ${slot === 10 ? 0 : slot}…${hint}` : "Prompt… (no session in focused pane)";
  updateTitle();
  // a no-op focus must not rebuild the sidebar: the first click of a double-click on a
  // slot label lands here, and rebuilding would replace the element mid-double-click
  if (changed) {
    renderSlots();
    saveView();
  }
}

function setLayout(n: number, assignments?: number[]) {
  layout = n;
  for (const p of panes) p.dispose();
  panes = [];
  panesEl.className = `l${n}`;
  for (let i = 0; i < n; i++) {
    const p = new Pane(i);
    panes.push(p);
    panesEl.appendChild(p.root);
  }
  const want = assignments ?? [];
  const seen = new Set<number>();
  for (let i = 0; i < n; i++) {
    const s = want[i] ?? 0;
    if (s && fleet[s - 1]?.cwd && !seen.has(s)) {
      seen.add(s);
      panes[i].assign(s);
    }
  }
  for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
    b.classList.toggle("active", b.dataset.l === String(n));
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  focusPane(Math.min(focused, n - 1));
}

// sidebar click: assign to the focused pane — unless the slot is already
// visible in another pane (same slot twice = two sessions fighting over resize)
function showSlot(id: number) {
  if (!fleet[id - 1]?.cwd) return;
  setDrawer(false);
  const existing = panes.find((p) => p.slot === id);
  if (existing) { existing.focus(); existing.flash(); return; }
  const target = panes[focused];
  target.assign(id);
  target.flash();
}

function slotHotkey(e: KeyboardEvent): number | null {
  if (e.ctrlKey && !e.metaKey && !e.altKey && /^[0-9]$/.test(e.key)) return e.key === "0" ? 10 : Number(e.key);
  return null;
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (picker.style.display === "flex") closePicker();
    setDrawer(false);
    return;
  }
  const id = slotHotkey(e);
  // don't hijack Ctrl+digit out from under ANY text entry (compose box, picker path,
  // token gate, live-typing input, or the sidebar's dynamically-created rename field) —
  // excluding only `ta` missed all of those
  const typing = document.activeElement instanceof HTMLInputElement
    || document.activeElement instanceof HTMLTextAreaElement;
  if (id !== null && !typing) {
    e.preventDefault();
    showSlot(id);
  }
});
window.addEventListener("resize", () => { for (const p of panes) p.refit(); });

// crossing the mobile breakpoint (rotation, window resize) rebuilds the panes so
// per-pane mobile settings (font size, inputMode, forced single layout) re-apply
MOBILE_MQ.addEventListener("change", () => {
  setDrawer(false);
  setLive(false); // the live bar is a mobile-only surface
  applyCollapsed(); // strip the rail on mobile, restore it on desktop
  setLayout(isMobile() ? 1 : layout, panes.map((p) => p.slot));
});

// iOS Safari: the on-screen keyboard shrinks the visual viewport but not the layout
// viewport — track it so the compose bar stays visible above the keyboard
const vv = window.visualViewport;
if (vv) {
  let vvRefitTimer: ReturnType<typeof setTimeout> | undefined;
  const sync = () => {
    if (isMobile()) document.documentElement.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
    else document.documentElement.style.removeProperty("--vvh");
    window.scrollTo(0, 0);
    // the keyboard opening/closing and its predictive-text bar toggling fire several of
    // these in a burst while typing; settle before refitting so a mid-transition height
    // reading doesn't trigger a spurious /resize (and the server's redraw jiggle) on
    // every micro-wobble — this was blanking the active input line while composing
    clearTimeout(vvRefitTimer);
    vvRefitTimer = setTimeout(() => { for (const p of panes) p.refit(); }, 200);
  };
  vv.addEventListener("resize", sync);
}

// mobile key row: terminal keys a virtual keyboard doesn't have (raw bytes over the WS)
const KEYS: Record<string, string> = {
  esc: "\x1b", tab: "\t", stab: "\x1b[Z", up: "\x1b[A", down: "\x1b[B",
  left: "\x1b[D", right: "\x1b[C", enter: "\r", cc: "\x03",
};
for (const b of document.querySelectorAll<HTMLButtonElement>("#keys button")) {
  b.addEventListener("pointerdown", (e) => e.preventDefault()); // don't steal focus / close the keyboard
  b.onclick = () => {
    const k = KEYS[b.dataset.k ?? ""];
    if (k) panes[focused]?.sendRaw(k);
  };
}

// --- live typing mode (mobile): a real visible input relays every keystroke to the
// focused pane, same approach as claude-deck — xterm's hidden helper textarea is
// unreliable on iOS (keyboard often won't open, autocorrect swallows input)
const live = $("live"), livebar = $("livebar"), livein = $("livein") as HTMLInputElement;
let liveOn = false;
function setLive(on: boolean) {
  liveOn = on;
  live.classList.toggle("on", on);
  livebar.style.display = on ? "flex" : "none";
  // reveal the field but don't focus it — tapping it is what should open the keyboard
  if (!on) livein.blur();
}
live.onclick = () => setLive(!liveOn);
const LIVE_KEYS: Record<string, string> = {
  Enter: "\r", Escape: "\x1b", Backspace: "\x7f", Tab: "\t",
  ArrowUp: "\x1b[A", ArrowDown: "\x1b[B", ArrowRight: "\x1b[C", ArrowLeft: "\x1b[D",
};
livein.addEventListener("keydown", (e) => {
  if (e.isComposing) return;
  const seq = LIVE_KEYS[e.key];
  if (seq) {
    e.preventDefault();
    panes[focused]?.sendRaw(seq);
  }
});
livein.addEventListener("beforeinput", (e) => {
  if (e.inputType === "insertCompositionText") return; // not cancelable; handled on compositionend
  if (e.inputType === "insertText" || e.inputType === "insertFromPaste") {
    e.preventDefault();
    if (e.data) panes[focused]?.sendRaw(e.data);
  }
});
livein.addEventListener("compositionend", (e) => {
  if (e.data) panes[focused]?.sendRaw(e.data);
  livein.value = "";
});
livein.addEventListener("input", () => {
  // sweeper: the field must stay empty so autocorrect has nothing to rewrite
  if (livein.value) livein.value = "";
});

for (const b of document.querySelectorAll<HTMLButtonElement>("#layouts button"))
  b.onclick = () => {
    setLayout(LAYOUTS[b.dataset.l ?? "1"] ?? 1, panes.map((p) => p.slot));
    saveView();
  };

function saveView() {
  localStorage.setItem("fleet.view", JSON.stringify({ layout, panes: panes.map((p) => p.slot), focused }));
}

// --- directory picker ---
let pickerSlot = 0;
function closePicker() {
  picker.style.display = "none";
  pickerSlot = 0;
}
picker.addEventListener("click", (e) => {
  if (e.target === picker) closePicker();
});
$("pkcancel").onclick = closePicker;
$("pkstart").onclick = () => void startSession(pkPath.value);
pkPath.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void browse(pkPath.value);
});

function dirRow(label: string, path: string, cls: string): HTMLElement {
  const row = el("div", `pkrow ${cls}`, label);
  row.title = path;
  // single click navigates in (browse); double click starts here directly — same
  // navigate-vs-activate convention as double-clicking a slot label to rename it.
  // Reconciled via MouseEvent.detail in one handler, not separate onclick/ondblclick:
  // browse() replaces this row's DOM once its fetch resolves, and on a local server
  // that's fast enough to beat the second click of a real double-click, which would
  // then land on whatever row ends up in its place instead of this one.
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  row.onclick = (e) => {
    clearTimeout(clickTimer);
    if (e.detail >= 2) { void startSession(path); return; }
    clickTimer = setTimeout(() => void browse(path), 250);
  };
  const use = el("span", "pkuse", "start ▸");
  use.onclick = (e) => {
    e.stopPropagation();
    void startSession(path);
  };
  row.appendChild(use);
  return row;
}

async function browse(path: string) {
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as
    | { path: string; parent: string | null; dirs: string[]; recents: string[]; common: string[] }
    | { error: string };
  if ("error" in data) {
    pkPath.classList.add("bad");
    setTimeout(() => pkPath.classList.remove("bad"), 1200);
    return;
  }
  pkPath.value = data.path;
  pkPath.classList.remove("bad");
  pkLists.replaceChildren();
  if (data.recents.length) {
    pkLists.appendChild(el("div", "pkhead", "Recent"));
    for (const r of data.recents) pkLists.appendChild(dirRow(r.replace(/^\/Users\/[^/]+/, "~"), r, "recent"));
  }
  pkLists.appendChild(el("div", "pkhead", "Places"));
  for (const c of data.common) pkLists.appendChild(dirRow(c.replace(/^\/Users\/[^/]+/, "~"), c, "place"));
  pkLists.appendChild(el("div", "pkhead", `Folders in ${data.path}`));
  if (data.parent) pkLists.appendChild(dirRow("..", data.parent, "up"));
  for (const d of data.dirs) pkLists.appendChild(dirRow(d, `${data.path}/${d}`.replace("//", "/"), "dir"));
  if (!data.dirs.length) pkLists.appendChild(el("div", "pknone", "no subfolders"));
}

async function startSession(path: string) {
  if (!pickerSlot) return;
  const slot = pickerSlot;
  const res = await post(`/api/slots/${slot}/open`, { cwd: path });
  if (!res.ok) {
    pkPath.classList.add("bad");
    setTimeout(() => pkPath.classList.remove("bad"), 1200);
    return;
  }
  closePicker();
  await refresh();
  showSlot(slot);
}

function openPicker(slotId: number) {
  setDrawer(false);
  pickerSlot = slotId;
  pkTitle.textContent = `New session — slot ${slotId === 10 ? 0 : slotId}`;
  picker.style.display = "flex";
  // focusing the path input on mobile would pop the keyboard over the folder list
  void browse("~").then(() => { if (!isMobile()) pkPath.focus(); });
}

// --- sidebar ---
function baseName(p: string) {
  const parts = p.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || "/";
}

function startRename(row: HTMLElement, s: SlotInfo) {
  // dblclick on a not-yet-focused slot: the first click's assign() rebuilds the sidebar,
  // so the dblclick lands on the detached old row — a rename input there would be invisible.
  // Re-target the live row for this slot instead of silently doing nothing.
  if (!row.isConnected) {
    const live = slotsEl.children[s.id - 1];
    if (!(live instanceof HTMLElement)) return;
    row = live;
  }
  const lbl = row.querySelector(".lbl");
  if (!lbl || row.querySelector(".renamein")) return;
  const input = document.createElement("input");
  input.className = "renamein";
  input.value = s.label ?? "";
  input.placeholder = baseName(s.cwd!);
  input.maxLength = 40;
  lbl.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = async (save: boolean) => {
    if (done) return;
    done = true;
    // restore the label BEFORE refreshing — renderSlots skips any rebuild while a
    // .renamein exists, so a leftover input would wedge the sidebar forever
    input.replaceWith(lbl);
    if (save && input.value.trim() !== (s.label ?? "")) await post(`/api/slots/${s.id}/rename`, { label: input.value });
    lastRender = ""; // force the sidebar rebuild even if nothing else changed
    await refresh();
  };
  input.onclick = (e) => e.stopPropagation();
  input.onkeydown = (e) => {
    e.stopPropagation(); // keep the global Escape handler away while editing
    if (e.key === "Enter") void finish(true);
    if (e.key === "Escape") void finish(false);
  };
  input.onblur = () => void finish(true);
}

function updateTitle() {
  const slot = panes[focused]?.slot ?? 0;
  const s = slot ? fleet[slot - 1] : undefined;
  mtitle.textContent = s?.cwd ? (s.label ?? baseName(s.cwd)) : "Claude Fleet";
}

function renderSlots() {
  updateTitle();
  if (slotsEl.querySelector(".renamein")) return; // never destroy an in-progress rename
  slotsEl.replaceChildren();
  for (const s of fleet) {
    const visible = panes.some((p) => p.slot === s.id);
    const isFocused = panes[focused]?.slot === s.id;
    const row = el("div", "slot" + (isFocused ? " current" : visible ? " shown" : "") + (s.cwd ? "" : " empty"));
    row.appendChild(el("span", "n", s.id === 10 ? "0" : String(s.id)));
    if (s.cwd) {
      const lbl = el("span", "lbl", s.label ?? baseName(s.cwd));
      lbl.title = s.cwd;
      lbl.ondblclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      row.appendChild(lbl);
      // green = live in a pane, or a background session that just produced output
      row.appendChild(el("span", "act" + (visible || serverNow - s.lastOutput < RECENT_MS ? " hot" : "")));
      const ren = el("span", "ren", "✎");
      ren.title = "rename session";
      ren.onclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      const kill = el("span", "kill", "✕");
      kill.title = "kill session";
      kill.onclick = async (e) => {
        e.stopPropagation();
        if (!confirm(`Kill session ${s.id} (${baseName(s.cwd!)})? The claude session and its history are gone.`)) return;
        await post(`/api/slots/${s.id}/kill`, {});
        for (const p of panes) if (p.slot === s.id) p.assign(0);
        await refresh();
      };
      const act = el("div", "slotact");
      act.append(ren, kill);
      row.appendChild(act);
      row.onclick = () => showSlot(s.id);
    } else {
      row.appendChild(el("span", "lbl dim", "+ new session"));
      row.onclick = () => openPicker(s.id);
    }
    slotsEl.appendChild(row);
  }
}

function renderChips(chips: string[]) {
  if (chipsEl.childElementCount === chips.length) return;
  chipsEl.replaceChildren();
  for (const c of chips) {
    const b = el("button", "chip", c.replace(/^\//, "")) as HTMLButtonElement;
    b.dataset.cmd = c;
    b.onclick = () => togglePrefix(c);
    chipsEl.appendChild(b);
  }
  updateChips();
}

let chipCmds: string[] = [];
let lastRender = "";
async function refresh() {
  try {
    const res = await api("/api/sessions");
    if (!res.ok) return;
    const data = (await res.json()) as { now: number; chips: string[]; slots: SlotInfo[] };
    fleet = data.slots;
    serverNow = data.now;
    chipCmds = data.chips;
    renderChips(data.chips);
    // skip the DOM rebuild when nothing visible changed — a full re-render kills hover state
    const key = JSON.stringify([focused, panes.map((p) => p.slot),
      data.slots.map((s) => [s.cwd, s.label, serverNow - s.lastOutput < RECENT_MS])]);
    if (key !== lastRender) {
      lastRender = key;
      renderSlots();
    }
  } catch {
    // server briefly unreachable — WS dot already shows disconnect
  }
}
setInterval(() => void refresh(), 2000);

// --- compose box: Enter sends (bracketed paste + Enter server-side), Shift+Enter = newline ---
function flashSendError() {
  send.style.background = "#f85149";
  setTimeout(() => { send.style.background = ""; }, 1200);
}
async function doSend() {
  const text = ta.value.trim();
  const slot = panes[focused]?.slot;
  if (!text || !slot || send.disabled) return;
  send.disabled = true;
  try {
    const res = await post("/send", { slot, text, submit: true });
    if (!res.ok) throw new Error(`send failed: ${res.status}`);
    ta.value = "";
    updateChips();
    panes[focused].term.scrollToBottom();
  } catch {
    flashSendError(); // text stays in the box so nothing typed is silently lost
  } finally {
    send.disabled = false;
  }
}
send.onclick = () => void doSend();
ta.addEventListener("keydown", (e) => {
  // desktop: Enter sends. mobile: Enter is a newline (messaging convention) — ➤ sends
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && !isMobile()) {
    e.preventDefault();
    void doSend();
  }
});

// --- command prefix chips (server-configurable via FLEET_CHIPS) ---
function currentPrefix(): string | null {
  for (const c of chipCmds) if (ta.value === c || ta.value.startsWith(c + " ")) return c;
  return null;
}
function updateChips() {
  const active = currentPrefix();
  for (const b of chipsEl.querySelectorAll<HTMLButtonElement>(".chip"))
    b.classList.toggle("active", b.dataset.cmd === active);
}
function togglePrefix(cmd: string) {
  const active = currentPrefix();
  const rest = active ? ta.value.slice(active.length).replace(/^ /, "") : ta.value;
  ta.value = active === cmd ? rest : cmd + " " + rest;
  updateChips();
  ta.focus();
}
ta.addEventListener("input", updateChips);

// --- boot: restore layout + pane assignments (migrates the old fleet.current key) ---
void (async () => {
  await refresh();
  let view: { layout?: number; panes?: number[]; focused?: number } = {};
  try {
    view = JSON.parse(localStorage.getItem("fleet.view") ?? "{}") as typeof view;
  } catch {
    view = {};
  }
  const legacy = Number(localStorage.getItem("fleet.current"));
  const n = !isMobile() && view.layout && LAYOUTS[String(view.layout)] ? view.layout : 1;
  const assignments = view.panes ?? (legacy ? [legacy] : []);
  if (!assignments.some((s) => s && fleet[s - 1]?.cwd)) {
    const first = fleet.find((s) => s.cwd)?.id;
    if (first) assignments[0] = first;
  }
  setLayout(n, assignments);
  focusPane(Math.min(view.focused ?? 0, n - 1));
  setCollapsed(localStorage.getItem("fleet.sidecollapsed") === "1");
})();

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";

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

// navigator.clipboard only exists in a secure context (HTTPS or localhost) — this
// dashboard is normally reached over plain HTTP via a Tailscale IP, so it's undefined
// there and this falls back to the legacy execCommand copy path
function copyText(text: string) {
  if (navigator.clipboard) {
    void navigator.clipboard.writeText(text);
    return;
  }
  const tmp = document.createElement("textarea");
  tmp.value = text;
  tmp.style.position = "fixed";
  tmp.style.opacity = "0";
  document.body.appendChild(tmp);
  tmp.select();
  document.execCommand("copy");
  document.body.removeChild(tmp);
}

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
// route the pasted token through the server's own /?token=… login endpoint instead of
// setting document.cookie directly — JS can never set an HttpOnly cookie, so a client-side
// set here would silently downgrade the auth cookie below what the URL-based login flow gets
async function submitToken(t: string) {
  const res = await fetch(`/?token=${encodeURIComponent(t)}`);
  if (res.ok) { location.reload(); return; }
  gateIn.classList.add("bad");
  setTimeout(() => gateIn.classList.remove("bad"), 1200);
}
gateIn.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const t = gateIn.value.trim();
  if (!t) return;
  void submitToken(t);
});

async function api(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, init);
  if (res.status === 401) showGate();
  return res;
}
const post = (path: string, body: unknown) =>
  api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// --- fleet state ---
interface ShareInfo { id: string; mode: "view" | "interact"; password: string; created: number; guests: number }
interface AutoInfo {
  id: string; slot: number; text: string; everySec: number | null; nextAt: number;
  runsLeft: number; idleSec: number; enabled: boolean; lastRun: number; lastResult: string | null;
}
interface GitInfo { branch: string; dirty: number; ahead: number; behind: number }
interface WorktreeInfo { repo: string; branch: string }
interface SlotInfo { id: number; cwd: string | null; label: string | null; lastOutput: number;
  share?: ShareInfo | null; git?: GitInfo | null; worktree?: WorktreeInfo | null }
interface TaskInfo { id: string; text: string; source: "owner" | "intake"; from: string | null;
  status: "pending" | "queued" | "sent" | "done"; created: number; slot: number | null; note: string | null }
interface DispatchInfo { available: boolean; on: boolean; maxLanes: number; repo: string }
let fleet: SlotInfo[] = [];
let autosList: AutoInfo[] = [];
let tasksList: TaskInfo[] = [];
let dispatch: DispatchInfo = { available: false, on: false, maxLanes: 0, repo: "" };
let intakeOn = false;
let serverNow = 0;
let shareBase = ""; // public URL prefix for share links (FLEET_SHARE_URL server-side)

// --- transcript view model (mirrors server.ts's TEntry/TBlock) ---
interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[] }

// minimal, XSS-safe markdown: only ``` fences get structure, everything else is textContent
function mdInto(target: HTMLElement, text: string) {
  const parts = text.split("```");
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const nl = part.indexOf("\n");
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      const wrap = el("div", "code");
      wrap.appendChild(el("pre", "", code.replace(/\n$/, "")));
      target.appendChild(wrap);
    } else if (part.trim()) {
      target.appendChild(el("pre", "", part.replace(/^\n+|\n+$/g, "")));
    }
  });
}

const fmtClock = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

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
  // conversation view: renders the claude transcript as structured messages —
  // reflows at any width, which the fixed-width pty stream can't
  private readonly chatEl: HTMLElement;
  private readonly viewBtn: HTMLButtonElement;
  private readonly boardBtn: HTMLButtonElement;
  private view: "term" | "chat" = "term";
  private chatTotal = 0;
  private chatSource: string | null = null;
  private chatTimer: ReturnType<typeof setTimeout> | undefined;
  private chatBusy = false;

  constructor(readonly index: number) {
    this.root = el("div", "pane");
    const termEl = el("div", "paneterm");
    this.hint = el("div", "panehint", "no session — click a slot");
    this.jump = el("button", "jump", "▼");
    this.chatEl = el("div", "panechat");
    this.viewBtn = el("button", "viewtoggle", "💬") as HTMLButtonElement;
    this.viewBtn.title = "toggle conversation view";
    this.viewBtn.style.display = "none";
    this.viewBtn.onclick = (e) => {
      e.stopPropagation();
      this.setView(this.view === "term" ? "chat" : "term");
    };
    // board toggle sits beside the viewtoggle; the board always describes the
    // FOCUSED session, and clicking a pane focuses it first (root mousedown)
    this.boardBtn = el("button", "boardtoggle", "ℹ") as HTMLButtonElement;
    this.boardBtn.title = "session brief — commits, changes, prompts, ✨ summary";
    this.boardBtn.style.display = "none";
    this.boardBtn.classList.toggle("active", boardOpen);
    this.boardBtn.onclick = (e) => {
      e.stopPropagation();
      focusPane(this.index);
      setBoard(!boardOpen);
    };
    const navUp = el("button", "promptnav up", "↑") as HTMLButtonElement;
    navUp.title = "previous prompt of yours";
    navUp.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(-1); };
    const navDn = el("button", "promptnav dn", "↓") as HTMLButtonElement;
    navDn.title = "next prompt of yours";
    navDn.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(1); };
    this.root.append(termEl, this.chatEl, this.hint, this.jump, this.viewBtn, this.boardBtn, navUp, navDn);
    this.term = new Terminal({
      scrollback: 50000,
      fontSize: isMobile() ? 11 : 12,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      theme: { background: "#141414", foreground: "#d8d8d8" },
    });
    this.fit = new FitAddon();
    this.term.loadAddon(this.fit);
    this.term.open(termEl);
    // GPU renderers instead of the default DOM one (which paints every cell as a real DOM
    // node — scroll stutter on mobile Safari under streaming output). WebGL is the fastest
    // and crispest; it can fail (no context on old GPUs, context loss later) — fall back to
    // the canvas renderer either way. Addons are disposed by term.dispose().
    try {
      const webgl = new WebglAddon();
      webgl.onContextLoss(() => {
        webgl.dispose();
        this.term.loadAddon(new CanvasAddon());
      });
      this.term.loadAddon(webgl);
    } catch {
      this.term.loadAddon(new CanvasAddon());
    }
    // on touch devices all input goes through the compose bar + key row; inputMode=none
    // lets xterm keep focus for scrolling without popping the on-screen keyboard
    if (isMobile() && this.term.textarea) this.term.textarea.inputMode = "none";
    this.term.onData((d) => this.sendRaw(d));
    this.term.attachCustomKeyEventHandler((e) => {
      // ⌃digit switches slots even while the terminal has keyboard focus — without this,
      // xterm would send the digit to the pty as if it were typed
      if (slotHotkey(e) !== null) return false;
      // the canvas renderer paints cells as pixels, not DOM text, so a drag-selection has
      // nothing for the browser's native ⌘C to copy (no real Selection exists) — copy the
      // selection text directly instead. Guard e.type: xterm invokes this handler from both
      // _keyDown and _keyPress, and would otherwise fire the clipboard write twice.
      if (e.type === "keydown" && e.metaKey && e.key.toLowerCase() === "c" && this.term.hasSelection()) {
        this.copySelection();
        return false;
      }
      return !e.metaKey; // other ⌘ combos stay with the browser (paste, reload, ...)
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

  private copySelection() {
    copyText(this.term.getSelection());
  }

  // NOTE: in-terminal sent-prompt markers (xterm decorations anchored at the send line)
  // were built and tested against a real claude TUI — its full-repaint behavior plus our
  // own resize jiggle relocates content, so line-anchored marks drift and were dropped.
  // "What did I send" lives in the 🕘 prompt history and the conversation view instead.

  setView(v: "term" | "chat") {
    this.view = v;
    this.root.classList.toggle("chat", v === "chat");
    this.viewBtn.textContent = v === "chat" ? "⌨" : "💬";
    this.viewBtn.title = v === "chat" ? "back to terminal" : "toggle conversation view";
    clearTimeout(this.chatTimer);
    if (v === "chat") void this.pollChat();
    else this.term.focus();
  }

  private resetChat() {
    clearTimeout(this.chatTimer);
    this.chatEl.replaceChildren();
    this.chatTotal = 0;
    this.chatSource = null;
    this.toolGroup = null;
  }

  // --- conversation rendering: the view exists so YOUR messages are findable.
  // They render as prominent anchors; everything the agent did between two texts
  // collapses into one expandable "⚙ n steps" line instead of a wall of rows. ---
  private toolGroup: { det: HTMLElement; sum: HTMLElement; body: HTMLElement; count: number;
    lastStep: HTMLElement | null } | null = null;

  private ensureToolGroup() {
    if (this.toolGroup) return this.toolGroup;
    const det = document.createElement("details");
    det.className = "toolgroup";
    const sum = document.createElement("summary");
    const body = el("div", "tgbody");
    det.append(sum, body);
    this.chatEl.appendChild(det);
    this.toolGroup = { det, sum, body, count: 0, lastStep: null };
    return this.toolGroup;
  }

  private addStep(b: TBlock) {
    const g = this.ensureToolGroup();
    if (b.t === "tool_result" && g.lastStep) {
      // attach the result to the call it answers instead of its own row
      g.lastStep.appendChild(el("pre", "tres", b.text));
      g.lastStep = null;
    } else {
      const step = document.createElement("details");
      step.className = "tstep";
      const sum = document.createElement("summary");
      sum.textContent = b.t === "thinking" ? "💭 thinking"
        : b.t === "tool" ? `${b.name ?? "tool"} ${b.text.slice(0, 90)}`
        : "result";
      step.append(sum, el("pre", "", b.text));
      g.body.appendChild(step);
      g.count++;
      g.lastStep = b.t === "tool" ? step : null;
    }
    g.sum.textContent = `⚙ ${g.count} step${g.count === 1 ? "" : "s"}`;
  }

  private appendEntry(e: TEntry) {
    for (const b of e.blocks) {
      if (b.t === "text") {
        this.toolGroup = null; // a message ends the current work block
        const msg = el("div", `msg ${e.role}`);
        msg.appendChild(el("div", "mhead", e.role === "user" ? `you · ${fmtClock(e.ts)}` : "claude"));
        mdInto(msg, b.text);
        this.chatEl.appendChild(msg);
      } else {
        this.addStep(b);
      }
    }
  }

  // jump between YOUR messages — the reason this view exists
  private jumpPrompt(dir: -1 | 1) {
    const users = [...this.chatEl.querySelectorAll<HTMLElement>(".msg.user")];
    if (!users.length) return;
    const y = this.chatEl.scrollTop;
    const target = dir === -1
      ? [...users].reverse().find((u) => u.offsetTop < y - 8)
      : users.find((u) => u.offsetTop > y + 8);
    (target ?? (dir === -1 ? users[0] : users[users.length - 1]))
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // sideboard outline → open the conversation view and bring prompt #i into view.
  // The chat may still be loading right after the view switch — retry until the
  // marker exists (same .msg.user anchors jumpPrompt navigates)
  showPromptAt(i: number, attempts = 15) {
    if (!this.slot) return;
    if (this.view !== "chat") this.setView("chat");
    const users = this.chatEl.querySelectorAll<HTMLElement>(".msg.user");
    if (users.length > i) {
      users[i].scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (attempts > 0) setTimeout(() => this.showPromptAt(i, attempts - 1), 400);
  }

  private async pollChat() {
    if (!this.slot || this.view !== "chat" || this.chatBusy) return;
    this.chatBusy = true;
    try {
      const res = await api(`/api/slots/${this.slot}/transcript?after=${this.chatTotal}`);
      if (!res.ok) return;
      const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
      // the slot's active transcript changed (fresh claude after a self-heal, or a better
      // pinned file appeared) — start over from the top of the new file
      if (this.chatSource !== null && data.source !== this.chatSource) {
        this.chatEl.replaceChildren();
        this.chatTotal = 0;
        this.chatSource = data.source;
        return; // next tick refills from 0
      }
      this.chatSource = data.source;
      if (data.source === null && !this.chatEl.childElementCount) {
        this.chatEl.replaceChildren(el("div", "chatempty", "no transcript yet — say something in the terminal"));
      }
      if (data.entries.length) {
        const empty = this.chatEl.querySelector(".chatempty");
        if (empty) empty.remove();
        // keep the view pinned to the newest message unless the user scrolled up to read
        const pinned = this.chatEl.scrollTop + this.chatEl.clientHeight >= this.chatEl.scrollHeight - 120;
        for (const e of data.entries) this.appendEntry(e);
        if (pinned) this.chatEl.scrollTop = this.chatEl.scrollHeight;
      }
      this.chatTotal = data.total;
    } catch {
      // transient fetch error — next tick retries
    } finally {
      this.chatBusy = false;
      if (this.view === "chat" && this.slot) {
        clearTimeout(this.chatTimer);
        this.chatTimer = setTimeout(() => void this.pollChat(), 1000);
      }
    }
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
    this.resetChat();
    this.viewBtn.style.display = slot ? "block" : "none";
    this.boardBtn.style.display = slot ? "block" : "none";
    if (slot && this.view === "chat") void this.pollChat();
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
    clearTimeout(this.chatTimer);
    // an in-flight pollChat() fetch resolving after dispose would otherwise re-arm its
    // own setTimeout forever (its finally-block re-checks view/slot, both still truthy) —
    // clearing them makes that guard fire and end the loop on a disposed instance
    this.slot = 0;
    this.view = "term";
    this.term.dispose();
    this.root.remove();
  }
}

let panes: Pane[] = [];
let focused = 0;
let layout = 1;

// --- right sideboard: session brief (desktop-only). Deterministic layers only —
// git facts fetched fresh from /brief per render, and the prompt outline derived from
// the SAME transcript feed the conversation view renders. No state of its own to drift.
interface BriefCommit { hash: string; ts: number; subject: string }
interface BriefInfo { branch: string | null; worktree: WorktreeInfo | null; files: string[];
  shortstat: string; commits: BriefCommit[] }
const boardBody = $("boardbody");
let boardOpen = localStorage.getItem("fleet.board") === "1";
let boardBusy = false;
// per-slot outline cursor, incremental like pollChat: full fetch once, then only new entries
const outline = new Map<number, { total: number; source: string | null; prompts: string[] }>();
// ✨ agent summary (BACKLOG #14 Phase 2): result of the server's short-lived
// claude -p run, cached per slot. Only ever fetched via GET (cache lookup) on
// first view — the model call itself is strictly click-triggered (POST).
interface SummaryInfo { summary?: string; openThreads?: string[]; verification?: string;
  model?: string; at?: number; head?: string | null; dirty?: number; error?: string }
const sumCache = new Map<number, SummaryInfo>();
const sumBusy = new Set<number>();

function applyBoard() {
  document.body.classList.toggle("board", boardOpen && !isMobile());
  // the toggle lives per-pane (next to the 💬 viewtoggle) — sync them all
  for (const b of document.querySelectorAll<HTMLButtonElement>(".boardtoggle"))
    b.classList.toggle("active", boardOpen);
}
function setBoard(on: boolean) {
  boardOpen = on;
  localStorage.setItem("fleet.board", on ? "1" : "0");
  applyBoard();
  // the board's width changed → terminals must refit (same rule as the sidebar collapse)
  requestAnimationFrame(() => { for (const p of panes) p.refit(); });
  if (on) void renderBoard();
}

async function pollOutline(slot: number): Promise<string[]> {
  const c = outline.get(slot) ?? { total: 0, source: null, prompts: [] };
  try {
    const res = await api(`/api/slots/${slot}/transcript?after=${c.total}`);
    if (!res.ok) return c.prompts;
    const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
    // fresh claude after a self-heal → transcript restarted; rebuild from the top
    if (c.source !== null && data.source !== c.source) {
      outline.set(slot, { total: 0, source: data.source, prompts: [] });
      return [];
    }
    c.source = data.source;
    for (const e of data.entries) {
      if (e.role !== "user") continue;
      // one outline row per user text block — exactly mirrors the .msg.user elements
      // appendEntry creates, so row index i maps to showPromptAt(i)
      for (const b of e.blocks) {
        if (b.t !== "text") continue;
        const first = b.text.split("\n").find((l) => l.trim()) ?? "";
        c.prompts.push(first.trim().slice(0, 100) || "(empty)");
      }
    }
    c.total = data.total;
    outline.set(slot, c);
  } catch {
    // transient fetch error — next render retries
  }
  return c.prompts;
}

async function renderBoard() {
  if (boardBusy || !boardOpen || isMobile()) return;
  boardBusy = true;
  try {
    const slot = panes[focused]?.slot;
    const s = slot ? fleet[slot - 1] : undefined;
    if (!slot || !s?.cwd) {
      boardBody.replaceChildren(el("div", "bempty", "no session in the focused pane"));
      return;
    }
    const [briefRes, prompts] = await Promise.all([api(`/api/slots/${slot}/brief`), pollOutline(slot)]);
    const brief = briefRes.ok ? ((await briefRes.json()) as BriefInfo) : null;
    const nodes: HTMLElement[] = [];
    const head = el("div", "bsec");
    head.appendChild(el("h3", "", `slot ${slot === 10 ? 0 : slot} — ${s.label ?? baseName(s.cwd)}`));
    if (brief?.branch) {
      const b = el("div", "bstate");
      b.appendChild(el("span", "bbranch", brief.branch));
      if (brief.worktree) b.appendChild(document.createTextNode(" · fleet lane"));
      head.appendChild(b);
    }
    nodes.push(head);
    if (brief) {
      const st = el("div", "bsec");
      st.appendChild(el("h3", "", "state"));
      const line = el("div", "bstate");
      if (brief.files.length) {
        line.appendChild(el("span", "editing",
          `${brief.files.length} file${brief.files.length === 1 ? "" : "s"} with uncommitted changes`));
        if (brief.shortstat) line.appendChild(document.createTextNode(` — ${brief.shortstat}`));
      } else {
        line.appendChild(el("span", "ready", "working tree clean"));
      }
      const ahead = s.git?.ahead ?? 0;
      if (ahead) line.appendChild(document.createTextNode(
        ` · ${ahead} commit${ahead === 1 ? "" : "s"} to push${brief.worktree ? "/land" : ""}`));
      st.appendChild(line);
      nodes.push(st);
      // recover a server-cached summary once per slot (GET never spawns the agent)
      if (!sumCache.has(slot)) {
        sumCache.set(slot, {});
        void api(`/api/slots/${slot}/summary`).then(async (r) => {
          if (!r.ok) return;
          const j = (await r.json()) as SummaryInfo;
          if (j.summary) {
            sumCache.set(slot, j);
            void renderBoard();
          }
        }).catch(() => { /* transient — the button still works */ });
      }
      const ssec = el("div", "bsec");
      ssec.appendChild(el("h3", "", "agent summary"));
      const sum = sumCache.get(slot);
      if (sum?.summary) {
        // visible aging: the summary is pinned to the git state it was computed on
        const c0 = brief.commits[0];
        const stale = (!!sum.head && !!c0 && !sum.head.startsWith(c0.hash)) || sum.dirty !== brief.files.length;
        if (stale) ssec.appendChild(el("div", "bstale", "⚠ computed for an older state — re-run to refresh"));
        ssec.appendChild(el("div", "bsum", sum.summary));
        if (sum.openThreads?.length) {
          ssec.appendChild(el("div", "bsumhead", "open threads"));
          for (const t of sum.openThreads) ssec.appendChild(el("div", "bsumrow", `· ${t}`));
        }
        if (sum.verification) ssec.appendChild(el("div", "bsumver", `verified: ${sum.verification}`));
        if (sum.model && sum.at)
          ssec.appendChild(el("div", "bsummeta", `${sum.model} · ${new Date(sum.at).toLocaleTimeString()}`));
      } else if (sum?.error) {
        ssec.appendChild(el("div", "bsumerr", sum.error));
      }
      const sbtn = el("button", "bsumbtn",
        sumBusy.has(slot) ? "… summarizing" : sum?.summary ? "✨ re-summarize" : "✨ summarize") as HTMLButtonElement;
      sbtn.disabled = sumBusy.has(slot);
      sbtn.title = "run a short-lived read-only agent (background claude session in this checkout, uses the subscription) — one model call";
      sbtn.onclick = async () => {
        if (sumBusy.has(slot)) return;
        sumBusy.add(slot);
        sbtn.disabled = true;
        sbtn.textContent = "… summarizing";
        try {
          const r = await post(`/api/slots/${slot}/summary`, {});
          const j = (await r.json().catch(() => ({}))) as SummaryInfo;
          sumCache.set(slot, r.ok ? j : { error: j.error ?? "summarizer failed" });
        } catch {
          sumCache.set(slot, { error: "summarizer failed — network error" });
        } finally {
          sumBusy.delete(slot);
          void renderBoard();
        }
      };
      ssec.appendChild(sbtn);
      nodes.push(ssec);
      if (brief.files.length) {
        const sec = el("div", "bsec");
        sec.appendChild(el("h3", "", "changed files"));
        for (const f of brief.files.slice(0, 30)) {
          const row = el("div", "bfile");
          row.appendChild(el("span", "bfst", f.slice(0, 2).trim() || "·"));
          row.appendChild(document.createTextNode(f.slice(3)));
          row.title = f;
          sec.appendChild(row);
        }
        if (brief.files.length > 30) sec.appendChild(el("div", "bempty", `… ${brief.files.length - 30} more`));
        nodes.push(sec);
      }
      if (brief.commits.length) {
        const sec = el("div", "bsec");
        sec.appendChild(el("h3", "", "recent commits"));
        for (const cm of brief.commits) {
          const row = el("div", "brow");
          row.appendChild(el("span", "bhash", cm.hash));
          const sub = el("span", "bsub", cm.subject);
          sub.title = cm.subject;
          row.appendChild(sub);
          sec.appendChild(row);
        }
        nodes.push(sec);
      }
    }
    const psec = el("div", "bsec");
    psec.appendChild(el("h3", "", `your prompts (${prompts.length})`));
    if (!prompts.length) psec.appendChild(el("div", "bempty", "no prompts in the transcript yet"));
    prompts.forEach((p, i) => {
      const row = el("div", "bprompt");
      row.appendChild(el("span", "bn", String(i + 1)));
      const t = el("span", "bt", p);
      t.title = p;
      row.appendChild(t);
      row.onclick = () => panes[focused]?.showPromptAt(i);
      psec.appendChild(row);
    });
    nodes.push(psec);
    // rebuild in place but keep the reading position
    const y = boardBody.scrollTop;
    boardBody.replaceChildren(...nodes);
    boardBody.scrollTop = y;
  } finally {
    boardBusy = false;
  }
}
$("boardclose").onclick = () => setBoard(false);
applyBoard();
setInterval(() => void renderBoard(), 3000);

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
    void renderBoard(); // the board describes the FOCUSED session — follow the focus
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
    if (hist.style.display === "flex") closeHist();
    if (sharedlg.style.display === "flex") closeShareDlg();
    if (autodlg.style.display === "flex") closeAutoDlg();
    if (diffdlg.style.display === "flex") closeDiffDlg();
    if (queuedlg.style.display === "flex") closeQueueDlg();
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
  applyBoard(); // same for the right sideboard — a desktop-only surface
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

// type-to-filter + arrow-key selection over the row list — the picker opens on every
// new session, so the common path must be "type a few letters, Enter" with no mouse
const pkFilter = $("pkfilter") as HTMLInputElement;
interface PkRow { row: HTMLElement; path: string; name: string; head: HTMLElement | null }
let pkRows: PkRow[] = [];
let pkSel = -1;

function pkVisible(): PkRow[] {
  return pkRows.filter((r) => !r.row.classList.contains("pkhide"));
}

function setPkSel(i: number) {
  const vis = pkVisible();
  pkSel = Math.max(-1, Math.min(i, vis.length - 1));
  for (const r of pkRows) r.row.classList.remove("sel");
  const cur = pkSel >= 0 ? vis[pkSel] : undefined;
  if (cur) {
    cur.row.classList.add("sel");
    cur.row.scrollIntoView({ block: "nearest" });
  }
}

function applyPkFilter() {
  const q = pkFilter.value.trim().toLowerCase();
  const headHits = new Map<HTMLElement, number>();
  for (const r of pkRows) {
    const hit = q === "" || r.name.includes(q);
    r.row.classList.toggle("pkhide", !hit);
    if (r.head) headHits.set(r.head, (headHits.get(r.head) ?? 0) + (hit ? 1 : 0));
  }
  for (const [head, n] of headHits) head.classList.toggle("pkhide", n === 0);
  setPkSel(q ? 0 : -1); // filtering pre-selects the best match so Enter just works
}

function pkKeyNav(e: KeyboardEvent): boolean {
  if (e.key === "ArrowDown") { setPkSel(pkSel + 1); return true; }
  if (e.key === "ArrowUp") { setPkSel(pkSel - 1); return true; }
  return false;
}
pkFilter.addEventListener("input", applyPkFilter);
pkFilter.addEventListener("keydown", (e) => {
  if (pkKeyNav(e)) { e.preventDefault(); return; }
  if (e.key !== "Enter") return;
  e.preventDefault();
  const target = pkSel >= 0 ? pkVisible()[pkSel] : undefined;
  if (e.metaKey || e.ctrlKey) void startSession(target?.path ?? pkPath.value);
  else if (target) void browse(target.path);
});
pkPath.addEventListener("keydown", (e) => {
  if (pkKeyNav(e)) { e.preventDefault(); return; }
  if (e.key !== "Enter") return;
  if (e.metaKey || e.ctrlKey) void startSession(pkPath.value);
  else void browse(pkPath.value);
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

async function browse(path: string): Promise<boolean> {
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as
    | { path: string; parent: string | null; dirs: string[]; recents: string[]; common: string[]; git?: boolean }
    | { error: string };
  if ("error" in data) {
    pkPath.classList.add("bad");
    setTimeout(() => pkPath.classList.remove("bad"), 1200);
    return false;
  }
  pkPath.value = data.path;
  pkPath.classList.remove("bad");
  // the worktree action only makes sense inside a git repo
  pkWorktreeBtn.style.display = data.git ? "" : "none";
  localStorage.setItem("fleet.pkdir", data.path); // next openPicker starts where you left off
  pkLists.replaceChildren();
  pkRows = [];
  pkSel = -1;
  pkFilter.value = "";
  let head: HTMLElement | null = null;
  const addHead = (t: string) => { head = el("div", "pkhead", t); pkLists.appendChild(head); };
  const addRow = (label: string, p: string, cls: string) => {
    const row = dirRow(label, p, cls);
    pkLists.appendChild(row);
    pkRows.push({ row, path: p, name: label.toLowerCase(), head });
  };
  if (data.recents.length) {
    addHead("Recent");
    for (const r of data.recents) addRow(r.replace(/^\/Users\/[^/]+/, "~"), r, "recent");
  }
  addHead("Places");
  for (const c of data.common) addRow(c.replace(/^\/Users\/[^/]+/, "~"), c, "place");
  addHead(`Folders in ${data.path}`);
  if (data.parent) addRow("..", data.parent, "up");
  for (const d of data.dirs) addRow(d, `${data.path}/${d}`.replace("//", "/"), "dir");
  if (!data.dirs.length) pkLists.appendChild(el("div", "pknone", "no subfolders"));
  return true;
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

const pkWorktreeBtn = $("pkworktree") as HTMLButtonElement;
pkWorktreeBtn.onclick = () => void startWorktree(pkPath.value);
async function startWorktree(repo: string) {
  if (!pickerSlot) return;
  const branch = prompt("Branch name for the new lane (blank = auto):", "") ?? undefined;
  if (branch === undefined) return; // cancelled
  const slot = pickerSlot;
  const res = await post(`/api/slots/${slot}/open-worktree`, { repo, branch });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    pkPath.classList.add("bad");
    setTimeout(() => pkPath.classList.remove("bad"), 1200);
    if (err.error) alert(`Lane failed: ${err.error}`);
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
  const last = localStorage.getItem("fleet.pkdir") ?? "~";
  void browse(last).then(async (ok) => {
    if (!ok && last !== "~") await browse("~"); // remembered dir may have been deleted
    // focusing an input on mobile would pop the keyboard over the folder list
    if (!isMobile()) pkFilter.focus();
  });
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
    // rows are keyed by slot id, not index — the sidebar only lists ACTIVE slots now
    const live = slotsEl.querySelector(`[data-slot="${s.id}"]`);
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
  // only active slots get a row — a single "+ new session" entry (lowest free slot)
  // replaces the old wall of empty placeholders
  for (const s of fleet) {
    if (!s.cwd) continue;
    const visible = panes.some((p) => p.slot === s.id);
    const isFocused = panes[focused]?.slot === s.id;
    const row = el("div", "slot" + (isFocused ? " current" : visible ? " shown" : "") + (s.worktree ? " lane" : ""));
    row.dataset.slot = String(s.id);
    row.appendChild(el("span", "n", s.id === 10 ? "0" : String(s.id)));
    {
      const lbl = el("span", "lbl", s.label ?? baseName(s.cwd));
      lbl.title = s.cwd;
      lbl.ondblclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      row.appendChild(lbl);
      if (autosList.some((a) => a.slot === s.id && a.enabled)) {
        const b = el("span", "autobadge", "⏱");
        b.title = "has scheduled prompts";
        row.appendChild(b);
      }
      if (s.git?.branch) {
        // lifecycle: editing (uncommitted) → ready (clean but commits to push/land) → clean.
        // for a lane this is exactly its land-readiness, so the color doubles as a "can I ⏏ yet"
        const state = s.git.dirty > 0 ? "editing" : s.git.ahead > 0 ? "ready" : "clean";
        if (s.worktree) row.appendChild(el("span", "lanechip", "⎇")); // lanes read as first-class
        const parts = [s.git.branch];
        if (s.git.dirty) parts.push(`•${s.git.dirty}`);
        if (s.git.ahead) parts.push(`↑${s.git.ahead}`);
        const bb = el("span", `branchbadge ${state}`, parts.join(" "));
        bb.title = `${s.git.branch} — ${s.git.dirty} uncommitted, ${s.git.ahead} to push, ${s.git.behind} behind`
          + (s.worktree ? `\nFleet lane (${state}). ± review · ⏏ land` : "");
        row.appendChild(bb);
      }
      // a lane's whole point is review-then-land, so its ± sits inline (not hover-hidden)
      if (s.worktree) {
        const dff = el("span", "lanediff", "±");
        dff.title = "review this lane's diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        row.appendChild(dff);
      }
      // green = live in a pane, or a background session that just produced output
      row.appendChild(el("span", "act" + (visible || serverNow - s.lastOutput < RECENT_MS ? " hot" : "")));
      const shr = el("span", "shr" + (s.share ? " on" : ""), "⤴");
      shr.title = s.share ? `shared — ${s.share.mode}` : "share session";
      shr.onclick = (e) => {
        e.stopPropagation();
        openShareDlg(s.id);
      };
      const exp = el("span", "exp", "⇩");
      exp.title = "export session — print / save as PDF";
      exp.onclick = (e) => {
        e.stopPropagation();
        window.open(`/api/slots/${s.id}/export`, "_blank");
      };
      const act = el("div", "slotact");
      if (s.git && !s.worktree) {
        // plain repo session: diff is available but secondary, so it stays in the hover row
        const dff = el("span", "diff", "±");
        dff.title = "review working diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        act.appendChild(dff);
      }
      const ren = el("span", "ren", "✎");
      ren.title = "rename session";
      ren.onclick = (e) => {
        e.stopPropagation();
        startRename(row, s);
      };
      if (s.worktree) {
        const land = el("span", "lane", "⏏");
        land.title = "land lane — remove the worktree (only if clean & pushed/merged)";
        land.onclick = async (e) => {
          e.stopPropagation();
          if (!confirm(`Land lane ${s.worktree!.branch}? Removes the worktree. Refused if it has uncommitted or unpushed work.`)) return;
          const res = await post(`/api/slots/${s.id}/land`, {});
          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as { error?: string };
            alert(`Not landed: ${err.error ?? "failed"}`);
            return;
          }
          for (const p of panes) if (p.slot === s.id) p.assign(0);
          await refresh();
        };
        act.appendChild(land);
      }
      const kill = el("span", "kill", "✕");
      kill.title = "kill session";
      kill.onclick = async (e) => {
        e.stopPropagation();
        const wtNote = s.worktree ? " The worktree is left on disk (use ⏏ to remove it)." : "";
        if (!confirm(`Kill session ${s.id} (${baseName(s.cwd!)})? The claude session and its history are gone.${wtNote}`)) return;
        await post(`/api/slots/${s.id}/kill`, {});
        for (const p of panes) if (p.slot === s.id) p.assign(0);
        await refresh();
      };
      act.prepend(shr);
      act.append(exp, ren, kill);
      row.appendChild(act);
      row.onclick = () => showSlot(s.id);
    }
    slotsEl.appendChild(row);
  }
  const free = fleet.find((s) => !s.cwd);
  if (free) {
    const row = el("div", "slot empty");
    row.appendChild(el("span", "n", "+"));
    row.appendChild(el("span", "lbl dim", "new session"));
    row.onclick = () => openPicker(free.id);
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

// --- stale-bundle self-heal: the server reports its current app.js version with every
// poll. A tab left open across a deploy keeps running OLD code (missing buttons read as
// "regression") — when the version moves, reload as soon as the tab is hidden so we never
// yank the page out from under active typing.
let bundleV = 0;
let reloadArmed = false;
function armReload() {
  if (reloadArmed) return;
  reloadArmed = true;
  if (document.hidden) { location.reload(); return; }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) location.reload();
  });
}

let chipCmds: string[] = [];
let lastRender = "";
async function refresh() {
  try {
    const res = await api("/api/sessions");
    if (!res.ok) return;
    const data = (await res.json()) as { now: number; chips: string[]; shareBase?: string; v?: number;
      autos?: AutoInfo[]; slots: SlotInfo[]; tasks?: TaskInfo[]; dispatch?: DispatchInfo; intake?: boolean };
    if (data.v) {
      if (!bundleV) bundleV = data.v;
      else if (data.v !== bundleV) armReload();
    }
    fleet = data.slots;
    autosList = data.autos ?? [];
    tasksList = data.tasks ?? [];
    dispatch = data.dispatch ?? { available: false, on: false, maxLanes: 0, repo: "" };
    intakeOn = data.intake ?? false;
    serverNow = data.now;
    shareBase = data.shareBase ?? "";
    chipCmds = data.chips;
    renderChips(data.chips);
    const pendingIntake = tasksList.some((t) => t.status === "pending" && t.source === "intake");
    $("queuebtn").classList.toggle("hot", pendingIntake);
    // skip the DOM rebuild when nothing visible changed — a full re-render kills hover state
    const key = JSON.stringify([focused, panes.map((p) => p.slot),
      autosList.filter((a) => a.enabled).map((a) => a.slot),
      data.slots.map((s) => [s.cwd, s.label, s.share?.id, s.share?.mode, serverNow - s.lastOutput < RECENT_MS,
        s.git?.branch, s.git?.dirty, s.git?.ahead, !!s.worktree])]);
    if (key !== lastRender) {
      lastRender = key;
      renderSlots();
    }
    renderQueue(); // no-op unless the queue overlay is open; keeps it live
    // keep an open share dialog honest (guest count, mode changed elsewhere) without
    // rebuilding it on every poll — rebuilds kill hover state and button focus
    if (dlgSlot && sharedlg.style.display === "flex") {
      const sh = fleet[dlgSlot - 1]?.share;
      const dk = sh ? `${sh.id}|${sh.mode}|${sh.guests}` : "none";
      if (dk !== dlgKey) {
        dlgKey = dk;
        renderShareDlg();
      }
    }
  } catch {
    // server briefly unreachable — WS dot already shows disconnect
  }
}
setInterval(() => void refresh(), 2000);

// --- share dialog: create/inspect/revoke the one share a slot can have ---
const sharedlg = $("sharedlg"), sharepanel = $("sharepanel");
let dlgSlot = 0;
let dlgMode: "view" | "interact" = "view";
let dlgKey = ""; // last-rendered share state — refresh() only re-renders the open dialog on change

function closeShareDlg() {
  sharedlg.style.display = "none";
  dlgSlot = 0;
}
sharedlg.addEventListener("click", (e) => {
  if (e.target === sharedlg) closeShareDlg();
});

// --- diff review overlay: what the agent actually changed in this slot's tree ---
const diffdlg = $("diffdlg"), diffpanel = $("diffpanel");
function closeDiffDlg() { diffdlg.style.display = "none"; }
diffdlg.addEventListener("click", (e) => { if (e.target === diffdlg) closeDiffDlg(); });

function renderDiffInto(target: HTMLElement, diff: string) {
  // colorize by line prefix — each line is its own textContent node, never innerHTML
  for (const line of diff.split("\n")) {
    const cls = line.startsWith("+") ? "add" : line.startsWith("-") ? "del"
      : (line.startsWith("@@") || line.startsWith("diff ")) ? "hdr" : "";
    const span = el("span", cls, line + "\n");
    target.appendChild(span);
  }
}

async function openDiff(slotId: number) {
  setDrawer(false);
  diffpanel.replaceChildren(el("h2", "", "Working diff"));
  diffdlg.style.display = "flex";
  const res = await api(`/api/slots/${slotId}/diff`);
  const data = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean; error?: string };
  if (data.error) { diffpanel.appendChild(el("div", "diffstat", data.error)); return; }
  const nChanged = data.status?.length ?? 0;
  diffpanel.appendChild(el("div", "diffstat",
    `${data.branch ?? "?"} · ${nChanged} file${nChanged === 1 ? "" : "s"} changed${data.truncated ? " · diff truncated" : ""}`));
  if (!data.diff) {
    diffpanel.appendChild(el("div", "diffstat", nChanged ? "(changes are untracked — no tracked diff)" : "clean working tree"));
    return;
  }
  const box = el("div", "difftxt");
  renderDiffInto(box, data.diff);
  diffpanel.appendChild(box);
}

// --- task queue overlay ---
const queuedlg = $("queuedlg"), queuepanel = $("queuepanel");
function closeQueueDlg() { queuedlg.style.display = "none"; }
queuedlg.addEventListener("click", (e) => { if (e.target === queuedlg) closeQueueDlg(); });
$("queuebtn").onclick = () => openQueue();

function renderQueue() {
  if (queuedlg.style.display !== "flex") return;
  queuepanel.replaceChildren(el("h2", "", intakeOn ? "Task queue · ✉ intake on" : "Task queue"));

  if (dispatch.available) {
    const drow = el("div", "diffstat");
    drow.textContent = `Dispatcher ${dispatch.on ? "ON" : "off"} · repo ${baseName(dispatch.repo)} · max ${dispatch.maxLanes} lanes — `;
    const toggle = el("button", "qbtn", dispatch.on ? "turn off" : "turn on") as HTMLButtonElement;
    toggle.onclick = async () => { await post("/api/dispatch", { on: !dispatch.on }); await refresh(); renderQueue(); };
    drow.appendChild(toggle);
    queuepanel.appendChild(drow);
  } else {
    queuepanel.appendChild(el("div", "diffstat", "Dispatcher unavailable (set FLEET_DISPATCH_REPO to auto-run queued tasks). Tasks are still tracked; send them by hand."));
  }

  const addWrap = el("div", "qadd");
  const addIn = el("textarea", "qaddin") as HTMLTextAreaElement;
  addIn.placeholder = "New task — describe a feature or fix…";
  addIn.rows = 2;
  const addBtn = el("button", "qbtn primary", "add") as HTMLButtonElement;
  addBtn.onclick = async () => {
    if (!addIn.value.trim()) return;
    await post("/api/tasks", { text: addIn.value, queue: false });
    addIn.value = "";
    await refresh();
    renderQueue();
  };
  addWrap.append(addIn, addBtn);
  queuepanel.appendChild(addWrap);
  // legend: the sidebar badges + lane lifecycle, explained once where the workflow lives
  queuepanel.appendChild(el("div", "qlegend",
    "flow: pending → queue ▸ → (dispatcher spawns a ⎇ lane, or send by hand) → ± review → ⏏ land.  "
    + "badge: •N uncommitted · ↑N to push · amber = editing · green = ready to land"));

  const order = { pending: 0, queued: 1, sent: 2, done: 3 };
  const sorted = [...tasksList].sort((a, b) => (order[a.status] - order[b.status]) || (b.created - a.created));
  if (!sorted.length) { queuepanel.appendChild(el("div", "diffstat", "no tasks yet")); return; }
  for (const t of sorted) {
    const row = el("div", `qrow ${t.status}`);
    const main = el("div", "qtext");
    const meta = el("div", "qmeta");
    meta.textContent = `${t.status}${t.slot ? ` · slot ${t.slot}` : ""}${t.note ? ` · ${t.note}` : ""} · `;
    if (t.source === "intake") {
      const tag = el("span", "qintake", `✉ ${t.from ?? "intake"}`);
      meta.appendChild(tag);
    } else meta.append("owner");
    main.appendChild(meta);
    main.appendChild(el("div", "", t.text));
    row.appendChild(main);
    const mkBtn = (label: string, action: string) => {
      const b = el("button", "qbtn", label) as HTMLButtonElement;
      b.onclick = async () => { await post(`/api/tasks/${t.id}/${action}`, {}); await refresh(); renderQueue(); };
      return b;
    };
    if (t.status === "pending") row.appendChild(mkBtn("queue ▸", "queue"));
    if (t.status === "queued") row.appendChild(mkBtn("hold", "unqueue"));
    if (t.status !== "done") row.appendChild(mkBtn("done", "done"));
    row.appendChild(mkBtn("✕", "delete"));
    queuepanel.appendChild(row);
  }
}

function openQueue() {
  setDrawer(false);
  queuedlg.style.display = "flex";
  renderQueue();
}

function copyLine(label: string, value: string): HTMLElement {
  const row = el("div", "shrline");
  row.appendChild(el("span", "k", label));
  const code = el("code", "", value);
  code.title = value;
  row.appendChild(code);
  const btn = el("button", "shrbtn", "copy") as HTMLButtonElement;
  btn.onclick = () => {
    copyText(value);
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = "copy"; }, 800);
  };
  row.appendChild(btn);
  return row;
}

function fmtSince(ts: number): string {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}m ago` : `${Math.floor(h / 24)}d ago`;
}

function renderShareDlg() {
  const s = fleet[dlgSlot - 1];
  if (!s?.cwd) { closeShareDlg(); return; }
  dlgKey = s.share ? `${s.share.id}|${s.share.mode}|${s.share.guests}` : "none";
  sharepanel.replaceChildren();
  sharepanel.appendChild(el("h2", "", `Share session — ${s.label ?? baseName(s.cwd)}`));
  const sh = s.share;
  if (sh) {
    const status = el("div", "shrline");
    status.appendChild(el("span", "k", "status"));
    const live = el("span", "shrlive" + (sh.guests > 0 ? " on" : ""),
      sh.guests > 0 ? `● ${sh.guests} guest${sh.guests === 1 ? "" : "s"} connected` : "○ no guest connected");
    status.appendChild(live);
    status.appendChild(el("span", "shrsince", `shared ${fmtSince(sh.created)}`));
    sharepanel.appendChild(status);
    sharepanel.appendChild(copyLine("link", `${shareBase || location.origin}/s/${sh.id}`));
    sharepanel.appendChild(copyLine("password", sh.password));
    // live mode switch: keeps link+password, kicks connected guests into a reload so
    // their UI matches; interact→view also cuts typing off server-side immediately
    const modeRow = el("div", "shrline");
    modeRow.appendChild(el("span", "k", "access"));
    const bView = el("button", `shrbtn${sh.mode === "view" ? " active" : ""}`, "view only") as HTMLButtonElement;
    const bInt = el("button", `shrbtn${sh.mode === "interact" ? " active" : ""}`, "interactive") as HTMLButtonElement;
    const setMode = async (m: "view" | "interact") => {
      if (m === sh.mode) return;
      if (m === "interact" && !confirm("Switch to interactive? Guests can then type straight into YOUR shell.")) return;
      await post(`/api/slots/${s.id}/share-mode`, { mode: m });
      await refresh();
      renderShareDlg();
    };
    bView.onclick = () => void setMode("view");
    bInt.onclick = () => void setMode("interact");
    modeRow.append(bView, bInt);
    sharepanel.appendChild(modeRow);
    sharepanel.appendChild(el("div", "shrhint", sh.mode === "interact"
      ? "Interactive — guests type into your real shell. Give link and password to your guest separately."
      : "View only — guests watch, nothing they type reaches the terminal. Give link and password separately."));
    const btns = el("div", "shrbtns");
    const rotate = el("button", "shrbtn", "new link + password") as HTMLButtonElement;
    rotate.onclick = async () => {
      if (!confirm("Replace this share? The old link and password stop working and connected guests are kicked.")) return;
      await post(`/api/slots/${s.id}/share`, { mode: sh.mode });
      await refresh();
      renderShareDlg();
    };
    const revoke = el("button", "shrbtn danger", "end live share") as HTMLButtonElement;
    revoke.onclick = async () => {
      if (!confirm("End this share? The link stops working and connected guests are kicked immediately.")) return;
      await post(`/api/slots/${s.id}/unshare`, {});
      await refresh();
      renderShareDlg();
    };
    const close = el("button", "shrbtn", "close") as HTMLButtonElement;
    close.onclick = closeShareDlg;
    btns.append(rotate, revoke, close);
    sharepanel.appendChild(btns);
  } else {
    const modeRow = el("div", "shrline");
    modeRow.appendChild(el("span", "k", "access"));
    const bView = el("button", `shrbtn${dlgMode === "view" ? " active" : ""}`, "view only") as HTMLButtonElement;
    const bInt = el("button", `shrbtn${dlgMode === "interact" ? " active" : ""}`, "interactive") as HTMLButtonElement;
    bView.onclick = () => { dlgMode = "view"; renderShareDlg(); };
    bInt.onclick = () => { dlgMode = "interact"; renderShareDlg(); };
    modeRow.append(bView, bInt);
    sharepanel.appendChild(modeRow);
    sharepanel.appendChild(el("div", "shrhint", dlgMode === "interact"
      ? "Interactive guests type straight into this terminal — it is YOUR shell. Only share with someone you're actively working with."
      : "View-only guests see the live terminal but can't type or send anything."));
    const btns = el("div", "shrbtns");
    const create = el("button", "shrbtn primary", "create share link") as HTMLButtonElement;
    create.onclick = async () => {
      const res = await post(`/api/slots/${s.id}/share`, { mode: dlgMode });
      if (!res.ok) return;
      await refresh();
      renderShareDlg(); // now renders the link + generated password
    };
    const close = el("button", "shrbtn", "cancel") as HTMLButtonElement;
    close.onclick = closeShareDlg;
    btns.append(create, close);
    sharepanel.appendChild(btns);
  }
}

function openShareDlg(slotId: number) {
  setDrawer(false);
  dlgSlot = slotId;
  dlgMode = fleet[slotId - 1]?.share?.mode ?? "view";
  renderShareDlg();
  sharedlg.style.display = "flex";
}

// --- scheduled prompts (⏱): compose text + "once in N min" or "every N min × K runs".
// Guard rails live server-side (idle gate, claude-alive gate, mandatory runs cap) —
// this dialog is just the window onto them.
const autodlg = $("autodlg"), autopanel = $("autopanel");
let autoSlot = 0;
let autoMode: "once" | "every" = "once";

function closeAutoDlg() {
  autodlg.style.display = "none";
  autoSlot = 0;
}
autodlg.addEventListener("click", (e) => {
  if (e.target === autodlg) closeAutoDlg();
});

function autoDesc(a: AutoInfo): string {
  if (a.everySec) return `every ${Math.round(a.everySec / 60)}m · ${a.runsLeft} left`;
  const dueIn = Math.max(0, Math.round((a.nextAt - Date.now()) / 60000));
  return a.enabled ? `once, in ~${dueIn}m` : "once";
}

function renderAutoDlg() {
  const s = fleet[autoSlot - 1];
  if (!s?.cwd) { closeAutoDlg(); return; }
  autopanel.replaceChildren();
  autopanel.appendChild(el("h2", "", `Scheduled prompts — ${s.label ?? baseName(s.cwd)}`));
  const mine = autosList.filter((a) => a.slot === autoSlot);
  if (!mine.length) autopanel.appendChild(el("div", "shrhint", "No schedules for this session."));
  for (const a of mine) {
    const row = el("div", `autorow${a.enabled ? "" : " off"}`);
    const txt = el("span", "autotext", a.text);
    txt.title = a.text;
    row.appendChild(txt);
    row.appendChild(el("span", "autometa", autoDesc(a)));
    if (a.lastResult) row.appendChild(el("span", `autometa${a.lastResult.startsWith("skipped") ? " err" : ""}`, a.lastResult));
    const tog = el("span", "autobtnx", a.enabled ? "⏸" : "▶");
    tog.title = a.enabled ? "pause" : "resume";
    tog.onclick = async () => { await post(`/api/autos/${a.id}/toggle`, {}); await refresh(); renderAutoDlg(); };
    const del = el("span", "autobtnx", "✕");
    del.title = "delete schedule";
    del.onclick = async () => { await post(`/api/autos/${a.id}/delete`, {}); await refresh(); renderAutoDlg(); };
    row.append(tog, del);
    autopanel.appendChild(row);
  }
  const form = el("div", "autoform");
  const preview = el("div", `autopreview${ta.value.trim() ? "" : " empty"}`,
    ta.value.trim() || "Type the prompt into the compose box first — it becomes the scheduled text.");
  form.appendChild(preview);
  const modeRow = el("div", "frow");
  const bOnce = el("button", `shrbtn${autoMode === "once" ? " active" : ""}`, "once") as HTMLButtonElement;
  const bEvery = el("button", `shrbtn${autoMode === "every" ? " active" : ""}`, "recurring") as HTMLButtonElement;
  bOnce.onclick = () => { autoMode = "once"; renderAutoDlg(); };
  bEvery.onclick = () => { autoMode = "every"; renderAutoDlg(); };
  modeRow.append(bOnce, bEvery);
  form.appendChild(modeRow);
  const numRow = el("div", "frow");
  const mins = document.createElement("input");
  mins.type = "number"; mins.min = "1"; mins.max = "1440"; mins.value = autoMode === "once" ? "5" : "30";
  numRow.append(el("span", "", autoMode === "once" ? "in" : "every"), mins, el("span", "", "min"));
  const runs = document.createElement("input");
  runs.type = "number"; runs.min = "1"; runs.max = "100"; runs.value = "5";
  if (autoMode === "every") numRow.append(el("span", "", "· max"), runs, el("span", "", "runs"));
  form.appendChild(numRow);
  const idleRow = el("div", "frow");
  const idle = document.createElement("input");
  idle.type = "checkbox"; idle.checked = true;
  const idleLabel = document.createElement("label");
  idleLabel.append(idle, el("span", "", "only send when the session has been quiet for 60s"));
  idleRow.appendChild(idleLabel);
  form.appendChild(idleRow);
  const btns = el("div", "shrbtns");
  const create = el("button", "shrbtn primary", "schedule") as HTMLButtonElement;
  create.onclick = async () => {
    const text = ta.value.trim();
    if (!text) { renderAutoDlg(); return; }
    const m = Math.max(1, Number(mins.value) | 0);
    const body = autoMode === "once"
      ? { text, inSec: m * 60, idleSec: idle.checked ? 60 : 0 }
      : { text, everySec: m * 60, runs: Math.max(1, Number(runs.value) | 0), idleSec: idle.checked ? 60 : 0 };
    const res = await post(`/api/slots/${autoSlot}/autos`, body);
    if (res.ok) {
      ta.value = "";
      updateChips();
      await refresh();
      renderAutoDlg();
    }
  };
  const close = el("button", "shrbtn", "close") as HTMLButtonElement;
  close.onclick = closeAutoDlg;
  btns.append(create, close);
  form.appendChild(btns);
  autopanel.appendChild(form);
}

$("autobtn").onclick = () => {
  const slot = panes[focused]?.slot;
  if (!slot) return;
  setDrawer(false);
  autoSlot = slot;
  renderAutoDlg();
  autodlg.style.display = "flex";
};

// --- prompt history: composed sends recorded server-side per slot; recalled via the
// 🕘 popover or ArrowUp/ArrowDown cycling in an (empty) compose box ---
const hist = $("hist"), histList = $("histlist"), histTitle = $("histtitle");
interface HistEntry { text: string; ts: number }

async function fetchHistory(slot: number): Promise<HistEntry[]> {
  const res = await api(`/api/slots/${slot}/history`);
  if (!res.ok) return [];
  const data = (await res.json()) as { history?: HistEntry[] };
  return data.history ?? [];
}

function fmtTs(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

function closeHist() {
  hist.style.display = "none";
}
hist.addEventListener("click", (e) => {
  if (e.target === hist) closeHist();
});

async function openHist() {
  const slot = panes[focused]?.slot;
  if (!slot) return;
  const items = await fetchHistory(slot);
  histTitle.textContent = `Prompt history — slot ${slot === 10 ? 0 : slot}`;
  histList.replaceChildren();
  if (!items.length) histList.appendChild(el("div", "histnone", "nothing sent to this session yet"));
  for (const h of [...items].reverse()) {
    const row = el("div", "histrow");
    row.append(el("div", "histtext", h.text), el("span", "histts", fmtTs(h.ts)));
    const copy = el("span", "histcopy", "⧉");
    copy.title = "copy prompt";
    copy.onclick = (e) => {
      e.stopPropagation();
      copyText(h.text);
      copy.textContent = "✓";
      setTimeout(() => { copy.textContent = "⧉"; }, 800);
    };
    row.appendChild(copy);
    // click loads the prompt into the compose box for editing — it never auto-sends
    row.onclick = () => {
      ta.value = h.text;
      updateChips();
      closeHist();
      ta.focus();
    };
    histList.appendChild(row);
  }
  hist.style.display = "flex";
}
$("histbtn").onclick = () => void openHist();

// ArrowUp in an empty box starts cycling (newest first); ArrowDown walks back toward
// the draft. Typing anything ends the cycle so an edit can't be clobbered.
let cyc: { slot: number; items: string[]; idx: number; draft: string } | null = null;
async function cycleHist(dir: number) {
  const slot = panes[focused]?.slot;
  if (!slot) return;
  if (!cyc || cyc.slot !== slot) {
    const items = (await fetchHistory(slot)).map((h) => h.text);
    if (!items.length) return;
    cyc = { slot, items, idx: items.length, draft: ta.value };
  }
  const next = cyc.idx + dir;
  if (next < 0 || next > cyc.items.length) return;
  cyc.idx = next;
  ta.value = next === cyc.items.length ? cyc.draft : cyc.items[next];
  ta.selectionStart = ta.selectionEnd = ta.value.length;
  updateChips();
}

// --- compose box: Enter sends (bracketed paste + Enter server-side), Shift+Enter = newline ---
function flashSendError() {
  send.style.background = "#f85149";
  setTimeout(() => { send.style.background = ""; }, 1200);
}
async function doSend() {
  const pane = panes[focused];
  const text = ta.value.trim();
  const slot = pane?.slot;
  if (!text || !slot || send.disabled) return;
  send.disabled = true;
  try {
    const res = await post("/send", { slot, text, submit: true });
    if (!res.ok) throw new Error(`send failed: ${res.status}`);
    ta.value = "";
    cyc = null;
    updateChips();
    pane.term.scrollToBottom();
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
    return;
  }
  if (e.isComposing) return;
  // only hijack ArrowUp when the box is empty or already cycling — mid-text it must
  // keep its native "move the caret up a line" meaning
  if (e.key === "ArrowUp" && (cyc || ta.value === "")) {
    e.preventDefault();
    void cycleHist(-1);
  } else if (e.key === "ArrowDown" && cyc) {
    e.preventDefault();
    void cycleHist(1);
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
ta.addEventListener("input", () => {
  cyc = null; // real typing (not our programmatic recall) ends a history cycle
  updateChips();
});

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

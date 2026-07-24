import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";
import qrcode from "qrcode-generator";
import { mdInto } from "./md";

const $ = (id: string) => document.getElementById(id)!;
const slotsEl = $("slots"), dot = $("dot"),
  ta = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement,
  gate = $("gate"), gateIn = $("gatein") as HTMLInputElement,
  picker = $("picker"), pkTitle = $("pktitle"), pkPath = $("pkpath") as HTMLInputElement,
  pkLists = $("pklists"), pkCrumb = $("pkcrumb"), chipsEl = $("chips"), panesEl = $("panes");

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
$("refresh").onclick = () => panes[focused]?.reconnect(); // mobile header (no per-pane controls there)

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
interface ShareInfo { id: string; mode: "view" | "interact"; password: string; created: number; guests: number; comments: number }
interface AutoInfo {
  id: string; slot: number; text: string; everySec: number | null; nextAt: number;
  runsLeft: number; idleSec: number; enabled: boolean; lastRun: number; lastResult: string | null;
}
interface GitInfo { branch: string; dirty: number; ahead: number; behind: number }
interface WorktreeInfo { repo: string; branch: string }
interface SlotInfo { id: number; cwd: string | null; label: string | null; lastOutput: number;
  share?: ShareInfo | null; git?: GitInfo | null; worktree?: WorktreeInfo | null; mergePending?: boolean }
interface TaskInfo { id: string; text: string; source: "owner" | "intake" | "steward"; from: string | null;
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
// meta = a harness-injected user turn (task-notification): shown folded, not as a "you" bubble
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[]; meta?: boolean }

// markdown rendering shared with the guest reader — see src/md.ts

const fmtClock = (ts: string | null) =>
  ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

// --- panes: each visible terminal owns its Terminal, WS, and resize state ---
class Pane {
  slot = 0; // 0 = unassigned
  private gen = 0; // bump to suppress a stale socket's reconnect loop
  private pinPending = false; // pin the viewport to the bottom once the next seed lands
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
  private readonly reloadBtn: HTMLButtonElement;
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
    this.boardBtn.title = "session brief — commits, changes, prompts, 📋 summary";
    this.boardBtn.style.display = "none";
    this.boardBtn.classList.toggle("active", boardOpen);
    this.boardBtn.onclick = (e) => {
      e.stopPropagation();
      focusPane(this.index);
      setBoard(!boardOpen);
    };
    // reload sits left of the ℹ/💬 cluster — forces THIS pane to reconnect + reseed
    // scrollback (moved here from the sidebar so it acts on the pane you're looking at)
    this.reloadBtn = el("button", "panereload", "↻") as HTMLButtonElement;
    this.reloadBtn.title = "reload this session (reconnect + reseed scrollback)";
    this.reloadBtn.style.display = "none";
    this.reloadBtn.onclick = (e) => { e.stopPropagation(); this.reconnect(); };
    const navUp = el("button", "promptnav up", "↑") as HTMLButtonElement;
    navUp.title = "previous prompt of yours";
    navUp.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(-1); };
    const navDn = el("button", "promptnav dn", "↓") as HTMLButtonElement;
    navDn.title = "next prompt of yours";
    navDn.onclick = (e) => { e.stopPropagation(); this.jumpPrompt(1); };
    this.root.append(termEl, this.chatEl, this.hint, this.jump, this.viewBtn, this.boardBtn, this.reloadBtn, navUp, navDn);
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
    this.notifGroup = null;
    // un-stick the busy flag so the reassigned pane's next pollChat() isn't blocked; the
    // old slot's in-flight fetch bails on the slot-identity guard in pollChat.
    this.chatBusy = false;
  }

  // --- conversation rendering: the view exists so YOUR messages are findable.
  // They render as prominent anchors; everything the agent did between two texts
  // collapses into one expandable "⚙ n steps" line instead of a wall of rows. ---
  private toolGroup: { det: HTMLElement; sum: HTMLElement; body: HTMLElement; count: number;
    lastStep: HTMLElement | null } | null = null;
  // task-notifications between two of your messages fold into one collapsed accordion —
  // hidden by default, expandable to read — instead of masquerading as your bubbles
  private notifGroup: { sum: HTMLElement; body: HTMLElement; count: number } | null = null;

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

  // harness task-notifications: collapsed by default under "🔔 n task notification(s)".
  // Consecutive ones share a group; any real message/step below closes the run.
  private addNotif(e: TEntry) {
    this.toolGroup = null;
    if (!this.notifGroup) {
      const det = document.createElement("details");
      det.className = "notifgroup";
      const sum = document.createElement("summary");
      const body = el("div", "ngbody");
      det.append(sum, body);
      this.chatEl.appendChild(det);
      this.notifGroup = { sum, body, count: 0 };
    }
    const g = this.notifGroup;
    const text = e.blocks.map((b) => b.text).join("\n");
    const item = el("div", "nitem");
    const status = /<status>([^<]*)<\/status>/.exec(text)?.[1] ?? "update";
    item.appendChild(el("div", "nihead", `${status}${e.ts ? ` · ${fmtClock(e.ts)}` : ""}`));
    item.appendChild(el("pre", "nibody", text));
    g.body.appendChild(item);
    g.count++;
    g.sum.textContent = `🔔 ${g.count} task notification${g.count === 1 ? "" : "s"}`;
  }

  private appendEntry(e: TEntry) {
    if (e.meta) { this.addNotif(e); return; }
    this.notifGroup = null; // a real entry ends the notification run
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
    // capture the slot this fetch belongs to: assign()→resetChat() can reassign the pane
    // mid-fetch, and the old slot's entries must NOT append under the new slot's header.
    const slot = this.slot;
    this.chatBusy = true;
    try {
      const res = await api(`/api/slots/${slot}/transcript?after=${this.chatTotal}`);
      if (this.slot !== slot) return; // reassigned during the fetch — this response is stale
      if (!res.ok) return;
      const data = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
      if (this.slot !== slot) return; // reassigned during json() — still stale
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
      // only the poll that still owns the current slot manages busy/timer state; a stale
      // (reassigned) poll must not reset the new slot's chatBusy or reschedule its timer.
      if (this.slot === slot) {
        this.chatBusy = false;
        if (this.view === "chat") {
          clearTimeout(this.chatTimer);
          this.chatTimer = setTimeout(() => void this.pollChat(), 1000);
        }
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
    ws.onmessage = (e) => {
      // the seed (scrollback capture or raw-tail replay) is always the first frame the
      // server sends on open. Once it's parsed, the buffer sits at ydisp===ybase, but
      // xterm's DOM viewport can be parked at row 0 — its Viewport refresh multiplies
      // ydisp by a rowHeight that is 0 until the pane element is measured/visible, so a
      // refresh that lands a frame too early leaves scrollTop=0 ("stuck at the top").
      // Re-pin once the seed is written; the write callback runs after the buffer settles.
      const pin = this.pinPending;
      this.pinPending = false;
      this.term.write(new Uint8Array(e.data as ArrayBuffer), pin ? () => this.pinToBottom() : undefined);
    };
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
    this.reloadBtn.style.display = slot ? "block" : "none";
    if (slot && this.view === "chat") void this.pollChat();
    this.hint.style.display = slot ? "none" : "flex";
    // size the terminal to its container before connecting — the WS URL carries
    // this size, and connecting at a stale default (e.g. 80x24) would seed scrollback
    // at the wrong width and force an immediate second reseed once refit() catches up
    if (slot) { this.fit.fit(); this.pinPending = true; this.connect(); }
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
    this.pinPending = true;
    this.connect(true);
  }

  // called from the seed's write callback (see connect()). The buffer is already at
  // ydisp===ybase, so term.scrollToBottom() would early-return without re-syncing the
  // DOM viewport (scrollLines(0) fires no scroll event). Nudge one line off the bottom
  // and back on the next frame — by then the pane is laid out, so the second scroll's
  // refresh computes a correct rowHeight and parks scrollTop at the real bottom.
  private pinToBottom() {
    requestAnimationFrame(() => {
      const b = this.term.buffer.active;
      if (b.baseY === 0) return; // single screen, nothing above to be stuck on
      if (b.viewportY !== b.baseY) { this.term.scrollToBottom(); return; }
      this.term.scrollLines(-1);
      this.term.scrollToBottom();
    });
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
interface BriefInfo { branch: string | null; worktree: WorktreeInfo | null; sessionStart: number | null;
  uncommitted: number; uncommittedFiles: string[]; files: string[]; shortstat: string;
  commits: BriefCommit[]; laneScoped: boolean; laneBase: string | null; ahead: number; behind: number;
  gitOp?: boolean }
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
// lane map + ⏫ merge agent (async job on the server; the board's 3s poll carries state)
interface WtRisk { dirtyFiles: string[]; unpushedCommits: { hash: string; subject: string }[];
  shortstat: string | null; empty: boolean }
interface WtRow extends WtRisk { path: string; branch: string; slot: number | null; dirty: number; ahead: number; behind: number; note?: string | null }
interface WtInfo { repo: string; main: string; worktrees: WtRow[] }
// 💾 lane commit in flight, per slot — carries the MODE so the button can label itself
// ("… saving" vs "… writing message") while the request runs.
const commitBusy = new Map<number, "quick" | "agent">();
// the server's deterministic verify verdict against the rebased tree (mirrors server.ts
// `interface MergeLast`'s `verify`). Absent = "unverified" (no FLEET_VERIFY_CMD result on
// record) — never render absence as green. `stale` is set at confirm-land when main moved
// past the `mainSha` the verify ran against (the verdict is void once main moves past it).
type VerifyVerdict = { cmd: string; ok: boolean; out: string; at: number; mainSha: string; stale?: boolean };
interface MergeState { running: boolean;
  last: { status: "merged" | "blocked" | "error" | "resolved"; detail: string; landed: boolean;
    branch: string; at: number; conflicted?: string[]; verify?: VerifyVerdict } | null;
  // the repo's most recent still-undoable land (null if none) — drives the ↩ undo button
  undoable?: { branch: string; at: number } | null }
// slots with a merge job the client kicked off or observed — when such a slot goes
// inactive (job landed the lane), its panes must be released like a manual ⏏ does
const mergeWatch = new Set<number>();

// synchronous in-flight guards: the server serializes too, but a double-click must not
// even fire the second request (the response to it would just say "running"/"reserved")
const mergePending = new Set<number>();
let laneReqBusy = false;
// ☠ discard confirm state — module-level because the board fully re-renders on a 3s poll:
// the panel (and its read-first countdown) must survive re-renders, so each render derives
// it from here instead of holding DOM state. `at` anchors the 4s gate to the FIRST click.
let discardArm: { path: string; at: number } | null = null;
const DISCARD_READ_MS = 4000;
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && discardArm) { discardArm = null; void renderBoard(); }
});

// shared risk-preview panel: shows the ACTUAL file names / commit subjects a destructive
// action is about to touch, before the click — not only after a refusal (the server always
// re-verifies via worktreeRisk regardless of what this shows; this is purely informational).
function showRiskPreview(title: string, risk: WtRisk, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", title));
    if (risk.empty) {
      panel.appendChild(el("div", "riskempty", "safe — no uncommitted changes, no unpushed commits"));
    } else {
      if (risk.dirtyFiles.length) {
        panel.appendChild(el("div", "riskhead",
          `${risk.dirtyFiles.length} uncommitted file${risk.dirtyFiles.length === 1 ? "" : "s"}`));
        const list = el("div", "risklist");
        for (const f of risk.dirtyFiles.slice(0, 40)) list.appendChild(el("div", "riskfile", f));
        if (risk.dirtyFiles.length > 40) list.appendChild(el("div", "riskmore", `… ${risk.dirtyFiles.length - 40} more`));
        panel.appendChild(list);
      }
      if (risk.unpushedCommits.length) {
        panel.appendChild(el("div", "riskhead",
          `${risk.unpushedCommits.length} unpushed commit${risk.unpushedCommits.length === 1 ? "" : "s"}`));
        const list = el("div", "risklist");
        for (const c of risk.unpushedCommits.slice(0, 40)) list.appendChild(el("div", "riskcommit", `${c.hash} ${c.subject}`));
        panel.appendChild(list);
      }
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn danger", confirmLabel) as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); finish(false); }
    };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    // capture-phase so Escape closes THIS overlay before the global discardArm handler sees it
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}
// fail CLOSED: if the risk fetch itself fails, never claim "empty/safe" — show it as a
// single unverifiable "file" so the preview still reads as "don't assume, go check"
const UNKNOWN_RISK: WtRisk = { dirtyFiles: ["(could not verify — check manually before proceeding)"], unpushedCommits: [], shortstat: null, empty: false };
async function fetchSlotRisk(slotId: number): Promise<WtRisk> {
  try {
    const r = await api(`/api/slots/${slotId}/risk`);
    if (!r.ok) return UNKNOWN_RISK;
    return (await r.json()) as WtRisk;
  } catch {
    return UNKNOWN_RISK;
  }
}

// unified land action — the row used to offer three glyphs for this (⏫ agent merge&land,
// ⏏ plain land, ⏬ confirm-land-after-review) that were really the same intent seen from
// three server paths. One click, one confirm, backed by the real risk preview (not just
// text): try the fast direct path first (lane already clean & pushed/merged — /land removes
// the worktree with no agent involved), and only fall through to the merge agent (/merge —
// rebases onto main, resolves conflicts if any, then either lands automatically or pauses
// for review) when the fast path refuses. Server-side semantics of both endpoints are
// untouched; this only decides which one the UI calls first.
async function doLand(slot: number) {
  if (mergePending.has(slot)) return;
  const s = fleet[slot - 1];
  if (!s?.worktree) return;
  mergePending.add(slot); // reserve BEFORE the preview await, else a double-click opens two overlays
  try {
    // one-gesture land: a dirty tree is committed FIRST (reusing the 💾 commit machinery — the
    // same local, never-pushed, reversible commit), then landed. The owner no longer pre-commits.
    // Unpushed commits are the land's payload, not a risk — shown in the diff review below.
    const risk = await fetchSlotRisk(slot);
    if (risk.dirtyFiles.length) {
      const ok = await showRiskPreview(`Land lane ${s.worktree.branch}? — your uncommitted work is committed first, then landed`, risk, "commit + land");
      if (!ok) return;
      const cr = await post(`/api/slots/${slot}/commit`, { mode: "agent" });
      const cj = (await cr.json().catch(() => ({}))) as { committed?: boolean; reason?: string; error?: string };
      if (!cr.ok) { alert(`Land failed — could not commit the work first: ${cj.error ?? cr.status}`); return; }
      // commit refused for an UNSAFE tree (a half-finished git op, or a detached HEAD) → never
      // finalize that into a land. A benign "nothing to commit" (a race) falls through to land.
      if (!cj.committed && /in progress|detached/i.test(cj.reason ?? "")) { alert(`Cannot land: ${cj.reason}`); return; }
    }
    // always review the diff that will land, even on a clean auto-land (the old blind spot).
    // surface the deterministic verify verdict (if the server has one for THIS branch) so a
    // red/stale tree is flagged before the glance-approval — informs, never disables (F-A.3).
    const mgv = await api(`/api/slots/${slot}/merge`)
      .then(async (r) => (r.ok ? ((await r.json()) as MergeState) : null))
      .catch(() => null);
    const verify = mgv && !mgv.running && mgv.last && mgv.last.branch === s.worktree.branch
      ? mgv.last.verify : undefined;
    const proceed = await showLandReview(`Land ${s.worktree.branch} → main — review what lands`, slot, verify);
    if (!proceed) return;
    const direct = await post(`/api/slots/${slot}/land`, {});
    if (direct.ok) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
      return;
    }
    const r = await post(`/api/slots/${slot}/merge`, {});
    const j = (await r.json().catch(() => ({}))) as
      { running?: boolean; status?: string; landed?: boolean; detail?: string; error?: string };
    if (!r.ok) { alert(`Land failed: ${j.error ?? r.status}`); return; }
    if (j.running) { mergeWatch.add(slot); return; }
    // immediate verdicts (dirty lane/primary, already-merged) come back synchronously
    if (j.status === "blocked") alert(`Land blocked: ${j.detail ?? ""}`);
    else if (j.status === "merged" && j.landed) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
    }
  } catch {
    alert("Land failed — network error");
  } finally {
    mergePending.delete(slot);
    void renderBoard();
  }
}

// confirm-land after reviewing an agent conflict resolution: the server ff-merges the
// already-rebased lane onto main and lands — no agent, purely git-verified
async function doMergeLand(slot: number) {
  if (mergePending.has(slot)) return;
  mergePending.add(slot);
  try {
    const r = await post(`/api/slots/${slot}/merge`, { confirm: true });
    const j = (await r.json().catch(() => ({}))) as
      { status?: string; landed?: boolean; detail?: string; error?: string };
    if (!r.ok) { alert(`Land failed: ${j.error ?? r.status}`); return; }
    if (j.status === "merged" && j.landed) {
      for (const p of panes) if (p.slot === slot) p.assign(0);
      await refresh();
    } else if (j.status === "blocked" || j.status === "error") {
      alert(`Not landed: ${j.detail ?? j.status}`);
    }
  } catch {
    alert("Land failed — network error");
  } finally {
    mergePending.delete(slot);
    void renderBoard();
  }
}

// ⇲ shelve — set a lane aside WITH a note ("what's left"), instead of landing it. The server
// records the note (keyed by worktree path) and kills the slot; the worktree stays on disk as an
// orphan, now resumable WITH context. The safe third exit beside land — no work lost, no
// destruction. The note shows on the lanes list and clears when the lane is reopened.
async function doShelve(slot: number) {
  const s = fleet[slot - 1];
  if (!s?.worktree) return;
  const note = prompt("Shelve this lane — what's left to do? (shown when you resume it)");
  if (note === null) return; // cancelled
  const r = await post(`/api/slots/${slot}/shelve`, { note });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    alert(j.error ?? "shelve failed");
    return;
  }
  for (const p of panes) if (p.slot === slot) p.assign(0);
  await refresh();
}

// ↩ undo the last land on a repo — reset main back to where the land found it. The server
// decides with git (only if main hasn't moved since and the commit is on no remote) and
// refuses safely otherwise. The landed branch survives, so the work is recoverable either way.
async function doUndoLand(repo: string, branch: string): Promise<void> {
  if (!confirm(`Undo the last land (${branch}) — reset main back to before it? The '${branch}' branch is kept, so the work stays recoverable.`)) return;
  const r = await post("/api/repos/undo-land", { repo });
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; note?: string; error?: string };
  if (!r.ok) { alert(j.error ?? "undo failed"); await refresh(); return; }
  alert(j.note ?? "main reset to before the last land");
  await refresh();
}

// 💾 save a lane's uncommitted work — the gap land/merge (dirty-tree refusers) leave open.
// quick = deterministic wip commit; agent = a short-lived agent writes a conventional-commit
// message (falls back to wip). Commit-only, reversible; the server never pushes or lands.
async function doCommit(slot: number, mode: "quick" | "agent", activeConfirmed = false): Promise<void> {
  if (commitBusy.has(slot)) return;
  // reserve synchronously BEFORE the confirmMidRun await (mirrors doLand's mergePending
  // fix) — else two near-simultaneous triggers both pass the has() check and double-commit.
  commitBusy.set(slot, mode);
  void renderBoard(); // reflect the disabled/"… writing message" state immediately
  try {
    // the session is still producing output → confirm before snapshotting a half-finished tree.
    // main sessions already warn inside their staging preview, so they pass activeConfirmed.
    if (!activeConfirmed && sessionActive(slot) && !(await confirmMidRun(slot))) return;
    const r = await post(`/api/slots/${slot}/commit`, { mode });
    const j = (await r.json().catch(() => ({}))) as
      { committed?: boolean; hash?: string; subject?: string; reason?: string; error?: string };
    if (!r.ok) alert(`Commit failed: ${j.error ?? r.status}`);
    else if (j.committed) alert(`committed ${j.hash} — ${j.subject}`);
    else alert(j.reason ?? "nothing to commit");
  } catch {
    alert("Commit failed — network error");
  } finally {
    commitBusy.delete(slot);
    await refresh();
    void renderBoard();
  }
}

// "working" = the pane produced real output within RECENT_MS — the same signal as the sidebar
// activity dot. For Claude Code this tracks the working spinner, so it reads true while the agent
// runs and false once it's back at the prompt. It's a heuristic (a silently-running command reads
// idle; a just-finished run reads active for a few seconds), so it GATES WITH A CONFIRM, never a
// hard block — and a commit is reversible anyway.
function sessionActive(slot: number): boolean {
  const s = fleet[slot - 1];
  return !!s && s.cwd !== null && serverNow - s.lastOutput < RECENT_MS;
}

// mid-run guard for the commit action: the session is producing output, so a commit now would
// snapshot a half-finished tree. Confirm, don't forbid — sometimes you DO want to save before
// killing a stuck run.
function confirmMidRun(slot: number): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", `Slot ${slot} is still working`));
    panel.appendChild(el("div", "bmidrun",
      "This session produced output a moment ago — it may be mid-edit. Committing now snapshots a half-finished "
      + "tree, and an agent message would describe that partial state. It's reversible (git reset), but usually "
      + "you want to let the run finish first."));
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "wait") as HTMLButtonElement;
    const go = el("button", "riskbtn danger", "commit anyway") as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

// commit for a MAIN (non-lane) session: preview exactly what `git add -u` will stage
// (tracked changes) and which untracked files are left alone, THEN commit. The server
// re-derives everything; this preview is the guardrail that makes a commit onto a shipped
// branch as transparent as a lane commit onto a throwaway one.
function showCommitPreview(title: string, tracked: string[], untracked: string[], active: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel");
    panel.appendChild(el("h2", "", title));
    if (active) panel.appendChild(el("div", "bmidrun",
      "⚠ this session is still working — you may be committing a half-finished snapshot."));
    panel.appendChild(el("div", "riskhead", `${tracked.length} tracked file${tracked.length === 1 ? "" : "s"} → committed (git add -u)`));
    const tl = el("div", "risklist");
    for (const f of tracked.slice(0, 40)) tl.appendChild(el("div", "riskfile", f));
    if (tracked.length > 40) tl.appendChild(el("div", "riskmore", `… ${tracked.length - 40} more`));
    panel.appendChild(tl);
    if (untracked.length) {
      panel.appendChild(el("div", "riskhead skip", `${untracked.length} untracked file${untracked.length === 1 ? "" : "s"} → left alone`));
      const ul = el("div", "risklist");
      for (const f of untracked.slice(0, 20)) ul.appendChild(el("div", "riskfile skip", f.slice(3)));
      if (untracked.length > 20) ul.appendChild(el("div", "riskmore", `… ${untracked.length - 20} more`));
      panel.appendChild(ul);
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn", "commit") as HTMLButtonElement; // reversible → not styled destructive
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    btns.append(cancel, go);
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

// pre-land review: show the diff that will land on main (main...HEAD, three-dot) BEFORE it
// lands. Closes the gap where a conflict-free rebase auto-landed with no diff ever shown —
// "textually clean" isn't "semantically correct", so the owner gets one look before it merges.
// the one deterministic land signal made visible (F-A.3): did the rebased tree pass verify.
// Four states, informational only — a red or stale badge NEVER disables land (owner latitude
// stands; confirm-land deliberately does not block on red verify). Absence reads "unverified",
// never a silent green.
function verifyBadge(v: VerifyVerdict | undefined): HTMLElement {
  if (!v) {
    const b = el("span", "vbadge none", "unverified");
    b.title = "no FLEET_VERIFY_CMD result on record for this rebased tree — the tree was not deterministically verified";
    return b;
  }
  if (!v.ok) {
    const b = el("span", "vbadge bad", "verify ✗");
    b.title = `verify failed: ${v.cmd} — click to view output`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
    return b;
  }
  if (v.stale) {
    const b = el("span", "vbadge stale", "verify ⚠ stale");
    b.title = `passed \`${v.cmd}\`, but against an older main (verdict void once main moves past it) — re-verify or land at your discretion`;
    return b;
  }
  const b = el("span", "vbadge ok", "verify ✓");
  b.title = `passed \`${v.cmd}\` against the rebased tree`;
  return b;
}

// tail of a failing verify's captured output — reachable from the red badge, so the owner
// can see WHY verify failed before exercising land latitude.
function showVerifyOutput(v: VerifyVerdict): void {
  const overlay = el("div", "overlay riskoverlay");
  overlay.style.display = "flex";
  const panel = el("div", "panel riskpanel");
  panel.appendChild(el("h2", "", "verify ✗ — output"));
  panel.appendChild(el("div", "diffstat err", `${v.cmd} · exit non-zero`));
  const box = el("div", "difftxt");
  box.textContent = v.out || "(no output captured)";
  panel.appendChild(box);
  const btns = el("div", "riskbtns");
  const close = el("button", "riskbtn", "close") as HTMLButtonElement;
  const finish = () => { document.removeEventListener("keydown", onKey, true); overlay.remove(); };
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(); } };
  document.addEventListener("keydown", onKey, true);
  close.onclick = finish;
  overlay.onclick = (e) => { if (e.target === overlay) finish(); };
  btns.append(close);
  panel.appendChild(btns);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

async function showLandReview(title: string, slot: number, verify?: VerifyVerdict): Promise<boolean> {
  // fail CLOSED: a dropped fetch or non-JSON/non-200 body must NEVER read as a clean empty
  // diff — that path renders "just cleans up" with ⏏ enabled and lands agent-resolved
  // conflicts with zero human eyes. Same posture as fetchSlotRisk's UNKNOWN_RISK.
  const data = await api(`/api/slots/${slot}/merge-diff`)
    .then(async (r) => (r.ok ? await r.json() : { loadFailed: true }))
    .catch(() => ({ loadFailed: true })) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean; error?: string; loadFailed?: boolean };
  return new Promise((resolve) => {
    const overlay = el("div", "overlay riskoverlay");
    overlay.style.display = "flex";
    const panel = el("div", "panel riskpanel landreviewpanel");
    panel.appendChild(el("h2", "", title));
    panel.appendChild(el("div", "landhint",
      "This is the merge preview — everything that will land on main (main…HEAD). Committing does NOT clear it; only landing does. A clean worktree with commits ahead is exactly what a ready-to-land lane looks like."));
    if (data.loadFailed) {
      panel.appendChild(el("div", "diffstat err",
        "couldn't load the merge preview — landing is disabled until it loads. Retry, or check the connection."));
    } else if (data.error) {
      panel.appendChild(el("div", "diffstat", data.error));
    } else {
      const n = data.files?.length ?? 0;
      const stat = el("div", "diffstat",
        `${data.branch ?? "?"} → ${data.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${data.truncated ? " · diff truncated" : ""} `);
      stat.appendChild(verifyBadge(verify));
      panel.appendChild(stat);
      if (data.diff) { const box = el("div", "difftxt"); renderDiffInto(box, data.diff); panel.appendChild(box); }
      else panel.appendChild(el("div", "diffstat", "no committed changes to land — landing just cleans up the worktree"));
    }
    const btns = el("div", "riskbtns");
    const cancel = el("button", "riskbtn", "cancel") as HTMLButtonElement;
    const go = el("button", "riskbtn", "⏏ land") as HTMLButtonElement;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); finish(false); } };
    const finish = (ok: boolean) => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(ok); };
    document.addEventListener("keydown", onKey, true);
    cancel.onclick = () => finish(false);
    go.onclick = () => finish(true);
    overlay.onclick = (e) => { if (e.target === overlay) finish(false); };
    if (data.loadFailed) {
      go.disabled = true; // fail closed — no land gesture without a diff that actually loaded
      const retry = el("button", "riskbtn", "retry") as HTMLButtonElement;
      retry.onclick = () => { document.removeEventListener("keydown", onKey, true); overlay.remove(); resolve(showLandReview(title, slot, verify)); };
      btns.append(cancel, retry, go);
    } else {
      btns.append(cancel, go);
    }
    panel.appendChild(btns);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  });
}

async function doCommitMain(slot: number, mode: "quick" | "agent", files: string[]): Promise<void> {
  if (commitBusy.has(slot)) return;
  const tracked = files.filter((f) => !f.startsWith("??"));
  const untracked = files.filter((f) => f.startsWith("??"));
  if (!tracked.length) {
    alert("Only untracked files here — nothing tracked to commit. A main-session commit stages tracked changes only (git add -u); add the files in the terminal first if you want them in.");
    return;
  }
  const ok = await showCommitPreview(`Commit ${tracked.length} tracked file${tracked.length === 1 ? "" : "s"} in ${baseName(fleet[slot - 1]?.cwd ?? "")}?`, tracked, untracked, sessionActive(slot));
  if (ok) await doCommit(slot, mode, true); // the preview already carried the mid-run warning
}

async function newLane(repo: string, slot?: number): Promise<void> {
  if (laneReqBusy) return;
  laneReqBusy = true;
  try {
    // with a target slot (the ⎇+ chip on an empty row) the lane opens THERE;
    // without one (the board button) the server picks the first free slot
    const r = slot
      ? await post(`/api/slots/${slot}/open-worktree`, { repo, branch: "" })
      : await post("/api/lanes", { repo });
    const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
    if (!r.ok) { alert(`Lane failed: ${j.error ?? "?"}`); return; }
    await refresh();
    const target = slot ?? j.slot;
    if (target) showSlot(target);
  } finally {
    laneReqBusy = false;
  }
}

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

let boardAgain = false;
async function renderBoard() {
  // a render requested while one is in flight (e.g. focus moved mid-fetch) must not be
  // dropped — remember it and re-run once the current pass finishes
  if (boardBusy) { boardAgain = true; return; }
  if (!boardOpen || isMobile()) return;
  boardBusy = true;
  try {
    const slot = panes[focused]?.slot;
    const s = slot ? fleet[slot - 1] : undefined;
    if (!slot || !s?.cwd) {
      boardBody.replaceChildren(el("div", "bempty", "no session in the focused pane"));
      return;
    }
    const [briefRes, prompts, wtRes, mgRes] = await Promise.all([
      api(`/api/slots/${slot}/brief`), pollOutline(slot),
      s.git ? api(`/api/slots/${slot}/worktrees`) : Promise.resolve(null),
      s.worktree ? api(`/api/slots/${slot}/merge`) : Promise.resolve(null),
    ]);
    const brief = briefRes.ok ? ((await briefRes.json()) as BriefInfo) : null;
    const wts = wtRes?.ok ? ((await wtRes.json()) as WtInfo) : null;
    const mg = mgRes?.ok ? ((await mgRes.json()) as MergeState) : null;
    if (mg?.running) mergeWatch.add(slot);
    const nodes: HTMLElement[] = [];
    // the right board tells ONE story — the lane lifecycle: IDENTITY → WORK → LAND →
    // AGENTS → LANES → OUTLINE. Every function of the old flat list is kept, only regrouped.

    // 1 — IDENTITY: which lane this is, how to reach it, session-level actions
    const idsec = el("div", "bsec");
    idsec.appendChild(el("h3", "", "identity"));
    idsec.appendChild(el("div", "bidhead", `slot ${slot} · ${s.label ?? baseName(s.cwd)}`));
    if (brief?.branch) {
      const b = el("div", "bstate");
      b.appendChild(el("span", "bbranch", brief.branch));
      b.appendChild(document.createTextNode(brief.worktree ? " · fleet lane" : " · repo session"));
      // live working/idle state — the same signal as the sidebar dot, so you can see BEFORE
      // reaching for commit whether the session is mid-run (re-rendered every 3s)
      const working = sessionActive(slot);
      b.appendChild(el("span", "bwork" + (working ? " on" : ""), working ? " · ● working" : " · ○ idle"));
      idsec.appendChild(b);
      if (brief.sessionStart) idsec.appendChild(el("div", "bidmeta",
        `session since ${new Date(brief.sessionStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`));
      // one-click copy of the worktree path — the one thing you need when you do reach for
      // a terminal in a lane, and it's long and buried otherwise
      if (brief.worktree && s.cwd) {
        const cwd = s.cwd;
        const cp = el("button", "bbtn subtle", "⧉ copy worktree path") as HTMLButtonElement;
        cp.onclick = () => { copyText(cwd); cp.textContent = "✓ copied"; setTimeout(() => { cp.textContent = "⧉ copy worktree path"; }, 1200); };
        idsec.appendChild(cp);
      }
    }
    // session-level actions — labeled controls (were hover-only glyphs unreachable on touch)
    {
      const arow = el("div", "bbtnrow");
      const shrb = el("button", "bbtn" + (s.share ? " on" : ""),
        s.share ? `⤴ shared — ${s.share.mode}` : "⤴ share") as HTMLButtonElement;
      shrb.onclick = () => openShareDlg(slot);
      const expb = el("button", "bbtn", "⇩ export") as HTMLButtonElement;
      expb.title = "export session — print / save as PDF";
      expb.onclick = () => window.open(`/api/slots/${slot}/export`, "_blank");
      const renb = el("button", "bbtn", "✎ rename") as HTMLButtonElement;
      renb.onclick = () => {
        const row = slotsEl.querySelector(`[data-slot="${slot}"]`);
        if (row instanceof HTMLElement) startRename(row, s);
      };
      arow.append(shrb, expb, renb);
      idsec.appendChild(arow);
    }
    nodes.push(idsec);

    if (brief) {
      // for a lane, ahead/behind are vs the base branch (from the brief); for a non-lane
      // session, vs the upstream (from the sessions-poll gitInfo)
      const ahead = brief.laneScoped ? brief.ahead : (s.git?.ahead ?? 0);
      const behind = brief.laneScoped ? brief.behind : (s.git?.behind ?? 0);

      // 2 — WORK: the heart. Uncommitted state + the SAVE buttons, then this lane's commits
      // and its committed footprint. The commit action fills the gap land/merge leave open.
      const work = el("div", "bsec");
      work.appendChild(el("h3", "", "work"));
      // an interrupted rebase/merge (e.g. a deploy that killed the server mid-land) wedges
      // commit + land here — surface it as an explicit, fixable state, not a silent refusal
      if (brief.gitOp) {
        const warn = el("div", "bgitop",
          "⚠ a git merge/rebase is in progress — finish or abort it in this session's terminal (git rebase --abort / git merge --abort), then retry. Commit & land are blocked until then.");
        work.appendChild(warn);
      }
      if (brief.uncommitted) {
        const wl = el("div", "bstate");
        wl.appendChild(el("span", "editing",
          `${brief.uncommitted} uncommitted file${brief.uncommitted === 1 ? "" : "s"}`));
        work.appendChild(wl);
        // the concrete uncommitted work — exactly what git status shows, with its codes
        if (brief.uncommittedFiles.length) {
          const uf = el("div", "bunc");
          for (const f of brief.uncommittedFiles.slice(0, 40)) {
            // porcelain XY: X = staged (index) column, Y = worktree (unstaged) column
            const x = f[0] ?? " ", y = f[1] ?? " ";
            const row = el("div", "buncf");
            // untracked → new; anything staged (X set, not '?') → staged; else unstaged-only → mod
            const cls = f.startsWith("??") ? "new" : x !== " " ? "staged" : "mod";
            const badge = el("span", `buncst ${cls}`, f.startsWith("??") ? "?" : f.slice(0, 2).trim() || "M");
            badge.title = x !== " " && y !== " " ? "staged + unstaged changes"
              : x !== " " ? "staged" : f.startsWith("??") ? "untracked" : "unstaged changes";
            row.appendChild(badge);
            row.appendChild(document.createTextNode(f.slice(3)));
            row.title = `${f} — click to review the diff`;
            row.onclick = () => void openDiff(slot);
            uf.appendChild(row);
          }
          if (brief.uncommittedFiles.length > 40)
            uf.appendChild(el("div", "bempty", `… ${brief.uncommittedFiles.length - 40} more`));
          work.appendChild(uf);
        }
        // the SAVE — lanes only. land/merge refuse a dirty tree; this commits so a kill can't
        // lose the work. quick = deterministic wip; agent = an agent writes the message.
        if (brief.worktree) {
          const busy = commitBusy.get(slot);
          const crow = el("div", "bbtnrow");
          // ONE commit here — the safety net: instant wip commit so a kill can't lose the
          // work (saved locally, never pushed/landed, reversible with git reset). The
          // agent-written-message path moved to land time — ⏏ land now commits-if-dirty
          // with an agent message — so there's no separate "✎ message" affordance on a lane.
          const q = el("button", "bbtn amber", busy === "quick" ? "… saving" : "commit") as HTMLButtonElement;
          q.disabled = !!busy; // also disabled mid-land, while doLand's commit-if-dirty runs (busy === "agent")
          q.title = "commit all uncommitted work now so a kill can't lose it — saved locally, never pushed or landed (undo with git reset)";
          q.onclick = () => void doCommit(slot, "quick");
          crow.append(q);
          work.appendChild(crow);
        } else {
          // main (non-lane) session: commit TRACKED changes (add -u) with a staging preview,
          // so the owner sees exactly what lands on a branch they ship and that untracked
          // files are left alone. Reversible (git reset); the server never pushes.
          const busy = commitBusy.get(slot);
          const files = brief.uncommittedFiles;
          const crow = el("div", "bbtnrow");
          // same one-action-plus-refinement as a lane. On a MAIN checkout the preview shows
          // that only tracked changes (git add -u) are staged — untracked files are left
          // alone. No separate diff button here: the file rows above are already click-to-diff.
          const q = el("button", "bbtn amber", busy === "quick" ? "… saving" : "commit") as HTMLButtonElement;
          q.disabled = !!busy;
          q.title = "stage & commit tracked changes only (git add -u); untracked files left alone — undo with git reset. Shows a preview first.";
          q.onclick = () => void doCommitMain(slot, "quick", files);
          const a = el("button", "bbtn amber ghost", busy === "agent" ? "… writing message" : "✎ message") as HTMLButtonElement;
          a.disabled = !!busy;
          a.title = "same commit, but a short-lived agent writes a conventional-commit message from the staged diff first";
          a.onclick = () => void doCommitMain(slot, "agent", files);
          crow.append(q, a);
          work.appendChild(crow);
        }
      } else if (ahead) {
        work.appendChild(el("div", "bnote ready",
          `${ahead} commit${ahead === 1 ? "" : "s"} ready to ${brief.worktree ? "land ↓" : "push"}`));
      } else {
        work.appendChild(el("div", "bnote", "working tree clean — nothing to save"));
        if (!brief.worktree) {
          const db = el("button", "bbtn", "± view diff") as HTMLButtonElement;
          db.onclick = () => void openDiff(slot);
          work.appendChild(db);
        }
      }
      if (behind && brief.laneScoped)
        work.appendChild(el("div", "bnote", `↓${behind} behind ${brief.laneBase ?? "main"}`));
      // this lane's commits vs its base (or the session's commits for a non-lane)
      work.appendChild(el("div", "bsubhead", brief.laneScoped ? `commits on this lane (vs ${brief.laneBase ?? "main"})`
        : brief.sessionStart ? "commits this session" : "recent commits"));
      if (!brief.commits.length) work.appendChild(el("div", "bempty",
        brief.laneScoped ? `no commits yet — even with ${brief.laneBase ?? "main"}` : "no commits this session yet"));
      for (const cm of brief.commits) {
        const row = el("div", "brow");
        row.appendChild(el("span", "bhash", cm.hash));
        const sub = el("span", "bsub", cm.subject);
        sub.title = cm.subject;
        row.appendChild(sub);
        work.appendChild(row);
      }
      // the committed footprint — what this lane/session changes vs its base
      if (brief.files.length) {
        work.appendChild(el("div", "bsubhead", brief.laneScoped ? `files changed vs ${brief.laneBase ?? "main"}`
          : brief.sessionStart ? "changed this session" : "changed files"));
        if (brief.shortstat) work.appendChild(el("div", "bstate", brief.shortstat));
        for (const f of brief.files.slice(0, 30)) {
          const row = el("div", "bfile");
          row.appendChild(el("span", "bfst", f.slice(0, 2).trim() || "·"));
          row.appendChild(document.createTextNode(f.slice(3)));
          row.title = `${f} — click to review the diff`;
          row.onclick = () => void openDiff(slot);
          work.appendChild(row);
        }
        if (brief.files.length > 30) work.appendChild(el("div", "bempty", `… ${brief.files.length - 30} more`));
      }
      nodes.push(work);

      // 3 — LAND: the lane's endgame (lanes only). ± view diff + ONE land action whose label
      // carries the auto-vs-review-needed distinction as text. doLand tries the direct /land
      // path, then falls back to the /merge agent — the UI is collapsed to one control.
      if (brief.worktree) {
        const land = el("div", "bsec");
        land.appendChild(el("h3", "", "land"));
        const l = !mg?.running && mg?.last && mg.last.branch === brief.worktree.branch ? mg.last : null;
        const awaitingReview = l?.status === "resolved";
        // no standalone "± view diff" here: it opened the same working diff (openDiff) already
        // reachable by clicking a file row in WORK — a second button for an identical source.
        // The working diff lives on the file rows (one consistent affordance); the resolved
        // main..HEAD diff lives on the review note's "± review diff" below. Two sources, not
        // three competing buttons — so each land state shows one obvious review control.
        // one land verb on screen at a time. Normally this IS the land. In the review state
        // the note owns "⏏ land", so this becomes the distinct "re-run" action (only needed
        // if main moved) — never a second, competing land button. Green = "ready to land".
        const lb = el("button", "bbtn" + (ahead && !mg?.running && !awaitingReview ? " green" : ""),
          mg?.running ? "… landing" : awaitingReview ? "↻ re-run merge" : "⏏ land lane") as HTMLButtonElement;
        lb.disabled = !!mg?.running;
        lb.title = awaitingReview
          ? "re-run the merge from scratch — only needed if main moved since these conflicts were resolved"
          : "already-merged lanes land immediately; otherwise this rebases onto main and lands "
            + "automatically — on conflicts a background agent resolves them and pauses for your review "
            + "before anything reaches main";
        lb.onclick = () => void doLand(slot);
        land.appendChild(lb);
        // ⇲ shelve — the safe third exit beside land: set aside WITH a note, keep the worktree.
        const shb = el("button", "bbtn", "⇲ shelve") as HTMLButtonElement;
        shb.disabled = !!mg?.running;
        shb.title = "set this lane aside with a note (what's left) — kills the slot, keeps the worktree to resume later; nothing lost, nothing destroyed";
        shb.onclick = () => void doShelve(slot);
        land.appendChild(shb);
        // ↩ undo last land — only when the server still holds an undoable land for THIS repo
        // (main not moved since, not pushed). Reverses the one action that mutates main.
        if (mg?.undoable && brief.worktree.repo) {
          const ub = el("button", "bbtn", `↩ undo last land (${mg.undoable.branch.replace(/^fleet\//, "")})`) as HTMLButtonElement;
          ub.disabled = !!mg?.running;
          ub.title = "reset main back to before the last land in this repo — refuses if main moved since or the commit was pushed; the landed branch is kept, so the work is recoverable either way";
          const repo = brief.worktree.repo;
          const landedBranch = mg.undoable.branch;
          ub.onclick = () => void doUndoLand(repo, landedBranch);
          land.appendChild(ub);
        }
        if (awaitingReview && l) {
          // the agent resolved conflicts and the server verified the rebase — the owner
          // reviews the diff and lands. This is the one place a human eye is required.
          const n = l.conflicted?.length ?? 0;
          const note = el("div", "bmergenote review");
          const hd = el("div", "bmergehd",
            `conflicts resolved${n ? ` in ${n} file${n === 1 ? "" : "s"}` : ""} — review, then land `);
          hd.appendChild(verifyBadge(l.verify));
          note.appendChild(hd);
          if (l.conflicted?.length) note.appendChild(el("div", "bmergefiles", l.conflicted.join(", ")));
          note.appendChild(el("div", "bmergedetail", l.detail));
          const acts = el("div", "bmergeacts");
          const rev = el("button", "bmergereview", "± review diff") as HTMLButtonElement;
          rev.onclick = () => void openMergeDiff(slot);
          const landb = el("button", "bmergeland", "⏏ land") as HTMLButtonElement;
          landb.onclick = () => void doMergeLand(slot);
          acts.append(rev, landb);
          note.appendChild(acts);
          land.appendChild(note);
        } else if (l) {
          const cls = l.status === "merged" && l.landed ? "ok" : l.status === "blocked" ? "warn" : "err";
          const vn = el("div", `bmergenote ${cls}`,
            `${l.status === "merged" ? (l.landed ? "merged + landed" : "merged, NOT landed") : l.status}: ${l.detail} `);
          vn.appendChild(verifyBadge(l.verify));
          land.appendChild(vn);
        }
        nodes.push(land);
      }

      // 4 — AGENTS: advisory, read-only. ✨ summarize.
      // recover a server-cached summary once per slot (GET never spawns the agent)
      if (!sumCache.has(slot)) {
        sumCache.set(slot, {});
        void api(`/api/slots/${slot}/summary`).then(async (r) => {
          if (!r.ok) return;
          const j = (await r.json()) as SummaryInfo;
          if (j.summary) { sumCache.set(slot, j); void renderBoard(); }
        }).catch(() => { /* transient — the button still works */ });
      }
      const asec = el("div", "bsec");
      asec.appendChild(el("h3", "", "agents"));
      asec.appendChild(el("div", "bagenthint", "advisory · read-only — these never change your files"));
      const sum = sumCache.get(slot);
      const sbtn = el("button", "bbtn accent",
        sumBusy.has(slot) ? "… summarizing" : sum?.summary ? "📋 re-summarize" : "📋 summarize") as HTMLButtonElement;
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
      asec.appendChild(sbtn);
      if (sum?.summary) {
        // visible aging: the summary is pinned to the git state it was computed on
        const c0 = brief.commits[0];
        const stale = (!!sum.head && !!c0 && !sum.head.startsWith(c0.hash)) || sum.dirty !== brief.uncommitted;
        if (stale) asec.appendChild(el("div", "bstale", "⚠ computed for an older state — re-run to refresh"));
        asec.appendChild(el("div", "bsum", sum.summary));
        if (sum.openThreads?.length) {
          asec.appendChild(el("div", "bsumhead", "open threads"));
          for (const t of sum.openThreads) asec.appendChild(el("div", "bsumrow", `· ${t}`));
        }
        if (sum.verification) asec.appendChild(el("div", "bsumver", `verified: ${sum.verification}`));
        if (sum.model && sum.at)
          asec.appendChild(el("div", "bsummeta", `${sum.model} · ${new Date(sum.at).toLocaleTimeString()}`));
      } else if (sum?.error) {
        asec.appendChild(el("div", "bsumerr", sum.error));
      }
      nodes.push(asec);

      // 5 — LANES: the repo's lane map — every open worktree, who holds it, its state, and
      // the orphans (killed slot, worktree still on disk) with reattach/remove/discard +
      // ＋ new lane.
      if (wts) {
        const sec = el("div", "bsec");
        const hd = el("div", "bwthead");
        hd.appendChild(el("h3", "", `lanes — ${baseName(wts.repo)} · main: ${wts.main}`));
        sec.appendChild(hd);
        if (!wts.worktrees.length) sec.appendChild(el("div", "bempty", "no open lanes in this repo"));
        for (const w of wts.worktrees) {
          const row = el("div", "bwt");
          row.appendChild(el("span", "lanechip", "⎇"));
          const b = el("span", "bwtbr", w.branch);
          b.title = w.path;
          row.appendChild(b);
          const state = w.dirty ? "editing" : w.ahead ? "ready" : "clean";
          const parts: string[] = [];
          if (w.dirty) parts.push(`•${w.dirty}`);
          if (w.ahead) parts.push(`↑${w.ahead}`);
          if (w.behind) parts.push(`↓${w.behind}`);
          const stateEl = el("span", `bwtstate ${state}`, parts.join(" ") || "=");
          stateEl.title = [
            w.dirty ? `${w.dirty} uncommitted file${w.dirty === 1 ? "" : "s"}` : "working tree clean",
            w.ahead ? `${w.ahead} commit${w.ahead === 1 ? "" : "s"} ahead of ${wts.main}` : "",
            w.behind ? `${w.behind} behind ${wts.main}` : "",
          ].filter(Boolean).join(" · ");
          row.appendChild(stateEl);
          if (w.slot != null) {
            const here = w.slot === slot;
            const chip = el("button", "bwtact", here ? "this slot" : `slot ${w.slot}`) as HTMLButtonElement;
            chip.disabled = here;
            if (!here) {
              const target = w.slot;
              chip.onclick = () => showSlot(target);
            }
            row.appendChild(chip);
          } else {
            const open = el("button", "bwtact", "open") as HTMLButtonElement;
            open.title = "no session holds this worktree — reopen it in a free slot (reviewable/landable again)";
            open.onclick = async () => {
              if (laneReqBusy) return;
              laneReqBusy = true;
              try {
                const r = await post("/api/lanes", { repo: wts.repo, attach: w.path });
                const j = (await r.json().catch(() => ({}))) as { slot?: number; error?: string };
                if (!r.ok) { alert(j.error ?? "open failed"); return; }
                await refresh();
                if (j.slot) showSlot(j.slot);
              } finally {
                laneReqBusy = false;
              }
            };
            row.appendChild(open);
            // one "close" affordance: git state (w.empty) picks the safe default — a clean
            // lane is removed after a light confirm; a lane with unsaved/unmerged work opens
            // the deliberate discard read-window below (destruction stays gated exactly as
            // before). "open" above is the separate, opposite intent (reattach to KEEP it).
            const close = el("button", "bwtact del", "close") as HTMLButtonElement;
            close.title = w.empty
              ? "close this lane — clean worktree, nothing to lose (removes it)"
              : "close this lane — it has unsaved/unmerged work: opens the discard read-window (destroys it). Reattach with ‘open’ to keep it.";
            close.onclick = async () => {
              if (w.empty) {
                const ok = await showRiskPreview(`Close lane ${w.branch}? — clean worktree, nothing to lose`, w, "close");
                if (!ok) return;
                const r = await post("/api/worktrees/remove", { repo: wts.repo, path: w.path });
                if (!r.ok) {
                  const j = (await r.json().catch(() => ({}))) as { error?: string };
                  alert(j.error ?? "close failed");
                }
                void renderBoard();
              } else {
                discardArm = { path: w.path, at: Date.now() }; // deliberate destruction gate (read-window below)
                void renderBoard();
              }
            };
            row.appendChild(close);
          }
          sec.appendChild(row);
          // shelve note: this orphan was set aside with "what's left" — show it so resuming has
          // context (cleared server-side when the lane is reopened, removed, or discarded)
          if (w.note != null) {
            const nrow = el("div", "sweepv shelved");
            nrow.appendChild(el("span", "sweepvbadge", "⇲ shelved"));
            nrow.appendChild(el("span", "sweepvreason", w.note || "(no note)"));
            sec.appendChild(nrow);
          }
          // the confirm panel is not a dialog: the consequences ARE the wait screen. The
          // destructive button unlocks only after the read window, counted from the first
          // click and re-derived on every 3s board re-render, so polling can't reset or
          // skip the gate. Stale arms (>60s) auto-cancel — a forgotten panel must not
          // sit primed forever.
          if (w.slot == null && discardArm?.path === w.path) {
            if (Date.now() - discardArm.at > 60_000) { discardArm = null; continue; }
            const arm = discardArm;
            const box = el("div", "bdiscard");
            box.appendChild(el("div", "bdtitle", `discard ${w.branch}?`));
            if (w.empty) {
              box.appendChild(el("div", "riskempty", "safe — no uncommitted changes, no unpushed commits"));
            } else {
              if (w.dirtyFiles.length) {
                box.appendChild(el("div", "bdline", `${w.dirtyFiles.length} uncommitted file${w.dirtyFiles.length === 1 ? "" : "s"} — DESTROYED, no undo:`));
                for (const f of w.dirtyFiles.slice(0, 15)) box.appendChild(el("div", "riskfile", f));
              } else {
                box.appendChild(el("div", "bdline", "working tree clean — nothing uncommitted to lose"));
              }
              if (w.unpushedCommits.length) {
                box.appendChild(el("div", "bdline", `${w.unpushedCommits.length} unmerged commit${w.unpushedCommits.length === 1 ? "" : "s"} — branch deleted; the undo line appears after:`));
                for (const c of w.unpushedCommits.slice(0, 15)) box.appendChild(el("div", "riskcommit", `${c.hash} ${c.subject}`));
              } else {
                box.appendChild(el("div", "bdline", `no commits beyond ${wts.main} — branch deleted`));
              }
            }
            const cancel = el("button", "bwtact", "cancel") as HTMLButtonElement;
            cancel.onclick = () => { discardArm = null; void renderBoard(); };
            const go = el("button", "bwtact del", "") as HTMLButtonElement;
            const tick = () => {
              const left = Math.ceil((arm.at + DISCARD_READ_MS - Date.now()) / 1000);
              go.disabled = left > 0;
              go.textContent = left > 0 ? `read the above … ${left}` : "☠ discard forever";
            };
            tick();
            const iv = setInterval(() => { if (go.isConnected) tick(); else clearInterval(iv); }, 250);
            go.onclick = async () => {
              if (go.disabled) return;
              go.disabled = true;
              const r = await post("/api/worktrees/discard", { repo: wts.repo, path: w.path, branch: w.branch });
              const j = (await r.json().catch(() => ({}))) as
                { error?: string; branch?: string; head?: string | null };
              discardArm = null;
              if (!r.ok) alert(j.error ?? "discard failed");
              else if (j.head) alert(j.branch === "(detached)"
                ? `lane discarded.\nRecover until git gc from sha:\n  ${j.head}`
                : `lane discarded.\nUndo until git gc:\n  git branch ${j.branch} ${j.head}`);
              void renderBoard();
            };
            const btns = el("div", "bdbtns");
            btns.append(cancel, go);
            box.appendChild(btns);
            sec.appendChild(box);
          }
        }
        const nb = el("button", "bbtn accent", "＋ ⎇ new lane") as HTMLButtonElement;
        nb.title = `fresh worktree lane off ${wts.main}, session opens in the first free slot — one click`;
        nb.onclick = () => { nb.disabled = true; void newLane(wts.repo); };
        sec.appendChild(nb);
        nodes.push(sec);
      }
    }
    // 6 — OUTLINE: prompt-jump navigation, kept at the bottom (lowest priority)
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
    // the focus moved to another pane while we were fetching — this render describes
    // the wrong slot; drop it (the re-run below paints the right one)
    if (panes[focused]?.slot !== slot) { boardAgain = true; return; }
    // rebuild in place but keep the reading position
    const y = boardBody.scrollTop;
    boardBody.replaceChildren(...nodes);
    boardBody.scrollTop = y;
  } finally {
    boardBusy = false;
    if (boardAgain) {
      boardAgain = false;
      void renderBoard();
    }
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
  ta.placeholder = slot ? `Prompt for slot ${slot}…${hint}` : "Prompt… (no session in focused pane)";
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

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (picker.style.display === "flex") closePicker();
    if (hist.style.display === "flex") closeHist();
    if (sharedlg.style.display === "flex") closeShareDlg();
    if (autodlg.style.display === "flex") closeAutoDlg();
    if (diffdlg.style.display === "flex") closeDiffDlg();
    if (queuedlg.style.display === "flex") closeQueueDlg();
    if (audit.style.display === "flex") closeAudit();
    setDrawer(false);
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
const pkHideWt = $("pkhidewt") as HTMLButtonElement;
interface PkRow { row: HTMLElement; path: string; name: string; head: HTMLElement | null; wt: boolean }
let pkRows: PkRow[] = [];
let pkSel = -1;
let pkPins = new Set<string>(); // pinned paths, refreshed from /api/dirs on every browse()
// worktree lanes clutter the picker (recents are mostly `*.worktrees/fleet-*`); hide them by
// default. View-only pref, per device — kept in localStorage like the board/histall toggles.
let hideWorktrees = localStorage.getItem("fleet.hidewt") !== "0";
// a path is a lane if it lives under (or is) a `.worktrees` dir — reliable, no false positives
function isWtPath(p: string): boolean { return /\.worktrees(\/|$)/.test(p); }

// a row is out when the worktree toggle hides it (pkwt) OR the text filter excludes it (pkhide)
function pkVisible(): PkRow[] {
  return pkRows.filter((r) => !r.row.classList.contains("pkhide") && !r.row.classList.contains("pkwt"));
}

// mark/unmark worktree rows, refresh section counts to match, then re-run the text filter
function applyWtHide() {
  for (const r of pkRows) r.row.classList.toggle("pkwt", hideWorktrees && r.wt);
  // section count badges show how many rows survive the toggle (so RECENT 4→2 signals what it did).
  // the "Up to …" parent row is navigation, not a folder in this dir — exclude it from the count.
  const counts = new Map<HTMLElement, number>();
  for (const r of pkRows) {
    if (!r.head || r.row.classList.contains("up")) continue;
    counts.set(r.head, (counts.get(r.head) ?? 0) + (r.row.classList.contains("pkwt") ? 0 : 1));
  }
  for (const [head, n] of counts) { const b = head.querySelector(".pkheadn"); if (b) b.textContent = String(n); }
  applyPkFilter();
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
    // a row counts toward its section head only if it survives BOTH the query and the wt toggle
    const shown = hit && !r.row.classList.contains("pkwt");
    if (r.head) headHits.set(r.head, (headHits.get(r.head) ?? 0) + (shown ? 1 : 0));
  }
  for (const [head, n] of headHits) head.classList.toggle("pkhide", n === 0);
  setPkSel(q ? 0 : -1); // filtering pre-selects the best match so Enter just works
}

function pkKeyNav(e: KeyboardEvent): boolean {
  if (e.key === "ArrowDown") { setPkSel(pkSel + 1); return true; }
  if (e.key === "ArrowUp") { setPkSel(pkSel - 1); return true; }
  if (e.key === "Home") { setPkSel(0); return true; }
  if (e.key === "End") { setPkSel(pkVisible().length - 1); return true; }
  return false;
}
// ⌘/Ctrl+D pins or unpins the selected row — bookmark convention, never pollutes filter text
function pkPinKey(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || (e.key !== "d" && e.key !== "D")) return false;
  const target = pkSel >= 0 ? pkVisible()[pkSel] : undefined;
  if (target) void togglePin(target.path);
  return true;
}
pkFilter.addEventListener("input", applyPkFilter);
pkFilter.addEventListener("keydown", (e) => {
  if (pkPinKey(e)) { e.preventDefault(); return; }
  if (pkKeyNav(e)) { e.preventDefault(); return; }
  if (e.key !== "Enter") return;
  e.preventDefault();
  const target = pkSel >= 0 ? pkVisible()[pkSel] : undefined;
  if (e.metaKey || e.ctrlKey) void startSession(target?.path ?? pkPath.value);
  else if (target) void browse(target.path);
});
function renderHideWtBtn() {
  pkHideWt.textContent = "⎇ hide lanes";
  pkHideWt.classList.toggle("on", hideWorktrees);
  pkHideWt.title = hideWorktrees ? "worktree lanes hidden — click to show them" : "click to hide worktree lanes";
}
pkHideWt.onclick = () => {
  hideWorktrees = !hideWorktrees;
  localStorage.setItem("fleet.hidewt", hideWorktrees ? "1" : "0");
  renderHideWtBtn();
  applyWtHide();
};
pkPath.addEventListener("keydown", (e) => {
  if (pkKeyNav(e)) { e.preventDefault(); return; }
  if (e.key !== "Enter") return;
  if (e.metaKey || e.ctrlKey) void startSession(pkPath.value);
  else void browse(pkPath.value);
});

// crisp monochrome glyphs (stroke = currentColor, tinted per row-kind in CSS). Static markup,
// no interpolated data — safe to set via innerHTML.
const PK_ICONS: Record<string, string> = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 17l-5.6 2.8 1.4-6.2L3 9.4l6.4-.6z"/></svg>',
};
function pkIcon(kind: string): HTMLElement {
  const s = el("span", "pkicon");
  s.innerHTML = PK_ICONS[kind] ?? PK_ICONS.folder;
  return s;
}

interface DirRowOpts { label: string; sub?: string; path: string; cls: string; icon: string; repo?: boolean; wt?: boolean }
function dirRow(o: DirRowOpts): HTMLElement {
  const row = el("div", `pkrow ${o.cls}`);
  row.title = o.path;
  row.appendChild(pkIcon(o.icon));
  const name = el("span", "pkname");
  name.appendChild(el("span", "pkleaf", o.label));
  if (o.sub) name.appendChild(el("span", "pksub", o.sub));
  row.appendChild(name);
  if (o.repo) {
    const g = el("span", "pkgit", "⎇");
    g.title = "git repo — ⌘Enter or “new lane” starts a worktree here";
    row.appendChild(g);
  }
  // pin star: filled+amber when pinned (always shown), a ghost outline on hover otherwise.
  // stopPropagation keeps the click off the row's browse/start timer.
  const pinned = pkPins.has(o.path);
  const star = el("span", `pkpin${pinned ? " on" : ""}`, pinned ? "★" : "☆");
  star.title = pinned ? "unpin (⌘D)" : "pin this folder (⌘D)";
  star.onclick = (e) => { e.stopPropagation(); void togglePin(o.path); };
  row.appendChild(star);
  // single click navigates in (browse); double click starts here directly — same
  // navigate-vs-activate convention as double-clicking a slot label to rename it.
  // Reconciled via MouseEvent.detail in one handler, not separate onclick/ondblclick:
  // browse() replaces this row's DOM once its fetch resolves, and on a local server
  // that's fast enough to beat the second click of a real double-click, which would
  // then land on whatever row ends up in its place instead of this one.
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  row.onclick = (e) => {
    clearTimeout(clickTimer);
    if (e.detail >= 2) { void startSession(o.path); return; }
    clickTimer = setTimeout(() => void browse(o.path), 250);
  };
  const use = el("span", "pkuse", "start ▸");
  use.onclick = (e) => {
    e.stopPropagation();
    void startSession(o.path);
  };
  row.appendChild(use);
  return row;
}

// clickable path: each ancestor segment jumps straight there. /Users/<me> collapses to ~.
function renderCrumb(path: string) {
  pkCrumb.replaceChildren();
  const home = /^(\/Users\/[^/]+)(\/.*)?$/.exec(path);
  const segs: { label: string; full: string }[] = [];
  let base: string;
  let rest: string;
  if (home) {
    segs.push({ label: "~", full: home[1] });
    base = home[1];
    rest = home[2] ?? "";
  } else {
    segs.push({ label: "/", full: "/" });
    base = "";
    rest = path;
  }
  for (const part of rest.split("/").filter(Boolean)) {
    base = `${base}/${part}`;
    segs.push({ label: part, full: base });
  }
  segs.forEach((s, i) => {
    if (i) pkCrumb.appendChild(el("span", "pksep", "›"));
    const seg = el("span", "pkseg", s.label);
    if (i === segs.length - 1) { seg.classList.add("here"); seg.title = s.full; }
    else { seg.title = s.full; seg.onclick = () => void browse(s.full); }
    pkCrumb.appendChild(seg);
  });
  pkCrumb.scrollLeft = pkCrumb.scrollWidth; // keep the current folder in view when deep
  // fade the left edge when ancestors have scrolled out of view, so hidden segments are hinted
  pkCrumb.classList.toggle("overflow", pkCrumb.scrollWidth > pkCrumb.clientWidth + 1);
}

async function browse(path: string): Promise<boolean> {
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`);
  const data = (await res.json()) as
    | { path: string; parent: string | null; dirs: string[]; repos?: string[]; worktrees?: string[];
        recents: string[]; pins?: string[]; common: string[]; git?: boolean }
    | { error: string };
  if ("error" in data) {
    pkPath.classList.add("bad");
    setTimeout(() => pkPath.classList.remove("bad"), 1200);
    return false;
  }
  pkPath.value = data.path;
  pkPath.classList.remove("bad");
  renderCrumb(data.path);
  pkPins = new Set(data.pins ?? []);
  // the worktree action only makes sense inside a git repo
  pkWorktreeBtn.style.display = data.git ? "" : "none";
  localStorage.setItem("fleet.pkdir", data.path); // next openPicker starts where you left off
  pkLists.replaceChildren();
  pkRows = [];
  pkSel = -1;
  pkFilter.value = "";
  let head: HTMLElement | null = null;
  const addHead = (t: string, n?: number) => {
    head = el("div", "pkhead");
    head.appendChild(el("span", "pkheadt", t));
    if (n !== undefined) head.appendChild(el("span", "pkheadn", String(n)));
    pkLists.appendChild(head);
  };
  const addRow = (o: DirRowOpts) => {
    const row = dirRow(o);
    pkLists.appendChild(row);
    pkRows.push({ row, path: o.path, name: `${o.label} ${o.sub ?? ""}`.toLowerCase(), head, wt: !!o.wt });
  };
  // full paths render as name-up-front + dimmed parent; a bare top-level dir (/tmp) still splits
  const split = (p: string): { leaf: string; sub: string } => {
    const disp = p.replace(/^\/Users\/[^/]+/, "~");
    const i = disp.lastIndexOf("/");
    if (i < 0) return { leaf: disp, sub: "" };
    if (i === 0) return { leaf: disp.slice(1) || disp, sub: "/" };
    return { leaf: disp.slice(i + 1), sub: disp.slice(0, i) };
  };
  if (data.pins?.length) {
    addHead("Pinned", data.pins.length);
    for (const p of data.pins) {
      const { leaf, sub } = split(p);
      addRow({ label: leaf, sub, path: p, cls: "pin", icon: "star", wt: isWtPath(p) });
    }
  }
  if (data.recents.length) {
    addHead("Recent", data.recents.length);
    for (const r of data.recents) {
      const { leaf, sub } = split(r);
      addRow({ label: leaf, sub, path: r, cls: "recent", icon: "clock", wt: isWtPath(r) });
    }
  }
  addHead("Places");
  for (const c of data.common) addRow({ label: c.replace(/^\/Users\/[^/]+/, "~"), path: c, cls: "place", icon: "folder" });
  const repoSet = new Set(data.repos ?? []);
  const wtSet = new Set(data.worktrees ?? []);
  addHead("Folders", data.dirs.length);
  if (data.parent) addRow({ label: `Up to ${baseName(data.parent)}`, path: data.parent, cls: "up", icon: "up" });
  for (const d of data.dirs) addRow({
    label: d, path: `${data.path}/${d}`.replace("//", "/"), cls: "dir", icon: "folder",
    repo: repoSet.has(d), wt: wtSet.has(d) || d.endsWith(".worktrees"),
  });
  if (!data.dirs.length) pkLists.appendChild(el("div", "pknone", "no subfolders here"));
  applyWtHide(); // honor the current "hide lanes" toggle for the freshly built rows
  return true;
}

// pin/unpin round-trips to the server (pins follow the owner across devices), then re-renders
async function togglePin(path: string) {
  const res = await post("/api/pins", { path, on: !pkPins.has(path) });
  if (!res.ok) return;
  const data = (await res.json()) as { pins?: string[] };
  pkPins = new Set(data.pins ?? []);
  const keepFilter = pkFilter.value; // browse() clears it — restore so ⌘D-pin keeps your context
  await browse(pkPath.value); // rebuild the Pinned section + star states from the new set
  if (keepFilter) { pkFilter.value = keepFilter; applyPkFilter(); }
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
  const slot = pickerSlot;
  // branch names are plumbing, not something to type: the server auto-names the lane
  // (fleet/<stamp>-<rand>) and the slot label is what you actually rename
  const res = await post(`/api/slots/${slot}/open-worktree`, { repo, branch: "" });
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
  pkTitle.textContent = `New session — slot ${slotId}`;
  renderHideWtBtn();
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
  // every slot gets a row, always — slots are fixed places, so a session stays findable
  // where it was started. An empty slot is itself the "new session here" affordance.
  // quick-lane target: the focused session's repo (a lane's PRIMARY repo, never the lane
  // dir itself — a lane off a lane would nest .worktrees inside the worktree)
  const focSlot = panes[focused]?.slot;
  const foc = focSlot ? fleet[focSlot - 1] : undefined;
  const quickRepo = foc?.git && foc.cwd ? (foc.worktree?.repo ?? foc.cwd) : null;
  for (const s of fleet) {
    if (!s.cwd) {
      const row = el("div", "slot empty");
      row.dataset.slot = String(s.id);
      row.appendChild(el("span", "n", String(s.id)));
      row.appendChild(el("span", "lbl dim", "empty — start here"));
      row.onclick = () => openPicker(s.id);
      if (quickRepo) {
        // one click from "empty" to a working lane in the focused repo — the picker
        // path (browse → ⎇ new lane) stays for everything else
        const q = el("span", "quicklane", "⎇+");
        q.title = `new lane in ${baseName(quickRepo)} — one click, no picker`;
        q.onclick = (e) => {
          e.stopPropagation();
          void newLane(quickRepo, s.id);
        };
        row.appendChild(q);
      }
      slotsEl.appendChild(row);
      continue;
    }
    const visible = panes.some((p) => p.slot === s.id);
    const isFocused = panes[focused]?.slot === s.id;
    const row = el("div", "slot" + (isFocused ? " current" : visible ? " shown" : "") + (s.worktree ? " lane" : ""));
    row.dataset.slot = String(s.id);
    row.appendChild(el("span", "n", String(s.id)));
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
      // row = identity + state: a lane's lifecycle color IS its land-readiness, shown as
      // ONE dot. The branch name and counts that used to fill a 96px badge move into the
      // tooltip — the name up top is already derived from this same branch (baseName(cwd))
      if (s.worktree && s.git?.branch) {
        // lifecycle: editing (uncommitted) → ready (clean but commits to push/land) → clean
        const state = s.git.dirty > 0 ? "editing" : s.git.ahead > 0 ? "ready" : "clean";
        row.appendChild(el("span", "lanechip", "⎇")); // lanes read as first-class
        const dot = el("span", `lcdot ${state}`);
        dot.title = `${s.git.branch} — ${s.git.dirty} uncommitted, ${s.git.ahead} to land, ${s.git.behind} behind`
          + `\nFleet lane (${state}). ± review · open the board to land`;
        row.appendChild(dot);
      }
      // a lane's whole point is review-then-land, so its ± sits inline (not hover-hidden) —
      // the one action that belongs on the row; everything else (share/export/rename/land)
      // lives in the board now
      if (s.worktree) {
        const dff = el("span", "lanediff", "±");
        dff.title = "review this lane's diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        row.appendChild(dff);
      }
      if (s.share && s.share.comments > 0) {
        // passive signal — hidden while the hover-action row is up; the 💬 in that row
        // (below) is the clickable path, so aiming at the badge still lands right
        const cb = el("span", "cmtb", `💬${s.share.comments}`);
        cb.title = `guest chat — ${s.share.comments} message${s.share.comments === 1 ? "" : "s"}`;
        row.appendChild(cb);
      }
      if (s.mergePending) {
        // a resolved conflict waiting for review — discoverable without opening the board
        const rb = el("span", "revb", "⏸");
        rb.title = "conflicts resolved — review & land (open the board)";
        rb.onclick = (e) => { e.stopPropagation(); showSlot(s.id); setBoard(true); };
        row.appendChild(rb);
      }
      // green = live in a pane, or a background session that just produced output
      row.appendChild(el("span", "act" + (visible || serverNow - s.lastOutput < RECENT_MS ? " hot" : "")));
      const act = el("div", "slotact");
      if (s.git && !s.worktree) {
        // plain repo session: diff is available but secondary, so it stays in the hover row
        const dff = el("span", "diff", "±");
        dff.title = "review working diff";
        dff.onclick = (e) => { e.stopPropagation(); void openDiff(s.id); };
        act.appendChild(dff);
      }
      // rename/merge/land used to live here as hover-only glyphs — moved to the board's
      // labeled "actions" section (renb/lb) so they're touch-reachable and self-explanatory;
      // the row keeps only ± (added above) and ✕ kill (below) plus this chat badge.
      if (s.share) {
        const ca = el("span", "cmtact" + (s.share.comments > 0 ? " hot" : ""), "💬");
        ca.title = "guest chat";
        ca.onclick = (e) => { e.stopPropagation(); openShareDlg(s.id); };
        act.appendChild(ca);
      }
      const kill = el("span", "kill", "✕");
      kill.title = "kill session";
      kill.onclick = async (e) => {
        e.stopPropagation();
        if (s.worktree) {
          // a lane-holding slot never had real git-state context on kill before — fetch it,
          // same risk preview the board's land action uses (kill leaves the worktree on disk;
          // land/remove it from the board)
          const risk = await fetchSlotRisk(s.id);
          const ok = await showRiskPreview(
            `Kill session ${s.id} (${baseName(s.cwd!)})? The worktree is left on disk (open the board to land or remove it).`, risk, "kill");
          if (!ok) return;
        } else if (!confirm(`Kill session ${s.id} (${baseName(s.cwd!)})? The claude session and its history are gone.`)) {
          return;
        }
        await post(`/api/slots/${s.id}/kill`, {});
        for (const p of panes) if (p.slot === s.id) p.assign(0);
        await refresh();
      };
      act.appendChild(kill);
      row.appendChild(act);
      // mobile-only action strip: share/export/rename/land moved off the row into the
      // desktop-only board, leaving phones with no reachable share/export/rename/land.
      // These are CSS-hidden on desktop (.rowacts { display:none }) so the row stays clean.
      const rowacts = el("div", "rowacts");
      const mkact = (glyph: string, title: string, fn: () => void) => {
        const b = el("span", "rowact", glyph);
        b.title = title;
        b.onclick = (e) => { e.stopPropagation(); fn(); };
        rowacts.appendChild(b);
      };
      mkact("⤴", "share", () => openShareDlg(s.id));
      mkact("⇩", "export", () => window.open(`/api/slots/${s.id}/export`, "_blank"));
      mkact("✎", "rename", () => startRename(row, s));
      // ✔ save = quick-commit this lane's uncommitted work — lets a phone user save outside
      // the conversation (land/merge refuse a dirty tree; a kill would otherwise lose it)
      if (s.worktree) mkact("✔", "save (commit work)", () => { void doCommit(s.id, "quick"); });
      if (s.worktree) mkact("⏏", "land", () => { void doLand(s.id); });
      if (s.worktree) mkact("⇲", "shelve (set aside + note)", () => { void doShelve(s.id); });
      row.appendChild(rowacts);
      row.onclick = () => showSlot(s.id);
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
    const data = (await res.json()) as { now: number; chips: string[]; shareBase?: string;
      v?: number; autos?: AutoInfo[]; slots: SlotInfo[]; tasks?: TaskInfo[]; dispatch?: DispatchInfo; intake?: boolean };
    if (data.v) {
      if (!bundleV) bundleV = data.v;
      else if (data.v !== bundleV) armReload();
    }
    fleet = data.slots;
    // a merge job that landed its lane leaves the slot inactive — release its panes
    // exactly like a manual ⏏ land click does
    for (const sl of [...mergeWatch]) {
      const st = fleet[sl - 1];
      if (!st || !st.worktree) mergeWatch.delete(sl);
      if (st && !st.cwd) for (const p of panes) if (p.slot === sl) p.assign(0);
    }
    autosList = data.autos ?? [];
    tasksList = data.tasks ?? [];
    dispatch = data.dispatch ?? { available: false, on: false, maxLanes: 0, repo: "" };
    intakeOn = data.intake ?? false;
    serverNow = data.now;
    shareBase = data.shareBase ?? "";
    chipCmds = data.chips;
    renderChips(data.chips);
    const pendingReview = tasksList.some((t) => t.status === "pending" && (t.source === "intake" || t.source === "steward"));
    $("queuebtn").classList.toggle("hot", pendingReview);
    // skip the DOM rebuild when nothing visible changed — a full re-render kills hover state
    const key = JSON.stringify([focused, panes.map((p) => p.slot),
      autosList.filter((a) => a.enabled).map((a) => a.slot),
      data.slots.map((s) => [s.cwd, s.label, s.share?.id, s.share?.mode, s.share?.comments, s.mergePending, serverNow - s.lastOutput < RECENT_MS,
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
      const dk = sh ? `${sh.id}|${sh.mode}|${sh.guests}|${sh.comments}` : "none";
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
let dlgQr = false; // QR block open? module-level so refresh()'s re-render keeps it visible

function closeShareDlg() {
  sharedlg.style.display = "none";
  dlgSlot = 0;
  dlgQr = false; // next share starts collapsed — a QR is per-link, never sticky across slots
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
  diffpanel.replaceChildren(el("h2", "", "Diff"));
  diffdlg.style.display = "flex";
  const res = await api(`/api/slots/${slotId}/diff`);
  const data = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean;
      sessionScoped?: boolean; error?: string };
  diffpanel.replaceChildren(el("h2", "", data.sessionScoped
    ? "Session diff — everything this session changed" : "Working diff (uncommitted)"));
  if (data.error) { diffpanel.appendChild(el("div", "diffstat", data.error)); return; }
  const nChanged = data.status?.length ?? 0;
  diffpanel.appendChild(el("div", "diffstat",
    `${data.branch ?? "?"} · ${nChanged} file${nChanged === 1 ? "" : "s"} changed${data.truncated ? " · diff truncated" : ""}`));
  if (!data.diff) {
    diffpanel.appendChild(el("div", "diffstat", nChanged
      ? "(changes are untracked — no tracked diff)"
      : data.sessionScoped
        ? "this session hasn't changed anything yet"
        : "clean working tree — everything is committed"));
    return;
  }
  const box = el("div", "difftxt");
  renderDiffInto(box, data.diff);
  diffpanel.appendChild(box);
}

// the resolved lane's diff (main..HEAD) — exactly what will fast-forward onto main once
// the owner confirms. Same overlay as openDiff, different source.
async function openMergeDiff(slotId: number) {
  setDrawer(false);
  diffpanel.replaceChildren(el("h2", "", "Resolved diff — what will land on main"));
  diffdlg.style.display = "flex";
  const res = await api(`/api/slots/${slotId}/merge-diff`).catch(() => null);
  const data = (res && res.ok ? await res.json().catch(() => ({ loadFailed: true })) : { loadFailed: true }) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean; error?: string; loadFailed?: boolean };
  // fail closed — a dropped fetch must not read as "no changes to land" (no ⏏ button appears either way here, but say so plainly)
  if (data.loadFailed) { diffpanel.appendChild(el("div", "diffstat err", "couldn't load the diff — retry")); return; }
  if (data.error) { diffpanel.appendChild(el("div", "diffstat", data.error)); return; }
  const n = data.files?.length ?? 0;
  diffpanel.appendChild(el("div", "diffstat",
    `${data.branch ?? "?"} → ${data.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${data.truncated ? " · diff truncated" : ""}`));
  if (!data.diff) { diffpanel.appendChild(el("div", "diffstat", "no changes to land")); return; }
  const box = el("div", "difftxt");
  renderDiffInto(box, data.diff);
  diffpanel.appendChild(box);
  const land = el("button", "bmergeland", "⏏ land") as HTMLButtonElement;
  land.style.marginTop = "10px";
  land.onclick = () => { closeDiffDlg(); void doMergeLand(slotId); };
  diffpanel.appendChild(land);
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
    toggle.onclick = async () => { const r = await post("/api/dispatch", { on: !dispatch.on }); if (!r.ok) toast("couldn't toggle the dispatcher"); await refresh(); renderQueue(); };
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
    const r = await post("/api/tasks", { text: addIn.value, queue: false });
    if (!r.ok) { toast("couldn't add the task"); return; } // keep the typed text in the box
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
    } else if (t.source === "steward") {
      meta.appendChild(el("span", "qintake", "⚙ steward"));
    } else meta.append("owner");
    main.appendChild(meta);
    main.appendChild(el("div", "", t.text));
    row.appendChild(main);
    const mkBtn = (label: string, action: string) => {
      const b = el("button", "qbtn", label) as HTMLButtonElement;
      b.onclick = async () => { const r = await post(`/api/tasks/${t.id}/${action}`, {}); if (!r.ok) toast(`couldn't ${action} the task`); await refresh(); renderQueue(); };
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

// --- audit trail overlay (Backlog #9): owner-only read-only lens over /api/audit ---
// A GLOBAL log, not gated behind a live slot, because the headline question is about a slot
// that has VANISHED — its lifecycle events are unreachable from a per-slot entry point.
// One fetch, then all narrowing (slot filter, lifecycle-only) happens client-side.
const audit = $("audit"), auditpanel = $("auditpanel");
interface AuditEntry { ts: number; event: string; slot?: number; detail?: string }
// event kind → category, mirroring how the server groups them (server.ts audit() call sites).
// Category drives the row colour and the lifecycle-only toggle. Unlisted kinds fall to "other".
const AUDIT_CAT: Record<string, string> = {
  slot_open: "lifecycle", slot_kill: "lifecycle", slot_shelve: "lifecycle", self_heal_recreate: "lifecycle",
  auto_fire: "automation", auto_skip: "automation", autos_quiet: "automation", autos_switch: "automation",
  steward_send: "steward", steward_task: "steward", steward_journal: "steward",
  steward_propose_outcome: "steward", steward_send_capped: "steward",
  owner_auth_fail: "security", share_auth_ok: "security", share_create: "security", share_revoke: "security",
  share_mode_change: "security", guest_ws_connect: "security", guest_ws_disconnect: "security",
  land_note_fail: "repo", repo_undo_land: "repo",
};
const LIFECYCLE_KINDS = new Set(["slot_open", "slot_kill", "slot_shelve", "self_heal_recreate"]);
// Generic decode = show the raw detail. A per-kind formatter ONLY for the lifecycle kinds whose
// raw string is cryptic and load-bearing (the ones that answer "what happened to slot N"). No
// 22-kind framework — every other kind's detail is already legible enough shown plainly.
function decodeAudit(event: string, detail?: string): string {
  switch (event) {
    case "slot_open": return detail ? `opened in ${baseName(detail)}` : "opened";
    case "slot_kill": return "killed";
    case "slot_shelve": {
      const m = detail?.match(/^note:(\d+)$/);
      return m ? `shelved · ${m[1]}-char note` : "shelved";
    }
    case "self_heal_recreate":
      return detail === "resumed" ? "self-healed (resumed)"
        : detail === "created" ? "self-healed (recreated fresh)"
        : `self-healed${detail ? ` (${detail})` : ""}`;
    default: return detail ?? "";
  }
}
let auditData: AuditEntry[] = [];
let auditSlot: number | "all" = "all";
let auditLife = false;

function renderAudit() {
  auditpanel.replaceChildren(el("h2", "", "Audit trail — what Fleet did"));
  const ctl = el("div", "auditctl");
  // slot filter (the primary axis): "all" + every slot id present in the trail, ascending
  const slots = [...new Set(auditData.map((e) => e.slot).filter((s): s is number => typeof s === "number"))]
    .sort((a, b) => a - b);
  const sel = el("select", "") as HTMLSelectElement;
  const optAll = el("option", "", "all slots") as HTMLOptionElement;
  optAll.value = "all";
  sel.appendChild(optAll);
  for (const s of slots) {
    const o = el("option", "", `slot ${s}`) as HTMLOptionElement;
    o.value = String(s);
    sel.appendChild(o);
  }
  sel.value = auditSlot === "all" ? "all" : String(auditSlot);
  sel.onchange = () => { auditSlot = sel.value === "all" ? "all" : Number(sel.value); renderAudit(); };
  ctl.appendChild(sel);
  const lifeBtn = el("button", `shrbtn${auditLife ? " active" : ""}`, "lifecycle only") as HTMLButtonElement;
  lifeBtn.title = "show only slot_open / slot_kill / slot_shelve / self_heal_recreate";
  lifeBtn.onclick = () => { auditLife = !auditLife; renderAudit(); };
  ctl.appendChild(lifeBtn);
  auditpanel.appendChild(ctl);

  const rows = auditData.filter((e) =>
    (auditSlot === "all" || e.slot === auditSlot) && (!auditLife || LIFECYCLE_KINDS.has(e.event)));
  ctl.appendChild(el("span", "auditcount", `${rows.length} of ${auditData.length} shown`));

  const list = el("div", "");
  list.id = "auditlist";
  if (!rows.length) list.appendChild(el("div", "histnone", "no events match this filter"));
  for (const e of rows) {
    const cat = AUDIT_CAT[e.event] ?? "other";
    const row = el("div", `auditrow cat-${cat}`);
    row.appendChild(el("span", "aud-ts", fmtTs(e.ts)));
    const slotBadge = el("span", `aud-slot${typeof e.slot === "number" ? "" : " none"}`,
      typeof e.slot === "number" ? String(e.slot) : "—");
    row.appendChild(slotBadge);
    row.appendChild(el("span", "aud-kind", e.event));
    row.appendChild(el("span", "aud-detail", decodeAudit(e.event, e.detail)));
    list.appendChild(row);
  }
  auditpanel.appendChild(list);
}

async function openAudit() {
  setDrawer(false);
  auditSlot = "all";
  auditLife = false;
  auditData = [];
  const res = await api("/api/audit?limit=1000");
  if (res.ok) {
    const data = (await res.json()) as { events?: AuditEntry[] };
    auditData = (data.events ?? []).filter((e): e is AuditEntry => typeof e?.ts === "number" && typeof e?.event === "string");
  }
  renderAudit(); // server already returns newest-first; we preserve that order
  audit.style.display = "flex";
}
function closeAudit() { audit.style.display = "none"; }
audit.addEventListener("click", (e) => { if (e.target === audit) closeAudit(); });
$("auditbtn").onclick = () => void openAudit();

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
  dlgKey = s.share ? `${s.share.id}|${s.share.mode}|${s.share.guests}|${s.share.comments}` : "none";
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
    const shareUrl = `${shareBase || location.origin}/s/${sh.id}`;
    const linkRow = copyLine("link", shareUrl);
    // QR encodes the LINK only — password travels separately by design (see the hint below)
    const qrBtn = el("button", `shrbtn${dlgQr ? " active" : ""}`, "QR") as HTMLButtonElement;
    qrBtn.onclick = () => { dlgQr = !dlgQr; renderShareDlg(); };
    linkRow.appendChild(qrBtn);
    sharepanel.appendChild(linkRow);
    if (dlgQr) {
      const box = el("div", "shrqr");
      const qr = qrcode(0, "M"); // type 0 = auto-size to the payload
      qr.addData(shareUrl);
      qr.make();
      const img = el("img", "") as HTMLImageElement;
      img.src = qr.createDataURL(6, 3); // self-contained GIF data URI — no innerHTML, no network
      img.alt = shareUrl;
      box.appendChild(img);
      box.appendChild(el("div", "shrqrhint", "scan to open the share link — password still needed"));
      sharepanel.appendChild(box);
    }
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
      const r = await post(`/api/slots/${s.id}/share-mode`, { mode: m });
      if (!r.ok) toast("couldn't change the share access mode");
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
    const cmts = el("div", "shrcmts");
    cmts.appendChild(el("div", "shrcmthead",
      sh.comments > 0 ? `💬 guest chat · ${sh.comments}` : "💬 guest chat"));
    const list = el("div", "shrcmtlist");
    cmts.appendChild(list);
    if (sh.comments > 0) void loadShareComments(s.id, list);
    // owner reply lands in the same thread, highlighted on the guest page
    const rrow = el("div", "shrreply");
    const rin = el("input", "shrreplyin") as HTMLInputElement;
    rin.placeholder = "reply to guests…";
    const rbtn = el("button", "shrbtn", "reply") as HTMLButtonElement;
    const sendReply = async () => {
      const text = rin.value.trim();
      if (!text || rbtn.disabled) return;
      rbtn.disabled = true;
      try {
        const res = await post(`/api/slots/${s.id}/comments`, { text });
        if (res.ok) {
          rin.value = "";
          await loadShareComments(s.id, list);
          await refresh();
        }
      } finally {
        rbtn.disabled = false;
      }
    };
    rbtn.onclick = () => void sendReply();
    rin.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); void sendReply(); }
    });
    rrow.append(rin, rbtn);
    cmts.appendChild(rrow);
    sharepanel.appendChild(cmts);
    const btns = el("div", "shrbtns");
    const rotate = el("button", "shrbtn", "new link + password") as HTMLButtonElement;
    rotate.onclick = async () => {
      if (!confirm("Replace this share? The old link and password stop working and connected guests are kicked.")) return;
      const r = await post(`/api/slots/${s.id}/share`, { mode: sh.mode });
      if (!r.ok) toast("couldn't rotate the share link");
      await refresh();
      renderShareDlg();
    };
    const revoke = el("button", "shrbtn danger", "end live share") as HTMLButtonElement;
    revoke.onclick = async () => {
      if (!confirm("End this share? The link stops working and connected guests are kicked immediately.")) return;
      const r = await post(`/api/slots/${s.id}/unshare`, {});
      if (!r.ok) toast("couldn't end the share");
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

interface ShareCommentInfo { id: string; ts: number; name: string; text: string; from?: string }
async function loadShareComments(slotId: number, target: HTMLElement) {
  const res = await api(`/api/slots/${slotId}/comments`);
  if (!res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { comments?: ShareCommentInfo[] };
  target.replaceChildren();
  for (const c of data.comments ?? []) {
    const row = el("div", c.from === "owner" ? "shrcmt own" : "shrcmt");
    const head = el("div", "shrcmtmeta");
    head.appendChild(el("b", "", c.from === "owner" ? "owner" : c.name));
    head.appendChild(el("span", "", fmtSince(c.ts)));
    const del = el("button", "shrcmtdel", "✕") as HTMLButtonElement;
    del.title = "delete this comment";
    del.onclick = async () => {
      const r = await post(`/api/slots/${slotId}/comments/${c.id}/delete`, {});
      if (!r.ok) toast("couldn't delete the comment");
      await refresh();
      renderShareDlg();
    };
    head.appendChild(del);
    row.appendChild(head);
    row.appendChild(el("div", "shrcmttext", c.text));
    target.appendChild(row);
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
    tog.onclick = async () => { const r = await post(`/api/autos/${a.id}/toggle`, {}); if (!r.ok) toast("couldn't toggle the schedule"); await refresh(); renderAutoDlg(); };
    const del = el("span", "autobtnx", "✕");
    del.title = "delete schedule";
    del.onclick = async () => { const r = await post(`/api/autos/${a.id}/delete`, {}); if (!r.ok) toast("couldn't delete the schedule"); await refresh(); renderAutoDlg(); };
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

// the directory view: every composed send ever, across all slots and slot lifetimes
interface PromptDirEntry { ts: number; slot: number; cwd: string | null; label: string | null; source: string; text: string }
let histAll = localStorage.getItem("fleet.histall") === "1";

// one row per prompt; meta = timestamp, plus origin session in the directory view.
// click loads the prompt into the compose box for editing — it never auto-sends
function histRow(text: string, meta: string): HTMLElement {
  const row = el("div", "histrow");
  row.append(el("div", "histtext", text), el("span", "histts", meta));
  const copy = el("span", "histcopy", "⧉");
  copy.title = "copy prompt";
  copy.onclick = (e) => {
    e.stopPropagation();
    copyText(text);
    copy.textContent = "✓";
    setTimeout(() => { copy.textContent = "⧉"; }, 800);
  };
  row.appendChild(copy);
  row.onclick = () => {
    ta.value = text;
    updateChips();
    closeHist();
    ta.focus();
  };
  return row;
}

async function renderHist() {
  const slot = panes[focused]?.slot ?? 0;
  const all = histAll || !slot; // no focused session → the directory is all there is
  histTitle.textContent = all ? "Prompt directory — all sessions" : `Prompt history — slot ${slot}`;
  const tabs = el("div", "shrbtns");
  const bThis = el("button", `shrbtn${all ? "" : " active"}`, "this session") as HTMLButtonElement;
  bThis.disabled = !slot;
  const bAll = el("button", `shrbtn${all ? " active" : ""}`, "all sessions") as HTMLButtonElement;
  const setAll = (on: boolean) => {
    histAll = on;
    localStorage.setItem("fleet.histall", on ? "1" : "0");
    void renderHist();
  };
  bThis.onclick = () => setAll(false);
  bAll.onclick = () => setAll(true);
  tabs.append(bThis, bAll);
  if (all) {
    const res = await api("/api/prompts?limit=300");
    const data = res.ok ? ((await res.json()) as { prompts: PromptDirEntry[] }) : { prompts: [] };
    histList.replaceChildren(tabs);
    if (!data.prompts.length) histList.appendChild(el("div", "histnone", "no prompts recorded yet"));
    for (const p of data.prompts) {
      const origin = p.label ?? (p.cwd ? baseName(p.cwd) : `slot ${p.slot}`);
      histList.appendChild(histRow(p.text, `${origin} · ${fmtTs(p.ts)}`));
    }
  } else {
    const items = await fetchHistory(slot);
    histList.replaceChildren(tabs);
    if (!items.length) histList.appendChild(el("div", "histnone", "nothing sent to this session yet"));
    for (const h of [...items].reverse()) histList.appendChild(histRow(h.text, fmtTs(h.ts)));
  }
}

async function openHist() {
  await renderHist();
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

// shared one-line failure notice for the non-destructive mutation handlers (task/auto/share/
// dispatch toggles) — their views re-derive from refresh(), so a failed POST otherwise no-ops
// silently. Self-contained styling so it needs no CSS-file change.
function toast(msg: string) {
  const t = el("div", "", msg);
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#f85149;color:#fff;padding:8px 14px;border-radius:6px;z-index:9999;font-size:13px;max-width:80%;box-shadow:0 2px 8px rgba(0,0,0,.4)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
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

// --- ✨ enhance: hand the draft to the background rework agent; the result replaces
// the box for review — it NEVER auto-sends. On failure the draft stays untouched.
// The server holds the request for up to SUMMARY_TIMEOUT_MS (3min, server.ts) — typically
// ~20s but occasionally the full window, so past 20s we say so instead of sitting on "…"
// looking stuck.
const enhBtn = $("enhbtn") as HTMLButtonElement;
const enhTitle = enhBtn.title;
enhBtn.onclick = async () => {
  const text = ta.value.trim();
  if (!text || enhBtn.disabled) return;
  const slot = panes[focused]?.slot ?? 0;
  enhBtn.disabled = true;
  enhBtn.textContent = "…";
  const slowNotice = setTimeout(() => {
    enhBtn.title = "✨ still working — this can take up to 3 min, not stuck";
  }, 20_000);
  try {
    const res = await post("/api/enhance", { slot, text });
    const j = (await res.json().catch(() => ({}))) as { prompt?: string; error?: string };
    if (!res.ok || !j.prompt) throw new Error(j.error ?? "enhance failed");
    // the wait can run up to 3min — if the draft moved on (edited, sent, pane switched)
    // in the meantime, dropping the stale result silently beats clobbering new work
    if (ta.value.trim() === text && (panes[focused]?.slot ?? 0) === slot) {
      ta.value = j.prompt;
      updateChips();
      ta.focus();
    }
  } catch {
    enhBtn.style.borderColor = "#f85149";
    setTimeout(() => { enhBtn.style.borderColor = ""; }, 1500);
  } finally {
    clearTimeout(slowNotice);
    enhBtn.disabled = false;
    enhBtn.textContent = "✨";
    enhBtn.title = enhTitle;
  }
};

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

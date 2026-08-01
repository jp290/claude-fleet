import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { CanvasAddon } from "@xterm/addon-canvas";
import { WebglAddon } from "@xterm/addon-webgl";
import qrcode from "qrcode-generator";
import { mdInto } from "./md";
import { RECONNECT_SETTLED_MS, reconnectDelay } from "./backoff";
// everything this file and server.ts must say identically — see src/protocol.ts. Importing rather
// than re-declaring is what makes tsc, which gates every land, the thing that notices a drift.
import {
  WS_INPUT_MAX_BYTES, DISPOSITION_VERDICTS,
  type GitInfo, type PostLandAuditInfo, type DispositionWorker, type DispositionVerdict,
} from "./protocol";
// the list-on-the-left / thing-in-full-on-the-right window shared by review, picker, queue and
// the outcome feed. Chrome only — every renderer below still owns its own rows and data.
import { openShell, type Shell, type ShellRow } from "./shell";

const $ = (id: string) => document.getElementById(id)!;
const slotsEl = $("slots"), dot = $("dot"),
  ta = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement,
  gate = $("gate"), gateIn = $("gatein") as HTMLInputElement,
  chipsEl = $("chips"), panesEl = $("panes");

const RECENT_MS = 5000;
const MAX_CHUNK = WS_INPUT_MAX_BYTES; // the server drops a larger frame in silence — one number, both ends
const LAYOUTS: Record<string, number> = { "1": 1, "2": 2, "4": 4 };

// must match the mobile media query in index.html
const MOBILE_MQ = matchMedia("(max-width: 700px), ((pointer: coarse) and (max-height: 500px))");
const isMobile = () => MOBILE_MQ.matches;

// --- data saver: ONE per-device switch, and the only thing in Fleet that trades freshness
// for bytes. What it does NOT touch is the terminal: live output and typing ride the
// WebSocket, so they stay exactly as fast either way. What it slows are the metadata polls
// (sidebar/queue, chat, session brief) and what it shrinks is the scrollback the server
// seeds on reconnect. Per-number cost/gain is measured in the commit that added this.
const SAVER = { pollMs: 10_000, chatMs: 3_000, boardMs: 10_000, seed: 500 };
const NORMAL = { pollMs: 2_000, chatMs: 1_000, boardMs: 3_000, seed: 0 }; // seed 0 = server's SEED_LINES
// pure on purpose, and kept clear of the DOM/localStorage lines below it: the e2e suite has
// no DOM harness, so it cuts this function out and runs it for real. pollMs/chatMs/boardMs
// === 0 means "no timer at all" — a hidden tab polls NOTHING, in either mode. seed is
// deliberately unaffected by hidden: it is read at connect time, which only happens visible.
function pollPlan(hidden: boolean, saver: boolean): { pollMs: number; chatMs: number; boardMs: number; seed: number } {
  const t = saver ? SAVER : NORMAL;
  return hidden ? { pollMs: 0, chatMs: 0, boardMs: 0, seed: t.seed } : { ...t };
}
let dataSaver = localStorage.getItem("fleet.datasaver") === "1";
const plan = () => pollPlan(document.hidden, dataSaver);

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
interface WorktreeInfo { repo: string; branch: string }
interface SlotInfo { id: number; cwd: string | null; label: string | null; lastOutput: number;
  share?: ShareInfo | null; git?: GitInfo | null; worktree?: WorktreeInfo | null; mergePending?: boolean }
// what the 2 s poll carries per task — mirrors server.ts's TaskDigest. No `text`: the prompt
// bodies are fetched once from /api/tasks when the queue overlay opens (see loadTaskTexts).
// The optional fields are absent, not null, when unset.
interface TaskInfo { id: string; source: "owner" | "intake" | "steward"; from?: string;
  status: "pending" | "queued" | "sent" | "done"; created: number; slot?: number; note?: string }
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
  private retries = 0; // consecutive failed/flapping reconnects — indexes reconnectDelay()
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
        // chatMs === 0 means the tab went hidden mid-fetch: stop the chain rather than
        // re-arm it. chatPump() (driven by the poll pump on the way back) restarts it.
        const ms = plan().chatMs;
        if (this.view === "chat" && ms) {
          clearTimeout(this.chatTimer);
          this.chatTimer = setTimeout(() => void this.pollChat(), ms);
        }
      }
    }
  }

  // the poll pump drives this on every visibility flip and every flip of the switch: drop
  // the pending tick first (pollChat() only declines to RE-arm, so one already-scheduled
  // poll would still fire into a hidden tab), then restart the chain if the plan still
  // wants one. Restarting costs a single request, not a backlog — the fetch is a delta
  // (after=chatTotal), so an hour spent hidden is still one catch-up.
  chatPump() {
    clearTimeout(this.chatTimer);
    if (this.view === "chat" && plan().chatMs) void this.pollChat();
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
    // seed = how many lines of scrollback we're willing to be handed on connect. Sent only
    // in data-saver mode; absent means the server's own SEED_LINES, i.e. today's behaviour.
    // Read at connect time, so flipping the switch takes effect on the NEXT reconnect.
    const seed = plan().seed;
    const ws = new WebSocket(
      `${proto}://${location.host}/ws/${this.slot}?cols=${this.term.cols}&rows=${this.term.rows}${force ? "&force=1" : ""}${seed ? `&seed=${seed}` : ""}`,
    );
    this.ws = ws;
    ws.binaryType = "arraybuffer";
    let openedAt = 0;
    ws.onopen = () => {
      openedAt = Date.now();
      if (focused === this.index) setConn(true);
      this.sendResize(true);
    };
    ws.onmessage = (e) => {
      // the seed (a scrollback capture, on every path) is always the first frame the
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
      // every successful open costs a scrollback seed, so a socket that keeps opening and
      // dropping is as expensive as one that never opens — only a socket that STAYED up
      // earns the fast first retry back (see src/backoff.ts)
      if (openedAt && Date.now() - openedAt >= RECONNECT_SETTLED_MS) this.retries = 0;
      const wait = reconnectDelay(this.retries++);
      setTimeout(() => {
        if (g === this.gen && fleet[this.slot - 1]?.cwd) this.connect();
      }, wait);
    };
  }

  assign(slot: number) {
    if (slot === this.slot) { this.focus(); return; }
    this.slot = slot;
    this.retries = 0; // a different pane: the old one's backoff says nothing about this one
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
    this.retries = 0; // an explicit ask: honour it now, don't serve it out of the backoff
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
    // preserve bottom-lock across the fit. xterm only auto-follows streaming output while
    // the viewport sits exactly at the tail (ydisp===ybase); fit() reflows the buffer and
    // can leave it a line or two above the bottom, at which point new output lands off
    // screen (the "stutter") and the jump pill appears — even though the user never scrolled
    // up. If we were following before the resize, re-pin after it with the same rAF nudge
    // connect() uses for the seed. Guarded on wasFollowing so a deliberately scrolled-up
    // pane (reading scrollback) is left where it is. Uses the jump pill's own threshold so
    // "following" here means exactly what "no pill" means everywhere else.
    const b = this.term.buffer.active;
    const wasFollowing = b.viewportY >= b.baseY - 1;
    this.fit.fit();
    if (wasFollowing) this.pinToBottom();
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
// 🔍 agent review: the same click-only contract as the summary, over this slot's own code
// changes. Owner-only (no share counterpart) and purely advisory — nothing here gates a land.
interface ReviewFinding { title: string; file: string; line: number | null;
  impact: "high" | "medium" | "low"; cost: string; basis: "verified" | "inferred"; detail: string }
interface ReviewInfo { findings?: ReviewFinding[]; scope?: string; notes?: string;
  model?: string; at?: number; head?: string | null; dirty?: number; error?: string;
  // content identity of the reviewed diff — the disposition rail's join key for a review label
  // (null = not computable, and then the review is deliberately not labelable)
  patchId?: string | null }
const revCache = new Map<number, ReviewInfo>();
const revBusy = new Set<number>();
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
// record); `ok: null` = the command DECLINED to verify this tree (skipped) — neither absence
// nor a skip may ever render as green. `stale` is set at confirm-land when main moved
// past the `mainSha` the verify ran against (the verdict is void once main moves past it).
type VerifyVerdict = { cmd: string; ok: boolean | null; out: string; at: number; mainSha: string; stale?: boolean };
interface MergeState { running: boolean;
  // "interrupted" is the durable marker a merge run leaves about itself before it starts: a run
  // that never came back (the server was killed mid-job) is reported as such instead of as no
  // verdict at all. Rendered by the plain verdict note below, like every other non-resolved state.
  last: { status: "merged" | "blocked" | "error" | "resolved" | "interrupted"; detail: string; landed: boolean;
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
// Informational only — a red, skipped or stale badge NEVER disables land (owner latitude
// stands; confirm-land deliberately does not block on a non-green verify). The two ways of
// having no verdict are told apart and neither reads green: no command CONFIGURED reads
// "unverified", a command that DECLINED to run reads "skipped".
function verifyBadge(v: VerifyVerdict | undefined): HTMLElement {
  if (!v) {
    const b = el("span", "vbadge none", "unverified");
    b.title = "no FLEET_VERIFY_CMD result on record for this rebased tree — the tree was not deterministically verified";
    return b;
  }
  if (v.ok === null) {
    const b = el("span", "vbadge skip", "verify — skipped");
    b.title = `\`${v.cmd}\` declined to verify this tree (it verified NOTHING — not a pass) — click to view what it said`;
    b.onclick = (e) => { e.stopPropagation(); showVerifyOutput(v); };
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

// tail of a non-green verify's captured output — reachable from the red and the skipped badge,
// so the owner can see WHY it failed, or what the command said as it declined, before
// exercising land latitude.
function showVerifyOutput(v: VerifyVerdict): void {
  const skipped = v.ok === null;
  const overlay = el("div", "overlay riskoverlay");
  overlay.style.display = "flex";
  const panel = el("div", "panel riskpanel");
  panel.appendChild(el("h2", "", skipped ? "verify — skipped, output" : "verify ✗ — output"));
  panel.appendChild(el("div", `diffstat ${skipped ? "warn" : "err"}`,
    `${v.cmd} · ${skipped ? "declined to verify this tree — nothing was checked" : "exit non-zero"}`));
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
            // as with the committed list below: every row here opened the WHOLE working diff,
            // whichever row you clicked. Now it opens the review window on this file — and an
            // UNTRACKED file has no diff to open on, so it goes straight to the file itself.
            const upath = f.slice(3);
            const untracked = f.startsWith("??");
            row.title = untracked ? `${f} — click to read it (untracked: there is no diff yet)`
              : `${f} — click to see what changed in this file`;
            row.onclick = () => void openReview(slot, "working",
              untracked ? { k: "untracked", path: upath } : { k: "file", path: upath });
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
          // every row here used to open the WHOLE working diff, whichever row you clicked — the
          // card listed thirty files and answered the same way for all of them. It now opens the
          // review window ON the file you clicked. `f` is porcelain ("M  path"), so the path
          // starts at column 3.
          const path = f.slice(3);
          row.title = `${f} — click to see what changed in this file`;
          row.onclick = () => void openReview(slot, "working", { k: "file", path });
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
        // an INTERRUPTED run that had already handed the conflicts to the agent needs the same
        // eye as a settled "resolved" verdict: the resolutions may be committed in the lane and
        // nobody — not even the server — ever saw a verdict for them (server.ts, needsMergeReview)
        const awaitingReview = l?.status === "resolved"
          || (l?.status === "interrupted" && (l.conflicted?.length ?? 0) > 0);
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
          const hd = el("div", "bmergehd", l.status === "interrupted"
            ? `merge INTERRUPTED while resolving${n ? ` ${n} file${n === 1 ? "" : "s"}` : ""} — no verdict was ever recorded; review, then land `
            : `conflicts resolved${n ? ` in ${n} file${n === 1 ? "" : "s"}` : ""} — review, then land `);
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

      // 4 — AGENTS: advisory, read-only. ✨ summarize + 🔍 review.
      // recover a server-cached summary once per slot (GET never spawns the agent)
      if (!sumCache.has(slot)) {
        sumCache.set(slot, {});
        void api(`/api/slots/${slot}/summary`).then(async (r) => {
          if (!r.ok) return;
          const j = (await r.json()) as SummaryInfo;
          if (j.summary) { sumCache.set(slot, j); void renderBoard(); }
        }).catch(() => { /* transient — the button still works */ });
      }
      // same one-shot cache recovery for the review (GET is a pure cache lookup server-side)
      if (!revCache.has(slot)) {
        revCache.set(slot, {});
        void api(`/api/slots/${slot}/review`).then(async (r) => {
          if (!r.ok) return;
          const j = (await r.json()) as ReviewInfo;
          if (j.findings) { revCache.set(slot, j); void renderBoard(); }
        }).catch(() => { /* transient — the button still works */ });
      }
      // a result is pinned to the git state it was computed on — say so when that state moved on
      const agedOut = (head?: string | null, dirty?: number) => {
        const c0 = brief.commits[0];
        return (!!head && !!c0 && !head.startsWith(c0.hash)) || dirty !== brief.uncommitted;
      };
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
        if (agedOut(sum.head, sum.dirty))
          asec.appendChild(el("div", "bstale", "⚠ computed for an older state — re-run to refresh"));
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
      // 🔍 review — a SECOND agent beside the summarizer, over this slot's code changes.
      // Advisory only: it never gates or alters a land, a merge or a file.
      const rev = revCache.get(slot);
      const rbtn = el("button", "bbtn accent",
        revBusy.has(slot) ? "… reviewing" : rev?.findings ? "🔍 re-review" : "🔍 review") as HTMLButtonElement;
      rbtn.disabled = revBusy.has(slot);
      rbtn.title = "run a short-lived read-only agent over this session's own code changes — one model call, advisory only";
      rbtn.onclick = async () => {
        if (revBusy.has(slot)) return;
        revBusy.add(slot);
        rbtn.disabled = true;
        rbtn.textContent = "… reviewing";
        try {
          const r = await post(`/api/slots/${slot}/review`, {});
          const j = (await r.json().catch(() => ({}))) as ReviewInfo;
          revCache.set(slot, r.ok ? j : { error: j.error ?? "reviewer failed" });
        } catch {
          revCache.set(slot, { error: "reviewer failed — network error" });
        } finally {
          revBusy.delete(slot);
          void renderBoard();
        }
      };
      asec.appendChild(rbtn);
      if (rev?.findings) {
        if (agedOut(rev.head, rev.dirty))
          asec.appendChild(el("div", "bstale", "⚠ reviewed an older state — re-run to refresh"));
        if (!rev.findings.length) {
          asec.appendChild(el("div", "bsumrow", "· no findings in the reviewed changes"));
        } else {
          asec.appendChild(el("div", "bsumhead", `findings — ${rev.findings.length}, worst first`));
          for (const f of rev.findings) {
            const row = el("div", `bfind ${f.impact}`);
            const hd = el("div", "bfindhd");
            hd.appendChild(el("span", "bfindimp", f.impact));
            hd.appendChild(el("span", "bfindt", f.title || "(untitled)"));
            row.appendChild(hd);
            row.appendChild(el("div", "bfindcite", `${f.file}:${f.line} · ${f.basis}`));
            if (f.detail) row.appendChild(el("div", "bfinddet", f.detail));
            if (f.cost) row.appendChild(el("div", "bfindcost", `cost: ${f.cost}`));
            asec.appendChild(row);
          }
        }
        if (rev.notes) asec.appendChild(el("div", "bsumver", `not checked: ${rev.notes}`));
        if (rev.scope) asec.appendChild(el("div", "bsummeta", rev.scope));
        if (rev.model && rev.at)
          asec.appendChild(el("div", "bsummeta", `${rev.model} · ${new Date(rev.at).toLocaleTimeString()}`));
        // was this review worth anything? One tap, owner-only, joined by patchId (content identity,
        // so the label survives the land-path rebase). A review with no patchId gets no buttons —
        // there is no honest key to file the label under, and a guessed one is worse than none.
        if (rev.patchId) {
          const rref = rev.patchId;
          const rcur = dispoOf("review3", rref);
          const rlab = el("div", "ocdispo-row");
          rlab.appendChild(el("span", "ocdispo-state" + (rcur ? ` is-${rcur}` : " is-none"),
            rcur ? `dein Urteil: ${DISPO_WORD_UI[rcur]}` : "unbewertet"));
          for (const [verdict, word] of [["accepted", "nützlich"], ["wrong", "falsch"]] as [DispositionVerdict, string][]) {
            const b = el("button", `ocdispo-btn${rcur === verdict ? " active" : ""}`, word) as HTMLButtonElement;
            b.title = `label this review — records an owner \`${verdict}\` disposition on the rail`;
            b.onclick = async () => {
              b.disabled = true;
              if (await labelDisposition("review3", rref, verdict)) void renderBoard();
              else b.disabled = false;
            };
            rlab.appendChild(b);
          }
          asec.appendChild(rlab);
        }
      } else if (rev?.error) {
        asec.appendChild(el("div", "bsumerr", rev.error));
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
// the board's own 3s interval used to live here — it is armed by the poll pump now (grep
// armPolls), together with refresh(), so document.hidden is handled in exactly one place.

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
    // the picker and the review window are src/shell.ts windows — they swallow their own Escape
    if (hist.style.display === "flex") closeHist();
    if (sharedlg.style.display === "flex") closeShareDlg();
    if (autodlg.style.display === "flex") closeAutoDlg();
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
// Re-hosted in the src/shell.ts window; it was a 520px .panel with a list and three buttons. Same
// rows, same pins, same type-a-few-letters-then-Enter path — plus the detail pane that answers the
// question the old picker structurally could not: what IS this folder. A RE-HOST rather than a
// rewrite on purpose. PK_ICONS below is pinned by fleet-e2e-security.ts §7, and the row anatomy
// (pin star, ⎇ badge, start ▸) was already the part that worked.
//
// One interaction DID change, and it is the platform-standard direction: a single click selects
// (and the detail follows) instead of navigating. Navigating in is now double-click or Enter, as it
// is in Finder, Explorer and VS Code. Single-click-to-navigate made a detail pane unreachable —
// you could never rest on a folder long enough to read about it. It also drops a 250ms timer that
// only existed to tell a first click from a double.
let pickerSlot = 0;
let pkShell: Shell | null = null;
let pkPins = new Set<string>(); // pinned paths, refreshed from /api/dirs on every browse()
// worktree lanes clutter the picker (recents are mostly `*.worktrees/fleet-*`); hide them by
// default. View-only pref, per device — kept in localStorage like the board/histall toggles.
let hideWorktrees = localStorage.getItem("fleet.hidewt") !== "0";
// a path is a lane if it lives under (or is) a `.worktrees` dir — reliable, no false positives
function isWtPath(p: string): boolean { return /\.worktrees(\/|$)/.test(p); }

interface PkRow { row: HTMLElement; path: string; name: string; head: HTMLElement | null; wt: boolean }
let pkRows: PkRow[] = [];
// the window's own controls, rebuilt on every open (the window itself is created per open)
let pkFilter: HTMLInputElement;
let pkPathIn: HTMLInputElement;
let pkCrumb: HTMLElement;
let pkHideBtn: HTMLButtonElement;

function closePicker() { pkShell?.close(); }

// a row is out when the worktree toggle hides it (pkwt) OR the text filter excludes it (pkhide)
function pkVisible(): PkRow[] {
  return pkRows.filter((r) => !r.row.classList.contains("pkhide") && !r.row.classList.contains("pkwt"));
}

// the shell walks the rows it was handed, so it must be handed only the ones actually on screen —
// otherwise ↑/↓ stops on a row hidden by the filter or the lane toggle
function pkSyncRows(select: number) {
  const shell = pkShell;
  if (!shell) return;
  const vis = pkVisible();
  shell.setRows(vis.map((r) => ({ el: r.row, open: () => void browse(r.path) })));
  if (select >= 0 && vis.length) shell.select(Math.min(select, vis.length - 1));
  else shell.select(-1, false, false);
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
  for (const [head, n] of counts) { const b = head.querySelector(".shellsecn"); if (b) b.textContent = String(n); }
  applyPkFilter();
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
  pkSyncRows(q ? 0 : -1); // filtering pre-selects the best match so Enter just works
}

function renderHideWtBtn() {
  pkHideBtn.textContent = "⎇ hide lanes";
  pkHideBtn.classList.toggle("on", hideWorktrees);
  pkHideBtn.title = hideWorktrees ? "worktree lanes hidden — click to show them" : "click to hide worktree lanes";
}

// crisp monochrome glyphs (stroke = currentColor, tinted per row-kind in CSS). Static markup,
// no interpolated data — safe to set via innerHTML.
const PK_ICONS: Record<string, string> = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  folderOpen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 19V7a2 2 0 0 1 2-2h3.2l1.8 2H19a2 2 0 0 1 2 2v1.5"/><path d="M5.6 19h13a1.6 1.6 0 0 0 1.55-1.2l1.35-5.2A1 1 0 0 0 20.5 11.3H8.4a1.6 1.6 0 0 0-1.55 1.2l-1.35 5.2A1.6 1.6 0 0 1 3.5 19"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v4.7l3 1.8"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M6 11l6-6 6 6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 3l2.6 5.8 6.4.6-4.8 4.2 1.4 6.2L12 17l-5.6 2.8 1.4-6.2L3 9.4l6.4-.6z"/></svg>',
};
function pkIcon(kind: string): HTMLElement {
  const s = el("span", "pkicon");
  s.innerHTML = PK_ICONS[kind] ?? PK_ICONS.folder;
  return s;
}

interface DirRowOpts { label: string; sub?: string; path: string; cls: string; icon: string;
  repo?: boolean; wt?: boolean; depth?: number; tree?: boolean;
  // one flag per ANCESTOR level: true where that ancestor was the last of its siblings, so the
  // spine at that level must stop rather than run past a branch that has nothing below it
  blanks?: boolean[]; last?: boolean }
function dirRow(o: DirRowOpts): HTMLElement {
  const open = !!o.tree && pkOpen.has(o.path);
  // `open` rides on the ROW, not just the ▸: it is what grows the line the children hang from,
  // tints the icon, and turns the glyph. One state, one class, three things saying the same.
  const row = el("div", `pkrow ${o.cls}${o.tree ? " tree" : ""}${open ? " open" : ""}`);
  row.title = o.path;
  if (o.tree) {
    // one guide span per ancestor level, each a vertical rule stretched over the FULL row box — that
    // is what makes the lines continuous from row to row instead of a ladder of dashes. They live
    // in their own container so .pkrow's 10px gap does not space them apart. The guide at the row's
    // OWN level turns horizontally into the name (├), or corners into it if this is the last child
    // (└) — that turn is what makes a column of names read as a branch of a tree.
    const lead = el("span", "pklead");
    const depth = o.depth ?? 0;
    // depth + 1 columns, not depth: the row's OWN level gets an elbow too, so a top-level folder
    // hangs off the same spine as everything below it and the whole section reads as ONE tree.
    // Drawing them only for nested rows left the top level flat, and the first expansion then
    // sprouted a line out of nowhere — the shape `tree(1)` gets right by connecting every entry.
    for (let i = 0; i <= depth; i++) {
      const g = el("span", "pkguide");
      if (i === depth) g.classList.add(o.last ? "end" : "branch");
      else if (o.blanks?.[i]) g.classList.add("blank");
      lead.appendChild(g);
    }
    const tw = el("span", `pktw${open ? " open" : ""}`, open ? "▾" : "▸");
    tw.title = open ? "collapse (←)" : "expand (→)";
    tw.onclick = (e) => { e.stopPropagation(); void toggleNode(o.path); };
    lead.appendChild(tw);
    row.appendChild(lead);
  }
  // A folder icon on tree rows after all. It was dropped when every tree row was the same closed
  // folder and the glyph therefore distinguished nothing — but an icon that OPENS is not the same
  // glyph twice: it carries the one thing the name cannot say, and it says it in the place the eye
  // already is. The shortcut sections keep their own kinds (star, clock, folder, up-arrow).
  row.appendChild(pkIcon(o.tree ? (open ? "folderOpen" : "folder") : o.icon));
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
  // click 1 selects AND opens the folder (the detail pane follows), click 2 STARTS A SESSION here.
  // No timer: both are idempotent-or-invisible, so the first click of a double-click costs nothing
  // to let through — which is exactly what forced the old 250ms reconciliation. (A double-click
  // that lands on a closed folder expands it on the way past; the window closes on the session it
  // starts, so that is never seen.)
  // Clicking the ROW to open it, not just the ▸, is what Finder, Explorer and VS Code all do, and
  // the ▸ was an 18px target for the most common action in the window. Re-rooting — making a folder
  // the top of the tree — stays on the breadcrumb, the "Up to …" row, the path box and Enter. The
  // one row kind that navigates on double-click is "Up to …": it names a destination, not a place
  // to work.
  row.onclick = (e) => {
    if (e.detail >= 2) { void (o.cls === "up" ? browse(o.path) : startSession(o.path)); return; }
    // "Up to …" is pure navigation, and a phone has no comfortable double-click: one tap goes up.
    // On a pointer device the double-click still does it and a single click inspects, unchanged.
    if (o.cls === "up" && isMobile()) { void browse(o.path); return; }
    const i = pkVisible().findIndex((r) => r.row === row);
    if (i >= 0) pkShell?.select(i, false, false);
    void showDirDetail(o.path);
    // A click on a folder OPENS AND CLOSES it — the whole gesture, the way an explorer works. It
    // used to open only, on the theory that collapsing would make the row under the cursor jump
    // away; that theory was wrong, because collapsing removes the rows BELOW this one and leaves
    // this one exactly where it is.
    // Touch is the exception: there the same tap also pushes the detail pane OVER the list, so a
    // collapse would happen behind it and be discovered on the way back — the folder you just
    // opened, shut. On touch the tap only opens, and ▸ still closes.
    if (o.tree && !(isMobile() && pkOpen.has(o.path))) void toggleNode(o.path);
    // On a phone there is no second column, so the detail has to be PUSHED or it cannot be seen at
    // all — which is exactly what it was: the picker never called this, so everything the pane
    // knows (what is in the folder, its commits, "already open in slot N", ⎇ New lane) was
    // desktop-only. The tree stays reachable: ▸ expands without leaving the list, and ‹ comes back.
    if (isMobile()) pkShell?.showDetail(true);
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
  const shell = pkShell;
  if (!shell) return false;
  if ("error" in data) {
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    return false;
  }
  pkPathIn.value = data.path;
  pkPathIn.classList.remove("bad");
  renderCrumb(data.path);
  pkPins = new Set(data.pins ?? []);
  localStorage.setItem("fleet.pkdir", data.path); // next openPicker starts where you left off
  pkFilter.value = "";
  // a new root is a new tree: nothing below it is expanded, and the cached children of the old
  // root's descendants would only be stale weight
  pkRoot = data.path;
  pkOpen.clear();
  pkKids.clear();
  pkKids.set(data.path, nodesOf(data.path, data.dirs, data.repos, data.worktrees));
  pkShortcuts = { pins: data.pins ?? [], recents: data.recents, common: data.common, parent: data.parent };
  paintPicker();
  // the detail describes the folder you just navigated INTO until the cursor moves, so the pane is
  // never empty and its actions always have an unambiguous target
  void showDirDetail(data.path);
  return true;
}

// --- the folder tree ---
// The picker listed ONE directory at a time. Seeing whether a repo held the subfolder you wanted
// meant navigating in, looking, and navigating back out — and the shortcut sections scrolled away
// while you did it. Now the folders under the current root are a tree you expand in place, with a
// guide line down each level so the nesting is readable at a glance rather than counted in spaces.
interface PkNode { name: string; path: string; repo: boolean; wt: boolean }
let pkRoot = "";
const pkKids = new Map<string, PkNode[]>(); // path → its subfolders, fetched once per expansion
const pkOpen = new Set<string>();           // which paths are expanded
const pkBusy = new Set<string>();           // expansions in flight, so a double-click fetches once
let pkShortcuts: { pins: string[]; recents: string[]; common: string[]; parent: string | null } =
  { pins: [], recents: [], common: [], parent: null };

function nodesOf(base: string, dirs: string[], repos?: string[], worktrees?: string[]): PkNode[] {
  const repoSet = new Set(repos ?? []);
  const wtSet = new Set(worktrees ?? []);
  return dirs.map((d) => ({
    name: d, path: `${base}/${d}`.replace("//", "/"),
    repo: repoSet.has(d), wt: wtSet.has(d) || d.endsWith(".worktrees"),
  }));
}

async function fetchKids(path: string): Promise<PkNode[] | null> {
  const res = await api(`/api/dirs?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!res || !res.ok) return null;
  const d = (await res.json().catch(() => null)) as
    { path?: string; dirs?: string[]; repos?: string[]; worktrees?: string[] } | null;
  if (!d?.path || !d.dirs) return null;
  return nodesOf(d.path, d.dirs, d.repos, d.worktrees);
}

async function toggleNode(path: string) {
  if (pkOpen.has(path)) { pkOpen.delete(path); paintPicker(); return; }
  if (!pkKids.has(path)) {
    if (pkBusy.has(path)) return;
    pkBusy.add(path);
    const kids = await fetchKids(path);
    pkBusy.delete(path);
    if (!pkShell?.isOpen()) return;
    // an unreadable folder (permissions, or it vanished) caches as EMPTY rather than retrying on
    // every click — the row then says so instead of silently doing nothing
    pkKids.set(path, kids ?? []);
  }
  pkOpen.add(path);
  paintPicker();
}

// rebuild the whole list from cached state. Cheap — the expensive part is the fetch, which happens
// once per folder — and it keeps one painting path for browse(), expand, collapse and pin changes.
function paintPicker() {
  const shell = pkShell;
  if (!shell) return;
  const keep = pkFilter.value;
  shell.list.replaceChildren();
  pkRows = [];
  let head: HTMLElement | null = null;
  const addHead = (t: string, n?: number) => {
    head = el("div", "shellsec");
    head.appendChild(el("span", "shellsect", t));
    if (n !== undefined) head.appendChild(el("span", "shellsecn", String(n)));
    shell.list.appendChild(head);
  };
  const addRow = (o: DirRowOpts) => {
    const row = dirRow(o);
    shell.list.appendChild(row);
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
  // the shortcut sections stay FLAT: they are jump targets scattered across the disk, not places in
  // this tree, and drawing guide lines beside them would claim a nesting that does not exist
  if (pkShortcuts.pins.length) {
    addHead("Pinned", pkShortcuts.pins.length);
    for (const p of pkShortcuts.pins) {
      const { leaf, sub } = split(p);
      addRow({ label: leaf, sub, path: p, cls: "pin", icon: "star", wt: isWtPath(p) });
    }
  }
  if (pkShortcuts.recents.length) {
    addHead("Recent", pkShortcuts.recents.length);
    for (const r of pkShortcuts.recents) {
      const { leaf, sub } = split(r);
      addRow({ label: leaf, sub, path: r, cls: "recent", icon: "clock", wt: isWtPath(r) });
    }
  }
  addHead("Places");
  for (const c of pkShortcuts.common)
    addRow({ label: c.replace(/^\/Users\/[^/]+/, "~"), path: c, cls: "place", icon: "folder" });

  const roots = pkKids.get(pkRoot) ?? [];
  addHead("Folders", roots.length);
  if (pkShortcuts.parent)
    addRow({ label: `Up to ${baseName(pkShortcuts.parent)}`, path: pkShortcuts.parent, cls: "up", icon: "up" });
  // `blanks` grows one entry per level as we descend: the flag says whether the ancestor at that
  // level was its parent's last child, and a spine below such an ancestor would draw a sibling that
  // does not exist.
  const emit = (parent: string, depth: number, blanks: boolean[]) => {
    const kids = pkKids.get(parent) ?? [];
    if (!kids.length && depth > 0) {
      const empty = el("div", "pknone tree");
      // depth only — the stylesheet owns the geometry and lines this up with the names above it.
      // This was `61 + depth * 26`, a copy of the guide/▸/gap widths that no longer matched either
      // the desktop or the phone once those changed.
      empty.style.setProperty("--pkdepth", String(depth));
      empty.textContent = "no subfolders";
      shell.list.appendChild(empty);
      return;
    }
    kids.forEach((n, i) => {
      const last = i === kids.length - 1;
      addRow({ label: n.name, path: n.path, cls: "dir", icon: "folder", repo: n.repo, wt: n.wt,
        depth, tree: true, blanks, last });
      if (pkOpen.has(n.path)) emit(n.path, depth + 1, [...blanks, last]);
    });
  };
  emit(pkRoot, 0, []);
  if (!roots.length) shell.list.appendChild(el("div", "pknone", "no subfolders here"));
  applyWtHide(); // honor the current "hide lanes" toggle for the freshly built rows
  if (keep) { pkFilter.value = keep; applyPkFilter(); }
}

// --- what the highlighted folder actually is (GET /api/dirinfo) ---
// The old picker could say "this is a git repo" and nothing more, so telling two similarly-named
// checkouts apart meant opening a session in one to find out.
interface DirCommit { hash: string; ts: number; subject: string }
interface DirInfoResp {
  path: string; exists: boolean; git: boolean; worktree?: boolean; branch?: string | null;
  dirty?: number; ahead?: number | null; behind?: number | null;
  last?: DirCommit | null; recent?: DirCommit[];
  entries?: { name: string; dir: boolean }[]; entryTotal?: number; hidden?: number;
  lanes?: number; error?: string;
}
let pkInfoSeq = 0; // latest-wins: arrow-keying down a list outruns the fetches it starts

// A 404 on a route this page KNOWS about means one specific thing in Fleet, and it is worth saying
// out loud rather than spinning: `bun run build` publishes the client instantly (the server serves
// public/app.js off disk), while new server ROUTES only exist after srv restarts. So a freshly built
// dashboard talks to a pre-change server until someone kills the srv session — and every call to a
// route added in the same change 404s. That is exactly what an indefinite "reading…" was.
const SKEW_NOTE = "this page is newer than the server it is talking to — that route does not exist"
  + " there yet. Restart Fleet's srv session to pick up the new routes (the sessions survive it).";

// what the detail pane is currently able to say. A pane that can only render "loading" and "loaded"
// has no way to stop loading, which is the whole defect: showDirDetail returned early on a failed
// fetch and left the placeholder on screen forever.
type DirLoad = { st: "loading" } | { st: "ok"; info: DirInfoResp } | { st: "fail"; why: string };

async function showDirDetail(path: string) {
  const shell = pkShell;
  if (!shell) return;
  const seq = ++pkInfoSeq;
  renderDirDetail(path, { st: "loading" });
  const done = (load: DirLoad) => {
    // a superseded fetch must not paint over the row the cursor has since moved to
    if (shell.isOpen() && seq === pkInfoSeq) renderDirDetail(path, load);
  };
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!res) { done({ st: "fail", why: "couldn't reach the server — retry, or check the connection" }); return; }
  if (res.status === 404) { done({ st: "fail", why: SKEW_NOTE }); return; }
  if (!res.ok) { done({ st: "fail", why: `the server answered ${res.status} for this folder` }); return; }
  const info = (await res.json().catch(() => null)) as DirInfoResp | null;
  done(info ? { st: "ok", info } : { st: "fail", why: "the server's answer was not readable JSON" });
}

function renderDirDetail(path: string, load: DirLoad) {
  const shell = pkShell;
  if (!shell) return;
  const info = load.st === "ok" ? load.info : null;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", baseName(path)));
  shell.detail.appendChild(el("div", "pkdpath", path.replace(/^\/Users\/[^/]+/, "~")));

  // a slot already sitting in this folder is the single most useful thing to know before starting
  // another one there — Fleet will happily open two sessions on the same tree
  const open = fleet.filter((s) => s.cwd === path);
  if (open.length) {
    const who = open.map((s) => `slot ${s.id}${s.label ? ` (${s.label})` : ""}`).join(", ");
    shell.detail.appendChild(el("div", "pkdwarn", `already open in ${who}`));
  }

  const acts = el("div", "pkdacts");
  const start = el("button", "shrbtn primary", "Start session here") as HTMLButtonElement;
  start.onclick = () => void startSession(path);
  acts.appendChild(start);
  if (info?.git && !info.worktree) {
    const lane = el("button", "shrbtn", "⎇ New lane here") as HTMLButtonElement;
    lane.title = "create a git worktree (lane) in this repo and open a session in it";
    lane.onclick = () => void startWorktree(path);
    acts.appendChild(lane);
  }
  shell.detail.appendChild(acts);

  if (load.st === "loading") { shell.detail.appendChild(el("div", "shellhint", "reading…")); return; }
  if (load.st === "fail") { shell.detail.appendChild(el("div", "diffstat err", load.why)); return; }
  if (!info) return; // unreachable: st === "ok" carries one
  if (info.error) { shell.detail.appendChild(el("div", "diffstat err", info.error)); return; }
  if (!info.exists) {
    shell.detail.appendChild(el("div", "diffstat err", "this folder no longer exists"));
    return;
  }
  if (!info.git) {
    shell.detail.appendChild(el("div", "shellhint",
      "not a git repo — a session here works fine, there is just nothing to branch, diff or land"));
    appendDirContents(shell.detail, info);
    return;
  }

  const facts = el("div", "ocfacts");
  facts.appendChild(chip(info.branch ?? "detached HEAD", info.branch ? "" : "warn"));
  if (info.worktree) facts.appendChild(chip("⎇ this is a lane", "",
    "a git worktree, not the primary checkout — Fleet lanes live in <repo>.worktrees/"));
  facts.appendChild(info.dirty
    ? chip(`${info.dirty} uncommitted`, "warn")
    : chip("clean tree", "ok"));
  // ABSENT is not zero: a branch with no upstream has nothing to be ahead OF, and rendering 0/0
  // would state a comparison that was never made
  if (typeof info.ahead === "number" && typeof info.behind === "number")
    facts.appendChild(chip(`↑${info.ahead} ↓${info.behind}`, info.ahead ? "warn" : "",
      "commits ahead of / behind the upstream branch"));
  else facts.appendChild(chip("no upstream", "dim",
    "this branch tracks nothing, so there is no ahead/behind to report — not a measured zero"));
  if (info.lanes) facts.appendChild(chip(`${info.lanes} lane${info.lanes === 1 ? "" : "s"}`, "",
    "Fleet worktrees forked from this repo, in <repo>.worktrees/"));
  shell.detail.appendChild(facts);

  appendDirContents(shell.detail, info);

  // `recent` is a newer field than this route: a client built ahead of the server it talks to gets
  // `last` alone, and one commit is what it can honestly show — not a padded list of one.
  const commits = info.recent ?? (info.last ? [info.last] : []);
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Recent commits"));
  if (commits.length) sec.appendChild(el("span", "shellsecn", String(commits.length)));
  shell.detail.appendChild(sec);
  if (!commits.length) {
    shell.detail.appendChild(el("div", "shellhint", "no commits yet in this repo"));
    return;
  }
  for (const c of commits) {
    const row = el("div", "pkdcommit");
    row.appendChild(el("div", "pkdlast", c.subject));
    row.appendChild(el("div", "diffstat", `${c.hash} · ${fmtTs(c.ts)}`));
    shell.detail.appendChild(row);
  }
  // says what this list is NOT, so nobody reads five subjects as the repo's history: the audit
  // trail and the activity window's commits lens are where the full record lives.
  shell.detail.appendChild(el("div", "shellhint",
    `the newest ${commits.length} — a glance at what this repo has been doing, not its history.`
    + " The activity window's Commits lens carries the full list."));
}

// the folder's own children. This is the thing the pane was missing: a branch name and a commit
// subject do not tell two similarly-named checkouts apart, and their contents do at one glance.
// --- Contents: a tree you open IN PLACE, not a listing that sends you somewhere -----------------
//
// This list used to be one flat level, and a folder in it RE-ROOTED the tree on the left — you
// asked what is in a folder and the whole window moved. Now it opens where it stands, with the
// same guides, elbows and descender the left tree uses, so nesting is drawn rather than implied.
// Its expansion state is its OWN: the left tree answers "where do I want to work", this answers
// "what is in this project", and neither is a view of the other.
interface DirEntry { name: string; dir: boolean }
let pkdRoot = "";                                     // the folder this pane is showing
let pkdBox: HTMLElement | null = null;                // the element to repaint on expand/collapse
let pkdInfo: DirInfoResp | null = null;
const pkdOpen = new Set<string>();
const pkdKids = new Map<string, DirEntry[] | null>(); // null = read, and unreadable
const pkdBusy = new Set<string>();

// entries (files AND folders) for any path. /api/dirs is folders-only, which is right for the
// left tree and useless here. No new route: this keeps the whole change client-side, so it goes
// live on `bun run build` without an srv restart.
async function fetchEntries(path: string): Promise<DirEntry[] | null> {
  const res = await api(`/api/dirinfo?path=${encodeURIComponent(path)}`).catch(() => null);
  if (!res || !res.ok) return null;
  const d = (await res.json().catch(() => null)) as DirInfoResp | null;
  return d?.entries ?? null;
}

async function toggleContents(path: string) {
  if (pkdOpen.has(path)) { pkdOpen.delete(path); paintContents(); return; }
  if (!pkdKids.has(path)) {
    if (pkdBusy.has(path)) return;
    pkdBusy.add(path);
    paintContents();                                  // the row says it is working
    const kids = await fetchEntries(path);
    pkdBusy.delete(path);
    // an unreadable folder caches as null rather than retrying on every click — the row then says
    // so, which is the same bargain the left tree makes
    pkdKids.set(path, kids);
  }
  pkdOpen.add(path);
  paintContents();
}

function contentsRow(e: DirEntry, path: string, depth: number, blanks: boolean[], last: boolean,
                     rootPath: string): HTMLElement {
  const open = e.dir && pkdOpen.has(path);
  const row = el("div", `pkdent${e.dir ? " dir" : ""}${open ? " open" : ""}`);
  row.title = path;
  const lead = el("span", "pklead");
  for (let i = 0; i <= depth; i++) {
    const g = el("span", "pkguide");
    if (i === depth) g.classList.add(last ? "end" : "branch");
    else if (blanks[i]) g.classList.add("blank");
    lead.appendChild(g);
  }
  // a FILE reserves the same column the ▸ occupies. It has nothing to expand, but taking the
  // column away would step every filename left of its sibling folders and undo the alignment the
  // guides just established.
  const tw = el("span", `pktw${open ? " open" : ""}`,
    e.dir ? (pkdBusy.has(path) ? "·" : open ? "▾" : "▸") : "");
  if (e.dir) {
    tw.title = open ? "collapse" : "expand";
    tw.onclick = (ev) => { ev.stopPropagation(); void toggleContents(path); };
  }
  lead.appendChild(tw);
  row.appendChild(lead);
  row.appendChild(pkIcon(e.dir ? (open ? "folderOpen" : "folder") : "file"));
  row.appendChild(el("span", "pkdname", e.name + (e.dir ? "/" : "")));
  if (e.dir) {
    // re-rooting the left tree was what a click did here, and it is still worth having — it just
    // stops being what happens when you only wanted to look inside.
    const go = el("span", "pkdgo", "↗");
    go.title = `make ${e.name}/ the top of the tree on the left`;
    go.onclick = (ev) => { ev.stopPropagation(); void browse(path); };
    row.appendChild(go);
    row.onclick = () => void toggleContents(path);
  } else {
    row.onclick = () => {
      const shell = pkShell;
      if (!shell) return;
      showFileView(shell, {
        path, label: e.name,
        source: "as it is on disk right now",
        back: { label: baseName(rootPath), go: () => void showDirDetail(rootPath) },
      });
    };
  }
  return row;
}

function paintContents() {
  const box = pkdBox;
  const info = pkdInfo;
  if (!box || !info) return;
  box.replaceChildren();
  const emit = (path: string, depth: number, blanks: boolean[]) => {
    const kids = pkdKids.get(path);
    if (kids === null) {
      const bad = el("div", "pknone tree", "could not be read — that is a permissions answer");
      bad.style.setProperty("--pkdepth", String(depth));
      box.appendChild(bad);
      return;
    }
    if (!kids) return;
    if (!kids.length) {
      const none = el("div", "pknone tree", "empty");
      none.style.setProperty("--pkdepth", String(depth));
      box.appendChild(none);
      return;
    }
    kids.forEach((e, i) => {
      const last = i === kids.length - 1;
      const full = `${path}/${e.name}`;
      box.appendChild(contentsRow(e, full, depth, blanks, last, info.path));
      if (e.dir && pkdOpen.has(full)) emit(full, depth + 1, [...blanks, last]);
    });
  };
  emit(info.path, 0, []);
}

function appendDirContents(target: HTMLElement, info: DirInfoResp) {
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Contents"));
  const entries = info.entries;
  if (entries === undefined) {
    target.appendChild(sec);
    target.appendChild(el("div", "shellhint",
      "this folder's contents could not be read — that is a permissions answer, not an empty folder"));
    return;
  }
  // counted over what was actually LISTED. A capped listing says so instead of splitting a total it
  // only partly saw — the entries sort folders first, so the unlisted tail is not a known mix.
  const dirs = entries.filter((e) => e.dir).length;
  const files = entries.length - dirs;
  const total = info.entryTotal ?? entries.length;
  const parts = [`${dirs} folder${dirs === 1 ? "" : "s"}`, `${files} file${files === 1 ? "" : "s"}`];
  if (total > entries.length) parts.unshift(`${entries.length} of ${total}`);
  if (info.hidden) parts.push(`${info.hidden} hidden`);
  sec.appendChild(el("span", "shellsecn", parts.join(" · ")));
  target.appendChild(sec);
  if (!entries.length) {
    target.appendChild(el("div", "shellhint",
      info.hidden ? "nothing here but dot-entries — the folder is not empty, its contents are all hidden"
        : "this folder is empty"));
    return;
  }
  // switching to a DIFFERENT folder starts a fresh tree; re-rendering the same one (the pane
  // repaints on every selection) keeps whatever the reader has opened
  if (info.path !== pkdRoot) { pkdRoot = info.path; pkdOpen.clear(); pkdKids.clear(); pkdBusy.clear(); }
  pkdKids.set(info.path, entries);
  pkdInfo = info;
  pkdBox = el("div", "pkdtree");
  paintContents();
  target.appendChild(pkdBox);
}

// --- the file view: one renderer for every file list in the app ---------------------------------
//
// Four surfaces list files and none of them could open one: the picker's Contents, a commit's
// files, a land's footprint, and the board's changed-files card (whose rows all opened the WHOLE
// working diff, whichever row you clicked). They are the same gesture — "show me that file" — so
// they share this one function, and each caller supplies the two things only it knows: WHICH
// revision of the file it means, and what going back should return to.
//
// The honesty rule this window keeps: a file has more than one version, and the pane always says
// which one it is showing. A commit's file list is a statement about that commit; rendering
// today's bytes under it would answer a question nobody asked.
interface FileViewOpts {
  path: string;              // what to ask the server for (absolute, or repo-relative with rev)
  label: string;             // what to call it in the header
  repo?: string;             // required with rev
  rev?: string;              // absent = the file as it is on disk now
  source: string;            // one line naming WHICH version this is. Always shown.
  diff?: string;             // this file's hunk, when the caller already has it — adds the Change tab
  back: { label: string; go: () => void };
}
type FileResp = { path?: string; rev?: string | null; size?: number; text?: string;
  binary?: boolean; truncated?: boolean; error?: string };

let fileSeq = 0; // latest-wins, like every other pane that follows a moving cursor

function showFileView(shell: Shell, o: FileViewOpts) {
  const seq = ++fileSeq;
  shell.detail.replaceChildren();
  const back = el("button", "fvback", `‹ ${o.back.label}`);
  back.onclick = () => o.back.go();
  shell.detail.appendChild(back);
  shell.detail.appendChild(el("div", "rvhead", o.label));
  shell.detail.appendChild(el("div", "pkdpath", o.path.replace(/^\/Users\/[^/]+/, "~")));
  shell.detail.appendChild(el("div", "fvsource", o.source));
  const body = el("div", "fvbody");

  // the "view option": where a change EXISTS, it is the default — a file in a commit is interesting
  // for what the commit did to it. The whole file is one click away, never the other way round.
  let tab: "change" | "file" = o.diff ? "change" : "file";
  const tabs = el("div", "actlens");
  const paint = () => {
    for (const b of Array.from(tabs.children)) b.classList.toggle("active",
      (b as HTMLElement).dataset.tab === tab);
    body.replaceChildren();
    if (tab === "change" && o.diff) {
      const box = el("div", "difftxt");
      renderDiffInto(box, o.diff);
      body.appendChild(box);
      return;
    }
    body.appendChild(el("div", "shellhint", "reading the file…"));
    void loadFile(o).then((r) => {
      if (!shell.isOpen() || seq !== fileSeq) return;
      body.replaceChildren();
      renderFileBody(body, o, r);
    });
  };
  if (o.diff) {
    for (const [k, text] of [["change", "What this changed"], ["file", "The whole file"]] as const) {
      const b = el("button", "shrbtn", text) as HTMLButtonElement;
      b.dataset.tab = k;
      b.onclick = () => { if (tab !== k) { tab = k; paint(); } };
      tabs.appendChild(b);
    }
    shell.detail.appendChild(tabs);
  }
  shell.detail.appendChild(body);
  paint();
  if (isMobile()) shell.showDetail(true);
}

async function loadFile(o: FileViewOpts): Promise<FileResp | null> {
  const q = new URLSearchParams({ path: o.path });
  if (o.rev && o.repo) { q.set("rev", o.rev); q.set("repo", o.repo); }
  const res = await api(`/api/file?${q.toString()}`).catch(() => null);
  if (!res) return { error: "couldn't reach the server" };
  if (res.status === 404 && !res.headers.get("content-type")?.includes("json")) return { error: SKEW_NOTE };
  return (await res.json().catch(() => null)) as FileResp | null;
}

function renderFileBody(body: HTMLElement, o: FileViewOpts, r: FileResp | null) {
  if (!r) { body.appendChild(el("div", "diffstat err", "the server's answer was not readable JSON")); return; }
  if (r.error) { body.appendChild(el("div", "diffstat err", r.error)); return; }
  if (r.binary) {
    body.appendChild(el("div", "shellhint",
      "this is a binary file — there is nothing to read as text, and showing the decode would be"
      + " noise, not content"));
    return;
  }
  const text = r.text ?? "";
  if (!text) { body.appendChild(el("div", "shellhint", "this file is empty")); return; }
  // EVERY file is shown as its own text, .md included. The tempting move is to run mdInto over
  // markdown, and it would be a lie dressed as a feature: mdInto gives structure to ``` fences and
  // nothing else (deliberately — it renders hostile transcript text, so no other markdown may
  // become markup). A viewer is for reading what the file SAYS; rendering it would hide the source
  // this one exists to show.
  const pre = el("div", "fvtext");
  pre.textContent = text;
  body.appendChild(pre);
  const facts: string[] = [];
  if (typeof r.size === "number") facts.push(`${(r.size / 1024).toFixed(1)} KB`);
  facts.push(`${text.split("\n").length} lines`);
  body.appendChild(el("div", "diffstat", facts.join(" · ")));
  if (r.truncated) body.appendChild(el("div", "ocwarn",
    "this file is longer than the viewer serves — what is above is the beginning of it, not all of it"));
}

// pin/unpin round-trips to the server (pins follow the owner across devices), then re-renders
async function togglePin(path: string) {
  const res = await post("/api/pins", { path, on: !pkPins.has(path) });
  if (!res.ok) return;
  const data = (await res.json()) as { pins?: string[] };
  pkPins = new Set(data.pins ?? []);
  const keepFilter = pkFilter.value; // browse() clears it — restore so ⌘D-pin keeps your context
  await browse(pkPathIn.value); // rebuild the Pinned section + star states from the new set
  if (keepFilter) { pkFilter.value = keepFilter; applyPkFilter(); }
}

async function startSession(path: string) {
  if (!pickerSlot) return;
  const slot = pickerSlot;
  const res = await post(`/api/slots/${slot}/open`, { cwd: path });
  if (!res.ok) {
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    return;
  }
  closePicker();
  await refresh();
  showSlot(slot);
}

async function startWorktree(repo: string) {
  if (!pickerSlot) return;
  const slot = pickerSlot;
  // branch names are plumbing, not something to type: the server auto-names the lane
  // (fleet/<stamp>-<rand>) and the slot label is what you actually rename
  const res = await post(`/api/slots/${slot}/open-worktree`, { repo, branch: "" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    pkPathIn.classList.add("bad");
    setTimeout(() => pkPathIn.classList.remove("bad"), 1200);
    if (err.error) alert(`Lane failed: ${err.error}`);
    return;
  }
  closePicker();
  await refresh();
  showSlot(slot);
}

function openPicker(slotId: number) {
  setDrawer(false);
  pkShell?.close();
  pickerSlot = slotId;
  const shell = openShell({
    id: "picker",
    title: `New session — slot ${slotId}`,
    listWidth: 460,
    onSelect: (row) => {
      const hit = pkRows.find((r) => r.row === row.el);
      if (hit) void showDirDetail(hit.path);
    },
    onClose: () => { pickerSlot = 0; pkShell = null; pkRows = []; },
  });
  pkShell = shell;

  // --- the window's controls. Line 1 is the fast path (filter + lane toggle); the breadcrumb and
  // the type-a-path box wrap onto line 2, where they are navigation rather than the common case.
  pkFilter = el("input", "pkfilterin") as HTMLInputElement;
  pkFilter.type = "text";
  pkFilter.spellcheck = false;
  pkFilter.autocomplete = "off";
  // a phone has no ⌘, no double-click idiom and no arrow keys: the desktop legend is not a shorter
  // version of the truth there, it is the wrong instructions
  pkFilter.placeholder = isMobile()
    ? "filter folders"
    : "filter — ↑↓ select · ⌘Enter or double-click start · Enter re-root · ⌘D pin";
  pkHideBtn = el("button", "pktoggle") as HTMLButtonElement;
  pkHideBtn.onclick = () => {
    hideWorktrees = !hideWorktrees;
    localStorage.setItem("fleet.hidewt", hideWorktrees ? "1" : "0");
    renderHideWtBtn();
    applyWtHide();
  };
  renderHideWtBtn();
  pkCrumb = el("div", "pkcrumb");
  pkCrumb.setAttribute("aria-label", "current location");
  pkPathIn = el("input", "pkpathin") as HTMLInputElement;
  pkPathIn.type = "text";
  pkPathIn.spellcheck = false;
  pkPathIn.autocomplete = "off";
  pkPathIn.placeholder = "or type a path";
  pkPathIn.dataset.ownEnter = "1"; // Enter here goes to what was TYPED, not to the selected row
  const line2 = el("div", "pkline2");
  line2.append(pkCrumb, pkPathIn);
  shell.tools.append(pkFilter, pkHideBtn, line2);

  pkFilter.addEventListener("input", applyPkFilter);
  pkPathIn.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    void browse(pkPathIn.value);
  });
  // ⌘Enter starts, ⌘D pins. Both ride on the shell root: the shell skips modified Enter precisely
  // so a view can claim it, and it never binds plain letters at all.
  shell.root.addEventListener("keydown", (e) => {
    const target = () => {
      const i = shell.selectedIndex();
      const vis = pkVisible();
      return i >= 0 && vis[i] ? vis[i].path : pkPathIn.value;
    };
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void startSession(target()); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === "d" || e.key === "D")) { e.preventDefault(); void togglePin(target()); }
    // →/← walk the tree. Only on tree rows: a shortcut row has no children to open, and swallowing
    // the arrows inside the filter box would break moving the caret through what you typed.
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = shell.selectedIndex();
    const hit = i >= 0 ? pkVisible()[i] : undefined;
    if (!hit || !hit.row.classList.contains("tree")) return;
    if ((e.target as HTMLElement | null)?.tagName === "INPUT" && pkFilter.value) return;
    e.preventDefault();
    if (e.key === "ArrowRight") { if (!pkOpen.has(hit.path)) void toggleNode(hit.path); }
    else if (pkOpen.has(hit.path)) void toggleNode(hit.path);
  });

  shell.foot.textContent = isMobile()
    ? "tap ▸ to open a folder in place · tap its name for what is inside it · “start ▸” opens a"
      + " session there · ‹ goes back"
    : "click selects and opens · double-click (or ⌘Enter) starts a session here"
      + " · →/← expand and collapse · Enter re-roots the tree · ⌘D pins";

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
        rb.title = "agent conflict resolutions nobody has reviewed — review & land (open the board)";
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
//
// …and SAY SO in the meantime, because "as soon as the tab is hidden" never arrives for the one
// window the owner keeps in front of them. That is not a hypothetical: a deploy landed, the
// dashboard was checked, and the new work was simply absent — the page had been in the foreground
// the whole time, the self-heal was armed and waiting, and nothing on screen said a newer client
// existed. The comment above already predicted "missing buttons read as regression"; it did not
// predict that the reader would be the owner. Deliberately NOT the .plaudit bar — that channel is
// the post-land audit ALARM, and "there is a newer build" is not an alarm.
let bundleV = 0;
let reloadArmed = false;
function armReload() {
  if (reloadArmed) return;
  reloadArmed = true;
  if (document.hidden) { location.reload(); return; }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) location.reload();
  });
  if (document.getElementById("newver")) return;
  const b = el("button", "", "a newer version is ready — reload");
  b.id = "newver";
  b.title = "the server is serving a newer client than this page is running";
  b.onclick = () => location.reload();
  document.body.appendChild(b);
}

// --- verification tier 2 on the board: the post-land audit alarm --------------------------------
// The server runs the full suite AFTER every land that moves main and gates NOTHING on the outcome
// (server.ts, runPostLandAudit). Rendering it is therefore the entire safety net — an audit nobody
// reads is an audit that never ran. The result rode the 2s poll payload for a client that had no
// reader at all, and two RED audits on 2026-07-26 went unread as the direct consequence.
//
// Three rules, which is why this is a pure classifier rather than a branch inside refresh():
//  · GREEN says nothing. The expected case earns no chrome.
//  · RED and UNKNOWN are both alarms and stay DISTINCT. Red is a measured failure; unknown is a
//    measurement that never happened (timed out / could not start / declined to run). Folding
//    unknown into green would fabricate a pass; folding it into red would fabricate a defect.
//  · The alarm NAMES the land(s) it followed — "something is red" without "after which land" is not
//    actionable — and survives until the owner acknowledges THAT audit (the ack is keyed to its
//    `at`) or the server's newest audit comes back green, which is what supersedes it here: this
//    payload carries the newest row only.
const PLA_ACK_KEY = "fleet.plaudit.ack";
// the compact projection postLandAuditSummary() ships. Tolerant on the wire by design: an older
// server, or a row written before a field existed, must degrade to "not recorded" — never to a claim.
interface PlaAlarm { tone: "red" | "unknown"; headline: string; where: string; note: string }
function postLandAlarm(a: PostLandAuditInfo | null, ackedAt: number): PlaAlarm | null {
  if (!a || a.result === "green") return null;
  if (a.at === ackedAt) return null;
  // anything that is neither of the two known non-green states is still an alarm, and it is NOT
  // called red: from here an unrecognised result is a measurement this client cannot read.
  const tone: PlaAlarm["tone"] = a.result === "red" ? "red" : "unknown";
  const covered = a.covers ?? [];
  const where = [
    `${a.repo ?? "(repo not recorded)"} ${a.main ?? "?"}@${(a.mainSha ?? "").slice(0, 8) || "????????"}`,
    covered.length ? `after landing ${covered.join(", ")}` : "which land it followed is NOT recorded on this audit",
    ...(a.reason ? [a.reason] : []),
  ].join(" · ");
  return tone === "red"
    ? { tone, where, headline: "POST-LAND AUDIT FAILED — the full suite is failing on the integration tip",
        note: "This audit gates nothing and nothing was rolled back. ↩ undo-land reverses only the NEWEST land." }
    : { tone, where, headline: "POST-LAND AUDIT DID NOT MEASURE — no verdict exists for this land",
        note: "A measurement that did not happen is not a pass. Nothing about the integration tip has been checked." };
}
let postLandAudit: PostLandAuditInfo | null = null;
function renderPostLandAudit() {
  const bar = $("plaudit");
  const al = postLandAlarm(postLandAudit, Number(localStorage.getItem(PLA_ACK_KEY) ?? 0));
  if (!al) {
    bar.replaceChildren();
    bar.style.display = "none";
    return;
  }
  const body = el("div", "plabody");
  body.appendChild(el("div", "plahd", al.headline));
  body.appendChild(el("div", "plawhere", al.where));
  body.appendChild(el("div", "planote", `${fmtTs(postLandAudit?.at ?? 0)} · ${al.note}`));
  const ack = el("button", "plaack", "acknowledge") as HTMLButtonElement;
  ack.title = "hide this alarm. The dismissal is keyed to THIS audit — the next non-green one raises it again.";
  ack.onclick = () => {
    localStorage.setItem(PLA_ACK_KEY, String(postLandAudit?.at ?? 0));
    renderPostLandAudit();
  };
  bar.className = `plaudit ${al.tone}`;
  bar.replaceChildren(body, ack);
  bar.style.display = "flex";
}

let chipCmds: string[] = [];
let lastRender = "";
async function refresh() {
  try {
    const res = await api("/api/sessions");
    if (!res.ok) return;
    const data = (await res.json()) as { now: number; chips: string[]; shareBase?: string;
      v?: number; autos?: AutoInfo[]; slots: SlotInfo[]; tasks?: TaskInfo[]; dispatch?: DispatchInfo; intake?: boolean;
      postLandAudit?: PostLandAuditInfo | null };
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
    // tier 2's only reader. Rendered on every poll rather than behind the render-key diff below:
    // that key is about the slot tiles, and an alarm must not wait on an unrelated change to appear.
    postLandAudit = data.postLandAudit ?? null;
    renderPostLandAudit();
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
        // every git field renderSlots actually paints, or the skip-the-rebuild shortcut below
        // silently freezes it: `behind` was missing here while the lane dot's tooltip has shown
        // it since the dot existed, so a lane falling behind main kept the old count until some
        // OTHER field moved. Adding a rendered field here is not optional.
        s.git?.branch, s.git?.dirty, s.git?.ahead, s.git?.behind, !!s.worktree])]);
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
// --- the poll pump: every recurring fetch this page makes is armed HERE, so there is
// exactly one place that knows about document.hidden and one place the data-saver switch
// has to reach. A hidden tab polls nothing at all — it has no viewer, and on a phone
// "hidden" is the normal state (screen off, app switched away) while the socket lives on.
// Coming back fires one immediate catch-up round, never a backlog of missed ticks:
// refresh() is a full-state read (the last one wins) and pollChat() is a delta read.
let pollTimer: ReturnType<typeof setInterval> | undefined;
let boardTimer: ReturnType<typeof setInterval> | undefined;
function armPolls() {
  clearInterval(pollTimer); pollTimer = undefined;
  clearInterval(boardTimer); boardTimer = undefined;
  const p = plan();
  if (p.pollMs) pollTimer = setInterval(() => void refresh(), p.pollMs);
  if (p.boardMs) boardTimer = setInterval(() => void renderBoard(), p.boardMs);
}
document.addEventListener("visibilitychange", () => {
  armPolls();
  for (const p of panes) p.chatPump(); // stops the chat chain on the way out, restarts it on the way back
  if (document.hidden) return;
  void refresh(); // the sidebar is stale by exactly the time we spent hidden — fix it now
  void renderBoard();
});

// --- the data-saver switch itself (persisted per device, like the board/histall toggles) ---
const saverBtn = $("saverbtn") as HTMLButtonElement;
const SAVER_TITLE = "data saver — slower polls (sidebar/chat/brief lag a few seconds) and a"
  + " shorter scrollback seed on reconnect. The terminal itself is unaffected.";
function applySaver() {
  saverBtn.classList.toggle("active", dataSaver);
  saverBtn.title = `${SAVER_TITLE}\ncurrently: ${dataSaver ? "ON" : "off"}`;
  armPolls();
  for (const p of panes) p.chatPump(); // pick up the new chat interval without waiting out the old one
}
function setSaver(on: boolean) {
  dataSaver = on;
  localStorage.setItem("fleet.datasaver", on ? "1" : "0");
  applySaver();
}
saverBtn.onclick = () => setSaver(!dataSaver);
applySaver(); // also the initial arm of the pump

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

// --- the review window: what changed, file by file, and the commits that made it ---
//
// Replaces two single-column overlays. Both dumped a whole `git diff` into one 900px box with no
// way to reach a particular file, and neither could show a commit at all — the commit LIST had no
// route until this window needed one (server.ts, slotCommits). The two entry points survive as
// wrappers because six call sites in the board and sidebar use them by name.
function renderDiffInto(target: HTMLElement, diff: string) {
  // colorize by line prefix — each line is its own textContent node, never innerHTML
  for (const line of diff.split("\n")) {
    const cls = line.startsWith("+") ? "add" : line.startsWith("-") ? "del"
      : (line.startsWith("@@") || line.startsWith("diff ")) ? "hdr" : "";
    const span = el("span", cls, line + "\n");
    target.appendChild(span);
  }
}

// A unified diff's content lines always carry a ' ', '+' or '-' prefix, so `diff --git` at column
// zero is always a file header — the split needs no state machine and file CONTENT cannot spoof it.
interface DiffFile { path: string; text: string; add: number; del: number }
function diffPath(header: string): string {
  // `a/x b/x` for an edit; a rename has two different paths and is shown as such. Matching the
  // same path on both sides first is what keeps filenames containing spaces intact.
  const same = /^diff --git a\/(.+) b\/\1$/.exec(header);
  if (same) return same[1];
  const two = /^diff --git a\/(.+?) b\/(.+)$/.exec(header);
  return two ? `${two[1]} → ${two[2]}` : header.slice("diff --git ".length);
}
function splitDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let cur: DiffFile | undefined;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = { path: diffPath(line), text: line, add: 0, del: 0 };
      files.push(cur);
      continue;
    }
    if (!cur) continue; // git emits nothing before the first header; a truncation marker lands here
    cur.text += `\n${line}`;
    if (line.startsWith("+") && !line.startsWith("+++")) cur.add++;
    else if (line.startsWith("-") && !line.startsWith("---")) cur.del++;
  }
  return files;
}

type RvSource = "working" | "land";
interface RvDiff {
  heading: string;
  stat: string;
  files: DiffFile[];
  diff: string;
  truncated: boolean;
  // exactly one of these when there is no diff to show. `error` is a refusal from the server;
  // `loadFailed` is a dropped fetch and must never be worded as "nothing changed"; `empty` is a
  // real, measured absence of changes.
  error?: string;
  loadFailed?: boolean;
  empty?: string;
}
interface RvCommit { hash: string; ts: number; subject: string; stat: string }
interface RvCommits { scope: "lane" | "upstream" | "recent"; base: string | null; branch: string | null;
  commits: RvCommit[]; capped: boolean }
// what the commit section is a list OF. "recent" is not a claim about this session's work and is
// worded so — the server can offer no better answer for a branch with no upstream.
const RV_SCOPE: Record<RvCommits["scope"], { head: string; note: string }> = {
  lane: { head: "Commits on this lane", note: "this lane's own commits, since it forked" },
  upstream: { head: "Commits not yet pushed", note: "commits here that the upstream branch does not have" },
  recent: { head: "Recent commits in this repo", note: "this branch has no upstream, so there is no"
    + " \"commits made here\" to compute — this is recent history, NOT a statement about this session" },
};

async function fetchWorkingDiff(slotId: number): Promise<RvDiff> {
  const res = await api(`/api/slots/${slotId}/diff`).catch(() => null);
  if (!res || !res.ok) return { heading: "Working diff", stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  const d = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean;
      sessionScoped?: boolean; error?: string };
  const heading = d.sessionScoped
    ? "Session diff — everything this session changed" : "Working diff (uncommitted)";
  if (d.error) return { heading, stat: "", files: [], diff: "", truncated: false, error: d.error };
  const n = d.status?.length ?? 0;
  const diff = d.diff ?? "";
  return {
    heading,
    stat: `${d.branch ?? "?"} · ${n} file${n === 1 ? "" : "s"} changed${d.truncated ? " · diff truncated" : ""}`,
    files: splitDiff(diff), diff, truncated: !!d.truncated,
    empty: diff ? undefined : n
      ? "(changes are untracked — no tracked diff)"
      : d.sessionScoped ? "this session hasn't changed anything yet"
        : "clean working tree — everything is committed",
  };
}

async function fetchLandDiff(slotId: number): Promise<RvDiff> {
  const res = await api(`/api/slots/${slotId}/merge-diff`).catch(() => null);
  const heading = "What will land on main (main…HEAD)";
  // fail closed, as the land confirm does: a dropped fetch must not read as "no changes to land"
  if (!res || !res.ok) return { heading, stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  const d = (await res.json().catch(() => ({ loadFailed: true }))) as
    { main?: string; branch?: string; files?: string[]; diff?: string; truncated?: boolean;
      error?: string; loadFailed?: boolean };
  if (d.loadFailed) return { heading, stat: "", files: [], diff: "", truncated: false, loadFailed: true };
  if (d.error) return { heading, stat: "", files: [], diff: "", truncated: false, error: d.error };
  const n = d.files?.length ?? 0;
  const diff = d.diff ?? "";
  return {
    heading,
    stat: `${d.branch ?? "?"} → ${d.main ?? "main"} · ${n} file${n === 1 ? "" : "s"}${d.truncated ? " · diff truncated" : ""}`,
    files: splitDiff(diff), diff, truncated: !!d.truncated,
    empty: diff ? undefined : "no committed changes to land",
  };
}

function rvDelta(add: number, del: number): HTMLElement {
  const w = el("span", "shrdelta");
  w.appendChild(el("span", "a", `+${add}`));
  w.appendChild(el("span", "d", `−${del}`));
  return w;
}

// what the detail pane is currently showing. A commit is keyed by hash, not by index, so a
// re-render that reorders the list can never swap which commit is on screen. A file carries the
// hash it belongs to (absent = a file of the whole-range diff), because the same path means two
// different diffs depending on whether you reached it through a commit or through the range.
// `untracked` is its own kind because an untracked file HAS no diff — it is not in `git diff` at
// all. Treating it as a file pick would render "that file is no longer in this diff", which is
// true and useless; the file itself is the whole of what is new about it.
type RvPick = { k: "all" } | { k: "file"; path: string; hash?: string } | { k: "commit"; hash: string }
  | { k: "untracked"; path: string };
const samePick = (a: RvPick, b: RvPick): boolean =>
  a.k === b.k
  && (a.k !== "file" || (a.path === (b as { path: string }).path && a.hash === (b as { hash?: string }).hash))
  && (a.k !== "untracked" || a.path === (b as { path: string }).path)
  && (a.k !== "commit" || a.hash === (b as { hash: string }).hash);
// the commit whose content is on screen, whether it was reached directly or through one of its files
const pickCommit = (p: RvPick): string | undefined => p.k === "commit" ? p.hash : p.k === "file" ? p.hash : undefined;

let rvShell: Shell | null = null;

// `startAt` lets a caller open the window ON a file — the board's changed-files card does, because
// clicking one of its rows used to open the whole working diff whichever row you clicked.
async function openReview(slotId: number, initial: RvSource, startAt?: RvPick) {
  setDrawer(false);
  // the other three windows already do this. Without it a double-click on ± stacks two review
  // windows: openShell() runs synchronously before any fetch, so both exist, both fetch, and one
  // Escape closes both (capture-phase listeners on the same node are not stopped by
  // stopPropagation). One window per surface, closed by whoever opens the next.
  rvShell?.close();
  const isLane = !!fleet.find((s) => s.id === slotId)?.worktree;
  let source: RvSource = isLane ? initial : "working";
  let pick: RvPick = startAt ?? { k: "all" };
  const diffs = new Map<RvSource, RvDiff>();
  let commits: RvCommits | null = null;
  let commitsErr: string | null = null;
  // one entry per commit whose diff has been fetched — a commit is immutable, so this never goes stale
  const commitDiffs = new Map<string, { files: DiffFile[]; diff: string; truncated: boolean; failed?: boolean }>();

  const shell = openShell({
    id: "review",
    title: "Review",
    subtitle: "loading…",
    detailHint: "Pick a file or a commit on the left — “All changes” shows the whole diff.",
    listWidth: 370,
    onClose: () => { rvShell = null; },
  });
  rvShell = shell;

  const showDiffText = (target: HTMLElement, text: string) => {
    const box = el("div", "difftxt");
    renderDiffInto(box, text);
    target.appendChild(box);
  };

  // The window HEADER carries what the current source is; the detail carries what the current
  // PICK is. Repeating the heading in both (the first cut did) reads as two different statements
  // about the same thing, so "all changes" deliberately renders no heading of its own.
  // the diff answers "what changed"; this answers "what does the file SAY". Same viewer as the
  // picker's Contents and the Commits lens, and it names its revision: on a commit's file that is
  // the commit, on a working-tree file it is the disk. A diff alone cannot tell you whether the
  // three lines above the hunk make sense.
  const rvWholeFile = (path: string, text: string, hash: string | null) => {
    const cwd = fleet.find((s) => s.id === slotId)?.cwd;
    if (!cwd) return;
    const b = el("button", "shrbtn fvopen", "read the whole file") as HTMLButtonElement;
    b.onclick = () => showFileView(shell, {
      path: hash ? path : `${cwd}/${path}`, label: path.split("/").pop() ?? path,
      repo: hash ? cwd : undefined, rev: hash ?? undefined,
      source: hash ? `as commit ${hash} left it — not the file as it is today`
        : "as it is on disk right now, which may already be newer than this diff",
      // deliberately NO diff here, though the caller has one: the pane this button sits on IS the
      // diff. Opening the viewer on a "what changed" tab would show what the reader just clicked
      // away from. ‹ back is the way to the diff, and it is one click.
      back: { label: "the diff", go: renderDetail },
    });
    shell.detail.appendChild(b);
  };

  const renderDetail = () => {
    shell.detail.replaceChildren();
    if (pick.k === "untracked") {
      const cwd = fleet.find((s) => s.id === slotId)?.cwd;
      const path = pick.path;
      if (!cwd) { shell.detail.appendChild(el("div", "shellhint", "this slot has no working directory")); return; }
      showFileView(shell, {
        path: `${cwd}/${path}`, label: path.split("/").pop() ?? path,
        source: "untracked — git has never seen this file, so there is no diff to show. This is all"
          + " of it, as it is on disk.",
        back: { label: "all changes", go: () => open({ k: "all" }) },
      });
      return;
    }
    const d = diffs.get(source);
    if (!d) { shell.detail.appendChild(el("div", "shellhint", "loading…")); return; }
    const hash = pickCommit(pick);
    if (hash) {
      const c = commits?.commits.find((x) => x.hash === hash);
      const cd = commitDiffs.get(hash);
      shell.detail.appendChild(el("div", "rvhead", c?.subject ?? "commit"));
      shell.detail.appendChild(el("div", "diffstat",
        c ? `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}` : hash));
      if (!cd) { shell.detail.appendChild(el("div", "shellhint", "loading…")); return; }
      if (cd.failed) {
        shell.detail.appendChild(el("div", "diffstat err",
          "couldn't load this commit's diff — pick it again to retry"));
        return;
      }
      if (pick.k === "file") {
        // into a const first: `pick` is a mutable binding another closure writes, so TS drops its
        // narrowing inside the callback below
        const path = pick.path;
        const f = cd.files.find((x) => x.path === path);
        if (!f) { shell.detail.appendChild(el("div", "shellhint", "that file is not in this commit")); return; }
        shell.detail.appendChild(el("div", "rvsub", `${f.path} · +${f.add} −${f.del}`));
        rvWholeFile(f.path, f.text, hash);
        showDiffText(shell.detail, f.text);
        return;
      }
      if (!cd.diff) {
        shell.detail.appendChild(el("div", "shellhint",
          "no textual diff — a merge commit shows none here, and neither does an empty commit"));
        return;
      }
      if (cd.truncated) shell.detail.appendChild(el("div", "diffstat", "diff truncated"));
      showDiffText(shell.detail, cd.diff);
      return;
    }
    if (d.loadFailed) {
      shell.detail.appendChild(el("div", "diffstat err",
        "couldn't load this diff — retry. This is a failed fetch, not an empty diff."));
      return;
    }
    if (d.error) { shell.detail.appendChild(el("div", "diffstat", d.error)); return; }
    if (pick.k === "file") {
      const path = pick.path;
      const f = d.files.find((x) => x.path === path);
      if (!f) { shell.detail.appendChild(el("div", "shellhint", "that file is no longer in this diff")); return; }
      shell.detail.appendChild(el("div", "rvhead", f.path));
      shell.detail.appendChild(el("div", "diffstat", `+${f.add} −${f.del}`));
      rvWholeFile(f.path, f.text, null);
      showDiffText(shell.detail, f.text);
      return;
    }
    if (d.empty) { shell.detail.appendChild(el("div", "shellhint", d.empty)); return; }
    showDiffText(shell.detail, d.diff);
  };

  const open = (p: RvPick) => {
    pick = p;
    if (p.k === "commit" && !commitDiffs.has(p.hash)) {
      const hash = p.hash;
      void api(`/api/slots/${slotId}/commit-diff?hash=${encodeURIComponent(hash)}`)
        .then(async (r) => (r.ok
          ? (await r.json()) as { diff?: string; truncated?: boolean }
          : { failed: true } as const))
        .catch(() => ({ failed: true } as const))
        .then((j) => {
          const diff = "failed" in j ? "" : j.diff ?? "";
          commitDiffs.set(hash, {
            diff, files: splitDiff(diff),
            truncated: "failed" in j ? false : !!j.truncated,
            failed: "failed" in j,
          });
          if (shell.isOpen() && pick.k === "commit" && pick.hash === hash) renderDetail();
        });
    }
    renderList();
    renderDetail();
    shell.showDetail(true);
  };

  function renderList() {
    shell.list.replaceChildren();
    const rows: ShellRow[] = [];
    let selIdx = -1;
    const sec = (text: string, n?: number, title?: string) => {
      const h = el("div", "shellsec");
      h.appendChild(el("span", "shellsect", text));
      if (n !== undefined) h.appendChild(el("span", "shellsecn", String(n)));
      if (title) h.title = title;
      shell.list.appendChild(h);
    };
    const row = (o: { name: string; sub?: string; right?: HTMLElement; on: RvPick; title?: string;
        ctx?: boolean }) => {
      const r = el("div", `shellrow${o.ctx ? " ctx" : ""}`);
      if (o.title) r.title = o.title;
      const m = el("div", "shrmain");
      m.appendChild(el("div", "shrname", o.name));
      if (o.sub) m.appendChild(el("div", "shrsub", o.sub));
      r.appendChild(m);
      if (o.right) r.appendChild(o.right);
      const act = () => open(o.on);
      r.onclick = act;
      shell.list.appendChild(r);
      if (samePick(o.on, pick)) { r.classList.add("sel"); selIdx = rows.length; }
      rows.push({ el: r, open: act });
    };

    const d = diffs.get(source);
    row({ name: "All changes", sub: d?.stat || undefined, on: { k: "all" } });
    // the file section follows the SELECTION: with a commit open it lists that commit's files, so
    // the list and the diff on screen are never statements about two different sets of changes
    const hash = pickCommit(pick);
    const cd = hash ? commitDiffs.get(hash) : undefined;
    const files = cd ? cd.files : d?.files ?? [];
    if (files.length) {
      sec(cd ? "Files in this commit" : "Changed files", files.length);
      for (const f of files) row({ name: f.path.split("/").pop() ?? f.path, sub: f.path,
        right: rvDelta(f.add, f.del), on: { k: "file", path: f.path, hash }, title: f.path });
    }
    if (commits?.commits.length) {
      const sc = RV_SCOPE[commits.scope];
      sec(sc.head, commits.commits.length, sc.note);
      for (const c of commits.commits)
        row({ name: c.subject || "(no subject)", on: { k: "commit", hash: c.hash },
          // a file of this commit is selected → mark the commit as the context that file sits in
          ctx: c.hash === hash && pick.k === "file",
          sub: `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}` });
      if (commits.capped) shell.list.appendChild(el("div", "shellhint", "…older commits not listed"));
    }
    if (commitsErr) {
      sec("Commits");
      shell.list.appendChild(el("div", "diffstat err", commitsErr));
    }
    shell.setRows(rows);
    if (selIdx >= 0) shell.select(selIdx, false, false);
  }

  const renderTools = () => {
    shell.tools.replaceChildren();
    if (isLane) {
      for (const [s, label, title] of [
        ["land", "to land", "the resolved diff against main — exactly what a land would fast-forward"],
        ["working", "uncommitted", "what is changed in the lane's tree right now, not yet committed"],
      ] as [RvSource, string, string][]) {
        const b = el("button", `shrbtn${source === s ? " active" : ""}`, label) as HTMLButtonElement;
        b.title = title;
        b.onclick = () => { if (source !== s) { source = s; pick = { k: "all" }; void load(); } };
        shell.tools.appendChild(b);
      }
    }
    const d = diffs.get(source);
    // the ⏏ button appears only on a land diff that actually loaded and has content — the same
    // fail-closed posture as the land confirm, which is where the real gate still lives
    if (isLane && source === "land" && d && !d.loadFailed && !d.error && !d.empty) {
      const land = el("button", "shrbtn primary", "⏏ land") as HTMLButtonElement;
      land.style.marginLeft = "auto";
      land.onclick = () => { shell.close(); void doMergeLand(slotId); };
      shell.tools.appendChild(land);
    }
  };

  const load = async () => {
    renderTools();
    renderList();
    renderDetail();
    if (!diffs.has(source)) {
      diffs.set(source, source === "land" ? await fetchLandDiff(slotId) : await fetchWorkingDiff(slotId));
      if (!shell.isOpen()) return;
    }
    const d = diffs.get(source);
    shell.setTitle(d?.heading ?? "Review");
    shell.setSubtitle(d?.stat ?? "");
    renderTools();
    renderList();
    renderDetail();
  };

  void load();
  // same failure class as the picker's detail pane: a commit list that cannot load must SAY so.
  // Left silent, a 404 from a server older than this page renders as "this lane has no commits" —
  // a positive claim about the repo, produced from a failed request.
  void api(`/api/slots/${slotId}/commits`)
    .then(async (r) => (r.ok
      ? { c: (await r.json()) as RvCommits }
      : { err: r.status === 404 ? SKEW_NOTE : `couldn't load the commits (${r.status})` }))
    .catch(() => ({ err: "couldn't load the commits — the request failed" }))
    .then((res) => {
      if (!shell.isOpen()) return;
      if ("c" in res && res.c) commits = res.c;
      else if ("err" in res && res.err) commitsErr = res.err;
      renderList();
    });
}

// six call sites across the board and the sidebar reach the window through these two names
async function openDiff(slotId: number) { await openReview(slotId, "working"); }
async function openMergeDiff(slotId: number) { await openReview(slotId, "land"); }

// --- task queue window ---
//
// The queue was a flat list in a 900px box: every task rendered its whole text into a cramped row,
// there was no search, and `created` was fetched on every open and never shown.
//
// It also had a defect that only shows up if you type slowly. refresh() calls renderQueue() on
// every 2s poll to keep the list live, and renderQueue() rebuilt the panel with replaceChildren —
// including the "new task" textarea. Typing a task for longer than two seconds LOST IT, in a file
// whose next comment down explains that rebuilds kill hover state and button focus. So the window
// is poll-safe by construction: the compose box is created once per open and the poll never touches
// it, the list is rebuilt only when the task data actually changed (key comparison, like
// renderSlots), and the detail pane is rebuilt only when the SELECTION changes.
const taskText = new Map<string, string>();
let taskTextKey = ""; // the id-set the cache was last filled for
let taskTextBusy = false;
let qShell: Shell | null = null;
let qPick: string | null = null;  // selected task id; null = the compose row
let qQuery = "";
let qKey = "";                    // the data key the list was last built from
let qCompose: HTMLTextAreaElement | null = null; // created ONCE per open — never re-created by a poll
// the task each row stands for, so keyboard nav selects directly instead of via a synthetic click
let qRowId = new Map<HTMLElement, string | null>();

// Prompt texts, cached by task id. They are not on the 2 s poll (server.ts TaskDigest) — this
// pulls them once per id-set, only while the window is actually open, and a task's text never
// changes after creation, so a cached entry stays valid until the id disappears.
async function loadTaskTexts() {
  const key = tasksList.map((t) => t.id).join(",");
  if (taskTextBusy || key === taskTextKey) return;
  taskTextBusy = true;
  let filled = false;
  try {
    const res = await api("/api/tasks");
    if (res.ok) {
      const data = (await res.json()) as { tasks: { id: string; text: string }[] };
      taskText.clear(); // the route returns every task, so this is the whole truth — no stale ids
      for (const t of data.tasks) taskText.set(t.id, t.text);
      taskTextKey = key;
      filled = true;
    }
  } catch {
    // server briefly unreachable — rows keep the placeholder, the next poll retries
  }
  taskTextBusy = false;
  if (filled) { qKey = ""; renderQueue(); } // texts arrived: the rows carry them now
}

const Q_STATUS: { k: TaskInfo["status"]; head: string }[] = [
  { k: "pending", head: "Pending" }, { k: "queued", head: "Queued" },
  { k: "sent", head: "Sent" }, { k: "done", head: "Done" },
];
const qTaskText = (id: string) => taskText.get(id) ?? "";
const qFirstLine = (id: string) => (qTaskText(id).split("\n")[0] || "…").slice(0, 120);

async function qAct(id: string, action: string) {
  const r = await post(`/api/tasks/${id}/${action}`, {});
  if (!r.ok) { toast(`couldn't ${action} the task`); return; }
  if (action === "delete" && qPick === id) qPick = null;
  await refresh();
  qKey = ""; // this changed the data — force the list to rebuild even inside the poll's guard
  renderQueue();
  renderQueueDetail();
}

function renderQueueDetail() {
  const shell = qShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  if (qPick === null) {
    shell.detail.appendChild(el("div", "rvhead", "New task"));
    shell.detail.appendChild(el("div", "shellhint",
      "Describe a feature or a fix. It lands as `pending` — only you move it to `queued`, and only"
      + " then can the dispatcher pick it up."));
    if (!qCompose) {
      qCompose = el("textarea", "qaddin") as HTMLTextAreaElement;
      qCompose.placeholder = "New task — describe a feature or fix…";
      qCompose.rows = 8;
    }
    shell.detail.appendChild(qCompose);
    const add = el("button", "shrbtn primary", "add task") as HTMLButtonElement;
    add.onclick = async () => {
      const box = qCompose;
      if (!box || !box.value.trim()) return;
      const r = await post("/api/tasks", { text: box.value, queue: false });
      if (!r.ok) { toast("couldn't add the task"); return; } // keep the typed text in the box
      box.value = "";
      await refresh();
      qKey = "";
      renderQueue();
    };
    const acts = el("div", "pkdacts");
    acts.style.marginTop = "10px";
    acts.appendChild(add);
    shell.detail.appendChild(acts);
    return;
  }
  const t = tasksList.find((x) => x.id === qPick);
  if (!t) {
    shell.detail.appendChild(el("div", "shellhint", "that task is gone — it was completed or deleted"));
    return;
  }
  shell.detail.appendChild(el("div", "rvhead", `${t.status}${t.slot ? ` · slot ${t.slot}` : ""}`));
  const meta = el("div", "ocfacts");
  meta.appendChild(chip(t.source === "intake" ? `✉ ${t.from ?? "intake"}`
    : t.source === "steward" ? "⚙ steward" : "owner"));
  meta.appendChild(chip(fmtTs(t.created), "dim", "when this task was created"));
  if (t.note) meta.appendChild(chip(t.note, "warn"));
  shell.detail.appendChild(meta);
  // the full text, wrapped and selectable — the row only ever shows its first line
  const body = qTaskText(t.id);
  shell.detail.appendChild(el("div", body ? "qdtext" : "shellhint",
    body || "loading the prompt text…"));
  const acts = el("div", "pkdacts");
  const mk = (label: string, action: string, cls = "shrbtn") => {
    const b = el("button", cls, label) as HTMLButtonElement;
    b.onclick = () => void qAct(t.id, action);
    return b;
  };
  if (t.status === "pending") acts.appendChild(mk("queue ▸", "queue", "shrbtn primary"));
  if (t.status === "queued") acts.appendChild(mk("hold", "unqueue"));
  if (t.status !== "done") acts.appendChild(mk("done", "done"));
  acts.appendChild(mk("✕ delete", "delete", "shrbtn danger"));
  shell.detail.appendChild(acts);
}

function qSelect(id: string | null) {
  qPick = id;
  qKey = ""; // selection is painted on the rows, so they must be rebuilt
  renderQueue();
  renderQueueDetail();
  qShell?.showDetail(true);
}

function renderQueue() {
  const shell = qShell;
  if (!shell || !shell.isOpen()) return;
  void loadTaskTexts(); // no-op unless the visible task set changed
  const shown = tasksList.filter((t) => !qQuery
    || qTaskText(t.id).toLowerCase().includes(qQuery)
    || t.status.includes(qQuery) || (t.note ?? "").toLowerCase().includes(qQuery));
  // REBUILD ONLY ON CHANGE. Without this the 2 s poll would rebuild the list under the cursor and
  // reset the selection every two seconds — the same class of defect as the compose box above.
  const key = JSON.stringify([qPick, qQuery, dispatch.on, dispatch.available, intakeOn,
    shown.map((t) => [t.id, t.status, t.slot, t.note, taskText.has(t.id)])]);
  if (key === qKey) return;
  qKey = key;

  const counts = Q_STATUS.map((s) => `${tasksList.filter((t) => t.status === s.k).length} ${s.k}`).join(" · ");
  shell.setSubtitle(`${counts}${intakeOn ? " · ✉ intake on" : ""}`);

  shell.list.replaceChildren();
  const rows: ShellRow[] = [];
  let selIdx = -1;
  qRowId = new Map();
  const add = (o: { name: string; sub?: string; cls?: string; id: string | null }) => {
    const r = el("div", `shellrow${o.cls ? ` ${o.cls}` : ""}`);
    qRowId.set(r, o.id);
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", o.name));
    if (o.sub) m.appendChild(el("div", "shrsub", o.sub));
    r.appendChild(m);
    const act = () => qSelect(o.id);
    r.onclick = act;
    shell.list.appendChild(r);
    if (o.id === qPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  };

  add({ name: "＋ New task", cls: "qnew", id: null });
  for (const s of Q_STATUS) {
    const group = shown.filter((t) => t.status === s.k);
    if (!group.length) continue;
    const head = el("div", "shellsec");
    head.appendChild(el("span", "shellsect", s.head));
    head.appendChild(el("span", "shellsecn", String(group.length)));
    shell.list.appendChild(head);
    for (const t of [...group].sort((a, b) => b.created - a.created))
      add({
        name: qFirstLine(t.id), id: t.id, cls: `q-${t.status}`,
        sub: [t.source === "intake" ? `✉ ${t.from ?? "intake"}` : t.source === "steward" ? "⚙ steward" : "owner",
          `${fmtDur(Math.max(0, Date.now() - t.created))} ago`,
          t.slot ? `slot ${t.slot}` : "", t.note ?? ""].filter(Boolean).join(" · "),
      });
  }
  if (!shown.length) shell.list.appendChild(el("div", "pknone",
    tasksList.length ? "no tasks match this search" : "no tasks yet"));
  shell.setRows(rows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

$("queuebtn").onclick = () => openQueue();

function openQueue() {
  setDrawer(false);
  qShell?.close();
  qPick = null;
  qQuery = "";
  qKey = "";
  qCompose = null;
  const shell = openShell({
    id: "queue",
    title: "Task queue",
    listWidth: 380,
    onSelect: (row) => { if (qRowId.has(row.el)) qSelect(qRowId.get(row.el) ?? null); },
    onClose: () => { qShell = null; qCompose = null; qRowId = new Map(); },
  });
  qShell = shell;

  const search = el("input", "pkfilterin") as HTMLInputElement;
  search.type = "text";
  search.spellcheck = false;
  search.placeholder = "search tasks — text, status or note";
  search.addEventListener("input", () => { qQuery = search.value.trim().toLowerCase(); qKey = ""; renderQueue(); });
  shell.tools.appendChild(search);

  const drow = el("div", "qdisp");
  if (dispatch.available) {
    // the strip lives OUTSIDE the poll-guarded list rebuild, so it repaints itself from `dispatch`
    // after a toggle rather than waiting for a rebuild that may never come
    const label = el("span", "");
    const toggle = el("button", "shrbtn", "") as HTMLButtonElement;
    const paint = () => {
      label.textContent = `Dispatcher ${dispatch.on ? "ON" : "off"} · repo ${baseName(dispatch.repo)} · max ${dispatch.maxLanes} lanes `;
      toggle.textContent = dispatch.on ? "turn off" : "turn on";
    };
    toggle.onclick = async () => {
      const r = await post("/api/dispatch", { on: !dispatch.on });
      if (!r.ok) toast("couldn't toggle the dispatcher");
      await refresh();
      qKey = "";
      renderQueue();
      paint();
    };
    paint();
    drow.append(label, toggle);
  } else {
    drow.textContent = "Dispatcher unavailable (set FLEET_DISPATCH_REPO to auto-run queued tasks)."
      + " Tasks are still tracked; send them by hand.";
  }
  shell.tools.appendChild(drow);

  shell.foot.textContent = "pending → queue ▸ → (the dispatcher spawns a ⎇ lane, or you send it by"
    + " hand) → ± review → ⏏ land.  Sidebar badge: •N uncommitted · ↑N to push · amber = editing ·"
    + " green = ready to land";

  renderQueue();
  renderQueueDetail();
}

// --- audit trail overlay (Backlog #9): owner-only read-only lens over /api/audit ---
// A GLOBAL log, not gated behind a live slot, because the headline question is about a slot
// that has VANISHED — its lifecycle events are unreachable from a per-slot entry point.
// One fetch, then all narrowing (slot filter, lifecycle-only) happens client-side.
interface AuditEntry { ts: number; event: string; slot?: number; detail?: string }
// event kind → category, mirroring how the server groups them (server.ts audit() call sites).
// Category drives the row colour and the lifecycle-only toggle. Unlisted kinds fall to "other".
const AUDIT_CAT: Record<string, string> = {
  slot_open: "lifecycle", slot_kill: "lifecycle", slot_shelve: "lifecycle", self_heal_recreate: "lifecycle",
  auto_fire: "automation", auto_skip: "automation", autos_quiet: "automation", autos_switch: "automation",
  steward_send: "steward", steward_task: "steward", steward_journal: "steward",
  steward_propose_outcome: "steward", steward_send_capped: "steward", steward_journal_capped: "steward",
  owner_auth_fail: "security", share_auth_ok: "security", share_create: "security", share_revoke: "security",
  share_mode_change: "security", guest_ws_connect: "security", guest_ws_disconnect: "security",
  land_note_fail: "repo", repo_undo_land: "repo",
};
const LIFECYCLE_KINDS = new Set(["slot_open", "slot_kill", "slot_shelve", "self_heal_recreate"]);
// Generic decode = show the raw detail. A per-kind formatter for the kinds whose raw string is
// cryptic and load-bearing — the ones that answer "what was DONE to slot N". Every kind listed here
// is one the live trail actually carries; nothing is written for kinds that have never occurred.
function decodeAudit(event: string, detail?: string): string {
  switch (event) {
    case "slot_open": return detail ? `opened in ${baseName(detail)}` : "opened";
    // the kill reason is recorded and was thrown away here: "landed" and "owner" are different
    // endings, and which one a vanished session had is exactly what this trail is consulted for
    case "slot_kill":
      return detail === "landed" ? "closed after landing"
        : detail === "owner" ? "closed by the owner"
        : `closed${detail ? ` (${detail})` : ""}`;
    case "slot_shelve": {
      const m = detail?.match(/^note:(\d+)$/);
      return m ? `shelved · ${m[1]}-char note` : "shelved";
    }
    // `created:no-session` / `created:no-transcript` — the reason is the whole point of the field:
    // no-session is the harmless open race, no-transcript is a slot that lost its conversation
    case "self_heal_recreate": {
      const [how, why] = (detail ?? "").split(":");
      const act = how === "resumed" ? "re-attached to its pane" : how === "created" ? "restarted fresh" : "self-healed";
      return why === "no-session" ? `${act} (its tmux session was gone)`
        : why === "no-transcript" ? `${act} (its transcript was gone)`
        : why ? `${act} (${why})` : act;
    }
    case "auto_fire": return detail ? `scheduled prompt fired · ${detail}` : "scheduled prompt fired";
    case "auto_skip": return detail ? `scheduled prompt skipped · ${detail}` : "scheduled prompt skipped";
    case "postland_audit": return detail ? `post-land audit · ${detail}` : "post-land audit";
    case "dispatch_switch": return detail === "on" ? "dispatcher switched ON" : "dispatcher switched OFF";
    case "owner_auth_fail": return "a request arrived without a valid owner token";
    // an undecoded kind keeps its NAME in front of its raw detail. Returning the bare detail (what
    // this did before) was survivable while the row carried the kind on its sub-line; now that the
    // sub-line carries the project instead, a line reading `d:0 c:true` would name nothing at all.
    default: return detail ? `${event} · ${detail}` : event;
  }
}
// WHICH PROJECT an event happened in. Not recorded per event — only `slot_open` carries a cwd — so
// it is DERIVED: an event belongs to the folder its slot was last opened in before it. Walking the
// trail is the only way to answer it, and it is the question the lens is usually being asked
// ("what did slot 7 do, and where"). A slot whose opening scrolled off the loaded window has no
// answer, and gets none — never the folder from a later open, which would date the event wrongly.
function auditProjects(rows: AuditEntry[]): Map<AuditEntry, string> {
  const out = new Map<AuditEntry, string>();
  const at = new Map<number, string>();
  // the ledger arrives newest-first; cwd propagates forward in TIME, so walk it oldest-first
  for (const e of [...rows].sort((a, b) => a.ts - b.ts)) {
    if (typeof e.slot !== "number") continue;
    if (e.event === "slot_open" && e.detail) at.set(e.slot, e.detail);
    const cwd = at.get(e.slot);
    if (cwd) out.set(e, cwd);
    // a kill ends the slot's tenancy in that folder: the next event there belongs to no project
    // until something opens one again
    if (e.event === "slot_kill") at.delete(e.slot);
  }
  return out;
}
let auditData: AuditEntry[] = [];
let auditTotal = 0; // server-reported PARSED rows on disk; > auditData.length means the load was capped
let auditMalformed = 0;
let auditSlot: number | "all" = "all";
let auditLife = false;
let auditProject = new Map<AuditEntry, string>(); // derived per render — see auditProjects()
// A ledger route now reports the rows it could not parse SEPARATELY from the total, so a torn
// mid-append row cannot masquerade as the benign "capped" message (the total used to count lines
// the response had already dropped). Absent/zero → the count line reads exactly as before.
const tornNote = (malformed: number): string =>
  malformed > 0 ? ` · ⚠ ${malformed} unreadable row${malformed === 1 ? "" : "s"} on disk` : "";

// The AUDIT lens. Same data and same two filters as the overlay it replaces; what is new is that
// selecting an event shows the rest of THAT SLOT's story around it. The trail exists to answer
// "what happened to the session that vanished", and answering it used to mean setting the slot
// filter, finding your event again in the narrowed list, and reading up and down by eye.
function renderAudit() {
  const shell = ocShell;
  if (!shell) return;
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
  sel.onchange = () => { auditSlot = sel.value === "all" ? "all" : Number(sel.value); renderActivity(); };
  ctl.appendChild(sel);
  const lifeBtn = el("button", `shrbtn${auditLife ? " active" : ""}`, "lifecycle only") as HTMLButtonElement;
  lifeBtn.title = "show only slot_open / slot_kill / slot_shelve / self_heal_recreate";
  lifeBtn.onclick = () => { auditLife = !auditLife; renderActivity(); };
  ctl.appendChild(lifeBtn);

  const rows = auditData.filter((e) =>
    (auditSlot === "all" || e.slot === auditSlot) && (!auditLife || LIFECYCLE_KINDS.has(e.event)));
  const loaded = auditData.length;
  const capped = auditTotal > loaded;
  const count = (rows.length === loaded
    ? capped ? `latest ${loaded} of ${auditTotal} events` : `${loaded} event${loaded === 1 ? "" : "s"}`
    : `${rows.length} of ${capped ? `${loaded} loaded (${auditTotal} total)` : loaded}`) + tornNote(auditMalformed);
  ctl.appendChild(el("span", "auditcount", count));
  shell.tools.appendChild(ctl);
  shell.setSubtitle(count);

  shell.list.replaceChildren();
  auditRowOf = new Map();
  auditProject = auditProjects(auditData);
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (!rows.length) shell.list.appendChild(el("div", "histnone", "no events match this filter"));
  for (const e of rows) {
    const cat = AUDIT_CAT[e.event] ?? "other";
    const r = el("div", `shellrow auditrow cat-${cat}`);
    r.title = `${e.event}${e.detail ? ` · ${e.detail}` : ""}`; // the raw record, kept reachable
    auditRowOf.set(r, e);
    r.appendChild(el("span", "aud-slot" + (typeof e.slot === "number" ? "" : " none"),
      typeof e.slot === "number" ? String(e.slot) : "—"));
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", decodeAudit(e.event, e.detail) || e.event));
    // the project comes SECOND on the sub-line: an event without one is a real state (Fleet-wide
    // events have no slot at all), and an em dash there is quieter than an absent column
    const where = auditProject.get(e);
    m.appendChild(el("div", "shrsub", `${fmtTs(e.ts)} · ${where ? baseName(where) : "no project"}`));
    r.appendChild(m);
    const key = `${e.ts}|${e.event}`;
    const act = () => { auditPick = key; renderActivity(); renderAuditDetail(e); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (key === auditPick) { r.classList.add("sel"); selIdx = shRows.length; }
    shRows.push({ el: r, open: act });
  }
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

// the selected event, then the same slot's events around it — the timeline the trail is usually
// consulted for, without re-filtering and re-finding your place.
function renderAuditDetail(e: AuditEntry) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", decodeAudit(e.event, e.detail) || e.event));
  shell.detail.appendChild(el("div", "diffstat",
    `${fmtTs(e.ts)} · ${e.event}${typeof e.slot === "number" ? ` · slot ${e.slot}` : ""}`
    + ` · ${AUDIT_CAT[e.event] ?? "other"}`));
  // where it happened, said in full — the row can only show a folder's basename, and two checkouts
  // of one repo differ in the part it has to cut
  const where = auditProject.get(e);
  if (where) shell.detail.appendChild(el("div", "pkdpath", where.replace(/^\/Users\/[^/]+/, "~")));
  else if (typeof e.slot === "number") shell.detail.appendChild(el("div", "shellhint",
    "no project on record for this event — the slot's opening is older than the loaded window,"
    + " or the slot had been closed. Deliberately not filled in from a LATER opening: that folder"
    + " is where the slot went next, not where this happened."));
  if (e.detail) shell.detail.appendChild(el("div", "qdtext", e.detail));

  if (typeof e.slot !== "number") {
    shell.detail.appendChild(el("div", "shellhint",
      "this event is not attached to a slot, so there is no per-slot timeline to show"));
    return;
  }
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", `Slot ${e.slot} around this moment`));
  shell.detail.appendChild(sec);
  // ±8 of the slot's own events, in time order (the ledger arrives newest-first). Bounded on
  // purpose: this is context for one event, not a second copy of the list on the left.
  const own = auditData.filter((x) => x.slot === e.slot);
  const at = own.findIndex((x) => x.ts === e.ts && x.event === e.event);
  const near = at < 0 ? own.slice(0, 17) : own.slice(Math.max(0, at - 8), at + 9);
  const tl = el("div", "audtl");
  for (const x of [...near].reverse()) {
    const line = el("div", `audtlrow${x.ts === e.ts && x.event === e.event ? " here" : ""}`);
    line.title = `${x.event}${x.detail ? ` · ${x.detail}` : ""}`;
    line.appendChild(el("span", "aud-ts", fmtTs(x.ts)));
    // the timeline reads as prose now: the raw kind was the wide column and said the least. It
    // stays on the row's tooltip, and the folder is shown where it CHANGES, so a slot that moved
    // between projects is visible as a move instead of as a uniform column repeated per line.
    const w = auditProject.get(x);
    line.appendChild(el("span", "aud-detail", decodeAudit(x.event, x.detail) || x.event));
    if (x.event === "slot_open" && w) line.appendChild(el("span", "aud-kind", baseName(w)));
    tl.appendChild(line);
  }
  shell.detail.appendChild(tl);
  if (own.length > near.length)
    shell.detail.appendChild(el("div", "shellhint",
      `showing ${near.length} of this slot's ${own.length} loaded events — filter the list to slot`
      + ` ${e.slot} to read them all`));
}

$("auditbtn").onclick = () => void openActivity("audit");

// --- the owner disposition rail: the one label channel for every advisory worker output
// (server.ts, grep `DISPOSITION rail`). The rule the UI must not break is that ABSENCE IS NOT
// APPROVAL — an unlabeled ref renders as unlabeled, never as accepted, so no view may default a
// missing label into a verdict. The map is a read cache of the append-only rail: newest wins,
// which is exactly "the owner changed their mind" and needs no server-side mutation.
interface DispoRow { at?: number; worker?: string; ref?: string; disposition?: string }
const dispoByRef = new Map<string, DispositionVerdict>();
// the join keys, mirroring the server's documented ref shapes. `land` is branch@ts because ts is
// the only field EVERY outcome row carries; a row whose branch was never recorded still joins.
const landRef = (o: { branch?: string | null; ts: number }) => `${o.branch ?? "(branch not recorded)"}@${o.ts}`;
const dispoKey = (worker: string, ref: string) => `${worker}\u0000${ref}`;
function dispoOf(worker: DispositionWorker, ref: string | null | undefined): DispositionVerdict | null {
  return ref ? dispoByRef.get(dispoKey(worker, ref)) ?? null : null;
}
async function loadDispositions(): Promise<void> {
  const res = await api("/api/dispositions?limit=2000");
  if (!res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { dispositions?: DispoRow[] };
  dispoByRef.clear();
  // newest-first from the server → the FIRST row for a ref is the current verdict; later
  // (older) rows for the same ref are superseded history and must not overwrite it
  for (const d of data.dispositions ?? []) {
    if (typeof d.worker !== "string" || typeof d.ref !== "string" || !d.ref) continue;
    if (!DISPOSITION_VERDICTS.includes(d.disposition as DispositionVerdict)) continue;
    const k = dispoKey(d.worker, d.ref);
    if (!dispoByRef.has(k)) dispoByRef.set(k, d.disposition as DispositionVerdict);
  }
}
// one write. Returns whether it stuck: a failed label must never render as a label.
async function labelDisposition(worker: DispositionWorker, ref: string, disposition: DispositionVerdict): Promise<boolean> {
  const res = await post("/api/dispositions", { worker, ref, disposition });
  if (!res.ok) { toast(`labeling failed (${res.status}) — nothing recorded`); return false; }
  dispoByRef.set(dispoKey(worker, ref), disposition);
  return true;
}
const DISPO_WORD_UI: Record<DispositionVerdict, string> = {
  accepted: "✓ accepted", edited: "✎ edited", ignored: "· ignored", wrong: "✗ wrong",
};

// --- outcome feed (docs/perception-layer.md §6): the lane-outcome ledger rendered — what landed,
// how, and what ③ said about it. A read-only lens over GET /api/lane-outcomes, same access model as
// the audit trail above (owner-token gated, structurally 404 on share hosts).
// The point is MEASUREMENT, not UI: `knowledge-layers.md` §5 gap 3 argues a prompt land structurally
// beats auto-③ (60s idle + ≤15s tick + ≤180s agent), so the modal row may permanently carry no
// review — and nothing reveals that without a reader. Hence the coverage tally in the header.
// Every honesty constraint lives HERE, in the renderer, because the ledger is append-only and its
// older rows cannot be repaired:
//   · a row with NO `review` key (rows 1–3, written before the field existed) is "not measured" —
//     never "no findings", never clean. A missing measurement and a measured zero are not the same
//     fact, and only the renderer still knows which one it has.
//   · `raw: true` means the reviewer's answer did not PARSE. Its empty findings say nothing about
//     the code, so the row renders as not-a-review. Rows written before `raw` was persisted
//     (discrepancy-audit F5) cannot be told apart retroactively → rendered as ambiguous, not resolved.
//   · zero findings on a parsed review is "the diff-bounded reviewer found nothing in the diff it was
//     given", with its scope — ③ never saw code outside that diff (DP1 proved defects live there).
//   · `verified: false` also fires when the gate could not RUN at all (F9: a lane without installed
//     deps), so the wording is "verify red", never "unsound".
//   · `sessionMs` is the lane's LIFETIME, not work time — labelled as such, never as effort.
//   · `↩ undo` is one-step (only the newest land is undoable), so it is deliberately NOT offered
//     per row; the board's single undo button stays the only affordance.
let ocShell: Shell | null = null;
let ocPick: string | null = null;              // landRef() of the selected outcome
let ocRowOf = new Map<HTMLElement, OutcomeRow>(); // which outcome a list row stands for
let auditPick: string | null = null;
let auditRowOf = new Map<HTMLElement, AuditEntry>();
let cmPick: string | null = null;
let cmRowOf = new Map<HTMLElement, RvCommit>();

// --- the COMMITS lens (GET /api/commits) ---
interface CommitsResp { repos: string[]; repo: string | null; branch?: string | null;
  commits: RvCommit[]; capped?: boolean; error?: string }
let cmData: CommitsResp | null = null;
let cmErr: string | null = null;

async function loadCommitsLens(repo: string | null) {
  const q = repo ? `?repo=${encodeURIComponent(repo)}` : "";
  const res = await api(`/api/commits${q}`).catch(() => null);
  if (!res) { cmErr = "couldn't reach the server"; return; }
  if (res.status === 404) { cmErr = SKEW_NOTE; return; }
  if (!res.ok) { cmErr = `the server answered ${res.status}`; return; }
  const d = (await res.json().catch(() => null)) as CommitsResp | null;
  if (!d) { cmErr = "the server's answer was not readable JSON"; return; }
  cmErr = null;
  cmData = d;
}

function renderCommits() {
  const shell = ocShell;
  if (!shell) return;
  shell.list.replaceChildren();
  cmRowOf = new Map();
  if (cmErr) { shell.list.appendChild(el("div", "diffstat err", cmErr)); shell.setRows([]); return; }
  if (!cmData) { shell.list.appendChild(el("div", "shellhint", "loading…")); shell.setRows([]); return; }
  if (cmData.error) { shell.list.appendChild(el("div", "shellhint", cmData.error)); shell.setRows([]); return; }

  // repo chooser — only when Fleet actually has more than one open, so the common case is quiet
  const ctl = el("div", "auditctl");
  if (cmData.repos.length > 1) {
    const sel = el("select", "") as HTMLSelectElement;
    for (const r of cmData.repos) {
      const o = el("option", "", baseName(r)) as HTMLOptionElement;
      o.value = r;
      o.title = r;
      sel.appendChild(o);
    }
    sel.value = cmData.repo ?? cmData.repos[0];
    sel.onchange = async () => {
      cmData = null; cmPick = null;
      renderActivity();
      await loadCommitsLens(sel.value);
      renderActivity();
    };
    ctl.appendChild(sel);
  } else if (cmData.repo) {
    ctl.appendChild(el("span", "auditcount", baseName(cmData.repo)));
  }
  ctl.appendChild(el("span", "auditcount",
    `${cmData.branch ?? "detached"} · ${cmData.commits.length} commit${cmData.commits.length === 1 ? "" : "s"}`
    + (cmData.capped ? " (latest only)" : "")));
  shell.tools.appendChild(ctl);
  shell.setSubtitle(cmData.repo ? `${baseName(cmData.repo)} · ${cmData.branch ?? "detached HEAD"}` : "");

  const rows: ShellRow[] = [];
  let selIdx = -1;
  if (!cmData.commits.length) shell.list.appendChild(el("div", "histnone", "no commits in this repo"));
  for (const c of cmData.commits) {
    const r = el("div", "shellrow");
    cmRowOf.set(r, c);
    const m = el("div", "shrmain");
    m.appendChild(el("div", "shrname", c.subject || "(no subject)"));
    m.appendChild(el("div", "shrsub", `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}`));
    r.appendChild(m);
    const act = () => { cmPick = c.hash; renderActivity(); renderCommitDetail(c); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (c.hash === cmPick) { r.classList.add("sel"); selIdx = rows.length; }
    rows.push({ el: r, open: act });
  }
  shell.setRows(rows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

let cmDiffSeq = 0; // latest-wins: arrow-keying down the commit list outruns the fetches it starts

function renderCommitDetail(c: RvCommit) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  shell.detail.appendChild(el("div", "rvhead", c.subject || "(no subject)"));
  shell.detail.appendChild(el("div", "diffstat", `${c.hash} · ${fmtTs(c.ts)}${c.stat ? ` · ${c.stat}` : ""}`));

  // THE CHANGE ITSELF, which is what a commit row is asking about. It used to be absent entirely:
  // the pane showed a provenance note and nothing about the code, so the lens could tell you a
  // commit existed and never what it did.
  const body = el("div", "cmdiff");
  body.appendChild(el("div", "shellhint", "reading the change…"));
  shell.detail.appendChild(body);
  const seq = ++cmDiffSeq;
  void (async () => {
    const repo = cmData?.repo;
    const res = repo
      ? await api(`/api/commit-diff?repo=${encodeURIComponent(repo)}&hash=${encodeURIComponent(c.hash)}`)
        .catch(() => null)
      : null;
    // a superseded fetch must not paint over the commit the cursor has since moved to
    if (!shell.isOpen() || seq !== cmDiffSeq) return;
    body.replaceChildren();
    if (!repo) { body.appendChild(el("div", "shellhint", "no repo selected")); return; }
    if (!res) { body.appendChild(el("div", "diffstat err", "couldn't reach the server")); return; }
    if (res.status === 404) { body.appendChild(el("div", "diffstat err", SKEW_NOTE)); return; }
    const d = (await res.json().catch(() => null)) as
      { files?: string[]; diff?: string; truncated?: boolean; error?: string } | null;
    if (!d || d.error) {
      body.appendChild(el("div", "diffstat err", d?.error ?? "the server's answer was not readable JSON"));
      return;
    }
    const files = d.files ?? [];
    if (files.length) {
      const fsec = el("div", "shellsec");
      fsec.appendChild(el("span", "shellsect", "Files"));
      fsec.appendChild(el("span", "shellsecn", String(files.length)));
      body.appendChild(fsec);
      const list = el("div", "cmfiles");
      // `--name-status` rows are "M\tpath" (and "R100\told\tnew" for a rename) — the path is the
      // LAST field, which is also the one that exists at this revision
      const byPath = new Map(splitDiff(d.diff ?? "").map((x) => [x.path, x.text]));
      for (const f of files) {
        const path = f.split("\t").pop() ?? f;
        const rowEl = el("div", "cmfile open", f);
        rowEl.title = `read ${path} as this commit left it`;
        rowEl.onclick = () => showFileView(shell, {
          path, label: path.split("/").pop() ?? path, repo, rev: c.hash,
          source: `as commit ${c.hash} left it — not the file as it is today`,
          diff: byPath.get(path),
          back: { label: "the commit", go: () => renderCommitDetail(c) },
        });
        list.appendChild(rowEl);
      }
      body.appendChild(list);
    }
    if (!d.diff) {
      // a merge commit legitimately has no textual diff against its first parent. Saying "no
      // changes" there would be false; saying nothing at all is what the pane did before.
      body.appendChild(el("div", "shellhint",
        "no textual diff — a merge commit shows none against its first parent, and a commit that"
        + " only moves metadata (a mode or an empty tree) has none either"));
      return;
    }
    const box = el("div", "difftxt");
    renderDiffInto(box, d.diff);
    body.appendChild(box);
    if (d.truncated) body.appendChild(el("div", "shellhint", "diff truncated — open the commit in a terminal for the rest"));
  })();

  // the JOIN the two lenses exist to make: did this commit arrive through a Fleet land, or not.
  // An outcome row records the branch and the time, so an exact commit-to-outcome identity is not
  // available — this reports the candidates and says plainly that it is a time match, not proof.
  const near = outcomeData.filter((o) => o.disposition === "landed" && Math.abs(o.ts - c.ts) < 3_600_000);
  const sec = el("div", "shellsec");
  sec.appendChild(el("span", "shellsect", "Fleet lands near this commit"));
  shell.detail.appendChild(sec);
  if (!actLoaded.has("lands")) {
    // the ledger is not loaded YET — that is this window's bookkeeping, not a fact about the commit,
    // so it is fetched rather than reported. Re-renders this pane once, if it is still the one shown.
    const note = el("div", "shellhint", "checking the land ledger…");
    shell.detail.appendChild(note);
    void loadLens("lands").then(() => {
      if (shell.isOpen() && cmPick === c.hash && actLens === "commits") renderCommitDetail(c);
    });
  } else if (!near.length) {
    shell.detail.appendChild(el("div", "shellhint",
      "no land recorded within an hour of this commit — it was probably committed by hand"));
  } else {
    for (const o of near) {
      const line = el("div", "shrsub");
      line.textContent = `${fmtTs(o.ts)} · ${(o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")}`
        + `${o.shortstat ? ` · ${o.shortstat}` : ""}`;
      shell.detail.appendChild(line);
    }
    shell.detail.appendChild(el("div", "shellhint",
      "matched by TIME (±1h), not identity — the ledger records a branch and a moment, not the"
      + " commit that resulted. Treat this as a lead, never as provenance."));
  }
}
// Every field optional: this parses ROWS ON DISK, written by older server builds. The renderer
// distinguishes absent from present-and-empty everywhere it matters, so nothing may be defaulted in.
interface OutcomeReviewRow { state?: string; at?: number; model?: string; head?: string | null;
  dirty?: number; patchId?: string | null; landedPatchId?: string | null;
  scope?: string; notes?: string; raw?: boolean; findings?: ReviewFinding[] }
interface OutcomeRow { ts: number; branch?: string | null; base?: string | null; headSha?: string | null;
  disposition?: string; model?: string | null; briefHash?: string | null; shortstat?: string;
  commitCount?: number; filesTouched?: string[]; e2eTouched?: boolean; verified?: boolean | null;
  sessionMs?: number | null; ownerPrompts?: number; resolvedConflict?: boolean; repairRounds?: number;
  confirmedByHuman?: boolean; review?: OutcomeReviewRow;
  // FLEET_CLEAN_REVIEW=shadow only. `verdict: null` = the reviewer produced no explicit verdict
  // (the measurement failed) — it is NOT a recorded verdict and must not count toward criterion 2.
  cleanReviewShadow?: { verdict?: "pass" | "would_stop" | null; at?: number; model?: string;
    notes?: string; raw?: boolean } }

// the coverage relation as the RENDERER sees it — the server's four states plus the one the server
// cannot express: a row from before the field existed. "unmeasured" is not a server state and must
// never be collapsed into "none" ("we know nothing covered this" is a measurement; this is not).
type RvRel = "covered" | "superseded" | "inflight" | "none" | "unmeasured";
function reviewRel(o: OutcomeRow): RvRel {
  const s = o.review?.state;
  return s === "covered" || s === "superseded" || s === "inflight" || s === "none" ? s : "unmeasured";
}
const REL_WORD: Record<RvRel, string> = {
  covered: "③ reviewed this exact content",
  superseded: "③ reviewed different content — not coverage of what ended up here",
  inflight: "③ was still running when the lane ended — not captured",
  none: "no ③ review on record for this lane",
  unmeasured: "review not measured — this row predates the review field",
};
const OC_FILE_ROWS = 40; // a land's file list is bounded in the pane, and says so when it is cut
const DISPO_WORD: Record<string, string> = {
  landed: "landed", reverted: "reverted", shelved: "shelved",
  "killed-dirty": "killed with work", "killed-empty": "killed empty",
};

function fmtDur(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ${min % 60}m` : `${Math.floor(h / 24)}d ${h % 24}h`;
}
function chip(text: string, cls = "", title = ""): HTMLElement {
  const c = el("span", `occhip${cls ? ` ${cls}` : ""}`, text);
  if (title) c.title = title;
  return c;
}

// what ③ actually said, under the constraints above. Returns the body rows for one outcome.
function reviewBody(r: OutcomeReviewRow): HTMLElement[] {
  const out: HTMLElement[] = [];
  const findings = r.findings ?? [];
  if (r.raw === true) {
    out.push(el("div", "ocwarn", "the reviewer's answer did not parse — this is NOT a review."
      + " Its empty findings say nothing about the code; the raw answer is below."));
    if (r.notes) out.push(el("div", "ocraw", r.notes));
    return out;
  }
  if (r.raw === undefined)
    out.push(el("div", "ocwarn", "written before scope/notes/raw were persisted — whether the"
      + " reviewer's answer parsed at all cannot be told from this row."));
  if (!findings.length)
    out.push(el("div", "ocnote", r.raw === false
      ? "the diff-bounded reviewer found nothing in the diff it was given — not a clean bill of"
        + " health: it never saw code outside that diff."
      : "zero findings here are ambiguous, not clean."));
  else {
    out.push(el("div", "ocsub", `findings — ${findings.length}, worst first`));
    for (const f of findings) {
      const row = el("div", `bfind ${f.impact}`);
      const hd = el("div", "bfindhd");
      hd.appendChild(el("span", "bfindimp", f.impact));
      hd.appendChild(el("span", "bfindt", f.title || "(untitled)"));
      row.appendChild(hd);
      row.appendChild(el("div", "bfindcite", `${f.file}:${f.line} · ${f.basis}`));
      if (f.detail) row.appendChild(el("div", "bfinddet", f.detail));
      if (f.cost) row.appendChild(el("div", "bfindcost", `cost: ${f.cost}`));
      out.push(row);
    }
  }
  if (r.scope) out.push(el("div", "ocmeta", `scope: ${r.scope}`));
  if (r.notes && r.raw === false) out.push(el("div", "ocmeta", `not checked: ${r.notes}`));
  if (r.model && r.at) out.push(el("div", "ocmeta", `${r.model} · ${fmtTs(r.at)}`));
  return out;
}

// --- graduation-criteria progress (docs/graduation-criteria.md §1 + §2) -------------------------
// The criteria are pre-registered numbers; this counts PROGRESS toward them and evaluates nothing.
// Whether a criterion has been satisfied stays the owner's call, made by reading these numbers —
// never a verdict the client draws.
//
// JUDGMENT CALL, made visible on purpose: criterion 1 counts lands recorded "after the F9 fix is
// deployed", and the ledger carries no deploy timestamp — a row cannot say which server build wrote
// it. The closest fact ON the ledger is the F9 fix's own land, so that row is the anchor and counting
// starts at the row AFTER it. This slightly UNDER-counts (the deploy followed its land by minutes,
// during which no land happened) and never over-counts. It also excludes the four pre-review-field
// legacy rows for free, since they precede this anchor.
const K1_ANCHOR_BRANCH = "f9-verify-deps";
// `noConfirmStep`, not `clean`: the field it counts (`confirmedByHuman:false`) records that the land
// needed no second confirm click. It does NOT record that nobody was attending — mergeJob has exactly
// one caller and it is an owner route — and §1 is about UNATTENDED lands. The name says what is
// counted so the criterion's word cannot creep back in through the identifier.
type KProgress = { anchored: boolean; k1: number; noConfirmStep: number; unknown: number; undos: number; k2: number };
// rows arrive newest-first; the streak is a chronological walk, so sort ascending here rather than
// relying on the feed's display order.
function kProgress(rows: OutcomeRow[]): KProgress {
  const asc = [...rows].sort((a, b) => a.ts - b.ts);
  // §2 counts recorded shadow verdicts and asks for NO anchor — K1's anchor is about the F9 verify
  // fix's deploy boundary and says nothing about ②. So K2 is walked over the whole ledger, before
  // and independently of the anchor lookup below; an unanchorable ledger still reports it.
  let k2 = 0;
  for (const o of asc)
    if (o.cleanReviewShadow && (o.cleanReviewShadow.verdict === "pass" || o.cleanReviewShadow.verdict === "would_stop")) k2++;
  const anchor = asc.findIndex((o) => o.branch === K1_ANCHOR_BRANCH);
  if (anchor < 0) return { anchored: false, k1: 0, noConfirmStep: 0, unknown: 0, undos: 0, k2 };
  const after = asc.slice(anchor + 1);
  let k1 = 0, noConfirmStep = 0, unknown = 0, undos = 0;
  for (const o of after) {
    // an undo is `disposition:"reverted"` — the only thing /api/repos/undo-land writes (server.ts,
    // buildRevertedOutcome). It breaks the CONSECUTIVE streak the criterion asks for, and is also
    // reported on its own, so a reset streak never silently reads as "no undo ever happened".
    if (o.disposition === "reverted") { undos++; k1 = 0; noConfirmStep = 0; unknown = 0; }
    else if (o.disposition === "landed") {
      k1++;
      // `confirmedByHuman` is OPTIONAL on the row: absent (or null) means the writer recorded
      // nothing, not that no confirm step happened. Only an explicit `false` says the land needed
      // no confirm click; anything else is counted as unknown and reported, never folded in here.
      if (o.confirmedByHuman === false) noConfirmStep++;
      else if (typeof o.confirmedByHuman !== "boolean") unknown++;
    }
    // shelved / killed-* are not lands at all — they neither count nor break the streak.
  }
  return { anchored: true, k1, noConfirmStep, unknown, undos, k2 };
}

let outcomeData: OutcomeRow[] = [];
let outcomeTotal = 0;
let outcomeMalformed = 0; // rows the server could not parse — a HOLE in the trail, never folded into the total
let outcomeDispo: string | "all" = "all";
let outcomeUncovered = false; // the gap-3 question: which rows landed without ③ having covered them

// The LANDS lens. renderActivity() owns clearing the toolbar and painting the lens switch, so this
// appends rather than replaces — otherwise each filter change would wipe the switch above it.
function renderOutcomes() {
  const shell = ocShell;
  if (!shell) return;
  const ctl = el("div", "auditctl");
  const dispos = [...new Set(outcomeData.map((o) => o.disposition).filter((d): d is string => !!d))].sort();
  const sel = el("select", "") as HTMLSelectElement;
  const optAll = el("option", "", "all outcomes") as HTMLOptionElement;
  optAll.value = "all";
  sel.appendChild(optAll);
  for (const d of dispos) {
    const o = el("option", "", DISPO_WORD[d] ?? d) as HTMLOptionElement;
    o.value = d;
    sel.appendChild(o);
  }
  sel.value = outcomeDispo;
  sel.onchange = () => { outcomeDispo = sel.value; renderActivity(); };
  ctl.appendChild(sel);
  const unc = el("button", `shrbtn${outcomeUncovered ? " active" : ""}`, "not covered by ③") as HTMLButtonElement;
  unc.title = "rows whose review did not describe what ended up here — superseded / inflight / none / not measured";
  unc.onclick = () => { outcomeUncovered = !outcomeUncovered; renderActivity(); };
  ctl.appendChild(unc);
  const capped = outcomeTotal > outcomeData.length;
  ctl.appendChild(el("span", "auditcount",
    (capped ? `latest ${outcomeData.length} of ${outcomeTotal} rows` : `${outcomeData.length} rows`)
    + tornNote(outcomeMalformed)));
  shell.tools.appendChild(ctl);

  // the coverage tally — the whole reason the feed exists. Counted over ALL loaded rows, not the
  // filtered view, so narrowing the list never changes the number the tally reports.
  const tally = { covered: 0, superseded: 0, inflight: 0, none: 0, unmeasured: 0 };
  for (const o of outcomeData) tally[reviewRel(o)]++;
  const tal = el("div", "octally");
  tal.appendChild(el("span", "", "③ coverage:"));
  for (const k of ["covered", "superseded", "inflight", "none", "unmeasured"] as RvRel[])
    tal.appendChild(chip(`${tally[k]} ${k}`, `rel-${k}`, REL_WORD[k]));
  shell.tools.appendChild(tal);

  // criteria progress — counted over ALL loaded rows like the tally above, never the filtered view.
  // No rows at all ⇒ no header: an empty ledger has nothing to say, and "0/20" would state a
  // measurement that was never made.
  if (outcomeData.length) {
    const k = kProgress(outcomeData);
    const kel = el("div", "octally ockrit");
    kel.id = "ockrit";
    if (!k.anchored) {
      kel.appendChild(chip(`criteria progress: no '${K1_ANCHOR_BRANCH}' row in this ledger`, "warn",
        `§1 counting starts after the F9 fix's own land (branch ${K1_ANCHOR_BRANCH}); without that`
        + " row the deploy boundary cannot be placed, so §1 counts nothing rather than counting"
        + " wrong. §2 asks for no anchor and is counted regardless."));
    } else {
      kel.appendChild(el("span", "", "criteria:"));
      kel.appendChild(chip(`K1 ${k.k1}/20`, k.k1 >= 20 ? "ok" : "",
        "graduation-criteria §1 — consecutive Fleet-routed lands recorded after the F9 fix"
        + ` (counted from the row after the '${K1_ANCHOR_BRANCH}' land; an undo resets the streak).`
        + " Counting only — the graduation decision is the owner's, made by reading this number."));
      kel.appendChild(chip(`davon ${k.noConfirmStep}/10 ohne Confirm-Schritt`, k.noConfirmStep >= 10 ? "ok" : "",
        "of that streak, the lands whose row explicitly records confirmedByHuman:false — they needed"
        + " no second confirm click. This is NOT evidence of an unattended land: mergeJob has exactly"
        + " one caller (POST /api/slots/:id/merge), so an owner request started every land on this"
        + " ledger. §1 asks for unattended landing, and this number cannot supply it — it measures"
        + " confirmation depth. Rows that record nothing are excluded and reported as unknown."));
      // the unknown count is shown only when there is one, but it is never silently dropped: an
      // "N/10" read as N-of-the-streak would otherwise be a claim about rows the ledger never made
      // a statement about.
      if (k.unknown) kel.appendChild(chip(`${k.unknown} unknown`, "warn",
        "lands in the streak whose row carries no confirmedByHuman value at all. Unknown is not"
        + " zero: they are excluded from the sub-count rather than counted as needing no confirm."));
      kel.appendChild(chip(`Undos ${k.undos}`, k.undos ? "warn" : "ok",
        "owner undos since the anchor, counted as disposition:\"reverted\" rows — the only thing"
        + " /api/repos/undo-land writes. §1 requires 0 across the 20."));
    }
    // OUTSIDE the anchored branch on purpose: §2 has no anchor requirement, so a shadow verdict
    // counts whether or not §1's deploy boundary can be placed.
    kel.appendChild(chip(`K2 ${k.k2}/25`, k.k2 >= 25 ? "ok" : "",
      "graduation-criteria §2 — recorded ② shadow verdicts, counted across the whole ledger. A row"
      + " whose shadow verdict is null (the reviewer produced no explicit verdict) is a failed"
      + " measurement and does not count."));
    shell.tools.appendChild(kel);
  }

  const rows = outcomeData.filter((o) =>
    (outcomeDispo === "all" || o.disposition === outcomeDispo)
    && (!outcomeUncovered || reviewRel(o) !== "covered"));
  // the LIST is the index: when, what happened, to which branch, and whether ③ described it. Every
  // fact the row used to carry is still rendered in full — in the detail pane, one outcome at a
  // time, which is what the density of these rows was always fighting.
  shell.list.replaceChildren();
  const shRows: ShellRow[] = [];
  let selIdx = -1;
  if (!rows.length) shell.list.appendChild(el("div", "histnone", "no outcomes match this filter"));
  for (const o of rows) {
    const ref = landRef(o);
    const dispo = o.disposition ?? "unknown";
    const r = el("div", `shellrow dis-${dispo}`);
    const m = el("div", "shrmain");
    const nm = el("div", "shrname");
    nm.appendChild(el("span", "ocdispo", DISPO_WORD[dispo] ?? dispo));
    nm.appendChild(el("span", "ocbranch", (o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")));
    m.appendChild(nm);
    m.appendChild(el("div", "shrsub", `${fmtTs(o.ts)}${o.shortstat ? ` · ${o.shortstat}` : ""}`));
    r.appendChild(m);
    // the coverage relation is the one fact worth carrying in the index — it is what the feed is for
    r.appendChild(chip(reviewRel(o) === "covered" ? "③" : "·", `rel-${reviewRel(o)}`, REL_WORD[reviewRel(o)]));
    const act = () => { ocPick = ref; renderActivity(); renderOutcomeDetail(o); shell.showDetail(true); };
    r.onclick = act;
    shell.list.appendChild(r);
    if (ref === ocPick) { r.classList.add("sel"); selIdx = shRows.length; }
    ocRowOf.set(r, o);
    shRows.push({ el: r, open: act });
  }
  shell.setRows(shRows);
  if (selIdx >= 0) shell.select(selIdx, false, false);
}

// Everything the feed knows about ONE outcome. Moved here verbatim from the row renderer: every
// honesty constraint below is asserted by e2e/outcomes.ts as SOURCE TEXT — absent ≠ false for
// confirmedByHuman / resolvedConflict / repairRounds, an absent briefHash never rendering as an
// identity two rows share, an unlabeled row never defaulting to a verdict. Those checks work by
// slicing this file between two landmark statements in the landed-chips block below, so the WORDING
// here is a contract, and this comment must not restate those landmarks literally: an earlier draft
// did, indexOf() matched the comment instead of the code, and four checks silently went vacuous.
function renderOutcomeDetail(o: OutcomeRow) {
  const shell = ocShell;
  if (!shell) return;
  shell.detail.replaceChildren();
  {
    const rel = reviewRel(o);
    const dispo = o.disposition ?? "unknown";
    const row = shell.detail;
    const hd = el("div", "ochd");
    hd.appendChild(el("span", "aud-ts", fmtTs(o.ts)));
    hd.appendChild(el("span", "ocdispo", DISPO_WORD[dispo] ?? dispo));
    hd.appendChild(el("span", "ocbranch", (o.branch ?? "(branch not recorded)").replace(/^fleet\//, "")));
    row.appendChild(hd);

    const facts = el("div", "ocfacts");
    // a footprint of exactly nothing is NOT rendered as "0 files changed": rows 1–2 of the ledger
    // are rows of zeros the recorder never measured, and an owner ⏏ land of already-integrated work
    // is legitimately empty. The row cannot tell those apart, so neither does the wording.
    const noFootprint = !o.shortstat && !o.commitCount && !(o.filesTouched?.length);
    if (noFootprint) {
      facts.appendChild(chip("footprint not recorded", "warn",
        "no commits, files or shortstat on this row — either nothing was there to land"
        + " (an already-integrated ⏏ land) or the recorder never measured it. The row cannot say which."));
    } else {
      if (o.shortstat) facts.appendChild(chip(o.shortstat));
      facts.appendChild(chip(`${o.commitCount ?? 0} commit${o.commitCount === 1 ? "" : "s"}`));
      facts.appendChild(chip(`${o.filesTouched?.length ?? 0} file${o.filesTouched?.length === 1 ? "" : "s"}`,
        "", (o.filesTouched ?? []).join("\n")));
      if (o.e2eTouched) facts.appendChild(chip("touched the safety net", "ok"));
    }
    facts.appendChild(o.verified === true ? chip("verify green", "ok")
      : o.verified === false ? chip("verify red", "warn",
          "the merge verify did not pass. It also reports red when the gate could not RUN"
          + " at all (a lane with no installed deps) — this is not by itself a claim the change is unsound.")
      : chip("no verify ran", "dim", "no deterministic verify verdict is on record for this outcome —"
          + " either no verify command was configured, or one ran and DECLINED to verify this tree"
          + " (skipped). The row cannot say which; the lane's merge verdict can."));
    if (dispo === "landed") {
      // ABSENT ≠ FALSE, and the label must describe the field it has. Two separate defects lived
      // here: the missing case rendered a positive "landed clean and green" claim — the strongest
      // statement in the feed, produced from no data — and `false` was worded as if nobody was present.
      // It does not: `mergeJob` has exactly one caller (POST /api/slots/:id/merge, an owner route),
      // so every land on this ledger was started by an owner request. What the field records is the
      // CONFIRM STEP: did the land need a second confirm click, or not.
      facts.appendChild(o.confirmedByHuman === true
        ? chip("owner confirmed this land", "", "the owner confirmed a reviewed resolution, or ⏏-landed"
            + " already-integrated work — this land carries an explicit second confirmation.")
        : o.confirmedByHuman === false
          ? chip("no confirm step", "", "this land needed no second confirm click (clean rebase + green"
              + " verify). NOT evidence that it was unattended: mergeJob has exactly one caller"
              + " (POST /api/slots/:id/merge), so an owner request started this land too.")
          : chip("confirm step not recorded", "dim", "this row carries no confirmedByHuman value at all."
              + " Whether a confirm step happened is unknown — never assumed either way."));
      if (o.resolvedConflict === true) facts.appendChild(chip("agent resolved conflicts", "warn"));
      else if (typeof o.resolvedConflict !== "boolean")
        facts.appendChild(chip("conflict resolution not recorded", "dim",
          "no resolvedConflict value on this row — whether an agent chose the resolutions is unknown, not \"no\"."));
      if (typeof o.repairRounds !== "number")
        facts.appendChild(chip("repair rounds not recorded", "dim",
          "no repairRounds value on this row — \"zero repair rounds ran\" and \"nobody counted\" are different facts."));
      else if (o.repairRounds)
        facts.appendChild(chip(`${o.repairRounds} repair round${o.repairRounds === 1 ? "" : "s"}`, "warn"));
    }
    facts.appendChild(typeof o.sessionMs === "number"
      ? chip(`lane lifetime ${fmtDur(o.sessionMs)}`, "dim",
          "wall-clock from session start to this terminal event — NOT time spent working, and not an effort measure")
      : chip("lifetime not recorded", "dim"));
    facts.appendChild(typeof o.ownerPrompts === "number"
      ? chip(`${o.ownerPrompts} owner prompt${o.ownerPrompts === 1 ? "" : "s"}`, "dim")
      : chip("owner prompts not recorded", "dim",
          "no ownerPrompts value on this row — \"nobody prompted this lane\" and \"nobody counted\" are"
          + " different facts, and a row without the field states only the second."));
    facts.appendChild(o.model ? chip(o.model, "dim") : chip("model not pinned", "dim"));
    // model and briefHash are an ENTANGLED pair (server.ts, the LaneOutcome header): a strong brief
    // lets a weak model succeed, so the model is never the whole story. And the null case is a trap:
    // 14 rows on the live ledger carry `briefHash: null` (a dispatcher- or terminal-briefed lane logs
    // no owner prompt), and all 14 nulls compare EQUAL — so absence must never render as a value that
    // could read as "these rows share a brief".
    facts.appendChild(o.briefHash
      ? chip(`brief ${o.briefHash}`, "dim", "stable hash of this lane's FIRST owner prompt — two rows"
          + " carrying the same hash were briefed with the same text.")
      : chip("no brief on record", "dim", "this row has no briefHash — the lane was briefed by a route"
          + " that logs no owner prompt (dispatcher/terminal), or nothing was recorded. An ABSENT value,"
          + " never a hash: rows showing this were NOT briefed alike, they are simply uncounted."));
    row.appendChild(facts);

    // WHAT THIS LAND PUT IN THE TREE. The row has carried the file list all along and showed it
    // only as a chip tooltip, so a land whose review is absent — most of them — rendered as a line
    // saying nothing was recorded and nothing else. The files are recorded, and they are the answer
    // to "what was this". Shown before the review block for that reason: the change is the subject,
    // the review is a comment on it.
    const touched = o.filesTouched ?? [];
    if (touched.length) {
      const fsec = el("div", "shellsec");
      // "land" only where one happened: this feed also carries shelved and killed lanes, whose
      // files were touched and never landed. Calling those a land would be the row lying.
      fsec.appendChild(el("span", "shellsect",
        dispo === "landed" ? "Files this land touched" : "Files this lane touched"));
      fsec.appendChild(el("span", "shellsecn", String(touched.length)));
      row.appendChild(fsec);
      const list = el("div", "cmfiles");
      for (const f of touched.slice(0, OC_FILE_ROWS)) list.appendChild(el("div", "cmfile", f));
      row.appendChild(list);
      if (touched.length > OC_FILE_ROWS)
        row.appendChild(el("div", "shellhint", `${OC_FILE_ROWS} of ${touched.length} shown`));
    }

    const rv = el("div", `ocrev rel-${rel}`);
    rv.appendChild(el("div", "ocrel", REL_WORD[rel]));
    // what that RELATION means for reading this row. The bare phrase is accurate and was the whole
    // block for every row without a review, which reads as a dead end rather than as a fact about
    // coverage — and the coverage gap is the thing the feed exists to make visible.
    const REL_WHY: Record<RvRel, string> = {
      covered: "the findings below describe the content that actually landed.",
      superseded: "③ ran, then the lane moved on. Read the findings as being about an EARLIER state"
        + " of this branch — not about what is now in the tree.",
      inflight: "the lane ended while ③ was still running, so its answer was never captured."
        + " Nothing was reviewed away; nothing was reviewed either.",
      none: "no reviewer output was recorded for it. That is a gap in COVERAGE, not a verdict on the"
        + " change: a prompt land structurally beats auto-③ (60s idle + a ≤15s tick + the agent's own"
        + " run), so a fast land routinely lands before any review could exist. The files above and"
        + " the commit in the repo are what this row can be judged by.",
      unmeasured: "this row predates the review field, so the ledger cannot say whether one ran.",
    };
    rv.appendChild(el("div", "ocrelwhy", REL_WHY[rel]));
    if ((rel === "covered" || rel === "superseded") && o.review)
      for (const n of reviewBody(o.review)) rv.appendChild(n);
    row.appendChild(rv);

    // the owner label for this land. Two actions, no third: ✓ this land was right, ✗ it was wrong.
    // NO DEFAULT — an unlabeled row says "unlabeled", because the graduation criteria read a
    // missing label as missing evidence, not as approval.
    const ref = landRef(o);
    const lab = el("div", "ocdispo-row");
    const cur = dispoOf("land", ref);
    lab.appendChild(el("span", "ocdispo-state" + (cur ? ` is-${cur}` : " is-none"),
      cur ? `your label: ${DISPO_WORD_UI[cur]}` : "unlabeled"));
    for (const [verdict, glyph, title] of [
      ["accepted", "✓", "this outcome was right — records an owner `accepted` disposition"],
      ["wrong", "✗", "this outcome was wrong — records an owner `wrong` disposition"],
    ] as [DispositionVerdict, string, string][]) {
      const b = el("button", `ocdispo-btn${cur === verdict ? " active" : ""}`, glyph) as HTMLButtonElement;
      b.title = title;
      b.onclick = async () => {
        b.disabled = true;
        if (await labelDisposition("land", ref, verdict)) { renderActivity(); renderOutcomeDetail(o); }
        else b.disabled = false;
      };
      lab.appendChild(b);
    }
    row.appendChild(lab);
  }
}

// --- the activity window: three lenses on "what has been happening" ---
//
// They were three separate overlays answering one question from three angles, and the gaps between
// them were the problem. The outcome ledger is what FLEET landed — it cannot see a commit made by
// hand in a terminal session, so a repo can move without the feed showing anything. The audit trail
// records what Fleet DID to a slot, and its headline question ("what happened to the session that
// vanished") was two clicks and a different overlay away from the outcome that explains it.
//
// One window, one switch. The lands lens is unchanged — its renderer carries contract wording that
// e2e/outcomes.ts asserts over the source — and the other two are new views on existing data.
type ActLens = "lands" | "commits" | "audit";
let actLens: ActLens = "lands";
const ACT_LENS: { k: ActLens; label: string; title: string }[] = [
  { k: "lands", label: "Lands", title: "the lane-outcome ledger — what Fleet landed, and what ③ review said" },
  { k: "commits", label: "Commits", title: "recent commits in a repo Fleet has open — including ones no ledger recorded" },
  { k: "audit", label: "Audit", title: "what Fleet did to each slot, and in which project — opened,"
    + " closed, shelved, self-healed, scheduled prompts fired" },
];

function renderActivity() {
  const shell = ocShell;
  if (!shell) return;
  shell.tools.replaceChildren();
  const sw = el("div", "actlens");
  for (const l of ACT_LENS) {
    const b = el("button", `shrbtn${actLens === l.k ? " active" : ""}`, l.label) as HTMLButtonElement;
    b.title = l.title;
    b.onclick = () => { if (actLens !== l.k) void switchLens(l.k); };
    sw.appendChild(b);
  }
  shell.tools.appendChild(sw);
  if (actLens === "lands") renderOutcomes();
  else if (actLens === "commits") renderCommits();
  else renderAudit();
}

async function switchLens(k: ActLens) {
  const shell = ocShell;
  if (!shell) return;
  actLens = k;
  shell.detail.replaceChildren();
  shell.setTitle(k === "lands" ? "Outcome feed — what landed, and what review said"
    : k === "commits" ? "Commits — what is actually in the repo"
    : "Audit trail — what Fleet did to each slot, and where");
  shell.setSubtitle("");
  shell.foot.textContent = k === "lands"
    ? "↩ undo is one step — only the newest land can be reverted, from the board. It is deliberately"
      + " not offered per row here: rendering it on every row would imply a capability the land spine"
      + " does not have."
    : k === "commits"
      ? "The ledger records what FLEET landed. This records what is in the repo — a commit made by"
        + " hand in a terminal session appears here and in no ledger. Pick one to read its change."
      : "Fleet's own actions on its slots — opening, closing, healing, firing a scheduled prompt —"
        + " each with the project its slot was working in. NOT the agent's tool calls: what a session"
        + " did inside its pane is in the transcript, not here. A GLOBAL log, not gated behind a live"
        + " slot, because the headline question is usually about a slot that has since vanished.";
  renderActivity();
  await loadLens(k);
  if (shell.isOpen()) renderActivity();
}

// each lens loads once per window; switching back is instant and re-fetches nothing
const actLoaded = new Set<ActLens>();
async function loadLens(k: ActLens) {
  if (actLoaded.has(k)) return;
  if (k === "lands") {
    await loadDispositions(); // labels before rows: a row must never render for an instant as unlabeled when it is not
    const res = await api("/api/lane-outcomes?limit=1000");
    if (res.ok) {
      const data = (await res.json()) as { outcomes?: OutcomeRow[]; total?: number; malformed?: number };
      outcomeData = (data.outcomes ?? []).filter((o): o is OutcomeRow => typeof o?.ts === "number");
      outcomeTotal = typeof data.total === "number" ? data.total : outcomeData.length;
      outcomeMalformed = typeof data.malformed === "number" ? data.malformed : 0;
    }
  } else if (k === "commits") {
    await loadCommitsLens(null);
  } else {
    const res = await api("/api/audit?limit=1000");
    if (res.ok) {
      const data = (await res.json()) as { events?: AuditEntry[]; total?: number; malformed?: number };
      auditData = (data.events ?? []).filter((e): e is AuditEntry =>
        typeof e?.ts === "number" && typeof e?.event === "string");
      auditTotal = typeof data.total === "number" ? data.total : auditData.length;
      auditMalformed = typeof data.malformed === "number" ? data.malformed : 0;
    }
  }
  actLoaded.add(k);
}

async function openActivity(lens: ActLens) {
  setDrawer(false);
  ocShell?.close();
  outcomeDispo = "all";
  outcomeUncovered = false;
  outcomeData = [];
  auditData = [];
  auditSlot = "all";
  auditLife = false;
  cmData = null;
  cmErr = null;
  cmPick = null;
  ocPick = null;
  auditPick = null;
  ocRowOf = new Map();
  actLens = lens;
  actLoaded.clear();
  const shell = openShell({
    id: "outcomes",
    title: "Activity",
    listWidth: 340,
    detailHint: "Pick a row on the left.",
    onSelect: (row) => {
      const o = ocRowOf.get(row.el);
      if (o) { ocPick = landRef(o); renderOutcomeDetail(o); return; }
      const e = auditRowOf.get(row.el);
      if (e) { auditPick = `${e.ts}|${e.event}`; renderAuditDetail(e); return; }
      const c = cmRowOf.get(row.el);
      if (c) { cmPick = c.hash; renderCommitDetail(c); }
    },
    onClose: () => { ocShell = null; ocRowOf = new Map(); auditRowOf = new Map(); cmRowOf = new Map(); },
  });
  ocShell = shell;
  await switchLens(lens);
}
$("outcomebtn").onclick = () => void openActivity("lands");

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
    // the ✨ draft's verdict, decided by what actually went out (see pendingEnhance). Written only
    // after the send SUCCEEDED — a failed send leaves the text in the box and nothing labeled.
    if (pendingEnhance) {
      const p = pendingEnhance;
      pendingEnhance = null;
      void labelDisposition("enhance", p.draftId, text === p.text.trim() ? "accepted" : "edited");
    }
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
// the ✨ draft currently sitting in the box, awaiting the owner's next move. This is consumer 2 of
// the disposition rail and it is ZERO-UI on purpose: the compose box already tells us, deterministic-
// ally, what the owner did with the rework — sending it unchanged is `accepted`, editing then
// sending is `edited`, clearing it away is `ignored`. Only those three are written. Everything else
// (a page reload, a second ✨ over the same draft, scheduling it as an auto) is AMBIGUOUS, so the
// pending draft is simply dropped and NOTHING is written — a guessed label is worse than no label.
let pendingEnhance: { draftId: string; text: string } | null = null;
ta.addEventListener("input", () => {
  cyc = null; // real typing (not our programmatic recall) ends a history cycle
  // cleared to empty by hand: the rework was thrown away. Programmatic clears (send, auto-schedule)
  // fire no `input` event, so this can only ever be the owner actually emptying the box.
  if (pendingEnhance && ta.value.trim() === "") {
    const p = pendingEnhance;
    pendingEnhance = null;
    void labelDisposition("enhance", p.draftId, "ignored");
  }
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
    const j = (await res.json().catch(() => ({}))) as { prompt?: string; draftId?: string; error?: string };
    if (!res.ok || !j.prompt) throw new Error(j.error ?? "enhance failed");
    // the wait can run up to 3min — if the draft moved on (edited, sent, pane switched)
    // in the meantime, dropping the stale result silently beats clobbering new work
    if (ta.value.trim() === text && (panes[focused]?.slot ?? 0) === slot) {
      ta.value = j.prompt;
      // arm the disposition watch for THIS draft. A result that was dropped as stale above is
      // never armed — nothing was put in front of the owner, so there is nothing to rule on.
      // A previous pending draft is superseded here without a label: replaced-by-a-re-run is
      // not one of the three deterministic cases.
      pendingEnhance = j.draftId ? { draftId: j.draftId, text: j.prompt } : null;
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
  void loadDispositions(); // so an already-labeled ③ review renders its label, not "unbewertet"
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

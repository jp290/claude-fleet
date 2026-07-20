import { Terminal } from "@xterm/xterm";
import { CanvasAddon } from "@xterm/addon-canvas";

// guest page for one shared slot: /s/<id>. Auth is the share's own cookie (set by
// POST /s/<id>/auth) — the owner token never appears here. The terminal renders at
// the SESSION's size (from /info), not the viewport's: guests must not resize the
// owner's pty, so small screens scroll instead of reflowing.
//
// Layout: the stream is the stage; everything else lives in the right sidebar
// (info / chat / changes), a slide-over on narrow viewports. All guest-visible
// strings render through textContent — comment text is hostile input.
const shareId = location.pathname.split("/")[2];
const $ = (id: string) => document.getElementById(id)!;
const gate = $("gate"), pw = $("pw") as HTMLInputElement, gatemsg = $("gatemsg"),
  title = $("title"), modeEl = $("mode"), livechip = $("livechip"), livetxt = $("livetxt"),
  notice = $("notice"), bar = $("bar"), input = $("input") as HTMLTextAreaElement,
  send = $("send") as HTMLButtonElement;

interface Info { slotLabel: string | null; mode: "view" | "interact"; cols: number; rows: number; active: boolean;
  viewers?: number; comments?: number }
interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[] }
interface ShareComment { id: string; ts: number; name: string; text: string; from?: "owner" }
interface Brief { branch: string | null; sessionStart: number | null; uncommitted: number;
  files: string[]; shortstat: string; commits: { hash: string; ts: number; subject: string }[] }

const MAX_CHUNK = 1000; // server drops WS messages over 1024 bytes
const FONT_KEY = "fleetShareFont";
const NAME_KEY = "fleetShareName";
const SIDE_KEY = "fleetShareSide";
const MIN_FONT = 8, MAX_FONT = 22;
const NARROW = () => matchMedia("(max-width: 860px)").matches;

let term: Terminal | null = null;
let ws: WebSocket | null = null;
let gen = 0;
let fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, Number(localStorage.getItem(FONT_KEY)) || 12));
let sessionStart: number | null = null;
let cmtCount = 0; // server-side comment count (from /info)
let cmtSeen = 0; // count last shown in the chat tab — the badge is the difference

function setConn(on: boolean) {
  livechip.className = on ? "" : "off";
  livetxt.textContent = on ? "LIVE" : "OFFLINE";
}

let ended = false; // revoked / session gone — freezes polls, reader included
function showNotice(text: string) {
  ended = true;
  notice.textContent = text;
  notice.style.display = "block";
  $("wrap").style.display = "none";
  $("reader").style.display = "none"; // reader is the phone default — a stale transcript must not read as live
  document.body.classList.remove("reader");
  bar.style.display = "none";
  $("jump").style.display = "none";
}

async function fetchInfo(): Promise<Info | null> {
  const res = await fetch(`/s/${shareId}/info`);
  if (!res.ok) return null;
  return (await res.json()) as Info;
}

const fmtAgo = (ts: number) => {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const fmtUp = (start: number) => {
  const min = Math.max(0, Math.floor((Date.now() - start) / 60000));
  if (min < 60) return `up ${min}m`;
  const h = Math.floor(min / 60);
  return h < 24 ? `up ${h}h ${min % 60}m` : `up ${Math.floor(h / 24)}d ${h % 24}h`;
};

// --- sidebar: tabs + open/close ---
type TabName = "info" | "chat" | "changes" | "tools";
let activeTab: TabName = "info";
const sideOpen = () => document.body.classList.contains("side-open");

function syncMtabs() {
  // bottom-bar highlight mirrors "sheet open at this tab", not just the remembered tab
  for (const b of document.querySelectorAll<HTMLButtonElement>(".mtab"))
    b.classList.toggle("active", sideOpen() && b.dataset.tab === activeTab);
}

function setSide(open: boolean) {
  document.body.classList.toggle("side-open", open);
  $("sidebtn").classList.toggle("open", open);
  localStorage.setItem(SIDE_KEY, open ? "1" : "0");
  if (open) activateTab(activeTab); // refresh whatever is visible
  else syncMtabs();
}

function activateTab(name: TabName) {
  activeTab = name;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".tab"))
    b.classList.toggle("active", b.dataset.tab === name);
  for (const p of document.querySelectorAll<HTMLElement>(".pane"))
    p.classList.toggle("active", p.id === `pane-${name}`);
  syncMtabs();
  if (name === "info") { void loadBrief(); void loadSummary(false); }
  if (name === "chat") {
    void loadComments();
    // a programmatic focus pops the on-screen keyboard over the fresh thread on phones —
    // only pre-focus where a hardware keyboard is the norm
    if (!NARROW()) ($("cmtinput") as HTMLTextAreaElement).focus();
  }
  if (name === "changes") void loadChanges();
  if (name === "tools") applyFont(); // sync the size readout + fit state
}
for (const b of document.querySelectorAll<HTMLButtonElement>(".tab"))
  b.onclick = () => activateTab(b.dataset.tab as TabName);
// thumb navigation: each bottom tab opens the sheet at its pane; tapping the active
// one again closes the sheet — one control, no hunt for a separate close affordance
for (const b of document.querySelectorAll<HTMLButtonElement>(".mtab"))
  b.onclick = () => {
    const t = b.dataset.tab as TabName;
    if (sideOpen() && activeTab === t) { setSide(false); return; }
    activeTab = t;
    setSide(true);
  };
$("shade").onclick = () => setSide(false);
$("sidebtn").onclick = () => setSide(!sideOpen());
$("sideclose").onclick = () => setSide(false);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && NARROW()) setSide(false);
});

function badge() {
  const n = activeTab === "chat" && sideOpen() ? 0 : cmtCount - cmtSeen;
  for (const id of ["chatbadge", "mchatbadge"]) {
    const b = $(id);
    b.style.display = n > 0 ? "inline-block" : "none";
    if (n > 0) b.textContent = n > 99 ? "99+" : String(n);
  }
}

// --- info tab + telemetry (branch, uptime) ---
function kv(target: HTMLElement, k: string, v: string) {
  const row = document.createElement("div");
  row.className = "kv";
  const kEl = document.createElement("span");
  kEl.className = "k";
  kEl.textContent = k;
  const vEl = document.createElement("span");
  vEl.className = "v";
  vEl.textContent = v;
  vEl.title = v;
  row.append(kEl, vEl);
  target.appendChild(row);
}
function sect(target: HTMLElement, label: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "sect";
  const l = document.createElement("div");
  l.className = "lbl";
  l.textContent = label;
  box.appendChild(l);
  target.appendChild(box);
  return box;
}
function empty(target: HTMLElement, text: string) {
  const e = document.createElement("div");
  e.className = "empty";
  e.textContent = text;
  target.appendChild(e);
}

// --- ✨ summary: same agent the owner sideboard uses. GET = cache only; the button
// POSTs a run (server side is single-flight + keyed on git state, so clicking twice
// or two guests clicking at once still runs at most one agent).
interface SummaryView { summary?: string; openThreads?: string[]; verification?: string;
  at?: number; stale?: boolean; error?: string }
let sumBusy = false;
function renderSummary(d: SummaryView) {
  const body = $("sumbody");
  body.replaceChildren();
  body.classList.remove("empty");
  if (!d.summary) {
    body.classList.add("empty");
    body.textContent = "no summary yet — ask the agent for one";
    return;
  }
  const p = document.createElement("div");
  p.className = "sumtext";
  p.textContent = d.summary;
  body.appendChild(p);
  for (const t of d.openThreads ?? []) {
    const li = document.createElement("div");
    li.className = "sumthread";
    li.textContent = `· ${t}`;
    body.appendChild(li);
  }
  if (d.verification) {
    const v = document.createElement("div");
    v.className = "sumver";
    v.textContent = `verification: ${d.verification}`;
    body.appendChild(v);
  }
  const meta = document.createElement("div");
  meta.className = "summeta";
  meta.textContent = `${d.at ? fmtAgo(d.at) : ""}${d.stale ? " · session moved on — refresh for current state" : ""}`;
  body.appendChild(meta);
}
async function loadSummary(runIt: boolean) {
  if (sumBusy) return;
  const btn = $("sumbtn") as HTMLButtonElement;
  if (runIt) {
    sumBusy = true;
    btn.disabled = true;
    btn.textContent = "summarizing…";
  }
  try {
    const res = await fetch(`/s/${shareId}/summary`, runIt ? { method: "POST" } : undefined);
    const d = (await res.json().catch(() => ({}))) as SummaryView;
    if (!res.ok || d.error) {
      const body = $("sumbody");
      body.replaceChildren();
      body.classList.add("empty");
      body.textContent = d.error ?? "summary unavailable for this session";
      return;
    }
    renderSummary(d);
  } finally {
    if (runIt) {
      sumBusy = false;
      btn.disabled = false;
    }
    btn.textContent = $("sumbody").querySelector(".sumtext") ? "refresh" : "generate";
  }
}
$("sumbtn").onclick = () => void loadSummary(true);

let lastInfo: Info | null = null;
async function loadBrief() {
  const res = await fetch(`/s/${shareId}/brief`);
  const body = $("briefwrap");
  if (!res.ok) {
    body.replaceChildren();
    empty(body, res.status === 400 ? "this session is not inside a git repository" : "session overview unavailable");
    return;
  }
  const b = (await res.json()) as Brief;
  sessionStart = b.sessionStart;
  $("tbranch").textContent = b.branch ?? "";
  tickUp();
  body.replaceChildren();
  if (lastInfo) {
    kv(body, "session", lastInfo.slotLabel ?? "shared session");
    kv(body, "access", lastInfo.mode === "interact" ? "interactive" : "view only");
  }
  if (b.branch) kv(body, "branch", b.branch);
  if (b.sessionStart) kv(body, "started", fmtAgo(b.sessionStart));
  kv(body, "uncommitted", b.uncommitted === 0 ? "clean tree" : `${b.uncommitted} file${b.uncommitted === 1 ? "" : "s"}`);
  if (b.shortstat) kv(body, "delta", b.shortstat.trim());
  const cs = sect(body, `commits this session`);
  if (!b.commits.length) empty(cs, "no commits yet");
  for (const c of b.commits) {
    const row = document.createElement("div");
    row.className = "commit";
    const h = document.createElement("span");
    h.className = "h";
    h.textContent = c.hash;
    const s = document.createElement("span");
    s.className = "s";
    s.textContent = c.subject;
    s.title = c.subject;
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = fmtAgo(c.ts);
    row.append(h, s, t);
    cs.appendChild(row);
  }
  const fs = sect(body, `changed files`);
  if (!b.files.length) empty(fs, "nothing changed yet");
  for (const f of b.files) {
    const st = f.slice(0, 2).trim() || "M";
    const row = document.createElement("div");
    row.className = "file";
    const stEl = document.createElement("span");
    stEl.className = "st " + (st.startsWith("A") || st.startsWith("?") ? "a" : st.startsWith("D") ? "d" : "m");
    stEl.textContent = st.slice(0, 1);
    const p = document.createElement("span");
    p.className = "p";
    p.textContent = f.slice(2).trim();
    p.title = f.slice(2).trim();
    row.append(stEl, p);
    fs.appendChild(row);
  }
}

function tickUp() {
  $("tup").textContent = sessionStart ? fmtUp(sessionStart) : "";
}
setInterval(tickUp, 30_000);

function applyInfo(info: Info) {
  lastInfo = info;
  const v = info.viewers ?? 0;
  $("tviewers").textContent = `${v} watching`;
  cmtCount = info.comments ?? 0;
  if (activeTab === "chat" && sideOpen()) void loadComments();
  badge();
  // the pane's true size moved (owner resized, or their client reconnected at another
  // width) — a grid frozen at the old size garbles every frame from now on. Reconnect:
  // connect() resets and the server reseeds at the current size, so the guest follows
  // the session instead of drifting from it.
  if (term && (term.cols !== info.cols || term.rows !== info.rows)) {
    term.resize(info.cols, info.rows);
    if (fitOn) applyFont(); // fit is a function of cols — recompute for the new width
    reloadStream();
  }
}

// --- chat tab ---
const cmtlist = $("cmtlist"), cmtmsg = $("cmtmsg"),
  cmtname = $("cmtname") as HTMLInputElement, cmtinput = $("cmtinput") as HTMLTextAreaElement,
  cmtpost = $("cmtpost") as HTMLButtonElement;
cmtname.value = localStorage.getItem(NAME_KEY) ?? "";
let cmtRendered = ""; // id fingerprint of the rendered thread — skip no-op re-renders

function renderComments(comments: ShareComment[]) {
  const fp = comments.map((c) => c.id).join(",");
  if (fp === cmtRendered) return;
  cmtRendered = fp;
  const atBottom = cmtlist.scrollHeight - cmtlist.scrollTop - cmtlist.clientHeight < 60;
  cmtlist.replaceChildren();
  if (!comments.length) {
    const e = document.createElement("div");
    e.className = "empty";
    e.textContent = "no comments yet — say hi";
    cmtlist.appendChild(e);
    return;
  }
  for (const c of comments) {
    const box = document.createElement("div");
    box.className = c.from === "owner" ? "cmt own" : "cmt";
    const head = document.createElement("div");
    head.className = "cmthead";
    const who = document.createElement("b");
    who.textContent = c.from === "owner" ? "owner" : c.name;
    const when = document.createElement("span");
    when.textContent = fmtAgo(c.ts);
    head.append(who, when);
    const text = document.createElement("div");
    text.className = "cmttext";
    text.textContent = c.text;
    box.append(head, text);
    cmtlist.appendChild(box);
  }
  if (atBottom) cmtlist.scrollTop = cmtlist.scrollHeight;
}

async function loadComments() {
  const res = await fetch(`/s/${shareId}/comments`);
  if (!res.ok) return;
  const data = (await res.json().catch(() => ({}))) as { comments?: ShareComment[] };
  const list = data.comments ?? [];
  cmtCount = list.length;
  renderComments(list);
  if (activeTab === "chat" && sideOpen()) cmtSeen = cmtCount;
  badge();
}

async function postComment() {
  const text = cmtinput.value.trim();
  if (!text || cmtpost.disabled) return;
  cmtpost.disabled = true;
  cmtmsg.textContent = "";
  localStorage.setItem(NAME_KEY, cmtname.value.trim());
  try {
    const res = await fetch(`/s/${shareId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: cmtname.value, text }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      cmtmsg.textContent = err.error ?? "posting failed — try again";
      return;
    }
    cmtinput.value = ""; // text survives in the box on failure, cleared only on success
    await loadComments();
    cmtlist.scrollTop = cmtlist.scrollHeight;
  } catch {
    cmtmsg.textContent = "posting failed — try again";
  } finally {
    cmtpost.disabled = false;
  }
}
cmtpost.onclick = () => void postComment();
cmtinput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void postComment();
  }
});

// --- changes tab ---
const dstat = $("dstat"), dtxt = $("dtxt");
async function loadChanges() {
  dstat.textContent = "loading…";
  const res = await fetch(`/s/${shareId}/diff`);
  const data = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean; error?: string };
  if (!res.ok || data.error) {
    dstat.textContent = data.error ?? "diff unavailable";
    dtxt.replaceChildren();
    return;
  }
  const n = data.status?.length ?? 0;
  dstat.textContent = `${data.branch ?? "?"} · ${n} file${n === 1 ? "" : "s"}${data.truncated ? " · truncated" : ""}`;
  dtxt.replaceChildren();
  if (!data.diff) {
    dtxt.textContent = n ? "(changes are untracked — no tracked diff)" : "clean working tree — nothing changed yet";
    return;
  }
  // colorize by line prefix — every line is its own textContent node, never innerHTML
  for (const line of data.diff.split("\n")) {
    const span = document.createElement("span");
    span.className = line.startsWith("+") ? "add" : line.startsWith("-") ? "del"
      : (line.startsWith("@@") || line.startsWith("diff ")) ? "hdr" : "";
    span.textContent = line + "\n";
    dtxt.appendChild(span);
  }
}
$("crefresh").onclick = () => void loadChanges();

// --- viewer QoL: font size (persisted), fit-to-width, jump to latest output ---
// fit-to-width: the one thing a guest CANNOT have natively — the terminal renders at the
// session's cols (guests must not resize the owner's pty), so on a phone it overflows
// sideways. Fit shrinks the font until all cols land in the viewport: whole-layout
// readability at a glance, pan-free. Toggle, not default-forever: A−/A+ hand control back.
let fitOn = false;
function fitFont(): number {
  if (!lastInfo) return fontSize;
  // 0.602 ≈ advance-width/font-size for the Menlo/Consolas stack; floor errs on "fits"
  const w = $("wrap").clientWidth - 12;
  return Math.min(MAX_FONT, Math.max(5, Math.floor(w / lastInfo.cols / 0.602)));
}
function applyFont() {
  if (term) term.options.fontSize = fitOn ? fitFont() : fontSize;
  $("tfit").classList.toggle("active", fitOn);
  $("tfsize").textContent = String(fitOn ? fitFont() : fontSize);
}
function toggleFit() { fitOn = !fitOn; applyFont(); }
window.addEventListener("resize", () => { if (fitOn) applyFont(); }); // rotation refits
function setFont(delta: number) {
  // compose with fit instead of fighting it: A± continues from the size on screen —
  // fitted 7px + A+ = manual 8px, not a jarring jump back to the pre-fit size
  fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, (fitOn ? fitFont() : fontSize) + delta));
  fitOn = false;
  localStorage.setItem(FONT_KEY, String(fontSize));
  applyFont();
}
$("fminus").onclick = () => setFont(-1);
$("fplus").onclick = () => setFont(1);
// tools pane = the same controls with thumb-sized targets (narrow viewports only)
$("tfminus").onclick = () => setFont(-1);
$("tfplus").onclick = () => setFont(1);
$("tfit").onclick = () => toggleFit();
$("treload").onclick = () => { reloadStream(); setSide(false); }; // show the result, not the sheet
function jumpDown() {
  term?.scrollToBottom();
  $("wrap").scrollTop = $("wrap").scrollHeight;
}
$("jump").onclick = () => jumpDown();
// ⤓ appears only while scrolled AWAY from the tail — a control that is always visible
// reads as a permanent UI bar; one that appears on demand reads as help
function updateJump() {
  if (!term) return;
  const b = term.buffer.active;
  $("jump").style.display = b.viewportY < b.baseY ? "block" : "none";
}

// reload/refresh: drop the current socket and reconnect, which re-seeds the whole
// terminal from a fresh capture-pane (connect() resets first). "Fix my formatting" on
// demand — the mobile counterpart to just waiting out a garbled reconnect.
function reloadStream() {
  if (!lastInfo) return;
  gen++; // orphan the live socket so its onclose can't fire a second reconnect
  ws?.close();
  connect(lastInfo);
}
$("reload").onclick = () => reloadStream();

// --- reader: the conversation as native text, polled from the share transcript
// endpoint with a line cursor. Phone-first primary view; the raster terminal stays one
// toggle away. All content renders through textContent — transcripts are hostile input.
const reader = $("reader");
let readerOn = false;
let rCursor = 0;
let rSource: string | null = null;
let rBusy = false;

function setView(r: boolean) {
  if (ended) return; // the notice owns the stage now — no view to switch back into
  readerOn = r;
  document.body.classList.toggle("reader", r);
  $("viewtog").textContent = r ? "⌨ terminal" : "☰ reader";
  if (r) void pollReader();
  else updateJump(); // returning to the raster — restore the jump pill's state
}
$("viewtog").onclick = () => setView(!readerOn);

function rAppend(e: TEntry) {
  for (const b of e.blocks) {
    if (b.t === "text") {
      const box = document.createElement("div");
      box.className = `rmsg ${e.role}`;
      const head = document.createElement("div");
      head.className = "rhead";
      head.textContent = e.role === "user" ? "you" : "claude";
      const body = document.createElement("div");
      body.textContent = b.text;
      box.append(head, body);
      reader.appendChild(box);
    } else if (b.t === "tool") {
      const step = document.createElement("div");
      step.className = "rstep";
      step.textContent = `⚙ ${b.name ?? "tool"}`;
      reader.appendChild(step);
    }
    // thinking / tool_result stay out of the reader — it's the conversation, not the trace
  }
}

async function pollReader() {
  if (rBusy || !readerOn || ended) return;
  rBusy = true;
  try {
    const res = await fetch(`/s/${shareId}/transcript?after=${rCursor}`);
    if (!res.ok) return;
    const d = (await res.json()) as { entries: TEntry[]; total: number; source: string | null };
    // fresh claude after a self-heal → transcript restarted; rebuild from the top
    if (rSource !== null && d.source !== rSource) {
      rCursor = 0;
      rSource = d.source;
      reader.replaceChildren();
      return;
    }
    rSource = d.source;
    if (d.entries.length) {
      reader.querySelector(".rempty")?.remove();
      const atTail = reader.scrollHeight - reader.scrollTop - reader.clientHeight < 80;
      for (const e of d.entries) rAppend(e);
      if (atTail || rCursor === 0) reader.scrollTop = reader.scrollHeight;
    } else if (!reader.childElementCount) {
      const emp = document.createElement("div");
      emp.className = "rempty";
      emp.textContent = "no conversation yet — the session hasn't been prompted";
      reader.appendChild(emp);
    }
    rCursor = d.total;
  } catch {
    // transient — next tick retries
  } finally {
    rBusy = false;
  }
}

// --- stream ---
function connect(info: Info) {
  gen++;
  const g = gen;
  // clear the screen + scrollback before the server's seed arrives. Each (re)connect
  // re-seeds the whole visible state, so without this the seed stacks onto whatever the
  // dropped socket left behind — the exact garbling mobile guests hit after a WS drop.
  term?.reset();
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const sock = new WebSocket(`${proto}://${location.host}/ws-share/${shareId}`);
  ws = sock;
  sock.binaryType = "arraybuffer";
  sock.onopen = () => {
    setConn(true);
    // the pre-connect info fetch counted 0 viewers (our own socket wasn't up yet)
    void fetchInfo().then((i) => { if (i) applyInfo(i); });
  };
  // a superseded socket (reload/reassign bumped gen) can still deliver buffered frames —
  // writing them after the new socket's reset would re-corrupt the fresh screen
  sock.onmessage = (e) => { if (g === gen) term?.write(new Uint8Array(e.data as ArrayBuffer)); };
  sock.onclose = (e) => {
    if (g !== gen) return;
    setConn(false);
    if (e.code === 4001) {
      showNotice("This share was revoked by the owner.");
      return;
    }
    if (e.code === 4000) {
      showNotice("The shared session was ended by the owner.");
      return;
    }
    if (e.code === 4002) {
      // owner flipped view/interact — reload so the UI (compose bar, stdin) matches
      location.reload();
      return;
    }
    setTimeout(() => { if (g === gen) connect(info); }, 2000);
  };
}

function start(info: Info) {
  gate.style.display = "none";
  if (!info.active) {
    showNotice("The shared session was ended by the owner.");
    return;
  }
  lastInfo = info;
  const name = info.slotLabel ?? "Shared session";
  title.textContent = name;
  $("tname").textContent = name;
  document.title = `${name} — Claude Fleet`;
  for (const id of ["viewtog", "reload", "fminus", "fplus", "sidebtn"]) $(id).style.display = "block";
  // phones open on the conversation — the raster is the fallback view; desktop keeps
  // the terminal front and center
  setView(NARROW());
  setInterval(() => void pollReader(), 3000);
  modeEl.textContent = info.mode === "interact" ? "interactive" : "view only";
  modeEl.className = info.mode;
  modeEl.style.display = "inline-block";
  applyInfo(info);
  // sidebar: remembered preference on wide screens; phones ALWAYS start on the stream —
  // an app opens on its content, not on a half-screen sheet from last visit
  const saved = localStorage.getItem(SIDE_KEY);
  setSide(NARROW() ? false : (saved === null || saved === "1"));
  setInterval(() => { void fetchInfo().then((i) => { if (i) applyInfo(i); }); }, 10_000);
  setInterval(() => { if (sideOpen() && activeTab === "info") void loadBrief(); }, 30_000);
  term = new Terminal({
    cols: info.cols,
    rows: info.rows,
    scrollback: 20000,
    fontSize,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    theme: { background: "#131316", foreground: "#d8d8d8" },
    disableStdin: info.mode !== "interact",
  });
  term.open($("term"));
  term.loadAddon(new CanvasAddon());
  term.onScroll(() => updateJump());
  term.onWriteParsed(() => updateJump());
  // phone first visit (no saved font): start fitted, IF the session is narrow enough for
  // fit to stay legible — a 200-col session at 5px is worse than panning at 12px
  if (NARROW() && localStorage.getItem(FONT_KEY) === null && fitFont() >= 8) {
    fitOn = true;
    applyFont();
  }
  // touch pan, axis-locked: xterm's own touch handling owns vertical (scrollback), but it
  // swallows the gesture before #wrap's horizontal overflow can pan. Capture-phase handler
  // on the ancestor decides the axis on first significant movement: horizontal gestures
  // drive wrap.scrollLeft ourselves and stop before xterm sees them; vertical ones pass
  // through untouched.
  const wrap = $("wrap");
  let tx = 0, ty = 0, lx = 0, axis: "h" | "v" | null = null;
  wrap.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    tx = lx = t.clientX; ty = t.clientY; axis = null;
  }, { passive: true, capture: true });
  wrap.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (axis === null) {
      const dx = Math.abs(t.clientX - tx), dy = Math.abs(t.clientY - ty);
      if (dx < 6 && dy < 6) return; // not decided yet
      axis = dx > dy ? "h" : "v";
    }
    if (axis === "h") {
      wrap.scrollLeft += lx - t.clientX;
      lx = t.clientX;
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false, capture: true });
  if (info.mode === "interact") {
    bar.style.display = "flex";
    $("stage").classList.add("composing");
    term.onData((d) => {
      if (ws?.readyState !== WebSocket.OPEN) return;
      const bytes = new TextEncoder().encode(d);
      for (let i = 0; i < bytes.length; i += MAX_CHUNK) ws.send(bytes.slice(i, i + MAX_CHUNK));
    });
  }
  connect(info);
}

async function join() {
  const password = pw.value;
  if (!password) return;
  gatemsg.textContent = "";
  const res = await fetch(`/s/${shareId}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    pw.classList.add("bad");
    setTimeout(() => pw.classList.remove("bad"), 1200);
    gatemsg.textContent = res.status === 429
      ? "too many attempts — try again later"
      : res.status === 404 ? "this share no longer exists" : "wrong password";
    return;
  }
  const info = await fetchInfo();
  if (info) start(info);
}
$("enter").onclick = () => void join();
pw.addEventListener("keydown", (e) => {
  if (e.key === "Enter") void join();
});

async function doSend() {
  const text = input.value.trim();
  if (!text || send.disabled) return;
  send.disabled = true;
  try {
    const res = await fetch(`/s/${shareId}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, submit: true }),
    });
    if (!res.ok) throw new Error(`send failed: ${res.status}`);
    input.value = "";
    term?.scrollToBottom();
  } catch {
    send.style.background = "#f85149"; // text stays in the box, nothing typed is lost
    setTimeout(() => { send.style.background = ""; }, 1200);
  } finally {
    send.disabled = false;
  }
}
send.onclick = () => void doSend();
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void doSend();
  }
});

void (async () => {
  const info = await fetchInfo(); // cookie may already be set from an earlier visit
  if (info) start(info);
  else {
    gate.style.display = "flex";
    pw.focus();
  }
})();

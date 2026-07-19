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
interface ShareComment { id: string; ts: number; name: string; text: string }
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

function showNotice(text: string) {
  notice.textContent = text;
  notice.style.display = "block";
  $("wrap").style.display = "none";
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
type TabName = "info" | "chat" | "changes";
let activeTab: TabName = "info";
const sideOpen = () => document.body.classList.contains("side-open");

function setSide(open: boolean) {
  document.body.classList.toggle("side-open", open);
  $("sidebtn").classList.toggle("open", open);
  localStorage.setItem(SIDE_KEY, open ? "1" : "0");
  if (open) activateTab(activeTab); // refresh whatever is visible
}

function activateTab(name: TabName) {
  activeTab = name;
  for (const b of document.querySelectorAll<HTMLButtonElement>(".tab"))
    b.classList.toggle("active", b.dataset.tab === name);
  for (const p of document.querySelectorAll<HTMLElement>(".pane"))
    p.classList.toggle("active", p.id === `pane-${name}`);
  if (name === "info") void loadBrief();
  if (name === "chat") {
    void loadComments();
    ($("cmtinput") as HTMLTextAreaElement).focus();
  }
  if (name === "changes") void loadChanges();
}
for (const b of document.querySelectorAll<HTMLButtonElement>(".tab"))
  b.onclick = () => activateTab(b.dataset.tab as TabName);
$("sidebtn").onclick = () => setSide(!sideOpen());
$("sideclose").onclick = () => setSide(false);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && NARROW()) setSide(false);
});

function badge() {
  const n = activeTab === "chat" && sideOpen() ? 0 : cmtCount - cmtSeen;
  const b = $("chatbadge");
  b.style.display = n > 0 ? "inline-block" : "none";
  if (n > 0) b.textContent = n > 99 ? "99+" : String(n);
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

let lastInfo: Info | null = null;
async function loadBrief() {
  const res = await fetch(`/s/${shareId}/brief`);
  const body = $("infobody");
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
    box.className = "cmt";
    const head = document.createElement("div");
    head.className = "cmthead";
    const who = document.createElement("b");
    who.textContent = c.name;
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

// --- viewer QoL: font size (persisted) + jump to latest output ---
function setFont(delta: number) {
  fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
  localStorage.setItem(FONT_KEY, String(fontSize));
  if (term) term.options.fontSize = fontSize;
}
$("fminus").onclick = () => setFont(-1);
$("fplus").onclick = () => setFont(1);
$("jump").onclick = () => {
  term?.scrollToBottom();
  $("wrap").scrollTop = $("wrap").scrollHeight;
};

// --- stream ---
function connect(info: Info) {
  gen++;
  const g = gen;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const sock = new WebSocket(`${proto}://${location.host}/ws-share/${shareId}`);
  ws = sock;
  sock.binaryType = "arraybuffer";
  sock.onopen = () => {
    setConn(true);
    // the pre-connect info fetch counted 0 viewers (our own socket wasn't up yet)
    void fetchInfo().then((i) => { if (i) applyInfo(i); });
  };
  sock.onmessage = (e) => term?.write(new Uint8Array(e.data as ArrayBuffer));
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
  for (const id of ["fminus", "fplus", "sidebtn", "jump"]) $(id).style.display = "block";
  modeEl.textContent = info.mode === "interact" ? "interactive" : "view only";
  modeEl.className = info.mode;
  modeEl.style.display = "inline-block";
  applyInfo(info);
  // sidebar: remembered preference; first visit defaults to open on wide screens
  const saved = localStorage.getItem(SIDE_KEY);
  setSide(saved === null ? !NARROW() : saved === "1");
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

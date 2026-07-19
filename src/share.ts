import { Terminal } from "@xterm/xterm";
import { CanvasAddon } from "@xterm/addon-canvas";

// guest page for one shared slot: /s/<id>. Auth is the share's own cookie (set by
// POST /s/<id>/auth) — the owner token never appears here. The terminal renders at
// the SESSION's size (from /info), not the viewport's: guests must not resize the
// owner's pty, so small screens scroll instead of reflowing.
const shareId = location.pathname.split("/")[2];
const $ = (id: string) => document.getElementById(id)!;
const gate = $("gate"), pw = $("pw") as HTMLInputElement, gatemsg = $("gatemsg"),
  title = $("title"), modeEl = $("mode"), dot = $("dot"), notice = $("notice"),
  bar = $("bar"), input = $("input") as HTMLTextAreaElement, send = $("send") as HTMLButtonElement;

interface Info { slotLabel: string | null; mode: "view" | "interact"; cols: number; rows: number; active: boolean;
  viewers?: number; comments?: number }
interface ShareComment { id: string; ts: number; name: string; text: string }

const MAX_CHUNK = 1000; // server drops WS messages over 1024 bytes
const FONT_KEY = "fleetShareFont";
const NAME_KEY = "fleetShareName";
const MIN_FONT = 8, MAX_FONT = 22;

let term: Terminal | null = null;
let ws: WebSocket | null = null;
let gen = 0;
let fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, Number(localStorage.getItem(FONT_KEY)) || 12));

function setConn(on: boolean) {
  dot.className = on ? "on" : "off";
}

function showNotice(text: string) {
  notice.textContent = text;
  notice.style.display = "block";
  bar.style.display = "none";
}

async function fetchInfo(): Promise<Info | null> {
  const res = await fetch(`/s/${shareId}/info`);
  if (!res.ok) return null;
  return (await res.json()) as Info;
}

function connect(info: Info) {
  gen++;
  const g = gen;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const sock = new WebSocket(`${proto}://${location.host}/ws-share/${shareId}`);
  ws = sock;
  sock.binaryType = "arraybuffer";
  sock.onopen = () => setConn(true);
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

// header extras + comment badge, refreshed from /info on a slow poll
function applyInfoExtras(info: Info) {
  const v = info.viewers ?? 0;
  $("viewers").textContent = `👁 ${v}`;
  $("viewers").style.display = "inline";
  const n = info.comments ?? 0;
  $("cmtbtn").textContent = n > 0 ? `💬 ${n}` : "💬";
}

function start(info: Info) {
  gate.style.display = "none";
  if (!info.active) {
    showNotice("The shared session was ended by the owner.");
    return;
  }
  title.textContent = info.slotLabel ?? "Shared session";
  document.title = `${info.slotLabel ?? "Shared session"} — Claude Fleet`;
  // header tools only after auth — their fetches 401 otherwise anyway
  for (const id of ["changes", "cmtbtn", "fminus", "fplus", "jump"]) $(id).style.display = "block";
  applyInfoExtras(info);
  setInterval(() => { void fetchInfo().then((i) => { if (i) applyInfoExtras(i); }); }, 45_000);
  modeEl.textContent = info.mode === "interact" ? "interactive" : "view only";
  modeEl.className = info.mode;
  term = new Terminal({
    cols: info.cols,
    rows: info.rows,
    scrollback: 20000,
    fontSize,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    theme: { background: "#141414", foreground: "#d8d8d8" },
    disableStdin: info.mode !== "interact",
  });
  term.open($("term"));
  term.loadAddon(new CanvasAddon());
  if (info.mode === "interact") {
    bar.style.display = "flex";
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
// --- ± changes: read-only working diff of the shared session (PR-review feel).
// Server allows it in both share modes — it reads git state, it types nothing.
const changesBtn = $("changes"), diffdlg = $("diffdlg"), dstat = $("dstat"), dtxt = $("dtxt"), dcommits = $("dcommits");
diffdlg.addEventListener("click", (e) => {
  if (e.target === diffdlg) diffdlg.style.display = "none";
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { diffdlg.style.display = "none"; closeCmts(); }
});
const fmtAgo = (ts: number) => {
  const min = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
async function openChanges() {
  dstat.textContent = "loading…";
  dtxt.replaceChildren();
  dcommits.replaceChildren();
  dcommits.style.display = "none";
  diffdlg.style.display = "flex";
  const res = await fetch(`/s/${shareId}/diff`);
  const data = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean; error?: string;
      commits?: { hash: string; ts: number; subject: string }[] };
  if (!res.ok || data.error) {
    dstat.textContent = data.error ?? "diff unavailable";
    return;
  }
  const n = data.status?.length ?? 0;
  dstat.textContent = `${data.branch ?? "?"} · ${n} file${n === 1 ? "" : "s"} changed${data.truncated ? " · diff truncated" : ""}`;
  if (data.commits?.length) {
    dcommits.style.display = "block";
    for (const c of data.commits) {
      const row = document.createElement("div");
      const hash = document.createElement("span");
      hash.className = "ch";
      hash.textContent = c.hash;
      const subject = document.createElement("span");
      subject.textContent = c.subject;
      const when = document.createElement("span");
      when.className = "ct";
      when.textContent = fmtAgo(c.ts);
      row.append(hash, subject, when);
      dcommits.appendChild(row);
    }
  }
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
changesBtn.onclick = () => void openChanges();

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

// --- viewer QoL: font size (persisted) + jump to latest output ---
function setFont(delta: number) {
  fontSize = Math.min(MAX_FONT, Math.max(MIN_FONT, fontSize + delta));
  localStorage.setItem(FONT_KEY, String(fontSize));
  if (term) term.options.fontSize = fontSize;
}
$("fminus").onclick = () => setFont(-1);
$("fplus").onclick = () => setFont(1);
$("jump").onclick = () => term?.scrollToBottom();

// --- comments: guest thread on this share, allowed in both modes ---
const cmtdlg = $("cmtdlg"), cmtlist = $("cmtlist"), cmtmsg = $("cmtmsg"),
  cmtname = $("cmtname") as HTMLInputElement, cmtinput = $("cmtinput") as HTMLTextAreaElement,
  cmtpost = $("cmtpost") as HTMLButtonElement;
cmtname.value = localStorage.getItem(NAME_KEY) ?? "";
let cmtTimer = 0;

function renderComments(comments: ShareComment[]) {
  const atBottom = cmtlist.scrollHeight - cmtlist.scrollTop - cmtlist.clientHeight < 40;
  cmtlist.replaceChildren();
  if (!comments.length) {
    const empty = document.createElement("div");
    empty.id = "cmtempty";
    empty.textContent = "no comments yet — say hi";
    cmtlist.appendChild(empty);
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
  renderComments(data.comments ?? []);
  $("cmtbtn").textContent = data.comments?.length ? `💬 ${data.comments.length}` : "💬";
}

function closeCmts() {
  cmtdlg.style.display = "none";
  clearInterval(cmtTimer);
}
cmtdlg.addEventListener("click", (e) => {
  if (e.target === cmtdlg) closeCmts();
});
$("cmtbtn").onclick = () => {
  cmtdlg.style.display = "flex";
  void loadComments();
  clearInterval(cmtTimer);
  cmtTimer = window.setInterval(() => void loadComments(), 8000);
  (cmtname.value ? cmtinput : cmtname).focus();
};

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

void (async () => {
  const info = await fetchInfo(); // cookie may already be set from an earlier visit
  if (info) start(info);
  else {
    gate.style.display = "flex";
    pw.focus();
  }
})();

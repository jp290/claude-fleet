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

interface Info { slotLabel: string | null; mode: "view" | "interact"; cols: number; rows: number; active: boolean }

const MAX_CHUNK = 1000; // server drops WS messages over 1024 bytes

let term: Terminal | null = null;
let ws: WebSocket | null = null;
let gen = 0;

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

function start(info: Info) {
  gate.style.display = "none";
  if (!info.active) {
    showNotice("The shared session was ended by the owner.");
    return;
  }
  title.textContent = info.slotLabel ?? "Shared session";
  document.title = `${info.slotLabel ?? "Shared session"} — Claude Fleet`;
  $("changes").style.display = "block"; // only after auth — the fetch 401s otherwise anyway
  modeEl.textContent = info.mode === "interact" ? "interactive" : "view only";
  modeEl.className = info.mode;
  term = new Terminal({
    cols: info.cols,
    rows: info.rows,
    scrollback: 20000,
    fontSize: 12,
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
const changesBtn = $("changes"), diffdlg = $("diffdlg"), dstat = $("dstat"), dtxt = $("dtxt");
diffdlg.addEventListener("click", (e) => {
  if (e.target === diffdlg) diffdlg.style.display = "none";
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") diffdlg.style.display = "none";
});
async function openChanges() {
  dstat.textContent = "loading…";
  dtxt.replaceChildren();
  diffdlg.style.display = "flex";
  const res = await fetch(`/s/${shareId}/diff`);
  const data = (await res.json().catch(() => ({}))) as
    { branch?: string | null; status?: string[]; diff?: string; truncated?: boolean; error?: string };
  if (!res.ok || data.error) {
    dstat.textContent = data.error ?? "diff unavailable";
    return;
  }
  const n = data.status?.length ?? 0;
  dstat.textContent = `${data.branch ?? "?"} · ${n} file${n === 1 ? "" : "s"} changed${data.truncated ? " · diff truncated" : ""}`;
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

void (async () => {
  const info = await fetchInfo(); // cookie may already be set from an earlier visit
  if (info) start(info);
  else {
    gate.style.display = "flex";
    pw.focus();
  }
})();

import { stat, rm, readdir } from "node:fs/promises";
import { existsSync, statSync, mkdirSync, chmodSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ServerWebSocket } from "bun";

// Defaults to localhost — nothing is network-reachable until you explicitly set FLEET_HOST
// (e.g. your Tailscale IP via `tailscale ip -4`). Even then, every request needs the access
// token (printed on boot), because a reachable fleet is remote code execution as your user.
const HOST = process.env.FLEET_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
// separate tmux socket per instance — lets a test instance (FLEET_SOCK=fleettest)
// run its own s1..sN sessions without touching the live fleet's
const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
const MAX_SLOTS = 10;
const REPLAY_TAIL = 2_000_000;
// lines of scrollback to re-seed from a fresh capture-pane when a client's width
// doesn't match the pane's current width (tmux reflows history on resize-window,
// so this replays correctly-wrapped text instead of the raw stream's stale wrapping)
const SEED_LINES = 3000;
const MAX_RECENTS = 8;
const STREAM_DIR = `${import.meta.dir}/streams`;
const STATE_FILE = `${import.meta.dir}/fleet.json`;
const HOME = process.env.HOME!;
const SHELL = process.env.SHELL ?? "/bin/sh";
// Safe default: claude WITH its permission prompts. Opt into unattended mode explicitly:
//   FLEET_CMD='claude --dangerously-skip-permissions'
// New panes inherit the tmux SERVER's environment — often the bare launchd/ssh default
// (no ~/.local/bin, no brew), NOT this process's env and NOT tmux's global env table.
// Bake our PATH into the command so `claude` resolves no matter who started tmux.
const PATH_EXPORT = process.env.PATH ? `export PATH='${process.env.PATH.replaceAll("'", "'\\''")}'; ` : "";
const CLAUDE_CMD = `${PATH_EXPORT}${process.env.FLEET_CMD ?? "claude"}; exec ${SHELL}`;
const CHIPS = (process.env.FLEET_CHIPS ?? "")
  .split(",").map((c) => c.trim()).filter(Boolean);
const MAX_LABEL = 40;
const CLEAR = new TextEncoder().encode("\x1b[3J\x1b[2J\x1b[H");

type WSData = { slot: number; queue: Uint8Array[]; ready: boolean; cols: number; rows: number; force: boolean };

interface Slot {
  id: number;
  cwd: string | null; // null = slot not activated; self-heal only touches activated slots
  label: string | null; // user-chosen session name; falls back to cwd basename in the UI
  offset: number;
  lastOutput: number;
  quietUntil: number; // resize/repaint make the TUI redraw — don't count that as activity
  cols: number; // last tmux window size we applied — lets a same-size reconnect skip reseeding
  rows: number;
  clients: Set<ServerWebSocket<WSData>>;
  inputChain: Promise<unknown>;
  resizeChain: Promise<unknown>; // serializes resize-window+capture-pane so two concurrent
  // triggers (e.g. two clients connecting at different widths) can't interleave their
  // tmux calls and hand one client a seed reflowed to the other's width
}

const slots: Slot[] = Array.from({ length: MAX_SLOTS }, (_, i) => ({
  id: i + 1,
  cwd: null,
  label: null,
  offset: 0,
  lastOutput: 0,
  quietUntil: 0,
  cols: 200,
  rows: 50,
  clients: new Set(),
  inputChain: Promise.resolve(),
  resizeChain: Promise.resolve(),
}));
let recents: string[] = [];
let persistedToken: string | null = null;

const sess = (id: number) => `s${id}`;
const streamPath = (id: number) => `${STREAM_DIR}/s${id}.raw`;

async function tmux(...args: string[]): Promise<{ out: string; code: number }> {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const code = await p.exited;
  return { out: out.trim(), code };
}

// writes are serialized: overlapping fire-and-forget writes to the same file can interleave
let saveChain: Promise<unknown> = Promise.resolve();
function saveState(): void {
  const active: Record<string, { cwd: string; label: string | null }> = {};
  for (const s of slots) if (s.cwd) active[s.id] = { cwd: s.cwd, label: s.label };
  const body = JSON.stringify({ token: persistedToken, slots: active, recents }, null, 2);
  saveChain = saveChain
    .then(() => Bun.write(STATE_FILE, body))
    .then(() => chmodSync(STATE_FILE, 0o600))
    .catch((e: unknown) => console.log(`state save failed: ${e instanceof Error ? e.message : e}`));
}

// resize jiggle: SIGWINCH makes the TUI repaint into the fresh pipe so the client aligns
async function repaint(name: string): Promise<void> {
  const size = await tmux("display-message", "-p", "-t", name, "#{window_width} #{window_height}");
  const [w, h] = size.out.split(" ").map(Number);
  if (!w || !h) return;
  await tmux("resize-window", "-t", name, "-x", String(w), "-y", String(h - 1));
  await Bun.sleep(200);
  await tmux("resize-window", "-t", name, "-x", String(w), "-y", String(h));
}

// capture-pane's text output separates rows with a bare LF, never a CR. A raw terminal
// (xterm.js included) doesn't treat LF alone as "return to column 0" — it just moves down
// a row, so any line shorter than the pane's width leaves the cursor short of column 0 and
// the next line starts printing mid-row, staggering everything after it. -e output mostly
// dodges this because its column-jump escapes reposition text within a line regardless of
// where the cursor landed, but plain output (our width-reseed path) has no such escapes and
// hits this on nearly every line — normalize before anything captured reaches a terminal.
const crlf = (text: string) => text.replace(/\r?\n/g, "\r\n");

async function ensureSlot(s: Slot): Promise<void> {
  if (!s.cwd) return;
  const name = sess(s.id);
  const has = await tmux("has-session", "-t", name);
  if (has.code !== 0) {
    await tmux("set", "-g", "history-limit", "50000");
    // has-session/new-session isn't atomic: the 2s self-heal loop and a fresh openSlot()
    // can race to create the same session — only the winner should log/reset window size
    const created = await tmux("new-session", "-d", "-s", name, "-x", "200", "-y", "50", "-c", s.cwd, CLAUDE_CMD);
    if (created.code === 0) {
      s.cols = 200;
      s.rows = 50;
      console.log(`slot ${s.id}: created tmux session '${name}' in ${s.cwd}`);
    }
  }
  const pipe = await tmux("display-message", "-p", "-t", name, "#{pane_pipe}");
  const pipeOpen = pipe.out === "1";
  const file = streamPath(s.id);
  // terminal output can contain secrets — keep the stream private no matter which
  // process created the file (tmux's `cat >>` creates it with the default umask)
  if (existsSync(file) && (statSync(file).mode & 0o777) !== 0o600) chmodSync(file, 0o600);
  if (pipeOpen && existsSync(file)) return;
  if (pipeOpen) await tmux("pipe-pane", "-t", name); // close stale pipe (file was deleted)
  // seed stream with full pane history, then start piping raw output
  const cap = await tmux("capture-pane", "-t", name, "-e", "-p", "-S", "-");
  await Bun.write(file, crlf(cap.out) + "\r\n");
  chmodSync(file, 0o600);
  await tmux("pipe-pane", "-t", name, "-o", `exec cat >> '${file}'`);
  s.quietUntil = Date.now() + 1500;
  await repaint(name);
}

function expandCwd(raw: string): string {
  const t = raw.trim();
  if (t === "" || t === "~") return HOME;
  if (t.startsWith("~/")) return HOME + t.slice(1);
  return t;
}

async function openSlot(s: Slot, cwdRaw: string): Promise<void> {
  const cwd = resolve(expandCwd(cwdRaw));
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error(`not a directory: ${cwd}`);
  s.cwd = cwd;
  s.label = null; // a fresh session gets a fresh identity
  recents = [cwd, ...recents.filter((r) => r !== cwd)].slice(0, MAX_RECENTS);
  saveState();
  await ensureSlot(s);
}

async function killSlot(s: Slot): Promise<void> {
  s.cwd = null; // clear first so the self-heal loop can't resurrect it mid-kill
  s.label = null;
  saveState();
  await tmux("kill-session", "-t", sess(s.id));
  await rm(streamPath(s.id), { force: true });
  s.offset = 0;
  s.lastOutput = 0;
  s.quietUntil = 0;
  s.cols = 200;
  s.rows = 50;
  for (const ws of s.clients) ws.close(4000, "slot killed");
  s.clients.clear();
}

async function sendText(s: Slot, text: string, submit: boolean): Promise<void> {
  // route through inputChain like raw keystrokes do — otherwise a compose-box send racing
  // concurrent WS keystrokes (mobile key row, live typing, direct terminal typing) can
  // interleave paste-buffer/send-keys with a concurrent send-keys, reordering pty input
  const task = s.inputChain.then(async () => {
    const buf = `fleetbuf${s.id}`;
    const p = Bun.spawn(["tmux", "-L", SOCK, "load-buffer", "-b", buf, "-"], { stdin: "pipe" });
    p.stdin.write(text);
    await p.stdin.end();
    await p.exited;
    await tmux("paste-buffer", "-p", "-d", "-b", buf, "-t", sess(s.id));
    if (submit) {
      await Bun.sleep(150);
      await tmux("send-keys", "-t", sess(s.id), "Enter");
    }
  });
  s.inputChain = task.catch(() => {});
  await task;
}

function broadcast(s: Slot, chunk: Uint8Array): void {
  for (const ws of s.clients) {
    if (ws.data.ready) ws.send(chunk);
    else ws.data.queue.push(chunk);
  }
}

async function poll(): Promise<void> {
  await Promise.all(
    slots.map(async (s) => {
      if (!s.cwd) return;
      try {
        const size = (await stat(streamPath(s.id))).size;
        if (size < s.offset) {
          s.offset = 0;
          // stream was truncated (session recreated) — clear stale scrollback on connected clients
          broadcast(s, CLEAR);
        }
        if (size > s.offset) {
          const buf = await Bun.file(streamPath(s.id)).slice(s.offset, size).arrayBuffer();
          s.offset = size;
          // output during a quiet window is a repaint we caused (resize jiggle),
          // not the session doing work — stream it, but don't light the activity dot
          if (Date.now() > s.quietUntil) s.lastOutput = Date.now();
          broadcast(s, new Uint8Array(buf));
        }
      } catch {
        // stream file briefly missing during recreate — next tick picks it up
      }
    }),
  );
}

async function listDirs(raw: string) {
  const dir = resolve(expandCwd(raw));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`not a directory: ${dir}`);
  const entries = await readdir(dir, { withFileTypes: true });
  const dirs = entries
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !e.name.startsWith("."))
    .filter((e) => { try { return statSync(`${dir}/${e.name}`).isDirectory(); } catch { return false; } })
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 200);
  const common = [HOME, `${HOME}/Desktop`, `${HOME}/Documents`, `${HOME}/Downloads`]
    .filter((p) => existsSync(p));
  const parent = dirname(dir);
  return { path: dir, parent: parent === dir ? null : parent, dirs, recents, common };
}

// --- auth: single access token, sent once via ?token= then held in a SameSite=Strict cookie.
// Strict cookie + Origin/Host guards below are what stand between "any website you visit"
// and keystroke injection into your shells (WebSockets are not subject to CORS).
function tokenFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.headers.get("cookie");
  const m = cookie ? /(?:^|;\s*)fleet=([^;]+)/.exec(cookie) : null;
  if (m) return m[1];
  return new URL(req.url).searchParams.get("token");
}

let TOKEN = "";
function tokenOk(t: string | null): boolean {
  if (!t) return false;
  const a = Buffer.from(t), b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ALLOWED_HOSTS = new Set(
  [`${HOST}:${PORT}`, `localhost:${PORT}`, `127.0.0.1:${PORT}`]
    .concat((process.env.FLEET_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean)),
);

// DNS-rebinding guard (Host) + cross-site guard (Origin). Browsers attach Origin to
// fetch/XHR/WebSocket; if it's present its host must be us.
function guard(req: Request): Response | null {
  const host = req.headers.get("host") ?? "";
  if (!ALLOWED_HOSTS.has(host))
    return json({ error: `host '${host}' not allowed — set FLEET_ALLOWED_HOSTS` }, 403);
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return json({ error: "cross-origin request blocked" }, 403);
    } catch {
      return json({ error: "cross-origin request blocked" }, 403);
    }
  }
  return null;
}

const STATIC: Record<string, { path: string; type: string }> = {
  "/": { path: `${import.meta.dir}/public/index.html`, type: "text/html; charset=utf-8" },
  "/app.js": { path: `${import.meta.dir}/public/app.js`, type: "text/javascript" },
  "/xterm.css": { path: `${import.meta.dir}/node_modules/@xterm/xterm/css/xterm.css`, type: "text/css" },
  "/manifest.webmanifest": { path: `${import.meta.dir}/public/manifest.webmanifest`, type: "application/manifest+json" },
  "/icon.svg": { path: `${import.meta.dir}/public/icon.svg`, type: "image/svg+xml" },
  "/icon-180.png": { path: `${import.meta.dir}/public/icon-180.png`, type: "image/png" },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function slotFrom(raw: unknown): Slot | null {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > MAX_SLOTS) return null;
  return slots[id - 1];
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) return null;
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// --- startup: restore persisted state, adopt stray fleet sessions, seed offsets ---
mkdirSync(STREAM_DIR, { recursive: true });
chmodSync(STREAM_DIR, 0o700);
await tmux("start-server");
if (existsSync(STATE_FILE)) {
  try {
    const persisted = (await Bun.file(STATE_FILE).json()) as {
      token?: unknown; slots?: Record<string, { cwd?: unknown; label?: unknown }>; recents?: unknown;
    };
    if (typeof persisted.token === "string") persistedToken = persisted.token;
    if (Array.isArray(persisted.recents)) recents = persisted.recents.filter((r): r is string => typeof r === "string");
    for (const [k, v] of Object.entries(persisted.slots ?? {})) {
      const s = slotFrom(k);
      if (s && typeof v?.cwd === "string") {
        s.cwd = v.cwd;
        if (typeof v.label === "string") s.label = v.label;
      }
    }
  } catch {
    console.log("fleet.json unreadable — starting with empty state");
  }
}
if (process.env.FLEET_TOKEN) {
  TOKEN = process.env.FLEET_TOKEN;
} else {
  if (!persistedToken) persistedToken = randomBytes(24).toString("hex");
  TOKEN = persistedToken;
}
const ls = await tmux("list-sessions", "-F", "#{session_name}");
if (ls.code === 0) {
  for (const name of ls.out.split("\n")) {
    const m = /^s(\d+)$/.exec(name);
    const s = m ? slotFrom(m[1]) : null;
    if (s && !s.cwd) {
      const p = await tmux("display-message", "-p", "-t", name, "#{pane_current_path}");
      s.cwd = p.out || HOME;
      console.log(`slot ${s.id}: adopted existing tmux session '${name}'`);
    }
  }
}
saveState();
for (const s of slots) {
  if (!s.cwd) continue;
  await ensureSlot(s);
  s.offset = existsSync(streamPath(s.id)) ? (await stat(streamPath(s.id))).size : 0;
}

setInterval(() => void poll(), 100);
// self-heal: recreate any activated slot whose pane died (crash, accidental kill-session).
// ensureSlot is a cheap no-op (two tmux queries) per healthy slot
setInterval(() => {
  for (const s of slots) void ensureSlot(s).catch(() => {});
}, 2000);

Bun.serve<WSData>({
  hostname: HOST,
  port: PORT,
  async fetch(req, server) {
    const blocked = guard(req);
    if (blocked) return blocked;
    const url = new URL(req.url);

    // login: /?token=… sets the cookie and redirects to a clean URL
    if (url.pathname === "/" && url.searchParams.has("token")) {
      if (!tokenOk(url.searchParams.get("token"))) return json({ error: "bad token" }, 401);
      return new Response(null, {
        status: 302,
        headers: {
          location: "/",
          "set-cookie": `fleet=${TOKEN}; Path=/; SameSite=Strict; Max-Age=31536000`,
        },
      });
    }
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
    const st = STATIC[url.pathname];
    if (st)
      return new Response(Bun.file(st.path), {
        headers: { "content-type": st.type, "cache-control": "no-store" },
      });

    // everything below carries authority — token required
    if (!tokenOk(tokenFrom(req))) return json({ error: "unauthorized" }, 401);

    const wsMatch = /^\/ws\/(\d+)$/.exec(url.pathname);
    if (wsMatch) {
      const s = slotFrom(wsMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 404);
      // cols/rows are the connecting client's real terminal size, known synchronously
      // at connect time — unlike the client's separate /resize POST (fired onopen),
      // this avoids a race between the initial replay and the first resize
      const colsParam = url.searchParams.get("cols");
      const rowsParam = url.searchParams.get("rows");
      const cols = colsParam ? Math.min(300, Math.max(20, Number(colsParam) | 0)) : 0;
      const rows = rowsParam ? Math.min(200, Math.max(10, Number(rowsParam) | 0)) : 0;
      // set by the client's explicit reload/refresh action — a plain reconnect (auto-retry
      // after a drop, or a fresh slot assignment) only reseeds on an actual width mismatch,
      // which does nothing if the client's width already happens to match; force skips that
      // check so "reload" reliably re-derives from tmux's current state either way
      const force = url.searchParams.get("force") === "1";
      if (server.upgrade(req, { data: { slot: s.id, queue: [], ready: false, cols, rows, force } })) return;
      return new Response("upgrade failed", { status: 400 });
    }
    if (url.pathname === "/api/sessions") {
      return json({
        now: Date.now(),
        chips: CHIPS,
        slots: slots.map((s) => ({ id: s.id, cwd: s.cwd, label: s.label, lastOutput: s.lastOutput })),
      });
    }
    if (url.pathname === "/api/dirs") {
      try {
        return json(await listDirs(url.searchParams.get("path") ?? "~"));
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "bad path" }, 400);
      }
    }
    const slotMatch = /^\/api\/slots\/(\d+)\/(open|kill|rename)$/.exec(url.pathname);
    if (req.method === "POST" && slotMatch) {
      const s = slotFrom(slotMatch[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      if (slotMatch[2] === "rename") {
        if (!s.cwd) return json({ error: "slot not active" }, 400);
        const body = await readJson(req);
        if (!body || typeof body.label !== "string" || body.label.length > MAX_LABEL)
          return json({ error: `label must be a string of at most ${MAX_LABEL} chars` }, 400);
        s.label = body.label.trim() || null; // empty clears back to the cwd-basename default
        saveState();
        return json({ ok: true, label: s.label });
      }
      if (slotMatch[2] === "open") {
        const body = await readJson(req);
        if (!body) return json({ error: "expected application/json" }, 400);
        try {
          await openSlot(s, typeof body.cwd === "string" ? body.cwd : "~");
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "open failed" }, 400);
        }
        return json({ ok: true, cwd: s.cwd });
      }
      await killSlot(s);
      return json({ ok: true });
    }
    if (req.method === "POST" && url.pathname === "/send") {
      const body = await readJson(req);
      if (!body) return json({ error: "expected application/json" }, 400);
      const s = slotFrom(body.slot);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      if (typeof body.text !== "string" || body.text.length > 100_000) return json({ error: "bad text" }, 400);
      await sendText(s, body.text, body.submit !== false);
      return json({ ok: true });
    }
    if (req.method === "POST" && url.pathname === "/resize") {
      const body = await readJson(req);
      if (!body) return json({ error: "expected application/json" }, 400);
      const s = slotFrom(body.slot);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const c = Math.min(300, Math.max(20, Number(body.cols) | 0));
      const r = Math.min(200, Math.max(10, Number(body.rows) | 0));
      // no-op guard: repaint() forces a visible blank-then-redraw (see below) — skip it
      // when the size hasn't actually changed, so client-side measurement noise (e.g. the
      // keyboard nudging the viewport a few px while typing) can't retrigger it
      if (c === s.cols && r === s.rows) return json({ ok: true, cols: c, rows: r });
      const name = sess(s.id);
      const task = s.resizeChain.then(async () => {
        s.quietUntil = Date.now() + 1500; // the repaint this causes is not session activity
        await tmux("resize-window", "-t", name, "-x", String(c), "-y", String(r));
        s.cols = c;
        s.rows = r;
        // force the TUI to redraw into the new size now, instead of waiting on its own
        // SIGWINCH handling (a plain shell prompt won't reflow on its own at all)
        await repaint(name);
      });
      s.resizeChain = task.catch(() => {});
      await task;
      return json({ ok: true, cols: c, rows: r });
    }
    return new Response("not found", { status: 404 });
  },
  websocket: {
    async open(ws) {
      const s = slots[ws.data.slot - 1];
      s.clients.add(ws);
      const { cols, rows, force } = ws.data;
      const name = sess(s.id);
      if (cols && rows && (force || cols !== s.cols || rows !== s.rows)) {
        // this client's width doesn't match the pane's current width (or the client
        // explicitly asked for a reseed regardless — see the `force` comment above).
        // tmux reflows pane history on resize-window, so resizing then capturing fresh replays
        // correctly-wrapped scrollback instead of the raw stream's stale wrapping.
        // Trade-off: this also resizes the shared pty for any other connected client
        // (last connect wins, same as /resize) — true concurrent multi-width live
        // rendering would need a per-client vt emulator, out of scope here.
        // Chained through resizeChain (shared with /resize) so a second client
        // connecting/resizing concurrently can't sneak its own resize-window in
        // between this one and its capture-pane, handing this client a seed
        // reflowed to the OTHER client's width instead of its own.
        const task = s.resizeChain.then(async () => {
          s.quietUntil = Date.now() + 1500;
          await tmux("resize-window", "-t", name, "-x", String(cols), "-y", String(rows));
          s.cols = cols;
          s.rows = rows;
          // no -e here: tmux's escape-preserving capture encodes styled-vs-default runs
          // as absolute-column cursor jumps (e.g. "\x1b[200G") baked in at the ORIGINAL
          // width — replaying those into a narrower terminal reproduces the exact
          // garbling this reseed exists to fix. Plain text reflows correctly; the
          // trade-off is old scrollback loses color after a width change, which is
          // preferable to it being unreadable. Live output stays fully colored.
          const cap = await tmux("capture-pane", "-t", name, "-p", "-S", `-${SEED_LINES}`);
          ws.send(new TextEncoder().encode(crlf(cap.out) + "\r\n"));
          try {
            s.offset = (await stat(streamPath(s.id))).size;
          } catch {
            // stream file briefly missing during recreate — next poll tick picks it up
          }
          await repaint(name);
        });
        s.resizeChain = task.catch(() => {});
        await task;
      } else {
        const upTo = s.offset;
        const start = Math.max(0, upTo - REPLAY_TAIL);
        if (upTo > start) {
          const buf = await Bun.file(streamPath(s.id)).slice(start, upTo).arrayBuffer();
          ws.send(new Uint8Array(buf));
        }
      }
      ws.data.ready = true;
      for (const chunk of ws.data.queue) ws.send(chunk);
      ws.data.queue = [];
    },
    close(ws) {
      slots[ws.data.slot - 1].clients.delete(ws);
    },
    // live input: client sends raw keystroke bytes, forwarded verbatim to the pane.
    // serialized per slot through a promise chain — concurrent send-keys spawns reorder keystrokes
    message(ws, msg) {
      const s = slots[ws.data.slot - 1];
      const bytes = typeof msg === "string" ? new TextEncoder().encode(msg) : new Uint8Array(msg);
      if (bytes.length === 0 || bytes.length > 1024) return;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0"));
      s.inputChain = s.inputChain.then(() => tmux("send-keys", "-t", sess(s.id), "-H", ...hex)).catch(() => {});
    },
  },
});

console.log(`claude-fleet: http://${HOST}:${PORT}  (tmux -L ${SOCK}, slots 1..${MAX_SLOTS})`);
// only print the token to a real terminal — with stdout redirected (the documented
// tmux `>> server.log` setup) it would land in a file created at the shell's default
// umask, undoing the 600/700 discipline everything else applies to the token
if (process.stdout.isTTY) {
  console.log(`login: http://${HOST}:${PORT}/?token=${TOKEN}`);
} else {
  console.log(`login: http://${HOST}:${PORT}/?token=<token> — not printed to a non-TTY; read it from ${STATE_FILE} (mode 600)`);
}

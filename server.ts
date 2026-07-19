import { stat, rm, readdir, appendFile } from "node:fs/promises";
import { existsSync, statSync, mkdirSync, chmodSync, readdirSync, readFileSync } from "node:fs";
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
const MAX_SLOTS = 16; // ⌃1–⌃0 reach the first ten; 11+ are click/tap-only overflow
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
const BASE_CMD = process.env.FLEET_CMD ?? "claude";
// when the slot actually runs claude, pin its session id so the transcript path
// (~/.claude/projects/<cwd-slug>/<uuid>.jsonl) is known instead of guessed by mtime
function slotCmd(sessionId: string | null, resume: boolean): string {
  const cmd = sessionId && /^claude(\s|$)/.test(BASE_CMD)
    ? `${BASE_CMD} ${resume ? "--resume" : "--session-id"} ${sessionId}`
    : BASE_CMD;
  return `${PATH_EXPORT}${cmd}; exec ${SHELL}`;
}
const CHIPS = (process.env.FLEET_CHIPS ?? "")
  .split(",").map((c) => c.trim()).filter(Boolean);
const MAX_LABEL = 40;
const CLEAR = new TextEncoder().encode("\x1b[3J\x1b[2J\x1b[H");

type WSData = {
  slot: number; queue: Uint8Array[]; ready: boolean; cols: number; rows: number; force: boolean;
  share?: string; // set on guest connections: the share id this socket belongs to
  mode?: "view" | "interact";
};

// a share exposes exactly ONE slot to a guest behind its own password — the owner
// token never leaves this machine. view = stream only; interact = typing + compose too.
interface Share { id: string; slot: number; secret: string; mode: "view" | "interact"; created: number }

// a scheduled prompt: one-shot (everySec null) or recurring with a MANDATORY runs cap.
// Guard rails are the point — see tickAutos() for the idle gate and the claude-alive gate.
interface Auto {
  id: string;
  slot: number;
  text: string;
  everySec: number | null;
  nextAt: number;
  runsLeft: number;
  idleSec: number; // only fire when the session produced no output for this long (0 = always)
  enabled: boolean;
  created: number;
  lastRun: number;
  lastResult: string | null;
}

// a queued feature request. Owner-created or submitted via the public /intake address
// (e.g. a CEO emailing features in). NEVER auto-sent: a task only leaves `pending` when
// the OWNER promotes it to `queued`; the idle dispatcher then assigns queued tasks to
// free lanes. External text is data, never a command until the owner opts it in.
interface Task {
  id: string;
  text: string;
  source: "owner" | "intake";
  from: string | null; // intake sender label (freeform, for display only — never trusted)
  status: "pending" | "queued" | "sent" | "done";
  created: number;
  slot: number | null; // set once dispatched
  note: string | null;
}

interface Slot {
  id: number;
  cwd: string | null; // null = slot not activated; self-heal only touches activated slots
  label: string | null; // user-chosen session name; falls back to cwd basename in the UI
  worktree: { repo: string; branch: string } | null; // set when Fleet created this slot's
  // cwd as a git worktree ("lane") — land/cleanup only ever touches tagged slots
  offset: number;
  lastOutput: number;
  quietUntil: number; // resize/repaint make the TUI redraw — don't count that as activity
  cols: number; // last tmux window size we applied — lets a same-size reconnect skip reseeding
  rows: number;
  sessionId: string | null; // claude session uuid we pinned at pane creation; null for
  // adopted/pre-existing sessions (transcript lookup then falls back to newest-by-mtime)
  history: { text: string; ts: number }[]; // composed sends only, newest last — the
  // durable "what did I prompt" record; raw live typing is deliberately not captured
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
  worktree: null,
  offset: 0,
  lastOutput: 0,
  quietUntil: 0,
  cols: 200,
  rows: 50,
  sessionId: null,
  history: [],
  clients: new Set(),
  inputChain: Promise.resolve(),
  resizeChain: Promise.resolve(),
}));
let recents: string[] = [];
let shares: Share[] = [];
let autos: Auto[] = [];
let tasks: Task[] = [];
const MAX_TASKS = 200;
// cap the task list WITHOUT dropping non-terminal tasks: a still-pending/queued/sent task
// must never be evicted just because 200 done tasks piled up — only `done` is prunable
function capTasks(list: Task[]): Task[] {
  if (list.length <= MAX_TASKS) return list;
  const live = new Set(list.filter((t) => t.status !== "done"));
  const keepDone = Math.max(0, MAX_TASKS - live.size);
  const keptDone = new Set(list.filter((t) => t.status === "done").slice(-keepDone));
  return list.filter((t) => live.has(t) || keptDone.has(t));
}
const MAX_TASK_TEXT = 20_000;
// the dispatcher is OFF unless the owner sets a repo to spawn lanes from — an idle machine
// auto-spawning claude sessions from external email is exactly the footgun we refuse by default
const DISPATCH_REPO = process.env.FLEET_DISPATCH_REPO ?? "";
const DISPATCH_MAX_LANES = Math.max(1, Number(process.env.FLEET_DISPATCH_MAX_LANES ?? 3) | 0);
let dispatchOn = false; // owner toggles at runtime; only meaningful when DISPATCH_REPO is set
// public intake shares its own secret, NEVER the owner token. Empty = intake disabled.
const INTAKE_SECRET = process.env.FLEET_INTAKE_SECRET ?? "";
const intakeStrikes: number[] = []; // timestamps, for a simple hourly rate limit
const AUTO_MIN_EVERY_SEC = 10;
const AUTO_MAX_RUNS = 100;
const AUTO_MAX_PER_SLOT = 5;
const AUTO_GRACE_MS = 600_000; // how long past due the idle gate may defer before skipping
let persistedToken: string | null = null;
// public base URL for share links shown in the owner UI (e.g. https://klaus.example.com);
// empty = links are rendered relative to wherever the owner opened the dashboard
const SHARE_URL = process.env.FLEET_SHARE_URL ?? "";
// hosts that may ONLY reach share routes — the public tunnel hostname goes here so the
// internet-facing side can never even load the owner login page
const SHARE_HOSTS = new Set((process.env.FLEET_SHARE_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean));

const sess = (id: number) => `s${id}`;
const streamPath = (id: number) => `${STREAM_DIR}/s${id}.raw`;
// claude's transcript dir for a cwd (used by ensureSlot's resume check at boot,
// so it must be defined before the startup section runs)
const projDir = (cwd: string) => `${HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
const historyPath = (id: number) => `${STREAM_DIR}/s${id}.history.json`;
const MAX_HISTORY = 100;

// same serialization rationale as saveState: overlapping rewrites of one file interleave
let historyChain: Promise<unknown> = Promise.resolve();
function saveHistory(s: Slot): void {
  const body = JSON.stringify(s.history);
  historyChain = historyChain
    .then(() => Bun.write(historyPath(s.id), body))
    .then(() => chmodSync(historyPath(s.id), 0o600)) // prompts can carry secrets, like the stream
    .catch((e: unknown) => console.log(`history save failed: ${e instanceof Error ? e.message : e}`));
}

// global append-only prompt log: every composed send from every surface (owner compose,
// share guests, scheduled autos), across slot lifetimes. Unlike per-slot history it is
// never capped, never rotated, and survives slot close — raw material for prompt analysis.
const PROMPT_LOG = `${STREAM_DIR}/prompts.jsonl`;
let promptLogChain: Promise<unknown> = Promise.resolve();
function logPrompt(s: Slot, text: string, source: "owner" | "share" | "auto", ts: number): void {
  const line = `${JSON.stringify({ ts, slot: s.id, cwd: s.cwd, label: s.label, source, text })}\n`;
  promptLogChain = promptLogChain
    .then(() => appendFile(PROMPT_LOG, line, { mode: 0o600 }))
    .then(() => chmodSync(PROMPT_LOG, 0o600)) // prompts can carry secrets, like the stream
    .catch((e: unknown) => console.log(`prompt log failed: ${e instanceof Error ? e.message : e}`));
}

async function tmux(...args: string[]): Promise<{ out: string; code: number }> {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const code = await p.exited;
  return { out: out.trim(), code };
}

// writes are serialized: overlapping fire-and-forget writes to the same file can interleave
let saveChain: Promise<unknown> = Promise.resolve();
function saveState(): void {
  const active: Record<string, { cwd: string; label: string | null; sessionId: string | null;
    worktree: { repo: string; branch: string } | null }> = {};
  for (const s of slots) if (s.cwd) active[s.id] = { cwd: s.cwd, label: s.label, sessionId: s.sessionId, worktree: s.worktree };
  const body = JSON.stringify({ token: persistedToken, slots: active, recents, shares, autos, tasks }, null, 2);
  saveChain = saveChain
    .then(() => Bun.write(STATE_FILE, body))
    .then(() => chmodSync(STATE_FILE, 0o600))
    .catch((e: unknown) => console.log(`state save failed: ${e instanceof Error ? e.message : e}`));
}

// --- git: lane (worktree) support. All git runs through the array-form spawn — nothing
// user-controlled ever reaches a shell string ---
async function git(dir: string, ...args: string[]): Promise<{ out: string; err: string; code: number }> {
  const p = Bun.spawn(["git", "-C", dir, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const err = await new Response(p.stderr).text();
  const code = await p.exited;
  return { out: out.trim(), err: err.trim(), code };
}

// branch/dirty/ahead-behind per active slot, refreshed on a slow tick — the sessions
// poll must never block on 16 git spawns, so it reads this cache instead
interface GitInfo { branch: string; dirty: number; ahead: number; behind: number }
const gitInfo = new Map<number, GitInfo | null>(); // null = cwd is not a git repo
let gitTickBusy = false;
async function tickGit(): Promise<void> {
  if (gitTickBusy) return;
  gitTickBusy = true;
  try {
    for (const s of slots) {
      if (!s.cwd) { gitInfo.delete(s.id); continue; }
      const st = await git(s.cwd, "status", "--porcelain=v2", "--branch");
      if (st.code !== 0) { gitInfo.set(s.id, null); continue; }
      let branch = "", ahead = 0, behind = 0, dirty = 0;
      for (const line of st.out.split("\n")) {
        if (line.startsWith("# branch.head ")) branch = line.slice(14);
        else if (line.startsWith("# branch.ab ")) {
          const m = /\+(\d+) -(\d+)/.exec(line);
          if (m) { ahead = Number(m[1]); behind = Number(m[2]); }
        } else if (line && !line.startsWith("#")) dirty++;
      }
      gitInfo.set(s.id, { branch, dirty, ahead, behind });
    }
  } finally {
    gitTickBusy = false;
  }
}

// creates <repo-toplevel>.worktrees/<branch-slug> on a NEW branch off the repo's current
// HEAD. Worktrees only materialize tracked files, so the two files agents predictably
// need but repos predictably don't track (.env, CLAUDE.md) are copied in when present.
async function createWorktree(repoRaw: string, branchRaw: string): Promise<{ repo: string; path: string; branch: string }> {
  const repoDir = resolve(expandCwd(repoRaw));
  if (!existsSync(repoDir) || !statSync(repoDir).isDirectory()) throw new Error(`not a directory: ${repoDir}`);
  const top = await git(repoDir, "rev-parse", "--show-toplevel");
  if (top.code !== 0) throw new Error("not a git repository");
  const root = top.out;
  // auto name carries seconds + a random suffix so two lanes spawned in the same minute
  // (e.g. back-to-back dispatcher ticks) can't slug to the same worktree path and collide
  const stamp = new Date().toISOString().slice(2, 19).replace(/[-:T]/g, "");
  const branch = branchRaw.trim() || `fleet/${stamp}-${randomBytes(2).toString("hex")}`;
  const chk = await git(root, "check-ref-format", "--branch", branch);
  if (chk.code !== 0) throw new Error(`invalid branch name: ${branch}`);
  const path = `${root}.worktrees/${branch.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  if (existsSync(path)) throw new Error(`worktree path already exists: ${path}`);
  mkdirSync(`${root}.worktrees`, { recursive: true });
  const add = await git(root, "worktree", "add", "-b", branch, path);
  if (add.code !== 0) throw new Error(`worktree add failed: ${(add.err || add.out).slice(0, 300)}`);
  // copy env scaffolding a fresh checkout lacks — but ONLY files git IGNORES in the source
  // (same rule as claude's .worktreeinclude). A copied *unignored* file shows as untracked
  // and would leave the lane permanently "dirty", blocking `land`. Gitignored copies stay
  // invisible to `git status`, so the lane is landable the moment its real work is committed.
  for (const f of [".env", "CLAUDE.md", ".claude/settings.local.json"]) {
    if (!existsSync(`${root}/${f}`) || existsSync(`${path}/${f}`)) continue;
    if ((await git(root, "check-ignore", "-q", f)).code !== 0) continue; // not ignored → don't dirty the lane
    if (f.includes("/")) mkdirSync(dirname(`${path}/${f}`), { recursive: true });
    await Bun.write(`${path}/${f}`, Bun.file(`${root}/${f}`));
  }
  return { repo: root, path, branch };
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
    // pane died but we know its claude session and its transcript still exists →
    // self-heal RESUMES the conversation instead of starting a blank one (verified:
    // --resume <id> continues in the same transcript file, id stays stable).
    // Otherwise: fresh claude, fresh pinned uuid — only if WE win the has-session/
    // new-session race below (the 2s self-heal loop and a fresh openSlot() can race)
    const resume = !!s.sessionId && existsSync(`${projDir(s.cwd)}/${s.sessionId}.jsonl`);
    const candidate = resume ? s.sessionId! : crypto.randomUUID();
    const created = await tmux("new-session", "-d", "-s", name, "-x", "200", "-y", "50", "-c", s.cwd, slotCmd(candidate, resume));
    if (created.code === 0) {
      s.cols = 200;
      s.rows = 50;
      s.sessionId = /^claude(\s|$)/.test(BASE_CMD) ? candidate : null;
      saveState();
      console.log(`slot ${s.id}: ${resume ? `resumed claude session ${candidate} in` : "created tmux session"} '${name}' in ${s.cwd}`);
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
  s.worktree = null; // a plain open is not a lane — open-worktree re-tags after this
  s.sessionId = null; // ensureSlot pins a new uuid when it creates the pane
  s.history = []; // ...including a fresh prompt history
  detachSlotTasks(s.id, "slot recycled before landing"); // recycling an active slot is a teardown too
  autos = autos.filter((x) => x.slot !== s.id); // and no inherited schedules
  // a share must not outlive its session (same invariant killSlot enforces) — recycling
  // an active slot onto a different cwd must not leave an old guest link/password
  // pointed at whatever the slot becomes next
  const oldShare = shares.find((x) => x.slot === s.id);
  if (oldShare) closeShareClients(s, oldShare.id, 4000, "session ended");
  shares = shares.filter((x) => x.slot !== s.id);
  await rm(historyPath(s.id), { force: true });
  recents = [cwd, ...recents.filter((r) => r !== cwd)].slice(0, MAX_RECENTS);
  saveState();
  await ensureSlot(s);
}

// a task's `sent` state is only meaningful while ITS lane lives in that slot. On any
// teardown/recycle the link must be resolved, or the task re-runs after a restart
// (duplicate work) or silently attaches to whatever lane occupies the slot next.
// Landing marks the task done BEFORE killSlot runs, so this only catches real aborts.
function detachSlotTasks(slotId: number, note: string): void {
  for (const t of tasks) {
    if (t.slot === slotId && t.status === "sent") {
      t.status = "pending"; // back to owner review, NOT auto-queued — the abort was deliberate
      t.note = note;
      t.slot = null;
    }
  }
}

async function killSlot(s: Slot): Promise<void> {
  s.cwd = null; // clear first so the self-heal loop can't resurrect it mid-kill
  s.label = null;
  summaryCache.delete(s.id); // a recycled slot must never show the previous session's summary
  s.worktree = null; // the worktree itself stays on disk — land removes it, kill never does
  detachSlotTasks(s.id, "lane closed before landing — review and requeue if still wanted");
  saveState();
  for (const sh of shares) if (sh.slot === s.id) closeShareClients(s, sh.id);
  shares = shares.filter((x) => x.slot !== s.id); // a share must not outlive its session
  autos = autos.filter((x) => x.slot !== s.id); // neither must a scheduled prompt
  saveState();
  await tmux("kill-session", "-t", sess(s.id));
  await rm(streamPath(s.id), { force: true });
  await rm(historyPath(s.id), { force: true });
  s.history = [];
  s.offset = 0;
  s.lastOutput = 0;
  s.quietUntil = 0;
  s.cols = 200;
  s.rows = 50;
  s.sessionId = null;
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

// --- scheduled prompts ---
// a dead claude leaves its pane at a plain shell (`claude; exec $SHELL`) — an unattended
// prompt typed THERE would execute as shell commands. Only send when a `claude` child
// still hangs under the pane process. (pane_current_command is useless here: it reports
// the wrapper zsh even while claude runs.) Gate applies only when FLEET_CMD runs claude;
// custom commands are intentionally whatever the operator chose.
async function claudeAlive(slotId: number): Promise<boolean> {
  if (!/^claude(\s|$)/.test(BASE_CMD)) return true;
  return claudeAliveAt(sess(slotId));
}

// same check for an arbitrary tmux target (the summarizer's own session).
// The pane process ITSELF can be claude (a single trailing command makes sh exec
// it — unlike slotCmd's `; exec $SHELL`, which keeps claude a child), so check both.
async function claudeAliveAt(target: string): Promise<boolean> {
  const p = await tmux("display-message", "-p", "-t", target, "#{pane_pid}");
  const panePid = Number(p.out);
  if (!panePid) return false;
  const self = Bun.spawn(["ps", "-o", "comm=", "-p", String(panePid)], { stdout: "pipe" });
  const selfComm = (await new Response(self.stdout).text()).trim();
  await self.exited;
  if ((selfComm.split("/").pop() ?? "").startsWith("claude")) return true;
  const pg = Bun.spawn(["pgrep", "-P", String(panePid)], { stdout: "pipe" });
  const kids = (await new Response(pg.stdout).text()).split("\n").filter(Boolean);
  await pg.exited;
  for (const pid of kids) {
    const c = Bun.spawn(["ps", "-o", "comm=", "-p", pid], { stdout: "pipe" });
    const comm = (await new Response(c.stdout).text()).trim();
    await c.exited;
    if ((comm.split("/").pop() ?? "").startsWith("claude")) return true;
  }
  return false;
}

function advanceAuto(a: Auto, now: number): void {
  if (a.everySec) {
    a.runsLeft--;
    a.nextAt = now + a.everySec * 1000;
    if (a.runsLeft <= 0) a.enabled = false;
  } else {
    a.enabled = false;
  }
}

let autoTickBusy = false;
async function tickAutos(): Promise<void> {
  if (autoTickBusy) return; // a slow tick (tmux calls) must not overlap the next one
  autoTickBusy = true;
  try {
    const now = Date.now();
    let dirty = false;
    for (const a of autos) {
      if (!a.enabled || now < a.nextAt) continue;
      const s = slotFrom(a.slot);
      if (!s?.cwd) {
        a.enabled = false;
        a.lastResult = "skipped — session gone";
        dirty = true;
        continue;
      }
      if (!(await claudeAlive(a.slot))) {
        // NEVER type into a bare shell; count the run and move on
        a.lastResult = "skipped — claude not running in pane";
        advanceAuto(a, now);
        dirty = true;
        continue;
      }
      const idleOk = a.idleSec === 0 || now - s.lastOutput >= a.idleSec * 1000;
      if (!idleOk) {
        if (now < a.nextAt + AUTO_GRACE_MS) continue; // wait within grace, no state change
        a.lastResult = "skipped — session stayed busy";
        advanceAuto(a, now);
        dirty = true;
        continue;
      }
      dirty = true;
      await sendText(s, a.text, true);
      s.history = [...s.history, { text: a.text, ts: now }].slice(-MAX_HISTORY);
      saveHistory(s);
      logPrompt(s, a.text, "auto", now);
      a.lastRun = now;
      a.lastResult = "sent";
      advanceAuto(a, now);
      console.log(`auto ${a.id}: sent to slot ${a.slot}`);
    }
    if (dirty) saveState();
  } finally {
    autoTickBusy = false;
  }
}

// idle-lane dispatcher: when ON and a lane budget is free, pull the oldest queued task,
// spawn a fresh worktree lane from DISPATCH_REPO, and send the task text into it once
// claude is actually up. Serial by design — one lane per tick — so a burst of intake email
// can never fan out into a machine full of unattended sessions.
let dispatchBusy = false;
async function tickDispatch(): Promise<void> {
  if (dispatchBusy || !dispatchOn || !DISPATCH_REPO) return;
  dispatchBusy = true;
  try {
    const lanes = slots.filter((s) => s.worktree).length;
    if (lanes >= DISPATCH_MAX_LANES) return;
    const free = slots.find((s) => !s.cwd);
    if (!free) return;
    const next = tasks.find((t) => t.status === "queued");
    if (!next) return;
    try {
      const wt = await createWorktree(DISPATCH_REPO, "");
      await openSlot(free, wt.path);
      free.worktree = { repo: wt.repo, branch: wt.branch };
      free.label = `⎇ ${next.from ?? "task"} ${wt.branch.replace(/^fleet\//, "")}`.slice(0, MAX_LABEL);
      next.status = "sent";
      next.slot = free.id;
      next.note = `lane ${wt.branch}`;
      saveState();
      // let claude finish booting in the fresh pane before the first prompt lands; the
      // next tickAutos-style gate isn't reused here because a brand-new lane is idle by
      // definition, but claude's own startup needs a moment
      await Bun.sleep(4000);
      // the owner may have killed/re-opened this slot during the sleep — re-verify it is
      // still OUR lane before injecting external text, or we'd prompt an unrelated session
      if (free.cwd !== wt.path || free.worktree?.branch !== wt.branch || next.slot !== free.id) {
        next.status = "queued";
        next.note = "slot changed during spawn — requeued";
        saveState();
        return;
      }
      await sendText(free, next.text, true);
      logPrompt(free, next.text, "auto", Date.now());
      console.log(`dispatch: task ${next.id} → slot ${free.id} (${wt.branch})`);
    } catch (e) {
      // spawning failed — mark the task so the owner sees why instead of it silently vanishing
      next.status = "queued";
      next.note = `dispatch failed: ${e instanceof Error ? e.message : e}`.slice(0, 200);
      saveState();
    }
  } finally {
    dispatchBusy = false;
  }
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
  // .git can be a dir (normal repo) or a file (worktree) — either marks a repo for the picker
  return { path: dir, parent: parent === dir ? null : parent, dirs, recents, common, git: existsSync(`${dir}/.git`) };
}

// --- transcript view: read claude's own JSONL (~/.claude/projects/<cwd-slug>/<uuid>.jsonl)
// and hand the client structured messages instead of terminal bytes. Renders natively at
// any width — this is the per-device-formatting answer the pty can never give.
function transcriptFile(s: Slot): string | null {
  const dir = projDir(s.cwd!);
  if (s.sessionId) {
    const pinned = `${dir}/${s.sessionId}.jsonl`;
    if (existsSync(pinned)) return pinned;
  }
  // adopted or pre-session-pinning slot: newest transcript in this cwd's project dir.
  // Can pick the wrong one when several claudes run in the same cwd — pinned ids fix
  // that for every pane created from now on.
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"))
      .map((f) => ({ f, m: statSync(`${dir}/${f}`).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    return files[0] ? `${dir}/${files[0].f}` : null;
  } catch {
    return null;
  }
}

interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[] }

const trim = (t: string, max: number) => (t.length > max ? t.slice(0, max) + ` … [+${t.length - max} chars]` : t);

// tool_result content is a string or a list of {type:"text"} blocks — flatten either
function resultText(c: unknown): string {
  if (typeof c === "string") return c;
  if (Array.isArray(c))
    return c.map((b: unknown) => {
      const blk = b as { type?: unknown; text?: unknown };
      return blk.type === "text" && typeof blk.text === "string" ? blk.text : "";
    }).join("\n");
  return "";
}

function viewEntry(raw: unknown, n: number): TEntry | null {
  const d = raw as {
    type?: unknown; isMeta?: unknown; isSidechain?: unknown; timestamp?: unknown;
    message?: { content?: unknown };
  };
  if (d.type !== "user" && d.type !== "assistant") return null;
  if (d.isMeta === true || d.isSidechain === true) return null;
  const ts = typeof d.timestamp === "string" ? d.timestamp : null;
  const content = d.message?.content;
  const blocks: TBlock[] = [];
  if (d.type === "user") {
    if (typeof content === "string") {
      if (content.startsWith("<system-reminder")) return null; // harness noise, not the user
      blocks.push({ t: "text", text: trim(content, 20_000) });
    } else if (Array.isArray(content)) {
      for (const b of content) {
        const blk = b as { type?: unknown; content?: unknown; text?: unknown };
        if (blk.type === "tool_result") blocks.push({ t: "tool_result", text: trim(resultText(blk.content), 3000) });
        else if (blk.type === "text" && typeof blk.text === "string" && !blk.text.startsWith("<system-reminder"))
          blocks.push({ t: "text", text: trim(blk.text, 20_000) });
      }
      // a pure tool_result entry renders as part of the assistant's turn, not a user bubble
      if (blocks.length && blocks.every((x) => x.t === "tool_result"))
        return { n, role: "assistant", ts, blocks };
    }
  } else if (Array.isArray(content)) {
    for (const b of content) {
      const blk = b as { type?: unknown; text?: unknown; thinking?: unknown; name?: unknown; input?: unknown };
      if (blk.type === "text" && typeof blk.text === "string") blocks.push({ t: "text", text: trim(blk.text, 40_000) });
      else if (blk.type === "thinking" && typeof blk.thinking === "string" && blk.thinking)
        blocks.push({ t: "thinking", text: trim(blk.thinking, 10_000) });
      else if (blk.type === "tool_use")
        blocks.push({ t: "tool", name: typeof blk.name === "string" ? blk.name : "tool", text: trim(JSON.stringify(blk.input ?? {}), 600) });
    }
  }
  if (!blocks.length) return null;
  return { n, role: d.type, ts, blocks };
}

// --- BACKLOG #14 Phase 2: the ephemeral summarizer agent. Runs an INTERACTIVE
// claude in a throwaway tmux session (cwd = the slot's checkout, so CLAUDE.md and
// repo context ride along) — NOT `claude -p`: print mode bills the Anthropic API
// per token (its envelope reports total_cost_usd), while an interactive session
// stays inside the subscription. Never one of the 16 slots; click-only (POST),
// cached on the exact git state; GET returns the cache without ever spawning.
// Evidence only by prompt contract — no land/merge verdicts. The answer is read
// from the transcript JSONL, never scraped from the TUI.
// FLEET_SUMMARY_CMD (tests only) switches to a plain subprocess stand-in.
const SUMMARY_CMD = process.env.FLEET_SUMMARY_CMD ?? null;
const SUMMARY_MODEL = process.env.FLEET_SUMMARY_MODEL ?? "claude-sonnet-5";
const SUMMARY_TIMEOUT_MS = 180_000;
interface SummaryResult {
  summary: string; openThreads: string[]; verification: string;
  model: string; at: number; head: string | null; dirty: number; raw: boolean;
}
const summaryCache = new Map<number, { key: string; result: SummaryResult }>();
const summaryInflight = new Map<number, Promise<SummaryResult>>();

// last N transcript entries flattened to plain text — same file + parser the
// transcript view uses, so the agent reads exactly what the owner would see
function transcriptTail(s: Slot, maxEntries: number): string {
  const file = transcriptFile(s);
  if (!file) return "";
  try {
    const lines = readFileSync(file, "utf8").split("\n").filter(Boolean).slice(-300);
    const entries: TEntry[] = [];
    for (const [i, line] of lines.entries()) {
      try {
        const e = viewEntry(JSON.parse(line), i);
        if (e) entries.push(e);
      } catch {
        // partial mid-append line — skip
      }
    }
    return entries.slice(-maxEntries).map((e) =>
      e.blocks.map((b) =>
        `[${e.role}${b.t === "text" ? "" : `/${b.t}${b.name ? `:${b.name}` : ""}`}] ${b.text}`,
      ).join("\n"),
    ).join("\n");
  } catch {
    return "";
  }
}

// test hook: FLEET_SUMMARY_CMD points at a stand-in answering in a {"result": …}
// envelope on stdout — lets e2e exercise gather→deliver→parse→cache without claude
async function summaryViaSubprocess(cmd: string, prompt: string, cwd: string): Promise<string> {
  const p = Bun.spawn([cmd, "--model", SUMMARY_MODEL], { cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  p.stdin.write(prompt);
  await p.stdin.end();
  const killer = setTimeout(() => p.kill(), SUMMARY_TIMEOUT_MS);
  const out = await new Response(p.stdout).text();
  const err = await new Response(p.stderr).text();
  const code = await p.exited;
  clearTimeout(killer);
  if (code !== 0) throw new Error(`summarizer exited ${code}: ${(err || out).slice(0, 300)}`);
  return out.trim();
}

// production path: throwaway INTERACTIVE claude in its own tmux session on the
// server socket — runs on the subscription, not the metered API. Session id is
// pinned (same trick as slotCmd) so the transcript path is known; the answer is
// read from that JSONL with the transcript view's own parser.
async function summaryViaSession(prompt: string, cwd: string): Promise<string> {
  const sid = crypto.randomUUID();
  const name = `sum-${sid.slice(0, 8)}`;
  const started = Date.now();
  const sp = await tmux("new-session", "-d", "-s", name, "-c", cwd, "-x", "200", "-y", "50",
    `${PATH_EXPORT}claude --session-id ${sid} --model ${SUMMARY_MODEL}`);
  if (sp.code !== 0) throw new Error("summarizer session failed to start");
  const file = `${projDir(cwd)}/${sid}.jsonl`;
  try {
    // the transcript file only appears AFTER the first prompt — readiness is
    // "a claude child process hangs under the pane" (same check as the auto gate),
    // plus a short settle so the TUI actually accepts input
    while (!(await claudeAliveAt(name))) {
      if (Date.now() - started > 30_000) throw new Error("summarizer session never initialized");
      await Bun.sleep(500);
    }
    await Bun.sleep(2500);
    // deliver exactly like sendText: paste-buffer (no key interpretation), then Enter
    const buf = `sumbuf-${name}`;
    const lb = Bun.spawn(["tmux", "-L", SOCK, "load-buffer", "-b", buf, "-"], { stdin: "pipe" });
    lb.stdin.write(prompt);
    await lb.stdin.end();
    await lb.exited;
    await tmux("paste-buffer", "-p", "-d", "-b", buf, "-t", name);
    await Bun.sleep(400);
    await tmux("send-keys", "-t", name, "Enter");
    // poll the transcript for the newest assistant text block; done as soon as it
    // carries the JSON contract (a non-conforming answer degrades to raw upstream)
    let lastText = "";
    while (Date.now() - started < SUMMARY_TIMEOUT_MS) {
      await Bun.sleep(2000);
      let lines: string[];
      try {
        lines = readFileSync(file, "utf8").split("\n").filter(Boolean);
      } catch {
        continue;
      }
      for (const [i, line] of lines.entries()) {
        try {
          const e = viewEntry(JSON.parse(line), i);
          if (e?.role !== "assistant") continue;
          for (const b of e.blocks) if (b.t === "text" && b.text.trim()) lastText = b.text.trim();
        } catch { /* partial mid-append line */ }
      }
      if (lastText.includes('"summary"')) return lastText;
    }
    if (lastText) return lastText;
    throw new Error("summarizer timed out without an answer");
  } finally {
    await tmux("kill-session", "-t", name); // never leave an unattended claude behind
  }
}

async function runSummary(s: Slot, head: string | null, dirty: number): Promise<SummaryResult> {
  const cwd = s.cwd!;
  const lg = await git(cwd, "log", "--no-color", "--oneline", "-15");
  const d = await git(cwd, "diff", "HEAD", "--no-color");
  const prompt = [
    "You are a read-only reviewer summarizing the state of a coding session for its owner.",
    "Below: recent commits, the uncommitted diff, and the tail of the session transcript.",
    "Do NOT use any tools — answer directly from the input, in one single message.",
    'Respond with STRICT JSON only, no markdown fences, exactly this shape:',
    '{"summary": "...", "openThreads": ["..."], "verification": "..."}',
    "- summary: 2-3 sentences on what was actually done.",
    "- openThreads: things started or mentioned but not finished (empty array if none).",
    '- verification: which checks/tests/builds ran and their results, or "none seen".',
    "Evidence only — never advise whether to commit, merge or land.",
    "", "## commits", lg.code === 0 && lg.out ? lg.out : "(none)",
    "", "## uncommitted diff", (d.code === 0 ? d.out.slice(0, 60_000) : "") || "(clean)",
    "", "## transcript tail", transcriptTail(s, 30).slice(-40_000) || "(no transcript)",
  ].join("\n");
  let text = SUMMARY_CMD
    ? await summaryViaSubprocess(SUMMARY_CMD, prompt, cwd)
    : await summaryViaSession(prompt, cwd);
  // the test stand-in answers in a {"result": "..."} envelope — unwrap it; the
  // contract JSON itself has no string `result`, so this is a no-op for real runs
  try {
    const env = JSON.parse(text) as { result?: unknown };
    if (typeof env.result === "string") text = env.result.trim();
  } catch { /* not an envelope — treat as the answer itself */ }
  const body = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  let summary = body, openThreads: string[] = [], verification = "", raw = true;
  try {
    const j = JSON.parse(body) as { summary?: unknown; openThreads?: unknown; verification?: unknown };
    if (typeof j.summary === "string") { summary = j.summary; raw = false; }
    if (Array.isArray(j.openThreads)) openThreads = j.openThreads.filter((x): x is string => typeof x === "string");
    if (typeof j.verification === "string") verification = j.verification;
  } catch { /* keep raw text as the summary */ }
  return {
    summary: summary.slice(0, 4000), openThreads: openThreads.slice(0, 12),
    verification: verification.slice(0, 1000), model: SUMMARY_MODEL, at: Date.now(), head, dirty, raw,
  };
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

function secretEq(a: string, b: string): boolean {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}
let TOKEN = "";
const tokenOk = (t: string | null): boolean => !!t && secretEq(t, TOKEN);
// throttled wrapper for the two request paths that check a caller-supplied token: a flat
// per-attempt cost, same precedent as share auth (failStrike below), but deliberately no
// escalating lockout here — the owner token is the ONLY credential this app has, so a
// count-based lockout would let a remote guesser lock the real owner out of their own
// dashboard, which is worse than unlimited-but-throttled guessing against 192 bits of entropy
async function tokenGate(t: string | null): Promise<boolean> {
  if (tokenOk(t)) return true;
  await Bun.sleep(400);
  return false;
}

// --- share auth: per-share cookie, brute-force throttled (public-facing) ---
const shareBy = (id: string) => shares.find((x) => x.id === id) ?? null;
function shareAuthed(req: Request, sh: Share): boolean {
  const cookie = req.headers.get("cookie");
  const m = cookie ? new RegExp(`(?:^|;\\s*)share_${sh.id}=([^;]+)`).exec(cookie) : null;
  return !!m && secretEq(m[1], sh.secret);
}
const authFails = new Map<string, { count: number; resetAt: number }>();
function failStrike(id: string): boolean {
  const now = Date.now();
  const f = authFails.get(id);
  if (!f || now > f.resetAt) {
    authFails.set(id, { count: 1, resetAt: now + 3600_000 });
    return false;
  }
  f.count++;
  return f.count > 50; // locked for the rest of the hour
}
function closeShareClients(s: Slot, shareId: string, code = 4001, reason = "share revoked"): void {
  for (const ws of s.clients) if (ws.data.share === shareId) ws.close(code, reason);
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
  "/share.js": { path: `${import.meta.dir}/public/share.js`, type: "text/javascript" },
  "/xterm.css": { path: `${import.meta.dir}/node_modules/@xterm/xterm/css/xterm.css`, type: "text/css" },
  "/manifest.webmanifest": { path: `${import.meta.dir}/public/manifest.webmanifest`, type: "application/manifest+json" },
  "/icon.svg": { path: `${import.meta.dir}/public/icon.svg`, type: "image/svg+xml" },
  "/icon-180.png": { path: `${import.meta.dir}/public/icon-180.png`, type: "image/png" },
};

function bundleV(): number {
  try {
    return Math.trunc(statSync(`${import.meta.dir}/public/app.js`).mtimeMs);
  } catch {
    return 0;
  }
}

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

// public feature-request dropbox. Gated by its own secret; strict caps; hard hourly rate
// limit. The result is always a `pending` task the owner must review before anything runs.
async function handleIntake(req: Request): Promise<Response> {
  if (!INTAKE_SECRET) return json({ error: "intake disabled" }, 404);
  const given = req.headers.get("x-intake-secret") ?? "";
  const a = Buffer.from(given), b = Buffer.from(INTAKE_SECRET);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return json({ error: "unauthorized" }, 401);
  const now = Date.now();
  while (intakeStrikes.length && now - intakeStrikes[0] > 3_600_000) intakeStrikes.shift();
  if (intakeStrikes.length >= 30) return json({ error: "rate limited" }, 429);
  const body = await readJson(req);
  if (!body || typeof body.text !== "string") return json({ error: "expected { text }" }, 400);
  const text = body.text.slice(0, MAX_TASK_TEXT).trim();
  if (!text) return json({ error: "empty text" }, 400);
  intakeStrikes.push(now);
  const from = typeof body.from === "string" ? body.from.slice(0, 120) : null;
  const t: Task = {
    id: randomBytes(4).toString("hex"), text, source: "intake", from,
    status: "pending", created: now, slot: null, note: null,
  };
  tasks = capTasks([...tasks, t]);
  saveState();
  console.log(`intake: task from ${from ?? "unknown"} (${text.length} chars)`);
  return json({ ok: true });
}

// --- startup: restore persisted state, adopt stray fleet sessions, seed offsets ---
mkdirSync(STREAM_DIR, { recursive: true });
chmodSync(STREAM_DIR, 0o700);
await tmux("start-server");
if (existsSync(STATE_FILE)) {
  try {
    const persisted = (await Bun.file(STATE_FILE).json()) as {
      token?: unknown; slots?: Record<string, { cwd?: unknown; label?: unknown }>; recents?: unknown; shares?: unknown;
    };
    if (typeof persisted.token === "string") persistedToken = persisted.token;
    if (Array.isArray((persisted as { autos?: unknown }).autos))
      autos = ((persisted as { autos: unknown[] }).autos).filter((x): x is Auto =>
        typeof x === "object" && x !== null
        && typeof (x as Auto).id === "string" && typeof (x as Auto).slot === "number"
        && typeof (x as Auto).text === "string" && typeof (x as Auto).nextAt === "number"
        && typeof (x as Auto).runsLeft === "number" && typeof (x as Auto).enabled === "boolean");
    if (Array.isArray(persisted.shares))
      shares = persisted.shares.filter((x): x is Share =>
        typeof x === "object" && x !== null
        && typeof (x as Share).id === "string" && typeof (x as Share).secret === "string"
        && typeof (x as Share).slot === "number"
        && ((x as Share).mode === "view" || (x as Share).mode === "interact"));
    if (Array.isArray(persisted.recents)) recents = persisted.recents.filter((r): r is string => typeof r === "string");
    if (Array.isArray((persisted as { tasks?: unknown }).tasks))
      tasks = ((persisted as { tasks: unknown[] }).tasks).filter((x): x is Task =>
        typeof x === "object" && x !== null
        && typeof (x as Task).id === "string" && typeof (x as Task).text === "string"
        && ((x as Task).source === "owner" || (x as Task).source === "intake")
        && ["pending", "queued", "sent", "done"].includes((x as Task).status));
      tasks = capTasks(tasks);
    for (const [k, v] of Object.entries(persisted.slots ?? {})) {
      const s = slotFrom(k);
      if (s && typeof v?.cwd === "string") {
        s.cwd = v.cwd;
        if (typeof v.label === "string") s.label = v.label;
        if (typeof (v as { sessionId?: unknown }).sessionId === "string") s.sessionId = (v as { sessionId: string }).sessionId;
        const wt = (v as { worktree?: unknown }).worktree;
        if (typeof wt === "object" && wt !== null
          && typeof (wt as { repo?: unknown }).repo === "string" && typeof (wt as { branch?: unknown }).branch === "string")
          s.worktree = { repo: (wt as { repo: string }).repo, branch: (wt as { branch: string }).branch };
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
// a share whose session didn't survive the downtime must not come back — same for schedules
shares = shares.filter((sh) => slotFrom(sh.slot)?.cwd);
autos = autos.filter((a) => slotFrom(a.slot)?.cwd);
// a task dispatched just before shutdown is persisted as `sent` pointing at a slot; if that
// slot didn't come back as a live lane (worktree removed out-of-band, pane gone), requeue it
// instead of leaving it "sent" forever with nothing running
for (const t of tasks) {
  if (t.status === "sent" && !(t.slot != null && slotFrom(t.slot)?.worktree)) {
    t.status = "queued";
    t.note = "requeued after restart";
    t.slot = null;
  }
}
saveState();
for (const s of slots) {
  if (!s.cwd) continue;
  await ensureSlot(s);
  s.offset = existsSync(streamPath(s.id)) ? (await stat(streamPath(s.id))).size : 0;
  if (existsSync(historyPath(s.id))) {
    try {
      const h: unknown = await Bun.file(historyPath(s.id)).json();
      if (Array.isArray(h))
        s.history = h.filter((e): e is { text: string; ts: number } =>
          typeof e === "object" && e !== null && typeof (e as { text?: unknown }).text === "string"
          && typeof (e as { ts?: unknown }).ts === "number").slice(-MAX_HISTORY);
    } catch {
      console.log(`slot ${s.id}: history file unreadable — starting empty`);
    }
  }
}

setInterval(() => void poll(), 100);
setInterval(() => void tickAutos().catch(() => {}), 5000);
setInterval(() => void tickGit().catch(() => {}), 10_000);
void tickGit().catch(() => {}); // warm the badge cache so the first paint isn't blank
setInterval(() => void tickDispatch().catch(() => {}), 8000);
// self-heal: recreate any activated slot whose pane died (crash, accidental kill-session).
// ensureSlot is a cheap no-op (two tmux queries) per healthy slot
setInterval(() => {
  for (const s of slots) void ensureSlot(s).catch(() => {});
}, 2000);

Bun.serve<WSData>({
  hostname: HOST,
  port: PORT,
  // Bun's default is 10s per request — the ✨ summary POST legitimately holds the
  // connection while its background claude session thinks (up to SUMMARY_TIMEOUT_MS)
  idleTimeout: 240,
  async fetch(req, server) {
    const blocked = guard(req);
    if (blocked) return blocked;
    const url = new URL(req.url);

    // /intake is a feature-request dropbox behind its own secret (never the owner token).
    // Handled before the share-host gate so it works on BOTH the owner host and the public
    // tunnel. It only ever creates a `pending` task — nothing here runs code or reaches a
    // session. (Host already validated against ALLOWED_HOSTS in guard() above.)
    if (url.pathname === "/intake" && req.method === "POST") return handleIntake(req);

    // the public tunnel hostname is share-only: nothing else exists there, not even
    // the owner login page. (Host was already validated against ALLOWED_HOSTS above.)
    if (SHARE_HOSTS.has(req.headers.get("host") ?? "")) {
      // the bare domain gets a deliberate landing page instead of a 404
      if (url.pathname === "/" && req.method === "GET")
        return new Response(Bun.file(`${import.meta.dir}/public/landing.html`), {
          headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
        });
      const pub = ["/share.js", "/xterm.css", "/icon.svg", "/icon-180.png", "/favicon.ico"].includes(url.pathname)
        || /^\/(s\/[a-z0-9]+(\/(auth|info|send))?|ws-share\/[a-z0-9]+)$/.test(url.pathname);
      if (!pub) return new Response("not found", { status: 404 });
    }

    // login: /?token=… sets the cookie and redirects to a clean URL
    if (url.pathname === "/" && url.searchParams.has("token")) {
      if (!(await tokenGate(url.searchParams.get("token")))) return json({ error: "bad token" }, 401);
      return new Response(null, {
        status: 302,
        headers: {
          location: "/",
          "set-cookie": `fleet=${TOKEN}; Path=/; SameSite=Strict; HttpOnly; Max-Age=31536000`,
        },
      });
    }
    if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });

    // --- share routes: per-share cookie auth, never the owner token ---
    if (/^\/s\/[a-z0-9]+$/.test(url.pathname) && req.method === "GET") {
      // always serve the page — unauthenticated it renders the password gate
      return new Response(Bun.file(`${import.meta.dir}/public/share.html`), {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const shareApi = /^\/s\/([a-z0-9]+)\/(auth|info|send)$/.exec(url.pathname);
    if (shareApi) {
      const sh = shareBy(shareApi[1]);
      if (!sh) return json({ error: "unknown or revoked share" }, 404);
      const s = slots[sh.slot - 1];
      if (shareApi[2] === "auth" && req.method === "POST") {
        if (authFails.get(sh.id) && authFails.get(sh.id)!.count > 50 && Date.now() < authFails.get(sh.id)!.resetAt)
          return json({ error: "too many attempts — try again later" }, 429);
        const body = await readJson(req);
        if (!body || typeof body.password !== "string") return json({ error: "expected password" }, 400);
        if (!secretEq(body.password, sh.secret)) {
          const locked = failStrike(sh.id);
          await Bun.sleep(400); // flat cost per wrong guess
          return json({ error: locked ? "too many attempts — try again later" : "wrong password" }, locked ? 429 : 401);
        }
        authFails.delete(sh.id);
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            // Lax (not Strict): the guest lands here from a cross-site click on the link
            "set-cookie": `share_${sh.id}=${sh.secret}; Path=/; SameSite=Lax; HttpOnly; Max-Age=604800`,
          },
        });
      }
      if (!shareAuthed(req, sh)) return json({ error: "unauthorized" }, 401);
      if (shareApi[2] === "info") {
        return json({
          slotLabel: s.cwd ? (s.label ?? s.cwd.split("/").pop()) : null,
          mode: sh.mode,
          cols: s.cols,
          rows: s.rows,
          active: !!s.cwd,
        });
      }
      if (shareApi[2] === "send" && req.method === "POST") {
        if (sh.mode !== "interact") return json({ error: "view-only share" }, 403);
        if (!s.cwd) return json({ error: "session gone" }, 404);
        const body = await readJson(req);
        if (!body || typeof body.text !== "string" || body.text.length > 100_000) return json({ error: "bad text" }, 400);
        await sendText(s, body.text, body.submit !== false);
        const ts = Date.now();
        s.history = [...s.history, { text: body.text, ts }].slice(-MAX_HISTORY);
        saveHistory(s);
        logPrompt(s, body.text, "share", ts);
        return json({ ok: true });
      }
      return json({ error: "bad request" }, 400);
    }
    const wsShare = /^\/ws-share\/([a-z0-9]+)$/.exec(url.pathname);
    if (wsShare) {
      const sh = shareBy(wsShare[1]);
      if (!sh || !shareAuthed(req, sh)) return json({ error: "unauthorized" }, 401);
      const s = slots[sh.slot - 1];
      if (!s.cwd) return json({ error: "session gone" }, 404);
      // guests never pass cols/rows: they must not resize the owner's pty, so they
      // take the plain replay-tail path and render at the session's current size
      if (server.upgrade(req, { data: { slot: s.id, queue: [], ready: false, cols: 0, rows: 0, force: false, share: sh.id, mode: sh.mode } }))
        return;
      return new Response("upgrade failed", { status: 400 });
    }

    const st = STATIC[url.pathname];
    if (st)
      return new Response(Bun.file(st.path), {
        headers: { "content-type": st.type, "cache-control": "no-store" },
      });

    // everything below carries authority — token required
    if (!(await tokenGate(tokenFrom(req)))) return json({ error: "unauthorized" }, 401);

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
        shareBase: SHARE_URL,
        // bundle version: a long-lived tab compares this across polls and reloads itself
        // once it goes stale — "old client after a deploy" must not look like a regression
        v: bundleV(),
        autos,
        tasks,
        dispatch: { available: !!DISPATCH_REPO, on: dispatchOn, maxLanes: DISPATCH_MAX_LANES, repo: DISPATCH_REPO },
        intake: !!INTAKE_SECRET,
        slots: slots.map((s) => {
          const sh = shares.find((x) => x.slot === s.id);
          return {
            id: s.id, cwd: s.cwd, label: s.label, lastOutput: s.lastOutput,
            git: gitInfo.get(s.id) ?? null, worktree: s.worktree,
            share: sh ? {
              id: sh.id, mode: sh.mode, password: sh.secret, created: sh.created,
              guests: [...s.clients].filter((c) => c.data.share === sh.id).length,
            } : null,
          };
        }),
      });
    }
    // print/PDF export: full scrollback as a self-contained light-theme page — plain
    // capture (no -e) because tmux's escape-preserving output encodes styling as
    // absolute-column cursor jumps that any SGR→HTML converter would misplace, and
    // a white page prints better than terminal colors anyway. ?format=txt downloads raw.
    const exportMatch = /^\/api\/slots\/(\d+)\/export$/.exec(url.pathname);
    if (req.method === "GET" && exportMatch) {
      const s = slotFrom(exportMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const cap = await tmux("capture-pane", "-t", sess(s.id), "-p", "-S", "-");
      if (cap.code !== 0) return json({ error: "capture failed — session gone?" }, 500);
      const name = s.label ?? s.cwd.split("/").pop() ?? s.cwd;
      if (url.searchParams.get("format") === "txt")
        return new Response(cap.out + "\n", {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "content-disposition": `attachment; filename="fleet-s${s.id}-${new Date().toISOString().slice(0, 10)}.txt"`,
          },
        });
      const esc = (t: string) => t.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(name)} — Claude Fleet export</title>
<style>
  body { margin: 0; background: #fff; color: #1a1a1a;
    font: 12px/1.45 ui-monospace, Menlo, Consolas, monospace; }
  header { padding: 18px 24px 12px; border-bottom: 1px solid #ddd; }
  h1 { margin: 0 0 4px; font-size: 15px; }
  .meta { color: #666; font-size: 11px; }
  pre { margin: 0; padding: 14px 24px 30px; white-space: pre-wrap; word-break: break-word; }
  @media print { header { border-bottom-color: #999; } @page { margin: 14mm; } }
</style></head><body>
<header><h1>${esc(name)}</h1>
<div class="meta">slot ${s.id} · ${esc(s.cwd)} · exported ${new Date().toLocaleString()}</div></header>
<pre>${esc(cap.out)}</pre>
</body></html>`;
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    const trMatch = /^\/api\/slots\/(\d+)\/transcript$/.exec(url.pathname);
    if (req.method === "GET" && trMatch) {
      const s = slotFrom(trMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const file = transcriptFile(s);
      if (!file) return json({ entries: [], total: 0, source: null });
      const lines = (await Bun.file(file).text()).split("\n").filter((l) => l.trim() !== "");
      // `after` = line count the client has already consumed — filtering happens on OUR
      // side of that cut, so entry numbering must be absolute line numbers
      const after = Math.max(0, Number(url.searchParams.get("after") ?? 0) | 0);
      const entries: TEntry[] = [];
      for (let i = after; i < lines.length; i++) {
        try {
          const e = viewEntry(JSON.parse(lines[i]), i + 1);
          if (e) entries.push(e);
        } catch {
          // only the FINAL line may be a partial mid-append (cap total so the next poll
          // re-reads it once complete) — an unparseable line mid-file is just skipped,
          // otherwise it would pin total forever and loop the client on the same range
          if (i === lines.length - 1) return json({ entries, total: i, source: file.split("/").pop() });
        }
      }
      return json({ entries, total: lines.length, source: file.split("/").pop() });
    }
    const histMatch = /^\/api\/slots\/(\d+)\/history$/.exec(url.pathname);
    if (req.method === "GET" && histMatch) {
      const s = slotFrom(histMatch[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      return json({ history: s.history });
    }
    // lane review: what did the agent actually DO — tracked diff vs HEAD + untracked list.
    // Complements the transcript view (what it said). Byte-capped: a phone shouldn't
    // receive a megabyte lockfile diff.
    const diffMatch = /^\/api\/slots\/(\d+)\/diff$/.exec(url.pathname);
    if (req.method === "GET" && diffMatch) {
      const s = slotFrom(diffMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const st = await git(s.cwd, "status", "--porcelain");
      if (st.code !== 0) return json({ error: "not a git repository" }, 400);
      const DIFF_CAP = 400_000;
      const d = await git(s.cwd, "diff", "HEAD", "--no-color");
      const diff = d.code === 0 ? d.out : ""; // e.g. repo with no commits yet
      // read the branch fresh, not from the 10s badge cache — a just-created lane isn't cached yet
      const br = await git(s.cwd, "rev-parse", "--abbrev-ref", "HEAD");
      return json({
        branch: br.code === 0 ? br.out : null,
        worktree: s.worktree,
        status: st.out.split("\n").filter(Boolean).slice(0, 500),
        diff: diff.length > DIFF_CAP ? `${diff.slice(0, DIFF_CAP)}\n… truncated` : diff,
        truncated: diff.length > DIFF_CAP,
      });
    }
    // lane brief: the deterministic layer of the session overview — recent commits,
    // changed files, uncommitted summary. Everything here is fresh git output computed
    // per request (never cached), so the sideboard can't drift from reality.
    const briefMatch = /^\/api\/slots\/(\d+)\/brief$/.exec(url.pathname);
    if (req.method === "GET" && briefMatch) {
      const s = slotFrom(briefMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const st = await git(s.cwd, "status", "--porcelain");
      if (st.code !== 0) return json({ error: "not a git repository" }, 400);
      const br = await git(s.cwd, "rev-parse", "--abbrev-ref", "HEAD");
      const lg = await git(s.cwd, "log", "--no-color", "--format=%h%x09%ct%x09%s", "-15");
      const sh = await git(s.cwd, "diff", "HEAD", "--shortstat", "--no-color");
      const commits = lg.code === 0
        ? lg.out.split("\n").filter(Boolean).map((l) => {
            const [hash, ct, ...rest] = l.split("\t");
            return { hash, ts: Number(ct) * 1000, subject: rest.join("\t") };
          })
        : [];
      return json({
        branch: br.code === 0 ? br.out : null,
        worktree: s.worktree,
        files: st.out.split("\n").filter(Boolean).slice(0, 200),
        shortstat: sh.code === 0 ? sh.out : "",
        commits,
      });
    }
    // session summary (the ✨ agent). GET = cache lookup only, never spawns.
    // POST = run the agent (single-flight per slot; concurrent clicks share one run).
    const sumMatch = /^\/api\/slots\/(\d+)\/summary$/.exec(url.pathname);
    if (sumMatch && (req.method === "GET" || req.method === "POST")) {
      const s = slotFrom(sumMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const st = await git(s.cwd, "status", "--porcelain");
      if (st.code !== 0) return json({ error: "not a git repository" }, 400);
      const hd = await git(s.cwd, "rev-parse", "HEAD");
      const head = hd.code === 0 ? hd.out : null;
      const dirty = st.out.split("\n").filter(Boolean).length;
      const key = `${head}:${Bun.hash(st.out)}`;
      const cached = summaryCache.get(s.id);
      if (cached?.key === key) return json({ ...cached.result, cached: true, stale: false });
      if (req.method === "GET")
        return json(cached ? { ...cached.result, cached: true, stale: true } : { cached: false });
      let run = summaryInflight.get(s.id);
      if (!run) {
        run = runSummary(s, head, dirty).finally(() => summaryInflight.delete(s.id));
        summaryInflight.set(s.id, run);
      }
      try {
        const result = await run;
        summaryCache.set(s.id, { key, result });
        return json({ ...result, cached: false, stale: false });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "summarizer failed" }, 500);
      }
    }
    if (url.pathname === "/api/dirs") {
      try {
        return json(await listDirs(url.searchParams.get("path") ?? "~"));
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "bad path" }, 400);
      }
    }
    // --- task queue (owner side). Tasks arrive here (owner-created) or via /intake
    // (pending). Only the owner moves a task to `queued`; only then can the dispatcher run it.
    if (url.pathname === "/api/tasks" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.text !== "string" || !body.text.trim()) return json({ error: "bad text" }, 400);
      const t: Task = {
        id: randomBytes(4).toString("hex"), text: body.text.slice(0, MAX_TASK_TEXT).trim(),
        source: "owner", from: null,
        status: body.queue === true ? "queued" : "pending", created: Date.now(), slot: null, note: null,
      };
      tasks = capTasks([...tasks, t]);
      saveState();
      return json({ ok: true, task: t });
    }
    const taskAct = /^\/api\/tasks\/([a-z0-9]+)\/(queue|unqueue|done|delete)$/.exec(url.pathname);
    if (req.method === "POST" && taskAct) {
      const t = tasks.find((x) => x.id === taskAct[1]);
      if (!t) return json({ error: "unknown task" }, 404);
      if (taskAct[2] === "delete") tasks = tasks.filter((x) => x.id !== t.id);
      else if (taskAct[2] === "queue") { t.status = "queued"; t.note = null; }
      else if (taskAct[2] === "unqueue") t.status = "pending";
      else t.status = "done";
      saveState();
      return json({ ok: true });
    }
    if (url.pathname === "/api/dispatch" && req.method === "POST") {
      const body = await readJson(req);
      if (!DISPATCH_REPO) return json({ error: "dispatcher unavailable — set FLEET_DISPATCH_REPO" }, 400);
      dispatchOn = body?.on === true;
      return json({ ok: true, on: dispatchOn });
    }
    const autoCreate = /^\/api\/slots\/(\d+)\/autos$/.exec(url.pathname);
    if (req.method === "POST" && autoCreate) {
      const s = slotFrom(autoCreate[1]);
      if (!s?.cwd) return json({ error: "slot not active" }, 400);
      if (autos.filter((a) => a.slot === s.id && a.enabled).length >= AUTO_MAX_PER_SLOT)
        return json({ error: `max ${AUTO_MAX_PER_SLOT} active schedules per slot` }, 400);
      const body = await readJson(req);
      if (!body || typeof body.text !== "string" || !body.text.trim() || body.text.length > 10_000)
        return json({ error: "bad text" }, 400);
      const inSec = Number(body.inSec ?? 0) | 0;
      const everySec = body.everySec == null ? null : Number(body.everySec) | 0;
      if (everySec !== null && everySec < AUTO_MIN_EVERY_SEC)
        return json({ error: `everySec must be ≥ ${AUTO_MIN_EVERY_SEC}` }, 400);
      if (everySec === null && inSec < 1) return json({ error: "one-shot needs inSec ≥ 1" }, 400);
      const runs = everySec === null ? 1 : Number(body.runs ?? 0) | 0;
      if (everySec !== null && (runs < 1 || runs > AUTO_MAX_RUNS))
        return json({ error: `runs must be 1–${AUTO_MAX_RUNS}` }, 400); // the cap is mandatory, not optional
      const idleSec = Math.min(86_400, Math.max(0, Number(body.idleSec ?? 60) | 0));
      const a: Auto = {
        id: randomBytes(4).toString("hex"),
        slot: s.id,
        text: body.text,
        everySec,
        nextAt: Date.now() + (inSec > 0 ? inSec : everySec ?? 0) * 1000,
        runsLeft: runs,
        idleSec,
        enabled: true,
        created: Date.now(),
        lastRun: 0,
        lastResult: null,
      };
      autos = [...autos, a];
      saveState();
      return json({ ok: true, auto: a });
    }
    const autoAct = /^\/api\/autos\/([a-z0-9]+)\/(delete|toggle)$/.exec(url.pathname);
    if (req.method === "POST" && autoAct) {
      const a = autos.find((x) => x.id === autoAct[1]);
      if (!a) return json({ error: "unknown schedule" }, 404);
      if (autoAct[2] === "delete") {
        autos = autos.filter((x) => x.id !== a.id);
      } else {
        a.enabled = !a.enabled && a.runsLeft > 0;
        if (a.enabled && a.nextAt < Date.now()) a.nextAt = Date.now() + (a.everySec ?? 60) * 1000;
      }
      saveState();
      return json({ ok: true });
    }
    const slotMatch = /^\/api\/slots\/(\d+)\/(open|open-worktree|kill|rename|share|unshare|share-mode|land)$/.exec(url.pathname);
    if (req.method === "POST" && slotMatch) {
      const s = slotFrom(slotMatch[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      if (slotMatch[2] === "share") {
        if (!s.cwd) return json({ error: "slot not active" }, 400);
        const body = await readJson(req);
        if (!body) return json({ error: "expected application/json" }, 400);
        const mode = body.mode === "interact" ? "interact" : "view";
        const secret = typeof body.password === "string" && body.password !== ""
          ? body.password
          : randomBytes(9).toString("base64url");
        if (secret.length < 8 || secret.length > 64)
          return json({ error: "password must be 8–64 chars" }, 400);
        const old = shares.find((x) => x.slot === s.id);
        if (old) closeShareClients(s, old.id); // replaced share = new secret/mode, old guests out
        const sh: Share = { id: randomBytes(4).toString("hex"), slot: s.id, secret, mode, created: Date.now() };
        shares = [...shares.filter((x) => x.slot !== s.id), sh];
        saveState();
        return json({ ok: true, id: sh.id, path: `/s/${sh.id}`, password: secret, mode });
      }
      if (slotMatch[2] === "share-mode") {
        // flip an existing share between view/interact WITHOUT rotating link+password.
        // The WS message handler reads the share's CURRENT mode, so interact→view cuts
        // off guest typing instantly; sockets are closed with 4002 so the guest page
        // reloads into the right UI (compose bar shown/hidden per mode at page load).
        const sh = shares.find((x) => x.slot === s.id);
        if (!sh) return json({ error: "slot not shared" }, 404);
        const body = await readJson(req);
        const mode = body?.mode;
        if (mode !== "view" && mode !== "interact") return json({ error: "mode must be view or interact" }, 400);
        if (mode !== sh.mode) {
          sh.mode = mode;
          closeShareClients(s, sh.id, 4002, "share mode changed");
          saveState();
        }
        return json({ ok: true, mode: sh.mode });
      }
      if (slotMatch[2] === "unshare") {
        const sh = shares.find((x) => x.slot === s.id);
        if (sh) closeShareClients(s, sh.id);
        shares = shares.filter((x) => x.slot !== s.id);
        saveState();
        return json({ ok: true });
      }
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
        void tickGit().catch(() => {}); // refresh the badge now, not on the next 10s tick
        return json({ ok: true, cwd: s.cwd });
      }
      if (slotMatch[2] === "open-worktree") {
        const body = await readJson(req);
        if (!body || typeof body.repo !== "string") return json({ error: "expected { repo }" }, 400);
        if (s.cwd) return json({ error: "slot already active — use a free slot" }, 400);
        try {
          const wt = await createWorktree(body.repo, typeof body.branch === "string" ? body.branch : "");
          await openSlot(s, wt.path);
          s.worktree = { repo: wt.repo, branch: wt.branch };
          s.label = wt.branch.replace(/^fleet\//, "⎇ "); // lane identity beats the dir-slug basename
          saveState();
          void tickGit().catch(() => {}); // badge should appear on the next sessions poll
          return json({ ok: true, cwd: s.cwd, branch: wt.branch });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "worktree failed" }, 400);
        }
      }
      if (slotMatch[2] === "land") {
        // deterministic lane teardown: git's OWN dirty/unmerged checks are the safety net —
        // `worktree remove` without --force refuses when the tree is dirty, and we
        // additionally refuse while commits are unpushed, so "land" can never eat work.
        if (!s.cwd || !s.worktree) return json({ error: "not a fleet-created worktree lane" }, 400);
        const { repo, branch } = s.worktree;
        const path = s.cwd;
        const st = await git(path, "status", "--porcelain");
        if (st.code !== 0) return json({ error: "git status failed — worktree gone?" }, 400);
        if (st.out) return json({ error: `worktree has uncommitted changes:\n${st.out.slice(0, 400)}` }, 409);
        // "safe to drop" = the commits ahead of main are preserved somewhere: pushed to a
        // push/upstream ref, OR present on ANY remote (covers `push` without `-u`), OR merged
        // into the repo's main HEAD. Otherwise refuse — landing would lose unpushed work.
        const unpushed = await git(path, "log", "--oneline", "@{push}..", "--");
        if (unpushed.code === 0) {
          if (unpushed.out) return json({ error: `unpushed commits:\n${unpushed.out.slice(0, 400)}` }, 409);
        } else {
          const onRemote = await git(path, "branch", "-r", "--contains", "HEAD");
          const merged = await git(repo, "branch", "--merged", "HEAD", "--list", branch);
          if (!onRemote.out.trim() && !merged.out.trim())
            return json({ error: "branch is not pushed to any remote and not merged — push or merge it first" }, 409);
        }
        // remove the worktree FIRST, while the slot is still intact: a failed remove (locked,
        // submodule, races dirty) then leaves the lane fully recoverable via ⏏ instead of a
        // torn-down slot pointing at an orphaned tree. `worktree remove` re-checks dirtiness
        // itself, so the small window since the status check above stays safe.
        const rmv = await git(repo, "worktree", "remove", path);
        if (rmv.code !== 0) return json({ error: `worktree remove failed (lane kept): ${(rmv.err || rmv.out).slice(0, 300)}` }, 409);
        // landing completes the lane's task — mark it BEFORE killSlot so detachSlotTasks
        // (which handles aborts) sees nothing left to detach
        for (const t of tasks) {
          if (t.slot === s.id && t.status === "sent") {
            t.status = "done";
            t.note = `landed (${branch})`;
          }
        }
        await killSlot(s);
        void tickGit().catch(() => {});
        return json({ ok: true, removed: path, branch });
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
      const ts = Date.now();
      s.history = [...s.history, { text: body.text, ts }].slice(-MAX_HISTORY);
      saveHistory(s);
      logPrompt(s, body.text, "owner", ts);
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
      // view-mode guests are strictly read-only — their input is dropped server-side,
      // and a revoked share's socket must go silent even before close() lands.
      // Mode is looked up LIVE (not from ws.data): an owner flipping interact→view
      // must silence already-connected guests, not just future ones
      if (ws.data.share && shareBy(ws.data.share)?.mode !== "interact") return;
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

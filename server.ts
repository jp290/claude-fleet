import { stat, rm, readdir, appendFile } from "node:fs/promises";
import { existsSync, statSync, mkdirSync, chmodSync, readdirSync, readFileSync, openSync, readSync, closeSync, renameSync, copyFileSync, symlinkSync, rmSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes, timingSafeEqual, createHash } from "node:crypto";
import type { ServerWebSocket } from "bun";
import { buildMergePrompt, buildRepairPrompt, buildCleanReviewPrompt } from "./merge-prompt";
import { laneDoneLooking, laneQuietSince, DONE_LOOKING_PROSE } from "./lane-signals";
import { buildEnhancePrompt, type EnhanceFacts } from "./enhance-prompt";

// Defaults to localhost — nothing is network-reachable until you explicitly set FLEET_HOST
// (e.g. your Tailscale IP via `tailscale ip -4`). Even then, every request needs the access
// token (printed on boot), because a reachable fleet is remote code execution as your user.
const HOST = process.env.FLEET_HOST ?? "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
// separate tmux socket per instance — lets a test instance (FLEET_SOCK=fleettest)
// run its own s1..sN sessions without touching the live fleet's
const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
const MAX_SLOTS = 16; // fixed places — the sidebar always shows all of them
const REPLAY_TAIL = 2_000_000;
// lines of scrollback to re-seed from a fresh capture-pane when a client's width
// doesn't match the pane's current width (tmux reflows history on resize-window,
// so this replays correctly-wrapped text instead of the raw stream's stale wrapping)
const SEED_LINES = 3000;
const MAX_RECENTS = 8;
const MAX_PINS = 20;
const STREAM_DIR = `${import.meta.dir}/streams`;
const STATE_FILE = `${import.meta.dir}/fleet.json`;
const AUDIT_FILE = `${import.meta.dir}/audit.jsonl`;
const STEWARD_JOURNAL_FILE = `${import.meta.dir}/steward-journal.jsonl`;
// per-lane attributed-outcome trail — one server-stamped fact per lane terminal event (see
// buildLaneOutcome). Rotated by appendEvent at AUDIT_ROTATE_BYTES, same as AUDIT_FILE.
const LANE_OUTCOME_FILE = `${import.meta.dir}/lane-outcomes.jsonl`;
// the owner disposition rail — one append-only label per advisory output the owner ruled on
// (see the DISPOSITION region below). Same appendEvent discipline/rotation as the two above.
const DISPOSITION_FILE = `${import.meta.dir}/dispositions.jsonl`;
// the post-land audit trail (verification tier 2) — one row per full-suite run against the
// integration branch after a land. Same appendEvent discipline/rotation as the trails above.
const POSTLAND_AUDIT_FILE = `${import.meta.dir}/post-land-audits.jsonl`;
// one rotation generation (audit.jsonl -> audit.jsonl.1, oldest overwritten) — override for tests
const AUDIT_ROTATE_BYTES = Number(process.env.FLEET_AUDIT_ROTATE_BYTES ?? 5_000_000) | 0;
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
// model names are validated at SET time (MODEL_RE, the open/lane routes) — this string is
// baked into a shell line, so nothing unvalidated may ever reach it
function slotCmd(sessionId: string | null, resume: boolean, model: string | null = null): string {
  const claude = /^claude(\s|$)/.test(BASE_CMD);
  let cmd = sessionId && claude
    ? `${BASE_CMD} ${resume ? "--resume" : "--session-id"} ${sessionId}`
    : BASE_CMD;
  // pin the fleet's base model whenever the slot has none of its own — otherwise claude
  // inherits the owner's ambient /model default (how a lane once span up on the wrong model).
  // single-quoted: the 1M context variants are spelled `claude-opus-5[1m]`, and tmux runs this
  // string through default-shell — /bin/zsh here, which ABORTS on an unmatched glob ("no matches
  // found"), so an unquoted [1m] would kill every new pane at spawn. MODEL_RE forbids `'`, so a
  // plain single-quote wrap is closed, not merely escaped.
  if (claude) cmd += ` --model '${model ?? DEFAULT_MODEL}'`;
  return `${PATH_EXPORT}${cmd}; exec ${SHELL}`;
}
// per-slot model (synergy-findings Tier-2): strict charset because the value lands in a
// tmux shell command — never widen without revisiting slotCmd
// the optional bracket suffix is the context-window variant (`claude-opus-5[1m]`) and is the ONLY
// reason a shell metacharacter may appear here — it is anchored to the end, bounded, and alnum-only,
// and every shell interpolation of a model string is single-quoted (slotCmd, summaryViaSession).
const MODEL_RE = /^[A-Za-z0-9._-]{1,64}(?:\[[A-Za-z0-9]{1,8}\])?$/;
// the fleet's base model for interactive/lane sessions that don't pin their own. Absent this,
// slotCmd omits --model and claude falls back to the owner's ambient /model default. FLEET_MODEL
// overrides, but is charset-validated first — this value is baked into a tmux shell line, so an
// unvalidated env var would be an injection vector (same rule as per-slot model). The digest/
// summary worker keeps its own cheaper SUMMARY_MODEL — this is only the interactive tier.
const DEFAULT_MODEL =
  process.env.FLEET_MODEL && MODEL_RE.test(process.env.FLEET_MODEL) ? process.env.FLEET_MODEL : "claude-opus-5[1m]";
function modelOf(body: Record<string, unknown> | null): { ok: true; model: string | null } | { ok: false } {
  const m = body?.model;
  if (m === undefined || m === null || m === "") return { ok: true, model: null };
  if (typeof m === "string" && MODEL_RE.test(m)) return { ok: true, model: m };
  return { ok: false };
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

// a guest comment on a share — allowed in BOTH modes (it types nothing into the pty).
// Freeform name is display-only, never trusted; keyed by share id so revoking the share
// drops its thread (pruned in saveState).
interface ShareComment { id: string; ts: number; name: string; text: string; from?: "owner" }
const MAX_COMMENT_TEXT = 2000;
const MAX_COMMENT_NAME = 40;
const MAX_COMMENTS_PER_SHARE = 300;

// a scheduled prompt: one-shot (everySec null) or recurring with a MANDATORY runs cap.
// Guard rails are the point — see tickAutos() for the idle gate and the claude-alive gate.
interface Auto {
  id: string;
  slot: number;
  text: string;
  everySec: number | null;
  nextAt: number;
  runsLeft: number;
  perpetual?: boolean; // owner-only: a recurring auto that re-arms instead of expiring at the runs cap
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
  source: "owner" | "intake" | "steward";
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
  worktree: { repo: string; branch: string; base?: string; baseSha?: string } | null; // set when Fleet created this slot's
  // cwd as a git worktree ("lane") — land/cleanup only ever touches tagged slots. `base` is a
  // branch NAME (it must track the tip); `baseSha` is the immutable fork COMMIT captured at
  // create/attach time — optional, because lanes forked before it existed have none.
  model: string | null; // per-slot claude model (--model at spawn); null = FLEET_CMD default
  selfToken: string; // scoped credential for POST /api/self/autos — NEVER the owner token.
  // Minted fresh in openSlot every time the slot is (re)activated, so a recycled slot can't
  // be self-scheduled against by a session that was talking to whatever used to live here.
  offset: number;
  lastOutput: number;
  quietUntil: number; // resize/repaint make the TUI redraw — don't count that as activity
  cols: number; // last tmux window size we applied — lets a same-size reconnect skip reseeding
  rows: number;
  sessionId: string | null; // claude session uuid we pinned at pane creation; null for
  // adopted/pre-existing sessions (transcript lookup then falls back to newest-by-mtime)
  history: { text: string; ts: number }[]; // the durable "what did I prompt" record,
  // newest last: composed sends, plus terminal-typed prompts harvested from the
  // transcript (tickHarvest) — raw keystrokes themselves are deliberately not captured
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
  model: null,
  selfToken: randomBytes(16).toString("hex"),
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
let pins: string[] = []; // owner-pinned project roots, surfaced first in the picker (persisted like recents)
// repo root → the branch lanes integrate into (rebase onto + land into). Unset for a repo
// means "derive from the primary checkout's HEAD" — the legacy assumption that the primary
// sits on the integration branch. Setting it lets the owner park the primary on a working
// branch (e.g. `desk`) while lanes still land onto `main` without touching that dirty tree.
let repoBases: Record<string, string> = {};
let shares: Share[] = [];
let shareComments: Record<string, ShareComment[]> = {};
let autos: Auto[] = [];
let tasks: Task[] = [];
// worktree path -> shelve note ("what's left"), set when a lane is shelved. killSlot keeps the
// worktree on disk as any kill does; this note is what makes "set aside for later" a real state
// instead of a bare, context-less orphan. Survives the slot; cleared on resume/remove/discard.
// Deliberately NOT a LaneRecord — just the one field the feature needs.
let shelved: Record<string, { at: number; note: string }> = {};
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
let autosOn = true; // global kill-switch for scheduled autos (the heartbeat surface); owner-toggled, default on
let quietHours: { start: number; end: number } | null = null; // owner-set local-hour window muting the recurring/heartbeat surface (no 3am nudges)
// public intake shares its own secret, NEVER the owner token. Empty = intake disabled.
const INTAKE_SECRET = process.env.FLEET_INTAKE_SECRET ?? "";
const intakeStrikes: number[] = []; // timestamps, for a simple hourly rate limit
const AUTO_MIN_EVERY_SEC = 10;
const AUTO_MAX_RUNS = 100;
const AUTO_MAX_PER_SLOT = 5;
const AUTO_KEEP_DONE = 5; // completed one-shots kept per slot before the oldest are pruned
const AUTO_GRACE_MS = 600_000; // how long past due the idle gate may defer before skipping
const GIT_TIMEOUT_MS = Number(process.env.FLEET_GIT_TIMEOUT_MS) || 30_000;
const MERGE_IDLE_MS = 3000; // don't start a rebase while the pane is actively producing output
let persistedToken: string | null = null;
// --- steward principal: a scoped token bound to whichever slot currently carries the
// recognized steward label (docs/steward.md, "⚙ steward"), not to a fixed slot id — the
// steward's worktree can be closed/reopened and the token must keep meaning "whoever is
// the steward right now". Same shape as FLEET_SELF_TOKEN (token -> principal -> bound
// slot), generalized one step further (automation-synergies.md finding 6): the self-token
// route is left untouched below, this is a NEW second instance of the same shape, not a
// rewire of the first. Persisted like the owner token so it survives restarts; minted once.
const STEWARD_LABEL = "⚙ steward";
let stewardToken: string | null = null;
const STEWARD_SENDS_PER_HOUR = Math.max(1, Number(process.env.FLEET_STEWARD_SENDS_PER_HOUR ?? 10) | 0);
// max OPEN steward-filed pending tasks — a looping pulse must not flood the review buffer
const STEWARD_MAX_PENDING = Math.max(1, Number(process.env.FLEET_STEWARD_MAX_PENDING ?? 10) | 0);
// joint 5's 10-minute effect window (steward-autonomy.md) doubles as the v1 episode
// boundary: with no sensor loop yet to detect when an intervention actually helped, an
// "episode" for cap purposes is simply kind×slot within this window of the last send —
// a fresh window after it elapses is treated as a new episode. This is a deliberate
// simplification, not the full joint-5 semantics (real outcome-based episode closure
// needs the journal/effect-sensing this doc's own build order defers).
const STEWARD_EPISODE_MS = 10 * 60 * 1000;
// --- intervention-outcome measurement (steward-autonomy.md §5 / steward-intelligence.md §4):
// the FUEL the autonomy ladder promotes on. Every steward send parks a pending-outcome
// baseline; a window-close pass in tickGit classifies it DETERMINISTICALLY (git delta /
// sustained output / claudeAlive) and increments a durable per-class tally. The window is
// overridable so e2e can shrink it. SUSTAIN is the "output began inside the window and
// sustained ≥60s" bar (steward-autonomy §5), measured as recency-at-close on the scalar
// lastOutput (still emitting within SUSTAIN of the window-close read → sustained; a lone early
// blip is stale by close). Overridable (FLEET_OUTCOME_SUSTAIN_MS) so e2e can exercise the
// positive output path; left at 60s in prod so a real work-pause never reads as help.
const OUTCOME_WINDOW_MS = Number(process.env.FLEET_OUTCOME_WINDOW_MS ?? 10 * 60 * 1000) | 0;
const OUTCOME_SUSTAIN_MS = Number(process.env.FLEET_OUTCOME_SUSTAIN_MS ?? 60_000) | 0;
// the harm attest is a STALENESS-GATED timestamp, not a forever latch: a class is only
// promotion-eligible while the owner's last harm-channel engagement is within this window
// (steward-intelligence §4 — a harm-blind record must never license autonomy, and "the owner
// once clicked attest months ago" is harm-blind again). No `| 0`: windows >~24d overflow int32.
const HARM_ATTEST_TTL_MS = Number(process.env.FLEET_HARM_ATTEST_TTL_MS ?? 14 * 24 * 60 * 60 * 1000);
// promotion criterion N (steward-intelligence §4: "N interventions of a class with a clean
// helped/no-harm record"). The ladder wiring itself is future — only the fuel + predicate ship.
const PROMOTION_MIN_N = Math.max(1, Number(process.env.FLEET_PROMOTION_MIN_N ?? 5) | 0);
// cap counters are NOT kept in memory: they're derived by re-reading audit.jsonl's
// steward_send events on every send. Audit.jsonl is already the durable, chmod-600,
// rotated append log (appendEvent above) — a separate in-memory counter would just be a
// second, restart-fragile copy of the same fact. Cost is one file read per send; sends are
// capped at STEWARD_SENDS_PER_HOUR, so this is deliberately cheap enough not to matter.
// The caps are a safety invariant (synergy-findings.md Tier-0 #3): appendEvent rotates
// AUDIT_FILE to .1 at AUDIT_ROTATE_BYTES, so this must span both generations — the same
// two-file read readStewardJournal does — or the counters reset toward zero right after
// a rotation. Bounded: exactly two files, each capped at the rotation threshold.
async function stewardRecentSends(): Promise<{ ts: number; kind: string; ref: string; slot: number }[]> {
  const out: { ts: number; kind: string; ref: string; slot: number }[] = [];
  for (const f of [`${AUDIT_FILE}.1`, AUDIT_FILE]) {
    if (!existsSync(f)) continue;
    for (const line of (await Bun.file(f).text()).split("\n")) {
      if (!line) continue;
      try {
        const e = JSON.parse(line) as { event?: unknown; ts?: unknown; slot?: unknown; detail?: unknown };
        if (e.event === "steward_send" && typeof e.ts === "number" && typeof e.slot === "number"
          && typeof e.detail === "string") {
          const [kind, ref] = e.detail.split(":");
          out.push({ ts: e.ts, kind: kind ?? "", ref: ref ?? "", slot: e.slot });
        }
      } catch {
        // a torn mid-append line — skip, same stance as every other audit/prompt-log reader
      }
    }
  }
  return out;
}
function stewardSlot(): Slot | null {
  return slots.find((x) => x.cwd && x.label === STEWARD_LABEL) ?? null;
}
// public base URL for share links shown in the owner UI (e.g. https://cowork.example.com);
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
// composed sends land in the transcript too — remember them briefly so the transcript
// harvester (tickHarvest) doesn't double-log them as "terminal" prompts
const recentComposed = new Map<number, { text: string; ts: number }[]>();
const COMPOSED_TTL = 300_000;
function noteComposed(slotId: number, text: string): void {
  const list = (recentComposed.get(slotId) ?? []).filter((e) => Date.now() - e.ts < COMPOSED_TTL);
  list.push({ text: text.trim().slice(0, 5000), ts: Date.now() });
  recentComposed.set(slotId, list);
}
function logPrompt(s: Slot, text: string, source: "owner" | "share" | "auto" | "terminal" | "steward", ts: number): void {
  if (source !== "terminal") noteComposed(s.id, text);
  const line = `${JSON.stringify({ ts, slot: s.id, cwd: s.cwd, label: s.label, source, text })}\n`;
  promptLogChain = promptLogChain
    .then(() => appendFile(PROMPT_LOG, line, { mode: 0o600 }))
    .then(() => chmodSync(PROMPT_LOG, 0o600)) // prompts can carry secrets, like the stream
    .catch((e: unknown) => console.log(`prompt log failed: ${e instanceof Error ? e.message : e}`));
}

// --- audit log: append-only, own write chain + mode 600 (same discipline as saveHistory/
// saveState above), deliberately NOT routed through console.log — watchdog.sh redirects
// stdout to server.log at the shell's default umask, so anything security-sensitive needs
// its own explicit chmod. One compact line per event, never free prose: guest passwords
// (including failed attempts), share secrets, the owner token, and prompt text must NEVER
// appear here — only lengths/references, same rule PROMPT_LOG follows for prompt content.
// Fire-and-forget like its neighbors: a wedged disk must never block the request path.
type AuditEvent =
  | "slot_open" | "slot_kill"
  | "share_create" | "share_revoke" | "share_mode_change"
  | "share_auth_ok" | "share_auth_fail" | "share_auth_lock"
  | "guest_ws_connect" | "guest_ws_disconnect"
  | "auto_fire" | "auto_skip"
  | "owner_auth_fail"
  | "self_heal_recreate"
  | "steward_send" | "steward_send_capped"
  | "steward_journal" | "steward_task" | "steward_propose_outcome"
  | "slot_shelve"
  | "repo_undo_land"
  | "land_note_fail"
  | "postland_audit"
  | "autos_switch"
  | "autos_quiet";
// generic append-only event-log chain: format (one JSON line), chmod 600, single-generation
// rotation. audit.jsonl is the first consumer but not the only shape this fits (automation-
// synergies.md finding 5 — journal/outcome logs later reuse this exact discipline instead of
// re-deriving it). One write chain + one failure flag shared across every file that goes
// through here: today that's just AUDIT_FILE, so serializing unrelated files on one chain
// costs nothing yet — split per-file if a second consumer's volume ever makes that a problem.
let auditChain: Promise<unknown> = Promise.resolve();
let auditWriteFailed = false; // report a wedged event log once, not on every subsequent event
function appendEvent(file: string, obj: Record<string, unknown>): void {
  const line = `${JSON.stringify(obj)}\n`;
  auditChain = auditChain
    .then(async () => {
      if (existsSync(file) && statSync(file).size >= AUDIT_ROTATE_BYTES)
        renameSync(file, `${file}.1`);
      await appendFile(file, line, { mode: 0o600 });
      chmodSync(file, 0o600); // append doesn't guarantee mode on a pre-existing file
    })
    .catch((e: unknown) => {
      if (auditWriteFailed) return;
      auditWriteFailed = true;
      console.log(`event log write failed, further failures suppressed: ${e instanceof Error ? e.message : e}`);
    });
}
function audit(event: AuditEvent, slot?: number, detail?: string): void {
  appendEvent(AUDIT_FILE, {
    ts: Date.now(), event,
    ...(slot !== undefined ? { slot } : {}),
    ...(detail !== undefined ? { detail } : {}),
  });
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
    worktree: { repo: string; branch: string; base?: string; baseSha?: string } | null; model: string | null; selfToken: string }> = {};
  for (const s of slots) if (s.cwd) active[s.id] = { cwd: s.cwd, label: s.label, sessionId: s.sessionId, worktree: s.worktree, model: s.model, selfToken: s.selfToken };
  // comments must not outlive their share — every share-removal path funnels through here
  for (const k of Object.keys(shareComments)) if (!shares.some((sh) => sh.id === k)) delete shareComments[k];
  const body = JSON.stringify({ token: persistedToken, stewardToken, slots: active, recents, pins, shares, autos, tasks,
    comments: shareComments, dispatch: dispatchOn, autosOn, quietHours, merges: Object.fromEntries(mergeLast),
    repoBases, shelved, undoLands: Object.fromEntries(undoLast),
    outcomePending, outcomeTally, harmCandidates, harmAttestAt }, null, 2);
  // tmp + rename, never truncate-in-place: a crash mid-write must leave the OLD state
  // intact, not a torn file that boot reads as "empty" and then re-persists as the
  // new truth (which would eat every share, task, lane tag and session pin at once)
  const tmp = `${STATE_FILE}.tmp`;
  saveChain = saveChain
    .then(() => Bun.write(tmp, body))
    .then(() => chmodSync(tmp, 0o600))
    .then(() => renameSync(tmp, STATE_FILE))
    .catch((e: unknown) => console.log(`state save failed: ${e instanceof Error ? e.message : e}`));
}

// --- git: lane (worktree) support. All git runs through the array-form spawn — nothing
// user-controlled ever reaches a shell string ---
async function git(dir: string, ...args: string[]): Promise<{ out: string; err: string; code: number }> {
  const p = Bun.spawn(["git", "-C", dir, ...args], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => { try { p.kill(); } catch {} }, GIT_TIMEOUT_MS);
  try {
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    const code = await p.exited;
    return { out: out.trim(), err: err.trim(), code };
  } finally {
    clearTimeout(timer);
  }
}
// git status --porcelain, columns PRESERVED. The trim in git() strips the leading space of
// the first entry (an unstaged " M path" becomes "M path"), which silently corrupts the
// status-code column and truncates the first filename. Every column-accurate status parse
// (uncommitted-files display, diff status list) must read through here, never git().out.
async function statusLines(cwd: string): Promise<{ code: number; lines: string[] }> {
  const p = Bun.spawn(["git", "-C", cwd, "status", "--porcelain"], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => { try { p.kill(); } catch {} }, GIT_TIMEOUT_MS);
  try {
    const out = await new Response(p.stdout).text();
    const code = await p.exited;
    return { code, lines: out.split("\n").filter((l) => l.length > 0) };
  } finally {
    clearTimeout(timer);
  }
}
// a mutating git op (add/commit) in a lane races the live session's OWN git — if it holds
// .git/index.lock we back off and retry rather than fail. Initial attempt + up to 5 retries.
async function gitRetry(dir: string, ...args: string[]): Promise<{ out: string; err: string; code: number }> {
  let r = await git(dir, ...args);
  for (let i = 0; i < 5 && r.code !== 0 && /index\.lock|another git process/i.test(r.err); i++) {
    await Bun.sleep(300);
    r = await git(dir, ...args);
  }
  return r;
}

// a lane whose session left a merge/rebase/cherry-pick half-done must not be committed or
// rebased by Fleet — a plain add+commit would finalize it into a bogus commit (conflict
// markers and all), and a Fleet rebase would collide with it.
async function gitOpInProgress(cwd: string): Promise<boolean> {
  const gd = await git(cwd, "rev-parse", "--absolute-git-dir");
  if (gd.code !== 0 || !gd.out) return false;
  return ["MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD", "REVERT_HEAD"]
    .some((f) => existsSync(resolve(gd.out, f)));
}

// --- session scoping: every brief/diff section describes THE SESSION's lifetime, not the
// repo's whole history (git log -15 was identical for every session in the same repo, and
// diff-vs-HEAD went blank the moment work was committed). Anchor = the first timestamp in
// the pinned transcript. Pinned sessions only — same rationale as the harvester: the mtime
// fallback can flap between files. Unpinned slots degrade to repo-scoped behavior.
// Limitation: TIME scope, not author scope — parallel sessions committing in the same cwd
// show up too; exact isolation is what lanes are for.
const startCache = new Map<number, { file: string; ts: number | null }>();
function sessionStart(s: Slot): number | null {
  if (!s.sessionId || !s.cwd) return null;
  const file = `${projDir(s.cwd)}/${s.sessionId}.jsonl`;
  const c = startCache.get(s.id);
  if (c && c.file === file) return c.ts;
  let ts: number | null = null;
  try {
    const fd = openSync(file, "r");
    const buf = Buffer.alloc(16_384);
    const n = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    for (const line of buf.toString("utf8", 0, n).split("\n")) {
      try {
        const d = JSON.parse(line) as { timestamp?: unknown };
        if (typeof d.timestamp === "string") {
          const t = Date.parse(d.timestamp);
          if (t) { ts = t; break; }
        }
      } catch { /* meta or partial line — keep looking */ }
    }
  } catch {
    return null; // transcript not created yet
  }
  startCache.set(s.id, { file, ts });
  return ts;
}
// the last commit BEFORE the session began — everything after it is the session's work
async function sessionBase(cwd: string, startTs: number): Promise<string | null> {
  const r = await git(cwd, "rev-list", "-1", `--before=${new Date(startTs).toISOString()}`, "HEAD");
  return r.code === 0 && r.out ? r.out : null;
}
async function slotBase(s: Slot): Promise<string | null> {
  const start = sessionStart(s);
  return start ? await sessionBase(s.cwd!, start) : null;
}
interface CommitRow { hash: string; ts: number; subject: string }
function parseCommitLog(out: string): CommitRow[] {
  return out.split("\n").filter(Boolean).map((l) => {
    const [hash, ct, ...rest] = l.split("\t");
    return { hash, ts: Number(ct) * 1000, subject: rest.join("\t") };
  });
}
// recent commits, session-scoped where the transcript gives a start anchor — used for
// NON-lane sessions, which have no branch boundary. (Lanes use laneCommits: a worktree
// lane has an exact base branch, so its own commits are base..HEAD, never a time window.)
async function sessionCommits(s: Slot): Promise<CommitRow[]> {
  const start = sessionStart(s);
  const lg = start
    ? await git(s.cwd!, "log", "--no-color", `--since=${new Date(start).toISOString()}`, "--format=%h%x09%ct%x09%s", "-15")
    : await git(s.cwd!, "log", "--no-color", "--format=%h%x09%ct%x09%s", "-15");
  return lg.code === 0 ? parseCommitLog(lg.out) : [];
}
// the ref a lane sits on top of: the primary checkout's current branch (e.g. "main"),
// resolved as a NAME so it tracks the tip even after the owner commits on main; falls back
// to the primary's HEAD sha if it is detached. Only meaningful for worktree lanes.
// the branch lanes integrate into (rebase onto + land into) for a repo. A configured value
// (repoBases) wins so the primary can be parked off the integration branch; otherwise fall
// back to the primary's current HEAD, which is exactly the legacy behavior. Returns null on a
// detached/unresolvable HEAD with no config (callers treat that as "can't resolve").
async function integrationBranch(repo: string): Promise<string | null> {
  const cfg = repoBases[repo];
  if (cfg) return cfg;
  const br = await git(repo, "rev-parse", "--abbrev-ref", "HEAD");
  return br.code === 0 && br.out && br.out !== "HEAD" ? br.out : null;
}
async function laneBaseRef(s: Slot): Promise<string | null> {
  if (!s.worktree) return null;
  // the base recorded when the lane was forked is authoritative — it survives the primary
  // later moving off the integration branch, which live re-derivation would not
  if (s.worktree.base) return s.worktree.base;
  const ib = await integrationBranch(s.worktree.repo);
  if (ib) return ib;
  const sha = await git(s.worktree.repo, "rev-parse", "HEAD");
  return sha.code === 0 && sha.out ? sha.out : null;
}
// the lane's fork point as an immutable COMMIT, resolved ONCE at create/attach time while the
// fork is still the fork. `base` is a branch name by design (it must track the tip), but that
// makes it useless AFTER a land: the integration branch has been advanced past the lane, so
// merge-base(base, HEAD) is HEAD itself and the lane's whole footprint computes to nothing.
// undefined when the base is unresolvable (no integration branch, a deleted/rewritten base ref,
// a tree with no commits) — callers then fall back to the name, which is all they can honestly do.
async function laneForkSha(tree: string, base: string | null): Promise<string | undefined> {
  if (!base) return undefined;
  const mb = await git(tree, "merge-base", base, "HEAD");
  return mb.code === 0 && mb.out ? mb.out : undefined;
}
// session-scoped changed-files list, porcelain-shaped ("M  path") so the client renders
// both scopes the same way; untracked files ride along from live status
function sessionFiles(nameStatusOut: string, statusOut: string): string[] {
  const files = nameStatusOut.split("\n").filter(Boolean).map((l) => {
    const [code, ...rest] = l.split("\t");
    return `${(code[0] ?? "M").padEnd(2)} ${rest[rest.length - 1] ?? ""}`;
  });
  for (const l of statusOut.split("\n")) if (l.startsWith("??")) files.push(l);
  return files.slice(0, 500);
}

// the "what changed" document, shared by the owner ± overlay and the guest changes view.
// base = session base commit → the session's cumulative work (committed + uncommitted);
// base null → plain uncommitted diff vs HEAD. Byte-capped: a phone shouldn't receive a
// megabyte lockfile diff.
const DIFF_CAP = 400_000;
async function diffPayload(cwd: string, base: string | null): Promise<{ branch: string | null; status: string[];
  diff: string; truncated: boolean; sessionScoped: boolean } | null> {
  const st = await statusLines(cwd); // column-preserving — see statusLines
  if (st.code !== 0) return null; // not a git repository
  const d = await git(cwd, "diff", base ?? "HEAD", "--no-color");
  const diff = d.code === 0 ? d.out : ""; // e.g. repo with no commits yet
  let status: string[];
  if (base) {
    const ns = await git(cwd, "diff", "--name-status", "--no-color", base);
    status = sessionFiles(ns.code === 0 ? ns.out : "", st.lines.join("\n"));
  } else {
    status = st.lines.slice(0, 500);
  }
  // read the branch fresh, not from the 10s badge cache — a just-created lane isn't cached yet
  const br = await git(cwd, "rev-parse", "--abbrev-ref", "HEAD");
  return {
    branch: br.code === 0 ? br.out : null,
    status,
    diff: diff.length > DIFF_CAP ? `${diff.slice(0, DIFF_CAP)}\n… truncated` : diff,
    truncated: diff.length > DIFF_CAP,
    sessionScoped: !!base,
  };
}

// the deterministic session overview — recent commits, changed files, uncommitted
// summary — shared by the owner sideboard and the guest info tab. Fresh git output per
// request (never cached) so neither view can drift from reality. null = not a git repo.
interface BriefPayload { branch: string | null; sessionStart: number | null;
  uncommitted: number; uncommittedFiles: string[]; files: string[]; shortstat: string;
  commits: CommitRow[]; laneScoped: boolean; laneBase: string | null;
  ahead: number; behind: number; gitOp: boolean }
async function briefPayload(s: Slot): Promise<BriefPayload | null> {
  const st = await statusLines(s.cwd!); // column-preserving — see statusLines
  if (st.code !== 0) return null;
  // an interrupted merge/rebase (e.g. a deploy that killed srv mid-land) wedges commit/land
  // until it's resolved — surface it in the brief so it's an explicit, actionable state
  // instead of a cryptic refusal the owner only meets when they next click commit/land
  const gitOp = await gitOpInProgress(s.cwd!);
  const br = await git(s.cwd!, "rev-parse", "--abbrev-ref", "HEAD");
  // the concrete uncommitted work in this worktree — staged/unstaged/untracked, porcelain
  // codes intact so the client shows exactly what git sees. Shown for lanes and non-lanes.
  const uncommittedFiles = st.lines.slice(0, 200);
  const branch = br.code === 0 ? br.out : null;

  // a worktree lane has a precise boundary — its base branch — so its commits and committed
  // footprint are base..HEAD (what the lane ADDS), never the base branch's own history.
  const laneBase = await laneBaseRef(s);
  if (s.worktree && laneBase) {
    // commits = two-dot log (reachable from HEAD, not base = the lane's own commits).
    // footprint = THREE-dot diff (base...HEAD, from the merge-base) so a lane that is
    // behind main shows only ITS OWN file changes, not main's divergent commits inverted.
    const lg = await git(s.cwd!, "log", "--no-color", `${laneBase}..HEAD`, "--format=%h%x09%ct%x09%s", "-50");
    const ns = await git(s.cwd!, "diff", "--name-status", "--no-color", `${laneBase}...HEAD`);
    const sh = await git(s.cwd!, "diff", `${laneBase}...HEAD`, "--shortstat", "--no-color");
    // ahead/behind vs the base branch, NOT vs an upstream — a lane usually has no upstream,
    // so the sessions-poll gitInfo (branch.ab, upstream-tracking) reports 0/0 for it
    const ab = await git(s.cwd!, "rev-list", "--left-right", "--count", `${laneBase}...HEAD`);
    const abm = /^(\d+)\s+(\d+)$/.exec(ab.out); // left = base-only (behind), right = HEAD-only (ahead)
    return {
      branch, sessionStart: sessionStart(s),
      uncommitted: uncommittedFiles.length, uncommittedFiles,
      files: sessionFiles(ns.code === 0 ? ns.out : "", "").slice(0, 200), // committed footprint, no untracked
      shortstat: sh.code === 0 ? sh.out : "",
      commits: lg.code === 0 ? parseCommitLog(lg.out) : [],
      laneScoped: true, laneBase,
      ahead: abm ? Number(abm[2]) : 0, behind: abm ? Number(abm[1]) : 0,
      gitOp,
    };
  }

  // non-lane session: no branch boundary → keep the transcript-time-scoped heuristic
  const start = sessionStart(s);
  const base = start ? await sessionBase(s.cwd!, start) : null;
  const sh = await git(s.cwd!, "diff", base ?? "HEAD", "--shortstat", "--no-color");
  let files: string[];
  if (base) {
    const ns = await git(s.cwd!, "diff", "--name-status", "--no-color", base);
    files = sessionFiles(ns.code === 0 ? ns.out : "", st.lines.join("\n")).slice(0, 200);
  } else {
    files = uncommittedFiles.slice(0, 200);
  }
  return {
    branch, sessionStart: start,
    uncommitted: uncommittedFiles.length, uncommittedFiles,
    files,
    shortstat: sh.code === 0 ? sh.out : "",
    commits: await sessionCommits(s),
    laneScoped: false, laneBase: null,
    ahead: 0, behind: 0, // non-lane: the client uses the upstream-based gitInfo instead
    gitOp,
  };
}

// branch/dirty/ahead-behind per active slot, refreshed on a slow tick — the sessions
// poll must never block on 16 git spawns, so it reads this cache instead
interface GitInfo { branch: string; dirty: number; ahead: number; behind: number; head: string | null }
const gitInfo = new Map<number, GitInfo | null>(); // null = cwd is not a git repo
// per-slot claude-liveness, refreshed on the same slow tick as gitInfo. This cache exists
// ONLY to give the steward's READ routes a cheap `alive` field — never call the ps/pgrep
// spawns inline on the 100ms sessions poll. The delivery/dispatch GATES (claudeAlive at the
// send/dispatch sites) must keep calling claudeAlive FRESH: a 10s-stale cache could gate a
// nudge or a bare-shell dispatch into a pane that died seconds ago.
const aliveInfo = new Map<number, boolean>();
// wedged merge/rebase per slot, same tick + same reads-only contract as aliveInfo: the
// steward overview needs it fleet-wide (the per-slot brief computes it fresh), and the
// commit/land guards keep their own fresh gitOpInProgress calls.
const gitOpInfo = new Map<number, boolean>();
let gitTickBusy = false;
async function tickGit(): Promise<void> {
  if (gitTickBusy) return;
  gitTickBusy = true;
  try {
    for (const s of slots) {
      if (!s.cwd) { gitInfo.delete(s.id); aliveInfo.delete(s.id); gitOpInfo.delete(s.id); continue; }
      // liveness is independent of git state — compute it before the git branching so a
      // non-repo cwd (st.code !== 0 below) still gets an alive reading.
      aliveInfo.set(s.id, await claudeAlive(s.id));
      gitOpInfo.set(s.id, await gitOpInProgress(s.cwd));
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
      // a lane has no upstream, so branch.ab is 0/0 — but its land-readiness is exactly
      // "commits ahead of the base branch", which the sidebar lifecycle dot needs. Compute
      // it the same way briefPayload does (rev-list vs laneBaseRef) or the green "ready"
      // state is unreachable for every lane and a landable lane reads as empty.
      if (s.worktree) {
        const base = await laneBaseRef(s);
        if (base) {
          const ab = await git(s.cwd, "rev-list", "--left-right", "--count", `${base}...HEAD`);
          const m = /^(\d+)\s+(\d+)$/.exec(ab.out); // left = base-only (behind), right = HEAD-only (ahead)
          if (m) { behind = Number(m[1]); ahead = Number(m[2]); }
        }
      }
      // the slot's HEAD sha — the substrate of the commit-cursor fact layer (lane maps,
      // sinceLastLook, sha-grounded outcome baselines). One cheap call on the existing tick.
      const hd = await git(s.cwd, "rev-parse", "HEAD");
      gitInfo.set(s.id, { branch, dirty, ahead, behind, head: hd.code === 0 && hd.out ? hd.out : null });
    }
    await measureOutcomes(); // the gitInfo/aliveInfo caches are now fresh for THIS tick — measure against them
  } finally {
    gitTickBusy = false;
  }
}

// the sha-grounded helped-git predicate (commit-cursor layer): helped = new commits exist
// since the parked baseline sha, OR the lane's commits LANDED (baseline sha became an ancestor
// of the integration branch) — landing inside the window is the STRONGEST helped signal, and
// it used to score noEffect because the ahead-count goes backward on land/teardown. Rebase
// (baseline no longer an ancestor of HEAD) → conservative noEffect, never a false helped.
// Baselines persisted by an older fleet.json carry no `head` → legacy ahead-count comparison,
// never a crash, never mismeasured as helped.
async function helpedGitSince(p: OutcomePending, gi: GitInfo | null | undefined, s: Slot | undefined): Promise<boolean> {
  const b = p.gitBaseline;
  if (!b.head) return !!gi && gi.ahead > b.ahead; // legacy (pre-sha) baseline
  // landed check first — it survives the land's teardown (the repo outlives the lane).
  // Only meaningful when the baseline sha was NOT already merged at park time.
  if (b.repo && b.merged === false) {
    const intRef = await integrationBranch(b.repo);
    if (intRef && (await git(b.repo, "merge-base", "--is-ancestor", b.head, intRef)).code === 0) return true;
  }
  // forward progress in the still-open slot; a lane baseline only measures the SAME lane —
  // a recycled slot (different branch) must never be measured as this send's effect
  if (!s?.cwd || (b.branch !== undefined && s.worktree?.branch !== b.branch)) return false;
  const anc = await git(s.cwd, "merge-base", "--is-ancestor", b.head, "HEAD");
  if (anc.code !== 0) return false; // rebase/rewritten history → conservative noEffect
  const rl = await git(s.cwd, "rev-list", "--count", `${b.head}..HEAD`);
  return rl.code === 0 && Number(rl.out) > 0;
}

// window-close classification of pending steward sends (steward-autonomy.md §5). Folded into
// tickGit so it runs AFTER the gitInfo/aliveInfo refresh above — it reads the just-updated
// caches, never a tick-stale copy. Every AUTO signal is DETERMINISTIC (git delta / sustained
// output / claudeAlive); `harmed` is NEVER set here (owner-only). A claudeAlive true→false in
// the window is a crash CANDIDATE escalated to the owner, not a harm verdict.
async function measureOutcomes(): Promise<void> {
  const now = Date.now();
  let changed = false;
  for (let i = outcomePending.length - 1; i >= 0; i--) {
    const p = outcomePending[i];
    if (now - p.sentAt < OUTCOME_WINDOW_MS) continue; // window still open — leave it
    const gi = gitInfo.get(p.slot);
    const s = slots[p.slot - 1];
    // crash CANDIDATE: aliveBaseline true, now false. Escalate — do NOT touch the harmed tally
    // (attribution is ambiguous; the owner is the harm oracle, §6). aliveInfo default true
    // matches claudeAlive's short-circuit for non-claude FLEET_CMD (no false crash there).
    const curAlive = aliveInfo.get(p.slot) ?? true;
    if (p.aliveBaseline && !curAlive) {
      harmCandidates.push({ slot: p.slot, class: p.class, ref: p.ref, at: now });
      if (harmCandidates.length > 20) harmCandidates.shift();
      writeStewardJournal({ kind: "harm_candidate", class: p.class, ref: p.ref, slot: p.slot });
    }
    // helped = the lane moved FORWARD: strictly more commits ahead of base than at baseline.
    // A dirty-count *change* is NOT progress — `git checkout .`/a stash drops dirty and would
    // otherwise score helped, and any working slot dirties its tree — so ahead-increase is the
    // only git signal (F-B.1). OR: output that BEGAN after the send (lastOutput advanced past the
    // parked outputBaseline) AND is still emitting at window close (recency ≤ SUSTAIN — a §5
    // "sustained ≥60s" proxy on the scalar lastOutput: a lone blip early in the window is stale
    // by close and filtered out). Ambiguous → no-effect (conservative, mandatory). Reply-
    // referencing is DEFERRED → `helped` under-counts (see promotionEligible).
    const helpedGit = await helpedGitSince(p, gi, s);
    const outStarted = !!s && s.lastOutput > p.outputBaseline;
    const outSustained = !!s && now - s.lastOutput <= OUTCOME_SUSTAIN_MS;
    const helpedOutput = outStarted && outSustained;
    const outcome: "helped" | "noEffect" = helpedGit || helpedOutput ? "helped" : "noEffect";
    bumpTally(p.class, outcome);
    writeStewardJournal({ kind: "outcome", class: p.class, ref: p.ref, outcome, at: now, slot: p.slot });
    outcomePending.splice(i, 1);
    changed = true;
  }
  measureControls(now);
  if (changed) saveState();
}

// A2 null-calibration: classify matured controls with the SAME helpedGit/helpedOutput logic as
// the nudged path, record helped/noEffect into the rolling ring, then re-park a fresh cohort of
// busiest un-nudged active slots. In-memory only — never persisted, never touches outcomeTally.
function measureControls(now: number): void {
  const nudged = new Set(outcomePending.map((p) => p.slot));
  for (let i = controlPending.length - 1; i >= 0; i--) {
    const c = controlPending[i];
    if (now - c.openedAt < OUTCOME_WINDOW_MS) continue; // window still open
    controlPending.splice(i, 1);
    if (nudged.has(c.slot)) continue; // got nudged mid-window → no longer a clean control, drop it
    const gi = gitInfo.get(c.slot);
    const s = slots[c.slot - 1];
    const helpedGit = !!gi && gi.ahead > c.aheadBaseline;
    const outStarted = !!s && s.lastOutput > c.outputBaseline;
    const outSustained = !!s && now - s.lastOutput <= OUTCOME_SUSTAIN_MS;
    const controlHelped = helpedGit || (outStarted && outSustained);
    baselineSamples.push(controlHelped);
    if (baselineSamples.length > BASELINE_RING_CAP) baselineSamples.shift();
    baselineSeen++;
    if (controlHelped) baselineSeenHelped++;
  }
  if (controlPending.length > 0) return; // a cohort is still maturing — don't stack
  const candidates = slots.filter((s) => s.cwd && !nudged.has(s.id))
    .sort((a, b) => b.lastOutput - a.lastOutput) // busiest first — the honest null is a working slot
    .slice(0, CONTROL_SAMPLE_MAX);
  for (const s of candidates)
    controlPending.push({ slot: s.id, openedAt: now, aheadBaseline: gitInfo.get(s.id)?.ahead ?? 0, outputBaseline: s.lastOutput });
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
  // fork the lane off the integration branch explicitly, NOT the primary's HEAD — the primary
  // may be parked on a working branch, and a lane must still branch from (and later land onto)
  // the integration branch. Unset config → integrationBranch is the primary's HEAD, so this is
  // the same start point as the bare `worktree add -b` default (no-op today).
  const start = await integrationBranch(root);
  const add = start
    ? await git(root, "worktree", "add", "-b", branch, path, start)
    : await git(root, "worktree", "add", "-b", branch, path);
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

// every open worktree of a repo, primary checkout first — `git worktree list` is the
// single source of truth, so lanes whose slot was killed (worktree still on disk,
// previously invisible anywhere in the UI) stay findable
interface WtEntry { path: string; branch: string; primary: boolean }
async function listWorktrees(root: string): Promise<WtEntry[]> {
  const ls = await git(root, "worktree", "list", "--porcelain");
  if (ls.code !== 0) return [];
  const out: WtEntry[] = [];
  let cur: { path?: string; branch?: string } = {};
  for (const line of [...ls.out.split("\n"), ""]) {
    if (line.startsWith("worktree ")) cur = { path: line.slice(9) };
    else if (line.startsWith("branch ")) cur.branch = line.slice(7).replace(/^refs\/heads\//, "");
    else if (!line.trim() && cur.path) {
      out.push({ path: cur.path, branch: cur.branch ?? "(detached)", primary: out.length === 0 });
      cur = {};
    }
  }
  return out;
}

// the real risk behind a destructive action, computed once and shared by every surface
// that needs to show it BEFORE the click (risk preview panels) and the
// one that enforces it (removeWorktreeSafe). "empty" = provably safe to drop: clean tree
// AND nothing unpushed — the destructive click becomes a no-op cleanup, not a judgment call.
interface WorktreeRisk { dirtyFiles: string[]; unpushedCommits: CommitRow[]; shortstat: string | null; empty: boolean }
async function worktreeRisk(repo: string, path: string): Promise<WorktreeRisk> {
  const st = await statusLines(path); // column-preserving — see statusLines
  const dirtyFiles = st.code === 0 ? st.lines.slice(0, 200) : [];
  let unpushedCommits: CommitRow[] = [];
  // "safe to drop" = the commits are preserved somewhere: pushed to a push/upstream ref,
  // OR present on ANY remote (covers `push` without `-u`), OR merged into the integration
  // branch. Measured against the integration branch — NOT the primary's HEAD, which may be
  // parked off it — so a lane landed via a ref-advance still reads as merged/safe-to-remove.
  // @{push} is unresolvable for a branch with no upstream — same fallback as before.
  const intRef = (await integrationBranch(repo)) ?? "HEAD";
  const unpushed = await git(path, "log", "--no-color", "@{push}..", "--format=%h%x09%ct%x09%s");
  if (unpushed.code === 0) {
    unpushedCommits = parseCommitLog(unpushed.out);
  } else {
    const br = await git(path, "rev-parse", "--abbrev-ref", "HEAD");
    const branch = br.code === 0 ? br.out : "";
    const onRemote = await git(path, "branch", "-r", "--contains", "HEAD");
    const merged = branch ? await git(repo, "branch", "--merged", intRef, "--list", branch) : { out: "" };
    if (!onRemote.out.trim() && !merged.out.trim()) {
      // scope to the lane's OWN commits (HEAD not in the integration branch's base),
      // else a no-upstream lane over-reports all of main's history as "unpushed"
      const baseSha = (await git(repo, "rev-parse", intRef)).out;
      const lg = baseSha
        ? await git(path, "log", "--no-color", `${baseSha}..HEAD`, "--format=%h%x09%ct%x09%s")
        : await git(path, "log", "--no-color", "--format=%h%x09%ct%x09%s");
      unpushedCommits = parseCommitLog(lg.out);
    }
  }
  const sh = await git(path, "diff", "HEAD", "--shortstat", "--no-color");
  return {
    dirtyFiles, unpushedCommits,
    shortstat: sh.code === 0 && sh.out ? sh.out : null,
    empty: dirtyFiles.length === 0 && unpushedCommits.length === 0,
  };
}

// "safe to drop" checks + removal, shared by land and orphan cleanup: git's OWN
// dirty/unmerged refusal in `worktree remove` is the backstop — on top we refuse while
// commits are neither pushed to any remote nor merged, so removal can never eat work
async function removeWorktreeSafe(repo: string, path: string, branch: string): Promise<{ error: string; code: number } | null> {
  const st = await git(path, "status", "--porcelain");
  if (st.code !== 0) return { error: "git status failed — worktree gone?", code: 400 };
  const risk = await worktreeRisk(repo, path);
  if (risk.dirtyFiles.length) return { error: `worktree has uncommitted changes:\n${risk.dirtyFiles.join("\n").slice(0, 400)}`, code: 409 };
  if (risk.unpushedCommits.length)
    return { error: `unpushed commits:\n${risk.unpushedCommits.map((c) => `${c.hash} ${c.subject}`).join("\n").slice(0, 400)}`, code: 409 };
  const rmv = await git(repo, "worktree", "remove", path);
  if (rmv.code !== 0) return { error: `worktree remove failed (lane kept): ${(rmv.err || rmv.out).slice(0, 300)}`, code: 409 };
  delete shelved[path]; // the worktree is gone — drop any shelve note with it
  return null;
}

// deterministic lane teardown: safety-checked worktree removal FIRST, while the slot is
// still intact — a failed remove leaves the lane fully recoverable instead of a torn-down
// slot pointing at an orphaned tree. Shared by the ⏏ land endpoint and the merge agent.
async function landLane(s: Slot, facts: LandFacts = NO_LAND_FACTS): Promise<{ error: string; code: number } | { removed: string; branch: string }> {
  if (!s.cwd || !s.worktree) return { error: "not a fleet-created worktree lane", code: 400 };
  const { repo, branch } = s.worktree;
  const path = s.cwd;
  // assemble the "landed" outcome while the worktree still exists (git reads need the tree);
  // emit only AFTER teardown succeeds, so a failed removeWorktreeSafe records no false land.
  const landed = await buildLaneOutcome(s, "landed", facts);
  const fail = await removeWorktreeSafe(repo, path, branch);
  if (fail) return fail;
  emitLaneOutcome(landed);
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
  return { removed: path, branch };
}

// advance the integration branch to a (clean, already-rebased) lane tip. If a working tree
// has the integration branch checked out, git ties the ref to that tree — ff-merge THERE, and
// git's own --ff-only refuses to clobber uncommitted work (the historical guarantee). If the
// integration branch is checked out nowhere (the primary parked off it), advance the ref
// directly with branch -f, gated on ancestry so it stays a fast-forward and touches no tree.
async function advanceIntegration(repo: string, main: string, branch: string): Promise<{ error: string } | null> {
  const holder = (await listWorktrees(repo)).find((w) => w.branch === main);
  if (holder) {
    const ff = await git(holder.path, "merge", "--ff-only", branch);
    return ff.code === 0 ? null : { error: (ff.err || ff.out).slice(0, 300) };
  }
  const anc = await git(repo, "merge-base", "--is-ancestor", main, branch);
  if (anc.code !== 0) return { error: `${main} is not an ancestor of ${branch} — not a fast-forward` };
  const upd = await git(repo, "branch", "-f", main, branch);
  return upd.code === 0 ? null : { error: (upd.err || upd.out).slice(0, 300) };
}

// advanceIntegration in reverse: move main from its current tip (mainAfter) back to mainBefore.
// Symmetric to advanceIntegration — if a working tree holds main, git ties the ref to that tree,
// so we reset THERE (refusing over a dirty tree, never discarding uncommitted work); otherwise
// move the ref directly with branch -f, gated on ancestry so it stays a real rewind. The caller
// (undo-land) has already verified main is still at mainAfter and mainAfter is on no remote.
async function resetIntegration(repo: string, main: string, mainAfter: string, mainBefore: string): Promise<{ error: string } | null> {
  const holder = (await listWorktrees(repo)).find((w) => w.branch === main);
  if (holder) {
    const st = await git(holder.path, "status", "--porcelain");
    if (st.code !== 0) return { error: `cannot read the ${main} checkout at ${holder.path}` };
    if (st.out) return { error: `${main} is checked out at ${holder.path} with uncommitted changes — undo would discard them; commit or stash there first` };
    const cur = await git(holder.path, "rev-parse", "HEAD");
    if (cur.out !== mainAfter) return { error: `${main} moved since this land — nothing safely undoable` };
    const rs = await git(holder.path, "reset", "--hard", mainBefore);
    return rs.code === 0 ? null : { error: (rs.err || rs.out).slice(0, 300) };
  }
  const anc = await git(repo, "merge-base", "--is-ancestor", mainBefore, mainAfter);
  if (anc.code !== 0) return { error: `the recorded pre-land commit is not an ancestor of ${main} — not a clean rewind` };
  const upd = await git(repo, "branch", "-f", main, mainBefore);
  return upd.code === 0 ? null : { error: (upd.err || upd.out).slice(0, 300) };
}

// slots currently being opened as lanes: the "is this slot free" checks and the eventual
// `openSlot` write are separated by several awaits, so every spawner (routes, dispatcher)
// must reserve its slot SYNCHRONOUSLY before the first await or two concurrent requests
// pick the same slot and one worktree ends up orphaned with a lying { ok } response
const laneSpawn = new Set<number>();
// worktree paths mid-attach — see the attach race note in /api/lanes
const attachBusy = new Set<string>();

async function openLaneInSlot(s: Slot, repo: string, branch: string, model: string | null = null): Promise<{ cwd: string; branch: string }> {
  const wt = await createWorktree(repo, branch);
  const base = await integrationBranch(wt.repo);
  const baseSha = await laneForkSha(wt.path, base);
  await openSlot(s, wt.path, { repo: wt.repo, branch: wt.branch, base: base ?? undefined, baseSha }, model);
  // a manual lane (no branch given → createWorktree auto-named it `fleet/<stamp>-<hex>`)
  // has no task text to derive a label from the way the dispatcher does (~tickDispatch,
  // `⎇ ${next.from} ...`) — so it must NEVER surface that raw uniqueness timestamp as the
  // label. Fall back to a short repo-based slug instead: "⎇ <repo> <hex>".
  s.label = branch.trim()
    ? wt.branch.replace(/^fleet\//, "⎇ ")
    : `⎇ ${basename(wt.repo)} ${wt.branch.split("-").pop() ?? ""}`.trimEnd().slice(0, MAX_LABEL);
  saveState();
  void tickGit().catch(() => {}); // badge should appear on the next sessions poll
  return { cwd: s.cwd ?? wt.path, branch: wt.branch };
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
    // self-scheduling credential: only baked into a LANE's pane (never a plain session) —
    // a session running inside its own worktree can POST /api/self/autos to check in on
    // itself later, scoped to exactly this slot, without ever touching the owner token
    const selfExport = s.worktree
      ? `export FLEET_SELF_TOKEN='${s.selfToken}'; export FLEET_SELF_SLOT='${s.id}'; ` : "";
    // the steward principal's scoped token, baked with the same exposure as FLEET_SELF_TOKEN
    // above but keyed on the steward LABEL (not the worktree flag): the pane that is currently
    // the ⚙ steward can then self-serve /api/steward/* (the Rundgang) without the owner token.
    // Env is only injectable at spawn, so a live relabel takes effect on the pane's next
    // (re)spawn — identical semantics to FLEET_SELF_TOKEN, never patched into a running pane.
    const stewardExport = s.label === STEWARD_LABEL && stewardToken
      ? `export FLEET_STEWARD_TOKEN='${stewardToken}'; ` : "";
    const created = await tmux("new-session", "-d", "-s", name, "-x", "200", "-y", "50", "-c", s.cwd,
      `${selfExport}${stewardExport}${slotCmd(candidate, resume, s.model)}`);
    if (created.code === 0) {
      s.cols = 200;
      s.rows = 50;
      s.sessionId = /^claude(\s|$)/.test(BASE_CMD) ? candidate : null;
      saveState();
      audit("self_heal_recreate", s.id, resume ? "resumed" : "created");
      console.log(`slot ${s.id}: ${resume ? `resumed claude session ${candidate} in` : "created tmux session"} '${name}' in ${s.cwd}`);
    }
  }
  // the size cache follows TMUX TRUTH, not the other way round: the in-memory cols/rows
  // die with every server restart (deploys!) while the pane keeps whatever the last
  // owner client set — a guest reading the stale 200×50 default then renders a terminal
  // that has nothing to do with the actual pane. Re-sync on every ensure.
  const size = await tmux("display-message", "-p", "-t", name, "#{window_width} #{window_height}");
  const sm = /^(\d+) (\d+)$/.exec(size.out);
  if (sm) {
    s.cols = Number(sm[1]);
    s.rows = Number(sm[2]);
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

async function openSlot(s: Slot, cwdRaw: string, worktree: { repo: string; branch: string; base?: string; baseSha?: string } | null = null,
  model: string | null = null): Promise<void> {
  const cwd = resolve(expandCwd(cwdRaw));
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) throw new Error(`not a directory: ${cwd}`);
  s.cwd = cwd;
  s.label = null; // a fresh session gets a fresh identity
  // set BEFORE ensureSlot spawns the pane below — FLEET_SELF_TOKEN is only baked into a
  // lane's pane env, so ensureSlot must see the final worktree tag, not a later patch-up
  s.worktree = worktree;
  s.model = model; // same reason — slotCmd bakes it at spawn; a recycled slot never inherits one
  s.selfToken = randomBytes(16).toString("hex"); // rotate: a recycled slot must not honor
  // whatever session used to hold it
  s.sessionId = null; // ensureSlot pins a new uuid when it creates the pane
  s.history = []; // ...including a fresh prompt history
  harvest.set(s.id, { file: "", offset: 0, rest: Buffer.alloc(0) }); // sentinel: harvest the NEW transcript from byte 0
  startCache.delete(s.id); // the fresh session gets a fresh start anchor
  mergeLast.delete(s.id); // a recycled slot must never show a previous lane's merge verdict
  mergeInflight.delete(s.id); mergeStart.delete(s.id); // ...nor report the prior lane's merge JOB as running:true and 409 the new lane (the old job's finally self-checks identity, so dropping the entry here is safe)
  aliveInfo.delete(s.id); // ...nor its liveness/wedge readings until the next tick recomputes
  gitOpInfo.delete(s.id);
  // ...nor its GIT facts. killSlot leaves gitInfo behind for tickGit's `if (!s.cwd)` branch to
  // reap (≤10s later), so a slot recycled inside that window would otherwise serve the PREVIOUS
  // lane's {dirty:0, ahead:N} for the new one. That is not cosmetic: `done-looking` is computed
  // from exactly these facts (laneSignalView), killSlot resets lastOutput to 0 so the idle clause
  // reads "quiet forever", and aliveInfo/gitOpInfo are refreshed BEFORE gitInfo inside a single
  // tickGit pass — so a brand-new, empty lane could read done-looking and auto-③ would file a
  // review of a diff that does not exist yet ("no code changes in scope") against it. Dropping
  // the entry makes the fact UNKNOWN until the tick computes it for this cwd, and an unknown is
  // never permission to act (lane-signals.ts: null git → not done-looking).
  gitInfo.delete(s.id);
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
  audit("slot_open", s.id, cwd);
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
  audit("slot_kill", s.id);
  s.cwd = null; // clear first so the self-heal loop can't resurrect it mid-kill
  s.label = null;
  summaryCache.delete(s.id); // a recycled slot must never show the previous session's summary
  reviewCache.delete(s.id); // …nor the previous session's 🔍 review
  reviewAutoTried.delete(s.id); // …and the next lane in this slot gets its own auto-③ budget
  harvest.delete(s.id); // no cursor on a dead slot — a later open re-seeds it
  startCache.delete(s.id);
  mergeInflight.delete(s.id); mergeStart.delete(s.id); // F5: a recycled slot must not inherit the prior lane's in-flight merge job as running:true (the old job's finally self-checks identity via mergeInflight.get === job, so this drop is safe)
  s.worktree = null; // the worktree itself stays on disk — land removes it, kill never does
  s.model = null; // the per-slot model dies with the session it was chosen for
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
    // failures must THROW, not vanish: a pane dying between the caller's alive-check and
    // this send otherwise records "sent" in autos/history/prompt-log for a prompt that
    // never arrived — a false audit trail is worse than a failed send
    if ((await p.exited) !== 0) throw new Error("tmux load-buffer failed — session gone?");
    const pb = await tmux("paste-buffer", "-p", "-d", "-b", buf, "-t", sess(s.id));
    if (pb.code !== 0) throw new Error("tmux paste-buffer failed — session gone?");
    if (submit) {
      await Bun.sleep(150);
      const sk = await tmux("send-keys", "-t", sess(s.id), "Enter");
      if (sk.code !== 0) throw new Error("tmux send-keys failed — text pasted but not submitted");
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

// shared by the owner route (POST /api/slots/:id/autos) and the self-scheduling route
// (POST /api/self/autos) — every guard rail (AUTO_MAX_PER_SLOT, min interval, mandatory
// runs cap, idle gate downstream in tickAutos) lives here exactly once. The caller is
// responsible for how `s` was derived; this function trusts it and never reads a `slot`
// field from the body, so it structurally cannot create an Auto anywhere but on `s`.
function createAutoForSlot(s: Slot, body: Record<string, unknown> | null, opts: { allowPerpetual?: boolean } = {}): Response {
  if (!s.cwd) return json({ error: "slot not active" }, 400);
  if (autos.filter((a) => a.slot === s.id && a.enabled).length >= AUTO_MAX_PER_SLOT)
    return json({ error: `max ${AUTO_MAX_PER_SLOT} active schedules per slot` }, 400);
  if (!body || typeof body.text !== "string" || !body.text.trim() || body.text.length > 10_000)
    return json({ error: "bad text" }, 400);
  const inSec = Number(body.inSec ?? 0) | 0;
  const everySec = body.everySec == null ? null : Number(body.everySec) | 0;
  if (everySec !== null && everySec < AUTO_MIN_EVERY_SEC)
    return json({ error: `everySec must be ≥ ${AUTO_MIN_EVERY_SEC}` }, 400);
  if (everySec === null && inSec < 1) return json({ error: "one-shot needs inSec ≥ 1" }, 400);
  // perpetual: a recurring auto that re-arms instead of expiring at the runs cap. Owner-only —
  // a steward/self principal minting an immortal schedule would be an un-gated autonomy
  // escalation (the run-forever cadence decision is the owner's, per prove-before-schedule).
  const perpetual = body.perpetual === true;
  if (perpetual && !opts.allowPerpetual) return json({ error: "perpetual autos are owner-only" }, 403);
  if (perpetual && everySec === null) return json({ error: "perpetual needs a recurring everySec" }, 400);
  const runs = everySec === null ? 1 : perpetual ? 1 : Number(body.runs ?? 0) | 0;
  if (everySec !== null && !perpetual && (runs < 1 || runs > AUTO_MAX_RUNS))
    return json({ error: `runs must be 1–${AUTO_MAX_RUNS}` }, 400); // the cap is mandatory, not optional
  const idleSec = Math.min(86_400, Math.max(0, Number(body.idleSec ?? 60) | 0));
  const a: Auto = {
    id: randomBytes(4).toString("hex"),
    slot: s.id,
    text: body.text,
    everySec,
    nextAt: Date.now() + (inSec > 0 ? inSec : everySec ?? 0) * 1000,
    runsLeft: runs,
    ...(perpetual ? { perpetual: true } : {}),
    idleSec,
    enabled: true,
    created: Date.now(),
    lastRun: 0,
    lastResult: null,
  };
  autos = [...autos, a];
  // completed one-shots (enabled=false) are never otherwise pruned — a self-scheduling lane
  // could grow autos + fleet.json without bound. Keep only the most recent AUTO_KEEP_DONE.
  const done = autos.filter((x) => x.slot === s.id && !x.enabled);
  if (done.length > AUTO_KEEP_DONE) {
    const drop = new Set(done.slice(0, done.length - AUTO_KEEP_DONE).map((x) => x.id));
    autos = autos.filter((x) => !drop.has(x.id));
  }
  saveState();
  return json({ ok: true, auto: a });
}

function advanceAuto(a: Auto, now: number): void {
  if (a.everySec) {
    a.nextAt = now + a.everySec * 1000;
    if (a.perpetual) return; // immortal beat: reschedule, never decrement or disable
    a.runsLeft--;
    if (a.runsLeft <= 0) a.enabled = false;
  } else {
    a.runsLeft = 0; // one-shot spent: make "spent" one predicate (runsLeft 0 AND disabled)
    a.enabled = false;
  }
}

function inQuietHours(ts: number): boolean {
  if (!quietHours) return false;
  const h = new Date(ts).getHours();
  const { start, end } = quietHours;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

// The single pre-delivery choke-point. EVERY path that types an unattended prompt into a pane —
// scheduled autos, the steward's direct send, the lane dispatcher, the merge/land idle guard —
// funnels through here, so the master stop (`autosOn`), quiet hours, a FRESH claude-alive check,
// and the idle gate can never again reach one path but silently skip another (the drift that was
// synergy-findings.md Tier-0 #1: gates added to tickAutos never reached the paths written later).
// Mirrors the createAutoForSlot choke-point pattern — a caller structurally can't misfire a gate.
// Each caller passes `opts` to keep its LEGITIMATE differences: a one-shot waives quiet hours
// (owner intent always fires), an owner-initiated land waives everything but idle, a just-spawned
// dispatch lane waives idle (idle by definition). Gate order is deliberate and preserves tickAutos:
// master stop first, then never touch a dead pane, then the quiet-hours policy, then the busy check.
// `alive` MUST stay a fresh claudeAlive call (never a cached read — a 10s-stale cache could fire
// into a pane that died seconds ago). Returns the FIRST failing gate so callers keep their own
// bespoke reaction (record+advance vs 409 vs requeue vs "blocked").
type DeliveryGate = "kill-switch" | "not-alive" | "quiet-hours" | "busy";
async function canDeliver(s: Slot, opts: {
  now: number;
  killSwitch?: boolean; // honor autosOn (default true)
  alive?: boolean;      // honor a FRESH claudeAlive (default true) — never a cache
  quietHours?: boolean; // honor quiet hours (default true; pass false for one-shots / owner acts)
  idleMs?: number;      // idle threshold in ms; 0/undefined disables the busy gate
}): Promise<{ ok: true } | { ok: false; gate: DeliveryGate }> {
  if ((opts.killSwitch ?? true) && !autosOn) return { ok: false, gate: "kill-switch" };
  if ((opts.alive ?? true) && !(await claudeAlive(s.id))) return { ok: false, gate: "not-alive" };
  if ((opts.quietHours ?? true) && inQuietHours(opts.now)) return { ok: false, gate: "quiet-hours" };
  if (opts.idleMs && opts.now - s.lastOutput < opts.idleMs) return { ok: false, gate: "busy" };
  return { ok: true };
}

let autoTickBusy = false;
async function tickAutos(): Promise<void> {
  if (!autosOn) return; // global kill-switch: no scheduled auto fires while automation is paused
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
        audit("auto_skip", a.slot, a.lastResult);
        dirty = true;
        continue;
      }
      // the shared choke-point (killSwitch already handled by the tick-level early return above;
      // quiet hours mute the PERIODIC surface only — one-shots are a specific owner intent and
      // always fire, so quiet-hours is honored only for a recurring auto).
      const verdict = await canDeliver(s, {
        now,
        killSwitch: false,
        quietHours: a.everySec !== null,
        idleMs: a.idleSec === 0 ? 0 : a.idleSec * 1000,
      });
      if (!verdict.ok) {
        if (verdict.gate === "not-alive") {
          // NEVER type into a bare shell; count the run and move on
          a.lastResult = "skipped — claude not running in pane";
          audit("auto_skip", a.slot, a.lastResult);
          advanceAuto(a, now);
          dirty = true;
          continue;
        }
        if (verdict.gate === "quiet-hours") {
          // held inside the owner's quiet window and retried next interval (tick-in-place). No
          // staleness fast-forward is needed — advanceAuto reschedules now-relative, so an overdue
          // auto fires at most once, never a replayed backlog.
          a.nextAt = now + (a.everySec ?? 0) * 1000;
          dirty = true;
          continue;
        }
        // gate === "busy": the idle gate
        if (now < a.nextAt + AUTO_GRACE_MS) continue; // wait within grace, no state change
        a.lastResult = "skipped — session stayed busy";
        audit("auto_skip", a.slot, a.lastResult);
        advanceAuto(a, now);
        dirty = true;
        continue;
      }
      dirty = true;
      try {
        await sendText(s, a.text, true);
      } catch (e) {
        // sendText now surfaces tmux failures — record the truth instead of "sent"
        a.lastResult = `failed: ${e instanceof Error ? e.message : e}`.slice(0, 120);
        audit("auto_skip", a.slot, a.lastResult);
        advanceAuto(a, now);
        continue;
      }
      s.history = [...s.history, { text: a.text, ts: now }].slice(-MAX_HISTORY);
      saveHistory(s);
      logPrompt(s, a.text, "auto", now);
      a.lastRun = now;
      a.lastResult = "sent";
      audit("auto_fire", a.slot, a.id);
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
    const free = slots.find((s) => !s.cwd && !laneSpawn.has(s.id));
    if (!free) return;
    const next = tasks.find((t) => t.status === "queued");
    if (!next) return;
    // master stop + quiet hours gate the dispatcher BEFORE a lane is spawned or the task is
    // consumed (was synergy-findings.md Tier-0 #1 — neither reached this path) — a paused or quiet
    // fleet leaves the task queued for the next eligible tick. No idle/alive gate: the target lane
    // does not exist yet.
    const pre = await canDeliver(free, { now: Date.now(), alive: false });
    if (!pre.ok) return; // task stays queued
    laneSpawn.add(free.id); // reserve before the first await — see laneSpawn
    try {
      const wt = await createWorktree(DISPATCH_REPO, "");
      // no `base` here (the dispatcher lane keeps today's live re-derivation), but the fork
      // commit is still captured — the outcome record needs it after the land moves main
      await openSlot(free, wt.path, { repo: wt.repo, branch: wt.branch,
        baseSha: await laneForkSha(wt.path, await integrationBranch(wt.repo)) });
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
      // fresh claude-alive gate (was synergy-findings.md Tier-0 #2): slotCmd is `claude; exec
      // $SHELL`, so a claude that failed to boot leaves a bare shell that would EXECUTE this
      // externally-fed task text as commands. Re-check the master stop + quiet hours too (the owner
      // may have paused during the 4s boot). Requeue on any failure — the lane exists, the prompt waits.
      const post = await canDeliver(free, { now: Date.now(), idleMs: 0 });
      if (!post.ok) {
        next.status = "queued";
        next.note = `dispatch held (${post.gate}) — requeued`;
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
    } finally {
      // release the spawn reservation ALWAYS — without this every dispatched slot stayed
      // in laneSpawn forever, unusable by the dispatcher, attach and manual open alike
      // until a restart (the sibling routes release in finally; this path didn't)
      laneSpawn.delete(free.id);
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
  // one statSync probe per listed folder classifies it: .git-as-dir = a real repo (badge it,
  // you can start a lane here); .git-as-file = a git worktree (a lane already — the picker's
  // "hide worktrees" toggle filters these). Same syscall budget as a plain existsSync loop.
  const repos: string[] = [];
  const worktrees: string[] = [];
  for (const name of dirs) {
    try {
      const st = statSync(`${dir}/${name}/.git`);
      repos.push(name);
      if (st.isFile()) worktrees.push(name);
    } catch { /* no .git here — not a repo */ }
  }
  return { path: dir, parent: parent === dir ? null : parent, dirs, repos, worktrees, recents, pins, common, git: existsSync(`${dir}/.git`) };
}

// --- transcript view: read claude's own JSONL (~/.claude/projects/<cwd-slug>/<uuid>.jsonl)
// and hand the client structured messages instead of terminal bytes. Renders natively at
// any width — this is the per-device-formatting answer the pty can never give.
// The summarizer's throwaway sessions write transcripts into the SAME project dir as the
// slot they describe — without these guards the newest-by-mtime fallback below hands the
// board/chat view the summarizer's own prompt as "your prompt". Live runs are tracked in
// summarizerSids; strays from crashed runs are caught by sniffing the prompt's marker text.
// ONE mark per background prompt that runs in a SLOT's project dir. The 🔍 review is in this list
// because auto-③ made "a deploy interrupts a review" routine rather than rare: the sids of live
// runs are dropped from process memory on restart, so the ONLY thing left to recognize the stray
// transcript by is its prompt text. A mark missing here means that transcript can be served as the
// adopted slot's own conversation — keep this list in step with every prompt run via summaryViaSession.
const SUMMARIZER_MARK = "read-only reviewer summarizing the state of a coding session";
const REVIEW_MARK = "read-only code reviewer. The diffs below are the WHOLE subject";
const BACKGROUND_MARKS = [SUMMARIZER_MARK, REVIEW_MARK];
const sniffedSummarizer = new Set<string>(); // positive verdicts only — a marker can't un-happen
function sniffSummarizer(path: string): boolean {
  if (sniffedSummarizer.has(path)) return true;
  try {
    const fd = openSync(path, "r");
    const buf = Buffer.alloc(16_384);
    const n = readSync(fd, buf, 0, buf.length, 0);
    closeSync(fd);
    const headText = buf.toString("utf8", 0, n);
    if (!BACKGROUND_MARKS.some((m) => headText.includes(m))) return false;
    sniffedSummarizer.add(path);
    return true;
  } catch {
    return false;
  }
}

function transcriptFile(s: Slot): string | null {
  const dir = projDir(s.cwd!);
  if (s.sessionId) {
    const pinned = `${dir}/${s.sessionId}.jsonl`;
    if (existsSync(pinned)) return pinned;
  }
  // adopted or pre-session-pinning slot: newest transcript in this cwd's project dir.
  // Excluded: transcripts pinned to OTHER slots (several slots can share a cwd) and the
  // summarizer's throwaway transcripts (see above). Pinned ids make this exact for every
  // pane created from now on.
  const pinnedElsewhere = new Set<string>();
  for (const o of slots) if (o !== s && o.sessionId) pinnedElsewhere.add(`${o.sessionId}.jsonl`);
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl") && !pinnedElsewhere.has(f) && !summarizerSids.has(f.slice(0, -6)))
      .map((f) => ({ f, m: statSync(`${dir}/${f}`).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const { f } of files.slice(0, 8)) if (!sniffSummarizer(`${dir}/${f}`)) return `${dir}/${f}`;
    return null;
  } catch {
    return null;
  }
}

interface TBlock { t: "text" | "thinking" | "tool" | "tool_result"; text: string; name?: string }
// meta: a harness-injected user turn (e.g. a <task-notification> — a background task
// reported back). Real content, but not something the user typed, so the conversation
// view folds it away instead of rendering a fake "you" bubble.
interface TEntry { n: number; role: "user" | "assistant"; ts: string | null; blocks: TBlock[]; meta?: boolean }

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
  let meta = false;
  if (d.type === "user") {
    if (typeof content === "string") {
      if (content.startsWith("<system-reminder")) return null; // harness noise, not the user
      if (content.startsWith("<task-notification")) meta = true; // background task reported back
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
  return { n, role: d.type, ts, blocks, ...(meta && { meta: true }) };
}

// the conversation view's data source, shared by the owner chat view and the guest
// reader — `after` = line count the client has already consumed, so entry numbering
// must be absolute line numbers
async function transcriptPayload(s: Slot, afterRaw: number):
  Promise<{ entries: TEntry[]; total: number; source: string | null }> {
  const file = transcriptFile(s);
  if (!file) return { entries: [], total: 0, source: null };
  const lines = (await Bun.file(file).text()).split("\n").filter((l) => l.trim() !== "");
  const after = Math.max(0, afterRaw | 0);
  const entries: TEntry[] = [];
  for (let i = after; i < lines.length; i++) {
    try {
      const e = viewEntry(JSON.parse(lines[i]), i + 1);
      if (e) entries.push(e);
    } catch {
      // only the FINAL line may be a partial mid-append (cap total so the next poll
      // re-reads it once complete) — an unparseable line mid-file is just skipped,
      // otherwise it would pin total forever and loop the client on the same range
      if (i === lines.length - 1) return { entries, total: i, source: file.split("/").pop() ?? null };
    }
  }
  return { entries, total: lines.length, source: file.split("/").pop() ?? null };
}

// --- terminal-prompt harvester: prompts typed DIRECTLY into the pty never pass /send,
// so history + prompt log would miss them. The transcript JSONL is the ground truth of
// what claude actually received — harvest new user text entries from there instead of
// trying to reconstruct prompts from raw keystrokes (arrows, edits, tab-completion make
// the byte stream unreliable). Pinned-session slots only: the mtime fallback can flap
// between files when several sessions share a cwd, and a flap would re-log whole foreign
// transcripts. Composed sends are suppressed via recentComposed (they're in the transcript
// too). At boot the cursor seeds to end-of-file so old history is never re-logged.
// Incremental by BYTE OFFSET — transcripts grow to tens of MB, re-reading them whole
// every tick would be constant I/O for nothing. Only new bytes are read; the partial
// trailing line is carried as raw bytes so a chunk boundary can't split a UTF-8 char.
const harvest = new Map<number, { file: string; offset: number; rest: Buffer }>();
let harvestBusy = false;
async function tickHarvest(): Promise<void> {
  if (harvestBusy || !/^claude(\s|$)/.test(BASE_CMD)) return;
  harvestBusy = true;
  try {
    for (const s of slots) {
      if (!s.cwd || !s.sessionId) continue;
      const file = `${projDir(s.cwd)}/${s.sessionId}.jsonl`;
      let size: number;
      try {
        size = statSync(file).size;
      } catch {
        continue; // transcript not created yet (appears after the first prompt)
      }
      let cur = harvest.get(s.id);
      if (!cur || cur.file !== file) {
        // no cursor = first sight since boot → skip existing content; a NEW file for an
        // already-tracked slot (fresh claude after self-heal, recycled slot) reads from 0
        cur = { file, offset: cur ? 0 : size, rest: Buffer.alloc(0) };
        harvest.set(s.id, cur);
      }
      if (size < cur.offset) { cur.offset = 0; cur.rest = Buffer.alloc(0); } // rewritten — resync
      if (size === cur.offset) continue;
      let lines: string[];
      try {
        const buf = Buffer.alloc(size - cur.offset);
        const fd = openSync(file, "r");
        const n = readSync(fd, buf, 0, buf.length, cur.offset);
        closeSync(fd);
        cur.offset += n;
        let chunk = Buffer.concat([cur.rest, buf.subarray(0, n)]);
        lines = [];
        let nl: number;
        while ((nl = chunk.indexOf(0x0a)) !== -1) {
          lines.push(chunk.subarray(0, nl).toString("utf8"));
          chunk = chunk.subarray(nl + 1);
        }
        cur.rest = Buffer.from(chunk); // copy — a subarray would pin the whole read buffer
      } catch {
        continue; // transient read error — next tick retries from the same offset
      }
      const composed = (recentComposed.get(s.id) ?? []).filter((e) => Date.now() - e.ts < COMPOSED_TTL);
      recentComposed.set(s.id, composed);
      let dirty = false;
      for (const line of lines) {
        if (!line.trim()) continue;
        let e: TEntry | null;
        try {
          e = viewEntry(JSON.parse(line), 0);
        } catch {
          continue;
        }
        if (e?.role !== "user") continue;
        for (const b of e.blocks) {
          if (b.t !== "text") continue;
          const t = b.text.trim();
          // skip slash-command envelopes — they're UI plumbing, not a prompt
          if (!t || t.startsWith("<command-") || t.startsWith("<local-command")) continue;
          if (composed.some((c) => c.text === t.slice(0, 5000))) continue;
          const ts = (e.ts && Date.parse(e.ts)) || Date.now();
          s.history = [...s.history, { text: t, ts }].slice(-MAX_HISTORY);
          logPrompt(s, t, "terminal", ts);
          dirty = true;
        }
      }
      if (dirty) saveHistory(s);
    }
  } finally {
    harvestBusy = false;
  }
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
// worker tier for the throwaway agents (summarize, commit message, enhance, merge resolver,
// ② clean review, digest). Bracket = the 1M context variant; it reaches a tmux shell line in
// summaryViaSession, so it is single-quoted there — see the MODEL_RE note.
const SUMMARY_MODEL =
  process.env.FLEET_SUMMARY_MODEL && MODEL_RE.test(process.env.FLEET_SUMMARY_MODEL)
    ? process.env.FLEET_SUMMARY_MODEL : "claude-sonnet-5[1m]";
const SUMMARY_TIMEOUT_MS = 180_000;
interface SummaryResult {
  summary: string; openThreads: string[]; verification: string;
  model: string; at: number; head: string | null; dirty: number; raw: boolean;
}
const summaryCache = new Map<number, { key: string; result: SummaryResult }>();
const summaryInflight = new Map<number, Promise<SummaryResult>>();
// session ids of summarizer runs currently in flight — transcriptFile's fallback must
// never serve these as the slot's own conversation (their file is deleted after the run)
const summarizerSids = new Set<string>();

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
async function summaryViaSubprocess(cmd: string, prompt: string, cwd: string, timeoutMs = SUMMARY_TIMEOUT_MS): Promise<string> {
  const p = Bun.spawn([cmd, "--model", SUMMARY_MODEL], { cwd, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  p.stdin.write(prompt);
  await p.stdin.end();
  const killer = setTimeout(() => p.kill(), timeoutMs);
  const out = await new Response(p.stdout).text();
  const err = await new Response(p.stderr).text();
  const code = await p.exited;
  clearTimeout(killer);
  if (code !== 0) throw new Error(`summarizer exited ${code}: ${(err || out).slice(0, 300)}`);
  return out.trim();
}

// Tool floor for the five throwaway TEXT-ONLY agents (summary, review, commit message, enhance,
// steward digest). Each of their prompts already says "do NOT use any tools" — that is prose
// addressed to a model that, without this, holds the owner's whole interactive allow list.
// `--tools ""` cuts the built-in tools out of the session entirely; being a capability cut rather
// than a permission rule, it is the one form ~/.claude/settings.json cannot widen (an --allowedTools
// list would just be unioned with the owner's bare `Read`). --strict-mcp-config drops the owner's
// MCP connectors with no --mcp-config to replace them, and dontAsk makes anything left auto-DENY
// instead of a permission prompt that would hang the pane until the timeout.
const TEXT_ONLY_TOOLS = '--tools "" --strict-mcp-config --permission-mode dontAsk';

// production path: throwaway INTERACTIVE claude in its own tmux session on the
// server socket — runs on the subscription, not the metered API. Session id is
// pinned (same trick as slotCmd) so the transcript path is known; the answer is
// read from that JSONL with the transcript view's own parser.
async function summaryViaSession(prompt: string, cwd: string, doneMark = '"summary"',
  opts: { extraArgs?: string; timeoutMs?: number } = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? SUMMARY_TIMEOUT_MS;
  const sid = crypto.randomUUID();
  summarizerSids.add(sid);
  const name = `sum-${sid.slice(0, 8)}`;
  const started = Date.now();
  const sp = await tmux("new-session", "-d", "-s", name, "-c", cwd, "-x", "200", "-y", "50",
    `${PATH_EXPORT}claude --session-id ${sid} --model '${SUMMARY_MODEL}'${opts.extraArgs ? ` ${opts.extraArgs}` : ""}`);
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
    while (Date.now() - started < timeoutMs) {
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
      if (lastText.includes(doneMark)) return lastText;
    }
    if (lastText) return lastText;
    throw new Error("summarizer timed out without an answer");
  } finally {
    await tmux("kill-session", "-t", name); // never leave an unattended claude behind
    // the transcript is throwaway — leaving it would make it the newest .jsonl in the
    // slot's project dir, and the transcript view's mtime fallback would show the
    // summarizer's prompt as the session's own conversation
    await rm(file, { force: true });
    summarizerSids.delete(sid);
  }
}

// the summary contract, shared by the owner sideboard and the guest info tab:
// run=false is a pure cache lookup and never spawns; run=true spawns at most one
// agent per slot (single-flight) and the HEAD+status cache key stops repeat spends
// on an unchanged tree no matter who keeps clicking.
async function summaryResponse(s: Slot, run: boolean): Promise<Response> {
  const st = await git(s.cwd!, "status", "--porcelain");
  if (st.code !== 0) return json({ error: "not a git repository" }, 400);
  const hd = await git(s.cwd!, "rev-parse", "HEAD");
  const head = hd.code === 0 ? hd.out : null;
  const dirty = st.out.split("\n").filter(Boolean).length;
  const key = `${head}:${Bun.hash(st.out)}`;
  const cached = summaryCache.get(s.id);
  if (cached?.key === key) return json({ ...cached.result, cached: true, stale: false });
  if (!run) return json(cached ? { ...cached.result, cached: true, stale: true } : { cached: false });
  let inflight = summaryInflight.get(s.id);
  if (!inflight) {
    inflight = runSummary(s, head, dirty).finally(() => summaryInflight.delete(s.id));
    summaryInflight.set(s.id, inflight);
  }
  try {
    const result = await inflight;
    summaryCache.set(s.id, { key, result });
    return json({ ...result, cached: false, stale: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "summarizer failed" }, 500);
  }
}

async function runSummary(s: Slot, head: string | null, dirty: number): Promise<SummaryResult> {
  const cwd = s.cwd!;
  const lg = await git(cwd, "log", "--no-color", "--oneline", "-15");
  const d = await git(cwd, "diff", "HEAD", "--no-color");
  // founding intent + landability, fed FIRST so they never truncate: a dispatched lane's
  // task scrolls off the 40k transcript tail on long sessions, and ahead/behind vs the lane
  // base is the single most load-bearing "is this landable" signal the commit log can't give.
  const laneTask = tasks.find((t) => t.slot === s.id)?.text ?? null;
  const laneBase = s.worktree ? await laneBaseRef(s) : null;
  let landability = "";
  if (laneBase) {
    const ab = await git(cwd, "rev-list", "--left-right", "--count", `${laneBase}...HEAD`);
    const m = /^(\d+)\s+(\d+)$/.exec(ab.out);
    if (m) landability = `${m[2]} commit(s) ahead of, ${m[1]} behind ${laneBase}`;
  }
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
    ...(laneTask ? ["", "## lane task (what this session was started to do)", laneTask] : []),
    ...(landability ? ["", "## landability", landability] : []),
    "", "## commits", lg.code === 0 && lg.out ? lg.out : "(none)",
    "", "## uncommitted diff", (d.code === 0 ? d.out.slice(0, 60_000) : "") || "(clean)",
    "", "## transcript tail", transcriptTail(s, 30).slice(-40_000) || "(no transcript)",
  ].join("\n");
  let text = SUMMARY_CMD
    ? await summaryViaSubprocess(SUMMARY_CMD, prompt, cwd)
    : await summaryViaSession(prompt, cwd, '"summary"', { extraArgs: TEXT_ONLY_TOOLS });
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

// --- 🔍 review: the third advisory agent. Same throwaway-claude machinery as ✨ summarize,
// pointed at this slot's OWN code changes instead of its transcript: ranked findings that each
// cite file:line. Click-only (POST), cached on the exact git state, GET never spawns. Strictly
// advisory and OWNER-ONLY — no land/merge/commit path reads any of this, and unlike the summary
// it is deliberately NOT on the guest share surface. Read-only by the same contract runSummary
// uses: no tool args to summaryViaSession plus an explicit no-tools instruction. It NEVER touches
// the tree — no reset, no checkout (unlike runCleanReview, which runs on a clean about-to-land
// tree; this one runs on a LIVE lane that may hold hours of uncommitted work).
// FLEET_REVIEW_CMD (tests only) switches to a plain subprocess stand-in.
const REVIEW_CMD = process.env.FLEET_REVIEW_CMD ?? null;
// must stay UNDER Bun.serve's idleTimeout (240s) with real headroom — same reason
// SUMMARY_TIMEOUT_MS is 180s: at parity the agent's own timeout races the socket's, and the
// owner gets a dropped connection instead of the intended 500 + "reviewer failed". Raising
// this without raising idleTimeout first re-breaks that.
const REVIEW_TIMEOUT_MS = 180_000;
const REVIEW_DIFF_CAP = 60_000; // per diff section — the prompt carries at most two
const MAX_FINDINGS = 5;
interface ReviewFinding {
  title: string; file: string; line: number | null; impact: "high" | "medium" | "low";
  cost: string; basis: "verified" | "inferred"; detail: string;
}
interface ReviewResult {
  findings: ReviewFinding[]; scope: string; notes: string;
  model: string; at: number; head: string | null; dirty: number; raw: boolean;
  // CONTENT identity of the diff this review actually read (`git patch-id --stable`), which is
  // what the outcome row's staleness relation compares — never the sha. The land path REBASES a
  // lane onto main before the ff-merge, so the landed HEAD is a different commit than the reviewed
  // one on every clean land while the diff is byte-identical: a sha/key comparison would mark
  // exactly those reviews stale, and worst under the parallelism this layer exists for.
  // null = not computable (no lane base, or git could not id the patch) — never treated as a match.
  patchId: string | null;
}
const reviewCache = new Map<number, { key: string; result: ReviewResult }>();
// An inflight review carries the IDENTITY it was started for, not just its promise. Two bugs live
// in "await, then write the cache" without it, and auto-③ makes both routine:
//   · the key was computed by whichever request STARTED the join, so a second caller arriving on a
//     changed tree would file a result computed for the older state under ITS key (same class as
//     the mergeInflight identity check — grep the F5 note at killSlot);
//   · a review that finishes AFTER the slot was recycled would file lane A's findings under lane
//     B, since killSlot's cache delete happens BEFORE the write.
// So the job freezes {key, cwd, branch} at START and the write re-checks them.
interface ReviewJob { key: string; cwd: string; branch: string | null; p: Promise<ReviewResult> }
const reviewInflight = new Map<number, ReviewJob>();
// git states the AUTO path has already spawned for (see tickAutoReview). Separate from
// reviewCache because a FAILED review caches nothing: without this the auto path would re-spawn
// on every tick for the same unchanged tree — the retry storm §4 forbids.
const reviewAutoTried = new Map<number, string>();

// the exact git state a review is computed FOR, and the cache key derived from it. One source for
// the owner's click, the auto path and the outcome row's staleness relation — three readers of
// "which tree did this describe" that must not each derive it their own way. null = not a repo.
async function reviewState(cwd: string): Promise<{ key: string; head: string | null; dirty: number } | null> {
  const st = await git(cwd, "status", "--porcelain");
  if (st.code !== 0) return null;
  const hd = await git(cwd, "rev-parse", "HEAD");
  const head = hd.code === 0 ? hd.out : null;
  return { key: `${head}:${Bun.hash(st.out)}`, head, dirty: st.out.split("\n").filter(Boolean).length };
}

// the ONE place a reviewer is ever spawned — owner click and auto-③ both come through here, which
// is what makes "at most one agent per slot" true rather than true-per-caller. The cache write is
// the job's own (frozen key, re-checked identity), never the caller's view of the tree.
function startReview(s: Slot, rs: { key: string; head: string | null; dirty: number }): ReviewJob {
  const job = {
    key: rs.key, cwd: s.cwd!, branch: s.worktree?.branch ?? null,
  } as ReviewJob;
  job.p = runReview(s, rs.head, rs.dirty).then((result) => {
    // the slot must still hold the SAME lane this review was started for; a recycle in between
    // means these findings describe a tree nobody is looking at anymore — drop them
    if (s.cwd === job.cwd && (s.worktree?.branch ?? null) === job.branch)
      reviewCache.set(s.id, { key: job.key, result });
    return result;
  }).finally(() => {
    if (reviewInflight.get(s.id) === job) reviewInflight.delete(s.id);
  });
  reviewInflight.set(s.id, job);
  return job;
}

// same contract as summaryResponse: run=false is a pure cache lookup that never spawns,
// run=true spawns at most one agent per slot and the HEAD+status key stops repeat spend
// on an unchanged tree.
async function reviewResponse(s: Slot, run: boolean): Promise<Response> {
  const rs = await reviewState(s.cwd!);
  if (!rs) return json({ error: "not a git repository" }, 400);
  const { key } = rs;
  const cached = reviewCache.get(s.id);
  if (cached?.key === key) return json({ ...cached.result, cached: true, stale: false });
  if (!run) return json(cached ? { ...cached.result, cached: true, stale: true } : { cached: false });
  const job = reviewInflight.get(s.id) ?? startReview(s, rs);
  try {
    const result = await job.p;
    // joining a review that was started for an EARLIER tree answers honestly: these findings are
    // real, they just are not about the state this caller asked about
    return json({ ...result, cached: false, stale: job.key !== key });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "reviewer failed" }, 500);
  }
}

function reviewFinding(x: unknown): ReviewFinding | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const file = typeof o.file === "string" ? o.file.trim() : "";
  const line = typeof o.line === "number" && Number.isFinite(o.line) ? Math.trunc(o.line) : null;
  // the contract's hard floor: an uncited claim is not a finding, so it is dropped rather than shown
  if (!file || line === null) return null;
  const impact = o.impact === "high" || o.impact === "medium" || o.impact === "low" ? o.impact : "medium";
  return {
    title: (typeof o.title === "string" ? o.title : "").slice(0, 200),
    file: file.slice(0, 300), line, impact,
    cost: (typeof o.cost === "string" ? o.cost : "").slice(0, 600),
    basis: o.basis === "verified" ? "verified" : "inferred", // never upgrade an unstated basis to verified
    detail: (typeof o.detail === "string" ? o.detail : "").slice(0, 1200),
  };
}

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;

// the content identity of a lane's whole diff — its own commits (base...HEAD) plus whatever is
// uncommitted. Callers pass the diff TEXT they are working from (runReview passes the exact
// strings that go into the prompt, so the id is of what the reviewer read, never of a re-read
// tree that may have moved since). `git patch-id --stable` normalizes what a rebase changes
// (commit shas, line offsets, hunk order) and hashes what it does not — which is exactly the
// question "did the review describe this diff". Deliberately NOT insensitive to context lines:
// if main edited within the ±3 lines around a lane hunk, the id changes, and it should — that is
// the case where the review never saw the interaction with main's neighbouring edit.
// Returns null when it cannot be established — never a value that could compare equal.
async function patchIdOf(cwd: string, committed: string, uncommitted: string): Promise<string | null> {
  const text = `${committed}\n${uncommitted}`;
  if (!text.trim()) return null; // an empty diff has no content to be covered
  const p = Bun.spawn(["git", "-C", cwd, "patch-id", "--stable"], { stdin: "pipe", stdout: "pipe", stderr: "pipe" });
  p.stdin.write(text);
  await p.stdin.end();
  const out = await new Response(p.stdout).text();
  if (await p.exited !== 0) return null;
  const id = out.trim().split(/\s+/)[0] ?? "";
  return /^[0-9a-f]{40,64}$/.test(id) ? id : null;
}

async function runReview(s: Slot, head: string | null, dirty: number): Promise<ReviewResult> {
  const cwd = s.cwd!;
  // a lane's authoritative fork base gives the session-scoped diff; a non-lane slot has none,
  // so the review falls back to the uncommitted work plus what the recent commits show
  const base = s.worktree ? await laneBaseRef(s) : null;
  let committed = "", scope = "";
  // A git read that FAILED is not a diff that was EMPTY. Both used to collapse into "" here, and
  // with a clean tree that reached the early return below as a fully successful, non-raw, empty
  // review — byte-identical to a real clean one, cached by startReview and filed by outcomeReview
  // as `superseded` coverage. One transient git failure then recorded "reviewed, nothing found"
  // about a lane nobody reviewed. Same defect class as the ② shadow row's `raw` and as
  // LandFacts.verified: empty ≠ clean, and unknown ≠ zero (A4).
  let readFailed = "";
  if (base) {
    const d = await git(cwd, "diff", "--no-color", `${base}...HEAD`);
    if (d.code === 0) { committed = d.out; scope = `this lane's changes since ${base}, plus its uncommitted work`; }
    // NOT the same as having no base at all: the fallback scope string below would misdescribe this
    // as "(no lane base to diff against)" while a perfectly good base sat in s.worktree.base.
    else readFailed = `git diff ${base}...HEAD exited ${d.code}: ${(d.err || d.out).slice(0, 200)}`;
  }
  if (!scope) scope = "uncommitted changes plus recent commits (no lane base to diff against)";
  const un = await git(cwd, "diff", "HEAD", "--no-color");
  if (un.code !== 0 && !readFailed) readFailed = `git diff HEAD exited ${un.code}: ${(un.err || un.out).slice(0, 200)}`;
  const uncommitted = un.code === 0 ? un.out : "";
  // THROW rather than degrade: a review is advisory, and this project's rule for it is already
  // "a failed review is a non-event — it caches nothing and changes no state" (tickAutoReview's
  // one-attempt-per-git-state note). A partial review would be worse than none, because its scope
  // line would name a subject it did not actually read. Throwing keeps startReview's `.then` from
  // running, so nothing is cached, the outcome row honestly says `none`, and an owner click gets a
  // 500 naming the git failure instead of a silent "nothing to review".
  if (readFailed) throw new Error(`review could not read this tree — ${readFailed}`);
  const lg = await git(cwd, "log", "--no-color", "--oneline", "-15");
  // the id of the diff text BELOW, taken HERE and stored with the findings: an owner click on a
  // dirty tree reviews uncommitted work that no later read can reconstruct, so the relation the
  // outcome row records is only honest if it is frozen at review time
  const meta = { model: SUMMARY_MODEL, at: Date.now(), head, dirty,
    patchId: await patchIdOf(cwd, committed, uncommitted) };
  // nothing changed → nothing to review. Answered without spawning: a model call here could
  // only invent findings, and it would be billed for every click on an untouched tree.
  if (!committed.trim() && !uncommitted.trim())
    return { findings: [], scope, notes: "no code changes in scope — nothing to review", raw: false, ...meta };
  const cut = (t: string) => (t.length > REVIEW_DIFF_CAP ? `${t.slice(0, REVIEW_DIFF_CAP)}\n… truncated` : t);
  const truncated = committed.length > REVIEW_DIFF_CAP || uncommitted.length > REVIEW_DIFF_CAP;
  const prompt = [
    "You are a read-only code reviewer. The diffs below are the WHOLE subject — review them, nothing else.",
    "Do NOT use any tools and do NOT edit any file — answer directly from the input, in one single message.",
    "Respond with STRICT JSON only, no markdown fences, exactly this shape:",
    '{"findings": [{"title": "...", "file": "path", "line": 12, "impact": "high|medium|low",'
      + ' "cost": "...", "basis": "verified|inferred", "detail": "..."}], "notes": "..."}',
    `- Rank findings by impact, most severe first, and return at most ${MAX_FINDINGS}.`
      + " Five ranked findings beat twenty unranked ones.",
    "- Every finding MUST cite a concrete file and a line number you can point at in the diff."
      + " A finding without a cited line is not a finding — drop it rather than guess a line.",
    "- cost: what concretely breaks, degrades, or becomes unmaintainable if this stands."
      + " If you cannot state the cost, drop the finding.",
    '- basis: "verified" only if the diff itself shows it; "inferred" if it depends on code not shown here.'
      + " Never let an inference read as verified.",
    "- What is MISSING matters most: at each boundary the diff touches, ask what input is unvalidated,"
      + " what path is untested, what failure is unhandled.",
    '- notes: one line on what you could NOT check (truncated diff, code outside it), or "" if nothing.',
    "- An empty findings array is a valid and good answer. Never invent a finding to fill the list.",
    "Advisory only — never say whether to commit, merge or land.",
    "", "## scope", scope,
    ...(truncated ? ["", "## warning", "a diff below was truncated — say so in notes"] : []),
    "", "## recent commits", lg.code === 0 && lg.out ? lg.out : "(none)",
    "", "## committed changes in scope", cut(committed) || "(none)",
    "", "## uncommitted changes", cut(uncommitted) || "(clean)",
  ].join("\n");
  let text = REVIEW_CMD
    ? await summaryViaSubprocess(REVIEW_CMD, prompt, cwd, REVIEW_TIMEOUT_MS)
    : await summaryViaSession(prompt, cwd, '"findings"',
      { extraArgs: TEXT_ONLY_TOOLS, timeoutMs: REVIEW_TIMEOUT_MS });
  try {
    const env = JSON.parse(text) as { result?: unknown };
    if (typeof env.result === "string") text = env.result.trim();
  } catch { /* not an envelope — treat as the answer itself */ }
  const body = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  // fail-soft exactly like runSummary: an off-contract answer degrades to notes, never a 500
  let findings: ReviewFinding[] = [], notes = body.slice(0, 2000), raw = true;
  try {
    const j = JSON.parse(body) as { findings?: unknown; notes?: unknown };
    if (Array.isArray(j.findings)) {
      findings = j.findings.map(reviewFinding).filter((f): f is ReviewFinding => f !== null)
        .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]).slice(0, MAX_FINDINGS);
      notes = typeof j.notes === "string" ? j.notes.slice(0, 1000) : "";
      raw = false;
    }
  } catch { /* keep the raw text as notes */ }
  return { findings, scope, notes, raw, ...meta };
}

// --- auto-③: run the reviewer on a lane that has gone done-looking, so findings exist BEFORE the
// owner looks (docs/perception-layer.md §4). Automating WHEN ③ runs changes nothing about what it
// may do — it is not wired to land/merge/dispatch, and nothing reads its result to decide anything.
// It removes a WAIT, never a CHECK.
// Guard rails, each one load-bearing:
//   · LANES ONLY, never the ⚙ steward (a planning pane's diff is not lane work).
//   · ONCE PER GIT STATE — the existing HEAD+status cache key, not a timer. An unchanged tree
//     never re-spawns; a failure is remembered by KEY so it is a non-event, not a retry storm.
//   · Never a second concurrent agent: an inflight review (the owner's own click, or ours)
//     is left alone.
//   · Idle-gated through the shared done-looking predicate — one env knob shifts both.
// Cost is latency + attention (throwaway SUMMARY_MODEL session, reaped at boot like every other
// `sum-` background agent), which is what makes firing it unprompted acceptable.
const AUTO_REVIEW_MS = Number(process.env.FLEET_AUTO_REVIEW_MS ?? 15_000) | 0; // 0 disables the tick
const AUTO_REVIEW_IDLE_MS = Number(process.env.FLEET_AUTO_REVIEW_IDLE_MS ?? 60_000) | 0;
// the predicate is LEVEL-triggered — a finished lane stays idle+clean+ahead forever — so the
// trigger needs a ceiling in both directions: one attempt per git state (reviewAutoTried, written
// BEFORE the spawn so a failure is remembered too) and this cap on how many throwaway sessions
// auto-③ may hold open at once fleet-wide. summaryViaSession has no limit of its own.
const AUTO_REVIEW_MAX_CONCURRENT = 2;
let autoReviewRunning = 0;
let autoReviewBusy = false;
async function tickAutoReview(): Promise<void> {
  if (autoReviewBusy) return;
  autoReviewBusy = true;
  try {
    const now = Date.now();
    for (const s of slots) {
      if (autoReviewRunning >= AUTO_REVIEW_MAX_CONCURRENT) break;
      if (!s.cwd || !s.worktree) continue;          // a non-lane slot has no lane diff to review
      if (s.label === STEWARD_LABEL) continue;      // the planning pane is not lane work
      if (reviewInflight.has(s.id)) continue;       // one agent per slot, whoever started it
      if (!laneDoneLooking(laneSignalView(s, now), AUTO_REVIEW_IDLE_MS)) continue;
      // the predicate reads the ~10s gitOp cache; a merge/commit/rebase that STARTED since then
      // would have the reviewer read a half-rewritten tree and cache that as findings. Fresh reads.
      if (mergeInflight.has(s.id) || mergeStart.has(s.id) || commitInflight.has(s.id)) continue;
      if (await gitOpInProgress(s.cwd)) continue;
      const rs = await reviewState(s.cwd);
      if (!rs) continue;
      if (reviewCache.get(s.id)?.key === rs.key) continue;   // already reviewed THIS tree
      if (reviewAutoTried.get(s.id) === rs.key) continue;    // this state already got its one spawn
      reviewAutoTried.set(s.id, rs.key);
      autoReviewRunning++;
      // fire-and-forget: the tick must never hold its own busy flag across a 180s agent run, and
      // a failed auto-review is a non-event — no retry, no state change, nothing raised
      void startReview(s, rs).p.catch(() => {}).finally(() => { autoReviewRunning--; });
    }
  } finally {
    autoReviewBusy = false;
  }
}

// --- 💾 lane commit: the load-bearing SAVE. land/merge both refuse a dirty tree, so
// uncommitted work in a lane could only be saved from inside the session — one kill from
// gone. This commits it (NEVER pushes, NEVER lands — everything here is reversible by the
// owner with `git reset`). mode:"quick" is a deterministic wip commit; mode:"agent" asks a
// throwaway agent (same machinery as the summarizer) for a one-line conventional-commit
// message, and ALWAYS falls back to the wip message so a save can never fail on the model.
const COMMIT_CMD = process.env.FLEET_COMMIT_CMD ?? null; // tests: subprocess stand-in
const commitInflight = new Set<number>();

function sanitizeCommitMsg(raw: string): string {
  return raw.replace(/[`\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

// ask the agent for ONE conventional-commit line from the diff only. Returns "" on any
// failure/unparseable answer — the caller falls back to the wip message.
async function agentCommitMessage(cwd: string): Promise<string> {
  // --cached: describe exactly what is STAGED (commitLane stages before calling us), so the
  // message can't drift from the committed tree the way a working-tree diff read seconds
  // before the commit could. --stat gives per-file line counts, so the model sees which files
  // DOMINATE even when the unified diff truncates (the old 6k cap hid the change's center of
  // gravity on any non-trivial lane, yielding "chore: update server.ts" for a feature in file #7).
  const d = await git(cwd, "diff", "--cached", "--no-color");
  const st = await statusLines(cwd);
  const sh = await git(cwd, "diff", "--cached", "--shortstat", "--no-color");
  const stat = await git(cwd, "diff", "--cached", "--stat", "--no-color");
  const prompt = [
    "You are writing ONE git commit message for the uncommitted work in a worktree.",
    "Do NOT use any tools — answer ONLY from the diff/status below, in one single message.",
    'Respond with STRICT JSON only, no markdown fences, exactly: {"message": "<type(scope): summary>"}',
    "- a single line, a lowercase conventional-commit type (feat/fix/chore/refactor/docs/test), <= 80 chars.",
    "", "## shortstat", sh.code === 0 && sh.out ? sh.out : "(none)",
    "", "## per-file stat", stat.code === 0 && stat.out ? stat.out : "(none)",
    "", "## status", st.code === 0 && st.lines.length ? st.lines.join("\n") : "(none)",
    "", "## diff (truncated)", (d.code === 0 ? d.out.slice(0, 30_000) : "") || "(none)",
  ].join("\n");
  let text = COMMIT_CMD
    ? await summaryViaSubprocess(COMMIT_CMD, prompt, cwd)
    : await summaryViaSession(prompt, cwd, '"message"', { extraArgs: TEXT_ONLY_TOOLS });
  try {
    const env = JSON.parse(text) as { result?: unknown };
    if (typeof env.result === "string") text = env.result.trim();
  } catch { /* not an envelope */ }
  const body = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    const j = JSON.parse(body) as { message?: unknown };
    if (typeof j.message === "string" && j.message.trim()) return sanitizeCommitMsg(j.message);
  } catch { /* unparseable → caller falls back */ }
  return "";
}

async function commitLane(s: Slot, mode: "quick" | "agent"): Promise<Response> {
  const cwd = s.cwd!;
  const lane = !!s.worktree;
  const st = await statusLines(cwd); // column-preserving — see statusLines
  if (st.code !== 0) return json({ error: "git status failed — worktree gone?", code: 400 }, 400);
  // CLEAN → idempotent no-op: the session may have committed already
  if (st.lines.length === 0) return json({ committed: false, reason: "nothing to commit — working tree clean" });
  if (await gitOpInProgress(cwd)) return json({ committed: false, reason: "a git merge/rebase is in progress here — finish or abort it in the session first" });
  // never commit onto a detached HEAD — it lands as a dangling commit that land/merge (and
  // the owner) can't see on the branch, so the work looks saved but silently isn't
  const sym = await git(cwd, "symbolic-ref", "-q", "HEAD");
  if (sym.code !== 0) return json({ committed: false, reason: "HEAD is detached — check out a branch in the session before committing" });
  // STAGE FIRST, then describe + commit exactly the staged tree. This freezes what gets
  // committed at click time: an agent-written message (spawned below, seconds later) can no
  // longer describe a tree the live session changed meanwhile, and nothing written after this
  // point is swept in. A LANE is a throwaway branch → `add -A` (untracked included). A MAIN
  // checkout is a branch the owner ships → `add -u` (tracked changes only), so scratch files
  // and un-ignored secrets are never staged behind the owner's back.
  const add = await gitRetry(cwd, "add", lane ? "-A" : "-u");
  if (add.code !== 0) return json({ error: `git add failed: ${add.err.slice(0, 200)}`, code: 500 }, 500);
  // nothing staged (e.g. a main session whose only changes are untracked, excluded by -u)
  if ((await git(cwd, "diff", "--cached", "--quiet")).code === 0)
    return json({ committed: false, reason: lane ? "nothing to commit — working tree clean" : "nothing tracked to commit — only untracked files, which a main-session commit leaves alone" });
  const wip = `wip: saved from Fleet dashboard ${new Date().toISOString()}`;
  let message = wip;
  if (mode === "agent") {
    try {
      const m = await agentCommitMessage(cwd);
      if (m) message = m;
    } catch { /* saving must NEVER fail on the model — keep the wip message */ }
  }
  const ci = await gitRetry(cwd, "commit", "-m", message);
  if (ci.code !== 0) {
    // the session may have committed our staged set out from under us between add and commit
    if ((await git(cwd, "diff", "--cached", "--quiet")).code === 0)
      return json({ committed: false, reason: "nothing staged to commit — already committed?" });
    return json({ error: `git commit failed: ${(ci.err || ci.out).slice(0, 200)}`, code: 500 }, 500);
  }
  const hd = await git(cwd, "rev-parse", "--short", "HEAD");
  return json({ committed: true, hash: hd.code === 0 ? hd.out : "", subject: message });
}

// --- ✨ prompt enhancer: a throwaway background claude session (same machinery as the
// summarizer — subscription, pinned transcript, killed + transcript deleted after) that
// REWRITES the compose-box draft. Contract (panel-verified against 24 real corpus drafts,
// old prompt 14-17/24 major contract violations, this one 1/24): block invariance — every
// semantic part keeps its mode (question stays question, hedge stays hedge, facts/names
// verbatim, deixis untouched); the only allowed delta is ADDITIVE and grounded — a fact
// quoted out of the slot's own git state (briefPayload, passed in as a DATA block) plus
// /sharpen3, and only when the draft contains an actual work order. The enhancer still
// never sees the SESSION, so it never interprets — discipline dosing happens downstream in
// /sharpen3, which runs inside the session and has the context this one lacks. The prompt
// itself lives in enhance-prompt.ts so its invariants are assertable (see fleet-e2e.ts).
const ENHANCE_CMD = process.env.FLEET_ENHANCE_CMD ?? null; // tests: subprocess stand-in
// carve the first balanced {...} object out of a noisy answer, ignoring braces inside
// string literals. The enhancer must return a prompt VERBATIM (never degrade to raw text
// the way the summarizer does — that would dump prose into the compose box), so when the
// real model wraps its JSON in a preamble/trailing line despite the strict-JSON contract,
// we extract rather than 502. Without this, any wrapping fails JSON.parse → red-flash button.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

async function runEnhance(text: string, cwd: string, facts: EnhanceFacts | null): Promise<string> {
  const prompt = buildEnhancePrompt(text, facts);
  let out = ENHANCE_CMD
    ? await summaryViaSubprocess(ENHANCE_CMD, prompt, cwd)
    : await summaryViaSession(prompt, cwd, '"prompt"', { extraArgs: TEXT_ONLY_TOOLS });
  // test stand-in answers in a {"result": …} envelope — unwrap; no-op for real runs
  try {
    const env = JSON.parse(out) as { result?: unknown };
    if (typeof env.result === "string") out = env.result.trim();
  } catch { /* not an envelope */ }
  const body = out.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  let j: { prompt?: unknown };
  try {
    j = JSON.parse(body) as { prompt?: unknown };
  } catch {
    // real model wrapped the JSON in prose/fences — pull the object out before giving up
    const obj = extractJsonObject(out);
    if (!obj) throw new Error("enhancer returned no JSON"); // caller answers 502
    j = JSON.parse(obj) as { prompt?: unknown };
  }
  if (typeof j.prompt !== "string" || !j.prompt.trim()) throw new Error("enhancer returned no prompt");
  return j.prompt.trim();
}

// --- ⏫ merge agent: the third background-claude function (same machinery as the
// summarizer/enhancer — throwaway session, strict JSON contract, killed after), but this
// one WRITES — so its authority is deliberately small: it ONLY rebases the lane onto the
// repo's main branch and resolves conflicts, inside the lane worktree. Every
// state-changing step on the primary checkout (ff-merge, teardown) is done by the SERVER
// afterwards, deterministically, and only after re-verifying the rebase with git itself.
// Tool scoping (docs: code.claude.com/docs/en/permissions): specific `git <subcommand>:*`
// prefixes (never a blanket `git:*` — `git -c core.fsmonitor=cmd`/`git alias.!` are shell
// escapes), Edit/Write limited to the session cwd via (**), and --permission-mode dontAsk
// so anything off-script is auto-DENIED instead of hanging until the timeout. Residual
// (documented, accepted): `git rebase -x <cmd>` can exec — mitigated by the prompt and by
// the untrusted-data delimiting below; the deterministic re-verify bounds what a misled
// agent can make the SERVER do, not what it can run locally.
// Async job (not request-held): a conflictful rebase can outlive any HTTP timeout, so
// POST starts the run and the board's poll reads progress/result via GET.
const MERGE_CMD = process.env.FLEET_MERGE_CMD ?? null; // tests: subprocess stand-in
const MERGE_TIMEOUT_MS = Math.max(60_000, Number(process.env.FLEET_MERGE_TIMEOUT_MS ?? 480_000) | 0);
// Bounded resolver↔verify repair loop (design note §3): when a CONFLICT resolution rebases cleanly
// but the deterministic verify fails, feed the exact failure back to the resolver for up to N repair
// rounds. Clamped 0..3 (0 = disabled, today's one-shot behavior). This NEVER changes what auto-lands
// — the conflict path always stops for human review regardless (mergeJob) — it only improves the
// verify state the human reviews (a repaired-green resolution instead of a dead-ended red one). The
// authority every round is git + a re-run of runVerify, never the agent's word.
const MERGE_REPAIR_ROUNDS = Math.min(3, Math.max(0, Number(process.env.FLEET_MERGE_REPAIR_ROUNDS ?? 2) | 0));
// OPT-IN clean-path advisory reviewer (design note §7). Default OFF → production behaviour is
// byte-for-byte unchanged until the owner sets FLEET_CLEAN_REVIEW. When ON, a reviewer agent looks at
// a clean+green lane about to AUTO-LAND and may ONLY downgrade it to a stop-and-review — never approve
// a land that would not otherwise happen. The auto-land proceeds ONLY on an explicit "ok" verdict;
// every other outcome (review / error / timeout / unparseable / no fork base) fails CLOSED to a stop.
// Third state `shadow` (graduation-criteria.md §2): the reviewer runs on every clean auto-land exactly
// as in gate mode — same prompt, same timeout, same read-only reset — but its verdict NEVER changes the
// outcome; the land proceeds as if the reviewer were off. The verdict is persisted onto the lane's
// outcome row (`cleanReviewShadow`) as the dataset that would justify graduating to gate mode. The
// fail direction is deliberately INVERTED here: nothing is gated, so an errored/unparseable run must
// record "measurement failed" (verdict null, raw true), never a fabricated pass.
const CLEAN_REVIEW_MODE: "off" | "gate" | "shadow" =
  /^shadow$/i.test(process.env.FLEET_CLEAN_REVIEW ?? "") ? "shadow"
  : /^(1|true|on|yes)$/i.test(process.env.FLEET_CLEAN_REVIEW ?? "") ? "gate" : "off";
const CLEAN_REVIEW_CMD = process.env.FLEET_CLEAN_REVIEW_CMD ?? null; // tests: subprocess stand-in
const CLEAN_REVIEW_TIMEOUT_MS = Math.max(30_000, Number(process.env.FLEET_CLEAN_REVIEW_TIMEOUT_MS ?? 180_000) | 0);
// deterministic verify (design note §3): a per-repo command run against the REBASED tree.
// Unset → no verify at all (verdict field absent, "unverified"). e.g. the CLAUDE.md tsc line.
const VERIFY_CMD = process.env.FLEET_VERIFY_CMD ?? null;
const VERIFY_TIMEOUT_MS = Math.max(5_000, Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 120_000) | 0);
const VERIFY_OUT_CAP = 2048; // verify.out is the TAIL of stdout+stderr, byte-capped (~2KB)
// --- the SKIP contract, and the decision behind it -------------------------------------------
// A verify command may be repo-guarded: one FLEET_VERIFY_CMD string serves every repo a lane can
// live in, so it opens by asking "is this the repo I know how to verify?" and declines otherwise
// (watchdog.sh's `[ -f fleet-e2e.ts ] || …`). Declining used to mean `exit 0` — indistinguishable
// from "ran the whole gate, everything passed", so a lane in a foreign repo, OR a fleet lane that
// MOVED fleet-e2e.ts, recorded `verify.ok:true` and auto-landed behind a gate that executed
// nothing (graduation-criteria.md, 2026-07-25 adversarial pass, item 1).
//
// DECISION: a self-declared skip is its own state (`ok: null`) and NEVER auto-lands; "no verify
// command configured at all" (`verify === undefined`) keeps auto-landing exactly as before.
// The two look alike — no gate ran either way — but they differ in WHO decided and on what
// evidence. An unset FLEET_VERIFY_CMD is the OWNER's deployment-wide decision, made once, with
// full knowledge that this fleet has no deterministic gate; the autonomy contract in that
// deployment is "clean rebase = land", and breaking it would turn every lane in every such
// deployment into a stop-and-review for a policy the owner already settled. A skip is decided at
// RUNTIME by the command itself, from a guess about the tree in front of it — and that guess is
// precisely what a moved/renamed sentinel file fools. It cannot be trusted to mean "this tree is
// fine unverified", so it buys no autonomy. The honest cost is real and accepted: until per-repo
// verify config exists (orchestrator-autonomy.md §6.2), a lane in a foreign repo no longer
// auto-lands under a repo-guarded command — it stops for one owner click, with "verify skipped"
// on the row saying why. Both states record `verified: null` in the ledger: neither is evidence.
const VERIFY_SKIP_EXIT = 42; // the command's way of saying "I verified nothing" — reserved, no real gate uses it
// Legacy half of the contract: watchdog.sh's VERIFY_CMD string is baked into the srv-spawn line and
// only reloads on `launchctl kickstart` — a server-only deploy keeps an older, `exit 0`-on-skip
// string running. Honouring the marker line that string already prints closes the hole at the
// server deploy instead of at the owner's next kickstart. Only consulted on exit 0 (a non-zero exit
// is already not a pass), and a false positive can only ever cost an auto-land, never grant one.
const VERIFY_SKIP_MARK = /^verify skipped:/m;
// Layer 1 of the three-layer model (§2): the authority is a SERVER-run fact, never an agent's
// self-assessment. Runs in the lane worktree (cwd), against the rebased tree, after the rebase
// is git-verified and before any land. No command → undefined (field absent, verdict unverified,
// never silently green). Non-zero exit OR timeout → ok:false; a self-declared skip (VERIFY_SKIP_EXIT,
// or the legacy marker at exit 0) → ok:null, which is neither a pass nor a failure but "no
// measurement happened" — same vocabulary as LandFacts.verified and CleanReviewShadow.verdict.
// `mainSha` binds the result to the main the tree was rebased onto — a verdict is void once main
// moves past it (§6 rule 3).
async function runVerify(cwd: string, mainSha: string): Promise<MergeLast["verify"]> {
  if (!VERIFY_CMD) return undefined;
  const p = Bun.spawn(["sh", "-c", VERIFY_CMD], { cwd, stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; try { p.kill(); } catch {} }, VERIFY_TIMEOUT_MS);
  try {
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    const code = await p.exited;
    const combined = timedOut
      ? `${out}${err}\n[verify timed out after ${VERIFY_TIMEOUT_MS}ms]`
      : `${out}${err}`;
    // the failing lines of a build/test log live at its END — keep the tail, not the head
    const tail = combined.length > VERIFY_OUT_CAP ? combined.slice(combined.length - VERIFY_OUT_CAP) : combined;
    // the skip test runs over the FULL output, not the byte-capped tail: a command that declines
    // early and then prints past the cap would otherwise have its own declaration truncated away
    const skipped = !timedOut && (code === VERIFY_SKIP_EXIT || (code === 0 && VERIFY_SKIP_MARK.test(combined)));
    return { cmd: VERIFY_CMD, ok: skipped ? null : !timedOut && code === 0,
      out: tail.trim(), at: Date.now(), mainSha };
  } finally {
    clearTimeout(timer);
  }
}
// --setting-sources "" is load-bearing, not tidiness: --allowedTools is ADDITIVE to the owner's
// ~/.claude/settings.json allow list, where a bare `Read`/`Grep`/`Glob` (no parentheses) means
// EVERY file on the machine. Anchoring the patterns alone is inert — verified empirically: with
// the owner's settings loaded, `Read(**)` still read a canary outside the worktree; with the
// sources dropped the same read comes back "Permission to use Read has been denied". So the
// anchors below only bind because this process no longer inherits that list.
const MERGE_TOOLS = '--setting-sources "" --permission-mode dontAsk --allowedTools '
  + '"Bash(git status:*)" "Bash(git diff:*)" "Bash(git log:*)" "Bash(git add:*)" "Bash(git rm:*)" '
  + '"Bash(git checkout:*)" "Bash(git rebase:*)" "Edit(**)" "Write(**)" "Read(**)" "Grep(**)" "Glob(**)"';
// "resolved" = the agent had to make semantic conflict choices; the rebase is git-verified
// but deliberately NOT landed — it waits for the owner to review the diff and confirm.
// A clean (script) rebase involves no judgment and still goes straight to "merged".
interface MergeLast { status: "merged" | "blocked" | "error" | "resolved";
  detail: string; landed: boolean; branch: string; at: number; conflicted?: string[];
  // deterministic verify result against the rebased tree (design note §3). FOUR states, and the
  // owner-facing surfaces name all four:
  //   field absent      — no FLEET_VERIFY_CMD configured ("unverified", never silently green)
  //   ok: true          — the gate ran and passed
  //   ok: false         — the gate ran and failed (or timed out)
  //   ok: null          — the command declined to verify (VERIFY_SKIP_EXIT / marker): SKIPPED.
  //                       Not a pass, not a failure — nothing was measured. Never auto-lands.
  // `stale` is stamped at confirm-land when main moved past `mainSha` after the verify ran
  // (the verdict is void once main moves past it — marked, not re-run).
  verify?: { cmd: string; ok: boolean | null; out: string; at: number; mainSha: string; stale?: boolean };
  // set when main WAS advanced (the land is recorded — note + undo) but the lane teardown
  // failed afterwards; distinct from `detail` so "landed but not torn down" is machine-readable
  landError?: string;
  // how many bounded resolver↔verify repair rounds ran (conflict path only) before this verdict
  // settled. >0 means the resolution's first verify was RED and the resolver was fed the failure
  // to repair; `verify` above is the FINAL (post-repair) result. Absent/0 = no repair was needed.
  repairRounds?: number;
  // OPT-IN clean-path advisory reviewer verdict (present only when FLEET_CLEAN_REVIEW ran on the clean
  // auto-land path). "review" DOWNGRADED an auto-land to a stop-and-review; "ok" rode along on a land.
  // Advisory FACTS for the human, never a gate — the deterministic verify stays the authority.
  cleanReview?: { verdict: "ok" | "review"; reason: string } }
const mergeInflight = new Map<number, Promise<void>>();
// slots whose merge POST is still in its pre-flight guards: the `has(inflight)` check and
// the `set` are separated by several awaits, so without this SYNCHRONOUS reservation two
// quick POSTs would both start a job — two concurrent `git rebase`s on one worktree
const mergeStart = new Set<number>();
const mergeLast = new Map<number, MergeLast>();

// --- ↩ undo-last-land: the one reversible pointer for the one action that mutates main.
// On every land that ADVANCED the integration branch we record where main was before and
// after, keyed by repo (last land per repo). Undo is git-gated (see /api/repos/undo-land):
// it resets main back to mainBefore ONLY while main is still exactly at mainAfter and that
// commit has not reached any remote — otherwise it refuses. The landed branch is kept by
// land, so a reset leaves the work fully recoverable by reopening the lane.
interface LandRecord { repo: string; main: string; branch: string; mainBefore: string; mainAfter: string; at: number }
const undoLast = new Map<string, LandRecord>(); // repo toplevel -> its most recent undoable land
// what the board needs to show/hide the undo button for a lane's repo — nulled once undone
function undoableFor(repo: string): { branch: string; at: number } | null {
  const r = undoLast.get(repo);
  return r ? { branch: r.branch, at: r.at } : null;
}
// --- provenance note (design note §4, "own your work"): on every land that MOVES main, the
// SERVER — the trusted writer — attaches the review story to the landed tip as a git note
// under refs/notes/fleet/land, IN THE REPO. Server-authored ONLY: §4 rejects the agent-
// written commit-message variant (it puts UNTRUSTED claims into permanent history, authored
// before verify even exists, and would force the resolver to rewrite commits mid-rebase).
// Best-effort by contract: a note-write failure NEVER fails the land (landing is the job,
// provenance is best-effort) — it is audited and swallowed. Notes alter no SHAs and dirty
// no tree, so they can neither break an ancestry gate nor block a land. Notes are never
// deleted: undo-land keeps the note as the record THAT the land happened. `add -f` overwrites
// only when the SAME tip is landed twice (e.g. undo-land then re-land of identical work onto
// the same main tip); a re-opened branch re-landed onto a NEW tip gets a fresh note there.
// Not pushed by default (fleet is local-first) — read with `git log --notes=fleet/land`.
interface LandProvenance {
  conflicted?: string[];
  resolverDetail?: string;
  verify?: MergeLast["verify"];
  confirmedByHuman: boolean;
}
async function writeLandNote(repo: string, branch: string, mainBefore: string, mainAfter: string, prov: LandProvenance): Promise<void> {
  const tip = mainAfter; // the fast-forwarded integration branch IS the landed commit
  try {
    const note = {
      branch, mainBefore, mainAfter,
      ...(prov.conflicted && prov.conflicted.length ? { conflicted: prov.conflicted } : {}),
      ...(prov.resolverDetail ? { resolverDetail: prov.resolverDetail } : {}),
      ...(prov.verify ? { verify: prov.verify } : {}),
      confirmedByHuman: prov.confirmedByHuman,
      at: Date.now(),
    };
    const r = await git(repo, "notes", "--ref=fleet/land", "add", "-f", "-m", JSON.stringify(note), tip);
    if (r.code !== 0) audit("land_note_fail", undefined, `${basename(repo)} ${branch} ${tip.slice(0, 8)}: ${r.err.slice(0, 200)}`);
  } catch (e) {
    audit("land_note_fail", undefined, `${basename(repo)} ${branch}: ${e instanceof Error ? e.message : "note write threw"}`.slice(0, 240));
  }
}
// record a land that moved main. Skipped when main did not advance (already-merged lands),
// where mainBefore === mainAfter and an "undo" would be a no-op — those paths also write no
// provenance note (no advance = no integration-history event to attach the story to).
async function recordLand(repo: string, main: string, branch: string, mainBefore: string, mainAfter: string, prov: LandProvenance): Promise<void> {
  if (!mainBefore || !mainAfter || mainBefore === mainAfter) return;
  undoLast.set(repo, { repo, main, branch, mainBefore, mainAfter, at: Date.now() });
  saveState(); // the undo record is persisted state — persist it AT the main-move, so it
  // survives a restart even when a downstream saveState is skipped (e.g. the mergeJob tail's
  // recycle guard on the slot-recycled teardown-failure sub-case).
  await writeLandNote(repo, branch, mainBefore, mainAfter, prov); // best-effort — never throws
  // VERIFICATION TIER 2 — main moved, so there is something new on the integration branch that the
  // fast land gate did not fully check. This is the one choke point every main-MOVING land funnels
  // through (mergeJob's clean auto-land + the confirm-land route), which is exactly the right
  // trigger: a land that did not move main (already-merged / empty lane) integrates nothing new and
  // has nothing to audit. Synchronous by contract — it queues and returns before any await, so the
  // land path's latency is unchanged. See the region below for what it deliberately does NOT do.
  schedulePostLandAudit(repo, main, branch, mainAfter);
}

// --- VERIFICATION TIER 2: the post-land audit (gate-coverage.md §5, autonomy-plan.md Gap 2) -----
// The land gate is fast and PARTIAL by design (tsc + the 26 claudeAlive checks of
// e2e-claude-gate.sh). The tiered design always named a second half — run the FULL suite after the
// land, against the integration branch, off the land path, with ↩ undo-land as the rollback — and
// only the fast tier was ever built. Autonomous landing has no hand to run the suite by hand. This
// is that hand.
//
// WHAT IT DOES NOT DO — the decision, stated at the decision site:
//   · it does not gate. Nothing waits for it; no land, merge, dispatch or review path reads its
//     result. It cannot stop a land (the land already happened) and cannot delay one.
//   · it does not auto-undo. A machine that both lands AND un-lands unattended moves main in two
//     directions with no human in either — a strictly bigger step than "make the slow tier run at
//     all", and not this one. Rollback stays the owner's ↩ undo-land (/api/repos/undo-land).
//   · it does not block the server. One detached child, bounded, in a scratch dir outside the repo.
// It records a fact and surfaces it. That is the whole job.
//
// DEFAULT OFF — `FLEET_POSTLAND_AUDIT_CMD` unset means tier 2 does not exist, and the land path is
// byte-for-byte what it is today. Same shape and same reasoning as FLEET_VERIFY_CMD, where the
// command IS the flag: (a) turning it on is a deployment decision the owner makes once, in
// watchdog.sh's srv-spawn line, with full knowledge of what a full suite costs on this box;
// (b) the stand-in hook every harness needs is the same knob — a harness points it at a fake
// script, and a harness that sets NOTHING can never launch a real nested suite by accident, which
// is the property that matters most for a feature whose payload is "boot a server and run 705
// checks"; (c) the server keeps no fleet-specific knowledge — `./e2e-isolated.sh` is the owner's
// command, not a default compiled into the server.
const POSTLAND_AUDIT_CMD = process.env.FLEET_POSTLAND_AUDIT_CMD ?? null;
// Generous on purpose: the suite this tier exists to run takes minutes, and NOTHING waits on it —
// the only cost of a long ceiling is a late row. A timeout is a failed MEASUREMENT (unknown), not
// a failure — see the classification below.
const POSTLAND_AUDIT_TIMEOUT_MS = Math.max(10_000, Number(process.env.FLEET_POSTLAND_AUDIT_TIMEOUT_MS ?? 1_800_000) | 0);
const POSTLAND_AUDIT_OUT_CAP = 4096; // tail of stdout+stderr, byte-capped like verify.out
const POSTLAND_AUDIT_KILL_GRACE_MS = 5_000; // SIGTERM → this long → SIGKILL, on the timeout path
// the lands one audit run followed — a run is coalesced (below), so it can cover more than one
interface AuditCover { branch: string; mainAfter: string; at: number }
// The durable row. `mainSha` is the integration tip actually audited and `covers` names every land
// since the previous run, so the two questions this tier exists to answer are plain joins over the
// trail: "which land was the last GREEN audit" = the newest green row's covers/mainSha, and "which
// lands came after a RED one" = every cover in every row after that red row (plus the red row's own).
// `result` is TRI-STATE, and the third state is load-bearing (A4, unknown ≠ zero): an audit that
// timed out, could not be started, or declined to run is `unknown` — never green, and never red
// either (a failed measurement is not evidence of a defect).
interface PostLandAuditRow {
  at: number;          // when the run finished (row time)
  startedAt: number;
  ms: number;
  repo: string;        // git toplevel — joins to the LandRecord / the fleet/land note's repo
  main: string;        // integration branch name
  mainSha: string;     // the tip the audit actually ran against — joins to a note's `mainAfter`
  result: "green" | "red" | "unknown";
  reason?: string;     // present on `unknown` only: WHY no measurement happened
  cmd: string;
  exitCode: number | null;
  out: string;         // byte-capped TAIL of stdout+stderr (the failing lines of a suite are at its end)
  covers: AuditCover[];
}
// the newest row, for the board. In memory for the poll path, but REHYDRATED from the trail at boot
// (see the boot block): a red audit is typically followed within minutes by the deploy that restarts
// srv, and an alarm that a restart erases is not an alarm.
let lastPostLandAudit: PostLandAuditRow | null = null;
// pending work, per repo. `auditDraining` is the ONE-AT-A-TIME lock: a second land while a suite
// runs never spawns a second suite — it appends to this queue and the drain loop picks it up when
// the current run finishes.
const auditQueue = new Map<string, { main: string; covers: AuditCover[] }>();
let auditDraining = false;
// COALESCED, not per-land. Three lands arrived within ~110s on 2026-07-25; running three full
// suites back to back would cost ~3× the machine for strictly less information, because the suite
// is a property of a TREE, not of a diff — auditing the newest tip subsumes every land folded into
// it. So: the run in flight is never interrupted, everything that lands while it runs is folded
// into exactly ONE follow-up run against the then-current tip, and that run's `covers` names every
// land it stands for. Nothing is silently dropped: a land is either covered by the run in flight's
// successor or by the run it triggered.
function schedulePostLandAudit(repo: string, main: string, branch: string, mainAfter: string): void {
  if (!POSTLAND_AUDIT_CMD) return; // tier 2 not configured — this is today's behaviour, unchanged
  const q = auditQueue.get(repo) ?? { main, covers: [] };
  q.main = main;
  q.covers.push({ branch, mainAfter, at: Date.now() });
  auditQueue.set(repo, q);
  if (auditDraining) return; // the loop below will pick this up — never a second concurrent suite
  auditDraining = true;
  void drainPostLandAudits();
}
async function drainPostLandAudits(): Promise<void> {
  try {
    // one repo at a time, and one run at a time across ALL repos: the audit's payload boots a server
    // and drives tmux, so parallelism here buys latency and pays in load and cross-talk.
    while (auditQueue.size) {
      const [repo, q] = [...auditQueue.entries()][0];
      auditQueue.delete(repo);
      await runPostLandAudit(repo, q.main, q.covers); // never throws — every failure is a row
    }
  } finally {
    // released INSIDE the loop's own frame, not from a `.finally` on the caller: a microtask
    // queued between "the queue looked empty" and "the flag went false" would enqueue a land that
    // nothing would ever drain, and that land's audit would simply never happen. Here no other
    // microtask can interleave — the loop's failing condition and this line are one turn.
    auditDraining = false;
  }
}
// The audit runs against a CONTENT SNAPSHOT of the integration tip, extracted with `git archive`
// into a scratch dir outside the repo. Three reasons this rather than a git worktree:
//   · it is exactly the landed tree, not the primary checkout's working copy (which may carry
//     uncommitted work, or be parked on another branch entirely);
//   · it touches no working tree of the repo — the primary checkout is only ever READ;
//   · it registers nothing with git. A `worktree add` would show up in `git worktree list`, which
//     the lane map, the orphan surfaces and advanceIntegration all read — a crashed audit would
//     leave visible fleet-wide state behind. A stray directory in TMPDIR is inert.
// The cost, stated: the snapshot is a tree, not a repository, so an audit command that needs git
// HISTORY cannot run here. `./e2e-isolated.sh` does not — it copies files and builds its own
// throwaway repo (verified 2026-07-25).
async function snapshotIntegrationTree(repo: string, sha: string, dir: string): Promise<string | null> {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    return `could not create the audit scratch dir: ${e instanceof Error ? e.message : "mkdir failed"}`;
  }
  // sequential `&&`, not a pipe: a pipeline's exit status is the LAST command's, so a failing
  // `git archive` feeding a happy `tar` would report success over an empty tree. Positional args
  // ($1..$3), never interpolation — repo paths carry spaces.
  const script = 'git -C "$1" archive --format=tar "$2" > "$3/.fleet-audit.tar"'
    + ' && tar -xf "$3/.fleet-audit.tar" -C "$3" && rm -f "$3/.fleet-audit.tar"';
  const p = Bun.spawn(["sh", "-c", script, "sh", repo, sha, dir], { stdout: "pipe", stderr: "pipe" });
  const err = await new Response(p.stderr).text();
  await new Response(p.stdout).text();
  if ((await p.exited) !== 0) return `git archive/extract failed: ${err.trim().slice(0, 200)}`;
  // installed dependencies are not tracked content, and re-installing per audit would dominate the
  // run. Link the repo's own node_modules in, exactly as e2e-isolated.sh does for its copy. Removed
  // as a LINK before the scratch dir is deleted, so the repo's real tree is never in reach of the rm.
  try {
    if (existsSync(`${repo}/node_modules`) && !existsSync(`${dir}/node_modules`))
      symlinkSync(`${repo}/node_modules`, `${dir}/node_modules`);
  } catch { /* no deps to link — the command decides whether it can run without them */ }
  return null;
}
// The child's environment is the server's, minus EVERY `FLEET_*` variable. Not a list of known-bad
// names — a rule, because the payload of this command is "boot another fleet server", and every
// knob this one was configured with is wrong for that one:
//   · FLEET_POSTLAND_AUDIT_CMD would make the inner server audit its OWN lands, recursively,
//     forever. One level deep by construction, not by the command's good manners.
//   · the credentials (owner token, the scoped per-lane and steward tokens) must not reach it, for
//     the same reason e2e-isolated.sh unsets them: tmux bakes its server's env into every pane.
//   · the production BEHAVIOUR knobs are the subtle one. The live srv runs with
//     FLEET_CLEAN_REVIEW=shadow and a real FLEET_VERIFY_CMD; e2e-isolated.sh overrides much of the
//     env but not all of it, so an inherited `shadow` (with no stand-in reviewer configured) would
//     have the nested suite spawn REAL model sessions on every clean land inside the audit.
// The one thing this rule does NOT buy is socket safety: dropping FLEET_SOCK/FLEET_PORT lands the
// inner server on the server's own DEFAULTS, which are the live socket and the live port. That is
// equally true if they were inherited, so it is stated rather than faked — THE AUDIT COMMAND OWNS
// ITS ISOLATION. ./e2e-isolated.sh derives socket, port and scratch dir from `$$` and sets all
// three explicitly on the inner server (verified first-hand 2026-07-25), so concurrent runs cannot
// collide and none of them can reach socket `claudefleet`.
function auditChildEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (typeof v === "string" && !k.startsWith("FLEET_")) env[k] = v;
  return env;
}
async function runPostLandAudit(repo: string, main: string, covers: AuditCover[]): Promise<void> {
  const cmd = POSTLAND_AUDIT_CMD;
  if (!cmd) return;
  const startedAt = Date.now();
  const dir = `${tmpdir()}/fleet-postland-audit-${randomBytes(6).toString("hex")}`;
  let mainSha = "";
  let result: PostLandAuditRow["result"] = "unknown";
  let reason: string | undefined = "audit did not run";
  let exitCode: number | null = null;
  let out = "";
  try {
    // the CURRENT tip, not the triggering land's mainAfter: coalescing means this run stands for
    // every land folded into it, and the row must name the tree it actually measured.
    const tip = await git(repo, "rev-parse", main);
    mainSha = tip.code === 0 && tip.out ? tip.out : (covers[covers.length - 1]?.mainAfter ?? "");
    if (!mainSha) {
      reason = `could not resolve ${main} — nothing to audit`;
    } else {
      const snapErr = await snapshotIntegrationTree(repo, mainSha, dir);
      if (snapErr) {
        reason = snapErr;
      } else {
        const p = Bun.spawn(["sh", "-c", cmd], { cwd: dir, env: auditChildEnv(), stdin: "ignore", stdout: "pipe", stderr: "pipe" });
        // Read the pipes as PROMISES and race the EXIT against the deadline — never `await` the
        // streams first. A suite is a process TREE (it boots a server, drives tmux), and the pipe's
        // write end stays open while any descendant holds it: awaiting the text of a wedged child
        // would hang this function forever, which would also stall the drain loop and silently kill
        // tier 2 for every later land. Bounded by construction instead. (runVerify can await its
        // streams — it holds a land, so something upstream always notices.)
        const outP = new Response(p.stdout).text().catch(() => "");
        const errP = new Response(p.stderr).text().catch(() => "");
        let timedOut = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<"timeout">((res) => {
          timer = setTimeout(() => { timedOut = true; res("timeout"); }, POSTLAND_AUDIT_TIMEOUT_MS);
        });
        try {
          const settled = await Promise.race([p.exited, deadline]);
          if (settled === "timeout") {
            // SIGTERM, then SIGKILL after a grace period: a shell blocked in `wait` acts on the term
            // only once its foreground child returns. Residual, stated honestly: grandchildren can
            // still outlive both signals, so a timed-out audit may leave its own throwaway tmux
            // socket behind — a scratch resource on the owner's box, and the reason the ceiling is
            // generous rather than tight. What is NOT residual is the server: it stops waiting here.
            try { p.kill(); } catch { /* already gone */ }
            setTimeout(() => { try { p.kill(9); } catch { /* already gone */ } }, POSTLAND_AUDIT_KILL_GRACE_MS);
          } else {
            exitCode = settled;
          }
          // best-effort output, bounded: on a timeout the pipes may never close, so give them a
          // moment and take what came out rather than waiting on a process we just killed
          const grab = (pr: Promise<string>): Promise<string> =>
            timedOut ? Promise.race([pr, Bun.sleep(1000).then(() => "")]) : pr;
          const combined = `${await grab(outP)}${await grab(errP)}`;
          out = (combined.length > POSTLAND_AUDIT_OUT_CAP ? combined.slice(combined.length - POSTLAND_AUDIT_OUT_CAP) : combined).trim();
          // CLASSIFICATION. The fail direction here is the INVERSE of runVerify's, and deliberately:
          // runVerify gates a land, so its timeout must read as "do not land" (red). This gates
          // nothing, so its failure modes must read as "no measurement happened" (unknown) — a
          // fabricated red would send the owner hunting a defect that was never observed, and a
          // fabricated green would be the one thing A4 forbids.
          // 126/127 are the shell's "could not execute / not found": a command that never ran is a
          // non-measurement, not a failing suite. A real suite reports its failures with its own code.
          if (timedOut) { reason = `audit timed out after ${POSTLAND_AUDIT_TIMEOUT_MS}ms — no verdict`; }
          else if (exitCode === VERIFY_SKIP_EXIT) { reason = `the audit command declined to run (exit ${VERIFY_SKIP_EXIT})`; }
          else if (exitCode === 126 || exitCode === 127) { reason = `the audit command could not be started (exit ${exitCode})`; }
          else if (exitCode === 0) { result = "green"; reason = undefined; }
          else { result = "red"; reason = undefined; }
        } finally {
          clearTimeout(timer);
        }
      }
    }
  } catch (e) {
    reason = `audit could not run: ${e instanceof Error ? e.message : "spawn failed"}`.slice(0, 200);
  } finally {
    // unlink the LINK first (an rm -rf that followed it would be standing in the repo's node_modules)
    try { rmSync(`${dir}/node_modules`, { force: true }); } catch { /* never existed */ }
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* leave the scratch dir; it is inert */ }
  }
  const row: PostLandAuditRow = {
    at: Date.now(), startedAt, ms: Date.now() - startedAt,
    repo, main, mainSha, result, ...(reason ? { reason } : {}),
    cmd, exitCode, out, covers,
  };
  lastPostLandAudit = row;
  appendEvent(POSTLAND_AUDIT_FILE, row as unknown as Record<string, unknown>);
  const named = covers.map((c) => c.branch).join(", ").slice(0, 120);
  audit("postland_audit", undefined,
    `${result} ${basename(repo)} ${main}@${mainSha.slice(0, 8)} after ${named}${reason ? ` — ${reason}` : ""}`.slice(0, 240));
  // a non-green audit is the alarm this tier exists to raise: loud in the server log, on the audit
  // trail, on its own durable trail, and on the board's poll payload — and it always NAMES the
  // land(s) it followed, because "something is red" without "after which land" is not actionable.
  if (result !== "green")
    console.log(`POST-LAND AUDIT ${result.toUpperCase()}: ${main}@${mainSha.slice(0, 8)} in ${basename(repo)} after landing ${named}`
      + `${reason ? ` (${reason})` : ""} — this audit gates nothing; ↩ undo-land is the rollback.`);
}
// the compact projection the board polls (the full row, minus the byte-heavy suite output — that
// lives on the trail at /api/post-land-audits)
function postLandAuditSummary(): Record<string, unknown> | null {
  const r = lastPostLandAudit;
  return r ? { at: r.at, ms: r.ms, result: r.result, repo: basename(r.repo), main: r.main,
    mainSha: r.mainSha, covers: r.covers.map((c) => c.branch), ...(r.reason ? { reason: r.reason } : {}) } : null;
}

// --- per-lane attributed-outcome RECORDER. Appends ONE server-stamped fact at each of a lane's
// terminal events (land / kill / shelve / revert), so the fleet can eventually learn which
// model + brief + task-class produces landable work — from REAL lanes, not a synthetic eval set.
// Deliberately a RECORDER: it never ranks, gates, promotes, or renders a verdict; analysis is a
// LATER, higher-volume consumer. Every field is assembled SERVER-SIDE from git + slot state, so a
// pane/client can never write into this trail (same choke-point stance as audit + the prompt log).
// The fingerprint (shortstat/commitCount/filesTouched/e2eTouched) reuses briefPayload's base...HEAD
// footprint computation — it doubles as the DIFFICULTY proxy that later makes cross-lane
// comparison valid. model + briefHash are recorded as an ENTANGLED pair (a strong brief lets a
// weak model succeed): never attribute an outcome to the model alone.
type LaneDisposition = "landed" | "reverted" | "shelved" | "killed-dirty" | "killed-empty";
// what ③ said about this lane, AND whether it described the diff that reached the terminal event
// (docs/perception-layer.md §5). The relation is CONTENT identity, not commit identity: the land
// path rebases the lane onto main before the ff-merge, so on a clean land the reviewed commit is
// never the landed commit even though the diff is byte-identical. Comparing shas/cache keys would
// mark those reviews stale — chronically, and hardest under the parallelism this layer is for.
// So both sides are `git patch-id --stable` over the lane's own diff:
//   covered    — same content: the review described what landed, rebase or not
//   superseded — a review exists but the content moved (or cannot be shown identical): honest,
//                and never presented as coverage
//   inflight   — a review was running when this lane ended: NOT captured. Recorded as its own
//                answer rather than awaited (a land must not block up to REVIEW_TIMEOUT_MS on an
//                advisory agent) and rather than silently collapsed into "none"
//   none       — no review on record for this lane at all
// A UNION, not an optional field: findings are unreachable without the word that says what they
// covered, and "we know nothing covered this" is an ANSWER that is always present. Same discipline
// as LandFacts.verified — the un-covered case is unreachable by construction, not guarded, so no
// `??` can ever resolve it to something older.
// `scope`/`notes`/`raw` ride along with the findings and are NOT decoration (discrepancy-audit F5):
// `runReview` fails soft, so an off-contract answer — prose, an error, a refusal — keeps `raw: true`
// and puts the model's text in `notes` while `findings` stays empty. Persisting findings alone made
// that byte-identical to a real clean review, i.e. every reviewer FAILURE was recorded as coverage.
// `scope` is the second half: it is what distinguishes a review of the lane's own diff from the
// fallback "uncommitted changes plus recent commits (no lane base to diff against)" — a review of a
// different subject. A reader cannot honour perception-layer.md §6 ("empty findings ≠ clean")
// without all three, and rows written before this existed carry none of them: they are ambiguous
// forever, which is exactly what the feed renders them as.
type OutcomeReview =
  | { state: "none" | "inflight" }
  | { state: "covered" | "superseded"; at: number; model: string; head: string | null;
      dirty: number; patchId: string | null; landedPatchId: string | null;
      scope: string; notes: string; raw: boolean; findings: ReviewFinding[] };
interface LaneOutcome {
  ts: number;
  branch: string | null;
  base: string | null;   // the lane's fork point (base branch tip when forked)
  headSha: string | null;
  disposition: LaneDisposition;
  model: string | null;  // s.model, or null when unpinned — recorded honestly, NEVER guessed
  briefHash: string | null; // stable short hash of the lane's FIRST owner prompt (the brief)
  shortstat: string;
  commitCount: number;
  filesTouched: string[];
  e2eTouched: boolean;   // did filesTouched include an e2e / test file
  verified: boolean | null; // the merge verify verdict (ok) if one is on record, else null
  sessionMs: number | null; // attention-cost proxy: terminal ts - session start
  ownerPrompts: number;     // attention-cost proxy: owner-sourced prompts sent to this lane
  // --- land-shape facts (the autonomy-calibration signal): meaningful ONLY on disposition:"landed".
  // They answer "which KINDS of land get reverted?" — the exact question a graded auto-land gate needs.
  // For every non-landed disposition (killed/shelved/reverted) they are the honest n/a defaults
  // (false/0/false); a `reverted` record joins back to its `landed` record BY BRANCH to recover them.
  resolvedConflict: boolean; // did an agent resolve conflicts (vs a clean rebase git replayed itself)?
  repairRounds: number;      // bounded resolver↔verify repair rounds that ran before this landed (0 = none)
  confirmedByHuman: boolean; // did the owner confirm-land it (true) or did it auto-land clean+green (false)?
  review: OutcomeReview;     // what ③ said + whether it described THIS diff (never one without the other)
  // FLEET_CLEAN_REVIEW=shadow only: what the ② clean-path reviewer WOULD have said about this land,
  // recorded while gating nothing. Absent = shadow did not run for this row (off/gate mode, or any
  // disposition other than a clean auto-land). Absence is a non-measurement, never a pass.
  cleanReviewShadow?: CleanReviewShadow;
}
// `verdict: null` + `raw: true` = the reviewer produced no explicit verdict (error/timeout/unparseable
// /no fork base) — the measurement failed. A "pass" is only ever an explicit {"verdict":"ok"}.
// `rawAnswer` rides along on `raw: true` rows ONLY — the reviewer's own answer text (post-envelope,
// truncated), so a contract-miss is diagnosable from the journal instead of leaving a generic note
// behind. Present-and-empty is itself the diagnosis ("no answer at all": timeout/spawn failure/no
// fork base); absent means the row is not a failed measurement, so healthy rows carry no bloat.
type CleanReviewShadow = { verdict: "pass" | "would_stop" | null; at: number; model: string;
  notes: string; raw: boolean; rawAnswer?: string };
// how much of a contract-missing answer is kept on the outcome row — enough to see the shape that
// broke, bounded so one bad reviewer run can't bloat the journal.
const SHADOW_RAW_ANSWER_MAX = 2000;
// the land-shape facts a caller hands to buildLaneOutcome for a "landed" record. Assembled at the
// land SITE (not read from the mutable mergeLast map, which the verdict-write races) so each fact is
// exactly what that path knows: the clean auto-land is {false,0,false}; a confirm-land carries the
// reviewed verdict's conflict + repairRounds and confirmedByHuman:true. `verified` rides along for
// the same reason: on the clean path the merge route DELETES the mergeLast entry before the job
// starts and only writes the verdict after landLane returns, so reading the map here always misses.
// null = this path genuinely ran no verify — never invented as false. It is REQUIRED, not optional,
// precisely so no land can fall through to the mergeLast read this type exists to replace: an
// optional field would have to be distinguished from an explicit null, and `??` cannot do that —
// "we know no verify ran" would silently resolve to a PREVIOUS run's verdict (the ⏏ land route
// never clears mergeLast, so a stale green sits there). Required field ⇒ the fallback is
// unreachable from a land by construction, not by luck. `baseSha` likewise carries what only the
// land site knows: a land that REBASED the lane moved its fork point onto the main it was rebased
// on, so the creation-time fork would over-count main's own commits into the lane's footprint.
type LandFacts = { resolvedConflict: boolean; repairRounds: number; confirmedByHuman: boolean;
  verified: boolean | null; baseSha?: string;
  // set ONLY by the clean auto-land site under FLEET_CLEAN_REVIEW=shadow — the powerless verdict this
  // land ignored. Optional because every other land path genuinely has no such measurement.
  cleanReviewShadow?: CleanReviewShadow };
const NO_LAND_FACTS: LandFacts = { resolvedConflict: false, repairRounds: 0, confirmedByHuman: false, verified: null };
// owner clicked ⏏ on already-integrated work (already-merged, or an empty/hand-merged lane): a human
// owned the land, but no agent resolved a conflict, no repair ran, and NO verify ran for this land —
// whatever verdict an earlier merge run left on the slot did not verify what is landing here.
const OWNER_LAND_FACTS: LandFacts = { resolvedConflict: false, repairRounds: 0, confirmedByHuman: true, verified: null };
// e2e/test filename heuristic (the difficulty signal "this lane touched the safety net")
function isTestPath(p: string): boolean {
  return /(^|\/)tests?\//i.test(p) || /(e2e|\.test\.|\.spec\.|_test\.|-test\.)/i.test(p);
}
// owner-sourced prompt count + first prompt for a lane, read from the durable prompt journal —
// the only record carrying a `source` tag. Keyed by the lane's UNIQUE worktree cwd, which bounds
// it to this lane without needing the transcript's session-start time. Best-effort: any read/parse
// failure yields zeros, never a thrown terminal event.
async function laneOwnerPrompts(cwd: string): Promise<{ count: number; firstText: string | null }> {
  try {
    if (!existsSync(PROMPT_LOG)) return { count: 0, firstText: null };
    const text = await Bun.file(PROMPT_LOG).text();
    let count = 0;
    let firstText: string | null = null;
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const p = JSON.parse(line) as { cwd?: unknown; source?: unknown; text?: unknown };
        if (p.source === "owner" && p.cwd === cwd) {
          count++;
          if (firstText === null && typeof p.text === "string") firstText = p.text;
        }
      } catch { /* torn mid-append line — skip */ }
    }
    return { count, firstText };
  } catch {
    return { count: 0, firstText: null };
  }
}
// the review on record for a lane at its terminal event, with the staleness relation resolved
// against the tree AS IT IS NOW. Read-only and never awaited-on: a review still inflight (the
// owner clicked ③ seconds ago) contributes nothing rather than delaying a land — "none" then is
// the honest answer, and the next state change is not this row's business.
async function outcomeReview(s: Slot, cwd: string, base: string | null): Promise<OutcomeReview> {
  const cached = reviewCache.get(s.id);
  // a review still running when the lane ends is stated as such — never awaited (that would put an
  // advisory agent on the land path's critical section) and never rounded down to "none"
  if (!cached) return { state: reviewInflight.has(s.id) ? "inflight" : "none" };
  const { result } = cached;
  // `base` is the outcome record's own fork point — after a rebase-land that is the commit the
  // lane was replayed onto, so this diff is the lane's OWN work in both cases and the two ids are
  // comparable. Two nulls are not a match: unprovable coverage is superseded, never covered.
  let landedPatchId: string | null = null;
  if (base) {
    const cd = await git(cwd, "diff", "--no-color", `${base}...HEAD`);
    const ud = await git(cwd, "diff", "HEAD", "--no-color");
    if (cd.code === 0) landedPatchId = await patchIdOf(cwd, cd.out, ud.code === 0 ? ud.out : "");
  }
  return {
    state: result.patchId !== null && result.patchId === landedPatchId ? "covered" : "superseded",
    at: result.at, model: result.model, head: result.head, dirty: result.dirty,
    patchId: result.patchId, landedPatchId,
    scope: result.scope, notes: result.notes, raw: result.raw, findings: result.findings,
  };
}
function briefHashOf(text: string | null): string | null {
  return text ? createHash("sha256").update(text).digest("hex").slice(0, 12) : null;
}
// assemble a lane's outcome from git + slot state, at a live-lane terminal event. `kind` "killed"
// resolves to killed-dirty (HAD commits — real work abandoned) vs killed-empty (no commits) from
// the commit count itself. Must be called while s.cwd/s.worktree are still set AND, for a land,
// BEFORE the worktree is removed (git reads need the tree). Returns null for a non-lane slot.
async function buildLaneOutcome(s: Slot, kind: "landed" | "shelved" | "killed", facts: LandFacts = NO_LAND_FACTS): Promise<LaneOutcome | null> {
  if (!s.cwd || !s.worktree) return null;
  const cwd = s.cwd;
  // the fork point as a COMMIT: handed over by the land site when a rebase moved it, else the one
  // captured when the lane was created/attached. Never the base NAME on a land — by record time
  // main has already been advanced onto this lane, so the name's merge-base is HEAD itself and
  // every fingerprint field below computes to zero. A lane forked before baseSha existed has
  // neither → fall back to the name (unchanged behaviour).
  const base = facts.baseSha ?? s.worktree.baseSha ?? await laneBaseRef(s);
  const head = await git(cwd, "rev-parse", "HEAD");
  const headSha = head.code === 0 ? head.out : null;
  let shortstat = "";
  let commitCount = 0;
  let filesTouched: string[] = [];
  if (base) {
    // same refs briefPayload uses: three-dot (base...HEAD) footprint so a lane behind main shows
    // only ITS OWN changes; two-dot (base..HEAD) for the lane's own commit count.
    const sh = await git(cwd, "diff", `${base}...HEAD`, "--shortstat", "--no-color");
    shortstat = sh.code === 0 ? sh.out : "";
    const cc = await git(cwd, "rev-list", "--count", `${base}..HEAD`);
    commitCount = cc.code === 0 ? Number(cc.out) || 0 : 0;
    const nm = await git(cwd, "diff", "--name-only", "--no-color", `${base}...HEAD`);
    filesTouched = nm.code === 0 ? nm.out.split("\n").filter(Boolean).slice(0, 200) : [];
  }
  const disposition: LaneDisposition = kind === "killed"
    ? (commitCount > 0 ? "killed-dirty" : "killed-empty")
    : kind;
  const start = sessionStart(s);
  const ts = Date.now();
  const { count: ownerPrompts, firstText } = await laneOwnerPrompts(cwd);
  const review = await outcomeReview(s, cwd, base);
  return {
    ts,
    branch: s.worktree.branch,
    base,
    headSha,
    disposition,
    model: s.model ?? null,
    briefHash: briefHashOf(firstText),
    shortstat,
    commitCount,
    filesTouched,
    e2eTouched: filesTouched.some(isTestPath),
    // a LAND states this fact itself (see LandFacts) — never the mergeLast read, which can hold a
    // previous run's verdict. Only a kill/shelve, which has no land site to state it, reports
    // whatever verdict is still on record for the slot, exactly as before. Branching on `kind`, not
    // on the value: an explicit null from a land is an ANSWER ("no verify ran"), not a missing fact.
    // A SKIPPED verify (verify.ok === null) collapses into the same null here, and correctly so:
    // the ledger's question is "was this verified", and a skip's answer is no. Which flavour of
    // "no" it was — no command configured, or a command that declined — stays on the merge verdict.
    verified: kind === "landed" ? facts.verified : mergeLast.get(s.id)?.verify?.ok ?? null,
    sessionMs: start !== null ? ts - start : null,
    ownerPrompts,
    resolvedConflict: facts.resolvedConflict,
    repairRounds: facts.repairRounds,
    confirmedByHuman: facts.confirmedByHuman,
    review,
    // only a land carries a shadow verdict, and only the clean auto-land site states it
    ...(kind === "landed" && facts.cleanReviewShadow ? { cleanReviewShadow: facts.cleanReviewShadow } : {}),
  };
}
// the reverted case has no live slot (the lane landed and was torn down) — assemble from the repo
// and the undo record. The landed work is exactly mainBefore..mainAfter on the integration branch.
// model/briefHash/session proxies are unknowable server-side here → recorded honestly as null/0.
async function buildRevertedOutcome(repo: string, rec: LandRecord): Promise<LaneOutcome> {
  const sh = await git(repo, "diff", `${rec.mainBefore}...${rec.mainAfter}`, "--shortstat", "--no-color");
  const cc = await git(repo, "rev-list", "--count", `${rec.mainBefore}..${rec.mainAfter}`);
  const nm = await git(repo, "diff", "--name-only", "--no-color", `${rec.mainBefore}...${rec.mainAfter}`);
  const filesTouched = nm.code === 0 ? nm.out.split("\n").filter(Boolean).slice(0, 200) : [];
  return {
    ts: Date.now(),
    branch: rec.branch,
    base: rec.mainBefore,
    headSha: rec.mainAfter,
    disposition: "reverted",
    model: null,
    briefHash: null,
    shortstat: sh.code === 0 ? sh.out : "",
    commitCount: cc.code === 0 ? Number(cc.out) || 0 : 0,
    filesTouched,
    e2eTouched: filesTouched.some(isTestPath),
    sessionMs: null,
    ownerPrompts: 0,
    // n/a defaults — a revert is not a land. The land-shape facts of the land being undone live on
    // its own `landed` record; join reverted→landed BY BRANCH (rec.branch) to recover them.
    ...NO_LAND_FACTS,
    verified: null, // no verify runs for a revert — the undone land's own record carries its verdict
    // no live slot here (the lane landed and was torn down) → no review cache to read. Recorded as
    // the explicit "nothing covered this", never as a missing field.
    review: { state: "none" },
  };
}
function emitLaneOutcome(o: LaneOutcome | null): void {
  if (o) appendEvent(LANE_OUTCOME_FILE, o as unknown as Record<string, unknown>);
}

// --- intervention-outcome fuel (steward-intelligence.md §4). A per-send pending baseline
// (survives restart via saveState) + a durable, HARM-AWARE per-class tally. The tally is the
// ladder's promotion evidence and is read from STATE, NEVER by scanning the rotatable journal
// (§3: the 2nd rotation would silently reset it). `helped`/`noEffect` auto-increment on the
// deterministic window-close pass; `harmed` is OWNER-supplied only (§6: "worsened" is not
// deterministically measurable — never guessed, never LLM-judged).
interface OutcomePending {
  slot: number; class: string; ref: string; sentAt: number;
  // head/repo/branch/merged: the sha-grounded baseline (commit-cursor layer). Optional —
  // entries persisted by an older fleet.json have only ahead/dirty and keep the legacy
  // ahead-count comparison. `merged` = "was the baseline sha already an ancestor of the
  // integration branch at park time" — guards the trivial ancestor case (a zero-commit lane's
  // fork point is always merged) so landing can be detected without a false helped.
  gitBaseline: { ahead: number; dirty: number; head?: string; repo?: string; branch?: string; merged?: boolean };
  outputBaseline: number; aliveBaseline: boolean;
}
const outcomePending: OutcomePending[] = [];
// `dismissed` (B1/F-C): the owner DISMISSING a steward `propose` proposal is attributable NEGATIVE
// signal — kept DISTINCT from noEffect (which means "nudge fired, nothing moved"). It counts toward
// neither `helped` nor `harmed`, so promotionEligible is unaffected by it (a dismissal is not harm).
interface OutcomeCounts { helped: number; noEffect: number; harmed: number; dismissed: number }
const outcomeTally: Record<string, OutcomeCounts> = {}; // class(kind) -> counts
// A2 null-calibration (F-C): the tally measures NUDGED slots, which have no null baseline — a
// working slot commits/emits anyway. `baselineRate` runs the SAME helped classifier over active
// slots that got NO steward send, so a high nudged-helped count is interpretable against the
// background "helped-looking" rate. ADVISORY ONLY — it NEVER gates promotion and NEVER writes
// outcomeTally. A control is parked at window OPEN (mirroring the send-time baseline) and
// classified one window later; the samples are an in-memory rolling ring (advisory number — not
// worth the persist/restore surface). We sample the BUSIEST un-nudged slots (highest lastOutput,
// up to CONTROL_SAMPLE_MAX) because the honest null is "a WORKING slot nobody nudged" (F-C) — an
// idle slot trivially scores no-effect and only dilutes the denominator.
interface ControlBaseline { slot: number; openedAt: number; aheadBaseline: number; outputBaseline: number }
const controlPending: ControlBaseline[] = [];
const CONTROL_SAMPLE_MAX = 3;
const BASELINE_RING_CAP = 50; // rolling window of recent control samples
const baselineSamples: boolean[] = []; // true = the control slot looked "helped" with no nudge
// …and, beside the ring, the LIFETIME counts of control samples ever classified. The ring answers
// "what is the recent background rate" (deliberately forgetful); these answer "was a sample taken
// at all", which the ring stops being able to report once it saturates at BASELINE_RING_CAP — its
// length is pinned and a shift can even cancel an incoming helped. Same in-memory-only discipline
// as the ring: advisory, never persisted, never part of outcomeTally.
let baselineSeen = 0;
let baselineSeenHelped = 0;
// a deterministic claudeAlive true→false-in-window is a crash CANDIDATE escalated to the owner,
// never an auto harm label (attribution is ambiguous: a coincidental crash ≠ one this send caused).
interface HarmCandidate { slot: number; class: string; ref: string; at: number }
const harmCandidates: HarmCandidate[] = [];
// the record is "harm-blind" until the owner harm channel has operated RECENTLY. No class is
// promotion-eligible on a harm-blind tally — a record that structurally cannot show the harm
// disqualifier must never license autonomy (the safety-critical half of §4). A timestamp, NOT a
// forever-latch boolean: `harmAttestAt` is the owner's last engagement (0 = never); eligibility
// requires it within HARM_ATTEST_TTL_MS, so a months-old attest reverts the record to harm-blind.
let harmAttestAt = 0;
function harmAttestFresh(): boolean {
  return harmAttestAt > 0 && Date.now() - harmAttestAt <= HARM_ATTEST_TTL_MS;
}
function bumpTally(cls: string, field: keyof OutcomeCounts): void {
  const t = outcomeTally[cls] ?? { helped: 0, noEffect: 0, harmed: 0, dismissed: 0 };
  outcomeTally[cls] = { ...t, [field]: t[field] + 1 };
}
// the promotion predicate the ladder (future) reads — NOT the ladder itself. A class promotes
// iff it has N clean helps AND zero owner-recorded harm AND the harm channel is operating.
// NOTE: `helped` is UNDER-COUNTED — reply-referencing detection is deferred, so a pure reply/
// Q&A intervention records as no-effect. Conservative: it only ever DELAYS a promotion, never
// enables a wrong one, so it is safe to omit (documented, not hidden).
function promotionEligible(cls: string): boolean {
  const t = outcomeTally[cls];
  return !!t && harmAttestFresh() && t.harmed === 0 && t.helped >= PROMOTION_MIN_N;
}

// --- DISPOSITION rail: the owner's label channel for advisory output (docs/graduation-criteria.md
// needs owner labels as ground truth, and Fleet's throwaway workers had none). One append-only
// record per ruling, same discipline as the audit/outcome logs it sits beside: appendEvent's write
// chain, mode 600, one JSON line, single-generation rotation.
//
// Two properties this rail must keep, or the labels are worthless as evidence:
//   · the OWNER is the only writer. A lane must never label its own work, so the per-slot
//     FLEET_SELF_TOKEN is refused at the route (403, told apart from an unknown credential's 401)
//     and `source` is hard-stamped "owner" — never read from the body.
//   · absence is not approval. Nothing is written unless the owner acted; an unlabeled ref stays
//     unlabeled forever, and the renderer says so rather than defaulting to accepted.
//
// `ref` shapes — chosen per worker so a label JOINS back to the thing it judges:
//   · land    `<branch>@<ts>` of the outcome row. `ts` is the only field EVERY row carries
//     (headSha is null on a legacy row and on a kill that could not resolve HEAD); branch
//     disambiguates and stays readable. Never headSha alone.
//   · review3 the review's `patchId` — CONTENT identity of the reviewed diff, the same key the
//     outcome row's coverage relation uses. It survives the land-path rebase, which a sha does
//     not. A review with a null patchId is deliberately NOT labelable (no honest join key).
//   · enhance `draftId` = sha256(enhanced prompt).slice(0,16), stamped by /api/enhance and echoed
//     back by the client. Server-side so the join key cannot drift, and so the client needs no
//     crypto.subtle (unavailable on the plain-http Tailscale origin).
type DispositionWorker = "land" | "review3" | "enhance";
type DispositionVerdict = "accepted" | "edited" | "ignored" | "wrong";
const DISPOSITION_WORKERS: DispositionWorker[] = ["land", "review3", "enhance"];
const DISPOSITION_VERDICTS: DispositionVerdict[] = ["accepted", "edited", "ignored", "wrong"];
const MAX_DISPOSITION_REF = 200;
interface DispositionRecord {
  at: number; worker: DispositionWorker; ref: string; disposition: DispositionVerdict; source: "owner";
}
// async like the audit/outcome readers it sits beside — a request-path file read must not block
// the event loop, however small this file is today
async function readDispositions(limit: number): Promise<{ dispositions: Record<string, unknown>[]; total: number }> {
  const text = existsSync(DISPOSITION_FILE) ? await Bun.file(DISPOSITION_FILE).text() : "";
  const lines = text.split("\n").filter(Boolean);
  const rows: Record<string, unknown>[] = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // a torn mid-append line — skip, same as the audit/outcome readers
    }
  }
  rows.sort((a, b) => (typeof b.at === "number" ? b.at : 0) - (typeof a.at === "number" ? a.at : 0));
  return { dispositions: rows.slice(0, limit), total: lines.length };
}
// the owner write. Returns the Response so both the validation and the harm-channel coupling live
// in one place: LABELING IS the harm-channel engagement (steward-intelligence.md §4 — the channel
// must be shown to OPERATE, not merely to exist), so every accepted write refreshes harmAttestAt.
// The harm-SPECIFIC path stays /api/steward/outcomes/harm: a `wrong` label on a nudge-class output
// is still reportable there, and that route is untouched by this one.
function writeDisposition(body: Record<string, unknown> | null): Response {
  if (!body) return json({ error: "invalid json" }, 400);
  const worker = body.worker;
  const disposition = body.disposition;
  const ref = typeof body.ref === "string" ? body.ref.trim() : "";
  if (typeof worker !== "string" || !DISPOSITION_WORKERS.includes(worker as DispositionWorker))
    return json({ error: `worker must be one of ${DISPOSITION_WORKERS.join(", ")}` }, 400);
  if (typeof disposition !== "string" || !DISPOSITION_VERDICTS.includes(disposition as DispositionVerdict))
    return json({ error: `disposition must be one of ${DISPOSITION_VERDICTS.join(", ")}` }, 400);
  if (!ref || ref.length > MAX_DISPOSITION_REF)
    return json({ error: `ref must be a non-empty string ≤${MAX_DISPOSITION_REF} chars` }, 400);
  const rec: DispositionRecord = {
    at: Date.now(), worker: worker as DispositionWorker, ref,
    disposition: disposition as DispositionVerdict,
    source: "owner", // stamped, never read from the body — this route has exactly one principal
  };
  appendEvent(DISPOSITION_FILE, rec as unknown as Record<string, unknown>);
  harmAttestAt = rec.at; // the owner ruling on worker output IS the channel operating
  saveState();
  return json({ ok: true, record: rec, harmAttestAt });
}

// deterministic first attempt: most rebases don't conflict at all, and `git rebase` alone
// handles those completely — spawning a model session for that is minutes and money for
// nothing. Clean → the agent is never spawned. Conflict → abort (lane exactly as found)
// and hand the agent the conflict surface we just discovered, so it starts working
// instead of exploring.
async function tryScriptRebase(cwd: string, main: string): Promise<{ clean: boolean; conflicted: string[] }> {
  // rerere.enabled would silently replay recorded resolutions and exit 0, landing an
  // unreviewed conflict resolution — disable it just for this pre-pass so exit 0 means
  // genuinely no conflicts to review.
  const rb = await git(cwd, "-c", "rerere.enabled=false", "rebase", main);
  if (rb.code === 0) return { clean: true, conflicted: [] };
  const files = await git(cwd, "diff", "--name-only", "--diff-filter=U");
  await git(cwd, "rebase", "--abort");
  return { clean: false, conflicted: files.code === 0 ? files.out.split("\n").filter(Boolean).slice(0, 50) : [] };
}

async function runMerge(cwd: string, branch: string, main: string, conflicted: string[], laneTask: string | null): Promise<{ status: "rebased" | "blocked" | "unparseable"; detail: string }> {
  const lg = await git(cwd, "log", "--no-color", "--oneline", `${main}..HEAD`);
  // main's intent, deterministically: commits main gained since the fork. Compute the merge-base
  // here (fall back to `main` if it can't be resolved — then mergeBase..main is empty, matching
  // "up to date"). This is UNTRUSTED DATA and rides inside the DATA block, never as an instruction.
  const mb = await git(cwd, "merge-base", main, "HEAD");
  const mergeBase = mb.code === 0 && mb.out.trim() ? mb.out.trim() : main;
  const mlg = await git(cwd, "log", "--no-color", "--oneline", `${mergeBase}..${main}`);
  const prompt = buildMergePrompt({
    branch,
    main,
    mergeBase,
    conflicted,
    laneTask,
    laneLog: lg.code === 0 ? lg.out : "",
    mainLog: mlg.code === 0 ? mlg.out : "",
  });
  let out = MERGE_CMD
    ? await summaryViaSubprocess(MERGE_CMD, prompt, cwd, MERGE_TIMEOUT_MS)
    : await summaryViaSession(prompt, cwd, '"status"', { extraArgs: MERGE_TOOLS, timeoutMs: MERGE_TIMEOUT_MS });
  // test stand-in answers in a {"result": …} envelope — unwrap; no-op for real runs
  try {
    const env = JSON.parse(out) as { result?: unknown };
    if (typeof env.result === "string") out = env.result.trim();
  } catch { /* not an envelope */ }
  const body = out.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  // the JSON is the agent's NARRATIVE, never the authority — a correct rebase answered in
  // prose must not be thrown away (seen live: agent ignored an injected commit subject,
  // rebased perfectly, then narrated instead of answering the contract). Unparseable →
  // mergeJob decides by the same git verification a claimed "rebased" gets.
  try {
    const j = JSON.parse(body) as { status?: unknown; detail?: unknown };
    if (j.status !== "rebased" && j.status !== "blocked")
      return { status: "unparseable", detail: `agent answered without a status: ${body.slice(0, 200)}` };
    return { status: j.status, detail: typeof j.detail === "string" ? j.detail.slice(0, 600) : "" };
  } catch {
    return { status: "unparseable", detail: `agent answer was not the JSON contract: ${body.slice(0, 200)}` };
  }
}

// One repair round: hand the resolver the exact verify failure and let it fix the rebased tree.
// Invoked exactly like runMerge (same MERGE_CMD/session, timeout, tools). The returned status is
// the agent's NARRATIVE only — mergeJob's loop re-establishes the git-verified state and re-runs
// runVerify to decide, never trusting this word (believe git, not the agent).
async function runRepair(cwd: string, branch: string, main: string, conflicted: string[],
  verify: { cmd: string; out: string }): Promise<{ status: "repaired" | "blocked" | "unparseable"; detail: string }> {
  const prompt = buildRepairPrompt({ branch, main, verifyCmd: verify.cmd, verifyOut: verify.out, conflicted });
  let out = MERGE_CMD
    ? await summaryViaSubprocess(MERGE_CMD, prompt, cwd, MERGE_TIMEOUT_MS)
    : await summaryViaSession(prompt, cwd, '"status"', { extraArgs: MERGE_TOOLS, timeoutMs: MERGE_TIMEOUT_MS });
  try {
    const env = JSON.parse(out) as { result?: unknown };
    if (typeof env.result === "string") out = env.result.trim();
  } catch { /* not an envelope */ }
  const body = out.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  try {
    const j = JSON.parse(body) as { status?: unknown; detail?: unknown };
    if (j.status !== "repaired" && j.status !== "blocked")
      return { status: "unparseable", detail: `agent answered without a status: ${body.slice(0, 200)}` };
    return { status: j.status, detail: typeof j.detail === "string" ? j.detail.slice(0, 600) : "" };
  } catch {
    return { status: "unparseable", detail: `agent answer was not the JSON contract: ${body.slice(0, 200)}` };
  }
}

// OPT-IN clean-path advisory reviewer. Runs only when FLEET_CLEAN_REVIEW is on, only on the clean+green
// auto-land path, and can ONLY downgrade that auto-land to a stop-and-review — it never lands anything.
// FAIL-CLOSED: only an explicit {"verdict":"ok"} returns "ok"; every other outcome (a "review" verdict,
// a timeout/throw, an unparseable answer, a missing fork base) returns "review", so the auto-land is
// unreachable from any of the reviewer's failure modes. The reviewer is read-only by contract; HEAD is
// captured and hard-reset afterwards so any stray edit/commit it made can never reach the landing tree.
// `raw` marks an answer that carried NO explicit verdict (no fork base, timeout/throw, unparseable,
// or a verdict field that is neither "ok" nor "review"). Gate mode ignores it — every such case is
// already a stop. Shadow mode needs it: an unmeasurable run must be recorded as unmeasured, never as
// a pass (F5's lesson: empty/unparseable ≠ pass). `answer` carries the reviewer's post-envelope text
// so a raw run stays DIAGNOSABLE downstream; "" is the honest answer whenever no text came back at
// all (no fork base — the reviewer never ran; timeout/spawn failure — it ran and said nothing).
async function runCleanReview(cwd: string, branch: string, main: string, base: string | null): Promise<{ verdict: "ok" | "review"; reason: string; raw: boolean; answer: string }> {
  if (!base) return { verdict: "review", reason: "no fork base to compare against — stopping for a human look", raw: true, answer: "" };
  const lf = await git(cwd, "diff", "--name-only", "--no-color", `${base}...HEAD`);
  const ls = await git(cwd, "diff", "--shortstat", "--no-color", `${base}...HEAD`);
  const ml = await git(cwd, "log", "--no-color", "--oneline", `${base}..${main}`);
  const mf = await git(cwd, "diff", "--name-only", "--no-color", `${base}..${main}`);
  const prompt = buildCleanReviewPrompt({
    branch, main,
    laneFiles: lf.code === 0 ? lf.out.split("\n").filter(Boolean).slice(0, 100) : [],
    laneStat: ls.code === 0 ? ls.out : "",
    mainLog: ml.code === 0 ? ml.out : "",
    mainFiles: mf.code === 0 ? mf.out.split("\n").filter(Boolean).slice(0, 100) : [],
  });
  const preHead = await git(cwd, "rev-parse", "HEAD");
  let out = "";
  try {
    out = CLEAN_REVIEW_CMD
      ? await summaryViaSubprocess(CLEAN_REVIEW_CMD, prompt, cwd, CLEAN_REVIEW_TIMEOUT_MS)
      : await summaryViaSession(prompt, cwd, '"verdict"', { extraArgs: MERGE_TOOLS, timeoutMs: CLEAN_REVIEW_TIMEOUT_MS });
  } catch { /* timeout / spawn failure → out stays "" → parsed as fail-closed below */ }
  // enforce read-only: restore the tree to exactly what it was before the reviewer ran (it is about to land)
  if (preHead.code === 0 && preHead.out) await git(cwd, "reset", "--hard", preHead.out);
  let text = out;
  try {
    const env = JSON.parse(text) as { result?: unknown };
    if (typeof env.result === "string") text = env.result.trim();
  } catch { /* not an envelope */ }
  const body = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  // the real model routinely wraps a perfectly valid verdict object in a one-sentence preamble
  // (5 of the first 6 production shadow rows) — so on a parse failure, carve the object out the
  // same way runEnhance does before giving up. This RESCUES a well-formed answer; it can never
  // manufacture one: an extraction that yields no object, or an object whose verdict is neither
  // "ok" nor "review", still falls through to raw + "review" and the gate still fails CLOSED.
  const parsed = ((): { verdict?: unknown; reason?: unknown } | null => {
    for (const cand of [body, extractJsonObject(body)]) {
      if (cand === null) continue;
      try {
        const j = JSON.parse(cand) as unknown;
        if (j && typeof j === "object") return j as { verdict?: unknown; reason?: unknown };
      } catch { /* try the extracted object next */ }
    }
    return null;
  })();
  if (!parsed) return { verdict: "review", reason: "reviewer answer was not the JSON contract — stopping for a human look", raw: true, answer: body };
  const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 400) : "";
  if (parsed.verdict === "ok") return { verdict: "ok", reason, raw: false, answer: body };
  if (parsed.verdict === "review") return { verdict: "review", reason: reason || "flagged for a human look", raw: false, answer: body };
  return { verdict: "review", reason: `reviewer returned no clean verdict (${body.slice(0, 120)}) — stopping for a human look`, raw: true, answer: body };
}
// the shadow projection of a reviewer run, as persisted on the outcome row. `raw: true` (no explicit
// verdict came back) forces `verdict: null` — the measurement failed and says so, rather than
// collapsing into a pass and inflating the graduation dataset with fabricated agreement.
// A failed measurement also persists the answer it failed on (truncated) — both production shadow
// verdicts so far were raw:true and undiagnosable from the journal without it. A healthy row keeps
// exactly its previous shape: no rawAnswer key at all.
function shadowOf(r: { verdict: "ok" | "review"; reason: string; raw: boolean; answer: string }): CleanReviewShadow {
  return {
    verdict: r.raw ? null : r.verdict === "ok" ? "pass" : "would_stop",
    at: Date.now(), model: SUMMARY_MODEL, raw: r.raw,
    ...(r.raw ? { rawAnswer: r.answer.slice(0, SHADOW_RAW_ANSWER_MAX) } : {}),
    // the reason strings are written for the GATE ("— stopping for a human look"); in shadow nothing
    // stopped, so that tail would misdescribe the row the owner reads. Drop it, keep the substance.
    notes: r.reason.replace(/ — stopping for a human look$/, "").slice(0, 400),
  };
}

async function mergeJob(s: Slot, cwd: string, root: string, branch: string, main: string): Promise<void> {
  let res: MergeLast;
  try {
    // script first, agent only for what needs judgment: a conflict-free rebase is done
    // right here and the model never spawns
    const pre = await tryScriptRebase(cwd, main);
    const laneTask = tasks.find((t) => t.slot === s.id)?.text ?? null;
    const r = pre.clean
      ? { status: "rebased" as const, detail: "clean rebase — no conflicts, agent not needed" }
      : await runMerge(cwd, branch, main, pre.conflicted, laneTask);
    if (r.status === "blocked") {
      res = { status: "blocked", detail: r.detail, landed: false, branch, at: Date.now() };
    } else {
      // the agent SAYS rebased (or answered off-contract) — believe git, not the agent:
      // tree clean AND main an ancestor of the lane branch, checked against the shared
      // refs, not the claim. An unparseable answer over a git-verified rebase proceeds;
      // over an unverified lane it fails exactly like a false "rebased" claim.
      const st = await git(cwd, "status", "--porcelain");
      const anc = await git(root, "merge-base", "--is-ancestor", main, branch);
      if (st.code !== 0 || st.out || anc.code !== 0) {
        // nothing was successfully rebased — no tree to verify, no verdict field
        res = { status: "error", landed: false, branch, at: Date.now(),
          detail: `agent ${r.status === "unparseable" ? "answered off-contract" : "reported rebased"}, but the lane is ${st.out ? "not clean" : `not rebased onto ${main}`} — lane kept. ${r.detail}`.slice(0, 600) };
      } else {
        // The rebase is git-verified (clean OR resolved). Deterministic verify runs HERE —
        // server-side, in the lane worktree, against the rebased tree (§6 rule 4) — BEFORE any
        // land or verdict write, on BOTH paths. `undefined` when no FLEET_VERIFY_CMD is set:
        // field stays absent and today's behavior is unchanged. mainSha === the main just
        // rebased onto, reused below as mainBefore for the clean-path land.
        const mainSha = (await git(root, "rev-parse", main)).out;
        let verify = await runVerify(cwd, mainSha);
        // Bounded resolver↔verify repair loop (CONFLICT path only). A conflict resolution can
        // rebase cleanly yet fail the deterministic verify (a dropped symbol, a broken type). Rather
        // than dead-end at a red verdict, feed the exact failure back to the resolver for up to
        // MERGE_REPAIR_ROUNDS rounds. Authority every round is git + a re-run of runVerify, never the
        // agent's word: the repair must leave a clean tree still rebased onto main, and only a fresh
        // runVerify decides ok. This never changes what LANDS — the conflict path always stops for
        // human review below — it only improves the verify state that review sees.
        // `ok === false` explicitly, not `!ok`: a SKIPPED verify (ok:null) reports no failure to
        // repair, and feeding the resolver "verify skipped: not the fleet repo" as if it were a
        // build error would spend agent rounds editing a tree against a phantom defect.
        let repairRounds = 0;
        if (!pre.clean && verify && verify.ok === false && MERGE_REPAIR_ROUNDS > 0) {
          for (let round = 1; round <= MERGE_REPAIR_ROUNDS; round++) {
            const rep = await runRepair(cwd, branch, main, pre.conflicted, { cmd: verify.cmd, out: verify.out });
            if (rep.status === "blocked") break; // agent aborted, tree left pristine — nothing to re-verify
            const rst = await git(cwd, "status", "--porcelain");
            if (rst.code !== 0 || rst.out) {
              // the repair left uncommitted edits (contract says commit): drop that unreviewed,
              // unverified scratch so the human never gets a dirty (land-blocked) tree — this
              // makes the round a no-op, exactly as if no repair had run. Scoped to the isolated
              // lane worktree; the committed rebased resolution is untouched.
              await git(cwd, "reset", "--hard", "HEAD");
              break;
            }
            const anc2 = await git(root, "merge-base", "--is-ancestor", main, branch);
            if (anc2.code !== 0) break; // repair broke the rebase onto main — abandon, keep prior state
            repairRounds = round;
            const rv = await runVerify(cwd, mainSha);
            if (rv) verify = rv;
            if (verify && verify.ok) break; // repaired to green — done
          }
        }
        if (!pre.clean) {
          // CONFLICT path: the agent made semantic choices resolving conflicts. The rebase is
          // git-verified, but a human hasn't seen those choices — so we STOP here (no ff-merge,
          // no land) and record a reviewable "resolved" verdict. The lane stays exactly as the
          // agent left it, rebased onto main; the owner reviews the diff and confirms the land.
          // verify rides along as advisory context for that review (it never changes the stop).
          // three-way, because a repair CAN produce a skip: a resolution that moves or deletes the
          // file the verify command guards on makes the very next run decline. "still failed"
          // would hide that the gate stopped running at all.
          const repairVerdict = verify?.ok === true ? "passed" : verify?.ok === null ? "skipped itself" : "still failed";
          const repairNote = repairRounds > 0
            ? ` verify ${repairVerdict} after ${repairRounds} repair round${repairRounds === 1 ? "" : "s"}.`
            : "";
          res = { status: "resolved", landed: false, branch, at: Date.now(),
            conflicted: pre.conflicted, verify, ...(repairRounds > 0 ? { repairRounds } : {}),
            detail: `${r.detail}${r.detail ? " " : ""}— resolved ${pre.conflicted.length || "the"} conflict${pre.conflicted.length === 1 ? "" : "s"};${repairNote} review the diff, then land.`.slice(0, 600) };
        } else if (verify && verify.ok === null) {
          // CLEAN path but verify SKIPPED — the decision site (see VERIFY_SKIP_EXIT above). A
          // configured gate declined to run on this tree, so this land would be as unverified as a
          // red one, while LOOKING greener than an unconfigured fleet. The auto-land is downgraded
          // to the same stop-and-review a red verify gets: the owner keeps full latitude (confirm-
          // land never hard-blocks), but no tree reaches main unattended behind a gate that ran
          // nothing. A fleet with NO verify command at all is untouched — `verify === undefined`
          // never reaches here, and that deployment's auto-land is the owner's standing decision.
          res = { status: "resolved", landed: false, branch, at: Date.now(), verify,
            detail: `clean rebase, but verify SKIPPED itself (${verify.cmd}) — nothing was verified, so this did not auto-land; review the output, then land if intended.`.slice(0, 600) };
        } else if (verify && verify.ok === false) {
          // CLEAN path but verify RED: today this would auto-land, but the rebased tree does
          // NOT pass verify — landing it lands broken code. Consciously downgrade the auto-land
          // to a "resolved"-style stop-and-review verdict (design note §1): no ff, no land. The
          // owner reviews the verify output and MAY still land via confirm (owner latitude,
          // OWNER.md §4a — confirm-land never hard-blocks on ok:false). A missing verify cmd
          // (verify === undefined) never reaches here, so today's clean-path land is preserved.
          res = { status: "resolved", landed: false, branch, at: Date.now(), verify,
            detail: `clean rebase, but verify failed (${verify.cmd}) — not auto-landed; review the output, then land if intended.`.slice(0, 600) };
        } else {
          // CLEAN path, verify green or unconfigured: git rebased with zero conflicts and verification
          // passed — or no verify command is configured at all, the owner's standing decision (the
          // SKIPPED case is NOT here: a command that declined to run is caught by the branch above).
          // This is the ONLY unattended land. Off by default it auto-lands (inner else). When the
          // OPT-IN advisory reviewer is on it looks for a cross-change collision the gate can't see and may
          // ONLY downgrade this to a stop-and-review — `landed: true` is reachable ONLY on an explicit
          // "ok". runCleanReview fails CLOSED, so a "review"/timeout/unparseable/no-base verdict all route
          // to the stop branch here, never to advanceIntegration/landLane.
          // shadow: the reviewer runs identically but is POWERLESS — its verdict is recorded on the
          // outcome row and the land proceeds exactly as if ② were off (the gate branch below is
          // unreachable in shadow mode, by the explicit mode check, not by the verdict's value).
          const cleanReview = CLEAN_REVIEW_MODE !== "off" ? await runCleanReview(cwd, branch, main, await laneBaseRef(s)) : null;
          const shadow = CLEAN_REVIEW_MODE === "shadow" && cleanReview ? shadowOf(cleanReview) : undefined;
          if (CLEAN_REVIEW_MODE === "gate" && cleanReview && cleanReview.verdict !== "ok") {
            // `raw` is shadow-mode bookkeeping — the gate verdict's persisted shape stays what it was
            res = { status: "resolved", landed: false, branch, at: Date.now(), verify,
              cleanReview: { verdict: cleanReview.verdict, reason: cleanReview.reason },
              detail: `clean rebase + green verify, but the advisory reviewer flagged a look: ${cleanReview.reason} — not auto-landed; review the diff, then land.`.slice(0, 600) };
          } else {
            // land it — the state-changing step on the integration branch is the SERVER's, never the
            // agent's: advanceIntegration ff-merges (git refuses over a dirty tree) or advances the ref.
            const mainBefore = mainSha;
            const adv = await advanceIntegration(root, main, branch);
            if (adv) {
              res = { status: "error", landed: false, branch, at: Date.now(), verify,
                detail: `rebase ok, but fast-forwarding ${main} failed: ${adv.error} — lane kept` };
            } else {
              const mainAfter = (await git(root, "rev-parse", main)).out;
              // main HAS moved — record the land (undo record + provenance note) NOW, before the teardown
              // (coupling it to landLane used to leave a moved main with neither note nor undo on failure).
              await recordLand(root, main, branch, mainBefore, mainAfter, { verify, confirmedByHuman: false });
              // the owner may have recycled the slot mid-run — landLane re-checks it is still this lane
              const land = s.cwd === cwd && s.worktree?.branch === branch
                // clean auto-land — n/a land-shape facts (the ONLY unattended land), but the verify
                // verdict this job just produced is the local truth the record needs
                ? await landLane(s, { ...NO_LAND_FACTS, verified: verify ? verify.ok : null, baseSha: mainBefore,
                    ...(shadow ? { cleanReviewShadow: shadow } : {}) })
                : { error: "slot changed during the merge — lane merged but not landed", code: 409 };
              res = "error" in land
                ? { status: "merged", landed: false, branch, at: Date.now(), verify, landError: land.error,
                    detail: `${r.detail} — landed on ${main} (recorded), but lane teardown failed: ${land.error}`.slice(0, 600) }
                : { status: "merged", landed: true, branch, at: Date.now(), verify, detail: r.detail,
                    // gate mode only: `cleanReview` on a landed verdict means "the gate let this
                    // through". A shadow verdict gated nothing and lives on the outcome row instead.
                    ...(CLEAN_REVIEW_MODE === "gate" && cleanReview
                      ? { cleanReview: { verdict: cleanReview.verdict, reason: cleanReview.reason } } : {}) };
            }
          }
        }
      }
    }
  } catch (e) {
    res = { status: "error", detail: (e instanceof Error ? e.message : "merge agent failed").slice(0, 600),
      landed: false, branch, at: Date.now() };
  }
  // a slot recycled onto a DIFFERENT cwd mid-run already had its verdict slate cleared
  // by openSlot — don't write this lane's verdict onto whatever lives there now
  if (!s.cwd || s.cwd === cwd) {
    mergeLast.set(s.id, res);
    saveState(); // verdicts are part of persisted state now — the ⏸ gate must survive deploys
  }
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
  audit("owner_auth_fail"); // never the attempted token itself — the only owner credential
  return false;
}

// --- share auth: per-share cookie, brute-force throttled (public-facing) ---
const shareBy = (id: string) => shares.find((x) => x.id === id) ?? null;
// comment flood guard: per-share sliding minute, cheap and in-memory — guests are
// already authed, this only stops a stuck key / paste loop from filling the thread
const commentTimes = new Map<string, number[]>();
function commentStrike(id: string): boolean {
  const now = Date.now();
  const list = (commentTimes.get(id) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 10) { commentTimes.set(id, list); return true; }
  commentTimes.set(id, [...list, now]);
  return false;
}
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
// A wrong share COOKIE is a password guess like any other. /s/<id>/auth throttles every guess
// (400ms flat) and locks the share after 50, but the cookie path used to answer an unlimited
// number of guesses at full request rate — the same secret, a cheaper oracle, no lockout. Since
// an interact share is keystrokes into a live session, that made a weak owner-chosen password
// (the route floor is 8 chars) brute-forceable in the open. Every non-/auth share surface routes
// its credential check through here so both paths feed ONE counter.
// Two deliberate asymmetries:
//  - an ABSENT cookie is not a guess (a guest who hasn't logged in yet, or the share page's own
//    first load) and never consumes a strike — otherwise any stranger could lock a share by
//    loading its URL 51 times.
//  - a VALID cookie is answered before the lock is consulted, so a lockout silences guessers
//    without evicting the authenticated guest (/auth's pre-check does refuse even a correct
//    password while locked — that stays, it is the path a guesser uses).
function shareCookieOffered(req: Request, sh: Share): boolean {
  const cookie = req.headers.get("cookie");
  return !!cookie && new RegExp(`(?:^|;\\s*)share_${sh.id}=`).test(cookie); // id is [a-z0-9], regex-safe
}
async function shareGate(req: Request, sh: Share): Promise<Response | null> {
  if (shareAuthed(req, sh)) return null;
  if (!shareCookieOffered(req, sh)) return json({ error: "unauthorized" }, 401);
  const locked = failStrike(sh.id);
  audit(locked ? "share_auth_lock" : "share_auth_fail", sh.slot); // never the guessed secret
  await Bun.sleep(400); // flat cost per wrong guess, same as /auth
  return json({ error: locked ? "too many attempts — try again later" : "unauthorized" }, locked ? 429 : 401);
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
    if (typeof (persisted as { stewardToken?: unknown }).stewardToken === "string")
      stewardToken = (persisted as { stewardToken: string }).stewardToken;
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
    const pc = (persisted as { comments?: unknown }).comments;
    if (typeof pc === "object" && pc !== null && !Array.isArray(pc))
      for (const [k, v] of Object.entries(pc as Record<string, unknown>))
        if (Array.isArray(v))
          shareComments[k] = v.filter((c): c is ShareComment =>
            typeof c === "object" && c !== null
            && typeof (c as ShareComment).id === "string" && typeof (c as ShareComment).ts === "number"
            && typeof (c as ShareComment).name === "string" && typeof (c as ShareComment).text === "string");
    if (Array.isArray(persisted.recents)) recents = persisted.recents.filter((r): r is string => typeof r === "string");
    if (Array.isArray((persisted as { pins?: unknown }).pins))
      pins = ((persisted as { pins: unknown[] }).pins).filter((r): r is string => typeof r === "string").slice(0, MAX_PINS);
    if (Array.isArray((persisted as { tasks?: unknown }).tasks))
      tasks = ((persisted as { tasks: unknown[] }).tasks).filter((x): x is Task =>
        typeof x === "object" && x !== null
        && typeof (x as Task).id === "string" && typeof (x as Task).text === "string"
        && ["owner", "intake", "steward"].includes((x as Task).source)
        && ["pending", "queued", "sent", "done"].includes((x as Task).status));
      tasks = capTasks(tasks);
    for (const [k, v] of Object.entries(persisted.slots ?? {})) {
      const s = slotFrom(k);
      if (s && typeof v?.cwd === "string") {
        s.cwd = v.cwd;
        if (typeof v.label === "string") s.label = v.label;
        if (typeof (v as { sessionId?: unknown }).sessionId === "string") s.sessionId = (v as { sessionId: string }).sessionId;
        if (typeof (v as { selfToken?: unknown }).selfToken === "string") s.selfToken = (v as { selfToken: string }).selfToken;
        const pm = (v as { model?: unknown }).model;
        if (typeof pm === "string" && MODEL_RE.test(pm)) s.model = pm;
        const wt = (v as { worktree?: unknown }).worktree;
        if (typeof wt === "object" && wt !== null
          && typeof (wt as { repo?: unknown }).repo === "string" && typeof (wt as { branch?: unknown }).branch === "string")
          s.worktree = { repo: (wt as { repo: string }).repo, branch: (wt as { branch: string }).branch,
            ...(typeof (wt as { base?: unknown }).base === "string" ? { base: (wt as { base: string }).base } : {}),
            ...(typeof (wt as { baseSha?: unknown }).baseSha === "string" ? { baseSha: (wt as { baseSha: string }).baseSha } : {}) };
      }
    }
    // dispatcher toggle survives deploys — queued tasks persist, so the thing that
    // drains them must too (the silent off-after-restart was the cols/rows bug's twin)
    const prb = (persisted as { repoBases?: unknown }).repoBases;
    if (typeof prb === "object" && prb !== null && !Array.isArray(prb))
      for (const [k, v] of Object.entries(prb as Record<string, unknown>))
        if (typeof k === "string" && typeof v === "string" && v) repoBases[k] = v;
    if (typeof (persisted as { dispatch?: unknown }).dispatch === "boolean")
      dispatchOn = (persisted as { dispatch: boolean }).dispatch;
    if (typeof (persisted as { autosOn?: unknown }).autosOn === "boolean")
      autosOn = (persisted as { autosOn: boolean }).autosOn;
    const qh = (persisted as { quietHours?: unknown }).quietHours;
    if (qh && typeof qh === "object"
      && typeof (qh as { start?: unknown }).start === "number" && typeof (qh as { end?: unknown }).end === "number")
      quietHours = { start: (qh as { start: number }).start, end: (qh as { end: number }).end };
    // merge verdicts survive deploys — the ⏸ pause-for-review gate lives in mergeLast,
    // and a deploy that wiped it let a re-run ⏫ land agent conflict resolutions unreviewed
    const pm = (persisted as { merges?: unknown }).merges;
    if (typeof pm === "object" && pm !== null && !Array.isArray(pm))
      for (const [k, v] of Object.entries(pm as Record<string, unknown>)) {
        const s = slotFrom(k);
        if (s?.worktree && typeof v === "object" && v !== null
          && ["merged", "blocked", "error", "resolved"].includes((v as MergeLast).status)
          && typeof (v as MergeLast).detail === "string" && typeof (v as MergeLast).branch === "string"
          && (v as MergeLast).branch === s.worktree.branch)
          mergeLast.set(s.id, v as MergeLast);
      }
    const psh = (persisted as { shelved?: unknown }).shelved;
    if (typeof psh === "object" && psh !== null && !Array.isArray(psh))
      for (const [k, v] of Object.entries(psh as Record<string, unknown>))
        if (typeof k === "string" && typeof v === "object" && v !== null
          && typeof (v as { note?: unknown }).note === "string" && typeof (v as { at?: unknown }).at === "number")
          shelved[k] = { at: (v as { at: number }).at, note: (v as { note: string }).note };
    // undoable lands survive deploys — the reversibility pointer must outlast a restart, or a
    // deploy right after a land would silently strip the owner's one chance to undo it
    const pul = (persisted as { undoLands?: unknown }).undoLands;
    if (typeof pul === "object" && pul !== null && !Array.isArray(pul))
      for (const [k, v] of Object.entries(pul as Record<string, unknown>))
        if (typeof k === "string" && typeof v === "object" && v !== null
          && typeof (v as LandRecord).main === "string" && typeof (v as LandRecord).branch === "string"
          && typeof (v as LandRecord).mainBefore === "string" && typeof (v as LandRecord).mainAfter === "string"
          && typeof (v as LandRecord).at === "number")
          undoLast.set(k, { repo: k, main: (v as LandRecord).main, branch: (v as LandRecord).branch,
            mainBefore: (v as LandRecord).mainBefore, mainAfter: (v as LandRecord).mainAfter, at: (v as LandRecord).at });
    // intervention-outcome fuel survives deploys — a pending baseline whose window is still
    // open must be measured after a restart, and the per-class tally is the ladder's promotion
    // record (§3: it CANNOT be re-derived by scanning the rotatable journal). Backward-compatible:
    // a fleet.json written before this feature simply has none of these keys → empty state.
    const pop = (persisted as { outcomePending?: unknown }).outcomePending;
    if (Array.isArray(pop))
      for (const v of pop)
        if (typeof v === "object" && v !== null
          && typeof (v as OutcomePending).slot === "number" && typeof (v as OutcomePending).class === "string"
          && typeof (v as OutcomePending).ref === "string" && typeof (v as OutcomePending).sentAt === "number"
          && typeof (v as OutcomePending).outputBaseline === "number" && typeof (v as OutcomePending).aliveBaseline === "boolean"
          && typeof (v as OutcomePending).gitBaseline === "object" && (v as OutcomePending).gitBaseline !== null
          && typeof (v as OutcomePending).gitBaseline.ahead === "number" && typeof (v as OutcomePending).gitBaseline.dirty === "number")
          outcomePending.push({ slot: (v as OutcomePending).slot, class: (v as OutcomePending).class, ref: (v as OutcomePending).ref,
            sentAt: (v as OutcomePending).sentAt,
            // sha fields ride along when present; a pre-sha fleet.json has none → the entry
            // keeps the legacy ahead-count comparison in helpedGitSince (never mismeasured)
            gitBaseline: { ahead: (v as OutcomePending).gitBaseline.ahead, dirty: (v as OutcomePending).gitBaseline.dirty,
              ...(typeof (v as OutcomePending).gitBaseline.head === "string" ? { head: (v as OutcomePending).gitBaseline.head } : {}),
              ...(typeof (v as OutcomePending).gitBaseline.repo === "string" ? { repo: (v as OutcomePending).gitBaseline.repo } : {}),
              ...(typeof (v as OutcomePending).gitBaseline.branch === "string" ? { branch: (v as OutcomePending).gitBaseline.branch } : {}),
              ...(typeof (v as OutcomePending).gitBaseline.merged === "boolean" ? { merged: (v as OutcomePending).gitBaseline.merged } : {}) },
            outputBaseline: (v as OutcomePending).outputBaseline, aliveBaseline: (v as OutcomePending).aliveBaseline });
    const pot = (persisted as { outcomeTally?: unknown }).outcomeTally;
    if (typeof pot === "object" && pot !== null && !Array.isArray(pot))
      for (const [k, v] of Object.entries(pot as Record<string, unknown>))
        if (typeof k === "string" && k.length <= 40 && typeof v === "object" && v !== null
          && typeof (v as OutcomeCounts).helped === "number" && typeof (v as OutcomeCounts).noEffect === "number"
          && typeof (v as OutcomeCounts).harmed === "number")
          // `dismissed` is additive — migrate a pre-B1 persisted triple (no `dismissed` key) to 0.
          outcomeTally[k] = { helped: (v as OutcomeCounts).helped, noEffect: (v as OutcomeCounts).noEffect, harmed: (v as OutcomeCounts).harmed,
            dismissed: typeof (v as OutcomeCounts).dismissed === "number" ? (v as OutcomeCounts).dismissed : 0 };
    const phc = (persisted as { harmCandidates?: unknown }).harmCandidates;
    if (Array.isArray(phc))
      for (const v of phc)
        if (typeof v === "object" && v !== null && typeof (v as HarmCandidate).slot === "number"
          && typeof (v as HarmCandidate).class === "string" && typeof (v as HarmCandidate).ref === "string"
          && typeof (v as HarmCandidate).at === "number")
          harmCandidates.push({ slot: (v as HarmCandidate).slot, class: (v as HarmCandidate).class, ref: (v as HarmCandidate).ref, at: (v as HarmCandidate).at });
    // migrate the legacy forever-latch boolean → timestamp: a state file that predates the
    // staleness gate has `harmChannelActive: true` but no `harmAttestAt`. Treat a set latch as
    // "attested at load time" (a fresh window), NOT epoch-0 — the latter would silently mark
    // every class harm-blind the instant a live server restarts onto the new code.
    const paa = persisted as { harmAttestAt?: unknown; harmChannelActive?: unknown };
    if (typeof paa.harmAttestAt === "number") harmAttestAt = paa.harmAttestAt;
    else if (paa.harmChannelActive === true) harmAttestAt = Date.now();
  } catch {
    // keep the evidence: the unreadable file is preserved before the next saveState
    // overwrites it, so a torn write is recoverable by hand instead of erased
    try { copyFileSync(STATE_FILE, `${STATE_FILE}.bak`); } catch { /* fleet.json gone entirely */ }
    console.log(`fleet.json unreadable — starting with empty state (original kept as ${STATE_FILE}.bak)`);
  }
}
// a deploy that killed srv mid-land can strand a lane in rebase/merge state. We do NOT
// auto-abort — the session's OWN in-progress rebase is indistinguishable from a strayed Fleet
// one, and aborting the owner's work would be worse than the wedge. Log it so it's visible on
// boot; the brief surfaces it live (gitOp) so commit/land explain themselves, not just refuse.
for (const s of slots) {
  if (s.cwd && await gitOpInProgress(s.cwd))
    console.log(`slot ${s.id}: an interrupted git merge/rebase is in progress in ${s.cwd} — resolve or abort it in the session; Fleet commit/land is blocked there until then`);
}
if (process.env.FLEET_TOKEN) {
  TOKEN = process.env.FLEET_TOKEN;
} else {
  if (!persistedToken) persistedToken = randomBytes(24).toString("hex");
  TOKEN = persistedToken;
}
if (!stewardToken) stewardToken = randomBytes(16).toString("hex"); // same width as selfToken
const ls = await tmux("list-sessions", "-F", "#{session_name}");
if (ls.code === 0) {
  for (const name of ls.out.split("\n")) {
    // background-claude sessions (summarizer/enhancer/merge agent) are throwaways whose
    // cleanup lives in a process-memory finally — a deploy mid-run skips it and leaves a
    // write-capable agent running invisibly (it matches no slot regex, shows nowhere).
    // Boot is the safe reaping point: any survivor here is by definition orphaned.
    if (name.startsWith("sum-")) {
      void tmux("kill-session", "-t", name);
      console.log(`reaped orphaned background-agent session '${name}' (deploy interrupted its cleanup)`);
      continue;
    }
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

// rehydrate the newest post-land audit row (tier 2). A red audit is typically followed within
// minutes by the deploy that restarts srv — an alarm a restart erases is not an alarm. The TRAIL
// is the durable record either way; this only restores what the board polls.
if (existsSync(POSTLAND_AUDIT_FILE)) {
  try {
    const lines = (await Bun.file(POSTLAND_AUDIT_FILE).text()).split("\n").filter(Boolean);
    const last = lines[lines.length - 1];
    if (last) lastPostLandAudit = JSON.parse(last) as PostLandAuditRow;
  } catch {
    console.log("post-land audit trail: last row unreadable — the board starts without it");
  }
}

setInterval(() => void poll(), 100);
setInterval(() => void tickAutos().catch(() => {}), 5000);
setInterval(() => void tickGit().catch(() => {}), 10_000);
void tickGit().catch(() => {}); // warm the badge cache so the first paint isn't blank
setInterval(() => void tickDispatch().catch(() => {}), 8000);
setInterval(() => void tickHarvest().catch(() => {}), 5000);
// auto-③ on done-looking lanes (advisory; FLEET_AUTO_REVIEW_MS=0 turns the tick off entirely)
if (AUTO_REVIEW_MS > 0) setInterval(() => void tickAutoReview().catch(() => {}), AUTO_REVIEW_MS);
// self-heal: recreate any activated slot whose pane died (crash, accidental kill-session).
// ensureSlot is a cheap no-op (three tmux queries) per healthy slot
setInterval(() => {
  for (const s of slots) void ensureSlot(s).catch(() => {});
}, 2000);

type StewardKind = "state_relay" | "lifecycle_op" | "continue_nudge";
// static suffix every intervention template carries (steward-autonomy.md joint 5's
// "verification-suffix" item — not itself an intervention, just a constant line).
const STEWARD_VERIFY_SUFFIX = " Verifiziere dein Ergebnis, bevor du fertig meldest.";

// The hardening from automation-synergies.md finding 2: the server renders the FULL
// message from its own template plus deterministic server-side facts (mergeLast, gitInfo)
// — the caller supplies only `kind` + `ref`, selecting which template/fact, never text.
// A `ref` that doesn't match a real, currently-true deterministic fact is rejected outright
// (no "trust me, that's the state" path) — this is what makes mislabeling structurally
// impossible rather than merely audited after the fact.
function renderStewardMessage(kind: StewardKind, ref: string, s: Slot): { text: string } | { error: string } {
  if (kind === "continue_nudge") {
    if (ref !== "continue") return { error: "continue_nudge takes ref 'continue' only" };
    return { text: `[steward] Mach weiter.${STEWARD_VERIFY_SUFFIX}` };
  }
  if (kind === "lifecycle_op") {
    if (ref === "commit") {
      const gi = gitInfo.get(s.id);
      if (!gi || gi.dirty === 0) return { error: "no uncommitted changes on record for this lane" };
      return { text: `[steward] Committe deine Arbeit, bevor du weitermachst.${STEWARD_VERIFY_SUFFIX}` };
    }
    if (ref === "handoff")
      return { text: `[steward] Kontext nähert sich der Grenze — schreib ein /handoff.${STEWARD_VERIFY_SUFFIX}` };
    if (ref === "verify") {
      if (!mergeLast.get(s.id)) return { error: "no merge verdict on record for this lane" };
      return { text: `[steward] Lane gelandet — führe deine Verifikation aus und melde das Ergebnis.${STEWARD_VERIFY_SUFFIX}` };
    }
    return { error: "unknown lifecycle_op ref" };
  }
  // state_relay: "Status: <fact verbatim from the deterministic source>." — no interpretation
  // added, so the verification suffix is deliberately NOT appended here (playbook item 1).
  const m = mergeLast.get(s.id);
  if (ref === "merge_blocked") {
    if (!m || (m.status !== "blocked" && m.status !== "error")) return { error: "no blocked/error merge verdict on record" };
    return { text: `[steward] Status: ${m.detail}` };
  }
  if (ref === "merge_resolved") {
    if (!m || m.status !== "resolved") return { error: "no resolved merge verdict on record" };
    return { text: `[steward] Status: ${m.detail}` };
  }
  return { error: "unknown state_relay ref" };
}

// same delivery gates tickAutos applies before an unattended prompt reaches a pane (joint 4:
// only via the gated send path, never raw tmux) — a one-shot steward send gets the same
// idle + claude-alive re-verification an auto's scheduled fire gets, just evaluated inline
// instead of on a timer. STEWARD_MIN_IDLE_MS mirrors createAutoForSlot's idleSec default (60s).
const STEWARD_MIN_IDLE_MS = Number(process.env.FLEET_STEWARD_MIN_IDLE_MS ?? 60_000) | 0;
async function handleStewardSend(body: Record<string, unknown> | null): Promise<Response> {
  if (!body) return json({ error: "expected application/json" }, 400);
  if ("text" in body) return json({ error: "free text not accepted — send kind + ref, the server renders the message" }, 400);
  const kind = body.kind;
  if (kind !== "state_relay" && kind !== "lifecycle_op" && kind !== "continue_nudge")
    return json({ error: "kind must be state_relay | lifecycle_op | continue_nudge" }, 400);
  const ref = typeof body.ref === "string" ? body.ref : "";
  const s = slotFrom(body.slot);
  if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
  const rendered = renderStewardMessage(kind, ref, s);
  if ("error" in rendered) return json({ error: rendered.error }, 400);
  // the shared delivery choke-point: the master stop (autosOn) and quiet hours now reach the
  // steward's own send, not just scheduled autos (was synergy-findings.md Tier-0 #1) — plus the
  // fresh claude-alive + idle gates it already had.
  const verdict = await canDeliver(s, { now: Date.now(), idleMs: STEWARD_MIN_IDLE_MS });
  if (!verdict.ok) {
    if (verdict.gate === "kill-switch") return json({ error: "automation is paused (autosOn is off)" }, 409);
    if (verdict.gate === "not-alive") return json({ error: "claude not running in target pane" }, 409);
    if (verdict.gate === "quiet-hours") return json({ error: "quiet hours — steward sends are muted" }, 409);
    return json({ error: "target slot not idle" }, 409);
  }
  const recent = await stewardRecentSends();
  const now = Date.now();
  const withinHour = recent.filter((r) => now - r.ts < 3_600_000).length;
  if (withinHour >= STEWARD_SENDS_PER_HOUR) {
    audit("steward_send_capped", s.id, `${kind}:${ref}:hourly`);
    return json({ error: `hourly steward send cap (${STEWARD_SENDS_PER_HOUR}) reached` }, 429);
  }
  const sameEpisode = recent.some((r) => r.kind === kind && r.slot === s.id && now - r.ts < STEWARD_EPISODE_MS);
  if (sameEpisode) {
    audit("steward_send_capped", s.id, `${kind}:${ref}:episode`);
    return json({ error: "cap: 1 per kind×slot per episode" }, 429);
  }
  try {
    await sendText(s, rendered.text, true);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "send failed" }, 502);
  }
  const ts = Date.now();
  s.history = [...s.history, { text: rendered.text, ts }].slice(-MAX_HISTORY);
  saveHistory(s);
  logPrompt(s, rendered.text, "steward", ts);
  audit("steward_send", s.id, `${kind}:${ref}`);
  // park a pending-outcome baseline right after the send fires — the window-close pass in
  // tickGit measures this against the same deterministic signals (git delta / lastOutput /
  // claudeAlive). aliveBaseline is a FRESH read (canDeliver just proved it alive), never the
  // 10s cache; git/output baselines are the cheap caches (the delta, not the absolute, is what
  // matters, and measurement reads the same caches so they stay consistent).
  const gi = gitInfo.get(s.id);
  // sha-grounded baseline (commit-cursor layer): head from the tick cache, fresh rev-parse
  // only when the cache hasn't warmed yet. For lanes, park repo/branch (so the landed check
  // survives teardown) and whether the sha is ALREADY merged (see helpedGitSince).
  const gitBaseline: OutcomePending["gitBaseline"] = { ahead: gi?.ahead ?? 0, dirty: gi?.dirty ?? 0 };
  let bHead = gi?.head ?? null;
  if (!bHead && s.cwd) {
    const hd = await git(s.cwd, "rev-parse", "HEAD");
    bHead = hd.code === 0 && hd.out ? hd.out : null;
  }
  if (bHead) {
    gitBaseline.head = bHead;
    if (s.worktree) {
      gitBaseline.repo = s.worktree.repo;
      gitBaseline.branch = s.worktree.branch;
      const intRef = await integrationBranch(s.worktree.repo);
      if (intRef) gitBaseline.merged = (await git(s.worktree.repo, "merge-base", "--is-ancestor", bHead, intRef)).code === 0;
    }
  }
  outcomePending.push({
    slot: s.id, class: kind, ref, sentAt: ts,
    gitBaseline,
    outputBaseline: s.lastOutput, aliveBaseline: await claudeAlive(s.id),
  });
  if (outcomePending.length > 200) outcomePending.shift(); // unbounded only if measurement wedges
  saveState();
  return json({ ok: true, text: rendered.text });
}

// steward reads are a reduced cut of the owner's views (never share passwords, never full
// thinking/tool-result payloads — same capability-asymmetry stance as the guest cut below).
// the steward's durable pulse ledger (docs/steward-intelligence.md §3 — the self-model's home),
// written via the same appendEvent chain as audit. The FILE is a NARRATIVE log and MAY rotate;
// readStewardJournal reads across the single .1 generation so the Rundgang's delta anchor (its
// own last record) survives a rotation boundary. IMPORTANT: promotion COUNTS, when the ladder
// lands (§4), must accrue in a durable state tally incremented on recorded outcomes — NEVER by
// scanning this rotatable file, whose oldest lines are discarded on the second rotation.
// The file is MULTI-KIND — outcome/harm_candidate/harm_confirmed/harm_channel_attest/
// propose_outcome records interleave with the pulse's own — so the delta anchor must be read
// with `kind` FILTERED. Reading "the last record" would anchor the pulse on a foreign record
// written between two pulses, silently destroying its baseline.
const RUNDGANG_KIND = "rundgang";
function writeStewardJournal(rec: Record<string, unknown>): void {
  appendEvent(STEWARD_JOURNAL_FILE, { ts: Date.now(), ...rec });
}
async function readStewardJournal(tail: number, kind?: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const f of [`${STEWARD_JOURNAL_FILE}.1`, STEWARD_JOURNAL_FILE]) { // .1 is older → chronological
    if (!existsSync(f)) continue;
    for (const line of (await Bun.file(f).text()).split("\n")) {
      if (!line) continue;
      try { out.push(JSON.parse(line) as Record<string, unknown>); } catch { /* skip a torn tail line */ }
    }
  }
  return (kind === undefined ? out : out.filter((r) => r.kind === kind)).slice(-tail);
}

// Tier-1 signal-sharing (synergy-findings.md): the facts the server already computes, handed
// to the steward's SENSES so the pulse reasons from them instead of re-inferring in the LLM.
// `alive`/`gitOp` come from the ~10s tickGit caches — READS ONLY; every delivery/dispatch gate
// (canDeliver) keeps its FRESH claudeAlive call, a stale cache must never gate a send.
function stewardMergeView(slotId: number): { status: string; detail: string; conflicted: string[]; at: number } | null {
  const m = mergeLast.get(slotId);
  return m ? { status: m.status, detail: m.detail, conflicted: m.conflicted ?? [], at: m.at } : null;
}
// the lane's founding intent (the Task it was dispatched for) — the baseline "done-looking"
// is judged against. detachSlotTasks/land keep slot-attribution honest, so find-by-slot is safe.
function stewardTaskView(slotId: number): { id: string; status: Task["status"]; source: Task["source"]; text: string } | null {
  const t = tasks.find((x) => x.slot === slotId);
  return t ? { id: t.id, status: t.status, source: t.source, text: trim(t.text, 300) } : null;
}

// the deterministic inputs the done-looking predicate reads (lane-signals.ts). Built HERE, by the
// one function both readers go through — the steward view that reports the label and the auto-③
// tick that acts on it can never be looking at differently-assembled facts.
function laneSignalView(s: Slot, now: number) {
  return {
    git: gitInfo.get(s.id) ?? null,
    alive: aliveInfo.get(s.id) ?? null,
    gitOp: gitOpInfo.get(s.id) ?? null,
    idleMs: s.cwd ? Math.max(0, now - s.lastOutput) : null,
    merge: stewardMergeView(s.id),
  };
}

// --- context-size proxy (docs/steward-pulse-v2.md phase B): the steward can see that a session
// is running but not how full its context is. The deterministic stand-in is the session's own
// transcript JSONL — it grows monotonically with the conversation, one stat per slot per read.
// Two things this fact deliberately does NOT claim:
//   1. bytes are a PROXY, not a token count — tool_result payloads and thinking blocks inflate
//      the file far past what the model holds. It ranks a session against its own history and
//      against its peers; it can never be turned into a percentage.
//   2. PINNED slots only. transcriptFile()'s newest-by-mtime fallback can flap between files when
//      several sessions share a cwd (see the harvester's note), and a fact that silently swaps
//      subject is worse than no fact — unpinned slot → null, "cannot tell". Same for a slot whose
//      transcript does not exist yet (claude writes it on the first prompt): null, never 0.
function transcriptFact(s: Slot): { bytes: number; mtime: number } | null {
  if (!s.cwd || !s.sessionId) return null;
  try {
    const st = statSync(`${projDir(s.cwd)}/${s.sessionId}.jsonl`);
    return { bytes: st.size, mtime: Math.round(st.mtimeMs) };
  } catch {
    return null;
  }
}

function stewardSlotsView(now: number) {
  return slots.map((s) => {
    const sig = laneSignalView(s, now);
    return {
      id: s.id, cwd: s.cwd, label: s.label, lastOutput: s.lastOutput,
      ...sig, worktree: s.worktree, model: s.model,
      task: stewardTaskView(s.id),
      mergePending: mergeLast.get(s.id)?.status === "resolved",
      // the deterministic label, served as a FACT next to the facts it is computed from — the
      // digest worker gets the same rule in prose and may still disagree; this one is the
      // trigger's own answer, and it is what auto-③ acts on.
      doneLooking: !!s.cwd && !!s.worktree && s.label !== STEWARD_LABEL
        && laneDoneLooking(sig, AUTO_REVIEW_IDLE_MS),
      // second tier (lane-signals.ts): the epoch ms at which every non-clock clause already held
      // and the pane went quiet — null when a fact is unknown or this is not a reviewable lane.
      // `doneLooking` flips AUTO_REVIEW_IDLE_MS after this; nothing acts on it, it exists so a
      // poller can tell "just went quiet" from "quiet for minutes" without lowering the trigger.
      doneLookingSince: !!s.cwd && !!s.worktree && s.label !== STEWARD_LABEL
        ? laneQuietSince(sig, now) : null,
      // context-size proxy — {bytes, mtime} of this session's transcript, null when unknowable
      transcriptFact: transcriptFact(s),
    };
  });
}

// --- deploy-gap fact: LANDING IS NOT DEPLOYING. The running process is a build of exactly one
// commit; `main` moves on without it, and the trap fired four times in two days — three ledger
// rows written by a build that lacked the very field being recorded, plus a gate believed
// undeployed for a day (HANDOFF 2026-07-25, BACKLOG P-4). So the server stamps its OWN HEAD at
// boot and every steward read compares it against the repo's CURRENT HEAD.
// Two rules carry the honesty of this fact:
//   1. every unknown is `null`, never a zero — a failed git call must read as "cannot tell",
//      NEVER as "deployed". bootHead is captured once, so it survives the repo being moved away.
//   2. codeBehind is the NET tree diff bootHead..HEAD, not a per-commit path walk: `git log
//      --name-only` lists NO paths for a true merge commit, which would hide real code behind a
//      false `false`. Anything that is not a `*.md` file counts as code — an unrecognized path
//      must flag a gap, not hide one (docs/*.md, HANDOFF.md, BACKLOG.md are the docs-only set).
// FLEET_REPO_DIR exists because the server's own dir is the repo in production but not in a
// throwaway test copy; unset it and the fact is about the code actually running.
const REPO_DIR = process.env.FLEET_REPO_DIR || import.meta.dir;
let BOOT_HEAD: string | null = null;
const bootHeadReady = git(REPO_DIR, "rev-parse", "HEAD")
  .then((r) => { BOOT_HEAD = r.code === 0 && /^[0-9a-f]{40}$/.test(r.out) ? r.out : null; })
  .catch(() => { BOOT_HEAD = null; }); // a boot-time throw must leave the fact unknown, not kill the server
interface DeployGap { bootHead: string | null; head: string | null; behindCount: number | null; codeBehind: boolean | null }
async function deployGap(): Promise<DeployGap> {
  await bootHeadReady;
  const unknown: DeployGap = { bootHead: BOOT_HEAD, head: null, behindCount: null, codeBehind: null };
  if (!BOOT_HEAD) return unknown;
  const hd = await git(REPO_DIR, "rev-parse", "HEAD");
  if (hd.code !== 0 || !/^[0-9a-f]{40}$/.test(hd.out)) return unknown;
  const head = hd.out;
  if (head === BOOT_HEAD) return { bootHead: BOOT_HEAD, head, behindCount: 0, codeBehind: false };
  const [cnt, names] = await Promise.all([
    git(REPO_DIR, "rev-list", "--count", `${BOOT_HEAD}..${head}`),
    git(REPO_DIR, "diff", "--name-only", BOOT_HEAD, head),
  ]);
  const n = Number(cnt.out);
  if (cnt.code !== 0 || !Number.isInteger(n) || names.code !== 0) return { ...unknown, head };
  return {
    bootHead: BOOT_HEAD, head, behindCount: n,
    codeBehind: names.out.split("\n").filter(Boolean).some((p) => !p.endsWith(".md")),
  };
}

// --- bundle-staleness fact: LANDING IS NOT BUILDING, the deploy-gap's twin. public/*.js are
// gitignored BUILD ARTIFACTS, so landed client code is invisible in the browser until someone
// runs `bun run build` — on 2026-07-25 client code landed at 12:19 against a bundle built at
// 00:50 and the UI stayed an hour behind until a manual rebuild at 13:03, with nothing in any
// view saying so. Same two honesty rules as deployGap:
//   1. every unknown is `null`, never `false` — a missing bundle or an unreadable src/ must read
//      as "cannot tell", NEVER as "fresh". `stale: false` may only be said after BOTH sides were
//      actually stat'd.
//   2. it compares MTIMES, not content: a rebuild producing identical bytes still reads fresh,
//      and `touch src/client.ts` alone reads stale. That is the direction the incident needed —
//      the fact answers "was a build run after the last source change", not "does the bundle
//      match the source", which no mtime can decide.
// Judgment call: newest mtime under src/ ANYWHERE counts, including files no bundle imports
// (a false stale is a cheap rebuild; a false fresh is another invisible hour). Same dir as the
// deploy-gap fact — in production the repo the server serves public/ from IS the repo it
// stamped its HEAD from.
const BUNDLES = ["app.js", "share.js"] as const;
interface BundleStale { appJsMtime: number | null; shareJsMtime: number | null; srcNewestMtime: number | null; stale: boolean | null }
function newestMtime(dir: string): number | null {
  let newest: number | null = null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null; // src/ absent or unreadable — unknown, and unknown poisons the whole fact
  }
  for (const e of entries) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      const sub = newestMtime(p);
      if (sub !== null && (newest === null || sub > newest)) newest = sub;
      continue;
    }
    try {
      const m = statSync(p).mtimeMs;
      if (newest === null || m > newest) newest = m;
    } catch { /* raced away mid-walk — one file's mtime, not the fact */ }
  }
  return newest;
}
function bundleMtime(file: string): number | null {
  try {
    return Math.round(statSync(`${REPO_DIR}/public/${file}`).mtimeMs);
  } catch {
    return null; // never built, or a public/ that isn't this repo's
  }
}
function bundleStale(): BundleStale {
  const appJsMtime = bundleMtime(BUNDLES[0]);
  const shareJsMtime = bundleMtime(BUNDLES[1]);
  const srcRaw = newestMtime(`${REPO_DIR}/src`);
  const srcNewestMtime = srcRaw === null ? null : Math.round(srcRaw);
  const bundles = [appJsMtime, shareJsMtime].filter((m): m is number => m !== null);
  const stale = srcNewestMtime === null || bundles.length !== BUNDLES.length
    ? null
    : !bundles.every((m) => m >= srcNewestMtime);
  return { appJsMtime, shareJsMtime, srcNewestMtime, stale };
}

// --- commit-cursor fact layer: facts are shared, cursors are per-consumer (git-remote model).
// The server computes ONE deterministic per-lane fact — {head, base, landed, repo} keyed by
// branch, plus each lane repo's primary checkout keyed by ITS branch (owner-side lands become
// observable) — and stamps it SERVER-side into every rundgang journal record. The steward's
// have-pointer is simply its own prior record; the LLM can never write any of this (same typed
// choke-point stance as the journal handler). head is read FRESH per call — journal writes and
// digests are hours apart, so correctness of the fact beats reusing the 10s cache.
interface LaneFact { head: string | null; base: string | null; landed: boolean; repo: string }
async function laneFacts(): Promise<Record<string, LaneFact>> {
  const out: Record<string, LaneFact> = {};
  const repos = new Set<string>();
  await Promise.all(slots.filter((s) => s.cwd && s.worktree).map(async (s) => {
    const wt = s.worktree!;
    repos.add(wt.repo);
    const hd = await git(s.cwd!, "rev-parse", "HEAD");
    const head = hd.code === 0 && hd.out ? hd.out : null;
    const base = await laneBaseRef(s);
    let landed = false;
    if (head) {
      const intRef = await integrationBranch(wt.repo);
      if (intRef) landed = (await git(wt.repo, "merge-base", "--is-ancestor", head, intRef)).code === 0;
    }
    out[wt.branch] = { head, base, landed, repo: wt.repo };
  }));
  await Promise.all([...repos].map(async (repo) => {
    const br = await git(repo, "rev-parse", "--abbrev-ref", "HEAD");
    if (br.code !== 0 || !br.out || br.out === "HEAD" || out[br.out]) return;
    const hd = await git(repo, "rev-parse", "HEAD");
    out[br.out] = { head: hd.code === 0 && hd.out ? hd.out : null, base: null, landed: true, repo };
  }));
  return out;
}

// "what changed since my last look", as served data: diff the prior rundgang record's
// server-stamped lane map against the CURRENT one. Route-computed on every digest GET — the
// pulse never depends on the digest worker/cache being alive. A prior without lanes (an old
// record, or no prior at all) → null, never a fake-empty diff.
interface SinceLastLook {
  new: string[];
  advanced: { branch: string; commits: number; shortstat: string; from: string; to: string }[];
  landed: string[];
  vanishedUnlanded: string[];
  rewritten: { branch: string; priorHead: string; head: string }[];
}
async function sinceLastLookView(prior: Record<string, unknown> | null): Promise<SinceLastLook | null> {
  const pl = prior?.lanes;
  if (typeof pl !== "object" || pl === null || Array.isArray(pl)) return null;
  const priorLanes = pl as Record<string, { head?: unknown; landed?: unknown; repo?: unknown }>;
  const cur = await laneFacts();
  const d: SinceLastLook = { new: [], advanced: [], landed: [], vanishedUnlanded: [], rewritten: [] };
  for (const b of Object.keys(cur)) if (!(b in priorLanes)) d.new.push(b);
  for (const [b, p] of Object.entries(priorLanes)) {
    const pHead = typeof p.head === "string" ? p.head : null;
    const pRepo = typeof p.repo === "string" ? p.repo : null;
    const c = cur[b];
    if (!c) {
      // no slot holds the branch anymore: merged into the integration branch = landed;
      // otherwise the "sessions vanished" insurance fires (unknown repo/ref → conservative
      // vanishedUnlanded, never a silent drop). Worktrees share the object DB, so the check
      // runs in the primary repo even though the lane's tree is gone.
      let merged = false;
      if (pHead && pRepo) {
        const intRef = await integrationBranch(pRepo);
        if (intRef) merged = (await git(pRepo, "merge-base", "--is-ancestor", pHead, intRef)).code === 0;
      }
      (merged ? d.landed : d.vanishedUnlanded).push(b);
      continue;
    }
    if (c.landed && p.landed !== true) { d.landed.push(b); continue; }
    if (!pHead || !c.head || pHead === c.head) continue;
    // head moved: forward → advanced with O(delta) range stats; history rewritten (rebase) →
    // flagged honestly with both shas, never a fake delta
    const anc = await git(c.repo, "merge-base", "--is-ancestor", pHead, c.head);
    if (anc.code !== 0) { d.rewritten.push({ branch: b, priorHead: pHead, head: c.head }); continue; }
    const rl = await git(c.repo, "rev-list", "--count", `${pHead}..${c.head}`);
    const sh = await git(c.repo, "diff", "--shortstat", "--no-color", `${pHead}..${c.head}`);
    d.advanced.push({ branch: b, commits: rl.code === 0 ? Number(rl.out) || 0 : 0,
      shortstat: sh.code === 0 ? sh.out : "", from: pHead, to: c.head });
  }
  return d;
}

// --- 🧭 steward digest: the Rundgang's mechanical half as an ephemeral worker
// (automation-synergies.md Finding 3: "the steward is not his conversation"). The server
// composes the deterministic payload — prior journal record + the Tier-1 slots view — and a
// throwaway agent (same machinery as the summarizer) does the sense+interpret pass OUTSIDE
// the steward's degrading pane context. The worker's verdict is ADVISORY, never a gate input
// (facts outrank claims, steward-intelligence.md §8); judgment, emission and the journal
// write stay in the steward pane, which is the only holder of the steward token — the
// worker cannot send, schedule, or journal by construction (it holds no credential at all).
// Resilient by contract: on any worker failure the route still returns {prior, slots} with
// digest:null, so the pulse degrades to manual sensing instead of failing.
const DIGEST_CMD = process.env.FLEET_DIGEST_CMD ?? null; // tests: subprocess stand-in
interface StewardDigest { conditions: Record<string, string>; changed: string[]; attention: string[] }
const DIGEST_CONDITIONS = ["healthy-running", "done-looking", "stalled-dirty", "stuck-looping", "awaiting-human", "unknown"];
function clampDigest(v: unknown): StewardDigest | null {
  if (typeof v !== "object" || v === null) return null;
  const j = v as { conditions?: unknown; changed?: unknown; attention?: unknown };
  const conditions: Record<string, string> = {};
  if (typeof j.conditions === "object" && j.conditions !== null && !Array.isArray(j.conditions)) {
    for (const [k, val] of Object.entries(j.conditions as Record<string, unknown>).slice(0, 16)) {
      if (/^\d+$/.test(k) && typeof val === "string")
        conditions[k] = DIGEST_CONDITIONS.includes(val) ? val : "unknown";
    }
  }
  const strList = (x: unknown) => Array.isArray(x)
    ? x.filter((e): e is string => typeof e === "string").slice(0, 12).map((e) => e.slice(0, 300)) : [];
  return { conditions, changed: strList(j.changed), attention: strList(j.attention) };
}
// P3 async digest (demand-triggered bounded-wait): only the `digest` field is cached
// {digest, computedAt, slotCwd}; prior/slots are recomputed fresh every GET (facts outrank
// claims, §8). A GET triggers the worker only when the cache is stale, blocks at most a
// caller-chosen ?wait (default ~30s, clamped ≤60s), and returns fresh-if-ready else the last
// snapshot (or null on cold cache) plus digestAt/digestAge. INVARIANT: `curl -m` must be ≥ ?wait.
interface DigestResult { digest: StewardDigest | null; model: string; error?: string; computedAt: number; slotCwd: string }
const DIGEST_TTL_MS = 2 * 60 * 1000;      // "fresh enough" window — a repeat GET inside it skips the worker
const DIGEST_WAIT_DEFAULT_MS = 30_000;    // fresh-preferring: today's pulse (curl -m 45) needs no ?wait
const DIGEST_WAIT_MAX_MS = 60_000;        // no caller can request an unbounded block
function clampDigestWait(raw: string | null): number {
  const n = raw === null ? NaN : Number(raw); // ?wait is in SECONDS
  if (!Number.isFinite(n)) return DIGEST_WAIT_DEFAULT_MS;
  return Math.max(0, Math.min(DIGEST_WAIT_MAX_MS, Math.round(n * 1000)));
}
async function runStewardDigest(home: Slot): Promise<DigestResult> {
  const now = Date.now();
  const prior = (await readStewardJournal(1, RUNDGANG_KIND))[0] ?? null;
  const slotsView = stewardSlotsView(now);
  const prompt = [
    "You are a read-only SENSING worker for a fleet steward. Below: the steward's prior journal",
    "record (the delta anchor; null on the first run) and the current deterministic per-slot state.",
    "Do NOT use any tools — answer directly from the input, in one single message.",
    "For each ACTIVE slot (cwd set) EXCEPT the steward's own (label \"⚙ steward\"), assign one",
    `condition from exactly: ${DIGEST_CONDITIONS.join(" / ")}.`,
    "Deterministic rules, facts only: alive=false → unknown (a dead pane proves nothing else);",
    "gitOp=true or merge.status error/blocked → awaiting-human; idle + git.dirty>0 → stalled-dirty;",
    // generated from DONE_LOOKING_RULES — the worker's prose rule and the deterministic predicate
    // auto-③ fires on are the SAME source, so they cannot drift apart silently (§3)
    `${DONE_LOOKING_PROSE}; recent output → healthy-running; anything`,
    "ambiguous → unknown, never a guess. You cannot see transcripts, so never claim stuck-looping",
    "unless the prior record already flagged it.",
    "changed: what differs vs the prior record (empty array if nothing — honesty over content).",
    "attention: facts that need the owner (failed/blocked merge with its detail, wedged gitOp,",
    "a dead pane). Facts verbatim, no advice, no owner-voice, no invented findings.",
    'Respond with STRICT JSON only, no markdown fences, exactly this shape:',
    '{"digest": {"conditions": {"<slotId>": "<condition>"}, "changed": ["..."], "attention": ["..."]}}',
    "", "## prior journal record", JSON.stringify(prior),
    "", "## current slots", JSON.stringify(slotsView),
  ].join("\n");
  let digest: StewardDigest | null = null;
  let error: string | undefined;
  try {
    let out = DIGEST_CMD
      ? await summaryViaSubprocess(DIGEST_CMD, prompt, home.cwd!)
      : await summaryViaSession(prompt, home.cwd!, '"digest"', { extraArgs: TEXT_ONLY_TOOLS });
    // test stand-in answers in a {"result": …} envelope — unwrap; no-op for real runs
    try {
      const env = JSON.parse(out) as { result?: unknown };
      if (typeof env.result === "string") out = env.result.trim();
    } catch { /* not an envelope */ }
    const body = out.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    let j: { digest?: unknown };
    try {
      j = JSON.parse(body) as { digest?: unknown };
    } catch {
      const obj = extractJsonObject(out); // real model wrapped the JSON in prose/fences
      j = obj ? (JSON.parse(obj) as { digest?: unknown }) : {};
    }
    digest = clampDigest(j.digest);
    if (!digest) error = "worker returned no digest object";
  } catch (e) {
    error = e instanceof Error ? e.message.slice(0, 300) : "digest worker failed";
  }
  return { digest, model: SUMMARY_MODEL, error, computedAt: now, slotCwd: home.cwd! };
}
// concurrent pulses share one worker run (the beat is hours apart; a double-fire must not
// spawn two agents). On completion the run WRITES the cache, then nulls inflight.
let digestInflight: Promise<DigestResult> | null = null;
let digestCache: DigestResult | null = null;

async function handleStewardRoute(req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/api/steward/sessions" && req.method === "GET") {
    const now = Date.now();
    return json({ now, slots: stewardSlotsView(now), deployGap: await deployGap(), bundleStale: bundleStale() });
  }
  if (url.pathname === "/api/steward/digest" && req.method === "GET") {
    const home = stewardSlot();
    if (!home?.cwd) return json({ error: "no steward slot active" }, 404);
    const now = Date.now();
    const prior = (await readStewardJournal(1, RUNDGANG_KIND))[0] ?? null; // fresh every call
    const slotsView = stewardSlotsView(now);                // fresh every call
    const waitMs = clampDigestWait(url.searchParams.get("wait"));
    // a cached digest is bound to one slot (cwd) — drop it if the steward slot moved
    if (digestCache && digestCache.slotCwd !== home.cwd) digestCache = null;

    const fresh = digestCache && now - digestCache.computedAt < DIGEST_TTL_MS ? digestCache : null;
    let snapshot: DigestResult | null = fresh;
    if (!fresh) {
      if (!digestInflight) {
        digestInflight = runStewardDigest(home)
          .then((r) => { digestCache = r; return r; })
          .finally(() => { digestInflight = null; });
      }
      const inflight = digestInflight;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((res) => { timer = setTimeout(() => res(null), waitMs); });
      const raced = await Promise.race([inflight, timeout]);
      if (timer) clearTimeout(timer);
      snapshot = raced ?? digestCache; // timeout won → serve the last snapshot (or null on cold cache)
    }
    const digestAt = snapshot ? snapshot.computedAt : null;
    return json({
      now, prior, slots: slotsView,
      // deterministic per-lane delta vs the prior record's server-stamped lane map —
      // route-computed, so it works even when the digest worker/cache is dead
      sinceLastLook: await sinceLastLookView(prior),
      // is the process serving this digest still the code that is on disk? route-computed for
      // the same reason as sinceLastLook — it must not depend on the digest worker being alive
      deployGap: await deployGap(),
      // deployGap's twin: landed client code is invisible until the bundle is rebuilt.
      // Route-computed for the same reason — it must not depend on the digest worker.
      bundleStale: bundleStale(),
      digest: snapshot?.digest ?? null,
      digestAt,
      digestAge: digestAt !== null ? now - digestAt : null,
      waitMs,
      model: snapshot?.model ?? SUMMARY_MODEL,
      ...(snapshot?.error ? { error: snapshot.error } : {}),
    });
  }
  const briefMatch = /^\/api\/steward\/slots\/(\d+)\/brief$/.exec(url.pathname);
  if (req.method === "GET" && briefMatch) {
    const s = slotFrom(briefMatch[1]);
    if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
    const p = await briefPayload(s);
    if (!p) return json({ error: "not a git repository" }, 400);
    return json({ ...p, worktree: s.worktree, merge: stewardMergeView(s.id), task: stewardTaskView(s.id) });
  }
  const trMatch = /^\/api\/steward\/slots\/(\d+)\/transcript$/.exec(url.pathname);
  if (req.method === "GET" && trMatch) {
    const s = slotFrom(trMatch[1]);
    if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
    const p = await transcriptPayload(s, Number(url.searchParams.get("after") ?? 0));
    return json({
      ...p,
      entries: p.entries.map((e) => ({
        ...e,
        blocks: e.blocks.filter((b) => b.t !== "thinking")
          .map((b) => (b.t === "tool_result" ? { ...b, text: trim(b.text, 400) } : b)),
      })).filter((e) => e.blocks.length),
    });
  }
  // the disposition rail, READ-ONLY for this principal: the steward reasons about what the owner
  // ruled on, and must never produce a label itself (a self-scored record is not evidence). A POST
  // here is not matched, so it falls through to the caller's "route not in scope" 403.
  if (url.pathname === "/api/dispositions" && req.method === "GET")
    return json(await readDispositions(Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? 500) | 0))));
  if (url.pathname === "/api/steward/autos" && req.method === "POST") {
    const home = stewardSlot();
    if (!home) return json({ error: "no steward slot active" }, 404);
    return createAutoForSlot(home, await readJson(req));
  }
  // steward files PENDING tasks (queue-automation.md item 1): its Rundgang observations become
  // reviewable proposals without any action capability — same stance as intake. The owner
  // create route fuses create+promote in one call (`body.queue === true` → queued), so for
  // this principal the status is HARD-FORCED to "pending" and any queue field is discarded —
  // "pending only" enforced in code, never convention (queue-automation.md "the line that must
  // not be crossed": producers write pending; only the owner promotes, dispatch stays dumb).
  if (url.pathname === "/api/steward/tasks" && req.method === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.text !== "string" || !body.text.trim()) return json({ error: "bad text" }, 400);
    // cap open steward proposals so a looping pulse can't flood the review buffer (caps are
    // mandatory — same stance as sends/autos). Review capacity is the binding constraint.
    const open = tasks.filter((t) => t.source === "steward" && t.status === "pending").length;
    if (open >= STEWARD_MAX_PENDING) return json({ error: `steward pending cap reached (${STEWARD_MAX_PENDING})` }, 409);
    const t: Task = {
      id: randomBytes(4).toString("hex"), text: body.text.slice(0, MAX_TASK_TEXT).trim(),
      source: "steward", from: null, status: "pending", created: Date.now(), slot: null, note: null,
    };
    tasks = capTasks([...tasks, t]);
    saveState();
    audit("steward_task", stewardSlot()?.id, t.id);
    return json({ ok: true, task: t });
  }
  if (url.pathname === "/api/steward/send" && req.method === "POST")
    return handleStewardSend(await readJson(req));
  // the ladder's fuel gauge (steward-intelligence.md §4): the durable per-class tally, the
  // open pending baselines, unreviewed crash candidates, and the promotion-eligibility verdict
  // per class. Read from STATE, never a journal scan (§3). `helped` under-counts (reply-
  // referencing deferred) — surfaced explicitly, not hidden.
  if (url.pathname === "/api/steward/outcomes" && req.method === "GET") {
    const eligibility: Record<string, boolean> = {};
    for (const cls of Object.keys(outcomeTally)) eligibility[cls] = promotionEligible(cls);
    return json({
      tally: outcomeTally,
      pending: outcomePending.map((p) => ({ slot: p.slot, class: p.class, ref: p.ref, sentAt: p.sentAt })),
      candidates: harmCandidates,
      eligibility,
      config: { minN: PROMOTION_MIN_N, windowMs: OUTCOME_WINDOW_MS, sustainMs: OUTCOME_SUSTAIN_MS,
        harmChannelActive: harmAttestFresh(), harmAttestAt, harmAttestTtlMs: HARM_ATTEST_TTL_MS },
      // A2 null-calibration: background "helped-looking" rate of active un-nudged slots. ADVISORY —
      // never gates promotion, never part of outcomeTally. Compare the nudged tally against this.
      // `rate`/`samples`/`helped` describe the rolling ring (capped at BASELINE_RING_CAP);
      // `seen`/`seenHelped` are the lifetime counters, monotone and cap-free, so "did the sampler
      // record anything" stays answerable after the ring saturates.
      baselineRate: { rate: baselineSamples.length ? baselineSamples.filter(Boolean).length / baselineSamples.length : null,
        samples: baselineSamples.length, helped: baselineSamples.filter(Boolean).length,
        cap: BASELINE_RING_CAP, seen: baselineSeen, seenHelped: baselineSeenHelped },
      helpedUndercount: "reply-referencing deferred — a pure reply/Q&A intervention records as no-effect (conservative: delays promotion, never enables a wrong one)",
    });
  }
  if (url.pathname === "/api/steward/journal" && req.method === "GET") {
    const tail = Math.min(50, Math.max(1, Number(url.searchParams.get("tail") ?? 1) | 0));
    return json({ records: await readStewardJournal(tail) });
  }
  if (url.pathname === "/api/steward/journal" && req.method === "POST") {
    const body = await readJson(req);
    if (!body) return json({ error: "invalid json" }, 400);
    // typed choke-point (same stance as typed sends): build the stored record ONLY from validated
    // fields, never spread the body, so no free-text/injected key can enter the ledger. The pulse
    // supplies its own judged counts; trust-sensitive outcome fields are back-filled server-side
    // later, never pane-asserted here.
    const counts = body.counts;
    if (typeof counts !== "object" || counts === null || Array.isArray(counts))
      return json({ error: "counts must be an object of condition->number" }, 400);
    const entries = Object.entries(counts as Record<string, unknown>);
    if (entries.length > 12 || entries.some(([k, v]) => k.length > 40 || typeof v !== "number" || !Number.isFinite(v)))
      return json({ error: "counts: ≤12 keys, each a finite number" }, 400);
    if (typeof body.decisions_surfaced !== "number" || !Number.isFinite(body.decisions_surfaced) || body.decisions_surfaced < 0)
      return json({ error: "decisions_surfaced must be a number ≥ 0" }, 400);
    if (typeof body.changed !== "boolean") return json({ error: "changed must be a boolean" }, 400);
    const note = typeof body.note === "string" ? body.note.slice(0, 280) : undefined;
    // the per-lane commit-cursor map is SERVER-computed and SERVER-stamped — a body-supplied
    // `lanes` key is ignored like every other unvalidated field (never-spread): fact, not claim.
    writeStewardJournal({
      kind: RUNDGANG_KIND,
      counts: Object.fromEntries(entries) as Record<string, number>,
      decisions_surfaced: body.decisions_surfaced,
      changed: body.changed,
      ...(note !== undefined ? { note } : {}),
      lanes: await laneFacts(),
    });
    audit("steward_journal", stewardSlot()?.id, `d:${body.decisions_surfaced} c:${body.changed}`);
    return json({ ok: true, ts: Date.now() });
  }
  return null;
}

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
        || /^\/(s\/[a-z0-9]+(\/(auth|info|send|diff|comments|brief|summary|transcript))?|ws-share\/[a-z0-9]+)$/.test(url.pathname);
      if (!pub) return new Response("not found", { status: 404 });
    }

    // self-scheduling: a session running INSIDE a lane schedules its own future check-in,
    // authenticated by its scoped FLEET_SELF_TOKEN (baked into the pane env — see ensureSlot)
    // instead of the owner token. Deliberately unreachable on the public share host (this
    // sits AFTER that gate, unlike /intake) — it's a local-machine credential, not a public
    // one. The target slot is HARD-DERIVED from which slot's token matches — any `slot`
    // field in the body is structurally never read (createAutoForSlot takes `s` directly),
    // so this route cannot be pointed at any slot but the token's own.
    if (url.pathname === "/api/self/autos" && req.method === "POST") {
      const given = req.headers.get("x-fleet-self-token") ?? "";
      const s = given ? slots.find((x) => x.cwd && x.selfToken && secretEq(given, x.selfToken)) : undefined;
      if (!s) { await Bun.sleep(400); return json({ error: "unauthorized" }, 401); } // flat cost, same as tokenGate
      return createAutoForSlot(s, await readJson(req));
    }

    // the disposition rail's hard rule, enforced HERE because the owner gate below would answer a
    // lane's credential with a generic 401 and hide WHY. A lane must never label its own work: a
    // recognized per-slot FLEET_SELF_TOKEN on this path — sent either as its own header or offered
    // as if it were the owner token — is a valid credential with the wrong scope, so 403, the same
    // distinction the steward gate draws below. Scoped to this one path on purpose: every other
    // route keeps its existing self-token behaviour untouched.
    if (url.pathname === "/api/dispositions") {
      const offered = [req.headers.get("x-fleet-self-token") ?? "", tokenFrom(req) ?? ""].filter(Boolean);
      if (offered.some((t) => slots.some((x) => x.cwd && x.selfToken && secretEq(t, x.selfToken))))
        return json({ error: "self token: the disposition rail is owner-only — a lane cannot label its own work" }, 403);
    }

    // steward principal: same placement rationale as self/autos above — sits AFTER the
    // SHARE_HOSTS gate, so a valid steward token is structurally unreachable from the public
    // tunnel. Any request carrying the steward token is intercepted HERE, before the owner
    // gate below: hitting an out-of-scope path (kill/land/share/open, or any owner route)
    // with a valid-but-wrong-scope credential is a 403 (told apart from tokenGate's 401,
    // which means "not a credential we recognize at all" and carries its throttle/audit).
    const stewardGiven = tokenFrom(req);
    if (stewardGiven && stewardToken && secretEq(stewardGiven, stewardToken)) {
      const r = await handleStewardRoute(req, url);
      return r ?? json({ error: "steward token: route not in scope" }, 403);
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
    const shareApi = /^\/s\/([a-z0-9]+)\/(auth|info|send|diff|comments|brief|summary|transcript)$/.exec(url.pathname);
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
          audit(locked ? "share_auth_lock" : "share_auth_fail", sh.slot); // never the guessed password
          await Bun.sleep(400); // flat cost per wrong guess
          return json({ error: locked ? "too many attempts — try again later" : "wrong password" }, locked ? 429 : 401);
        }
        audit("share_auth_ok", sh.slot);
        authFails.delete(sh.id);
        return new Response(JSON.stringify({ ok: true }), {
          headers: {
            "content-type": "application/json",
            // Lax (not Strict): the guest lands here from a cross-site click on the link
            "set-cookie": `share_${sh.id}=${sh.secret}; Path=/; SameSite=Lax; HttpOnly; Max-Age=604800`,
          },
        });
      }
      const shGate = await shareGate(req, sh);
      if (shGate) return shGate;
      if (shareApi[2] === "info") {
        // live pane size, never the cache alone: the guest builds its whole terminal
        // grid from this answer — cache fallback only if the pane is briefly gone
        let { cols, rows } = s;
        if (s.cwd) {
          const sz = await tmux("display-message", "-p", "-t", sess(s.id), "#{window_width} #{window_height}");
          const m = /^(\d+) (\d+)$/.exec(sz.out);
          if (m) { cols = Number(m[1]); rows = Number(m[2]); }
        }
        return json({
          slotLabel: s.cwd ? (s.label ?? s.cwd.split("/").pop()) : null,
          mode: sh.mode,
          cols,
          rows,
          active: !!s.cwd,
          viewers: [...s.clients].filter((c) => c.data.share === sh.id).length,
          comments: (shareComments[sh.id] ?? []).length,
        });
      }
      if (shareApi[2] === "diff") {
        // read-only "what did this session change" for guests — allowed in BOTH modes
        // (it types nothing into the pty), PR-review feel without repo access
        if (!s.cwd) return json({ error: "session gone" }, 404);
        const p = await diffPayload(s.cwd, await slotBase(s));
        if (!p) return json({ error: "not a git repository" }, 400);
        return json({ ...p, commits: await sessionCommits(s) });
      }
      if (shareApi[2] === "brief") {
        // read-only session overview for the guest info tab — the owner sideboard's
        // document minus local filesystem details (worktree/repo paths stay private)
        if (!s.cwd) return json({ error: "session gone" }, 404);
        const p = await briefPayload(s);
        if (!p) return json({ error: "not a git repository" }, 400);
        return json(p);
      }
      // the guest reader: the conversation as text. A phone can't render a 233-col pty
      // raster readably — but it CAN render the transcript. Guests get a REDUCED cut of
      // the owner payload: no thinking blocks (the TUI hides them — a guest must not see
      // more than the screen), tool_result capped hard (the TUI shows them collapsed;
      // full file contents that only scrolled past collapsed must not be readable here).
      if (shareApi[2] === "transcript") {
        if (!s.cwd) return json({ error: "session gone" }, 404);
        const p = await transcriptPayload(s, Number(url.searchParams.get("after") ?? 0));
        return json({
          ...p,
          entries: p.entries.map((e) => ({
            ...e,
            blocks: e.blocks.filter((b) => b.t !== "thinking")
              .map((b) => (b.t === "tool_result" ? { ...b, text: trim(b.text, 400) } : b)),
          })).filter((e) => e.blocks.length),
        });
      }
      if (shareApi[2] === "summary" && (req.method === "GET" || req.method === "POST")) {
        // guests get the same ✨ summary as the owner sideboard — POST is safe to expose:
        // single-flight per slot plus the git-state cache key bound how often the agent
        // can actually run, no matter how often a guest clicks
        if (!s.cwd) return json({ error: "session gone" }, 404);
        return summaryResponse(s, req.method === "POST");
      }
      if (shareApi[2] === "comments") {
        // guest thread on this share — allowed in BOTH modes, it types nothing into the pty
        if (req.method === "GET") return json({ comments: shareComments[sh.id] ?? [] });
        if (req.method === "POST") {
          if (commentStrike(sh.id)) return json({ error: "slow down — try again in a minute" }, 429);
          const body = await readJson(req);
          const text = body && typeof body.text === "string" ? body.text.trim() : "";
          if (!text || text.length > MAX_COMMENT_TEXT)
            return json({ error: `comment must be 1–${MAX_COMMENT_TEXT} chars` }, 400);
          const name = (body && typeof body.name === "string" ? body.name.trim() : "").slice(0, MAX_COMMENT_NAME) || "guest";
          const c: ShareComment = { id: randomBytes(4).toString("hex"), ts: Date.now(), name, text };
          shareComments[sh.id] = [...(shareComments[sh.id] ?? []), c].slice(-MAX_COMMENTS_PER_SHARE);
          saveState();
          return json({ ok: true, comment: c });
        }
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
      if (!sh) return json({ error: "unauthorized" }, 401);
      // same one counter as the HTTP share surfaces — a socket handshake is the cheapest
      // guess oracle of all if it is left out (no body to send, no response to parse)
      const wsGate = await shareGate(req, sh);
      if (wsGate) return wsGate;
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
        autosOn,
        quietHours,
        intake: !!INTAKE_SECRET,
        // verification tier 2: the newest post-land audit, or null when none has run (tier 2 off,
        // or no land since boot). Advisory FACT for the owner — it gates nothing; the client's job
        // is to make a `red`/`unknown` result impossible to miss and to name the land it followed.
        postLandAudit: postLandAuditSummary(),
        slots: slots.map((s) => {
          const sh = shares.find((x) => x.slot === s.id);
          return {
            id: s.id, cwd: s.cwd, label: s.label, lastOutput: s.lastOutput,
            git: gitInfo.get(s.id) ?? null, worktree: s.worktree, model: s.model,
            share: sh ? {
              id: sh.id, mode: sh.mode, password: sh.secret, created: sh.created,
              guests: [...s.clients].filter((c) => c.data.share === sh.id).length,
              comments: (shareComments[sh.id] ?? []).length,
            } : null,
            // a conflict resolution waiting for the owner to review + land — cheap in-memory
            // lookup (no git), so the tile can flag it without the board being open
            mergePending: mergeLast.get(s.id)?.status === "resolved",
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
      return json(await transcriptPayload(s, Number(url.searchParams.get("after") ?? 0)));
    }
    const histMatch = /^\/api\/slots\/(\d+)\/history$/.exec(url.pathname);
    if (req.method === "GET" && histMatch) {
      const s = slotFrom(histMatch[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      return json({ history: s.history });
    }
    // the global prompt directory: every composed send ever, across slots and slot
    // lifetimes, straight from the append-only prompts.jsonl. Sorted by ts (newest
    // first) — file order stopped meaning time order once backfill entries landed.
    if (url.pathname === "/api/prompts" && req.method === "GET") {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 300) | 0));
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const text = existsSync(PROMPT_LOG) ? await Bun.file(PROMPT_LOG).text() : "";
      const lines = text.split("\n").filter(Boolean);
      const all: { ts?: unknown; text?: unknown; label?: unknown; cwd?: unknown }[] = [];
      for (const line of lines) {
        try {
          const e = JSON.parse(line) as (typeof all)[number];
          if (q && !`${e.text} ${e.label ?? ""} ${e.cwd ?? ""}`.toLowerCase().includes(q)) continue;
          all.push(e);
        } catch {
          // a torn mid-append line — skip
        }
      }
      all.sort((a, b) => (typeof b.ts === "number" ? b.ts : 0) - (typeof a.ts === "number" ? a.ts : 0));
      return json({ prompts: all.slice(0, limit), total: lines.length });
    }
    // owner-only read of the audit trail — same access model as /api/prompts (token-gated
    // above, structurally unreachable on SHARE_HOSTS since that block 404s anything not in
    // its own allowlist before this line is ever reached). Last N lines, newest first.
    if (url.pathname === "/api/audit" && req.method === "GET") {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 300) | 0));
      const text = existsSync(AUDIT_FILE) ? await Bun.file(AUDIT_FILE).text() : "";
      const lines = text.split("\n").filter(Boolean);
      const events: { ts?: unknown; event?: unknown; slot?: unknown; detail?: unknown }[] = [];
      for (const line of lines) {
        try {
          events.push(JSON.parse(line) as (typeof events)[number]);
        } catch {
          // a torn mid-append line — skip
        }
      }
      events.sort((a, b) => (typeof b.ts === "number" ? b.ts : 0) - (typeof a.ts === "number" ? a.ts : 0));
      return json({ events: events.slice(0, limit), total: lines.length });
    }
    // owner-only, read-only per-lane outcome trail — EXACT same access model as /api/audit above:
    // token-gated (past the tokenGate at the top of this block) and structurally 404 on SHARE_HOSTS
    // (that gate rejects anything not in its share allowlist). Never writable from a client.
    if (url.pathname === "/api/lane-outcomes" && req.method === "GET") {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 300) | 0));
      const text = existsSync(LANE_OUTCOME_FILE) ? await Bun.file(LANE_OUTCOME_FILE).text() : "";
      const lines = text.split("\n").filter(Boolean);
      const outcomes: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          outcomes.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
          // a torn mid-append line — skip
        }
      }
      outcomes.sort((a, b) => (typeof b.ts === "number" ? b.ts : 0) - (typeof a.ts === "number" ? a.ts : 0));
      return json({ outcomes: outcomes.slice(0, limit), total: lines.length });
    }
    // owner-only, read-only post-land audit trail (verification tier 2) — EXACT same access model
    // as /api/lane-outcomes above. Newest first, so "which land was the last green audit, and which
    // lands came after a red one" is answered by walking this list from the top.
    if (url.pathname === "/api/post-land-audits" && req.method === "GET") {
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") ?? 100) | 0));
      const text = existsSync(POSTLAND_AUDIT_FILE) ? await Bun.file(POSTLAND_AUDIT_FILE).text() : "";
      const lines = text.split("\n").filter(Boolean);
      const audits: Record<string, unknown>[] = [];
      for (const line of lines) {
        try {
          audits.push(JSON.parse(line) as Record<string, unknown>);
        } catch {
          // a torn mid-append line — skip, same as the audit/outcome readers
        }
      }
      audits.sort((a, b) => (typeof b.at === "number" ? b.at : 0) - (typeof a.at === "number" ? a.at : 0));
      return json({ audits: audits.slice(0, limit), total: lines.length, configured: !!POSTLAND_AUDIT_CMD });
    }
    // the owner disposition rail (see the DISPOSITION region). GET is the same read model as the
    // two trails above; POST is the ONLY writer, and it is owner-only by construction — a lane's
    // self token is rejected with 403 before the owner gate (see the block above /api/self/autos),
    // and the steward token can only ever reach the GET (handleStewardRoute).
    if (url.pathname === "/api/dispositions" && req.method === "GET")
      return json(await readDispositions(Math.min(2000, Math.max(1, Number(url.searchParams.get("limit") ?? 500) | 0))));
    if (url.pathname === "/api/dispositions" && req.method === "POST")
      return writeDisposition(await readJson(req));
    // owner-only: read the steward's own scoped credential, to paste into the steward
    // pane's env (FLEET_STEWARD_TOKEN) by hand — same access model as /api/audit.
    if (url.pathname === "/api/steward/token" && req.method === "GET")
      return json({ token: stewardToken });
    // owner harm-label channel — the safety-critical half of the fuel (steward-intelligence.md
    // §4/§6). This is the ONLY writer of `harmed`: the owner is the harm oracle, harm is never
    // auto-measured or LLM-judged. `{ class }` (optionally confirming a crash candidate) marks a
    // class harmful → harmed++. `{ attest: true }` records that the owner is operating the channel
    // WITHOUT flagging harm (e.g. dismissing a crash candidate as coincidental). Either way the
    // channel's freshness window (re)starts, which is what lets promotionEligible() return true —
    // a harm-blind tally (no recent owner engagement, or none ever) promotes nothing.
    if (url.pathname === "/api/steward/outcomes/harm" && req.method === "POST") {
      const body = await readJson(req);
      if (!body) return json({ error: "invalid json" }, 400);
      if (body.attest === true && body.class === undefined) {
        harmAttestAt = Date.now(); // (re)start the freshness window; a stale attest reverts to harm-blind
        writeStewardJournal({ kind: "harm_channel_attest" });
        saveState();
        return json({ ok: true, harmChannelActive: harmAttestFresh(), harmAttestAt });
      }
      const cls = body.class;
      if (typeof cls !== "string" || !cls || cls.length > 40)
        return json({ error: "class must be a non-empty string ≤40 chars (or { attest: true })" }, 400);
      bumpTally(cls, "harmed");
      harmAttestAt = Date.now(); // the owner engaging the harm oracle (re)freshens the record's harm-awareness
      // clear a matching unreviewed crash candidate — the owner has now ruled on it
      const ref = typeof body.ref === "string" ? body.ref : undefined;
      const slotN = typeof body.slot === "number" ? body.slot : undefined;
      for (let i = harmCandidates.length - 1; i >= 0; i--)
        if (harmCandidates[i].class === cls && (ref === undefined || harmCandidates[i].ref === ref)
          && (slotN === undefined || harmCandidates[i].slot === slotN))
          harmCandidates.splice(i, 1);
      writeStewardJournal({ kind: "harm_confirmed", class: cls, ...(ref !== undefined ? { ref } : {}), ...(slotN !== undefined ? { slot: slotN } : {}) });
      audit("steward_journal", stewardSlot()?.id, `harm:${cls}`);
      saveState();
      return json({ ok: true, class: cls, tally: outcomeTally[cls], eligible: promotionEligible(cls) });
    }
    // ✨ rework a compose-box draft. Runs in the focused slot's cwd so repo context
    // (CLAUDE.md etc.) rides along; the result replaces the box, never auto-sends.
    // The slot's deterministic git state rides along as a DATA block — the same briefPayload
    // the sideboard shows — so the enhancer can ground a vague draft in a real path/branch
    // instead of returning it untouched. Facts only; it never sees the session itself.
    if (url.pathname === "/api/enhance" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.text !== "string" || !body.text.trim() || body.text.length > 20_000)
        return json({ error: "bad text" }, 400);
      const s = slotFrom(body.slot);
      // null on a non-repo cwd or no slot — buildEnhancePrompt says so explicitly rather
      // than silently emitting an empty block
      const facts = s?.cwd ? await briefPayload(s) : null;
      try {
        const prompt = await runEnhance(body.text.trim(), s?.cwd ?? HOME, facts);
        // draftId: the disposition rail's join key for this draft (see the DISPOSITION region).
        // Stamped here, not client-side — the key must not drift, and the plain-http Tailscale
        // origin has no crypto.subtle. Identical output → identical id, which is correct: the
        // label is about the CONTENT the owner ruled on.
        return json({ prompt, draftId: createHash("sha256").update(prompt).digest("hex").slice(0, 16) });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "enhance failed" }, 502);
      }
    }
    // lane review: what did the agent actually DO — tracked diff vs HEAD + untracked list.
    // Complements the transcript view (what it said). Byte-capped: a phone shouldn't
    // receive a megabyte lockfile diff.
    const diffMatch = /^\/api\/slots\/(\d+)\/diff$/.exec(url.pathname);
    if (req.method === "GET" && diffMatch) {
      const s = slotFrom(diffMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const p = await diffPayload(s.cwd, await slotBase(s));
      if (!p) return json({ error: "not a git repository" }, 400);
      return json({ ...p, worktree: s.worktree });
    }
    // guest comments, owner side: read the thread, reply into it, delete single comments
    const cmMatch = /^\/api\/slots\/(\d+)\/comments(?:\/([a-z0-9]+)\/delete)?$/.exec(url.pathname);
    if (cmMatch) {
      const s = slotFrom(cmMatch[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      const sh = shares.find((x) => x.slot === s.id);
      if (!sh) return json({ error: "slot not shared" }, 404);
      if (cmMatch[2] && req.method === "POST") {
        shareComments[sh.id] = (shareComments[sh.id] ?? []).filter((c) => c.id !== cmMatch[2]);
        saveState();
        return json({ ok: true });
      }
      if (!cmMatch[2] && req.method === "POST") {
        // owner reply — lands in the same thread, marked so guests see who's talking
        const body = await readJson(req);
        const text = body && typeof body.text === "string" ? body.text.trim() : "";
        if (!text || text.length > MAX_COMMENT_TEXT)
          return json({ error: `comment must be 1–${MAX_COMMENT_TEXT} chars` }, 400);
        const c: ShareComment = { id: randomBytes(4).toString("hex"), ts: Date.now(), name: "owner", text, from: "owner" };
        shareComments[sh.id] = [...(shareComments[sh.id] ?? []), c].slice(-MAX_COMMENTS_PER_SHARE);
        saveState();
        return json({ ok: true, comment: c });
      }
      if (!cmMatch[2] && req.method === "GET") return json({ comments: shareComments[sh.id] ?? [] });
      return json({ error: "bad request" }, 400);
    }
    // lane brief: the deterministic layer of the session overview — recent commits,
    // changed files, uncommitted summary. Everything here is fresh git output computed
    // per request (never cached), so the sideboard can't drift from reality.
    const briefMatch = /^\/api\/slots\/(\d+)\/brief$/.exec(url.pathname);
    if (req.method === "GET" && briefMatch) {
      const s = slotFrom(briefMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const p = await briefPayload(s);
      if (!p) return json({ error: "not a git repository" }, 400);
      return json({ ...p, worktree: s.worktree });
    }
    // lane map: every open worktree of the focused slot's repo — held by which slot,
    // dirty count, ahead/behind vs the primary checkout's HEAD. Includes ORPHANS
    // (worktrees whose slot was killed): previously invisible, now reattachable/removable.
    // Works from lane slots too: `worktree list` from a linked worktree covers the whole repo.
    const wtsMatch = /^\/api\/slots\/(\d+)\/worktrees$/.exec(url.pathname);
    if (req.method === "GET" && wtsMatch) {
      const s = slotFrom(wtsMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      const top = await git(s.cwd, "rev-parse", "--show-toplevel");
      if (top.code !== 0) return json({ error: "not a git repository" }, 400);
      const list = await listWorktrees(top.out);
      const primary = list.find((w) => w.primary);
      if (!primary) return json({ error: "no worktree info" }, 400);
      // ahead/behind measured against the integration branch, not the primary's HEAD (which may
      // be parked off it) — matches what land actually integrates onto
      const intb = (await integrationBranch(primary.path)) ?? "HEAD";
      const rows = [];
      for (const w of list) {
        if (w.primary) continue;
        const st = await git(w.path, "status", "--porcelain");
        const ab = await git(primary.path, "rev-list", "--left-right", "--count", `${w.branch}...${intb}`);
        const m = /^(\d+)\s+(\d+)$/.exec(ab.out);
        const holder = slots.find((x) => x.cwd === w.path);
        const risk = await worktreeRisk(primary.path, w.path);
        rows.push({
          path: w.path, branch: w.branch, slot: holder?.id ?? null,
          dirty: st.code === 0 ? st.out.split("\n").filter(Boolean).length : 0,
          ahead: m ? Number(m[1]) : 0, behind: m ? Number(m[2]) : 0,
          dirtyFiles: risk.dirtyFiles, unpushedCommits: risk.unpushedCommits,
          shortstat: risk.shortstat, empty: risk.empty,
          note: shelved[w.path]?.note ?? null, // shelve note, if this orphan was set aside
        });
      }
      return json({ repo: primary.path, main: intb !== "HEAD" ? intb : primary.branch, worktrees: rows });
    }
    // focused risk preview for a SLOT's own lane worktree — used by the client before
    // ⏏ land and before killing a lane-holding slot, neither of which had real git-state
    // context before this (kill in particular never checked git state at all)
    const riskMatch = /^\/api\/slots\/(\d+)\/risk$/.exec(url.pathname);
    if (req.method === "GET" && riskMatch) {
      const s = slotFrom(riskMatch[1]);
      if (!s || !s.cwd || !s.worktree) return json({ error: "not a fleet-created worktree lane" }, 400);
      const risk = await worktreeRisk(s.worktree.repo, s.cwd);
      return json({ path: s.cwd, branch: s.worktree.branch, ...risk });
    }
    // one-click lane: the server picks the first free slot itself (create), or re-seats an
    // orphaned worktree into a slot (attach) so it becomes reviewable/landable again
    if (url.pathname === "/api/lanes" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.repo !== "string" || !body.repo.trim()) return json({ error: "expected { repo }" }, 400);
      const laneModel = modelOf(body);
      if (!laneModel.ok) return json({ error: "bad model (charset [A-Za-z0-9._-], max 64)" }, 400);
      const free = slots.find((x) => !x.cwd && !laneSpawn.has(x.id));
      if (!free) return json({ error: "no free slot" }, 409);
      // the slot is reserved below, but for attach the WORKTREE is the contended resource too:
      // the "already open in a slot" check and openSlot are awaits apart, so two attach
      // requests for the same orphan would otherwise both pass it and double-seat the tree.
      // The attachBusy 409 must come BEFORE laneSpawn.add — a return before the try/finally
      // would otherwise leak the laneSpawn reservation and wedge the slot forever.
      const attachPath = typeof body.attach === "string" && body.attach ? body.attach : null;
      if (attachPath && attachBusy.has(attachPath)) return json({ error: "worktree is being attached" }, 409);
      laneSpawn.add(free.id); // reserve before the first await — see laneSpawn
      if (attachPath) attachBusy.add(attachPath);
      try {
        if (attachPath) {
          const top = await git(resolve(expandCwd(body.repo)), "rev-parse", "--show-toplevel");
          if (top.code !== 0) return json({ error: "not a git repository" }, 400);
          const wt = (await listWorktrees(top.out)).find((w) => !w.primary && w.path === attachPath);
          if (!wt) return json({ error: "not a worktree of this repo" }, 400);
          if (slots.some((x) => x.cwd === wt.path)) return json({ error: "worktree already open in a slot" }, 409);
          const attachBase = await integrationBranch(top.out);
          await openSlot(free, wt.path, { repo: top.out, branch: wt.branch, base: attachBase ?? undefined,
            baseSha: await laneForkSha(wt.path, attachBase) }, laneModel.model);
          free.label = wt.branch.replace(/^fleet\//, "⎇ ");
          delete shelved[wt.path]; // resuming clears the shelve note — the lane is active again
          saveState();
          void tickGit().catch(() => {});
          return json({ ok: true, slot: free.id, cwd: free.cwd, branch: wt.branch });
        }
        const r = await openLaneInSlot(free, body.repo, typeof body.branch === "string" ? body.branch : "", laneModel.model);
        return json({ ok: true, slot: free.id, cwd: r.cwd, branch: r.branch });
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "lane failed" }, 400);
      } finally {
        laneSpawn.delete(free.id);
        if (attachPath) attachBusy.delete(attachPath);
      }
    }
    // orphan cleanup: drop a worktree no slot holds — same safety net as ⏏ land
    if (url.pathname === "/api/worktrees/remove" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.repo !== "string" || typeof body.path !== "string")
        return json({ error: "expected { repo, path }" }, 400);
      if (attachBusy.has(body.path)) return json({ error: "worktree is being attached right now — try again in a moment" }, 409);
      const top = await git(resolve(expandCwd(body.repo)), "rev-parse", "--show-toplevel");
      if (top.code !== 0) return json({ error: "not a git repository" }, 400);
      const wt = (await listWorktrees(top.out)).find((w) => !w.primary && w.path === body.path);
      if (!wt) return json({ error: "not a worktree of this repo" }, 400);
      if (slots.some((x) => x.cwd === wt.path)) return json({ error: "worktree is open in a slot — land it there" }, 409);
      const fail = await removeWorktreeSafe(top.out, wt.path, wt.branch);
      if (fail) return json({ error: fail.error }, fail.code);
      void tickGit().catch(() => {});
      return json({ ok: true, removed: wt.path });
    }
    // ☠ deliberate destruction — the ONE path that may eat work. Force-removes the
    // worktree and deletes its branch; everything else in fleet refuses that. The client
    // gates the click behind a read-first confirm, the server re-checks identity: branch
    // rides along in the body so a click aimed at a stale board can't destroy whatever
    // lane replaced it. Head sha is captured first and returned — the one-line undo
    // (`git branch <name> <sha>`) keeps the commits recoverable until gc.
    if (url.pathname === "/api/worktrees/discard" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.repo !== "string" || typeof body.path !== "string" || typeof body.branch !== "string")
        return json({ error: "expected { repo, path, branch }" }, 400);
      if (attachBusy.has(body.path)) return json({ error: "worktree is being attached right now — try again in a moment" }, 409);
      const top = await git(resolve(expandCwd(body.repo)), "rev-parse", "--show-toplevel");
      if (top.code !== 0) return json({ error: "not a git repository" }, 400);
      const wt = (await listWorktrees(top.out)).find((w) => !w.primary && w.path === body.path);
      if (!wt) return json({ error: "not a worktree of this repo" }, 400);
      if (wt.branch !== body.branch) return json({ error: "lane changed since the board rendered — reload" }, 409);
      if (slots.some((x) => x.cwd === wt.path)) return json({ error: "worktree is open in a slot — kill the slot first" }, 409);
      const head = await git(wt.path, "rev-parse", "HEAD");
      const rmv = await git(top.out, "worktree", "remove", "--force", wt.path);
      if (rmv.code !== 0) return json({ error: `worktree remove failed: ${(rmv.err || rmv.out).slice(0, 300)}` }, 409);
      delete shelved[wt.path]; // worktree destroyed — drop any shelve note
      const branchDeleted = wt.branch !== "(detached)"
        && (await git(top.out, "branch", "-D", wt.branch)).code === 0;
      void tickGit().catch(() => {});
      return json({ ok: true, removed: wt.path, branch: wt.branch,
        head: head.code === 0 ? head.out : null, branchDeleted });
    }
    // set/clear a repo's integration branch — the branch lanes land into. Setting it lets the
    // owner park the primary checkout on a working branch while lanes still land onto `main`.
    // Empty branch clears it (back to deriving from the primary's HEAD). The branch must exist.
    if (url.pathname === "/api/repo-base" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.repo !== "string" || !body.repo.trim()) return json({ error: "expected { repo, branch }" }, 400);
      const top = await git(resolve(expandCwd(body.repo)), "rev-parse", "--show-toplevel");
      if (top.code !== 0) return json({ error: "not a git repository" }, 400);
      const branch = typeof body.branch === "string" ? body.branch.trim() : "";
      if (branch) {
        const ok = await git(top.out, "rev-parse", "--verify", "--quiet", `refs/heads/${branch}`);
        if (ok.code !== 0) return json({ error: `no such branch: ${branch}` }, 400);
        repoBases[top.out] = branch;
      } else {
        delete repoBases[top.out];
      }
      saveState();
      return json({ ok: true, repo: top.out, base: repoBases[top.out] ?? null });
    }
    // ↩ undo the last land on a repo — the one reversible pointer for the one action that
    // mutates main. GIT decides, never optimism: reset main back to where it was ONLY while
    // it is still EXACTLY where the land left it (nobody landed/committed on top) AND that
    // commit has reached no remote (undoing a pushed land would rewrite shared history).
    // Otherwise refuse with a precise reason — a safe refusal is the correct v1. The landed
    // branch is kept by land, so a reset leaves the work fully recoverable by reopening the lane.
    if (url.pathname === "/api/repos/undo-land" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.repo !== "string" || !body.repo.trim()) return json({ error: "expected { repo }" }, 400);
      const top = await git(resolve(expandCwd(body.repo)), "rev-parse", "--show-toplevel");
      if (top.code !== 0) return json({ error: "not a git repository" }, 400);
      const rec = undoLast.get(top.out);
      if (!rec) return json({ error: "nothing to undo — no recorded land for this repo" }, 404);
      const cur = await git(top.out, "rev-parse", rec.main);
      if (cur.code !== 0) return json({ error: `cannot resolve ${rec.main}` }, 400);
      // main moved since the land → the record is permanently unusable; consume it and refuse
      if (cur.out !== rec.mainAfter) {
        undoLast.delete(top.out); saveState();
        return json({ error: `${rec.main} moved since this land (landed at ${rec.mainAfter.slice(0, 8)}, now at ${cur.out.slice(0, 8)}) — nothing safely undoable. The '${rec.branch}' branch still exists if you need the work.` }, 409);
      }
      // already pushed → undo would rewrite shared history; permanent refusal, consume the record
      const onRemote = await git(top.out, "branch", "-r", "--contains", rec.mainAfter);
      if (onRemote.out.trim()) {
        undoLast.delete(top.out); saveState();
        return json({ error: `this land is already on a remote (${onRemote.out.trim().split("\n")[0].trim()}) — undo would rewrite shared history; revert it by hand instead.` }, 409);
      }
      const reset = await resetIntegration(top.out, rec.main, rec.mainAfter, rec.mainBefore);
      if (reset) return json({ error: reset.error }, 409); // transient (dirty holder etc.) — record kept for a retry
      emitLaneOutcome(await buildRevertedOutcome(top.out, rec)); // strongest negative outcome — record BEFORE consuming the undo record
      undoLast.delete(top.out); // an undo can be undone once
      saveState();
      audit("repo_undo_land", undefined, `${basename(top.out)} ${rec.branch} ${rec.mainAfter.slice(0, 8)}->${rec.mainBefore.slice(0, 8)}`);
      return json({ ok: true, repo: top.out, main: rec.main, branch: rec.branch, from: rec.mainAfter, to: rec.mainBefore,
        note: `${rec.main} reset to ${rec.mainBefore.slice(0, 8)}. The '${rec.branch}' branch still exists — reopen the lane to recover the work.` });
    }
    // ⏫ agent merge & land. POST: deterministic guards → start the background job (the
    // fuzzy middle: rebase + conflict resolution in the lane) → deterministic re-verify,
    // server-side ff-merge and landLane inside the job. GET: job state for the board's
    // poll (a conflictful rebase outlives any request-held connection, never synchronous).
    const mgMatch = /^\/api\/slots\/(\d+)\/merge$/.exec(url.pathname);
    if (mgMatch && (req.method === "GET" || req.method === "POST")) {
      const s = slotFrom(mgMatch[1]);
      if (!s || !s.cwd || !s.worktree) return json({ error: "not a fleet-created worktree lane" }, 400);
      if (req.method === "GET")
        return json({ running: mergeInflight.has(s.id) || mergeStart.has(s.id), last: mergeLast.get(s.id) ?? null,
          undoable: undoableFor(s.worktree.repo) });
      if (mergeInflight.has(s.id) || mergeStart.has(s.id)) return json({ running: true });
      mergeStart.add(s.id); // reserve BEFORE the first await — two parallel POSTs otherwise both start a rebase
      try {
        if (commitInflight.has(s.id)) return json({ status: "blocked", detail: "a commit is in progress on this lane — try again in a moment" });
        const body = await readJson(req);
        const { repo, branch } = s.worktree;
        const cwd = s.cwd;
        const st = await git(cwd, "status", "--porcelain");
        if (st.code !== 0) return json({ error: "git status failed — worktree gone?" }, 400);
        if (st.out) return json({ status: "blocked",
          detail: `uncommitted changes — commit them (or ask the session to) first:\n${st.out.slice(0, 400)}` });
        if (await gitOpInProgress(cwd)) return json({ status: "blocked", detail: "a git merge/rebase is in progress in this lane — finish or abort it in the session first" });
        // the idle gate guards a run that STARTS the agent — a confirm-land is a pure git ff
        // of an already-reviewed resolution, so the agent's own trailing pane output must not
        // block it (otherwise every confirm right after a resolve bounces off "let it settle").
        // the shared choke-point, idle-only: a land is an owner-initiated git ff, not automation,
        // so it deliberately waives the master stop + quiet hours (opts off) and only honors the
        // idle gate — and a confirm-land waives even that (idleMs 0), since it's a pure ff of an
        // already-reviewed resolution whose trailing pane output must not block it.
        const landGate = await canDeliver(s, { now: Date.now(), killSwitch: false, alive: false, quietHours: false, idleMs: body?.confirm ? 0 : MERGE_IDLE_MS });
        if (!landGate.ok) return json({ status: "blocked", detail: "the session is actively working right now — let it settle for a moment, then land" });
        const main = await integrationBranch(repo);
        if (!main) return json({ error: "cannot resolve the repo's main branch" }, 400);
        if (main === branch) return json({ error: "the integration branch is the lane branch itself" }, 409);
        // the collision guard only matters when the integration branch is checked out in a
        // working tree: an ff-merge THERE rewrites the lane's files on disk and git refuses if
        // one is uncommitted. When the integration branch is checked out nowhere (the primary
        // parked off it), landing advances the ref with branch -f and touches no working tree,
        // so a dirty primary is irrelevant — skip the guard entirely.
        const landHolder = (await listWorktrees(repo)).find((w) => w.branch === main);
        if (landHolder) {
          // an ff-merge rewrites ONLY the files the lane changed — so refuse the land only if
          // one of THOSE files is uncommitted in the holder tree. An unrelated dirty file
          // (e.g. a working HANDOFF.md the owner keeps editing) is left untouched by git's ff
          // and must not block; the old check refused on ANY dirty tracked file and wedged every
          // land behind an irrelevant edit. git's own --ff-only stays the final arbiter below.
          const pst = await git(landHolder.path, "status", "--porcelain");
          if (pst.code === 0 && pst.out) {
            const dirty = new Set(pst.out.split("\n")
              .filter((l) => l && !l.startsWith("??") && !l.startsWith("!!"))
              .map((l) => (l.includes(" -> ") ? l.slice(l.indexOf(" -> ") + 4) : l.slice(3)).trim()));
            if (dirty.size) {
              const mb = await git(repo, "merge-base", main, branch);
              const changed = mb.code === 0 && mb.out
                ? await git(repo, "diff", "--name-only", `${mb.out}..${branch}`)
                : { code: 1, out: "", err: "" };
              // couldn't compute the lane's file set → fall back to the safe (broad) refusal
              const collide = changed.code === 0
                ? changed.out.split("\n").map((f) => f.trim()).filter((f) => f && dirty.has(f))
                : [...dirty];
              if (collide.length) return json({ status: "blocked",
                detail: `${main} is checked out at ${landHolder.path} with uncommitted changes to ${collide.join(", ")} — the land would overwrite them; commit or stash there first` });
            }
          }
        }
        // confirm-land: the owner reviewed an agent conflict resolution and is landing it.
        // No agent, no trust in the stored verdict — the guarantee is purely git: main is an
        // ancestor of the (clean) lane branch, so the branch is genuinely rebased on top and
        // the ff-merge is safe. If main moved since the resolution the ancestry fails and we
        // send them back to re-run ⏫ (which re-rebases against the new main).
        if (body?.confirm === true) {
          // the "resolved" verdict the human is confirming — its resolver detail, conflicted
          // files, and verify result are the review story this land is owning. Read it BEFORE
          // the delete below so the provenance note carries what the owner actually reviewed.
          const reviewed = mergeLast.get(s.id);
          // atomic confirm-land: if main moved since the agent resolved, the earlier rebase is
          // stale — but the conflicts were already resolved once, so REPLAY those resolved
          // commits onto the CURRENT main and land in one step, instead of sending the owner
          // back through a full agent re-run. Only a re-rebase that CONFLICTS AGAIN (main
          // touched the same lines) genuinely needs the agent — then, and only then, fall back
          // to ⏫. rerere off: never silently replay a recorded resolution and land it unseen.
          let anc = await git(repo, "merge-base", "--is-ancestor", main, branch);
          if (anc.code !== 0) {
            const rb = await git(cwd, "-c", "rerere.enabled=false", "rebase", main);
            if (rb.code !== 0) {
              await git(cwd, "rebase", "--abort");
              return json({ status: "blocked",
                detail: `${main} moved and the resolution no longer replays cleanly onto it — re-run ⏫ merge to resolve against the new ${main}.` });
            }
            anc = await git(repo, "merge-base", "--is-ancestor", main, branch);
            if (anc.code !== 0) return json({ status: "error",
              detail: `re-rebased onto ${main}, but it is still not an ancestor — lane kept` }, 409);
          }
          const mainBefore = (await git(repo, "rev-parse", main)).out;
          // stale-verify guard: `verify.mainSha` bound the verdict to the main it verified
          // against — if main moved past it since (the replay above), the recorded green
          // never saw the landed state. MARK it stale rather than re-running: a re-run
          // would hold this request for the whole suite runtime (and its SIGTERM-only
          // timeout could hang the land). Owner latitude stands — stale never blocks.
          const rv = reviewed?.verify;
          const verifyProv = rv && rv.mainSha !== mainBefore ? { ...rv, stale: true } : rv;
          const adv = await advanceIntegration(repo, main, branch);
          if (adv) return json({ status: "error",
            detail: `fast-forwarding ${main} failed: ${adv.error} — lane kept` }, 409);
          const mainAfter = (await git(repo, "rev-parse", main)).out;
          // main HAS moved — record the land BEFORE the teardown, so a landLane failure
          // can never leave a moved main without its note + undo record
          await recordLand(repo, main, branch, mainBefore, mainAfter, {
            conflicted: reviewed?.conflicted, resolverDetail: reviewed?.detail,
            verify: verifyProv, confirmedByHuman: true });
          // the owner reviewed an agent-resolved conflict and confirm-landed it — record that shape:
          // resolvedConflict from the verdict's conflicted files, repairRounds it carried, human-confirmed.
          const land = await landLane(s, {
            resolvedConflict: (reviewed?.conflicted?.length ?? 0) > 0,
            repairRounds: reviewed?.repairRounds ?? 0,
            confirmedByHuman: true,
            verified: verifyProv ? verifyProv.ok : null,
            baseSha: mainBefore }); // the lane is rebased onto exactly this commit — its true fork point
          if ("error" in land) {
            saveState(); // the undo record must survive the failed teardown
            return json({ status: "merged", landed: false, branch, landError: land.error,
              detail: `landed on ${main} (recorded), but lane teardown failed: ${land.error}` }, land.code);
          }
          mergeLast.delete(s.id);
          saveState();
          return json({ status: "merged", landed: true, branch, detail: "reviewed resolution — landed" });
        }
        // already merged (by hand, or an empty lane)? No agent needed — land directly.
        // Against the integration branch, not the primary's HEAD (which may be parked off it).
        const done = await git(repo, "branch", "--merged", main, "--list", branch);
        if (done.out.trim()) {
          const land = await landLane(s, OWNER_LAND_FACTS);
          if ("error" in land) return json({ error: land.error }, land.code);
          return json({ status: "merged", landed: true, branch, detail: "already merged — landed without the agent" });
        }
        // ⏸ guard: a pending "resolved" verdict means agent-chosen conflict resolutions
        // are sitting in this lane awaiting a human eye. While the lane is still rebased
        // onto main, a plain re-run would sail through the clean path and LAND them
        // unreviewed — refuse and point back at review. Only when main has moved on is
        // the verdict genuinely stale; then a fresh run (which re-rebases) is the fix.
        if (mergeLast.get(s.id)?.status === "resolved") {
          const anc = await git(repo, "merge-base", "--is-ancestor", main, branch);
          if (anc.code === 0)
            return json({ running: false, last: mergeLast.get(s.id),
              status: "resolved", detail: "conflict resolution awaits your review — open the board and land it from there" });
        }
        mergeLast.delete(s.id); // a new run supersedes the previous verdict
        saveState();
        const job: Promise<void> = mergeJob(s, cwd, repo, branch, main)
          .finally(() => { if (mergeInflight.get(s.id) === job) mergeInflight.delete(s.id); });
        mergeInflight.set(s.id, job);
        return json({ running: true });
      } finally {
        mergeStart.delete(s.id);
      }
    }
    // the resolved lane's diff for review: exactly what will fast-forward onto main
    // (main..HEAD), byte-capped like the other diff surfaces
    const mgDiffMatch = /^\/api\/slots\/(\d+)\/merge-diff$/.exec(url.pathname);
    if (req.method === "GET" && mgDiffMatch) {
      const s = slotFrom(mgDiffMatch[1]);
      if (!s || !s.cwd || !s.worktree) return json({ error: "not a fleet-created worktree lane" }, 400);
      const main = await laneBaseRef(s);
      if (!main) return json({ error: "cannot resolve the repo's main branch" }, 400);
      // three-dot (from the merge-base): the lane's OWN changes, so a lane behind main
      // doesn't show main's divergent commits inverted
      const d = await git(s.cwd, "diff", `${main}...HEAD`, "--no-color");
      const diff = d.code === 0 ? d.out : "";
      const ns = await git(s.cwd, "diff", `${main}...HEAD`, "--name-only");
      return json({
        main, branch: s.worktree.branch,
        files: ns.code === 0 ? ns.out.split("\n").filter(Boolean) : [],
        diff: diff.length > DIFF_CAP ? `${diff.slice(0, DIFF_CAP)}\n… truncated` : diff,
        truncated: diff.length > DIFF_CAP,
      });
    }
    // session summary (the ✨ agent). GET = cache lookup only, never spawns.
    // POST = run the agent (single-flight per slot; concurrent clicks share one run).
    const sumMatch = /^\/api\/slots\/(\d+)\/summary$/.exec(url.pathname);
    if (sumMatch && (req.method === "GET" || req.method === "POST")) {
      const s = slotFrom(sumMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      return summaryResponse(s, req.method === "POST");
    }
    // 🔍 review of the slot's own code changes (the advisory reviewer). Owner-only — it has
    // no counterpart on the share surface. GET = cache lookup only, POST = run (single-flight).
    const revMatch = /^\/api\/slots\/(\d+)\/review$/.exec(url.pathname);
    if (revMatch && (req.method === "GET" || req.method === "POST")) {
      const s = slotFrom(revMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      return reviewResponse(s, req.method === "POST");
    }
    // 💾 commit a lane's uncommitted work — the SAVE that land/merge (dirty-tree refusers)
    // can't do. Lanes only; commit-only (never push, never land). Serialized per slot; the
    // real race protection is gitRetry's index.lock backoff against the live session.
    const ciMatch = /^\/api\/slots\/(\d+)\/commit$/.exec(url.pathname);
    if (req.method === "POST" && ciMatch) {
      const s = slotFrom(ciMatch[1]);
      if (!s || !s.cwd) return json({ error: "slot not active" }, 400);
      // commit works for main sessions too (commitLane uses `add -u` there — tracked only);
      // it stays refused only if the cwd isn't a git repo, which commitLane's status check catches
      const body = await readJson(req);
      const mode = body?.mode === "agent" ? "agent" : "quick";
      if (commitInflight.has(s.id)) return json({ error: "a commit is already running for this slot" }, 409);
      if (mergeInflight.has(s.id) || mergeStart.has(s.id)) return json({ error: "a merge/land is in progress on this lane — try again once it finishes" }, 409);
      commitInflight.add(s.id);
      try {
        return await commitLane(s, mode);
      } finally {
        commitInflight.delete(s.id);
      }
    }
    if (url.pathname === "/api/dirs") {
      try {
        return json(await listDirs(url.searchParams.get("path") ?? "~"));
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : "bad path" }, 400);
      }
    }
    // pin/unpin a folder in the picker. { on:false } unpins; anything else pins (most-recent-first,
    // capped at MAX_PINS). Persisted in fleet.json so pins follow the owner across devices.
    if (url.pathname === "/api/pins" && req.method === "POST") {
      const body = await readJson(req);
      if (!body || typeof body.path !== "string" || !body.path.trim()) return json({ error: "bad path" }, 400);
      const p = body.path.trim();
      pins = body.on === false ? pins.filter((x) => x !== p) : [p, ...pins.filter((x) => x !== p)].slice(0, MAX_PINS);
      saveState();
      return json({ ok: true, pins });
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
      // B1 (F-C): the owner's promote/dismiss of a STEWARD-origin proposal is a causally-clean,
      // deterministic `propose`-class outcome (unlike git deltas, accept/reject is directly
      // attributable). Fire ONCE per task, gated on the pending→ transition ONLY: promote counts
      // helped, dismiss counts the distinct `dismissed` signal. Deleting an already-promoted
      // (queued) proposal is cleanup, not a dismissal — the pending guard makes that a no-op, so a
      // promoted-then-deleted task can never double-count. Read the class BEFORE mutating status.
      const proposeOutcome: keyof OutcomeCounts | null =
        t.source === "steward" && t.status === "pending"
          ? (taskAct[2] === "queue" ? "helped" : taskAct[2] === "delete" ? "dismissed" : null)
          : null;
      if (taskAct[2] === "delete") tasks = tasks.filter((x) => x.id !== t.id);
      else if (taskAct[2] === "queue") { t.status = "queued"; t.note = null; }
      else if (taskAct[2] === "unqueue") t.status = "pending";
      else t.status = "done";
      if (proposeOutcome) {
        bumpTally("propose", proposeOutcome);
        writeStewardJournal({ kind: "propose_outcome", ref: t.id, outcome: proposeOutcome });
        audit("steward_propose_outcome", stewardSlot()?.id, `${t.id}:${proposeOutcome}`);
      }
      saveState();
      return json({ ok: true });
    }
    if (url.pathname === "/api/dispatch" && req.method === "POST") {
      const body = await readJson(req);
      if (!DISPATCH_REPO) return json({ error: "dispatcher unavailable — set FLEET_DISPATCH_REPO" }, 400);
      dispatchOn = body?.on === true;
      return json({ ok: true, on: dispatchOn });
    }
    if (url.pathname === "/api/autos/switch" && req.method === "POST") {
      const body = await readJson(req);
      const on = body?.on;
      if (typeof on !== "boolean") return json({ error: "body.on must be a boolean" }, 400);
      autosOn = on;
      saveState(); // a kill must survive an immediate restart, so persist now (not on next activity)
      audit("autos_switch", undefined, autosOn ? "on" : "off");
      return json({ ok: true, autosOn });
    }
    if (url.pathname === "/api/autos/quiet" && req.method === "POST") {
      const body = await readJson(req);
      if (body?.start == null) {
        quietHours = null;
      } else {
        const start = Number(body.start) | 0, end = Number(body.end) | 0;
        if (start < 0 || start > 23 || end < 0 || end > 23 || start === end)
          return json({ error: "start,end must be local hours 0-23 and differ" }, 400);
        quietHours = { start, end };
      }
      saveState();
      audit("autos_quiet", undefined, quietHours ? `${quietHours.start}-${quietHours.end}` : "off");
      return json({ ok: true, quietHours });
    }
    const autoCreate = /^\/api\/slots\/(\d+)\/autos$/.exec(url.pathname);
    if (req.method === "POST" && autoCreate) {
      const s = slotFrom(autoCreate[1]);
      if (!s) return json({ error: "bad slot" }, 400);
      return createAutoForSlot(s, await readJson(req), { allowPerpetual: true }); // owner may mint a perpetual (heartbeat) auto
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
    const slotMatch = /^\/api\/slots\/(\d+)\/(open|open-worktree|kill|rename|share|unshare|share-mode|land|shelve)$/.exec(url.pathname);
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
        audit("share_create", s.id, mode);
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
          audit("share_mode_change", s.id, mode);
          closeShareClients(s, sh.id, 4002, "share mode changed");
          saveState();
        }
        return json({ ok: true, mode: sh.mode });
      }
      if (slotMatch[2] === "unshare") {
        const sh = shares.find((x) => x.slot === s.id);
        if (sh) closeShareClients(s, sh.id);
        if (sh) audit("share_revoke", s.id);
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
        const mo = modelOf(body);
        if (!mo.ok) return json({ error: "bad model (charset [A-Za-z0-9._-], max 64)" }, 400);
        try {
          await openSlot(s, typeof body.cwd === "string" ? body.cwd : "~", null, mo.model);
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "open failed" }, 400);
        }
        void tickGit().catch(() => {}); // refresh the badge now, not on the next 10s tick
        return json({ ok: true, cwd: s.cwd });
      }
      if (slotMatch[2] === "open-worktree") {
        const body = await readJson(req);
        if (!body || typeof body.repo !== "string") return json({ error: "expected { repo }" }, 400);
        if (s.cwd || laneSpawn.has(s.id)) return json({ error: "slot already active — use a free slot" }, 400);
        const mo = modelOf(body);
        if (!mo.ok) return json({ error: "bad model (charset [A-Za-z0-9._-], max 64)" }, 400);
        laneSpawn.add(s.id); // reserve before the first await — see laneSpawn
        try {
          const r = await openLaneInSlot(s, body.repo, typeof body.branch === "string" ? body.branch : "", mo.model);
          return json({ ok: true, cwd: r.cwd, branch: r.branch });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "worktree failed" }, 400);
        } finally {
          laneSpawn.delete(s.id);
        }
      }
      if (slotMatch[2] === "land") {
        const land = await landLane(s, OWNER_LAND_FACTS);
        if ("error" in land) return json({ error: land.error }, land.code);
        return json({ ok: true, ...land });
      }
      if (slotMatch[2] === "shelve") {
        if (!s.cwd || !s.worktree) return json({ error: "not a fleet-created worktree lane" }, 400);
        const body = await readJson(req);
        const note = typeof body?.note === "string" ? body.note.slice(0, 500).trim() : "";
        shelved[s.cwd] = { at: Date.now(), note }; // keyed by worktree path; survives the kill below
        audit("slot_shelve", s.id, `note:${note.length}`); // never the note TEXT — same hygiene as prompt logging
        emitLaneOutcome(await buildLaneOutcome(s, "shelved")); // record BEFORE killSlot clears lane state
        await killSlot(s); // keeps the worktree on disk (as any kill does) — now WITH a note to resume from
        return json({ ok: true });
      }
      // plain kill (fall-through): record an abandoned lane's outcome before killSlot clears its
      // state. Gated on s.worktree — a plain (non-lane) session kill leaves no lane outcome.
      if (s.cwd && s.worktree) emitLaneOutcome(await buildLaneOutcome(s, "killed"));
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
      if (ws.data.share) audit("guest_ws_connect", s.id, ws.data.share);
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
      } else if (ws.data.share) {
        // guests never pass cols/rows (they must not resize the owner's pty), so they
        // can't take the resize+capture reseed above. Seed them from a plain capture-pane
        // at the pane's CURRENT size instead of slicing the raw stream: capture output is
        // line-aligned and already-reflowed, so it can't begin mid-escape-sequence and
        // it's a few KB rather than up to REPLAY_TAIL bytes pushed to a phone on every
        // reconnect — the raw-tail path desynced guest terminals (partial escapes stacked
        // onto un-reset scrollback) after the frequent WS drops mobile connections see.
        // Live bytes after this keep flowing from the shared offset via poll()/broadcast,
        // same as the owner reseed path. No -e (see that path): the styled-run cursor
        // jumps it bakes in would re-garble a narrower guest; history goes monochrome,
        // live output stays fully colored.
        const cap = await tmux("capture-pane", "-t", name, "-p", "-S", `-${SEED_LINES}`);
        ws.send(new TextEncoder().encode(crlf(cap.out) + "\r\n"));
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
      if (ws.data.share) audit("guest_ws_disconnect", ws.data.slot, ws.data.share);
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

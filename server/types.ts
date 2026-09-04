// server/types.ts — the persisted DOMAIN MODEL of the fleet and the parsers that lift a raw
// fleet.json value into it (`*From`/`load*`). Types and pure validators only: no holder, no
// tick, no route, no tmux. server.ts is the entry and owns the state; this module owns the shape
// of that state. Cut out of server.ts as P4 Slice 1 of the Generalsanierung
// (docs/sanierung-2026-09/plan-2026-08-31.md §P4 Punkt 1) — a MOVE, every declaration byte-identical
// to the server.ts line it came from.
import type { ServerWebSocket } from "bun";
import { ANALYSIS_BLOCKERS } from "../analysis-prompt";
import type { LaneWatchEventKind, LaneWatchEventPayload, MergeWatchEventPayload, AuditWatchEventPayload,
  DeployWatchEventPayload, CommandJobArtifactPayload, CommandJobWatchEventPayload, ClarificationEventPayload,
  ClarificationBasis } from "../lane-signals";
import type { RefineValidation } from "../refine-validate";
import { FLEET_REPORT_STATUSES, type FleetReportEventPayload, type FleetReportStatus, type LaneAnchor }
  from "../src/protocol";
import type { TaskCluster, TaskFilesOrigin } from "../task-metadata";

const MAX_SLOTS = 16; // fixed places — the sidebar always shows all of them

type DispatchSpawn = { harness: string | null; model: string | null; effort: string | null };

interface SlotStreamOccupant { slot: number; openedAt: number; selfToken: string }

interface BoxPin { container: string | null; containerContext: string | null }

type WSData = {
  slot: number; ready: boolean; cols: number; rows: number; force: boolean;
  // buffered until the seed has been sent (ready). `from` is each chunk's absolute offset in
  // the slot's stream file, carried so afterSeed can tell seed-overlap from new output.
  queue: { from: number; chunk: Uint8Array }[];
  // stream position this socket's capture-pane seed already covers: anything before it must
  // not be sent again (websocket.open sets it; afterSeed consumes it). 0 = nothing to skip.
  seedUntil: number;
  seed?: number; // client's scrollback budget for the connect seed; 0/absent = SEED_LINES
  share?: string; // set on guest connections: the share id this socket belongs to
  ownerInput?: { occupant: SlotStreamOccupant; paneId: string };
};

// a share exposes exactly ONE slot to a guest behind its own password — the owner
// token never leaves this machine. A share is a WINDOW and never a hand: it streams the pane
// out, and nothing a guest sends can reach the pty (dropped in the WS message handler, and
// there is no send route to drop it in). That is not a setting — removing the mode is what
// makes it a property. An interactive share would put a third party's keystrokes into the
// owner's session, i.e. their prompts billed as the owner's Inputs on the owner's account.
interface Share { id: string; slot: number; secret: string; created: number }

// a guest comment on a share — reachable by a guest because it types nothing into the pty.
// Freeform name is display-only, never trusted; keyed by share id so revoking the share
// drops its thread (pruned in saveState).
interface ShareComment { id: string; ts: number; name: string; text: string; from?: "owner" }

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

// --- a WATCH: the event-triggered sibling of an Auto. Same delivery (one prompt typed into one
// pane, through canDeliver), different trigger — a fact about ANOTHER slot instead of a clock.
// Armed on the server and survives a restart, because a watcher the RECEIVER has to re-arm fails
// exactly when the receiver is busy. It delivers TEXT and nothing else — no commit, land, review
// or kill; both predicates remove a WAIT, never a CHECK. The trigger is LEVEL, not edge
// (tickWatches), and firing spends the watch (`armed:false`): an armed-forever watch would be a
// repeating nudge on a cadence nobody chose. Why it exists (measured 2026-08-07):
// server-narrativ-archiv.md#watch
interface WatchBase {
  id: string;
  slot: number;    // who gets typed into. Same meaning `slot` has on an Auto, so the delivery
  // path, the per-slot cap and the teardown rules all read the same field.
  slotOpenedAt?: number; // the receiver occupant at subscribe time. Absent is an honest legacy
  // row: slot ids are recycled, so the current occupant must never be backfilled onto old Watches.
  idleSec: number; // the WATCHER's idle gate, same field and same default as an Auto. Not a
  // limitation but the point: the message should arrive when the receiving session comes to rest,
  // which is the exact moment it would otherwise turn away without knowing.
  armed: boolean;
  created: number;
  firedAt: number | null;
  lastResult: string | null;
  // WHERE THE COMPLETION GOES, decided by the SUBSCRIBER and nobody else. Absent is the legacy pane
  // default and is kept absent on load, byte-for-byte. "inbox" mints the event straight into the
  // owner operations inbox and no transport ever touches it (typing into an owner-attended TUI
  // would land in the owner's composer).
  delivery?: "pane" | "inbox";
}
// --- THE REMOTE COMMAND CONTRACT (Invariant 6) --------------------------------------------------
// A `command` job hands another machine a tree AND a command line, which is the one thing the two
// older job kinds never did: an audit and a lane-suite both run `cfg.suiteCmd`, a string the OWNER
// put in the helper's own config file on the helper's own machine. `command` inverts that — the
// string now comes over the wire from a session in this fleet — so the fleet, not the helper, is
// what has to be unable to say the wrong thing.
//
// TWO RULES, and they are checked in this order because the order is the property:
//   1. THE FORBIDDEN TOKENS ARE REFUSED FIRST AND UNCONDITIONALLY. `claude`, `codex` and `pi` are
//      the agent harnesses; a fleet that can post one of them to a helper has invented remote agent
//      spawn as a side effect of a build runner. Checking it BEFORE the allowlist is what makes the
//      refusal a property of the function rather than a property of today's allowlist contents:
//      widen the list below and the COMMAND STRING is still refused. A token is any `/`-, `\`- or
//      whitespace-separated word, so `./claude`, `/usr/bin/codex` and `bun claude` are the same
//      refusal as the bare name.
//
//      AND HERE IS WHAT THIS RULE DOES NOT SAY, because the earlier wording said it and was too
//      strong: THIS BINDS THE COMMAND STRING, NOT THE PROCESS TREE IT STARTS. Three of the six
//      allowlist entries (`bun run build`, `bun test`, `bun run verify`) run a `package.json`
//      script OUT OF THE SUBMITTED BUNDLE, and that file's contents are the caller's — e2e's own
//      fixture writes itself a `build` script and runs `bun run build` through it
//      (e2e/helper-daemon.ts, the `cmdjob` lane). So the refusal is a statement about what may be
//      NAMED here, and it is not, and cannot be, a statement about what the named script goes on
//      to execute on the other machine. NO REGRESSION IS IMPLIED: the portal path has always run
//      submitted repo code through `suiteCmd`, and this check does exactly the right thing at its
//      own place. What changed is only the size of the promise written around it.
//   2. THE COMMAND MUST BE AN EXACT ALLOWLIST KEY, and the value is the ARGV it runs as. Argv, not
//      a string: the helper never hands this to `sh -c`, so there is no quoting, no glob, no `&&`
//      and no substitution anywhere on the path — which is also why the allowlist can be an exact
//      match instead of a parser. Adding an entry is a source change under review, by design.
const HELPER_CMD_MAX = 200;
const HELPER_CMD_ALLOW: Readonly<Record<string, readonly string[]>> = {
  "bun run build": ["bun", "run", "build"],
  "bun test": ["bun", "test"],
  "bun run verify": ["bun", "run", "verify"],
  "./e2e-isolated.sh": ["./e2e-isolated.sh"],
  "./e2e-security.sh": ["./e2e-security.sh"],
  "bun e2e/pins.ts": ["bun", "e2e/pins.ts"],
};
const HELPER_CMD_FORBIDDEN: readonly string[] = ["claude", "codex", "pi"];
type HelperCmdCheck = { ok: true; cmd: string; argv: string[] } | { ok: false; error: string };
function helperCmdCheck(raw: unknown): HelperCmdCheck {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "cmd must be a non-empty string" };
  const cmd = raw.trim();
  if (cmd.length > HELPER_CMD_MAX) return { ok: false, error: `cmd must be at most ${HELPER_CMD_MAX} chars` };
  const tokens = cmd.toLowerCase().split(/[\s/\\]+/).filter(Boolean);
  const hit = HELPER_CMD_FORBIDDEN.find((f) => tokens.includes(f));
  if (hit) return { ok: false, error: `cmd names the agent harness ${JSON.stringify(hit)} — a remote command job's command line may never name an agent (this binds the command string, not what an allowlisted script goes on to run)` };
  const argv = HELPER_CMD_ALLOW[cmd];
  if (!argv) return { ok: false, error: `cmd is not on the helper allowlist — it is one of [${Object.keys(HELPER_CMD_ALLOW).join(" | ")}]` };
  return { ok: true, cmd, argv: [...argv] };
}
// The artefact GLOBS a job asks for, and the artefact ROWS a helper reports back. Both sides live
// here so the request shape and the receipt shape cannot drift apart: the second is what the first
// is allowed to produce. A path is relative and may not climb — `..` anywhere, an absolute path or
// a backslash is refused rather than normalised, because a receipt naming a path outside the clone
// is a receipt about a file this rail never handed over.
const HELPER_ARTIFACT_GLOB_MAX = 20;
const HELPER_ARTIFACT_MAX = 50;
const HELPER_ARTIFACT_PATH_MAX = 300;
const helperArtifactPathOk = (p: string): boolean =>
  p.length > 0 && p.length <= HELPER_ARTIFACT_PATH_MAX && !p.startsWith("/") && !p.includes("\\")
  && !p.split("/").some((seg) => seg === ".." || seg === "")
  && ![...p].some((ch) => ch < " " || ch === "\u007f");
function helperArtifactGlobsFrom(raw: unknown): { ok: true; globs: string[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, globs: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "artifacts must be an array of globs relative to the clone" };
  if (raw.length > HELPER_ARTIFACT_GLOB_MAX)
    return { ok: false, error: `at most ${HELPER_ARTIFACT_GLOB_MAX} artifact globs` };
  const globs: string[] = [];
  for (const g of raw) {
    if (typeof g !== "string" || !helperArtifactPathOk(g.trim()))
      return { ok: false, error: `artifact glob ${JSON.stringify(String(g).slice(0, 60))} must be relative, non-empty and free of ".."` };
    globs.push(g.trim());
  }
  return { ok: true, globs };
}
// null = the field was present and MALFORMED, which is not the same fact as an empty list and must
// never collapse into it: an empty list is "nothing matched", a malformed one is "this helper is
// not speaking the contract" and the caller turns it into a refusal.
function helperArtifactsFrom(raw: unknown): CommandJobArtifactPayload[] | null {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > HELPER_ARTIFACT_MAX) return null;
  const out: CommandJobArtifactPayload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const a = item as Record<string, unknown>;
    if (typeof a.path !== "string" || !helperArtifactPathOk(a.path)) return null;
    if (typeof a.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(a.sha256)) return null;
    if (typeof a.bytes !== "number" || !Number.isInteger(a.bytes) || a.bytes < 0) return null;
    out.push({ path: a.path, sha256: a.sha256, bytes: a.bytes });
  }
  return out;
}

interface LaneWatch extends WatchBase {
  // Absent on legacy persisted rows and kept absent after load; `watchKind` supplies the discriminator.
  kind?: "lane";
  target: number;  // the slot being watched. Never the same as `slot` (a session watching itself
  // learns nothing) and never a slot the predicate cannot classify — see createWatchForSlot.
  // the target's IDENTITY at subscribe time: slot ids are recycled, so an id-only watch would
  // survive its subject and fire about whatever lane moved in next. Second lock after
  // dropWatchesFor; the tick refuses a target whose cwd or branch changed underneath it.
  targetCwd: string;
  targetBranch: string;
}
interface MergeWatch extends WatchBase {
  kind: "merge";
  target: number;
  targetCwd: string;
  targetBranch: string;
}
interface AuditWatch extends WatchBase {
  kind: "audit";
  repo: string;
  mainAfter: string;
}
interface DeployWatch extends WatchBase {
  kind: "deploy";
  deployId: string;
}
// The remote COMMAND JOB's subscription. `jobId` and not `target`: the request body names the job
// `target` for symmetry with the lane/merge kinds, but those two targets are SLOT NUMBERS and this
// one is a 12-hex job id. Storing it under its own name is what keeps every `"target" in w` narrow
// in this file honest — a second meaning on one field is how a watch fires about the wrong subject.
interface CommandJobWatch extends WatchBase {
  kind: "job";
  jobId: string;
}
// STN-1: the Supervisor→Controller transition rail. The ONLY Watch kind triggered by a principal's
// act (the bound Supervisor completing it) rather than a level the tick computes, and the only one
// with a deadline, so a Controller can read "X never came" from its own row instead of waiting forever.
interface TransitionWatch extends WatchBase {
  kind: "transition";
  awaiting: string;     // the Controller's bounded statement of WHAT transition it expects
  deadlineAt: number;   // absolute ms; the tick disarms past it with lastResult "expired"
}
type Watch = LaneWatch | MergeWatch | AuditWatch | DeployWatch | TransitionWatch | CommandJobWatch;
const watchKind = (w: Watch): "lane" | "merge" | "audit" | "deploy" | "transition" | "job" => w.kind ?? "lane";
const TRANSITION_AWAITING_MAX = 500;
const TRANSITION_DEADLINE_MIN_SEC = 60;
const TRANSITION_DEADLINE_MAX_SEC = 86_400;
const TRANSITION_DEADLINE_DEFAULT_SEC = 3_600;
function watchFrom(raw: unknown): Watch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw as Partial<Watch> & Record<string, unknown>;
  if (typeof w.id !== "string" || typeof w.slot !== "number" || typeof w.idleSec !== "number"
    || typeof w.armed !== "boolean") return null;
  if (w.slotOpenedAt !== undefined && (typeof w.slotOpenedAt !== "number"
    || !Number.isFinite(w.slotOpenedAt) || w.slotOpenedAt <= 0)) return null;
  // absent = legacy pane. A present-but-unknown value is fail-closed, never coerced to a default:
  // guessing here would silently give a subscription a transport its subscriber did not ask for.
  if (w.delivery !== undefined && w.delivery !== "pane" && w.delivery !== "inbox") return null;
  if (w.kind === "audit") {
    return typeof w.repo === "string" && typeof w.mainAfter === "string" ? raw as AuditWatch : null;
  }
  if (w.kind === "deploy") {
    return typeof w.deployId === "string" && /^[0-9a-f]{8}$/.test(w.deployId) ? raw as DeployWatch : null;
  }
  if (w.kind === "job") {
    return typeof w.jobId === "string" && /^[0-9a-f]{12}$/.test(w.jobId) ? raw as CommandJobWatch : null;
  }
  if (w.kind === "transition") {
    // pane-only by construction (the inbox is the owner's, not a Controller's): a persisted row
    // claiming inbox delivery is malformed, not a transport choice.
    return typeof w.awaiting === "string" && w.awaiting.trim().length > 0
      && w.awaiting.length <= TRANSITION_AWAITING_MAX
      && typeof w.deadlineAt === "number" && Number.isFinite(w.deadlineAt) && w.deadlineAt > 0
      && w.delivery !== "inbox" ? raw as TransitionWatch : null;
  }
  if (w.kind !== undefined && w.kind !== "lane" && w.kind !== "merge") return null;
  return typeof w.target === "number" && typeof w.targetCwd === "string" && typeof w.targetBranch === "string"
    ? raw as LaneWatch | MergeWatch : null;
}

// "inbox" is the ONE word the transport split adds: the event is visible to the owner operations
// inbox and waits for the OWNER's acknowledgement. It is not a transport state — FACT 2 selects
// `pending` alone, so an inbox row can never be sent, and `deliveredAt` therefore stays null on it
// forever. Terminal remains acknowledged|receiver-gone for both delivery modes.
// "subject-gone" is the SUBJECT-side twin of "receiver-gone", and it exists because the two losses
// are not the same loss: the receiver is alive, the lane the row reports on is not. Terminal, never
// delivered, never acknowledgeable, and it spends no delivery budget. The measured incident that
// minted the word (2026-08-30): server-narrativ-archiv.md#fleeteventstatus
type FleetEventStatus = "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone"
  | "subject-gone" | "inbox";
// The three words that mean "this row is finished, whatever happened to it" — read by retention,
// by both budget sums, by the boot reconciliation and by every teardown sweep. One list, because a
// word added to the union and forgotten in one of those five places is a silent debt or a silent
// resurrection, not a type error.
const FLEET_EVENT_TERMINAL: readonly string[] = ["acknowledged", "receiver-gone", "subject-gone"];
type FleetEventRecoveryState = "retryable" | "blocked" | "terminal";
interface FleetEventRecovery {
  state: FleetEventRecoveryState;
  reason: string;
  nextAction: string;
  effect: string;
  updatedAt: number;
}
interface FleetEventBase {
  id: string;
  watchId: string | null;
  // NULL IS THE OWNER PRINCIPAL — the whole triple or none of it. Every other row names a
  // SESSION: slot ids are reusable, so the slot number identifies the row and openedAt +
  // sessionId identify the session in it (the same binding MAIN-direct provenance uses). The
  // owner is not a session. There is no pane to type into, no generation to compare, and nothing
  // that can be "replaced" — inventing an occupant for him would make three fields lie, and the
  // first slot teardown that reused that number would turn his row `receiver-gone` while it was
  // still unread. `null` therefore means exactly one transport: delivery "inbox", read and
  // acknowledged by the owner, and structurally unreachable for every slot-keyed filter here.
  receiverSlot: number | null;
  receiverOpenedAt: number | null;
  receiverSessionId: string | null;
  receiverIdleSec: number;
  createdAt: number;
  status: FleetEventStatus;
  attempts: number;
  deliveredAt: number | null;
  acknowledgedAt: number | null;
  // inherited from the Watch that minted it, absent = legacy pane. It is copied onto the event
  // rather than looked up through `watchId` because the Watch is prunable and the event is not:
  // the row must still say by itself which transport it was minted for.
  delivery?: "pane" | "inbox";
  recovery?: FleetEventRecovery;
}
interface LaneFleetEvent extends FleetEventBase {
  subjectSlot: number;
  subjectBranch: string;
  kind: LaneWatchEventKind;
  payload: LaneWatchEventPayload;
  // THE SUBJECT LIFECYCLE, not merely its slot number — the same fact the receiver triple carries
  // for the other endpoint. Slot ids are reusable, so only the occupancy timestamp separates "the
  // lane this row reports on" from "whoever holds that number now". Optional: a row minted before
  // this existed hydrates without it and is then judged on slot+branch alone (laneEventSubject).
  subjectOpenedAt?: number;
}
interface MergeFleetEvent extends FleetEventBase {
  subjectSlot: number;
  subjectCwd: string;
  subjectBranch: string;
  kind: "merge-terminal";
  payload: MergeWatchEventPayload;
}
interface AuditFleetEvent extends FleetEventBase {
  subjectRepo: string;
  subjectMainAfter: string;
  kind: "post-land-audit";
  payload: AuditWatchEventPayload;
}
interface DeployFleetEvent extends FleetEventBase {
  subjectDeployId: string;
  kind: "deploy-terminal";
  payload: DeployWatchEventPayload;
}
interface CommandJobFleetEvent extends FleetEventBase {
  subjectJobId: string;
  kind: "command-job";
  payload: CommandJobWatchEventPayload;
}
interface ClarificationFleetEvent extends FleetEventBase {
  subjectSlot: number;
  subjectBranch: string;
  kind: "clarification-request";
  payload: ClarificationEventPayload;
}
interface FleetReportFleetEvent extends FleetEventBase {
  subjectSlot: number;
  subjectBranch: string;
  kind: "fleet-report";
  payload: FleetReportEventPayload;
}
// STN-1. The subject is the Supervisor occupant that completed the Watch — stamped, never claimed —
// and the payload carries the Controller's own `awaiting` back beside the Supervisor's text, so
// the receiver can match the notification to the question it asked without a second read.
interface SupervisorTransitionEventPayload {
  watchId: string;
  awaiting: string;
  text: string;
  completedAt: number;
}
interface SupervisorTransitionFleetEvent extends FleetEventBase {
  subjectSlot: number;
  subjectOpenedAt: number;
  kind: "supervisor-transition";
  payload: SupervisorTransitionEventPayload;
}
type FleetEvent = LaneFleetEvent | MergeFleetEvent | AuditFleetEvent | DeployFleetEvent
  | CommandJobFleetEvent | ClarificationFleetEvent | FleetReportFleetEvent | SupervisorTransitionFleetEvent;

// `send-uncertain` mirrors the FleetEvent transport state exactly (see FACT 2 in tickWatches): it is
// persisted BEFORE tmux is touched, so a process death anywhere after that point is visible after
// restart instead of leaving a reply that may or may not have reached the worker's pane. It is NOT
// terminal — terminal is answered|refused only — and it is never replayed by any tick: the one
// principal that could have seen the pane must drive the retry, byte-identically.
type ClarificationStatus = "open" | "send-uncertain" | "answered" | "refused";
interface ClarificationRequest {
  id: string;
  askedAt: number;
  question: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null };
  receiver: { slot: number; openedAt: number; sessionId: string | null };
  basis: ClarificationBasis;
  eventId: string;
  status: ClarificationStatus;
  answer: { text: string; at: number;
    by: { slot: number; openedAt: number; sessionId: string | null } } | null;
  refusedReason: string | null;
  closedAt: number | null;
}

// THE JUDGEMENT VOCABULARY, and it is deliberately NOT a transport word. A FleetEvent status says
// whether BYTES reached a pane; these two say whether the receiving MAIN read the work and took it.
// Until this cut the only door a MAIN had was the event ACK, which by contract is a receipt — so a
// successor reconstructing a Program could not tell an accepted report from an unread one.
const FLEET_REPORT_DISPOSITIONS = ["accepted", "rejected"] as const;
type FleetReportDisposition = typeof FLEET_REPORT_DISPOSITIONS[number];
// ONE object rather than four parallel fields, for the reason ClarificationRequest.answer is one:
// "who decided, when, which way and why" is a single fact, and a row carrying three of the four
// would be a half-decision no reader could adjudicate. `reason` is optional PROSE and stays null
// when the deciding MAIN gave none — an empty string would read as "they wrote nothing", which is
// a different claim from "they were not asked to".
interface FleetReportDecision {
  disposition: FleetReportDisposition;
  at: number;
  by: { slot: number; openedAt: number; sessionId: string | null };
  reason: string | null;
}

// A report is the immutable result sibling of a ClarificationRequest. Transport state belongs to
// its FleetEvent; this row carries only the lane-stamped report and the exact two endpoint
// occupants. In particular there is no attempt/task lifecycle identity here.
interface FleetReport {
  id: string;
  reportedAt: number;
  status: FleetReportStatus;
  text: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null };
  // null exactly when `basis` is "owner-inbox": the report was filed to the owner principal, who
  // has no occupant triple. The two fields are one fact and fleetReportFrom checks them together.
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: FleetReportEventPayload["basis"];
  eventId: string;
  // THE ACCEPTANCE FACT, and undecided is the ABSENCE of the key or an explicit null: a row
  // persisted before this door existed carries neither and stays observably undecided rather than
  // being repaired into a judgement nobody made. It is bound to the RECEIVER half above and
  // fleetReportFrom checks the two together — an owner-inbox row (receiver null) can structurally
  // never carry one, because the owner is a principal with no occupant to be the decider.
  decision?: FleetReportDecision | null;
}

// THE OWNER-FACING TWIN of ClarificationRequest, with the roles flipped: there a worker asks its
// bound Program-MAIN, here the bound Program-MAIN asks the OWNER. The owner is a PRINCIPAL, not a
// slot — there is no occupant triple to bind an answer to and none is invented, which is why
// `answer.by` is the literal "owner" rather than the receiver occupant a clarification carries.
// Everything else is deliberately the same shape, including `send-uncertain`: the answer travels
// into the requester's pane over the same transport, so it inherits the same crash boundary.
type AttentionKind = "decision" | "blocked" | "review-ready";
type AttentionStatus = "open" | "send-uncertain" | "answered" | "refused";
interface AttentionRequest {
  id: string;
  raisedAt: number;
  kind: AttentionKind;
  text: string;
  requester: { slot: number; openedAt: number; sessionId: string | null };
  programId: string;
  // Absent means a pre-provenance persisted row and stays observably absent. New rows always carry
  // all five keys; null means the caller explicitly had no fact for that key.
  provenance?: { taskId: string | null; originId: string | null; programId: string | null;
    branch: string | null; candidateSha: string | null };
  status: AttentionStatus;
  answer: { text: string; at: number; by: "owner" } | null;
  refusedReason: string | null;
  closedAt: number | null;
}
const ATTENTION_KINDS: AttentionKind[] = ["decision", "blocked", "review-ready"];

function fleetEventRecoveryFrom(raw: unknown): FleetEventRecovery | undefined | null {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<FleetEventRecovery>;
  if (r.state !== "retryable" && r.state !== "blocked" && r.state !== "terminal") return null;
  if (typeof r.reason !== "string" || !r.reason.trim() || r.reason.length > 300) return null;
  if (typeof r.nextAction !== "string" || !r.nextAction.trim() || r.nextAction.length > 300) return null;
  if (typeof r.effect !== "string" || !r.effect.trim() || r.effect.length > 300) return null;
  if (typeof r.updatedAt !== "number" || !Number.isFinite(r.updatedAt) || r.updatedAt <= 0) return null;
  return {
    state: r.state,
    reason: r.reason,
    nextAction: r.nextAction,
    effect: r.effect,
    updatedAt: r.updatedAt,
  };
}

function fleetEventFrom(raw: unknown): FleetEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Partial<FleetEvent> & Record<string, unknown>;
  const watchless = e.kind === "clarification-request" || e.kind === "fleet-report";
  // The owner-principal receiver, all three fields or none: a half-null triple is malformed, not a
  // transport choice — exactly as an unknown `delivery` is.
  const ownerReceiver = e.receiverSlot === null && e.receiverOpenedAt === null
    && e.receiverSessionId === null;
  const recovery = fleetEventRecoveryFrom(e.recovery);
  if (recovery === null
    || typeof e.id !== "string" || !/^[a-z0-9]+$/.test(e.id)
    || !(e.watchId === null || (typeof e.watchId === "string" && /^[a-z0-9]+$/.test(e.watchId)))
    || (watchless !== (e.watchId === null))
    || !(ownerReceiver || (Number.isInteger(e.receiverSlot) && (e.receiverSlot ?? 0) > 0
      && typeof e.receiverOpenedAt === "number" && Number.isFinite(e.receiverOpenedAt)
      && e.receiverOpenedAt > 0
      && (typeof e.receiverSessionId === "string" || e.receiverSessionId === null)))
    || !Number.isInteger(e.receiverIdleSec) || (e.receiverIdleSec ?? -1) < 0
    || !["pending", "send-uncertain", "delivered", "acknowledged", "receiver-gone", "subject-gone",
      "inbox"].includes(String(e.status))
    // absent = legacy pane; an unknown value is fail-closed exactly as it is on the Watch.
    || (e.delivery !== undefined && e.delivery !== "pane" && e.delivery !== "inbox")
    // A clarification is NEVER an inbox row — an inbox cannot answer, so such a row would be a
    // question nobody could close. A fleet-report is an inbox row EXACTLY when its receiver is the
    // owner principal: the two facts are one fact, checked as an equivalence so neither half can
    // be persisted without the other (a slot-bound inbox report would be typed at nobody; an
    // owner-receiver pane report would be typed at a pane that does not exist).
    || (e.kind === "clarification-request" && e.delivery === "inbox")
    // THE OWNER PRINCIPAL EXISTS FOR EXACTLY ONE KIND. Every other event is a Watch completion
    // addressed to the session that subscribed, and a null triple there names nobody at all: it
    // could never be delivered, never go receiver-gone, and never be acked by the session it was
    // minted for — but it WOULD count as an owner debt and squat a place at the inbox ceiling
    // until someone acked a row they never asked for. Fail-closed, at the base, before any
    // per-kind branch can be reasoned about separately.
    || (ownerReceiver && e.kind !== "fleet-report")
    || (e.kind === "fleet-report" && (e.delivery === "inbox") !== ownerReceiver)
    // FACT 2 selects `pending` alone, so an owner row can never be sent and can never go
    // receiver-gone: `inbox` until the owner acks it, `acknowledged` after. Anything else on such
    // a row is a state no code path can produce and is refused rather than repaired.
    || (ownerReceiver && e.status !== "inbox" && e.status !== "acknowledged")
    || typeof e.createdAt !== "number" || !Number.isFinite(e.createdAt) || e.createdAt <= 0
    || !Number.isInteger(e.attempts) || (e.attempts ?? -1) < 0
    || !(typeof e.deliveredAt === "number" || e.deliveredAt === null)
    || !(typeof e.acknowledgedAt === "number" || e.acknowledgedAt === null)) return null;
  const base: FleetEventBase = {
    id: e.id, watchId: e.watchId, receiverSlot: e.receiverSlot ?? null,
    receiverOpenedAt: e.receiverOpenedAt ?? null,
    receiverSessionId: e.receiverSessionId ?? null, receiverIdleSec: e.receiverIdleSec!,
    createdAt: e.createdAt, status: e.status as FleetEventStatus, attempts: e.attempts!,
    deliveredAt: e.deliveredAt, acknowledgedAt: e.acknowledgedAt,
    ...(e.delivery !== undefined ? { delivery: e.delivery as "pane" | "inbox" } : {}),
    ...(recovery ? { recovery } : {}),
  };
  if (e.kind === "clarification-request") {
    if (!Number.isInteger(e.subjectSlot) || Number(e.subjectSlot) <= 0 || typeof e.subjectBranch !== "string") return null;
    const p = e.payload as Partial<ClarificationEventPayload> | undefined;
    if (!p || typeof p.requestId !== "string" || !/^[0-9a-f]{24}$/.test(p.requestId)
      || typeof p.question !== "string" || !p.question.trim() || p.question.length > MAX_CLARIFICATION_QUESTION
      || !(p.taskId === null || typeof p.taskId === "string")
      || !(p.originId === null || typeof p.originId === "string")
      || !(p.programId === null || typeof p.programId === "string")
      || !["program-main", "lane-watch", "program-main+lane-watch"].includes(String(p.basis))) return null;
    return { ...base, subjectSlot: Number(e.subjectSlot), subjectBranch: e.subjectBranch,
      kind: e.kind, payload: { requestId: p.requestId, question: p.question,
        taskId: p.taskId, originId: p.originId, programId: p.programId,
        basis: p.basis as ClarificationBasis } };
  }
  if (e.kind === "fleet-report") {
    if (!Number.isInteger(e.subjectSlot) || Number(e.subjectSlot) <= 0
      || typeof e.subjectBranch !== "string" || !e.subjectBranch) return null;
    const p = e.payload as Partial<FleetReportEventPayload> | undefined;
    if (!p || typeof p.reportId !== "string" || !/^[0-9a-f]{24}$/.test(p.reportId)
      || !FLEET_REPORT_STATUSES.includes(p.status as FleetReportStatus)
      || typeof p.text !== "string" || !p.text.trim() || p.text.length > MAX_FLEET_REPORT_TEXT
      || !(p.taskId === null || typeof p.taskId === "string")
      || !(p.originId === null || typeof p.originId === "string")
      || !(p.programId === null || typeof p.programId === "string")
      // FOUR values here, three in the clarification branch above, and the difference is the
      // point: only a REPORT can be filed to the owner principal (the silent drop a missing
      // fourth value once caused: server-narrativ-archiv.md#fleeteventfrom).
      || !["program-main", "lane-watch", "program-main+lane-watch", "owner-inbox"]
        .includes(String(p.basis))
      // THE THIRD CARRIER OF THE SAME FACT, tied to the receiver like the other two. `delivery`
      // says how the row travels and the base rule binds it; `FleetReport.basis` says who the
      // ROW was filed to and fleetReportFrom binds it; this one says who the EVENT was filed to,
      // and it is what the board and the Supervisor projection actually read. Unbound, a row
      // could hydrate with a null receiver while its payload claimed "program-main" — the owner
      // would see a report addressed to a MAIN that was never told — or with a session receiver
      // while claiming "owner-inbox". Both are lies about the one thing the row exists to say.
      || ((p.basis === "owner-inbox") !== ownerReceiver)) return null;
    return { ...base, subjectSlot: Number(e.subjectSlot), subjectBranch: e.subjectBranch,
      kind: e.kind, payload: { reportId: p.reportId, status: p.status as FleetReportStatus,
        text: p.text, taskId: p.taskId, originId: p.originId, programId: p.programId,
        // the report payload's own union, NOT ClarificationBasis: the two vocabularies differ by
        // exactly this value, and casting to the narrower one would re-hide the mismatch above.
        basis: p.basis as FleetReportEventPayload["basis"] } };
  }
  if (e.kind === "lane-ready" || e.kind === "host-commit-ready") {
    if (!Number.isInteger(e.subjectSlot) || Number(e.subjectSlot) <= 0 || typeof e.subjectBranch !== "string") return null;
    const p = e.payload as Partial<LaneWatchEventPayload> | undefined;
    if (!p || typeof p.ahead !== "number" || !Number.isFinite(p.ahead)
      || typeof p.dirty !== "number" || !Number.isFinite(p.dirty)
      || typeof p.idleMs !== "number" || !Number.isFinite(p.idleMs) || p.idleMs < 0
      || typeof p.observed !== "boolean" || !(typeof p.gitOp === "boolean" || p.gitOp === null)
      || !(p.awaiting === "owner" || p.awaiting === "main" || p.awaiting === null)
      || typeof p.hostCommits !== "boolean") return null;
    // Preserve the legacy row's historical field order as well as its values. State is serialized
    // as JSON, so spreading the new common base here would move created/status ahead of the
    // subject and payload and violate the byte-stable legacy-load contract.
    return {
      id: base.id, watchId: base.watchId,
      receiverSlot: base.receiverSlot, receiverOpenedAt: base.receiverOpenedAt,
      receiverSessionId: base.receiverSessionId, receiverIdleSec: base.receiverIdleSec,
      subjectSlot: Number(e.subjectSlot), subjectBranch: e.subjectBranch,
      kind: e.kind, payload: { ahead: p.ahead, dirty: p.dirty, idleMs: p.idleMs, observed: p.observed,
        gitOp: p.gitOp, awaiting: p.awaiting, hostCommits: p.hostCommits },
      createdAt: base.createdAt, status: base.status, attempts: base.attempts,
      deliveredAt: base.deliveredAt, acknowledgedAt: base.acknowledgedAt,
      // last, and only when present: a legacy row without it must serialize byte-identically.
      ...(base.delivery !== undefined ? { delivery: base.delivery } : {}),
      // …and the subject stamp after it, for the same reason: a row minted before it existed
      // hydrates without the key and stays unstamped rather than acquiring a fabricated identity.
      ...(typeof e.subjectOpenedAt === "number" && Number.isFinite(e.subjectOpenedAt)
        && e.subjectOpenedAt > 0 ? { subjectOpenedAt: e.subjectOpenedAt } : {}),
    };
  }
  if (e.kind === "merge-terminal") {
    if (!Number.isInteger(e.subjectSlot) || Number(e.subjectSlot) <= 0
      || typeof e.subjectCwd !== "string" || typeof e.subjectBranch !== "string") return null;
    const p = e.payload as Partial<MergeWatchEventPayload> | undefined;
    const statuses = ["merged", "blocked", "error", "resolved", "interrupted", "awaiting-author"];
    const v = p?.verify;
    if (!p || !statuses.includes(String(p.status)) || typeof p.landed !== "boolean"
      || typeof p.branch !== "string" || typeof p.at !== "number" || !Number.isFinite(p.at)
      || (v !== undefined && (!v || typeof v !== "object" || Array.isArray(v)
        || !(v.ok === true || v.ok === false || v.ok === null)
        || !(v.timedOut === undefined || v.timedOut === true)
        || !(v.waitedOut === undefined || v.waitedOut === true)
        || !(v.stale === undefined || v.stale === true)))
      || (p.conflicted !== undefined && (!Array.isArray(p.conflicted) || p.conflicted.length > 50
        || p.conflicted.some((x) => typeof x !== "string" || x.length > 200)))
      || !(p.resolvedBy === undefined || p.resolvedBy === "agent" || p.resolvedBy === "author")) return null;
    const payload: MergeWatchEventPayload = { status: p.status!, landed: p.landed, branch: p.branch, at: p.at,
      ...(v ? { verify: { ok: v.ok, ...(v.timedOut ? { timedOut: true as const } : {}),
        ...(v.waitedOut ? { waitedOut: true as const } : {}), ...(v.stale ? { stale: true as const } : {}) } } : {}),
      ...(p.conflicted ? { conflicted: [...p.conflicted] } : {}), ...(p.resolvedBy ? { resolvedBy: p.resolvedBy } : {}) };
    return { ...base, subjectSlot: Number(e.subjectSlot), subjectCwd: e.subjectCwd,
      subjectBranch: e.subjectBranch, kind: e.kind, payload };
  }
  if (e.kind === "post-land-audit") {
    if (typeof e.subjectRepo !== "string" || typeof e.subjectMainAfter !== "string") return null;
    const p = e.payload as Partial<AuditWatchEventPayload> | undefined;
    if (!p || !["green", "red", "unknown"].includes(String(p.result)) || typeof p.mainSha !== "string"
      || !Array.isArray(p.covers) || p.covers.length > 50
      || p.covers.some((c) => !c || typeof c.branch !== "string" || typeof c.mainAfter !== "string")
      || !(p.checks === null || (typeof p.checks === "object" && p.checks !== null
        && Number.isInteger(p.checks.ran) && p.checks.ran >= 0
        && Number.isInteger(p.checks.failed) && p.checks.failed >= 0
        && (p.checks.ranIsLowerBound === undefined || p.checks.ranIsLowerBound === true)))
      || !(p.reason === undefined || (typeof p.reason === "string" && p.reason.length <= 200))) return null;
    return { ...base, subjectRepo: e.subjectRepo, subjectMainAfter: e.subjectMainAfter,
      kind: e.kind, payload: { result: p.result as AuditWatchEventPayload["result"], mainSha: p.mainSha,
        covers: p.covers.map((c) => ({ branch: c.branch, mainAfter: c.mainAfter })), checks: p.checks,
      ...(p.reason !== undefined ? { reason: p.reason } : {}) } };
  }
  if (e.kind === "deploy-terminal") {
    if (typeof e.subjectDeployId !== "string" || !/^[0-9a-f]{8}$/.test(e.subjectDeployId)) return null;
    const p = e.payload as Partial<DeployWatchEventPayload> | undefined;
    if (!p || !(p.ok === true || p.ok === false || p.ok === null)
      || !["build", "restart", "boot"].includes(String(p.stage))
      || !(typeof p.target === "string" || p.target === null)
      || !(typeof p.bootHead === "string" || p.bootHead === null)
      || !(p.hitTarget === true || p.hitTarget === false || p.hitTarget === null)
      || !(p.bundleStale === true || p.bundleStale === false || p.bundleStale === null)
      || typeof p.at !== "number" || !Number.isFinite(p.at) || p.at <= 0
      || !(p.reason === undefined || (typeof p.reason === "string" && p.reason.length <= 200))) return null;
    return { ...base, subjectDeployId: e.subjectDeployId, kind: e.kind,
      payload: { ok: p.ok, stage: p.stage as DeployWatchEventPayload["stage"], target: p.target,
        bootHead: p.bootHead, hitTarget: p.hitTarget, bundleStale: p.bundleStale, at: p.at,
        ...(p.reason !== undefined ? { reason: p.reason } : {}) } };
  }
  if (e.kind === "command-job") {
    if (typeof e.subjectJobId !== "string" || !/^[0-9a-f]{12}$/.test(e.subjectJobId)) return null;
    const p = e.payload as Partial<CommandJobWatchEventPayload> | undefined;
    // the artefact list goes through the SAME validator the result route uses — a persisted row and
    // a freshly reported one are the same shape or one of them is lying
    const artifacts = p ? helperArtifactsFrom(p.artifacts) : null;
    if (!p || !["green", "red", "unknown"].includes(String(p.result))
      || helperCmdCheck(p.cmd).ok !== true
      || !(p.exitCode === null || (typeof p.exitCode === "number" && Number.isInteger(p.exitCode)))
      || artifacts === null
      || !(p.reason === undefined || (typeof p.reason === "string" && p.reason.length <= 200))) return null;
    return { ...base, subjectJobId: e.subjectJobId, kind: e.kind,
      payload: { result: p.result as CommandJobWatchEventPayload["result"], cmd: p.cmd as string,
        exitCode: p.exitCode as number | null, artifacts,
        ...(p.reason !== undefined ? { reason: p.reason } : {}) } };
  }
  if (e.kind === "supervisor-transition") {
    if (!Number.isInteger(e.subjectSlot) || Number(e.subjectSlot) <= 0
      || typeof e.subjectOpenedAt !== "number" || !Number.isFinite(e.subjectOpenedAt) || e.subjectOpenedAt <= 0
      || e.delivery === "inbox") return null;
    const p = e.payload as Partial<SupervisorTransitionEventPayload> | undefined;
    if (!p || typeof p.watchId !== "string" || !/^[a-z0-9]+$/.test(p.watchId) || p.watchId !== base.watchId
      || typeof p.awaiting !== "string" || !p.awaiting.trim() || p.awaiting.length > TRANSITION_AWAITING_MAX
      || typeof p.text !== "string" || !p.text.trim() || p.text.length > MAX_SUPERVISOR_NUDGE_TEXT
      || typeof p.completedAt !== "number" || !Number.isFinite(p.completedAt) || p.completedAt <= 0) return null;
    return { ...base, subjectSlot: Number(e.subjectSlot), subjectOpenedAt: e.subjectOpenedAt, kind: e.kind,
      payload: { watchId: p.watchId, awaiting: p.awaiting, text: p.text, completedAt: p.completedAt } };
  }
  return null;
}

function clarificationFrom(raw: unknown): ClarificationRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as Partial<ClarificationRequest>;
  const occupant = (v: unknown, withLane: boolean): boolean => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const x = v as Record<string, unknown>;
    return Number.isInteger(x.slot) && Number(x.slot) > 0
      && typeof x.openedAt === "number" && Number.isFinite(x.openedAt) && x.openedAt > 0
      && (x.sessionId === null || typeof x.sessionId === "string")
      && (!withLane || (typeof x.cwd === "string" && x.cwd.length > 0
        && typeof x.branch === "string" && x.branch.length > 0));
  };
  const provenance = c.provenance as Record<string, unknown> | undefined;
  const nullableString = (v: unknown): boolean => v === null || typeof v === "string";
  const answer = c.answer as ClarificationRequest["answer"] | undefined;
  if (typeof c.id !== "string" || !/^[0-9a-f]{24}$/.test(c.id)
    || typeof c.askedAt !== "number" || !Number.isFinite(c.askedAt) || c.askedAt <= 0
    || typeof c.question !== "string" || !c.question.trim() || c.question.length > MAX_CLARIFICATION_QUESTION
    || !occupant(c.worker, true) || !occupant(c.receiver, false)
    || !provenance || !nullableString(provenance.taskId) || !nullableString(provenance.originId)
    || !nullableString(provenance.programId)
    || !["program-main", "lane-watch", "program-main+lane-watch"].includes(String(c.basis))
    || typeof c.eventId !== "string" || !/^[0-9a-f]{24}$/.test(c.eventId)
    || !["open", "send-uncertain", "answered", "refused"].includes(String(c.status))
    || !(c.closedAt === null || (typeof c.closedAt === "number" && Number.isFinite(c.closedAt) && c.closedAt > 0))
    || !(c.refusedReason === null || typeof c.refusedReason === "string")) return null;
  if (c.status === "open" && (answer !== null || c.refusedReason !== null || c.closedAt !== null)) return null;
  const answerShaped = (): boolean => !!answer && typeof answer.text === "string" && !!answer.text.trim()
    && answer.text.length <= MAX_CLARIFICATION_ANSWER && typeof answer.at === "number"
    && Number.isFinite(answer.at) && answer.at > 0 && occupant(answer.by, false);
  if (c.status === "answered") {
    if (!answerShaped() || c.refusedReason !== null || c.closedAt === null) return null;
  } else if (c.status === "send-uncertain") {
    // the PENDING answer rides in the same field: it is what a retry must match byte-identically,
    // and it is the only record that this text may already be sitting in the worker's pane.
    // Not closed and not refused — an unresolved send is still an open debt.
    if (!answerShaped() || c.refusedReason !== null || c.closedAt !== null) return null;
  } else if (answer !== null) return null;
  if (c.status === "refused" && (!(c.refusedReason ?? "").trim() || c.closedAt === null)) return null;
  return raw as ClarificationRequest;
}

function fleetReportFrom(raw: unknown): FleetReport | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Partial<FleetReport>;
  const occupant = (v: unknown, withLane: boolean): boolean => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return false;
    const x = v as Record<string, unknown>;
    return Number.isInteger(x.slot) && Number(x.slot) > 0
      && typeof x.openedAt === "number" && Number.isFinite(x.openedAt) && x.openedAt > 0
      && (x.sessionId === null || typeof x.sessionId === "string")
      && (!withLane || (typeof x.cwd === "string" && x.cwd.length > 0
        && typeof x.branch === "string" && x.branch.length > 0));
  };
  const provenance = r.provenance as Record<string, unknown> | undefined;
  const nullableString = (v: unknown): boolean => v === null || typeof v === "string";
  if (typeof r.id !== "string" || !/^[0-9a-f]{24}$/.test(r.id)
    || typeof r.reportedAt !== "number" || !Number.isFinite(r.reportedAt) || r.reportedAt <= 0
    || !FLEET_REPORT_STATUSES.includes(r.status as FleetReportStatus)
    || typeof r.text !== "string" || !r.text.trim() || r.text.length > MAX_FLEET_REPORT_TEXT
    || !occupant(r.worker, true)
    // The receiver half and the basis half are checked TOGETHER, so a row can never claim a
    // principal it was not filed to: owner-inbox means no occupant, every other basis means one.
    || (r.basis === "owner-inbox" ? r.receiver !== null : !occupant(r.receiver, false))
    || !provenance || !nullableString(provenance.taskId) || !nullableString(provenance.originId)
    || !nullableString(provenance.programId)
    || !["program-main", "lane-watch", "program-main+lane-watch", "owner-inbox"].includes(String(r.basis))
    || typeof r.eventId !== "string" || !/^[0-9a-f]{24}$/.test(r.eventId)) return null;
  // The decision half, default-deny like every other half of this row. Absent and null are the
  // same undecided fact and both pass; anything present must be COMPLETE and must name the exact
  // receiver occupant this row was filed to. A row that could claim a decider it never had would
  // hydrate quietly and then lie to the successor view that reads it — the same failure the
  // receiver/basis pair above exists to prevent, one field further in.
  const decision = r.decision;
  if (decision !== undefined && decision !== null) {
    if (typeof decision !== "object" || Array.isArray(decision)) return null;
    const d = decision as Partial<FleetReportDecision>;
    if (!occupant(d.by, false)) return null;
    const by = d.by as { slot: number; openedAt: number; sessionId: string | null };
    if (!FLEET_REPORT_DISPOSITIONS.includes(d.disposition as FleetReportDisposition)
      || typeof d.at !== "number" || !Number.isFinite(d.at) || d.at <= 0
      || !(d.reason === null || (typeof d.reason === "string" && !!d.reason.trim()
        && d.reason.length <= MAX_FLEET_REPORT_DECISION_REASON))
      || r.receiver === null || r.receiver === undefined
      || by.slot !== r.receiver.slot || by.openedAt !== r.receiver.openedAt
      || by.sessionId !== r.receiver.sessionId) return null;
  }
  return raw as FleetReport;
}

// Same discipline as clarificationFrom, same reason: requester identity and programId are
// server-observed facts, so a row that does not carry them exactly is DISCARDED, never repaired.
// The per-status invariants are the clarification ones with the owner-shaped answer substituted —
// in particular send-uncertain carries the pending answer, is not closed and is not refused.
function attentionFrom(raw: unknown): AttentionRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const a = raw as Partial<AttentionRequest>;
  const r = a.requester as Record<string, unknown> | undefined;
  const provenance = a.provenance as Record<string, unknown> | undefined;
  const answer = a.answer as AttentionRequest["answer"] | undefined;
  const nullableBounded = (v: unknown): boolean => v === null
    || (typeof v === "string" && v.length > 0 && v.length <= MAX_ATTENTION_PROVENANCE_TEXT);
  const provenanceShaped = provenance === undefined || (
    nullableBounded(provenance.taskId) && nullableBounded(provenance.originId)
    && (provenance.programId === null || provenance.programId === a.programId)
    && (provenance.branch === null || (typeof provenance.branch === "string"
      && validAttentionBranch(provenance.branch)))
    && (provenance.candidateSha === null || (typeof provenance.candidateSha === "string"
      && ATTENTION_CANDIDATE_SHA_RE.test(provenance.candidateSha)))
  );
  if (typeof a.id !== "string" || !/^[0-9a-f]{24}$/.test(a.id)
    || typeof a.raisedAt !== "number" || !Number.isFinite(a.raisedAt) || a.raisedAt <= 0
    || !ATTENTION_KINDS.includes(a.kind as AttentionKind)
    || typeof a.text !== "string" || !a.text.trim() || a.text.length > MAX_ATTENTION_TEXT
    || !r || !Number.isInteger(r.slot) || Number(r.slot) <= 0
    || typeof r.openedAt !== "number" || !Number.isFinite(r.openedAt) || Number(r.openedAt) <= 0
    || !(r.sessionId === null || typeof r.sessionId === "string")
    || typeof a.programId !== "string" || !a.programId
    || !provenanceShaped
    || !["open", "send-uncertain", "answered", "refused"].includes(String(a.status))
    || !(a.closedAt === null || (typeof a.closedAt === "number" && Number.isFinite(a.closedAt) && a.closedAt > 0))
    || !(a.refusedReason === null || typeof a.refusedReason === "string")) return null;
  const answerShaped = (): boolean => !!answer && typeof answer.text === "string" && !!answer.text.trim()
    && answer.text.length <= MAX_ATTENTION_ANSWER && typeof answer.at === "number"
    && Number.isFinite(answer.at) && answer.at > 0 && answer.by === "owner";
  if (a.status === "open" && (answer !== null || a.refusedReason !== null || a.closedAt !== null)) return null;
  if (a.status === "answered") {
    if (!answerShaped() || a.refusedReason !== null || a.closedAt === null) return null;
  } else if (a.status === "send-uncertain") {
    if (!answerShaped() || a.refusedReason !== null || a.closedAt !== null) return null;
  } else if (answer !== null) return null;
  if (a.status === "refused" && (!(a.refusedReason ?? "").trim() || a.closedAt === null)) return null;
  return raw as AttentionRequest;
}

const MAX_CLARIFICATION_QUESTION = 2000;
const MAX_CLARIFICATION_ANSWER = 4000;

const MAX_FLEET_REPORT_TEXT = 4000;
// The decision's optional prose. Far smaller than the report it judges on purpose: the report is
// the work, this is one sentence saying what the MAIN did with it.
const MAX_FLEET_REPORT_DECISION_REASON = 500;

// Its own constants, copied from the clarification values rather than aliased: the two channels
// answer to different principals and one may be retuned without silently retuning the other.
const MAX_ATTENTION_TEXT = 2000;
const MAX_ATTENTION_ANSWER = 4000;

const MAX_ATTENTION_PROVENANCE_TEXT = 200;
const ATTENTION_CANDIDATE_SHA_RE = /^[0-9a-f]{40,64}$/;
const ATTENTION_BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
function validAttentionBranch(branch: string): boolean {
  return branch.length <= MAX_ATTENTION_PROVENANCE_TEXT && ATTENTION_BRANCH_RE.test(branch)
    && !branch.includes("..") && !branch.includes("//") && !branch.includes("@{")
    && !branch.endsWith("/") && !branch.endsWith(".") && !branch.endsWith(".lock");
}

const MAX_SUPERVISOR_NUDGE_TEXT = 2000;

// a queued feature request. Owner-created or submitted via the public /intake address
// (e.g. a CEO emailing features in). NEVER auto-sent: a task only leaves `pending` when
// the OWNER promotes it to `queued`; the idle dispatcher then assigns queued tasks to
// free lanes. External text is data, never a command until the owner opts it in.
const TASK_KINDS = ["auftrag", "richtung", "notiz", "betrieb"] as const;
type TaskKind = typeof TASK_KINDS[number];
const isTaskKind = (value: unknown): value is TaskKind =>
  typeof value === "string" && (TASK_KINDS as readonly string[]).includes(value);
const loadTaskKind = (value: unknown, source: Task["source"]): TaskKind => {
  if (value === "lane") return "auftrag";
  if (value === "note") return "notiz";
  if (isTaskKind(value)) return value;
  // The safe default is the DOOR's default, per producer. A main row reaching this line is already
  // malformed (POST /api/self/tasks always writes a validated kind), and the only question left is
  // which way a malformed row should fall: "auftrag" would promote an advisory filing into the one
  // executable category across a reload, i.e. hand the dispatcher a row nobody ever wrote as work.
  return source === "steward" || source === "main" ? "notiz" : "auftrag";
};

interface Task {
  id: string;
  originId?: string; // stable bracket around tasks minted from one request. Root tasks use their
  // own id; refine children inherit it. Absent is the honest shape for a pre-field row, never an
  // empty bracket and never backfilled while loading old state.
  programId?: string; // owner-attached Program bracket. Absent means this task belongs to no
  // Program (or predates the field); refine children inherit it, but no load-time backfill occurs.
  text: string;
  // ACP-23 added "main": a row a bound Program-MAIN filed through POST /api/self/tasks. It is a
  // PRODUCER name like the other three, not a permission — what a main row may be is bounded at
  // its door (always pending, notiz unless the caller names a kind), and every reader that already
  // asked "is this steward" keeps its answer. The load allowlist in loadState carries the same
  // four values: a source it does not list is dropped on the next boot, silently and greenly.
  source: "owner" | "intake" | "steward" | "main";
  from: string | null; // intake sender label (freeform, for display only — never trusted)
  kind: TaskKind; // auftrag is the one executable category. richtung, notiz and betrieb are
  // advisory categories without their own motor (owner decision 2026-08-10); promoting one is
  // still a valid propose-outcome signal, but every dispatch path skips it and leaves that fact
  // standing on the row.
  repo: string | null; // the task's TARGET repo — where its lane spawns. OWNER-only: intake and
  // steward can never choose where external text materializes as a working session. null =
  // the dispatcher default (FLEET_DISPATCH_REPO), which is also every pre-field row's meaning.
  spawn?: DispatchSpawn; // the row's persisted agent choice — WHICH harness/model/effort its lane
  // runs, in exactly the shape the attended ▸ start button already sends. Validated at SET time
  // (taskSpawnFromBody: the same three adapter validators as the attended route, harness first),
  // written only by the owner create route and the Program-MAIN filing door. ABSENT is the honest
  // legacy shape and resolves to DEFAULT_SPAWN at every consumer (taskSpawnOf) — never backfilled,
  // and never stored as an all-null object. The release door and the tick judge THIS field's
  // harness for automatability, so an invalid or non-automatable stored choice is refused loudly
  // instead of silently falling back to the default adapter.
  files?: string[]; // the task's file surface. In persisted state this is written ONLY when a ↻
  // refine proposal is confirmed (from RefineChild.files): the refiner verified it against the
  // tree and the owner promoted it. API views may instead PROJECT exact tracked paths named in the
  // task/brief, but that weaker derivation is never written back over the owner-confirmed field.
  // Absent means UNKNOWN, never "touches nothing"; loadState and the projector both preserve that.
  filesOrigin?: TaskFilesOrigin; // confirmed = persisted refine-confirm fact; derived = read-only
  // server projection from exact path tokens. A legacy persisted `files` field is confirmed by the
  // old field's contract. The two values must never collapse: dispatch/model consumers prefer the
  // confirmed surface, and derived metadata is recomputed from the current tracked tree.
  cluster?: TaskCluster; // read-only projection from the known file surface. Not persisted: its
  // process map and the repository index can move while the task text remains unchanged.
  status: "pending" | "queued" | "sent" | "done" | "archived";
  releasedBy?: "owner" | "machine"; // WHO handed this draft to the machine — written at the
  // RELEASE (see releaseTask) and by nothing else. NOT a synonym for the outcome row's
  // `confirmedByHuman`, which answers the LAND art ("did the owner press ⏫, or did it auto-land
  // clean+green") — the two populations are not separable from that field (measured on the live
  // trail: server-narrativ-archiv.md#task). Absent means never released, or released before this
  // field existed — never defaulted to "owner", because a guess here is precisely what the field
  // exists to prevent (the same bargain `resolvedBy` documents: it cannot be recovered from rows
  // that never recorded it). It records the LAST release, not the row's current state: an unqueue
  // withdraws the release and leaves the stamp standing until the next one overwrites it, which is
  // sound because the only consumer reads it at the dispatch that a release always precedes.
  created: number;
  slot: number | null; // set once dispatched
  note: string | null;
  criterion?: TaskCriterion; // what "done" means for this task, settled in a clarify lane. The
  // lane PROPOSES it (POST /api/self/criterion, confirmedAt null); only the owner confirms —
  // the same propose/promote boundary that keeps a producer from authoring the anchor it is
  // later judged against (see Slot.mission). Durable on purpose: before this field the settled
  // criterion lived only in pane scrollback and died at /clear, so nothing could later say what
  // the work was measured against.
  ref?: string; // steward filings only: the pulse's stable condition slug (rundgang bound 1 /
  // the Inspektion's register `key`). One live proposal per ref — the server answers a repeat
  // filing with the existing row instead of a duplicate, so a persisting condition survives
  // as ONE queue item across an hourly pulse. Absent on ad-hoc filings and non-steward rows.
  refine?: TaskRefine; // the brief compiler's PROPOSAL (briefs/task-refine.md). A refine run never
  // touches this row's text — it only parks what it would become here, and the owner's confirm is
  // what mints the children. Propose/promote like `criterion`, for the same reason: the producer
  // must not be the one who rewrites the work order it was measured against.
  brief?: TaskBrief;       // the compiled work brief — the EXACT bytes a lane will receive.
  // Compiled once per draft in the analysis sweep, from then on stored, shown and editable (why it
  // is stored rather than compiled at spawn: server-narrativ-archiv.md#task).
  // NOT the same object as `refine`, and the difference is the point: ↻ refine proposes a new
  // REQUEST (attended, all-or-nothing, may split one row into several), while this is the prompt
  // the request compiles down to. Refine rewrites what you asked for; the brief is how it is said.
  comments?: TaskComment[]; // the owner's own words ON this row, addressed to whoever picks it up
  // (the gap it closed: server-narrativ-archiv.md#task). Deliberately NOT folded into the brief:
  // the brief is the exact bytes a lane receives and is approved as such, so appending to it behind
  // the owner's back would break the one contract that makes it reviewable. A comment is read, not
  // executed.
  analysis?: TaskAnalysis; // what the queue analyst found ABOUT that brief. ADVISORY: it gates
  // nothing — the owner's promote is the decision and this is the evidence he decides on (the eval
  // gate it replaced, and why: server-narrativ-archiv.md#task). Written only by tickAnalysisSweep.
}
// The brief and the verdict are deliberately SEPARATE records with separate lifetimes: a brief is
// compiled once per draft (a fresh lane's git-fact block is empty by construction, so nothing about
// it improves by recompiling), while its analysis is re-run whenever the tree moves under it.
interface TaskBrief { text: string; at: number; model: string; edited: boolean }
// One remark, timestamped and individually deletable. `id` exists for the delete: an index would
// name a different comment the moment an earlier one goes.
interface TaskComment { id: string; ts: number; text: string }

// Three-valued on purpose: "unknown" is the analyst failing to ANSWER, which is an absence and must
// never be able to read as either judgement (the two-valued collapse this replaced:
// server-narrativ-archiv.md#taskanalysis).
interface TaskAnalysis {
  verdict: "ready" | "needs-you" | "unknown";
  reason: string;                  // decisive factor first; for "unknown" it is the failure
  blockers: AnalysisBlocker[];     // which criterion failed — the row tags; empty when ready
  collides: string[];              // other task ids / open lane branches touching the same files
  at: number;
  model: string;
  head: string | null;             // integration tip this was judged against; a moved tip = stale
  briefAt: number | null;          // the brief revision this judged; the owner editing it = stale
  attempts: number;                // consecutive analyst failures, for the backoff (0 once answered)
  retry?: { at: number; reason: string }; // the last re-reading that FAILED, recorded beside the
  // verdict instead of over it (analysisFailed). Absent is the normal state and means "the verdict
  // above is the last thing that happened to this row". Written on every `attempts` bump, but not
  // guaranteed to accompany the counter — a hand-edited state file can carry one without the
  // other, which is why analysisDue falls back to `at` for the backoff clock rather than assuming.
}
type AnalysisBlocker = (typeof ANALYSIS_BLOCKERS)[number];
interface TaskCriterion { text: string; proposedAt: number; confirmedAt: number | null }

// One compiled child. `text` is the request in its own words; the other three are what a hand-
// written brief carries and a raw task usually does not. They are stored SEPARATELY rather than
// pre-joined so the proposal stays reviewable field by field in the queue detail — the row text
// the owner promotes is composed from them deterministically (refineChildText).
interface RefineChild { text: string; doneCriterion: string; verify: string; files: string[] }
// The two answer shapes, as a discriminated union: either the task was already brief-shaped
// (triage — the anti-overthink clause) or it compiles into 1..MAX_REFINE_CHILDREN children.
type RefineProposal = { unchanged: true; reason: string } | { unchanged: false; tasks: RefineChild[] };
interface TaskRefine { at: number; model: string; proposal: RefineProposal;
  // The deterministic acceptance on that proposal (refine-validate.ts): which declared paths are
  // tracked in the target repo, and whether each child's verify field names a step of this repo's
  // local proof chain. READ-ONLY PROJECTION, like `cluster` on the row above it — written by
  // taskView from the CURRENT tracked tree and never by the worker, so it is always a statement
  // about today rather than about the minute the compile finished, and it needs no staleness
  // anchor the way `analysis.head` does. Never persisted: normRefine rebuilds this record field by
  // field, so a hand-edited state file cannot smuggle a verdict in either direction.
  validation?: RefineValidation }

// HOW a lane's working copy relates to the repo it came from. Absent/"worktree" is every lane
// Fleet ever made: `git worktree add`, sharing the primary's object database. "clone" is a full
// `git clone --no-hardlinks` — its own .git, its own hooks, its own config, one self-contained
// directory. The distinction exists for ISOLATION, and it is not cosmetic: a worktree's `.git` is
// a FILE pointing at the primary's common dir, so a worktree handed to a sandbox is a directory
// git cannot work in at all — and mounting the common dir alongside it hands the sandbox
// `.git/hooks`, whose contents run on the HOST under the owner's uid on his next commit.
// `.git/config` (aliases, core.pager, fsmonitor) is the same vector. A clone has neither.
type LaneForm = "worktree" | "clone";
interface LaneRef {
  repo: string; branch: string; base?: string; baseSha?: string; form?: LaneForm;
  // The one main-session occupant this lane was born under. Optional only for old/adopted lanes
  // and fresh lanes spawned while this repo had no eligible main session.
  anchor?: LaneAnchor;
}
interface SuccessionRetirement { at: number; cwd: string; token: string }
type CodexRecoveryState = "pending" | "bound" | "ambiguous" | "lost";

interface Slot {
  id: number;
  cwd: string | null; // null = slot not activated; self-heal only touches activated slots
  label: string | null; // user-chosen session name; falls back to cwd basename in the UI
  openedAt: number; // when THIS occupant was opened. The HANDOFF gate compares its commit against
  // this session boundary, so a recycled slot can never present the previous occupant's handoff.
  // The retirement intent belongs on the slot (and therefore in fleet.json), rather than in a
  // process-only timer: cwd + token bind it to this occupant across a boot and reject a recycled one.
  successionRetirement: SuccessionRetirement | null;
  mission: string | null; // the OWNER's standing intention for this session, externalized. A lane
  // has one already — its founding task rides stewardTaskView, and every drift/nudge read anchors
  // on it; a plain checkout slot has nothing equivalent, because its running intent lives in pane
  // scrollback and dies at /clear. Owner-written only (the steward gate never reaches the route:
  // a producer must not author the anchor it is later judged against), and per SESSION, not per
  // slot — openSlot/killSlot clear it with the label.
  awaiting: "owner" | "main" | null; // "owner" still means literally that a Clarify Lane waits
  // for OWNER confirmation and handleStewardSend reads it that way. A worker awaiting the routed
  // Program-MAIN answer would be dishonest under that label, so "main" is the smallest precise
  // additive state. Both make the existing lane predicates decline to call the lane ready/stalled.
  // Cleared only by the matching lifecycle: owner send/criterion for "owner"; successful reply,
  // refusal, or occupant teardown for "main". Persisted: restart must not reopen either wait.
  worktree: LaneRef | null; // set when Fleet created this slot's
  // cwd as a git worktree ("lane") — land/cleanup only ever touches tagged slots. `base` is a
  // branch NAME (it must track the tip); `baseSha` is the immutable fork COMMIT captured at
  // create/attach time — optional, because lanes forked before it existed have none.
  model: string | null; // per-slot claude model (--model at spawn); null = FLEET_CMD default
  harness: string | null; // which agent this session runs (HARNESSES). null = the default adapter,
  // i.e. FLEET_CMD — which is what every slot predating this field is, so null must never be
  // migrated to "claude": the two are the same state and one representation of it is enough.
  // Same lifetime and same honesty rule as `model`: chosen at spawn (it decides the pane's very
  // command line), cleared on open/kill so a recycled slot never inherits the previous occupant's.
  container: string | null; // WHICH BOX this session's agent runs in, and on WHICH docker-daemon
  // context — the pin over this file forbids a bare `docker ` outside `docker --context`, prose included.
  containerContext: string | null; // Only meaningful for a harness whose supports.container is true
  // (the routes refuse them for any other). NULL IS NOT "none" — it is "this fleet's default", and
  // it resolves through boxFor, never through docker's ambient context: the active context on this
  // machine is the VM holding the guest containers, so an unpinned value would not have picked
  // "some" daemon but exactly that one. Same lifetime and same honesty rule as `model`: baked into
  // the pane's command line at spawn, cleared on open/kill so a recycled slot never inherits the
  // previous occupant's box. Persisted, so a respawn re-enters the SAME container rather than
  // silently falling back to the default one.
  effort: string | null; // per-slot reasoning level for harnesses that have one (Pi's --thinking);
  // null = pass no flag. Validated against the HARNESS's own closed set, never a charset.
  taskId: string | null; // the queue row that spawned this lane. Carried because the outcome
  // recorder runs at TEARDOWN — by then the slot is the only object that still names the run.
  // null for a hand-opened lane and cleared with the occupant, exactly like releasedBy below.
  originId: string | null; // the stable request bracket of that task, with the same teardown
  // lifetime. null is honest for manual lanes and dispatched legacy tasks whose row cannot say.
  programId: string | null; // the owner-confirmed Program bracket of that task, with exactly the
  // same lifetime and honest-null semantics as taskId/originId.
  releasedBy: "owner" | "machine" | null; // how the TASK that spawned this lane was released
  // (Task.releasedBy), carried here because the outcome recorder runs at TEARDOWN — by then the
  // task row has moved to `done`/`pending` and the slot is the only thing that still remembers.
  // Same lifetime and same honesty rule as `model`: set at spawn, cleared on open/kill so a
  // recycled slot never inherits it, null when this lane came from no queue row at all (a
  // hand-opened lane) or from one released before the field existed.
  selfToken: string; // scoped credential for POST /api/self/autos — NEVER the owner token.
  // Minted fresh in openSlot every time the slot is (re)activated, so a recycled slot can't
  // be self-scheduled against by a session that was talking to whatever used to live here.
  offset: number;
  lastOutput: number;
  quietUntil: number; // resize/repaint make the TUI redraw — don't count that as activity
  cols: number; // last tmux window size we applied — lets a same-size reconnect skip reseeding
  rows: number;
  sessionId: string | null; // exact conversation identity: usually pinned at pane creation;
  // Codex discovers it lazily. null also covers adopted/pre-pinning transcript sessions.
  codexPaneSpawnedAt: number | null; // current Codex pane life's discovery-window anchor
  codexRecoveryState: CodexRecoveryState | null; // null for every non-Codex occupant
  codexDisconnectSeenAt: number | null; // advisory only; a live TUI owns its own retry
  history: { text: string; ts: number }[]; // the durable "what did I prompt" record,
  // newest last: composed sends, plus terminal-typed prompts harvested from the
  // transcript (tickHarvest) — raw keystrokes themselves are deliberately not captured
  clients: Set<ServerWebSocket<WSData>>;
  inputChain: Promise<unknown>;
  resizeChain: Promise<unknown>; // serializes resize-window+capture-pane so two concurrent
  // triggers (e.g. two clients connecting at different widths) can't interleave their
  // tmux calls and hand one client a seed reflowed to the other's width
}

type MainDirectResult = "landed" | "abandoned" | "expired";
interface MainDirectPreflight {
  id: string;
  createdAt: number;
  slot: number;
  sessionId: string | null;
  openedAt: number;
  taskId: string | null;
  repo: string;
  integrationBranch: string;
  mainBefore: string;
}
interface MainDirectOutcome extends MainDirectPreflight {
  origin: "main-direct";
  ts: number;
  result: MainDirectResult;
  mainAfter: string;
  verify: string | Record<string, unknown> | "unknown";
  reason?: string;
}

const PROGRAM_STATUSES = ["proposed", "confirmed", "active", "complete"] as const;
type ProgramStatus = typeof PROGRAM_STATUSES[number];
interface Program {
  id: string;
  title: string;
  intent: string;
  successCriterion: string;
  nonGoals: string[];
  decisions: string[];
  evidence: string[];
  openQuestions: string[];
  status: ProgramStatus;
  createdAt: number;
  proposedBy: { kind: "session"; slot: number; openedAt: number; sessionId: string | null }
    | { kind: "owner" };
  main?: { slot: number; openedAt: number; sessionId: string | null; boundAt: number };
  // THE OWNER'S PROMOTION RECORD, and it is deliberately NOT part of ProgramContent: content is
  // what a session may PROPOSE and the owner only corrects, this is a permission the owner grants
  // and nothing else may write. Absent = owner-only land, which is the honest legacy shape and the
  // shape every Program has until the owner says otherwise. Written by exactly one route
  // (POST /api/programs/:id/promotion), revoked by the same one with {"policy": null}, never
  // backfilled at load and never written by a self route.
  promotion?: PromotionPolicy;
  // THE OWNER'S CHOICE OF EXECUTION ENVIRONMENT for this Program's MAIN, and it is deliberately
  // neither ProgramContent nor part of `promotion`. Content is what a session may PROPOSE;
  // `promotion` is a permission a MAIN SPENDS; this is the environment a MAIN is FOUNDED into and
  // then judged in — three different acts, so three different records. Absent means the exact
  // legacy Standard MAIN, byte for byte, and that is the shape every Program has until the owner
  // says otherwise. Written by exactly one route (POST /api/programs/:id/profile), cleared by the
  // same one with {"profile": null}, never backfilled at load and never written by a self route.
  profile?: ProgramProfile;
  // THE FIFTH RECORD, and deliberately not a key inside `profile`: loadProgramProfile refuses any
  // object carrying a key outside {v, kind, confirmedAt}, so a studio field in there would load
  // EVERY existing profile as absent. Written by exactly one route
  // (POST /api/programs/:id/studio), cleared by the same one with {"studio": null}, never
  // backfilled at load and never written by a self route — the environment and the workflow are
  // both owner decisions, and a session may propose neither.
  studio?: ProgramStudioBinding;
  // A Game-Maker founding crosses pane creation, prompt delivery and a durable authority move.
  // This intent is the crash boundary between those acts: it names exactly the candidate Fleet
  // may roll back after a restart, without overloading Slot.programId (task/lane provenance).
  // Absent is every Standard Program and every Game-Maker Program outside that short transition.
  founding?: ProgramFounding;
  // THE PERSISTED AUTHORITY LINEAGE — who held this Program's MAIN authority when, and how each
  // holding ended. Deliberately the FOURTH record and none of the other three: content is what a
  // session may PROPOSE, `promotion` is a permission the owner GRANTS, `founding` is a crash marker
  // that lives for one transition — this is a HISTORY that only authority moves append to and
  // nothing rewrites. It is not derived from audit.jsonl on purpose: that ledger is prose, unbounded,
  // rotated by nobody and never loaded as state, so a successor reading it would parse sentences
  // to learn facts the server already knew at write time. Every authority move writes this in the
  // SAME save as `main` (bootstrap, rebound, succession); a teardown of the bound occupant closes
  // the open entry without appending; a Program that already had `main` before this record
  // existed gets exactly one `backfill-unknown` entry at load, with `boundAt` copied from `main` —
  // never an invented earlier history. Absent = no lineage is known, and the execution view says so.
  lineage?: ProgramLineage;
  confirmedAt?: number;
  activatedAt?: number;
  completedAt?: number;
}
// CLOSED, VERSIONED, DEFAULT-DENY. `v` exists so a v2 shape can never be read as a v1 permission:
// the loader below refuses anything but 1, so an unknown version degrades to ABSENT (owner-only)
// rather than to its nearest v1 reading. There is no `verify` field, because "the repo must have
// its own FLEET_VERIFY_CMD_REPOS entry" is the ONLY v1 behaviour — a field with one legal value is
// a decision nobody makes, and the land route simply refuses a repo without an entry.
// `confirmedAt` is stamped server-side: a wire value there would let a caller date the owner's act.
//
// THE THREE VALUES ARE A LADDER, and each rung is the owner policy of 2026-08-23 in one word:
//   "off"        — the record exists and grants nothing. Distinct from ABSENT on purpose: absent is
//                  "the owner never said", off is "the owner said no", and a ledger that could not
//                  tell them apart would make a revocation look like a program nobody ever reached.
//   "green-only" — an ordinary clean/green in-program land is the owning MAIN's to make. This is the
//                  rung that ends the routine `review-ready` attention for a clean land.
//   "guarded"    — additionally: a lane sitting on an agent-RESOLVED conflict may be confirmed by
//                  that MAIN, with the server re-running the authoritative verification FRESH on the
//                  resolved candidate and landing only on ok:true. Conflict inside the confirmed
//                  scope is MAIN work; `conflicted:true` alone never blocks promotion.
type PromotionSelfLand = "off" | "green-only" | "guarded";
interface PromotionPolicy { v: 1; selfLand: PromotionSelfLand; confirmedAt: number }
const PROMOTION_SELF_LAND: PromotionSelfLand[] = ["off", "green-only", "guarded"];
// The load-time reader, in loadTaskSpawn's exact discipline and for the same reason: this record is
// a PERMISSION, so its degradation direction is the whole design. Anything that is not exactly a
// well-formed v1 record — unknown key, wrong version, unknown value, missing or absurd stamp —
// loads as ABSENT, i.e. owner-only. There is no field-wise repair here (unlike a spawn choice,
// where a half-valid row still names a real adapter): half a permission is not a weaker
// permission, it is a different one, and the only safe reading of a record nobody can parse is
// "the owner granted nothing".
const loadPromotion = (value: unknown): PromotionPolicy | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["v", "selfLand", "confirmedAt"].includes(k))) return undefined;
  if (r.v !== 1) return undefined;
  if (typeof r.selfLand !== "string" || !PROMOTION_SELF_LAND.includes(r.selfLand as PromotionSelfLand)) return undefined;
  if (typeof r.confirmedAt !== "number" || !Number.isFinite(r.confirmedAt) || r.confirmedAt <= 0) return undefined;
  return { v: 1, selfLand: r.selfLand as PromotionSelfLand, confirmedAt: r.confirmedAt };
};

// CLOSED, VERSIONED, DEFAULT-ABSENT — the same three properties `PromotionPolicy` has, for the same
// reason: a v2 shape must never be readable as a v1 environment, and an unknown `kind` must never
// degrade to its nearest known one. `confirmedAt` is stamped server-side, because a wire value
// there would let a caller date the owner's decision.
//
// THERE IS EXACTLY ONE KIND TODAY, and it is not a category slot waiting to be filled.
//   "game-maker" — the owner has said, of THIS program, that implementation, launch, actual
//                  control, perception, repair and replay are one causally coupled product act.
//                  The consequence is a different founding text and a narrower machine (a
//                  dedicated linked worktree of a target repository), NOT a different lifecycle,
//                  a new role, a new subsystem or a second authority. Absence is the Standard MAIN.
type ProgramProfileKind = "game-maker";
interface ProgramProfile { v: 1; kind: ProgramProfileKind; confirmedAt: number }
const PROGRAM_PROFILE_KINDS: ProgramProfileKind[] = ["game-maker"];
// loadPromotion's discipline, one record over. A profile that cannot be parsed loads as ABSENT,
// i.e. as the Standard MAIN — never field-wise repaired, and never allowed to take the Program down
// with it: the owner's confirmed intent is worth more than a preference nobody can read, so an
// unreadable profile costs the record and nothing else.
const loadProgramProfile = (value: unknown): ProgramProfile | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["v", "kind", "confirmedAt"].includes(k))) return undefined;
  if (r.v !== 1) return undefined;
  if (typeof r.kind !== "string" || !PROGRAM_PROFILE_KINDS.includes(r.kind as ProgramProfileKind)) return undefined;
  if (typeof r.confirmedAt !== "number" || !Number.isFinite(r.confirmedAt) || r.confirmedAt <= 0) return undefined;
  return { v: 1, kind: r.kind as ProgramProfileKind, confirmedAt: r.confirmedAt };
};

// === THE STUDIO RECORD — the WORKFLOW as data, beside the machine environment, never inside it ===
// loadProgramProfile's four properties, one record over: CLOSED, VERSIONED, DEFAULT-ABSENT, and
// `confirmedAt` stamped server-side so a caller can never date the owner's act. What is NEW here is
// the direction of ownership: `profile` answers "which MACHINE is this MAIN founded into" and is an
// enum the code switches on; a Studio answers "which WORKFLOW does it run" and is CONTENT — stages,
// spawn triples, gates, brief blocks. The two were one thing until 2026-09-03, and the cost of that
// was measured: three normative rules landed in a section only a game-maker Program inherits and
// reached the iOS run in zero of eight lanes
// (docs/messungen/2026-09-03-private-repo-p-worktrail-audit-synthese.md, root 5).
//
// A STUDIO IS A SHARED SOURCE, NOT A PROGRAM'S PROPERTY. Several Programs may bind the same one, so
// unlike `profile` it cannot be frozen for the lifetime of one MAIN without freezing it for every
// other reader. `rev` is the whole answer to that: it rises by one on every REAL change, the binding
// keeps the `rev` it was made against, and a drift is therefore VISIBLE by comparison rather than
// silent. Nothing in this cut compares them — S1 is inventory only.
//
// `machineProfile` REFERENCES the two environments that already exist; it invents no third one and
// switches nothing. `ProgramProfileKind` and `isGameMaker` are deliberately untouched by this record.
type StudioMachineProfile = "standard" | "game-maker";
type StudioRepoPolicy = "one-app-per-repo" | "shared-repo";
type StudioBriefAudience = "main" | "lane" | "review" | "critic";
const STUDIO_MACHINE_PROFILES: StudioMachineProfile[] = ["standard", "game-maker"];
const STUDIO_REPO_POLICIES: StudioRepoPolicy[] = ["one-app-per-repo", "shared-repo"];
const STUDIO_BRIEF_AUDIENCES: StudioBriefAudience[] = ["main", "lane", "review", "critic"];
// A POINTER WITH AN OBSERVED HASH, never embedded prose — the construction context-manifest.ts
// chose for `sourceHash`, for the same reason: a record that carries text is never maintained and
// is unreadable in a diff, while a pointer inherits the repo's review paths. `sha` is a sha256 hex
// digest as the wire supplies it; NOTHING in this cut re-reads the file to check it, and no reader
// may treat it as verified.
interface StudioWorkflowDoc { path: string; sha: string }
// the spawn triple per stage — the configuration that today lives only in briefs and handoffs
// (preflight on Opus, critic on a foreign family, review on codex). Free strings on purpose: the
// adapter names are the harness's vocabulary, not this record's, and pinning them here would make
// every new adapter a server diff — the exact failure this record exists to end.
interface StudioStageSpawn { harness: string; model: string; effort: string }
// THREE NUMBERS AND A CONSEQUENCE, and they are not the same thing (workflow-v2.md §1.2, which
// carries all three per role): `budget` is what the act SHOULD cost, `stopLine` is where the role
// stops and reports, and `onBreach` is what happens when the stop line is reached. A brief that
// rendered a budget as if it were a limit, or a limit with no consequence, would teach the session
// the wrong contract — so the record carries the three separately or not at all. ALL THREE ARE
// OPTIONAL: a studio written before this cut keeps loading, its stages simply render without them.
interface StudioStage { id: string; title: string; role: string; required: boolean;
  gate?: string; spawn?: StudioStageSpawn; budget?: number; stopLine?: number; onBreach?: string }
interface StudioWorkflow { doc: StudioWorkflowDoc; stages: StudioStage[] }
interface StudioBriefBlock { id: string; appliesTo: StudioBriefAudience; text: string }
interface StudioGates { criticBeforeTaste: boolean; programLint: boolean; completeNeedsProof: boolean }
interface Studio {
  v: 1; id: string; name: string; createdAt: number; confirmedAt: number; rev: number;
  machineProfile: StudioMachineProfile;
  repoPolicy: StudioRepoPolicy;
  workflow: StudioWorkflow;
  briefBlocks: StudioBriefBlock[];
  gates: StudioGates;
}
// the owner-settable half — everything the wire may carry. `id` is owner-chosen (a slug, so the
// record is referenceable by name in a brief and readable in a ledger); the four stamps
// (`v`, `createdAt`, `confirmedAt`, `rev`) are the server's and appear in no request body.
type StudioContent = Pick<Studio, "name" | "machineProfile" | "repoPolicy" | "workflow"
  | "briefBlocks" | "gates">;
type StudioContentRead = { ok: true; content: StudioContent } | { ok: false; error: string };
const MAX_STUDIOS = 20;
const STUDIO_ID_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
const STUDIO_NAME_MAX = 120;
const STUDIO_STAGES_MAX = 40;
const STUDIO_BRIEF_BLOCKS_MAX = 40;
const STUDIO_TEXT_MAX = 8000;
const STUDIO_SHORT_MAX = 200;
const STUDIO_KEYS = ["v", "id", "name", "createdAt", "confirmedAt", "rev", "machineProfile",
  "repoPolicy", "workflow", "briefBlocks", "gates"];
const STUDIO_CONTENT_KEYS = ["name", "machineProfile", "repoPolicy", "workflow", "briefBlocks", "gates"];
const STUDIO_STAGE_KEYS = ["id", "title", "role", "required", "gate", "spawn", "budget", "stopLine", "onBreach"];
const STUDIO_SPAWN_KEYS = ["harness", "model", "effort"];
const STUDIO_BRIEF_BLOCK_KEYS = ["id", "appliesTo", "text"];
const shortStudioString = (v: unknown, max = STUDIO_SHORT_MAX): boolean =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const studioStageFrom = (value: unknown, i: number): StudioStage | string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `stage ${i} must be an object`;
  const r = value as Record<string, unknown>;
  const unknown = Object.keys(r).filter((k) => !STUDIO_STAGE_KEYS.includes(k));
  if (unknown.length) return `stage ${i} has unknown key(s): ${unknown.join(", ")} — a stage is exactly {${STUDIO_STAGE_KEYS.join(", ")}}`;
  if (!shortStudioString(r.id)) return `stage ${i} id must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters`;
  if (!shortStudioString(r.title)) return `stage ${i} title must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters`;
  if (!shortStudioString(r.role)) return `stage ${i} role must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters`;
  if (typeof r.required !== "boolean") return `stage ${i} required must be a boolean`;
  if (r.gate !== undefined && !shortStudioString(r.gate))
    return `stage ${i} gate must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters when present`;
  let spawn: StudioStageSpawn | undefined;
  if (r.spawn !== undefined) {
    if (!r.spawn || typeof r.spawn !== "object" || Array.isArray(r.spawn))
      return `stage ${i} spawn must be an object when present`;
    const s = r.spawn as Record<string, unknown>;
    const unknownSpawn = Object.keys(s).filter((k) => !STUDIO_SPAWN_KEYS.includes(k));
    if (unknownSpawn.length)
      return `stage ${i} spawn has unknown key(s): ${unknownSpawn.join(", ")} — a spawn is exactly {${STUDIO_SPAWN_KEYS.join(", ")}}`;
    if (!shortStudioString(s.harness) || !shortStudioString(s.model) || !shortStudioString(s.effort))
      return `stage ${i} spawn must carry harness, model and effort as non-empty strings`;
    spawn = { harness: s.harness as string, model: s.model as string, effort: s.effort as string };
  }
  // A token count is a POSITIVE INTEGER or it is not a token count. `0` and a fraction are refused
  // rather than narrowed, for the reason every other field here is: a budget nobody wrote is a
  // budget the session would still obey.
  for (const key of ["budget", "stopLine"] as const)
    if (r[key] !== undefined && !(typeof r[key] === "number" && Number.isInteger(r[key]) && (r[key] as number) > 0))
      return `stage ${i} ${key} must be a positive integer number of tokens when present`;
  if (r.onBreach !== undefined && !shortStudioString(r.onBreach))
    return `stage ${i} onBreach must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters when present`;
  return { id: r.id as string, title: r.title as string, role: r.role as string,
    required: r.required, ...(r.gate !== undefined ? { gate: r.gate as string } : {}),
    ...(spawn ? { spawn } : {}),
    ...(r.budget !== undefined ? { budget: r.budget as number } : {}),
    ...(r.stopLine !== undefined ? { stopLine: r.stopLine as number } : {}),
    ...(r.onBreach !== undefined ? { onBreach: r.onBreach as string } : {}) };
};
const studioBriefBlockFrom = (value: unknown, i: number): StudioBriefBlock | string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `briefBlock ${i} must be an object`;
  const r = value as Record<string, unknown>;
  const unknown = Object.keys(r).filter((k) => !STUDIO_BRIEF_BLOCK_KEYS.includes(k));
  if (unknown.length) return `briefBlock ${i} has unknown key(s): ${unknown.join(", ")} — a block is exactly {${STUDIO_BRIEF_BLOCK_KEYS.join(", ")}}`;
  if (!shortStudioString(r.id)) return `briefBlock ${i} id must be a non-empty string of at most ${STUDIO_SHORT_MAX} characters`;
  if (typeof r.appliesTo !== "string" || !STUDIO_BRIEF_AUDIENCES.includes(r.appliesTo as StudioBriefAudience))
    return `briefBlock ${i} appliesTo must be one of: ${STUDIO_BRIEF_AUDIENCES.join(", ")}`;
  if (!shortStudioString(r.text, STUDIO_TEXT_MAX))
    return `briefBlock ${i} text must be a non-empty string of at most ${STUDIO_TEXT_MAX} characters`;
  return { id: r.id as string, appliesTo: r.appliesTo as StudioBriefAudience, text: r.text as string };
};
// The ONE reader of everything a caller may send, used by BOTH studio doors so create and change
// can never disagree about what a legal Studio is. It returns a typed error rather than undefined
// because a door owes the owner the reason: a 400 that only says "invalid" turns a typo into a
// hunt. Nothing here is field-wise repaired — half a workflow is a different workflow.
const studioContentFrom = (value: unknown): StudioContentRead => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "must be an object" };
  const r = value as Record<string, unknown>;
  const unknown = Object.keys(r).filter((k) => !STUDIO_CONTENT_KEYS.includes(k));
  if (unknown.length)
    return { ok: false, error: `unknown studio key(s): ${unknown.join(", ")} — a studio body is exactly {${STUDIO_CONTENT_KEYS.join(", ")}}` };
  if (!shortStudioString(r.name, STUDIO_NAME_MAX))
    return { ok: false, error: `name must be a non-empty string of at most ${STUDIO_NAME_MAX} characters` };
  if (typeof r.machineProfile !== "string" || !STUDIO_MACHINE_PROFILES.includes(r.machineProfile as StudioMachineProfile))
    return { ok: false, error: `machineProfile must be one of: ${STUDIO_MACHINE_PROFILES.join(", ")} — a studio CHOOSES an existing machine environment, it never invents one` };
  if (typeof r.repoPolicy !== "string" || !STUDIO_REPO_POLICIES.includes(r.repoPolicy as StudioRepoPolicy))
    return { ok: false, error: `repoPolicy must be one of: ${STUDIO_REPO_POLICIES.join(", ")}` };
  if (!r.workflow || typeof r.workflow !== "object" || Array.isArray(r.workflow))
    return { ok: false, error: "workflow must be an object" };
  const w = r.workflow as Record<string, unknown>;
  const unknownWorkflow = Object.keys(w).filter((k) => k !== "doc" && k !== "stages");
  if (unknownWorkflow.length)
    return { ok: false, error: `unknown workflow key(s): ${unknownWorkflow.join(", ")} — workflow is exactly {doc, stages}` };
  if (!w.doc || typeof w.doc !== "object" || Array.isArray(w.doc))
    return { ok: false, error: "workflow.doc must be an object" };
  const doc = w.doc as Record<string, unknown>;
  const unknownDoc = Object.keys(doc).filter((k) => k !== "path" && k !== "sha");
  if (unknownDoc.length)
    return { ok: false, error: `unknown workflow.doc key(s): ${unknownDoc.join(", ")} — doc is exactly {path, sha}` };
  if (!shortStudioString(doc.path, STUDIO_SHORT_MAX) || (doc.path as string).startsWith("/")
    || (doc.path as string).includes(".."))
    return { ok: false, error: "workflow.doc.path must be a repo-relative path without .. segments" };
  if (typeof doc.sha !== "string" || !/^[0-9a-f]{64}$/.test(doc.sha))
    return { ok: false, error: "workflow.doc.sha must be a sha256 hex digest — the OBSERVED hash of the document, which nothing here re-reads" };
  if (!Array.isArray(w.stages)) return { ok: false, error: "workflow.stages must be an array" };
  if (w.stages.length > STUDIO_STAGES_MAX)
    return { ok: false, error: `workflow.stages must hold at most ${STUDIO_STAGES_MAX} stages` };
  const stages: StudioStage[] = [];
  for (const [i, raw] of w.stages.entries()) {
    const stage = studioStageFrom(raw, i);
    if (typeof stage === "string") return { ok: false, error: stage };
    if (stages.some((s) => s.id === stage.id))
      return { ok: false, error: `stage ${i} repeats the id ${stage.id} — stage ids are how a later reader joins progress to a stage` };
    stages.push(stage);
  }
  if (!Array.isArray(r.briefBlocks)) return { ok: false, error: "briefBlocks must be an array" };
  if (r.briefBlocks.length > STUDIO_BRIEF_BLOCKS_MAX)
    return { ok: false, error: `briefBlocks must hold at most ${STUDIO_BRIEF_BLOCKS_MAX} blocks` };
  const briefBlocks: StudioBriefBlock[] = [];
  for (const [i, raw] of r.briefBlocks.entries()) {
    const block = studioBriefBlockFrom(raw, i);
    if (typeof block === "string") return { ok: false, error: block };
    if (briefBlocks.some((b) => b.id === block.id))
      return { ok: false, error: `briefBlock ${i} repeats the id ${block.id}` };
    briefBlocks.push(block);
  }
  if (!r.gates || typeof r.gates !== "object" || Array.isArray(r.gates))
    return { ok: false, error: "gates must be an object" };
  const g = r.gates as Record<string, unknown>;
  const gateKeys = ["criticBeforeTaste", "programLint", "completeNeedsProof"];
  const unknownGates = Object.keys(g).filter((k) => !gateKeys.includes(k));
  if (unknownGates.length)
    return { ok: false, error: `unknown gates key(s): ${unknownGates.join(", ")} — gates is exactly {${gateKeys.join(", ")}}` };
  if (gateKeys.some((k) => typeof g[k] !== "boolean"))
    return { ok: false, error: `gates.${gateKeys.join(", gates.")} must each be a boolean` };
  return { ok: true, content: { name: r.name as string,
    machineProfile: r.machineProfile as StudioMachineProfile,
    repoPolicy: r.repoPolicy as StudioRepoPolicy,
    workflow: { doc: { path: doc.path as string, sha: doc.sha }, stages },
    briefBlocks, gates: { criticBeforeTaste: g.criticBeforeTaste as boolean,
      programLint: g.programLint as boolean, completeNeedsProof: g.completeNeedsProof as boolean } } };
};
// loadProgramProfile's discipline, on a whole record instead of a three-field one: anything that is
// not exactly a well-formed v1 Studio loads as ABSENT — the row is SKIPPED, never field-wise
// repaired. A half-read workflow is not a smaller workflow, it is a different one, and a Program
// bound to it would be founded against stages nobody wrote.
const loadStudio = (value: unknown): Studio | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !STUDIO_KEYS.includes(k))) return undefined;
  if (r.v !== 1) return undefined;
  if (typeof r.id !== "string" || !STUDIO_ID_RE.test(r.id)) return undefined;
  for (const stamp of ["createdAt", "confirmedAt"])
    if (typeof r[stamp] !== "number" || !Number.isFinite(r[stamp]) || (r[stamp] as number) <= 0) return undefined;
  if (!Number.isInteger(r.rev) || (r.rev as number) < 1) return undefined;
  const content = studioContentFrom({ name: r.name, machineProfile: r.machineProfile,
    repoPolicy: r.repoPolicy, workflow: r.workflow, briefBlocks: r.briefBlocks, gates: r.gates });
  if (!content.ok) return undefined;
  return { v: 1, id: r.id, createdAt: r.createdAt as number, confirmedAt: r.confirmedAt as number,
    rev: r.rev as number, ...content.content };
};
// THE BINDING — a POINTER, never a copy. A copy would be a second source for the same text, which
// is the very failure mode this record ends. `rev` is the studio's revision AT BINDING TIME, so a
// later change to a shared studio is visible as a difference instead of acting silently under a
// living MAIN (docs/ideen/2026-09-03-studio-als-objekt.md §8 F2). Nothing in this cut compares the
// two numbers; whoever renders from them is S2.
interface ProgramStudioBinding { id: string; boundAt: number; rev: number }
const loadProgramStudioBinding = (value: unknown): ProgramStudioBinding | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["id", "boundAt", "rev"].includes(k))) return undefined;
  if (typeof r.id !== "string" || !STUDIO_ID_RE.test(r.id)) return undefined;
  if (typeof r.boundAt !== "number" || !Number.isFinite(r.boundAt) || r.boundAt <= 0) return undefined;
  if (!Number.isInteger(r.rev) || (r.rev as number) < 1) return undefined;
  return { id: r.id, boundAt: r.boundAt, rev: r.rev as number };
};

// CLOSED, VERSIONED, DEFAULT-DENY — loadPromotion's discipline for a record that is a HISTORY
// rather than a permission, and the degradation direction is the same for the same reason: a
// lineage nobody can parse is not a shorter lineage, it is no lineage, and the execution view then
// says "not reconstructible" instead of rendering half a history as the whole one. Unlike the
// promotion, an unreadable record is REPORTED (one audit row, one log line), because silently
// losing a history is exactly the failure this record exists to end.
//
// `via` names how an entry CAME to hold authority, `endedBy` how the holding ENDED. The first close
// wins and is never overwritten: a MAIN whose pane was torn down keeps `retire` with the observed
// time even when a later bootstrap rebinds over the stale binding — that rebound is on the NEW
// entry's `via`. `endedBy:"rebound"` on an entry therefore means precisely "its death was never
// observed; the binding was found stale at rebind time". `replaced` is the one exit without a
// successor: a bootstrap over a stale binding dropped it with its founding marker and then failed,
// so the Program stands active and unbound.
type ProgramLineageVia = "bootstrap" | "rebound" | "succeed" | "backfill-unknown";
type ProgramLineageEndedBy = "rebound" | "succeed" | "retire" | "replaced";
interface ProgramLineageEntry {
  slot: number; openedAt: number; sessionId: string | null; boundAt: number;
  via: ProgramLineageVia; endedAt: number | null; endedBy: ProgramLineageEndedBy | null;
}
interface ProgramLineage { v: 1; entries: ProgramLineageEntry[]; dropped: number }
// the oldest entries fall off first and are COUNTED, so a capped record still says how much of the
// history it no longer carries
const PROGRAM_LINEAGE_MAX = 50;
const PROGRAM_LINEAGE_VIA: ProgramLineageVia[] = ["bootstrap", "rebound", "succeed", "backfill-unknown"];
const PROGRAM_LINEAGE_ENDED_BY: ProgramLineageEndedBy[] = ["rebound", "succeed", "retire", "replaced"];
const PROGRAM_LINEAGE_ENTRY_KEYS = ["slot", "openedAt", "sessionId", "boundAt", "via", "endedAt", "endedBy"];
type ProgramLineageRead = { ok: true; lineage: ProgramLineage } | { ok: false; error: string };
const loadProgramLineageEntry = (value: unknown, index: number): ProgramLineageEntry | string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return `entry ${index} must be an object`;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !PROGRAM_LINEAGE_ENTRY_KEYS.includes(k))
    || Object.keys(r).length !== PROGRAM_LINEAGE_ENTRY_KEYS.length)
    return `entry ${index} must contain exactly ${PROGRAM_LINEAGE_ENTRY_KEYS.join(", ")}`;
  if (!Number.isInteger(r.slot) || (r.slot as number) < 1 || (r.slot as number) > MAX_SLOTS)
    return `entry ${index} slot must be an integer in 1..${MAX_SLOTS}`;
  if (typeof r.openedAt !== "number" || !Number.isFinite(r.openedAt) || r.openedAt <= 0)
    return `entry ${index} openedAt must be a positive number`;
  if (r.sessionId !== null && typeof r.sessionId !== "string") return `entry ${index} sessionId must be a string or null`;
  if (typeof r.boundAt !== "number" || !Number.isFinite(r.boundAt) || r.boundAt <= 0)
    return `entry ${index} boundAt must be a positive number`;
  if (typeof r.via !== "string" || !PROGRAM_LINEAGE_VIA.includes(r.via as ProgramLineageVia))
    return `entry ${index} via must be one of ${PROGRAM_LINEAGE_VIA.join(", ")}`;
  if (r.endedAt !== null && (typeof r.endedAt !== "number" || !Number.isFinite(r.endedAt) || r.endedAt <= 0))
    return `entry ${index} endedAt must be a positive number or null`;
  if (r.endedBy !== null && (typeof r.endedBy !== "string"
    || !PROGRAM_LINEAGE_ENDED_BY.includes(r.endedBy as ProgramLineageEndedBy)))
    return `entry ${index} endedBy must be one of ${PROGRAM_LINEAGE_ENDED_BY.join(", ")} or null`;
  if ((r.endedAt === null) !== (r.endedBy === null)) return `entry ${index} endedAt and endedBy must be null together`;
  return { slot: r.slot as number, openedAt: r.openedAt, sessionId: r.sessionId as string | null,
    boundAt: r.boundAt, via: r.via as ProgramLineageVia, endedAt: r.endedAt as number | null,
    endedBy: r.endedBy as ProgramLineageEndedBy | null };
};
const loadProgramLineage = (value: unknown): ProgramLineageRead => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "must be an object" };
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["v", "entries", "dropped"].includes(k)) || Object.keys(r).length !== 3)
    return { ok: false, error: "must contain exactly v, entries, dropped" };
  if (r.v !== 1) return { ok: false, error: "v must be 1" };
  if (!Array.isArray(r.entries)) return { ok: false, error: "entries must be an array" };
  if (r.entries.length > PROGRAM_LINEAGE_MAX)
    return { ok: false, error: `entries must hold at most ${PROGRAM_LINEAGE_MAX} rows` };
  if (!Number.isInteger(r.dropped) || (r.dropped as number) < 0)
    return { ok: false, error: "dropped must be a non-negative integer" };
  const entries: ProgramLineageEntry[] = [];
  for (const [index, raw] of r.entries.entries()) {
    const entry = loadProgramLineageEntry(raw, index);
    if (typeof entry === "string") return { ok: false, error: entry };
    // append-only with close-before-append: only the newest holding can still be open
    if (entry.endedAt === null && index !== r.entries.length - 1)
      return { ok: false, error: `entry ${index} is open but is not the newest entry` };
    entries.push(entry);
  }
  return { ok: true, lineage: { v: 1, entries, dropped: r.dropped as number } };
};

type ProgramFoundingMode = "bootstrap" | "succession";
interface ProgramFoundingOccupant { slot: number; openedAt: number }
interface ProgramFoundingV1 {
  v: 1;
  attemptId: string;
  mode: ProgramFoundingMode;
  canonicalRoot: string;
  target: ProgramFoundingOccupant;
  predecessor: ProgramFoundingOccupant | null;
  startedAt: number;
}
type ProgramFoundingProfileKind = "standard" | ProgramProfileKind;
interface ProgramFoundingIdentity extends ProgramFoundingOccupant { selfTokenHash: string }
interface ProgramFoundingV2 {
  v: 2;
  profileKind: ProgramFoundingProfileKind;
  attemptId: string;
  mode: ProgramFoundingMode;
  targetRoot: string;
  target: ProgramFoundingIdentity;
  predecessor: ProgramFoundingIdentity | null;
  startedAt: number;
}
type ProgramFounding = ProgramFoundingV1 | ProgramFoundingV2;
type ProgramFoundingRead = { ok: true; founding: ProgramFounding } | { ok: false; error: string };
const foundingOccupantFrom = (value: unknown): ProgramFoundingOccupant | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["slot", "openedAt"].includes(k))) return null;
  if (!Number.isInteger(r.slot) || (r.slot as number) < 1 || (r.slot as number) > MAX_SLOTS) return null;
  if (typeof r.openedAt !== "number" || !Number.isFinite(r.openedAt) || r.openedAt <= 0) return null;
  return { slot: r.slot as number, openedAt: r.openedAt };
};
const foundingIdentityFrom = (value: unknown): ProgramFoundingIdentity | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((k) => !["slot", "openedAt", "selfTokenHash"].includes(k))
    || Object.keys(r).length !== 3) return null;
  const occupant = foundingOccupantFrom({ slot: r.slot, openedAt: r.openedAt });
  if (!occupant || typeof r.selfTokenHash !== "string" || !/^[0-9a-f]{64}$/.test(r.selfTokenHash)) return null;
  return { ...occupant, selfTokenHash: r.selfTokenHash };
};

type ProgramContent = Pick<Program, "title" | "intent" | "successCriterion" | "nonGoals"
  | "decisions" | "evidence" | "openQuestions">;
type ProgramValidation = { ok: true; content: ProgramContent } | { ok: false; error: string };

// The cross-program Supervisor is a SINGLETON above every Program bracket, so its binding lives
// beside `programs` rather than inside one of them. Identical shape to Program.main on purpose:
// slot+openedAt is the only occupant identity Fleet ever trusts, and a recycled slot must never
// inherit an authority its predecessor held. The binding grants no capability by itself — it names
// who the Supervisor is, and nothing reads it as permission to write.
interface SupervisorBinding {
  slot: number;
  openedAt: number;
  sessionId: string | null;
  boundAt: number;
}

type ProgramDigest = Pick<Program, "id" | "status" | "title" | "createdAt">;

export type {
  BoxPin, WSData, Share, ShareComment, Auto, WatchBase, LaneWatch, MergeWatch, AuditWatch,
  DeployWatch, TransitionWatch, CommandJobWatch, Watch, FleetEventStatus, FleetEventRecoveryState,
  FleetEventRecovery, FleetEventBase, LaneFleetEvent, MergeFleetEvent, AuditFleetEvent,
  DeployFleetEvent, CommandJobFleetEvent, ClarificationFleetEvent, FleetReportFleetEvent,
  HelperCmdCheck,
  SupervisorTransitionEventPayload, SupervisorTransitionFleetEvent, FleetEvent, ClarificationStatus,
  ClarificationRequest, FleetReportDisposition, FleetReportDecision, FleetReport, AttentionKind, AttentionStatus, AttentionRequest, TaskKind,
  Task, TaskBrief, TaskComment, TaskAnalysis, AnalysisBlocker, TaskCriterion, RefineChild,
  RefineProposal, TaskRefine, LaneForm, LaneRef, SuccessionRetirement, CodexRecoveryState, Slot,
  MainDirectResult, MainDirectPreflight, MainDirectOutcome, ProgramStatus, Program,
  PromotionSelfLand, PromotionPolicy, ProgramProfileKind, ProgramProfile, ProgramLineageVia,
  ProgramLineageEndedBy, ProgramLineageEntry, ProgramLineage, ProgramLineageRead,
  ProgramFoundingMode, ProgramFoundingOccupant, ProgramFoundingV1, ProgramFoundingProfileKind,
  ProgramFoundingIdentity, ProgramFoundingV2, ProgramFounding, ProgramFoundingRead, ProgramContent,
  ProgramValidation, SupervisorBinding, ProgramDigest, DispatchSpawn, SlotStreamOccupant,
  StudioMachineProfile, StudioRepoPolicy, StudioBriefAudience, StudioWorkflowDoc, StudioStageSpawn,
  StudioStage, StudioWorkflow, StudioBriefBlock, StudioGates, Studio, StudioContent,
  StudioContentRead, ProgramStudioBinding,
};
export {
  MAX_SLOTS, watchKind, TRANSITION_AWAITING_MAX, TRANSITION_DEADLINE_MIN_SEC,
  TRANSITION_DEADLINE_MAX_SEC, TRANSITION_DEADLINE_DEFAULT_SEC, watchFrom, FLEET_EVENT_TERMINAL,
  ATTENTION_KINDS, fleetEventRecoveryFrom, fleetEventFrom, clarificationFrom, fleetReportFrom,
  attentionFrom, MAX_CLARIFICATION_QUESTION, MAX_CLARIFICATION_ANSWER, MAX_FLEET_REPORT_TEXT,
  FLEET_REPORT_DISPOSITIONS, MAX_FLEET_REPORT_DECISION_REASON,
  MAX_ATTENTION_TEXT, MAX_ATTENTION_ANSWER, MAX_ATTENTION_PROVENANCE_TEXT,
  ATTENTION_CANDIDATE_SHA_RE, ATTENTION_BRANCH_RE, validAttentionBranch, MAX_SUPERVISOR_NUDGE_TEXT,
  TASK_KINDS, isTaskKind, loadTaskKind, PROGRAM_STATUSES, PROMOTION_SELF_LAND, loadPromotion,
  PROGRAM_PROFILE_KINDS, loadProgramProfile, PROGRAM_LINEAGE_MAX, PROGRAM_LINEAGE_VIA,
  PROGRAM_LINEAGE_ENDED_BY, PROGRAM_LINEAGE_ENTRY_KEYS, loadProgramLineageEntry, loadProgramLineage,
  foundingOccupantFrom, foundingIdentityFrom,
  MAX_STUDIOS, STUDIO_ID_RE, studioContentFrom, loadStudio, loadProgramStudioBinding,
  HELPER_CMD_ALLOW, HELPER_CMD_FORBIDDEN, HELPER_CMD_MAX, helperCmdCheck,
  HELPER_ARTIFACT_GLOB_MAX, HELPER_ARTIFACT_MAX, HELPER_ARTIFACT_PATH_MAX,
  helperArtifactGlobsFrom, helperArtifactsFrom,
};

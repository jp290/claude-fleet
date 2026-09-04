// --- `done-looking` as a DETERMINISTIC predicate (docs/attic/perception-layer.md §3).
//
// The term existed only as an LLM label: DIGEST_CONDITIONS lists it, and the digest worker is
// handed the rule in prose. An auto-trigger must not hang off a model output when every input is
// already a server-side fact (verification.md: deterministic > statistical), and making the
// demand-triggered, advisory digest the trigger for an ACTION would silently invert its contract.
//
// So the rule lives here ONCE, as a list of clauses that carry both halves: the `prose` the digest
// worker is handed, and the `holds` test the auto-③ path evaluates. The prompt line is COMPOSED
// from the same list the predicate iterates — the specification and the implementation cannot drift
// apart without the prompt changing in the same edit. The digest keeps its own label (it also
// classifies non-lane slots this predicate does not care about); it is simply no longer the source.
//
// Inputs are exactly the fields stewardSlotsView already computes, so this stays a pure function
// over facts Fleet has: no git calls, no clock, no I/O.

export interface LaneSignalView {
  alive: boolean | null;
  idleMs: number | null;
  git: { dirty: number; ahead: number } | null;
  gitOp: boolean | null;
  merge: { status: string; errorReason?: MergeErrorReason } | null;
  // has this pane's output ever been observed? `idleMs` is derived from Slot.lastOutput, which is 0
  // until the poll sees a first byte — and 0 yields a NUMBER (~1.79e12 ms), not a null. done-looking
  // survives that by other means; `stalled` cannot (see STALLED_RULES).
  observed: boolean;
  // the owner's parking brake (Slot.awaiting) — a clarify lane told to report and wait
  awaiting: "owner" | "main" | null;
  // adapter-declared ownership of the repository write: true means the lane produces files while
  // Fleet's HOST records them (POST /api/slots/:id/commit). This is a fact supplied by server.ts,
  // not something this pure predicate guesses from a harness id.
  hostCommits: boolean;
}

// a merge the owner has to look at is not a lane that finished its work
const MERGE_BLOCKING = ["blocked", "error"];

// --- THE ONE ERROR THAT IS NOT A VERDICT ABOUT THE TREE.
//
// Measured 2026-09-02 06:09-07:20 CEST (program 66499a03, MAIN slot 4, lane slot 8): a guarded
// self-land rebased cleanly, the gate ran GREEN (110 s of work after 1838 s behind the suite
// mutex), and then `git merge --ff-only` was refused because a docs-only commit had landed on main
// meanwhile. mergeJob writes that as `status: "error"`, "error" is MERGE_BLOCKING, and from that
// moment the lane could never be done-looking again: the lane-ready watch could not fire, and
// clause (11) of the self-land door answered every retry `the lane is not done-looking (no
// signal)` — with and without `{"confirm":true}`, and after main had moved a second time. The
// owner had to land it. Step 5 of that Program silently degraded to owner-land.
//
// The sentence above is TRUE for a blocked resolution, a red verify and a conflict the resolver
// could not settle: something in that tree needs eyes. It is FALSE here. Nothing needs looking at
// — the tree passed its own gate, the land was authorised, and the only thing that happened is
// that somebody else's commit arrived first. So this ONE fact is exempted.
//
// It is exempted as a TYPED fact and never by reading `detail`. `detail` is prose written for a
// human ("rebase ok, but fast-forwarding main failed: …"), and a predicate that parsed it would
// re-block the lane silently the day that sentence is reworded. The test is POSITIVE over a closed
// enum, in the same direction every clause in this file argues for: an absent, unknown or legacy
// `errorReason` is UNKNOWN and blocks exactly as every error always has. Widening this list is
// therefore a deliberate act per value, never a side effect.
export type MergeErrorReason = "ff-lost";
export const MERGE_ERROR_REASONS: readonly MergeErrorReason[] = ["ff-lost"];

export function mergeBlocksLane(m: LaneSignalView["merge"]): boolean {
  if (!MERGE_BLOCKING.includes(m?.status ?? "")) return false;
  // THE PAIR, not the reason alone. A first cut tested only `errorReason` and thereby exempted a
  // `blocked` row that happened to carry it — caught by this slice's own predicate check before it
  // ever reached a lane. `blocked` is a merge the owner must look at whatever any persisted row
  // claims about it, and the loader (server.ts#withValidErrorReason) validates the SAME pair, so
  // the two halves cannot disagree about which shape the exemption belongs to.
  return !(m?.status === "error" && m.errorReason === "ff-lost");
}

export interface LaneRule {
  readonly prose: string;
  readonly holds: (v: LaneSignalView, idleThresholdMs: number) => boolean;
  // the ONE clause that is a clock rather than a fact — see laneQuietSince
  readonly clock?: true;
}

// Every clause is required (an AND), and every one of them is a NEGATION test the ③ trigger must
// survive: an unknown fact (null alive, null git, un-ticked idleMs) reads as NOT done-looking —
// never as permission to spawn.
export const DONE_LOOKING_RULES: readonly LaneRule[] = [
  { prose: "alive", holds: (v) => v.alive === true },
  { prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t, clock: true },
  { prose: "no git op in progress", holds: (v) => v.gitOp !== true },
  { prose: "no blocked/errored merge (a lost fast-forward is not one)", holds: (v) => !mergeBlocksLane(v.merge) },
  { prose: "clean tree", holds: (v) => v.git !== null && v.git.dirty === 0 },
  { prose: "git.ahead>0", holds: (v) => v.git !== null && v.git.ahead > 0 },
];

// the digest worker's rule line, generated from the clauses above — see the note at the top
export const DONE_LOOKING_PROSE =
  `${DONE_LOOKING_RULES.map((r) => r.prose).join(" + ")} → done-looking`;

export function laneDoneLooking(v: LaneSignalView, idleThresholdMs: number): boolean {
  return DONE_LOOKING_RULES.every((r) => r.holds(v, idleThresholdMs));
}

// --- `host-commit-looking`: a SECOND predicate, not a relaxed done-looking.
//
// A host-committed harness cannot make done-looking true: its intended finished shape is dirty>0
// and ahead===0 until the host records the work. The same git shape on a self-committing harness is
// merely stalled-dirty, so adapter ownership is a required positive fact here. `awaiting:null`
// excludes a clarify lane parked by design. As above, every permission-shaped fact is tested in
// the positive direction; an unknown alive/git/idle/git-op never becomes permission to notify.
// The ahead===0 clause also makes this predicate disjoint from done-looking by construction.
export const HOST_COMMIT_LOOKING_RULES: readonly LaneRule[] = [
  { prose: "host commits for this harness", holds: (v) => v.hostCommits === true },
  { prose: "alive", holds: (v) => v.alive === true },
  { prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t, clock: true },
  { prose: "no git op in progress", holds: (v) => v.gitOp === false },
  { prose: "no blocked/errored merge (a lost fast-forward is not one)", holds: (v) => !mergeBlocksLane(v.merge) },
  { prose: "dirty tree", holds: (v) => v.git !== null && v.git.dirty > 0 },
  { prose: "git.ahead===0", holds: (v) => v.git !== null && v.git.ahead === 0 },
  { prose: "awaiting:null", holds: (v) => v.awaiting === null },
];

export function laneHostCommitLooking(v: LaneSignalView, idleThresholdMs: number): boolean {
  return HOST_COMMIT_LOOKING_RULES.every((r) => r.holds(v, idleThresholdMs));
}

// The watch needs not only the OR but which disjoint predicate supplied it, because the receiver's
// next action differs. Keeping the selector pure makes the new arm testable without weakening the
// fleet-wide foreign-harness automation policy merely to create an integration fixture.
export type LaneWatchSignal = "done-looking" | "host-commit-looking";
export function laneWatchSignal(v: LaneSignalView, idleThresholdMs: number): LaneWatchSignal | null {
  if (laneDoneLooking(v, idleThresholdMs)) return "done-looking";
  if (laneHostCommitLooking(v, idleThresholdMs)) return "host-commit-looking";
  return null;
}

export type LaneWatchEventKind = "lane-ready" | "host-commit-ready";
// This is the complete event payload: closed, typed Fleet facts only. In particular it has no
// text/command/detail escape hatch that could turn persisted state into pane input after reload.
export interface LaneWatchEventPayload {
  ahead: number;
  dirty: number;
  idleMs: number;
  observed: boolean;
  gitOp: boolean | null;
  awaiting: "owner" | "main" | null;
  hostCommits: boolean;
}
export interface LaneWatchEventView {
  id: string;
  kind: LaneWatchEventKind;
  payload: LaneWatchEventPayload;
}

export type MergeWatchEventStatus =
  "merged" | "blocked" | "error" | "resolved" | "interrupted" | "awaiting-author";
export interface MergeWatchVerifyPayload {
  ok: boolean | null;
  timedOut?: true;
  waitedOut?: true;
  stale?: true;
}
export interface MergeWatchEventPayload {
  status: MergeWatchEventStatus;
  landed: boolean;
  branch: string;
  at: number;
  verify?: MergeWatchVerifyPayload;
  conflicted?: string[];
  resolvedBy?: "agent" | "author";
}
export interface MergeWatchEventView {
  id: string;
  kind: "merge-terminal";
  payload: MergeWatchEventPayload;
}

export interface AuditWatchCoverPayload {
  branch: string;
  mainAfter: string;
}
export interface AuditWatchEventPayload {
  result: "green" | "red" | "unknown";
  mainSha: string;
  covers: AuditWatchCoverPayload[];
  checks: { ran: number; failed: number; ranIsLowerBound?: true } | null;
  reason?: string;
}
export interface AuditWatchEventView {
  id: string;
  kind: "post-land-audit";
  payload: AuditWatchEventPayload;
}

export interface DeployWatchEventPayload {
  ok: boolean | null;
  stage: "build" | "restart" | "boot";
  target: string | null;
  bootHead: string | null;
  hitTarget: boolean | null;
  bundleStale: boolean | null;
  at: number;
  reason?: string;
}
export interface DeployWatchEventView {
  id: string;
  kind: "deploy-terminal";
  payload: DeployWatchEventPayload;
}

// THE COMMAND JOB's verdict, and it carries the one thing the audit and deploy payloads do not
// need: a LIST OF ARTEFACTS. A `command` job exists to move work off this box and get something
// BACK — the receipt without the artefact digest would only say "it ran", which the exit code
// already says. `bytes` is a number and never the content: this notification is a sentence typed
// into a pane, and a pane is the wrong place for a file (the upload is its own slice).
// `artifacts: []` is a legitimate answer (a `bun run build` asked for nothing), NEVER a failure —
// the two are separated by `exitCode`, and only by it.
export interface CommandJobArtifactPayload {
  path: string;
  sha256: string;
  bytes: number;
}
export interface CommandJobWatchEventPayload {
  result: "green" | "red" | "unknown";
  cmd: string;
  exitCode: number | null;
  artifacts: CommandJobArtifactPayload[];
  reason?: string;
}
export interface CommandJobWatchEventView {
  id: string;
  kind: "command-job";
  payload: CommandJobWatchEventPayload;
}

export type ClarificationBasis = "program-main" | "lane-watch" | "program-main+lane-watch";
// Closed server-stamped provenance only. The question is the one caller field admitted by the
// request route; no receiver, command, or arbitrary detail can hitch a ride through persistence.
export interface ClarificationEventPayload {
  requestId: string;
  question: string;
  taskId: string | null;
  originId: string | null;
  programId: string | null;
  basis: ClarificationBasis;
}
export interface ClarificationEventView {
  id: string;
  kind: "clarification-request";
  payload: ClarificationEventPayload;
}

export function laneWatchEventKind(signal: LaneWatchSignal): LaneWatchEventKind {
  return signal === "host-commit-looking" ? "host-commit-ready" : "lane-ready";
}

export function laneWatchPayload(v: LaneSignalView): LaneWatchEventPayload {
  if (!v.git || v.idleMs === null) throw new Error("a watch event requires known git and idle facts");
  return {
    ahead: v.git.ahead,
    dirty: v.git.dirty,
    idleMs: v.idleMs,
    observed: v.observed,
    gitOp: v.gitOp,
    awaiting: v.awaiting,
    hostCommits: v.hostCommits,
  };
}

export function laneWatchMessage(slot: number, branch: string, event: LaneWatchEventView): string {
  const { id, kind, payload: p } = event;
  const ack = `After reading, acknowledge event ${id}: POST /api/self/events/${id}/ack with `
    + `x-fleet-self-token from $FLEET_SELF_TOKEN.`;
  if (kind === "host-commit-ready") {
    return `[fleet] slot ${slot} (${branch}) [event ${id}] now LOOKS ready for a host commit — pane idle, `
      + `${p.ahead} ahead / ${p.dirty} dirty. The work is UNCOMMITTED, 0 ahead is expected `
      + `for this harness, and the next step is a host commit via POST /api/slots/${slot}/commit. This is the `
      + `server's weaker predicate over facts (host commits + idle + dirty>0 + ahead===0 + awaiting:null), `
      + `NOT a report from that lane. Read the pane before you commit, review, or land. ${ack}`;
  }
  return `[fleet] slot ${slot} (${branch}) [event ${id}] now LOOKS done — pane idle, tree clean, `
    + `${p.ahead} ahead / ${p.dirty} dirty. That is the server's predicate over facts `
    + `(idle + clean + ahead>0), NOT a report from that lane: it reads identically for a lane running a `
    + `suite, a lane parked waiting on the owner, and a lane that compiled a brief instead of building. `
    + `Read the pane before you act, and never land on this message alone. ${ack}`;
}

const eventAck = (id: string): string =>
  `After reading, acknowledge event ${id}: POST /api/self/events/${id}/ack with `
  + `x-fleet-self-token from $FLEET_SELF_TOKEN.`;

export function mergeWatchMessage(slot: number, cwd: string, event: MergeWatchEventView): string {
  const p = event.payload;
  const verify = p.verify === undefined ? "unverified (no verify result)"
    : p.verify.waitedOut ? "verify never started"
    : p.verify.timedOut ? "verify timed out"
    : p.verify.ok === true ? "verify green"
    : p.verify.ok === false ? "verify RED"
    : "verify skipped";
  const next = p.status === "resolved"
    ? " Awaiting your review; it is NOT landed."
    : p.status === "awaiting-author"
    ? " It is waiting on the author/review path and is NOT landed."
    : p.status === "interrupted"
    ? " The run was interrupted and is unmeasured; it is NOT landed."
    : p.landed ? "" : " It is NOT landed.";
  return `[fleet] merge [event ${event.id}] for slot ${slot} (${p.branch}, ${cwd}) reached terminal `
    + `status=${p.status}; landed=${p.landed ? "YES" : "NO"}; ${verify}.${next} This is a successful `
    + `notification of the terminal result, not a claim that the merge succeeded. ${eventAck(event.id)}`;
}

export function auditWatchMessage(repo: string, mainAfter: string, event: AuditWatchEventView): string {
  const p = event.payload;
  const checks = p.checks
    ? `${p.checks.ranIsLowerBound ? "at least " : ""}${p.checks.ran} checks, ${p.checks.failed} failed`
    : "check count unknown";
  const why = p.reason ? ` Reason: ${p.reason}.` : "";
  return `[fleet] post-land audit [event ${event.id}] for ${repo} land ${mainAfter} reached terminal `
    + `result=${p.result}; audited tip=${p.mainSha || "unknown"}; ${checks}.${why} This notification `
    + `does not adjudicate, undo, or deploy anything. ${eventAck(event.id)}`;
}

export function deployWatchMessage(deployId: string, event: DeployWatchEventView): string {
  const p = event.payload;
  const verdict = p.ok === true ? "YES" : p.ok === false ? "NO" : "UNVERIFIED";
  const why = p.reason ? ` Reason: ${p.reason}.` : "";
  return `[fleet] deploy [event ${event.id}] for ${deployId} reached terminal stage=${p.stage}; `
    + `ok=${verdict}; target=${p.target ?? "unknown"}; bootHead=${p.bootHead ?? "unknown"}; `
    + `hitTarget=${p.hitTarget === null ? "unknown" : p.hitTarget}; `
    + `bundleStale=${p.bundleStale === null ? "unknown" : p.bundleStale}.${why} This is a successful `
    + `notification of the terminal result, not a claim that the deploy succeeded. ${eventAck(event.id)}`;
}

export function commandJobWatchMessage(jobId: string, event: CommandJobWatchEventView): string {
  const p = event.payload;
  // the three artefact facts, and the CAP is named rather than silently applied: a receipt that
  // shows 8 of 50 entries and does not say so reads as a complete list.
  const shown = p.artifacts.slice(0, 8);
  const files = p.artifacts.length === 0
    ? "no artefacts were asked for or none matched"
    : `${p.artifacts.length} artefact(s)`
      + `${shown.map((a) => ` ${a.path} sha256=${a.sha256.slice(0, 12)} ${a.bytes} B`).join(";")}`
      + `${p.artifacts.length > shown.length ? ` (+${p.artifacts.length - shown.length} more)` : ""}`;
  const why = p.reason ? ` Reason: ${p.reason}.` : "";
  return `[fleet] remote command job [event ${event.id}] ${jobId} reached terminal result=${p.result}; `
    + `cmd=${p.cmd}; exit=${p.exitCode === null ? "none" : p.exitCode}; ${files}.${why} The artefacts were `
    + `hashed in the helper's clone and NOT uploaded — this names them, it does not deliver them. `
    + `${eventAck(event.id)}`;
}

const oneLine = (text: string): string => text.replace(/\s+/g, " ").trim();

export function clarificationWatchMessage(
  slot: number,
  branch: string,
  event: ClarificationEventView,
): string {
  const p = event.payload;
  return `[fleet] CLARIFICATION QUESTION from worker slot ${slot} (${branch}) [event ${event.id}; request ${p.requestId}]. `
    + `This is a worker question, NOT an instruction to execute blindly. task=${p.taskId ?? "none"}; `
    + `origin=${p.originId ?? "none"}; program=${p.programId ?? "none"}; basis=${p.basis}. `
    + `Question: ${oneLine(p.question)} Reply exactly once with POST /api/self/clarifications/${p.requestId}/reply `
    + `using x-fleet-self-token from $FLEET_SELF_TOKEN and JSON {"text":"..."}. `
    + `Acknowledging event ${event.id} does NOT answer this question.`;
}

export function clarificationReplyMessage(requestId: string, question: string, answer: string): string {
  return `[fleet] CLARIFICATION ANSWER [request ${requestId}] to question: ${oneLine(question)}\n${answer}`;
}

// The owner-facing twin of the message above, and it names the request id for the same reason: the
// receipt must be EXACT. A MAIN may hold several open attention requests, and an answer that only
// said "the owner replied" would be unattributable to the thing it answers.
export function attentionAnswerMessage(
  requestId: string,
  kind: string,
  raised: string,
  answer: string,
): string {
  return `[fleet] OWNER ANSWER [attention ${requestId}] to your ${kind}: ${oneLine(raised)}\n${answer}`;
}

// --- the second tier, ADDITIVE: when did this lane go quiet with every non-clock clause already
// holding? `doneLooking` answers "quiet long enough to act on" and is what auto-③ fires on; this
// answers "the facts are in, only the clock is still running — since when". A poller reading a
// lane that has committed and printed its report sees a timestamp here minutes before the boolean
// flips, and picks its own tolerance, without the trigger's threshold moving at all.
//
// Same conservative direction: it iterates the SAME clause list (one edit keeps prose, predicate
// and this in step), and any unknown fact — null alive, null git, un-ticked idleMs — returns null,
// never a timestamp. null means "no answer", exactly as false does for the predicate.
export function laneQuietSince(v: LaneSignalView, now: number): number | null {
  if (v.idleMs === null) return null;
  if (!DONE_LOOKING_RULES.every((r) => r.clock || r.holds(v, 0))) return null;
  return now - v.idleMs;
}

// --- `stalled`: the same machinery, opposite polarity (briefs/lane-stalled-fact.md).
//
// DIGEST_CONDITIONS names six lane states and exactly one of them was deterministic. The expensive
// gap is that the state which FREEZES the fleet had no word at all: a lane that is alive, has
// committed nothing, and has simply stopped. `done-looking` cannot reach it by construction (it
// requires git.ahead>0), `stalled-dirty` only covers git.dirty>0, no lane timeout exists anywhere in
// the code, and at FLEET_DISPATCH_MAX_LANES=2 two such lanes stall the dispatcher behind a row note
// that reads like healthy backpressure.
//
// This fact is RECORDED and DISPLAYED; nothing acts on it. No auto-kill, no nudge, no escalation, no
// tick reads it — the house doctrine is record → display → advise → gate → act, and this enters at
// the first step. What to DO about a stalled lane is a separate, later decision, and its input is
// the instances this fact makes countable in the first place.
//
// THE POLARITY IS THE WHOLE DIFFICULTY, and it is why this is not `!laneDoneLooking`. done-looking
// is a positive claim guarded by positive clauses, so an unknown fact falls out as `false` —
// silence. Negate that and the same unknowns become an ASSERTION: `!doneLooking` holds for a lane
// whose git facts are merely MISSING. Three live paths produce exactly that state:
//   · killSlot/openSlot reset lastOutput to 0 and drop gitInfo (server.ts). 523f5dc fixed the same
//     epoch-read for the BOOT path and deliberately left recycle alone, so `idleMs` for a
//     just-recycled lane still reads ~1.79e12 ms — past any threshold anyone will ever pick.
//   · tickGit sets alive BEFORE git in one pass, and holds git across a merge job.
//   · tickGit writes git=null outright for a cwd that is not a repo.
// So every clause below is POSITIVE over a fact that must be KNOWN. `git.ahead===0` (not
// `!(ahead>0)`) carries the "nothing to show for itself" half and makes `stalled` and `doneLooking`
// mutually exclusive by construction. `lastOutput>0` carries "this pane has actually been observed".
// And `awaiting` is a CLAUSE rather than a caller-side subtraction: a clarify lane parked on the
// owner is waiting by design, not stuck, and a predicate whose absences read as accusations must not
// depend on every future caller remembering to subtract it (that exact miss happened 2026-08-05).
export const STALLED_RULES: readonly LaneRule[] = [
  { prose: "alive", holds: (v) => v.alive === true },
  { prose: "lastOutput>0", holds: (v) => v.observed === true },
  { prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t, clock: true },
  { prose: "no git op in progress", holds: (v) => v.gitOp !== true },
  { prose: "no blocked/errored merge (a lost fast-forward is not one)", holds: (v) => !mergeBlocksLane(v.merge) },
  { prose: "awaiting:null", holds: (v) => v.awaiting === null },
  { prose: "git.ahead===0", holds: (v) => v.git !== null && v.git.ahead === 0 },
];

// the digest worker's rule line for BOTH stalled conditions, generated from the clauses above.
// `stalled-dirty` was the last hand-written condition rule in that prompt; it is a rider on this
// composed line now, so the worker's vocabulary and the server's predicate share one source.
export const STALLED_PROSE =
  `${STALLED_RULES.map((r) => r.prose).join(" + ")} → stalled (+ git.dirty>0 → stalled-dirty)`;

export function laneStalled(v: LaneSignalView, idleThresholdMs: number): boolean {
  return STALLED_RULES.every((r) => r.holds(v, idleThresholdMs));
}

// the timestamp tier, exactly as laneQuietSince is for done-looking: the epoch ms at which the pane
// went quiet with every non-clock stalled clause already holding — "the facts are in, only the clock
// is still running". It is NOT the moment the threshold was crossed, so it goes non-null long before
// the boolean flips, which is the point: a reader can see how long a lane has been on this track
// without the threshold moving. Any unknown fact returns null, never a timestamp.
export function laneStalledSince(v: LaneSignalView, now: number): number | null {
  if (v.idleMs === null) return null;
  if (!STALLED_RULES.every((r) => r.clock || r.holds(v, 0))) return null;
  return now - v.idleMs;
}

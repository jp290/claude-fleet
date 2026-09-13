// --- WHERE A PROGRAM ROW SITS ON THE RAIL, as a pure function over facts Fleet already holds.
//
// Today a MAIN or the Supervisor answers "where is this task" by reading panes and sessions: the
// 24-h measurement in docs/worktrail-B/B1-sharpener-2026-08-23.md counted 88 "read slot/session"
// bash calls against 106 decisions. Every input that answer needs is already a persisted or live
// server fact, so the answer belongs here — computed once, on request, from a closed input list.
//
// THREE THINGS THIS IS NOT, and each of them is load-bearing:
//   1. It is NOT a quality judgement. `phase` says where a row sits, never whether the work is
//      good. Semantic quality stays where it already lives: the free-text fleet-report with its
//      three-valued outcome kind, the independent critic evidence (lane-outcomes, the clean-review
//      ② contract, the post-land audit), and owner taste. No field below grades anything.
//   2. It is NOT an actuator. Nothing here writes, sends, spawns or lands. The persisted movers are
//      unchanged and named in the table: the dispatch tick (queued→sent), landLane (sent→done), the
//      watch tick (predicate→event), the owner (merge route, attention answers).
//   3. It is NOT a new lifecycle model. Nothing is stored. Delete this file and the two call sites
//      and the server is byte-for-byte what it was.
//
// THE HONESTY ARM IS A VALUE, NOT A FALLBACK. `UNKNOWN` is what the reducer OUTPUTS when an input
// it needs is missing, null or contradictory — a `sent` row with no live lane, a lane whose pane was
// never observed, a terminal row with no landed outcome. It is never a default branch in a
// serialiser, because a phase that reads "READY" for a row nobody can account for is worse than no
// phase at all: it looks like an answer.
//
// Inputs are the closed list in docs/attic/program-state-implementation-brief-2026-08-23.md §2 (I1–I6)
// and nothing else. In particular NOT: fleetReports (pruned to 20 terminal rows, so a projection
// over them would change with age), pane text, transcript bytes, task brief/comment text, any
// `lastResult` prose, or terminal attention rows (also pruned). A pruned or live-text input would
// make the same row project differently between two GETs with no fact change — falsifier §10.3.
import {
  DONE_LOOKING_RULES, HOST_COMMIT_LOOKING_RULES, laneWatchSignal, type LaneSignalView,
} from "./lane-signals";

export type Phase =
  "READY" | "RUNNING" | "REVIEWABLE" | "INTEGRATING" | "OWNER_GATE" | "CONTINUE" | "UNKNOWN";

// I1 — the row itself. `kind` and `status` are the closed persisted vocabularies; the reducer
// compares them as strings so a value this build has never heard of falls through the table
// instead of being coerced into a neighbour.
export interface PhaseTaskFacts {
  id: string;
  kind: string;
  status: string;
  note: string | null;
}

// I4 — the three merge maps, read for the lane slot that owns the row. `last` is the persisted
// verdict; `inflight`/`start` are live. A legacy verdict without `candidateSha` carries null, and
// null is never synthesised into a sha.
export interface PhaseMergeFacts {
  inflight: boolean;
  start: boolean;
  last: { status: string; landed: boolean; candidateSha: string | null } | null;
}

// I6 — the NEWEST lane-outcome row for this task id, or null when the ledger has none. `wave` is
// set only when the row was reached through a land wave's branch (phaseOutcomeFor below), and then
// names that branch and the head row the outcome row is keyed by.
export interface PhaseOutcomeFacts {
  disposition: string | null;
  headSha: string | null;
  wave?: { branch: string; head: string };
}

// I6 as an index, built ONCE per view off ledger rows the caller has already sorted newest first.
// Rows without a string taskId belong to no row here and are skipped rather than guessed at — in
// BOTH maps, so a hand-opened lane's outcome can never be borrowed by a queue row via its branch.
export interface PhaseOutcomeIndex {
  byTask: ReadonlyMap<string, PhaseOutcomeFacts>;
  byBranch: ReadonlyMap<string, { head: string; facts: PhaseOutcomeFacts }>;
}

export function phaseOutcomeIndex(sortedRows: readonly Record<string, unknown>[]): PhaseOutcomeIndex {
  const byTask = new Map<string, PhaseOutcomeFacts>();
  const byBranch = new Map<string, { head: string; facts: PhaseOutcomeFacts }>();
  for (const row of sortedRows) {
    const taskId = typeof row.taskId === "string" ? row.taskId : null;
    if (taskId === null) continue;
    const facts: PhaseOutcomeFacts = {
      disposition: typeof row.disposition === "string" ? row.disposition : null,
      headSha: typeof row.headSha === "string" ? row.headSha : null,
    };
    if (!byTask.has(taskId)) byTask.set(taskId, facts);
    if (typeof row.branch === "string" && row.branch !== "" && !byBranch.has(row.branch))
      byBranch.set(row.branch, { head: taskId, facts });
  }
  return { byTask, byBranch };
}

// THE WAVE JOIN. A wave lane lands n rows and writes ONE outcome row, keyed by the head's taskId
// (buildLaneOutcome reads `s.taskId`, which is the head alone) — so every follower read by its own
// id finds nothing and fell to R2 UNKNOWN although it landed exactly like the head. The follower
// still names its branch: landLane stamps `landed (<branch>)` on every row it carries, and dispatch
// stamps `wave lane <branch> (with <head>)`. Both are the server's own sentences, like `waiting:`,
// never producer prose.
//
// The branch alone is not trusted: the outcome row's HEAD must still be a row on the same slot as
// this one (`t.slot`, the N:1 edge landLane marks by). A head that is gone, or sits on another slot,
// leaves the row on its own-id join — and so on R2, which is the honest answer when the edge cannot
// be shown. Only terminal rows take this path; a sent row's outcome (a candidate sha) is untouched.
const WAVE_BRANCH_NOTE = /^(?:landed \((\S+)\)$|wave lane (\S+) \()/;

export function phaseOutcomeFor(
  task: { id: string; status: string; note: string | null; slot: number | null },
  index: PhaseOutcomeIndex,
  slotOfTask: (id: string) => number | null | undefined,
): PhaseOutcomeFacts | null {
  const own = index.byTask.get(task.id) ?? null;
  if (!TERMINAL.includes(task.status) || task.slot === null || task.note === null) return own;
  const m = WAVE_BRANCH_NOTE.exec(task.note);
  const branch = m?.[1] ?? m?.[2];
  const hit = branch ? index.byBranch.get(branch) : undefined;
  if (!branch || !hit) return own;
  if (hit.head === task.id) return hit.facts;
  if (slotOfTask(hit.head) !== task.slot) return own;
  return { ...hit.facts, wave: { branch, head: hit.head } };
}

// I2 + I3 are one field: `lane` is null when no live slot owns the row (the slot triple found
// nothing), and otherwise the exact LaneSignalView the done-looking predicate and the auto-③ tick
// read — built by the server's one laneSignalView, never re-assembled here.
export interface PhaseInput {
  task: PhaseTaskFacts;
  lane: LaneSignalView | null;
  merge: PhaseMergeFacts;
  openAttention: number;
  outcome: PhaseOutcomeFacts | null;
  idleThresholdMs: number;
}

export interface PhaseCandidate {
  sha: string | null;
  basis: "merge-last" | "lane-outcome" | "none";
}

export interface PhaseResult {
  phase: Phase;
  phaseBasis: string[];
  note: string | null;
  candidate: PhaseCandidate;
  // one sentence naming the missing input, non-null EXACTLY when phase === "UNKNOWN". The caller
  // pushes it into the view's existing `unknown[]`; the reducer never formats a view.
  unknown: string | null;
}

// Same shape as lane-signals.ts's LaneRule and for the same reason: the prose a reader is handed
// and the test the projection evaluates are one object, so they cannot drift apart without the
// other changing in the same edit. `detail` exists only where the honest sentence has to name
// WHICH fact was missing.
export interface PhaseRule {
  readonly id: string;
  readonly prose: string;
  readonly phase: Phase;
  readonly holds: (v: PhaseInput) => boolean;
  readonly detail?: (v: PhaseInput) => string;
}

const TERMINAL = ["done", "archived"];
const QUEUE = ["pending", "queued"];
// the non-land verdicts: a settled merge that did NOT advance main. "merged" is excluded because a
// merged+landed row is history the outcome ledger carries, and `landed:false` is tested separately.
const NON_LAND_MERGE = ["blocked", "error", "resolved", "interrupted", "awaiting-author"];

const terminal = (v: PhaseInput): boolean => TERMINAL.includes(v.task.status);
const sentWithLane = (v: PhaseInput): boolean => v.task.status === "sent" && v.lane !== null;
const nonLandVerdict = (v: PhaseInput): boolean => v.merge.last !== null
  && v.merge.last.landed === false && NON_LAND_MERGE.includes(v.merge.last.status);
// every clause is a POSITIVE test over a fact that must be KNOWN — the same direction lane-signals.ts
// argues for at length. An unknown fact must reach R10 and become UNKNOWN, never fall through to
// RUNNING because a negation happened to hold over a null.
const laneFactsKnown = (v: PhaseInput): boolean => v.lane !== null
  && v.lane.alive !== null && v.lane.observed === true && v.lane.git !== null;

const missingLaneFact = (v: PhaseInput): string => {
  const gaps: string[] = [];
  if (v.lane === null || v.lane.alive === null) gaps.push("alive unknown (pane never polled)");
  if (v.lane !== null && v.lane.observed === false) gaps.push("pane never observed (lastOutput 0)");
  if (v.lane === null || v.lane.git === null) gaps.push("git facts unknown");
  return gaps.join("; ");
};

// Evaluated top-down, FIRST MATCH WINS. The order is the contract: R6/R10 sit above R11/R13 so a
// row whose lane facts are missing can never render as RUNNING or READY (falsifier §10.2), and R3
// sits above R4/R5 so an owner question on a queue row is visible before the queue position is.
export const PHASE_RULES: readonly PhaseRule[] = [
  {
    id: "R0", phase: "CONTINUE",
    prose: "advisory kind — no dispatch motor exists for it",
    holds: (v) => v.task.kind !== "auftrag",
    detail: (v) => `kind=${v.task.kind}`,
  },
  {
    id: "R1", phase: "CONTINUE",
    prose: "terminal status with a landed outcome row",
    holds: (v) => terminal(v) && v.outcome?.disposition === "landed",
    detail: (v) => v.outcome?.wave
      ? `joined via wave branch ${v.outcome.wave.branch}, outcome row of head ${v.outcome.wave.head}` : "",
  },
  {
    id: "R2", phase: "UNKNOWN",
    prose: "terminal status without a landed outcome row",
    holds: (v) => terminal(v) && v.outcome?.disposition !== "landed",
    detail: (v) => v.outcome === null
      ? "terminal task has no lane-outcome row — how it ended is not reconstructible"
      : `terminal task's newest outcome disposition is ${v.outcome.disposition ?? "absent"}, not landed`,
  },
  {
    id: "R3", phase: "OWNER_GATE",
    prose: "queue row with an open attention request",
    holds: (v) => QUEUE.includes(v.task.status) && v.openAttention > 0,
    detail: (v) => `${v.openAttention} open attention rows`,
  },
  {
    id: "R4", phase: "READY",
    prose: "pending — awaiting a release door",
    holds: (v) => v.task.status === "pending",
  },
  {
    id: "R5", phase: "READY",
    prose: "queued — awaiting the dispatch tick",
    holds: (v) => v.task.status === "queued",
  },
  {
    id: "R6", phase: "UNKNOWN",
    prose: "sent row owns no live lane — boot recovery or detach pending",
    holds: (v) => v.task.status === "sent" && v.lane === null,
  },
  {
    id: "R7", phase: "INTEGRATING",
    prose: "a merge job holds this lane",
    holds: (v) => sentWithLane(v) && (v.merge.inflight || v.merge.start),
    detail: (v) => v.merge.inflight ? "merge job in flight" : "merge pre-flight reservation held",
  },
  {
    id: "R8", phase: "OWNER_GATE",
    prose: "merge-last non-land verdict with an open attention request",
    holds: (v) => sentWithLane(v) && nonLandVerdict(v) && v.openAttention > 0,
    detail: (v) => `merge ${v.merge.last?.status}, landed=false, ${v.openAttention} open attention rows`,
  },
  {
    id: "R9", phase: "REVIEWABLE",
    prose: "merge-last non-land verdict",
    holds: (v) => sentWithLane(v) && nonLandVerdict(v),
    detail: (v) => `merge ${v.merge.last?.status}, landed=false`,
  },
  {
    id: "R10", phase: "UNKNOWN",
    prose: "lane facts incomplete — the predicate cannot be evaluated",
    holds: (v) => sentWithLane(v) && !laneFactsKnown(v),
    detail: missingLaneFact,
  },
  {
    id: "R11", phase: "REVIEWABLE",
    prose: "the server's lane predicate holds",
    holds: (v) => sentWithLane(v)
      && laneWatchSignal(v.lane as LaneSignalView, v.idleThresholdMs) !== null,
    detail: (v) => `${laneWatchSignal(v.lane as LaneSignalView, v.idleThresholdMs)} — `
      + "a predicate over facts, NOT a report from that lane",
  },
  {
    id: "R12", phase: "OWNER_GATE",
    prose: "running lane with an open attention request",
    holds: (v) => sentWithLane(v) && v.openAttention > 0,
    detail: (v) => `${v.openAttention} open attention rows`,
  },
  {
    id: "R13", phase: "RUNNING",
    prose: "a live lane, no terminal merge verdict, no predicate, no open question",
    holds: (v) => sentWithLane(v),
  },
];

// The rule line a reader (or a prompt) is handed, composed from the same list the projection
// iterates — one edit keeps table and prose in step.
export const PHASE_RULES_PROSE =
  PHASE_RULES.map((r) => `${r.id} ${r.prose} → ${r.phase}`).join(" · ");

// THE NAMED BLIND SPOT (brief §4, review §Attack 4). A lane that stops dirty with an untracked
// file and ahead===0 cannot make done-looking true and — on a self-committing harness — cannot make
// host-commit-looking true either, so it sits at R13 RUNNING for as long as it exists. That is a
// real gap in the PRODUCING side, and the projection's honest move is to SAY SO in the basis, not
// to invent a `STALLED` phase: "this lane looks stuck" is a quality inference, and inventing a
// phase for it would smuggle one into a mechanism that must not grade.
const IDLE_DIRTY_BASIS = "idle ≥ threshold, dirty>0, ahead=0 — not reviewable by predicate";
const idleDirtyStuck = (v: PhaseInput): boolean => v.lane !== null && v.lane.git !== null
  && v.lane.idleMs !== null && v.lane.idleMs >= v.idleThresholdMs
  && v.lane.git.dirty > 0 && v.lane.git.ahead === 0;

// Which clauses of the lane predicates are NOT met, in their own prose. This is what makes a
// RUNNING answer auditable without opening the pane: the reader sees "clean tree, git.ahead>0"
// rather than having to re-derive why the lane is not reviewable.
const unmetLaneClauses = (v: PhaseInput): string => {
  const lane = v.lane;
  if (lane === null) return "";
  const unmet = (lane.hostCommits ? HOST_COMMIT_LOOKING_RULES : DONE_LOOKING_RULES)
    .filter((r) => !r.holds(lane, v.idleThresholdMs)).map((r) => r.prose);
  return unmet.join(", ");
};

// `note` surfaces what the dispatch tick ALREADY wrote on the row (`waiting: …`, written on change
// only). It is not a new text and not a second place to say something: any other note text is the
// owner's or a producer's prose and stays out of a mechanical projection.
const waitingNote = (v: PhaseInput): string | null =>
  v.task.note !== null && v.task.note.startsWith("waiting:") ? v.task.note : null;

// There is no per-slot HEAD-sha cache in this tree (GitInfo is {branch,dirty,ahead,behind}), and
// spawning `git rev-parse` inside a view is forbidden — the sessions poll must never block on a git
// spawn. So a REVIEWABLE row honestly reports sha:null with basis "none" and the MAIN reads the
// branch; a sha is reported only where one is already persisted.
const candidateOf = (v: PhaseInput, phase: Phase): PhaseCandidate => {
  const sha = v.merge.last?.candidateSha ?? null;
  if ((phase === "INTEGRATING" || phase === "CONTINUE") && sha !== null)
    return { sha, basis: "merge-last" };
  if (v.outcome?.headSha) return { sha: v.outcome.headSha, basis: "lane-outcome" };
  return { sha: null, basis: "none" };
};

export function phaseOf(v: PhaseInput): PhaseResult {
  const rule = PHASE_RULES.find((r) => r.holds(v));
  // Not reachable through the table above (R0…R13 partition every status), and deliberately not
  // written as a `?? "RUNNING"` default: a status this build has never heard of is an unknown
  // input, and unknown inputs have exactly one honest output.
  if (!rule) {
    return {
      phase: "UNKNOWN", phaseBasis: [`no rule matched status ${v.task.status}`],
      note: waitingNote(v), candidate: candidateOf(v, "UNKNOWN"),
      unknown: `1 task (${v.task.id}) projects as phase UNKNOWN: status ${v.task.status} matches no phase rule.`,
    };
  }
  const detail = rule.detail ? rule.detail(v) : "";
  const phaseBasis = [`${rule.id}: ${rule.prose}${detail ? ` (${detail})` : ""}`];
  if (rule.phase === "RUNNING") {
    const unmet = unmetLaneClauses(v);
    if (unmet) phaseBasis.push(`lane predicate unmet: ${unmet}`);
    if (idleDirtyStuck(v)) phaseBasis.push(IDLE_DIRTY_BASIS);
  }
  return {
    phase: rule.phase,
    phaseBasis,
    note: waitingNote(v),
    candidate: candidateOf(v, rule.phase),
    // the view's own contract: every unknown sentence carries a number (it is a COUNT line beside
    // the view's other unknowns), and it names the missing input rather than the row alone.
    unknown: rule.phase === "UNKNOWN"
      ? `1 task (${v.task.id}) projects as phase UNKNOWN: ${detail || rule.prose}.` : null,
  };
}

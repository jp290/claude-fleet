// --- `done-looking` as a DETERMINISTIC predicate (docs/perception-layer.md §3).
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
  merge: { status: string } | null;
  // has this pane's output ever been observed? `idleMs` is derived from Slot.lastOutput, which is 0
  // until the poll sees a first byte — and 0 yields a NUMBER (~1.79e12 ms), not a null. done-looking
  // survives that by other means; `stalled` cannot (see STALLED_RULES).
  observed: boolean;
  // the owner's parking brake (Slot.awaiting) — a clarify lane told to report and wait
  awaiting: "owner" | null;
  // adapter-declared ownership of the repository write: true means the lane produces files while
  // Fleet's HOST records them (POST /api/slots/:id/commit). This is a fact supplied by server.ts,
  // not something this pure predicate guesses from a harness id.
  hostCommits: boolean;
}

// a merge the owner has to look at is not a lane that finished its work
const MERGE_BLOCKING = ["blocked", "error"];

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
  { prose: "no blocked/errored merge", holds: (v) => !MERGE_BLOCKING.includes(v.merge?.status ?? "") },
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
  { prose: "no blocked/errored merge", holds: (v) => !MERGE_BLOCKING.includes(v.merge?.status ?? "") },
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

export function laneWatchMessage(slot: number, branch: string, v: LaneSignalView,
  signal: LaneWatchSignal): string {
  const g = v.git;
  if (signal === "host-commit-looking") {
    return `[fleet] slot ${slot} (${branch}) now LOOKS ready for a host commit — pane idle, `
      + `${g?.ahead ?? "?"} ahead / ${g?.dirty ?? "?"} dirty. The work is UNCOMMITTED, 0 ahead is expected `
      + `for this harness, and the next step is a host commit via POST /api/slots/${slot}/commit. This is the `
      + `server's weaker predicate over facts (host commits + idle + dirty>0 + ahead===0 + awaiting:null), `
      + `NOT a report from that lane. Read the pane before you commit, review, or land.`;
  }
  return `[fleet] slot ${slot} (${branch}) now LOOKS done — pane idle, tree clean, `
    + `${g?.ahead ?? "?"} ahead / ${g?.dirty ?? "?"} dirty. That is the server's predicate over facts `
    + `(idle + clean + ahead>0), NOT a report from that lane: it reads identically for a lane running a `
    + `suite, a lane parked waiting on the owner, and a lane that compiled a brief instead of building. `
    + `Read the pane before you act, and never land on this message alone.`;
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
  { prose: "no blocked/errored merge", holds: (v) => !MERGE_BLOCKING.includes(v.merge?.status ?? "") },
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

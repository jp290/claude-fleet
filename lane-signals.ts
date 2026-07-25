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
}

// a merge the owner has to look at is not a lane that finished its work
const MERGE_BLOCKING = ["blocked", "error"];

export interface DoneLookingRule {
  readonly prose: string;
  readonly holds: (v: LaneSignalView, idleThresholdMs: number) => boolean;
}

// Every clause is required (an AND), and every one of them is a NEGATION test the ③ trigger must
// survive: an unknown fact (null alive, null git, un-ticked idleMs) reads as NOT done-looking —
// never as permission to spawn.
export const DONE_LOOKING_RULES: readonly DoneLookingRule[] = [
  { prose: "alive", holds: (v) => v.alive === true },
  { prose: "idle", holds: (v, t) => v.idleMs !== null && v.idleMs >= t },
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

# Automation frontiers — new levers, ranked, and a discipline check

*2026-07-21. Genuinely new ideas only — nothing already in steward-autonomy /
queue-automation / automation-synergies / steward-intelligence. Each is a
hypothesis to validate against the journal, not settled design. Read the
discipline check (bottom) first: the theory is now well ahead of the build, and
that changes what "spare no effort" should mean.*

---

## 1. Review corrections → the owner-model (highest value)

The mined data's dominant move is the praise-gate delta: "sehr schön, aber X"
(~35%). Today that correction goes into the lane session and **dies with it** —
the single richest signal about JP's taste is thrown away. This is the loop that
makes the steward *truly* intelligent (steward-intelligence.md §3, model of the
owner), and nothing yet captures it.

The lever: **when the owner rejects or corrects a lane, the reason is training
data for the owner-model.** A review that ends "aber das Beispiel ist zu flach"
teaches "JP rejects shallow examples." Capture the correction (structured: what
was proposed, what was wrong, the owner's phrasing), and the distillation loop
proposes owner-model updates from it. Taste — the hardest thing to automate — is
learnable *only* from these corrections. Everything else (git state, idle) is
mechanical; this is the human signal.

Why it's hard/careful: corrections are sparse and high-variance (one grumpy day
≠ a preference). Needs the journal's outcome record + N-instance confirmation
before a correction becomes a model rule — same graduation discipline as
autonomy expansion.

## 2. Review-backpressure on dispatch (new control principle)

The dispatcher's budget is a fixed `DISPATCH_MAX_LANES`. But the real constraint
is not a lane count — it is **how many lanes await the owner's review**. Five
un-reviewed green lanes is worse than three, regardless of machine capacity
(operating-model.md Invariant 5: review is the bottleneck). Yet dispatch is blind
to review debt.

The lever: **the number of lanes awaiting review is backpressure on the
dispatcher.** When review debt is high, dispatch throttles or stops — the queue
senses the bottleneck and stops feeding it. This is the control-theory-correct
move: the throttle lives at the actual constraint, not at an arbitrary lane cap.
Concretely, a lane counts as "awaiting review" when it is done-looking / verified
but not yet landed or killed; past a threshold, `tickDispatch` holds. Turns the
whole pipeline into a demand-paced system instead of a supply-paced one.

## 3. Verify-before-surface (reframes the review queue)

automation-synergies.md Finding 1 gives us the server-run verify gate. The new
reframe: **a lane does not enter the owner's review queue until it passes its own
stated verification.** "Review only reviewable things." The owner's attention
never lands on a lane that fails its own `verifyCmd` — that lane is either
self-repaired (#4) or surfaced as *broken*, explicitly, not as *ready*. Today the
green/idle badge is an idle heuristic (interaction-modes.md warns of exactly
this); verify-before-surface makes "ready for review" a machine fact. The review
queue becomes a queue of *candidates that already passed their own bar*.

## 4. Bounded self-repair on verify-fail (keep the owner out of mechanical loops)

When a lane fails its verification, today: nothing. The owner eventually finds a
broken lane. Both Hermes and OpenClaw bound retries; apply it here: **a lane that
fails its own verify gets exactly one steward re-brief pass** (the failure output
appended as context), then either passes or **escalates to the owner as
"failed twice, needs you."** Fully reversible (it's a worktree), bounded (one
pass — the CLAUDE.md ~5×-is-structural rule, tightened to 1 for autonomy), gated
(a steward action on the ladder). This keeps the owner out of the loop for
mechanical failures (a flaky import, a missed call site) while never hiding a
genuinely stuck lane. Cap is mandatory: two failures = human, always.

## 5. Autonomy can decay, not only grow (safety-critical, unstated)

steward-intelligence.md §4 ratchets autonomy *up* as track record proves out. But
the world changes — JP's preferences shift, the codebase moves — and a class that
earned `act-silently` can start being wrong. The learning loop only *adds*;
nothing removes. The missing half: **when a previously-trusted class starts
drawing corrections, auto-demote it down the ladder** (act-silently → propose)
and flag the demotion for the owner. Trust is not monotonic. This is the safety
complement to graduation — without it, a stale rule keeps firing silently long
after it stopped being right. A class's autonomy level is a function of its
*recent* record, not its lifetime record.

## 6. Adaptive Rundgang cadence (event + heartbeat, not fixed cron)

OpenClaw's heartbeat is fixed-interval. Smarter: **event-triggered with a
heartbeat floor.** A lane going idle, a merge landing, a verify completing — these
are events worth a look *now*; a quiet machine needs only the slow heartbeat.
Polling every N minutes either wastes runs on a quiet fleet or reacts late on a
busy one. Cheap to build on the existing `lastOutput`/git-state signals; makes the
steward attentive when it matters and silent when it doesn't — which is also how
it earns the owner's tolerance for running continuously.

## Discipline check — the theory is ahead of the build

Six design docs this session; two things shipped (audit log, token lane). **Every
frontier above depends on the journal existing** — #1 needs correction records,
#2 needs review-state, #4/#5 need outcome history. The journal is one
`appendEvent` consumer, nearly free now.

So the correct reading of "spare no effort" is **not** a seventh theory doc. It is:
ship the **Rundgang + journal** (the smallest thing that produces real data),
then let *reality* refine this list — demote the frontiers that don't survive
contact, promote the ones the data demands. The verification hierarchy
(CLAUDE.md) applies to our own design work: deterministic evidence (the journal)
outranks more statistical reasoning (me theorizing). Past this point, more
un-validated theory has negative value — it's confident-looking design debt.

Recommended next action, unchanged and now underlined: **land the token lane →
build the Rundgang on `summaryViaSession`, writing the journal via `appendEvent`
from its first run.** Then this doc becomes a backlog we prune with evidence,
not a plan we extend by argument.

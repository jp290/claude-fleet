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

---

## Check verdicts (pressure-tested 2026-07-21) — the six are not independent

Adversarial re-examination of the six above. It *reduced* the set, not extended
it:

- **#3 verify-before-surface is the keystone** — #2 and #4 both hang off it. Two
  unstated constraints: it covers only tasks with a deterministic `verifyCmd`
  (fuzzy tasks stay heuristic — a two-class system, state it), and running a
  `verifyCmd` server-side is code execution, so it **must be owner-approved at
  promotion, never taken raw from untrusted intake** (else RCE via external input).
- **#4 self-repair collapses into a playbook rule**, not a new mechanism: a
  re-brief is just a typed nudge carrying the failure output, already in the
  delivery path. Refine: re-run the verify first (catches flakes cheaply), then
  one re-brief, then escalate; cap total attempts server-side, episode-scoped.
- **#5 decay is the strongest on pure logic** and needs the **promote-slow /
  demote-fast asymmetry** (N clean instances to climb; one or two corrections to
  fall — the cost of a wrongly-trusted silent class is high, re-demotion is one
  click) plus hysteresis against oscillation. Needs a *recency-windowed* journal,
  not lifetime.
- **#2 backpressure** is control-theoretically correct but depends on #3 for a
  real "awaiting review" signal, and is low near-term priority (dispatch is off by
  default). It makes explicit that autonomous throughput cannot outrun owner
  presence — a feature, not a bug.
- **#1 corrections→owner-model** is highest value, least buildable: correction
  *capture* (classifying an owner turn as a correction vs. a new instruction, from
  untrusted transcript) and *attribution* (one correction ≠ a general rule) are
  unsolved; it also depends on the brief compiler consuming the model. Demote to
  last — a research direction, not a near-term frontier.
- **#6 adaptive cadence is a v2, and was mis-costed**: "event-triggered" needs an
  event bus Fleet doesn't have (idle is detected by polling today). v1 Rundgang =
  a fixed heartbeat (a plain auto); adaptive comes only after the fixed one proves
  the signals.

**Dependency spine (the real build order, not the value ranking):**
`journal → #3 → (#5, #4) → #2 → #1`, with **#6 as a v2**. The keystone is #3; the
safety complement is #5; #4 is a rule that falls out for free; #1 is the hard
research problem; #6 waits for an event mechanism. Everything still gates on the
journal existing — which remains the one thing to ship next.

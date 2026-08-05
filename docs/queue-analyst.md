# The queue analyst  (operative — the contract the dispatcher runs under)

*Replaces the eval gate, 2026-08-05. Code: `analysis-prompt.ts`, `server.ts`
(`tickAnalysisSweep`, `tickDispatch`), `src/client.ts` (`qGroupOf`). Verified by
`e2e/tasks.ts` section (h) and `e2e/steward-outcomes.ts`.*

## 1. The split

Two questions had been fused into one worker:

- **What IS this task?** Attributable? In reach? Does it carry a done-criterion? Does it
  collide with work already running? — useful for **every** task, at every status, and
  useful **to the owner first**.
- **May the machine start it without me?** — a policy decision *on top of* that reading.

Because they were the same code, the reader could only ever look at the rows the second
question applied to: `pending` lane tasks. The analyst answers the first question and
answers it everywhere. The second question now has a one-word answer: **no.** The
dispatcher runs `queued` and nothing else, and only the owner puts a row there.

## 2. Why — the measurement that ended the gate

Taken off the live deployment before the rewrite:

| | |
|---|---|
| verdicts the eval gate had ever produced | **1** |
| positive verdicts (`auto`) | **0** |
| `evalAuto` day counter | `{"day":"","count":0}` — never incremented |
| `FLEET_INTAKE_SECRET` in the running srv's env | **absent** → `/intake` answers 404 |

The population was empty by construction. Lane tasks have two producers, the owner and
`/intake`; intake was off, the steward files `note`, and a task the owner *wanted* run got
promoted — which bypassed the gate. So its only real subject was the owner's own
un-promoted drafts, and its only power was starting them behind his back. That is the one
thing it should never have done.

Four further findings from the same audit, and where each one went:

| finding | resolution |
|---|---|
| the gate judged the raw draft; the lane ran a sonnet-tier rewrite of it | the brief is compiled **in the sweep**, stored, judged, and sent verbatim (`Task.brief`) |
| a verdict never expired, though criterion 1 is time-dependent | the verdict records the integration tip and the brief revision it judged (`analysisStale`) |
| a worker timeout became a permanent verdict for its whole batch | a failure is `verdict: "unknown"` with `attempts` and exponential backoff — an absence, never a finding |
| an override was indistinguishable from an ordinary promote | releasing a flagged row writes a note and a `task_override` audit event |
| priority inversion: an old pending row pre-empted a fresh promote | gone by construction — `pending` and `queued` no longer compete for a tick |
| the reader could not see the running fleet | open lanes ride in the prompt; `collides` names branches, not just batch siblings |

## 3. The reading

Three criteria, each with a blocker tag the UI shows as a row label:

| criterion | blocker | means |
|---|---|---|
| attributable | `attribution` | it maps to real files/symbols, and its claims about the tree hold |
| in reach | `reach` | nothing leaves the worktree — no publishing, credentials, shared machine state |
| has a done-criterion | `criterion` | bounded, and the repo's own verification can judge it finished |
| the brief is the draft, thickened | `brief-drift` | the enhancer added a claim or dropped one |

`brief-drift` has no predecessor. It exists because the enhancer's additive-only contract
was, until now, a promise in the enhancer's own prompt with nothing checking it.

Verdicts: `ready` · `needs-you` · `unknown`. Three-valued on purpose — `unknown` is the
analyst failing to *answer*, and that must never be able to read as either judgement.

## 4. Invariants

1. **Nothing starts unattended that the owner did not release.** `tickDispatch` selects
   `status === "queued"` only.
2. **What was judged is what runs.** `briefAndSend` contains no model call; it sends
   `t.brief.text ?? t.text`. An e2e check asserts byte-equality with the prompt that
   reached the pane.
3. **Nothing starts unattended against a tree it was not read on.** A released row waits,
   with the reason on its own row, while its analysis is missing, `unknown`, or stale —
   *unless no analyst is configured at all* (`FLEET_ANALYSIS_MS=0`), because a guard
   nobody can clear is a deadlock wearing a safety property's clothes.
4. **The verdict never disables an action.** It groups, labels and warns. Every button the
   owner had, he still has.
5. **An observation is not work.** A `note` cannot be released (409). `adopt` converts it
   into a `pending` brief — a conversion the *owner* performs, which is what keeps the
   steward from ever authoring runnable work.

## 5. Knobs

| env | default | |
|---|---|---|
| `FLEET_ANALYSIS_MS` | 60000 | sweep tick; **0 = analyst off**, and then invariant 3 lifts |
| `FLEET_ANALYSIS_MODEL` | `claude-opus-5` | the interactive tier — the owner's critical look is what is delegated here |
| `FLEET_ANALYSIS_TIMEOUT_MS` | 420000 | its own, not the summarizer's 180 s: this worker reads files for a whole batch |
| `FLEET_ANALYSIS_CMD` | — | subprocess stand-in for harnesses |

Batch cap 6, max 3 attempts, backoff `60s × 2^attempts`, brief compiles 3 at a time. A
harness without a stand-in **must** set `FLEET_ANALYSIS_MS=0` or the suite spawns a real
agent — the same rule `FLEET_AUTO_REVIEW_MS` already carries.

## 6. What it deliberately is not

It is **not a safety gate**. It is a reading, and a spend gate on nothing at all. The
safety boundary is still where it was: no tick calls `mergeJob`, so an unattended lane
produces a branch that waits for a human. Do not let the presence of a critical-looking
worker be mistaken for that boundary moving.

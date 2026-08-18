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
| the gate judged the raw draft; the lane ran a sonnet-tier rewrite of it | the brief is compiled **in a sweep** (§5a — the analyst's, or the compiler's own), stored, judged, and sent verbatim (`Task.brief`) |
| a verdict never expired, though criterion 1 is time-dependent | the verdict records the integration tip and the brief revision it judged (`analysisStale`) |
| a worker timeout became a permanent verdict for its whole batch | a failure is an absence with `attempts` and exponential backoff, never a finding — and since 2026-08-07 never a deletion either (§3a) |
| an override was indistinguishable from an ordinary promote | releasing a flagged row writes a note and a `task_override` audit event |
| priority inversion: an old pending row pre-empted a fresh promote | gone by construction — `pending` and `queued` no longer compete for a tick |
| the reader could not see the running fleet | open lanes ride in the prompt; `collides` names branches, not just batch siblings |
| `collides` was computed every sweep and read by nobody | `tickDispatch` holds a colliding row back (invariant 6) — before that, only the lane cap kept two colliding lanes apart |

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

## 3a. A failure is an absence — and an absence must not delete a reading

`unknown` was built so a broken worker could not produce a finding. It could still produce
a *deletion*, and for three months it did: a failure rewrote `t.analysis` wholesale for
every row of the batch, keeping only `attempts`. Verdict, reason, blockers and collides
were gone, and the row became indistinguishable from one nobody had ever read.

Measured on the live queue, 2026-08-07: at 09:41 one batch of six lost **four `needs-you`
and two `ready`** to `analyst returned no JSON`. A backoff retry healed the register ~80
minutes later; at `ANALYSIS_MAX_ATTEMPTS` it would not have healed at all. The sweep sorts
**released rows first**, so the rows nearest to running went into that window first.

Since then (`analysisFailed`) a failure is filed **beside** the verdict:

| field | after a failed re-reading |
|---|---|
| `verdict` `reason` `blockers` `collides` | the last reading that arrived — unchanged |
| `at` `head` `briefAt` | that reading's own, so `analysisStale` keeps telling the truth |
| `attempts` | +1 |
| `retry` | `{at, reason}` — when the re-reading failed and why |

Two consequences worth stating, because both are load-bearing:

- **Nothing gains trust.** The preserved verdict keeps its old `head`/`briefAt`, so it is
  still stale — and a row only ever reaches this code path *because* it went stale. The
  dispatcher's invariant 3 holds it back exactly as before; what changed is that the owner
  can now read what the last reading said while it waits.
- **The failure owns the schedule.** `analysisDue` keys the backoff on `retry.at`, not on
  `at`. Keyed on `at` — which now belongs to the older, successful reading — a preserved
  verdict would hammer every tick or freeze, decided by nothing but how old it happened to
  be. Proven in `e2e/tasks.ts` (h5b), which also counter-probes the hammering case.

A row in this state reads `⚠ … · re-analysis failing (N×)` in the queue and
`verdict(age)!stale?xN` in `register.sh`, with the failure's own words in the detail pane.

## 4. Invariants

1. **Nothing starts unattended that the owner did not release.** `tickDispatch` selects
   `status === "queued"` only.
2. **What was judged is what runs.** `briefAndSend` contains no model call; it sends
   `t.brief.text ?? t.text`. An e2e check asserts byte-equality with the prompt that
   reached the pane.
3. **Nothing starts unattended against a tree it was not read on.** A released row waits,
   with the reason on its own row, while its analysis is missing, `unknown`, or stale —
   *unless no analyst is configured at all* (`FLEET_ANALYSIS_MS=0`), because a guard
   nobody can clear is a deadlock wearing a safety property's clothes. A running **brief
   compiler** neither clears nor lifts this: it is not a reader (§5a).
4. **The verdict never disables an action.** It groups, labels and warns. Every button the
   owner had, he still has.
5. **An observation is not work.** A `note` cannot be released (409). `adopt` converts it
   into a `pending` brief — a conversion the *owner* performs, which is what keeps the
   steward from ever authoring runnable work.
6. **Nothing starts unattended on top of work it was told it collides with.** A released
   row whose `collides` names something *actually running* is held, with the match on its
   own row, and starts by itself once that work is gone. Three boundaries make this a wait
   rather than a new gate: it is held only against **running** work (never another queued
   row — two rows naming each other would deadlock, invisibly, both displaying "waiting");
   only on a **fresh** analysis (it sits below the staleness check and inside invariant 3's
   "is there an analyst at all", because a collision list nobody refreshes would pin a row
   on an expired fact); and it **skips to the next row** rather than stopping the tick,
   since a collision clears on lane-land timescales and every other wait clears in seconds.
   The field is mixed — task ids *and* branch names — so both are matched: ids against
   `sent` rows, branches against open lanes. Reading only ids would look like it worked.
   The attended button (`POST /api/tasks/:id/dispatch`) is untouched, like every other
   automation bound. Proven end-to-end in `e2e/tasks.ts` (h10), counter-probe included.

## 5. Knobs

| env | default | |
|---|---|---|
| `FLEET_ANALYSIS_MS` | 60000 | analyst sweep tick; **0 = analyst off**, and then invariant 3 lifts |
| `FLEET_BRIEF_MS` | 0 | the BRIEF COMPILER's own tick, §5a; **0 = compiler off**, the default |
| `FLEET_ANALYSIS_MODEL` | `claude-opus-5` | the interactive tier — the owner's critical look is what is delegated here |
| `FLEET_ANALYSIS_TIMEOUT_MS` | 420000 | its own, not the summarizer's 180 s: this worker reads files for a whole batch |
| `FLEET_ANALYSIS_CMD` | — | subprocess stand-in for harnesses |

Batch cap 6, max 3 attempts, backoff `60s × 2^attempts` **from the last failure** (§3a),
brief compiles 3 at a time. A
harness without a stand-in **must** set `FLEET_ANALYSIS_MS=0` or the suite spawns a real
agent — the same rule `FLEET_AUTO_REVIEW_MS` already carries, and since §5a the same rule
applies to `FLEET_BRIEF_MS`, whose tick exists *only* to run the enhancer.

## 5a. Two tools, two switches

`FLEET_ANALYSIS_MS` used to run two things: the **analyst** (advisory — it reads a row and
files a verdict) and the **brief compiler** (production — what it writes is the prompt a
lane is founded on). The compile step sat inside the analyst's sweep, so switching the
analyst off on 2026-08-08 took the compiler with it: not refuted, just dark, and every lane
started afterwards began from the raw request.

`FLEET_BRIEF_MS` is the compiler's own cadence (`tickBriefSweep`), so four states exist:

| analyst | compiler | |
|---|---|---|
| off | off | the default, and the live deployment — unchanged in every byte |
| off | on | drafts get a compiled brief; **no verdict is written, and the verdict ledger gets no line** |
| on | off | unchanged: the analyst compiles its own batch's briefs, exactly where it always did |
| on | on | both, and one shared busy flag keeps two enhancers off the same row |

The live deployment is the first row, and that is machine-checked rather than re-read:

<!-- pin:watchdog-spawn FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=unset -->

Turning the compiler on is an owner act on `watchdog.sh` plus `launchctl kickstart`; this
land ships the capability at its default of off and moves nothing that is running.

Three boundaries, each one a thing the split deliberately does **not** do:

- **The dispatcher gate (invariant 3) still reads `ANALYSIS_ON` alone.** A compiler is not
  a reader: it writes bytes, it never judges a row against the tree it will run on.
- **The compiler writes no reading.** No `t.analysis`, no line on `analysis-verdicts.jsonl`
  — a row it touched is still an unread row, and the queue says so.
- **`reanalyse` still refuses with 409 when the analyst is off.** Its reason names the
  running compiler instead of implying deletion is all that would follow. `↻ refine` remains
  the attended way to a different brief.

Selection is the compiler's own (`briefDue`: a dispatchable `auftrag` with no brief yet),
never `analysisDue` — the compiler's schedule is a property of the *draft* (compiled once,
never again), the analyst's of the *tree*. A failed compile backs off in memory only
(`60s × 2^attempts`, max 3): pacing a worker is not a finding about the work.

## 6. What it deliberately is not

It is **not a safety gate**. It is a reading, and a spend gate on nothing at all. The
safety boundary is still where it was: no tick calls `mergeJob`, so an unattended lane
produces a branch that waits for a human. Do not let the presence of a critical-looking
worker be mistaken for that boundary moving.

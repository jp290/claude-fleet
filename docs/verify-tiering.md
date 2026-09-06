# What a green gate guarantees — measured, and what the next tier costs

2026-07-25, investigation lane. The question: **a lane lands unattended when the rebase is clean and
`verify.ok === true` — what does that green actually attest, and what would it cost to make it
attest more?** Everything below was read or executed first-hand; each claim is marked VERIFIED
(read/ran it, evidence given) or INFERRED (derived from something verified, not itself executed).
§9 lists what I did not check.

Written alongside the sibling lane `post-land-audit`, which builds verification tier 2. §7 is
explicitly relative to it. This doc deliberately does not touch `gate-coverage.md` or
`autonomy-plan.md` — that lane owns both.

## 0. Findings, ranked by what they cost

1. **The full suite is not deterministic under the load a gate runs under — observed, not argued
   (§5b).** Identical tree (HEAD `44eec8c`, zero code changes in this worktree), round 1 green in
   5 min 37 s, round 2 **red** in 7 min 36 s with 3 of 759 checks failing, round 3 in the table.
   *Cost:* `./e2e-isolated.sh` cannot be a hard pre-land gate at **any** timeout — a gate on a
   suite that flips under contention converts machine load into stopped lands and into
   `verified:false` rows about work that was fine. It also makes `CLAUDE.md`'s "**no known
   flakes**" false as written, which matters because that sentence is the licence lanes use to
   treat a red suite as their own defect.
2. ~~**A verify timeout is recorded as a failure, not as a non-measurement (§5).** `runVerify`
   returns `ok: !timedOut && code === 0` (`server.ts#runVerify`), so a timeout is `ok:false` — it stops
   the land *and* writes `verified:false` to the outcome ledger, although the project has an
   `ok:null` "nothing was measured" state one line away. *Cost:* the same number-poisoning
   `gate-coverage.md` §4 documents for `verified:true`, in the opposite direction, and it gets
   worse with every second added to the gate.~~ **FIXED 2026-08-06** — and it had fired by then:
   a real land was stopped with `ok:false` over an output holding zero FAIL lines, ~255 s of whose
   300 s budget was spent queueing behind another suite (`suite-contention.md` §8). `runVerify` now
   records `ok:null` + `timedOut`, so `verified:null` reaches the ledger, and the record carries
   `ms`/`waitMs` so the queueing is separable from the work. **Extended 2026-08-07:** that fix made
   the wait legible but still charged it to the gate's budget. The budget is now two —
   `FLEET_VERIFY_TIMEOUT_MS` for work, `FLEET_VERIFY_WAIT_MS` for queueing — and a run killed while
   it was still queued records `ok:null` + `waitedOut`, a *third* non-measurement that says nothing
   about the tree at all, not even "slow". `suite-contention.md` §8 has the table.
> **Items 3 and 5 below are FIXED as of the 2026-07-28 gate** (§7/§8 carry the detail; this
> ranking predates them): the gate now runs `e2e-clean-review` + `e2e-security` +
> `e2e-claude-gate` — live land-path coverage — and its `tsc` list typechecks every standalone
> harness (`watchdog.sh`, grep `FLEET_VERIFY_CMD`). The live timeout is 300 000 ms set in
> `watchdog.sh`, not an unchosen 120 s default. Read §0 as the 2026-07-26 snapshot it is.

3. **The gate has zero coverage of the land path — and tier 2's trigger lives there (§3, §6d).**
   `grep` for `landLane|advanceIntegration|recordLand|emitLaneOutcome|runCleanReview|undoStack` in
   the gate harness = 0. `schedulePostLandAudit` is called from `recordLand`. *Cost:* one
   regression can take out the undo record and the auditor together, and its symptom is an empty
   trail — indistinguishable from "nothing landed". The auditor cannot audit its own trigger.
4. ~~**`undo-land`, the rollback tier 2 names, is a one-land, until-the-next-land guarantee (§6c).**
   One record per repo (`server.ts#pushUndo`); the route refuses *and deletes the record* once main
   moved past it. *Cost:* in the exact burst tier 2's coalescing was built for (three lands in
   ~110 s), the earlier lands are already un-undoable when the audit reports on them.~~
   **Widened 2026-08-08**: the record is a CAPPED STACK (`UNDO_STACK_MAX = 3`, `pushUndo` /
   `undoStack` in `server.ts`), so the burst tier 2 coalesces stays reversible up to three lands
   deep, one ↩ per land. Still not version control, and the rest of §6c stands: the fourth land
   back ages out, a hand commit on main truncates the chain at the gap, and a collective red still
   has to be attributed by hand before anything is rewound.
5. **Three tracked `.ts` files are never typechecked — all three are the standalone harnesses
   (§4).** *Cost:* the gate's own harness is the one place type rot is invisible to the gate.
   Measured cost of fixing: 1.5 s → 1.538 s, zero new errors.

Refuted along the way: my brief's premise that the gate's `tsc` list omits `merge-prompt.ts`. It
does not — the file is covered transitively, proven by mutation (§4).

## 1. Method, and what the numbers are worth

Each command was run from this worktree, three rounds, sequentially within a round (never two of
the measured commands at once), wall-clock in ms around the whole process. Script and raw logs are
session scratch, not in the tree.

**The box was not quiet, on purpose and unavoidably.** Two other Fleet lanes were working during
the window; at 23:12 `ps` showed two concurrent `bun fleet-e2e.ts` processes — mine, 3:48 old, and
another lane's, 0:57 old — and `uptime` reported load averages of 2.18–3.63 across the window. So:
**the span is the operational number, not the median.** A land gate has to hold under exactly this
contention, because the contention is other lanes doing the work that produces lands.

n = 3 for the four commands the brief asked for; `./e2e-security.sh` was measured twice and
`./e2e-clean-review.sh` eight times (it is the one this doc proposes to gate on, so it got a
burn-in). The `install` / `tsc` / `claudegate` rows are decompositions: they price the pieces of the
gate separately so its cost can be attributed rather than guessed. 19 suite runs in total.

## 2. Measurements

Wall-clock, sequential (never two measured commands at once), on a contended box. `rc` is each
round's exit code — it is a column because one of them is not 0.

| what | median | min – max | rc per round | raw ms |
|---|---|---|---|---|
| **(a) the live gate**, exactly as `watchdog.sh#VERIFY_CMD` built it on 2026-07-25 | **46.9 s** | 46.8 – 47.1 s | 0, 0, 0 | 47052 / 46911 / 46809 |
| **(b) `./e2e-isolated.sh`** (759 checks) | **5 min 36.6 s** | 5 min 36.5 s – **7 min 36.4 s** | 0, **1**, 0 | 336635 / **456355** / 336505 |
| **(c) `./e2e-clean-review.sh`** (25 checks, 2 server boots) | **23.0 s** | 18.7 – 26.8 s | 0, 0, 0 | 26846 / 23022 / 18671 |
| **(d) `bun run build`** (both client bundles, minified) | **0.09 s** | 0.079 – 0.100 s | 0, 0, 0 | 91 / 100 / 79 |
| **(e) `./e2e-security.sh`** (46 checks) — n = 2, not in the 3-round script | **34.4 s** | 34.2 – 34.5 s | 0, 0 | 34548 / 34213 |
| **(c′) `./e2e-clean-review.sh` burn-in**, n = **8** (the 3 above + 5 more) | **18.7 s** | 17.8 – 26.8 s | 0 ×8 | 26846 / 23022 / 18671 / 21293 / 18799 / 18068 / 18033 / 17828 |

Decomposition of (a), measured separately in the same rounds:

| piece of the gate | median | min – max | raw ms |
|---|---|---|---|
| `bun install --frozen-lockfile` | 0.039 s | 0.038 – 0.040 s | 39 / 40 / 38 |
| `bunx tsc` over the gate's 4 entry points | 1.50 s | 1.47 – 1.55 s | 1496 / 1548 / 1474 |
| the same `tsc` + `merge-prompt.ts` explicitly | 1.38 s | 1.34 – 1.44 s | 1342 / 1381 / 1436 |
| `./e2e-claude-gate.sh` | **45.3 s** | 45.332 – 45.357 s | 45332 / 45332 / 45357 |

**Read the (b) row before anything else.** Its span is not measurement noise: round 2 took 2 min
longer *and exited 1* — the suite failed. Same tree, same commit, three rounds. §5b is that finding.

**Read the (a) decomposition second.** `./e2e-claude-gate.sh` varied by **25 ms across three runs**
under visibly changing load (45.332 s twice, 45.357 s once). That is not a fast suite; it is a
*scheduled* one — and it is exactly the property a gate needs and (b) lacks.

What the decomposition says (VERIFIED):

- **The gate is `e2e-claude-gate.sh` and nothing else.** `bun install --frozen-lockfile` is ~40 ms
  (it reports `Checked 9 installs across 10 packages (no changes) [3.00ms]`), `tsc` is ~1.5 s, and
  the behaviour suite is ~45 s of a ~47 s gate. Every statement about "the gate's cost" is a
  statement about that one script.
- **That script's cost is mostly scheduled waiting, not work.** Unconditional sleeps as of 2026-07-25
  (`fleet-e2e-claude-gate.ts`, grep `Bun.sleep`; the file has grown substantially since — see §11.2f —
  so the specific offsets are not re-derived here) were 1500 + 7000 + 1500 + 7000 ms, plus `sleep 2`
  in `e2e-claude-gate.sh` (grep `sleep 2`) — ≥ 19 s of the ~45 s was the harness waiting for panes to
  settle, before any polling loop. INFERRED consequence: the gate will not get much faster on a
  quieter box and will not inflate much on a loud one, which is what the narrow span shows.
- **`bun run build` is free** (~90 ms; `Bundled 7 modules in 25ms` + `Bundled 4 modules in 13ms`).
  It is not in the gate and does not need to be — client bundles are a deploy step (CLAUDE.md), and
  no verification tier discussed here covers the client at all.

## 3. What `./e2e-claude-gate.sh` actually checks — counted, not quoted

**25 executed checks, not 26, as measured 2026-07-25.** VERIFIED twice that day: `grep -n 'check("'
fleet-e2e-claude-gate.ts` gave 25 call sites, and round 1's run emitted 25 `PASS` lines
(`grep -c "^PASS\|^FAIL"` = 25, 0 FAIL). `gate-coverage.md` said 26 at the time; `grep -c 'check(' `
gave 26 because it also counted the `function check(name: string, …)` definition, then still local
to this file. **Stale as of this pass:** `check()` is no longer defined in
`fleet-e2e-claude-gate.ts` at all — it now lives in `e2e/harness.ts#check`, consistent with
`fleet-e2e.ts`'s "shared plumbing lives in `e2e/harness.ts`" split. The off-by-one mechanism this
paragraph describes no longer applies to this file, and the check count has grown well past 25
since 2026-07-25 (§11.2f alone added several); neither is re-measured here.

The six check families, all six about `claudeAlive()`:

| # | family | checks | what it pins |
|---|---|---|---|
| 1 | dead-claude auto gate (`:44–55`) | 4 | a scheduled prompt is never typed into a bare shell; `lastResult` says "skipped" |
| 2 | alive-claude auto gate (`:62–73`) | 4 | the same path delivers when claude really is up |
| 3 | crash-candidate recording (`:95–113`) | 3 | alive→dead inside the effect window is a candidate, and never auto-sets `harmed` |
| 4 | tier-1 signal surface (`:130–179`) | 5 | cached `alive` on the read routes, and cache-for-reads / **fresh-for-gates** |
| 5 | model quoting (`:189–216`) | 4 | `--model 'x[1m]'` stays shell-quoted — the regression that kills every new pane at spawn |
| 6 | dispatcher post-spawn re-check (`:237–264`) | 5 | externally-sourced task text never reaches a bare-shell lane |

`gate-coverage.md`'s characterisation of the scope is right and I confirm it independently:
`grep -c "landLane\|advanceIntegration\|recordLand\|emitLaneOutcome\|runCleanReview\|undoStack"
fleet-e2e-claude-gate.ts` = **0**. The gate contains no reference to any symbol on the land path.

While correcting counts nobody is standing on: the main suite emitted **759** result lines today
(0 failures), not the 703 the docs carry. I am not editing those docs — three lanes are in flight
and `gate-coverage.md` belongs to one of them. Reported here, and in the lane report, for the owner
to pull through centrally.

## 4. The tsc file list is not the coverage — my brief's premise, refuted

The brief held that the gate's four-file `tsc` list "leaves out `merge-prompt.ts`, the file that
builds every agent prompt". **It does not.** `tsc` follows imports.

- VERIFIED by listing: `tsc --listFiles` over the four entry points resolves **34 tracked repo
  files**, including `merge-prompt.ts`, `lane-signals.ts`, `enhance-prompt.ts`, `src/md.ts` and all
  27 `e2e/*.ts` (now more than 27 — the suite has grown, not re-counted here) — because `server.ts`'s
  own top-of-file imports pull in the first three (grep `^import` at the top of `server.ts`) and
  `fleet-e2e.ts`'s top-of-file imports pull in the suite.
- VERIFIED by mutation, which is the proof that matters: into a scratch copy of `merge-prompt.ts` I
  appended `const __proof: number = "not a number";`, then ran the exact gate `tsc` line. Output:

  ```
  merge-prompt.ts(192,7): error TS2322: Type 'string' is not assignable to type 'number'.
  ```

  The same command over the unmodified copy printed nothing. `merge-prompt.ts` is gated today.

**What is genuinely uncovered is a different set: exactly three tracked `.ts` files**, and they are
the three standalone harnesses — `fleet-e2e-claude-gate.ts`, `fleet-e2e-clean-review.ts`,
`fleet-e2e-security.ts`. Nothing imports them, so nothing typechecks them; `bun` runs them by
stripping types without checking them.

**Cost of that gap:** the gate's own harness is the one file whose type rot is invisible to the
gate. A harness that silently stops asserting what its name says is the failure mode this project
already has a word for (`unfed mechanism`), one level up: the checker unchecked.

**Measured cost of closing it: nothing.** Adding all three to the `tsc` line ran in 1.538 s versus
1.5 s for the four-file list — inside the noise — and produced **no errors**, so they are type-clean
today and adding them cannot turn a sound land red.

## 5. Can the full suite be a synchronous gate if the timeout is raised?

**Mechanically: yes, and it is not even a code change.** `FLEET_VERIFY_TIMEOUT_MS` is read at
`server.ts#VERIFY_TIMEOUT_MS` (`Math.max(5_000, Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 120_000) | 0)`) and
a grep over every `*.sh`, `*.ts` and `*.md` in the repo returns that one line and nothing else —
it is set nowhere, named in no doc. VERIFIED **at the time of writing (2026-07-25)**; superseded by
§8 — `watchdog.sh` now sets `FLEET_VERIFY_TIMEOUT_MS=300000` on the srv-spawn line. The live 120 s
default nobody chose is history, not the current state.

**Practically: no, and the blocker is not the timeout.** Three costs, in ascending order of how
much they hurt:

1. **Per-land latency.** Clean path = gate + suite ≈ 6.4 min median (table §2). The land is
   owner-initiated (`mergeJob` was called from exactly one site at the time of writing, `server.ts#mergeJob`,
   the merge POST — **now two sites since 2026-08-24**, the owner merge route and the Program-MAIN
   release route both call it, grep `` mergeJob( `` in `server.ts`)
   but the POST returns before the job finishes — the route's own comment says a conflictful rebase
   "outlives any request-held connection, never synchronous" (`server.ts#mergeJob`). VERIFIED. So the
   owner is not blocked at the browser; the *lane* is blocked, for six minutes, and `tickAutoReview`
   skips any slot with a merge in flight (`server.ts#tickAutoReview`).
2. **The repair-path multiplier.** `runVerify` runs once (`server.ts#mergeJob`) and again after each of
   `MERGE_REPAIR_ROUNDS = 2` repair rounds (`server.ts#MERGE_REPAIR_ROUNDS`) — up to **three full runs**
   for one conflicted land, ~19 min plus two resolver agent invocations. VERIFIED by reading the
   loop.
3. **Unbounded concurrency, which is the real one.** `mergeInflight` is keyed per slot
   (`server.ts#mergeInflight`, set inside `server.ts#mergeJob`'s call sites) and there is no global merge lock, so *k* lanes landing
   together run *k* full suites at once — each booting its own fleet server and driving its own
   tmux socket, on the same box the live fleet's sessions run on. VERIFIED structurally. Tier 2, by
   contrast, serialises deliberately ("one repo at a time, and one run at a time across ALL repos",
   `drainPostLandAudits` in the sibling lane) — a pre-land gate has no such governor and cannot
   easily get one, because each verify belongs to a different lane's job.

And one finding about the gate **as it stands today**, which raising the content would sharpen:

> **A verify timeout is recorded as a failure, not as a non-measurement.** `runVerify` returns
> `ok: skipped ? null : !timedOut && code === 0` (`server.ts#runVerify`) — so a timeout is `ok:false`,
> which stops the land *and* writes `verified:false` onto the outcome row. The project has a third
> state for "nothing was measured" (`ok:null`, the SKIP contract, `server.ts#VERIFY_SKIP_EXIT`, `server.ts#runVerify`) and a
> timeout does not use it. Today's headroom is 120 s against a measured 45–48 s gate (~2.5×), which
> is fine; at 66–74 s (my proposal, §8) it is 1.6×, and at 384 s it is negative. INFERRED, not
> observed: I saw no timeout in any of the 19 suite runs measured here. The cost is that a machine-load artefact enters K1 as a
> red verdict about a lane's *work* — the same class of number-poisoning `gate-coverage.md` §4
> already documents for `verified:true`.
>
> **FIXED 2026-08-06, and the "INFERRED, not observed" caveat did not hold.** It was observed on
> 2026-08-06: a land stopped with `ok:false` over an output with zero FAIL lines. The headroom
> arithmetic above also missed the real driver — the budget is wall-clock and every step of the
> chain must take the machine-wide suite mutex first, so it silently contains an unbounded wait
> (~255 s of 300 s in that run). A timeout is now `ok:null` + `timedOut`, the record carries
> `ms`/`waitMs`, and `e2e-stage.sh` says out loud who it is waiting for. `suite-contention.md` §8.
>
> **And the headroom arithmetic above is obsolete as of 2026-08-07, not merely corrected.** "120 s
> against a measured 45–48 s gate (~2.5×)" was never a ratio between two comparable things, because
> the numerator contained an unbounded queue. The wall clock is now split: the work budget is
> charged only for verifying, so the ratio finally means what this section assumed it meant, and
> the queue has a budget and a name of its own (`waitedOut`).

**Verdict:** the full suite as an unconditional synchronous gate is affordable in wall-clock terms
only if you accept ~6.4 min per clean land, ~19 min on the repair path, multiplied by however many
lanes land at once. That is not a gate, that is a queue. The sibling lane's instinct is right.

### 5b. The decisive measurement: the suite flips under exactly the load a gate runs under

I did not have to argue this one. **Round 2 of `./e2e-isolated.sh` failed** — 456 355 ms, rc=1,
3 FAILURES out of 759 checks — on the same tree that ran green in round 1 and in round 3.

Attribution first, because the lane rules require it: this worktree contains **no code change at
all**. `git status --porcelain` reports exactly one line, `?? docs/verify-tiering.md`, and HEAD is
`44eec8c`. The code under test *is* HEAD, verbatim, in all three rounds. Round 1 passed all three
of the checks that round 2 failed (transcript kept in session scratch). So this is nondeterminism
in the suite, not a defect introduced here — and the proof is stronger than a second HEAD worktree
would give, because it is the *same* tree passing and failing.

The three failures, read (not inferred from their names):

- `outcome: a lane that ends while a review is running records review.state "inflight"`
  (`e2e/review.ts`, grep the quoted check name — currently `check("outcome: a lane that ends while a
  review is running records review.state \"inflight\""`). The check sets the stand-in reviewer's delay to 6 s, fires a review
  without awaiting it, sleeps 1500 ms and kills the slot, expecting to catch the review in flight.
  What was recorded instead was
  `{"state":"superseded", …, "scope":"uncommitted changes plus recent commits (no lane base to diff against)", "notes":"no code changes in scope — nothing to review", "findings":[]}` —
  i.e. the review short-circuited before the stand-in was ever spawned, so the 6-second delay never
  applied and nothing was in flight at t+1500 ms. **This is the interesting one:** the check did not
  merely miss a deadline, it silently fell into a *different code path*. I did **not** root-cause
  why `laneBaseRef` yielded no base in that run (§9).
- `a second send of the same kind×slot within the episode window is 429` — got **409**
  (`e2e/steward-core.ts#run`, grep the quoted check name). The first send's paste echo resets the target pane's idle clock,
  and `canDeliver` runs *before* the cap gates — the harness knows this and waits it out before the
  *next* send (`e2e/steward-core.ts#run`, grep `canDeliver runs` says so in as many words) but not before this one. Under
  load the echo lands first and the request 409s on busy instead of 429ing on the cap.
- `a capped send is audited (steward_send_capped)` — a direct consequence of the previous: no cap
  was hit, so no cap event was written.

All three are timing races, and all three surfaced on the *slowest* run of the three (456 s against
a 337 s round 1). That is the shape of a load-sensitive suite, and it is the property that decides
this lane's question:

> **A pre-land gate must be deterministic, not merely affordable.** Had `./e2e-isolated.sh` been in
> `FLEET_VERIFY_CMD` during round 2, a sound lane would have been stopped and `verified:false`
> written to its outcome row — a machine-load artefact recorded as a fact about the lane's work
> (finding 2). The wall-clock argument says the full suite is *expensive* as a gate; this says it is
> *ineligible*, and no timeout setting changes it.
>
> It also strengthens the sibling lane's design rather than undermining it: a tier that records
> `green`/`red`/`unknown` and gates nothing is the correct home for a suite that can do this, and its
> tri-state classification is exactly the vocabulary a flip needs.

**Correction to the rulebook, reported as text because `CLAUDE.md` is gitignored and only copied
into lanes:** the line "A clean run tails 'ALL PASS' — **no known flakes**. … a fail is now yours
until proven fails-identically-at-HEAD" is false as of today. Two flakes are named above with
a locator and a mechanism, and a third (the `"inflight"` check in `e2e/review.ts`, above) whose mechanism I could only partly
establish. The rule that a fail is the lane's until proven otherwise is still the right default;
the "no known flakes" premise it rests on is not.

## 6. Pre-land gate vs post-land audit — what each buys that the other cannot

The interesting question, and the two are **not substitutes**. They answer different questions, and
each has a class the other structurally cannot see.

**Only a pre-land gate buys:**

- **(a) Prevention.** main never carries the defect. A post-land audit leaves main broken for the
  duration of the run (5.6 min median here) plus however long until a human acts on the alarm.
- **(b) Attribution.** A pre-land verdict belongs to exactly one lane's rebased tree. Tier 2
  coalesces bursts by design, so a red row can name three lands and identify none of them; its own
  `covers[]` field exists because of this. That is the right engineering choice for a background
  auditor, and it is also a permanent limit on what its red means.
- **(c) A rollback that is not needed** — because the one it would need is narrower than the phrase
  "↩ undo-land is the rollback" suggests. VERIFIED at the undo-land route (2026-07-26, `server.ts`
  grep `/api/repos/undo-land`): the pre-2026-08-08 undo record
  held **one record per repo**, and the route refused *and permanently deleted the record* as soon
  as main moved past `mainAfter`, or as soon as the commit was on any remote. So in the exact
  scenario tier 2's coalescing was built for — "three lands arrived within ~110 s on 2026-07-25",
  its own comment — **the first two lands were already un-undoable by the time an audit covering all
  three reported.**
  **Corrected 2026-08-08**: `undoStack` now holds up to `UNDO_STACK_MAX = 3` records per repo, so a
  three-land burst is reversible land by land (one ↩ per land, each with its own git gate and its
  own `reverted` ledger row). What did NOT change, and is the reason this paragraph stays: the
  fourth land back is dropped with a stated reason, a commit fleet did not land truncates the chain
  at the gap, and a red that names three lands still identifies none of them — the bisect is the
  owner's. The rollback is a pointer with a short memory, not history.
- **(d) Coverage of the auditor's own trigger.** `schedulePostLandAudit` is called at the end of
  `recordLand`, the same function that writes the undo record (`server.ts#recordLand` plus the
  sibling lane's addition). Both are invisible to tier 1 (§3: zero mentions). A land-path regression
  that makes `recordLand` early-return — it opens with
  `if (!mainBefore || !mainAfter || mainBefore === mainAfter) return;` — or throw takes out the undo
  record **and** the audit trigger together, and the symptom is an *empty trail*, which is
  indistinguishable from "nothing landed". INFERRED from verified code. The auditor cannot audit its
  own trigger; only a pre-land tier can.

**Only a post-land audit buys:**

- **(e) The integrated tree.** A pre-land verdict is bound to the `mainSha` it was rebased onto, and
  when main moves before a confirm-land the verdict is *marked* `stale`, not re-run (`server.ts`,
  `MergeLast.verify.stale`). VERIFIED. Two lanes each green against different mains can break main
  together; no pre-land gate structurally sees that combination. Tier 2 audits the tip, which is the
  only place that combination exists.
- **(f) Zero land latency, zero owner wait, and bounded load** — serialised, coalesced, off the land
  path by construction.
- **(g) A home for a suite too slow (or too flaky) to gate on**, with failure modes recorded as
  `unknown` rather than blocking work — the inverse fail direction their classification block argues
  for, and it is the right one for something that gates nothing.

**And one asymmetry that WAS neither — measured 2026-09-04, closed 2026-09-05.** The two tiers used
to hand their command *different environments*, and only one of them said so.
`server.ts#runPostLandAudit` has always spawned through `server.ts#auditChildEnv`, which drops
**every** `FLEET_*` variable — a rule, not a list, argued in its own comment (a nested fleet must not
inherit the outer one's audit command, credentials or behaviour knobs). `server.ts#runVerify` passed
**no `env` option at all**, so Bun handed the pre-land gate's chain the deployed server's environment
whole. The finding was never "an idea is missing" but "an existing invariant is not applied on one
side": a knob armed on the live srv reached the three suite wrappers the gate chain runs
(`e2e-clean-review.sh` · `e2e-security.sh` · `e2e-claude-gate.sh`) and reached the tier-2
`./e2e-isolated.sh` **not at all** — so the gate measured a world no lane running those same three
wrappers by hand could reproduce. That is the "green in the lane, red at the gate, and nobody can
say why" class, and it also runs the other way: an env difference can make one tier red where the
other is green, for a reason that is in neither tree.

**What the gate child gets now** is `server.ts#verifyChildEnv`: the same `FLEET_*` rule, with the
suite-mutex knobs carried and `FLEET_SUITE_LOCK_HELD_BY` **minted** rather than inherited. Those
survive because this server is a *participant* in that mutex — it takes the same lock (`SUITE_LOCK`,
from `FLEET_SUITE_LOCK`) and hands its hold to the child, which `e2e-stage.sh` honours only over a
pid recorded in `$FLEET_SUITE_LOCK/pid`; scrubbing the lock path would have the child queue for a
lock this very process holds — a silent deadlock, not a red check. **PATH is untouched**, which is
what keeps `bun` reachable at all: the launchd context carries neither `~/.bun/bin` nor
`~/.local/bin` nor brew, which is why `watchdog.sh` exports one.

Both ends are measured rather than asserted. Before the cut (2026-09-05, `e2e-clean-review.sh`'s
verify stand-in recording the env it was handed): **14** `FLEET_*` names in the gate child, including
`FLEET_SELF_TOKEN` and `FLEET_SELF_SLOT`. After: **0**, with `PATH` byte-identical to the runner's.
That stand-in keeps recording, so every land gate re-measures its own child environment — with a
control in the same reading (`srvEnv("FLEET_CLEAN_REVIEW")` proves the server does carry a `FLEET_*`
knob, so an absence can never pass for a null reading). `e2e/pins.ts` holds the source side: the
spawn passes an env at all, the rule is a prefix and not a name list, exactly the mutex knobs
survive, and the mint is not a keep.

The wrapper-stated defaults stay where they are and are now belt-and-braces rather than the only
guard: `e2e-stage.sh` exports `FLEET_LANE_AUTOCLOSE=0`, `e2e-isolated.sh` names it in `SRV_ENV`, and
`e2e/watch.ts`'s `D2 setup` reads the value back off the srv process, so an inherited value would
fail as a wrong premise instead of as a broken feature.

**Proportion, added 2026-09-04 (owner).** Tier 2 no longer runs the full suite over a tree whose
every new land was docs-only. `server.ts#drainPostLandAudits` asks `entryRunsShortChain` of the
COALESCED entry — every cover must carry the land gate's own `proportional` stamp, and the repo must
be one the short chain is about (`repoRunsShortChain`, the same `[ -f fleet-e2e.ts ]` question the
gate asks) — and `server.ts#runPostLandAudit` then executes `VERIFY_PROPORTIONAL_CMD` (install+pins)
instead of the configured suite, stamping `proportional` + `steps` on the ledger row exactly as the
land note stamps them for tier 1. The flag rides on the queue's `AuditCover`, not on a re-read of
the note, because both places that need it — the drain's selection and `helperJobsView` — are
synchronous by contract. **Absence is never harmlessness:** a mixed or empty burst, a land with no
gate, a cover restored from an older queue file all read as not-proven and buy the full suite. What
this does NOT weaken is (e): a docs-only tip still gets the only proof that is about it — the prose
claims `bun e2e/pins.ts` holds across files no compiler reads. What it removes is the measurement
that asked for the change, read off `post-land-audits.jsonl` rather than quoted: 76f3376 and
10ba7af (2026-09-04), one docs file each, drew a full `./e2e-isolated.sh` apiece — 1562 s and
1530 s, both RED, 9 and 1 failed of 3633 checks, both adjudicated flake. Both of those two ran on
the helper, so the cost was 52 minutes of the OTHER machine plus its claim window; run locally the
same pair would have held this machine's suite mutex for that long.
A proportional entry is also never offered to a remote helper and never held in the helper grace
(`helperJobsView`, `helperClaim`): the daemon runs the full fleet suite, so taking the job would
measure something other than the question, and the local answer costs seconds.

**The honest statement:** tier 2 is not a stronger tier 1. It is the only place a 5.6-minute suite
can live, and tier 1 is the only place prevention and attribution can live. Building tier 2 does not
retire the question "what does a green gate guarantee" — it answers a *different* question, and
leaves §3's answer (types, plus 25 checks about `claudeAlive`) exactly where it was.

## 7. Relative to the `post-land-audit` lane

Read first-hand: `git -C …/post-land-audit diff main...HEAD` (5 lane commits, +892/−21).

> **SUPERSEDED IN ONE RESPECT, 2026-07-28.** This section was written on 2026-07-25 against a lane
> whose tier was still switched off, and it says so three times below. **Tier 2 has been live since
> later that same day**: `watchdog.sh`'s srv-spawn line carries `FLEET_POSTLAND_AUDIT_CMD`, so a full
> `./e2e-isolated.sh` runs against the integration tip after every land that moves main. Read the
> three passages marked ~~struck~~ as history, not as the current configuration. The claim is now
> machine-checked rather than re-read: the marker below is compared against the actual srv-spawn line
> by `bun e2e/pins.ts`, which runs first in the land gate — if the tier is ever switched off, or its
> flag renamed, this paragraph fails the gate instead of quietly going stale again. That is the only
> defence prose has, and this section is the case for it: it outlived its own subject by three days
> in a document whose whole purpose is describing what the gate does.
>
> <!-- pin:watchdog-spawn FLEET_POSTLAND_AUDIT_CMD=set FLEET_VERIFY_CMD=set FLEET_CLEAN_REVIEW=off -->
> Pinned: `FLEET_POSTLAND_AUDIT_CMD` set · `FLEET_VERIFY_CMD` set · `FLEET_CLEAN_REVIEW=off`
> (`shadow` until 2026-07-28, when the K2 shadow series ended — 45 rows, 37 valid, all "pass", zero
> contradiction — and the reviewer was switched off. This marker outlived that decision by four days
> and failed the gate it is part of, which is the mechanism working as designed: the paragraph above
> claims prose has no defence but a machine-checked marker, and then this line proved it twice.)

**What it already solves — do not re-propose:**

- The post-land tier exists: `recordLand` → `schedulePostLandAudit` → `git archive` snapshot of the
  integration tip into `TMPDIR` with `node_modules` symlinked → one run at a time, bursts coalesced →
  tri-state `green`/`red`/`unknown` row on `post-land-audits.jsonl`, `GET /api/post-land-audits`,
  `postLandAudit` on `/api/sessions`, rehydrated at boot, loud server-log line on non-green.
- The decisions I would otherwise have argued for are already taken and argued at the decision site:
  it gates nothing, it does not auto-undo, `unknown` is never rounded to green or red, the child
  inherits no `FLEET_*` variable (so no recursion and no live tokens), and it is ~~**default OFF** with
  the enabling lines pre-written but commented out in `watchdog.sh`~~ — default off in
  `server.ts` still, but **switched on in `watchdog.sh` since 2026-07-25**; the lines are live, not
  commented out.
- 32 checks in `fleet-e2e-postland-audit.ts` plus 2 default-off non-regression checks in the main
  suite. Coalescing, non-overlap, non-blocking, the joins, the scratch-dir isolation, env scrubbing,
  and all three `unknown` shapes are each pinned.
- **Since 2026-07-26 the PENDING queue is durable as well** (`post-land-audit-queue.json`, written
  synchronously on every mutation, resumed at boot against the current tip; the entry is consumed
  only after its row exists, so an in-flight audit survives the death of its own process). It closes
  the gap measured in `mining-2026-07-26.md` finding 1 — the deploy ritual (`land → kill-session -t
  srv`) had raced and erased every audit it triggered. 17 further checks, sections E–G of the same
  file; the count above is now 49.
- **Since 2026-08-05 a red can be ADJUDICATED** — the missing half of "surface a red", and the one
  that decides whether anyone acts on it. Measured that day: 36 runs, 23 green / 13 red, **0 rows
  carrying a judgement, because no field existed to carry one**. A red was therefore permanently
  ambiguous between *nobody looked* and *looked, it was noise*, and that ambiguity is what trained
  the reflex of scrolling past red. Now: `POST /api/post-land-audits/adjudicate` (owner-only, keyed
  on the row's `at`) appends `{verdict: real|flake|stale-test|unknowable, at, by, note≤300}` to a
  SEPARATE append-only rail, `audit-adjudications.jsonl`, which every reader JOINS onto the row it
  judges — `GET /api/post-land-audits` and the steward's `ledgers.audits` projection both serve
  `adjudication` on the row. A side rail rather than a field rewritten in place, for three reasons:
  it makes *an adjudicated red stays red* structural (the writer cannot open the audit trail at
  all), it avoids rewriting an append-only two-generation ledger under a concurrent `appendEvent`,
  and it is the shape `dispositions.jsonl` already uses for the identical problem. Newest judgement
  wins; the rail keeps every one. A one-shot boot backfill stamps the 8 reds predating the
  signal-first retention fix (`70cd443`) `unknowable`/`by:"backfill"` — those rows' retained output
  is a blind char-tail that physically cannot name what failed, so they are unanswerable, not open.
  Deliberately NOT built (owner's instruction, 2026-08-05): any automatic flake classification. A
  regex that closes a red is a guard that never fires, and it would silently dismiss the next real
  failure with a similar signature. 19 further checks, sections H/H2; the count above is now 68.

**What it does not solve** (its own docs say the first two; the rest are mine):

1. ~~It is off. Nothing is audited until `FLEET_POSTLAND_AUDIT_CMD` is in the srv-spawn line and
   `launchctl kickstart` has run.~~ **Resolved 2026-07-25**: the variable is in the srv-spawn line and
   the kickstart has run. Everything else in this list still stands.
2. ~~Nothing reads the trail — no client rendering, no attribution consumer.~~ **Partly resolved**:
   the steward's `ledgers.audits` projection reads it each pulse, and since the adjudication rail a
   red can be closed there. Still open: **no client rendering at all** — the board shows only the
   newest row's summary, and the only way to WRITE a judgement is a curl to the route. The owner
   cannot adjudicate from the UI.
3. ~~**The rollback it names is mostly unavailable in the burst case it optimises for** (§6c). Worth
   saying in the doc it ships with, because "↩ undo-land is the rollback" reads as a general
   guarantee and is a one-land, until-the-next-land guarantee.~~ **Resolved 2026-08-08** for the
   burst case up to three lands (§6c, capped stack); it remains a short memory, never a general
   guarantee.
4. **It cannot cover its own trigger** (§6d), and its trigger lives in the untested-by-tier-1 land
   path.
5. It leaves tier 1's content untouched — after it lands, "green" still means types + 25
   `claudeAlive` checks.
6. **Its `red` will include suite flakes, and its tri-state cannot tell them apart (§5b).** The
   payload it is meant to run is the suite that failed once in three runs here — and a flaky failure
   exits non-zero, so it is classified `red`, not `unknown`. `unknown` covers *non-measurements*
   (timeout, exit 42, 126/127, snapshot failure); a suite that ran to completion and reported three
   failing checks is a measurement, and a wrong one. Consequence for the consumer that is still to
   be built: a red row naming innocent lands is not a hypothetical, it is the first thing that will
   happen once the tier is switched on during a busy hour.
   **Cheap fix, offered rather than built** (their file, their call): on `red`, re-run once against
   the same `mainSha` before raising the alarm, and record both results. A flake fails once and
   passes on the retry; a real regression fails twice. It costs one extra suite run *only on red*,
   it needs no new state (the tip is already pinned in the row), and it converts the alarm from
   "something failed" into "something failed reproducibly" — which is the difference between an
   alarm the owner acts on and one the owner learns to ignore.

**Collision surface with my proposal:** only `watchdog.sh`. They append an `AUDIT_CMD`
block *below* the `VERIFY_CMD` line (commented out in their tree when this was written; live since
2026-07-25 — `watchdog.sh`, grep `AUDIT_CMD`); I propose changing the
`VERIFY_CMD` string itself (line 57) and adding one env var to the srv-spawn line. Different lines
of the same file, both owner-applied by hand, both needing `launchctl kickstart`. Neither auto-lands.
No conflict in intent: their tier is the slow half, mine widens the fast half.

**One claim of theirs I would soften, with evidence.** Their `gate-coverage.md` edit says the main
suite "is NOT in the gate, and never will be (it runs >2 min, past `VERIFY_TIMEOUT_MS`)". The
wall-clock half understates it — measured 5.6 min median, 2.4× their figure. The
`past VERIFY_TIMEOUT_MS` half is a statement about a default nobody chose and that is one
environment variable away (§5), so it cannot carry a "never". The durable argument for "never" is
the concurrency one: *k* lanes → *k* concurrent full suites, with no global lock to add one to.
That argument does not expire when someone raises a timeout.

**One assumption of theirs I verified for them, since their whole tier rests on it.** Running the
suite from a `git archive` snapshot (a tree, no `.git`) is safe: `e2e-isolated.sh`'s `$DIR` is
already a plain `cp -R` copy and never a git repo (`e2e-isolated.sh#DIR`; it `git init`s only its
throwaway `testrepo`), and no check in `e2e/*.ts` runs git against `ROOT`
(`grep -rn ROOT e2e/*.ts | grep -i git` → empty). VERIFIED by reading, not by executing an audit
run — so the *class* of problem is excluded, not the specific run.

**And where that assumption stopped holding — 2026-09-05.** It was verified for the SUITE, which
stages its own copy. The PROPORTIONAL chain added later (§6b, `install+pins`) runs `bun e2e/pins.ts`
in the snapshot ITSELF, with no wrapper and no staging, and six pins there ask git what the tree
tracks. From the deploy at 07:36 every docs-only land was red with
`fatal: not a git repository` (audit rows `2e671a47`, `8a4655cb` — two out of two, six identical
fails, ~1 s each). The pins were not at fault: each failed as ITSELF ("the derivation ran",
"PROBE: git named the repo's top level"), which is why nothing above them could read the row as
anything but red. `server.ts#snapshotIntegrationTree` now gives the SHORT chain's snapshot an index
of its own — `git init -q -b main && git add -A -f`, built before the `node_modules` symlink so the
link cannot enter the index, and deliberately WITHOUT a commit so a history question still fails as
itself instead of answering with a sha that is not `mainSha`. The FULL chain's snapshot stays
git-less on purpose; §11.7's trail note is the reason.

## 8. Proposal — the smallest step that raises what "green" guarantees

Ranked. Steps 1 and 2 are the proposal; 3 is the sibling lane's, listed so the tiering is whole.

> **STATUS 2026-07-26: APPLIED — steps 1, 2 AND 2b are in `watchdog.sh`** (`07be94d`, `58203f2`),
> together with `FLEET_VERIFY_TIMEOUT_MS=300000`. Step 3 was already live. **Not active until
> `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` plus an srv restart** — an owner
> action. The prose below is left in its proposal voice on purpose; it is the record of the
> reasoning, and rewriting it into the past tense would erase what was argued before the fact.
> Two things this section could not know:
> - **Step 2b's original burn-in was void.** `./e2e-security.sh` had been aborting at import since
>   `13c5728` and later lost four checks to the digest change; the runs that were counted measured
>   a broken suite. Re-run after `d146e74` + `e5e5e80`: **10/10 ALL PASS, 47 checks each, 34–35 s,
>   variance under a second** — which is why 2b went in rather than staying withheld.
> - **The composed string had never been run**, only its parts. Measured as the server runs it:
>   three-part **69 s** (predicted 65.6 median / 73.8 worst), four-part **101 s** (predicted 100.0).
>   The estimates held.

**Step 1 — free, and removes a blind spot in the checker itself.** Add the three unimported
harnesses to the `tsc` list. Measured cost: 1.5 s → 1.538 s, no new errors (§4).

**Step 2 — 19 s, and it is the first land-path coverage the gate has ever had.** Add
`./e2e-clean-review.sh`. Why this suite and not another:

- It drives the **real clean auto-land path end to end**. Its checks assert
  `"the ok'd lane's commit reached main"` and `"the downgraded lane's commit did NOT reach main"`
  (`fleet-e2e-clean-review.ts`, grep the quoted check names) — i.e. `tryScriptRebase` → `runVerify` →
  `advanceIntegration` → `recordLand` → `landLane`, the path §3 showed the gate does not touch at
  all, and the path §6d showed tier 2 depends on.
- It is the only suite that exercises `runCleanReview`, which was **live on this fleet in `shadow`
  mode at the time of writing** (`watchdog.sh#FLEET_CLEAN_REVIEW`) and therefore ran on every clean
  auto-land in production. **Stale as of this pass (2026-08-25): the live srv-spawn line now carries
  `FLEET_CLEAN_REVIEW=off`**, not `shadow` — the reviewer is not live today. §7 below (this doc,
  written the same week) says why: the K2 shadow series ended 2026-07-28 (45 rows, all "pass", zero
  contradiction) and the reviewer was switched off then — so this has been stale since 2026-07-28,
  not just as of this pass.
- It is safe as a gate step: `FLEET_CMD=true`, stand-in reviewer and merge agent, `FLEET_AUTO_REVIEW_MS=0`,
  own `$$`-derived socket/port/dir (`e2e-clean-review.sh#DIR`) — it cannot spawn a real
  model session and cannot reach socket `claudefleet`. VERIFIED by reading the wrapper, and by
  running it from inside this lane worktree, which *is* the environment `runVerify` uses.
- **It burns in clean, which after §5b is the question that decides eligibility, not cost.**
  **8 runs, 8 × `ALL PASS`** (table row c′), spanning the contended and the quiet part of the
  window (26.8 s down to 17.8 s). Eight is not a proof of determinism — it is the evidence I have,
  and it is eight more clean runs than `./e2e-isolated.sh` managed in three.
- Ordering: cheapest-first, so the gate fails fast — 19 s before 45 s.

Cost of steps 1+2, summing measured medians: `install` 0.04 + `tsc`(7 files) 1.54 + `clean-review`
18.7 + `claude-gate` 45.3 = **65.6 s median**; summing the measured worst cases gives **73.8 s**.
Against the 120 s default that is 1.6× headroom at worst case, which is too thin (finding 2), so the
timeout moves in the same change.

**Step 2b — 34 s, and it closes a gap that surprised me: the security regression suite runs in no
gate at all.** `./e2e-security.sh` (46 checks) is what `docs/security-model.md` (an internal working
doc, deliberately unpublished per `docs/README.md`'s "Not published at all" list) named as the
regression suite for the whole perimeter document at the time of writing. It is in no
gate, in no CLAUDE.md verify list, and its harness is one of the three files `tsc` never sees (§4).
It is isolation-safe on the same pattern (own port band, `FLEET_CMD=true`,
`FLEET_AUTO_REVIEW_MS=0` — `e2e-security.sh#DIR`). Measured 34.2 / 34.5 s, both green.
*Superseded 2026-07-28 on two points: it has since entered the pre-land gate (`watchdog.sh#VERIFY_CMD`
runs `./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh`, and that same line's
`tsc` covers all three harnesses, so §4's "files tsc never sees" is closed too); and its band was
15200+ here, which overlapped the post-land audit's 15000–16999 by 1800 ports — every band is now
listed in one table, in `e2e-isolated.sh`.*
**I am not folding it into the recommended string**, for one reason: **n = 2 is not a burn-in**, and
§5b is precisely the lesson that a suite's eligibility is decided by repeated runs, not by two. The
honest recommendation is to run it ~10× first and then add it; with the timeout at 300 s the budget
is there (median would go 65.6 → 100.0 s, worst case 73.8 → 108.3 s).

**Proposed `watchdog.sh` `VERIFY_CMD`** — this was written before the edit; the file now carries
this string **plus `&& ./e2e-security.sh`** between the two suites (step 2b, cheapest-first).
Still needs `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` and an srv restart:

```sh
VERIFY_CMD='[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts && ./e2e-clean-review.sh && ./e2e-claude-gate.sh'
```

and on the same srv-spawn line, next to `FLEET_CLEAN_REVIEW=shadow`:

```sh
FLEET_VERIFY_TIMEOUT_MS=300000
```

300 s is 4.6× the proposed gate's measured median and 4.1× its measured worst case (and it would
still be 2.8× with step 2b folded in) — enough that machine load cannot manufacture a red verdict
about a lane's work, and still short enough that a genuinely wedged gate is not a 30-minute hang. It
changes nothing about what lands: a slow gate that eventually passes lands, exactly as a fast one
does. Note this is the one change here that is worth making **even if the rest is rejected** —
finding 2 applies to today's 47 s gate too.

**Step 3 — the sibling lane's tier 2, enabled.** Uncomment its `AUDIT_CMD` block, add
`FLEET_POSTLAND_AUDIT_CMD` to the srv-spawn line, same kickstart. That is where the 5.6-minute suite
belongs (§5, §6).

**What I deliberately do not propose, and why:**

- `./e2e-isolated.sh` in the gate — §5.
- Auto-undo on a red audit — the sibling lane's reasoning ("a machine that both lands AND un-lands
  unattended moves main in two directions with no human in either") is right, and §6c is a second
  reason: the undo record is frequently already void.
- A sliced "land-path only" subset of the main suite as a middle tier. It sounds like the obvious
  answer and it is not a config change: `fleet-e2e.ts` threads one mutable `LaneCtx` through
  `lanesBasic` → `lanesLifecycle` → `merge` (grep `LaneCtx`), and its top-of-file comment states the order is load-bearing
  because the suite is one sequential session against one server. Extracting the merge/land modules
  is a refactor of the suite's fixture model, and it should be costed as one before anyone plans on
  it.
- Anything about the client. No tier discussed here covers `public/*.js` (§9).

## 9. What I did not check

- **I did not execute a post-land audit run.** §7's verification of the snapshot assumption is
  structural (reading `e2e-isolated.sh` and grepping `e2e/*.ts`), not an executed audit.
- **I did not observe a verify timeout.** §5's false-red finding is a margin argument from the
  measured span, not an observed failure.
- **I did not measure on a quiet box**, and could not: other lanes were working throughout. Every
  number carries that.
- **I did not prove that two gate runs from two lanes cannot interfere.** The `$$`-derived
  socket/port/dir make it very unlikely (`e2e-clean-review.sh#DIR`, `e2e-claude-gate.sh#DIR`,
  distinct port bands) and my runs overlapped other lanes' runs without failing, but I did not
  construct the collision deliberately.
- **Nothing measured here verifies the built client.** `bun run build` is in the table only to
  price it (~90 ms). The closest thing that exists is `fleet-e2e-security.ts` §7 (grep `§7`), which
  asserts *source-level* invariants — no HTML/eval sink in `src/*.ts` beyond one reviewed static-icon
  exception, no inline script in the served `public/*.html`, `src/md.ts` uses `textContent` — i.e.
  exactly the "asserted only at source-string level" caveat `lane-brief-template.md` names (grep the
  quoted phrase; `docs/lane-brief-template.md` is undated, so its own line refs carry the same risk
  this pass is closing — not re-verified here, out of this file's scope).
  It ran in no gate when this was written; since 2026-07-26 (`58203f2`) it is in the pre-land gate,
  so the caveat about *what* it asserts stands while "runs nowhere" no longer does.
- **I did not root-cause the `e2e/review.ts` `"outcome: a lane that ends while a review is running
  records review.state \"inflight\""` check's failure** (§5b) — I established what was recorded
  and that the stand-in never ran, not why `laneBaseRef` produced no base on that run. It may be a
  harness race, and it may be adjacent to the defect the sibling lane's commit `e47313e`
  ("a failed git read is not an empty diff — runReview must not fake a clean review") repairs. I did
  not test that hypothesis, and it should not be reported as if I had.
- **I did not re-derive the sibling lane's 32 checks by running them** — I read their names and the
  diff, and ran nothing in that worktree.
- **I did not read all 46 checks of `fleet-e2e-security.ts`.** I measured the suite (n = 2, which
  §8 says is not a burn-in), read its wrapper in full and its scope header and §7 client block
  (`fleet-e2e-security.ts`, top-of-file comment and §7, grep `§7`); the rest of what it asserts I took from
  `docs/security-model.md` (unpublished internal doc, per `docs/README.md`), not from reading each check.

## 10. One artefact found while measuring, reported not touched

`/private/tmp/tmux-501/` holds **403 socket files**, of which 174 are `fleettest*` (the
`e2e-isolated.sh` family), 93 `fleetgatetest*` and 43 `fleetcrtest*`. Live tmux servers among them:
four, one of which has been running **2 days 1 h** — a leaked `e2e-isolated.sh` instance
(`tmux -L fleettest23870`, its `$DIR` still in `TMPDIR`). VERIFIED by `ls` and `ps`.

My own failed round-2 run added to the pile exactly as designed: `e2e-isolated.sh` (grep `kept test
instance for inspection`) keeps the
instance directory on a non-zero exit for post-mortem (`kept test instance for inspection:
…/fleet-e2e-instance-41581`). Correct behaviour for a hand-run suite; for an unattended per-land
tier it means every red run leaves a full copy of the repo behind.

Relevance to tiering: every suite run leaves a socket file, and an interrupted one can leave a live
tmux server — the residual the sibling lane names honestly for its timeout path ("a timed-out audit
may leave its own throwaway tmux socket behind"). At today's by-hand frequency that produced one
live leak; a per-land tier runs the same script far more often. Not touched — this is outside the
repo and therefore shared reality, not a lane's to clean (CLAUDE.md).

## 11. A second, independent confirmation of §5b — and a fourth flake family (2026-07-26)

*Added while landing the data-saver program (four lanes, `bc4e975`…`f323fb4`). Not a new study —
§5b's finding reproduced by accident, at cost, plus one thing §5b could not know.*

### 11.0b DAS INSTRUMENT: `GET /api/self/flakes` — was `runs`, `files` und `filesOmitted` bedeuten (repariert 2026-09-06 in `3f58491`)

Diese Route ist das Messinstrument, auf dem das Erfolgskriterium des Programs „Audit-Determiniertheit
2026-09" definiert ist („je reparierter Familie 0 Fails auf allen Baeumen, die den Fix enthalten, bei
mindestens 10 solchen Laeufen"). Wer eine Basisrate daraus liest, muss ihre vier Zahlen lesen, nicht
nur die erste.

**Die vier Zahlen.** `runs` = **distinkte Laeufe unter den GELESENEN Zeilen**, nicht Laeufe im
erfragten Fenster. `files` = wie viele Trail-Dateien wirklich geoeffnet wurden (Deckel:
`server.ts#TRAIL_MAX_FILES`, 400). `filesOmitted` = wie viele Kandidaten der Deckel wegschnitt, und
zwar **newest-first**, das abgeschnittene Material ist also das AELTERE. `filesOtherSuite` = wie
viele Dateien schon am Namen als andere Suite erkannt und gar nicht erst gezaehlt wurden.

**Woran ein Leser eine abgeschnittene Antwort erkennt — an einem Feld, nicht an einem Bauchgefuehl:**

| Feld | bedeutet |
| --- | --- |
| `truncated: false` **und** `coveredFrom === window.from` | die Antwort deckt das ERFRAGTE Fenster ab. Das ist das Register. |
| `truncated: true` | der Deckel hat geschnitten. `runs` ist eine STICHPROBE, keine Zaehlung. |
| `coveredFrom` | die aelteste `mtime`, die ueberhaupt geoeffnet wurde. Die Antwort beschreibt `[coveredFrom, now]` — nie das erfragte `days`. Es ist eine UNTERGRENZE der Abdeckung: Zeilen INNERHALB der aeltesten gelesenen Datei koennen aelter sein. |

**Zwei Fenster mit gleichem `coveredFrom` haben dasselbe Material gelesen.** Das ist der Handgriff:
`?days=7` mit `?days=30` vergleichen und **`coveredFrom`** gegeneinanderhalten, nicht `runs`. Sind sie
gleich, hat das breitere Fenster nichts dazugewonnen, und eine Rate „ueber 30 Tage" ist gelogen, egal
was `window.days` sagt.

**Was am 2026-09-06 repariert wurde** (Zeile 2 des Programs, Queue-Zeile `76d39cae`; die Sonden
liegen in `e2e/trailstats.ts`, Block „THE CAP, measured THROUGH the route"). Der Deckel lief VOR dem
Suite-Filter — nicht vor dem Zeitfenster, die `mtime`-Vorfilterung war immer korrekt. Daraus zwei
Defekte:

- **Suite-Verzerrung.** Eine suite-genaue Frage wurde aus einer Stichprobe beantwortet, die die
  ANDEREN Suiten schon aufgefressen hatten. `?suite=isolated&days=7` las 400 Dateien, von denen
  **341 anderen Suiten gehoerten**, und meldete 59 isolated-Laeufe. Der Suite-Filter sitzt jetzt VOR
  dem Deckel (am Dateinamen, der die run-id und damit die Suite traegt; ein nicht parsbarer Name
  wird nie ausgeschlossen, und die Zeile selbst bleibt der autoritative Filter).
- **Ein stummes Fenster.** `?days=2` und `?days=30` lieferten byte-gleiche `runs`/`rows`/`checks`,
  jede Antwort druckte aber ihr erfragtes `days`. Es gibt jetzt `truncated` und `coveredFrom`.

Vorher/nachher, **gemessen am 2026-09-06 gegen DIESELBEN echten Trail-Verzeichnisse**, aus zwei
Wegwerf-Instanzen (eine aus `main`-HEAD, eine aus dem reparierten Baum), Minuten auseinander:

| Aufruf | vorher `runs` | nachher `runs` | nachher zusaetzlich |
| --- | ---: | ---: | --- |
| `?days=1` | 283 | 283 | `truncated:false`, `coveredFrom === window.from` |
| `?days=2` | 400 | 400 | `truncated:true`, `coveredFrom` = 1788547626625 |
| `?days=7` | 400 | 400 | `truncated:true`, **gleiches `coveredFrom`** |
| `?days=30` | 400 | 400 | `truncated:true`, **gleiches `coveredFrom`** — das breitere Fenster hat nichts dazugewonnen, und jetzt sagt es das |
| `?suite=isolated&days=7` | **59** | **192** | `truncated:false`, `filesOtherSuite:5574`. Direktscan derselben zwei Verzeichnisse im selben Moment: **192** |
| `?suite=isolated&days=30` | 59 | 400 | `truncated:true`, 234 `filesOmitted` — hier beisst der Deckel wirklich, und er sagt es |
| `?suite=claude-gate&days=7` | 161 | 400 | `truncated:true`, 312 `filesOmitted` (Direktscan: 712) |

**Der Deckel ist NICHT weg.** Er wurde nicht erhoeht — das haette die Grenze verschoben statt sie
sichtbar zu machen. Eine unsuite-gefilterte Frage ueber viele Tage ist weiterhin abgeschnitten; sie
sagt es nur jetzt. Praktisch heisst das: **eine Basisrate immer mit `?suite=` erfragen** und danach
`truncated` lesen. Die Raten in §11.2q und §11.2r sind per Direktscan gerechnet und bleiben es —
nachgerechnet werden koennen sie ab jetzt auch ueber die Route.

### 11.1 The four runs

All serial on the same machine, each holding a `mkdir /tmp/fleet-e2e.lock` mutex, no foreign suite
live. Durations are lock-to-lock gaps (~6–7 min each), not instrumented — the suite prints no
elapsed time, which is itself worth noting.

| tree | checks | result |
|---|---|---|
| `main` @ `c27c5fb` | 823 | ALL PASS |
| `main` + lanes A+B | 850 | 3 FAIL — `outcome:` family |
| `main` + A+B+C+D (`d105877`) | 872 | 6 FAIL — `G1b` (5), `FIX1` (1) |
| **the identical `d105877`, run again** | 872 | **ALL PASS** |

The last row is the proof §5b names as the strongest — *the same tree passing and failing* — and it
is the only one of the four that settled anything. The three before it produced two confident and
opposite attributions, both wrong: first "pre-existing" (killed by the green HEAD run), then "our
regression" (killed by the green second run).

Note the shape §5b predicts: failures grow with suite length (823 → 850 → 872 checks), and the
membership of the failing set *moves* while the family stays put.

### 11.2 A fourth flake family, not among the three §5b names

All nine failures across the two red runs share one root — the stub resolver reports success while
the lane tree is still unmerged:

- `"agent reported rebased, but the lane is not clean — lane kept. fake rebased"`, with `UU base.txt`
  left unresolved, and the sibling variant `"… but the lane is not rebased onto main"`.
- Affected: `G1b setup: conflicting lane resolved…`, `G1b: confirm-land …` (4 more),
  `FIX1: concurrent merges settle to a single clean resolution`, and
  `outcome: repaired conflict resolution … / confirm-land …` (3).

This is the merge/resolver family and it is distinct from §5b's three (the `"inflight"` check in
`e2e/review.ts`, the steward send-cap 429/409, and its audit consequence).

> **ROOT-CAUSED AND FIXED 2026-07-28** (`fix(merge): the land path survives its own git
> plumbing`): `.git/index.lock` from Fleet's own status polls authored FIX1 — read-only git now
> runs `GIT_OPTIONAL_LOCKS=0` (`server.ts`, grep `GIT_READ_ENV`); proof was 10/10 FIX1 instances
> over 5 serial runs against a base rate of 8/16. **A FIX1-shaped red AFTER that commit is real
> and yours** — CLAUDE.md has said so since the fix, while this section still said "not
> root-caused" until 2026-08-05: a lane adjudicating a red through THIS paragraph read the exact
> opposite of the rulebook and could wave a real regression through as a known flake. The
> paragraph below is the pre-fix state, kept as history.

**Not root-caused** *(historical, superseded above)* — same state §5b left
the `"inflight"` check in `e2e/review.ts` in. Recorded so the next person does not re-derive it: nothing in the four
landed lanes touches the merge path, and the same checks pass on the same tree on a re-run.

### 11.2b A fifth family: the reseed + live-bytes check (2026-07-28, third sighting 2026-08-01)

Signature, generic on purpose because that is all it has: **`N marks, 1..N-1`** in

> `reseed + live bytes are the pane's output exactly once — no duplicated, no missing line`

Seen three times, on unrelated trees and unrelated diffs: `41 marks, 1..40` and `42 marks, 1..41`
in lane `7234` (2026-07-28, 2 of 22 trail runs), and byte-identically `42 marks, 1..41` again on
2026-08-01 against a diff that was **entirely picker CSS** — a path that cannot reach the pane
stream. The 2026-07-28 pair was additionally shown on ancestor tree `4df2898`.

The shape says one mark is missing from the end of the sequence, i.e. the check reads the stream
one write before it settles. **Not root-caused**, same as the fourth family. Recorded here because
`CLAUDE.md` carried it alone and its instance count was already stale.

**No free pass.** Three sightings make the family real; they do not make the next red one a flake.
The proof order in §11.3 applies unchanged, and it is what cleared the 2026-08-01 instance: the
same tree, re-run serially on an idle machine, came back 993 PASS / 0 FAIL.

### 11.2c A sixth family: the `stalled` fixture's pane-observation race (2026-08-06 → 2026-08-07)

Signature: up to four FAILs inside `e2e/review.ts`'s `stalled` block with **one** root —

> `stalled setup: the lane's output was observed, so idle means idle and not 'never spoke'`
> detail `{"observed":false,"lastOutput":0}`

The other three (`stalled is served as a fact…`, `a stalled lane is NOT done-looking…`,
`stalled-since is served next to it…`) are dependents, not separate defects: `stalled` requires
`observed`, so a lane whose pane was never observed cannot satisfy the predicate at all.

**Four instances, read out of the trail rather than out of a report:**

| run | tree | FAILs |
|---|---|---|
| `isolated-20260806T080357Z-16324` | `29c67997` | 3 |
| `isolated-20260806T081615Z-58444` | `29c67997` | 4 |
| `isolated-20260807T023150Z-20894` | null | 4 |
| `isolated-20260807T091218Z-63718` | null | 4 |

The last one is the red post-land audit of `9940ac3`, adjudicated `flake`. The first has only three
because **the root check did not exist yet**: that run's setup line was `stalled setup: a non-lane
slot sits on a clean clone with nothing ahead`, and it passed. The root check was added between
08:03Z and 08:16Z on 2026-08-06.

**The base rate is two numbers, and folding them is what makes it wrong.** 4 of the 77 trail runs
that carry the dependent check (5.2 %); 3 of the 76 that carry the root check (3.9 %). Queue row
`32c89530` states it as "4 von 69 (~6 %)" — one figure over a denominator that does not cover the
first instance. This is the corrected reading; the row's own VERIFIKATION clause (every cited run
id must exist in the trail and carry `ok:false`) is what produced it.

**Mechanism — from the fixture's own comment in `e2e/review.ts#run` (grep `A RENDERED PANE IS NOT
AN OBSERVED PANE`), not inferred.** This
harness runs `FLEET_CMD=true`, so a freshly opened pane emits no bytes and `lastOutput` stays 0.
`ensureSlot` sets `quietUntil = now + 1500` when it starts piping, and `poll()` streams output
inside that window *without* stamping `lastOutput` — a repaint tmux just caused is not the session
working. A probe fired inside the window therefore renders, satisfies `paneEnv`, and still leaves
`lastOutput` at 0. The fixture's guard against that was, at the time this was diagnosed, a fixed
`await Bun.sleep(2000)`,
and a fixed wait is exactly what machine load defeats. **That line is gone from the current
fixture** — see "Closed — fixed in this lane" below, which replaced it with the per-round re-fire
this paragraph goes on to propose.

**It is fixable, and the fix is named.** The poll below the probes waits on `stalled`,
not on `observed`; when `observed` never flips, it spins its full 40 s and the setup check fails
anyway. Re-firing the probe *inside* a poll on `observed === true` removes the fixed wait's
assumption without weakening any assertion. Not built here — the honest verification is three
serial `./e2e-isolated.sh` runs (~30 min of suite mutex, so never beside a land), which is a lane's
job, not a doc's. Part (b) of `32c89530` remains open with this as its brief.

**Closed — fixed in this lane.** Nothing above this paragraph was rewritten; the addendum is the
whole change, so the code cited above is the code as it was *when the family
was diagnosed*, not at today's (this is exactly why this pass moved this file's locators off line
numbers and onto symbols — a symbol survives the rewrite this paragraph describes; a line number
does not). Part (b) was built exactly as the paragraph before it names: the
fixed `Bun.sleep(2000)` is gone, the
probe is re-fired *per round*, and the round's exit condition is read off the server's
`observed`/`lastOutput` rather than off `paneEnv`'s return value — a pane that has been observed is
left alone so its idle clock starts, and a 60 s upper bound fails the named setup check instead of
running the block against a pane that never spoke. No assertion moved: the four checks this family
shows up in are byte-identical, and the setup check that used to accept "paneEnv answered" now
requires `observed`, which is strictly stronger. Proof: **three serial `./e2e-isolated.sh` runs on
the fixed tree, all green, nothing else on the machine** — trail ids
`isolated-20260807T133041Z-8248`, `isolated-20260807T133946Z-43828`,
`isolated-20260807T134849Z-77993`, each `tree` `5f84d53` `dirty:true` (the fix was still
uncommitted, as the rows say), each with **zero `ok:false` rows**. One green run would have proved
nothing against a ~4-5 % base rate, which is why the price was paid.

The trail also shows the loop is *cheaper* than the fixed wait it replaced: the setup check lands
at `msSincePrev` 2132 / 2128 / 2140 ms across the three runs — two rounds, converging where the
1500 ms `quietUntil` window ends, instead of a flat 2000 ms sleep plus the probes after it.

**No free pass.** Four sightings make the family real; they do not make the next red one a flake.
The proof order in §11.3 applies unchanged.

### 11.2c-bis The MIRROR of the family, in another harness: an unprobed pane that is already observed

> **Superseded as a filing, 2026-08-19 — see §11.2f.** This sighting is not a sibling of §11.2c at
> all: it is one of five checks of a family of its own, and its root is not "when does a freshly
> opened pane count as having spoken" but `lastOutput` never having been a readiness signal in the
> first place (`94b1362`). The two sightings below stand as measurements and are counted in
> §11.2f's base rate; the *classification* in the paragraphs that follow is the one that was wrong.
> The check itself was repaired on 2026-08-19 and no longer asserts `lastOutput === 0`.

Signature, in `fleet-e2e-harness.ts` (phase 3 of `./e2e-claude-gate.sh`, the empty-`FLEET_HARNESS_COMMS`
counter-probe), one FAIL and no dependents —

> `FAIL  unprobed fixture: the pane is still unobserved before /send  (<epoch-ms>)`

The fixture asserts `lastOutput === 0` and gets a timestamp. That is the **inverse** of §11.2c, which
fails when `observed` never arrives: here it arrives when the fixture requires that it has not yet.
Same underlying seam (when a freshly opened `FLEET_CMD=true` pane counts as having spoken), opposite
direction, different harness — so it is a sibling, not a member, and §11.2c's closed fix does not
cover it.

**Two sightings, both on 2026-08-18, both proven nondeterministic by the §11.3 order:**

| where | tree | outcome of the SERIAL same-tree rerun |
|---|---|---|
| P6 lane's own gate chain (reported in its pane, not in a trail row) | `43e5765` line of work | `PASS … (0)` |
| the live land gate for P8 (`verify.ok:false`, 107 s, exit 1, 1 FAILURES) | `6f3b3e8` | `./e2e-claude-gate.sh` → `ALL PASS`, 116 PASS |

The second one cost a real land: the gate downgraded a clean rebase to `resolved/landed:NO`, and the
tree went in by confirm-land after the rerun.

**No base rate here, and that is a statement about the measurement, not about the family.** Both
sightings are pane reports and a merge verdict; this harness is a single-file one and its runs are not
what §11.2c's trail counts, so nobody has a denominator yet. Two sightings make it worth naming; they
do not make the next red one a flake. §11.3 applies unchanged.

### 11.2d A sibling, and NOT a member: `paneEnv` reads a wrapped probe line as "never answered"

Recorded next to §11.2c because it wears the same symptom — *the pane probe reports that the pane
never responded, while the pane responded fine* — and is a **different mechanism with a different
character**: deterministic, not a flake, and already fixed.

Found 2026-08-07 in lane `5d04` while building `d02f1ec`. `paneEnv` returned `null` for 20 s. The
cause is not a race: `e2e/slots.ts` sets slot 2 to **55 columns**, and the probe line carrying a
32-hex value is **63 characters**. tmux wraps it, and `capture-pane` without `-J` hands back the
two physical lines separately, so the line-anchored match can never hit. Reproduced in isolation
(tmux, 55 columns, the identical line): **without `-J` zero matches, with `-J` one.** Fix:
`capture-pane -p -J`, landed with `d02f1ec`.

**Why it slept until now.** Every value probed before this one was short or empty, so no probe line
had ever exceeded the narrow pane's width. The trap was a function of the *value*, not of load —
which is exactly why it is not a flake and why re-running would never have cleared it.

**The rule this leaves behind.** A negative from a pane probe means *"no match in the captured
text"*, never *"the pane stayed silent"* — three distinct causes now have measured instances: the
quiet window (§11.2c), the wrap (here), and genuine silence. A fixture that treats the first two as
the third accuses the wrong thing, and the accusation is expensive: §11.2c's cost is a ~10 min
proof run per sighting.

### 11.2e A seventh family: the 💾 commit route's idle gate fires against the suite's own probes (2026-08-08)

Signature: a check of the **commit family** fails, and *which* check it is changes from run to run.
The tell is in the detail, when the check prints one —

> `{"committed":false,"reason":"the session is actively working right now — a commit would snapshot
> a half-finished tree; let it settle, then commit"}`

— and where the check passes only a boolean to `check()`, the detail is empty and the family is
recognisable solely by *which* checks fell. Two of the six sightings look like that.

**Mechanism, read off the route and not inferred.** `POST /api/slots/:id/commit` runs
`canDeliver(…, idleMs: body?.confirm ? 0 : MERGE_IDLE_MS)` (`server.ts`, grep `actively working`)
and refuses with 409 unless the pane has been quiet for `MERGE_IDLE_MS` = 3000 ms. The suite's
commit probes post within a second or two of spawning a lane (or of opening a main session on
slot 9), so whether the pane still counts as *working* at that instant is a function of **machine
load**, not of the tree the check is about. `confirm` waives the gate — that is the parameter the
client sends once its own dialog was acknowledged.

**The family has a birth date, which is what makes the base rate readable.** The gate is
`0e2a672` (2026-08-07 19:20 Z); before it the mid-run warning was client-only, so no probe could
ever hit it. Counted over the trail, restricted to `isolated-*` runs that actually carry a
commit-family check: **0 of the 196 runs before the gate, 4 of the 16 after it (25 %)** — plus two
red post-land audits, which do not write into that trail set. This is not a rare flake; it is a
regression that arrived with a feature and was mistaken for one, six times in four hours.

**Six sightings, six distinct checks, 2026-08-07 23:04 Z → 2026-08-08 03:22 Z.** Read out of `e2e-trail/` and
`post-land-audits.jsonl`, not out of a report:

| run / source | tree | commit-family FAIL(s) |
|---|---|---|
| `isolated-20260807T230406Z-4575` | `6cd299e` dirty | `regression guard: one-gesture commits the dirty conflicting lane` |
| `isolated-20260808T003324Z-29738` | `3280a10` dirty | `lane commit stages untracked too (add -A) → clean tree` |
| post-land audit of `53f5ce8`, red, adjudicated `flake` | `53f5ce8` | `commit agent mode lands the agent-supplied conventional-commit message` |
| `isolated-20260808T023149Z-80240` | `2216de8` dirty | `main-session commit stages tracked (add -u)…` · `commit refuses a detached HEAD` (2 of that run's 16 FAILs) |
| `isolated-20260808T025929Z-76832` | `53f5ce8` clean | `regression guard: one-gesture commits the dirty conflicting lane` |
| post-land audit of `4311c92`, red, adjudicated `flake` | `4311c92` | `FIX4: commit refuses a lane with a git op in progress` |

Both `one-gesture` sightings drag a **dependent** FAIL with them (`regression guard: a conflicting
land PAUSES…`): the conflict that check needs is created by the commit that did not happen. Same
shape as §11.2c — one root, several red lines.

**The proof here is sharper than the prescribed one, and worth keeping as a pattern.** §11.3 says:
re-run the same tree; green clears it. The rerun of `53f5ce8` (row 5 above) was *not* green — it
failed with **two different checks of the same family**. Different checks on a byte-identical tree
is a stronger statement than a green repeat, which always retains the reading "the flake did not
fire this time". A green repeat proves non-determinism only against a known base rate; a *moved*
failure proves it outright.

**Fix — the probes send `confirm`; the gate is not touched.** Both halves matter:

- Every commit probe in `e2e/` except one now posts `confirm: true`. These probes are about the
  **tree** (does `add -A` sweep untracked, does a detached HEAD refuse, does agent mode carry the
  model's subject) — the gate is not their subject and its refusal pre-empts theirs, which is why
  the detached-HEAD and FIX4 checks failed *with the wrong reason* rather than with none.
- The one exception is the gate's own proof block in `e2e/lanes-basic.ts`, which asserts both
  directions — refused while busy, waived by `confirm` — off a **non-tautology busy setup** that
  first proves the pane reads busy. Waiving the gate everywhere else therefore costs no coverage:
  deleting the gate still fails that block.
- The alternative — every probe waits out the idle threshold — was rejected. It is not a wait but a
  retry loop (nothing stops the pane emitting again), it is the send-keys-and-sleep shape this repo
  banned after §11.2c, and it would add ≥3 s × 16 call sites to every run to re-prove, badly, what
  one block already proves well.
- A **rot guard** rides along, in the gate block itself: it scans `e2e/*.ts` and fails if any
  commit POST omits `confirm` without marking itself as the gate proof. A rule, not a list of
  today's 16 call sites — the next probe someone adds is the one this family would otherwise
  come back through.

**One real defect fell out of it, in the product and not in the suite.** `doLand` (`src/client.ts`)
committed a dirty lane *without* `confirm`, although the risk preview the owner had just accepted
says in as many words that the uncommitted work is committed first. On a lane still producing
output that 409s, and the body carries `reason`, not `error`, so the owner's alert read
`Land failed — could not commit the work first: undefined` for a perfectly healthy tree. Now
`confirm: true`, same reasoning as `doCommit`'s `activeConfirmed`. The e2e probe in
`e2e/land-provenance.ts#run` (grep `Mirrors doLand`) says it mirrors `doLand`, and mirrors it again.

**Proof, at the price §11.2c set: three serial `./e2e-isolated.sh` runs on the fixed tree, nothing
else on the machine, all green** — trail ids `isolated-20260808T034334Z-27704`,
`isolated-20260808T035408Z-67289`, `isolated-20260808T040442Z-6006`, each `tree` `4311c92`
`dirty:true` (the fix was still uncommitted, as the rows say), each 1699 rows with **zero
`ok:false`**. Against a 25 % per-run base rate three clean runs is ~0.4 % under the null, which is
why one run would not have been worth printing. The rest of the gate chain
(`bun e2e/pins.ts`, tsc, `bun run build`, clean-review, security, claude-gate) is green on the same
tree.

**No free pass**, as with every family here: six sightings make it real, they do not make the next
red commit check a flake — and after this fix a commit-family red has one fewer excuse, not more.

### 11.2f An eighth family: the send-boot fixtures assert a precondition they do not control (2026-08-10 → repaired 2026-08-19 in two cuts)

**The ordinal, counted and not asserted.** Three families in §5b, `merge/resolver` in §11.2,
`reseed + live-bytes` in §11.2b, the `stalled` pane-observation race in §11.2c, the 💾-commit idle
gate in §11.2e — seven. §11.2d says of itself that it is a sibling and **not** a member, and
§11.2c-bis was filed as one too — wrongly, but a sibling filing never carried an ordinal, so
neither of them shifts the count. This is the **eighth**, and it absorbs §11.2c-bis. (The queue line
that commissioned the repair, `911bdb73`, calls it the seventh; it was written without §11.2e in
view. `CLAUDE.md` says "sechs bekannte Flake-Familien", which was already one short before this
section existed.)

**What §11 said about it before this.** Four of the six checks below appear **nowhere** in this
file (`grep -c 'boot-race'` was 0). The `unprobed` one is written up — as §11.2c-bis, filed as a
*sibling of §11.2c*. That filing is wrong and is superseded here: its mechanism is not §11.2c's
repaint quiet-window but the one this section names, and its two sightings belong in the base rate
below. Naming one member of a six-member family as a one-off sibling of a different family is
itself the cost of not having had this section. The sixth check was missed twice over: it appears
in no filing before 2026-08-19, and the first repair cut walked past it — see the correction below.

**Signature: any of six checks in `./e2e-claude-gate.sh`, and *which* one changes from run to
run.** Verbatim, all six, so a later reader recognises them:

> `unprobed fixture: the pane is still unobserved before /send`
> `boot-race fixture: the pane is still unobserved before immediate /send`
> `observed-pane fixture probe: the printing harn process is really alive`  (detail: `zsh,sh`)
> `a pane that already printed takes the unchanged no-delay send path`  (detail: `200 3191ms`)
> `silent-alive fixture: the pane has still never printed before /send`
> `boot-timeout fixture: the pane is still unobserved before /send`  (detail: an epoch-ms stamp)

Five of them live in `fleet-e2e-harness.ts` (phase 2 and the phase-3 `FLEET_GATE_UNPROBED`
branch), the `silent-alive` one in `fleet-e2e-claude-gate.ts` (phase 1). This is the wrapper the
**land gate** runs as step 4 of `VERIFY_CMD` (`watchdog.sh`), so every sighting is a red land.

**Mechanism, in one sentence: `lastOutput` is not a readiness signal — tmux stamps it on the
pane's first repaint, seconds before the agent process exists.** That is not new knowledge here;
it is what `94b1362` *proved*, using this very family's `silent-alive` fixture as the evidence —
its stand-in (`claude-hang.c`, `for (;;) pause();`) prints nothing by construction and got a
timestamp anyway. `94b1362` therefore moved the boot-wait decision in `sendText` off `lastOutput`
and onto a process probe (`paneAgentAt`) plus an `openedAt` freshness window. **The fixtures did
not follow.** Re-read at `4614da8`: `sendText` (`server.ts#sendText`) does not mention `lastOutput`
anywhere — the four `lastOutput === 0` lines were preconditions for a code path that no longer
exists, asserting a *negative* the fixture does not own and a repaint can destroy at any instant.
(Three of the four went in the first cut; the fourth, `boot-timeout`, is the correction below.)

`silent-alive` was the worst of them, because it destroyed its own precondition while establishing
the other: `awaitAgent(9, "alive")` polls up to **20 s** for the liveness half, and every one of
those seconds is a chance for the `lastOutput === 0` half to die. Twenty seconds also exceeds
`SEND_BOOT_FRESH_MS` (15 s) — past which `sendText` skips the readiness branch entirely, so the
fixture's fast result would have proved *staleness*, not the no-settle path. A green row for a
thing never measured.

**Base rate: disjoint failures on a byte-identical tree — the §11.2e proof shape, not the §11.3
one.** Session 49, 2026-08-10, quiet machine, serial, same tree (lane `3546db8`):

| run | source | FAIL(s) |
|---|---|---|
| 1 | land gate | `boot-race fixture: the pane is still unobserved before immediate /send` |
| 2 | suite run directly, 109 PASS | `observed-pane fixture probe: the printing harn process is really alive` · `a pane that already printed takes the unchanged no-delay send path` (`200 3191ms`) |

Two runs, three FAILs, **no check in common**. Four further sightings, all of the same class, all
cleared by the §11.3 order (re-run the same tree), each having held up a land:

- 2026-08-09, session 46: `silent-alive fixture: the pane has still never printed before /send`
  (1786260763914) and `unprobed fixture: the pane is still unobserved before /send` (1786268459843).
- 2026-08-18, the two rows already tabulated in §11.2c-bis, both `unprobed fixture: …`: the P6
  lane's own gate chain (rerun `PASS … (0)`), and the **live land gate for P8** on `6f3b3e8`
  (`verify.ok:false`, 107 s, exit 1, 1 FAILURES; rerun `ALL PASS`, 116 PASS). The second downgraded
  a clean rebase to `resolved/landed:NO` and the tree went in by confirm-land.
- 2026-08-19, **after** the first repair cut: `boot-timeout fixture: the pane is still unobserved
  before /send`, FAIL detail an epoch-ms stamp, on a **live land gate** (retained instance
  `fleet-e2e-gate-instance-32527`). The identical serial re-run failed identically; the following
  A/B chain then ran 4/4 green on both trees. Non-deterministic, fixture inheritance, no code
  regression — and the sighting that proved the first cut had left one member standing.

Eight sightings across five dates, ~1–2 FAILs per affected run — which is what made every land
review-bearing; the commissioning queue line reports at least three lands lifted over such a red
with `{confirm:true}` (not re-measured here).

Run 2's two FAILs are **one root, not two** — the same shape §11.2c and §11.2e both have. The
`harn-observed` stand-in sleeps 3 s and only then execs `harn-print`; `awaitObserved` waited on
`lastOutput > 0`, which the pane's first repaint satisfies immediately. The fixture therefore sent
while the pane still held only `zsh,sh`, so the process probe found no agent (FAIL 1) **and**
`sendText` correctly took the readiness-wait branch, returning in 3191 ms — just past
`SEND_BOOT_WAIT_MS` = 3000 (FAIL 2). Both lines accused the product of a regression that had not
happened.

**Repair, cut 1 (`889bbe1`, 2026-08-19) — five of the six checks. Two halves, and both are
needed.**

- **(a) Establish the precondition instead of asserting it**, each time on the quantity the code
  actually reads. `silent-alive` polls the pane's own process tree directly (`awaitPaneComm`)
  rather than the git-tick cache, which lags up to 10 s and spends exactly the freshness window the
  fixture needs; the cached reading stays as *corroboration*, moved to **after** the send, where it
  cannot race. `observed-pane` polls the pane for the stand-in's own ready line
  (`awaitPaneText`, `harn-observed-ready`), which proves both halves at once — the pane HAS
  printed, and the printer IS the declared agent, because `harn-print` emits that line only after
  its exec. `boot-race` and `unprobed` wait for nothing at all any more; the `unprobed` branch
  sends **first** and asserts afterwards, since an empty comms declaration is a server boot fact
  and a freshness window only shrinks. The fixtures' sleep budgets are now *read out of the
  installed stand-in* (`fixtureSleepMs`) instead of copied from `e2e-claude-gate.sh`.
- **(b) Carry each precondition as its own `check()` and skip its dependants** — the form
  `d695e7e` built for `e2e/restart.ts` and `8e2b3e5` for the `awaiting` probe; this is that class's
  third site. Four new named rows: three times "the send falls inside the boot-freshness window"
  and once "the send began before the stand-in exec'd its agent". A precondition that runs out is
  still **red** — but red under its own name, and the product check stays silent instead of
  reporting a regression that never happened.

**The implicit time budget is now explicit and argued.** `observedElapsed < 1000` was a bet against
a shared machine, and it is what read `3191ms`. Both no-delay budgets are 2000 ms, stated against
the constants they are about: `SEND_BOOT_WAIT_MS` = 3000 and Claude's `bootSettleMs` = 2500. The
250 ms `DEFAULT_BOOT_SETTLE_MS` is **not** separable from this machine's noise — the comment says
so rather than pretending; that branch is excluded by the *precondition* (`sendText` settles only
when its first probe found the agent absent, and these fixtures prove it present) and not by the
clock. Alongside it a clock-free second opinion on the **path**: `sendBootTimeouts()` reads the
`send_boot_timeout` audit row that only the timeout branch writes. It can structurally produce only
a false PASS (an unflushed row reads as absent, and the budget catches that case), never a false
FAIL.

**Nothing was removed or weakened.** The three `lastOutput === 0` lines this cut reached were
replaced by *stricter* preconditions (a live process instead of a cache reading, printed bytes instead of a repaint
stamp), four named rows were added, and the two time windows grew from 1000 to 2000 ms with the
reasoning written down — both still below the smallest regression they can separate.

**Proof that the new handling bites, which a green run cannot give.** A deliberate sabotage run
(2026-08-19) broke two preconditions on purpose: a 2500 ms sleep pushed the `boot-race` send past
the stand-in's 2000 ms pre-exec window, and the `observed-pane` establishment budgets were set to
0. Result — three FAILs, **all three precondition/probe rows under their own names**, and **zero**
product rows emitted at all:

```
FAIL  boot-race fixture precondition: the send began before the stand-in exec'd its agent  (2800ms of 2000ms)
FAIL  observed-pane fixture: the stand-in printed its ready line into the pane  (ready line never appeared)
FAIL  observed-pane fixture probe: the printing harn process is really alive  (zsh,sh)
```

The middle row is the session-49 failure re-created; the third is byte-identical to it, `zsh,sh`
and all. Under the old fixtures that same state produced `a pane that already printed takes the
unchanged no-delay send path (200 3191ms)` — an accusation against `server.ts`. It now reads
"the fixture could not set itself up", which is what actually happened. One line of the same run is
worth keeping as an epitaph for `lastOutput`: while `harn-print` had provably never run,
`observed-pane fixture: Fleet recorded the pane's first output` **PASSED**.

**Repair, cut 2 (2026-08-19, this commit) — the sixth check, which cut 1 walked past.**
`fleet-e2e-harness.ts` carried one more `lastOutput === 0` line, in the `boot-timeout` fixture
(the `harn-never` stand-in: `sleep 6`, no `exec`). It is the same construction fault verbatim —
`slotLastOutput(10) === 0`, a negative the fixture does not own — and it survived because cut 1 was
scoped by the five *sighted* check names rather than by a sweep for the anti-pattern. It cost a
land gate nine days after the mechanism was written down.

The repair is cut 1's own handwriting, applied once more:

- **Establish, don't assert.** The line is replaced by the quantity `sendText` really reads. Its
  boot branch turns on `openedAt` alone (`server.ts`, `mayStillBeBooting`), so the fixture now
  stamps its own clock before `POST /api/slots/10/open` and states, under its own name,
  `boot-timeout fixture precondition: the send falls inside the boot-freshness window`
  (`${elapsed}ms of ${SEND_BOOT_FRESH_MS}ms`) — this process's two timestamps against a server
  constant already mirrored in the file, which nothing outside the process can destroy. The
  existing process probe stays exactly where it was: "no `harn` under this pane" is a property of
  the `harn-never` **source**, not of a repaint.
- **Skip the dependants.** The four rows that only mean something on the timeout branch — bounded
  send, `paneEnv` verdict, delivered bytes, `send_boot_timeout` audit row — now sit behind
  `if (timeoutInWindow && timeoutUnexec)`. Outside the window `sendText` skips the readiness branch
  entirely: the send would return at once with no audit row, and all four would have accused
  `server.ts` of a regression that never happened.

The family's check count is unchanged at seven for this fixture (one assertion out, one named
precondition in); no product check was touched, and `slotLastOutput` stays — `awaitObserved` is
still an honest reader of it.

**Residual risk, named.**

- The 250 ms default settle remains unmeasurable by these checks; a regression that made an
  established pane pay *only* that settle would pass. It is excluded by construction, not observed.
- The preconditions are now facts this process owns (its own two timestamps, a window read out of
  the fixture, a directly polled process tree), so a red one means the machine is genuinely too
  slow — a real signal, and it costs a land. Margins measured on the repaired tree are wide:
  `silent-alive` 323 ms of 15000, `boot-race` 297 ms of 2000, `observed-pane` 4069 ms of 15000,
  both no-delay sends 189 ms of 2000. Cut 2's `boot-timeout` margin over three serial runs:
  296 / 276 / 276 ms of 15000.
- `sendBootTimeouts()` is duplicated in the two phase harnesses. They are separate single-file
  programs sharing only `e2e/harness.ts`, and the shared module was outside the repair's surface.
- Cut 2 is evidence that a name-scoped repair leaves members standing. The mechanical guard against
  a seventh is a grep, not a memory:
  `rg -n 'lastOutput === 0' fleet-e2e-harness.ts fleet-e2e-claude-gate.ts | rg -v '^[^:]*:[0-9]+:\s*//'`
  must stay empty — the three surviving hits are all *comments* saying the line is gone, and the
  filter is what separates them from a returning assertion. It is empty as of this commit. No pin
  enforces it: `e2e/pins.ts` was outside this cut's surface.

**No free pass.** Eight sightings make the family real; they do not make the next red send-boot
check a flake. After this cut a red one has one fewer excuse, not more — and the four precondition
rows are there precisely so the next red says which it is.

### 11.2g Re-filing the `lines=0` §7 sightings, and a ninth family in `e2e/slots.ts` (2026-08-26)

**Correction to a filing in this file.** Three sightings of
`§7 fixture: the land gate actually ran on this lane's tree (the stand-in announced itself)` with
detail `lines=0` (two red post-land audits on 2026-08-25/26, adjudicated `flake` at
`1787690960427` and `1787698917832`, plus run 1/2 of the V1b lane, report `f37ecd8594c0`) were
adjudicated under **merge/resolver (§11)**. The repair lane read `server.ts#mergeJob` instead of
inferring and found the true mechanism one level up: both §7 drive loops broke on
`j.running || j.last !== null` — the first sign of ANY settled outcome — but three merge exits set
`last` without the gate ever running (the author hand-off returns before the verify site; a halted
pre-pass lands as `error`; a ⏸ hold answers with a verdict this run never wrote). At
`last !== null` those three are indistinguishable from "the gate ran and was red". So the fixture
read an empty gaterun file as *gate broken* when it meant *never measured* — the §11.2f form
(**a fixture asserting a precondition it does not control**), with the merge verdict as the
uncontrolled object instead of the pane. The adjudications stand as flake; their family
attribution is corrected here.

**Repaired in `7875c19`** (`e2e/verify-queue.ts` only): `driveMergeUntil(slot, reached)` polls the
GOAL itself and re-fires the merge on an early-settled verdict instead of breaking, capped 4×30 s
so a lane that structurally never reaches the goal ends as a FAILED PRECONDITION under its own
name, quoting the protocol of every short-settled attempt. Mutation-proved: a stand-in that runs
but never announces produced exactly the historic signature and exactly 2 FAILURES, both
precondition checks under their own names; reverted, then full chain + isolated serial:
3553 PASS / 0 FAIL.

**The ninth family, counted and not asserted** — §5b's three, merge/resolver (§11.2),
reseed+live-bytes (§11.2b), the `stalled` race (§11.2c), the 💾-commit idle gate (§11.2e), the
send-boot fixtures (§11.2f) — eight; this is the ninth, and it was **open** when this section was
written. Signature, verbatim, in `e2e/slots.ts` (isolated suite, send-receipt/uncertain group):

> `a send whose transport threw answers 409 with an uncertain receipt`

and its two group siblings falling with it. Mechanism, measured by the K2 lane (2026-08-26, tree
`b364048`): the fixture line PASSes (`has-session=1 cwd=false`), and 51 ms later `/send` still
returns `200 delivery:"sent"` — the self-heal won the race against the deliberately deterministic
throw. Same §11.2f form: a precondition asserted, not controlled. Base rate from the trail: the
same three fell identically on clean tree `7a3a253` (2026-08-23, `dirty:false`, no ancestor
relation), 2 fails per 146 runs each. Proof for the K2 sighting: same tree serial re-run ALL PASS.

**REPAIRED 2026-08-26 in `4bde073` (`e2e/slots.ts` only). The family stays listed; its status is
closed.** The
root was one sentence of the fixture's own comment that was simply untrue: *"its cwd removed, so
the 2s self-heal cannot rebuild it (`tmux new-session -c <gone>` fails)"*. Measured on tmux 3.6a,
`new-session -c` whose directory is gone does **not** fail — it silently falls back to `$HOME` and
returns 0. So the heal always succeeded; the check only ever won a ~50 ms race against a 2 s tick,
which is exactly the ~1.4 % base rate the trail recorded. The throw was never deterministic and the
"deliberately deterministic" claim was the defect.

What controls the heal now, instead of outrunning it: `server.ts#ensureSlot` rebuilds **only when
`has-session` fails**. With `remain-on-exit` set on the window and the pane's process SIGKILLed,
the *session* survives with a *dead pane* — `has-session` answers 0, so every heal tick is a no-op
for the whole measurement, while `paste-buffer -t s3` answers non-zero (`target pane has exited`)
and `sendText` throws. Nothing in the server respawns a dead pane. The occupant row is untouched, so
the receipt's `openedAt` attribution is preserved without killing anything. Both halves are asserted
under their own name (§11.2f form) — `send-receipt fixture: the pane is DEAD while its session
survives — the self-heal cannot fire` — so a precondition that could not be established fails as
ITSELF, never as the route it was built to measure.

Mutation proof (isolated scratch instance, own socket/port, `FLEET_CMD=true`; both forms run with a
deliberate 2500 ms pause before `/send`, i.e. one guaranteed heal tick, which turns the historic
1.4 % race into a deterministic verdict):

```
OLD FORM: precondition[has-session=1 cwd=false] after-2500ms[has-session=0 pane_dead=0]
          /send -> 200 {"ok":true,"receipt":{...,"acceptance":"not-applicable",...}}
NEW FORM: precondition[remain-on-exit=0 pane_dead=1 has-session=0] after-2500ms[has-session=0 pane_dead=1]
          /send -> 409 {"error":"send outcome uncertain: tmux paste-buffer failed — session gone?",...}
```

The old form reproduces the historic signature exactly — its precondition line PASSes and the route
answers `200` anyway; the new form holds its precondition across the same tick and gets the `409`.

**No free pass for the past:** reds in this family before `4bde073` are still adjudicated by the
same-tree re-run rule. A red here **after** it is real and yours.

### 11.2h A tenth family: the owner-token-ambient-use pair reads a land off a row it does not own (2026-08-26, repaired same day)

**Signature, verbatim** — `e2e/programs.ts`, isolated suite, the self-land section's owner-token pair:

> `owner-token ambient use: a BEARER merge on a program lane with a live bound MAIN lands, and is FLAGGED on the note and the trail`

with detail `{"row":"queued", …}`. In every sighting the REST of that detail is already correct: the
land note carries `actor.kind:"owner"`, `actor.via:"bearer"`,
`actor.suspect:"owner-token-outside-board"`, a `mainBefore`/`mainAfter` pair that moved and a green
`verify`, and `audit.jsonl` carries exactly one `owner_token_ambient_use` line naming the task and
the program. **The product half of this check has never failed. Only the row did.**

**Base rate: 7 red in 78 runs (9.0 %), the highest single-check rate on this register.** The check
entered in `52731e2`; its first trail row is 2026-08-24T00:55 Z. Read out of BOTH trail directories
— see "where an audit's trail rows go", below:

- `e2e-trail/` (lane and hand runs): 4 red / 43 — `isolated-20260826T061703Z-58003` (tree `7ffe41f`,
  dirty) · `…095618Z-32591` and `…101836Z-59053` (both tree `93182c6`, dirty) · `…103601Z-32692`
  (tree `28e6f3f`, **clean**)
- `$TMPDIR/fleet-e2e-trail/` (post-land audits): 3 red / 35 — `isolated-20260826T082534Z-25083` ·
  `…084752Z-54784` · `…112127Z-57223` (audit rows carry `tree:null`; by the audit ledger's clock
  these are the runs on `1e0cbd3b`, `8b553849` and `28e6f3f8`)

`msSincePrev` is ≈ 65 s in every one of the seven: the probe's whole 60 s poll cap spent, plus its
fixture. The two group siblings — `owner-token ambient use: the BOARD's cookie channel …` and
`legacy: a Program with NO promotion …` — are 0 red / 78. Same form, more timing margin; not
immunity, which is why both halves of the pair are repaired below. (The `legacy` sibling went red on
the very first run AFTER that repair, and for a reason the repair introduced — see 11.2h-bis.)

**Mechanism.** `POST /api/tasks/:id/dispatch` answers as soon as `server.ts#dispatchTask` has the
lane standing and the row at `sent`. The founding brief is delivered by a DETACHED tail — the route
takes the promise as `tail` and only `.catch()`es it. That tail (`server.ts#briefAndSend`) sleeps
4000 ms and THEN re-checks the lane identity (`free.cwd !== wt.path || free.worktree?.branch !==
wt.branch || next.slot !== free.id`). A mismatch runs its `requeue`: `status:"queued"`, `slot:null`,
note overwritten to `slot changed during spawn — requeued; lane kept (…)` — straight over whatever
`server.ts#landLane` had written, and nothing writes it back, because landLane marks only rows that
are still `sent`.

Nowhere else in this file does a land finish near that window. This pair does — measured 4.0–4.9 s
after dispatch (dispatch → one commit → `waitDoneLooking` → an owner ff-merge whose gate is a 22 ms
stand-in) — so the land and the tail collide, and the lane the tail comes back to has been torn
down by the probe's own land. **The failing run says so in its own ledger**: in the kept instance of
`isolated-20260826T082534Z-25083`, the flagged lane `fleet/260826083706-91f2` has `briefHash: null`
on its `landed` outcome row and NO row at all in `context-receipts.jsonl`, while its cookie sibling
`fleet/260826083812-b4d6` in the same run has both — and that sibling's receipt is stamped 4.25 s
BEFORE its own land. The brief was never delivered to the flagged lane; the requeue took its place.

Nothing in production reaches this shape — a real lane is landed minutes after it is dispatched,
not seconds — so the tail is left exactly as it is.

This is the **§11.2f form** — a probe asserting a settled verdict it does not control — with the
TASK ROW as the uncontrolled object. The row is not a carrier of "this landed" that a fixture may
read. The integration branch is, and so is the note the server writes on it — but those are TWO
facts, not one: `server.ts#recordLand` writes the note AFTER `advanceIntegration` has already moved
main, and a probe that reads the note the moment main moves races that gap (measured on a scratch
instance: a read ~190 ms after the ref move finds no note). The same holds for the trail row —
`server.ts#audit` queues its line on an append chain rather than writing it inline.

**Repaired in `70698a7` (`e2e/programs.ts` only).** `driveLand(slot, before, fire)` fires the
merge exactly once — the flag is written when the ROUTE is entered, so a second POST would write a
second trail row and make the count unreadable — and then polls the GOAL: the integration branch
moving off the tip the probe itself recorded. Bounded at 60 s, with every terminal short of the goal
kept and quoted (a settled verdict, a refused POST, a slot that is gone). `landNote(sha)` and
`ambientReach(n)` wait for the two lagging facts instead of sampling them. A land that did not
happen now fails as a named FIXTURE check — `owner-token ambient use fixture: the BEARER merge
LANDED — main moved off the tip this probe recorded` — and the product check under it does not run,
so a fixture that could not be built can never be read as "the flag is missing". Both halves of the
pair carry the identical repair. The row is not asserted anywhere; that claim is already carried by
the self-land checks earlier in the same file, whose lands are minutes clear of the tail.

**Mutation proof** (isolated scratch instance, own socket/port, `FLEET_CMD=true`; the ONE controlled
variable is when the merge is fired, relative to the tail's 4000 ms sleep):

```
FAST arm — merge fired at t+3.2s, so the land completes INSIDE the tail's 4000 ms sleep
  row timeline: t+  85ms sent   note="lane fleet/260826124240-e9d7"
              | t+3658ms done   note="landed (fleet/260826124240-e9d7)"
              | t+4038ms queued note="slot changed during spawn — requeued; lane kept (git status …"
  OLD FORM FAIL after 60675ms — detail {"row":"queued"}
  NEW FORM PASS after   260ms — main 018aedaa->39617304 note.branch=fleet/260826124240-e9d7
  (round 2, identical: done at t+3592ms, queued at t+4065ms, OLD FAIL 60786ms, NEW PASS 315ms)

SLOW arm — merge fired at t+8.0s, so the tail has delivered and returned first
  row timeline: t+  47ms sent | t+8590ms done note="landed (fleet/260826124506-7d3b)"   [no third state]
  OLD FORM PASS after 45ms — detail {"row":"done"}
  NEW FORM PASS after 317ms — main 18146075->878a19e0 note.branch=fleet/260826124506-7d3b
  (round 2, identical)
```

The FAST arm reproduces the historic signature exactly and DETERMINISTICALLY — both rounds, the
same 60 s burn, the same `{"row":"queued"}` — and it also names the requeue path out loud in the
row's own note. The SLOW arm is the control: move the land 4 s later and the old form passes, with
nothing else changed. In all four the NEW form answers in under 320 ms with the land it drove.

**Proof order: cross-tree, not same-tree.** §11.3's same-tree re-run does not clear this one, and
did not: on tree `93182c6` it fell in two runs and passed in a third (`…093315Z-79108`) — at a 9 %
rate a same-tree pair can come back either way. What identifies the family is the spread above
(four trees, one clean, no ancestor relation to one change) plus the failing detail's own evidence:
**a red whose note and trail row already show the product working is a probe defect until proven
otherwise.**

**And where an audit's trail rows go, because this section needed them.** The post-land audit runs
its suite inside a git-less snapshot of the integration tip (`server.ts#runPostLandAudit` →
`snapshotIntegrationTree`, under `$TMPDIR/fleet-postland-audit-*`), so `e2e/trail-emit.ts`'s
`sourceTree()` resolves nothing and the trail falls back to `$TMPDIR/fleet-e2e-trail/` with
`tree:null` on every row. **This is why the git context of 2026-09-05 (§7) is the short
chain's alone:** `resolveSourceTree` follows the staged instance's `node_modules` symlink and asks
the target `rev-parse --is-inside-work-tree`. A `.git` in the snapshot would answer YES, `defaultDir()`
would put the trail inside a directory the server deletes when the audit ends, and the flake register
would silently lose exactly the runs that adjudicate a land. The short chain writes no trail rows at
all, so it can have its index and this paragraph stays true. **A §11.6 query over `e2e-trail/` alone therefore silently omits every
post-land audit run** — here, 3 of the 7 sightings, i.e. the run that ADJUDICATES a land is the one
a flake query cannot see. Same trap as the gitignore-blind `rg`: the answer comes back empty, and
empty reads as "it did not happen". Both directories, or the number is wrong.

**Superseding the filing that motivated this section.** Queue note `9a83554e` proposed that these
reds were a fixture race opened by the verdict-delivery land `052da8e` (the verdict typing into the
lane pane, moving the settle). They are not. The earliest sighting,
`isolated-20260826T061703Z-58003`, ran on tree `7ffe41f` (committed 07:23 local) — a tree that does
not contain `052da8e` (committed 09:21 local), so the red existed two hours before the suspected
cause did. The mechanism is entirely in the probe and no undo is owed. The note's §11.2f
classification and its prescription — control the settle, `driveMergeUntil`-style — were right.

**No free pass for the past:** reds in this family before `70698a7` are still adjudicated by the
same-tree/cross-tree rule above. A red here **after** it is real and yours.

### 11.2h-bis The third instance, and the repair above is what opened it (2026-08-26, repaired same day)

**Signature, verbatim** — same file, same section, the check immediately downstream of the repaired
pair:

> `legacy: a Program with NO promotion lands the ordinary owner way, and its own MAIN's self-land door refuses with the absent-policy sentence`

with detail `{"outcome":null,"selfLand":"{\"error\":\"no self-land promotion on this program (absent) — …\"}"}`.
The `selfLand` half is the exact sentence the check demands; only the ledger row is missing.

**Rate: 1 red in 1 run — every run of this check that carries `70698a7` is red.** The trail holds 36
runs of it across both directories; 35 predate `70698a7` (landed 14:46 local) and are green, and the
one after it — `isolated-20260826T130627Z-25331`, a post-land audit, check at 15:18:14 local — is
red. `msSincePrev: 20`. The 9.0 % framing in 11.2h above does not apply here: this is not a rare
collision, it is a read that now happens too early **every time**, and the single red is simply the
only run there has been. (And it is again visible only in `$TMPDIR/fleet-e2e-trail/` — the
post-land-audit trap 11.2h closes with, paid a second time within the hour.)

**Mechanism: the repair moved this arm's read point ACROSS the fact it reads.** The wait
`70698a7` removed was "poll the task row until it is `done`". `server.ts#landLane` stamps that row
in a loop that runs *after* `emitLaneOutcome`, so everything downstream of that wait read a
lane-outcomes ledger the server had necessarily already written. The wait that replaced it is
`landNote(sha)` — and `server.ts#recordLand` writes the note the moment `advanceIntegration` has
moved main, i.e. BEFORE `landLane` is called at all. Between the two sits landLane's
`buildLaneOutcome`: half a dozen `git` subprocesses (`diff --shortstat`, `rev-list --count`,
`diff --name-only`, the owner-prompt scan, the review read, the transcript read) before the line
reaches the append chain. The ledger read fired ~20 ms behind the note check and the row was not
there yet. Nothing about the product changed; the probe simply took the earlier of two carriers and
kept reading the later one.

**Not the `briefAndSend` requeue.** The 11.2h root cannot produce this shape, and the code says why:
`requeue` runs only when `identityLost()` — and the identity is only lost once `landLane` has
already killed the slot, i.e. after the outcome row is out. Confirmed on the scratch instance: with
the land driven INSIDE the tail's 4000 ms sleep, the tail found its identity intact, delivered the
brief normally, and the row ended `done` — the ledger row was late all the same.

**Repaired in `e2e/programs.ts` only:** `landedOutcomeOf(taskId, ms = 20_000)` — the FOURTH lagging
fact of this land, waited for on the same 120 ms cadence and bounded like `landNote`/`ambientReach`
beside it. `undefined` after the cap stays a real answer and the check quotes it, so a land that
truly produced no row still fails as itself. The two repaired probes above are untouched.

**Mutation proof** (scratch instance, own socket/port, `FLEET_CMD=true`, one task dispatched into a
lane, one commit, an owner Bearer ff-land; BOTH readings taken in the same run, so the only variable
is the probe form):

```
                       OLD FORM (sample once, right after the note)   NEW FORM (bounded wait)
FLEET_TEST_LAND_PAUSE_MS=0      FAIL  outcome=null   x6                PASS  x6
FLEET_TEST_LAND_PAUSE_MS=20000  FAIL  outcome=null   x5                PASS  x5
measured gap, note readable -> ledger row readable (the 5 instrumented runs of the 11):
  229 / 244 / 245 / 244 / 128 ms
```

`FLEET_TEST_LAND_PAUSE_MS` (`server.ts#LAND_PAUSE_MS`, the product's own TEST-ONLY knob) sits between
`advanceIntegration` and `recordLand`, so at 20 000 the note appears 20 s after main moves. The gap
measured after it is unchanged — which is the point of that arm: the window is anchored to
note→`landLane`, not to the merge job's own timing, and no amount of latitude before the note closes
it. Eleven runs, eleven times the same verdict; the old form never once got in ahead of the append.

**The general lesson, and it is the third time this file states it:** when a probe stops waiting on
one carrier of a fact and starts waiting on another, the new carrier's position in the server's own
write order is part of the change. Here the two carriers bracket the write the check downstream
depends on. Moving a wait is never a local edit — the read points BELOW it move with it.

### 11.2i An eleventh family: the suite-server PHASE RESTART races the dying tmux server (2026-08-27, filed — NOT repaired)

**Status: open.** Filed from a live triple-proof; the fix is proposed, not built. A red on these
lines is still a flake candidate until someone lands the wait — after that land, this section gets
its repair stamp and a red there is ECHT again.

**The mechanism, one root with two known mouths.** Both `e2e-clean-review.sh` (phase 1 → 2 handover,
`tmux kill-session -t srv` immediately followed by `new-session` on the same socket/port, lines
~127–137) and `e2e-claude-gate.sh` (phase 2 → 3, `kill-server` directly before `new-session`,
~255–257) restart a suite server with NO wait between the kill and the spawn. When the `new-session`
client catches the tmux server mid-death, tmux itself answers `server exited unexpectedly` (that
string exists nowhere in this repo — it is tmux's, and its presence in a suite's stderr is this
family's fingerprint). The phase then waits its bounded 30 s on a bind that never comes and runs on,
so the red reads as "server did not come up" with **zero failing checks**.

**Post-mortem discriminator, two shapes.** (a) claude-gate mouth: NO `server.log` in the preserved
instance — the §-known "nie gemessen" signature (`fleet-e2e-unprobed-instance-85260`, checked: zero
`*.log`). (b) clean-review mouth: `server.log` EXISTS but carries only the PRIOR phase's lines — the
restarted server never wrote one line. Both mean the pane never executed its command; neither is a
code verdict.

**The proof, §11.7 order (same tree re-run first, no HEAD excursion).** Tree `c098d87` (P0: two
files, `.claude/skills/mess-notiz/SKILL.md` + `docs/messungen/INDEX.md` — no `.ts`, no `.sh`, no
line any suite server reads), three runs: (1) land gate — died at claude-gate phase 3, no
server.log; (2) lane re-run, full local chain — died at clean-review phase 2 shadow, server.log
with only phase-1 lines; (3) lane serial re-run — clean-review (both phases), security, claude-gate
(all three phases) **ALL PASS**. Two runs of one tree died at two DIFFERENT places, the third at
none: non-determinism proven directly. Contention raises the hit rate (run (1) spent 31 s of 181 s
waiting on `/tmp/fleet-e2e.lock`; a foreign `e2e-isolated.sh` was live), but the race exists
without it.

**A fourth sighting, mouth (a), same proof order** (2026-09-01, lane `fleet/260901000515-51a3`,
tree `ba4169a` + the §11.2k test patch — `e2e/outcomes.ts` and this file, nothing any suite server
reads): the full gate chain died at claude-gate phase 3 with `server exited unexpectedly`, zero
FAIL lines and six `ALL PASS` before it, and the kept instance
(`fleet-e2e-unprobed-instance-80702`) carried **no `server.log`**. Immediate re-run of the same
chain on the identical tree: `GATE_EXIT=0`, 0 FAILs. The family's hit rate is not negligible — this
was one of two chain runs.

**Proposed fix (not built; suite edits were out of the finding lane's mandate):** before each
`new-session` that follows a kill on the same socket, wait for `tmux has-session` to report the old
server actually gone (bounded), instead of racing the death. Two call sites, one guard.

**Bookkeeping:** this is the eleventh family (three in §5b · §11.2 · §11.2b · §11.2c · §11.2e ·
§11.2f · §11.2g · §11.2h — ten before this). `CLAUDE.md`'s "Zehn bekannte Flake-Familien" is one
short as of this filing; the rulebook line is a generat (`rulebook.ts`) and is NOT updated by this
docs-only commit — noted in the 2026-08-27 handoff as a pending rulebook edit.

### 11.3 Correction to the prescribed proof method

`CLAUDE.md` tells a lane to clear a suspected flake with **a fresh HEAD worktree, same check,
serial**. On this evidence that prescription is both weaker and more expensive than re-running the
same tree:

- **Weaker.** A green HEAD run cannot distinguish "our regression" from "a flake that did not fire
  this time". Mine was green and I concluded regression — wrongly, and with the whole land blocked
  on it.
- **More expensive.** It needs a second checkout and a second `bun install`; the same-tree re-run
  needs neither.

Same-tree-twice should be the primary instrument, the HEAD worktree the fallback for when the
same-tree re-run keeps failing identically — which is the case where it genuinely is yours.

### 11.4 The measurement that nearly voided the proof

`ps aux | grep -c "[e]2e-isolated.sh"` counts the **zsh wrappers whose command line contains the
script**, not the runs. It reported "2 foreign suites" while exactly one real suite was live. The
filter that answers the question asked:

```sh
ps -eo command | grep -c '^/bin/sh ./e2e-isolated.sh'
```

Lane C hit this and, on its strength, disowned a proof that had in fact been serial — the right
conclusion ("not proven") from a wrong measurement. Two lanes were also reported as running the
suite without taking the lock; the lock is a convention carried in each brief, so any lane that is
briefed without it silently breaks everyone else's serial proof.

### 11.2j A twelfth family: the `pi-unfenced` watch-delivery quartet (2026-08-31 filed; 2026-09-01 MECHANISM ISOLATED and repaired test-side — the fixture sampled a by-design transient; 2026-09-05 die verbliebene WURZEL liegt im SERVER und ist REPARIERT, `c36c1e9` + `1db9296`)

**Status (2026-09-01, corrected — this paragraph read "open, CAUSE not proven" until the repair
landed): MECHANISM ISOLATED and repaired test-side in `b20e7e4`.** The two cuts are further down
in this section; everything between here and them is the FILING as it stood, kept because the
measurement series is what made the mechanism findable. Filed from the Generalsanierung P0
baseline, where it cost the baseline itself. What is still open is named at the end: the seventh
member's contradictory double reading, now self-resolving on its next occurrence.

**The members.** Four checks that fail together, plus one that joins intermittently:

- `after kill-switch release the pending event reaches live pi-unfenced once as delivered, never
  acked by tmux` — the event stays `send-uncertain`, `deliveredAt:null`, `attempts:0`
- `the fixed completion notification has exactly one matching prompt-log row on pi-unfenced` — 0 rows
- `the pi-unfenced event remains one-shot across later ticks and never records the old skip`
- `rollback live falsifier: recycled slot identity leaves the successor owner's draft byte-for-byte`
- intermittently: `subject-gone: the torn-down lane's undelivered event is terminal as itself,
  unackable, and frees its budget`

One delivery that never arrives drags its neighbours with it — the cascade shape of §11.2c and
§11.2f. The last member is the same check that showed up in the red post-land audit of
`bc9e7de3` (2026-08-31 handoff), so that audit is very likely this family too, not three separate
defects.

**The measurement: four serial `./e2e-isolated.sh` runs, CODE delta null across all four.** Only
`docs/` and `AGENTS.md` moved between them; no `.ts`, no `.sh`.

| Run | HEAD | tree dirty | Program-MAIN (slot 10) | PASS | Result |
|---|---|---|---|---|---|
| 1 | `6f173d7` | no | not yet active | 3349 | **ALL PASS** (1639 s) |
| 2 | `00d9b58` | yes | working in the checkout | 3345 | 4 FAILURES (1583 s) |
| 3 | `acf3614` | yes (untracked doc only) | working in the checkout | 3344 | 5 FAILURES (1584 s) |
| 4 | `ce24b0d` | no | **deliberately idle** | 3349 | **ALL PASS** (1544 s) |

**What this proves, and it is the §11.7 proof order satisfied:** identical code, two green and two
red ⇒ **non-determinism is proven directly, and the family is NOT a code regress.** Both green runs
land on the same 3349 PASS.

**What this does NOT prove, and the entry must not be read as if it did:** the discriminator.
Across runs 1–4 two variables co-varied perfectly — the tree being dirty, and a Program-MAIN
actively working in the main checkout. **A fifth and a sixth run were then run to separate them,
and BOTH readings that stood here first are now refuted:**

| Run | HEAD | tree dirty | controller | loadavg at start | Result |
|---|---|---|---|---|---|
| 5 | `dc75c32` | no | idle | 2.15 | RED — **one** check, `e2e/outcomes.ts`, NOT this family |
| 7 | `5cef1b7` | yes (one untracked `docs/` file) | idle | 2.39 | RED — this family, 5 members |

- **Refuted: "an idle controller yields green."** Run 7 fired the full family with the controller
  deliberately idle and zero neighbouring suites. Controller quiet is NOT sufficient.
- **Refuted, and structurally so: "a dirty source tree is the cause."** It cannot be. The staging
  copies only the import closure plus `public/`, `package.json` and `$STAGE_EXTRA`
  (`e2e-stage.sh`), `e2e-isolated.sh` copies exactly FOUR named `docs/` files by explicit `cp`,
  and the staged directory is then `git init && git add -A && git commit` — **always clean at
  init**. Verified at the kept instance of run 7: the untracked marker file is absent from it and
  the staged `docs/` holds only the four closure files. The dirty/clean correlation over six runs
  is coincidence with no mechanism, and is retracted.

What survives is weaker and worth saying plainly: **the family fires non-deterministically under
conditions nobody has yet distinguished.** The one numeric handle recorded so far is machine
loadavg at run start — 1.53 on the green run 4, 2.15 and 2.39 on the two reds — which is three
data points and therefore a hint, not a result. Anyone extending this section should record
loadavg per run and stop reasoning about the tree.

A separate observation that must not be folded in: run 5's single red (`outcome: a reviewer answer
that did NOT parse is persisted as raw:true`, state `none`, `e2e/outcomes.ts`) fired on a CLEAN
tree with an idle controller and is not a member of this family. Whether it is its own family or a
one-off is unmeasured.

**Addendum 2026-09-01 — the mechanism, one level deeper, read from the kept instance of run 7
(`fleet-e2e-instance-4110/server.log:135-142`):** the event is CREATED for its receiver
(`watch 4817e6b3: created event ee1a8e8f… for slot 7`, line 139) and immediately afterwards the
receiver's tmux session is RECREATED — twice (`slot 7: created tmux session 's7'`, lines 140/142).
The heal replaces the occupant, and `server.ts#recoverFleetReportDelivery` then terminalizes the
event with its own words: "receiver occupant ended or was replaced before recovery". The cascade
is honest bookkeeping over a dead receiver; the open question is WHY the fixture's receiver pane
dies. That is the §11.2f genus — a fixture asserting a live receiver it does not control — and the
plausible repair is test-side: hold the receiver pane alive for the check's window, or make the
probe fail AS ITSELF when the receiver pane died. Filed for a lane with its own criterion; until
that lands, this family stays open.

**Sixth member, seen first in run 7:** `subject fixture: both lane completions minted one pending
event each on the busy receiver` — the fixture that establishes the family's own precondition,
which makes the cascade read one step earlier than in runs 2–3.

**Seventh member, and an instance that contradicts itself (post-land audit of `01459c9`,
2026-09-01, 3366 checks / 2 FAIL, adjudicated `flake`):** the two failures were
`subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees
its budget` (the registered intermittent member) and, new here, its own counterprobe
`counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is
never typed` (`e2e/watch.ts#counterprobe`, the block immediately below it). Both read the SAME
fact — the doomed event's terminality — and they read it DIFFERENTLY in the same run:

| check | detail as recorded | failing conjunct |
|---|---|---|
| subject-gone | `{"gone":"subject-gone","deliveredAt":null,"attempts":0,"ack":409,"living":"pending","freed":400}` | `freedRes.ok` — the budget was NOT freed (400, still "max 5 active watches per slot") |
| counterprobe | `{"living":"delivered","attempts":1,"doomed":"pending"}` | `finalGone?.status === "subject-gone"` — the same row reads `pending` again |

A row cannot go `subject-gone` and then back to `pending`, so one of the two reads is not reading
the row it thinks it is. That is a NEW handle on the mechanism and it is consistent with the
addendum above (the receiver's pane recreated underneath the fixture), but it is unexplained, and
nobody has looked at which id each read resolved. Whoever takes the test-side repair should start
here rather than at the delivery timing.

**Why `flake` and not `real` for that audit, stated so it can be checked:** the landed commit
`01459c9` touches exactly `src/client.ts`, `public/index.html` and `e2e/tasks.ts`
(`git show --stat 01459c9`). Neither failing check reads any of them: both exercise the
server-side event-delivery and watch-budget path. No same-tree re-run was spent — Owner decision 6
of 2026-09-01 forbids further suite time on this family's discriminator, and the structural
argument does not need one. The counter-case, named honestly: `e2e/tasks.ts` gained 122 lines of
new checks in that commit, and this suite shares slots and panes across families, so an upstream
fixture CAN shift which receiver pane a later family gets. That is a timing coupling, not a
behaviour change, and it is the reason this entry is filed as a seventh member rather than as a
closure.

**Eighth member (post-land audit of `ba4169a`, 2026-09-01, 1/3366, adjudicated `flake`):**
`held: 100+ pre-paste refusals change neither `attempts` nor the owner's composer` — the check
directly upstream of the budget/subject-gone/counterprobe blocks, same fixture complex. Detail
`{"held":100,"doomedAttempts":1,"livingAttempts":0,"draftBytes":45}`: a delivery attempt fired
while the draft was still held, i.e. the receiver pane was replaced underneath the fixture and the
fresh occupant had an empty composer — the exact addendum mechanism, seen one block earlier.
`ba4169a` is docs + comment lines only. loadavg 3.49 at run.

**Correction to that reading, from the repair lane:** the stated mechanism contradicts the quoted
detail. `draftBytes: 45` says the owner draft WAS in the composer at read time, and nothing in this
fixture re-types it — a replaced pane would have shown a fresh stand-in's EMPTY buffer, 0 bytes, and
the check's own `heldDraft.text === draft` conjunct would have failed too. It did not. What is left
is that the two readings of "the composer is occupied" disagreed: transport's pre-paste refusal
reads the RENDERED FRAME (`composerResidue`), while this fixture reads the stand-in's INTERNAL
buffer, and only a frame that did not show the draft at that instant lets `sendText` past the
refusal and raises `attempts`. Cut 1 therefore reads the FRAME here too, beside the buffer, and
prints `frameBytes`/`frameIsDraft` — on the healthy path both carry the draft, and the next
occurrence names which reading failed instead of blaming the pane.

**THE MECHANISM, isolated 2026-09-01 — and it is neither a pane heal nor machine load as such.**
`server.ts#tickWatches` (the `attemptsBefore` block, `server.ts:12066`ff) writes
`event.status = "send-uncertain"` AND `event.attempts++` and **persists them with
`await saveStateNow()` BEFORE it touches tmux**. Only after `sendText` throws `SendRefused` — the
pre-paste "the composer is occupied" refusal — does it roll BOTH back to `pending` /
`attemptsBefore`. Between those two writes sits an entire tmux round-trip. This fixture holds an
owner draft through **100+ consecutive refusals** while polling the event row every 250 ms, so
catching one mid-flight is not a rare accident, and it gets likelier the slower tmux answers —
which is exactly the loadavg correlation this entry recorded as "a hint" and could not explain.

**The measurement that settles it** (run `final-b` of the repair lane's verification, tree
`2e7c846`): `subject fixture: both lane completions minted one pending event each on the busy
receiver` FAILED with `living: "send-uncertain"` — while, in the same run and the same window, the
new instrumentation proved the receiver pane was **unchanged** (`pane %76`, one `openedAt`), the
`hold fixture` read 45 of 45 draft bytes, and the very next check read the same row as `pending`
with `attempts: 0` and BOTH composer readings agreeing (`draftBytes: 45, frameBytes: 45,
frameIsDraft: true`). A replaced pane cannot produce that, and does not have to: the row was simply
read inside the server's own pre-tmux marker window. `send-uncertain` on the refusal path is a
marker the server puts down before it knows, not a fact about delivery.

This also explains the **eighth member** directly — `doomedAttempts: 1` with the draft intact is the
inflated `attempts` of the same transient, read before the rollback — and it is why that member's
"the pane was replaced" reading was wrong. Not explained by it: the seventh member's
`subject-gone` → `pending` contradiction, which is the same GENUS (a row read across a transition)
but has not been caught in the act. Its instrumentation stays armed.

**Repair, cut 2 (2026-09-01): the fixture reads SETTLED rows.** `e2e/watch.ts#settleEvent` waits,
bounded (40 × 250 ms), for a `send-uncertain` row to leave that state before the check reads it, and
is applied to every read of a HELD row: both subject events, both `held:` reads, `stillPending`,
`finalGone`, and the kill-switch `pausedEvent`. Nothing is hidden — a row that never settles is
still returned as `send-uncertain` and still fails its check; only the by-design transient is waited
out. `settleWaits` is printed so the frequency stays visible. No member predicate changed.

**Repair, cut 1 (2026-09-01, test-side only — server.ts and lane-signals.ts untouched).** The
genus is §11.2f: every member asserts a precondition the fixture does not own. Seven checks in
`e2e/watch.ts` sit on one receiver (the `pi-unfenced` stand-in, `uId`) — eight counting the `held:`
member main filed while this lane was running — and not one of them ever
established that it is still talking to the pane it opened on, or that the composer still holds
what the fixture put there. Both are now MEASURED, per window, by `e2e/watch.ts#windowIntact` —
tmux's own `pane_id` plus the server's occupant stamp (`openedAt`) plus `agent === "alive"`, and
optionally the stand-in's internal buffer. Six windows are stamped: the owner-draft hold, the held
refusals, the subject teardown, the counterprobe, the kill-switch release, and the one-shot-across-later-ticks
read, plus the `held:` refusal read that §11.2j's eighth member sits on. When a window breaks, the fixture fails as ITSELF with the recreation named
(`the receiver pane was REPLACED under this window … before=… after=…`) and the member it would have
mis-accused is skipped — the same shape `54bae42` used for §11.2f, and no member predicate was
weakened: every conjunct still stands, it just no longer runs against a pane that is not there.

Two windows the fixture could actually CLOSE were closed. (a) The kill-switch group entered its
window on one `BSpace` and a 100 ms sleep, i.e. on an assertion that the composer is empty. It is
not the group's subject but its precondition: residue makes `sendText` refuse BEFORE the paste, and
`tickWatches`' `SendRefused` arm puts the event back to `pending` and rolls `attempts` to 0 —
exactly the shape the first member reports as "the release never delivered". It now drains to a
window of CONFIRMED emptiness (the slow-paste teardown's own loop, extracted as `drainComposer`)
and checks the result in BOTH readings transport uses, internal buffer and rendered frame.
(b) `rollback live falsifier: recycled slot identity …` compared `successorOpenedAt !== oldOpenedAt`
where `oldOpenedAt` came from an event row that may never have existed — `undefined`, so the
identity conjunct passed WITHOUT ever comparing two identities. That precondition is now its own
named check.

**One mechanism the repair DID pin down, measured on the green runs: the `freed:400` conjunct sits
one event from the cap by construction.** `server.ts#slotDeliveryBudget` refuses when
`deliveryDebts + armedReservations >= cap`, and delivery debts include delivered-but-UNACKNOWLEDGED
events, not just pending ones (`server.ts:6853`). On both green runs the new `budgetAtFree` detail
read `armed: []` and four open debts — three `delivered`, one `pending` — against `WATCH_MAX_PER_SLOT`
= 5. So the block fills to refusal, the doomed row going terminal frees exactly ONE, and
`freedRes.ok` then has a margin of exactly one event. Any additional debt on that receiver inside
that window — an unacked fill delivery landing a beat later — consumes the margin and produces the
unexplained `400`. That is a hypothesis with a probe attached rather than a conclusion: it was
measured on the green path, never yet on the failing one, and `budgetAtFree` now prints the exact
debt list at the instant the door is knocked on, so the next occurrence either confirms it or kills
it. The conjunct itself was deliberately NOT relaxed — a check that stopped asserting the budget is
freed would stop proving the thing it exists for.

The contradictory double reading (§11.2j's seventh member) is not resolved, but it is now
self-resolving on the next occurrence: `subject-gone` and its counterprobe each print the id they
ASKED for, the id of the row they GOT, how many rows currently carry that id, what the earlier read
saw, and a `flippedBack` flag; the `freed:400` prints the receiver's armed watches and open debts
at the instant the door was knocked on.

**Verification (2026-09-01, tree `ac90244`).** Full gate chain green: `bun install --frozen-lockfile` ·
`bun e2e/pins.ts` ALL PASS · `tsc --strict` over the gate's file list exit 0 · `bun run build` exit 0 ·
`./e2e-clean-review.sh` exit 0 (32/0) · `./e2e-security.sh` exit 0 (92/0) · `./e2e-claude-gate.sh`
exit 0 (137/0). Then three serial `./e2e-isolated.sh`, never two suites at once (the `e2e-stage.sh`
mutex serialized them against the live server's own post-land audits and another lane's run):

| run | loadavg at start | result | preconditions | members | `settleWaits` |
|---|---|---|---|---|---|
| cut2-1 | 2.49 | 3373 PASS / 1 FAIL — the FAIL is §11.2k, `e2e/outcomes.ts` | 6/6 | 8/8 | 0 |
| cut2-2 | 4.44 | **3374 PASS / 0 FAIL, ALL PASS** | 6/6 | 8/8 | **1** |
| cut2-3 | 2.49 | 3373 PASS / 1 FAIL — §11.2k again, byte-identical detail | 6/6 | 8/8 | 0 |

**Stated plainly: the letter of the lane's criterion ("three green runs") was NOT met — two of the
three carry one red each. Both reds are §11.2k** (`outcome: a reviewer answer that did NOT parse is
persisted as raw:true …`, singleton `{"state":"none"}`, same log line), a different family in
`e2e/outcomes.ts`, which this lane does not touch at all — its diff is `e2e/watch.ts` and this file.
What the criterion was ABOUT held in all three: every one of the eight §11.2j members and all six
window preconditions passed in every run.

**The load-bearing row is cut2-2.** It ran at the highest load of the three (4.44), the transient
FIRED (`settleWaits: 1`), and the run was ALL PASS — the exact condition that turned `final-b` red
on the pre-cut-2 tree was absorbed by `settleEvent` instead of being read as a defect. The
pre-cut-2 tree for comparison, same three-run shape: green / **1 FAIL (`subject fixture`,
`living: "send-uncertain"`)** / green.

**What the runs also MEASURED, and it is what made the mechanism findable:** `pane_id` and
`openedAt` were **identical across all six windows within each run** (`%76`, one `openedAt` per
run), on the green runs and on the red one alike. The receiver pane is never recreated here — which
is what left `send-uncertain` with nowhere to hide.

**Correction to the addendum above — the "the heal replaces the occupant" reading is UNPROVEN, not
established.** Re-read at `fleet-e2e-instance-4110` on 2026-09-01: (1) `server.ts#ensureSlot` emits
the identical `slot N: created tmux session 'sN' in <cwd>` line for a deliberate `openSlot` and for
a self-heal, and audits BOTH as `self_heal_recreate` (only `cause === "restart"` differs) — so
neither the log nor the audit event distinguishes them; (2) the two `slot 7: created` lines are
fully accounted for by two KNOWN opens the fixture itself performs a few lines later — the identity
falsifier's `kill`+`open` of `uId`, and the CLARIFICATION-CHANNEL section's `main2` opening on the
freed slot (the `slot 6` line between them is its `main1`); (3) the kept instance's audit files
cover 23:37:35–23:39:59 while the watch module ran at ~21:17–21:19, so its silence about a slot-7
heal proves nothing either way. What survives from the addendum is the honest bookkeeping over a
receiver that was gone by recovery time; what does NOT survive is the claim that a heal caused it.
`pane_id` is the only external witness that separates the two, which is why cut 1 stamps it.

**Post-mortem discriminator.** Unlike §11.2i this family fails as REAL failing checks, not as a
silent no-measurement: the runs carry 3345/3344 PASS and named FAIL rows. Preserved instances from
the two red runs are kept: `fleet-e2e-instance-80791` (run 2) and `fleet-e2e-instance-26770`
(run 3) — neither has been dissected.

**Consequence for the Generalsanierung.** A red on these lines is a flake candidate; a red anywhere
else is still ECHT and still yours. After cut 1 the shape of a red on these lines changed and that
changes what you owe: a `receiver precondition (<window>)` FAIL is the fixture saying the pane went
away under it — flake, and it names itself. A member failing while its precondition PASSED is not
automatically yours either — that is how cut 2's mechanism was caught, and the honest rule after it
is narrower: read the printed `settleWaits`, `frameIsDraft` and the id fields, and say which of the
three known shapes it is (pane replaced · row read mid-transient · both composer readings
disagreeing) before calling it a regress. The P0 baseline demands three CONSECUTIVE green runs; with both cuts
landed this family no longer blocks it (all eight members and all six preconditions held in the
three verification runs, including the one where the transient fired). The stated conditions —
clean tree, controller idle, never two suites at once — still hold as a finding about what this
machine can prove while several sessions share the checkout.

**Bookkeeping:** twelfth family (three in §5b · §11.2 · §11.2b · §11.2c · §11.2e · §11.2f ·
§11.2g · §11.2h · §11.2i — eleven before this). The count was pulled through on 2026-09-01: the
fragment `rulebook/lane-discipline.md` said "Zwoelf bekannte Flake-Familien" and `CLAUDE.md` was
re-rendered from it; §11.2k took it to "Dreizehn" the same day, and on 2026-09-01 the fragment's
§11.2j/§11.2k entries were pulled through to REPARIERT (`b20e7e4` / `05f37f1`). Both are gitignored, so no commit carries that change — on a drift suspicion,
re-render (the command is in the head of `rulebook.ts`).


**REPARIERT 2026-09-05 in `c36c1e9` (Server + eigene Sonde) und `1db9296` (Fixture-Vorbedingung)
— ein Rot auf diesen acht Zeilen NACH `c36c1e9` ist wieder ECHT und gehoert dem, der es sieht.**
Nichts oben ist zurueckgenommen; das hier haengt an.

**Was nach `b20e7e4` noch fiel, aus dem Register statt aus der Erinnerung.** Fenster = alle
`e2e-trail/isolated-*.jsonl`, deren `tree` `b20e7e4` als Vorfahren hat
(`git merge-base --is-ancestor`): **12 rote Laeufe / 101 = 11,9 %**, auf 9 Baeumen. Und die zwoelf
zerfallen SAUBER in zwei Signaturen, was vorher niemand getrennt hatte:

| Signatur | Laeufe | woran erkennbar |
|---|---|---|
| `flippedBack:true` und/oder `freed:400` | **9** | `subject-gone` 12x, `counterprobe` 11x, immer als Paar; die sechs juengsten roten Laeufe (ab 2026-09-03) tragen NUR dieses Paar |
| `livingId:null` | **3** | nur 2026-09-02 (`2d4eb921`, `d63bb91f`); Pane gesund, Draft in beiden Composer-Lesungen, `settleWaits:0` |

Die in der Filing-Fassung oben zitierten Details `draftBytes:546` und `attempts:100..341` stammen
aus Baeumen VOR `b20e7e4` (`088d3a8b`, `00d9b58b`). Schnitt 1/2 haben sie geschlossen; in 101
Laeufen danach sind sie nicht wieder aufgetreten. Wer sie noch als offenen Faden fuehrt, jagt ein
Gespenst.

**WURZEL 1 (9 von 12), und sie liegt im SERVER, nicht in der Fixture: ein LOST UPDATE in
`server.ts#tickWatches`.** Die FACT-2-Schleife validiert eine Zeile (`status !== "pending"` →
skip; `laneEventSubject(event) === "gone"` → terminalisieren) und AWAITET danach `canDeliver`,
das auf ps/pgrep hinausshellt. Ein `kill` der Subjekt-Lane laeuft in diesem Fenster VOLLSTAENDIG
durch — `killSlot` → `dropWatchesFor` → `markFleetEventsSubjectGone` — und schreibt `subject-gone`
auf genau die Zeile, die die Schleife noch haelt. Danach schrieb die Schleife ihren
`send-uncertain`-Marker darueber, und der `SendRefused`-Arm rollte auf `pending` zurueck:
**pending → subject-gone → send-uncertain → pending.** Das ist EIN Defekt und erklaert BEIDE
Faeden, die §11.2j oben als moeglicherweise unabhaengig fuehrt:

- der siebte Member (`subject-gone` → `pending`, `doomedRows:1`): dieselbe Zeile, zwei Lesungen,
  eine Ruecknahme dazwischen. Damit ist die „contradictory double reading" von 2026-09-01
  aufgeloest — keine der beiden Lesungen las die falsche Zeile, die Zeile selbst ging zurueck.
- `freed:400`: die auferstandene Zeile zaehlt wieder als offene Schuld, die Budget-Tuer sieht 5
  statt 4 und verweigert. Die Hypothese von 2026-09-01 („eine zusaetzliche Schuld verbraucht die
  Marge von genau einem Event") war RICHTIG in der Rechnung und unvollstaendig in der Ursache: die
  zusaetzliche Schuld ist die wiederbelebte Zeile selbst. Belegt in flagranti im Lauf
  `isolated-20260904T102222Z-51905`: `budgetAtFree.open` fuehrt die doomed-Id als `send-uncertain`
  NACH der Lesung, die sie als `subject-gone` sah — und `send-uncertain` schreibt in diesem Server
  nur `tickWatches`.

Produktschaden, nicht nur Fixture-Rauschen: bei FREIEM Composer refused `sendText` nicht, der Tick
tippt also die Nachricht ueber eine abgerissene Lane in die Empfaengerpane — genau das, was der
terminale Zustand verhindern soll. Reparatur: nach `canDeliver` werden beide Fakten NEU gelesen.

**Die eigene Sonde dazu** (`FLEET_TEST_WATCH_TICK_LATCH`, `e2e/watch.ts` ACP-27 (6)): der Tick wird
in genau diesem Fenster geparkt, die Lane waehrenddessen getoetet, dann freigegeben — und gelesen,
was er schreibt. Sie misst den Serverfehler direkt und braucht weder Draft noch Refusal.

**WURZEL 2 (3 von 12), und die liegt in der FIXTURE: die zwei Subjekt-Abos wurden nie gelesen.**
`POST /api/slots/:id/watch` wurde ohne `r.ok`-Pruefung abgesetzt; bei einer Ablehnung
(`400 max 5 active watches per slot`) blieb die Watch-Id `""`, `eventForWatch("")` fand nichts,
und 50 s spaeter meldete die Fixture „die Lane-Vollendung hat keine Zeile gemuenzt" — eine Kaskade
ueber fuenf Vertraege auf eine Subscription, die nie stattgefunden hat. In beiden 2026-09-02-Laeufen
faellt `arrival:` unmittelbar davor und laesst seine Zeile `pending` stehen, also eine offene Schuld
mehr auf demselben Empfaenger. Nicht bewiesen ist, dass die Tuer damals wirklich 400 sagte — die
Fixture hat es nicht aufgeschrieben, und GENAU das ist der Defekt. Ab `1db9296` scheitert die
Vorbedingung als SIE SELBST, mit Status, den Worten der Tuer und dem Budget in diesem Moment.

**Verifikation (2026-09-05, Baum `1db9296`, alle drei Laeufe `dirty:false` und BEWEISBAR seriell —
kein anderer `isolated-*`-Trail traegt eine Zeile in ihren Fenstern).** Die Beweisform ist die
Owner-/Controller-Fassung vom 2026-09-05: DREI Laeufe, nicht fuenf.

| Lauf | run-id | checks / FAIL | die acht §11.2j-Mitglieder + die sechs neuen Zeilen |
|---|---|---|---|
| 1 | `isolated-20260905T073835Z-83558` | 3687 / 3 | **14/14 PASS** |
| 2 | `isolated-20260905T092010Z-24639` | 3686 / 1 | **14/14 PASS** |
| 3 | `isolated-20260905T102255Z-80773` | 3686 / 3 | **14/14 PASS** |

Die sieben roten Checks dieser drei Laeufe gehoeren AUSNAHMSLOS anderen Familien, und sie werden
hier mit Namen und Detail genannt statt weggelassen:

- `projection nextAction: a REVIEWABLE row of a promoted Program names the MAIN's OWN land door…`
  `{"with":null,"without":null,"phase":"UNKNOWN"}` — in ALLEN DREI Laeufen. Die Projection-Familie.
- `unbound succession: pane s8 rendered the harness screen` (`the pane died with the command`) und
  `…and delivers it WHOLE once that marker appears…` (`500 successor delivery held (not-alive)`) —
  Lauf 1. Die succession-pane-Familie.
- `re-subscribing to the same target returns the SAME watch, never a second` (`62912fb5 vs
  5fc3c077`) und sein Folgefehler `delete the spent transport Watch` — Lauf 3. **Das ist eine
  bislang UNREGISTRIERTE seltene Familie, keine Regression dieser Lane:** 3 Fails / 519 Laeufe
  = 0,58 %, mit Sichtungen am 2026-08-24 (`210fcd92`, Detail `4877e0aa vs 4877e0aa` — dort fiel
  der dritte Konjunkt) und 2026-08-25 (`56498796`, `af91e664 vs 56af7474` — dieselbe Form wie
  heute). Der Diff dieser Lane kann strukturell keine zweite Watch muenzen: er faesst die
  Subscribe-Route nicht an, und die Watch der neuen Sonde liegt auf einem Slot, der ~2700 Zeilen
  frueher getoetet wird. Wer sie jagt, faengt hier an.

**MUTATIONS-BEWEIS.** Nur die zwei Neulesungen entfernt (Latch und Sonde unveraendert), Lauf
`isolated-20260905T084416Z-10928` (`dirty:true`, nach dem watch-Modul abgebrochen): die VIER
Vorbedingungszeilen bleiben GRUEN und ausschliesslich der Vertrag faellt —
`{"status":"delivered","attempts":1,"typed":1,"typedHead":["[fleet] slot 8 (fleet/260905084739-3c64)
[event 373672269dd8"],"open":["373672269dd8508a2ed0e0cb:delivered"]}`. Das ist der Schaden selbst
und kein Stellvertreter: die terminale Zeile wurde neu markiert, in die Empfaengerpane GETIPPT
(eine Prompt-Log-Zeile, die die abgerissene Lane nennt) und haelt deren Zustellbudget wieder.
Wer diesen Trail spaeter maschinell auswertet: **dieser eine Lauf traegt `c36c1e9` als Vorfahren
UND einen Family-Fail, und beides ist Absicht** — er ist `dirty:true` und mutiert.

**Das maschinenunabhaengige Mass ist NOCH NICHT erreicht, und das wird hier gesagt statt
verschwiegen.** Verlangt sind 0 Family-Fails bei mindestens 10 Laeufen auf Baeumen, die den Fix
enthalten. Stand 2026-09-05 12:45: **3 saubere Laeufe, 0 Family-Fails — sieben fehlen.** Sie
kommen von selbst (jeder Post-Land-Audit zaehlt mit); die Zahl ist das Kriterium des Programs,
nicht die Bringschuld dieser Lane.

### 11.2k A thirteenth family: the raw-review persist race in `e2e/outcomes.ts` (2026-09-01 — REPARIERT, mechanism read out of the code)

**The member, a singleton:** `outcome: a reviewer answer that did NOT parse is persisted as
raw:true carrying its text — not as a clean review` (`e2e/outcomes.ts`, block 9b/F5). Failing
detail both times: `{"state":"none"}` — the outcome row exists but carries no review coverage at
all, while the check expects `covered` + `raw:true`.

**The direct proof, no re-run spent (§11.7 satisfied from the record):** zero commits touched
`server.ts`, `lane-signals.ts` or `e2e/outcomes.ts` between the four runs below — the review
path and the probe were byte-identical throughout:

| run | tree | this check |
|---|---|---|
| run 5 (§11.2j table) | `dc75c32`, clean, controller idle | **RED** — the run's only failure |
| run 7 (§11.2j table) | `5cef1b7` | green (the run's reds were §11.2j) |
| post-land audit of `01459c9` | `01459c9` | green (reds were §11.2j) |
| post-land audit of `ff5b813` (W1) | `ff5b813` | **RED** — the run's only failure (1/3366) |
| §11.2j repair lane, cut2-1 | `ac90244` | **RED** — the run's only failure (1/3374) |
| §11.2j repair lane, cut2-2 | `ac90244` | green |
| §11.2j repair lane, cut2-3 | `ac90244` | **RED** — the run's only failure (1/3374), byte-identical detail to cut2-1 |

Same bytes, twice red, twice green ⇒ non-determinism proven directly; neither `01459c9` (client
+ `e2e/tasks.ts` only) nor W1 (moves + path literals) touches the review/outcome path.

**The mechanism, read out of `server.ts` (no server change; §11.2f's shape, different joint).**
The question the filing left open was whether the verdict is persisted synchronously with the
click. The answer is *both*, and which one you get is the race:

- For a job the click STARTED, persistence IS synchronous with the response:
  `server.ts#startReview` chains the `reviewCache.set` onto the very promise
  `server.ts#reviewResponse` awaits. Return implies written.
- For a job the click JOINS, it is not. `reviewResponse` does
  `reviewInflight.get(s.id) ?? startReview(…)`, and **`reviewInflight` is never cleared when a slot
  is torn down**: `server.ts#teardownSlotOccupant` deletes `reviewCache`, `reviewAutoTried`,
  `mergeInflight`, `summaryCache` and a dozen more — not `reviewInflight`, whose only delete is the
  job's own `.finally`. So a review the slot's PREVIOUS occupant left running is joined by the new
  lane's click, and that job's cache write is then dropped by `startReview`'s identity re-check
  (`s.cwd === job.cwd && branch === job.branch`) — correctly, those findings describe a tree nobody
  is looking at. The caller's await resolves `ok` all the same, saying `stale: true`, having
  written nothing.

auto-③ supplies the orphans: `e2e-isolated.sh` runs it hot (`FLEET_AUTO_REVIEW_MS=1000`,
`FLEET_AUTO_REVIEW_IDLE_MS=1500`), so every lane the suite kills with a review inflight poisons
that slot for its next occupant. The next occupant here is the raw-review lane, whose click
therefore returns without persisting; `server.ts#outcomeReview` then finds an empty cache with
nothing inflight and mints `state:"none"` — the observed detail exactly.

**The repair (test-side, `e2e/outcomes.ts` block 9b).** The setup check keeps its assertion and now
carries the click's body as detail; a new check —
`raw-review precondition: the review verdict persisted before the kill` — polls
`GET /api/slots/:id/review` (run=false: a pure cache lookup that never spawns) until it answers
`cached:true, stale:false`, re-clicking while it is absent (≤6 clicks, 30 s deadline), BEFORE the
kill. It asserts the same cache entry `outcomeReview` reads, so it is robust to any route to an
unwritten cache, not only the orphan-job one. When the precondition cannot be established it fails
AS ITSELF, so the F5 proof check is never asked to carry it; that check is unchanged and still
proves `covered` + `raw:true` + `findings 0` + the notes text. `clicks=N` rides in the detail on
PASS, so a run that actually hit the race says so.

**The proof runs** (2026-09-01, lane `fleet/260901000515-51a3`, tree `ba4169a` + the patch, serial,
one suite on the box each time):

| run | loadavg at start | result | block 9b |
|---|---|---|---|
| 1 | 1.58 | 1 FAILURE — `subject-gone` (§11.2j, `e2e/watch.ts`) | both checks PASS, `clicks=1` |
| 2 | 1.53 | 2 FAILURES — `subject-gone` + `counterprobe` (§11.2j) | both checks PASS, `clicks=1` |
| 3 | 1.94 | **ALL PASS** (3367 checks) | both checks PASS, `clicks=1` |

Stated honestly: `clicks=1` in all three means the race did not fire during them, so the runs show
the repair costs nothing and breaks nothing — they do not themselves demonstrate it absorbing a
hit. What carries the repair is the code above, and the fact that the new precondition asserts the
exact datum the outcome row is built from.

**Still open — the same window sits on two neighbours, deliberately not touched here.** The brief
cut at block 9b. But `outcome: a review of the exact content that ended up shelved is recorded as
covered` (lane `ocRv`) and `outcome: a review computed for an EARLIER git state is recorded as
superseded` (lane `ocSup`) both click ③ and reach a terminal event without asserting the persisted
effect, so an orphaned `reviewInflight` job on THEIR slot mints `{"state":"none"}` there just the
same. §11.2k's singleton is which check got hit, not which checks are exposed. Same repair shape
applies to both, ~6 lines each. And the server-side option nobody has taken: deleting
`reviewInflight` in `teardownSlotOccupant` alongside `reviewCache` would close the joint at the
source for every caller — an owner decision, not a lane's.

**Two pre-repair sightings from the §11.2j lane, and they are the rate datum this section otherwise
lacks** (2026-09-01, tree `ac90244` — that lane forked BEFORE this repair, so its tree still carries
the unfixed block 9b; its diff is `e2e/watch.ts` + this file, so it cannot reach `e2e/outcomes.ts` or
the review path): three serial runs on ONE unchanged tree went RED / green / RED, both reds carrying
the byte-identical singleton `{"state":"none"}` at the same log line. Non-determinism proven a second
time on identical bytes — and, unlike the three proof runs above where `clicks=1` says the race never
fired, it puts the observed hit rate on this machine near two runs in three. The proof runs show the
repair costs nothing; these show what it is for.

**Bookkeeping:** thirteenth family, repaired test-side. The two audits stay adjudicated `flake` on
the ledger with this section as the stated reason. A red on this line AFTER this repair is ECHT
again and yours — as is a red anywhere else in `e2e/outcomes.ts`, which it always was.

### 11.5 What is script here, and what is judgment

Of the four steps this triage took, three are mechanical and one is not: taking the mutex, deciding
the machine is quiet, and re-running the same tree are scripts with no judgment in them — and two of
the three were done wrong on the first attempt, by two different sessions. (Two of those three have
since moved into the machine: `e2e-stage.sh` takes the mutex on its own, and "is the machine quiet"
is now a reading rather than a `ps` incantation — `gate` on `GET /api/sessions`, painted at the top
of the info card, `suite-contention.md` §7.) Reading nine failures and
asking whether they share a root is the only step that needed a person.

That ratio is the whole finding: **the expensive part of this session was not the thinking, it was
three mechanical steps that had no canonical form.**

### 11.6 The one datum that would have collapsed four runs into one

A **flake registry keyed by check name**: for every check that has ever failed, how often, on which
tree sha, at what suite length. Triage would then start with a lookup instead of a run — "these six
have failed 4× in the last month, on three different trees, one of them with no code change" is an
answer, and it takes a second.

It would have worked *in this exact case*: lane C hit this same family hours before I did and
reported it. A registry populated by C's run answers my question on my first red, and three runs
never happen.

Who reads it, and when — the question `README.md` raises against the outcome ledger, which "writes
and nothing reads it": the reader is whoever is staring at a red suite, at the moment they are
staring at it. That is a reader with a live need, not a hoped-for one.

**Cut line.** Two smaller things are real and are *not* part of this: having `e2e-isolated.sh` take
the lock itself (so no lane can forget), and recording each run's duration (so the load-sensitivity
curve in §5b becomes visible rather than re-derived). Both are cheaper than the registry; neither
answers the attribution question, which is the one that cost the time. Separate proposals.

**What will not work about it.** A registry can launder a real regression as "known flaky" — the
mirror image of today's failure, and the more dangerous one, because it fails silent. It is only
usable if the row carries the *tree* and the *count*, so "failed once ever, on your tree" reads
differently from "failed 9× across 5 trees". And it only helps once populated: the first session to
meet a new family still pays full price, exactly as I did.

### 11.6b Retraction, after re-reading §8 (same day)

§11.6 above is **demoted, by its own author, on the strength of §8**. Two reasons, both of which I
should have found before writing it rather than after:

- **It optimises the wrong side of the trade.** A registry lowers the cost of *living with* a flake.
  §8 raises the *value of the gate*. And the triage it speeds up belongs to tier 2, where a red
  gates nothing and reverts nothing — so it buys attention, not safety. The four runs it was
  reacting to were only needed because the full suite was being used as a pre-land gate, which is
  precisely what §5b and §8 argue against. The proposal generalised from a self-inflicted cost.
- **It is downstream of something better.** §8 makes gate-eligibility a *measured* property: a suite
  qualifies by burning in clean over N runs (`e2e-clean-review.sh` 8/8; `e2e-security.sh` parked at
  n=2 pending ~10). **Burn-in runs produce the per-check history a registry would hold, for free.**
  The registry is the exhaust of burn-in, not a project.

The currency is therefore run-minutes, and the comparison is unflattering: the four triage runs
recorded in §11.1 cost ~25 minutes and settled one lane's attribution. **Ten burn-in runs of
`e2e-security.sh` cost ~5.8 minutes (10 × 34.5 s, §8) and would widen the gate by 46 checks,
permanently.**

Also noted while re-reading: the check-level determinism split I was about to propose in place of
the registry is already refuted in §8 — `fleet-e2e.ts` (grep `LaneCtx`) threads one mutable `LaneCtx` through
`lanesBasic → lanesLifecycle → merge` with a load-bearing order, so slicing the suite is a fixture
refactor, not a config change.

**State of §8 when this was written** (read from `watchdog.sh`, not assumed): Step 3 (the post-land
audit) live; Steps 1, 2, 2b and `FLEET_VERIFY_TIMEOUT_MS` **not applied** — the gate was `tsc` over
four files plus `./e2e-claude-gate.sh`, so the clean-land path and the security regression suite ran
in no gate at all. That was the open item, and it is **closed as of 2026-07-26** (`07be94d`,
`58203f2`): all of §8 is now in `watchdog.sh`, pending only the owner's `launchctl kickstart` and an
srv restart. The suite is 47 checks, not 46 — `e5e5e80` added the id-join check.

Root-causing the merge/resolver family (§11.2) ranks *below* this, counter-intuitively: it lives in
a tier that gates nothing, so fixing it widens no gate. It only recovers the alarm value §7
finding 6 already names as compromised.

### 11.6c Change-aware check selection — examined, rejected, with the numbers

Asked 2026-07-26: could the gate be smarter by running only the checks that a change's files or
dependencies imply? Test-impact analysis. Measured before answering, not assumed:

- **16 of the last 23 code commits touch `server.ts`** (doc-only commits excluded). At 387 KB it is
  also the hub of the import graph, so a dependency-based rule collapses onto the same file. A
  file→check map would say "run everything" for seven changes in ten. The granularity that makes
  selection pay does not exist in this tree.
- **The ceiling is minutes per day.** The remaining ~30 % are client- or e2e-only. Skipping ~60 s of
  §8's 65.6 s median gate on those, at today's ~7 lands, is **~2 minutes a day**. The one expensive
  suite (`e2e-isolated.sh`, ~6.5 min) is already tier 2 and asynchronous — selection saves nothing
  there that anyone waits on.
- **The failure direction is wrong.** A skipped check fails *silently*; 30 extra seconds fail
  visibly. The map is a second source of truth beside the code, and a missing entry means "not
  run" with nobody noticing — the class of rot `ungoverned-artifacts.md` exists for.
- **Inside the suite it is blocked anyway** — §8, the mutable `LaneCtx` and its load-bearing order.
  Suite-level selection is possible today without a refactor; it is the two minutes above.

**When the idea is right, and it is:** TIA pays when the suite is long *and* the change surface is
fine-grained. Here the long suite is already async and the surface is 70 % one file. Both fail.

**The half that survives — same map, opposite direction.** Do not *skip* checks; *weight* a red.
`filesTouched` is already on every outcome row (verified: `data-saver-c-reconnect` carries all six
of its paths), and the failing check names are already in the audit output. Joining them answers
"does this red concern this lane?" — which is exactly what §11.1's four runs were spent on. Today's
four lanes touched payload, transport, the websocket seed and the mode switch; the red was
`G1b`/`FIX1`/`outcome:`, all merge path. One second instead of twenty-five minutes.

It never reduces coverage — every check still runs — so it fails safe, unlike selection. Two honest
limits: the reliable signal is the *negative* one ("touched no `server.ts` at all"), because
region-level attribution inside that file needs hunk ranges that rot; and it is a prior, not a
proof — a client change can break the merge path through a shared helper, so it may say "look here
last", never "ignore this".

**Ranking:** both of these sat *downstream* of §8 being unapplied — optimising which checks run was
premature while the gate was 47 s and covered neither the land path nor the security suite.
**§8 is applied since 2026-07-26** (see the STATUS banner there), so that particular objection has
expired. The ranking does not change on its own account: the gate is now 101 s against a 300 s
timeout, so there is no cost pressure to optimise away, and §11.6c's numeric rejection of
file-based check selection stands untouched.

### 11.7 Rulebook lines — proposed here, ENTERED in `CLAUDE.md` on 2026-07-26

*(A lane cannot enter them: `CLAUDE.md` is gitignored and only copied at spawn. All three below are
now in the main checkout's copy, item 1 replacing the old rule rather than sitting beside it.)*

1. Replace "prove it fails-identically-at-HEAD (fresh HEAD worktree)" with: **re-run the same tree
   first**; a tree that passes on a re-run has proven the flake. The HEAD worktree is the fallback
   for a tree that keeps failing identically.
2. The quiet-machine check is `ps -eo command | grep -c '^/bin/sh ./e2e-isolated.sh'` — a plain
   `grep e2e-isolated.sh` counts shell wrappers and reads as contention that is not there.
3. Name the merge/resolver family (`"agent reported rebased, but the lane is not clean"`) as a
   fourth known flake alongside §5b's three.

### 11.8 §10 confirmed at scale

`/private/tmp/tmux-501` currently holds ~200 stale `fleettest*` socket files. §10 predicted this
from one leak; at four hand-runs in an evening it is visibly accumulating. Still outside the repo,
still not touched.

### 11.2l A fourteenth family: the busy-receiver restart check in `e2e/watch.ts` (2026-09-03 — MECHANISM READ FROM THE TRAIL REGISTER, discriminator measured; REPARIERT 2026-09-04 in `7d089c1`)

**The member, a singleton:** `restart keeps the busy pending event with the same id and no
invented attempt` (`e2e/watch.ts`, the restart-boundary block). Failing detail every time: the
row comes back `status:"delivered"`, `attempts:1`, `deliveredAt` set, where the check expects
`pending` / `attempts:0`.

**Proven pre-existing, from the trail register rather than from re-runs.** 364 of the 715
`isolated-*` trails carry this check. It has gone red **15 times on 13 DISTINCT trees** — one
lone red on 2026-08-16 (`9db4b85`), then eleven on 2026-09-02 (`2d4eb92`, `5e2f47d`, `d63bb91`,
`866aeea`, `d4bb687` twice, `fda6fda`, `a97f0f5`, `299ac65`, `fa9edd0`, `4d2dd39`) and three on
2026-09-03 (`9f3b5a0`, then twice on the P4 Slice 5+6 tree `7d938ce`, which is what occasioned
this entry). A check that reds on thirteen unrelated trees is not any one of their regressions.

**The mechanism, read out of the code and confirmed by the numbers.** The fixture keeps receiver
slot B loud with `echo watch-still-busy` every 250 ms, but that loop exits the moment `eventB` is
first SEEN pending — from then on nothing in the fixture keeps the pane busy. `eventB` carries
`receiverIdleSec: 2`, and `tickWatches` delivers as soon as `canDeliver` sees 2 s of pane quiet
(`server.ts`, the `idleMs: event.receiverIdleSec * 1000` gate). So the check passes only if the
work BETWEEN the busy-event anchor and the restart boundary keeps that pane from ever being quiet
for two seconds — a precondition the fixture does not control and never asserts.

**The discriminator, measured over all 364 runs** — elapsed time from the check
`one signal creates exactly one durable event even for a busy receiver` to the restart check:

| | min | median | p95 | max |
|---|---:|---:|---:|---:|
| 349 green runs | 1.3 s | 3.1 s | 3.5 s | 7.5 s |
| 15 red runs | 3.5 s | 4.0 s | — | 5.1 s |

Every red sits at or above 3.5 s; only 21 of 349 greens do. The separation is not clean (a 7.5 s
green exists), so this is a strong correlate and not a law — but it is the same 2 s gate showing
through, and it is the first numeric handle this family has.

**Why the reds cluster on 2026-09-02:** `1748417` (`feat(helper): Job v1 command`) inserted the
whole job-watch block INTO that stretch, between the anchor and the restart boundary, and
`d4bb687` added to it. Eleven of the fifteen reds are on or after that day. Lengthening the
stretch is what moved the fixture across the gate — nobody changed the delivery path.

**Not repaired IN THAT SLICE, deliberately — überholt am 2026-09-04, siehe die Reparatur am Ende
dieses Abschnitts: der Fix ist eine Fixture-Änderung und gehörte einer Lane, die `e2e/watch.ts`
besitzt,** nicht einer Move-Slice, die nur zufällig darüber stolperte. The shape of the fix is the
one §11.2f already used: the fixture must CONTROL its precondition (keep sending to slot B until
the restart, or subscribe with `idleSec: 0` and assert the pending-ness it actually engineered)
rather than inherit it from whatever else happens to type into that pane. Bis zur Reparatur galt:
a red here is NOT a verdict on the tree under test — check the stretch in the run's trail first.
**Ab `7d089c1` ist ein Rot hier wieder ECHT.**

**NACHTRAG 2026-09-03, nach dem Post-Land-Audit auf `5848207f`: die Familie ist KEIN Singleton.**
Dieses Audit (`isolated-20260903T162559Z-69549`, 3527 Checks) fiel vierfach, und alle vier sitzen
in derselben Naht — Watch/Event-Lebenszyklus um Teardown und Restart:

| Check | Basisrate im Trail | Bäume mit FAIL (davon sauber) |
|---|---|---|
| `subject-gone: the torn-down lane's undelivered event is terminal as itself…` | 13/85 = 15,3 % | 6 (2) |
| `restart keeps the busy pending event with the same id and no invented attempt` | 17/367 = 4,6 % | 15 (14) |
| `deleting a Watch does not delete its acknowledged event` | 5/367 = 1,4 % | 2 (0) |
| `subject teardown after event creation leaves the event trail intact` | 6/367 = 1,6 % | 3 (0) |

Gemessen über alle `e2e-trail/*.jsonl` des Haupt-Checkouts am 2026-09-03; die Zahl für den
Restart-Check liegt eine Rotmeldung über der oben genannten, weil die Läufe dieses Tages mitzählen.

**Zwei Beobachtungen, die den Reparaturweg oben schärfen, ohne ihn zu ersetzen:**

1. **Alle vier fielen zum ersten Mal GEMEINSAM** — in keinem der 367 Läufe davor sind sie zusammen
   rot geworden (35 Läufe hatten mindestens einen). Wer die Fixture nach dem §11.2f-Muster
   repariert, sollte deshalb prüfen, ob die vier eine gemeinsame Vorbedingung teilen (die
   Empfänger-Beschäftigung) statt vier eigene zu haben — dann ist es EIN Schnitt, nicht vier.
2. **Die beiden seltenen Mitglieder sind noch nie mit `tree: null` rot geworden** (0 von 5 bzw.
   0 von 6): sie fallen nur in Läufen, die einen Baum auflösen konnten, also nicht in
   Post-Land-Audits — bis zu diesem hier. Das ist ein Unterschied im Umfeld, kein Urteil über den
   Baum, und der billigste nächste Messschritt an dieser Familie.

Das Audit selbst ist als `flake` adjudiziert. **Der Grund, der dabei zuerst notiert wurde, hält
nicht** (Korrektur der Sanierungs-MAIN, 2026-09-03, am Baum nachgemessen): dort stand, das
gelandete Commit `5848207f` sei docs-only und ein Prosa-Diff könne keinen Check regressen. Das
beschreibt `5848207f` gegen seinen ELTERN — nicht den Baum, den das Audit gemessen hat. Die
Land-Note sagt `mainBefore f3a56d7` → `mainAfter 5848207f`, und `covers` nennt den Zweig
`fleet/260903062628-c5ef`: die Slice-5+6-Lane, keine Doc-Lane. Der auditierte Tip enthält also
`c80b171` — **112 Zeilen aus `server.ts` heraus** nach `server/http.ts` und `server/auth.ts`.
Das Land ist nicht docs-only.

**Das Urteil `flake` bleibt trotzdem richtig, aus einem Grund, der den ganzen Land-Diff prüft
statt nur den obersten Commit:** über `git diff f3a56d7 5848207` enthält der Diff **null**
Code-Treffer auf `fleetEvents` · `pruneFleetEvents` · `FleetEvent` · `watches` · `tickWatches` ·
`eventRows` · `FLEET_EVENT_*`. Der einzige Treffer überhaupt ist das Wort `tickWatches` in der
Prosa dieses Abschnitts hier. Gegenprobe, damit die Null gemessen und nicht bloß leer ist:
dieselbe Suchform findet 29 Treffer auf die Namen, die der Diff wirklich bewegt (`tokenGate`,
`TOKEN`, `json`, `HOST`, `PORT`). Der bewegte Code kann die Watch/Event-Naht nicht erreichen.

**Die Lehre ist allgemeiner als dieser Fall:** ein Audit misst den TIP, nicht den obersten
Commit. Wer eine Adjudikation auf „das gelandete Commit ist docs-only" stützt, muss `mainBefore`
aus der Land-Note lesen — ein Land trägt oft mehr als einen Commit, und genau dann ist die
bequeme Begründung die falsche.


**REPARIERT 2026-09-04 in `7d089c1` — die Fixture stellt ihre Vorbedingung jetzt selbst her, statt
sie zu erben.** (Die Sha ist die des Lane-Commits `fix(e2e): the busy-receiver fixture inherited
its precondition from unrelated work — now it produces it`; ein Rebase vor dem Land kann sie
verschoben haben, das Subject nicht — `git log --grep 'busy-receiver fixture'` findet ihn immer.) Der Beschäftiger, der bisher mit der ERSTEN Sichtung von `pending` endete, läuft als
Hintergrund-Schleife (`busyKeeperOn` / `busyKeeper` in `e2e/watch.ts`, dieselbe 250-ms-`send-keys`-
Kadenz wie die Schleife davor) vom Signal-Anker durch den Deploy- und den Job-Watch-Block bis HINTER
die Restart-Prüfungen und wird erst dort abgeschaltet, wo der Block „The pending event survived" die
Pane absichtlich verstummen lässt. `receiverIdleSec: 2` bleibt unverändert: genau dieser Wert ist es,
den die spätere Zustellung („busy -> later idle delivers the SAME pending event exactly once") misst
— ihn hochzudrehen hätte die Reparatur mit dem Verlust dieser Messung bezahlt. Damit hängt `pending`
nicht mehr daran, wie lange die dazwischenliegende, unverwandte Arbeit zufällig dauert; die oben
gemessene Strecke Anker→Restart ist kein Diskriminator mehr, weil die Pane über die ganze Strecke laut ist.

**Mutationsprobe, damit die Reparatur nicht tautologisch ist** (Lauf
`isolated-20260904T040403Z-36460`, Baum `d86fcc7`+dirty): Beschäftiger auf `false` gesetzt und die
Ruhe, die die Fixture bisher per Zufall erbte, als `await Bun.sleep(3000)` explizit gemacht — der
Check fällt sofort und mit genau dem Fingerabdruck dieses Abschnitts,
`{"status":"delivered","attempts":1,"receiverIdleSec":2}`, `deliveredAt - createdAt = 2206 ms`.
Mit ihm fällt `busy transport owes the already-created event without typing or minting another`,
das dieselbe Vorbedingung liest — die beiden sind EIN Befund, nicht zwei.

**Basisrate am Reparaturtag, aus 5705 Trails des Haupt-Checkouts nachgemessen** (2026-09-04):
`restart keeps the busy pending event…` 26/376 = 6,9 % über die ganze Geschichte, aber **11 der
letzten 12 Läufe rot, davon 10 in Folge** — der Post-Land-Audit war als Sensor faktisch tot.
Die beiden Nachbarn, die derselbe Auftrag mitprüfen ließ, haben dieses Los NICHT:
`re-subscribing to the same target returns the SAME watch, never a second` 2/483 = 0,4 % (letztes Rot
2026-08-25), `self-watch is idempotent too — re-subscribing returns the SAME watch, not a second`
0/472. Sie gehören nicht in diese Familie.

## 12. Ein Cast auf eine Netz-Antwort ist eine Behauptung — der `awaiting`-Befund (aus `CLAUDE.md` umgezogen 2026-08-18)

Die Regel steht in `CLAUDE.md` §Deploy; hier der Befund im Original:

- **`GET /api/sessions` TRÄGT KEIN `awaiting` — und eine Sonde, die es trotzdem fragt, scheitert als
  „der Filter ist kaputt"** (2026-08-09 ZWEIMAL gemessen, in zwei Dateien, von zwei verschiedenen
  Autoren: `fleet-e2e-postland-audit.ts` → repariert in `8e2b3e5`, `e2e/tasks.ts` → damals offen,
  **inzwischen ebenfalls repariert**: `e2e/tasks.ts#run` trägt heute einen expliziten Kommentar
  „`awaiting` is deliberately NOT on SRow" plus einen eigenen `Persisted`-Typ, der das Feld aus dem
  persistierten Zustand liest statt es auf `/api/sessions` zu casten — wann genau, ist hier nicht
  nachvollzogen). Die
  Slot-Objekte des Owner-Polls haben elf Schlüssel (`agent ctx cwd git id label lastOutput mergePending
  model share worktree`); `awaiting` ist keiner davon — es lebt auf `laneSignalView` (`server.ts#laneSignalView`),
  also der STEWARD-Sicht. `undefined === "owner"` ist immer falsch, der Check kann nie grün werden, und
  **`tsc` sieht es nie**, weil beide Male ein `as`-Cast auf dem `fetch`-Helfer das Feld behauptet hat.
  Beide Male war das Produkt in Ordnung und die Fixture schrieb die Flagge korrekt nach `fleet.json`.
  Die Regel, verallgemeinert und weit über `awaiting` hinaus: **ein Cast auf eine Netz-Antwort ist eine
  BEHAUPTUNG über eine fremde Fläche, kein Typ** — er macht den Feldzugriff übersetzbar und die Antwort
  für immer `undefined`. Wo eine Sonde ein Feld braucht, das der Poll nicht führt, ist die Quelle die
  Zustandsdatei, die der Server geladen hat (Muster: `8e2b3e5`), und die Voraussetzung bekommt einen
  EIGENEN `check()`. **Noch nicht gepinnt** — der Pin, der die Klasse schließt, gehört nach dem nächsten
  Land in `e2e/pins.ts` (Fläche: kein e2e-Cast auf `/api/sessions` darf ein Feld nennen, das die
  Payload nicht emittiert).

## 13. Ein grünes Audit kann bedeuten, dass nichts gemessen wurde (aus `CLAUDE.md` umgezogen 2026-08-18)

Die Beweisregel (Grün an `ms` und PASS-Zeilen prüfen) steht in `CLAUDE.md` §Deploy; hier die
Geschichte samt aller vier Lehren:

- **EIN GRÜNES AUDIT KANN BEDEUTEN, DASS NICHTS GEMESSEN WURDE — und das ist gefährlicher als ein Rot**
  (2026-08-09, Session 46; repariert in `7d3a309`). `613faa3` schrieb die letzte Zeile von
  `e2e-isolated.sh` um und nahm die **22 Zeilen dahinter** mit — srv-Spawn, Port-Warteschleife,
  `bun fleet-e2e.ts`, Teardown, `exit $code`. Das abgeschnittene Skript ist **gültiges sh**: es weist
  eine Variable zu und fällt mit Status 0 ans Ende, und Status 0 ist GRÜN. Zwei Lands bekamen so ein
  Grün, das nichts gemessen hat (1,8 s statt ~690 s, **null PASS-Zeilen**), und `./state.sh` meldete
  das erste davon der nächsten Session als „newest audit: green on 613faa3c". Vier Lehren, und die
  ersten beiden sind sofort anwendbar:
  - **Ein Audit-Grün prüft man an `ms` und an den PASS-Zeilen, nicht am Wort „green".** Ein echter
    Lauf liegt bei ~680–700 s mit 17 aufbewahrten PASS-Zeilen. Alles unter einer Minute ist
    verdächtig, egal was in der Spalte steht. Seit `54ea616` trägt die Zeile zusätzlich
    `checks{ran,failed}` — `ran:0` bei `result:"green"` ist die maschinelle Form derselben Frage.
  - **Seit dem Repo-Worker `audit` (2026-09-02) gilt dieselbe Lesart für FREMDE Verify-Kommandos:** die
    Zeile trägt `cmdSource: "repo-worker"`, und `checks.ran` zählt nur `PASS `/`FAIL `-Zeilen — ein
    Verify, das anders spricht, bekommt bei exit 0 ehrlich `green` mit `ran:0`. Das ist kein
    Nicht-Messen wie oben, aber dieselbe Frage: wer ein Repo-Worker-Grün liest, liest `ms` und `out`.
  - **Der Runner druckt erst am ENDE** (`fleet-e2e.ts`, `results.join`). Ein Absturz löscht damit den
    Beweis, dass alles davor grün war — deshalb hat auch das ECHTE Rot zu `c604390` null PASS-Zeilen,
    obwohl es 445 s gearbeitet hat. „Null Checks" heißt „abgestürzt oder nie gestartet", und die
    beiden unterscheidet nur `ms`.
  - **Kein bestehendes Gate konnte es sehen, und das war kein Zufall.** `tsc` liest keine Shell, und
    der Pin, den `613faa3` selbst mitbrachte, liest die `SRV_ENV`-Zeile — die überlebt hat. Er war
    grün, während das Skript enthauptet war. Seither hält ein Pin die Klasse zu: jeder der fünf
    gestagten `e2e-*.sh` muss einen Runner ausführen **und** mit `exit $code` enden (`e2e/pins.ts`,
    Regelname mit „decapitated"); `bun e2e/pins.ts` ist die erste Stufe des Land-Gates, `613faa3` wäre daran
    gescheitert.
  - **Die allgemeine Form, und sie gilt über Shell hinaus:** eine Datei, deren Ende abgeschnitten
    wird, ist oft noch syntaktisch gültig — dann verschwindet nicht das Ergebnis, sondern die
    ARBEIT, und übrig bleibt ein Erfolg. Wer eine Zeile am Dateiende ändert, prüft die Zeilenzahl.

**NACHTRAG 2026-09-03, zwei Präzisierungen aus einem roten REMOTE-Audit** (`at=1788457854590`,
Land `f606e754`, gelaufen auf dem Second-host):

1. **`checks.ran` zählt die PASS/FAIL-Zeilen der AUFBEWAHRTEN Ausgabe, nicht die des Laufs.** Die
   Zeile meldete `checks {ran: 22, failed: 1}` — der Lauf hatte 3538 Checks. Beides stimmt: `out`
   ist auf 3979 Zeichen gekürzt (die Aufzeichnung beginnt mit `… [10 lines elided]`) und enthält
   21 PASS plus 1 FAIL. Wer `ran` als Lauf-Statistik liest, liegt hier um zwei Größenordnungen
   daneben — in der Richtung, die einen ECHTEN Lauf wie einen leeren aussehen lässt. Die Regel
   oben rettet einen: `ms` war 1 396 397 (23,3 min), und eine der aufbewahrten PASS-Zeilen nennt
   selbst die Zeilenzahl des Trails. Kurz: **`ran` ist eine Aussage über die Aufzeichnung, `ms`
   und die Trail-Zeilenzahl sind die Aussage über den Lauf.**
2. **Für ein REMOTE gelaufenes Audit gibt es den Trail hier nicht.** Die Datei liegt auf dem
   Helfergerät (`/var/lib/fleet-helper/work/run-…/tree/e2e-trail/<run>.jsonl`); das lokale
   `e2e-trail/` hat für so einen Lauf **keine** Datei (nachgeprüft für
   `isolated-20260903T172744Z-1875991`). Die Trail-Abfrage, die einen roten Check lokal in Sekunden
   adjudiziert, steht für Remote-Audits also NICHT zur Verfügung. Der Ersatz ist gebaut und hat
   funktioniert: die Ledger-Zeile führt `fails` mit den Namen der gefallenen Checks — danach greift
   die Basisraten-Abfrage über die lokalen Trails wieder, weil sie über den CHECK-NAMEN geht und
   nicht über diesen Lauf.

**Ergänzt 2026-09-04:** Auch eine lokal gelaufene rote Zeile führt nun `fails`. Der Server liest die
Namen aus der vollständigen Ausgabe vor deren Byte-Cap, entfernt den Detail-Suffix des Harness und
validiert/deckelt sie mit demselben `helperFailNames` wie Remote-Zeilen. `unknown`-Zeilen und ältere
Zeilen ohne diese Messung tragen das Feld weiterhin nicht.


## 14. Der Remote-Helfer: Tier 2 auf einer zweiten Maschine (Stufe 1, 2026-08-26)

Tier 2 ist der einzige Ort, an dem eine 5,6-Minuten-Suite leben kann (§6) — und genau darum ist er
auch der einzige Ort, an dem das Auslagern auf eine zweite Maschine überhaupt etwas einbringt: die
Arbeit blockiert niemanden, sie kostet nur die Maschine. Das Helfer-Portal ist die Tür dafür.

**Die harte Invariante, in den Worten des Owners:** „es muss nur so aufgebaut sein dass wir am Ende
wirklich Arbeit abnehmen, nicht dass irgendwas doppelt läuft". Drei Mechanismen tragen sie, und
keiner verlässt sich darauf, dass die andere Maschine sich benimmt (`server.ts#handleHelperRoute`
und die Nachbarfunktionen):

- **Claim ⇒ der lokale Drain überspringt das Repo.** Die Auswahl des Drains
  (`server.ts#drainPostLandAudits`) und das Schreiben des Claims sind je in EINEM Turn atomar; die
  Gegenrichtung schließt `auditRunningRepo`, eine Marke, die synchron neben der Auswahl gesetzt
  wird. Ein Claim auf einen Baum, den der Drain schon angefangen hat, ist 409 — und umgekehrt.
- **Der Claim VERFÄLLT** (`FLEET_HELPER_CLAIM_TIMEOUT_MS`, Default 45 min). Abgelaufen zählt
  überall sofort als abwesend (`helperClaimOf`), unabhängig davon, ob der Sweep
  (`FLEET_HELPER_SWEEP_MS`) die Verfallszeile schon gebucht hat. Die Fehlerrichtung ist gewählt:
  lieber einmal lokal zu viel als ein Baum, den niemand geprüft hat. Ein Ergebnis, das NACH dem
  Verfall eintrifft, wird abgelehnt (409) — es würde sonst eine Zeile über einen Baum schreiben,
  den diese Maschine gerade selbst prüft.
- **Das Ergebnis ist eine Zeile auf DEMSELBEN Ledger** (`post-land-audits.jsonl`), markiert mit
  `remote: {name, claimedAt, reportedAt, trail?}`. Kein zweites Trail: die Fragen, für die Tier 2
  existiert („welches Land war das letzte grüne Audit"), sind Joins über EINE Datei. Die
  Laufzeit-Verteilung nimmt eine Remote-Zeile bewusst NICHT auf (`auditCounts`) — ihre `ms` ist
  Claim→Report auf fremder Hardware und beantwortet nicht die Frage, für die die Verteilung da ist.

**Was ein Claim überlebt:** einen Server-Neustart. Das ist die tragende Hälfte, nicht Kosmetik — das
Deploy-Ritual hier ist land-dann-`kill-session -t srv`, ~10×/Tag; ein nur im Speicher lebender Claim
würde von der routiniertesten Handlung dieser Maschine gelöscht, der Boot-Drain nähme den Baum, und
der Helfer meldete in eine Fleet, die längst selbst geprüft hat. Claims, Verfallszeilen und
Gerätenamen liegen deshalb in `fleet.json`.

**Nicht-Ziele Stufe 1 (Owner):** kein Auto-Dispatch (der Server weist nichts zu — ein Mensch klickt),
kein ssh-Runner, kein `git push`. Transport ist ein `git bundle`, EINMAL beim Claim gebaut; der SHA,
den der Claim festhält, wird aus dem Bundle-Header gelesen statt separat aufgelöst, damit „was der
Claim nennt" und „was der Helfer bekommen hat" derselbe Baum sind.

**Beweis:** `e2e/helper-portal.ts`, Abschnitt (K) in `./e2e-postland-audit.sh` — die einzige Suite,
die mit gesetztem `FLEET_POSTLAND_AUDIT_CMD` bootet und deshalb überhaupt eine Queue hat, aus der
etwas beansprucht werden könnte. Die Fixtur, ohne die keine dieser Prüfungen existieren kann, ist ein
ZWEITES Repo: eine wartende Zeile bei leerlaufendem Drain gibt es nicht — der Drain startet auf dem
Land, das sie einreiht —, ein beanspruchbarer Job braucht also einen Drain, der anderswo beschäftigt
ist.


### 11.2m Eine fünfzehnte Familie: das PARKED-Quartett in `e2e/repo-worker-audit.ts` (2026-09-04 — Wurzel AM GEHALTENEN INSTANZ-LEDGER ABGELESEN, NICHT repariert)

**Die Mitglieder, ein Quartett, und sie fallen immer zusammen** (`e2e/repo-worker-audit.ts`,
Abschnitte RW.5 bis RW.8 — vier Checks, in allen acht Läufen des Registers 4/4 gemeinsam
vorhanden und 4/4 gemeinsam rot oder grün):

- `(RW) …after the env repo's run, which finished green on its own command` ← **die Wurzel**
- `(RW) …while a land in a repo with neither is neither audited nor queued — today's unconfigured behaviour`
- `(RW) the entry is PARKED: still on disk, not audited, and not shown as waiting`
- `(RW) another repo's land is audited meanwhile (its own command) — and its save did NOT drop the parked entry`

**Die Wurzel, aus dem aufbewahrten Instanz-Ledger gelesen statt vermutet.** Der erste Check liest
die `REPO`-Zeile des „slow"-Lands aus RW.5 und verlangt `result: "green"`, `cmdSource: "env"`.
Gemessen wurde:

    {"result":"unknown","cmdSource":"env","ms":10092,
     "reason":"audit timed out after 10000ms — no verdict"}

`slow` ist `sleep 6` (`e2e-postland-audit.sh`), das Budget ist
`FLEET_POSTLAND_AUDIT_TIMEOUT_MS=10000`. Der Abstand zwischen Fixture und Budget ist damit 4 s,
und auf dieser Maschine unter Suite-Last (in der Messnacht hielt EIN `./e2e-isolated.sh` den
Mutex 61 Minuten am Stück) reicht er nicht: 6 s Schlaf plus Spawn plus Snapshot kosteten
10 092 ms. Das Ergebnis ist ein `unknown` statt eines `green` — korrektes Server-Verhalten,
falsche Fixture-Marge.

**Zum Budget, damit die nächste Person WÄHLEN kann.** `server.ts:11670` liest
`Math.max(10_000, Number(process.env.FLEET_POSTLAND_AUDIT_TIMEOUT_MS ?? 1_800_000) | 0)`.
`Math.max` ist eine UNTERGRENZE: nach unten (< 10 s) ist der Wert unbeweglich, **nach oben ist er
frei stellbar** — `FLEET_POSTLAND_AUDIT_TIMEOUT_MS=20000` ergibt 20 000. Der Wrapper hat schlicht
den Floor-Wert gewählt; sein eigener Kommentar (`e2e-postland-audit.sh`, der Block über
`auditmode`) sagt korrekt „is the server's own floor" und eben NICHT „nicht anhebbar".

**Was VERIFIZIERT ist und was NICHT.** Die Wurzel oben ist am Ledger abgelesen. Die drei
Folge-Mitglieder sind Zeilenzahl- und Queue-Zustands-Aussagen gegen Basislinien
(`rows=31 was=30`, `ctl3Had`, `queueHas`), die im selben Lauf mitfallen; dass sie ALLE aus dieser
einen Zeile folgen, ist **abgeleitet, nicht einzeln isoliert** — was gemessen ist: sie fallen in
allen acht Registerläufen gemeinsam mit ihr und nie ohne sie.

**Belegt als vorbestehend, aus dem Trail-Register.** Stand 2026-09-04, nach den drei Läufen, die
diesen Eintrag veranlasst haben: elf Läufe tragen diese Checks, **9× rot auf 7 VERSCHIEDENEN
Bäumen** — `869a16dd` (3×), `0c4907df`, `a8e838bb`, `1e5419ce` und die drei aufeinanderfolgenden
Bäume dieses Slices (`d3681b3f`, `d1653fbf`, `2e54fc82`). Die vier Bäume vor dem Slice sind ÄLTER
als er; drei der neun Rots sind seine eigenen Messungen desselben Fehlers und beweisen darum
nichts über ihn, sondern nur, dass die Ursache auf dieser Maschine nicht wegflackert.

**Der entscheidende Datenpunkt ist ein GLEICHER-BAUM-UMSCHLAG:** derselbe Baum `869a16dd` lief
einmal GRÜN (`postland-audit-20260903T210734Z-84088`) und dreimal rot. Ein Check, der auf
demselben Commit beide Ausgänge produziert, ist nicht dessen Regress.

**Merkposten zur BEWEISORDNUNG, wie in §11.2l.** Der vom Regelbuch zuerst verlangte Rerun
DESSELBEN Baums entschied hier NICHTS: er fiel identisch (`d3681b3f`, zwei Läufe, viermal
dieselben vier FAILs, `rows=31 was=30` beide Male). Das ist auch zu erwarten — die Ursache ist
Maschinenlast, und die Maschine war während beider Läufe gleich belastet. Entschieden hat wieder
das Register.

**Basisrate 9/11 = 82 % rot.** Das ist keine seltene Flake, sondern eine Fixture, deren Marge auf
dieser Maschine fast nie reicht; sie ist am 2026-09-03 zum ersten Mal im Register aufgetaucht. Und
die Ursache ist dreimal identisch nachgemessen worden — `ms` 10 092 / 10 092 / 10 082 gegen ein
Budget von 10 000 —, was die Marge-Lesart oben bestätigt und eine Rennstelle im Server ausschließt:
ein Rennen streut, eine zu knappe Marge landet jedes Mal knapp daneben.

**Nicht repariert, absichtlich — und es gibt ZWEI legitime Schnitte, nebeneinander gestellt,
weil die Wahl der nächsten Person gehört:**

1. **Budget-Seite:** der Wrapper hebt `FLEET_POSTLAND_AUDIT_TIMEOUT_MS` von 10 000 auf z. B.
   20 000. Marge 4 s → 14 s. Preis: der `hang`-Check (`sleep 30`) läuft dann 20 s statt 10 s in
   den Kill-Pfad, die Suite wird also ~10 s länger. Geprüft: **kein** Check in
   `e2e/repo-worker-audit.ts` behauptet die 10 000 (grep leer), und `hang` schläft 30 s, liefe
   also auch bei 20 000 weiter in den Kill-Pfad.
2. **Fixture-Seite:** `slow` von 6 s auf etwa 3 s, oder RW.5 bekommt einen eigenen, kürzeren
   Modus (dasselbe Argument, mit dem `long` sich aus `slow` gelöst hat). Preis: keiner an der
   Laufzeit — `hang` bleibt schnell.

**Und unabhängig davon, welcher gewählt wird — dies ist der wichtigere Teil:** der Check muss als
ER SELBST fallen. Ein `reason` mit „timed out" heißt „diese Sonde konnte nicht messen", nicht
„der Server hat falsch klassifiziert"; solange er beides gleich meldet, verschiebt jede Marge das
Problem nur. Bis dahin gilt für einen Leser eines roten `./e2e-postland-audit.sh`: **dieses
Quartett ist kein Urteil über den Baum** — erst das Register befragen, dann attribuieren.

### 14.1 Ein remote `unknown` mit exit 127 ist zuerst ein leerer Klon, nicht ein fehlendes Kommando (2026-08-29)

**Der Mechanismus.** `server.ts#buildHelperBundle` baut das Transport-Bundle mit `git bundle create
<file> <main>`. Das Bundle trägt genau eine Referenz (`refs/heads/main`) und **kein HEAD**. Ein
einfacher `git clone` eines solchen Bundles checkt nur dann etwas aus, wenn git den einzigen Branch
als HEAD RATEN kann — und es rät mit `init.defaultBranch`. Steht der auf `master` (Debian-Default,
und der Wert eines ungesetzten), geht das Raten daneben: der Klon endet trotzdem mit exit 0, meldet
`warning: remote HEAD refers to nonexistent ref, unable to checkout`, und der Baum ist LEER. Danach
findet `bun install --frozen-lockfile` keine `package.json`, scheitert, und der Daemon meldet exit
127 — die Ledger-Zeile wird `unknown` mit dem Grund „the audit command could not be started (exit
127)". Korrekt insofern, als nie ein erfundenes Rot entsteht; die Meldung beschuldigt aber den
Install für einen Klon, der nie etwas ausgecheckt hat.

Gegenprobe auf dem Mac, beide Richtungen, gegen dasselbe Bundle:

```
git -c init.defaultBranch=master clone -q      <bundle> t   ->  0 Dateien + genau diese Warnung
git -c init.defaultBranch=master clone -q -b main <bundle> t ->  73 Dateien
```

**Die Adjudikationsregel.** Ein remote `unknown` mit exit 127 darf nicht mehr als „Kommando fehlt /
PATH kaputt" gelesen werden, bevor der Klon ausgeschlossen ist. Zwei Erkennungsmerkmale im Tail,
beide am aufbewahrten Log der Helfer-Maschine ablesbar: die Zeile `warning: remote HEAD refers to
nonexistent ref, unable to checkout`, und — auch ohne sie — ein Tail, in dem eine Install-Meldung
steht, **ohne dass davor Dateien ausgecheckt wurden**. Erst wenn beides fehlt, ist PATH der nächste
Verdächtige. Repariert in `5707b76` (`helper-daemon/daemon.ts`: `const ref = j.branch ?? j.main`,
der Klon nennt seinen Branch also; plus eine Prüfung, die einen leeren Klon als SICH SELBST meldet —
seither sagt die 127er-Zeile `the clone of <ref> left an EMPTY working tree`, und das ist der
schnellste Weg, diese Ursache zu bestätigen oder auszuschließen).

**Die verallgemeinerte Lehre, und sie ist der Grund für diesen Eintrag.** `e2e/helper-daemon.ts` war
grün, während der Pfad auf der zweiten Maschine strukturell nicht funktionierte — die Fixture läuft
nur auf dem Mac, und dort steht `init.defaultBranch` auf `main`. **Eine Sonde, die eine
Umgebungs-Voraussetzung ihrer eigenen Maschine erbt, kann den Fehler nicht sehen, den genau diese
Voraussetzung verdeckt.** Was der Klon braucht, ist keine Eigenschaft des Codes, sondern eine
Konfiguration daneben — und die reist nicht mit dem Bundle. Das ist die Kehrseite der bestehenden
Regel „eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern" (`CLAUDE.md`, dort im
Lane-Teil): dort scheitert eine Sonde falsch benannt, hier gelingt sie aus einem Grund, den sie
nicht misst. Beide Male ist die Reparatur dieselbe Bewegung — die Voraussetzung explizit machen,
statt sie zu erben.

**Belege:** `docs/messungen/second-host-baseline-2026-08-29.md`, Commit `5707b76` (Body trägt Messung
und Bestandteile).

### 11.2n Eine sechzehnte Familie: der `⏸ re-run`-Guard in `e2e/merge.ts`, den `settleForMerge` still verhungern lässt (2026-09-04 — Mechanismus schon 2026-09-03 benannt, Basisrate hier zum ersten Mal über das GANZE Register gerechnet; NICHT repariert)

**Das Mitglied, einzeln:**

- `⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)`
  (`e2e/merge.ts#⏸-re-run-guard`)

**Die Signatur, an der man sie in einer Sekunde erkennt.** Der Check verlangt
`status === "resolved"` und ein `detail`, das `review` enthält. Im roten Fall steht dort
buchstabengleich:

    {"status":"blocked","detail":"the session is actively working right now — let it settle for a moment, then land"}

Das ist der Satz des **IDLE-Gates**, nicht der des Guards unter Test. Wer nur „FAIL am
Resolution-Guard" liest, hält eine nicht hergestellte Vorbedingung für einen Produktdefekt.

**Der Mechanismus, am Code gelesen.** `e2e/lane-helpers.ts#settleForMerge` pollt 80 × 150 ms =
**12 s** darauf, dass der Slot lange genug still ist — und **kehrt danach kommentarlos zurück**,
ohne Fehler, ohne `check()`, auch wenn die Bedingung nie eintrat. Der unmittelbar folgende
`POST /api/slots/:slot/merge` trifft dann den Idle-Gate des Servers statt des Guards, und der
Check fällt als der Guard. **Das ist genau die Klasse, vor der das Regelbuch warnt:** eine Sonde,
die ihre eigene Vorbedingung nicht kontrolliert, muss als SIE SELBST scheitern — diese verschluckt
sie und lässt den nachgelagerten Check den Fehlschlag melden.

Erstmals benannt in `docs/messungen/2026-09-03-flake-basisrate-settle-for-merge.md` (dort ohne
Suite-Lauf allein aus dem Trail entschieden, Basisrate damals 2/33 = 6,1 % im aufbewahrten
Fenster). Der Eintrag hier ist **nicht** ein neuer Befund, sondern derselbe an dem Ort, an dem das
Owner-Kriterium vom 2026-09-01 („ein Lauf zählt grün, wenn jeder FAIL einer in
`docs/verify-tiering.md` registrierten Familie angehört") nach ihm sucht. Solange er nur in einer
Messnotiz stand, war er für dieses Kriterium unsichtbar.

**Basisrate über das ganze lokale Trail-Register** (5 919 Laufdateien; gezählt wurden nur die
Läufe, in denen der Check überhaupt ausgeführt wurde):

| | |
| --- | ---: |
| Läufe mit diesem Check | **655** |
| davon rot | **11** |
| Basisrate | **1,7 %** |
| verschiedene Trees insgesamt | 369 |
| verschiedene Trees unter den 11 Rots | **11 — jeder genau einmal** |

Die elf Rots verteilen sich vom **2026-08-04** bis zum **2026-09-04** (`9fa63119` · `28e6f3f8` ·
`bae56aec` · `e3e5d29b` · `fda6fdad` · `2b4abd6d` · `b79d25d5` · `869a16dd` · `4393fbee` ·
`a0e6d5a3` · `a09d9e57`). **Kein Baum reproduziert ihn** — die Signatur der Nicht-Determiniertheit,
nicht die eines Regresses.

**Damit ist B-16 des P6-Registers beantwortet, und die Antwort ist NEIN.** B-16 fragte, ob das
Land von B-06 (`1e5419c`, 2026-09-03 22:52) die Fehlerrate dieses Checks angehoben habe — gemessen
an einem 27-Lauf-Fenster mit 2 Rots (7,4 %). Über das ganze Register sind es 1,7 %, und **vier der
elf Rots liegen bis zu einem Monat VOR** diesem Land. Ein Check, der auf Bäumen von vor der
Änderung fällt, kann nicht von ihr kommen. Die 7,4 % waren ein Kleinfenster-Artefakt derselben
1,7-%-Grundrate.

**Wie dieser Eintrag entstanden ist, und warum das hier steht.** Er wurde geschrieben, **nachdem
der zweite von drei P7-Beweisläufen an genau diesem Check gefallen war** — also von jemandem, dem
die Registrierung nützt. Das ist die Konstellation, vor der B-14 warnt (Gewöhnung an ein rotes
Rauschen ist der Mechanismus, mit dem ein echtes Rot durchrutscht). Zwei Dinge stehen deshalb
ausdrücklich getrennt: die **Messung** (der Lauf war zum Zeitpunkt seines Laufens rot, weil der
Check nicht registriert war — das ändert sich nicht rückwirkend) und die **Registrierung** (sie
steht auf 655 Läufen und einem am Code gelesenen Mechanismus, beides unabhängig von meinem Lauf).
Wer die Registrierung für interessengeleitet hält, prüft die 655 nach; das Kommando steht oben in
der Tabelle.

**Nicht repariert, und der Schnitt ist klein.** `settleForMerge` muss sagen, dass es aufgegeben
hat — ein `check()` auf die eigene Vorbedingung („der Slot wurde in 12 s nicht idle"), oder ein
Rückgabewert, den die Aufrufstelle prüft. Danach fällt der Fehlschlag als er selbst, und dieser
Eintrag verliert seinen Gegenstand. **Zweiter, davon unabhängiger Schnitt:** die 12 s sind eine
geratene Zahl, gegen die kein Lastprofil erhoben wurde (das sagt schon die Messnotiz unter
`nicht-gemessen`). Wer sie hebt, ohne den ersten Schnitt zu bauen, verschiebt die Rate nur.

**Für einen Leser eines roten Laufs gilt bis dahin:** dieser eine FAIL mit dem `blocked`-detail ist
**kein Urteil über den Baum**. Register befragen, dann attribuieren — nicht rerunnen: bei 1,7 % ist
ein grüner Rerun so gut wie sicher und beweist nichts.


### 11.2o Eine siebzehnte Familie: die Projektions-Sonde in `e2e/programs.ts` — KEIN Flake um eine feste Rate, sondern ein REGIME-WECHSEL am 2026-09-04 (Stand 2026-09-05: Evidenzzeile repariert, R10/`observed` GEMESSEN, Mechanismus am Code gelesen — **die Wurzel ist seit `4c562e7` REPARIERT, der Regime-Wechsel selbst bleibt offen**)

**Das Mitglied, einzeln:**

- `projection nextAction: a REVIEWABLE row of a promoted Program names the MAIN's OWN land door, and
  without the promotion the board's` (`e2e/programs.ts`, im Land-Tür-Block)

**Die Signatur, an der man sie in einer Sekunde erkennt** — in allen 25 Rots buchstabengleich:

    {"with":null,"without":null,"phase":"UNKNOWN"}

**Diese Signatur ist Geschichte.** Seit dem Commit „fix(sonde): die Projektions-Sonde wirft ihre
eigene Diagnose nicht mehr weg" druckt die Zeile `phaseBasis` und die gefilterte `unknown`-Liste für
BEIDE Beine, also die Regel, die gefeuert hat, samt dem Fakt, der fehlte. Ein Rot ab diesem Commit
liest sich zum Beispiel so:

    "basis":["R10: lane facts incomplete — the predicate cannot be evaluated (…)"]

Wer ein Rot mit der ALTEN, dreifeldrigen Signatur sieht, liest einen Lauf auf einem Baum von VOR
diesem Commit — das ist selbst schon die Datierung.

**Die Rate „2,1–2,9 %" aus der ersten Fassung dieses Eintrags ist ÜBERHOLT und war nie eine Rate.**
Sie ist der Durchschnitt über zwei Regime und verdeckt genau den Sprung, der die Familie
interessant macht. Über dasselbe lokale Trail-Register (6 209 Laufdateien; gezählt nur Läufe, in
denen der Check überhaupt ausgeführt wurde), nach Tagen:

| Tag | Läufe | rot | Rate |
| --- | ---: | ---: | ---: |
| 08-24 … 09-01 | 151 | 1 | 0,7 % (nur 08-27) |
| 09-02 | 23 | 1 | 4,3 % |
| 09-03 | 15 | 0 | 0 % |
| **09-04** | **24** | **8** | **33,3 %** |
| **09-05** | **16** | **15** | **93,8 %** |
| gesamt | 229 | 25 | 10,9 % |

**Die Bruchstelle ist auf drei Stunden eingegrenzt und liegt NICHT am Tagesanfang.** Chronologisch,
mit UTC-Laufzeiten aus dem Register: 09-04 bis einschließlich 13:02 UTC laufen 15 von 17 grün; ab
**09-04 16:42 UTC sind 20 von 21 Läufen rot**, über 18 verschiedene Bäume. Die einzige Ausnahme
danach ist `beb43930` (09-05 12:40 UTC).

**Die Wurzel ist die UMGEBUNG, nicht ein Commit — und das Register beweist es allein.** Der
Diskriminator, den ein „Baum von vor dem Sprung, heute gefahren" liefern sollte, steht schon darin:

- `940887dc` ist ein Baum vom 09-04 **07:04 UTC**. Er läuft am 09-04 **16:42 UTC ROT**.
- `ad75273a` (inhaltsgleicher Lane-Zwilling desselben Commits) läuft 07:35 rot, 08:08 rot —
  und **11:52 GRÜN**.

Derselbe Baum in beide Richtungen, und ein Vor-Sprung-Baum nach dem Sprung rot: der Server, den die
isolierte Suite testet, kommt AUS DEM BAUM, also kann Server-Code die Antwort nicht bestimmen. Was
übrig bleibt, ist die Maschine um den Lauf herum. Suite-gegen-Suite-Nebenläufigkeit ist als Ursache
bereits ausgeschlossen (`docs/messungen/2026-09-04-flake-ranking-trail.md` §7: von 223 Läufen
überlappen genau drei, alle drei grün) — offen und wahrscheinlich bleibt die ANDERE Last:
Lanes, Land-Gates und Builds, die seit dem 09-04-Nachmittag durchgehend auf dieser Maschine laufen.

**Welche Regel feuert: R10, nicht R6 — aus dem Register entschieden, ohne einen einzigen Rerun.**
In JEDEM der 25 roten Läufe ist die unmittelbar folgende Zeile GRÜN:
`self-land: the bound MAIN starts the land WITHOUT an owner token …` assertiert
`landRespBody.laneSlot === greenLaneSlot`, und `server.ts#selfLandTaskForMain` gibt diesen Wert nur
heraus, wenn die Zeile `sent` ist UND ein lebender Slot mit `cwd`, `worktree` und
`lane.taskId === t.id` existiert. Das passiert Millisekunden NACH beiden GETs, und ein Slot wird
nicht wiederbelebt. **R6 („sent row owns no live lane") ist damit ausgeschlossen; gefeuert hat R10
(„lane facts incomplete").** Welcher der drei R10-Fakten fehlte — `alive` (Pane nie gepollt) ·
`observed` (`lastOutput 0`) · `git` (`gitInfo` auf `null`, gesetzt bei einem fehlgeschlagenen
git-Spawn, `server.ts` im Sessions-Poll) — sagt die neue Evidenzzeile beim nächsten Rot selbst.

**GEMESSEN, erster roter Lauf nach dem Sonden-Commit** (`isolated-20260905T145210Z-77794`, Baum
`e897f038`, `dirty:false`) — die neue Evidenzzeile beantwortet die Frage wörtlich und in BEIDEN
Beinen identisch:

    "basis":["R10: lane facts incomplete — the predicate cannot be evaluated (pane never observed (lastOutput 0))"]
    "unknown":["1 task (71d8de95) projects as phase UNKNOWN: pane never observed (lastOutput 0)."]

Beide Beine gleich heißt: es ist ein STEHENDER Zustand, kein Rennen zwischen den zwei GETs. Genau
darum zeigten alle 25 Rots `with:null` UND `without:null`.

**DER MECHANISMUS, am Code gelesen und nicht erschlossen.** Drei Stellen greifen ineinander:

1. `e2e-isolated.sh` fährt den Server mit `FLEET_CMD=true`. Die Pane einer Fixture-Lane führt also
   `true` aus und ist danach für immer still — sie hat GENAU EINEN Ausgabestoß, den beim Aufbau.
   Die Arbeit der Lane macht die Fixture selbst per `spawnSync("git", …)`, die Pane wird nie
   gebraucht.
2. `server.ts#ensureSlot` hängt `pipe-pane` an und öffnet unmittelbar danach ein ABSICHTLICHES
   1 500-ms-Ruhefenster (`s.quietUntil = Date.now() + 1500`), weil der folgende `repaint` keine
   Sitzungsaktivität ist.
3. Der Stream-Tick (`server.ts`, `if (size > s.offset)`) schiebt `s.offset` IMMER vor, setzt
   `s.lastOutput` aber nur, wenn `Date.now() > s.quietUntil`.

Fällt der erste Tick INS Ruhefenster, verzehrt er den einzigen Ausgabestoß, ohne `lastOutput` zu
setzen — und weil nie ein zweiter kommt, bleibt `lastOutput` für die ganze Lebensdauer der Lane
**0**. `observed` ist dann dauerhaft `false`, `laneFactsKnown` scheitert, und die Projektion sagt
ehrlich R10/UNKNOWN. Fällt der erste Tick hinter das Fenster, wird `lastOutput` gesetzt und derselbe
Lauf ist grün. Das ist der Zufallsanteil der Familie, und er sitzt nicht in der Projektion.

**Warum die Setup-Zeile davor trotzdem grün ist.** `waitDoneLooking` prüft
`now - row.lastOutput >= 3000`, und das ist bei `lastOutput === 0` erfüllt, weil `now - 0`
≈ 1,79e12 ms ist — genau die Falle, gegen die `laneSignalView` das separate Feld `observed`
überhaupt führt (der Kommentar dort sagt es wörtlich). Die Setup-Zeile behauptet also „the row is
running on a live lane that is idle, clean and ahead" über eine Pane, die nie beobachtet wurde. Sie
ist die Sonde, die nicht laufen konnte und trotzdem nicht als SIE SELBST scheitert — die Regel aus
dem Regelbuch, wörtlich verletzt, eine Zeile über dem Rot, das sie erzeugt.

**WAS HIER NICHT BEHAUPTET WIRD.** Der Mechanismus oben ist ALT — `quietUntil`, `FLEET_CMD=true`
und die `observed`-Klausel stehen alle seit Langem so da. Er erklärt, WARUM der Check überhaupt
kippen kann, aber NICHT, warum die Rate am 09-04 nachmittags von ~1 % auf über 90 % gesprungen ist.
Irgendetwas hat das Rennen zwischen dem ersten Stream-Tick und dem 1 500-ms-Fenster verschoben; was,
ist offen. Die naheliegende Vermutung „Maschinenlast" ist NICHT bestätigt und zeigt sogar in die
unbequeme Richtung: ein ausgebremster Tick fiele eher HINTER das Fenster und machte den Lauf grün.

**Für einen Leser eines roten Laufs gilt:** bei über 90 % ist dieser FAIL **kein Urteil über den
Baum** und ein Rerun beweist nichts. Lies `basis`, nicht `phase` — und wenn dort etwas anderes steht
als `pane never observed (lastOutput 0)`, ist es ein NEUER Befund und gehört gemeldet.

---

**REPARIERT am 2026-09-05, `4c562e7` (Server-Wurzel) + `21150ac` (Fixture-Klausel) — und die Reparatur trifft die Wurzel, nicht die Rate.**
Der Schnitt sitzt an genau der Stelle, die Punkt 3 oben beschreibt, und er ist eine Zeile:

    -  if (Date.now() > s.quietUntil) s.lastOutput = Date.now();
    +  if (Date.now() > s.quietUntil || s.lastOutput === 0) s.lastOutput = Date.now();

**Die Begründung, und sie ist nicht „das Fenster war zu lang".** Wofür `quietUntil` da ist, steht an
seinen vier Setzern und ist damit belegbar, nicht vermutet: `ensureSlot` (der Repaint NACH dem
`pipe-pane`-Anhängen), zweimal der Resize-Pfad (`// the repaint this causes is not session
activity`) und der Eigen-Paste-Pfad (`OWN_PASTE_QUIET_MS`, damit Fleets eigene eingefügte Nutzlast
nicht als Agentenarbeit zählt). Alle vier sagen dasselbe: **die gleich eintreffenden Bytes sind
UNSERE.** Das ist eine Aussage über die AKTUALITÄT — den Aktivitätspunkt — und sie bleibt in Kraft.

`lastOutput === 0` trägt aber eine ZWEITE, andere Tatsache: diese Pane wurde noch nie gesehen.
`lane-signals.ts` liest sie als `observed` (Klausel in `STALLED_RULES` und damit in `SPENT_RULES`),
`program-phase.ts` verweigert über `laneFactsKnown` das Urteil (R10). Das Ruhefenster hat bis heute
BEIDE Tatsachen unterdrückt, obwohl es nur für die erste ein Mandat hat — und weil `s.offset` zwei
Zeilen darüber IMMER vorgeschoben wird, war der Stoß danach verbraucht. Der Schnitt gibt dem Fenster
sein Veto über die AUFFRISCHUNG und nimmt ihm das Veto über den ÜBERGANG.

**Die Weitung ist konstruktiv begrenzt.** Der Zweig kann je Besetzung höchstens EINMAL feuern, denn
der einzige Schreiber der 0 ist der Teardown, der auch `s.cwd` löscht. Und er behauptet NICHT, dass
ein Agent da ist: das ist `alive` (`paneAgentAt`), eine eigene ps/pgrep-Sonde, und `canDeliver`s
frisches `not-alive`-Tor ist unberührt.

**Gemessen, beide Richtungen, gleiche Konstruktion, serielle Läufe auf dieser Maschine (2026-09-05):**

| Server | Vorbedingung hergestellt | `lastOutput` nach dem Fenster | Verdikt |
| --- | ---: | --- | --- |
| `5986afa` (unrepariert) | 5/5 in der ersten Runde | `0` in 5/5 | ROT 5/5 |
| derselbe Baum + der Schnitt | 5/5 in der ersten Runde | gestempelt in 5/5 | GRÜN 5/5 |

Die Rohzahlen einer Öffnung, mit einem 1-ms-Sampler auf der Stream-Datei (beide Fassungen
identisch): die Seed-Aufnahme erscheint bei ~`tOpen−220 ms` mit **2 B**, der `pipe-pane`-Anschluss
lässt die eigene Bemalung der Pane bei ~`tOpen−190 ms` herein (**281 B**), der Rest des Repaints
setzt sich bis ~`tOpen+190 ms` (**326 B**). Danach schweigt die Pane für immer. `quietUntil` wird
zwischen den ersten beiden gesetzt — **das erste Byte JENSEITS des Seeds ist also das Öffnen des
Fensters**, und genau daran erkennt die Sonde, ob ihr Tick drin lag.

**Die Sonde, und warum sie eine Schleife ist.** `e2e/slots.ts` trägt sie jetzt als Paar:

- `probe: slot 3's only burst arrived early and the tick that consumed it ran inside the quiet
  window` — die Vorbedingung, die als SIE SELBST fällt.
- `a stream burst consumed inside a quiet window still ends the pane's never-observed state` — die
  Invariante.

Der Defekt ist ein Rennen, das die Sonde nicht steuert: ein Tick, der HINTER das Fenster fällt,
verzehrt denselben Stoß auf dem gewöhnlichen Weg und stempelt — dann ist nichts zu messen. Jede
Runde stellt darum ihre eigene Vorbedingung her (alle Bytes tief im Fenster gesetzt UND der Stempel
entweder abwesend oder ab dem ersten Byte jenseits des Seeds) und darf nur dann urteilen; vier
Runden, und das Ausgehen der Runden wird ALS DAS gemeldet. Die dritte Klausel ist nicht kosmetisch:
ohne sie ging die Sonde auf dem UNREPARIERTEN Server in **1 von 3** Läufen grün, weil ein Tick den
2-Byte-Seed verzehrte, bevor das Fenster überhaupt existierte (mit ihr: 0 von 5).

**Die Setup-Zeile ist ebenfalls repariert, als eigener Schnitt.** `waitDoneLooking` in
`e2e/programs.ts` führt jetzt `row.lastOutput > 0` als eigene Klausel — vorher war
`now - row.lastOutput >= 3000` bei `lastOutput === 0` trivial erfüllt (`now - 0` ≈ 1,79e12 ms) und
die Zeile behauptete „live lane, idle, clean, ahead" über eine nie beobachtete Pane. Ein Ausfall
dieser Vorbedingung fällt jetzt an der Setup-Zeile, mit `why` = der letzten Zeile, an der der Wait
aufgab, statt drei Checks später als Projektionsfehler.

**WAS DAMIT NICHT ERKLÄRT IST — der Regime-Wechsel selbst.** Der Sprung von ~1 % auf über 90 % am
09-04-Nachmittag bleibt UNGEKLÄRT. Was diese Messung dazu beiträgt, ist ein Ausschluss und eine
Unbequemlichkeit: auf einer ruhigen Maschine wird der Anschluss-Stoß in 11 von 11 Öffnungen INNERHALB
des Fensters verzehrt, also war der 93-%-Zustand der NORMALFALL dieses Mechanismus und nicht die
Ausnahme — was erklärungsbedürftig ist, sind die grünen Läufe VOR dem 09-04, nicht die roten danach.
Die naheliegende Vermutung ist, dass der Echo-Stoß der gepasteten Gründungs-Nachricht früher
regelmäßig HINTER dem Fenster landete und ab dem 09-04 davor; das ist eine Hypothese, für die hier
KEINE Messung vorliegt. Praktisch ist die Frage für diesen Check erledigt — der Anschluss-Stoß
existiert immer und zählt jetzt immer — und damit auch nicht mehr über ihn beobachtbar. Wer sie
weiterverfolgen will, braucht einen anderen Sensor als `projection nextAction`.

### 11.2p Eine achtzehnte Familie: der `requeue-teardown-empty`-Rest, der zwölf `backlog nudge`-Checks mitreisst (2026-09-04 — EINE SICHTUNG, Mechanismus vollstaendig aus dem Trail gelesen, Regress strukturell ausgeschlossen; NICHT repariert)

Gefunden beim Adjudizieren des roten Post-Land-Audits `at=1788550781547` (Lauf
`isolated-20260904T190127Z-33824`, 3 649 Checks, **17 FAILURES**). Erster Akt des Programs
„Audit-Determiniertheit 2026-09".

**Siebzehn Fails, aber nur DREI Wurzeln — und eine davon zieht zwoelf mit.**

Gruppe A, die Wurzel (`e2e/tasks.ts`, requeue-Probe):

- `requeue probe (empty): the row went back to queued through the GATE, not some other path`
- `an empty lane is torn down by its own requeue — no worktree left behind`
- `…and no slot left held by it either` (detail: `slot=5`)

Gruppe B, die KASKADE (zwoelf Checks, alle `backlog nudge …`): die Setup-Zeile der Sektion sagt
woertlich `backlog nudge setup: the only open row is a pending kind:notiz observation` — und ihr
Detail zeigt, was sie stattdessen fand: die Zeile `e7fa35c3` mit `"kind":"auftrag"`,
`"status":"pending"`, Text `requeue-teardown-empty`. Das ist der Rest aus Gruppe A. Die zwoelf
Checks danach massen ein VERSCHMUTZTES Register und fielen als der Vertrag, den sie pruefen —
`backlog nudge: kind:notiz NEVER counts as backlog`, `… honors quiet hours`, `… sends exactly one
slot in the round`, und so weiter. Zwei von ihnen nennen als Ziel `slot 5`: denselben Slot, den
Gruppe A nicht freigegeben hat.

Gruppe C, zwei Einzelfaelle ohne Verbindung zu A: ein Mitglied der succession-pane-Familie
(`…and delivers it WHOLE once that marker appears`, Detail
`500 {"error":"successor delivery held (not-alive)"}` — dieselbe Signatur wie dort registriert) und
`§2b a top-level module the server imports is still a deploy` (`behindCount:1, codeBehind:false`).

**Basisrate, aus dem lokalen Trail-Register** (7 Tage bis 2026-09-04, `suite=isolated`; gezaehlt nur
Laeufe, in denen die Gruppe ueberhaupt lief):

| Gruppe | rote Laeufe / Laeufe | Baeume |
| --- | ---: | ---: |
| `requeue probe (empty)` | 1/177 | 1 (dieser Lauf, `tree:null`) |
| `an empty lane is torn down by its own requeue` | 1/177 | 1 |
| `…and no slot left held by it either` | 1/177 | 1 |
| `backlog nudge …` (zwoelf Checks) | 1/170 | 1 |
| `§2b a top-level module …` | 1/169 | 1 |

**Warum das trotz n=1 kein Regress ist, und zwar ohne Rerun:** der Audit-Baum `f588287` besteht
gegenueber seinem Vorgaenger aus genau drei Commits, und ihr gemeinsamer Diff ist
`docs/verify-tiering.md` (+10), `HANDOFF.md` (+15) und `fleet-watchdog.service` (+9/−4). Kein
`server.ts`, kein `e2e/`, kein Wrapper, kein `src/`. Ein Regress im requeue-Teardown oder im
backlog-nudge-Pfad ist aus diesem Diff strukturell unmoeglich. Verdikt entsprechend **flake** —
hergeleitet aus dem Diff und dem Register, nicht aus einem gruenen Wiederholungslauf.

**Warum sie hier steht, obwohl 0,6 % die niedrigste Rate aller registrierten Familien ist:** ihr
Radius. Eine einzige nicht gehaltene Vorbedingung erzeugt SIEBZEHN rote Zeilen und damit ein rotes
Audit, das wie ein Flaechenbrand aussieht. Sie ist das reinste Exemplar der Klasse, die das Regelbuch
so formuliert: **eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern.** Der Schnitt ist
zweiteilig und beide Haelften sind billig: (1) die requeue-Probe raeumt ihre Zeile und ihren Slot
auch auf dem Fehlerpfad ab, (2) die `backlog nudge`-Sektion bricht ab, wenn ihre Setup-Zeile rot
ist, statt zwoelf Vertraege gegen ein fremdes Register zu messen.

**Fuer einen Leser eines roten Laufs:** siebzehn Fails heissen hier nicht siebzehn Befunde. Zuerst
die Setup-Zeilen der betroffenen Sektionen lesen — ist eine davon rot, sind die Checks darunter
UNGEMESSEN, nicht verletzt.

**Nachtrag 2026-09-04 ~22:20 — der Wiederholungslauf ist da, und er ist gruen.** Das naechste
Post-Land-Audit lief auf Tip `1f7d410` (derselbe R1-Code, gegenueber `f588287` nur zwei
docs-Commits) als Lauf `isolated-20260904T193948Z-28477`: **3 649 Checks, GENAU EIN Fail** —
`projection nextAction …` mit dem bekannten Detail `{"with":null,"without":null,"phase":"UNKNOWN"}`
(§11.2o). Alle drei Gruppen gruen: `requeue probe (empty): … through the GATE` (Zeile 1179 in
beiden Laeufen — dort `ok:false` mit `note=lane fleet/260904190817-2afc`, hier `ok:true`),
`backlog nudge setup: the only open row is a pending kind:notiz observation`, `…delivers it WHOLE
once that marker appears` und `§2b a top-level module …`. Damit ist die Nicht-Determiniertheit
direkt bewiesen (Beweisordnung §11.7, erste Stufe) und die aus Diff und Register hergeleitete
Adjudikation bestaetigt. Basisrate der Wurzelgruppe damit 1/178.

**Der Paar-Versuch (2026-09-04 22:17–00:33, seriell, nie parallel).** Zwei `./e2e-isolated.sh` auf
demselben Baum (`acbac59`), die einzige Differenz ist der Flag: Arm B mit dem gestateten
`FLEET_LANE_AUTOCLOSE=0`, Arm A auf einer Scratch-Kopie desselben Baums, in der genau die zwei
Pin-Stellen entfernt sind, gefahren mit `FLEET_LANE_AUTOCLOSE=1` im Env.

| | Checks | Fails | Arbeitsdauer | Mutex-Wartezeit |
| --- | ---: | ---: | ---: | ---: |
| Arm B (`=0`) | 3 641 | 1 | 1 904 s (31,7 min) | 1 s |
| Arm A (`=1`) | 3 650 | 5 | 1 985 s (33,1 min) | 4 225 s (70 min) |

**Die requeue-/backlog-Gruppe ist in BEIDEN Armen gruen** — `requeue probe (empty)` (beide
Zeilen), `an empty lane is torn down by its own requeue`, `…no slot left held by it either`, die
`backlog nudge`-Setup-Zeile und alle 28 `backlog nudge`-Checks. Die Hypothese „scharfer Autoclose
gewinnt gegen die requeue-Probe" ist damit bei n=1 **nicht bestaetigt**: der scharfe Flag allein
reicht nicht. Was der Versuch NICHT testet, ist das zweite Bein der Hypothese — beide Arme liefen
mit ~32 min nahe dem Median (30,4 min) und erreichten die 38,3 min des roten Laufs nicht; ueber
Last als zusaetzliche Bedingung sagt er nichts.

Die vier zusaetzlichen Fails in Arm A sind die D2-Familie und genau die erwartete Folge des
Armierens (`D2 flag off`, `D2 teardown`, `D2 setup: both closing lanes …`) — plus die neue Sonde,
die dabei ihre Arbeit tat und der Grund ist, dass diese vier lesbar sind:

    FAIL  D2 setup: the suite server states FLEET_LANE_AUTOCLOSE=0 in its own environment
          — the off-state below is pinned, not inherited  ({"srvReadable":true,"srv":"1","runner":"1"})

Sie nennt die falsche PRAEMISSE beim Namen (`srv:"1"`, und `srvReadable:true` als Kontrolle), statt
die drei Zeilen darunter wie einen kaputten Lane-Schluss aussehen zu lassen.

**Nebenbefund fuer Audit-Determiniertheit:** §11.2o (`projection nextAction`) fiel in BEIDEN Armen —
der Autoclose-Zustand aendert seine Rate also nicht. Im lokalen Trail-Register (2026-09-01 bis
2026-09-04, 39 Dateien, 33 Laeufe mit dieser Zeile) stand sie vor dem Paar bei 3/33; mit beiden
Armen 5/35.

**Und die Hypothese, die dabei geprueft und WIDERLEGT wurde:** die requeue-Probe fiel mit der Note
`lane closed before landing — review and requeue if still wanted`, was nach einem vom Audit-srv
geerbten `FLEET_LANE_AUTOCLOSE=1` aussieht (`watchdog.sh` bewaffnet den Flag seit `566cbae`). Zwei
Messungen sagen nein. (1) Der Flag erreicht die Audit-Suite nicht: `server.ts#runPostLandAudit`
spawnt durch `server.ts#auditChildEnv`, das JEDE `FLEET_*`-Variable verwirft — direkt am Prozess
gemessen (2026-09-04, ein Variablenname je Prozess gefiltert ausgegeben): live srv
`FLEET_INSTANCE=mac` traegt `FLEET_LANE_AUTOCLOSE=1`, die Audit-Suite-Server
`FLEET_INSTANCE=e2e-isolated` tragen sie nicht, waehrend `FLEET_PORT` in derselben Abfrage lesbar
ist (die Kontrolle, die „nicht gesetzt" von „nicht lesbar" trennt). (2) Die Note diskriminiert
ohnehin nichts: sie wird von `server.ts#teardownSlotOccupant` geschrieben, dem generischen
Occupant-Abbau, den JEDER Schluss durchlaeuft — Hand-Kill, Probe, Autoclose gleichermassen. Die
Env-Naht ist trotzdem real, nur an einer anderen Stelle (§6, `runVerify` filterte nicht) und seit
demselben Tag gestated statt geerbt. **Nachtrag 2026-09-05:** diese zweite Stelle ist geschlossen —
`runVerify` spawnt jetzt durch `server.ts#verifyChildEnv`, nach derselben Regel; vorher/nachher am
Kind gemessen (14 `FLEET_*`-Namen → 0, PATH unveraendert), §6.

### 11.2q Eine neunzehnte Familie: die Q6-`fleet-report`-Sektion in `e2e/programs.ts` — die gepflanzte Zeile bleibt auf `send-uncertain` stehen (2026-09-06 registriert; Rate ueber das GANZE lokale Register gerechnet, Mechanismus aus den Trail-Details gelesen; NICHT repariert)

Registriert vom Program-MAIN „Audit-Determiniertheit 2026-09" (Slot 7) als erster Akt nach der
Uebernahme. Die Vorgaengerin hatte die Familie als „gemessen, aber nicht registriert" uebergeben,
mit der Zahl **5/83 = 6,0 %**. Diese Zahl ist beim Nachrechnen ueber das ganze Register **nicht
bestaetigt worden** — sie untertreibt, und sie beschreibt die Familie als EINEN Check, was sie
nicht ist.

**Gemessen 2026-09-06 ueber das lokale Trail-Register** (`e2e-trail/isolated-*.jsonl` plus die
Audit-Trails unter `$TMPDIR/fleet-e2e-trail`, 814 Laeufe; gezaehlt nur Laeufe, in denen die
Q6-Sektion ueberhaupt lief):

| | |
| --- | ---: |
| Laeufe mit Q6-Sektion | 127 |
| Laeufe mit mindestens einem roten Q6-Check | **11 = 8,7 %** |
| verschiedene Baeume unter den roten Laeufen | 9 (+2 Laeufe mit `tree:null`) |
| Zeitraum | 2026-09-01 bis **2026-09-06 04:00** |

Damit ist sie zum Zeitpunkt dieser Registrierung die **hoechste Basisrate aller offenen Familien** —
hoeher als §11.2o (4/11 auf drei Baeumen, inzwischen repariert), §11.2n (2/11) und §11.2m. Neun
verschiedene Baeume schliessen einen Regress eines einzelnen Commits strukturell aus; der juengste
Fail liegt auf `a5cfdaf` und ist zwei Stunden vor dieser Zeile entstanden.

**Zehn Checks, aber nur ZWEI Eintrittsstellen.** Pro rotem Lauf den ERSTEN roten Q6-Check gezaehlt:

| erster roter Check | Laeufe |
| --- | ---: |
| `Q6 fleet-report cap: zero, negative and non-numeric FLEET_REPORT_RECOVERY_MAX_ATTEMPTS fall back to the default of 5 …` | 9 |
| `Q6 fixture: the retryable report row parks its fifth attempt at the recovery latch under cap 6` | 2 |

Die uebrigen acht `Q6 …`-Zeilen sind in KEINEM Lauf die erste rote — sie sind Kaskade, nicht Befund.
Das ist dieselbe Form wie §11.2p: wer neun rote Q6-Zeilen sieht, hat einen Befund vor sich, nicht
neun.

**Die Signatur, aus den `detail`-Feldern der elf Laeufe gelesen** — in allen elf steht dieselbe
Zeile, und sie ist in **zehn von elf** identisch geformt:

```
"status":"send-uncertain", "deliveredAt":null, "acknowledgedAt":null
```

mit `attempts:1` in den neun Cap-Faellen und `attempts:5` in den zwei Fixture-Faellen. Der elfte
(`d63bb91`, 2026-09-02) ist der einzige mit einer anderen Form: `rounds` dreimal `[null,null]` bei
einer bereits `acknowledged`-Zeile.

**Was das heisst, und wo die Grenze der Lesung liegt:** `send-uncertain` ist ein
TRANSPORT-Ausgang — gepastet wurde, der Annahme-Marker wurde nicht beobachtet. Die Sektion pflanzt
eine Report-Zeile und misst danach einen Vertrag ueber deren `attempts`-Zaehler; bleibt die Zeile
schon beim ERSTEN Zustellversuch auf `send-uncertain` stehen, misst der Cap-Check einen Zaehler, der
nie gelaufen ist. Das ist die Wurzel-KLASSE, nicht die Wurzel: **warum** der Marker unter Last
ausbleibt, ist hier NICHT gemessen (dieselbe offene Frage wie bei der Acceptance-Sonde, Notizen
`6c7d98ff`/`ca085489`). Was ohne weitere Messung feststeht: die Sonde faellt heute als der VERTRAG,
den sie prueft, obwohl ihre Vorbedingung nicht hergestellt war — der Schnitt, den das Regelbuch
verlangt (*eine Sonde, die nicht laufen konnte, muss als SIE SELBST scheitern*), ist hier noch nicht
gezogen.

**Fuer den Leser eines roten Laufs:** eine rote Q6-Zeile mit `send-uncertain` im Detail ist bis auf
Weiteres diese Familie und kein Regress am `fleet-report`-Pfad. Eine rote Q6-Zeile OHNE
`send-uncertain` ist es nicht und gehoert dem, der sie sieht.

### 11.2r Eine zwanzigste Familie: das Watch-Idempotenz-Paar in `e2e/watch.ts` — und die Haelfte der Sichtungen ist per Konstruktion unattribuierbar (2026-09-06 registriert; Mechanismus AM PROBENCODE gelesen; NICHT repariert)

Ebenfalls aus der Uebergabe („gemessen, aber nicht registriert", dort als ein Paar mit 4/557 auf
vier Baeumen gefuehrt). Nachgerechnet zerfaellt es in zwei Checks mit verschiedenen Nennern:

| Check | rote Laeufe / Laeufe | Baeume |
| --- | ---: | ---: |
| `re-subscribing to the same target returns the SAME watch, never a second` | 4/568 = **0,70 %** | 4 |
| `delete the spent transport Watch` | 3/461 = **0,65 %** | 2 |

Zwei der drei `delete`-Fails liegen auf EINEM Baum (`9db4b85`, 2026-08-16) und damit vor der ersten
Sichtung des ersten Checks; der dritte (2026-09-05, `2c40368`) faellt im selben Lauf wie dieser.
Das stuetzt die Lesung „Folgefehler", beweist sie aber nicht — `delete the spent transport Watch`
uebergibt `check()` **kein `detail`** und ist daher aus dem Register grundsaetzlich nicht
attribuierbar. Das ist der erste, billigste Schnitt an dieser Familie.

**Der eigentliche Befund steht im Probencode, nicht in der Rate** (`e2e/watch.ts`, der Check bei
`re-subscribing to the same target …`): die Bedingung ist eine Konjunktion aus DREI Teilen —

```
wDup.existing === true && wDup.watch?.id === wAJ.watch.id
&& (await watchRows()).filter((w) => w.slot === aId && w.armed).length === 1
```

— und das `detail` druckt **nur den Id-Vergleich**: `` `${wDup.watch?.id} vs ${wAJ.watch.id}` ``.
Die vier Sichtungen zerfallen damit exakt entlang dieser Luecke:

| Lauf | `detail` | lesbar? |
| --- | --- | --- |
| 2026-08-24 `210fcd9` | `4877e0aa vs 4877e0aa` | **nein** — Ids GLEICH, rot |
| 2026-09-03 `tree:null` | `7b5d1f1e vs 7b5d1f1e` | **nein** — Ids GLEICH, rot |
| 2026-08-25 `5649879` | `af91e664 vs 56af7474` | ja — echt zweites Watch |
| 2026-09-05 `2c40368` | `62912fb5 vs 5fc3c077` | ja — echt zweites Watch |

**In zwei von vier Sichtungen ist der gedruckte Vergleich byte-identisch und der Check trotzdem
rot.** Der Leser schliesst daraus korrekt gar nichts: der fallende Konjunkt ist einer der beiden
NICHT gedruckten — `existing !== true`, oder die Zaehlung `armed`-Watches dieses Slots ist nicht 1.
Der dritte Konjunkt ist dabei der Verdaechtige, nicht der zweite: er zaehlt ueber den GESAMTEN
armed-Bestand des Slots und ist damit von allem abhaengig, was die Sektion vorher an Watches
liegengelassen hat — eine Zustandsabhaengigkeit, keine Idempotenz-Aussage.

**Der Schnitt ist zweiteilig und beide Haelften sind billig, keine ist eine Abschwaechung:**
(1) die drei Konjunkte einzeln pruefen und das `detail` das nennen lassen, was tatsaechlich fiel;
(2) `delete the spent transport Watch` ein `detail` geben. Danach ist die Familie ueberhaupt erst
messbar — heute ist die Haelfte ihrer Sichtungen ein Loch im Register, kein Datenpunkt.

**Fuer den Leser eines roten Laufs:** steht dort ein Id-Paar mit ZWEI GLEICHEN Ids, ist das keine
Aussage ueber die Idempotenz und kein Befund am Watch-Pfad — es ist diese Registerluecke. Stehen
zwei VERSCHIEDENE Ids da, ist wirklich ein zweites Watch entstanden, und das gehoert dem, der es
sieht.

### 11.2s Eine einundzwanzigste Familie — und die ERSTE mit einem gemessenen HOST-Unterschied: die D2-Vorbedingung in `e2e/watch.ts` las den Git-Anzeigecache, bevor er die Fixture-Writes tragen konnte (2026-09-06 — Wurzel aus elf hochgeladenen Helfer-`suite.log` gelesen, REPARIERT auf `fleet/260906075319-2fb8`, auf BEIDEN Hosts gruen bewiesen)

`D2 setup: both closing lanes reached the spent shape, and every refusing lane differs from them in
exactly one fact` ist die erste Familie dieses Registers, deren Ausgang mit dem HOST korreliert
statt mit einer Rate:

| Host | rot / Sichtungen | Quelle |
|---|---|---|
| dieser Mac | **0 / 40** | Direktscan `e2e-trail/isolated-*.jsonl` |
| second-host (Debian) | **9 / 11** | die elf `suite.log` unter `streams/helper-artifacts/26ea1a205005/` |

Die 40 lokalen Sichtungen liegen auf 30 verschiedenen Baeumen und sind ausnahmslos gruen; die eine
rote Sichtung, die §11.2p zu dieser Zeile notiert, gehoert NICHT hierher — sie stammt aus dem Arm
mit `FLEET_LANE_AUTOCLOSE=1`, den die Praemissen-Sonde daneben korrekt als falsche PRAEMISSE
ausgewiesen hat.

**Die Wurzel ist KEINE Klausel von `SPENT_RULES`.** `stalled` war in JEDEM der neun roten
Second-host-Laeufe fuer alle sieben Lanes `true` — anders fielen die GIT-Zahlen der fuenf REFUSER
aus. Sieben der neun lasen alle sieben Lanes als `dirty:0 ahead:0`:

    FAIL  D2 setup … ([[7,true,{…"dirty":0,"ahead":0}],[8,true,{…"dirty":0,"ahead":0}],
                       [9,true,{…"dirty":0,"ahead":0}],[10,true,{…"dirty":0,"ahead":0}],
                       [11,true,{…"dirty":0,"ahead":0}], …])

Erwartet waren dort `9: dirty=1` (die uncommittete Datei) und `10/11: ahead=1` (der
Kandidaten-Commit).

**Der Mechanismus, und zwei Laeufe nennen ihn woertlich.** Die servierten `git`-Zahlen sind der
~10-s-Anzeigecache von `server.ts#tickGit`, kein frischer Read. Die alte Schleife wartete
ausschliesslich auf die zwei SCHLIESSENDEN Lanes — genau die zwei, deren Fakten der
Fixture-Schreibvorgang nicht anfasst — und war fertig, sobald die 3-s-Idle-Uhr durch war
(`msSincePrev` liegt in allen 40 lokalen Sichtungen zwischen 3110 und 3195 ms). Die fuenf Refuser
las sie danach aus demselben Schnappschuss, bis zu 10 s bevor er wahr sein konnte. In den Laeufen
`1788541056390` und `1788609298225` hat der Tick die Schreibsequenz MITTEN drin erwischt: Slot 9
noch sauber, waehrend Slot 10 UND 11 `dirty:1 ahead:0` tragen — ein Durchlauf, der die erste Lane
vor ihrer Datei passierte und die beiden anderen zwischen Datei und Commit.

Ob der Schnappschuss frisch genug war, ist damit ein Rennen zwischen der DURCHLAUFDAUER des
Boot-Ticks und den Fixture-Writes — und diese Dauer ist genau das, was zwischen den Hosts
verschieden ist: `tickGit` bezahlt pro Slot rund ein Dutzend Subprozesse (tmux, ps/pgrep, mehrere
git), und Prozess-Spawn ist auf Linux um ein Vielfaches billiger als auf macOS.

**Die Wurzel liegt NICHT im Server.** `tickGit` ist ein dokumentierter Anzeigecache und verhaelt
sich wie spezifiziert; die Sonde las ihn und nahm Frische an.

**Der Schnitt:** die Sonde wartet auf die GANZE Form statt auf zwei Siebtel davon. Die Klauselliste
ist pro Lane benannt (`d2Want`) und IST die Behauptung — es gibt kein zweites, davon abweichendes
Wartepraedikat mehr —, ausgewertet auf dem Schnappschuss, der sie erfuellt hat, und ein
Schnappschuss pro Runde statt eines Fetches pro Lane. Nichts geskippt, nichts geloescht, dieselben
sieben Klauseln, dieselbe 60-Runden-Grenze.

**Der Beweis, drei Laeufe auf zwei Hosts** (Baum `472a850f` — die Reparatur, als LANE-Sha auf
`fleet/260906075319-2fb8`. Das ist der Wert, den die Trail-Zeilen dieser drei Laeufe im Feld
`tree` tragen, und genau deshalb bleibt er hier stehen; auf `main` loest er nach dem Rebase-Land
NICHT auf. **Gelandet ist dieselbe Arbeit als `2a06185` (Sonde) + `15f0d7e` (dieser Abschnitt),
2026-09-06, beide per `git merge-base --is-ancestor` gegen `main` geprueft** — ein Rot auf
`D2 setup …` NACH `2a06185` ist wieder ECHT und gehoert dem, der es sieht. Die Lane-Sha wurde
ERGAENZT und nicht ersetzt: sie ist der Join-Key ins Trail-Register, kein Reparatur-Zitat):

| Lauf | Host | D2 setup | `msSincePrev` | Suite |
|---|---|---|---|---|
| `isolated-20260906T084037Z-46610` | Mac | PASS | 3 113 ms | ALL PASS |
| `isolated-20260906T082246Z-452246` | second-host | PASS | **10 300 ms** | ALL PASS, `ran 3751 / failed 0` |
| `isolated-20260906T100031Z-48319` | Mac, MUTIERT | FAIL | 62 174 ms | Abbruch nach der Zeile |

Die 10 300 ms des Second-host-Laufs sind die Messung selbst: dort musste die Sonde auf den naechsten
10-s-Tick warten, lokal war die Form nach den drei Idle-Sekunden schon da. Der Mutationslauf (die
`Bun.write` der dirty-Lane auskommentiert, danach zurueckgenommen) zeigt, dass die Zeile weiter
fallen KANN und dabei sich selbst nennt:

    {"unmet":["9: dirty=1 (the uncommitted file is served)"], "slots":[…,[10,false,{…"ahead":1}],
                                                                        [11,false,{…"ahead":1}],…]}

— nur die mutierte Tatsache fehlt, die beiden ahead-Lanes haben ihre Form erreicht.

**Nebenbefund, NICHT dieser Zeile gehoerend:** `projection nextAction: a REVIEWABLE row of a
promoted Program …` (§11.2o) faellt in **11 von 11** Second-host-Laeufen gegen 2,9 % lokal. Das ist
die zweite Familie mit dieser Signatur und die groesste verbleibende Quelle roter Remote-Audits.

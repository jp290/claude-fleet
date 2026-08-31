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
`tree:null` on every row. **A §11.6 query over `e2e-trail/` alone therefore silently omits every
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

### 11.2j A twelfth family: the `pi-unfenced` watch-delivery quartet (2026-08-31, filed — NOT repaired, discriminator NOT isolated)

**Status: open, and weaker than the entries above it** — non-determinism is proven, the CAUSE is
not. Filed from the Generalsanierung P0 baseline, where it cost the baseline itself.

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

**Post-mortem discriminator.** Unlike §11.2i this family fails as REAL failing checks, not as a
silent no-measurement: the runs carry 3345/3344 PASS and named FAIL rows. Preserved instances from
the two red runs are kept: `fleet-e2e-instance-80791` (run 2) and `fleet-e2e-instance-26770`
(run 3) — neither has been dissected.

**Consequence for the Generalsanierung.** A red on these lines is a flake candidate; a red anywhere
else is still ECHT and still yours. But the P0 baseline demands three CONSECUTIVE green runs, and
until this family is either repaired or its discriminator isolated, that baseline is only
obtainable under the stated conditions (clean tree, controller idle) — which is itself a finding
about what this machine can prove while seven sessions share the checkout.

**Bookkeeping:** twelfth family (three in §5b · §11.2 · §11.2b · §11.2c · §11.2e · §11.2f ·
§11.2g · §11.2h · §11.2i — eleven before this). The count was pulled through on 2026-09-01: the
fragment `rulebook/lane-discipline.md` says "Zwoelf bekannte Flake-Familien" and `CLAUDE.md` was
re-rendered from it. Both are gitignored, so no commit carries that change — on a drift suspicion,
re-render (the command is in the head of `rulebook.ts`).

### 11.2k A thirteenth family: the raw-review persist race in `e2e/outcomes.ts` (2026-09-01, filed — 2 occurrences, cause not isolated)

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

Same bytes, twice red, twice green ⇒ non-determinism proven directly; neither `01459c9` (client
+ `e2e/tasks.ts` only) nor W1 (moves + path literals) touches the review/outcome path.

**Mechanism hypothesis, unverified but shaped like §11.2f:** the fixture clicks
`POST /api/slots/:id/review`, asserts only that the click RETURNED, and kills the lane
immediately after; the outcome row is written at kill. If the review job is still writing its
verdict when the kill lands, the row is minted with `review.state:"none"` — a completion the
fixture never waited for. The neighbouring 9a check (superseded) commits between click and kill
and has never fallen. Nobody has dissected a kept instance yet; whoever repairs this starts at
whether the review result is persisted synchronously with the click or joined at kill time.

**Bookkeeping:** thirteenth family. Both audits are adjudicated `flake` on the ledger with this
section as the stated reason. A red on this line is now a flake candidate; a red anywhere else in
`e2e/outcomes.ts` is still ECHT and still yours.

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

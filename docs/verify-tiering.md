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
2. **A verify timeout is recorded as a failure, not as a non-measurement (§5).** `runVerify`
   returns `ok: !timedOut && code === 0` (`server.ts:2550`), so a timeout is `ok:false` — it stops
   the land *and* writes `verified:false` to the outcome ledger, although the project has an
   `ok:null` "nothing was measured" state one line away. *Cost:* the same number-poisoning
   `gate-coverage.md` §4 documents for `verified:true`, in the opposite direction, and it gets
   worse with every second added to the gate.
3. **The gate has zero coverage of the land path — and tier 2's trigger lives there (§3, §6d).**
   `grep` for `landLane|advanceIntegration|recordLand|emitLaneOutcome|runCleanReview|undoLast` in
   the gate harness = 0. `schedulePostLandAudit` is called from `recordLand`. *Cost:* one
   regression can take out the undo record and the auditor together, and its symptom is an empty
   trail — indistinguishable from "nothing landed". The auditor cannot audit its own trigger.
4. **`undo-land`, the rollback tier 2 names, is a one-land, until-the-next-land guarantee (§6c).**
   One record per repo (`server.ts:2599`); the route refuses *and deletes the record* once main
   moved past it. *Cost:* in the exact burst tier 2's coalescing was built for (three lands in
   ~110 s), the earlier lands are already un-undoable when the audit reports on them.
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
| **(a) the live gate**, exactly as `watchdog.sh:57` builds it | **46.9 s** | 46.8 – 47.1 s | 0, 0, 0 | 47052 / 46911 / 46809 |
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
- **That script's cost is mostly scheduled waiting, not work.** Unconditional sleeps:
  `fleet-e2e-claude-gate.ts:45,50,63,68` are 1500 + 7000 + 1500 + 7000 ms, plus `sleep 2` in
  `e2e-claude-gate.sh:73` — ≥ 19 s of the ~45 s is the harness waiting for panes to settle, before
  any polling loop. INFERRED consequence: the gate will not get much faster on a quieter box and
  will not inflate much on a loud one, which is what the narrow span shows.
- **`bun run build` is free** (~90 ms; `Bundled 7 modules in 25ms` + `Bundled 4 modules in 13ms`).
  It is not in the gate and does not need to be — client bundles are a deploy step (CLAUDE.md), and
  no verification tier discussed here covers the client at all.

## 3. What `./e2e-claude-gate.sh` actually checks — counted, not quoted

**25 executed checks, not 26.** VERIFIED twice: `grep -n 'check("' fleet-e2e-claude-gate.ts` gives
25 call sites, and round 1's run emitted 25 `PASS` lines (`grep -c "^PASS\|^FAIL"` = 25, 0 FAIL).
`gate-coverage.md:17` says 26; `grep -c 'check(' ` gives 26 because it also counts the
`function check(name: string, …)` definition at `fleet-e2e-claude-gate.ts:21`. An off-by-one from a
grep, not a removed check.

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
`grep -c "landLane\|advanceIntegration\|recordLand\|emitLaneOutcome\|runCleanReview\|undoLast"
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
  27 `e2e/*.ts` — because `server.ts:6–8` imports the first three and `fleet-e2e.ts:10–35` imports
  the suite.
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
`server.ts:2495` (`Math.max(5_000, Number(process.env.FLEET_VERIFY_TIMEOUT_MS ?? 120_000) | 0)`) and
a grep over every `*.sh`, `*.ts` and `*.md` in the repo returns that one line and nothing else —
it is set nowhere, named in no doc. VERIFIED. The live 120 s is a default nobody chose.

**Practically: no, and the blocker is not the timeout.** Three costs, in ascending order of how
much they hurt:

1. **Per-land latency.** Clean path = gate + suite ≈ 6.4 min median (table §2). The land is
   owner-initiated (`mergeJob` is called from exactly one site, `server.ts:5299`, the merge POST)
   but the POST returns before the job finishes — the route's own comment says a conflictful rebase
   "outlives any request-held connection, never synchronous" (`server.ts:5153`). VERIFIED. So the
   owner is not blocked at the browser; the *lane* is blocked, for six minutes, and `tickAutoReview`
   skips any slot with a merge in flight (`server.ts:2285`).
2. **The repair-path multiplier.** `runVerify` runs once (`server.ts:3247`) and again after each of
   `MERGE_REPAIR_ROUNDS = 2` repair rounds (`server.ts:2475`, `:3275`) — up to **three full runs**
   for one conflicted land, ~19 min plus two resolver agent invocations. VERIFIED by reading the
   loop.
3. **Unbounded concurrency, which is the real one.** `mergeInflight` is keyed per slot
   (`server.ts:2585`, set at `:5301`) and there is no global merge lock, so *k* lanes landing
   together run *k* full suites at once — each booting its own fleet server and driving its own
   tmux socket, on the same box the live fleet's sessions run on. VERIFIED structurally. Tier 2, by
   contrast, serialises deliberately ("one repo at a time, and one run at a time across ALL repos",
   `drainPostLandAudits` in the sibling lane) — a pre-land gate has no such governor and cannot
   easily get one, because each verify belongs to a different lane's job.

And one finding about the gate **as it stands today**, which raising the content would sharpen:

> **A verify timeout is recorded as a failure, not as a non-measurement.** `runVerify` returns
> `ok: skipped ? null : !timedOut && code === 0` (`server.ts:2550`) — so a timeout is `ok:false`,
> which stops the land *and* writes `verified:false` onto the outcome row. The project has a third
> state for "nothing was measured" (`ok:null`, the SKIP contract, `server.ts:2518`, `:2550`) and a
> timeout does not use it. Today's headroom is 120 s against a measured 45–48 s gate (~2.5×), which
> is fine; at 66–74 s (my proposal, §8) it is 1.6×, and at 384 s it is negative. INFERRED, not
> observed: I saw no timeout in any of the 19 suite runs measured here. The cost is that a machine-load artefact enters K1 as a
> red verdict about a lane's *work* — the same class of number-poisoning `gate-coverage.md` §4
> already documents for `verified:true`.

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
  (`e2e/review.ts:177`). The check sets the stand-in reviewer's delay to 6 s, fires a review
  without awaiting it, sleeps 1500 ms and kills the slot, expecting to catch the review in flight.
  What was recorded instead was
  `{"state":"superseded", …, "scope":"uncommitted changes plus recent commits (no lane base to diff against)", "notes":"no code changes in scope — nothing to review", "findings":[]}` —
  i.e. the review short-circuited before the stand-in was ever spawned, so the 6-second delay never
  applied and nothing was in flight at t+1500 ms. **This is the interesting one:** the check did not
  merely miss a deadline, it silently fell into a *different code path*. I did **not** root-cause
  why `laneBaseRef` yielded no base in that run (§9).
- `a second send of the same kind×slot within the episode window is 429` — got **409**
  (`e2e/steward-core.ts:208–211`). The first send's paste echo resets the target pane's idle clock,
  and `canDeliver` runs *before* the cap gates — the harness knows this and waits it out before the
  *next* send (`e2e/steward-core.ts:223–225` says so in as many words) but not before this one. Under
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
file:line and a mechanism, and a third (`e2e/review.ts:177`) whose mechanism I could only partly
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
  "↩ undo-land is the rollback" suggests. VERIFIED at `server.ts:5121–5148`: `undoLast` holds **one
  record per repo** (`server.ts:2599`), and the route refuses *and permanently deletes the record*
  as soon as main moved past `mainAfter`, or as soon as the commit is on any remote. So in the exact
  scenario tier 2's coalescing was built for — "three lands arrived within ~110 s on 2026-07-25",
  its own comment — **the first two lands are already un-undoable by the time an audit covering all
  three reports.** The rollback exists for the newest land, and only until the next one.
- **(d) Coverage of the auditor's own trigger.** `schedulePostLandAudit` is called at the end of
  `recordLand`, the same function that writes the undo record (`server.ts:2643–2645` plus the
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

**What it already solves — do not re-propose:**

- The post-land tier exists: `recordLand` → `schedulePostLandAudit` → `git archive` snapshot of the
  integration tip into `TMPDIR` with `node_modules` symlinked → one run at a time, bursts coalesced →
  tri-state `green`/`red`/`unknown` row on `post-land-audits.jsonl`, `GET /api/post-land-audits`,
  `postLandAudit` on `/api/sessions`, rehydrated at boot, loud server-log line on non-green.
- The decisions I would otherwise have argued for are already taken and argued at the decision site:
  it gates nothing, it does not auto-undo, `unknown` is never rounded to green or red, the child
  inherits no `FLEET_*` variable (so no recursion and no live tokens), and it is **default OFF** with
  the enabling lines pre-written but commented out in `watchdog.sh:60–74`.
- 32 checks in `fleet-e2e-postland-audit.ts` plus 2 default-off non-regression checks in the main
  suite. Coalescing, non-overlap, non-blocking, the joins, the scratch-dir isolation, env scrubbing,
  and all three `unknown` shapes are each pinned.

**What it does not solve** (its own docs say the first two; the rest are mine):

1. It is off. Nothing is audited until `FLEET_POSTLAND_AUDIT_CMD` is in the srv-spawn line and
   `launchctl kickstart` has run.
2. Nothing reads the trail — no client rendering, no attribution consumer.
3. **The rollback it names is mostly unavailable in the burst case it optimises for** (§6c). Worth
   saying in the doc it ships with, because "↩ undo-land is the rollback" reads as a general
   guarantee and is a one-land, until-the-next-land guarantee.
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

**Collision surface with my proposal:** only `watchdog.sh`. They append a commented-out `AUDIT_CMD`
block *below* the `VERIFY_CMD` line (`watchdog.sh:60–74` in their tree); I propose changing the
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
already a plain `cp -R` copy and never a git repo (`e2e-isolated.sh:25–29`; it `git init`s only its
throwaway `testrepo`), and no check in `e2e/*.ts` runs git against `ROOT`
(`grep -rn ROOT e2e/*.ts | grep -i git` → empty). VERIFIED by reading, not by executing an audit
run — so the *class* of problem is excluded, not the specific run.

## 8. Proposal — the smallest step that raises what "green" guarantees

Ranked. Steps 1 and 2 are the proposal; 3 is the sibling lane's, listed so the tiering is whole.

**Step 1 — free, and removes a blind spot in the checker itself.** Add the three unimported
harnesses to the `tsc` list. Measured cost: 1.5 s → 1.538 s, no new errors (§4).

**Step 2 — 19 s, and it is the first land-path coverage the gate has ever had.** Add
`./e2e-clean-review.sh`. Why this suite and not another:

- It drives the **real clean auto-land path end to end**. Its checks assert
  `"the ok'd lane's commit reached main"` and `"the downgraded lane's commit did NOT reach main"`
  (`fleet-e2e-clean-review.ts:218,224,244,254`) — i.e. `tryScriptRebase` → `runVerify` →
  `advanceIntegration` → `recordLand` → `landLane`, the path §3 showed the gate does not touch at
  all, and the path §6d showed tier 2 depends on.
- It is the only suite that exercises `runCleanReview`, which is **live on this fleet right now** in
  `shadow` mode (`watchdog.sh:65`) and therefore runs on every clean auto-land in production.
- It is safe as a gate step: `FLEET_CMD=true`, stand-in reviewer and merge agent, `FLEET_AUTO_REVIEW_MS=0`,
  own `$$`-derived socket/port/dir (`e2e-clean-review.sh:14–16,73`) — it cannot spawn a real
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
gate at all.** `./e2e-security.sh` (46 checks) is what `docs/security-model.md:7–8` names as the
regression suite for the whole perimeter document, and `docs/README.md:157` repeats it. It is in no
gate, in no CLAUDE.md verify list, and its harness is one of the three files `tsc` never sees (§4).
It is isolation-safe on the same pattern (own port band 15200+, `FLEET_CMD=true`,
`FLEET_AUTO_REVIEW_MS=0` — `e2e-security.sh:12–17,41–52`). Measured 34.2 / 34.5 s, both green.
**I am not folding it into the recommended string**, for one reason: **n = 2 is not a burn-in**, and
§5b is precisely the lesson that a suite's eligibility is decided by repeated runs, not by two. The
honest recommendation is to run it ~10× first and then add it; with the timeout at 300 s the budget
is there (median would go 65.6 → 100.0 s, worst case 73.8 → 108.3 s).

**Proposed `watchdog.sh` `VERIFY_CMD` (owner-applied; needs `launchctl kickstart -k
gui/$(id -u)/com.claude-fleet.watchdog`, and I did not edit the file):**

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
  answer and it is not a config change: `fleet-e2e.ts:63–75` threads one mutable `LaneCtx` through
  `lanesBasic` → `lanesLifecycle` → `merge`, and `fleet-e2e.ts:5–9` states the order is load-bearing
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
  socket/port/dir make it very unlikely (`e2e-clean-review.sh:14–16`, `e2e-claude-gate.sh:13–16`,
  distinct port bands) and my runs overlapped other lanes' runs without failing, but I did not
  construct the collision deliberately.
- **Nothing measured here verifies the built client.** `bun run build` is in the table only to
  price it (~90 ms). The closest thing that exists is `fleet-e2e-security.ts:293–325`, which
  asserts *source-level* invariants — no HTML/eval sink in `src/*.ts` beyond one reviewed static-icon
  exception, no inline script in the served `public/*.html`, `src/md.ts` uses `textContent` — i.e.
  exactly the "asserted only at source-string level" caveat `lane-brief-template.md:81` names, and
  it runs in no gate today.
- **I did not root-cause the `e2e/review.ts:177` failure** (§5b) — I established what was recorded
  and that the stand-in never ran, not why `laneBaseRef` produced no base on that run. It may be a
  harness race, and it may be adjacent to the defect the sibling lane's commit `e47313e`
  ("a failed git read is not an empty diff — runReview must not fake a clean review") repairs. I did
  not test that hypothesis, and it should not be reported as if I had.
- **I did not re-derive the sibling lane's 32 checks by running them** — I read their names and the
  diff, and ran nothing in that worktree.
- **I did not read all 46 checks of `fleet-e2e-security.ts`.** I measured the suite (n = 2, which
  §8 says is not a burn-in), read its wrapper in full and its scope header and §7 client block
  (`fleet-e2e-security.ts:1–12,288–325`); the rest of what it asserts I took from
  `docs/security-model.md:7–8`, not from reading each check.

## 10. One artefact found while measuring, reported not touched

`/private/tmp/tmux-501/` holds **403 socket files**, of which 174 are `fleettest*` (the
`e2e-isolated.sh` family), 93 `fleetgatetest*` and 43 `fleetcrtest*`. Live tmux servers among them:
four, one of which has been running **2 days 1 h** — a leaked `e2e-isolated.sh` instance
(`tmux -L fleettest23870`, its `$DIR` still in `TMPDIR`). VERIFIED by `ls` and `ps`.

My own failed round-2 run added to the pile exactly as designed: `e2e-isolated.sh:215` keeps the
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

This is the merge/resolver family and it is distinct from §5b's three (`e2e/review.ts:177`, the
steward send-cap 429/409, and its audit consequence). **Not root-caused** — same state §5b left
`e2e/review.ts:177` in. Recorded so the next person does not re-derive it: nothing in the four
landed lanes touches the merge path, and the same checks pass on the same tree on a re-run.

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

### 11.5 What is script here, and what is judgment

Of the four steps this triage took, three are mechanical and one is not: taking the mutex, deciding
the machine is quiet, and re-running the same tree are scripts with no judgment in them — and two of
the three were done wrong on the first attempt, by two different sessions. Reading nine failures and
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

### 11.7 Rulebook lines proposed (text, not entered — `CLAUDE.md` is gitignored)

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

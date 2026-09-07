# Why the suites fight each other — root cause, and what to do instead of scheduling around it

Asked by the owner 2026-07-27 while wave 1 was in flight: the lanes keep queueing behind one
another and keep hitting load-shaped failures — can that be optimized or sequenced?

The short answer is that the contention is real but the doctrine built around it is treating a
**bug** as a **property**. Below: the mechanism, verified; then the three moves, in the order that
makes each one cheaper.

## 1. The house doctrine says the wrong thing about the suite

`CLAUDE.md` currently reads, in effect: *the suite is measurably non-deterministic under machine
load; serialize everything; a fail is yours until proven flake.* That treats non-determinism as an
attribute of the suite. It is not. The dominant flake family — the one that has fired four times in
24 hours and was recorded as "not root-caused" in `verify-tiering.md` §11.2 — is **one specific
unhandled error path**, and it is a product bug, not a test bug.

## 2. The mechanism (verified by reading, plus 12 on-disk failure artifacts)

> **ALLE VIER §4(a)-FIXES SIND GEBAUT** (2026-07-28; Banner nachgetragen 2026-08-05 — dieses
> Kapitel beschrieb den Vor-Fix-Zustand im Präsens und ohne Marker). Heute: Rebase UND Abort
> laufen durch `gitRetry` und der Abort-Ausgang wird ausgewertet samt Wedge-Erkennung
> (`server.ts`, grep `tryScriptRebase`); `tickGit` überspringt Slots mit laufendem Merge (grep
> `mergeInflight.has` dort); die Read-Pfade fahren `GIT_OPTIONAL_LOCKS=0` (grep `GIT_READ_ENV`);
> `gitRetry` hat inzwischen elf Call-Sites. Die Zeilennummern unten stammen vom damaligen Baum.
> Der Text bleibt als Diagnose-Historie — nichts hieraus erneut vorschlagen.

`tryScriptRebase` (`server.ts:3486-3495`) runs `git rebase main` as a pre-pass to decide whether a
lane conflicts. On failure it cleans up with:

```ts
await git(cwd, "rebase", "--abort");     // server.ts:3493 — return value discarded
```

**The exit code is thrown away.** If that abort fails, the lane is left mid-rebase with conflict
markers on disk, and nothing knows.

It fails because of `.git/index.lock` contention, and the colliding actor is **Fleet's own
poller**. `tickGit` (`server.ts:739-750`) runs `gitOpInProgress` plus `git status --porcelain=v2`
in *every* slot's cwd every 10 s, with **no guard for a merge in flight**, and is additionally
fired unawaited on every lane creation (`server.ts:1090`). The codebase already knows this hazard
and already has the remedy: `gitRetry` (`server.ts:502-509`) exists precisely because "a mutating
git op in a lane races the live session's OWN git — if it holds `.git/index.lock` we back off". It
is used at exactly **two** call sites (`server.ts:2509`, `2522` — add and commit) and **never on
the rebase path**.

The physical evidence: 12 kept failure instances in `$TMPDIR` each contain a lane worktree frozen
mid-rebase, all with the same shape — last reflog entry `rebase (start): checkout main`, **no**
`rebase (abort)` entry, **no** `rebase-merge/strategy_opts`, and raw `<<<<<<<` markers in the
worktree. No `strategy_opts` means the stopped rebase was started *without* `-X theirs` — so it is
the server's pre-pass, not the test stub's rebase. The stub (`e2e-isolated.sh:122`) then ignores
its own failed `git rebase -X theirs` and claims `"rebased"` unconditionally (`:128`), the server's
git verification (`server.ts:3657-3663`) catches the lie, and out comes the familiar
`"agent reported rebased, but the lane is not clean — fake rebased"`.

**Why load matters:** no fixed sleep is involved. It is a scaling race — the poller's sweep
duration grows with machine load *and* with open-slot count (≥4 git spawns per slot, serially),
while the test-side gap between a lane's commit and its merge POST is ~0. On a quiet box the sweep
is long finished; on a contended box it is still inside that worktree.

**Why the failing check moves between runs:** every conflict-lane check holds the identical lottery
ticket. Which one loses depends on the phase of an unsynchronised background sweep, and each new
lane creation re-triggers it.

### What this costs in production, not just in tests

Not a land-safety bug — the git verification at `server.ts:3657-3663` refuses the claim, so nothing
wrong lands. But on a real merge it means: a resolver agent is spawned (minutes, money) onto a tree
that is already wedged; the lane is left mid-rebase, so every later commit or merge on it is
refused (`gitOpInProgress`) until a human aborts by hand; and the verdict blames the agent for it.

## 3. The lock is honour-system, and the machine cannot hold it

> **CLOSED 2026-07-28, verified again 2026-08-02.** This section describes a real gap that no
> longer exists, and it is kept because the rest of the argument rests on it. `e2e-stage.sh` now
> takes `/tmp/fleet-e2e.lock` at SOURCE time (`ddc5128`), and every one of the seven wrappers
> sources it — `e2e-isolated.sh#stage_instance` included (the mutex itself is
> `e2e-stage.sh#FLEET_SUITE_LOCK`), which is the very script the post-land audit runs.
> So the automated runner does hold the lock now, and holds it by construction rather than by an
> agent remembering to. Two details the fix brought with it: the lock dir EXISTING does not mean
> the lock is held (the `pid` file inside decides, and a dead holder is reaped by the next
> contender), and a pid-LESS lock dir is a deliberate manual park that is never reaped.
> What this section got right and is still true: the discipline had to move into the machine.
> The paragraphs below are the 2026-07-27 state.

`e2e-isolated.sh` does **not** take `/tmp/fleet-e2e.lock` — the lock lives only in `CLAUDE.md`, as
an instruction to *agents* to wrap their invocations. And the post-land audit runs
`./e2e-isolated.sh` directly (`watchdog.sh:84`, `AUDIT_CMD`) with **no lock at all**.

So the one fully automated suite runner in the system is structurally incapable of respecting the
discipline that protects it. Any land while a lane is verifying puts two suites on the box, and
neither knows about the other.

## 4. Three moves, cheapest-first

**(a) Fix the race rather than scheduling around it.** Check the abort's exit code and route the
merge path's rebase/abort through the existing `gitRetry`; add `--no-optional-locks` to the
read-only pollers (a status poll has no business taking a write lock — the flag appears nowhere in
the tree today); skip `tickGit` for a slot with a merge in flight. The last one is both a
correctness fix and a load reduction. This belongs in the merge path, so it must follow wave-1 lane
`a341`.

**(b) Make the lock real and machine-held.** Move it inside the suite scripts themselves, so every
invocation serializes — lane, audit, or human — without anyone remembering. The audit's existing
burst-coalescing (`server.ts#drainPostLandAudits`: bursts fold into one run against the current
tip) already handles the queueing a blocking lock would create.

**(c) Stop running the full suite once per lane. This is the biggest cost, and it is my error.**

Measured: `e2e-isolated` is **867 checks, 5.6–8.6 min (mean 7.0, n=12)**. `e2e-claude-gate` and
`e2e-clean-review` are **26 checks each**. So per-lane verification cost is dominated roughly 10:1
by the one suite that the house rule says should not gate at all — `CLAUDE.md`: *"die volle Suite
darf aus genau diesem Grund kein hartes Pre-Land-Gate sein — sie läuft als Stufe 2 NACH dem
Land."* The audit's own design comment makes the same point from the other side: the suite "is a
property of a TREE, not of a diff", which is exactly why bursts coalesce into one run against the
tip.

My four wave-1 briefs each demanded the full battery pre-land — **more conservative than the house
rule**, and that extra conservatism is precisely what generated the contention this document is
about. Four lanes × (867-check suite + two 26-check suites), all serialized behind one lock.

The right shape: lanes run `tsc` + `build` + the two fast suites; the 867-check suite runs **once,
post-land, against the integrated tip** — where it is also more informative, because it tests what
actually landed rather than four hypothetical merges. That cuts the queue roughly 4× and removes
most of the load that triggers (a).

## 5. One caveat against over-modelling this

The audit for the `c2aa` land came back **green in 7.0 min at 09:19 while all four wave-1 lanes
were spinning up**. Across 12 audits there are 2 reds, both on 2026-07-26. The race is a *minority*
outcome under load, not a guaranteed one — "load ⇒ red" would be the wrong lesson, and a green run
under load is not evidence that a tree is clean either.

## 6. What not to change now

Wave 1 is mid-flight at 15-19% context. Renegotiating four lanes' done-criteria now costs more than
it saves, and some may already be inside a suite run. Let them finish as briefed; apply (c) to wave
2, and file (a) as its own lane behind `a341`.

## 7. The mutex is now VISIBLE — and that is all it is (2026-08-04)

§3 closed the gap where the discipline lived only in prose. What it did not close: nobody can *see*
the mutex. On 2026-08-04 two sessions ran suites at once and an isolated run died mid-flight with
`exit 144` — no log, no nameable killer, the kept instance directory the only trace. Neither session
could answer who held the lock, who was waiting, or for how long either had been true.

So the lock and the lanes' own accounts of their gate runs are projected on `GET /api/sessions`
under `gate` (`server.ts`, grep *the verify GATE*), and painted at the top of the info card
(`gateSection()` in `src/client.ts` — machine-level, above the lane story, on the owner's placement
call). Checks: `e2e/verify-queue.ts`.

**Three sources, deliberately never blended on the wire**, because they are different kinds of claim
(the third joined on 2026-08-19 — see §8):

| | `gate.lock` | `gate.reports`, `origin: "lane"` | `gate.reports`, `origin: "server"` |
|---|---|---|---|
| where it comes from | `statSync`/`readFileSync` on the lock dir | `POST /api/self/verify-intent`, a lane's self token | `mergeJob` and `drainPostLandAudits`, in the process running the suite |
| what it is | a measurement | hearsay, and labelled as such in the UI | a measurement, and labelled as such in the UI |
| if it is wrong | the filesystem lied | a lane lied, forgot, or died mid-suite | fleet lied about its own frame |
| how it ends | the wrapper reaps the dir | it ages out (`VERIFY_TERMINAL_MS` / `VERIFY_STALE_MS`) | it is deleted the instant the run is terminal — no timer |

The lock projection reproduces `e2e-stage.sh`'s own semantics rather than a simplification of them,
because every one of those distinctions is load-bearing: **no dir** = nothing held · **pid alive** =
a real holder · **pid dead** = reapable by the next contender · **no pid file** = a manual park that
is never reaped. A pid file containing `0` reads as unreadable content, not as a holder — `kill(0,
sig)` addresses the caller's own process group, so the naive probe would report the *server* as the
holder of a lock nobody holds.

**What this is NOT, each rejected on purpose:**

- **The server never reaps.** Reaping belongs to the wrappers, which re-check the pid VALUE before
  removing the dir; a second reaper would race exactly the window that design shrank to microseconds.
  *(Held until M5, 2026-09-07, and reversed there — not because the race argument was wrong but
  because its cost basis was: see §7c.)*
- **The server starts and stops nothing.** Queue *ownership* is a different feature and needs the
  data this one produces before it can be argued for at all.
- **No scheduling, priorities, or merge train.** ~6 lands/day does not pay for it (`lane-outcomes`).
- **The mkdir mutex is untouched.** It remains the whole truth of serialization; a report is advisory
  and a lane that never sends one is not treated differently by anything.

### 7b. …and since 2026-09-04 the server is also a HOLDER — in one place, and still never a reaper

The owner's answer to the lost fast-forward (`docs/self-api.md` §land) is a bounded retry: main
moved under a green land, so the chain re-rebases, **re-runs the gate** and advances again. Between
those rounds the machine must not be given away — the queueing, not the gate, is what made a repeat
expensive — so `mergeJob` takes this mutex ITSELF for the whole retry chain
(`server.ts#holdSuiteLock`, released in a `finally`), and the gate runs inside that hold rather than
queueing three more times for a lock the same process already owns.

Three lines of the design above are deliberately kept, and one is deliberately extended:

- **It still never reaps.** The bullet above is not softened by this: `holdSuiteLock` takes a free
  dir or waits, and a stale lock is left for the next *wrapper* contender to clear. The accepted
  cost is one lost retry whenever a crashed suite's lock sits there with nobody else contending —
  paid rather than enlarging the reap window this section shrank to microseconds. *(That price was
  right while the server held the lock only between retry rounds. M1 changed what a stale lock
  costs, and M5 changed this sentence — §7c.)*
- **A holder that dies leaves the reapable shape, never a park.** A `bun server.ts` outlives its own
  merge job, so a hold it lost track of would park the box for the life of the process; the release
  is therefore structural (`finally`), and the two writes are synchronous and **pid-first**, so the
  worst a death can leave is `stale` — the pid-less dir that means *manual park* is unreachable from
  this path. If the birth fingerprint cannot be measured, it refuses to hold at all, exactly as
  `e2e-stage.sh` refuses (`_st_self_birth`).
- **The hold is inheritable, and only downwards.** `FLEET_SUITE_LOCK_HELD_BY=<pid>` is exported into
  the **gate child alone** — never into `process.env`, or the post-land audit would inherit it and
  run its suite beside the next one. `e2e-stage.sh` honours it only when the lock file on disk names
  that same, still-living process: the variable alone grants nothing, so a stale export cannot make
  a suite run unserialized. An inherited step reports through the existing acquire format
  (`after 0s`), because a second format would be summed twice by `runVerify` and would fall
  `e2e/pins.ts`'s "exactly one acquire" rule.

### 7c. …and since M1 (2026-09-06) it holds on EVERY clean land — and since M5 (2026-09-07) it REAPS, and does not hold at all for the short chain

M1 (`docs/messungen/2026-09-06-merge-prozess-robust.md` §3) pulled the hold forward from *between
the retry rounds* to *before the first gate*, because that is where the queue actually was: 79 % of
the land wall clock since 2026-09-01 was spent in it, and six gates in 75 stood in it two or three
times, once per wrapper. Two sentences above were written when the server was an occasional holder
and do not survive that:

- **The hold is inheritable UPWARDS as well** (`server.ts#inheritedSuiteHolder`). A `bun server.ts`
  started from inside a suite wrapper is in the position that wrapper's own staged steps are in:
  the machine is already held on its behalf. It therefore reads `FLEET_SUITE_LOCK_HELD_BY` from the
  environment it was started with and, **only** when the lock file on disk names that pid and the
  process is alive — the same three conditions `e2e-stage.sh` applies, in the same order — runs its
  gate inside that hold instead of queueing for it. The variable still grants nothing on its own.
  Without this every clean land inside a suite queues behind its own runner: measured on
  2026-09-06, `./e2e-clean-review.sh` hung at `waitMerge` for its full 60 s the first time the hold
  was pulled forward. The three wrappers that configure a gate for their server hand it
  `$_st_lock_pid` — **the holder `e2e-stage.sh` RESOLVED, never the literal `$$`**, and the
  difference cost every code land on this box for one morning (fixed 2026-09-07, `b8b5e48`). Inside
  the live land gate those wrappers are themselves *inherited* steps: the lock file names the LIVE
  SERVER, so `$$` failed the server's "the lock file names this pid" test, the test server queued
  behind the outer hold, and the land died at `waitMerge` after 60 s. Outside a hold `$_st_lock_pid`
  *is* `$$`, so the standalone case never showed it. A pin holds the pair.
- **A death now gives the machine back on a signal.** The `finally` is structural against every path
  *through* the code and powerless against the process being killed — and the deploy ritual on this
  box IS a kill (`tmux kill-session -t srv`, ~10×/day). While the exposure was one lost ff-retry
  that was an accepted cost; with a hold on every land, a leaked lock denies **every** land until
  some unrelated wrapper contends, so `SIGTERM`/`SIGINT`/`SIGHUP` release before exiting. A SIGKILL
  or a crash still leaves the reapable shape — and **since M5 the server REAPS that shape itself**,
  which is the open question this section named being settled rather than a new idea. Measured
  inside a suite instance, where no wrapper ever contends for that lock, a leaked hold wedged 232
  server restarts' worth of lands until the run ended.

**M5 (2026-09-07, landed as `<sha>` — MAIN: replace with the real sha after the land):
`server.ts#suiteLockReapStale`, called from `holdSuiteLock` before every poll.** It MIRRORS
`e2e-stage.sh`'s triage; it does not extend it, and the wrapper protocol is untouched (mkdir stays
the claim, pid/birth stay the identity):

| lock dir | classification | server |
|---|---|---|
| pid file empty/missing, birth file present | `stale` — a torn acquisition | reaps |
| pid file empty/missing, no birth either | `parked` — a human took the machine off the board | **never** reaps |
| recorded pid gone, or unreadable content | `stale` — nothing is running | reaps |
| recorded pid alive, birth PROVABLY different | `stale` — a recycled pid | reaps |
| recorded pid alive, birth missing / malformed / unmeasurable / equal | `held` or `unknown` | keeps |

The removal re-checks the pid AND birth VALUES immediately before the `rm`, exactly as the wrapper's
own reap does, and a reaped corpse is retaken in the same pass rather than after a poll. One
deliberate blind spot is kept rather than corrected: an all-zero pid file reads ALIVE here, because
`kill -0 0` addresses the caller's own process group and no wrapper would reap such a lock either —
**reaping something the wrapper would keep is the one direction a mirror of it must never take.**

*Why the §7 bullet was right and is now wrong.* It was written when a stale holder cost one lost
retry and the next wrapper contender cleared it. Since M1 every clean land takes this lock, and on a
quiet box **no wrapper ever contends** — so a corpse denies every land, one after another, until a
human runs `rmdir`. Measured twice in one morning (2026-09-07,
`docs/messungen/2026-09-06-merge-prozess-robust.md` §3 M5): pid 77910 dead with no wrapper running,
a docs-only land polling 710 s until the owner cleared it by hand; then a lane's own green full
chain leaving pid 19458 behind the same way. The added participant in the reap/re-acquire window is
real and unchanged in KIND — it is bounded by the same re-check, and it is bought against a failure
mode that stops **every** land on the box rather than one retry round. **A `waitedOut` verdict may
from here on only mean that a LIVE holder held the machine for the whole budget.**

*And the second half of M5: the docs-only short chain does not take this lock at all.* A docs-only
candidate runs `VERIFY_PROPORTIONAL_CMD` — `bun install --frozen-lockfile && bun e2e/pins.ts`. It
sources no `e2e-stage.sh`, boots no server, opens no socket, binds no port, and finishes in about a
second: there is nothing in it for this mutex to serialize. Under M1 it took the hold anyway and
paid the full queue for it — the docs-only land of 2026-09-07 04:11 records `proportional:true,
steps:[install,pins], ms 710837`, of which 710 000 ms was that take standing behind the dead holder
above. So the PLAN decides: `proportional` ⇒ no take, no wait, and **nothing minted into the gate
child** (that chain has no staged step to inherit a hold). The note says it positively rather than
by absence — `[suite mutex: NOT TAKEN — …]` — so a reader can tell it apart from a full chain that
happened to get the lock instantly. The command is a constant and a pin holds that it names no
`e2e-*.sh`, which is what keeps "safe to skip" mechanical rather than remembered. **Not touched:**
the ff retry chain, which classifies a different tree (main moved under it) and asks for the mutex
exactly as it did before M1.

**Consequence for anyone reading the machine:** `ps -eo command | grep -c '^/bin/sh ./e2e-'` can now
read **0 while the mutex is genuinely held** for a third reason — not only during the gate chain's
`bun install`/`pins`/`tsc`/`build` prologue and the audit's, but for the whole gap between two retry
rounds. The pid file in the lock dir remains the only reliable answer to "is the machine busy".

## 8. The waiter speaks for itself (2026-08-06)

§7 gave the mutex a *reader*: the board can now say who holds it. It could not help the one party
that most needs the answer — the process **standing in the queue**, whose output is the only place
that fact ever gets written down.

The land gate paid for that on 2026-08-06. `FLEET_VERIFY_TIMEOUT_MS` is a wall-clock budget, but
every step of the gate chain takes this mutex first, and its holder may be any suite on the box. So
the budget silently contains an unbounded wait. Reconstructed from `e2e-trail/`:

| | |
|---|---|
| 12:40:56 → 12:49:03 | an `isolated` run holds the lock (8 m 07 s, 1363 rows) |
| ~12:44:55 | the land's verify starts — 300 s budget, and it blocks |
| 12:49:11 | the chain's first suite finally stages (`clean-review`), 8 s after the holder let go |
| 12:49:36 | `clean-review` green, `security` starts |
| ~12:49:55 | the budget expires; the verify is killed |
| 12:50:12 | `security` is **still writing trail rows** — see the orphan note below |

The verdict was `verify.ok:false`, "clean rebase, but verify failed", over a retained output with
zero FAIL lines. ~107 s of the budget was work and ~255 s was queueing, and nothing on the record
said so. The affected lane went looking for a defect in its own 97 lines.

Three changes, all narrow:

1. **`e2e-stage.sh` prints while it blocks** — one line on first contention, a heartbeat a minute,
   and *always* one on acquisition, `after 0s` included. It reuses §7's vocabulary (`held` · `stale`
   · `parked`) because they are the same three facts, and it names the holder's pid, elapsed time
   and command line, so "which suite is in front of me" is answered by the log rather than by a `ps`
   nobody runs afterwards.
2. **A timeout is its own state.** `runVerify` records `ok:null` + `timedOut` instead of `ok:false`
   — a non-answer, not a reasoned no. It rides *inside* `ok:null` rather than as a fourth value of
   `ok` so that it sits in the never-auto-land group structurally: every stop branch already keys on
   `ok === null`, and a forgotten branch can only word the stop badly, never open a land.
   `verified:null` (not `false`) reaches the outcome ledger, closing `verify-tiering.md` §0 item 2.
3. **The verify record carries `ms`, `waitMs` and `exitCode`.** The split is *measured*: the server
   sums the `acquired after Ns` lines the waiter itself wrote (`SUITE_LOCK_RE`, pinned to the shell
   format in `e2e/pins.ts`). A command that prints no such line gets no `waitMs` at all — "does not
   report" must not be recorded as "waited zero".

**And the consequence, 2026-08-07.** The three changes above made the wait *legible* and left it
*charged*: `runVerify` parsed the split out of the finished log, but its clock still started at
`Bun.spawn` and ran straight through the queueing, so a land that never got in front of the mutex
was still killed on a budget it had not spent. The budget is now two budgets, and the clock moves
between them on the same `[suite-lock]` lines — read **live**, off a streamed stdout, because an
acquire line parsed after the process is dead cannot stop it from being killed:

| | budget | ran out while | records |
|---|---|---|---|
| work | `FLEET_VERIFY_TIMEOUT_MS` (live 300 000) | verifying | `ok:null` + `timedOut` |
| wait | `FLEET_VERIFY_WAIT_MS` (live 900 000) | queued behind the mutex | `ok:null` + `waitedOut` |

Never both, never `ok:false`, and both inside the never-auto-land group by construction. The work
budget is *credited* the queueing the chain reported, capped at the wait budget — so a gate gets its
full budget regardless of who else was on the machine, and a run still cannot outlast the sum of the
two. The two kills are deliberately not worded alike anywhere the owner reads them: a timeout at
least looked at the tree, a wait-out never did. `e2e/merge.ts` (C2) and (C3) hold the pair apart.

**The orphan, found while reconstructing the above and NOT fixed here.** `p.kill()` SIGTERMs the
`sh -c` that fronts the chain; the suite it had already started keeps running — `security` wrote
trail rows for ~17 s past the kill, and it holds the mutex until its own EXIT trap fires. Two
consequences worth knowing before anyone builds the next rung: an auto-retry would queue behind its
own corpse, and a timeout leaves machine load the fleet has stopped accounting for. Killing the
process *group* would be the cure and is a behaviour change, not a message change.

**Still open:** raising the budget was considered and rejected — the wait is unbounded by
construction (one queued `isolated` ≈ 8 min, two ≈ 16), so any fixed number only moves the
threshold. Giving the land gate priority on the mutex is the structurally cleaner cure and is the
owner's call, not a lane's.

## 9. …and fleet's OWN two suite runs say so too (2026-08-19)

§7 left one hole, and the two-lane episode of 2026-08-17 fell straight into it: the **land gate**
(`mergeJob` → `runVerify`) and the **tier-2 post-land audit** (`drainPostLandAudits`) take the very
same mutex, hold it for minutes, and reported nothing. `reports` was fed *exclusively* by lanes
volunteering through `POST /api/self/verify-intent`, so while slot 5 landed, the surface carried
`lock.pid` and an empty list — and "which slot is having which tree verified" was answered with
`ps -o ppid` (9638 → 34985 = `bun server.ts`) plus `lsof -a -d cwd`. Host process archaeology for a
fact the server already held. The case that hurts is the SECOND land behind the first one's audit:
slot 6's gate started 31 s after slot 5's land, the audit ahead of it ran 940 958 ms against a
900 000 ms wait budget, and a `waitedOut` (`verify.ok: null` — no failure, but no pass either) was
the only trace that anyone had waited at all.

Both now write into the same `reports` list, with `origin: "server"` telling them apart from
hearsay. Four constructions worth knowing:

- **A second store, not a second key range.** `verifyIntents` stays keyed by slot id and untouched;
  fleet's runs live in `serverRuns`, keyed `land:<slot>` and the constant `audit`. A land gate for
  slot 6 and slot 6's own self-report are two claims that can be true at the same instant, and one
  map keyed by slot would have made either overwrite the other.
- **`slot: number | null`.** The audit is fleet's own work, owned by no pane. `null` is the fact;
  slot 0 would be a claim. It names the tree (`branch`) and the repo (`label`) instead.
- **Terminality, not ageing.** A lane row ages out because a lane can die between `running` and
  `done`. A server-side run ends *in this process, in this frame*, so its row is removed in a
  `finally` — including on a throw. A row on this half means a run is in flight right now.
- **The recycle rule still applies to the land-gate row**, which names a slot: a predecessor's run
  is never attributed to whoever occupies that slot now. The audit row names no slot and needs no
  substitute — nothing can misattribute a row that cannot outlive the function that wrote it.

Still sight, still no control: nothing reads `serverRuns` back, and deleting the two write sites
restores the previous behaviour exactly. Checks: `e2e/verify-queue.ts` §7, which drives both runs
against sleeping stand-ins and fails its *preconditions* as themselves — a stand-in that never
started is this section failing to set itself up, never a product regress.

Reports are in memory and die with a restart — reviving one half of a phase pair across a restart
would be inventing state. Their durable half is `audit.jsonl`: one `verify_intent` line per phase
CHANGE (an identical re-post writes nothing, so a chatty lane cannot push real events out of the
rotation window). That is the timeline the next `exit 144` gets to be read against.

**How a lane actually reports, and the one phase it cannot send.** A lane invokes a wrapper and
then blocks inside it, so it can post `waiting` before the call and `done`/`failed` after it
returns — but it never learns the moment the mutex was granted, so `running` is not a phase a lane
can honestly claim about itself. That phase is in the contract for a reporter that *can* tell (the
wrapper, if v1.5 ever happens); until then the lock line is what says who is actually running, and
it is a measurement rather than a claim. The reporting snippet belongs in `CLAUDE.md`'s
self-scheduling section, next to `/api/self/autos`.

**Still open after v1:** the wrappers themselves do not report, so a suite run by a plain shell shows
up only as the lock. Doing it from `e2e-stage.sh` needs the live server's host, port and a
credential the wrapper has no business knowing — a real coupling, and the lock line already answers
"something is running" for that case. Also, the info card is desktop-only (`renderBoard` returns
early on mobile), so the phone sees none of this.

## 10. The wait becomes a QUEUE, not a race (2026-09-05)

§7 through §9 made the mutex **visible**. They deliberately changed nothing about how it is
*granted* — "no scheduling, priorities, or merge train" (§7) was the right call for the SERVER, and
it still is. But it left a property nobody had stated out loud, and reading `e2e-stage.sh` says it
plainly: the grant was a **race**. The wait path was `sleep 15` and then another `mkdir` against the
same door. There was no order and no memory of arrival — **waiting longer bought nothing at all**.

**Measured on the live box, 2026-09-04 21:51 → 2026-09-05 00:4x** (read off `ps` and the trail by
the controller and by lane `8ab7215f`): the `./e2e-postland-audit.sh` wrapper of lane `8ab7215f`
waited **2 h 45 min** and lost **three** `mkdir` races in a row to contenders that arrived after it —
61841 (`e2e-isolated.sh`) held for 1 h 41 min, then 40106 (a post-land audit **56 minutes** old) won,
and only then 95634. Its own run, once it finally got in, held the lock for **5 minutes**. Twice
that night a holder was measured past an hour (`up 01:03:57`, `up 01:06:31`) against a ~30 min
median; the long one was not wedged — its trail was growing live, the machine was in swap.

**AND IT COST A LAND — the first measured case of its kind (2026-09-05 02:11).** Until that night
the argument above was an argument about *waiting*. It is now an argument about a lost verdict: the
land gate of lane `ce329973` was killed after 45 minutes in the queue **without ever having looked
at the tree** — `status=resolved, landed=NO, verify.waitedOut=true`. The machine at that moment held
FOUR suite processes on ONE lock: holder 70792 (`e2e-isolated.sh`, 23 min) and contenders 29844 (a
post-land audit, by then **1 h 27**), 94455 (a claude-gate, 20 min) and 97719 (`e2e-isolated.sh`,
55 min). Nothing was wedged; there was simply no order, so the oldest contender had no claim on the
next grant.

The counter-number sits in the land note of the land that *did* get through the same night
(`ed36971`), and it is worth reading twice — `git notes --ref=fleet/land show ed36971`:

    ms 1 979 676   waitMs 1 864 000   →  94.2 % queue, 5.8 % measurement

A land gate that spends 94 % of its life in a queue it cannot see, on a grant rule that ignores how
long it has waited, does not fail *sometimes*. **That number is stamped on every land note and read
by nobody.**

**Why this is not merely unfair but expensive, and lands on the wrong side.** `server.ts#runVerify`
streams this exact stdout and moves a LAND's clock between two budgets on it (§8). So the contender
that pays for a preview run's luck is a **land gate** — and a land gate is the one contender whose
budget can kill something. Starvation was unbounded in principle and, that night, ~2 h 45 min in
practice.

**The cut (`e2e-stage.sh`, shell only — no daemon, no background process, no new dependency).**
A **ticket**, taken at ARRIVAL and before the first attempt on the lock, so arrival order is recorded
when a contender arrives rather than when it happens to win. Only the holder of the oldest LIVE
ticket attempts the lock; everyone else names its position and sleeps.

- The queue is **derived** from the lock path (`$FLEET_SUITE_LOCK.q`), never configured apart from
  it — a probe pointed at a private lock must not order itself against the machine's real waiters.
- A ticket is a directory `t<n>.<pid>`: the pid is in the NAME, so creating one is a single atomic
  `mkdir` with no torn state a reaper could mistake for an orphan. `n` is `max(existing)+1`, so a
  number is never issued below a waiter that already holds one, and the counter resets to 1 by
  itself once the queue empties.
- **The three existing properties are unchanged**, and the ticket inherits the lock's own orphan
  rule verbatim: pid dead → reaped · pid alive with a DIFFERENT birth fingerprint → recycled pid,
  reaped · pid alive with a MISSING birth → `unknown`, kept (either a contender one syscall from
  writing it, or a legacy holder — neither may be reaped on a guess). `parked` still never resolves
  on its own, and nothing reaps it.
- The wait line now carries **position next to elapsed seconds**: `— position 2 of 3 —`. Seconds
  alone cannot say whether waiting longer is worth anything.
- A free mutex with an older ticket ahead gets its **own sentence** (`queued — the mutex is FREE`),
  because reading the absent dir would classify it `parked` — the one state that never resolves, and
  a waiter told "parked" reasonably stops expecting a turn.
- It **fails open**: a contender that cannot take a ticket races exactly as before
  (`[suite-lock-unqueued]`, deliberately not the `[suite-lock] ` wire format runVerify parses). The
  mutex is the SAFETY, the ticket only the FAIRNESS — and a fairness device that can kill a land
  gate is worse than the unfairness it removes. `docker-verify.sh`'s duplicated loop (§ its own
  comment) is such a contender by construction and keeps working untouched.

**Where this meets the INHERITED HOLD (§2's fourth bullet, landed the same night).** The ff retry
chain holds the mutex itself across rounds and exports `FLEET_SUITE_LOCK_HELD_BY` into the gate
child; a step that sees it — and finds the lock's own pid file naming that same live process —
runs inside a hold that already exists. Such a step **must never be enqueued**, and getting that
wrong is a silent deadlock rather than a red check: it would wait in line behind the very lock it
is already running inside, forever, printing positions while it did. The guard is structural rather
than a condition of its own — the ticket, the wait loop and the `mkdir` all live inside
`if [ "$_st_inherited" = 0 ]`, so the inherited path cannot reach them. A pin holds that
containment (a later edit lifting the ticket out of the guard would look harmless), and three §2c
checks drive the real thing: a live holder in the pid file, its pid named in the variable, and the
contender must take no ticket, print no position, acquire at once in the ONE acquire format naming
the holder's pid, and release nothing.

**Two things deliberately NOT built, both because they would make the record worse:**

- **A wait budget for the wrapper.** The loop is still endless. The server already owns the honest
  budget — `runVerify` kills a still-queued gate after `FLEET_VERIFY_WAIT_MS` (45 min live) and names
  it `waitedOut`, never `ok:false`, so a land that never started says exactly that. A second deadline
  down in the shell would produce an abort the server cannot classify: a wait that reads like a red
  gate, which is the precise failure §8 exists to prevent. FIFO also removes the reason to want one —
  a waiter's remaining wait is now bounded by the suites ahead of it, and its position is printed.
  (The brief for this cut named `server.ts#holdSuiteLock`; no function of that name exists — the
  budget lives in `runVerify`'s `waitedOut` branch.)
- **A priority class ("land gate before preview/audit").** It was offered and is declined, because
  the measurement argues against it: the contender that starved was a **post-land audit**, not a land
  gate. A class that lets gates jump would starve audits harder and re-import the very unfairness
  this removes, now with a rule attached. §7's "no scheduling, priorities, or merge train" survives
  this section intact — **ordering by arrival is not a priority**; it is the absence of one.

**Proof** (`e2e/verify-queue.ts` §2c, 14 checks). Three contenders arrive in a known order and must
be served in it. The discriminator, and the reason a single green run means something here: the poll
intervals are **deliberately inverted** — the first to arrive polls slowest (6 s), the last fastest
(1 s). In the old race the fastest poller reliably wins the moment the lock frees, so a race yields
`c·b·a`. Counter-checked by removing the front-of-queue guard: §2c then fails with exactly
`["c","b","a"]`. Also proven: a waiter killed mid-queue blocks nobody behind it and its ticket is
reaped, and a FREE mutex is not taken out of turn while an older live ticket sits ahead. Six pins in
`e2e/pins.ts` hold the seam, each mutation-checked.

**One caveat for the transition, and it is visible on the box right now.** The ticket lives in
`e2e-stage.sh`, so a contender only queues once the tree it runs from carries this change. Until it
has landed everywhere, the machine is MIXED: wrappers from an updated tree take tickets and order
themselves, while wrappers from every other checkout still race — and a racing contender can still
overtake a ticket-holder, because failing open is the whole design (the mutex is the safety, the
ticket only the fairness). Measured while writing this: the `e2e-claude-gate.sh` of the lane that
built the queue sat at `position 1 of 1` for 23 minutes — correctly first among ticket-holders, and
still behind a holder that had never taken one. `position 1 of 1` therefore means "first in the
queue", never "next to be served". The property only becomes global when the change is on main.

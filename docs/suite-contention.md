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
> sources it — `e2e-isolated.sh:55` included, which is the very script the post-land audit runs.
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
burst-coalescing (`server.ts:2880-2885`: bursts fold into one run against the current tip) already
handles the queueing a blocking lock would create.

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

**Two sources, deliberately never blended on the wire**, because they are different kinds of claim:

| | `gate.lock` | `gate.reports` |
|---|---|---|
| where it comes from | `statSync`/`readFileSync` on the lock dir | `POST /api/self/verify-intent`, a lane's self token |
| what it is | a measurement | hearsay, and labelled as such in the UI |
| if it is wrong | the filesystem lied | a lane lied, forgot, or died mid-suite |

The lock projection reproduces `e2e-stage.sh`'s own semantics rather than a simplification of them,
because every one of those distinctions is load-bearing: **no dir** = nothing held · **pid alive** =
a real holder · **pid dead** = reapable by the next contender · **no pid file** = a manual park that
is never reaped. A pid file containing `0` reads as unreadable content, not as a holder — `kill(0,
sig)` addresses the caller's own process group, so the naive probe would report the *server* as the
holder of a lock nobody holds.

**What this is NOT, each rejected on purpose:**

- **The server never reaps.** Reaping belongs to the wrappers, which re-check the pid VALUE before
  removing the dir; a second reaper would race exactly the window that design shrank to microseconds.
- **The server starts and stops nothing.** Queue *ownership* is a different feature and needs the
  data this one produces before it can be argued for at all.
- **No scheduling, priorities, or merge train.** ~6 lands/day does not pay for it (`lane-outcomes`).
- **The mkdir mutex is untouched.** It remains the whole truth of serialization; a report is advisory
  and a lane that never sends one is not treated differently by anything.

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

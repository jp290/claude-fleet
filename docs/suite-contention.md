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

# Landing a lane — what actually moves, and how to know before you press it

Everything below was measured on 2026-08-05 while landing one lane
(`fleet/260805094317-835b`). It is written for the next step of automation: an automated
rebase-and-land has to answer every one of these questions, and today a human answered
them by hand, twice getting them wrong first.

Read before touching the land path, before porting a lane by hand, and before calling a
lane "done".

## 1. A lane does not land on `main`. It lands on its repo's integration branch.

`integrationBranch(repo)` (`server.ts:772`) is `repoBases[repo]`, and with no configured
base it falls through to **that repo's own HEAD**. `laneBaseRef` (`server.ts:778`) prefers
the base recorded at fork time, so the target is pinned when the lane is created, not
re-derived later.

A worktree is a repo for this purpose. Measured: lane `fleet/260805094317-835b` was forked
from the *steward worktree*, so `worktree.repo` was
`…/claude-fleet.worktrees/steward` and `worktree.base` was `steward-live`. Pressing ⏫
moved `steward-live` from `184fc72` to `0e4d65c` and left `main` on `669d2c9`. Nothing
malfunctioned — but "landed" did not mean "on main", and the only thing that said so was
the `worktree` field.

**Rule:** read `s.worktree.repo` and `s.worktree.base` before treating a land as
integration. `repoBases` being empty is the common case, and then the target is whatever
that directory has checked out.

## 2. The ref advance runs *inside* whichever worktree holds the branch

`advanceIntegration` (`server.ts:1201`) branches on whether some worktree has the
integration branch checked out:

- **holder found** → `git merge --ff-only <lane>` **in the holder's tree**, wrapped in
  `gitRetry` because Fleet's own status polling races it for `.git/index.lock`
  (`suite-contention.md`).
- **no holder** → `git branch -f`, gated on `merge-base --is-ancestor` so it stays a
  fast-forward.

The split exists because `git branch -f` *cannot* move a checked-out branch. Measured
directly:

```
$ git branch -f steward-live HEAD
fatal: cannot force update the branch 'steward-live' used by worktree at
       '/Users/owner/claude-fleet.worktrees/steward'          # exit 128
```

**Consequence for automation:** a land mutates a working tree that someone may be sitting
in. On 08-05 the holder was the live steward session, and its files changed under it
mid-session. That was harmless only because the tree was clean — `--ff-only` refuses
otherwise — but an automated lander must count "the holder is a live session" as part of
its blast radius, not as an implementation detail.

## 3. Probe a port read-only before doing it

```sh
git merge-tree --write-tree <target> <lane>     # exit 0 = clean, 1 = conflict
```

Output is the merged tree oid, then one `100644 <oid> <stage>\t<path>` line per unmerged
path (stage 1 = merge base, 2 = target, 3 = lane), then the `CONFLICT (content): …` lines.

**Trap:** that tree holds *unmerged stage entries*, not marker-annotated blobs.
`git cat-file -p <tree>:<path>` does not give you the conflict — it silently gives you
something else, and a marker count over it reads as "no conflicts".

For the exact hunk count and location, do the three-way merge yourself:

```sh
git cat-file -p <stage1> > base.ts
git cat-file -p <stage2> > ours.ts
git cat-file -p <stage3> > theirs.ts
git merge-file -p -L target -L base -L lane ours.ts base.ts theirs.ts > merged.ts
echo $?                       # exit code IS the number of conflict hunks
grep -n '^<<<<<<<' merged.ts  # and where they are
```

Measured: 3 hunks in `server.ts` — two purely additive (`interface Task`, the
`existsSync(STATE_FILE)` rehydration block; both sides kept, mechanical) and one that was
not a merge problem at all (§4).

## 4. Let the author resolve, not the port

The third hunk had both sides inserting at the same anchor with *comments legislating
opposite orderings* of the same guard chain. That is a decision, not a conflict: resolving
it either way silently picks a contract.

The cheap move is to hand it back to the lane. After the lane rebased `--onto` the target
and resolved in its own tree, `HEAD..target` was 0 and the subsequent land reported
`clean rebase — no conflicts, agent not needed`. A three-conflict port became a
fast-forward.

This is not merely convenient. The test that proves the resolution
(`e2e/steward-outcomes.ts`) existed **only in the lane** — resolving in the port would
have meant resolving with no check available. Same principle the server's own conflict
path adopted: ask the author first, the throwaway agent is the fallback.

## 5. A rebase moves the lane out from under Fleet's recorded fork point

`worktree.baseSha` is stamped when the lane is created and is never updated.
`buildLaneOutcome` (`server.ts:4151`) computes the outcome row's fingerprint against it.

Measured on the 08-05 land, after the lane rebased onto a target that had advanced 9
commits: the outcome row reads

```
commitCount: 12    shortstat: "19 files changed, 1190 insertions(+), 82 deletions(-)"
```

for a lane whose real content is **3 commits / 7 files**. The nine extra are the target's
own commits, counted because the stale base predates them.

Cosmetic while the ledger is display-only. Load-bearing the moment anything *reads*
`commitCount` — a size heuristic, a cost model, a review trigger. **An automated rebase
must re-anchor `baseSha`**, or the ledger errs in the direction of "bigger than it was".

## 6. `doneLooking` is idle + clean. A pane running a suite reads as done.

Measured twice on 08-05, both times on this same lane, and both times the pane was quiet
only because a subprocess was running. The deterministic counter-check:

```sh
ps -eo command | grep -c '^/bin/sh \./e2e-'   # anchored — a bare grep counts the zsh wrapper too
cat /tmp/fleet-e2e.lock/pid                   # existence of the dir ≠ held; the pid file decides
```

To find *whose* run it is, walk the holder's parents until the
`claude --session-id <uuid>` line and match that uuid against the slot's `sessionId`
(a lane pane also carries `FLEET_SELF_SLOT` in its env). On 08-05 this told two runs
apart that looked identical from the outside.

And the cheapest check of all: the lane's own last message said it plainly both times.
`GET /api/steward/slots/:id/transcript` before deciding anything about a quiet lane.

## What an automated rebase-and-land still needs

Ranked by what actually blocked a human today:

1. **A machine-busy fact.** Nothing in the state Fleet serves says a suite is running.
   The verify gate has a 5-minute cap (`FLEET_VERIFY_TIMEOUT_MS`) and the suite mutex is
   blocking, so a land started next to a running suite can fail on *queueing* rather than
   on its own tree.
2. **`baseSha` re-anchoring** after any rebase (§5), or the outcome ledger lies — *narrowed
   2026-08-05: both SERVER land paths already re-anchor (`buildLaneOutcome` takes
   `facts.baseSha`; the clean auto-land and the reviewed confirm-land both pass `mainBefore`).
   Open only on the `OWNER_LAND_FACTS` paths (grep it), which is what §5 measured.*
3. **A rule for semantic conflicts** (§4): "both sides additive → keep both" is
   automatable; "two comments legislating opposite orderings" is an owner decision and
   must escalate, not resolve.
4. **Knowing which branch it is moving** (§1). A lander that assumes `main` will
   fast-forward the wrong ref and report success.

Related: `verify-tiering.md` (what a green gate attests, and why the full suite is tier 2),
`suite-contention.md` (the `index.lock` races `gitRetry` exists for),
`knowledge-currency.md` (a lane's shelf is a spawn-time snapshot).

# The task queue was deleted whole — what was in it, what it cost, what to do

**2026-07-28.** Written in lane `fleet/260728074631-0a5b` for the main session. Every claim below
was checked against HEAD `479f78c` and the live state files; the two I could not verify are named
as such in §5.

---

## 1. What happened

At **09:45–09:46** the owner deleted every entry in the Fleet task queue from the board. Not only
the queued ones: the list held **39 tasks — 25 `done`, 10 `queued`, 4 `pending`** — and afterwards
`fleet.json` carried `tasks: []`.

The owner's own account: *"I just deleted all the qeued tasks. not sure if they were already done
another way or if they were important."*

Two of the deletions left an audit row (`audit.jsonl`, 09:45:57 and 09:45:59, both
`steward_propose_outcome … dismissed`). The other 37 left nothing at all.

## 2. Why nothing in the repo survived

Three mechanisms, each fine on its own, compose into a silent total loss:

1. **Task text lives in exactly one place.** `Task.text` is only ever persisted inside
   `fleet.json`. It is deliberately kept out of `audit.jsonl` (`server.ts:387` — *"prompt text must
   NEVER appear here"*) and the steward journal stores refs only. The one exception is a task the
   dispatcher actually delivered: `tickDispatch` calls `logPrompt(free, next.text, "auto", …)`
   (`server.ts:1663`), so those texts are in `streams/prompts.jsonl`. Nothing else is.

2. **`fleet.json.bak` is not a time-based backup.** `saveState` copies the previous *good*
   generation at rename time (`server.ts:513`, `:525`) — a corruption-recovery copy, one save
   behind. A sweep of many deletes triggers many saves, so `.bak` was one *delete* behind the end
   state, not one *sweep* behind. By 09:46 both files read `tasks: []`.

3. **A delete is only audited when it happens to score a measurement.** In the task-action route
   (`server.ts`, grep `proposeOutcome`) the `audit()` call is a side effect of the steward-proposal
   outcome, gated on `t.source === "steward" && t.status === "pending"`. Owner-source tasks and
   already-queued tasks are deleted with no event, no id, no text, no count.

There is therefore **no trail of what a task deletion removed**, by construction.

## 3. How it was recovered

The local Time Machine destination is mounted and its in-progress tree is world-readable enough:

```
/Volumes/Owner's Mac's BackUp's/2026-07-28-090618.previous/Macintosh HD - Data~/claude-fleet/fleet.json
```

`mtime 2026-07-28 08:49`, 114 874 bytes, all 39 tasks intact — 57 minutes before the sweep. It
reads **without sudo** and preserves the 0600 mode. `tmutil listbackups` lists the hourly stamps.

Worth knowing for next time: APFS local snapshots (`tmutil listlocalsnapshots /`) also cover this
window but need root to mount; the Time Machine `.previous` tree does not.

**This copy ages out.** The verbatim text of all 14 open tasks is preserved next door in
[`queue-deletion-2026-07-28-tasks.md`](queue-deletion-2026-07-28-tasks.md) — that file is a restore
payload, not knowledge. Delete it once every task in §5 has been re-filed or consciously dropped.

## 4. The effects

**Measured.** `outcomeTally.propose.dismissed` went **2 → 4** across the sweep (backup 08:49 vs.
live 09:46; `helped` unchanged at 7). The two new rows are `6e4baf6d` and `e361058f` — both
steward-origin proposals in `pending`, both swept as cleanup, neither judged bad. They are false
negatives in the only signal that scores whether steward proposals are worth anything, and
`promotionEligible` reads that signal.

The sharp edge: **the queued task that warned about exactly this trap was deleted by the same
sweep.** `7319e7ad` — *"Ein gefilter Task lässt sich nicht korrigieren, ohne entweder das Log zu
fälschen oder eine Messung zu verderben"* — documents that `delete` on a pending steward task
writes a false `dismissed`, and cites the earlier instance (`b32458bc`, 2026-07-25) where the same
thing happened. It is now the third and fourth instance, and the warning is gone with them.

**Not affected.** Slots, autos, shares, shelved lanes, merge records, undo records, the ledgers
(`audit.jsonl`, `lane-outcomes.jsonl`, `post-land-audits.jsonl`, `steward-journal.jsonl`,
`streams/prompts.jsonl`) — all untouched. Only `tasks` was emptied.

## 5. The register — were they already done another way?

25 of the 39 were `done` and are not interesting. The 14 open ones, each checked against HEAD
`479f78c`:

### Already done — close them, do not re-file (2)

| id | task | evidence it landed |
|---|---|---|
| `16d652aa` | P1-Gate: adopt the measured gate proposal from `verify-tiering.md` §8 | `07be94d` + `58203f2` (07-26 20:42/20:52). `watchdog.sh:71` now type-checks 7 files incl. the three standalone harnesses and runs `./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh`. Exactly the proposal, including its "not `e2e-isolated.sh`" exclusion. |
| `babbf719` | An srv restart discards a running post-land audit | `a7af3ea` (07-26 23:03) + `69e4b8d`. `POSTLAND_AUDIT_QUEUE_FILE` (`server.ts:48`) plus the boot resume at `server.ts:4860-4905`. |

### Still open — the sweep dropped real work (12)

Ranked by cost of never doing them.

| # | id | status | task | verified state at HEAD |
|---|---|---|---|---|
| 1 | `27b97958` | queued | P1-Security: `--strict-mcp-config` missing on the merge/review agents | **Open.** `MERGE_TOOLS` (`server.ts:2858`) and `REVIEW_TOOLS` (`server.ts:2870`) both lack the flag; `TEXT_ONLY_TOOLS` (`:2065`) has it. |
| 2 | `733e1c3b` | queued | P1-Perception: `done-looking` is permissive in two of six clauses | **Open.** `lane-signals.ts:41-42` unchanged — `v.gitOp !== true` and `!MERGE_BLOCKING.includes(v.merge?.status ?? "")` both read `null` as "fine". |
| 3 | `69307891` | queued | P1-Measurement: a verify **timeout** is written as a failure, not a non-measurement | **Open.** `server.ts:2846`: `ok: skipped ? null : !timedOut && code === 0` — the tri-state exists but a timeout still lands on `false`. |
| 4 | `cc913fe1` | pending | P1-Judge: the ② reviewer answers **nothing** in ~1 of 14 runs (empty `rawAnswer`) | **Open.** `CLEAN_REVIEW_TIMEOUT_MS` still 180 s default (`server.ts:2705`); no retry, no distinct record for "never answered". |
| 5 | `252c01c2` | queued | P1-Rollback: `undo-land` covers exactly one land | **Open.** `undoableFor` (`server.ts:2939`) still returns a single record per repo from `undoLast`. |
| 6 | `6e4baf6d` | pending | `helpedGitSince` scores a foreign land as a main-session nudge's effect | **Open.** `server.ts:864-876` has no land-note exclusion and no abstain for `repoBase` cwds. |
| 7 | `639e35ff` | pending | P1-Measurement: `landInitiatedBy` — the axis "landed unattended" needs | **Open.** Zero occurrences in `server.ts`. |
| 8 | `18533823` | queued | docs: claims falsified by the 2026-07-25 lands | **Open, and it grew.** `docs/README.md:147-150` still calls the post-land tier *"designed and never built"*. New instance of the same rot: `CLAUDE.md` still warns about the NUL byte in `src/client.ts` — the file has **0** NUL bytes since `fe5464cf`. |
| 9 | `7319e7ad` | queued | gap: a filed task cannot be corrected without falsifying the log or spoiling a measurement | **Open, and it just fired twice** (§4). The route still exposes only `queue\|unqueue\|done\|delete`; no PATCH under any principal. |
| 10 | `d87685de` | queued | `state_relay` refs for facts no session can see (deploy gap, stale bundle, red audit) | **Open.** Zero occurrences of `deploy_gap` / `bundle_stale` / `postland_red`. |
| 11 | `188aa60e` | queued | `commitLooking` — the main-session analogue of `done-looking` | **Open.** Zero occurrences. |
| 12 | `e361058f` | pending | root-cause the land machinery mislabeling a **clean** rebase as a resolved conflict | **No evidence of a fix** — but see §7, this is the one verdict I did not prove. |

## 6. Proposed solutions

### A — the twelve survivors

Re-file them from `queue-deletion-2026-07-28-tasks.md`; the texts are complete and still accurate.
Two amendments before filing:

- **`18533823`** — add the `CLAUDE.md` NUL-byte claim to its list. It is a live false warning that
  will cost the next agent a `grep -a` it does not need.
- **`cc913fe1`** — its premise cites a K2 count. Recompute it from `lane-outcomes.jsonl` before
  briefing a lane; that number went stale twice within an hour on 07-26.

`27b97958` (#1) deserves to go first and is small: two string constants gain one flag, and then the
hole has to be *proved* closed, not assumed — the task text already prescribes an empirical check,
and `reference-allowedtools-is-additive` is the standing warning that a model refusing to use a
tool proves nothing.

### B — the three mechanism fixes this incident argues for

1. **Audit every task deletion.** Move the `audit()` call out from under the `proposeOutcome`
   condition and give it its own event (`task_delete`) carrying id, status, source and a bounded
   text prefix. Cost: one line plus a union member. It is the difference between this write-up and
   nothing at all.
2. **Give `delete` a sibling that does not score.** `7319e7ad` already specifies this; the incident
   is its fourth data point. Either a `withdraw` action that retires a task without touching
   `outcomeTally`, or drop the outcome write from `delete` entirely and score dismissal explicitly.
3. **Correct the two false `dismissed` rows** — or, if the tally is meant to be append-only,
   record the correction where `promotionEligible` can see it. `propose` currently reads 7 helped /
   4 dismissed; at most one of those four is a genuine rejection.

### Cut line

That is the whole of it. The owner asked to *"document the happenings, the effects and the proposed
solutions"* — items A and B answer that. Everything further this incident suggests (task text
journaling, a state-file generation policy, an export button on the queue) is speculative
hardening against a loss that Time Machine already absorbed, and belongs in a separate decision if
it belongs anywhere.

## 7. What I did not verify

- **`e361058f`** (row 12). I confirmed nothing in the merge path claims to fix it and that
  `CLAUDE.md` still lists merge/resolver among the four live flake families — but I did not
  reproduce the original symptom (a clean rebase recorded as `status:"resolved"` with
  `conflicted: []`). Treat the verdict as inferred. `tryScriptRebase` (`server.ts:3762`) does
  decide `clean` from git's exit code rather than from the agent's prose, which is *some* evidence
  against the symptom persisting; the reported case had an empty `conflicted` list on a "resolved"
  verdict, which that path should not produce. Worth ten minutes before re-filing the brief.
- **The 25 `done` tasks.** Not examined. Some were retired administratively rather than completed
  (`fcfc5244`, `30622a35`, `10ab6127` were marked `done` specifically so a corrected owner task
  could replace them — and those replacements are rows 10, 11 and 4 above). If anything else in the
  `done` pile was retired the same way, its replacement is not in this register.
- **Whether the owner intended to keep any of the 12.** Nothing here has been re-queued. The
  dispatcher is off on disk (`dispatch: false` in both the backup and the live state), but
  re-filing is still the owner's call, not a lane's.

# Implementing the 2026-07-27 data audit — the wave plan and what is deliberately deferred

Companion to `docs/data-audit-2026-07-27.md`. The owner asked for all of it implemented properly;
this file is the accounting, so nothing quietly falls off the list between waves.

## The constraint that shaped the partition

Work is grouped by **`server.ts` region**, not by finding number. Two lanes were done-but-unlanded
when wave 1 was briefed, and a new lane editing their hunks would collide at land time. Ownership
was established from the actual diff hunks, not guessed:

- `fleet/260726201422-b499` (② feed fix + prompt enrichment) — `merge-prompt.ts`, `e2e/prompts.ts`,
  `fleet-e2e-clean-review.ts`, `e2e-clean-review.sh`, `server.ts` ~3559-3630 and the single
  `runCleanReview` call line ~3787.
- `fleet/260726201422-b5e6` (audit-queue durability) — `fleet-e2e-postland-audit.ts`,
  `e2e-postland-audit.sh`, `.gitignore`, `docs/verify-tiering.md`, `server.ts` ~2876-2950 and
  ~4428-4520.
- `fleet/260726201423-c2aa` (Rundgang ledger feed) — **landed** as `63e79ec`.

Both open lanes are one commit behind main since that land and will need a rebase before theirs.

## The method every lane is held to

**Reproduce before fixing.** Audit items 2, 3 and 7 were traced through code and never executed;
the agent that found them said so. A fix for an unproven defect fixes nothing and reads like
progress, so each lane must first write a check that FAILS against today's code, quote that
failure, then fix, then show it pass. A finding that refuses to reproduce is a result, not a
failure — it gets reported as refuted with evidence, not quietly "fixed".

Standing rules: suites serial under `/tmp/fleet-e2e.lock`; a red check is the lane's until proven
otherwise by a same-tree re-run (`verify-tiering.md` §11.7); new checks in the right
`e2e/<family>.ts`; no untracked files; **no lane lands itself**.

## Wave 1 — in flight

| lane | slot | audit items | region |
|---|---|---|---|
| `a341` | 4 | 2, 3, 7 — the restart windows in the land path | mergeJob / recordLand / landLane / reviewCache |
| `83d3` | 5 | 6 + the `total: lines.length` trap | the two output caps, the five ledger readers |
| `1028` | 6 | 8, 9 — rotation-safe reads, state-file durability, single-instance guard | appendEvent, saveState, boot restore |
| `e288` | 7 | 4, 5 + absent-vs-false renders | `/api/sessions` payload, `src/client.ts` |

Each brief carries a priority order and explicit permission to stop short and report the
remainder — a solid partial beats a rushed whole.

## Wave 2 — deferred on purpose, not forgotten

Deferred because it collides with an open lane's region, or because it is genuinely lower cost:

1. **Record correctness** (audit "Record correctness" block): the teardown-failure path that writes
   zero outcome rows and then files the land as `killed-dirty`; `baseSha` missing on 2 of the 4
   land paths; `verified` bound to `mainSha` only, never the lane's HEAD; `resolvedConflict` /
   `repairRounds` having no unknown state. Same region as wave-1 lane `a341` — must follow it.
2. **The post-land audit cap's twin**, if lane `83d3` can only reach the verify site cleanly.
3. **Cost / load**: `transcriptPayload` reading whole 3-7 MB files on a 1 s poll; the
   `/api/slots/:id/worktrees` fan-out (~63 git spawns/request, polled at 3 s); `tickGit`'s ~45-70
   children per 10 s with no client attached; no ETag/304 anywhere; `poll()` reading pane bytes for
   slots with no listener; the digest route caching worker failures for the full TTL.
4. **Growth and hygiene**: `streams/prompts.jsonl` (3.3 MB, never rotates, read whole on three
   paths); 690 MB of unreaped e2e scratch in TMPDIR; `streams/s*.raw` unbounded for a slot's
   lifetime (and the steward slot is never killed); 74 undeleted `fleet/*` branches.
5. **Fail-open latch**: an audit-log write failure permanently silences reporting *and* disables
   the steward hourly send cap (`server.ts:417-432`).
6. **`briefHash` null-collision** (14 rows compare equal) if lane `e288` does not reach it.

## The owner's clicks, and what each unblocks

- Landing `b499` makes the ② reviewer see main's real work for the first time — until then every
  new shadow verdict keeps measuring the broken feed.
- Landing `b5e6` makes the tier-2 audit queue survive the deploy ritual that has been destroying
  it (~10 restarts/day measured).
- Wave-2 item 1 cannot start until `a341` lands, because they share the land path.

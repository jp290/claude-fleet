# The per-check trail — keeping the observations the suite already produces

2026-07-27. Builds piece (a) of `knowledge-currency.md` §5: *"`check()` is a single choke point;
give the suite a run id and append `{run, suite, tree, check, ok, ms}` to a trail."* This document
is the contract for what is now written, where it lives, and what it deliberately does not do.

## 1. What was being thrown away

`check(name, ok, detail)` (`e2e/harness.ts`) builds ~880 structured results per run (879 measured
2026-07-27, before this family's own checks) — name, pass/fail, detail — pushes formatted
**strings** into an array, prints them, and discards the structure. Every run, every lane, ~20
times a day. Three costs we were paying:

- *"Is this check flaky?"* is adjudicated by a seven-minute same-tree re-run
  (`verify-tiering.md` §11.7) instead of answered by a query over what already happened.
- A red post-land audit row cannot name which checks failed — its stored tail keeps 33 PASS lines
  out of ~870.
- Nobody can see which checks are slow.

Conclusions rot; observations do not. "Check X failed on tree Y at time Z" stays true forever.

## 2. The row

One JSON object per line, one line per `check()` call. `e2e/trail-emit.ts` owns it.

| field | meaning |
| --- | --- |
| `v` | schema version (`TRAIL_SCHEMA`, currently `1`) |
| `run` | run id — `<suite>-<UTC stamp>-<pid>`, also the file's basename |
| `suite` | `FLEET_E2E_SUITE`, default `isolated` |
| `tree` | git sha of the tree under test, or `null` when none was resolvable |
| `dirty` | whether that tree had uncommitted changes; omitted when `tree` is `null` |
| `check` | the check name, verbatim — the join key with the printed tail |
| `ok` | pass/fail |
| `msSincePrev` | wall-clock ms since the **previous** check returned (see §4) |
| `ts` | epoch ms |
| `detail` | only on `ok:false`, capped at `TRAIL_DETAIL_MAX` = 2000 chars + `…[truncated]` |

`detail` is the only unbounded input (a check may hand `check()` a whole transcript), hence the
cap. Everything else is bounded by construction, so a row is ~150 bytes and a run ~130 KB.

`dirty` is not decoration: two runs on the same sha with different uncommitted work are different
code, and that is exactly the distinction a flake query turns on.

## 3. Where it lives, and why not next to the run

`e2e-isolated.sh` `rm -rf`s its instance dir **on success**. A trail written there would vanish on
exactly the green runs — the baseline that makes a red one legible. So the trail is resolved
*outside* the instance dir, and resolved **inside the harness**, so no wrapper changes:

1. `FLEET_E2E_TRAIL_DIR` if set (empty string = trail disabled).
2. Otherwise `<main checkout>/e2e-trail/`, found by asking git for the source tree's
   `--git-common-dir`. A linked worktree's common dir is the **main** checkout's `.git`, so every
   lane's runs land in one trail — which is what makes *"has this check failed on trees that do
   not contain my change?"* answerable at all. It is also where the server's other append-only
   ledgers already sit (`audit.jsonl`, `post-land-audits.jsonl`), i.e. where a future read route
   will look. Gitignored, so it dirties no checkout.
3. Only if no git tree resolves at all: `$TMPDIR/fleet-e2e-trail/`.

Finding the source tree from inside the throwaway copy: the copy has no `.git`, but the wrapper
symlinks `node_modules` back to the source checkout, and that link is the only pointer home. Run
directly from a checkout instead, there is no symlink and the root itself is the tree. If both
fail, `tree` is `null` and the rows simply claim nothing about which code ran.

**One file per run, not one shared ledger.** Three suites can run at once from three lanes, and
appends from separate processes can interleave into torn lines. A directory of run files has
exactly one writer per file: no locking, no torn rows, and a killed run keeps what it wrote (the
file is opened `O_APPEND` and each row is a single `writeSync`, so rows are on disk immediately —
a crash mid-run loses nothing that was already checked).

**Growth is unbounded and unmanaged.** ~130 KB × ~20 runs/day. Retention belongs with the query
layer that will read it; until then, `rm` old files by hand if it matters.

## 4. `msSincePrev` is not a per-check duration

`check()` is handed an already-computed boolean — the work happened before the call. The only
truthful measurement available at the choke point is the wall clock since the previous check
returned, i.e. *the cost of getting from there to here*. That is the useful signal for "where does
the suite spend its time", but it is not the check's own runtime, and the field is named so it
cannot be misread as one. The alternative — an honest per-check duration — would mean restructuring
every one of ~870 call sites; an absent field would have beaten a wrong number, and a correctly
named field beats both.

The first row of a run measures from harness import, i.e. suite start.

## 5. Failure is silent by design

The trail hangs off the suite's choke point and must never change a run's outcome: a write error
stops the trail for the rest of the run rather than throwing. The loss is not silent to a reader —
`e2e/trail.ts` asserts the artifact exists, that its row count equals the suite's result count
(one row per `check()` call — the choke point is the contract), that the trail path is outside the
instance dir, and that a known check's row carries the full shape. The failure-detail cap is
asserted on the pure row builder, since a deliberately failing check would fail the run measuring
it.

## 6. Not in this layer

No query, no flake ranking, no route. `GET /api/…` over these rows is the next piece, and
`knowledge-currency.md` §5(b) is where it belongs. Only `e2e-isolated.sh`'s suite writes a trail;
`fleet-e2e-claude-gate.ts` and `fleet-e2e-clean-review.ts` are separate single-file harnesses that
do not import `e2e/harness.ts` and are unaffected.

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
cap. Everything else is bounded by construction. Measured 2026-07-27: 887 rows, 220 440 bytes —
~250 bytes per row, ~220 KB per run.

`dirty` is not decoration: two runs on the same sha with different uncommitted work are different
code, and that is exactly the distinction a flake query turns on.

## 3. Where it lives, and why not next to the run

`e2e-isolated.sh` `rm -rf`s its instance dir **on success**. A trail written there would vanish on
exactly the green runs — the baseline that makes a red one legible. So the trail is resolved
*outside* the instance dir, and resolved **inside the harness**, so no wrapper has to say where
(each wrapper names only its own `FLEET_E2E_SUITE`, see §6):

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

**Growth is unbounded and unmanaged.** ~220 KB × ~20 runs/day ≈ 4.4 MB/day. Retention belongs with
the query layer that will read it; until then, `rm` old files by hand if it matters.

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

## 6. Which suites write a trail

All five. Originally only `e2e-isolated.sh`'s — the four single-file harnesses did not import
`e2e/harness.ts`, so the ~104 runtime checks of the pre-land gate produced no rows at all, and
`FLEET_E2E_SUITE` had no writer anywhere (every row said `isolated` by default). Folding their
duplicated plumbing onto `e2e/harness.ts` (2026-07-28) made `check()` their choke point too, and
each wrapper now names its suite on the line that invokes its harness:

| wrapper | `FLEET_E2E_SUITE` |
| --- | --- |
| `e2e-isolated.sh` | `isolated` |
| `e2e-claude-gate.sh` | `claude-gate` |
| `e2e-clean-review.sh` | `clean-review` (both phases — they are two processes, so two run ids, and every shadow-phase check name is prefixed `shadow: `) |
| `e2e-security.sh` | `security` |
| `e2e-postland-audit.sh` | `postland-audit` |

The label is passed to the harness process only, never into the srv spawn env: the server has no
use for it, and `restartSrv` filters `FLEET_E2E_*` out of the env it carries forward anyway.

`drills/drill-3.sh` writes no trail — its harness is a drill fixture, not a `check()` suite.

## 7. The query over these rows

2026-08-07. What §7 called "the next piece" exists: `trailstats.ts` reads the rows, and two routes
serve it. The reason it was worth building is in §1 — the proof order `CLAUDE.md` obliges a lane to
on every red check starts with a same-tree re-run, ~425 s median plus the suite mutex, per red.

**The whole trick is one sentence: a check that failed on ≥2 distinct CLEAN trees cannot be the
diff of whoever is asking**, because no single working tree is two commits. Everything else is
bookkeeping around that sentence.

`trailstats.ts` is a READER in the sense `slotstats.ts` and `continuity.ts` are: no filesystem, no
clock, no path — records, `now`, the window, the filters and the caps are all arguments, so a
synthetic sequence yields a predictable summary and every semantic test runs without a server. It
answers three questions and carries no field that answers none of them:

- **flakes[]** — grouped by `suite`×`check`: failing runs, the denominator, and the number of
  distinct clean trees the failure appeared on (`notYourDiff` = that count ≥ 2).
- **slowest[]** — summed and median `msSincePrev` per check. Still cost-to-get-here, not runtime (§4).
- **point** — `?check=` asks about one check and answers with the run ids and tree shas as evidence:
  `not-your-diff` | `insufficient-evidence` | `never-failed` | `not-in-window`.

Three exclusions carry the whole honesty of the answer, and each has already produced a wrong
number somewhere:

- **`dirty:true` is the common case, not the edge.** A lane measures its own uncommitted tree, so
  the row's sha does not describe the code that ran. A dirty fail can never count toward the ≥2
  proof; it is its own category and it is reported (`dirtyFailRuns`), never dropped.
- **`tree:null`** (the post-land audit's `git archive` snapshot, §2) is a third category, never
  folded into either of the other two.
- **The denominator is "runs that ran THIS check", not "all runs".** A check added last week has a
  small denominator and would otherwise read as catastrophic. Queue row `32c89530` shipped a
  published "4 of 69 (~6 %)" built from two different denominators for exactly this reason.

**Known limit, deliberately not solved: a renamed check is two checks here.** `check` is the join
key verbatim and matching is exact. Fuzzy matching would silently merge two genuinely different
checks — a worse failure than an honest split a reader can see. A ranking that suddenly shows a
familiar check with a tiny denominator is the symptom; the cure is to read the two names.

### The routes

| route | principal | notes |
| --- | --- | --- |
| `GET /api/flakes` | owner | same access model as `/api/slot-stats`: past the token gate, 404 on `SHARE_HOSTS` |
| `GET /api/self/flakes` | **any session** (`x-fleet-self-token`) | lane *and* plain session — see below |

Both take `?check=`, `?suite=`, `?days=` and share one handler, so they cannot drift into answering
the same question differently.

The session route has to reach a **lane** or it solves nothing: the proof order it replaces is an
obligation `CLAUDE.md` puts on lanes, at the moment a lane sees a red check. It joins the *widest*
of the self family's three tiers — `/api/self` and `/api/self/autos` answer every session; the four
lane-only routes and the non-lane-only `/api/self/watch` are narrow because their content is
meaningless to the other principal. Neither reason applies here: a lane adjudicating its own red
and the owner adjudicating a post-land audit ask the identical question of the identical rows. It
grants no capability either — a lane can already open `e2e-trail/` through the shared common dir
(§3); the route saves it a directory walk.

The server reads **both** directories from §3 (`<checkout>/e2e-trail` and the tmpdir fallback),
because reading either alone silently drops a whole population — the previews or the post-land
audits. `FLEET_TRAIL_DIRS` overrides. Files are pre-filtered by mtime and capped at the newest 400
(~28 MB, ~325 ms measured), with `filesOmitted` reporting the cut rather than hiding it — and
**handed to `trailStats`, which will not answer `never-failed` while any file went unread** (it
answers `insufficient-evidence` instead). The cut is newest-first, so the unread remainder is the
*older* material, which is where a historical flake lives by definition: measured 2026-08-07 on the
deployed tree, `FIX1` read `never-failed, runs 74, failedRuns 0` over the newest 400 files while the
741 omitted ones held 9 failing runs on 3 distinct clean trees. Only the absence claim is downgraded
— `not-your-diff` rests on clean fails already seen, and unread files can only ever add more.
`not-in-window` (`runs === 0`) is structurally the same absence claim over the same cap and is
**not** yet covered.

**It gates nothing and alarms nobody.** A verdict here is evidence *for* a lane's proof order, not
a substitute for it — the same stance §5's "must never change a run's outcome" takes on the write
side. And the retention question §3 left to "the query layer that will read it" is still open: the
cap bounds the *read*, not the directory.

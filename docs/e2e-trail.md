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
| `treeWhy` | **only** when `tree` is `null`: why no tree could be named, capped at 300 chars |
| `slot` | since 2026-09-17: the fleet slot that started the run; **omitted** when none was readable (§2a) |
| `branch` | since 2026-09-17: the branch of the tree under test; **omitted** on a detached HEAD or when no tree resolved (§2a) |
| `offered` | since 2026-09-17: whether a suite offer preceded this run; **omitted** when the offer door could not be asked (§2a) |
| `check` | the check name, verbatim — the join key with the printed tail |
| `ok` | pass/fail |
| `msSincePrev` | wall-clock ms since the **previous** check returned (see §4) |
| `ts` | epoch ms |
| `detail` | only on `ok:false`, capped at `TRAIL_DETAIL_MAX` = 2000 chars + `…[truncated]` |
| `phases` | since 2026-09-14: `{boot, tmux, http, sleep, rest}` ms — where `msSincePrev` went (§4a); absent in older files |
| `phaseTop` | since 2026-09-14: per phase with any outermost call, the longest one in this row as `{ms, at}` (`at` = `path:line`) |
| `phaseSum` | since 2026-09-14: per phase, the call site whose outermost calls in this row sum to the most, as `{ms, n, at}` |

`detail` is the only unbounded input (a check may hand `check()` a whole transcript), hence the
cap. Everything else is bounded by construction. Measured 2026-07-27: 887 rows, 220 440 bytes —
~250 bytes per row, ~220 KB per run.

`dirty` is not decoration: two runs on the same sha with different uncommitted work are different
code, and that is exactly the distinction a flake query turns on.

`treeWhy` is the other half of `tree:null`. An anonymous row is **legitimate** — the post-land
audit measures a `git archive` snapshot that is a tree and not a repository — but it can never
serve as evidence in §7's query (`trailstats` counts it under `unknownRows`), and a reader opening
a trail file months later has no tail left to consult. So the loss is *named where the loss is*,
in the row: `no source tree: via=pointer candidate=… why=not-a-work-tree pointer=symlink`, or
`source tree … resolves but has no HEAD`. Three answers are kept apart, because they call for three
different repairs and only the first is not a defect:

| `why` | means |
| --- | --- |
| `not-a-work-tree` | the candidate directory is not a git work tree — the audit snapshot, correctly described |
| `git-unavailable` | git never ran (missing binary, killed) — nothing was measured at all |
| `pointer=unreadable:<errno>` | a staged instance whose `node_modules` pointer home is not a symlink; it must not read as a direct-checkout run |

Measured 2026-09-08 on a stand-in built exactly as `server.ts#snapshotIntegrationTree` builds the
full chain's source: the pointer home reads fine (`pointer=symlink`), and it is
`git rev-parse --is-inside-work-tree` on the extract — exit 128, no `.git` — that says no.

### 2a. The actor — `slot`, `branch`, `offered`

The header said *what* was measured and nothing about *who* started it. That made one operational
question unanswerable except by guessing across two ledgers that do not join: the trail counts the
local isolated runs (14.9 a day, 47 of 156 on a dirty tree), `audit.jsonl` counts 2–3 withdrawn and
1–4 abandoned suite offers a day, and nothing said whether those runs were the *same* runs. Whether
most previews are ever offered to a helper at all decides whether the lever is the offer mechanism
or a routing line (Staffel 2026-09-17, Rang 2).

| field | source |
| --- | --- |
| `slot` | `FLEET_E2E_SLOT`, handed down by `e2e-stage.sh` from the pane's `FLEET_SELF_SLOT` |
| `branch` | `git rev-parse --abbrev-ref HEAD` in the same source tree the sha comes from |
| `offered` | `e2e-stage.sh` asks `GET /api/self/suite-offer` with the pane's self-token, once, at arrival |

**An absent source omits its field — it is never written as `""` or `false`.** This is the common
case, not the edge: the land gate and the post-land audit run with no lane credentials at all
(`server.ts#auditChildEnv` drops every `FLEET_*`), so their rows carry none of the three, and so do
all rows written before 2026-09-17. `slot:""` would read as *a run by nobody* rather than *a run
whose actor is unknown*; `offered:false` from a probe that never asked would be a wrong answer
rather than a missing one. `offered:false` is therefore an **answer** — the lane asked the door and
had made no offer — and only a probe that could not run omits the field. `e2e/trail-emit.ts#actorFields`
is that rule as a pure function, and `e2e/trail.ts` asserts all of its branches.

**Why the values travel under `FLEET_E2E_*` names rather than being read from `FLEET_SELF_*`
directly.** Three wrappers — `e2e-isolated.sh`, `e2e-security.sh`, `acceptance-probe.sh` — `unset`
the pane's lane credentials before staging, for a hermetic reason that has nothing to do with the
trail (an inherited self-token would be baked into every pane of the throwaway tmux server and
would make `e2e/self-token.ts` read the *outer* lane's credential as the test server's own). By the
time `e2e/trail-emit.ts` loads inside the instance there is nothing left to read. Those three
wrappers therefore carry the credentials past their own `unset` in **plain, unexported** shell
variables (`_st_actor_*`) — an exported copy would put a self-token back into every pane and into
`ps`. `e2e-stage.sh` consumes them, exports only the two results, and clears the token. The token
reaches `curl` on **stdin** (`-H @-`), never in argv.

The offer door answers a lane about its *last* offer, settled ones included, which is what makes
this readable at all: a lane that offers and then withdraws — the withdraw being what gives it
permission to run the suite locally — still gets its offer back on the GET. The probe uses only the
pane's own `FLEET_SELF_URL`; no address is written into the tracked file (the leak pin in
`e2e/pins.ts`), so a pane without it leaves `offered` absent.

`TRAIL_SCHEMA` stays at `1`: the three fields are additive and optional, and every row written
before them is still a complete row under the same version.

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

### 4a. `phases` — what `msSincePrev` was spent on

2026-09-14. `msSincePrev` names how long the way from the previous check was, not what it was
spent on: on `isolated-20260914T043130Z-27323` 217 checks with 3–10 s gaps carried 1 070 of 2 122 s
and the row could attribute none of it. Since then every row also carries `phases`, built in
`e2e/trail-emit.ts#createPhaseClock`:

| phase | what is timed | wrapped at |
| --- | --- | --- |
| `boot` | a srv stop/restart, including the polls inside it | `e2e/harness.ts#stopSrv`, `#restartSrv` |
| `tmux` | one tmux call, or a whole pane env probe | `e2e/harness.ts#tmuxOut`, `#paneEnv` |
| `http` | every `fetch` of the runner process — `post()`/`get()` and the direct calls alike | `globalThis.fetch`, wrapped once |
| `sleep` | every `Bun.sleep` | `Bun.sleep`, wrapped once |
| `rest` | `msSincePrev` minus the four: synchronous work (`spawnSync` git fixtures, JSON parsing), `setTimeout` waits, direct `Bun.spawn` of tmux, WebSocket waits | — |

**Exclusive, by priority.** The four are not stopwatches: `restartSrv` polls with `get()` and
`Bun.sleep`, `paneEnv` is a loop of tmux calls and sleeps, and a check may await two fetches at once.
Summed stopwatches would count one second two or three times. Every start and end of a timed call
is a transition instead, and the interval since the previous one is booked to the highest-priority
phase active during it (`boot > tmux > http > sleep`) or to nothing. The four never overlap, so
`boot + tmux + http + sleep + rest === msSincePrev` holds exactly, and `e2e/trail.ts` asserts it on
every row of the run it belongs to.

**`phaseTop` and `phaseSum` are samples, not sums.** Per row and phase, `phaseTop` names the single
longest *outermost* call (a `get()` started inside `restartSrv` is `boot`'s work and never its own
entry), and `phaseSum` the site whose outermost calls add up to the most, with their count. Both
are needed: a poll loop is forty 250 ms sleeps from one line, which the longest single call never
names. On a partial run on 2026-09-14, the longest-call sample covered 77 of 506 sleep seconds in
the 3–10 s band. The site is the first stack frame outside `trail-emit.ts` and `harness.ts`. A call
from a harness helper that has already awaited names the helper line, because the calling check's
frame has left the stack by then. Summing either field by site gives a lower bound per site; how much
of a phase it covers is a number the reader computes (sum of `phaseSum[p].ms` over sum of
`phases[p]`).

**Cost and switch.** About 1.3 µs per timed call on the Mac (wrapped against raw `Bun.sleep(0)`,
2026-09-14), plus one stack format (~0.6 µs) per outermost call. `FLEET_E2E_PHASES=0` turns the wrapping and
all three fields off, which exists only for the overhead comparison. `trailstats.ts` ignores all three fields;
`e2e/trailstats.ts` checks that rows with, without and mixed `phases` give the same answer.

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
  folded into either of the other two. Since 2026-09-08 such a row carries `treeWhy` (§2), so a
  reader can tell the legitimate anonymous run from a broken pointer home or an absent git without
  the run's tail.
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
audits. `FLEET_TRAIL_DIRS` overrides. Files are pre-filtered by mtime, **filtered by `?suite=`**,
and only then capped at the newest 400 (~28 MB, ~325 ms measured), with `filesOmitted` reporting
the cut rather than hiding it — and
**handed to `trailStats`, which will not answer `never-failed` while any file went unread** (it
answers `insufficient-evidence` instead). The cut is newest-first, so the unread remainder is the
*older* material, which is where a historical flake lives by definition: measured 2026-08-07 on the
deployed tree, `FIX1` read `never-failed, runs 74, failedRuns 0` over the newest 400 files while the
741 omitted ones held 9 failing runs on 3 distinct clean trees. Only the absence claim is downgraded
— `not-your-diff` rests on clean fails already seen, and unread files can only ever add more.
`not-in-window` (`runs === 0`) is structurally the same absence claim over the same cap and is
**not** yet covered.

**The suite filter runs BEFORE the cap, and that ordering is the whole point** (fixed 2026-09-06,
program "Audit-Determiniertheit 2026-09"). It used to run after, inside `trailStats`, which turned
a file cap into a suite-skewed *sample*: measured 2026-09-06 with HEAD and the fixed tree reading
the same real trail directories, `?suite=isolated&days=7` answered over 400 files of which 341
belonged to other suites and reported 59 isolated runs, where the fixed tree reports 192 — the exact
count a direct scan of those two directories finds. The skew grew with everything else the machine
happened to be running. A file's suite is read from its NAME (the name is the run id,
`${suite}-${stamp}-${pid}`, §2), so it costs no read; a name that does not parse is never excluded,
and the row's own `suite` field stays the authoritative filter. `filesOtherSuite` counts what the
name filter dropped. It also sharpens the `never-failed` downgrade above: with `?suite=`, only
unread files of *that* suite can now falsify the absence claim, where before every unread file of
every other suite downgraded it too.

**A cut answer says so in a word.** `filesOmitted` alone never closed the hole, because a caller
comparing `?days=7` with `?days=30` got two identical answers and no field stating that the second
window had not actually widened. Two fields do:

- **`truncated`** — `filesOmitted > 0`. `runs` is then a sample, not a count.
- **`coveredFrom`** — the oldest mtime actually opened. The answer describes `[coveredFrom, now]`,
  never the asked `days`. It equals `window.from` exactly when nothing was cut, so
  `coveredFrom === window.from` is the machine-readable "this is the register". It is a *floor* on
  coverage: rows inside the oldest file read may be older still.

Two windows reporting the same `coveredFrom` read the same material. That comparison — not `runs` —
is how a caller checks whether a wider `days` bought anything.

**It gates nothing and alarms nobody.** A verdict here is evidence *for* a lane's proof order, not
a substitute for it — the same stance §5's "must never change a run's outcome" takes on the write
side. And the retention question §3 left to "the query layer that will read it" is still open: the
cap bounds the *read*, not the directory.

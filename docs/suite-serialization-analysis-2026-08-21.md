# Suite serialization — analysis, Claude-verified (2026-08-21)

Owner ask, verbatim: *"look into suite serialization and to find potential improvements"* — executed by
GLM-5.3 against `docs/suite-serialization-brief-2026-08-21.md`, then verified check-by-check by Claude
(Opus 5). This file is the reviewed result; it is not GLM's report reprinted. Where the two differ, the
disagreement is named in §4 and the corrected figure stands in the text.

**Nothing was run.** No suite, no server, no wrapper, no lock touched — by GLM or in this review. Every
figure comes from `e2e-trail/`, the gitignored ledgers, git history, or arithmetic over the wrappers'
own `sleep` lines. GLM's run was checked for repo mutation: main's tracked files are clean at `2b8bf87`;
the only untracked files present are the owner's own pre-existing scratch docs.

Verification base: main `2b8bf87`, trail read in full — **3203 run files, 211 MB, 844,048 check rows,
679 fail rows, 2026-07-27 → 2026-08-21**.

Every claim carries `measured` · `inferred` · `unknown` and a cost.

---

## 1. L1 — the concurrency doctrine: `pre-fix evidence window / post-fix unknown`

**The claim under test** (`CLAUDE.md:322`, main fassung): two concurrent `./e2e-isolated.sh` runs
"erzeugen auf dieser Maschine zuverlaessig Fehler auf BEIDEN Baeumen mit unterschiedlicher Signatur".

**Dating, `measured`:**

| fact | timestamp | source |
|---|---|---|
| the claim's evidence (lane b798/SEC-4) | **2026-07-26** | `docs/attic/regelbuch-messgeschichten-2026-08.md` §11 |
| four root-cause fixes land | **2026-07-28T14:10:37Z** | `0916a9f` |
| machine-wide mutex lands | **2026-07-28T16:50:01Z** | `ddc5128` |

The evidence predates the fix by two days. `measured`.

**What the post-fix trail shows, `measured`.** Across all 3203 runs there are exactly **8 interval
overlaps** — I reproduced GLM's count and its full composition independently:

- **6 on 2026-07-28, 14:56–15:03Z** — one `isolated` run overlapping gate suites. These fall *after* the
  merge fix (14:10Z) and *before* the mutex (16:50Z): the one window in the whole record where
  post-fix concurrency was possible. Fail counts 1F vs 0–2F.
- **1 zero-second boundary touch**, 2026-08-07 (UTC), zero fails on both sides.
- **1 genuine post-mutex `isolated × isolated` pair, 2026-08-18** — `isolated-20260818T044313Z-87242`
  × `isolated-20260818T044408Z-91626`, 938 s overlap, same dirty tree, 7 vs 25 fails.

That pair is a **lock bypass, not a wrapper race** (`measured`): run 1's three failing checks are its
own mutex-visibility assertions, each naming `lock={"pid":90038,"alive":true,…}` — and pid 90038 is
run 2's wrapper. Run 1 held no default lock at all. Run 2's 25 fails are one in-flight feature family
(Program-MAIN succession), which fails on other dates independently of concurrency. **Which** bypass
(direct `bun fleet-e2e.ts` vs a `FLEET_SUITE_LOCK` override) is `unknown` — the trail carries no env.

**Verdict.** The doctrine's evidence is pre-fix; since the mutex, no two wrapper runs have ever run
concurrently in 3203 runs. The doctrine is therefore **not confirmed and not refuted — it is untested**.
Per the owner's rule this is recorded as **`pre-fix evidence window / post-fix unknown`**, explicitly
*not* as "the mutex is unnecessary". One sub-fact stays `unknown`: whether any of the three owner
interventions cited at `e2e-stage.sh:33-35` postdates 14:10Z.

**Cost of leaving it untested** (`measured` + `inferred`): the doctrine prices every suite as exclusive
machine time — **18 isolated runs on 2026-08-20 summing to 5.10 h of serialized holding** (direct sum,
not count×median). The mandatory-preview half of that was already retired on 2026-08-07 for measured
zero yield (`CLAUDE.md:241`, "~165 min/Tag … für 0 echte Vorschau-Funde"). Cost of relaxing it wrongly:
red audits and misattributed lane failures. Both large — which is why the answer is a measurement, and
why no change is proposed here.

**Measurement protocol (proposed, not run).** Pinned clean `main` tree; serial arm N=10; concurrent arm
N=10 pairs, each instance given a separate `FLEET_SUITE_LOCK` (deliberately bypassing the mutex — this
measures machine-load interference, not lock correctness); score per check-family via the trail join;
dirty runs never count. Honest power statement (`inferred`): at the current clean-run red rate this
detects only a **large** effect; a small one needs ≈N=50 pairs ≈ 28 h of deliberate machine time. Any
run scheduled deliberately, never beside a land, results dated.

---

## 2. Ranked findings

### F1 — L1 above. `measured` + `unknown`. Cost as stated.

### F2 — Priority inversion is real; its "realized damage" leg does not survive verification

`measured`: the tier-2 audit holds the mutex for its whole run — `watchdog.sh:108` (`AUDIT_CMD`) ends in
`./e2e-isolated.sh` and sources the mutex at `e2e-stage.sh:77`. Newest-50 audits: **median 1,001,212 ms**
(`post-land-audits.jsonl`, 228 rows: **172 green / 41 red / 15 unknown**). The gate chain takes the same
lock three times (`watchdog.sh:91`). The wait budget was raised **900,000 → 2,700,000 ms** on 2026-08-20
(`e19c80f`, live at `watchdog.sh:148`; the server default is still 900,000 at `server.ts:9308`) — so a
land's verdict may now legally arrive 45 min late.

**Correction to GLM (see §4.1):** its "realized damage: `waitedOut` on 3 lands plus 1 `timedOut`" does
not hold. `lane-outcomes.jsonl` has **no `waitedOut` field**; the three occurrences are prose inside the
`review` text of three rows whose `disposition` is `landed`. Realized wait-out count from that ledger is
**`unknown`, not 3**. What survives as evidence: the 2026-08-06 kill (~107 s work / ~255 s queue,
`suite-contention.md` §8) and `docs/waitedout-waisen-2026-08-19.md`, which documents a 25-min gate against
a 15-min budget and `running:true` sticking after the kill. Both `measured`, both real.

**Re-entry against `suite-contention.md` §7** (which rejected scheduling/priorities/merge-train at ~6
lands/day). Two of GLM's three evidence legs survive: holder duration grew **415 s → ~1010 s median**
(2026-07-27 → 2026-08-20, `measured`), and the budget was tripled 15 days after the split landed
(`measured`). The third leg is void per above. **Smallest shape outside the rejected family** — not lane
priorities, not a merge train: fleet's own *async* work defers to fleet's own *gating* work —
`drainPostLandAudits` (server-internal, already coalescing to the newest tip) skips *starting* while a
land-gate run reports `waiting`. A deferred audit loses nothing; no lock semantics change; no lane-to-lane
ordering is created. Cost if unbuilt (`inferred`): at measured growth, two queued audits approach the
45-min budget at burst-land times. **Owner's call** — §8 of `suite-contention.md` names this open itself.

### F3 — Poll granularity and three acquisitions per gate run: the cheapest win, and format-safe

`measured`/structural: `e2e-stage.sh:105` sleeps a flat 15 s; the chain's three lock-taking wrappers
source it independently (`e2e-clean-review.sh:23`, `e2e-security.sh:27`, `e2e-claude-gate.sh:29`). Per
contended acquisition that is 0–15 s of pure detection latency, ×3 per gate run; and between its own
stages the gate can lose the lock to an audit — up to **+1000 s** of verdict latency (`inferred` from
~18 audit-class runs/day).

**Coupling, `measured`:** the two §2b suite-lock checks each wait out exactly one poll interval —
**15,150 ms and 15,163 ms median, n=271 each**. They are isolated-only and present in **271 of the 327
isolated runs since 2026-08-06 (83 %)** — so the cost is **30.3 s per carrying run ≈ 7.5 min/day** at the
measured 18 runs/day (GLM said ~10 min/day; see §4.4).

**Safety of shortening, checked as ordered (`measured`):** `e2e/pins.ts:311-330` extracts every
`[suite-lock]` printf format from the script and holds it against `SUITE_LOCK_RE` (`server.ts:9446`) — it
pins **formats, not cadence**. The §2b assertions are vocabulary/regex-only with 2500/5000 ms capture
budgets (`e2e/verify-queue.ts:254,266,282`). So a short-then-backoff poll (1, 2, 4, 8 → 15 s steady)
breaks no pin, cuts the §2b pair to <10 s and contended detection to ~1–2 s. Reap-race note (`inferred`):
faster polling raises reap-collision frequency, but the design's race window is microseconds against a
≥1 s cadence — negligible. Holding the lock once across the whole chain is a separate, larger decision
and is **not** bundled here.

### F4 — 127.05 s of fixed sleeps in the dominant holder — and my brief's 201 s was wrong

`measured`: `e2e-isolated.sh` carries **127.05 s** of fixed `sleep` — 12.7 % of the 1001 s median holder.
**GLM corrected the brief here and it is right:** the brief's "201 s" added `e2e-postland-audit.sh`'s 74 s,
but that wrapper is **not** the live audit — it has run **13 times ever** (48–90 s each), while the live
audit runs `./e2e-isolated.sh` (`watchdog.sh:108`, confirmed against the `cmd` field of every audit row).
Recoverable ceiling ≈ **38 min/day** at 18 runs/day, and only if every sleep can become a condition-poll —
per-site condition-ability was **not** audited (`unknown`). The repo's own doctrine constrains the shape:
fixed waits are "the shape of a removed flake" (`e2e/harness.ts`, `paneEnv()`), so replacements must poll
a condition, never shorten a constant.

### F5 — The suite's slowness is mostly *deliberate* waiting; the holder grew ~2.4× in 24 days

`measured`: the 15 slowest checks of each run sum to a **median 171.7 s = 17.2 %** of a 1001 s run
(per-run statistic, newest-50 isolated — see §4.3 for why this replaces GLM's 18.7 %). Decomposition
matters: the V1 pair (13.3 s + 12.3 s) and the readiness checks are *deliberate timeout tests*, not slack.
The genuinely recoverable class is §2b (30.3 s, F3) + fixed sleeps (127 s, F4) ≈ **157 s ≈ 15.7 %**.

Holder duration moved **415 s → ~1010 s** median while checks/run moved **887 → 2746** (2026-07-27 →
2026-08-20, both `measured` medians): growth is check-count, ≈0.36 s/check (`inferred`), not machine
degradation — the filesystem layer is measured dead (brief §2).

**Uncosted observations.** (a) The top failing check today — `the sessions payload stays under 12 KB…` —
failed **18 distinct runs, 2026-08-14 → 08-20**: a ninth-family candidate not in the §11.2 registry, which
ends at the eighth. (b) The `fresh-for-gates` pair — a *land-gating* family — failed **15 runs,
2026-07-28 → 08-11**, dormant since; whether fixed is `unknown`. (c) The single slowest check in the trail
is `baselineRate: an idle window…` at **20.00 s**, but it runs in only 36/459 isolated runs (8 %).

### F6 — Documentation architecture (owner addendum, bounded)

**Where suite truth lives today** (`measured`): executable code (`e2e-stage.sh:32-108` — mutex semantics
*plus* a frozen doctrine comment; `server.ts:9308/9446`; `watchdog.sh:91/108/148`; `e2e/pins.ts`) ·
private overlay (`CLAUDE.md:91`, `:241`, `:322`) · tracked docs (`suite-contention.md`,
`verify-tiering.md`, `e2e-trail.md`, `AGENTS.md`) · trail + ledgers · retired decisions in prose
(`suite-contention.md` §7) · attic origin (`regelbuch-messgeschichten-2026-08.md` §11).

**Measured staleness, three instances.** `suite-contention.md:228` says the wait budget is "(live
900 000)" — live is **2,700,000** since `e19c80f`: a reader sizing the queue is off 3×. `CLAUDE.md:91`
says the audit takes "~9,4 min" — measured **16.7 min**. `e2e-stage.sh:32-35` freezes the pre-fix
doctrine inside the code surface — the one claim §1 had to date by archaeology across three surfaces.

**Smallest durable arrangement (proposal only, reusing machinery that already exists).**
(i) *One canonical contract*: `suite-contention.md` becomes the single normative home for lock semantics,
the wait-line format rule (pointing at `pins.ts:311-330`), budgets (pointing at the spawn line), tiering,
and the doctrine's **status line with its evidence window** (§1's verdict, dated). Other surfaces keep
rules but stop restating numbers. (ii) *Generated projection*: one small facts block (holder p50/p95,
checks/run, audits/day) rendered from the trail and pinned byte-for-byte — the precedent is
`pins.ts:587-591`. (iii) *Retired index*: make §7 the single index of closed doors so one grep finds them.
(iv) *Freshness pins*: numbers claiming the spawn line opt into the existing marker mechanism
(`pins.ts:779+`); `CLAUDE.md` is structurally unpinnable (`pins.ts:556-560`) and therefore shrinks to
rules + pointers. No doc rewrites, no generalization beyond the suite domain.

---

## 3. Cut line

The ask was suite-serialization improvements plus the documentation addendum. **The ranking stops after
F6.** Below the line, filed as uncosted observations only: the 12 KB ninth-family candidate and the
dormant `fresh-for-gates` family (F5), the still-open orphan/grandchild kill semantics
(`waitedout-waisen-2026-08-19.md`), and audit-red adjudication rates (41 red / 228, unanalyzed).

---

## 4. Claude review — agreement and disagreement

GLM's work is unusually well-grounded: I reproduced its trail aggregates **exactly** — 3203 files,
844,048 rows, 679 fail rows; the 8 overlaps and their full composition; the 2026-08-18 pair down to
pid 90038 and the Program-MAIN family; 172/41/15 audit verdicts; the newest-50 median of 1,001,212 ms;
the §2b medians at n=271; the 18-run and 15-run failing-check windows; and every cited line number in
`watchdog.sh`, `server.ts`, `pins.ts` and `verify-queue.ts`. Its L1 verdict took the correct
conservative form on its own, without being pushed there.

Where I constrain it:

**4.1 — The "3 waitedOut lands + 1 timedOut" is a grep artifact, and it was load-bearing.** All three
occurrences of `waitedOut` in `lane-outcomes.jsonl` sit inside the free-text `review` field of rows whose
`disposition` is **`landed`** — reviewers discussing the gate code that implements the feature. The
ledger has no `waitedOut` field at all, and `audit.jsonl` and `server.log` have zero occurrences. The
count 3 equals `grep -c`, and the three dates GLM reported are simply those rows' dates. This was F2's
"realized damage" leg — its strongest argument for re-opening the §7 rejection — so the re-entry
threshold must be restated on the two surviving legs. Correct verdict: **`unknown`, not 3**.

**4.2 — "20 isolated runs on 2026-08-20" is 18, and the day's total is a direct sum, not count×median.**
Local-day bucketing gives 18 runs on 08-20 (20 falls on 08-19), and the summed holding is **5.10 h**, not
the 5.6 h that 20×1001 s implies. Order of magnitude right, figure loose; day boundaries are timezone-
sensitive and GLM did not state which it used.

**4.3 — The "top-15 = 187.5 s = 18.7 %" mixes populations.** The numerator draws check medians from all
suites across the whole trail era; the denominator is a newest-50 *isolated* run. Recomputed per-run on
the matching population — the 15 slowest checks *of each run*, no cross-run mixing — the figure is
**171.7 s = 17.2 %**. GLM's conclusion is unchanged; the statistic was inflated ~1.5 pp. I note this
having made the same class of error myself mid-review: a 90 %-presence filter briefly showed §2b at 0 s,
which was my threshold artifact, not evidence of absence.

**4.4 — §2b is present in 83 % of isolated runs, not all of them.** So F3's daily cost is ~7.5 min/day at
the measured 18 runs/day, not ~10.

**4.5 — Loose endpoints on the growth series.** GLM's "checks/run 1007 → 2771": the measured day-medians
are **887 → 2746**; 2771 is a single run's count, not a median. The ~3.1× trend holds.

**4.6 — A narrative omission, not an error.** GLM's family clustering skips the two slowest checks in the
trail (`baselineRate`, 20.00 s and 15.28 s). Its sum included them, but the prose under-describes the top
of the distribution. They run in 8 % of isolated runs, which is why they matter less than their rank.

**Retired-list check.** F2 enters the neighbourhood of `suite-contention.md` §7's rejected
scheduling/priorities/merge-train, but does so explicitly and narrowly: server-internal deferral of
fleet's own async work, no lane ordering, no priority queue, no train. I judge that inside the allowance
— **provided** the evidence threshold is restated per §4.1. Nothing else in this file re-proposes a
closed door.

---

## 5. What was not checked

- **Nothing was executed.** No suite, no server, no wrapper, no lock. All figures are read or arithmetic.
- The 2026-08-18 bypass mechanism (direct runner vs `FLEET_SUITE_LOCK` override) — `unknown`, the trail
  carries no env.
- Whether any 2026-07-28 owner intervention (`e2e-stage.sh:33-35`) postdates the 14:10Z fix — `unknown`.
- F4's 38 min/day is an arithmetic ceiling; **per-sleep condition-ability was not audited**.
- `drills/drill-3.sh` and `steward-arena.sh` mutex-use frequency — not checked.
- The 13 `postland-audit`-wrapper runs were counted, not profiled; `fresh-for-gates` dormancy was not
  investigated.
- I did not read `e2e/pins.ts` or `e2e/harness.ts` in full — only the cited pin families and the
  `paneEnv` doctrine.
- I verified GLM's cited line numbers but did not re-derive its reading of `server.ts:11578/11877`
  (`gateView`/`gateRun` scope); those two cites land on comments rather than the claimed code.
- Whether any land ever actually waited out is **`unknown`**: no ledger records it structurally. Making
  that observable is a prerequisite for F2 and is not proposed here.

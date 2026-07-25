# What a lane costs, and where the cost goes

Research lane, 2026-07-25. Adversarial study of `lane-context.md` §4.1 (`GET /api/self/context`).
The brief was explicit: **try to refute the thesis.** A confirming study from a sibling model is
worth little (`autonomy-plan.md` A10). Killing the proposal is a successful outcome.

**Verdict up front: DROP §4.1 on cost grounds.** Under the rule that most favours the proposal,
the questions the endpoint answers account for **3.10 %** of what a landed lane costs and
**0.90 min** of its wall-clock. Under the honest rule, **0.41 %** and **2 seconds** — and
**13 of 18 landed lanes spent exactly zero.** The number that would flip it is in §7.3.

---

## 1. Pre-registration — thresholds fixed before any number was computed (A9)

This section was written to disk as the file's first content, before a single token was counted.
(Verifiable only in this lane's transcript; there is no second commit to prove it. Stated as a
claim, not a proof.)

### 1.1 The quantity that decides it

Not "orientation share." Most orientation is an agent reading `server.ts` to find the code it must
change — **no endpoint replaces that.** The proposal lives or dies on a strictly smaller quantity:

> **EAO — endpoint-addressable orientation.** Tool calls whose answer is a field `§4.1` would
> return: branch/base/`baseSha`/ahead/behind/dirty (`lane`), what landed on main since the fork
> (`main`), other active lanes' files (`siblings`), the live `FLEET_VERIFY_CMD` / judges (`gate`),
> main-checkout `CLAUDE.md` vs the lane's copy (`rulebook`), prior outcome rows for this branch
> (`history`).

Everything else — reading source to change it, running the change, fixing it — is **not**
addressable and does not count, however large.

### 1.2 Thresholds, fixed in advance

| EAO as share of median landed-lane cost | Verdict |
|---|---|
| **≥ 10 %** | **BUILD** §4.1 as written |
| **2 – 10 %** | **RE-SCOPE** — build only the fields that clear §1.3 |
| **< 2 %** *and* < 1 min of median lane wall-clock | **DROP** — say so plainly and kill it |

Cost = US$, Opus 5 rates, verified today via the `claude-api` skill: input \$5/MTok,
output \$25/MTok, cache **write 1 h** = 2× input = \$10/MTok, cache **read** = 0.1× = \$0.50/MTok.
Transcripts carry `cache_creation.ephemeral_1h_input_tokens`, so the 1 h (2×) write rate applies.

### 1.3 Per-field threshold (governs the RE-SCOPE branch)

A field is worth building **iff ≥ 1/3 of landed lanes (≥ 6 of 18) make at least one call whose
answer that field contains.** A field used by 1–2 lanes is a brief's job, not an endpoint's.

### 1.4 What would falsify the *broader* claim ("lanes are starved")

If **total** orientation — every discovery call, addressable or not — is **< 20 %** of lane cost,
then the lane is not information-starved in kind, and the §1–§3 framing of `lane-context.md` is
wrong independent of the endpoint. If total orientation is high but EAO is < 2 %, the lane is
expensive to situate *in the repo*, which an endpoint cannot fix — also a refutation of §4.1,
by a different route.

### 1.5 Committed in advance

- I will report EAO under **two** classification rules (strict / generous) and let the weaker one
  drive the verdict, not the flattering one.
- `n = 18` landed rows is small. Per-lane numbers are reported individually, not just as a mean.
- If EAO lands under 2 %, the verdict is DROP, and I will not rescue the proposal with a
  correctness argument the cost data does not support. (§2.2 of `lane-context.md` may still stand
  on its own; that is a separate claim with separate evidence, and it is not this lane's job.)

---

## 2. Method — enough to re-run

**Population.** The 18 rows in `~/claude-fleet/lane-outcomes.jsonl` with
`disposition: "landed"` (20 rows total; `label-clamp` and `outcome-summary` are `killed-dirty`
and excluded).

**Transcript↔ledger mapping — checked, not assumed.** The brief warned that branch-name mapping is
unsafe. I did not use names. For each landed branch I scanned all 87 `~/.claude/projects/*` dirs,
parsed every `*.jsonl`, and kept only sessions whose **`cwd` field equals**
`~/claude-fleet.worktrees/<branch with / → ->`. Result: exactly one session for 17
lanes, two for `fleet/review-agent` (a 520-turn main session plus a 10-turn one, same `cwd`, same
hour — both counted). No landed branch mapped to zero sessions and none to a stale directory.
Directory naming variance (`…--claude-worktrees-…`) turned out not to matter: the `cwd` inside the
file is authoritative, the directory name is not.

**Cost.** Per assistant entry, from `message.usage`:
`input×$5 + output×$25 + cache_creation_1h×$10 + cache_creation_5m×$6.25 + cache_read×$0.50`, per MTok.

**Wall-clock.** First to last timestamp across a lane's sessions. This is *not* `sessionMs` — see §3.2.

**Unit of classification.** Bash commands are compound (`grep … ; echo … ; sed …`). I strip
heredoc bodies (otherwise commit-message prose matches every regex — an error I made and corrected
mid-study) and split on `;`, `&&`, `||`, `|`, newline. Each segment is one unit. `Read`/`Edit`/
`Write` contribute their `file_path` only — never their content, for the same reason.

**Phase (Rule A).** Each assistant *turn* is assigned one phase from its tool calls:
`verify` if any segment matches `./e2e-*|bunx tsc|bun test|bun run build|bun install`;
`change` for `Edit`/`Write` or `git add|commit|checkout|reset|stash`, `mv`, `rm`;
`orient` for `Read` and read-only shell (`grep|sed -n|cat|head|tail|wc|ls|find|git log|status|diff|show`);
`reason` for turns with no tool call. Ties and unclassified shell resolve to `orient` —
deliberately generous to orientation, since a large orientation share works *against* my verdict.

**Footprint (Rule B).** Characters of `tool_result` content, attributed to the category of the call
that produced them. This measures what *occupies* context, which matters because 75.7 % of spend is
re-reading context (§3.3).

**EAO, two rules.**
- **Generous (G)** — any unit touching a §4.1 target: `git status|rev-parse|merge-base|rev-list|branch|worktree list`; `git log/diff/show` naming `main` or a commit range; any path under another lane's worktree; `FLEET_VERIFY_CMD|VERIFY_TIMEOUT_MS|watchdog.sh|FLEET_CLEAN_REVIEW|FLEET_AUTO_REVIEW`; `CLAUDE.md`; `lane-outcomes`. Counted even when the lane was *implementing* that feature.
- **Strict (S)** — only units whose answer is **not in the lane's own worktree**: cross-worktree paths, `main`-relative git ranges, the live gate read out of the server process (`ps eww`), the main-checkout ledger, main-checkout `CLAUDE.md` comparison. This is precisely the set `lane-context.md` §2 argues the lane cannot see.

A turn counts toward EAO if **any** of its units qualifies — again generous, at the turn level.

Scripts: session scratchpad (`lib.ts`, `seg.ts`, `cost.ts`, `final.ts`, `foot.ts`, `q3.ts`);
not committed, per lane discipline. All inputs are read-only; nothing under `~/.claude/projects`
was written, moved or deleted.

---

## 3. Q1 — what a landed change costs

### 3.1 Per landed lane

| lane | files | turns | min | **$** | output | cache-read | cache-write | input | orient % | EAO-G % | EAO-S % |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `e2e-split` | 34 | 692 | 39 | **132.92** | 233k | 241.5M | 633k | 1 264 | 52 | 1.0 | 0.1 |
| `fleet/review-agent` | 0 | 530 | 48 | **44.70** | 115k | 74.5M | 457k | 1 002 | 82 | 0.7 | 0.0 |
| `disposition-rail` | 6 | 339 | 20 | **34.39** | 122k | 54.9M | 389k | 633 | 60 | 2.2 | 0.4 |
| `perception-write` | 6 | 204 | 55 | **22.66** | 144k | 30.0M | 407k | 382 | 37 | 3.3 | 0.0 |
| `verify-tristate` | 10 | 214 | 44 | **20.94** | 137k | 27.5M | 373k | 401 | 48 | 11.0 | 1.5 |
| `discrepancy-audit` | 13 | 182 | 16 | **17.92** | 146k | 21.2M | 366k | 338 | 42 | 6.2 | 4.3 |
| `outcome-feed` | 5 | 164 | 20 | **14.72** | 92k | 19.1M | 287k | 309 | 48 | 4.2 | 0.0 |
| `shadow-raw-persist` | 3 | 233 | 9 | **13.20** | 36k | 20.8M | 190k | 434 | 73 | 0.7 | 0.0 |
| `arch-review` | 1 | 78 | 11 | **12.95** | 70k | 13.6M | 440k | 149 | 51 | 8.1 | 0.0 |
| `p4-deploy-gap` | 3 | 154 | 19 | **11.28** | 73k | 14.3M | 231k | 287 | 50 | 2.1 | 0.0 |
| `fleet/outcome-recorder-fix` | 0 | 110 | 61 | **11.09** | 108k | 10.9M | 291k | 202 | 35 | 3.5 | 0.0 |
| `flake-mission` | 2 | 120 | 64 | **9.61** | 69k | 10.8M | 250k | 229 | 51 | 2.5 | 0.0 |
| `clean-review-shadow` | 3 | 130 | 10 | **8.61** | 51k | 11.2M | 172k | 244 | 39 | 4.6 | 0.0 |
| `criteria-progress` | 3 | 126 | 19 | **8.33** | 53k | 10.0M | 201k | 236 | 45 | 10.5 | 2.5 |
| `perception-facts` | 2 | 89 | 10 | **6.93** | 49k | 7.4M | 199k | 166 | 45 | 3.1 | 0.0 |
| `f9-verify-deps` | 2 | 89 | 26 | **5.60** | 48k | 5.7M | 156k | 167 | 48 | 17.5 | 0.0 |
| `enhance-facts` | 6 | 58 | 12 | **4.58** | 39k | 4.0M | 163k | 106 | 45 | 2.2 | 0.0 |
| `donelooking-latency` | 3 | 42 | 8 | **2.46** | 21k | 2.3M | 78k | 81 | 34 | 2.3 | 0.0 |

**Median landed lane: \$12.12, 20 min, 142 turns, 3 files.** Mean \$21.27 / 27.3 min — the mean is
dragged by `e2e-split` (34 files, 692 turns, \$133) and is the less useful statistic. Range is
54× (\$2.46 → \$132.92). **Eighteen landed changes cost \$382.88 in total.**

*(VERIFIED: every figure derives from `message.usage` in files I read. INFERRED: nothing.)*

### 3.2 `sessionMs` is not work time — do not bill from it

`sessionMs` is slot lifetime, not agent working time. Median 34 min on the ledger vs **20 min** of
actual transcript span. The gap is mostly benign, but `perception-write` reads **503 min** on the
ledger against **55 min** of transcript — the lane finished at 00:01 and landed at 07:29 while the
owner slept. Any future cost instrument must use transcript span, not `sessionMs`.

### 3.3 Where the money actually goes: re-reading context

| token class | tokens (18 lanes) | \$ | share |
|---|---|---|---|
| cache **read** | 579 649 662 | 289.82 | **75.7 %** |
| cache **write** (1 h) | 5 284 793 | 52.85 | 13.8 % |
| **output** | 1 606 838 | 40.17 | 10.5 % |
| **input** (uncached) | 6 630 | 0.03 | 0.0 % |

**32.2 M cache-read tokens per lane on average.** Prompt caching is working exactly as designed —
uncached input is 6 630 tokens across all eighteen lanes — but three-quarters of the bill is the
accumulated conversation being re-read on every turn. **The marginal cost of a tool call is not the
call; it is that its result then sits in context and is re-read by every turn after it.** This is
the single most decision-relevant number in the study, and it does not appear anywhere in
`lane-context.md`.

---

## 4. Q2 — the orientation share

**Rule A (turn cost attribution), 18 lanes, share of \$382.88:**

| phase | share |
|---|---|
| **orient** | **53.9 %** |
| reason (no tool call) | 36.3 % |
| change | 8.1 % |
| verify | 1.7 % |

**Rule B (tool-result characters — context footprint):** orient **95.4 %**, verify 2.6 %,
change 2.0 % (2.60 M of 2.72 M characters).

The two rules disagree in magnitude and agree in direction. Rule A's `reason` bucket (36 %) is
turns that emitted no tool call — thinking and writing, not discovery — and Rule A's `verify` at
1.7 % is misleadingly small because a 6-minute `./e2e-isolated.sh` is *one cheap turn*: it costs
wall-clock, not tokens. Rule B says that of everything a lane pulls into its context, **19 in 20
characters arrive through a discovery call.**

So `lane-context.md`'s §1.4 falsifier is **not** triggered: orientation is not marginal, it is the
dominant cost. That much of the note's framing survives.

**It does not follow that the endpoint helps** — which is §5.

---

## 5. Q3 — what orientation is actually spent on, across lanes

Recurring targets, counted by *how many of the 18 lanes* touch them (calls in parentheses):

| target | lanes | what for |
|---|---|---|
| `server.ts` | **16** grep (54), **12** `sed -n` window (80) | locating the code to change in a 5 299-line file |
| `fleet-e2e.ts` | **12** grep (29), **10** `sed -n` (46) | same, 3 724 lines |
| `src/client.ts` | 6 grep (20), 4 `Read` (15) | same |
| `e2e-isolated.sh` | 3 (17) | which env the harness sets |
| `^FAIL` / `^PASS` / `ALL PASS` grep | **12 / 6 / 3** (67 total) | triaging e2e output |
| polling `tasks/*.output`, `scratchpad/*.log` via `Read` | 2 (287 calls) | waiting on backgrounded suite runs |
| `CLAUDE.md` | 2 (9) | — |
| any sibling worktree | **1** (2) | — |
| `lane-outcomes.jsonl` *data* | 3 (10) | — |

**The recurring orientation cost is locating code inside three large files, plus parsing test
output.** Both recur across a clear majority of lanes; **neither is a field in §4.1.** The
questions §4.1 answers sit at the bottom of this table, in the 1–3 lane band.

One incidental finding worth its own line: two lanes issued **287 `Read` calls** polling background
log files. That is a busy-wait on a suite run, and it is a bigger, more mechanical waste than
anything the context endpoint targets.

---

## 6. The decisive number — EAO

**Total EAO across 18 landed lanes: generous 3.10 %, strict 0.41 %.**
Median per-lane: generous 3.18 %, strict **0.00 %**.
Wall-clock: generous **0.90 min/lane**, strict **0.03 min/lane** (2 seconds), of a 20-min median.
Context footprint: EAO results are **4.13 %** of all tool-result characters.

**13 of 18 landed lanes have strict EAO of exactly zero.** The five non-zero lanes are
`discrepancy-audit` (4.3 %), `criteria-progress` (2.5 %), `verify-tristate` (1.5 %),
`disposition-rail` (0.4 %), `e2e-split` (0.1 %) — and the first three were lanes whose *assigned
task* was auditing claims, the outcome ledger, and the verify gate respectively. They read those
targets because they were changing them, not because they were lost.

### 6.1 Per field, against the §1.3 threshold (≥ 6 of 18 lanes)

| §4.1 field | lanes | units | frequency | verdict |
|---|---|---|---|---|
| `lane` (dirty/status) | 18 | 67 | passes | **but worthless** — **61 of the 67 units are plain `git status`** (only 9 of those sit in a command that also commits; the rest are standalone dirty-checks). Just **6 units** across all 18 lanes are anything else — `rev-parse`, `merge-base`, `rev-list`, `branch`, `worktree list`. The dirty check is already local, already free, and already being made successfully. An endpoint replaces a working zero-cost call. |
| `gate` | 6 | 40 | passes (exactly) | **but attributable** — 5 of the 6 (`f9-verify-deps`, `verify-tristate`, `arch-review`, `clean-review-shadow`, `fleet/outcome-recorder-fix`) were editing the gate/watchdog. Exactly **one** lane (`discrepancy-audit`) probed the *live* gate as orientation, via `ps eww … FLEET_VERIFY_CMD`. |
| `history` | 9 | 28 | passes | **but spurious** — most hits are `grep -n "lane-outcomes" server.ts`, i.e. finding the code. Only **3** lanes read ledger *data*, and none asked "what happened to my branch before." |
| `rulebook` | 2 | 9 | **fails** | |
| `main` | 2 | 5 | **fails** | |
| `siblings` | **1** | 2 | **fails** | |

After correcting for implementation-vs-orientation, **no field passes both frequency and value.**

### 6.2 Nobody ever asked the question the proposal is built around

`lane-context.md` §4.1 leads with ahead/behind and "what moved under you." I searched every Bash
segment in all 18 lanes for `behind|ahead|merge-base|rev-list --count|git fetch|origin/main|HEAD..main`.
**Two hits, both in one lane** (`criteria-progress`), and both are commit-archaeology during a code
investigation — `git log --oneline -1 origin/main`, `git merge-base --is-ancestor 9c1ffbe 16468a2` —
not "am I stale."

**No landed lane ever asked whether it was behind main. No landed lane ever asked what a sibling
was touching**, apart from `discrepancy-audit`, whose brief was to audit across worktrees.

---

## 7. Verdict on `lane-context.md` §4.1

### 7.1 Build / re-scope / drop

**DROP** — as a cost or efficiency proposal, in full, including the narrowed "`gate` and `rulebook`
first" recommendation in its own §6.

Against the pre-registered table: strict EAO is 0.41 % (< 2 %) **and** 0.03 min (< 1 min) → DROP.
Generous EAO is 3.10 %, nominally the RE-SCOPE band, but it fails the wall-clock arm at 0.90 min,
and §1.5 committed the weaker rule to drive. Generous is also a genuine *upper bound*: turn-level
attribution charges an entire turn to EAO if one of its segments matched, and it counts lanes
reading gate code they were sent to modify.

Even taking the upper bound at face value: **3.10 % of \$12.12 is 38 cents per landed change.**

### 7.2 The structural objection, which the numbers make unavoidable

`lane-context.md` §2.3 correctly diagnoses that "**nothing prompts the lookup**," citing
`lane-brief-template.md`'s conclusion that the real defects were *attention-allocation* failures,
not information failures. §4.1 then proposes converting push into pull — and a pull endpoint is
answered only when someone asks.

The data says lanes do not ask. `flake-mission` is the note's own §3 exemplar: it ran 64 min and
drifted to `behind: 4` while four siblings landed under it. Its strict EAO is **0.0 %** and its
generous EAO is 2.5 %. **It never issued a single behind/main/sibling query.** An endpoint it
would not have called would not have saved it. The proposal inherits, undiluted, the exact problem
its own §2.3 identifies.

### 7.3 The number that would flip this

Build §4.1 when **either** holds:

1. **Demand shows up.** ≥ 6 of the next 18 landed lanes issue at least one `main`/`siblings`/
   live-`gate` query (strict rule, §2), *without being told to*. Today: 1, 1, and 1 respectively.
2. **A land-time counter finds the harm the lane never sees.** Record `behind`-at-land on the
   outcome row — `lane-context.md` §6.2 already notes the field does not exist. If ≥ 1/3 of landed
   lanes show `behind ≥ 2`, the lane is drifting blind and the *push* case is re-opened. Note this
   argues for a **notification**, not an endpoint.

A cheaper intervention dominates both: since `lane-context.md` §4.4 wants thinner briefs anyway,
put the four static facts (base sha, gate command, sibling producers, rulebook mtime) **into the
spawn-time brief**, where the lane reads them for free. That costs a template change and no
endpoint, no token, no route, no auth surface.

### 7.4 What this study does **not** refute

Per §1.5, stated plainly rather than quietly dropped:

- **§1's asymmetry is a verified fact** and my data does not touch it. The lane really is the least
  situated principal.
- **§2.2's correctness defect stands unexamined.** "No file a lane can read tells it what will
  actually gate it" is a claim about *wrong belief*, not cost. A defect can be worth fixing at
  0.41 % measured cost if it is rare and catastrophic. I measured how often lanes *ask*; I did not
  measure how often they were *wrong without knowing it*. That study would need land-time gate
  failures, not transcripts — and it is not this lane's job.
- **§4.2 (a credential for plain sessions)** is an access-control claim, not a cost claim.

The efficiency argument for §4.1 is dead. If §4.1 gets built, it must be on §2.2's correctness
argument alone, sized to that argument (the `gate` field, nothing else) — and my numbers say that
field would serve one lane in eighteen.

---

## 8. What I could not measure

1. **Sub-agent cost.** `isSidechain` is `0` across all 3 554 assistant entries, so the 4 `Agent`
   calls in `discrepancy-audit` ran in transcripts I did not locate. That lane's \$17.92 is a
   floor, not a total.
2. **The auto-③ reviewer.** `verify-tristate`'s project dir holds two extra session IDs
   (`775d50b9`, `b2e90ac4`) containing only `last-prompt`/`ai-title`/`mode` metadata — the reviewer
   prompt is visible ("You are a read-only code reviewer…") but no `usage` was persisted. Reviewer
   spend per land is unmeasured, and it is charged to the same budget.
3. **Merge-resolver, commit-message, enhance, digest workers** (`SUMMARY_MODEL`) — same problem.
   The \$382.88 is what **lanes** cost, not what **landing** costs.
4. **Wall-clock inside a tool call.** A 6-minute e2e run is one turn; my minute figures are
   timestamp deltas and undercount time the agent spent waiting. Verify's true wall-clock share is
   much larger than its 1.7 % cost share.
5. **Counterfactual savings.** I measured what lanes *did ask*. I cannot measure the cost of a
   question a lane should have asked and didn't — which is precisely `lane-context.md`'s strongest
   remaining position, and precisely what §7.3's counter #2 would instrument.
6. **Failed-loop cost as its own bucket.** The brief asked for fix-run-fail recovery separately. I
   could not separate it from `change`+`verify` without a reliable failure signal in the
   transcript; the `^FAIL` grep pattern in 12 lanes says the loop exists, but I will not put a
   number on it. Reported as not measured rather than guessed.

## 9. Limits of the sample

`n = 18`, all landed within a 20-hour window (2026-07-24 18:15 → 2026-07-25 14:15 UTC), one owner, one
codebase, one model tier, briefs written by one steward. Median 3 files touched — these are small
changes. `e2e-split` alone is 35 % of total spend, so any mean is unstable; medians are reported
throughout and per-lane rows are given so nothing hides in an average. Two `killed-dirty` lanes are
excluded by design, which biases the population toward lanes that went well — if under-situation
kills lanes, this sample is the wrong place to see it, and `n = 2` is too small to check.

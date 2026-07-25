# What the outcome ledger actually says — audit, 2026-07-25

*An investigation lane's read of `lane-outcomes.jsonl` at 27 rows. Written against the file in the
MAIN checkout (it is gitignored; nothing from it is copied here beyond counts, branch names and
dispositions — no prompt text, no review bodies). Line refs drift: grep the symbol. Note the grep
hazard in F5 before you trust a `grep` over `src/client.ts`.*

**Headline:** `graduation-criteria.md` §1 currently reads **MET** — K1 20/20, 18/10 clean, 0 undos —
and its review-coverage clause passes at **exactly 80.0 %** only because one reviewer answer that
never parsed is counted as coverage. Requiring "covered" to mean a review that provably parsed
takes it to 60 %. §1 is one row wide.

---

## 0. Method — what is VERIFIED vs INFERRED

**Verified** = I read the code or ran the command, output quoted below. **Inferred** = concluded
from something verified, not itself executed.

Verified: all 27 rows parsed and tallied field-by-field (`bun`, not `grep`); `buildLaneOutcome`,
`laneForkSha`, `outcomeReview`, `runVerify`, `laneOwnerPrompts`, `openSlot` and both land sites read
in full; `kProgress` **cut out of `src/client.ts` and executed against the real ledger** (the same
extraction `e2e/outcomes.ts:314` uses); the anomaly-(a) mechanism reproduced in a synthetic git repo;
the prompt journal's `source` tags counted for the affected lanes (counts only — the file is mode
0600 and can carry secrets, `server.ts:345`).

Not verified — see §7 for the full list.

---

## 1. The data, recounted

```
$ wc -l lane-outcomes.jsonl          → 27
disposition       {"landed":25,"killed-dirty":2}
verified          {"true":22,"null":4,"false":1}
confirmedByHuman  {"false":24,"true":3}
```

The owner's counts are exact. Beyond them:

```
review key        {"covered":19,"none":3,"inflight":1,"ABSENT-KEY":4}
cleanReviewShadow {"ABSENT":14,"raw(invalid)":7,"verdict=pass":6}
model             {"claude-opus-5[1m]":2,"null":25}
resolvedConflict  {"false":25,"true":2}      repairRounds {"0":27}
ownerPrompts      {"1":21,"2":2,"3":1,"0":3} briefHash null on the same 3
e2eTouched        {"true":17,"false":10}
```

**Correction to `perception-layer.md` §5.** It says the rows with no `review` key are "rows 1–3".
It is **rows 1–4** — `discrepancy-audit` (row 4, landed 08:41) also carries no `review` key:

```
rows WITHOUT review key: 1:fleet/review-agent, 2:fleet/outcome-recorder-fix,
                         3:perception-write, 4:discrepancy-audit
```

**Drift note for `CLAUDE.md`** (a lane cannot fix that file — it is gitignored and copied at spawn):
the deploy section says of K2 *"Stand 2026-07-25: 0 gültige, 4 × `raw:true`"*. As of 27 rows it is
**6 valid (`pass`) and 7 × `raw:true`**. The snapshot aged out within the day.

---

## 2. Anomaly (a) — two landed rows with a footprint of nothing

**The hypothesis is confirmed, and the data carries its fingerprint.** Rows 1 and 2 are the only two
rows whose `base` is a **branch name**; rows 3–27 all carry a 40-hex sha.

```
 1 07-24T19:54 fleet/review-agent          landed  NAME:main  c=0 f=0
 2 07-24T21:50 fleet/outcome-recorder-fix  landed  NAME:main  c=0 f=0
 3 07-25T07:29 perception-write            landed  sha        c=1 f=6
```

The chain, each link read:

1. `server.ts:2827` — `const base = facts.baseSha ?? s.worktree.baseSha ?? await laneBaseRef(s)`.
   The last fallback is the integration-branch **name** (`laneBaseRef`, `server.ts:555`).
2. `server.ts:2836-2841` — the whole footprint (`shortstat`, `commitCount`, `filesTouched`) is
   `base...HEAD` / `base..HEAD`.
3. `server.ts:3338-3351` (clean auto-land) — `advanceIntegration` moves main **first**, then
   `landLane` → `buildLaneOutcome`. So by record time main already contains the lane.
4. Therefore `merge-base(main, HEAD) === HEAD` and every field computes to zero.

Reproduced rather than argued (synthetic repo, scratchpad):

```
=== with fork SHA (what rows 3+ do) ===
shortstat: [ 1 file changed, 1 insertion(+)]   commits: 1   files: [b.txt]
=== after main ff-advanced past the lane, with base NAME 'main' (rows 1-2) ===
merge-base main HEAD == HEAD ? YES
shortstat: []                                  commits: 0   files: []
```

**Why those two rows had no `baseSha`:** the field and `laneForkSha` were introduced by the *same
commit*, `fdfae3a` "fix(outcomes): record the real shape of a clean auto-land" (2026-07-24 23:49),
which is the land recorded by **row 2 itself**. Rows 1–2 were written by a server that had no fork
sha to hand over. This is a closed, non-recurring defect for lanes created after that deploy.

**Ruled out, not assumed:** the competing explanation in `perception-layer.md` §6 — "an owner ⏏ land
of already-integrated work is legitimately empty" — is **excluded for these two rows**. That path
lands with `OWNER_LAND_FACTS` (`server.ts:5282`), which sets `confirmedByHuman: true`
(`server.ts:2756`). Both rows carry `false`. They came off the clean auto-land site, not the ⏏ site.

**The residual defect is real, though, and untested.** `e2e/restart.ts:156-168` is the only coverage
of the no-`baseSha` fallback — and it asserts the case that *works*:

```
check("legacy lane with NO baseSha still records off the base name (unchanged fallback)",
  recL?.disposition === "killed-dirty" && recL?.commitCount === 1 …
```

It **kills** the lane. On a kill main has not advanced, so the name still resolves correctly. The
land case — the one that silently records nothing — has no test. A lane attached to a pre-existing
worktree whose `baseSha` is unresolvable (`laneForkSha` returns `undefined`, `server.ts:571-575`)
would reproduce rows 1–2 today, and no suite would notice.

## 3. Anomaly (b) — `verified:false` + `confirmedByHuman:true`

Row 4, `discrepancy-audit`, 11 commits / 13 files. **This is the confirm-land path working as
designed**, not a bug: `server.ts:5263-5268` lands with `confirmedByHuman: true` and
`verified: verifyProv ? verifyProv.ok : null`. The owner read a red gate and landed anyway — the
latitude the code states explicitly at `server.ts:5249` ("Owner latitude stands — stale never
blocks"). One of 27. Rows 10 and 26 are the other two confirm-lands, both `verified:true`.

Two things the row cannot tell you, both verified in code:

- **`verified:false` conflates three different failures.** `runVerify` (`server.ts:2550`) returns
  `ok: skipped ? null : !timedOut && code === 0`. A red suite (exit 1), a timeout, and a gate that
  *could not run at all* (exit 127) all land on the ledger as the same `false`. The distinguishing
  tail lives in `verify.out` on the in-memory `mergeLast`, which dies with the process.
- **The staleness marker is dropped on the way to the ledger.** `server.ts:5251` stamps
  `{...rv, stale:true}` when main moved past the verified `mainSha`; `server.ts:5267` takes only
  `.ok`. So a confirm-land's `verified:true` may attest a verdict computed against a *different*
  main than the one that landed, and the row is silent about it. Rows 10 and 26 are the exposure;
  which of them (if either) was stale is **not recoverable from the ledger**.

## 4. Anomaly (c) — the two `killed-dirty` rows are instrument calibration, not abandoned work

Row 12 `label-clamp` and row 15 `outcome-summary`. Both are the **seeded-defect fire drills**
recorded in `graduation-criteria.md` (drill #1 and drill #2). The discarded commits both exist and
match:

```
cffe8e4 → 2026-07-25 13:28:32 feat(client): clamp long slot labels in list views
4be8238 → 2026-07-25 14:14:25 feat: outcomes summary endpoint
```

**Consequence:** across 27 rows, **zero** record a real lane abandoned as unsalvageable. A consumer
computing an abandonment or failure rate from `disposition` gets 2/27 = 7.4 %, and 100 % of that
number is the measuring apparatus measuring itself. The ledger has **no field** distinguishing a
drill lane from production work — the drill is recorded in a doc, by hand. Anything that ever
segments on `disposition` needs that field first.

---

## 5. Field-by-field trust

| field | trust | evidence / code cause |
|---|---|---|
| `ts`, `branch`, `headSha`, `disposition` | **good** | direct git/slot facts, `server.ts:2850-2855` |
| `base` | **good since `fdfae3a`** | name-fallback zeroes a landed footprint (§2) |
| `shortstat`/`commitCount`/`filesTouched`/`e2eTouched` | **good, 2 known-bad rows** | rows 1–2 only (§2) |
| `verified` | **partial** | 3-way collapse + `stale` dropped (§3). Pre-`verify-tristate` (row 20) rows cannot separate "passed" from "declined to run" — `graduation-criteria.md` already records this |
| `confirmedByHuman` | **good, misread easily** | procedural fact ("a second human step"), not approval. `server.ts:2874` |
| `review.state` | **partial** | see F1 — `covered` counts unparsed answers |
| `cleanReviewShadow` | **broken more often than not** | 7 of 13 are `verdict:null, raw:true` (F2) |
| `model` | **dead** | `null` on 25/27. `server.ts:2856` `s.model ?? null`, and `s.model` is null for any lane without an explicit pin (`server.ts:147`). Honest by design, useless for attribution |
| `briefHash`, `ownerPrompts` | **broken for the newest lanes** | F4 |
| `repairRounds` | **unexercised** | `0` on all 27; the repair loop has never run or never been recorded |
| `sessionMs` | **good for Fleet-created lanes** | `openSlot` (`server.ts:1149-1152`) resets `sessionId` + `startCache`, so the anchor is the lane's own session |
| `resolvedConflict` | **good** | `true` on rows 10, 26 — both confirm-lands, consistent with `server.ts:5264` |

---

## 6. Ranked findings

**F1 — §1 reads MET today, and its coverage clause is one row wide.** *(quantifies an issue
`graduation-criteria.md`'s adversarial pass item 3 already named; what is new is that the number now
crosses its bar)*

The real `kProgress`, executed against the real ledger:

```
kProgress over the REAL ledger: {"anchored":true,"k1":20,"clean":18,"unknown":0,"undos":0,"k2":6}
after-anchor LANDS: 20   covered: 16 → 80.0%   (criterion: >=80% of THOSE 20)
  of the covered lands: raw:true (answer did not parse) = 1   (disposition-rail)
  of the covered lands: NO scope/notes/raw keys (pre-600d401) = 3
  covered AND provably a parsed review: 12 → 60.0%
```

Drop the single row whose reviewer answer never parsed → **15/20 = 75 %, below the bar.** Require a
review that provably parsed → **60 %**. And of §1's other clauses: "0 undos" cannot currently produce
a non-zero value (`disposition:"reverted"` has never been written), and "0 wrong-class dispositions"
is **not computed at all** — `kProgress` never reads `dispositions.jsonl`, which holds exactly 1 row
(`enhance/ignored`) and **zero** land-class labels. **Cost:** the owner can look at a green K1 chip
and enable Component 5 auto-land on a criterion where two clauses are inert and the third passes by
counting a non-review as a review.

**F2 — the ② shadow instrument fails its own output contract on 54 % of runs, and has never been
fire-drilled.** 13 rows carry a `cleanReviewShadow`; **7** are `verdict:null, raw:true` and are
correctly not counted, **6** are `pass`, **0** are `would_stop`. K2 stands at 6/25. §2 additionally
requires *≥1 would-have-stopped verdict the owner labels a real catch* — at 0/6 that clause has no
path to satisfaction yet, and per the fire-drill norm in `graduation-criteria.md` ② has had **no**
seeded-defect test (drills #1 and #2 were both ③). **Cost:** K2 will reach 25 by accumulating passes
from an instrument of unknown sensitivity whose parser fails more often than it succeeds; the N would
be met and the evidence would be worth nothing. Both judges run `claude-sonnet-5[1m]` — verified from
`review.model` and `cleanReviewShadow.model` on the rows.

**F3 — the ledger records events, never outcomes.** Every field is a fact about what the *machinery*
did (did a gate run, did a human click, how many files). **No row carries a judgement about whether
the work was any good.** The rail designed to carry that (`dispositions.jsonl`) has 1 row and 0
land-class rows. `confirmedByHuman` is the only human-touched field and it is procedural.
**Cost:** this is the hard ceiling on every consumer. No amount of accumulation makes this ledger
answer "was that land good" — it can only ever answer "did the pipeline run". Every graduation
criterion is currently a count of pipeline activity.

**F4 — `briefHash` and `ownerPrompts` are silently zero for terminal-briefed lanes — including the
three most recent.** `laneOwnerPrompts` (`server.ts:2775`) counts only `p.source === "owner"`, but
`logPrompt` (`server.ts:340`) writes five source tags. Counted in the journal for the affected lanes
(counts only, no text):

```
260725170807-e5dd  source=terminal → 1
260725170811-8c47  source=terminal → 1
260725170905-ac4b  source=terminal → 1
kprogress-honesty  source=owner    → 1
```

Rows 24–26 are exactly the three rows with `ownerPrompts:0` and `briefHash:null`. A brief typed into
the pane is recorded as *no brief at all*. **Cost:** `briefHash` is the ledger's only join key
between an outcome and the brief that produced it — the one field a "which briefs produce good
lanes" consumer would need — and it is dead precisely on the newest rows, i.e. the trend is
worsening, not aging out. `ownerPrompts` is the ledger's only proxy for how much steering a lane
needed, which is the autonomy signal itself.

**F5 — `src/client.ts` is invisible to `grep` in this environment, and that is where the ledger's
only decision-relevant consumer lives.** The file contains a committed NUL byte at offset 141046 —
deliberate, a composite map-key separator written as a literal rather than an escape:

```
const dispoKey = (worker: string, ref: string) => `${worker}«NUL»${ref}`;
```

`grep` here is `ugrep 7.5.0`, which classifies the file as binary and returns **zero matches with no
warning**:

```
$ grep -c  const src/client.ts   → (nothing)  exit=1
$ grep -ac const src/client.ts   → 642        exit=0
```

It is the only NUL-containing tracked source file in the repo (checked all `.ts/.js/.sh/.md/.json`
outside `node_modules`/`.git`/`public`). **Cost:** silent false negatives in exactly the file this
project's rulebook tells you to grep ("line refs drift — grep the symbol"). This audit's own brief
carried the premise *"kein Konsument, der ENTSCHEIDET, und keine Client-Ansicht"*; the feed has
existed since `9c1ffbe` and the criteria counter since `fc32fc9`. `perception-layer.md:27` cites
`grep lane-outcomes src/` → nothing as evidence — that grep was true when written and is false now,
and it would still print nothing. **Workaround: `grep -a`, or `bun`/Read.** No code change proposed;
the NUL is intentional and changing it is a client edit outside this lane's remit.

**F6 — smaller, costed:** `verified:false` conflates red / timeout / could-not-run (§3);
confirm-land drops the `stale` marker (§3); `model` is null on 25/27 so no outcome can be attributed
to a lane model (`server.ts:2856` — honest, but it means per-model comparison is unavailable
forever-until-changed); `repairRounds` is constant 0; the land-case of the `base` name-fallback is
untested (§2); the prompt journal contains a `source: "backfill"` tag (1573 rows) that is not in
`logPrompt`'s union at `server.ts:340`, so some writer bypasses that function.

---

## 7. The smallest honest first consumer

**The premise "no consumer decides" does not survive contact with the code.** The first consumer
exists, is on screen, and its number gates an autonomy decision:

- `src/client.ts:3009` — `const k = kProgress(outcomeData);`
- `src/client.ts:3019-3038` — the K1/K2 chips, whose own tooltip says: *"Counting only — the
  graduation decision is the owner's, made by reading this number."*
- Full reader list, verified: the owner route (`server.ts:4833`), `src/client.ts`
  (`renderOutcomes` + `kProgress`), and four e2e modules (`e2e/outcomes.ts`, `e2e/restart.ts`,
  `e2e/review.ts`, `fleet-e2e-clean-review.ts`). Nothing on the server reads the ledger to make a
  decision — `LANE_OUTCOME_FILE` appears at `server.ts:32, 2912, 4833` only, and `promotionEligible`
  is fed from state, not from this file (`server.ts:2917-2920`).

So the question is not *what to build first* but **what the existing consumer must stop
miscounting.** The smallest honest first consumer is a ~3-line correction inside `kProgress` and the
coverage tally, not a new feature:

> **Split `covered` into `covered (parsed)` and `covered (unmeasurable)`** — a row counts as parsed
> coverage only when `review.state === "covered" && review.raw !== true && "scope" in review` — and
> read §1's coverage clause off the former.

That is the smallest change that flips a real decision, today, on the exact population §1
pre-registered: **80.0 % → 75 % (excluding the known non-review) or 60 % (requiring provable
parsing), against an 80 % bar.** §1 goes from *met* to *not met*.

**This is a measurement correction, not a threshold change** — no number in `graduation-criteria.md`
moves. But it changes a criterion's *verdict* on data already accrued, so the pre-registration rule
applies: it should be written down as such before it is acted on, and §1's remaining two inert
clauses (undos, wrong-class) named at the same time.

**What 27 rows honestly bear.** Twenty of them form §1's population; the rest predate its anchor or
are drill lanes. Every cross-cut is single-digit: 3 confirm-lands, 2 conflict resolutions, 1 red
verify, 2 model-pinned rows, 0 undos, 0 reverts, 0 `would_stop`. **The ledger supports counting
against pre-registered thresholds and nothing else.** No correlation is computable — not
brief↔outcome (F4 killed the key), not model↔outcome (F3/`model` null), not review↔quality (F3: no
quality label exists). `graduation-criteria.md` already states the ceiling — *"real power needs
~100+ samples per arm, which this ledger will not have for months"* — and this audit's numbers agree
with it rather than arguing past it. Correctly, the answer to "what else should we compute" is: **not
yet, and not from this file until F3 has an answer.**

---

## 8. What I did NOT check

- **The rendering.** I executed `kProgress` as a pure function; I did not run the client, open the
  🧾 panel, or verify that `reviewRel`/`REL_WORD`/the "not covered by ③" filter render the tally I
  computed. `e2e/outcomes.ts` asserts the counter, not the DOM, and says so.
- **The `/attach` lane path end-to-end** (`server.ts:5037`). I verified `openSlot` resets the session
  anchor; I did not trace attach → outcome to confirm `sessionMs` and `baseSha` behave there.
- **Whether rows 10 or 26 carried a stale verify verdict.** Not recoverable from the ledger (§3);
  I did not try to reconstruct it from git.
- **`e2e/outcomes.ts` was read only around the `kProgress` extraction** (lines ~300–400) and its
  route assertions; I did not read the whole module, nor `e2e/review.ts`.
- **I ran no e2e suite.** This lane changes no code, only adds this file — the suites verify
  behaviour this audit does not touch.
- **Row-level review bodies and prompt text** were deliberately not read or quoted (mode-0600
  journal, `server.ts:345`); all prompt-journal evidence here is counts by `source` tag.
- **`docs/README.md` untouched** by instruction — this doc is not catalogued there yet.

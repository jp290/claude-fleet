# Judge calibration — fire-drills, instrument checks, and what each judge is actually worth

Canonical home for HOW Fleet's judging instances earn trust and what their measured state is.
The NUMBERS each autonomy step needs live in `graduation-criteria.md` (its amendment log holds
the dated drill entries verbatim — this doc carries the living state and the method).
Norm (2026-07-25): **no judging instance gets even display-trust before a seeded-defect test.**

## The fire-drill procedure

1. **Seal ground truth first.** Defects, their exact mechanics, and the pass/fail bar are
   written down BEFORE the judge runs (scratchpad or this doc — anywhere the judge cannot read;
   see rule 3). Adjudicating against memory invites motivated reading.
2. **Neutral everything.** Branch name, commit message, code comments carry no hint. The lane
   agent that plants the defects is told plainly it is sanctioned calibration (no deception of
   the worker — only the judge is blind).
3. **Confirm the judge's blindness.** Check the judge's evidence channel cannot reach the
   ground truth (③: its prompt denies tool access, so the sealed file and the lane transcript
   are unreachable — verified 2026-07-25).
4. **Evidence-horizon rule (from drill #1's re-adjudication):** every seeded defect must lie
   INSIDE the judge's specified evidence. ③ is diff-text-only by prompt ("Do NOT use any
   tools… answer directly from the input", server.ts, grep `read-only code reviewer`) — a
   defect needing surrounding code tests the spec, not the judge. **Read the judge's spec
   BEFORE designing the drill, and again before adjudicating.**
5. **Teardown.** The lane never lands: kill, discard worktree + branch
   (`/api/worktrees/discard` with `{repo, path, branch}`). The ledger keeps an honest
   `killed-dirty` row (= killed with unlanded commits, server.ts:2784) — excluded from every
   criterion by disposition.
6. **One drill is N=1.** No prompt/model tuning off a single seeded pair — it overfits.
   Accumulate drills across defect classes first.

## Calibration state per judge (update on every drill/finding)

### auto-③ (the review-on-row reviewer)
- Spec: diff-text-only, ≤5 ranked findings with file/line/cost, `verified` only if the diff
  itself shows it, empty findings explicitly valid. It is an assessment prompt, fair to test
  as a bug-finder — but only with in-diff defects.
- **Drill #1 (2026-07-25, `label-clamp`, sonnet-5[1m]): location-sensitivity 2/2; the one
  spec-valid semantic item MISSED** — an inverted guard read as a cosmetic off-by-one and
  stamped `verified`. The other item was invalid (needed forbidden context; ③ spec-conformly
  marked it `inferred` and named the limit).
- **Drill #2 (2026-07-25, `outcome-summary`, sonnet-5[1m]): location 2/2, semantic 2/2,
  0 false positives.** Both spec-fair in-diff defects fully named: the inverted window
  filter (D1, the class drill #1 missed — this time with the contradicting intent-comment
  in the same hunk) incl. the correct fix (`>= cutoff`), and the wrong-counter response
  wiring (D2, new class). Both graded `verified`, correctly. A third out-of-diff auth
  question was spec-conformly marked `inferred` with its limit named. Ground truth sealed
  pre-run (session scratchpad); ledger row 15 `killed-dirty`, branch discarded at `4be8238`.
- Operational reading after drills #1–#2: **`review: covered` attests a review RAN — not
  that the code is sound.** ③ can deliver full semantic depth (drill #2) and can miss it
  while stamping `verified` (drill #1) — the difference may be how much intent evidence the
  diff itself carries (drill #2's D1 had the contradicting comment in-hunk). N=2; the
  reading softens only with more drills, and the `verified` tag stays the model's claim.

### ② clean-review (shadow since 2026-07-25)
- Spec: ONE narrow question — do the lane's changes and main's new commits collide
  semantically despite a clean rebase + green gate; `ok`/`review` strict-JSON; explicitly
  false-flag-averse. Gate mode is downgrade-only + fail-closed (proven by e2e-clean-review.sh).
- **Corrected diagnosis (2026-07-25): it was the PARSER, not the model.** The earlier reading
  here ("the real model misses the JSON contract", from 2/2 then 6/7 `raw: true` rows) was wrong.
  Once `rawAnswer` was persisted, all three diagnosable raw rows showed the same shape: a valid
  `{"verdict": "ok", …}` object behind a one-sentence prose preamble, thrown away by a
  `JSON.parse`-or-give-up parser. `runCleanReview` now falls back to `extractJsonObject` (the
  rescue `runEnhance` already had), so a prose-wrapped verdict is a real measurement.
  Extraction only rescues a WELL-FORMED answer: no object, or a verdict value outside
  `ok`/`review`, still yields `raw: true` and the gate still fails closed
  (e2e-clean-review.sh covers both directions, in gate AND shadow phase).
- Method note: the `raw: true` count was a real signal but a misattributed one — the fix that
  made it diagnosable (persisting the answer) is what overturned the diagnosis drawn from it.
  Counting failures told us nothing until one failing artifact was kept.
- Standing production state, recomputed 2026-07-26 from `lane-outcomes.jsonl` (23 shadow rows),
  split at the parser fix `7e385e4` — confirmed live, it is an ancestor of the running server's
  bootHead:
  | | rows | valid `pass` | contract miss | empty answer | `would_stop` |
  |---|---|---|---|---|---|
  | before 17:26 | 9 | 2 | 4 | 3 | 0 |
  | after | 14 | 13 | **0** | 1 | 0 |
  **The parser fix held**: zero contract misses in 14 subsequent rows. That every post-fix row
  ran on post-fix code is *inferred* (commit time + the clean break in failure mode) — the
  earlier srv instance's bootHead is not recoverable. Any reading built on the older
  "8 of 14 runs miss the contract" is regime-mixed: it counts the first 14 rows, which are
  almost all pre-fix.
- **The one open failure mode is the empty answer** (1/14 post-fix): the reviewer runs and says
  nothing, presumably a timeout under load. Gate mode fails closed onto a human; today, with the
  gate off, it costs a measurement.
- **② has never once returned `would_stop` — 0 of 23, across both regimes.** Reliability and
  discrimination are different properties, and only the first is measured. A judge stuck at
  `pass` and a judge correctly seeing nothing wrong write byte-identical ledgers.
- **Never drilled.** Everything above is a parser/reliability diagnosis, not a seeded-defect
  test. Fire-drill #3 is designed and its ground truth sealed (2026-07-26); it runs after SEC-4
  lands, so the configuration measured is the one that will actually run. Note ②'s evidence
  horizon is far wider than ③'s: it is told to use tools and to "READ the actual code to
  confirm" (`merge-prompt.ts:169-175`), so a spec-fair seeded defect may live anywhere in the
  rebased worktree — but it must NOT be one tsc or the gate would catch, since the prompt
  explicitly forbids flagging those.
- K2 counts only `verdict !== null` — raw failures are honest non-measurements.

### Merge-resolver (the ⏫ conflict agent)
- Not yet drilled. Its output IS reviewed per-case by a human today (stop-and-review), which
  is a stronger check than any drill — the drill norm applies before component 5 would remove
  that human.

## Instrument-check rules (method, earned today)

1. **Read the spec before judging the judge.** Drill #1's first adjudication skipped this and
   published an overstated failure; the re-adjudication halved it.
2. **An instrument error double-confirmed is still an instrument error.** A "reproduction"
   that shares the measurement path with the original reading confirms nothing (the deployGap
   nested-key incident: wrong read → scratch test with the same wrong read → phantom bug).
3. **Unknown ≠ zero, everywhere** — in facts (`null`), in counters (no header without data),
   in verdicts (`raw: true` beats a fabricated pass). F5's lesson, generalized.

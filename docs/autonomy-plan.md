# The axioms, and the mid-term plan to autonomy

Written 2026-07-25 at the owner's request, after the adversarial pass. This is the **operative
synthesis**: what we believe, where we actually are, and what has to be true before each next
step. It supersedes nothing — it points. Evidence for every "where we are" claim is in
`adversarial-2026-07-25.md`.

## Part 1 — The axioms

Most are the project's own, earned. Three (A5, A7, A10) carry corrections earned today.

1. **Deterministic > semi-deterministic > statistical.** Git and the gate are authority; an
   agent's word never is. Believe git, not the agent.
2. **Record → display → advise → gate → act.** Every judging instance climbs by measured hits,
   never by being built. ② is at *record*. ③ is at *display*. Nothing is at *act*.
3. **No judging or measuring layer without its feeder in the same move.** Unfed mechanisms are
   this project's recurring defect (`enhance` starved, `outcomeTally` empty, `harmAttestAt` 0).
4. **Unknown ≠ zero.** A missing value must never read as a healthy one — not in facts (`null`),
   not in counters, not in verdicts (`raw:true` beats a fabricated pass).
5. **Risk concentrates at the land gate; upstream may loosen** — *but only as far as the gate is
   actually real.* Corrected today: the gate is `tsc` + 26 claudeAlive checks, and it can skip
   itself and still record green. The axiom is sound; its premise is currently weaker than every
   decision built on it assumed.
6. **Reversibility carries the weight the gate cannot.** A fast-but-partial gate makes undo-land
   *more* load-bearing, not less. Its mechanism is well tested (10 checks); its human half has
   never run.
7. **Owner attention is the scarcest resource, and every consumer of it must name its cost** —
   *and be instrumented.* Corrected today: this axiom was written and never measured. Deliberate
   owner judgements recorded to date: zero.
8. **Facts, never diagnoses** (THE GUARD). A blind advisor states facts and asks exactly one
   question. A wrong diagnosis gets conformed to precisely because the receiver is sighted and
   trusts the sender.
9. **Pre-registration.** Criteria are fixed before the data; an amendment needs a written
   rationale committed *before* looking at data accrued since the last change. Meeting a
   criterion *permits*, never *obliges*.
10. **Independence must be structural, not nominal.** Corrected today: Resolver ≠ Reviewer ≠
    Lander is role separation; one `SUMMARY_MODEL` runs ②, ③, the resolver, the enhancer and the
    digest, and the drills are authored by the same model family they test. Correlated judges are
    not independent evidence.
11. **Everything lands through the gate.** A hand-land is a lost calibration row.
12. **Every prior artifact is a claim to verify** — handoffs, docs, memory, and one's own earlier
    conclusions most of all.

## Part 2 — Where we actually are

- **Producing well:** 19 ledger rows, K1 12/20 with 11 clean auto-lands, 0 undos, three
  structural e2e flakes closed, deploy loop tight and self-reporting (`deployGap`,
  `bundleStale`).
- **Measuring poorly:** `verified: true` attests tier 1 only; `kProgress` counts a row missing
  `confirmedByHuman` as a clean auto-land; K2 has 1 valid verdict of 6 attempts.
- **Not consuming at all:** one disposition record in the rail's lifetime, and it was written
  automatically. Three of four criteria terminate in a label that has never been produced.

The honest summary: **the machine is ahead of the measurement, and the measurement is ahead of
the adjudication.** Building more upstream capability now widens the gap it should be closing.

## Part 3 — The plan, in stages with entry conditions

Each stage is entered only when the previous one's exit conditions hold. No stage is a promise;
each is a gate.

### Stage 0 — Make the instruments honest (now)
1. `verify-tristate` lands: a skipped verify can never read as a pass. *(in flight)*
2. ② JSON extraction — reuse the existing `extractJsonObject` (`server.ts:2411`), which
   `runEnhance` already uses on exactly this failure mode. Cheap; unblocks K2 measurement.
3. `kProgress` fail-green fix (`src/client.ts:2935`).
4. **≥10 deliberate owner dispositions**, which also constitutes the first production test of the
   land-class write path.
**Exit:** every counter means what its name says, and the rail has run in production.

### Stage 1 — Make the gate real
5. The post-land audit tier that was designed and never built: run the full suite after a land,
   red → owner-visible alarm + `undo-land` as the rollback (`gate-coverage.md` §5). The flake
   that blocked it is fixed as of today.
6. Doc-claims check wired into `e2e-claude-gate.sh` — docs may name constants/routes/env only by
   symbol. The executable answer to a rot class prose has failed to stop four times.
**Exit:** a semantic regression that passes tier 1 is caught by machine within one land, and
reversibility has been exercised deliberately at least once.

### Stage 2 — Earn display→advise trust for the judges
7. ②: the pre-registered §2 numbers (N≥25 valid, would-stop ≤20 %, ≥1 owner-confirmed catch).
8. ③: further fire-drills across defect classes, **with at least one drill whose defects are not
   authored by a Claude** (A10), recording each judge's model beside its result.
9. Owner-perception fact layer: unlabeled rows, oldest pending proposal, proposals pointing at
   dead lanes, deliberate labels per week — so A7 is instrumented rather than asserted.
**Exit:** each judge has a measured sensitivity, not just a measured presence.

### Stage 3 — The first real autonomy step
10. Component 5: graded auto-land of conflict resolutions — opt-in, reconcilable-only,
    non-high-stakes zones. Requires stage 1 (else it lands work nobody verified) and the amended
    reading of K1 (§ criteria amendment 2026-07-25), and stays human-gated for the
    arbitrated/mutually-exclusive class regardless.
**Exit:** N clean instances with zero wrong-class labels — and the owner's decision, which the
numbers permit but never compel (A9).

### Stage 4 — Upstream autonomy (cheap, because the gate stops it)
11. Steward pulse phase A → B (handoff-recycle, own criteria entry written *before* the first
    autonomous kill), dispatcher briefing (P-9), steward-picked mission lanes.
Upstream loosening is safe *in proportion to* stage 1 being done. Doing stage 4 before stage 1
inverts the axiom that makes it cheap.

## Part 4 — Tripwires (what makes us stop and re-plan)

- Any owner undo, or any `wrong`-class disposition, resets the K1 streak — by design.
- A judge's would-stop rate above 20 %: it has become a second human gate, not a safety net.
- Steward proposals reaching the pending cap, or any duplicate filing (`rundgang.md` amendment).
- A land recorded `verified: true` whose gate provably did not run — the stage-0 item exists to
  make this impossible; if it recurs, stop landing unattended.
- The queue of unlabeled rows growing for another week: that is A7 failing, and it invalidates
  the evidentiary basis of every criterion.

## Part 5 — The ✨ button, and what it is for

Tested live 2026-07-25 with a rough owner-style draft. It returned the draft with typos and
capitalisation fixed, a full stop added, and `/sharpen3` appended — nothing else. That is
**exactly what it is currently specified to do**: `enhance-prompt.ts` forbids inventing any
diagnosis or work directive (A8), and the three surface-keyed directives were deliberately
deleted in `def5cbf` because a blind corrective table is the error THE GUARD names.

So the gap is not a defect in the code — it is a mismatch between a deliberately minimal design
and the expectation of a prompt *compiler*. For an owner who already types `/sharpen3`, today's
✨ adds only spell-checking. Two coherent futures, and they should not be blended:

- **(a) Honest polisher.** Keep it blind and minimal, and let its label say so. Cheap, safe,
  low value.
- **(b) Sighted compiler.** The real compiling power lives where the session context is —
  `/sharpen3` runs *inside* the target session and picks discipline by expected failure. The
  coherent upgrade is to make ✨ the *in-place, sighted* compile-and-show-me step, rather than a
  blind throwaway worker guessing from git facts. This is the direction `compiler-program.md`
  implies, and it dissolves the mismatch instead of papering over it.

**Do not tune the blind prompt in the meantime** — that is tuning on N≈1 (drill lesson). And note
the one genuinely good property ✨ has: its disposition labels (`accepted`/`edited`/`ignored`) are
written **automatically** by the compose box, so it is the only measurement loop in the system
that costs the owner no attention at all. Whichever future is chosen, using ✨ generates its own
evidence for free — which is why (b) should be decided *with* that data, not before it.

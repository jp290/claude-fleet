# Learning engine — the navigation after the two dream passes (2026-07-23)

*A proposal/decision record (owner promotes into the roadmap). Captures the map-level
conclusion of the two dream passes so the reasoning is durable, not stranded in a session.
Pairs with `learning-engine-v1-2026-07.md` (stage 1) + `dream-mode-corpus-2026-07.md`
(stage 2). Sits below `steward-intelligence.md` §8 and `three-axes.md`; changes no gate.*

## What the two passes add up to

1. **The engine corrected its own aim.** Stage 1 diagnosed the six overhead prompts from
   first principles (the axioms); stage 2 laid the fact layer (traces) over it and most of
   stage-1's 16 rewrites collapsed (1 clean confirm / 4 refuted / 11 confirmed-but-already-
   mitigated). That is `/sharpen` applied to the program itself — the recursive igniter
   (§3) firing once, on real stakes: we gave the intent "make the prompts axiom-perfect,"
   evidence supplied the complement "but the prompts aren't where it hurts."

2. **Governor #2 became load-bearing: verification coverage is the program's throttle.**
   (`three-axes.md` §5 #2 — "the flywheel is trustworthy exactly as far as the fact layer
   reaches.") The moment we extended verification, the unverified layer showed as noise. We
   have no shortage of proposals; we have a shortage of ground truth to promote them.
   **The binding constraint is the Ground axis, not idea generation.**

3. **Leverage and verifiability coincide in the infra layer.** Prompt edits are low-leverage
   AND hard-to-verify (need judgment/hold-out). The infra/behavior patterns (P1–P3) are
   high-leverage AND deterministically checkable (does the failure-mode still recur?). We were
   on the wrong hill on both axes.

## The honest headline

**At prompt scale with strong executors (0 Haiku lanes in the corpus), the prompts are not
the bottleneck — infrastructure and doc-maintenance patterns are.** (Caveat: this excludes
`/sharpen` itself, deliberately not trace-mined; the premise-multiplier is untested.)

## The sequence (ranked by leverage on the program, not by satisfaction)

1. **P3 — async digest** *(chosen first; brief `briefs/p3-async-digest.md`).* Cheap, verified,
   deterministic. Removes the one blocker between the digest and its destiny as the first
   *scheduled* library item (§7). Proves the infra-redirect by delivering value two prompt
   passes did not. Design resolved: demand-triggered bounded-wait (see the brief).
2. **The keystone — a deterministic infra-recurrence counter.** Both passes cried for an "eval
   set"; post-stage-2 a *prompt* hold-out is the wrong target. The right one is deterministic —
   **count** whether a known failure still occurs — but HOW to count is exactly where the
   2026-07-23 skeleton found the trap (see 2b). **Honest correction to the earlier framing:** this is NOT the existing
   effect-sensor. `measureOutcomes`/`outcomeTally` (both in server.ts; grep the symbols) classifies a steward
   *intervention's* outcome via git/output deltas — the wrong shape for signature-recurrence.
   The keystone is a *distinct, minimal* deterministic scan over the corpus (transcripts/docs/
   e2e output), a script not a framework. And it decomposes:
   - **2a — fix the concrete infra issues first.** **P1 socket collision DONE 2026-07-23**
     (per-invocation `$$`-derived SOCK/PORT/DIR → concurrent runs never share a socket;
     deterministically collision-free; landed 2a-only). **P2 doc-refs + share-flake DONE
     2026-07-23** (living docs on symbol/grep anchors; vacuous-pass guard on the uppercase
     check). P3 done. Each a lane + regression. This IS the leverage — concrete, deterministic, extends the
     fact layer.
   - **2b — recurrence counting: the transcript-grep approach is a PROVEN DEAD-END (empirical,
     2026-07-23).** The P1 skeleton grepped lane transcripts for the collision signature; its
     count *rose* 34→41 during one review with **zero** actual collisions — it measures how much
     we *document* a problem (this doc, the review, quoted CLAUDE.md), not whether it *recurs*,
     and by self-reference can never reach zero. Two corrections: (i) a counter for a
     **deterministically-fixed** issue (P1) is pointless — it can't recur; a trivial
     script-content assertion guards regression. (ii) The sensor's real domain is the
     **non-deterministic flake class** (share-flake, pane-capture race), which *can* silently
     recur — counted by **deterministic RUNTIME markers** (the harness emits `INFRA-FLAKE` only
     when the failure fires at run time), never corpus mentions. **Count runtime outcomes, not
     transcript mentions.**
   - **2c — wire recurrence into the learning loop** as the deterministic outcome-signal for
     *infra-fix* proposals (the true "unblocks promotion"). DEFER until 2a+2b exist and prove
     useful — this is where speculative-abstraction creep lives (OWNER: three lines > premature
     abstraction). Top-of-verification-hierarchy throughout.
3. **The compounding wire — retrieval read-half, now concretely targeted.** Inject the
   *verified* infra failure-mode into the brief of any lane about to touch that surface (a lane
   running e2e → P1's status; a lane touching the digest → P3). Agency × Memory × Ground
   converge. Only after (1)+(2) exist — you cannot inject a lesson you haven't verified.

## Parked with a trigger (not a date)

- The 11 prompt "insurance" edits → revisit **the day the first cheap-model (Haiku-class) lane
  runs**; until then they are net-negative prompt mass (fixing failures no executor produces).
- The `/sharpen` A4/A5 rewrite → a separate pass grounding it against sharpen *outputs* / a
  hold-out set (not a re-mine of the sharpen-corpus).
- P2 (symbol/grep doc anchors) → opportunistic; maintenance debt, not a bug.
- The `toUpperCase()` share-flake (fleet-e2e.ts, grep `toUpperCase`) → **trivial** one-line fixture guard
  (a random id with no lowercase makes `toUpperCase()` a no-op → the "uppercased" id equals a
  valid id → the 404 assertion fails). Kept only as a **3rd specimen of the
  non-deterministic-test-flake class** (with P1's socket collision + the pane-capture race) —
  the generalization material for the recurrence-counter below, not a problem in itself.
- `catchup` #15 (ordering) → a zero-risk owner one-liner on a barely-used prompt.

## Doctrine feedback (propose)

- **Dream mode's target shifts** from prompt-text to the infra/behavior layer; and it is a
  *periodic* reflection, not a loop — the prompt-yield is now exhausted, so fire it again only
  at the infra layer, once, then let material accumulate (the incremental guard).
- **Record the throttle governor as operative:** every unit of fact-layer (Ground) extension
  raises the ceiling on every downstream learning pass. Sequence the program by it.

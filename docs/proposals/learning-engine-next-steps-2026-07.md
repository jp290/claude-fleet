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
2. **The keystone — point the effect-sensor at the infra failure-modes.** Both passes cried
   for an "eval set"; post-stage-2 a *prompt* hold-out is the wrong target. The right one is
   deterministic and half-exists: have the fact layer **count** the failure-modes (does the
   socket collision still recur across lanes? do doc-refs still rot? did the digest time out?).
   This turns "we proposed P1" into "P1's recurrence-count went to zero, verified" — the
   throttle-widening move that unblocks all future promotion. Phase-3 effect-sensor, aimed at
   infra not prompts, top-of-verification-hierarchy.
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
- `catchup` #15 (ordering) → a zero-risk owner one-liner on a barely-used prompt.

## Doctrine feedback (propose)

- **Dream mode's target shifts** from prompt-text to the infra/behavior layer; and it is a
  *periodic* reflection, not a loop — the prompt-yield is now exhausted, so fire it again only
  at the infra layer, once, then let material accumulate (the incremental guard).
- **Record the throttle governor as operative:** every unit of fact-layer (Ground) extension
  raises the ceiling on every downstream learning pass. Sequence the program by it.

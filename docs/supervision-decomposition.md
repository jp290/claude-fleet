# Can supervision be decomposed into context? — an open question, briefed for a fresh mind

**Status: open. Nothing here is settled, and it is deliberately not written as a plan.**
Posed by the owner 2026-07-26, after a session that reordered the autonomy ladder (`HANDOFF.md`
§9). This document exists so a *thinking* session can attack the question without first
reconstructing a day of context — and without re-deriving what is already measured.

## The question

Fleet's autonomy boundary is the merge trigger: a lane's work reaches `main` only when a human
clicks. The standing plan replaces that click with a machine-checked gate.

The owner asked a different question, and it is a better one than it first sounds:

> **Could we simulate the supervision instead — by giving the agent the situational and background
> knowledge it would need?**

Not "trust the agent more". *Give it what the human has, and see how much of the human's
contribution was knowledge all along.*

## Why this is not naive — it is the project's own thesis

Fleet already builds exactly this. The perception layer, the steward's Rundgang, `done-looking`,
the continuity fact, the pulse: each one externalises something a human would otherwise hold in
their head. The house doctrine is literally *perception before autonomy*.

So the question is not whether context helps. It is **how far it goes, and what it cannot reach.**

## What the question must survive

Three objections. The first two are arguments; the third is a measurement from 2026-07-26.

**1. Context raises judgment quality; it does not change the category.**
The verification hierarchy in use here is deterministic > semi-deterministic > statistical
(LLM-as-judge last). A better-informed agent is a better *statistical* instrument. A gate is not
"better judgment" — it is a check that **can fail** and whose failure is legible. This project
re-learned that three times in one day: a `tsc` premise check that could not fail was worse than no
check, because it got quoted as evidence (`HANDOFF.md` §2c).

**2. Exposure does not transfer.**
The human at the merge trigger holds inspection *and* accountability. If an unattended land breaks
`main` overnight and the rollback has already lapsed — realistic today, see below — the cost lands
on the owner. Knowledge is copyable; consequence is not. This is not mysticism: the asymmetry is
what makes the check mean anything.

**3. The measurement that bites: ② is not context-starved, and it still says nothing.**
The ② clean-reviewer already has tools and is explicitly told to *"READ the actual code to
confirm"* (`merge-prompt.ts`, `buildCleanReviewPrompt`). It has returned `would_stop` **zero**
times across every shadow row ever recorded, and fire-drill #3 produced **2 of 2 non-measurements**
— it never answered at all. No enrichment would have changed a single one of those rows.

A related datum, offered because it is uncomfortable rather than flattering: of four errors the
orchestrating session made that day, **three were reading errors with full access** — a field
queried without checking the record's real keys, a grep anchor spanning a line break, a novelty
claim made before searching. The bottleneck was not *having*; it was *looking*.

## The reframe that may be the real answer

Context-enrichment may not *replace* supervision. It may **shrink the domain over which supervision
is required** — which is a different and possibly better goal.

If the agent knows what `main` gained since the fork, which lanes hold which regions, what the
owner decided this session, then most stop-and-reviews become unnecessary and the remaining ones
are the real ones. Stated mechanically, that is exactly the **zone predicate** that
`lane-autonomy-future.md` component 5 requires and that **does not exist in code**
(`grep "high-stakes\|zone" server.ts` → nothing): a git-computable statement of *where I do not
need you*.

Whether "shrink the domain" is the honest answer or a comfortable half-measure is precisely what
this document does not decide.

## The concrete facts a fresh mind will need

**What ② is given today** (`merge-prompt.ts`, `buildCleanReviewPrompt`; assembled in `server.ts`,
grep `runCleanReview`) — four things, inside a `<<<DATA` block marked untrusted:
lane changed-file list · lane shortstat · `base..main --oneline` · main's changed-file list.
Plus tool access to the rebased worktree.

**What it is NOT given:** the lane's brief (what it was asked to do) · what other lanes are
touching · the outcome-ledger history · anything the owner said this session.

**Where reversibility actually stands** — this reorders the ladder and deserves attack:
`undoLast` is a `Map<repo, LandRecord>`, **one** record per repo, overwritten by `recordLand` on
every land that moves `main` (`server.ts`, grep `const undoLast`). Undo **refuses outright** once
the land reached a remote (`grep "revert it by hand instead"`). Component 5 demands a gate that is
**reversibility-primary, not confidence-primary** — and reversibility is one land deep and void on
push. The 2026-07-26 session, which spent itself on the judge, thinks it had the wrong target.

**The trade, which `lane-autonomy-future.md` insists be named every time:** autonomy exchanges
*"nothing wrong ever reaches main"* for *"wrong-but-reversible-and-documented may reach main
briefly."* Both load-bearing words — **reversible**, **briefly** — are currently the least-built
parts of the system.

## The experiment this suggests, offered as a proposal and not a conclusion

The claim is empirical, so it can be measured rather than argued. Fire-drill #3 already exists,
pre-registered, with sealed ground truth and a harness that runs the real reviewer through the real
prompt (`drills/`). The clean variant is **the same fixture, two prompts** — one context-poor as
today, one enriched with the lane's brief and the concurrent-lane picture. If the enriched reviewer
names the seeded collision and the poor one does not, the owner's hypothesis has evidence instead
of plausibility.

Two honesty conditions carried from `judge-calibration.md`: **one drill is N=1**, and the enriched
prompt must not be tuned against a fixture whose verdict has already been seen.

It is blocked behind `cc913fe1` — while the reviewer answers nothing, a richer prompt measures
nothing either.

## Questions worth an independent mind

Not a checklist. These are the places where the reasoning above is thin.

1. Is "inspection / accountability / presence" the right decomposition of what a human contributes
   at a merge trigger — or is there a fourth thing nobody has named?
2. Which parts are transferable as context and which are structurally not? Is accountability really
   untransferable, or is it just unpriced?
3. Is "shrink the domain of supervision" a genuine reframe or a way of avoiding the hard question?
4. What makes a good git-computable blast-radius bound? Path-based zones are the obvious design —
   what are their failure modes, and what would defeat them?
5. Is the two-prompt drill the right experiment? What would it prove, and what would it *not*?
6. **Adversarial, and the most valuable:** what would make this entire line of thinking wrong? If
   context-enrichment is a dead end, what is the earliest cheap signal that would show it?

## Do not re-derive

- That the parser bug in ② is fixed — it is, measured (`judge-calibration.md`).
- Retired and not to be re-proposed: `rerere`, a hard pre-land block on the full suite, auto-undo on
  a red audit, file-based check selection (rejected with numbers, `verify-tiering.md` §11.6c).
- `graduation-criteria.md` §1's numbers are met. That is not the blocker and never was: every land
  in the ledger is owner-initiated, on one repo, and that repo is Fleet. **No number of attended
  lands can license an unattended one** — they measure the pipeline, not the absence of the human.

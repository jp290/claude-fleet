# Program board / stack-land — surface the lane DAG and orchestrate the owner's land sequence

*Proposal, 2026-07-23 (this session + JP). **Propose-only** — nothing here is built; it specs a
future feature and files the design for JP to decide on (OWNER.md §4b: the steward frames and
files, JP lands). Code refs are symbol/grep anchors per the P2 convention; grep-verify before
building. Sits beside `mechanism-deep-dive-2026-07.md` (whose 5-lane program IS the motivating
specimen below) and `lane-autonomy-future.md` (which deferred autonomous landing — this proposal
deliberately does NOT revisit that; see §6). An Agency-axis / operating-model improvement.*

## 0. Why this doc exists (and this session's role in it)

Executing the `mechanism-deep-dive` plan produced a **program of five interdependent lanes**, not
five independent ones. The fleet's land/close machinery is per-lane and independent-lane oriented;
it has **no model of a set of related lanes with a dependency order**. Right now the only place
that DAG, the land order, and each lane's verification status exist is **in this coordinator
session's context** — a human/agent holding it in their head. When this session clears, that
structure is lost unless captured. So this document is simultaneously:
1. the **specification** for the missing "program board" feature, and
2. the **durable capture** of the current stack's state (§8) — i.e. the exact data a real program
   board would persist. The doc is the manual version of the thing it proposes to automate.

That self-reference is the tell that the gap is real: a coordinator agent had to *become* the
program board because the system doesn't provide one.

## 1. The gap, precisely

- `createWorktree` records each lane's **base branch** (grep the `base` field on the worktrees-map
  row, and `repo-base` config) — so the raw material for a dependency edge (lane → the branch it
  forks from) EXISTS, but nothing consumes it as a DAG. A lane forked from another lane vs. from
  `main` is indistinguishable on the board today.
- The board shows per-slot / per-lane rows (dirty / ahead / unpushed / `empty:` safe-to-drop). It
  does **not** show: which lanes belong to one program, which depends on which, a computed safe
  land order, or per-lane readiness (verified vs. not).
- Consequence: the owner must hold the order in their head and land by hand, one lane at a time,
  re-deriving "which is safe to land next" each time. For a 5-lane stack that is exactly the
  error-prone bookkeeping the fleet otherwise eliminates.

## 2. What already exists — reuse, do NOT rebuild

The per-lane primitives are strong; the missing thing is *orchestration across a set*, not new
land mechanics. Anchors (grep-verified at HEAD `e978c78`+lanes):
- **Land spine**: `advanceIntegration` (moves main, ff-only), `landLane` (teardown),
  `recordLand` (provenance note + undo record — hardened this session by lane G1),
  `removeWorktreeSafe` (refuses to strand work).
- **Re-rebase onto a moved main** already exists in the confirm-land route (grep
  `no longer replays cleanly` — the replay-or-fall-back-to-⏫ block). **This is the reusable engine
  for orchestrated rebase**: landing a parent and re-rebasing its dependents is the same operation,
  just sequenced across the DAG instead of invoked once.
- **Undo**: `/api/repos/undo-land` (resets main, keeps the branch, refuses once the commit is on a
  remote or main moved past — grep the route).
- **Safe close**: `discard` returns the pre-delete head as undo-ammo (grep `branchDeleted`), and
  the worktrees map marks `empty:` (provably-safe-to-drop) rows.

So a "done right" system is a **read-model + a sequencer over existing verbs**, not a new spine.

## 3. What "done right" is — and is NOT

**IS:** a program/stack layer on top of the per-lane gate that makes the owner's *sequence* of land
gestures legible and safe:
- surface the dependency DAG + a computed safe land order on the board;
- after each land, auto-rebase the direct dependents onto the new main (reusing the confirm-land
  re-rebase engine) so the next land is clean;
- one blast-radius / cleanup view for the whole stack (the OWNER §4b "show what is lost first"
  overview, applied to a program), driving post-land worktree removal.

**IS NOT:** autonomous landing. It stays **one owner land-gesture per lane, forever** (OWNER.md
§4b: land/merge to main is the permanent hard-gate; `lane-autonomy-future.md` already chose
"cheap + undoable human land, zero autonomy"). "Right and proper" here means removing the
*bookkeeping*, never the *gesture*. Any version that lands without a per-lane owner action is out
of scope by invariant, not by taste.

## 4. Suggested decomposition (each independently landable; each owner-gated)

- **PB-1 — derive + surface the DAG (read-only, safest first).** Compute each lane's parent from
  its recorded base branch; render program grouping, the edges, and a topological safe-land-order
  on the board. No change to any land behavior. Deterministic; verifiable by asserting the order
  for a known stack. This alone removes most of the pain.
- **PB-2 — orchestrated dependent-rebase.** On a successful land, re-rebase the direct dependents
  onto the new main using the existing confirm-land replay engine; surface any that now conflict
  (siblings touching adjacent code — see §5) as "needs ⏫ merge." Owner still lands each dependent.
- **PB-3 — stack blast-radius + cleanup.** A whole-program "what's lost / what's landed / what's
  safe to drop" view; offer worktree removal only for `empty:`/landed lanes, with the §4b
  overview shown first.

## 5. Design tensions / open questions (what a builder will hit)

1. **DAG source — inferred vs. declared.** Inferring the parent from `git merge-base` is ambiguous
   (a lane forked from a lane shares most history with main). Cleaner: consume the **already-recorded
   base branch** from `createWorktree`. Decide whether a "program" is an explicit tag at lane-spawn
   or inferred from a shared fork-point. Leaning explicit — cheaper and unambiguous.
2. **Sibling contention.** Two lanes forked from the same parent that touch adjacent code (in the
   current specimen, A2 and B1 both fork A1 and both touch the outcome/tally area) do NOT conflict
   in isolation, but the *second* to land must rebase over the first and may hit a real conflict →
   the merge agent. The board should predict and flag sibling contention, not discover it at land.
3. **Verification-status source — the deep one.** A program board wants a per-lane "verified ✓"
   flag, but the fleet has **no CI and no authority that produces lane-readiness** except a
   human/agent asserting it (this session was that authority). G1/G2's verify verdict is per-*merge*
   (does the rebased tree pass `FLEET_VERIFY_CMD`), NOT per-lane-*readiness* (was this lane's work
   reviewed + its own suite run). Ties directly to the program's "verification-coverage is the
   throttle" doctrine (`learning-engine-next-steps`): the board must not display a green readiness
   it cannot deterministically source. Open: does readiness come from `FLEET_VERIFY_CMD` run per
   lane, or does it stay an explicit human/coordinator attestation (and is that attestation
   recorded where the board can read it)?
4. **Stack undo.** `lane-autonomy-future.md` §"Stacked lands" notes undoing a *middle* land means
   reverting through the later ones; the existing `undo-land` already refuses once main moved past
   the land, which is the correct conservative interaction — the stack view should make that refusal
   legible ("cannot undo — 2 later lands sit on top") rather than a bare 409.

## 6. The invariant this must never violate

OWNER.md §4b, verbatim posture: land/merge to `main` is *"never auto-acted, forever."* JP's own
fences: *"get a 2nd agent's opinion before pressing land"*, *"I don't think it should be possible
to commit mid run."* The load-bearing split: *"the steward frames and files; JP decides."* A
program board that ever lands without a per-lane owner gesture has crossed the anchoring line, no
matter how well-verified. Autonomy is the deferred, correctly-fenced path — this proposal is about
legibility, not authority.

## 7. Verified vs. inferred (honesty ledger)

- **Verified** (this session, grep at HEAD): the per-lane primitives in §2 exist and are the ones
  named; the confirm-land route re-rebases onto a moved main; `createWorktree` records a base
  branch; the board has no DAG/program model.
- **Inferred / not built**: everything in §3–§5 is design, not code. The claim that the
  confirm-land replay engine cleanly generalizes to orchestrated dependent-rebase (PB-2) is a
  design hypothesis — plausible from the code shape, unproven. Sibling-contention prediction (§5.2)
  assumes a cheap dry-run rebase is feasible; not verified.

## 8. The specimen, LANDED — one full run of the manual process (2026-07-23)

The five-lane stack was landed by hand the same day, owner-initiated (OWNER §4c: *the op's cost is
set by who initiates it*). Recorded here as the worked example the feature would automate —
**the observations below are the empirical half of §5's open questions.**

Final order (ff-only, no merge commits), oldest first:

```
917452a  G1  land provenance + stale-verify guard      (server)   ← G-track root
9e729d4  G2  verify badge in land review               (client)   ← after G1
2fc7c50  A1  honest helped semantics + attest staleness (server)  ← A-track root
df260b1  A2  advisory baselineRate                     (server)   ← after A1
f70cc7a  B1  propose-outcome from promote/dismiss      (server)   ← after A1
```

**What the manual run revealed (feeds §5):**
- **Duplicate-parent handling is free.** Rebasing a child onto a main that already contains its
  parent (G2 after G1; A2/B1 after A1) made git drop the duplicated parent commit by patch-id —
  each child reduced to exactly 1 commit. PB-2 does not need to special-case this.
- **§5.2 sibling contention did NOT materialize.** A2 and B1 both fork A1 and both touch the
  outcome/tally area, yet the second rebased cleanly. Evidence that "touches the same region" is
  too coarse a predictor — a useful prediction needs a dry-run rebase, not a file-overlap heuristic.
- **§5.3 readiness had no source but attestation.** Every `[VERIFIED]` flag was a coordinator
  judgement (diff-review vs. the findings + a non-tautology proof + a green battery **in the
  rebased landing state**). Nothing in the system recorded it; it lived in one session's context —
  precisely the gap §0 describes. A real board must decide where this attestation is stored.
- **Verify each lane in its LANDING state, not as authored.** A2 and B1 were re-verified after
  rebasing onto the moved main, not merely as their agents left them. A stack sequencer must
  re-run verification post-rebase, or it certifies a tree that never lands.
- **Integrated ≠ sum of verified.** G1+G2+A1 were each green alone; the run added an explicit
  battery on merged main because G1 and A1 both touch `server.ts` and had never been exercised
  together. PB-2 should make this integrated check a first-class step, not an afterthought.
- **Ff-only makes the last check free.** Because each land was a fast-forward, the tested tree
  became main verbatim — no post-land re-verification needed.
- **Worktree placement bit.** The lanes were created *inside* the repo
  (`<repo>/claude-fleet.worktrees/…`) instead of the sibling convention the steward uses
  (`~/claude-fleet.worktrees/…`). The directory is not gitignored, so it showed as
  `?? claude-fleet.worktrees/` in every status/diff of the live repo until cleanup. PB-3 (or the
  lane-spawn path) should pin the location — or `.gitignore` it.
- Cleanup after landing: all five worktrees removed (`git worktree remove`), branches KEPT
  (`lane/g1`…`lane/b1`) per the fleet's own convention that a land never deletes the branch.

**Still open after this run (not part of the feature):** the deploy (`bun run build` +
`tmux -L claudefleet kill-session -t srv` + Tailscale health-check) is separately owner-gated
(OWNER §4b: environment/lifecycle mutations); and **B1's non-server half** — the `/rundgang` prompt
edit (a skill file under `~/.claude`, shared reality, not lane-able) plus one live pulse to observe
a proposal actually get filed. Until that lands, B1's wiring is correct but inert.

## 9. Relation to the broader program

This is the operating-model / Agency-axis complement to the learning-engine work: the deep-dive
lanes widen *verification coverage* (the throttle); this proposal widens *integration legibility*
(the bottleneck a multi-lane program creates downstream of verification). Both are "make the
owner's high-leverage gestures cheaper and safer without removing them" — the same doctrine that
produced one-gesture land + undo-land instead of autonomous land.

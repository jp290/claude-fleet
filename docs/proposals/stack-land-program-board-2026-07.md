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

## 8. Immediate use — the current stack (doubles as the land handoff)

The live specimen at authoring time (2026-07-23). Land order is load-bearing; two independent
tracks (G, A), free relative order between tracks.

```
main (e978c78)
├── lane/g1  (35bd3ea)  G1 land-provenance + stale-verify   [VERIFIED]      ← land 1st (G-track)
│   └── lane/g2  (32c7524)  G2 verify badge (client)         [VERIFIED]      ← land after g1
└── lane/a1  (19d8578)  A1 honest-helped + attest-staleness  [VERIFIED]      ← land 1st (A-track)
    ├── lane/a2  (…)     A2 baselineRate                      [UNDER VERIFY]  ← land after a1
    └── lane/b1  (…)     B1 propose-outcome (server half)     [UNDER VERIFY]  ← land after a1
```

- **G-track:** land `lane/g1`, then `lane/g2` (g2 contains g1's commit; after g1 lands, g2 rebases
  to just its own client commit — clean).
- **A-track:** land `lane/a1`, then `lane/a2` and `lane/b1` (siblings — see §5.2; the second to land
  rebases over the first, low but non-zero conflict risk in the outcome/tally area).
- `[UNDER VERIFY]` = the coordinator's diff-review + fail-at-HEAD + independent green not yet
  complete for that lane; do not land until it is. (This flag is exactly the per-lane readiness
  §5.3 asks who should own.)
- **B1 also needs the owner** for its non-server half: the `/rundgang` prompt edit (a skill file /
  `~/.claude` — shared reality, not a lane) + one live pulse to observe a task get filed.
- **Server-touching lanes** (g1, a1, a2, b1) need the deploy step after land
  (`tmux -L claudefleet kill-session -t srv`). g2 is client-only → `bun run build` + serve.
- Post-land: remove each landed lane's worktree (`git worktree remove …`) — the §3/PB-3 cleanup,
  done by hand until it exists.

## 9. Relation to the broader program

This is the operating-model / Agency-axis complement to the learning-engine work: the deep-dive
lanes widen *verification coverage* (the throttle); this proposal widens *integration legibility*
(the bottleneck a multi-lane program creates downstream of verification). Both are "make the
owner's high-leverage gestures cheaper and safer without removing them" — the same doctrine that
produced one-gesture land + undo-land instead of autonomous land.

# Lane merge/land autonomy — deferred ideas

Status: **deferred, not planned.** Captured 2026-07-22 so the thinking isn't lost. We
deliberately chose the small version instead (see "What we built instead" at the bottom).
Revisit only if the small version proves insufficient — and only with the calibration data
the small version produces.

*Ref note: the `server.ts:NNN` line numbers below were captured when written and have since
drifted (lanes A/B/C + canDeliver reshaped `server.ts`) — grep-verify any anchor before relying on
it. This is a deferred-ideas doc; the numbers are illustrative, not maintained per-lane.*

## The shift these ideas describe

Move the merge/land decision from **pre-hoc approval** ("the merge agent made a semantic
choice → stop and ask the owner", the current `"resolved"` pause at `server.ts:2044-2045`)
to **post-hoc accountability**: the agent acts, documents facts + reasoning + which
interpretation it chose and why, keeps the result trivially reversible, and the owner reviews
a feed and undoes anything they disagree with. Approval becomes observation-with-undo.

This is the **steward risk doctrine applied to merges** (see `project-steward-risk-doctrine-revision`
in memory: autonomous unless *unrecoverable-and-large-blast*; reversibility raises tolerance).

## The one strategic insight that makes it safe

**Reversibility + documentation are prerequisites for safe autonomy, and valuable on their
own.** So the build order is forced and healthy:

1. Build documentation + reversibility first — human gate still in place. A real upgrade at
   low risk.
2. Let a land ledger accumulate: every documented resolution, and whether the owner would
   have undone it.
3. Only then flip autonomy on — and set the gate **from that real data**, not a guess. The
   ledger becomes the calibration set: "of the last 50 resolutions, which would I have
   reverted?" tells you exactly where autonomy is safe. Never bet on autonomy blind.

## What full autonomy would need (the six components)

1. **Structured resolution record — verified/narrative split.** Per-conflict JSON:
   `{file, side-A intent, side-B intent, relational assessment [reconcilable | one-supersedes
   | mutually-exclusive], chosen resolution, confidence}`. Discipline (already the house style,
   `server.ts:2115` "believe git, not the agent"): *facts* (files, hunks, SHAs, resulting code)
   are git-verified; *reasoning/interpretation* is the agent's narrative, labeled unverified.
   The documented rationale must never become the safety authority.
2. **Durable land ledger.** Today the merge `detail` is in-memory/per-slot, dropped on recycle
   (`server.ts:925, 2054`). Autonomy needs an append-only, chmod-600 ledger (reuse the
   `appendEvent` chain behind audit / steward-journal): facts, resolution records, pre-land
   `main` SHA (the reversal handle), outcome.
3. **First-class undo.** Two tiers, chosen by git-fact: *reset* `main` to the pre-land SHA when
   main hasn't moved/pushed (clean); *revert* when it has (`onRemote` check at
   `server.ts:716-725` tells you which is safe). Re-open the retained branch.
4. **Verified-green precondition.** Do NOT autonomously land red/unverified work — that's an
   automatic exception → pause. Needs the "land-readiness signal" (lane's own build/test status
   surfaced at the land button) built first.
5. **Graded autonomy gate — reversibility-primary, not confidence-primary.** Autonomous iff:
   cleanly reversible now (git-computable) AND the agent *reconciled* rather than *arbitrated a
   mutually-exclusive conflict* AND not in a high-stakes zone (migrations/auth/config). Weight
   git-computable reversibility over the agent's self-reported confidence (an agent that
   resolved badly may also misjudge it as clean). Exceptions that still pause: irreversible-ish,
   genuinely-arbitrated, high-stakes-zone.
6. **Post-hoc review feed.** The ledger rendered as "what landed autonomously and why," each row
   with `↩ undo`. Review becomes observing, not blocking.

## The tradeoff this accepts (name it every time)

Autonomy trades **"nothing wrong ever reaches main"** for **"wrong-but-reversible-and-documented
may reach main briefly."** Sharp edge: **green tests ≠ semantically correct** — no machine
catches a resolution that compiles, passes tests, and still chose the wrong side's intent.
Reversibility bounds the cost; documentation makes it discoverable; but it can reach main
unattended. The verified-green precondition + reversibility + the human exception for
arbitration are what keep the accepted risk small.

## Genuine hard cases (the "exceptions")

- **Stacked lands:** undoing a *middle* land means reverting through the later ones.
- **Pushed main built upon elsewhere:** reset-based undo is unsafe → revert only.
- **Conflicting reverts:** the undo itself can conflict.
- Deep-undo is not one click — the ledger stays honest by *documenting when an undo would be
  lossy* instead of pretending otherwise.

## What we built instead (the small version)

We chose NOT to build the above. Instead, the minimal version that captures the value:

- **One-gesture land** (commit-if-dirty, then land) — removes the real friction.
- **Undo-last-land** — landing already keeps the lane branch (`server.ts:762-778` removes the
  worktree, never the branch), and the pre-land `main` SHA is one recorded pointer away. So
  "reverse a land" = reset `main` back + reopen the branch. ~80% of the reversibility vision
  with **zero autonomy** and the human gate untouched.

Everything above (autonomous landing, graded gate, structured reasoning records, verified-green
precondition, post-hoc feed) stays deferred until the small version's ledger data justifies it.

# The perception layer — design note (2026-07-25)

*What Fleet needs before it may steer anything. Written on main **before** the lane that
implements it, so the lane has a target it did not have to invent. Treat the line refs as
claims: they drift — grep the symbol.*

**Status (2026-07-25, after `600d401` "make Fleet observable to itself on the write side"):
the write half is built, the reader is not.** (c) the deterministic `done-looking` predicate
and auto-③ on it, and (b) the review persisted onto the outcome row with the patch-id
staleness relation — all in `server.ts` (grep `tickAutoReview`, `patchIdOf`, `outcomeReview`).
**(a) the feed is still unbuilt**, so the ledger remains write-only *in effect* and (b) has so
far produced **zero** rows carrying a review. The sections below stay as written — they are the
design the lane was held to; `knowledge-layers.md` §5 records what the as-built state proves
and what it still leaves unmeasured.

## 1. The gap, stated as a fact about today

Two mechanisms produce judgement about lane work, and **neither is observable**:

- The **outcome ledger** (`lane-outcomes.jsonl`, written by `buildLaneOutcome`, read by
  `GET /api/lane-outcomes`) is **write-only in practice**: the route exists and is owner-gated,
  and no client consumes it (`grep lane-outcomes src/` → nothing).
- The **③ `🔍 review`** findings live in `reviewCache`, an in-memory `Map`. They die on the next
  deploy, slot recycle, or tree change. Nothing persists them, and ③ is *click-only* — so the
  normal path is that a lane lands having never been reviewed at all.

`docs/README.md` §"Four capabilities" states the consequence: capability **(c) in-flight
steering** is not responsibly buildable without perception, and neither is footprint-disjoint
parallelism (a fleet you cannot observe produces a backlog of unreviewed green work — the
expensive failure mode, not the cheap one).

One precision on that claim (2026-07-25): "Fleet cannot see itself" conflates two senses.
**Perception-of-now already exists** — `stewardSlotsView` and the digest see every live slot's
deterministic state. What is missing is **outcome memory**: what a lane's work turned out to be
worth, and what review said about it. (c) is gated on the *latter* — steering needs a track
record to calibrate interventions against, not just a live view. This layer builds the memory
half; the live half only gains the `done-looking` predicate.

This note covers the three pieces that close it, and fixes their order.

## 2. Order — c → b → a, and why it is not the obvious one

| | piece | side |
|---|---|---|
| **c** | auto-run ③ when a lane goes *done-looking* | server |
| **b** | persist the review onto the outcome row | server |
| **a** | the outcome feed (the ledger rendered) | client |

The intuitive order is a → b → c (build the reader, then give it things to read). It is wrong
here: **(b) has nothing to persist until (c) exists**, because ③ only ever runs on a click, and
a lane that lands unreviewed writes a row with `review: null` forever. Doing (b) first ships a
field that is honest and empty — the failure mode §3 of HANDOFF named: *a row of zeros looks
like data and is worse than no row.*

**Lane split: (c)+(b) in one server-only lane, (a) in a client-only lane after it.** The two are
footprint-disjoint (`server.ts` vs `src/client.ts`) and *could* run in parallel; they are
deliberately serial because lane (a) renders a field whose shape lane (c/b) defines, and because
two simultaneous diffs spend the one resource that is actually scarce — review attention
(`operating-model.md` Invariant 5).

## 3. `done-looking` must become a deterministic predicate

**Today the term exists only as an LLM label.** `DIGEST_CONDITIONS` (grep it in `server.ts`)
lists `done-looking` as one of six conditions a *throwaway digest worker* assigns, and the
prompt hands that worker the rule in prose: *"idle + clean + git.ahead>0 → done-looking"*.

An auto-trigger must not hang off that. Two independent reasons:

1. **Verification hierarchy** (`verification.md`): deterministic > statistical. A model output
   is the weakest admissible done-signal, and here it is not needed — every input is already a
   deterministic server-side fact.
2. **Coupling.** The digest is demand-triggered, TTL-cached, and advisory by construction (it
   holds no credential and gates nothing). Making it the trigger for an action inverts that
   contract silently.

The inputs all exist in `stewardSlotsView` (grep it): `alive`, `idleMs`, `git` (dirty/ahead),
`gitOp`, `merge`. So the predicate is a small pure function over facts Fleet already computes,
and the digest prompt's prose rule becomes its *specification*, not its implementation. Both
then agree by construction — and the digest may keep its own label, since it also classifies
non-lane slots the predicate does not care about.

## 4. Auto-③ — guard rails (these are the design, not decoration)

③ is advisory and owner-only today. Automating *when it runs* must not change *what it may do*:

- **Lanes only.** A slot with no `worktree` has no lane diff to review. Never the `⚙ steward`
  slot — it is a planning pane, its diff is not lane work.
- **Once per git state.** The existing cache key (`HEAD` + hashed `status --porcelain`) already
  gives this for free: if the key is unchanged, the cached result is returned and no agent
  spawns. The auto-path must reuse that key, not a timer.
- **Never a gate.** No land, merge, or dispatch decision may read the auto-review's result. It
  removes a *wait* (findings are there before the owner looks), never a *check*
  (HANDOFF §6: those two are constantly confused).
- **Idle-gated, and it stays advisory even when it fails.** A failed review is a non-event: no
  retry storm, no terminal event, no state change.
- **Cost.** ③ runs on a throwaway subscription session (`SUMMARY_MODEL`), so the price is
  latency and attention, not metered tokens. That is what makes firing it unprompted acceptable.

## 5. The review on the outcome row — the staleness rule

`buildLaneOutcome` is the single assembly point for `landed` / `shelved` / `killed`, so the
review attaches there (the `reverted` record is built without a live slot and honestly gets
nothing).

**The hard rule: a persisted review must carry whether it actually described what landed.** The
cache is keyed on the git state it was computed for; by land time the tree may have moved.

**Corrected 2026-07-25 (the first version of this rule was wrong):** the relation must be
**content identity, not commit identity**. The land path *rebases* the lane onto main before the
ff-merge, so after any rebase-land the lane's HEAD differs from the reviewed HEAD even though the
reviewed diff is byte-identical — a key comparison would mark those reviews "superseded"
chronically, and precisely under the parallel dispatch this layer exists to enable (serial lands
mostly no-op the rebase, which is why the defect stays latent today). The honest relation is
`git patch-id --stable` over the reviewed diff vs the landed diff: identical content after a
clean rebase → covered; real content drift → superseded. The *spawn dedup key* stays HEAD-based —
cheap and correct for "at most once per git state" — only the persisted relation compares
patch-ids. A review computed for genuinely different content is recorded as such or not at all;
it is never silently presented as coverage of the landed diff.

This is the same discipline as `LandFacts.verified` (grep the type): an explicit "we know no
review covered this" is an **answer**, and must not be representable as a missing field that
`??` will resolve to something older. Whatever shape the lane chooses, the un-covered case must
be unreachable-by-construction, not guarded.

Rows 1–2 of the ledger stay untouched. They are not backfilled (HANDOFF §3), and nothing may be
calibrated on them.

## 6. The feed (lane 2)

`GET /api/lane-outcomes` already returns the rows newest-first with a clamped `limit`, owner-only
and structurally 404 on share hosts. Lane 2 is the reader: the ledger rendered as *what landed,
how, and what review said about it*. `lane-autonomy-future.md` item 6 ("Post-hoc review feed")
carries the intent, including `↩ undo` per row — **review becomes observing, not blocking.**

Two honesty constraints for the renderer (they belong in lane 2's brief):
- **Empty findings ≠ clean.** ③ is diff-bounded by construction and DP1 proved it misses defects
  living outside the diff. A review with zero findings must render as "the diff-bounded reviewer
  found nothing", with its `scope`/`notes`, never as a green checkmark.
- **`↩ undo` is one-step.** Only the newest land is undoable; rendering undo on every row
  implies a capability the land spine deliberately does not have.

Note the citation: the feed is item 6 of `lane-autonomy-future.md`, **not** of
`merge-review-autonomy.md` (whose §6 is "Hard rules"). Both HANDOFF and `README.md` carried the
wrong pointer until 2026-07-25.

## 7. What must not move while building this

- The land gate stays machine-checked and the owner holds the token.
- An advisory agent may only ever **downgrade** an auto-land, never widen it. Auto-③ touches
  neither direction: it is not wired to the land path at all.
- Parallel dispatch stays parked until this layer makes unreviewed work visible
  (HANDOFF §6.1 / §7.4). Capacity was never the constraint.

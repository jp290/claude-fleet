# The missing tier — what the land gate actually verifies, and what the docs say it does

2026-07-25, second adversarial pass (owner-prompted). Every claim below was read first-hand
today; file:line given. This is the sharpest criticism found so far because it is not a bug —
it is a **half-built safety design that reads as complete**, and the entire autonomy program
rests on the half that was never built.

## 1. What the gate contains (VERIFIED)

The live land gate is `FLEET_VERIFY_CMD`, `watchdog.sh:49`:

```
bun install --frozen-lockfile && bunx tsc --noEmit --strict … && ./e2e-claude-gate.sh
```

- `tsc` — real, strong, whole-program.
- `./e2e-claude-gate.sh` — **26 checks** (`fleet-e2e-claude-gate.ts`, 270 lines). Listing their
  names: every one is about `claudeAlive()` — dead/alive pane gating, the steward-send freshness
  refusal, crash-candidate recording, per-slot model quoting, and the dispatcher's post-spawn
  gate. **Zero** checks touch merge/land, the outcome ledger, the disposition rail, the judges,
  worktree safety, autos, or the client.
- `fleet-e2e.ts` — **703 checks** — is NOT in the gate. It runs only when a human or a lane
  runs `./e2e-isolated.sh` by hand.

So a lane that breaks `landLane`, `emitLaneOutcome`, `runCleanReview`, `worktreeRisk`, or the
rail's owner-only guard passes the gate green, provided it typechecks and leaves `claudeAlive`
alone.

## 2. What the docs say (VERIFIED — one is false in present tense)

- `merge-review-autonomy.md:192`: the gate's known gap "is exactly what the post-land
  `e2e-isolated` audit **still covers**."
  **FALSE.** There is no post-land audit. Verified: no such code in `server.ts` (no `post-land`,
  no `e2e-isolated` reference), no launchd job beyond the watchdog, no crontab (empty), no auto.
  The sentence describes a component that was designed (`lane-autonomy-future.md:21`,
  `merge-review-autonomy.md:146`) and never built.
- `lane-brief-template.md:81`: "The land gate is tsc + e2e-claude-gate: **server-side behavior
  is covered**, client code is asserted only at source-string level."
  **Overstated in the half that matters.** The client caveat is right and useful; the
  server-side claim is what a lane acts on, and it is wrong — 26 claudeAlive checks are not
  server-side coverage. This doc's job is to steer lane scope ("prefer server-side scope for
  anything autonomy-adjacent"), so the false half actively mis-steers.
- `automation-frontiers.md:56` is the honest formulation: "`tsc` + `e2e-claude-gate` prove
  'does not break'". Keep that phrasing; retire the other two.

## 3. The substitution nobody flagged

`BACKLOG.md:144` records the pivot in its own words: the ② clean-path advisory reviewer
"closes it **without a post-land audit backend**." That is a **statistical judge substituted
for a deterministic tier** — against the project's own hierarchy (deterministic >
semi-deterministic > statistical, CLAUDE.md/global rules) and against its own ladder doctrine.

The substitution's current state, measured: ② has produced **7 verdicts, 6 × `raw: true`** —
near-zero usable output, not even at display trust (`judge-calibration.md`). The replacement
for the missing deterministic tier is, today, an all-but-empty set. **2026-07-25: the cause was
the PARSER** — a prose-wrapped but valid verdict object was discarded; `runCleanReview` now
extracts it. The set should start filling from the next shadow row; until it does, this
section's argument stands unchanged.

## 4. Why this poisons the numbers, not just the safety story

`verified: true` on every K1 row means "tier 1 passed" — types plus claudeAlive. The
pre-registered criterion (`graduation-criteria.md` §1: "N ≥ 20 … so `verified` is honest")
reads as if it meant the project's test suite. **K1 is currently counting: landed without
breaking types or the claudeAlive gate.** That is a real property and worth counting — it is
just not the property its name implies, and the graduation decision would be made on the
implied reading.

This is the project's own recurring defect class (`unfed mechanism`) in a new shape: not a
mechanism without a feeder, but a **design half without its other half, referenced in the
present tense**. The axiom "risk concentrates at the ONE machine-checked boundary" inherits the
same overstatement: the boundary is real but thinner than every downstream decision assumes —
including the decision to loosen upstream autonomy *because* the gate is hard.

## 5. What to do (cheapest first)

1. **Free, today:** correct the two doc claims (§2). An agent reading `lane-brief-template.md`
   scopes work by it.
2. **Rename the honest thing:** the ledger field / feed chip should read `verified(tier1)` or
   carry the command's identity, so the number can never drift from its meaning. Add one line to
   `graduation-criteria.md` stating what K1's `verified` attests — an amendment, written before
   more data accrues (the doc's own rule).
3. **Build the second tier — now unblocked.** The stated blocker was the ~600 ms pane-capture
   flake plus `e2e-isolated` exceeding `VERIFY_TIMEOUT_MS` (120 s, `server.ts:2485`). The
   `e2e-split` lane is fixing that flake today. Two viable shapes, both cheap:
   - **post-land audit:** after a land, run `e2e-isolated` async; red → owner-visible alarm +
     the existing `undo-land` as the rollback (this was the original design).
   - **or gate tier 2** with a raised timeout for autonomy-adjacent diffs only.
   Either restores "deterministic > statistical" instead of leaning on ②.
4. **Only then** should component 5 (auto-land of resolutions) be considered: it is the one
   step that removes the human from the path the thin gate cannot see.

## 6. Second finding: role separation is not independence

`merge-review-autonomy.md:33` grounds trust in "Resolver ≠ Reviewer ≠ Lander, always" plus
"independence comes from layer 1 + the human". Both legs are weaker than stated:

- **Layer 1 is thin** (§1) — so more weight than intended rests on the agent layers.
- **The agent layers are correlated.** `SUMMARY_MODEL` (`server.ts:1828`, default
  `claude-sonnet-5[1m]`) runs ②, ③, the merge resolver, the enhancer and the digest — one model
  in five roles. The lanes, the steward and this session's operator are also Claude. Different
  *roles* do not give independent *error distributions*: a diff that misleads ③ tends to mislead
  ② and the resolver the same way. `graduation-criteria.md:76` guards only labeler-vs-lander
  independence; judge-vs-judge correlation is unguarded.
- **The calibration inherits the correlation.** Fire-drills are designed by a Claude
  (me) against a Claude judge. Drill #2's D1 was made "spec-fair" by putting a contradicting
  intent-comment in the same hunk — precisely the cue this judge class keys on. A 2/2 result
  measures "the judge catches what a sibling model expects it to catch."
  Cheap correction: at least one drill per judge whose defects are authored by a *different*
  source (owner-written, or mined from real historical defects — `automation-frontiers.md`
  already lists two real ones), and record the drill's author-model beside its result.
- Consequence for §5's fix list: the second tier matters more, not less — it is the only leg
  of the independence story that is not model-correlated.

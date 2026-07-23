# Lane V1 — deterministic verify in the merge verdict

Spec: `docs/merge-review-autonomy.md` §3 (binding — read it first, plus §1 for the why
and §6 rule 4). Server-only + e2e. Symbols over lines; refs cite `52ced56` and drift.

Build: after the git-verified rebase in `mergeJob` (BOTH paths — clean and resolved,
before any land/verdict write), run a per-repo verify command against the rebased
worktree and record the result in the verdict:

- `MergeLast` gains `verify?: { cmd: string; ok: boolean; out: string; at: number;
  mainSha: string }` — `out` is the tail, byte-capped (~2KB); `mainSha` = the main SHA
  the tree was rebased onto.
- Command resolution: env `FLEET_VERIFY_CMD` (empty/unset → NO verify, field absent —
  absence must be visible in the verdict consumer, never silently green). Timeout ~120s
  (env-overridable), non-zero exit or timeout → `ok:false`. Run with cwd = lane worktree.
- CLEAN path ordering decision (make consciously, document in code): verify runs BEFORE
  the ff/land — a red verify downgrades the auto-land to a "resolved"-style stop-and-
  review verdict instead of landing broken code. That changes today's behavior for the
  clean path; it is the point of the lane (docs §1). A missing verify cmd keeps today's
  behavior exactly.
- Owner latitude stays: the confirm-land route must NOT hard-block on `ok:false` — the
  owner may land anyway (docs §3, OWNER.md §4a). No client work in this lane beyond
  passing the field through existing verdict JSON (the overlay rendering is V3).

Tests (e2e, isolated suite): a lane whose rebase breaks the verify cmd (use a trivial
`FLEET_VERIFY_CMD` like a script that greps for a marker) → verdict `verify.ok:false`
and NOT auto-landed; clean lane + passing cmd → `ok:true` + landed; no cmd set → field
absent + today's clean-path behavior unchanged. Mutation-grade: each test fails when the
verify call or its gate is commented out.

Verify: tsc + collision-immune e2e scratch copy, tail "ALL PASS" (1 known flake OK).
Heads-up: lane V2 follows in this same server.ts region — commit clean, no untracked
files, report only the slice.

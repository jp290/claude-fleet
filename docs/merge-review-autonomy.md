# Merge verification, review support, and provenance — design note

*Design note 2026-07-23 (JP + session). Verification-first upgrade of the land pipeline:
close the no-build-no-test gap, make the resolver's work reviewable, and make the landed
artifact carry its own review story ("own your work"). Sits under
`steward-intelligence.md` (facts outrank claims) and beside `steward-arena.md`. Line refs
cite `52ced56` — **grep the symbol before relying**, server.ts lanes drift refs fast.
NOT built; this note is the spec the lanes are briefed from. Explicitly out of scope:
any autonomous land, any self-land route — the human lander stays (OWNER.md §4b).*

## 1. The verified gap (the reason this note exists)

No land path builds or tests the tree it lands. All three verify **git-structurally
only** (clean tree + `merge-base --is-ancestor`):

- Clean path: `mergeJob` script-rebase → ff → land (`mergeJob` in server.ts). No tsc, no tests.
- Conflict path: resolver agent → git-verified → "resolved" verdict (`:2259-2266`). The
  agent is *forbidden* to build/test (`runMerge` prompt, `:2193`) — deliberate, it keeps
  the agent surface minimal; but nobody else verifies either.
- Confirm-land: pure ff of the reviewed resolution (`:3723-3752`). No build, no tests.

"Believe git, not the agent" proves the rebase *happened*, not that the result *works*.
The human reviews an **unbuilt diff** — and the semantically riskiest lands (conflict
resolutions) are exactly the unverified ones.

## 2. The three layers (who is allowed to conclude what)

1. **Deterministic verification — the authority.** Server-run against the rebased tree;
   its result is a fact in the verdict. Never an agent's self-assessment.
2. **Resolver self-report — advisory.** The one existing resolver pass, upgraded from
   free-prose `detail` to a structured report (below). Claims, labeled as claims,
   cross-checkable against layer 1. **No second briefer agent** — a reviewer grading its
   own homework adds cost, not independence; independence comes from layer 1 + the human.
3. **The irreducible human core.** A conflict whose correctness a test could catch would
   be a test, not a conflict. The rest — both sides present, combination violating one
   side's intent — is definitionally beyond verification. The system's job is **triage**:
   clear the verifiable mass mechanically, route the semantic rest to the owner as a
   *specific question*, never eliminate him. Resolver ≠ Reviewer ≠ Lander, always.

## 3. Piece V1 — deterministic verify in `mergeJob` (first lane)

After the git-verified rebase (clean AND resolved paths), the server runs a per-repo
verify command against the rebased worktree and writes the result into the verdict:

- `MergeLast` gains `verify?: { cmd: string; ok: boolean; out: string /*tail, capped*/;
  at: number; mainSha: string }`. `mainSha` = the main the tree was rebased onto —
  a briefing/verdict is void once main moves past it.
- Command resolution: per-repo config (env `FLEET_VERIFY_CMD` default for the fleet repo:
  the CLAUDE.md tsc line). No config → `verify` absent, verdict says "unverified" —
  **absence is visible, never silently green.** Timeout (~120s), non-zero exit → `ok:false`.
- tsc ONLY in V1. The isolated e2e suite is phase 2 (own SOCK/PORT scratch-copy per run —
  the shared-socket hazard makes naive reuse actively destructive; that infra is the real
  cost and its own lane).
- UI: the land overlay shows verify state; a red verify does NOT hard-block the owner
  (owner latitude, OWNER.md §4a) but defaults the button away from ⏏.
- Done-criterion: e2e — a lane whose rebase breaks tsc shows `verify.ok:false` in the
  verdict; a clean one shows `ok:true`; a repo with no verify cmd shows absent + labeled.

## 4. Provenance — the record dies at land today (verified)

`mergeLast` is deleted at confirm-land (`:3750`), on recycle (`:1038`), superseded on
re-run (`:3773`). Post-land, only `undoLast` (one per repo, overwritten next land) and
the kept branch survive. The story — what conflicted, how the resolver chose, what was
verified, what the human saw — evaporates at exactly the moment it becomes history.

**Piece V2 — server-written git note at land time.** On every land, the server (the
trusted writer) attaches the full package to the landed tip:
`git notes --ref=fleet/land add -m <json> <tip>` in the repo, JSON = `{branch, mainBefore,
mainAfter, conflicted?, resolverReport?, verify?, confirmedByHuman: bool, at}`.

Why notes, not the alternatives considered:
- **Agent-written commit message/trailer — rejected as primary.** (a) It puts *claims*
  into permanent history authored by the untrusted layer; (b) it's written before
  verification exists; (c) rebase folds resolutions into pre-existing commits, so the
  agent would have to rewrite commits mid-rebase — error-prone and it expands the
  deliberately minimal resolver git surface. The resolver's *structured report* (§5)
  feeds the note instead — same content, trusted writer, post-verification.
- **Audit event — secondary only.** `audit.jsonl` rotates (the Tier-0 #3 lesson: counts
  that scan a rotatable file silently reset). Fine as a pointer, wrong as the record.
- **fleet.json — wrong home.** Per-slot, recycled, unbounded growth if kept forever.
- Notes alter no SHAs (ancestry gates unaffected), dirty no tree (block no land), ride
  the repo (survive server restarts, rotation, reinstalls), and are readable by any
  future session: `git log --notes=fleet/land`. They are not pushed by default — fleet
  is local-first, acceptable; document it.
- Done-criterion: e2e — after a land (clean AND confirm paths), the note exists on the
  landed tip and parses; after undo-land, the note survives as the record *that* it
  happened (never deleted).

## 5. Piece V3 — resolver report contract + conflict capture (the briefing half)

- `runMerge` contract grows: `{"status", "detail", "resolutions": [{file, choice:
  "ours"|"theirs"|"merged"|"rewrote", why, unsure: bool}]}` — capped, advisory,
  injection-scanned like all agent JSON. `unsure:true` files are the owner's specific
  questions (§2 layer 3).
- **Conflict material must be captured at resolution time** — after the rebase the
  conflict no longer exists anywhere (the resolved tree is clean; `tryScriptRebase`
  aborts its probe). `mergeJob` snapshots the conflicted hunks (base/ours/theirs,
  byte-capped) from the probe before the agent runs, into the verdict. Without this no
  reviewer — human or machine — can ever see the *question*, only the answer.
- Client: the land overlay renders report + hunks + verify state as the briefing.

## 6. Hard rules (the traps that would otherwise bite later)

1. **Harness-conflict circularity:** a conflict *inside the test files* means "suite
   green" tests the resolution against itself. Verdict must mark
   `conflictTouchesHarness: true` → always human, never briefing-cleared. (Live case:
   lanes B and C both touch `fleet-e2e.ts`.)
2. **Coverage honesty:** green ≠ correct — resolved hunks may sit in untested paths.
   The briefing states what verification *reached*, never bare pass/fail.
3. **Complacency + staleness:** briefings that usually say "green, low risk" get rubber-
   stamped one level up. Counter: easy case low-ceremony, hard case unskippable (per-hunk
   question). `mainSha` binds every briefing; main moved → briefing void (the ancestry
   gate at `:3730` already refuses the stale *land*; the briefing must self-invalidate too).
4. **Verification runs server-side, in the lane worktree, against the rebased tree** —
   never inside the resolver agent, never against pre-rebase state.

## 7. Order + status

V1 verify-in-verdict (small lane, immediate value on every land) → V2 provenance note
(small lane, "own your work" made literal) → V3 report contract + hunk capture + overlay
(the briefing, larger, client+server) → e2e-verify infra (own lane, the expensive one).
Track-record wiring (does the briefing predict well enough to earn a ladder rung — the
outcome-fuel pattern applied to briefing accuracy) is deliberately deferred until V1-V3
have lived. Status 2026-07-23: nothing built; V1 is the next lane after the assessment
lanes (A/B/C) land.

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

**Status 2026-07-24 (verify before trusting — grep the symbols):**
- **V1 verify SHIPPED + DEPLOYED.** `runVerify` + `FLEET_VERIFY_CMD` (the CLAUDE.md tsc line)
  runs server-side against the rebased tree on both paths; a red clean-rebase downgrades to
  `"resolved"` (owner latitude stands, §4a). `mainSha` staleness is stamped, not blocked (a
  re-run would hang the land on the suite runtime — a *considered* decision; don't "fix" it to
  a hard block). This is live on `srv` as of 2026-07-24 15:38.
- **V3 briefing — INPUT half shipped, OUTPUT half remains.** `runMerge`'s prompt was extracted
  to a pure `buildMergePrompt()` (`merge-prompt.ts`) and given main's intent (`git log
  mergeBase..main` — the "theirs" side it used to reverse-engineer), ours/theirs orientation, a
  hard *edit-only-conflict-hunks* scope-rule (forecloses a real whole-file mangle), and
  verified-contract awareness — strictly additive, unit-tested for presence + the DATA-block/JSON
  invariants (the agent's *effect* is unfakeable behind `FLEET_MERGE_CMD`, so no e2e claims it).
  STILL TODO for V3: the structured `resolutions[]` output contract + conflict-hunk capture (§5)
  + the land-overlay render. V2 provenance note is ALSO shipped (`git notes --ref=fleet/land`).
- **e2e-verify infra — the blocking flakes are dead** (self-token pane-capture race +
  `waitMerge` load-timeout). *Correction, 2026-07-25:* the self-token fix claimed here was the
  fixed-sleep→poll change, which narrowed the window but did not close it — a dropped `send-keys`
  still left the probe with nothing to read. It is closed now by `paneEnv()` (`e2e/harness.ts`),
  which retries the send until a unique line-anchored marker renders. Same date: the last
  structural race (auto-③ reviewing a just-recycled slot off the *previous* lane's cached git
  facts, filing an empty "no code changes in scope" review that later read as `superseded`) is
  fixed server-side in `openSlot`. So `e2e-isolated` is now deterministic. **But
  a hard new finding blocks it as a pre-land gate: `e2e-isolated` runs >2 min, past the ~120 s
  `VERIFY_TIMEOUT_MS` — adding it to `FLEET_VERIFY_CMD` would time-out every land.** So §3's
  "phase 2" is not "add e2e to the gate"; it is a **TIERED gate**: a fast-deterministic tier
  (tsc + the quick `e2e-claude-gate`) gates the land; the slow full suite runs as a *post-land
  audit* (or async), with undo-land as the rollback. Grep `VERIFY_TIMEOUT_MS`.
  **2026-07-24 — fast tier SHIPPED to the repo (`b30c746`, `watchdog.sh` `VERIFY_CMD` now
  `tsc && ./e2e-claude-gate.sh`), ~~NOT yet deployed~~ DEPLOYED** — corrected 2026-07-25: the
  live `srv` (started 2026-07-25 00:16:54) carries a `FLEET_VERIFY_CMD` identical to
  `watchdog.sh:38`, so the kickstart happened.
  ~~Validated to run in `runVerify`'s context WITHOUT `node_modules` (the lane-worktree
  condition — `server.ts` imports only `node:`/`bun:`/local, so it boots with no npm): ALL PASS
  from a `node_modules`-less tree in ~46 s (< the 120 s timeout).~~
  **Refuted 2026-07-25 — the validation covered only the second half of the `&&`.** `--types bun`
  needs `@types/bun`, a devDependency living in gitignored `node_modules`; a lane is created by
  `git worktree add` alone, with no install step, and `runVerify` runs with `cwd` = that lane
  worktree. Reproduced on the tracked files at HEAD with no `node_modules`:

  ```
  $ git archive HEAD | tar -x -C $S && cd $S
  $ sh -c 'bunx tsc --noEmit --strict … --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts'
  error TS2688: Cannot find type definition file for 'bun'.
  exit=1 elapsed=2s
  ```

  So in a lane without `node_modules` the gate short-circuits in ~2 s and never reaches
  `e2e-claude-gate.sh`; "~46 s < the 120 s timeout" describes a run that does not happen. It
  fails **closed** — a good rebase is downgraded to stop-for-human and `verified:false` enters
  the outcome ledger — so the cost is a red that means nothing and land-calibration data that
  silently depends on whether a lane happened to install. **Both directions are on record:** ledger
  row 3 (`perception-write`) shows `verified: true` with `confirmedByHuman: false` — a clean
  *auto*-land whose verify demonstrably ran, so "the step cannot run in a lane" is too strong. But
  *why* it ran is unrecoverable (the worktree is torn down at land), and nothing in Fleet creates
  `node_modules`: `createWorktree` copies only `.env`, `CLAUDE.md`, `.claude/settings.local.json`,
  and a lane worktree has none unless its agent installed one. *(An earlier "3 of the 5 worktrees"
  ratio was measured over directories, not `git worktree list`, and it moves with every land — the
  durable fact is that nothing in Fleet creates it.)* So the gate's first step turns on a state nothing
  establishes — its green is **luck-dependent and unexplainable after the fact**, which is worse
  than simply broken. Full adjudication incl. the refuted mechanism: `discrepancy-audit.md` F9.
  **FIXED 2026-07-25 (`cffa4a5`, deployed same day):** `VERIFY_CMD` now prepends
  `bun install --frozen-lockfile`, proven in both directions in a fresh never-built worktree
  (exit 0 clean / exit 1 on a planted type error) and in production — two `node_modules`-less
  lanes landed `verified: true` through the new gate the same hour.
  Honest scope: `e2e-claude-gate` boots the whole server + drives slots/autos/
  dispatch/model/steward routes, so module-load/boot regressions tsc misses are caught — but it
  does NOT assert the share/guest or audit paths — **nor any rendering: there is no DOM harness,
  so client changes are asserted only by regex over `src/client.ts` source** (three lanes said so
  independently 2026-07-25). Client-heavy work therefore carries risk no tier of this gate can
  see; keep autonomy-adjacent scope server-side until a DOM harness exists. So it is
  **total-ENOUGH, not total**. That gap
  is exactly what the post-land `e2e-isolated` audit still covers. `e2e-isolated` stayed OUT of the
  gate while its ~600 ms pane-capture flake barred a deterministic gate. **That flake is fixed
  (2026-07-25** — `paneEnv()` in `e2e/harness.ts` retries the send-keys and matches a unique,
  line-anchored marker; the auto-③-on-a-just-recycled-slot race that produced the other
  intermittent review-state failures is fixed in `openSlot` by dropping the stale `gitInfo`
  entry**)**, so the "flaky" objection to gating on it no longer holds. What still bars it is
  RUNTIME, not determinism: the suite is minutes long and the gate is meant to be fast.
- **§6 hard-rule #1 live-confirmed:** the flake and resolver lanes both touched `fleet-e2e.ts`;
  verified their hunks don't overlap (~653 vs ~1–90) before landing in order. The harness-conflict
  trap is real; disjoint-region checks are the mitigation until `conflictTouchesHarness` exists.
- **Resolver↔verify REPAIR LOOP shipped (`ee4670f`), not yet deployed.** When a CONFLICT resolution
  rebases clean but the deterministic verify fails, the resolver is now fed the exact failure and
  gets up to `FLEET_MERGE_REPAIR_ROUNDS` (default 2) bounded repair rounds instead of dead-ending at
  a red verdict. `buildRepairPrompt()` (pure, unit-tested) leads with `REPAIRING`, forbids re-rebase,
  carries the verify output as injection-safe DATA, hard-scopes to the reported failure. Authority
  every round is git + a re-run of `runVerify`, never the agent's word; an uncommitted repair is
  `reset --hard`'d away so the human never gets a dirty tree. **This never changes what auto-lands** —
  the conflict path always stops for human review (`landed:false`); the loop only turns the reviewed
  verdict from dead-red to repaired-green. That is *why* it was safe to ship without owner sign-off on
  the auto-land path: it doesn't touch that path. `repairRounds` is recorded on the verdict. Deploy =
  `tmux -L claudefleet kill-session -t srv` (server.ts change; no kickstart).

**② clean-path advisory reviewer SHIPPED + DEPLOYED, OFF by default (`a23b1ea`, live 19:11).** Closes
the last unattended-regression gap — the **clean auto-land path** (`mergeJob`, `pre.clean && verify.ok`
→ `advanceIntegration` with `confirmedByHuman:false`), the only path that reaches main with no human and
where no resolver runs. `FLEET_CLEAN_REVIEW` (default OFF → prod byte-for-byte unchanged, proved by the
whole `e2e-isolated` suite passing with the flag unset). When ON, a reviewer agent sees the lane diff +
main's new commits and may **only DOWNGRADE the auto-land to a stop-and-review — never land more.**
Structural, not incidental: `landed:true` is reachable ONLY on an explicit `{"verdict":"ok"}`; every
other outcome (review / timeout / throw / unparseable / no-base) **fails CLOSED** to the same resolved-
stop a red verify uses, so landing is unreachable from any reviewer failure mode. Read-only by contract
(HEAD captured + `reset --hard` after). `buildCleanReviewPrompt` pure + unit-tested; own isolated harness
`e2e-clean-review.sh` (mirrors claude-gate) proves review→stop / ok→land / broken→fail-closed. Advisory
FACTS on the verdict + the lane-outcome ledger, never a gate.
**STATUS CORRECTION 2026-07-25: the flag is three-valued (`off` | `shadow` | `1`/`gate`,
`server.ts` grep `FLEET_CLEAN_REVIEW`) and production runs `shadow`** (`watchdog.sh` srv-spawn
line, commit `9032845`) — so the "default OFF → prod byte-for-byte unchanged" sentence above
describes a state that ended on 2026-07-25 13:00. Setting `=1` promotes it to a live gate **and
terminates the K2 shadow collection** that graduation-criteria §2 requires (N≥25; as of
2026-07-25: 0 valid, 4 × `raw:true`). Enabling the gate is therefore a graduation decision, not
a config toggle. **①a land-shape ledger enrichment also shipped (`626fe5d`)**: the `landed`
outcome record now carries `{resolvedConflict, repairRounds, confirmedByHuman}` — the calibration
signal for a future graded gate.

**Autonomy status (2026-07-24): substrate built, NOT autonomy itself — and accumulation is stalled.**
Repair loop + tiered gate + ①a ledger + ② reviewer + existing undo-land together are the *prerequisites*
`lane-autonomy-future.md` demands (reversibility + documentation + a calibration ledger). The one move
that would ADD autonomy — graded auto-land of *conflict* resolutions (component 5) — is deliberately
deferred until the ledger has revert data to set the gate from. The ledger was EMPTY through 2026-07-24
midday — outcomes emit ONLY from Fleet's own land/kill/shelve/undo routes, so `git merge` hand-lands
recorded nothing. **Resolved the same evening**: `fleet/review-agent` was dispatched as a lane and landed
through Fleet (`7e5c777`), writing the first real row.

**③ the `🔍 review` agent shipped in that lane (`ab59a71` + `7e5c777`)** — owner-only, click-only,
advisory `POST/GET /api/slots/:id/review` mirroring the ✨ summarize plumbing over the slot's OWN diff;
uncited findings are dropped server-side and `basis` never self-upgrades to `verified`. It gates nothing
and is deliberately absent from the guest share surface.

**Open defect — the landed rows are NOT yet trustworthy.** That first row zeroed its whole calibration
payload (`commitCount 0`, `filesTouched []`, `verified null` for a 2-commit / 5-file land). Root causes
and scope: see `lane-autonomy-future.md`, the 2026-07-24-later status note. Both sit on the clean
auto-land path. **Do not set the graded gate from ledger data until that fix lands.**

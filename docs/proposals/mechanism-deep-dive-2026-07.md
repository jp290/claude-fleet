# Mechanism deep-dive — verified findings + lane plan (2026-07-23)

*Handover artifact for a fresh session. Produced by a two-stage critical assessment (docs-level,
then code+runtime-level with two parallel deep-read agents) of the program's most ambitious
mechanisms. **Every finding below was re-verified at HEAD `6a66d4f`** (after the P1 e2e
concurrency fix landed) via symbol grep — anchors are symbols + grep patterns per the P2
convention; line numbers, where given, were true at `6a66d4f` and drift. Sits beside
`learning-engine-next-steps-2026-07.md`: these lanes ARE the Ground-axis continuation that doc
calls for — deterministic fixes that widen verification coverage (Governor #2). Nothing here is
applied; the owner promotes lanes.*

**Runtime facts the findings rest on (read 2026-07-23, re-check before building):**
`fleet.json`: `outcomeTally = {}`, `outcomePending = []` — the outcome pipeline has classified
**zero** production events. `audit.jsonl`: **zero `steward_send` events ever**; the steward's 11
journal records are all `kind:"rundgang"` (observation pulses, 8 decisions surfaced total, sent
via a 2h perpetual auto). All 3 tasks in the queue are owner-created (`origin:null`) — the
steward pending-task route (`POST /api/steward/tasks`) has never been used in production.

---

## Findings

### F-A — The glance-approval hole in the merge/land spine (3 parts, safety-relevant)

Context: the land spine's deterministic core is strong (clean-tree + ancestry re-verification of
every agent claim + ff-only; grep `merge-base --is-ancestor`, `landLane`, `advanceIntegration`).
The doctrine's promise is "prepare the irreversible decision so approval is a glance"
(`steward-intelligence.md` §1). These three holes sit exactly on that glance:

1. **Main can move with neither provenance note nor undo record.** Order in `mergeJob` (clean
   path) and the confirm-land route: `advanceIntegration` (moves main) → `landLane` (tears down
   worktree/slot) → `recordLand` **only if landLane succeeded** (grep `advanceIntegration` then
   follow both call sites; the guard is `if (!("error" in land)) await recordLand(...)`).
   If teardown fails after main moved (worktree freshly dirty → `removeWorktreeSafe` refuses;
   slot recycled mid-job), the route returns an error — owner reads "not landed" — but main IS
   ff'd, and neither the `refs/notes/fleet/land` note nor `undoLands` exists. Violates the
   stated invariant "a note on every land that moves main" (comment above `recordLand`).
   Untested: no e2e for "advanceIntegration ok, landLane fail".
2. **Stale verify at confirm-land.** `runVerify` stamps `mainSha` into the verdict ("binds the
   result to the main it verified against" — comment above `runVerify`), but **no code ever
   compares it**: grep `mainSha` — written in `runVerify`/`mergeJob`, stored in `MergeLast`,
   reused only as `mainBefore`. The confirm-land route replays the branch when main has moved
   (rebase-replay block in the merge route) and lands **without re-running verify**; the note
   then records a green verify that never saw the landed state. The comment "a verdict is void
   once main moves past it" is prose, not code.
3. **Verify is invisible in the review UI on the conflict path.** `src/client.ts`
   `interface MergeState` has no `verify` field; grep `verify` in client.ts hits only an
   unrelated `UNKNOWN_RISK` string. A conflict-resolved lane with `verify.ok:false` renders
   "conflicts resolved — review, then land"; confirm-land never blocks on red verify
   (deliberate — owner latitude), so the owner can glance-approve broken code without the one
   deterministic signal ever reaching their eye. (The clean path at least downgrades to
   stop-and-review with "verify failed" in `detail`.)

Also verified fixed (do NOT redo): F1 pre-land review is now fail-closed (`showLandReview`
renders "landing is disabled" + retry on any fetch/JSON failure); the three F2 gate proofs and
F5 recycle hygiene landed via lanes A/B/C.

### F-B — Outcome attribution: `helped` measures slot activity, not intervention effect

Context: per steward send, `handleStewardSend` parks a baseline (git ahead/dirty +
`outputBaseline` + `aliveBaseline`), persisted atomically, restart-safe. `measureOutcomes`
(end of every `tickGit`) classifies at window close (10 min default).

1. **No causal attribution.** `helpedGit = gi.ahead > baseline.ahead || gi.dirty !==
   baseline.dirty` — ANY commit, or any dirty-count change **including decreases** (`git
   checkout .`), counts. `helpedOutput = lastOutput > sentAt + OUTCOME_SUSTAIN_MS` — a single
   output blip at t=61s counts. On an actively working slot (the normal nudge target), `helped`
   is near-guaranteed. A ladder promoted on this data measures that the slot was alive.
2. **`outputBaseline` is persisted but never read.** Grep `outputBaseline`: declaration,
   persist, restore — zero reads in classification. The documented semantics ("began after the
   send and sustained ≥60s", comment in `measureOutcomes`) is not implemented. This path also
   has no positive e2e (the shrunk test window makes it unreachable; the code says so:
   "every helped in a shrunk-window test is via the git signal").
3. **The harm attest is a permanent global latch.** One `POST /api/steward/outcomes/harm`
   `{attest:true}` sets `harmChannelActive = true` forever, for all classes, persisted — no
   expiry, no re-attest. After that, "harm-aware record" in `promotionEligible` is
   informationless.

**Why now:** the tally is empty (see runtime facts). Every semantic correction is free today;
after the first promotions it is a data amnesty.

### F-C — The measurement asymmetry / the propose-fuel bridge

The steward's measurable production output = 11 rundgang observation pulses. Its actually
valuable output this week (sharpen-corpus mining, lane briefs, doc work) ran conversationally in
its pane — invisible to the outcome machinery. What is measured (sends) it never uses; what it
uses is never measured. The ladder can never earn fuel this way, regardless of steward quality.

**The bridge, from three already-built parts:** rundgang pulses already surface decisions
(8 so far, free-text in journal notes) → route them through the existing, never-used
`POST /api/steward/tasks` (hard-forced pending, capped) as typed proposals → owner
promote/dismiss of such a task is a **causally clean, deterministic outcome event** for the
`propose` class — unlike git deltas, accept/reject is attributable. No new infrastructure
category; mostly a `/rundgang` prompt change + a small outcome-wiring increment.

### F-D — Minor (fold in opportunistically, no own lane)

- Async digest (landed `e6c1897`, deployed): cache is not invalidated on a new journal write
  (irrelevant at the 2h beat; note it in code if touched) and the "`curl -m` must be ≥ `?wait`"
  invariant lives only as a comment.
- `runVerify` kills on timeout with SIGTERM only — a TERM-ignoring verify process holds
  `await p.exited` and the mergeJob indefinitely. One-line SIGKILL escalation if touched.
- One global `FLEET_VERIFY_CMD` for all repos (live cmd self-guards with
  `[ -f fleet-e2e.ts ] || exit 0`) — fine for now, becomes wrong on the first non-fleet repo
  with its own suite.

---

## Lane plan (independently landable; ordering is load-bearing)

Standard verification for every lane (suites are now concurrency-safe at HEAD, run directly):
`bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts`
&& `bun run build` && `./e2e-isolated.sh` && `./e2e-claude-gate.sh` (tail "ALL PASS", ≤1 known
pane-capture flake). Server-touching lanes need the deploy step after land (owner):
`tmux -L claudefleet kill-session -t srv`.

### Lane G1 — land provenance survives teardown failure + stale-verify guard  *(server, first — highest safety value)*
- **Scope:** (1) couple `recordLand` to the main-move, not the teardown: write note + undo
  record immediately after a successful `advanceIntegration` on both paths; report a subsequent
  `landLane` failure as its own error field WITHOUT losing the record. (2) At confirm-land:
  if `mergeLast.verify` exists and `verify.mainSha !==` current main after replay, either
  re-run verify once or return the verdict marked `verify:"stale"` so the client can show it —
  implement what the "verdict is void" comment already claims. NOT in scope: client rendering
  (G2), any verify-blocking of land (owner latitude stands).
- **Done:** new e2e — (a) simulate advance-ok/landLane-fail (dirty the worktree post-advance or
  recycle the slot) → note + undoLands entry exist, route reports the cleanup error distinctly;
  (b) move main between verify and confirm-land → landed note carries fresh/marked verify,
  never a silently stale green one. Suites ALL PASS.

### Lane G2 — verify reaches the owner's eye  *(client, independent of G1)*
- **Scope:** add `verify` to `MergeState` in `src/client.ts`; render a compact badge in the
  land-review overlay and merge row (green `verify ✓` / red `verify ✗ (view output)` / absent =
  "unverified"); red never disables the button (latitude), it only informs. Bundle rebuild.
- **Done:** e2e or DOM assertion that a `verify.ok:false` conflict-path verdict renders the red
  badge in the review overlay; suites ALL PASS + `bun run build`.

### Lane A1 — honest `helped` semantics + attest staleness  *(server, BEFORE any propose fuel)*
- **Scope:** (1) `helpedGit` → `ahead` increase only (drop dirty-delta). (2) implement the
  documented output rule using the already-persisted `outputBaseline` (output began after send
  AND sustained ≥ `OUTCOME_SUSTAIN_MS` — needs a cheap "still emitting at close" or
  activity-span check, keep it to a few lines). (3) `harmChannelActive` → `harmAttestAt`
  timestamp; `promotionEligible` requires attest within a staleness window (env, default ~14d).
  Keep field names/API shape additive; migrate the persisted boolean on load. NOT in scope:
  null-calibration (A2), any new sensor framework (the keystone lesson: grep, not framework).
- **Done:** e2e value-assertions for: dirty-only change → `noEffect`; the sustained-output
  positive path (shrink `OUTCOME_SUSTAIN_MS` via env for the test); stale attest → not
  eligible, fresh attest → eligible. Existing outcome tests updated, suites ALL PASS.

### Lane A2 — null-calibration `baselineRate`  *(server, optional, after A1 proves out)*
- **Scope:** at window close, run the same classifier read-only over up to 2–3 active,
  NOT-nudged slots; keep a small rolling tally and expose `baselineRate` on
  `GET /api/steward/outcomes`. Advisory number only — never gates. A few dozen lines.
- **Done:** e2e — a busy un-nudged slot raises `baselineRate` while `outcomeTally` is
  untouched; suites ALL PASS.

### Lane B1 — rundgang decisions become typed pending tasks  *(prompt + thin server, AFTER A1)*
- **Scope:** `/rundgang` (steward worktree copy + `~/.claude/commands`) — each surfaced
  decision that asks for owner action is ALSO filed via the existing self/steward task route as
  a pending task (text = one-line decision + pointer); journal note references the task id.
  Server: count owner promote/dismiss of steward-origin tasks into the outcome tally as class
  `propose` (deterministic, causally clean). Respect the existing caps; no new routes.
  NOT in scope: any auto-promotion, any change to the pending gate.
- **Done:** e2e — steward-filed task promoted → `outcomeTally.propose.helped` +1; dismissed →
  `noEffect` (or a distinct field — executor's call, argued in one line); suites ALL PASS.
  Plus one live rundgang pulse after deploy actually files a task (owner observes).

**Ordering rationale:** A1 before B1 — B1 generates the first real tally entries; they must
land on corrected semantics (empty tally = free fix, filled tally = amnesty). G1/G2 are
independent of the A/B track and each other; G1 first overall because it guards the one
permanently human-gated action. A2 anytime after A1. F-D folds into whichever lane touches the
neighboring code, else stays parked.

**Parked (tracked elsewhere, do not fold in):** the sharpen hold-out pass — the premise-level
measurement (docs-level report finding #1; `learning-engine-next-steps-2026-07.md` parks it
without a trigger — the owner should give it one); P2 symbol-anchor sweep (landed `a9e7cab` just
before this doc — its convention is what this doc's anchors follow); the pane-capture e2e flake.

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
- **Scope:** `/rundgang` (`.claude/commands/rundgang.md` — **git-tracked IN this repo**, so it is
  fully lane-able/revertable; the steward worktree holds its own checkout of the same file. An
  earlier draft of this line said `~/.claude/commands`; that path does not exist — corrected
  2026-07-23) — each surfaced
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

---

## B1 status 2026-07-23 — prompt half deliberately NOT shipped; lane B1b (server de-dup) must come first

B1's server half is live (`taskAct` counts `propose.helped`/`propose.dismissed` on the
`pending →` transition of steward-origin tasks, once each). The `/rundgang` prompt edit that
would feed it was assessed and **stopped before editing**: per-pulse de-dup cannot be done
soundly prompt-side. The argument:

1. **The pulse cannot read ground truth.** There is no GET on `/api/steward/tasks`
   (server.ts:3171 is POST-only) — the steward can never see its own open proposals. The only
   prompt-side carriers are the journal `note` (≤280 chars, server.ts:3230) and
   `GET /api/steward/journal?tail=N`, i.e. free text chained across pulses by LLM discipline.
   Identity matching would be prose-vs-remembered-prose with no stable key.
2. **The failure mode poisons the measurement it feeds.** A standing decision (a lane
   `awaiting-human` for days) re-files every 2h the moment one chain link drops; duplicates
   either 409 at `STEWARD_MAX_PENDING` forever or get dismissed by the owner — and every such
   dismiss counts `propose.dismissed`. The tally would measure the system's own duplication,
   not proposal quality, exactly the fuel A1 was just corrected to keep honest. A prompt-side
   guard whose failure silently corrupts the outcome ledger is the textbook case for
   "deterministic gates beat prompt discipline."
3. **Found while checking: the delta anchor already has a B1-SERVER side effect.**
   `readStewardJournal` (server.ts:2962) returns records of ANY kind, and the B1 server half now
   writes `kind:"propose_outcome"` records (server.ts:4125) into the same journal — so the
   digest's `prior` (server.ts:3106, tail 1) can return a propose_outcome record instead of the
   last rundgang record, breaking the pulse's diff baseline whenever an outcome lands between
   pulses. Needs fixing regardless of the de-dup question.

### Lane B1b — deterministic de-dup substrate  *(spec below is sound; its **timing** was revised — see note)*

> **Revision 2026-07-23 (later):** this lane is no longer "must precede the prompt edit" as a block.
> Two facts changed the calculus (both verified; recorded in `BACKLOG.md` → the register): (a)
> **there is no ladder** — `promotionEligible` is read only by two read-only status endpoints, so
> the tally this lane protects has **no consumer yet**; (b) nobody has ever seen a steward proposal,
> so the de-dup *shape* is being designed against zero observations. **Scope item (3), the digest
> `prior` filter, is split out as P-1a and should ship now** — it is a real bug in deployed code,
> not de-dup. The rest (GET, `ref`, `mute`) is gated on the register's fork P-3: probe first and let
> the observed duplicates shape it, or build it up front. The spec below stays valid either way.
- **Scope:** (1) `GET /api/steward/tasks` → `{ open: [steward-origin pending: id, text, ref,
  created], resolved: [last ~20 steward-origin non-pending: id, text, ref, status] }` — ground
  truth for "already filed" and "owner already judged this". (2) optional `ref` on the POST
  (≤40-char slug, e.g. `slot3:awaiting-human`); if an OPEN pending steward task carries the same
  ref → return that task with `dedup:true`, 200, no create, no cap consumption — the
  deterministic backstop under fuzzy prose matching.
  (3) ~~digest `prior` anchors on the last `kind:"rundgang"` record, filtered, not the last record
  of any kind.~~ **SHIPPED as P-1a, 2026-07-24** (`readStewardJournal(tail, kind?)`, both digest
  call sites filtered, e2e-gated). Note for the rest of this lane: the journal is multi-kind from
  *six* writers, and the one that fires today is `measureOutcomes` (`kind:"outcome"` per matured
  steward send) — not only B1's `propose_outcome`.
  (4) **`mute(ref)` — the recurring-proposal blocker (owner-raised 2026-07-23).** A dismissal
  answers *this instance*; a proposal whose condition persists (a lane `awaiting-human` for days)
  would legitimately re-qualify every pulse forever. That needs an explicit owner verb, NOT an
  inferred "has it materially changed" predicate — the latter is an LLM judgement and lands back
  on the statistical tier this whole lane exists to leave. So: **dismiss** = "no, not this
  instance" → counts `propose.dismissed`; **mute(ref)** = "stop proposing this" → a suppression
  list; later POSTs with a muted ref return `suppressed:true`, no create, no cap consumption.
  Three constraints: (a) **a mute must NOT write a tally event** — if muting counted as a
  dismissal, the act of silencing the system would depress its own proposal-quality number, i.e.
  the control corrupts the measurement; (b) mutes must be **listable and reversible** (unmute),
  or proposals vanish silently and the owner gets a "why didn't it tell me about X" mystery;
  (c) it reuses B1b's `ref` as the key — no second identity concept.
  NOT in scope: the prompt edit itself, any change to caps or the pending gate.
- **Done:** e2e — same-ref double POST → one task + `dedup:true`; GET shape with open/resolved
  split; a propose_outcome write between pulses does not change digest `prior`; a muted ref POST
  → `suppressed:true`, no task created AND `outcomeTally.propose` byte-identical before/after;
  unmute restores filing. Suites ALL PASS.
- **Then** the B1 prompt edit becomes a genuinely minimal diff: read GET before filing, file
  only decisions not already open (ref as key, text as tie-break), skip decisions the owner
  already dismissed, reference filed ids in the journal note, treat 409 as "surface in prose
  only". The anti-manufacture guard (rundgang.md lines 5 and 25) stays verbatim; "all clear"
  files nothing by construction because filing is downstream of section 1, which stays empty.

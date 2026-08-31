# Program transitions — the one implementation brief (synthesis, 2026-08-23)

Program `4aa3ed1c` (slot 3). Synthesised from three peer-reviewed arms, all read at their final
commits: GLM simplicity review (task `2e545633`, pane report), Fable causal audit
(`fleet/260823111940-b6a6` @ `b5109df`, incl. its peer review of GLM), GLM causal audit
(`fleet/260823111941-e426` @ `b6ddc5a`, incl. §12 answering Fable). `docs/promotion-policy-v1-2026-08-23.md`
(`6b4b01a`) is an unpromoted hypothesis; this brief supersedes it where they differ (§3).

## 0. What the three arms agree on (no structural disagreement)

- The Worker→Watch→MAIN→Attention chain works and is used; the autonomy gap is **two missing
  machine transitions at the ends of an Act**: START (tick `return` on a foreign repo's cap,
  `server.ts:7628`) and LAND (single `mergeJob(` call site behind the owner route, `:18780`/`:19076`).
- Product repos fall out of the verify gate (`exit 42` → `verify.ok:null` → confirm click); the only
  fix is an owner-stored entry in `FLEET_VERIFY_CMD_REPOS` (`.env`), prerequisite to any land policy.
- Provenance: `LandProvenance` (`:10640`) names no actor; one ambient-token land (`9cc8b1e`) and
  three direct main commits today are ledger-indistinguishable from owner acts.
- Design choice: **guarded MAIN self-land** (apply); tick auto-land (unsupported — `done-looking ≠
  reviewed`, and the tick must never call `mergeJob`); Supervisor-as-lander (not applicable).
- Trim of `6b4b01a`, adopted by both peer reviews: drop `maxPerDay`, `confirmedVia`, the
  `state.sh` sensor; keep policy record, ordered refusals, `actor`, suspect flag, pins.
- The phase model is a **projection over existing facts, never an actuator**: five phases
  READY · RUNNING · REVIEWABLE · OWNER_GATE · CONTINUE (GLM adopted Fable's cut; INTEGRATING maps to
  `mergeStart`/`mergeInflight`); `audit:unknown` (exit 42) is CONTINUE-with-reason, never OWNER_GATE.

New fact from this synthesis (measured on slot 20, 3× refused): `POST /api/self/fleet-report` derives
its receiver in `clarificationReceiverFor` (`:~5715`) from **lane-watch evidence** when the task has
no `programId`; two watchers (Supervisor slot 1 + this MAIN slot 3) → `lane-watch evidence names
multiple receiver occupants` → the typed report never arrives and the commits become the report.
The receiver of a worker report is a fact of the Program binding, not of who happens to watch.

## 1. The transitions, typed (all on existing rails; nothing here is a new ledger)

| T | Transition | Producer | Authoritative fact (server) | Consumer | Idempotency key | nextAction | Recovery |
|---|---|---|---|---|---|---|---|
| T0 | queued → RUNNING (START) | tick `tickDispatch` | `Task.status:"sent"` + `Task.slot`, `slot_open` audit | MAIN (projection `note`) | `task.id` | none — wait for T1 | row starved behind a foreign repo's cap: tick `return`→`continue` (`ef597073`, filed); `note` shows the reason on the blocked row |
| T1 | Worker → MAIN REVIEWABLE | server predicate `laneWatchSignal` (`lane-signals.ts:92`) **or** lane `POST /api/self/fleet-report` | done-looking (idle+clean+ahead>0) **and lane HEAD sha**; prose is evidence, never the fact | the bound MAIN of `task.programId` | `(task.id, laneHeadSha)` | MAIN reads `git diff main...branch` + report, then T2 | receiver ambiguous → derive receiver from Program binding FIRST, watch evidence only for program-less rows (this brief, commit 1) · lane dies → `lane-outcomes` row + watch disarmed (visible in `GET /api/self`, nothing in the pane) |
| T2 | MAIN adjudication → guarded integration | MAIN `POST /api/self/tasks/:id/land` (no body) | `program.promotion` record + ordered refusals + `mergeJob` verdict (`:13110` three-valued) | `mergeJob` via the new route (second and last call site) | `(task.id, candidateSha)`; while inflight → `{running:true}`; terminal → `mergeLast` | subscribe `{kind:"merge", target}` | every refusal is its own sentence and a MAIN-side repair (dirty/not-done-looking/behind/busy); `resolved`/`ok:false`/`ok:null` are non-land outcomes → T4 `blocked` raised by the MAIN, never a retry loop |
| T3 | land / post-land fact → CONTINUE | server: `landLane` (`:4424`, `sent→done`), `merge-terminal` event, `post-land-audit` event | `fleet/land` note (`actor` present), `lane-outcomes` row (`landedBy`), `post-land-audits` row | MAIN | `mainAfter` sha | file/release the next row (`POST /api/self/tasks`, `/release` — existing doors) | audit red → MAIN investigates in-Program (ordinary); audit unknown (exit 42) → CONTINUE with reason; undo = existing `undo-land` stack (depth 3) |
| T4 | → owner attention | MAIN only (`POST /api/self/attention`) | `AttentionRequest` row, kinds `decision|blocked|review-ready` | owner | existing dedupe (`existing:true`, `:6415`) | owner answers/refuses | **only** for: boundary breach (credentials, spend, irreversible/public effect, deploy) · intent departure after bounded repair+critic rounds · ungoverned red/unknown after those rounds · provenance incident (`owner_token_ambient_use`) · PLAYABLE taste gate (`review-ready` whose text starts `PLAYABLE`, a convention until a sensor field exists) |

Everything between T0 and T4 is machine or MAIN work. A Program with no promotion record keeps
today's behaviour byte-for-byte (T2 refuses `no promotion policy`; the owner lands from the board).

## 2. The projection (derived, no new ledger)

`programExecutionView` (`server.ts:2283`) already joins tasks + `lane-outcomes` + receipts per bound
Program. It gains, per task row, three DERIVED fields and nothing stored:
`phase` (READY|RUNNING|REVIEWABLE|INTEGRATING|OWNER_GATE|CONTINUE, computed from `status`, `slot`
liveness, `laneWatchSignal`, `mergeStart/mergeInflight/mergeLast`, open attention rows) ·
`note` (the tick's `waiting:` reason, today written only on the blocking row — GLM §7(6)) ·
`candidate` (lane HEAD sha when REVIEWABLE/INTEGRATING). `fleetReports`/`attentionRequests` are NOT
read by the view today (Fable §11) — the phase derivation reads them. Consumer: the MAIN's own
"why is my row not running / what is reviewable" question (measured 12:14 in `prompts.jsonl`).

## 3. Where this supersedes `6b4b01a`

Dropped: `maxPerDay`, `confirmedVia`, `state.sh`/`register.sh` sensor line. Schema becomes
`{v:1, selfLand:"off"|"green-only"}` — `verify:"repo-entry"` is the ONLY behaviour, so it is not a
field; the route simply refuses a repo without its own `FLEET_VERIFY_CMD_REPOS` entry. Per-task
attempt cap `FLEET_SELF_LAND_MAX_ATTEMPTS` (default 3, memory-resident, resets on restart — said,
accepted). Kept: owner route `POST /api/programs/:id/promotion` (`{"policy":null}` revokes), loader
danger-direction, the ordered refusals, `actor` on note + `LaneOutcome.landedBy`, the
`owner-token-outside-board` suspect flag + `owner_token_ambient_use` audit event, the pin "exactly
two `mergeJob(` call sites, both routes, zero in ticks". Prevention of ambient-token use remains
UNSUPPORTED (same uid; host sandboxing owner-excluded) and is written as such in `docs/self-api.md`.

## 4. Slices — ordered, each reversible, none blocks Tower/Arcade

- **S0 — owner act, no code, today:** `.env` `FLEET_VERIFY_CMD_REPOS` gains the Tower entry
  (`sh tools/proof-founding.sh && sh tools/proof-briefs.sh && sh game/tools/run-predicates.sh` —
  the Tower MAIN confirms non-zero exit on failure first). Effect: Tower lands become measured
  (2 acts → 1) immediately, on the owner route, before any code lands. Rollback: delete the entry.
- **S1 — `ef597073` (already filed):** `tickDispatch` repo-cap `return`→`continue` + two-repo
  regression in `e2e/tasks.ts` + pin "the repo cap holds only its own row, never the sweep". Not
  re-filed here; it is referenced so the builder does not duplicate it.
- **S2 — ONE builder lane, five commits in this order** (the only code of this Program):
  1. `clarificationReceiverFor`: Program binding first; watch evidence only when `task.programId`
     is null; two live watchers on a program-bound lane is no longer a refusal. Probe in
     `e2e/programs.ts`: program-bound lane with two watchers files its report to the bound MAIN.
  2. `program.promotion` record + owner route + loader (danger-direction probe).
  3. `POST /api/self/tasks/:id/land` with the refusal order of `6b4b01a` §2 (minus caps beyond the
     per-task attempt cap), calling `mergeJob` through a helper shared with the owner route.
  4. `LandProvenance.actor` + `LaneOutcome.landedBy` + `land_actor` audit + suspect flag on the
     owner route; `mergeJob` gets the actor as a pass-through parameter only (diff hunk in report).
  5. `programExecutionView` derived `phase`/`note`/`candidate`; `docs/self-api.md` §land (+§tasks);
     pins (two call sites · actor never absent · bearer channel read · phase is derived from facts
     the view lists, no stored field).
  Verify: full chain + `./e2e-isolated.sh` (log to file, tail `ALL PASS`, exactly one run-id) +
  `./e2e-clean-review.sh`. Critic: fresh different-family read-only critic on the lane BEFORE land
  (the 12-item authority checklist from the archived SLP-2 text, reused verbatim).
- **Canary (after S2 lands and is deployed — deploy is a separate owner boundary):** owner confirms
  `{v:1, selfLand:"green-only"}` on Tower; Tower E2/E3 run entirely under T1→T2→T3; the
  measurement instrument is the attention log (target: zero LAND REQUEST attentions per act,
  `owner_token_ambient_use` count stays 0).

## 5. Do-not-build (from all three arms)

Server auto-land on inferred completion · Supervisor as lander or any second command voice · a
general policy engine beyond the closed record · JSON standardisation of reports/events beyond the
typed rows that exist · a taste-record object store · the gamestudio sensor suite before a playable
exists · worker self-land · conflict-accept / red-override · host-sandbox token prevention · a
`reviewed` task status (until T2 exists, "reviewed" = "the MAIN called land", a trail row).

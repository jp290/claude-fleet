# Program-state review — the hybrid autonomy mechanism (2026-08-23, GLM)

Review lane `fleet/260823145354-a566`, tree `3150be3` (all `server.ts` line anchors below re-verified on this
tree; the brief's anchors from `9cc8b1e`/`b5109df` shift but were each re-located). Read-only act: nothing
here edits production code, lands, or deploys. Done-proof for this act: `git diff --check` clean, `bun
e2e/pins.ts` tail `ALL PASS`, this file committed, one typed fleet-report POSTed.

**What is under review.** The hybrid autonomy mechanism as synthesised in
`docs/program-transitions-brief-2026-08-23.md` (and pre-figured by `docs/promotion-policy-v1-2026-08-23.md`
@ `6b4b01a`, `SYSTEM.md` "Promotion als Policy", and the role table in `AGENTS.md`): (1) machine-structured
facts and transitions — T0–T4 typed transitions on existing rails, a **derived** phase projection, closed
typed event payloads; (2) semantic reports with provenance — `POST /api/self/fleet-report` free text with a
coarse typed status and server-stamped provenance, "prose is evidence, never the fact"; (3) quality and
taste remain independent judgements — done-looking ≠ reviewed, MAIN reads the diff, owner owns taste gates.

**The question.** Is this the *smallest* mechanism that lets a controller answer project state without
reading pane transcripts, while avoiding a second controller level or rigid task-quality scoring?

## Verdict

**Yes, with three conditions and one split.** The mechanism adds no ledger, no role, no route that grants
authority, and its state half is a pure projection over facts the server already holds — strictly smaller
than every alternative in the precommitted B-1 frame that actually answers the question. But the brief
bundles **two mechanisms**, and the bundling is the main risk: a *state* mechanism (the derived projection —
answers "what is my program doing" without panes) and an *autonomy* mechanism (receiver fix + promotion
policy + MAIN land door — closes the act loop). Only the first answers the review question; the second is a
separate decision with the change's only real risk surface (a second `mergeJob(` call site). The three
conditions: the projection must **not** read the prunable report ledger (§Attack 2), the phase vocabulary
needs an explicit **unknown arm** (§Attack 3), and the state slice must land independently of the land door
(§Attack 1).

---

## 1. Observed facts (verified in this tree, `3150be3`)

Code, read directly:

- **One land door, owner-gated.** The only `mergeJob(` call site is `server.ts:19076`, behind
  `POST /api/slots/:id/merge` (route at `:18780`), behind the owner token gate. The invariant is written
  into the harness comment: "The ONE mergeJob call site is a route … every one of them a PROMPT into a pane,
  none a write to main" (`:596`). `mergeJob` (`:12853`) is three-valued on verify: `ok:null` stops at
  `:13110`, `ok:false` at `:13136`.
- **The receiver refusal is real and unconditional before the program binding.** `clarificationReceiverFor`
  (`:5715`) computes `programReceiver` from the Program binding, but then refuses
  `lane-watch evidence names multiple receiver occupants` whenever **two live watchers** exist — before the
  program binding is consulted (`:5736–5739`). A program-bound lane with Supervisor + MAIN both watching
  cannot file a typed report. This matches the brief's measured slot-20 fact (3× refused) and the arm
  commit `b6ddc5a` ("finaler fleet-report dreimal designiert verweigert").
- **The execution view exists and reads no reports/attention.** `programExecutionView` (`:2283`) joins bound
  programs, tasks (rows + byStatus), lanes, lane-outcomes, context-receipts, FleetEvents and watches, and
  carries an explicit `unknown[]` honesty list. It has **no phase/note/candidate** fields and reads neither
  `fleetReports` nor `attentionRequests`.
- **Reports are a pruned transport channel, not a durable fact store.** `pruneFleetReports` (`:5876`) keeps
  only `FLEET_REPORT_KEEP = 20` (`:2857`) terminal reports (acknowledged/receiver-gone). Attention rows are
  pruned the same way (`:6127–6132`) — but **open** attention rows are never pruned.
- **Report status is an outcome kind, not a grade.** `FLEET_REPORT_STATUSES = ["complete", "needs-main",
  "failed"]` (`src/protocol.ts:33`). `openFleetReport` (`:5905`) accepts only `{status, text}`, stamps
  worker occupant + `{taskId, originId, programId}` provenance server-side, and **never moves task status**
  (the measured root-cause: only a land does, `landLane` `:4424` `sent→done`).
- **Liveness predicates are closed and typed.** `laneWatchSignal` (`lane-signals.ts:92`) returns
  `done-looking` (idle+clean+ahead>0) or `host-commit-looking`; event payloads are "closed, typed Fleet
  facts only … no text/command/detail escape hatch" (`lane-signals.ts`). `laneSignalView` (`server.ts:15761`)
  makes the predicate cheaply recomputable per request — the projection needs no new sensor.
- **Wait-notes already exist on blocked rows.** `tickDispatch` (`:7597`) writes `waiting:` sentences on the
  blocked row, including the repo-cap one — which still `return`s and blocks the whole sweep
  (`:~7630`), the T0 gap (fix `ef597073` filed, not in this tree).
- **The authority bracket exists once.** `programOccupancy` + `boundProgramForMain` (`:6148–6198`) derive
  program authority from the occupant triple; `programId` is "derived HERE and nowhere else — no body field
  can nominate the program". Attention (`:6412–6426`, kinds `decision|blocked|review-ready`, dedupe
  `existing:true`) is the owner rail. `supervisorView` (`:14039`) already answers portfolio state (programs,
  occupancy, tasks byStatus, outcomes, debts, integration) with its own `unknown[]` lines — no pane reads.
- **Succession preserves authority continuity.** `succeedProgramMain` (`:14340`) rebinds `program.main` to
  the successor occupant triple (`:14424`) — any projection keyed on the same bracket is succession-safe by
  construction.
- **Pins discipline already covers this family.** `e2e/pins.ts` pins the watchless event kinds (`:198–203`),
  the bracket-before-everything order (`:248`), the lane→derived-Program-MAIN role cuts (`:727–746`), and
  the repo-cap-before-program-cap order (`:1334–1346`).
- **Docs gap is measured, not asserted.** `docs/self-api.md` has §autos, §watch, §transition,
  §supervisor-watch, §succeed/retire, §release — **no §tasks, no §fleet-report, no §land**. The root-cause
  measurement (`docs/messungen/2026-08-23-rootcause-lane-ohne-commit-und-report.md`) shows the missing docs
  + missing UI exposure cost a real lane ~7 min of route discovery.

Measurements (read, cited, not re-measured here):

- Worktrail-audit II + B-1 sharpener (`docs/worktrail-audit-II-2026-08-19.md`,
  `docs/worktrail-B/B1-sharpener-2026-08-23.md`): in one 24-h window, 88 bash calls of the class "read
  slot/session" vs 106 decision calls in the Controller transcripts, while the rail fired 29×/34 events —
  **F1 adoption lag**; 454 `lane-outcomes` rows, **0 with a report field** — F2 results die with the slot;
  predicate ≠ report (twin states) — F3; `supervisor-view` 18 539 B — F4; transport/probe failures that
  look like product failures — F5. The B-1 frame precommits six approaches (JSON-first, event-first,
  receipt-first, state-machine, supervisor-policy, do-nothing) with counterhypotheses and falsifiers.
- Red-team (`docs/messungen/2026-08-23-redteam-glm-autonomie.md`): no MAIN land door (1.1); no policy
  object on `interface Program` (`:2180` — re-verified: no promotion field) (1.2); no budget/spend cap
  (1.3); live env values live in the watchdog start line, not `.env`.
- The brief's two arm commits exist and are readable: `b5109df` (Fable causal audit + peer review),
  `b6ddc5a` (GLM causal audit, §12). `worktrail-audit-II/III` and `worktrail-B` are **docs directories,
  not git branches** — no branch by those names exists (`git log <name>` fails); the lane branches are the
  `fleet/…` set.
- `docs/acp-selfland-chain-parked-2026-08-23.md`: owner parked ACP-31/32 and hands the mapping to the
  Self-land Policy MAIN "erst wenn die drei Reviews konvergiert sind" — the transitions brief is that
  convergence product.

## 2. Inference

- **The mechanism is real in the sense that matters:** all three layers already exist as code (typed events,
  typed report rows with provenance, human adjudication at T2/T4). The proposal's net-new surface is:
  one predicate reorder, one derived projection, one policy sub-record + one self route + one helper share,
  one provenance field. That is close to the definitional minimum for closing the loop.
- **"Controller answers project state" runs through existing surfaces only.** The Controller session has
  propose-only `GET/POST /api/self/programs` (`:17466`) — content, not execution state. Execution state is
  `GET /api/self/program-execution` (bound MAIN, `:17489`) and `GET /api/self/supervisor-view` (bound
  Supervisor, `:17506`). The hybrid adds no Controller route — correct: a fifth state surface would violate
  the role table (Controller has no owner route of its own). The state answer for a *portfolio* consumer is
  the Supervisor view + the STN-1 transition-watch rail, both already built.
- **Minimality against the B-1 alternatives.** JSON-first adds three versioned schemas + migration +
  redaction state and does not fix F3 (a JSON over the same predicate says nothing new); state-machine
  persists states (hard rollback; `71a271c` showed one restart filter alone cost 8 red checks);
  receipt-first adds a new joined ledger row; supervisor-policy is 0 code but leaves F2/F3 and the autonomy
  gap untouched; do-nothing is 0 code but F1 is measured adoption lag and the state question stays answered
  by pane reads. The derived projection is smaller than every alternative that answers: no storage, no new
  route, additive JSON, rollback = delete the computation.
- **No second controller level.** T2 rides the existing `boundProgramForMain` bracket; T4 rides attention;
  the Supervisor gains nothing (still nudge-only, no owner route); the pin "exactly two `mergeJob(` call
  sites, both routes" makes "projection is never an actuator" *mechanical* for the land direction — a tick
  cannot grow a third call site without going red.
- **No rigid task-quality scoring.** `done-looking` is liveness; report status is outcome-kind; T2 mandates
  reading `git diff main...branch`; the do-not-build list (§5) forbids report JSON standardisation and a
  taste-record object store. The boundary holds provided statuses stay coarse and phase never encodes
  quality — REVIEWABLE means "machine says the lane stopped ahead", never "the work is good".

## 3. Verdict on the question, conditioned

1. The projection must derive from durable facts only. `fleetReports` is pruned to 20 terminal rows —
   a phase that reads it flickers as reports age out. **Open attention rows are safe** (never pruned while
   open); report *presence* may at most be an advisory field that can honestly disappear, or move to the
   durable lane-outcomes row.
2. The phase vocabulary needs an explicit unknown arm (or per-row `unknown` notes), reusing the `unknown[]`
   pattern both views already carry. Six enums with no honesty arm render missing evidence as a confident
   phase.
3. The state slice (projection + receiver fix + docs) must be landable without the land door; the two goals
   must not share a fate.

## 4. Attack on the recommendation (explicit)

1. **Two mechanisms, one brief.** Commits 1 and 5 of S2 answer the state question; commits 2–4 are the land
   door, the change's only real risk surface. As briefed they share one lane and one land. If the land-door
   review stalls, the state answer stalls with it — the exact coupling the "smallest mechanism" framing is
   supposed to prevent. Order the lands so the state slice does not depend on the autonomy slice.
2. **"The phase derivation reads them" is the weakest sentence in the brief.** Reading `fleetReports` builds
   the state answer on a channel that deletes its own history at 20 rows (`:5876`). Derive phase from task
   status, slot liveness, `laneWatchSignal`, `mergeStart/mergeInflight/mergeLast`, and **open** attention
   rows — nothing else.
3. **Phase has no unknown.** A stale occupancy, a dead pane, a malformed ledger row must not print `READY`.
   The house rule is "missing or failed evidence is `unknown`, never zero, false, or pass"; a six-value enum
   without that arm violates it in spirit exactly where it would hurt.
4. **The idle+dirty blind spot is not fixed by this mechanism.** The measured failure (lane writes
   `verdict.md` untracked, sits idle-dirty ~20 min, `lane-ready` cannot fire, result nearly dies with the
   slot) leaves phase = RUNNING forever with no note — and the controller falls back to reading panes, the
   behaviour this exists to remove. The root-cause's lifecycle-footer fix belongs in the same program or is
   explicitly out of scope with the hole named in the docs.
5. **S0 ordering hazard.** Without the owner's `FLEET_VERIFY_CMD_REPOS` entry, every product-repo self-land
   ends `verify.ok:null` → T4 `blocked` → attention spam, and the canary's "zero LAND REQUEST attentions"
   fails for the wrong reason — the probe measures a missing env entry, not the mechanism (suspect your
   probe before your code). Sequence the canary after S0, or it records nothing useful.
6. **The Controller gains nothing and that must be said.** If anyone reads "controller answers project
   state" as "the Controller session gets a state route", the correct answer is: no — it reads the
   Supervisor's typed view and STN-1 events, or the owner board. Adding a route would be a new surface and
   a role-table violation, not a simplification.
7. **Provenance is detection, not prevention.** Ambient owner-token use stays possible (same uid; brief
   admits). The suspect flag + `owner_token_ambient_use` audit is the honest bound; docs must not imply
   more. And the attempt cap is memory-resident: a server restart resets it — write that as a fact in
   `docs/self-api.md`, don't let it be discovered.
8. **Trim still on the table:** the `PLAYABLE` attention-text prefix is a hidden schema in prose ("a
   convention until a sensor field exists"). Either keep it a *documented text convention* or promote an
   owner-decided typed attention kind later; do not let it drift into a sensor-derived quality field — that
   is the first step onto rigid quality scoring.

## 5. What stays prose / artifact evidence, never JSON

- The **report text** itself — semantic content whose consumer is a judgement (MAIN or owner), not a state
  machine. Status stays a three-valued outcome kind.
- The **diff** (`git diff main...branch`) — the review artifact T2 consumes; it already has an addressable
  form.
- **Critic verdicts and review narratives** (lane-outcomes `review`, harvest docs) — judgement records.
- **HANDOFF.md and succession carries** — already the designed prose seam.
- **Attention text**, including the `PLAYABLE` convention (§Attack 8).
- **Refusal reasons** — "every refusal is its own sentence" is the existing house style; a refusal-code enum
  would be a scoring surface and a loss of diagnostic power.
- **Owner taste/quality decisions** — the entire content of layer 3; the mechanism's value rests on never
  encoding them.

## 6. Exact existing mechanisms to reuse

| Purpose | Mechanism (this tree) |
|---|---|
| T1 receiver | `clarificationReceiverFor` basis machinery (`server.ts:5715`) — reorder to program-first, watch evidence only when `programId` is null |
| State answer | `programExecutionView` (`:2283`) + its `unknown[]` pattern; `supervisorView` (`:14039`) portfolio |
| Phase inputs | `laneSignalView` (`:15761`) + `laneWatchSignal` (`lane-signals.ts:92`); `Task.note` wait sentences from `tickDispatch` (`:7613–7642`) |
| T2 authority | `boundProgramForMain` bracket (`:6169`); lane 409 by design (as at `releaseTaskForMain`) |
| T2 execution | `mergeJob` (`:12853`) through a helper shared with the owner route; call site `:19076` |
| Non-land outcomes | three-valued verify (`:13110` ok:null, `:13136` ok:false) |
| T3 facts/recovery | `landLane` sent→done (`:4424`), merge-terminal + post-land-audit events, lane-outcomes ledger, land note writer (`:10646`), undo-land stack |
| T4 | attention rail with dedupe (`:6412–6426`) |
| Notifications | existing FleetEvent kinds (lane-ready/host-commit-ready, merge-terminal, post-land-audit, supervisor-transition/STN-1) — **no new kinds needed** |
| Succession safety | occupant-triple rebind (`:14340`, `:14424`) — key the projection on the same bracket |
| Pins/docs | `e2e/pins.ts` discipline (`:198`, `:248`, `:727`, `:1334`); `docs/self-api.md` section pattern |

## 7. Missing transitions (against this tree)

- **T0 START**: repo-cap `return` starves the sweep behind a foreign repo's lanes (`:~7630`) — fix filed
  (`ef597073`), not landed here.
- **T1 REVIEWABLE delivery**: multi-watcher refusal kills typed reports on program-bound lanes (`:5736`).
- **T2 LAND**: no MAIN land door; single owner-gated call site. Plus `LandProvenance` (`:10640`) names no
  actor — lands are ledger-indistinguishable by actor (one ambient-token land `9cc8b1e` measured).
- **T3, T4**: exist complete; nothing missing.
- **Projection**: absent (no phase/note/candidate; and correctly no report/attention read today — see
  Condition 1 for how to add it safely).

## 8. Authority boundaries the mechanism must hold

- The tick never lands (`:596` invariant; two-call-sites pin makes it checkable).
- A lane may not release, subscribe, raise attention, or land (409 by design).
- The Supervisor never lands and has no owner route; it observes and nudges.
- The Controller proposes only; no state route of its own (state flows through Supervisor view/STN-1/board).
- Self-land authority exists only as the owner-written `program.promotion` record; absent = owner-only,
  byte-for-byte legacy; `{"policy":null}` revokes; loader degrades bad records to absent (danger direction).
- Deploy stays a separate owner boundary (the canary says so explicitly).
- Authority follows the occupant triple; succession rebinds it, so projections keyed on the bracket survive
  succession without new code.

## 9. Failure modes

1. Phase reads pruned `fleetReports` → state flickers as reports age out (KEEP=20).
2. Phase without unknown-arm → missing evidence renders as a confident wrong phase.
3. Idle+dirty lanes never reach REVIEWABLE (measured blind spot) → silent RUNNING forever.
4. Missing S0 env entry → self-lands end `ok:null` → attention spam; canary measures the env, not the code.
5. Second `mergeJob` call site reachable from a tick/autos path would widen unattended land — prevented
   only by the pin; the policy loader must fail toward absent, never toward `green-only`.
6. Memory-resident attempt cap resets on restart (accepted, must be documented).
7. The receiver fix must keep the strict multi-watcher rule for program-less lanes — the probe needs both
   directions (fixed lane files; program-less lane still refuses).
8. Ambient owner-token use remains possible; only after-the-fact detection exists.
9. Every new event consumer inherits the transport failure modes (send-uncertain, composer loss — F5);
  adding no new event kinds keeps this bounded.
10. Succession between adjudication and land: benign by design (route re-derives everything per call; no
    stored approved sha) — worth one probe, not new code.

## 10. Reversible implementation slices (at most three)

1. **State answer (no authority change).** Derived `phase`/`note`/`candidate` in `programExecutionView`
   (+ unknown arm; open-attention rows only; **no** fleetReports input) and the same per-program rollup in
   `supervisorView`; pins: derived-only/no stored field, phase carries unknown; `docs/self-api.md` gains
   §tasks and §fleet-report (closes the measured docs gap). Rollback: delete the derived fields.
2. **Return-path repair (no authority change).** `clarificationReceiverFor` program-binding-first with
   watch evidence only for `programId === null`; two-direction probe in `e2e/programs.ts`; the
   `briefAndSend` lifecycle footer + its pin (from the root-cause; without it slice 1's REVIEWABLE has the
   measured blind spot). Rollback: revert one predicate and one footer.
3. **Land door (the only authority change).** `program.promotion` record + owner route
   `POST /api/programs/:id/promotion` (danger-direction loader probe) + `POST /api/self/tasks/:id/land`
   through the shared helper with the ordered refusals + `LandProvenance.actor` +
   `LaneOutcome.landedBy` + bearer suspect flag + the two-call-sites pin + `docs/self-api.md` §land
   (memory-resident cap written as fact). Rollback: `{"policy":null}` restores owner-only byte-for-byte.

S0 (`.env` `FLEET_VERIFY_CMD_REPOS`) is an owner act, not a code slice; `ef597073` (T0) is already filed and
referenced, not re-filed.

## 11. Unknown (explicit)

- Whether the state slice is justified *now* vs after rail adoption: the do-nothing falsifier (a 24-h
  handle-read measurement after the Controller subscribes to existing events) has not been run.
- Payload growth for `supervisorView` (+phase rollup) on the Controller turn: bounded but unmeasured.
- Whether `PLAYABLE` eventually needs a typed attention kind — owner taste call.
- Adequacy of `"needs-main"` report status against the T1 phase interplay — unmeasured.
- `./e2e-isolated.sh` not run here: this review touches no e2e lifecycle, no suite wrapper, no merge/land
  path — doc-only act, full local chain not owed by this slice (`git diff --check` + `bun e2e/pins.ts` run;
  quoted in the report).

## 12. Open boundary

This review read the tree and the named contracts at `3150be3`; it did not re-run the arm measurements, did
not touch `.env` or other repos, and implements nothing. The one contradiction to flag rather than resolve:
the brief's §2 sentence "the phase derivation reads them [fleetReports/attentionRequests]" vs the pruning
facts at `:5876`/`:6127` — resolved *in this review's conditions*, but the brief text should be corrected
by its Program MAIN before the builder lane starts, so the builder does not implement the weaker reading.

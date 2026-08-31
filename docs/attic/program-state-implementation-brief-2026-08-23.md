# Program state — minimal implementation brief (2026-08-23)

Elaborates `docs/program-state-review-2026-08-23-glm.md` (landed on main, `9dc6574`; owner addendum
`dac6595`) into one buildable brief. Source of the transitions: `docs/program-transitions-brief-2026-08-23.md`.
Every `server.ts` anchor below was re-located on tree `dac6595` by this lane (`grep -n`, then a focused read);
anchors drift — re-anchor before citing. Docs-only act: nothing here edits production code.

**Scope, fixed by the review's split.** This brief builds the review's slices 1 and 2 — the *state* mechanism
(derived projection) and the *return-path repair* (receiver + lifecycle footer). Slice 3, the MAIN land door
(`program.promotion`, `POST /api/self/tasks/:id/land`, a second `mergeJob(` call site), is the only authority
change and is **explicitly out of this brief** (review §Attack 1: "the state slice must land independently of
the land door"). Nothing below adds a call site to `mergeJob(` — the single one stays `server.ts:19076`.

**The hybrid boundary, restated as the build rule.** JSON facts the server already holds drive *mechanical*
transitions only (queued→sent by the tick, sent→done by `landLane`, predicate→event by the watch tick,
receiver derivation). Semantic quality stays what it is today: a free-text report with a three-valued outcome
kind and server-stamped provenance (`openFleetReport`, `:5906`), independent critic evidence (lane-outcomes
`review`, the clean-review ② contract, the post-land audit), an explicit `unknown[]` list on every view, and
owner taste where the owner declared it (attention `review-ready` text, `PLAYABLE` convention). No field in
this brief grades work. `phase` says where a row sits on the rail; it never says the work is good.

---

## 1. State and event vocabulary (exact)

### 1.1 Persisted states — unchanged, listed so nothing new is mistaken for one

| Object | Field | Values (closed) | Writer |
|---|---|---|---|
| `Task` (`:1878`) | `status` | `pending · queued · sent · done · archived` | release doors (`pending→queued`), `tickDispatch` (`queued→sent`, `:7597`), `landLane` (`sent→done`, `:4424`), archive route |
| `Task` | `note` | free text; the tick writes `waiting: …` sentences (`:7620–7622`, on change only) | `tickDispatch`, owner |
| `Program` (`:2180`) | `status` | `proposed · confirmed · active · complete` | owner routes + `succeedProgramMain` (`:14341`) rebinds `main` |
| `FleetReport` | `status` | `complete · needs-main · failed` (`src/protocol.ts:33`) | `openFleetReport` (`:5906`); **never moves a task status** |
| `AttentionRequest` (`:1557`) | `status` | `open · send-uncertain · answered · refused` (`:1556`); kinds `decision · blocked · review-ready` | MAIN `POST /api/self/attention` (`:17637`), owner answer |
| `MergeLast` (`:10420`) | `status` | `merged · blocked · error · resolved · interrupted · awaiting-author`; `landed: boolean` | `mergeJob` (`:12853`) |
| `FleetEvent` | `status` | `pending · send-uncertain · delivered · inbox · acknowledged · receiver-gone` | watch tick / transport |

**No new persisted state.** No `reviewed` status, no `phase` column, no policy record (that is slice 3).

### 1.2 Derived phase — new, never stored

```
Phase = "READY" | "RUNNING" | "REVIEWABLE" | "INTEGRATING" | "OWNER_GATE" | "CONTINUE" | "UNKNOWN"
```

Seven values: the transitions brief's six plus the review's required honesty arm (Condition 2, §Attack 3).
`UNKNOWN` is the value whenever an input the reducer needs is missing, `null`, or contradictory — never the
value of a default branch. It is an *output* of the reducer, not a fallback in the serialiser.

### 1.3 Events — none added

Consumers of this brief read the existing kinds only: `lane-ready`, `host-commit-ready` (`lane-signals.ts:98`),
`merge-terminal`, `post-land-audit`, `fleet-report`, `clarification-request`, supervisor transition events.
Review §6: "no new kinds needed"; §9(9): every new consumer inherits F5 transport failure modes, so adding
none keeps that bounded. A pin (§8) holds the event-kind set constant across this slice.

---

## 2. Reducer inputs (the complete list — anything not here is forbidden input)

`phaseOf(task, program, now)` reads, per task row of a bound Program:

| # | Input | Source (this tree) | Durable? |
|---|---|---|---|
| I1 | `task.status`, `task.slot`, `task.note`, `task.kind` | `tasks[]` in state | yes |
| I2 | lane slot for the row: the slot `x` with `x.cwd && x.taskId === task.id && x.programId === program.id` (`Slot.taskId`, `:11375`); `stewardTaskView`'s rule in reverse — only a `sent` row may own a live lane | in-memory slots | live |
| I3 | `laneSignalView(x, now)` (`:15761`) → `laneWatchSignal(sig, AUTO_REVIEW_IDLE_MS)` (`lane-signals.ts:92`, threshold `:9214`) | caches `gitInfo` / `aliveInfo` / `gitOpInfo` / `lastOutput` | live, may be `null` |
| I4 | `mergeStart.has(x.id)`, `mergeInflight.has(x.id)`, `mergeLast.get(x.id)` (`:10475–10480`) | in-memory merge maps | `mergeLast` persisted; the other two live |
| I5 | **open** attention rows: `attentionRequests.filter(a => a.programId === program.id && (a.provenance?.taskId === task.id) && (a.status === "open" \|\| a.status === "send-uncertain"))` | state; open rows are never pruned (review §1, `:6127–6132` prunes terminal only) | yes |
| I6 | newest `lane-outcomes` row for `taskId === task.id` (`disposition`, `headSha`, `mainAfter`) — already loaded by the view (`:2284`) | ledger | yes |

**Forbidden inputs (review Condition 1, §Attack 2):** `fleetReports` (pruned to `FLEET_REPORT_KEEP = 20`
terminal rows, `:2857`, `:5875`) · pane text · transcript bytes · `Task.brief`/`comments` text · any
`lastResult` prose · terminal attention rows (pruned at `ATTENTION_KEEP_TERMINAL = 20`, `:2862`). A pin
asserts the reducer body contains no `fleetReports` token (§8).

---

## 3. Derived projection fields

Added to each `tasks.rows[]` element of `programExecutionView` (`:2283`) and, as a per-program rollup, to
`supervisorView`'s portfolio entries (`:14039`). All derived on the request; rollback = delete the computation.

| Field | Type | Derivation |
|---|---|---|
| `phase` | `Phase` | §4 table, first matching row wins, top to bottom |
| `phaseBasis` | `string[]` | the prose of each rule that decided the phase (reuse `LaneRule.prose` from `lane-signals.ts` where a predicate was consulted) — so the answer is auditable without the pane |
| `note` | `string \| null` | `task.note` verbatim when it starts with `waiting:` (the tick's sentence, `:7620`); otherwise `null`. **Not** a new text; the projection only surfaces what the tick already wrote. The T0 starvation (`:7628` still `return`s on the repo cap in this tree — `ef597073` is a filed task, not a commit) stays a note on the *blocking* row only; the brief does not widen it |
| `candidate` | `{ sha: string \| null; basis: "merge-last" \| "lane-outcome" \| "none" }` | `mergeLast.candidateSha` when `INTEGRATING`/`CONTINUE` and present; else newest outcome row's `headSha`; else `{sha:null, basis:"none"}`. **There is no per-slot HEAD-sha cache in this tree** (`GitInfo` is `{branch,dirty,ahead,behind}`, `src/protocol.ts:27`); a `REVIEWABLE` row therefore reports `sha:null` and the MAIN reads the branch. Spawning `git rev-parse` inside a view is forbidden (the sessions poll must never block on git spawns, `:3791` comment) |
| `unknown` (existing array) | `string[]` | one sentence per `UNKNOWN`-phased row, naming the missing input (`"task <id>: alive unknown (pane never observed)"`) — the same pattern the view already uses (`:2310–2322`) |

`supervisorView` rollup per program: `phases: Record<Phase, number>` (counts only) + the existing
`unknown[]`. No row bodies — the Controller-turn payload is already 18 539 B (review F4); counts add
< 100 B per program. No new route; the Controller keeps reading the Supervisor view and STN-1 events
(review §Attack 6).

---

## 4. Automatic transition table (projection rules — read-only; the *actuators* are the existing writers)

Evaluated top-down per task row; the first row whose condition holds names the phase.

| # | Condition (inputs from §2) | Phase | Who actually moves the persisted state |
|---|---|---|---|
| R0 | `task.kind !== "auftrag"` | `CONTINUE` | nobody — advisory categories have no motor (`Task.kind` comment, `:1893`) |
| R1 | `status ∈ {done, archived}` and newest outcome `disposition === "landed"` | `CONTINUE` | `landLane` (T3) |
| R2 | `status ∈ {done, archived}` and outcome is `reverted`/`killed`/absent | `UNKNOWN` | — (history only; the view says which) |
| R3 | `status ∈ {pending, queued}` and an open attention row (I5) exists | `OWNER_GATE` | owner answers (T4) |
| R4 | `status === "pending"` | `READY` | release doors (`pending→queued`) |
| R5 | `status === "queued"` | `READY` (with `note` if the tick wrote one) | `tickDispatch` (T0) |
| R6 | `status === "sent"` and no lane slot found (I2 null) | `UNKNOWN` ("sent row owns no live lane — boot recovery or detach pending") | boot reconcile / `detachSlotTasks` |
| R7 | `sent`, lane found, `mergeInflight` or `mergeStart` holds the slot | `INTEGRATING` | `mergeJob` (owner route, T2 — owner-only in this brief) |
| R8 | `sent`, lane found, `mergeLast` present, `landed:false`, status ∈ `{blocked,error,resolved,interrupted,awaiting-author}`, and open attention row exists | `OWNER_GATE` | owner (T4) |
| R9 | same as R8 without an open attention row | `REVIEWABLE` (basis `"merge-last non-land verdict"`) | MAIN repairs or raises attention |
| R10 | `sent`, lane found, `laneSignalView.alive === null` or `observed === false` or `git === null` | `UNKNOWN` (name the null) | — |
| R11 | `sent`, lane found, `laneWatchSignal(...) !== null` | `REVIEWABLE` | watch tick mints `lane-ready`/`host-commit-ready` (T1) |
| R12 | `sent`, lane found, open attention row exists | `OWNER_GATE` | owner (T4) |
| R13 | `sent`, lane found, none of the above | `RUNNING` | — |

Two consequences the table makes explicit rather than hiding:

- **The idle+dirty blind spot is named, not solved (review §Attack 4).** A lane that stops dirty with an
  untracked file and `ahead === 0` sits at R13 `RUNNING` forever; `done-looking` cannot fire. Slice B's
  lifecycle footer (§7) is the measured fix on the producing side; the projection adds to `phaseBasis`
  `"idle ≥ threshold, dirty>0, ahead=0 — not reviewable by predicate"` when `idleMs ≥ AUTO_REVIEW_IDLE_MS`
  and `git.dirty > 0`, so the MAIN sees *why* it is RUNNING without reading the pane. That sentence is
  a basis line, not a phase: inventing a `STALLED` phase would be a quality inference.
- **`verify.ok === null` is CONTINUE-with-reason, never OWNER_GATE** (transitions brief §0): R1 applies to
  a landed row regardless of verify verdict; the audit outcome is in the outcome row the view already lists.

---

## 5. Authority matrix (unchanged by this brief — listed so the build cannot widen it)

| Actor | May read phase | May write a fact the reducer reads | May land | May raise attention | Notes |
|---|---|---|---|---|---|
| tick (`tickDispatch`, watch tick) | n/a | `queued→sent`, `task.note`, mint `lane-ready` events | **never** (`:596` invariant; one `mergeJob(` call site, `:19076`) | no | projection is never an actuator |
| lane (self token) | no (`/api/self/program-execution` is bound-MAIN only, `:17492`) | commits (git facts), `POST /api/self/fleet-report` | no (409) | no (409) | may not release/subscribe (`CLAUDE.md` §Scope) |
| bound Program-MAIN (self token, `boundProgramForMain` `:6169`) | yes, own programs | release `pending→queued`; attention rows; file `main` rows | **no** in this brief (slice 3 absent) — lands from the board via owner | yes | succession rebinds `program.main` (`:14424`), so the bracket-keyed projection survives |
| Supervisor (self token) | counts only via `supervisorView` | nudges (existing) | no | no | no owner route |
| Controller (self token) | through Supervisor view / STN-1 / board | propose-only programs (`:17466`) | no | no | **gains no route** (review §Attack 6) |
| owner (owner token) | board | everything above | yes (`POST /api/slots/:id/merge`, `:18780`) | answers | deploy stays a separate boundary |

---

## 6. Migration / backfill behaviour

- **Nothing to migrate.** No persisted field is added; `loadState` is untouched. Pre-field rows project
  exactly like new rows because every input is either a live predicate or an already-persisted fact.
- **No backfill of `Task.note`, `originId`, `programId`** — absent stays absent (the `Task` comments,
  `:1880–1884`, make absence the honest shape). A row without `programId` is simply not in any program's
  projection, as today.
- **Legacy `MergeLast` rows without `candidateSha`** (`:10424` comment: absence is UNKNOWN) → `candidate`
  falls through to the outcome row or `{sha:null, basis:"none"}`; never synthesised.
- **Receiver change (slice B) is stateless**: existing `fleetReports` rows, watches and events are not
  rewritten; only the next `POST /api/self/fleet-report` is affected.

---

## 7. Slices — at most two, exclusive file ownership, Opus workers

Both slices are reversible, neither touches `mergeJob`, and they must be landable in either order; the
file ownership below is disjoint so two lanes can run in parallel under the repo lane cap.

### Slice A — the state answer (projection)

Owner-files: `server.ts` **only inside** `programExecutionView` (`:2283–2399`) and `supervisorView`'s
portfolio map (`:14056–…`) plus one new pure module `program-phase.ts` (reducer + `Phase` type, exported
`PHASE_RULES: readonly {prose, holds}[]` in the `lane-signals.ts` style) · `e2e/programs.ts` (new checks
appended next to the existing program-execution checks, never at EOF of the runner) · `e2e/pins.ts`
(pins listed in §8, rows A1–A4) · `docs/self-api.md` §program-execution amendment + new §tasks.

Steps:
1. Write `program-phase.ts` as a pure function over a `PhaseInput` interface that mirrors §2 exactly
   (no `Slot`, no `Task` import — the server builds the input, like `laneSignalView` builds
   `LaneSignalView`). Unit check in `e2e/programs.ts` with hand-built inputs for R0–R13 including the
   three `UNKNOWN` arms and the idle+dirty basis line.
2. Wire into `programExecutionView` and `supervisorView`; add `unknown[]` sentences.
3. Integration check: spawn a program-bound lane, observe `RUNNING` → idle → `REVIEWABLE` within the
   isolated server's idle threshold; kill its pane → `UNKNOWN` (not `READY`, not `RUNNING`).
4. Docs: `docs/self-api.md` §tasks (`POST /api/self/tasks`, release) and the `phase` fields under
   the program-execution entry. (§fleet-report belongs to slice B to keep ownership disjoint.)

Verify: full chain (`CLAUDE.md` §Verify line) + `./e2e-isolated.sh` (log to a scratch file, tail
`ALL PASS`, exactly one run-id — `e2e/programs.ts` is touched, so the preview is owed) +
`git diff --check`. Done = the integration check above passes and pins A1–A4 PASS.

Rollback: delete `program-phase.ts`, the two call sites, the four pins, the doc lines. No data to unwind.

### Slice B — the return path (receiver + lifecycle footer)

Owner-files: `server.ts` **only inside** `clarificationReceiverFor` (`:5715–5757`) and `briefAndSend`
(founding-brief assembly, `:6840` caller) · `e2e/transport.ts` or `e2e/programs.ts` **only the new
receiver checks** (coordinate: if slice A is live, B appends under a distinct section header
`// --- receiver: program binding first` so the rebase is textual, not semantic) · `e2e/pins.ts` rows
B1–B3 · `docs/self-api.md` new §fleet-report · `briefs/` footer text if a brief template exists there.

Steps:
1. Reorder `clarificationReceiverFor`: compute `programReceiver` (unchanged, `:5717–5725`); **if it
   exists, return `{receiver: programReceiver, basis: "program-main"}` before consulting watches.**
   Watch evidence (`:5727–5740`) is consulted only when `programReceiver === null`; there the strict
   multi-watcher refusal (`:5741–5742`) stays byte-for-byte (review §9(7): both directions).
   Drop the `"program-main+lane-watch"` basis only if nothing reads it — `grep -n '"program-main+lane-watch"'`
   first; a reader keeps it as a second, unreachable-for-bound-lanes branch.
2. Two-direction probe: (a) program-bound lane + two live watchers files a report, receiver = bound MAIN;
   (b) program-less lane + two watchers is still refused with the exact existing sentence.
3. Lifecycle footer in `briefAndSend`: a deterministic closing block appended to every *mutating* lane
   brief naming the three exit acts — commit, `POST /api/self/fleet-report` with one of the three
   statuses, then idle — and the untracked-file rule. Footer-presence probe fails under its own name
   if the footer is absent from the delivered brief (`docs/messungen/2026-08-23-rootcause-…md` §fixes).
   A clarify lane's brief is exempt (it must stop, not report).
4. Docs: `docs/self-api.md` §fleet-report (curl form, the three statuses, "a report never moves task
   status", receiver derivation order, pruning `KEEP=20` as a fact).

Verify: full chain + `./e2e-clean-review.sh` is **not** owed (merge/land path untouched); `./e2e-isolated.sh`
is owed (`e2e/` touched). `git diff --check`. Done = probe (a) and (b) PASS, footer probe PASS, pins B1–B3 PASS.

Rollback: revert one predicate reorder and one footer block; the probes become the regression guards.

**Not a slice here:** S0 (`FLEET_VERIFY_CMD_REPOS` entry — owner act on `.env`), `ef597073` (T0, filed task),
slice 3 land door. A builder that finds itself editing `mergeJob`, `Program`, the owner merge route, or
`loadState` has left this brief.

---

## 8. Pins (`e2e/pins.ts`, RULE style — each a must-agree pair)

| # | Pin | Fails when |
|---|---|---|
| A1 | `program-phase.ts` exports `Phase` containing `"UNKNOWN"` and `server.ts` imports `phaseOf` from it in exactly the two view functions | the reducer grows a third consumer (an actuator) |
| A2 | reducer source contains no `fleetReports`, `attentionRequests.filter(` without an open-status guard, or `spawnSync`/`execFile` token | pruned or spawning input sneaks in |
| A3 | `mergeJob(` call-site count in `server.ts` is exactly 1 and it sits inside the owner merge route | any slice grows a land path |
| A4 | the FleetEvent `kind` union in `lane-signals.ts`/`server.ts` is unchanged against a literal list | a new event kind appears |
| B1 | `clarificationReceiverFor` returns before the `watchReceivers` block when `programReceiver` is non-null (textual order pin: `basis: "program-main"` return precedes `const watchReceivers`) | the reorder regresses |
| B2 | the refusal sentence `lane-watch evidence names multiple receiver occupants` still exists in the function | the program-less direction is weakened |
| B3 | `docs/self-api.md` has `## fleet-report` and `## tasks` headers and the footer text in `briefAndSend` names `/api/self/fleet-report` | doc ↔ route drift |

---

## 9. Bounded telemetry (what may be counted; nothing else)

Existing `audit(...)` rail only; no new ledger, no new file.

- `program_phase_unknown` — audit line when a view renders ≥1 `UNKNOWN` row, payload `{programId, count}`.
  Bound: once per view call, views are request-driven (no tick).
- `fleet_report_receiver_basis` — existing receiver basis string on the already-audited report open; add
  the basis to the audit detail. Bound: one line per report.
- Measurement that decides whether slice A was worth it (review §11 first unknown): re-run the 24-h
  handle-read count from `docs/worktrail-B/B1-sharpener-2026-08-23.md` (88 "read slot/session" bash calls
  per 106 decisions) after the MAIN has the projection. Target stated in advance: that ratio halves. If it
  does not move, the projection is a payload, not an answer — rollback is free.

Forbidden: per-task timing histograms, "quality" or "health" scores, phase-duration SLOs, any aggregate
that ranks lanes or workers.

---

## 10. Falsifiers (each would void a part of this brief)

1. A `REVIEWABLE` row whose lane has `git.ahead === 0` and `hostCommits === false` → the reducer read
   something other than `laneWatchSignal`; A2/R11 wrong.
2. A row rendering `READY`/`RUNNING` while its pane is dead (`alive === false` or `null`) → R6/R10 order wrong.
3. Phase of a row changes between two consecutive GETs with no fact change in I1–I6 → a pruned or live
   text input leaked in (Condition 1).
4. Program-less lane with two watchers files successfully after slice B → B2 direction lost.
5. The owner board's land and the view's `INTEGRATING` disagree for > one tick → I4 read the wrong map.
6. Payload growth of `supervisorView` > 1 KB per program after the rollup → the rollup leaked row bodies.
7. A lane receives a brief without the footer and a `fleet-report` POST still arrives → the footer was not
   the cause of the measured miss; the root-cause needs re-measurement, not a stronger footer.

---

## 11. Rollback

Slice A: delete `program-phase.ts`, the two wiring hunks, pins A1–A4, doc lines — no state touched.
Slice B: revert the receiver reorder hunk and the footer hunk; pins B1–B3 go red and are deleted with it.
Both are single `git revert`s of their land commit; nothing in `fleet.json` or any ledger changes shape.
A server restart with either slice reverted is byte-for-byte today's behaviour.

---

## 12. Do-not-build (binding on both workers)

Resident per-project controller · polling agent or any new tick/autos consumer of `phase` · universal
quality/health score · new queue or ledger · `reviewed` task status · a Controller state route ·
`STALLED`/`BLOCKED` *phases* (basis lines only) · JSON-standardised report bodies · a second `mergeJob(`
call site · git spawns inside views · reading `fleetReports` for state.

## 13. Unknown (explicit)

- Whether `"program-main+lane-watch"` basis has a reader (slice B step 1 checks; this lane did not grep
  the client).
- Exact `supervisorView` portfolio-map line range after `:14056` — re-anchor; this lane read the head only.
- Whether `briefAndSend` has a single brief-assembly point or per-harness branches (slice B must read
  `:6840` and the adapter table before placing the footer).
- Not run here: `./e2e-isolated.sh`, full chain — docs-only act; `git diff --check` + `bun e2e/pins.ts`
  are the proof owed and quoted in the report.

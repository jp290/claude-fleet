# How it works inside

The exact mechanics, with the places in the code, for anyone who wants to build along. This file describes what the code does today; where it and any other text disagree, the code wins. What Fleet is and how to start it: [README](../README.md).

## To check a change

```sh
bun run typecheck        # tsc over every .ts in the tree (tsconfig.json)
bun run pins             # milliseconds: the must-agree pairs no compiler sees (e2e/pins.ts)
bun run test             # unit tests in server/, ci/ and src/
```
Before a merge, `bun ci/merge-check.ts <branch>` checks something else: the tree main would have
after the merge, on a helper machine — pins, typecheck, build, the unit tests of `ci/` and
`server/` (not `src/`), the gate suites and the small e2e units.

## The core objects

**Slot and session.** A slot is one of 16 fixed places, plus up to 100 more for lanes when
`FLEET_SEPARATE_LANE_SLOTS=1` (`FLEET_MAX_SESSIONS`, default 16; `server/types.ts#MAX_SLOTS`), each backed by
a tmux session on the configured socket. `server.ts#ensureSlot` builds the pane and bakes the
session's own credentials into its shell; `server.ts#openSlot` gives it a working
directory, an optional lane ref, a label, a harness, a model and an effort. The pane's output is tailed from a `pipe-pane` stream and broadcast per
slot over a WebSocket, and a self-heal loop rebuilds a pane whose tmux session died — resuming the
pinned conversation where the adapter supports it, rather than starting a new one. `server.ts#sleepSlot` / `#wakeSlot` tear the
pane down and bring it back without ending the occupancy.

**Lane and worktree.** A lane is a session whose cwd is a throwaway git worktree on its own branch,
created by `server.ts#createWorktree`. It is the unit of isolation: the lane commits into its own
tree, and nothing it does touches the integration branch until a land runs. `server.ts#laneDrift`
tells a lane whether main has moved under it, `server.ts#gateView` tells it what will actually gate
its land, and `server.ts#removeWorktreeSafe` is the only way a lane's tree goes away.

**Branch.** How work enters Fleet today. `POST /api/branches/open` (`server.ts#openBoardBranch`)
creates a branch and its worktree and starts a session there with the goal as its first message.
`POST /api/branches/check` runs the repo's own `ci/merge-check.ts` on it, and
`POST /api/branches/land` (`server/branch-land.ts#landCharge`) puts the branch's commits onto the
integration branch as one commit. A session may land its own branch only after the owner approved
that exact tip and with a usable merge check.

**Task and kinds** *(on ice)*. A queue row (`server/types.ts` `Task`) carries text, an optional compiled brief,
a target repo, a chosen agent (`spawn`), a file surface and a card. Four kinds exist
(`server/types.ts#TASK_KINDS`) and only `auftrag` is executable — `richtung`, `notiz` and `betrieb`
are advisory and every dispatch path skips them. A row is created `pending` and only an owner act
moves it to `queued` (`server.ts#releaseTask`).

**Program** *(on ice)*. A Program is an owner-confirmed bracket around rows, with a bound Project MAIN session.
Its statuses are `proposed · confirmed · active · complete` (`server/types.ts#PROGRAM_STATUSES`) and
only the owner promotes between them. A bound MAIN gets its own doors — file a row, release it,
raise attention, read a derived lifecycle projection (`server.ts#programExecutionView`) — and
`server.ts#boundProgramForMain` is what decides whether a caller has that binding at all.

**Land.** This is how a lane lands (`POST /api/slots/<n>/merge`); a branch lands through
`landCharge` (above). Landing is a server-side job, not a git command an agent runs: `server.ts#mergeJob`
rebases the lane, takes the machine-wide suite mutex, runs the verify command, and only then
fast-forwards the integration branch (`server.ts#advanceIntegration`, `server.ts#recordLand`). A
verify that was skipped, timed out, or never started because it sat in the mutex queue is treated as
*no verdict about this tree* and does not auto-land; the owner keeps the latitude to land anyway.

**Audit.** After a land, an optional second tier re-runs the full suite against the landed tree
(`server.ts#drainPostLandAudits`, `server.ts#runPostLandAudit`) and writes one row per run. It is off
unless `FLEET_POSTLAND_AUDIT_CMD` is set. A red audit is not automatically a regression: it is
adjudicated (`server.ts#writeAuditAdjudication`), including carrying a known flake forward, and the
verdict reaches the Programs, if any, whose rows the land covered.

## The life of one row

*On ice.* Steps 1 to 4 belong to the queue and do not run while it is on ice;
work starts as a branch instead (above).
Steps 7 to 9 still hold when the owner lands a lane (`POST /api/slots/<n>/merge`).

1. **Filed** — the owner or a bound Program MAIN writes a `pending` row.
2. **Compiled** — an optional sweep turns the row's text into a
   card extracted by a small model and then checked deterministically (`card-extract.ts`).
3. **Released** — an owner act (or a Program's release policy) moves it to `queued`.
4. **Dispatched** — `server.ts#tickDispatch` runs on a timer, picks a queued row that fits the caps
   and the wave projection, creates the worktree, spawns the lane, and sends it a founding brief with
   its context anchors (`server.ts#briefAndSend`, `context-plan.ts`, `context-packs.ts`).
5. **Worked** — the lane commits in its own tree, may ask its MAIN a question
   (`POST /api/self/clarifications`), may schedule its own check-in (`server.ts#createAutoForSlot`),
   and may hand a preview run to another machine (`server.ts#claimLaneSuite`).
6. **Reported** — the lane files one typed report (`server.ts#openFleetReport`, status
   `complete · needs-main · failed · handoff`). The report is a message, never a state change.
7. **Landed** — `mergeJob` as above; conflicts may go through a resolver agent and a repair round
   (`server.ts#runMerge`, `server.ts#runRepair`), and the verdict is delivered to whoever landed.
8. **Audited** — tier 2, then adjudication.
9. **Deployed** — `POST /api/deploy` (`server.ts#deployVerb`) rebuilds the client bundles and
   restarts the server; because the restart kills the process, the verdict is written by the next
   boot (`server.ts#judgeDeploy`) and read back at `GET /api/deploys`.

Every step leaves a row somewhere: security events in `audit.jsonl` (`server/audit-log.ts`), how a
lane ended in `lane-outcomes.jsonl` (`server.ts#buildLaneOutcome`), audits in
`post-land-audits.jsonl`, reports in `fleet-reports.jsonl`, sends in `streams/prompts.jsonl`, and
what a lane was actually given in `context-receipts.jsonl`. `server.ts#laneDossier` is the join over
them for one lane.

## Harness adapters

A harness is *how* an agent runs — not just which model. Each adapter (`server.ts` `Harness`)
declares its spawn line, whether it can host a throwaway worker session, how to read its context
usage, whether it pins a session id at spawn, which process names prove its agent is alive, and
which pane screens silently eat a pasted prompt. Seven are registered today
(`server.ts#HARNESSES`): the default Claude adapter, three Pi variants, an unfenced Pi, a
containerised one, and Codex. `server.ts#harnessOf` resolves an id, and model and effort are
validated against *that* adapter at set time, so a spawn line can never carry a value the adapter
never admitted. Only adapters that declare themselves automatable may be started unattended, and
even then only with `FLEET_HARNESS_AUTOMATION=1`. Design notes: `docs/harness-adapter.md`.

## The dashboard

One page, one bundle: a terminal grid with xterm.js and direct stdin, a sidebar of all slots with
activity dots, a queue board that renders each row's lifecycle, card, file surface and brief
(`src/client.ts#renderQueue`, `#renderQueueDetail`) and a Programs view (both on ice), an ops dialog, a per-pane
conversation view that renders the agent's transcript as structured messages, a directory picker,
prompt history, export, and share links — and below 700px the same page becomes a phone layout with
a key row, a live-typing bar and a keyboard-safe shell. The guest share page, the helper portal and
the landing page are separate documents in `public/`.

## Ops

The recommended setup is the launchd/systemd watchdog (templates in `ops/`, beside the container's
`ops/Dockerfile`), which survives crashes *and* reboots and is
also where the live land-path configuration is written: `watchdog.sh` holds the spawn line, and
`FLEET_VERIFY_CMD`, `FLEET_POSTLAND_AUDIT_CMD` and `FLEET_CLEAN_REVIEW` on it decide what the gate,
tier 2 and the advisory reviewer actually do. `bun run build` rebuilds the client bundles;
`./e2e-isolated.sh` runs the full suite against a throwaway instance on its own tmux socket and port,
and `bun e2e/pins.ts` is the millisecond-fast first stage that catches drift no compiler sees.
`bun tools/review-sweep.ts` and `bun tools/repo-map.ts` are the read-only sensors over the tree itself;
the other command-line tools sit beside them in `tools/`.

Fleet keeps its state next to the code unless told otherwise: `fleet.json`, its lock, `streams/` and
every ledger land in the repo root on first start (`server/state-dir.ts`). Set `FLEET_STATE_DIR` to
keep them out of the tree.

Env worth knowing: `FLEET_HOST`, `FLEET_PORT`, `FLEET_SOCK`, `FLEET_TOKEN`, `FLEET_ALLOWED_HOSTS`,
`FLEET_STATE_DIR`, `FLEET_CMD`, `FLEET_SEPARATE_LANE_SLOTS`, `FLEET_MAX_SESSIONS`,
`FLEET_HARNESS_AUTOMATION`, `FLEET_VERIFY_CMD`, `FLEET_POSTLAND_AUDIT_CMD`, `FLEET_SHARE_HOSTS`.
The dispatcher, on ice, reads `FLEET_DISPATCH_REPO` and `FLEET_DISPATCH_MAX_LANES` (default 3).

## Where the parts on ice live

These parts are on ice. They still compile, run their tests and hold pins in
`e2e/pins.ts`. Each place is named by its symbol, which survives changes to server.ts.

- **Task queue.** `server/types.ts#Task`, `#TASK_KINDS`;
  `server.ts#archiveTask`, `#releaseTask`, `#briefAndSend`;
  `start-plan.ts`, `task-waves.ts`, `task-land-waves.ts`, `waits.ts`; the client's queue board and
  Programs view in `src/queue.ts`; the verbs `task`, `dispatch` and `commit-main` in `ctl.sh#CTL_VERBS`;
  `register.sh`, which reads `briefs/`.
- **Cards.** `card-extract.ts`; `server.ts#tickCardSweep`, off unless `FLEET_CARD_MS` is
  set (`server.ts#CARD_TICK_MS`).
- **Dispatcher.** `server.ts#tickDispatch`; off unless the runtime flag `server.ts#dispatchOn`
  is switched on and `FLEET_DISPATCH_REPO` (`server.ts#DISPATCH_REPO`) names a repo.
- **Variant comparison of queue rows.** `server.ts` (section “THE VARIANT COMPARISON”), `variant-compare.ts`.
- **Programs and their MAIN sessions** (the few still open keep running). `server/types.ts#Program`, `#PROGRAM_STATUSES`; `server.ts#programExecutionView`, `#boundProgramForMain`,
  `#selfLandTaskForMain`, `#succeedProgramMain`, `#bootstrapProgramMainReserved`, `#handleOwnerProgramRoute`; `program-phase.ts`;
  `promote-program.sh`.

No longer used, and still in the code:

- **Steward role.** `server.ts#handleStewardSend`, `#handleStewardRoute`;
  `.claude/commands/steward.md`, `rundgang.md`, `inspektion.md`, `projekt-blick.md`, `foreman.md`.

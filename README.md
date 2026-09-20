# Claude Fleet

**A local control plane that runs coding-agent sessions in tmux panes, hands each one a queue row
to work in an isolated git worktree, and lets that work reach the integration branch only through a
verify gate it cannot talk its way past.**

It is a web dashboard (desktop + mobile) over 16 persistent tmux-backed sessions on one machine,
plus the machinery around them: a queue, isolated lanes, Programs, a land path with a proportional
proof, a post-land audit, and append-only ledgers. `SYSTEM.md` describes a target model that the
code does not fully implement; this file describes what the code does today. Where they disagree,
the code wins. Fork of [claude-deck](https://github.com/jp290/claude-deck).

![claude-fleet — four agent sessions in a 2×2 grid](docs/screenshot.png)

**Requirements:** [Bun](https://bun.sh), tmux, at least one agent CLI, macOS or Linux.

```sh
bun install
bun run build
bun server.ts            # binds 127.0.0.1:8790 unless FLEET_HOST/FLEET_PORT say otherwise
```
On boot the server prints a one-click login URL carrying the access token — but only when stdout is
a terminal; redirected to a log it withholds the token, which then has to be read out of
`fleet.json`. The token goes into a `SameSite=Strict` cookie, so you log in once per browser.

## The core objects

**Slot and session.** A slot is one of 16 fixed places (`server/types.ts#MAX_SLOTS`), each backed by
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

**Task and kinds.** A queue row (`server/types.ts` `Task`) carries text, an optional compiled brief,
a target repo, a chosen agent (`spawn`), a file surface and a card. Four kinds exist
(`server/types.ts#TASK_KINDS`) and only `auftrag` is executable — `richtung`, `notiz` and `betrieb`
are advisory and every dispatch path skips them. A row is created `pending` and only an owner act
moves it to `queued` (`server.ts#releaseTask`); text arriving through the public intake address is
data until then, never a command.

**Program.** A Program is an owner-confirmed bracket around rows, with a bound Project MAIN session.
Its statuses are `proposed · confirmed · active · complete` (`server/types.ts#PROGRAM_STATUSES`) and
only the owner promotes between them. A bound MAIN gets its own doors — file a row, release it,
raise attention, read a derived lifecycle projection (`server.ts#programExecutionView`) — and
`server.ts#boundProgramForMain` is what decides whether a caller has that binding at all.

**Land.** Landing is a server-side job, not a git command an agent runs: `server.ts#mergeJob`
rebases the lane, takes the machine-wide suite mutex, runs the verify command, and only then
fast-forwards the integration branch (`server.ts#advanceIntegration`, `server.ts#recordLand`). A
verify that was skipped, timed out, or never started because it sat in the mutex queue is treated as
*no verdict about this tree* and does not auto-land; the owner keeps the latitude to land anyway.

**Audit.** After a land, an optional second tier re-runs the full suite against the landed tree
(`server.ts#drainPostLandAudits`, `server.ts#runPostLandAudit`) and writes one row per run. It is off
unless `FLEET_POSTLAND_AUDIT_CMD` is set. A red audit is not automatically a regression: it is
adjudicated (`server.ts#writeAuditAdjudication`), including carrying a known flake forward, and the
verdict reaches the Programs whose rows the land covered.

## The life of one row

1. **Filed** — owner, public intake, a steward pulse, or a bound Program MAIN writes a `pending` row.
2. **Compiled** — optional sweeps turn the row's text into a brief (`server.ts#compileBriefs`) and a
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

## Security and trust model

A reachable fleet is **remote code execution as your user** — every session is a shell. In order:

1. **Bind address** — loopback by default. `FLEET_HOST` should only ever name a private address on a
   network you trust end to end; traffic is plain `ws://`, so anything but an encrypted overlay is
   sniffable.
2. **Owner token** — required on every API and WebSocket request (`server.ts#tokenGate`), generated
   on first boot, persisted in `fleet.json` at mode 600, overridable with `FLEET_TOKEN`. It is the
   whole owner authority: there is one principal, not accounts.
3. **Self-token** — each session additionally holds a scoped credential (`Slot.selfToken`) that can
   only ever act on its own slot. It is what makes `/api/self/*` safe to hand to an agent: the route
   binds to the token's slot, a `slot` field in the body is ignored, and lane-only doors answer a
   non-lane `409`, never `401`. Because the credential is exported into the pane's shell, it is
   visible in that machine's process list — a hygiene fact, not isolation. Scope list:
   `docs/self-api.md`.
4. **Share links** — a share is a *window*, not an account: password-gated, view-only, one slot, and
   served on its own hostname set (`FLEET_SHARE_HOSTS`) where everything else 404s. See
   [SHARING.md](SHARING.md).
5. **Cross-site guards** — `SameSite=Strict` cookie plus Origin and Host checks
   (`server/auth.ts#guard`) block cross-site WebSocket hijacking, CSRF and DNS rebinding. Reaching
   the fleet by hostname needs that name in `FLEET_ALLOWED_HOSTS`.
6. **Session command** — defaults to the plain CLI with its own permission prompts; unattended mode
   is an explicit opt-in via `FLEET_CMD`. Stream files and state are chmod 600/700, because terminal
   output contains secrets.

Not provided: TLS, multiple users, rate limiting. Two suites hold the perimeter rather than one:
`e2e/security.ts` pins which routes are reachable *above* the owner gate at source level, and
`fleet-e2e-security.ts` (run by `./e2e-security.sh`, which the land gate runs) drives the share
brute-force lockout, the injection charsets, the self-token's out-of-scope refusals, and the proof
that a `pending` row is never dispatched.

## The dashboard

One page, one bundle: a terminal grid with xterm.js and direct stdin, a sidebar of all 16 slots with
activity dots, a queue board that renders each row's lifecycle, card, file surface and brief
(`src/client.ts#renderQueue`, `#renderQueueDetail`), a Programs view, an ops dialog, a per-pane
conversation view that renders the agent's transcript as structured messages, a directory picker,
prompt history, export, and share links — and below 700px the same page becomes a phone layout with
a key row, a live-typing bar and a keyboard-safe shell. The guest share page, the helper portal and
the landing page are separate documents in `public/`.

## Ops

The recommended setup is the launchd/systemd watchdog, which survives crashes *and* reboots and is
also where the live land-path configuration is written: `watchdog.sh` holds the spawn line, and
`FLEET_VERIFY_CMD`, `FLEET_POSTLAND_AUDIT_CMD` and `FLEET_CLEAN_REVIEW` on it decide what the gate,
tier 2 and the advisory reviewer actually do. `bun run build` rebuilds the client bundles;
`./e2e-isolated.sh` runs the full suite against a throwaway instance on its own tmux socket and port,
and `bun e2e/pins.ts` is the millisecond-fast first stage that catches drift no compiler sees.
`bun review-sweep.ts` and `bun repo-map.ts` are the read-only sensors over the tree itself.

Env worth knowing: `FLEET_HOST`, `FLEET_PORT`, `FLEET_SOCK`, `FLEET_TOKEN`, `FLEET_ALLOWED_HOSTS`,
`FLEET_CMD`, `FLEET_DISPATCH_REPO`, `FLEET_DISPATCH_MAX_LANES` (default 3),
`FLEET_HARNESS_AUTOMATION`, `FLEET_VERIFY_CMD`, `FLEET_POSTLAND_AUDIT_CMD`, `FLEET_SHARE_HOSTS`.

## Known limits

- **One suite at a time.** The verify gate, the previews and the audit all serialize on a single
  machine-wide lock (`server.ts#holdSuiteLock`). A land can therefore wait minutes for the machine
  without ever looking at its own tree, and the code says so rather than calling it a red.
- **The suite is not deterministic.** Known flake families are tracked in `docs/verify-tiering.md`
  and adjudicated per audit row; a green re-run at a base rate of a few percent proves little, which
  is why the trail register exists instead of a re-run rule.
- **Caps are blunt.** Lanes per repo, tasks, programs, watches, autos and report sizes are all fixed
  numbers in `server.ts`. They bound damage; they do not schedule intelligently.
- **The land path mutates a tree someone may be sitting in** — if a worktree has the integration
  branch checked out, the fast-forward happens inside it (`docs/land-mechanics.md`).
- Single shared owner token, no TLS, no rate limiting: the private network is part of the trust
  boundary.
- `streams/*.raw` grow unbounded; killing a slot deletes its stream.
- One terminal size per session, last writer wins — two clients on one slot fight over width.
- xterm is pinned at 5.5.0; 6.x removed the overflow-scroll viewport the mobile scrollback depends on.

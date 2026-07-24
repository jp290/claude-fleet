# HANDOFF — 2026-07-24 (session 2, land-hardening → autonomy substrate)

*A thin map, NOT the knowledge — durable findings live in docs/BACKLOG/memory. Treat every line as a
claim to verify (look up commits/states/counts before building on them).*

## State: shipped + DEPLOYED this session (live `srv` restarted 19:11, HTTP 200)

Main HEAD `13ecc50`. In order landed to main + deployed:
- **Tiered land gate** (`b30c746`) — land `VERIFY_CMD` is now `tsc && ./e2e-claude-gate.sh` (fast e2e
  behaviour tier joins tsc). watchdog.sh change → needed a `launchctl kickstart`.
- **Resolver↔verify repair loop** (`ee4670f`) — a CONFLICT resolution that rebases clean but fails verify
  is fed the failure and self-repairs up to `FLEET_MERGE_REPAIR_ROUNDS` (default 2) instead of dead-ending.
  Never changes what auto-lands (conflict path always stops).
- **①a land-ledger enrichment** (`626fe5d`) — the `landed` outcome record now carries the calibration
  facts `{resolvedConflict, repairRounds, confirmedByHuman}`. Pure additive recorder change.
- **② clean-path advisory reviewer** (`a23b1ea`) — **OFF by default** (`FLEET_CLEAN_REVIEW`). Downgrade-only
  + fail-closed brake on the clean auto-land. Deployed but inert until enabled.

Verify state: `git log --oneline -6 && tmux -L claudefleet ls | grep srv && curl -s -o /dev/null -w '%{http_code}' http://100.64.0.1:8790/`.

## The honest autonomy picture (read this before "adding autonomy")

**None of the above added landing autonomy** — it built the *substrate* autonomy requires (the doctrine's
forced order: reversibility + documentation + a calibration ledger first). ② is a *brake*, not a throttle.
The one move that adds autonomy is the **graded auto-land of conflict resolutions** (component 5 in
`docs/lane-autonomy-future.md`) — today they always stop for a human. **Owner decision 2026-07-24:
accumulate ledger data first, then graduate.** Mechanism is ready to build opt-in/off when the data justifies it.

**BLOCKER surfaced this session — the ledger is EMPTY.** `/api/lane-outcomes` total=0; `lane-outcomes.jsonl`
doesn't exist on live. 9 `fleet/land` notes exist but all predate the #18 recorder. Outcomes emit ONLY from
Fleet's own land/kill/shelve/undo routes (`landLane` etc.) — a `git merge` hand-land or main-checkout dev
records **nothing** (this session's own lands went in via `git merge`, so they're not in the ledger).
→ **Accumulate-first is inert until agent lanes are dispatched + landed *through Fleet*.** This is a
workflow question for the owner, not a code gap. Full detail: `docs/merge-review-autonomy.md` §7 tail.

## Recommended next (reasoned, owner to confirm)

1. **③ the `🔍 review` agent on lane diffs** — the robust next build: immediate dev-velocity value (attacks
   the human-review bottleneck, the owner's own "elevate dev speed" instinct) and it's *independent of the
   stalled accumulation*. Reuse the `✨ summarize` plumbing exactly (throwaway interactive claude,
   transcript-read, git-state-keyed cache, single-flight, `idleTimeout:240`); mirror `POST /api/slots/:id/summary`
   as `/review`. Advisory + click-only, never gates (BACKLOG #14 Phase 2 binding). Care lives in the critic
   PROMPT (cite file:line, rank by impact, separate verified-from-diff vs inferred).
2. **①b the review-feed UI** — autonomy component #6: render the (enriched) `/api/lane-outcomes` as
   "what landed, its shape, was it undone." Anti-drift: no derived state, recompute per render, correlate
   landed↔reverted BY BRANCH, show facts never a verdict. *Do this once the accumulation question is settled*
   — a feed over an empty ledger is premature.
3. **④ knowledge/retrieval layer** (BACKLOG #17) — owner does this 1:1 with Fable 5, dedicated session.

## Load-bearing gotchas discovered this session

- **The land ledger already existed (#18)** — don't rebuild it; ①a only *enriched* it. Outcomes come only
  from Fleet's land/kill routes (above).
- **A fresh lane worktree briefly holds a git index lock** (`tickGit` polls right after `git worktree add`),
  so an immediate `git commit` can *silently fail* → the lane has no commit → merge treats it as at-main.
  e2e must retry-until-in-log. (Cost me a long debug in the ② harness.)
- **Three e2e harnesses now**, all `$$`-isolated + concurrency-safe: `e2e-isolated.sh` (main),
  `e2e-claude-gate.sh` (claude-alive gate), `e2e-clean-review.sh` (② reviewer, boots with `FLEET_CLEAN_REVIEW=1`).
  Full verify runs all three. Known pre-existing flake in e2e-isolated: `FLEET_SELF_TOKEN absent for a
  non-lane slot` (~600ms pane-capture race) — fixing it would let e2e-isolated graduate into the gate.
- **Leftover leaked test instances** from PRIOR sessions still running: `bun server.ts` pids on sockets
  `fleettest23870` (Jul 23), `fleetlane99`/port 8899 (Jul 21), one from Jul 18. None on live `claudefleet`.
  Not cleaned (8899 unconfirmed) — owner's call.

## Deploy / enable ritual (owner-only)

- server.ts/client deploy: `tmux -L claudefleet kill-session -t srv` (watchdog respawns in ~5s; sessions
  survive). Client changes need `bun run build` first. Health: `curl http://100.64.0.1:8790/` (Tailscale IP only).
- watchdog.sh changes additionally need `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`.
- **Enable ② :** add `FLEET_CLEAN_REVIEW=1` to the srv-spawn line in watchdog.sh, then kickstart.

## Where the durable knowledge lives

`docs/merge-review-autonomy.md` §7 (land-hardening program state) · `docs/lane-autonomy-future.md` (the
autonomy doctrine + 2026-07-24-later status) · `BACKLOG.md` (register) · memory: `project-fleet-land-hardening`,
`project-fleet-landing-autonomy`.

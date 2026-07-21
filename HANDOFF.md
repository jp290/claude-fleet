# HANDOFF — stream/share harness + worktree (lane) management

Session focus: **share-page (stream harness) quality** + **worktree lane management**. All work committed to `main` and deployed live (`http://100.64.0.1:8790`). Working tree clean, tip = `d360876`.

## Status

### Shipped this session (all on `main`, all deployed + health-checked)
- **Guest share page — comments** (`67284c2`): per-share 💬 thread, both view/interact modes, flood-guarded (10/min), owner-moderated in the share dialog; guest QoL (viewer count, A−/A+ font, jump-to-latest, session commits in ±changes).
- **Guest page redesign** (`e73673f`): modals replaced by a right **sidebar** (info / chat / changes tabs), live telemetry strip (pulse LIVE/OFFLINE, viewers, uptime, branch), unread chat badge, slide-over on narrow viewports. New `GET /s/:id/brief` via shared `briefPayload` (owner doc minus local paths).
- **Two-way chat + guest ✨ summary** (`693235e`): owner replies from the share dialog land in the guest thread marked `from:"owner"` (highlighted); 💬 badge + hover action on slot tiles; `GET/POST /s/:id/summary` behind the share cookie via extracted `summaryResponse` (single-flight + git-state cache key bounds agent spends).
- **Worktree lifecycle v2** (`269fe07`, `2e348c1`) — merged from a lane the owner had worked in; then hardened here:
  - Attach TOCTOU fix (`4ef89aa`): `attachBusy` reserves the worktree, not just the slot.
  - Merge-agent robustness (`62f8cfd`): the agent's JSON is narrative, never authority — an off-contract/prose answer over a git-verified rebase falls through to the same git check instead of being discarded as error. Found via a live prompt-injection probe (agent ignored a hostile commit subject, rebased correctly, answered in prose).
  - **Script-first hybrid** (`7173a7e`): `⏫` tries a scripted `git rebase` first; a conflict-free rebase lands in ~1s with **no model spawn** (verified live). The agent runs only on real conflicts, primed with the conflicted-file list.
  - **Review gate** (`e872ded`): conflict resolutions record a git-verified but **UNLANDED** `resolved` verdict and pause; owner reviews the diff (`GET /api/slots/:id/merge-diff`) and lands via `POST /api/slots/:id/merge {confirm:true}`, re-verified purely by git (main is ancestor of the clean lane branch; refuses if main moved). Board "review, then land" card + slot-tile ⏸ badge (cheap in-memory `mergePending` flag).
  - **Worktree brief fixes** (`d360876`): see Key Decisions — four git-truth bugs.

### Working / known-good
- `./e2e-isolated.sh` + `./e2e-claude-gate.sh` → **237 checks, ALL PASS** (last run at `d360876`). tsc + `bun run build` clean.
- The whole ⏫ flow (clean auto-land, conflict → pause → review → confirm-land, stale-main refusal) verified live with a **real** claude agent, not just the stand-in.
- Board lane brief now matches actual `git` byte-for-byte (commits, footprint, ahead/behind, uncommitted status).

### Not done (deliberate scope cuts — not broken)
- Guest transcript view: **not built** — needs a privacy decision (transcripts can carry secrets, like prompt history). Open question below.
- `mergeLast` (the `resolved` review verdict) is **in-memory only**: a server restart between resolution and review drops the pending flag. Resolution is still safe on disk; re-running ⏫ finds it already-rebased and lands cleanly. Acceptable; persist only if it bothers the owner.
- Lane map shows per-lane dirty **counts**, not file lists (only the focused lane shows concrete files). Clicking an uncommitted file opens the whole diff, doesn't scroll to the file.

## Next Steps
1. **Owner UX gut-check** on the live instance: does the review card wording + diff→land flow, and the new lane info card (uncommitted files, "commits on this lane"), feel right? This is the one thing testing can't confirm.
2. If wanted: **guest reactions** (👍 on the stream) and **owner replying to chat from the dashboard board** (currently only from the share dialog).
3. If wanted: **persist `mergeLast`** so the review gate survives a deploy.
4. Possible follow-up: guest read-only transcript view — **blocked** on the privacy decision (below).

## Key Decisions
- **Review gate on conflicts (owner chose "pause for owner review").** Clean rebases auto-land (no judgment); conflict resolutions pause because landing an unseen semantic merge to main was the one place the repo's "nothing lands on the agent's word" philosophy was stretched. Confirm-land is git-anchored (`merge-base --is-ancestor`), never verdict-trust.
- **Script-first merge.** Most rebases don't conflict; a model session for those is minutes+tokens for nothing. Script handles mechanics, the agent is reserved for the judgment (conflict resolution). A blanket `-X theirs` would make it fully scriptable but silently discards a side's work — forbidden.
- **Lane brief is lane-scoped, not time-scoped.** A worktree lane has an exact base branch, so its commits = `base..HEAD` (two-dot log) and its footprint = `base...HEAD` (three-dot diff, from the merge-base, so a lane behind main doesn't show main's divergence inverted). Non-lane sessions keep the transcript-time heuristic.
- **`git()` trims stdout → corrupts porcelain columns.** The leading space of the first `git status` line (` M path`) was stripped, truncating the first filename and mis-reading staged/unstaged. New `statusLines()` preserves columns; all column-accurate status parsing routes through it. Caught by *looking* at the rendered board — verify against real git, not code intent.
- **ahead/behind vs base, not upstream.** A lane has no upstream, so the sessions-poll `gitInfo` (branch.ab) reports 0/0. Board STATE now computes it against the base branch via `rev-list --left-right`.

## Context to Restore
Re-read, in priority order:
- `CLAUDE.md` — lane discipline, the verification command, deploy steps, the Fable-5 safeguard note, and the rules: never run a test server from the main checkout (it adopts live `fleet.json` + respawns real sessions — use an isolated copy à la `e2e-isolated.sh`); post-deploy health check hits `100.64.0.1:8790`, never localhost.
- `server.ts` (~2200 lines) — key regions: `briefPayload`/`laneBaseRef`/`statusLines`/`sessionCommits` (lane brief); `diffPayload`; the merge machinery `runMerge`/`mergeJob`/`tryScriptRebase`/`summaryResponse` and the `/api/slots/:id/merge` route with `{confirm}` + `/merge-diff`; share routes `/s/:id/(brief|summary|comments|diff)`.
- `src/client.ts` — `renderBoard()` (the info card / lane brief UI), `doMerge`/`doMergeLand`/`openMergeDiff`, slot-tile badges.
- `src/share.ts` — guest page (sidebar tabs, chat, summary, changes).
- `public/index.html` + `public/share.html` — owner + guest styles/markup (bundles `public/app.js`, `public/share.js` are gitignored build artifacts — run `bun run build`).
- `fleet-e2e.ts` — the merge/lane/brief e2e (git-truth checks in the lane-lifecycle block); `e2e-isolated.sh` has the `fakemerge`/`fakesum`/`fakeenh` stand-ins and the `mergemode` control file.

### Non-obvious state / how to run things
- **Deploy** = `tmux -L claudefleet kill-session -t srv` (watchdog respawns srv with new code; sessions survive). Client changes need `bun run build` first. `watchdog.sh` changes need `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog`.
- **Verify** = the tsc one-liner in CLAUDE.md, then `bun run build && ./e2e-isolated.sh && ./e2e-claude-gate.sh` (own socket/port, safe). Judge by the tail "ALL PASS".
- **Interactive/visual test instance**: copy `server.ts`+`public` into a scratch dir + isolated git repo, run with `FLEET_HOST=127.0.0.1 FLEET_PORT=88NN FLEET_SOCK=fleetXX FLEET_CMD=true FLEET_TOKEN=... bun server.ts`; drive with Playwright; `tmux -L fleetXX kill-server` when done. NEVER from the main checkout.
- Live token: read from `fleet.json` (mode 600) — not printed to non-TTY.

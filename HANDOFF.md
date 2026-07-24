# HANDOFF — 2026-07-24 session (DEPLOYED)

*A thin map, NOT the knowledge — the durable findings live in the docs/BACKLOG/memory homes
below. Treat every line as a claim to verify (look up commits/states before building on them).*

## State: everything landed AND deployed

`srv` restarted 2026-07-24 15:38 (positively verified — new routes answer, not just health 200).
Main HEAD `c8cc5f6`. Live now: audit view + honest count (#9), `DEFAULT_MODEL` spawn-pin, the
commit-cursor fact layer (`sinceLastLook`, sha-grounded outcomes), the per-lane outcome recorder
(`/api/lane-outcomes`, #18), both e2e flake fixes, and the V3-input resolver briefing.

Verify state: `git log --oneline -8 && tmux -L claudefleet ls | grep srv && curl -s -o /dev/null
-w '%{http_code}' http://100.64.0.1:8790/`.

## Where the knowledge lives (go here, not to a fat handoff)

- **`docs/merge-review-autonomy.md` §7 "Status 2026-07-24"** — the canonical **land-hardening
  program** state: V1 verify shipped; V3 briefing input-half done / output-contract + hunk-capture
  remain; the **tiered-gate finding** (e2e-isolated is deterministic now but >2min > the 120s
  verify timeout → fast-tier gates + slow-tier audits, NOT "add e2e to the verify").
- **`docs/lane-autonomy-future.md`** — the merge/land **autonomy doctrine** (reversibility-primary
  graded gate, six components, the ladder). The 2026-07-24 note there = the first concrete
  gate-fitness data it asked for. Landing is autonomy-*eligible* (recoverable via undo-land),
  gated on a total+fast+flake-free verify — which this session showed we don't yet have.
- **`BACKLOG.md`** — the register (land-hardening entry + "full session DEPLOYED + program state"
  note): retired ideas (rerere, hard-block — don't re-propose), open follow-ups.
- **memory/** — cross-session gotchas: `project-fleet-land-hardening`,
  `project-fleet-landing-autonomy`, `project-fleet-steward-watched-probe`.

## Immediate follow-ups (all in BACKLOG's 2026-07-24 program note)

1. 1-line: outcome recorder `model: s.model ?? DEFAULT_MODEL` (attribution now possible + pinned).
2. The **tiered gate**: the uncommitted `watchdog.sh` draft (`tsc && e2e-claude-gate`) is the
   fast-tier start — validate it runs in the runVerify context, commit, ONE `kickstart`. The slow
   full suite becomes a post-land audit (design work).
3. Stale-proposal reaper (steward hand-does it; `branch@headSha` makes it deterministic).
4. Map follow-ups ② (mechanical-conflict determinism) + ⑤ (verdict/staleness as review headline).

## Steward — P-3 RESOLVED

Fed a real done lane, the steward filed the **first real proposal ever** (`afcf3eac`) and correctly
displayed-not-re-filed it. "No steward proposal has ever existed" is now FALSE — do not rebuild on
it. `afcf3eac` is now stale (its lane landed) → dismiss it. See `project-fleet-steward-watched-probe`.

## Load-bearing gotchas (full detail in memory)

- **`git merge` of a lane SILENTLY drops newer main work** (proved); the fleet lands by **rebase**
  which preserves it — NEVER hand-`merge` a lane branch. Trust `verify.ok` + `git show`, not the
  (mangle-prone) diff viewer.
- **`e2e-isolated` runs >2min** — too slow for the 120s land-verify timeout (the tiered-gate driver).
- **Desktop `bg-pty-host` sessions can hijack a fleet pane** via stray owner input; fresh lanes with
  new worktrees are isolated. Don't kill `bg-pty-host` procs to fix a slot (owner's desktop app).
- Leftover to clean: the abandoned `fleet-flake-waitmerge` worktree (superseded by `-v2`, landed).

## Deploy ritual (owner-only)

`tmux -L claudefleet kill-session -t srv` → watchdog respawns (5s poll — wait >5s before health-
checking) → `curl http://100.64.0.1:8790/` (Tailscale IP only). Client changes need `bun run
build` first. Watchdog.sh changes additionally need `launchctl kickstart -k
gui/$(id -u)/com.claude-fleet.watchdog`.

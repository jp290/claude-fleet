# HANDOFF — session of 2026-07-19 (lanes shipped; next: BACKLOG #14)

**Update later that day:** BACKLOG #14 Phase-1 core is MERGED + LIVE-DEPLOYED
(commits `273dbd9`+`cdd7bdb`, verified ALL PASS, server restarted, HTTP 200):
the "session brief" right sideboard (ℹ toggle) — git facts via new
`/api/slots/:id/brief` + prompt outline with jump-to-prompt. Design decisions
binding for Phases 2–3 are recorded in the #14 update block; new items #15
(vocabulary layer) and #16 (orphan-reap on kill) await. The stray
`docs/knowledge-corpus` lane was removed (work was already in main). Push to
origin is STILL blocked (gh auth) — local main is now ~37 ahead.

**Second update:** #14 Phase 2 ✨ summary is MERGED + LIVE (through `44f3bff`):
background INTERACTIVE claude session (subscription, NOT `claude -p` — that
bills the metered API), answer read from the transcript JSONL, Sonnet 5 default.
Board ℹ toggle moved into the pane beside 💬; collapsed rail fixed (hides 🗒).
Note: claude login expires ~2026-07-23 ("run /login") — renew BEFORE the
Tuesday interview. All four verification suites ALL PASS at merge time.

Written for a fresh session — ideally started **inside a Fleet lane** (see "Starting
a lane" below; verify you're actually IN the lane before prompting — this exact
mistake happened this session: a prompt meant for a lane landed in a main slot
instead, because the wrong sidebar row was clicked). Read this fully, then
`BACKLOG.md` item 14 (the concrete next mission), then `docs/README.md` +
`docs/tailored-context.md` for the "why" if you need it. Verify every claim you
build on — numbers here drift the moment another commit lands.

## Repo state RIGHT NOW

- `main` is clean. Check the exact push gap yourself: `git rev-list --count
  origin/main..main` (was 34 at write time — will be higher by the time you read
  this). **Push is blocked**: the logged-in `gh` account `other-account` has only pull
  access to `jp290/claude-fleet` (403 on push). Needs `jp290` auth or a write-collab
  grant. Not your problem to fix unless asked — just know local `main` is ahead and
  stays ahead until JP sorts auth.
- **A stray, unused lane exists**: `git worktree list` will show
  `claude-fleet.worktrees/docs-knowledge-corpus` on branch `docs/knowledge-corpus`
  (slot 16 in the dashboard). It's clean and one commit behind current `main` HEAD —
  it was spawned to do the documentation work, but that work happened by accident in
  a main-slot session instead (the mistake mentioned above). The lane itself is now
  pointless — either land it (`⏏`, should succeed cleanly) or repurpose it for your
  next task. Don't be confused finding it; don't redo docs work in it.
- Live server unchanged: tmux session `srv` on socket `claudefleet`, port 8790,
  Tailscale 100.64.0.1, watchdog under launchd. Public tunnel →
  klaus.example.com. Deploy = `tmux -L claudefleet kill-session -t srv`.
- e2e: **155 checks ALL PASS** (`./e2e-isolated.sh`), claude-gate ALL PASS, at time
  of writing — re-run, don't trust the number.
- `CLAUDE.md` is gitignored (private, never committed) but copied into every new
  lane — lane sessions already have the project rules, including two added this
  session: never run `bun server.ts` with default env inside a lane (drives the LIVE
  tmux socket, not a sandbox — likely cause of a historic "sessions vanished"
  incident); worktree isolation ends at the repo edge (anything outside — other
  repos, `~/.claude`, launchd, shared ports — is shared reality, stop and report).

## What shipped today (all live-deployed + verified, in order)

1. **Worktree lanes** — the core feature. Spawn (picker "⎇ new lane" →
   `git worktree add`), sidebar badges (branch/dirty/ahead, lifecycle-colored:
   amber=editing, green=ready), diff view (`±`, `/api/slots/:id/diff`), land (`⏏`,
   refuses dirty/unpushed, remove-first so a failed remove never orphans the lane),
   task queue (🗒) + idle dispatcher (OFF unless `FLEET_DISPATCH_REPO` set), public
   `/intake` dropbox (secret-gated, always creates a `pending` task — see
   `INTAKE.md` for the "email a feature request in" Cloudflare Worker recipe).
2. **Hardening** — two independent review passes found and fixed 5 real defects the
   e2e suite didn't cover: a dispatcher slot-race (could inject external task text
   into an unrelated session), orphaned worktrees on failed land, land wrongly
   refusing already-pushed-without-`-u` work, branch-name collisions, and — found
   live, not by a reviewer — `createWorktree` was copying `CLAUDE.md` unconditionally
   into new lanes, which made every fresh lane permanently dirty and unlandable
   until fixed to copy ONLY gitignored scaffolding (the `.worktreeinclude` rule).
   Also closed: the task↔lane lifecycle (`sent` tasks now resolve to `done` on land
   or `pending` on kill/recycle — no more duplicate re-dispatch after a restart).
3. **Documentation charter** (`docs/README.md`, `docs/tailored-context.md`,
   `docs/operating-model.md`, `docs/interaction-modes.md`, `docs/verification.md`,
   `docs/lane-brief-template.md`) — **DONE**, all checked off in the charter. This
   was the prior mission; it is no longer the open task. If you want the "why" behind
   the lane design, read these — but the next ACTION item is BACKLOG #14, not more
   documentation for its own sake.

## The next mission: BACKLOG.md item 14

Read the full entry — it's a phased plan (visibility → advisory review → structure
overview → optional smart-auto), converging four separate ideas JP raised into one
coherent arc. **Start with Phase 1**, and specifically the one sub-item that's
genuinely low-risk and needs no taste confirmation: the mechanical prompt-outline
(reusing the existing `.msg.user` DOM markers `jumpPrompt` already navigates,
`client.ts:342-343`, as a visible rail instead of only for ↑/↓ nav — zero new server
calls). The other Phase 1 items (per-repo lane accent color, signal surfacing) are
small but are UI/taste calls — confirm the approach with JP before shipping, the way
this session did for the lane restructure.

Do NOT jump to Phase 2 (advisory review agent) or Phase 3 (smart-auto message
classifier) without Phase 1 existing and being used for real first — the BACKLOG
entry explains why each phase depends on the one before it working, not just
existing.

## Starting a lane (recap)

Picker → pick the repo → "⎇ new lane" → name a branch (or leave blank for auto).
Fleet creates the worktree + opens Claude in it — you don't create the worktree
yourself. **Confirm you're in it** before prompting: the row has a colored left
accent, a ⎇ chip, and a lifecycle-colored branch badge; the pane title shows the
`.worktrees/...` path, not the bare repo path. Land with `⏏` when committed+pushed
(or merged) and clean — it refuses otherwise, deterministically, every time.

## Verify before/after any change

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh     # must end "ALL PASS" — read the tail, don't trust a remembered count
./e2e-claude-gate.sh  # claudeAlive() gate against a compiled stand-in `claude`
```
Deploy = `tmux -L claudefleet kill-session -t srv` (watchdog restarts with new code,
sessions survive). Client bundles (`public/app.js`, `public/share.js`) are gitignored
build artifacts — always `bun run build` before deploying client changes.

**Interview Tuesday 2026-07-22 uses session sharing on the public domain — keep
`main` stable and the server up. Nothing in BACKLOG #14 is urgent before then.**

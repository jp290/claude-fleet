# HANDOFF — session of 2026-07-19 (worktree lanes + automation direction)

Written for a fresh session that will run **inside a Fleet lane** to keep building
this. Read this, then `docs/tailored-context.md` (the conceptual foundation), then
`BACKLOG.md` items 10/13. Verify every claim here you can.

## What this session shipped (all live-deployed + browser-verified)

Feature: **worktree lanes** — turn the 16-slot fleet into a portfolio of isolated,
reviewable, landable units of work. Plus the automation scaffolding around them.

- **Lane spawn** — picker "⎇ new lane" → `git worktree add` under
  `<repo>.worktrees/<branch>`, opens a Claude session in it. `createWorktree` copies
  only *gitignored* scaffolding (`.env`, `CLAUDE.md`, `.claude/settings.local.json`)
  so the lane starts clean and stays landable (the `.worktreeinclude` rule).
- **Sidebar** — branch/dirty/ahead badge, lifecycle-colored (amber=editing,
  green=ready); lanes get a left accent + ⎇ chip + inline `±` (review) + `⏏` (land).
- **Diff view** (`/api/slots/:id/diff`) — colorized `git diff HEAD`, byte-capped,
  textContent-only. Overlay via `±`.
- **Land** (`/api/slots/:id/land`) — removes the worktree ONLY if clean AND
  (pushed to any remote / merged into HEAD). Remove-first ordering: a failed remove
  keeps the lane recoverable. Never eats work.
- **Task queue** (🗒) + **idle dispatcher** (OFF unless `FLEET_DISPATCH_REPO` set;
  pulls one `queued` task per tick into a fresh lane behind the claude-alive gate).
- **Public `/intake`** — secret-gated (`FLEET_INTAKE_SECRET`) feature dropbox on the
  share host; always creates a `pending` task. Cloudflare Email Worker recipe in
  `INTAKE.md` (the "CEO emails features in" address).
- Hardening from two review passes (5 real defects the 152 e2e checks missed) — see
  the two fix commits.

## Repo state RIGHT NOW

- **Branch `main` is 30 commits ahead of `origin/main`, UNPUSHED** (this session
  added the last 4: worktree feature, hardening+UI, tailored-context doc,
  handoff+gitignore — the rest are stale from prior sessions). Push is blocked: the
  logged-in gh account `other-account` has only pull access to `jp290/claude-fleet`
  (403). Push needs `jp290` auth (`gh auth login` as jp290, or add other-account as a
  write collaborator). Worth clearing this backlog once auth is sorted.
- Live server: unchanged deploy story — tmux session `srv` on socket `claudefleet`,
  port 8790, Tailscale 100.64.0.1, watchdog under launchd. Public tunnel →
  klaus.example.com. Deploy = `tmux -L claudefleet kill-session -t srv`.
- **e2e: 155 checks ALL PASS** (`./e2e-isolated.sh`), claude-gate ALL PASS.
- `CLAUDE.md` is now gitignored (was untracked) — so it is copied into every new
  lane, giving lane sessions the project rules. It stays private (never committed).

## The plan (agreed with JP) — the "tailored work environment" direction

The one hard bottleneck in a fleet of agents is **human review**. The lever is not
more parallelism but making each lane's first-pass output reliable enough that review
is a glance — which comes from the *context* a lane starts with, not from vigilance.
See `docs/tailored-context.md` for the principle (environment → silent capture of the
implicit complementary parameters → output only the relevant).

- **Phase 1 — per-lane model** (small, safe, do first): a `model` field on the lane →
  `--model` in `slotCmd` (server.ts ~35). Cheap model (Haiku) for well-specified
  lanes, Fable/Opus for hard ones. Composes with the brief: a foolproof brief lets a
  cheaper model succeed — tailoring is a cost lever, not just a review lever.
- **Phase 2 — lane brief at LAUNCH, not a file**: a bespoke per-lane task/environment
  brief passed via the session's initial prompt / `--append-system-prompt`, NOT
  written into the worktree (an unignored file would dirty the tree and block `land`
  — the bug fixed this session). Generated from the queue task text + a template;
  a default or input for hand-opened lanes.
- **Phase 3 — verify gate** (post-interview): a lane runs a repo-defined verify
  command on idle; only green flips the badge to "ready". Turns the idle heuristic
  into a real done-signal — "3 agents that earned a review", not "16 making noise".

## Working inside a lane on THIS repo — safe practices

- The lane branches off local HEAD, so it has all 5 unpushed commits. Good.
- Lane edits do NOT affect the live server until merged to main + `kill-session srv`.
  Write + review in the lane; merge to make it live.
- Run `./e2e-isolated.sh` freely inside a lane — it now refuses the live socket
  (guard added this session), so it can't touch the real fleet. `bun fleet-e2e.ts`
  directly is blocked unless `FLEET_E2E_ALLOW_LIVE=1`.
- `land` refuses dirty/unpushed — commit and push (or merge) before landing.

## Known issues (honest, out of scope this session)

- **Slot 1 shows `zsh: command not found: claude`** — the watchdog PATH issue from
  `CLAUDE.md`, pre-existing, unrelated to these changes.
- **`land` leaves the (merged) branch** on disk — only the worktree is removed.
  `fleet/*` branches accumulate. Open question in BACKLOG #10 (auto-delete merged?).
- A fresh lane's badge briefly shows the copied-scaffolding state until the first
  10s git tick; open-worktree warms it, so this is sub-second in practice.

## Verify before/after any change

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh     # must end "ALL PASS" (155 checks — verify by reading the tail, not this number)
./e2e-claude-gate.sh  # claudeAlive() gate against a compiled stand-in `claude`
```
Deploy = `tmux -L claudefleet kill-session -t srv` (watchdog restarts with new code,
sessions survive). Client bundles (`public/app.js`, `public/share.js`) are gitignored
build artifacts — always `bun run build` before deploying client changes.

**Interview Tuesday 2026-07-22 uses session sharing on the public domain — keep `main`
stable and the server up.**

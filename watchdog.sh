#!/bin/sh
# claude-fleet watchdog: keep the `srv` tmux session (the fleet server) alive.
# Runs under launchd (com.claude-fleet.watchdog, KeepAlive) so the fleet survives
# reboots — previously this loop lived in a tmux session that died with the machine.
# Env for the server lives HERE, in one place.
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
# launchd's default PATH has none of: claude (~/.local/bin), bun (~/.bun/bin), brew (tmux).
# The server bakes ITS OWN PATH into every pane command, so what's missing here is
# missing inside every new claude session too.
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
# everything this loop creates (server.log via the pane redirect) stays owner-only —
# the log carries cwd paths and, if the isTTY gate is ever defeated, the token
umask 077

# single-quoted PATH interpolation below needs embedded ' escaped (server.ts does the same
# for its own pane-command PATH bake-in) — otherwise a PATH entry containing a quote breaks
# out of the tmux command string and the remainder runs as shell syntax as this user
PATH_Q=$(printf '%s' "$PATH" | sed "s/'/'\\\\''/g")

# deterministic merge-verify (V1, server.ts runVerify): the server runs this against the
# REBASED lane tree at merge time. Repo-guarded — verifies the fleet repo, and in a
# foreign-repo lane prints a recognizable "skipped" line and exits 0 (honest, never a
# false red that would wedge a clean foreign-repo land in review). Per-repo config is the
# clean fix later (orchestrator-autonomy.md §6.2); this global guard is the V1-era honest form.
# TIERED land gate (docs/merge-review-autonomy.md §7, lane-autonomy-future.md component 4): tsc alone
# is type-total but behavior-partial — a rebase that drops a const together with its only use stays
# type-consistent, so tsc passes and the regression reaches main (observed). e2e-claude-gate.sh is the
# fast behavior tier: it boots the whole server.ts and drives real routes (open slot, autos, dispatch,
# model-pin, steward sends), so anything that breaks module-load or server boot is caught here that tsc
# misses. Honest scope boundary — it does NOT assert the share/guest or audit paths, so it is
# total-ENOUGH, not total; the slow full audit (e2e-isolated) stays a post-land check, undo-land the
# rollback. Deterministic (own $$ socket/dir, no known flake) and exit-codes correctly, so it hard-gates.
# e2e-claude-gate.sh itself was validated 2026-07-24 to run WITHOUT node_modules (server.ts imports
# only node:/bun:/local): ALL PASS from a node_modules-less tree in ~46s — that is the per-land cost.
# NOT added: e2e-isolated.sh — it carries the known ~600ms pane-capture flake; a deterministic gate
# cannot sit on a flaky suite, so it graduates in only once that flake is fixed.
# The `bun install` prelude is the FIRST step, and it is what makes this gate deterministic (F9,
# docs/discrepancy-audit.md): the tsc step needs @types/bun, which lives in gitignored node_modules,
# and NOTHING in Fleet establishes it in a lane — createWorktree copies only .env/CLAUDE.md/settings,
# `git worktree add` installs nothing, and bunx does not populate node_modules. Without the prelude
# the gate's verdict depends on whether that lane's agent happened to install: it dies in ~2s on
# "error TS2688: Cannot find type definition file for 'bun'" and never reaches the behavior tier, so a
# sound rebase is downgraded to stop-for-human and `verified:false` pollutes the outcome ledger.
# Proven-dead alternatives (do not re-propose): dropping --types bun (the code genuinely uses Bun/
# process/import.meta.dir — 20+ errors), and a checked-in tsconfig with "types": ["bun"] (identical
# TS2688 — the types field NAMES a package, it cannot substitute for one). Costs ~30ms from bun's
# global cache; --frozen-lockfile keeps it read-only w.r.t. bun.lock, and a failure exits non-zero
# with a named reason instead of masquerading as a type error.
VERIFY_CMD='[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 0; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts && ./e2e-claude-gate.sh'
VERIFY_Q=$(printf '%s' "$VERIFY_CMD" | sed "s/'/'\\\\''/g")

while true; do
  if ! tmux -L claudefleet has-session -t '=srv' 2>/dev/null; then
    # PATH must be baked INTO the pane command: the pane's shell inherits the tmux
    # SERVER's env (often the bare launchd default without brew), not this script's
    if tmux -L claudefleet new-session -d -s srv \
      "export PATH='$PATH_Q'; cd '$FLEET_DIR' && FLEET_HOST=100.64.0.1 FLEET_ALLOWED_HOSTS=cowork.example.com,klaus.example.com FLEET_SHARE_HOSTS=cowork.example.com,klaus.example.com FLEET_SHARE_URL=https://cowork.example.com FLEET_VERIFY_CMD='$VERIFY_Q' exec bun server.ts >> server.log 2>&1"; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv was down, restarted" >> "$FLEET_DIR/server.log"
    else
      # log the truth: an unconditional "restarted" here used to fill the log with
      # success lines during the exact outage it should have documented
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv down and RESTART FAILED (tmux error)" >> "$FLEET_DIR/server.log"
      sleep 25 # back off — a broken tmux/deploy isn't fixed by hammering every 5s
    fi
  fi
  sleep 5
done

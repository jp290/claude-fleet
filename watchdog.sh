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
# everything this LOOP creates stays owner-only. Note what that is and is not: it does NOT
# cover the srv pane or anything the server writes. The pane's shell is a child of the tmux
# SERVER, not of this loop, so it inherits neither this umask nor this PATH — the same
# inheritance gap already documented for PATH a few lines up, and the reason the pane command
# below sets its own `umask 077`. Measured proof that this line never reached the server:
# server.log, created by that pane's own redirect, was -rw-r--r-- (data-audit-2026-07-27 item 9).
umask 077

# single-quoted PATH interpolation below needs embedded ' escaped (server.ts does the same
# for its own pane-command PATH bake-in) — otherwise a PATH entry containing a quote breaks
# out of the tmux command string and the remainder runs as shell syntax as this user
PATH_Q=$(printf '%s' "$PATH" | sed "s/'/'\\\\''/g")

# deterministic merge-verify (V1, server.ts runVerify): the server runs this against the
# REBASED lane tree at merge time. Repo-guarded — verifies the fleet repo, and in a
# foreign-repo lane prints a recognizable "skipped" line and exits VERIFY_SKIP_EXIT=42
# (server.ts, grep VERIFY_SKIP_EXIT), which records the verdict as SKIPPED — a state of its own,
# never a pass and never a false red. It used to `exit 0` here, which the server could not tell
# apart from "ran the whole gate, all green": a foreign-repo lane — or a FLEET lane that moved or
# renamed fleet-e2e.ts — auto-landed with `verified: true` behind a gate that executed nothing.
# The cost of the fix, taken deliberately: a skipped verify no longer auto-lands, so a lane in a
# repo this command does not know stops for one owner click instead of landing unattended.
# Per-repo config is the clean fix later (orchestrator-autonomy.md §6.2); this global guard is the
# V1-era honest form. NOTE: this string is baked into the srv-spawn line below and only reloads on
# `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` — a plain srv restart keeps the
# OLD string running, which is why server.ts also honours the legacy "verify skipped:" marker line.
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
# `bun e2e/pins.ts` runs FIRST and costs milliseconds: it reads files and compares them, checking
# the must-agree pairs whose other side is not TypeScript and that therefore no compiler can see —
# among them THIS line's own consistency (every entry file type-checked, every named suite present
# and executable, the comment below honest about what runs, the port bands disjoint, the skip
# contract's exit code equal to server.ts's VERIFY_SKIP_EXIT). It is cheapest-first for the same
# reason the rest of the chain is, and it is the only step that can fail before anything is spawned.
# tsc covers every entry file in the tree (verify-tiering.md §4, §8 Step 1): the single-file
# harnesses were unimported by anything the checker saw, so the type checker had a blind spot
# exactly where the suites that guard the land path live. Measured 2026-07-26: 1.62 s, no new
# errors. fleet-e2e-postland-audit.ts was still missing from the list on 2026-07-28 — the harness
# guarding the whole tier-2 path was the one with no type coverage — which is why the pins step
# above now derives the list's completeness from the files on disk instead of trusting this line.
# ./e2e-clean-review.sh is the gate's FIRST land-path coverage ever (§8 Step 2) — it
# drives tryScriptRebase → runVerify → advanceIntegration → recordLand → landLane end to end and
# is the only suite exercising runCleanReview, which is live in shadow mode on this fleet. It is
# ordered cheapest-first so the gate fails fast.
# ./e2e-security.sh IS in the chain (§8 Step 2b): it graduated after its burn-in, and this comment
# claimed the opposite until 2026-07-28, having outlived the change by weeks.
# The exclusion clause is LAST in this block by convention, because that is how the pins step reads
# it: everything after "NOT here:" is taken as denied, and a denied suite that the line below runs
# fails the gate. Keep it last, and keep it to suite names.
# NOT here: ./e2e-isolated.sh (§5 — measurably non-deterministic under load, which is why it is
# tier 2 AFTER the land, not a gate).
VERIFY_CMD='[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh'
VERIFY_Q=$(printf '%s' "$VERIFY_CMD" | sed "s/'/'\\\\''/g")

# --- VERIFICATION TIER 2: the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD) --------------
# The gate above is the FAST tier and is partial on purpose. Tier 2 is the slow half the tiered
# design always named and never had: after every land that moves main, the server runs this command
# against a scratch snapshot of the integration tip, off the land path — one run at a time, bursts
# coalesced, result green/red/unknown on post-land-audits.jsonl (GET /api/post-land-audits) plus a
# loud server.log line and /api/sessions. It GATES NOTHING and UNDOES NOTHING; ↩ undo-land stays the
# rollback. Unset = the tier does not exist, which is today's behaviour.
# TURNED ON 2026-07-25 (docs/autonomy-trial-1.md, Q3): the two lines below are live and the
# srv-spawn line carries FLEET_POSTLAND_AUDIT_CMD='$AUDIT_Q'. Takes effect only on
# `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` — a plain srv restart
# keeps the old spawn line, exactly as with VERIFY_CMD.
# Cost, so the decision is made with it in view: ~2+ min of a full e2e-isolated run per land burst,
# on the same box the fleet's sessions live on. Repo-guarded like VERIFY_CMD — exit 42 in a foreign
# repo records UNKNOWN (a non-measurement), never a false green and never a false red.
AUDIT_CMD='[ -f fleet-e2e.ts ] || { echo "audit skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "audit skipped: could not establish node_modules"; exit 42; }; ./e2e-isolated.sh'
AUDIT_Q=$(printf '%s' "$AUDIT_CMD" | sed "s/'/'\\\\''/g")

while true; do
  if ! tmux -L claudefleet has-session -t '=srv' 2>/dev/null; then
    # PATH must be baked INTO the pane command: the pane's shell inherits the tmux
    # SERVER's env (often the bare launchd default without brew), not this script's
    #
    # FLEET_DISPATCH_REPO makes the dispatcher AVAILABLE, it does not switch it on: `dispatchOn`
    # (server.ts, grep `let dispatchOn`) is a separate persisted runtime flag, default false, and
    # the owner flips it with one API call. MAX_LANES=2 instead of the default 3 is deliberate —
    # this is a watched first run (docs/autonomy-trial-1.md), not maximum throughput.
    if tmux -L claudefleet new-session -d -s srv \
      "umask 077; export PATH='$PATH_Q'; cd '$FLEET_DIR' && FLEET_HOST=100.64.0.1 FLEET_ALLOWED_HOSTS=cowork.example.com,klaus.example.com FLEET_SHARE_HOSTS=cowork.example.com,klaus.example.com FLEET_SHARE_URL=https://cowork.example.com FLEET_VERIFY_CMD='$VERIFY_Q' FLEET_VERIFY_TIMEOUT_MS=300000 FLEET_POSTLAND_AUDIT_CMD='$AUDIT_Q' FLEET_CLEAN_REVIEW=off FLEET_DISPATCH_REPO=~/claude-fleet FLEET_DISPATCH_MAX_LANES=2 exec bun server.ts >> server.log 2>&1"; then
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

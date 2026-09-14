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
# TIERED land gate (docs/attic/merge-review-autonomy.md §7, lane-autonomy-future.md component 4): tsc alone
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
# docs/attic/discrepancy-audit.md): the tsc step needs @types/bun, which lives in gitignored node_modules,
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
# That derivation was itself a hand-kept entry list until 2026-09-14 (Astra finding 4): src/hub.ts
# and six tool scripts reached no compiler. The pin now walks imports from this list over every .ts
# git knows of; a file it does not reach must be listed here or exempted by name in the pin.
# ./e2e-clean-review.sh is the gate's FIRST land-path coverage ever (§8 Step 2) — it
# drives tryScriptRebase → runVerify → advanceIntegration → recordLand → landLane end to end and
# is the only suite exercising runCleanReview, which is live in shadow mode on this fleet. It is
# ordered cheapest-first so the gate fails fast.
# ./e2e-security.sh IS in the chain (§8 Step 2b): it graduated after its burn-in, and this comment
# claimed the opposite until 2026-07-28, having outlived the change by weeks.
# THE PUBLIC DEMO IS NOT IN THIS LIST AND CANNOT BE (2026-07-31): it left this repository for
# ~/claude-fleet-demo, because this one is public and the showcase is not to be published. It was
# briefly listed here on the same day — that is a mistake worth not repeating, since a lane is a
# fresh worktree with only tracked files, so a tsc entry pointing outside the repo fails in EVERY
# lane on a file that is not there. The consequence to KNOW rather than to fix here: that demo reads
# public/index.html and imports src/client.ts, so a change to either can break it, and nothing in
# this repo will say so. It has its own `bun run typecheck` and `bun run build`, seconds each.
# The exclusion clause is LAST in this block by convention, because that is how the pins step reads
# it: everything after "NOT here:" is taken as denied, and a denied suite that the line below runs
# fails the gate. Keep it last, and keep it to suite names.
# NOT here: ./e2e-isolated.sh (§5 — measurably non-deterministic under load, which is why it is
# tier 2 AFTER the land, not a gate).
VERIFY_CMD='[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts src/share.ts src/helper.ts src/hub.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts merge-prompt.ts acceptance-probe.ts graph-coverage.ts land-collision-stats.ts land-quality.ts lane-context-cost.ts drills/drill-3-clean-review.ts && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh'
VERIFY_Q=$(printf '%s' "$VERIFY_CMD" | sed "s/'/'\\\\''/g")

# --- VERIFICATION TIER 2: the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD) --------------
# The gate above is the FAST tier and is partial on purpose. Tier 2 is the slow half the tiered
# design always named and never had: after every land that moves main, the server runs this command
# against a scratch snapshot of the integration tip, off the land path — one run at a time, bursts
# coalesced, result green/red/unknown on post-land-audits.jsonl (GET /api/post-land-audits) plus a
# loud server.log line and /api/sessions. It GATES NOTHING and UNDOES NOTHING; ↩ undo-land stays the
# rollback. Unset = the tier does not exist, which is today's behaviour.
# TURNED ON 2026-07-25 (docs/attic/autonomy-trial-1.md, Q3): the two lines below are live and the
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
    # The deployment identity (FLEET_HOST, ALLOWED_HOSTS, SHARE_HOSTS, SHARE_URL) is NOT in this
    # file: the repo is public, so those values live only in the gitignored .env and are sourced
    # INSIDE this pane command. That placement is load-bearing — the pane's shell is a child of the
    # tmux SERVER, not of this loop, so a `. .env` in the outer script would never reach it (the same
    # inheritance gap documented for PATH and umask above). `set -a` exports them for `bun server.ts`;
    # .env quotes its values because POSIX `.` would otherwise run a spaced value as a command.
    # A missing .env does NOT hammer the restart loop: it logs and starts on the server's defaults.
    #
    # FLEET_DISPATCH_REPO makes the dispatcher AVAILABLE, it does not switch it on: `dispatchOn`
    # (server.ts, grep `let dispatchOn`) is a separate persisted runtime flag, default false, and
    # the owner flips it with one API call. MAX_LANES=2 instead of the default 3 is deliberate —
    # this is a watched first run (docs/attic/autonomy-trial-1.md), not maximum throughput.
    #
    # The verify gate has TWO budgets and they are not interchangeable. FLEET_VERIFY_TIMEOUT_MS is
    # what the gate may spend WORKING; FLEET_VERIFY_WAIT_MS is what it may spend queued behind the
    # machine-wide suite mutex before it starts. One number was what killed a land on 2026-08-06
    # with a `verify.ok:false` over an output holding zero failures — ~255s of its 300s had gone to
    # somebody else's suite (server.ts, grep VERIFY_WAIT_MS). 900000 is the server's own default,
    # written out here because a budget nobody can see is a budget nobody chose; the honest failure
    # it permits ("waited 15 min, never started") is a true sentence about the machine, and the one
    # it replaces was a false sentence about a lane's work.
    #
    # FLEET_HARNESS_AUTOMATION=1 — owner decision 2026-08-07. It admits UNATTENDED paths to a slot
    # running a non-default harness (scheduled autos, dispatch, steward sends, done-looking →
    # /api/self/watch and auto-③), and only for an adapter that also declares `automatable: true`
    # (server.ts) — the flag is the operator's consent, the field is the per-harness claim, and
    # neither alone suffices. What it does NOT admit is the reason it was answerable: no tick lands.
    # The single mergeJob() call site is a route, so every path this opens types a PROMPT into a
    # pane and none writes to main. Live effect on the day it was set: NONE — no slot ran a foreign
    # harness (verified against fleet.json), so it arms a capability rather than changing behaviour.
    # Turning it back off is this one word; nothing else depends on it.
    #
    # FLEET_POSTLAND_AUDIT_TIMEOUT_MS=4500000 — the audit's WORK budget (server.ts, grep
    # POSTLAND_AUDIT_TIMEOUT_MS; default 1800000). Measured 2026-09-02 (queue note aecd5f89): under
    # load (three lanes running local proof chains beside it) the isolated suite ran ~2x slower than
    # its green runs (1545-1729 s) and the 1800 s wall killed the 67b2265 audit ~380 checks short —
    # `unknown`, not red, and nothing measured. A slow audit that finishes is a verdict, one the wall
    # cuts off is not.
    # RAISED 45 -> 75 min on 2026-09-07 (owner decision; measured by Fleet-Betrieb slot 7, re-checked
    # by the controller against post-land-audits.jsonl). Of 11 runs that day TWO died exactly on the
    # wall (2700347 ms, 2700643 ms), leaving THREE landed trees with no tier-2 verdict, and the last
    # green run finished with 2.3 min to spare.
    #
    # THE CAUSE IS PLACEMENT, NOT SUITE SIZE — and the ledger does carry it, in a field nobody had
    # read as one: the run-id in the kept stdout is `isolated-<ts>Z-<pid>`, and macOS caps PIDs at
    # 99999. Seven of that day's audits carry SEVEN-digit pids (1575199 … 3278619) and structurally
    # cannot have run on this Mac. The split is clean, no overlap: helper runs 35.2 / 35.8 / 35.8 /
    # 36.6 / 36.9 / 37.1 / 37.7 min, all seven with a verdict; local runs 40.4 and 42.7 min; the two
    # unknowns carry no run-id at all (killed before the PASS line). No helper run was ever slower
    # than 37.7, no local run ever faster than 40.4. THE WALL KILLS ONLY LOCAL RUNS.
    # Growth is real but small — the 1706 same-named checks shared by the 40.3 and 42.5 min runs sit
    # at ratio 1.008 (median 1.002), so ~2 min/day, not the 5 the raw times suggest.
    # And `waitMs: 0` is the SERVER's queue, not the suite's — but the number this comment first
    # carried for that was WRONG, and the correction matters more than the claim. Filed 2026-09-07
    # by Fleet-Betrieb slot 7 against its OWN measurement, proven by the e407aef5 lane (landed
    # 6b72d622, docs/messungen/2026-09-07-audit-platzierung-gnadenfrist.md): the 08:42 unknown did
    # NOT spend 26.4 min in a prelude. It spent SIX SECONDS, then ran 2042 of 3835 checks in 1117 s.
    # The 26.4 came from attributing a trail file by TIME WINDOW — and lane suites write into the
    # same trail directory as audits, so "falls inside the window" proves no ownership. The general
    # claim survives (a suite's own mutex wait is spent inside this work budget and attributed
    # nowhere); the number never carried it. THE COMMIT BODY OF 61e407d STILL QUOTES 26.4 AND IS
    # UNEDITABLE — do not reuse that figure from it.
    #
    # 75 min is therefore NOT sized from a measured worst case, and saying so is cheaper than a
    # retro-fitted rationale: both unknowns of that day would have got a verdict under c7184f85
    # ALONE (4276 s budget vs ~4082 s need; 3094 vs ~2959). The wall was not needed for them; what
    # it buys is latency headroom. THE CEILING IS THE WEAKER HALF OF THE FIX — and the strong lever
    # is not simply "force audits onto the helper": the measured cause is the GRACE CLOCK, not run
    # length. FLEET_AUDIT_HELPER_GRACE_MS is spent behind a per-repo helper claim and arrives
    # already used up — server.ts#helperResult deletes the claim and calls kickAuditDrain() in the
    # same synchronous block while the daemon polls only 15 s later, so in 3 of 5 measured cases
    # the local drain started 7/5/14 ms after the helper became provably free. Raising the grace
    # WITHOUT hanging its clock on eligibility instead of cover.at is "the expensive half of the
    # cheap repair". The cost of this ceiling, accepted knowingly: a blocked audit can hold the
    # suite mutex 75 min instead of 45.
    if tmux -L claudefleet new-session -d -s srv \
      "umask 077; export PATH='$PATH_Q'; cd '$FLEET_DIR' && { if [ -f .env ]; then set -a; . ./.env; set +a; else echo '[watchdog] no .env — FLEET_HOST/ALLOWED_HOSTS/SHARE_* unset, server falls back to its own defaults (likely unreachable at the deployment address)' >> server.log; fi; } && FLEET_VERIFY_CMD='$VERIFY_Q' FLEET_VERIFY_TIMEOUT_MS=480000 FLEET_VERIFY_WAIT_MS=2700000 FLEET_POSTLAND_AUDIT_CMD='$AUDIT_Q' FLEET_POSTLAND_AUDIT_TIMEOUT_MS=4500000 FLEET_CLEAN_REVIEW=off FLEET_HARNESS_AUTOMATION=1 FLEET_AUTO_REVIEW_MS=0 FLEET_AUDIT_PING_MS=60000 FLEET_DISPATCH_REPO='$FLEET_DIR' FLEET_DISPATCH_MAX_LANES=1 FLEET_LANE_AUTOCLOSE=1 exec bun server.ts >> server.log 2>&1"; then
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

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
# launchd may restart this loop while the user is out of processes (23.10.: fork failed, FLEET_DIR came out empty
# and every respawn wrote to /server.log for good). A loop without its folder or tmux exits, and KeepAlive brings
# a fresh one once forking works again.
if [ -z "$FLEET_DIR" ] || [ ! -f "$FLEET_DIR/server.ts" ] || ! command -v tmux >/dev/null 2>&1; then
  echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] start without FLEET_DIR or tmux — exit, launchd starts a fresh loop" >&2
  sleep 10
  exit 1
fi
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
# total-ENOUGH, not total; the slow full audit (e2e-isolated) stays a post-land check.
# Deterministic (own $$ socket/dir, no known flake) and exit-codes correctly, so it hard-gates.
# e2e-claude-gate.sh itself was validated 2026-07-24 to run WITHOUT node_modules (server.ts imports
# only node:/bun:/local): ALL PASS from a node_modules-less tree in ~46s on this Mac that day. On the
# work-horse it takes ~3 min today (176 s in the merge check of 2026-10-12; helper p50 190 s,
# docs/neuaufbau/befunde/02-ci.md §2) — that is the per-land cost now.
# NOT added: e2e-isolated.sh — it carries the known ~600ms pane-capture flake; a deterministic gate
# cannot sit on a flaky suite, so it graduates in only once that flake is fixed.
# The `bun install` prelude is the FIRST step, and it is what makes this gate deterministic (F9,
# docs/attic/discrepancy-audit.md): the tsc step needs @types/bun, which lives in gitignored node_modules,
# and NOTHING in Fleet establishes it in a lane — createWorktree copies only .env/CLAUDE.md/settings,
# `git worktree add` installs nothing, and bunx does not populate node_modules. Without the prelude
# the gate's verdict depends on whether that lane's agent happened to install: it dies in ~2s on
# "error TS2688: Cannot find type definition file for 'bun'" and never reaches the behavior tier, so a
# sound rebase is downgraded to stop-for-human and `verified:false` pollutes the outcome ledger.
# Proven-dead alternative (do not re-propose): dropping "types": ["bun"] from tsconfig.json (the code
# genuinely uses Bun/process/import.meta.dir — 20+ errors). The types field NAMES a package and cannot
# substitute for one, so tsconfig.json gives the same TS2688 as the old flag list did without this
# prelude, and the prelude fixes both. Costs ~30ms from bun's global cache; --frozen-lockfile keeps
# it read-only w.r.t. bun.lock, and a failure exits non-zero with a named reason instead of
# masquerading as a type error.
# `bun e2e/pins.ts` runs FIRST and costs milliseconds: it reads files and compares them, checking
# the must-agree pairs whose other side is not TypeScript and that therefore no compiler can see —
# among them THIS line's own consistency (every named suite present and executable, the comment
# below honest about what runs, the port bands disjoint, the skip contract's exit code equal to
# server.ts's VERIFY_SKIP_EXIT). It is cheapest-first for the same reason the rest of the chain is,
# and it is the only step that can fail before anything is spawned.
# tsc covers every .ts in the tree (verify-tiering.md §4, §8 Step 1): the tsc step below is what
# `bun run typecheck` runs, and tsconfig.json includes every .ts outside docs/, attic/ and the
# gitignored state dirs. It stays spelled as bunx-then-tsc because ci/merge-check-run.sh up to
# 2026-10-22 takes the FIRST grep match of those two words plus a space from this file, and
# merge-check.ts sends the runner of the checkout it runs in, so a branch cut before then still
# asks for it. Never write those two words with a space in a comment above the VERIFY_CMD line: the
# old runner would run the comment. Until 2026-10-22 this line carried a hand-kept list of ~70
# entry files, and a file nothing in that list imported reached no compiler
# (fleet-e2e-postland-audit.ts on 2026-07-28, src/hub.ts and six tool scripts on 2026-09-14). A glob has no such gap: a new file is checked from its first commit.
# ./e2e-clean-review.sh is the gate's FIRST land-path coverage ever (§8 Step 2) — it
# drives tryScriptRebase → runVerify → advanceIntegration → recordLand → landLane end to end and
# is the only suite exercising runCleanReview, which this fleet runs with FLEET_CLEAN_REVIEW=off (the
# srv-spawn line below), so its reviewer half guards a feature that is off. It is ordered
# cheapest-first so the gate fails fast.
# ./e2e-security.sh IS in the chain (§8 Step 2b): it graduated after its burn-in, and this comment
# claimed the opposite until 2026-07-28, having outlived the change by weeks.
# THE PUBLIC DEMO IS NOT IN THIS LIST AND CANNOT BE (2026-07-31): it left this repository for
# ~/claude-fleet-demo, because this one is public and the showcase is not to be published. It was
# briefly listed here on the same day — that is a mistake worth not repeating, since a lane is a
# fresh worktree with only tracked files, so a tsc entry pointing outside the repo fails in EVERY
# lane on a file that is not there. The consequence to KNOW rather than to fix here: that demo reads
# public/index.html and imports src/client.ts, so a change to either can break it, and nothing in
# this repo will say so. It has its own `bun run typecheck` and `bun run build`, seconds each.
# BEFORE THE MERGE, outside this line: ci/merge-check.ts (docs/neuaufbau/plan.md K2) runs this chain's
# suites plus the small units of the isolated suite on the helper, against the tree main would have
# after the merge; the six large units run nightly and before every deploy.
# The exclusion clause is LAST in this block by convention, because that is how the pins step reads
# it: everything after "NOT here:" is taken as denied, and a denied suite that the line below runs
# fails the gate. Keep it last, and keep it to suite names.
# NOT here: ./e2e-isolated.sh (§5 — measurably non-deterministic under load, which is why it is
# tier 2 AFTER the land, not a gate).
VERIFY_CMD='[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bun e2e/pins.ts && bunx tsc -p . && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh'
VERIFY_Q=$(printf '%s' "$VERIFY_CMD" | sed "s/'/'\\\\''/g")

# --- VERIFICATION TIER 2: the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD) --------------
# The gate above is the FAST tier and is partial on purpose. Tier 2 is the slow half the tiered
# design always named and never had. It runs on a CLOCK, not per land (server.ts#auditCadenceOf, live
# in GET /api/post-land-audits → cadence): quiet = 4 h without a land and never between 08 and 22,
# nightly 02:00, a deploy, audit-tip — and on the helper deployment only a helper runs it (server.ts,
# grep AUDIT_HELPER_ONLY). A merge done with git in the main checkout queues nothing: the server
# sees no land. The server runs this command against a scratch snapshot of the integration tip, off the land path — one run at a time, bursts
# coalesced, result green/red/unknown on post-land-audits.jsonl (GET /api/post-land-audits) plus a
# loud server.log line and /api/sessions. It GATES NOTHING and UNDOES NOTHING.
# Unset = the tier does not exist, which is today's behaviour.
# TURNED ON 2026-07-25 (docs/attic/autonomy-trial-1.md, Q3): the two lines below are live and the
# srv-spawn line carries FLEET_POSTLAND_AUDIT_CMD='$AUDIT_Q'. Takes effect only on
# `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` — a plain srv restart
# keeps the old spawn line, exactly as with VERIFY_CMD.
# OFF PER MACHINE (Owner 29.10., Workhorse + Mac on one hub): `FLEET_POSTLAND_AUDIT=off` in this checkout's .env leaves
# the command out of the srv line, so this machine audits nothing after a land or a sync; the machine that landed the tip
# audits it once. The spawned shell sources .env first, so every srv start (a deploy) applies it; unset = as before.
# Bridge until the check memory (branch/pruef-gedaechtnis) knows a tree is already audited.
# Cost, so the decision is made with it in view: 15–19 min of a full e2e-isolated run in four shards
# on the work-horse (docs/neuaufbau/befunde/02-ci.md §2), not on this box. Repo-guarded like VERIFY_CMD — exit 42 in a foreign
# repo records UNKNOWN (a non-measurement), never a false green and never a false red.
AUDIT_CMD='[ -f fleet-e2e.ts ] || { echo "audit skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "audit skipped: could not establish node_modules"; exit 42; }; ./e2e-isolated.sh'
AUDIT_Q=$(printf '%s' "$AUDIT_CMD" | sed "s/'/'\\\\''/g")

# --- srv HEALTH (drops/1791710844000-systemlast-befund-2026-10-11.md) -------------------------------
# On 2026-10-08 and 2026-10-11 srv grew to 2,4 and 1,9 GB, the 8 GB box swapped, and every request
# took ~100 s: alive to has-session below, dead to every reader. No agent on the box could restart
# it (the classifier refused kill-session and POST /api/deploy alike), so the remedy lives here.
# Every FLEET_WATCHDOG_PROBE_S the loop reads srv's footprint (top's MEM: resident plus compressed)
# and times GET / at the address .env gives the server; FLEET_WATCHDOG_STRIKES readings in a row
# above FLEET_WATCHDOG_MEM_MB, or without an answer within FLEET_WATCHDOG_LATENCY_S, kill srv and
# the branch below respawns it — the documented deploy path, lanes survive it. A reading that cannot
# be taken is no strike, and the latency half counts only at an address that has answered once, so
# a wrong address cannot become a restart loop. Two probe intervals of grace follow every respawn.
# FLEET_WATCHDOG_SOCK names the tmux socket (a test instance's own); unset, the live one.
# Like VERIFY_CMD, all of this loads only on `launchctl kickstart -k …/com.claude-fleet.watchdog`.
WD_SOCK="${FLEET_WATCHDOG_SOCK:-claudefleet}"
HEALTH_MEM_MB="${FLEET_WATCHDOG_MEM_MB:-1536}"
HEALTH_LATENCY_S="${FLEET_WATCHDOG_LATENCY_S:-10}"
HEALTH_EVERY_S="${FLEET_WATCHDOG_PROBE_S:-30}"
HEALTH_STRIKES="${FLEET_WATCHDOG_STRIKES:-3}"
health_url() {
  ( cd "$FLEET_DIR" && if [ -f .env ]; then set -a; . ./.env >/dev/null 2>&1; set +a; fi
    printf 'http://%s:%s/' "${FLEET_HOST:-127.0.0.1}" "${FLEET_PORT:-8790}" )
}
srv_pid() { tmux -L "$WD_SOCK" list-panes -t '=srv' -F '#{pane_pid}' 2>/dev/null | head -n 1; }
# MEM as top prints it (`1935M`, `1.9G`, `512K`, a trailing +/-) in whole MB, or nothing
srv_mem_mb() {
  pid=$(srv_pid); [ -n "$pid" ] || return 0
  top -l 1 -pid "$pid" -stats mem 2>/dev/null | tail -n 1 | awk '{ v = $1; sub(/[+-]$/, "", v)
    if (v !~ /^[0-9.]+[BKMG]?$/) exit
    u = substr(v, length(v)); n = v + 0
    if (u == "G") n *= 1024; else if (u == "K") n /= 1024; else if (u == "B") n /= 1048576
    printf "%d\n", n }'
}
# --- A LOST TMUX SOCKET (queue 8ef80095, 1.11. 21:58) -------------------------------------------------------------------
# When the socket path of WD_SOCK vanished or another tmux server took it, `has-session -t =srv` failed although srv ran on in the
# old server, and this loop started a new srv every ~10 s that refused ("REFUSING TO START: fleet server pid … already running").
# Two rules now. While this repo's fleet server still holds fleet.pid, srv is not down: no respawn, one line, and the server
# gives its tmux server the path back itself (server/tmux-wacht.ts). And while the tmux server Fleet recorded in tmux-server is
# alive, the respawn runs with `tmux -N`: a client that may start a server unlinks the socket of one that is only slow (a refused
# connect, tmux client.c#client_connect). If that respawn fails because the old server lost its path and no fleet server is
# left to say so, this loop sends that recorded pid SIGUSR1, tmux's documented way to recreate a removed socket. Only that pid,
# only when it is a tmux process of this socket name; never a name pattern, never a kill.
WD_STATE="${FLEET_WATCHDOG_STATE_DIR:-$FLEET_DIR}"
fleet_holder() {
  hp=$(head -n 1 "$WD_STATE/fleet.pid" 2>/dev/null | tr -cd '0-9')
  [ -n "$hp" ] && kill -0 "$hp" 2>/dev/null && ps -p "$hp" -o args= 2>/dev/null | grep -q 'server\.ts' && printf '%s' "$hp"
}
tmux_host() {
  tp=$(head -n 1 "$WD_STATE/tmux-server" 2>/dev/null | cut -f1 | tr -cd '0-9')
  # on Linux a tmux server renames itself (tmux compat/setproctitle.c): comm is `tmux: server` there, its args stay
  [ -n "$tp" ] && kill -0 "$tp" 2>/dev/null && case "$(basename "$(ps -p "$tp" -o comm= 2>/dev/null)")" in tmux|"tmux: server") true ;; *) false ;; esac \
    && ps -p "$tp" -o args= 2>/dev/null | grep -qE -- "-L *$WD_SOCK( |\$)" && printf '%s' "$tp"
}
held_by=""
# N5 and W1, by identity (rounds 3 and 4): when the record names a live server X and another server A answers on the path, the path
# goes to the one holding Fleet's own seats: panes whose line carries Fleet's self export, FLEET_SELF_TOKEN='…'; export
# FLEET_SELF_SLOT='<n>' (server.ts#ensureSlot). A session name or the bare text is no seat. Read from the process table, so X without
# a path shows them too and nothing has to be remembered across a restart of this loop. A keeps the path when it holds more of them
# than X; X gets SIGUSR1 when it holds at least as many and at least one. Only when neither holds a seat do panes and age decide: A
# keeps it when it holds a pane besides srv, no fewer than X, and is the older (within one second the lower pid). This loop has no
# credentials, so a stale seat line counts here; the fleet server, which has them, decides by the current ones.
# The table is read once, bounded at 3 s (round 4's R6b: what cannot be read waits), and only pid, ppid and a 0/1 seat mark leave
# awk: the command lines carry the panes' self credentials and are never printed or written.
PROC_T="$WD_STATE/.tmux-proc.$$"
proc_table() {
  rm -f "$PROC_T" "$PROC_T.w"
  ( ps -A -o pid= -o ppid= -o args= 2>/dev/null | awk -v q="'" '{ seat = ($0 ~ ("FLEET_SELF_TOKE" "N=" q "[^" q " ]+" q "; *export FLEET_SELF_SLOT=" q "[0-9]+" q)) ? 1 : 0
      print $1, $2, seat }' > "$PROC_T.w" && mv "$PROC_T.w" "$PROC_T" ) &
  pt=$!; end=$(( $(date +%s) + 3 )) # by the clock: one `sleep 0.1` round costs about 0.2 s here
  while [ ! -f "$PROC_T" ] && [ "$(date +%s)" -lt "$end" ] && kill -0 "$pt" 2>/dev/null; do sleep 0.1; done
  if [ -f "$PROC_T" ]; then wait "$pt" 2>/dev/null; return 0; fi
  pkill -P "$pt" 2>/dev/null; kill "$pt" 2>/dev/null; wait "$pt" 2>/dev/null; rm -f "$PROC_T.w"; return 1
}
panes_of() { awk -v p="$1" '$2 == p' "$PROC_T" | wc -l | tr -cd '0-9'; }
seats_of() { awk -v p="$1" '$2 == p && $3 == 1' "$PROC_T" | wc -l | tr -cd '0-9'; }
seats_at_path() {
  { awk '$3 == 1 { print "m", $1 }' "$PROC_T"; tmux -N -L "$WD_SOCK" list-panes -a -F 'p #{session_name} #{pane_pid}' 2>/dev/null; } \
    | awk '$1 == "m" { m[$2] = 1; next } $1 == "p" && $2 != "srv" && ($3 in m) { n++ } END { print n + 0 }'
}
age_of() { ps -p "$1" -o etime= 2>/dev/null | awk '{ s = $1; d = 0; if (index(s, "-")) { split(s, x, "-"); d = x[1]; s = x[2] }
  n = split(s, t, ":"); v = t[n] + 60 * t[n - 1]; if (n == 3) v += 3600 * t[1]; print v + 86400 * d }'; }

strikes=0
next_probe=0
answered_url=""

while true; do
  srv_up=1; holder=""
  if ! tmux -N -L "$WD_SOCK" has-session -t '=srv' 2>/dev/null; then srv_up=0; holder=$(fleet_holder); fi
  [ -n "$holder" ] || held_by=""
  if [ "$srv_up" = 0 ] && [ -n "$holder" ]; then
    if [ "$held_by" != "$holder" ]; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv is not on tmux socket $WD_SOCK, but fleet server pid $holder still runs and holds $WD_STATE/fleet.pid — no second srv; the server takes its tmux socket back itself" >> "$FLEET_DIR/server.log"
      held_by="$holder"
    fi
  elif [ "$srv_up" = 0 ]; then
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
    # the owner flips it with one API call. MAX_LANES=1 (the line below) instead of the default 3 is
    # deliberate — first a watched run (docs/attic/autonomy-trial-1.md), not maximum throughput.
    #
    # The verify gate has TWO budgets and they are not interchangeable. FLEET_VERIFY_TIMEOUT_MS is
    # what the gate may spend WORKING; FLEET_VERIFY_WAIT_MS is what it may spend queued behind the
    # machine-wide suite mutex before it starts. One number was what killed a land on 2026-08-06
    # with a `verify.ok:false` over an output holding zero failures — ~255s of its 300s had gone to
    # somebody else's suite (server.ts, grep VERIFY_WAIT_MS). The line below writes both out because a
    # budget nobody can see is a budget nobody chose: FLEET_VERIFY_WAIT_MS 2700000 (45 min; the
    # server's own default is 900000) and FLEET_VERIFY_TIMEOUT_MS 480000 unless .env sets it (live
    # 2026-10-12: 900000; the server's own default is 120000) — GET /api/machine-settings shows both.
    # The honest failure the wait permits ("waited, never started") is a true sentence about the
    # machine, and the one it replaces was a false sentence about a lane's work.
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
    #
    # THE AUDIT CADENCE — two knobs, NOT on this line on purpose: the server's own defaults are the
    # owner's numbers (2026-10-08), and a value here would only restate them. Both bind ONLY on a helper deployment, i.e. with FLEET_AUDIT_HELPER_GRACE_MS > 0
    # in .env (live: 60000) — which since that day is an on-switch: its number is no longer read, and
    # a helper's audit never falls back onto this Mac (server.ts, grep AUDIT_HELPER_ONLY).
    #   FLEET_AUDIT_QUIET_MS    default 14400000 (4 h) — the audit starts once the repo has had no
    #                           land for this long, one run on the newest tip covering the whole burst,
    #                           and never inside FLEET_AUDIT_QUIET_DAY (default 08-22)
    #   FLEET_AUDIT_MAX_WAIT_MS default 3600000 (60 min) — releases NO run (auditCadenceOf does not read
    #                           it); past it a waiting entry is `overdue` and the helper daemon ranks
    #                           it right behind command jobs (server.ts#auditPastMaxWait)
    # Either at 0 releases at once (the harnesses do this). Set them in .env, never in this line —
    # the line is the deploy path. Rule and proof: docs/verify-tiering.md §6.0b, server.ts#auditCadenceOf.
    strikes=0
    next_probe=$(( $(date +%s) + 2 * HEALTH_EVERY_S ))
    # THE BOOT SAYS WHO STARTED IT (server.ts#recordUnattributedBoot): a respawn is no deploy, and
    # without this its row read as an unattributed one (11:38 on 2026-10-11, b490faee). The reason is
    # the health strike's when this loop killed srv, else "srv was down"; cut to a safe alphabet.
    boot_why=$(printf '%s' "${respawn_why:-srv was down}" | tr -cd 'A-Za-z0-9 =:/._(),-' | cut -c1-120)
    respawn_why=""
    tmux_pid=$(tmux_host); nostart=""; [ -n "$tmux_pid" ] && nostart="-N"
    # another tmux server answers on the path while the one holding Fleet's seats lives: `-N` alone would put srv into the wrong
    # server, beside none of the seats (slot 7's W1). The seats' server gets its path back first; then srv starts in it.
    answering=""; [ -n "$tmux_pid" ] && answering=$(tmux -N -L "$WD_SOCK" display-message -p '#{pid}' 2>/dev/null | tr -cd '0-9')
    seats_here=""
    if [ -n "$tmux_pid" ] && [ -n "$answering" ] && [ "$answering" != "$tmux_pid" ] && ! proc_table; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] tmux server pid $answering answers on $WD_SOCK while pid $tmux_pid in tmux-server lives too, and ps -A did not answer within 3 s — which one holds Fleet's seats cannot be told: no signal, no srv start this round" >> "$FLEET_DIR/server.log"
      sleep 5; continue
    fi
    if [ -n "$tmux_pid" ] && [ -n "$answering" ] && [ "$answering" != "$tmux_pid" ]; then
      here_s=$(seats_at_path); there_s=$(seats_of "$tmux_pid")
      if [ -n "$here_s" ] && [ -n "$there_s" ] && [ "$here_s" -gt "$there_s" ]; then
        seats_here=1
        echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] tmux server pid $answering answers on $WD_SOCK and holds $here_s of Fleet's seats; pid $tmux_pid in tmux-server holds $there_s and has no path — no signal, srv starts beside the seats in $answering" >> "$FLEET_DIR/server.log"
      elif [ "${there_s:-1}" = 0 ]; then
        here=$(tmux -N -L "$WD_SOCK" list-panes -a -F '#{session_name}' 2>/dev/null | grep -cvx srv | tr -cd '0-9'); there=$(panes_of "$tmux_pid")
        here_age=$(age_of "$answering"); there_age=$(age_of "$tmux_pid")
        if [ -n "$here" ] && [ -n "$there" ] && [ -n "$here_age" ] && [ -n "$there_age" ] && [ "$here" -ge 1 ] && [ "$here" -ge "$there" ] \
          && { [ "$here_age" -gt "$there_age" ] || { [ "$here_age" -eq "$there_age" ] && [ "$answering" -lt "$tmux_pid" ]; }; }; then
          seats_here=1
          echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] neither tmux server holds one of Fleet's seats; pid $answering answers on $WD_SOCK, is the older and holds $here pane(s) besides srv, pid $tmux_pid in tmux-server holds $there and has no path — no signal, srv starts in $answering" >> "$FLEET_DIR/server.log"
        fi
      fi
      rm -f "$PROC_T"
    fi
    if [ -z "$seats_here" ] && [ -n "$tmux_pid" ] && [ -n "$answering" ] && [ "$answering" != "$tmux_pid" ]; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] tmux server pid $answering holds the path $WD_SOCK while pid $tmux_pid holds Fleet's seats — SIGUSR1 to $tmux_pid so it takes the path back; srv then starts beside the seats" >> "$FLEET_DIR/server.log"
      kill -USR1 "$tmux_pid" 2>/dev/null
      n=0; while [ $n -lt 10 ] && [ "$(tmux -N -L "$WD_SOCK" display-message -p '#{pid}' 2>/dev/null)" != "$tmux_pid" ]; do sleep 0.5; n=$((n + 1)); done
    fi
    if tmux $nostart -L "$WD_SOCK" new-session -d -s srv \
      "umask 077; export PATH='$PATH_Q'; cd '$FLEET_DIR' && { if [ -f .env ]; then set -a; . ./.env; set +a; else echo '[watchdog] no .env — FLEET_HOST/ALLOWED_HOSTS/SHARE_* unset, server falls back to its own defaults (likely unreachable at the deployment address)' >> server.log; fi; } && { [ \"\${FLEET_POSTLAND_AUDIT:-on}\" = off ] || export FLEET_POSTLAND_AUDIT_CMD='$AUDIT_Q'; } && FLEET_VERIFY_CMD='$VERIFY_Q' FLEET_VERIFY_TIMEOUT_MS=\${FLEET_VERIFY_TIMEOUT_MS:-480000} FLEET_VERIFY_WAIT_MS=\${FLEET_VERIFY_WAIT_MS:-2700000} FLEET_POSTLAND_AUDIT_TIMEOUT_MS=4500000 FLEET_CLEAN_REVIEW=off FLEET_HARNESS_AUTOMATION=1 FLEET_AUTO_REVIEW_MS=0 FLEET_AUDIT_PING_MS=60000 FLEET_DISPATCH_REPO='$FLEET_DIR' FLEET_DISPATCH_MAX_LANES=1 FLEET_LANE_AUTOCLOSE=1 FLEET_BOOT_CAUSE=watchdog FLEET_BOOT_WHY='$boot_why' exec bun server.ts >> server.log 2>&1"; then
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv was down, restarted" >> "$FLEET_DIR/server.log"
    else
      # log the truth: an unconditional "restarted" here used to fill the log with
      # success lines during the exact outage it should have documented
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv down and RESTART FAILED (tmux error)" >> "$FLEET_DIR/server.log"
      if [ -n "$tmux_pid" ] && ! tmux -N -L "$WD_SOCK" has-session 2>/dev/null; then
        echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] tmux server pid $tmux_pid holds Fleet's panes but its socket $WD_SOCK does not answer — SIGUSR1 so it recreates the socket; no second tmux server" >> "$FLEET_DIR/server.log"
        kill -USR1 "$tmux_pid" 2>/dev/null
      fi
      sleep 25 # back off — a broken tmux/deploy isn't fixed by hammering every 5s
    fi
  elif [ "$(date +%s)" -ge "$next_probe" ]; then
    next_probe=$(( $(date +%s) + HEALTH_EVERY_S ))
    why=""
    mem=$(srv_mem_mb)
    if [ -n "$mem" ] && [ "$mem" -gt "$HEALTH_MEM_MB" ]; then why="mem=${mem}MB over ${HEALTH_MEM_MB}MB"; fi
    url=$(health_url)
    curl -s -o /dev/null -m "$HEALTH_LATENCY_S" "$url"; rc=$?
    if [ "$rc" -eq 0 ]; then answered_url="$url"
    elif [ "$url" = "$answered_url" ]; then why="${why:+$why, }GET $url no answer within ${HEALTH_LATENCY_S}s (curl $rc)"; fi
    if [ -z "$why" ]; then strikes=0
    else
      strikes=$((strikes + 1))
      echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv health strike $strikes/$HEALTH_STRIKES: $why" >> "$FLEET_DIR/server.log"
      if [ "$strikes" -ge "$HEALTH_STRIKES" ]; then
        pid=$(srv_pid)
        echo "$(date +%Y-%m-%dT%H:%M:%S) [watchdog] srv unhealthy $strikes probes in a row — killing srv (pid $pid), respawn follows" >> "$FLEET_DIR/server.log"
        respawn_why="health: $why"
        tmux -L "$WD_SOCK" kill-session -t '=srv' 2>/dev/null
        # a thrashing or stopped bun can outlive its pane: only the pid read above, never a name
        n=0; while [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && [ $n -lt 10 ]; do sleep 1; n=$((n + 1)); done
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then kill -KILL "$pid" 2>/dev/null; fi
        strikes=0
      fi
    fi
  fi
  sleep 5
done

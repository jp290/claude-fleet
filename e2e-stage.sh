#!/bin/sh
# e2e-stage.sh — the ONE rule for what a throwaway instance contains.
#
# Sourced (never executed) by every script that stands up a copy of this repo to run a server in:
#   e2e-isolated.sh · e2e-claude-gate.sh · e2e-clean-review.sh · e2e-security.sh
#   e2e-postland-audit.sh · drills/drill-3.sh · attic/steward-arena.sh
#
# WHY. Each of those used to carry its OWN hand-written `cp -R` list of server.ts's local modules,
# and two of them died of exactly that maintenance. e2e-postland-audit.sh stopped booting the day
# continuity.ts landed (`Cannot find module './continuity'`) and stayed dead for weeks, because no
# gate runs it and the symptom reads like anything else. attic/steward-arena.sh:155 shipped with
# two of the four modules missing. A list that must be edited in seven places when server.ts gains one
# import is a list that will be edited in six.
#
# THE RULE. An instance contains exactly:
#   (1) the ENTRY files it was asked to run, plus the transitive closure of their RELATIVE imports,
#       re-derived from the source on every run. A new import rides along with no wrapper edit.
#       SUBPATHS resolve: `from "./src/protocol"` and `from "../src/backoff"` both work, and the
#       directory is created in the copy. (drill-3.sh's earlier derived GUARD — the only derived
#       thing in the old arrangement — matched `from "./name"` only and was blind to precisely
#       that shape.)
#   (2) public/ and package.json — the fixed runtime assets every instance needs.
#   (3) $STAGE_EXTRA — assets read BY PATH rather than imported, which no import scan can see
#       (fleet-e2e-security.ts readFileSync's src/client.ts and src/md.ts).
#   (4) a node_modules symlink back to SRC. Also the only pointer home from inside the copy, which
#       is how the per-check trail resolves the tree under test (e2e/trail-emit.ts sourceTree()).
#
# A specifier that resolves to no file is FATAL here. An instance that cannot boot must say so at
# staging time, naming the file and the import — not forty lines later as a module-resolution
# error inside a tmux pane, in a server.log nobody reads.

# --- HERMETIC BEHAVIOUR KNOBS. Sourcing this file IS starting a suite, and a suite's answer must
# not depend on the shell that launched it. Every FLEET_* knob a wrapper does not name on its own
# srv spawn line is INHERITED: tmux bakes its server's env into every pane it opens, and the
# runner is started from this same shell.
#
# FLEET_LANE_AUTOCLOSE is the knob that currently has a live arming to inherit. watchdog.sh arms
# it on the deployed srv (=1 since 566cbae), and server.ts#runVerify spawns the land gate's chain
# — three of these wrappers — with the server's environment UNFILTERED. (The post-land audit is
# the one caller that filters: server.ts#auditChildEnv drops every FLEET_*.) Stated 0 rather than
# unset, so the off-state is a fact a probe can read (e2e/watch.ts, "D2 setup") instead of an
# absence that cannot be told apart from an oversight. A check that needs the flag ON arms it for
# exactly one restart through e2e/harness.ts#restartSrv's `extra`, which wins over this value.
export FLEET_LANE_AUTOCLOSE=0

# --- machine-wide suite mutex (owner decision 2026-07-28). Suites are serial on this box: two
# concurrent instances reliably poison each other's runs (docs/suite-contention.md; measured again
# 2026-07-28 — three owner interventions in one afternoon because the serialization lived only in
# CLAUDE.md prose). Sourcing this file IS starting a suite, so the lock is taken HERE — one place,
# every wrapper inherits it, no per-wrapper trap surgery.
#   - Lock = mkdir (atomic). The holder records its pid and process-birth fingerprint.
#   - Release is IMPLICIT: no EXIT trap (the wrappers own theirs, and a sourced trap would collide).
#     The next contender reaps a lock whose recorded pid is dead. A lock dir existing therefore
#     does NOT mean a suite is running — the pid file decides.
#   - A pid-LESS lock dir is a manual hold (a human parked the machine) and is never reaped.
#   - The reap re-checks the pid VALUE before removing, shrinking the reap/re-acquire race to
#     microseconds; two pollers at 15s cadence cannot practically collide inside it.
#
# --- AND THE WAIT SPEAKS (2026-08-06) ----------------------------------------------------------
# This loop used to block in complete silence, and that silence had a price the land gate paid.
# FLEET_VERIFY_TIMEOUT_MS is a WALL-CLOCK budget, but several steps of the gate chain must take
# this lock first, and its holder may be any suite — including an ~8-minute ./e2e-isolated.sh. So
# the budget silently contains an unbounded wait. Measured on 2026-08-06: a land was stopped with
# `verify.ok:false` over an output that contained zero FAIL lines, and of its 300 s budget ~107 s
# was work and ~255 s was this loop. The verdict read as a reasoned "no" and named nothing.
#
# One line when we first block, a heartbeat each minute after, and ALWAYS one line on acquisition
# — including `after 0s`, so that the ABSENCE of the acquire line means "this command does not
# report waits" rather than "it did not wait". server.ts's runVerify parses exactly that line
# (SUITE_LOCK_RE) to split the run into work and wait; e2e/pins.ts holds the two sides together.
# Since 2026-08-07 these lines are not only recorded, they are ACTED ON, and while the run is still
# alive: runVerify streams this stdout and moves its clock between two budgets on them — queueing
# spends FLEET_VERIFY_WAIT_MS, verifying spends FLEET_VERIFY_TIMEOUT_MS, and running out of each is
# a differently named non-answer (`waitedOut` vs `timedOut`, never `ok:false`). So a format change
# here is no longer merely a lost measurement: it puts a land's clock on the wrong budget.
#
# The three states carry the SAME vocabulary the server's suiteLockView() projects onto the board
# (held · stale · parked, server.ts GateLockState), because they are the same three facts and a
# reader should not have to learn them twice:
#   held   — a live pid holds it. Named with its elapsed time and its command line, so "which
#            suite is in front of me" is answered by the line rather than by a follow-up `ps`.
#   stale  — the recorded pid is gone. NOTHING is running; we reap it and take the lock.
#   parked — the dir exists with NO pid file. A human parked the machine on purpose; this is the
#            one state that never resolves on its own, and a waiter must not read it as "soon".
# Every emission is throttled through _st_say_at, including the reap: a lock dir that resists
# rmdir would otherwise spin this loop into a log flood.
FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"
_st_who=$(basename "$0" 2>/dev/null || echo suite)
_st_t0=$(date +%s)
_st_say_at=0   # elapsed seconds at which the next line is due; 0 = the first block always speaks
_st_birth_of() {
  # LC_ALL=C IS THE VALIDATOR'S OTHER HALF, not a nicety. `ps -o lstart=` is locale-formatted:
  # measured 2026-09-01 on the Debian/de_DE helper it prints "Di Sep  1 ...", and _st_valid_birth
  # — which requires English month/day names — rejects it, so identityProven stays null and the
  # suite-lock family falls closed. Mechanism and its limits:
  # docs/messungen/second-host-baseline-2026-08-29.md §Plattform-Signatur.
  LC_ALL=C ps -o lstart= -p "$1" 2>/dev/null | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/[[:space:]][[:space:]]*/ /g'
}
_st_valid_birth() {
  printf '%s\n' "$1" | grep -Eq '^[A-Z][a-z]{2} [A-Z][a-z]{2} [0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2} [0-9]{4}$'
}
_st_self_birth=$(_st_birth_of "$$")
if [ -z "$_st_self_birth" ]; then
  printf '[suite-lock-error] %s cannot record process birth for pid %s; refusing to hold %s\n' "$_st_who" "$$" "$FLEET_SUITE_LOCK" >&2
  return 3 2>/dev/null || exit 3
fi
while ! mkdir "$FLEET_SUITE_LOCK" 2>/dev/null; do
  # `|| true`: a missing pid file makes `cat` fail, and under a `set -e` caller (attic/steward-arena.sh)
  # a failing command substitution in an assignment would abort the whole run — on the PARKED
  # state, i.e. exactly when it must instead be reported.
  _st_hp=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)
  _st_hb=$(cat "$FLEET_SUITE_LOCK/birth" 2>/dev/null || true)
  _st_dead=0
  _st_reap=0
  if [ -z "$_st_hp" ]; then
    if [ -z "$_st_hb" ]; then
      _st_why="parked — the dir carries NO pid file, so nothing will ever reap it (rmdir it to release)"
    else
      _st_reap=1
      _st_why="stale — lock has a process-birth fingerprint but NO pid; reaping the torn acquisition"
    fi
  elif kill -0 "$_st_hp" 2>/dev/null; then
    _st_birth_now=$(_st_birth_of "$_st_hp")
    if [ -z "$_st_hb" ]; then
      _st_why="unknown — recorded pid $_st_hp is alive, but the lock has no process-birth fingerprint; not reaping a possibly live legacy holder"
    elif ! _st_valid_birth "$_st_hb"; then
      _st_why="unknown — recorded pid $_st_hp is alive, but its process-birth fingerprint is malformed; not reaping a possibly live holder"
    elif [ -z "$_st_birth_now" ]; then
      _st_why="unknown — recorded pid $_st_hp is alive, but its current process-birth fingerprint is unmeasurable; not reaping a possibly live holder"
    elif [ "$_st_birth_now" = "$_st_hb" ]; then
      _st_why="held by live pid $_st_hp with proven identity (up $(ps -o etime= -p "$_st_hp" 2>/dev/null | tr -d ' ')): $(ps -o command= -p "$_st_hp" 2>/dev/null | cut -c1-70)"
    else
      _st_dead=1
      _st_reap=1
      _st_why="stale — recorded pid $_st_hp is alive but its process-birth fingerprint changed; reaping the recycled-pid lock"
    fi
  else
    _st_dead=1
    _st_reap=1
    _st_why="stale — recorded pid $_st_hp is gone, nothing is running; reaping it"
  fi
  _st_el=$(( $(date +%s) - _st_t0 ))
  if [ "$_st_el" -ge "$_st_say_at" ]; then
    printf '[suite-lock] %s waiting %ss for %s — %s\n' "$_st_who" "$_st_el" "$FLEET_SUITE_LOCK" "$_st_why"
    _st_say_at=$(( _st_el + 60 ))
  fi
  if [ "$_st_reap" = 1 ]; then
    # `if` rather than the old `[ … ] && rm && rmdir` AND-OR chain: under `set -e` that list exits
    # the caller whenever the pid changed under us or the rmdir loses the race — a normal outcome
    # of the reap, turned into an abort.
    _st_cur_pid=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)
    _st_cur_birth=$(cat "$FLEET_SUITE_LOCK/birth" 2>/dev/null || true)
    if [ "$_st_cur_pid" = "$_st_hp" ] && [ "$_st_cur_birth" = "$_st_hb" ]; then
      rm -f "$FLEET_SUITE_LOCK/pid" "$FLEET_SUITE_LOCK/birth" && rmdir "$FLEET_SUITE_LOCK" 2>/dev/null || true
    fi
    continue
  fi
  sleep 15
done
echo "$$" > "$FLEET_SUITE_LOCK/pid"
printf '%s\n' "$_st_self_birth" > "$FLEET_SUITE_LOCK/birth"
printf '[suite-lock] %s acquired after %ss (pid %s)\n' "$_st_who" "$(( $(date +%s) - _st_t0 ))" "$$"

# Exit 3 means the suite's server prerequisite never came up; ordinary check failures use exit 1.
# The caller exits immediately after this returns, so its normal success-only directory cleanup is
# bypassed and the named instance (including server.log) remains available for inspection.
stage_server_start_failed() {
  printf '%s: server did not come up (phase: %s; instance kept: %s)\n' "$1" "$2" "$3" >&2
  if [ -f "$3/server.log" ]; then
    printf '%s: tail of %s/server.log:\n' "$1" "$3" >&2
    tail -n 40 "$3/server.log" >&2
  else
    printf '%s: no server.log exists in %s\n' "$1" "$3" >&2
  fi
  return 3
}

# --- dead-socket reap (owner decision 2026-08-05, hygiene before continuous operation). tmux
# never unlinks a -L socket file when its server exits, so every instance leaves one behind —
# the machine had accumulated 171 dead sockets in days. Reap here, holding the suite lock, the
# same way the lock itself is reaped: `fleet*` can never match the live `claudefleet` (different
# prefix), and a socket whose server still answers is KEPT — a UI throwaway instance runs
# WITHOUT this lock, so liveness is probed per socket, never assumed from the name.
for _st_sock in "${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"/fleet*; do
  [ -S "$_st_sock" ] || continue
  tmux -S "$_st_sock" list-sessions >/dev/null 2>&1 || rm -f "$_st_sock"
done

# normalize a relative path in place: `e2e/../src/backoff` → `src/backoff`
_stage_norm() {
  printf '%s' "$1" | awk -F/ '{
    n = 0
    for (i = 1; i <= NF; i++) {
      if ($i == "." || $i == "") continue
      if ($i == "..") { if (n > 0 && out[n] != "..") { n--; continue } }
      out[++n] = $i
    }
    s = ""
    for (i = 1; i <= n; i++) s = s (i > 1 ? "/" : "") out[i]
    print s
  }'
}

# print the repo-relative FILE a bare specifier resolves to, or fail. Bun's resolution order for
# an extensionless relative specifier, narrowed to what this repo actually uses; the empty suffix
# is for a specifier that already carries its extension.
_stage_resolve() {
  for _st_ext in ".ts" ".tsx" "/index.ts" ""; do
    if [ -f "$1/$2$_st_ext" ]; then printf '%s' "$2$_st_ext"; return 0; fi
  done
  return 1
}

# print the transitive closure of relative imports reachable from the given entry files.
# Import-ANCHORED extraction on purpose: a bare `"../../escape"` appears in this repo as test DATA
# (fleet-e2e-security.ts's hostile-branch-name list), and a scan that copied every quoted relative
# string would chase it.
_stage_closure() {
  _st_src="$1"; shift
  _st_pending="$*"
  _st_seen=""
  while [ -n "$_st_pending" ]; do
    _st_f="${_st_pending%% *}"
    case "$_st_pending" in *" "*) _st_pending="${_st_pending#* }" ;; *) _st_pending="" ;; esac
    [ -n "$_st_f" ] || continue
    case " $_st_seen " in *" $_st_f "*) continue ;; esac
    if [ ! -f "$_st_src/$_st_f" ]; then
      printf 'e2e-stage: FATAL: no such file in %s: %s\n' "$_st_src" "$_st_f" >&2
      return 1
    fi
    _st_seen="$_st_seen $_st_f"
    _st_dir=$(dirname "$_st_f")
    for _st_spec in $(grep -oE '(from|import)[[:space:]]*\(?[[:space:]]*"\.[^"]*"' "$_st_src/$_st_f" 2>/dev/null \
                   | grep -oE '"\.[^"]*"' | tr -d '"' || true); do
      _st_hit=$(_stage_resolve "$_st_src" "$(_stage_norm "$_st_dir/$_st_spec")") || {
        printf 'e2e-stage: FATAL: %s imports "%s", which resolves to no file under %s\n' \
          "$_st_f" "$_st_spec" "$_st_src" >&2
        return 1
      }
      _st_pending="$_st_pending $_st_hit"
    done
  done
  printf '%s' "$_st_seen"
}

# stage_instance SRC DIR entry.ts [entry.ts ...]
#   $STAGE_EXTRA (optional, space-separated, relative to SRC) adds by-path assets — see (3) above.
stage_instance() {
  _st_s="$1"; _st_d="$2"; shift 2
  [ -f "$_st_s/server.ts" ] || { printf 'e2e-stage: not a fleet checkout: %s\n' "$_st_s" >&2; return 2; }
  mkdir -p "$_st_d" || return 1
  _st_deps=$(_stage_closure "$_st_s" "$@") || return 1
  for _st_rel in $_st_deps; do
    mkdir -p "$_st_d/$(dirname "$_st_rel")" || return 1
    cp "$_st_s/$_st_rel" "$_st_d/$_st_rel" || return 1
  done
  cp -R "$_st_s/public" "$_st_s/package.json" "$_st_d/" || return 1
  for _st_x in ${STAGE_EXTRA:-}; do
    cp -R "$_st_s/$_st_x" "$_st_d/" || return 1
  done
  [ -e "$_st_d/node_modules" ] || ln -s "$_st_s/node_modules" "$_st_d/node_modules" || return 1
  return 0
}

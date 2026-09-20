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
#   (2) public/, package.json and fleet-sync.sh — the fixed assets every instance needs. The first
#       two are runtime; fleet-sync.sh is here because a check runs THE REAL SCRIPT (e2e/land-
#       durability.ts §F) and no import scan can see a file a test SPAWNS. It used to be reached
#       through (4)'s pointer home instead, and that is precisely why it had to move: the pointer
#       home resolves only when the source tree is a git work tree, and the post-land audit's
#       source is a `git archive` extract with no `.git` at all (server.ts#snapshotIntegrationTree
#       builds a git context ONLY for the proportional short chain). So §F's probe read
#       `sourceTree=null` and failed in EVERY full audit while passing in every lane — main was
#       red from b224ef8 on. An instance now carries the script it is asked to exercise.
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

# --- THE ACTOR OF THIS RUN (docs/e2e-trail.md §2a) ---------------------------------------------
# The trail header named the run, the suite and the tree, and nobody. So "were the ~15 local
# isolated runs a day ever offered to a helper first?" could only be GUESSED from two ledgers
# that do not join (Staffel 2026-09-17, Rang 2). Resolved HERE, once, for all seven wrappers,
# because this is the one file every one of them sources.
#
# TWO INPUTS, TWO OUTPUTS. The inputs are the pane's lane credentials — either still in the
# environment (the four wrappers that keep them) or handed down in `_st_actor_*` by a wrapper that
# strips them before staging (e2e-isolated.sh, e2e-security.sh, acceptance-probe.sh). The outputs
# are FLEET_E2E_SLOT and FLEET_E2E_OFFERED, and NOTHING ELSE LEAVES: the token is used for one
# request and cleared. It travels to curl on STDIN, never in argv — a `-H "x-fleet-self-token: …"`
# would print the credential in `ps` for the life of the request.
#
# EACH OUTPUT IS SET OR UNSET, never empty. A run with no lane credentials (the land gate, the
# post-land audit) leaves both unset, and e2e/trail-emit.ts omits the fields — an empty slot would
# read as a run by nobody, and `offered=false` from a probe that never asked would be a wrong
# answer rather than a missing one. Both are also honoured when already set, so a caller can say
# what this run is without being overruled.
_st_actor_slot="${_st_actor_slot:-${FLEET_SELF_SLOT:-}}"
_st_actor_token="${_st_actor_token:-${FLEET_SELF_TOKEN:-}}"
_st_actor_url="${_st_actor_url:-${FLEET_SELF_URL:-}}"
if [ -z "${FLEET_E2E_SLOT:-}" ] && [ -n "$_st_actor_slot" ]; then FLEET_E2E_SLOT="$_st_actor_slot"; fi
# The offer door answers a lane about its own LAST offer, settled ones included (server.ts, the
# GET half of /api/self/suite-offer) — which is what makes "was this run preceded by an offer"
# readable at all AFTER the withdraw that gave the lane permission to run locally. A lane that
# never offered gets `"offer":null`; anything else (409 not-a-lane, 401, a server that does not
# answer within the timeout) matches neither shape and leaves the verdict unset.
#
# The ADDRESS is only ever the pane's own FLEET_SELF_URL — no default is written here. A tracked
# file must carry no deploy identity (e2e/pins.ts, the leak pin), and a wrong guessed address would
# buy a five-second timeout per suite run in exchange for an answer nobody could trust anyway.
if [ -z "${FLEET_E2E_OFFERED:-}" ] && [ -n "$_st_actor_token" ] && [ -n "$_st_actor_url" ]; then
  _st_offer=$(printf 'x-fleet-self-token: %s\n' "$_st_actor_token" \
    | curl -s --max-time 5 -H @- "$_st_actor_url/api/self/suite-offer" 2>/dev/null) || _st_offer=""
  case "$_st_offer" in
    *'"offer":null'*) FLEET_E2E_OFFERED=false ;;
    *'"offer":{'*)    FLEET_E2E_OFFERED=true ;;
  esac
  _st_offer=""
fi
_st_actor_token=""
if [ -n "${FLEET_E2E_SLOT:-}" ]; then export FLEET_E2E_SLOT; else unset FLEET_E2E_SLOT; fi
if [ -n "${FLEET_E2E_OFFERED:-}" ]; then export FLEET_E2E_OFFERED; else unset FLEET_E2E_OFFERED; fi

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
#   - AN INHERITED HOLD (2026-09-04, owner: "Retry unter GEHALTENEM Lock"). The land gate's ff retry
#     chain runs the gate SEVERAL times in a row, and between rounds the machine must not be given
#     away — the queueing, not the gate, is what made a repeat expensive. server.ts therefore takes
#     this lock ITSELF for the whole chain and exports FLEET_SUITE_LOCK_HELD_BY=<its pid> into the
#     gate child alone. A step that sees that variable AND finds the lock's own pid file naming that
#     same LIVE process does not queue, does not write pid/birth, and releases nothing: it is running
#     inside a hold that already exists. The env var alone grants nothing — the lock on disk has the
#     last word, so a stale export cannot let a suite run unserialized. Everything else about the
#     mutex is unchanged: mkdir stays the claim, the pid/birth files stay the identity, the reap
#     stays the wrappers', and a pid-LESS dir stays a manual park.
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
#            When the holder is the FLEET SERVER (server.ts#suiteLockTryTake writes the marker
#            `held-by-fleet-server` beside `pid`, naming its own pid), every line over that live
#            pid says so verbatim: "held by the fleet server itself — never kill this pid". A lane
#            killed the pid it read from this lock on 2026-09-14 and took the live server down
#            mid-land. The marker changes WORDING only — which dir is reaped is decided exactly as
#            before, and a live pid with a proven birth is never an orphan here with or without it.
#   stale — the recorded pid is gone. NOTHING is running; we reap it and take the lock.
#   parked — the dir exists with NO pid file. A human parked the machine on purpose; this is the
#            one state that never resolves on its own, and a waiter must not read it as "soon".
# Every emission is throttled through _st_say_at, including the reap: a lock dir that resists
# rmdir would otherwise spin this loop into a log flood.
FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"
# --- AND THE WAIT IS ORDERED (2026-09-05) ------------------------------------------------------
# The loop below used to be a RACE, not a queue: every contender slept 15s and ran at `mkdir`
# again, so waiting longer bought nothing. Measured 2026-09-04/05: slot 7's
# ./e2e-postland-audit.sh waited 2h45m and lost THREE mkdir races in a row to contenders that had
# arrived after it. It cost a LAND the same night — the gate of lane ce329973 was killed at 45 min
# still queued (`waitedOut`), having never looked at the tree — and the land that DID get through
# carries `ms 1979676 / waitMs 1864000` in its note: 94 % queue, 6 % measurement.
#
# The fix is a TICKET, taken at ARRIVAL and before the first `mkdir` attempt. Only the contender
# holding the oldest LIVE ticket attempts the lock; everyone else names its position and sleeps.
# No daemon, no background process, no new dependency — one directory per contender.
#   · The QUEUE is derived from the lock path, never configured on its own: a probe pointed at a
#     private lock must get a private queue with it.
#   · A TICKET is a directory `t<n>.<pid>` — the pid is in the NAME, so creating one is a single
#     atomic mkdir with no torn state a reaper could mistake for an orphan. `n` is max(existing)+1,
#     so a number is never handed out below a waiter that already holds one, and the counter resets
#     to 1 by itself once the queue empties. The birth fingerprint goes INSIDE, and the ticket rules
#     mirror the lock's own states exactly: pid dead → orphan, reaped, blocks nobody · pid alive
#     with a DIFFERENT birth → recycled pid, orphan, reaped · pid alive with a MISSING birth →
#     unknown, kept (a contender one syscall from writing it, or a legacy holder — neither may be
#     reaped on a guess).
#   · Ties (two contenders that scanned in the same window and drew the same `n`) break by pid, so
#     exactly one is the front and the order is total.
#   · The ticket is DROPPED the instant the lock is taken, which is what makes `position 2 of 3`
#     mean "two contenders are waiting behind me" rather than "one holder and me".
#   · AN INHERITED STEP IS NEVER ENQUEUED. All of this lives inside the `_st_inherited = 0` guard:
#     a step running inside somebody else's hold does not queue, does not take a ticket and does
#     not wait — it already has the machine. Enqueueing it would deadlock it behind itself.
#   · It FAILS OPEN: a contender that cannot take a ticket races exactly as before. The mutex is the
#     SAFETY and the ticket only the FAIRNESS, and a fairness device that can kill a land gate is
#     worse than the unfairness it removes. docker-verify.sh's duplicated loop is such a contender.
#
# NOT built here: a wait budget for the wrapper. The loop stays endless on purpose — runVerify
# already kills a still-queued gate after FLEET_VERIFY_WAIT_MS and names it `waitedOut`, never
# `ok:false`. A second deadline in the shell would be an abort the server cannot classify: a wait
# that reads like a red gate. FIFO also removes the reason to want one — the remaining wait is now
# bounded by the suites ahead, and the position is printed next to the elapsed seconds.
FLEET_SUITE_QUEUE="$FLEET_SUITE_LOCK.q"
# Seconds between polls. A knob so a probe can drive a handover in seconds instead of minutes; the
# DEFAULT is the 15s cadence server.ts's comments and docs/land-mechanics.md describe.
FLEET_SUITE_POLL_SEC="${FLEET_SUITE_POLL_SEC:-15}"
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
# Walk the queue once: reap every orphaned ticket, then report where I stand.
#   _st_qmax  highest ticket number SEEN this pass (live or reaped) — what a new ticket counts from
#   _st_qn    live tickets, mine included
#   _st_pos   my rank among them, 1 = front and the only rank allowed to touch the lock
#   _st_mine  whether my own ticket is still there (a /tmp sweeper is not a reason to lose my place)
# `if` rather than `[ … ] && …` throughout: a false test at the end of a body exits a `set -e`
# caller (attic/steward-arena.sh), and "no ticket is older than mine" is the NORMAL outcome here.
_st_queue_scan() {
  _st_qmax=0
  _st_qn=0
  _st_pos=1
  _st_mine=0
  for _st_tk in "$FLEET_SUITE_QUEUE"/t*.*; do
    [ -d "$_st_tk" ] || continue
    _st_tb=${_st_tk##*/}
    _st_tn=${_st_tb%%.*}
    _st_tn=${_st_tn#t}
    _st_tp=${_st_tb##*.}
    case "$_st_tn" in ''|*[!0-9]*) continue ;; esac
    case "$_st_tp" in ''|*[!0-9]*) continue ;; esac
    if [ "$_st_tn" -gt "$_st_qmax" ]; then _st_qmax=$_st_tn; fi
    _st_tlive=1
    if ! kill -0 "$_st_tp" 2>/dev/null; then
      _st_tlive=0
    else
      _st_tbf=$(cat "$_st_tk/birth" 2>/dev/null || true)
      if [ -n "$_st_tbf" ] && _st_valid_birth "$_st_tbf"; then
        _st_tbn=$(_st_birth_of "$_st_tp")
        if [ -n "$_st_tbn" ] && [ "$_st_tbn" != "$_st_tbf" ]; then _st_tlive=0; fi
      fi
    fi
    if [ "$_st_tlive" = 0 ]; then
      rm -f "$_st_tk/birth" 2>/dev/null || true
      rmdir "$_st_tk" 2>/dev/null || true
      continue
    fi
    _st_qn=$(( _st_qn + 1 ))
    if [ "$_st_myn" -gt 0 ]; then
      if [ "$_st_tn" -lt "$_st_myn" ]; then
        _st_pos=$(( _st_pos + 1 ))
      elif [ "$_st_tn" -eq "$_st_myn" ] && [ "$_st_tp" -lt "$$" ]; then
        _st_pos=$(( _st_pos + 1 ))
      fi
      if [ "$_st_tn" -eq "$_st_myn" ] && [ "$_st_tp" -eq "$$" ]; then _st_mine=1; fi
    fi
  done
}
# Do we already run inside somebody's hold? FOUR conditions, and the three on disk are what make the
# variable safe to honour: it must name a pid, that pid must be the one the lock file records, that
# process must still be alive, and it must still be the process that WROTE the lock — its current
# birth equal to a valid recorded one. Fail any of them and this is an ordinary contender again —
# which is the whole guard against a stale export handing out an unserialized run. The birth half
# (2026-09-15, Astra-Befund 2): a live pid alone is what an ordinary waiter calls `unknown` or
# `stale`, never `held`, and a stale export plus a leftover lock plus a recycled pid let a suite
# skip the queue on exactly that. Missing, malformed or unmeasurable identity inherits NOTHING.
_st_held_by="${FLEET_SUITE_LOCK_HELD_BY:-}"
_st_lock_pid=$$
_st_inherited=0
if [ -n "$_st_held_by" ] \
  && [ "$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)" = "$_st_held_by" ] \
  && kill -0 "$_st_held_by" 2>/dev/null; then
  _st_held_birth=$(cat "$FLEET_SUITE_LOCK/birth" 2>/dev/null || true)
  _st_held_birth_now=$(_st_birth_of "$_st_held_by")
  if [ -n "$_st_held_birth" ] && _st_valid_birth "$_st_held_birth" \
    && [ -n "$_st_held_birth_now" ] && [ "$_st_held_birth_now" = "$_st_held_birth" ]; then
    _st_inherited=1
    _st_lock_pid=$_st_held_by
  fi
fi
if [ "$_st_inherited" = 0 ]; then
_st_self_birth=$(_st_birth_of "$$")
if [ -z "$_st_self_birth" ]; then
  printf '[suite-lock-error] %s cannot record process birth for pid %s; refusing to hold %s\n' "$_st_who" "$$" "$FLEET_SUITE_LOCK" >&2
  return 3 2>/dev/null || exit 3
fi
# Take the ticket BEFORE the first `mkdir` on the lock — the whole point is that arrival is
# recorded on arrival. Inside the inherited guard: a step running in somebody else's hold never
# reaches this and is never enqueued.
_st_myn=0
_st_ticket=""
mkdir -p "$FLEET_SUITE_QUEUE" 2>/dev/null || true
_st_queue_scan
_st_myn=$(( _st_qmax + 1 ))
_st_try=0
while [ "$_st_try" -lt 20 ]; do
  if mkdir "$FLEET_SUITE_QUEUE/t$_st_myn.$$" 2>/dev/null; then
    _st_ticket="$FLEET_SUITE_QUEUE/t$_st_myn.$$"
    break
  fi
  mkdir -p "$FLEET_SUITE_QUEUE" 2>/dev/null || true
  _st_myn=$(( _st_myn + 1 ))
  _st_try=$(( _st_try + 1 ))
done
if [ -n "$_st_ticket" ]; then
  printf '%s\n' "$_st_self_birth" > "$_st_ticket/birth"
else
  # Open, not closed: see the UNQUEUED note above. `_st_myn=0` makes _st_queue_scan leave _st_pos
  # at 1, so this contender races exactly as every contender did before the ticket existed.
  # Prefix deliberately NOT `[suite-lock] `: that is the wire format runVerify's SUITE_LOCK_RE
  # parses, and a line it cannot classify would be a wait silently recorded as zero.
  _st_myn=0
  printf '[suite-lock-unqueued] %s could not take a queue ticket under %s; contending UNORDERED, as before\n' "$_st_who" "$FLEET_SUITE_QUEUE" >&2
fi
while :; do
  _st_queue_scan
  # A ticket that vanished under us (a /tmp sweeper) is re-staked at its ORIGINAL number: we did
  # arrive when we arrived, and losing the place to a filesystem cleaner would be the starvation
  # this queue exists to end.
  if [ "$_st_myn" -gt 0 ] && [ "$_st_mine" = 0 ]; then
    if mkdir "$FLEET_SUITE_QUEUE/t$_st_myn.$$" 2>/dev/null; then
      _st_ticket="$FLEET_SUITE_QUEUE/t$_st_myn.$$"
      printf '%s\n' "$_st_self_birth" > "$_st_ticket/birth"
    fi
    _st_qn=$(( _st_qn + 1 ))
  fi
  if [ "$_st_pos" -eq 1 ] && mkdir "$FLEET_SUITE_LOCK" 2>/dev/null; then break; fi
  # `|| true`: a missing pid file makes `cat` fail, and under a `set -e` caller (attic/steward-arena.sh)
  # a failing command substitution in an assignment would abort the whole run — on the PARKED
  # state, i.e. exactly when it must instead be reported.
  _st_hp=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)
  _st_hb=$(cat "$FLEET_SUITE_LOCK/birth" 2>/dev/null || true)
  _st_srv=$(cat "$FLEET_SUITE_LOCK/held-by-fleet-server" 2>/dev/null || true)
  _st_dead=0
  _st_reap=0
  if [ ! -d "$FLEET_SUITE_LOCK" ]; then
    # Not a lock state at all: the mutex is FREE and someone who arrived before me has it next.
    # Said in its own words, because reading the absent dir would classify it `parked` — the one
    # state that never resolves — and a waiter told "parked" reasonably stops expecting a turn.
    _st_why="queued — the mutex is FREE and an older ticket is ahead of mine (t$_st_myn); it is handed over in arrival order"
  elif [ -z "$_st_hp" ]; then
    if [ -z "$_st_hb" ]; then
      _st_why="parked — the dir carries NO pid file, so nothing will ever reap it (rmdir it to release)"
    else
      _st_reap=1
      _st_why="stale — lock has a process-birth fingerprint but NO pid; reaping the torn acquisition"
    fi
  elif kill -0 "$_st_hp" 2>/dev/null; then
    _st_birth_now=$(_st_birth_of "$_st_hp")
    _st_srv_say=""
    if [ "$_st_srv" = "$_st_hp" ]; then
      _st_srv_say="held by the fleet server itself — never kill this pid $_st_hp; it gives the mutex back when its land ends — "
    fi
    if [ -z "$_st_hb" ]; then
      _st_why="${_st_srv_say}unknown — recorded pid $_st_hp is alive, but the lock has no process-birth fingerprint; not reaping a possibly live legacy holder"
    elif ! _st_valid_birth "$_st_hb"; then
      _st_why="${_st_srv_say}unknown — recorded pid $_st_hp is alive, but its process-birth fingerprint is malformed; not reaping a possibly live holder"
    elif [ -z "$_st_birth_now" ]; then
      _st_why="${_st_srv_say}unknown — recorded pid $_st_hp is alive, but its current process-birth fingerprint is unmeasurable; not reaping a possibly live holder"
    elif [ "$_st_birth_now" = "$_st_hb" ]; then
      _st_why="${_st_srv_say}held by live pid $_st_hp with proven identity (up $(ps -o etime= -p "$_st_hp" 2>/dev/null | tr -d ' ')): $(ps -o command= -p "$_st_hp" 2>/dev/null | cut -c1-70)"
    else
      # NO server wording here even when the marker names this pid: the birth changed, so the live
      # process is NOT the server that wrote the marker — it died and its pid was recycled.
      _st_dead=1
      _st_reap=1
      _st_why="stale — recorded pid $_st_hp is alive but its process-birth fingerprint changed; reaping the recycled-pid lock"
    fi
  else
    _st_dead=1
    _st_reap=1
    _st_why="stale — recorded pid $_st_hp is gone, nothing is running; reaping it"
  fi
  if [ "$_st_myn" -gt 0 ]; then
    _st_where="position $_st_pos of $_st_qn"
  else
    _st_where="unqueued (no ticket; racing, not ordered)"
  fi
  _st_el=$(( $(date +%s) - _st_t0 ))
  if [ "$_st_el" -ge "$_st_say_at" ]; then
    printf '[suite-lock] %s waiting %ss for %s — %s — %s\n' "$_st_who" "$_st_el" "$FLEET_SUITE_LOCK" "$_st_where" "$_st_why"
    _st_say_at=$(( _st_el + 60 ))
  fi
  if [ "$_st_reap" = 1 ]; then
    # `if` rather than the old `[ … ] && rm && rmdir` AND-OR chain: under `set -e` that list exits
    # the caller whenever the pid changed under us or the rmdir loses the race — a normal outcome
    # of the reap, turned into an abort.
    _st_cur_pid=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null || true)
    _st_cur_birth=$(cat "$FLEET_SUITE_LOCK/birth" 2>/dev/null || true)
    if [ "$_st_cur_pid" = "$_st_hp" ] && [ "$_st_cur_birth" = "$_st_hb" ]; then
      # the server's marker goes with the other two, or the rmdir fails on a dir that is not empty
      rm -f "$FLEET_SUITE_LOCK/held-by-fleet-server" "$FLEET_SUITE_LOCK/pid" "$FLEET_SUITE_LOCK/birth" && rmdir "$FLEET_SUITE_LOCK" 2>/dev/null || true
    fi
    continue
  fi
  sleep "$FLEET_SUITE_POLL_SEC"
done
echo "$$" > "$FLEET_SUITE_LOCK/pid"
printf '%s\n' "$_st_self_birth" > "$FLEET_SUITE_LOCK/birth"
# The ticket has done its job the moment the lock names the holder, and dropping it here is what
# keeps `position N of M` a count of WAITERS. The queue dir itself is left standing: rmdir-ing it
# would race a contender between its `mkdir -p` and its `mkdir t1.<pid>`, and an empty directory
# costs nothing — the numbering resets on its own once the last ticket is gone.
if [ -n "$_st_ticket" ]; then
  rm -f "$_st_ticket/birth" 2>/dev/null || true
  rmdir "$_st_ticket" 2>/dev/null || true
  _st_ticket=""
fi
fi
# ONE acquire format, on both paths — and that is a contract, not tidiness: runVerify sums exactly
# the lines this printf produces (SUITE_LOCK_RE), e2e/pins.ts requires that EXACTLY ONE of this
# file's suite-lock formats classify as an acquire, and a second one invented for the inherited case
# would be summed a second time. An inherited step therefore reports the truth in the existing
# words — `after 0s`, naming the pid that actually holds the lock — because silence here means
# "this command does not report its waits", which would be a different and false statement.
printf '[suite-lock] %s acquired after %ss (pid %s)\n' "$_st_who" "$(( $(date +%s) - _st_t0 ))" "$_st_lock_pid"

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

# stage_await_server_gone SOCK PORT — docs/verify-tiering.md §11.2i. A phase restart that kills its
# suite server and spawns the next one at once can hand `new-session` to a tmux server that is still
# dying: tmux answers "server exited unexpectedly", the pane never runs, and the phase waits out a
# bind that cannot come. So before each such spawn: wait until no `srv` session is left on SOCK —
# either no server answers, or the one that answers still holds OTHER sessions (a live server, not a
# dying one) — read twice in a row, AND nothing listens on PORT any more. Bounded (~10 s, 0.1 s
# steps); past the bound it says so and returns, so a stuck wait costs a line, not a hang.
stage_await_server_gone() {
  _st_gone_deadline=$(( $(date +%s) + 10 ))
  _st_gone_seen=0
  _st_gone_t0=$(date +%s)
  while [ "$(date +%s)" -le "$_st_gone_deadline" ]; do
    _st_gone_sessions=$(tmux -L "$1" list-sessions -F '#{session_name}' 2>/dev/null)
    _st_gone_rc=$?
    _st_gone_port=$(curl -s -o /dev/null --connect-timeout 0.2 -m 0.5 -w '%{http_code}' "http://127.0.0.1:$2/" 2>/dev/null)
    if [ "$_st_gone_port" = "000" ] && { [ "$_st_gone_rc" != 0 ] \
        || { [ -n "$_st_gone_sessions" ] && ! printf '%s\n' "$_st_gone_sessions" | grep -qx srv; }; }; then
      _st_gone_seen=$((_st_gone_seen + 1))
      [ "$_st_gone_seen" -ge 2 ] && return 0
    else
      _st_gone_seen=0
    fi
    sleep 0.1
  done
  printf 'e2e-stage: old suite server on socket %s / port %s not confirmed gone after %ss — spawning anyway\n' \
    "$1" "$2" "$(( $(date +%s) - _st_gone_t0 ))" >&2
  return 0
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

# --- the OTHER half of that reap: the pane CHILDREN a dead instance left behind ----------------
# The loop above retires a dead server's socket, and `scratch-reap.sh` retires its directory —
# neither touches a PROCESS ("Nothing here kills a process", scratch-reap.sh's own header). Only
# e2e-isolated.sh reaps pane children, and it can do it only through a socket's pane list: once
# that socket is gone (killed, or unlinked by the loop above), the children are reparented to init
# and nothing in any of the seven wrappers can still see them. What they DO still have is their
# cwd — inside the instance directory they were spawned in — and that is the identity used here.
#
# THE IDENTITY IS THE CWD, NEVER A NAME. `pkill -f` on any of these commands would reach the LIVE
# server (CLAUDE.md, AGENTS.md §Verify), and a suite pane runs `true; exec $SHELL` — a name pattern
# that matched it would match every shell on the box. A cwd under `$TMPDIR/fleet-e2e-*instance-<pid>`
# is a place nothing else on this machine runs: the live server's cwd is the checkout.
#
# THE LIVENESS GATE IS scratch-reap.sh's, verbatim in intent, and for its reason: these wrappers are
# expressly run CONCURRENTLY, so a live run's pid is alive BY DEFINITION and liveness can never shoot
# down a neighbour the way an age cutoff could. Both clauses must hold before anything is signalled:
# the pid in the dir name is dead, AND no tmux socket for that pid is left in the socket dir (the
# five wrapper families carry five prefixes, so the match is on the pid SUFFIX). A dead pid since
# recycled reads as alive, the children survive to the next run, and leaked processes cost less than
# a killed live run — the same safe direction every other reap in this repo takes.
#
# It FAILS OPEN: no way to read a cwd (no /proc, no lsof) means no pids, and the suite proceeds
# exactly as it did before this block existed.
_stage_cwd_pids() {  # $1 = directory prefix; prints the pids whose cwd is at or under it
  if [ -r /proc/self/cwd ]; then
    for _st_pd in /proc/[0-9]*; do
      _st_pp="${_st_pd#/proc/}"
      _st_cw=$(readlink "$_st_pd/cwd" 2>/dev/null) || continue
      case "$_st_cw" in "$1"|"$1"/*) printf '%s\n' "$_st_pp" ;; esac
    done
  else
    lsof -n -w -d cwd -F pn 2>/dev/null | awk -v pre="$1" '
      /^p/ { pid = substr($0, 2); next }
      /^n/ { p = substr($0, 2); if (p == pre || index(p, pre "/") == 1) print pid }'
  fi
}
_st_orphans=""
for _st_inst in "${TMPDIR:-/tmp}"/fleet-e2e-*instance-*; do
  [ -d "$_st_inst" ] || continue
  _st_ipid="${_st_inst##*-}"
  case "$_st_ipid" in ''|*[!0-9]*) continue ;; esac   # only …-<pid>, never a hand-named dir
  [ "$_st_ipid" = "$$" ] && continue
  kill -0 "$_st_ipid" 2>/dev/null && continue          # owner alive → a live run, hands off
  _st_isock=""
  for _st_s2 in "${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"/fleet*"$_st_ipid"; do
    [ -S "$_st_s2" ] && _st_isock=1
  done
  [ -n "$_st_isock" ] && continue                      # its socket still stands → e2e-isolated.sh's reap owns it
  for _st_op in $(_stage_cwd_pids "$_st_inst"); do
    [ "$_st_op" = "$$" ] && continue
    [ "$_st_op" = "1" ] && continue
    case " $_st_orphans " in *" $_st_op "*) ;; *) _st_orphans="$_st_orphans $_st_op" ;; esac
  done
done
if [ -n "$_st_orphans" ]; then
  printf '[suite-reap] %s: %s orphaned pane children of dead instances (by cwd)\n' \
    "$_st_who" "$(printf '%s' "$_st_orphans" | wc -w | tr -d ' ')" >&2
  for _st_op in $_st_orphans; do kill -TERM "$_st_op" 2>/dev/null; done
  sleep 1
  for _st_op in $_st_orphans; do kill -KILL "$_st_op" 2>/dev/null; done
fi

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
  cp -R "$_st_s/public" "$_st_s/package.json" "$_st_s/fleet-sync.sh" "$_st_d/" || return 1
  for _st_x in ${STAGE_EXTRA:-}; do
    cp -R "$_st_s/$_st_x" "$_st_d/" || return 1
  done
  [ -e "$_st_d/node_modules" ] || ln -s "$_st_s/node_modules" "$_st_d/node_modules" || return 1
  return 0
}

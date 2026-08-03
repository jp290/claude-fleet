#!/bin/sh
# The operator hook behind FLEET_GUEST_CMD — five verbs over the guest instance, and the one place
# that knows this deployment runs it in a colima VM behind a cloudflared tunnel.
#
# WHY A SCRIPT AND NOT CODE IN server.ts. Fleet must not learn what a guest *is*. It learns "there
# is a command with these verbs", the same idiom as the twenty existing FLEET_*_CMD roles — with
# one deliberate deviation: those pass a prompt on stdin and read a model's answer, this one takes
# a verb in argv and returns operator facts. It is an operator hook, not a worker. Unset the env
# var and the feature does not exist: no route, no buttons, no trace.
#
#   ./guest-ctl.sh status         JSON on stdout — the only read
#   ./guest-ctl.sh start          VM + container up, and back on the EXISTING deadline
#   ./guest-ctl.sh cut            close the public door, keep the deadline (panic button)
#   ./guest-ctl.sh stop           cut, then stop container and VM (destructive to sessions)
#   ./guest-ctl.sh renew [DAYS]   deliberately set a FRESH deadline (default 7), re-opening if cut
#
# THE LINE THIS SCRIPT MUST NOT CROSS: security events yes, content no. The owner sees THAT
# somebody knocked on the public hostname, never what was done inside the guest's sessions. The
# instance's own API could answer far more and holds a token this machine has — that is exactly
# why the boundary is written down rather than left to taste. A "peek at the guest's sessions"
# feature undoes the whole point of the container.
set -eu

# Deployment identity lives outside this public repository (see guest-expose.sh). The names below
# are generic and may stay in the file; the hostname never appears here, it comes from that env.
CONF_DIR="$HOME/.claude-fleet-guest"
[ -f "$CONF_DIR/expose.env" ] && . "$CONF_DIR/expose.env" || true
VM="${GUEST_VM:-fleetguest}"
CTR="${GUEST_CONTAINER:-fleet-guest}"
# Pinned, never ambient: `docker` on this machine has three contexts and the current one is a
# user setting. A status that silently reads a different VM's docker would be worse than no status.
CTX="${GUEST_DOCKER_CONTEXT:-colima-$VM}"
EXPOSE="$(cd "$(dirname "$0")" && pwd)/guest-expose.sh"
# The guest's own audit trail, inside its container — the file tokenGate already writes to.
GUEST_AUDIT='$HOME/claude-fleet/audit.jsonl'

d() { docker --context "$CTX" "$@"; }
# stdout of a probe that is allowed to fail: absence is a state, not an error
try() { "$@" 2>/dev/null || true; }

# `colima list` prints a table whose STATUS column is the answer; `colima status` writes its
# answer to STDERR, which is why this reads the table instead.
vm_state() {
  case "$(try colima list --profile "$VM" | awk -v p="$VM" '$1 == p { print $2 }')" in
    Running) echo running ;;
    "") echo absent ;;
    *) echo stopped ;;
  esac
}

ctr_state() {
  s=$(try d inspect -f '{{.State.Status}}' "$CTR")
  [ -n "$s" ] && echo "$s" || echo absent
}

# JSON string escaping for the two values that are not numbers or booleans. Everything else this
# script prints is derived from a fixed vocabulary, so this is the whole attack surface of the
# output: a hostname from the operator's own env file, and a fixed status word.
jstr() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

status_json() {
  # `state` is guest-expose.sh's machine-readable verb — parsing its prose was the alternative.
  # Read with sed rather than eval'd: this is operator-supplied text reaching a shell otherwise,
  # and the value it carries (a hostname) has no business being executable.
  st=$(try sh "$EXPOSE" state)
  val() { printf '%s\n' "$st" | sed -n "s/^$1=//p" | head -1; }
  exposed=$(val exposed); until_ts=$(val until); expired=$(val expired)
  timer=$(val timer); hostname=$(val hostname)
  # a numeric field is the one thing the JSON below cannot quote — so prove it is numeric
  case "$until_ts" in ''|*[!0-9]*) until_ts="" ;; esac

  # Auth failures: read out of the guest's OWN audit trail, which has recorded every wrong token
  # since the day it started and which nobody has ever read. Only reachable while the container
  # runs — a stopped guest reports nulls rather than zeros, because "no data" and "no attempts"
  # are different facts and a zero here would be a lie.
  fails1h=null; fails24h=null; lastfail=null
  if [ "$(ctr_state)" = "running" ]; then
    now_ms=$(( $(date +%s) * 1000 ))
    set -- $(try d exec "$CTR" sh -c "cat $GUEST_AUDIT" | awk -v now="$now_ms" '
      /"event":"owner_auth_fail"/ {
        if (match($0, /"ts":[0-9]+/)) {
          ts = substr($0, RSTART + 5, RLENGTH - 5) + 0
          if (now - ts <=  3600000) h++
          if (now - ts <= 86400000) d++
          if (ts > last) last = ts
        }
      }
      END { printf "%d %d %d", h + 0, d + 0, last + 0 }')
    fails1h=${1:-0}; fails24h=${2:-0}; lastfail=${3:-0}
    [ "$lastfail" = "0" ] && lastfail=null
  fi

  printf '{"vm":"%s","container":"%s","exposed":%s,"expired":%s,"until":%s,"timer":%s,' \
    "$(jstr "$(vm_state)")" "$(jstr "$(ctr_state)")" \
    "$([ "$exposed" = 1 ] && echo true || echo false)" \
    "$([ "$expired" = 1 ] && echo true || echo false)" \
    "${until_ts:-null}" \
    "$([ "$timer" = 1 ] && echo true || echo false)"
  printf '"hostname":"%s","authFails1h":%s,"authFails24h":%s,"lastAuthFail":%s}\n' \
    "$(jstr "$hostname")" "$fails1h" "$fails24h" "$lastfail"
}

case "${1:-status}" in
status) status_json ;;

start)
  # Idempotent all the way down, which is what makes this a button you may press when your friend
  # says it is not working: colima answers "already running, ignoring" in ~4s, docker start on a
  # running container is a no-op, and the door only re-opens on a deadline that is still valid.
  colima start -p "$VM"
  d start "$CTR" >/dev/null
  echo "guest-ctl: VM $VM and container $CTR are up"
  if sh "$EXPOSE" resume; then :; else
    echo "guest-ctl: the guest is RUNNING but NOT PUBLIC — no valid window (see above); 'renew' opens one"
  fi
  ;;

cut) sh "$EXPOSE" cut ;;

stop)
  # cut FIRST: a live ingress rule pointed at a stopped container answers 502 to the guest and to
  # anyone else who finds the hostname. Falling through to the tunnel's 404 is the honest state.
  sh "$EXPOSE" cut || true
  try d stop "$CTR" >/dev/null
  colima stop -p "$VM"
  echo "guest-ctl: container $CTR and VM $VM stopped — sessions are gone, the volume and the deadline are not"
  ;;

renew)
  # the ONLY verb that moves a deadline, which is why it is a separate press: after the owner's
  # decision (2026-08-03) `cut` keeps the clock running, so extending exposure can never be a side
  # effect of undoing a panic. `up` also re-opens the door if it was cut — that is the intent here.
  days="${2:-7}"
  case "$days" in ''|*[!0-9]*) echo "guest-ctl: DAYS must be a whole number" >&2; exit 2 ;; esac
  sh "$EXPOSE" up "$days"
  [ "$(ctr_state)" = running ] || \
    echo "guest-ctl: note — the container is NOT running, so the hostname answers 502 until 'start'"
  ;;

*) echo "usage: $0 status | start | cut | stop | renew [DAYS]" >&2; exit 2 ;;
esac

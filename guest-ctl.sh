#!/bin/sh
# The operator hook behind FLEET_GUEST_CMD — the verbs the info card's guest panel drives, and the
# one place that knows this deployment runs guests in a colima VM behind a cloudflared tunnel.
#
# WHY A SCRIPT AND NOT CODE IN server.ts. Fleet must not learn what a guest *is*. It learns "there
# is a command with these verbs", the same idiom as the twenty existing FLEET_*_CMD roles — with
# one deliberate deviation: those pass a prompt on stdin and read a model's answer, this one takes
# a verb in argv and returns operator facts. It is an operator hook, not a worker. Unset the env
# var and the feature does not exist: no route, no buttons, no trace.
#
#   ./guest-ctl.sh status          JSON ARRAY, one object per configured slot — the routine read,
#                                  carries no credential
#   ./guest-ctl.sh link   <slot>   JSON {url, token} — the invite, fetched only on demand
#   ./guest-ctl.sh start  <slot>   VM + container up, and back on the EXISTING deadline
#   ./guest-ctl.sh cut    <slot>   close the public door, keep the deadline (panic button)
#   ./guest-ctl.sh stop   <slot>   cut, then stop the container (destructive to its sessions)
#   ./guest-ctl.sh renew  <slot> [DAYS]   deliberately set a FRESH deadline (default 7)
#   ./guest-ctl.sh claude-token <slot>    give this guest the Claude credential its panes need,
#                                         read from STDIN; recreates the container in place
#   ./guest-ctl.sh provision <slot> [hostname]   make an empty place into a real guest: directory,
#                                         token, volumes, container on its own port, expose.env.
#                                         Stops at the DNS record, which is yours to run
#   ./guest-ctl.sh export <slot> [work|all]   tar a guest's volumes out to a 0600 file. `work` is
#                                         their project volume and is safe to hand back to them;
#                                         `all` also carries credential and transcripts — a backup,
#                                         not an attachment
#   ./guest-ctl.sh import <slot> <file.tar>   put one back; refuses while the guest is running
#
# SLOTS. A guest slot is a directory under ~/.claude-fleet-guest holding that guest's expose.env
# and token; slot 1 is the original. They share one colima VM (a second VM costs ~200 MB of host
# RAM at idle, a second container ~25 MB) and differ in container, port, hostname, credential and
# deadline — so two people get two isolated Fleets, not two seats in one.
#
# THE LINE THIS SCRIPT MUST NOT CROSS: security events yes, content no. The owner sees THAT
# somebody knocked on a guest's public hostname, never what was done inside it. The instances' own
# APIs could answer far more and hold tokens this machine has — that is exactly why the boundary is
# written down rather than left to taste.
set -eu

CONF_DIR="$HOME/.claude-fleet-guest"
EXPOSE="$(cd "$(dirname "$0")" && pwd)/guest-expose.sh"
# The guest's own audit trail, inside its container — the file its tokenGate already writes to.
GUEST_AUDIT='$HOME/claude-fleet/audit.jsonl'

VERB="${1:-status}"
SLOT="${2:-1}"
case "$SLOT" in ''|*[!0-9]*) echo "guest-ctl: slot must be a whole number" >&2; exit 2 ;; esac

# Per-slot deployment identity, sourced only for the verbs that act on one slot. Names default off
# the slot id so a new guest needs no extra keys; slot 1 predates the scheme and names itself.
slot_conf() {
  _s="$1"
  GUEST_VM=fleetguest; GUEST_CONTAINER=; GUEST_DOCKER_CONTEXT=
  [ -f "$CONF_DIR/$_s/expose.env" ] && . "$CONF_DIR/$_s/expose.env" || true
  VM="${GUEST_VM:-fleetguest}"
  CTR="${GUEST_CONTAINER:-fleet-guest-$_s}"
  # Pinned, never ambient: `docker` on this machine has three contexts and the current one is a
  # user setting. A status that silently read a different VM's docker would be worse than none.
  CTX="${GUEST_DOCKER_CONTEXT:-colima-$VM}"
}

d() { docker --context "$CTX" "$@"; }
# stdout of a probe that is allowed to fail: absence is a state, not an error
try() { "$@" 2>/dev/null || true; }

# `colima status` writes its answer to STDERR; the readable state is the STATUS column of
# `colima list`, which is what this parses.
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

# JSON string escaping for the values that are not numbers or booleans.
jstr() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

slot_json() {
  _s="$1"
  slot_conf "$_s"
  st=$(try env GUEST_SLOT="$_s" sh "$EXPOSE" state)
  val() { printf '%s\n' "$st" | sed -n "s/^$1=//p" | head -1; }
  exposed=$(val exposed); until_ts=$(val until); expired=$(val expired)
  timer=$(val timer); hostname=$(val hostname)
  # a numeric field is the one thing the JSON below cannot quote — so prove it is numeric
  case "$until_ts" in ''|*[!0-9]*) until_ts="" ;; esac

  # Auth failures out of the guest's OWN audit trail, which has recorded every wrong token since
  # the day it started and which nobody has ever read. Only reachable while the container runs — a
  # stopped guest reports nulls rather than zeros, because "no data" and "no attempts" are
  # different facts and a zero here would be a lie.
  fails1h=null; fails24h=null; lastfail=null
  cs=$(ctr_state)
  if [ "$cs" = "running" ]; then
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

  # Does this guest hold a Claude credential at all? A BOOLEAN, never the value — without one the
  # dashboard opens, sessions start and `claude` dies in every pane, which is the single most
  # confusing way for a guest to be broken. null when there is no container to ask.
  claude=null
  [ "$cs" = absent ] || claude=$(try d inspect "$CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -q '^CLAUDE_CODE_OAUTH_TOKEN=.' && echo true || echo false)

  # Is this guest's Claude state — the credential once somebody logs in, and every transcript under
  # projects/ — on a named volume, or on the container's writable layer? A BOOLEAN, never a path:
  # the panel's only job with it is to warn before `claude-token` recreates the container and throws
  # a conversation history away. false is the un-migrated default (guest-claude-volume.sh fixes it).
  claudevol=null
  if [ "$cs" != absent ]; then
    _cfg=$(try d inspect "$CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' \
      | sed -n 's/^CLAUDE_CONFIG_DIR=//p' | head -1)
    [ -n "$_cfg" ] || _cfg="/home/fleet/.claude"
    if try d inspect "$CTR" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$_cfg"; then
      claudevol=true
    else
      claudevol=false
    fi
  fi

  printf '{"slot":%s,"vm":"%s","container":"%s","exposed":%s,"expired":%s,"until":%s,"timer":%s,' \
    "$_s" "$(jstr "$(vm_state)")" "$(jstr "$cs")" \
    "$([ "$exposed" = 1 ] && echo true || echo false)" \
    "$([ "$expired" = 1 ] && echo true || echo false)" \
    "${until_ts:-null}" \
    "$([ "$timer" = 1 ] && echo true || echo false)"
  printf '"hostname":"%s","authFails1h":%s,"authFails24h":%s,"lastAuthFail":%s,"claudeAuth":%s,"claudeVolume":%s}' \
    "$(jstr "$hostname")" "$fails1h" "$fails24h" "$lastfail" "$claude" "$claudevol"
}

case "$VERB" in
status)
  # every configured slot, in one read — the panel renders one block per element
  printf '{"guests":['
  first=1
  for s in $(sh "$EXPOSE" slots); do
    [ "$first" = 1 ] || printf ','
    first=0
    slot_json "$s"
  done
  printf ']}\n'
  ;;

link)
  # What you hand to the person you are inviting: the address plus that guest instance's own owner
  # token. Its OWN verb, never a field on `status` — status is read on every card open and after
  # every action, and a credential that rides along on a routine read is a credential in every log
  # that ever captures one.
  [ -f "$CONF_DIR/$SLOT/token" ] || { echo "guest-ctl: no token at $CONF_DIR/$SLOT/token" >&2; exit 2; }
  _h=$(try env GUEST_SLOT="$SLOT" sh "$EXPOSE" state | sed -n 's/^hostname=//p' | head -1)
  [ -n "$_h" ] || { echo "guest-ctl: slot $SLOT has no hostname configured" >&2; exit 2; }
  printf '{"url":"https://%s","token":"%s"}\n' \
    "$(jstr "$_h")" "$(jstr "$(tr -d '\n' < "$CONF_DIR/$SLOT/token")")"
  ;;

claude-token)
  # GIVE this guest the Claude credential its panes need. Read from STDIN, never argv: an argv is
  # visible in `ps` to every process on the machine for as long as the command runs, and this is
  # somebody's subscription. Docker env is where it has to end up (the image reads
  # CLAUDE_CODE_OAUTH_TOKEN at pane spawn), so it is `docker inspect`-visible to whoever can reach
  # this daemon — that is the accepted cost of the documented mechanism, not an oversight.
  #
  # A container cannot have its env changed in place, so this RECREATES it from its own running
  # configuration — ports, volumes, caps, memory, user, restart policy and FLEET_* env are read
  # back out of docker inspect rather than re-derived, so nothing about this guest is retyped and
  # nothing drifts. Both named volumes survive `docker rm`, so the instance keeps its identity:
  # same Fleet token, same slots, same ledgers, same invite link.
  slot_conf "$SLOT"
  OAUTH=$(tr -d '\n\r' | head -c 4096)
  case "$OAUTH" in
    sk-ant-oat*) : ;;
    "") echo "guest-ctl: no token on stdin" >&2; exit 2 ;;
    *) echo "guest-ctl: that is not a 'claude setup-token' value (expected sk-ant-oat…)" >&2; exit 2 ;;
  esac
  d inspect "$CTR" >/dev/null 2>&1 || { echo "guest-ctl: slot $SLOT has no container to update ($CTR)" >&2; exit 2; }

  IMAGE=$(d inspect "$CTR" --format '{{.Config.Image}}')
  PORTS=$(d inspect "$CTR" --format '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}-p {{.HostIp}}:{{.HostPort}}:{{$p}} {{end}}{{end}}' | sed 's|/tcp||g')
  MOUNTS=$(d inspect "$CTR" --format '{{range .Mounts}}-v {{.Name}}:{{.Destination}} {{end}}')
  CAPS=$(d inspect "$CTR" --format '{{range .HostConfig.CapAdd}}--cap-add {{.}} {{end}}')
  MEM=$(d inspect "$CTR" --format '{{.HostConfig.Memory}}')
  RUNUSER=$(d inspect "$CTR" --format '{{.Config.User}}')
  RESTART=$(d inspect "$CTR" --format '{{.HostConfig.RestartPolicy.Name}}')
  # carry the run-time env forward, minus what the image sets itself (PATH/HOME/CLAUDE_CONFIG_DIR)
  # and minus any previous OAuth value
  ENVFILE=$(mktemp); chmod 600 "$ENVFILE"
  trap 'rm -f "$ENVFILE"' EXIT INT TERM
  d inspect "$CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -E '^FLEET_' > "$ENVFILE" || true
  printf 'CLAUDE_CODE_OAUTH_TOKEN=%s\n' "$OAUTH" >> "$ENVFILE"

  d rm -f "$CTR" >/dev/null
  # shellcheck disable=SC2086
  d run -d --name "$CTR" --restart "$RESTART" --memory "$MEM" --user "$RUNUSER" \
    $CAPS $PORTS $MOUNTS --env-file "$ENVFILE" "$IMAGE" >/dev/null
  rm -f "$ENVFILE"
  echo "guest-ctl: slot $SLOT — container $CTR recreated with a Claude credential; its volumes and token are unchanged"
  ;;

start)
  # Idempotent all the way down, which is what makes this a button you may press when your friend
  # says it is not working: colima answers "already running, ignoring" in ~4s, docker start on a
  # running container is a no-op, and the door only re-opens on a deadline that is still valid.
  slot_conf "$SLOT"
  colima start -p "$VM"
  d start "$CTR" >/dev/null
  echo "guest-ctl: slot $SLOT — VM $VM and container $CTR are up"
  if env GUEST_SLOT="$SLOT" sh "$EXPOSE" resume; then :; else
    echo "guest-ctl: slot $SLOT is RUNNING but NOT PUBLIC — no valid window (see above); 'renew' opens one"
  fi
  ;;

cut) slot_conf "$SLOT"; env GUEST_SLOT="$SLOT" sh "$EXPOSE" cut ;;

stop)
  # cut FIRST: a live ingress rule pointed at a stopped container answers 502 to the guest and to
  # anyone else who finds the hostname. Falling through to the tunnel's 404 is the honest state.
  # The VM is NOT stopped — the other slot may be using it.
  slot_conf "$SLOT"
  env GUEST_SLOT="$SLOT" sh "$EXPOSE" cut || true
  try d stop "$CTR" >/dev/null
  echo "guest-ctl: slot $SLOT — container $CTR stopped; its sessions are gone, its volume and deadline are not"
  ;;

renew)
  # the ONLY verb that moves a deadline, which is why it is a separate press: after the owner's
  # decision (2026-08-03) `cut` keeps the clock running, so extending exposure can never be a side
  # effect of undoing a panic. `up` also re-opens the door if it was cut — that is the intent here.
  slot_conf "$SLOT"
  days="${3:-7}"
  case "$days" in ''|*[!0-9]*) echo "guest-ctl: DAYS must be a whole number" >&2; exit 2 ;; esac
  env GUEST_SLOT="$SLOT" sh "$EXPOSE" up "$days"
  [ "$(ctr_state)" = running ] || \
    echo "guest-ctl: note — slot $SLOT's container is NOT running, so the hostname answers 502 until 'start'"
  ;;

provision)
  # Make an empty place into a real guest, up to — and stopping at — the one step that reaches the
  # outside world. Everything local is done here: directory, token, volumes, container on its own
  # port, expose.env. The DNS record is NOT done here and never will be; it is printed for you to
  # run, because a script that creates public names is a script that can create them by accident.
  #
  # The recipe is DERIVED from an existing slot rather than written down: image, tunnel config,
  # caps, memory and restart policy are this deployment's facts, and this file is public. With no
  # slot to copy from, it says so instead of guessing.
  #
  #   ./guest-ctl.sh provision 2                 local only — no hostname, not public
  #   ./guest-ctl.sh provision 2 guest2.example.com
  slot_conf "$SLOT"
  NEWHOST="${3:-}"
  [ -f "$CONF_DIR/$SLOT/expose.env" ] && { echo "guest-ctl: slot $SLOT already exists ($CONF_DIR/$SLOT/expose.env)" >&2; exit 2; }
  d inspect "$CTR" >/dev/null 2>&1 && { echo "guest-ctl: container $CTR already exists" >&2; exit 2; }

  REF=$(for _d in "$CONF_DIR"/[0-9]*; do [ -f "$_d/expose.env" ] && basename "$_d"; done | head -1)
  [ -n "$REF" ] || { echo "guest-ctl: no existing slot to copy this deployment's shape from — provision the first guest by hand" >&2; exit 2; }
  # shellcheck disable=SC1090
  ( : ) ; REF_TUNNEL=$(sed -n 's/^TUNNEL_CONFIG=//p' "$CONF_DIR/$REF/expose.env" | tr -d '"'"'"'"')
  REF_CTR=$(sed -n 's/^GUEST_CONTAINER=//p' "$CONF_DIR/$REF/expose.env" | tr -d '"'"'"'"')
  [ -n "$REF_CTR" ] || REF_CTR="fleet-guest-$REF"
  d inspect "$REF_CTR" >/dev/null 2>&1 || { echo "guest-ctl: reference container $REF_CTR is gone; cannot derive the shape" >&2; exit 2; }

  IMAGE=$(d inspect "$REF_CTR" --format '{{.Config.Image}}')
  CAPS=$(d inspect "$REF_CTR" --format '{{range .HostConfig.CapAdd}}--cap-add {{.}} {{end}}')
  MEM=$(d inspect "$REF_CTR" --format '{{.HostConfig.Memory}}')
  RESTART=$(d inspect "$REF_CTR" --format '{{.HostConfig.RestartPolicy.Name}}')
  RUNUSER=$(d inspect "$REF_CTR" --format '{{.Config.User}}')
  INNER=$(d inspect "$REF_CTR" --format '{{range $p, $b := .HostConfig.PortBindings}}{{$p}}{{end}}' | sed 's|/tcp||')
  BINDIP=$(d inspect "$REF_CTR" --format '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}{{.HostIp}}{{end}}{{end}}')
  # the next free host port above every guest that already has one — never a fixed offset, because
  # a slot that was provisioned and removed must not hand its port to the next one by arithmetic
  PORT=$(d ps -a --format '{{.Names}}' | while read -r _c; do
      d inspect "$_c" --format '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}{{.HostPort}}{{println}}{{end}}{{end}}'
    done | sort -n | tail -1)
  PORT=$((${PORT:-8790} + 1))

  echo "guest-ctl: provisioning slot $SLOT — container $CTR on $BINDIP:$PORT, image $IMAGE"
  mkdir -p "$CONF_DIR/$SLOT"; chmod 700 "$CONF_DIR" "$CONF_DIR/$SLOT"
  TOKEN=$(openssl rand -hex 32)
  printf '%s' "$TOKEN" > "$CONF_DIR/$SLOT/token"; chmod 600 "$CONF_DIR/$SLOT/token"

  for _v in state work claude; do d volume create "$CTR-$_v" >/dev/null; done
  ALLOWED="127.0.0.1:$PORT,localhost:$PORT"
  [ -n "$NEWHOST" ] && ALLOWED="$NEWHOST,$ALLOWED"
  ENVFILE=$(mktemp); chmod 600 "$ENVFILE"
  trap 'rm -f "$ENVFILE"' EXIT INT TERM
  {
    printf 'FLEET_FIREWALL=1\nFLEET_HOST=0.0.0.0\nFLEET_PORT=%s\nFLEET_CMD=claude\n' "$INNER"
    printf 'FLEET_ALLOWED_HOSTS=%s\nFLEET_TOKEN=%s\n' "$ALLOWED" "$TOKEN"
  } > "$ENVFILE"
  # .claude gets a volume from the START. Slot 1 had to be migrated (guest-claude-volume.sh) because
  # it did not, and a recreate there silently took the credential and every transcript with it.
  CFG=$(d inspect "$REF_CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^CLAUDE_CONFIG_DIR=//p' | head -1)
  [ -n "$CFG" ] || CFG=/home/fleet/.claude
  # shellcheck disable=SC2086
  d run -d --name "$CTR" --restart "$RESTART" --memory "$MEM" --user "$RUNUSER" \
    $CAPS -p "$BINDIP:$PORT:$INNER" \
    -v "$CTR-state:/home/fleet/claude-fleet" -v "$CTR-work:/home/fleet/work" -v "$CTR-claude:$CFG" \
    --env-file "$ENVFILE" "$IMAGE" >/dev/null
  rm -f "$ENVFILE"

  {
    [ -n "$NEWHOST" ] && printf 'GUEST_HOSTNAME=%s\n' "$NEWHOST"
    printf 'GUEST_SERVICE=http://127.0.0.1:%s\n' "$PORT"
    printf 'TUNNEL_CONFIG=%s\n' "$REF_TUNNEL"
    printf 'GUEST_CONTAINER=%s\n' "$CTR"
  } > "$CONF_DIR/$SLOT/expose.env"
  chmod 600 "$CONF_DIR/$SLOT/expose.env"

  echo "guest-ctl: slot $SLOT is up locally on http://127.0.0.1:$PORT and now appears in status"
  if [ -n "$NEWHOST" ]; then
    echo "guest-ctl: TWO steps are left and BOTH are yours, because they reach outside this machine:"
    echo "    1. cloudflared tunnel route dns <tunnel> $NEWHOST"
    echo "    2. ./guest-ctl.sh renew $SLOT   (opens its window and the door)"
  else
    echo "guest-ctl: NO hostname configured — it is reachable locally and cannot be exposed."
    echo "    add GUEST_HOSTNAME to $CONF_DIR/$SLOT/expose.env, add its DNS record, then 'renew $SLOT'"
  fi
  echo "guest-ctl: it has NO Claude credential yet — log into it, or use 'claude-token $SLOT'"
  ;;

export)
  # Get a guest's work OFF the box. TWO SCOPES on purpose, and the difference is exactly "can I
  # forward this file to the person it belongs to": `work` is their project volume and nothing
  # else; `all` is every named volume this container has, which includes the Claude state — their
  # credential and every transcript — and is therefore a backup, never an attachment.
  #
  # The volumes are read from the container's OWN mounts rather than named here, so a guest whose
  # layout differs exports what it actually has instead of what this script assumed. The container
  # is NOT stopped: this is a snapshot of a live filesystem, which is fine for handing someone their
  # repo and wrong for anything that must be byte-consistent — stop the guest first if you need that.
  slot_conf "$SLOT"
  scope="${3:-work}"
  case "$scope" in work|all) : ;; *) echo "guest-ctl: export scope must be 'work' or 'all'" >&2; exit 2 ;; esac
  d inspect "$CTR" >/dev/null 2>&1 || { echo "guest-ctl: slot $SLOT has no container ($CTR)" >&2; exit 2; }
  IMAGE=$(d inspect "$CTR" --format '{{.Config.Image}}')
  LIST=$(mktemp); trap 'rm -f "$LIST"' EXIT INT TERM
  d inspect "$CTR" --format '{{range .Mounts}}{{if .Name}}{{.Name}}|{{.Destination}}{{println}}{{end}}{{end}}' > "$LIST"
  ARGS=''; PATHS=''
  while IFS='|' read -r _n _dst; do
    [ -n "$_n" ] || continue
    if [ "$scope" = work ]; then
      case "$_dst" in */work) : ;; *) continue ;; esac
    fi
    # mounted under /x so the tar keeps each volume's real destination path, which is what lets
    # import put it back without being told where anything belongs
    ARGS="$ARGS -v $_n:/x$_dst"
    PATHS="$PATHS .$_dst"
  done < "$LIST"
  [ -n "$ARGS" ] || { echo "guest-ctl: slot $SLOT has no volume matching scope '$scope'" >&2; exit 2; }
  OUT="${GUEST_EXPORT_DIR:-$CONF_DIR/$SLOT}/export-$scope-$(date +%Y%m%d-%H%M%S).tar"
  mkdir -p "$(dirname "$OUT")"
  # --entrypoint sh for the same reason import needs it: this image's entrypoint drops to uid 1000
  # even under --user root, so a volume it cannot read would export as an empty archive. It also
  # keeps the entrypoint's banner off the pipe entirely, and stdout must carry the tar and nothing
  # else or the archive is corrupt.
  # shellcheck disable=SC2086
  d run --rm $ARGS --user root --entrypoint sh "$IMAGE" -c "tar -cpf - -C /x $PATHS" > "$OUT"
  chmod 600 "$OUT"
  printf '{"path":"%s","scope":"%s","bytes":%s}\n' "$(jstr "$OUT")" "$scope" "$(wc -c < "$OUT" | tr -d ' ')"
  ;;

import)
  # Put an exported tar back. Restoring a volume under a LIVE Fleet hands it a filesystem that
  # changed beneath it, and that failure surfaces later as corruption rather than as an error here,
  # so a running guest is refused rather than raced.
  slot_conf "$SLOT"
  TARFILE="${3:-}"
  [ -n "$TARFILE" ] || { echo "guest-ctl: import needs a tar path: $0 import <slot> <file.tar>" >&2; exit 2; }
  [ -f "$TARFILE" ] || { echo "guest-ctl: no such file: $TARFILE" >&2; exit 2; }
  d inspect "$CTR" >/dev/null 2>&1 || { echo "guest-ctl: slot $SLOT has no container ($CTR)" >&2; exit 2; }
  if [ "$(ctr_state)" = running ]; then
    echo "guest-ctl: slot $SLOT is running — stop it first; import must not run under a live guest" >&2
    exit 2
  fi
  IMAGE=$(d inspect "$CTR" --format '{{.Config.Image}}')
  LIST=$(mktemp); trap 'rm -f "$LIST"' EXIT INT TERM
  d inspect "$CTR" --format '{{range .Mounts}}{{if .Name}}{{.Name}}|{{.Destination}}{{println}}{{end}}{{end}}' > "$LIST"
  ARGS=''
  while IFS='|' read -r _n _dst; do
    [ -n "$_n" ] || continue
    ARGS="$ARGS -v $_n:/x$_dst"
  done < "$LIST"
  [ -n "$ARGS" ] || { echo "guest-ctl: slot $SLOT has no named volumes to restore into" >&2; exit 2; }
  # -p keeps the uid/gid the guest's own user needs, and that needs root to honour — which this
  # image's entrypoint takes away even under --user root, so it is bypassed. Restoring into a fresh
  # (root-owned) volume fails outright without this; restoring into an existing one silently
  # succeeds for the wrong reason, which is how it passed its first test. Paths outside the mounted
  # volumes land in the throwaway container's layer and disappear with it.
  # shellcheck disable=SC2086
  d run --rm -i $ARGS --user root --entrypoint sh "$IMAGE" -c "tar -xpf - -C /x" < "$TARFILE"
  echo "guest-ctl: slot $SLOT — restored $(wc -c < "$TARFILE" | tr -d ' ') bytes into its volumes; 'start' brings it back"
  ;;

*) echo "usage: $0 status | link <slot> | start <slot> | cut <slot> | stop <slot> | renew <slot> [DAYS] | claude-token <slot> (token on stdin) | export <slot> [work|all] | import <slot> <file.tar>" >&2; exit 2 ;;
esac

#!/bin/sh
# Expose a guest Fleet container on a public hostname — for a bounded time, enforced by a timer
# rather than by anyone's memory.
#
# WHY THE INGRESS RULE IS THE SWITCH, and not DNS. `cloudflared tunnel route dns` can CREATE a
# record and cannot delete one; taking a hostname down through DNS needs the Cloudflare API and a
# token this machine has no reason to hold. The ingress rule is the opposite: local, instant, and
# revocable with a signal. With the rule gone the hostname falls through to the tunnel's
# `http_status:404`, so the DNS record may stay forever and still point at nothing.
#
# WHY A TIMER AT ALL. This hostname serves a full owner dashboard, and Fleet's token gate has no
# lockout — 400 ms and an audit line (server.ts, tokenGate), while the share path beside it is
# throttled and locked at 50/hour and says `(public-facing)` in its comment. The owner decided
# against an edge identity check (2026-08-03) and for a bounded window instead. A bound that
# depends on someone remembering is not a bound, so it is a launchd job here.
#
# HOURLY CHECK, NOT A ONE-SHOT AT THE DEADLINE. This runs on a laptop: it sleeps, it reboots, it
# is closed over a weekend. A job scheduled for one exact minute is missed if the machine is
# asleep for that minute; an hourly comparison against a stored timestamp catches up the moment
# the lid opens, and survives a reboot with no state in the scheduler at all.
#
# CUT AND DOWN ARE DIFFERENT VERBS, and the difference is the deadline (owner's decision,
# 2026-08-03). `cut` is the panic button: it shuts the door and the window keeps running down, so
# undoing a panic returns you to the ORIGINAL deadline instead of silently granting a fresh week —
# a panic button that extends the exposure when you undo it is the wrong shape. `down` is "I am
# done with this": rule, timer and deadline all go. Re-opening on the same deadline is `resume`;
# deliberately setting a new one is `up` (which is what a renew button calls).
#
#   ./guest-expose.sh up [DAYS]   default 7 — open, and set a FRESH deadline
#   ./guest-expose.sh cut         close the door, KEEP the deadline and the timer
#   ./guest-expose.sh resume      re-open on the EXISTING deadline; refuses once it has passed
#   ./guest-expose.sh down        close and forget: rule, timer and deadline
#   ./guest-expose.sh status
#   ./guest-expose.sh state       the same facts as key=value, for guest-ctl.sh to read
#   ./guest-expose.sh enforce     what the timer ran before there were slots; one slot
#   ./guest-expose.sh enforce-all what the timer runs now: every configured slot
#   ./guest-expose.sh slots       the slot ids that are configured, one per line
#
# EVERY VERB ACTS ON ONE SLOT, chosen by GUEST_SLOT (default 1):  GUEST_SLOT=2 ./guest-expose.sh up
# A slot is simply a directory under ~/.claude-fleet-guest — creating 2/ creates a second guest, and
# nothing here is capped at two. Deliberately an env var rather than a positional: `up [DAYS]` was
# already positional and a second number there would be a foot-gun aimed at the deadline.
set -eu

# Deployment identity lives outside this public repository. Create ~/.claude-fleet-guest/<slot>/expose.env:
#   GUEST_HOSTNAME=guest.example.com
#   GUEST_SERVICE=http://127.0.0.1:8791
#   TUNNEL_CONFIG=$HOME/.cloudflared/config-<name>.yml
CONF_DIR="$HOME/.claude-fleet-guest"
SLOT="${GUEST_SLOT:-1}"
case "$SLOT" in ''|*[!0-9]*) echo "guest-expose: GUEST_SLOT must be a whole number" >&2; exit 2 ;; esac
SLOT_DIR="$CONF_DIR/$SLOT"
CONF_ENV="$SLOT_DIR/expose.env"

PLIST="$HOME/Library/LaunchAgents/com.claude-fleet.guest-expose.plist"
LABEL="com.claude-fleet.guest-expose"
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

# `slots` and `enforce-all` must work before any single slot's config is loaded, so they run here
# and exit rather than falling through the per-slot validation below.
slot_ids() { for _d in "$CONF_DIR"/[0-9]*; do [ -f "$_d/expose.env" ] && basename "$_d"; done; }
case "${1:-status}" in
slots) slot_ids; exit 0 ;;
enforce-all)
  # ONE timer for every slot: a per-slot launchd job would mean N labels to install, reap and
  # reason about, and a window whose enforcer was never installed is the exact failure this
  # script exists to prevent.
  for _s in $(slot_ids); do GUEST_SLOT="$_s" "$SELF" enforce || true; done
  exit 0
  ;;
esac

[ -f "$CONF_ENV" ] || { echo "guest-expose: slot $SLOT is not configured (missing $CONF_ENV)" >&2; exit 2; }
# shellcheck disable=SC1090
. "$CONF_ENV"
: "${GUEST_HOSTNAME:?set GUEST_HOSTNAME in $CONF_ENV}"
: "${GUEST_SERVICE:?set GUEST_SERVICE in $CONF_ENV}"
: "${TUNNEL_CONFIG:?set TUNNEL_CONFIG in $CONF_ENV}"

EXPIRY_FILE="$SLOT_DIR/expose-until"
BEGIN="  # >>> fleet-guest-expose-$SLOT (managed by claude-fleet/guest-expose.sh — do not edit by hand) >>>"
END="  # <<< fleet-guest-expose-$SLOT <<<"
# The marker the single-guest version wrote, with no slot in it. Slot 1 must still recognise a
# block left by that version, or `cut` would report "already cut" while the door stood open — a
# panic button that lies is worse than no panic button. Rewritten to the new form on the next
# add_rule; until then both are honoured for detection and removal.
LEGACY_BEGIN="  # >>> fleet-guest-expose (managed by claude-fleet/guest-expose.sh — do not edit by hand) >>>"
LEGACY_END="  # <<< fleet-guest-expose <<<"
legacy() { [ "$SLOT" = 1 ] && grep -qF "$LEGACY_BEGIN" "$TUNNEL_CONFIG"; }

exposed() { grep -qF "$BEGIN" "$TUNNEL_CONFIG" || legacy; }

# TOGGLING THIS COSTS A BRIEF OUTAGE OF THE WHOLE TUNNEL — measured, and not what the author
# assumed. SIGHUP does not hot-reload this cloudflared build: it terminates, and launchd's KeepAlive
# starts a fresh process (the pid changed on every call: 83420 → 12680 → 16291 → 17021). For ~30 s
# afterwards EVERY hostname on the tunnel answers 502, the owner's website included. It recovers on
# its own with no intervention, and nothing else is affected — but `up` and `down` are therefore
# not free, so do not toggle them casually, and never during something that matters.
#
# Validate BEFORE signalling. With a restart rather than a reload, a broken config does not merely
# fail to apply — the process comes back up, rejects it, and every hostname stays down.
reload() {
  cloudflared tunnel --config "$TUNNEL_CONFIG" ingress validate >/dev/null 2>&1 || {
    echo "guest-expose: ingress validation FAILED — restoring backup, tunnel untouched" >&2
    cp "$TUNNEL_CONFIG.guest-expose-bak" "$TUNNEL_CONFIG"
    exit 1
  }
  pid=$(pgrep -f "cloudflared tunnel --config $TUNNEL_CONFIG" || true)
  [ -n "$pid" ] && kill -HUP $pid && echo "guest-expose: cloudflared reloaded (pid $pid)"
}

# Adding and removing the rule are shared by four verbs (up/resume open, cut/down close), so they
# live here once: the awk was duplicated the moment `cut` needed the same closing move as `down`.
add_rule() {
  if exposed; then echo "guest-expose: ingress rule already present"; return 0; fi
  cp -p "$TUNNEL_CONFIG" "$TUNNEL_CONFIG.guest-expose-bak"
  # insert before the catch-all, which must stay last: cloudflared matches rules in order and a
  # rule after `service: http_status:404` is unreachable.
  awk -v b="$BEGIN" -v e="$END" -v h="  - hostname: $GUEST_HOSTNAME" -v s="    service: $GUEST_SERVICE" '
    /^[[:space:]]*- service: http_status:404/ && !done { print b; print h; print s; print e; done=1 }
    { print }
  ' "$TUNNEL_CONFIG" > "$TUNNEL_CONFIG.tmp" && mv "$TUNNEL_CONFIG.tmp" "$TUNNEL_CONFIG"
  reload
}

del_rule() {
  exposed || return 1
  cp -p "$TUNNEL_CONFIG" "$TUNNEL_CONFIG.guest-expose-bak"
  # removes THIS slot's block in either marker form — a slot-1 block written by the single-guest
  # version must still be removable, or cut would silently leave the door open (see LEGACY_BEGIN)
  awk -v b="$BEGIN" -v e="$END" -v lb="$LEGACY_BEGIN" -v le="$LEGACY_END" -v leg="$([ "$SLOT" = 1 ] && echo 1 || echo 0)" '
    $0 == b || (leg == 1 && $0 == lb) { skip=1; next }
    $0 == e || (leg == 1 && $0 == le) { skip=0; next }
    !skip { print }
  ' "$TUNNEL_CONFIG" > "$TUNNEL_CONFIG.tmp" && mv "$TUNNEL_CONFIG.tmp" "$TUNNEL_CONFIG"
  reload
}

# Idempotent: `resume` re-installs it because a window that is open with no enforcer is exactly
# the failure this script exists to prevent.
install_timer() {
  mkdir -p "$HOME/Library/LaunchAgents"
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>$SELF</string><string>enforce-all</string>
  </array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
</dict></plist>
PLIST_EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null || true
}

remove_timer() {
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
}

timer_loaded() { launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; }
# `|| true` is load-bearing under `set -e`: a bare failing substitution in an assignment
# (`u=$(expiry)`) takes the whole script down, so absence must be an empty string, not an error.
expiry()       { cat "$EXPIRY_FILE" 2>/dev/null || true; }
expired()      { u=$(expiry); [ -n "$u" ] && [ "$(date +%s)" -ge "$u" ]; }

case "${1:-status}" in
up)
  days="${2:-7}"
  case "$days" in ''|*[!0-9]*) echo "guest-expose: DAYS must be a whole number" >&2; exit 2 ;; esac
  [ "$days" -ge 1 ] || { echo "guest-expose: DAYS must be at least 1" >&2; exit 2; }

  add_rule
  mkdir -p "$SLOT_DIR"; chmod 700 "$CONF_DIR" "$SLOT_DIR"
  date -v "+${days}d" +%s > "$EXPIRY_FILE"
  install_timer

  echo "guest-expose: UP  https://$GUEST_HOSTNAME  until $(date -r "$(cat "$EXPIRY_FILE")")"
  echo "guest-expose: the DNS record is separate and is what makes this resolve at all:"
  echo "    cloudflared tunnel route dns <tunnel> $GUEST_HOSTNAME"
  ;;

cut)
  # the panic button: door shut, clock still running. The timer stays loaded on purpose — `enforce`
  # is silent while the rule is absent, and it is what still closes the window if the door is
  # re-opened with `resume` and then forgotten.
  if del_rule; then
    echo "guest-expose: CUT — $GUEST_HOSTNAME falls through to the tunnel's 404"
  else
    echo "guest-expose: already cut"
  fi
  u=$(expiry)
  if [ -n "$u" ]; then
    echo "              deadline KEPT: $(date -r "$u") — 'resume' re-opens on it, 'up' sets a new one"
  else
    echo "              no deadline recorded — 'up [DAYS]' is the way back"
  fi
  ;;

resume)
  # re-open on the deadline that was already running. Refusing an expired window here is the whole
  # point: without it, `resume` would be a silent `up` and the bound would be advisory.
  u=$(expiry)
  [ -n "$u" ] || { echo "guest-expose: no window recorded — use 'up [DAYS]' to open a new one" >&2; exit 2; }
  expired && { echo "guest-expose: window expired $(date -r "$u") — use 'up [DAYS]' to open a new one" >&2; exit 1; }
  add_rule
  install_timer
  echo "guest-expose: UP  https://$GUEST_HOSTNAME  until $(date -r "$u")  (unchanged deadline)"
  ;;

down)
  if del_rule; then
    echo "guest-expose: DOWN — $GUEST_HOSTNAME now falls through to the tunnel's 404"
  else
    echo "guest-expose: already down"
  fi
  remove_timer
  rm -f "$EXPIRY_FILE"
  ;;

enforce)
  # the timer's entry point: silent unless it acts, so an hourly job leaves no noise behind
  exposed || exit 0
  [ -f "$EXPIRY_FILE" ] || { echo "guest-expose: exposed with no expiry recorded — taking it down"; "$SELF" down; exit 0; }
  now=$(date +%s); until_ts=$(cat "$EXPIRY_FILE")
  [ "$now" -lt "$until_ts" ] && exit 0
  echo "guest-expose: window expired $(date -r "$until_ts") — taking it down"
  "$SELF" down
  ;;

status)
  until_ts=$(expiry)
  if exposed; then
    if [ -n "$until_ts" ]; then
      left=$(( (until_ts - $(date +%s)) / 3600 ))
      echo "guest-expose: UP    https://$GUEST_HOSTNAME"
      echo "              until $(date -r "$until_ts")  (${left}h left)"
    else
      echo "guest-expose: UP    https://$GUEST_HOSTNAME  — NO EXPIRY RECORDED"
    fi
  elif [ -n "$until_ts" ]; then
    # cut, not down: the door is shut and the deadline is still the one that was running
    expired && when="expired $(date -r "$until_ts")" || when="until $(date -r "$until_ts")"
    echo "guest-expose: CUT   ($GUEST_HOSTNAME falls through to 404)"
    echo "              deadline kept, $when"
  else
    echo "guest-expose: DOWN  ($GUEST_HOSTNAME falls through to 404)"
  fi
  timer_loaded && echo "              timer: loaded (hourly)" || echo "              timer: not loaded"
  ;;

state)
  # the same facts as key=value, so guest-ctl.sh never has to parse the prose above. Shell-safe
  # by construction: every value is a number, 0/1, or the hostname.
  echo "exposed=$(exposed && echo 1 || echo 0)"
  echo "until=$(expiry)"
  echo "expired=$(expired && echo 1 || echo 0)"
  echo "timer=$(timer_loaded && echo 1 || echo 0)"
  echo "hostname=$GUEST_HOSTNAME"
  ;;

*) echo "usage: [GUEST_SLOT=n] $0 up [DAYS] | cut | resume | down | status | state | enforce | enforce-all | slots" >&2; exit 2 ;;
esac

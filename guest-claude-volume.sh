#!/bin/sh
# Put a guest's Claude config on a named volume, without losing what is already there.
#
# WHY. A guest keeps its Claude state at $CLAUDE_CONFIG_DIR (/home/fleet/.claude): the credential
# once somebody logs in, and every transcript under projects/. Today that path is on the
# container's WRITABLE OVERLAY — only /home/fleet/claude-fleet and /home/fleet/work are volumes.
# So it survives stop/start and reboots, and is DESTROYED by `docker rm`. Two consequences that
# are easy to meet by accident:
#
#   1. `guest-ctl.sh claude-token` recreates the container by design, so pressing "give claude
#      token" silently throws away the guest's conversation history.
#   2. Logging into the guest interactively — the sane way to give it a credential, because it
#      refreshes itself instead of expiring — would not survive that same recreate.
#
# This script moves that one path onto its own named volume and copies the existing contents in,
# after which both problems are gone.
#
# It is deliberately NOT a button and not wired into the panel: it removes and recreates a
# container, which is the owner's call to make deliberately, once, per guest.
#
#   sh guest-claude-volume.sh <slot>          # dry run: says exactly what it would do
#   sh guest-claude-volume.sh <slot> --apply  # do it
#
# Downtime is the length of one docker rm + run (seconds). The guest's sessions are lost — the
# same cost `stop` and `claude-token` already carry — while its Fleet state, work volume, token
# and deadline are untouched.
set -eu

SLOT="${1:?usage: sh guest-claude-volume.sh <slot> [--apply]}"
APPLY=0
[ "${2:-}" = "--apply" ] && APPLY=1
case "$SLOT" in ''|*[!0-9]*) echo "slot must be a whole number" >&2; exit 2 ;; esac

CONF_DIR="${GUEST_CONF_DIR:-$HOME/.claude-fleet-guest}"
# Same derivation as guest-ctl.sh's slot_conf: per-slot overrides live beside the guest, and the
# docker context is PINNED rather than ambient — this machine has more than one.
GUEST_VM=fleetguest; GUEST_CONTAINER=; GUEST_DOCKER_CONTEXT=
# shellcheck disable=SC1090
[ -f "$CONF_DIR/$SLOT/expose.env" ] && . "$CONF_DIR/$SLOT/expose.env" || true
VM="${GUEST_VM:-fleetguest}"
CTR="${GUEST_CONTAINER:-fleet-guest-$SLOT}"
CTX="${GUEST_DOCKER_CONTEXT:-colima-$VM}"
VOL="${GUEST_CLAUDE_VOLUME:-$CTR-claude}"

d() { docker --context "$CTX" "$@"; }

d inspect "$CTR" >/dev/null 2>&1 || { echo "no container $CTR on context $CTX" >&2; exit 2; }

# The config dir is the container's own answer, never assumed: an image that moves it would make a
# hardcoded path silently mount the wrong place and shadow the real one.
CFGDIR=$(d exec "$CTR" sh -lc 'printf %s "${CLAUDE_CONFIG_DIR:-$HOME/.claude}"' 2>/dev/null || true)
[ -n "$CFGDIR" ] || { echo "could not read CLAUDE_CONFIG_DIR from $CTR" >&2; exit 2; }

# Already on a volume? Then this has run, and running it again would be the operation that loses
# data rather than the one that saves it.
if d inspect "$CTR" --format '{{range .Mounts}}{{.Destination}}{{println}}{{end}}' | grep -qx "$CFGDIR"; then
  echo "$CTR: $CFGDIR is ALREADY on a volume — nothing to do"
  exit 0
fi

OWNER=$(d exec "$CTR" sh -lc "stat -c '%u:%g' '$CFGDIR'")
SIZE=$(d exec "$CTR" sh -lc "du -sh '$CFGDIR' 2>/dev/null | cut -f1")
JSONL=$(d exec "$CTR" sh -lc "find '$CFGDIR/projects' -name '*.jsonl' 2>/dev/null | wc -l" | tr -d ' ')

echo "container : $CTR   (context $CTX)"
echo "path      : $CFGDIR   owner $OWNER   size $SIZE   transcripts $JSONL"
echo "volume    : $VOL"
echo "backup    : $CONF_DIR/$SLOT/claude-backup-<stamp>.tar"
if [ "$APPLY" -eq 0 ]; then
  echo
  echo "DRY RUN — nothing changed. Re-run with --apply to:"
  echo "  1. tar $CFGDIR out of the container to the backup path above (host side, 0600)"
  echo "  2. create volume $VOL and seed it from that tar, preserving ownership"
  echo "  3. docker rm -f $CTR and re-run it from its OWN inspect config, plus -v $VOL:$CFGDIR"
  echo "  4. verify: the path is a volume, the transcript count matches, the guest answers"
  exit 0
fi

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$CONF_DIR/$SLOT/claude-backup-$STAMP.tar"
mkdir -p "$CONF_DIR/$SLOT"

# 1 — back up FIRST, and stop the container so nothing writes mid-copy. A backup taken from a live
# container is a backup of a moving target.
echo "==> stopping $CTR"
d stop "$CTR" >/dev/null
echo "==> backing up $CFGDIR -> $BACKUP"
# a stopped container cannot exec, so the tar is taken with `docker cp` from its filesystem
d cp "$CTR:$CFGDIR/." - > "$BACKUP"
chmod 600 "$BACKUP"
[ -s "$BACKUP" ] || { echo "backup is empty — refusing to continue; $CTR is stopped, 'start' brings it back" >&2; exit 1; }
echo "    $(wc -c < "$BACKUP" | tr -d ' ') bytes"

# 2 — the run configuration is read back out of the container itself rather than retyped, the same
# way guest-ctl.sh's claude-token does it: nothing about this guest drifts because a flag was
# remembered wrongly here.
IMAGE=$(d inspect "$CTR" --format '{{.Config.Image}}')
PORTS=$(d inspect "$CTR" --format '{{range $p, $b := .HostConfig.PortBindings}}{{range $b}}-p {{.HostIp}}:{{.HostPort}}:{{$p}} {{end}}{{end}}' | sed 's|/tcp||g')
MOUNTS=$(d inspect "$CTR" --format '{{range .Mounts}}-v {{.Name}}:{{.Destination}} {{end}}')
CAPS=$(d inspect "$CTR" --format '{{range .HostConfig.CapAdd}}--cap-add {{.}} {{end}}')
MEM=$(d inspect "$CTR" --format '{{.HostConfig.Memory}}')
RUNUSER=$(d inspect "$CTR" --format '{{.Config.User}}')
RESTART=$(d inspect "$CTR" --format '{{.HostConfig.RestartPolicy.Name}}')

ENVFILE=$(mktemp); chmod 600 "$ENVFILE"
trap 'rm -f "$ENVFILE"' EXIT INT TERM
# carry the guest's own runtime env forward, minus what the image sets itself (PATH/HOME/
# CLAUDE_CONFIG_DIR). CLAUDE_CODE_OAUTH_TOKEN is carried too when present, so a guest that already
# holds a credential does not quietly lose it here.
d inspect "$CTR" --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep -E '^(FLEET_|CLAUDE_CODE_OAUTH_TOKEN=)' > "$ENVFILE" || true

# 3 — seed the volume BEFORE removing the container, so a failure here costs nothing
echo "==> creating and seeding volume $VOL"
d volume create "$VOL" >/dev/null
d run --rm -i -v "$VOL:/seed" --user root "$IMAGE" \
  sh -c "tar -xf - -C /seed && chown -R $OWNER /seed" < "$BACKUP"
SEEDED=$(d run --rm -v "$VOL:/seed" --user root "$IMAGE" sh -c "find /seed/projects -name '*.jsonl' 2>/dev/null | wc -l" | tr -d ' \r')
echo "    transcripts in the volume: $SEEDED (was $JSONL)"
[ "$SEEDED" = "$JSONL" ] || { echo "seed mismatch — NOT touching the container; volume $VOL left for inspection, '$CTR' is stopped and 'start' brings it back" >&2; exit 1; }

# 4 — only now is the destructive step taken
echo "==> recreating $CTR with $CFGDIR on $VOL"
d rm -f "$CTR" >/dev/null
# shellcheck disable=SC2086
d run -d --name "$CTR" --restart "$RESTART" --memory "$MEM" --user "$RUNUSER" \
  $CAPS $PORTS $MOUNTS -v "$VOL:$CFGDIR" --env-file "$ENVFILE" "$IMAGE" >/dev/null
rm -f "$ENVFILE"

# 5 — verify against the container, not against this script's own hopes
sleep 2
ON_VOL=$(d inspect "$CTR" --format '{{range .Mounts}}{{.Destination}}{{println}}{{end}}' | grep -cx "$CFGDIR" || true)
AFTER=$(d exec "$CTR" sh -lc "find '$CFGDIR/projects' -name '*.jsonl' 2>/dev/null | wc -l" | tr -d ' ')
echo
echo "$CFGDIR on a named volume : $([ "$ON_VOL" = 1 ] && echo yes || echo NO)"
echo "transcripts after         : $AFTER (was $JSONL)"
echo "backup kept at            : $BACKUP"
[ "$ON_VOL" = 1 ] && [ "$AFTER" = "$JSONL" ] \
  && echo "OK — a login and the transcripts now survive a recreate" \
  || { echo "VERIFY FAILED — the backup above is a complete copy of the old $CFGDIR" >&2; exit 1; }

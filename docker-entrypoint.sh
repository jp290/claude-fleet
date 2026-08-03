#!/bin/sh
# Applies the egress firewall when asked, then runs the real command as the unprivileged user.
#
# Two facts force this shape. The firewall needs root (NET_ADMIN); the server must NOT be root,
# because the CLI refuses --dangerously-skip-permissions when launched as one and that flag is
# Fleet's whole unattended mode. So the container starts as root, spends that privilege on one
# iptables pass, and drops it before anything else runs.
#
# setpriv rather than su: it execs the argv directly, with no shell in between, so nothing here
# has to re-quote a command line. `claude-opus-5[1m]` reaching a shell unquoted is a known way to
# kill every pane in this project (zsh aborts on an unmatched glob) — not this code path, but the
# same class, and the cheap defence is to have no extra shell at all.
#
# Started WITHOUT root (the image's default USER), this is a transparent passthrough: the e2e
# suites run exactly as they did before, which is why adding it did not require re-proving them.
set -eu

if [ "$(id -u)" = "0" ]; then
  if [ "${FLEET_FIREWALL:-0}" = "1" ]; then
    /usr/local/bin/guest-firewall.sh
  else
    echo "docker-entrypoint: running as root WITHOUT FLEET_FIREWALL=1 — no egress rules applied" >&2
  fi
  uid=$(getent passwd fleet | cut -d: -f3)
  gid=$(getent passwd fleet | cut -d: -f4)
  exec setpriv --reuid="$uid" --regid="$gid" --init-groups -- "$@"
fi

exec "$@"

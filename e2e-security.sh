#!/bin/sh
# Security e2e — see fleet-e2e-security.ts for what it asserts and why it needs its own
# instance (it drives a share into an hour-long brute-force lockout and runs the dispatcher).
# Throwaway copy of the repo on its own tmux socket + port: the live fleet is never touched.
#   ./e2e-security.sh
set -u
# Same hermetic reason as e2e-isolated.sh: launched from inside a lane, this script's env
# carries the pane's scoped credentials, and tmux bakes its server env into every pane it
# spawns. Strip them so the server's OWN issuing logic is the only source of a self token.
unset FLEET_SELF_TOKEN FLEET_SELF_SLOT FLEET_STEWARD_TOKEN
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR from $$ so concurrent runs never share a socket/port. The port base comes from
# the PORT BAND TABLE in e2e-isolated.sh — never pick one here. It moved off 15200 because
# 15200-17199 overlapped e2e-postland-audit's 15000-16999 by 1800 ports: distinct sockets keep
# tmux apart, but both suites bind 127.0.0.1:PORT, and both run in the same gate. 21400, not the
# next free 19400, because that one contains cloudflared's metrics pair (20241/20242).
DIR="${TMPDIR:-/tmp}/fleet-e2e-security-instance-$$"
SOCK="fleetsectest$$"
PORT=$((21400 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
# src/ comes along for the static client-invariant checks (§7) — they must read the REAL
# sources, and the harness resolves everything relative to its own directory.
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/enhance-prompt.ts" "$SRC/lane-signals.ts" \
  "$SRC/continuity.ts" "$SRC/fleet-e2e-security.ts" "$SRC/src" "$SRC/public" "$SRC/package.json" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

# two throwaway repos: one the lane/branch checks fork from, one the dispatcher spawns from
# (kept separate so a dispatched lane can never collide with a hand-made one)
for r in testrepo dispatchrepo; do
  mkdir -p "$DIR/$r"
  ( cd "$DIR/$r" && git init -q -b main && git config user.email t@t && git config user.name t \
    && git config commit.gpgsign false \
    && printf 'root\n' > code.txt && git add code.txt && git commit -qm init )
done

# Reap servers a SIGKILLed earlier run left behind — the one abort path the EXIT trap cannot
# cover, keyed on owner-PID liveness so a concurrent run is never touched. Full rationale (and
# the measurements for the signals the trap DOES handle) at the same block in e2e-isolated.sh.
TMUX_SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
for _s in "$TMUX_SOCKDIR"/fleetsectest*; do
  [ -S "$_s" ] || continue
  _own="${_s##*/fleetsectest}"
  case "$_own" in ''|*[!0-9]*) continue ;; esac
  [ "$_own" = "$$" ] && continue
  kill -0 "$_own" 2>/dev/null && continue
  tmux -L "fleetsectest$_own" kill-server 2>/dev/null
done

trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

TOKEN=e2e-security-token
INTAKE=e2e-security-intake
SHAREHOST=sharetest
# FLEET_CMD=true → panes are a bare login shell (claudeAlive short-circuits true, so the
# dispatcher's delivery gate opens without a real agent). FLEET_AUTO_REVIEW_MS=0 → no
# FLEET_REVIEW_CMD stand-in is configured here, and auto-③ would otherwise spawn a REAL
# claude session against a done-looking lane. FLEET_DISPATCH_MAX_LANES is raised so the
# §5 dispatch control isn't starved by the lanes §3/§4 leave behind.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_TOKEN=$TOKEN \
   FLEET_CMD=true FLEET_AUTO_REVIEW_MS=0 FLEET_INTAKE_SECRET=$INTAKE \
   FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST \
   FLEET_DISPATCH_REPO='$DIR/dispatchrepo' FLEET_DISPATCH_MAX_LANES=8 \
   exec bun server.ts >> server.log 2>&1"
sleep 2

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_TOKEN=$TOKEN FLEET_INTAKE_SECRET=$INTAKE \
  FLEET_SHARE_HOSTS=$SHAREHOST FLEET_E2E_REPO="$DIR/testrepo" FLEET_DISPATCH_REPO="$DIR/dispatchrepo" \
  bun fleet-e2e-security.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

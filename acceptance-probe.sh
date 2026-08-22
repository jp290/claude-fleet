#!/bin/sh
# ACP-25 REAL-TUI ACCEPTANCE PROBE — not a gate. It boots an isolated Fleet instance on its own
# socket/port with the REAL `claude` and `codex` binaries on this machine, spends a few tiny model
# turns ("reply OK"), and proves the one thing no stand-in can: that sendText's acceptance read
# returns "observed" exactly when the TUI took the turn, and refuses/uncertains otherwise.
# Run by hand, serially (it sources e2e-stage.sh, so it queues on the suite mutex like a suite):
#   ./acceptance-probe.sh            # tail: ALL PASS / N FAILURES; instance kept on failure
# Never on the live socket: SOCK/PORT derive from $$ like every wrapper here. The agents run in
# THIS checkout (already trusted by claude — a fresh scratch dir shows its trust screen instead
# of a composer, measured); they are told not to read anything and asked for the word OK.
set -u
unset FLEET_SELF_TOKEN FLEET_SELF_SLOT FLEET_STEWARD_TOKEN
SRC="$(cd "$(dirname "$0")" && pwd)"
DIR="${TMPDIR:-/tmp}/fleet-acceptance-probe-$$"
SOCK="fleetacptest$$"
PORT=$((23400 + $$ % 2000))
rm -rf "$DIR"
mkdir -p "$DIR"
. "$SRC/e2e-stage.sh"
STAGE_EXTRA=src
stage_instance "$SRC" "$DIR" server.ts acceptance-probe.ts || exit 1

trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

TOKEN=acceptance-probe-token
# the real binaries: PATH as the live watchdog bakes it (launchd has none of these)
export PATH="$HOME/.local/bin:$HOME/.bun/bin:/opt/homebrew/bin:$PATH"
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_TOKEN=$TOKEN \
   FLEET_CMD=claude FLEET_AUTO_REVIEW_MS=0 FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 \
   FLEET_HARNESS_AUTOMATION=0 \
   exec bun server.ts >> server.log 2>&1"
code=000
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" != "000" ] && break
  sleep 0.5
done
if [ "$code" = "000" ]; then
  stage_server_start_failed "acceptance-probe.sh" "acceptance probe" "$DIR"
  exit 3
fi
cd "$DIR" || exit 1
FLEET_E2E_SUITE=acceptance-probe FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_TOKEN=$TOKEN \
  PROBE_CWD="$SRC" bun acceptance-probe.ts
code=$?
tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept probe instance for inspection: $DIR"; fi
exit $code

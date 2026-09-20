#!/bin/sh
# A STANDING test instance of this checkout, for looking at the left bar with a browser.
#
# WHY THIS IS NOT instanz-shot.sh. That script stages through `. ./e2e-stage.sh`, and sourcing
# e2e-stage.sh TAKES THE SUITE MUTEX at the top level. A throwaway shot holds it for a minute; a
# standing instance would hold it for as long as the owner keeps the tab open, and every land gate
# and post-land audit of this machine would queue behind a browser window. So this script stages
# with rsync and never touches e2e-stage.sh. `./testinstanz.sh status` prints `./ctl.sh lock` for
# exactly that reason: the proof belongs next to the claim.
#
# WHAT IT IS NOT ALLOWED TO BE: the live fleet. Own port, own tmux socket, own directory (the state
# file is derived from the server's own directory — `STATE_FILE = import.meta.dir/fleet.json` — so a
# copy is what gives it its own state), and FLEET_CMD=true so no agent is ever spawned. The three
# live values are refused by name below rather than merely avoided.
#
#   ./testinstanz.sh up [mixed|full]        stage, start, plant the fixtures, print the URL
#   ./testinstanz.sh fixtures [mixed|full]  replant against the running instance, no restart
#   ./testinstanz.sh states                 what the bar paints right now, per state
#   ./testinstanz.sh status                 is it up, where, and who holds the suite mutex
#   ./testinstanz.sh down                   stop the server, kill ITS tmux by socket, remove the dir
set -e

PORT="${FLEET_TI_PORT:-8862}"
SOCK="${FLEET_TI_SOCK:-fleetti733b}"
DIR="${FLEET_TI_DIR:-/tmp/fleet-testinstanz-733b}"
SRC=$(cd "$(dirname "$0")" && pwd -P)

# The three live values, refused by NAME. Avoiding them by choosing other defaults is not the same
# thing: an env override is exactly how someone would hand this script the live fleet by accident.
[ "$PORT" = "8790" ] && { echo "refused: 8790 is the live port" >&2; exit 2; }
[ "$SOCK" = "claudefleet" ] && { echo "refused: claudefleet is the live tmux socket" >&2; exit 2; }
case "$DIR" in "$SRC"|"$SRC"/*) echo "refused: the instance may not live inside the checkout" >&2; exit 2;; esac

PIDF="$DIR/.testinstanz.pid"
TOKF="$DIR/.testinstanz.token"

# The address the owner opens. Derived at RUN time, never written into this file: a tracked file
# that names this machine's address fails `leak-pin: tracked files contain no configured deploy
# identity` — which is how the last one was caught.
ti_addr() {
  for t in /usr/local/bin/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale tailscale; do
    a=$("$t" ip -4 2>/dev/null | head -1) && [ -n "$a" ] && { echo "$a"; return; }
  done
  echo 127.0.0.1
}

ti_alive() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

# The fixtures are replanted against the RUNNING instance, so switching between the two stands
# (free places in the axis / all sixteen taken) costs no restart.
ti_plant() {
  FLEET_TI_BASE="http://$(ti_addr):$PORT" FLEET_TI_TOKEN="$(cat "$TOKF")" FLEET_TI_SRC="$SRC" \
    FLEET_TI_DIR="$DIR" FLEET_TI_SOCK="$SOCK" bun "$SRC/testinstanz-fixtures.js" "$1"
}

case "${1:-}" in
up)
  ti_alive && { echo "already up — ./testinstanz.sh status"; exit 0; }
  rm -rf "$DIR"; mkdir -p "$DIR"
  # rsync, not e2e-stage.sh: see the header. `--exclude fleet.json*` is belt and braces — this
  # checkout has none — because copying a state file is how a test instance adopts real sessions.
  rsync -a --exclude .git --exclude node_modules --exclude 'fleet.json*' "$SRC/" "$DIR/"
  ln -s "$SRC/node_modules" "$DIR/node_modules"
  TOK=$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')
  printf '%s' "$TOK" > "$TOKF"; chmod 600 "$TOKF"
  ADDR=$(ti_addr)
  # `exec` matters: without it the recorded pid is the SUBSHELL's, the subshell exits, and `down`
  # then kills a pid that is already gone while the server keeps the port. Measured here on
  # 2026-09-20 — the next `up` died with EADDRINUSE and the old instance was still serving.
  ( cd "$DIR" && exec env FLEET_HOST="$ADDR" FLEET_PORT="$PORT" FLEET_SOCK="$SOCK" FLEET_CMD=true \
      FLEET_TOKEN="$TOK" bun server.ts > "$DIR/server.log" 2>&1 ) &
  echo $! > "$PIDF"
  i=0
  until curl -sf "http://$ADDR:$PORT/api/sessions" -H "authorization: Bearer $TOK" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt 60 ] && { echo "server never came up:" >&2; tail -20 "$DIR/server.log" >&2; exit 1; }
    sleep 0.5
  done
  ti_plant "${2:-mixed}"
  echo
  echo "TESTINSTANZ UP   http://$ADDR:$PORT/?token=$TOK"
  echo "  log $DIR/server.log · socket $SOCK · port $PORT · FLEET_CMD=true (no agent is ever spawned)"
  echo "  down: $SRC/testinstanz.sh down"
  ;;
fixtures)
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_plant "${2:-mixed}"
  ;;
states)
  # Plants nothing. `asleep` is the state no fixture can produce (see testinstanz-fixtures.js);
  # this is how it is watched for on a standing instance without opening the tab.
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_plant states
  ;;
status)
  if ti_alive; then echo "up   pid $(cat "$PIDF")   http://$(ti_addr):$PORT/?token=$(cat "$TOKF")"
  else echo "down (no live pid in $PIDF)"; fi
  echo "tmux sessions on socket $SOCK: $(tmux -L "$SOCK" list-sessions 2>/dev/null | wc -l | tr -d ' ')"
  echo "--- ./ctl.sh lock (this instance must NEVER appear as the holder)"
  ( cd "$SRC" && ./ctl.sh lock )
  ;;
down)
  ti_alive && kill "$(cat "$PIDF")" 2>/dev/null || true
  # By SOCKET NAME, never a name pattern: `pkill -f` on this machine reaches the live server and
  # the post-land audit (AGENTS.md §Verify).
  tmux -L "$SOCK" kill-server 2>/dev/null || true
  rm -rf "$DIR"
  # The claim is checked, not asserted: a still-bound port means something is serving that this
  # script did not stop, and the honest answer is to NAME it rather than reach for a pattern kill.
  sleep 1
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "down: dir and tmux gone, but port $PORT is STILL BOUND:" >&2
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
    exit 1
  fi
  echo "down: server stopped, port $PORT free, tmux -L $SOCK killed, $DIR removed"
  ;;
*)
  echo "usage: ./testinstanz.sh up [mixed|full] | fixtures [mixed|full] | states | status | down" >&2; exit 2;;
esac

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
#   ./testinstanz.sh up [mixed|full]        stage, start, plant EVERYTHING (fixtures, succession, ctx,
#                                           codex states, painters), print the URL — the whole demo
#   ./testinstanz.sh fixtures [mixed|full]  replant against the running instance, no restart
#   ./testinstanz.sh succession             plant the succession facts (stops+starts the server)
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

# Start the server against the staged directory and wait until it answers. Used by `up` and by
# `succession`, which stops it to edit the state file underneath and starts it again — the tmux
# sessions stand through that, so the panes come back with the instance.
# HOME is the instance's own: the context fill is read from $HOME/.claude/projects/<cwd>/<id>.jsonl
# (server.ts#projDir), and the demo plants those transcripts. With the real HOME they would have to
# go into the owner's ~/.claude — outside this checkout, which a lane does not touch.
#
# AND THE HARNESS BINARIES ARE STAND-INS. FLEET_CMD=true only replaces the CLAUDE command; a slot
# opened with harness codex or pi still starts the REAL `codex` / `pi` from PATH (measured
# 2026-09-21: slot 5 ran `node ~/.local/bin/codex`, slot 4 a live `pi`). Under the owner's HOME
# those are logged in, and anything typed into their panes is a prompt to a real model. So the
# instance puts $DIR/bin first on PATH (server.ts#PATH_EXPORT hands the server's PATH to every pane),
# where `codex` and `pi` exec an idle bun under a SYMLINK named codex-agent / pi-agent: the pane
# has a process whose name the liveness probe accepts (comms `codex` / `pi`, a prefix match on the
# basename, server.ts#paneAgentAt), and nothing behind it can reach a network or a model. A symlink,
# not a copy: a copied /bin/sleep is killed by macOS on launch (measured, exit 137), a symlink's
# name is what `ps -o comm=` reports.
ti_shims() {
  mkdir -p "$DIR/bin"
  for h in codex pi; do
    ln -sf "$(command -v bun)" "$DIR/bin/$h-agent"
    printf '#!/bin/sh\n# test-instance stand-in for the %s CLI (testinstanz.sh#ti_shims)\nexec "$(dirname "$0")/%s-agent" -e "setInterval(() => {}, 1 << 30)"\n' "$h" "$h" > "$DIR/bin/$h"
    chmod +x "$DIR/bin/$h"
  done
}
ti_serve() {
  # the harness start lines write their trust entries under $HOME (codex: $HOME/.codex/config.toml)
  # and die on a missing directory — before they ever reach the stand-in
  mkdir -p "$DIR/home/.codex" "$DIR/home/.pi"
  ti_shims
  ( cd "$DIR" && exec env HOME="$DIR/home" PATH="$DIR/bin:$PATH" FLEET_HOST="$(ti_addr)" FLEET_PORT="$PORT" FLEET_SOCK="$SOCK" FLEET_CMD=true \
      FLEET_LANE_SUCCEED_MAX=5 FLEET_TOKEN="$(cat "$TOKF")" bun server.ts >> "$DIR/server.log" 2>&1 ) &
  echo $! > "$PIDF"
  i=0
  until curl -sf "http://$(ti_addr):$PORT/api/sessions" -H "authorization: Bearer $(cat "$TOKF")" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt 60 ] && { echo "server never came up:" >&2; tail -20 "$DIR/server.log" >&2; return 1; }
    sleep 0.5
  done
}

# Plant what no HTTP route can set (succession, ctx transcripts, codex states — see
# testinstanz-fixtures.js). The server is stopped for the edit because it would otherwise write its
# in-memory state back over it; the tmux sessions are left alone, so the panes are still there.
ti_patch() {
  kill "$(cat "$PIDF")" 2>/dev/null || true
  i=0; while kill -0 "$(cat "$PIDF")" 2>/dev/null && [ "$i" -lt 40 ]; do i=$((i+1)); sleep 0.25; done
  ti_plant succession-patch
  ti_serve || return 1
  sleep 3
}

# THE PAINTERS keep the four states standing for as long as the instance stands. A state is read
# from the pane's last OUTPUT (src/client.ts#slotState): < 5 s working, < 30 min resting, beyond that
# asleep. Without painters every row would fall asleep half an hour after `up`, and "working" would
# last five seconds. So: lane 10 prints every 2 s (a working row that is not the one on screen), the
# plain shell rows print every 10 min (resting for as long as the instance stands), slot 6 has no
# process behind its pane at all (broken), and the HARNESS rows 4, 5 and 8 are never typed into —
# a harness pane is an agent's input, and keys sent there are prompts. They fall asleep 30 min
# after `up`, which is also how the demo gets its asleep row (slot 4): the one state that cannot be
# hurried without touching the product. Typed on this instance's OWN socket, by session name —
# never a pattern, never a socket this script did not create.
ti_paint() {
  tmux -L "$SOCK" send-keys -t s10 'clear; while :; do printf .; sleep 2; done' Enter 2>/dev/null || true
  # slot 1 is the pane the demo opens on and counts as working because it is SHOWN — it needs no
  # painter, it needs a clean screen (the server types its orchestrator hand-off into this shell)
  tmux -L "$SOCK" send-keys -t s1 C-c 2>/dev/null || true
  tmux -L "$SOCK" send-keys -t s1 'clear' Enter 2>/dev/null || true
  for n in 2 3 7 9 11 12; do
    tmux -L "$SOCK" send-keys -t "s$n" 'clear; while :; do sleep 600; printf .; done' Enter 2>/dev/null || true
  done
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
  ti_serve || exit 1
  ti_plant "${2:-mixed}"
  # ONE COMMAND, THE WHOLE DEMO. Succession used to be a second, separate step (`succession`) — an
  # instance brought up with `up` alone showed no succession anywhere, on any #band.
  ti_patch || exit 1
  ti_paint
  ti_plant states
  echo
  echo "TESTINSTANZ UP   http://$ADDR:$PORT/?token=$TOK"
  echo "  log $DIR/server.log · socket $SOCK · port $PORT · FLEET_CMD=true (no agent is ever spawned)"
  echo "  down: $SRC/testinstanz.sh down"
  ;;
fixtures)
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_plant "${2:-mixed}"
  ;;
succession)
  # Plants the succession facts, which no HTTP route can set (see testinstanz-fixtures.js). The
  # server is stopped for the edit because it would otherwise write its in-memory state back over
  # it; the tmux sessions are left alone, so the panes are still there when it comes back.
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_patch || exit 1
  ti_paint
  ti_plant states
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
  # The dying panes' zsh still writes $DIR/home/.zsh_history after kill-server returns; a single
  # rm raced it ("Directory not empty", 2026-09-21). One retry after the shells are gone.
  rm -rf "$DIR" 2>/dev/null || { sleep 1; rm -rf "$DIR"; }
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
  echo "usage: ./testinstanz.sh up|fixtures [mixed|full] | succession | states | status | down" >&2; exit 2;;
esac

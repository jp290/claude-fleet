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
#   ./testinstanz.sh up [mixed|full] [--ttl <min>]   stage, build, start, plant EVERYTHING (fixtures,
#                                           succession, ctx, codex states, painters), print the URL
#                                           — the whole demo; FLEET_TI_TOKEN=<old> keeps the link the
#                                           owner holds; default ttl 240 min
#   ./testinstanz.sh fixtures [mixed|full]  replant against the running instance, no restart
#   ./testinstanz.sh succession             plant the succession facts (stops+starts the server)
#   ./testinstanz.sh states                 what the bar paints right now, per state
#   ./testinstanz.sh status                 is it up, where, rest of its ttl, and who holds the mutex
#   ./testinstanz.sh list                   every test instance of this machine, from state files
#   ./testinstanz.sh down                   stop the server, kill ITS tmux by socket, remove the dir
#
# ONE INSTANCE PER WORKTREE. Port, tmux socket and directory derive from the ABSOLUTE worktree
# path (short hash), so two worktrees run two instances SIDE BY SIDE — the old fixed triple
# 8862/fleetti733b made every copy answer `up` with "already up" from a foreign lane (measured
# 2026-09-24, ~10 stale instances on this machine). The chosen values live in the instance's
# state file; scratch-reap.sh reaps an expired one by the PID that file noted.
set -e

# THE DERIVATION — one instance per worktree. Port, tmux socket and directory come from the
# ABSOLUTE worktree path (cksum: POSIX, same answer on mac and second-host), so a lane derives its
# own triple and never fights a neighbour. A NEW `up` starts at hash mod 100 inside 8900-8999 and
# takes the next free port; every command for an existing instance reads the chosen port from its
# state file. An explicit FLEET_TI_* override selects a new instance's values (the measured
# workflows in docs/messungen rely on it) and binds or fails honestly.
TI_ROOT="${FLEET_TI_ROOT:-/tmp}"
SRC=$(cd "$(dirname "$0")" && pwd -P)
HASH=$(printf '%s' "$SRC" | cksum | awk '{print $1}')
PORT="${FLEET_TI_PORT:-$((8900 + HASH % 100))}"
SOCK="${FLEET_TI_SOCK:-fleetti$HASH}"
DIR="${FLEET_TI_DIR:-$TI_ROOT/fleet-testinstanz-$HASH}"
STATE="$DIR/testinstanz.state"
PIDF="$DIR/.testinstanz.pid"
TOKF="$DIR/.testinstanz.token"
ti_alive() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }

if [ "${1:-}" = up ] && ! ti_alive; then
  if [ -z "${FLEET_TI_PORT:-}" ]; then
    TI_P=$PORT; TI_I=0
    while lsof -nP -iTCP:"$TI_P" -sTCP:LISTEN >/dev/null 2>&1; do
      TI_P=$((TI_P + 1))
      if [ "$TI_P" -gt 8999 ]; then TI_P=8900; fi
      TI_I=$((TI_I + 1))
      if [ "$TI_I" -ge 100 ]; then echo "refused: no free port in 8900-8999" >&2; exit 2; fi
    done
    PORT=$TI_P
  fi
elif [ -f "$STATE" ]; then
  PORT=$(sed -n 's/^port=//p' "$STATE" | head -1)
  case "$PORT" in ''|*[!0-9]*) echo "refused: invalid port in $STATE" >&2; exit 2;; esac
fi

# The three live values, refused by NAME. Avoiding them by choosing other defaults is not the same
# thing: an env override is exactly how someone would hand this script the live fleet by accident.
[ "$PORT" = "8790" ] && { echo "refused: 8790 is the live port" >&2; exit 2; }
[ "$SOCK" = "claudefleet" ] && { echo "refused: claudefleet is the live tmux socket" >&2; exit 2; }
case "$DIR" in "$SRC"|"$SRC"/*) echo "refused: the instance may not live inside the checkout" >&2; exit 2;; esac

# The address the owner opens. Derived at RUN time, never written into this file: a tracked file
# that names this machine's address fails `leak-pin: tracked files contain no configured deploy
# identity` — which is how the last one was caught.
ti_addr() {
  for t in /usr/local/bin/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale tailscale; do
    a=$("$t" ip -4 2>/dev/null | head -1) && [ -n "$a" ] && { echo "$a"; return; }
  done
  echo 127.0.0.1
}

# The second-host's address is private deployment configuration and this repo is public, so it is
# never written here: it comes from FLEET_TI_SECOND-HOST_URL, else from the `second-host` entry of
# FLEET_INSTANCES in this checkout's gitignored .env (the same line the live instances boot with),
# else a CGNAT placeholder — the link only navigates when clicked, so a placeholder costs nothing.
ti_second-host_url() {
  if [ -n "${FLEET_TI_SECOND-HOST_URL:-}" ]; then echo "$FLEET_TI_SECOND-HOST_URL"; return; fi
  u=""
  [ -f "$SRC/.env" ] && u=$(sed -n 's/^FLEET_INSTANCES=.*"name" *: *"second-host" *, *"url" *: *"\([^"]*\)".*/\1/p' "$SRC/.env" | tail -1)
  echo "${u:-http://100.64.0.1:8790}"
}

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
  # THE ENV PROOF, WRITTEN BEFORE THE START: the NAMES — never values — of every FLEET_* variable
  # the instance server will receive. The launch below is an `env -i` whitelist, so the calling
  # environment cannot leak in: no FLEET_HUB_REMOTE, no FLEET_HELPER_*, no FLEET_SHARE_*, and no
  # live token the lane happens to carry. The refusal underneath is belt and braces — with the
  # whitelist it cannot fire — but the invariant is CHECKED, not assumed.
  : > "$DIR/env-names"
  for TI_V in LANG FLEET_HOST FLEET_PORT FLEET_SOCK FLEET_CMD FLEET_INSTANCE FLEET_INSTANCES \
              FLEET_LANE_SUCCEED_MAX FLEET_TOKEN; do
    echo "$TI_V" >> "$DIR/env-names"
  done
  if grep -Eq '^(FLEET_HUB_REMOTE|FLEET_HELPER_|FLEET_SHARE_)' "$DIR/env-names"; then
    echo "refused: a live-coupling FLEET_* name reached the instance env" >&2; exit 2
  fi
  # TWO COMPUTERS, as the live fleet has them (mac + second-host), so the device display has something
  # to show; "mac" is THIS instance's own origin, so the board marks it as here. The second-host link
  # only navigates when clicked. FLEET_TI_INSTANCES= (set, empty) gives the single-host board.
  TI_TWO='[{"name":"mac","url":"http://'"$(ti_addr):$PORT"'"},{"name":"second-host","url":"'"$(ti_second-host_url)"'"}]'
  TI_INST="${FLEET_TI_INSTANCES-$TI_TWO}"
  TI_NAME="${FLEET_TI_INSTANCE-mac}"
  [ -z "$TI_INST" ] && TI_NAME="${FLEET_TI_INSTANCE-}"
  # env -i, the card's "the server gets only the values the script itself sets": BY CONSTRUCTION,
  # not by filtering — the child env is exactly the names written to env-names above.
  ( cd "$DIR" && exec env -i HOME="$DIR/home" PATH="$DIR/bin:$PATH" TMPDIR="${TMPDIR:-/tmp}" \
      LANG=en_US.UTF-8 \
      FLEET_HOST="$(ti_addr)" FLEET_PORT="$PORT" FLEET_SOCK="$SOCK" FLEET_CMD=true \
      FLEET_INSTANCE="$TI_NAME" FLEET_INSTANCES="$TI_INST" FLEET_LANE_SUCCEED_MAX=5 \
      FLEET_TOKEN="$(cat "$TOKF")" bun server.ts >> "$DIR/server.log" 2>&1 ) &
  echo $! > "$PIDF"
  i=0
  until curl -sf "http://$(ti_addr):$PORT/api/sessions" -H "authorization: Bearer $(cat "$TOKF")" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt 60 ] && { echo "server never came up:" >&2; tail -20 "$DIR/server.log" >&2; return 1; }
    sleep 0.5
  done
  # The state file's pid is the SERVING pid — `succession` relaunches and moves it, so refresh
  # whenever a state file is already there (`up` writes the rest of it before calling us).
  if [ -f "$STATE" ]; then
    sed "s/^pid=.*/pid=$(cat "$PIDF")/" "$STATE" > "$STATE.new" && mv "$STATE.new" "$STATE"
  fi
  return 0
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
  TI_KIND=mixed; TI_TTL=240
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --ttl) [ $# -ge 2 ] || { echo "up: --ttl needs a number of minutes" >&2; exit 2; }
             TI_TTL=$2; shift 2 ;;
      --ttl=*) TI_TTL="${1#--ttl=}"; shift ;;
      mixed|full) TI_KIND=$1; shift ;;
      *) echo "usage: ./testinstanz.sh up [mixed|full] [--ttl <minutes>]" >&2; exit 2 ;;
    esac
  done
  case "$TI_TTL" in ''|*[!0-9]*) echo "up: --ttl wants whole minutes" >&2; exit 2 ;; esac
  [ "$TI_TTL" -ge 1 ] || { echo "up: --ttl wants at least 1 minute" >&2; exit 2; }
  ti_alive && { echo "already up — ./testinstanz.sh status"; exit 0; }
  rm -rf "$DIR"; mkdir -p "$DIR"
  # rsync, not e2e-stage.sh: see the header. The EXCLUDES are the no-live-values fence:
  # `fleet.json*` because copying a state file is how a test instance adopts real sessions;
  # `.env` because it is this checkout's private configuration (second-host URL, sync token);
  # `*.jsonl` because transcripts and trails are nobody's demo data. None of them may exist
  # in the copy, so the fixtures plant their OWN under the instance's HOME afterwards.
  rsync -a --exclude .git --exclude node_modules --exclude .env --exclude 'fleet.json*' --exclude '*.jsonl' "$SRC/" "$DIR/"
  ln -s "$SRC/node_modules" "$DIR/node_modules"
  # BUILD IN THE COPY, BEFORE THE SERVER. A red build starts nothing and exits 1 — an instance
  # serving yesterday's client bundle while claiming to show today's change is worse than none.
  ( cd "$DIR" && bun run build ) || { echo "up: build failed — nothing started" >&2; exit 1; }
  # FLEET_TI_TOKEN keeps the owner's link across a down/up (a rebuild after a client change);
  # without it every `up` mints a fresh one and the link he holds stops opening.
  TOK="${FLEET_TI_TOKEN:-$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
  printf '%s' "$TOK" > "$TOKF"; chmod 600 "$TOKF"
  # THE STATE FILE is the machine-wide index: `list` reads it, scratch-reap.sh reaps by it, and
  # it records the values ACTUALLY chosen (the port bump may have moved off the hash port). No
  # token in it — the token stays in $TOKF, and `list` prints the URL WITHOUT it.
  TI_NOW=$(date +%s)
  {
    echo "src=$SRC"
    echo "port=$PORT"
    echo "sock=$SOCK"
    echo "dir=$DIR"
    echo "pid=0"
    echo "started=$TI_NOW"
    echo "ttlMin=$TI_TTL"
    echo "expiresAt=$((TI_NOW + TI_TTL * 60))"
  } > "$STATE"
  ADDR=$(ti_addr)
  ti_serve || exit 1
  ti_plant "$TI_KIND"
  # ONE COMMAND, THE WHOLE DEMO. Succession used to be a second, separate step (`succession`) — an
  # instance brought up with `up` alone showed no succession anywhere, on any #band.
  ti_patch || exit 1
  ti_paint
  ti_plant states
  echo
  echo "TESTINSTANZ UP   http://$ADDR:$PORT/?token=$TOK"
  echo "  log $DIR/server.log · socket $SOCK · port $PORT · ttl ${TI_TTL}min · FLEET_CMD=true (no agent is ever spawned)"
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
  if [ -f "$STATE" ]; then
    TI_EXP=$(sed -n 's/^expiresAt=//p' "$STATE" | head -1)
    case "$TI_EXP" in
      ''|*[!0-9]*) : ;;
      *) TI_NOW=$(date +%s)
         if [ "$TI_NOW" -lt "$TI_EXP" ]; then
           echo "ttl: $(( (TI_EXP - TI_NOW + 59) / 60 )) min left (expiresAt=$TI_EXP)"
         else
           echo "ttl: EXPIRED $(( (TI_NOW - TI_EXP) / 60 )) min ago — scratch-reap.sh removes it on its next run"
         fi ;;
    esac
  fi
  echo "--- ./ctl.sh lock (this instance must NEVER appear as the holder)"
  ( cd "$SRC" && ./ctl.sh lock )
  ;;
list)
  # EVERY test instance of this machine, read ONLY from state files — never from ps (command
  # lines carry tokens) and never from sockets. The URL is printed WITHOUT its token; the worktree
  # shows whose instance this is. One without expiresAt is old: listed, never touched.
  TI_ADDR=$(ti_addr)
  TI_ANY=0
  for TI_S in "$TI_ROOT"/fleet-testinstanz-*/testinstanz.state; do
    [ -f "$TI_S" ] || continue
    TI_ANY=1
    TI_GV() { sed -n "s/^$1=//p" "$TI_S" | head -1; }
    TI_W=$(TI_GV src); TI_P=$(TI_GV port); TI_PP=$(TI_GV pid); TI_E=$(TI_GV expiresAt)
    TI_ST=down; TI_REST="-"
    case "$TI_PP" in ''|*[!0-9]*) : ;; *) kill -0 "$TI_PP" 2>/dev/null && TI_ST=up ;; esac
    case "$TI_E" in
      ''|*[!0-9]*) TI_REST="no-expiresAt (old)" ;;
      *) TI_NOW=$(date +%s)
         if [ "$TI_NOW" -lt "$TI_E" ]; then TI_REST="$(( (TI_E - TI_NOW + 59) / 60 )) min"
         else TI_REST=EXPIRED; fi ;;
    esac
    echo "$TI_ST  port $TI_P  rest $TI_REST  $TI_W  http://$TI_ADDR:$TI_P/"
  done
  [ "$TI_ANY" = 1 ] || echo "no test instances on this machine (state files under $TI_ROOT/fleet-testinstanz-*/)"
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
  echo "usage: ./testinstanz.sh up [mixed|full] [--ttl <min>] | fixtures [mixed|full] | succession | states | status | list | down" >&2; exit 2;;
esac

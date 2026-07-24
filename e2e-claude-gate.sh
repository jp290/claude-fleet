#!/bin/sh
# Dedicated e2e run for server.ts's claudeAlive() gate — see fleet-e2e-claude-gate.ts for
# why this needs its own harness instead of living in the main suite. Compiles a real
# stand-in binary literally named `claude` (a shebang script wouldn't do: ps reports the
# interpreter's comm, not the script's filename), runs it as FLEET_CMD on its own tmux
# socket/port, throwaway copy of the repo — the live fleet is never touched.
#   ./e2e-claude-gate.sh
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR derived from $$ so concurrent runs never share a socket/port —
# one run's kill-server can't hit another's server (same scheme as e2e-isolated.sh,
# different port band so the two suites can't collide with each other either)
DIR="${TMPDIR:-/tmp}/fleet-e2e-gate-instance-$$"
FAKEBIN="${TMPDIR:-/tmp}/fleet-e2e-gate-fakebin-$$"
SOCK="fleetgatetest$$"
PORT=$((10800 + $$ % 2000))

CC="$(command -v clang || command -v cc)"
if [ -z "$CC" ]; then
  echo "e2e-claude-gate.sh: no C compiler (clang/cc) found — cannot build the fake claude binary" >&2
  exit 1
fi

rm -rf "$DIR" "$FAKEBIN"
mkdir -p "$DIR" "$FAKEBIN"
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/fleet-e2e-claude-gate.ts" "$SRC/public" "$SRC/package.json" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

# a throwaway git repo the dispatcher spawns lanes from — needed to exercise the
# post-spawn re-check (server.ts tickDispatch): the gate suite's fake `claude` can die
# after the boot sleep, so the fresh claudeAlive gate here is the ONLY thing that stops
# externally-sourced task text being typed into a bare shell. The main suite can't test
# this (FLEET_CMD=true short-circuits claudeAlive to a constant true).
DISPATCH_REPO="$DIR/dispatchrepo"
mkdir -p "$DISPATCH_REPO"
( cd "$DISPATCH_REPO" && git init -q && git config user.email t@t && git config user.name t \
  && printf 'root\n' > code.txt && git add code.txt && git commit -qm init )

# two variants of a binary literally named `claude` (comm= must resolve to a path ending
# in "claude", which only a real executable — not a shebang script — reliably gives us):
# claude-exit returns immediately (simulates a crashed/finished claude, pane falls through
# to `exec $SHELL`); claude-hang stays resident as a genuine child process. The test swaps
# which one is installed as `claude` on PATH between its two branches.
cat > "$FAKEBIN/claude-exit.c" <<'EOF'
int main(void) { return 0; }
EOF
cat > "$FAKEBIN/claude-hang.c" <<'EOF'
#include <unistd.h>
int main(void) { for (;;) pause(); }
EOF
"$CC" -O0 -o "$FAKEBIN/claude-exit" "$FAKEBIN/claude-exit.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/claude-hang" "$FAKEBIN/claude-hang.c" || exit 1
cp "$FAKEBIN/claude-exit" "$FAKEBIN/claude"
chmod +x "$FAKEBIN/claude" "$FAKEBIN/claude-hang"

# unique-per-run socket: without this trap an interrupted run would leak its tmux
# server forever (no later run reuses the socket to kill it)
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT

tmux -L "$SOCK" kill-server 2>/dev/null

# PATH_EXPORT is read ONCE at server.ts startup and baked into every pane command for the
# server's whole lifetime (server.ts:31) — $FAKEBIN must be prepended here, at server start,
# not passed to the test script later, or newly-opened panes wouldn't see it
# FLEET_STEWARD_MIN_IDLE_MS + FLEET_OUTCOME_WINDOW_MS are shrunk for the crash-candidate branch:
# it must send a steward nudge (idle gate) then let claude die inside the effect window (which the
# window-close measurement pass reads) within the test's time budget rather than the 60s/10min defaults.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && PATH='$FAKEBIN:$PATH' FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=claude FLEET_DISPATCH_REPO='$DISPATCH_REPO' FLEET_STEWARD_MIN_IDLE_MS=800 FLEET_OUTCOME_WINDOW_MS=3000 exec bun server.ts >> server.log 2>&1"
sleep 2

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FAKE_CLAUDE_DIR="$FAKEBIN" FLEET_STEWARD_MIN_IDLE_MS=800 bun fleet-e2e-claude-gate.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
# unique-per-run dirs: clean up on success, keep for post-mortem on failure
if [ "$code" = 0 ]; then rm -rf "$DIR" "$FAKEBIN"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

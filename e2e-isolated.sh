#!/bin/sh
# Run the e2e suite against a throwaway copy of the repo on its own tmux socket
# and port, so the LIVE fleet (socket claudefleet, port 8790, real sessions in
# every slot) is never touched. Slots opened by the test run `true; exec $SHELL`
# instead of claude.
#   ./e2e-isolated.sh
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"
DIR="${TMPDIR:-/tmp}/fleet-e2e-instance"
SOCK=fleettest
PORT=8791

rm -rf "$DIR"
mkdir -p "$DIR"
cp -R "$SRC/server.ts" "$SRC/fleet-e2e.ts" "$SRC/public" "$SRC/package.json" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

SHAREHOST=sharetest

tmux -L "$SOCK" kill-server 2>/dev/null
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST exec bun server.ts >> server.log 2>&1"
sleep 2

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST bun fleet-e2e.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
exit $code

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

# a throwaway git repo the worktree/dispatch tests spawn lanes from
REPO="$DIR/testrepo"
mkdir -p "$REPO"
# .env is gitignored, as in a real repo — so createWorktree's copy of it stays invisible
# to `git status` and doesn't dirty a fresh lane
( cd "$REPO" && git init -q && git config user.email t@t && git config user.name t \
  && printf 'root\n' > code.txt && printf 'SECRET=1\n' > .env && printf '.env\n' > .gitignore \
  && git add code.txt .gitignore && git commit -qm init )

SHAREHOST=sharetest
INTAKE=e2e-intake-secret
export FLEET_E2E_REPO="$REPO"

# stand-in summarizer: swallows the prompt on stdin, answers in claude -p's
# --output-format json envelope — exercises the real gather→spawn→parse→cache path
# without a model call
cat > "$DIR/fakesum" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"summary\\": \\"fake summary of the session\\", \\"openThreads\\": [\\"thread-a\\"], \\"verification\\": \\"none seen\\"}"}'
EOF
chmod +x "$DIR/fakesum"

# stand-in ✨ enhancer: same envelope contract, answers a fixed reworked prompt
cat > "$DIR/fakeenh" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"prompt\\": \\"enhanced prompt. own your work! /sharpen3\\"}"}'
EOF
chmod +x "$DIR/fakeenh"

tmux -L "$SOCK" kill-server 2>/dev/null
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE FLEET_DISPATCH_REPO='$REPO' FLEET_SUMMARY_CMD='$DIR/fakesum' FLEET_ENHANCE_CMD='$DIR/fakeenh' exec bun server.ts >> server.log 2>&1"
sleep 2

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE bun fleet-e2e.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
exit $code

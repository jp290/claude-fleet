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

# stand-in ⏫ merge agent: cwd is the lane worktree. The agent's contract is REBASE-ONLY
# (the server ff-merges and lands afterwards) and it is only ever spawned on a real
# conflict — the server resolves conflict-free rebases itself. The mode file next to the
# test repo steers each run: blocked — report blocked · lie — claim rebased without
# rebasing (the server must catch this via merge-base) · do — really resolve+rebase, then
# claim rebased · prose — really resolve+rebase, then answer off-contract (in prose)
cat > "$DIR/fakemerge" <<'EOF'
#!/bin/sh
cat >/dev/null
ctl="$(dirname "$(dirname "$PWD")")/mergemode"
mode="$(cat "$ctl" 2>/dev/null || echo blocked)"
# do/prose simulate the real agent, which only runs on a CONFLICT (clean rebases are
# handled by the server's script pre-pass and never reach here) — so resolve with a
# strategy that always completes, leaving a clean tree rebased onto main for the server
# to verify. -X theirs keeps the lane's side on conflict.
if [ "$mode" = do ] || [ "$mode" = prose ]; then
  git rebase -X theirs -q main >/dev/null 2>&1
fi
if [ "$mode" = blocked ]; then
  printf '{"result": "{\\"status\\": \\"blocked\\", \\"detail\\": \\"fake conflict\\"}"}'
elif [ "$mode" = prose ]; then
  printf '{"result": "Rebase complete! I resolved the conflicts but forgot to answer in the JSON contract."}'
else
  printf '{"result": "{\\"status\\": \\"rebased\\", \\"detail\\": \\"fake rebased\\"}"}'
fi
EOF
chmod +x "$DIR/fakemerge"

# stand-in 💾 commit-message agent: same {"result": …} envelope, answers a fixed
# conventional-commit message so the agent-mode commit path round-trips without a model.
cat > "$DIR/fakecommit" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"message\\": \\"feat: stand-in commit message\\"}"}'
EOF
chmod +x "$DIR/fakecommit"

# stand-in 🧭 steward-digest worker: same envelope, answers a fixed digest so the
# compose→spawn→parse→clamp pipeline round-trips without a model.
cat > "$DIR/fakedigest" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"digest\\": {\\"conditions\\": {\\"1\\": \\"healthy-running\\"}, \\"changed\\": [\\"slot 1 committed\\"], \\"attention\\": []}}"}'
EOF
chmod +x "$DIR/fakedigest"

tmux -L "$SOCK" kill-server 2>/dev/null
# FLEET_OUTCOME_WINDOW_MS shrinks the 10-min intervention-effect window so the outcome tests
# can measure a send within seconds; SUSTAIN is left at its 60s default so a shrunk window can
# never mark helped on transient output (every helped in-test is via the git signal).
# FLEET_PROMOTION_MIN_N=1 so a single helped makes a class promotion-eligible.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE FLEET_DISPATCH_REPO='$REPO' FLEET_OUTCOME_WINDOW_MS=1500 FLEET_PROMOTION_MIN_N=1 FLEET_SUMMARY_CMD='$DIR/fakesum' FLEET_ENHANCE_CMD='$DIR/fakeenh' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_COMMIT_CMD='$DIR/fakecommit' FLEET_DIGEST_CMD='$DIR/fakedigest' exec bun server.ts >> server.log 2>&1"
# wait for the server to actually bind (loaded dev box can take >2s) instead of a fixed sleep.
# ANY HTTP status means it's listening (401 without a token still proves the port is up).
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" != "000" ] && break
  sleep 0.5
done
sleep 0.5

cd "$DIR" || exit 1
# the outcome-window/N overrides must also be in the TEST's env: the suite restarts srv mid-run
# and rebuilds the server env from a whitelist of process.env keys — without these here they'd be
# dropped on restart and the post-restart server would revert to the 10-min default window. Same
# for the dispatch repo + fake-agent cmds: dropped, the post-restart dispatcher is permanently
# unavailable and merge/summary/commit fall back to the real `claude`.
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE FLEET_OUTCOME_WINDOW_MS=1500 FLEET_PROMOTION_MIN_N=1 FLEET_DISPATCH_REPO="$REPO" FLEET_SUMMARY_CMD="$DIR/fakesum" FLEET_ENHANCE_CMD="$DIR/fakeenh" FLEET_MERGE_CMD="$DIR/fakemerge" FLEET_COMMIT_CMD="$DIR/fakecommit" FLEET_DIGEST_CMD="$DIR/fakedigest" bun fleet-e2e.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
exit $code

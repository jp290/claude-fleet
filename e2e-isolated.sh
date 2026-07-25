#!/bin/sh
# Run the e2e suite against a throwaway copy of the repo on its own tmux socket
# and port, so the LIVE fleet (socket claudefleet, port 8790, real sessions in
# every slot) is never touched. Slots opened by the test run `true; exec $SHELL`
# instead of claude.
#   ./e2e-isolated.sh
set -u
# Hermetic isolation: this suite is often launched from INSIDE a Fleet worktree lane (the
# land-verify gate runs there), whose pane env carries the scoped FLEET_SELF_TOKEN /
# FLEET_SELF_SLOT (and, for a steward pane, FLEET_STEWARD_TOKEN). The throwaway tmux server
# below inherits this env and tmux bakes it into EVERY pane it spawns — including plain,
# non-lane slots. That contaminates the "FLEET_SELF_TOKEN absent for a non-lane slot" check:
# a plain slot's shell would falsely report a token it never got from the server. Strip the
# ambient creds so the test server's spawn env is clean and the server's OWN selfExport logic
# (server.ts: baked only when s.worktree is set) is the only thing that can put a self-token
# into a pane — which is exactly what that check is asserting about.
unset FLEET_SELF_TOKEN FLEET_SELF_SLOT FLEET_STEWARD_TOKEN
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR are derived from $$ so concurrent runs (e.g. two worktree lanes)
# never share a socket/port — one run's kill-server can't hit another's server.
DIR="${TMPDIR:-/tmp}/fleet-e2e-instance-$$"
SOCK="fleettest$$"
PORT=$((8800 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
# fleet-e2e.ts is the runner; the checks live in e2e/*.ts and are imported relative to it
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/enhance-prompt.ts" "$SRC/lane-signals.ts" "$SRC/fleet-e2e.ts" "$SRC/e2e" "$SRC/public" "$SRC/package.json" "$DIR/"
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

# stand-in 🔍 reviewer: same envelope, answers two findings DELIBERATELY worst-last plus one
# uncited claim — so the test proves the server ranks by impact and drops a finding without a
# cited line. Each run appends its cwd (= the reviewed lane's worktree) to $DIR/reviewruns, which
# is how "the cache served it without a second spawn" is checked as a fact rather than inferred
# from the payload. Per-LANE lines, not a bare counter: auto-③ reviews other lanes on its own
# schedule, so a global count would make every spawn assertion a race.
# $DIR/reviewdelay (seconds, default 0) keeps a run in flight so the identity/inflight races are
# deterministically testable; $DIR/reviewfail makes it exit non-zero, which is how "a failed
# review is a non-event — one attempt per git state, no retry storm" is checked.
cat > "$DIR/fakereview" <<'EOF'
#!/bin/sh
cat >/dev/null
echo "$PWD" >> "$(dirname "$0")/reviewruns"
delay="$(cat "$(dirname "$0")/reviewdelay" 2>/dev/null || echo 0)"
[ "$delay" != 0 ] && sleep "$delay"
[ -f "$(dirname "$0")/reviewfail" ] && exit 1
printf '{"result": "{\\"findings\\": [{\\"title\\": \\"low one\\", \\"file\\": \\"b.ts\\", \\"line\\": 7, \\"impact\\": \\"low\\", \\"cost\\": \\"slower\\", \\"basis\\": \\"inferred\\", \\"detail\\": \\"d2\\"}, {\\"title\\": \\"uncited claim\\", \\"file\\": \\"c.ts\\", \\"impact\\": \\"high\\", \\"cost\\": \\"x\\", \\"basis\\": \\"verified\\", \\"detail\\": \\"no line\\"}, {\\"title\\": \\"high one\\", \\"file\\": \\"a.ts\\", \\"line\\": 42, \\"impact\\": \\"high\\", \\"cost\\": \\"data loss\\", \\"basis\\": \\"verified\\", \\"detail\\": \\"d1\\"}], \\"notes\\": \\"diff truncated\\"}"}'
EOF
chmod +x "$DIR/fakereview"

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
req="$(cat)"
ctl="$(dirname "$(dirname "$PWD")")/mergemode"
mode="$(cat "$ctl" 2>/dev/null || echo blocked)"
# REPAIR call: the server re-invokes this agent with a "REPAIRING" prompt when a conflict
# resolution rebased cleanly but the deterministic verify failed. The fix here mirrors what a
# real repair agent does — make the tree pass: scrub the VERIFYBAD sabotage marker the resolution
# left, commit (no rebase), report repaired. The server re-verifies and decides.
case "$req" in
  *REPAIRING*)
    git grep -lI VERIFYBAD -- . 2>/dev/null | while IFS= read -r f; do
      tmp="$(mktemp)"; sed 's/VERIFYBAD//g' "$f" > "$tmp" && mv "$tmp" "$f"
    done
    git add -A >/dev/null 2>&1
    git commit -qm "repair: scrub VERIFYBAD marker" >/dev/null 2>&1
    printf '{"result": "{\\"status\\": \\"repaired\\", \\"detail\\": \\"fake repair — scrubbed the marker\\"}"}'
    exit 0 ;;
esac
# hang — stay in flight (sleep) so a test can recycle the slot WHILE the merge job runs,
# proving the job's mergeInflight/mergeStart entries are dropped on recycle (F5). No git.
if [ "$mode" = hang ]; then
  sleep 8
  printf '{"result": "{\\"status\\": \\"blocked\\", \\"detail\\": \\"fake hang\\"}"}'
  exit 0
fi
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

# stand-in deterministic verify (FLEET_VERIFY_CMD). cwd = the REBASED lane worktree.
# Its result is a fact about that tree, not the agent's word (design note §2 layer 1).
# Scans the tracked tree for a sabotage marker: present → exit 1 (verify RED, "the
# rebased tree breaks the build"), absent → exit 0 (GREEN) — the same shape a real
# tsc/test gate has. Tests plant/omit the marker in a lane's committed content.
cat > "$DIR/fakeverify" <<'EOF'
#!/bin/sh
# A real verify command may DECLINE to verify the tree in front of it (watchdog.sh's repo guard).
# Both halves of the skip contract are exercised: the reserved exit code, and the legacy
# "verify skipped:" marker line at exit 0 that a not-yet-kickstarted watchdog still emits.
if git grep -qI VERIFYSKIP42 -- . 2>/dev/null; then
  echo "verify skipped: this stand-in does not know how to verify that tree"
  exit 42
fi
if git grep -qI VERIFYSKIPZERO -- . 2>/dev/null; then
  echo "verify skipped: legacy exit-0 form, this stand-in verified nothing"
  exit 0
fi
if git grep -qI VERIFYBAD -- . 2>/dev/null; then
  echo "verify FAIL: VERIFYBAD marker present in the rebased tree"
  exit 1
fi
echo "verify OK: no sabotage marker in the tree"
exit 0
EOF
chmod +x "$DIR/fakeverify"

# stand-in 💾 commit-message agent: same {"result": …} envelope, answers a fixed
# conventional-commit message so the agent-mode commit path round-trips without a model.
cat > "$DIR/fakecommit" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"message\\": \\"feat: stand-in commit message\\"}"}'
EOF
chmod +x "$DIR/fakecommit"

# stand-in 🧭 steward-digest worker: same envelope, answers a fixed digest so the
# compose→spawn→parse→clamp pipeline round-trips without a model. Sleeps for the seconds
# in $DIR/digestdelay (default 0) so the P3 bounded-wait race is deterministically testable
# ($0's dir is $DIR — same file the test writes via parent-of-REPO).
cat > "$DIR/fakedigest" <<'EOF'
#!/bin/sh
# keep the prompt: the done-looking rule the worker is handed is GENERATED from the same clause
# list the deterministic predicate iterates, and the test asserts that here (anti-drift, §3)
cat > "$(dirname "$0")/digestprompt"
delay="$(cat "$(dirname "$0")/digestdelay" 2>/dev/null || echo 0)"
[ "$delay" != 0 ] && sleep "$delay"
printf '{"result": "{\\"digest\\": {\\"conditions\\": {\\"1\\": \\"healthy-running\\"}, \\"changed\\": [\\"slot 1 committed\\"], \\"attention\\": []}}"}'
EOF
chmod +x "$DIR/fakedigest"

# unique-per-run socket: without this trap an interrupted run would leak its tmux
# server forever (no later run reuses the socket to kill it)
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT

tmux -L "$SOCK" kill-server 2>/dev/null
# FLEET_OUTCOME_WINDOW_MS shrinks the 10-min intervention-effect window so the outcome tests
# can measure a send within seconds; FLEET_OUTCOME_SUSTAIN_MS shrinks the "still emitting at
# close" bar to 800ms so the positive output-signal path is reachable inside the shrunk window
# (a still-quiet slot or a lone early blip is stale by close → no-effect). FLEET_HARM_ATTEST_TTL_MS
# shrinks the attest-freshness window to 4s so the stale-attest → not-eligible path is testable.
# FLEET_PROMOTION_MIN_N=1 so a single helped makes a class promotion-eligible.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE FLEET_DISPATCH_REPO='$REPO' FLEET_OUTCOME_WINDOW_MS=1500 FLEET_OUTCOME_SUSTAIN_MS=800 FLEET_HARM_ATTEST_TTL_MS=4000 FLEET_PROMOTION_MIN_N=1 FLEET_AUTO_REVIEW_MS=1000 FLEET_AUTO_REVIEW_IDLE_MS=1500 FLEET_SUMMARY_CMD='$DIR/fakesum' FLEET_ENHANCE_CMD='$DIR/fakeenh' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_COMMIT_CMD='$DIR/fakecommit' FLEET_REVIEW_CMD='$DIR/fakereview' FLEET_DIGEST_CMD='$DIR/fakedigest' exec bun server.ts >> server.log 2>&1"
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
FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS=$SHAREHOST FLEET_SHARE_HOSTS=$SHAREHOST FLEET_INTAKE_SECRET=$INTAKE FLEET_OUTCOME_WINDOW_MS=1500 FLEET_OUTCOME_SUSTAIN_MS=800 FLEET_HARM_ATTEST_TTL_MS=4000 FLEET_PROMOTION_MIN_N=1 FLEET_AUTO_REVIEW_MS=1000 FLEET_AUTO_REVIEW_IDLE_MS=1500 FLEET_DISPATCH_REPO="$REPO" FLEET_SUMMARY_CMD="$DIR/fakesum" FLEET_ENHANCE_CMD="$DIR/fakeenh" FLEET_MERGE_CMD="$DIR/fakemerge" FLEET_VERIFY_CMD="$DIR/fakeverify" FLEET_COMMIT_CMD="$DIR/fakecommit" FLEET_REVIEW_CMD="$DIR/fakereview" FLEET_DIGEST_CMD="$DIR/fakedigest" bun fleet-e2e.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
# unique-per-run DIR: clean up on success, keep for post-mortem on failure
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

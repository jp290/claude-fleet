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
#
# PORT BAND TABLE — the ONE place a band is assigned. Every harness computes
# PORT=$((base + $$ % 2000)), so a band is exactly 2000 wide and two harnesses whose bands
# overlap WILL collide on the HTTP bind for the same $$ (distinct tmux sockets do not help:
# the port is the shared resource, and these suites are expressly run side by side).
# Bands must be pairwise disjoint; they must also never contain the live fleet's 8790.
#   e2e-isolated.sh         8800 – 10799
#   e2e-claude-gate.sh     10800 – 12799
#   e2e-clean-review.sh    13000 – 14999
#   e2e-postland-audit.sh  15000 – 16999
#   drills/drill-3.sh      17400 – 19399
#   e2e-security.sh        21400 – 23399
# Next free base: 23400. Add a new harness to this table FIRST, then copy the base into it.
# Disjoint from each other is only half of it — a band also has to be clear of what else listens
# on this box. Checked with `lsof -nP -iTCP -sTCP:LISTEN` when security was re-spaced: the obvious
# squatter is cloudflared's metrics pair 20241/20242, which is why security skips 19400 and takes
# 21400. Pre-existing and NOT fixed here, so the next hand knows: the 8800 band already contains
# several long-lived local services (8815, 8850, 8862, 8899, 8901, 8924 were up that day) and
# drill-3's contains 18789/18792 — a run whose $$ lands on one of those fails to bind.
DIR="${TMPDIR:-/tmp}/fleet-e2e-instance-$$"
SOCK="fleettest$$"
PORT=$((8800 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
# What the instance contains is DERIVED from the entry files' imports, not listed here —
# e2e-stage.sh carries the rule and the two dead harnesses that motivated it.
# Entries: server.ts (the app) + fleet-e2e.ts (the runner). All 31 e2e/*.ts ride in as the
# runner's transitive imports, so a new check module still needs no change to this wrapper —
# and now neither does a new top-level directory, which used to need one.
# No STAGE_EXTRA: the one src/ file the suite actually imports (src/backoff.ts, via
# e2e/slots.ts) comes with the closure, and the only check that reads client SOURCE resolves
# it through the node_modules symlink on purpose (e2e/outcomes.ts:278-283) — whose comment
# "carries server.ts + public/ but NOT src/" is true again now that the wholesale copy is gone.
. "$SRC/e2e-stage.sh"
stage_instance "$SRC" "$DIR" server.ts fleet-e2e.ts || exit 1

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
if [ "$mode" = do ] || [ "$mode" = prose ] || [ "$mode" = dohang ]; then
  git rebase -X theirs -q main >/dev/null 2>&1
fi
# dohang — really resolve+rebase (so the lane now carries agent-chosen resolutions, committed and
# rebased onto main) and then STAY IN FLIGHT, so a test can kill the server in the window between
# "the lane was rewritten" and "a verdict was recorded". That window is the whole defect; the
# rebase above is the deterministic signal a test polls for before pulling the plug.
if [ "$mode" = dohang ]; then
  sleep 25
  printf '{"result": "{\\"status\\": \\"rebased\\", \\"detail\\": \\"fake rebased after hanging\\"}"}'
  exit 0
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
# The shape a REAL suite has, and the one the old tail-slice could not survive: hundreds of
# result lines, the failing one buried among them, only the COUNT at the end — plus a noisy
# stderr big enough that concatenate-then-tail-slice kept nothing but stderr. A red run that
# cannot name its failing check is the defect this exercises.
if git grep -qI VERIFYNOISY -- . 2>/dev/null; then
  i=0; while [ $i -lt 400 ]; do echo "PASS  filler check $i"; i=$((i+1)); done
  echo "FAIL  §9 the needle check that actually broke"
  i=0; while [ $i -lt 400 ]; do echo "PASS  trailing filler $i"; i=$((i+1)); done
  i=0; while [ $i -lt 400 ]; do echo "noise: deprecation warning $i" >&2; i=$((i+1)); done
  echo ""
  echo "1 FAILURES"
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

# ORPHAN REAP — the complement to the trap below, for the one abort path the trap cannot cover.
# Measured 2026-07-26, so the negative half is on the record too: the EXIT trap DOES run on TERM,
# on HUP, on a real terminal Ctrl-C (group SIGINT), and on tmux's kill-session teardown of a lane
# pane — those paths already clean up and need no extra trap specs. SIGKILL is the escape: the
# shell dies without running anything, and because the socket name carries this wrapper's own PID,
# no later run ever reuses that socket to collect it. Reproduced: `kill -9` on the wrapper left
# `tmux -L fleettest<pid>` alive with its ORIGINAL start time (so, never re-created — simply never
# killed), the scratch dir behind, and the suite child reparented to init still driving the socket.
# That is the shape of the orphan found in the wild, whose node_modules symlink pointed at a lane
# worktree that no longer existed.
# So: reap at START, keyed on whether the socket's OWNER PID is still alive. Deliberately NOT the
# age heuristic ("kill fleettest servers older than N hours") — these wrappers are expressly run
# concurrently and a live run's owner PID is alive BY DEFINITION, so liveness cannot shoot down a
# neighbour the way an age cutoff could. The residual failure is the safe direction: if a dead
# owner's PID has since been recycled by an unrelated process, the reap is skipped and the socket
# just survives to the next run. Killing a live run would be worse than the leak.
TMUX_SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
for _s in "$TMUX_SOCKDIR"/fleettest*; do
  [ -S "$_s" ] || continue                        # no glob match → the pattern itself; not a socket
  _own="${_s##*/fleettest}"
  case "$_own" in ''|*[!0-9]*) continue ;; esac    # only fleettest<pid>, never fleettestlane…
  [ "$_own" = "$$" ] && continue
  kill -0 "$_own" 2>/dev/null && continue          # owner alive → a live run, hands off
  tmux -L "fleettest$_own" kill-server 2>/dev/null
done

# unique-per-run socket: without this trap an interrupted run would leak its tmux
# server forever (no later run reuses the socket to kill it)
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT

tmux -L "$SOCK" kill-server 2>/dev/null
# FLEET_OUTCOME_WINDOW_MS shrinks the 10-min A2 null-calibration control window (the
# intervention-outcome tally it originally also sized was removed,
# docs/analysis-2026-07-28-verification.md §3) so the baselineRate tests can turn a control cohort
# over within seconds; FLEET_OUTCOME_SUSTAIN_MS shrinks the "still emitting at close" bar to 800ms
# so the positive output-signal path is reachable inside the shrunk window (a still-quiet slot or a
# lone early blip is stale by close → no-effect).
# FLEET_STEWARD_JOURNAL_PER_HOUR RAISES the hourly journal cap (prod default 6) above what this
# suite legitimately writes: the steward sections anchor ~9-11 rundgang records over their run, and
# the cap is a one-way door inside its hour. Set high enough that only the dedicated cap check at
# the END of e2e/steward-outcomes.ts closes it, with headroom for a future anchor or two. Raised
# 15→30 when the cap's filter-then-count fix (slice-displacement leak) made the door honest: at 15
# the earlier sections' legitimate writes starved the rotation/digest-anchor fixtures (5 real 429s
# the leaky cap used to let through).
#
# ONE list, used TWICE: for the srv spawn below and for the harness process further down. The
# suite restarts srv mid-run and rebuilds the server env from a whitelist of process.env keys, so
# a knob set on only one of the two lines silently REVERTS at that restart (the post-restart server
# would fall back to the 10-min outcome window, lose the dispatch repo, and run the real `claude`
# instead of the stand-ins). Two hand-kept copies could drift; one string cannot.
# Values are single-quoted for the inner shell tmux runs, which is why the harness invocation goes
# through `eval` — assignments that arrive by expansion are not assignments to the parser, and only
# a re-parse both recognises them and strips these quotes.
# FLEET_HOST stays OUT of the list on purpose: it is a server-side bind knob, and the harness
# hardcodes 127.0.0.1 (e2e/harness.ts's IP) rather than reading it.
SRV_ENV="FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_ALLOWED_HOSTS='$SHAREHOST' FLEET_SHARE_HOSTS='$SHAREHOST' FLEET_INTAKE_SECRET='$INTAKE' FLEET_DISPATCH_REPO='$REPO' FLEET_OUTCOME_WINDOW_MS=1500 FLEET_OUTCOME_SUSTAIN_MS=800 FLEET_STEWARD_JOURNAL_PER_HOUR=30 FLEET_AUTO_REVIEW_MS=1000 FLEET_AUTO_REVIEW_IDLE_MS=1500 FLEET_SUMMARY_CMD='$DIR/fakesum' FLEET_ENHANCE_CMD='$DIR/fakeenh' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_COMMIT_CMD='$DIR/fakecommit' FLEET_REVIEW_CMD='$DIR/fakereview' FLEET_DIGEST_CMD='$DIR/fakedigest'"
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 $SRV_ENV exec bun server.ts >> server.log 2>&1"
# wait for the server to actually bind (loaded dev box can take >2s) instead of a fixed sleep.
# ANY HTTP status means it's listening (401 without a token still proves the port is up).
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" != "000" ] && break
  sleep 0.5
done
sleep 0.5

cd "$DIR" || exit 1
# the SAME env the srv spawn got — see the SRV_ENV comment above for why the two must be one string.
# FLEET_E2E_SUITE rides in FRONT of it, not inside it: it is a harness-only label (the name every
# trail row this run writes is stamped with, e2e/trail-emit.ts) and the server has no use for it.
eval "FLEET_E2E_SUITE=isolated $SRV_ENV bun fleet-e2e.ts"
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
# unique-per-run DIR: clean up on success, keep for post-mortem on failure
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

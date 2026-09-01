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
# one run's kill-server can't hit another's server (same scheme as e2e-isolated.sh).
# The port base comes from the PORT BAND TABLE in e2e-isolated.sh — never pick one here.
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
# Instance contents are DERIVED from the entry files' imports — the rule (and the two harnesses
# that died of hand-kept lists) is in e2e-stage.sh. e2e/harness.ts and its own imports ride in
# because fleet-e2e-claude-gate.ts imports them; nothing here names them.
. "$SRC/e2e-stage.sh"
stage_instance "$SRC" "$DIR" server.ts fleet-e2e-claude-gate.ts || exit 1
# Phase 2 (the NON-claude harness) gets its OWN instance dir, unlike e2e-clean-review.sh's two
# phases which deliberately share one to reuse a journal. Here the state file is the thing that
# must not carry over: phase 1 leaves four slots pinned to the `claude` stand-in, and phase 2's
# question is what the server makes of panes spawned by a DIFFERENT command. Adopting phase 1's
# slots would answer it with the wrong panes.
DIR2="${TMPDIR:-/tmp}/fleet-e2e-harness-instance-$$"
DIR3="${TMPDIR:-/tmp}/fleet-e2e-unprobed-instance-$$"
rm -rf "$DIR2" "$DIR3"
mkdir -p "$DIR2" "$DIR3"
stage_instance "$SRC" "$DIR2" server.ts fleet-e2e-harness.ts || exit 1
# Phase 2's waiver counter-proof needs the opposite server declaration: the same unknown default
# harness, but with an EMPTY comms set. A separate instance keeps that immutable boot-time fact
# honest instead of trying to fake a per-slot waiver the production model does not have.
stage_instance "$SRC" "$DIR3" server.ts fleet-e2e-harness.ts || exit 1

# a throwaway git repo for phase 2's WORKER branch: the ✨ summary route refuses a non-repo cwd
# before it ever reaches a worker, so the branch needs a real one to ask its question at all.
WORKER_REPO="$DIR2/workerrepo"
mkdir -p "$WORKER_REPO"
( cd "$WORKER_REPO" && git init -q -b main && git config user.email t@t && git config user.name t \
  && printf 'root\n' > code.txt && git add code.txt && git commit -qm init )

# a throwaway git repo the dispatcher spawns lanes from — needed to exercise the
# post-spawn re-check (server.ts tickDispatch): the gate suite's fake `claude` can die
# after the boot sleep, so the fresh claudeAlive gate here is the ONLY thing that stops
# externally-sourced task text being typed into a bare shell. The main suite can't test
# this (FLEET_CMD=true short-circuits claudeAlive to a constant true).
DISPATCH_REPO="$DIR/dispatchrepo"
mkdir -p "$DISPATCH_REPO"
# -b main, same reason as e2e-isolated.sh: the default branch is a platform accident on macOS
# (Apple's CommandLineTools gitconfig), not something this repo establishes.
( cd "$DISPATCH_REPO" && git init -q -b main && git config user.email t@t && git config user.name t \
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
# The boot-race fixtures must delay the AGENT PROCESS, not merely delay an already-visible harn.
# A script has the interpreter's comm, so these wrappers are intentionally NOT recognised by
# FLEET_HARNESS_COMMS=harn. Only their later `exec harn-*` transition can satisfy paneAgentAt.
# boot-flush clears input BEFORE it execs the declared harn-agent. This ordering is mechanical:
# paneAgentAt cannot call the agent alive in the tiny exec→main window before tcflush, which made
# the former combined binary's probe depend on scheduler timing. An old send queued during the
# wrapper sleep is still genuinely lost; the fixed path cannot observe harn until after the flush.
cat > "$FAKEBIN/boot-flush.c" <<'EOF'
#include <termios.h>
#include <unistd.h>
int main(int argc, char **argv) {
  if (argc != 2) return 2;
  tcflush(STDIN_FILENO, TCIFLUSH);
  execl(argv[1], argv[1], (char *)0);
  return 111;
}
EOF
cat > "$FAKEBIN/harn-agent.c" <<'EOF'
#include <stdio.h>
#include <string.h>
int main(void) {
  char line[4096] = {0};
  if (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = 0;
    printf("harn-received=[%s]\n", line);
    fflush(stdout);
  }
  return 0;
}
EOF
cat > "$FAKEBIN/harn-print.c" <<'EOF'
#include <stdio.h>
#include <unistd.h>
int main(void) {
  puts("harn-observed-ready");
  fflush(stdout);
  for (;;) pause();
}
EOF
cat > "$FAKEBIN/harn-boot" <<'EOF'
#!/bin/sh
sleep 2
base="$(dirname "$0")"
exec "$base/boot-flush" "$base/harn-agent"
EOF
cat > "$FAKEBIN/harn-observed" <<'EOF'
#!/bin/sh
sleep 3
exec "$(dirname "$0")/harn-print"
EOF
cat > "$FAKEBIN/harn-never" <<'EOF'
#!/bin/sh
sleep 6
EOF
"$CC" -O0 -o "$FAKEBIN/claude-exit" "$FAKEBIN/claude-exit.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/claude-hang" "$FAKEBIN/claude-hang.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/boot-flush" "$FAKEBIN/boot-flush.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/harn-agent" "$FAKEBIN/harn-agent.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/harn-print" "$FAKEBIN/harn-print.c" || exit 1
chmod +x "$FAKEBIN/boot-flush" "$FAKEBIN/harn-agent" "$FAKEBIN/harn-print" "$FAKEBIN/harn-boot" "$FAKEBIN/harn-observed" "$FAKEBIN/harn-never"
cp "$FAKEBIN/claude-exit" "$FAKEBIN/claude"
chmod +x "$FAKEBIN/claude" "$FAKEBIN/claude-hang"

# ...and the same pair under a name that is NOT claude, for phase 2. The name is arbitrary on
# purpose: the server learns it only from FLEET_HARNESS_COMMS at boot, so a `harn` that nothing in
# server.ts has ever heard of is what proves no harness is compiled in. Same two variants, same
# reason — exit = the harness that died on an unresolvable model and left the pane to `exec $SHELL`,
# hang = a resident agent the probe must find.
"$CC" -O0 -o "$FAKEBIN/harn-exit" "$FAKEBIN/claude-exit.c" || exit 1
"$CC" -O0 -o "$FAKEBIN/harn-hang" "$FAKEBIN/claude-hang.c" || exit 1
cp "$FAKEBIN/harn-hang" "$FAKEBIN/harn"
chmod +x "$FAKEBIN/harn" "$FAKEBIN/harn-exit" "$FAKEBIN/harn-hang"

# stand-in ✨ enhancer: tickDispatch compiles a queued task's text into the lane brief before
# sending (2026-08-04). Without this stand-in every dispatched lane would spawn a real enhance
# worker — same reasoning as FLEET_AUTO_REVIEW_MS=0 on the spawn line below. Byte-identical to
# the e2e-isolated.sh stand-in, so both suites assert the same compiled-brief marker.
cat > "$DIR/fakeenh" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"prompt\\": \\"enhanced prompt. own your work! /sharpen3\\"}"}'
EOF
chmod +x "$DIR/fakeenh"

# Reap servers a SIGKILLed earlier run left behind — the one abort path the EXIT trap cannot
# cover, keyed on owner-PID liveness so a concurrent run is never touched. Full rationale (and
# the measurements for the signals the trap DOES handle) at the same block in e2e-isolated.sh.
TMUX_SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
for _s in "$TMUX_SOCKDIR"/fleetgatetest*; do
  [ -S "$_s" ] || continue
  _own="${_s##*/fleetgatetest}"
  case "$_own" in ''|*[!0-9]*) continue ;; esac
  [ "$_own" = "$$" ] && continue
  kill -0 "$_own" 2>/dev/null && continue
  tmux -L "fleetgatetest$_own" kill-server 2>/dev/null
done

# unique-per-run socket: without this trap an interrupted run would leak its tmux
# server forever (no later run reuses the socket to kill it)
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT

tmux -L "$SOCK" kill-server 2>/dev/null

# PATH_EXPORT is read ONCE at server.ts startup and baked into every pane command for the
# server's whole lifetime (server.ts:31) — $FAKEBIN must be prepended here, at server start,
# not passed to the test script later, or newly-opened panes wouldn't see it
# FLEET_AUTO_REVIEW_MS=0 turns the auto-③ tick OFF here: this harness configures no
# FLEET_REVIEW_CMD stand-in, so an auto-review of a done-looking lane would spawn a REAL
# claude session. Auto-③ is proven in the main suite, which has the stand-in.
# The two scheduler intervals are shortened from their 5 s / 8 s production defaults. Both aliveness
# branches below are negative-or-paired controls on a scheduled auto — they must out-wait a full
# tickAutos rather than poll — and the dispatcher's post-spawn gate is only reachable once
# tickDispatch has fired. AUTOS_TICK must be set on BOTH lines: the server acts on it, and
# fleet-e2e-claude-gate.ts sizes its windows from the same variable instead of restating a number.
AUTOS_TICK=250
DISP_TICK=250
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && PATH='$FAKEBIN:$PATH' FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_MODEL= FLEET_AUTO_REVIEW_MS=0 FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 FLEET_AUTOS_TICK_MS=$AUTOS_TICK FLEET_DISPATCH_TICK_MS=$DISP_TICK FLEET_CMD=claude FLEET_ACCEPT_WAIT_MS=300 FLEET_DISPATCH_REPO='$DISPATCH_REPO' FLEET_ENHANCE_CMD='$DIR/fakeenh' exec bun server.ts >> server.log 2>&1"
# wait for the server to actually bind (a loaded dev box can take >2s) instead of a fixed sleep —
# this suite runs in the pre-land gate, where a slow boot would read as a red gate.
# ANY HTTP status means it's listening (401 without a token still proves the port is up).
code=000
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" != "000" ] && break
  sleep 0.5
done
if [ "$code" = "000" ]; then
  stage_server_start_failed "e2e-claude-gate.sh" "phase 1 claude (FLEET_CMD=claude)" "$DIR"
  exit 3
fi
sleep 0.5

cd "$DIR" || exit 1
# FLEET_E2E_SUITE names this suite in every trail row the run writes (e2e/trail-emit.ts); without
# it the rows would claim to come from the isolated suite, which is the emitter's default.
echo "--- phase: claude (FLEET_CMD=claude) ---"
FLEET_E2E_SUITE=claude-gate FLEET_PORT=$PORT FLEET_SOCK=$SOCK FAKE_CLAUDE_DIR="$FAKEBIN" FLEET_STEWARD_MIN_IDLE_MS=800 FLEET_AUTOS_TICK_MS=$AUTOS_TICK FLEET_DISPATCH_TICK_MS=$DISP_TICK bun fleet-e2e-claude-gate.ts
code=$?

# Phase 2: the same machinery under a harness that is NOT claude. kill-server, not kill-session:
# phase 1's panes are running its `claude` stand-in, and phase 2 probes for a different comm
# entirely — leaving them up would put panes in the socket that answer the wrong question.
if [ "$code" = 0 ]; then
  tmux -L "$SOCK" kill-server 2>/dev/null
  tmux -L "$SOCK" new-session -d -s srv \
    "cd '$DIR2' && PATH='$FAKEBIN:$PATH' FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_MODEL= FLEET_AUTO_REVIEW_MS=0 FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 FLEET_AUTOS_TICK_MS=$AUTOS_TICK FLEET_CMD=harn FLEET_HARNESS_COMMS=harn FLEET_HARNESS_MODEL_FLAG=--model FLEET_WORKER_HARNESS=container FLEET_DISPATCH_REPO='$WORKER_REPO' FLEET_ENHANCE_CMD='$DIR/fakeenh' exec bun server.ts >> server.log 2>&1"
  # default-shell decides what interprets every pane command tmux builds, and one phase-2 check
  # depends on it being zsh: an unquoted glob model is fatal under zsh ("no matches found" aborts
  # the line, pane and all) and HARMLESS under sh, which leaves an unmatched pattern literal. Under
  # sh that check would still pass while proving nothing, so say so rather than weaken it silently.
  ZSH="$(command -v zsh)"
  if [ -n "$ZSH" ]; then
    tmux -L "$SOCK" set -g default-shell "$ZSH"
  else
    echo "e2e-claude-gate.sh: no zsh — the glob-model pane check runs, but cannot fail as designed" >&2
  fi
  _hc=000
  for _ in $(seq 1 60); do
    _hc=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
    [ "$_hc" != "000" ] && break
    sleep 0.5
  done
  if [ "$_hc" = "000" ]; then
    stage_server_start_failed "e2e-claude-gate.sh" "phase 2 harness (FLEET_CMD=harn)" "$DIR2"
    exit 3
  fi
  sleep 0.5
  cd "$DIR2" || exit 1
  echo "--- phase: harness (FLEET_CMD=harn, a harness server.ts has never heard of) ---"
  FLEET_E2E_SUITE=claude-gate FLEET_PORT=$PORT FLEET_SOCK=$SOCK FAKE_CLAUDE_DIR="$FAKEBIN" WORKER_REPO="$WORKER_REPO" FLEET_AUTOS_TICK_MS=$AUTOS_TICK bun fleet-e2e-harness.ts
  code=$?
fi

# Phase 2b is the waiver half of the same foreign-harness question. The empty declaration is a
# SERVER boot fact, so it cannot share phase 2a's process; FLEET_CMD=true is the repository's
# canonical stand-in and deliberately leaves no process for a readiness probe to find.
if [ "$code" = 0 ]; then
  tmux -L "$SOCK" kill-server 2>/dev/null
  tmux -L "$SOCK" new-session -d -s srv \
    "cd '$DIR3' && PATH='$FAKEBIN:$PATH' FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_MODEL= FLEET_AUTO_REVIEW_MS=0 FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=0 FLEET_CMD=true FLEET_HARNESS_COMMS= exec bun server.ts >> server.log 2>&1"
  _hc=000
  for _ in $(seq 1 60); do
    _hc=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
    [ "$_hc" != "000" ] && break
    sleep 0.5
  done
  if [ "$_hc" = "000" ]; then
    stage_server_start_failed "e2e-claude-gate.sh" "phase 3 harness waiver (FLEET_CMD=true, empty comms)" "$DIR3"
    exit 3
  fi
  sleep 0.5
  cd "$DIR3" || exit 1
  echo "--- phase: harness waiver (FLEET_CMD=true, empty comms) ---"
  FLEET_E2E_SUITE=claude-gate FLEET_GATE_UNPROBED=1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK bun fleet-e2e-harness.ts
  code=$?
fi

tmux -L "$SOCK" kill-server 2>/dev/null
# unique-per-run dirs: clean up on success, keep for post-mortem on failure
if [ "$code" = 0 ]; then rm -rf "$DIR" "$DIR2" "$DIR3" "$FAKEBIN"; else echo "kept test instances for inspection: $DIR $DIR2 $DIR3"; fi
exit $code

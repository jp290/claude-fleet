#!/bin/sh
# Land-gate stage for the gate CHILD PROCESS on the clean path: one clean land, isolated (own $$
# socket/port/dir), whose verify stand-in records the environment server.ts#runVerify hands it.
# Proves the FLEET_* scrub (only the suite-mutex knobs survive, PATH arrives unchanged) and that the
# chain runs inside the server's suite-mutex hold. The server boots with FLEET_CLEAN_REVIEW=off, the
# value watchdog.sh gives production; the ② reviewer's gate and shadow scenarios this wrapper used to
# drive were cut with docs/messungen/2026-10-10-ci-inventur.md, Karte 2.
#   ./e2e-clean-review.sh
set -u
export FLEET_DISK_MIN_FREE_GIB=0.001 FLEET_DISK_WRITER_GIB=0.001 FLEET_HOST_LOAD_MAX=off FLEET_HOST_SWAP_MAX_PCT=off
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR derived from $$ so concurrent runs never collide. The port base comes from the
# PORT BAND TABLE in e2e-isolated.sh — never pick one here.
DIR="${TMPDIR:-/tmp}/fleet-e2e-cleanreview-instance-$$"
SOCK="fleetcrtest$$"
# A helper daemon hands each of its parallel runs a distinct FLEET_E2E_BAND (0-9,
# helper-daemon/daemon.ts#portBand); it picks a 200-wide sub-band of this band, as in e2e-isolated.sh.
# This suite binds PORT alone (no fixture at PORT+N), so 160 + 0 < 200. Without it, unchanged.
# >>> port band (e2e/helper-daemon.ts#bandChecks runs these lines)
if [ -n "${FLEET_E2E_BAND:-}" ]; then
  case "$FLEET_E2E_BAND" in
    [0-9]) PORT=$((13000 + 200 * FLEET_E2E_BAND + $$ % 160)) ;;
    *) echo "e2e-clean-review: FLEET_E2E_BAND=$FLEET_E2E_BAND is not a port band (0-9)" >&2; exit 2 ;;
  esac
else
  PORT=$((13000 + $$ % 2000))
fi
# <<< port band

rm -rf "$DIR"
mkdir -p "$DIR"
# Instance contents are DERIVED from the entry files' imports — rule in e2e-stage.sh. The shared
# e2e/ plumbing this harness now imports (harness.ts, lane-helpers.ts, trail-emit.ts) rides in as
# a transitive import; this wrapper names none of it.
. "$SRC/e2e-stage.sh"
stage_instance "$SRC" "$DIR" server.ts fleet-e2e-clean-review.ts || exit 1

# green verify stand-in (no sabotage marker → clean+green → the lane auto-lands)
#
# It also RECORDS THE ENVIRONMENT IT WAS HANDED, because it is the only thing in this suite that
# stands exactly where the land gate's chain stands: server.ts#runVerify spawns FLEET_VERIFY_CMD,
# and that is this file. The gate's real chain boots three more fleet servers, so every FLEET_* knob
# the spawning server carries is wrong for it — server.ts#auditChildEnv has scrubbed the tier-2
# child on exactly that reasoning since it was written, and runVerify did not until 2026-09-05.
#
# FLEET_* NAMES ONLY, never values: a fleet process carries scoped self-credentials by construction
# (CLAUDE.md, token hygiene), so a dump of values would put them in a log and a check detail. PATH
# is recorded WITH its value, and that is the control half rather than an exception — it is not a
# secret, and "no FLEET_* here" is only worth something beside "and PATH arrived unchanged".
cat > "$DIR/fakeverify" <<'EOF'
#!/bin/sh
{ env | grep '^FLEET_' | cut -d= -f1 | sort | tr '\n' ' '
  echo
  printf 'PATH=%s\n' "$PATH"
  # M1 (2026-09-06): the clean-path gate runs inside a hold the SERVER took before spawning this
  # chain. The variable alone proves nothing — e2e-stage.sh honours it only when the lock on disk
  # names that same pid — so both halves are recorded and the check compares them.
  printf 'HELD_BY=%s\n' "${FLEET_SUITE_LOCK_HELD_BY:-none}"
  # same default e2e-stage.sh and server.ts both use when the knob is unset — this instance does
  # not set it, so a /nonexistent fallback would report "none" for a lock that is genuinely held
  printf 'LOCKPID=%s\n' "$(cat "${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}/pid" 2>/dev/null || echo none)"
} > "$0.env"
echo "verify OK"
exit 0
EOF
chmod +x "$DIR/fakeverify"

# merge-agent stand-in — clean lands NEVER consult it (the server resolves clean rebases itself); this
# is only a safety net so an accidental conflict blocks rather than spawning a real claude.
cat > "$DIR/fakemerge" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"status\\": \\"blocked\\", \\"detail\\": \\"no agent in the clean-review harness\\"}"}'
EOF
chmod +x "$DIR/fakemerge"

# Reap servers a SIGKILLed earlier run left behind — the one abort path the EXIT trap cannot
# cover, keyed on owner-PID liveness so a concurrent run is never touched. Full rationale (and
# the measurements for the signals the trap DOES handle) at the same block in e2e-isolated.sh.
TMUX_SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
for _s in "$TMUX_SOCKDIR"/fleetcrtest*; do
  [ -S "$_s" ] || continue
  _own="${_s##*/fleetcrtest}"
  case "$_own" in ''|*[!0-9]*) continue ;; esac
  [ "$_own" = "$$" ] && continue
  kill -0 "$_own" 2>/dev/null && continue
  tmux -L "fleetcrtest$_own" kill-server 2>/dev/null
done

# unique-per-run socket: without this trap an interrupted run would leak its tmux server forever
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

# wait for the server to actually bind (a loaded dev box can take >2s) instead of a fixed sleep —
# this suite runs in the pre-land gate, where a slow boot would read as a red gate. ANY HTTP status
# means it's listening (401 without a token still proves the port is up). `_hc`, not `code` — `code`
# carries the harness's exit status.
# --max-time bounds each attempt: this loop runs under the suite mutex, and a port that accepts and
# never answers would otherwise hold it until the outer timeout (e2e/verify-queue.ts §2d).
wait_bound() {
  _phase="$1"
  _hc=000
  for _ in $(seq 1 60); do
    _hc=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
    [ "$_hc" != "000" ] && break
    sleep 0.5
  done
  if [ "$_hc" = "000" ]; then
    stage_server_start_failed "e2e-clean-review.sh" "$_phase" "$DIR"
    return 3
  fi
  sleep 0.5
}

# FLEET_SUITE_LOCK_HELD_BY: this server runs INSIDE the hold this wrapper is already holding, and
# saying so is load-bearing since M1 (2026-09-06). The land gate's clean path now takes the suite
# mutex IN THE SERVER before it spawns the gate — and this wrapper holds that very lock for its
# whole run, so without this the server would queue behind its own runner and every clean land in
# this suite would die `waitedOut` (measured: e2e-clean-review.sh hung at waitMerge for its full
# 60 s, 2026-09-06). This is the SAME hand-down e2e-stage.sh already honours for its own steps, in
# the same direction: the variable grants nothing on its own — server.ts checks that the lock file
# on disk names this pid and that the process is alive, exactly as the shell does.
# `$_st_lock_pid`, NOT `$$` (2026-09-07): inside the LAND GATE this wrapper is itself an inherited
# step — the lock on disk names the live server (e2e-stage.sh#_st_inherited), so a server told
# `$$` fails the "lock file names this pid" check, queues behind the outer hold and every clean
# land here dies at waitMerge after 60 s. Measured on the first code land after M1 was deployed
# (slot 1, 2026-09-07 04:24) and reproduced under a simulated holder; the variable e2e-stage.sh
# resolved is the holder the shell already proved, whichever of the two cases applies.
# FLEET_AUTO_REVIEW_MS=0 turns the auto-③ tick OFF here: this harness configures no
# FLEET_REVIEW_CMD stand-in, so an auto-review of a done-looking lane would spawn a REAL
# claude session. Auto-③ is proven in the main suite, which has the stand-in.
stage_await_server_gone "$SOCK" "$PORT"   # §11.2i: the kill-server above may still be dying
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_SUITE_LOCK_HELD_BY=$_st_lock_pid FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_DISK_MIN_FREE_GIB=0.001 FLEET_DISK_WRITER_GIB=0.001 FLEET_AUTO_REVIEW_MS=0 FLEET_BRIEF_MS=0 FLEET_DELIVERY_BUNDLE_SEC=0 FLEET_CARD_MS=0 FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_CLEAN_REVIEW=off exec bun server.ts >> server.log 2>&1"
wait_bound "boot (FLEET_CLEAN_REVIEW=off)" || exit $?

cd "$DIR" || exit 1
# FLEET_E2E_SUITE labels this run's trail rows (e2e/trail-emit.ts), which otherwise default to
# "isolated".
FLEET_E2E_SUITE=clean-review FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_DISK_MIN_FREE_GIB=0.001 FLEET_DISK_WRITER_GIB=0.001 bun fleet-e2e-clean-review.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

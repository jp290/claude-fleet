#!/bin/sh
# Dedicated e2e for the OPT-IN clean-path advisory reviewer (② / FLEET_CLEAN_REVIEW). It needs the
# server booted with the flag ON, which would route EVERY clean-land in the main suite through the
# reviewer — so it lives here, isolated (own $$ socket/port/dir), and the main suite keeps proving the
# DEFAULT-OFF behaviour untouched. Proves: a "review" verdict downgrades a clean+green auto-land to a
# stop-and-review; "ok" lets it land; a BROKEN reviewer fails CLOSED (stops, never lands). Then reboots
# the same instance with FLEET_CLEAN_REVIEW=shadow and proves the powerless mode: every verdict —
# including would_stop and a broken reviewer — still lands, and is only RECORDED on the outcome row.
#   ./e2e-clean-review.sh
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR derived from $$ so concurrent runs never collide. The port base comes from the
# PORT BAND TABLE in e2e-isolated.sh — never pick one here.
DIR="${TMPDIR:-/tmp}/fleet-e2e-cleanreview-instance-$$"
SOCK="fleetcrtest$$"
PORT=$((13000 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
# Instance contents are DERIVED from the entry files' imports — rule in e2e-stage.sh. The shared
# e2e/ plumbing this harness now imports (harness.ts, lane-helpers.ts, trail-emit.ts) rides in as
# a transitive import; this wrapper names none of it.
. "$SRC/e2e-stage.sh"
stage_instance "$SRC" "$DIR" server.ts fleet-e2e-clean-review.ts || exit 1

# green verify stand-in (no sabotage marker → clean+green → the reviewer is what decides the land)
cat > "$DIR/fakeverify" <<'EOF'
#!/bin/sh
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

# clean-review stand-in: a mode file next to the test repo steers the verdict per run.
#   ok (default) — {"verdict":"ok"} · review — {"verdict":"review"} · garbage — non-JSON (fail-closed)
#   flood — a non-JSON answer far longer than the persisted-answer cap (truncation)
#   silent — no answer at all + nonzero exit (the timeout/spawn-failure shape)
# The prose* modes are the SHAPE THE REAL MODEL PRODUCES (5 of the first 6 production shadow rows): a
# valid verdict object wrapped in a one-sentence preamble. proseok/prosereview must be rescued;
# prosejunk (wrapped object, verdict value not in the contract) must still fail closed.
# It also DUMPS the prompt it received next to the mode file: the pure-function tests prove the builder
# renders its sections, but only the received prompt proves the SERVER filled them from reality (the
# git-computed fork fact, the lane's brief, the other lanes in flight).
cat > "$DIR/fakecleanreview" <<'EOF'
#!/bin/sh
cat > "$(dirname "$(dirname "$PWD")")/lastcleanreviewprompt"
ctl="$(dirname "$(dirname "$PWD")")/cleanreviewmode"
mode="$(cat "$ctl" 2>/dev/null || echo ok)"
case "$mode" in
  review)  printf '{"result": "{\\"verdict\\": \\"review\\", \\"reason\\": \\"lane removed renderWidget which main now calls\\"}"}' ;;
  garbage) printf 'not json at all — exercises the server fail-closed path' ;;
  flood)   i=0; while [ $i -lt 600 ]; do printf 'XXXXXXXXXX'; i=$((i+1)); done ;;
  silent)  exit 1 ;;
  proseok) printf '{"result": "Confirmed: main gained no commits since this lane forked.\\n\\n{\\"verdict\\": \\"ok\\", \\"reason\\": \\"no second side to collide with\\"}"}' ;;
  prosereview) printf '{"result": "One thing stands out on a closer read.\\n\\n{\\"verdict\\": \\"review\\", \\"reason\\": \\"lane deletes a helper main still calls\\"}\\n\\nWorth a human look."}' ;;
  prosejunk) printf '{"result": "I could not settle this one.\\n\\n{\\"verdict\\": \\"maybe\\", \\"reason\\": \\"unsure\\"}"}' ;;
  *)       printf '{"result": "{\\"verdict\\": \\"ok\\", \\"reason\\": \\"no cross-change collision found\\"}"}' ;;
esac
EOF
chmod +x "$DIR/fakecleanreview"

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
# means it's listening (401 without a token still proves the port is up). A function, not an inline
# loop: this harness boots srv TWICE (gate phase, then the shadow-phase restart) and the two waits
# must not be able to drift. `_hc`, not `code` — `code` carries the harness's exit status.
wait_bound() {
  for _ in $(seq 1 60); do
    _hc=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
    [ "$_hc" != "000" ] && break
    sleep 0.5
  done
  sleep 0.5
}

# FLEET_AUTO_REVIEW_MS=0 turns the auto-③ tick OFF here: this harness configures no
# FLEET_REVIEW_CMD stand-in, so an auto-review of a done-looking lane would spawn a REAL
# claude session. Auto-③ is proven in the main suite, which has the stand-in.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_AUTO_REVIEW_MS=0 FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_CLEAN_REVIEW=1 FLEET_CLEAN_REVIEW_CMD='$DIR/fakecleanreview' exec bun server.ts >> server.log 2>&1"
wait_bound

cd "$DIR" || exit 1
echo "--- phase: gate (FLEET_CLEAN_REVIEW=1) ---"
# FLEET_E2E_SUITE labels this run's trail rows (e2e/trail-emit.ts), which otherwise default to
# "isolated". BOTH phases carry the same label on purpose: they are one suite, they run as two
# processes so they already get two distinct run ids, and every shadow-phase check name is
# prefixed "shadow: " — so the phase is legible from the rows without a second suite name.
FLEET_E2E_SUITE=clean-review FLEET_PORT=$PORT FLEET_SOCK=$SOCK bun fleet-e2e-clean-review.ts
code=$?

# Phase 2: the SAME instance rebooted with FLEET_CLEAN_REVIEW=shadow. A restart (not a second server)
# keeps one socket/port/state file, so the shadow phase reuses the same token, test repo and outcome
# journal — and the reused journal is exactly what lets phase 2 assert that the gate-phase land it can
# still see carries no shadow verdict.
if [ "$code" = 0 ]; then
  tmux -L "$SOCK" kill-session -t srv 2>/dev/null
  tmux -L "$SOCK" new-session -d -s srv \
    "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_AUTO_REVIEW_MS=0 FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_CLEAN_REVIEW=shadow FLEET_CLEAN_REVIEW_CMD='$DIR/fakecleanreview' exec bun server.ts >> server.log 2>&1"
  wait_bound
  echo "--- phase: shadow (FLEET_CLEAN_REVIEW=shadow) ---"
  FLEET_E2E_SUITE=clean-review FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CR_PHASE=shadow bun fleet-e2e-clean-review.ts
  code=$?
fi

tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

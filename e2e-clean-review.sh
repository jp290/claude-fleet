#!/bin/sh
# Dedicated e2e for the OPT-IN clean-path advisory reviewer (② / FLEET_CLEAN_REVIEW). It needs the
# server booted with the flag ON, which would route EVERY clean-land in the main suite through the
# reviewer — so it lives here, isolated (own $$ socket/port/dir), and the main suite keeps proving the
# DEFAULT-OFF behaviour untouched. Proves: a "review" verdict downgrades a clean+green auto-land to a
# stop-and-review; "ok" lets it land; a BROKEN reviewer fails CLOSED (stops, never lands).
#   ./e2e-clean-review.sh
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR derived from $$ so concurrent runs never collide (own port band, distinct from the
# other suites so the three can't hit each other either)
DIR="${TMPDIR:-/tmp}/fleet-e2e-cleanreview-instance-$$"
SOCK="fleetcrtest$$"
PORT=$((13000 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/fleet-e2e-clean-review.ts" "$SRC/public" "$SRC/package.json" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

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
#   ok (default) — {"verdict":"ok"} · review — {"verdict":"review"} · garbage — non-JSON (fail-closed).
cat > "$DIR/fakecleanreview" <<'EOF'
#!/bin/sh
cat >/dev/null
ctl="$(dirname "$(dirname "$PWD")")/cleanreviewmode"
mode="$(cat "$ctl" 2>/dev/null || echo ok)"
case "$mode" in
  review)  printf '{"result": "{\\"verdict\\": \\"review\\", \\"reason\\": \\"lane removed renderWidget which main now calls\\"}"}' ;;
  garbage) printf 'not json at all — exercises the server fail-closed path' ;;
  *)       printf '{"result": "{\\"verdict\\": \\"ok\\", \\"reason\\": \\"no cross-change collision found\\"}"}' ;;
esac
EOF
chmod +x "$DIR/fakecleanreview"

# unique-per-run socket: without this trap an interrupted run would leak its tmux server forever
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_CLEAN_REVIEW=1 FLEET_CLEAN_REVIEW_CMD='$DIR/fakecleanreview' exec bun server.ts >> server.log 2>&1"
sleep 2

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK bun fleet-e2e-clean-review.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

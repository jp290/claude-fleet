#!/bin/sh
# FIRE-DRILL #3 — ② clean-review, seeded-defect test.
# Cribbed from e2e-clean-review.sh, with ONE deliberate difference: no FLEET_CLEAN_REVIEW_CMD.
# That makes server.ts:3500-3502 fall through to summaryViaSession(... MERGE_TOOLS ...), i.e. the
# REAL model through the REAL prompt/parser. Everything else stays isolated: own $$ socket/port/dir,
# FLEET_CMD=true (lane panes are inert), FLEET_AUTO_REVIEW_MS=0 (no auto-③ spawning agents),
# green verify stand-in (so the reviewer is the only thing deciding anything).
#   ./drill-3.sh /path/to/claude-fleet
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
# lives in <checkout>/drills/, so the checkout is one level up — an explicit arg still wins
SRC="${1:-$(cd "$HERE/.." && pwd)}"
DIR="${TMPDIR:-/tmp}/fleet-drill3-$$"
SOCK="fleetdrill$$"
# Port band 17400-19399, clear of every suite's: isolated 8800-10799, claude-gate 10800-12799,
# clean-review 13000-14999, security 15200-17199. This started at 15000 and OVERLAPPED security
# by 1800 ports — harmless while security ran nowhere, and live the moment it entered the gate
# (58203f2), because the gate runs on every lane verify while a drill takes minutes.
PORT=$((17400 + $$ % 2000))

[ -f "$SRC/server.ts" ] || { echo "not a fleet checkout: $SRC"; exit 2; }
rm -rf "$DIR"; mkdir -p "$DIR"
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/enhance-prompt.ts" "$SRC/lane-signals.ts" \
      "$SRC/continuity.ts" "$SRC/public" "$SRC/package.json" "$DIR/"
cp "$HERE/drill-3-clean-review.ts" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

# A hand-maintained copy list rots the moment server.ts gains a relative import, and the symptom is
# a boot failure that reads like anything else. It has now happened three times in one evening:
# e2e-security.sh (d146e74), this harness, and it is why fleet-e2e-security.ts's own §5 broke too.
# So the list is CHECKED rather than trusted — derived from server.ts itself, every run.
missing=""
for m in $(grep -oE 'from "\./[A-Za-z0-9_-]+"' "$SRC/server.ts" | sed 's|from "\./||; s|"||' | sort -u); do
  [ -f "$DIR/$m.ts" ] || missing="$missing $m.ts"
done
if [ -n "$missing" ]; then
  echo "FATAL: server.ts imports these, and the drill instance does not have them:$missing"
  echo "Add them to the cp list above. The drill is VOID until then — the server cannot boot."
  exit 2
fi

cat > "$DIR/fakeverify" <<'EOF'
#!/bin/sh
echo "verify OK"
exit 0
EOF
chmod +x "$DIR/fakeverify"

# clean lands never consult the merge agent; this only stops an accidental conflict from
# spawning a real resolver.
cat > "$DIR/fakemerge" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"status\\": \\"blocked\\", \\"detail\\": \\"no resolver in the drill harness\\"}"}'
EOF
chmod +x "$DIR/fakemerge"

# DRILL_SMOKE=1 → MECHANICS ONLY. A stand-in reviewer that always answers "ok" replaces the real
# model, so this run proves the fixture builds, the rebase is CLEAN, the merge drives and the
# outcome row is written — and reveals NOTHING about the judge. Deliberate: discovering a harness
# bug mid-drill would mean re-running against a fixture I had already seen the judge react to,
# which is how pre-registration dies. The smoke verdict is not drill data and is never adjudicated.
REVIEW_ENV=""
if [ "${DRILL_SMOKE:-}" = "1" ]; then
  cat > "$DIR/fakecleanreview" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"verdict\\": \\"ok\\", \\"reason\\": \\"SMOKE STAND-IN — not a judgment\\"}"}'
EOF
  chmod +x "$DIR/fakecleanreview"
  REVIEW_ENV="FLEET_CLEAN_REVIEW_CMD='$DIR/fakecleanreview'"
  echo "*** SMOKE MODE — stand-in reviewer, mechanics only, NOT the drill ***"
fi

trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

echo "drill instance: $DIR  (socket $SOCK, port $PORT)"
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_AUTO_REVIEW_MS=0 FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_CLEAN_REVIEW=shadow $REVIEW_ENV exec bun server.ts >> server.log 2>&1"
sleep 3

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK bun drill-3-clean-review.ts
code=$?

echo
echo "--- premise check: is the composed tree really type-clean? ---"
# This check MUST be able to fail. It could not: the previous form piped tsc through `head` and
# then `&& echo clean`, and a pipeline's status is the LAST command's — so `head` returning 0 made
# it print "clean" unconditionally, directly underneath five TS6053 errors. A premise check that
# cannot fail is worse than no premise check, because it is quoted as evidence.
if bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler \
     "$DIR/drillrepo/src/policy.ts" "$DIR/drillrepo/src/rules.ts" "$DIR/drillrepo/src/state.ts" \
     "$DIR/drillrepo/src/extra-rules.ts" "$DIR/drillrepo/src/report.ts" > "$DIR/tsc.log" 2>&1; then
  echo "tsc: clean (exit 0) — the seeded defects are invisible to the type gate, as designed"
else
  echo "tsc: FAILED (exit $?) — THE DRILL IS VOID, do not adjudicate its verdict."
  echo "Either the seeded defects are NOT gate-invisible (so they test the gate, not the judge),"
  echo "or the fixture never got built. First 20 lines:"
  head -20 "$DIR/tsc.log"
  code=2
fi

echo
echo "--- reviewer transcript hint ---"
echo "server log: $DIR/server.log"
echo "kept for inspection: $DIR"
tmux -L "$SOCK" kill-server 2>/dev/null
exit $code

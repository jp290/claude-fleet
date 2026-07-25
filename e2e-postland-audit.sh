#!/bin/sh
# Dedicated e2e for VERIFICATION TIER 2 — the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD).
# It needs the server booted with FLEET_POSTLAND_AUDIT_CMD set, which would fire an audit after EVERY
# land in the main suite — so it lives here, isolated (own $$ socket/port/dir), and the main suite
# keeps proving the DEFAULT-OFF behaviour untouched.
#   ./e2e-postland-audit.sh
set -u
SRC="$(cd "$(dirname "$0")" && pwd)"
# SOCK/PORT/DIR derived from $$ so concurrent runs never collide (own port band, distinct from the
# other three suites so none of them can hit each other either)
DIR="${TMPDIR:-/tmp}/fleet-e2e-postland-instance-$$"
SOCK="fleetplatest$$"
PORT=$((15000 + $$ % 2000))

rm -rf "$DIR"
mkdir -p "$DIR"
cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/enhance-prompt.ts" "$SRC/lane-signals.ts" "$SRC/fleet-e2e-postland-audit.ts" "$SRC/public" "$SRC/package.json" "$DIR/"
ln -s "$SRC/node_modules" "$DIR/node_modules"

# green verify stand-in (no sabotage marker → clean+green → the lane auto-lands, which is what the
# audit hangs off)
cat > "$DIR/fakeverify" <<'EOF'
#!/bin/sh
echo "verify OK"
exit 0
EOF
chmod +x "$DIR/fakeverify"

# merge-agent stand-in — clean lands NEVER consult it (the server resolves clean rebases itself);
# this is only a safety net so an accidental conflict blocks rather than spawning a real claude.
cat > "$DIR/fakemerge" <<'EOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"status\\": \\"blocked\\", \\"detail\\": \\"no agent in the post-land audit harness\\"}"}'
EOF
chmod +x "$DIR/fakemerge"

# stand-in SUITE (FLEET_POSTLAND_AUDIT_CMD). The real one is ./e2e-isolated.sh — minutes long, boots
# its own server on its own $$-derived socket. This one answers in the same currency (exit code +
# output tail) in milliseconds, so the harness never launches a real nested suite run.
# Every invocation appends one evidence line to $DIR/auditruns BEFORE doing anything else:
#   pwd    — proves WHERE it ran (must be a scratch dir, never the repo or a worktree of it)
#   files  — proves WHAT it ran against (the landed tree's tracked content)
#   recur  — FLEET_POSTLAND_AUDIT_CMD as inherited: must be EMPTY, or a nested suite would audit
#            its own lands forever
#   token  — FLEET_TOKEN as inherited: must be empty (tmux bakes its env into every pane)
#   cr     — FLEET_CLEAN_REVIEW as inherited: must be empty. The LIVE srv runs with `shadow`,
#            and a nested suite inheriting it would spawn REAL model sessions on every clean
#            land inside the audit — which is why the server strips FLEET_* wholesale
#   path   — a non-FLEET var, kept: stripping the whole env would leave the suite without bun
# A lock file makes concurrency a FACT rather than an inference: a run that starts while another is
# in flight writes OVERLAP, which no correct server can ever produce.
# Modes, steered by $DIR/auditmode:
#   green (default) — exit 0 · red — a failure tail + exit 1 · slow — 6s, for the coalescing test
#   decline — the reserved skip exit (42) · notrunnable — exec a missing binary (exit 127)
#   hang — 30s, longer than FLEET_POSTLAND_AUDIT_TIMEOUT_MS, so the server's kill path is exercised
cat > "$DIR/fakeaudit" <<'EOF'
#!/bin/sh
d="$(dirname "$0")"
mode="$(cat "$d/auditmode" 2>/dev/null || echo green)"
[ -f "$d/auditbusy" ] && echo "OVERLAP" >> "$d/auditruns"
: > "$d/auditbusy"
echo "run pwd=$PWD files=$(ls | tr '\n' ',') recur=[${FLEET_POSTLAND_AUDIT_CMD:-}] token=[${FLEET_TOKEN:-}] cr=[${FLEET_CLEAN_REVIEW:-}] path=[${PATH:+set}] mode=$mode" >> "$d/auditruns"
case "$mode" in
  red)         rm -f "$d/auditbusy"; echo "FAIL  post-land audit sabotage check"; echo "3 FAILURES"; exit 1 ;;
  decline)     rm -f "$d/auditbusy"; echo "audit skipped: this stand-in declines to verify that tree"; exit 42 ;;
  notrunnable) rm -f "$d/auditbusy"; exec "$d/no-such-audit-binary" ;;
  slow)        sleep 6 ;;
  hang)        sleep 30 ;;
esac
rm -f "$d/auditbusy"
echo "ALL PASS"
exit 0
EOF
chmod +x "$DIR/fakeaudit"

# clean-review stand-in. The harness boots with FLEET_CLEAN_REVIEW=shadow ON PURPOSE — it mirrors the
# live srv-spawn line, and it is what makes the "the audit child inherits no FLEET_* knob" check a
# statement about production rather than about a synthetic variable. Shadow gates nothing.
cat > "$DIR/fakecleanreview" <<'CREOF'
#!/bin/sh
cat >/dev/null
printf '{"result": "{\\"verdict\\": \\"ok\\", \\"reason\\": \\"stand-in\\"}"}'
CREOF
chmod +x "$DIR/fakecleanreview"

# unique-per-run socket: without this trap an interrupted run would leak its tmux server forever
trap 'tmux -L "$SOCK" kill-server 2>/dev/null' EXIT
tmux -L "$SOCK" kill-server 2>/dev/null

# FLEET_AUTO_REVIEW_MS=0 turns the auto-③ tick OFF here: this harness configures no FLEET_REVIEW_CMD
# stand-in, so an auto-review of a done-looking lane would spawn a REAL claude session.
# FLEET_POSTLAND_AUDIT_TIMEOUT_MS=10000 is the server's own floor (Math.max(10_000, …)) — the `hang`
# mode sleeps well past it.
tmux -L "$SOCK" new-session -d -s srv \
  "cd '$DIR' && FLEET_HOST=127.0.0.1 FLEET_PORT=$PORT FLEET_SOCK=$SOCK FLEET_AUTO_REVIEW_MS=0 FLEET_CMD=true FLEET_VERIFY_CMD='$DIR/fakeverify' FLEET_MERGE_CMD='$DIR/fakemerge' FLEET_POSTLAND_AUDIT_CMD='$DIR/fakeaudit' FLEET_POSTLAND_AUDIT_TIMEOUT_MS=10000 FLEET_CLEAN_REVIEW=shadow FLEET_CLEAN_REVIEW_CMD='$DIR/fakecleanreview' exec bun server.ts >> server.log 2>&1"
# wait for the server to actually bind instead of a fixed sleep
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null)
  [ "$code" != "000" ] && break
  sleep 0.5
done
sleep 0.5

cd "$DIR" || exit 1
FLEET_PORT=$PORT FLEET_SOCK=$SOCK bun fleet-e2e-postland-audit.ts
code=$?

tmux -L "$SOCK" kill-server 2>/dev/null
if [ "$code" = 0 ]; then rm -rf "$DIR"; else echo "kept test instance for inspection: $DIR"; fi
exit $code

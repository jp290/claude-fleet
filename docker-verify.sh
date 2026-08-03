#!/bin/sh
# Build the container image and run the full e2e suite INSIDE it. Tails "ALL PASS" on a clean
# run, like every other wrapper here.
#
# WHY THIS IS THE PROOF, and why it is the FIRST thing built. ./e2e-isolated.sh is the only
# machine-checkable statement this repo owns about whether the whole bundle works on a given
# platform — slots, panes, streams, worktrees, the land path, the share gates. It needs no
# Claude credentials and makes no model calls (slots run `true; exec $SHELL` stand-ins, the
# summarizer is a shell stub), so the image is provable before the credential question is even
# opened. Everything downstream — a guest instance, an egress firewall, a second machine — is
# configuration on top of this one result. If this is red, none of it matters yet.
#
# NOT a gate. It needs a container runtime, which no lane has; it belongs in nobody's
# VERIFY_CMD and is not in watchdog.sh.
set -u
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE="${FLEET_IMAGE:-claude-fleet:verify}"

# --- machine-wide suite mutex: the SAME /tmp/fleet-e2e.lock e2e-stage.sh takes, with the same
# semantics (mkdir is atomic; the recorded pid decides, so an existing dir does NOT mean a suite
# is running; a dead holder is reaped by the next contender; a pid-LESS dir is a manual park and
# is never reaped). Taken here because a suite running in a container still loads THIS box, and
# two suites on this box reliably poison each other's runs (docs/suite-contention.md) — the VM
# does not make that less true, it makes it worse, since the guest competes for the same cores.
#
# Duplicated rather than sourced, deliberately: e2e/pins.ts pins that sourcing e2e-stage.sh and
# calling stage_instance imply each other, and this script stages nothing — the container IS the
# instance. If a third caller ever needs the lock without staging, the fix is to split it into
# its own e2e-lock.sh that e2e-stage.sh sources too, not a third copy of these lines.
FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"
while ! mkdir "$FLEET_SUITE_LOCK" 2>/dev/null; do
  _hp=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null)
  if [ -n "$_hp" ] && ! kill -0 "$_hp" 2>/dev/null; then
    [ "$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null)" = "$_hp" ] \
      && rm -f "$FLEET_SUITE_LOCK/pid" && rmdir "$FLEET_SUITE_LOCK" 2>/dev/null
    continue
  fi
  echo "waiting for the suite lock (holder pid ${_hp:-none})..."
  sleep 15
done
echo "$$" > "$FLEET_SUITE_LOCK/pid"

command -v docker >/dev/null 2>&1 || { echo "docker: not found"; exit 2; }
docker info >/dev/null 2>&1 || { echo "docker: daemon not reachable (colima start ...?)"; exit 2; }

echo "=== build $IMAGE ==="
# The REAL image, agent and all. Building the proof against a stripped one (INSTALL_CLAUDE=0)
# would prove an image nobody ships — and the CLI install is itself a platform claim worth
# failing loudly here rather than on a guest's first login.
docker build -t "$IMAGE" "$FLEET_DIR" || exit 1

echo
echo "=== ./e2e-isolated.sh inside $IMAGE ==="
# --rm: this container is a measurement, not a deployment. No mounts at all — the suite builds
# its own throwaway git repo inside, which is exactly the isolation being demonstrated.
docker run --rm "$IMAGE" ./e2e-isolated.sh
code=$?

echo
if [ "$code" = 0 ]; then echo "docker-verify: PASS"; else echo "docker-verify: FAIL (exit $code)"; fi
exit "$code"

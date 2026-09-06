#!/bin/sh
# fleet-sync.sh — the FOLLOWER half of the dual-host git transport (docs/dual-host-git-transport.md).
#
# Runs on the machine whose checkout FOLLOWS: it fetches the canonical `main` from the other host,
# fast-forwards this checkout onto it, and builds the client bundle the fast-forward invalidated.
# It is the twin of nothing on the canonical side — the canonical host never runs this file, and
# this file never pushes, never resets and never touches a branch other than `main`.
#
# NO HOST, NO ADDRESS, NO CREDENTIAL — this repository is public. The far side is named only by a
# git REMOTE (`canonical` by default), whose URL lives in this checkout's gitignored .git/config, and
# the key that reaches it lives in the follower user's ~/.ssh. Both are host state, never tracked.
#
#   ./fleet-sync.sh            # fetch from the `canonical` remote, ff `main` onto it, build
#   ./fleet-sync.sh <remote>   # same, from another remote name
#
# WHY FAST-FORWARD AND NOT RESET. A follower that resets throws away whatever the follower's own
# Fleet has committed, and it does it silently. `merge --ff-only` is the same primitive the land
# path itself uses (server.ts, grep `"merge", "--ff-only"`): it moves `main` when `main` has only
# moved on the other side, and it REFUSES — loudly, exit 3 — the moment the two have diverged.
# A divergence is the one event on this rail that a human has to look at, because it means this
# host landed something, and under the standing decision (path b, 2026-09-05) it must not.
#
# WHY THE BUILD IS HERE, AND NOT IN watchdog.sh. `public/*.js` is a gitignored BUILD artifact, so a
# fast-forward moves `src/` and leaves NOTHING behind it: measured on the follower 2026-09-06 04:14,
# `bundleStale {appJsMtime:null, shareJsMtime:null, helperJsMtime:null}` and no `public/*.js` in the
# checkout at all — a board served as HTML with no JS. The obvious other home was watchdog.sh's srv
# spawn, and it was refused: BOTH hosts boot the same watchdog, so a build there would also fire on
# the canonical host, whose bundle is the deploy path's business and nobody else's. This script is
# the only thing that runs on the follower and nowhere else, so this is where the build belongs.
#
# Exit codes: 0 already current or fast-forwarded, with the bundle present or freshly built ·
# 2 fetch failed · 3 diverged or not ff-able · 4 refused a precondition (not on main, dirty tree,
# unknown remote) · 5 the client build failed — and 5 is NOT 4, because by then the fast-forward
# has already happened and stands: the tree moved, only the bundle did not. Every non-zero says
# WHICH, and the build's line says explicitly where main ended up.
set -e
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE="${1:-${FLEET_SYNC_REMOTE:-canonical}}"
cd "$FLEET_DIR"

# = server.ts#BUNDLES, the three the board actually loads. `sh` cannot read that constant, so the
# list is spelled here and the pin in e2e/pins.ts is what keeps the two from drifting apart.
BUNDLES="app.js share.js helper.js"
BUILD_CMD="${FLEET_SYNC_BUILD_CMD:-bun run build}"
if [ -n "${FLEET_SYNC_BUILD_CMD:-}" ]; then BUILD_IS_DEFAULT=0; else BUILD_IS_DEFAULT=1; fi

bundles_present() {
  for _b in $BUNDLES; do
    [ -f "public/$_b" ] || return 1
  done
  return 0
}

# THE DAEMON×PATH SEAM. fleet-sync.service hands this script systemd's own environment, and a user
# manager's PATH has no `$HOME/.bun/bin` in it unless somebody put it there — so `bun run build`
# from the timer is a `command not found` that a terminal run can never reproduce. Both halves are
# paid: the unit names the entry (with its reason beside it), and this script resolves `bun` itself
# so a unit that predates the change still builds. A missing bun is exit 5 in words, never a
# 127 from a subshell.
run_build() {
  _bun="$(command -v bun 2>/dev/null || true)"
  if [ -z "$_bun" ] && [ -x "$HOME/.bun/bin/bun" ]; then _bun="$HOME/.bun/bin/bun"; fi
  if [ -n "$_bun" ]; then
    PATH="$(dirname "$_bun"):$PATH"
    export PATH
  elif [ "$BUILD_IS_DEFAULT" = 1 ]; then
    echo "fleet-sync: no bun on PATH and none at \$HOME/.bun/bin/bun — the default build command '$BUILD_CMD' cannot run"
    return 1
  fi
  sh -c "$BUILD_CMD"
}

git remote get-url "$REMOTE" >/dev/null 2>&1 || {
  echo "fleet-sync: no remote '$REMOTE' in $FLEET_DIR — the follower's URL is host state, add it there"; exit 4; }

branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "main" ] || { echo "fleet-sync: HEAD is on '$branch', not main — refusing"; exit 4; }

# A dirty tree is refused BEFORE the fetch, not after: git's own ff-only would refuse it anyway,
# but then the refusal reads as a transport failure instead of as the local edit it is.
dirty=$(git status --porcelain)
[ -z "$dirty" ] || {
  echo "fleet-sync: worktree not clean — refusing. What is dirty (gitignored files are not shown and never block this):"
  printf '%s\n' "$dirty" | head -5
  exit 4; }

git fetch "$REMOTE" "+refs/heads/main:refs/remotes/$REMOTE/main" || {
  echo "fleet-sync: fetch from '$REMOTE' failed"; exit 2; }

before=$(git rev-parse HEAD)
after=$(git rev-parse "refs/remotes/$REMOTE/main")
if [ "$before" = "$after" ]; then
  # Current, but a bundle can still be absent — a checkout that was cloned or reset without ever
  # being built, which is exactly the state the follower was found in. Nothing to fast-forward is
  # not the same fact as nothing to do.
  if bundles_present; then
    echo "fleet-sync: already current at $(git rev-parse --short HEAD)"
    exit 0
  fi
  echo "fleet-sync: already current at $(git rev-parse --short HEAD), but public/ has no client bundle — building"
  run_build || {
    echo "fleet-sync: BUILD FAILED ('$BUILD_CMD'); main stands at $(git rev-parse --short HEAD) and the bundle is still missing"
    exit 5; }
  echo "fleet-sync: already current at $(git rev-parse --short HEAD), bundle built"
  exit 0
fi

# `--is-ancestor` first, so a divergence is named as a divergence rather than as a merge error.
git merge-base --is-ancestor "$before" "$after" || {
  echo "fleet-sync: DIVERGED — local main $(git rev-parse --short "$before") is not an ancestor of $REMOTE/main $(git rev-parse --short "$after"); this host has landed something and must not have"
  exit 3; }

git merge --ff-only "refs/remotes/$REMOTE/main"
run_build || {
  echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after") SYNCED, then BUILD FAILED ('$BUILD_CMD') — the checkout has moved and its bundle has not"
  exit 5; }
echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after"), bundle built"

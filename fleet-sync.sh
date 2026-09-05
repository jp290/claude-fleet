#!/bin/sh
# fleet-sync.sh — the FOLLOWER half of the dual-host git transport (docs/dual-host-git-transport.md).
#
# Runs on the machine whose checkout FOLLOWS: it fetches the canonical `main` from the other host
# and fast-forwards this checkout onto it. It is the twin of nothing on the canonical side — the
# canonical host never runs this file, and this file never pushes, never resets and never touches a
# branch other than `main`.
#
# NO HOST, NO ADDRESS, NO CREDENTIAL — this repository is public. The far side is named only by a
# git REMOTE (`canonical` by default), whose URL lives in this checkout's gitignored .git/config, and
# the key that reaches it lives in the follower user's ~/.ssh. Both are host state, never tracked.
#
#   ./fleet-sync.sh            # fetch from the `canonical` remote, ff `main` onto it
#   ./fleet-sync.sh <remote>   # same, from another remote name
#
# WHY FAST-FORWARD AND NOT RESET. A follower that resets throws away whatever the follower's own
# Fleet has committed, and it does it silently. `merge --ff-only` is the same primitive the land
# path itself uses (server.ts, grep `"merge", "--ff-only"`): it moves `main` when `main` has only
# moved on the other side, and it REFUSES — loudly, exit 3 — the moment the two have diverged.
# A divergence is the one event on this rail that a human has to look at, because it means this
# host landed something, and under the standing decision (path b, 2026-09-05) it must not.
#
# Exit codes: 0 already current or fast-forwarded · 2 fetch failed · 3 diverged or not ff-able ·
# 4 refused a precondition (not on main, dirty tree, unknown remote). Every non-zero says WHICH.
set -e
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE="${1:-${FLEET_SYNC_REMOTE:-canonical}}"
cd "$FLEET_DIR"

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
[ "$before" = "$after" ] && { echo "fleet-sync: already current at $(git rev-parse --short HEAD)"; exit 0; }

# `--is-ancestor` first, so a divergence is named as a divergence rather than as a merge error.
git merge-base --is-ancestor "$before" "$after" || {
  echo "fleet-sync: DIVERGED — local main $(git rev-parse --short "$before") is not an ancestor of $REMOTE/main $(git rev-parse --short "$after"); this host has landed something and must not have"
  exit 3; }

git merge --ff-only "refs/remotes/$REMOTE/main"
echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after")"

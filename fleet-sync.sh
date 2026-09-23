#!/bin/sh
# fleet-sync.sh — the FOLLOWER half of the dual-host git transport (docs/dual-host-git-transport.md).
#
# Runs on the machine whose checkout FOLLOWS: it fetches the canonical `main` from the other host,
# fast-forwards this checkout onto it, resolves the dependencies that fast-forward brought, builds
# the client bundle it invalidated, and asks this host's own Fleet instance to pull its srv onto
# the new code. It is the twin of nothing on the canonical side — the canonical host never runs
# this file, and this file never pushes, never resets and never touches a branch other than `main`.
#
# NO HOST, NO ADDRESS, NO CREDENTIAL — this repository is public. The far side is named only by a
# git REMOTE (`canonical` by default), whose URL lives in this checkout's gitignored .git/config, and
# the key that reaches it lives in the follower user's ~/.ssh. Both are host state, never tracked.
#
#   ./fleet-sync.sh            # fetch from `canonical`, ff `main`, install, build, ask for a deploy
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
# WHY IT ALSO INSTALLS, AND WHY IT ASKS FOR A DEPLOY. Measured on the follower 2026-09-23 00:4x:
# every sync since 2026-09-22 10:12 ended `SYNCED, then BUILD FAILED` because a fast-forward had
# brought a new dependency (`@xterm/addon-web-links`) that no `bun install` ever followed, and the
# board served an app.js from 2026-09-21 21:24 over a srv process from 2026-09-20 15:13 — three
# different versions of the same instance on one screen. A fetch carries `package.json` and the
# lockfile and NOTHING that resolves them, so the install belongs on the same rail as the build,
# ahead of it; and a bundle that is current in front of a server process that is not is the same
# lie one layer up, so a green build asks this host's OWN instance to pull its srv forward through
# `POST /api/deploy` — the route, never a kill: only the route knows whether a land or an audit is
# mid-flight, and its 409 is an answer ("later"), not a failure.
#
# Exit codes: 0 already current or fast-forwarded, with the bundle present or freshly built and the
# deploy accepted, deferred or not applicable · 2 fetch failed · 3 diverged or not ff-able ·
# 4 refused a precondition (not on main, dirty tree, unknown remote) · 5 the client build failed ·
# 6 the dependency install failed · 7 the deploy this host asked its own instance for could not be
# made — and 5, 6 and 7 are NOT 4, because by then the fast-forward has already happened and
# stands: the tree moved, only what had to follow it did not. Every non-zero says WHICH, and the
# build's line says explicitly where main ended up.
set -e
FLEET_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE="${1:-${FLEET_SYNC_REMOTE:-canonical}}"
cd "$FLEET_DIR"

# THE STATUS LINE (docs/messungen/2026-09-23-zwei-geraete-board-und-queue.md §K2). The journal and
# the unit's `failed` state are readable only by a human on THIS host; the other host's board sees
# nothing of this machine but the checkout itself. So every run — every exit, caught by the EXIT
# trap rather than sprinkled beside each `exit` — leaves one JSON line in the checkout: time in ms,
# the exit code, the HEAD the run ended on. Three properties are the contract, each with a reason:
#   · the exit code is NOT the trap's to change, twice over: the code is captured into _sc BEFORE
#     errexit is dropped — `set +e` itself zeroes $?, measured on sh, bash and dash — and no `exit`
#     runs inside the trap, because a failing command under `set -e` would re-kill the shell with
#     status 1 and silently rewrite a 5 into a 1 (both measured on this exact script shape).
#   · atomic through tmp+rename in the same directory: a reader never sees a half-written line.
#   · the file and its tmp leftovers are gitignored: a status the next run refused as a dirty tree
#     would be a sensor that breaks the thing it watches.
now_ms() {
  _t="$(date +%s%N 2>/dev/null)" || true
  case "$_t" in
    ?????????????*) printf '%.13s\n' "$_t" ;;  # %N: nanoseconds, cut to milliseconds
    *) echo "$(( $(date +%s) * 1000 ))" ;;     # no %N: seconds in ms clothing
  esac
}
fleet_sync_status() {
  _sc=$?
  set +e
  _sh="$(git rev-parse HEAD 2>/dev/null)"
  _sp="$FLEET_DIR/.fleet-sync-status.json.tmp.$$"
  printf '{"at":%s,"exit":%s,"head":"%s"}\n' "$(now_ms)" "$_sc" "$_sh" > "$_sp" \
    && mv -f "$_sp" "$FLEET_DIR/.fleet-sync-status.json" \
    || rm -f "$_sp"
}
trap fleet_sync_status EXIT

# = server.ts#BUNDLES, the three the board actually loads. `sh` cannot read that constant, so the
# list is spelled here and the pin in e2e/pins.ts is what keeps the two from drifting apart.
BUNDLES="app.js share.js helper.js hub.js"
BUILD_CMD="${FLEET_SYNC_BUILD_CMD:-bun run build}"
if [ -n "${FLEET_SYNC_BUILD_CMD:-}" ]; then BUILD_IS_DEFAULT=0; else BUILD_IS_DEFAULT=1; fi
# Same shape as the build command and for the same reason: the suite runs the REAL script against a
# throwaway repo pair, where `bun install` has no package.json to read and would fail as itself.
INSTALL_CMD="${FLEET_SYNC_INSTALL_CMD:-bun install --frozen-lockfile}"
if [ -n "${FLEET_SYNC_INSTALL_CMD:-}" ]; then INSTALL_IS_DEFAULT=0; else INSTALL_IS_DEFAULT=1; fi

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
# so a unit that predates the change still builds. A missing bun is exit 5 (or 6) in words, never a
# 127 from a subshell. Both default commands are bun's, so both go through here.
ensure_bun() {
  _bun="$(command -v bun 2>/dev/null || true)"
  if [ -z "$_bun" ] && [ -x "$HOME/.bun/bin/bun" ]; then _bun="$HOME/.bun/bin/bun"; fi
  [ -n "$_bun" ] || return 1
  PATH="$(dirname "$_bun"):$PATH"
  export PATH
}
run_install() {
  if ! ensure_bun && [ "$INSTALL_IS_DEFAULT" = 1 ]; then
    echo "fleet-sync: no bun on PATH and none at \$HOME/.bun/bin/bun — the default install command '$INSTALL_CMD' cannot run"
    return 1
  fi
  sh -c "$INSTALL_CMD"
}
run_build() {
  if ! ensure_bun && [ "$BUILD_IS_DEFAULT" = 1 ]; then
    echo "fleet-sync: no bun on PATH and none at \$HOME/.bun/bin/bun — the default build command '$BUILD_CMD' cannot run"
    return 1
  fi
  sh -c "$BUILD_CMD"
}

# THE DEPLOY HALF. It is deliberately the same door a human uses (`POST /api/deploy`, owner token)
# and not `tmux kill-session -t srv`: the route refuses with 409 while a land is reserved, a
# post-land audit is running or a succession is in flight, and a kill would walk straight through
# all three. A 409 is therefore NOT a failure — the timer comes back in 15 minutes and the state it
# named will have passed. The route builds again before it restarts; that is its own precondition
# and not a reason to skip the build above, which is what makes the bundle current even in the runs
# where the deploy is deferred.
#
# IT ANSWERS A MOVE, NOT A TICK. Only a green build that followed a fast-forward asks; a tick with
# nothing to fetch does not, or the 15-minute timer would restart the board four times an hour. The
# cost is real and named: after a deferred or failed deploy the srv stays behind the tree until the
# NEXT fast-forward asks again. A sensor for that GAP belongs to the instance (`bundleStale`, the
# boot head in GET /api/deploys), not to this script.
#
# The address is resolved exactly as ctl.sh resolves it (FLEET_HOST/FLEET_PORT out of this
# checkout's gitignored .env, else 127.0.0.1:8790) and the credential exactly as ctl.sh reads it
# (the `token` key fleet.json's writer puts first). NO fleet.json means no Fleet instance has ever
# run in this checkout — a bare clone, or the throwaway pair the suite builds — and then there is
# no srv to pull forward: that is a named skip, not a failure.
#
# TOKEN HYGIENE (CLAUDE.md §Self-scheduling): the owner token never reaches curl's argv, where
# `ps` would print it for every account on the box. It travels through curl's config on stdin, and
# no line this function prints ever contains it.
deploy_self() {
  if [ -n "${FLEET_SYNC_DEPLOY_URL:-}" ]; then
    _url=${FLEET_SYNC_DEPLOY_URL%/}
  else
    _host=""; _port=""
    if [ -f "$FLEET_DIR/.env" ]; then
      _host=$(sed -n "s/^FLEET_HOST=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$FLEET_DIR/.env" | tail -1)
      _port=$(sed -n "s/^FLEET_PORT=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$FLEET_DIR/.env" | tail -1)
    fi
    [ -n "$_host" ] || _host=127.0.0.1
    [ -n "$_port" ] || _port=8790
    _url="http://$_host:$_port"
  fi
  if [ ! -f "$FLEET_DIR/fleet.json" ]; then
    echo "fleet-sync: deploy skipped: no fleet.json in $FLEET_DIR — no Fleet instance runs out of this checkout, so no srv is behind the tree"
    return 0
  fi
  _tok=$(sed -n 's/^  "token": "\([^"]*\)".*/\1/p' "$FLEET_DIR/fleet.json" | head -1)
  if [ -z "$_tok" ]; then
    echo "fleet-sync: DEPLOY FAILED: $FLEET_DIR/fleet.json carries no owner token — srv still runs the code from before this sync"
    return 1
  fi
  _body="${TMPDIR:-/tmp}/fleet-sync-deploy.$$"
  # --max-time covers the route's own build (server.ts#DEPLOY_BUILD_TIMEOUT_MS, 300s) plus the
  # answer; a 000 from a curl that never reached one is the same class of failure as a 500 here.
  # curl's own stderr is KEPT, in its own file: on a connection that never opened there is no body
  # and no `reason`, and "Connection refused" is then the only thing that says what happened.
  _code=$(printf 'header = "authorization: Bearer %s"\n' "$_tok" \
    | curl -sS --config - -X POST --max-time 330 -o "$_body" -w '%{http_code}' "$_url/api/deploy" 2>"$_body.err" || true)
  [ -n "$_code" ] || _code=000
  _reason=$(sed -n 's/.*"reason":"\([^"]*\)".*/\1/p' "$_body" 2>/dev/null | head -1)
  [ -n "$_reason" ] || _reason=$(cat "$_body" "$_body.err" 2>/dev/null | head -c 200 | tr '\n' ' ')
  [ -n "$_reason" ] || _reason="no answer, and curl said nothing either"
  rm -f "$_body" "$_body.err"
  case "$_code" in
    2*)
      echo "fleet-sync: deploy accepted by $_url — srv is restarting onto $(git rev-parse --short HEAD); the verdict is written by the next boot (GET /api/deploys)"
      return 0 ;;
    409)
      echo "fleet-sync: deploy deferred: $_reason. The tree and its bundle are current and srv is not; the next sync asks again"
      return 0 ;;
    *)
      echo "fleet-sync: DEPLOY FAILED (HTTP $_code from $_url): $_reason — the tree and its bundle moved, srv did not"
      return 1 ;;
  esac
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
  echo "fleet-sync: already current at $(git rev-parse --short HEAD), but public/ has no client bundle — installing and building"
  # The install goes ahead of EVERY build this script runs, not only the one after a fast-forward:
  # a checkout that never built is also a checkout whose node_modules nobody can vouch for, and a
  # build that dies on a missing dependency would be read as a broken bundler. NOT a deploy,
  # though — the code did not move here, only a missing artifact was produced, and the srv behind
  # it is already running this very commit.
  run_install || {
    echo "fleet-sync: INSTALL FAILED ('$INSTALL_CMD'); main stands at $(git rev-parse --short HEAD) and the bundle is still missing"
    exit 6; }
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
run_install || {
  echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after") SYNCED, then INSTALL FAILED ('$INSTALL_CMD') — the checkout has moved and its dependencies have not, so the build was not attempted"
  exit 6; }
run_build || {
  echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after") SYNCED, then BUILD FAILED ('$BUILD_CMD') — the checkout has moved and its bundle has not"
  exit 5; }
# The sync line is printed BEFORE the deploy is asked for, so the journal says where main ended up
# even in a run whose deploy answer never comes.
echo "fleet-sync: $(git rev-parse --short "$before") -> $(git rev-parse --short "$after"), bundle built"
deploy_self || exit 7

#!/usr/bin/env bash
# steward-arena.sh — launch/teardown a HERMETIC steward "study arena":
# a throwaway SECOND Fleet instance (own socket/port/dir) pointed at CLONES of
# real repos, with a ⚙ steward slot operating it at owner-level reach — so the
# steward can be watched fully unleashed with ZERO blast to the live fleet or the
# real repos. This is shape "A" from the steward-arena design (§3A/§4/§7.1): the
# arena adds NO server.ts logic — it is `server.ts` run with a different env
# against clones, driven via the arena's own throwaway owner token.
#
# The three isolation layers (design §4):
#   1. git-target isolation — the arena only ever operates on CLONES; a land in
#      the arena hits the clone's own main, folgenlos.
#   2. instance isolation — dedicated tmux socket (fleetarena) + an auto-picked
#      free port (probed up from 8901; 8790 and 8899 are hard-forbidden) + a COPIED
#      dir (server.ts reads STATE_FILE = import.meta.dir/fleet.json, so a copied dir
#      gives the arena its OWN fleet.json, never the live one).
#   3. token isolation — a freshly generated throwaway owner token; the steward
#      operating with it can only ever touch this clone instance.
#
# ACCEPTED, DEFERRED RISK (design §4): the arena runs REAL `claude
# --dangerously-skip-permissions`, so its OS-layer reach (files outside the
# clones, network) is real. v1 does NOT add OS sandboxing — that is deferred.
# The guards below contain the *Fleet*-layer blast (the "sessions vanished"
# class), not the OS layer. Keep it pointed at clones + a dedicated
# socket/port/dir, bound to the Tailscale IP and token-gated exactly like the
# live fleet.
#
# Usage:
#   steward-arena.sh up <real-repo-path> [<real-repo-path> ...]
#   steward-arena.sh down
#
# Test hook: set FLEET_ARENA_CMD=true (or any harmless command) to prove the
# launch/teardown spine WITHOUT autonomously spawning a real skip-perms claude —
# the steward's actual autonomous behaviour is out of scope for the launcher.

set -euo pipefail

# --- the reliability spine: dedicated, NEVER-the-live values ------------------
ARENA_HOST="${FLEET_ARENA_HOST:-100.64.0.1}"   # Tailscale IP — watchable from other devices, token-gated
ARENA_PORT=""                                    # NOT fixed: chosen at launch by pick_port() (probe up from PROBE_START)
ARENA_SOCK="${FLEET_ARENA_SOCK:-fleetarena}"     # dedicated tmux socket — NEVER claudefleet
ARENA_CMD="${FLEET_ARENA_CMD:-claude --dangerously-skip-permissions}"  # owner-accepted (see header)
ARENA_ROOT="${FLEET_ARENA_ROOT:-$HOME/.steward-arena}"
POINTER="$ARENA_ROOT/current"                    # records the ARENA_DIR the last `up` stood up

# port auto-discovery: probe from PROBE_START up, skip any port with a listener,
# take the first free one. 8899 is a fixed default on this box that is already held
# by another bun instance, so it is NOT used — the port is picked fresh each `up`.
PROBE_START=8901
PROBE_MAX=9200
# HARD-forbidden regardless of the probe result: 8790 = live fleet, 8899 = the known
# other bun instance. Never bind either even if somehow selected.
FORBIDDEN_PORTS="8790 8899"

# the LIVE instance this guard must never touch
LIVE_SOCK="claudefleet"

SRC="$(cd "$(dirname "$0")" && pwd -P)"          # this repo/worktree: source of server.ts + public

die() { printf 'steward-arena: %s\n' "$*" >&2; exit 1; }
note() { printf 'steward-arena: %s\n' "$*" >&2; }

# --- HARD SAFETY GUARDS (refuse loudly if any live value leaked in) -----------
guard_isolation() {
  [ "$ARENA_SOCK" = "$LIVE_SOCK" ] && die "REFUSING: FLEET_SOCK resolves to the LIVE socket '$LIVE_SOCK'"
  [ -z "$ARENA_SOCK" ] && die "REFUSING: empty FLEET_SOCK"
  return 0
}

# the finally-chosen port must never be a forbidden one — defense in depth: the probe
# already starts above 8790/8899, but this assertion makes the invariant unmissable.
guard_port() {
  local p="$1"
  [ -n "$p" ] || die "REFUSING: no arena port chosen"
  case " $FORBIDDEN_PORTS " in
    *" $p "*) die "REFUSING: port $p is HARD-forbidden (live fleet / known other instance)" ;;
  esac
  return 0
}

# path b is inside dir a?  inside /a /a/b -> true
inside() {
  case "$2/" in "$1"/*) return 0 ;; *) return 1 ;; esac
}

# is a process already LISTENing on port $1 (any bind address)?
port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# probe from PROBE_START up; skip forbidden ports and any with a listener; echo the
# first free one. Non-zero exit if the whole range is exhausted.
pick_port() {
  local p="$PROBE_START"
  while [ "$p" -le "$PROBE_MAX" ]; do
    case " $FORBIDDEN_PORTS " in *" $p "*) p=$((p + 1)); continue ;; esac
    if port_in_use "$p"; then p=$((p + 1)); continue; fi
    printf '%s\n' "$p"
    return 0
  done
  return 1
}

# ============================================================================
# up
# ============================================================================
cmd_up() {
  [ "$#" -ge 1 ] || die "up needs at least one <real-repo-path>"
  guard_isolation

  # a previous arena still recorded? tear it down first so `up` is a clean start.
  if [ -f "$POINTER" ]; then
    note "an earlier arena is recorded — tearing it down before standing up a fresh one"
    cmd_down
  fi

  local stamp; stamp="$(date +%Y%m%dT%H%M%S)"
  local ARENA_DIR="$ARENA_ROOT/$stamp"

  # ARENA_DIR must live OUTSIDE every real repo AND outside this operating repo.
  inside "$SRC" "$ARENA_DIR" && die "REFUSING: ARENA_DIR ($ARENA_DIR) is inside the operating repo ($SRC)"

  mkdir -p "$ARENA_DIR/clones"

  # --- clone each real repo (git-target isolation) --------------------------
  local first_clone="" real name clone_dir
  for repo in "$@"; do
    [ -d "$repo" ] || die "not a directory: $repo"
    real="$(cd "$repo" && pwd -P)"
    git -C "$real" rev-parse --git-dir >/dev/null 2>&1 || die "not a git repo: $real"
    inside "$real" "$ARENA_DIR" && die "REFUSING: ARENA_DIR ($ARENA_DIR) is inside the real repo ($real)"

    name="$(basename "$real")"
    clone_dir="$ARENA_DIR/clones/$name"
    [ -e "$clone_dir" ] && die "REFUSING: two targets named '$name' — clone path collision"
    # the arena target is ALWAYS a clone; assert clone path != the real path.
    [ "$clone_dir" = "$real" ] && die "REFUSING: clone path equals the real repo path"

    note "cloning $real -> $clone_dir"
    git clone --quiet "$real" "$clone_dir" || die "git clone failed for $real"
    [ "$(cd "$clone_dir" && pwd -P)" != "$real" ] || die "REFUSING: clone resolved to the real repo path"
    [ -z "$first_clone" ] && first_clone="$clone_dir"
  done

  # --- steward worktree of the FIRST clone (steward convention) --------------
  # placed INSIDE ARENA_DIR so `down` removes it wholesale.
  local steward_wt="$ARENA_DIR/clones/$(basename "$first_clone").worktrees/steward"
  note "adding steward worktree (branch 'steward') of $first_clone"
  git -C "$first_clone" worktree add --quiet -b steward "$steward_wt" \
    || die "git worktree add failed"

  # --- stand up the isolated instance (e2e-isolated pattern) -----------------
  # every local import of server.ts must ride along — `bun server.ts` dies at module
  # resolution otherwise, before it ever binds a port. Keep in sync with `from "./` in server.ts.
  cp -R "$SRC/server.ts" "$SRC/merge-prompt.ts" "$SRC/lane-signals.ts" "$SRC/public" "$SRC/package.json" "$ARENA_DIR/" \
    || die "failed to copy server.ts + its local modules/public/package.json into ARENA_DIR"
  ln -s "$SRC/node_modules" "$ARENA_DIR/node_modules"

  local token; token="$(openssl rand -hex 24)"
  local bun; bun="$(command -v bun)" || die "bun not found on PATH"

  # --- pick a free arena port (probe up from PROBE_START; skip forbidden+occupied) ---
  ARENA_PORT="$(pick_port)" || die "no free port in $PROBE_START..$PROBE_MAX for the arena"
  guard_port "$ARENA_PORT"
  note "selected free arena port $ARENA_PORT"

  # record the ARENA_DIR before launch so `down` can find it even if boot fails.
  printf '%s\n' "$ARENA_DIR" > "$POINTER"

  # Immediately before launch, re-check the chosen port for a listener — closes the
  # probe→launch race (another process could grab it in the gap). Abort loudly rather
  # than colliding or false-positiving on a foreign server's response.
  port_in_use "$ARENA_PORT" && die "REFUSING: port $ARENA_PORT acquired a listener between probe and launch — rerun"

  note "launching arena: socket=$ARENA_SOCK host=$ARENA_HOST port=$ARENA_PORT cmd='$ARENA_CMD'"
  tmux -L "$ARENA_SOCK" kill-server 2>/dev/null || true
  tmux -L "$ARENA_SOCK" new-session -d -s srv \
    "cd '$ARENA_DIR' && FLEET_HOST=$ARENA_HOST FLEET_PORT=$ARENA_PORT FLEET_SOCK=$ARENA_SOCK FLEET_CMD='$ARENA_CMD' FLEET_TOKEN=$token exec '$bun' server.ts >> arena-server.log 2>&1" \
    || die "tmux new-session failed"

  # --- health-check: prove OUR arena is up (not just any 200 on the port) -----
  # The srv tmux session must stay alive (a bun that dies on EADDRINUSE `exec`s
  # itself away and the session vanishes), the port must serve 200, AND our
  # freshly-minted token must be accepted on an owner route — which a foreign
  # server could never do. All three together = it is genuinely ours.
  # Ceiling is generous (~120s) because a cold bun-transpile of the 215KB
  # server.ts can take tens of seconds on a loaded box; that costs nothing on the
  # failure path because has-session fast-fails the instant a real crash kills srv.
  local base="http://$ARENA_HOST:$ARENA_PORT"
  local code=""
  local i
  for i in $(seq 1 240); do
    tmux -L "$ARENA_SOCK" has-session -t srv 2>/dev/null \
      || die "arena srv session died on boot — likely a bind failure (see $ARENA_DIR/arena-server.log)"
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$base/" 2>/dev/null || echo 000)"
    [ "$code" = "200" ] && break
    sleep 0.5
  done
  [ "$code" = "200" ] || die "arena health-check: $base/ returned '$code' (expected 200; see $ARENA_DIR/arena-server.log)"
  local ourcode
  ourcode="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 -H "authorization: Bearer $token" "$base/api/sessions" 2>/dev/null || echo 000)"
  [ "$ourcode" = "200" ] || die "arena ownership check: our token got '$ourcode' on /api/sessions (expected 200 — is a foreign server on $ARENA_PORT?)"
  note "arena is up and ours: $base/ = 200, /api/sessions accepts the arena token"

  # --- open + label the ⚙ steward slot (arena API + arena token) -------------
  local auth="authorization: Bearer $token"
  local slot=1
  curl -s -X POST -H "$auth" -H 'content-type: application/json' \
    -d "{\"cwd\":\"$steward_wt\"}" "$base/api/slots/$slot/open" >/dev/null \
    || die "opening steward slot failed"
  curl -s -X POST -H "$auth" -H 'content-type: application/json' \
    -d '{"label":"⚙ steward"}' "$base/api/slots/$slot/rename" >/dev/null \
    || die "labelling steward slot failed"

  # --- brief the steward (a starter send) ------------------------------------
  # No double-quotes/backslashes in the text -> safe to inline into JSON.
  local brief="You are the operator of this hermetic clone arena. Arena base URL: $base . Arena owner token: $token . Everything here is a throwaway clone instance — create lanes, drive them, prepare landings, and land freely; nothing here is real, and nothing you do can touch the live fleet or any real repo."
  curl -s -X POST -H "$auth" -H 'content-type: application/json' \
    -d "{\"slot\":$slot,\"text\":\"$brief\",\"submit\":true}" "$base/send" >/dev/null \
    || note "starter brief send failed (slot is open regardless)"

  # --- print the watch URL + teardown ----------------------------------------
  # login route is `/?token=<token>` (server.ts:2703-2712) — it sets the cookie
  # then 302s to a clean `/`.
  printf '\n'
  printf '  arena up ✓  (throwaway clone instance — nothing here is real)\n'
  printf '  watch (sets the auth cookie): %s/?token=%s\n' "$base" "$token"
  printf '  arena dir: %s\n' "$ARENA_DIR"
  printf '  teardown:  %s down\n' "$0"
  printf '\n'
}

# ============================================================================
# down  (idempotent)
# ============================================================================
cmd_down() {
  guard_isolation
  tmux -L "$ARENA_SOCK" kill-server 2>/dev/null || true

  if [ -f "$POINTER" ]; then
    local dir; dir="$(cat "$POINTER")"
    # only ever rm a path under ARENA_ROOT — never anything else.
    if [ -n "$dir" ] && inside "$ARENA_ROOT" "$dir" && [ -d "$dir" ]; then
      rm -rf "$dir"
      note "removed arena dir $dir"
    fi
    rm -f "$POINTER"
  fi
  note "arena torn down (socket $ARENA_SOCK killed)"
}

# ============================================================================
main() {
  local sub="${1:-}"
  case "$sub" in
    up)   shift; cmd_up "$@" ;;
    down) shift; cmd_down ;;
    *)    die "usage: $0 up <real-repo-path> [<real-repo-path> ...] | down" ;;
  esac
}

main "$@"

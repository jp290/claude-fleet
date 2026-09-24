#!/bin/sh
# lane-preview.sh — a TIME-BOXED, ISOLATED test instance of ONE parked review candidate, so the
# owner can look at its stored head before land (docs/messungen/2026-09-23-worktree-lebenszyklus.md
# §3 Karte 2). The server is the only caller (server.ts#startLanePreview / #stopLanePreview): it
# picks the dir, socket and port, holds the start/stop/expiry record, and spawns this script with an
# ALLOWLISTED environment whose HOME is already <dir>/home.
#
#   lane-preview.sh start <worktree> <head> <dir> <host> <port> <sock> <reap-after-sec>   token on stdin
#   lane-preview.sh stop  <dir> <sock>
#   lane-preview.sh reap  <dir> <sock> <sec>        the backstop `start` detaches; not for callers
#
# WHAT IS IN THE COPY. `git archive <head>` — the TRACKED tree of the stored head and nothing else:
# no working-tree file, and none of the gitignored production state (fleet.json, .env, the ledgers,
# CLAUDE.md), which `start` proves absent before anything runs. The same isolation pattern as
# e2e-isolated.sh (own dir, own tmux socket, own port, FLEET_CMD=true) — but NOT its staging:
# sourcing e2e-stage.sh takes the machine-wide SUITE mutex, and a preview is not a suite. It never
# queues for, holds or reports to that mutex, and it is never a verify or land-gate result.
#
# WHAT IS NOT IN THE ENVIRONMENT. The instance gets a fresh token (stdin, never argv), a HOME of its
# own (so ~/.claude, ~/.codex and ~/.config/claude-fleet/secrets are not its to read), FLEET_CMD=true
# (no pane ever starts a harness with the owner's credentials) and every agent command pointed at
# `false`. No owner token, no self-token, no FLEET_* of the live server.
#
# THE CLOCK. The server's timer ends a preview at its deadline; `reap` is the backstop for a server
# that is down at that moment, detached here with the deadline plus a grace. Both end in `stop`,
# which is idempotent. Everything is killed by the preview's OWN socket and by pids this script
# noted itself — never by a name pattern.
set -u

die() { printf 'lane-preview: %s\n' "$*" >&2; exit 1; }

valid_dir() {
  case "$1" in /*) ;; *) return 1 ;; esac
  case "$1" in *"'"*|*' '*) return 1 ;; esac
  basename "$1" | grep -Eq '^fleet-lane-preview-[0-9a-f]{12}$'
}
valid_sock() { printf '%s' "$1" | grep -Eq '^fleetpv[0-9a-f]{12}$'; }

# the preview's own panes first, then its server: a bare kill-server reparents the panes' children
# (e2e-isolated.sh, TEARDOWN REAP). Then the backstop by the pid `start` wrote — its sleep child
# first, captured before the parent dies and orphans it. Last, the copy itself.
stop_preview() {
  _dir="$1"; _sock="$2"
  for _p in $(tmux -L "$_sock" list-panes -a -F '#{pane_pid}' 2>/dev/null); do
    pkill -TERM -P "$_p" 2>/dev/null
    kill -TERM "$_p" 2>/dev/null
  done
  tmux -L "$_sock" kill-server 2>/dev/null
  if [ -f "$_dir/reaper.pid" ]; then
    _rp=$(cat "$_dir/reaper.pid" 2>/dev/null)
    case "$_rp" in ''|*[!0-9]*) _rp="" ;; esac
    if [ -n "$_rp" ] && [ "$_rp" != "$$" ] \
      && ps -o command= -p "$_rp" 2>/dev/null | grep -q 'lane-preview\.sh reap'; then
      _kids=$(pgrep -P "$_rp" 2>/dev/null)
      kill -TERM "$_rp" 2>/dev/null
      for _k in $_kids; do kill -TERM "$_k" 2>/dev/null; done
    fi
  fi
  rm -rf "$_dir"
}

cmd="${1:-}"
case "$cmd" in
  stop)
    [ $# -eq 3 ] || die "usage: stop <dir> <sock>"
    valid_dir "$2" || die "refused: not a preview dir: $2"
    valid_sock "$3" || die "refused: not a preview socket: $3"
    stop_preview "$2" "$3"
    exit 0 ;;
  reap)
    [ $# -eq 4 ] || die "usage: reap <dir> <sock> <sec>"
    valid_dir "$2" && valid_sock "$3" || exit 1
    case "$4" in ''|*[!0-9]*) exit 1 ;; esac
    sleep "$4"
    exec sh "$0" stop "$2" "$3" ;;
  start) ;;
  *) die "usage: start|stop|reap …" ;;
esac

[ $# -eq 8 ] || die "usage: start <worktree> <head> <dir> <host> <port> <sock> <reap-after-sec>"
wt="$2"; sha="$3"; dir="$4"; host="$5"; port="$6"; sock="$7"; reap="$8"
printf '%s' "$sha" | grep -Eq '^[0-9a-f]{40,64}$' || die "refused: head is not a full sha"
valid_dir "$dir" || die "refused: not a preview dir: $dir"
valid_sock "$sock" || die "refused: not a preview socket: $sock"
case "$port" in ''|*[!0-9]*) die "refused: port is not a number" ;; esac
# the live fleet's two addresses are never a preview's, whatever the caller computed
[ "$port" = 8790 ] || [ "$port" = 8899 ] && die "refused: port $port belongs to the live fleet"
case "$reap" in ''|*[!0-9]*) die "refused: reap-after is not a number" ;; esac
case "$host" in ''|0.0.0.0|::|'[::]'|*"'"*|*' '*) die "refused: host must be one named address" ;; esac
[ -e "$dir" ] && die "refused: $dir already exists"
token=$(head -c 256 | tr -d '\n')
printf '%s' "$token" | grep -Eq '^[0-9a-f]{32,64}$' || die "refused: no token on stdin"

fail() { printf 'lane-preview: %s\n' "$*" >&2; stop_preview "$dir" "$sock"; exit 1; }

git -C "$wt" cat-file -e "$sha^{commit}" 2>/dev/null || die "the stored head $sha is not in $wt"
git -C "$wt" cat-file -e "$sha:server.ts" 2>/dev/null && git -C "$wt" cat-file -e "$sha:package.json" 2>/dev/null \
  || die "the stored head has no server.ts/package.json — not a claude-fleet tree, nothing to preview"
mkdir -p "$dir/tree" "$dir/home" || fail "could not create $dir"
git -C "$wt" archive --format=tar "$sha" | tar -x -C "$dir/tree" || fail "git archive of $sha failed"
for f in fleet.json .env lane-outcomes.jsonl post-land-audits.jsonl audit.jsonl fleet-reports.jsonl CLAUDE.md; do
  [ -e "$dir/tree/$f" ] && fail "the stored head TRACKS production file $f — refused to run it"
done
( cd "$dir/tree" && bun install --frozen-lockfile ) >> "$dir/stage.log" 2>&1 \
  || fail "bun install failed: $(tail -n 3 "$dir/stage.log" | tr '\n' ' ')"
( cd "$dir/tree" && bun run build ) >> "$dir/stage.log" 2>&1 \
  || fail "build failed: $(tail -n 3 "$dir/stage.log" | tr '\n' ' ')"

( umask 077 && cat > "$dir/preview.env" <<EOF
FLEET_HOST=$host
FLEET_PORT=$port
FLEET_SOCK=$sock
FLEET_TOKEN=$token
FLEET_INSTANCE=lane-preview
FLEET_CMD=true
FLEET_MODEL=
FLEET_HARNESS_AUTOMATION=0
FLEET_LANE_AUTOCLOSE=0
FLEET_BRIEF_MS=0
FLEET_CARD_MS=0
FLEET_BACKLOG_NUDGE_MS=0
FLEET_AUTO_REVIEW_MS=0
FLEET_SUMMARY_CMD=false
FLEET_ENHANCE_CMD=false
FLEET_MERGE_CMD=false
FLEET_COMMIT_CMD=false
FLEET_REVIEW_CMD=false
FLEET_DIGEST_CMD=false
FLEET_CARD_CMD=false
FLEET_REFINE_CMD=false
FLEET_BRIEF_REVIEW_CMD=false
FLEET_CLEAN_REVIEW_CMD=false
FLEET_CODEX_EXEC_BIN=false
EOF
) || fail "could not write the instance env"
token=""

tmux -L "$sock" new-session -d -s srv \
  "cd '$dir/tree' && set -a && . '$dir/preview.env' && set +a && exec bun server.ts >> '$dir/server.log' 2>&1" \
  || fail "tmux could not start the instance"

# up = the port answers HTTP at all (the login page is 200 or 401 — either is a server)
i=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://$host:$port/" 2>/dev/null)" != "000" ]; do
  i=$((i + 1))
  [ "$i" -ge 90 ] && fail "the instance did not answer on $host:$port within 90 s: $(tail -n 3 "$dir/server.log" 2>/dev/null | tr '\n' ' ')"
  sleep 1
done

nohup sh "$0" reap "$dir" "$sock" "$reap" > /dev/null 2>&1 &
printf '%s\n' "$!" > "$dir/reaper.pid"
printf 'ready %s:%s\n' "$host" "$port"
exit 0

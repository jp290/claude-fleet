#!/bin/sh
# scratch-reap.sh — the owner of the e2e-isolated scratch heap.
#
# WHY THIS FILE EXISTS. e2e-isolated.sh's retention seam is one line: green → `rm -rf "$DIR"`,
# anything else → `echo "kept test instance for inspection: $DIR"`. The keep is DELIBERATE and its
# content is the post-mortem of a red run. So nothing swept here until now, and the heap had a
# sensor (state.sh) but no owner: 47 dirs / 1775 MiB on 2026-09-17, oldest 28 h.
#
# WHAT THE HEAP ACTUALLY CONTAINS — measured 2026-09-17 over all 47 dirs, by joining each dir to
# its trail run (docs/verify-tiering.md §15b carries the table and the method):
#
#   16 dirs  0 MiB     no server.log at all — the instance never booted. No check ever ran, so
#                      there is no verdict and nothing to inspect. Pure litter.
#   22 dirs  ~1000 MiB server.log present, trail run TRUNCATED (1072–4149 rows against ~4800 for
#                      a complete run) or absent — killed mid-run. The wrapper never reached its
#                      own retention decision, so this dir was never deliberately kept.
#    9 dirs  777 MiB   trail run COMPLETE and RED (4717–4836 rows, 1–6 `"ok":false`). This is the
#                      evidence the seam means to keep, and the one class a sweep can destroy.
#    0 dirs            a COMPLETE GREEN run whose `rm -rf` missed. The brief posited this class;
#                      it does not occur. Every surviving dir with a green trail was truncated —
#                      `rm -rf` was never reached, never "missed".
#
# WHY THE RULE IS AGE AND NOT CLASS. Separating "killed mid-run" from "deliberately kept red"
# needs the trail join above (grep server.log for a sibling scratch path → runner pid → trail
# file → row count). That join FAILED on 22 of 40 non-empty dirs, so it cannot carry a deletion.
# A dir therefore gets the benefit of the doubt and is treated as evidence until it ages out.
# The one class exempt is the 16 with no server.log: no server, no check, no verdict, no doubt.
# (docs/verify-tiering.md §15b names the marker that would make the split mechanical for a future
# cut. It is a PROPOSAL there, not built here — it would change the seam's contract.)
#
# THE SAFETY GATE, and why it is liveness and not age. Straight from e2e-isolated.sh's own socket
# reap, which settled this: these wrappers are expressly run CONCURRENTLY, so a live run's pid is
# alive by definition and liveness can never shoot down a neighbour the way an age cutoff can.
# Both halves must hold before anything is removed:
#   - the pid in the dir name is not alive (`kill -0`), AND
#   - no `fleettest<pid>` entry exists in the tmux socket dir.
# The residual failure is the SAFE direction: a dead pid since recycled by an unrelated process
# reads as alive, the dir is skipped, and it survives to the next run. Keeping litter costs disk;
# deleting a live run's instance costs the run.
#
# SCOPE IS TWO GLOBS, deliberately. `fleet-e2e-instance-*` is e2e-isolated.sh's family alone;
# `fleet-testinstanz-*` is testinstanz.sh's family of standing per-worktree instances (2026-09-24).
# The six other wrapper families carry their own infix (gate-, harness-, unprobed-, cleanreview-,
# postland-, security-instance) and are disjoint from both globs, so a post-land audit running
# concurrently cannot have its instance removed by this sweep. THE TWO FAMILIES SHARE A
# PHILOSOPHY, NOT A RULE: the fleet-e2e sweep kills NOTHING — a suite instance is its wrapper's
# child, and the wrapper reaps its own. The testinstanz sweep DOES kill, because a standing
# instance has no wrapper: it is reaped through its own state file — its socket killed by NAME
# (`tmux -L <sock>` from that file), its directory removed, and its noted pid signalled ONLY when
# that pid still HOLDS the port the same file records (`lsof -iTCP:<port> -sTCP:LISTEN -t`):
# expiry is authority over the instance, never over a PID number, which a recycle has since given
# to a stranger. Never pkill, never a name pattern, never a state file without an explicit
# expiresAt (that one is listed and left alone; missing proof of expiry is absence of authority,
# not zero). Nothing else kills a process.
set -u

ROOT="${1:?usage: scratch-reap.sh <root> [--dry-run]}"
DRY=""
[ "${2:-}" = "--dry-run" ] && DRY=1

RETENTION_H="${FLEET_E2E_SCRATCH_RETENTION_H:-48}"
SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
NOW="$(date +%s)"

# BSD and GNU stat disagree and this suite runs on BOTH — locally on the Mac and on the Linux
# helper when a lane offers its preview. MEASURED on both hosts 2026-09-17, because the obvious
# `bsd || gnu` one-liner is WRONG and cost this file a red preview:
#
#   macOS  stat -c %Y → rc=1, stdout EMPTY          stat -f %m → rc=0, the mtime
#   Linux  stat -c %Y → rc=0, the mtime             stat -f %m → rc=1, and it still PRINTS the
#                                                   whole filesystem block to STDOUT
#
# So `stat -f %m "$1" || stat -c %Y "$1"` inside $( ) concatenates Linux's filesystem block with
# the real mtime, the numeric guard below rejects the pair, and every dir is silently kept — a
# reaper that reaps nothing and says nothing. A non-zero exit is therefore NOT enough to discard
# an attempt; only a numeric ANSWER counts. GNU is tried first so neither host reaches the
# polluting call at all.
#
# A dir whose mtime cannot be read is SKIPPED, not swept — but it says so, because that silence
# is exactly what made the bug above look like an empty heap.
_mtime() {
  _mt="$(stat -c %Y "$1" 2>/dev/null)"
  case "$_mt" in ''|*[!0-9]*) _mt="$(stat -f %m "$1" 2>/dev/null)" ;; esac
  case "$_mt" in ''|*[!0-9]*) return 1 ;; esac
  printf '%s\n' "$_mt"
}

# ===== THE TESTINSTANZ FAMILY: expired standing instances, reaped by their state files ==========
#
# Each standing instance (testinstanz.sh, one per worktree) writes /tmp/fleet-testinstanz-<hash>/
# testinstanz.state with its src, port, socket, noted pid and expiresAt. An instance whose
# expiresAt has passed loses pid, socket and directory; every removal is NAMED in one line. A
# state file without a usable expiresAt is an old instance: listed, never touched. The production
# socket is refused even if a state file ever named it (testinstanz.sh already refuses to write
# one — belt and braces). This sweep runs BEFORE the fleet-e2e sweep below so THAT summary stays
# the script's last line, which host-hygiene §e reads.
TI_ROOT="${FLEET_TI_ROOT:-$ROOT}"  # the family is looked up where the caller pointed the sweep —
                                   # e2e-isolated.sh passes the real tmpdir, host-hygiene §e its
                                   # fixture root; /tmp is only the family's own default
TI_REALTMP="${TMPDIR:-/tmp}"          # the socket lives under the REAL tmpdir, never a fixture's
TI_REAPED=0; TI_OPEN=0; TI_OLD=0
for _ts in "$TI_ROOT"/fleet-testinstanz-*/testinstanz.state; do
  [ -f "$_ts" ] || continue                            # no glob match → the pattern itself
  _td="$(dirname "$_ts")"
  _tg() { sed -n "s/^$1=//p" "$_ts" | head -1; }
  _tp="$(_tg pid)"; _tk="$(_tg sock)"; _te="$(_tg expiresAt)"; _to="$(_tg port)"
  case "$_te" in
    '') echo "[testinstanz-reap] kept $_td — state has no expiresAt (old instance), listed only"
        TI_OLD=$((TI_OLD + 1)); continue ;;
    *[!0-9]*) echo "[testinstanz-reap] kept $_td — unreadable expiresAt, listed only" >&2
        TI_OLD=$((TI_OLD + 1)); continue ;;
  esac
  if [ "$NOW" -lt "$_te" ]; then TI_OPEN=$((TI_OPEN + 1)); continue; fi
  if [ -z "$_tk" ] || [ "$_tk" = "claudefleet" ]; then
    echo "[testinstanz-reap] REFUSED $_td — state names the production socket or none" >&2
    continue
  fi
  # THE IDENTITY GATE. The noted pid dies ONLY when it is the process LISTENING on the port its
  # own state file records. A recycled pid is somebody else's process by then; killing it by
  # number would be the pattern-kill this file forswears, spelled in digits. Identity is proven
  # by the port (`lsof -iTCP:<port> -sTCP:LISTEN -t`, the noted pid among the listeners); without
  # lsof nothing is provable and the pid is spared — the safe direction. Socket and directory
  # are OURS by name in either case and are retired regardless.
  _holds=0; _nolsof=""
  case "$_tp" in ''|*[!0-9]*) _tp="" ;; esac
  case "$_to" in ''|*[!0-9]*) _to="" ;; esac
  if command -v lsof >/dev/null 2>&1; then
    if [ -n "$_tp" ] && [ -n "$_to" ]; then
      for _lp in $(lsof -nP -iTCP:"$_to" -sTCP:LISTEN -t 2>/dev/null); do
        if [ "$_lp" = "$_tp" ]; then _holds=1; fi
      done
    fi
  else
    _nolsof=" (no lsof on this host — identity unprovable)"
  fi
  if [ -n "$DRY" ]; then
    if [ "$_holds" = 1 ]; then
      echo "[testinstanz-reap] would remove $_td — expired $(( (NOW - _te) / 60 )) min ago (pid $_tp holds port $_to, would be killed; tmux -L $_tk)"
    else
      echo "[testinstanz-reap] would remove $_td — expired $(( (NOW - _te) / 60 )) min ago (pid $_tp holds no port ${_to:-from state}, spared$_nolsof; tmux -L $_tk)"
    fi
    TI_REAPED=$((TI_REAPED + 1)); continue
  fi
  if [ "$_holds" = 1 ]; then
    kill "$_tp" 2>/dev/null || true
    _why="pid $_tp killed (held port $_to)"
  else
    _why="pid $_tp SPARED (holds no port ${_to:-in state}$_nolsof)"
  fi
  TMUX_TMPDIR="$TI_REALTMP" tmux -L "$_tk" kill-server 2>/dev/null || true
  rm -rf "$_td" 2>/dev/null || { sleep 1; rm -rf "$_td" 2>/dev/null; }
  echo "[testinstanz-reap] removed $_td — expired $(( (NOW - _te) / 60 )) min ago ($_why, tmux -L $_tk killed, dir removed)"
  TI_REAPED=$((TI_REAPED + 1))
done
echo "[testinstanz-reap] ${TI_REAPED} expired reaped · ${TI_OPEN} not yet expired · ${TI_OLD} without usable expiresAt (listed, never touched)"

reaped=0; kept=0; held=0
for _d in "$ROOT"/fleet-e2e-instance-*; do
  [ -d "$_d" ] || continue                              # no glob match → the pattern itself
  _pid="${_d##*/fleet-e2e-instance-}"
  case "$_pid" in ''|*[!0-9]*) continue ;; esac         # only fleet-e2e-instance-<pid>

  # --- the gate: either half alive means hands off -------------------------------------------
  if kill -0 "$_pid" 2>/dev/null; then held=$((held+1)); continue; fi
  # -e, not -S: a fixture cannot mint a real socket, and any entry under this name is reason
  # enough to leave the dir alone. Wider than the truth, in the safe direction.
  if [ -e "$SOCKDIR/fleettest$_pid" ]; then held=$((held+1)); continue; fi

  # --- the class ------------------------------------------------------------------------------
  _why=""
  if [ ! -f "$_d/server.log" ]; then
    _why="never booted (no server.log)"
  else
    if ! _m="$(_mtime "$_d")"; then
      echo "[scratch-reap] cannot read mtime of $_d — skipped" >&2
      kept=$((kept+1)); continue
    fi
    _age_h=$(( (NOW - _m) / 3600 ))
    if [ "$_age_h" -ge "$RETENTION_H" ]; then
      _why="${_age_h}h old, past the ${RETENTION_H}h evidence window"
    else
      kept=$((kept+1)); continue
    fi
  fi

  if [ -n "$DRY" ]; then
    echo "[scratch-reap] would remove $_d — $_why"
  else
    rm -rf "$_d" 2>/dev/null && echo "[scratch-reap] removed $_d — $_why"
  fi
  reaped=$((reaped+1))
done

echo "[scratch-reap] ${reaped} reaped · ${kept} within the ${RETENTION_H}h window · ${held} held by a live run"
exit 0

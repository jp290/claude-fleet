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
# SCOPE IS ONE GLOB, deliberately. `fleet-e2e-instance-*` is e2e-isolated.sh's family alone. The
# six other wrapper families carry their own infix (gate-, harness-, unprobed-, cleanreview-,
# postland-, security-instance) and are disjoint from this glob, so a post-land audit running
# concurrently cannot have its instance removed by this sweep. Nothing here kills a process.
set -u

ROOT="${1:?usage: scratch-reap.sh <root> [--dry-run]}"
DRY=""
[ "${2:-}" = "--dry-run" ] && DRY=1

RETENTION_H="${FLEET_E2E_SCRATCH_RETENTION_H:-48}"
SOCKDIR="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)"
NOW="$(date +%s)"

# BSD and GNU stat disagree and this suite runs on BOTH — locally on the Mac and on the Linux
# helper when a lane offers its preview. A mtime that silently reads empty would make `age`
# enormous and reap everything, so a dir whose mtime cannot be read is SKIPPED, not swept.
_mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null; }

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
    _m="$(_mtime "$_d")"
    case "$_m" in ''|*[!0-9]*) kept=$((kept+1)); continue ;; esac   # unreadable mtime → skip
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

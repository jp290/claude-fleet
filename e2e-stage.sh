#!/bin/sh
# e2e-stage.sh — the ONE rule for what a throwaway instance contains.
#
# Sourced (never executed) by every script that stands up a copy of this repo to run a server in:
#   e2e-isolated.sh · e2e-claude-gate.sh · e2e-clean-review.sh · e2e-security.sh
#   e2e-postland-audit.sh · drills/drill-3.sh · steward-arena.sh
#
# WHY. Each of those used to carry its OWN hand-written `cp -R` list of server.ts's local modules,
# and two of them died of exactly that maintenance. e2e-postland-audit.sh stopped booting the day
# continuity.ts landed (`Cannot find module './continuity'`) and stayed dead for weeks, because no
# gate runs it and the symptom reads like anything else. steward-arena.sh:155 shipped with two of
# the four modules missing. A list that must be edited in seven places when server.ts gains one
# import is a list that will be edited in six.
#
# THE RULE. An instance contains exactly:
#   (1) the ENTRY files it was asked to run, plus the transitive closure of their RELATIVE imports,
#       re-derived from the source on every run. A new import rides along with no wrapper edit.
#       SUBPATHS resolve: `from "./src/protocol"` and `from "../src/backoff"` both work, and the
#       directory is created in the copy. (drill-3.sh's earlier derived GUARD — the only derived
#       thing in the old arrangement — matched `from "./name"` only and was blind to precisely
#       that shape.)
#   (2) public/ and package.json — the fixed runtime assets every instance needs.
#   (3) $STAGE_EXTRA — assets read BY PATH rather than imported, which no import scan can see
#       (fleet-e2e-security.ts readFileSync's src/client.ts and src/md.ts).
#   (4) a node_modules symlink back to SRC. Also the only pointer home from inside the copy, which
#       is how the per-check trail resolves the tree under test (e2e/trail-emit.ts sourceTree()).
#
# A specifier that resolves to no file is FATAL here. An instance that cannot boot must say so at
# staging time, naming the file and the import — not forty lines later as a module-resolution
# error inside a tmux pane, in a server.log nobody reads.

# --- machine-wide suite mutex (owner decision 2026-07-28). Suites are serial on this box: two
# concurrent instances reliably poison each other's runs (docs/suite-contention.md; measured again
# 2026-07-28 — three owner interventions in one afternoon because the serialization lived only in
# CLAUDE.md prose). Sourcing this file IS starting a suite, so the lock is taken HERE — one place,
# every wrapper inherits it, no per-wrapper trap surgery.
#   - Lock = mkdir (atomic). The holder records its pid.
#   - Release is IMPLICIT: no EXIT trap (the wrappers own theirs, and a sourced trap would collide).
#     The next contender reaps a lock whose recorded pid is dead. A lock dir existing therefore
#     does NOT mean a suite is running — the pid file decides.
#   - A pid-LESS lock dir is a manual hold (a human parked the machine) and is never reaped.
#   - The reap re-checks the pid VALUE before removing, shrinking the reap/re-acquire race to
#     microseconds; two pollers at 15s cadence cannot practically collide inside it.
FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"
while ! mkdir "$FLEET_SUITE_LOCK" 2>/dev/null; do
  _st_hp=$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null)
  if [ -n "$_st_hp" ] && ! kill -0 "$_st_hp" 2>/dev/null; then
    [ "$(cat "$FLEET_SUITE_LOCK/pid" 2>/dev/null)" = "$_st_hp" ] \
      && rm -f "$FLEET_SUITE_LOCK/pid" && rmdir "$FLEET_SUITE_LOCK" 2>/dev/null
    continue
  fi
  sleep 15
done
echo "$$" > "$FLEET_SUITE_LOCK/pid"

# normalize a relative path in place: `e2e/../src/backoff` → `src/backoff`
_stage_norm() {
  printf '%s' "$1" | awk -F/ '{
    n = 0
    for (i = 1; i <= NF; i++) {
      if ($i == "." || $i == "") continue
      if ($i == "..") { if (n > 0 && out[n] != "..") { n--; continue } }
      out[++n] = $i
    }
    s = ""
    for (i = 1; i <= n; i++) s = s (i > 1 ? "/" : "") out[i]
    print s
  }'
}

# print the repo-relative FILE a bare specifier resolves to, or fail. Bun's resolution order for
# an extensionless relative specifier, narrowed to what this repo actually uses; the empty suffix
# is for a specifier that already carries its extension.
_stage_resolve() {
  for _st_ext in ".ts" ".tsx" "/index.ts" ""; do
    if [ -f "$1/$2$_st_ext" ]; then printf '%s' "$2$_st_ext"; return 0; fi
  done
  return 1
}

# print the transitive closure of relative imports reachable from the given entry files.
# Import-ANCHORED extraction on purpose: a bare `"../../escape"` appears in this repo as test DATA
# (fleet-e2e-security.ts's hostile-branch-name list), and a scan that copied every quoted relative
# string would chase it.
_stage_closure() {
  _st_src="$1"; shift
  _st_pending="$*"
  _st_seen=""
  while [ -n "$_st_pending" ]; do
    _st_f="${_st_pending%% *}"
    case "$_st_pending" in *" "*) _st_pending="${_st_pending#* }" ;; *) _st_pending="" ;; esac
    [ -n "$_st_f" ] || continue
    case " $_st_seen " in *" $_st_f "*) continue ;; esac
    if [ ! -f "$_st_src/$_st_f" ]; then
      printf 'e2e-stage: FATAL: no such file in %s: %s\n' "$_st_src" "$_st_f" >&2
      return 1
    fi
    _st_seen="$_st_seen $_st_f"
    _st_dir=$(dirname "$_st_f")
    for _st_spec in $(grep -oE '(from|import)[[:space:]]*\(?[[:space:]]*"\.[^"]*"' "$_st_src/$_st_f" 2>/dev/null \
                   | grep -oE '"\.[^"]*"' | tr -d '"' || true); do
      _st_hit=$(_stage_resolve "$_st_src" "$(_stage_norm "$_st_dir/$_st_spec")") || {
        printf 'e2e-stage: FATAL: %s imports "%s", which resolves to no file under %s\n' \
          "$_st_f" "$_st_spec" "$_st_src" >&2
        return 1
      }
      _st_pending="$_st_pending $_st_hit"
    done
  done
  printf '%s' "$_st_seen"
}

# stage_instance SRC DIR entry.ts [entry.ts ...]
#   $STAGE_EXTRA (optional, space-separated, relative to SRC) adds by-path assets — see (3) above.
stage_instance() {
  _st_s="$1"; _st_d="$2"; shift 2
  [ -f "$_st_s/server.ts" ] || { printf 'e2e-stage: not a fleet checkout: %s\n' "$_st_s" >&2; return 2; }
  mkdir -p "$_st_d" || return 1
  _st_deps=$(_stage_closure "$_st_s" "$@") || return 1
  for _st_rel in $_st_deps; do
    mkdir -p "$_st_d/$(dirname "$_st_rel")" || return 1
    cp "$_st_s/$_st_rel" "$_st_d/$_st_rel" || return 1
  done
  cp -R "$_st_s/public" "$_st_s/package.json" "$_st_d/" || return 1
  for _st_x in ${STAGE_EXTRA:-}; do
    cp -R "$_st_s/$_st_x" "$_st_d/" || return 1
  done
  [ -e "$_st_d/node_modules" ] || ln -s "$_st_s/node_modules" "$_st_d/node_modules" || return 1
  return 0
}

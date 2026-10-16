#!/bin/sh
# Handlauf auf dem Helfer (workhorse) mit Sperre seines Bands (docs/neuaufbau/plan.md, „Geteilte
# Prüfgeräte“): Die Bänder 5 und 6 gehören den Handläufen der Bau-Sessions, und ein Lauf gilt nur,
# wenn er sein Band für sich hatte. Ein zweiter Start auf demselben Band wartet und sagt es sofort.
# Auf dem Mac, im Worktree des Commits:
#   sh ci/band-run.sh <commit> <band 5|6> <laufname> units=<unit,…>|skip=<unit,…>
# units= fährt genau diese Units aus e2e/ctx.ts#SHARD_UNITS, skip= alle außer diesen
# (FLEET_E2E_SKIP_UNITS). Der Laufname besteht nur aus [A-Za-z0-9._-], höchstens 32 Zeichen: Er
# steht in jedem Fixture-Pfad (server.ts#WORKER_CMD_RE verwirft z. B. ein „+“), und Vergleichsläufe
# brauchen gleich lange Namen (paneEnv, NOTIZ K1 Befund B).
# Der Mac schiebt den Commit nach ~/ci/repo.git und ruft dieses Skript auf dem Helfer auf
# (--on-helper). Dort: Klon und bun install, dann die Sperre ~/ci/band-<n>.lock (flock), dann
# ./e2e-isolated.sh mit FLEET_E2E_BAND=<n> und TMPDIR=/var/tmp/<lauf>, nie unter $HOME (Befund A).
# Lauf = <MMTThhmmss>-<laufname>; Log unter ~/ci/hand/<lauf>/. Ein SSH-Abbruch beendet den Lauf NICHT
# (ohne Terminal kommt kein HUP an, Mängel 71/87): er wartet, läuft bis zum Ende oder zur Zeitgrenze
# und hält so lange sein Band; rc und run.log liest danach, wer will.
# Ausgabe: Zeitstempel (start, wartet, band frei, ende), eine Zeile
# `<laufname> rc= s= PASS= FAIL= QUAR=`, die FAIL/QUAR-Zeilen und `path <laufpfad>`.
# Exit: rc der Suite · 2 falsche Eingabe · 3 der Lauf kam nicht bis zur Suite.
set -u
usage() { echo "sh ci/band-run.sh <commit> <band 5|6> <laufname> units=<unit,…>|skip=<unit,…>" >&2; exit 2; }
check() {
  case "$1" in 5|6) ;; *) echo "Band '$1': Handläufe nur auf 5 oder 6 (0–4 Helfer-Daemon, 7–9 Merge-Check)" >&2; exit 2 ;; esac
  case "$2" in ""|*[!A-Za-z0-9._-]*) echo "Laufname '$2': nur [A-Za-z0-9._-]" >&2; exit 2 ;; esac
  [ "${#2}" -le 32 ] || { echo "Laufname '$2': höchstens 32 Zeichen" >&2; exit 2; }
  case "$3" in units=?*|skip=?*) ;; *) usage ;; esac
  case "${3#*=}" in *[!a-z0-9,-]*) echo "Units '${3#*=}': Namen aus e2e/ctx.ts#SHARD_UNITS, mit Komma getrennt" >&2; exit 2 ;; esac
}

if [ "${1:-}" != "--on-helper" ]; then
  [ $# -eq 4 ] || usage
  check "$2" "$3" "$4"
  SHA=$(git rev-parse --verify -q "${1}^{commit}") || { echo "Commit '$1' gibt es hier nicht" >&2; exit 2; }
  HOST="${MERGE_CHECK_HOST:-$(git remote get-url hub 2>/dev/null | sed -n 's#^ssh://\([^/]*\)/.*#\1#p')}"
  [ -n "$HOST" ] || { echo "kein Helfer: MERGE_CHECK_HOST fehlt, und das Remote hub ist keine ssh://-URL" >&2; exit 3; }
  ssh "$HOST" 'test -d ~/ci/repo.git || git init -q --bare ~/ci/repo.git' \
    || { echo "der Helfer $HOST ist nicht erreichbar" >&2; exit 3; }
  # zwei gleichzeitige Starts desselben Commits schieben denselben Ref, einer wird abgewiesen; dann
  # genügt es, dass der Commit drüben liegt
  out=$(git push -q "ssh://${HOST}/~/ci/repo.git" "${SHA}:refs/hand/${SHA}" 2>&1) \
    || ssh "$HOST" git --git-dir=ci/repo.git cat-file -e "${SHA}^{commit}" \
    || { printf '%s\n' "$out" >&2; echo "der Commit ließ sich nicht zum Helfer $HOST schieben" >&2; exit 3; }
  exec ssh "$HOST" sh -s -- --on-helper "$SHA" "$2" "$3" "$4" < "$0"
fi

shift
[ $# -eq 4 ] || usage
SHA=$1; BAND=$2; NAME=$3; SPEC=$4
check "$BAND" "$NAME" "$SPEC"
case "$SHA" in ""|*[!0-9a-f]*) echo "Commit '$SHA': volle SHA erwartet" >&2; exit 2 ;; esac
CI_HOME="${CI_HOME:-$HOME/ci}"
KEEP_RUNS=10
export PATH="$HOME/.bun/bin:$PATH"
ts() { date +%H:%M:%S.%3N; }
LAUF="$(date +%m%d%H%M%S)-$NAME"
R="$CI_HOME/hand/$LAUF"
T="/var/tmp/$LAUF"
mkdir -p "$R" "$T"
echo "$(ts) start $LAUF auf Band $BAND"
# stdin ist das Skript selbst (sh -s): kein Kind darf es lesen
if ! git clone -q --shared --no-checkout "$CI_HOME/repo.git" "$R/tree" < /dev/null \
  || ! git -C "$R/tree" checkout -q --detach "$SHA" < /dev/null; then
  echo "$SHA ließ sich nicht auschecken"; exit 3
fi
cd "$R/tree" || exit 3
bun install --frozen-lockfile < /dev/null > "$R/install.log" 2>&1 || { echo "bun install schlug fehl ($R/install.log)"; exit 3; }
# units= heißt: alle Units des Kandidaten außer diesen überspringen
SKIP="${SPEC#skip=}"
if [ "${SPEC%%=*}" = units ]; then
  ALL=$(sed -n 's/^ *{ unit: "\([^"]*\)".*/\1/p' e2e/ctx.ts)
  for u in $(echo "${SPEC#units=}" | tr ',' ' '); do
    echo "$ALL" | grep -qx "$u" || { echo "Unit '$u' steht nicht in e2e/ctx.ts#SHARD_UNITS: $(echo $ALL)"; exit 2; }
  done
  SKIP=$(echo "$ALL" | grep -vxF "$(echo "${SPEC#units=}" | tr ',' '\n')" | paste -sd, -)
fi

exec 9> "$CI_HOME/band-$BAND.lock"
if ! flock -n 9; then
  echo "$(ts) wartet auf Band $BAND: $(cat "$CI_HOME/band-$BAND.active" 2>/dev/null || echo "Halter unbekannt")"
  flock 9
fi
echo "pid $$ $LAUF seit $(ts)" > "$CI_HOME/band-$BAND.active"
trap 'rm -f "$CI_HOME/band-$BAND.active"' EXIT
# Läufe ohne diese Sperre (ein altes Handlauf-Skript) erkennt nur ihr Environment
others() {
  for p in $(pgrep -u "$(id -u)"); do
    { tr '\0' '\n' < "/proc/$p/environ"; } 2>/dev/null | grep -qx "FLEET_E2E_BAND=$BAND" && printf '%s ' "$p"
  done
}
seen=""
while o=$(others); [ -n "$o" ]; do
  [ "$o" = "$seen" ] || echo "$(ts) wartet auf Band $BAND: Lauf ohne Sperre, pid $o"
  seen=$o; sleep 15
done
echo "$(ts) band $BAND frei"

s=$(date +%s)
TMPDIR="$T" FLEET_SUITE_LOCK="$R/suite.lock" FLEET_E2E_BAND=$BAND FLEET_E2E_SKIP_UNITS="$SKIP" \
  timeout -k 15 "${BAND_RUN_TIMEOUT_S:-2400}" ./e2e-isolated.sh < /dev/null > "$R/run.log" 2>&1
rc=$?
echo "$rc" > "$R/rc"
echo "$(ts) ende"
echo "$NAME rc=$rc s=$(( $(date +%s) - s )) PASS=$(grep -c '^PASS' "$R/run.log") FAIL=$(grep -c '^FAIL' "$R/run.log") QUAR=$(grep -c '^QUAR' "$R/run.log")"
# die Suite schreibt ihre Zeilen erst am Ende: nach der Zeitgrenze sagen PASS=0 FAIL=0 nichts (Mangel 86)
[ "$rc" = 124 ] && echo "$NAME Zeitgrenze ${BAND_RUN_TIMEOUT_S:-2400} s erreicht: Ergebnis unbekannt, nicht grün"
grep -E '^(FAIL|QUAR) ' "$R/run.log" | cut -c1-600
grep -E '^(module|shard-unit) ' "$R/run.log"
echo "path $R/run.log (TMPDIR $T)"
# fertige Läufe über die letzten KEEP_RUNS hinaus weg, samt TMPDIR; laufende haben noch kein rc
ls -1dt "$CI_HOME"/hand/*/ 2>/dev/null | while read -r d; do [ -f "$d/rc" ] && echo "$d"; done \
  | tail -n "+$((KEEP_RUNS + 1))" | while read -r d; do rm -rf "$d" "/var/tmp/$(basename "$d")"; done
exit "$rc"

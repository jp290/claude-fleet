#!/bin/sh
# Merge-Check, Helfer-Seite. Läuft auf dem Helfer (workhorse), aufgerufen von ci/merge-check.ts:
#   sh merge-check-run.sh <commit>
# Der Commit liegt schon in $CI_HOME/repo.git (merge-check.ts schiebt ihn per git push dorthin).
# Fährt die Teile des Urteils parallel, jedes mit eigenem TMPDIR, eigenem Suite-Lock und eigenem
# Port-Band (FLEET_E2E_BAND 7–9; der Helfer-Daemon nimmt die kleinsten freien, 0–4 bei fünf Plätzen):
#   local   pins, tsc (Einstiege wie VERIFY_CMD in watchdog.sh), build, bun test ./ci
#   gate    ./e2e-claude-gate.sh
#   review  ./e2e-clean-review.sh, danach ./e2e-security.sh
#   s1–s3   die kleinen Units in drei Shards; die großen laufen nachts und vor jedem Deploy
# Ausgabe: je Teil eine Zeile `job <name> rc=<rc> ms=<ms>`, dazu die `module`/`shard-unit`-Zeilen
# der Shards und als letzte Zeile `merge-check green|red <ms>`. Exit 0 nur, wenn jeder Teil 0 war.
set -u
SHA="${1:?commit fehlt}"
CI_HOME="${CI_HOME:-$HOME/ci}"
BIG_UNITS="core,core-tasks,programs,lanes,watch,dom"
JOB_TIMEOUT_S="${MERGE_CHECK_JOB_TIMEOUT_S:-900}"
KEEP_RUNS=20
export PATH="$HOME/.bun/bin:$PATH"
now_ms() { date +%s%3N; }
T0=$(now_ms)
# ein Merge-Check zur Zeit: zwei teilten sich sonst die Port-Bänder 7–9
mkdir -p "$CI_HOME/runs"
exec 9> "$CI_HOME/run.lock"
flock 9
# solange diese Datei auf einen lebenden Prozess zeigt, startet der Helfer-Daemon auf
# mergeCheckSlots seiner Plätze nichts Neues (helper-daemon/daemon.ts#mergeCheckHeld)
echo $$ > "$CI_HOME/active"
trap 'rm -f "$CI_HOME/active"' EXIT
# kurz halten: TMPDIR eines Teils ist $RUN/<name>, und Unix-Sockets darunter (e2e/pins.ts legt welche
# in ${tmpdir()}/fleet-pins-hy-*/tmux-<uid>/ an) dürfen unter Linux 108 Bytes nicht überschreiten
RUN="$CI_HOME/runs/$(date +%m%d%H%M%S)-$(printf %.8s "$SHA")"
mkdir -p "$RUN"
echo "run $RUN wait=$(( $(now_ms) - T0 ))"
if ! git clone -q --shared --no-checkout "$CI_HOME/repo.git" "$RUN/tree" \
  || ! git -C "$RUN/tree" checkout -q --detach "$SHA"; then
  echo "merge-check red $(( $(now_ms) - T0 )) — $SHA ließ sich nicht auschecken"; exit 3
fi
cd "$RUN/tree" || exit 3
if ! bun install --frozen-lockfile > "$RUN/install.log" 2>&1; then
  echo "merge-check red $(( $(now_ms) - T0 )) — bun install schlug fehl ($RUN/install.log)"; exit 3
fi
TSC=$(grep -o "bunx tsc [^&]*" watchdog.sh | head -n 1)
[ -n "$TSC" ] || { echo "merge-check red $(( $(now_ms) - T0 )) — keine tsc-Zeile in watchdog.sh"; exit 3; }

# job <name> <band> <command line>: im Hintergrund, mit eigener Prozessgruppe (timeout tötet sie ganz)
job() {
  name=$1; band=$2; cmd=$3
  mkdir -p "$RUN/$name"
  (
    s=$(now_ms)
    TMPDIR="$RUN/$name" FLEET_SUITE_LOCK="$RUN/$name.lock" FLEET_E2E_BAND=$band \
      timeout -k 15 "$JOB_TIMEOUT_S" sh -c "$cmd" > "$RUN/$name.log" 2>&1
    echo "job $name rc=$? ms=$(( $(now_ms) - s ))" >> "$RUN/jobs"
  ) &
}
: > "$RUN/jobs"
job local 9 "bun e2e/pins.ts && $TSC && bun run build && bun test ./ci"
job gate 9 "./e2e-claude-gate.sh"
job review 9 "./e2e-clean-review.sh && ./e2e-security.sh"
for k in 1 2 3; do
  job "s$k" $((6 + k)) "FLEET_E2E_SKIP_UNITS=$BIG_UNITS FLEET_E2E_SHARD=$k/3 ./e2e-isolated.sh"
done
wait

cat "$RUN/jobs"
for k in 1 2 3; do grep -hE '^(module|shard-unit) ' "$RUN/s$k.log" | sed "s/^/s$k /"; done
red=$(grep -v ' rc=0 ' "$RUN/jobs" | sed 's/^job \([^ ]*\).*/\1/' | tr '\n' ' ')
TOTAL=$(( $(now_ms) - T0 ))
# alte Läufe weg, die letzten KEEP_RUNS bleiben (ein rotes Instanzverzeichnis liegt im Lauf)
ls -1dt "$CI_HOME"/runs/*/ 2>/dev/null | tail -n "+$((KEEP_RUNS + 1))" | while read -r d; do rm -rf "$d"; done
if [ -z "$red" ] && [ "$(grep -c '^job ' "$RUN/jobs")" -eq 6 ]; then
  echo "merge-check green $TOTAL"; exit 0
fi
echo "merge-check red $TOTAL — ${red:-ein Teil meldete sich nicht}"; exit 1

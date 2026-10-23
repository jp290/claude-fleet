#!/bin/sh
# Merge-Check, Helfer-Seite. Läuft auf dem Helfer (workhorse), aufgerufen von ci/merge-check.ts:
#   sh merge-check-run.sh <commit> <große Units>
# Der Commit liegt schon in $CI_HOME/repo.git (merge-check.ts schiebt ihn per git push dorthin).
# Fährt die Teile des Urteils parallel, jedes mit eigenem TMPDIR, eigenem Suite-Lock und eigenem
# Port-Band (FLEET_E2E_BAND 7–9; der Helfer-Daemon nimmt die kleinsten freien, 0–4 bei fünf Plätzen):
#   local   pins, tsc (bun run typecheck, tsconfig.json), build, bun test ./ci ./server (falls vorhanden)
#   gate    ./e2e-claude-gate.sh
#   review  ./e2e-clean-review.sh, danach ./e2e-security.sh
#   s1–s3   die kleinen Units in drei Shards, wie immer (die großen laufen dort nie mit)
#   a<k>    je Audit-Shard k/4 (ohne dom), der eine große Unit trägt, die der Kandidat schuldet
# <große Units> sind `unit,…` aus ci/big-units.ts oder „-“. Gefahren werden die Shards des Audits
# selbst (FLEET_E2E_SKIP_UNITS=dom FLEET_E2E_SHARD=k/4, nach der Tabelle des Kandidaten), weil eine große
# Unit nur in der Gesellschaft sicher ist, in der das Audit sie fährt: 22.10. kam programs hinter lanes
# nach einem Neustart nicht mehr hoch, und auch allein lief programs rot („game-maker tree is already open
# in slot 2“), auf einem main, dessen Audit grün war. Trägt jeder der vier Shards eine geschuldete Unit,
# decken sie alle kleinen Units mit, und s1–s3 entfallen. Die Shards gehen nach Gewicht auf das Band mit
# der kleinsten Last (laufen s1–s3, tragen die ersten drei Bänder schon ihren Shard, SMALL_S).
# Vier statt fünf: das Audit fährt n = freie Plätze − 1 (server.ts#auditShardCount), bei fünf freien
# Plätzen des Workhorse also 4/4; ein Audit mit anderem n teilt anders, das fängt weiter das Audit.
# Mit großen Units nimmt der Merge-Check auch die Handlauf-Bänder 5 und 6, wenn sie frei sind (Sperre wie
# ci/band-run.sh, ein Handlauf wartet dann). Die Zeile `bands <genommen> busy=<belegt>` sagt, welche er bekam.
# Ausgabe: je Teil eine Zeile `job <name> rc=<rc> ms=<ms>`, `na <was> — <warum>` für Nicht-Anwendbares,
# je gefahrenem Audit-Shard `audit-shard <k>/<n> <units>`, dazu die `module`/`shard-unit`-Zeilen der
# Shards, und als letzte Zeile `merge-check green|red <ms>`. Exit 0 nur, wenn jeder Teil 0 war.
set -u
SHA="${1:?commit fehlt}"
BIG_RUN="${2:?große Units fehlen (unit,… oder -)}"
case "$BIG_RUN" in -|[a-z]*) ;; *) echo "merge-check red 0 — große Units '$BIG_RUN' sind nicht unit,…"; exit 3 ;; esac
case "$BIG_RUN" in *[!a-z,-]*) echo "merge-check red 0 — große Units '$BIG_RUN' sind nicht unit,…"; exit 3 ;; esac
CI_HOME="${CI_HOME:-$HOME/ci}"
BIG_UNITS="core,core-tasks,programs,lanes,watch,dom"
AUDIT_N=4
AUDIT_SKIP=dom
BANDS="7 8 9"
HAND_BANDS="5 6"
SMALL_S=200
JOB_TIMEOUT_S="${MERGE_CHECK_JOB_TIMEOUT_S:-900}"
BIG_JOB_TIMEOUT_S="${MERGE_CHECK_BIG_JOB_TIMEOUT_S:-1500}"
KEEP_RUNS=20
# die Instanzen der Teile liegen außerhalb von $HOME, wie die des Audits (/var/lib/fleet-helper/work): e2e/programs.ts
# öffnet einen Slot in $HOME, und unter $HOME überlappte der jeden game-maker-Baum der Instanz („game-maker tree is
# already open in slot 2“, Lauf 1023040123, auf grünem main) — drei rote programs-Läufe, die das Audit nie hatte
SCRATCH_ROOT="${MERGE_CHECK_SCRATCH:-/var/tmp/fleet-merge-check}"
export PATH="$HOME/.bun/bin:$PATH"
now_ms() { date +%s%3N; }
T0=$(now_ms)
# ein Merge-Check zur Zeit: zwei teilten sich sonst die Port-Bänder 7–9
mkdir -p "$CI_HOME/runs"
exec 9> "$CI_HOME/run.lock"
# wer wartet, sagt es sofort (sonst sähe der Aufrufer bis zu einer Laufzeit lang nichts)
if ! flock -n 9; then
  echo "wartet auf den laufenden Merge-Check (pid $(cat "$CI_HOME/active" 2>/dev/null || echo ?))"
  flock 9
  # ein Audit zwischen zwei Checks: hinter einem Check gewartet, gibt dieser dem Daemon erst einen
  # Poll-Takt (pollSec 15 in /etc/fleet-helper/config.json) ohne gehaltene Plätze, damit ein Audit, das
  # hinter dem vorigen wartete, jetzt startet, statt hinter einer Kette von Checks zu verhungern
  echo "lässt dem Helfer-Daemon ${MERGE_CHECK_GAP_S:-20} s für ein wartendes Audit"
  sleep "${MERGE_CHECK_GAP_S:-20}"
fi
# solange diese Datei auf einen lebenden Prozess zeigt, startet der Helfer-Daemon auf
# mergeCheckSlots seiner Plätze nichts Neues (helper-daemon/daemon.ts#mergeCheckHeld). Er glaubt ihr
# nur 30 min ab ihrem mtime (MERGE_CHECK_STALE_MS); ein Check auf drei Bändern mit allen vier
# Audit-Shards braucht so lange, darum frischt dieser Lauf sie alle 5 min auf
echo $$ > "$CI_HOME/active"
# (abgekoppelt: kein Kind, auf das das `wait` unten wartete, und ohne die ssh-Ausgabe offen zu halten)
( ( while kill -0 $$ 2>/dev/null; do sleep 300; [ "$(cat "$CI_HOME/active" 2>/dev/null)" = $$ ] && touch "$CI_HOME/active"; done ) \
  < /dev/null > /dev/null 2>&1 9>&- & )
trap 'rm -f "$CI_HOME/active"' EXIT
# kurz halten: TMPDIR eines Teils ist $SCRATCH/<name>, und Unix-Sockets darunter (e2e/pins.ts legt welche
# in ${tmpdir()}/fleet-pins-hy-*/tmux-<uid>/ an) dürfen unter Linux 108 Bytes nicht überschreiten
ID="$(date +%m%d%H%M%S)-$(printf %.8s "$SHA")"
RUN="$CI_HOME/runs/$ID"
SCRATCH="$SCRATCH_ROOT/$ID"
case "$SCRATCH" in "$HOME"/*) echo "merge-check red 0 — $SCRATCH liegt unter \$HOME"; exit 3 ;; esac
mkdir -p "$RUN" "$SCRATCH"
echo "run $RUN wait=$(( $(now_ms) - T0 ))"
# die Handlauf-Bänder: fd 4 für 5, fd 3 für 6, gehalten bis zum Ende dieses Laufs
BUSY=""
if [ "$BIG_RUN" != - ]; then
  for b in $HAND_BANDS; do
    fd=$((9 - b))
    eval "exec $fd> \"\$CI_HOME/band-$b.lock\""
    if flock -n "$fd"; then BANDS="$BANDS $b"; else BUSY="$BUSY${BUSY:+,}$b"; eval "exec $fd>&-"; fi
  done
fi
if ! git clone -q --shared --no-checkout "$CI_HOME/repo.git" "$RUN/tree" \
  || ! git -C "$RUN/tree" checkout -q --detach "$SHA"; then
  echo "merge-check red $(( $(now_ms) - T0 )) — $SHA ließ sich nicht auschecken"; exit 3
fi
cd "$RUN/tree" || exit 3
if ! bun install --frozen-lockfile > "$RUN/install.log" 2>&1; then
  echo "merge-check red $(( $(now_ms) - T0 )) — bun install schlug fehl ($RUN/install.log)"; exit 3
fi
TSC="bun run typecheck"
grep -q "\"typecheck\":" package.json || { echo "merge-check red $(( $(now_ms) - T0 )) — kein typecheck-Skript in package.json"; exit 3; }
# die Unit-Tests gehören zum Kandidaten: ein Baum ohne ci/*.test.ts und server/*.test.ts hat keine,
# und das ist „nicht anwendbar“ (eigene Zeile `na`), nie ein grün geprüfter Teil
TESTS=""
for d in ci server; do ls "$d"/*.test.ts > /dev/null 2>&1 && TESTS="$TESTS ./$d"; done
if [ -n "$TESTS" ]; then TESTS="bun test$TESTS"; else TESTS="true"; echo "na tests — der Kandidat hat keine ci/*.test.ts oder server/*.test.ts"; fi
# die geschuldeten Audit-Shards, je Zeile `<k> <sekunden> <units>`, aus der Tabelle des Kandidaten
SHARDS=""
if [ "$BIG_RUN" != - ]; then
  SHARDS=$(BIG="$BIG_RUN" N=$AUDIT_N SKIP=$AUDIT_SKIP bun -e '
    import { shardPlan, SHARD_UNITS } from "./e2e/ctx";
    const plan = shardPlan(Number(process.env.N), new Set(process.env.SKIP.split(",")));
    const owed = process.env.BIG.split(",");
    const missing = owed.filter((u) => !plan.has(u));
    if (missing.length) { console.error(`nicht im Audit-Plan: ${missing.join(",")}`); process.exit(1); }
    for (const k of [...new Set(owed.map((u) => plan.get(u)))].sort((a, b) => a - b)) {
      const units = SHARD_UNITS.filter((u) => plan.get(u.unit) === k);
      console.log(k, units.reduce((s, u) => s + u.seconds, 0), units.map((u) => u.unit).join(","));
    }' 2> "$RUN/shards.err") \
    || { echo "merge-check red $(( $(now_ms) - T0 )) — Audit-Shards nicht ableitbar: $(cat "$RUN/shards.err")"; exit 3; }
fi
echo "$SHARDS" | awk -v n=$AUDIT_N 'NF { print "audit-shard " $1 "/" n " " $3 }'
# alle Shards geschuldet: sie tragen jede kleine Unit, s1–s3 entfallen
SMALL=1
[ "$(echo "$SHARDS" | awk 'NF' | wc -l)" -eq "$AUDIT_N" ] && SMALL=0
# Band → Audit-Shard, schwerster zuerst auf das Band mit der kleinsten Last
PLAN=$(echo "$SHARDS" | sort -k2 -rn | awk -v bands="$BANDS" -v small=$((SMALL * SMALL_S)) '
  BEGIN { n = split(bands, b, " "); for (i = 1; i <= n; i++) load[i] = (i <= 3 ? small : 0) }
  NF { best = 1; for (i = 2; i <= n; i++) if (load[i] < load[best]) best = i
    load[best] += $2; print b[best], $1 }')
# ein Handlauf-Band, das kein Shard bekam, gleich wieder frei
for b in $HAND_BANDS; do
  case " $BANDS " in *" $b "*) echo "$PLAN" | grep -q "^$b " || { eval "exec $((9 - b))>&-"; BANDS=$(echo "$BANDS" | sed "s/ $b//"); } ;; esac
done
echo "bands $BANDS busy=${BUSY:--}"
echo "big-units $BIG_RUN small=$SMALL plan=$(echo "$PLAN" | tr '\n' ' ')"

# run <name> <band> <command line> [<sekunden>]: im Vordergrund, mit eigener Prozessgruppe (timeout
# tötet sie ganz); ohne Sekunden gilt JOB_TIMEOUT_S
run() {
  name=$1; band=$2; cmd=$3; secs=${4:-$JOB_TIMEOUT_S}
  mkdir -p "$SCRATCH/$name"
  s=$(now_ms)
  # ohne die Sperren: ein Rest des Laufs (tmux-Server) hielte sonst ein Handlauf-Band oder run.lock fest
  TMPDIR="$SCRATCH/$name" FLEET_SUITE_LOCK="$RUN/$name.lock" FLEET_E2E_BAND=$band \
    timeout -k 15 "$secs" sh -c "$cmd" > "$RUN/$name.log" 2>&1 3>&- 4>&- 9>&-
  echo "job $name rc=$? ms=$(( $(now_ms) - s ))" >> "$RUN/jobs"
}
# job: dasselbe im Hintergrund
job() { run "$@" & }
: > "$RUN/jobs"
job local 9 "bun e2e/pins.ts && $TSC && bun run build && $TESTS"
job gate 9 "./e2e-claude-gate.sh"
job review 9 "./e2e-clean-review.sh && ./e2e-security.sh"
k=0
for band in $BANDS; do
  k=$((k + 1))
  (
    [ "$SMALL" -eq 0 ] || [ "$k" -gt 3 ] \
      || run "s$k" "$band" "FLEET_E2E_SKIP_UNITS=$BIG_UNITS FLEET_E2E_SHARD=$k/3 ./e2e-isolated.sh"
    for a in $(echo "$PLAN" | awk -v b="$band" '$1 == b { print $2 }'); do
      run "a$a" "$band" "FLEET_E2E_SKIP_UNITS=$AUDIT_SKIP FLEET_E2E_SHARD=$a/$AUDIT_N ./e2e-isolated.sh" "$BIG_JOB_TIMEOUT_S"
    done
  ) &
done
wait

cat "$RUN/jobs"
for name in s1 s2 s3 $(echo "$PLAN" | awk 'NF { print "a" $2 }'); do
  [ -f "$RUN/$name.log" ] && grep -hE '^(module|shard-unit) ' "$RUN/$name.log" | sed "s/^/$name /"
done
red=$(grep -v ' rc=0 ' "$RUN/jobs" | sed 's/^job \([^ ]*\).*/\1/' | tr '\n' ' ')
TOTAL=$(( $(now_ms) - T0 ))
# alte Läufe weg, die letzten KEEP_RUNS bleiben (ein rotes Instanzverzeichnis liegt in $SCRATCH_ROOT)
for dir in "$CI_HOME/runs" "$SCRATCH_ROOT"; do
  ls -1dt "$dir"/[0-9]*-*/ 2>/dev/null | tail -n "+$((KEEP_RUNS + 1))" | while read -r d; do rm -rf "$d"; done
done
if [ -z "$red" ] && [ "$(grep -c '^job ' "$RUN/jobs")" -eq $((3 + 3 * SMALL + $(echo "$PLAN" | awk 'NF' | wc -l))) ]; then
  echo "merge-check green $TOTAL"; exit 0
fi
echo "merge-check red $TOTAL — ${red:-ein Teil meldete sich nicht}"; exit 1

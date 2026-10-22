#!/bin/sh
# THE `claude` OF A TEST INSTANCE WITH REAL SEATS ($DIR/bin/claude, first on every pane's PATH). testinstanz.sh
# (ti_real_wrapper, `up --real-seats`) writes one line of the instance's values in front of this file; a test hands
# the same names in the environment:
#   TI_D            the instance directory          TI_REAL_CLAUDE  the real claude binary
#   TI_OWNER_HOME   the HOME claude is logged in at  TI_SEATS        the machine's seat registry (one <pid>.seat each)
#   TI_SEAT_CAP     real seats on this machine       TI_EXPIRES      the instance's expiresAt (epoch seconds)
# Owner 22.10.: „[Zitat entfernt]“
#  Every refusal is one sentence in the pane and exit 1, so the pane falls to its shell and the board
# reads the slot as having no agent — nothing is started behind it.
no() { printf '%s\n' "$1"; exit 1; }
idle() { exec "$TI_D/bin/claude-agent" -e "setInterval(() => {}, 1 << 30)"; }
lstart() { LC_ALL=C ps -p "$1" -o lstart= 2>/dev/null | sed 's/^ *//;s/ *$//'; }

# THE LINE: no worker call (summaries and the merge resolver spawn `claude -p` by name), no bypass in any spelling,
# and the permission mode must be auto — the server already sets auto with FLEET_NO_BYPASS; this is the second wall
prev=""; mode=""; id=""
for a in "$@"; do
  case "$a" in
    -p|--print) no "Testinstanz: kein Worker-Aufruf an ein echtes Modell (claude $a) — echt startet hier nur ein geöffneter Sitz." ;;
    --dangerously-skip-permissions|--allow-dangerously-skip-permissions|--permission-mode=*)
      no "Testinstanz: abgelehnt — ein echter Sitz läuft nie im Bypass und nur mit --permission-mode auto ($a)." ;;
  esac
  case "$prev" in --permission-mode) mode=$a ;; --session-id|--resume) id=$a ;; esac
  prev=$a
done
[ "$mode" = auto ] || no "Testinstanz: abgelehnt — ein echter Sitz startet nur mit --permission-mode auto (diese Zeile: ${mode:-ohne})."

# THE DEMO STAYS A DEMO: until `up` has planted its fixtures and armed the instance, and for every seat whose self
# token it recorded then, this is the idle stand-in of FLEET_TI_CLAUDE_LINE — the pane has its agent, no model runs
[ -f "$TI_D/bin/.real-armed" ] || idle
[ -n "${FLEET_SELF_TOKEN:-}" ] || no "Testinstanz: abgelehnt — ohne Sitz-Ausweis (FLEET_SELF_TOKEN) ist das kein geöffneter Sitz."
h=$(printf %s "$FLEET_SELF_TOKEN" | shasum -a 256 | cut -c1-64)
grep -qx "$h" "$TI_D/bin/.stand-ins" 2>/dev/null && idle
[ "$(date +%s)" -lt "$TI_EXPIRES" ] || no "Testinstanz: abgelehnt — die Instanz ist abgelaufen, ein echter Sitz startet hier nicht mehr."

# THE CAP, for the whole machine: count the registered seats whose pid still has its birth, under a mkdir lock
# The lock names its holder; it is taken over only from a holder that is gone (or never wrote its pid within 5 s), once,
# and then the wait starts again — a live holder is never stolen from, it holds the lock for a few milliseconds.
mkdir -p "$TI_SEATS"
i=0
until mkdir "$TI_SEATS/.lock" 2>/dev/null; do
  i=$((i + 1))
  holder=$(cat "$TI_SEATS/.lock/pid" 2>/dev/null)
  if { [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; } || { [ -z "$holder" ] && [ "$i" -ge 50 ]; }; then
    rm -rf "$TI_SEATS/.lock"; i=0
  fi
  sleep 0.1
done
echo $$ > "$TI_SEATS/.lock/pid"
n=0; held=""
for f in "$TI_SEATS"/*.seat; do
  [ -f "$f" ] || continue
  p=$(sed -n 's/^pid=//p' "$f"); b=$(sed -n 's/^birth=//p' "$f")
  if [ -n "$p" ] && [ -n "$b" ] && [ "$(lstart "$p")" = "$b" ]; then n=$((n + 1)); held="$held · $(sed -n 's/^where=//p' "$f")"
  else rm -f "$f"; fi
done
if [ "$n" -ge "$TI_SEAT_CAP" ]; then
  rm -rf "$TI_SEATS/.lock"
  no "Testinstanz: abgelehnt — auf diesem Rechner laufen schon $n echte Claude-Sitze, höchstens $TI_SEAT_CAP (Owner 22.10.)$held. Erst einen beenden (seine Session schließen oder ./testinstanz.sh down), dann neu öffnen."
fi
born=$(lstart $$)
printf 'pid=%s\nbirth=%s\ndir=%s\nwhere=%s\n' "$$" "$born" "$TI_D" "$TI_D Slot ${FLEET_SELF_SLOT:-?}" > "$TI_SEATS/$$.seat"
rm -rf "$TI_SEATS/.lock"

# THE TTL, held by the seat itself: the reap tick only runs at an e2e start, a seat must not bill past expiresAt.
# The watchdog looks every 5 s and ends with its seat, so a closed seat leaves nothing behind.
nohup sh -c 'alive() { [ "$(LC_ALL=C ps -p "$2" -o lstart= 2>/dev/null | sed "s/^ *//;s/ *$//")" = "$3" ]; }
  while [ "$(date +%s)" -lt "$1" ]; do alive "$@" || exit 0; sleep 5; done
  alive "$@" && kill -TERM "$2"' _ "$TI_EXPIRES" "$$" "$born" >/dev/null 2>&1 &

# THE TRANSCRIPT, where the instance reads it: claude writes under the owner's HOME, the board reads ctx and permission
# mode from $HOME/.claude/projects/<cwd>/<id>.jsonl of the instance's own HOME (server.ts#projDir) — a link per name
if [ -n "$id" ]; then
  real=$(pwd -P | sed 's/[^a-zA-Z0-9]/-/g')
  for c in "$PWD" "$(pwd -P)"; do
    s=$(printf %s "$c" | sed 's/[^a-zA-Z0-9]/-/g')
    mkdir -p "$TI_D/home/.claude/projects/$s" && ln -sfn "$TI_OWNER_HOME/.claude/projects/$real/$id.jsonl" "$TI_D/home/.claude/projects/$s/$id.jsonl"
  done
fi
exec env HOME="$TI_OWNER_HOME" "$TI_REAL_CLAUDE" "$@"

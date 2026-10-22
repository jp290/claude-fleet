#!/bin/sh
# WHAT RUNS IN A TEST INSTANCE'S PANE — sourced by testinstanz.sh (ti_serve), and by
# server/testinstanz-echte-sitze.test.ts, which asks it without a server. Needs DIR, STATE, SRC and TI_KIND; reads
# FLEET_TI_CLAUDE_LINE (and FLEET_TI_MODEL) from the environment and realSeats= from the state file.
#
# ONE REGISTRY FOR THE MACHINE, whatever FLEET_TI_ROOT an instance lives under (acceptance 22.10.: two roots made two
# registries, four real seats on 8 GB). /tmp is the same directory for every caller of this user; FLEET_TI_SEAT_REGISTRY
# exists for the tests alone, so a test never counts against — or ends — the machine's real seats.
TI_SEATS="${FLEET_TI_SEAT_REGISTRY:-/tmp/fleet-echte-sitze}"
TI_SEAT_CAP=2
ti_lstart() { LC_ALL=C ps -p "$1" -o lstart= 2>/dev/null | sed 's/^ *//;s/ *$//'; }
# the live real seats, `<pid> <dir> <where>` per line; a file whose pid no longer has its birth is stale and removed
ti_seats_live() {
  for TI_SF in "$TI_SEATS"/*.seat; do
    [ -f "$TI_SF" ] || continue
    TI_SP=$(sed -n 's/^pid=//p' "$TI_SF"); TI_SB=$(sed -n 's/^birth=//p' "$TI_SF")
    case "$TI_SP" in ''|*[!0-9]*|0|1) rm -f "$TI_SF"; continue ;; esac
    if [ -n "$TI_SB" ] && [ "$(ti_lstart "$TI_SP")" = "$TI_SB" ]; then
      echo "$TI_SP $(sed -n 's/^dir=//p' "$TI_SF") $(sed -n 's/^where=//p' "$TI_SF")"
    else rm -f "$TI_SF"; fi
  done
}
# every process below pid $1, deepest last
ti_descendants() {
  for TI_C in $(ps -axo pid=,ppid= | awk -v p="$1" '$2 == p { print $1 }'); do echo "$TI_C"; ti_descendants "$TI_C"; done
}
# END EVERY REAL SEAT OF THE INSTANCE IN $1 — by its registered pid and birth, never by a name: TERM, 5 s, then KILL
ti_end_seats() {
  TI_EP=""; TI_EN=0
  for TI_SF in "$TI_SEATS"/*.seat; do
    [ -f "$TI_SF" ] || continue
    [ "$(sed -n 's/^dir=//p' "$TI_SF")" = "$1" ] || continue
    TI_SP=$(sed -n 's/^pid=//p' "$TI_SF"); TI_SB=$(sed -n 's/^birth=//p' "$TI_SF")
    case "$TI_SP" in ''|*[!0-9]*|0|1) rm -f "$TI_SF"; continue ;; esac
    # the seat AND everything it started (its MCP servers, a tool command, wherever their cwd is): children first
    if [ -n "$TI_SB" ] && [ "$(ti_lstart "$TI_SP")" = "$TI_SB" ]; then
      TI_EN=$((TI_EN + 1))
      for TI_KP in $(ti_descendants "$TI_SP") "$TI_SP"; do kill -TERM "$TI_KP" 2>/dev/null && TI_EP="$TI_EP $TI_KP"; done
    fi
    rm -f "$TI_SF"
  done
  [ -n "$TI_EP" ] || return 0
  TI_EI=0
  while [ "$TI_EI" -lt 20 ]; do
    TI_ALIVE=""; for TI_SP in $TI_EP; do kill -0 "$TI_SP" 2>/dev/null && TI_ALIVE="$TI_ALIVE $TI_SP"; done
    [ -n "$TI_ALIVE" ] || break
    sleep 0.25; TI_EI=$((TI_EI + 1))
  done
  [ -n "$TI_ALIVE" ] && kill -KILL $TI_ALIVE 2>/dev/null
  echo "real seats ended: $TI_EN ($(echo $TI_EP | wc -w | tr -d ' ') processes with what they started)"
}

# WHAT THE INSTANCE SERVER GETS WITH REAL SEATS, one NAME=value per line (ti_serve passes them, env-names records the
# names): no role in bypass and the deny rules (server/session-start.ts), a default model that is not the 1M Opus
# (FLEET_TI_MODEL chooses another), and the machine's registry the open door counts (server/echte-sitze.ts)
ti_real_env() {
  [ "${TI_REAL:-}" = 1 ] || return 0
  echo FLEET_NO_BYPASS=1
  echo "FLEET_MODEL=${FLEET_TI_MODEL:-claude-sonnet-5-5}"
  echo "FLEET_REAL_SEAT_REGISTRY=$TI_SEATS"
  echo "FLEET_REAL_SEAT_CAP=$TI_SEAT_CAP"
  echo "FLEET_REAL_SEAT_ARMED=$DIR/bin/.real-armed"
}
# AND THE HARNESS BINARIES ARE STAND-INS. FLEET_CMD=true only replaces the CLAUDE command; a slot
# opened with harness codex or pi still starts the REAL `codex` / `pi` from PATH (measured
# 2026-09-21: slot 5 ran `node ~/.local/bin/codex`, slot 4 a live `pi`). Under the owner's HOME
# those are logged in, and anything typed into their panes is a prompt to a real model. So the
# instance puts $DIR/bin first on PATH (server.ts#PATH_EXPORT hands the server's PATH to every pane),
# where `codex` and `pi` exec an idle bun under a SYMLINK named codex-agent / pi-agent: the pane
# has a process whose name the liveness probe accepts (comms `codex` / `pi`, a prefix match on the
# basename, server.ts#paneAgentAt), and nothing behind it can reach a network or a model. A symlink,
# not a copy: a copied /bin/sleep is killed by macOS on launch (measured, exit 137), a symlink's
# name is what `ps -o comm=` reports.
ti_shims() {
  mkdir -p "$DIR/bin"
  for h in codex pi; do
    ln -sf "$(command -v bun)" "$DIR/bin/$h-agent"
    printf '#!/bin/sh\n# test-instance stand-in for the %s CLI (testinstanz.sh#ti_shims)\nexec "$(dirname "$0")/%s-agent" -e "setInterval(() => {}, 1 << 30)"\n' "$h" "$h" > "$DIR/bin/$h"
    chmod +x "$DIR/bin/$h"
  done
  # FLEET_TI_CLAUDE_LINE=1 (K16 Teil 2): the panes start the CLAUDE line itself — model, --settings, permission mode,
  # as server.ts#agentCmd builds it for the live fleet — against a `claude` here that idles like the two above, so the
  # liveness probe sees its agent and nothing reaches a model. What the server records about that line (e.g.
  # succession.autoCompact) then shows in the instance. Without the flag the stand-in is removed.
  if [ "${TI_REAL:-}" = 1 ]; then
    ti_real_wrapper
  elif [ "${FLEET_TI_CLAUDE_LINE:-}" = 1 ]; then
    ln -sf "$(command -v bun)" "$DIR/bin/claude-agent"
    printf '#!/bin/sh\n# test-instance stand-in for the claude CLI (testinstanz.sh#ti_shims, FLEET_TI_CLAUDE_LINE=1)\nexec "$(dirname "$0")/claude-agent" -e "setInterval(() => {}, 1 << 30)"\n' > "$DIR/bin/claude"
    chmod +x "$DIR/bin/claude"
  else
    rm -f "$DIR/bin/claude" "$DIR/bin/claude-agent"
  fi
}
# THE REAL SEAT'S `claude` ($DIR/bin/claude, first on every pane's PATH): testinstanz-claude.sh behind one line of this
# instance's values. In this order:
#   a worker call (-p/--print: summaries, merge resolver — they spawn `claude` by name) → refused, no model;
#   a line whose --permission-mode is not auto, or any bypass flag → refused (FLEET_NO_BYPASS already makes the server's
#   line auto; this is the second wall, measured on the line itself);
#   before `up` armed the instance ($DIR/bin/.real-armed), or a seat whose self token `up` recorded as a fixture
#   ($DIR/bin/.stand-ins, sha256) → the idle stand-in of FLEET_TI_CLAUDE_LINE, so the demo starts no model;
#   the machine already holds $TI_SEAT_CAP live real seats → refused with the sentence, the pane falls to its shell;
#   else: registered, a watchdog that ends it at the instance's expiresAt (a reap tick only runs at an e2e start),
#   the transcript linked into the instance's HOME (the board reads ctx and permission mode from it, server.ts#projDir),
#   and `exec env HOME=<owner's> claude "$@"` — same pid, so the registry names the claude process itself.
ti_real_wrapper() {
  TI_RC=$(command -v claude) || { echo "refused: --real-seats needs a claude on PATH" >&2; exit 2; }
  case "$TI_RC" in "$DIR"/*) echo "refused: the claude on PATH is the instance's own" >&2; exit 2 ;; esac
  TI_EXP=$(sed -n 's/^expiresAt=//p' "$STATE" 2>/dev/null | head -1)
  case "$TI_EXP" in ''|*[!0-9]*) echo "refused: --real-seats needs the state's expiresAt" >&2; exit 2 ;; esac
  ln -sf "$(command -v bun)" "$DIR/bin/claude-agent"
  {
    echo '#!/bin/sh'
    echo '# test-instance REAL claude (testinstanz.sh#ti_real_wrapper, up --real-seats) — generated, not tracked'
    printf "TI_D='%s' TI_REAL_CLAUDE='%s' TI_OWNER_HOME='%s' TI_SEATS='%s' TI_SEAT_CAP=%s TI_EXPIRES=%s\n" \
      "$DIR" "$TI_RC" "$HOME" "$TI_SEATS" "$TI_SEAT_CAP" "$TI_EXP"
    cat "$SRC/testinstanz-claude.sh"
  } > "$DIR/bin/claude"
  chmod +x "$DIR/bin/claude"
}
# THE PANE'S AGENT COMMAND (the server's FLEET_CMD): `cat` in snapshot, `true` in mixed (its painters type shell loops),
# `claude` only with FLEET_TI_CLAUDE_LINE=1 (the idle stand-in above) or `up --real-seats` (ti_real_wrapper). Without the
# switch no `claude` is on the instance's own PATH, and a `claude` from the caller's PATH runs under the instance's HOME,
# where it is logged in nowhere.
ti_agent_cmd() {
  if [ "${TI_REAL:-}" = 1 ] || [ "${FLEET_TI_CLAUDE_LINE:-}" = 1 ]; then echo claude
  elif [ "${TI_KIND:-}" = snapshot ]; then echo cat
  else echo true; fi
}
ti_agent_setup() {
  TI_REAL=$(sed -n 's/^realSeats=//p' "$STATE" 2>/dev/null | head -1)
  ti_shims
}

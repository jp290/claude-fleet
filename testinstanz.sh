#!/bin/sh
# A STANDING test instance of this checkout, for looking at the left bar with a browser.
#
# WHY THIS IS NOT instanz-shot.sh. That script stages through `. ./e2e-stage.sh`, and sourcing
# e2e-stage.sh TAKES THE SUITE MUTEX at the top level. A throwaway shot holds it for a minute; a
# standing instance would hold it for as long as the owner keeps the tab open, and every land gate
# and post-land audit of this machine would queue behind a browser window. So this script stages
# with rsync and never touches e2e-stage.sh. `./testinstanz.sh status` prints `./ctl.sh lock` for
# exactly that reason: the proof belongs next to the claim.
#
# WHAT IT IS NOT ALLOWED TO BE: the live fleet. Own port, own tmux socket, own directory (the state
# file is derived from the server's own directory — `STATE_FILE = import.meta.dir/fleet.json` — so a
# copy is what gives it its own state), and FLEET_CMD=true so no agent is ever spawned. The three
# live values are refused by name below rather than merely avoided.
#
#   ./testinstanz.sh up [mixed|snapshot] [--ttl <min>] [--real-seats]
#                                           stage, build, start, plant EVERYTHING (fixtures,
#                                           succession, ctx, codex states, painters), print the URL
#                                           — the whole demo; FLEET_TI_TOKEN=<old> keeps the link the
#                                           owner holds; default ttl 240 min. --real-seats (mixed only,
#                                           default ttl 60 min): a seat opened AFTER `up` is a real
#                                           claude in auto — see REAL SEATS below and docs/testinstanz.md
#   ./testinstanz.sh refresh                bring the worktree's CURRENT stand into the standing instance:
#                                           stage + build beside it, restart only the server; port,
#                                           token (the owner's link), tmux and fixtures stay
#   ./testinstanz.sh fixtures [mixed|full]  replant against the running instance, no restart
#   ./testinstanz.sh succession             plant the succession facts (stops+starts the server)
#   ./testinstanz.sh states                 what the bar paints right now, per state
#   ./testinstanz.sh probe <METHOD> /path [--as owner|none|self:<slot>] [--body <file>]
#                                           one request against THIS worktree's instance with its own
#                                           credential, never printed — how a prover shows a finding
#   ./testinstanz.sh status                 is it up, where, rest of its ttl, and who holds the mutex
#   ./testinstanz.sh source                 what `up` would record as the shown stand, measured now
#   ./testinstanz.sh list                   every test instance of this machine, from state files
#   ./testinstanz.sh down [--force]         stop the server, kill ITS tmux by socket, remove the dir —
#                                           refused while a browser holds a connection to its port
#   ./testinstanz.sh reap [--dry-run] [--force]  retire EVERY expired instance of this machine; the
#                                           TTL tick (scratch-reap.sh, at each e2e-isolated.sh start)
#                                           calls it; an instance with an open connection is refused
#
# ONE INSTANCE PER WORKTREE. Port, tmux socket and directory derive from the ABSOLUTE worktree
# path (short hash), so two worktrees run two instances SIDE BY SIDE — the old fixed triple
# 8862/fleetti733b made every copy answer `up` with "already up" from a foreign lane (measured
# 2026-09-24, ~10 stale instances on this machine). The chosen values live in the instance's
# state file; `reap` retires an expired one by what that file names.
#
# THE TTL IS ENFORCED HERE, AND ONLY HERE. `reap` lives in the same file as `up` so the two can
# never disagree about WHERE an instance lives: until 2026-10-09 the sweep sat in scratch-reap.sh
# and looked under its argument — e2e-isolated.sh passes $TMPDIR, which on the Mac is
# /var/folders/…/T, while `up` writes /tmp — and killed the socket under TMUX_TMPDIR=$TMPDIR while
# tmux had made it under /tmp. The tick ran and never saw a single instance: on 2026-10-09
# 2965429957 stood 40 h past its expiresAt. scratch-reap.sh now only calls `reap`.
set -e

# THE DERIVATION — one instance per worktree. Port, tmux socket and directory come from the
# ABSOLUTE worktree path (cksum: POSIX, same answer on mac and workhorse), so a lane derives its
# own triple and never fights a neighbour. A NEW `up` starts at hash mod 100 inside 8900-8999 and
# takes the next free port; every command for an existing instance reads the chosen port from its
# state file. An explicit FLEET_TI_* override selects a new instance's values (the measured
# workflows in docs/messungen rely on it) and binds or fails honestly.
TI_ROOT="${FLEET_TI_ROOT:-/tmp}"
SRC=$(cd "$(dirname "$0")" && pwd -P)
HASH=$(printf '%s' "$SRC" | cksum | awk '{print $1}')
PORT="${FLEET_TI_PORT:-$((8900 + HASH % 100))}"
SOCK="${FLEET_TI_SOCK:-fleetti$HASH}"
DIR="${FLEET_TI_DIR:-$TI_ROOT/fleet-testinstanz-$HASH}"
STATE="$DIR/testinstanz.state"
PIDF="$DIR/.testinstanz.pid"
TOKF="$DIR/.testinstanz.token"
ti_alive() { [ -f "$PIDF" ] && kill -0 "$(cat "$PIDF")" 2>/dev/null; }
ti_owned() {
  [ -f "$STATE" ] && [ -f "$PIDF" ] || return 1
  [ "$(sed -n 's/^src=//p' "$STATE")" = "$SRC" ] || return 1
  [ "$(sed -n 's/^dir=//p' "$STATE")" = "$DIR" ] || return 1
  [ "$(sed -n 's/^sock=//p' "$STATE")" = "$SOCK" ] || return 1
  TI_PID=$(cat "$PIDF")
  case "$TI_PID" in ''|*[!0-9]*|0|1) return 1 ;; esac
  TI_BIRTH=$(sed -n 's/^birth=//p' "$STATE" | sed 's/^ *//;s/ *$//')
  [ -n "$TI_BIRTH" ] && [ "$TI_BIRTH" = "$(LC_ALL=C ps -p "$TI_PID" -o lstart= 2>/dev/null | sed 's/^ *//;s/ *$//')" ] || return 1
  [ "$(lsof -nP -a -p "$TI_PID" -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)" = "$TI_PID" ]
}
# REAL SEATS (owner 22.10.: „[Zitat entfernt]“
# ). `up --real-seats` records realSeats=1; the server then runs FLEET_CMD=claude with
# FLEET_NO_BYPASS=1 (no role in bypass, server/session-start.ts#startAspects), and $DIR/bin/claude is ti_real_wrapper's
# script: the fixture seats `up` planted stay idle stand-ins, a seat opened after `up` execs the real claude under the
# owner's HOME (the instance's own HOME is logged in nowhere — that is why no model ever starts without the switch).
# THE CAP IS THE MACHINE'S: every real seat of every instance registers its pid in $TI_SEATS (one <pid>.seat file,
# under a mkdir lock); a third start while two live is refused in the pane with a sentence naming the two.
ti_source_match() {
  TI_EXPECTED="${TI_SOURCE_ID:-$(sed -n 's/^sourceIdentity=//p' "$STATE" 2>/dev/null)}"
  [ -n "$TI_EXPECTED" ] || return 1
  TI_CURRENT=$(TI_GIT_SRC="$SRC" bun -e 'const fs=require("node:fs"); const p=process.env.TI_GIT_SRC; const a=fs.statSync(p),b=fs.lstatSync(p+"/.git"); console.log([a.dev,a.ino,a.birthtimeMs,b.dev,b.ino,b.birthtimeMs].join(":"));' 2>/dev/null) || return 1
  [ "$TI_EXPECTED" = "$TI_CURRENT" ]
}

if [ "${1:-}" = up ] && ! ti_alive; then
  if [ -z "${FLEET_TI_PORT:-}" ]; then
    TI_P=$PORT; TI_I=0
    while lsof -nP -iTCP:"$TI_P" -sTCP:LISTEN >/dev/null 2>&1; do
      TI_P=$((TI_P + 1))
      if [ "$TI_P" -gt 8999 ]; then TI_P=8900; fi
      TI_I=$((TI_I + 1))
      if [ "$TI_I" -ge 100 ]; then echo "refused: no free port in 8900-8999" >&2; exit 2; fi
    done
    PORT=$TI_P
  fi
elif [ -f "$STATE" ]; then
  PORT=$(sed -n 's/^port=//p' "$STATE" | head -1)
  case "$PORT" in ''|*[!0-9]*) echo "refused: invalid port in $STATE" >&2; exit 2;; esac
fi

# The three live values, refused by NAME. Avoiding them by choosing other defaults is not the same
# thing: an env override is exactly how someone would hand this script the live fleet by accident.
[ "$PORT" = "8790" ] && { echo "refused: 8790 is the live port" >&2; exit 2; }
[ "$SOCK" = "claudefleet" ] && { echo "refused: claudefleet is the live tmux socket" >&2; exit 2; }
case "$DIR" in "$SRC"|"$SRC"/*) echo "refused: the instance may not live inside the checkout" >&2; exit 2;; esac

# WHAT THE INSTANCE OWNS INSIDE $DIR, read off the code — ONE list for both uses in `refresh`: its
# last sync excludes these (a worktree file named like one must not overwrite the instance's state,
# and --force must never remove a state directory), and its deletion never touches them.
#   server.ts writes   fleet.json (+ .tmp/.bak/.corrupt), fleet.pid, every *.jsonl ledger (audit.jsonl
#                      via server/audit-log.ts, rulebook/ab.jsonl), streams/, post-land-audit-queue.json,
#                      deploy-inflight.json — the server's own constants at the top of server.ts
#   this script        .testinstanz.pid/.token/.manifest, testinstanz.state(.new), env-names, server.log,
#                      bin/, home/, konzepte/, node_modules (ti_serve, up)
#   the fixtures       fixture-repo/, fixture-other/ (testinstanz-fixtures.js); transcripts live in home/
#   never copied       .env* (up's exclude)
# A new path the server or this script writes into $DIR belongs in this list.
TI_OWN='fleet.json* fleet.pid *.jsonl streams post-land-audit-queue.json deploy-inflight.json .testinstanz.* testinstanz.state* env-names server.log bin home konzepte node_modules fixture-repo fixture-other .env*'
# is the relative path $1 instance-owned? *.jsonl at any depth, everything else from the top of $DIR
ti_own_path() {
  set -f
  for TI_O in $TI_OWN; do
    case "$TI_O" in
      '*.jsonl') case "$1" in *.jsonl) set +f; return 0 ;; esac ;;
      *) case "$1" in $TI_O|$TI_O/*) set +f; return 0 ;; esac ;;
    esac
  done
  set +f
  return 1
}
# does the relative path $1 reach $DIR only through real directories? A worktree that replaced a
# directory by a SYMLINK hands rsync -a that symlink, and a deletion below it would follow it out
# of the instance (or onto the instance's own state); any symlinked ancestor makes the path untouchable
ti_plain_path() {
  TI_A=$(dirname "$1")
  while [ "$TI_A" != . ]; do
    [ -L "$DIR/$TI_A" ] && return 1
    TI_A=$(dirname "$TI_A")
  done
  return 0
}

# WHAT THE COPY TOOK FROM THE WORKTREE, as relative paths: every file and symlink the staged copy
# holds right after its build, node_modules (the symlink to the source's) left out. `up` writes it
# before the instance writes anything of its own; `refresh` deletes exactly the paths in the OLD list
# that are missing from the NEW one. That is why a deletion can never reach the instance's own state:
# the server writes ~25 paths into its own directory (fleet.json, the *.jsonl ledgers,
# post-land-audit-queue.json, streams/, …), this script adds server.log, env-names, bin/, home/,
# konzepte/ and the .testinstanz.* files, the fixtures their own — none of them was ever in a list
# built from the copy, so none of them is ever a deletion candidate, including paths added later.
# A PATH WITH A LINE BREAK IS NEVER LISTED: the list is one path per line, and "x<LF>fleet.json" would
# fall apart into a line `fleet.json` — which the deletion would then take for a copied file. Such a
# file is copied like any other; it is only never deleted by refresh (it goes with the next `up`).
ti_manifest() {
  ( cd "$1" && find . -path ./node_modules -prune -o ! -path "$(printf '*\n*')" \( -type f -o -type l \) -print ) \
    | sed 's#^\./##' | LC_ALL=C sort
}

# WHAT THE INSTANCE SHOWS, measured on the SOURCE before anything is copied (ranke-notiz R11): head,
# branch, porcelain line count, and — against the TARGET the work wants to land on — how many of
# head's commits are not on it yet. `--cherry-pick --right-only` drops commits whose change the
# target already carries, so a lane landed by rebase reads 0 rather than its old count; `--no-merges`
# drops merge commits, which have no patch to compare — a `git merge <target>` into the lane brings
# the target's content, it is not lane work missing there.
# THE LIMIT, accepted: a merge that carries its OWN conflict resolution is not counted either —
# lanes land by rebase, so that is the rare edge, and --no-merges is the chosen trade.
# A ROUND (server/runde.ts) keeps its branches, what went in and what stayed out in fleet-runde.json in the
# worktree's own git dir; it rides along as `round` and the band shows it instead of a branch.
# The target is never guessed: FLEET_TI_TARGET (the server passes the lane's recorded base), else
# the lane's own `base` from GET /api/self when this runs in a lane pane (FLEET_SELF_URL + token,
# read in-process so the token never reaches a command line), else none — and the band says
# "Ziel unbekannt". The JSON is stored as sourceBefore= and handed verbatim to the instance as
# FLEET_INSTANCE_SOURCE (src/protocol.ts#instanceSourceFrom folds anything unreadable to null).
ti_measure() {
  TI_GIT_SRC="$SRC" GIT_OPTIONAL_LOCKS=0 bun -e '
const run=(...a)=>{const p=Bun.spawnSync(["git","-C",process.env.TI_GIT_SRC,...a],{env:{...process.env,GIT_OPTIONAL_LOCKS:"0"}});return p.exitCode===0?p.stdout.toString().trim():null;};
const head=run("rev-parse","HEAD"),branch=run("symbolic-ref","--short","HEAD"),status=run("status","--porcelain");
const measuredAt=Date.now();
let name=process.env.FLEET_TI_TARGET||null;
if(!name&&process.env.FLEET_SELF_TOKEN&&process.env.FLEET_SELF_URL){
  try{const r=await fetch(process.env.FLEET_SELF_URL+"/api/self",{headers:{"x-fleet-self-token":process.env.FLEET_SELF_TOKEN},signal:AbortSignal.timeout(2000)});
    const base=r.ok?(await r.json())?.lane?.base:null;if(typeof base==="string"&&base)name=base;}catch{}
}
let target=null;
if(name&&run("check-ref-format","--branch",name)!==null){
  const th=run("rev-parse","--verify","--quiet","refs/heads/"+name+"^{commit}");
  const n=th&&head?run("rev-list","--count","--no-merges","--cherry-pick","--right-only",th+"..."+head):null;
  target={branch:name,head:th,ahead:n!==null&&/^\d+$/.test(n)?Number(n):null};
}
let round=null;
const gd=run("rev-parse","--absolute-git-dir");
if(gd){try{const r=JSON.parse(require("node:fs").readFileSync(gd+"/fleet-runde.json","utf8")),b=r.built;
  if(b)round={name:r.name,main:b.main,in:b.in.map((i)=>({branch:i.branch,head:i.head})),out:b.out.map((o)=>({branch:o.branch,why:o.why}))};}catch{}}
console.log(JSON.stringify({head,branch,dirty:status===null?null:status.split("\n").filter(Boolean).length,measuredAt,target,...(round?{round}:{})}));'
}

# The address the owner opens. Derived at RUN time, never written into this file: a tracked file
# that names this machine's address fails `leak-pin: tracked files contain no configured deploy
# identity` — which is how the last one was caught.
ti_addr() {
  for t in /usr/local/bin/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale tailscale; do
    a=$("$t" ip -4 2>/dev/null | head -1) && [ -n "$a" ] && { echo "$a"; return; }
  done
  echo 127.0.0.1
}

# The workhorse's address is private deployment configuration and this repo is public, so it is
# never written here: it comes from FLEET_TI_WORKHORSE_URL, else from the `workhorse` entry of
# FLEET_INSTANCES in this checkout's gitignored .env (the same line the live instances boot with),
# else a CGNAT placeholder — the link only navigates when clicked, so a placeholder costs nothing.
ti_workhorse_url() {
  if [ -n "${FLEET_TI_WORKHORSE_URL:-}" ]; then echo "$FLEET_TI_WORKHORSE_URL"; return; fi
  u=""
  [ -f "$SRC/.env" ] && u=$(sed -n 's/^FLEET_INSTANCES=.*"name" *: *"workhorse" *, *"url" *: *"\([^"]*\)".*/\1/p' "$SRC/.env" | tail -1)
  echo "${u:-http://100.64.0.1:8790}"
}

# THE WAY BACK (Umschalter, 2026-10-07): the live fleet of THIS machine, as one more entry of the
# instance's own FLEET_INSTANCES. 8790 is the live port the guards below refuse by name, and the live
# server binds the same address ti_addr reads, so the origin is derived, never written here.
# FLEET_TI_LIVE_URL points it elsewhere (a scratch "live" server when the switch itself is measured).
# The name is a contract with server.ts#TESTINSTANZ_LIVE_NAME, which marks this entry as the way back.
ti_live_url() { echo "${FLEET_TI_LIVE_URL:-http://$(ti_addr):8790}"; }

# THE OWNER'S TAB, MEASURED. Every ESTABLISHED connection INTO port $1 — the server's side, the
# local address ending in :$1 — one `local->peer` per line. An open board tab is one (it holds its
# stream open). On 2026-10-08 the reap of :8902 shot exactly such a tab, and `lsof -nP -iTCP:8902`
# would have shown it beforehand. lsof on the Mac, ss on a Linux host without it; neither tool
# means the answer is UNKNOWN (exit 3), never zero.
ti_conns() {
  case "$1" in ''|*[!0-9]*) return 3 ;; esac
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$1" -sTCP:ESTABLISHED -F n 2>/dev/null | sed -n 's/^n//p' \
      | awk -v p=":$1" '{ split($0, a, "->"); if (substr(a[1], length(a[1]) - length(p) + 1) == p) print }' | sort -u
    return 0
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -Htn state established "( sport = :$1 )" 2>/dev/null | awk '{ print $(NF-1) "->" $NF }' | sort -u
    return 0
  fi
  return 3
}
# `local->peer` lines on stdin → "100.64.0.1 (3), 127.0.0.1 (1)": who is looking, not which socket
ti_peers() { sed 's/.*->//; s/:[0-9]*$//' | sort | uniq -c | awk '{ printf "%s%s (%s)", (NR > 1 ? ", " : ""), $2, $1 }'; }

# THE PROCESSES AN INSTANCE LEFT BEHIND, by CWD — the identity e2e-stage.sh uses for suite
# instances, for its reason: a cwd at or under the instance directory is a place nothing else on
# this machine runs (the server is started with `cd "$DIR"`, its panes and painters inherit or
# point into it), while a pid NUMBER may have been recycled to a stranger. $1 must be the
# directory's REAL path (/tmp is a symlink on the Mac, and lsof reports /private/tmp).
ti_cwd_pids() {
  if [ -r /proc/self/cwd ]; then
    for TI_PD in /proc/[0-9]*; do
      TI_CW=$(readlink "$TI_PD/cwd" 2>/dev/null) || continue
      case "$TI_CW" in "$1"|"$1"/*) echo "${TI_PD#/proc/}" ;; esac
    done
  elif command -v lsof >/dev/null 2>&1; then
    lsof -n -w -d cwd -F pn 2>/dev/null | awk -v pre="$1" '
      /^p/ { pid = substr($0, 2); next }
      /^n/ { p = substr($0, 2); if (p == pre || index(p, pre "/") == 1) print pid }'
  fi
}

# RETIRE ONE INSTANCE by what it owns: the noted pid ($2) only when it LISTENS on the state file's
# port ($3) — expiry is authority over the instance, never over a pid number —, its tmux socket by
# NAME ($4), every process whose cwd lies inside its directory ($1), the socket file if its server is
# gone, then the directory. Never pkill, never a name pattern. Prints what it did; sets TI_WHY.
ti_retire() {
  TI_RD="$1"; TI_RPID="$2"; TI_RPORT="$3"; TI_RSOCK="$4"
  TI_REAL=$(cd "$TI_RD" 2>/dev/null && pwd -P) || TI_REAL="$TI_RD"
  TI_HOLDS=0; TI_NOLSOF=""
  case "$TI_RPID" in ''|*[!0-9]*|0|1) TI_RPID="" ;; esac
  if command -v lsof >/dev/null 2>&1; then
    if [ -n "$TI_RPID" ] && [ -n "$TI_RPORT" ]; then
      for TI_LP in $(lsof -nP -iTCP:"$TI_RPORT" -sTCP:LISTEN -t 2>/dev/null); do
        if [ "$TI_LP" = "$TI_RPID" ]; then TI_HOLDS=1; fi
      done
    fi
  else
    TI_NOLSOF=" (no lsof on this host — identity unprovable)"
  fi
  TI_ENDED=$(ti_end_seats "$TI_RD")
  if [ "$TI_HOLDS" = 1 ]; then
    kill "$TI_RPID" 2>/dev/null || true
    TI_WHY="pid $TI_RPID killed (held port $TI_RPORT)"
  else
    TI_WHY="pid ${TI_RPID:-none} SPARED (holds no port ${TI_RPORT:-in state}$TI_NOLSOF)"
  fi
  tmux -L "$TI_RSOCK" kill-server 2>/dev/null || true
  TI_ORPH=""
  # only ever below a directory of this family's NAME: a cwd sweep over anything wider is a pattern kill
  case "$TI_REAL" in */fleet-testinstanz-?*) : ;; *) TI_REAL="" ;; esac
  if [ -n "$TI_REAL" ]; then
    for TI_OP in $(ti_cwd_pids "$TI_REAL"); do
      case "$TI_OP" in "$$"|1) continue ;; esac
      TI_ORPH="$TI_ORPH $TI_OP"
    done
  fi
  if [ -n "$TI_ORPH" ]; then
    kill -TERM $TI_ORPH 2>/dev/null || true
    sleep 1
    kill -KILL $TI_ORPH 2>/dev/null || true
    TI_WHY="$TI_WHY, $(echo $TI_ORPH | wc -w | tr -d ' ') process(es) inside the dir ended"
  fi
  [ -n "$TI_ENDED" ] && TI_WHY="$TI_WHY, $TI_ENDED"
  # tmux leaves its -L socket file behind when the server dies (e2e-stage.sh's dead-socket reap)
  TI_SOCKF="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)/$TI_RSOCK"
  if [ -S "$TI_SOCKF" ] && ! tmux -L "$TI_RSOCK" list-sessions >/dev/null 2>&1; then rm -f "$TI_SOCKF"; fi
  # the dying panes' zsh still writes home/.zsh_history after kill-server returns: one retry
  rm -rf "$TI_RD" 2>/dev/null || { sleep 1; rm -rf "$TI_RD" 2>/dev/null; } || true
}

# The fixtures are replanted against the RUNNING instance, so switching between the two stands
# (free places in the axis / all sixteen taken) costs no restart.
ti_plant() {
  ti_source_match || { echo 'refused: source removed or replaced' >&2; return 2; }
  FLEET_TI_BASE="http://$(ti_addr):$PORT" FLEET_TI_TOKEN="$(cat "$TOKF")" FLEET_TI_SRC="$SRC" \
    FLEET_TI_DIR="$DIR" FLEET_TI_SOCK="$SOCK" bun "$SRC/testinstanz-fixtures.js" "$1"
}

# Start the server against the staged directory and wait until it answers. Used by `up` and by
# `succession`, which stops it to edit the state file underneath and starts it again — the tmux
# sessions stand through that, so the panes come back with the instance.
# HOME is the instance's own: the context fill is read from $HOME/.claude/projects/<cwd>/<id>.jsonl
# (server.ts#projDir), and the demo plants those transcripts. With the real HOME they would have to
# go into the owner's ~/.claude — outside this checkout, which a lane does not touch.
#
# WHAT RUNS IN A PANE (the stand-ins, and the real claude of `up --real-seats`) lives in testinstanz-agent.sh, so a test
# can ask it without a server: ti_agent_setup writes $DIR/bin, ti_agent_cmd names the FLEET_CMD
. "$SRC/testinstanz-agent.sh"
# ARM: from now on a NEW seat is real. Every self token the instance holds at this moment is a fixture's, recorded as
# its sha256 — a fixture pane that is healed later stays a stand-in, a seat opened later by anyone is real.
ti_arm() {
  TI_ARM_DIR="$DIR" bun -e '
const d=process.env.TI_ARM_DIR,state=await Bun.file(d+"/fleet.json").json(),out=[];
const walk=(v)=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==="object")for(const [k,x] of Object.entries(v)){if(k==="selfToken"&&typeof x==="string"&&x)out.push(new Bun.CryptoHasher("sha256").update(x).digest("hex"));else walk(x);}};
walk(state.slots);
await Bun.write(d+"/bin/.stand-ins",out.map((h)=>h+String.fromCharCode(10)).join(""));
console.log(out.length);' > "$DIR/bin/.stand-ins.count"
  : > "$DIR/bin/.real-armed"
  echo "real seats armed: $(cat "$DIR/bin/.stand-ins.count") fixture seat(s) stay stand-ins"
  rm -f "$DIR/bin/.stand-ins.count"
}
ti_serve() {
  ti_source_match || { echo 'refused: source removed or replaced; no server started' >&2; return 2; }
  # the harness start lines write their trust entries under $HOME (codex: $HOME/.codex/config.toml)
  # and die on a missing directory — before they ever reach the stand-in
  mkdir -p "$DIR/home/.codex" "$DIR/home/.pi"
  ti_agent_setup
  # THE ENV PROOF, WRITTEN BEFORE THE START: the NAMES — never values — of every FLEET_* variable
  # the instance server will receive. The launch below is an `env -i` whitelist, so the calling
  # environment cannot leak in: no FLEET_HUB_REMOTE, no FLEET_HELPER_*, no FLEET_SHARE_*, and no
  # live token the lane happens to carry. The refusal underneath is belt and braces — with the
  # whitelist it cannot fire — but the invariant is CHECKED, not assumed.
  : > "$DIR/env-names"
  # THE SUITE LOCK a snapshot reads its owner from: the machine's own by default (the server's
  # FLEET_SUITE_LOCK default, nothing passed), or — for a fixture that must show a lane holding it
  # without touching the machine's mutex — the directory named in FLEET_TI_SUITE_LOCK. Snapshot only:
  # mixed lands and gates take the lock, and that one must stay the machine's.
  set --
  if [ "${TI_KIND:-}" = snapshot ] && [ -n "${FLEET_TI_SUITE_LOCK:-}" ]; then
    set -- "FLEET_SUITE_LOCK=$FLEET_TI_SUITE_LOCK"
    echo FLEET_SUITE_LOCK >> "$DIR/env-names"
  fi
  # THE CODEX PAUSE, LIFTED FOR MIXED ONLY: since 95709148 the register pauses codex
  # (model-register.ts#HARNESS_AVAILABILITY) and the open door answers the fixture slots 5 and 8
  # 409 "harness codex is unavailable". Here `codex` is the stand-in above (ti_shims), never the
  # real CLI, so FLEET_HARNESS_RESUME=codex starts nothing that could reach a model — the same
  # reasoning as e2e-isolated.sh's SRV_ENV. Snapshot keeps the pause: it plants no codex fixture
  # and mirrors what the live fleet answers, the pause included.
  if [ "${TI_KIND:-}" != snapshot ]; then
    set -- "$@" FLEET_HARNESS_RESUME=codex
    echo FLEET_HARNESS_RESUME >> "$DIR/env-names"
  fi
  # A HARNESS SWITCHED OFF ON THIS MACHINE (model-register.ts#harnessOffReason): passed through when the caller names it,
  # so the instance can show and refuse it as the machine would (`FLEET_HARNESSES_OFF=pi-zai ./testinstanz.sh up|refresh`)
  if [ -n "${FLEET_HARNESSES_OFF:-}" ]; then
    set -- "$@" "FLEET_HARNESSES_OFF=$FLEET_HARNESSES_OFF"
    echo FLEET_HARNESSES_OFF >> "$DIR/env-names"
  fi
  # REAL SEATS: no role in bypass, a default model that is not the 1M Opus (FLEET_TI_MODEL chooses another), and the
  # registry the open door counts (server/echte-sitze.ts)
  if [ "${TI_REAL:-}" = 1 ]; then
    for TI_V in $(ti_real_env); do set -- "$@" "$TI_V"; echo "${TI_V%%=*}" >> "$DIR/env-names"; done
  fi
  for TI_V in LANG FLEET_HOST FLEET_PORT FLEET_SOCK FLEET_CMD FLEET_INSTANCE FLEET_INSTANCES \
              FLEET_INSTANCE_SOURCE FLEET_LANE_SUCCEED_MAX FLEET_SNAPSHOT_MIRROR FLEET_TOKEN FLEET_KONZEPT_ROOT FLEET_MIGRATE_PCT; do
    echo "$TI_V" >> "$DIR/env-names"
  done
  if grep -Eq '^(FLEET_HUB_REMOTE|FLEET_HELPER_|FLEET_SHARE_)' "$DIR/env-names"; then
    echo "refused: a live-coupling FLEET_* name reached the instance env" >&2; exit 2
  fi
  # TWO COMPUTERS, as the live fleet has them (mac + workhorse), so the device display has something
  # to show; "mac" is THIS instance's own origin, so the board marks it as here. The workhorse link
  # only navigates when clicked. FLEET_TI_INSTANCES= (set, empty) gives the single-host board.
  # AND WHAT RUNS IN A PANE (owner, 2026-10-06): FLEET_CMD=true exits at once, the pane falls through
  # to its shell, and every delivery then stands there as „[Zitat entfernt]“ — the instance
  # looks broken. In snapshot mode the stand-in is plain `cat` (the rig of e2e/watch.ts): it reads
  # the pane's tty, echoes whatever is typed as text, executes nothing, and no agent is behind it.
  # mixed keeps `true`: its painters type shell loops, which a shell must run.
  if [ "${TI_KIND:-}" = snapshot ]; then
    TI_TWO=""
    TI_MIRROR=1
  else
    TI_TWO='[{"name":"mac","url":"http://'"$(ti_addr):$PORT"'"},{"name":"workhorse","url":"'"$(ti_workhorse_url)"'"}]'
    TI_MIRROR=0
  fi
  TI_AGENT_CMD=$(ti_agent_cmd)
  TI_INST="${FLEET_TI_INSTANCES-$TI_TWO}"
  TI_NAME="${FLEET_TI_INSTANCE-mac}"
  [ -z "$TI_INST" ] && TI_NAME="${FLEET_TI_INSTANCE-}"
  # …and the way back to live in both modes, unless FLEET_TI_INSTANCES was set: an explicit list is
  # the operator's whole answer and stays exactly as given.
  if [ -z "${FLEET_TI_INSTANCES+set}" ]; then
    TI_LIVE='{"name":"live","url":"'"$(ti_live_url)"'"}'
    if [ -z "$TI_INST" ]; then TI_INST="[$TI_LIVE]"; else TI_INST="${TI_INST%]},$TI_LIVE]"; fi
  fi
  # env -i, the card's "the server gets only the values the script itself sets": BY CONSTRUCTION,
  # not by filtering — the child env is exactly the names written to env-names above.
  # the konzept store (konzept-ledger.ts) lives INSIDE the instance directory, so the board's Konzepte
  # view has a root and `down` removes it with the rest; FLEET_TI_KONZEPT_ROOT points it at a fixture
  TI_KONZ="${FLEET_TI_KONZEPT_ROOT:-$DIR/konzepte}"
  mkdir -p "$TI_KONZ"
  # THE HANDOVER THRESHOLD as the live fleet arms it (.env FLEET_MIGRATE_PCT 40, owner 29.09.): at the
  # code default 0 every session reads „[Zitat entfernt]“, and the popover (src/handover.ts) has nothing to
  # set; FLEET_TI_MIGRATE_PCT=0 shows that state on purpose
  # the band at the top of the instance: the stand recorded BEFORE the copy (ti_measure). Always set
  # here — this is a test instance by construction — and "{}" when no record exists, which the
  # instance reads as "Stand unbekannt" instead of showing no band at all.
  TI_SHOWN=$(sed -n 's/^sourceBefore=//p' "$STATE" 2>/dev/null | head -1)
  [ -n "$TI_SHOWN" ] || TI_SHOWN='{}'
  ( cd "$DIR" && exec env -i HOME="$DIR/home" PATH="$DIR/bin:$PATH" TMPDIR="${TMPDIR:-/tmp}" \
      LANG=en_US.UTF-8 \
      FLEET_HOST="$(ti_addr)" FLEET_PORT="$PORT" FLEET_SOCK="$SOCK" FLEET_CMD="$TI_AGENT_CMD" \
      FLEET_INSTANCE="$TI_NAME" FLEET_INSTANCES="$TI_INST" FLEET_INSTANCE_SOURCE="$TI_SHOWN" FLEET_LANE_SUCCEED_MAX=5 \
      FLEET_SNAPSHOT_MIRROR="$TI_MIRROR" FLEET_KONZEPT_ROOT="$TI_KONZ" FLEET_MIGRATE_PCT="${FLEET_TI_MIGRATE_PCT:-40}" \
      "$@" FLEET_TOKEN="$(cat "$TOKF")" bun server.ts >> "$DIR/server.log" 2>&1 ) &
  echo $! > "$PIDF"
  i=0
  until curl -sf "http://$(ti_addr):$PORT/api/sessions" -H "authorization: Bearer $(cat "$TOKF")" >/dev/null 2>&1; do
    i=$((i+1)); [ "$i" -gt 60 ] && { echo "server never came up:" >&2; tail -20 "$DIR/server.log" >&2; return 1; }
    sleep 0.5
  done
  # The state file's pid is the SERVING pid — `succession` relaunches and moves it, so refresh
  # whenever a state file is already there (`up` writes the rest of it before calling us).
  if [ -f "$STATE" ]; then
    sed '/^birth=/d;s/^pid=.*/pid='"$(cat "$PIDF")"'/' "$STATE" > "$STATE.new"
    printf 'birth=%s\n' "$(LC_ALL=C ps -p "$(cat "$PIDF")" -o lstart= | sed 's/^ *//;s/ *$//')" >> "$STATE.new"
    mv "$STATE.new" "$STATE"
  fi
  return 0
}

# Plant what no HTTP route can set (succession, ctx transcripts, codex states — see
# testinstanz-fixtures.js). The server is stopped for the edit because it would otherwise write its
# in-memory state back over it; the tmux sessions are left alone, so the panes are still there.
ti_patch() {
  ti_owned || { echo 'refused: instance identity is unknown' >&2; return 2; }
  kill "$(cat "$PIDF")" 2>/dev/null || true
  i=0; while kill -0 "$(cat "$PIDF")" 2>/dev/null && [ "$i" -lt 40 ]; do i=$((i+1)); sleep 0.25; done
  ti_plant succession-patch
  ti_serve || return 1
  sleep 3
}

# THE PAINTERS keep the four states standing for as long as the instance stands. A state is read
# from the pane's last OUTPUT (src/client.ts#slotState): < 5 s working, < 30 min resting, beyond that
# asleep. Without painters every row would fall asleep half an hour after `up`, and "working" would
# last five seconds. So: lane 10 prints every 2 s (a working row that is not the one on screen), the
# plain shell rows print every 10 min (resting for as long as the instance stands), slot 6 has no
# process behind its pane at all (broken), and the HARNESS rows 4, 5 and 8 are never typed into —
# a harness pane is an agent's input, and keys sent there are prompts. They fall asleep 30 min
# after `up`, which is also how the demo gets its asleep row (slot 4): the one state that cannot be
# hurried without touching the product. Typed on this instance's OWN socket, by session name —
# never a pattern, never a socket this script did not create.
ti_paint() {
  tmux -L "$SOCK" send-keys -t s10 'clear; while :; do printf .; sleep 2; done' Enter 2>/dev/null || true
  # slot 1 is the pane the demo opens on and counts as working because it is SHOWN — it needs no
  # painter, it needs a clean screen (the server types its orchestrator hand-off into this shell)
  tmux -L "$SOCK" send-keys -t s1 C-c 2>/dev/null || true
  tmux -L "$SOCK" send-keys -t s1 'clear' Enter 2>/dev/null || true
  for n in 2 3 7 9 11 12; do
    tmux -L "$SOCK" send-keys -t "s$n" 'clear; while :; do sleep 600; printf .; done' Enter 2>/dev/null || true
  done
}

case "${1:-}" in
up)
  TI_KIND=mixed; TI_TTL=""; TI_REAL=0
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --ttl) [ $# -ge 2 ] || { echo "up: --ttl needs a number of minutes" >&2; exit 2; }
             TI_TTL=$2; shift 2 ;;
      --ttl=*) TI_TTL="${1#--ttl=}"; shift ;;
      --real-seats) TI_REAL=1; shift ;;
      mixed|full|snapshot) TI_KIND=$1; shift ;;
      *) echo "usage: ./testinstanz.sh up [mixed|snapshot] [--ttl <minutes>] [--real-seats]" >&2; exit 2 ;;
    esac
  done
  # a real seat bills while it stands: its instance lives an hour unless --ttl says otherwise
  [ -n "$TI_TTL" ] || { [ "$TI_REAL" = 1 ] && TI_TTL=60 || TI_TTL=240; }
  [ "$TI_REAL" = 1 ] && [ "$TI_KIND" != mixed ] && { echo "up: --real-seats only with mixed — a snapshot mirrors the live fleet's seats" >&2; exit 2; }
  case "$TI_TTL" in ''|*[!0-9]*) echo "up: --ttl wants whole minutes" >&2; exit 2 ;; esac
  [ "$TI_TTL" -ge 1 ] && [ "$TI_TTL" -le 1440 ] || { echo "up: --ttl wants 1 to 1440 minutes" >&2; exit 2; }
  [ "$TI_REAL" = 1 ] && [ "$TI_TTL" -gt 240 ] && { echo "up: --real-seats lives at most 240 minutes — a real seat bills while it stands" >&2; exit 2; }
  case "$TI_KIND" in mixed|snapshot) : ;; *) echo 'refused: unavailable mode' >&2; exit 2 ;; esac
  [ -f "$SRC/testinstanz-fixtures.js" ] && [ -f "$SRC/testinstanz-snapshot.js" ] || { echo 'refused: mode implementation missing' >&2; exit 2; }
  if ti_alive; then
    ti_owned || { echo 'refused: instance identity is unknown' >&2; exit 2; }
    echo "already up — ./testinstanz.sh status"; exit 0
  fi
  TI_SOURCE_BEFORE=$(ti_measure)
  TI_COPY_STARTED=$(date +%s)
  if [ -f "$STATE" ]; then
    [ "$(sed -n 's/^src=//p' "$STATE")" = "$SRC" ] && [ "$(sed -n 's/^dir=//p' "$STATE")" = "$DIR" ] && [ "$(sed -n 's/^sock=//p' "$STATE")" = "$SOCK" ] || { echo 'refused: foreign instance state' >&2; exit 2; }
    if tmux -L "$SOCK" list-sessions >/dev/null 2>&1; then echo 'refused: unknown socket owner' >&2; exit 2; fi
  fi
  TI_SOURCE_ID=$(TI_GIT_SRC="$SRC" bun -e 'const fs=require("node:fs"); const p=process.env.TI_GIT_SRC; const a=fs.statSync(p),b=fs.lstatSync(p+"/.git"); console.log([a.dev,a.ino,a.birthtimeMs,b.dev,b.ino,b.birthtimeMs].join(":"));')
  rm -rf "$DIR"; mkdir -p "$DIR"
  # rsync, not e2e-stage.sh: see the header. The EXCLUDES are the no-live-values fence:
  # `fleet.json*` because copying a state file is how a test instance adopts real sessions;
  # `.env` because it is this checkout's private configuration (workhorse URL, sync token);
  # `*.jsonl` because transcripts and trails are nobody's demo data. None of them may exist
  # in the copy, so the fixtures plant their OWN under the instance's HOME afterwards.
  rsync -a --exclude .git --exclude node_modules --exclude '.env*' --exclude fleet.pid --exclude 'fleet.json*' --exclude '*.jsonl' "$SRC/" "$DIR/"
  TI_COPY_FINISHED=$(date +%s)
  TI_SOURCE_AFTER=$(TI_GIT_SRC="$SRC" GIT_OPTIONAL_LOCKS=0 bun -e '
const run=(...a)=>{const p=Bun.spawnSync(["git","-C",process.env.TI_GIT_SRC,...a],{env:{...process.env,GIT_OPTIONAL_LOCKS:"0"}});return p.exitCode===0?p.stdout.toString().trim():null;};
const head=run("rev-parse","HEAD"),branch=run("symbolic-ref","--short","HEAD"),status=run("status","--porcelain");
console.log(JSON.stringify({head,branch,dirty:status===null?null:status.split("\n").filter(Boolean).length,measuredAt:Date.now()}));')
  ln -s "$SRC/node_modules" "$DIR/node_modules"
  # BUILD IN THE COPY, BEFORE THE SERVER. A red build starts nothing and exits 1 — an instance
  # serving yesterday's client bundle while claiming to show today's change is worse than none.
  ( cd "$DIR" && bun run build ) || { echo "up: build failed — nothing started" >&2; exit 1; }
  TI_BUILT=$(date +%s)
  # the list of what came from the worktree, taken BEFORE the token, the state file or the server
  # put anything of their own here (ti_manifest); `refresh` deletes against it
  ti_manifest "$DIR" > "$DIR.manifest" && mv "$DIR.manifest" "$DIR/.testinstanz.manifest"
  # FLEET_TI_TOKEN keeps the owner's link across a down/up (a rebuild after a client change);
  # without it every `up` mints a fresh one and the link he holds stops opening.
  TOK="${FLEET_TI_TOKEN:-$(head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
  printf '%s' "$TOK" > "$TOKF"; chmod 600 "$TOKF"
  if [ "$TI_KIND" = snapshot ]; then
    FLEET_TI_SRC="$SRC" FLEET_TI_DIR="$DIR" FLEET_TI_SOCK="$SOCK" FLEET_TI_TOKEN="$TOK" \
      bun "$SRC/testinstanz-snapshot.js" || { echo "up: snapshot failed — nothing started" >&2; exit 1; }
    TI_SNAPSHOT_DIR="$DIR" bun - <<'JS'
const dir=process.env.TI_SNAPSHOT_DIR;
// sessionId disappears everywhere EXCEPT inside a Program's `main`: there it is replaced by null,
// not dropped. The server's loader fail-closes a main without the key (sessionId must be null or a
// string), so a dropped key silently deleted EVERY Program binding in the copy — the owner read
// „[Zitat entfernt]“ (2026-10-06). null keeps the binding (slot+openedAt survive
// intact) and honestly reports the session-id half as unmatched.
// commandJobs and laneSuiteJobs are NOT on this list: testinstanz-snapshot.js already planted them as
// a projection without helper identity, bundle path or output (mirrorJob), and the right tab reads
// checks.local/preview and the open offers from them.
const strip=(v,parent)=>Array.isArray(v)?v.map((x)=>strip(x,parent)):v&&typeof v==='object'
 ?Object.fromEntries(Object.entries(v).flatMap(([k,x])=>{
   if(k==='sessionId'&&parent==='main')return [[k,null]];
   if(['selfToken','sessionId','worktree','helperDevices','shares','suiteOffers','watches','autos','lanePreviews'].includes(k))return [];
   return [[k,strip(x,k)]];
  }))
 :v;
const file=Bun.file(`${dir}/fleet.json`),state=strip(await file.json());
state.dispatch=false;state.autosOn=false;
await Bun.write(file,JSON.stringify(state));
for(const name of ['lane-outcomes.jsonl','post-land-audits.jsonl','audit.jsonl']){
 const file=Bun.file(`${dir}/${name}`);if(!await file.exists())continue;
 const lines=(await file.text()).split('\n').filter(Boolean).map(line=>JSON.stringify(strip(JSON.parse(line))));
 await Bun.write(file,lines.join('\n')+(lines.length?'\n':''));
}
JS
  fi
  # THE STATE FILE is the machine-wide index: `list` reads it, scratch-reap.sh reaps by it, and
  # it records the values ACTUALLY chosen (the port bump may have moved off the hash port). No
  # token in it — the token stays in $TOKF, and `list` prints the URL WITHOUT it.
  TI_NOW=$(date +%s)
  {
    echo "src=$SRC"
    echo "sourceIdentity=$TI_SOURCE_ID"
    echo "port=$PORT"
    echo "sock=$SOCK"
    echo "dir=$DIR"
    echo "pid=0"
    echo "started=$TI_NOW"
    echo "ttlMin=$TI_TTL"
    echo "expiresAt=$((TI_NOW + TI_TTL * 60))"
    echo "mode=$TI_KIND"
    [ "$TI_REAL" = 1 ] && echo "realSeats=1"
    echo "sourceBefore=$TI_SOURCE_BEFORE"
    echo "sourceAfter=$TI_SOURCE_AFTER"
    echo "copyStartedAt=$TI_COPY_STARTED"
    echo "copyFinishedAt=$TI_COPY_FINISHED"
    echo "builtAt=$TI_BUILT"
    echo "host=$(ti_addr)"
  } > "$STATE"
  ADDR=$(ti_addr)
  TI_SOURCE_NOW=$(TI_GIT_SRC="$SRC" bun -e 'const fs=require("node:fs"); const p=process.env.TI_GIT_SRC; const a=fs.statSync(p),b=fs.lstatSync(p+"/.git"); console.log([a.dev,a.ino,a.birthtimeMs,b.dev,b.ino,b.birthtimeMs].join(":"));')
  [ "$TI_SOURCE_ID" = "$TI_SOURCE_NOW" ] || { echo 'refused: source removed or replaced; no server started' >&2; exit 2; }
  ti_serve || exit 1
  if [ "$TI_KIND" = snapshot ]; then
    echo "TESTINSTANZ SNAPSHOT UP   http://$ADDR:$PORT/?token=$TOK"
    echo "  down: $SRC/testinstanz.sh down"
    exit 0
  fi
  ti_plant "$TI_KIND"
  # ONE COMMAND, THE WHOLE DEMO. Succession used to be a second, separate step (`succession`) — an
  # instance brought up with `up` alone showed no succession anywhere, on any #band.
  ti_patch || exit 1
  ti_paint
  ti_plant states
  [ "$TI_REAL" = 1 ] && ti_arm
  echo
  echo "TESTINSTANZ UP   http://$ADDR:$PORT/?token=$TOK"
  if [ "$TI_REAL" = 1 ]; then
    echo "  log $DIR/server.log · socket $SOCK · port $PORT · ttl ${TI_TTL}min · REAL SEATS: a seat opened now is a real claude in auto, at most $TI_SEAT_CAP on this machine, default model ${FLEET_TI_MODEL:-claude-sonnet-5-5}"
  else
    echo "  log $DIR/server.log · socket $SOCK · port $PORT · ttl ${TI_TTL}min · FLEET_CMD=true (no agent is ever spawned)"
  fi
  echo "  down: $SRC/testinstanz.sh down"
  ;;
refresh)
  # A CHANGE IN THE WORKTREE, VISIBLE AFTER A RELOAD — without `down` + `up` (40 s, new fixtures, a
  # new token unless FLEET_TI_TOKEN is carried by hand). Measured 2026-10-07
  # (docs/messungen/2026-10-07-live-worktree-konzept.md §2, §6).
  #
  # STAGED BESIDE THE INSTANCE, NOT INTO IT. The copy and the build happen in $DIR.next; only a green
  # build is synced over the running copy. A red build therefore leaves the old instance standing
  # exactly as it was — the same rule as `up`'s "a red build starts nothing", applied to a restart.
  # The sync uses `up`'s excludes, so the instance's own state (fleet.json, ledgers, home/, bin/,
  # konzepte/, token, state file) is never overwritten. A file deleted in the worktree is deleted in
  # the copy too, against the file list `up` and `refresh` keep (ti_manifest) — never by pattern.
  #
  # ONLY THE SERVER RESTARTS, the way ti_patch does it: the tmux sessions stand through it, so the
  # panes, their painters and the planted fixtures are still there. The restart is what carries the
  # new FLEET_INSTANCE_SOURCE (the band is read once at boot, server.ts#INSTANCE_SOURCE) and any
  # server.ts change; a client-only change would need no restart (server/transport.ts#bundleV), but
  # one path for both keeps the band honest. An open page sees the new bundle version in its next
  # /api/sessions poll and offers the reload (src/client.ts#armReload).
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_owned || { echo 'refused: instance identity is unknown' >&2; exit 2; }
  ti_source_match || { echo 'refused: source removed or replaced' >&2; exit 2; }
  TI_STAGE="$DIR.next"
  case "$TI_STAGE" in "$SRC"|"$SRC"/*) echo "refused: the staging copy may not live inside the checkout" >&2; exit 2;; esac
  TI_SOURCE_BEFORE=$(ti_measure)
  TI_COPY_STARTED=$(date +%s)
  rm -rf "$TI_STAGE"; mkdir -p "$TI_STAGE"
  rsync -a --exclude .git --exclude node_modules --exclude '.env*' --exclude fleet.pid --exclude 'fleet.json*' --exclude '*.jsonl' "$SRC/" "$TI_STAGE/"
  TI_COPY_FINISHED=$(date +%s)
  TI_SOURCE_AFTER=$(TI_GIT_SRC="$SRC" GIT_OPTIONAL_LOCKS=0 bun -e '
const run=(...a)=>{const p=Bun.spawnSync(["git","-C",process.env.TI_GIT_SRC,...a],{env:{...process.env,GIT_OPTIONAL_LOCKS:"0"}});return p.exitCode===0?p.stdout.toString().trim():null;};
const head=run("rev-parse","HEAD"),branch=run("symbolic-ref","--short","HEAD"),status=run("status","--porcelain");
console.log(JSON.stringify({head,branch,dirty:status===null?null:status.split("\n").filter(Boolean).length,measuredAt:Date.now()}));')
  ln -s "$SRC/node_modules" "$TI_STAGE/node_modules"
  ( cd "$TI_STAGE" && bun run build ) || { rm -rf "$TI_STAGE"; echo "refresh: build failed — the running instance is unchanged" >&2; exit 1; }
  TI_BUILT=$(date +%s)
  ti_manifest "$TI_STAGE" > "$DIR.manifest"
  # --force: a non-empty directory the worktree replaced by a FILE is removed to make room (without
  # it rsync leaves the directory, fails, and set -e ends refresh half-way after a green build)
  set -f
  set -- -a --force
  for TI_O in $TI_OWN; do
    case "$TI_O" in '*.jsonl') set -- "$@" --exclude '*.jsonl' ;; *) set -- "$@" --exclude "/$TI_O" ;; esac
  done
  set +f
  rsync "$@" "$TI_STAGE/" "$DIR/"
  # deleted in the worktree → deleted in the copy: old list minus new list, files only, never a path
  # that leaves $DIR. No old list (an instance `up` started before the list existed) deletes nothing.
  TI_GONE=0; TI_KEPT=0
  if [ -f "$DIR/.testinstanz.manifest" ]; then
    LC_ALL=C comm -23 "$DIR/.testinstanz.manifest" "$DIR.manifest" > "$DIR.gone"
    while IFS= read -r TI_P; do
      case "$TI_P" in ''|/*|..|../*|*/../*|*/..) continue ;; esac
      # never a path the instance owns (TI_OWN), and never one below a symlink (ti_plain_path)
      if ti_own_path "$TI_P" || ! ti_plain_path "$TI_P"; then TI_KEPT=$((TI_KEPT + 1)); continue; fi
      if [ -f "$DIR/$TI_P" ] || [ -L "$DIR/$TI_P" ]; then rm -f "$DIR/$TI_P" && TI_GONE=$((TI_GONE + 1)); fi
      # and the directories that held only it: rmdir takes only an EMPTY one, and only parents of a
      # listed path are tried — never home/, bin/ or konzepte/, which no listed path lives under
      TI_PD=$(dirname "$TI_P")
      while [ "$TI_PD" != . ] && rmdir "$DIR/$TI_PD" 2>/dev/null; do TI_PD=$(dirname "$TI_PD"); done
    done < "$DIR.gone"
    rm -f "$DIR.gone"
  else
    echo "refresh: no file list from up — files deleted in the worktree stay in the copy until the next up" >&2
  fi
  mv "$DIR.manifest" "$DIR/.testinstanz.manifest"
  rm -rf "$TI_STAGE"
  # the state file records the stand NOW shown; ti_serve reads sourceBefore from it for the band
  # and rewrites pid= and birth= once the new server answers
  sed -e '/^sourceBefore=/d' -e '/^sourceAfter=/d' -e '/^copyStartedAt=/d' -e '/^copyFinishedAt=/d' -e '/^builtAt=/d' "$STATE" > "$STATE.new"
  {
    echo "sourceBefore=$TI_SOURCE_BEFORE"
    echo "sourceAfter=$TI_SOURCE_AFTER"
    echo "copyStartedAt=$TI_COPY_STARTED"
    echo "copyFinishedAt=$TI_COPY_FINISHED"
    echo "builtAt=$TI_BUILT"
  } >> "$STATE.new"
  mv "$STATE.new" "$STATE"
  # the restart serves the mode the instance was started in (snapshot: `cat` panes, no device list)
  TI_KIND=$(sed -n 's/^mode=//p' "$STATE" | head -1)
  kill "$(cat "$PIDF")" 2>/dev/null || true
  i=0; while kill -0 "$(cat "$PIDF")" 2>/dev/null && [ "$i" -lt 40 ]; do i=$((i+1)); sleep 0.25; done
  ti_serve || exit 1
  echo "refreshed   http://$(ti_addr):$PORT/   head $(printf '%s' "$TI_SOURCE_BEFORE" | sed -n 's/^{"head":"\([0-9a-f]\{7\}\).*/\1/p') · removed $TI_GONE · kept $TI_KEPT · port and token unchanged"
  ;;
fixtures)
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_plant "${2:-mixed}"
  ;;
succession)
  # Plants the succession facts, which no HTTP route can set (see testinstanz-fixtures.js). The
  # server is stopped for the edit because it would otherwise write its in-memory state back over
  # it; the tmux sessions are left alone, so the panes are still there when it comes back.
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_patch || exit 1
  ti_paint
  ti_plant states
  ;;
states)
  # Plants nothing. `asleep` is the state no fixture can produce (see testinstanz-fixtures.js);
  # this is how it is watched for on a standing instance without opening the tab.
  ti_alive || { echo "not up — ./testinstanz.sh up" >&2; exit 1; }
  ti_plant states
  ;;
source)
  # Plants nothing, starts nothing: the JSON `up` would record as sourceBefore, measured now.
  ti_measure
  ;;
probe)
  # ONE REQUEST AGAINST THIS WORKTREE'S OWN INSTANCE, for a prover who shows a finding on it (docs/testinstanz.md §Probe).
  # The credential comes from the instance's own files, inside bun: it is never printed and never on a command line, and
  # it is never the live fleet's. Prints `HTTP <status>`, then the body.
  ti_owned || { echo "probe: this worktree has no running instance of its own — ./testinstanz.sh up first" >&2; exit 2; }
  TI_M=${2:-}; TI_PATH=${3:-}
  case "$TI_M" in GET|POST|PUT|PATCH|DELETE) : ;; *) echo "usage: ./testinstanz.sh probe GET|POST|PUT|PATCH|DELETE /path [--as owner|none|self:<slot>] [--body <file>]" >&2; exit 2;; esac
  case "$TI_PATH" in /*) : ;; *) echo "probe: the path starts with / — a path on the instance, not a URL" >&2; exit 2;; esac
  shift 3
  TI_AS=owner; TI_BODY=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --as) TI_AS=${2:-}; shift 2 ;;
      --body) TI_BODY=${2:-}; [ -f "$TI_BODY" ] || { echo "probe: no body file ${TI_BODY:-given}" >&2; exit 2; }; shift 2 ;;
      *) echo "probe: unknown argument $1" >&2; exit 2 ;;
    esac
  done
  case "$TI_AS" in owner|none|self:[0-9]*) : ;; *) echo "probe: --as is owner, none or self:<slot>" >&2; exit 2;; esac
  TI_PR_HOST=$(sed -n 's/^host=//p' "$STATE" | head -1) TI_PR_PORT="$PORT" TI_PR_DIR="$DIR" TI_PR_M="$TI_M" TI_PR_PATH="$TI_PATH" \
    TI_PR_AS="$TI_AS" TI_PR_BODY="$TI_BODY" bun - <<'JS'
const e=process.env,dir=e.TI_PR_DIR,as=e.TI_PR_AS??"owner",headers={};
if(as==="owner")headers.authorization=`Bearer ${(await Bun.file(`${dir}/.testinstanz.token`).text()).trim()}`;
else if(as.startsWith("self:")){
  const slot=as.slice(5),t=(await Bun.file(`${dir}/fleet.json`).json().catch(()=>null))?.slots?.[slot]?.selfToken;
  if(typeof t!=="string"||!t){console.error(`probe: slot ${slot} of the instance has no self credential`);process.exit(2);}
  headers["x-fleet-self-token"]=t;
}
const body=e.TI_PR_BODY?await Bun.file(e.TI_PR_BODY).text():undefined;
if(body!==undefined)headers["content-type"]="application/json";
const r=await fetch(`http://${e.TI_PR_HOST}:${e.TI_PR_PORT}${e.TI_PR_PATH}`,{method:e.TI_PR_M,headers,body,redirect:"manual"});
console.log(`HTTP ${r.status}`);
console.log(await r.text());
JS
  ;;
status)
  # the connections INTO this instance's port, measured once for both forms; UNKNOWN stays unknown
  if TI_CONNS=$(ti_conns "$PORT"); then TI_CONNS_KNOWN=1; else TI_CONNS=""; TI_CONNS_KNOWN=0; fi
  if [ "${2:-}" = --json ]; then
    TI_STATUS_SRC="$SRC" TI_STATUS_DIR="$DIR" TI_STATUS_HOST="$(ti_addr)" \
      TI_STATUS_CONNS="$TI_CONNS" TI_STATUS_CONNS_KNOWN="$TI_CONNS_KNOWN" bun - <<'JS'
const src=process.env.TI_STATUS_SRC,dir=process.env.TI_STATUS_DIR,host=process.env.TI_STATUS_HOST;
const observedAt=Date.now();
const read=async(name)=>await Bun.file(`${dir}/${name}`).text().catch(()=>null);
const raw=await read('testinstanz.state');
const fields=Object.fromEntries((raw??'').split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
const number=(key)=>/^\d+$/.test(fields[key]??'')&&Number(fields[key])>0?Number(fields[key]):null;
const pid=number('pid'),port=number('port'),expiresAt=number('expiresAt')===null?null:number('expiresAt')*1000;
let procStatus='unknown',httpStatus='unknown',identity='unknown';
const run=(...args)=>Bun.spawnSync(args,{timeout:1500,stdout:'pipe',stderr:'pipe',env:{...process.env,LC_ALL:'C'}});
if(pid&&pid>1){const alive=run('kill','-0',String(pid));procStatus=alive.exitCode===0?'alive':'dead';}
const pidFile=await read('.testinstanz.pid');
if(raw&&fields.src===src&&fields.dir===dir&&/^fleetti[a-zA-Z0-9]+$/.test(fields.sock??'')
 &&pid&&port>=8900&&port<=8999&&pidFile?.trim()===String(pid)&&fields.birth
 &&run('env','LC_ALL=C','ps','-p',String(pid),'-o','lstart=').stdout.toString().trim()===fields.birth.trim()
 &&run('lsof','-nP','-a','-p',String(pid),`-iTCP:${port}`,'-sTCP:LISTEN','-t').stdout.toString().trim()===String(pid))identity='matched';
if(identity==='matched'&&fields.host===host&&/^(127\.0\.0\.1|100\.(?:\d{1,3}\.){2}\d{1,3})$/.test(host??'')){
 const token=await read('.testinstanz.token');
 if(token){const p=run('curl','--silent','--max-time','1','--max-redirs','0','--output','/dev/null','--write-out','%{http_code}',`http://${host}:${port}/api/sessions`,'-H',`authorization: Bearer ${token.trim()}`);
 httpStatus=p.exitCode===28?'timeout':p.exitCode!==0?'failed':p.stdout.toString()==='200'?'healthy':'failed';}
}
const fact=(key)=>{try{const value=JSON.parse(fields[key]);return value&&typeof value==='object'?{head:/^[0-9a-f]{40}$/.test(value.head??'')?value.head:null,branch:typeof value.branch==='string'?value.branch:null,dirty:Number.isInteger(value.dirty)&&value.dirty>=0?value.dirty:null,measuredAt:Number.isSafeInteger(value.measuredAt)?value.measuredAt:null}:null;}catch{return null;}};
const before=fact('sourceBefore'),after=fact('sourceAfter');
const copyHead=null;
const connLines=(process.env.TI_STATUS_CONNS??'').split('\n').filter(Boolean);
const connections=process.env.TI_STATUS_CONNS_KNOWN==='1'?{count:connLines.length,peers:[...new Set(connLines.map(l=>l.replace(/.*->/,'').replace(/:\d+$/,'')))]}:null;
console.log(JSON.stringify({state:!raw?'not-running':expiresAt!==null&&expiresAt<=observedAt?'expired':procStatus==='dead'?'not-running':identity!=='matched'?'unknown':httpStatus==='healthy'?'up':httpStatus==='timeout'?'http-timeout':httpStatus==='failed'?'http-failed':'unknown',
 recordedSource:raw?{path:fields.src===src?src:null,before,after}:null,copyHead,mode:['mixed','snapshot'].includes(fields.mode)?fields.mode:null,
 copyStartedAt:number('copyStartedAt')===null?null:number('copyStartedAt')*1000,copyFinishedAt:number('copyFinishedAt')===null?null:number('copyFinishedAt')*1000,builtAt:number('builtAt')===null?null:number('builtAt')*1000,
 startedAt:number('started')===null?null:number('started')*1000,expiresAt,remainingTTL:expiresAt===null?null:Math.max(0,expiresAt-observedAt),
 ageMs:number('started')===null?null:Math.max(0,observedAt-number('started')*1000),connections,port,procStatus,httpStatus,identity,observedAt}));
JS
    exit 0
  fi
  if ti_alive; then echo "up   pid $(cat "$PIDF")   http://$(ti_addr):$PORT/?token=$(cat "$TOKF")"
  else echo "down (no live pid in $PIDF)"; fi
  echo "tmux sessions on socket $SOCK: $(tmux -L "$SOCK" list-sessions 2>/dev/null | wc -l | tr -d ' ')"
  if [ -f "$STATE" ]; then
    TI_STARTED=$(sed -n 's/^started=//p' "$STATE" | head -1)
    case "$TI_STARTED" in
      ''|*[!0-9]*) echo "age: unknown (state has no started)" ;;
      *) TI_AGE=$(( $(date +%s) - TI_STARTED ))
         echo "age: $((TI_AGE / 3600)) h $((TI_AGE % 3600 / 60)) min (started=$TI_STARTED)" ;;
    esac
    TI_EXP=$(sed -n 's/^expiresAt=//p' "$STATE" | head -1)
    case "$TI_EXP" in
      ''|*[!0-9]*) : ;;
      *) TI_NOW=$(date +%s)
         if [ "$TI_NOW" -lt "$TI_EXP" ]; then
           echo "ttl: $(( (TI_EXP - TI_NOW + 59) / 60 )) min left (expiresAt=$TI_EXP)"
         else
           echo "ttl: EXPIRED $(( (TI_NOW - TI_EXP) / 60 )) min ago — the next reap tick removes it unless a connection is open"
         fi ;;
    esac
  fi
  if [ "$TI_CONNS_KNOWN" = 0 ]; then
    echo "connections: UNKNOWN on port $PORT (neither lsof nor ss on this host) — down and reap refuse without --force"
  elif [ -z "$TI_CONNS" ]; then
    echo "connections: 0 ESTABLISHED on port $PORT"
  else
    echo "connections: $(printf '%s\n' "$TI_CONNS" | grep -c .) ESTABLISHED on port $PORT from $(printf '%s\n' "$TI_CONNS" | ti_peers) — down and reap refuse without --force"
  fi
  if [ "$(sed -n 's/^realSeats=//p' "$STATE" 2>/dev/null | head -1)" = 1 ]; then
    TI_SL=$(ti_seats_live)
    echo "real seats: $(printf '%s\n' "$TI_SL" | grep -c " $DIR ") of this instance, $(printf '%s\n' "$TI_SL" | grep -c .) on this machine (cap $TI_SEAT_CAP)$( [ -f "$DIR/bin/.real-armed" ] && echo '' || echo ' — not armed yet')"
  fi
  echo "--- ./ctl.sh lock (this instance must NEVER appear as the holder)"
  ( cd "$SRC" && ./ctl.sh lock )
  ;;
list)
  # EVERY test instance of this machine, read ONLY from state files — never from ps (command
  # lines carry tokens) and never from sockets. The URL is printed WITHOUT its token; the worktree
  # shows whose instance this is. One without expiresAt is old: listed, never touched.
  TI_ADDR=$(ti_addr)
  TI_ANY=0
  for TI_S in "$TI_ROOT"/fleet-testinstanz-*/testinstanz.state; do
    [ -f "$TI_S" ] || continue
    TI_ANY=1
    TI_GV() { sed -n "s/^$1=//p" "$TI_S" | head -1; }
    TI_W=$(TI_GV src); TI_P=$(TI_GV port); TI_PP=$(TI_GV pid); TI_E=$(TI_GV expiresAt)
    TI_ST=down; TI_REST="-"
    case "$TI_PP" in ''|*[!0-9]*) : ;; *) kill -0 "$TI_PP" 2>/dev/null && TI_ST=up ;; esac
    case "$TI_E" in
      ''|*[!0-9]*) TI_REST="no-expiresAt (old)" ;;
      *) TI_NOW=$(date +%s)
         if [ "$TI_NOW" -lt "$TI_E" ]; then TI_REST="$(( (TI_E - TI_NOW + 59) / 60 )) min"
         else TI_REST=EXPIRED; fi ;;
    esac
    echo "$TI_ST  port $TI_P  rest $TI_REST  $TI_W  http://$TI_ADDR:$TI_P/"
  done
  [ "$TI_ANY" = 1 ] || echo "no test instances on this machine (state files under $TI_ROOT/fleet-testinstanz-*/)"
  ;;
down)
  if ti_alive; then
    ti_owned || { echo 'refused: instance identity is unknown; nothing stopped' >&2; exit 2; }
  elif [ -f "$STATE" ]; then
    [ "$(sed -n 's/^src=//p' "$STATE")" = "$SRC" ] && [ "$(sed -n 's/^dir=//p' "$STATE")" = "$DIR" ] && [ "$(sed -n 's/^sock=//p' "$STATE")" = "$SOCK" ] || { echo 'refused: foreign instance state' >&2; exit 2; }
    if tmux -L "$SOCK" list-sessions >/dev/null 2>&1; then echo 'refused: unknown socket owner' >&2; exit 2; fi
  else
    echo 'down: no known instance'; exit 0
  fi
  # AN OPEN CONNECTION IS SOMEBODY LOOKING. Without --force `down` names who and stops (exit 3);
  # a host that cannot see connections cannot rule one out, and refuses the same way.
  if [ "${2:-}" != --force ]; then
    if TI_CONNS=$(ti_conns "$PORT"); then
      if [ -n "$TI_CONNS" ]; then
        echo "refused: $(printf '%s\n' "$TI_CONNS" | grep -c .) ESTABLISHED connection(s) on port $PORT from $(printf '%s\n' "$TI_CONNS" | ti_peers) — an open tab; nothing stopped (down --force stops it anyway)" >&2
        exit 3
      fi
    else
      echo "refused: cannot see connections on port $PORT (neither lsof nor ss); nothing stopped (down --force stops it anyway)" >&2
      exit 3
    fi
  fi
  # REAL SEATS FIRST, by their registered pid (ti_end_seats); then, once tmux is gone, whatever still runs with its cwd
  # inside the directory — a seat's tool commands and its TTL watchdog — the sweep ti_retire does for the reap
  TI_DOWN_REAL=$(sed -n 's/^realSeats=//p' "$STATE" 2>/dev/null | head -1)
  TI_ENDED=$(ti_end_seats "$DIR")
  ti_alive && kill "$(cat "$PIDF")" 2>/dev/null || true
  # By SOCKET NAME, never a name pattern: `pkill -f` on this machine reaches the live server and
  # the post-land audit (AGENTS.md §Verify).
  tmux -L "$SOCK" kill-server 2>/dev/null || true
  if [ "$TI_DOWN_REAL" = 1 ]; then
    TI_REAL_DIR=$(cd "$DIR" 2>/dev/null && pwd -P) || TI_REAL_DIR=""
    case "$TI_REAL_DIR" in */fleet-testinstanz-?*) : ;; *) TI_REAL_DIR="" ;; esac
    TI_ORPH=""
    if [ -n "$TI_REAL_DIR" ]; then
      for TI_OP in $(ti_cwd_pids "$TI_REAL_DIR"); do case "$TI_OP" in "$$"|1) continue ;; esac; TI_ORPH="$TI_ORPH $TI_OP"; done
    fi
    if [ -n "$TI_ORPH" ]; then kill -TERM $TI_ORPH 2>/dev/null || true; sleep 1; kill -KILL $TI_ORPH 2>/dev/null || true; fi
    TI_ENDED="${TI_ENDED:-real seats ended: 0}, $(echo $TI_ORPH | wc -w | tr -d ' ') process(es) inside the dir ended"
  fi
  # …and the socket FILE, which tmux leaves behind (e2e-stage.sh's dead-socket reap)
  TI_SOCKF="${TMUX_TMPDIR:-/tmp}/tmux-$(id -u)/$SOCK"
  if [ -S "$TI_SOCKF" ] && ! tmux -L "$SOCK" list-sessions >/dev/null 2>&1; then rm -f "$TI_SOCKF"; fi
  # The dying panes' zsh still writes $DIR/home/.zsh_history after kill-server returns; a single
  # rm raced it ("Directory not empty", 2026-09-21). One retry after the shells are gone.
  rm -rf "$DIR" 2>/dev/null || { sleep 1; rm -rf "$DIR"; }
  # The claim is checked, not asserted: a still-bound port means something is serving that this
  # script did not stop, and the honest answer is to NAME it rather than reach for a pattern kill.
  sleep 1
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "down: dir and tmux gone, but port $PORT is STILL BOUND:" >&2
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >&2
    exit 1
  fi
  echo "down: server stopped, port $PORT free, tmux -L $SOCK killed, $DIR removed${TI_ENDED:+ · $TI_ENDED}"
  ;;
reap)
  # THE TTL TICK'S HAND. Every instance of this machine, read from its state file under the SAME
  # root `up` wrote it to; scratch-reap.sh calls this at each e2e-isolated.sh start, so an expired
  # instance dies whether or not the lane that started it still exists. Four outcomes per state
  # file, each one line: not yet expired (counted), no usable expiresAt (listed, never touched —
  # missing proof of expiry is absence of authority), an OPEN CONNECTION on its port (refused
  # without --force, peers named: the 2026-10-08 :8902 lesson), or retired by ti_retire.
  shift
  TI_DRY=""; TI_FORCE=""
  for TI_A in "$@"; do
    case "$TI_A" in
      --dry-run) TI_DRY=1 ;;
      --force) TI_FORCE=1 ;;
      *) echo "usage: ./testinstanz.sh reap [--dry-run] [--force]" >&2; exit 2 ;;
    esac
  done
  TI_NOW=$(date +%s); TI_REAPED=0; TI_HELD=0; TI_OPEN=0; TI_OLD=0
  for TI_S in "$TI_ROOT"/fleet-testinstanz-*/testinstanz.state; do
    [ -f "$TI_S" ] || continue                            # no glob match → the pattern itself
    TI_D=$(dirname "$TI_S")
    TI_GV() { sed -n "s/^$1=//p" "$TI_S" | head -1; }
    TI_PP=$(TI_GV pid); TI_K=$(TI_GV sock); TI_E=$(TI_GV expiresAt); TI_P=$(TI_GV port)
    case "$TI_E" in
      '') echo "[testinstanz-reap] kept $TI_D — state has no expiresAt (old instance), listed only"
          TI_OLD=$((TI_OLD + 1)); continue ;;
      *[!0-9]*) echo "[testinstanz-reap] kept $TI_D — unreadable expiresAt, listed only" >&2
          TI_OLD=$((TI_OLD + 1)); continue ;;
    esac
    if [ "$TI_NOW" -lt "$TI_E" ]; then TI_OPEN=$((TI_OPEN + 1)); continue; fi
    if [ -z "$TI_K" ] || [ "$TI_K" = claudefleet ]; then
      echo "[testinstanz-reap] REFUSED $TI_D — state names the production socket or none" >&2
      continue
    fi
    case "$TI_P" in ''|*[!0-9]*) TI_P="" ;; esac
    TI_AGO=$(( (TI_NOW - TI_E) / 60 ))
    if [ -z "$TI_FORCE" ]; then
      if TI_CONNS=$(ti_conns "$TI_P"); then
        if [ -n "$TI_CONNS" ]; then
          echo "[testinstanz-reap] REFUSED $TI_D — expired $TI_AGO min ago, but $(printf '%s\n' "$TI_CONNS" | grep -c .) ESTABLISHED connection(s) on port $TI_P from $(printf '%s\n' "$TI_CONNS" | ti_peers); reap --force retires it"
          TI_HELD=$((TI_HELD + 1)); continue
        fi
      else
        echo "[testinstanz-reap] REFUSED $TI_D — expired $TI_AGO min ago, and port ${TI_P:-?} cannot be checked for open connections (no port in state, or neither lsof nor ss); reap --force retires it"
        TI_HELD=$((TI_HELD + 1)); continue
      fi
    fi
    if [ -n "$TI_DRY" ]; then
      echo "[testinstanz-reap] would remove $TI_D — expired $TI_AGO min ago (pid ${TI_PP:-none}, port ${TI_P:-?}, tmux -L $TI_K)"
      TI_REAPED=$((TI_REAPED + 1)); continue
    fi
    ti_retire "$TI_D" "$TI_PP" "$TI_P" "$TI_K"
    if [ -e "$TI_D" ]; then
      echo "[testinstanz-reap] FAILED $TI_D — expired $TI_AGO min ago, directory still there ($TI_WHY, tmux -L $TI_K killed)" >&2
    else
      echo "[testinstanz-reap] removed $TI_D — expired $TI_AGO min ago ($TI_WHY, tmux -L $TI_K killed, dir removed)"
      TI_REAPED=$((TI_REAPED + 1))
    fi
  done
  echo "[testinstanz-reap] ${TI_REAPED} expired reaped · ${TI_HELD} refused (open connection) · ${TI_OPEN} not yet expired · ${TI_OLD} without usable expiresAt (listed, never touched) · root $TI_ROOT"
  ;;
*)
  echo "usage: ./testinstanz.sh up [mixed|snapshot] [--ttl <min>] | refresh | fixtures [mixed|full] | succession | states | probe <METHOD> /path [--as owner|none|self:<slot>] [--body <file>] | status | source | list | down [--force] | reap [--dry-run] [--force]" >&2; exit 2;;
esac

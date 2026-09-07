#!/bin/sh
# ctl.sh — the Fleet controller's mechanical moves, as verbs instead of hand-typed curl.
#
# WHY THIS EXISTS. A controller (or any MAIN) spends its turns on DECISIONS; the moves that carry
# them are mechanical and were being retyped every session. Measured in one controller night
# (2026-09-07 04:44–05:20, slot 10): `{"slot":1}` instead of `{"target":1}` in a watch body (400
# "bad target"), a SHORT sha in an audit watch (400 — the route wants a full object id), three
# attempts at the fleetReports field shape, and three scratch monitors written from scratch because
# the last session's died with its scratchpad. None of that is judgement. All of it costs a turn,
# and a weaker model in the role pays it twice.
#
# WHAT IT IS NOT. It adds no capability: every verb goes through a route that already exists, with
# the credential the caller already has. It decides nothing — no verb picks a lane, a task or a
# moment. What it removes is the retyping and the field-shape guessing.
#
# TOKEN HYGIENE (CLAUDE.md §Self-scheduling). ensureSlot bakes the self-credentials into every
# pane's zsh string, so `ps -eo command` prints FOREIGN slots' tokens. NOTHING in this file ever
# prints a process command line — `lock` deliberately reports pid/birth/elapsed and NOT the
# holder's command, which is the one place e2e-stage.sh's own wait message does print one.
#
# THE VERB LIST IS A CONTRACT. CTL_VERBS below is the single source for the usage block AND for
# e2e/pins.ts, which holds it against §Werkzeuge in docs/controller.md in both directions: a verb
# with no paragraph, and a paragraph with no verb, are both failures. A dash in a verb name is the
# CLI's space — `wait-merge` is typed `./ctl.sh wait merge 5`.
set -u

CTL_VERBS="merges lock ctx report watch events land dispatch wait-merge wait-change"

usage() {
  cat <<'USAGE'
ctl.sh — the controller's mechanical moves. One decision per call, made by you, not by this script.

  merges [--json]                  which lands are persisted/unfinished; exit 1 while one is in flight
  lock [--reap] [--json]           suite-mutex health; --reap removes a lock whose holder is dead
  ctx [slot] [--json]              measured context fill of a slot (default: your own)
  report <taskId> [--full] [--json]   the newest fleet-report filed for that task
  watch lane|merge <slot> | audit <sha> [--repo <path>] [--idle <sec>] [--json]
                                   arm one self-watch; idleSec defaults to 0
  events [--ack] [--json]          your own FleetEvents; --ack closes the delivered ones
  land <slot> [--wait] [--json]    POST the land; --wait blocks to the verdict and arms the audit watch
  dispatch <taskId> [--force] [--json]   hand-start a queued row, refusing over the lane cap
  wait merge <slot> [--json]       block until that lane's merge is terminal
  wait change [--tasks a,b,c] [--json]   block until fleet state moves, then print what moved

Credentials (each verb names the one it is missing and exits 2):
  FLEET_CTL_URL    else FLEET_HOST from <home>/.env, port FLEET_PORT or 8790
  FLEET_CTL_TOKEN  else FLEET_TOKEN, else `token` in <home>/fleet.json   (owner verbs)
  FLEET_SELF_TOKEN as exported into every pane                           (self verbs)
  FLEET_CTL_HOME   the checkout holding fleet.json/.env/the ledgers (default: the main checkout)
USAGE
}

# --- where home is -----------------------------------------------------------------------------
# fleet.json, .env and the three ledgers are gitignored and live ONLY in the main checkout, so a
# LANE running this script must look there — the same anchor state.sh uses, and for the same reason.
# FLEET_CTL_HOME overrides it outright, which is how the suite points these verbs at a throwaway
# instance instead of the live fleet.
rp() { [ -n "${1:-}" ] && (cd "$1" 2>/dev/null && pwd -P) || printf '%s\n' "${1:-}"; }
CTL_DIR=$(rp "$(dirname "$0")")
if [ -n "${FLEET_CTL_HOME:-}" ]; then
  HOME_DIR=$(rp "$FLEET_CTL_HOME")
else
  HOME_DIR=$(rp "$(dirname "$(git -C "$CTL_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")")
  [ -f "$HOME_DIR/server.ts" ] || HOME_DIR=$CTL_DIR
fi
export CTL_HOME="$HOME_DIR"

# --- base url ----------------------------------------------------------------------------------
if [ -n "${FLEET_CTL_URL:-}" ]; then
  CTL_URL=${FLEET_CTL_URL%/}
else
  _host=""; _port=""
  if [ -f "$HOME_DIR/.env" ]; then
    _host=$(sed -n "s/^FLEET_HOST=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$HOME_DIR/.env" | tail -1)
    _port=$(sed -n "s/^FLEET_PORT=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$HOME_DIR/.env" | tail -1)
  fi
  [ -n "$_host" ] || _host=127.0.0.1
  [ -n "$_port" ] || _port=8790
  CTL_URL="http://$_host:$_port"
fi
export CTL_URL

# --- credentials, resolved lazily: a verb that needs none must never fail for want of one --------
owner_token() {
  if [ -n "${FLEET_CTL_TOKEN:-}" ]; then printf '%s' "$FLEET_CTL_TOKEN"; return 0; fi
  if [ -n "${FLEET_TOKEN:-}" ]; then printf '%s' "$FLEET_TOKEN"; return 0; fi
  [ -f "$HOME_DIR/fleet.json" ] || return 1
  # the token is the FIRST key saveState writes, one per line (JSON.stringify(..., null, 2))
  sed -n 's/^  "token": "\([^"]*\)".*/\1/p' "$HOME_DIR/fleet.json" | head -1
}
need_owner() {
  CTL_TOKEN=$(owner_token 2>/dev/null || true)
  if [ -z "${CTL_TOKEN:-}" ]; then
    printf 'ctl.sh %s: no owner token — set FLEET_CTL_TOKEN, or run where %s/fleet.json is readable\n' \
      "$1" "$HOME_DIR" >&2
    exit 2
  fi
  export CTL_TOKEN
}
need_self() {
  if [ -z "${FLEET_SELF_TOKEN:-}" ]; then
    printf 'ctl.sh %s: no self token — FLEET_SELF_TOKEN is exported into every Fleet pane; this shell has none\n' "$1" >&2
    exit 2
  fi
  export CTL_SELF="$FLEET_SELF_TOKEN"
}
need_state() {
  if [ ! -f "$HOME_DIR/fleet.json" ]; then
    printf 'ctl.sh %s: %s/fleet.json is not readable — set FLEET_CTL_HOME to the checkout the server runs in\n' \
      "$1" "$HOME_DIR" >&2
    exit 2
  fi
}

# --- the embedded bun program ------------------------------------------------------------------
# The JS travels through a TEMP MODULE, never through `$(cat <<EOF)`. That shape looks tidier and is
# a trap: bash 3.2 (which is `sh` on this machine) re-scans a here-document nested inside a command
# substitution for the closing paren and gets it wrong the moment the body carries nested quotes —
# measured here, the `lock` block's `grep -c '^/bin/sh ...'` line made the shell swallow the branch's
# own `;;` and run the NEXT verb's program instead. A plain heredoc REDIRECTION is parsed by nobody.
CTL_TMP="${TMPDIR:-/tmp}/ctl.$$.mjs"
trap 'rm -f "$CTL_TMP"' EXIT INT TERM
js_head() { cat > "$CTL_TMP" <<'EOF'
const HOME = process.env.CTL_HOME, URL_ = process.env.CTL_URL;
const JSONOUT = process.env.CTL_JSON === "1";
const fs = require("fs");
const readState = () => JSON.parse(fs.readFileSync(HOME + "/fleet.json", "utf8"));
const ownerH = () => ({ "content-type": "application/json", authorization: "Bearer " + process.env.CTL_TOKEN });
const selfH = () => ({ "content-type": "application/json", "x-fleet-self-token": process.env.CTL_SELF });
const api = async (path, opts = {}) => {
  const r = await fetch(URL_ + path, opts);
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 400) }; }
  return { status: r.status, ok: r.ok, body };
};
const out = (obj, lines) => {
  if (JSONOUT) console.log(JSON.stringify(obj, null, 2));
  else for (const l of lines) console.log(l);
};
const ms = (n) => (typeof n === "number" ? Math.round(n / 1000) + "s" : "?");
// The six verify states server.ts names, kept apart on purpose: a skip, a timeout and a
// never-started are three different non-measurements and none of them is a pass.
const verifyWord = (v) => {
  if (!v) return "none";
  if (v.ok === true) return "ok";
  if (v.ok === false) return "FAILED";
  if (v.waitedOut) return "waitedOut";
  if (v.timedOut) return "timedOut";
  return "skipped";
};
EOF
}
js_run() { bun "$CTL_TMP"; }

verb=${1:-}
[ -n "$verb" ] || { usage; exit 0; }
shift 2>/dev/null || true
# `wait merge` / `wait change` are one verb each, typed with a space
if [ "$verb" = "wait" ]; then
  sub=${1:-}
  [ -n "$sub" ] || { printf 'ctl.sh wait: say `wait merge <slot>` or `wait change`\n' >&2; exit 2; }
  shift
  verb="wait-$sub"
fi

CTL_JSON=0
export CTL_JSON

case "$verb" in

# ================================================================================================
merges)
# ------------------------------------------------------------------------------------------------
# The land sensor. The PERSISTED half comes from fleet.json (`merges`, one MergeLast per slot); the
# LIVE half needs the owner token and is asked per slot (GET /api/slots/:id/merge → running). Both
# are reported, and the absence of the live half is stated rather than filled in with the persisted
# one: "no land is recorded" and "no land is running" are different sentences.
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; *) printf 'merges: unknown flag %s\n' "$a" >&2; exit 2 ;; esac; done
  need_state merges
  CTL_TOKEN=$(owner_token 2>/dev/null || true); export CTL_TOKEN
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const st = readState();
const merges = st.merges ?? {};
// THE UNION, and the reason it is a union and not the merges map: a lane's FIRST land has no
// persisted verdict while it runs (mergeLast is written when the job settles), so a rows list built
// from `merges` alone would probe that lane live and then drop it — the sensor would answer "nothing
// is running" about the exact case it exists for. Every open LANE is therefore a row too, carrying
// `status: null` until a verdict exists.
const live = process.env.CTL_TOKEN ? {} : null;
const subjects = new Set(Object.keys(merges));
for (const [id, s] of Object.entries(st.slots ?? {})) if (s.worktree) subjects.add(id);
if (live) {
  for (const id of subjects) {
    const r = await api("/api/slots/" + id + "/merge", { headers: ownerH() });
    live[id] = r.status === 400 ? { gone: true, running: false } : { running: r.body?.running === true };
  }
}
const rows = [...subjects].map((slot) => {
  const m = merges[slot] ?? null;
  return {
    slot: Number(slot),
    status: m ? m.status : null,
    landed: m ? m.landed === true : false,
    hasVerify: !!m?.verify, verify: verifyWord(m?.verify),
    branch: m?.branch ?? st.slots?.[slot]?.worktree?.branch ?? null,
    at: m?.at ?? null,
    running: live ? (live[slot]?.running ?? false) : null,
  };
}).sort((a, b) => a.slot - b.slot);
// EXIT 1 = "a land is in flight or unfinished — wait". Two facts feed it, and both are honest
// about what they saw: a LIVE running job, and a persisted `interrupted` verdict (the process that
// was landing died mid-flight, so the tree state is exactly what nobody knows). An `interrupted`
// row that DOES carry a verify was at least measured and is reported, not counted as in-flight.
const busy = rows.filter((r) => r.running === true || (r.status === "interrupted" && !r.hasVerify));
// A GREEN LAND LEAVES NO ROW. server.ts deletes `mergeLast[slot]` together with the lane it landed
// (grep `mergeLast.delete`), so this map is a register of lands that did NOT finish plus, with the
// live half, the ones running right now — never a land history. The history is lane-outcomes.jsonl
// and the fleet/land notes, and reading an empty map as "nothing has landed" is backwards.
const lines = rows.length === 0 ? ["no lane is open and no unfinished land is persisted (a completed land leaves no row — see lane-outcomes.jsonl for the history)"]
  : rows.map((r) => `slot ${r.slot}  ${r.status ?? "no verdict yet"}  landed=${r.landed ? "YES" : "no"}  verify=${r.verify}`
    + `  running=${r.running === null ? "UNKNOWN" : r.running ? "YES" : "no"}  ${r.branch ?? ""}`);
if (!live) lines.push("live half UNKNOWN — no owner token, so `running` was never asked (not the same as no)");
if (busy.length) lines.push(`WAIT: ${busy.map((r) => r.slot).join(", ")} — a land is running or was interrupted without a verdict`);
out({ rows, busy: busy.map((r) => r.slot), liveKnown: !!live }, lines);
process.exit(busy.length ? 1 : 0);
EOF
  js_run
  ;;

# ================================================================================================
lock)
# ------------------------------------------------------------------------------------------------
# Suite-mutex health, in e2e-stage.sh's own three-way vocabulary (held · stale · parked) plus the
# two it cannot have: FREE (no dir) and UNKNOWN (a live pid whose birth fingerprint is missing or
# unmeasurable — never reaped on a guess).
#
# THE REAP GUARD, and why it is narrower than it looks. `--reap` needs the recorded pid to be dead
# (or its birth fingerprint changed — a recycled pid), and then re-checks pid AND birth immediately
# before the rmdir, exactly as e2e-stage.sh does. On the MACHINE-WIDE default lock it additionally
# refuses while any wrapper process is running, because a wrapper one syscall away from writing its
# pid file would be reaped out from under itself. That guard is deliberately NOT applied to a lock
# path the caller named itself: a probe pointed at a private lock must get a private answer, and a
# wrapper count says nothing whatever about a lock no wrapper uses.
  reap=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --reap) reap=1 ;; *) printf 'lock: unknown flag %s\n' "$a" >&2; exit 2 ;; esac; done
  export CTL_REAP=$reap
  export CTL_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"
  export CTL_LOCK_IS_DEFAULT=$([ -n "${FLEET_SUITE_LOCK:-}" ] && echo 0 || echo 1)
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const { spawnSync } = require("child_process");
const LOCK = process.env.CTL_LOCK;
const sh = (cmd, args) => (spawnSync(cmd, args, { encoding: "utf8" }).stdout ?? "").trim();
// LC_ALL=C for the same reason e2e-stage.sh sets it: `ps -o lstart=` is locale-formatted, and a
// German helper prints "Di Sep  1 …" which no fingerprint comparison can match.
const birthOf = (pid) => (spawnSync("ps", ["-o", "lstart=", "-p", String(pid)],
  { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout ?? "").trim().replace(/\s+/g, " ");
const alive = (pid) => spawnSync("kill", ["-0", String(pid)]).status === 0;
const rd = (p) => { try { return fs.readFileSync(p, "utf8").trim(); } catch { return ""; } };
const exists = (p) => { try { fs.statSync(p); return true; } catch { return false; } };

// The weakest of the three sensors CLAUDE.md names, and it has three known zero-windows (a gate or
// audit running install/pins/tsc/build before its first wrapper; the server's own ff-retry hold).
// COUNTED, never printed as a line: a wrapper's command line is a process command line.
const wrappers = Number(sh("sh", ["-c", "ps -eo command | grep -c '^/bin/sh \\./e2e-'"]) || 0);

const pid = rd(LOCK + "/pid");
const birth = rd(LOCK + "/birth");
let state, why, holderAlive = null, birthState = null;
if (!exists(LOCK)) { state = "free"; why = "no lock directory — the mutex is free"; }
else if (!pid) {
  state = birth ? "stale" : "parked";
  why = birth ? "a process-birth fingerprint but NO pid — a torn acquisition"
    : "the dir carries NO pid file — a human parked the machine; nothing will ever reap it";
} else {
  holderAlive = alive(pid);
  if (!holderAlive) { state = "stale"; birthState = "holder-gone"; why = `recorded pid ${pid} is gone, nothing is running`; }
  else {
    const now = birthOf(pid);
    if (!birth) { state = "unknown"; birthState = "missing"; why = `pid ${pid} is alive but the lock has no birth fingerprint — not reaping a possibly live legacy holder`; }
    else if (!now) { state = "unknown"; birthState = "unmeasurable"; why = `pid ${pid} is alive but its birth fingerprint is unmeasurable — not reaping a possibly live holder`; }
    else if (now === birth) { state = "held"; birthState = "matched"; why = `held by live pid ${pid} with proven identity`; }
    else { state = "stale"; birthState = "changed"; why = `pid ${pid} is alive but its birth fingerprint changed — a recycled-pid lock`; }
  }
}
let tickets = 0;
try { tickets = fs.readdirSync(LOCK + ".q").filter((n) => /^t\d+\.\d+$/.test(n)).length; } catch { /* no queue dir */ }
const ageMs = (() => { try { return Date.now() - fs.statSync(LOCK).mtimeMs; } catch { return null; } })();

let reaped = false, reapRefused = null;
if (process.env.CTL_REAP === "1") {
  if (state !== "stale") reapRefused = `state is ${state}, not stale — only a lock whose holder is provably gone may be reaped`;
  else if (process.env.CTL_LOCK_IS_DEFAULT === "1" && wrappers > 0)
    reapRefused = `${wrappers} suite wrapper(s) are running and this is the machine-wide lock — one of them may be a syscall away from writing its pid`;
  else {
    // re-read both files immediately before the rmdir: the reap/re-acquire race is microseconds wide
    if (rd(LOCK + "/pid") === pid && rd(LOCK + "/birth") === birth) {
      try { fs.rmSync(LOCK + "/pid", { force: true }); fs.rmSync(LOCK + "/birth", { force: true }); fs.rmdirSync(LOCK); reaped = true; }
      catch (e) { reapRefused = "rmdir failed: " + String(e).slice(0, 120); }
    } else reapRefused = "the lock changed under us between the read and the reap — left alone";
  }
}
const lines = [
  `lock ${LOCK}: ${reaped ? "REAPED (was stale)" : state.toUpperCase()}`,
  `  ${why}`,
  `  pid ${pid || "-"}  alive=${holderAlive === null ? "-" : holderAlive ? "yes" : "no"}  birth=${birthState ?? "-"}`,
  `  age ${ms(ageMs)}  tickets ${tickets}  wrappers ${wrappers}`,
];
if (reapRefused) lines.push(`  reap REFUSED: ${reapRefused}`);
out({ lock: LOCK, state, reaped, reapRefused, pid: pid || null, holderAlive, birthState, tickets, wrappers, ageMs, why }, lines);
// 0 = the machine is yours (free, or the stale lock is now gone). 1 = something holds it.
process.exit(state === "free" || reaped ? 0 : 1);
EOF
  js_run
  ;;

# ================================================================================================
ctx)
# ------------------------------------------------------------------------------------------------
# The MEASURED fill, off /api/sessions (server.ts#contextFill). `null` is an ANSWER — "Fleet cannot
# tell for this harness/model" — and is printed as UNMEASURABLE, never as 0.
  slot=""
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --*) printf 'ctx: unknown flag %s\n' "$a" >&2; exit 2 ;; *) slot=$a ;; esac; done
  [ -n "$slot" ] || slot=${FLEET_SELF_SLOT:-}
  if [ -z "$slot" ]; then
    printf 'ctx: no slot — give one, or run in a pane where FLEET_SELF_SLOT is exported\n' >&2; exit 2
  fi
  need_owner ctx
  export CTL_SLOT="$slot"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const want = Number(process.env.CTL_SLOT);
const r = await api("/api/sessions", { headers: ownerH() });
if (!r.ok) { console.error(`ctx: /api/sessions ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); process.exit(2); }
const s = (r.body.slots ?? []).find((x) => x.id === want);
if (!s) { console.error(`ctx: no slot ${want} on this fleet`); process.exit(1); }
const c = s.ctx ?? null;
const lines = c
  ? [`slot ${want} (${s.label ?? "-"}): ${c.pct}% — ${c.usedTokens} of ${c.windowTokens} tokens`]
  : [`slot ${want} (${s.label ?? "-"}): UNMEASURABLE — Fleet cannot read this session's context (not the same as empty)`];
out({ slot: want, label: s.label ?? null, ctx: c, occupied: s.cwd !== null }, lines);
process.exit(c ? 0 : 1);
EOF
  js_run
  ;;

# ================================================================================================
report)
# ------------------------------------------------------------------------------------------------
# The newest fleet-report filed for one task, off GET /api/self/fleet-report — which is scoped to
# the caller's own occupant (worker arm or receiver arm). A report filed to the OWNER inbox has no
# receiver occupant and is therefore invisible here by construction, not by omission.
  task=""; full=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --full) full=1 ;; --*) printf 'report: unknown flag %s\n' "$a" >&2; exit 2 ;; *) task=$a ;; esac; done
  [ -n "$task" ] || { printf 'report: give a task id\n' >&2; exit 2; }
  need_self report
  export CTL_TASK="$task" CTL_FULL="$full"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const want = process.env.CTL_TASK;
const r = await api("/api/self/fleet-report", { headers: selfH() });
if (!r.ok) { console.error(`report: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); process.exit(2); }
const all = (r.body.reports ?? []).filter((x) => x?.provenance?.taskId === want);
if (!all.length) {
  console.error(`report: no fleet-report for task ${want} is visible to this session (${(r.body.reports ?? []).length} report(s) in total)`);
  process.exit(1);
}
const rep = all.sort((a, b) => b.reportedAt - a.reportedAt)[0];
const d = rep.decision ?? null;
const text = String(rep.text ?? "");
const shown = process.env.CTL_FULL === "1" ? text : text.split("\n").slice(0, 20).join("\n");
const lines = [
  `report ${rep.id}  ${new Date(rep.reportedAt).toISOString()}`,
  `  status ${rep.status}   basis ${rep.basis}`,
  `  worker slot ${rep.worker?.slot} (${rep.worker?.branch ?? "-"})   receiver ${rep.receiver ? "slot " + rep.receiver.slot : "owner-inbox"}`,
  `  decision ${d ? `${d.disposition} by slot ${d.by?.slot ?? "?"} at ${new Date(d.at).toISOString()}` : "UNDECIDED"}`,
  `  task ${rep.provenance?.taskId ?? "-"}   program ${rep.provenance?.programId ?? "-"}`,
  "",
  shown,
];
if (shown.length < text.length) lines.push(`… [${text.split("\n").length - 20} more lines — --full]`);
out({ report: rep, total: all.length }, lines);
EOF
  js_run
  ;;

# ================================================================================================
watch)
# ------------------------------------------------------------------------------------------------
# One self-watch, with the two field shapes that cost turns on 2026-09-07: the subject slot is
# `target` (never `slot`), and an audit's `mainAfter` must be a FULL object id — a short sha is a
# 400. Both are handled here: the slot goes on `target`, and a short sha is resolved through
# `git rev-parse` before the request is built.
#
# idleSec DEFAULTS TO 0, which is the opposite of the route's own default and deliberate: a working
# controller never goes 60 s idle, so a watch armed at 60 delivers nothing. Measured the same night
# — two lane watches died `subject-gone` and a merge watch stayed `pending` — while every one of
# them held delivery budget the whole time.
  kind=${1:-}; [ -n "$kind" ] || { printf 'watch: say `watch lane|merge <slot>` or `watch audit <sha>`\n' >&2; exit 2; }
  shift
  arg=""; repo=""; idle=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --json) CTL_JSON=1 ;;
      --repo) shift; repo=${1:-} ;;
      --idle) shift; idle=${1:-0} ;;
      --*) printf 'watch: unknown flag %s\n' "$1" >&2; exit 2 ;;
      *) arg=$1 ;;
    esac
    shift
  done
  [ -n "$arg" ] || { printf 'watch %s: give a slot number (lane/merge) or a sha (audit)\n' "$kind" >&2; exit 2; }
  need_self watch
  if [ "$kind" = "audit" ]; then
    [ -n "$repo" ] || repo=$HOME_DIR
    # --verify --quiet AND ^{commit}: a bare `git rev-parse <hex>` ECHOES an unknown 16-hex string
    # back and exits 128, so the naive form would have handed the route a made-up id and blamed the
    # 400 on the route. This form prints only an object that exists in this repo, or nothing.
    full=$(git -C "$repo" rev-parse --verify --quiet "$arg^{commit}" 2>/dev/null || true)
    if [ -z "$full" ]; then
      printf 'watch audit: %s names no commit in %s — the route wants a FULL object id of a real land and 400s on anything else\n' "$arg" "$repo" >&2
      exit 2
    fi
    export CTL_MAIN_AFTER="$full" CTL_REPO="$repo"
  else
    export CTL_TARGET="$arg"
  fi
  export CTL_KIND="$kind" CTL_IDLE="$idle"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const kind = process.env.CTL_KIND;
if (!["lane", "merge", "audit"].includes(kind)) { console.error(`watch: kind must be lane, merge or audit — got ${kind}`); process.exit(2); }
const idleSec = Number(process.env.CTL_IDLE ?? 0) | 0;
const body = kind === "audit"
  ? { kind, repo: process.env.CTL_REPO, mainAfter: process.env.CTL_MAIN_AFTER, idleSec }
  : { kind, target: Number(process.env.CTL_TARGET), idleSec };
const r = await api("/api/self/watch", { method: "POST", headers: selfH(), body: JSON.stringify(body) });
if (!r.ok) {
  // verbatim: every rejection this route gives says "this watch could never fire", and paraphrasing
  // it is what turns a precise refusal into a guess.
  console.error(`watch ${kind}: ${r.status} ${r.body?.error ?? JSON.stringify(r.body).slice(0, 300)}`);
  if (JSONOUT) console.log(JSON.stringify({ ok: false, status: r.status, error: r.body?.error ?? null, body }, null, 2));
  process.exit(1);
}
const w = r.body.watch ?? {};
out({ ok: true, watch: w, existing: r.body.existing === true, request: body },
  [`watch ${kind} ${w.id}  armed=${w.armed}  idleSec=${w.idleSec}${r.body.existing ? "  (existing — same question, still armed)" : ""}`]);
EOF
  js_run
  ;;

# ================================================================================================
events)
# ------------------------------------------------------------------------------------------------
# Your own FleetEvents, off GET /api/self. `--ack` closes every event the route will accept
# (`delivered` and `send-uncertain` — pending was never offered, and an inbox row belongs to the
# owner). Acking matters: an unacknowledged event holds delivery budget, which is why "max 5 active
# watches per slot" can refuse a session that has only three armed.
  ack=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --ack) ack=1 ;; *) printf 'events: unknown flag %s\n' "$a" >&2; exit 2 ;; esac; done
  need_self events
  export CTL_ACK=$ack
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const r = await api("/api/self", { headers: selfH() });
if (!r.ok) { console.error(`events: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); process.exit(2); }
const events = r.body.events ?? [];
const subjectOf = (e) => e.subjectRepo ? `${e.subjectRepo}@${String(e.subjectMainAfter ?? "").slice(0, 12)}`
  : e.jobId ? `job ${e.jobId}`
  : e.subjectSlot ? `slot ${e.subjectSlot} ${e.subjectBranch ?? ""}`.trim() : "-";
const ACKABLE = ["delivered", "send-uncertain"];
const acked = [];
if (process.env.CTL_ACK === "1") {
  for (const e of events.filter((x) => ACKABLE.includes(x.status))) {
    const a = await api(`/api/self/events/${e.id}/ack`, { method: "POST", headers: selfH() });
    acked.push({ id: e.id, ok: a.ok, status: a.status, error: a.ok ? null : (a.body?.error ?? null) });
  }
}
const lines = events.length === 0 ? ["no FleetEvent is bound to this occupant"]
  : events.map((e) => `${e.id}  ${e.kind}  ${e.status}  ${subjectOf(e)}`);
for (const a of acked) lines.push(`  ack ${a.id}: ${a.ok ? "closed" : `${a.status} ${a.error}`}`);
const watches = r.body.watches ?? [];
lines.push(`watches: ${watches.filter((w) => w.armed).length} armed of ${watches.length} (the spent ones say what happened in lastResult)`);
out({ events, acked, watches }, lines);
EOF
  js_run
  ;;

# ================================================================================================
land)
# ------------------------------------------------------------------------------------------------
# POST /api/slots/:id/merge — the owner land door, one lane, nothing implicit. With --wait it polls
# the merge job to its terminal fact and prints the verdict with BOTH clocks: `ms` is work, `waitMs`
# is queueing behind the suite mutex, and they are not interchangeable (a land can spend 94 % of its
# wall clock in the queue). On landed=YES it then arms the audit watch for exactly that land, so the
# tier-2 answer comes back on its own instead of being polled for.
  slot=""; wait=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --wait) wait=1 ;; --*) printf 'land: unknown flag %s\n' "$a" >&2; exit 2 ;; *) slot=$a ;; esac; done
  [ -n "$slot" ] || { printf 'land: give a slot number\n' >&2; exit 2; }
  need_owner land
  export CTL_SLOT="$slot" CTL_WAIT="$wait" CTL_SELF="${FLEET_SELF_TOKEN:-}"
  export CTL_POLL_SEC="${FLEET_CTL_POLL_SEC:-15}" CTL_WAIT_MAX_SEC="${FLEET_CTL_WAIT_MAX_SEC:-3600}"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const slot = Number(process.env.CTL_SLOT);
const pollMs = Math.max(1, Number(process.env.CTL_POLL_SEC || 15)) * 1000;
// read the lane's identity BEFORE the land: a landed lane's slot is torn down, and its repo and
// branch are exactly what the audit watch and the outcome-ledger join need afterwards.
const sess = await api("/api/sessions", { headers: ownerH() });
const row = (sess.body?.slots ?? []).find((x) => x.id === slot);
const lane = row?.worktree ? { repo: row.worktree.repo, branch: row.worktree.branch } : null;

const started = await api(`/api/slots/${slot}/merge`, { method: "POST", headers: ownerH(), body: "{}" });
const lines = [`land slot ${slot}: ${started.status} ${JSON.stringify(started.body).slice(0, 300)}`];
// A BLOCKED LAND IS A 200, and calling that a success is the mistake this line exists to stop: the
// door answers `{"status":"blocked", …}` with HTTP 200 for an uncommitted tree, a busy pane, a
// git op in progress or a collision. Exit 0 means "a job is running" or "it landed", nothing else.
const startedOk = started.ok && (started.body?.running === true || started.body?.landed === true);
if (!startedOk || process.env.CTL_WAIT !== "1") {
  if (started.ok && !startedOk) lines.push(`  NOT STARTED — ${started.body?.status ?? "the door refused"}: nothing was merged`);
  out({ started: started.body, status: started.status, startedOk, lane }, lines);
  process.exit(startedOk ? 0 : 1);
}
// `{running:true}` is the ONLY answer that means a job was started. Every other 200 this door gives
// is already terminal — `blocked` (the tree, the pane or a collision refused it), `already merged`,
// or a parked ⏸ verdict handed straight back — and polling after one of those would read the
// PREVIOUS land's persisted verdict and report it as this call's outcome.
let last = null, gone = false, waitedOut = false;
if (started.body?.running !== true) {
  last = started.body?.last ?? (started.body?.status ? started.body : null);
  lines.push("  no job was started — the answer above is the whole answer");
} else {
  // Bounded, and the bound is a NON-ANSWER with its own exit code (3), never a verdict: a wait that
  // ran out has not looked at anything, which is the distinction runVerify spends two budgets on.
  const deadline = Date.now() + Math.max(1, Number(process.env.CTL_WAIT_MAX_SEC || 3600)) * 1000;
  for (;;) {
    const g = await api(`/api/slots/${slot}/merge`, { headers: ownerH() });
    if (g.status === 400) { gone = true; break; }           // slot torn down = the land took it
    if (!g.body?.running && g.body?.last) { last = g.body.last; break; }
    if (Date.now() >= deadline) { waitedOut = true; break; }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  if (waitedOut) {
    lines.push(`  STILL RUNNING after ${process.env.CTL_WAIT_MAX_SEC || 3600}s — this is a non-answer, not a verdict`);
    out({ started: started.body, gone: false, last: null, waitedOut: true, lane }, lines);
    process.exit(3);
  }
}
// mainAfter: the outcome ledger is the authority (it is what the audit itself joins on); a git
// rev-parse is the fallback and is NAMED as one, because it can only be read after the fact.
let mainAfter = null, mainAfterFrom = null;
if (lane && (gone || last?.landed)) {
  try {
    const rows = fs.readFileSync(HOME + "/lane-outcomes.jsonl", "utf8").split("\n")
      .filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((x) => x && x.branch === lane.branch && typeof x.mainAfter === "string");
    if (rows.length) { mainAfter = rows[rows.length - 1].mainAfter; mainAfterFrom = "lane-outcomes.jsonl"; }
  } catch { /* the ledger lives only where the server runs */ }
  if (!mainAfter) {
    const { spawnSync } = require("child_process");
    const main = (spawnSync("git", ["-C", lane.repo, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).stdout ?? "").trim() || "main";
    const sha = (spawnSync("git", ["-C", lane.repo, "rev-parse", main], { encoding: "utf8" }).stdout ?? "").trim();
    if (/^[0-9a-f]{40,64}$/.test(sha)) { mainAfter = sha; mainAfterFrom = `git rev-parse ${main} (AFTER the fact — not the ledger)`; }
  }
}
const v = last?.verify ?? null;
lines.push(gone ? `  slot ${slot} is gone — the land took the lane down`
  : last ? `  status ${last.status}  landed=${last.landed ? "YES" : "NO"}` : "  no verdict was recorded");
if (last) lines.push(`  detail ${String(last.detail ?? "").slice(0, 200)}`);
if (v) lines.push(`  verify ${verifyWord(v)}  ms=${v.ms ?? "?"} waitMs=${v.waitMs ?? "?"}${v.waitPartial ? " (lower bound)" : ""}`
  + `  proportional=${v.proportional === true}  steps=[${(v.steps ?? []).join(", ")}]`);
else if (last) lines.push("  verify none — no gate was configured for this repo (never a silent pass)");
if (mainAfter) lines.push(`  mainAfter ${mainAfter}  (${mainAfterFrom})`);

let auditWatch = null;
if (mainAfter && lane) {
  if (!process.env.CTL_SELF) lines.push("  audit watch NOT armed — no FLEET_SELF_TOKEN in this shell");
  else {
    const w = await api("/api/self/watch", { method: "POST", headers: selfH(),
      body: JSON.stringify({ kind: "audit", repo: lane.repo, mainAfter, idleSec: 0 }) });
    auditWatch = w.ok ? w.body.watch : { error: w.body?.error ?? null, status: w.status };
    lines.push(w.ok ? `  audit watch ${w.body.watch?.id} armed for ${mainAfter.slice(0, 12)}`
      : `  audit watch REFUSED: ${w.status} ${w.body?.error ?? ""}`);
  }
}
out({ started: started.body, gone, last, waitedOut: false, mainAfter, mainAfterFrom, lane, auditWatch }, lines);
process.exit(gone || last?.landed ? 0 : 1);
EOF
  js_run
  ;;

# ================================================================================================
dispatch)
# ------------------------------------------------------------------------------------------------
# The hand-start door, POST /api/tasks/:id/dispatch. The server's own cap is counted PER REPO on the
# unattended tick; this door does not pass through it, which is why the button can open a lane the
# tick would have held back. So the count happens HERE, fleet-wide over rows in `sent`, against
# FLEET_DISPATCH_MAX_LANES. Deliberately COARSER than the server's per-repo count and said so: it
# can refuse a start the server would have allowed, and `--force` is the one word that skips it.
  task=""; force=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --force) force=1 ;; --*) printf 'dispatch: unknown flag %s\n' "$a" >&2; exit 2 ;; *) task=$a ;; esac; done
  [ -n "$task" ] || { printf 'dispatch: give a task id\n' >&2; exit 2; }
  need_owner dispatch
  export CTL_TASK="$task" CTL_FORCE="$force"
  export CTL_MAX_LANES="${FLEET_DISPATCH_MAX_LANES:-3}"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const want = process.env.CTL_TASK;
const cap = Math.max(1, Number(process.env.CTL_MAX_LANES || 3) | 0);
const t = await api("/api/tasks", { headers: ownerH() });
if (!t.ok) { console.error(`dispatch: /api/tasks ${t.status}`); process.exit(2); }
const tasks = t.body.tasks ?? [];
const row = tasks.find((x) => x.id === want);
if (!row) { console.error(`dispatch: no task ${want} on this fleet`); process.exit(1); }
const open = tasks.filter((x) => x.status === "sent");
const lines = [`task ${want}  kind=${row.kind}  status=${row.status}  repo=${row.repo ?? "(dispatch default)"}`];
// Two plain-language notes the route itself will not give: an advisory row has no motor at all, and
// a row whose harness the automation policy declines can ONLY be started through this door.
if (row.kind !== "auftrag") lines.push(`  NOTE: a ${row.kind} is advisory — the dispatcher never runs this, and this door will refuse it too`);
if (row.spawn?.harness) lines.push(`  NOTE: the row names harness ${row.spawn.harness} — if FLEET_HARNESS_AUTOMATION declines it, the unattended tick never starts this row and this door is its only start path`);
if (open.length >= cap && process.env.CTL_FORCE !== "1") {
  lines.push(`  REFUSED: ${open.length}/${cap} task lanes are already open (FLEET_DISPATCH_MAX_LANES; fleet-wide, coarser than the server's per-repo cap) — land or close one, or pass --force`);
  out({ ok: false, task: row, openLanes: open.length, cap, refused: "lane cap" }, lines);
  process.exit(1);
}
const d = await api(`/api/tasks/${want}/dispatch`, { method: "POST", headers: ownerH(), body: "{}" });
lines.push(`  dispatch ${d.status} ${JSON.stringify(d.body).slice(0, 300)}`);
out({ ok: d.ok, task: row, openLanes: open.length, cap, response: d.body, status: d.status }, lines);
process.exit(d.ok ? 0 : 1);
EOF
  js_run
  ;;

# ================================================================================================
wait-merge)
# ------------------------------------------------------------------------------------------------
# One long wait on one lane's merge, instead of a poll cadence in the pane. Intended to be started
# detached (`run_in_background`) — the lane brief rule "a background suite is ONE long wait, not a
# poll rhythm" is the same rule read from the controller's side.
  slot=""
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --*) printf 'wait merge: unknown flag %s\n' "$a" >&2; exit 2 ;; *) slot=$a ;; esac; done
  [ -n "$slot" ] || { printf 'wait merge: give a slot number\n' >&2; exit 2; }
  need_owner "wait merge"
  export CTL_SLOT="$slot" CTL_POLL_SEC="${FLEET_CTL_POLL_SEC:-15}" CTL_WAIT_MAX_SEC="${FLEET_CTL_WAIT_MAX_SEC:-3600}"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const slot = Number(process.env.CTL_SLOT);
const pollMs = Math.max(1, Number(process.env.CTL_POLL_SEC || 15)) * 1000;
const deadline = Date.now() + Math.max(1, Number(process.env.CTL_WAIT_MAX_SEC || 3600)) * 1000;
for (;;) {
  const g = await api(`/api/slots/${slot}/merge`, { headers: ownerH() });
  if (g.status === 400) { out({ gone: true, last: null }, [`slot ${slot} is gone — the land took the lane down`]); process.exit(0); }
  if (!g.body?.running && g.body?.last) {
    const l = g.body.last;
    out({ gone: false, last: l }, [`slot ${slot}: ${l.status}  landed=${l.landed ? "YES" : "NO"}  verify=${verifyWord(l.verify)}`,
      `  ${String(l.detail ?? "").slice(0, 300)}`]);
    process.exit(0);
  }
  // the same bounded non-answer `land --wait` gives, with the same exit code: a wait that ran out
  // has measured nothing, and saying "not landed" here would be a verdict nobody reached.
  if (Date.now() >= deadline) {
    out({ gone: false, last: null, waitedOut: true },
      [`slot ${slot}: STILL RUNNING after ${process.env.CTL_WAIT_MAX_SEC || 3600}s — a non-answer, not a verdict`]);
    process.exit(3);
  }
  await new Promise((r) => setTimeout(r, pollMs));
}
EOF
  js_run
  ;;

# ================================================================================================
wait-change)
# ------------------------------------------------------------------------------------------------
# The file monitor the scratchpad kept losing. It snapshots the five state facts a controller
# actually waits on and returns at the FIRST difference, naming it. Not a tick and not a timer: a
# controller that must "check back later" is a controller that guessed how long later is.
  tasks=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --json) CTL_JSON=1 ;;
      --tasks) shift; tasks=${1:-} ;;
      *) printf 'wait change: unknown flag %s\n' "$1" >&2; exit 2 ;;
    esac
    shift
  done
  need_state "wait change"
  export CTL_TASKS="$tasks" CTL_POLL_SEC="${FLEET_CTL_POLL_SEC:-15}"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const pollMs = Math.max(1, Number(process.env.CTL_POLL_SEC || 15)) * 1000;
const watched = (process.env.CTL_TASKS || "").split(",").map((s) => s.trim()).filter(Boolean);
const auditLines = () => { try { return fs.readFileSync(HOME + "/post-land-audits.jsonl", "utf8").split("\n").filter(Boolean).length; } catch { return null; } };
const snap = () => {
  const st = readState();
  const m = new Map();
  for (const a of st.attentionRequests ?? []) m.set(`attention ${a.id}`, a.status);
  for (const [slot, v] of Object.entries(st.merges ?? {})) m.set(`merge slot ${slot}`, `${v.status}/landed=${v.landed === true}`);
  for (const r of st.fleetReports ?? []) m.set(`report ${r.id}`, r.decision?.disposition ?? "undecided");
  for (const t of st.tasks ?? []) if (!watched.length || watched.includes(t.id)) m.set(`task ${t.id}`, t.status);
  for (const j of st.laneSuiteJobs ?? []) m.set(`suite-offer ${j.id}`, `${j.state ?? "?"}/${j.claimedBy ?? "-"}`);
  m.set("post-land-audit rows", String(auditLines()));
  return m;
};
let base;
try { base = snap(); } catch (e) { console.error("wait change: " + String(e).slice(0, 200)); process.exit(2); }
for (;;) {
  await new Promise((r) => setTimeout(r, pollMs));
  let now;
  try { now = snap(); } catch { continue; }   // a mid-write state file is not a change
  const diff = [];
  for (const [k, v] of now) if (base.get(k) !== v) diff.push({ key: k, from: base.get(k) ?? null, to: v });
  for (const [k, v] of base) if (!now.has(k)) diff.push({ key: k, from: v, to: null });
  if (diff.length) {
    out({ changed: diff }, diff.map((d) => `${d.key}: ${d.from ?? "(absent)"} -> ${d.to ?? "(gone)"}`));
    process.exit(0);
  }
}
EOF
  js_run
  ;;

*)
  printf 'ctl.sh: unknown verb "%s" — verbs: %s\n\n' "$verb" "$CTL_VERBS" >&2
  usage >&2
  exit 2
  ;;
esac

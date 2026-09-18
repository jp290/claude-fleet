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

CTL_VERBS="get merges lock ctx report task audits watch events land dispatch wait-merge wait-change send commit-main"

usage() {
  cat <<'USAGE'
ctl.sh — the controller's mechanical moves. One decision per call, made by you, not by this script.

  get <path> [--keys] [--json]     GET any route under /api/ with the credential that route wants
                                   (owner; the self token for /api/self) — --keys prints the shape,
                                   not the body. GET only, /api/ only, both refusals by name.
  merges [--json]                  which lands are persisted/unfinished; exit 1 while one is in flight
  lock [--reap] [--json]           suite-mutex health; --reap removes a lock whose holder is dead
  ctx [slot] [--json]              measured context fill of a slot (default: your own)
  report <taskId> [--full] [--json]   the newest fleet-report filed for that task
  task <taskId> [--full] [--json]  one queue row and its lane off GET /api/lane?task=: status, card, start
                                   plan, newest report, outcome, audit — one line each, source named
  audits [--last N] [--fail <text>] [--sha <sha>] [--json]
                                   post-land audit rows off the route, adjudication joined; the first
                                   line says whether an audit is running or waiting right now
  watch lane|merge <slot> | audit <sha> [--repo <path>] [--idle <sec>] [--json]
                                   arm one self-watch; idleSec defaults to 0
  events [--ack] [--json]          your own FleetEvents; --ack closes the delivered ones
  land <slot> [--wait] [--json]    POST the land; --wait blocks to the verdict and arms the audit watch
  dispatch <taskId> [--force] [--json]   hand-start a queued row, refusing over the lane cap
  wait merge <slot> [--json]       block until that lane's merge is terminal
  wait change [--tasks a,b,c] [--json]   block until fleet state moves, then print what moved
  send --main <programId> <textfile> [--json]
                                   resolve the Program's bound MAIN slot NOW, refuse a lane/dead/recycled one, then /send
  commit main -m <msgfile> [--budget <sec>] [--json]      (also typed commit-main)
                                   wait (bounded) for `merges` exit 0, then git commit the staged index in the main checkout

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
# `wait merge` / `wait change` / `commit main` are one verb each, typed with a space (the dashed
# spelling `commit-main` reaches the same branch directly)
if [ "$verb" = "wait" ] || [ "$verb" = "commit" ]; then
  sub=${1:-}
  [ -n "$sub" ] || { printf 'ctl.sh %s: say `wait merge <slot>`, `wait change` or `commit main -m <msgfile>`\n' "$verb" >&2; exit 2; }
  shift
  verb="$verb-$sub"
fi

CTL_JSON=0
export CTL_JSON

case "$verb" in

# ================================================================================================
get)
# ------------------------------------------------------------------------------------------------
# THE CREDENTIALED READ, and why it is ONE verb instead of one verb per route. Every other verb here
# turns a route into a rendering; this one turns the CREDENTIAL into a door and renders nothing. Measured
# over nine sessions of three roles (docs/messungen/2026-09-17-worktrail-bash-datenschichten-
# strategisch.md §5 P1): 61 bash calls went looking for a header name, a token source, a route or a
# field shape that all already exist, and 79 more rebuilt the token lookup by hand — because
# `owner_token`/`need_self` at the top of this file were reachable only through a fixed verb list. Five ledgers
# with a read route were read RAW 1 480 times against 131 route reads in fourteen days.
#
# WHAT IT DOES NOT ADD. No route, no permission, no method. It is GET-only and /api/-only, and both
# refusals are NAMED rather than silent, because the mistake this exists to end is a session that
# cannot tell "I typed the wrong thing" from "the fleet said no". A write still goes through the
# verb that owns it — a passthrough POST would hand every route in the server a caller with no
# field-shape check and no refusal of its own, which is the opposite of this file's purpose.
#
# THE CREDENTIAL FOLLOWS THE PATH, and the split is the server's, not a preference: everything under
# /api/self is scoped to the pane's OWN slot and is opened with the self token; everything else is
# owner-gated. `/api/selfish` is not `/api/self` — the pattern ends at a slash, a `?` or the string,
# so a route that merely starts with those letters gets the owner credential it actually wants.
#
# TOKEN HYGIENE (the file header, and CLAUDE.md §Self-scheduling). The token travels in the
# environment into the embedded program and from there into a request header. It is never an
# argument, never part of the URL, and never printed: a 401 names the SOURCE it was resolved from
# ("FLEET_CTL_TOKEN", "<home>/fleet.json") and never the value, which is the answer the 79 hand-built
# lookups were actually after.
  path=""; keys=0
  for a in "$@"; do
    case "$a" in
      --json) CTL_JSON=1 ;;
      --keys) keys=1 ;;
      # a method or a body, however it is spelled: refused BY NAME rather than quietly downgraded to
      # a GET, which would answer a question the caller did not ask and look like it worked
      -X|-X*|--method|--method=*|--request|--request=*|-d|-d*|--data|--data=*|--data-raw*|--data-binary*|--form|-F|-I|--head)
        printf 'ctl.sh get: "%s" names a method or a body — get does GET and nothing else. There is no write passthrough here: a write goes through the verb that owns it, or through the route'"'"'s own curl.\n' "$a" >&2
        exit 2 ;;
      -*) printf 'ctl.sh get: unknown flag %s — flags are --keys and --json\n' "$a" >&2; exit 2 ;;
      GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)
        printf 'ctl.sh get: "%s" is a method, not a path — get does GET and nothing else. Say: ./ctl.sh get /api/<route>\n' "$a" >&2
        exit 2 ;;
      *)
        [ -z "$path" ] || { printf 'ctl.sh get: two paths given ("%s" and "%s") — one route per call\n' "$path" "$a" >&2; exit 2; }
        path=$a ;;
    esac
  done
  [ -n "$path" ] || { printf 'ctl.sh get: give a path under /api/ — e.g. ./ctl.sh get /api/post-land-audits --keys\n' >&2; exit 2; }
  case "$path" in
    http://*|https://*)
      printf 'ctl.sh get: "%s" is a whole URL — give the PATH only. The base is %s (FLEET_CTL_URL, else FLEET_HOST/FLEET_PORT in %s/.env).\n' "$path" "$CTL_URL" "$HOME_DIR" >&2
      exit 2 ;;
    api/*) path="/$path" ;;
  esac
  case "$path" in
    /api/*) ;;
    *) printf 'ctl.sh get: "%s" is not under /api/ — get reads this fleet'"'"'s API and is not a general curl.\n' "$path" >&2
       exit 2 ;;
  esac
  case "$path" in
    /api/self|/api/self/*|/api/self\?*)
      need_self get
      CTL_CRED=self
      CTL_CRED_SRC="FLEET_SELF_TOKEN, exported into this pane${FLEET_SELF_SLOT:+ (slot $FLEET_SELF_SLOT)}" ;;
    *)
      need_owner get
      CTL_CRED=owner
      if [ -n "${FLEET_CTL_TOKEN:-}" ]; then CTL_CRED_SRC="FLEET_CTL_TOKEN"
      elif [ -n "${FLEET_TOKEN:-}" ]; then CTL_CRED_SRC="FLEET_TOKEN"
      else CTL_CRED_SRC="$HOME_DIR/fleet.json"; fi ;;
  esac
  export CTL_PATH="$path" CTL_CRED CTL_CRED_SRC CTL_KEYS=$keys
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const path = process.env.CTL_PATH, cred = process.env.CTL_CRED, credSrc = process.env.CTL_CRED_SRC;
// NOT the `api()` helper above: it truncates a non-JSON body at 400 characters, and the artefact
// route (/api/post-land-audits/artifact) serves a whole suite.log as text/plain. A reader that
// silently cut it would be the same defect in a new place.
const res = await fetch(URL_ + path, { headers: cred === "self" ? selfH() : ownerH() });
const ctype = res.headers.get("content-type") ?? "";
const text = await res.text();
let body = null, isJson = false;
try { body = JSON.parse(text); isJson = true; } catch { /* text/plain, and said so below */ }
if (!res.ok) {
  // the credential is named by its SOURCE, never by its value — that IS the question the hand-built
  // token lookups were asking, and printing the token would answer it by leaking it
  const why = res.status === 401 || res.status === 403
    ? ` — the ${cred} credential was refused (resolved from ${credSrc}; this verb prints where a token came from, never the token)`
    : "";
  const snip = text.trim().slice(0, 300);
  console.error(`ctl.sh get: ${path} -> ${res.status}${why}${snip ? `\n  ${snip}` : ""}`);
  process.exit(1);
}
// NO `process.exit()` PAST THIS POINT, and it is not a style preference. Measured on this machine
// while writing it: `process.stdout.write(<745 KB suite.log>)` followed by `process.exit(0)` handed
// a PIPE exactly 65 536 bytes — one buffer — three times out of three, and said nothing. A reader
// that silently truncates a suite log is the defect this whole verb exists to remove, in a new
// place. Letting the program END instead keeps the handle alive until the write drains.
if (process.env.CTL_KEYS !== "1") {
  if (isJson) console.log(JSON.stringify(body, null, 2));
  else if (JSONOUT) console.log(JSON.stringify({ path, status: res.status, contentType: ctype, text }, null, 2));
  else process.stdout.write(text.endsWith("\n") ? text : text + "\n");
} else if (!isJson) {
  // --keys on a body that has no keys: said as itself, with the two numbers that decide whether
  // reading it without --keys is a good idea at all
  // BYTES, not string length: a suite log with one non-ASCII character makes those two numbers
  // differ (745 847 against 748 038 on the log this was measured with), and the number a reader
  // decides with is the one `wc -c` will also print
  const bytes = Buffer.byteLength(text, "utf8");
  const lines = [`${path}  ${res.status}  ${ctype || "no content-type"} — not JSON, so it has no keys`,
    `  ${bytes} bytes, ${text.split("\n").length} lines — read it without --keys`];
  out({ path, status: res.status, contentType: ctype, json: false, bytes }, lines);
} else {
// --- --keys: the SHAPE instead of the body -----------------------------------------------------
// Two levels and no more. One level answers nothing (`{audits, total, malformed}` is not a field
// shape), and the whole tree is the body again — the thing the caller asked not to be handed. The
// second level of an array is read off element 0 and SAYS SO, because an empty array has no shape
// to read and must not be reported as one.
const scalar = (v) => {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v.length > 60 ? v.slice(0, 60) + "…" : v);
  return String(v);
};
const shapeOf = (v) => Array.isArray(v) ? `array[${v.length}]`
  : v === null ? "null" : typeof v === "object" ? `object{${Object.keys(v).length}}` : typeof v;
// the second level of ONE value, as the one sentence that value can honestly support
const inner = (v) => {
  if (Array.isArray(v)) {
    if (v.length === 0) return "(empty — no element to read a shape from)";
    const e = v[0];
    return e !== null && typeof e === "object" && !Array.isArray(e)
      ? `[0] = ${Object.keys(e).join(", ")}` : `[0] = ${shapeOf(e)}`;
  }
  if (v !== null && typeof v === "object") {
    const k = Object.keys(v);
    return k.length === 0 ? "(no keys)" : k.join(", ");
  }
  return scalar(v);
};
const rootShape = shapeOf(body);
const entries = Array.isArray(body) ? body.slice(0, 1).map((v, i) => [`[${i}]`, v])
  : body !== null && typeof body === "object" ? Object.entries(body) : [];
const width = Math.max(0, ...entries.map(([k]) => k.length));
const lines = [`${path}  ${res.status}  ${rootShape}`,
  ...entries.map(([k, v]) => `  ${k.padEnd(width)}  ${shapeOf(v).padEnd(12)}  ${inner(v)}`)];
if (entries.length === 0) lines.push(`  (${rootShape} — no keys at the top level)`);
out({ path, status: res.status, shape: rootShape,
  keys: entries.map(([k, v]) => ({ key: k, shape: shapeOf(v), inner: inner(v) })) }, lines);
}
EOF
  js_run
  ;;

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
// A LANDED LANE'S ROW OUTLIVES ITS SLOT, and it took two red runs to establish rather than assume
// it. The land path does delete the verdict (`mergeLast.delete`), but the merge job's own final
// write comes after the teardown and its guard is `if (!s.cwd || s.cwd === cwd)` — a torn-down slot
// has no cwd, so the FIRST disjunct passes and `{status:"merged", landed:true}` is written back for
// a slot that no longer exists. It is cleared when that slot is next opened. So a landed=YES row
// here is HISTORY, not work in flight, and `busy` deliberately ignores it: what this map answers is
// "may I start a land now", never "what has landed" (that is lane-outcomes.jsonl and the notes).
const lines = rows.length === 0 ? ["no lane is open and no merge verdict is persisted"]
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
    else if (now === birth) { state = "held"; birthState = "matched"; why = `${rd(LOCK + "/held-by-fleet-server") === pid ? `held by the fleet server itself — never kill this pid ${pid} — ` : ""}held by live pid ${pid} with proven identity`; }
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
      try { fs.rmSync(LOCK + "/held-by-fleet-server", { force: true }); fs.rmSync(LOCK + "/pid", { force: true }); fs.rmSync(LOCK + "/birth", { force: true }); fs.rmdirSync(LOCK); reaped = true; }
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
  `  decision ${d ? `${d.disposition} by ${d.by === "owner" ? "owner" : d.by?.rule ? `rule ${d.by.rule} (${String(d.mainAfter ?? "").slice(0, 12)})` : `slot ${d.by?.slot ?? "?"}`} at ${new Date(d.at).toISOString()}` : "UNDECIDED"}`,
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
task)
# ------------------------------------------------------------------------------------------------
# ONE ROW AND ITS LANE, off GET /api/lane?task=<id> — the server resolves the id to its branch
# (server.ts#resolveTaskLane: live `sent` row → its slot, else the outcome rows' taskId, else
# tasks-archive.jsonl for a row that left fleet.json) and returns the SAME dossier ?branch= does.
# Measured 2026-09-17 (docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §5
# P2): 68 hand joins over fleet.json, /api/sessions and the raw ledgers in 14 days, zero dossier
# calls. The join is the route's; this verb only PRINTS it, one line per source, the source named.
# It judges nothing — a report's head is quoted, never weighed. Exit 1 = the id is unknown to all
# three sources; a known row with no lane is an answer (exit 0), not an error.
  task=""; full=0
  for a in "$@"; do case "$a" in --json) CTL_JSON=1 ;; --full) full=1 ;; --*) printf 'task: unknown flag %s\n' "$a" >&2; exit 2 ;; *) task=$a ;; esac; done
  [ -n "$task" ] || { printf 'task: give a task id\n' >&2; exit 2; }
  printf '%s' "$task" | grep -Eq '^[a-z0-9]{1,64}$' || { printf 'task: %s is not a queue row id ([a-z0-9]{1,64})\n' "$task" >&2; exit 2; }
  need_owner task
  export CTL_TASK="$task" CTL_FULL="$full"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const want = process.env.CTL_TASK, FULL = process.env.CTL_FULL === "1";
const r = await api("/api/lane?task=" + encodeURIComponent(want), { headers: ownerH() });
const res = r.body?.resolved ?? null;
if (r.status === 404 && res?.result === "unknown-task") {
  out({ resolved: res }, [`task ${want}: UNKNOWN — searched ${res.searched.join(", ")}; no row and no lane carry this id`]);
  process.exit(1);
}
if (!r.ok || !res) { console.error(`task: GET /api/lane?task= ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); process.exit(2); }
const iso = (t) => (typeof t === "number" && t > 0 ? new Date(t).toISOString() : "?");
const short = (s) => String(s ?? "").slice(0, 12);
const row = res.row;
const lines = [];
lines.push(res.result === "lane"
  ? `task ${want}: lane ${res.branch} (via ${res.via}${res.branches.length > 1 ? `; ${res.branches.length - 1} earlier lane(s): ${res.branches.slice(1).join(", ")}` : ""})`
  : `task ${want}: NO LANE — ${res.why}`);
const rowSrc = row ? (row.from === "live" ? "fleet.json" : "tasks-archive.jsonl") : "";
lines.push(row ? `  status    ${row.status} (${row.kind})${row.note ? ` — note: ${String(row.note).slice(0, 160)}` : ""}   [${rowSrc}]`
  : "  status    UNKNOWN — the row is in neither fleet.json nor tasks-archive.jsonl; only the outcome ledger names it   [-]");
lines.push(!row ? "  card      UNKNOWN — no row to read a card from   [-]"
  : row.card === null ? `  card      none — no card was ever read for this row   [${rowSrc} card]`
  : `  card      ${row.card.valid ? "valid" : "INVALID"}${row.card.gaps.length ? ` — ${row.card.gaps.length} gap(s): ${row.card.gaps.slice(0, 2).join("; ").slice(0, 200)}` : ""}   [${rowSrc} card]`);
const rel = row?.release ?? null;
lines.push(!row || (row.status !== "pending" && row.status !== "queued")
  ? `  startplan — not waiting (${row ? row.status : "no row"})   [start-plan.ts#releaseVerdict]`
  : `  startplan ${rel?.released ? `released by ${rel.by}${rel.hints?.length ? ` (hints: ${rel.hints.join("; ").slice(0, 160)})` : ""}` : `not released${rel?.why ? ` — ${rel.why}` : " — waits for a release"}`}`
    + `${row.note && /^waiting|^after /.test(row.note) ? `; tick: ${String(row.note).slice(0, 200)}` : ""}   [start-plan.ts#releaseVerdict + row note]`);
const rep = row?.report ?? null;
lines.push(rep ? `  report    ${rep.id} ${rep.status} ${iso(rep.reportedAt)} ${rep.decided ? "decided" : "UNDECIDED"}: ${rep.head}   [fleet-reports]`
  : "  report    none retained for this task   [fleet-reports]");
const m = (x) => x && x.state === "read";
if (res.result === "lane") {
  const d = r.body;
  const o = m(d.outcomes) ? d.outcomes.value.rows[0] : null;
  lines.push(!m(d.outcomes) ? `  outcome   UNKNOWN — ${d.outcomes?.why ?? "not in the dossier"}   [lane-outcomes.jsonl]`
    : !o ? `  outcome   none — the lane has not ended${d.liveSlot !== null ? ` (live in slot ${d.liveSlot})` : ""}   [lane-outcomes.jsonl]`
    : `  outcome   ${o.disposition ?? "?"} ${iso(o.ts)}${o.mainAfter ? ` mainAfter ${short(o.mainAfter)}` : ""} verified ${o.verified === true ? "yes" : o.verified === false ? "NO" : "null"}   [lane-outcomes.jsonl]`);
  const a = m(d.audits) ? d.audits.value.rows[0] : null;
  lines.push(!m(d.audits) ? `  audit     UNKNOWN — ${d.audits?.why ?? "not in the dossier"}   [post-land-audits.jsonl]`
    : !a ? "  audit     none covers this branch   [post-land-audits.jsonl]"
    : `  audit     ${a.result} ${iso(a.at)} on ${short(a.mainSha)}${a.fails?.length ? ` fails [${a.fails.slice(0, 3).join(", ")}]` : ""} adj ${a.adjudication ? a.adjudication.verdict : "none"}   [post-land-audits.jsonl]`);
} else {
  lines.push("  outcome   none — no lane on record   [lane-outcomes.jsonl]");
  lines.push("  audit     none — no lane on record   [post-land-audits.jsonl]");
}
if (FULL) {
  if (row) lines.push("", "--- row text", String(row.text ?? ""));
  if (rep) lines.push("", `--- report ${rep.id}`, String(rep.text ?? ""));
}
out(r.body, lines);
EOF
  js_run
  ;;

# ================================================================================================
audits)
# ------------------------------------------------------------------------------------------------
# The tier-2 trail, read off GET /api/post-land-audits instead of out of the raw ledger. Measured
# 2026-09-17 (docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §5 P3): 804 raw
# reads of post-land-audits.jsonl in 14 days against 25 calls of its route — a MAIN tailing the last
# row after every audit event, the queue file read on top, a fail name counted with grep over every
# line. The route already serves all of it, newest first, WITH the adjudication joined onto the row
# it judges, and /api/sessions already carries the live half (postLandAuditLive).
# READ ONLY, and it judges nothing: the adjudication shown is the rail's, verbatim, and a red row
# without one is printed as `adj none` — never as a flake this verb decided it looks like.
  last=""; fail=""; sha=""; want=""
  for a in "$@"; do
    if [ -n "$want" ]; then
      case "$want" in last) last=$a ;; fail) fail=$a ;; sha) sha=$a ;; esac
      want=""; continue
    fi
    case "$a" in
      --json) CTL_JSON=1 ;;
      --last) want=last ;; --fail) want=fail ;; --sha) want=sha ;;
      *) printf 'audits: unknown argument %s\n' "$a" >&2; exit 2 ;;
    esac
  done
  [ -z "$want" ] || { printf 'audits: --%s needs a value\n' "$want" >&2; exit 2; }
  case "$last" in ''|[1-9]|[1-9][0-9]|[1-9][0-9][0-9]|1000) ;;
    *) printf 'audits: --last wants a whole number 1..1000 (the route caps at 1000), got %s\n' "$last" >&2; exit 2 ;; esac
  if [ -n "$sha" ] && ! printf '%s' "$sha" | grep -Eq '^[0-9a-f]{4,40}$'; then
    printf 'audits: --sha wants 4..40 lowercase hex characters, got %s\n' "$sha" >&2; exit 2
  fi
  need_owner audits
  export CTL_LAST="$last" CTL_FAIL="$fail" CTL_SHA="$sha"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const failQ = process.env.CTL_FAIL || null, shaQ = process.env.CTL_SHA || null;
// a filter reads the WHOLE trail the route will serve unless the caller narrowed it; a plain look
// reads the newest ten. The denominator is always printed, so a narrowed count cannot pass for all.
const limit = process.env.CTL_LAST ? Number(process.env.CTL_LAST) : (failQ || shaQ ? 1000 : 10);
const [ses, r] = await Promise.all([
  api("/api/sessions", { headers: ownerH() }),
  api("/api/post-land-audits?limit=" + limit, { headers: ownerH() }),
]);
if (!r.ok) { console.error(`audits: GET /api/post-land-audits ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`); process.exit(2); }

// --- line one: the live half. null is IDLE (server.ts#postLandAuditLiveView); an absent field or a
// refused read is UNKNOWN, and the two are never printed as each other.
const liveKnown = ses.ok && ses.body && Object.prototype.hasOwnProperty.call(ses.body, "postLandAuditLive");
const live = liveKnown ? ses.body.postLandAuditLive : undefined;
const sec = (t) => Math.round((Date.now() - t) / 1000) + "s";
const short = (s) => String(s ?? "").slice(0, 12);
let liveLine;
if (!liveKnown) liveLine = ses.ok ? "live: UNKNOWN — /api/sessions carried no postLandAuditLive"
  : `live: UNKNOWN — GET /api/sessions ${ses.status}`;
else if (live === null) liveLine = "live: idle — no audit running, none waiting";
else {
  const run = live.running, wait = live.waiting ?? [];
  const parts = [];
  if (run?.phase === "running") {
    const st = live.stats ? ` (p50 ${ms(live.stats.p50)} p90 ${ms(live.stats.p90)} over ${live.stats.n})` : "";
    parts.push(`RUNNING ${run.repo} ${run.main}@${short(run.mainSha)} for ${sec(run.startedAt)} covers ${run.covers.join(", ") || "-"}${st}`);
  } else if (run?.phase === "starting") parts.push("STARTING — the drain holds its lock, the run's identity is not known yet");
  if (wait.length) parts.push(`WAITING ${wait.length}: ${wait.map((w) => `${w.branch}@${String(w.mainAfter).slice(0, 8)}`).join(", ")}`);
  liveLine = "live: " + parts.join("; ");
}

// --- the rows
const all = r.body.audits ?? [];
const total = r.body.total ?? all.length;
const coverList = (row) => (Array.isArray(row.covers) ? row.covers : []);
let rows = all;
let shaInfo = null;
if (shaQ) {
  // a sha is either the tip the audit RAN on or a land it answered for (a cover's mainAfter) — a
  // coalesced run covers lands whose own tip it never checked out, and that is still their audit
  rows = all.filter((x) => String(x.mainSha ?? "").startsWith(shaQ) || coverList(x).some((c) => String(c?.mainAfter ?? "").startsWith(shaQ)));
  shaInfo = { query: shaQ, matched: rows.length, of: all.length };
}
let failInfo = null;
if (failQ) {
  const withFails = rows.filter((x) => Array.isArray(x.fails));
  const hit = rows.filter((x) => Array.isArray(x.fails) && x.fails.some((f) => String(f).includes(failQ)));
  failInfo = { text: failQ, count: hit.length, of: rows.length, withFails: withFails.length };
  rows = hit;
}
const project = (x) => ({
  at: x.at, time: typeof x.at === "number" ? new Date(x.at).toISOString() : null,
  result: x.result, mainSha: x.mainSha ?? null,
  covers: coverList(x).map((c) => c?.branch ?? String(c)),
  checks: x.checks ?? null,
  fails: Array.isArray(x.fails) ? x.fails : null,
  adjudication: x.adjudication ?? null,
  ...(x.reason ? { reason: x.reason } : {}),
  ...(x.proportional ? { proportional: true } : {}),
});
const shown = rows.map(project);
const rowLine = (p) => {
  const c = p.checks === null ? "checks unmeasured"
    : `checks ${p.checks.ranIsLowerBound ? "≥" : ""}${p.checks.ran} ran/${p.checks.failed} failed`;
  const f = p.fails === null ? "fails -" : p.fails.length ? `fails [${p.fails.join(", ")}]` : "fails none";
  const a = p.adjudication
    ? `adj ${p.adjudication.verdict} (${typeof p.adjudication.by === "string" ? p.adjudication.by : JSON.stringify(p.adjudication.by)})${p.adjudication.note ? ` "${String(p.adjudication.note).slice(0, 80)}"` : ""}`
    : "adj none";
  return `${p.time ?? "?"}  ${String(p.result).padEnd(7)}  ${short(p.mainSha) || "-"}  covers ${p.covers.join(", ") || "-"}`
    + `${p.proportional ? "  proportional" : ""}  ${c}  ${f}  ${a}${p.reason ? `  reason: ${String(p.reason).slice(0, 120)}` : ""}`;
};

const lines = [liveLine];
const more = total > all.length ? `; ${total - all.length} older row(s) not delivered — raise --last` : "";
if (total === 0 && all.length === 0) {
  lines.push(`ledger empty — no post-land audit row is recorded (tier 2 configured: ${r.body.configured === true ? "yes" : r.body.configured === false ? "no" : "unknown"})`);
} else {
  lines.push(`${all.length} of ${total} row(s) delivered, newest first${r.body.malformed ? `, ${r.body.malformed} malformed line(s) skipped` : ""}${more}`);
}
if (shaInfo && shaInfo.matched === 0)
  lines.push(`sha ${shaQ}: UNKNOWN to the trail — no row ran on it or covers it among ${all.length} delivered${more}`);
else if (shaInfo) lines.push(`sha ${shaQ}: ${shaInfo.matched} row(s) ran on it or cover it`);
if (failInfo)
  lines.push(`fail "${failQ}": in ${failInfo.count} of ${failInfo.of} row(s)${shaQ ? " matching the sha" : " delivered"}`
    + ` — ${failInfo.withFails} of them carry a fails list; ${failInfo.of - failInfo.withFails} carry none (an unknown row, or one older than the field) and sit in the denominator unmeasured`);
for (const p of shown) lines.push(rowLine(p));
out({ live: liveKnown ? live : "unknown", total, delivered: all.length, limit, malformed: r.body.malformed ?? 0,
  configured: r.body.configured ?? null, sha: shaInfo, fail: failInfo, audits: shown }, lines);
process.exit(shaInfo && shaInfo.matched === 0 ? 1 : 0);
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
# THREE ways the wait ends, and each says which it was: the verdict; the slot torn down (the land
# took the lane); or the seat RECYCLED onto another lane, where the answer is read out of
# lane-outcomes.jsonl by branch. The fourth — silence to the budget — is what this stopped being.
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
let last = null, gone = false, waitedOut = false, recycled = null;
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
    // …AND THE OTHER WAY A LANE LEAVES A SLOT, which is the normal one the moment the fleet is busy:
    // the land frees the seat and the tick puts a NEW lane in it before this loop looks again. The
    // route then answers 200 for a lane nobody here asked about — `running:false`, `last:null` —
    // and neither exit above fires. Measured 2026-09-08 02:22 at the land of 7539985d: no verdict,
    // no armed audit watch, and a process that sat on the poll for the full hour of
    // FLEET_CTL_WAIT_MAX_SEC. `lane` is the route's own answer to "who am I speaking for", so this
    // compares against the endpoint's fact rather than against a guess about ticks.
    const seat = g.body?.lane ?? null;
    if (lane && seat && (seat.branch !== lane.branch || seat.repo !== lane.repo)) { recycled = seat; break; }
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
let mainAfter = null, mainAfterFrom = null, ledgerSaid = null;
if (lane && (gone || recycled || last?.landed)) {
  try {
    const mine = fs.readFileSync(HOME + "/lane-outcomes.jsonl", "utf8").split("\n")
      .filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((x) => x && x.branch === lane.branch);
    // HOW THAT LANE ENDED, which is the only place left to ask once the seat belongs to someone
    // else: the ledger is keyed by BRANCH and outlives the slot. Read as two separate facts — a row
    // may exist while carrying no `mainAfter` (a killed or shelved lane), and reading its absence as
    // "not landed" would be a verdict nobody reached.
    if (mine.length) ledgerSaid = mine[mine.length - 1].disposition ?? null;
    const advanced = mine.filter((x) => typeof x.mainAfter === "string");
    if (advanced.length) { mainAfter = advanced[advanced.length - 1].mainAfter; mainAfterFrom = "lane-outcomes.jsonl"; }
  } catch { /* the ledger lives only where the server runs */ }
  // The git fallback stands only where the LAND itself is the established fact — the slot was torn
  // down under us, or the verdict says landed. On the recycled path it is not: all that is known
  // there is that this seat now holds someone else, and reading main's current tip as "what my land
  // moved it to" would attribute whatever else landed meanwhile — and then arm an audit watch on it.
  if (!mainAfter && (gone || last?.landed)) {
    const { spawnSync } = require("child_process");
    const main = (spawnSync("git", ["-C", lane.repo, "symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).stdout ?? "").trim() || "main";
    const sha = (spawnSync("git", ["-C", lane.repo, "rev-parse", main], { encoding: "utf8" }).stdout ?? "").trim();
    if (/^[0-9a-f]{40,64}$/.test(sha)) { mainAfter = sha; mainAfterFrom = `git rev-parse ${main} (AFTER the fact — not the ledger)`; }
  }
}
const v = last?.verify ?? null;
lines.push(gone ? `  slot ${slot} is gone — the land took the lane down`
  : recycled ? `  slot ${slot} was RECYCLED onto ${recycled.branch} — this endpoint can no longer answer for ${lane.branch}`
  : last ? `  status ${last.status}  landed=${last.landed ? "YES" : "NO"}` : "  no verdict was recorded");
// …and then the one line the criterion is: the verdict of the land that was waited on, or a
// NAMED non-answer. Never the silence that a 3600 s poll amounted to.
if (recycled) lines.push(ledgerSaid === null
  ? `  ${lane.branch}: no row in lane-outcomes.jsonl — a named NON-ANSWER, not a verdict`
  : `  ${lane.branch}: lane-outcomes.jsonl says disposition=${ledgerSaid} — the ledger's verdict, read where the slot could no longer be asked`);
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
out({ started: started.body, gone, recycled, ledgerSaid, last, waitedOut: false, mainAfter, mainAfterFrom, lane, auditWatch }, lines);
// exit 0 means "it landed", as it always has. On the recycled path the LEDGER is what says so —
// a seat that changed hands proves only that the lane left, and a lane can leave by being killed.
process.exit(gone || last?.landed || (recycled && ledgerSaid === "landed") ? 0 : 1);
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
# It binds to the LANE it first sees on that slot, not to the slot: a seat that changes hands ends
# the wait with a named non-answer (exit 3) instead of polling on about a lane that is not there.
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
// WHICH LANE THIS WAIT IS ABOUT, learned from the endpoint's first answer rather than assumed from
// the slot number. `land --wait` reads its lane before it posts; this verb has no such moment, so
// the first poll is it. Without this the loop below cannot tell "my lane has not finished" from
// "my lane is gone and a new one is sitting in its seat" — and the second one polls to the budget.
let watched = null;
for (;;) {
  const g = await api(`/api/slots/${slot}/merge`, { headers: ownerH() });
  if (g.status === 400) { out({ gone: true, watched, last: null }, [`slot ${slot} is gone — the land took the lane down`]); process.exit(0); }
  const seat = g.body?.lane ?? null;
  if (!watched && seat) watched = seat;
  // A NAMED NON-ANSWER, and the same exit code the spent budget gets, because it is the same kind
  // of statement: nothing about the lane this wait was started for was ever measured. It is said
  // here in one poll period instead of in an hour of silence.
  if (watched && seat && (seat.branch !== watched.branch || seat.repo !== watched.repo)) {
    out({ gone: false, recycled: seat, watched, last: null, waitedOut: false },
      [`slot ${slot} was RECYCLED onto ${seat.branch} — this wait was about ${watched.branch}, and this endpoint`,
        `  can no longer answer for it: a NON-ANSWER, not a verdict. Its outcome is in lane-outcomes.jsonl, keyed by branch.`]);
    process.exit(3);
  }
  if (!g.body?.running && g.body?.last) {
    const l = g.body.last;
    out({ gone: false, watched, last: l }, [`slot ${slot}: ${l.status}  landed=${l.landed ? "YES" : "NO"}  verify=${verifyWord(l.verify)}`,
      `  ${String(l.detail ?? "").slice(0, 300)}`]);
    process.exit(0);
  }
  // the same bounded non-answer `land --wait` gives, with the same exit code: a wait that ran out
  // has measured nothing, and saying "not landed" here would be a verdict nobody reached.
  if (Date.now() >= deadline) {
    out({ gone: false, watched, last: null, waitedOut: true },
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

# ================================================================================================
send)
# ------------------------------------------------------------------------------------------------
# POST /send to a Program's MAIN, addressed by PROGRAM, never by a slot number the caller remembers.
# The incident this exists for (2026-09-14 12:08): a MAIN had succeeded from slot 5 to slot 8, a
# dispatch filled the freed slot 5 with a spawning lane, and an owner /send to "slot 5" in the same
# move killed that lane. /send addresses a NUMBER with no occupant pin, so the number has to be read
# the instant before it is used — which is all this verb does: GET /api/programs and /api/sessions
# together, then the POST, with nothing in between that waits.
#
# FIVE REFUSALS, each named, none of them a POST: no bound MAIN · a binding the server already calls
# stale · a slot whose occupant is not the bound one (openedAt differs — the recycled-slot case, read
# here from the SAME two responses rather than trusting `health` alone) · a slot that is a LANE · a
# slot with no agent alive. `agent` is the git tick's cached probe, and its `null` ("not probed yet")
# is refused as UNKNOWN; `unprobed` is accepted because it is the server's own delivery waiver
# (server.ts#claudeAlive) for a command nobody declared. What remains is a window of milliseconds
# between the read and the POST, and the POST closes it: it carries the bound openedAt, so a slot
# re-occupied inside that window answers 409 naming its new occupant (server.ts, route POST /send).
#
# A bare `send <slot>` is refused on purpose: it is exactly the hand move this verb replaces.
  mode=""; program=""; textfile=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --json) CTL_JSON=1 ;;
      --main) mode=main; shift; program=${1:-} ;;
      --*) printf 'send: unknown flag %s\n' "$1" >&2; exit 2 ;;
      *) textfile=$1 ;;
    esac
    shift
  done
  if [ "$mode" != "main" ]; then
    printf 'send: only `send --main <programId> <textfile>` — a slot number typed by hand is the recycled-slot hazard this verb removes\n' >&2
    exit 2
  fi
  [ -n "$program" ] || { printf 'send --main: give a program id\n' >&2; exit 2; }
  [ -n "$textfile" ] || { printf 'send --main %s: give the file holding the text\n' "$program" >&2; exit 2; }
  [ -s "$textfile" ] || { printf 'send --main %s: %s is missing or empty — nothing sent\n' "$program" "$textfile" >&2; exit 2; }
  need_owner send
  export CTL_PROGRAM="$program" CTL_TEXTFILE="$textfile"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const want = process.env.CTL_PROGRAM;
const text = fs.readFileSync(process.env.CTL_TEXTFILE, "utf8");
const refuse = (reason, extra = {}) => {
  if (JSONOUT) console.log(JSON.stringify({ ok: false, sent: false, program: want, refused: reason, ...extra }, null, 2));
  console.error(`send --main ${want}: REFUSED — ${reason} — nothing sent`);
  process.exit(1);
};
// both reads in ONE await: the answer is only as fresh as the older of the two
const [pr, se] = await Promise.all([api("/api/programs", { headers: ownerH() }), api("/api/sessions", { headers: ownerH() })]);
if (!pr.ok || !se.ok) {
  console.error(`send --main ${want}: /api/programs ${pr.status} /api/sessions ${se.status} — could not resolve, nothing sent`);
  process.exit(2);
}
const p = (pr.body.programs ?? []).find((x) => x.id === want);
if (!p) refuse(`no program ${want} on this fleet`);
const main = p.main ?? null;
const label = `program ${want} (${String(p.title ?? "-").slice(0, 60)})`;
if (!main || typeof main.slot !== "number") refuse(`${label} has no bound MAIN`);
const occupancy = p.health?.occupancy ?? "unknown";
if (occupancy !== "live") refuse(`${label}: its MAIN binding is ${occupancy} — slot ${main.slot} no longer holds the bound occupant`, { slot: main.slot, occupancy });
const row = (se.body.slots ?? []).find((x) => x.id === main.slot);
if (!row || !row.cwd) refuse(`${label}: slot ${main.slot} is empty`, { slot: main.slot });
if (row.openedAt !== main.openedAt)
  refuse(`${label}: slot ${main.slot} holds a different occupant than the bound MAIN (openedAt ${row.openedAt} ≠ ${main.openedAt}) — a recycled slot`, { slot: main.slot });
if (row.worktree) refuse(`${label}: slot ${main.slot} is a LANE (${row.worktree.branch ?? "?"}), not a MAIN`, { slot: main.slot });
const agent = row.agent ?? null;
if (agent !== "alive" && agent !== "unprobed")
  refuse(`${label}: no agent alive in slot ${main.slot} (agent=${agent ?? "UNKNOWN — not probed yet"})`, { slot: main.slot, agent });

const r = await api("/send", { method: "POST", headers: ownerH(), body: JSON.stringify({ slot: main.slot, text, openedAt: main.openedAt }) });
const receiver = r.body?.receipt?.receiver ?? null;
// the route pins its receipt to the occupant it actually typed into; one that is not the bound MAIN
// means the slot moved inside the window above, and saying "sent" would hide exactly that.
const wrongOccupant = receiver !== null && receiver.openedAt !== main.openedAt;
const lines = [`send --main ${want} → slot ${main.slot}: ${r.status} ${r.ok ? `receipt ${r.body.receipt?.sendId} acceptance=${r.body.receipt?.acceptance ?? "?"}` : (r.body?.error ?? JSON.stringify(r.body).slice(0, 300))}`];
if (wrongOccupant) lines.push(`  DELIVERED TO A DIFFERENT OCCUPANT (openedAt ${receiver.openedAt} ≠ bound ${main.openedAt}) — the slot moved between the read and the POST`);
out({ ok: r.ok && !wrongOccupant, sent: r.ok, program: want, slot: main.slot, status: r.status, receipt: r.body?.receipt ?? null, error: r.ok ? null : (r.body?.error ?? null) }, lines);
process.exit(r.ok && !wrongOccupant ? 0 : 1);
EOF
  js_run
  ;;

# ================================================================================================
commit-main)
# ------------------------------------------------------------------------------------------------
# A direct commit in the main checkout, but only when no land is in flight — the rule "read the
# merges sensor before a direct commit" as one move instead of a memory. A land rebases onto main;
# a commit landing under it moves the ground the land's verify just measured.
#
# The sensor is THIS SCRIPT's `merges`, called as a child and read through its --json, so there is
# one land sensor and not a second copy of its union/busy rule. Three answers stop the commit, each
# named: busy past the budget ("a land is running (slot N) — nothing committed"), a sensor that could
# not run, and a live half that was never asked (no owner token: a lane's FIRST land has no persisted
# verdict while it runs, so a persisted-only "nothing busy" is not a no). A sensor that fails to
# answer is retried within the same budget before it is refused.
#
# WHAT IT COMMITS is the index as the caller staged it — this verb stages nothing and chooses nothing.
# git's own refusal (nothing staged, a hook) is passed through. The window between the sensor's last
# exit 0 and `git commit` is one process spawn wide; it is narrowed, not closed.
  msgfile=""; budget=${FLEET_CTL_WAIT_MAX_SEC:-600}
  while [ $# -gt 0 ]; do
    case "$1" in
      --json) CTL_JSON=1 ;;
      -m) shift; msgfile=${1:-} ;;
      --budget) shift; budget=${1:-} ;;
      *) printf 'commit-main: unknown argument %s\n' "$1" >&2; exit 2 ;;
    esac
    shift
  done
  [ -n "$msgfile" ] || { printf 'commit-main: give the message file with -m <msgfile>\n' >&2; exit 2; }
  [ -s "$msgfile" ] || { printf 'commit-main: %s is missing or empty — nothing committed\n' "$msgfile" >&2; exit 2; }
  case "$budget" in ''|*[!0-9]*) printf 'commit-main: --budget wants whole seconds, got "%s"\n' "$budget" >&2; exit 2 ;; esac
  need_state commit-main
  msgabs=$(cd "$(dirname "$msgfile")" && pwd -P)/$(basename "$msgfile")
  export CTL_MSGFILE="$msgabs" CTL_BUDGET_SEC="$budget" CTL_POLL_SEC="${FLEET_CTL_POLL_SEC:-15}"
  export CTL_SCRIPT="$CTL_DIR/$(basename "$0")"
  js_head
  cat >> "$CTL_TMP" <<'EOF'
const { spawnSync } = require("child_process");
const pollMs = Math.max(1, Number(process.env.CTL_POLL_SEC || 15)) * 1000;
const deadline = Date.now() + Number(process.env.CTL_BUDGET_SEC) * 1000;
const refuse = (code, reason, extra = {}) => {
  if (JSONOUT) console.log(JSON.stringify({ ok: false, committed: false, refused: reason, ...extra }, null, 2));
  console.error(`commit-main: ${reason} — nothing committed`);
  process.exit(code);
};
const sleep = () => new Promise((res) => setTimeout(res, Math.max(0, Math.min(pollMs, deadline - Date.now()))));
let sensor;
for (;;) {
  const r = spawnSync("sh", [process.env.CTL_SCRIPT, "merges", "--json"], { encoding: "utf8" });
  try { sensor = JSON.parse(r.stdout); } catch { sensor = null; }
  // a sensor that did not answer is retried inside the budget — a fleet.json caught mid-write is not
  // a verdict — and refused by name once the budget is spent; it is never read as "no land running"
  if (sensor === null || (r.status !== 0 && r.status !== 1)) {
    if (Date.now() >= deadline)
      refuse(2, `the merges sensor could not run (exit ${r.status}: ${String(r.stderr ?? "").trim().slice(0, 200)})`);
    await sleep();
    continue;
  }
  if (sensor.liveKnown !== true)
    refuse(1, "the live half of merges is UNKNOWN (no owner token) — a lane's first land has no persisted verdict while it runs");
  if (r.status === 0 && (sensor.busy ?? []).length === 0) break;
  if (Date.now() >= deadline)
    refuse(1, `a land is running (slot ${(sensor.busy ?? []).join(", ")})`, { busy: sensor.busy ?? [], budgetSec: Number(process.env.CTL_BUDGET_SEC) });
  await sleep();
}
const c = spawnSync("git", ["-C", HOME, "commit", "-F", process.env.CTL_MSGFILE], { encoding: "utf8" });
if (c.status !== 0)
  refuse(1, `git commit in ${HOME} refused (exit ${c.status}): ${`${c.stdout ?? ""}${c.stderr ?? ""}`.trim().split("\n").slice(0, 3).join(" | ").slice(0, 300)}`);
const sha = (spawnSync("git", ["-C", HOME, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout ?? "").trim();
out({ ok: true, committed: true, sha, home: HOME }, [`commit-main: ${sha.slice(0, 12)} committed in ${HOME} — merges read exit 0 immediately before`]);
EOF
  js_run
  ;;

*)
  printf 'ctl.sh: unknown verb "%s" — verbs: %s\n\n' "$verb" "$CTL_VERBS" >&2
  usage >&2
  exit 2
  ;;
esac

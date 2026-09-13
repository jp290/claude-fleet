#!/bin/sh
# Fleet's derivable state, computed at read time — never written down, so it cannot rot.
#
# WHY THIS EXISTS: a handoff that states state is wrong by the next land. Session 8's was wrong
# by six ledger rows within a day; two of session 9's own errors were stale numbers quoted from
# prose. Everything this script prints is derived from git, the ledgers and the running fleet.
# HANDOFF.md carries only the RESIDUE — intent, what is in flight, corrections, the next-step
# order and its reasoning — i.e. the things git genuinely cannot carry.
#
# Usage:  ./state.sh            (run it at the start of a session, before believing anything)
#         ./state.sh --since <ref>   (default: the last handoff commit)
set -u
cd "$(dirname "$0")" || exit 1

# CLAUDE.md tells every LANE to run this script, but the things it senses — the running server, the
# gitignored ledgers — live in the MAIN checkout, and from a lane $PWD is the worktree. So anchor
# once, here, on the canonical main checkout: the common git dir is shared by every worktree, so
# its parent is the same path from anywhere. Symlinks resolved, because lsof reports the real path
# (and createWorktree stores a realpath'd toplevel too). Outside a repo this degrades to $PWD.
rp() { [ -n "${1:-}" ] && (cd "$1" 2>/dev/null && pwd -P) || printf '%s\n' "${1:-}"; }
MAIN_CHECKOUT=$(rp "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)")")
# ...unless this is a CLONE lane, where that anchor lands on the lane's OWN .git and the whole
# sensor would report on the clone while claiming to report on the fleet. A clone is self-contained
# by design, so the common dir cannot lead home — `origin` is what still points there.
if [ ! -f "$MAIN_CHECKOUT/server.ts" ]; then
  ORIGIN=$(rp "$(git config --get remote.origin.url 2>/dev/null)")
  [ -f "$ORIGIN/server.ts" ] && MAIN_CHECKOUT=$ORIGIN
fi
export MAIN_CHECKOUT

SINCE=${2:-$(git log --format=%H -1 --grep='docs(handoff)' 2>/dev/null)}
[ -n "${SINCE:-}" ] || SINCE=$(git log --format=%H -1)

echo "=== HEAD ==="
git log --oneline -1
echo
echo "=== landed since the last handoff ($(git log --oneline -1 "$SINCE" | cut -c1-50)) ==="
git log --oneline "$SINCE"..HEAD | sed 's/^/  /'
echo "  (read the BODIES, not just the subjects: git log $SINCE..HEAD)"
echo
echo "=== lanes on disk ==="
git worktree list | tail -n +2 | sed 's/^/  /'
# A CLONE lane is its own repository, so `git worktree list` cannot see it and this section would
# under-report by exactly the lanes whose whole point is that they are separate. Same directory
# convention, so the same glob finds them; the discriminator is that their .git is a directory.
for d in "$MAIN_CHECKOUT".worktrees/*/; do
  [ -d "${d}.git" ] || continue
  echo "  ${d%/}  [clone: $(git -C "$d" rev-parse --abbrev-ref HEAD 2>/dev/null)]"
done
echo "  a worktree with no slot is an orphan: land it or discard it"
echo
echo "=== ledgers (fleet-wide, gitignored — they exist only in the main checkout) ==="
python3 - <<'PY'
import json, glob, os
from collections import Counter
# Read from the MAIN checkout, not the cwd: a lane has none of these files, and the old code
# turned that into zeros — "post-land audits 0 | {}" reads like "no audit ever ran" instead of
# "I cannot see them". So absence returns None and prints UNKNOWN; only a file that exists and
# is empty may print 0. Same rule the rest of this codebase follows for wouldConflict/verify.ok.
MAIN = os.environ.get('MAIN_CHECKOUT') or '.'
def rows(p):
    fp = os.path.join(MAIN, p)
    if not os.path.isfile(fp):
        return None
    return [json.loads(l) for l in open(fp) if l.strip()]
o = rows('lane-outcomes.jsonl')
if o is None:
    print("  outcomes UNKNOWN — lane-outcomes.jsonl absent (not the same as none)")
else:
    md = [r for r in o if r.get('origin') == 'main-direct']
    lanes = [r for r in o if r.get('origin') != 'main-direct']
    s = [r for r in lanes if r.get('cleanReviewShadow')]
    ws = sum(1 for r in s if (r.get('cleanReviewShadow') or {}).get('verdict') == 'would_stop')
    print(f"  outcomes {len(lanes)} | shadow {len(s)} | would_stop EVER {ws}")
    print(f"  main-direct {len(md)} | {dict(Counter(r.get('result') for r in md))}")
a = rows('post-land-audits.jsonl')
if a is None:
    print("  post-land audits UNKNOWN — post-land-audits.jsonl absent (not the same as none)")
else:
    print(f"  post-land audits {len(a)} | {dict(Counter(r.get('result') for r in a))}")
    if a:
        last = a[-1]
        # The word alone is not the verdict. 613faa3 truncated e2e-isolated.sh so it exited 0
        # without ever starting the runner, and this line reported "green" to the next session
        # twice. What separates a measurement from a phantom is the duration and the check count:
        # a real run is ~680-700s with PASS lines; `checks` exists only since 54ea616, so absent
        # is "old row", never zero. Printed next to the word so nobody has to know that story.
        # TWO CLOCKS, NAMED. `ms` is WALL CLOCK — the queue in front of the suite mutex is inside
        # it, and holding it against FLEET_POSTLAND_AUDIT_TIMEOUT_MS compares two different
        # quantities. Measured 2026-09-07 on the row covering 61156ac5: ms 5 149 164 (85.8 min)
        # against a 75-min ceiling, and GREEN with 3885/0 — because waitMs 2 561 000 of it was
        # queueing. `workMs` is what that ceiling actually binds. ABSENT IS UNKNOWN, never 0: a
        # row from before the field, a remote row, a run that never spawned a child. Same rule
        # as everything else in this section — absence is not a measurement.
        ms = last.get('ms')
        wk = last.get('workMs')
        wt = last.get('waitMs')
        ck = last.get('checks')
        shape = f" {round(ms/1000)}s wall" if isinstance(ms, (int, float)) else " ?s wall"
        if isinstance(wk, (int, float)):
            q = f"queue {round(wt/1000)}s" if isinstance(wt, (int, float)) else "queue not reported"
            shape += f" (work {round(wk/1000)}s · {q})"
        else:
            shape += " (work UNKNOWN — this row carries no workMs, so the wall figure is all"
            shape += " there is and it contains the mutex queue)"
        if isinstance(ck, dict):
            shape += f" · checks {ck.get('ran')}/{ck.get('failed')} failed"
        elif ck is None:
            shape += " · checks not recorded (row predates 54ea616)"
        # …and since 2026-09-04 the duration only means that for a run of the FULL suite. A
        # docs-only entry is audited by the short chain (install+pins) and finishes in seconds BY
        # DESIGN, stamped `proportional` — without this the cheap case would raise the alarm that
        # exists for the phantom case, on every docs land.
        prop = last.get('proportional') is True
        if prop:
            shape += f" · proportional [{','.join(last.get('steps') or [])}]"
        # …and the phantom test asks the WORK clock when there is one. A run that queued 40 min and
        # then exited instantly has a large `ms` and no measurement in it at all — the exact shape
        # the wall figure hides. Falls back to `ms` for a row without `workMs`, which is the old
        # behaviour for old rows and is weaker rather than wrong.
        dur = wk if isinstance(wk, (int, float)) else ms
        suspect = not prop and isinstance(dur, (int, float)) and dur < 60_000
        print(f"  newest audit: {last.get('result')} on {str(last.get('mainSha'))[:8]}{shape}"
              f" covering {[c.get('branch','')[-9:] for c in last.get('covers',[])]}")
        if suspect:
            print("    ^ under a minute of WORK: a full isolated run is ~11 min. This may be a"
                  " suite that never ran — read the row's out, do not trust the colour")
td = os.path.join(MAIN, 'e2e-trail')
tail = "  — audits write to $TMPDIR/fleet-e2e-trail instead; see docs/e2e-trail.md"
if not os.path.isdir(td):
    print("  check-trail runs UNKNOWN — e2e-trail/ absent" + tail)
else:
    print(f"  check-trail runs (main checkout) {len(sorted(glob.glob(os.path.join(td, '*.jsonl'))))}" + tail)
PY
echo
echo "=== land health (derived; the ledgers already carried all of this, nobody read it) ==="
python3 - <<'PY'
import json, os, subprocess
from collections import Counter
MAIN = os.environ.get('MAIN_CHECKOUT') or '.'
def rows(p):
    fp = os.path.join(MAIN, p)
    return [json.loads(l) for l in open(fp) if l.strip()] if os.path.isfile(fp) else None

o = rows('lane-outcomes.jsonl')
if o is None:
    print("  outcomes UNKNOWN — lane-outcomes.jsonl absent (not the same as none)")
elif not o:
    print("  outcomes 0 — the file exists and is empty")
else:
    o = [r for r in o if r.get('origin') != 'main-direct']
    if not o:
        print("  lanes 0 — main-direct rows are reported separately above")
    disp = Counter(r.get('disposition') for r in o)
    landed = disp.get('landed', 0)
    never = len(o) - landed
    if o:
        print(f"  lanes {len(o)}: " + " · ".join(f"{k} {v}" for k, v in disp.most_common()))
    # the denominator is the point: a land-success rate over lands only is a rate over survivors
    if o:
        print(f"    landed {landed}/{len(o)} = {landed*100//len(o)}% of ALL lanes — {never} never reached a merge")
    res = sum(1 for r in o if r.get('resolvedConflict'))
    rr = Counter(r.get('repairRounds') for r in o)
    worst = max((k for k in rr if isinstance(k, int)), default=None)
    if o:
        print(f"    conflict resolver ran {res}/{len(o)} · repair rounds: max {worst}"
              f" — the loop arms only on !clean AND verify red (server.ts, MERGE_REPAIR_ROUNDS)")
    # R4 becomes scorable only on landed rows that kept their original fork (LaneOutcome.forkSha).
    # Under 10 such rows a precision/recall is noise, so the count stands alone until then.
    fk = [r for r in o if r.get('forkSha')]
    fl = [r for r in fk if r.get('disposition') == 'landed' and r.get('mainAfter')]
    line = f"    forkSha on {len(fk)}/{len(o)} rows, {len(fl)} landed with mainAfter"
    if len(fl) < 10:
        line += " — R4 precision/recall from 10 on (land-collision-stats.ts)"
    else:
        try:
            p = subprocess.run(['bun', 'land-collision-stats.ts', '--ledger', os.path.join(MAIN, 'lane-outcomes.jsonl'),
                                '--forked-only', '--table'], capture_output=True, text=True, timeout=300)
            line += f" · {p.stdout.strip()}" if p.returncode == 0 and p.stdout.strip() \
                else f" · R4 score UNKNOWN — land-collision-stats.ts exited {p.returncode}: {p.stderr.strip()[:120]}"
        except (OSError, subprocess.TimeoutExpired) as e:
            line += f" · R4 score UNKNOWN — {type(e).__name__}"
    print(line)

# the gate's two budgets live on the land notes, not in the outcome rows. One cat-file --batch
# reads every note in one process; GIT_OPTIONAL_LOCKS=0 keeps these read-only calls off .git/index.lock
env = {**os.environ, 'GIT_OPTIONAL_LOCKS': '0'}
def git(*a):
    return subprocess.run(['git', '-C', MAIN, *a], capture_output=True, text=True, env=env)
lst = git('notes', '--ref=fleet/land', 'list')
if lst.returncode != 0:
    print("  land notes UNKNOWN — `git notes --ref=fleet/land` failed (not the same as none)")
else:
    ids = [ln.split()[0] for ln in lst.stdout.splitlines() if ln.strip()]
    p = subprocess.run(['git', '-C', MAIN, 'cat-file', '--batch'], input="\n".join(ids) + "\n",
                       capture_output=True, text=True, env=env)
    notes = []
    for ln in p.stdout.split('\n'):
        ln = ln.strip()
        if ln.startswith('{'):
            try: notes.append(json.loads(ln))
            except Exception: pass
    ok = Counter((n.get('verify') or {}).get('ok') for n in notes)
    work = sorted(v for n in notes if isinstance((v := (n.get('verify') or {}).get('ms')), int))
    wait = sorted(v for n in notes if isinstance((v := (n.get('verify') or {}).get('waitMs')), int))
    def pct(a, q): return a[min(len(a) - 1, int(len(a) * q))] if a else None
    print(f"  land notes {len(notes)} of {len(ids)} readable · verify.ok "
          f"true {ok.get(True,0)} · skipped {ok.get(None,0)} · FAILED {ok.get(False,0)}")
    if work:
        print(f"    gate WORK  p50 {pct(work,.5)//1000}s p90 {pct(work,.9)//1000}s max {work[-1]//1000}s  (n={len(work)})")
    if wait:
        free = sum(1 for w in wait if w == 0)
        print(f"    gate WAIT  p50 {pct(wait,.5)//1000}s p90 {pct(wait,.9)//1000}s max {wait[-1]//1000}s"
              f"  — {free}/{len(wait)} waited 0s (suite mutex free)")
    if not work and not wait:
        print("    gate timing UNKNOWN — no note carries ms/waitMs yet (the fields postdate 08dc17a)")
    # THE CONFLICT RESOLVER'S OWN COST, which no ledger could state before 2026-09-06: the note
    # carried THAT a conflict was agent-resolved and never which agent, how it answered, or how
    # long it took. One `resolverRuns` row per worker SPAWN (resolver first, then each repair
    # round), so `runs` is spawns and not lands. `first-try` is the strictest reading on purpose:
    # the job's first spawn answered `rebased` AND no repair round followed it — a resolution that
    # needed a repair round is not a first-try success however green it ended.
    runs = [r for n in notes for r in (n.get('resolverRuns') or []) if isinstance(r, dict)]
    jobs = [n.get('resolverRuns') for n in notes if n.get('resolverRuns')]
    if not runs:
        print("    resolver UNKNOWN — no land note carries resolverRuns yet (the field postdates"
              " 2026-09-06; a clean rebase spawns no resolver and correctly has none)")
    else:
        # backend rides in the key: a codex-exec run of the same model name is not the same run,
        # and a histogram that hid that would answer the model question with two things in one bar
        hist = Counter(f"{r.get('model')}{'/' + r['backend'] if r.get('backend') else ''}" for r in runs)
        first = sum(1 for j in jobs if len(j) == 1 and j[0].get('status') == 'rebased')
        st = Counter(r.get('status') for r in runs)
        print(f"    resolver: {len(runs)} runs over {len(jobs)} conflict lands · "
              + " ".join(f"{m} {c}" for m, c in hist.most_common())
              + f" · first-try {first}/{len(jobs)} = {first*100//len(jobs)}%")
        print("      statuses: " + " ".join(f"{k} {v}" for k, v in st.most_common())
              + "  — unparseable/error are the model failing its contract or its clock, not git")

# M1 · EVERY merge verdict, not only the ones that landed. A land note exists only for a land and
# fleet.json keeps only the LAST verdict per slot, so until `merge_verdict` (2026-09-06) the deaths
# were the one class this whole section could not see. Both generations, because audit.jsonl
# rotates and a single-file reader would report the history as young rather than truncated.
# Read directly rather than through rows(): audit.jsonl is appended to constantly, a torn
# mid-append line is the documented hazard (server/persist.ts#readLedger counts them), and a
# json.loads that throws would take this whole section down with it. A hole is REPORTED.
mv, torn = [], 0
for gen in ('audit.jsonl.1', 'audit.jsonl'):
    fp = os.path.join(MAIN, gen)
    if not os.path.isfile(fp):
        continue
    for line in open(fp):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except Exception:
            torn += 1
            continue
        if r.get('event') == 'merge_verdict':
            mv.append(r)
if torn:
    print(f"  audit.jsonl: {torn} torn line(s) — the counts below are over what parsed, not over the file")
if not mv:
    print("  merge verdicts UNKNOWN — no merge_verdict row in audit.jsonl yet (the event postdates"
          " 2026-09-06; absence is not 'no verdicts happened')")
else:
    waited = sum(1 for r in mv if r.get('waitedOut'))
    timed = sum(1 for r in mv if r.get('timedOut'))
    st = Counter(f"{r.get('status')}{'' if r.get('landed') else '/kept'}" for r in mv)
    print(f"  merge verdicts {len(mv)}: " + " · ".join(f"{k} {v}" for k, v in st.most_common())
          + f"  — {waited} never started (suite mutex), {timed} timed out")
    why = Counter(r.get('errorReason') for r in mv if r.get('status') == 'error')
    if why:
        print("    error verdicts by reason: "
              + " ".join(f"{k or 'UNNAMED'} {v}" for k, v in why.most_common())
              + "  — UNNAMED is an error the writer could not type, not one nobody looked at")
PY
echo
echo "=== is the running server the code on disk?  (main checkout: $MAIN_CHECKOUT) ==="
for p in $(pgrep -f 'bun server.ts' 2>/dev/null); do
  cwd=$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
  if [ "$(rp "$cwd")" = "$MAIN_CHECKOUT" ]; then
    echo "  LIVE  pid $p  up since $(LC_ALL=C ps -o lstart= -p "$p" | xargs)"
  else
    echo "  stray pid $p  cwd $cwd   <- not the fleet; a leaked e2e server if it is in TMPDIR"
  fi
done
echo "  deploy gap = commits above newer than that start time (server code only;"
echo "  client changes go live on 'bun run build' alone)"
echo
# Three answers, never a silent green: equal · a measured distance · UNKNOWN with its reason. The
# remote name follows server.ts#HUB_REMOTE when this shell carries FLEET_HUB_REMOTE, else `hub`.
HUB=${FLEET_HUB_REMOTE:-hub}
echo "=== hub vs local main  (remote: $HUB) ==="
hub_sensor() {
  local_sha=$(git -C "$MAIN_CHECKOUT" rev-parse --verify -q refs/heads/main) \
    || { echo "  UNKNOWN: no local refs/heads/main"; return; }
  git -C "$MAIN_CHECKOUT" config --get "remote.$HUB.url" >/dev/null \
    || { echo "  UNKNOWN: no remote '$HUB' configured"; return; }
  err=$(mktemp "${TMPDIR:-/tmp}/state-hub.XXXXXX")
  # BatchMode: a key prompt fails fast instead of waiting; macOS has no `timeout` to cut a hang.
  out=$(GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND='ssh -o BatchMode=yes -o ConnectTimeout=5' \
    git -C "$MAIN_CHECKOUT" ls-remote "$HUB" refs/heads/main 2>"$err")
  rc=$?
  first=$(head -1 "$err" | cut -c1-120); rm -f "$err"
  [ "$rc" -eq 0 ] || { echo "  UNKNOWN: ls-remote failed (exit $rc): $first"; return; }
  hub_sha=$(printf '%s\n' "$out" | awk '$2=="refs/heads/main"{print $1}')
  [ -n "$hub_sha" ] || { echo "  UNKNOWN: hub has no refs/heads/main"; return; }
  h8=$(printf '%.8s' "$hub_sha"); l8=$(printf '%.8s' "$local_sha")
  if [ "$hub_sha" = "$local_sha" ]; then echo "  hub main = $h8 = local main"; return; fi
  git -C "$MAIN_CHECKOUT" cat-file -e "$hub_sha^{commit}" 2>/dev/null \
    || { echo "  hub main $h8 · local main $l8 · distance UNKNOWN: hub sha not in local objects"; return; }
  set -- $(git -C "$MAIN_CHECKOUT" rev-list --left-right --count "$hub_sha...$local_sha")
  if [ "$1" -eq 0 ]; then
    oldest=$(git -C "$MAIN_CHECKOUT" log --reverse --format='%ct %cI' "$hub_sha..$local_sha" | head -1)
    age_h=$(( ($(date +%s) - ${oldest%% *}) / 3600 ))
    echo "  hub main $h8 · local main $l8 · hub BEHIND $2 commit(s), oldest unpushed ${oldest#* } (${age_h}h)"
  elif [ "$2" -eq 0 ]; then
    echo "  hub main $h8 · local main $l8 · hub AHEAD $1 commit(s)"
  else
    echo "  hub main $h8 · local main $l8 · DIVERGED $1/$2 (hub-only/local-only)"
  fi
}
hub_sensor
echo "  (a direct commit in the main checkout never calls server.ts#recordLand, so"
echo "   server.ts#pushLandToHub never pushes it — only the NEXT land closes this gap)"
echo
echo "=== machine hygiene (nothing reaps these) ==="
echo "  leaked e2e tmux sockets: $(ls /private/tmp/tmux-501/ 2>/dev/null | grep -c fleet)"
echo "  TMPDIR e2e scratch:      $(du -shc "${TMPDIR:-/tmp}"/fleet-e2e-instance-* 2>/dev/null | tail -1 | cut -f1)"
echo "  suites running now:      $(ps -eo command | grep -c '^/bin/sh ./e2e-isolated.sh')"
echo
echo "=== config sensor (Wert+Quelle je FLEET_*, und ob ein Repo-Overlay den env-Wert schlaegt) ==="
python3 - <<'PY'
import subprocess, re, os, json
def sh(cmd):
    try: return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10).stdout
    except Exception: return ''
def clip(v): return (v[:44] + '…') if len(v) > 44 else v
# Same anchor as the section above — from a lane, $PWD is the worktree and this sensor went blind.
main_checkout = os.path.realpath(os.environ.get('MAIN_CHECKOUT') or '.')
live = {}
for p in sh("pgrep -f 'bun server.ts'").split():
    c = [l[1:] for l in sh(f'lsof -a -p {p} -d cwd -Fn').splitlines() if l.startswith('n')]
    if c and os.path.realpath(c[0]) == main_checkout:
        # ps eww hängt die Env an die Kommandozeile; mehrteilige Werte (die *_CMD) erscheinen
        # nur bis zum ersten Leerzeichen — für den Sensor reicht Existenz + Präfix
        for m in re.finditer(r'(FLEET_[A-Z_]+)=(\S*)', sh(f'ps eww -p {p}')):
            live[m.group(1)] = m.group(2)
tmx = dict(re.findall(r'^(FLEET_[A-Z_]+)=(.*)$', sh('tmux -L claudefleet show-environment -g 2>/dev/null'), re.M))
env = {}
try: env = dict(re.findall(r'^(FLEET_[A-Z_]+)=(.*)$', open('.env').read(), re.M))
except FileNotFoundError: pass
wd = {}
try:
    for m in re.finditer(r'(FLEET_[A-Z_]+)=', open('watchdog.sh').read()): wd.setdefault(m.group(1), True)
except FileNotFoundError: pass
# ── Ring 1.2a: die Schicht ÜBER dem Env ───────────────────────────────────────────────────
# Ring 1.1 gab jedem FLEET_* Wert+Quelle (vorher hatten 31/42 Werte gar keinen Sensor). Der Fehler,
# den das übrig ließ: die vier Quellen oben sind ALLE dieselbe Schicht. Darüber liegt eine zweite, die sie SCHLÄGT:
# ein in fleet.json persistierter Repo-Eintrag (server.ts#repoLaneCap, #workerCmdFor — beide
# kommentiert mit "entry beats env") und die env-getragene Pro-Repo-Karte FLEET_VERIFY_CMD_REPOS
# (server.ts#verifyCmdFor). Bis 2026-09-08 war dieser Sensor dafür strukturell blind: er druckte
# FLEET_DISPATCH_MAX_LANES=1 aus `ps eww`, effektiv sind es 3 (repoLaneCaps-Eintrag), und zwei
# Sessions haben aus der 1 falsche Wartevorhersagen abgeleitet.
# ENUMERIERT AM CODE, nicht abgeschrieben: die repo-geschlüsselten Karten in server.ts#saveState
# (`repoBases, repoWorkers, repoLaneCaps`) plus `grep -n '_REPOS' server.ts`. repoBases steht
# NICHT in der Tabelle — es überlagert kein FLEET_*, sondern den HEAD des Haupt-Checkouts
# (server.ts#integrationBranch), macht also keine Zeile hier falsch.
# UND: ein Sensor, der nicht messen konnte, scheitert als ER SELBST — fehlt fleet.json, sagt die
# Zeile UNBEKANNT und nennt die Route. Nie ein stilles Zurückfallen auf den env-Wert.
FLEET_JSON = os.path.join(main_checkout, 'fleet.json')
state, state_err = None, None
try:
    with open(FLEET_JSON) as f: state = json.load(f)
except Exception as e:
    state_err = type(e).__name__
# (env-Variable, Karte in fleet.json, Unterschlüssel, Route für den, der die Datei nicht hat)
PERSISTED_OVERLAYS = [
    ('FLEET_DISPATCH_MAX_LANES', 'repoLaneCaps', None,        'GET /api/repo-lane-caps'),
    ('FLEET_COMMIT_CMD',         'repoWorkers',  'commitMsg', 'GET /api/repo-workers'),
    ('FLEET_POSTLAND_AUDIT_CMD', 'repoWorkers',  'audit',     'GET /api/repo-workers'),
]
def entries_for(mapname, sub):
    m = state.get(mapname) if isinstance(state, dict) else None
    if not isinstance(m, dict): return {}
    out = {}
    for repo, v in m.items():
        if sub is None:
            if isinstance(v, (int, float, str)): out[repo] = v
        elif isinstance(v, dict) and sub in v: out[repo] = v[sub]
    return out
def verify_repos():
    """FLEET_VERIFY_CMD_REPOS ist selbst env — die EXISTENZ sieht der Sensor immer, den INHALT nur
    aus einer ungekürzten Quelle (`ps eww` schneidet am ersten Leerzeichen). Kein Inhalt heißt hier
    unbekannt, nicht leer."""
    raw = next((d['FLEET_VERIFY_CMD_REPOS'] for d in (env, tmx) if 'FLEET_VERIFY_CMD_REPOS' in d), None)
    if raw is None:
        return ({}, 'nur gekürzt aus `ps eww` lesbar') if 'FLEET_VERIFY_CMD_REPOS' in live else (None, None)
    v = raw.strip()
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"": v = v[1:-1]
    try: d = json.loads(v)
    except Exception: return {}, 'unparsbar'
    return (d, None) if isinstance(d, dict) else ({}, 'kein JSON-Objekt')
def others(e):
    n = len(e) - (1 if main_checkout in e else 0)
    return f'; +{n} andere Repo(s)' if n else ''
def overlay_lines(k):
    out = []
    for var, mapname, sub, route in PERSISTED_OVERLAYS:
        if var != k: continue
        where = f'fleet.json {mapname}' + (f'[…].{sub}' if sub else '')
        if state is None:
            out.append(f"↳ hat Repo-Overlay ({where}) — UNBEKANNT: fleet.json nicht lesbar "
                       f"({state_err}). Env ist NICHT die Antwort, frag {route}")
            continue
        e = entries_for(mapname, sub)
        if main_checkout in e:
            out.append(f"↳ Repo-Overlay {where}: EFFEKTIV {clip(str(e[main_checkout]))} — "
                       f"Quelle 'repo entry', schlägt env{others(e)}")
        elif e:
            out.append(f"↳ Repo-Overlay {where}: {len(e)} Eintrag/Einträge, keiner für diesen "
                       f"Checkout — hier gilt der env-Wert ({clip(', '.join(sorted(e)))})")
        else:
            out.append(f"↳ Repo-Overlay {where} gelesen: kein Eintrag — env gilt")
    if k == 'FLEET_VERIFY_CMD':
        d, why = verify_repos()
        if d is None: pass
        elif why:
            out.append(f"↳ hat Repo-Overlay (env FLEET_VERIFY_CMD_REPOS) — UNBEKANNT: {why}. "
                       f"Env ist NICHT die Antwort")
        elif main_checkout in d:
            out.append(f"↳ Repo-Overlay FLEET_VERIFY_CMD_REPOS: EFFEKTIV {clip(str(d[main_checkout]))} — "
                       f"Quelle 'repo entry', schlägt env{others(d)}")
        elif d:
            out.append(f"↳ Repo-Overlay FLEET_VERIFY_CMD_REPOS: {len(d)} Eintrag/Einträge, keiner für "
                       f"diesen Checkout — hier gilt der env-Wert")
    return out
# Eine Variable, die NUR ein Overlay hat und in keiner der vier Quellen steht, hätte sonst gar
# keine Zeile — genau der Fall, in dem die Überlagerung am unsichtbarsten ist.
ov_keys = {var for var, mapname, sub, _ in PERSISTED_OVERLAYS
           if state is None or entries_for(mapname, sub)}
if verify_repos()[0] is not None: ov_keys.add('FLEET_VERIFY_CMD')
srcs = [('live', live), ('tmux-global', tmx), ('.env', env)]
for k in sorted(set(live) | set(tmx) | set(env) | set(wd) | ov_keys):
    parts = [f"{n}={clip(d[k])}" for n, d in srcs if k in d]
    if k in wd: parts.append('watchdog.sh')
    print(f"  {k:32s} {' | '.join(parts) if parts else '(in keiner der vier Env-Quellen)'}")
    for ln in overlay_lines(k): print(f"  {'':32s}   {ln}")
for k, v in tmx.items():
    if k in live and live[k] != v and not k.endswith('_CMD'):
        print(f"  ⚠ {k}: tmux-global={clip(v)} != live={clip(live[k])}")
for k, v in env.items():
    if k in tmx and tmx[k] != v:
        print(f"  ⚠ {k}: .env={clip(v)} liegt UNTER tmux-global={clip(tmx[k])} (echte Env gewinnt)")
if not live: print('  (kein LIVE-Server im Haupt-Checkout — live-Spalte leer)')
PY
echo "  (watchdog.sh-Spalte = kommt in der Spawn-Zeile vor, eingefroren bis launchctl kickstart;"
echo "   Werte, die NUR in server.ts-Defaults leben, haben weiterhin keinen Sensor — Ring 1.2.)"
echo "  (eine Zeile OHNE ↳ hat keinen bekannten Repo-Overlay; ein ↳ UNBEKANNT heisst NICHT 'kein"
echo "   Overlay', sondern 'diese Maschine konnte die zweite Schicht nicht lesen' — dann gilt die Route.)"
echo
echo "Health check (the server binds ONLY the Tailscale IP; 127.0.0.1 never answers):"
echo "  curl http://100.64.0.1:8790/"

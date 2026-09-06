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
        ms = last.get('ms')
        ck = last.get('checks')
        shape = f" {round(ms/1000)}s" if isinstance(ms, (int, float)) else " ?s"
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
        suspect = not prop and isinstance(ms, (int, float)) and ms < 60_000
        print(f"  newest audit: {last.get('result')} on {str(last.get('mainSha'))[:8]}{shape}"
              f" covering {[c.get('branch','')[-9:] for c in last.get('covers',[])]}")
        if suspect:
            print("    ^ under a minute: a full isolated run is ~11 min. This may be a suite that"
                  " never ran — read the row's out, do not trust the colour")
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
echo "=== machine hygiene (nothing reaps these) ==="
echo "  leaked e2e tmux sockets: $(ls /private/tmp/tmux-501/ 2>/dev/null | grep -c fleet)"
echo "  TMPDIR e2e scratch:      $(du -shc "${TMPDIR:-/tmp}"/fleet-e2e-instance-* 2>/dev/null | tail -1 | cut -f1)"
echo "  suites running now:      $(ps -eo command | grep -c '^/bin/sh ./e2e-isolated.sh')"
echo
echo "=== config sensor (Ring 1.1: Wert+Quelle je FLEET_*; vorher hatten 31/42 Werte keinen Sensor) ==="
python3 - <<'PY'
import subprocess, re, os
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
srcs = [('live', live), ('tmux-global', tmx), ('.env', env)]
for k in sorted(set(live) | set(tmx) | set(env) | set(wd)):
    parts = [f"{n}={clip(d[k])}" for n, d in srcs if k in d]
    if k in wd: parts.append('watchdog.sh')
    print(f"  {k:32s} {' | '.join(parts)}")
for k, v in tmx.items():
    if k in live and live[k] != v and not k.endswith('_CMD'):
        print(f"  ⚠ {k}: tmux-global={clip(v)} != live={clip(live[k])}")
for k, v in env.items():
    if k in tmx and tmx[k] != v:
        print(f"  ⚠ {k}: .env={clip(v)} liegt UNTER tmux-global={clip(tmx[k])} (echte Env gewinnt)")
if not live: print('  (kein LIVE-Server im Haupt-Checkout — live-Spalte leer)')
PY
echo "  (watchdog.sh-Spalte = kommt in der Spawn-Zeile vor, eingefroren bis launchctl kickstart;"
echo "   Werte, die NUR in server.ts-Defaults leben, haben weiterhin keinen Sensor — Ring 1.2)"
echo
echo "Health check (the server binds ONLY the Tailscale IP; 127.0.0.1 never answers):"
echo "  curl http://100.64.0.1:8790/"

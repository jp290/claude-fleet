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
echo "  a worktree with no slot is an orphan: land it or discard it"
echo
echo "=== ledgers ==="
python3 - <<'PY'
import json, glob
from collections import Counter
def rows(p):
    try:
        return [json.loads(l) for l in open(p) if l.strip()]
    except FileNotFoundError:
        return []
o = rows('lane-outcomes.jsonl')
s = [r for r in o if r.get('cleanReviewShadow')]
ws = sum(1 for r in s if (r.get('cleanReviewShadow') or {}).get('verdict') == 'would_stop')
print(f"  outcomes {len(o)} | shadow {len(s)} | would_stop EVER {ws}")
a = rows('post-land-audits.jsonl')
print(f"  post-land audits {len(a)} | {dict(Counter(r.get('result') for r in a))}")
if a:
    last = a[-1]
    print(f"  newest audit: {last.get('result')} on {str(last.get('mainSha'))[:8]}"
          f" covering {[c.get('branch','')[-9:] for c in last.get('covers',[])]}")
t = sorted(glob.glob('e2e-trail/*.jsonl'))
print(f"  check-trail runs (main checkout) {len(t)}"
      "  — audits write to $TMPDIR/fleet-e2e-trail instead; see docs/e2e-trail.md")
PY
echo
echo "=== is the running server the code on disk? ==="
for p in $(pgrep -f 'bun server.ts' 2>/dev/null); do
  cwd=$(lsof -a -p "$p" -d cwd -Fn 2>/dev/null | grep '^n' | cut -c2-)
  case "$cwd" in
    "$PWD") echo "  LIVE  pid $p  up since $(ps -o lstart= -p "$p" | xargs)";;
    *) echo "  stray pid $p  cwd $cwd   <- not the fleet; a leaked e2e server if it is in TMPDIR";;
  esac
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
import subprocess, re
def sh(cmd):
    try: return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10).stdout
    except Exception: return ''
def clip(v): return (v[:44] + '…') if len(v) > 44 else v
cwd_here = sh('pwd').strip()
live = {}
for p in sh("pgrep -f 'bun server.ts'").split():
    c = [l[1:] for l in sh(f'lsof -a -p {p} -d cwd -Fn').splitlines() if l.startswith('n')]
    if c and c[0] == cwd_here:
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
if not live: print('  (kein LIVE-Server in diesem cwd — live-Spalte leer)')
PY
echo "  (watchdog.sh-Spalte = kommt in der Spawn-Zeile vor, eingefroren bis launchctl kickstart;"
echo "   Werte, die NUR in server.ts-Defaults leben, haben weiterhin keinen Sensor — Ring 1.2)"
echo
echo "Health check (the server binds ONLY the Tailscale IP; 127.0.0.1 never answers):"
echo "  curl http://100.64.0.1:8790/"

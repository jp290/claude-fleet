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
echo "Health check (the server binds ONLY the Tailscale IP; 127.0.0.1 never answers):"
echo "  curl http://100.64.0.1:8790/"

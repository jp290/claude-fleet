#!/bin/sh
# Projekt-Atlas: eine HTML-Seite aus NUR ableitbarem Zustand — die Ring-1.1-Idee als Ansicht.
# Nichts hier ist gepflegte Prosa: state.sh, git, Datei-Metadaten, die zwei Anker-Docs verbatim.
# Handgepflegtes rottet (102/117 tote Refs, gemessen); Abgeleitetes kann nur veralten, nie lügen —
# der Zeitstempel im Kopf sagt, wie alt es ist.
#
# Usage:  ./atlas.sh [outdir]      default outdir: $HOME/fleet-atlas
# Serve:  tmux -L claudefleet new-session -d -s atlas \
#           'cd $HOME/fleet-atlas && python3 -m http.server 8794 --bind 100.64.0.1'
#         plus Regen-Loop, siehe README-Zeile am Seitenfuß. Port 8794: 2026-07-28 frei gemessen
#         (8790 fleet, 8795/8815/8850/8862 fremde Dienste, 8796/8899 bun).
set -u
cd "$(dirname "$0")" || exit 1
OUT=${1:-$HOME/fleet-atlas}
mkdir -p "$OUT"
esc() { python3 -c "import sys,html;sys.stdout.write(html.escape(sys.stdin.read()))"; }
{
cat <<'HEAD'
<!doctype html><html lang=de><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>fleet atlas</title>
<style>
body{background:#0d1117;color:#d8dee6;font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:1rem;max-width:64rem}
h1{font-size:1.2rem}h2{font-size:1rem;color:#8ab4f8;margin-top:1.6rem}
pre{background:#161b22;padding:.8rem;border-radius:8px;overflow-x:auto;font-size:12px;line-height:1.4}
details{margin:.5rem 0}summary{cursor:pointer;color:#8ab4f8}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{padding:.25rem .5rem;text-align:left;border-bottom:1px solid #21262d;vertical-align:top}
.small{color:#7d8590;font-size:12px}
</style>
HEAD
echo "<h1>claude-fleet Atlas</h1><p class=small>generiert $(date '+%Y-%m-%d %H:%M:%S') — alles abgeleitet, nichts gepflegt. Frisch machen: ./atlas.sh im Haupt-Checkout.</p>"
echo "<h2>Zustand jetzt (state.sh, inkl. Config-Sensor)</h2><pre>$(./state.sh 2>&1 | esc)</pre>"
echo "<h2>Letzte 25 Commits — die Bodies sind das Befund-Register (git log im Repo)</h2><pre>$(git log --oneline -25 | esc)</pre>"
echo "<h2>HANDOFF — das Residuum der letzten Session (jede Zeile ist ein Claim)</h2><details><summary>HANDOFF.md aufklappen</summary><pre>$(cat HANDOFF.md 2>/dev/null | esc)</pre></details>"
echo "<h2>Docs-Index (Datei · Erstüberschrift · geändert)</h2><table>"
for f in docs/*.md; do
  h=$(grep -m1 '^# ' "$f" | cut -c3- | head -c 100)
  m=$(stat -f '%Sm' -t '%m-%d %H:%M' "$f" 2>/dev/null)
  echo "<tr><td>$(basename "$f")</td><td>$(printf '%s' "$h" | esc)</td><td class=small>$m</td></tr>"
done
echo "</table>"
echo "<h2>Die zwei Anker-Dokumente verbatim</h2>"
for f in docs/simplification-plan-2026-07-28.md docs/analysis-2026-07-28-verification.md; do
  [ -f "$f" ] && echo "<details><summary>$f</summary><pre>$(cat "$f" | esc)</pre></details>"
done
} > "$OUT/index.html"
echo "atlas: $OUT/index.html"

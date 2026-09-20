#!/bin/sh
# Stage one throwaway instance from a given source tree, fill its bar, screenshot it, tear it down.
# $1 = source checkout   $2 = label   $3 = port   $4 = tmux socket suffix
set -e
SRC="$1"; LABEL="$2"; PORT="$3"; SFX="$4"
# The output directory is the CALLER's: a scratchpad path baked into this file dies with the
# session that wrote it, and the next measurement then writes into a directory nobody serves.
OUT="${SHOT_OUT:?set SHOT_OUT to the directory the images and the budget json go into}"
# Resolved BEFORE the first `cd`: the two drivers are called from inside the staged instance, where
# a relative `dirname $0` resolves to nothing and bun answers "Module not found" — not a crash, just
# two missing files and a run that measured nothing.
HERE=$(cd "$(dirname "$0")" && pwd -P)
DIR=$(mktemp -d "${TMPDIR:-/tmp}/fleet-shot-$LABEL-XXXX")
mkdir -p "$OUT"
cd "$SRC"
. ./e2e-stage.sh
stage_instance "$SRC" "$DIR" server.ts >/dev/null || exit 1
cd "$DIR"
TOK=shotshotshot
FLEET_HOST=127.0.0.1 FLEET_PORT="$PORT" FLEET_SOCK="fleetshot$SFX" FLEET_CMD=true \
  FLEET_TOKEN="$TOK" bun server.ts > "$DIR/server.log" 2>&1 &
SRV=$!
i=0; until curl -sf "http://127.0.0.1:$PORT/api/sessions" -H "authorization: Bearer $TOK" >/dev/null 2>&1; do
  i=$((i+1)); [ $i -gt 60 ] && { echo "server never came up"; tail -20 "$DIR/server.log"; exit 1; }
  sleep 0.5
done
api() { curl -sf -X POST "http://127.0.0.1:$PORT$1" -H "authorization: Bearer $TOK" \
  -H 'content-type: application/json' -d "$2" >/dev/null || echo "  (failed: $1 $2)"; }
# A REPO OF ITS OWN for the lanes, inside the throwaway directory. Pointing them at $SRC made the
# server cut REAL worktrees and REAL branches in the owner's repository — 22 of them accumulated
# from this driver alone on 2026-09-20, each a `fleet/…` branch nobody asked for. The fixture needs
# a git repo with one commit, not this one.
FXREPO="$DIR/fixture-repo"
mkdir -p "$FXREPO"
echo "fixture repo for the sidebar shot" > "$FXREPO/README.md"
( cd "$FXREPO" && git init -q && git add -A \
  && git -c user.email=t@t -c user.name=t commit -qm fixture ) || exit 1
# a bar with something in it: two repo sessions, one plain, plus two lanes off the first
api /api/slots/2/open  "{\"cwd\":\"$FXREPO\",\"label\":\"Orchestrator\"}"
api /api/slots/4/open  "{\"cwd\":\"$FXREPO\",\"label\":\"Fleet-Betrieb\"}"
api /api/slots/7/open  "{\"cwd\":\"$HOME\",\"label\":\"Shell\"}"
sleep 3
api /api/lanes "{\"repo\":\"$FXREPO\"}"
api /api/lanes "{\"repo\":\"$FXREPO\"}"
sleep 6
# The lane rows ARE the thing under test (their band names), and the fold state lives in
# localStorage — which only a page on this origin can seed, and this server serves no such page.
# So Chrome is DRIVEN instead of merely pointed: open, unfold, reload, capture at both widths.
REAL=$(cd "$FXREPO" && pwd -P)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9222 --user-data-dir="$DIR/chrome" --no-first-run \
  "http://127.0.0.1:$PORT/?token=$TOK" > "$DIR/chrome.log" 2>&1 &
CHROME=$!
bun "$HERE/cdp-shot.js" "http://127.0.0.1:$PORT/?token=$TOK" "$REAL" "$OUT/$LABEL" || true
# The area budget is read from the SAME live page, while Chrome is still up and still emulating the
# last width cdp-shot.js set (1200). Two drivers, one instance: a budget taken against a separately
# staged instance would be measuring a different fixture than the picture beside it.
bun "$HERE/flaechenbudget.js" > "$OUT/$LABEL-budget.json" || true

kill "$CHROME" 2>/dev/null || true
kill "$SRV" 2>/dev/null || true
tmux -L "fleetshot$SFX" kill-server 2>/dev/null || true
echo "$LABEL done: $(ls -la "$OUT" | grep "$LABEL" | wc -l) images"

#!/bin/sh
# Fleet's open WORK, computed at read time — the counterpart to state.sh, which does the same for
# the machine's state.
#
# WHY THIS EXISTS: this repository ran two registers. The queue (live, machine-readable) and the
# documents (prose, hand-maintained), with nothing joining them — so the same work stood under
# three names and no process noticed. Measured 2026-08-06 (docs/work-register-2026-08-06.md §4):
# BACKLOG item 13 IS F5 and had already landed; item 12 IS F6 IS queue row 2784427e; P-4 said
# "Client rendering still open" while `deployGap` stood 5× in src/client.ts. A hand-written work
# list is wrong by the next land, exactly as a hand-written state list was — and state.sh is the
# proof that the cure is derivation, not a better document.
#
# WHAT IT WILL NOT DO: it never talks to the running fleet. The queue is read from fleet.json ON
# DISK, so this is safe from a lane and safe while the server is mid-flight (fleet.json is written
# by atomic rename, so a read is never torn). Every git call carries GIT_OPTIONAL_LOCKS=0 — this
# script must never be the thing that puts an index.lock in the land path's way.
#
# WHAT IT WILL NOT CLAIM: section 3. There is no reliable mechanical test for "this brief's work
# has landed", and the obvious one is disproven twice over. briefs/phantom-park.md's work landed as
# 035c1a9 while no commit named the file — and by the time that was written up, the counter read 1,
# because the write-up itself (adcd4ee) names it. The signal counts PROSE ABOUT a brief, in both
# directions. So that section prints facts and labels its verdict column `ungeprüft`. An unknown
# must not read as a zero.
#
# Usage:  ./register.sh          (from the main checkout or from any lane)
set -u
cd "$(dirname "$0")" || exit 1
export GIT_OPTIONAL_LOCKS=0

# The queue lives in fleet.json, which is untracked and belongs to the DIRECTORY the server runs in
# (server.ts: STATE_FILE = import.meta.dir/fleet.json). A lane worktree therefore has none of its
# own; the main worktree is the first line of `git worktree list` and is derived, never spelled out.
MAIN=$(git worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')
STATE=""
if [ -f fleet.json ]; then
  STATE=fleet.json
else
  [ -n "$MAIN" ] && [ -f "$MAIN/fleet.json" ] && STATE="$MAIN/fleet.json"
fi

# Cleaned up on EVERY exit, not just the happy one: nothing on this machine reaps /tmp, so a
# script that only tidies up when it succeeds is a script that litters exactly when it fails.
TMPL=/tmp/fleet-register-lanes.$$
TMPM=/tmp/fleet-register-task-metadata.$$
trap 'rm -f "$TMPL" "$TMPM"' EXIT HUP INT TERM

# One projector for server and shell: exact tracked paths, provenance and clusters are derived in
# task-metadata.ts. Its CLI is deliberately read-only; a failed probe leaves every surface UNKNOWN
# rather than falling back to a second, subtly different parser here.
printf '{"version":1,"tasks":{}}\n' > "$TMPM"
if [ -n "$STATE" ] && command -v bun >/dev/null 2>&1; then
  bun task-metadata.ts --state "$STATE" --default-repo "${MAIN:-$PWD}" > "$TMPM" 2>/dev/null \
    || printf '{"version":1,"tasks":{}}\n' > "$TMPM"
fi

# The surface the running lanes already occupy. Committed work is diffed against the fork point;
# uncommitted work is read per worktree. Both read-only, both lock-free.
: > "$TMPL"
git worktree list --porcelain 2>/dev/null | awk '
  /^worktree /{w=substr($0,10)} /^branch /{print w "\t" substr($0,8)}' | while IFS="$(printf '\t')" read -r wt br; do
  short=${br#refs/heads/}
  case "$short" in main) continue;; esac
  base=$(git merge-base main "$short" 2>/dev/null)
  if [ -n "$base" ]; then
    committed=$(git diff --name-only "$base" "$short" 2>/dev/null)
  else
    committed="?merge-base-failed"
  fi
  dirty=$(git -C "$wt" diff --name-only HEAD 2>/dev/null)
  printf '%s\t%s\n' "$short" "$(printf '%s\n%s\n' "$committed" "$dirty" | sed '/^$/d' | sort -u | tr '\n' ' ')" \
    >> "$TMPL"
done

STATE="$STATE" METADATA="$TMPM" LANES="$TMPL" python3 - <<'PY'
import json, os, re, subprocess, sys, time
from pathlib import Path

STATE   = os.environ["STATE"]
try:
    METADATA = json.loads(Path(os.environ["METADATA"]).read_text()).get("tasks", {})
except Exception:
    METADATA = {}
LANES   = [l.split("\t", 1) for l in Path(os.environ["LANES"]).read_text().splitlines() if l.strip()]

def age(ms):
    if not ms:
        return "?"
    m = (time.time() - ms / 1000) / 60
    return f"{m:.0f}m" if m < 90 else (f"{m/60:.0f}h" if m < 2880 else f"{m/1440:.0f}d")

def sh(cmd):
    try:
        return subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=20).stdout
    except Exception:
        return ""

# A `moved_since(head)` reader stood here until 2026-09-10: the second half of the queue analyst's
# staleness rule, intersecting what a land moved with a row's own file surface so this render and
# the server (analysis-staleness.ts) could not drift apart. The analyst is retired, no row carries a
# verdict to age, and a renderer for a fact nothing produces is drift waiting to happen.

def clip(s, n):
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[: n - 1] + "…"

# ── 1. the queue ────────────────────────────────────────────────────────────────────────────────
print("=== 1. the queue — the register (open rows only) ===")
tasks = None
if not STATE:
    print("  UNKNOWN: no fleet.json found here and none in the main worktree.")
    print("  This is an ABSENCE, not an empty queue — do not read it as 'nothing open'.")
else:
    try:
        tasks = json.load(open(STATE)).get("tasks", [])
        print(f"  source: {STATE}")
    except Exception as e:
        print(f"  UNKNOWN: {STATE} unreadable ({type(e).__name__}: {e}) — an absence, not an empty queue.")

OPEN = ("pending", "queued", "sent")
rows = []
if tasks is not None:
    for t in tasks:
        if t.get("status") not in OPEN:
            continue
        brief = t.get("brief") or {}
        meta = METADATA.get(t.get("id"), {})
        surface = meta.get("files") if isinstance(meta.get("files"), list) else []
        origin = meta.get("filesOrigin") if meta.get("filesOrigin") in ("confirmed", "derived") else None
        cluster = meta.get("cluster") if isinstance(meta.get("cluster"), dict) else None
        rows.append({
            "id": t.get("id", "?"),
            "kind": t.get("kind", "auftrag"),
            "src": (t.get("source") or "?")[:6],
            "status": t.get("status"),
            "bage": age(brief.get("at")) if brief else "",
            "edited": bool(brief.get("edited")),
            "brief": bool(brief),
            "crit": bool((t.get("criterion") or {}).get("confirmedAt")),
            "text": t.get("text", ""),
            "surface": sorted(set(surface)),
            "origin": origin,
            "cluster": cluster,
        })
    byk = {}
    for r in rows:
        byk[r["kind"]] = byk.get(r["kind"], 0) + 1
    print(f"  {len(rows)} open of {len(tasks)} rows   " + " ".join(f"{k}={v}" for k, v in sorted(byk.items())))
    print("  notiz = an observation for the OWNER; the dispatcher never runs one (server.ts, Task.kind)")
    print()
    for r in sorted(rows, key=lambda r: (r["kind"], r["id"])):
        flags = "".join([
            "b" if r["brief"] else "-",       # a compiled brief exists and is readable before the start
            "c" if r["crit"] else "-",        # a done-criterion the owner has confirmed
        ])
        # WHICH BYTES a lane would receive — the one fact left that decides that, now that the
        # queue analyst's verdict column is retired. "raw-request" is not a defect: it is what the
        # row says, and Question 5 (does the claim still hold?) is answered by the surface below.
        v = (("owner-brief" if r["edited"] else "brief") + (f"({r['bage']})" if r["bage"] else "")) \
            if r["brief"] else "raw-request"
        # Question 4: whose decision is it? Mechanical, from the row itself — never a guess.
        waits = "owner" if r["kind"] == "notiz" else \
                "slot" if r["status"] == "sent" else "—"
        print(f"  {r['id']}  {r['kind']:<4} {r['status']:<7} {r['src']:<6} {flags} {v:<22} {waits:<5} {clip(r['text'], 66)}")
        if r["surface"]:
            tag = "[bestätigt/mechanisch]" if r["origin"] == "confirmed" else "[abgeleitet]"
            print(f"        surface {tag}: {' '.join(r['surface'])}")
            if r["cluster"]:
                sub = f"/{r['cluster']['unterprozess']}" if r["cluster"].get("unterprozess") else ""
                print(f"        cluster: {r['cluster'].get('projekt', '?')} / {r['cluster'].get('prozess', '?')}{sub}")
        else:
            print("        surface: UNBEKANNT — no exact tracked path in task/brief and no confirmed field")
    if not rows:
        print("  (no open rows)")
    print()
    print("  flags: b=compiled brief on the row   c=owner-confirmed done-criterion")
    print("  brief(age) = the machine compiled these bytes; owner-brief(age) = the owner wrote or")
    print("  edited them and nothing recompiles over them; raw-request = the row carries no brief")
    print("  and a lane would receive the draft as it stands. None of the three gates anything —")
    print("  releasing is the owner's act (server.ts, releaseTask).")

# ── 2. collision surface ────────────────────────────────────────────────────────────────────────
print()
print("=== 2. collision surface — what may NOT run beside what ===")
print("  Truth values stay separate (briefs/work-register.md §3):")
print("    [bestätigt/mechanisch] owner-confirmed refine `files`, or a running lane's git diff")
print("    [abgeleitet]           exact tracked paths read from task/brief; deterministic but weaker")
print("    UNBEKANNT              no resolvable surface. Not 'no collision' — absence of an answer.")
print("  Only kind=auftrag rows appear: advisory rows are never dispatched and cannot collide as work.")
print()
occupied = {}
for br, files in LANES:
    fs = [f for f in files.split() if f]
    occupied[br] = [f for f in fs if f != "?merge-base-failed"]
    if fs == ["?merge-base-failed"]:
        note = "merge-base against main FAILED — surface UNKNOWN, not empty"
    elif not fs:
        note = "no committed diff vs its fork point and no uncommitted change"
    else:
        note = " ".join(fs[:8]) + (" …" if len(fs) > 8 else "")
    print(f"  lane {br}: {len(occupied[br])} file(s) — {note}")
if not LANES:
    print("  (no lane worktrees on disk)")
print()

lanerows = [r for r in rows if r["kind"] == "auftrag"]
if lanerows:
    # By FILE, not by group: grouping transitively on a file every row touches collapses the whole
    # queue into one component and answers nothing. server.ts is the measured case — it is named by
    # most rows, which makes it a fact about the codebase, not a schedule.
    byfile = {}
    for r in lanerows:
        for f in r["surface"]:
            byfile.setdefault(f, []).append(r["id"])
    origins = {r["id"]: r["origin"] for r in lanerows}
    contended = sorted(((f, ids) for f, ids in byfile.items() if len(ids) > 1),
                       key=lambda x: (-len(x[1]), x[0]))
    if contended:
        n = len(lanerows)
        for f, ids in contended:
            tag = "[bestätigt/mechanisch]" if all(origins[i] == "confirmed" for i in ids) else "[abgeleitet]"
            broad = " ← named by most rows, weak evidence" if len(ids) * 2 > n else ""
            print(f"  {len(ids)}× {f:<42} {tag} {' '.join(sorted(ids))}{broad}")
    else:
        print("  no file is named by two open auftrag rows")
    blind = sorted(r["id"] for r in lanerows if not r["surface"])
    if blind:
        print(f"  UNBEKANNT vs everything: {' '.join(blind)} — named no resolvable file.")
        print("            `files` missing ⇒ collision is unknown, never 'no' (briefs/work-register.md §4).")
    # A second graph stood here until 2026-09-10 — [modell], the queue analyst's own `collides`,
    # which judged the WORK rather than the filenames and was worth printing precisely where it
    # disagreed with the file listing above. It retired with the analyst; no model edge is drawn
    # anywhere in this fleet now, and the file listing is the whole answer.
    print()
    for r in lanerows:
        for br, fs in occupied.items():
            hit = set(r["surface"]) & set(fs)
            if hit:
                print(f"  BUSY {r['id']} overlaps live lane {br} on {' '.join(sorted(hit))}")

# ── 3. briefs ───────────────────────────────────────────────────────────────────────────────────
print()
print("=== 3. briefs/ — UNGEPRÜFT (no reliable 'has this landed' test is known) ===")
print("  The obvious test is DISPROVEN in both directions. phantom-park.md's work landed as 035c1a9")
print("  with no commit naming the file; its counter now reads 1 only because adcd4ee wrote that")
print("  fact down. The column counts PROSE ABOUT a brief. It is printed as a pointer to read, never")
print("  as a verdict — which is why every verdict below is the literal word ungeprüft.")
print()
briefs = sorted(sh("git ls-files briefs/").split())
for b in briefs:
    name = b.split("/", 1)[1]
    added = sh(f"git log --diff-filter=A --format=%ad --date=short -1 -- {b}").strip() or "?"
    last = sh(f"git log --format=%ad --date=short -1 -- {b}").strip() or "?"
    hits = len([l for l in sh(f"git log --format=%H --grep={name!r} --fixed-strings").split() if l])
    openrow = ""
    if rows:
        ref = [r["id"] for r in rows if name in (r["text"] or "")]
        if ref:
            openrow = f"  open row: {' '.join(ref)}"
    print(f"  ungeprüft  {name:<44} added {added}  touched {last}  named-in-commits {hits}{openrow}")
print(f"  {len(briefs)} briefs. Deciding these is READING work, not a script's job (register §6).")

# ── 4. docs with open markers ───────────────────────────────────────────────────────────────────
print()
print("=== 4. docs/*.md lines carrying an open marker ===")
MARK = re.compile(r"\b(offen|ungebaut|unbuilt|TODO|unbeantwortet|ungeprüft|noch nicht gebaut)\b", re.I)
hits = 0
for p in sorted(Path("docs").glob("*.md")):
    for n, line in enumerate(p.read_text(encoding="utf8").splitlines(), 1):
        if MARK.search(line):
            hits += 1
            print(f"  {p}:{n}  {clip(line, 96)}")
print(f"  {hits} line(s). A marker is a CLAIM; e2e/pins.ts checks the checkable subset of them.")
print("  Scanned: docs/*.md only. docs/attic/ is history and is deliberately left out — a marker")
print("  there is a record of what somebody thought in July, not a claim on today's tree. That is")
print("  where BACKLOG.md went on 2026-08-07 (docs/attic/backlog-2026-07.md), reconciled line by")
print("  line first, so this section no longer has a 1200-line July register standing beside it.")

# ── 5. index drift ──────────────────────────────────────────────────────────────────────────────
print()
print("=== 5. docs/README.md — index drift ===")
idx = Path("docs/README.md").read_text(encoding="utf8")
named = set(re.findall(r"`([a-z0-9-]+\.md)`", idx))
ondisk = {p.name for p in Path("docs").glob("*.md")} - {"README.md"}
broken = sorted(f for f in named if not (Path("docs") / f).exists())
unlisted = sorted(ondisk - named)
print(f"  {len(named)} pointer(s) in the index, {len(ondisk)} doc(s) on disk")
print(f"  broken pointers: {' '.join(broken) if broken else 'none'}   (pinned in e2e/pins.ts — a red gate)")
print(f"  not in the index: {' '.join(unlisted) if unlisted else 'none'}")
print("  The second list is NOT pinned: the index names twelve OPERATIVE docs on purpose, so an")
print("  unlisted doc is a decision to make (index it, or attic it), not a defect to fail on.")

print()
print("Read with ./state.sh (the machine) — this script is the work, that one is the state.")
PY


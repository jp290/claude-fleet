#!/usr/bin/env python3
# K1 (docs/plan-fleet-betrieb-2026-09-13.md §4): Kontext einer claude-Lane bei ihrer ERSTEN Aenderung,
# vor und nach einem Stichtag (Deploy von bdc9acdd, Quellpaket im Lane-Brief). Vorher und nachher
# laufen durch DIESELBE Definition — nur so ist der Vergleich eine Messung.
#
#   python3 docs/messungen/k1-kontext-erste-aenderung.py --since 2026-09-13T21:00 [--days 14] [--rows]
#
# Definitionen (Heuristik, ausdruecklich):
#   Lane      = ein Transkript-Verzeichnis ~/.claude/projects/*-claude-fleet-worktrees-fleet-*/ (alle
#               .jsonl nach Zeit), Start = erster Zeitstempel.
#   Kontext   = input_tokens + cache_read_input_tokens + cache_creation_input_tokens der Assistant-
#               Nachricht, die die erste Aenderung ausloest.
#   Aenderung = Tool Edit/Write/MultiEdit/NotebookEdit, oder Bash mit schreibendem Muster (WRITE_BASH).
#   Quellpaket= die erste User-Nachricht enthaelt "Quellpaket — exakte Ausschnitte" (geliefert) bzw.
#               "Quellpaket — kein Ausschnitt" (genannt, nicht geliefert).
# Gibt nur Zahlen und Verzeichnis-Suffixe aus, nie Kommandos oder Brieftext.
import argparse, datetime as dt, glob, json, os, re, statistics

WRITE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
WRITE_BASH = re.compile(r"\bsed\s+-i|\bperl\s+-p?i|apply_patch|\bgit\s+(commit|apply|mv|rm)\b|"
                        r"\bcat\s*>|\btee\s|>>?\s*[\w./-]+\.(ts|md|sh|json|js|py|txt|html|css)\b|"
                        r"write_text\(|open\([^)]*['\"][wa]['\"]")

def ts(s):
    return dt.datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None

def lane(d):
    recs = []
    for f in glob.glob(os.path.join(d, "*.jsonl")):
        with open(f, errors="replace") as fh:
            for line in fh:
                try: recs.append(json.loads(line))
                except ValueError: pass
    recs = [r for r in recs if r.get("timestamp")]
    if not recs: return None
    recs.sort(key=lambda r: r["timestamp"])
    out = {"lane": os.path.basename(d).split("worktrees-")[-1], "start": ts(recs[0]["timestamp"]),
           "pack": "none", "model": None, "ctx": None, "bash_before": 0, "reads_before": 0}
    first_user = next((r for r in recs if r.get("type") == "user"), None)
    if first_user:
        body = json.dumps(first_user.get("message", {}), ensure_ascii=False)
        out["pack"] = "delivered" if "Quellpaket — exakte Ausschnitte" in body else \
                      "named-only" if "Quellpaket — kein Ausschnitt" in body else "none"
    for r in recs:
        m = r.get("message") or {}
        if r.get("type") != "assistant" or not isinstance(m.get("content"), list): continue
        out["model"] = out["model"] or m.get("model")
        for c in m["content"]:
            if c.get("type") != "tool_use": continue
            name, inp = c.get("name"), c.get("input") or {}
            if name in WRITE_TOOLS or (name == "Bash" and WRITE_BASH.search(str(inp.get("command", "")))):
                u = m.get("usage") or {}
                out["ctx"] = sum(int(u.get(k) or 0) for k in
                                 ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
                return out
            if name == "Bash": out["bash_before"] += 1
            if name in ("Read", "Grep", "Glob"): out["reads_before"] += 1
    return out  # nie geaendert: ctx bleibt None

def summary(label, rows):
    hit = [r for r in rows if r["ctx"]]
    if not hit:
        print(f"{label}: n=0 (von {len(rows)} Lanes ohne Aenderung)"); return
    c = sorted(r["ctx"] for r in hit)
    p90 = c[min(len(c) - 1, int(len(c) * 0.9))]
    print(f"{label}: n={len(hit)} (ohne Aenderung {len(rows) - len(hit)}) · Kontext p50 {statistics.median(c) / 1000:.0f} k"
          f" p90 {p90 / 1000:.0f} k · Bash davor p50 {statistics.median(r['bash_before'] for r in hit):.0f}"
          f" · Read/Grep davor p50 {statistics.median(r['reads_before'] for r in hit):.0f}")

ap = argparse.ArgumentParser()
ap.add_argument("--since", required=True, help="Stichtag ISO, lokale Zeit, z. B. 2026-09-13T21:00")
ap.add_argument("--days", type=int, default=14)
ap.add_argument("--rows", action="store_true")
a = ap.parse_args()
since = dt.datetime.fromisoformat(a.since).astimezone()
floor = since - dt.timedelta(days=a.days)
dirs = glob.glob(os.path.expanduser("~/.claude/projects/-Users-*-claude-fleet-worktrees-fleet-*"))
rows = [x for x in (lane(d) for d in dirs) if x and x["start"] >= floor]
before = [r for r in rows if r["start"] < since]
after = [r for r in rows if r["start"] >= since]
summary(f"VORHER ({a.days} d vor Stichtag)", before)
summary("NACHHER (ab Stichtag)", after)
summary("NACHHER, Quellpaket geliefert", [r for r in after if r["pack"] == "delivered"])
summary("NACHHER, ohne gelieferten Ausschnitt", [r for r in after if r["pack"] != "delivered"])
if a.rows:
    for r in sorted(rows, key=lambda r: r["start"]):
        print(r["start"].strftime("%m-%d %H:%M"), r["lane"], (r["model"] or "?")[:18], r["pack"],
              f"{(r['ctx'] or 0) / 1000:.0f}k" if r["ctx"] else "-", r["bash_before"], r["reads_before"])

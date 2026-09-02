#!/usr/bin/env python3
"""zeitbudget.py — Suite-Mutex-Zeitbudget der Generalsanierung seit 2026-08-31 00:00 Europe/Berlin.

READ-ONLY. Aufruf aus dem Haupt-Checkout:  python3 zeitbudget.py [--repo /Users/owner/claude-fleet]

Quellen (alle gitignored, daher mit open()/subprocess, nie mit rg):
  post-land-audits.jsonl   Tier-2-Audits          (Felder: at startedAt ms repo main mainSha result cmd exitCode out covers checks reason remote)
  git notes --ref=fleet/land <sha>                (Felder: actor at branch mainBefore mainAfter verify{at startedAt ms waitMs ok exitCode proportional steps out ...})
  audit.jsonl              Ereignisse             (Felder: ts event slot detail)
  e2e-trail/*.jsonl        Check-Trail Host+Lanes (Felder: v run suite tree dirty check ok msSincePrev ts detail)
  $TMPDIR/fleet-e2e-trail/*.jsonl  Check-Trail der Audits
"""
import json, os, re, sys, glob, subprocess, datetime, collections
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Berlin")
REPO = "/Users/owner/claude-fleet"
for i, a in enumerate(sys.argv):
    if a == "--repo": REPO = sys.argv[i+1]
CUT = datetime.datetime(2026, 8, 31, 0, 0, tzinfo=TZ).timestamp() * 1000
DAYS = ["2026-08-31", "2026-09-01", "2026-09-02"]

def day(ms):   return datetime.datetime.fromtimestamp(ms/1000, TZ).strftime("%Y-%m-%d")
def hhmm(ms):  return datetime.datetime.fromtimestamp(ms/1000, TZ).strftime("%m-%d %H:%M:%S")
def jl(p):
    out = []
    with open(p) as f:
        for l in f:
            l = l.strip()
            if l:
                try: out.append(json.loads(l))
                except json.JSONDecodeError: pass
    return out

# ---------------------------------------------------------------- 1. Trail-Index
RUNID = re.compile(r'^(.+)-(\d{8}T\d{6}Z)-(\d+)\.jsonl$')
def scan_trail(d):
    runs = []
    for p in sorted(glob.glob(os.path.join(d, "*.jsonl"))):
        m = RUNID.match(os.path.basename(p))
        if not m: continue
        stamp = datetime.datetime.strptime(m.group(2), "%Y%m%dT%H%M%SZ").replace(tzinfo=datetime.timezone.utc)
        t0 = stamp.timestamp() * 1000
        if t0 < CUT: continue
        ts, nfail, n, tree, dirty = [], 0, 0, None, None
        for o in jl(p):
            n += 1; ts.append(o["ts"])
            if tree is None: tree = o.get("tree"); dirty = o.get("dirty")
            if o.get("ok") is False: nfail += 1
        runs.append(dict(path=p, base=os.path.basename(p), suite=m.group(1), pid=m.group(3),
                         runid=os.path.basename(p)[:-6], idms=t0,
                         first=min(ts) if ts else None, last=max(ts) if ts else None,
                         span=(max(ts)-min(ts)) if ts else 0, n=n, fail=nfail, tree=tree, dirty=dirty))
    return runs

HOST_TRAIL  = scan_trail(os.path.join(REPO, "e2e-trail"))
AUDIT_TRAIL = scan_trail(os.path.join(os.environ.get("TMPDIR", "/tmp"), "fleet-e2e-trail"))

# ---------------------------------------------------------------- 2. Audits
AUD = [r for r in jl(os.path.join(REPO, "post-land-audits.jsonl")) if r["at"] >= CUT]
def audit_cat(r):
    if r["result"] == "green": return "audit_green"
    if r["result"] == "red":   return "audit_red"
    if r["ms"] >= 1_700_000:   return "audit_unknown_wall"
    return "audit_unknown_never"
for r in AUD:
    r["_cat"] = audit_cat(r)
    r["_remote"] = bool(r.get("remote"))
    # Lock-Wartezeit: die run-id des Audit-Trails wird NACH dem Lock-Erwerb + Staging vergeben.
    m = [t for t in AUDIT_TRAIL if r["startedAt"] <= t["idms"] <= r["at"]]
    r["_trail"] = m[0] if m else None
    r["_lockwait_ms"] = (m[0]["idms"] - r["startedAt"]) if m else None
    # Mutex-HALTEN: erst ab Lock-Erwerb. Kein Trail => nie erworben (oder remote) => 0.
    r["_hold_ms"] = (r["at"] - m[0]["idms"]) if m else 0

# ---------------------------------------------------------------- 3. Land-Gate (git notes)
def land_notes():
    p = subprocess.run(["git", "-C", REPO, "log", "--since=2026-08-31T00:00:00+02:00", "--format=%H", "main"],
                       capture_output=True, text=True)
    out = []
    for sha in p.stdout.split():
        q = subprocess.run(["git", "-C", REPO, "notes", "--ref=fleet/land", "show", sha],
                           capture_output=True, text=True)
        if q.returncode != 0: continue
        try: o = json.loads(q.stdout)
        except json.JSONDecodeError: continue
        v = o.get("verify") or {}
        if not v.get("startedAt"): continue
        out.append(dict(sha=sha, at=o.get("at") or v.get("at"), startedAt=v["startedAt"],
                        ms=v.get("ms") or 0, waitMs=v.get("waitMs") or 0, ok=v.get("ok"),
                        proportional=v.get("proportional"), steps=v.get("steps") or [],
                        waitedOut=v.get("waitedOut"), branch=o.get("branch")))
    return sorted(out, key=lambda x: x["startedAt"])
LAND = land_notes()
for L in LAND:
    L["_work_ms"] = max(0, L["ms"] - L["waitMs"])          # Arbeit = Gesamt minus Schlangenzeit
    # welche Suite-Wrapper liefen in diesem Gate-Fenster (die drei am Ende der Kette halten den Mutex)
    L["_suites"] = [t for t in HOST_TRAIL
                    if t["suite"] in ("clean-review", "security", "claude-gate")
                    and L["startedAt"] <= t["idms"] <= L["at"] + 5000]
    L["_suite_span_ms"] = sum(t["span"] for t in L["_suites"])

GATE_SUITE_PATHS = {t["path"] for L in LAND for t in L["_suites"]}

# ---------------------------------------------------------------- 4. Host-Laeufe ausserhalb der Gates
PREVIEW  = [t for t in HOST_TRAIL if t["suite"] == "isolated"]            # ./e2e-isolated.sh, Host/Lane
POSTLAND = [t for t in HOST_TRAIL if t["suite"] == "postland-audit"]      # ./e2e-postland-audit.sh
LANEGATE = [t for t in HOST_TRAIL if t["suite"] in ("clean-review", "security", "claude-gate")
            and t["path"] not in GATE_SUITE_PATHS]                       # Gate-Kette ohne Server-Land dahinter

# Reruns = Vorschaulaeufe, deren run-id in einer Adjudikation von audit.jsonl zitiert wird
EV = [o for o in jl(os.path.join(REPO, "audit.jsonl")) if o["ts"] >= CUT]
ADJ_TEXT = " ".join(json.dumps(o.get("detail")) for o in EV if o["event"] == "postland_audit")
for t in PREVIEW + AUDIT_TRAIL:
    t["_cited"] = t["runid"] in ADJ_TEXT

ORPHAN_AUDIT_TRAIL = [t for t in AUDIT_TRAIL if not any(r["_trail"] is t for r in AUD)]

# ---------------------------------------------------------------- 5. Tabelle
CATS = ["Gate-Arbeit", "Gate-Warten", "Audit gruen", "Audit rot", "Audit unknown-Wand",
        "Audit unknown-nie-gelaufen", "Reruns/Beweislaeufe", "Vorschau in Lanes"]
cell = {(d, c): [0.0, 0] for d in DAYS for c in CATS}
def add(d, c, ms, n=1):
    if d in DAYS: cell[(d, c)][0] += ms / 60000.0; cell[(d, c)][1] += n

for L in LAND:
    add(day(L["startedAt"]), "Gate-Arbeit", L["_work_ms"])
    add(day(L["startedAt"]), "Gate-Warten", L["waitMs"])
NAME = {"audit_green": "Audit gruen", "audit_red": "Audit rot",
        "audit_unknown_wall": "Audit unknown-Wand", "audit_unknown_never": "Audit unknown-nie-gelaufen"}
for r in AUD:
    add(day(r["startedAt"]), NAME[r["_cat"]], r["_hold_ms"])
for t in PREVIEW:
    add(day(t["idms"]), "Reruns/Beweislaeufe" if t["_cited"] else "Vorschau in Lanes", t["span"])
for t in ORPHAN_AUDIT_TRAIL:
    add(day(t["idms"]), "Reruns/Beweislaeufe" if t["_cited"] else "Vorschau in Lanes", t["span"])

def table():
    w = 30
    hdr = "| Kategorie".ljust(w) + "".join(f"| {d} ".ljust(22) for d in DAYS) + "|"
    print(hdr); print("|" + "-"*(w-1) + ("|" + "-"*21)*3 + "|")
    for c in CATS:
        row = f"| {c}".ljust(w)
        for d in DAYS:
            mn, n = cell[(d, c)]
            row += f"| {mn:8.1f} min ({n:2d}) ".ljust(22)
        print(row + "|")
    print("|" + "-"*(w-1) + ("|" + "-"*21)*3 + "|")
    for label, keys in [("SUMME Mutex (ohne Warten)", [c for c in CATS if c != "Gate-Warten"]),
                        ("davon rot+unknown+Rerun", ["Audit rot", "Audit unknown-Wand",
                                                     "Audit unknown-nie-gelaufen", "Reruns/Beweislaeufe"])]:
        row = f"| {label}".ljust(w)
        for d in DAYS:
            mn = sum(cell[(d, k)][0] for k in keys)
            tot = sum(cell[(d, k)][0] for k in CATS if k != "Gate-Warten")
            row += (f"| {mn:8.1f} min ".ljust(22) if label.startswith("SUMME")
                    else f"| {mn:7.1f} = {100*mn/tot if tot else 0:4.1f}% ".ljust(22))
        print(row + "|")

if __name__ == "__main__":
    print("=== TABELLE (Minuten, Anzahl) ===\n"); table()
    print("\n=== AUDITS ===")
    for r in AUD:
        print(f"{hhmm(r['at'])} start={hhmm(r['startedAt'])[6:]} {r['ms']/60000:6.1f}m {r['result']:<7} "
              f"{'REMOTE:'+r['remote']['name'] if r['_remote'] else 'lokal ':<16} repo={os.path.basename(r['repo']):<12} "
              f"lockwait={('%.0fs'%(r['_lockwait_ms']/1000)) if r['_lockwait_ms'] is not None else '  n/a':>7} "
              f"hold={r['_hold_ms']/60000:5.1f}m checks={r.get('checks')} exit={r['exitCode']} {r.get('reason','')[:50]}")
    print("\n=== LAND-GATES ===")
    for L in LAND:
        print(f"{hhmm(L['startedAt'])} {L['sha'][:8]} ms={L['ms']/60000:6.1f}m wait={L['waitMs']/60000:6.1f}m "
              f"work={L['_work_ms']/60000:5.1f}m suiteSpan={L['_suite_span_ms']/60000:5.1f}m "
              f"ok={L['ok']} waitedOut={L['waitedOut']} prop={L['proportional']} steps={len(L['steps'])} n_suites={len(L['_suites'])}")
    print("\n=== HOST-VORSCHAU/RERUN (e2e-trail/isolated-*) ===")
    print(f"\n=== ZWEITE SICHT: Audit-Zeilen je Tag nach Repo/Ort (Zaehlung, deklarierte ms, Mutex-Hold) ===")
    import collections as _c
    g=_c.defaultdict(lambda:[0,0.0,0.0])
    for r in AUD:
        k=(day(r["startedAt"]), os.path.basename(r["repo"]), "remote" if r["_remote"] else "lokal", r["_cat"])
        g[k][0]+=1; g[k][1]+=r["ms"]/60000; g[k][2]+=r["_hold_ms"]/60000
    for k in sorted(g): print(f"  {k[0]} {k[1]:<12} {k[2]:<6} {k[3]:<26} n={g[k][0]:2d} ms={g[k][1]:7.1f}m hold={g[k][2]:7.1f}m")
    print("\n=== SUITE-LAUFZEIT-DRIFT (lokale claude-fleet Audits mit Trail) ===")
    for r in AUD:
        if r["_trail"] and not r["_remote"] and "claude-fleet" in r["repo"]:
            t=r["_trail"]; ch=(r.get("checks") or {}).get("ran") or t["n"]
            print(f"  {hhmm(r['startedAt'])} hold={r['_hold_ms']/60000:5.1f}m checks={ch:<5} ms/check={r['_hold_ms']/ch:6.0f} result={r['result']}")
    for t in PREVIEW:
        print(f"{hhmm(t['idms'])} {t['runid']:<34} span={t['span']/60000:5.1f}m n={t['n']:<5} fail={t['fail']:<3} "
              f"tree={(t['tree'] or 'null')[:8]} dirty={t['dirty']} cited={t['_cited']}")
    print("\n=== ORPHAN AUDIT-TRAIL ($TMPDIR, keine Audit-Zeile) ===")
    for t in ORPHAN_AUDIT_TRAIL:
        print(f"{hhmm(t['idms'])} {t['runid']} span={t['span']/60000:.1f}m n={t['n']} fail={t['fail']} cited={t['_cited']}")
    print("\n=== LANE-GATE-KETTEN ausserhalb eines Server-Lands (clean-review/security/claude-gate) ===")
    bd = collections.Counter(); bs = collections.Counter()
    for t in LANEGATE:
        bd[day(t["idms"])] += 1; bs[day(t["idms"])] += t["span"]
    for d in DAYS: print(f"  {d}: {bd[d]:3d} Wrapper-Laeufe, Trail-Spanne zusammen {bs[d]/60000:6.1f} min")
    print("\n=== ./e2e-postland-audit.sh (eigener Wrapper) ===")
    for t in POSTLAND: print(f"  {hhmm(t['idms'])} {t['runid']} span={t['span']/60000:.1f}m n={t['n']} fail={t['fail']}")

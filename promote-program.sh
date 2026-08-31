#!/bin/sh
# Ein vorgeschlagenes Programm ansehen und (mit --go) bestaetigen + aktivieren.
# Es gibt dafuer keinen Board-Knopf: der Client ruft /api/programs nirgends auf.
#   ./promote-program.sh                 -> listet alle proposed Programme
#   ./promote-program.sh <id>            -> zeigt den vollen Inhalt EINES Programms
#   ./promote-program.sh <id> --go       -> confirm + activate
cd "$(dirname "$0")" || exit 1
exec python3 - "$@" <<'PY'
import json, sys, urllib.request
S=json.load(open('fleet.json')); TOK=S['token']
# Host/Port kommen aus der gitignorierten .env — dieses Repo ist public, hier steht keine echte IP.
env={}
try:
    for line in open('.env'):
        line=line.strip()
        if line and not line.startswith('#') and '=' in line:
            k,v=line.split('=',1); env[k]=v.strip().strip('"').strip("'")
except FileNotFoundError: pass
BASE="http://%s:%s" % (env.get("FLEET_HOST","127.0.0.1"), env.get("FLEET_PORT","8790"))
def call(path, body):
    r=urllib.request.Request(BASE+path, data=json.dumps(body).encode(),
        headers={"authorization":f"Bearer {TOK}","content-type":"application/json"})
    try: return json.load(urllib.request.urlopen(r,timeout=30)), None
    except urllib.error.HTTPError as e: return None, f"HTTP {e.code} {e.read().decode()[:200]}"
progs=S.get('programs',[])
args=[a for a in sys.argv[1:] if not a.startswith('--')]
go='--go' in sys.argv
if not args:
    print("Vorgeschlagene Programme:\n")
    for p in progs:
        if p.get('status')=='proposed':
            print(f"  {p['id']}\n    {p.get('title')}\n")
    print("Inhalt ansehen:  ./promote-program.sh <id>")
    print("Freigeben:       ./promote-program.sh <id> --go")
    sys.exit(0)
pid=args[0]
match=[p for p in progs if p['id'].startswith(pid)]
if len(match)!=1: print(f"{len(match)} Treffer fuer {pid!r} — id genauer angeben"); sys.exit(1)
p=match[0]
FIELDS=("title","intent","successCriterion","nonGoals","decisions","evidence","openQuestions")
if not go:
    print(f"id:     {p['id']}\nstatus: {p.get('status')}\n")
    for f in FIELDS:
        v=p.get(f)
        print(f"── {f} ──")
        if isinstance(v,list):
            for i in v: print(f"  · {i}")
        else: print(f"  {v}")
        print()
    print("Freigeben mit:  ./promote-program.sh %s --go" % p['id'][:8]); sys.exit(0)
if p.get('status')!='proposed':
    print(f"status ist {p.get('status')} — nur 'proposed' kann bestaetigt werden"); sys.exit(1)
content={f:p.get(f) for f in FIELDS}
r,e=call(f"/api/programs/{p['id']}/confirm", content)
print("confirm :", e or f"ok status={r.get('program',{}).get('status')}")
if e: sys.exit(1)
r,e=call(f"/api/programs/{p['id']}/activate", {})
print("activate:", e or f"ok status={r.get('program',{}).get('status')}")
if not e: print("\nAKTIV. Sag mir Bescheid, dann bootstrappe ich die MAIN.")
PY

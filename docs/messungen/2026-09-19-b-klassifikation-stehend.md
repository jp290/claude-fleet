---
frage: Laesst sich die ertragreichste Kennzahl der Bash-Datenschichten-Analyse — der Roh-Anteil der Ledger-Lesungen, heute 91,9 % — ohne Worktrail-Lauf als stehender Sensor fahren, und lohnt der Klassifikator, der die a/b/c-Handkorrekturen in measure.py ersetzen und die Stichprobe von 1.204 auf 47.877 Aufrufe heben soll, seinen Bau?
urteil: Der H1-Sensor ist gebaut und fuhr ohne Worktrail-Lauf: fuenf Ledger mit Leseroute, rollierende 14 Tage, je Ledger roh gegen Route, heute 93,8 % roh (1.339 zu 88 in 43.403 Aufrufen) gegen 91,9 % im eingefrorenen Baseline-Fenster — rein deterministisch, ohne Modell, ohne Stichprobe, das Kommando steht in §5. Der Klassifikator (H2) ist geschnitten, nicht gebaut: er muesste 14.226 Kandidaten je 14 Tage sehen (32,8 % der Population, Kosten im Rauschen von 0,08 bis rund 10 $ je Durchgang), aber die deterministische Sonde traegt nur 42,2 % seiner Labels ganz (0 und c, 176 von 417); die uebrigen 57,8 % (a/b) traege sie nur in der Existenzhaelfte, und genau die Intent-Haelfte ist der Grund, warum die Jev-Entscheidungsvorlage die Bash-Vollerhebung (K9) als einzigen Korpus verworfen hat. Die Ader H1+H2 ist damit abgebaut: H1 ist kein neuer Schnitt, sondern das Messinstrument dafuer, dass die Tueren P1/P3 wirken; H2 findet keinen Posten, den P1/P2/P3 und die u-Posten nicht schon benannt haetten.
bereich: [datenlayer, worktrail, klassifikator, sensoren, bash]
belege: [docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §6 §9, docs/messungen/2026-09-18-jev-entscheidungsvorlage-astra.md §1 K9 §5, docs/messungen/2026-09-18-jev-fuer-den-fleet-auswertung.md V:159, docs/messungen/2026-09-14-karten-modell-ab.md, server.ts#CARD_MODEL, docs/queue-analyst.md, card-extract.ts#validateCard]
nicht-gemessen: Rueckrufquote des mechanischen Vorfilters (ein als N getaggter Datenaufruf erreicht den Klassifikator nie — in der Stichprobe ungezaehlt, hier U); sonnet-5-Einheitspreise je Mio Token (im Repo nur der end-to-end gemessene Kartenlauf 0,0235 $); Codex- und Pi-Transkripte; Browser-Leser der Routen; ob die Intent-Taxonomie a/b in einer Doppelblindprobe haelt (K9-Kippmessung, nicht gefahren); Wirkung der Tueren P1/P3 auf die Quote (beide noch nicht gelandet).
stand: 2026-09-19
---

# Die (b)-Klassifikation stehend machen: H1-Sensor gebaut, H2-Klassifikator geschnitten

2026-09-19, Lane `fleet/260919013339-c200`. Ersetzt die archivierten Zeilen c25c3779/eace675f und
davor b0279bc6 (die Jev-Auswertung zitiert genau diese H2-Fassung als Punkt 9 mit 0,60 $-Rechnung).
**Was diese Notiz nicht wiederholt:** der strategische Lauf 2
(`docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md`, im Folgenden **B17**) hat
die (b)-Ader einmal abgebaut und daraus P1/P2/P3 geschnitten — gefilet als b1575ffe (Tueren, LAEUFT),
2cf40772 (Auftrags-Dossier), 2f147b22 (ctl audits). Die Jev-Entscheidungsvorlage
(`2026-09-18-jev-entscheidungsvorlage-astra.md`, im Folgenden **JEV**) hat die Klassifikator-Frage
als K9 verhandelt und verworfen. Diese Notiz rechnet beides mit Zahlen durch und zieht die Linie.

## 1. H1 — der stehende Sensor (gebaut, durch diese Notiz)

**Kennzahl (aus B17 §6, unverändert):** Roh-Anteil der Ledger-Lesungen je Ledger =
Roh-Lesungen / (Roh-Lesungen + Routen-Lesungen), ueber die fuenf Ledger mit eigener GET-Route.
Roh-Lesung = Bash-Aufruf, der die Datei mit `open(`, `tail`, `head`, `cat`, `grep`, `wc` oder `jq`
anfasst, Inventur-Aufrufe (≥ 5 Ledger oder `*.jsonl`) ausgenommen; Routen-Lesung = Bash-Aufruf mit
`curl` auf genau diese Route. Mechanisch, ohne Urteil, ohne Modell.

| Ledger | Route | roh | Route | Roh-Anteil | Methode je Zeile |
|---|---|---:|---:|---:|---|
| `audit.jsonl` | `/api/audit` | 278 | 0 | 100 % | roh: Lesekommandos auf die Datei, mit Lookbehind-Grenze, damit `audit-adjudications.jsonl` nicht mitzaehlt; route: `curl` genau auf `/api/audit` |
| `lane-outcomes.jsonl` | `/api/lane-outcomes` | 276 | 0 | 100 % | roh wie oben ohne Grenze; route: `curl` genau auf die Route |
| `context-receipts.jsonl` | `/api/context-receipts` | 21 | 0 | 100 % | roh wie oben; route: `curl` genau auf die Route |
| `post-land-audits.jsonl` | `/api/post-land-audits` | 685 | 10 | 98,6 % | roh wie oben; route: `curl` genau auf die Route, die Artefakt-Route (`/artifact`) zählt nicht |
| `deploys.jsonl` | `/api/deploys` | 79 | 78 | 50,3 % | roh wie oben; route: `curl` genau auf die Route |
| **Summe** | | **1.339** | **88** | **93,8 %** | Inventur-Aufrufe (≥ 5 Ledger, `*.jsonl`) in keiner Zeile gezaehlt |

Fenster: 2026-09-05T01:44Z bis 2026-09-19T01:44Z (rollierend 14 Tage), 43.403 Bash-Aufrufe in 417
Sessions ueber 1.403 Transkript-Dateien. Baseline im eingefrorenen Fenster 03.09.–17.09. 07:28Z
(B17 §6): 1.480 zu 131 = **91,9 %** — `post-land-audits` 97,0 %, `lane-outcomes`/`audit`/
`context-receipts` je 100 %, `deploys` 44,8 %. Die zwei Messungen sind der Groessenordnung nach
vergleichbar (Fenster um zwei Tage verschoben), nicht zeilengleich; ein Tueren-Effekt ist in der
heutigen Lesung nicht erwartet und nicht sichtbar, denn P1/P3 sind noch nicht gelandet.

**Ohne Worktrail-Lauf berechenbar: ja, fuer alle fuenf Zeilen.** Der Beweis ist der heutige Lauf:
keine Stichprobenziehung, keine Klassifikation, keine Handkorrektur, kein Modellaufruf — nur eine
Transkript-Lesung des Hosts. Die Rolle-Spalte der Ausgabe stratifiziert gegen den naheliegenden
Groessen-Proxy (rework3d-Muster aus Worktrail V §1): die Quote kann steigen, weil Lanes wachsen,
nicht weil Tueren fallen; deshalb meldet der Sensor je Rolle mit (`lane/orch/main/other`).

**Kommando:** das Skript steht wortlich in §5.1; es nach einem beliebigen Scratch-Pfad legen und
`python3 h1_sensor.py` laufen lassen — es schreibt nur nach stdout, fuehrt kein Kommando aus und
liest keine Token. Ausloeser: (a) nach jedem Land von P1 (b1575ffe) oder P3 (2f147b22) — eine
fallende Quote ist der Beweis, dass die Tuer wirkt, `deploys.jsonl` ist das bestehende
Gegenbeispiel; (b) vor jedem kuenftigen Worktrail-Lauf als Grundlinie; (c) sonst bei Bedarf, es
kostet Sekunden und nichts.

## 2. H2 — die Kosten-/Nutzenrechnung des Klassifikators

**Auftrag an den Klassifikator (B17 §9.1, Zeile 422):** die 156 Handkorrekturen ersetzen, damit
a/b/c ueber die volle Population laufen kann statt ueber die 9-Sessions-Stichprobe. Vertrag wie
`card-extract.ts` (Form, nie Tatsache): das Label ist ein KANDIDAT, Befund wird es erst durch die
deterministische Sonde aus H1 (existiert fuer diesen Zugriff eine Leseroute — ja/nein); das Modell
ist ein env-Knopf in der Bauart von `FLEET_CARD_MODEL` (`server.ts#CARD_MODEL`, heute
`claude-sonnet-5`).

**Wie viele Aufrufe muss er sehen?** Gemessen mit den Tag-Regeln aus B17 §9.1 (wortlich, ohne
Korrekturen) ueber die volle rollierende Population: **14.226 von 43.403 Aufrufen = 32,8 %**.
Der Rest ist mechanisch N (SRC 13.002, ACT 8.733, BUILD 3.248, GIT 2.459, HOST 1.735). Das sind
1.016 Kandidaten je Tag, 34,1 je Bash-Session. In der Stichprobe waren 463 von 1.204 (38,5 %)
Kandidaten — der Unterschied ist rollengewichtet: die Stichprobe uebersieht Orchestrator/MAIN
(57 %/42 % Datenfragen) gegen Lanes (5 %). Basiszahl 47.877 (B17-Fenster) skaliert auf rund 15.700
Kandidaten; die stabile Groesse ist der Anteil, nicht die Absolutzahl.

**Was kostet das?** Kommandobytes der Kandidaten: 6,55 MB, Median 354 B, p90 873 B — als
B/4-Proxy-Token (Repo-Konvention, T17) rund **1,8 Mio Token je 14-Tage-Durchgang** inkl.
Batch-Overhead. Dollar-Anker: beim im Repo zitierten Anbieter-Tarif (0,042 $/Mio, JEV §4) rund
**0,08 $ je Durchgang**; fuer `claude-sonnet-5` existiert kein $/Mio-Tarif im Repo — gemessen ist
nur der end-to-end Kartenlauf mit 0,0235 $ (5,07 $ je 216, Karten-A/B), unter Listenpreis-Ordnung
(Annahme, nicht im Repo gemessen: 3/15 $ je Mio) grob **5–10 $ je Durchgang**. Beide Groessen sind
Rauschen gegen eine Lane-Stunde — die Kosten tragen den Schnitt in keine Richtung. Das entspricht
JEV: „Billige Inferenz macht das Experiment billig, sobald gute Labels ohnehin vorliegen. Hier
liegen sie nicht vor."

**Welche Genauigkeit reicht — und was faengt die Sonde ab?** Aus der Stichprobe (B17 §4.1):
417 Daten-Labels, davon 0 = 134, a = 95, b = 146, c = 42. Die Sonde (Routentabelle) traegt
**176 von 417 = 42,2 % ganz**: jedes 0-Label ist tagmechanisch, jedes c-Label durch Routen-Negation
pruefbar, und fuer die 241 a/b-Labels (57,8 %) prueft sie nur die Existenzhaelfte — dass die
beruehrte Schicht eine Route oder ein Skript hat. Die Intent-Haelfte (kannte der Agent die Schicht,
oder beantwortet sie die Frage nicht?) ist nicht mechanisch pruefbar. Genau dafuer gilt JEV K9
woertlich: „Vorhandene Taxonomie ist keine stabile Wahrheit; keine neu doppelt beschrifteten
Beispiele geliefert" — n = 0 gepaarte Intent-Labels. Reicht also eine niedrige Genauigkeit? Fuer
Schnitt-Entscheide ja: Familien-Summen sind mechanisch, ein a↔b-Vertauscher aendert die
Symptomsumme nicht, und die kleinste Lichte ueber/unter der Linie (AUDIT 55 gegen PANE 29, Faktor
1,9) vertraegt Intent-Fehler bis etwa 20 %. Aber genau diese Genauigkeit ist heute nicht MESSBAR,
weil es keinen Goldstandard dafuer gibt — die Kennzahl wuerde messen, wie der Klassifikator
labelt, nicht wie der Fleet arbeitet; das ist das rework3d-Muster in neuem Gewand (sieht aus wie
eine Eigenschaft, traegt einen unbekannten Fehlerboden). Der mechanische Vorfilter hat zudem eine
unbekannte Rueckruf-Luecke (U): ein als N getaggter Datenaufruf erreicht den Klassifikator nie —
B17 §8 nennt denselben Vorbehalt.

## 3. Die Schnittlinie

**Ueber der Linie (gebaut):**
- **H1-Standsensor** (§1 dieser Notiz): deterministisch, volle Population, ohne Modell; Kommando
  und Skript stehen hier; Ausloeser Tueren-Land und Worktrail-Grundlinie.

**Unter der Linie (nicht gebaut):**
- **Der a/b/c-Klassifikator ueber die volle Population — stehend UND als Lauf-2-Bestandteil.**
  Die Zahl, die den Schnitt traegt: **57,8 %** — der Anteil der Labels (241/417), den die Sonde
  nur in der Existenzhaelfte traegt und dessen Intent-Seite ohne Goldstandard einen unbekannten
  Fehlerboden hat; JEV hat genau diese Groesse als K9 auf Rang 11 verworfen („eine Vollerhebung
  falscher Labels praezisiert keine Wahrheit"), und der Shadow-Anfang, den Agent E in V:159
  empfohlen hat, ist von der Entscheidungsvorlage mit der Null-Option geschlagen worden.
- **Jede stehende Kennzahl, die a/b/c-Anteile der vollen Population meldet.** Sie haette die Form
  einer Eigenschaft und den Fehlerboden einer Groesse — abgelehnt wie `rework3d %`.

**Wiedereinreise-Bedingung (die Zahl, die die Linie verschiebt):** ein Lauf 2, der ansteht, UND
eine Doppelblindprobe der Intent-Taxonomie nach der in JEV §3.1 festgelegten Kippmessung (100
Episoden doppelt blind, ≤ 10 Streitfaelle). Dann ist der Shadow-Triage ueber die 14.226 Kandidaten
das billigere Instrument gegenueber dem Menschen, der heute je Stichprobenkampagne ~463 Kandidaten
liest — bis dahin ist die Kampagne das ehrliche Verfahren, und die Wiedereinreise-Regel der
u-Posten („wenn ein Lauf 2 sie wieder ueber 20 Aufrufe sieht", B17 §5) haengt ohnehin am Lauf, nicht
an einem stehenden Sensor.

## 4. Ader-Urteil: H1+H2 gegen P1/P2/P3

**Die Ader ist abgebaut** — mit einem gebauten Instrument und vier Belegen:

1. **H1 ist kein neuer Schnitt.** Er baut keine Tuer und findet kein Symptom; er ist das
   Messinstrument dafuer, dass P1/P3 wirken (B17 §6: „Er fällt, wenn P1 und P3 wirken, und er
   fällt nicht, wenn sie nur landen"). Ohne ihn waere die Tuer-Wirkung ungemessen — damit ist die
   Luecke geschlossen, aber es ist Messarbeit, kein neuer Auftrag.
2. **H2 findet keinen adressierbaren Posten, den die Stichprobe nicht schon benannt haette.**
   Alle Symptom-Familien von B17 §4.2 sind adressiert (P1/P2/P3, 184 von 283 Aufrufen), gefilet
   (u4 Schreib-Quittungen, c05f8b05), delegiert (u3 Quota, eigene Notiz) oder unter der Linie mit
   definierter Wiedereinreise-Regel (u1 Pane-Blick, u2 Deploy). Die seltene-teure Klasse (Echo
   einer Program-Mutation, bis 41.587 B) hat dieselbe Stichprobe ohne Klassifikator gefunden und
   gefilet — das Argument „die Stichprobe verliert seltene-teure Faelle" ist einmal empirisch
   widerlegt worden, naemlich von B17 §5b selbst.
3. **Die Skalierung von 1.204 auf 47.877 veraendert keine Entscheidung.** Die Linie von B17 ist an
   der Stichprobe geschnitten (40 Aufriufe je Familie); eine Vollerhebung wuerde dieselben Familien
   oberhalb skalieren und dieselben unterhalb — und der Entscheid, der sie braeuchte (Lauf 2), ist
   bereits definiert und an die Kampagne gebunden.
4. **Der nicht-sondentragbare Anteil ist genau der verworfene.** 57,8 % Intent-Labels ohne
   Goldstandard ist derselbe Befund, aus dem JEV K9 als letzten von elf Kandidaten gestrichen hat;
   ein Klassifikator-Ausbau wuerde eine von der Schwester-Entscheidung bereits verworfene Groesse
   unter neuem Namen wieder einfuehren.

Ein sauberes „abgebaut" ist ein vollstaendiges Ergebnis; die Wiedereinreise-Bedingung (§3) ist der
Teil dieser Notiz, der sie nicht fuer immer schliesst.

## 5. Methode — Skripte und Ausgaben wortlich

Beide Skripte lesen ausschließlich Transkripte unter `~/.claude/projects/*claude-fleet*`, schreiben
nach stdout, fuehren kein Kommando aus, oeffnen kein `.env` und keinen Token. Sonden und
Zaehlregeln sind wortlich aus B17 §9.2 bzw. §9.1 uebernommen; der einzige Unterschied zum
Baseline-Lauf ist das rollierende Fenster (SINCE = jetzt − 14 d, CUTOFF = jetzt). In allen
Ausgaben sind keine Kommandotexte, nur Zaehlungen.

### 5.1 `h1_sensor.py` — der Standsensor

```python
# H1-Standsensor: Roh-Anteil der Ledger-Lesungen je Ledger, rollierend 14 Tage.
# Sonden und Zaehlregeln identisch zu readers.py (strategische Notiz 2026-09-17 §9.2);
# nur das Fenster rolliert (SINCE = jetzt-14d, CUTOFF = jetzt). Kein Modell, keine Stichprobe,
# keine Klassifikation, kein Schreibakt. Ausgabe nach stdout.
import json, glob, os, re, time, collections

root = os.path.expanduser('~/.claude/projects')
DAYS = 14
NOW = time.time()
SINCE = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(NOW - DAYS * 86400))
CUTOFF = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(NOW))

LEDGERS = ['audit.jsonl', 'post-land-audits.jsonl', 'lane-outcomes.jsonl',
           'context-receipts.jsonl', 'deploys.jsonl']
ROUTES = ['/api/audit', '/api/post-land-audits', '/api/lane-outcomes',
          '/api/context-receipts', '/api/deploys']
READCMDS = 'tail|head|cat|grep|wc|jq'
ROUTE_OF = dict(zip(LEDGERS, ROUTES))
PROBES = {l: rf"curl[^|;]*{re.escape(ROUTE_OF[l])}(?![\w/-])" for l in LEDGERS}
for l in LEDGERS:
    PROBES['RAW ' + l] = (r"(open\(['\"][^'\"]*|(?:" + READCMDS + r")\b[^|;&]*?[ /])"
                          + (r"(?<![\w-])" if l == 'audit.jsonl' else '') + re.escape(l))
RX = {k: re.compile(v) for k, v in PROBES.items()}

def role(first, d):
    if 'worktrees' in d: return 'lane'
    if 'Program-MAIN' in first: return 'main'
    if 'succession' in first or 'Orchestrator' in first: return 'orch'
    return 'other'

hits = collections.defaultdict(lambda: dict(raw=0, route=0, byr=collections.Counter(),
                                            byroute=collections.Counter(), sessions=set()))
nfiles = ncalls = 0
t0 = time.mktime(time.strptime(SINCE[:10], '%Y-%m-%d'))
for d in os.listdir(root):
    if 'claude-fleet' not in d: continue
    for f in glob.glob(os.path.join(root, d, '*.jsonl')):
        if os.stat(f).st_mtime < t0: continue
        first = None; nfiles += 1
        for line in open(f, encoding='utf-8', errors='replace'):
            if first is None and '"type":"user"' in line:
                try:
                    r = json.loads(line); c = (r.get('message') or {}).get('content')
                    t = c if isinstance(c, str) else ' '.join(x.get('text', '') for x in c if isinstance(x, dict))
                    if t.strip() and not t.startswith('<'): first = t[:300]
                except Exception: pass
            if '"name":"Bash"' not in line: continue
            try: r = json.loads(line)
            except Exception: continue
            if r.get('isSidechain'): continue
            ts = r.get('timestamp') or ''
            if ts < SINCE or ts > CUTOFF: continue
            for x in (r.get('message') or {}).get('content') or []:
                if isinstance(x, dict) and x.get('type') == 'tool_use' and x.get('name') == 'Bash':
                    ncalls += 1
                    cmd = x['input'].get('command', '')
                    inv = sum(1 for l in LEDGERS if l in cmd) >= 5 or '*.jsonl' in cmd
                    for k, rx in RX.items():
                        if k.startswith('RAW ') and inv: continue
                        if rx.search(cmd):
                            h = hits[k if not k.startswith('RAW ') else k[4:]]
                            if k.startswith('RAW '): h['raw'] += 1; h['byr'][role(first or '', d)] += 1
                            else: h['route'] += 1; h['byroute'][role(first or '', d)] += 1
                            h['sessions'].add(f)
print(f'window {SINCE} .. {CUTOFF} ({DAYS} Tage rollierend)')
print(f'files {nfiles} bash calls {ncalls}')
print(f"{'ledger':28} {'roh':>5} {'route':>6} {'roh-anteil':>10}  roh nach Rolle (lane/orch/main/other) · route nach Rolle")
tot_r = tot_q = 0
rows = []
for l in LEDGERS:
    h = hits[l]; n = h['raw'] + h['route']
    share = (100.0 * h['raw'] / n) if n else None
    rows.append((share if share is not None else -1, l, h, share))
for _, l, h, share in sorted(rows, key=lambda x: -x[0]):
    b = h['byr']; q = h['byroute']
    tot_r += h['raw']; tot_q += h['route']
    s = f"{share:9.1f} %" if share is not None else '        —'
    print(f"{l:28} {h['raw']:5} {h['route']:6} {s}   "
          f"{b['lane']}/{b['orch']}/{b['main']}/{b['other']} · {q['lane']}/{q['orch']}/{q['main']}/{q['other']}")
n = tot_r + tot_q
print(f"{'GESAMT':28} {tot_r:5} {tot_q:6} {100.0 * tot_r / n:9.1f} %")
````

### 5.2 `candidates.py` — Vorzaehlung der Kandidaten

```python
# H2-Vorzaehlung: wie viele Aufrufe der vollen Population muesste ein Klassifikator sehen,
# wenn die mechanischen Tag-Regeln aus measure.py (strategische Notiz §9.1) vorfiltern?
# RULES/TOKFETCH/debody wortlich aus §9.1 uebernommen; KEINE Handkorrekturen (OVR entfaellt,
# genau das ist der Unterschied). Rollierendes 14-Tage-Fenster wie h1_sensor.py.
import collections, glob, json, os, re, time

root = os.path.expanduser('~/.claude/projects')
DAYS = 14
NOW = time.time()
SINCE = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(NOW - DAYS * 86400))
CUTOFF = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime(NOW))

RD = 'tail|head|cat|grep|wc|jq|ls|stat'
LEDGERS = r"(post-land-audits|lane-outcomes|audit|deploys|context-receipts|fleet-reports|cards|tasks-archive|land-quality|audit-adjudications|helper-artifacts|steward-journal|inspektion-register|dispositions|prompts)\.jsonl"
TOKFETCH = [r"TOK=\$\(python3 -c \"import json;\s*print\(json\.load\(open\('fleet\.json'\)\)\['token'\]\)\"\)",
            r"TOK=\$\(sed -n 's/\^  \"token\".{0,40}?fleet\.json \| head -1\)",
            r"TOK=\$\(grep -E '\^FLEET_TOKEN=' \.env[^)]*\)"]
RULES = [
 ('QUEUEFILE', r"post-land-audit-queue\.json"),
 ('NARROW_API', r"curl(?![^|;]*-X POST)[^|;]*/api/(deploys|slots/\d+/merge|programs/\w+/release-valid|post-land-audits|lane\b|flakes|slot-stats)"),
 ('IFACE', r"(grep|rg|awk)\b[^|;]*(api/|api\\/|pathname|self/|VERB 2)"),
 ('KEYPROBE', r"print\((list|sorted)\(\w+(\[[^\]]+\])*\.keys\(\)\)|print\(\[k for k in \w+(\[[^\]]+\])*\.keys\(\)\]\)"),
 ('LEDGER_RAW', r"(open\(['\"][^'\"]*|(?:" + RD + r")\b[^|;&]*?[ /])" + LEDGERS + r"|glob\.glob\('e2e-trail|e2e-trail/\*"),
 ('FLEETJSON_RAW', r"open\(['\"](/Users/owner/claude-fleet/)?fleet\.json['\"]\)|grep[^|;]* fleet\.json|F = \"/Users/owner/claude-fleet/fleet\.json\""),
 ('API_RAW', r"curl(?![^|;]*-X POST)[^|;]*/api/(?!self)[a-z]"),
 ('API_FOLLOW', r"(scratchpad|/tmp)/(sess|plan|pe|progexec|s2|inbox\d*)\.json|open\('(pe|progexec)\.json'\)"),
 ('PANE', r"capture-pane"),
 ('TRANSCRIPT', r"\.claude/projects|\.codex/sessions|claude --help"),
 ('AUTHSEARCH', r"grep[^|;]*(FLEET_TOKEN|x-fleet|tokenFrom|ownerH|Authorization|CTL_TOKEN)"),
 ('SCRIPT', r"\./(state|register)\.sh|bun (land-quality|trailstats|briefstats|slotstats|lane-context-cost|land-collision-stats|land-log|task-notes|capability-map|repo-map|start-plan)\.ts"),
 ('CTL_READ', r"ctl\.sh( (merges|lock(?! --reap)|ctx|report|events(?! --ack))\b| 2>&1| *$)"),
 ('SELF_GET', r"curl(?![^|;]*-X POST)[^|;]*/api/self"),
 ('ACT', r"-X POST|--data-binary|git (commit|add|worktree remove|push|rebase|cherry-pick|checkout|stash|reset)|cat > |<<'?\"?[A-Z]+'?\"?|sed -i|\bmv |\bcp |\brm |write\(|json\.dump\(|ctl\.sh (land|dispatch|send|commit|watch|wait|lock --reap|events --ack)|mkdir|chmod|kill "),
 ('BUILD', r"bun e2e/pins|bunx tsc|bun run build|e2e-[a-z-]+\.sh|bun test|bun fleet-e2e|bun install|bun review-sweep|bun [^ ]*scratchpad|bun -e|bun run |timeout \d+ bun|nohup|iso\.log|suite\.log|server\.log"),
 ('HOST', r"vm_stat|sysctl|\bps -|pgrep|lsof|memory_pressure|df -h|top -l|\bssh |uptime|du -s|tmux -L \w+ (list|kill|ls)"),
 ('GIT', r"(^|[;&|(] ?|\s)git( -C \S+)? (log|diff|show|status|merge-base|rev-|notes|branch|worktree list|blame|ls-files|cat-file|fetch|merge-tree|grep)"),
 ('SRC', r"sed -n|grep|\brg\b|\bcat\b|\bhead\b|\bwc\b|\bls\b|ast-grep|graphify|\bfind\b|awk"),
]
CANDIDATES = {'SCRIPT', 'CTL_READ', 'SELF_GET', 'NARROW_API', 'AUTHSEARCH', 'IFACE', 'KEYPROBE',
              'LEDGER_RAW', 'FLEETJSON_RAW', 'API_RAW', 'API_FOLLOW', 'QUEUEFILE', 'PANE',
              'TRANSCRIPT', 'OTHER'}

def debody(cmd):
    cmd = re.sub(r"(cat >+ ?\S+ <<-?\s*['\"]?(\w+)['\"]?)\n.*?\n\2\b", r"\1 <BODY>", cmd, flags=re.S)
    cmd = re.sub(r"(git commit[^\n]*<<-?\s*['\"]?(\w+)['\"]?)\n.*?\n\2\b", r"\1 <BODY>", cmd, flags=re.S)
    cmd = re.sub(r'""".*?"""', '<TEXT>', cmd, flags=re.S)
    cmd = re.sub(r"(for \w+ in [^;]+; do )?curl -s -X POST[^|;&]*/api/self/(events|inbox)/[^|;&]*?/(ack|read)\"?[^|;&]*(\| head -c \d+)?(>/dev/null)?( 2>&1)?(; done)?", "<ACK>", cmd)
    return re.sub(r"(-d|--data) '\{.*?\}'", r"\1 <JSON>", cmd, flags=re.S)

def tag_of(cmd):
    cmd, _ = cmd, 0
    for rx in TOKFETCH:
        cmd = re.sub(rx, 'TOK=<fetch>', cmd)
    cmd = debody(cmd)
    tag = next((name for name, rx in RULES if re.search(rx, cmd)), 'OTHER')
    if tag in ('API_RAW', 'NARROW_API', 'SELF_GET', 'FLEETJSON_RAW', 'KEYPROBE'):
        mp, mg = re.search(r"-X POST", cmd), re.search(r"curl(?![^|;]*-X POST)", cmd)
        if mp and (not mg or mp.start() < mg.start()) and not re.search(r"open\(['\"](/Users/owner/claude-fleet/)?fleet\.json", cmd[:mp.start()]): tag = 'ACT'
    return tag, len(cmd.encode())

tags = collections.Counter(); cand_bytes = []; sessions = set(); ncalls = 0; nfiles = 0
t0 = time.mktime(time.strptime(SINCE[:10], '%Y-%m-%d'))
for d in os.listdir(root):
    if 'claude-fleet' not in d: continue
    for f in glob.glob(os.path.join(root, d, '*.jsonl')):
        if os.stat(f).st_mtime < t0: continue
        nfiles += 1
        for line in open(f, encoding='utf-8', errors='replace'):
            if '"name":"Bash"' not in line: continue
            try: r = json.loads(line)
            except Exception: continue
            if r.get('isSidechain'): continue
            ts = r.get('timestamp') or ''
            if ts < SINCE or ts > CUTOFF: continue
            for x in (r.get('message') or {}).get('content') or []:
                if isinstance(x, dict) and x.get('type') == 'tool_use' and x.get('name') == 'Bash':
                    ncalls += 1; sessions.add(f)
                    tag, b = tag_of(x['input'].get('command', ''))
                    tags[tag] += 1
                    if tag in CANDIDATES: cand_bytes.append(b)
xs = sorted(cand_bytes)
q = lambda p: xs[min(len(xs) - 1, int(p * (len(xs) - 1)))]
print(f'window {SINCE} .. {CUTOFF} (14 Tage rollierend)')
print(f'files {nfiles} bash calls {ncalls} in {len(sessions)} sessions')
print('TAGS', dict(tags.most_common()))
n_cand = len(cand_bytes)
print(f'KANDIDATEN {n_cand}/{ncalls} = {100.0 * n_cand / ncalls:.1f} % der Population')
print(f'Kandidaten-Kommandobytes: Summe {sum(xs)} · Median {q(0.5)} · p90 {q(0.9)} · max {xs[-1]}')
per_day = n_cand / DAYS
print(f'Kandidaten je Tag: {per_day:.0f} · je Session mit Bash: {n_cand / len(sessions):.1f}')
````

### 5.3 Unveraenderte Ausgaben

```text
window 2026-09-05T01:44:23.000Z .. 2026-09-19T01:44:23.000Z (14 Tage rollierend)
files 1403 bash calls 43403
ledger                         roh  route roh-anteil  roh nach Rolle (lane/orch/main/other) · route nach Rolle
audit.jsonl                    278      0     100.0 %   113/105/42/18 · 0/0/0/0
lane-outcomes.jsonl            276      0     100.0 %   58/144/63/11 · 0/0/0/0
context-receipts.jsonl          21      0     100.0 %   16/5/0/0 · 0/0/0/0
post-land-audits.jsonl         685     10      98.6 %   80/287/303/15 · 1/8/1/0
deploys.jsonl                   79     78      50.3 %   2/41/34/2 · 0/54/12/12
GESAMT                        1339     88      93.8 %

---

window 2026-09-05T01:45:19.000Z .. 2026-09-19T01:45:19.000Z (14 Tage rollierend)
files 1403 bash calls 43403 in 417 sessions
TAGS {'SRC': 13002, 'ACT': 8733, 'BUILD': 3248, 'FLEETJSON_RAW': 3245, 'SELF_GET': 3159, 'GIT': 2459, 'OTHER': 1881, 'HOST': 1735, 'LEDGER_RAW': 1393, 'IFACE': 1273, 'CTL_READ': 689, 'PANE': 680, 'SCRIPT': 545, 'API_RAW': 507, 'TRANSCRIPT': 277, 'NARROW_API': 197, 'KEYPROBE': 156, 'API_FOLLOW': 127, 'AUTHSEARCH': 60, 'QUEUEFILE': 37}
KANDIDATEN 14226/43403 = 32.8 % der Population
Kandidaten-Kommandobytes: Summe 6553687 · Median 354 · p90 873 · max 17309
Kandidaten je Tag: 1016 · je Session mit Bash: 34.1
```
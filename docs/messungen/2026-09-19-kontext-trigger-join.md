---
frage: Liest eine Lane, der ein Kontext-Pack weggelassen wurde (trigger-not-matched), den weggelassenen Stoff danach nachweislich von Hand nach, und welche Trigger haben nachgewiesen Schaden verursacht? Und warum bekommen 45 von 150 Lanes rohe Prosa statt einer Karte?
urteil: Der Join ist erstmalig rechenbar und das Ergebnis ist klein und strukturgleich — von 401 joinbaren Fleet-Lanes (claude, 2026-08-16 bis 09-19) liest keine einzige je einen weggelassenen Pack, denn alle vier Trigger-Packs wurden in 449 von 449 Receipts ausgelassen: der Trigger-Satz am Dispatch ist die Konstante ["always","verification"], es gibt keinen Pfad, der Trigger je Aufgabe zuordnet. Nachweisen lässt sich Nachlesen trotzdem: 23 Lanes (5,7 %) lesen die Harness-Adapter-Quellen von Hand, 9 (2,2 %) Land-Mechanics, 4 (1,0 %) Queue-Refinement; ohne auftragsverursachte Lese­ungen netto 18/5/3. Rangliste nach Schaden: harness-selection vor landing vor task-queue, deployment ist nicht messbar (Quelle nur Hash-Referenz). Die Schnittlinie: nur harness-selection liegt über 1 % netto; landing und task-queue bleiben, ihr Ausbau würde 3,5–4,3 kB je allen 401 Lanes gegen 5 bzw. 3 geholfene Lanes stellen, und selektiv ausliefern kann der Seam ohnehin nicht. Die 45 rohen Prosas sind zu 31 eine ungültige Karte (62 Gaps, davon 47 surface.symbols), zu 13 fehlender Kartenversuch (cardDue-Backoff/Maximum, im Ledger nicht unterscheidbar) und zu 1 ein Rennen (gültige Karte 1,3 s nach dem Dispatch) — ein Pfad, der eine vor dem Dispatch gültige Karte nicht liest, existiert nicht: briefSourceOf gewinnt die gültige Karte an derselben Stelle, an der die Bytes gewählt werden. Heute (letzte 150 von 944) sind es 32 rohe: 20 ungültig, 11 ohne Versuch, 1 Rennen.
bereich: [kontext-packs, receipts, worktrail, bash, queue, briefs, karten]
belege: [context-plan.ts#contextOmissionFor, context-packs.ts, server.ts#briefSourceOf, server.ts#DISPATCH_CONTEXT_TRIGGERS, server.ts#BOOTSTRAP_CONTEXT_TRIGGERS, server.ts#cardDue, server.ts#withCardHead, docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md]
nicht-gemessen: Pi-, Codex- und Fremdrepo-Lanes (ihre Transkripte liegen nicht unter ~/.claude/projects bzw. im Fremdbaum — 48 geschlossene Fleet-Lanes und alle 495 Nicht-Fleet-Receipts sind unjoinbar); Nachlesen ohne Quellen-Nennung im Kommando (sed auf Zeilenbereiche, cat des ganzen Loader — Richtung konservativ, der Schaden ist eine Untergrenze); die Gegenrichtung (Pack ausgeliefert, aber nicht gebraucht — für die always-Packs nicht beobachtbar, eine Kosten-/Nutzen-Bilanz eines Trigger-Ausbaus bleibt deshalb halb offen); ob das Nachlesen den Lane-Ausgang (Zeit, Qualität, Redo) verändert; bei den raw-Zeilen ohne Kartenversuch, ob Backoff, erschöppte Versuche oder Nie-Anlauf vorlag (cardRetry ist Speicher, kein Ledger); die 45er-Fenster-Aufschlüsselung nutzt den heutigen Ledger-Stand, Retry-Zustände zum Messzeitpunkt 2026-09-17 sind nicht rekonstruierbar.
stand: 2026-09-19
---

# Der Join: weggelassene Kontext-Packs gegen das von-Hand-Nachlesen

2026-09-19, Lane `fleet/260919011219-8542`, Baum auf main-Basis. Frage des Auftrags: Ein
`trigger-not-matched` ist nicht automatisch falsch — eine Docs-Lane soll `land-mechanics` nicht
bekommen. Was fehlt, ist der kontrafaktische Beleg. Beide Hälften liegen auf Platte:
(a) `context-receipts.jsonl` sagt je Lane, welcher Pack weggelassen wurde und warum;
(b) die Worktrail-Bash-Spur (Methode: Schwesternote §9.1) sagt, was die Lane danach von Hand
gelesen hat. **Kriterium, mechanisch und ohne Modell:** liest eine Lane nach dem Receipt-
Zeitpunkt eine Quelle, die ein weggelassener Pack ihr gegeben hätte, war der Trigger für genau
diese Lane zu eng — belegt, nicht geschätzt. Liest sie sie nicht, hat die Auslassung Geld
gespart. Damit wird „Trigger zu eng" zum ersten Mal falsifizierbar.

## 1. Ergebnis

1. **Die Auslassung ist strukturell, nicht kalibriert.** In allen 449 Fleet-Lane-Receipts des
   claude-Harness (2026-08-16 bis 09-19) sind dieselben vier Packs `trigger-not-matched`
   ausgelassen; in der ganzen Ledger von 944 Zeilen wurde keines der vier jemals selektiert.
   Grund im Code: `DISPATCH_CONTEXT_TRIGGERS` und `BOOTSTRAP_CONTEXT_TRIGGERS` sind dieselbe
   Konstante `["always", "verification"]` — der einzige receiptete Seam kennt keinen anderen
   Satz. „Trigger zu eng" ist darum kein Kalibrierungsfehler einzelner Trigger; es gibt keinen
   Pfad, der Triggern je nach Aufgabe zuordnen würde. (Der Landing-Trigger existiert nur in
   `landingAnchorBlock`, und der schreibt bewusst keine Receipts.)
2. **Der Nachweis des Nachlesens gelingt — die Schadenquote ist klein.** Von 401 joinbaren Lanes
   (erhaltenes Transkript, 45.085 Bash-Kommandos nach Receipt) lesen 23 (5,7 %) eine Quelle des
   weggelassenen Harness-Adapter-Packs von Hand, 9 (2,2 %) Land-Mechanics, 4 (1,0 %)
   Queue-Refinement. Zieht man Lanes ab, deren Gruendungsprompt die Quelle selbst nennt
   (auftragsverursachte Lese­ungen), bleiben netto 18 (4,5 %), 5 (1,2 %) und 3 (0,7 %).
3. **Rangliste nach Schaden:** harness-selection (Adapter) vor landing vor task-queue;
   deployment ist nicht messbar. Schnittlinie: nur harness-selection liegt über 1 % netto.
   Aber die Alternative ist nicht „feiner triggern", sondern die Konstante ändern — dann
   bekommt jeder Lane den Pack: 4.600 B × 401 gegen 18 geholfene Lanes (Adapter), 4.300 B × 401
   gegen 5 (Landing), 3.500 B × 401 gegen 3 (Queue). Die Zahl rechtfertigt keinen der drei
   Ausbauten allein; sie macht die Abwägung zum ersten Mal rechenbar. Entscheidung bleibt beim
   Owner — diese Zeile misst, sie ändert nichts.
4. **Die zweite Hälfte: 45 rohe Prosas sind 31 ungültige Karten, 13 fehlende Kartenversuche und
   1 Rennen.** Ein Pfad, der eine vor dem Dispatch gültige Karte nicht liest, existiert nicht:
   `briefSourceOf` gewinnt `t.card?.valid` an derselben Stelle (`briefAndSend`/`withCardHead`),
   an der die Bytes gewählt werden — ein gültiger Karte kann nicht als raw zugestellt werden.
   Das eine Rennen (`898ad990`): Karte 1.330 ms nach dem Dispatch geschrieben, also bei der
   Zustellung noch nicht auf der Zeile.

## 2. Population und Join-Definition

**Receipts.** `context-receipts.jsonl`, Stand 2026-09-19 03:12, 944 Zeilen. Join-Population:
Zeilen mit `harness: null` (`harnessIdOf` mapt das claude-Harness auf null), `branch: fleet/*`
(Lane-Dispatches, keine Founding-/MAIN-Zeilen) und `repo == /Users/owner/claude-fleet`
(die Fleet-Anker sind nur im Fleet-Baum auflösbar; Fremdrepo-Lanes bekommen alles als
`source-unavailable`). Das sind 449 Receipts; 401 haben ein erhaltenes Transkript, 48 Lanes sind
geschlossen (Arbeitsverzeichnis-Transkripte werden mit der Lane entfernt — die Join-Basis
schrumpft mit jeder geschlossenen Lane, das Fenster 2026-08-16 bis 09-19 ist der Bestand, nicht
eine Auswahl).

**Bash-Spur.** Claude-Transkripte unter `~/.claude/projects/-Users-owner-claude-fleet-
worktrees-fleet-<id>/*.jsonl`, ausgewertet wie Schwesternote §9.1: Bash-`tool_use`-Kommandos,
Sidechain-Zeilen aus, nur Kommandos mit Zeitstempel **nach** dem Receipt-`at`. Je Branch genau
ein Receipt (449/449), Nachfolge-Sessions im selben Verzeichnis zählen mit — ihr Nachlesen ist
echtes Nachlesen desselben Auslasses.

**Treffer-Prädikat je Pack, wörtlich aus `context-packs.ts`:** land-mechanics = Kommando nennt
`docs/land-mechanics.md`, oder `AGENTS.md` zusammen mit `## Landing`; task-queue = nennt
`docs/plan-queue-refinement-2026-08-11.md`; harness-adapter = nennt `docs/container.md`, oder
`server.ts` zusammen mit `HARNESSES`. Jede Quelle je Lane zählt einmal (der erste Beleg).
**Gegenprobe, ebenfalls deterministisch:** nennt der Gruendungsprompt der Lane dieselbe Quelle,
ist das Nachlesen auftragsverursacht — es steht als `brief`-Spalte gesondert ausgewiesen, nicht
weggelassen. `private-deploy-overlay` ist nicht joinbar: seine Quelle ist eine private
Hash-Referenz ohne getrackten Pfad, von außen nicht adressierbar.

## 3. Trefferquote je Pack und Nachlese-Anteil

Vollständige, unveränderte Skriptausgabe in §9. Die kompakte Tabelle (joinbare Lanes, n = 401):

| Pack | Trigger | selektiert | ausgelassen | las nach | % der Ausgelassenen | Gruendungsprompt nennt Quelle | netto (las nach, nicht auftragsverursacht) |
|---|---|---:|---:|---:|---:|---:|---:|
| harness-adapter | harness-selection | 0 | 401 | 23 | 5,7 % | 10 | 18 (4,5 %) |
| land-mechanics | landing | 0 | 401 | 9 | 2,2 % | 5 | 5 (1,2 %) |
| task-queue | task-queue | 0 | 401 | 4 | 1,0 % | 3 | 3 (0,7 %) |
| private-deploy-overlay | deployment | 0 | 401 | n/j | n/j | n/j | n/j |
| portable-core / verify-e2e | always / verification | 401 / 401 | 0 | — | — | — | — |

Die Trefferquote der vier Trigger-Packs ist 0 — überall, nicht nur in dieser Stichprobe
(Ledger-weit 0 von 944). Die Nachlese-Zähler sind Beleg-für-Beleg im Register in §9 nachlesbar;
die Auge-Prüfung des Registers zeigt drei Randklassen, die in der Quote mitzählen und es auch
sollen: Bulk-Dokumentenleser (vier Lanes fassen mehrere Pack-Quellen in einem Lauf,
`c3431136`, `c770f365`, `36658d80`, `457511cc`), Adapter-Arbeits-Lanes, deren Python-Edit auf
`server.ts` den HARNESSES-Kontext mitliest (Auftragsarbeit, durch die Gegenprobe als `brief`
ausgewiesen), und eine Lane, die `docs/land-mechanics.md` editiert — Lesen beim Schreiben.

## 4. Rangliste der Trigger nach nachgewiesenem Schaden, mit Schnittlinie

| Rang | Trigger | netto-Schaden (n = 401) | Kosten eines Ausbaus (Pack immer) | über der Linie? |
|---|---|---|---|---|
| 1 | harness-selection | 18 Lanes, 4,5 % | 4.600 B × 401 ≈ 1,8 MB | ja, einziger über 1 % |
| 2 | landing | 5 Lanes, 1,2 % | 4.300 B × 401 ≈ 1,7 MB | nein |
| 3 | task-queue | 3 Lanes, 0,7 % | 3.500 B × 401 ≈ 1,4 MB | nein |
| — | deployment | nicht messbar | 99.108 B (privates Overlay) | bleibt, unjoinbar |

**Schnittlinie.** Die Linie liegt bei 1 % netto-Schaden: über ihr steht nur harness-selection,
und nur dort ist eine Kosten-/Nutzenrechnung über die bloße Byte-Summe hinaus überhaupt
streitbar. Unter der Linie bleiben landing und task-queue unverändert — 1,7 MB Zustellung gegen
5 bzw. 3 nachweislich geholfene Lanes ist keine Zahl, die eine Änderung trägt. Über der
strategischen Ebene bleibt der Befund aus §1.1: am einzigen receipteten Seam ist der
Trigger-Satz eine Konstante; ein „selektiver" Ausbau existiert als Mechanismus nicht. Ein Ausbau
hieße praktisch: die Konstante erweitern (alle Lanes zahlen, die Rangliste sagt, wer es lohnt) —
oder einen aufgaben-abgeleiteten Trigger-Satz bauen, was eine neue Maschinerie wäre, die diese
Zeile nicht vorschlägt und nicht baut.

## 5. Warum bekommen 45 von 150 Lanes rohe Prosa?

Die Auftragsmessung (2026-09-17, letzte 150 von 894) reproduziert exakt: briefSource card 74 ·
raw 45 · owner 9 · founding 19 · main 3, dazu die Auslassungen task-queue 142, harness-adapter
142, land-mechanics 111, private-deploy-overlay 111 (je `trigger-not-matched`), harness-
unsupported 31, source-unavailable 8. Die 45 lassen sich mechanisch aufschlüsseln — je raw-Zeile
die Task-Zeile (live + Archiv) und die Kartenversuche in `cards.jsonl`, gegliedert nach
Versuchszeitpunkt vor/nach dem Receipt:

| Klasse | n | Anteil | Beleg |
|---|---:|---:|---|
| Karte vorhanden, aber ungültig | 30 + 1 | 69 % | Gaps je Karte: surface.symbols 47, surface.files 6, size 4, after 2, surface.creates 2, verify 1 (62 Gaps auf 31 Karten) |
| Kein Kartenversuch im Ledger | 13 | 29 % | alle nach Kartenbeginn (09-13) angelegt; cardDue setzt Backoff (`CARD_BACKOFF_MS·2^attempts`) und `CARD_MAX_ATTEMPTS`, im Ledger nicht unterscheidbar |
| Gültige Karte, aber erst nach dem Dispatch | 1 | 2 % | `898ad990`: Karte 1.330 ms nach Receipt (Rennen mit dem Dispatch) |

**Die dritte Kandidaten-Antwort des Auftrags — „ein Pfad, der die Karte gar nicht liest" — trifft
nicht zu.** `briefSourceOf` (server.ts, Zeile 12096) prüft `t.card?.valid` zuerst und gewinnt
damit gegen jeden Brief-Herkunftswert; `withCardHead` setzt genau diese Karte vor die Prosa. Es
gibt in beiden Fenstern keinen Fall, in dem eine vor dem Dispatch gültige Karte als raw
zugestellt wurde. Die Klasse, die Zeile `c2904891` repariert (verify nennt eine Route statt
eines Kettenschritts), kommt im 45er-Fenster einmal vor — die trägen Gaps sind
`surface.symbols`/`surface.files` (47 bzw. 6) und `size: "klein" is not stated in the request`
(4). Kontrolle im heutigen Fenster (letzte 150 von 944): 32 rohe = 20 ungültig + 11 ohne
Versuch + 1 Rennen (`898ad990` fällt hier unter die 32; cross-tab über alle 150: owner-Quelle
70 gültig / 11 ungültig / 12 ohne Karte, main-Quelle 14 / 13 / 2 — Karten entstehen also auch
für Owner-Zeilen, die 13 ohne Versuch sind kein Quellen-Muster).

## 6. Was nicht gemessen wurde

Siehe Front-Matter `nicht-gemessen`; die zwei wichtigsten Grenzen noch einmal mit Richtung: Das
Kriterium unterschätzt (eine Lane, die die Landing-Sektion per `sed -n` auf Zeilenbereiche liest,
ohne `## Landing` zu nennen, zählt nicht — der gemessene Schaden ist eine **Untergrenze**), und
es misst nur die eine Richtung (ein ausgelassener Pack, den niemand nachliest, spart Geld; ob
die beiden always-Packs bei 100 % Trefferquote immer gebraucht werden, ist mit diesem Join nicht
beobachtbar — die Bilanz eines Ausbaus bleibt deshalb halb offen).

## 7. Berührung mit der Schwesterzeile b0279bc6

b0279bc6 liest dieselbe Bash-Spur für die Frage Rohlesung-vs-Routenlesung je Ledger (`measure.py`
§9.1 der Schwesternote). Diese Zeile übernimmt deren Ladungskonvention (Bash-`tool_use`,
Sidechains aus, Zeitstempel-Filter statt Cutoff) und baut keinen zweiten Parser für die
Receipts; der Join selbst läuft über Pack-Anker aus `context-packs.ts` und berührt die
`OVR`-Handkorrekturen der Schwester nicht — anderes Prädikat, andere Frage, kein doppeltes
Klassifikat (das Kriterium hier ist deterministisch über Pfad/Anker, kein Modell im Spiel).

## 8. Methode — das Join-Skript, wörtlich

Läuft einmal (`python3 join.py` im Scratchpad, Pfade oben im Skript); die Ausgabe steht in §9.
Die Assertions prüfen, dass alle sechs Pack-IDs und die vier Trigger-Namen wörtlich in
`context-packs.ts` stehen und dass portable-core/verify-e2e in allen 401 joinbaren Receipts
selektiert sind — ein Zähler, der die falschen Zeilen liest, fällt silent nicht durch.

```python
# Join: context-receipts.jsonl (welcher Pack wurde einer Lane weggelassen, warum)
#     x Worktrail-Bash-Spur (was die Lane danach VON HAND gelesen hat).
# Methode: docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md §9.1
# (Claude-Transkripte unter ~/.claude/projects, Bash-tool_use, Sidechains aus).
# Kriterium (deterministisch, kein Modell): ein Bash-Kommando der Lane NACH dem
# Receipt-Zeitpunkt, das eine Quelle des weggelassenen Packs adressiert, belegt,
# dass die Lane den Stoff von Hand nachgelesen hat — der Trigger war fuer diese
# Lane zu eng. Adressiert = der Pfad bzw. Pfad+Anker laut context-packs.ts.
# Gegenprobe (deterministisch, kein Klassifikator): nennt der gruendende Prompt
# der Lane dieselbe Quelle, ist das Nachlesen auftragsverursacht und wird
# gesondert ausgewiesen. Läuft einmal; Ausgabe steht wörtlich in der Messnotiz.
import json, glob, os, collections, datetime, re

FLEET   = '/Users/owner/claude-fleet'
ROOT    = os.path.expanduser('~/.claude/projects')
RECEIPT = FLEET + '/context-receipts.jsonl'

# Die Anker wörtlich aus context-packs.ts (die Datei wird unten auf IDs und Trigger geprüft).
# Joinbar sind nur Packs mit getrackten Quellen; private-deploy-overlay trägt nur eine
# Hash-Referenz — sein Inhalt ist von außen nicht adressierbar, also nicht joinbar.
TARGETS = {
  'land-mechanics': [
    ('docs/land-mechanics.md', lambda c: 'land-mechanics.md' in c),
    ('AGENTS.md ## Landing',   lambda c: 'AGENTS.md' in c and '## landing' in c.lower()),
  ],
  'task-queue': [
    ('docs/plan-queue-refinement-2026-08-11.md', lambda c: 'plan-queue-refinement' in c),
  ],
  'harness-adapter': [
    ('docs/container.md',         lambda c: 'container.md' in c),
    ('server.ts const HARNESSES', lambda c: 'server.ts' in c and 'HARNESSES' in c),
  ],
}
PACK_TRIGGER = {'land-mechanics': 'landing', 'task-queue': 'task-queue',
                'harness-adapter': 'harness-selection', 'private-deploy-overlay': 'deployment'}
READ_VERB = re.compile(r'\b(cat|sed|head|tail|grep|rg|awk|wc|less|more|open)\b')

src = open(FLEET + '/context-packs.ts').read()
for pid in list(PACK_TRIGGER) + ['portable-core', 'verify-e2e']:
    assert pid in src, pid
for trg in PACK_TRIGGER.values():
    assert f'"{trg}"' in src, trg

rows = [json.loads(l) for l in open(RECEIPT) if l.strip()]
lanes = [r for r in rows
         if r.get('harness') is None                      # harnessIdOf: null = claude
         and (r.get('branch') or '').startswith('fleet/')
         and r.get('repo') == FLEET]                      # Fleet-Anker nur im Fleet-Baum
print(f'population: fleet-repo claude lane receipts = {len(lanes)} '
      f'({datetime.datetime.fromtimestamp(min(r["at"] for r in lanes)/1000):%Y-%m-%d} .. '
      f'{datetime.datetime.fromtimestamp(max(r["at"] for r in lanes)/1000):%Y-%m-%d})')

def lane_dir(branch):
    d = os.path.join(ROOT, '-Users-owner-claude-fleet-worktrees-fleet-' + branch.split('/', 1)[1])
    return d if os.path.isdir(d) else None

def bash_after(path, cutoff_ms):
    """(cmd, iso) aller Bash-tool_use nach cutoff_ms; Sidechains aus."""
    out = []
    for line in open(path, errors='ignore'):
        try: r = json.loads(line)
        except Exception: continue
        if r.get('isSidechain') or not r.get('timestamp'): continue
        ts = datetime.datetime.fromisoformat(r['timestamp'].replace('Z', '+00:00')).timestamp() * 1000
        if ts <= cutoff_ms: continue
        c = (r.get('message') or {}).get('content')
        for x in c if isinstance(c, list) else []:
            if isinstance(x, dict) and x.get('type') == 'tool_use' and x.get('name') == 'Bash':
                out.append((x.get('input', {}).get('command', '') or '', r['timestamp']))
    return out

def first_prompt(path):
    for line in open(path, errors='ignore'):
        try: r = json.loads(line)
        except Exception: continue
        if r.get('type') == 'user' and not r.get('isSidechain'):
            c = (r.get('message') or {}).get('content')
            if isinstance(c, str): return c
            if isinstance(c, list):
                return ' '.join(x.get('text', '') for x in c if isinstance(x, dict) and x.get('type') == 'text')
    return ''

st = {p: dict(sel=0, omit=collections.Counter(), readsrc=collections.Counter(),
              readlanes=set(), briefnamed=set(), verbs=collections.Counter())
      for p in list(PACK_TRIGGER) + ['portable-core', 'verify-e2e']}
joinable = lost = n_cmds = 0
hitdetail = collections.defaultdict(list)
for r in lanes:
    d = lane_dir(r['branch'])
    fs = sorted(glob.glob(d + '/*.jsonl')) if d else []
    if not fs: lost += 1; continue
    joinable += 1
    sel = {s['id'] for s in r.get('selected', [])}
    for p in st:
        if p in sel: st[p]['sel'] += 1
        for o in r.get('omitted', []):
            if o['id'] == p: st[p]['omit'][o['why']] += 1
    prompts = ' \n '.join(first_prompt(f) for f in fs)
    cmds = []
    for f in fs: cmds += bash_after(f, r['at'])
    n_cmds += len(cmds)
    for p, targets in TARGETS.items():
        for name, test in targets:
            for cmd, iso in cmds:
                if test(cmd):
                    st[p]['readlanes'].add(r['taskId'])
                    st[p]['readsrc'][name] += 1
                    st[p]['verbs']['read' if READ_VERB.search(cmd) else 'other'] += 1
                    hitdetail[p].append((r['taskId'], r['branch'], name,
                                         'read' if READ_VERB.search(cmd) else 'other', iso, cmd[:90]))
                    break   # ein Beleg je Quelle je Lane genügt
            if test(prompts): st[p]['briefnamed'].add(r['taskId'])

print(f'transcripts: {joinable} lanes joinbar, {lost} Receipts ohne erhaltenes Transkript (Lane geschlossen)')
print(f'bash commands after receipt across joined lanes: {n_cmds}')
assert st['portable-core']['sel'] == joinable and st['verify-e2e']['sel'] == joinable
print()
print('Trefferquote und Nachlese-Anteil je Pack (joinbare Lanes):')
hdr = f'{"pack":24}{"trigger":18}{"sel":>5}{"omit":>5}{"read":>5}{"%omit":>7}{"brief":>6}{"netto":>6}'
print(hdr)
for p in TARGETS:
    s = st[p]; omit = sum(s['omit'].values()); n = len(s['readlanes'])
    bn = len(s['briefnamed']); netto = len(s['readlanes'] - s['briefnamed'])
    print(f'{p:24}{PACK_TRIGGER[p]:18}{s["sel"]:>5}{omit:>5}{n:>5}{100*n/omit:>6.1f}%{bn:>6}{netto:>6}')
p = 'private-deploy-overlay'; s = st[p]
print(f'{p:24}{PACK_TRIGGER[p]:18}{s["sel"]:>5}{sum(s["omit"].values()):>5}{"n/j":>5}{"n/j":>7}{"n/j":>6}{"n/j":>6}   nicht joinbar: Quelle nur Hash-Referenz')
print()
print('omission-why breakdown (joinbare Lanes):')
for p in list(PACK_TRIGGER) + ['portable-core', 'verify-e2e']:
    if st[p]['omit']: print(f'  {p:24}', dict(st[p]['omit']))
print()
print('Nachlesen je Quelle und Verb-Klasse (Belege je Quelle je Lane je 1):')
for p in TARGETS:
    print(f'  {p:24}', dict(st[p]['readsrc']), dict(st[p]['verbs']))
print()
print('BELEGE (taskId, branch, quelle, verb, zeit, kommando-Ausschnitt):')
for p in TARGETS:
    for h in hitdetail[p]:
        print(f'  {p} | {h[0]} | {h[1]} | {h[2]} | {h[3]} | {h[4]} | {h[5]!r}')
```

## 9. Unveränderte Skriptausgabe

```text
population: fleet-repo claude lane receipts = 449 (2026-08-16 .. 2026-09-19)
transcripts: 401 lanes joinbar, 48 Receipts ohne erhaltenes Transkript (Lane geschlossen)
bash commands after receipt across joined lanes: 45085

Trefferquote und Nachlese-Anteil je Pack (joinbare Lanes):
pack                    trigger             sel omit read  %omit brief netto
land-mechanics          landing               0  401    9   2.2%     5     5
task-queue              task-queue            0  401    4   1.0%     3     3
harness-adapter         harness-selection     0  401   23   5.7%    10    18
private-deploy-overlay  deployment            0  401  n/j    n/j   n/j   n/j   nicht joinbar: Quelle nur Hash-Referenz

omission-why breakdown (joinbare Lanes):
  land-mechanics           {'trigger-not-matched': 401}
  task-queue               {'trigger-not-matched': 401}
  harness-adapter          {'trigger-not-matched': 401}
  private-deploy-overlay   {'trigger-not-matched': 401}

Nachlesen je Quelle und Verb-Klasse (Belege je Quelle je Lane je 1):
  land-mechanics           {'docs/land-mechanics.md': 8, 'AGENTS.md ## Landing': 3} {'read': 11}
  task-queue               {'docs/plan-queue-refinement-2026-08-11.md': 4} {'read': 4}
  harness-adapter          {'docs/container.md': 7, 'server.ts const HARNESSES': 19} {'read': 26}

BELEGE (taskId, branch, quelle, verb, zeit, kommando-Ausschnitt):
  land-mechanics | c3431136 | fleet/260821172714-5d3b | docs/land-mechanics.md | read | 2026-08-21T17:32:21.850Z | 'SCRATCH=/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260821172714-'
  land-mechanics | 90dc9604 | fleet/260823111940-b6a6 | docs/land-mechanics.md | read | 2026-08-23T11:20:00.404Z | 'cd /Users/owner/claude-fleet.worktrees/fleet-260823111940-b6a6; wc -l server.ts AGENTS.'
  land-mechanics | c770f365 | fleet/260825204003-e600 | docs/land-mechanics.md | read | 2026-08-25T20:43:06.381Z | 'for f in lane-brief-template.md scope-inflation.md knowledge-currency.md land-mechanics.md'
  land-mechanics | 36658d80 | fleet/260825213052-27b3 | docs/land-mechanics.md | read | 2026-08-25T21:31:23.139Z | 'for f in docs/container.md docs/land-mechanics.md docs/queue-analyst.md docs/suite-content'
  land-mechanics | 4a257283 | fleet/260826175851-f68e | docs/land-mechanics.md | read | 2026-08-26T18:27:46.271Z | 'grep -rn "verify.proportional\\|proportionale\\|Kurzkette\\|install+pins\\|install,pins\\|short'
  land-mechanics | d4342a62 | fleet/260904232513-0b9b | docs/land-mechanics.md | read | 2026-09-04T23:32:33.483Z | 'cp e2e-stage.sh "$TMPDIR/e2e-stage.sh.bak" 2>/dev/null; python3 - <<\'PY\'\nimport re, io\np ='
  land-mechanics | 457511cc | fleet/260907024635-0ee3 | docs/land-mechanics.md | read | 2026-09-07T02:51:22.275Z | 'python3 - <<\'EOF\'\nimport subprocess,json\npacks=[("portable-core",[("AGENTS.md","## Portabl'
  land-mechanics | 457511cc | fleet/260907024635-0ee3 | AGENTS.md ## Landing | read | 2026-09-07T02:51:22.275Z | 'python3 - <<\'EOF\'\nimport subprocess,json\npacks=[("portable-core",[("AGENTS.md","## Portabl'
  land-mechanics | e219d486 | fleet/260908004654-11d4 | docs/land-mechanics.md | read | 2026-09-08T00:55:16.738Z | 'grep -n "blocked\\|⏫\\|Guard\\|Ablehnung" docs/land-mechanics.md | head -30; wc -l docs/land-'
  land-mechanics | e219d486 | fleet/260908004654-11d4 | AGENTS.md ## Landing | read | 2026-09-08T00:55:22.585Z | 'grep -n "^## " AGENTS.md; echo ===; sed -n "$(grep -n \'^## Landing\' AGENTS.md | cut -d: -f'
  land-mechanics | a93aa054 | fleet/260914173834-1c2f | AGENTS.md ## Landing | read | 2026-09-14T17:39:17.626Z | "awk '/^## How a check is written/{f=1} /^## If you are a Codex/{f=0} f' AGENTS.md | wc -c;"
  task-queue | c3431136 | fleet/260821172714-5d3b | docs/plan-queue-refinement-2026-08-11.md | read | 2026-08-21T17:32:21.850Z | 'SCRATCH=/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260821172714-'
  task-queue | 5975ed5f | fleet/260831232000-145a | docs/plan-queue-refinement-2026-08-11.md | read | 2026-08-31T23:22:59.307Z | 'cd /Users/owner/claude-fleet.worktrees/fleet-260831232000-145a\nSP=/private/tmp/claude-5'
  task-queue | 15a3e38b | fleet/260902162622-dbae | docs/plan-queue-refinement-2026-08-11.md | read | 2026-09-02T16:47:07.689Z | 'grep -n "renderQueueDetail\\|qDetailSection" docs/plan-queue-refinement-2026-08-11.md docs/'
  task-queue | 457511cc | fleet/260907024635-0ee3 | docs/plan-queue-refinement-2026-08-11.md | read | 2026-09-07T02:51:22.275Z | 'python3 - <<\'EOF\'\nimport subprocess,json\npacks=[("portable-core",[("AGENTS.md","## Portabl'
  harness-adapter | c3431136 | fleet/260821172714-5d3b | docs/container.md | read | 2026-08-21T17:32:21.850Z | 'SCRATCH=/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260821172714-'
  harness-adapter | 96358ec5 | fleet/260822072719-8605 | server.ts const HARNESSES | read | 2026-08-22T07:28:18.855Z | "sed -n '340,370p' server.ts; echo ---; sed -n '450,470p' server.ts; echo --- ; rg -n 'CLAU"
  harness-adapter | 440ef7b9 | fleet/260822162835-53ca | docs/container.md | read | 2026-08-22T16:48:22.601Z | 'python3 - <<\'EOF\'\np=\'docs/harness-adapter.md\'; s=open(p).read()\nold="""    Pane. Tiefe: `d'
  harness-adapter | 440ef7b9 | fleet/260822162835-53ca | server.ts const HARNESSES | read | 2026-08-22T16:29:18.877Z | "grep -n 'bootSettleMs\\|readiness\\|acceptMarker\\|ready:\\|interface HarnessAdapter\\|type Har"
  harness-adapter | c770f365 | fleet/260825204003-e600 | docs/container.md | read | 2026-08-25T20:43:06.381Z | 'for f in lane-brief-template.md scope-inflation.md knowledge-currency.md land-mechanics.md'
  harness-adapter | 36658d80 | fleet/260825213052-27b3 | docs/container.md | read | 2026-08-25T21:31:23.139Z | 'for f in docs/container.md docs/land-mechanics.md docs/queue-analyst.md docs/suite-content'
  harness-adapter | d07ed0af | fleet/260830100019-18e9 | docs/container.md | read | 2026-08-30T10:03:22.749Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260830100019-18e9; grep -n 'context' docs/"
  harness-adapter | d07ed0af | fleet/260830100019-18e9 | server.ts const HARNESSES | read | 2026-08-30T10:02:14.976Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260830100019-18e9; grep -n 'const HARNESSE"
  harness-adapter | 261af293 | fleet/260830111659-bbcb | server.ts const HARNESSES | read | 2026-08-30T11:17:49.153Z | "grep -n 'HELPER_FRESH_MS' server.ts | head -3; grep -n 'HELPER_SWEEP_MS =' server.ts; grep"
  harness-adapter | 419e9ae3 | fleet/260902043025-8bbb | server.ts const HARNESSES | read | 2026-09-02T04:31:01.903Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260902043025-8bbb; rg -n 'slot_label|const"
  harness-adapter | 1b677e58 | fleet/260902051642-e0e3 | server.ts const HARNESSES | read | 2026-09-02T05:17:51.825Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260902051642-e0e3; echo '--- taskSpawnOf /"
  harness-adapter | c7259df1 | fleet/260902051742-41fb | server.ts const HARNESSES | read | 2026-09-02T05:18:48.950Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260902051742-41fb; grep -nE '^(export )?(t"
  harness-adapter | 8990eeb0 | fleet/260903062628-c5ef | docs/container.md | read | 2026-09-03T06:32:42.001Z | "cd /Users/owner/claude-fleet.worktrees/fleet-260903062628-c5ef\nsed -n '268,276p' docs/c"
  harness-adapter | ced51e9c | fleet/260905094251-8a52 | server.ts const HARNESSES | read | 2026-09-05T09:45:18.155Z | 'grep -n \'harness\' server.ts | grep -in \'codex\' | head -30; echo "=== HARNESSES ==="; rg -n'
  harness-adapter | d7d4bc8a | fleet/260905180822-c3e7 | server.ts const HARNESSES | read | 2026-09-05T18:10:24.037Z | "rg -n 'const (CLAUDE|PI|PI_ZAI|PI_OX|PI_UNFENCED|CONTAINER|CODEX)_HARNESS|^const HARNESSES"
  harness-adapter | 457511cc | fleet/260907024635-0ee3 | docs/container.md | read | 2026-09-07T02:51:22.275Z | 'python3 - <<\'EOF\'\nimport subprocess,json\npacks=[("portable-core",[("AGENTS.md","## Portabl'
  harness-adapter | 457511cc | fleet/260907024635-0ee3 | server.ts const HARNESSES | read | 2026-09-07T02:49:25.556Z | 'rg -n "estimatedBytes" *.ts e2e/*.ts src/*.ts | grep -v "context-pack" | head -20; echo "='
  harness-adapter | 05611418 | fleet/260907140524-b010 | server.ts const HARNESSES | read | 2026-09-07T14:14:02.118Z | 'cat > /tmp/w3e.py <<\'PY\'\nimport pathlib\np = pathlib.Path("server.ts"); s = p.read_text()\n\n'
  harness-adapter | b2f439fe | fleet/260912161659-de75 | server.ts const HARNESSES | read | 2026-09-12T16:33:46.411Z | 'python3 - <<\'PYEOF\'\np="server.ts"; s=open(p).read()\nanchor = \'\'\'// --- ↻ refine (briefs/ta'
  harness-adapter | a672b626 | fleet/260913003325-6a40 | server.ts const HARNESSES | read | 2026-09-13T00:36:17.308Z | "python3 - <<'EOF'\np='server.ts'\ns=open(p).read()\ndef rep(a,b,n=1):\n    global s\n    assert"
  harness-adapter | 353226bb | fleet/260913080623-293e | server.ts const HARNESSES | read | 2026-09-13T08:15:04.659Z | "python3 - <<'EOF'\np='server.ts'; s=open(p).read()\ndef rep(old,new):\n    global s\n    asser"
  harness-adapter | 4b474e5f | fleet/260913110228-4db7 | server.ts const HARNESSES | read | 2026-09-13T11:03:37.799Z | 'echo "=== types" && rg -n "^export interface Task \\{|^export interface TaskCard\\b|^export '
  harness-adapter | 4f033335 | fleet/260913183645-12cf | server.ts const HARNESSES | read | 2026-09-13T18:37:47.003Z | "wc -l server.ts; grep -n 'async function briefAndSend\\|function briefAndSend\\|^const LANE_"
  harness-adapter | bc974919 | fleet/260914081948-66bf | server.ts const HARNESSES | read | 2026-09-14T08:20:51.152Z | 'grep -n "^const MODEL_RE\\|MODEL_RE =\\|export const HARNESSES\\|^const HARNESSES\\|HARNESSES '
  harness-adapter | 87ed77cf | fleet/260917002851-2498 | server.ts const HARNESSES | read | 2026-09-17T00:39:07.639Z | 'grep -n "readiness:" server.ts | head; echo "=== HARNESSES ==="; sed -n "$(grep -n \'const '
  harness-adapter | c269023d | fleet/260917091723-7109 | server.ts const HARNESSES | read | 2026-09-17T09:17:51.388Z | 'echo "===adapters===" && rg -an --text \'automatable|HARNESSES|harness:|adapter\' server.ts '
```

# B-1 Sharpener — Worktrail Alternatives B: Vergleichsrahmen, Gegenhypothesen, Opus-Audit-Brief (2026-08-23)

Lane `fleet/260823094330-a291`, Program `644ae636…` (Worktrail Alternatives B), Act B-1. Precommit
VOR dem Opus-Audit: nichts gebaut, nichts entschieden. Jede Geschichts-Zelle trägt `file:line`
oder eine Ledger-Kennung; was ich nicht belegen konnte, steht als `unknown`.

Drei Etiketten wie in `docs/supervisor-succession.md`: **GEMESSEN** (Kommando hier ausgeführt),
**GELESEN** (Code-/Doc-Pfad in dieser Lane gelesen), **~GESCHÄTZT** (Rechnung, immer mit Tilde).

Program A (`194e1517…`, parallel, Slot 15) normalisiert eine Stichprobe zu JSON und auditiert die
Controller-Query-Kosten als eigenen Act. **Wo A's Artefakte die bessere Quelle sein werden, steht
hier ein Zeiger, keine Wiederholung** (§3, „A-Zeiger").

---

## 1. Precommitted comparison frame

Vokabular, fix vor dem Audit:

- **Controller** = die owner-seitige Steuersession im Fleet-Checkout
  (`~/.claude/projects/-Users-owner-claude-fleet/*.jsonl`); **Rail** = die bestehende typisierte
  Benachrichtigung (FleetEvent via `POST /api/self/watch`, Arten lane/merge/audit/transition,
  `docs/self-api.md:50-110`; Prädikat `lane-signals.ts:48-55`).
- **Beobachtete Fehlerklassen**, gegen die jede Zeile eine Kausalbehauptung machen muss:
  - **F1 Wiederholte Handlesungen:** GEMESSEN 2026-08-23, 24-h-Fenster, 17 Transcripts im
    Fleet-Checkout: 88 Bash-Aufrufe der Klasse „Slot/Session lesen" gegen 106 der Klasse
    „Entscheidung" und 338 sonstige (Kommando §3.3). Im selben Fenster feuerte der Rail 29×
    (`watch_fire`) und lieferte 34 FleetEvents (`audit.jsonl`, Fenster
    `1787391936069–1787478336069`).
  - **F2 Ergebnisse sterben mit dem Slot:** ein read-only-Lauf existierte nur als Result-Rail-Zeile
    und musste von Hand geerntet werden
    (`docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md:3-6`); `lane-outcomes.jsonl`
    hat in 454 Zeilen 0 Zeilen mit einem `report`-Feld (GEMESSEN).
  - **F3 Prädikat ≠ Bericht:** die Rail-Nachricht sagt selbst, dass mehrere Lane-Zustände für sie
    identisch aussehen (`lane-signals.ts:217-221`).
  - **F4 Kontextkosten liegen im Abruf, nicht in der Zustellung:** Brief 1 177–1 418 B, `register.sh`
    37 177 B, `supervisor-view` 18 539 B (`docs/supervisor-succession.md` §2-Tabelle, dort GEMESSEN).
  - **F5 Sonden-/Transportfehler, die wie Produktfehler aussehen:**
    `docs/messungen/acp18-fleet-frame-rot-2026-08-21.md:7-14` (Sonden-Rennen),
    `docs/messungen/acp21-prompt-annahme-2026-08-22.md:11-17` (2/7 Mehrzeiler-Sends bleiben im
    Composer).

| Ansatz | Fügt Fleet-Core hinzu | Kausalbehauptung über F1–F5 | Kosten: Kontext-Bytes je Controller-Turn · Engineering-Fläche | Rollback | Falsifikator (EINE Beobachtung) | Transfer GameDev/iOS |
|---|---|---|---|---|---|---|
| **JSON-first** (Program A) | Versionierte JSON-Kontrakte (TransitionEvent, WorkerReport, EvidenceEnvelope — `fleet.json` Program `194e1517` successCriterion), gespeichert oder projiziert (A openQuestion 2); Routen `unknown`, bis A liefert | F1+F2: Controller liest JSON-Stichproben statt Panes/`/api/sessions`; Worker-Ergebnisse überleben als Envelope | Bytes/Turn: `unknown` bis A's Query-Cost-Act (A-Zeiger). Fläche: 3 Schemata + Projektion/Speicher + Migration + Redaktionsstatus (A decisions 4) | Schema nicht promoten; bestehende Ledger unverändert (A: „no code or schema is promoted until a fresh critic can reproduce") | Eine A-Stichprobe, in der ein Kontrakt nur mit erzwungenen `null`-Feldern passt (A openQuestion 1, wörtlich) | `none` benannt; die Grok-Triangulation empfiehlt für Studios „avoid one JSON file per tick", ein Manifest statt Universalobjekt (untracked main-checkout note, 2026-08-22, Zeilen 68–69) |
| **Event-first** | Nichts Neues an Speicher: ein weiterer `FleetEvent.kind` oder ein Projektions-GET über das bestehende Event-Ledger (Kinds: `lane-ready`/`host-commit-ready` `server.ts:1633`, `fleet-report` `server.ts:1491`, `supervisor-transition` `504cb72`) | F1: jede Handlesung, die auf ein Event hätte warten können, ist ein fehlendes Event oder ein fehlendes Abonnement — nicht ein fehlendes Schema | Bytes/Turn: eine Event-Zeile (Nachrichtentext `lane-signals.ts:206-222`, ~600 B GELESEN) statt eines Polls. Fläche: ≤ 1 Route/Kind, Transport bleibt (`504cb72` Body: „no second ledger") | Kind entfernen; `watchFrom`/`fleetEventFrom` droppen unbekannte Zeilen fail-closed (`504cb72` Body) | Im Sample eine Handlesung, der KEIN existierendes oder ein-Kind-weit entferntes Event zuvorkommen konnte („was tut die Lane gerade" — F3 ist per Konstruktion keine Event-Frage) | Studio-MAIN wartet auf Worker-Events statt Panes zu lesen — private-repo-e/private-repo-c-Worker liefen in-session als `Agent`-Aufrufe (`docs/worktrail-audit-II-2026-08-19.md` [t],[h]); Transfer nur, wenn Studios als Fleet-Lanes laufen: `unknown` |
| **Receipt-first** | Eine Ledger-Projektion: `lane-outcomes.jsonl` (454 Zeilen; Felder `disposition`, `verified`, `repairRounds`, `review`) + `context-receipts.jsonl` (163; `deliveredBytes`) + `fleet-report` (`GET /api/self/fleet-report`, `server.ts:5902`) als EINE typisierte Quittung je Lane-Ende | F2: ein Ergebnis stirbt, weil die Quittung getrennt vom Outcome liegt; eine Zeile, die beides joint, macht Ernten überflüssig | Bytes/Turn: eine Zeile je Lane (~1,5 KB ~GESCHÄTZT aus 687 918 B / 454). Fläche: eine Projektion, kein Schreibpfad | Projektion abschalten; beide Ledger unverändert | Ein fleet-report im Sample, der NICHT gegen eine lane-outcomes-Zeile joinbar ist (`lane-outcomes` ist branch-keyed `server.ts:11830`, receipts session-shaped `server.ts:12265`) | Worker-Quittung = Studio-„state note" (Grok: ≤ 2k-Token state note, `docs/private-repo-e-worktrail-audit-2026-08-17.md:30-33`); Programm: Private-repo-e-Manifest-Muster (GLM-Review, `docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md`) |
| **State-machine** | Ein expliziter Lane-Zustandstyp (heute: sechs Prädikatklauseln `lane-signals.ts:48-55` + `awaiting` + `MergeLast`) mit erlaubten Übergängen; Route `unknown` | F3: die Zwillingszustände sind unterscheidbar, wenn Übergänge statt Level getrackt werden | Bytes/Turn: ein Zustandswort (~0,1 KB) statt Pane-Capture (`unknown`). Fläche: Zustandstyp, Übergangsvalidierung in Tick + allen Routen, Persistenz, Restart-Pfad (`71a271c`: ein Restart-Filter allein kostete 8 rote Checks) | Schwer: Zustände persistieren; Rückbau = Migration | Im Sample ein Zwillingszustand (F3), den die Maschine aus Fakten ebenfalls nicht trennen könnte („Suite läuft" vs. „wartet auf Owner", beide idle+clean+ahead>0) | `none` benannt; Studios haben 0/8 maschinelle Act-9-Sensoren (GLM-Review zitiert `2026-08-20-gamestudio-readiness`) — eine Maschine ohne Sensoren ist Prosa |
| **Supervisor-policy** | Nichts an Speicher: Policy-Zeilen im Supervisor-Brief/`supervisor-view` (`docs/supervisor-succession.md` §1.2, Brief bewusst ohne Rulebook) + ggf. Nudge-Regel (`POST /api/self/nudge`, §1.5) | F1+F4: der Supervisor hält die Portfolio-Sicht, der Controller fragt ihn statt der Sessions; Kosten wandern von Controller-Turns in einen Abruf der `supervisor-view` | Bytes/Turn: 18 539 B je `supervisor-view`-Abruf (§2) statt N× `/api/sessions` (Poll-Payload 131 KB laut untracked main-checkout note `NAECHSTE-SESSION.md`, 2026-08-19, Zeile 16 — nicht hier gemessen). Fläche: Text, 0 Routen | Brief-Zeile streichen | Im Sample ein Controller-Read, der NACH einem Nudge/Transition-Event trotzdem nötig war (`supervisor-view` trägt eine konstante `unknown`-Zeile, §1.4) | Studio-MAIN als Supervisor seiner Worker — ist der Ist-Zustand ([t]: 16 Agent-Aufrufe in EINER Session); Transfer = kein Transfer |
| **Do-nothing** | nichts | Der Rail existiert seit `5da9c4d`/`504cb72` und wird noch nicht abonniert; F1 ist Adoptionsverzug, kein fehlender Mechanismus | 0 neue Bytes; Fläche 0 | — | Eine 24-h-Messung, in der die Handlesungen NACH Rail-Adoption (Controller abonniert transition/lane-ready) nicht fallen | n/a |

`unknown`-Zellen sind Absicht: die Bytes/Turn-Spalte ist ohne A's Query-Cost-Act und ohne eine
`/api/sessions`-Messung aus einer Owner-Session nicht füllbar (eine Lane bekommt dort keine Antwort).

## 2. Counterhypotheses, precommitted

Je Ansatz der stärkste Grund, warum er SCHLECHTER als do-nothing ist — formuliert, bevor das
Audit Evidenz sammelt. Das Audit muss versuchen, jede zu BESTÄTIGEN.

1. **JSON-first:** Das Schema kostet sofort (3 Kontrakte, Versionierung, Redaktion, Migration —
   A decisions 4) und spart erst, wenn der Controller JSON statt Panes liest — aber F3 sagt, dass der
   Controller die Pane liest, WEIL das Prädikat nicht trägt; ein JSON über demselben Prädikat ändert
   daran nichts. Gefahr: ein universelles Objekt, das A selbst als Non-Goal führt („No universal
   Fleet JSON object").
2. **Event-first:** Jedes neue Event ist ein neuer Transport-Weg mit denselben Fehlermoden:
   `send-uncertain`, `receiver-gone`, 29 % verlorene Enter bei Mehrzeilern (ACP-21). Mehr Events =
   mehr Zustellungen, die still im Composer stehen bleiben können. Do-nothing hat diese Zustellungen
   schon; event-first vervielfacht sie.
3. **Receipt-first:** Die Quittung beschreibt das ENDE einer Lane; die Handlesungen (F1) passieren
   WÄHREND der Lane. Eine bessere Quittung senkt null Reads im Fenster, in dem sie anfallen. Und
   0/454 Outcome-Zeilen tragen heute einen Report — die Projektion joint vielleicht nichts.
4. **State-machine:** Die Zustände sind aus Pane-Fakten abgeleitet, die der Server nur per Capture
   sieht; eine Maschine über unvollständigen Sensoren erfindet Sicherheit (die Zwillinge F3 bleiben
   Zwillinge). Schwerster Rollback aller Kandidaten; `71a271c` zeigt, was ein einziger
   Restart-Filter kostet.
5. **Supervisor-policy:** Eine Policy-Zeile ist nicht durchgesetzt: die Supervisor-Session ist ein
   Modell, das eine Brief-Zeile liest (§1.2). Der Controller liest weiter, wenn er dem Supervisor
   nicht traut — und die `supervisor-view` trägt eine konstante `unknown`-Zeile (§1.4), die genau
   dieses Misstrauen rechtfertigt.

**Evidenz, die do-nothing BESSER machen würde** (Pflichtpunkt Program B; beide Messungen sind aus
den vorhandenen Quellen ausführbar, keine Behauptung):

- **M1 — Vermeidbarkeits-Quote der Handlesungen, aus den Trails, nicht asserted.** Für jeden der
  88 Reads im 24-h-Fenster (§3.3-Kommando, auf Transcript-Zeilen erweitert): Gab es zum
  Lesezeitpunkt ein armed Watch/Event des Controllers auf genau diesen Slot (`audit.jsonl`
  `watch_fire`/`fleet_event_delivered` mit `slot`), oder hätte `POST /api/self/watch` mit einer
  existierenden Art (`lane`, `merge`, `audit`, `transition`) die Frage beantwortet? Ergebnis als
  Bruch `vermeidbar-mit-heutigem-Rail / alle Reads`. **Liegt er ≥ 0,5, reicht der Rail und
  do-nothing gewinnt** über jeden Kandidaten, der denselben Rail nur umverpackt.
- **M2 — Zeit vom Rail-Event zur Handlesung.** Für jedes der 34 `fleet_event_delivered` im Fenster:
  Abstand (ms) bis zur nächsten Read-Zeile desselben Controllers auf denselben Slot. Median < 60 s
  ⇒ der Controller liest TROTZ Zustellung (F3; kein Mechanismus hilft ausser einem besseren
  Prädikat); Median hoch oder kein Read ⇒ der Rail ersetzt Reads bereits. Beides ist ein Argument
  für do-nothing gegen JSON-/Event-Vervielfachung.
- (M3, optional) **Ernte-Zähler:** wie viele `fleet-report`-Events im Fenster wurden per Hand in
  `docs/messungen/` geerntet (`grep -l 'fleet-report' docs/messungen/*.md`) vs. wie viele starben
  ungelesen (`fleet_event_receiver_gone`, 1 im Fenster). Ist die Zahl 1–2, ist F2 ein Einzelfall.

## 3. Source sample for the Opus audit (bounded, secret-free)

Schätzung ~Tokens = `wc -c / 4` (GEMESSEN 2026-08-23, mein Baum auf `512e0f2`).

### 3.1 Behalten — Leseordnung

| # | Quelle | Zeilen | ~Tokens | Warum |
|---|---|---|---|---|
| 1 | `docs/worktrail-B/B1-sharpener-2026-08-23.md` (diese Datei) | ganz | ~5 000 | Rahmen + Gegenhypothesen |
| 2 | `docs/self-api.md` | 1–110 | ~1 900 | der Rail, alle vier Watch-Arten; 55–110 = transition |
| 3 | `git show --stat 504cb72 71a271c 512e0f2` (Bodies, NICHT der Diff) | — | ~900 | Befund-Register: „no second ledger", Restart-Loch, Owner-Tür-Bypass |
| 4 | `lane-signals.ts` | 1–100, 206–222 | ~1 800 | done-looking/host-commit-looking; der Zwillings-Satz |
| 5 | `docs/supervisor-succession.md` | 1–190 (§1–§3.1) | ~3 200 | was ein Supervisor hat, was Abruf kostet (F4) |
| 6 | `docs/worktrail-audit-II-2026-08-19.md` | ganz (218) | ~4 100 | die 6×5-Tabelle + Fußnoten [s],[t],[u],[v] |
| 7 | `docs/worktrail-audit-II/private-repo-e.md` | ganz | ~2 950 | der EINE vollständig belegte Studio-Trail ([g]) |
| 8 | `docs/private-repo-e-worktrail-audit-2026-08-17.md` | 1–60, 228–264 | ~2 200 | „Look bleibt resident" + Adjudikation |
| 9 | `docs/studio-underwhelm-audit-2026-08-18.md` | 1–60 | ~1 000 | Gate-Ordnung als Ursache |
| 10 | `docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md` | ganz (29) | ~1 000 | F2-Beleg: Ergebnis nur als Rail-Zeile, handgeerntet |
| 11 | `docs/messungen/acp21-prompt-annahme-2026-08-22.md` | 1–20 | ~350 | Transport-Verlustrate (Gegenhypothese 2) |
| 12 | `docs/messungen/acp18-fleet-frame-rot-2026-08-21.md` | 1–14 | ~250 | Sonde-vs-Produkt-Muster (F5), nur die Kurzfassung |
| 13 | `audit.jsonl`, Fenster `1787391936069–1787478336069` (24 h bis 2026-08-23 ≈11:45 lokal), nur `event,slot,ts` | 855 Zeilen | ~8 500 | Rail-Feuer je Slot; Kommando §3.3 |
| 14 | Controller-Transcripts, dasselbe Fenster, NUR `tool_use`-Blöcke der Klassen read/decision (Kommando §3.3) | ≤ 194 Blöcke | ~15 000 | M1/M2; keine Prosa, keine Ergebnisse |
| 15 | `lane-outcomes.jsonl`, letzte 50 Zeilen, Felder `ts,branch,disposition,verified,repairRounds,sessionMs,review` | 50 | ~2 500 | receipt-first-Join-Probe |
| 16 | `context-receipts.jsonl`, Zeilen mit `programId:null && taskId:null` (Supervisor-Signatur) + 5 jüngste MAIN-Zeilen, nur `at,slot,deliveredBytes,selected` | ≤ 10 | ~500 | F4-Zahlen (GEMESSEN: 163 Zeilen, `deliveredBytes` 98–20 339, Mittel 5 311) |
| 17 | `fleet.json` → `programs[id∈{194e1517,644ae636}]` ohne `main` | 2 Objekte | ~1 400 | A/B-Wortlaut (Non-Goals, openQuestions) |
| 18 | untracked main-checkout notes, nur diese Zeilen: `GROK-ENGINE-EVIDENCE-TRIANGULATION-2026-08-22.md` 55–84; `NAECHSTE-SESSION.md` 1–30 (Stand 2026-08-19); `docs/product-studio-calibration-2026-08-22.md` 172–192 („Three smallest reversible experiments") | ~90 | ~2 000 | Transfer-Spalte; read-only via `/Users/owner/claude-fleet/<name>`, zitieren als „untracked main-checkout note, <Datum>", nie kopieren |

**Summe ~55 000 Tokens** — unter den 150k; der Rest ist Denk- und Schreibbudget, kein Leseauftrag.
Lieber eine zweite 24-h-Fenstermessung (M1 an einem anderen Tag) als mehr Prosa.

### 3.2 Gestrichen — und warum

- `docs/worktrail-audit-II/{private-repo-h,private-repo-c,private-repo-f}.md` (~8 500 Tokens): #6 zitiert
  jede Zelle mit Fußnote; nur bei Zweifel an einer Fußnote die eine Datei nachziehen.
- `docs/private-repo-e-worktrail-audit-2026-08-17.md` 62–227: Grok-Harness-Debatte, abgeschlossen
  (§„Resolution"); nichts über Fleet-Core-Mechanismen.
- `docs/studio-underwhelm-audit-2026-08-18.md` 61–146: Spielinhalt-Kriterien.
- `acp18` ab Zeile 15 (~4 700 Tokens): Sonden-Timing-Tabellen.
- `post-land-audits.jsonl` (1 072 813 B, 249 Zeilen, ~268k Tokens): zu gross, beantwortet keine
  F-Frage; der Audit-Ausgang ist als Watch-Art bereits typisiert (`kind:"audit"`).
- `dispositions.jsonl`: 2 Zeilen.
- `STAND.md` (untracked, 2026-08-21): ACP-Reihenfolge und Bindungsstand — operativ, kein Trail.
- `audit.jsonl` vor dem Fenster (≈6 000 Zeilen): `owner_auth_fail` 1 091 und `self_heal_recreate`
  1 148 dominieren; ein zweites Fenster ist M1-Replikation, nicht Lektüre.

### 3.3 Das Zählkommando (GEMESSEN, exakt so gelaufen)

**Negativbefund zuerst:** `audit.jsonl` protokolliert KEINE `/api/sessions`-Reads — seine 53
Event-Arten (GEMESSEN per `collections.Counter(r['event'])` über 6 854 Zeilen) enthalten keine
Lese-Ereignisse ausser `self_drift` (13 im Fenster, alle Lane-seitig). `server.log` hat 0 Zeilen
mit `/api/sessions`. **Der im Act-Brief gewünschte Zähler „reads per actor aus audit.jsonl" ist
mit diesem Ledger nicht zählbar**; zählbar ist dort nur die Rail-Seite (`watch_fire` 29,
`fleet_event_delivered` 34, `supervisor_nudge` 7 im Fenster, je `slot`). Die Read-Seite steht nur
in den Controller-Transcripts. Das ist selbst ein Befund für das Audit: **der Controller-Lesepfad
ist unbeobachtet — jeder Kandidat, der „Reads senken" behauptet, braucht zuerst diesen Sensor,
oder bleibt unfalsifizierbar.**

Seed-Zählung (Transcripts, Bash-`tool_use` je Session-Id-Präfix, Fenster = letzte 24 h ab
Laufzeit):

```
python3 - <<'PY'
import json,glob,os,re,time,collections
now=time.time(); lo=now-24*3600
D=os.path.expanduser('~/.claude/projects/-Users-owner-claude-fleet')
READ=re.compile(r'/api/sessions|/api/self\b|/api/programs|/api/slots/\d+(?!/)|/api/slots/\d+/(merge|screen|capture)|\./state\.sh|\./register\.sh|capture-pane')
DEC=re.compile(r'-X POST|curl[^\n]*-d |POST /api|send-keys|/api/slots/\d+/(send|kill|land|merge|commit|restart|watch|nudge|release|spawn)|/api/self/(nudge|watch|fleet-report|programs|attention|tasks)')
per=collections.defaultdict(collections.Counter)
for f in [f for f in glob.glob(D+'/*.jsonl') if os.path.getmtime(f)>=lo]:
    sid=os.path.basename(f)[:8]
    for l in open(f):
        try: r=json.loads(l)
        except: continue
        if r.get('type')!='assistant': continue
        try: t=time.mktime(time.strptime(r['timestamp'][:19],'%Y-%m-%dT%H:%M:%S'))+7200
        except: continue
        if t<lo: continue
        for b in r.get('message',{}).get('content',[]) or []:
            if b.get('type')!='tool_use' or b.get('name')!='Bash': continue
            cmd=json.dumps(b.get('input',{}))
            per[sid]['decision' if DEC.search(cmd) else 'read' if READ.search(cmd) else 'other']+=1
for s,c in sorted(per.items(),key=lambda kv:-sum(kv[1].values())): print(s,dict(c))
PY
```

Ergebnis 2026-08-23 (Fenster ≈ 2026-08-22 11:45 → 2026-08-23 11:45 lokal, 17 Transcripts):
**read 88 · decision 106 · other 338**; die drei grössten Sessions `af1e4b5d` 26/33,
`152cd7cc` 18/21, `6f10da3f` 12/23 (read/decision). Vorbehalte, die das Audit NICHT wegerklären
darf: (a) die Transcripts im Fleet-Checkout umfassen Controller UND Program-MAINs — Actor-Trennung
braucht die Slot-Bindung aus `fleet.json`; (b) `READ` zählt `/api/self` (eigene Zeile) mit — für M1
auf `/api/sessions|/api/slots/N|capture-pane|state.sh|register.sh` verengen; (c) `+7200` ist eine
Zeitzonen-Näherung; (d) ein `curl -d` in `DEC` kann ein GET mit Body sein. **A-Zeiger:** Program A's
Act 2 (Controller query cost) misst dieselbe Frage mit Payload-Bytes; liegt es vor, ersetzt es
diese Seed-Zählung — nicht umgekehrt.

## 4. Opus 5 (high) audit brief — verbatim, ready to file

```
[B-2 · OPUS DEEP AUDIT] Worktrail Alternatives B — does a simpler mechanism beat JSON at all?
Repo /Users/owner/claude-fleet. You are an Opus 5 (high) lane under Program 644ae636 (B).
Program A (194e1517) normalizes a sample into JSON in parallel — do NOT redo it; where A's
artifacts would be the better source, leave a pointer.

DELIVERABLE: docs/worktrail-B/B2-opus-audit-2026-08-23.md, committed in your lane. Sections, in
this order: (1) the comparison table; (2) counterhypothesis verdicts + M1/M2 numbers; (3) at
least THREE materially distinct SIMPLE mechanisms; (4) what I did NOT read; (5) verify tail.

READ FIRST, in this order (all bounded; ~55k tokens; estimates and drop-list in B1 §3):
docs/worktrail-B/B1-sharpener-2026-08-23.md (whole) → docs/self-api.md:1-110 → git show --stat
504cb72 71a271c 512e0f2 (bodies only) → lane-signals.ts:1-100,206-222 →
docs/supervisor-succession.md:1-190 → docs/worktrail-audit-II-2026-08-19.md (whole) →
docs/worktrail-audit-II/private-repo-e.md → docs/private-repo-e-worktrail-audit-2026-08-17.md:1-60,228-264
→ docs/studio-underwhelm-audit-2026-08-18.md:1-60 →
docs/messungen/2026-08-23-glm-decision-review-umbra-afterimage.md →
docs/messungen/acp21-prompt-annahme-2026-08-22.md:1-20 →
docs/messungen/acp18-fleet-frame-rot-2026-08-21.md:1-14 → ledgers in the MAIN checkout
(/Users/owner/claude-fleet/, gitignored — grep/python3, never rg): audit.jsonl window
1787391936069–1787478336069, fields event,slot,ts; lane-outcomes.jsonl last 50 rows
(ts,branch,disposition,verified,repairRounds,sessionMs,review); context-receipts.jsonl rows with
programId:null&&taskId:null + 5 newest (at,slot,deliveredBytes,selected); fleet.json
programs[194e1517,644ae636] without `main` → Controller transcripts
~/.claude/projects/-Users-owner-claude-fleet/*.jsonl, same window, ONLY tool_use blocks of
class read/decision via the B1 §3.3 command → untracked main-checkout notes, read-only by
absolute path, cite as "untracked main-checkout note, <date>", never copy:
GROK-ENGINE-EVIDENCE-TRIANGULATION-2026-08-22.md:55-84, NAECHSTE-SESSION.md:1-30,
docs/product-studio-calibration-2026-08-22.md:172-192. Nothing else unless a cited footnote is
in doubt — then only the one source file it names. No full transcripts. No secrets: never print
a process command line unfiltered, never paste token values; from ledgers quote paths and ids
only.

(1) MANDATORY OUTPUT TABLE — rows exactly: JSON-first, event-first, receipt-first,
state-machine, supervisor-policy, do-nothing. Columns exactly: adds to Fleet core (files/routes
named or "nothing") · causal claim about F1–F5 (B1 §1 definitions) · cost (context bytes per
Controller turn AND engineering surface) · rollback · falsifier (one observation) · GameDev/iOS
transfer (named product program or "none"). Start from B1 §1 and CORRECT it: every history
cell cites file:line or a ledger row id/ts; a cell you cannot source says `unknown`. Mark each
cell you changed from B1 and why.

(2) COUNTERHYPOTHESES — B1 §2 lists five "worse than do-nothing" claims. Try to CONFIRM each
against yourself; verdict confirmed/refuted/unknown with the ONE observation that decided it.
Then run M1 and M2 exactly as B1 §2 defines them (avoidable-read fraction; ms from
fleet_event_delivered to the next read on the same slot) and report numbers, window, command,
and the actor caveat (Controller vs Program-MAIN via the fleet.json binding). If M1 ≥ 0.5 or M2
shows reads not following deliveries, say plainly that do-nothing wins for F1.

(3) THREE SIMPLE MECHANISMS, materially distinct, each ≤ ONE route OR ONE ledger projection OR
ONE policy line. For each: name · source-linked causal evidence (which F, which file:line /
row) · cost (bytes per turn computed from a NAMED file with the command shown; surface in
routes/lines) · rollback · falsifier · GameDev/iOS transfer (named program or "none"). A
mechanism orthogonal to JSON standardization counts double; JSON with different prose counts
zero. Say for each whether it belongs in a reusable ContextPack rather than Fleet core.

PROHIBITED: plugin, universal-harness, or multi-agent-hierarchy proposals; popularity or
"industry standard" arguments; any token/byte number not computed from a named file; any
"reads will drop" claim that does not address the B1 §3.3 negative finding (the Controller read
path has no sensor — audit.jsonl and server.log log zero /api/sessions reads); implementation,
schema, or server change; reading every transcript; ps output; secrets.

(4) "WHAT I DID NOT READ" is mandatory: every sample item skipped or truncated, and every claim
that rests on a doc rather than code.

LANE DISCIPLINE: read before claiming, cite file:line; rg for tracked code, grep -n for
gitignored ledgers, `git show main:<path>` for docs newer than your fork; no graphify. Commit
the one file; no untracked files; no suite needed — verify = `bun e2e/pins.ts` (tail must pass)
+ `git status --porcelain` empty. Before the done report:
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<fleet-host>:8790/api/self/drift —
rebase if wouldConflict:true. Report only the slice, ≤ 25 lines: path, the six table rows one
line each, the three mechanisms one line each, M1/M2 numbers, verify tail quoted, anything
unresolved.
```

## 5. What I did not check

- Keine Pane gelesen; keine Owner-Route (`/api/sessions`, `/api/programs`, `supervisor-view`)
  aufgerufen — eine Lane bekommt dort 409; die 131-KB-Poll-Zahl ist aus der untracked note zitiert,
  nicht gemessen.
- Program A's laufende Artefakte (Slot 15) nicht gelesen — nur der Program-Wortlaut aus `fleet.json`.
- `post-land-audits.jsonl` nicht geöffnet (Grösse); `audit.jsonl` nur im 24-h-Fenster gezählt.
- Die drei Studio-Quelldateien `private-repo-h/private-repo-c/private-repo-f.md` nur über die Fußnoten von
  `docs/worktrail-audit-II-2026-08-19.md` gelesen.
- M1/M2 nicht ausgeführt — sie sind der Auftrag des Audits; die Seed-Zählung in §3.3 ist bewusst
  grob (Vorbehalte a–d).
- Die Transfer-Spalte beruht auf Docs (Grok-Triangulation, GLM-Review, Private-repo-e-Audit), nicht auf
  Studio-Code.

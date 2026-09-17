---
frage: Welche Owner-Entscheidungen sind als Daten vorhanden, welche Fragen blieben im letzten abgeschlossenen Vierzehntagefenster liegen, und was kann ein letzter Entscheid-Agent daraus beantworten?
urteil: Zehn needs-main-Reports betreffen nur zwei Aufgaben; 29 rote Audits sind unbeurteilt und vier Richtungen ohne Program. Diese Mengen sind keine bewiesenen Owner-Fragen; historische Beantwortbarkeit bleibt weitgehend unbekannt, und die vorhandenen Herkunftsfelder trennen Mensch und Agent nicht sicher.
bereich: [owner-entscheidungen, autonomie, quellen, rueckstau]
belege: [fleet.json, fleet-reports.jsonl, audit-adjudications.jsonl, post-land-audits.jsonl, lane-outcomes.jsonl, streams/prompts.jsonl, dispositions.jsonl, HANDOFF.md, docs/queue-analyst.md]
nicht-gemessen: Vollstaendige historische Owner-Warteschlange; geloeschte oder rotierte Daten; Transkriptinhalte; menschliche Lesezeit; autorisierte autonome Entscheidung; historische Verfuegbarkeit unversionierter Memory-Dateien
stand: 2026-09-17
---

# Owner-Entscheid-Schicht: zuerst die fehlende Herkunft klaeren

Messfenster **[2026-09-03 00:00, 2026-09-17 00:00) UTC**, die letzten abgeschlossenen Kalendertage; gelesen am 17.09. ab 15:37 UTC. JSONL-Ereignisse werden zum Fensterende gefiltert, `fleet.json` ist dagegen ein spaeterer, veraenderlicher Snapshot. Dessen offene Objekte aus dem Fenster ergeben keinen historischen Zustand zum Fensterende. Alter bedeutet dort Mindestalter bis Fensterende, nicht bewiesene ununterbrochene Wartezeit. Anhang A–C erzeugen die Zahlen; spaetere Live-Laeufe duerfen wegen Retention und Zuwachs abweichen.

## 1. Inventur

„Maschinenlesbar“ meint die Struktur, nicht gesicherte Bedeutung oder Autoritaet. Leser sind belegte Codepfade bzw. Dokumentleser; tatsaechliche Lesezugriffe einzelner Sessions wurden nicht gemessen. Private Quellen werden nur anonymisiert paraphrasiert. Keine Transkripte wurden indexiert oder inhaltlich ausgewertet; beim Promptstrom wurden nur Zeit und Quelle gezaehlt.

| Quelle | Was dort entschieden steht | Zeilen/Zeitraum, jeweils Bestand / Fenster | Maschinenlesbar | Wer liest es heute / Beleg |
|---|---|---|---|---|
| `fleet.json tasks[]` | Richtung, Notiz, Brief, Freigabe, Kommentare; pending ist kein offener Entscheid | 200 / 158 Objekte; 02.–17.09.; Bestand 41 notiz, 11 richtung; Fenster 35/10 | ja; Entscheidinhalt Freitext | Queue/Briefpfad; `docs/queue-analyst.md:47` |
| `fleet.json programs[]` | Bestaetigung, Promotion, Release-Policy, decisions, openQuestions | 71 Programs; 70 bestaetigt, 40 Promotionen, 3 Release-Policies; 323 Entscheidungsstrings in 66, 175 Fragenstrings in 57 Programs; Einzelzeit der Strings unbekannt | ja, Strings ohne eigene Provenienz | `server.ts:2063`, `server.ts:2233`, `server.ts:10503` |
| `fleet.json attentionRequests[]` | Antwort und Schliessstatus an MAIN, auch Verweigerung | 20 / 20; 08.–15.09.; 14 answered, 6 refused | ja, Antwort Freitext | Owner-Ansicht und Program-Inbox; `server.ts:11130`, `server.ts:11166` |
| `fleet.json clarifications[]` | Frage an MAIN, Antwort oder Weitereskalation | 13 / 9; 15.08.–14.09.; Fenster alle answered | ja, Antwort Freitext | gebundene Beteiligte; `server.ts:8231`, `server.ts:31915` |
| `fleet.json fleetReports[]` | Resultat plus disposition; Empfaenger bestimmt Zustaendigkeit | 121 / 98; erhaltener Bestand erst ab 15.09. | ja | Owner-Ansicht; `server.ts:8262`, `server.ts:9034` |
| `fleet-reports.jsonl` | open und decision mit id, disposition, by, reason | 375 / 312; 14.–17.09.; vor Beginn dieses Ledgers kein Vollnachweis | ja | Schreiber `server.ts:8397`; Live-Ansicht liest Objektbestand, nicht diese Historie |
| `audit-adjudications.jsonl` | Urteil, Begruendung, Urheber, auditAt; auch getragene Maschinenregel | 190 / 83; 06.08.–17.09.; Fenster 42 flake, 15 unknowable, 17 stale-test, 9 real | ja | letzter Eintrag je auditAt; `server.ts:21518`, Anzeige `src/client.ts:10674` |
| `post-land-audits.jsonl` | Messergebnis, noch KEIN Entscheid; Gegenmenge zum Urteil | 714 / 261; 25.07.–17.09.; Fenster 159 green, 87 red, 15 unknown | ja | Audit-/Reportprojektion; `server.ts:9177` |
| `lane-outcomes.jsonl` | ownerPrompts und confirmedByHuman: Eingriffs-/Bestaetigungsdaten, keine Antwort | 1095 / 351; 24.07.–17.09.; Fenster Prompts-Summe 104, Feld fehlt 2; Bestaetigung true 7 / false 342 / fehlt 2 | ja | Ergebnisansicht `src/client.ts:10267`, `src/client.ts:10290` |
| `streams/prompts.jsonl` | Inhalt absichtlich ungelesen; source=owner ist nur Zaehler | 15064 / 5399; 05.07.–17.09.; owner 1992 / 667 | Metadaten ja | bestehender Zaehler `server.ts:22129`; nicht als Antwortquelle verwendet |
| `dispositions.jsonl` | explizite Owner-Disposition zu beratenden Ausgaben | 2 / 0; 25.07. und 06.08.; beide ignored | ja | API-Leser `server.ts:22898` |
| `HANDOFF.md`, Git-Historie | offene Gabeln und nachgetragene Antworten; Kopien ohne Frage-ID | 252 Aenderungscommits im Fenster, 177 Abschnittsvorkommen / 16 verschiedene Prosa-Zeilen; keine Fragezahl | nein | menschliche/agentische Dokumentleser; keine automatische Erledigung nachgewiesen |
| private `memory/feedback-*.md` | Vorgaben samt Warum; sekundaere Aufzeichnung, kein Autorisierungsbeweis | 31 Dateien / 785 Zeilen; alle mit Why/Warum; 22 modified-Felder, 26.07.–15.09. | Markdown teilweise | harnessabhaengige Leser; Codex-AGENTS-Loader laedt diese Quelle nicht automatisch |
| `docs/messungen/*.md` | urteil ist oft Agentenbefund, nicht Owner-Entscheid | 198 Dateien; 155 mit Anfangsfrontmatter urteil (zusammen 34484 Zeilen), 43 ohne | teilweise | Index fuer Dokumentleser; `docs/messungen/INDEX.md:21` |
| `git log --grep=Owner` | Committexte mit Owner-Bezug; Treffer beweist keine Freigabe | 319 Commits im Fenster | Metadaten ja, Inhalt nein | Git-/Dokumentleser |

**Fuer Retrieval entscheidend:** Die ausdrueckliche Entscheidnotiz `docs/messungen/2026-09-11-host-aufteilung-entscheid.md:3` besitzt kein urteil-Frontmatter und faellt aus einem solchen Scanner heraus. Drei Memory-Beispiele mit Warum: `feedback-astra-effort-medium.md:11` begruendet den Aufwandstandard mit Kosten/Nutzen; `feedback-handle-operational-cleanup-proactively.md:11` trennt abgesicherte Bereinigung von neuer Richtungswahl; `feedback-repeat-audit-red-starts-repair-now.md:11` trennt Reparaturbeginn von Adjudikation. Das sind sekundaere Aufzeichnungen, keine hier erteilten Vollmachten.

Weitere vorhandene Felder: `tasks[].card` bei 134, `brief` bei 20, `releasedBy` bei 97 und `verdicts` bei 4 Objekten (A). Kartenvaliditaet ist keine Owner-Bestaetigung; weder Program-Entscheidungsstrings noch Frontmatter-Urteile duerfen ungeprueft in bindende Praezedenz umgedeutet werden.

**Kosten der Herkunftsluecke:** `attentionRequests[id=06574f9d…].answer.by` und `[id=41448dfe…].answer.by` lauten owner, obwohl der Antworttext Agententscheidungen beschreibt. `server.ts:11166` schreibt den Wert konstant. Ein blindes Retrieval wuerde eine Agentenbehauptung zur menschlichen Erlaubnis aufwerten.

## 2. Haengende Fragen im Fenster

Es gibt keine belegbare gemeinsame Menge „am Owner haengen geblieben“. Die Quellen enthalten Ereignisse, kopierte Fragen, technische MAIN-Arbeit und neue Freigaben. Die folgenden Populationen werden deshalb **nicht addiert**; Clarification, Attention und HANDOFF koennen dasselbe Anliegen tragen. Abwesende historische Objekte sind unbekannt, nicht erledigt. Der heutige Zustaendigkeitsabgleich nach `server.ts:8262` ergibt **98/98 erhaltene Fensterreports mit lebender Program-MAIN, 0 Owner-zustaendig** (A). Bei basis=program gilt die aktuelle Program-Bindung, nicht receiver=null; zehn needs-main sind daher heute nicht nachweislich am Owner blockiert. Kontrollen: `fleet.json fleetReports[id=82b06c1e4266a23d49adfbfc]`, `2e0b2bff842d7f799c7b11c3`, `0c3c1617b58320fafaa752d0`, jeweils ueber provenance.programId → aktives Program.main → Slot mit passender openedAt und cwd; keine decision.

| Art und Auswahl | Anzahl | Median-Liegezeit/Alter | Anteil aus frueheren Entscheidungen beantwortbar gewesen |
|---|---:|---|---|
| Clarifications: im Fenster angelegt, heute nicht terminal | 0 von 9 erhaltenen | nicht definiert; Schlusslatenz der Kontrollen 1,125 min | nicht definiert fuer leere offene Menge; Kontrollen historisch unknown |
| Attention: im Fenster angelegt, heute nicht terminal | 0 von 20 erhaltenen | nicht definiert; Schlusslatenz inkl. refused 231,004 min | nicht definiert; neue Promotion nicht aus alter Erlaubnis ableitbar |
| needs-main: open-Ereignis im Fenster, keine decision bis Ende | 10 von 20, nur 2 taskIds; 8 Wiederholungen derselben Voraussetzung | 32,277 h seit Meldung; keine bewiesene Owner-Wartezeit | unknown; fehlende Integration ist keine Entscheidung, die ein Text beantworten kann |
| Rote Audits: result=red im Fenster, kein auditAt-Urteil bis Ende | 29 von 87; bei Lesen weiterhin ohne Urteil | 59,680 h seit Audit | unknown; gleiche Fehlersignatur beweist keine gleiche Ursache |
| Richtungen ohne Program: im Fenster angelegt, heute nicht done/archived | 4 von 10 Richtungen | Mindestalter 5,068 d | belegt voll beantwortbar 0/4; 3/4 verlangen neue Freigabe, 1/4 unknown; keine gemessene Automatisierungsquote |
| HANDOFF: wiederholte offene Prosa | historische Gesamtzahl eindeutiger Anliegen unknown | unknown; erste Sichtung ist nicht askedAt | Stichprobe 1/3 inhaltlich heute beantwortbar; historische Verfuegbarkeit unknown, keine Hochrechnung |

**Stichproben mit Beleg.** Bei leeren offenen Populationen folgen ausdruecklich terminale Kontrollen, keine erfundenen offenen Beispiele. „unknown“ bleibt eine Antwortbarkeitsluecke, nicht 0 Prozent.

- **Clarifications, Kontrollen:** `fleet.json clarifications[id=6fdbbddd39d95400a650d734]`: Suitefenster, beantwortet mit bestehendem Mutex; `a4ed9c3f9a0971d2f2d1d0b4`: Kapazitaet hebt Mutationsnachweis nicht auf; `688fb9e130efae85b3b1e6b7`: Knopf-Flaeche an Attention weitergereicht. Beleg jeweils `question/answer.text/status/askedAt/closedAt`. Alle answered; das letzte Beispiel ist dadurch noch nicht sachlich entschieden. Vorherige Wissensverfuegbarkeit fuer alle unknown.
- **Attention, Kontrollen:** `987b10c4c617ae0ef1844300`: Antwort erteilt neue Promotion, nicht vorab ableitbar; `06574f9d0a98733eb38b14cc`: konkrete Knopf-Flaeche agentisch gewaehlt, behauptete Vorregel nicht nachgewiesen; `41448dfe75999cbb029be767`: Reparatur und Flaechenbestaetigung berichtet, nachfolgende Arbeit statt vorbestehender Antwort. Beleg `fleet.json attentionRequests[id].text/answer/status`; letzte beide historisch unknown.
- **needs-main:** `fleet-reports.jsonl:122` (`2e0b2bff…`) und `:124` (`0c3c1617…`) melden dieselbe fehlende Integration; `:303` (`caee563c…`) empfiehlt Promotion bei ungeklaerter Testentlastung. Keine passende fruehere Erlaubnis nachgewiesen, daher alle unknown; die ersten beiden sind zudem MAIN-Arbeit. Acht Wiederholungen kosten Aufmerksamkeit, sind aber keine acht unterschiedlichen Entscheidungen.
- **Audit:** `post-land-audits.jsonl:619` (`at=1789375381366`), `:620` (`1789377403640`), `:622` (`1789380143592`) tragen dieselbe Retry-Clarification-Signatur, jeweils einen gefallenen Check. Ohne kausale Entlastung alle unknown. Am 14.09. sind 13 Audits rot, 11 unbeurteilt, die Signatur erscheint sechsmal ohne Urteil. „Null Adjudikationen am Tag“ stimmt nicht: `audit-adjudications.jsonl:185–186` enthalten zwei unknowable-Urteile zu anderen Audits; fuer die genannte Folge stimmt null (B).
- **Richtungen, Vollerhebung:** `fleet.json tasks[id=233ee108]` Prozessgestaltung: Variantenwahl unknown; `0694cb78` Dokumentationskosten: proportionale Verify-Regel beantwortet den Suite-Teil, nicht die neue Architekturwahl; `3d5ee33f` Program-Lesesicht und `6ec7ab69` Kontextattribute: jeweils ausdruecklich keine Beauftragung ohne neue Freigabe. Beleg je `text/kind/status/programId/created`. Letzte drei koennen nicht durch Wiedergeben einer alten Entscheidung freigegeben werden.
- **HANDOFF:** `HANDOFF.md@8498c306:5557` haelt die Aufwandseinstellung offen; `memory/feedback-astra-effort-medium.md:11` liefert medium als Vorgabe. `HANDOFF.md@604facbf:25` fragt nach der Knopf-Flaeche; `memory/feedback-pin-the-surface-before-building.md:38` liefert nur eine Methode, keine konkrete Wahl. `HANDOFF.md@ca26435c:14` laesst den Testbeginn von einem nicht operationalisierten Systemzustand abhaengen; kein Antwortkriterium gefunden. Ergebnis 1/3 inhaltlich heute beantwortbar, bei allen historische Verfuegbarkeit unknown; keine bewiesene damalige Antwortquote.
- **Program-Fragen:** Keine nachtraegliche Einordnung aller undatierten Strings in das Fenster; diese Inventarreserve wird nicht als weitere Art zeitlich belegten Rueckstaus ausgegeben. Inhaltliche Vollpruefung ausstehend.

## 3. Entwurf: letzter antwortender Agent

**Eingang:** Eine benannte Frage mit Objekt-ID, Empfaenger, Program/Repo-Geltung, Fragezeit und bisherigem Antwortversuch. Er liest nur ungeklaerte Clarifications, Attention, needs-main, Audit-Anliegen und Richtungsfragen, nachdem die zustaendige MAIN ihre eigene Zustands-/Belegpruefung ausgeschoepft hat. Keine periodische Neubewertung jeder Queue-Zeile; kein Startblocker.

**Quellen:** Die Inventur, zuerst datierte und zum konkreten Scope passende bestaetigte Program-Policies und Entscheidungen, dann belegte Antworten/Adjudikationen; Messnotizen, Committexte und Memory als nachzupruefende Hinweise. Prompt-/Outcome-Zaehler bleiben Messdaten, keine Antwortbelege. Originaltext wird nur gezielt geladen, keine Transkript-Suche. `by=owner`, ein Memory-Why oder urteil allein genuegt nicht. Neuere gegenteilige Entscheidung und Widerruf werden mitgesucht.

**Antwortregel:** Antwort nur dann als „aus vorhandenem Entscheid abgeleitet“ ausgeben, wenn Quelle, Autoritaet, Datum vor Frage, Geltungsbereich und noch gueltige Voraussetzungen konkret belegt sind und keine gelesene Quelle widerspricht. Technischen Rueckstand als solchen an MAIN zurueckgeben; eine fehlende Integration, neue Promotion oder ungepruefte Testursache wird durch Denken nicht vollzogen. Anfaenglich nur Antwortentwurf an den vorhandenen Empfaenger; keine neue Schreib-, Freigabe-, Adjudikations- oder Landbefugnis.

**Pruefbare Eskalationsregel:** Fehlt einer dieser Belege, widersprechen sich passende Quellen oder erfordert die Antwort neue Befugnis, lautet der Ausgang `escalate`, mit genau benannter Luecke und Owner als Entscheidungsadressat; `answer` ist dann ein Regelverstoss. Dieselben Faelle werden per questionId zusammengehalten. Eine empfangsbestaetigte Rueckgabe muss ueber einen bestehenden adressierten Kanal laufen; fehlt er, bleibt Zustellung unknown, statt Text in eine beliebige Session zu injizieren.

**Konflikt, nicht entschieden:** `memory/feedback-owner-out-of-eval-loop.md:15` empfiehlt Defaults statt Owner-Rueckfrage bei Bewertungsunsicherheit; dieser Brief verlangt Eskalation im Zweifel. Die Memory ist sekundaer, eine neue allgemeine Delegation ist nicht nachgewiesen. Der Entwurf folgt dem Brief und laesst jede spaetere Lockerung dem Owner; er behauptet daher noch keine vollstaendige Entlastung.

**Ledger jeder Antwort:** append-only `questionId`, Quellobjekt/Version, Frage-/Antwortzeit, Scope, Quellenanker und Hash, damalige Verfuegbarkeit, belegte Autoritaet, Voraussetzungen/Gegenbelege, `answer|return-main|escalate|unknown`, Antwort/Begruendung, verantwortlicher Akteur, Empfaenger und Zustellquittung. Korrekturen verweisen auf den Vorgaenger; urspruengliche Auditergebnisse bleiben unveraendert. Keine Namen, geheimen Inhalte oder Transkripte in oeffentlichen Belegen.

**Messung:** Owner kippt eine Antwort ⇒ Fehlerfall mit alter/neuer Aussage und Grund. Fehlerrate = gekippte / ausdruecklich vom Owner gepruefte Antworten derselben Kohorte; zusaetzlich Pruefabdeckung = gepruefte / ausgegebene Antworten und untere Fehlergrenze = gekippte / ausgegebene. Schweigen ist kein richtiges Urteil. Historische Wiederholung mit Quellenstand vor Frage misst Ableitbarkeit; spaetere Korrekturen, Nacharbeit und Wiedereroeffnung pruefen Nutzen. Kein blockierender Verdict-Mechanismus, auch nicht nach Kalibrierung.

**Abgrenzung in drei Saetzen:** Der Analyst bewertete dispatchbare Zeilen und wurde nach ausbleibendem Betrieb wegen seiner Fehlalarme entfernt (`docs/queue-analyst.md:13–40`). Das Eval-Gate hatte keine tragfaehige Population und beruehrte Starts, waehrend dieser Agent nur konkrete liegengebliebene Fragen beantwortet (`docs/queue-analyst.md:38`). Er erteilt weder ready noch Release und darf keine Starts an sein Urteil koppeln.

**Nachbar c64bcb62:** Heute nicht im Taskbestand (A); `docs/arbeitsfolge-fleet-2026-09-11.md:192` beschreibt den strukturierten Session→Controller-Verweis, `docs/messungen/2026-09-14-backlog-aufraeumen.md:79` markiert die Idee als ueberholt durch adressierte Nachrichten. Das ist ein dokumentierter Verlauf, kein Beweis einer aktuell zustaendigen Controller-Tuer. Der Entwurf verwendet Referenzen und Quittungen; er belebt keine alte Freitext- oder Notify-Tuer ungeprueft wieder.

## 4. Ausgang: vorgeschlagene Auftraege, kleinster zuerst

- **Provenienz messen.** ROLLE: codex/gpt-6-astra/medium; GROESSE: klein; FLAECHE: NEU `docs/messungen/owner-antwort-provenienz.md`; VERIFY: `bun e2e/pins.ts` plus dokumentierter Vergleich Quellautor gegen Rollenstempel; DONE: jeder untersuchte Antworttyp hat einen belegten Autoritaetsnachweis oder unknown, samt drei widersprechenden Kontrollen; keine Datenmutation.
- **Historische Antwortprobe.** ROLLE: codex/gpt-6-astra/medium; GROESSE: mittel; FLAECHE: NEU `docs/messungen/owner-antwortprobe.md`; VERIFY: `bun e2e/pins.ts` plus datierter, nachrechenbarer Quellenvergleich; DONE: Fragen vorab ausgewaehlt, Quellen nach Fragezeit ausgeschlossen, Antwort/Eskalation und spaetere Owner-Korrektur getrennt gezaehlt, mindestens ein fehlender und ein widersprechender Beleg erzwingen Eskalation.
- **Rueckweg spezifizieren.** ROLLE: codex/gpt-6-astra/medium; GROESSE: mittel; FLAECHE: NEU `docs/messungen/owner-antwortweg.md`; VERIFY: `bun e2e/pins.ts` plus Route-/Empfaenger-Matrix am aktuellen Code; DONE: je Frageart belegter Eingang, bestehender Empfaenger und quittierter Rueckweg oder benannte Luecke; keine neue Startbedingung, keine Umsetzung oder Promotion durch diese Notiz.

## Anhang: Kommandos fuer alle Zahlen

A zaehlt Snapshot-Objekte, B JSONL-Ereignisse, C Dokumente und Historie. Stichproben sind gezielte Feldlesungen der oben genannten IDs/Zeilen; die manuelle Richtungsklassifikation ergibt sich aus den vier aufgefuehrten Faellen. Tageszahlen gelten UTC. Private Inhalte erscheinen nicht in der Kommandoausgabe. Die reproduzierbare Auswahl ersetzt keine archivierten Snapshots; deren Fehlen begrenzt spaetere exakte Wiederholung.

A — Snapshot

```sh
MAIN=$(dirname "$(git rev-parse --git-common-dir)") python3 - <<'PY'
import json,os,collections,statistics
x=json.load(open(os.environ['MAIN']+'/fleet.json'));S=1788393600000;E=1789603200000
for k,t in [('tasks','created'),('attentionRequests','raisedAt'),('clarifications','askedAt'),('fleetReports','reportedAt')]:
 a=x[k];w=[z for z in a if S<=z[t]<E]
 print(k,len(a),len(w),'span_ms',min(z[t] for z in a),max(z[t] for z in a),'status',dict(collections.Counter(z.get('status') for z in w)))
 if k=='tasks':
  print('kinds_all',dict(collections.Counter(z['kind'] for z in a)),'kinds_window',dict(collections.Counter(z['kind'] for z in w)))
  for kind in ['richtung','notiz']:
   b=[z for z in w if z['kind']==kind and z['status'] not in ['done','archived']];print(kind,'nonterminal',len(b))
  o=[z for z in w if z['kind']=='richtung' and not z.get('programId') and z['status'] not in ['done','archived']]
 elif k=='fleetReports':o=[z for z in w if z['status']=='needs-main' and not z.get('decision')]
 else:
  o=[z for z in w if z['status'] not in ['answered','refused']]
  print('closed_median_minutes',statistics.median((z['closedAt']-z[t])/60000 for z in w if z.get('closedAt')))
 print('candidate_open',len(o),'median_min_age_days',statistics.median((E-z[t])/86400000 for z in o) if o else None,'ids',[z['id'] for z in o])
for key in ['confirmedAt','promotion','release','decisions','openQuestions']:
 a=[z[key] for z in x['programs'] if z.get(key)];print('programs',len(x['programs']),key,len(a),'list_entries',sum(len(v) for v in a if isinstance(v,list)))
for key in ['card','brief','releasedBy','verdicts']:
 a=[z[key] for z in x['tasks'] if z.get(key)];print('tasks',key,len(a))
print('c64bcb62',any(z['id']=='c64bcb62' for z in x['tasks']))
pmap={p['id']:p for p in x['programs']}
def live(r):
 if r.get('basis')=='program':
  p=pmap.get((r.get('provenance') or {}).get('programId'))
  q=p.get('main') if p and p.get('status')=='active' else None
 else:q=r.get('receiver')
 z=x['slots'].get(str(q.get('slot'))) if q else None
 return bool(z and z.get('cwd') and z.get('openedAt')==q.get('openedAt'))
w=[r for r in x['fleetReports'] if S<=r['reportedAt']<E]
print('reports window/live/awaitOwner',len(w),sum(live(r) for r in w),sum(not r.get('decision') and not live(r) for r in w))
PY
```

B — Ledger

```sh
R="$(dirname "$(git rev-parse --git-common-dir)")" python3 - <<'PY'
import json,os,pathlib,collections,statistics,datetime
p=pathlib.Path(os.environ['R']);s=1788393600000;e=1789603200000
N=['fleet-reports.jsonl','audit-adjudications.jsonl','lane-outcomes.jsonl','streams/prompts.jsonl','post-land-audits.jsonl'];D={}
for n in N:
 r=[];bad=0
 for i,l in enumerate((p/n).open(),1):
  try:x=json.loads(l)
  except ValueError:bad+=1;continue
  if n=='streams/prompts.jsonl':x={k:x[k] for k in ['ts','source']}
  r.append((i,x))
 D[n]=r;t=lambda x:x.get('at',x.get('ts'));w=[x for _,x in r if s<=t(x)<e]
 print(n,'valid',len(r),'invalid',bad,'range',*[datetime.datetime.fromtimestamp(t(a)/1000,datetime.timezone.utc).isoformat() for a in [min((x for _,x in r),key=t),max((x for _,x in r),key=t)]],'window',len(w))
 if n=='streams/prompts.jsonl':print('owner all/window',sum(x['source']=='owner' for _,x in r),sum(x['source']=='owner' for x in w))
 if n=='lane-outcomes.jsonl':
  for a in [[x for _,x in r],w]:print('outcomes',sum(x.get('ownerPrompts',0) for x in a),sum('ownerPrompts' not in x for x in a),dict(collections.Counter(str(x.get('confirmedByHuman','missing')) for x in a)))
 if n=='audit-adjudications.jsonl':print('verdicts',dict(collections.Counter(x['verdict'] for x in w)),'sept14',sum(1789344000000<=x['at']<1789430400000 for _,x in r))
 if n=='post-land-audits.jsonl':print('results',dict(collections.Counter(x['result'] for x in w)))
r=D[N[0]];j={x['id'] for _,x in r if x['kind']=='decision' and x['at']<e};w=[(i,x) for i,x in r if x.get('status')=='needs-main' and s<=x['at']<e];u=[(i,x) for i,x in w if x['id'] not in j]
print('report kinds',dict(collections.Counter(x['kind'] for _,x in r)))
print('needs-main tasks/medianHours',dict(collections.Counter(x['taskId'] for _,x in u)),statistics.median((e-x['at'])/3600000 for _,x in u))
print('needs-main total/open/uniqueTasks/medianDays',len(w),len(u),len({x['taskId'] for _,x in u}),statistics.median((e-x['at'])/86400000 for _,x in u));print('report evidence',[(i,x['id']) for i,x in u])
a=D[N[4]];ad=D[N[1]];j={x['auditAt'] for _,x in ad if x['at']<e};w=[(i,x) for i,x in a if x['result']=='red' and s<=x['at']<e];u=[(i,x) for i,x in w if x['at'] not in j]
print('red/open/medianDays',len(w),len(u),statistics.median((e-x['at'])/86400000 for _,x in u));print('audit evidence',[(i,x['at']) for i,x in u]);print('later',sum(x['at'] in {z['auditAt'] for _,z in ad if z['at']>=e} for _,x in u))
print('red medianHours',statistics.median((e-x['at'])/3600000 for _,x in u));print('sample failed',[(i,x.get('checks',{}).get('failed')) for i,x in a if i in [619,620,622]])
w14=[(i,x) for i,x in w if 1789344000000<=x['at']<1789430400000];print('sept14 red/open',len(w14),sum(x['at'] not in j for _,x in w14));print('retry matches',[(i,x['at']) for i,x in w14 if any('clarification identical retry' in f for f in x.get('fails',[]))])
PY
```

C — Historie und Prosa

```sh
R="$(dirname "$(git rev-parse --git-common-dir)")" python3 - <<'PY'
from pathlib import Path
import os,re,subprocess,json
r=Path(os.environ['R']); g=['git','-C',str(r)]; dates=['--since=2026-09-03T00:00:00Z','--until=2026-09-17T00:00:00Z']
def git(args):return subprocess.check_output(g+args,text=True)
print('owner_commits',len(git(['log',*dates,'--grep=Owner','--format=%H']).splitlines()))
log=git(['log',*dates,'--format=%H','--','HANDOFF.md']).splitlines(); found=0; unique=set()
for sha in log:
 active=False;level=0
 for line in git(['show',sha+':HANDOFF.md']).splitlines():
  if re.match(r'^(?:#+ .*|[0-9]+[.)] )OFFEN BEIM OWNER',line,re.I):active=True;level=max(1,len(line)-len(line.lstrip('#')));found+=1;continue
  if active and re.match(r'^#{1,'+str(level)+r'} ',line):active=False
  if active and line.strip() and line.strip()!='---':unique.add(line.strip())
print('handoff commits/headings/prose_lines',len(log),found,len(unique))
m=Path.home()/'.claude/projects'/str(r).replace('/','-')/'memory'; b=[p.read_text() for p in m.glob('feedback-*.md')]
d=[x[1] for s in b if (x:=re.search(r'^\s+modified: (\S+)',s,re.M))]
print('feedback files/lines/why/modified/range',len(b),sum(len(s.splitlines()) for s in b),sum(bool(re.search(r'(?i)why|warum',s)) for s in b),len(d),min(d),max(d))
p=list((r/'docs/messungen').glob('*.md'));q=[]
for f in p:
 s=f.read_text()
 if s.startswith('---\n') and re.search(r'^urteil:',s.split('---',2)[1],re.M):q.append(s)
print('notes files/urteil/urteil_lines/without',len(p),len(q),sum(len(s.splitlines()) for s in q),len(p)-len(q))
a=[json.loads(l) for l in (r/'dispositions.jsonl').read_text().splitlines() if l.strip()]
print('dispositions all/window/at/verdict',len(a),sum(1788393600000<=x['at']<1789603200000 for x in a),[(x['at'],x['disposition']) for x in a])
PY
```

D — explizite manuelle Stichprobenlabels (keine Hochrechnung); die Textbelege stehen in Abschnitt 2.

```sh
python3 - <<'PY'
from collections import Counter
richtung={'233ee108':'unknown','0694cb78':'neue Freigabe','3d5ee33f':'neue Freigabe','6ec7ab69':'neue Freigabe'}
handoff={'8498c306:5557':'inhaltlich heute','604facbf:25':'unknown','ca26435c:14':'unknown'}
print('Richtung',len(richtung),Counter(richtung.values()),'belegt voll beantwortbar',0)
print('HANDOFF',len(handoff),Counter(handoff.values()),'historische Verfuegbarkeit unknown',len(handoff))
PY
```

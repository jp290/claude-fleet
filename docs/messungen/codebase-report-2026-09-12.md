---
frage: Warum kommt die Arbeit an claude-fleet seit Wochen schwer voran, und wo liegt das Gewicht im Code?
urteil: Die Änderungslast wächst an Zustandsübergängen und ihren Beweisen; die breite Rückmeldung kommt spät, und die Betriebsdaten trennen Wartezeit selten von Arbeit.
bereich: [server, land-merge-verify, client, dokumentation, betriebsledger]
belege: [server.ts#queueStateSave, server.ts#dispatchTask, server.ts#drainPostLandAudits, server.ts#PostLandAuditRow, src/client.ts#TaskInfo, watchdog.sh#VERIFY_CMD]
nicht-gemessen: CPU-Zeit, tatsächliche Save-Frequenz, Ursachen einzelner roter Audits, menschliche Arbeitszeit, Browserverhalten und externe Hosts
stand: 2026-09-12
---

# Codebase-Zustandsbericht

## Urteil in drei Sätzen

Die Arbeit bewegt sich — seit dem Vorgängerbaum liegen 976 Commits vor —, aber Änderungen an
Fleet ziehen Zustandsabgleich, Protokollpflege und Beweisführung über mehrere Flächen nach sich.
Die breite Verifikation liefert im gemessenen Zeitraum nach dem 25.08. bei 297 Audits erst nach
median 24,55 Minuten einen Abschluss; 101 sind rot und 80 bleiben `unknown`.
Das erklärt technisch zusätzliche Warte-, Prüf- und Reparaturschritte; welcher Anteil des vom
Owner empfundenen Stillstands daraus entsteht, lässt sich ohne Arbeitszeit- und Ursachenmessung
nicht beziffern.

Messbasis: Codebaum `3c578cc892bae0ef926bab767f5f53b5a425de11`, Vorgängerbaum `fe27764`;
Ledger am 12.09.2026 gelesen, Vergleichsfenster ab `2026-08-25T12:06:00Z`, dem Messzeitpunkt des
Vorgängers. **Gemessen** bezeichnet Quelltext, Git-Auswertung oder Ledger-Aggregation;
**abgeleitet** bezeichnet deren Kostenfolge. Die Rangfolge gewichtet Kosten und Belegstärke.

Abstraktionsurteil: Ein restartfester Fleet-Zustand, gemeinsame Prüfmechanismen und eine
Browser-Control-Plane sind für die in `SYSTEM.md` beschriebenen Slots, Arbeitsaufträge und
Belegketten erforderlich. Die folgenden Befunde betreffen die Kosten ihrer konkreten Grenzen.

## Fünf gerankte Befunde

### 1. Breite Rückmeldung kommt nach dem Land und bindet lange Durchlaufzeit

**Mechanismus, gemessen.** `watchdog.sh#VERIFY_CMD` (Zeile 91) führt vor automatischem Land
Install, Pins, Typecheck, Build und drei fokussierte Harnesses aus. Die Hauptsuite steht in
`watchdog.sh#AUDIT_CMD` (108); `server.ts#recordLand` (13875, Aufruf 13943) reiht sie nach dem
Verschieben von Main ein. `server.ts#drainPostLandAudits` (14910) bündelt wartende Lands und
arbeitet lokale Audits seriell ab. Gate und Vollsuite teilen den Maschinenmutex aus
`e2e-stage.sh#FLEET_SUITE_LOCK` (105). Ein Owner-Confirm darf ausdrücklich mit einem alten oder
roten Beleg landen; der MAIN-Confirm verlangt eine frische erfolgreiche Prüfung
(`server.ts#confirmResolvedCandidate`, 19169, frische Prüfung 19259). Reine Dokumentationslands
erhalten die kurze Install-/Pins-Kette; auch der Audit wird verkürzt, wenn alle gebündelten
Covers dafür qualifiziert sind (`server.ts#entryRunsShortChain`).

**Beleg.** Seit dem Vergleichsstichtag: 297 Auditzeilen, davon 116 grün (39,1 %), 101 rot
(34,0 %) und 80 `unknown` (26,9 %), mit 321 Einträgen in `covers`. Die Summe des Feldes `ms`
beträgt 104,19 h; Median 24,55 min, p90 40,02 min. Davon entfallen 45,40 h auf rote und 10,77 h
auf unbekannte Ergebnisse (`post-land-audits.jsonl:271–567`). Das sind summierte Dauern von
Jobs, keine CPU-Stunden und keine zusätzlich gemessene Vorwartezeit in der Auditqueue.

**Preis, abgeleitet.** Ein Defekt außerhalb der fokussierten Gate-Harnesses kann erst im bereits
gelandeten Baum auffallen; seine Bearbeitung verlangt danach Zuordnung und einen weiteren
Integrations- oder Rücknahmeakt. Lokale Vollsuiten belegen denselben Mutex wie neue Land-Gates.
Die Rotquote beweist weder 101 Produktdefekte noch Flakiness: Einzelursachen und Adjudications
wurden nicht untersucht. Die Zeit bis zum belastbaren Ergebnis ist dagegen direkt gemessen.

### 2. Zustandsänderungen tragen den ganzen Snapshot und mehrere Identitätskopien

**Mechanismus, gemessen.** `server.ts#queueStateSave` (2768) serialisiert alle 38 Bereiche des
Snapshots, schreibt eine temporäre Datei, synchronisiert sie, kopiert den alten Stand nach
`.bak`, benennt um und synchronisiert das Verzeichnis. `server.ts#saveState` (2847) und
`server.ts#saveStateNow` (2856) nutzen dieselbe Promise-Kette; aufeinanderfolgende Saves werden
darin nicht zusammengefasst. Die gelesene `fleet.json` hat 1.748.631 Bytes. Seit `fe27764` wuchs
das gespeicherte Objekt von 29 auf 38 Top-Level-Felder.

**Beleg.** Task-Zuordnung liegt in `server/types.ts#Task` (923; `slot` bei 986) und in den
Provenienzfeldern von `server/types.ts#Slot` (1160; Provenienz ab 1195). `server.ts#dispatchTask` (8996) setzt
Slot-Provenienz und Task-/Follower-Status gemeinsam; `server.ts#detachSlotTasks` (4949) setzt
Task-Verweise beim Teardown zurück. Der Slot wird an weiteren Stellen geleert. Der Bootblock
liest und normalisiert die einzelnen Bereiche über rund 770 Zeilen
(`server.ts#startupStateRefusal`, Boot-Restore 22961–23731); sein äußerer Catch behandelt einen
nicht lokal abgefangenen Fehler als unlesbaren Gesamtsnapshot.

**Preis, abgeleitet.** Auch eine kleine Zustandsmutation erzeugt Arbeit proportional zum
gesamten Snapshot sowie Dateikopie und Sync-Barrieren. Eine neue Lebenszykluskante muss
Runtime-Felder, gespeicherte Form, Boot-Rekonstruktion und Task-/Slot-Zuordnung zusammenhalten.
Die Identitätskopien bewahren Provenienz über Task-Lebensdauern hinweg; der Preis sind zusätzliche
Schreib-, Rücksetz- und Rekonstruktionspfade. Tatsächliche Save-Frequenz, I/O-Latenz und ein
dadurch verursachter Durchsatzeinbruch wurden nicht gemessen.

### 3. Für teure Preview-Ergebnisse fehlt der Abschlusskanal

**Mechanismus, gemessen.** Eine Lane bietet ihre Vorschau selbst an; der Auftrag lebt in
`server.ts#laneSuiteJobs` (Region ab 14580). Sein Ergebnis geht in diesen Job und ausdrücklich
nicht in das Post-Land-Audit-Ledger. Die Watch-Arten in `server/types.ts#watchKind` (232) umfassen
Lane, Merge, Audit, Deploy, Transition und Command-Job; eine Lane-Suite hat keinen eigenen
Watch-Abschluss. Der Rückweg ist das erneute Lesen von `/api/self/suite-offer`.

**Beleg.** Der Quelltext trennt Angebot, Snapshot und Ergebnisablage in
`server.ts#buildLaneSuiteBundle` und der zugehörigen Job-Verwaltung; das Register liegt im
gelesenen Snapshot unter `fleet.json:69`. Der in `HANDOFF.md:5` beschriebene rote Hub-Lauf ist
historischer Kontext: Der untersuchte HEAD enthält bereits den nachfolgenden Fixture-Fix
`3c578cc8`. Er wird hier nicht als noch offener Produktfehler gezählt.

**Preis, abgeleitet.** Das Ende eines unabhängigen Laufs beendet die Wartearbeit des Auftraggebers
nicht von selbst. Der muss den Job erneut lesen und den Befund in seinen Arbeitsablauf übernehmen;
eine übersehene rote Vorschau oder ein zusätzlicher lokaler Lauf ist möglich. Wie oft das
passierte und wie viele Minuten zwischen Ergebnis und Sichtung lagen, wurde nicht gemessen.
Das Audit-Ledger allein kann diese Lücke nicht zählen, weil Previews dort absichtlich fehlen.

### 4. Der zentrale Client-Vertrag wird von Hand synchronisiert

**Mechanismus, gemessen.** Der Server bildet `server.ts#TaskDigest` (2254) aus seinem Task-Typ;
der Client erklärt denselben Poll-Inhalt separat als `src/client.ts#TaskInfo` (260).
`src/client.ts#refresh` (5399) übernimmt die Sessions-Antwort über `res.json()` und eine
Type Assertion, schreibt anschließend modulweite Zustände und aktualisiert mehrere Views.
`src/protocol.ts#GitInfo` und `src/protocol.ts#PostLandAuditInfo` zeigen, dass gemeinsame
Wire-Typen für Teilflächen bereits existieren; die ganze Sessions-Antwort gehört nicht dazu.

**Beleg.** Der Kommentar bei `TaskInfo` dokumentiert einen früheren Kind-Drift, der trotz
kompilierendem Client die Gruppierung stilllegte. Heute stehen Servertyp und Clienttyp weiter
getrennt. `src/client.ts#armPolls` (5584) startet außerdem periodische volle Reads ohne eine
Sperre für einen noch laufenden `refresh`; jede fertig eintreffende Antwort schreibt Zustand.
Ein Test mit absichtlich vertauschter Antwortreihenfolge wurde bei der fokussierten Suche nicht
gefunden; ein Browserexperiment wurde nicht ausgeführt.

**Preis, abgeleitet.** Eine Server-Erweiterung verlangt manuelle Pflege des Clientvertrags und
seiner Verbraucher. Der Compiler bestätigt die jeweils erklärte Form, nicht die tatsächlich
empfangenen Bytes. Bei überholenden Antworten kann ein älterer Stand einen jüngeren ersetzen;
dies ist eine aus dem Kontrollfluss abgeleitete Fehlerkante, kein gemessener Betriebsfall.
Die 11.708-Zeilen-Datei verbindet diesen Vertrag mit Polling, Aktionen und Darstellung, wodurch
die Prüfung einer Wire-Änderung mehrere UI-Flächen berührt.

### 5. Die Belege reichen für Ergebnisquoten, kaum für die Kostenursache

**Mechanismus, gemessen.** `server.ts#PostLandAuditRow` (14154) unterscheidet `ms`, `waitMs`
und `workMs`. Im Vergleichsfenster tragen aber nur 8 von 297 Auditzeilen eine gemessene Wartezeit
und nur 5 eine Arbeitszeit; alle fünf Arbeitszeitwerte stammen aus kurzen proportionalen
Prüfungen. 88 von 297 Zeilen haben `checks:null` (`post-land-audits.jsonl:271–567`).
Das Lane-Ledger enthält außerdem zwei Formen: Lane-Dispositionen und Main-direct-Ergebnisse
(`server/types.ts#MainDirectOutcome`; `lane-outcomes.jsonl:1–899`).

**Beleg.** Von 392 Lane-Ausgängen seit dem Stichtag haben 300 `verified:true`, 3 `false` und
89 `null`; zwei weitere Zeilen sind Main-direct-Lands und gehören nicht in diesen Nenner.
Nur 263 der insgesamt 394 Ausgangszeilen tragen `sessionMs`: zusammen 756,0 h verstrichene
Sessiondauer, Median 93,43 min. Diese Dauer schließt unbeaufsichtigtes Liegenlassen ein;
sie ist keine gemessene Agentenarbeit (`lane-outcomes.jsonl:506–899`). Die Schreiber verwenden
`server/persist.ts#appendEvent` (34), das Schreibfehler abfängt; der Akt kann ohne seine
Ledgerzeile weiterlaufen.

**Preis, abgeleitet.** Aus vorhandenen Summen lässt sich nicht belastbar entscheiden, ob die
Maschine am Prüfen, Einrichten oder Warten hängt. Eine Rekonstruktion verlangt weitere
Protokolle und unterschiedliche Nenner; verlorene Writes wären aus diesen Dateien allein
nicht einem konkreten Akt zuzuordnen. Fehlende Messung wird im Bericht ausdrücklich als Lücke
behandelt. Ein tatsächlicher Ledger-Schreibverlust wurde nicht nachgewiesen.

## Die fünf Flächen

**Server.** `server.ts` hat 29.560 Zeilen; die elf neuen `server/*.ts` zusammen 3.457.
Die Extraktion enthält unter anderem Typen, Auth, HTTP, Transport und Persistenzhelfer, während
Snapshot und Router im Hauptmodul bleiben (`server.ts#queueStateSave`,
`server.ts#handleHelperRoute`, `server.ts#handleStewardRoute`, `server/transport.ts#STATIC`).
Gezählt wurden 158 verschiedene exakte beziehungsweise regexbasierte Pathmatcher gegenüber
123 im Vorgängerbaum; das sind Matcher, keine Anzahl semantisch geprüfter Endpunkte. Die
Einzelberechtigungen aller Routen wurden nicht untersucht.

**Land/Merge/Verify.** Direkt unter `e2e/` liegen 51 TypeScript-Dateien, zusammen 56.406 Zeilen;
die Briefzahl 58 beschreibt diesen Bestand nicht. `fleet-e2e.ts` ruft 43 Check-Familien auf.
Staging leitet die Importhülle dynamisch ab (`e2e-stage.sh#stage_instance`). Vor-Land-Kette,
nachgelagerter Audit und freiwillige Vorschau haben unterschiedliche Aussagen und Rückwege
(`server.ts#mergeJob`, `server.ts#drainPostLandAudits`, `server.ts#laneSuiteJobs`). Die
vorhandenen Testkörper wurden nach Familien inventarisiert und an den benannten Grenzen
gelesen; keine Vollabdeckung und keine Suiteausführung werden behauptet.

**Client und public.** Der zentrale Client verbindet Sessions-Poll, Terminalbedienung und
Owner-Views (`src/client.ts#refresh`, `src/client.ts#renderBoard`). Der Build erzeugt vier
Browserbundles; `server/transport.ts#STATIC` liefert sie aus. Der getrackte Bestand unter
`public/` besteht aus HTML, Manifest und Icons; die Bundles sind erzeugte Dateien. CSS,
Accessibility, Renderingkosten und die separaten Share-/Helper-/Hub-Clients wurden nicht
inhaltlich beurteilt. Das gemessene Gewicht liegt hier in Zustands- und Wire-Kopplung.

**Dokumentation gegen Code.** Die vier angeforderten Dokumente wuchsen zusammen von 2.368 auf
6.823 Zeilen: AGENTS 218→295, Self-API 561→2.359, Verify-Tiering 1.308→3.798,
Harness-Adapter 281→371. Historische, ausdrücklich datierte Aussagen im Kopf von
`docs/verify-tiering.md` sind keine aktuellen Fehlbehauptungen. Die geprüfte Origin-Regel in
`docs/harness-adapter.md:55` stimmt mit `src/protocol.ts#INSTANCE_URL_RE` überein.
Auch Gate-Klassifikation und Harness-Probe stimmen an den gelesenen Nähten überein:
`AGENTS.md:179` und `docs/self-api.md:8` passen zu `server.ts#laneLocalProof` und
`verify-proportion.ts#verificationProportionFor`; `docs/harness-adapter.md:230` trennt wie
`server.ts#commsFor` und `server.ts#harnessAutomatableFor` Prozessbeobachtung und
Automatisierungsrecht. Querverträge zu Shell und Dokumentation werden durch `e2e/pins.ts#pin` abgesichert; die Datei
wuchs von 3.343 auf 7.388 Zeilen. Das misst Pflegefläche, keine reine Laufzeitlast; die lokale
Pin-Prüfung ist grün. In diesen gelesenen Nähten wurde kein aktueller Doc-Code-Widerspruch
belegt; ein vollständiger Satz-für-Satz-Abgleich wurde nicht durchgeführt.

**Betriebsledger.** Der aufbewahrte Gesamtbestand umfasst 899 Ausgangszeilen, 567 Auditjobs und
203 Deployzeilen; keine `.1`-Generation war vorhanden. Seit dem Stichtag endeten 323 von 392
Lanes gelandet, 49 leer, 15 dirty und 5 abgelegt; dazu kamen zwei Main-direct-Lands.
Alle 122 Deployzeilen dieses Fensters sind erfolgreiche Boot-Bestätigungen, mit zusammen
7,60 min im Feld `ms` (`deploys.jsonl:82–203`). Das belegt diese erfassten Abschlüsse; manuelle
Neustarts und fehlende Einträge liegen außerhalb des Nenners. Die teure erfasste Rückmeldung
liegt bei den Audits; CPU-Verteilung und gesamter Agentenverbrauch bleiben ungemessen.

## Delta zum 25.08.

| Messgröße | Vorgängerbaum `fe27764` | untersuchter Baum |
|---|---:|---:|
| Zeilen `server.ts` | 21.338 | 29.560 |
| Dateien / Zeilen `server/*.ts` | 0 / 0 | 11 / 3.457 |
| Zeilen `src/client.ts` | 9.854 | 11.708 |
| Dateien / Zeilen `e2e/*.ts` | 46 / 30.980 | 51 / 56.406 |

808 der 976 Commits berühren `docs/`, AGENTS, SYSTEM oder HANDOFF; 260 berühren E2E-Dateien
oder deren Wrapper, 170 Servercode, 61 `src/` oder `public/`. Gruppen überlappen; ein Commit
ist keine Arbeitszeiteinheit. Die Zahlen belegen Wachstum und Änderungsorte, keine individuelle
Produktivität.

Der Vorgängerbefund zur unsichtbaren Identitäts-/Rückwegblockade ist teilweise geschlossen:
`server.ts#programHealth` (7536) projiziert Identität,
`server.ts#programReturnPath` (7651) das Zustellbudget,
`server.ts#supervisorView` (21604) zusätzlich die Promotion.
`server.ts#backfillProgramMainSessionId` (7723) ergänzt eine zuvor unbekannte Session-ID nur
für die passende aktive Belegung. Die alte Null-ID-Ursache wird deshalb nicht erneut als
unverändert offener Befund behauptet.

Die Queue-Uhr bleibt begrenzt: `program-phase.ts#PhaseInput` enthält weiterhin keinen
Zeitstempel der Statusänderung; `program-phase.ts#PHASE_RULES` bildet `pending` und `queued`
auf READY ab. Aktuell stehen 40 ausführbare Zeilen auf `pending`, gegenüber den damaligen 80;
ihr Medianalter seit Erstellung beträgt 3,92 statt 16,2 Tage (`fleet.json:6856`). Keine der
200 gelesenen Task-Zeilen besitzt `statusAt`. Weil `server.ts#detachSlotTasks` Zeilen zurück
nach `pending` setzt, ist Erstellungsalter kein Beweis für ununterbrochene Wartezeit.

## Nicht gemessen und Verifikation

- Keine CPU-Zeit, Hostauslastung, Save-Frequenz, Profilierung oder menschliche Arbeitszeit.
- Keine Zuordnung einzelner roter Audits zu Produktfehler, Probe, Infrastruktur oder späterem
  Owner-Urteil; kein Beweis einer allgemeinen Flake-Rate.
- Keine Browserausführung, künstliche Antwortverzögerung, Crash-Injection, komplette
  Routen-/Testprüfung oder Untersuchung fremder Hosts und Worktrees.
- Keine vollständige Historie vor der frühesten erhaltenen Ledgerzeile. JSON-Parsebarkeit
  aller gelesenen Zeilen wurde geprüft; fehlende Ereignisse können daraus nicht erkannt werden.
- Nur Quelltext, Git und lokale Ledger gelesen; ausschließlich diesen Bericht geschrieben.
  SYSTEM, Vorgängerbericht und HANDOFF §0 dienten als Einstieg. Graphify orientierte die Suche;
  seine Zeilenangaben wurden am aktuellen Quelltext nachgeschlagen. Werkzeuge: `rg -n`,
  für ignorierte Bestände `rg -uu`, `ast-grep --lang ts`, Git und Python-Aggregation.
- Drei Sol-Instanzen bearbeiteten die fünf Flächen in zwei Wellen: Weitere Agenten wurden vom
  Werkzeug mit `agent thread limit reached` abgewiesen. Server-/Verify-Urteile liefen mit
  medium, Client-/Ledger-Inventur mit low. Kein unabhängiger Gesamtreview des Berichts.

Reproduktion der Größen: je Baum `git ls-tree -r --name-only <ref>`, dann Zeilen der genannten
Dateimengen über `git show <ref>:<pfad>` zählen; Commitfenster `git rev-list fe27764..HEAD`
am oben genannten Analyse-HEAD. Ledger: jede JSONL-Zeile parsen, `ts` bei Outcomes beziehungsweise
`at` bei Audit/Deploy gegen den Stichtag filtern, Ergebnisfelder getrennt zählen, vorhandene
numerische Dauerfelder summieren. Median ist der mittlere Wert beziehungsweise das Mittel
der beiden mittleren Werte, p90 der sortierte Wert an Position `ceil(0,9 × n)`.

Für diesen Dokumentationsauftrag wurde ausschließlich `bun e2e/pins.ts` ausgeführt;
die vom Brief ausgeschlossenen Suiten und `bun server.ts` wurden nicht gestartet.
Verifikationstail:

```text
ALL PASS
```

Offene Done-Grenze: Schon vor Arbeitsbeginn meldete `git status --porcelain` das fremde
Verzeichnis `?? .hub-prototype/`. Es blieb unangetastet; ein leerer Gesamtstatus lässt sich
innerhalb des autorisierten Schreibumfangs nicht herstellen. Für den Bericht werden alle
zitierten Symbolanker mit `rg -n '<symbol>' <datei>` geprüft. Der automatische Graphify-Rebuild
des Post-Commit-Hooks wird für diesen Commit über `GRAPHIFY_SKIP_HOOK=1` ausgeschaltet, damit
die vorgegebene rein lesende Graph-Nutzung erhalten bleibt; Verifikationshooks werden nicht
umgangen.

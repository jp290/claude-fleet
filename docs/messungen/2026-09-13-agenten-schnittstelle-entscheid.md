# Agenten-Schnittstelle: Zustellung zuerst, Self-Verben über HTTP

Entscheidungsvorschlag, gemessen am 2026-09-12; Dateidatum folgt dem Auftrag.
Quellbaum: `32b062add04a7b8ce581a5bf06b61005573c2c2f` (`git rev-parse HEAD`).

**Empfehlung: (b) als schmale, rollenbezogene Self-Schicht ausbauen und verbindlich
benennen; bestehendes ctl.sh unverändert zur Pflicht für alle zu machen wäre falsch.
HTTP bleibt. MCP-Tools werden erst nach einem Vergleich am gleichen Aufgabensatz
promoviert. Vorrang hat ein quittierbarer Eingang unabhängig vom Composer.**

Eine Agenten-Fassade soll existieren, weil Feldformen, Credentials und kleine
Ergebnisansichten mechanische Arbeit sind; Autorität und Zustellzustand gehören
weiter dem Server. Untersucht wurden der benannte Messbefund, ctl-Kopf und
Self-Verben, relevante Abschnitte der Self-Referenz, Controller-Werkzeuge, der
portable Vertrag und gezielte Serverstellen für Send, Auto, Inbox, Watch und
Merge-Verdikt. Keine vollständige Server-/Harness-Prüfung, kein Lasttest.

## 1. Kosten und Evidenzgrenzen

### Messquellen

- **Q1:** `docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md:13`
  berichtet historisch 12 Inbox-Nudge-Fehler seit Boot, 16 MB freien Mac-Speicher,
  2,7/4 GB Swap und 2 belegte von 3 Second-host-Suite-Slots. Das sind übernommene
  Messungen; OOM als Todesursache einzelner Hintergrund-Watcher wurde hier nicht bewiesen.
- **Q2:** `/Users/owner/claude-fleet/server.log`, eigener Gesamtdatei-Zähler
  `grep -c inboxNudgeSend`: **13** beim Lesen am Messtag. Darunter Resttext-Längen
  49 einmal, 129 sechsmal, 169 einmal, 193 zweimal; 3 Zeilen ohne dieses Muster
  (`holds (\d+) chars`). Gesamtlog und Boot-Fenster aus Q1 sind verschiedene Mengen.
  Erfolgreiche Nudge-Versuche wurden mit diesem Zähler nicht erfasst: **Fehlerrate unknown**.
- **Q3:** `/Users/owner/claude-fleet/streams/prompts.jsonl`, ausschließlich
  `grep -c`: **12926** nichtleere Zeilen (`.`), **45** mit `ctl.sh`, **3380** mit
  `"source":"auto"`. `"source":"dispatch"` findet keine Zeile.
  Die Briefangabe **44/517** ist damit nicht als Dispatch-Anteil reproduziert;
  Worttreffer sind weder Nutzungsnachweise noch erfolgreiche Selbstaufrufe.
  `grep -c ctl.sh AGENTS.md` ergibt **0** (Quelle: `AGENTS.md`).
- **Q4:** `/Users/owner/claude-fleet/context-receipts.jsonl`, Snapshot
  2026-09-12T15:52:20Z: **689** JSON-Zeilen; `briefSource`: raw 417, founding 148,
  owner 59, clarify 2, main 1, Feld fehlt 62. `deliveredBytes` liegt bei **98–20339 B**.
  Das sind Kontextlieferungen, keine Self-Request-/Response- oder Modell-Turn-Quittungen.
  Q1 berichtet für seinen früheren Stand **416/517 raw** (`Q1:65`).
- **Q5:** `ctl.sh:4` dokumentiert eine Controller-Nacht mit falschem `slot` statt
  `target`, kurzer Audit-SHA und **3** Versuchen an der Report-Feldform.
  Das belegt konkrete Nacharbeit, aber keinen Nenner aller Aufrufe und keine Fehlerrate.
- **Q6:** Reale Leseprobe dieser Lane, unten vollständig als Zahlenprotokoll;
  Quellen: `GET /api/self`, Ausgabe von `ctl.sh:457` und die folgenden Beispielstrings.
  Gezählt wurde UTF-8 per Python `len(bytes)`, Zeit mit `time.monotonic()` um
  `subprocess.run(..., capture_output=True)`. Keine Prozess-Kommandozeile ausgelesen.

### Kostentabelle je Selbstaufruf

Ein „Turn“ bezeichnet hier einen Agent→Tool→Ergebnis-Zyklus. Die erfolgreiche
Leseprobe benötigt jeweils einen solchen Zyklus; Modell-API-Turns und historische
Retry-Verteilungen sind nicht gemessen. Shell-/MCP-Toolhüllen und Tokenisierung
sind in den Beispielbytes nicht enthalten. POST-Beispiele wurden nur gezählt.

| Option | Bytes je Aufruf und Ergebnis | Turns/Feldformkosten | Eingehende Fehlerrate; ungelöste Kosten |
|---|---|---|---|
| (a) curl+JSON | Q6: GET-Befehl **86 B**, rohe Antwort **295 B**; Watch-Befehl **179 B** | Q6: **1** Zyklus beim GET; Watch nicht ausgeführt. Q5 belegt Formkorrekturen; Rate unknown. | Q2: **13 Fehler**, Rate unknown. Composer, flüchtige Watcher und breite Antworten bleiben. |
| (b) ctl.sh | Q6: `events` **15 B**, Ausgabe **111 B**; Watch-Befehl **22 B** | Q6: **1** Zyklus beim GET; gleiche HTTP-Self-Abfrage. Watch baut `target` und volle SHA selbst (`ctl.sh:400`). Feldfehlerrate nach Einführung unknown. | Dieselbe Zustellung wie (a), daher keine gemessene Verbesserung von Q2. Fehlende Rollenverben, Prozessstart und Credential-Trennung bleiben. |
| (c) MCP-Tools | Q6: bloße Watch-Argumente **39 B**, zuzüglich Toolname/Hülle/Schema; reale Antwort- und Sessionkosten **unknown** | Vorgesehener Toolaufruf je Operation; kein Fleet-MCP-Vergleich gefahren. Schema kann falsche Feldform abweisen, falsche Absicht bleibt möglich. | Standardtools erzeugen keinen eingehenden Turn. Q2 wird durch ihre Einführung allein nicht repariert; Adapterbetrieb und Schemakontext kommen hinzu. |

Q6, gezählte Strings (ohne abschließenden Zeilenumbruch); die konkrete Host-Adresse
wurde für den Leak-Pin längengleich durch `<fleet-host>` ersetzt:

```sh
curl -fsS http://<fleet-host>:8790/api/self -H "x-fleet-self-token: $FLEET_SELF_TOKEN"
./ctl.sh events
curl -s -X POST http://<fleet-host>:8790/api/self/watch -H "content-type: application/json" -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -d '{"kind":"merge","target":5,"idleSec":0}'
./ctl.sh watch merge 5
```

MCP-Argumentbeispiel: `{"kind":"merge","target":5,"idleSec":0}`.
Die Rollenprüfung verbietet dieser Lane das Watch-Abonnement; deshalb kein POST-Test.
Die autorisierten GETs ergaben:

```text
curl self: exit=0 responseBytes=295 elapsedMs=16.5 events=0
ctl events: exit=0 stdoutBytes=111 stderrBytes=0 elapsedMs=688.1
no FleetEvent is bound to this occupant
watches: 0 armed of 0 (the spent ones say what happened in lastResult)
```

Die ctl-Ausgabe ist eine Projektion derselben Event-Frage; der curl-Body enthält
zusätzliche Self-Felder. Der Vergleich misst den Nutzen kleiner Ausgaben, keine
Kompression gleicher vollständiger Antworten. Auch curl könnte diese Projektion
per Filter herstellen. Die Laufzeiten sind Einzelproben, keine Verteilungswerte.
MCP spart gegenüber ctl hier nachweislich noch keinen Turn. Ein Vergleich muss
zusätzlich Discovery-/Schema-Bytes, Responses, Formfehler und Reparaturzyklen je
Rolle erfassen; die vorhandenen Journale geben diese Rechnung nicht her.

## 2. Schnittlinie und eingehender Kanal

**Eingang:** Fleet hält Ereignis, Empfängeridentität, Wiederaufnahme und Quittung.
Ein Harness-Adapter übergibt den Hinweis an die laufende Session; gelesen und
inhaltlich bearbeitet sind getrennte Zustände. Der Agent holt den Gegenstand über
seine Self-Tür. Ein leerer Composer ist noch kein Beweis inhaltlicher Verarbeitung.

Der bestehende Ansatz liefert brauchbare Bauteile:
`server.ts:5526` serialisiert Eingaben und prüft Occupant sowie Composer;
`server.ts:12669` persistiert vor Paste `send-uncertain`;
`server.ts:12698` hält Vor-Paste-Verweigerung als `pending` und trennt sie vom
unsicheren Send. Program-Inbox bleibt über MAIN-Nachfolge lesbar
(`docs/self-api.md:882`). Events werden heute über `GET /api/self` gelesen
(`ctl.sh:470`); eine neue `GET /api/self/events`-Tür ist hier nicht belegt.

**Der erste teure Bruch ist konkret:** `server.ts:12147` empfängt `acceptance`,
aber `server.ts:12161` speichert nach jeder nicht werfenden Rückgabe den Dedupe-Key.
Damit behandelt der Nudge auch `unobservable` als bereits erledigten Hinweis;
`server.ts:12725` lässt den Watch bei derselben Rückgabe ausdrücklich unsicher.
Kosten: eine ungelesene Inbox kann ohne bestätigten Weckruf stumm bleiben.
Das ist am Quellbaum verifiziert; Häufigkeit auf dem laufenden Binary unknown.
Auto ignoriert den Rückgabewert ebenfalls (`server.ts:9210`); Merge-Verdikt
protokolliert ihn, setzt anschließend aber `mark(true)` (`server.ts:20103`).
Diese Pfade brauchen getrennte Folgeschnitte, keine zusätzliche Transportbehauptung.

Kurzfristig Paste als Rückfall absichern: Owner-Draft erhalten, exakten Occupant
nach Await prüfen, unbestätigte Annahme sichtbar lassen, bei bewiesenem Nicht-Senden
begrenzt wiederholen. Unsicheres Senden darf keinen blinden Replay auslösen.
Kein neuer privater Hintergrund-Watcher pro Warteauftrag: Watch-Zustand und
Rückkehrpunkt gehören zum bestehenden Fleet-Prozess. Dessen Ausfall braucht
persistierten Zustand; zusätzlicher MCP-Prozess allein beseitigt Speicherdruck nicht.

**Native Eingänge je Harness gesondert freigeben:**

| Oberfläche | Entscheidung |
|---|---|
| Claude Code, gewöhnliche MCP-Tools | **apply** für einen später gemessenen ausgehenden Adapter; als Push-Ersatz **unsupported**. |
| Claude Code Channels | **apply als isolierte Probe**, Produktionsfreigabe offen: dokumentierter Eingang ohne Composer-Paste; lokale Verfügbarkeit und Annahmebeleg ungeprüft. |
| Claude Code Hooks | **apply** zum Nachholen an belegten Lifecycle-Punkten; kein autonomes Wecken einer stillstehenden Session daraus behaupten. |
| Claude Code `/loop` | **not-applicable** als dauerhafter Fleet-Watch-Ersatz: sessiongebundene Zeitplanung, erneut Prompt-Arbeit statt terminalem Ereignis. |
| Codex MCP | **apply** als ausgehender Kandidat; native Fleet-Push-Zustellung hier **unsupported bis zur Harness-Probe**, keine Aussage über grundsätzliche Unmöglichkeit. |
| Sonstige Harnesses | **unsupported** für ungeprüfte native Eingänge; abgesicherter bestehender Rückfall bleibt explizit. |
| Server/Wire/Reverse-State | **apply**: identische Self-Autorität, korrelierbare Ereignis-ID und ehrliche Annahme-/Lesezustände über jeden Adapter. |
| Docs/Probes | **apply**: Rollenverben und tatsächlich aktivierter Eingang müssen im Bootstrap stehen und getrennt geprüft werden. |
| Board | **not-applicable** für einen Umbau in dieser Entscheidung. |

Herstellerabgleich korrigiert den Brief: „nur Hooks und /loop“ ist keine aktuelle
vollständige Liste. Claude dokumentiert Channels als besondere MCP-Server mit
Push in offene Sessions, expliziter Aktivierung und Preview-/Zugangsgrenzen.
Ein normal eingebundener MCP-Server reicht dafür nicht.
Quelle: [Claude Code Channels](https://code.claude.com/docs/en/channels).
Hooks sind Lifecycle-Einstiegspunkte; `/loop` plant Prompts in einer Session:
[Hooks](https://code.claude.com/docs/en/hooks-guide),
[Scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks).
Codex dokumentiert lokale STDIO- und Streamable-HTTP-MCP-Anbindungen:
[OpenAI MCP-Dokumentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Diese Quellen belegen Produkteigenschaften, keine auf diesem Fleet aktivierte Integration.

**Ausgang:** Rollen erhalten kurze semantische Self-Verben; der Server bleibt
Autorisierungsinstanz. `ctl.sh:25` hat heute die Verbliste
`merges lock ctx report watch events land dispatch wait-merge wait-change`.
`report` liest; es reicht keinen Lane-Report ein (`ctl.sh:347`).
`ctx`, `land` und `dispatch` benötigen Owner-Credentials
(`ctl.sh:333`, `docs/controller.md:67`). Der automatische Token-Rückfall auf
`fleet.json` (`ctl.sh:82`) darf nicht in eine allgemeine Agenten-Self-Fassade wandern.

| Rolle | Verbindlicher Ausschnitt nach Ausbau, innerhalb bestehender Autorität |
|---|---|
| Lane | Gate, Drift, Report senden, Klärung, gelieferte Notizen; Watch bleibt verweigert. |
| Program-MAIN | Inbox lesen/quittieren, eigene Tasks und Release, Watch, Self-Land nach Promotion. |
| Controller | Eigene Self-Sichten und Watches; Owner-Land/-Dispatch bleiben getrennt autorisierte Werkzeuge. |
| Steward | Bestehende Steward-Watch-Ausnahme berücksichtigen; kein Program-MAIN-Land. |
| Gebundener Supervisor | Supervisor-Sicht und Nudge; nicht stillschweigend mit Steward gleichsetzen. |

Quelle: `AGENTS.md:54`, `server.ts:26755`, `server.ts:27062`.
ctl-Pflicht gilt erst pro abgedecktem Verb; bis dahin dokumentierter curl-Rückfall.
Für größere Texte Datei-/stdin-Eingabe, kompakte Antworten und explizite Einzelquittung
vorsehen. `events --ack` quittiert heute alle passenden Events einschließlich
`send-uncertain` (`ctl.sh:475`); das taugt nicht als automatischer Lese-Beweis.
MCP kann dieselben Rollenverben später darstellen. Eine zweite Autoritätslogik oder
sofortige flächendeckende Toolmigration ist durch die Messung nicht begründet.

### Eigenes Urteil zur Transportfrage des Owners

**Fleet soll seinen HTTP-Dienst behalten; Agenten dürfen ihn aus der Konsole über
kurze Verben bedienen. „Konsole statt Web-API“ vermischt Bedienung und Transport.**
Q6 misst einen erfolgreichen HTTP-Self-Rundlauf einschließlich curl-Prozessstart
mit **16,5 ms**, den CLI-Wrapper mit **688,1 ms**. Dieser Einzelbefund trägt keine
Behauptung eines HTTP-Engpasses. Q2 lokalisiert Fehlersymptome im Composer;
Q5 lokalisiert Nacharbeit an Feldformen. Ein lokaler Socket ändert beide Grenzen
nicht. Eine belastbare Transport-Rangfolge unter Last bleibt unknown.

Q1 belegt zugleich tatsächlich genutzte entfernte Suite-Kapazität auf dem Second-host.
Telefon-Board, Hub und Shares als HTTP-Konsumenten sind Kontext aus dem Auftrag;
ihre Wire-Pfade wurden in diesem Lesescope nicht separat geprüft. Es gibt hier
keinen Messgrund, die Fernschnittstelle abzuschaffen oder das Board umzugestalten.
MCP über HTTP oder STDIO ist eine zusätzliche Anbindung, kein Grund zum Serverersatz.

## 3. Erste landbare Zeile — Karte

**ZIEL:** Inbox-Nudge bestätigt nur beobachtete Annahme; unsichere Zustellung bleibt
als solche nachvollziehbar und unterdrückt den Weckruf nicht als vermeintlichen Erfolg.

**FLAECHE:** `server.ts#tickInboxNudge` und dessen bestehende Zustands-/Trail-Anbindung;
`e2e/watch.ts` bei der Inbox-Nudge-Familie; `docs/self-api.md` im Inbox-Abschnitt.
Keine gemeinsame Umstellung von Auto, Merge-Verdikt und MCP im selben Schnitt.

**DONE:** Annahme, Vor-Paste-Hold und unsicheres Senden sind separat quittiert und
zählbar, einschließlich Nenner tatsächlicher Versuche. `unobservable` stempelt
keinen Erfolgs-Dedupe-Key; ungewisses Paste wird nicht blind wiederholt. Identischer
ungelesener Satz nach bewiesenem Nicht-Senden bleibt nach Cooldown zustellbar.
Leere Inbox, belegter Owner-Draft, Empfängerwechsel während Await und Neustart bei
unsicherem Send erzeugen weder falschen Erfolg noch Zustellung an einen Nachfolger
ohne gültige Bindung. Persistierte Inbox bleibt der Wiederaufnahmepunkt.

**VERIFY:** Red/Green-Probe in der bestehenden Inbox-Nudge-Familie für
`unobservable` gegen den heutigen Dedupe-Pfad; weitere benannte DONE-Grenzfälle.
`GET /api/self/gate`, dessen `localProof.steps` in Reihenfolge ausführen;
`./e2e-isolated.sh` wegen Änderung in `e2e/`; verlangte Suiten enden `ALL PASS`.
Ein nicht beobachtbarer Harness-Annahmebeleg führt zum RETHINK des Adapters,
ein verletzter deterministischer Zustandsübergang zur gezielten Reparatur.

**VERBOTEN:** Deploy, Board-Umbau, neue Owner-Autorität, Löschen fremder Composer-Texte,
Prozess-Kommandozeilen, neue Scratch-Watcher, blindes Replay oder ACK als Annahmefiktion.

Offen: Boot-genaue Zustellnenner, laufendes Binary gegen Quellbaum, Watcher-OOM-Beweis,
Feldfehlerraten, MCP-Gesamtkosten und lokale native Harness-Eingänge. Diese Entscheidung
liefert den begründeten Schnitt; sie behauptet keine bereits erfolgte Reparatur.

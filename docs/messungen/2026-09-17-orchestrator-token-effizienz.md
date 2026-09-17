---
frage: Wohin geht das Claude-Kontingent von Orchestrator und MAIN, und welcher Schnitt holt am meisten zurück?
urteil: Zuerst Aufrufketten und wiederholte Erdung verkürzen. In vier beendeten Sessions folgen 593 von 661 Modellaufrufen auf Tool-Ergebnisse; 99,02 Prozent der Eingabe-Token sind Cache-Lesungen. Das Wochenkontingent und der kausale Mehrpreis des Opus-Versuchs sind damit noch nicht abgerechnet.
bereich: [orchestrierung, kontext, kosten, modellwahl]
stand: 2026-09-17
---

# Orchestrator-Kosten: Aufrufketten vor Modellvermutung

Die Owner-Beobachtung „20% weekly claude usage durchgebraten“ ist der Anlass, keine in dieser
Messung reproduzierte Kontostandsdifferenz. **Der größte hier belegte Ansatzpunkt sind die
Arbeitsketten nach Tool-Ergebnissen.** Weniger Nachrichten können helfen; ein kürzerer Broadcast
allein beseitigt diese Ketten nicht. Eine Rückkehr zu Fable lässt sich aus den vorhandenen Daten
nicht als Kontingentersparnis beziffern. Der Opus-Versuch ist ausdrücklich autorisiert
(`rulebook/einstieg.md:168`), kein Verstoß gegen die ältere Modellpolitik.

## 1. Was gemessen wurde – und welche Einheiten nicht addiert werden dürfen

Drei getrennte Rechnungen:

1. **Neue sichtbare Textmenge:** UTF-8-Bytes von Textnachrichten und Tool-Ergebnissen, einmal pro
   Eintrag/Resultat. Keine Tokenisierung, keine Kostenabrechnung. Nur für Szenarien wird **B/4** als
   ausdrücklich grober Token-Proxy benutzt; er gilt nicht für Bilder, Regeln oder Cache-Gewichtung.
2. **Verarbeitung:** `message.usage` aus Claude-Transkripten: neue Input-Token, Cache-Erstellung,
   Cache-Lesung, Output jeweils separat. Wiederholte Assistant-Blöcke derselben `message.id`
   zählen einmal, je Zähler mit dessen Maximum; `iterations` wird nicht nochmals addiert.
3. **Kontingent:** Wochenpunkte beziehungsweise Prozent fehlen je Request. Cache-Token und
   neue Token werden hier **nicht gleichgewichtet**, und API-Preise werden nicht als Abo-Formel
   ausgegeben. Aus einem großen Cache-Zähler folgt weder kostenlos noch gleich teuer.

**Breite Sichtung:** alle sechs im Auftrag genannten Ledger, Metadaten/Usage aller über den
Gründungstext zuordenbaren Haupt-Checkout-Claude-Transkripte, vorhandene Bash-Messung,
Start-Render und die fünf offenen Aufträge. Transkriptfenster: 07.09. 00:00 bis 17.09. 13:18 UTC;
keine Sidechains, keine Lane-Verzeichnisse. Rollenregel: erster User-Text beginnt mit
`[fleet Program-MAIN` → MAIN; sonst bekannte Orchestrator-Linie `f54c597761cdbf0e48fbc039`
oder `[fleet…` mit „Orchestrator“ in den ersten 3.000 Zeichen → Orchestrator.
Ergebnis: **41 MAIN- und 22 Orchestrator-Sessions**, 9.170 nichtsynthetische Message-IDs;
keine Message-ID doppelt über Dateien. Eine synthetische Antwort mit Nullzählern ausgeschlossen.
Das ist eine **positiv identifizierte Teilmenge**, keine Vollerhebung aller Rollen oder des Kontos.
Die Gründungstext-Regel ist Rollen-Provenienz, kein Beweis für jeden späteren Akt der Session.

**Verengung:** die vier bereits beendeten O1/O2/M1/M2 aus
`docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md:57`.
Dadurch unabhängiger Abgleich der Bash-Bytes mit einer vorhandenen Messung, keine Auswahl
besonders teurer Ausreißer. Deren Bash-Summen reproduzieren sich exakt. Im Folgenden bezeichnen
`O1:L24` usw. physische Zeilen der vollständigen Transkriptdateien unter
`~/.claude/projects/-Users-owner-claude-fleet/`:

| Kürzel | Datei | Zeilen | SHA-256 der gelesenen Datei |
|---|---|---:|---|
| O1 | `c21e730a-93ea-4424-9286-f00c82ea2ba9.jsonl` | 1.380 | `b56b924ea09f58930c230636a24a513ca62728bc540cd3ae924f3b50200c32c4` |
| O2 | `6ba575c0-939c-4263-8106-99481d7373b9.jsonl` | 1.604 | `2b44babdbeec614db3a68181deb4f3009724776811dcc87a459b2c6adb1ea6c2` |
| M1 | `2127fa4b-7ca7-4dd1-8061-b7bed71b0cf4.jsonl` | 1.189 | `19e31064b07a065b336f2e29f8c9df6173a834e4c4405b3e55cab0ceb3653bc8` |
| M2 | `f91abc28-e61b-4184-9e7d-2750b5658b37.jsonl` | 1.058 | `5d3d3a8bb6e878eebcef1622b87dc20b0b8f234a53add1519b6437a11c148670` |

## 2. Kostenaufteilung nach Kanal

### 2.1 Dieselben vier Sessions, zwei Ansichten

| Session | Modellaufrufe | neue Input-Token | Cache erstellt | Cache gelesen | Output-Token | Tool-Ergebnisbytes | Text-User-Bytes |
|---|---:|---:|---:|---:|---:|---:|---:|
| O1 | 182 | 364 | 334.784 | 41.945.551 | 166.955 | 237.197 | 25.629 |
| O2 | 183 | 366 | 594.606 | 43.862.822 | 178.723 | 241.503 | 12.325 |
| M1 | 163 | 326 | 275.703 | 34.017.016 | 103.290 | 238.538 | 18.545 |
| M2 | 133 | 266 | 277.241 | 29.528.667 | 102.103 | 255.744 | 20.435 |
| **Summe** | **661** | **1.322** | **1.482.334** | **149.354.056** | **551.071** | **972.982** | **76.934** |

Herleitung: je Datei alle nicht-Sidechain `assistant.message.usage`, nach Message-ID dedupliziert;
Resultatbytes per `tool_use_id` mit dem Aufruf verbunden; Text-User umfasst Gründung, Owner,
Agentennachricht, Event, Check-in und Skill-Expansion. Die 72 Text-User-Einträge sind also keine
72 menschlichen Eingriffe. Automatisch geladene Systemtexte/Attachments fehlen in dieser
Byte-Spalte, sind aber nicht aus den Usage-Zählern herausgerechnet. Skript in §8.

Tool-Ergebnisse sind **92,67 %** der hier sichtbaren neuen Textbytes:
972.982 / (972.982 + 76.934). Das ist **kein Anteil am gesamten Input**.
Cache-Lesungen sind **99,02 %** der gemeldeten Input-Verarbeitung:
149.354.056 / (149.354.056 + 1.482.334 + 1.322).

Für jeden neuen Assistant-Request wurde zusätzlich der unmittelbar vorausgehende
Gesprächseintrag klassifiziert; Tool-Ergebnisse sind separat von Text-User-Nachrichten.
Streaming-Blöcke derselben Antwort erzeugen keine neuen Requests:

| Unmittelbarer Vorgänger | Aufrufe | neuer Input | Cache erstellt | Cache gelesen | Output |
|---|---:|---:|---:|---:|---:|
| Text-User, einschließlich Gründung/Events | 68 | 136 | 531.032 | 16.342.668 | 55.527 |
| Tool-Ergebnis | 593 | 1.186 | 951.302 | 133.011.388 | 495.544 |

**89,71 % der Aufrufe** folgen auf Tools. Das ist ein Ablaufbefund, keine kausale Entlastung
der Nachrichten: Ein eingehender Auftrag kann eine lange Tool-Kette auslösen. Vier Text-User-
Einträge führen nicht zu vier weiteren Einzelrequests, etwa bei zusammen eintreffenden Texten
oder terminaler Notification; „Send = ein Request“ darf deshalb kein Join-Schlüssel sein.
Belege: vollständige vier Dateien; erste Usage-Zeile jeweils L24; konkrete Event-Antworten
M1:L278/L439/L496.

**Konkreter Kostenträger:** O2 enthält fünf nummerierte Check-ins (L647, L692, L790, L838, L864).
Bis zur nächsten Text-User-Nachricht folgen ihnen **6 + 7 + 7 + 4 + 14 = 38 Requests**, mit
9.457.468 Cache-Read-, 43.729 Cache-Create-, 76 neuen Input- und 30.976 Output-Token.
Zwei weitere MAIN-Check-ins: M1:L494 → 3 Requests, M2:L489 → 6 Requests.
Die Episoden enthalten auch sinnvolle Folgearbeit. **38 ist exponierte Last, keine nachgewiesene
Ersparnis.** Ob eine Rückmeldung einen Check-in ersetzt hätte, muss je Episode entschieden werden.

### 2.2 Die anderen Ledger erweitern die Sicht – sie sind keine MAIN-Abrechnung

Gelesene Präfixe am 17.09. um ca. 13:19 UTC; Zeiten der Ledger reichen unterschiedlich weit zurück.
Alle Zahlen sind Summen/Zählungen genau dieser physischen Zeilen, nicht auf eine Woche normiert:

| Kanal / Quelle | Messung und Herleitung | Grenze / Kosten |
|---|---|---|
| Sends, `audit.jsonl:33544`, `:33547`, `:33549`, `:33550`, `:33554` | 5 Zeilen: inbox-nudge 215 B, report-decision 668 B, owner 966 B, owner verweigert 0 B, brief 8.755 B; Summe 10.604 B, 4 observed | Der fünfte Send ist der neue Messauftrag selbst. Die ersten vier ergeben wie im Brief 1.849 B. Kein historischer Tagesdurchschnitt; Tokenpreis unmessbar. |
| Historische Zustellung, `audit.jsonl:1` bis `:33555` | `event` zählen: 752 fleet_event_delivered, 23.144 fleet_event_held, 582 watch_fire, 180 auto_fire | Held ist keine Zustellung; fire ist kein bestätigter Modellaufruf. Tokenkosten dieser historischen Events unkostiert. |
| Brief/Context, `context-receipts.jsonl:1` bis `:896` | Summe deliveredBytes = 6.974.314 B, Median 7.317,5 B; alle 896 haben branch | Hier **keine** von Lanes getrennte Orchestrator-/MAIN-Grundgesamtheit. Gelieferter Gesamtbrief, nicht nur Pack-Inhalt (`server.ts:12004`). Nutzung unmessbar. |
| Lane-Tool-Ergebnisse, `lane-outcomes.jsonl:1` bis `:1091` | 489 Zeilen mit toolResultBytes, erste :392; Summe total 187.453.043 B, davon Read 96.500.772, Bash 79.497.688, übrige 11.454.583 | Andere Population; nicht Orchestrator-Budget. Ergebnisbytes, keine Input-Replays; fehlende 602 Zeilen sind unknown. |
| Lane-Zeit, dieselben Outcomes | 701 numerische sessionMs; Summe 6.774.499.615 ms = 1.881,81 h | Aufenthaltszeit inkl. Warten, keine Modell-Rechenzeit; parallele Sessions nicht als Kalenderdauer lesen. |
| Karten, `cards.jsonl:1` bis `:377` | 166 Haiku-Läufe: 10.874.452 ms, 28 valid; 147 Sonnet-Läufe: 1.474.715 ms, 59 valid; 64 format: 0 ms, 37 valid | **313 Modellläufe, 3,43 h aufgezeichnete Laufzeit**. 218 Task-IDs, 68 mehrfach, 159 Einträge über ersten Versuch hinaus. Keine Tokenzähler; nicht alle Wiederholungen vermeidbar, kein fairer Haiku/Sonnet-Vergleich. |
| Reports, `fleet-reports.jsonl:1` bis `:366` | 219 kind=open: 482.520 UTF-8-Bytes in text; 147 kind=decision | Textproduktion/-ablage; nicht Zahl der tatsächlich gelesenen/zugsandten Reports. Kann in Tool- und Send-Bytes erneut auftauchen. |
| Archiv, `tasks-archive.jsonl:1` bis `:174` | 174 Archiv-Ereignisse | Auftragsgeschichte, kein Verbrauchssensor. Keine Kosten aus Textlänge des Archivs erfunden. |

Die Summe dieser Tabellen wäre falsch: Brief und Send können dieselben Bytes sein, Reports
werden später Tool-Ergebnisse, Outcomes betreffen andere Rollen. `auditSend` trägt vorab gemessenen
ctxPct, aber keinen Request-/Cache-Kostenzähler (`server.ts:6074`, `server.ts:6145`).

## 3. Die drei Verdächtigen

### (a) Opus 5 high statt Fable: Versuch bestätigt, kausaler Mehrpreis **unmessbar**

Die Politik samt Ausnahme steht direkt nebeneinander in `rulebook/einstieg.md:158` und `:168`.
Die Ausnahme fordert gleiche Lands/Lock-Reaps ohne zusätzliche Owner-Attentions, aber nennt keinen
Verbrauchsmesspunkt. Transkripte belegen tatsächlich benutzte Modelle statt nur Spawn-Wünsche:

| identifizierte Rolle / Modell, 07.–17.09. | Requests | neuer Input | Cache erstellt | Cache gelesen | Output |
|---|---:|---:|---:|---:|---:|
| Orchestrator / Opus 5 | 2.675 | 5.400 | 9.447.020 | 606.860.398 | 2.403.631 |
| Orchestrator / Fable 5.1 | 416 | 11.130 | 2.292.447 | 93.090.632 | 531.119 |
| MAIN / Opus 5 | 5.721 | 11.488 | 21.014.937 | 1.336.813.550 | 4.216.726 |
| MAIN / Fable 5.1 | 346 | 9.118 | 3.188.010 | 71.597.963 | 468.692 |
| Orchestrator / Sonnet 5 | 12 | 24 | 101.949 | 1.333.395 | 6.809 |

Herleitung: §1-Auswahl, dieselbe Usage-Aggregation wie §8, gruppiert nach Rolle und
`message.model`; ein Modellwechsel bleibt in seiner eigenen Gruppe. 20 der 22 Orchestrator-
Sessions enthalten Opus, 6 Fable, eine Sonnet; diese Mengen überlappen. MAIN entsprechend
36/41 Opus, 7/41 Fable. Breite Aggregation ist ein sekundärer Befund; die enger belegten vier
Dateien tragen die Handlungsempfehlung. **High** ist als Auftrag/Spawn-Einstellung belegt,
nicht als gemessener Effort jedes Requests. Usage modelliert hier keinen Effort-Vergleich.

Das misst den Umfang des Versuchs, nicht seinen Mehrpreis: verschiedene Aufträge, unterschiedlich
lange Fenster, wechselnde Modelle, kein gepaarter Kontrollarm, keine Claude-Wochenquoten je Request.
Ein schlichtes Verhältnis dieser Summen würde Arbeitsmenge mit Modelleffekt verwechseln.
Kein ausgedachter „Fable spart X %“-Wert. Ein Modellwechsel ist derzeit **unkostiert**.

### (b) Jeder Send kostet 250–350k erneut: als Pauschalrechnung **widerlegt**

**Bestätigter Kern:** In einer MAIN-Antwort nach einem Event wird viel Kontext verarbeitet.
M1:L276 → L278: 2 neue + 264 Cache-Create + 152.247 Cache-Read; Inbox L437 → L439:
2 + 140 + 175.108. Das sind weder stets 250–350k noch 250–350k neue Token. Das ursprüngliche
Dokument kennzeichnet die Behauptung selbst als ungemessen
(`docs/messungen/denksession-zusammenarbeit-2026-09-02.md:326`).

**Wie oft wirklich Broadcast?** In den 63 identifizierten Sessions wurde nach exakt gleichem
Text-User-String in verschiedenen Sessions innerhalb 60 s gesucht, ohne Gründungen,
Slash-/lokale Kommandos und Compiler-Prompts. **Ein Cluster mit drei MAIN-Empfängern**:
07.09. 00:33:04–05 UTC, identische Deploy-Vorankündigung. Keine Quote für die gesamte Flotte:
Paraphrasen, andere Rollen/Repos, andere Zeitabstände und nicht zugestellte Sends fehlen.
Das ist eine Untergrenze, nicht „nur ein Broadcast existierte“.

| Transkript / Eingang → erste Antwort | neuer Input | Cache erstellt | Cache gelesen | Output |
|---|---:|---:|---:|---:|
| `44ccae13-638d-4500-b09a-5e5792e3dde3.jsonl:600` → :602 | 2 | 299 | 236.443 | 1.669 |
| `5d09c2cf-2083-4a18-9a69-5e8af6c442d4.jsonl:741` → :744 | 2 | 230.750 | 26.448 | 479 |
| `c6ef73eb-71db-4499-a96f-9872e9c7b4e9.jsonl:282` → :285 | 2 | 144.044 | 26.448 | 590 |

Summe: 6 neu, 375.093 Cache-Create, 289.339 Cache-Read, 2.738 Output. Der gleiche Text trifft
unterschiedliche Cache-Zustände. Warum der Cache in zwei Fällen so klein war, ist **nicht**
gemessen. Drei adressierte MAINs sind auch keine dreifache Fehlzustellung: Empfänger benötigen
gegebenenfalls jeweils die Information. Bündelung spart primär mehrere Nachrichten **an denselben
Empfänger**, nicht die notwendige Zustellung an drei Entscheider. Kausale Kontingentersparnis
unmessbar; die belegte Verarbeitung oben ist kostiert.

### (c) Großer Antritt nur teilweise benutzt: Größe **bestätigt**, Nutzungsanteil **unmessbar**

**Gemessen, nicht geschätzt:** Quellbytes durch `wc -c`; dynamische Skriptausgaben einmal vollständig
in Scratch umgeleitet, dann `wc -lc`. Exit 0, stderr je 0 B. Die Skripte lesen den gemeinsamen
Datenbestand (`state.sh:21`, `register.sh:35`); Ausgabe ist zeitabhängig.

| Gegenstand | Quell-/Dateibytes | tatsächlich gemessene Ausgabe |
|---|---:|---:|
| `state.sh` | 36.932 | 137 Zeilen / 12.492 B |
| `register.sh` | 20.309 | 605 Zeilen / 60.285 B |
| `docs/controller.md` | 16.357 | statische Rollenkarte, kein zusätzlich ausgeführter Render |
| `rulebook.ts` | 6.503 | Renderer-Quellcode, nicht automatisch geladener Regeltext |
| `CLAUDE.md`, MAIN-Fassung | 78.195 | Dateigröße des tatsächlichen MAIN-Generats |
| `CLAUDE.md`, Lane-Fassung | 21.010 | andere Leserschaft, nicht MAIN-Baseline |
| `AGENTS.md` | 30.354 | davon Portable-operating-contract-Abschnitt 17.925 B inklusive Überschrift |

**Die beiden dynamischen Ausgaben zusammen: 72.777 B**, nicht die morgens in `10e2f7c0`
gemessenen 60.798 B. Keine Regression behauptet: anderes Zeitfenster, anderer Queue-Inhalt.
Bei vollständig gelesener Controller-Karte ergeben MAIN-Generat + portabler Pflichtabschnitt +
beide Ausgaben + Controller-Datei **185.254 B**. Das ist ein **additives Leseszenario**, kein
beobachteter vollständiger Wire-Prompt. Würde zusätzlich das ganze AGENTS.md gelesen,
wären es 197.683 B; das verlangt der Claude-Loader gerade nicht (`rulebook/loader.md:5`).
Die 6.503 B Renderer-Code und 57.241 B Shell-Quellcode gehören nicht zusätzlich in diesen Nenner.
MAIN erhält sieben Fragmente, Lane drei (`rulebook.ts:39`); Assemblierung `rulebook.ts:66`.

In O1/O2/M1/M2 erzeugen **26 Bash-Aufrufe mit state.sh/register.sh im Kommando 134.834 B**
Resultate, 13,86 % der Tool-Bytes. Das taggt ganze Kommandos, keine perfekte Inhaltszerlegung;
Mischkommandos und abgeschnittene Ausgaben bleiben eingeschlossen. Beispiel O1:
L25/L26 → L28/L30 (7.292 + 13.953 B), danach L40/L41 → L43/L45 (5.068 + 8.231 B).
Erst head/tail zu lesen und nachzulesen ist sichtbar; die semantische Nutzung jedes Blocks nicht.

„Von Session 8 nur der Recompute-Block benutzt“ bleibt **Owner-Beobachtung**, keine hier
reproduzierte Coverage-Messung. `state.sh:4` dokumentiert veraltete Handoff-Zahlen, nicht die
Nutzung aller damaligen Abschnitte. Nicht nochmals gelesen bedeutet nicht nicht benutzt:
Ein geladener Sicherheits-/Rollenvertrag kann eine Entscheidung steuern, ohne zitiert zu werden.
Context-Packs enthalten Anker/Purpose statt automatisch den gesamten Quelltext
(`context-packs.ts:41`, `:49`); `trigger-not-matched` ist weder Fehlrouting noch nutzloser Inhalt
(`context-plan.ts:84`). Ein behaupteter „ungenutzter Anteil“ wäre **unkostiert**.

## 4. Fünf Empfehlungen, mit Schnittlinie

Priorität folgt belegtem Ansatzpunkt und Eingriffskosten, **nicht** einer erfundenen Euro-Rangliste.
Alle Einsparungen sind prospektive Szenarien; keine davon wurde umgesetzt oder A/B-verifiziert.

| Rang | Schnitt / erwartete Wirkung | Ersparnis und Kosten |
|---|---|---|
| **1** | Eine Frage einmal beantworten: bestehende Dossier-/Audit-Türen nutzen; Check-in-Ketten nur bei fehlendem zuverlässigem Rückweg. Bestehende Aufträge 2cf40772/2f147b22 erledigen, keine neuen Parallelaufträge. | Größenordnung: Halbierung der O2-Check-in-Episodenlast entspräche **19 Requests, 4,729 Mio Cache-Reads, 21.865 Cache-Create, 15.488 Output-Token**. Das ist ein Rechenszenario, keine Behauptung, dass die Hälfte entfallen kann. Kosten: Rückweg je Episode prüfen, fachliche Entscheidungen und echte Deadlines erhalten; Integration/Tests der bestehenden Zeilen noch ungemessen. |
| **2** | 10e2f7c0 fertigstellen und die Startregel auf Kurzform plus gezielten Drilldown umstellen. Keine pauschale Vollerdung nach jedem Weckruf. | Zielbudget beider Kurzformen zusammen **8.000 B** statt heute 72.777 B: **64.777 B ≈ 16.194 Proxy-Token** weniger pro vollständiger Erdung, sofern kein Nachlesen nötig. Historische vier Sessions: 50 % der getaggten 134.834 B wären 67.417 B ≈ 16.854 Proxy-Token. Die Szenarien nicht addieren. Kosten: Rangfolge/Unknowns sinnvoll kürzen, Nachleserate beobachten; 40 Zeilen allein begrenzen keine Bytes. |
| **3** | Vor einem Modellentscheid vorhandene Transkript-Usage mit exakter Rollenidentität und Entscheidungsergebnis verbinden; kurzer gepaarter Vergleich Fable/Opus, bei normaler Nachfolge statt künstlichem Neustart. | Direkte Ersparnis des Sensors **0 Token**, Mehrpreis/Rückgewinn des Modellwechsels derzeit **unkostiert**. Kosten: deterministischer Parser, Zuordnungsprüfung und Datenschutz; Aufwand in Stunden unbekannt. Zwei vergleichbare abgeschlossene Arbeitspakete pro Arm als kleiner Start, nicht statistischer Wirkungsbeweis. Beide Arme nach verbrauchten Tokenklassen, Qualität/Owner-Eingriffen und erledigtem Ergebnis vergleichen. |
| **— Schnittlinie —** | **Jetzt die vorhandenen Türen/Kurzform nutzen und die Abrechnung vervollständigen. Darunter erst bei zusätzlichem Beleg investieren.** | Keine neue Queue, kein Produktionsumbau durch diese Notiz. |
| **4** | Modellarbeit an Karten erst nach deterministischer Formprüfung; strukturell fertige Karten nicht wieder semantisch kompilieren. | Obergrenze der berührten historischen Last **313 Modellläufe / 3,43 h**; nicht vollständig vermeidbar. 64 format-Einträge mit 0 ms zeigen den bereits vorhandenen Pfad. Ersparnis nach Task-Deduplizierung/Fehlerklasse noch **unkostiert**. Kosten: Fehlerklassen unterscheiden; sinnvolle Schärfung darf nicht entfallen. Keine neue Kartenarchitektur aus dieser Messung. |
| **5** | Broadcast-Koaleszierung und eigene Modell-/Rollenrender vorerst gezielt prüfen, nicht breit ausbauen. | Genau ein belegter Broadcast-Cluster trägt 375.093 Create + 289.339 Read; notwendige Empfänger bleiben. Wirkliche Einsparung **unkostiert**. Starttext-Szenario ist oben kostiert, sein entbehrlicher Anteil nicht. Kosten: verlorene Dringlichkeit, neue Profile und Regel-Drift; zuerst 76e08dd3/21ade485 auswerten. |

Die 19-Request-Rechnung priorisiert eine überprüfbare Kette. Sie beweist nicht, dass Warten die
Mehrheit der 593 Tool-Fortsetzungen bildet. Die Schwesteranalyse identifiziert zusätzlich
konkrete Hand-Joins; das ist unabhängige Evidenz für dieselbe Schnittstelle
(`docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md:32`).

## 5. Wörtliche Regel-/Rollenkarten-Vorschläge (nicht promoviert)

**Rollenkarte, Ersatz für den Erdungs-/Loop-Teil nach Verfügbarkeit der Kurzformen**
(`docs/controller.md:85`; Implementierungsabhängigkeit 10e2f7c0):

> Beim Antritt lies `state.sh --brief` und `register.sh --brief`. Danach benenne die konkrete Frage
> und lies genau die dafür nötige Quelle. Ein Weckruf startet keine neue Vollerdung. Vor einem
> zeitgesteuerten Check-in prüfe den vorhandenen Rückweg; ein zuverlässiger Rückweg ersetzt den
> Check-in. Ist kein Rückweg verfügbar, nenne Beobachtungsintervall und Stopplinie. Nach seiner
> Meldung lies den benannten Beleg und entscheide den kleinsten nötigen Akt.

**Regelbuch, Ersatz der ungemessenen Kostenbehauptung** (`rulebook/einstieg.md:161`):

> Eine Nachricht kann einen Modellaufruf und weitere Tool-Fortsetzungen auslösen. Kontextfüllstand,
> Send-Bytes, Cache-Lesungen, neue Token und Wochenkontingent sind verschiedene Größen. Behaupte
> keine festen Kontingentkosten pro Nachricht. Bündele nicht dringliche Informationen an denselben
> Empfänger, wenn daraus keine verspätete Entscheidung entsteht; notwendige andere Empfänger
> bleiben adressiert. Maßgeblich sind gemessene Request-Kosten und das erreichte Ergebnis.

**Modellversuch, Ergänzung der Erfolgskriterien** (`rulebook/einstieg.md:171`):

> Ein Modellversuch nennt Rolle, Aufgabenklasse, Vergleichsfenster und Rückfallkriterium. Erfasse
> je abgeschlossenem Ergebnis neue Input-, Cache-Create-, Cache-Read- und Output-Token sowie
> zusätzliche Owner-Eingriffe und Reparaturen. Fehlt die Zuordnung zum Wochenkontingent, bleibt
> die Kontingentersparnis unknown. Ein größeres Rohvolumen beweist keinen höheren Modellpreis.

**Brief-Kostenklemme** (Anschluss an `docs/tailored-context.md:36` und `:90`):

> Liefere die Frage, den relevanten Ausschnitt, die Belegstellen und das prüfbare Ergebnis.
> Bereits entscheidungsfähige Fakten werden nicht erneut als Prosabericht bestellt. Der Empfänger
> liest Diff und Verify selbst; der Brief dupliziert weder Vollregister noch sämtliche Rollenregeln.

## 6. Was diese Notiz den fünf offenen Zeilen hinzufügt

Volltexte der lebenden Task-Zeilen am Messzeitpunkt gelesen, anhand ihrer IDs abgelegt und
abgeglichen; keine Zeile erzeugt, geändert oder dispatcht. Die IDs sind die Quellen der
folgenden Auftragsabgrenzung, ihre Messbehauptungen nicht still als eigene Messung übernommen.

| vorhandene Zeile | deren Gegenstand | hier neu |
|---|---|---|
| `10e2f7c0` | 40-Zeilen-Kurzformen/Größenkopf state/register, morgens 60.798 B | erneuter vollständiger Render 72.777 B; 134.834 historische Resultatbytes; Bytebudget und Nachleserate zusätzlich zur Zeilenzahl |
| `2cf40772` | task-ID als Dossier-Schlüssel, ctl task | Einordnung der Hand-Joins in 593 Tool-Fortsetzungen; keine zweite Dossier-Spezifikation |
| `2f147b22` | ctl audits; 804 Rohlesungen gegen 25 Routenlesungen | Request-/Cache-Rechnung, die der bisherigen Bash-Byteanalyse fehlt; keine erneute 14-Tage-Rohlesungszählung |
| `76e08dd3` | weggelassene Packs gegen spätere manuelle Lesungen joinen | trennt gelieferte Bytes, Lesezugriff und Entscheidungsnutzen; MAIN-Kaltstart ist andere Population. Kein paralleler Pack-Join. Nicht-Nachlesen allein beweist keine optimale Auslassung. |
| `21ade485` | Profile je Modellklasse/Rolle | tatsächliche Modell-Usage, fehlender Kontingent-Nenner und konkrete Vergleichskriterien vor Profilbau |

## 7. Was heute nicht messbar ist und welcher Sensor fehlt

| Frage | vorhandener Beleg reicht nicht | kleinster fehlender Sensor |
|---|---|---|
| Welche Arbeit verbrauchte die 20 Wochenpunkte? | Usage ist Verarbeitung, Owner-Zahl ohne Zeitpaar | Kontostand vor/nach bekanntem Fenster inkl. Reset/Limitklasse; parallele Sessions getrennt. Ohne vom Provider gelieferte Gewichtung nur experimentelle Zuordnung, keine exakte Request-Abrechnung. |
| Wie viel billiger wäre Fable? | ungleiche Aufträge/Zeitfenster, kein Effort-Gegenversuch | gepaarte Arbeitsergebnisse, Modell+Effort je Request, gleicher Qualitätsmaßstab und Quotenbeobachtung |
| Welche Sendung löste welche Requests aus? | send hat path/bytes/ctxPct; Slotnummer ist wiederverwendbar | Send-ID, exakte Occupant-/Session-ID und zustellungsseitige Message-ID; 0/1/n Request-Zuordnung, Trigger und Tool-Kette getrennt |
| Wie viele Broadcasts sind überflüssig? | exakte Textgleichheit erkennt keine semantischen Dubletten; junge Sends | Broadcast-/Entscheidungs-ID, Empfängermenge, Dringlichkeit, Koaleszierung je Empfänger; einmalige fallbezogene Prüfung statt neuer LLM-Klassifikator |
| Welcher Startblock wird benötigt? | Bytes und Ankerquittung messen Lieferung | Block-ID/Hash, tatsächlich gelieferte und später gelesene Bereiche; für Nutzen zusätzlich Fehler-/Entscheidungsvergleich bei Weglassen. Kein Zugriff ist kein Beweis für Nutzlosigkeit. |
| Was kosten Karten/Reports dem MAIN? | cards.ms, Reporttext und Lane-Outcomes messen andere Dinge | Compiler-Request-Usage plus Task-ID; tatsächliche Report-Lese-/Antwortkette im Empfängertranskript |

Adapter-/Oberflächenentscheidung für diesen Messvorschlag: **Claude-Transkript apply** (Usage
vorhanden), **Fleet-Server apply** für Identitäts-/Send-Join; **Codex/Pi für Claude-Kontingent
not-applicable**, deren eigene Kosten damit nicht Null. **Board/Client hier not-applicable**
(erst eine korrekte Messzeile, keine Dashboard-Arbeit). **Provider-Quotengewichtung unsupported
mit den gelesenen Daten**. Rückzustand über Transkript-IDs apply; heutiges ctxPct ersetzt ihn nicht
(`ctl.sh:498`). Docs/Proben apply erst bei Umsetzung, hier nur dieser reproduzierbare Befund.

**Nicht gelesen:** vollständiges privates CLAUDE.md, private Deploy-/Supervisor-/Scheduling-Texte
(nur Bytes gezählt; Loader und benannte Einstiegs-/Modellpolitikstellen gelesen), historisches
Session-8-Handoff und dessen komplettes Folgetranskript, sämtliche Tool-Inhalte der 63 Sessions,
Sidechains/Subagents, andere Repo-Transkripte, Codex-/Pi-Verbrauch, Browser-/Provider-Kontoseiten,
alle Audit- und Land-Diffs, die gesamte Context-Implementierung samt Tests. Der Main-Graph wurde
read-only abgefragt; Quellenstellen wurden danach direkt gelesen. Keine Aussage über ungelesene
Semantik, keine neue verbindliche Regel und keine Modellumstellung.

## 8. Reproduktionskern und Ledger-Präfixe

Der folgende rein lesende Kern reproduziert die zentrale Vierer-Tabelle. Abbruch bei fehlender
Datei, ungültigem JSON, nicht zuordenbarem Resultat oder unbekanntem Antwort-Vorgänger; er
schreibt weder in Transkripte noch in den Main-Checkout. Zahlen aus verschachtelten iterations
werden ausdrücklich nicht addiert. Für Tool-Resultat-Listen ist die kompakte JSON-Darstellung
der Byte-Proxy; in dieser Stichprobe stimmen die Bash-Bytes mit der früheren Messung überein.

```python
import json
from pathlib import Path
from collections import Counter, defaultdict

root = Path.home() / '.claude/projects/-Users-owner-claude-fleet'
ids = {
    'O1': 'c21e730a-93ea-4424-9286-f00c82ea2ba9',
    'O2': '6ba575c0-939c-4263-8106-99481d7373b9',
    'M1': '2127fa4b-7ca7-4dd1-8061-b7bed71b0cf4',
    'M2': 'f91abc28-e61b-4184-9e7d-2750b5658b37',
}
fields = ['input_tokens', 'cache_creation_input_tokens',
          'cache_read_input_tokens', 'output_tokens']
expected = {'O1': (182, 237197, 25629), 'O2': (183, 241503, 12325),
            'M1': (163, 238538, 18545), 'M2': (133, 255744, 20435)}
channels = defaultdict(Counter)
total = Counter()
for label, sid in ids.items():
    rows = [json.loads(line) for line in (root / (sid + '.jsonl')).read_text().splitlines()]
    usage, calls, results, predecessor = {}, {}, {}, {}
    last, userbytes = None, 0
    for row in rows:
        if row.get('isSidechain'):
            continue
        msg = row.get('message', {})
        content = msg.get('content', [])
        blocks = content if isinstance(content, list) else []
        if row.get('type') == 'user':
            only_results = bool(blocks) and all(b.get('type') == 'tool_result' for b in blocks)
            last = 'tool-result' if only_results else 'text-user'
            txt = content if isinstance(content, str) else ''.join(
                b.get('text', '') for b in blocks if b.get('type') == 'text')
            userbytes += len(txt.encode())
        for block in blocks:
            if block.get('type') == 'tool_use':
                calls[block['id']] = block.get('name')
            if block.get('type') == 'tool_result':
                value = block.get('content', '')
                txt = value if isinstance(value, str) else json.dumps(
                    value, ensure_ascii=False, separators=(',', ':'))
                results[block['tool_use_id']] = len(txt.encode())
        if row.get('type') != 'assistant' or not msg.get('usage'):
            continue
        key = msg['id']
        if key not in usage:
            assert last in ('text-user', 'tool-result'), (label, last)
            predecessor[key] = last
            usage[key] = Counter()
            last = 'assistant-continuation'
        for field in fields:
            usage[key][field] = max(usage[key][field], msg['usage'].get(field, 0) or 0)
    assert set(results) <= set(calls), label
    sums = sum(usage.values(), Counter())
    assert (len(usage), sum(results.values()), userbytes) == expected[label], label
    print(label, len(usage), *(sums[f] for f in fields), sum(results.values()), userbytes)
    for key, counts in usage.items():
        channels[predecessor[key]].update(counts)
        channels[predecessor[key]]['requests'] += 1
    total.update(sums)
for name, counts in sorted(channels.items()):
    print(name, counts['requests'], *(counts[f] for f in fields))
assert total['cache_read_input_tokens'] == 149354056
assert total['output_tokens'] == 551071
print('MEASUREMENT ALL PASS')
```

Ausgeführt: obiger Kern endet wörtlich mit `MEASUREMENT ALL PASS`.

Die breitere Modell-Tabelle lässt sich mit diesem zweiten Kern unabhängig nachrechnen.
Er liest nur Dateien, deren Änderungszeit mindestens am Beginn des Fensters liegt,
filtert die Einträge aber zusätzlich nach deren eigener Zeit. Keine Ausgabe von Prompttexten:

```python
import json
from pathlib import Path
from collections import Counter, defaultdict

root = Path.home() / '.claude/projects/-Users-owner-claude-fleet'
start, stop = '2026-09-07T00:00:00', '2026-09-17T13:18:00'
fields = ['input_tokens', 'cache_creation_input_tokens',
          'cache_read_input_tokens', 'output_tokens']
counts, roles, seen = defaultdict(Counter), Counter(), set()
def text(content):
    if isinstance(content, str):
        return content
    return ''.join(b.get('text', '') for b in content if b.get('type') == 'text')
for path in root.glob('*.jsonl'):
    if path.stat().st_mtime < 1788739200:
        continue
    rows = [json.loads(line) for line in path.read_text().splitlines()]
    rows = [r for r in rows if not r.get('isSidechain') and r.get('timestamp', '') < stop]
    first = next((text(r.get('message', {}).get('content', []))
                  for r in rows if r.get('type') == 'user'), '')
    if first.startswith('[fleet Program-MAIN'):
        role = 'main'
    elif ('f54c597761cdbf0e48fbc039' in first[:500] or
          (first.startswith('[fleet') and 'Orchestrator' in first[:3000])):
        role = 'orch'
    else:
        continue
    usage = {}
    for row in rows:
        msg = row.get('message', {})
        if row.get('timestamp', '') < start or row.get('type') != 'assistant':
            continue
        if not msg.get('usage') or not msg.get('id'):
            continue
        key = msg['id']
        item = usage.setdefault(key, {'model': msg.get('model'), **dict.fromkeys(fields, 0)})
        for field in fields:
            item[field] = max(item[field], msg['usage'].get(field, 0) or 0)
    if not usage:
        continue
    roles[role] += 1
    assert not (set(usage) & seen), 'duplicate message ID across sessions'
    seen.update(usage)
    for item in usage.values():
        if item['model'] == '<synthetic>':
            continue
        group = counts[(role, item['model'])]
        group['requests'] += 1
        for field in fields:
            group[field] += item[field]
print('roles', dict(roles))
for key, value in sorted(counts.items()):
    print(*key, value['requests'], *(value[f] for f in fields))
assert roles == {'main': 41, 'orch': 22}
assert sum(c['requests'] for c in counts.values()) == 9170
assert counts[('orch', 'claude-opus-5')]['cache_read_input_tokens'] == 606860398
print('MODEL CENSUS ALL PASS')
```

Ledger-Präfixe sind durch Zeilenzahl oben begrenzt; SHA-256 über UTF-8 mit genau einem LF nach
jeder Zeile. Sie identifizieren die gelesenen Bytes, beweisen aber weder Zustellung noch Nutzung:

| Ledger | SHA-256 des Präfixes |
|---|---|
| audit | `10fbd950a359a72c5d0982fce4daeafd9e4ce06f125182a841e1266d91660062` |
| context-receipts | `d9fe8d5bd9b0e62efa0a90781874173744bd1f31e56b443960d86c3b726b0d64` |
| lane-outcomes | `82279f0d0227589f942b5eb40d7ee8e08d71ec3041ce56741ae025356dc9d534` |
| cards | `d01b83b89e00fd51b3b1d07cf556a8285549fc232b7c0b0ed705dbd8f9eaa622` |
| fleet-reports | `0a37f53d8a879b944d2c3067e5ac31e5d0f5bfa9e655c5629ffeac7ead3555da` |
| tasks-archive | `7b3218e7b205d636645ba8220df0acab1d406889faa83dec6c25c9596b1e78d3` |

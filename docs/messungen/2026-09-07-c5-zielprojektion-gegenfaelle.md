---
frage: Welche sechs Gegenfälle muss eine gemeinsame Zielprojektion für Hub und Rollen-Kontext unterscheiden?
urteil: Gate, Reportentscheidung, Land und Audit sind getrennt belegbar; GLM wurde vor dem Land abgelehnt, S2D erst danach. Kandidatenbindung, Kriterienabdeckung und Quellenverlust bleiben eigene Beweisfragen.
bereich: [zielprojektion, audit, coverage, kontext]
stand: 2026-09-17
---

# C5 — sechs Gegenfälle zur Zielprojektion

Die sechs Fälle unten sind rekonstruiert: Fälle 1–3 aus historischen Records, Fall 4
mit historischer Annahme und synthetischem B, Fall 5 als anonymisierte Vertragsfixture,
Fall 6 mit realem Retentionsverlust und synthetischen Verlustvarianten. Der frühere
Stand dieses Dokuments belegte nur Fälle 2 und 4. Seine Kontrollfälle bleiben erhalten;
die damaligen Aussagen „selbst geprüft“ werden hier durch erneut ausgeführte Proben ersetzt.

**Eine historische Behauptung ist widerlegt:** Beim GLM-Land `f781c60` lag die
Ablehnung bereits vor dem Land. Die spätere GLM-Notiz und der Korrekturbrief erzählen
die Reihenfolge anders. Fall 3 verwendet deshalb S2D, dessen Land tatsächlich vor
der Ablehnung liegt. Eine grüne Gate-Notiz belegt weder fachliche Annahme noch
Program-Erfolg. Ein Audit mit `result: unknown` ist kein roter oder grüner Audit.

## Quellenstand und Leserabdeckung

Code und getrackte Dokumente: einmaliger main-Pin
`45f1dc6534889968c5be0d8a1e532286f38595fe` (im Folgenden **Q**).
Historische Records behalten ihre eigenen Zeitfelder; die Lesung vom 17.09. ist
keine rückwirkende Beobachtung des gesamten Betriebs. Private Originalquellen bleiben
außerhalb des Repos. Die Kürzel sind Belegreferenzen, keine neuen Fleet-Objekte.

| Kürzel | Quelle und tatsächlich gelesener Ausschnitt | Grenze |
|---|---|---|
| O | `lane-outcomes.jsonl`, Zeilen 821, 825, 840, 854, 855, 867; nach Task-ID selektiert | Append-Records belegen diese Lands, keine vollständige Taskgeschichte. |
| N | `git notes --ref=fleet/land show f781c60`, vollständige JSON-Note | `verify.out` ist bereits gekürzt; kein vollständiges Originallog des Gates. |
| U / G | `post-land-audits.jsonl:513` (`at=1788763378705`) / `:529` (`at=1788821145946`), jeweils komplette ausgewählte Zeile | `out` ist ein gespeicherter Tail, kein unbegrenzt vollständiger Lauf. |
| H0 / H1 / H2 / H3 | Historische Tool-Ausgaben: H, Zeilen 2391 / 2448 / 2474 / 2560, aufgenommen 07.09. 05:29:17.626 / 05:34:52.225 / 05:43:05.331 / 07:15:56.848 UTC | H0 liest Self-Projektion und Reports; H1 druckt die Projektion nur bis 14 500 Zeichen, den GLM-Report separat vollständig. H2 bestätigt den gelandeten Task mit rejected. H3 liest Projektion sowie ausgewählte Taskfelder aus `fleet.json`. Kein vollständiger historischer State-Snapshot. |
| A | Historische Tool-Ausgabe P, Zeile 640, 07.09. 13:08:48.089 UTC, Report-ID `c89b59e7b4f2fecea8fcd2e9` | Aus Self-Report-Lesung: ID, Status, Entscheidung samt Begründung; kein kompletter Report und kein unabhängig nachgespielter Review. |
| R | `audit.jsonl:6490` / `:9206`, `fleet_report_prune`, GLM-/P1-Report; heutiges `fleet.json#fleetReports` | 120 aktuelle Reports gelesen; historische Entscheidungen dort nicht mehr vorhanden. Prune belegt Entfernung aus diesem Bestand, keine globale Vernichtung. |

H = `$HOME/.codex/sessions/2026/09/05/rollout-2026-09-05T08-12-40-01a07032-9f07-7362-a142-f61da6770e4f.jsonl`.
P = `$HOME/.codex/sessions/2026/09/07/rollout-2026-09-07T10-43-09-01a07b09-19cf-7883-a328-4a4f44a80bd9.jsonl`.
Die Methode prüft die SHA256 der benutzten einzelnen JSONL-Zeilen ohne Zeilenende.
Diese Hashes versiegeln aufgezeichnete Tool-Ausgaben, nicht deren unabhängige
Authentizität. Die vorangehenden Tool-Aufrufe wurden auf Quelle und Auswahl gelesen.
Ein frischer Klon ohne diese privaten Dateien kann die historische Hälfte nicht ausführen.

Zur Orientierung wurde Graphify am Hauptcheckout gelesen: 173 gefundene Knoten,
52 angezeigt; der begrenzte Ausschnitt ist keine Abdeckungsbehauptung. Danach
gezielte Symbol-/Bereichslesung mit `rg -a` und `sed`; `server.ts` enthält ein NUL-Byte,
wodurch gewöhnliches `rg` die Quelle als binär behandeln kann.

Gelesene Vertrags-/Vorschlagsquellen: `9f36f08:docs/messungen/2026-09-07-datenlayer-ordnung-bericht.md`
§4.5/§5.5, Vorschlag, keine Autorität;
Q:`docs/fleet-hub-overlay-2026-09-06.md:64–102`, Projektion ohne eigenen Zustand;
Q:`docs/messungen/2026-09-06-plan-luecken-register.md:1–63`, Program-Abschluss ist
nicht Erfüllung späterer Ziele. S2D wurde in der aktuellen korrigierten Fassung
selektiv gelesen: Q:`docs/messungen/2026-09-06-astra-s2d-kontextkette.md:1–49,260–326`.
Der Korrekturvermerk nimmt den zirkulären Spawn-Drift-Beweis zurück und stuft die
erste zutreffende Auslassungsursache nicht als Routingfehler ein. `56e4427d` ist
hier eine **Task-ID**, kein Git-Pin; O:854 belegt ihr Land
`f03745ec154a3123341c0ae6211e9ffcdc6e4642`. Keine neue Gesamtlesung der S2D-Messung.

## Sechs Ergebnisse, getrennte Dimensionen

„Unknown“ bezeichnet die fehlende Relation im jeweiligen Eingabefenster, nicht eine
Ablehnung. „Program-Erfolg unknown“ lässt einen gespeicherten Program-Status stehen;
er wird lediglich nicht aus einem einzelnen Land oder Report hergeleitet.

| Fall / Eingabe | Gate | Fachliches Urteil | Kandidat / Land | Audit-Coverage und Urteil | Program-Erfolg / fehlende Relation |
|---|---|---|---|---|---|
| 1 · GLM, N/O/H1/H3 | `ok=true`, proportional install+pins | Report `f70e70dd21633bd2292f74a9` rejected; Korrektur `1d0f4ca4` später im historischen Snapshot queued | Land `f781c600…`; pre-rebase `fb470c67…` hat dieselben Dokumentbytes, aber keine strukturierte Report→Commit-Bindung | U deckt Land explizit; anderer Tip; unknown | unknown: Task→einzelnes Program-Kriterium und Annahme der exakten Bytes fehlen. |
| 2 · koaleszierter Audit U, Kontrolle G | GLM-Gate grün; kein Ersatz für Audit | GLM bleibt rejected | U:`mainAfter=f781c600…`, `mainSha=5b676958…` | covers vorhanden, Ancestry Exit 0; U unknown; G separat green auf anderem Tip | unknown: kein messbares U-Urteil; Coverage beweist keine fachliche Annahme. |
| 3 · S2D, O:821/H0/H1 | Outcome `verified=true`; Gate-Originallog hier nicht nachgeprüft | zunächst unentschieden, später rejected | `10048325…` bleibt historisch landed | eigener Audit in diesem Fall nicht zugeordnet: unknown | unknown: Transport/Lesen ersetzt Entscheidung nicht; kein kriterienspezifischer Abnahmebeleg. |
| 4 · A plus synthetisches B | P1-Land O:840 `verified=true`; B ungemessen | A accepted mit SHA/Dateihash in Entscheidungsprosa; B unknown | A:`d05244e5…`; Rebase-Land `9e766050…` dateigleich; B hat keinen erzeugten Commit | B keine Coverage; A in diesem Fall nicht zugeordnet: unknown | unknown: A-Annahme bindet B nicht; Dateigleichheit ist keine Annahme des gesamten Rebase-Baums. |
| 5 · synthetischer Nachfolger, P2-Vertrag | nicht gemessen | Report R weiterhin offen | kein Kandidat oder Land in Fixture | nicht gemessen | unknown: fachliche Pflicht über P bleibt sichtbar; neue Entscheidungsbefugnis nur aus aktueller Bindung, kein altes ACK. |
| 6 · R plus Quellenverlustvarianten | aus fehlender Quelle nicht ableitbar | historisches GLM-rejected lesbar in H1, im aktuellen Reportbestand nicht | historische Lands bleiben über O lesbar | positive Kontrolle G trifft; fehlender Ausschnitt bleibt unknown | unknown mit Grund: retained-window, unavailable, unreadable oder partial-read; kein globaler Nichtexistenzschluss. |

### 1. GLM: grün gelandet, bereits abgelehnt, Korrektur damals offen

H1 enthält den Report `f70e70dd21633bd2292f74a9`, `reportedAt=1788758940344`,
Provenance Task `746513d1`, Program `eec695280b9ca5a84824eec0`, und
`decision.disposition=rejected`, `decision.at=1788759046280`.
Die Begründung verlangt begrenzte Textkorrekturen, unter anderem an Abschnittsgröße,
Graphify-Schluss und fehlendem Originalverify-SHA/-Pfad. Das ist die gespeicherte
fachliche Rückgabe; `status=complete` des Workers bleibt eine andere Aussage.

| Zeit UTC, 07.09.2026 | Gemessener Fakt | Beleg |
|---|---|---|
| 05:29:00.344 | Report gefilet, noch kein Entscheid in H0 | `reportedAt`, H0 |
| 05:30:46.280 | rejected | `decision.at`, H1 |
| 05:42:49.983 | Land-Note datiert | N:`at=1788759769983` |
| 05:42:50.078 | Outcome landed, verified=true | O:825:`ts=1788759770078` |
| 07:15:56.848 | Korrektur `1d0f4ca4` queued, gleiche Program-ID | H3, Tool-Erfassungszeit; keine Behauptung über ihre gesamte Zwischenzeit |

N nennt `mainBefore=2dfaa814fe07e1b4553d3dd38584e82fe329e539`,
`mainAfter=f781c600c7a4c4c46a01f721d83cc997c447c639`, `verify.ok=true`,
`exitCode=0`, `proportional=true`, `steps=[install,pins]`, `ms=748`.
**Das Feld `verify.mainSha` nennt den mainBefore-Baum**, nicht den Land-SHA.
Die Note ordnet das Gate dem Land zu; dieses Feld allein ist kein Nachweis eines
exakten geprüften Kandidaten. Ihr gespeicherter stdout-Tail enthält `ALL PASS`,
danach folgen stderr-Zeilen. Der ursprüngliche Lane-Logpfad bleibt unbekannt.

Git löst `fb470c67e4e6eec7e9db273adfc1408664591112` auf. Dessen GLM-Dokumentblob
und der Landblob haben beide SHA256
`109fdf4bb6e070c9112a981f589d4604a8ba0a8cb517878f6d311231ee5b11a6`.
Die Zuordnung als pre-rebase-Kandidat stammt aus der späteren Notiz
Q:`docs/messungen/2026-09-06-kontext-gesundheit-glm.md:62–76` und dem Gitvergleich;
der Originalreport nennt keinen eigenen Kandidaten-SHA. Bytegleichheit schließt
diese fehlende strukturierte Herkunftskante nicht.

Gegenprobe: Methode C1 verknüpft Report, Outcome und Korrektur über vorhandene IDs,
prüft Entscheidung vor Land, Gate-Note und Blobgleichheit. Damit widerlegt sie die
Chronologie in Q:`docs/messungen/2026-09-06-kontext-gesundheit-glm.md:18–20` und
im H3-Korrekturbrief, die das Land vor die Ablehnung setzen. Es ist keine gemessene
Uhrensynchronisationsanalyse; verglichen werden die persistierten Server-Zeitfelder.

Spätere Korrekturen, getrennt vom obigen Fenster: O:855 belegt `1d0f4ca4` landed
als `7539985dbf18c9293f91ab87c6ffd144ad218823` bei `1788826968654`; O:867 belegt
`6e1caad8` landed als `45622dbf07c6288ce198ec34fb06df22d8c1d3ef` bei
`1788862209776`. Diese Lands ändern den damaligen queued-Record nicht. Ihre eigene
fachliche Annahme ist in C1 nicht nachgeprüft. Kosten der Verwechslung: Ein Integrator
kann eine offene Textkorrektur als erledigt behandeln, weil das Original bereits landet.

### 2. Audit auf anderem Tip, ohne Urteil; positive Kontrolle mit Urteil

| Dimension | U: historischer unknown-Fall | G: positive Kontrolle |
|---|---|---|
| Land / `covers[].mainAfter` | `f781c600c7a4c4c46a01f721d83cc997c447c639` | `75939cf4e0f22eaee02cc8f82f64120202700a60` |
| Audit-`mainSha` | `5b676958d3054c5c617904f06468855a10c96fda` | `9d09cb6bd3550f75e0ca73c8c45e98ea9fb0c153` |
| Weitere Covers | `2dfaa814fe07e1b4553d3dd38584e82fe329e539` | kein zweites Cover in dieser Zeile |
| Start / Abschluss (Unix-ms) | `1788760678358` / `1788763378705` | `1788821143819` / `1788821145946` |
| Urteil / Exit / Checks | unknown / null / null | green / 0 / 457 ausgeführt, 0 fehlgeschlagen |
| Umfang | konfigurierte isolierte Kette, kein Abschlussbeleg; nur GLM-Cover proportional | Audit selbst proportional, steps install+pins |
| Gespeicherte Ausgabe | enthält `acquired after 1576s`; kein ALL PASS | endet auf `ALL PASS` |

U nennt `audit timed out after 2700000ms — no verdict`, `ms=2700347`.
Weder dieser Wallclock-Wert noch das Kommando beweist vollständig ausgeführte
Prüfungen. Der Join prüft dasselbe Repo und explizites Cover; beide Git-Ancestry-Proben
Land→Audit-Tip liefern Exit 0. `mainSha == mainAfter` wäre bei beiden falsch.
Die Kontrolle G war auch schon im Vorgängerdokument enthalten; hier wird sie erneut
am Ledger gelesen. Ihre grüne Kurzkette ersetzt U nicht.

Gegenprobe: Covers entfernen oder das Repo wechseln ergibt unknown-Coverage.
Ein ausschließlich im Speicher auf red geändertes U ergibt present/red; unverändertes
U bleibt present/unknown. Kosten eines Gleichheitsjoins: Beide vorhandenen Beziehungen
verschwinden. Kosten eines `checks.failed ?? 0`: U erscheint ohne Messung erfolgreich.

### 3. Tatsächliches Land vor fachlichem Review: S2D

O:821 verbindet Task `457511cc` mit Land
`10048325b0f2972d78c14470baff739644f1ae18`, `ts=1788750654467`
(07.09. 03:10:54.467 UTC). H0 zeigt später denselben Task bereits gelandet,
aber Report `1a32f500dd73c2b77a750aed` noch mit `disposition=null`.
H1 zeigt `rejected`, `decidedAt=1788759046271` (05:30:46.271 UTC).
Das ist eine echte Reihenfolge Land→offene Entscheidung→Ablehnung.

Gegenprobe: C3 vergleicht die Recordzeiten und die Kandidaten-/Land-ID. Eine
zusätzliche anonymisierte Eingabe `{transport: acknowledged, read: true}` ohne
Decision bleibt unknown; mit explizitem accepted wird accepted erkannt. Diese
Transportvariante ist synthetisch: Ein damaliger menschlicher Lesezeitpunkt oder
vollständiger Event-ACK-Verlauf wird hier nicht behauptet. Kosten der Gleichsetzung:
Die spätere Rückgabe verschwindet hinter dem bereits terminalen Task.

### 4. Kandidat B nach Annahme von A

A dokumentiert Report `c89b59e7b4f2fecea8fcd2e9`, accepted bei `1788781866224`.
Die Begründung nennt Commit `d05244e538b8e60eaa74d4d36128c6342ad49459` und
SHA256 `185b5295de7d0b188c28cb91240efe7bbc387c861b5c44040caf163c78088772` für
`docs/messungen/2026-09-07-verifikation-zielbild.md`. Die Probe berechnet den Hash
am Gitblob erneut. Dieselben Dokumentbytes stehen im Rebase-Land
`9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2`; die Commit-IDs unterscheiden sich.

B entsteht ausschließlich im Speicher durch einen angehängten Absatz an A.
Es gibt keinen Commit B, keine B-Reportentscheidung und keinen B-Land. Der Reader
erkennt den positiven A-Fall, verweigert dieselbe Annahme für B und bei fehlendem
geprüften Hash. Die fachliche SHA-/Hash-Bindung wurde aus der gelesenen Begründung
entnommen; sie ist **keine strukturierte Serverrelation**. Auch Bytegleichheit der
einen Datei beweist keine fachliche Annahme des übrigen Rebase-Baums.
Kosten einer nur nach Task/accepted projizierten Entscheidung: Neue Bytes erhalten
ungerechtfertigt das alte Urteil.

### 5. MAIN-Nachfolge mit offener Entscheidung

Die minimale Fixture im Methodenblock hat Program P, offenen Report R und alte/neue
Occupants. Sie prüft: dieselbe Program-Pflicht sichtbar, Entscheidung nur für die
aktuelle Bindung, kein ACK-Recht am alten Event. Fremdes Program Q verliert den
Join; der alte Occupant verliert die aktuelle Entscheidungsbefugnis.

Das konsumiert P2, Q:`docs/messungen/2026-09-07-adressierbarkeit-vertrag.md:21–39`
und §P2-I2/S3b ab Zeile 136, statt einen neuen Nachfolgevertrag einzuführen.
P2 ist als Vertragsentwurf gekennzeichnet; seine damaligen Aussagen über fehlende
Producer sind keine aktuelle Produktmessung.

Die aktuelle Lesung trennt ebenfalls die Quellen: Q:`server.ts#latestReportFor:2212–2226`
verbindet Task und Program ohne alten Occupant; `#decideFleetReport:8876–8933`
leitet bei `basis=program` die Befugnis aus aktueller Programbindung ab und verweigert
eine zweite Entscheidung. `#boundProgramForMain:9542–9552` verlangt die aktuelle
aktive Bindung; `#acknowledgeFleetEvent:8700–8721` schützt das alte Event separat.
Legacy-Reports mit `basis=program-main` behalten die alte Receiver-Grenze; die
Fixture modelliert den **Program-adressierten** Fall, keine Migration alter Reports.

Gegenprobe C5 ist ein ausgeführter semantischer Reader, kein Server-/Token-Test und
kein Nachweis einer realen Succession. Eine vollständig korrelierte historische
Nachfolge mit offener Entscheidung wurde hier nicht erhoben. Kosten der falschen
Übertragung: Ein Nachfolger könnte die Pflicht verlieren oder eine fremde
Transportquittung als eigene Handlung ausgeben.

### 6. Rotierter Record und begrenzte Lesung

R belegt die Entfernung des GLM-Reports bei `1788803220794` und des P1-Reports bei
`1788844130300`. In den 120 heute gelesenen `fleetReports` fehlt GLM; derselbe
ID-Reader findet ihn in H1. Dieser positive Kontrollfall unterscheidet eine fehlende
Quelle von einem Reader, der grundsätzlich nichts erkennt. G liefert zusätzlich
einen positiven Audit-Join.

Die synthetischen Eingaben `None`, ungültiges JSON und ein leerer Teilausschnitt
liefern unterschiedliche Verlustgründe. Ein leerer vollständiger gelesener Bestand
liefert nur „absent-in-supplied-window“, niemals „existierte nie“. Eine echte
Datei-Zugriffsverweigerung wurde nicht provoziert; unreadable ist die Parser-Variante.
Die Suche umfasste die genannten Ledger, aktuellen und Backup-State, Taskarchiv
sowie gezielt Tool-Ausgaben in Codex-Sessiondateien der Starttage 05.–08.09. Sie war
keine globale Suche in allen Harness-Historien.

Q:`server.ts#programExecutionView:2289–2323` nennt beschädigte Ledger, verlorene
Inbox-/Handover-Records und Retention als unknown; `#pruneFleetReports:8408–8425`
erklärt die heutige Retentionsregel. Das ist keine rückwirkende Behauptung, dass
diese Version bereits am 07.09. lief. Kosten des Verlusts: Die aktuelle Projection
allein kann die historische Ablehnung nicht mehr rekonstruieren; Archivbelege
müssen verfügbar sein oder die Relation bleibt unknown.

## Benötigte Kanten und offene Beweislücken

Alle Codebelege der Tabelle beziehen sich auf Q. Kein Feld wird aus Prosa
nachträglich in eine bestätigte Kante verwandelt.

| Kante / Quelle | Zeitstand, Leser und Verlust | Was diese Lesung erlaubt / was fehlt |
|---|---|---|
| Program-Kriterium→Task: `server/types.ts#Program:1630–1639`, `#Task:1169–1177` | aktuelles `fleet.json#programs` selektiv für `eec69528`; O und H geben historische Programzuordnung | `successCriterion` verlangt u.a. Schichten- und Einzeldateiabdeckung; Task.programId verbindet nur das Program. Kein in dieser Lesung belegter kriterienspezifischer Erfüllungsjoin. Heutiger Status complete ist kein historischer Gesamtbeweis. |
| Task→Report: `server/types.ts#FleetReport:528–550`, `server.ts#latestReportFor:2212–2226` | Q-Reader liefert den neuesten Report nach reportedAt für Task+Program; H rekonstruiert ältere Zustände | Provenance-Join vorhanden. Neuester Report ist nicht alle Reportgeschichte; Retention/fehlende Taskrow kann den Leser begrenzen. |
| Report→Entscheidung: `server/types.ts#FleetReportDecision:478–484`, `server.ts#decideFleetReport:8876–8947` | H1/A enthalten Entscheidung und Zeit; Q-Reader liefert ID/status/disposition/decidedAt | Urteil vorhanden, Bedeutung nicht aus Worker-status oder Transport ableiten. Menschliche Entscheidung trägt keine strukturierte Kandidaten-SHA/Dateihash-Bindung; A nennt sie nur in reason. Das optionale mainAfter gilt nicht als allgemeine fachliche Bindung. |
| Entscheidung→Kandidat: `program-phase.ts#candidateOf:310–316`, `#PhaseInput:122–144` | Q wählt merge-last, sonst lane-outcome; ohne beides sha:null | Lifecycle-Kandidat ist keine akzeptierte Version. Originale GLM-Report→pre-rebase-SHA-Kante fehlt; A→B-Annahme fehlt absichtlich. |
| Kandidat→Land: `server.ts#LaneOutcome:21899–21940`, N/O | konkrete Gitobjekte und Landrecords; Rebase kann SHA ändern | `mainAfter` ist Land, nicht automatisch Original-Lane-HEAD. Einzeldatei-Hashgleichheit ist enger als Baumgleichheit. |
| Land→Audit: `server.ts#PostLandAuditRow:17949–18006` | U/G nach Repo+Cover, dazu Git-Ancestry; jeweils anderer Tip | Coverage vorhanden; U-Urteil fehlt. Covers sind kein vollständiges Commit-Inventar. `programStatusView:9386–9400` reduziert Audit auf at/result/fails/adjudicated; mainSha/covers gehen in diesem Kurzobjekt verloren. |
| Program→Nachfolger/Quelle: `server.ts#programExecutionView:2255–2383`, `#boundProgramForMain:9542–9552` | Q-Code, synthetische Fixture; keine Live-Succession | Fachliche Sicht und aktuelle Schreibbefugnis getrennt. Keine Übertragung alter ACKs. Für verlorene Quellen oder Legacy-Receiver bleiben ausdrücklich benannte Grenzen. |

Für **Hub und Briefverbraucher** sind dieselben abgeleiteten Belegrelationen nötig:
Der Hub muss Land, Urteil, Messbaum und fehlende Coverage gleichzeitig zeigen können;
der Brief muss dieselben Quell-IDs, Zeitgrenzen und unknown-Gründe tragen, damit der
Agent nicht aus einer gekürzten Ampel fachliche Annahme ableitet. Das ist eine
Anforderung aus diesen Gegenfällen, keine Behauptung über bereits gerenderte Screens
oder tatsächlich gelesene Briefbytes. Q:`server.ts#programExecutionView:2398–2421`
begrenzt Outcomes und Receipts jeweils auf 20 Einträge und nennt total/malformed;
ein Verbraucher darf daraus keine vollständige Historie machen.

C3-Schnittstelle: Herkunft, Verfügbarkeit und gelesener Ausschnitt eines Belegs
bleiben neben seinem Hash erforderlich; R/H1 demonstrieren den Verlust.
C4-Schnittstelle: Auswahl und Auslassung müssen als Auswahlbeleg sichtbar sein;
S2D beweist in dieser Lesung weder damaligen Spawn-Baum noch tatsächliches Lesen.
Bestehende Modell-/Rollenarbeit `21ade485` und der Kommunikations-Außenblick `012fe6b9`
werden dadurch nicht dupliziert. P1/P2/P3 behalten ihre Vertrags-/Mechanismenarbeit.

**Ein kleinster Implementierungsvorschlag, keine Freigabe:** Das bestehende
`programStatusView.lastAudit` um den zugehörigen Messbaum und seine Cover-Referenzen
aus demselben gelesenen Auditrecord ergänzen. Beleg der engen Lücke:
Q:`server.ts:9386–9400` findet U/G über Coverage, wirft mainSha/covers im Kurzobjekt
aber weg. Das ergänzt eine vorhandene Ableitung, keinen Hub-Speicher und keine
Erfolgsampel. Es löst weder Kriterienzuordnung noch Kandidatenannahme.
Server, Wire/Typen und beide Verbraucher wären dabei `apply`; deren Umsetzung und
Client-Abdeckung sind hier nicht untersucht. Neue Provideradapter sind
`not-applicable`, Wiederherstellung nicht mehr verfügbarer Altbelege `unsupported`.

## Methode und Original-Probetails

Lesende Wiederholung: Den folgenden Pythonblock als Scratch-Datei außerhalb des
Repos speichern und aus einem Checkout mit vorhandenen Gitobjekten, Notes und den
benannten lokalen Archivquellen starten: `python3 /tmp/c5-probe.py`.
Der Block startet keinen Server und keine Suite. Fixture-Änderungen bleiben im
Speicher. Eingabeausfall oder Mehrdeutigkeit scheitert als Quellenprüfung, nicht als
behaupteter Produktfehler. Ohne private Quellen ist die historische Probe **nicht
ausführbar**; die abgedruckten Sollwerte ersetzen ihre Ausführung nicht.

```python
import ast, copy, hashlib, json, os, re, subprocess
from pathlib import Path

repo = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], text=True).strip()).resolve().parent
sessions = Path.home() / '.codex/sessions/2026/09'
H = '05/rollout-2026-09-05T08-12-40-01a07032-9f07-7362-a142-f61da6770e4f.jsonl'
P = '07/rollout-2026-09-07T10-43-09-01a07b09-19cf-7883-a328-4a4f44a80bd9.jsonl'
def git(*args):
    return subprocess.check_output(['git', *args])
def digest(b):
    return hashlib.sha256(b).hexdigest()
def objects(x, depth=0):
    if depth > 12:
        return
    if isinstance(x, dict):
        yield x
        for v in x.values():
            yield from objects(v, depth+1)
    elif isinstance(x, list):
        for v in x:
            yield from objects(v, depth+1)
    elif isinstance(x, str):
        for line in x.splitlines():
            start = line.find("[{'id':")
            if start >= 0:
                try:
                    yield from objects(ast.literal_eval(line[start:]), depth+1)
                except (ValueError, SyntaxError):
                    pass
        decoder, pos = json.JSONDecoder(), 0
        while pos < len(x):
            m = re.search(r'[\[{]', x[pos:])
            if not m:
                break
            start = pos + m.start()
            try:
                value, end = decoder.raw_decode(x[start:])
                yield from objects(value, depth+1)
                pos = start + end
            except ValueError:
                pos = start + 1

def capture(path, line, sha):
    raw = (sessions/path).read_bytes().splitlines()[line-1]
    assert digest(raw) == sha, 'source bytes differ'
    row = json.loads(raw)
    assert row['payload']['type'] == 'custom_tool_call_output'
    return list(objects(row['payload']['output']))
def one(rows, predicate):
    selected = [r for r in rows if predicate(r)]
    assert len(selected) == 1, f'source selection count={len(selected)}'
    return selected[0]
def ledger(name):
    return [json.loads(l) for l in (repo/name).read_text().splitlines()]

before = capture(H,2391,'7926d2510e468f7cfce5b10a40ff07438d676a8567b5be5b02738c30f4f570e1')
after = capture(H,2448,'84a5f4804015135940f2f1679142a232303563ef3363c59fdf0ffdd58cf7d650')
correction = capture(H,2560,'212c132a0fdae3870b58ec3870e829fc911aa8b820d9760ed366b62a28a3c3b0')
p1 = capture(P,640,'f59387b866ae7b1aeecac7f32b5867ee3044f84e0b275451850fc4c698e9c018')
lands, audits = ledger('lane-outcomes.jsonl'), ledger('post-land-audits.jsonl')
report = one(after, lambda r: r.get('provenance',{}).get('taskId')=='746513d1')
land = one(lands, lambda r: r.get('taskId')=='746513d1' and r.get('disposition')=='landed')
fix = one(correction, lambda r: r.get('id')=='1d0f4ca4' and 'programId' in r)
assert report['provenance']['programId'] == land['programId'] == fix['programId']
assert report['decision']['disposition']=='rejected' and fix['status']=='queued'
assert report['decision']['at'] < land['ts']
note = json.loads(git('notes','--ref=fleet/land','show',land['mainAfter']))
assert note['mainAfter']==land['mainAfter'] and note['verify']['ok'] and land['verified']
assert note['verify']['exitCode']==0 and 'ALL PASS' in note['verify']['out']
path = 'docs/messungen/2026-09-06-kontext-gesundheit-glm.md'
assert git('show','fb470c67:'+path)==git('show',land['mainAfter']+':'+path)
print('PASS C1: report='+report['id']+' rejected BEFORE green-gate land; correction queued in historical capture')

def audit_relation(row, target_repo, sha):
    if row.get('repo') != target_repo or not any(c.get('mainAfter')==sha for c in row.get('covers',[])):
        return ('unknown','unknown')
    return ('present',row.get('result','unknown'))
unknown = one(audits,lambda r:r.get('at')==1788763378705)
green = one(audits,lambda r:r.get('at')==1788821145946)
for row, sha in [(unknown,land['mainAfter']),(green,'75939cf4e0f22eaee02cc8f82f64120202700a60')]:
    assert audit_relation(row,str(repo),sha)==('present',row['result'])
    assert row['mainSha']!=sha
    subprocess.run(['git','merge-base','--is-ancestor',sha,row['mainSha']],check=True)
    assert audit_relation({**row,'covers':[]},str(repo),sha)==('unknown','unknown')
    assert audit_relation(row,'synthetic-other-repo',sha)==('unknown','unknown')
assert unknown['result']=='unknown' and unknown['exitCode'] is None and unknown['checks'] is None
assert 'ALL PASS' not in unknown['out'] and 'acquired after 1576s' in unknown['out']
assert green['result']=='green' and green['exitCode']==0 and green['out'].rstrip().endswith('ALL PASS')
assert audit_relation({**unknown,'result':'red'},str(repo),land['mainAfter'])==('present','red')
print('PASS C2: covers and ancestry join both tips; unknown, green and synthetic red remain distinct')

s2d = one(after,lambda r:r.get('id')=='457511cc' and 'report' in r)
s2d_before = one(before,lambda r:r.get('id')=='457511cc' and 'report' in r)
s2d_land = one(lands,lambda r:r.get('taskId')=='457511cc' and r.get('disposition')=='landed')
assert s2d_before['report']['disposition'] is None
assert s2d_land['ts'] < s2d['report']['decidedAt'] and s2d['report']['disposition']=='rejected'
assert s2d['candidate']['sha']==s2d_land['mainAfter']
def acceptance(row):
    return (row.get('decision') or {}).get('disposition','unknown')
assert acceptance({'transport':'acknowledged','read':True})=='unknown'
assert acceptance({'transport':'acknowledged','decision':{'disposition':'accepted'}})=='accepted'
print('PASS C3: S2D land precedes rejection; synthetic ACK/read does not imply acceptance')

accepted = one(p1,lambda r:r.get('id')=='c89b59e7b4f2fecea8fcd2e9' and 'decision' in r)
decision = accepted['decision']; a_sha='d05244e538b8e60eaa74d4d36128c6342ad49459'
a = git('show',a_sha+':docs/messungen/2026-09-07-verifikation-zielbild.md')
rebased = git('show','9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2:docs/messungen/2026-09-07-verifikation-zielbild.md')
assert decision['disposition']=='accepted' and a_sha in decision['reason'] and digest(a) in decision['reason']
b = a+b'\nSynthetic C5 candidate B.\n'
def document_acceptance(payload, verdict, reviewed_hash):
    return 'accepted-document-bytes' if verdict=='accepted' and reviewed_hash==digest(payload) else 'unknown'
assert a==rebased and a_sha!='9e7660503a32f1404039f9fd6e0e9bc4c0b8e6d2'
assert document_acceptance(a,'accepted',digest(a))=='accepted-document-bytes'
assert document_acceptance(b,'accepted',digest(a))=='unknown'
assert document_acceptance(a,'accepted',None)=='unknown'
print('PASS C4: historical acceptance binds A document bytes; changed B unknown; rebase file equal, commits different')

fixture={'program':'P','main':('new',2),'report':{'id':'R','program':'P','decision':None},
         'event':{'receiver':('old',1),'status':'acknowledged'}}
def successor_view(f, occupant):
    visible=f['report']['program']==f['program']
    return {'owed':visible and not f['report']['decision'],
            'may_decide':visible and occupant==f['main'] and not f['report']['decision'],
            'may_ack_old':occupant==f['event']['receiver']}
assert successor_view(fixture,('new',2))=={'owed':True,'may_decide':True,'may_ack_old':False}
assert successor_view(fixture,('old',1))['may_decide'] is False
foreign=copy.deepcopy(fixture);foreign['report']['program']='Q'
assert successor_view(foreign,('new',2))['owed'] is False
print('PASS C5 SYNTHETIC: Program duty survives; successor gains current decision authority, no old ACK')

def reference(payload, complete=True):
    if payload is None: return ('unknown','unavailable')
    try: rows=json.loads(payload)
    except (ValueError,TypeError): return ('unknown','unreadable')
    found=[r for r in rows if r.get('id')==report['id']]
    if found: return ('present','id-match')
    return ('unknown','absent-in-supplied-window' if complete else 'partial-read')
assert reference(json.dumps([report]))==('present','id-match')
assert reference(None)==('unknown','unavailable')
assert reference('{')==('unknown','unreadable')
assert reference('[]',False)==('unknown','partial-read')
state=json.loads((repo/'fleet.json').read_text())
assert reference(json.dumps(state['fleetReports']))==('unknown','absent-in-supplied-window')
print('PASS C6: same reader finds captured report; current retained set misses it; loss variants stay unknown')
print('ALL PASS C5 EVIDENCE (historical records + labelled synthetic readers; no product run)')
```

Originalausgabe der erneuten Quellen-/Fixture-Probe, Exit 0:

```text
PASS C1: report=f70e70dd21633bd2292f74a9 rejected BEFORE green-gate land; correction queued in historical capture
PASS C2: covers and ancestry join both tips; unknown, green and synthetic red remain distinct
PASS C3: S2D land precedes rejection; synthetic ACK/read does not imply acceptance
PASS C4: historical acceptance binds A document bytes; changed B unknown; rebase file equal, commits different
PASS C5 SYNTHETIC: Program duty survives; successor gains current decision authority, no old ACK
PASS C6: same reader finds captured report; current retained set misses it; loss variants stay unknown
ALL PASS C5 EVIDENCE (historical records + labelled synthetic readers; no product run)
```

Die positiven Kontrollen lesen vorhandene Verbindungen; die Gegenarme ändern
Eingaben und prüfen resultierende Beziehungen. Sie würden bei blindem Durchreichen
von accepted, unknown→green oder automatischer ACK-Vererbung fehlschlagen. Es wurden
keine Live-Testrecords geschrieben.

## Nicht gemessen

Kein Hub, kein produktiver Briefreader, kein End-to-End-Serverlauf, keine echte
Nachfolge oder Token-Ausübung. Die semantischen Fixture-Reader sind kein Ersatz für
Produktproben. Keine vollständige Schichten-/Dateiabdeckung des Programs; weder
Program-Erfolg noch menschliche Lektüre werden aus Statusfeldern behauptet.
Keine weltweite Vollständigkeit der Archive, keine unabhängige Authentifizierung
historischer Tool-Captures, keine Rekonstruktion des ursprünglichen GLM-Verify-Logs.
Keine erneute Diagnose des Audit-Timeouts und keine Messung der Kosten vorgeschlagener
Implementierung. Nur die genannten Quellbereiche wurden gelesen; insbesondere
keine vollständige server.ts, kein vollständiges Regelbuch oder Handoff.

Die Dokumentprüfung install+pins prüft Dokumentlandbarkeit, keinen Zielbetrieb.
Eine unabhängige fachliche Zweitprüfung muss die versiegelten Dokumentbytes prüfen;
dieses Artefakt behauptet weder deren Annahme noch Land oder Deploy.

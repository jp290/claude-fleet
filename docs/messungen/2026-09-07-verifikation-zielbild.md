---
datum: 2026-09-07
bereich: [verify, audit, flake]
urteil: "Die historische Audit-Erzählung stimmt nicht mit den Ledgerzeiten überein; 21 Familien plus Einzelsichtung, eine Zustandsmaschine mit offenen Kapazitätsgrenzen und fünf serielle Schnittvorschläge"
---

# Verifikation: Ursachen, Audit-Frist und serielle Umsetzung

2026-09-07. P1, Program `29c0f21bf3cc6e37d31f7803`. Entwurf zur Abnahme, keine promovierte Regel und kein Nachweis eines verbesserten Betriebs.

## Ergebnis und Beweisgrenze

Das Ziel lautet: jedes Land erhält innerhalb von 900 Sekunden ein Tier-2-Urteil, und Rot bedeutet Regression. Der untersuchte Betrieb erfüllt die Frist nicht. Die sieben letzten zum Erhebungszeitpunkt vorhandenen Auditzeilen überschreiten sie sämtlich; eine endet ohne Urteil. Die vorhandene Farbklassifikation beweist auch keine Regression: lokal entscheidet der Exitcode, einschließlich gewöhnlicher Nichtnull-Exits ohne gemessenen Check (`server.ts#runPostLandAudit:13916–13920`). Reparaturen an Sonden, Prozessbeendigung und Ressourcenwahl müssen deshalb getrennte Nachweise liefern.

Diese Zustandsmaschine soll existieren, weil ein wartender Auftrag, ein reservierter Executor, eine tatsächlich laufende Suite und ein dauerhaft gespeichertes Urteil verschiedene Fakten sind. Ihre Zusammenfassung als laufender Audit verhindert eine spätere Platzierungsentscheidung, ohne bereits Arbeit zu beweisen (`server.ts#drainPostLandAudits:13597`, `#helperJobsView:14383`, `helper-daemon/daemon.ts#tick:789`). Der Entwurf erweitert vorhandene Audit-Covers, Claims und Ledger; er verlangt keinen zweiten Scheduler und kein neues Program.

## Methode und Quellenstand

Alle Quellverweise `Datei#Symbol:Zeile` beziehen sich auf Git-Commit `e917a48b1a0dfa894cd9470b683606252725b0e9`. Reproduzierbare Ansicht: `git show e917a48b1a0dfa894cd9470b683606252725b0e9:<Datei> | nl -ba`. Ein `git archive` dieses Commits wurde außerhalb des gemeinsamen Checkouts gelesen. Graphify diente nur zur Orientierung; Aussagen stammen aus den anschließend gelesenen Quellen. Uncommittete und später gelandete Änderungen sind nicht Teil dieses Pins.

Erhoben wurden benannte Felder aus `post-land-audits.jsonl`, `audit.jsonl`, `helper-artifacts.jsonl`, aktuelle Task-Briefs und Program-Bindungen sowie konkrete Checks aus beiden lokalen Trail-Verzeichnissen. Der Ledger-Snapshot umfasst 514 parsebare Zeilen: 273 `green`, 136 `red`, 105 `unknown`; SHA-256 der damals gelesenen Datei: `ec8ee697ee2041bc70d28f97eac1a2101663529220ea3fee233eaeac5e912635`. Das sind Ergebnislabels, keine Ursachenklassifikation. Die historischen 18 Familien des Mandats werden auf die inzwischen dokumentierten 21 Familien plus Einzelsichtung abgeglichen.

Belegwurzel `e2e-trail/` bezeichnet das Register des Hauptcheckouts; `$TMPDIR/fleet-e2e-trail/` dessen zweiten lokalen Speicherort. `streams/helper-artifacts/` enthält hochgeladene Helferlogs. Diese privaten Belege sind weder im Git-Commit enthalten noch durch einen Pfad dauerhaft verfügbar garantiert. Fehlende Originale sind in der jeweiligen Disposition benannt. Keine vollständigen Rohlogs werden in dieses öffentliche Dokument kopiert.

`docs/e2e-trail.md` §2–4 definiert `tree`, `dirty`, exakte Checknamen und `msSincePrev`. Letzteres ist Zeit seit dem vorherigen Check, keine reine Checklaufzeit. Dirty- oder `tree:null`-Runs belegen eine Beobachtung, keinen exakten sauberen Quellstand. Mehrere rote saubere SHAs beweisen allein ebenfalls keine Nichtregression: sie können dieselbe Regression erben. Abstammung, identische Fehlersignatur und ein kausaler Gegenbeweis bleiben nötig. Ein grüner Wiederholungslauf desselben Baums belegt Nichtdeterminismus, aber nicht die Ursache.

Die Familienprüfung unten unterscheidet gelesenen Code, historischen Original-Trail, dokumentierte frühere Messung und neue Reproduktion. In diesem P1-Akt wurde keine Suite und kein Server gestartet. Bezeichnungen wie „repariert“ betreffen den gelesenen Mechanismus, nicht eine neu gemessene Nach-Fix-Rate.

## Der heutige Vorfall, korrigiert am Ledger

Alle Uhrzeiten dieser Tabelle sind UTC. Die Differenzen wurden aus den Millisekundenfeldern gerechnet, nicht aus den gerundeten Zeiten.

| Fakt | Zeit / Dauer | Originalbeleg |
|---|---|---|
| Cover `b2ab2cfc` landet; Helfer claimt | 05:21:15.940; 05:21:21.926 | `post-land-audits.jsonl:512`, `audit.jsonl:40492` |
| Cover `2dfaa814` landet | 05:29:59.722 | `post-land-audits.jsonl:513`, `covers[0].at` |
| Cover `f781c600` landet | 05:42:50.007 | ebenda, `covers[1].at` |
| Helfer meldet `b2ab2cfc` grün | 05:57:58.342; Claim bis Ergebnis 2.196.416 ms | `post-land-audits.jsonl:512` |
| Lokaler Audit `5b676958` beginnt | 05:57:58.358, 16 ms nach vorigem Ergebnis | `post-land-audits.jsonl:513`, `startedAt` |
| Lokaler Audit endet `unknown` | 06:42:58.705; 2.700.347 ms ab Start | ebenda; `checks:null`, Timeout-Reason |
| Ältestes Cover bis Nichturteil | 4.378.983 ms | `at - min(covers[].at)` derselben Zeile |

Damit ist „lokal schon 60 s nach dem jüngsten Land“ für diesen Vorfall widerlegt. Während eines Claims überspringt der Drain dasselbe Repository (`server.ts#drainPostLandAudits:13563`). Nach Helfer-Ergebnis entfernt `#helperResult:15126` den Claim und ruft nach Persistenz `#kickAuditDrain:15146`; die Grace rechnet weiterhin ab dem jüngsten Cover (`:13580`). Sie war bei Ergebnisrückkehr längst abgelaufen. Der Drain reserviert synchron lokal (`:13597`), bevor ein neuer Poll des Helfers erfolgreich claimen kann. Die Ledgerfolge und der gelesene Code tragen diese Erklärung; die historische Ausführung jedes internen Schritts wurde nicht separat instrumentiert.

Auch „nicht mehr im Portal“ ist zu präzisieren: `#helperJobsView:14377` listet den Eintrag weiterhin, setzt `localRunning:true` (`:14383`); `helper-daemon/daemon.ts#tick:789` filtert ihn. `server.ts#helperClaim:14852` verweigert Übernahme. Es fehlt eine übertragbare Wartephase, nicht zwingend eine Listenzeile.

Die drei genannten Preview-Angebote sind keine drei bewiesenen konkurrierenden Suite-Prozesse. `audit.jsonl:40530–40534` zeigt zwei Angebote derselben Lane, `:40548–40549` ein weiteres Angebot. Angebot bis Rückzug: 98.025 ms, 203.150 ms und 73.185 ms, also nicht dreimal 180 Sekunden. Ob danach drei verschiedene lokale Runs vor dem Audit warteten, braucht die jeweiligen Start-, Acquire- und Ende-Belege; aus `offeredAt`/`withdrawn` folgt es nicht. Diese Lücke macht das historische Cap-1-Gegenfaktual derzeit unentscheidbar.

Zwei Helfer-Originale sind vorhanden und gegen ihren gespeicherten Hash verglichen:

| Log | SHA-256 | Tatsächlich gelesen |
|---|---|---|
| `streams/helper-artifacts/26ea1a205005/1788760678342/suite.log` | `4adae6dbd0059288b58b235c9fa6213f6e0e0e74898a33fe88604485beb141c5` | Zeile 15 Acquire nach 0 s; Zeile 4834 `ALL PASS` |
| `streams/helper-artifacts/26ea1a205005/1788768763959/suite.log` | `b2c2b43cb68c6de8e6591123882e56a8f45510f9237c4835d2b0fb96fb071ad2` | Zeile 15 Acquire nach 0 s; Zeile 4848 `ALL PASS` |

Index: `helper-artifacts.jsonl:25` und `:28`. Die zugehörigen Ledgerzeilen nennen 3.792/0 bzw. 3.806/0 Checks und jeweils übereinstimmende `mainSha`/`remote.clonedSha`. Der Hash beweist die gelesenen Bytes; er ersetzt weder Tail noch Quellzuordnung. Acquire nach 0 s schließt lange Wartezeit an diesem äußeren Helfer-Mutex aus, isoliert aber nicht Download, Installation, innere Fixture-Wartezeit oder reine CPU-Arbeit.

## Frist, Kapazität und Gegenfaktual

Im abschließenden Fenster `post-land-audits.jsonl:508–514` sind alle sieben Zeilen nicht proportional. Die Frist vom ältesten Cover bis Ledgerergebnis beträgt in Millisekunden: 2.132.081; 2.154.560; 2.156.364; 4.339.685; 2.202.402; 4.378.983; 2.226.463. Die sechste Zeile liefert überhaupt kein Urteil. Damit sind in diesem Fenster 0/7 Audit-Einträge fristgerecht; das ist keine allgemeine Erfolgsrate und keine reine Laufzeitmessung. Jede darin enthaltene Land-Zeile muss für ein künftiges SLO zusätzlich einzeln gezählt werden.

Für Cover i gilt `latency_i = verdictAt - landedAt_i`; die Frist ist unveränderlich `deadline_i = landedAt_i + 900000`. Eine Operation zerlegt ihre Zeit in Queue/Platzierungswarten, Vorbereitung, Mutex-Warten, Suite-Arbeit und Ergebnis-Persistenz. Erstes Wrapper-Acquire ist nicht Beginn der gesamten Arbeit: `runPostLandAudit` spawnt das konfigurierte Kommando nach Snapshot-Erstellung (`server.ts:13844–13854`); dessen Vorbereitung kann vor dem Wrapper laufen. `helper-daemon/daemon.ts#work:486` installiert vor dem Suite-Kommando (`:510`).

Notwendige Kapazitätsbedingung bei zwei Ressourcen: Für jede Ressource e muss die zugeteilte Ankunftsrate einschließlich Lane-Vorschauen und Wiederholungen mal mittlerer belegter Zeit unter ihrer verfügbaren Kapazität liegen. Für Cap 1: `lambda_e * E[service_e] < availability_e`. Das ist nur eine Stabilitätsbedingung; weder p90 noch ein Mittelwert beweist eine 900-s-Obergrenze. Eine harte Frist verlangt zusätzlich obere Schranken für Arbeit, Bursts, Restlaufzeit, Transport und Ausfall. Mit unbegrenzt langem Helferausfall, unbeschränkten Ankünften oder einem nicht abbrechbaren Blockierer ist die universelle Frist nicht garantierbar. Ein Quantil-SLO wäre eine Owner-Änderung des Ziels, keine Umdeutung durch P1.

Cap 1 begrenzt weder die Laufzeit einer einzelnen Suite noch alle Produzenten von Mutex-Arbeit. Die jetzigen Originaldaten erlauben keinen Beweis, dass dieser Deckel allein den Vorfall ausgeschlossen hätte. Kleinster Nachweis durch den bereits beauftragten Träger `c9791a49`: die erhaltenen Hold-Intervalle und vollständigen Laufketten desselben Zeitfensters lesen, belegte Doppelangebote derselben Lane zusammenführen, nur kausal weggefallene Läufe entfernen; übrige Zeitintervalle nicht skalieren. Ergebnis als untere/obere Schranke mit unbekannten Intervallen. Selbst ein vermiedener 45-Minuten-Timeout wäre noch kein 15-Minuten-Beweis.

Vor einer verbindlichen Platzierungsentscheidung fehlen pro Ressource: belegte Restlaufzeit, obere Vorbereitungs-/Arbeitszeit, aktuelle Last anderer Auftragstypen, Burst-Ankünfte und Ausfalldauer. Diese Werte bekommen Messfelder oder bleiben `unknown`; es wird kein Deckel und keine Umgebungskonfiguration in diesem Program geändert. Eine reine Verlängerung der Grace auf eine Helfer-Suite kann den Vorfall verlagern und die Frist weiter verletzen.
## Familien 1–11

Stand 2026-09-07, Quell-Pin `e917a48b1a0dfa894cd9470b683606252725b0e9`. Alle Quellverweise beziehen sich auf diesen Stand.

Der Familienindex ist sinnvoll, weil mehrere fehlgeschlagene Checks dieselbe gescheiterte Vorbedingung haben können. Seine Nummern belegen weder unabhängige Ursachen noch erlauben sie, ein neues Rot pauschal abzutun.

Evidenzarten: **QUELLE** = gelesene ausführbare Zeilen am Pin; **DOKU** = historische Aussage im gepinnten Dokument, hier nicht reproduziert; **ROHBELEG** = jetzt gelesene, erhaltene JSONL-Zeile; **ABLEITUNG** = Erklärungskandidat mit ausstehendem Unterscheidungsnachweis. Keine frischen Reproduktionen, Suiten, Serverstarts oder Host-Mutationen. Eine graphify-Abfrage ging den Rohsuchen voraus.

Trail-Kürzel: `T/` = `e2e-trail/` im Main-Checkout; `U/` = `$TMPDIR/fleet-e2e-trail/`. `.jsonl:N` bezeichnet die genaue erhaltene Zeile. Beide Verzeichnisse existierten und wurden durchsucht. Die Suche erfasst erhaltene Dateien zum Lesezeitpunkt, keine abgeschlossene historische Grundgesamtheit; sie belegt weder eine Rate noch vollständige Bewährung nach einem Fix. `docs/e2e-trail.md:24–44,53–71,76–86,143–154` definiert Zeilenidentität, Grenzen von dirty/null, Fallback und Verknüpfung über exakte Checknamen. Der Code stimmt darin überein: `e2e/trail-emit.ts#defaultDir:80`, `#TRAIL_DIR:85`, `#TrailRow:91`, `#writeTrailRow:129`. `msSincePrev` misst die Zeit seit der vorherigen Assertion, nicht die Ausführungsdauer eines Tests. Rohzeilen enthalten keine vollständigen Transkripte; Fehlerdetails sind auf 2000 Zeichen begrenzt (`:67`).

### 1. Outcome-Review inflight (§5b)

**Disposition: historischer Mechanismus teilweise repariert; verbleibendes Fixture-Timing offen, nicht frisch reproduziert.** DOKU `docs/verify-tiering.md:266–275` beschreibt ein leeres, superseded Review statt inflight. Die konkrete Juli-Sichtung liegt vor Einführung des Check-Trails; in erhaltenen T/U-Dateien wurde keine genau passende false-Zeile gefunden. Das belegt keine Fehlerrate von null.

QUELLE `e2e/review.ts#run:204–217` setzt sechs Sekunden Verzögerung des Ersatz-Reviewers, committet eine Fixture-Datei, startet POST /review ohne Await, wartet 1500ms, beendet den Slot und erwartet inflight. Vor dem Kill wird kein tatsächlicher Reviewer-Start etabliert; Exitcodes von git-add/commit werden hier nicht geprüft. Zwei spätere Reparaturen adressieren die dokumentierte leere Review-Antwort: `server.ts#openSlot:4540–4547` entfernt alte Git-Fakten des vorherigen Occupants (Testkontext `e2e/review.ts:245–255`); `server.ts#runReview:10319–10337` wirft bei fehlgeschlagenem Base-/HEAD-Diff einen Fehler. Der Gegenbeweis mit zerstörter Base steht in `e2e/review.ts:434–465`: kein Reviewer, kein Cache-Ergebnis, Outcome `none`.

Kosten: Ein Setup-Race kann die Outcome-Klassifikation beschuldigen; der historische Produktfehler konnte ungeprüfte Arbeit als sauber erfassen. Fix-Design: Fixture-Commit und Identität des tatsächlich laufenden Reviews vor Teardown durch ein erhaltenes Startereignis belegen; fehlt es, scheitert eine benannte Vorbedingung. Den unabhängigen Recycle-nach-Abschluss-Check erhalten. Kleinster Falsifizierer: Annahme des Review-Requests über 1500ms hinaus verzögern und Start-/Endzeit behalten; separat den Base-Diff scheitern lassen und leere gecachte Abdeckung ausschließen. Vorhandene Reparaturen nicht erneut als fehlend entwerfen. Der genaue ursprüngliche Auslöser des leeren Reviews bleibt unknown.

### 2. Steward: zweiter Send 429/409 (§5b)

**Disposition: historischer Idle-vor-Cap-Mechanismus im aktuellen Code repariert; dokumentierte Reihenfolge veraltet.** ROHBELEG `T/isolated-20260803T114819Z-5325.jsonl:839`: false, Detail `409`, sauberer Baum `258cfa11bfbc1593ee80c208c92f8b9a94e83301`; Nachbarzeile 840 gehört zu Familie 3. DOKU `docs/verify-tiering.md:276–282` führt dies auf das Echo des ersten Sends zurück, das den Idle-Zähler vor Erreichen des zweiten Caps zurücksetzt.

QUELLE `e2e/steward-core.ts#run:303–331` wartet weiterhin nur vor Send 1 auf Ruhe. Doch `server.ts#handleStewardSend:22114` führt jetzt zunächst einen reinen Policy-Check `canDeliver(...alive:false)` bei 22157 aus, dann Caps bei 22166–22178 und erst danach Liveness/Idle durch `canDeliver(...idleMs:STEWARD_MIN_IDLE_MS)` bei 22188. `server.ts#canDeliver:7880,7898` bestätigt: Ohne idleMs ist das Busy-Gate aus. Paste-Echo allein erklärt deshalb kein heutiges 409 vor dem Cap. Policy-Änderungen können es weiterhin; ihr Veto bleibt erforderlich.

Kosten: Veraltete Mechanismus-Prosa könnte ein anders verursachtes heutiges 409 als harmloses Timing abtun. Fix-Design: Disposition korrigieren und Reihenfolge deterministisch prüfen: Nach einem angenommenen Send erhält dasselbe beschäftigte Episodenziel 429; ein Policy-Veto erhält 409. Kleinster Falsifizierer: Body und Gate der zweiten Antwort bei erzwungenem Busy und fester Policy prüfen. Kein zusätzliches Warten allein wegen des alten Testkommentars.

### 3. Fehlendes steward_send_capped-Audit (§5b)

**Disposition: historisch Folge von Familie 2, keine eigene Wurzel; heutiges Risiko verzögerter Persistenz unbewiesen.** ROHBELEG: Im selben Lauf ist Zeile `840` false ohne Detail, Zeile 839 enthält das 409. QUELLE `server.ts:22177` schreibt capped-Audit nur im Cap-Pfad; `e2e/steward-core.ts:329–331` liest direkt nach der Antwort und erwartet das Ereignis. Historisch gilt somit: kein Cap, keine Cap-Zeile. Später wartet der Test selbst 300ms auf asynchronen Audit-Flush (`:339`), hier aber nicht auf das Cap-Ereignis.

Kosten: Eine Wurzel erzeugt zwei rote Zeilen; ein unabhängig verspäteter Append könnte ebenfalls wie fehlendes Audit aussehen. Fix-Design: Cap-Antwort mit dem genauen Ereignis verbinden und begrenzt darauf warten; benannte Antwort-Vorbedingung erhalten. Kleinster Falsifizierer: Audit-Append bei unverändertem 429 verzögern und begrenzte Ereignisbeobachtung verlangen; fehlt die Zeile danach, scheitert Audit-Persistenz. Diese separate Verzögerungshypothese wurde nicht reproduziert und ist kein beobachteter Mechanismus.

### 4. Merge/Resolver (§11.2)

**Disposition: dokumentierte Reparatur optionaler Index-Locks vorhanden; gleiche Signatur belegt diese Wurzel für spätere Sichtungen nicht.** DOKU `docs/verify-tiering.md:844–863` beschreibt durch Status-Polling blockierte Rebase-Vorgänge und die Juli-Reparatur. QUELLE `server.ts#GIT_READ_ENV:2770`, `#gitRead:2771`, `#statusLines:2780` deaktiviert optionale Locks; `#gitRetry:2797–2803` wiederholt mutierende Befehle bei Lock-Konflikten. `#tryScriptRebase:16572–16589` nutzt Retry für Rebase/Abort, liest Konfliktnamen mit gitRead und meldet einen verbleibenden Git-Vorgang als halted. Der tickGit-Status nutzt gitRead bei `server.ts:3396` (Fundstelle identifiziert; umgebender Tick nicht vollständig auditiert).

ROHBELEG `T/isolated-20260728T091414Z-77646.jsonl:540`, sauberer Baum `4df2898ecbf3015f0abaa773fdd5a0227760de53`: Resolver meldet rebased, Lane bleibt unsauber. ROHBELEG `T/isolated-20260804T224409Z-81693.jsonl:580` wiederholt dies nach dem dokumentierten Reparaturdatum auf dirty-Baum `9fa63119faa670ce6853e6c6d1816ad013219c38`. Daraus folgt kein Fortbestehen des alten Lock-Konflikts: Dirty-Bytes und vollständiges Git-stderr fehlen in der Zeile.

Kosten: falsche Resolver-Zuschreibung und festhängende Lane; eine pauschale Flake-Ausnahme könnte echte ungelöste Konflikte verdecken. Fix-Design: vorhandene lockfreie Leser und Retry nutzen; pro rotem Belegpaket Exitcode/stderr, Git-Vorgangszustand und Resolver-Fixture-Ausgabe erhalten. Kleinster Falsifizierer der konkreten Reparatur: kontrolliertes Status-Polling gegen Rebase/Abort, optionale Locks an/aus. Ein grüner Gesamtsuite-Wiederholungslauf ersetzt das nicht. Für die August-Zeile wird keine neue Wurzel behauptet.

### 5. Reseed plus Live-Bytes (§11.2b)

**Disposition: hier nicht reproduziert; Belege widersprechen der sicheren Lesart „fehlendes Ende“.** ROHBELEG `T/isolated-20260728T091414Z-77646.jsonl:138`: `41 marks, 1..40`, sauberer Baum `4df2898ecbf3015f0abaa773fdd5a0227760de53`. `T/isolated-20260902T080541Z-28337.jsonl:340`: gleiches Detail, sauberer Baum `2d4eb921c5a28db93b4a57c08d45328a2dc29292`. `T/isolated-20260801T183004Z-52047.jsonl:138`: `42 marks, 1..41`, dirty. Erhaltene T-Dateien enthalten mehr Sichtungen als die DOKU-Formulierung „vierte Sichtung“ (`docs/verify-tiering.md:875–888`); daraus wird keine neue globale Rate abgeleitet.

QUELLE `e2e/slots.ts#run:595–615` parst jeden SEEDMARK und beendet die Sammlung bei letztem Marker >=40; `:645–651` verlangt Anzahl >=40, ersten Wert 1 und jeden Schritt genau +1. Eine lückenlose Folge 1..40 hat 40 Werte, nicht 41. Das Detail beweist deshalb Nicht-Kontiguität, aber weder bloß einen fehlenden letzten Write noch die genaue Abweichung: Duplikat, innere Lücke oder Reihenfolge bleiben zu unterscheiden. QUELLE `server.ts#websocket.open:26931–26939` liest die Raw-Stream-Größe VOR dem Await auf capture-pane; `#afterSeed:9092–9100` verwirft nur Bytes bis zu diesem früheren Offset. ABLEITUNG: Während des Capture-Await erzeugte Bytes können im Seed und später erneut live ankommen. Das ist ein konkreter Überlappungskandidat, keine gemessene Zuschreibung.

Kosten: Ein bestätigtes Duplikat oder eine Lücke wäre ein Produktfehler der Terminal-Kontinuität; falsche Sondendiagnose würde ihn unterdrücken. Kleinster Falsifizierer: vollständiges Marker-Array, Seed-/Live-Grenze, Offset vor Capture und Stream-Wachstum danach erhalten; eine kontrollierte Ausgabe zwischen stat und capture in einer kleinen isolierten Fixture erzeugen. Fix-Design abhängig vom Befund: Capture und Stream-Grenze synchronisieren; Parser/Fixture nur dann korrigieren, wenn vollständige Bytes einen Messfehler beweisen. +1 weder abschwächen noch die Signatur durch längeres Warten grün machen.

### 6. Stalled-Fixture: observed (§11.2c)

**Disposition: historische Sondenreparatur und spätere Server-Reparatur vorhanden; Kommentare teilweise veraltet.** ROHBELEG `T/isolated-20260806T081615Z-58444.jsonl:479`, dirty-Baum `29c67997f3934cc35a0bc5d4a797a54ea152c8ab`: `observed:false,lastOutput:0`. ROHBELEG des reparierten Laufs `T/isolated-20260807T133041Z-8248.jsonl:483`: true. DOKU `docs/verify-tiering.md:925–964` beschreibt einmalige Sonde innerhalb quietUntil mit anschließendem Timeout und nennt drei dirty-Reparaturläufe. `isolated-20260807T091218Z-63718` war weder in T noch U erhalten.

QUELLE `e2e/review.ts#run:348–362` wiederholt paneEnv pro unbeobachteter Pane, beendet anhand von observed+lastOutput des Servers und begrenzt auf 60s. `:366–374` wartet separat auf stalled und prüft observed. QUELLE `server.ts#poll:9131–9149` stempelt die erste Ausgabe jetzt auch innerhalb quietUntil; nur die Aktualisierung der Aktivitätszeit bleibt unterdrückt. Der alte Mechanismus „erste Ausgabe bleibt wegen Ruhefenster dauerhaft unbeobachtet“ ist damit zusätzlich serverseitig geschlossen. `review.ts:335–338` beschreibt altes Verhalten.

Kosten: Eine fehlende Vorbedingung erzeugt mehrere falsche Aussagen über stalled. Fix-Design: beide Reparaturen erhalten; abhängige Produktassertionen nur bei erfolgreicher Beobachtung ausführen, statt nach Setup-Rot weiterzulaufen. Kleinster Falsifizierer: Beobachtungszustellung für die eigene Fixture unterbinden und Vorbedingungsfehler ohne stalled-Produkturteile verlangen; separat ausschließlich erste Ausgabebytes im Ruhefenster erzeugen und observed-Transition belegen. Keine frische Ausführung.

### Geschwister §11.2d und Spiegel §11.2c-bis

**paneEnv-Zeilenumbruch: Sonde falsch, historisch deterministischer Defekt, Reparatur vorhanden.** DOKU `docs/verify-tiering.md:1004–1024` beschreibt eine 63 Zeichen lange Token-Zeile in einer Pane mit 55 Spalten und Capture-A/B mit/ohne -J. QUELLE `e2e/harness.ts#paneEnv:192–204` nutzt einen zeilenverankerten Regex und capture-pane `-p -J` bei 199, verbindet also umgebrochene physische Zeilen. Kein eigener erhaltener Rohbeleg des A/B identifiziert; Experiment bleibt DOKU, Quellreparatur ist geprüft. Kosten: 20 Sekunden falsche Nicht-Antwort und falsche Liveness-Diagnose. Kleinster Falsifizierer: denselben langen synthetischen Wert bei 55 Spalten mit/ohne -J exakt vergleichen. Null-Match bedeutet keine stille Pane.

**Spiegel c-bis gehört zu Familie 8.** DOKU `:971–976` zieht die Geschwisterklassifikation ausdrücklich zurück. ROHBELEG `T/claude-gate-20260818T060909Z-9428.jsonl:2`: unprobed-lastOutput false mit Zeitstempel. Keine zusätzliche Ordnungsnummer und kein umgekehrter stalled-Mechanismus.

### 7. Commit-Idle-Gate (§11.2e)

**Disposition: Sonde falsch, repariert; zugehöriger Client-Fix vorhanden.** ROHBELEG `T/isolated-20260808T025929Z-76832.jsonl:798–799`: one-gesture-Commit false und abhängige Konfliktpause false. ROHBELEG `T/isolated-20260808T034334Z-27704.jsonl:455`: Commit-confirm-Rot-Guard besteht. DOKU `docs/verify-tiering.md:1038–1110` enthält Mechanismus und historische serielle Prüfbehauptungen; die Rechnung in :1107 wird nicht übernommen: Drei Erfolge bei 25% Fehlerwahrscheinlichkeit ergeben 0.75^3, nicht etwa 0,4%.

QUELLE Commit-Route `server.ts:25862–25864` setzt idleMs=0 nur mit confirm. `e2e/lanes-basic.ts#run:265–326` etabliert Busy, prüft unbestätigtes 409 und bestätigte Antwort über den Baum und durchsucht andere Commit-POSTs nach confirm. `e2e/land-provenance.ts:37` sendet confirm; `src/client.ts#doLand:1037–1045` übernimmt die bestätigte Vorschau in confirm. Kosten: sachfremdes Busy lässt Baumassertionen scheitern; Land einer dirty Lane konnte vor dem Commit scheitern. Fix-Design: bestätigte Sonden und eigenen negativen Busy-Block erhalten. Kleinster Falsifizierer: confirm aus einer Nicht-Gate-Sonde entfernen und Rot-Guard-Fehler verlangen; Server-Idle-Gate entfernen und Fehler im Busy-Block verlangen. Keine Tests ausgeführt.

### 8. Send-Boot-Fixtures (§11.2f, einschließlich c-bis)

**Disposition: Sonde falsch, in beiden Harnesses repariert; Grenze der Zeitbudgets bleibt.** ROHBELEG `T/claude-gate-20260809T071509Z-81307.jsonl:9`: observed-Prozesssonde false, `zsh,sh`. `T/claude-gate-20260810T095930Z-24763.jsonl:9–10` verbindet `zsh,sh` mit no-delay false `200 3215ms`. ROHBELEG `T/claude-gate-20260815T174814Z-30576.jsonl:8`: silent-alive false mit Zeitstempel. Sechs historische Namen und Reparatur in zwei Schnitten: DOKU `docs/verify-tiering.md:1134–1305`.

QUELLE `server.ts#sendText:5081–5107` liest occupant.openedAt und direkte Prozessbereitschaft statt lastOutput. `fleet-e2e-claude-gate.ts:171–198` etabliert stillen lebenden Prozess und Frische vor abhängigen Assertions. `fleet-e2e-harness.ts:170–198` sendet unprobed zuerst und prüft danach Frische sowie leere comms; `:253–287` etabliert das Fenster vor exec; `:298–320` wartet auf Ready-Zeile und lebenden Prozess; `:465–495` etabliert Timeout-Prozess/Fenster und schützt abhängige Assertions. Ausführbare lastOutput===0-Assertions sind aus diesen Pfaden entfernt; verbleibende Erwähnungen sind Kommentare.

Kosten: Repaint-Vorbedingungen beschuldigten Boot-Verhalten und blockierten Lands. Fix-Design: direkte Fakten und benannte Vorbedingungszweige erhalten; soweit vorhanden ein Pfadereignis statt reiner Zeitmessung verwenden. Kleinster Falsifizierer: Ready-Zeile verhindern oder Send außerhalb des Fixture-Fensters verschieben und ausschließlich Vorbedingungsfehler verlangen. DOKU nennt Sabotagebeweis, hier nicht wiederholt. Einen Default-Settle von 250ms können no-delay-Budgets von 1500–2000ms nicht auflösen (DOKU :1284–1287).

### Geschwister §11.2g: §7 lines=0, nicht Merge/Resolver

**Disposition: Sonde falsch, zielbezogener Treiber repariert.** ROHBELEG `T/isolated-20260825T230410Z-4191.jsonl:2549`: Gate-Ankündigungs-Vorbedingung false, `lines=0`. DOKU `docs/verify-tiering.md:1309–1330` erklärt Merge-Ausgänge, die last setzen, bevor Verify läuft. QUELLE `e2e/verify-queue.ts#driveMergeUntil:833–862` pollt das übergebene Ziel, erhält Gründe vorzeitiger Endzustände und wiederholt höchstens vier Versuche mit je nominell 30 Sekunden Polling. settleForMerge liegt außerhalb dieses Versuchsbudgets: Eine Gesamtgrenze von 120s ist damit nicht bewiesen.

Kosten: Fehlende Messung wurde als falsche Gate-Auswahl gelesen. Fix-Design: Ziel und Fehler der Vorbedingung erhalten; Gesamtarbeitsgrenze muss settle einschließen. Kleinster Falsifizierer: Ersatzprozess ohne Ankündigung laufen lassen und Vorbedingungsfehler statt Produktfehler der Auswahl verlangen. DOKU-Sabotageergebnis ist kein frischer Beweis.

### 9. Uncertain-Send gegen Self-Heal (§11.2g)

**Disposition: Sonde falsch, reparierte Fixture vorhanden.** ROHBELEG `T/isolated-20260823T065324Z-10925.jsonl:395`, sauberer Baum `7a3a25353c2e5814aaff33fc329bc8339d5e7912`: 200 mit Receipt statt erwartetem 409. Weitere passende false-Zeile: `T/isolated-20260825T233044Z-4537.jsonl:395`, sauberer Baum `b364048c18dd342d4bcd89ab85c904ce349be619`. DOKU `docs/verify-tiering.md:1346–1377` beschreibt tmux-Fallback bei entferntem cwd und kontrolliertes Pausen-A/B.

QUELLE `e2e/slots.ts:1319–1335` setzt remain-on-exit, beendet nur den Pane-Prozess und beweist tote Pane bei weiterlebender Session. `:1337–1353` prüft typisiertes uncertain-Receipt, Journal und unveränderte History. `server.ts#ensureSlot:4268–4282` prüft has-session vor Neuerstellung; die erhaltene Session verhindert den historischen Heal-Auslöser. Kosten: Der Test repariert unbeabsichtigt den gewünschten Transportfehler und nennt erfolgreichen Send eine Regression. Fix-Design: Dead-Pane-Fixture erhalten; abhängige Checks bei gescheiterter Vorbedingung auslassen. Kleinster Falsifizierer: Zustand über einen Heal-Tick halten und dieselbe tote Pane, typisiertes 409 und keinen History-Eintrag verlangen. tmux-A/B hier nicht wiederholt.

### 10. Ambient Owner-Token gegen Task-Zeile (§11.2h), einschließlich h-bis

**Disposition: Sonde falsch, Verknüpfung der einzelnen Belegträger repariert; Server-Nachlauf kann weiterhin requeuen. Das ist nicht als unmöglicher Produktionsfall abzutun.** ROHBELEG `T/isolated-20260826T103601Z-32692.jsonl:1740`, sauberer Baum `28e6f3f820a434a86d6c14189be9ea0a415c992d`: Task queued, während die Note Main-Fortschritt, verify ok, actor owner/bearer/suspect und das genaue ambient-Ereignis trägt. Der Produktbeleg der fehlgeschlagenen Assertion ist bereits richtig. DOKU `docs/verify-tiering.md:1411–1474` enthält kontrollierte schnelle/langsame Nachlaufexperimente. Genannte U-Läufe `isolated-20260826T082534Z-25083` und `isolated-20260826T130627Z-25331` waren in keinem Verzeichnis erhalten; kein h-bis-Rohfehler verfügbar.

QUELLE `server.ts#briefAndSend:8185–8222` wartet Boot-Grace ab und setzt bei Identitätsverlust unbedingt next.status=queued sowie slot=null. `#landLane:3827–3847` erzeugt/schreibt das Outcome und setzt danach noch-sent-Zeilen auf done. Ein späterer abgekoppelter Nachlauf kann den Task-Status also überschreiben. Die historische DOKU-Aussage bei :1429, Produktion erreiche diesen Fall nie, ist keine strukturelle Garantie und wird nicht übernommen. Sondenreparatur geprüft: `e2e/programs.ts#driveLand:7285–7310` löst einmal aus und prüft Ref-Fortschritt; `#landNote:7315–7324` und `#ambientReach:7329–7332` warten jeweils auf ihren eigenen Fakt. h-bis liest einen späteren Träger: `#landedOutcomeOf:7345–7353` wartet auf passende Task/Disposition und wird bei 7426 genutzt.

Kosten: falscher Audit-Vorwurf und voller Task-Poll-Timeout; unabhängig davon bleibt das Überschreiben eines terminalen Tasks eine Lifecycle-Designfrage außerhalb dieser Messung. Fix-Design: getrennte Belegträger weiter gezielt abwarten; terminale Task-Monotonie beim bestehenden Lifecycle-Verantwortlichen behandeln. Die Fixture-Reparatur schließt den Server-Race nicht. Kleinster Falsifizierer: Brief kontrolliert verzögern, früh landen und done→queued getrennt von korrekter Note/Outcome erfassen; separat Outcome-Append nach Note verzögern und begrenztes Warten auf das passende Outcome verlangen. Keine Reproduktion hier.

### 11. Suite-Phasenrestart gegen tmux-Ende (§11.2i)

**Disposition: Race der Fixture-Infrastruktur offen; Meldung „nicht gemessen“ teilweise repariert.** DOKU `docs/verify-tiering.md:1578–1608` beschreibt kill/new-session-Race, tmux-stderr `server exited unexpectedly`, keine fehlgeschlagenen Checks und nachfolgenden grünen Lauf auf gleichem Baum. QUELLE `e2e-clean-review.sh:165–172` beendet srv und startet sofort new-session; `e2e-claude-gate.sh:255–257` beendet den Server und startet sofort new-session. Keiner wartet auf das Ende des alten Servers. `e2e-stage.sh#stage_server_start_failed:353–361` meldet inzwischen gescheiterte Vorbedingung mit erhaltenem Log-Tail oder ausdrücklich fehlendem Log und Exit 3. Das verbessert die Klassifikation, nicht die Spawn-Reihenfolge.

ROHBELEG aus dem Dateisystem: `$TMPDIR/fleet-e2e-unprobed-instance-80702/` ist erhalten und hat kein `server.log`; dies passt zur vierten DOKU-Sichtung. Das ältere `fleet-e2e-unprobed-instance-85260/` fehlte. Kein erhaltenes Wrapper-stderr wurde geprüft, das den genauen tmux-Fehler für 80702 belegt; keine Check-Zeile kann eine nie gestartete Phase beweisen.

Kosten: Das ganze Gate endet ohne Codeurteil und verbraucht Boot-Wartezeit. Fix-Design: Teardown vor erneutem Spawn auf demselben Socket begrenzt abschließen, Spawn-Erfolg verlangen und Startidentität pro Phase erhalten, damit alte Logs keinen neuen Boot vortäuschen. Kleinster Falsifizierer: tmux-Teardown kontrolliert verzögern, keinen Spawn vor Ende der alten Identität zulassen und Spawn-/Bind-Fehler von Check-Fehler trennen. Gemeinsamen Wrapper-Mechanismus statt Sleep nutzen. Keine Suiten ausgeführt.

### Nicht gemessen und Abnahmegrenzen

Nicht gemessen: Kapazität des Live-Systems, vollständige Laufkohorten nach Fix, Helferpopulation, Abstammungsnachweis sauberer SHAs, vollständiges Resolver-stderr, vollständige Reseed-Markerbytes und ursprünglicher Juli-inflight-Trail. Keine Behauptung, dass eine Familie auf allen reparierten Bäumen null Fehler erzeugt. Dokumentierte Experimente bleiben historische Aussagen, soweit oben kein genauer ROHBELEG angegeben ist. Quellzeilen der Wrapper-Kindumgebungen wurden nur als Kontext gelesen; keine Credential-Werte oder Prozess-Kommandozeilen abgefragt. Produkt und getrackte Dateien blieben unverändert. Dokument-Verifikation bleibt Aufgabe der seriellen Publikationslane.
## Familien 12–21 und Einzelsichtung

Quellstand: `e917a48b1a0dfa894cd9470b683606252725b0e9`, geprüft am 2026-09-07. Die folgenden Dispositionen beruhen auf gelesenen Quellen und erhaltenen Trail-Zeilen; neue Reproduktionen wurden nicht gefahren. Gelesen wurden die historischen Einträge §11.2j–s/t samt Korrekturen, die unten genannten Implementierungs- und Sondenblöcke, `docs/e2e-trail.md` sowie `docs/messungen/2026-09-04-flake-ranking-trail.md`. Historische Raten sind keine aktuellen Messungen. Die Suche in beiden lokalen Trail-Verzeichnissen diente dem Auffinden konkreter Belege; ohne vollständigen Abstammungsfilter und versiegelten Verzeichnisstand belegt sie keine Reparaturrate. Die Trail-Läufe stammen nicht durchgehend vom gepinnten Quellstand.

### 12 — pi-unfenced / subject-gone, §11.2j

**Disposition: Servermechanismus repariert; Subscription-Sonde diagnostisch repariert.** `server.ts#tickWatches:11237` wartet auf `canDeliver`; nach dem Test-Latch bei `:11257` liest `:11258` den Pending-Status und `:11259` die Subjektpräsenz erneut, bevor `:11269` send-uncertain schreibt. Damit ist das dokumentierte Überschreiben pending → subject-gone → send-uncertain → pending geschlossen. Der Schaden war eine getippte Nachricht über ein bereits beendetes Subjekt samt erneut verbrauchtem Zustellbudget. `e2e/watch.ts:888` prüft nun ausdrücklich, ob beide Abos angenommen wurden. Bei deren Scheitern folgt jedoch weiterhin `waitEventFor` bei `:900`: die Ursache wird benannt, abhängige Messungen werden nicht vollständig unterbunden.

**Beleg:** `e2e-trail/isolated-20260904T102222Z-51905.jsonl:816` liest gone=subject-gone, freed=400 und dieselbe doomed-Id im offenen Budget als send-uncertain; `:818` liest doomed=pending, goneSawEarlier=subject-gone, flippedBack=true, doomedRows=1. Die erhaltene Mutationsprobe `e2e-trail/isolated-20260905T084416Z-10928.jsonl:827` fällt mit status=delivered, attempts=1, typed=1. Dieser absichtlich veränderte Lauf zählt nicht als Rückfall nach Reparatur. `e2e-trail/isolated-20260905T145210Z-77794.jsonl:827` besteht denselben Vertrag.

**Kleinster Falsifikator:** Tick parken, Subjekt abbauen, Tick freigeben (`e2e/watch.ts:1156`); in einer autorisierten isolierten Mutation ausschließlich die Neulesungen nach dem Await entfernen. Tatsächliches Tippen muss den Vertrag verletzen. Keine neue Mutation hier; die ursprünglichen Fixture-Änderungen aus b20e7e4 wurden nicht vollständig nachgespielt. Serverreparatur und heutige Subscription-Prüfung wurden direkt gelesen.

### 13 — Persistenz des rohen Reviews, §11.2k

**Disposition: benannte Fixture repariert; Kopplung im Server und bei Nachbarsonden besteht weiter.** `server.ts#reviewResponse:10256` hängt sich an den laufenden `reviewInflight`-Job des Slots. `server.ts#startReview:10236` verwirft dessen Cache-Publikation, wenn cwd oder Branch gewechselt haben. `server.ts#teardownSlotOccupant:4620` löscht reviewCache, der gelesene Abbaublock löscht reviewInflight nicht. Ein Job des vorigen Occupants kann deshalb zurückkehren, ohne einen aktuellen Cache-Eintrag zu hinterlassen. Die Raw-Review-Fixture wartet nun vor dem Kill auf cached=true/stale=false, mit bis zu sechs Klicks und nomineller Pollfrist von 30 s (`e2e/outcomes.ts:692`, `:701`). Abgewartete Requests einschließlich des ersten Klicks liegen außerhalb einer hier bewiesenen Gesamtlaufzeitgrenze (`:677`, `:694–698`, `e2e/harness.ts:93–95`); die Gesamtdauer ist ungemessen. Die Aussagen zu covered/raw/findings/notes bleiben bei `:706` erhalten.

**Beleg:** `e2e-trail/isolated-20260901T043433Z-4046.jsonl:2185` und `e2e-trail/isolated-20260901T052612Z-14590.jsonl:2185` fallen auf demselben sauberen ac90244-Baum mit state=none. `e2e-trail/isolated-20260907T064414Z-22587.jsonl:2467` besteht. Diese Beobachtungen beweisen nicht, dass die Reparatur einen tatsächlich verwaisten Job abgefangen hat.

**Offene Grenze und Kosten:** Die reviewed/superseded-Nachbarn klicken weiterhin unmittelbar vor Shelve/Kill (`e2e/outcomes.ts:631`, `:645`), ohne den gespeicherten Effekt abzuwarten. Auch Raw-Review fährt bei fehlgeschlagener Vorbedingung mit Kill (`:704`) und Vertragsmessung (`:706`) fort. Ein fehlender Cache kann daher weiterhin einen sekundären scheinbaren Coverage-Fehler erzeugen. **Fix-Design:** Fixture-Ergebnis vor dem abhängigen Beweis ausdrücklich auswerten. Ein Eingriff in die serverseitige Inflight-Lebensdauer verlangt einen eigenen begrenzten Auftrag; bloßes Löschen der Map darf keinen unkontrollierten Job zurücklassen. **Kleinster Falsifikator:** Review des alten Occupants halten, Slot recyceln, Review freigeben; vor dem terminalen Ergebnis muss der aktuelle Cache belegt sein, sein Fehlen als Setup-Fehler erscheinen.

### 14 — beschäftigter Empfänger über den Restart, §11.2l

**Disposition: Fixture-Reparatur vorhanden.** `e2e/watch.ts:3825` startet busyKeeper, `:3828` erzeugt alle 250 ms Aktivität; erst nach den Restart-Prüfungen wird er bei `:4252` beendet. `server.ts#tickWatches:11238` verwendet weiterhin receiverIdleSec*1000; die spätere Zustellung nach zwei Sekunden Ruhe bleibt geprüft. Früher endete die Beschäftigung mit dem ersten Pending-Ereignis. Unverwandte Zwischenarbeit konnte den Empfänger vor dem Restart zustellbar werden lassen. Kosten: korrekte Zustellung wurde als erfundener Versuch gelesen.

**Beleg:** `e2e-trail/isolated-20260904T070433Z-84250.jsonl:1052` zeigt delivered, attempts=1, receiverIdleSec=2, createdAt=1788505795802 und deliveredAt=1788505797995. Der Code hält busyKeeper über das relevante Fenster. `docs/verify-tiering.md:2373` beschreibt die historische Mutation mit abgeschaltetem Keeper und eingefügtem Schlaf; sie wurde hier nicht wiederholt.

**Kleinster Falsifikator:** Keeper entfernen und länger als receiverIdleSec warten; nach Wiederherstellung muss das Ereignis vor Freigabe pending bleiben und später mit derselben Id genau einmal zugestellt werden. Die seltenen Delete-/Subjektabbau-Nachbarn sind durch den Keeper nicht automatisch mitbewiesen.

### 15 — RW/PARKED-Quartett, §11.2m

**Disposition: Timingfehler der Fixture gestützt; vollständiger Ursprungsledger fehlt; offen.** `e2e-postland-audit.sh:94` verwendet weiter slow=sleep 6, `:155` und `:180` setzen timeout=10000. `e2e/repo-worker-audit.ts:282` wählt slow; `:315` verlangt green/env, `:316` kürzt die Diagnose auf die ersten 200 Zeichen, bevor result/reason zuverlässig erscheinen können. Spätere RW-Prüfungen vergleichen Zeilenzahlen und dauerhaften Queue-Zustand (`:350`, `:373`, `:382`).

**Beleg:** `e2e-trail/postland-audit-20260904T011245Z-37570.jsonl:308` fällt mit ms=10092; `e2e-trail/postland-audit-20260904T032813Z-49781.jsonl:322` mit ms=10082. Die gekürzten Details enthalten result/reason nicht vollständig. Der aus der ersten Zeile abgeleitete Instanzledger-Pfad wurde geprüft und existiert nicht. `docs/verify-tiering.md:2535` zitiert historisch unknown, cmdSource=env, ms=10092 und reason='audit timed out after 10000ms — no verdict'. Der vollständige Ledger wurde jetzt nicht erneut gelesen. Nahezu gleiche Timeout-Dauern beweisen Last nicht als ausschließliche Ursache: schon der Timeout-Mechanismus bindet das Ende an die Budgetgrenze.

**Kosten:** Die Sonde für Queue-Parking liefert unknown; die Kausalität aller Quartett-Folgefehler ist nicht einzeln isoliert. **Fix-Design:** Setup und Timeout mit benannten result/reason diagnostizieren; Überlappung durch eine gestartete, gehaltene und freigegebene Fixture herstellen, statt Schlaf plus Spawn in vier Sekunden Restbudget zu quetschen. Eine begrenzte Margenänderung ist möglich, beweist aber keine 15-Minuten-Kapazität. **Kleinster Falsifikator:** Setup gezielt über das Budget treiben und als „Sonde konnte nicht messen“ melden; Parked-Erhalt und Weiterarbeit eines anderen Repos separat unter gehaltenem Job prüfen.

### 16 — Merge-Rerun-Guard, §11.2n

**Disposition: Sonde falsch; offen.** `e2e/lane-helpers.ts#settleForMerge:73` pollt 80-mal mit 150 ms Pause und kehrt nach Erschöpfung bei `:80` kommentarlos zurück. `:77` akzeptiert zudem now-lastOutput auch bei lastOutput=0. `e2e/merge.ts:529` wartet auf den Helper und ruft anschließend Merge auf; `:535` verlangt resolved/review und keinen gestarteten Job. Eine bewiesene Idle-Vorbedingung fehlt dazwischen.

**Beleg:** `e2e-trail/isolated-20260904T130230Z-99743.jsonl:1270` meldet blocked mit 'the session is actively working right now — let it settle for a moment, then land'. Damit wurde das Idle-Gate erreicht, der Auflösungs-Guard nicht. Kosten: Regressionsarbeit wird auf einen nicht gemessenen Vertrag gelenkt.

**Fix-Design:** Helper liefert ready/timeout samt zuletzt beobachteten Fakten, einschließlich observed>0, wo erforderlich; abhängiger Aufruf erst nach erfolgreicher Vorbedingung. **Kleinster Falsifikator:** Dauerhaft beschäftigte Pane muss als Setup scheitern; eine ruhige Lane mit gehaltener Auflösung muss weiter verweigern, ohne einen Job zu starten. Mehr als zwölf Sekunden zu warten behebt allein keine falsche Attribution.

### 17 — Projektion nextAction/R10, §11.2o

**Disposition: Wurzel und Fixture-Klausel repariert; Ursache des historischen Regimewechsels unbekannt.** Der Stream-Poll in `server.ts` schiebt offset bei `:9130` vor und erfasst bei `:9149` die erste Beobachtung auch innerhalb des Ruhefensters. Eigene Repaints werden dadurch nicht wiederholt zu Aktivität. `e2e/programs.ts#waitDoneLooking:6701` verlangt nun bei `:6702` row.lastOutput>0. Früher konnte der einzige Fixture-Ausgabestoß innerhalb quietUntil verbraucht werden: observed blieb false, während Subtraktion von null fälschlich Ruhe behauptete.

**Beleg:** `e2e-trail/isolated-20260905T145210Z-77794.jsonl:2168` nennt R10 und 'pane never observed (lastOutput 0)' in beiden Projektionsarmen. `e2e-trail/isolated-20260906T084037Z-46610.jsonl:2183` besteht. Das belegt den damals fehlenden Fakt, nicht den Auslöser des Ratensprungs am 4. September. Kosten: Fertigstellung blieb unknown, die Sonde schrieb das der Land-Tür-Projektion zu.

**Kleinster Falsifikator:** Ein vollständig innerhalb quietUntil liegender Ausgabestoß muss Erstbeobachtung herstellen; nachfolgender eigener Repaint darf Aktivität nicht wiederholt auffrischen. Keine neue Kausalmessung zu Last oder Plattform.

### 18 — Empty-Requeue und Backlog-Kaskade, §11.2p

**Disposition: Kaskade gemessen; auslösender Mechanismus nicht reproduziert; Cleanup offen.** Die heutige Quelle liegt in `e2e/lanes-lifecycle.ts`: Fixture bei `:232`, Gate-Erwartung `:241`, Cleanup-Aussagen `:243`, Task-Löschung mit ungeprüfter Antwort `:247`. Der historische Verweis auf e2e/tasks.ts ist für diese Fixture überholt. Die spätere Sektion `e2e/tasks.ts:990` verlangt genau eine offene Notiz, führt aber auch bei gescheitertem Setup die Backlog-Aussagen ab `:998` aus.

**Beleg:** `$TMPDIR/fleet-e2e-trail/isolated-20260904T190127Z-33824.jsonl:1179` fällt beim Gate-Requeue mit einer Note über seine Lane. `:2597` liest neben der vorgesehenen Notiz eine pending-kind:auftrag-Zeile mit Text requeue-teardown-empty. `$TMPDIR/fleet-e2e-trail/isolated-20260904T193948Z-28477.jsonl:1179` und `:2597` bestehen. Beide Läufe tragen tree=null; das Paar allein beweist keine identischen Codebytes. Historische Zuordnung zu Audit-Tips und deren Diff verlangt eigene Prüfung. `server.ts#teardownSlotOccupant:4637` erzeugt die generische Note 'lane closed before landing'; sie identifiziert keinen Autoclose.

**Kosten:** Ein verunreinigtes Register erzeugt mehrere scheinbare Backlog-Regressionsfehler. **Fix-Design:** Eigene Zeile und exakten Occupant auch im Fehlerfall bereinigen und deren Abwesenheit nachweisen; bei falscher Ausgangslage Setup-Fehler ausdrücklich melden und abhängige Vertragsmessung unterbinden. **Kleinster Falsifikator:** Requeue oder Delete gezielt scheitern lassen; der spätere Abschnitt darf die Verunreinigung nicht als gewöhnliche Backlog-Vertragsverletzung ausgeben. Die auslösende Verschränkung bleibt unknown; kein pauschales „kein Regress“.

### 19 — Q6-Cap und verhinderte Zustellung anderer Ereignisse, §11.2q

**Disposition: Sonde falsch; Latch-Mechanismus am Code gelesen; bestehender Auftrag 6488292a.** Quelle ist `e2e/watch.ts:2099`, nicht programs.ts. `reachedLatch` führt bei `:2184` zu einem stillen break; `:2186` schreibt die Release-Datei. `waitReportRow` pollt alle 50 ms (`:2136`) auf exakte attempts/reason (`:2187`). `server.ts#waitForFleetReportRecoveryTestLatch:5006` kehrt bei vorhandener .release zurück und verbraucht sie nicht. `server.ts#recoverFleetReportDelivery:11052` ruft den Latch bei jedem Versuch, `:11059` erhöht attempts; der nächste Tick besucht retryable-Zeilen erneut (`server.ts#tickWatches:11105`). Nach einer Freigabe werden weitere Versuche daher erst wieder gehalten, wenn der nächste Fixture-Restart die Latch-Dateien bei `e2e/watch.ts:2167` löscht. Der Code beweist dieses Fenster, nicht den genauen historischen Ablauf darin.

**Beleg:** `e2e-trail/isolated-20260906T185956Z-12343.jsonl:899` zeigt erwartungsgemäß zuerst attempts=1/retryable, dann 0→2, -2→3, abc→5/capped. Das Detail endet mit dem Kürzungsmarker. send-uncertain ist hier Soll-Zustand. Kosten: verpasstes attempt=4 erscheint als Cap-Verletzung und zieht weitere Inbox-/Zustellprüfungen mit.

**Fix-Design:** Freigabe je Versuch oder bestätigte Latch-Generation; explizites Ergebnis für die erreichte Vorbedingung; auf >= erwartet warten, anschließend exakte Zahl und benannte Klauseln behaupten. Cap-, ACK- und Zustellvertrag bleiben erhalten. === in der Behauptung durch >= zu ersetzen würde sie abschwächen. **Kleinste Falsifikatoren:** unerreichbarer Latch, übersprungener Zwischenzähler und tatsächlich falscher Cap müssen unterschiedliche Diagnosen liefern. Aus legitimen aufeinanderfolgenden Versuchen folgt kein Server-Cap-Defekt.

### 20 — Watch-Idempotenz und Löschen des verbrauchten Watch, §11.2r

**Disposition: Sondenbelege fehlen; Duplikat gegenüber Fixture-/Gesamtzählungsfehler ungeklärt; bestehender Auftrag 6488292a.** `e2e/watch.ts:3775` verknüpft existing=true, gleiche Id und Gesamtzahl aller armed-Watches des Empfängers; `:3778` druckt nur den Id-Vergleich. `:4300` löscht den verbrauchten Watch ohne Status-/Body-Detail. Diese Diagnoseblindheit ist am Code belegt. Die serverseitige Subscription-Route wurde hier nicht vollständig geprüft.

**Beleg:** `e2e-trail/isolated-20260824T015411Z-67326.jsonl:843` fällt mit gleichen Ids; `e2e-trail/isolated-20260825T164455Z-86413.jsonl:857` und `e2e-trail/isolated-20260905T102255Z-80773.jsonl:1018` mit verschiedenen. Gleiche Ids unterscheiden falsches existing nicht von der Empfänger-Gesamtzählung. Verschiedene Ids beweisen verschiedene Antworten; für eine Idempotenzverletzung muss zusätzlich der armed-/Target-Lebenszyklus zwischen beiden Requests gesichert sein.

**Kosten:** Scheinbare und tatsächliche Duplizierung sind in der Oberfläche nicht unterscheidbar. **Fix-Design:** Drei benannte Klauseldiagnosen, Details der Delete-Antwort und begründete Ausgangslage über das konkrete Target und den Empfänger. **Kleinste Falsifikatoren:** zusätzlicher fremder armed-Watch; falsches existing bei gleicher Id; echtes armed-Duplikat desselben Targets; gelöschter oder abgelaufener erster Watch. Jede Bedingung muss sich selbst benennen.

### 21 — D2 und die Frische des Anzeigecaches, §11.2s

**Disposition: Fixture-Reparatur vorhanden; historischer Plattformunterschied beobachtet, Spawn-Geschwindigkeit nicht neu kausal gemessen.** `server.ts#tickGit:3353` liest Slots und Git-Fakten seriell (`:3396`), mit einem Zehn-Sekunden-Intervall (`server.ts:21934`). `e2e/watch.ts#d2Want:3204` benennt nun alle sieben Lane-Anforderungen, liest je Runde einen Snapshot (`:3220`) und prüft d2Missing.length===0 mit unmet-Gründen (`:3223`). Früher wartete die Fixture nur auf zwei schließende Lanes und unterstellte frische Git-Fakten für die Refuser.

**Beleg:** `streams/helper-artifacts/26ea1a205005/1788546888449/suite.log:992` fällt mit dirty=0/ahead=0 bei allen sieben Snapshots, einschließlich der Refuser. `streams/helper-artifacts/26ea1a205005/1788682911018/suite.log:1002` zeigt deren Zwischenzustand dirty=1/ahead=0 während Schreiben/Commit. `streams/helper-artifacts/26ea1a205005/1788735737956/suite.log:1002` besteht später mit unmet=[] und den vorgesehenen Werten. Lokal besteht `e2e-trail/isolated-20260906T084037Z-46610.jsonl:949`; die absichtliche Dirty-Datei-Mutation `e2e-trail/isolated-20260906T100031Z-48319.jsonl:949` fällt mit unmet=['9: dirty=1 (the uncommitted file is served)'], während die ahead-Anforderungen erfüllt sind.

**Kosten:** Eine nicht hergestellte Cache-Vorbedingung erschien auf dem schnelleren Executor als SPENT_RULES-Verletzung. **Kleinster Falsifikator:** Erhaltene Mutation der fehlenden Dirty-Datei beibehalten, verzögerte Cache-Aktualisierung zulassen; keine Serverregel an einen veralteten Snapshot anpassen. Historische Plattformraten und Spawn-Kosten wurden nicht unabhängig nachgemessen.

### §11.2t — einzelne Codex-Exact-Resume-Heal-Sichtung

**Disposition: anhand erhaltener Detailbelege nicht reproduzierbar; Mechanismus unknown.** `post-land-audits.jsonl:510` trägt result=red, mainSha=a1f8b65f0c32fb514e21be1865e899cd63868643, ms=2146177 und den einen benannten Fehlcheck. In beiden untersuchten Verzeichnissen wurde keine zugehörige rote Detailzeile gefunden; die direkte Suche nach `isolated-20260907T024245Z-1907687.jsonl` blieb leer. Ein erhaltener grüner Beleg ist `e2e-trail/isolated-20260907T064414Z-22587.jsonl:3111`; er erklärt das verlorene Rot nicht.

`e2e/restart.ts:324` wartet bis 7000 ms auf den Resume-Befehl, schläft bei `:331` weitere 2500 ms und verknüpft bei `:335` exakte Id mit genau einem neuen self_heal_recreate. Das Detail bei `:337` würde beide Klauseln unterscheiden, enthält aber pane_start_command: künftige Belegextraktion muss daraus bereinigte Fakten gewinnen und darf keine Prozesskommandozeilen publizieren. `server.ts#tickCodexRecovery:3310` erkennt Bindungen; der tatsächliche Wiederaufbau publiziert seinen Audit-Eintrag bei `server.ts:4372`. Eine Kausalität zum letzten Land-Diff wurde nicht nachgewiesen.

**Kosten:** Das verlorene Detail verhindert die Attribution zu Regression oder Timing. **Kleinster Falsifikator:** Beim nächsten autorisierten begrenzten Lauf vor Instanzbereinigung exactResume, healDelta und Ereigniszeiten unter versiegelter Lauf-/Quellidentität bewahren. Bei gehaltener exakter Bindung und doppeltem Heal liegt eine Produktverletzung vor; eine nicht erreichte Vorbedingung ist Setup-Fehler. Die einzelne Sichtung gewährt keine pauschale Flake-Ausnahme.

### Nicht gemessen

Keine neuen Sonden- oder Suite-Läufe, Publikationsverifikation oder unabhängige Abnahme; kein Nachweis, dass sämtliche Reparaturen auf dem Quellpin bestehen, und keine Kapazitätsaussage. Die Subscription-Route zu Familie 20 wurde nicht vollständig geprüft. Bei Familie 15 fehlt der vollständige historische Instanzledger am geprüften Pfad, bei 18 bleibt das auslösende Rennen unknown, bei 17 der historische Regimetreiber, bei der Heal-Sichtung das rote Detail.

„Fällt auf verschiedenen Bäumen, also kann es nicht dieser Diff sein“ schließt wiederholte oder erneut eingeführte Regressionen nicht aus. Attribution braucht exakte Abstammung, Dirty-Zustand, vollständigen Land-Diff und Mechanismus. Die Trail-Verzeichnisse änderten sich während der Suche; daraus gewonnene Zählungen sind kein versiegelter Populationsbeweis.
## Audit-Zustandsmaschine — Vorschlag

Die Namen sind Entwurfszustände vorhandener Covers/Claims, kein Auftrag für neue Serverobjekte. `terminal` bezeichnet das Ende eines Messversuchs, nicht automatisch die Erfüllung der Auditpflicht. Ein `unknown` beendet den Versuch, lässt aber ausdrücklich eine unbeantwortete Pflicht sichtbar; Wiederholung braucht einen begrenzten Versuch und eine benannte Zustandsänderung.

| Zustand | Eintritt / Besitz | Zulässiger nächster Übergang |
|---|---|---|
| `queued` | Land-Cover dauerhaft erfasst; noch kein Executor | `parked`, `offered` oder direkt `local-owned`; optional `local-wait` |
| `parked` | Kein zulässiges Auditkommando | Konfiguration verfügbar → `queued`; Fristverletzung bleibt sichtbar |
| `offered` | Ein begrenztes Helfer-Vorrecht, älteste Deadline fest | Atomarer Helfer-Claim → `remote-reserved`; Frist/fehlende Eignung → `local-owned`; optional `local-wait` |
| `local-owned` | Exklusiver lokaler Auditversuch; Shell-Mutex noch nicht erworben | `preparing`; ab dieser Entscheidung kein Re-Offer |
| `local-wait` (nur Reservierungsoption) | Nur Ticket/Reservierungsabsicht; keine Snapshot-/Suite-Prozesskette gestartet | Mutex verfügbar → `local-reserved`; vorab sauber bestätigter Rückzug → `offered` |
| `local-reserved` (nur Reservierungsoption) | Genau ein Besitzer hält die lokale Ressource für diesen Versuch | `preparing`; kein Re-Offer |
| `remote-reserved` | Genau ein gültiger, gedeckelter Helfer-Claim mit Versuchsgeneration | `preparing`; bestätigte Aufgabe/Lease-Ende → `draining` |
| `preparing` | Eingefrorene Covers, Tree und Messkommando; Snapshot/Download/Install | Erfolgreich → `measuring` oder `executor-wait`; Fehler/Abbruchbudget → `draining` |
| `executor-wait` | Bereits lokal oder remote fest zugeordnete Prozesskette wartet vor/zwischen Wrappern auf ihren Mutex | Acquire → `measuring`; Abbruchbudget → `draining`; kein Re-Offer |
| `measuring` | Suite gestartet, Phasen und Teilwartezeiten beobachtbar | Vollständiger Exit/Output → `recording`; nächster blockierter Wrapper → `executor-wait`; Abbruch → `draining` |
| `draining` | Weitere Ausgabe nicht als vollständiges Urteil akzeptieren; Prozessbeendigung läuft | Nach nachgewiesenem Ressourcenende → `recording`; ungeklärter Besitzer → `quarantined` |
| `quarantined` | Ende oder Besitzeridentität nicht belegbar | Keine neue Arbeit auf derselben Ressource; benannter Betriebsentscheid oder neuer Endbeweis |
| `recording` | Ergebnis, Evidenzreferenzen und gemessene Tree-Zuordnung validieren und dauerhaft schreiben | Erst nach Persistenz → Versuch `terminal`, dann passende Covers quittieren |
| Versuch `terminal` | `green`, `red` oder `unknown` mit Ursache und Umfang | Nächste Covers freigeben; offene Pflicht bei `unknown` sichtbar wieder vorlegen |

Der direkte Pfad `local-owned → preparing → executor-wait/measuring` bleibt ohne Reservierungsumbau zulässig und ist der lokale Fallback von S4. Nur eine separat angenommene Reservierungsoption aktiviert `local-wait → local-reserved`; S4 braucht sie nicht. Beide Pfade trennen exklusiven Auditbesitz vom tatsächlichen Mutex-Erwerb.

`deadline-exceeded` ist ein orthogonaler Fakt, kein Ersatzurteil: er gilt auch bei späterem Grün. Ein wartender Versuch kann die Frist verletzen, ohne Regression oder Laufzeit-Timeout zu sein. Ein begonnener Messlauf darf bei ausreichendem separatem Arbeitsbudget weiter ein späteres Urteil liefern; sein Fristbruch verschwindet dadurch nicht.

### Invarianten und falsifizierbare Proben

| Invariante | Deterministischer Gegenversuch für die zuständige Opus-Lane |
|---|---|
| I1 — Jede Cover-Deadline stammt vom jeweiligen Land; Koaleszenz verschiebt keine davon. | Alle 30 s ein Cover über mehr als 900 s einspeisen, Helfer online aber belegt: älteste Deadline bleibt identisch; ein weiterer Land darf die maximale Grace nicht neu beginnen lassen. |
| I2 — Jeder Versuch hat höchstens einen Executor. | Helfer-Claim gegen direkten lokalen Besitzentscheid und gegen optionale Mutex-Zusage verschränken; genau ein Start, Gegenseite erhält Konflikt. Test mit verzögerter Bundle-Erstellung und einem zweiten Claim wiederholen. |
| I3 — Übergabe ist ausschließlich aus dem optionalen `local-wait` vor produktiver Vorbereitung zulässig und quittiert den alten Anspruch zuerst; `local-owned`, `preparing`, `executor-wait` und `measuring` bleiben nicht übertragbar. | Lokales Ticket zurückziehen; Re-Offer erst nach Bestätigung, dass kein Kind startete und der Anspruch entfernt ist. Stirbt die Bestätigung, bleibt Zustand unbekannt statt beide Seiten zu starten. |
| I4 — Queuezeit, Vorbereitung, aktive Arbeit und Ergebniszeit haben getrennte Messpunkte. | Fake-Uhr + synthetische Acquire-/Wait-Meldungen über mehrere Wrapper; fehlende Meldung ergibt unbekannte Phase/untere Schranke, niemals null Sekunden. Vorlauf ohne Wrapper verbraucht Vorbereitungs-/Arbeitsbudget. |
| I5 — Timeout und Claim-Verfall beenden keinen Besitz durch bloßes Umbenennen. | Absichtlich langlebiges Kind und Enkel beim Timeout; erst nach belegtem Prozess-, Lock- und Socket-Ende neue Arbeit. Signalaufruf allein lässt Test rot. Verlorene Helferverbindung kann keine lokale Garantie über den Remoteprozess liefern. |
| I6 — Eingefrorene Cover-Menge und gemessener Tree werden zusammen quittiert. | Land während Snapshot/Bundle; spätes Resultat für alte Versuchsgeneration; SHA-Mismatch; Neustart zwischen Urteil und Queue-Quittung. Nichts ungeprüft decken, verspätete Reports verwerfen/als solche speichern. P3 besitzt den Integritätsnachweis. |
| I7 — Eine rote Regression braucht einen gültigen Checkvertrag und attribuierbare Evidenz. | Vorbedingung fällt, Probe startet nicht, Output bricht ab, Exit 1 vor erstem Check, falscher Tree: Messfehler/unknown, keine Regression. Echte Vertragsverletzung bei gültiger Fixture bleibt rot und benennt den falschen Konjunkt. |
| I8 — Kurzkette ist ein anderer belegter Messumfang. | Nur Fleet-Repo + nichtleere Cover-Menge + alle `proportional:true` darf install+pins wählen. Ein Code-Cover, unbekannte Alt-Cover oder Fremdrepo erzwingen konfigurierte volle Kette. Kurzkette erfüllt keinen behaupteten Vollsuite-Nachweis. |
| I9 — Cap ist eine Ressourcengrenze, kein Lastmittelwert. | Bei Cap 1 zwei Starts im selben Tick, verzögerter Claim, Restart und veralteter Heartbeat: Startzähler nie über 1. Fehlende Server-Cap-Daten dürfen keinen gemessenen freien Platz vortäuschen. |

Im Istzustand schützen `server.ts#helperClaim:14864` nach Bundle-await und `#drainPostLandAudits:13597` den lokalen/remote Übergang; diese Schutzwirkung muss erhalten bleiben. Der Daemon reserviert vor dem await (`helper-daemon/daemon.ts#start:399`) und begrenzt über `#freeSuiteSlots:391`. Der Server liest dagegen nur den letzten gemeldeten Zähler (`server.ts#helperClaim:14823`); fehlende Felder sind dort keine atomare serverseitige Cap-Reservierung. Der Vorschlag behauptet keine stärkere heutige Garantie.

### Platzierung und Grace

Die erste baubare Korrektur ist das explizite Ende einer Helferbelegung: Für schon wartende Covers muss ein frei gewordener geeigneter Helfer eine neue, aber am ältesten Deadline-/Maximalwartepunkt gedeckelte Claim-Gelegenheit erhalten. Der heutige unmittelbare `helperResult → kickAuditDrain`-Vorsprung lokaler Arbeit entfällt nur innerhalb dieser begrenzten Gelegenheit. Gemeldetes „active“ bedeutet dabei nicht „frei“ (`server.ts#helperClaimCandidateExists:13185` prüft keinen Cap).

Vorschlag: `offerUntil = min(now + configuredGrace, oldestDeadline - provenRemainingBudget, oldestQueuedAt + maxPlacementWait)`. Ist `provenRemainingBudget` unbekannt, lautet die Dispositionsgrenze `min(now + configuredGrace, oldestDeadline, oldestQueuedAt + maxPlacementWait)`; die 900-s-Zusage bleibt unbelegt. Eine bereits abgelaufene Grenze erlaubt keine weitere Grace. `maxPlacementWait` ist ein endlicher, vor Umsetzung angenommener Wert und darf hier höchstens 900 Sekunden betragen; P1 setzt keine Live-Konfiguration. Bereits verstrichene Deadline erzeugt sofort den Fristbruch, aber löscht den Audit nicht. Grace 0 und fehlender Helfer bleiben ohne zusätzliche Verzögerung. Fremdrepo-Kommandos und proportionale Ketten bleiben lokal, bis ein separat angenommener Vertrag andere Executor-Fähigkeiten beweist (`server.ts#helperJobsView:14373`).

Ein Re-Offer eines bereits gespawnten, im Shell-Mutex wartenden Audits wird vorerst nicht empfohlen: das Kind kann zwischen Beobachtung und Rückzug starten. Der vorhandene lokale Pfad besitzt keinen bestätigten Transferpunkt. Erst eine nachgewiesene Reservierung vor Snapshot/Spawn rechtfertigt `local-wait`. Diese stärkere zweite Option braucht I2/I3/I5 und das Ergebnis von `e407aef5`; P1 erteilt keine Implementierungsfreigabe dafür.

Audit-Priorität im FIFO-Mutex ist ebenfalls keine stillschweigende Lösung: `e2e-stage.sh:227` vergibt Tickets vor Lockversuch, `:255` wartet auf die Position. Eine Umordnung kann Lane-Arbeit verhungern lassen. Der Entwurf hält FIFO; ein späterer Prioritätsentscheid braucht eine obere Wartegarantie für beide Klassen. Auch eine lange Grace ist keine Kapazitätserhöhung.

### Uhren, Arbeitsende und Koaleszenz

Der gegenwärtige lokale Timeout beginnt erst beim gespawnten Kommando (`server.ts#runPostLandAudit:13869`); die Ledger-Wandzeit beginnt früher (`:13822`). `suiteWait:11830` zählt abgeschlossene Acquire-Wartezeiten plus die untere Schranke einer noch wartenden Stufe. Der vorhandene `drain:11856` kann Zeilen laufend melden; eine Auswertung erst nach Pipe-EOF kann das Arbeitsbudget nicht rechtzeitig anhalten. `c9791a49` muss diese vorhandenen Mechanismen nutzen, statt einen zweiten Parser zu erfinden.

Der jetzige Timeout stößt SIGTERM und später SIGKILL an, wartet aber nicht auf bestätigte Beendigung aller Nachkommen (`server.ts#runPostLandAudit:13890`). Der Prozess-Snapshot deckt spätere Forks nicht ab. Wie weit der historische Überlebensfall dadurch erklärt ist, bleibt ohne gezielte isolierte Sonde unbekannt. Ein neues Namensfeld oder höheres Budget repariert diese Ressourcengrenze nicht.

Koaleszenz friert Covers erst bei Startentscheidung ein; neue Covers gehören zum Folgeversuch. Älteste Deadline und Inhalt des ersten Covers bleiben unabhängig vom jüngsten Land. Unbegrenztes Nachschieben darf weder Start noch Frist zurücksetzen. Erfolg am gemeinsamen Integrationstree belegt genau diesen Tree; er ist kein unabhängiger Test aller Zwischenstände. Ob „jedes Land“ einen Nachfahren-Audit als Deckung akzeptiert, muss im späteren SLO ausdrücklich heißen: Audit des eingefrorenen Integrationstips, dessen Cover-Zuordnung P3 beweist. Benötigt der Owner jeden Zwischenstand selbst, ist Koaleszenz dafür ungeeignet und die Kapazitätsrechnung muss mehr Arbeit tragen.

### Rot, Messfehler und ehrliche Oberflächen

Die vorhandenen roten Ledgerzeilen bleiben historische Rohfakten. Neue Attributionsinformation wird ergänzt; kein alter Exit wird durch einen bekannten Familiennamen grün gefärbt. Nach einer Sondenreparatur ist ein neuer Fehler derselben Checkzeile erneut zu untersuchen. Ein Check kann sowohl eine Fixture-Störung als auch einen echten Produktfehler finden.

`red` im Zielvertrag verlangt vollständigen Messabschluss, übereinstimmenden Tree, gültige Vorbedingungen und eine verletzte Produktinvariante. Ungültige Fixture, Vorbereitungsfehler, unvollständige Ausgabe oder ungeklärte Ursache bedeuten `unknown` mit benannter Ursache und Beleg. Ein solcher Versuch zählt als SLO-Verfehlung, auch wenn die Ursache bekannt ist. Das verhindert Erfolgsverbesserung durch Umbenennen von Rot in Unknown. Die bestehende Tri-State-Wire-Struktur kann erhalten bleiben; zusätzliche Ursachen und Beweisumfang müssen in allen Verbrauchern gleich gelesen werden.

| Oberfläche / Adapter | Entscheidung im Entwurf |
|---|---|
| Server, Ledger, Queue-Wiederherstellung | apply: Versuch, Deadline, Phasen und offene Auditpflicht; Altzeilen ohne neue Felder bleiben unknown hinsichtlich dieser Felder. |
| Helfer-Protokoll und Daemon | apply: Phasen-/Endbelege, Claim-Generation, Cap; ältere Daemons ohne Fähigkeit unsupported für die neue Fristgarantie, keine stillschweigende Gleichstellung. |
| Lokaler Wrapper / Mutex | apply nur bei gewählter Reservierungsoption; bestehendes FIFO und sichere Besitzgrenze erhalten. Kein Default-Port-/Socket-Test. |
| Client, Program-Projektion, Audit-Watch, Deploy-Sicht | apply: wartend vs messend, Fristbruch vs Regression und Rohurteil vs Attribution anzeigen. Ein wartender Audit darf nicht als fertig wirken; Änderung der Deploy-Sperre ist eigener Auftrag/P3-Grenze. |
| Claude/Codex/Pi als Lane-Harness | not-applicable für Executorwahl der Audit-Kommandos; apply für einheitlich lesbare Verify-Belege, keine modellabhängige Erfolgssemantik. |
| Fremdrepos | unsupported für Fleet-Kurzkette; vorhandenes eigenes Auditkommando weiter maßgeblich. |
| Docs und Proben | apply: jede Zustandskante, fehlende/kaputte Altdaten, Restart und konkurrierende Claims; keine Probe darf den getesteten Erfolg selbst vorspiegeln. |
## Höchstens fünf serielle Opus-Schnitte

Dies sind Brief-Vorschläge an die bestehenden verantwortlichen Programs, keine hier freigegebenen Implementierungsaufträge. Jeder Schnitt beginnt erst nach Annahme des vorherigen Ergebnisses; die genannten bestehenden Zeilen werden integriert oder von ihrer MAIN ausdrücklich neu gefasst. Ein aktueller Worker wird nicht durch eine zweite Zeile dupliziert. Harness/Modell für Umsetzung: `claude` / `claude-opus-5[1m]` / `high`. Das Dokument selbst erhält vorher einen eigenen seriellen Publikationsakt ohne Produktcode.

Routing-Snapshot: Fleet-Betrieb `f170dc46e4b026ee34d9392e` ist an Slot 7, Land-Pipeline `233e1c2b7eaca3850decf332` an Slot 5, Audit-Determiniertheit `79036e9a58e3429578165297` an Slot 6 gebunden. Vor Zustellung erneut Program-ID und Occupant lesen; die Slotnummer allein erteilt keine Zuständigkeit. P1 gibt Befund und Vorschlag an Ober-MAIN `e3b3a0642d5c8106eb545a40`, nicht direkt als fremde ausführbare Queuezeile.

### S1 — Getrennte Audit-Uhren und bewiesenes Prozessende

Träger Fleet-Betrieb, vorhandener Auftrag `c9791a49` (im Snapshot `sent`). `ff4544f5` ist ersetzt und bleibt ohne zweite Umsetzung. Read-set: `server.ts#runPostLandAudit`, `#suiteWait`, `#drain`, `#descendantPids`, `#killProcessTree`, `fleet-e2e-postland-audit.ts`, `e2e/repo-worker-audit.ts`, `e407aef5`-Diagnose. Write-set erst nach dem bestehenden Cap-1-Gegenfaktual: genau Audit-Timer/Beendigungsblock, seine vorhandenen Typ-/Projektionsfelder und zugehörige Audit-Proben. Kein Platzierungs-, Mutex- oder Deploy-Umbau.

Done: Der angenommene Gegenfaktualbericht entscheidet zuerst Build oder begründeten Stop; falls gebaut, unterscheiden benannte Sonden Queuebudget und Arbeitsbudget, belegen bei erzwungenem Timeout tatsächlich beendete Kinder/Lock/Socket und lassen jedes ungemessene Ergebnis unknown. Fehlender Endbeweis verlangt RETHINK der Prozessgrenze, nicht noch einen höheren Timeout. Verify: `bun e2e/pins.ts && ./e2e-postland-audit.sh`; dazu die vollständige untenstehende Gate-Kette und genau eine erforderliche isolierte Vorschau. Zielbeweis ist die kaputte Kind-/Wait-Mutation, keine Nach-Fix-Flakerate.

### S2 — Q6 und Idempotenz als diagnostizierbare Verträge

Träger Audit-Determiniertheit, vorhandener Auftrag `6488292a`; `6334dd01` ist ersetzt. Read-set: `e2e/watch.ts` Q6/Watch-Idempotenz, `server.ts#waitForFleetReportRecoveryTestLatch`, `#recoverFleetReportDelivery`, `docs/verify-tiering.md` §11.2q/r und die Familien 19/20 dieses Specs. Write-set: diese beiden Probe-Sektionen und ihre Doku; Änderung eines Test-Latches im Server nur nach ausdrücklicher Übernahme ins Brief-Write-set. Kein produktiver Cap-Umbau aus einer übersprungenen Zwischenbeobachtung.

Done: Drei getrennte negative Sonden unterscheiden nicht erreichte Fixture, übersprungenen Zwischenzustand und echte Vertragsverletzung; Idempotenz zeigt jeden Konjunkt und Delete-Status; originale Cap-, ACK-, Starvation- und Same-ID-Aussagen bleiben erhalten. Verify: `bun e2e/pins.ts && ./e2e-isolated.sh`, isolierten Lauf über angebotenen Helfer gemäß Task-Brief oder erlaubten seriellen Fallback; volle Gate-Kette zusätzlich. Vor Start muss die MAIN den verbliebenen „fünf lokale Läufe“-Satz gegen die spätere explizite Ablösung im selben Brief bereinigen. Fünf grüne Wiederholungen sind hier kein Ersatz für die drei unterscheidbaren Sabotageausgänge.

### S3 — Abbruchfähige Voraussetzungen und gemessene Warteersparnis

Träger Audit-Determiniertheit, vorhandene Zeile `aa3fd660`, von ihrer MAIN als erste begrenzte Welle zu präzisieren. Read-set: `e2e/lane-helpers.ts#settleForMerge`, `e2e/merge.ts` Familie 16, `e2e/repo-worker-audit.ts` RW/PARKED, `e2e-postland-audit.sh` slow-Fixture, `e2e/harness.ts`, die belegten betreffenden Trail-Zeilen. Exklusives Write-set dieser Welle: diese fünf Dateien und jeweilige Disposition in `docs/verify-tiering.md`. Kein pauschaler Austausch aller Sleeps; Mindestdauerprüfungen bleiben bestehen.

Done: Ready/Timeout sind explizite Ergebnisse, eine gescheiterte Vorbedingung verhindert nachgelagerte Produkturteile, und RW-Überlappung wird an einem kontrollierten Zustandsübergang statt an sechs Sekunden Sleep hergestellt; auf identischem Messumfang werden Vor-/Nachher-Zeiten nach Phasen ausgewiesen. Verify: `bun e2e/pins.ts && ./e2e-postland-audit.sh && ./e2e-isolated.sh` plus Gate-Kette; deterministische Dauer-/Busy-Sabotage muss die Voraussetzung selbst rot machen. Die historische 20%-Schwelle und alte Checkzahl der Queue werden nicht ungeprüft auf neue Trees übertragen; eine Änderung dieses Dones gehört der zuständigen MAIN. Weitere Timerfamilien bleiben ausdrücklich weitere Disposition, kein versteckter Umfang dieses Schnitts.

### S4 — Begrenzte Helfergelegenheit nach Freiwerden

Träger Fleet-Betrieb: Ergebnis der bereits queued Diagnose `e407aef5` zuerst übernehmen; diese docs-only Zeile wird nicht heimlich zur Implementierung umgedeutet. Anschließend genau ein angenommener Folgeauftrag im selben Program. Read-set: `server.ts#helperResult`, `#drainPostLandAudits`, `#armAuditGraceKick`, `#helperClaimCandidateExists`, `#helperJobsView`, `#helperClaim`; `helper-daemon/daemon.ts#tick`, `e2e/helper-portal.ts`, `e2e/helper-daemon.ts`; S1-Beendigungsbeleg und P3-Cover-Prüfung. Write-set: begrenzte Grace-/Wiederfreigabeentscheidung und deren bestehende Proben/Doku. Kein Re-Offer eines bereits gespawnten Audits, keine Ticket-Priorität, kein Cap-/Env-Edit.

Done: Ein frei gewordener Helfer kann liegengebliebene Covers innerhalb genau eines gedeckelten Fensters claimen; fortlaufende neue Lands verschieben weder älteste Deadline noch maximale Platzierungswartezeit; konkurrierender lokaler Start und verspäteter Claim erzeugen genau einen Besitzer. Verify: `bun e2e/pins.ts && ./e2e-postland-audit.sh && ./e2e-isolated.sh` plus Gate-Kette. Fake-Uhr-Proben für unendliche Landserie, offline/busy/frei, Grace 0, Restart und Bundle-await sind Pflicht. Wenn eine reine begrenzte Gelegenheit das Kapazitätsziel nicht verbessert, Stop mit Messung; nicht automatisch den riskanteren Transfer bauen.

### S5 — Auditpflicht und gemessene Frist auf allen Oberflächen

Träger Fleet-Betrieb für Audit-Pipeline, mit Annahme der Schnittstellen durch Audit-Determiniertheit und Land-Pipeline. Voraussetzung: S1–S4 und P3s Belege für Tree-/Cover-/Verdict-Zuordnung. Read-set: `PostLandAuditRow`, `postLandAuditLiveView`, `postLandAuditSummary`, Audit-Watches/Program-Projektion in `server.ts`, zugehörige `src/protocol.ts`-Typen und Client-Auditdarstellung; Familienindex dieses Specs. Exklusives Write-set: vorhandene Audit-Felder/Reader/Anzeige, ihre Proben und Doku, keine neue Nachrichten- oder Deploy-Architektur.

Done: Jedes Land zeigt unveränderte Deadline, gemessenen Umfang, Urteil oder benanntes Nichturteil und späte Ergebnisse als verspätet; eine defekte Fixture, fehlendes Log oder falscher Tree kann weder Regression noch fristgerechten Erfolg vortäuschen, und Neustart verliert keine offene Pflicht. Verify: `bun e2e/pins.ts && ./e2e-postland-audit.sh && ./e2e-isolated.sh` plus Gate-Kette; UI-Ausführung an isolierter Instanz für warten/messen/unknown/verspätet. Abschließender Betriebsnachweis nach separat autorisiertem Deploy: vollständiges vereinbartes Ankunftsfenster, jedes Cover im Nenner einschließlich Unknown, alle Fristüberschreitungen, Phasen und Ressourcenausfälle. Ohne beschränkte Kapazität und Ankünfte bleibt die harte 900-s-Garantie ausdrücklich unbelegt.

### Gemeinsamer Verify-Vertrag und offene Träger

Vor jeder Lane-Verifikation `GET /api/self/gate` mit dem Lane-Token lesen. Die produktiven Schnitte erwarten mindestens die zugehörige volle Kette; bei geändertem Gate-Vertrag stoppt die MAIN zur fachlichen Prüfung. Lokale Ausführung immer seriell, Logs außerhalb des Baums; die isolierte Vorschau wird nur einmal ausgeführt bzw. angeboten, nicht zusätzlich zur identischen bereits belegten Vorschau. Shellzeilen hier sind für spätere Opus-Lanes, nicht für die Astra-Autorin:

```sh
bun install --frozen-lockfile &&
bun e2e/pins.ts &&
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun \
  e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts \
  fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts \
  fleet-e2e-harness.ts merge-prompt.ts &&
bun run build &&
./e2e-clean-review.sh &&
./e2e-security.sh &&
./e2e-claude-gate.sh
```

`64860da8`/M2 bleibt bei Land-Pipeline: erneutes Warten eines noch nicht gelandeten Kandidaten erfüllt keine Auditfrist ab Land. Sein zusätzliches Mutex-Aufkommen muss aber in S4/S5 eingehen. P1 erstellt keine zweite M2-Zeile. `5cd2d1b9` bleibt Vorschau-Tiering bei Audit-Determiniertheit und ist kein sechster P1-Schnitt: weniger Vorschauarbeit kann Kapazität freigeben, der Tier-2-Audit selbst bleibt vollständig. `16da0d0f` ist am Pin gegen die bereits reparierte Erstbeobachtung abzugleichen, nicht blind erneut zu bauen. Die vorhandenen Diagnosen werden nach ihren eigenen Originalbelegen angenommen, nicht nach Worker-Status.

Die fünf Schnitte versprechen nicht, jede noch unbekannte Familie repariert zu haben. Reseed, terminales Task-Requeue, Phasen-Restart, Cleanup-Kaskade und verlorener Codex-Heal-Beleg behalten ihre oben genannten kleinsten Falsifizierer und Eigentümergrenzen. Vor einem allgemeinen „Rot heißt Regression“-Betriebsversprechen müssen diese Restfälle klassifiziert oder neue rote Beobachtungen als ungeklärt ausgewiesen werden. Ein solcher Rest ist keine Freigabe zur unbegrenzten sechsten Lane.

## Abnahme, Publikation und nicht gemessen

Die unabhängige zweite Astra liest diese vollständige Datei und relevante gepinnte Quellen. Ihre Annahme lautet ausschließlich `ACCEPT sha256:<Datei-Hash>` für die fertig versiegelten Bytes; Ablehnung nennt belegte Mängel. Ein SHA-256-Dateihash ist kein Git-Commit-SHA. Eine Änderung nach Abnahme verlangt neue unabhängige Prüfung der Änderungen im Gesamtdokument. Der Reviewbeleg wird separat zurückgegeben, damit die Datei nicht ihren eigenen Hash enthalten muss.

Erst danach übernimmt eine isolierte serielle Opus-Publikationslane die akzeptierten Bytes unverändert als `docs/messungen/2026-09-07-verifikation-zielbild.md`, ergänzt im alleinigen Publikationsakt eine passende Zeile in `docs/messungen/INDEX.md`, führt `bun install --frozen-lockfile && bun e2e/pins.ts` aus und committet selbst. Vorgeschlagene Indexzeile: „Die historische Audit-Erzählung stimmt nicht mit den Ledgerzeiten überein; 21 Familien plus Einzelsichtung, eine Zustandsmaschine mit offenen Kapazitätsgrenzen und fünf serielle Schnittvorschläge — docs/messungen/2026-09-07-verifikation-zielbild.md · bereich: verify,audit,flake · stand: 2026-09-07“.

MAIN liest die Original-Install-/Pins-Logs einschließlich Exit und `ALL PASS`, tatsächlichen Diff, neuen getrackten Pfad, sauberen Index und finalen Datei-Hash. Sie vergleicht diesen Hash mit dem Reviewhash und separat den gemeldeten Git-Commit mit dem tatsächlichen Lane-HEAD. Erst nach dokumentierter Annahme darf der Controller landen. Diese MAIN landet oder deployt nicht. Das Spec ist kein PLAYABLE-Produkt und keine gemessene Betriebsverbesserung.

Nicht gemessen: keine neuen Suite-/Serverläufe, keine aktuelle Nach-Fix-Rate je Familie, kein eingefrorenes vollständiges Trail-Archiv, keine Helfer-Journalmessung, keine reine CPU-/Arbeitszeitverteilung, keine Ausfall-/Burst-Obergrenze, kein vollständiger Cap-1-Gegenfaktualnachweis, keine unabhängige Prüfung aller Subscription-Wege, keine neue Tree-Integritätsprobe (P3), keine Implementierung und kein Betrieb nach Deploy. Die Quellenprüfung belegt Mechanismen bzw. offene Beweisfragen; die Dokumentprüfung install+pins belegt nur die spätere Publikation.

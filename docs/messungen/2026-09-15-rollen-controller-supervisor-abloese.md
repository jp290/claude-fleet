---
frage: Ersetzen Orchestratorin und Fleet-Betrieb-MAIN den Controller und den Supervisor ohne Funktionsverlust?
urteil: Controller-Auftrag übernehmen; Supervisor-Session mit der Orchestratorin zusammenlegen, aber Supervisor-Bindung und Kanäle erhalten. Leichtgewicht braucht vorher eine eigene Disposition. Betriebs-MAIN behalten; Steward als stehende Rolle ablösen, technische Stilllegung separat entscheiden.
bereich: [rollen, datenlayer, nachfolge, orchestrierung]
stand: 2026-09-15
---

# Rollen ablösen: Sitzplätze reduzieren, Zuständigkeiten erhalten

**Das Paar übernimmt die sichtbare Arbeit bereits, aber noch nicht alle gebundenen Rechte und Rückwege.**
Der Controller hat keine eigene technische Bindung; seine konkrete Session ist jedoch MAIN von
Leichtgewicht. Der Supervisor hat eine eigene Bindung und exklusive Türen. Einfach beide Slots zu
schließen hinterließe ein Program ohne erreichbare MAIN und einen unbesetzten Querbeobachter.
Belege: Eingabe `rollen-extract.json` → `programsActive`, `supervisorBinding`;
`server.ts#boundProgramForMain` (9100), `server.ts#supervisorRefusal` (25717).

Die Abstraktion soll bestehen, soweit sie **Program-Verantwortung, programmübergreifende Beobachtung
und Owner-Entscheidung** trennt; eine zusätzliche dauerhaft besetzte Pane für jeden Rollennamen ist
dafür nicht erforderlich. Das ist das Gestaltungsurteil dieser Vorlage, keine bereits promovierte Regel.

## 1. Beweisgrenze und Eingaben

**Am Code geprüft:** die unten genannten Bindungs-, Nachfolge-, Nachrichten-, Report-, Inbox-,
Supervisor- und Steward-Pfade im Checkout `47a0319c42415817bf1a778d2251a6c40443d858`
(`git rev-parse HEAD`). Symbolverweise meinen diesen Stand; Klammerzahlen sind dessen Zeilen.
`rg -an '<symbol>' server.ts` findet auch die vom Quellpaket als „binary-source“ ausgelassenen Symbole.
Der Graph wurde nur zur Orientierung abgefragt; die Aussagen beruhen auf gelesenen Funktionskörpern.

**Übernommene Beobachtungen:** privates Eingabepaket `rollen/`, `measuredAt: 2026-09-15 18:57`.
Hier heißen die Dateien nur beim Basename; keine privaten Pfade oder Rohtranskripte werden veröffentlicht.
Das Paket enthält keinen Extraktionscode. Seine `last3d_counts` sind deshalb **übernommene
Fensterzählungen**, keine hier unabhängig reproduzierten Ledger-Abfragen. Zeitzone für die Umrechnung
von Pane-Zeitstempeln: `Europe/Berlin`; für das undatierte Zonenfeld `measuredAt` eine Annahme.

| Eingabedatei | SHA-256 der gelesenen Bytes |
|---|---|
| rollen-extract.json | 88ca7861731d86ab68b1cd824a7cf8789a0676c97473436c6598da32922fb741 |
| pane-slot2.txt | de007b702cf3dae384152c22d6d501d1a8784b70f71e6881b5ba5eab0c7083be |
| pane-slot8.txt | ab4d8fd4908ff464b83c3fcb4ed2fe6001fccde7db50a3e40bff159d970507cd |
| pane-slot9.txt | a65e92610aa6360f8cd2e7f602248c6af1ddd98f3d60bc4f31e02c1d6b2c3883 |
| pane-slot10.txt | 5ec067cff9577469398a51ba9916de5a28284451adcbef53aecc6b844b758270 |

Reproduktion der Hashes: `shasum -a 256 "$ROLLEN_INPUT"/*`, wobei `ROLLEN_INPUT` auf das private
Eingabeverzeichnis zeigt. Die Dateien bleiben privat. Für eine Epoch-Millisekunde aus einer Pane:
`datetime.fromtimestamp(t / 1000, ZoneInfo("Europe/Berlin")).isoformat()` in Python.

**Keine belastbare Vollzählung pro Rolle:** `slots: []`; leere Objekte für `fleetReports`,
`attentionRequests`, `messages`, `events`; daneben befüllte Zählungen nach Slot. Insbesondere bedeutet
`fleetReports_receiverSlot.None: 70` weder „Owner bekam alle“ noch „niemand bekam Reports“.
Aktive Program-Reports haben gerade `receiver:null`, `basis:"program"` und eine Program-Inbox-Referenz
(`server.ts#openFleetReport`, 8146). Ohne `basis`/Program-Join bleibt ihre Empfängerzuordnung unknown.
Slot-Zähler tragen zudem keine Occupant-Identität; eine recycelte Nummer ist keine Rolle.

Gelesene Vorarbeiten: `docs/controller.md`; `docs/supervisor-succession.md` insbesondere Identität,
Kanäle, Bind-Runbook und Lücken; `docs/steward.md`; relevante Abschnitte von `docs/self-api.md` zu
Watch, Succession, Inbox, Messages und Reports; `docs/messungen/INDEX.md`; Rollen-Synthese vom
2026-09-14 (§0, §2b, §3); Datenschichten-Notiz vom 2026-09-10 (Matrix und Schnitte); Ordnungsbericht
vom 2026-09-07; Queue-Stau-Notiz vom 2026-09-15; Betriebsplan vom 2026-09-13 (§2, §2a, §5).
Alte Aussagen wurden an den relevanten heutigen Pfaden gegengeprüft, alte Mengen nicht fortgeschrieben.

Nicht geprüft: vollständige Laufzeit-Ledger, aktuelle fremde Self-Sichten, Roster-Liveness,
Nachrichtenbestand, Steward-Journal/Autos, vollständige Queue und deployed SHA. `fleet.json` und
`.env` wurden nicht geöffnet. Keine fremden Credentials, keine Live-Panes, kein API-Schreibaufruf
für diese Untersuchung. Nur der Abschlussbericht wird gesendet. Produktpfade wurden gelesen,
nicht in einer Lifecycle-Suite ausgeführt. Kein belastbarer Kontextfüllstands-Sensor dieser Session.

## 2. Eine Tabelle je Rolle

„Exklusiv“ heißt: durch diese Bindung bzw. dieses Credential zugänglich; ein Owner kann daneben
andere Türen besitzen. Labels gewähren beim Controller und Supervisor keine Rechte.

### 🎛 Controller

| Bindung im Datensatz | Nachfolge-Schiene | Nur diese Rolle: Türen/Routen | Gelesene / geschriebene / empfangene Datenschichten | Beobachtete Aktivität im Eingabefenster |
|---|---|---|---|---|
| Controller ist Scope, keine Bindung. Die konkrete Session aus Slot 10 steht als `programsActive[Leichtgewicht].main` im Paket. Ob diese Occupation noch lebt: unknown. | Bei exakt aktiver MAIN: `succeedProgramMain`, Program-Handover. Ohne MAIN: generischer Zweig von `handleSelfSucceed`, `LineageHandover.role:"generic"`. `migrateRailOf` folgt der MAIN-Bindung, nicht dem Label. | Keine Controller-exklusive Self-Tür. `self/programs` ist für Nicht-Lanes; nur eigene Vorschläge/gebundene Programs sichtbar. `role:"controller"` ist als Nachrichtenadresse ausdrücklich nicht auflösbar. MAIN-Türen nur aus Leichtgewicht-Bindung. | Program/Queue/Inbox/Report-Urteile für Leichtgewicht; eigene Events/Watches; Attention nur als MAIN. Portfolio-Disposition mit konkreter Owner-Delegation ist zusätzlicher Auftrag, kein Credential aus dem Namen. | `last3d_counts`: Slot 10 hat Watches 5, empfangene Events 1. Pane zeigt Review, Folgeauftrag und Land-Auftrag an die damalige Orchestrator-Session; Receipt-Zeit 1789235056347 = 2026-09-12 19:44:16 CEST. Später im Tail behauptete Inbox-Bereinigung: 8 gelesen, 0 ungelesen; kein heutiger Inbox-Stand. |

Code: `server.ts#handleSelfSucceed` (7216), `server.ts#migrateRailOf` (14946),
`server.ts#resolveMessageAddress` (9364), `server.ts#boundProgramForMain` (9100).
Program-Sicht: Route `GET /api/self/programs` unter `server.ts#isBoundSupervisor` (25692),
Route-Zweig bei 30449. Aktivität: `rollen-extract.json#last3d_counts`, `pane-slot10.txt:245` und
Receipt im selben Tail. Die konkrete Leichtgewicht-MAIN ist der tragende Unterschied zum Label.
Zusätzlich bindet `server.ts#sameProgramSession` (1973) die Sicht auf eigene Vorschläge an den
ursprünglichen Occupant einschließlich Session-ID. Noch offene Vorschläge sind im Paket nicht
inventarisiert; auch sie gehören vor dem Schluss in die Owner-Disposition.

### 🧿 Supervisor

| Bindung im Datensatz | Nachfolge-Schiene | Nur diese Rolle: Türen/Routen | Gelesene / geschriebene / empfangene Datenschichten | Beobachtete Aktivität im Eingabefenster |
|---|---|---|---|---|
| Persistierter Singleton `supervisorBinding`: Slot 2, openedAt 1788958257705, sessionId null. Autorität folgt Slot + openedAt; null Session-ID macht die Bindung nicht automatisch ungültig. | `handleSelfSucceed` → `succeedSupervisor`: Rollen-Lineage und Bindungswechsel nach Briefzustellung. Kein HANDOFF-Commit nötig; `intent` oder `pointer`. `migrateRailOf` nennt den Restpfad weiterhin `handoff`, dessen Text inzwischen den Linien-Record verlangt. | `GET self/supervisor-view`, `POST self/nudge`, `POST self/supervisor-watch/:id/complete`; Querinhalt aller Programs in `GET self/programs`; Nachrichtenadresse `role:supervisor`. Keine eigene Owner-Attention. | Liest Program-Health/Promotion/Rückwege, Queue-Phasenzahlen, offene Events/Attentions, Outcome-/Context-/Audit-/Deploy-Ledger in begrenzter Projektion. Schreibt Nudge-Receipt/Journal und Transition-Events; liest/schreibt adressierte Messages. Keine fremde Program-Inbox und keine Report-Abnahme allein aus Supervisor-Bindung. | Frische Aktivität in den letzten 3 Tagen **unknown**. Im Tail erfolgreiche Nudges und Transition-Abschlüsse, aber die sichtbaren Zeitstempel 1788958596010 und 1788963591685 liegen am 2026-09-09, außerhalb dieses Fensters. `pane-slot2.txt:244` meldet den fehlenden MAIN→Supervisor-Rückkanal. Aus dem Tail folgt kein „sendet heute noch“. |

Code: `server.ts#isBoundSupervisor`, `server.ts#supervisorHealth` (25702),
`server.ts#supervisorView` (25743), `server.ts#supervisorNudge` (25951),
`server.ts#completeTransitionWatch` (26027), `server.ts#succeedSupervisor` (25367),
`server.ts#messageSenderFor` (9325). Quelle für Identität und Aktivitätslücke: Eingabepaket.

### Orchestratorin

| Bindung im Datensatz | Nachfolge-Schiene | Nur diese Rolle: Türen/Routen | Gelesene / geschriebene / empfangene Datenschichten | Beobachtete Aktivität im Eingabefenster |
|---|---|---|---|---|
| Kein eigener Orchestrator-Datensatz im geprüften Rollenpfad. Im Paket endet eine Kette `role:"generic"` in Slot 8. Keine aktive MAIN-Bindung für Slot 8 in `programsActive`; aktuelle Occupation mangels `slots` unknown. | Generische Succession, Linie statt Program-Handover. Eingabe: 5 Übergaben am 15.09., 4→5→7→3→12→8. Nach Bindung als Supervisor würde die nächste Nachfolge `succeedSupervisor` wählen; die bisherige `lineageId` wird weiterverwendet. | Keine exklusiven Self-Türen, keine adressierbare `role:orchestrator`. Ohne zusätzliche Bindung auch keine Messages-Adresse. Gezeigte Owner-Routen sind delegierte Ausführung, kein Rollenrecht. | Im Pane: Queue lesen/schärfen/dispatchen, Prioritäten, Auditfakten, Lane-/Merge-/Audit-Watches, eigene Events, Git/Messnotizen und INDEX-Ernte; Nachrichten an MAIN per Owner-`/send`. Kein automatischer Zugang zu fremden Program-Inboxen. | Slot-Zähler: Watches 5, Events 6, Worker-Reports 1. Keine Rollen-Summen: dieselbe Nummer konnte andere Arbeit tragen. `pane-slot8.txt:50,167`: beobachtete Send-Receipts an Betriebs-MAIN; Tail belegt Umreihung, neue Messaufträge und Ernte. Die 5 Übergaben sind zugleich im `lineageHandovers_last7d`-Ausschnitt enthalten und alle auf den 15.09. datiert. |

Code: `server.ts#handleSelfSucceed` (7216), `server.ts#captureLineageObligations` (6902),
`server.ts#writeLineageHandover` (6933), `server.ts#messageAddressesFor` (9344).
Aktivität: `rollen-extract.json#last3d_counts`, `pane-slot8.txt`; die Rollenbezeichnung ist
Pane-/Auftragskontext, die persistierte Linie nennt lediglich `generic`.

### Fleet-Betrieb-MAIN

| Bindung im Datensatz | Nachfolge-Schiene | Nur diese Rolle: Türen/Routen | Gelesene / geschriebene / empfangene Datenschichten | Beobachtete Aktivität im Eingabefenster |
|---|---|---|---|---|
| `programsActive[Fleet-Betrieb].main`: Slot 9, openedAt 1789481191150. Program-ID f170dc46e4b026ee34d9392e. `release.policy:"card-valid"` ist Freigabepolitik, kein Beleg einer Self-Land-Promotion. | Standard-Program-MAIN: `succeedProgramMain`, offenes Program und Handover als Träger; kein HANDOFF-Commit als Gate. Slotwechsel lässt die Program-Adresse bestehen. Kein `succeedLane`. | MAIN-Türen für genau ihr Program: program-execution, tasks/release/hold, inbox/read, clarification reply, attention; Self-Land nur mit passenden Gates/Promotion. Diese Art Türen hat jede entsprechend gebundene MAIN, nicht exklusiv das Betriebsprogram. | Eigene Queue und Program-Fakten; Program-Inbox mit Report-/Attention-/Land-/Audit-Zeigern; Report-Abnahme; Merge-/Audit-Watches und Event-Ack. Messages als Program-Prinzipal. Liest Audits, schreibt Entscheidungen über die jeweilige autorisierte Tür; kein fleetweiter Supervisor-Querblick aus MAIN-Bindung. | Slot-Zähler: Watches 7, Events 5, Attentions 2. `pane-slot9.txt:240`: be5a959f als ef72b878 gelandet, Report angenommen, Audit-Watch angelegt; zuvor Audit-Events mit unknown. Das sind übernommene Pane-/Event-Belege, kein eigener Auditlauf dieser Untersuchung. |

Code: `server.ts#boundProgramForMain`, `server.ts#createTaskForMain` (10327),
`server.ts#selfLandTaskForMain` (10002), `server.ts#inboxProgramFor` (9119),
`server.ts#captureProgramHandover` (25167), `server.ts#succeedProgramMain` (26077),
`server.ts#RAIL_TAIL` (24928). Quelle für Bindung/Zahlen: Eingabepaket.

### ⚙ steward

| Bindung im Datensatz | Nachfolge-Schiene | Nur diese Rolle: Türen/Routen | Gelesene / geschriebene / empfangene Datenschichten | Beobachtete Aktivität im Eingabefenster |
|---|---|---|---|---|
| Besonderer Label-String `STEWARD_LABEL` und eigenes `stewardToken`; keine Supervisor-/Program-Bindung dadurch. Token wird beim Spawn anhand des Labels exportiert. | `successionScopeError` verweigert succeed und retire ausdrücklich. Stehende Rolle mit eigenem Journal; weder generische noch Supervisor- noch Lane-Nachfolge. | Credential-Scope `/api/steward/sessions`, digest, tasks, autos, send, journal; außerdem Deploy-Tür im Steward-Handler. Das sind Credential-Rechte, keine zugesicherte Owner-Autorisierung jedes Aufrufs. | Queue-Vorschläge mit ref-Dedupe und pending-Zwang; Digest aus Slots/Verify-/Integrationsfakten; Rundgang-/Inspektions-Journal; begrenzte Sends und eigene Autos. Program-Inbox/Messages nur mit zusätzlicher passender Bindung. | **unknown**: kein Steward-Slot, Journal oder Tokenstatus im Paket nachgewiesen. `autosBySlot:{4:1}` belegt kein Steward-Auto, weil der Rollen-/Occupant-Join fehlt. Keine Aussage „ungenutzt“, keine Nutzungsquote. |

Code: `server.ts#STEWARD_LABEL` (3065), `server.ts#stewardSlot` (3134),
`server.ts#ensureSlot` (5185), `server.ts#successionScopeError` (6810),
`server.ts#handleStewardRoute` (30077), `server.ts#readStewardJournal` (28640).
`docs/steward.md` ist daher als heutige alleinige Berechtigungsbeschreibung unzureichend:
„plans, never lands“ erklärt insbesondere die vorhandene Deploy-Tür nicht.

## 3. Die entscheidenden Datenflüsse

| Schicht / Quelle | Schreiber → Leser | Was weckt wen? | Wirkung einer bloßen Rollenablösung |
|---|---|---|---|
| Program-Record, Queue | Owner/gebundene MAIN → dieselbe Program-MAIN; Supervisor liest Querprojektion | MAIN-Gründungsbrief und spätere konkrete Rückwege; kein allgemeiner Portfolio-Push | Leichtgewicht wird nicht dadurch Betriebsaufgabe, dass die Controller-Pane schließt. `server.ts#boundProgramForMain`, `server.ts#buildProgramMainBrief`, `server.ts#supervisorView`. |
| fleetReports → Program-Inbox | Lane → aktives Program; MAIN liest Subject und entscheidet getrennt | Inbox-Nudge mit GET-Anleitung, kein vollständiger Report-Push. `server.ts#openFleetReport`, `server.ts#tickInboxNudge`, `server.ts#programInboxView` | Empfänger null ist hier korrekt. Orchestratorin ohne Program-Bindung übernimmt diesen Reader nicht. |
| attentionRequests | Program-MAIN ↔ Owner | Program-Inbox/Antwortpfad; Supervisor sieht offene Zusammenfassung | Kein Ersatz-Owner-Kanal durch Labelwechsel. `server.ts#boundProgramForMain`, `server.ts#attentionFor`, `server.ts#supervisorView`. |
| messages | MAIN-Prinzipal ↔ Supervisor-Prinzipal bzw. anderes Program | **Kein Wake-up im gelesenen Writer:** append + save + Antwort; Empfänger liest GET, quittiert separat | MAIN→Supervisor ist bereits gespeichert und beantwortbar. Die generische Orchestratorin hat jedoch keine Adresse. Bindungsübernahme erhält die Adresse `role:supervisor`. `server.ts#sendMessageFor`, `server.ts#messageViewFor`, `server.ts#readMessageFor`. |
| Nudge / Transition | Supervisor → lebende MAIN; Supervisor → Registrant eines Transition-Watch | Nudge direkt per sendText + Receipt/Journal; Transition über FleetEvent-Transport | Zwei verschiedene Rückwege: Nudge-Receipt ist keine MAIN-Antwort. Transition-Text erreicht nur den noch passenden Registranten. `server.ts#supervisorNudge`, `server.ts#completeTransitionWatch`. |
| Events / Watches / Autos | Subscription bzw. Producer → exakter Occupant | Bestehende Transport-/Zeit-Gates; ACK ist Empfang | Beim Schließen werden Watches/Autos entfernt und offene Zustellung als gone behandelt. Kein Umhängen allein durch neuen Rollennamen. `server.ts#teardownSlotOccupant`, `server.ts#dropWatchesFor`. |
| Lineage / Program-Handover | Succession → Nachfolgerin | Brief nennt Record; Nachfolgerin muss lesen | Generic/Supervisor speichern Pflicht-IDs, kein automatisches Rearm. Program-Handover trägt auch vorherige offene Handover-Pflichten weiter. Bind allein kopiert die alte Supervisor-Linie nicht in die Orchestrator-Linie. `server.ts#captureLineageObligations`, `server.ts#captureProgramHandover`, `server.ts#bindSupervisor`. |
| Audits / Deploy / Context-Receipts | Suite/Server → Betriebs-MAIN, begrenzte Supervisor-Sicht | Expliziter Audit-Watch; audit-red-Inbox ist absichtlich still | Betriebs-MAIN deckt eigene Integration; Querbeobachtung fremder Programs wird dadurch nicht garantiert. `server.ts#writeAuditInboxEntries`, `server.ts#tickInboxNudge`, `server.ts#supervisorView`. |

### Veraltete Aussagen, die eine falsche Ablösung nahelegen

- **„Kein technischer MAIN→Supervisor-Rückkanal“:** für den historischen Pane-Akt nachvollziehbar,
  heute als pauschale Aussage falsch. `server.ts#messageSenderFor`, `server.ts#resolveMessageAddress`
  und `server.ts#sendMessageFor` erlauben ihn; fehlend bleibt die automatische Weckung.
  `replyTo` verlangt eine echte Nachricht an den antwortenden Prinzipal. Eine Nudge-ID ist keine
  Message-ID und kann nicht einfach als `replyTo` eingesetzt werden.
- **„Keine Supervisor-Lineage“:** `server.ts#supervisorView` fügt diese Unknown-Zeile noch
  bedingungslos ein, obwohl `server.ts#succeedSupervisor` inzwischen `writeLineageHandover` aufruft.
  Succession hat einen Record; Bootstrap/Bind rekonstruieren die frühere Supervisor-Historie weiterhin
  nicht. Die richtige Aussage trennt diese Wege. `docs/supervisor-succession.md` §1.2 und §5.1 sind überholt.
- **„Alle Reports kommen von selbst in die MAIN-Pane“:** `server.ts#RAIL_TAIL` verspricht das;
  `server.ts#openFleetReport` schreibt für aktive Programs eine Inbox-Referenz. Der Nudge ist ein
  eigener Versuch. Diese bereits in der Datenschichten-Notiz vom 2026-09-10 benannte Differenz bleibt relevant.
- **„Generische Nachfolge übernimmt alles“:** `server.ts#captureLineageObligations` sammelt aktuell
  gebundene Pflichten; es merged nicht den vorherigen Linien-Record wie `captureProgramHandover`
  alte Program-Pflichten. Historische Records können vorhanden sein, aber `lineageSelfView` zeigt den
  an diesen Occupant adressierten Record. Die Übergabekette beweist daher keinen lückenlosen Pflichtentransfer.

## 4. Unterschiede mit Verlustkosten, nach Wirkung geordnet

| Rang | Heute getragen, vom Paar noch nicht gleichwertig abgedeckt | Beleg | Kosten beim Wegfall |
|---|---|---|---|
| hoch | **Leichtgewicht-MAIN hinter dem Controller-Label:** Reader und Entscheider eigener Program-Pflichten | Eingabe `programsActive`; `server.ts#boundProgramForMain`, `server.ts#inboxProgramFor` | Offene Ergebnisse/Entscheidungen hätten keinen erreichbaren zuständigen MAIN. Dass im historischen Tail die Inbox leer war, beendet kein Program. |
| hoch | **Supervisor-Querblick samt Vollinhalt fremder Programs:** Phasen, Promotion, Rückwegschulden, offene Owner-Fragen, Integration und Provenienz | `server.ts#supervisorView`, `server.ts#isBoundSupervisor`; Self-Programs-Zweig (30449) | Fremde stale MAINs, blockierte Rückwege oder unbeurteilte Audits werden nur noch ad hoc bzw. mit Owner-Zugang gefunden. Betriebs-MAIN sieht aus ihrer Bindung ihr Program. |
| hoch | **Nachfolgefeste Rollenadresse `supervisor`:** Nachricht kann bei Vakanz gespeichert bleiben und später gelesen werden | `server.ts#resolveMessageAddress`, `server.ts#messageAddressesFor` | Bei endgültiger Vakanz verbleibt Rollenpost ohne aktiven Leser. Generic-Orchestratorin und Betriebs-MAIN lesen diese Adresse nicht. |
| mittel | **Occupant-geprüfter Nudge und Transition-Abschluss:** begrenztes Nachfragen ohne Owner-Credential, typisierte Antwort an einen Registranten | `server.ts#supervisorNudge`, `server.ts#completeTransitionWatch` | Owner-Sends ersetzen die Zustellwirkung, nicht dieselbe Berechtigungsgrenze oder Transition-Semantik. Schließt der Controller als Registrant, kann der Abschluss zurückgewiesen werden. |
| mittel | **Eigene Beobachter-Aufmerksamkeit:** vom ausführenden MAIN getrenntes Prüfen fremder Programme | Rollenauftrag in `pane-slot2.txt`; tatsächliche heutige Abdeckung unknown | Zusammenlegung konzentriert Priorisierung und Übersehen bei der Orchestratorin. Das ist ein Organisationsrisiko, kein gemessener Ausfall und kein zwingender Grund für eine Dauer-Pane. |

Controller-Portfolioplanung, Auftragsschärfung und konkret delegierte Abschlüsse sind dagegen im
Orchestrator-Pane sichtbar übernommen. Ein Controller-exklusiver API-Kanal fehlt im geprüften Pfad.
Die Lane-Schiene ist kein Ersatz für eine dieser Rollen: `server.ts#succeedLane` hält Worktree,
Queue-Zuordnung und Handoff-Report derselben Lane zusammen, keine programmübergreifende Bindung.

**Offen, aber kein durch Ablösung neu entstehender Verlust:** automatische Message-Weckung;
vollständige generische Pflichtentransfers; tatsächlich ausgeführte Steward-Inspektionen.
Hieraus folgt kein Auftrag, einen zweiten Nachrichtenbus oder eine neue Controller-Bindung zu bauen.

## 5. Urteil je Rolle

| Rolle | Urteil | Tragende Begründung / Bedingung |
|---|---|---|
| 🎛 Controller | **ablösen** | Portfolio-Auftrag an Orchestratorin. Die konkrete Leichtgewicht-MAIN vorher separat geordnet fortführen oder durch Owner-Entscheid abschließen; ihr Program nicht still in Fleet-Betrieb verschieben. |
| 🧿 Supervisor | **zusammenlegen** | Session mit Orchestratorin zusammenlegen; technische Supervisor-Bindung, Adresse und Türen behalten. Bis Rollenvertrag und Übernahme erledigt sind, bleibt der bisherige Sitz bestehen. |
| Orchestratorin | **behalten** | Owner-Übersetzung, Priorisierung und Ernte sind sichtbar ihre Arbeit. Künftig zusätzlich technische Supervisor-Trägerin; dabei keine aktive Program-MAIN-Bindung. |
| Fleet-Betrieb-MAIN | **behalten** | Eigener Program-Reader, Lane-Führung und Integration brauchen ihre getrennte Bindung. Nicht gleichzeitig Supervisor werden. |
| ⚙ steward | **ablösen** | Als zusätzliche stehende Planungsrolle durch Orchestratorin ersetzbar. Journal/Inspektionswissen, Autos und Credential-Nutzung zuerst inventarisieren; mangels Daten keine technische Abschaltung oder API-Löschung empfehlen. |

**Zusammenlegung ist ein Owner-Entscheid über den Vertrag, keine zulässige Selbsternennung.**
`server.ts#buildSupervisorBindBrief` liefert heute einen Rumpf, der Code/Deploy kategorisch verbietet.
Er passt nicht unverändert zur Orchestratorin, die im Pane auch Ernte und delegierte Außenakte erledigt.
Die Änderung muss sagen: Supervisor-Bindung gewährt Beobachten/Nudgen, zusätzliche Owner-Aufträge
gewähren nur ihre ausdrücklich benannte Arbeit. Sie verleiht weiterhin keine MAIN-, Land- oder
Owner-Rechte. `server.ts#messageSenderFor` und `server.ts#handleSelfSucceed` verweigern die Kombination
Supervisor + aktive MAIN als mehrdeutig. `bindSupervisor` verhindert diese Kombination am Eingang
noch nicht selbst: der Owner muss sie vor der Ernennung ausschließen.

## 6. Ablöseplan — geordnete, getrennt freizugebende Akte

1. **Owner promoviert die Zielverteilung aus §5 und den schmalen Rollenvertrag.**
   Keine neue Bindungsart „Controller“ oder „Orchestrator“ anlegen. Betriebs-MAIN bleibt eigenständig.
   Vollständige aktuelle Occupant-Paare über Owner-Sicht bestimmen; die Slotnummern dieser Notiz sind
   historische Eingaben. Biber nennt im Paket ebenfalls Slot 2, aber ein anderes openedAt als der
   Supervisor: diese beiden Bindungen können nicht dieselbe Occupation bezeichnen. Kein Doppelrollen-
   oder Liveness-Schluss allein aus der Nummer (`server.ts#supervisorHealth`, `server.ts#boundProgramForMain`).
2. **Leichtgewicht disponieren, erst danach Controller-Sitz schließen.** Owner benennt für offene
   Tasks, eigene Program-Vorschläge, Inbox, Reports, Attentions, Nachrichten, Watches und alte Handover-Pflichten jeweils Leser
   und nächsten Akt. Falls das Program weiterläuft: eigene MAIN/Nachfolge erhalten; bestehende
   Program-Succession bzw. nach echter Vakanz Owner-`bootstrap-main` nutzen. Falls beendet: Gründe und
   offene Reste ausdrücklich entscheiden. Nicht Betriebs-MAIN oder künftige Supervisor-Orchestratorin
   zusätzlich daran binden. `server.ts#succeedProgramMain`, `server.ts#handleOwnerProgramRoute`.
3. **Rollenkarten-Schnitt A und Wahrheitskorrektur B unten umsetzen, verifizieren und regulär landen;
   Betrieb aktiviert den geprüften Stand nur mit entsprechender Deploy-Autorität.** S4-Nachbar
   `87ed77cf` anhand des exakten aktuellen Texts abgleichen. Dessen Volltext fehlt im Eingabepaket;
   sein offener Status ist Auftragskontext, kein hier abgefragter Queue-Fakt. Schnitt A ist die
   Präzisierung für S4, keine parallel zu filende Dublette. B daneben nur einmal führen.
4. **Vor Supervisor-Schluss Übernahmebeleg herstellen.** Owner liest/sichert aktuelle Rollen-Messages,
   offene Transition-Watches, eigene Events/Autos/Reports, vorhandene Rollen-Lineage und offene
   Befunde; für jeden Rest neue Leserin, Quelle und gegebenenfalls Rearm benennen. Die Orchestratorin
   erhält einen bereinigten datierten Zeiger auf diese Übernahme; bloßes Bind führt keine alten
   Supervisor-Records zusammen (`server.ts#bindSupervisor`, `server.ts#captureLineageObligations`).
   Watches, deren Empfänger der zu schließende Controller ist, vor dessen Schluss erfüllen oder
   bewusst beenden und nötigenfalls durch den neuen Registranten neu anlegen.
5. **Owner schließt den exakt geprüften alten Supervisor-Occupant, bindet danach die Orchestratorin.**
   Vorhandene Türen: Owner-`POST /api/slots/:id/kill` → `server.ts#killSlot`; danach
   `POST /api/supervisor/bind` mit `{slot:<aktuelle Orchestratorin>}` → `server.ts#bindSupervisor`.
   Bind verdrängt keinen lebenden anderen Supervisor. **„Bindung lösen“ ist heute kein eigener
   Unbind-Aufruf:** Kill lässt den Singleton stale; Bind ersetzt ihn und nennt `replaced`.
   `server.ts#teardownSlotOccupant` löscht den Singleton nicht. `supervisorHealth` muss danach live
   für das neue Occupant-Paar zeigen. Kein Rohdatei-Edit, kein erfundenes DELETE/unbind.
   Scheitert Bind, ist die Rolle vorübergehend vakant; Owner repariert über dieselbe Bind-/Bootstrap-
   Tür. Nicht als erfolgreiche Zusammenlegung melden.
6. **Die neue Trägerin prüft ihre regulären Reader einmal und vollzieht nur offene, benannte Pflichten.**
   Self → Lineage, supervisor-view, self/programs, self/messages; eigene Events und neu nötige Watches.
   Nachfolgen gehen ab jetzt über `succeedSupervisor`; die Orchestrator-Linie bleibt ihre Linie,
   die alte Supervisor-Linie ist nur über den Übernahmebeleg erreichbar. Betriebs-MAIN behält
   Program-Inbox und Merge-/Audit-Rückwege. Ein Message-GET beweist Lesbarkeit, keine Weckung.
   Für spätere asynchrone Antworten darf der Vertrag deshalb keine automatische Zustellung versprechen.
7. **Steward-Sitz nur bei tatsächlichem Vorkommen und abgeschlossener Inventur schließen.**
   Relevante Journal-Fundstellen/Refutationswissen erhalten, laufende Autos ausdrücklich disponieren.
   Umbenennen entzieht ein bereits exportiertes Token nicht; Kill des Sitzes widerruft das persistierte
   Credential ebenfalls nicht (`server.ts#ensureSlot`, `server.ts#teardownSlotOccupant`). Technische
   Credential-/API-Retirement wäre ein eigener, hier mangels Nutzungsbeleg nicht formulierter Auftrag.
   Abschließend docs/controller.md, docs/supervisor-succession.md, docs/steward.md und AGENTS.md auf
   dieselbe Zielverteilung prüfen. Orchestratorin erntet die INDEX-Zeile dieser Messnotiz separat.

### Schnitt A — bestehenden S4-Auftrag präzisieren, nach Owner-Promotion

```fleet-card
ROLLE: codex/gpt-6-astra/high
GROESSE: mittel
FLAECHE: server.ts#supervisorBriefBody server.ts#buildSupervisorBindBrief server.ts#RAIL_TAIL server.ts#railBlockFor e2e/supervisor.ts e2e/programs.ts e2e/pins.ts docs/controller.md docs/supervisor-succession.md docs/steward.md docs/self-api.md AGENTS.md
VERIFY: volle Kette; e2e-isolated
DONE: Alle Rollenbrief-Wege nennen ihre bestehenden Reader und Grenzen korrekt; gebundene Orchestratorin erhält Supervisor-Türen ohne MAIN-Rechte, Program-Reports werden als Inbox-Pull beschrieben; positive und verweigerte Pfade bestehen.
Rollenvertrag für die Zusammenlegung von Orchestratorin und Supervisor nach dieser Vorlage und Owner-Promotion korrigieren; die bestehende S4-Zeile präzisieren, keine neue Controller-Bindung bauen.
```

Prüffälle: Bootstrap/Bind/Succession verwenden denselben Supervisor-Rumpf; Messages-Pull und fehlende
Weckung genannt; MAIN-Rail nennt Inbox/read und clarification reply; keine Aussage „Report-Text kommt
automatisch“. Nicht-Supervisor bleibt an Supervisor-Türen verweigert; Supervisor ohne MAIN bleibt
an Self-Land/Attention verweigert. Kein Rechte-Grant durch geänderte Prosa. Kein neues Role-/Model-Register.
Die Rolle im Kartenkopf ist die Executor-Wahl gemäß diesem Auftrag, keine neue Modellpolitik.

### Schnitt B — Supervisor-Sicht sagt die tatsächliche Lineage-Grenze

```fleet-card
ROLLE: codex/gpt-6-astra/high
GROESSE: klein
FLAECHE: server.ts#supervisorView server.ts#lineageSelfView e2e/supervisor.ts docs/supervisor-succession.md
VERIFY: volle Kette; e2e-isolated
DONE: Supervisor-Sicht unterscheidet vorhandenen Rollen-Record, fehlenden Record und Verlustspur; keine pauschale Aussage verneint persistierte Supervisor-Nachfolge; die Projektion bleibt read-only und begrenzt, Negativfälle bestehen.
Die veraltete bedingungslose Lineage-Lückenmeldung durch eine aus bestehenden Rollen-Records abgeleitete Aussage ersetzen; Bootstrap und Bind erhalten dadurch keine erfundene historische Nachfolge.
```

Prüffälle: initial ohne Linie, nach echter Supervisor-Succession, vorhandene lineageId ohne Record,
Verlustspur, Bind einer zuvor generischen Session; kein Querveröffentlichen fremder Lineage-Texte,
keine Zustandsänderung durch GET. Fehlende frühere Ernennungen bleiben ausdrücklich unknown.

**Oberflächenentscheid für diese Folgeschnitte:** server/Briefe/docs/Proben = apply; Wire bei A
unverändert, bei B nur additive bzw. korrigierte Supervisor-Projektion = apply; Reverse-State/Loader
= not-applicable, kein Schemawechsel; Browser-Client = not-applicable, kein neuer Board-Bedienakt;
Harnesses Claude/Codex/Pi und deklarierte Fremdharnesses = gleiche bestehende Bindung/Renderer,
keine neue Capability. Realzustellung über jedes Fremdharness bleibt hier ungemessen.
Neue Message-Weckung und komplette Abschaffung des Supervisor-Credentials sind außerhalb dieser Schnitte.

### Dokumentstellen in den Folgeschnitten

| Dokument | Konkret umzuschreiben |
|---|---|
| docs/controller.md | Auftrag/Schnitt: Orchestratorin übernimmt Scope; Program-MAIN-Bindung getrennt. Supervisor-Türen als übernommene Bindung, Messages-Pull ergänzen. Nachfolge-Fälle und Rollennamen abgleichen. |
| docs/supervisor-succession.md | §1.2 Brief/Channel-Liste, §1.4 Sicht, §4.1b Übernahme einer laufenden Session, §4.2 Linien-Record, §5.1 Succession versus Bind-Historie, §5.2 Attention-Grenze. |
| docs/steward.md | Was es ist, drei Konventionen, Sessionstart, Pulse, „What it is NOT“: optionale Altrolle und geordnete Wissensübernahme; Label/Token/Deploy-Tür korrekt erklären. Historische Erfolgszahlen datiert lassen. |
| docs/self-api.md | Messages ohne Push, Rollenbindung als Zugang; Supervisor-Übernahme und ungebundene Orchestratorin klar unterscheiden. |
| AGENTS.md | „Role contract — four levels“: Orchestrator-Portfolio mit Supervisor-Bindung, Betriebs-MAIN getrennt; „Hard invariants“: Beobachtung nach Zusammenlegung ohne Selbstdelégation, zusätzliche Owner-Akte explizit; Nachfolge-Regeln nach Bindung statt Titel. |

## 7. Kartenprüfung und lokaler Beweis

Die folgenden Skriptbytes prüfen die **obigen Karten**, keine umgeschriebene Kurzfassung. Ausführen
im Repo mit `bun /tmp/fleet-rollen-05f3/validate.ts`. Keine Server-Imports, keine API-Aufrufe.
Ein nicht-null leerer Symbolindex erzwingt für jedes Symbol den echten Deklarations-Fallback:
keine Scheinvalidierung nur über Dateiexistenz, keine geratenen Ranges.
Die Executor-Prüfung ist absichtlich auf das hier verwendete Codex-Triple beschränkt und gleicht
seine erlaubten Werte gegen den gelesenen Adapter ab (`server.ts#CODEX_HARNESS`, `server.ts#MODEL_RE`,
`server.ts#cardValidationContext`). Sie behauptet keine Provider-Verfügbarkeit.

```typescript
// VALIDATOR-SCRIPT-BEGIN
const root = process.cwd();
const { parseFormattedCard, validateCard, declaresSymbol } =
  await import(`${root}/card-extract.ts`);
const note = await Bun.file(`${root}/docs/messungen/2026-09-15-rollen-controller-supervisor-abloese.md`).text();
const cards = [...note.matchAll(/```fleet-card\n([\s\S]*?)\n```/g)].map(m => m[1]);
const listing = Bun.spawn(["git", "ls-files"], { cwd: root, stdout: "pipe" });
const paths = await new Response(listing.stdout).text();
if (await listing.exited !== 0) throw new Error("git ls-files failed");
const tracked = new Set(paths.trim().split("\n"));
const sources = new Map<string, string>();
const symbolFiles = new Set(cards.flatMap(card =>
  [...card.matchAll(/([A-Za-z0-9._/-]+\.ts)#/g)].map(m => m[1])));
for (const file of symbolFiles) {
  if (!tracked.has(file)) throw new Error(`untracked symbol source: ${file}`);
  sources.set(file, await Bun.file(`${root}/${file}`).text());
}
const server = sources.get("server.ts")!;
const model = /^[A-Za-z0-9._-]{1,64}(?:\[[A-Za-z0-9]{1,8}\])?$/;
if (!server.includes(`const MODEL_RE = ${model};`)) throw new Error("MODEL_RE drift");
const adapter = server.slice(server.indexOf("const CODEX_HARNESS:"), server.indexOf("const HARNESSES:"));
if (!adapter.includes('id: "codex"') ||
    !adapter.includes('effortLevels: ["low", "medium", "high", "xhigh", "max", "ultra"]'))
  throw new Error("CODEX_HARNESS drift");
if (cards.length !== 2) throw new Error("expected A and B");
function checkCard(sourceText: string) {
  const raw = parseFormattedCard(sourceText);
  if (!raw) throw new Error("formatted card not parsed");
  return validateCard(raw, {
    sourceText, trackedPaths: tracked, symbolIndex: new Map(),
    harnessKnown: (v: string) => v === "codex",
    modelKnown: (v: string) => model.test(v),
    effortKnown: (v: string) => ["low", "medium", "high", "xhigh", "max", "ultra"].includes(v),
    declares: (file: string, symbol: string) => declaresSymbol(sources.get(file) ?? "", symbol),
    rowKnown: () => false,
  });
}
for (const [i, card] of cards.entries()) {
  const result = checkCard(card);
  if (!result.valid || !result.surfaceValid || result.gaps.length) throw new Error(JSON.stringify(result));
  process.stdout.write(`${String.fromCharCode(65 + i)} parsed=true valid=true surfaceValid=true gaps=[]\n`);
}
const badSymbol = checkCard(cards[0].replace("#supervisorBriefBody", "#symbolDoesNotExistForRoleProbe"));
if (badSymbol.valid || !badSymbol.gaps.some((s: string) => s.startsWith("surface.symbols:")))
  throw new Error("unknown-symbol control failed");
if (parseFormattedCard(cards[0].replace(/^ROLLE:.*\n/, "")) !== null)
  throw new Error("missing-header control failed");
process.stdout.write("NEGATIVE unknown-symbol=rejected missing-header=rejected\nALL PASS\n");
// VALIDATOR-SCRIPT-END
```

Tatsächliche Ausgabe des Kartenprüfers (Exit 0):

```text
A parsed=true valid=true surfaceValid=true gaps=[]
B parsed=true valid=true surfaceValid=true gaps=[]
NEGATIVE unknown-symbol=rejected missing-header=rejected
ALL PASS
```

Der vorherige Self-Gate-GET lieferte `classifiedAs:{}` und die volle Empfehlung: er sieht nur
committierte Unterschiede (`server.ts#laneLocalProof`, 3556). Für den tatsächlichen einzelnen
Notizpfad ergibt der lokale Aufruf von `verify-proportion.ts#verificationProportionFor`:

```sh
bun -e 'import { verificationProportionFor } from "./verify-proportion"; process.stdout.write(JSON.stringify(verificationProportionFor(["docs/messungen/2026-09-15-rollen-controller-supervisor-abloese.md"])) + "\n")'
```

```json
{"steps":["install","pins"],"isolatedPreview":false,"classifiedAs":{"docs/messungen/2026-09-15-rollen-controller-supervisor-abloese.md":"docs-or-prose"},"proportional":true}
```

Ausgeführt, in dieser Reihenfolge; Rohoutput im Session-Scratchpad:

```text
bun install --frozen-lockfile
9 packages installed [36.00ms]
exit 0

bun e2e/pins.ts
ALL PASS
exit 0
```

`git diff --check`: Exit 0. Symboldeklarationen der Code-Verweise zusätzlich gegen die genannten
Dateien aufgelöst; keine ungelösten Referenzen. Die Notiz wurde auf private Pfade, Hostnamen,
Adressen und Benutzernamen durchgesehen; keine übernommen. Kein Produkt-Code geändert, kein
isolierter Lifecycle-Lauf: die Folgekarten benennen zukünftige Prüfungen, keine heute grünen
Produktproben. Die endgültige Gate-Einstufung wird nach dem Commit vor dem Abschlussbericht geprüft.

**Offene Grenze:** Owner-Entscheid und tatsächliche Übernahme stehen aus; aktuelle Restpflichten,
Steward-Nutzung und automatische Message-Weckung sind nicht durch diese Messnotiz erledigt.

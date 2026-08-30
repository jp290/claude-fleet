# Plan: Sensor-Rückschreibung — Review und Umsetzungsschnitt (2026-08-30)

Gegenstand ist `docs/konzept-sensor-rueckschreibung-2026-08-30.md#Konzept-Sensor-Rückschreibung-statt-Chips-2026-08-30` aus Commit
`c823398`. Geprüft wurde der aktuelle Baum; das Konzept wurde nicht als Quelle für
Ist-Behauptungen verwendet.

## Urteil vor der Detailkritik

`observedModel` soll als eigene Abstraktion existieren, weil Spawn-Wunsch und
Transcript-Beobachtung zwei verschiedene Fakten sind und `server.ts#contextFill` heute
eine laufende Messung mit dem Wunschwert kalibriert. Der Sensor darf aber keine
Spawn-Autorität erhalten.

`resultHarvest` soll nur als Zustand eines **expliziten, pro Dispatch eingefrorenen
Ergebnisvertrags** existieren. Die im Konzept vorgeschlagene Ableitung aus
`Task.files` soll nicht gebaut werden: diese Fläche ist im heutigen System weder für
die normale Task-Population vollständig noch ein Vertrag über ein Ergebnisartefakt.

## Prüfabdeckung

Verifiziert wurden:

- `lane-signals.ts#laneDoneLooking`, `lane-signals.ts#laneStalled` und
  `lane-signals.ts#laneStalledSince`; die Datei wurde vollständig gelesen.
- In `server.ts#Slot`, `server.ts#SlotSpawnOccupant`, `server.ts#Task`,
  `server.ts#TaskDigest` und `server.ts#LaneOutcome` die Typen; die Persistenz unter
  `server.ts#queueStateSave` und `server.ts#STATE_FILE`; die Reader
  `server.ts#readUsedTokens`, `server.ts#readPiUsedTokens`,
  `server.ts#readCodexContext`; die Lebenszykluspfade `server.ts#openSlot`,
  `server.ts#ensureSlot`, `server.ts#teardownSlotOccupant`,
  `server.ts#detachSlotTasks`; die Succession-Pfade
  `server.ts#handleSelfSucceed`, `server.ts#succeedSupervisor`,
  `server.ts#succeedProgramMain`; die Buchungspfade `server.ts#dispatchTask`,
  `server.ts#buildLaneOutcome`, `server.ts#emitLaneOutcome`,
  `server.ts#landLane`; die Views `server.ts#stewardSlotsView`,
  `server.ts#taskView`, `server.ts#taskDigest`; sowie die Eigentümer-Routen in
  `server.ts#Bun.serve`.
- `task-metadata.ts#deriveTaskMetadata`, die Queue-Projektion
  `src/client.ts#TaskInfo`, die Oberflächen `src/client.ts#renderQueueDetail` und
  `src/client.ts#renderQueue` sowie die bestehenden Testfamilien
  `e2e/steward-core.ts#run`, `e2e/lanes-lifecycle.ts#run`, `e2e/watch.ts#run`,
  `e2e/tasks.ts#run`, `e2e/outcomes.ts#run` und `e2e/security.ts#run`.
- Die Baseline in `.claude/skills/mess-notiz/SKILL.md#mess-notiz`: 123 von 567
  Outcome-Zeilen waren `killed-empty`. Das ist eine Git-Form-Messung, keine Zählung
  verlorener Mess-Ergebnisse.

NICHT GEPRÜFT:

- Ob aktuelle reale Claude-Transcript-Zeilen ein stabiles `message.model` tragen; ein
  privates Transcript wurde für dieses öffentliche Dokument nicht gelesen.
- Ob Pi-, Pi-ZAI-, Pi-Ox- oder Codex-Sessiondateien ein laufendes Modell tragen. Der
  Code belegt nur, dass ihre Kontextdateien lesbar sind, nicht dass darin dieses Feld
  existiert.
- Eine Laufzeitquelle für den tatsächlich aktiven Effort. Im Baum existiert keine.
- Wie viele der 123 `killed-empty`-Ausgänge tatsächlich einen geschuldeten
  Mess-Artefaktvertrag hatten. Damit ist der Nutzen von Teil D logisch, aber sein
  heutiges Volumen unbekannt.
- Produktverhalten auf einer mutierten Laufzeitinstanz; diese Lane schreibt
  planungsgemäß keinen Implementierungs-Code.

## Adversarial Review

### 1. `server.ts#ensureSlot` — ein übersehener aktiver Leser von `s.model`

Das Konzept nennt `contextFill`, Outcome, Views und Succession, übersieht aber den
Pane-Lebenszyklus: `server.ts#slotSpawnOccupant` nimmt `model` und `effort` in den
Occupant-Snapshot auf, `server.ts#sameSlotSpawnOccupant` verwendet beide als
Await-Identität, und `server.ts#ensureSlot` gibt `occupant.model` und
`occupant.effort` an `Harness.spawnCmd`. Derselbe Pfad führt Pane-Heal und den
Owner-Restart aus.

Kosten der ausgelassenen Kante: Eine Rückschreibung in `s.model` könnte einen
laufenden Spawn-Latch invalidieren und würde Heal/Restart unter einer vom Transcript
beeinflussbaren Modellwahl neu starten. Der Request-Pin muss deshalb unverändert
bleiben.

Die vollständige Suche nach produktiven Lesern von `s.model` ergab zusätzlich:

- `server.ts#queueStateSave` persistiert den Pin.
- `server.ts#slotSpawnOccupant` und `server.ts#sameSlotSpawnOccupant` sichern die
  Occupant-Identität über Awaits.
- `server.ts#ensureSlot` verwendet ihn für Heal und Restart als Spawn-Eingabe.
- `server.ts#contextFill` verwendet ihn für den Nenner, sofern der Reader kein eigenes
  Fenster liefert.
- `server.ts#buildLaneOutcome` schreibt ihn als angefordertes Modell ins Outcome.
- `server.ts#stewardSlotsView` und `server.ts#Bun.serve` geben ihn in
  Session-Projektionen aus.
- `server.ts#handleSelfSucceed`, `server.ts#succeedSupervisor` und
  `server.ts#succeedProgramMain` reichen ihn an den Nachfolger weiter.

### 2. `server.ts#handleSelfSucceed` — Messung und Autorität widersprechen sich

Das Konzept bezeichnet `observedModel` als Messung, lässt aber alle drei
Succession-Pfade mit `observedModel ?? s.model` spawnen. Damit entscheidet eine
agentennahe Transcript-Zeile aktiv über Kosten und Fähigkeit des Nachfolgers. Eine
Prüfung gegen `modelRe` beweist nur, dass ein Wert syntaktisch zulässig ist; sie beweist
nicht, dass der Provider dieses Modell tatsächlich verwendet hat.

Korrektur: `server.ts#handleSelfSucceed`, `server.ts#succeedSupervisor` und
`server.ts#succeedProgramMain` bleiben beim Pin. `observedModel` darf in der ersten
Ausbaustufe ausschließlich den zugehörigen Kontext-Nenner, die Live-Projektion und die
terminale Outcome-Zeile informieren. Eine Modellkorrektur braucht später einen
expliziten Owner-Akt; sie darf nicht aus einer Beobachtung folgen.

`modelDiverged` ist dabei nur bekannt, wenn sowohl die Beobachtung als auch das
effektiv angeforderte Modell bekannt sind. Ein `null`-Pin darf nur dann gegen einen
Harness-Default verglichen werden, wenn dieser Default im Code explizit bestimmt ist;
sonst bleibt das Divergenzfeld absent.

### 3. `server.ts#ensureSlot` — Heal, Restart und Boot brauchen eine Quellenidentität

`server.ts#ensureSlot` kann dieselbe Conversation fortsetzen oder mangels
Harness-spezifischer Evidenz eine frische Session erzeugen. Beim Resume ist die letzte
Beobachtung weiterhin derselben Quelle zugeordnet; beim Fresh-Fallback wäre sie sofort
stale. Der Owner-Restart benutzt denselben Pfad. Der Restore unter
`server.ts#STATE_FILE` stellt den Pin wieder her und ruft für aktive Slots erneut
`ensureSlot` auf.

Die Konzeptforderung, `observedModel` unbesehen in `fleet.json` zu persistieren, ist
darum falsch. Korrektur: Sensorwert, Messzeit und `sessionId`-Bindung bleiben
prozesslokal; Boot startet mit `null`, Resume liest dieselbe Quelle erneut, und jeder
Fresh-Fallback sowie `openSlot`/`teardownSlotOccupant` löschen die Beobachtung. Das
vermeidet einen dauerhaften Drift-Claim ohne aktuelle Quelle. Ein dedupliziertes
`model_drift`-Audit wird in dieser Stufe verworfen, weil dessen Restart-Dedupe sonst
gerade die abgelehnte Persistenz wieder einführen würde. Die Outcome-Zeile ist der
dauerhafte Träger.

### 4. `server.ts#readUsedTokens` — Reader- und Testannahmen sind zu breit

`server.ts#readUsedTokens` liest auf der neuesten passenden Claude-Zeile nur
`message.usage`. `server.ts#readPiUsedTokens` liest die Pi-Usage-Struktur;
`server.ts#readCodexContext` liest `last_token_usage` und das vom Record selbst
gelieferte `model_context_window`. Keiner der drei Reader liest heute ein Modell.
`server.ts#contextFill` cached anhand Quellenidentität, Größe und Mtime.

Die im Konzept genannte Testfamilie `e2e/ctx.ts#Ctx` enthält nur geteilte Fixtures. Die
Claude-Kontextchecks liegen in `e2e/steward-core.ts#run`, die Migrationswirkung in
`e2e/watch.ts#run`, die Pane-Lebenszyklen in `e2e/lanes-lifecycle.ts#run` und die
terminalen Felder in `e2e/outcomes.ts#run`.

Korrektur: Erst ein separater Messauftrag entscheidet jeden Adapter als `apply`,
`unsupported` oder `not-applicable`. Ein fehlendes/ungültiges Feld muss den aktuellen
Sensorwert auf `null` setzen; ein älterer gültiger Wert darf nicht stehenbleiben.
Liefert `src/protocol.ts#contextWindowFor` für ein gültig beobachtetes Modell kein
Fenster, ist die Füllung unbekannt; sie darf nicht auf den als abweichend bekannten Pin
zurückfallen.

### 5. `server.ts#Task` — `filesOrigin: "confirmed"` deckt die Task-Population nicht

`task-metadata.ts#deriveTaskMetadata` persistiert keine abgeleiteten Pfade und erkennt
aus Prosa nur bereits getrackte Pfade. In `server.ts#Bun.serve` entstehen bestätigte
`Task.files` nur beim Owner-Akt `refine-confirm`; normale Owner-Tasks und
`server.ts#createTaskForMain` haben keine gleichwertige Deklarationstür. Ein neues
`docs/messungen/...`-Artefakt ist vor seiner Erstellung außerdem gerade noch nicht
getrackt.

Kosten: Der vorgeschlagene implizite Vertrag bliebe für den Normalfall abwesend und
würde das Ergebnisproblem als scheinbar implementiert verdecken. Teil D braucht eine
eigene Owner-Deklaration mit normalisierten, repo-relativen Pfaden unter
`docs/messungen/`; `Task.files` bleibt Kollisions-/Planungsmetadatum.

### 6. `server.ts#buildLaneOutcome` — der Builder ist kein Commit-Punkt

`server.ts#buildLaneOutcome` berechnet eine Zeile, `server.ts#landLane` kann danach aber
noch beim Entfernen des Worktrees scheitern. Erst anschließend ruft der Land-Pfad
`server.ts#emitLaneOutcome` auf. Kill und Shelve emittieren vor
`server.ts#teardownSlotOccupant`.

Kosten: Ein Zustands-Flip im Builder könnte `harvested` buchen, obwohl Land und Outcome
nie terminal wurden. Korrektur: Der Builder liefert Ergebnis plus vollständige interne
Pfadmenge ohne Task-Mutation; ein gemeinsamer Finalizer appendet die Outcome-Zeile,
aktualisiert Task/Audit und speichert erst am jeweiligen bestehenden Commit-Punkt.

Zusätzlich kappt `server.ts#buildLaneOutcome` das gespeicherte `filesTouched` auf 200
Einträge. Der Pfadschnitt muss vor diesem Darstellungs-Cap auf der vollständigen Menge
laufen, sonst kann ein tatsächlich geliefertes Soll-Artefakt als verschwunden gelten.

### 7. `server.ts#detachSlotTasks` — Redispatch kollidiert mit dauerhaftem Harvest-Zustand

`server.ts#detachSlotTasks` setzt eine noch `sent`-Task beim Teardown auf `pending`, lässt
sonstige Felder aber stehen. Der Restore unter `server.ts#STATE_FILE` kann verwaiste
`sent`-Tasks ebenfalls wieder zur Queue geben. Ohne zusätzliche Regel würde ein
`pending`, `harvested` oder `discarded` des vorherigen Versuchs in den nächsten Versuch
lecken.

Korrektur: Das terminale Ergebnis des letzten Versuchs bleibt nach Detach sichtbar;
erst ein **erfolgreicher** neuer `server.ts#dispatchTask` überschreibt es mit neuem
`pending`, neuem `since` und dem eingefrorenen Vertrag. Ein fehlgeschlagener Spawn darf
den alten Zustand nicht verändern. Ein beim Boot als verwaist erkanntes `sent` mit
offenem Vertrag bleibt `pending`, erhält einmalig die Vanished-Notiz samt Audit und wird
danach requeuebar; die Notiz dedupliziert weitere Boots.

### 8. `server.ts#Bun.serve` — die erwartete Self-Antwort ist falsch

Owner-Routen liegen hinter dem allgemeinen Credential-Gate. Ein Self-Credential erreicht
sie daher nicht als semantische 409-Antwort, sondern wird als nicht autorisiert
abgewiesen. Eine künstliche Self-Route nur für den Statuscode würde die Oberfläche
vergrößern, ohne Autorität zu verbessern.

Korrektur: `e2e/security.ts#run` prüft die neue Owner-Route in der bestehenden
gefährlichen Routenmatrix; Nicht-Owner werden mit dem vorhandenen Auth-Status abgewiesen.
Nur ungültige Zustandsübergänge hinter erfolgreicher Owner-Authentisierung liefern 409.

### 9. `lane-signals.ts#laneStalled` — die Signatur ist real, die Baseline belegt nicht die Ursache

`lane-signals.ts#laneDoneLooking` verlangt einen sauberen Baum und `ahead > 0`.
`lane-signals.ts#laneStalled` verlangt `ahead === 0`, Leerlauf, keine Git-Operation,
keinen Merge-Blocker und kein Awaiting; ein nur im Pane stehendes Ergebnis kann daher
wie Stillstand aussehen. `.claude/skills/mess-notiz/SKILL.md#mess-notiz` belegt aber nur
die 123 `killed-empty`-Ausgänge, nicht deren fachlichen Inhalt.

Kosten: Ohne expliziten Vertrag würde `measurement_vanished` aus einer heterogenen
Population erzeugt und als präziser gelesen, als die Messung ist. Mit Vertrag ist das
Event selten und definiert; sein heutiges Volumen bleibt bis zur Einführung unbekannt.

## Korrekturen am Konzept

| Konzeptpunkt | Entscheidung | Wirkung |
|---|---|---|
| `observedModel ?? pin` für Succession | verwerfen | Pin bleibt einzige Spawn-Autorität |
| `observedModel` in `fleet.json` | verwerfen | Boot re-observiert; Fresh-Fallback kann nichts Stales tragen |
| `model_drift` je Occupant | für erste Stufe verwerfen | kein Persistenz-/Dedupe-Zwang; Outcome bleibt dauerhaft |
| Pi/Codex dauerhaft `null` | durch Adapterentscheidung ersetzen | `unsupported` bis eine Messung `apply` belegt |
| Testfamilie `e2e/ctx.ts#Ctx` | korrigieren | Checks gehen zu ihren bestehenden Familien, nie in den Runner |
| Harvest aus confirmed `Task.files` | verwerfen | eigener Owner-Ergebnisvertrag deckt auch neue Pfade ab |
| Flip in `buildLaneOutcome` | verwerfen | Mutation erst am Outcome-Commit-Punkt |
| Schnitt gegen gekapptes `filesTouched` | verwerfen | vollständige Pfadmenge entscheidet, 200er Cap bleibt Anzeige |
| Vanished nur bei Kill/Shelve | erweitern | auch fehlendes Soll-Artefakt bei Land und Boot-Orphan wird gebucht |
| Self-Credential erwartet 409 | korrigieren | vorhandene Auth-Grenze bleibt; 409 nur für Owner-Zustandskonflikt |
| Effort als Sensor-Fakt | verwerfen | bleibt benannter Request-Pin und offene Sensorlücke |

## Umsetzungsschnitt

Die Reihenfolge ist verbindlich: Auftrag 2 hängt vom Adapterurteil aus Auftrag 1 ab;
Auftrag 3 ist fachlich unabhängig, teilt aber `server.ts#Task` und läuft deshalb danach.

### Auftrag 1 — Modellquelle je Adapter messen

**Wert/Risiko:** höchste Informationsrendite, kein Produktcode-Risiko. Er verhindert,
dass Auftrag 2 auf einem privaten Einzelbefund oder einem geratenen Fremdformat aufbaut.

1. **Dateien und Symbole:** Nur lesen:
   `server.ts#Harness.context`, `server.ts#readUsedTokens`,
   `server.ts#readPiUsedTokens`, `server.ts#readCodexContext` und
   `server.ts#contextFill`. Schreiben:
   `docs/messungen/2026-08-30-transcript-modellfelder.md#Ergebnis` und
   `docs/messungen/INDEX.md#Index-der-Messnotizen`.
2. **Schema-/Ledger-Delta:** `Keins; eine öffentliche, getrackte Messnotiz plus eine Indexzeile.`
3. **Done-Kriterium:** Done ist, wenn die Messnotiz für Claude, Pi, Pi-ZAI, Pi-Ox und
   Codex jeweils `apply`, `unsupported` oder `not-applicable` aus einem aktuellen Record
   belegt, ohne Inhalt oder lokale Identifikatoren zu veröffentlichen.
4. **Verify-Weg:** keine Produkt-E2E-Familie; docs-only-Proof aus
   `GET /api/self/gate`, mindestens `install` und `pins`, plus Front-Matter-/Index-Check
   aus `.claude/skills/mess-notiz/SKILL.md#Vor-dem-Fertigmelden`.
5. **Nicht-Ziele:** keine Parser-, Slot-, Spawn-, UI-, Outcome- oder Effort-Änderung;
   keine Transcript-Zeile und kein lokaler Pfad im Commit.

Wortfertiger Task-Text:

```text
MESS-LANE, KEIN PRODUKT-CODE — Belege die laufende Modellquelle je Harness.

KONTEXT: Die geplante observedModel-Buchhaltung darf nicht auf der unbestätigten Annahme aufbauen, dass der jeweils neueste Kontext-Record ein Modellfeld trägt. Der aktuelle Code liest nur Usage/Window. Lies vor jeder Behauptung die genannten Reader vollständig.

WRITE SET: docs/messungen/2026-08-30-transcript-modellfelder.md#Ergebnis und genau eine passende Zeile in docs/messungen/INDEX.md#Index-der-Messnotizen. Alle anderen Dateien sind read-only.

PRÜFUNG: Untersuche die durch server.ts#Harness.context bestimmten Quellen für Claude, Pi, Pi-ZAI, Pi-Ox und Codex. Orientiere dich an server.ts#readUsedTokens, server.ts#readPiUsedTokens, server.ts#readCodexContext und server.ts#contextFill. Für jeden Adapter lautet das Urteil genau apply, unsupported oder not-applicable. Belege nur Record-Typ, Feldpfad, Typ, Zahl geprüfter aktueller Records und ob der neueste zur Kontextmessung verwendete Record dasselbe Modellfeld trägt. Veröffentliche keine Record-Inhalte, lokalen Pfade, Session-IDs, Hostdaten oder Credentials. Effort bleibt NICHT GEPRÜFT, sofern dieselbe Quelle ihn nicht eindeutig und aktuell trägt; nicht raten.

SCHEMA-/LEDGER-DELTA: Keins; eine öffentliche, getrackte Messnotiz plus eine Indexzeile.

DONE: Done ist, wenn die Messnotiz für alle fünf Adapter jeweils apply, unsupported oder not-applicable aus einem aktuellen Record belegt, ohne Inhalt oder lokale Identifikatoren zu veröffentlichen.

VERIFY: Frage zuerst GET /api/self/gate ab und führe localProof in der genannten Reihenfolge aus; für docs-only müssen mindestens install und pins grün sein. Prüfe zusätzlich alle sechs Front-Matter-Felder und genau eine neue Indexzeile nach .claude/skills/mess-notiz/SKILL.md#Vor-dem-Fertigmelden. Committe nur die zwei genannten Docs-Dateien.

NICHT-ZIELE: keine Parser-, Slot-, Spawn-, UI-, Outcome- oder Effort-Änderung; keine Rohdaten im Repo. Wenn eine Quelle nicht eindeutig ist, lautet das Urteil unsupported, nicht eine weichere Vermutung.
```

### Auftrag 2 — `observedModel` als nicht persistierten Sensor buchen

**Wert/Risiko:** hoher Wert, mittleres Risiko. Repariert den falschen
Kontext-Nenner und die terminale Modell-Aussage, ohne Spawn-Autorität oder
Restart-Dauerzustand zu verändern. Start erst nach `apply` für mindestens einen
Adapter aus Auftrag 1.

1. **Dateien und Symbole:** `server.ts#Slot`, `server.ts#Harness.context`, die in
   Auftrag 1 mit `apply` bewerteten Reader, `server.ts#contextFill`,
   `server.ts#queueStateSave`, `server.ts#openSlot`, `server.ts#ensureSlot`,
   `server.ts#teardownSlotOccupant`, `server.ts#stewardSlotsView`,
   `server.ts#LaneOutcome`, `server.ts#buildLaneOutcome`,
   `server.ts#slotSpawnOccupant`, `server.ts#sameSlotSpawnOccupant`,
   `server.ts#handleSelfSucceed`, `server.ts#succeedSupervisor`,
   `server.ts#succeedProgramMain`; Tests in `e2e/steward-core.ts#run`,
   `e2e/watch.ts#run`, `e2e/lanes-lifecycle.ts#run` und
   `e2e/outcomes.ts#run`.
2. **Schema-/Ledger-Delta:**

   ```text
   Slot: + observedModel:null|string; + observedModelAt:null|number; + observedModelSessionId:null|string
   fleet.json: unverändert; queueStateSave lässt alle drei Sensorfelder aus
   Kontext-Reader: + observedModel auf demselben neuesten, gecachten Record
   Session-Projektion: + observedModel/observedModelAt, bei unknown absent
   LaneOutcome: + observedModel?:string; + modelDiverged?:true nur bei zwei bekannten Modellen
   Audit/FleetEvent: unverändert
   ```

3. **Done-Kriterium:** Done ist, wenn ein validierter aktueller Modellwert den
   Kontext-Nenner und das terminale Outcome bestimmt, während Pin, alle Heal-/Restart-
   und Succession-Spawns sowie der Null-Fallback nachweislich unverändert bleiben.
4. **Verify-Weg:** Sensor-/Nennerchecks in `e2e/steward-core.ts#run`,
   Migrationsgrenze in `e2e/watch.ts#run`, Resume/Fresh/Boot in
   `e2e/lanes-lifecycle.ts#run`, Outcome-Felder in `e2e/outcomes.ts#run`; danach der
   vollständige Gate-Proof. Weil `buildLaneOutcome` am Land-Pfad liegt, zusätzlich
   `./e2e-isolated.sh`.
5. **Nicht-Ziele:** keine Änderung von `s.model`, `s.effort`, Spawn-Kommandos,
   `SlotSpawnOccupant`, Succession-Auswahl, Owner-Routen oder Client-Chips; kein
   `model_drift`-Audit; keine Adapterimplementierung ohne `apply`-Beleg.

Wortfertiger Task-Text:

```text
IMPLEMENTIERUNGS-LANE — observedModel als Sensor, niemals als Spawn-Autorität.

VORAUSSETZUNG: Lies docs/messungen/2026-08-30-transcript-modellfelder.md#Ergebnis. Implementiere nur Adapter mit Urteil apply. unsupported und not-applicable bleiben ehrlich absent. Wenn kein Adapter apply trägt, ändere keinen Code und melde den Auftrag als durch die Messung blockiert.

WRITE SET: server.ts#Slot, server.ts#Harness.context, nur die mit apply belegten Kontext-Reader, server.ts#contextFill, server.ts#queueStateSave, server.ts#openSlot, server.ts#ensureSlot, server.ts#teardownSlotOccupant, server.ts#stewardSlotsView, server.ts#LaneOutcome, server.ts#buildLaneOutcome; Tests ausschließlich in e2e/steward-core.ts#run, e2e/watch.ts#run, e2e/lanes-lifecycle.ts#run und e2e/outcomes.ts#run. Lies server.ts#slotSpawnOccupant, server.ts#sameSlotSpawnOccupant, server.ts#handleSelfSucceed, server.ts#succeedSupervisor und server.ts#succeedProgramMain als unveränderte Regressionsgrenze.

MECHANIK: Ergänze pro Slot observedModel, observedModelAt und observedModelSessionId als prozesslokale Sensorfelder. Der jeweilige Reader entnimmt Modell und Kontextwert demselben neuesten parsebaren Record und derselben Cache-Identität; ungültig, fehlend oder nicht zum aktuellen sessionId gehörend setzt observedModel auf null. queueStateSave persistiert die Sensorfelder nicht. Boot beginnt mit null. openSlot, teardownSlotOccupant und ein Fresh-Fallback in ensureSlot löschen sie; ein Resume darf sie nur für dieselbe sessionId behalten und re-observiert die Quelle. contextFill verwendet einen validierten observedModel-Wert für Reader, deren Fenster über contextWindowFor bestimmt wird; liefert contextWindowFor dafür null, ist die Füllung unbekannt und fällt nicht auf den abweichenden Pin zurück. Reader mit eigenem Window bleiben unverändert. stewardSlotsView gibt bekannte Beobachtung und Zeit aus. buildLaneOutcome schreibt observedModel optional und modelDiverged nur, wenn Beobachtung und effektives Request-Modell bekannt sind.

SCHEMA-/LEDGER-DELTA:
Slot: + observedModel:null|string; + observedModelAt:null|number; + observedModelSessionId:null|string
fleet.json: unverändert; queueStateSave lässt alle drei Sensorfelder aus
Kontext-Reader: + observedModel auf demselben neuesten, gecachten Record
Session-Projektion: + observedModel/observedModelAt, bei unknown absent
LaneOutcome: + observedModel?:string; + modelDiverged?:true nur bei zwei bekannten Modellen
Audit/FleetEvent: unverändert

DONE: Done ist, wenn ein validierter aktueller Modellwert den Kontext-Nenner und das terminale Outcome bestimmt, während Pin, alle Heal-/Restart- und Succession-Spawns sowie der Null-Fallback nachweislich unverändert bleiben.

VERIFY: Schreibe SPEC-Checks in e2e/steward-core.ts#run für gültig, fehlend, malformed, neuesten Record, bekannten Nenner und unbekanntes beobachtetes Fenster ohne Pin-Fallback; in e2e/watch.ts#run für die Migrationsgrenze; in e2e/lanes-lifecycle.ts#run für Resume, Fresh-Fallback und Boot; in e2e/outcomes.ts#run für optionale Outcome-Felder. Mindestens ein Check muss mit einem syntaktisch gültigen, aber nicht beobachteten Modell scheitern können. Frage zuerst GET /api/self/gate ab, führe localProof in Reihenfolge aus und danach ./e2e-isolated.sh, weil buildLaneOutcome den Land-Pfad berührt.

NICHT-ZIELE: s.model, s.effort, Spawn-Kommandos, SlotSpawnOccupant, Succession-Auswahl, Owner-Routen und Client-Chips bleiben unverändert. Kein model_drift-Audit. Keine Unterstützung ohne apply-Beleg.
```

### Auftrag 3 — expliziten Ergebnisvertrag terminal buchen

**Wert/Risiko:** hoher potenzieller Wert, höchstes Risiko des Schnitts. Der Auftrag
ersetzt die nicht tragfähige `Task.files`-Heuristik durch eine kleine Owner-Tür und
schließt Dispatch, Land, Kill, Shelve, Detach und Boot in einem Zustandsautomaten. Er
soll nicht in zwei halbfertige, einzeln irreführende Lanes zerlegt werden.

1. **Dateien und Symbole:** `server.ts#Task`, `server.ts#TaskDigest`,
   `server.ts#taskDigest`, `server.ts#Bun.serve`, `server.ts#dispatchTask`,
   `server.ts#detachSlotTasks`, `server.ts#STATE_FILE`, `server.ts#LaneOutcome`,
   `server.ts#buildLaneOutcome`, `server.ts#emitLaneOutcome`,
   `server.ts#landLane`, `server.ts#AuditEvent`, `server.ts#audit`;
   `src/client.ts#TaskInfo`, `src/client.ts#renderQueueDetail`,
   `src/client.ts#renderQueue`; Tests in `e2e/tasks.ts#run`,
   `e2e/outcomes.ts#run` und `e2e/security.ts#run`.
2. **Schema-/Ledger-Delta:**

   ```text
   Task: + resultContract?:{declared:string[];setAt:number}
   Task: + resultHarvest?:{state:"pending"|"harvested"|"discarded";since:number;declared:string[];note?:string}
   TaskDigest/TaskInfo: + bounded resultContract/resultHarvest projection
   LaneOutcome: + resultHarvest?:"pending"|"harvested"|"discarded"
   audit: + result_contract_set|result_contract_clear|result_discarded|measurement_vanished
   Owner-Routen: + /result-contract und /harvest-discard
   FleetEvent/Gates: unverändert
   ```

3. **Done-Kriterium:** Done ist, wenn nur ein owner-deklarierter Messpfad pro
   erfolgreichem Dispatch `pending` erzeugt und jeder terminale Pfad genau einmal
   `harvested`, `discarded` oder `measurement_vanished` bucht, ohne Zustand aus einem
   früheren Versuch oder fehlgeschlagenen Land/Spawn zu übernehmen.
4. **Verify-Weg:** Vertrags-, Persistenz-, Redispatch- und Boot-Checks in
   `e2e/tasks.ts#run`; Land/Kill/Shelve, vollständiger Pfadschnitt und fehlgeschlagener
   Commit-Punkt in `e2e/outcomes.ts#run`; Auth-Grenze beider Owner-Routen in
   `e2e/security.ts#run`; danach vollständiger Gate-Proof und `./e2e-isolated.sh` wegen
   Merge-/Land-Pfad.
5. **Nicht-Ziele:** keine Ableitung aus `Task.files`, Brieftext, Fleet-Report oder
   Pane-Inhalt; keine Agenten-/Program-MAIN-Tür; kein FleetEvent, Gate, Auto-Kill oder
   neuer Tick; keine allgemeinen Artefaktklassen außerhalb `docs/messungen/`.

Wortfertiger Task-Text:

```text
IMPLEMENTIERUNGS-LANE — expliziten Mess-Ergebnisvertrag pro Dispatch terminal buchen.

KONTEXT: Task.files ist kein Ergebnisvertrag: confirmed entsteht nur über refine-confirm, derived erkennt nur bereits getrackte Pfade. Baue daher NICHT die Heuristik aus dem Konzept. Der Vertrag ist ein eigener Owner-Akt und gilt nur für normalisierte repo-relative Pfade unter docs/messungen/.

WRITE SET: server.ts#Task, server.ts#TaskDigest, server.ts#taskDigest, server.ts#Bun.serve, server.ts#dispatchTask, server.ts#detachSlotTasks, der Task-Restore unter server.ts#STATE_FILE, server.ts#LaneOutcome, server.ts#buildLaneOutcome, server.ts#emitLaneOutcome, server.ts#landLane, server.ts#AuditEvent und server.ts#audit; src/client.ts#TaskInfo, src/client.ts#renderQueueDetail und src/client.ts#renderQueue; Tests ausschließlich in e2e/tasks.ts#run, e2e/outcomes.ts#run und e2e/security.ts#run.

MECHANIK: Ergänze eine owner-only Route /api/tasks/:id/result-contract, die bei pending oder queued eine nichtleere, normalisierte, begrenzte Liste repo-relativer docs/messungen/-Pfade setzt oder explizit löscht und den Akt auditiert. Zeige Vertrag und letzten Zustand als Text im Task-Detail, nicht als Chip. Erst nach erfolgreichem openSlot setzt dispatchTask resultHarvest auf pending und friert declared/since ein; ein Spawnfehler lässt den alten Zustand unverändert. /api/tasks/:id/harvest-discard darf nur ein authentisierter Owner auf einem pending Ergebnis mit begrenzter Notiz ausführen; Nicht-Owner bleiben an der bestehenden Auth-Grenze, Zustandskonflikte liefern 409.

TERMINAL: buildLaneOutcome mutiert keine Task. Es liefert intern zusätzlich die vollständige git-diff-Pfadmenge; nur filesTouched in der Ledger-Zeile bleibt auf 200 begrenzt. Ein gemeinsamer Finalizer läuft an den bestehenden Outcome-Commit-Punkten: beim Land erst nach erfolgreicher Worktree-Entfernung, bei Kill/Shelve vor teardown. Schnitt declared die vollständige Pfadmenge, buche harvested; sonst lasse pending stehen und schreibe genau ein measurement_vanished-Audit. Das gilt auch für einen Land ohne Soll-Artefakt. detachSlotTasks bewahrt das Ergebnis des letzten Versuchs; der nächste erfolgreiche Dispatch ersetzt es. Erkennt der Boot-Restore eine verwaiste sent-Task mit pending Vertrag, markiert er sie einmal per Notiz/Audit als vanished und requeued sie; die Notiz dedupliziert weitere Boots. Persistierte Fremdformen degradieren zu absent, nie zu pass. LaneOutcome trägt resultHarvest nur für deklarierte Lanes.

SCHEMA-/LEDGER-DELTA:
Task: + resultContract?:{declared:string[];setAt:number}
Task: + resultHarvest?:{state:"pending"|"harvested"|"discarded";since:number;declared:string[];note?:string}
TaskDigest/TaskInfo: + bounded resultContract/resultHarvest projection
LaneOutcome: + resultHarvest?:"pending"|"harvested"|"discarded"
audit: + result_contract_set|result_contract_clear|result_discarded|measurement_vanished
Owner-Routen: + /result-contract und /harvest-discard
FleetEvent/Gates: unverändert

DONE: Done ist, wenn nur ein owner-deklarierter Messpfad pro erfolgreichem Dispatch pending erzeugt und jeder terminale Pfad genau einmal harvested, discarded oder measurement_vanished bucht, ohne Zustand aus einem früheren Versuch oder fehlgeschlagenen Land/Spawn zu übernehmen.

VERIFY: In e2e/tasks.ts#run prüfe Set/Clear, Pfadvalidierung, Load-Normalisierung, Digest/Full-View, erfolgreiche und fehlgeschlagene Dispatches, Detach, Redispatch und Boot-Orphan. In e2e/outcomes.ts#run prüfe Land/Kill/Shelve mit und ohne Soll-Artefakt, Absenz bei Tasks ohne Vertrag, den Schnitt vor dem 200er Cap, genau ein Audit und keine Mutation bei fehlgeschlagenem Land-Commit-Punkt. In e2e/security.ts#run nimm beide Owner-Routen in die gefährliche Routenmatrix auf und prüfe Owner-Erfolg sowie Nicht-Owner-Ablehnung mit der bestehenden Auth-Semantik. Jeder Teil enthält mindestens einen Reject-Check. Frage zuerst GET /api/self/gate ab, führe localProof in Reihenfolge aus und danach ./e2e-isolated.sh.

NICHT-ZIELE: keine Ableitung aus Task.files, Brieftext, Fleet-Report oder Pane-Inhalt; keine Agenten-/Program-MAIN-Tür; kein FleetEvent, Gate, Auto-Kill oder neuer Tick; keine Artefaktklasse außerhalb docs/messungen/.
```

## Verworfen statt verwässert

- **Succession aus Beobachtung:** verworfen, weil eine agentennahe Messung damit zur
  Modellwahl des Nachfolgers würde.
- **Persistenter Live-Sensor und `model_drift`-Audit:** in der ersten Stufe verworfen,
  weil Boot/Fresh-Identität und Audit-Dedupe sonst aus einem kurzlebigen Sensor einen
  dauerhaften Claim machen.
- **Effort-Beobachtung:** verworfen, solange keine aktuelle Quelle gemessen ist.
- **Harvest aus `Task.files`:** verworfen, weil die Fläche die normale Population und
  neue Ergebnisdateien nicht abdeckt.
- **Fleet-Report als Ernte:** verworfen, weil `server.ts#pruneFleetReports` den Bericht
  begrenzt und `server.ts#openFleetReport` eine Nachricht, keinen Artefaktvertrag,
  schreibt.
- **Inbox-/FleetEvent für `measurement_vanished`:** verworfen, bis das Audit reale
  Ereigniszahl und Signalqualität messbar macht.

## Offene Grenze

Auftrag 2 ist ohne ein `apply` aus Auftrag 1 nicht baubar. Auftrag 3 ist baubar, aber
sein heutiges Ereignisvolumen ist unbekannt; diese Unkenntnis rechtfertigt den engen
`docs/messungen/`-Vertrag und audit-only, nicht eine breitere Heuristik.

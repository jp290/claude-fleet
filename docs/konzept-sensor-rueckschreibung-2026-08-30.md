# Konzept: Sensor-Rückschreibung statt Chips (2026-08-30)

Entscheidungsdokument für den Owner. Zwei Prüf-Befunde (A: Slot-Snapshot lügt über
model/effort · D: Mess-Ergebnis stirbt mit dem Pane) waren als UI-Chips eingeplant; der
Prüfer stuft sie als Buchhaltungs-Löcher derselben Klasse ein wie die beauftragte
Main-Commit-Spur (Task `4f452a0f`: git-Tick bucht main-Bewegung ohne fleet/land-Note als
Event + Outcome-Zeile — beauftragt, nicht im Baum; als Kontext übernommen, nicht selbst
verifiziert). Dieses Doc arbeitet A und D als Buchhaltungs-Features aus. Alle
Ist-Behauptungen sind an diesem Baum selbst nachgelesen; Referenzen als `datei#symbol`.

---

## Teil A — model/effort: der Slot-Datensatz trägt den Spawn-Snapshot, die Pane kann längst anders laufen

### A.1 Ist-Zustand (Belege)

- `server.ts#Slot` definiert `model` („per-slot claude model (--model at spawn)") und
  `effort` („per-slot reasoning level … Validated against the HARNESS's own closed set")
  als Spawn-Zeit-Felder; die Feld-Kommentare nennen die Lebensregel explizit: gewählt am
  Spawn, geleert bei open/kill.
- Es gibt genau drei Schreibstellen, keine davon ein Sensor:
  1. `server.ts#openSlot` — `s.model = model; // slotCmd bakes it at spawn`, daneben
     `s.effort = effort`.
  2. `server.ts#teardownSlotOccupant` — setzt `s.model`/`s.harness`/`s.effort` auf `null`
     (aufgerufen über `server.ts#killSlot`).
  3. Der Boot-Restore-Block (Modul-Toplevel unter `if (existsSync(STATE_FILE))`,
     `server.ts#STATE_FILE`) — restauriert beide Felder aus `fleet.json`, validiert gegen
     `modelRe`/`effortLevels` des Harness. **Kein `loadState`-Symbol: der Block liegt in
     keiner Funktion.**
  Keine Route erlaubt auch nur dem Owner, `model`/`effort` einer laufenden Session zu
  korrigieren; der einzige Korrekturpfad ist kill + reopen.
- Wechselt die Pane ihr Modell selbst (TUI-eigenes `/model`, ein Effort-Umschalter im
  Agenten), sieht Fleet davon nichts: Der `/send`-Arm im `Bun.serve`-`fetch`-Router
  (`server.ts#Bun.serve`, Pfad `"/send"`) transportiert nur Owner-TEXT in die Pane; ein
  pane-interner Wechsel läuft an jeder Fleet-Tür vorbei.
- Der Snapshot wird als Gegenwart ausgegeben:
  - `server.ts#stewardSlotsView` liefert im 2-s-Poll `model: s.model` und
    (omitted-when-null) `effort` — das Board liest das als „läuft mit".
  - `server.ts#contextFill` rechnet den NENNER der Kontext-Füllung aus dem Slot-Pin:
    `contextWindowFor(s.model ?? <Harness-Default>)`;
    `src/protocol.ts#contextWindowFor` nennt sich selbst „the DENOMINATOR of the
    context-fill sensor". `server.ts#tickMigrate` feuert seine Handoff-Nudges auf
    `fill.pct >= MIGRATE_PCT` — mit veraltetem Pin ist der Prozentwert gegen das falsche
    Fenster gerechnet (150 k Tokens sind 15 % von 1M und 75 % von 200 k).
  - `server.ts#buildLaneOutcome` stempelt `model: s.model ?? null`,
    `effort: s.effort ?? null` auf jede Outcome-Zeile; `server.ts#LaneOutcome`
    kommentiert „recorded honestly, NEVER guessed" — ehrlich ist das über den REQUEST,
    blind für Laufzeit-Drift.
  - Alle drei Succession-Pfade kopieren den Snapshot in die Spawn-Zeile des Nachfolgers:
    `server.ts#handleSelfSucceed`, `server.ts#succeedSupervisor`,
    `server.ts#succeedProgramMain` rufen jeweils
    `openSlot(free, …, s.model, label, s.harness, s.effort, …)`.
- Lesbare Sensor-Quelle existiert für das MODELL bereits halb: `server.ts#readUsedTokens`
  tail-liest das claude-Transcript nach `message.usage`; dieselben Assistant-Zeilen tragen
  ein `message.model`-Feld (an einem realen claude-Transcript dieser Maschine verifiziert).
  Für Pi (`server.ts#readPiUsedTokens`) und Codex (`server.ts#readCodexContext`) ist die
  Modell-Lesbarkeit der Session-Dateien NICHT geprüft — offene Messung, kein Raten.
- Sensor-Lücke EFFORT: Der Footer einer laufenden Pane zeigt den Effort nie — vorgegebene
  Messung aus dem Owner-Brief (2026-08-30), hier nicht selbst nachverifiziert. Der Client
  kennt Effort nur im Spawn-Formular (`src/client.ts#spawnBody`); es gibt keinerlei
  Laufzeit-Anzeige und damit keine Capture-Quelle. Effort bleibt auf absehbare Zeit ein
  reines Request-Fakt.
- Randbedingung: `server.ts#SlotSpawnOccupant` / `sameSlotSpawnOccupant` prüfen die
  Occupant-Identität über awaits hinweg INKLUSIVE `model`/`effort` — jede neue
  Schreibstelle an diesen Feldern kann laufende Spawn-/Teardown-Latches auslösen.

### A.2 Soll-Mechanik

Zwei erstklassige Fakten statt eines lügenden:

- **Pin bleibt Pin.** `s.model`/`s.effort` behalten ihre Request-Semantik (was am Spawn
  verlangt wurde) — genau die Semantik, die `LaneOutcome` heute schon dokumentiert.
- **Neuer Sensor-Fakt `observedModel`** (+ `observedModelAt`), geschrieben AUSSCHLIESSLICH
  vom Server-Tick aus dem Transcript-Tail, den `contextFill` ohnehin liest (gleiche
  Cache-Disziplin wie `ctxCache`: ein `stat` pro Poll, Parse nur bei Dateibewegung).
  Wert nur übernommen, wenn er `modelRe` des Harness besteht; sonst bleibt `null` stehen
  — unbekannt wird nie zu einer Antwort. Harnesses ohne lesbare Quelle (Pi/Codex bis zur
  Messung) bleiben dauerhaft ehrlich `null`.
- **Divergenz ist ein abgeleitetes Fakt** (`observedModel !== null && observedModel !== effektiver Pin`),
  nirgends gespeichert, überall berechenbar.
- **Succession kopiert keinen als falsch gewussten Snapshot mehr:** die drei
  Succession-Sites spawnen mit `observedModel ?? s.model`. Bei `observedModel === null`
  bleibt das Verhalten byte-identisch zu heute (Regressionspin). `effort` wird weiter
  kopiert — das ist ein Re-REQUEST an eine neue Session, keine Behauptung über eine
  laufende, also keine Lüge.
- **`contextFill` bevorzugt `observedModel`** als Nenner-Quelle — das repariert die
  tickMigrate-Fehlkalibrierung, die der teuerste Ist-Schaden ist.
- Volle Rückschreibung (`s.model ← observed`, die engere Lesart des Prüfers) wird als
  Variante ausgewiesen, aber NICHT empfohlen: sie kollabiert Request und Beobachtung in
  ein Feld — exakt die Vermischung, die der `LaneOutcome`-Kommentar verbietet — und macht
  eine agentennahe Quelle (das Transcript liegt im Projektverzeichnis des Agenten) zur
  alleinigen Autorität über die Spawn-Zeile.

### A.3 Schema-/Ledger-Delta (≤ 10 Zeilen)

```
Slot:            + observedModel: string | null      // Sensor-Fakt, nie Request
                 + observedModelAt: number | null    // ms-Zeitstempel der Lesung
fleet.json:      beide Felder persistiert; Boot-Restore validiert gegen modelRe,
                 sonst null (gleiche Regel wie model heute)
stewardSlotsView:+ observedModel (omitted-when-null, wie harness/effort)
LaneOutcome:     + observedModel?: string            // nur wenn je beobachtet
                 + modelDiverged?: true              // nur wenn am Terminal-Ereignis Pin ≠ observed
SlotSpawnOccupant: UNVERÄNDERT — observed* gehört NICHT zur Occupant-Identität
```

### A.4 Entstehende Events/Ledger-Zeilen

- Je Lane-Terminal-Ereignis: die bestehende `lane-outcomes.jsonl`-Zeile trägt zusätzlich
  `observedModel`/`modelDiverged` (via `server.ts#buildLaneOutcome`; Absenz bleibt „Row
  kann es nicht sagen", wie bei `releasedBy`).
- Eine `audit`-Zeile `model_drift` beim ERSTEN Flip auf Divergenz je Occupant
  (bestehende `audit()`-Mechanik, kein neuer Event-Typ, kein Inbox-Eintrag) — dedupe über
  `openedAt`, damit ein Dauerzustand nicht tickweise bucht.
- Keine FleetEvents, keine Pane-Zustellung: record → display, nichts weiter oben in der
  Doktrin-Leiter.

### A.5 Testplan (ohne Modell grün/rot)

Familie `e2e/ctx.ts` (Kontext-Sensor-Fixtures existieren dort) plus `e2e/outcomes.ts`:

1. Fixture-Transcript, neueste Assistant-Zeile `message.model = M2`, Slot-Pin `M1` →
   `observedModel === "M2"`, Poll-View trägt das Feld, `modelDiverged` in der
   Outcome-Zeile nach Kill.
2. Tail ohne model-Feld → `observedModel === null`, Pin unverändert (nie geraten).
3. Zeile mit `model` außerhalb `modelRe` (gefälschter Wert) → bleibt `null`.
4. `contextFill`-Nenner: Pin 200k-Modell, observed 1M-Modell → `pct` gegen 1M gerechnet;
   ohne observed byte-identisch zu heute.
5. Succession (`e2e/slots.ts`/`e2e/lanes-lifecycle.ts`): mit Divergenz trägt die
   Spawn-Kommandozeile des Nachfolgers M2; ohne observed byte-identisch zu heute
   (Regressionspin gegen alle drei Sites).
6. Latch-Gegenprobe: observed-Schreiben während eines laufenden Teardowns löst
   `sameSlotSpawnOccupant` NICHT aus.

### A.6 Risiken

- **Quelle ist agentennah:** das Transcript liegt außerhalb des Repos, aber im
  Schreibbereich des Agenten-Prozesses. `observedModel` ist darum MESSUNG, nie Autorität:
  es gated nichts, validiert gegen `modelRe`, und sein einziger aktiver Konsument
  (Succession-Spawn) kann schlimmstenfalls ein anderes GÜLTIGES Modell wählen.
- Succession-Änderung berührt drei Sites mit eigenen Latch-/Identity-Rails
  (Program-MAIN-Founding, Supervisor-Bootstrap) — der byte-identisch-ohne-observed-Pin
  ist die Rückversicherung.
- Nenner-Wechsel in `contextFill` verschiebt tickMigrate-Timing — gewollt (das IST die
  Reparatur), aber `[1m]`-Bracket-Modelle müssen durch `contextWindowFor` unverändert
  aufgelöst werden.
- Effort bleibt strukturell unbeobachtbar; jede Anzeige, die `effort` als Gegenwart
  rendert, bleibt eine Halbwahrheit (siehe offene Frage 4).

### A.7 Offene Fragen an den Owner

1. Divergenz-Markierung (Empfehlung) oder volle Rückschreibung `s.model ← observed`?
2. Succession bei `observedModel === null`, aber vorhandenem Pin: Snapshot kopieren
   (Empfehlung, Status quo) oder Default + Notiz?
3. Darf `observedModel` den `contextFill`-Nenner ersetzen (Empfehlung: ja — sonst bleibt
   tickMigrate falsch kalibriert)?
4. Board-Darstellung von `effort`: als „seit Spawn" gelabelt lassen, oder ausblenden,
   solange kein Sensor existiert?
5. Messauftrag: Tragen Pi-/Codex-Session-Dateien das laufende Modell? (Eine Messung
   entscheidet die Sensor-Abdeckung je Harness; bis dahin ehrliches `null`.)

---

## Teil D — Mess-Lane: das Ergebnis stirbt mit dem Pane, und niemand bucht es

### D.1 Ist-Zustand (Belege)

- Das Grundproblem ist im Repo bereits vermessen:
  `.claude/skills/mess-notiz/SKILL.md` (getrackt) — 123 von 567 Lane-Ausgängen endeten
  `killed-empty` (21,7 %), und der Skill nennt es beim Namen: „das Ergebnis stand nur im
  Pane-Bericht und starb mit dem Slot".
- Die Terminal-Buchhaltung misst nur Git-Form: `server.ts#buildLaneOutcome` schreibt
  `commitCount`, `shortstat`, `filesTouched`; `killed-empty` heißt exakt
  `commitCount === 0`. `server.ts#LaneOutcome` hat KEIN Feld für „war ein Ergebnis
  geschuldet, und wurde es geerntet?".
- Der Kill-Pfad (Slot-Routen im `Bun.serve`-`fetch`-Router: shelve-Arm und
  Kill-Fall-through) bucht `emitLaneOutcome(await buildLaneOutcome(s, …))` VOR
  `killSlot` — die Stelle, an der ein Harvest-Fakt mitgeschrieben werden könnte,
  existiert also schon und läuft für jede Lane.
- `server.ts#detachSlotTasks` setzt die `sent`-Zeile der getöteten Lane zurück auf
  `pending` mit Notiz — die TASK überlebt, aber ohne jede Aussage, ob ihr Ergebnis
  existierte und verschwand.
- Der Fleet-Report ist ausdrücklich MESSAGE, nie Zustand (`server.ts#openFleetReport`),
  und wird als bounded tail beschnitten (`server.ts#pruneFleetReports`,
  `FLEET_REPORT_KEEP = 20` Terminal-Zeilen) — als Ledger unbrauchbar.
- Die Fertig-Prädikate messen Git-Form, nicht Ergebnis-Ablage:
  `lane-signals.ts#laneDoneLooking` verlangt `ahead>0` + clean; eine Mess-Lane, deren
  Ergebnis nur in der Pane steht, hat `ahead===0` und fällt in
  `lane-signals.ts#laneStalled` — „Ergebnis wartet in der Pane" und „steckt fest" sind
  von außen dieselbe Signatur.
- Wo eine Deklaration andocken könnte, existiert bereits: `server.ts#Task` trägt
  `files`/`filesOrigin` (confirmed = owner-promotete Dateifläche) und `criterion`;
  `server.ts#dispatchTask` stempelt Provenienz auf den Slot und schreibt den
  Zustell-Receipt (`CONTEXT_RECEIPT_FILE`, inkl. `briefHash`, `model`, `effort`).
- Namenskollision, vorab entschärft: `server.ts#tickHarvest` und die `harvest`-Map sind
  der TERMINAL-PROMPT-Harvester (getippte Prompts aus dem Transcript) — das neue Konzept
  braucht einen anderen Namen; hier durchgehend **`resultHarvest`**.

### D.2 Soll-Mechanik

- **Deklaration am Dispatch, nie erraten:** Eine Task-Zeile SCHULDET ein Ergebnis, wenn
  ihre owner-bestätigte Dateifläche (`filesOrigin: "confirmed"`) mindestens einen Pfad
  unter `docs/messungen/` nennt — der Vertrag, den `mess-notiz` ohnehin setzt. Beim
  Dispatch stempelt der Server `task.resultHarvest = { state: "pending", since }`.
  Zeilen ohne Deklaration tragen das Feld NIE („ungemessen bleibt null"). Die Deklaration
  wird am Dispatch eingefroren (Snapshot, wie `baseSha`), damit spätere Brief-Edits keine
  falschen Verschwunden-Events erzeugen.
- **Ernte-Flip deterministisch am Terminal-Ereignis:** `buildLaneOutcome` berechnet
  `filesTouched` bereits — schneidet die eingefrorene Deklarationsfläche
  `filesTouched`, flippt der Server `pending → harvested`. Kein Per-Tick-Git-Log, keine
  neuen I/O-Klassen.
- **Verschwundenes Ergebnis ist ein Event:** Stirbt der Slot (kill/shelve), während
  `state === "pending"` steht und die Lane das deklarierte Artefakt nicht committet hat,
  bucht derselbe Codepfad, der heute die Outcome-Zeile schreibt, EIN Event
  (`measurement_vanished`) + `resultHarvest: "pending"` auf der Outcome-Zeile — analog
  zur Main-Bewegung ohne Note (Task `4f452a0f`).
- **`discarded` ist eine Owner-Tür, keine Agenten-Tür:** Nur der Owner kann
  `pending → discarded` setzen (bewusst verworfen, mit Notiz) — gleiche Scope-Regel wie
  `mission`; ein Self-Token bekommt 409.
- Der Tick bleibt Zuschauer: er berechnet nichts Neues, er liest den Zustand für Views.
  Buchungspunkte sind Dispatch (pending), Terminal-Ereignis (harvested oder
  vanished-Event) und Owner-Akt (discarded).

### D.3 Schema-/Ledger-Delta (≤ 10 Zeilen)

```
Task:        + resultHarvest?: { state: "pending"|"harvested"|"discarded";
                                 since: number; declared: string[]; note?: string }
               // declared = am Dispatch eingefrorene Soll-Pfade; Feld fehlt = nichts geschuldet
LaneOutcome: + resultHarvest?: "pending"|"harvested"|"discarded"   // nur deklarierte Lanes
audit.jsonl: + Zeile measurement_vanished (taskId, slot, branch)   // bestehende audit()-Mechanik
Owner-Route: + POST /api/tasks/:id/harvest-discard (owner-token; 409 für self-token)
```

### D.4 Entstehende Events/Ledger-Zeilen

- Dispatch einer deklarierten Task: Feld `pending` auf der Task-Zeile (persistiert,
  `fleet.json`) — keine Event-Zeile.
- Land/Kill mit committetem Soll-Artefakt: Outcome-Zeile trägt
  `resultHarvest: "harvested"` — kein Event.
- Kill/Shelve mit `pending` und ohne Artefakt: genau EIN `measurement_vanished`
  (audit-Ledger, dedupe je Task × Occupant-Fenster) + Outcome-Zeile
  `resultHarvest: "pending"`. Ob zusätzlich ein FleetEvent in die Owner-Inbox soll, ist
  offene Frage 4.
- Owner-Discard: audit-Zeile + Task-Feld `discarded`; die nächste Outcome-Zeile derselben
  Task (falls neu dispatcht) startet wieder bei `pending`.

### D.5 Testplan (ohne Modell grün/rot)

Familien `e2e/tasks.ts` + `e2e/outcomes.ts` (dort stehen die
`killed-empty`/`filesTouched`-Checks bereits):

1. Task mit confirmed `files: ["docs/messungen/x.md"]` dispatcht → Task-Zeile trägt
   `resultHarvest.state === "pending"`, `declared` eingefroren.
2. Lane ohne Commit killen → Outcome-Zeile `resultHarvest: "pending"`, GENAU eine
   `measurement_vanished`-audit-Zeile; zweiter Kill-Versuch bucht keine zweite (dedupe).
3. Lane committet `docs/messungen/x.md`, landet → Outcome-Zeile
   `resultHarvest: "harvested"`, keine Event-Zeile.
4. Task ohne Deklaration → JSON der Task- und Outcome-Zeile hat den KEY nicht
   (Absenz-Assertion, nicht null-Assertion).
5. Adversarial: `POST …/harvest-discard` mit self-token → 409; Owner-Token → `discarded`
   + audit-Zeile.
6. Brief-Edit nach Dispatch ändert `declared` NICHT (Snapshot-Assertion).

### D.6 Risiken

- **Falsche Verschwunden-Events bei stalem Soll:** entschärft durch Einfrieren der
  Deklaration am Dispatch; Rest-Risiko: Owner ändert das Ziel mündlich, Lane liefert
  woanders hin → Event feuert zu Unrecht. Kosten: eine audit-Zeile, kein Gate — bewusst
  billig gehalten.
- **False-positive „harvested"** durch eine Lane, die zufällig unter `docs/messungen/`
  schreibt: unmöglich für undeklarierte Zeilen (kein Feld), für deklarierte nur bei
  Pfad-Schnitt — akzeptiert.
- Namenskollision mit `tickHarvest`/`harvest`-Map: durch `resultHarvest` benannt; bei
  Implementierung Grep-Pflicht auf beide Namen.
- Neue Owner-Route ist neue Oberfläche — owner-only, kein Self-Token, kein Gate; kleinste
  Türform (eine Zustandszeile, ein Ledger-Eintrag).
- Event-Rauschen: gebunden an echte Vorkommnisse (heute wären es die
  killed-empty-Mess-Lanes — genau die Population, die sichtbar werden SOLL).

### D.7 Offene Fragen an den Owner

1. Deklarationsquelle: confirmed `files`-Fläche (Empfehlung — existiert, ist
   owner-promotet) oder ein eigenes explizites Flag am Task?
2. Zählt ein Fleet-Report `status: "complete"` als Ernte? (Empfehlung: nein — Reports
   sind bounded tail; ersatzweise die Event-Id des Reports auf die Outcome-Zeile
   schreiben, damit der Join möglich bleibt.)
3. Darf eine Program-MAIN `discarded` setzen, oder nur der Owner? (Empfehlung: nur Owner,
   analog `mission` — eine MAIN hat keine Tür auf fremde Buchführung.)
4. Soll `measurement_vanished` zusätzlich als FleetEvent in die Owner-Inbox, oder reicht
   die audit-Zeile + Board-Anzeige? (Empfehlung: erst audit-only, Inbox nachrüstbar.)

---

## Abgrenzung: warum keine neuen Gates/Türen für Agenten — und was aus E wird

**Keine neue Agenten-Tür.** Beide Features schreiben ausschließlich an Nähten, die der
Server heute schon besitzt: A liest ein Transcript-Tail, das `server.ts#contextFill`
ohnehin liest, und schreibt Slot-/Outcome-Felder aus dem Tick; D bucht am Dispatch
(`server.ts#dispatchTask`), am Terminal-Ereignis (`server.ts#buildLaneOutcome` vor
`killSlot` — der Pfad existiert) und an einer owner-only Route. Kein Agent kann
`observedModel` posten, keinen Harvest-Zustand setzen, kein Self-Token erreicht eine der
Schreibstellen. Nichts davon gated: die Verify-/Land-Kette bleibt byte-unberührt, beide
Features enden auf Stufe „record → display" der Haus-Doktrin. Genau darum sind Chips die
falsche Reparatur gewesen: ein Chip ändert das Pixel, nicht den Datensatz — die Lüge
stünde weiter in `fleet.json`, im 2-s-Poll und in `lane-outcomes.jsonl`.

**Klassen-Argument.** Main-Bewegung ohne fleet/land-Note (Task `4f452a0f`), ein
Slot-Datensatz, der von der Pane-Realität abweicht, und ein Mess-Ergebnis, das mit dem
Slot stirbt, sind derselbe Defekt: ein beobachtbares Fakt überquert eine Naht, und kein
Ledger bucht es. Die Reparatur ist jeweils dieselbe Bewegung — der Sensor, der das Fakt
ohnehin sieht, schreibt die Buchhaltung nach.

**E als reine Beobachtung.** Die Stale-Brief-Quarantäne bleibt fallengelassen (der Owner
sieht den Brief vor Release). Was als Beobachtung übrig bleibt, ist heute schon fast
vollständig verdrahtet: der Zustell-Receipt (`CONTEXT_RECEIPT_FILE` in
`server.ts#dispatchTask`) trägt `briefHash: briefHashOf(deliveredBrief)` — dieselbe
Funktion (`server.ts#briefHashOf`), mit der Outcome-Zeilen und der Task-Rückjoin
arbeiten —, und `server.ts#Task` hält den Brief „stored, shown and editable". Die
Beobachtung wäre eine einzige abgeleitete View-Zeile: Receipt-`briefHash` ≠
`briefHashOf(task.brief.text)` bei `status === "sent"` ⇒ „Brief seit Zustellung
editiert". Display-only, keine Quarantäne, kein Event, keine Persistenz — ein Vergleich
zweier Hashes, die beide schon geschrieben werden.

# Architektur-Sichtung Zusammenarbeit der Sessions — 2026-09-04 (Erhebung im Auftrag des Controllers Slot 6, Opus-Agent)

Auftrag: grobe Architekturfehler und Verbesserungen in der ZUSAMMENARBEIT der Sessions —
Konfiguration, Rollenzuschnitt, Kommunikationskanäle, Lebenszyklus, Wahrheitsschichten.
Nicht: Code-Stil, kleine Bugs.

Baum `dda9d5b` (Boot-HEAD des laufenden Servers, `deployGap.behindCount 0`). Ledger-Stand
2026-09-04 ~19:16. VERIFIZIERT = am Code, am Ledger oder an einer Owner-`GET`-Antwort gelesen;
ABGELEITET = aus Gelesenem geschlossen, nicht beobachtet. Nichts wurde mutiert, kein `POST`,
keine Suite. Symbolverweise, keine Zeilennummern.

## 0. Coverage — was gelesen wurde

**Vollständig gelesen:** `docs/messungen/2026-09-04-datenschichten-audit.md` ·
`docs/messungen/2026-09-04-context-pack-routing.md` · `HANDOFF.md` (erste 160 Zeilen) ·
`AGENTS.md` §„Portable operating contract" · `lane-signals.ts` (ganz) · `watchdog.sh`
(srv-Spawn-Zeile).

**Gezielt am Symbol gelesen (`server.ts`):** `succeedProgramMain` · `bootstrapProgramMainReserved`
· `programOccupancy` · `programHealth` · `programReturnPath` / `programDeliveryBudget` ·
`teardownSlotOccupant` / `killSlot` · `dropWatchesFor` · `markFleetEventReceiverGone` ·
`reconcileAttention` / `refuseAttention` / `pruneAttention` / `answerAttention` ·
`clarificationReceiverFor` · `openClarification` · `openFleetReport` · `fleetEventReceiver` ·
`tickWatches` (FACT 1 + FACT 2) · `tickDispatch` · `tickAuditPing` / `auditPingMessage` /
`auditChecksOn` · `postLandAuditChecks` · `writeAuditAdjudication` · `laneAutoCloseRefusal` ·
`slotDeliveryBudget` · `effortOf` / `modelOf` · Route `POST /api/slots/:id/model` · Route
`POST /api/post-land-audits/adjudicate` · die Konstanten `DISPATCH_MAX_LANES`,
`DISPATCH_MAX_LANES_PER_PROGRAM`, `ANALYSIS_ON`, `AUTO_REVIEW_IDLE_MS`, `WATCH_MAX_PER_SLOT`,
`FLEET_EVENT_MAX_OPEN_PER_SLOT`, `FLEET_EVENT_MAX_OPEN_OWNER_INBOX`, `ATTENTION_MAX_OPEN_PER_REQUESTER`,
`ATTENTION_KEEP_TERMINAL`, `FLEET_REPORT_KEEP`.

**Ledger (gitignored, per `cat`/`python3`, nie `rg`):** `fleet.json` (programs, slots,
attentionRequests, events, fleetReports, clarifications, watches, tasks) · `audit.jsonl`
(38 300 Zeilen, 882 davon heute) · `post-land-audits.jsonl` (464) · `audit-adjudications.jsonl` (135).

**Live nur lesend:** `GET /api/programs`, `GET /api/sessions`. Kein `POST`.

## 1. Befunde, nach Kosten gerankt

### B-A1 — Eine tote MAIN-Bindung wird nie geräumt, nie gemeldet, und der Lane-Report reroutet still auf einen fremden Beobachter

**Mechanismus.** `programOccupancy` beantwortet die Bindung dreiwertig und fällt überall
geschlossen — das ist richtig und bleibt so. Was fehlt, ist die andere Hälfte: **kein Pfad
räumt `program.main` je auf.** `teardownSlotOccupant` löscht Label, `openedAt`, `mission`,
`autos`, Watches und Tasks des Slots und **fasst `programs[]` nicht an**; die einzige
Statusbewegung aus `active` heraus ist eine Owner-Route (`server.ts`, die `complete`-Zeile im
Program-Action-Router). Es gibt also **keinen Reaper und keinen Alarm** — nur eine Projektion.

Die Folge trifft den Rückweg. `clarificationReceiverFor` sucht zuerst die Program-MAIN; ist die
Bindung stale, fällt sie durch auf **Watch-Evidenz** und nimmt, wen sie findet. Der Kommentar in
`openFleetReport` behauptet „a lane WITH a programId keeps its binding and its 409" — das gilt nur
für den Fall ganz ohne Evidenz. Mit einem beliebigen fremden Lane-Watch reroutet der Report
**still** auf dessen Halter; ohne Watch bekommt die Lane **409** und kann ihren Terminalbericht
strukturell nicht abliefern.

Und die Autorität wandert mit: `laneAutoCloseRefusal` verlangt „jeder Terminalreport trägt ein
Urteil des EXAKTEN Empfänger-Occupants" — es prüft nirgends, dass dieser Empfänger die MAIN des
Programs ist. Wer zufällig den Watch hielt, darf über die Lane eines fremden Programs urteilen
und (bei scharfem `FLEET_LANE_AUTOCLOSE`) ihren Schluss autorisieren.

**Verifiziert.** `GET /api/programs`: **4 von 7 aktiven Programs stehen auf `occupancy: stale`**
(`f99e9354` → Slot 10 leer · `07ee8a6d` → Slot 4, den heute eine Lane eines ANDEREN Programs hält ·
`2c073232` → Slot 7, den heute die MAIN von `f170dc46` hält · `b2aa5b45` → Slot 9 leer). Der
Kommentar in `bootstrapProgramMainReserved` datiert dieselbe Lage schon auf 2026-08-21 mit
„9 von 13" — die Rate ist stabil, die Reparatur von damals machte das **Neubinden möglich, nicht
automatisch**. Der Reroute ist am Ledger belegt: `fleetReports` trägt heute
`basis` **`lane-watch`**, Empfänger **Slot 6 (Controller)**, Worker Slot 1, `programId 07ee8a6d`
— genau die private-repo-p-Lane, die der Controller dann selbst landen musste. Verteilung heute:
`program-main` 17 · `owner-inbox` 6 · `lane-watch` 4.

**Kosten.** Die Arbeit eines Programs verwaist, ohne dass irgendetwas rot wird: die Lane läuft
weiter, ihr Ergebnis landet bei wem auch immer, und die Rolle „MAIN führt ihr Program" degradiert
still zu „der Controller macht es". Die Urteilsautorität über eine fremde Lane hängt an einem
Zufall (wer einen Watch hielt), nicht an einer Bindung.

**Kleinster Schnitt.** Einen Zähler `programsStale` in den Owner-Poll (dieselbe Form wie
`attentionOpen`) plus **eine** Owner-Inbox-Zeile je Program, das länger als eine Stunde `stale`
steht — melden, nicht räumen; das Neubinden bleibt der Owner-Akt, der es heute schon ist.

### B-A2 — Der ganze Rückweg stirbt mit dem Occupant, nicht nur die Attention; und danach ist der Verlust nicht mehr zählbar

**Mechanismus.** Erweitert B1 des Datenschichten-Audits um die drei Kanäle daneben. Eine
Succession verschiebt `program.main` in `succeedProgramMain` und räumt die Vorgängerin nach der
Grace-Frist über `killSlot` → `teardownSlotOccupant`. Dieser eine Teardown tut vier Dinge
gleichzeitig, alle still: `reconcileAttention` refused jede offene Attention
(`"requester session ended"`), `markFleetEventReceiverGone` setzt jedes unzugestellte Event auf
`receiver-gone` (**terminal, kein Rebind auf die Nachfolgerin**), `autos` und `mission` werden
gefiltert bzw. genullt, `dropWatchesFor` entwaffnet die Watches. Die `FleetReport`-Zeile
überlebt zwar in `fleetReports`, aber `fleetReportsFor` bindet auf das volle Occupant-Tripel —
die Nachfolgerin kann sie **nicht lesen**.

Und der Verlust ist nachträglich nicht rekonstruierbar: `pruneAttention` hält nur
`ATTENTION_KEEP_TERMINAL` = 20 terminale Zeilen. Die refused-Zeilen von heute fallen also aus
`fleet.json` heraus, sobald 20 neue terminal werden; die einzige verbleibende Spur ist
`audit.jsonl`, das bei 5 MB mit EINER Generation rotiert (Datenschichten-Audit B7).

**Verifiziert.** `audit.jsonl` heute: **39 `slot_kill`, davon 12 mit Detail `handoff`** (dazu 17
`landed`, 10 `owner`). **9 `attention_open`, 11 `attention_answered`, 3 `attention_refused` —
alle drei mit `requester session ended`, alle drei an Slots, die kurz darauf gingen.** 14
`attention_prune` am selben Tag. In `fleet.json` stehen nur noch 20 Attentions (16 answered,
4 refused). Ein `fleet_event_receiver_gone` heute.

**Kosten.** Jede Übergabe ist ein kleines Amnesie-Ereignis. Heute: **3 von 9 Owner-Fragen (33 %)
sind gestorben, statt beantwortet zu werden**, und die Nachfolgerin kann „wartet noch" von
„kommt nie" nicht unterscheiden. Bei 12 Handoffs/Tag ist das kein Ausnahmefall, sondern die
Betriebsart.

**Kleinster Schnitt.** In demselben `saveStateNow`, das in `succeedProgramMain` die Autorität
verschiebt, die nicht-terminalen Zeilen mit Requester-/Empfänger-Tripel = Vorgängerin **und**
gleicher `programId` auf die Nachfolgerin umhängen — Attention, `FleetEvent`, `FleetReport`; die
Refusal bleibt für Owner-Kills.

### B-A3 — Ein Lane-Abschluss erzeugt ZWEI Zustellungen an dieselbe MAIN, gegen ein Budget von fünf

**Mechanismus.** `openFleetReport` legt ein `fleet-report`-Event an und fasst `watches` nicht an.
`tickWatches` (FACT 1) prüft unabhängig `laneWatchSignal` und mintet für dieselbe Lane ein
zweites Event `lane-ready`. Beide gehen als Pane-Text an denselben Empfänger, beide verlangen
ein eigenes `POST /api/self/events/:id/ack`. Das Budget dafür ist gemeinsam: `slotDeliveryBudget`
zählt offene Events **plus** armed Watches gegen `FLEET_EVENT_MAX_OPEN_PER_SLOT` = `WATCH_MAX_PER_SLOT` = **5**;
ist es voll, refused `openFleetReport` die nächste Lane mit 409.

**Verifiziert.** In `fleet.json` tragen **6 von 42 Lane-Zweigen beide Ereignisarten**; die heutige
private-repo-p-Lane an den Controller mit **151 s Abstand** (Report 19:03:54, `lane-ready` 19:06:26,
beide Empfänger Slot 6). Der Controller hält zusätzlich **zwei `pending` `merge-terminal`-Events**
aus zwei Merge-Watches auf **dieselbe** Lane (19:09, 19:13) — also 3 der 5 Plätze für EINE Lane.
`AUTO_REVIEW_IDLE_MS` ist eine eigene Variable (Default 60 s) und vom live gesetzten
`FLEET_AUTO_REVIEW_MS=0` **nicht** betroffen — geprüft, kein Schwellen-Bug.

**Kosten.** Der teuerste Posten der Zusammenarbeit ist der Kontext einer MAIN (Beobachtung des
Controllers: 220–300k je Nachricht). Ein Lane-Abschluss kostet sie **zwei** Turns statt einem, und
bei `DISPATCH_MAX_LANES=2` plus einem Land sind 4 von 5 Zustellplätzen belegt — die dritte Lane
bekommt 409 auf einen Bericht, den sie schuldet.

**Kleinster Schnitt.** Beim Anlegen eines `fleet-report` den armed Lane-Watch **desselben
Empfängers auf genau diese Lane** entwaffnen (`lastResult`: „die Lane hat selbst berichtet") —
die Lane, die spricht, macht das Server-Prädikat über sie überflüssig.

### B-A4 — Für 88 von 108 roten Post-Land-Audits fehlen die Namen der gefallenen Checks

**Mechanismus.** `PostLandAuditRow.fails` ist im Typkommentar ausdrücklich „remote-only,
validated and capped names; absent on local and historical rows". Der LOKALE Lauf hat die vollen
Pipes, speichert aber nur `out` als byte-gedeckelten TAIL — die Namen sind weg, sobald der Lauf
endet. `auditPingMessage` zeigt dem Urteilenden `fails` (wenn vorhanden) und sonst **die letzten
15 Zeilen**. Das ist die Umkehrung der Erwartung: der Pfad mit mehr Information speichert weniger.

**Verifiziert.** `post-land-audits.jsonl`: 464 Zeilen, 258 green / 108 red / 98 unknown.
**88 lokale Rots, davon 0 mit `fails`; 20 Remote-Rots, davon 9 mit `fails`.**
`audit-adjudications.jsonl`: 135 Urteile — **62 `flake`, 32 `unknowable`, 23 `stale-test`,
18 `real`**. Heute 16 Audits: 9 rot, 5 grün, 2 unknown.

**Kosten.** 94 von 135 Urteilen (70 %) sagen „nicht der Baum" — gefällt auf einem 15-Zeilen-Tail.
Das ist die teuerste wiederkehrende Denkarbeit im Fleet, und sie läuft auf der schwächsten
Evidenz, die das System hat. `unknowable` ist 32-mal genau das Eingeständnis.

**Kleinster Schnitt.** Auf dem lokalen Pfad `fails` aus demselben `PASS `/`FAIL `-Scan füllen, den
`postLandAuditChecks` ohnehin über den Text fährt — ein Feld, kein neuer Rail.

### B-A5 — Ein rotes Audit wird an eine BELIEBIGE ruhige Session zugestellt, nicht an die, die gelandet hat

**Mechanismus.** `tickAuditPing` wählt seinen Empfänger so: alle Slots mit `cwd`, ohne Worktree,
nicht der Steward, nicht `awaiting: "owner"` — **sortiert nach `lastOutput`**, also die am
längsten stille Session zuerst. Weder `covers[].branch`, noch die `LandRecord`-Provenienz, noch
das Program der gelandeten Zeile gehen in die Wahl ein. Der Prompt fordert dann ein Urteil über
`POST /api/post-land-audits/adjudicate` — eine Route, die **owner-only by position** ist, also den
Owner-Token verlangt, den eine Session sich aus `fleet.json` nehmen muss.

**Verifiziert.** Der Kandidatenfilter und die Sortierung stehen wörtlich in `tickAuditPing`; das
Auth-Modell steht als Kommentar an der Route („Owner-only by POSITION (below tokenGate)");
`writeAuditAdjudication` stempelt `by: "owner"` fest.

**Kosten.** Die MAIN, deren Land rot wurde, erfährt es unter Umständen nie; eine unbeteiligte
Session zahlt dafür einen vollen Audit-Dump im Kontext. Die Zuständigkeit für das teuerste
wiederkehrende Urteil ist an „wer war gerade still" gebunden.

**Kleinster Schnitt.** Die Kandidatenliste zuerst nach der Program-MAIN des in `covers` genannten
Zweigs ordnen und erst danach nach `lastOutput` — dieselbe Route, eine Sortierstufe davor.

### B-A6 — Modell und Effort existieren doppelt (Datensatz und Pane) und es gibt keinen Sensor für die zweite Hälfte

**Mechanismus.** `POST /api/slots/:id/model` validiert über `modelOf`/`effortOf` und schreibt
`s.model`/`s.effort` — **die Pane wird nicht angefasst**; das steht im Kommentar der Route auch so.
Umgekehrt ändert ein `/model` in der Pane den Datensatz nicht. Der Datensatz ist die Quelle für
jeden künftigen Spawn (`restart`, der 2-s-Heal, `succeedProgramMain` reicht `spawn.model`/
`spawn.effort` an `openSlot`). Eine Sonde, die den tatsächlichen Zustand der Pane liest, gibt es
nicht: in `server.ts` existiert kein Symbol, das Modell oder Effort aus `capture-pane`
zurückliest — die Faktschicht `agent` beantwortet nur `alive|no-agent|no-pane|unprobed`.

**Verifiziert.** Route und `effortOf` gelesen; Abwesenheit einer Rücklese-Sonde durch Suche über
`server.ts` festgestellt. `GET /api/sessions` heute: Slot 6 (Controller) `model
claude-fable-5-1[1m]`, `effort high` — der vom Controller gemeldete Widerspruch „Pane sagt Opus 5,
Datensatz sagt fable" ist am heutigen Slot 6 **nicht mehr sichtbar** und muss als offene
Beobachtung an der Pane gelten, nicht am Datensatz. **Slot 15** dagegen: `label "fable5"`,
`model null`, `effort null` — und die Controller-Beobachtung „ctx unmessbar" ist **falsch**:
`ctx` meldet 9,9 % (99 357 / 1 000 000). Der reale Mangel ist der **leere Modell-Datensatz**: ein
Heal oder Restart dieses Slots spawnt auf `FLEET_MODEL` aus `.env`, nicht auf das, was in der Pane
läuft.

**Kosten.** Die Modellpolitik des Regelbuchs (Fable orchestriert, Opus 5 in Lanes) ist **nicht
verifizierbar**: kein Sensor kann sagen, ob eine Pane tut, was ihr Datensatz behauptet. Jeder
Heal, Restart und jede Succession kann ein Modell still wechseln — und der Effort ist doppelt
unsichtbar, weil ihn auch der Pane-Footer nicht nennt.

**Kleinster Schnitt.** `POST /api/slots/:id/model` im selben Akt das `/model <id>` an die Pane
schicken (die Route hat `canDeliver` bereits im Haus) und den Erfolg als `modelPushedAt` stempeln —
danach ist „Datensatz gesetzt, Pane nie informiert" ein sichtbarer Zustand statt einer Vermutung.

### B-A7 — Der Dispatch-Deckel ist ein REPO-Deckel, der Program-Deckel per Default inert, und die Kollisionsprüfung ist live abgeschaltet

**Mechanismus.** `tickDispatch` prüft in dieser Reihenfolge: `kind === "auftrag"` und
`status === "queued"` · Repo-Deckel `DISPATCH_MAX_LANES` · Program-Deckel
`DISPATCH_MAX_LANES_PER_PROGRAM` · Harness automatable · freier Slot. Der Program-Deckel
**defaultet auf `DISPATCH_MAX_LANES`** und kann darum nie greifen — der Kommentar sagt das selbst
(„The knob is inert until the owner sets it SMALLER"). Der gesamte Block mit Analyse-Frische
**und** Kollisionsprüfung hängt an `ANALYSIS_ON`.

**Verifiziert.** `watchdog.sh` srv-Spawn: `FLEET_DISPATCH_MAX_LANES=2`, `FLEET_ANALYSIS_MS=0`,
`FLEET_AUTO_REVIEW_MS=0`, `FLEET_CLEAN_REVIEW=off`, `FLEET_HARNESS_AUTOMATION=1`,
`FLEET_LANE_AUTOCLOSE=1`; `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` ist **nicht gesetzt**.
`GET /api/sessions` bestätigt live: `analysis {"on": false}`, `dispatch {"on": true,
"maxLanes": 2}`.

**Kosten.** Drei aktive Programs im selben Repo teilen sich zwei Lane-Plätze, vergeben
älteste-Zeile-zuerst über alle Programs hinweg — es gibt **keine Fairness zwischen Programs**, ein
Program mit vielen freigegebenen Zeilen nimmt beide Plätze. Und weil `ANALYSIS_ON` aus ist,
startet der unbeaufsichtigte Dispatcher **ohne jede Kollisionslesung**: zwei Lanes auf denselben
Dateien sind heute nur durch die Zahl 2 verhindert, die von Dateien nichts weiß.

**Kleinster Schnitt.** `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1` in die srv-Spawn-Zeile von
`watchdog.sh` — eine Zuweisung, und der zweite Deckel wird zum ersten Mal der bindende;
Rückfalltür ist das Löschen derselben Zuweisung.

### B-A8 — `by: "owner"` ist gestempelt, nicht gemessen: die Ledger können den Menschen nicht von einer Session trennen

**Mechanismus.** `writeAuditAdjudication` setzt `by: "owner"` fest („stamped, never read from the
body — this route has exactly one principal"). Auf dem Land-Pfad existiert für genau dieses
Problem bereits eine ehrlichere Konstruktion: `ownerLandActor` liest den Token-KANAL (`cookie` =
Board, `bearer` = Skript, Query = getippte URL) und setzt ein `suspect`-Flag, wenn ein Owner-Token
über Bearer eine Lane landet, deren Program eine lebende MAIN hat. Der Adjudikations-Rail hat
diese Unterscheidung nicht.

**Verifiziert.** Beide Stellen gelesen. `audit.jsonl` heute: **15 `owner_token_ambient_use`**, alle
`via=bearer`, verteilt auf die Programs `b2aa5b45` (6), `cd110019` (6), `66499a03` (2) und Slots
2/3/5 — also Sessions, die mit dem Owner-Token Lanes fremder Programs gelandet haben, während
diese Programs eine lebende MAIN hatten. `audit-adjudications.jsonl`: 127 Zeilen `by: "owner"`,
8 `by: "backfill"`.

**Kosten.** Der Rollenzuschnitt „MAINs landen selbst, der Owner adjudiziert" ist im Ledger **nicht
nachprüfbar**. Eine spätere Session, die fragt „wer hat das entschieden", bekommt 127-mal dieselbe
Antwort, und die ist in einem unbekannten Anteil der Fälle falsch. Der Kommentar am Land-Pfad sagt
richtig, dass Prävention hier unsupported ist — aber die Adjudikation kann die Klasse nicht einmal
BENENNEN, was der Land-Pfad kann.

**Kleinster Schnitt.** `writeAuditAdjudication` das `Request` durchreichen und dasselbe
`via`/`suspect`-Paar auf die Adjudikationszeile stempeln, das `ownerLandActor` schon berechnet.

## 2. Geprüft und in Ordnung — nicht anfassen

1. **Die `openedAt`-Identitätsdoktrin.** Jeder Konsument vergleicht das volle Tripel bzw. Paar
   (`programOccupancy`, `programHealth`, `clarificationReceiverFor`, `fleetEventReceiver`,
   `attentionBound`, `laneAutoCloseRefusal`, `predecessorCurrent`/`candidateCurrent` in
   `succeedProgramMain`). Keine Stelle vergleicht nur die Slot-Id. Ein Program, dessen Bindung auf
   einen Slot zeigt, den heute eine fremde Lane hält (`07ee8a6d` → Slot 4), fällt überall
   geschlossen — genau wie das Datenschichten-Audit es beschreibt.
2. **Die Crash-Grenze von `succeedProgramMain`.** EIN Zustandsschnitt bewegt Autorität und löscht
   den Founding-Marker; scheitert `saveStateNow`, werden `main`, `lineage`, `founding`,
   `successionRetirement` und `successionStarted` zurückgerollt. Die Quittung ist ausdrücklich
   Evidenz und nie Lease. Der Ablauf prüft nach JEDEM `await` beide Identitäten erneut.
3. **Der dreiwertige Audit-Klassifikator und `auditChecksOn`.** `checks: null` heißt UNKNOWN, nie
   erfundene Null; `postLandAuditChecks` gibt `null` zurück, sobald Summenzeile, `ALL PASS` und
   Exit-Code sich widersprechen, und stempelt `ranIsLowerBound`, wo nur ein Tail vorlag.
4. **Die Watch-Absagen.** `dropWatchesFor` LÖSCHT einen Watch auf ein totes Ziel nicht, sondern
   entwaffnet ihn mit lesbarem `lastResult` — „wartet noch" und „kommt nie" bleiben von innen
   unterscheidbar. `tickWatches` hat dafür eine zweite Schranke für Pfade, die am Teardown
   vorbeigehen.
5. **Die Validierung von Modell/Effort.** `modelOf`/`effortOf` werden an `open`, `dispatch`,
   `bootstrap`, `succeed`, `taskSpawnFromBody` und der `model`-Route **identisch** angewandt; ein
   Harness ohne Effort-Begriff lehnt einen Wert ab, statt ihn still fallen zu lassen.
6. **Die FleetEvent-Zustandsmaschine.** `pending` ist der einzige retrybare Zustand;
   `send-uncertain` wird VOR dem tmux-Roundtrip persistiert; eine Owner-Inbox-Zeile ist von Geburt
   an `inbox` und kann strukturell nie in eine Pane getippt werden.
7. **Kein Tick landet.** `tickDispatch` startet nur `kind === "auftrag"` mit `status === "queued"`;
   die Deckel SKIPPEN statt zu returnen, nur „kein freier Slot" hält den Sweep an.

## 3. Nicht geprüft

- **Keine Suite gelaufen, nichts mutiert, kein `POST`.** Alle Befunde sind aus Code plus Ledger
  plus zwei Owner-`GET`s gelesen, keiner reproduziert.
- **`e2e/`-Fixtures** (`e2e/programs.ts`, `e2e/watch.ts`, `e2e/outcomes.ts`, `e2e/merge.ts`) nicht
  gelesen — ob B-A1…B-A3 bereits gepinnt sind oder eine Gegenprobe existiert, ist offen.
- **`src/client.ts`** nur per Symbolsuche gestreift (📣-Attention-Inbox, 📥-Operations-Inbox
  existieren als Badges); die Renderpfade nicht gelesen.
- **Supervisor-Schicht** (`supervisorView`, `POST /api/self/nudge`, `completeTransitionWatch`) und
  **Studios**, **Game-Maker-Lease**, **Helper-Daemon** nicht auditiert.
- **Merge-/Land-Pfad** nicht erneut gelesen — B2 und B3 des Datenschichten-Audits stehen
  unverändert und wurden hier nur referenziert.
- **Panes nicht angesehen.** Der gemeldete Widerspruch „Slot 5 Footer Opus 5 / Datensatz fable"
  konnte am Datensatz nicht mehr nachvollzogen werden (Slot 5 ist heute frei, Slot 6 trägt den
  Controller mit `fable`); er bleibt eine unbelegte Pane-Beobachtung.
- **`audit.jsonl.1`** und ältere Rotationen sind in keiner Zahl enthalten; die Attention-Historie
  ist durch `pruneAttention` bereits beschnitten, alle Attention-Zahlen sind daher
  **Untergrenzen**.
- **Kontext-Pack-Routing** nicht nachgerechnet — die Lücken 1–7 jener Notiz gelten unverändert;
  besonders die dort gemessene Lücke, dass die generische Succession weder Plan noch Quittung
  fährt, ist die Verlängerung von B-A2 auf die Kontextseite.

## 4. Rohzahlen aus den Ledgern

**Programs (`fleet.json`, bestätigt an `GET /api/programs`).** 61 gesamt: 53 `complete`,
7 `active`, 1 `proposed`. Von den 7 aktiven: **3 `live`** (`cd110019` → Slot 11 · `66499a03` →
Slot 3 · `f170dc46` → Slot 7, alle `sessionIdMatch: exact`), **4 `stale`** (`f99e9354` → Slot 10
leer, gebunden 09-02 · `07ee8a6d` → Slot 4, gebunden 09-02, heute Lane eines anderen Programs ·
`2c073232` → Slot 7, gebunden 09-03, heute MAIN von `f170dc46` · `b2aa5b45` → Slot 9 leer,
gebunden 09-04). Alle vier tragen `deliveryBudgetNote: "return path unknown …"`.

**Slots (8 von 16 belegt, `GET /api/sessions`).**

| Slot | Rolle | Modell | Effort | ctx |
|---|---|---|---|---|
| 1 | Lane (Program `07ee8a6d`) | `claude-opus-5[1m]` | high | 33,9 % |
| 2 | Lane (Program `f170dc46`) | `claude-opus-5[1m]` | high | 27,5 % |
| 3 | Program-MAIN `66499a03` | `claude-opus-5[1m]` | high | **22,4 %** |
| 4 | Lane (Program `cd110019`) | `claude-opus-5[1m]` | high | 15,6 % |
| 6 | 🎛 Fleet Controller | `claude-fable-5-1[1m]` | high | 17,2 % |
| 7 | Program-MAIN `f170dc46` | `claude-opus-5[1m]` | high | **30,5 %** |
| 11 | Program-MAIN `cd110019` | `claude-opus-5[1m]` | high | **22,9 %** |
| 15 | Owner-Session „fable5" | **null** | **null** | 9,9 % |

Alle drei Program-MAINs stehen im 25/30-Band oder unmittelbar davor; die Modellpolitik
(Controller Fable, alles andere Opus 5) hält im Datensatz — mit der einen Ausnahme Slot 15.

**Kanäle (`fleet.json`).** 101 Events: 93 `acknowledged`, **6 `inbox`** (Owner-Inbox-Reports,
ältester 08-31, keiner acknowledged), 1 `receiver-gone`, 2 `pending` (beide `merge-terminal` an
Slot 6, beide auf dieselbe Lane). Nach Art: 33 `fleet-report`, 32 `merge-terminal`, 20
`lane-ready`, 14 `post-land-audit`, 2 `clarification-request`. 27 `fleetReports`; heutige
Basis-Verteilung 17 `program-main` / 6 `owner-inbox` / 4 `lane-watch`. 6 Clarifications, alle
`answered`. 5 Watches, **keiner armed**. **6 von 42 Lane-Zweigen** haben sowohl einen
`fleet-report` als auch ein `lane-ready` erzeugt.

**Attention (`fleet.json` + `audit.jsonl`).** Bestand 20: 16 `answered`, 4 `refused` — alle vier
mit `refusedReason: "requester session ended"`, keiner offen. Heute im Audit-Log: 9 `open`,
11 `answered`, **3 `refused`**, 14 `prune`. Die Bestandszahl ist wegen `ATTENTION_KEEP_TERMINAL`
eine Untergrenze.

**Slot-Lebenszyklus (`audit.jsonl`, 882 Zeilen heute von 38 300).** 39 `slot_kill`: **17
`landed`, 12 `handoff`, 10 `owner`**. 35 `slot_open`, 35 `self_heal_recreate`, 77 `watch_fire`,
14 `task_dispatch`, 17 `land_actor`, **15 `owner_token_ambient_use`** (alle `via=bearer`).

**Audits.** `post-land-audits.jsonl` 464 Zeilen: 258 green / 108 red / 98 unknown. Rote Zeilen
mit Check-Namen: **9 von 108** (alle remote). Heute 16 Läufe: 9 rot, 5 grün, 2 unknown; das
jüngste (18:57, remote, `checks {ran 3628, failed 2}`, `covers fleet/260904055850-898f`) ist zur
Erhebungszeit **rot und unbeurteilt**. `audit-adjudications.jsonl` 135: 62 `flake`, 32
`unknowable`, 23 `stale-test`, 18 `real`; 127 `by: "owner"`, 8 `by: "backfill"`; 6 rote Zeilen
noch ohne Urteil.

**Queue.** 200 Tasks am Deckel: 109 `pending`, 73 `done`, 12 `archived`, 3 `sent`, 3 `queued`
(deckt sich mit B4 des Datenschichten-Audits).

**Betriebsschalter (`watchdog.sh` srv-Spawn, bestätigt an `GET /api/sessions`).** `dispatch on,
maxLanes 2` · `analysis on: false` · `FLEET_AUTO_REVIEW_MS=0` · `FLEET_CLEAN_REVIEW=off` ·
`FLEET_HARNESS_AUTOMATION=1` · `FLEET_LANE_AUTOCLOSE=1` · `FLEET_AUDIT_PING_MS=60000` ·
Verify 480 s Arbeit / 2 700 s Warten · Post-Land-Audit 2 700 s. `bundleStale false`,
`deployGap.behindCount 0`, `errors null`.

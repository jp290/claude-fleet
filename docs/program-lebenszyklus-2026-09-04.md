# Das Program als dauerhafte Einheit — Struktur fuer die acht Befunde der Architektur-Sichtung (2026-09-04)

Entwurf des Controllers Slot 6 auf Owner-Anfrage 19:5x („denk nochmal gut nach, wie du diese am
besten strukturierst, bevor du sie angehst — vielleicht mit einem Teil neuer simplerer
Systemarchitektur oder auch mit neuen Datenschichten"). Grundlage:
`docs/messungen/2026-09-04-architektur-zusammenarbeit.md` (B-A1…B-A8) und
`docs/messungen/2026-09-04-datenschichten-audit.md` (B1, B2, B3). Status: VORSCHLAG, nicht promoviert.
**Gegengecheckt am Code durch eine GLM-Lane** (`docs/messungen/2026-09-04-plan-gegencheck-glm.md`,
2026-09-04 20:0x): 8 von 9 Behauptungen bestaetigt, 1 teilweise; die sechs Korrekturen von dort
sind in dieser Fassung eingearbeitet und je mit „(GLM-Korrektur)" markiert.

## 0. Die eine Wurzel

Sieben der elf Befunde haben denselben Mechanismus: **der Bindungsschluessel ist der Occupant, die
Lebensdauer ist die des Programs.** Attention (`AttentionRequest.requester`), Report
(`FleetReport.receiver`), Event (`FleetEvent.receiver`), Watch, Auto, Mission und `mergeLast` binden
an `{slot, openedAt, sessionId}` bzw. an die Slot-Nummer. Ein Program laeuft Tage; ein Occupant
lebt Stunden, weil das 25/30-Band ihn planmaessig ersetzt. Jede Succession aendert den Schluessel,
und `teardownSlotOccupant` raeumt alles, was daran haengt — Attentions `refused`, Events
`receiver-gone`, Autos und Mission verschwinden, Watches werden entwaffnet. Das ist
B1, B-A1, B-A2, B-A3, B-A5 und B3 in einem Satz.

Zwei Praezisierungen (GLM-Korrektur): **`mergeLast` ist kein reines Opfer** — `parkMergeVerdict`
hebt REVIEWABLE Verdicts seit 2026-08-05 nach BRANCH in `mergeParked` („has LANE lifetime, not
slot lifetime"). Das ist der bereits gebaute Vorlaeufer der D1-Idee: ein Fakt, der an das
langlebige Objekt gebunden wird statt an den Occupant. Und **Reports rerouten nicht im Teardown**:
bestehende Report-Zeilen bleiben an das tote Tripel gebunden und werden unsichtbar; das stille
Rerouten auf Watch-Evidenz ist ein Effekt von `clarificationReceiverFor` fuer KUENFTIGE Reports,
sobald die Bindung stale ist.

`AttentionRequest` traegt heute schon `programId`, `FleetReport.provenance` ebenso. Der dauerhafte
Adressat existiert also im Datensatz — er wird nur nicht als Adressat benutzt.

**Leitidee:** Das Program wird der Adressat und Besitzer von allem, was seine Lebensdauer hat.
Der Occupant wird bei der ZUSTELLUNG aufgeloest, nie als Bindung gespeichert. Was Laufzeit ist
(Watches, Autos, Mission, Composer), bleibt bewusst occupant-gebunden und darf sterben.

Was dadurch einfacher wird, gezaehlt:
- Kanaele an eine MAIN: heute sechs (attention-answer, fleet-report, event, clarification, send,
  Queue-notiz) → zwei (Program-Inbox im Pull, `send` als Push fuer Menschen und Notfall).
- Bindungsschluessel: zwei (Occupant-Tripel, Slot-Nummer) → einer (Program-Id) fuer alles Dauerhafte.
- Handoff-Datei: eine geteilte pro Repo → eine pro Program, ausserhalb von git.

## 1. Vier Datenschichten, je mit den Befunden, die sie schliessen

### D1 — Program-Inbox (dauerhaft, pull-basiert)

`program.inbox[]` in `fleet.json`: `{id, kind, at, ref, readBy?: occupant, readAt?}` mit
`kind ∈ attention-answer | fleet-report | audit-red | event | owner-note`. `ref` zeigt auf die
bestehende Zeile (Report-Id, Attention-Id, Audit-Zeile), die Inbox dupliziert keinen Inhalt.

- **Zustellung ist ein Schreibzugriff, kein Wecken.** Der Server schreibt den Eintrag; die MAIN
  liest `GET /api/self/inbox` am Anfang jedes eigenen Turns und markiert per
  `POST /api/self/inbox/:id/read`. Push bleibt EINE Ein-Zeilen-Nudge am Idle-Punkt („N ungelesen"),
  hoechstens einmal je Idle-Punkt. Damit kostet eine Zeile an eine MAIN keinen Vollkontext-Turn
  mehr — das Routing hoert auf, von Kosten verzerrt zu werden (Controller-Beobachtung e).
- **Succession ist kostenlos:** die Inbox haengt am Program, die Nachfolgerin liest, was die
  Vorgaengerin nicht las. Kein Rebind, kein `refused`. Schliesst B1 und B-A2 fuer alles Dauerhafte.
- **Report adressiert das Program:** heute bevorzugt `clarificationReceiverFor` schon eine
  LEBENDE Program-Bindung (`basis: program-main`) und faellt bei STALER Bindung auf Watch-Evidenz
  zurueck (GLM-Korrektur: der Plan hatte das Program ganz aus der Wahl gestrichen — falsch). Der
  Schnitt ist also kleiner und schaerfer: bei staler Bindung geht der Report in die Program-Inbox
  statt an einen fremden Beobachter; `basis: lane-watch` bleibt nur fuer programlose Lanes.
  Beim Anlegen wird der armed Lane-Watch derselben Lane entwaffnet — der Empfaenger liegt in
  `openFleetReport` bereits als `bound.receiver` vor. Schliesst B-A1 (Report-Reroute) und B-A3.
- **Drei Aufrufer muessen MIT umziehen (GLM-Korrektur, groesster Fehler der ersten Fassung):**
  `laneAutoCloseRefusal` verlangt fuer jeden Report ein `decision`, dessen `by` das EXAKTE
  Empfaenger-Tripel nennt, und `r.receiver === null` ist dort schon eine Verweigerung. Wird der
  Empfaenger das Program, stuende jede Program-adressierte Lane auf „undecided" und der scharfe
  Autoclose (`FLEET_LANE_AUTOCLOSE=1`) waere still abgeschaltet — nicht rot, nur weg. Also gehoeren
  `laneAutoCloseRefusal`, `decideFleetReport` und `fleetReportFrom` in denselben Schnitt: die
  Entscheidung wird von der an das Program GEBUNDENEN MAIN getroffen (`boundProgramForMain`),
  und `receiver`/`basis` bekommen eine neue Stufe `program` (sie sind EIN Fakt, `fleetReportFrom`
  prueft sie zusammen). Die Q3-Sonde in `e2e/watch.ts` („bound MAIN gets … receiver.slot ===
  main") zieht mit um. Nebenbefund derselben Pruefung: heute darf ein Beobachter, der ueber
  lane-watch empfing, ueber die Lane eines FREMDEN Programs urteilen und ihren Autoclose
  autorisieren — die Program-Bindung als Bedingung schliesst das.
- **Budget (GLM-Korrektur):** `slotDeliveryBudget` rechnet offene FleetEvents plus armed Watches
  gegen `FLEET_EVENT_MAX_OPEN_PER_SLOT` (wertgleich `WATCH_MAX_PER_SLOT`, 5). Inbox-Eintraege
  zaehlen dort NICHT — sie belegen keinen Slot, sie liegen am Program. Das Cap bleibt fuer
  Events und Watches bestehen; es wird nur nicht mehr von Reports belegt.
- **Rotes Audit adressiert das Program des Lands:** `covers[].branch` → Task → `programId` →
  Inbox `audit-red`. `tickAuditPing` faellt nur noch fuer programlose Lands auf die ruhigste
  Session zurueck. Schliesst B-A5.
- **Attention-Antwort** landet als Inbox-Eintrag statt als `send` in die Pane; die Attention
  selbst bleibt, wie sie ist (der Owner sieht sie im Board).
- **Die Wache gegen den recycelten Slot bleibt und wird einfacher.** Heute binden
  `fleetReportsFor` und `clarificationsFor` auf das volle Tripel, damit der Nachmieter eines Slots
  die Reports des Vormieters nicht sieht — und genau dieses Drittel ist ungeprueft
  (`docs/messungen/stichprobe-tiefenpruefung-2026-08-26.md` §5: die Sonden halten nur
  verschiedene Slotnummern gegeneinander). Mit Program-Adressierung sieht die Inbox, wer an das
  Program GEBUNDEN ist (`boundProgramForMain`); ein recycelter Slot ohne Bindung sieht nichts,
  ohne dass eine Tripel-Wache je Route nachgebaut werden muss. Der fehlende Check („same slot,
  new openedAt, sieht keine Inbox") gehoert in Schnitt 3a.
- **Vorlaeufer, gleiche Idee, andere Fläche:** `docs/attic/lane-context.md` §4 („invert push
  into pull", 2026-08) schlug `GET /api/self/context` fuer die FAKTEN einer Lane vor. D1 wendet
  dasselbe Prinzip auf die POST einer MAIN an. Beide teilen die Begruendung: Pull kostet den
  Empfaenger einen kleinen Turn zu seinem Zeitpunkt, Push kostet ihn seinen ganzen Kontext zu
  einem fremden.

### D2 — Program-Status-Projektion (abgeleitet, nie geschrieben)

Je aktivem Program, im Owner-Poll und in `GET /api/self/programs`:
`main {slot, occupancy: bound|stale|none}` · `inbox {unread, oldestAt}` · `attention {open}` ·
`lanes {running, queued, waiting}` · `lastLand {sha, verifyOk, at}` ·
`lastAudit {result, fails, adjudicated}` · `deploy {codeBehind}`; fleet-weit `programsStale`.

Keine neue Wahrheit: es ist die Ableitung aus `fleet.json`, `lane-outcomes.jsonl`,
`post-land-audits.jsonl` und den Land-Notes — genau die vier Quellen, die der Controller heute
von Hand zusammengelesen hat, um EINE Lane zu landen. Schliesst B-A1 (Sichtbarkeit).
**Erweiterung, kein Neubau (GLM-Korrektur):** `programExecutionView` hinter
`GET /api/self/program-execution` existiert mit `programOccupancy`, `programHealth`,
`programReturnPath`/`programDeliveryBudget` — die Warnung `deliveryBudgetNote: "return path
unknown …"` ist die D2-Warnung, schon im Code. Neu sind die drei Lese-Rails fuer `lastLand` und
`lastAudit` (Outcomes, Audits, Land-Notes) und der fleet-weite Zaehler. Zwei Pins in
`e2e/pins.ts` binden: die View enthaelt keine Mutations-Primitive (D2 bleibt read-only), und die
Route wird weder umbenannt noch ausgehoehlt. Und sie ist
die Messbasis fuer D1/D3: ohne die Projektion kann niemand belegen, dass eine Inbox leer laeuft
oder ein Handoff ankam. Eine Park-Regel (stale UND keine Lane UND leere Inbox → `parked`) wird
damit formulierbar, bleibt aber Owner-Route; ein Tick MELDET nur.

### D3 — Handoff am Program statt in git

`program.handoff {text, at, bySession}` ueber `POST /api/self/handoff`; der Gruendungsbrief der
Nachfolgerin rendert ihn. Das Succession-Gate prueft `handoff.at > session.openedAt` statt
„Commit juenger als die Session". `HANDOFF.md` in git bleibt fuer Sessions ohne Program
(Controller, Steward, Supervisor). Schliesst B3-S: die 37 % der main-Bewegungen, die heute reine
Handoff-Commits sind, entfallen, und mit ihnen der haeufigste ff-lost-Ausloeser (S2 heute:
zweiter Anlauf noetig nach 32 min gruenem Gate).

Vier Praezisierungen (GLM-Korrektur):
- **Game-Maker-Programs sind die AUSNAHME:** `handleSelfSucceed` verlangt dort den committeten
  Checkpoint als einzigen Kanal (`gameMakerCheckpointError`, `carry` wird 409). Der Checkpoint
  bleibt; D3 gilt fuer Programs ohne Studio-Bindung. Wer ihn spaeter mitziehen will, tut das als
  eigenen Schnitt mit eigener Owner-Freigabe.
- **Die „clean"-Komponente des Gates faellt weg** (heute: exist + clean + Commit juenger). Ersatz:
  `bySession` muss der lebende Occupant sein, und der Gruendungsbrief nennt Alter und Autorin des
  Handoffs, damit eine Nachfolgerin ein veraltetes Feld erkennt.
- **Fail-closed bei fehlendem Komparator:** faellt `session.openedAt` auf `SERVER_BOOT_AT`
  zurueck (Restore), darf ein aelterer Handoff nicht „frisch" werden — dieselbe Regel, die der
  git-Pfad heute pflegt.
- Schnittgroesse: Gate + Gruendungsbrief + Route + e2e ist EINE Lane, seriell nach 3a.

### D4 — Vollstaendige Ledger-Zeilen

Vier voneinander unabhaengige Einzelschnitte, jeder allein landbar:
- **Audit `fails[]` auch lokal** — ein NEUER Namens-Extraktor (GLM-Korrektur: der Remote-Pfad
  scannt nicht, der Helper MELDET die Namen und `helperFailNames` validiert und cappt sie;
  `postLandAuditChecks` zaehlt lokal nur Zeilen). Zwei Quellen stehen zur Wahl: `completeOutput`
  vor dem Byte-Cap, oder der per-Check-Trail (`postLandAuditTrailFile`), der die Namen ohnehin
  je Zeile traegt. Format und Cap wie `helperFailNames`, damit lokale und remote Zeilen
  gleich lesbar sind. Schliesst B-A4 (88 von 108 roten Zeilen ohne Namen; 94 von 135 Urteilen
  `flake`/`unknowable`). Heute zweimal live bezahlt: die Adjudikation zu 40f7006 musste den
  Namen aus dem Run-Trail holen.
- **Adjudikations-Actor gemessen** — `writeAuditAdjudication` bekommt das Request und nutzt die
  Unterscheidung, die `ownerLandActor` auf dem Land-Pfad schon rechnet. Schliesst B-A8.
- **`paneModel` als Ruecklese** — der git-Tick liest das Modell aus dem Footer der Pane (dort steht
  es) und traegt es neben `model` in den Slot; `POST /api/slots/:id/model` schickt im selben Akt
  `/model <id>` an die Pane. Schliesst B-A6; die Modellpolitik wird pruefbar.
- **`FLEET_DISPATCH_MAX_LANES_PER_PROGRAM=1`** in der srv-Spawn-Zeile von `watchdog.sh` — Konfig,
  kein Code, plus `launchctl kickstart`. Schliesst B-A7 (Fairness); die Analyse-Frage
  (`FLEET_ANALYSIS_MS=0`) bleibt ein eigener Owner-Entscheid, weil sie echte Agenten spawnt.

## 2. Was bewusst NICHT drin ist

Auto-Park eines Programs (Owner-Route bleibt; ein Tick meldet), Auto-Rollback auf rotes Audit
(beerdigt), ein neuer Rollentyp, ein Umbau der Watches (Laufzeit darf sterben), ein Ersatz von
`send` (Menschen und Notfall brauchen den Push).

## 3. Reihenfolge, Schnitte, Verify

Jeder Schnitt ist eine Lane mit eigener Verify-Erweiterung, keiner haengt an einem spaeteren:

| # | Schnitt | schliesst | Verify (neu) | Abhaengigkeit |
|---|---|---|---|---|
| 1 | D4 Audit `fails[]` lokal | B-A4 | `e2e/repo-worker-audit.ts`: lokale rote Zeile traegt NUR extrahierte Namen, im Format und Cap von `helperFailNames` (GLM-Korrektur: sonst wird der Check gruen, ohne das Feldformat zu binden) | keine |
| 2 | D2 Projektion | B-A1 Sicht | `e2e/programs.ts`: stale/bound/none je Program, `programsStale`; die zwei bestehenden Pins an `programExecutionView` bleiben gruen | keine |
| 3a | D1 Datenmodell + Schreiber + `GET/POST /api/self/inbox` | B-A2, B1 | `e2e/programs.ts`: Eintrag ueberlebt Succession; Pin „Inbox-Eintrag traegt kein Empfaenger-Tripel"; Check „same slot, new openedAt, sieht keine Inbox" | 2 (Messbasis) |
| 3b | D1 Report→Program inkl. `laneAutoCloseRefusal`/`decideFleetReport`/`fleetReportFrom`, neue basis-Stufe `program` | B-A1 | `e2e/watch.ts` Q3 umgezogen; Autoclose-Check: Program-adressierte Lane wird geschlossen | 3a |
| 3c | D1 Audit-rot→Program inkl. `tickAuditPing`-Rueckfall | B-A5 | `e2e/repo-worker-audit.ts`: rotes Audit landet in der Inbox des landenden Programs | 3a |
| 3d | D1 Lane-Watch-Dedupe in `openFleetReport` | B-A3 | `e2e/watch.ts`: ein Abschluss = ein Eintrag; Pin „watchId null genau fuer clarification-request und fleet-report" bleibt | 3a |
| 4 | D3 Handoff am Program (ohne Game-Maker) | B3-S | `e2e/programs.ts`: Succession ohne git-Commit, Gate auf `handoff.at`, fail-closed ohne `openedAt`, Game-Maker weiter ueber Checkpoint | 3a |
| 5 | D4 Rest: Actor, `paneModel`, Dispatch-Env | B-A8, B-A6, B-A7 | je eigener Check; Env-Schnitt per `./state.sh` | keine |

(GLM-Korrektur: das fruehere 3b war drei unabhaengige Umstellungen in einem Schnitt und zu gross
fuer eine Lane — jetzt 3b/3c/3d, jede allein landbar.)

Traeger: Program Fleet-Betrieb `f170dc46`. Die MAIN dort steht bei 29 % und vor ihrer eigenen
Succession — Schnitt 4 macht genau die billiger. Schnitt 1 und 2 sind parallel und
kollisionsfrei (verschiedene Dateien), 3a vor 3b/3c/3d (untereinander parallel, aber alle drei
in `server.ts` um `openFleetReport` — Kollisionsflaeche pruefen, im Zweifel seriell), 4 nach 3a.
Deckel 2 bleibt.

## 4. Woran man merkt, dass es gewirkt hat

- `refusedReason: "requester session ended"` kommt in `fleet.json` nicht mehr dazu (heute 6 von 21).
- Ein Lane-Abschluss erzeugt genau EINEN Inbox-Eintrag; `WATCH_MAX_PER_SLOT` wird von Reports
  nicht mehr belegt.
- Rote Audit-Zeilen ohne `fails` kommen nicht mehr dazu (heute 88 von 108).
- Reine Handoff-Commits auf main gehen gegen null; ff-lost-Lands sinken messbar
  (`lane-outcomes.jsonl`).
- `programsStale` im Owner-Poll ist null oder benennt, was zu parken ist.

# Das Program als dauerhafte Einheit — Struktur fuer die acht Befunde der Architektur-Sichtung (2026-09-04)

Entwurf des Controllers Slot 6 auf Owner-Anfrage 19:5x („denk nochmal gut nach, wie du diese am
besten strukturierst, bevor du sie angehst — vielleicht mit einem Teil neuer simplerer
Systemarchitektur oder auch mit neuen Datenschichten"). Grundlage:
`docs/messungen/2026-09-04-architektur-zusammenarbeit.md` (B-A1…B-A8) und
`docs/messungen/2026-09-04-datenschichten-audit.md` (B1, B2, B3). Status: VORSCHLAG, nicht promoviert.

## 0. Die eine Wurzel

Sieben der elf Befunde haben denselben Mechanismus: **der Bindungsschluessel ist der Occupant, die
Lebensdauer ist die des Programs.** Attention (`AttentionRequest.requester`), Report
(`FleetReport.receiver`), Event (`FleetEvent.receiver`), Watch, Auto, Mission und `mergeLast` binden
an `{slot, openedAt, sessionId}` bzw. an die Slot-Nummer. Ein Program laeuft Tage; ein Occupant
lebt Stunden, weil das 25/30-Band ihn planmaessig ersetzt. Jede Succession aendert den Schluessel,
und `teardownSlotOccupant` raeumt alles, was daran haengt — Attentions `refused`, Events
`receiver-gone`, Reports rerouten still auf Watch-Evidenz, Autos und Mission verschwinden. Das ist
B1, B-A1, B-A2, B-A3, B-A5 und B3 in einem Satz.

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
- **Report adressiert das Program:** `openFleetReport` waehlt den Empfaenger aus
  `provenance.programId`; `basis: lane-watch` bleibt nur fuer programlose Lanes. Beim Anlegen
  wird der armed Lane-Watch derselben Lane entwaffnet — ein Abschluss, ein Eintrag. Schliesst
  B-A1 (Report-Reroute) und B-A3.
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
von Hand zusammengelesen hat, um EINE Lane zu landen. Schliesst B-A1 (Sichtbarkeit). Und sie ist
die Messbasis fuer D1/D3: ohne die Projektion kann niemand belegen, dass eine Inbox leer laeuft
oder ein Handoff ankam. Eine Park-Regel (stale UND keine Lane UND leere Inbox → `parked`) wird
damit formulierbar, bleibt aber Owner-Route; ein Tick MELDET nur.

### D3 — Handoff am Program statt in git

`program.handoff {text, at, bySession}` ueber `POST /api/self/handoff`; der Gruendungsbrief der
Nachfolgerin rendert ihn. Das Succession-Gate prueft `handoff.at > session.openedAt` statt
„Commit juenger als die Session". `HANDOFF.md` in git bleibt nur fuer Sessions ohne Program
(Controller, Steward). Schliesst B3-S: die 37 % der main-Bewegungen, die heute reine
Handoff-Commits sind, entfallen, und mit ihnen der haeufigste ff-lost-Ausloeser (S2 heute:
zweiter Anlauf noetig nach 32 min gruenem Gate).

### D4 — Vollstaendige Ledger-Zeilen

Vier voneinander unabhaengige Einzelschnitte, jeder allein landbar:
- **Audit `fails[]` auch lokal** — derselbe PASS/FAIL-Scan, den der Remote-Pfad schon fuellt.
  Schliesst B-A4 (88 von 108 roten Zeilen ohne Namen; 94 von 135 Urteilen `flake`/`unknowable`).
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
| 1 | D4 Audit `fails[]` lokal | B-A4 | `e2e/repo-worker-audit.ts`: lokale rote Zeile traegt Namen | keine |
| 2 | D2 Projektion | B-A1 Sicht | `e2e/programs.ts`: stale/bound/none je Program, `programsStale` | keine |
| 3a | D1 Datenmodell + Schreiber + `GET/POST /api/self/inbox` | B-A2, B1 | `e2e/programs.ts`: Eintrag ueberlebt Succession, Pin „Inbox-Eintrag traegt kein Empfaenger-Tripel" | 2 (Messbasis) |
| 3b | D1 Zusteller umstellen: Report→Program, Audit-rot→Program, Lane-Watch-Dedupe | B-A1, B-A3, B-A5 | `e2e/watch.ts`: ein Abschluss = ein Eintrag; `e2e/attention.ts` | 3a |
| 4 | D3 Handoff am Program | B3-S | `e2e/programs.ts`: Succession ohne git-Commit, Gate auf `handoff.at` | 3a |
| 5 | D4 Rest: Actor, `paneModel`, Dispatch-Env | B-A8, B-A6, B-A7 | je eigener Check; Env-Schnitt per `./state.sh` | keine |

Traeger: Program Fleet-Betrieb `f170dc46`. Die MAIN dort steht bei 29 % und vor ihrer eigenen
Succession — Schnitt 4 macht genau die billiger. Schnitt 1 und 2 sind parallel und
kollisionsfrei (verschiedene Dateien), 3a/3b/4 seriell. Deckel 2 bleibt.

## 4. Woran man merkt, dass es gewirkt hat

- `refusedReason: "requester session ended"` kommt in `fleet.json` nicht mehr dazu (heute 6 von 21).
- Ein Lane-Abschluss erzeugt genau EINEN Inbox-Eintrag; `WATCH_MAX_PER_SLOT` wird von Reports
  nicht mehr belegt.
- Rote Audit-Zeilen ohne `fails` kommen nicht mehr dazu (heute 88 von 108).
- Reine Handoff-Commits auf main gehen gegen null; ff-lost-Lands sinken messbar
  (`lane-outcomes.jsonl`).
- `programsStale` im Owner-Poll ist null oder benennt, was zu parken ist.

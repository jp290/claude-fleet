# Self-API — Referenz (`/api/self/*`)

**Herkunft:** Referenz-Teil von `CLAUDE.md` §Self-scheduling, umgezogen 2026-08-18. Die
Prinzipal-/Scope-Regeln (wer welche Route bekommt, 409-Semantik) und die Disziplin stehen weiter in
`CLAUDE.md`; hier liegen Feldformen, Deckel, Ablehnungen und die curl-Beispiele. Bei Widerspruch
gilt der Code.

## autos — `POST /api/self/autos`

Use them to schedule a future check-in on yourself, e.g. right before you'd otherwise go idle waiting on
something:

```
curl -X POST http://<fleet-host>:<port>/api/self/autos \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"text":"check whether the CI run finished and report", "everySec":null, "inSec":1800, "idleSec":60}'
```

Field shape matches the owner's `POST /api/slots/:id/autos` exactly: `text` (the prompt to deliver),
`everySec` (interval in seconds, or `null` for one-shot), `inSec` (delay before the first/only run), `idleSec`
(only fire once the pane has been quiet this long — 0 = always). Any `slot` field you send is ignored — the
route hard-binds to whichever slot your token belongs to, so this can never be pointed at another session.
Same guard rails as the owner route apply: max 5 active schedules per slot, minimum 10s interval, mandatory
run cap.


## watch — `POST /api/self/watch`

Das Prinzip (EIN Slot, GENAU EIN Weckruf auf `laneWatchSignal`; seit `5da9c4d` auch
`{kind:"merge"}` und `{kind:"audit"}`) steht in `CLAUDE.md` §Self-scheduling. Die Referenz:

```
curl -X POST http://<fleet-host>:<port>/api/self/watch \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"target": 5, "idleSec": 60}'
```

- `target` = der Slot, auf den du wartest. `idleSec` = DEINE Ruhe-Schwelle (`0` = sofort zustellen; ist deine
  Pane beschäftigt, bleibt der Watch armed und die Nachricht verfällt NICHT).
- Ein `slot`-/`from`-Feld im Body wird ignoriert — die Route bindet hart an deinen Token-Slot, genau wie
  `/api/self/autos`. Sie kann strukturell in keine fremde Pane tippen.
- Deckel: **5 armed pro Slot** (`WATCH_MAX_PER_SLOT`, geteilt mit dem Owner-Pfad). Ein zweites Abo auf
  dasselbe Ziel gibt DENSELBEN Watch zurück (`existing:true`), nie einen zweiten.
- Ablehnungen, jede sagt „dieser Watch könnte nie feuern": `bad target` (400) ·
  `a session cannot watch itself` (400) · `target slot not active` (400) ·
  `target is not a lane — done-looking only classifies lanes` (409) ·
  `the ⚙ steward is never classified done-looking` (409) · `max 5 active watches per slot` (400). Dazu die
  Prinzipal-Ablehnung: als LANE 409 (oben).
- **Was die Nachricht ist und was nicht:** sie nennt Slot, Branch und die Fakten (`N ahead / M dirty`) und
  sagt ausdrücklich, dass „LOOKS done" ein Server-Prädikat ist und kein Bericht der Lane — die vier
  Zwillingszustände oben sind ihr nicht unterscheidbar. **Nie auf diese Nachricht allein landen.** Pane lesen.
- Stirbt das Ziel, während du wartest, wird der Watch entwaffnet statt gelöscht, mit Grund
  (`target session ended — no notification will come`) — sichtbar in `GET /api/self`. In die Pane kommt dabei
  NICHTS.


### transition — `{kind:"transition"}` (STN-1, Program b1c4a497)

Die vierte Art auf derselben Route, und die einzige, deren Auslöser kein Level des Ticks ist, sondern
ein Akt des gebundenen Supervisors. Ein non-lane Fleet-Controller registriert WAS für einen Übergang er
erwartet; der Supervisor vollendet den Watch genau einmal (unten); die Nachricht kommt über den
bestehenden FleetEvent-Transport in deine Pane, **wenn du zur Ruhe kommst** (`idleSec`).

```
curl -X POST http://<fleet-host>:<port>/api/self/watch \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"kind":"transition","idleSec":60,"deadlineSec":3600,"awaiting":"Program X wird aktiv und seine MAIN hat einmal berichtet"}'
```

- **Geschlossene Menge:** `kind` · `idleSec` (bestehende Semantik) · `deadlineSec` (Zahl in
  `[60, 86400]`, Default 3600 — `TRANSITION_DEADLINE_*` in `server.ts`) · `awaiting` (Pflicht,
  ≤ 500 Zeichen, `TRANSITION_AWAITING_MAX`). **Jedes weitere Feld wird namentlich verweigert (400)**:
  `target`, `slot`, `programId`, `delivery`, … — der Empfänger bist DU (Token-Occupant), der Vollender
  ist der gebundene Supervisor, die Zustellung ist pane-only (die Inbox ist die Owner-Operations-Inbox).
- Deckel: derselbe geteilte (`WATCH_MAX_PER_SLOT` / `FLEET_EVENT_MAX_OPEN_PER_SLOT`); keine zweite Zahl.
  Dieselbe noch armed Frage gibt `existing:true` zurück.
- Ablehnungen: als LANE 409 · über die Owner-Route `POST /api/slots/:id/watch` 409 (STN-2: die Frage stellt nur die empfangende Session selbst — sonst liefe der Owner um die Lane-Regel herum) · `no bound Supervisor exists` (409) · `the bound Supervisor occupant is
  gone or was replaced` (409) · der Supervisor selbst 409 (er ist Vollender, nicht Empfänger).
- **Ablauf:** verstreicht `deadlineSec`, entwaffnet der Tick den Watch mit `lastResult` `expired …`
  (+ Audit `watch_expire`) — **ohne Pane-Text**. Ein Watch trägt höchstens EINE Notification, und die
  ist der Übergang. Den Ablauf liest du in `GET /api/self` (`watches`).
- Der Transport ist unverändert: `pending → send-uncertain (vor tmux persistiert) → delivered` nur
  bei beobachteter Annahme; Kill-Switch/Alive-Gates; toter Empfänger → `receiver-gone`; Ack über
  `POST /api/self/events/:id/ack`.

## supervisor-watch complete — `POST /api/self/supervisor-watch/:id/complete`

Die Vollendungs-Tür, **nur für den gebundenen Supervisor** (`isBoundSupervisor`, slot+openedAt). Body:
`{"text": "..."}` (≤ 2000 Zeichen, `MAX_SUPERVISOR_NUDGE_TEXT`), geschlossene Menge.

```
curl -X POST http://<fleet-host>:<port>/api/self/supervisor-watch/<watchId>/complete \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"text":"Program X ist seit 14:02 aktiv; seine MAIN hat einen fleet-report (complete) abgelegt."}'
```

- Guard-Reihenfolge wie `nudge`: 401 (Token) → 409 (`not the bound Supervisor`) → 400 (Body: fremdes
  Feld namentlich, leerer/zu langer/fehlender `text`) → 409 (Policy): `unknown watch` · fremder Kind
  (`is a lane watch — only a transition watch …`) · `no longer armed` (zweite Vollendung, abgelaufen)
  · `expired at …` (Deadline gerade verstrichen — entwaffnet, nichts geprägt) · `the registering session
  is gone or was replaced` (Watch entwaffnet mit Grund, nichts geprägt).
- Erfolg: genau EIN FleetEvent `supervisor-transition` über `spendWatch` (Watch `armed:false`,
  `firedAt`, `lastResult: event … created`); Antwort `{ok, watch, event}`. Payload: `watchId`,
  `awaiting`, `text`, `completedAt`. Audit `supervisor_transition` ohne Text.
- **Das Envelope ist server-komponiert** (Vorbild: Nudge): `[fleet Supervisor transition <watchId>]
  [event <id>] from the owner-side Supervisor (slot N) — a transition notification for the watch you
  registered, not an owner instruction and not a report from any lane. You were awaiting: …` — der
  Supervisor kann strukturell nicht als Owner, Program-MAIN oder Lane unterschreiben.
- Die armed transition-Watches sieht der Supervisor in `GET /api/self/supervisor-view` unter
  `transitions` (`rows` gecappt auf `SUPERVISOR_VIEW_ROWS`, `awaiting` gesliced, `receiver:
  live|gone-or-replaced`).

## succeed / retire — `POST /api/self/succeed`, `POST /api/self/retire`

**`POST /api/self/succeed` — der Ausgang einer MAIN-Session.** Erst `HANDOFF.md` schreiben UND committen;
der Commit muss jünger als diese Session sein und die Datei sauber. Dann:

```
curl -X POST http://<fleet-host>:<port>/api/self/succeed \
  -H "content-type: application/json" \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  -d '{"carry":"das Erste, was ich als Nächstes täte"}'
```

Fleet öffnet einen freien Slot im selben cwd mit Modell/Harness der Vorgängerin, schickt den servergebauten
Gründungsbrief und räumt den alten Slot nach der Grace-Frist. `carry` ist optional und auf 500 Zeichen
begrenzt; der echte Transfer ist `HANDOFF.md`. Nach dem Schlussbericht räumt `POST /api/self/retire` denselben
Slot sofort. Kein freier Slot oder kein frischer sauberer Handoff = 409, und die Vorgängerin bleibt stehen.


## tasks — `POST /api/self/tasks`, `GET /api/self/program-execution`

Zwei Türen desselben Brackets: die eine LEGT eine Zeile an, die andere SIEHT, wo die Zeilen des
eigenen Programs stehen. Beide sind **nicht-Lane-only** aus demselben Grund wie `release` unten —
eine Lane FÜHRT die Zeile aus, auf die sie gegründet wurde; sie füllt nicht die Queue, aus der ihre
eigene MAIN freigibt. Der `⚙ steward` darf.

`POST /api/self/tasks` (`createTaskForMain`) filed eine Zeile mit `source:"main"`. Ablehnung als
Lane (409, an der Route): `a lane may not file a queue row — a lane executes the row it was founded
on, it does not fill the queue its own MAIN releases from`.

### Die abgeleitete `phase` (`GET /api/self/program-execution`)

Jede Zeile in `tasks.rows[]` trägt seit Slice A vier zusätzliche Felder. **Sie werden pro Request
GERECHNET und nirgends gespeichert** — kein persistiertes Feld, keine Migration, kein Backfill;
Rollback ist das Löschen der Rechnung. Die Quelle ist `program-phase.ts` (`phaseOf`), eine reine
Funktion über eine geschlossene Eingabeliste.

| Feld | Typ | Bedeutung |
|---|---|---|
| `phase` | `READY · RUNNING · REVIEWABLE · INTEGRATING · OWNER_GATE · CONTINUE · UNKNOWN` | wo die Zeile auf der Schiene sitzt |
| `phaseBasis` | `string[]` | die Regel, die entschied (`R0`…`R13`), plus bei `RUNNING` die nicht erfüllten Klauseln des Lane-Prädikats im Wortlaut von `lane-signals.ts` |
| `note` | `string \| null` | `task.note` wörtlich, **nur** wenn sie mit `waiting:` beginnt (der Satz, den der Dispatch-Tick selbst geschrieben hat) — sonst `null` |
| `candidate` | `{sha, basis: "merge-last" \| "lane-outcome" \| "none"}` | eine bereits persistierte Kandidaten-Sha, nie eine erzeugte |

**`phase` bewertet NICHTS.** Sie sagt, wo eine Zeile steht, nie ob die Arbeit gut ist. Die
semantische Hälfte bleibt, wo sie ist: der Freitext-Report mit seinem dreiwertigen Outcome, die
unabhängige Kritiker-Evidenz (lane-outcomes, der ②-Reviewer-Kontrakt, der Post-Land-Audit) und der
Owner. Und sie AKTUIERT nichts: die persistierten Übergänge schreiben weiterhin ausschließlich der
Dispatch-Tick (`queued→sent`), `landLane` (`sent→done`), der Watch-Tick (Prädikat→Event) und der
Owner (Merge-Route, Attention-Antwort).

**`UNKNOWN` ist ein WERT, kein Default-Zweig.** Es ist die Antwort, wenn eine benötigte Eingabe
fehlt, `null` oder widersprüchlich ist — eine `sent`-Zeile ohne lebende Lane (R6, Boot-Recovery),
eine Lane, deren Pane nie beobachtet wurde oder deren git-Fakten der Tick noch nicht geholt hat
(R10), eine terminale Zeile ohne `landed`-Outcome (R2). Jede solche Zeile legt zusätzlich **einen
nummerierten Satz** in das bestehende `unknown[]` der View, der die fehlende Eingabe benennt.

**Was die Reduktion NICHT liest** (und ein Pin in `e2e/pins.ts` hält es fest): `fleetReports`
(auf 20 terminale Zeilen gekappt), Pane-Text, Transcript-Bytes, `Task.brief`/`comments`,
irgendeine `lastResult`-Prosa, terminale Attention-Zeilen (ebenfalls gekappt) — und sie spawnt kein
`git`. Eine gekappte oder lebende Text-Eingabe würde dieselbe Zeile zwischen zwei GETs ohne
Faktenänderung anders projizieren; genau das ist der Falsifikator.

**Eine bekannte Lücke wird BENANNT, nicht erfunden.** Eine Lane, die dreckig mit `ahead=0` stehen
bleibt, kann `done-looking` strukturell nicht erfüllen und bleibt `RUNNING`. Die Projektion hängt
dann `idle ≥ threshold, dirty>0, ahead=0 — not reviewable by predicate` an `phaseBasis` — als
Basis-Zeile, nicht als Phase: ein `STALLED` zu erfinden wäre eine Qualitätsaussage.

**Supervisor** (`GET /api/self/supervisor-view`) bekommt davon **nur Zahlen**: `tasks.phases` ist ein
Histogramm `{Phase: count}` je Program, keine Zeilen-Bodies. Die Bodies stehen in der View der
gebundenen MAIN.

## release — `POST /api/self/tasks/:id/release`

**Die Route DISPATCHT NICHT.** Sie schreibt genau einen Übergang, `pending → queued`, und nichts
sonst; gestartet wird die Zeile weiterhin vom Tick. Jedes Gate, das entscheidet, ob eine
freigegebene Zeile wirklich LAUFEN darf, bleibt damit unberührt und beim Tick — Master-Stop und
Quiet Hours (`canDeliver`), der Repo-Deckel `DISPATCH_MAX_LANES`, der Program-Deckel
`DISPATCH_MAX_LANES_PER_PROGRAM`, das Analyse-Gate und der Kollisions-Read. Die Route weitet WER
freigeben darf. Sie weitet nichts daran, was unbeaufsichtigt laufen darf.

```
curl -X POST http://<fleet-host>:<port>/api/self/tasks/<taskId>/release \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN"
```

**Sie nimmt KEINEN Body**, und das ist eine Eigenschaft, keine Sparsamkeit: `programId` und `repo`
sind genau die zwei Felder, mit denen ein Request Arbeit außerhalb der eigenen Authority
nominieren könnte — das Program kommt aus der MAIN-Bindung (`boundProgramForMain`), das Repo aus
dem Checkout des Aufrufers (`repoKeyOf`). `/api/self/autos` ignoriert ein `slot`-Feld aus demselben
Grund; hier gibt es gar nichts erst zu ignorieren (in `e2e/pins.ts` gepinnt).

Antwort bei Erfolg: `{ok:true, sessionIdMatch, task:{id,kind,status,releasedBy,programId}}`.
`sessionIdMatch` (`exact` | `divergent` | `unknown`) wird BERICHTET, nie gegated — dieselbe Form
wie bei `/api/self/attention` und `/api/self/succeed`. `releasedBy` steht danach auf `"machine"`
(gesetzt über den Helfer `releaseTask`, nie per nackter Zuweisung), und der Trail trägt zusätzlich
ein `task_release`-Audit-Event, weil ein späterer beaufsichtigter ▸ start das Feld überschreibt.

- Deckel: **`PROGRAM_MAX_RELEASED` freigegebene, noch nicht gestartete Zeilen pro Program**
  (`FLEET_PROGRAM_MAX_RELEASED`, Default 5). Gezählt werden ausschließlich `queued`-Zeilen des
  Programs; `sent`-Zeilen sind Lanes und bereits doppelt durch die zwei Dispatch-Deckel gebunden.
  Der Deckel bindet QUEUE-TIEFE und sonst nichts.
- Ablehnungen — jede sagt in ihren eigenen Worten, was der Aufrufer zu reparieren hat:
  - **als LANE 409** (an der Route, vor dem Handler):
    `a lane may not release a queue row — releasing is the bracket above lanes`. Eine Lane FÜHRT
    die Zeile aus, auf die sie gegründet wurde; sie füllt nicht die Queue, aus der ihre eigene MAIN
    freigibt. Der `⚙ steward` darf.
  - **keine Program-Bindung** (409): `not the current bound MAIN of an active program …` — und
    getrennt davon **mehrdeutige Bindung** (409): `ambiguous Program-MAIN binding: N active
    programs name slot …`. Zwei Ablehnungen, weil sie auf zwei verschiedene Reparaturen zeigen.
  - **unbekannte Zeile** (404): `unknown task`.
  - **fremdes Program** (409): `task belongs to no program of this MAIN — a Program-MAIN releases
    only rows of program <id>`. Eine Zeile ohne Program (`programId` null) ist niemandes; für sie
    bleibt der `▸ queue`-Knopf des Owners die einzige Tür.
  - **`kind != auftrag`** (409): `a <kind> is advisory — the dispatcher never runs this` —
    wortgleich mit den zwei bestehenden Türen.
  - **Status != `pending`** (409): `task is <status> — only a pending row can be released`. Nur
    `pending → queued` ist eine Freigabe; `queued` ist schon frei, `sent` läuft, terminal ist
    Historie. **Ein wiederholter Aufruf ist damit NICHT idempotent** — er antwortet 409 mit dem
    Status, den er vorgefunden hat.
  - **kein git-Repo** (409): `this session's checkout is not a git repository — the release target
    repo cannot be derived`. Ein nicht ableitbares Repo scheitert als ES SELBST, statt still als
    „passt" durchzugehen.
  - **kein Dispatch-Repo** (409): `no dispatch repo is configured — a released row would have
    nowhere to run` (die Zeile trägt kein `repo` und `FLEET_DISPATCH_REPO` ist leer).
  - **Repo-Grenze** (409): `task targets <x> and this MAIN is bound in <y> — a release never
    reaches across repositories`. Eine freigegebene Zeile spawnt eine unbeaufsichtigte Lane im
    Ziel-Repo und isst dessen `DISPATCH_MAX_LANES`-Budget.
  - **nicht automatisierbare Harness** (409): `harness <id> is not automatable — no unattended path
    may drive it (FLEET_HARNESS_AUTOMATION off)`. Geprüft wird die Harness, auf der die Zeile
    tatsächlich landen würde (`harnessOf(DEFAULT_SPAWN.harness)`, denn `tickDispatch` ruft
    `dispatchTask` ohne `spawn`). Heute ist das der Default-Adapter, diese Prüfung kann also nie
    die sein, die ablehnt — gesagt statt zum Entdecken übriggelassen.
  - **Deckel** (409): `program release cap reached (N/M released rows not yet started) — let the
    tick start one first`.


## fleet-report — `POST /api/self/fleet-report`, `GET /api/self/fleet-report`

**Der Rückweg einer arbeitenden Lane — und die einzige Tür, durch die ihr Ergebnis die Pane
verlässt.** Gemessener Anlass:
`docs/messungen/2026-08-23-rootcause-lane-ohne-commit-und-report.md`. Jeder *mutierende* Gründungsbrief endet seit dem Return-Path-Schnitt mit derselben
deterministischen Fußzeile (`LANE_EXIT_FOOTER` in `server.ts`, an der EINEN Zusammenbaunaht in
`briefAndSend`), die drei Akte benennt: **committen → einen getypten Report filen → idle gehen.**
Eine Clarify-Lane ist ausgenommen — sie soll STOPPEN, nicht fertig werden.

```
curl -s -X POST http://<fleet-host>:<port>/api/self/fleet-report \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"status":"complete","text":"<Zusammenfassung + zitiertes Verifikationsergebnis>"}'
```

- **Der Body trägt GENAU zwei Felder**, `status` und `text`; jedes weitere ist 400
  (`body must contain only status and text`) — dieselbe Form wie bei `release`: was ein Request
  nicht nennen kann, kann er nicht erschleichen. Worker, Empfänger und Provenienz (`taskId`,
  `originId`, `programId`) stempelt der Server aus dem Slot.
- **`status` ist genau einer von drei** (`FLEET_REPORT_STATUSES` in `src/protocol.ts`, dieselbe
  Liste, aus der die Fußzeile ihren Text interpoliert):
  `complete` (die Scheibe ist fertig UND verifiziert) · `needs-main` (fertig, soweit möglich, eine
  Entscheidung steht aus) · `failed` (es hat nicht funktioniert, und die Lane sagt es).
  Alles andere ist 400 mit der erlaubten Liste im Fehlertext.
- **`text` ist PROSA für einen menschlichen Leser**, nicht-leer und ≤ `MAX_FLEET_REPORT_TEXT`
  (4000 Zeichen). Es gibt bewusst keinen JSON-Ergebniskörper: der Empfänger ist eine Session, die
  liest, kein Reducer.
- **Ein Report bewegt NIE `Task.status`.** Er legt eine `FleetReport`-Zeile plus ein
  `fleet-report`-FleetEvent an und sonst nichts — er landet nicht, deployt nicht und schließt
  keine Zeile. Wer den Status bewegt, ist der bestehende Schreiber (Tick, `landLane`, der Owner).
  Ein Report ist eine NACHRICHT.

**Empfänger-Ableitung, in dieser Reihenfolge** (`clarificationReceiverFor`, geteilt mit
`/api/self/clarifications`): **die Program-Bindung gewinnt, bevor Watch-Evidenz überhaupt gelesen
wird.** Eine gebundene Lane hat per Konstruktion genau einen koordinierenden Occupant — der Owner
hat ihn bei der Aktivierung bestätigt — also kann eine fremde, abgelaufene oder doppelte
Watch-Subscription daran nichts korrigieren, nur stören. Vorher taten genau das drei 409er, die
eine Lane von innen weder sehen noch reparieren konnte. Erst für eine Lane **ohne** Program werden
die Watch-Zeilen gelesen, und dort bleibt die Ablehnung exakt wie sie war:

- `lane-watch evidence names multiple receiver occupants` — zwei verschiedene Watch-Occupants sind
  kein Empfänger, sondern ein Münzwurf. Bleibt wortgleich (`e2e/pins.ts`, B2).
- `only legacy lane-watch evidence exists without slotOpenedAt` · `no exact clarification receiver
  evidence` — unverändert.

`basis` steht danach auf `"program-main"` (gebunden) oder `"lane-watch"` (ungebunden) und reitet in
die `fleet_report_open`-Audit-Zeile. `"program-main+lane-watch"` bleibt im `ClarificationBasis`-Typ,
weil vor dem Schnitt persistierte Zeilen ihn tragen und `loadState` gegen diese Liste validiert —
neu vergeben wird er nicht mehr.

**Weitere Ablehnungen:** MAIN und `⚙ steward` sind 409 (`not a worker lane — MAIN and the steward
cannot file a fleet report`) — es berichtet, wer ARBEITET. Hat der Empfänger kein
Zustellbudget mehr (offene Events + armed Watches ≥ `FLEET_EVENT_MAX_OPEN_PER_SLOT`, heute 5), ist
es 409 `fleet-report receiver has no FleetEvent delivery budget`.

**`GET /api/self/fleet-report`** liefert die Zeilen, in denen der Aufrufer Worker ODER Empfänger
ist — exakt an Slot, `openedAt` und `sessionId` gebunden. **Retention: `FLEET_REPORT_KEEP = 20`**
terminale Zeilen, älteste zuerst verworfen. Terminal heißt: das zugehörige Event steht auf
`acknowledged` oder `receiver-gone` — **oder es existiert nicht mehr** (`pruneFleetReports`
behandelt ein fehlendes Event als terminal, sonst hielte eine Zeile ohne Event die Liste ewig).
Eine Zeile mit noch offenem Event wird nie gepruned. Ein Report ist also kein Archiv — was bleiben soll, gehört in den
Commit.

## land — `POST /api/self/tasks/:id/land`

**Die eine Self-Route, die einen Integrations-Branch bewegt.** Eine gebundene Program-MAIN landet
eine done-looking Lane ihres EIGENEN Programs — ohne Owner-Token. Nicht-Lane-only (Lane 409,
`⚙ steward` 409, beides nie 401). **Sie liest KEINEN Body:** Program kommt aus der Bindung, die
Lane aus der Zeile, das Repo aus dem eigenen Checkout, der Kandidat aus dem HEAD der Lane. Es gibt
keine zweite Merge-Implementierung — gelandet wird durch DASSELBE `mergeJob`, das die Owner-Route
ruft (`e2e/pins.ts`: genau zwei Aufrufstellen, beide Routen, kein Tick).

```
curl -X POST http://<fleet-host>:<port>/api/self/tasks/<taskId>/land \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN"
```

Erfolg: `{running:true, task, laneSlot, candidate, sessionIdMatch, selfLand,
watch:{kind:"merge",target:<laneSlot>}}`. **Sofort danach `POST /api/self/watch` mit genau diesem
`watch`-Objekt abonnieren** — jedes nicht-grüne Ergebnis (Konflikt, rotes Verify, unbekanntes
Verify) erreicht dich über das bestehende merge-terminal-Event. Die Route macht KEINEN Retry und
öffnet KEINE Attention: was bei einem roten Land zu tun ist, ist das Urteil der MAIN.

**Die Ablehnungsleiter, in dieser Reihenfolge, jede mit eigenem Satz** (die Sätze sind
unterscheidbar, weil sie den Aufrufer an verschiedene Stellen schicken):

1. nicht gebunden · mehrdeutig gebunden — zwei verschiedene Ablehnungen, wie an allen Self-Türen.
2. **`sessionId` muss EXAKT stimmen.** Die einzige Route, die sie GATET statt sie nur zu melden:
   `slot+openedAt` allein identifiziert die Okkupation, aber Landen ist der Akt, bei dem ein
   unbestätigter Occupant kein kleineres Problem ist. Beide Seiten `null` zählt als exakt (eine
   Fleet, deren Harness keine Session-Id pinnt, kann die Route sonst strukturell nie benutzen).
3. Zeile unbekannt (404) · Zeile eines fremden Programs · `kind` nicht `auftrag` · Zeile schon
   `done` (`already landed`) · Zeile nicht `sent` · kein lebender Lane-Slot.
4. Lane-Repo ≠ eigener Checkout (`repoKeyOf`) — ein Land reicht nie über Repo-Grenzen. Ein nicht
   ableitbares Repo scheitert als ES SELBST, nie still als „passt".
5. **Policy vorhanden und nicht `off`** (§promotion). Der Satz NENNT den Zustand: `(absent)` und
   `(off)` sind unterscheidbar, weil „nie gesagt" und „ausdrücklich nein" verschiedene Dinge sind.
6. **Das Repo braucht einen EIGENEN `FLEET_VERIFY_CMD_REPOS`-Eintrag.** Das globale
   `FLEET_VERIFY_CMD` ist für das Fleet-Repo geschrieben und beendet sich außerhalb mit 42 ⇒
   `verify.ok:null` ⇒ unbekannt, und unbekannt ist nie grün. Eine Erlaubnis über ein Repo, das nur
   „unbekannt" antworten kann, wäre eine, die nie greift — also Ablehnung VOR dem Start.
7. Kandidat nicht lesbar ⇒ Ablehnung (ein unbekannter Kandidat wird nie gelandet).
8. **Duplikat:** trägt genau dieser Kandidat schon eine `fleet/land`-Note, ist er bereits auf dem
   Integrations-Branch ⇒ 409 `already landed`. Abwesende oder unlesbare Note blockt NIE — der
   Note-Schreiber ist best-effort, und „ich konnte nicht lesen" ist kein Beleg für ein Land.
9. **Der Progress-Guard, und er ist bewusst KEIN Zähler.** Abgelehnt wird ausschließlich der
   *buchstäblich unveränderte* Retry: das letzte Verdikt der Lane ist ein Nicht-Land-Verdikt, das an
   genau diesen Kandidaten gebunden ist — seither wurde nichts aufgezeichnet und der Baum hat sich
   nicht bewegt. 409 `no progress since the last verdict — repair or escalate`. Ein neuer Commit,
   ein reparierter Baum, irgendein neues Verdikt: durchgelassen. Grund (Owner-Policy 2026-08-23):
   Reparatur ist durch ein PROGRESS-BUDGET begrenzt, und wiederholte Nicht-Bewegung ist eine
   ESKALATIONSKLASSE — ein fester Versuchs-Deckel stoppt die reparierende MAIN und sagt nichts über
   die kreisende.
10. Lane nicht `done-looking` (`laneWatchSignal`, `MERGE_IDLE_MS`) — lebendig, idle, sauber, ahead.
    Ein Server-Prädikat über Fakten, keine Aussage über die Qualität: die liefert die MAIN, indem
    sie überhaupt ruft.
11. Nicht inflight — dieselbe Reservierung (`mergeStart`/`mergeInflight`), die die Owner-Route
    hält, plus `commitInflight`. Zwei Türen, ein Job pro Lane.
12. Ungeprüfte Konfliktlösungen in der Lane (die ⏸-Sperre) sind hier eine ABLEHNUNG, nicht ein
    Land: `green-only` landet sie nie.

**Trail:** ein Start schreibt `self_land_start` (Slot, Zeile, Program, Lane, Kandidat, Sprosse) —
die einzige Zeile, die sagt, dass eine MAIN GEFRAGT hat, auch wenn das Gate danach rot war. Keine
Ablehnung schreibt sie (in `e2e/programs.ts` als Gegenprobe geprüft).

## promotion — `POST /api/programs/:id/promotion` (OWNER-Route, nicht `/api/self/*`)

Sie steht hier, weil sie die eine Erlaubnis erteilt, die eine Session an anderer Stelle VERBRAUCHT
(§land) — aber sie ist eine **Owner-Route hinter `tokenGate`**: ein Self-Token bekommt hier 401,
nicht 409. Das ist Absicht und die ganze Pointe des Records: eine Session, die ihn schreiben
könnte, würde sich ihre eigene Land-Autorität erteilen. Genau EIN Schreiber im Server
(`e2e/pins.ts` pinnt es), und kein Loader legt ihn je an.

```
curl -X POST http://<fleet-host>:<port>/api/programs/<program>/promotion \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"policy":{"v":1,"selfLand":"guarded"}}'      # erteilen
curl -X POST http://<fleet-host>:<port>/api/programs/<program>/promotion \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"policy":null}'                              # widerrufen (idempotent)
```

**Der Record ist geschlossen und versioniert:** `{v:1, selfLand:"off"|"green-only"|"guarded"}`.
`confirmedAt` stempelt der Server — ein Wert von der Leitung würde den Owner-Akt datieren lassen.
Der Body liest ausschließlich `policy`; jeder weitere Top-Level-Key ist 400, jeder unbekannte Key
INNERHALB der Policy ebenso, `v !== 1` ebenso, ein `selfLand` außerhalb der Liste ebenso. Nichts
wird still verworfen: ein ignoriertes Feld ist ein Feld, das der Owner für berücksichtigt hält.

**Die drei Sprossen, und die Abwesenheit als vierte:**

| Wert | Was eine gebundene Program-MAIN darf |
| --- | --- |
| *(kein Record)* | nichts — Owner-only, die Legacy-Form jedes Programs |
| `"off"` | nichts, aber der Owner hat es AUSGESPROCHEN (unterscheidbar von „nie gesagt") |
| `"green-only"` | ein sauberes, grünes Land der eigenen Zeile über §land |
| `"guarded"` | zusätzlich: einen agent-AUFGELÖSTEN Konflikt bestätigen, mit frischem Verify |

**Der Loader degradiert zur ABWESENHEIT, nie feldweise.** Alles, was kein exakter v1-Satz ist —
unbekannter Key, falsche Version, unbekannter Wert, fehlender oder absurder Stempel —, lädt als
„der Owner hat nichts erteilt". Eine halbe Erlaubnis ist keine schwächere, sondern eine andere.

**Trail:** jede Erteilung und jeder echte Widerruf schreibt `program_promotion`. Ein Widerruf auf
einen ohnehin abwesenden Record ist `ok:true` ohne Zeile — es gibt nichts zu datieren.

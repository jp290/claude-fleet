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

# Self-API — Referenz (`/api/self/*`)

**Herkunft:** Referenz-Teil von `CLAUDE.md` §Self-scheduling, umgezogen 2026-08-18. Die
Prinzipal-/Scope-Regeln (wer welche Route bekommt, 409-Semantik) und die Disziplin stehen weiter in
`CLAUDE.md`; hier liegen Feldformen, Deckel, Ablehnungen und die curl-Beispiele. Bei Widerspruch
gilt der Code.

## gate — `GET /api/self/gate`

Liefert die Gate-Konfiguration dieser Lane plus die aktuell gemessene Suite-Mutex-Sicht. `suiteLock`
ist `null`, wenn kein Lock-Verzeichnis existiert; sonst trägt es `state`
`held|overdue|stale|parked|unknown`, `pid`, `alive`, `identityProven`,
`birth{stored,current,state}`, `acquiredAt`, `ageMs`/legacy `heldMs`, `nextAction`, `reason` und
`effect`. `held`/`overdue` verlangen eine live PID und passenden Prozess-Geburtsabdruck; live PID
mit anderem Abdruck ist `stale` und durch den nächsten Contender reapbar; live PID mit fehlendem,
leerem, malformed oder unmessbarem Abdruck ist `unknown` und wird nicht automatisch gereapt.

**`helper` — gibt es überhaupt eine zweite Maschine?** Dasselbe Objekt, das die Suite-Offer-Tür
mitliefert, aus derselben Lesung: `online` (boolean) · `name` (der Name des ZULETZT gehörten
Geräts, `null` wenn nie eines registriert war) · `mode` (dessen eigene letzte Selbstauskunft,
`null` = hat nie eine gegeben) · `lastSeenAgeMs` (`null` NUR wenn es kein Gerät gibt — nie
„nicht nachgesehen"). `online` ist ALLEIN die Uhr: `lastSeen` jünger als `DEVICE_ONLINE_MS`
(`server.ts#DEVICE_ONLINE_MS`, Default 90 000 ms, `FLEET_DEVICE_ONLINE_MS`). Der `mode` steht
DANEBEN statt eingerechnet: ein Gerät, das schlägt und `quiet` sagt, ist da und nimmt nichts —
und das ist ein anderer Fall als „niemand da", weil nur im ersten Warten etwas bringt. Das ist
absichtlich NICHT `helperClaimCandidateExists` (die strengere Lesung der Audit-Gnadenfrist).

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
- Deckel: **5 armed pro Slot** (`WATCH_MAX_PER_SLOT`, geteilt mit dem Owner-Pfad). Ein zweites noch
  armed Abo auf dasselbe Ziel gibt DENSELBEN Watch zurück (`existing:true`), nie einen zweiten.
- Ablehnungen, jede sagt „dieser Watch könnte nie feuern": `bad target` (400) ·
  `a session cannot watch itself` (400) · `target slot not active` (400) ·
  `target is not a lane — done-looking only classifies lanes` (409) ·
  `the ⚙ steward is never classified done-looking` (409) ·
  `harness <id> is not automatable — its slot never reads as alive to the done-looking predicate, so
  this watch could never fire` (409, nur `{kind:"lane"}`: `aliveInfo` faltet `harnessAutomatable` in
  `alive`, beide Looking-Prädikate verlangen `alive === true` — ein abgelehnter Harness kann nie
  klassifizieren; `{kind:"merge"}` liest den Merge-Terminalfaktor, nicht `laneSignalView`, und bleibt
  erlaubt) · `max 5 active watches per slot` (400). Dazu die
  Prinzipal-Ablehnung: als LANE 409 (oben).
- `{kind:"merge"}` bleibt beim ersten späten Abo level-getriggert: ein persistiertes Terminal feuert
  sofort. Hat dieses Terminal für denselben Empfänger bereits einen Watch gefeuert, wird ein
  erneutes Abo ohne neueren laufenden Merge mit 409 abgelehnt, statt den verbrauchten Watch als
  `existing:true` zurückzugeben oder das alte Terminal erneut zuzustellen. Sobald ein neuer Merge
  reserviert oder läuft, entsteht dagegen genau ein neuer armed Watch; dessen Duplikat bleibt
  idempotent und gibt seine neue ID mit `existing:true` zurück.
- **Was die Nachricht ist und was nicht:** sie nennt Slot, Branch und die Fakten (`N ahead / M dirty`) und
  sagt ausdrücklich, dass „LOOKS done" ein Server-Prädikat ist und kein Bericht der Lane — die vier
  Zwillingszustände oben sind ihr nicht unterscheidbar. **Nie auf diese Nachricht allein landen.** Pane lesen.
- Stirbt das Ziel, während du wartest, wird der Watch entwaffnet statt gelöscht, mit Grund
  (`target session ended — no notification will come`) — sichtbar in `GET /api/self`. In die Pane kommt dabei
  NICHTS.
- **Stirbt das Ziel, NACHDEM der Watch gefeuert hat, das Event aber noch nicht zugestellt ist**
  (deine Pane war beschäftigt, ein Owner-Draft stand im Composer), wird das Event terminal als
  `subject-gone`: nie gepastet, nie ackbar (409), und es belegt kein Zustellbudget mehr. Es ist
  ausdrücklich NICHT `receiver-gone` (du lebst) und NICHT `acknowledged` (du hast nichts gelesen).
  Grund, gemessen am 2026-08-30 (Event `e1ff06ac9911f854e752d71a`): ein lane-ready-Event hielt sich
  2005 Ticks lang, während seine Lane landete und ihr Slot recycelt wurde — und tippte sich Stunden
  später über eine Lane in die Pane, die es nicht mehr gab. Ein Event, dessen Subjekt noch LEBT und
  identisch gebunden ist, bleibt dagegen `pending` und wird zugestellt, sobald dein Composer frei
  ist. Ein Halt am belegten Composer zählt dabei NICHT als Zustellversuch (`attempts` bleibt stehen;
  gezählt werden Holds als `fleet_event_held` im Audit-Trail).
- **Ein Abo, das du nicht selbst gemacht hast: der terminale Land einer Lane deines Programs.** Landet
  irgendwer — Owner ⏏, Owner ⏫, ein Confirm — eine Lane, deren Task zu einem aktiven Program mit
  GEBUNDENER, lebender MAIN gehört, armt der Server dieser MAIN im letzten Moment vor dem Teardown
  genau den merge-Watch, den sie selbst gemacht hätte (`server.ts#armProgramMainLandWatch`), und
  `mintMergeEvents` gibt ihn sofort aus. Es ist dasselbe merge-terminal-Event wie sonst, occupant-
  gebunden (Slot + openedAt + sessionId), über dieselbe Transportschiene. GENAU EINES: ist bereits ein
  passender Watch armed, wird nichts daneben gearmt; ein fremdes Program, ein recycelter/nachgefolgter
  MAIN-Slot und eine Lane ohne Program bekommen NICHTS; ist das Zustellbudget der MAIN voll, wird
  nichts gearmt und die Stille steht als `program_main_land_event_skipped` auf dem Trail. Grund:
  bis 2026-08-29 erfuhr eine MAIN, deren eigene Land-Tür zu war, von einem Owner-Land gar nichts und
  blieb auf veralteter Ausführungswahrheit stehen (Program f99e9354, Task 8e91fdc9).


### job — `{kind:"job", target:"<jobId>"}` (Dual-Host S2, R5)

Die Art für einen **Remote-Command-Job** (`POST /api/self/jobs`, unten) auf derselben Route. Subjekt
ist ein JOB, nicht ein Slot: `target` ist die 12-Hex-Job-Id, gespeichert wird sie als `jobId` — ein
Slot-`target` ist eine Zahl, und zwei Bedeutungen auf einem Feld sind der Weg, wie ein Watch über das
falsche Subjekt feuert.

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"kind":"job","target":"<jobId>","idleSec":0}' \
  http://<fleet-host>:<port>/api/self/watch
```

- Feuert **genau einmal**, beim Verdikt, und **dreiwertig** — dieselbe geteilte Klassifikation, die
  jedes Remote-Ergebnis benutzt (`server.ts#remoteVerdictOf`): exit 0 = `green`, exit ≠ 0 = `red`,
  kein Exit-Code / 126 / 127 / `VERIFY_SKIP_EXIT` = `unknown` mit `reason`. Ein Timeout ist ein
  `unknown`, nie ein Rot.
- **Level-getriggert** wie `merge` und `audit`: ein Abo NACH dem Verdikt feuert sofort aus dem
  persistierten Fakt. Und jeder Ausgang produziert einen: läuft die Claim ab oder stirbt die
  anbietende Session, setzt der Sweep selbst ein `unknown`-Verdikt — ein Job kann nicht enden, ohne
  dass der Watch etwas zu sagen hat.
- Die Nachricht nennt `result`, `cmd`, den Exit-Code und die **Artefakt-Zeilen** (Pfad, sha256, Bytes,
  die ersten acht namentlich) — und sagt ausdrücklich, dass die Dateien im Klon gehasht und **nicht
  hochgeladen** wurden.
- Ein zweites Abo auf denselben Job gibt den ersten Watch zurueck (`existing:true`) — solange er
  ARMED ist. Ein SPENT Watch wird nie als `existing` geliefert: er hat seinen Satz schon gesagt, und
  ein neues Abo danach ist eine neue Frage, die der Level-Trigger sofort beantwortet.
- Ablehnungen: `target must be a 12-character command job id` (400) ·
  `no such command job — it was never offered, or it has been evicted` (409, das Register hält
  `COMMAND_JOB_KEEP` = 20 settled Zeilen).
- **Die Nicht-Lane-Regel gilt unverändert.** Diese Art fügt der Route eine `kind` hinzu, keinen
  Prinzipal: eine Lane bekommt weiter 409 `a lane may not subscribe`. Will eine Lane auf ihren
  eigenen Command-Job geweckt werden, muss der Owner den Watch über `POST /api/slots/:id/watch`
  setzen — oder die Lane liest `GET /api/self/jobs/:id`.

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
  bei beobachteter Annahme; Kill-Switch/Alive-Gates; toter Empfänger → `receiver-gone`; toter
  SUBJEKT-Lifecycle → `subject-gone` (terminal, nie gepastet, nie ackbar, kostet kein Budget); Ack
  über `POST /api/self/events/:id/ack`.

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
begrenzt; der echte Transfer ist `HANDOFF.md`. **`model` und `effort` sind optional (seit 2026-09-02):**
abwesend = wörtliche Vererbung aus dem Datensatz der Vorgängerin; vorhanden = der Nachfolger wird darauf
geöffnet, validiert exakt wie `open`/`dispatch` gegen die geerbte Harness (`MODEL_RE` bzw.
`HARNESS_MODEL_RE`, Effort aus `effortLevels` des Adapters), ungültig = 400 und KEIN Slot geöffnet;
ein vorhandenes `null`/`""` löscht (Modell → Fleet-Default, Effort → kein Flag). Die Harness selbst ist
nicht überschreibbar. Gilt für alle drei Nachfolge-Pfade (generisch, Supervisor, Program-MAIN). Der Anlass:
eine MAIN, die per `/model` in der Pane gewechselt hat, bekam ihren Nachfolger auf dem Spawn-Wert des
Datensatzes — den korrigiert für einen LEBENDEN Slot die Owner-Route unten (§model). Nach dem Schlussbericht räumt `POST /api/self/retire` denselben
Slot sofort. Während `succeed` läuft, antwortet `retire` für exakt diese Session 409. `succeed` hält ab
Request-Eintritt `{slot, openedAt, cwd, selfToken}` fest und prüft diese Identität nach dem Git-Handoff-
Await erneut; Owner-Kill/Recycling bleibt erlaubt, kann den alten Request aber nicht auf die generische
Nachfolge umlenken. Kein freier Slot oder kein frischer sauberer Handoff = 409, und die Vorgängerin bleibt
stehen.


## Program-MAIN-Ausführungsschiene (der Gründungsbrief benennt sie)

**Was neu ist, ist der TEXT, nicht der Mechanismus.** Die Türen unten gab es alle schon; bis
2026-08-24 endeten alle vier Program-MAIN-Gründungsbriefe (Fleet-Frame und Ziel-Repo-Frame, jeweils
Bootstrap und Nachfolge) bei „choose the next smallest bounded Program act" und nannten keine
einzige. Gemessene Folge: zwei Ziel-Repo-MAINs (iOS, Tower) bauten das GANZE Produkt im eigenen
Checkout, weil sie nie erfuhren, dass eine Worker-Lane zur Verfügung steht, und die Tower-MAIN legte
ihren ersten Worker erst an, nachdem der Owner ihr die Routen von Hand in die Pane getippt hatte. `PROGRAM_MAIN_RAIL_BLOCK` in `server.ts` ist dieser Text — EIN
Block, byte-identisch in allen vier Varianten, angehängt zwischen Program-JSON und Anker-Block.

**Was er sagt** (Reihenfolge ist die Schiene, nicht eine Empfehlung):

- **Adresse und Credential zuerst.** `http://<fleet-host>:<port>` — der Server rendert seine EIGENEN
  `HOST`/`PORT` in den Brief — und der Header `x-fleet-self-token: $FLEET_SELF_TOKEN`, der in jeder
  Pane schon exportiert ist. Der Falsifikator, den das schließt: eine frische MAIN, die Quelltext,
  Prozessliste oder State-Datei nach Fleets Adresse durchsucht.
- **`GET /api/self/program-execution` ist die Lebenszyklus-Projektion** — `phase`, `phaseBasis`,
  `candidate`, `nextAction`, `unknown[]`. Gelesen statt geraten, vor jedem Akt.
- **Die Rollenteilung ist ein URTEIL, keine Mauer** (Owner-Korrektur 2026-08-24: kein Pauschalverbot,
  intelligence-first bounded autonomy bleibt). Inspizieren, entscheiden, zerlegen, briefen, Diff
  prüfen, gewöhnliche Konflikte auflösen und integrieren gehören in die MAIN-Pane — und **kleine,
  reversible, risikoarme Änderungen im bestätigten Scope** darf die MAIN dort auch direkt machen,
  wenn Delegieren teurer wäre als die Änderung: knappe Steuerungs-/Doku-Edits, winzige
  Integrations-Glue, gewöhnliche Konfliktauflösung, eine eng beobachtete Verifikations-Reparatur.
  In eine **isolierte Worker-Lane** gehören substanzielle Produkt-Implementierung, breite oder
  parallele Arbeit, Spezialistenarbeit, Arbeit, die frische Kritik will, und Arbeit, deren
  unabhängige Evidenz/Isolation materiell zählt. **Kein Posture-Enum, keine Größenschwelle, keine
  Entscheidungstabelle, kein neuer Zustand** — genau das wäre die Haltung, die die Korrektur
  ausschließt. Jedes Urteil darin bleibt das der MAIN; wer jeden kleinen Edit durch einen Worker
  routet, ist zum Scheduler geworden.
- **Game-Maker-Preflight vor jeder Implementierung eines neuen Game Programs.** Die selektierte
  Rollenhälfte benutzt nur die vorhandenen Türen, in dieser Reihenfolge: **Architect -> 0-2 named
  fact/risk probes -> fresh independent cross-model Review -> MAIN `ACCEPT|RETHINK|OWNER`**. Der
  Architect committed genau eine DRAFT `GAME-CARD.md` mit 1–4 ausführbaren First-Slice-Briefs
  (Abhängigkeiten, exklusives Write-Set, Stop, Done, literales Verify). Der Reviewer sieht nur
  Owner-Program, Repository, Architect-SHA und benannte Probe-Fakten, nie Chat oder Rationale. In
  diesem bestätigten Scope darf sein isolierter Review-Act Card und Briefs optimieren, committed die
  finale Fassung und meldet bei Annahme `ACCEPT <final-card-sha>`. Vor `ACCEPT` wird keine
  Implementierungszeile angelegt oder freigegeben. **THIS PREFLIGHT IS A BINDING ROLE OBLIGATION,
  NOT A SERVER GATE; EXISTING DOORS DO NOT AUTHORIZE A BYPASS.** Die technisch erreichbaren Filing-,
  Release-, Land- und direkten Checkout-Türen zertifizieren kein `ACCEPT` und geben keine
  Rollenautorität zum Überspringen. Bei `ACCEPT` vergleicht MAIN den live Reviewer-HEAD mit dem
  gemeldeten SHA und landet exakt diesen Commit. Fehlt die Self-Land-Promotion, landet der Owner
  exakt diesen Reviewer-Commit über das Board. Erst nach Beobachtung des Lands schreibt und
  vergleicht MAIN einen auditierbaren Beleg im normalen Program-Report oder einer getrackten
  Entscheidung: **Architect task/model/SHA, Reviewer task/model/reported SHA, and actual landed SHA**.
  Fleet does not assemble or prove this receipt; ohne Vergleich bleibt das Ergebnis `unknown`.
  Danach kopiert MAIN seine Briefs verbatim und released nur wurzelnde, abhängigkeitfreie Zeilen.
  `RETHINK` und
  `OWNER` landen keine finale Card und erzeugen keine Implementierungszeile; `RETHINK` braucht neue
  benannte Evidenz statt einer Review-Schleife, `OWNER` eskaliert. Ein Direct Slice ist nur für ein
  kleines Feature innerhalb eines akzeptierten Game-Scopes mit akzeptierter Card zulässig; er muss
  nicht zu den benannten First Slices der Card gehören, wenn er bounded, reversibel, risikoarm und
  ohne Core-Contract-Änderung bleibt. Ein vom Owner bestätigter Core-Pivot oder ein neues Spiel in
  einem bestehenden Program startet einen neuen Preflight. **SENSORY CRITIC IS POST-PLAY ONLY**: der Operator
  orchestriert einen frischen Blick mit einem versiegelten Build-/Launch-/Real-Input-/Capture-Pack;
  Game Card, `HANDOFF.md`, Hypothesen und Rationale bleiben draußen. Hashes identifizieren nur die
  versiegelten Bytes; Blindheit und Zustellung bestätigt der Operator, sonst bleiben sie `unknown`.
- **Die Schleife:** bounded Akt wählen → für einen Akt, der nach dem Urteil oben eine Lane will,
  `POST /api/self/tasks` mit EXPLIZITEM `kind:"auftrag"` und
  bewusst gewähltem Spawn-Triple (`harness`/`model`/`effort`; der Default `notiz` läuft nie) →
  `POST /api/self/tasks/:id/release` → **die Antwort ist ein QUEUE-FAKT, keine Lane** (kein Slot,
  kein Branch, keine Worker-Identität; wer darauf wartet, wartet auf nichts) → **warten ohne
  beobachten**: der typisierte Worker-Report und jedes terminale Event kommen von selbst in die Pane,
  kein Pane-/tmux-Polling → den Report als BEHAUPTUNG lesen und Diff plus zitierten Prüfausgang
  selbst ansehen → landen **nur wenn die Projektion es zuteilt** (`nextAction` nennt
  `POST /api/self/tasks/:id/land`; ohne Promotion nennt sie das Board, und dann landet der Owner) →
  das zurückgegebene `watch:{kind:"merge",…}` abonnieren, bei `landed=YES` danach
  `{kind:"audit",repo,mainAfter:<candidate>}`.
- **Wo es endet:** weiter bis PLAYABLE-Evidenz — ein Artefakt, das ein Mensch ausführen kann und das
  die MAIN laufen gesehen hat — oder bis zu einem konkreten Blocker bzw. einer Owner-Grenze
  (Scope-Wachstum, irreversible Richtung, externe Wirkung/Kosten, Deploy/Release, deklariertes
  Geschmacks-Gate). **PLAYABLE heißt nicht owner-playtested**, und es so zu berichten ist eine
  Falschaussage. An genau dieser Grenze — und nur dort — GENAU EINE `POST /api/self/attention`. Ein
  gewöhnliches sauberes, grünes In-Program-Land ist keine Grenze, sondern der eigene Akt der MAIN.

**Was der Block NICHT tut:** keine neue Route, kein neues Schema, kein Timer, kein persistierter
Zustand. Der Context-Receipt-`hash` bleibt die Kette über `anchorBlock` + `planFacts` und ändert
sich nicht; `briefHash`/`deliveredBytes` beschreiben die ausgelieferten Bytes und wandern mit dem
Block mit — genau das ist ihr Vertrag. Rückweg: die Konstante wieder aus den beiden Buildern
nehmen.

## tasks — `POST /api/self/tasks`, `GET /api/self/program-execution`

Zwei Türen desselben Brackets: die eine LEGT eine Zeile an, die andere SIEHT, wo die Zeilen des
eigenen Programs stehen. Beide sind **nicht-Lane-only** aus demselben Grund wie `release` unten —
eine Lane FÜHRT die Zeile aus, auf die sie gegründet wurde; sie füllt nicht die Queue, aus der ihre
eigene MAIN freigibt. Der `⚙ steward` darf.

`POST /api/self/tasks` (`createTaskForMain`) filed eine Zeile mit `source:"main"`. Ablehnung als
Lane (409, an der Route): `a lane may not file a queue row — a lane executes the row it was founded
on, it does not fill the queue its own MAIN releases from`.

### Der abgeleitete Program-Status (`GET /api/self/program-execution`)

Jede Program-Zeile trägt `status`: eine pro Request berechnete Sicht, die nichts speichert und
nichts bewegt. `main {slot, occupancy, sessionIdMatch}`, `attention {open}` und
`lanes {running, queued, waiting}` stammen aus dem aktuellen Speicherzustand. `lastLand` liest die
neueste gelandete Outcome-Zeile des Programs; `lastAudit` verbindet deren `mainAfter` mit dem
Audit-Trail und seiner Adjudikation. Wo kein passender Fakt existiert, steht `null` — nie ein
erfundener Erfolg. `deploy` erscheint nur, wenn der letzte Land in genau dem Checkout liegt, den
der Server selbst vermisst (`REPO_DIR`, also `FLEET_REPO_DIR` oder das Verzeichnis von
`server.ts`) — sonst `null`, denn `codeBehind` ist ein Fakt ÜBER diesen Checkout und über keinen
anderen. Gelesen wird der bereits gecachte Wert vom git-Tick; die View startet kein `git`, und
solange der Cache leer ist, ist `codeBehind` `null` (unbekannt), nie `false`.

Die gepollte Owner-Liste `GET /api/programs` öffnet keine Ledger. Sie trägt dieselbe
Speicherhälfte unter `executionStatus`; der Name ist absichtlich verschieden, weil `status` dort
bereits der persistierte Program-Lebenszyklus (`proposed|confirmed|active|complete`) ist.
`lastLand`, `lastAudit` und `deploy` sind in dieser Liste weggelassen. Der Owner-Poll
`GET /api/sessions` trägt `programsStale` nur, wenn mindestens ein aktives Program eine stale
MAIN-Bindung hat; bei null ist das Feld wegen des Poll-Budgets abwesend.

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
    tatsächlich landen würde, und das ist die EIGENE persistierte Spawn-Wahl des Rows:
    `releaseTaskForMain` fragt `harnessAutomatableFor(harnessOf(taskSpawnOf(t).harness))` — genau
    den Adapter, den `tickDispatch` dieser Zeile mitgäbe. Eine Zeile ohne eigene Wahl fällt auf
    `DEFAULT_SPAWN` zurück, und dort lehnt diese Prüfung nie ab; eine Zeile mit gespeicherter
    fremder Wahl wird HIER abgelehnt, statt freigegeben ewig zu warten (real gesehen an einer
    pi-zai-Zeile).
  - **Deckel** (409): `program release cap reached (N/M released rows not yet started) — let the
    tick start one first`.


## jobs — `POST /api/self/jobs`, `GET /api/self/jobs/:id`

Arbeit von hier nach dort auslagern, mit Quittung. Eine Session übergibt ihren **eigenen Baum** und
eine **erlaubte Kommandozeile** an ein Helfer-Gerät; zurück kommt ein Exit-Code, ein Log-Tail und ein
**Artefakt-Verzeichnis** (Pfad, sha256, Bytes). In diesem Schnitt wird **nichts hochgeladen** — die
Quittung NENNT die Dateien, sie liefert sie nicht.

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"cmd":"bun run build","timeoutMs":900000,"artifacts":["dist/*.js"]}' \
  http://<fleet-host>:<port>/api/self/jobs
# -> {"jobId":"<12 hex>","job":{...}}
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/jobs/<jobId>        # Zustand + Quittung
```

**Nicht lane-only, und das ist eine Entscheidung, kein Versehen.** Die vier lane-only Routen sind es,
weil ihre Antwort außerhalb einer Lane undefiniert ist (`drift`, `gate`, `criterion`,
`verify-intent`); `watch` ist nicht-lane-only, weil eine Lane, die auf eine Lane wartet, eine
Kopplung ist, die nur der Owner sichtbar machen kann. **Beides trifft hier nicht zu:** eine Lane, die
ihre eigene Suite auslagert, ist genau der Fall, den der Owner gewollt hat, und eine MAIN, die einen
Build auslagert, ist derselbe Akt mit anderem cwd. Beide übergeben ihren EIGENEN Baum und warten auf
ihre EIGENE Quittung — keine zweite Session ist beteiligt.

**Der Body ist die Perimeter, und er ist drei Felder breit.** Repo, Branch, cwd und Slot kommen aus
der Token-Zeile und können vom Aufrufer nie benannt werden.

- `cmd` (Pflicht) muss ein **exakter Schlüssel der Allowlist** sein (`server/types.ts`
  `HELPER_CMD_ALLOW`): `bun run build` · `bun test` · `bun run verify` · `./e2e-isolated.sh` ·
  `./e2e-security.sh` · `bun e2e/pins.ts`. Der Wert des Eintrags ist die **argv** — der Helfer
  exec't sie direkt, es gibt auf dem Weg **kein `sh -c`**, kein Quoting, kein Glob, kein `&&`.
- **Ein `cmd`, das `claude`, `codex` oder `pi` als Token enthält, wird IMMER mit 400 abgewiesen** —
  vor der Allowlist und unabhängig von ihrem Inhalt (`./claude`, `/usr/bin/codex`, `bun claude`
  zählen alle). Ein Fleet, das eine Agenten-Harness an ein Helfer-Gerät posten kann, hätte
  Remote-Agent-Spawn als Nebenwirkung eines Build-Runners erfunden. Der 400 hinterlässt **keine
  Zeile**: die Verweigerung und die Abwesenheit von etwas Claimbarem sind eine Tatsache, nicht zwei.
- `timeoutMs` (optional, Default 900 000) in `[10 000, 3 600 000]`.
- `artifacts` (optional) sind **Globs relativ zum Klon**, max. 20, jeder relativ und ohne `..`. Der
  Helfer expandiert sie NACH dem Lauf, hasht bis zu 50 Dateien und schickt `{path, sha256, bytes}`.
  Eine leere Liste ist eine legitime Antwort (nichts angefragt, oder nichts getroffen) und nie ein
  Fehlschlag — getrennt wird das allein durch `exitCode`.

**Der Baum ist der ARBEITSBAUM**, genommen per `git stash create` wie beim `suite-offer`: uncommitted
Arbeit reist mit, untracked Dateien nicht (ihre Zahl steht als `untracked` auf dem Job).

**Der Job wird nur einem Gerät angeboten, dessen Heartbeat `daemonSha` trägt.** Das ist eine
Fähigkeits-Lesung, kein Versionsvergleich: ein Daemon, der seinen eigenen Baum misst, ist die
Generation, die auf `kind` verzweigt. Ein älterer würde `cfg.suiteCmd` auf einem Command-Job fahren —
ein Grün über ein Kommando, das niemand verlangt hat. Der Claim lehnt so ein Gerät zusätzlich mit 409
ab (die Job-Liste allein ist kein Tor).

Deckel: **3 offene Command-Jobs pro Session** (409), 20 settled Zeilen im Register.
`GET /api/self/jobs/:id` antwortet nur der anbietenden Session (sonst 404, nie fremde Arbeit).

## suite-offer — `POST/GET /api/self/suite-offer`, `POST /api/self/suite-offer/withdraw`

**Die fünfte lane-only Route** (Scope-Regel wie `drift`/`gate`/`criterion`/`verify-intent`: eine
Nicht-Lane bekommt 409 `not a lane — a suite offer hands over a lane's own working tree`, nie 401).
Sie bietet den eigenen `./e2e-isolated.sh`-VORSCHAULAUF dem Remote-Helfer-Portal an, statt den
einen Suite-Mutex dieser Maschine dafür zu halten. Anlass und Messungen:
`docs/attic/helper-lane-suiten-entwurf-2026-08-26.md`.

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/suite-offer
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/suite-offer          # Zustand + Verdikt
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{}' http://<fleet-host>:<port>/api/self/suite-offer/withdraw
```

**Der Body des Angebots ist geschlossen** — dieselbe Bauart wie `POST /api/self/tasks/:id/release`:
Repo, Branch, cwd und Slot kommen aus der Token-Zeile, das Kommando ist `./e2e-isolated.sh` fest.
Kein Feld kann nominieren, WELCHER Baum gebündelt wird. `withdraw` liest genau ein Feld, `abandon`.

**Ein offenes Angebot pro Slot.** Ein zweites POST gibt das bestehende zurück (`existing: true`),
das Muster von `createWatchForSlot`.

**KEIN ANGEBOT OHNE HELFER.** Ist beim POST kein Gerät online (`helper.online === false`, dieselbe
Lesung wie in `/api/self/gate`), antwortet die Tür **200** mit `{"offer": null, "reason": "no helper
online", "helper": {...}}` und mintet nichts. Vorher bekam eine Lane in einer Flotte, in der nichts
schlug, ein offenes Job-Objekt und wartete danach `SUITE_OFFER_WAIT_FREE_MS` (180 s) auf einen
Claim, der nicht kommen konnte — die Regel „biete den Lauf an, WENN ein Helfer-Gerät online ist"
war von innen nicht prüfbar. Sie ist es jetzt, in einem Roundtrip. Zwei Feinheiten, beide Absicht:

- **200, kein 4xx** — es ist nichts schiefgegangen, und ein Fehlerstatus schickte die Lane auf die
  Suche nach einem Defekt.
- **Die Reihenfolge:** der `existing`-Zweig läuft ZUERST und unbedingt. Eine Lane muss ihr eigenes
  offenes Angebot immer wiederfinden, und ein Helfer, der nach dem Mint verstummt, mintet es nicht
  zurück. Die Sperre steht vor dem MINTEN und vor nichts sonst. Ein schlagendes, aber `quiet`
  gemeldetes Gerät bekommt das Angebot weiterhin — `quiet` ist ein Zustand, den sein nächster
  Herzschlag verlassen kann; `helper.mode` reist mit, damit die Lane das selbst lesen kann.

**Was der Server aufnimmt, und wann.** Erst beim CLAIM, in `buildLaneSuiteBundle`: `git stash
create` (leer bei sauberem Baum ⇒ `HEAD`) → transientes `refs/heads/fleet-suite/<jobId>` →
`git bundle create` → `finally` `update-ref -d`. Der Stash-STACK bleibt unberührt (gemessen 0/0),
was der Grund ist, dass das trotz des `git stash`-Verbots in `CLAUDE.md` zulässig ist. **Untracked
Dateien reisen NICHT mit**; ihre Zahl steht als `untracked` im Job, damit ein grünes Verdikt nicht
über einen anderen Baum spricht als die Lane meint.

**Antwortfelder von `GET`:**

- `offer` — `null`, wenn diese Lane noch nie eines gemacht hat, sonst:
  `id` · `state` (`open|claimed|reported|withdrawn|abandoned|lapsed|reaped`) · `branch` ·
  `offeredAt` · `commitSha` · `treeSha` · `untracked` · `claim{name,claimedAt,expiresAt}` ·
  `result`. Ein abgelaufener Claim liest sich sofort als `lapsed`, ohne auf den Sweep zu warten.
- `result` (bei `state:"reported"`) — `exitCode` · `result` (`green|red|unknown`) · `reason` (nur
  bei `unknown`) · `tail` (4096 B gedeckelt) · `trail` · `checks{ran,failed}` (`null` = nicht
  zählbar, nie eine erfundene Null) · **`fails[]`** · **`remote{name,claimedAt,reportedAt}`** ·
  `treeSha` · `ms`.
  `remote` trägt zusätzlich `reason`/`timeoutMs`, wenn die andere Maschine sagen konnte, WARUM sie
  nichts gemessen hat: geschlossene Menge `timeout|could-not-start` (`server.ts#helperNoMeasureOf`).
  Nicht zu verwechseln mit dem `reason` eine Ebene darüber — das ist die Klassifikation DIESES
  Servers aus dem Exit-Code, und für einen abgewürgten Lauf leitet sie gar nichts ab: ein Timeout
  kommt als `exitCode: null` an, Byte für Byte wie „hat keinen Code geschickt". `could-not-start`
  wird hier aus 126/127 abgeleitet, nur `timeout` reist über das Netz; ein Code, den dieser Server
  nicht lesen kann, wird VERWORFEN (Feld fehlt), nie mit 400 quittiert — sonst wäre das Verdikt
  eines neueren Daemons Geisel einer Anmerkung.
- `fails[]` — **WELCHE Checks gefallen sind, beim Namen.** Zwei Quellen, in dieser Reihenfolge und
  nie vermischt: was der DAEMON aus dem VOLLSTÄNDIGEN Log und, wo der Lauf eines schrieb, aus dem
  Per-Check-Trail las (`helper-daemon/daemon.ts#failNamesOf`) — sonst der `tail`, durch denselben
  Parser, den auch der lokale Audit-Pfad fährt (`server.ts#localFailNames`). Die zweite Quelle ist
  der Grund, dass auch ein per Hand getippter Portal-Report (`src/helper.ts#doReport` schickt kein
  `fails`) und ein Daemon von vor dem 2026-09-01 Namen liefern. Deckel 50 Namen à 300 Zeichen
  (`server.ts#helperFailNames`), Detail-Suffix `  (…)` abgeschnitten. **LEER ist eine Messung, keine
  Lücke:** ein grüner Lauf nennt keinen, und was grün oder rot sagt, ist `result` — nie diese Liste.
  Warum es das Feld gibt: der `tail` ist 4096 B, und ein echter `./e2e-isolated.sh` ENDET in seinen
  Trail-Checks, die FAIL-Zeilen liegen also hunderte Kilobytes darüber. Gemessen am 2026-09-05 an
  einer Second-host-Vorschau: rot 1/3717 nach 27 min, welcher Check nicht feststellbar — die Lane fuhr
  die ganze Suite lokal nach, das Angebot kostete genau den Lauf, den es sparen sollte.
- `remote.artifact{bytes,sha256,url}` — die ganze `suite.log`, die der Helfer NACH dem Verdikt
  hochgeladen hat; **seit dem 2026-09-06 auch für eine VORSCHAU** und nicht mehr nur für eine
  Audit-Zeile (der Uploader hing an `auditAt`, dem Schlüssel, den nur die Audit-Quittung trägt;
  jede Quittung antwortet jetzt zusätzlich mit `artifactAt`, und der Daemon liest
  `artifactAt ?? auditAt`). **Sie steht nicht IN der Zeile auf Platte**: die Audit-Datei ist
  append-only, ein Vorschau-Verdikt lebt im Job, und der Fakt trifft später ein. Sie liegt auf einer
  SEITEN-SCHIENE (`helper-artifacts.jsonl`, Schlüssel `rowAt` = das `at` der Audit-Zeile bzw.
  `remote.reportedAt` der Vorschau; Zeilen von vor der Umbenennung tragen `auditAt` und werden
  weiter darunter gelesen) und wird an jeder Lesefläche auf die Zeile GEJOINT — dasselbe Muster wie
  `adjudication` und davor `dispositions.jsonl`, kopiert statt neu erfunden. Konsequenz, die das Muster kauft: ein Upload kann `result` nicht bewegen, weil
  der Schreiber die Audit-Datei gar nicht anfasst. Fehlt das Feld, ist keine Log-Datei angekommen —
  das ist eine andere Aussage als „der Lauf hat keine erzeugt", und keine wird als die andere
  gezeichnet. Die Bytes selbst holt `GET /api/post-land-audits/artifact?at=<n>` (Owner-Route; 410,
  wenn die Retention die Bytes weggeräumt hat und nur die Schienen-Zeile sie noch erinnert). Der
  Routenname bleibt auch für eine Vorschau der post-land-Name: es ist die EINE Route, die diese
  Bytes ausliefert, und eine zweite Fläche für dieselbe Datei wäre teurer als ein schiefer Pfad.
  **Eine Lane liest also Id und Größe, die Bytes holt der Owner.**
- `waitPolicy{freeMs,heldMs}` — die Wartezahlen aus `SUITE_OFFER_WAIT_FREE_MS` /
  `SUITE_OFFER_WAIT_HELD_MS`, damit die Lane sie nicht aus dem Gedächtnis zitiert.
- `helper{online,name,mode,lastSeenAgeMs}` — dieselbe Präsenz-Lesung wie in `/api/self/gate`, und
  sie reist an JEDER Antwort dieser Tür mit (GET, `existing`, frisch gemintet, abgelehnt), damit
  eine Lane nicht in derselben Sekunde hier „online" lesen und dort abgelehnt werden kann.
- `suiteLock` — dieselbe Sicht wie in `/api/self/gate`: `null` frei, sonst `state`
  `held|overdue|stale|parked|unknown` plus `pid`, `alive`, `identityProven`,
  `birth{stored,current,state}`, `acquiredAt`, `ageMs`/legacy `heldMs`, `nextAction`, `reason`
  und `effect`. `held`/`overdue` setzen eine live PID und einen passenden Prozess-Geburtsabdruck
  voraus; eine live PID mit abweichendem Abdruck ist `stale` und reapbar, eine live PID mit fehlendem
  oder unmessbarem Abdruck ist `unknown` und wird nicht automatisch gereapt.

**Die Ablehnungen von `withdraw`:**

- kein offenes Angebot → **404** `no open suite offer on this lane`.
- Angebot offen → **200**, `mayRunLocally: true`, `state: "withdrawn"`. **Diese 200 IST die
  Erlaubnis, lokal zu fahren** — es gibt keine andere.
- Angebot LIVE GECLAIMT, ohne `abandon` → **409**, mit Gerätename und Ablaufzeit. Eine 200 dort
  würde den zweiten Lauf autorisieren, und genau das ist die Invariante des Portals.
- Angebot live geclaimt, `{"abandon": true}` → **200**, `state: "abandoned"`. Bewusster Ausweg,
  damit ein stummer Helfer die Lane nicht verklemmt; ein danach eintreffendes Verdikt wird mit
  409 abgelehnt. Kosten: die Zeit des Helfers — keine Korrektheitsverletzung, weil nichts gegated.
- Ein ABGELAUFENER Claim zählt überall als abwesend, hier auch: er kann eine Lane nicht 45 min
  festhalten.

**Auf der Portal-Seite** erscheint das Angebot in derselben Liste wie ein Audit-Job, unterschieden
durch `kind: "lane-suite"`, mit `covers: 0` und `localRunning: false` (nichts auf dieser Maschine
draint eine Vorschau). Der Helfer klont mit **`git clone -b <branch>`** — ohne `-b` entsteht KEIN
Arbeitsbaum und keine Meldung, die das sagt.

**Was ein Remote-Verdikt NICHT ist:** eine Messung dieser Maschine. Exit-Code und Tail tippt ein
Mensch ein (`src/helper.ts#doReport` prüft nur `/^-?\d+$/`). Deshalb trägt jedes Verdikt `remote{}`
und `treeSha`, und deshalb steht in einem Lane-Report nie „`./e2e-isolated.sh` grün" ohne Zusatz.

**Kein Ledger.** Ein Lane-Ergebnis geht NICHT nach `post-land-audits.jsonl`: dessen Joins laufen
über `mainSha`/`covers[].mainAfter`, die eine Vorschau beide nicht hat — eine Zeile dort würde die
Fragen von Tier 2 nicht scheitern lassen, sondern still falsch beantworten. Das Verdikt lebt im
Job-Datensatz (`laneSuiteJobs`, in `fleet.json` persistiert wie die Claims, weil das Deploy-Ritual
hier land-dann-`kill-session -t srv` ist).


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
  evidence` — unverändert **als Sätze**; die zweite ist für den Report seit B4 kein Endpunkt mehr,
  siehe unten.

`basis` steht danach auf `"program-main"` (gebunden) oder `"lane-watch"` (ungebunden) und reitet in
die `fleet_report_open`-Audit-Zeile. `"program-main+lane-watch"` bleibt im `ClarificationBasis`-Typ,
weil vor dem Schnitt persistierte Zeilen ihn tragen und `loadState` gegen diese Liste validiert —
neu vergeben wird er nicht mehr.

### B4 — der Owner-Inbox-Rückfall: ein Report muss LANDEN können

**Ein Report ist ein terminaler Fakt, eine Clarification eine Frage.** Beide Türen teilten sich
`clarificationReceiverFor`, und genau daran fiel eine owner-dispatchte Task-Lane ohne
Program-Bindung und ohne exakten Lane-Watch durch: 409 `no exact clarification receiver evidence`,
von innen weder sichtbar noch reparierbar, obwohl ihr eigener Gründungsbrief den Report VERLANGT.
Zweimal live belegt (Slot 7 / Probe-Task `3e744cb3`, Slot 3 / Task `2b2e380f`). Der damalige
Workaround war schlimmer als das Loch: ein `{kind:"lane"}`-Watch, nur armed um Empfänger-Evidenz zu
FABRIZIEREN — `b6956c9` lehnt ihn inzwischen korrekt ab.

Fehlt beides, geht der Report daher in die **bestehende Owner-Operations-Inbox (📥)**:

- **`basis: "owner-inbox"`, `receiver: null`.** Der Owner ist ein PRINZIPAL, kein Occupant. Es
  wird kein `slot/openedAt/sessionId` erfunden — die drei Felder sind auf der `FleetReport`-Zeile
  wie auf dem `FleetEvent` gemeinsam `null` (halb-null ist malformed, nicht „Transportwahl").
  **DREI Felder tragen denselben Fakt „an wen wurde das gefilet", und jedes ist im Reverse-State
  einzeln an den Empfänger gebunden** — `delivery` (wie die Zeile reist), `payload.basis` (was
  Board und Supervisor-Projektion lesen) und `FleetReport.basis` (die Zeile selbst). Ein
  ungebundenes davon scheitert nicht laut: es hydriert und LÜGT dann die Sicht an, die es liest.
  Dazu die vierte Klausel: der Owner-Prinzipal existiert nur für `kind: "fleet-report"` — ein
  Null-Tripel auf einer Watch-Completion nennt niemanden, wäre nie zustellbar und würde trotzdem
  einen Platz an der Inbox-Decke besetzen.
- **`status: "inbox"`, `delivery: "inbox"`.** `inbox` ist kein pending-Zustand, und FACT 2 wählt
  ausschließlich `pending` — der Zeile kann strukturell kein `sendText`, kein History-Append und
  kein Prompt-Journal-Eintrag zustoßen. Kein Guard, ein Zustandsautomat.
- **Gebundene Pane-Zeilen können genau eine benannte Recovery tragen.** Wenn der erste
  `fleet-report`-Transport auf `send-uncertain` endet UND die Composer-Rollback-Messung
  `rollback=cleared` beweist, dass Fleets eigener Payload wieder aus der exakt gebundenen Empfänger-
  Pane entfernt wurde, bleibt dieselbe `FleetReport`-Zeile und dieselbe `FleetEvent.id` offen und
  `recovery.state:"retryable"` nennt Grund, nächste Aktion und Effekt. Nur dieser Schnitt darf erneut
  zustellen, und nur an denselben Empfänger-Occupant (`slot` + `openedAt` + `sessionId`) nach einer
  frischen Gate-Prüfung. Ein toter, ersetzter oder recycelter Empfänger wird `receiver-gone` mit
  `recovery.state:"terminal"`; der numerische Nachfolger bekommt nichts. Recovery acked nicht,
  akzeptiert den Report semantisch nicht, startet kein Self-Land und landet nichts. Bleibt der zweite
  Send unmessbar ohne `rollback=cleared`, bleibt die Zeile `send-uncertain` mit
  `recovery.state:"blocked"` statt generisch weitergesendet zu werden.
- **Und der Retry ist gedeckelt.** `FLEET_REPORT_RECOVERY_MAX_ATTEMPTS` (Default 5, ganze Zahl ≥ 1;
  0, negativ oder nicht-numerisch fällt auf den Default) zählt die `attempts` der Zeile, den ersten
  Transport-Paste eingeschlossen. Erreicht ein `rollback=cleared`-Fehlschlag den Deckel, wird
  dieselbe Zeile `recovery.state:"blocked"` — `reason` nennt Versuch und Deckel, `nextAction` ist
  „manual receiver acknowledgement if the pane text was read, or MAIN/owner intervention" — und sie
  wird NIE wieder gepastet; `status` bleibt `send-uncertain`, also schließt sie weiterhin nur der
  bestehende Self-ACK. Eine Zeile, die den Deckel schon trägt (Restore, älterer Server), wird VOR dem
  nächsten Paste geblockt. Gemessen an FleetEvent `8ca8c38e7af3433051ac78e5` (Report
  `ad4b19f375d44e075ee3f5cf`, Empfänger Slot 7): 1549 Versuche in ~28 h, weil nichts zählte.
- **Fleets eigener Paste ist keine Empfänger-Aktivität.** Ein Event-Transport-Send (Paste, Enter,
  Acceptance-Lesung, Rollback) läuft unter demselben `quietUntil`-Fenster wie der Resize-Repaint:
  die Bytes, die die Pane dabei malt, stempeln `lastOutput` nicht. Vorher hielt jeder
  Recovery-Paste den `receiverIdleSec`-Gate ALLER anderen pending Events desselben Empfängers zu
  (dieselbe Messung: lane-ready `a6462f2b` und merge-terminal `6b03f283` blieben bei attempts 0).
  Beide Fakten stehen in `e2e/watch.ts` §Q6 auf dem Live-Transport; der Deckel-Default und der
  Zustandsname sind in `e2e/pins.ts` gegen diese Datei gepinnt.
- **Sie überlebt ihren Worker.** `markFleetEventReceiverGone` filtert auf `receiverSlot === slotId`;
  `null` trifft das nie. Kill oder Recycle der Lane, die den Report gefilet hat, lässt die Zeile
  unberührt — terminal wird sie nur durch `POST /api/events/:id/ack` des Owners. Ein
  Self-Ack bleibt 409 (`inbox event — acknowledgement belongs to the owner`), und diese Prüfung
  steht jetzt VOR dem Occupant-Vergleich: eine Owner-Zeile hat keinen Occupant, und
  „belongs to another slot" wäre der falsche Grund.

**Was der Rückfall NICHT weitet** — jede Grenze ist ein eigener Check in `e2e/watch.ts` §B4:

| Fall | Verhalten | Warum |
|---|---|---|
| Lane MIT `programId` | unverändert 409 | ihr Ergebnis gehört der MAIN, die sie geschickt hat; ein geschlossener Rückweg dort ist ein Program-Fakt (`programReturnPath`), kein Grund, den Koordinator zu umgehen |
| zwei widersprüchliche Watch-Occupants | unverändert 409 | ABWESENDE und MEHRDEUTIGE Evidenz sind Gegenteile |
| nur Legacy-Watch ohne `slotOpenedAt` | unverändert 409 | dito |
| Lane ohne `taskId` | unverändert 409 | nichts hat sie dispatcht, also schuldet sie kein terminales Ergebnis — und es gäbe keinen Join-Key |
| `POST /api/self/clarifications` | unverändert 409 | **eine Inbox kann nicht antworten.** Ein dorthin geleiteter Worker würde ewig warten statt ein sichtbares 409 zu bekommen |

**Die Inbox-Schuld ist hart gedeckelt.** `FLEET_EVENT_MAX_OPEN_OWNER_INBOX = 25` nicht-terminale
Owner-Zeilen; die 26. wird laut abgelehnt (409 `owner operations inbox has no FleetEvent delivery
budget`). Eigener Deckel statt der Fünf pro Slot, weil der Owner EIN Leser für die ganze Flotte ist:
fünf offene Zeilen wären von fünf Lanes einer Stunde verbraucht, und die sechste Lane stünde wieder
ohne Rückweg da. Retention: `FLEET_EVENT_KEEP_TERMINAL_OWNER_INBOX = 25` acked Zeilen —
`pruneFleetEvents(null)` ist derselbe Mechanismus mit dem Owner als Schlüssel.

Im Board erscheint die Zeile in `📥` wie jede andere Inbox-Zeile — ohne Zusatz-Payload, weil die
Rows ohnehin als `events` auf `/api/sessions` reiten. Zwei Unterschiede in der Darstellung: der
Empfänger heißt „filed for you" statt `receiver slot N` (es gibt keinen), und der Report-TEXT wird
vollständig gerendert statt zusammengefasst — für diese eine Art IST der Text die Zustellung. Bei
Pane-Transport ohne Session-Ack zeigt die Operations-Fläche zusätzlich `recovery.state`,
`nextAction`, `reason` und `effect`, wenn der Server eine Recovery-Entscheidung gemessen hat.

**Weitere Ablehnungen:** MAIN und `⚙ steward` sind 409 (`not a worker lane — MAIN and the steward
cannot file a fleet report`) — es berichtet, wer ARBEITET. Hat der Empfänger kein
Zustellbudget mehr (offene Events + armed Watches ≥ `FLEET_EVENT_MAX_OPEN_PER_SLOT`, heute 5), ist
es 409 `fleet-report receiver has no FleetEvent delivery budget`.

### Das Zustellbudget ist sichtbar, bevor du dagegen läufst (V1b)

Diese Ablehnung war bis 2026-08-25 von außen unsichtbar: sie stand nur im 409 der Lane, die sie
bekam — fünfmal an einem Tag live belegt. Dieselbe Summe, die die drei Türen ausgeben
(`slotDeliveryBudget` in `server.ts`: offene, nicht-terminale FleetEvents + armed Watches gegen
`FLEET_EVENT_MAX_OPEN_PER_SLOT`), projiziert jetzt EIN gemeinsamer reiner Helfer
(`programReturnPath`) auf die beiden vorhandenen Sichten — **`GET /api/programs` (Owner) und
`GET /api/self/supervisor-view` → `portfolio[]` (Supervisor)**, je Program als zwei additive Felder:

- `deliveryBudget` — `{state:"known", deliveryDebts, armedReservations, cap, free}` oder
  `{state:"unknown", reason}`. **`free === 0` ist exakt die Ablehnungsbedingung** der drei Türen,
  nicht eine Näherung daran.
- `deliveryBudgetNote` — EIN Satz, wörtlich derselbe in beiden Sichten. Bei `free === 0` nennt er
  den Slot, die Zerlegung (`N open events + M armed watches`) und die Ablehnung, die als nächstes
  kommt.

**Zuordnung nur über die eindeutige LIVE `slot+openedAt`-Bindung.** Kein `main`, eine Bindung ohne
lebenden Occupant, oder zwei Programme, die dieselbe Occupation nennen ⇒ `state:"unknown"` **mit
Grund und ohne Zahl** — nie `0`. „Es gibt keinen Empfänger" und „der Empfänger hat keinen Platz
mehr" sind entgegengesetzte Fakten, und eine 0 läse sich als das zweite.

**Es ist eine reine PROJEKTION:** nichts wird acked, kein Watch entwaffnet, kein Cap oder Retry
bewegt, nichts persistiert — pro Request neu gerechnet wie `occupancy`, weil sich das Budget
zwischen zwei Reads ändert. Beweise: `e2e/watch.ts` (die 4-Watches-plus-1-Debt-Gegenprobe gegen die
echte Ablehnung, plus der zurückgegebene Platz) und `e2e/programs.ts` (Zuordnungsregeln und die
Byte-Gleichheit beider Sichten).

**`GET /api/self/fleet-report`** liefert die Zeilen, in denen der Aufrufer Worker ODER Empfänger
ist — exakt an Slot, `openedAt` und `sessionId` gebunden. **Retention: `FLEET_REPORT_KEEP = 20`**
terminale Zeilen, älteste zuerst verworfen. Terminal heißt: das zugehörige Event steht auf
`acknowledged` oder `receiver-gone` — **oder es existiert nicht mehr** (`pruneFleetReports`
behandelt ein fehlendes Event als terminal, sonst hielte eine Zeile ohne Event die Liste ewig).
Eine Zeile mit noch offenem Event wird nie gepruned. Ein Report ist also kein Archiv — was bleiben soll, gehört in den
Commit.

### Annahme — `POST /api/self/fleet-report/:id/accept`, `POST /api/self/fleet-report/:id/reject`

**Der ACK ist ein Transport-Empfang, keine Beurteilung.** `POST /api/self/events/:id/ack` sagt
per Vertrag „ich habe Bytes bekommen" — bis zu diesem Schnitt persistierte nichts, ob die
empfangende MAIN den Diff gelesen und die Arbeit ANGENOMMEN oder ABGELEHNT hat. Eine Nachfolge-MAIN,
die ein Program aus `GET /api/self/program-execution` rekonstruiert, konnte einen angenommenen
Report nicht von einem ungelesenen unterscheiden.

```
curl -s -X POST http://<fleet-host>:<port>/api/self/fleet-report/<report-id>/accept \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"reason":"Diff gelesen, Verify zitiert, Scheibe uebernommen"}'
```

- **Der Fakt sitzt auf der REPORT-Zeile, nicht auf dem FleetEvent.** Das Event ist Transport und
  wird auf seiner EIGENEN Uhr gepruned (`pruneFleetEvents`, je Empfänger); der Report ist das
  BEURTEILTE Objekt mit eigener Retention. Ein Urteil auf dem Event verschwände, während die Zeile,
  die es beurteilt, noch da ist — und es überlüde ein Wort (`acknowledged`) mit zwei Bedeutungen.
- **`decision` ist EIN Objekt oder es ist nicht da**: `{disposition, at, by:{slot,openedAt,sessionId},
  reason}`. `disposition` ist genau einer von zwei (`FLEET_REPORT_DISPOSITIONS` in `server/types.ts`):
  `accepted` · `rejected`. Fehlt der Schlüssel oder ist er `null`, ist die Zeile UNBEURTEILT — eine
  vor dieser Tür persistierte Zeile bleibt beobachtbar unbeurteilt und wird nie zu einem Urteil
  repariert, das niemand gefällt hat. `reason` ist optionale Prosa ≤ 500 Zeichen oder `null`.
- **Nur der EXAKTE gebundene Empfänger-Occupant entscheidet** (`slot` + `openedAt` + `sessionId`),
  und `fleetReportFrom` prüft `decision.by` gegen `receiver` zusammen: eine Zeile kann strukturell
  kein Urteil eines Prinzipals tragen, an den sie nie gefilet wurde.
- **Die erste Entscheidung gewinnt.** Ein zweiter Aufruf ist 409 (`fleet report was already
  accepted|rejected`, die stehende `decision` im Body) und die Zeile bleibt unverändert — auch bei
  identischer Wiederholung. Ein Report wird EINMAL beurteilt; sonst überschriebe eine spätere
  Session das Urteil ihrer Vorgängerin.

**Die Ablehnungen, in dieser Reihenfolge:**

| Fall | Antwort |
|---|---|
| Lane als Aufrufer | 409 `a lane may not judge a fleet report — a lane files its own result, it does not accept the results its own MAIN is owed` (Route-Ebene, wie bei `release`/`attention`/`tasks`) |
| unbekannte id | 404 `unknown fleet report` |
| Owner-Inbox-Zeile (`receiver: null`) | 409 `owner-inbox report — accepting or rejecting it belongs to the owner, who has no session to bind a decision to` — **vor** dem Occupant-Vergleich, aus demselben Grund wie beim Self-ACK: eine Owner-Zeile HAT keinen Occupant, und „belongs to another session" wäre der falsche Grund |
| fremde oder ersetzte MAIN | 409 `fleet report belongs to another or replaced MAIN session` (dieselbe Form wie `replyClarification`) |
| Body mit anderem Schlüssel | 400 `body must contain only reason` — dieselbe Disziplin wie `body must contain only status and text` |
| `reason` kein String / > 500 | 400 mit der Grenze im Text |

**Der Transport wird mitgeschlossen, durch den SCHREIBER der ACK-Route, nicht durch einen zweiten.**
Ist das Event der Zeile noch nicht terminal, setzt die Entscheidung es auf `acknowledged`
(`settleFleetEventAcknowledged`, Audit-Wort `fleet_event_ack`) — eine MAIN, die geurteilt hat, hat
den Report per Konstruktion bekommen, und ein offenes Event ließe `recoverFleetReportDelivery` einen
bereits beurteilten Report erneut pasten. Ein BEREITS terminales Event bleibt exakt wie es ist
(`receiver-gone`/`subject-gone` sind Verlust-Evidenz, keine offene Schuld). `POST
/api/self/events/:id/ack` behält seine Bedeutung und jede seiner Ablehnungen unverändert.

**Was die Tür NICHT tut** — jedes davon ist ein eigener Check, keine Prosa: sie bewegt nie
`Task.status`, landet nicht, tötet oder schließt keine Lane, schickt nichts in die Worker-Pane und
ändert die Retention nicht (eine beurteilte Zeile hält `pruneFleetReports` genau wie jede andere
terminale Zeile). Kein Tick ruft sie — sie hat genau eine Aufrufstelle, und die ist die Route.
Eine Ablehnung schickt der Lane KEINE Nachricht; ob das ein Transport braucht, ist offen und
bewusst nicht gebaut.

**Sichtbarkeit, zwei Sichten für zwei Leser:**

- **`GET /api/self/fleet-report`** liefert die volle Zeile inklusive `decision` — an den Worker und
  an den Empfänger, exakt occupant-gebunden wie zuvor.
- **`GET /api/self/program-execution`** trägt den Fakt je Task-Zeile als
  `report: {id, status, disposition, decidedAt}` oder `null`. Der Join läuft über die persistierte
  `provenance` (`taskId` + `programId`), NICHT über einen Occupant — genau darum sieht ihn auch eine
  NACHFOLGE-MAIN, die später über `authority.lineage` gebunden wurde und ein anderes Tripel trägt.
  Sie ist der Leser, der `GET /api/self/fleet-report` nicht fragen kann (sie ist nicht der
  Empfänger) und sonst eine Pane lesen müsste. `disposition: null` heißt gefilet-aber-unbeurteilt;
  `report: null` heißt „keine Zeile VORHANDEN" — und weil die Retention ein begrenzter Schwanz ist,
  nennt die `unknown`-Liste genau dann eine Zeile, wenn die Decke (`FLEET_REPORT_KEEP`) erreicht ist
  und ein `null` daher auch „weggepruned" heißen kann.
- Der Fakt ist **kein Eingang des Phasen-Reducers**: `program-phase.ts` liest keine prunebare Zeile
  (sein eigener Pin sagt das), und keine Phase ändert sich durch ihn.

Die Lane-Fußzeile (`LANE_EXIT_FOOTER`) bleibt **unverändert**: sie sagt der LANE, wie sie endet —
committen, einen getypten Report filen, idle gehen. Was die MAIN danach mit dem Report tut, ist
nicht ihr Wissen und gehört nicht in ihren Brief.

### Der automatische Lane-Schluss — `FLEET_LANE_AUTOCLOSE` (keine Route)

**Das ist kein Self-Endpoint, sondern der einzige Verbraucher des Urteils oben — und er steht hier,
weil eine Lane, die sich unbeobachtet schließt, genau die Art Verhalten ist, die verrottet, wenn nur
der Code sie kennt.** Eine Worker-Lane, die FERTIG ist, sauber, NICHTS vor main hat und keinen
landbaren Kandidaten produziert hat, bleibt sonst für immer offen: sie hält einen Dispatcher-Platz,
liest sich für jede Projektion als gesundes RUNNING, und beendet wird sie vom Owner per Hand.

**Der Schalter ist ein Deployment-Entscheid, kein Laufzeit-Zustand.** Er hat die Form von
`FLEET_CLEAN_REVIEW`: erkannt sind `1`/`true`/`on`/`yes` und `0`/`off`/`false`/`no`, jede andere
Schreibweise ist AUS **und sagt es beim Boot laut** (eine stille Vertipper-Deaktivierung hat genau
diesen Nachbarflag am 2026-07-28 ein rotes Land-Gate gekostet). **Abwesenheit heißt NICHTS TUN:**
ohne den Flag wird gar kein Timer registriert — der Tick kann sich nicht selbst schärfen.

**Geschlossen wird eine Lane NUR, wenn JEDER dieser Fakten am Live-Zustand gelesen wurde. Fehlt oder
ist einer unmessbar, bleibt die Lane offen** (`server.ts#laneAutoCloseRefusal`, jede Ablehnung trägt
ihren eigenen Satz):

| Fakt | Quelle | Warum er zählt |
| --- | --- | --- |
| `autosOn` | Owner-Master-Stop | ein irreversibler Akt läuft nie an der Pause vorbei |
| Lane, kein `⚙ steward`, kein Teardown/Restart in Flug | Slot | eine stehende Rolle ist keine verbrauchte Lane |
| kein Merge-/Commit-/Review-Job | die vier Inflight-Maps | frischer als der ~10-s-`gitOp`-Cache |
| **kein Merge-Verdikt auf Akte** | `mergeLast` | ein Kandidat, auf den jemand schauen muss — auch bei `ahead 0` |
| `spent-looking` | `lane-signals.ts#laneSpentLooking` | `stalled` + sauberer Baum: alive · beobachtet · idle · kein Git-Op · kein blockierender Merge · `awaiting:null` · `ahead===0` · `dirty===0` |
| `taskId` + `programId`, Program `active` | Slot + `programs` | geschlossen wird Arbeit, die eine Program-MAIN beurteilt hat |
| **JEDER eigene Report beurteilt** | `fleetReports` (Worker-Tripel) | „unbeurteilt" heißt jede Zeile, nicht nur die neueste |
| `decision.by` === `receiver` | dieselbe Zeile | der EXAKTE Empfänger-Occupant, hier nochmal geprüft |
| `disposition === "killed-empty"` | `buildLaneOutcome` | frischer `rev-list --count`, nicht der Cache |

**Beide Verdikte schließen.** Die Tür heißt „beurteilt", nicht „angenommen": ein `rejected` Report
ist eine gelesene Antwort und beendet die Lane genauso wie ein `accepted`. Was NICHT schließt, ist
eine Zeile ohne Urteil — und eine `owner-inbox`-Zeile kann strukturell keins tragen.

**Die letzte Linie ist eine ZUSICHERUNG, keine Formalität.** `ahead` im Prädikat ist der ~10-s-Cache
von `tickGit`; `buildLaneOutcome` zählt die Commits frisch. Eine Lane, die in diesem Fenster
committet hat, kommt als `killed-dirty` an — und **eine Lane mit Commits wird NIE automatisch
geschlossen, in keinem Zustand**. Es wird dann auch keine Zeile geschrieben.

**Die Spur ist dieselbe, die ein Hand-Schluss schreibt**, plus ein Feld: die Lane-Outcome-Zeile trägt
`disposition: "killed-empty"` und zusätzlich
`autoClose: {reportId, disposition, decidedAt, decidedBySlot}`. Damit ist der Schluss **ohne Pane**
rekonstruierbar — die Zeile NENNT den Report, dessen Urteil ihn autorisiert hat. Absicht und Grenze
dieses Feldes: das Vokabular `SlotEnding` liegt in `slotstats.ts`, deshalb zählt die Endungs-Statistik
einen automatischen Schluss unter demselben `owner` wie einen Knopfdruck; wer die beiden trennen
will, joint das Outcome-Ledger, nie eine Pane.

**Was der Tick nie tut:** landen, `main` bewegen, eine Lane mit unbeurteiltem Report schließen, eine
fremde oder programmlose Lane schließen, einen dirty- oder `ahead>0`-Baum töten, Text in eine Pane
schreiben, oder vom Dispatch-Tick aus laufen — nichts auf dem Lane-START-Pfad beendet eine Lane. Der
Worktree bleibt liegen wie nach jedem Kill.

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

Kommst du zu spät zum Abo — oder landet ein anderer (Owner ⏏/⏫, Confirm) die Lane deines Tasks —,
bleibst du trotzdem nicht stehen: der terminale Land armt dir denselben Watch selbst und gibt ihn
aus (§watch, letzter Punkt). Das ersetzt das eigene Abo NICHT (es deckt nur den LAND, nicht das rote
oder aufgelöste Verdikt, bei dem nichts landet), aber ein gelandeter Task erreicht dich als Ereignis.

**Die Ablehnungsleiter, in dieser Reihenfolge, jede mit eigenem Satz** (die Sätze sind
unterscheidbar, weil sie den Aufrufer an verschiedene Stellen schicken):

1. nicht gebunden · mehrdeutig gebunden — zwei verschiedene Ablehnungen, wie an allen Self-Türen.
2. **`sessionId` muss EXAKT stimmen.** Die einzige Route, die sie GATET statt sie nur zu melden:
   `slot+openedAt` allein identifiziert die Okkupation, aber Landen ist der Akt, bei dem ein
   unbestätigter Occupant kein kleineres Problem ist. Beide Seiten `null` zählt als exakt (eine
   Fleet, deren Harness keine Session-Id pinnt, kann die Route sonst strukturell nie benutzen).

   **Und die Bindung LERNT, statt zu erstarren.** `bootstrapProgramMain` stempelt das Tripel zur
   Bind-Zeit; ein Harness, der beim Spawn keine Session-Id pinnt (codex), hat dort `sessionId:null`
   und erfährt die echte Id erst danach. Weil diese Sprosse exakt vergleicht, machte genau dieser
   Lernvorgang aus einer gültigen Bindung eine dauerhafte 409 — und `bootstrap-main` heilt es nicht,
   weil sein Live-Occupant-Guard für dieselbe laufende MAIN `existing:true` antwortet (gemessen
   2026-08-25: Programm 6fcc2971, Slot 3, zwei 409). Seit `backfillProgramMainSessionId` füllt jede
   Stelle, an der ein Slot seine Id lernt (Codex-Auto-Bind, `/codex-bind`, ein Heal, der eine
   entdeckte Id über den Respawn trägt — und der Boot, für schon festgefahrene Bindungen), das
   aufgezeichnete `null` nach. **Der Vergleich selbst ist unverändert:** eine aufgezeichnete
   NICHT-null-Id wird nie überschrieben (`divergent` bleibt `divergent`, und der Owner rebindet),
   ein abweichendes `openedAt` wird nie angefasst, und ein Programm, das nicht `active` ist, auch
   nicht. Geschlossen wird nur das Fenster zwischen Binden und Lernen.
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
12. Ungeprüfte Konfliktlösungen in der Lane (die ⏸-Sperre) sind unter `green-only` eine
    ABLEHNUNG, und die Ablehnung NENNT die Sprosse, die sie nähme (`guarded`). Unter `guarded`
    greift stattdessen die bestätigte Konflikt-Bestätigung unten.

### Das verlorene Fast-Forward: `errorReason: "ff-lost"` (Sprosse 10, die Ausnahme)

**Gemessen 2026-09-02, 06:09–07:20 CEST** (Programm `66499a03`, MAIN Slot 4, Lane Slot 8): ein
Self-Land rebaste sauber, das Gate lief GRÜN (110 s Arbeit nach 1838 s Wartezeit am Suite-Mutex),
und dann verweigerte `git merge --ff-only` das Vorspulen, weil inzwischen ein reiner Docs-Commit
auf main gelandet war. `mergeJob` schreibt dafür `status:"error"`, `"error"` steht in
`MERGE_BLOCKING` — und ab da war die Lane **strukturell nie wieder `done-looking`**: der
lane-ready-Watch konnte nicht feuern, und Sprosse 10 antwortete auf JEDEN weiteren Aufruf
`the lane is not done-looking (no signal)`. Der Owner musste landen; Schritt 5 des Programms war
still zu einem Owner-Land degradiert.

Seit 2026-09-03 trägt genau dieses Verdikt eine **getypte, geschlossene** Zusatzangabe:

```
{"status":"error","landed":false,"errorReason":"ff-lost","verify":{"ok":true,…},
 "detail":"rebase ok, but fast-forwarding main failed: … — lane kept"}
```

- **Das Enum ist geschlossen und hat heute GENAU EINEN Wert:** `ff-lost`
  (`lane-signals.ts#MERGE_ERROR_REASONS`). Es wird an EINER Stelle geschrieben — dem sauberen
  Land-Zweig in `mergeJob`, den ein rotes, übersprungenes oder abgelaufenes Verify und jeder
  Konflikt gar nicht erst erreichen. `detail` bleibt Prosa und wird **nie geparst**: eine
  umformulierte Prosa-Zeile hätte die Lane sonst still wieder blockiert.
- **Nur dieser eine Fakt hebt die Blockade auf** (`lane-signals.ts#mergeBlocksLane`): die Klausel
  „no blocked/errored merge (a lost fast-forward is not one)" der drei Prädikate testet POSITIV
  gegen das PAAR `status === "error"` UND `errorReason === "ff-lost"` — nie gegen den Grund allein.
  Ein `blocked` (auch eines, das den Grund trägt), ein `error` aus einem geworfenen Merge-Lauf, ein
  rotes Verify, ein ungelöster Konflikt, ein **abwesender** oder unbekannter `errorReason` — alle
  blockieren unverändert. Abwesend heißt UNKNOWN, nie „war wohl ein Rennen".
- **Der Loader validiert ihn und datiert genau die alte Schreiberform**
  (`server.ts#withValidErrorReason`): ein persistierter Wert überlebt den Neustart nur, wenn er im
  Enum steht UND auf einem `error`-Verdikt sitzt; sonst wird das FELD fallengelassen (nicht die
  Zeile) und die Lane blockiert wieder. Fehlt das Feld ganz, trägt der Loader `ff-lost` nur dann
  nach, wenn der alte Record vollständig belegt: `status:"error"`, `landed:false`,
  `verify.ok === true` und `detail` in der historischen Form
  `rebase ok, but fast-forwarding <main> failed: <Fehler> — lane kept`. Ein fehlendes, rotes oder
  unbekanntes Verify, ein fremdes Detail, ein fehlendes oder von `false` abweichendes `landed`, ein
  vorhandener ungültiger Grund oder ein anderer Status bekommen keine Ausnahme. Ein bloßes
  Legacy-`error` ist weiterhin UNKNOWN und blockiert.
- **Seit 2026-09-04 ist dieses Verdikt der ZWEITE Ausgang, nicht der erste** (Owner-Entscheid):
  verliert ein sauberes, grün verifiziertes Land die Vorspulung, liest `mergeJob` main neu, rebast
  die Lane auf das NEUE main, **fährt das Gate erneut** und spult wieder vor — bis zu
  `FLEET_LAND_FF_RETRY_ROUNDS` mal (Default 2; `0` ist exakt das Verhalten davor und die
  Rückfalltür). Erst wenn die letzte Runde wieder verliert, steht das Verdikt oben — im Wortlaut
  unverändert, mit einem additiven Zusatz in `detail` und dem Zähler `ffRounds` auf dem Verdikt.
  Drei Dinge daran sind Kontrakt, nicht Implementierungsdetail:
  **(a)** es wird nie ein Baum gelandet, den das Gate nicht gesehen hat — nach jedem erneuten
  Rebase ist der Baum ein anderer, also läuft das Gate erneut, und `verify` auf Verdikt und Note
  ist das der Runde, die GELANDET hat;
  **(b)** ein rotes, übersprungenes oder abgelaufenes Gate in einer Retry-Runde landet nichts und
  schreibt das Verdikt seiner Lage (`resolved`), nie `ff-lost` und nie grün — ein Retry würfelt ein
  Gate nicht, bis es ihm passt;
  **(c)** die Kette nimmt den **Suite-Mutex einmal** und hält ihn über alle Runden (die Gate-Läufe
  darin erben ihn über `FLEET_SUITE_LOCK_HELD_BY` statt sich neu anzustellen); bekommt sie ihn im
  Budget nicht, wird gar nicht wiederholt und `detail` benennt dafür die Maschine, nicht den Baum.
- **Wirkung:** die Lane ist wieder `done-looking`, sobald sie lebendig, idle, sauber und ahead ist;
  der lane-ready-Watch feuert einmal; die Projektion bleibt `REVIEWABLE` und ihr `nextAction`
  benennt weiterhin diese Tür. Ein erneutes `POST /api/self/tasks/:id/land` rebast auf das
  BEWEGTE main, fährt **das volle Gate erneut** und spult vor. Der Progress-Guard (Sprosse 9) ist
  davon unberührt: er greift über `candidateSha`, und ein `error`-Verdikt trägt keinen (nur
  reviewable Verdikte binden die Kandidaten-Identität) — ein rotes Verify oder eine geblockte
  Auflösung auf demselben Kandidaten wird also weiterhin als `no progress` abgelehnt.

### Wohin das Verdikt geht: an den, der gelandet hat (seit 2026-09-04)

**Gemessen am 2026-09-04:** genau das `ff-lost`-Verdikt von oben wurde in die **LANE**-Pane
gepastet. Die Lane las es als Arbeitsauftrag und fuhr ihre komplette Verify-Kette neu — je ~10 min
auf dem EINEN Suite-Mutex dieser Maschine, an einer einzigen Zeile sechsmal an einem Tag, dreimal
davon durch `ff-lost`. Der Empfänger war falsch: bei einem Self-Land hat eine **Program-MAIN** den
Land ausgelöst, nicht die Lane.

Seit `server.ts#deliverMergeVerdict` den `actor` des Laufs kennt, folgt der Empfänger dem
**Auslöser**:

- **`actor.kind === "main"`** (diese Tür) ⇒ das Verdikt geht an den MAIN-Slot, und die **Lane
  bekommt NICHTS**: kein Paste, keine `history`-Zeile, keine Prompt-Journal-Zeile. Genau dieses
  Schweigen ist der Zweck.
- **`actor.kind === "owner"` / `"unknown"`** ⇒ unverändert die Lane-Pane, byte-identisch wie vorher.
- **Die Identitätsfrage ist auf der MAIN-Seite eine ANDERE** (`server.ts#mainVerdictReceiver`) und
  nicht die kopierte Lane-Prüfung: Program existiert und ist `active` · die Bindung nennt noch
  dieselbe Occupation · der Slot ist nicht recycled · dieselbe Session (`sessionId` DIREKT
  verglichen, wie an der Landtür: zwei `null` sind ein Treffer, ein `null` auf einer Seite nicht).
  Fällt eine der vier Fragen, **fällt das Verdikt NICHT auf die Lane zurück** — es ist unzustellbar,
  bleibt auf dem Merge-Status lesbar und wird als `merge_verdict_undeliverable` mit dem Grund
  protokolliert. Ein Lane-Fallback wäre genau der Paste, den der Schnitt abschafft.
- **Persistiert**, weil der eine gebundene Retry aus `tickWatches` keinen Job-Frame hat, aus dem er
  einen Actor erben könnte: `MergeLast.verdictTo` hält Slot, Program, Task und die Occupation neben
  `verdictDelivery`. Der Loader (`server.ts#withValidVerdictTo`) liest ihn in der Disziplin von
  `loadLandActor` — eine halbe Attribution wird nie repariert, sondern ganz verworfen; und
  **abwesend heißt LANE**, was jede vor diesem Feld geschriebene Zeile ohnehin bedeutet.
- **Unverändert:** Text und Art des Verdikts, der Deckel von zwei Versuchen, und die Gate-Liste —
  auch die MAIN-Pane hat Liveness-, blocked-screen- und Idle-Gate. Prosa in eine Pane ohne Agent
  dahinter ist ein Shell-Kommando.

### Die Identität ist sichtbar, bevor die Tür sie prüft (V1a)

Sprosse 2 oben ist die einzige, die eine Session **an ihrer Identität** abweist — und genau dieser
Zustand war von außen unsichtbar. Beide Program-Sichten zeigten `occupancy: "live"` (die Pane hält
den gebundenen Slot ja), während jedes Self-Land derselben MAIN bereits abgelehnt wurde; die
Ablehnung stand nur in ihrer eigenen Pane. Seit V1a projiziert EIN gemeinsamer reiner Helfer
(`server.ts#programHealth`) beide Hälften auf die **zwei vorhandenen** Sichten —
**`GET /api/programs` (Owner) und `GET /api/self/supervisor-view` → `portfolio[]` (Supervisor)** —
als EIN additives Feld je Program:

- `health.occupancy` — `live` · `stale` · `unbound`. **Hier wohnt seit V1a die frühere Top-Level-
  `occupancy`**; die Regel selbst (`server.ts#programOccupancy`) ist unverändert. Zwei Kopien eines
  abgeleiteten Feldes auf einer Zeile sind zwei Antworten, die auseinanderlaufen — es gibt jetzt
  genau eine.
- `health.sessionIdMatch` — `exact` · `divergent` · `unknown`. **Nur beim live gebundenen Occupant**
  wird verglichen; `stale` und `unbound` ergeben `unknown`, weil eine tote Bindung einen Occupant
  nennt, der weg ist, und ein Vergleich gegen dessen Nachfolger eine Frage beantwortete, die
  niemand gestellt hat. Der Vergleich ist **keine neue Regel**: `server.ts#sessionIdMatchOf` ist der
  eine Ausdruck, den auch `server.ts#boundProgramForMain` und `ProgramExecutionView` lesen.

**Es ist kein Land-Urteil und darf nie als eines gelesen werden.** Die Tür vergleicht die beiden
Werte DIREKT — beide `null` ist für sie ein exakter Treffer, ein `null` auf nur einer Seite eine
Ablehnung; hier heißen beide `unknown`. Und sie verlangt zusätzlich ein `active` Programm, eine
EINDEUTIGE Bindung (`ambiguous Program-MAIN binding`) und eine Policy — nichts davon sieht diese
Projektion an. Sie meldet IDENTITÄT; die Autorität bleibt, wo sie entschieden wird. Konsequenz für
zwei Programme auf derselben Okkupation: das Zustellbudget (V1b) wird dort `unknown`, `health`
NICHT — ein Budget gehört einem Occupant und lässt sich nicht teilen, ein Identitätsvergleich ist
pro Bindung wohldefiniert, und was die Mehrdeutigkeit kostet, lehnt die Tür selbst ab.

**Dazu trägt `portfolio[]` seit V1a den rohen `promotion`-Record** (sonst `null`) — bis dahin trug
es ihn gar nicht, so dass „der Owner hat nein gesagt", „der Owner hat nie etwas gesagt" und „der
Owner hat eine Sprosse erteilt" für den Supervisor EIN Schweigen waren, während das Owner-Board
alle drei unterscheidet. Verbatim, ohne Übersetzung: die fünf angezeigten Zustände
(`absent|off|green-only|guarded|unreadable`) sind das Vokabular des Client-Helfers
`src/client.ts#promotionState`, und ein zweiter Übersetzer wäre ein zweites Vokabular. Der
Owner-GET behält seinen vorhandenen Top-Level-Record unverändert. **`promotion: null` behauptet
nichts über ein Warten auf den Owner** — die Owner-Policy vom 2026-08-23 reserviert diese Tür für
eine konkret REVIEWABLE Zeile ohne nutzbare Policy, und diese Projektion sieht keine Zeile an.

**Reine PROJEKTION:** nichts wird geschrieben, nichts persistiert, pro Request neu gerechnet — wie
`occupancy` und das Rückweg-Budget daneben, weil der Occupant zwischen zwei Reads sterben kann.
Beweise: `e2e/programs.ts` (alle drei Arme an der vorhandenen Divergenz-Fixture — `divergent` ist
dasselbe Wort, das die Tür meldet —, die Twin-Fixture, der stale-Arm, und die Byte-Gleichheit von
`health` zwischen beiden Sichten) und `e2e/supervisor.ts` (beide Hälften im Portfolio, der
HELD-aber-nicht-gebundene Slot, der rohe Promotion-Record und die Abwesenheit jedes `waitingOn`).
Auf dem Board zeigt `src/client.ts#programHealthState` die Identitätshälfte auf JEDER Zeile
dauerhaft — vier Zustände, `unreadable` als vierter, weil eine Zeile ohne lesbaren Record kein
Treffer ist.

### Die `guarded`-Sprosse: eine aufgelöste Konfliktlösung bestätigen

Owner-Policy 2026-08-23, wörtlich: „Conflict is MAIN work … the MAIN inspects both sides, chooses
or commissions a resolution, records `conflicted` / `resolvedBy` / `repairRounds` / `candidateSha`,
re-runs the authoritative verification fresh on the resolved candidate, reviews the diff, lands if
fresh and green. `conflicted:true` alone never blocks promotion."

Heute endet eine Auflösung als `status:"resolved", landed:false`, und nur das Owner-Confirm des
Boards landet sie. Unter `guarded` darf die GEBUNDENE MAIN denselben Schritt für die eigene Zeile
tun. Es gibt dafür **keine zweite Merge- oder Land-Implementierung**: es ist dieselbe Funktion
(`confirmResolvedCandidate`), die das Board ruft, mit genau drei Unterschieden —

| | Board-⏸ (`byHuman:true`) | MAIN unter `guarded` |
| --- | --- | --- |
| Verify | wird als `stale` MARKIERT, nie neu gefahren | wird FRISCH auf dem Kandidaten gefahren |
| Landet bei | Owner-Ermessen (auch bei `ok:false`) | **ausschließlich `ok:true`** |
| `confirmedByHuman` | `true` | `false` (wer es war, steht auf dem Actor-Rail) |

**Sie läuft im HINTERGRUND** wie der Merge-Job und aus demselben Grund: ein frischer `runVerify`
kann die Maschine für die volle Suite-Laufzeit halten. Die Antwort ist sofort
`{running:true, confirm:"resolved-candidate", candidate, resolution:{conflicted,resolvedBy,
repairRounds}, watch:{kind:"merge",target}}` — der Ausgang kommt über das merge-terminal-Event.

**Sie ist PRO KANDIDAT verbraucht.** Ein frisches Rot landet nichts und lässt das Verdikt stehen
(inkl. `conflicted`/`resolvedBy`, damit die ⏸-Sperre gegen einen späteren gewöhnlichen Merge-Lauf
weiter steht) — der *identische* nächste Ruf kauft dann keinen zweiten Suite-Lauf, sondern fällt in
den Progress-Guard (Punkt 9). Der Marker ist memory-resident: ein Neustart erlaubt eine weitere
frische Prüfung, er kann nie etwas Ungeprüftes landen. **Keine Attention wird geöffnet** — was bei
einer roten Bestätigung zu tun ist, ist das Urteil der MAIN; die fünf Eskalationsklassen sind es,
die zur Attention gehen.

**Die Note eines so gelandeten Kandidaten trägt** `conflicted`, `resolvedBy`, `repairRounds`,
`resolverRuns`, `candidateSha`, das FRISCHE Verify-Ergebnis und `confirmedByHuman:false`. (Ein Land
des SAUBEREN Pfades trägt keines dieser Felder, aber seit 2026-09-04 `ffRounds`, sobald es die
Vorspulung mindestens einmal verloren und den Zug wiederholt hat — fehlt das Feld, gelang es im
ersten Anlauf.)

`resolverRuns` ist seit 2026-09-06 die EINZIGE Stelle, an der ein Ledger dieses Repos das MODELL
eines Konflikt-Resolvers nennt: eine Zeile pro Worker-SPAWN, in Spawn-Reihenfolge (der Resolver,
dann jede Repair-Runde, die den Worker wirklich rief), je
`{worker:"merge"|"repair", model, backend?, status, ms, conflictedFiles}`. `status` ist die
NARRATIVE des Workers, nie das Urteil von git — `rebased|repaired|blocked|unparseable|error`, wobei
`unparseable` eine Antwort ohne ihren JSON-Kontrakt zählt und `error` einen Spawn, der warf oder
`FLEET_MERGE_TIMEOUT_MS` sprengte (dann ist `model` der, der gelaufen WÄRE, und nichts sonst auf der
Zeile ist beobachtet). `conflictedFiles` ist die ZAHL der Konfliktdateien, nicht die Liste — die
steht schon einmal als `conflicted` auf der Note. Dieselben Zeilen stehen in
`lane-outcomes.jsonl` (`LaneOutcome.resolverRuns`), weil „welches Modell hat die Zeilen der Lanes
gewählt, die später revertet wurden" eine Frage über LANES ist und die Note an einem COMMIT hängt.
**Abwesend, nie `[]`**: ein sauberer Rebase spawnt keinen Worker, und „kein Worker lief" ist ein
anderer Satz als „ein Worker lief null mal". Aggregiert liest `./state.sh` sie unter „land health"
(`resolver: N runs … · first-try k/M`).

**Quer zu beiden Pfaden, seit W5b:** `hubPush` kann auf der Note JEDES Lands stehen, das `main`
bewegt hat — der Push haengt im Choke-Point (`server.ts#recordLand` ruft `server.ts#pushLandToHub`),
durch den sauberer Auto-Land, Owner-Confirm und Boot-Nachholung gleichermassen laufen.
`{ok:true, remote, sha}` heisst: der gelandete Commit liegt ff-only auf der Nabe;
`{ok:false, remote, reason}` (git-Stderr, auf 500 Zeichen) heisst: er liegt nur auf dieser Maschine.
**Fehlt das Feld, war kein `FLEET_HUB_REMOTE` gesetzt — nie „der Push ging gut".** Ein rotes
`hubPush` faellt das Land nicht: `verify` und `landed` bleiben, was sie waren, und es gibt weder
Retry noch Rebase gegen die Nabe. Begruendung und Beweis:
`docs/dual-host-topologie-entscheidung-2026-09-05.md` §6.

### Aktor-Provenienz: wer den Integrations-Branch bewegt hat

Bis 2026-08-23 beantwortete die `fleet/land`-Note nur `confirmedByHuman` — ein Land, das eine
Session durch Lesen von `fleet.json` und Ruf der OWNER-Route gemacht hat (einmal gemessen,
`9cc8b1e`), war im Register BYTE-IDENTISCH mit einem Owner-Akt vom Board. `LandProvenance.actor`
schliesst genau das: nicht den Zugriff auf das Token, sondern die Unfähigkeit des Registers, die
Aktor-KLASSE überhaupt zu benennen.

**Drei Arme, und der dritte ist kein Default:**

- `{kind:"owner", via:"cookie"|"bearer"|"query", suspect?}` — `via` ist der Token-KANAL, den
  `tokenFrom` ohnehin schon gelesen und dann weggeworfen hat: das Board schickt das Cookie, ein
  Skript Bearer, eine getippte URL `?token=`.
- `{kind:"main", slot, program, task, sessionIdMatch}` — die Self-Route. `sessionIdMatch` wird hier
  BERICHTET, obwohl die Route auf dem exakten Triple GATET: die Note ist ein Record, und ein Record,
  der die Tatsache fallen liesse, zwänge eine spätere Prüfung, sie aus einem inzwischen recycelten
  Slot zu rekonstruieren.
- `{kind:"unknown", why}` — erreichbar aus GENAU EINER Stelle: einem Land-Intent-Marker eines
  Binaries, das das Feld noch nicht kannte, beim nächsten Boot wiederhergestellt. Dort einen Owner
  zu erfinden wäre exakt die Unwahrheit, gegen die dieser Typ existiert.

**Das Feld ist PFLICHT, nicht optional.** Ein optionales Feld wäre genau bei dem Land abwesend, das
niemand zuordnen wollte. Es steht auf drei Trägern, weil jeder einen anderen Leser bedient: die
`fleet/land`-Note (reist mit dem Commit), `LaneOutcome.landedBy` (die Frage „welche Lands hat eine
Program-MAIN gemacht" ist eine Frage über LANES), und die Trail-Zeile `land_actor` (überlebt ein
Repo, das nie jemand klont). Geschrieben in `recordLand` — dem einen Choke-Point, durch den JEDES
main-BEWEGENDE Land läuft.

**Der `suspect`-Flag, eng gefasst:** ein Owner-Token-Merge über `bearer`/`query` auf einer Lane,
deren Zeile zu einem Program mit LEBENDER gebundener MAIN gehört ⇒
`actor.suspect:"owner-token-outside-board"` + Audit-Zeile `owner_token_ambient_use`. **Das Land
läuft weiter** — die eigenen Skripte des Owners nutzen Bearer. Der Cookie-Kanal des Boards wird nie
geflaggt (als Gegenprobe geprüft), sonst zählte der Flag jedes gewöhnliche Owner-Land mit.

**Dieselbe Messung liegt seit 2026-09-05 auf `POST /api/post-land-audits/adjudicate`.** Ein Urteil
über ein rotes Tier-2-Audit war auf der Adjudikations-Schiene byte-identisch, egal ob der Owner es
am Board fällte oder ein Skript mit dem aus `fleet.json` gelesenen Token. Neue Zeilen tragen
`actor:{kind:"owner",via,suspect?}`, aus demselben `tokenChannel(req)` wie der Land-Pfad. Der
`suspect`-Flag ist hier genauso eng: `via !== "cookie"` UND ein Cover des beurteilten Audits gehört
über das Outcome-Ledger (`programsForAuditRow`, Join `repo`+`branch`+`mainAfter` — nie über den
Branch allein) zu einem AKTIVEN Program mit LEBENDER gebundener MAIN; dann zusätzlich die
Trail-Zeile `owner_token_ambient_use`. Das Urteil läuft weiter, wie das Land weiterläuft.

**Ein Unterschied zum Land ist Absicht:** dort ist `actor` PFLICHT, hier OPTIONAL. Jede
Adjudikation, die vor dieser Schiene geschrieben wurde, und jede `by:"backfill"`-Zeile hat keine
Antwort — und der Loader (`adjudicationsByAudit`) liest das Feld nur bei VORHANDENEM Key. Ein
fehlender Key kommt ohne Feld zurück, nie als `cookie` und nie als `loadLandActor`s
`unknown`-Arm: „diese Zeile kann es nicht sagen" ist etwas anderes als „unlesbar".

**VERHINDERUNG ist als UNSUPPORTED klassifiziert, und zwar ehrlich:** jede Session auf diesem Host
läuft unter der Owner-uid, und `fleet.json` ist 0600, aber same-uid lesbar aus jedem Worktree.
Akquise zu stoppen bräuchte Host-Sandboxing, das der Owner ausgeschlossen hat. Was existiert, ist
ein Register, das die Klasse BENENNEN kann — nie eine Schranke.

**Trail:** ein Start schreibt `self_land_start` (Slot, Zeile, Program, Lane, Kandidat, Sprosse) —
die einzige Zeile, die sagt, dass eine MAIN GEFRAGT hat, auch wenn das Gate danach rot war. Keine
Ablehnung schreibt sie (in `e2e/programs.ts` als Gegenprobe geprüft).

### `nextAction` in der Program-Execution-Sicht

`GET /api/self/program-execution` trägt je Zeile neben `phase` jetzt `nextAction: string | null` —
abgeleitet, nirgends gespeichert, und ein ZEIGER, keine Note. Er sagt, welche Tür von dort aus die
nächste ist, nie ob die Arbeit gut ist (dieselbe Linie, die `program-phase.ts` für `phase` zieht;
in `e2e/pins.ts` als Regel über die Quelle gehalten). `null` ist eine echte Antwort und heißt „zu
dieser Zeile gehört gerade keine Tür".

| phase | nextAction |
| --- | --- |
| READY (`pending`) | `release → POST /api/self/tasks/:id/release` |
| READY (`queued`) | der Dispatch-Tick startet sie; keine Tür |
| REVIEWABLE **mit** Promotion (≠ `off`) | `inspect the diff, then land it yourself → POST /api/self/tasks/:id/land` |
| REVIEWABLE **ohne** Promotion | der Owner landet vom Board — und der Satz sagt warum |
| INTEGRATING | `{kind:"merge"}` abonnieren und den Ausgang dort lesen |
| OWNER_GATE | eine offene Frage wartet auf den Owner |
| RUNNING · CONTINUE · UNKNOWN | `null` |

### `authority.lineage` — die persistierte Program-MAIN-Lineage

Seit 2026-09-02 trägt jedes Program einen vierten Record, `lineage` (`server.ts#ProgramLineage`),
und `GET /api/self/program-execution` rendert ihn wörtlich unter `authority.lineage` als
`{entries, dropped}` — `null`, wenn kein Record existiert. Er ist **weder Content noch Promotion
noch Founding**: Content darf eine Session VORSCHLAGEN, die Promotion ERTEILT der Owner, der
Founding-Marker lebt für eine Transition — die Lineage ist eine GESCHICHTE, an die nur
Autoritätsbewegungen anhängen und die nichts umschreibt. Aus `audit.jsonl` abgeleitet wird sie
absichtlich nicht: das Ledger ist Prosa, unbegrenzt, wird nie als State geladen. Vorher stand die
Herkunft einer MAIN-Bindung nur dort (`program_main_rebound … replaced slot:7`) und eine
Nachfolgerin konnte nicht rekonstruieren, wer wann die Autorität hielt.

**Eintrag:** `{slot, openedAt, sessionId, boundAt, via, endedAt, endedBy}`. `via` sagt, WIE der
Eintrag die Autorität bekam, `endedBy`, WIE das Halten endete; `endedAt`/`endedBy` sind gemeinsam
`null` (offen) oder gemeinsam gesetzt. Nur der neueste Eintrag darf offen sein.

| `via` | geschrieben von |
| --- | --- |
| `bootstrap` | der erste Bootstrap-Bind eines Programs (`bootstrapProgramMainReserved`) |
| `rebound` | ein Bootstrap über eine STALE Bindung — derselbe Moment wie die Trail-Zeile `program_main_rebound` |
| `succeed` | die Nachfolge (`succeedProgramMain`), der Eintrag der Nachfolgerin |
| `backfill-unknown` | genau EIN Eintrag beim Laden eines Programs, das `main` hatte, bevor der Record existierte — `boundAt` aus `main` kopiert, nie eine erfundene frühere Geschichte |

| `endedBy` | Moment |
| --- | --- |
| `succeed` | am Bind der Nachfolgerin, im selben Save wie `main` |
| `retire` | der gebundene Occupant wurde abgebaut (`teardownSlotOccupant`, beobachtete Zeit); die Bindung selbst bleibt stehen — das IST „stale" |
| `rebound` | die Bindung wurde beim Rebind stale VORGEFUNDEN und ihr Ende nie beobachtet |
| `replaced` | ein Bootstrap über eine stale Bindung hat sie mit seinem Founding-Marker fallen gelassen und ist dann gescheitert — das Program steht aktiv und ungebunden, ohne Nachfolgerin |

**Der erste Close gewinnt.** Ein Rebind über eine Bindung, deren Abbau beobachtet wurde, lässt
`retire` samt Zeit stehen und trägt den Rebound nur als `via` des NEUEN Eintrags — sonst läse sich
ein toter Occupant, als hätte er bis zum Rebind gehalten. Jede Bewegung schreibt Close und Append
**im selben Save wie `program.main`** und rollt beide zurück, wenn der Save scheitert.
`backfillProgramMainSessionId` trägt eine nachträglich bekannte Session-Id auch in den Eintrag
derselben Belegung — ein Eintrag trägt nie eine Session-Id, die sein Slot nicht hatte.

**Deckel:** höchstens `PROGRAM_LINEAGE_MAX` (50) Einträge; der älteste fällt zuerst und wird in
`dropped` gezählt (Pin in `e2e/pins.ts` gegen diese Zahl und die Zustandsnamen oben).

**Loader, versioniert, default-deny** (`loadProgramLineage`, dieselbe Disziplin wie
`PromotionPolicy`): ein Record, der nicht exakt ein wohlgeformtes v1 ist (fremder Key, falsche
Version, unbekannter Zustandsname, mehr als 50 Einträge, ein offener Eintrag, der nicht der
neueste ist), lädt als ABSENT — nie feldweise repariert, nie mit einem Backfill überdeckt (das
sähe aus wie eine Legacy-Zeile und verstecke den Verlust) — und wird GEMELDET: eine `server.log`-
Zeile und die Trail-Zeile `program_lineage_unreadable` (Program-Id + Parse-Fehler, nie ein
Eintrag). Der Backfill gilt nur für Zeilen, die den Key nie hatten.

**Der `unknown[]`-Satz nennt die Lücke nur, wo eine ist:**

| Record | Satz |
| --- | --- |
| absent | `1 lineage gap: no persisted Program-MAIN lineage exists; earlier bound sessions of this program are not reconstructible.` |
| erster Eintrag `backfill-unknown` | `1 lineage gap: lineage begins at <boundAt>; earlier bound sessions are not reconstructible.` |
| `dropped > 0` | `<n> oldest lineage entries were dropped at the cap of 50; those bound sessions are not reconstructible.` |
| vollständig | keine Lineage-Zeile |

`sessionIdMatch` und der Rest von `authority` sind unverändert. `GET /api/programs` trägt den Record
im Program-Row mit (`publicProgram` spreizt das Program); der 4-Feld-`ProgramDigest` bleibt.

## model — `POST /api/slots/:id/model` (OWNER-Route, nicht `/api/self/*`)

Schreibt Modell und/oder Effort eines LEBENDEN Slots **in den Datensatz** — ohne Respawn. Der Datensatz
ist, was der 2-s-Heal, `↻ restart` und die Nachfolge lesen; bis 2026-09-02 fielen alle drei still auf den
Spawn-Wert zurück, auch wenn die Pane längst per `/model` woanders lief (gemessen: Slots 1/5/6/9 auf
`claude-opus-5[1m]` im Datensatz, Fable 5.1 in der Pane).

```
curl -X POST http://<fleet-host>:<port>/api/slots/<id>/model \
  -H "authorization: Bearer $FLEET_TOKEN" -H "content-type: application/json" \
  -d '{"model":"claude-fable-5-1[1m]","effort":"high"}'
```

- Body `{model?, effort?}`; mindestens ein Feld, sonst 400. Abwesendes Feld = unverändert; `null`/`""`
  löscht (Modell → Fleet-Default `DEFAULT_MODEL`, Effort → kein Flag).
- Validierung byte-gleich mit `open`/`dispatch`, beurteilt nach der Harness des Slots (`modelOf`/`effortOf`
  in `server.ts`): claude → `MODEL_RE`, deklarierte Fremd-Harness → `HARNESS_MODEL_RE`, Effort nur aus
  `effortLevels` des Adapters (codex etwa `low…ultra`, Adapter ohne Effort-Begriff lehnen jeden Wert ab).
  Ungültig = 400, Datensatz unverändert. Das `[1m]`-Suffix bleibt in der Spawn-Zeile single-quoted
  (`agentCmd`), die Route weitet nichts auf.
- Antwort `{ok, model, effort}`; persistiert (`saveState`), Trail-Zeile `slot_model` mit dem
  resultierenden Paar. `GET /api/sessions` (Effort weggelassen, wenn null) und `GET /api/steward/sessions`
  (seit 2026-09-02 mit `effort`) zeigen den neuen Stand sofort.
- Owner-only: Steward-Token 403 (out of scope), Self-Token 401. Kein Board-Knopf, API-only wie `open`+`label`.
- **Kein Sensor für das Laufzeit-Modell der Pane** — was `/model` dort eingestellt hat, weiß der Server
  nicht; die Route macht den Datensatz zur Wahrheit für den NÄCHSTEN Spawn, nicht die Pane zur Wahrheit für
  den Datensatz. Beweis der Pane-Hälfte: `./e2e-claude-gate.sh` (Rewrite, dann `↻ restart`, Spawn-Zeile trägt
  `--model '<neu>'` und `--effort '<neu>'`, gleicher `--resume`-Pin).

## dispatch — `POST /api/tasks/:id/dispatch` (OWNER-Route, nicht `/api/self/*`)

Sie steht hier, weil sie die eine Tür ist, durch die eine Zeile aus dem Queue-Rail in eine Lane
tritt und dabei ihr **Spawn-Triple** (`harness`/`model`/`effort`) trägt — dasselbe Triple, das
`POST /api/self/tasks` (§tasks) an der Filing-Tür SET-Zeit-validiert und als `Task.spawn`
persistiert. Owner-Route hinter `tokenGate`; der `▸ start lane`- und der `▸ clarify first`-Knopf
der Task-Workbench sind ihre beiden Aufrufer (`src/client.ts#qDispatchBody`).

**Per-Feld-Vorrang, serverseitig** (`server.ts`, Route `taskDispatch`): ein im Body genanntes Feld
gewinnt; ein fehlendes Feld (abwesend, `null` oder `""`) fällt auf die **eigene persistierte Wahl
der Zeile** (`taskSpawnOf(t)`, `Task.spawn`); fehlt beides, läuft der Default-Adapter. Die
kombinierte Wahl wird als GANZES gegen die effektive Harness geprüft — Harness zuerst, dann Modell
und Effort gegen genau diesen Adapter — und zwar VOR der Suche nach einem freien Slot: eine
ungültige Kombination bekommt ihre 400 und keine 409 über Kapazität, und es wird nichts gespawnt.
Die drei Ablehnungen, wörtlich (und wortgleich mit der Blockade, die der Client VOR dem Klick
zeigt — `e2e/tasks.ts` hält beide Texte gegen den Live-Server gleich):

- `unknown harness (one of: claude, pi, …)` (400)
- `harness <id> takes no model` · `bad model (must match …)` (400)
- `harness <id> takes no effort` · `bad effort (one of: low, medium, …)` (400)

**Was der Client sendet — zwei Akte, zwei Handler, zwei Bodies:**

```
# ▸ start lane: GENAU die vom Owner gewählten Felder des Triples, ungewählte sind ABWESEND
#   (so bleibt der Vorrang oben die Semantik: Zeile, dann Default). Auf einer rohen Zeile —
#   keine Analyse oder ein Verdikt, das den Owner wollte — reitet zusätzlich `acknowledged:true`
#   (der bestehende Raw-Start-Vertrag; die Audit-Zeile trägt dann `raw-acknowledged`).
POST /api/tasks/<id>/dispatch  {}                                          # alles Default
POST /api/tasks/<id>/dispatch  {"harness":"codex","model":"openai/gpt-5-codex","effort":"high"}
POST /api/tasks/<id>/dispatch  {"effort":"max","acknowledged":true}         # roh, bestätigt

# ▸ clarify first: dasselbe gewählte Triple unter `clarify:true`, NIE `acknowledged`
POST /api/tasks/<id>/dispatch  {"clarify":true}
POST /api/tasks/<id>/dispatch  {"clarify":true,"harness":"codex","effort":"high"}
```

Keiner der beiden Bodies trägt einen Status: die Zeile bewegt der Server. **Und er bewegt sie in
beiden Akten** — auch `clarify:true` öffnet eine Lane (die Clarify-Lane, `clarify-prompt.ts`),
setzt die Zeile auf `sent`, bindet sie an den Slot und parkt den Slot mit `awaiting:"owner"`;
die Note lautet `clarify lane <branch> — settling the done-criterion with you`. Ein Clarify-Start
ist also KEIN statusneutraler Akt, sondern eine Lane mit anderem Gründungsbrief und ohne
Exit-Footer (`e2e/tasks.ts` §(i) pinnt genau das). Was ihn vom Start trennt, ist der Brief und
das Warten, nicht die Zeile.

**Was die Zeile VOR dem Klick zeigt** (`src/client.ts#qSpawnRow`): die drei Picker aus dem
servergelieferten Katalog (`GET /api/harnesses`; Modell-Feld und Effort-Liste folgen der
EFFEKTIVEN Harness und fehlen, wo der Adapter das Konzept nicht hat), darunter die effektive
Wahl je Feld mit Herkunft — `picked` (im Body), `row` (persistierte Wahl der Zeile, aus
`GET /api/tasks`, nie aus dem Poll-Digest) oder `default` (abwesend; DEFAULT_SPAWN) — und, falls
die Kombination die 400 oben bekäme, die Ablehnung als Blockzeile: beide Knöpfe sind dann
deaktiviert. Ein leerer Katalog (Fetch nicht angekommen) blockiert nichts; der Server urteilt
weiter. Die Wahl lebt je Task-ID über den 2-s-Repaint hinweg und wird beim Schließen des
Fensters und beim Start verworfen. Eine Grenze, die der Client NICHT auflöst: die Route kennt
kein „Effort der Zeile löschen" — `""` ist dort abwesend, also fällt die Zeile auf ihren
gespeicherten Wert zurück; wer eine Zeile mit gespeichertem Effort auf eine Harness ohne Effort
setzt, sieht die Blockade und kann nur eine Harness mit Effort wählen oder die Zeile neu anlegen.

## profile — `POST /api/programs/:id/profile` (OWNER-Route, nicht `/api/self/*`)

Sie steht hier aus demselben Grund wie §promotion: sie schreibt einen Record, den eine Session an
anderer Stelle VERBRAUCHT — nur ist es diesmal keine Erlaubnis, sondern die **Ausführungsumgebung**,
in die eine Program-MAIN gegründet und in der sie danach beurteilt wird. Auch sie ist eine
**Owner-Route hinter `tokenGate`**: ein Self-Token bekommt 401, nicht 409. Eine Session, die ihn
schreiben könnte, würde sich ihre eigene Umgebung aussuchen. Genau EIN Schreiber im Server, und
kein Loader legt ihn je an.

```
curl -X POST http://<fleet-host>:<port>/api/programs/<program>/profile \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"profile":{"v":1,"kind":"game-maker"}}'   # erteilen
curl -X POST http://<fleet-host>:<port>/api/programs/<program>/profile \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"profile":null}'                          # löschen (idempotent)
```

**Der Record ist geschlossen und versioniert:** `{v:1, kind:"game-maker"}`. `confirmedAt` stempelt
der Server. Der Body liest ausschließlich `profile`; jeder weitere Top-Level-Key ist 400, jeder
unbekannte Key INNERHALB des Records ebenso, `v !== 1` ebenso, ein `kind` außerhalb der Liste
ebenso. **Abwesenheit ist die exakte Legacy-Form** — die Standard-MAIN, Byte für Byte.

**Der Loader degradiert zur ABWESENHEIT, nie feldweise** (wie bei §promotion) — und er nimmt dabei
nie die Program-Zeile mit: ein unlesbares Profil kostet den Record, nicht die bestätigte
Owner-Arbeit.

**Unveränderlichkeit, und warum sie hier strenger ist als bei der Promotion.** Eine Promotion wird
pro Land ausgegeben und an der Land-Route frisch geprüft; ein Profil wird EINMAL ausgegeben, bei der
Gründung — Gründungstext, Maschinenprüfung und Nachfolge-Gate hängen alle daran. Deshalb:

| Zustand | Schreiben |
| --- | --- |
| `complete` | echte Änderung 409 — Receipts, Outcomes und Briefs sind gegen die gelaufene Umgebung datiert |
| `active` **und** LIVE gebundene MAIN | echte Änderung 409 — die Session wurde unter diesem Vertrag gegründet |
| `active`, Bindung stale oder abwesend | erlaubt — genau hier soll die nächste Gründung eine frische Owner-Entscheidung benutzen |
| identische Erteilung / Löschung | **vor allen** Inflight-/LIVE-/Complete-Gates `ok:true` als echter No-Op; kein Audit, kein Save, `confirmedAt` wird NICHT neu gestempelt |

**Die Maschinengrenze von `game-maker`** wird aus git-Fakten abgeleitet, nie aus Dateinamen oder
Prompt-Text: `--absolute-git-dir` gegen `--git-common-dir` für die Checkout-Art, und der
**kanonische `--git-common-dir` für die Repository-IDENTITÄT** (alle worktrees eines Repositories
teilen einen Object-Store). Eine game-maker-MAIN darf nur in einem **dedizierten linked worktree
eines Ziel-Repositories** gegründet werden. Abgelehnt (400) werden daher drei Formen, jede mit
eigenem Satz:

| cwd | Warum |
| --- | --- |
| Fleet-Control-Checkout | eine Game-MAIN, die Fleet mutiert, ist nicht der Produktakt, den der Owner gewählt hat |
| PRIMÄR-Checkout des Ziel-Repos | der Baum, in dem alles andere steht, inklusive des Owners |
| **linked worktree von FLEET selbst** | hat einen eigenen toplevel, liest also `target-repo` UND `linked` — nur die Repository-Identität lehnt ihn ab |

Eine **unlesbare** Identität lehnt ebenfalls ab: ein Gate, das seine eigene fehlende Messung als
die erlaubende Antwort liest, ist keins.

**Dediziert heißt dediziert (409).** Der Schutz gilt nicht nur in einem Preflight-Snapshot:
`gameMakerTreeLeases` reserviert den angefragten Baum synchron und kanonisiert ihn nach dem git-
Preflight; jede `openSlot`-Variante meldet davor ein `OpenSlotIntent` und prüft dieselbe Grenze. Nach
Preflight und Slot-Auswahl trägt das Program zusätzlich den server-erzeugten, geschlossenen
Sicherheitsmarker `founding` v2. Er nennt Profil, Versuch, Modus, Target-Root, Startzeit sowie Target
und gegebenenfalls Vorgänger jeweils mit `{slot, openedAt, selfTokenHash}`. Der Hash ist der
kleingeschriebene SHA-256 des rohen Slot-Tokens; das Token selbst steht nie im Marker. Marker und
Bootstrap-Fallback werden durabel geschrieben, **bevor** `openSlot` beginnt; die exakt passende
Slot-Zeile wird danach durabel, bevor der Pane-Spawn beginnt. Kein Request-Body darf Attempt,
`openedAt`, Token oder Hash wählen. Der gemeinsame Tree-Gate schützt Game-Maker-Live-Bindungen,
synchrone Leases und persistierte Game-Maker-Foundings. Nur der interne Versuch mit exakt demselben
Marker und dem prozesslokalen rohen Target-Token darf seinen reservierten Slot öffnen.

Damit schließen beide Reihenfolgen — Game-Maker zuerst oder generischer Open zuerst — bevor zwei
Sessions denselben Baum betreten, auch über einen Server-Neustart hinweg. Eine laufende Game-Maker-
MAIN hält ihren konkreten linked worktree bis Kill oder Program-Abschluss exklusiv. Ein sibling
linked worktree desselben Repositories bleibt erlaubt; Standard gegen Standard bleibt unverändert.
Die Nachfolge besitzt als einzigen durablen Permit exakt `{slot, openedAt, selfTokenHash}` ihrer
gebundenen Vorgängerin und lehnt jede weitere Besetzung ab. Als laufende Autorität reicht dieser
persistierte Permit nicht:
bis zum Bindungsschnitt muss zusätzlich die vor dem ersten Await erfasste Live-Identität
`{slot, openedAt, cwd, selfToken}` unverändert im Vorgänger-Slot stehen.

Preflight-Ablehnungen gelten für Bootstrap UND Nachfolge und kommen, BEVOR ein Slot geöffnet, eine
Bindung bewegt oder ein Context-Receipt geschrieben wurde. Sobald der Sicherheitsmarker existiert,
ist er selbst die Crash-Barriere. Neue Standard- und Game-Maker-Versuche schreiben beide v2;
Standard erhält dadurch keine Baum-Exklusivität, sondern nur Schutz für seinen exakten Target-Slot.
Den Live-Identitätscheck bis zum Bindungsschnitt teilen Standard- und Game-Maker-Succession, weil
Owner-Kill dieselbe Autorität in beiden beendet.

**Restart und der eine Erfolgsschnitt.** Der Loader akzeptiert den geschlossenen v2-Satz für
Standard und Game-Maker sowie v1 ausschließlich als Game-Maker-Legacy. Null, unbekannte Versionen
oder Felder, falsche Hash-/Profilformen, unmögliche Modus-Bindungen und doppelt belegte Target-Slots
verweigern den Serverstart; die State-Datei bleibt dabei unverändert. Nach State-/Slot-Load und
tmux-Adoption, aber vor Self-Heal und `Bun.serve`, wird ein valider offener Versuch deterministisch
zurückgerollt: ohne Kandidat wird nur der stale Marker gelöscht; der exakt passende Kandidat wird
zuerst beendet, seine tmux-Abwesenheit bewiesen und erst dann werden Slot und Marker gelöscht. Ein
recycelter Target-Slot in einem anderen Root bleibt unangetastet und nur der Marker fällt. Beim
Standard-Founding verweigert ein recycelter Target-Slot im selben Root mit anderem Token-Hash den
Start; andere Slots im selben Root sind kein Konflikt. Beim Game-Maker verweigert jede
widersprüchliche Belegung im geschützten Baum den Start und lässt Marker und Pane stehen. Eine
Succession behält dabei ihre alte `Program.main`-Bindung. Es gibt weder
Brief-Replay noch Auto-Bind; ein bereits geschriebenes Receipt darf verwaisen und ist nie
Bindungsquelle. Nach Target-Open, nach Brief-Send vor dem Receipt und nach dem Receipt unmittelbar
vor dem Bindungsschnitt wird die vollständige Live-Identität erneut geprüft. Owner-Kill oder Recycle
der Vorgängerin ergibt 409 und räumt nur den exakten Kandidaten auf; ein bereits geschriebenes
Receipt bleibt dabei als verwaiste Evidenz stehen. Erfolg schreibt zuerst das Receipt und verschiebt
danach in genau einem durablen Program-State-Cut die Bindung, entfernt `founding` und pensioniert bei
Nachfolge exakt den Vorgänger. Owner-Kill eines exakten Founding-Targets benutzt denselben
kill→Abwesenheitsbeweis→Slot-/Marker-Cleanup-Pfad.

Kann `tmux new-session` den Pane-Start nicht innerhalb seiner eigenen Frist belegen, antwortet das
Founding mit 503, `availability:"unknown"` und nur `{attemptId, slot, openedAt}` unter `affected`.
Ist die exakte Abwesenheit beweisbar, lautet `recovery:"rolled-back"`; andernfalls bleibt Marker samt
Kandidat erhalten und `recovery:"pending"`. Ein Retry eines pending Markers öffnet keinen weiteren
Slot und nennt dieselbe `affected`-Identität. Rohe Tokens und ihre Hashes verlassen die State-Grenze
nicht über diese oder die Program-API.

Die tmux-Grenze ist dabei dreiwertig: `present`, `absent`, `unknown`. Nur eine erfolgreiche
Session-Aufzählung beweist Zugehörigkeit oder Abwesenheit; ein fehlgeschlagener Probe- oder
Pfad-Read ist `unknown`, nie HOME und nie Abwesenheit. Beim Game-Maker wird vor dem Löschen eines
stale oder fremd recycelten Markers zusätzlich jeder live beobachtete Slot-Root **und jeder geladene
`Slot.cwd`-Root** gegen den geschützten Target-Root geprüft: eine persistierte Zeile ohne Pane ist
ein bevorstehender Self-Heal, nicht Abwesenheit. Nur die exakt gebundene Succession-Vorgängerin samt
Token-Hash ist ausgenommen. Eine andere Session oder dormant Slot-Zeile im selben Baum lässt den
Start mit Marker und Zeile/Persistenz unangetastet verweigern; ein sibling linked worktree bleibt ein
anderer Baum. Standard scannt diese anderen Slots bewusst nicht.

**Lifecycle-Schreiber sind während der Gründung gesperrt.** Solange ein Program-MAIN-Founding dieses
Programs läuft — synchron in `programBootstrapInflight` oder durabel in `Program.founding` —
antworten eine **echte Profiländerung**, ein zweites Founding und `complete` mit 409. Die Gründung
liest das Profil ZWEIMAL — an der Maschinenprüfung und beim Bauen des Briefs — und dazwischen liegen
Slot-Öffnung, Boot-Grace und Readiness-Wait. Ohne diese Sperre könnte ein Standard-Bootstrap, dessen
Maschinenprüfung niemand gefahren hat, einen game-maker-Brief ausgeliefert bekommen; `complete`
könnte eine später gebundene MAIN an ein terminales Program hängen. Ein identischer Profil-Retry
antwortet vor allen Sperren 200 und schreibt nichts.

`complete` ist der Owner-Akt, der die Game-Maker-Exklusivität freigibt. Er ist nur wahr, nachdem
der Owner die Produktarbeit bewusst beendet oder stillgelegt hat; ein laufendes `founding` bleibt
409. Completion beendet eine vorhandene MAIN-Pane nicht automatisch — Pane-Retirement und
Program-Lifecycle bleiben getrennte Owner-Entscheidungen.

**Die Nachfolge hat ein zweites Gate.** Das generische bleibt unverändert (HANDOFF.md existiert, ist
sauber, jünger als die Session). Für `game-maker` wird zusätzlich die COMMITTETE HEAD-Fassung
gelesen: ihr erster Abschnitt muss höchstens 4096 Bytes groß sein, exakt `## Current game
checkpoint` überschrieben sein und genau die sieben einzeiligen Felder `Build` (40 Zeichen
kleingeschriebenes Hex) · `Launch` · `Last replay` · `Experience` · `Open defect` · `Next` ·
`Critic` tragen — keine Zeile mehr. Fehlend, doppelt, mehrzeilig, leer oder zu groß ⇒ 409, ohne
Slot, ohne Rebind, ohne Receipt. **`Build` muss zusätzlich ein Commit sein, das dieses Repository
HAT** (`git cat-file -t`): vierzig Hex-Zeichen sind eine Form, kein Build, und eine sha, die nichts
benennt, macht den Vergleich der Nachfolgerin zu einer unbeantwortbaren Prüfung im Gewand einer
Prüfung. Dass Fleet damit den GESPIELTEN Commit beweist, folgt daraus NICHT — das bleibt die eigene
Beobachtung der Session und bleibt bei Abweichung `unknown`.

Checkpoint-Feldreihenfolge: `Build`, `Launch`, `Last replay`, `Experience`, `Open defect`, `Next`, `Critic`.
`Last replay` benennt, soweit anwendbar, den exakten Seed, den realen Input und die
Capture-Evidenz; es ist kein achtes Feld.

**`carry` ist für eine game-maker-Nachfolge 409.** Es gibt genau EINEN Übergabekanal, und das ist
der committete Checkpoint: lesbar für Nachfolgerin und Owner-Proof, und er überlebt die Pane.
`carry` ist ein unpersistierter Satz im Prompt; beide zusammen wären zwei Kanäle, die einander
widersprechen können. Abgelehnt statt ignoriert — ein still verworfener carry ist eine Übergabe, die
ihre Autorin für zugestellt hält. Für Standard-Programs bleibt `carry` unverändert.

Ein frischer sensorischer Kritiker liest diesen Checkpoint **nie**: weder Pfad noch Inhalt dürfen in
seinem Pack stehen. Er wird erst nach einem Playable operator-orchestriert und erhält nur den
versiegelten Build, Launch, Real-Input und die Captures — keine Game Card, kein `HANDOFF.md`, keine
Hypothesen oder Rationale. `Experience`, `Open defect`, `Next` und frühere `Critic`-Urteile bleiben
damit predecessor→successor-/Owner-Evidenz statt Vorprägung des frischen Blicks.

**Projektion:** `GET /api/programs` trägt Profil und einen laufenden `founding`-Marker im Program-Row,
entfernt aus v2 aber beide `selfTokenHash`-Felder. `GET /api/self/program-execution` trägt das Profil
als `program.profile` (`null` = Standard-MAIN), damit die gebundene MAIN einen typisierten Sensor hat
statt ihre eigene Prosa zu lesen. Der heiße `ProgramDigest` der 2-s-Sessions-Poll bleibt unverändert
bei vier Feldern.

**Trail:** jede Erteilung und jede echte Löschung schreibt `program_profile`.


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

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
- **Für einen ARBEITENDEN Controller oder eine MAIN ist `idleSec:0` der einzige Wert, der zustellt.**
  Der Default 60 verlangt eine Minute Pane-Ruhe, und eine Session, die zwischen zwei Zügen nie so
  lange still ist, bekommt nichts — gemessen 2026-09-07 04:47–05:20 an Slot 10: zwei Lane-Watches
  endeten `subject-gone`, weil die Lane gelandet und ihr Slot geschlossen war, ehe die Pane 60 s
  ruhig wurde, und ein Merge-Watch blieb `pending`. Dieselbe Messung nennt die zweite Hälfte der
  Regel: jedes unzugestellte ODER unquittierte Event hält Zustellbudget
  (`server.ts#slotDeliveryBudget`), weshalb dort „max 5 active watches per slot" stand, während nur
  drei Watches armiert waren — also die zugestellten Events auch ACKEN
  (`POST /api/self/events/:id/ack`). `ctl.sh watch` setzt `idleSec` deshalb von sich aus auf 0 und
  `ctl.sh events --ack` räumt den Deckel (`docs/controller.md` §Werkzeuge).
- Ein `slot`-/`from`-Feld im Body wird ignoriert — die Route bindet hart an deinen Token-Slot, genau wie
  `/api/self/autos`. Sie kann strukturell in keine fremde Pane tippen.
- Deckel: **5 armed pro Slot** (`WATCH_MAX_PER_SLOT`, geteilt mit dem Owner-Pfad). Ein zweites noch
  armed Abo auf dasselbe Ziel gibt DENSELBEN Watch zurück (`existing:true`), nie einen zweiten.
- Reicht eine Lane ihren Fleet-Report selbst ein, entwaffnet der Server den armed Lane-Watch genau des
  Empfänger-Occupants auf genau diese Lane. `lastResult` nennt die Report-ID, `firedAt` bleibt `null`,
  und der Watch-Tick mintet danach kein redundantes `lane-ready`-Event. Merge-Watches bleiben armed:
  ein Land ist ein anderer Fakt. Program-Reports verwenden dafür die lebende Program-MAIN-Bindung,
  programlose Reports ihre exakte Lane-Watch-Evidenz; ein Owner-Inbox-Report entwaffnet nichts.
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
- **Seit 2026-09-13 trägt `lane-ready` das eigene Wort der Lane** (`lane-signals.ts#LaneSelfWord`,
  gelesen beim ZUSTELLEN, nicht beim Minten, gejoint auf Slot + `openedAt` + Branch):
  `Terminal report from that lane: NONE on file … PREMATURE` oder `… <reportId> (status=…) is on file`,
  dazu ein noch `open`/`claimed` Preview-Suite-Angebot dieser Lane. Anlass, gemessen 2026-09-12 an
  Program-MAIN Slot 6: drei von vier Weckrufen trafen eine Lane, die ihre Verifikation im HINTERGRUND
  fuhr (Suite-Ticket, Monitor, Shells) — formal idle + clean + ahead>0, aber ohne Report; nur die
  vierte hatte gefilt. Das Feld trennt den vorzeitigen vom echten Fall ohne Pane-Lesung, **ersetzt sie
  aber nicht**: eine Lane kann nach dem Report weiterarbeiten (Slot 1 bot danach noch eine Suite an).
  `not read` heisst, der Join konnte nicht laufen — nie „keiner". Das Prädikat selbst ist unverändert;
  ein Kind-Prozess-Sensor existiert nicht (eine idle Claude-Pane hat dauerhaft Kinder: caffeinate, MCP).
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
- **Ein belegter Composer wird nicht jeden Tick neu angetippt — der Hold-Backoff (K1, seit
  2026-09-11).** Eine Vor-Paste-Verweigerung sagt etwas über eine PANE, und die ändert sich zwischen
  zwei Ticks nicht. Nach der ersten Verweigerung wartet der Server deshalb **2 Ticks**, dann 4, 8,
  … bis zur Decke von **12 Ticks** (`HOLD_BACKOFF_BASE_MS`/`HOLD_BACKOFF_MAX_MS` in `server.ts`,
  beide aus `FLEET_AUTOS_TICK_MS` abgeleitet — bei der Default-Kadenz 5 s also 10 s bis maximal
  60 s). Was du daraus lesen darfst:
  - **Die Decke ist die Zusage — plus einen Tick, und das ist keine Formalie:** ist dein Composer
    frei, wird die Zeile nach `HOLD_BACKOFF_MAX_MS` wieder angetippt, aber angetippt wird nur AUF
    einem Tick. Die belastbare Schranke ist also `HOLD_BACKOFF_MAX_MS + ein Tick` (plus die Dauer
    der Probe selbst). Gemessen am 2026-09-11 im Abnahmelauf: 3098 ms gegen eine Decke von 3000 ms
    bei `tickMs 250` — der Worst Case, nicht ein Ausreißer. Der Check in `e2e/watch.ts` prüft gegen
    6000 ms, also das Doppelte der Decke; er kann diese Differenz daher nicht sehen. Ein Backoff
    WÄCHST nie über die Decke hinaus; ewiges Schweigen ist kein Erfolg.
  - **Der Zustand ist prozesslokal.** Ein Serverneustart beginnt mit einer FRISCHEN Prüfung (also
    früher als angekündigt, nie später) und stellt nie eine Zustellung fest, die nicht stattfand.
  - **Er gehört dem Paar (Event, Empfänger-Occupant).** Slot + `openedAt` + `sessionId`: ein
    recycelter Empfänger erbt den Retry eines toten nie, und zwei Events auf derselben Pane zählen
    getrennt.
  - **Der Trail bleibt `fleet_event_held`, wird aber lesbar:** die Zeile trägt neben dem Text
    `phase` (`entry` = erster Halt · `repeat` = weiterer Halt · `end` = der Hold ist vorbei),
    `holds` (laufende Zahl), `nextProbeInMs` (die Stille, die sich der Server gerade selbst
    verspricht) und `heldMs` (wie lange diese Pane die Zeile hält). Genau eine `end`-Zeile schließt
    einen Hold — beim Zustellen, bei einem Paste, der nicht mehr vorab verweigert wurde, oder wenn
    die Zeile terminal wurde (`subject-gone`, `receiver-gone`, gepruned).
  - **Ein übersprungener Tick schreibt NICHTS**: kein Send, kein State-Save, keine Trail-Zeile. Der
    Report-Pfad nennt seinen Retry-Zeitpunkt zusätzlich im vorhandenen `recovery.reason`
    („… (hold N, next probe in Xms)", relativ zu `recovery.updatedAt`); ein neues Feld dafür gibt
    es nicht.
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

- **Das 409 der Occupancy-Stufe nennt seit 2026-09-07 seinen Zustand** (`server.ts#supervisorRefusal`,
  gemeinsame Stufe aller drei Supervisor-Self-Routen): `no Supervisor binding exists …` (nie ernannt) ·
  `the Supervisor binding is STALE: it names slot N openedAt … whose occupant is gone or was replaced …`
  (ernannt, Occupant weg — die Rolle ist UNBESETZT, kein Ablehnungs-Urteil über dich) ·
  `not the bound Supervisor …` (jemand anderes hält sie). Vorher war das EIN Satz für alle drei, und
  „die Rolle ist vakant" war von innen nicht von „du bist es nicht" unterscheidbar. Neue Offenlegung
  ist das keine: die Registrierungs-Tür unten sagt jeder Session dieselben zwei Zustände. Die
  Liveness von aussen: `supervisorHealth` auf `GET /api/programs` (`docs/supervisor-succession.md` §4).
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

**Eine LANE succeedet auch — seit 2026-09-12, und auf einer eigenen Schiene** (`server.ts#succeedLane`).
Vorher war das eine 409 („a lane lands — it does not migrate"); gemessen wurde, warum diese Antwort falsch
war: Slot 7 endete am 2026-09-12 bei 48,7 % von 1M (Zweierwelle, ein roter Vorschaulauf, drei Reparaturen,
111 Suite-Wrapper- und 49 FAIL-Zeilen im Pane-Stream) — eine Lane, die zu voll ist, um gut zu arbeiten, ist
in der Regel auch zu voll, um sauber zu landen, und „dann lande eben" hieß: wirf den halbfertigen Schnitt
weg. Die Nachfolgerin ist deshalb **keine neue Lane**, sondern eine frische Session auf DEMSELBEN Worktree,
Branch, Slot, mit denselben Queue-Zeilen und demselben Program; Modell/Effort erbt sie wie oben, ein
Body-Override ist erlaubt. Es landet nichts, es wird nichts abgerissen.

- **Vorbedingung ist ein SAUBERER Baum, und sie ist hart:** `git status --porcelain` muss leer sein
  (untracked eingeschlossen), sonst 409 mit den ersten 20 Statuszeilen im Feld `status`. Der Nachfolger
  erbt den BRANCH — alles Uncommittete ist schlicht verloren, ein Staffelstab ohne Commit ist kein
  Staffelstab. Ein laufender Merge auf diesem Slot ist ebenfalls 409.
- **Der erste Prompt der Nachfolgerin** ist servergebaut und trägt: den Auftrag im Wortlaut (`brief ?? text`
  je Zeile, bei einer Welle alle Zeilen in der Sensor-Reihenfolge), `git log --oneline <base>..HEAD`, den
  Beleg, dass der Baum sauber ist, den Text des letzten `handoff`-Reports DIESES Occupants — und dieselbe
  `LANE_EXIT_FOOTER`, die jede Lane bekommt, aus derselben Konstante.
- **`carry` ist auf dieser Schiene 409**, nicht ignoriert: der `handoff`-Report IST der eine Übergabekanal
  (§fleet-report). Zwei Kanäle könnten einander widersprechen, ohne dass jemand sagen kann, welchem die
  Nachfolgerin gefolgt ist.
- **`POST /api/self/retire` bleibt für eine Lane 409.** Retire würde die Session beenden und die committete
  Arbeit als verwaisten Worktree zurücklassen; dort hat eine Lane weiterhin genau einen Ausgang.
- **Zählung:** `Slot.laneSuccessions` (persistiert) zählt die Übergaben, und die Outcome-Zeile trägt sie als
  `successions: n` — nur wenn n > 0. Sie ist das einzige Feld dort, das sagen kann, dass eine Lane über
  mehrere Sessions lief: `sessionMs` misst nur die LETZTE.
- **Der Anstoß kommt vom Server, nicht aus dem Bauch der Lane:** `tickMigrate` nudget seit demselben Schnitt
  auch Lanes, mit eigener Schwelle `FLEET_LANE_MIGRATE_PCT` (Default 40, 0 = aus) und eigenem Text.
  `FLEET_MIGRATE_PCT` bleibt der Hauptschalter — ist er 0, wird der Timer gar nicht registriert und keine
  der beiden Schienen feuert. Live ist er 0, also ist die Schiene ARMIERBAR, nicht armiert.


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

### Die Program-Retention haelt fest, was eine offene Zeile nennt (K2)

`MAX_PROGRAMS = 100` ist eine harte Konstante ohne Env-Tuer. Ueber dem Budget kuerzt
`server.ts#capPrograms` **nur COMPLETE** Programs — ein `proposed`/`confirmed`/`active` Program
wurde nie verdraengt. **Seit K2 kuerzt sie ausserdem nur UNREFERENZIERTE COMPLETE Programs:** ein
Task in `pending`, `queued` oder `sent`, dessen `programId` das Program nennt, haelt es fest. Der
Grund ist die Aufloesung, nicht die Hoeflichkeit — `programId` ist die Klammer, durch die Dispatch
(`programDispatchOn`), die `phase`-Ableitung und jede Zeile dieser Ausfuehrungssicht das Program
finden; ein verdraengtes Program liesse genau die Zeilen, die der Owner noch in der Queue sieht,
auf nichts zeigen.

Vier Saetze, die man dabei braucht:

- **Terminal haelt nicht.** `done` und `archived` nennen nichts mehr; eine Statusaenderung gibt das
  Program frei — aber **erst beim naechsten Retentionslauf**, denn nichts laesst die Kappung wegen
  eines geschlossenen Tasks neu laufen. Der Ueberhang ist kein Rueckstand, sondern ein Fakt ueber
  die Queue zum Zeitpunkt der letzten Kappung.
- **Die Liste darf ueber dem Budget stehen.** Sind alle kuerzbaren Zeilen genannt, bleiben sie alle
  — sichtbar als Referenzbedarf. Die Alternative waere der Verlust, gegen den der Deckel hier
  ueberhaupt aufgeweicht wurde. Live-Zeilen konnten das Budget schon vorher ueberschreiten.
- **Eine Referenz erfindet nichts.** Ein `programId`, zu dem keine Zeile in der Datei steht, holt
  kein Program zurueck; und eine Task-Zeile, die der Loader verwirft (malformed), haelt nichts,
  weil sie nicht existiert.
- **Die Kappung LIEST die Queue und schreibt sie nie.** Kein Task wird veraendert, umgehaengt oder
  bereinigt — ein baumelnder Zeiger wird festgehalten, nicht repariert.

Die Reihenfolge ist Teil des Vertrags: `loadState` liest die Task-Liste zurueck (`capTasks`),
**bevor** es `capPrograms(loaded, tasks)` ruft. Liefe es andersherum, fragte die Referenzpruefung
beim Boot eine leere Queue und verdraengte genau die Klammern, fuer die sie da ist. Darum ist die
Task-Liste ein **Parameter** von `capPrograms` und kein gelesenes Modul-Global: jede Aufrufstelle
muss den Stand benennen, gegen den sie entscheidet. Beweis: `e2e/programs.ts` (gepflanzter Zustand,
beide Eingaenge, sieben Gegenproben) und zwei Pins in `e2e/pins.ts` fuer Form und Reihenfolge.

**Andere Halter sind damit NICHT versorgt**, und dieser Schnitt gibt sich nicht als vollstaendiger
Retentionsvertrag aus: eine offene `AttentionRequest` traegt ein PFLICHT-`programId`, eine offene
Clarification, ein `FleetReport`, eine Lane und eine Outcome-Zeile tragen es als Provenienz. Keiner
dieser Halter haelt heute ein Program fest.

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


## notes-assign — `POST /api/self/tasks/:id/notes`

**Eine Notiz als QUELLE an eine Zeile hängen (N3, 2026-09-09).** Bis dahin erreichte eine `notiz`
eine Lane nur über die Datei-Fläche: ein Hinweis, nie ein Auftrag — und ein `erledigt` schloss sie
für JEDE benachbarte Lane. Eine Anheftung ist der fehlende Satz: *diese Quelle, unter dieser Zeile.*

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"note":"<notiz-id>","attach":true}' \
  http://<fleet-host>:<port>/api/self/tasks/<taskId>/notes
```

**Keine lane-only Route** (409 `a lane may not assign a source — …`), wie `release` und aus
demselben Grund. Der Rahmen ist die EXAKTE Bindung: das Program kommt aus ihr (eine Zeile eines anderen
Programs ist 409), das Repo aus dem eigenen Checkout (über Repo-Grenzen reicht die Tür nie), und
`by` wird als `"main"` gestempelt statt aus dem Body gelesen.

Body: `note` (Pflicht) und `attach` (Default `true`; `false` löst die Zuordnung). Ablehnungen, jede
mit ihrem eigenen Satz: eine Id, die keine Queue-Zeile trägt · eine Zeile, die keine `notiz` ist ·
eine archivierte Notiz · ein Ziel, das kein `auftrag` ist · ein Ziel, dessen Status nicht mehr
`pending`/`queued` ist (**die Zuordnung ist eingefroren, sobald eine Lane auf der Zeile gegründet
wurde** — sonst benennte ein später Anhang eine Quelle, die die Lane nie bekam, und ein später
Detach nähme ihr Arbeit weg, die sie schon tut) · der Deckel von 20 Quellen je Zeile. Ein
wiederholtes Anheften derselben Id ist idempotent.

**Ein Detach ist kein Löschen.** Die Notiz behält ihre Zeile, ihren Text, ihren Status und jedes
Urteil, das unter dieser Aufgabe schon gefällt wurde; nur die Zuordnung geht.

**Und eine angeheftete Quelle ist gegen JEDEN Weg geschützt, der ihren Text verschwinden ließe** —
eine Prüfung (`sourceHolders`), drei Türen: `capTasks` räumt sie nicht weg, solange eine
ÜBERLEBENDE Zeile sie nennt (auch eine terminale — die gelandete `done`-Zeile zeigt weiter auf die
Quelle, gegen die sie gearbeitet wurde); `POST /api/tasks/:id/delete` und `/archive` antworten
**409** und nennen die haltenden Zeilen; `POST /api/tasks/:id/kind` verweigert die Umwandlung
`notiz → …` aus demselben Grund. Freigegeben wird eine Quelle ausschließlich durch Detach.

Die OWNER-Tür daneben ist `POST /api/tasks/:id/notes` mit demselben Body und derselben Prüfkette —
eine Funktion hinter zwei Türen, damit die beiden nie zu zwei Politiken auseinanderlaufen.

Der Deckel der Vorschau im Gründungsbrief (5 Zeilen) begrenzt nur die ANZEIGE: jede angeheftete
Quelle steht im Receipt und ist über `GET /api/self/notes` im Volltext erreichbar, die überzähligen
werden im Brief als blanke Ids genannt.



## brief — `POST /api/self/tasks/:id/brief`

**Den Brief einer EIGENEN Program-Zeile schärfen, und den Schreiber am Datensatz nennen (ACP-25,
2026-09-11).** Bis dahin hatte eine Session, die eine Queue-Zeile präzisieren wollte, genau eine
Tür: die Owner-Tür `POST /api/tasks/:id/brief`. Die schreibt hart `model:"owner", edited:true`, und
beide Renderstellen machen daraus die Worte *„edited by the owner"* / *„· yours"*. Wer den Bearer
hält, aber nicht der Owner ist, erzeugte damit **zwangsläufig eine Falschaussage über eine Person** —
und eine, die ein Leser nicht als Verdacht liest, anders als `suspect: owner-token-outside-board`
auf einer Land-Notiz. Der bisherige Ausweg (die Herkunft als erste Zeile IN den Brieftext) trägt,
muss aber jede Session neu einhalten; ein Feld muss das nicht.

```
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"text":"<die exakten Bytes, die die Lane bekommen soll>"}' \
  http://<fleet-host>:<port>/api/self/tasks/<taskId>/brief
```

**Keine lane-only Route** (409 `a lane may not sharpen a brief — …`) — und dieser Ausschluss ist der
lauteste der Familie, nicht der leiseste. Zwei bestehende Doktrinen zeigen in dieselbe Richtung: der
Brief IST die Arbeitsanweisung, auf die eine Lane gegründet wurde, also schriebe eine Lane an der
eigenen Zeile **ihren eigenen Auftrag um** — genau das, wogegen `criterion` und `refine` propose von
promote trennen („the producer must not be the one who rewrites the work order it was measured
against"); und an einer FREMDEN Zeile ist es Lane-schreibt-für-Lane, die Kopplung, die
`/api/self/watch` ablehnt, weil nur der Owner sie sichtbar machen kann. Der `⚙ steward` ist **nicht**
ausgeschlossen (wie bei `release`/`notes`/`tasks`): ausgeschlossen ist er dort, wo eine stehende
Rolle einen TERMINALEN Akt als MAIN eines Programs täte (`land`, `succeed`, `retire`) — Schärfen ist
weder terminal noch programmübergreifend, und eine ungebundene Session lehnt die Bindung ohnehin ab.

**Der Rahmen ist der seiner Nachbarn, wörtlich:** das Program kommt aus der BINDUNG (nie aus dem
Body), das Repo aus dem eigenen Checkout, die Zeile muss ein `auftrag` dieses Programs sein und
`pending` oder `queued` — ab `sent` stehen die Bytes schon in einer Pane, und ein späterer Umschrieb
hieße, der Datensatz widerspräche der Lane, die er gegründet hat.

**Der Body ist GESCHLOSSEN:** nur `text`. `by`, `model`, `edited` werden mit 400 abgelehnt statt
verworfen — ein still ignoriertes Feld ist ein Feld, das der Aufrufer für berücksichtigt hält, und
genau diese drei sind die, deren ganzer Sinn ist, dass ein Aufrufer sie nicht benennen kann. Der
Autor wird aus dem Slot des Tokens gestempelt.

**Und sie überschreibt den Owner nicht.** Ein gepinnter Brief mit `by:"owner"` wird abgelehnt; ein
gepinnter Brief **ohne** Autor ebenso, mit eigenem Satz — der entstand, bevor Autoren aufgezeichnet
wurden, ist also von dem des Owners nicht zu unterscheiden, und Abwesenheit ist nie Harmlosigkeit.
Überschreibbar sind ein maschinell kompilierter Brief (`edited:false`) und die eigene frühere
Schärfung.

**Was gespeichert wird:** `TaskBrief.by` — ein geschlossenes Paar `"owner" | "main"`, in Form und
Begründung `TaskNotePin.by`. `edited:true` bleibt, was es immer war: der PIN gegen den
Brief-Sweep (`briefDue`); `by` ist die Urheberschaft. Die beiden Fakten ritten bis hierher auf einem
Boolean.

**ABWESENHEIT IST EIN DATUM, KEIN DRITTER AUTOR.** Ein Brief ohne `by` wurde geschrieben, bevor es
das Feld gab; jede Renderstelle liest diese Abwesenheit exakt so, wie sie vorher `edited` allein las,
weshalb **kein gespeicherter Brief ein Byte anders rendert als vor der Änderung**. Es gibt keine
Migration: der Altbestand wird nicht dadurch ehrlich, dass man ihn nachträglich einem Autor zuschreibt.

**Die dritte Stelle, die mitgezogen wurde:** `BriefSource` im Kontext-Receipt bekam den Wert `main`.
Ein von einer MAIN geschärfter Brief als `owner` verbucht wäre dieselbe Falschaussage an der einen
Stelle, an der sie eine RATE wird. Alte Receipts bleiben, was sie sind — sie tragen ihren Wert schon.

Die Trail-Zeile ist `main_brief` (`<taskId> program=<programId>`), eigenes Ereignis neben
`main_task` und aus dessen Grund: eine Zeile anlegen und die Bytes umschreiben, auf die eine Lane
gegründet wird, sind zwei Akte.

Die OWNER-Tür daneben bleibt **unverändert**: `POST /api/tasks/:id/brief`, jetzt zusätzlich mit
`by:"owner"` gestempelt, damit die Aussage positiv im Datensatz steht und nicht aus einer Abwesenheit
erschlossen werden muss.



## files-proposal — `POST /api/self/tasks/:id/files-proposal`

**Die VORSCHLAGS-Hälfte des Datei-Flächen-Paares (W2, 2026-09-07).** Du schlägst vor, welche
Dateien eine BESTEHENDE `auftrag`-Zeile anfasst; bestätigen kann das nur der Owner am Board. Die
Zeile wird dabei nicht gesplittet, nicht archiviert und in keinem anderen Feld angefasst — der
Vorschlag liegt NEBEN der Fläche, nie darin.

```
curl -X POST http://<fleet-host>:<port>/api/self/tasks/<taskId>/files-proposal \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"files":["server.ts","src/client.ts"]}'
```

**Diese Route ist NICHT lane-only und NICHT nicht-lane-only — eine Lane darf sie, und das ist
Absicht.** Sie ist die eine Ausnahme neben `tasks`, `release`, `land` und `attention`, und der
Grund ist dieselbe Regel andersherum gelesen: eine Lane füllt nicht die Queue, auf die sie
gegründet wurde, aber die Lane, die das Repository liest, ist die billigste ehrliche Quelle dafür,
auf welchen Dateien eine Zeile steht. Vorschlagen kostet die Zeile nichts. Die „one edge per
role"-Grenze liegt darum auf dem BESTÄTIGEN, und das ist eine Owner-Route hinter dem Owner-Token
(`POST /api/tasks/:id/files`): ein Self-Token bekommt dort 401, und ein Self-Spiegel davon
existiert nicht.

- **Ein einziger stehender Vorschlag pro Zeile.** Ein zweiter Aufruf überschreibt den ersten,
  genau wie ein zweiter `↻ refine`-Lauf seinen geparkten Vorschlag überschreibt.
- **`by` kommt vom Server, nie aus dem Body**: eine Lane wird nach ihrer Branch benannt, jede
  andere Session nach ihrem Label. Eine Provenienz, die der Aufrufer diktieren kann, ist keine.
- **`unknownPaths` MELDET, es gated nicht.** Drei Zustände, und sie dürfen nie kollabieren:
  fehlend = der getrackte Baum des Ziel-Repos war nicht lesbar (NICHT „alles getrackt"), `[]` =
  geprüft und alles getrackt, eine Liste = genau diese Pfade trackt das Repo nicht. Ein Pfad, den
  die Arbeit erst ANLEGT, ist der normale Fall dafür — deshalb lehnt die Route nicht ab.
- Antwort bei Erfolg: `{ok:true, proposal:{files,at,by,unknownPaths?}, unknownPaths}`.
- Ablehnungen:
  - **unbekannter Self-Token** (401, mit der flachen 400-ms-Verzögerung wie überall).
  - **unbekannte Zeile** (404): `unknown task`.
  - **`kind != auftrag`** (409): `<kind> is advisory — only an auftrag row carries a work surface
    to bundle by`.
  - **Status weder `pending` noch `queued`** (409): `task is <status> — a surface is proposed while
    the row is still open`.
  - **leere oder unbrauchbare Liste** (400): `files must be a non-empty list of repo-relative
    paths`. Gekappt wird auf `MAX_REFINE_FILES` (20) Pfade à 300 Zeichen, wie jede andere
    deklarierte Fläche hier.

Die Owner-Seite (`POST /api/tasks/:id/files`, Owner-Token) schreibt `{files, filesOrigin:
"confirmed"}` auf dieselbe Zeile: mit leerem Body bestätigt sie den stehenden Vorschlag, mit
`{"files":[…]}` die eigene Liste des Owners, mit `{"accept":false}` verwirft sie den Vorschlag und
lässt die Fläche unberührt. Warum das überhaupt eine Tür braucht: `filesOrigin:"confirmed"` hatte
bis dahin genau EINEN Schreiber (den refine-promote, der nur NEUE Kinder so stempeln kann) —
gemessen am 2026-09-07 trugen 0 von 48 offenen `auftrag`-Zeilen `confirmed`, und der
Landewellen-Sensor lieferte darum 44 Wellen der Größe 1, jede mit dem Grund
`flaeche-nur-abgeleitet` und 0 s Ersparnis. Eine Fläche wird NIE automatisch von `derived` nach
`confirmed` gehoben; das tauft eine Prosa-Vermutung in einen Fakt um.

**NACHTRAG 2026-09-12 — die abgeleitete Liste ist jetzt am Board bestätigbar, Pfad für Pfad.** Der
`{"files":[…]}`-Arm oben hatte am Board bis dahin genau einen Produzenten: einen geparkten
Vorschlag. Eine Zeile, die schon eine MECHANISCH ABGELEITETE Liste trug, konnte der Owner nur
bestätigen, indem er sie abtippte — gemessen am 2026-09-12 über 42 offene `auftrag`-Zeilen: 42
Wellen der Größe 1, 0 `confirmed`. Seitdem zeigt `src/client.ts#renderQueueDetail` die vorhandene
`derived`-Liste auch OHNE Vorschlag zur Bestätigung an. Zwei Eigenschaften sind der Inhalt des
Schnitts, nicht Kosmetik:

- **Jeder Pfad ist einzeln ABWÄHLBAR** (Checkbox, Default an). Grund ist dieselbe Messung: die
  abgeleitete Liste trägt KOMMANDO-ERWÄHNUNGEN als Pfade — 17 der 42 Flächen nannten
  `e2e-isolated.sh`, 18 `e2e/pins.ts`, meist weil der Brief die Verify-Zeile zitierte. Eine
  Bestätigung der rohen Liste würde genau diese Erwähnungen zu Fakten taufen.
- **Gesendet wird exakt die verbleibende Auswahl**, am Klick von den angehakten Boxen gelesen, über
  dieselbe Route und denselben `via owner`-Auditpfad wie eine getippte Liste. Eine LEERE Auswahl
  sendet nichts und sagt es — sie ist keine leere Fläche.

Kein Auto-Bestätigen, keine neue Route, kein neues Feld: die Route nahm eine benannte Liste schon
vorher an. Beweise: `e2e/tasks.ts` (w2/3b) für die Teilmenge, ihren Ledger-Eintrag und das Wiring,
plus den Reload-Check in (4) — die Prosa der Zeile nennt den abgewählten Pfad weiterhin, und
`confirmed` ERSETZT die Ableitung (`task-metadata.ts#deriveTaskMetadata`), statt sich mit ihr zu
vereinigen, sonst stünde der abgewählte Pfad nach dem nächsten Boot wieder da.



## notes — `GET /api/self/notes`, `POST /api/self/notes/:id/verdict`

**Die Notizen, die DEIN Gründungsbrief mitgebracht hat, im Volltext — und dein Urteil darüber**
(N2, `docs/notizen-verarbeitung-2026-09-06.md` §3). Der Brief nennt sie als eine Zeile je Notiz (Id
+ erster Satz + geteilte Dateien); hier stehen sie ganz.

```
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/notes
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"verdict":"erledigt","text":"<ein Satz, warum>"}' \
  http://<fleet-host>:<port>/api/self/notes/<id>/verdict
```

**Lane-only** (409 `not a lane — …`, nie 401) wie `drift`/`gate`/`criterion`/`verify-intent`/
`suite-offer`, und aus demselben Grund: beide Antworten sind über den EIGENEN Kontext-Receipt
definiert, und eine Session ohne Gründungs-Dispatch hat keinen.

**Die Berechtigungsgrenze ist der RECEIPT, nicht die Queue.** Du liest und beurteilst genau die
Ids, die dein eigener Dispatch geliefert hat — nie die 127 pending Zeilen, nie die fünf einer
anderen Lane. Eine fremde Id antwortet **409** (nicht 404: die Existenz zu verschweigen läse sich
als „die Notiz ist weg" und schickte dich eine Löschung suchen, die nie stattfand).

`GET` antwortet `{notes, receipts, gone?, verdicts}`; jede Notiz trägt zusätzlich `explicit`,
`taskIds`, `judgeableUnder` und ihre `verdicts` (die Task-Urteile, die auf ihr stehen). **`receipts` trennt zwei Abwesenheiten, die
beide als leere Liste erscheinen:** `notes: []` mit `receipts: 0` heißt „kein Dispatch dieser Lane
steht im Ledger" (ein vom Owner geöffneter Worktree, ein Receipt von vor N1), `notes: []` mit
`receipts: n` heißt „der Join hat auf deiner Fläche nichts gefunden". `gone` nennt Ids, die der
Receipt trägt und die Queue nicht mehr hält.

`POST` nimmt `verdict` (`erledigt` | `widerlegt` | `offen`; alles andere **400**) und `text`
(ein Satz, Pflicht, max. 2 000 Zeichen — ein Urteil ohne Satz ist kein Bericht). **Die Branch kommt
aus der Token-Zeile und kann im Body nie benannt werden** — dieselbe Regel wie `filesProposal.by`.

**ZWEI ARTEN VON QUELLE, ZWEI ARTEN VON URTEIL (N3, 2026-09-09).** Der Brief liefert dir Notizen auf
zwei ganz verschiedene Weisen, und die Antwort auf sie ist nicht dieselbe:

- **Datei-Fläche** (die Notiz teilt eine Nicht-Naben-Datei mit deiner Fläche — niemand hat sie
  gewählt): du berichtest wie bisher OHNE `taskId`. Der Server schreibt einen `TaskComment` mit
  `from: <deine Branch>`, und ein `erledigt` schließt die Notiz beim nächsten Land dieser Branch.
  Das ist die alte, GLOBALE Bedeutung, und sie bleibt für diese Notizen unverändert.
- **Angeheftete Quelle** (der Owner oder eine gebundene Program-MAIN hat die Notiz an EINE Zeile
  gehängt; der Brief schreibt `- notiz <id> · zu <zeile> · …`): du berichtest **mit `taskId`**, und
  zwar mit einer der Zeilen, unter denen dein eigener Receipt sie geliefert hat. Ohne `taskId`
  antwortet die Route **409** und nennt die Zeilen — ein per-Aufgabe gemeinter Bericht darf nie
  still zu einem globalen Urteil werden.

Der Schlüssel ist `(noteId, taskId, branch)`. Ein zweiter Bericht unter demselben Schlüssel
**ersetzt** den ersten (nur das jüngste zählt, und das ist eine Eigenschaft des Speichers, keine
Regel für Leser). Ein Task-Urteil landet in `Task.verdicts` der Notiz, NIE in `comments` — damit
kann weder der Kommentar-Deckel noch ein Löschen eines fremden Kommentars ein maßgebliches Urteil
zerstören, und der Legacy-Abschluss kann es nie als globales lesen.

**Zwei Ablehnungen, die dasselbe sagen wie das Land:** eine `taskId`, unter der dein Receipt die
Notiz nicht geliefert hat, ist **409**; eine Zeile, die deine Lane nicht mehr TRÄGT (ein
`wave/split` hat sie zurückgegeben), ebenfalls **409** — LESEN darfst du sie weiter (der Receipt
ist Geschichte, und Geschichte bleibt lesbar), nur neu beurteilen nicht. `GET` sagt beides:
`taskIds` ist die Zuordnung des Receipts, `judgeableUnder` die Teilmenge, die noch offen ist.

**Er ändert KEINEN Status, und die Antwort sagt das** (`effective`). Was ein `erledigt` bewirkt,
hängt davon ab, welche der beiden Arten es ist — und das ist der Kern:

- **Task-Urteil:** wirksam wird es beim Land **genau dieser Zeile**, und dann trifft es **nur diese
  VERWENDUNG**. Der Land-Pfad stempelt `landedAt` + `landedSha` auf den Eintrag; die Notiz behält
  ihre eigene Zeile, ihren Status und jede andere Zuordnung. **Eine angeheftete Quelle wird nie
  automatisch geschlossen** — sie ist EIN Text, an dem mehrere Arbeiten hängen, und „A ist damit
  fertig" sagt nichts über B. Ob die QUELLE erledigt ist, entscheidet der Owner auf der Zeile.
- **Globales Urteil** (unangeheftete Notiz, Flächen-Treffer): unverändert die alte Bedeutung — das
  nächste Land dieser Branch setzt die Notiz auf `done` mit
  `note: "erledigt durch Land <sha7> (<branch>)"`.

**Und der globale Weg kommt nie am Scope vorbei:** trägt eine Notiz eine Zuordnung ODER irgendein
Task-Urteil, ist der Legacy-Abschluss für sie gesperrt. Sonst könnte dieselbe Branch, die eine Zeile
bewusst per Aufgabe beurteilt hat, dieselbe Notiz über einen älteren globalen Kommentar doch noch
für alle schließen.

Ein Urteil unter einer Zeile, die dieses Land nicht trägt, bewegt nichts. Stirbt die Lane
(`killed`, `shelved`), bleibt alles stehen und der Eintrag bleibt ungestempelt. `widerlegt` und
`offen` bewegen nie einen Status — sie sind Lesestoff für den Owner.

**Der Deckel VERWEIGERT, er verdrängt nicht.** Eine Notiz hält höchstens 50 Task-Urteile. Derselbe
Schlüssel `(taskId, branch)` ist immer schreibbar; ein NEUER Schlüssel auf vollem Bestand antwortet
**409** und nennt die Zahlen. Weichen darf nur nachweislich entbehrliche Historie: ein Eintrag,
dessen Zeile gar nicht mehr auf der Queue steht und den darum kein Land je wirksam machen kann.

**Und unabhängig davon stempelt jedes Land die pending Notizen desselben Repos, deren Fläche eine
Nicht-Naben-Datei seines Diffs enthält**: `touched: [{sha, branch, at}]`, neueste zuerst, Deckel 5.
Naben (`server.ts`, `e2e/pins.ts`, `AGENTS.md`, `CLAUDE.md`) sind ausgeschnitten, sonst stempelte
jedes Land jede offene Notiz. Ein Land ohne bekannte Integrations-Shas (beide Owner-⏏-Pfade landen
bereits integrierte Arbeit) misst nichts und schreibt nichts — **Abwesenheit heißt „nichts
aufgezeichnet", nie „unberührt".**



## wave/split — `POST /api/self/wave/split`

**Der Rückweg einer WELLEN-Lane (W3, 2026-09-07).** Du trägst n Queue-Zeilen und landest EINMAL.
Diese Tür gibt genau die Zeilen zurück, die nicht in diese Welle gehören — der Rest bleibt bei dir
und landet wie geplant.

```
curl -X POST http://<fleet-host>:<port>/api/self/wave/split \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"ids":["<zeile>"],"reason":"<warum sie nicht in diese Welle gehört>"}'
```

**Lane-only**, und das ist die entgegengesetzte Reichweite zu `files-proposal` darüber, aus einem
Grund, der dieselbe Regel noch einmal ist: einen Vorschlag zu parken kostet die Zeile nichts,
diese Tür schreibt einen QUEUE-STATUS. Also darf nur die Lane, die die Zeilen tatsächlich HÄLT,
ihn schreiben — und sie erreicht über diese Tür keine Zeile außerhalb ihrer eigenen Welle.

**Warum es sie gibt.** `docs/queue-wellen-2026-09-06.md` §5 schneidet S3 all-or-nothing („ein
Abbruch lässt alle n auf `queued`"). Der Owner hat am 2026-09-07 die zwei Fälle benannt, die diese
Form nicht deckt, weil sie erst IN der Lane sichtbar werden: die Fläche war zu KLEIN (das Gate
bleibt korrekt — `server.ts#verifyPlanFor` klassifiziert den tatsächlichen rebasten Diff, nicht die
deklarierte Fläche — aber der Leser bezahlt den Bisect) oder zu GROB (das Bündel ist schlicht
falsch). Für beide ist Abbrechen die falsche Antwort und Mitmachen auch.

- **`queued`, nicht `pending`, und anders als bei einem ABBRUCH.** Diese Zeilen WAREN freigegeben;
  die Lane behauptet nur, dass sie hier nicht hingehören, nicht dass sie neu zu beurteilen wären.
  Ein Lane-Abbruch (`detachSlotTasks`) behält seine eigene Antwort — `pending`, zurück zum Owner —
  weil dort niemand für die Zeilen spricht.
- **`reason` ist Pflicht** (max. 200 Zeichen, die Länge der Queue-note, in die er wandert). Eine
  Zeile, die ohne Grund zurückkommt, ist von einer nicht zu unterscheiden, zu der die Lane nicht
  gekommen ist — und würde auf derselben Fläche neu gebündelt, die gerade nicht gereicht hat.
- **Mindestens eine Zeile bleibt.** Alle zurückzugeben ist kein Split, sondern ein Abbruch, und der
  gehört in den Report.
- **Der Kopf wandert mit**, falls er selbst zurückgeht: `s.taskId` benennt die Zeile, an die jede
  Provenienz dieser Lane bindet, also muss sie eine sein, die die Lane noch trägt — die nächste in
  der festen Reihenfolge der Welle.
- Antwort bei Erfolg: `{ok:true, kept:[…], returned:[…], head:"<taskId>"}`.
- Ablehnungen:
  - **unbekannter Self-Token** (401, flache 400-ms-Verzögerung wie überall).
  - **keine Lane** (409): `not a lane — only the lane holding a wave can split it`.
  - **leere/doppelte ids oder fehlender Grund** (400).
  - **keine Welle** (409): `this lane carries no wave — there is one row here, and giving it back
    is an abort, which belongs in your report`.
  - **eine id außerhalb der eigenen Welle** (409), mit der Welle im Body.
  - **alle Zeilen** (409): `that is an abort, not a split`.
  - **die Lane hat schon berichtet** (409): ein Fleet-Report mintet die Provenienz aus `s.taskId`,
    und ein Split hinter einem Report ließe ihn eine Zeile benennen, die die Lane nicht mehr trägt.

Die Owner-Seite ist `POST /api/wave/dispatch` (Owner-Token, kein Self-Spiegel): `{"ids":[…]}` mit
2 bis `LAND_WAVE_MAX_DEFAULT` (3) Zeilen. Sie prüft die Menge gegen den Sensor selbst — die ids
müssen EXAKT eine Welle sein, die `task-land-waves.ts` in diesem Moment projiziert, sonst 409 mit
dem, was der Sensor stattdessen sagt. Automatische Wellenbildung im Tick gibt es NICHT; sie steht
ausdrücklich unter der Schnittlinie von §5.

## inbox — `GET /api/self/inbox`, `POST /api/self/inbox/:id/read`

Der **dauerhafte Rückkanal des PROGRAMS**, nicht der einer Session. Ein Eintrag ist ein ZEIGER auf
eine Zeile, die es schon gibt (Attention-Antwort, Fleet-Report, rotes Audit, fremd gelandetes Commit); er kopiert keinen Text
und nennt **keinen Empfänger**. Wer beim Lesen die gebundene MAIN des Programs ist, liest ihn —
darum überlebt ein Eintrag eine Succession, während ein Watch, ein FleetEvent und eine offene
Attention eines **aktiven** Programs ebenfalls an die Nachfolgerin übergeht. Ein Owner-Kill
refused die offene Attention dagegen weiter mit `requester session ended`. `readBy` ist eine
**Quittung**, kein Schlüssel: keine Route filtert an ihr.

```
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<fleet-host>:<port>/api/self/inbox
curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/inbox/<entry-id>/read
```

- **Scope: Program-gebunden, Nicht-Lane.** Beide Verben lesen **keinen Body** — das Program kommt aus
  der Bindung (`boundProgramForMain`), der Eintrag aus dem Pfad. Ein `slot`- oder `programId`-Feld
  gibt es strukturell nicht zu ignorieren, dieselbe Regel wie bei `/api/self/tasks/:id/release`.
- **Antwort GET:** `{program, unread, dropped, entries: [{id, kind, at, ref, readBy, readAt,
  subject}], unknown: []}`, **neueste zuerst**. `kind` ist genau eines von `attention-answer` ·
  `fleet-report` · `audit-red` · `ambient-land`. `subject` ist die aufgelöste Zeile selbst (Attention- bzw.
  Report-Zeile) oder `null`; löst ein `ref` nicht mehr auf, steht daneben eine Zeile in `unknown`
  (`entry <id> names a <kind> row that is no longer present (retention)`) — beide Zielarten sind
  beschnittene Enden (`pruneAttention`, `pruneFleetReports`), „der Zeiger hat seine Zeile überlebt"
  ist also ein erwarteter Zustand und keine Panne. **`audit-red` gehorcht seit seinem Schreiber
  derselben Regel** (die frühere Fassung „trägt immer `subject: null` und erzeugt KEINE
  `unknown`-Zeile" ist damit überholt): siehe den eigenen Absatz unten.
- **`ambient-land` — jemand anders hat eine Zeile DIESES Programs gelandet** (ACP-17). Der Eintrag
  entsteht ausschließlich, wenn ein Land die Integrationsbranch bewegt hat, das mit einem
  Owner-Token **nicht vom Board** (`bearer`/`?token=`) an der Self-Land-Tür des Programs vorbeigefahren
  ist — also genau der Fall vom 2026-09-08 04:56, in dem beurteilte und unbeurteilte Arbeit drei
  Sekunden auseinander lagen und nichts sagte, welche es war. `ref` ist eine **Adresse**,
  `"<gelandete-sha> <repo-toplevel>"` — beide Haelften, weil ein Program KEINEN dauerhaften
  Repo-Zeiger traegt (`founding` ist ein Crash-Marker fuer einen Uebergang und fehlt auf jedem
  gesetzten Program), eine Sha allein also ein Zeiger waere, dem die Leseseite nicht folgen kann.
  Es bleibt eine Adresse und keine Kopie: vom Inhalt der Note wandert nichts in den Eintrag.
  `subject` ist `{sha, note, door}`, wobei `note` die Server-geschriebene Land-Note an diesem Commit
  ist (`git log --notes=fleet/land`). Die Frage, die die MAIN wirklich hat, steht in
  `note.actor.bypassed`:
  - `program` · `task` · `main` — welche Bindung übergangen wurde, und welchen Slot sie nannte.
  - `report` — der **an der Tür gemessene** Stand des Reports dieser Arbeit: `accepted` (die MAIN
    hatte bereits geurteilt — der harmlose Fall), `undecided` (ein Report lag, kein Urteil stand),
    `none` (überhaupt kein Report zu dieser Arbeit), `rejected` (nur über das ausdrückliche,
    auditierte `overrideRejectedReport` erreichbar). Gemessen an der Tür, nicht später neu
    abgeleitet: „war das beurteilt, als jemand anders es landete" ist eine Frage über den Moment.
  - **Abwesenheit ist nie Beweis:** `pruneFleetReports` schneidet entschiedene Zeilen ab, `report`
    ist also ein Stand über die Zeilen, die der Server noch hielt — nie eine Aussage über alles je
    Eingereichte.
  Die Route **verweigert nichts**: der Owner-Pfad bleibt der ausdrückliche Notweg, und der Eintrag
  ist die Sichtbarkeit, die ihm bisher fehlte. Lässt sich die Note nicht lesen (der Note-Schreiber
  ist best-effort), trägt `unknown` die eigene Zeile dafür (`… whose land note is not readable in
  <repo>`) — der Zeiger auf ein Land, das stattfand, hängt nie an einem best-effort-Schreiben.
  Fehlt die Repo-Haelfte ganz, sagt die `unknown`-Zeile genau das (`… without a repo to read its
  land note from`) statt in ein fremdes Object-Database zu greifen und „nicht lesbar" zu melden.
- **`audit-red` — ein rotes Post-Land-Audit über eine Landung DIESES Programs.** `ref` ist der
  Zeilenschlüssel der Audit-Zeile (`at`, als String). Die Zuordnung läuft über das
  Outcome-Ledger und über **drei** Felder zusammen — `repo` UND `branch` UND `mainAfter`
  (`server.ts#programsForAuditRow`): ein Branch-Name wird wiederverwendet, ein Tip nicht, und ein
  Join auf den Branch allein zöge das ältere Land desselben Namens in ein fremdes Program. Ein Cover
  ohne Treffer bleibt **programlos** und wird nie dem nächstbesten Program zugeschlagen.
  `subject` ist die aufgelöste Audit-Zeile: `{at, mainSha, result, exitCode, covers[], proportional,
  checks, ranIsLowerBound, displayedRan, fails[], remote, tail, adjudicated, door}` — dieselbe
  Ableitung, aus der auch der Pane-Ping rendert (`server.ts#auditSubjectOf`), damit beide Leser
  nicht auseinanderlaufen können. `adjudicated` ist `null`, solange niemand hingesehen hat, sonst
  `{at, verdict, by, note?}`. `door` sagt die Grenze laut: **die Adjudikation bleibt beim Owner**
  (`POST /api/post-land-audits/adjudicate`) — die MAIN liest, und wenn eine Entscheidung fällig ist,
  stellt sie eine Attention. Das Ledger ist ein rotierender Trail, also gibt es hier zwei
  verschiedene `unknown`-Sätze statt eines: `… which is no longer on the trail (retention)` (die
  Zeile ist weg) und `… whose ledger line is not readable as an audit row` (die Zeile steht da und
  ist unlesbar). Ein `ref`, der gar kein Zeilenschlüssel ist, sagt genau das.
- **Und `audit-red` tippt NIE in eine Pane** (`server.ts#nudgeableUnread`). Das ist der Zweck des
  Kinds: ein rotes Audit hört auf, ein Paste zu sein, und die gebundene MAIN findet es beim nächsten
  `GET /api/self/inbox`. Der Inbox-Nudge zählt darum nur die übrigen Kinds und **sagt es in seinem
  Text**, wenn er ein ungelesenes `audit-red` auslässt — die Zahl in der Pane ist nie als Inbox-Summe
  zu lesen. Der generische Audit-Ping behält genau die Covers, die KEIN aktives Program besitzt;
  vollständig adressiert wird er zu `ping.status: "program-inbox"` (nicht `delivered` — es wurde
  nichts getippt), teilweise adressiert feuert er weiter und nennt die Hälfte, die schon einen Leser
  hat.
- **Schreiber:** Eine Owner-Antwort über `POST /api/attention/:id/answer` schreibt genau einen
  `attention-answer`-Zeiger zusammen mit dem `answered`-Status. **Und seit 2026-09-12 schreibt
  `POST /api/tasks/:id/criterion-confirm` denselben Zeiger für jede Zeile, die genau um diesen Akt
  gebeten hat** — siehe den eigenen Absatz unten. Einen `audit-red`-Zeiger schreibt
  **jede der beiden Audit-Senken** (der lokale Lauf und das Helfer-Ergebnis), je aktivem Program
  genau EINEN pro Audit-Zeile — ein zweiter Aufruf für dieselbe Zeile schreibt nichts. Ein Program,
  das nicht mehr `active` ist, ist kein Leser: seine Covers bleiben unadressiert und behalten den
  Ping, statt still zu verschwinden.
- **Der zweite Schreiber: `POST /api/tasks/:id/criterion-confirm`** (Owner-Route, `server.ts#answerAttentionsForCriterion`).
  Der Owner-Confirm eines Done-Kriteriums beantwortet jede Attention-Zeile, die um genau ihn gebeten
  hat — Status `answered`, `answer.by: "owner"`, ein `attention-answer`-Zeiger je Zeile, alles im
  SELBEN State-Cut wie das Kriterium. Die Antwort nennt `attentionAnswered: [<ids>]`, und die
  Audit-Zeilen tragen `via=criterion-confirm`. **Der Anlass ist gemessen:** Attention `1050d69f`
  (kind `decision`, 2026-09-11 21:23) verlangte wörtlich `POST /api/tasks/c62aa3e9/criterion-confirm`;
  der Confirm kam am 2026-09-12 06:10, die Zeile blieb bis 11:03 `open` und wurde von Hand
  beantwortet — fünf Stunden, in denen das Board dem Owner eine Entscheidung zeigte, die entschieden
  war. Der Join ist `provenance.taskId` und **nur** er; eine Zeile ohne ihn sagt UNKNOWN darüber,
  zu welcher Task sie gehört, und wird nicht angefasst. Eine Zeile wird genau dann beantwortet, wenn
  ALLES davon gilt:
  - `status: "open"` (`answered`/`refused` sind Quittungen; `send-uncertain` trägt Text, der schon in
    der Pane des Requesters stehen kann — dieselbe Grenze, die `answerAttention` für beide
    Prinzipale zieht) **und** `kind: "decision"`,
  - `provenance.taskId === <task>`,
  - **und** entweder der Text nennt `criterion-confirm` (case-insensitive) **oder** der Requester
    sitzt auf dem Slot der Task (`Task.slot`) — zwei Arme derselben Frage, keiner davon „jede
    Entscheidung dieser Task".
  - Das Program der Zeile ist `active`. Sonst bleibt die Zeile OFFEN und sichtbar, statt in
    niemandes Inbox geschlossen zu werden — wörtlich `answerAttention`s eigene Begründung.
  Ein Confirm ohne passende Zeile ändert nichts (`attentionAnswered: []`), und der zweite Confirm
  ist die alte 409 (`criterion already confirmed`) und schreibt darum nichts nach. Der Confirm
  bleibt im Übrigen, was er war: er entlässt zusätzlich ein `awaiting: "owner"` am Slot der Task.
- **Antwort POST read:** `{ok: true, existing: false, entry}` beim ersten Mal, `{ok: true,
  existing: true, entry}` bei jedem weiteren. Die Quittung ist **kein Lock**: ein zweites Lesen
  überschreibt `readBy`/`readAt` nie, denn der erste Leser ist die Tatsache.
- **Deckel: 100 Einträge je Program** (`PROGRAM_INBOX_MAX`). Darüber fällt der **älteste GELESENE**
  Eintrag zuerst, erst dann der älteste ungelesene, und `dropped` zählt ihn — ein Zeiger, der
  abfiel, sagt es, statt zu verschwinden.
- **Ablehnungen** (immer 409, nie 401 — du hast das richtige Token, die Frage ist von dort nicht
  stellbar):
  - **Lane** (409): `a lane has no program inbox — a lane files its result, its MAIN reads the inbox`.
  - **nicht gebunden** (409): `not the current bound MAIN of an active program — attention is raised
    by a program's own main session`, bzw. `ambiguous Program-MAIN binding: …` — wörtlich die Sätze
    von `boundProgramForMain`, damit „nicht gebunden" und „mehrdeutig gebunden" zwei verschiedene
    Dinge bleiben.
  - **unbekannter Eintrag** (404): `unknown inbox entry`.
  - **fremdes Program** (409): `inbox entry belongs to another Program — this MAIN reads program <id>`.
- **Was der Loader mit einem alten `fleet.json` tut:** eine Program-Zeile **ohne** den Key lädt ohne
  ihn und bekommt **kein** Backfill (Abwesenheit heißt „es wurde nie ein Eintrag geschrieben"); eine
  Zeile **mit** unlesbarem Record lädt als ABSENT und wird gemeldet (`console.error` +
  Audit-Zeile `program_inbox_unreadable`) — nie feldweise repariert.
- **Zahlen ohne Pull:** `GET /api/self/program-execution` trägt je Program `status.inbox =
  {unread, oldestAt}` (ältester UNGELESENER Eintrag, `null` = nichts ungelesen).


## messages — `GET /api/self/messages`, `POST /api/self/messages`, `POST /api/self/messages/:id/read`

Die **adressierte Nachricht zwischen Prinzipalen** und ihre Antwort — die andere Hälfte dessen, was
`inbox` nicht kann. Ein Inbox-Eintrag ist ein ZEIGER, der EINEM Program gehört, keinen Absender
nennt und keinen Rumpf trägt; eine Nachricht hat zwei Enden, einen Text und eine Antwortkante.
Darum ein **eigener Record**, kein Feld an `Program.inbox` (der Pin `RULE_INBOX` §I1 hält den
Eintrag ausdrücklich empfängerlos).

**Die Adresse ist nie eine Slot-Nummer**, und das ist der ganze Grund, dass zwei Eigenschaften
gleichzeitig gelten: ein Slot wird recycelt, eine Program-Id und eine Rollenbindung nicht.

- **SICHTBARKEIT entscheidet die ADRESSE.** Der Nachfolger einer zurückgetretenen Occupation löst
  auf dieselbe Adresse auf und liest dieselbe Nachricht unter derselben Id.
- **Die QUITTUNG entscheidet das Occupant-Tripel** `{slot, openedAt, sessionId}`. Der Record sagt
  weiter exakt, wer gelesen hat; eine spätere Occupation überschreibt das nie.

```
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://<fleet-host>:<port>/api/self/messages

curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"to":{"kind":"program","id":"<24-hex>"},"payload":{"kind":"text","text":"…"},
       "idempotencyKey":"<frei gewählt>","replyTo":null}' \
  http://<fleet-host>:<port>/api/self/messages

curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" \
  http://<fleet-host>:<port>/api/self/messages/<message-id>/read
```

- **Scope: Prinzipal-gebunden, Nicht-Lane.** Absender ist, wer die Session IST — aus der Bindung
  abgeleitet, nie aus dem Body. Eine gebundene Program-MAIN sendet als `{kind:"program",id}`, der
  exakt gebundene Supervisor (`isBoundSupervisor`) als `{kind:"role",role:"supervisor"}`.
- **Adress-Union, geschlossen:** `{kind:"program", id}` | `{kind:"role", role}` mit
  `role ∈ {supervisor, controller}`.
- **`role:"controller"` ist BENANNT, aber nicht auflösbar** — 409, und **nichts wird gespeichert**.
  Der Controller ist Scope und hält keine Bindung (`docs/controller.md`). Wer ihn heute erreichen
  will, adressiert **das Program, dessen MAIN er ist**, als `{kind:"program",id}`. Die Rolle steht
  trotzdem in der Union: so ist die Sackgasse dokumentiert statt erfunden, und eine spätere
  owner-promovierte Controller-Bindung ist eine Änderung am AUFLÖSER, keine Migration am Record.
- **Eine Nachricht verleiht NICHTS.** Sie ist Text an einen Prinzipal: keine Owner-, Release-,
  Land- oder Deploy-Berechtigung reist mit ihr, und keine Route liest sie als Anweisung.

**Antwort GET:** `{addresses, unread, droppedFleetWide, entries: [{id, from, to, at, payload,
idempotencyKey, replyTo, readBy, readAt}], unknown: []}`, **neueste zuerst**. `addresses` sind die
Adressen, die diese Session gerade hält — eine Session kann unter mehreren lesen.

**Du siehst BEIDE Enden deiner eigenen Fäden**, nicht nur den Eingang: eine Zeile ist dabei, wenn
`to` **oder** `from` eine deiner Adressen ist. Das ist keine Bequemlichkeit — eine Antwort nennt ihre
Frage in `replyTo`, und eine reine Eingangs-Sicht gäbe einem Nachfolger eine Id in die Hand, die er
nicht auflösen kann: die Frage seines Vorgängers wäre genau so verloren wie auf jeder Fläche, die
diese hier ersetzt. Beide Seiten bleiben **adress**-geschlüsselt, ein recycelter Occupant löst also
auf keine von beiden auf. `unread` zählt **nur den Eingang** — eine selbst gesendete Zeile ist keine
Neuigkeit, und sie mitzuzählen ließe eine untätige MAIN aussehen, als schulde sie ihrer eigenen
Frage eine Antwort. `droppedFleetWide`
heißt so, wie es heißt: der Deckel liegt auf dem GANZEN Record, die Zahl ist also nicht „so viele
DEINER Nachrichten fielen ab"; ist sie > 0, steht daneben eine `unknown`-Zeile, die genau das sagt.

**Die drei Antworten auf eine Adresse, und sie dürfen nie zu einer werden:**

| Fall | Antwort | Gespeichert? |
|---|---|---|
| Unbekannte Program-Id · `role:"controller"` | 409, benannt | **nein** |
| Gültige Adresse, **niemand hält sie gerade** (kein gebundener MAIN, tote Occupation, kein Supervisor gebunden; auch ein `completed`/`abandoned` Program) | 200 mit `note`, `holder:null` | **ja** — der nächste Halter liest sie |
| Gültige Adresse mit lebendem Halter | 200, `holder:{slot,openedAt}` | ja |

Der mittlere Fall ist der Zweck der Übung, nicht ein Randfall: **eine Succession ist genau das
Fenster, in dem eine Adresse kurz unbesetzt ist.**

**Idempotenz — und ihre benannte Grenze.** `idempotencyKey` ist auf `(Absender, Key)` eindeutig:

- Gleicher Absender + Key + Empfänger + Payload + `replyTo` ⇒ `{ok:true, existing:true, message}`,
  es wird **nichts angehängt**. Der Record ist persistiert, das gilt also auch **über einen
  Neustart**. Die Prüfung läuft **vor** der Adressauflösung — ein Replay antwortet wie beim ersten
  Mal, auch wenn das Ziel-Program inzwischen zurückgezogen wurde.
- Gleicher Absender + Key, aber **abweichender** Empfänger, Payload oder `replyTo` ⇒ **409**. Ein
  Key benennt EINEN Vorgang; zwei Vorgänge unter einem Key hieße, einen davon still zu verlieren.
- **Die Grenze, ausdrücklich: das ist keine Exactly-once-Zusage.** Die Dedupe liest die LEBENDEN
  Einträge. Fällt eine Nachricht über den Deckel (`MESSAGES_MAX`, gelesene zuerst), kann derselbe
  Key **neu minten**. Zugesagt ist Idempotenz **innerhalb der Retention** — ein unbegrenzter
  Dedupe-Speicher wäre ein zweiter unbegrenzter Record hinter einem begrenzten. Dieselbe Grenze
  tragen die beiden vorhandenen Inbox-Produzenten (`server.ts#recordLand`,
  `server.ts#writeAuditInboxEntries`) aus demselben Grund.

**`replyTo` — die Antwortkante ist ein FELD, keine Konvention.** Zulässig ist nur die Id einer
Nachricht, die an **eine eigene Adresse** des Absenders gerichtet ist. Sonst: **409
`replyTo names no message addressed to this sender`** — **eine** Antwort für „gibt es nicht" und
für „gehört dir nicht". Das weicht **bewusst** von `POST /api/self/inbox/:id/read` ab, das
409-fremd und 404-unbekannt trennt: dort ist der Id-Raum das eigene Program und die zwei Antworten
schicken den Aufrufer an zwei verschiedene Orte, hier könnte jeder Prinzipal sonst auf die Existenz
von Verkehr zwischen zwei anderen prüfen. Nicht-Offenlegung schlägt Navigierbarkeit an dieser Tür.

**Quittung.** `POST /api/self/messages/:id/read` stempelt das Occupant-Tripel und ist **kein
Lock**: ein zweites Lesen antwortet `{ok:true, existing:true}` und schreibt **nichts** um — der
ERSTE Leser ist der Fakt. **Eine Quittung gehört dem EMPFÄNGER:** die eigene AUSGANGS-Zeile siehst
du zwar, quittieren kannst du sie nicht (**409 `this message was sent by this principal — a receipt
is the addressee's`**) — eine Quittung hält fest, wen die Nachricht erreicht hat, und der Absender,
der seine eigene quittiert, fälschte genau diesen Fakt. Sie wird hier **benannt** statt versteckt,
denn sie steht ohnehin in seiner eigenen Sicht. Eine Id, die es nicht gibt **oder** die weder an
noch von einer eigenen Adresse ist, bekommt dieselbe **404 `unknown message`** (siehe `replyTo`).

**Ablehnungen im Einzelnen**

| Situation | Code | Satz |
|---|---|---|
| Lane (kein Steward) | 409 | `a lane does not address principals — a lane files its result, and its MAIN speaks for the program` |
| Weder gebundene MAIN noch Supervisor | 409 | der Satz von `boundProgramForMain` |
| Gebundener Supervisor **und** gebundene MAIN | 409 | `ambiguous sender: …` — der Owner trennt die Rollen, die Route rät nicht |
| GET/read ohne jede Adresse | 409 | `not a principal with an address — this rail answers a bound Program-MAIN or the bound Supervisor` |
| Fremder Body-Schlüssel | 400 | `body reads only to, payload, idempotencyKey, replyTo — […] is not read: the SENDER is derived from this session's binding and can never be named in a body` |
| `payload.kind` unbekannt | 400 | `payload kind must be one of text` |
| `payload.text` leer/über 2000 | 400 | `payload text must be a non-empty string of at most 2000 chars` |
| `idempotencyKey` leer/über 200 | 400 | `idempotencyKey must be a non-empty string of at most 200 chars` |
| Unbekannte Program-Id | 409 | `unknown program <id>` |
| `role:"controller"` | 409 | `role "controller" is named but not addressable: …` |
| Key erneut, anderer Inhalt | 409 | `idempotencyKey <key> was already used by this sender for a different message (<id>) — one key names one act` |
| `replyTo` unbekannt oder fremd | 409 | `replyTo names no message addressed to this sender` |
| `:id/read` auf die eigene AUSGANGS-Zeile | 409 | `this message was sent by this principal — a receipt is the addressee's` |
| `:id/read` unbekannt oder fremd | 404 | `unknown message` |

**Deckel:** `MESSAGES_MAX` = 200 Einträge auf dem GANZEN Record (gelesene fallen zuerst, `dropped`
zählt) · Text 2000 Zeichen (`MAX_SUPERVISOR_NUDGE_TEXT` — derselbe Deckel wie beim Nudge, damit zwei
Kanäle nicht zwei Deckel haben) · `idempotencyKey` 200 Zeichen.

**Payload-Union.** Heute genau ein Mitglied, `{kind:"text", text}`. Ein unbekannter `payload.kind`
wird mit benanntem Satz **abgelehnt**, der Record trägt `v:1`. **Was das beweist und was nicht:** es
hält die HEUTIGEN Textnachrichten stabil lesbar. Es beweist **nicht**, dass ein zweiter Payload-Typ
migrationsfrei landet — das könnte nur der zweite Typ selbst. Die Tür ist offen gelassen, mehr nicht.

**Was der Loader mit einem alten `fleet.json` tut:** ohne den Key lädt der Record **leer** und
bekommt kein Backfill. Ein **unlesbarer** Record lädt als LEER, meldet sich (`console.error` +
Audit-Zeile `messages_unreadable`) und hinterlässt eine **persistierte Narbe** (`messagesLost`), die
`GET /api/self/messages` als erste `unknown`-Zeile rendert — denn ein leerer Rail liest sich sonst
exakt wie einer, an den nie jemand geschrieben hat. Die erste Narbe gewinnt: ein späterer Boot
sieht keine kaputten Bytes mehr, und `at` nach vorn zu schieben würde den Verlust auf Nachrichten
umdatieren, die längst weg waren.

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

**Nicht lane-only, und das ist eine Entscheidung, kein Versehen.** Die lane-only Routen sind es,
weil ihre Antwort außerhalb einer Lane undefiniert ist (`drift`, `gate`, `criterion`,
`verify-intent`, `suite-offer`, `wave/split`, `clarifications`, `notes` + `notes/:id/verdict`);
`tasks/:id/notes` ist nicht-lane-only, weil eine Lane die Zeile AUSFÜHRT, auf die sie gegründet
wurde — sie wählt nicht, wogegen die Zeilen gearbeitet werden, die ihre eigene MAIN freigibt;
`watch` ist nicht-lane-only, weil eine Lane, die auf eine Lane wartet, eine
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

**Eine lane-only Route** (Scope-Regel wie `drift`/`gate`/`criterion`/`verify-intent`/`notes`: eine
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

**DAS ERGEBNIS KOMMT IN DEINE PANE — NICHT POLLEN.** Seit dem Schnitt dieser Zeile mintet der
Server beim TERMINALEN Ausgang eines Angebots (`server.ts#mintLaneSuiteEvents`, gerufen aus dem
einen Schreiber eines Verdikts, `reportLaneSuite`) ein Event an die anbietende Lane, **grün wie
rot**, über dieselbe Zustellung, über die ein Lane-Watch feuert. Es trägt Job-Id, `result`,
`exitCode`, eine STICHPROBE der Fail-Namen (`fails`, 3 × 120 Zeichen) samt `failCount` — der
WAHREN Zahl — und die LETZTE Ausgabezeile, plus den Satz, dass der Volltext auf
`GET /api/self/suite-offer` liegt; eine Pane ist der falsche Ort für einen Suite-Tail. **Die
Stichprobe ist klein, weil die Zeile die heiße Schleife mitfährt:** ein FleetEvent reist über
`/api/sessions`, das jeder offene Tab alle 2 s pollt, unter einem GEMESSENEN Budget von 14 KiB mit
rund 1 300 B Luft (`e2e/tasks.ts`, `docs/data-saver.md` §1) — die erste Fassung trug 20 Namen à 200
Zeichen, also 4 KB pro roter Zeile und damit das Budget dreifach gesprengt bei einem einzigen Rot.
`failCount` ist das, was die Kürzung ehrlich macht: „12 failure(s), 3 named here … (the rest are on
the job)" sagt etwas, das eine still abgeschnittene Liste nicht sagt. Zwei Eigenschaften, beide
gemessen erkauft:

- **`idleSec: 0`.** Der Default 60 s stellt einer ARBEITENDEN Session nie zu (gemessen 2026-09-07,
  Slot 10: zwei Lane-Watches starben `subject-gone`, ein Merge-Watch blieb `pending`). Eine Lane,
  die ihr Angebot gemacht hat und weiterarbeitet, wartet nicht auf Ruhe.
- **`watchId: null`, kein Abo.** Eine Lane DARF nicht abonnieren (`/api/self/watch` antwortet ihr
  409), und genau das war die Lücke: sie pollte `GET /api/self/suite-offer` Zug für Zug, zum Preis
  ihres vollen Kontexts pro Poll (gemessen 2026-09-12 an Slot 4, „gefühlt in jeder zweiten Lane").
  Der Deckel ist deshalb nicht der Watch-Deckel, sondern `slotDeliveryBudget` direkt an der
  Mint-Stelle; ist er voll, sagt es die Trail-Zeile `lane_suite_event_skipped`.
- **Der Deckel der Owner-Zeilen ist der EIGENE** (`LANE_SUITE_RED_INBOX_MAX`, 20), nicht der
  geteilte `FLEET_EVENT_MAX_OPEN_PER_SLOT` (5) der Report-Tür. Geteilt wäre er in genau der
  Richtung falsch, die zählt: fünf ungelesene fleet-reports hätten jedes danach gemeldete Rot
  stillgelegt — die Unsichtbarkeit wäre über den Rückstand eines FREMDEN Kanals zurückgekommen.
  Ein Rot wird nur von anderen ungelesenen ROTS verdrängt, und die Trail-Zeile benennt diesen
  einen Fall.

**Zugestellt wird nur an DIESELBE Belegung** (`slot` + `openedAt` des Angebots). Trägt der Slot
inzwischen eine andere Session, verfällt die Zustellung mit einer benannten Trail-Zeile — ein
Verdikt über einen Baum, den diese Session nie übergeben hat, wäre schlimmer als keines. In der
Praxis kommt es dazu nicht: `expireHelperClaims` reapt ein Angebot, dessen Lane weg ist, schon
bevor ein Verdikt angenommen werden kann (dann **409** `no live claim for this preview`).

**UND EIN ROTES VERDIKT BEKOMMT EINEN ZWEITEN EMPFÄNGER: den Owner.** Dieselbe Mint-Stelle legt
für `result: "red"` zusätzlich eine Zeile in den **Owner-Posteingang** (`receiverSlot: null`,
`delivery: "inbox"`). Der Grund ist gemessen: am 2026-09-11 endeten zwei rote Vorschauläufe
(`968a80797a57`, `4b5599e7c78c`) als Job-Zeile in `fleet.json` — und weiter nichts. Kein
Board-Element liest `laneSuiteJobs`, `POST /api/post-land-audits/adjudicate` erreicht einen JOB
nicht, und ein Watch kann darauf nicht feuern. Der einzige Kanal war, dass die Lane das Rot selbst
in ihren Report schrieb; der erste der beiden lag zwei Stunden unbesehen. **Die Owner-Zeile hängt
an keiner Lane:** sie hat keinen Occupant, den ein Recycling entwerten könnte, `inbox` ist kein
`pending`-Zustand (der Transport-Tick fasst sie nie an), und offene Zeilen werden nie geprunt.
**Ein grünes Verdikt legt keine an** — sonst wäre die Liste in einer Woche Rauschen.

**Lesen und quittieren, ohne die Lane:**

```
curl -s -H "x-fleet-token: $FLEET_TOKEN" http://<fleet-host>:<port>/api/lane-suite/reds
curl -s -X POST -H "x-fleet-token: $FLEET_TOKEN" \
  http://<fleet-host>:<port>/api/events/<eventId>/ack
```

`GET /api/lane-suite/reds` (Owner-Route) nennt die OFFENEN roten Vorschauen: `eventId` · `jobId` ·
`at` · `status` · `branch` · `result` · `exitCode` · `fails[]` (Stichprobe) · `failCount` ·
`tail` · `job{…}` · `door`.
Autorität ist die Posteingangs-Zeile, nicht `laneSuiteJobs`: die Map ist auf `LANE_SUITE_KEEP` (20)
gedeckelte Angebote begrenzt, eine offene Zeile dagegen wird nicht geprunt — `job: null` heißt
also „die Job-Zeile ist verdrängt", nie „es gibt kein Rot". Quittiert wird durch dieselbe Tür wie
jede andere Posteingangs-Zeile, `POST /api/events/:id/ack`. **Das Quittieren ist ein „jemand hat
hingesehen", kein Urteil:** eine Vorschau gated nichts, sie wird durch diese Schiene nicht zum
Gate, und es gibt dafür keinen `verdict`-Parameter wie bei der Audit-Adjudikation.

**Was KEINE solche Zeile erzeugt** (die Gegenprobe gegen Lärm): `withdrawn` · `abandoned` ·
`lapsed` · `reaped`. Keiner dieser Ausgänge schreibt je ein `result`, und die Mint-Stelle ist aus
genau einem Aufrufer erreichbar — die Abwesenheit ist strukturell, kein Filter, den jemand
mitpflegen muss.


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
- **`status` ist genau einer von vier** (`FLEET_REPORT_STATUSES` in `src/protocol.ts`, dieselbe
  Liste, aus der die Fußzeile ihren Text interpoliert):
  `complete` (die Scheibe ist fertig UND verifiziert) · `needs-main` (fertig, soweit möglich, eine
  Entscheidung steht aus) · `failed` (es hat nicht funktioniert, und die Lane sagt es) ·
  `handoff` (der Staffelstab: der Kontext läuft voll, die Lane übergibt an eine frische Session auf
  DEMSELBEN Worktree — fertig / offen / nächster Schritt / offene Zahlen, danach
  `POST /api/self/succeed`, siehe §succeed).
  Alles andere ist 400 mit der erlaubten Liste im Fehlertext.
- **`handoff` ist kein Urteil über die Arbeit**, sondern das Übergabedokument. Es bewegt wie jeder
  Report keine Zeile, braucht keinen `HANDOFF.md`-Commit (das ist die Datei des Haupt-Checkouts,
  nicht die einer Lane) und liegt genau dort, wo das Ergebnis derselben Lane ohnehin landet: in der
  Program-Inbox. Die MAIN sieht also eine Lane mit einem Nachfolge-Eintrag, kein neues Land.
- **`text` ist PROSA für einen menschlichen Leser**, nicht-leer und ≤ `MAX_FLEET_REPORT_TEXT`
  (4000 Zeichen). Es gibt bewusst keinen JSON-Ergebniskörper: der Empfänger ist eine Session, die
  liest, kein Reducer.
- **Ein Report bewegt NIE `Task.status`.** Für eine Lane eines aktiven Programs legt er eine
  `FleetReport`-Zeile plus einen `fleet-report`-Zeiger in dessen Program-Inbox an; alle anderen
  erfolgreichen Pfade behalten den FleetEvent-Transport unten. Er landet nicht, deployt nicht und
  schließt keine Zeile. Ein Report ist eine NACHRICHT.

**Program zuerst.** Trägt die Lane die ID eines aktiven Programs, wird der Report an DAS PROGRAM
adressiert: `basis:"program"`, `receiver:null`, `eventId:null`, genau ein ungelesener
`fleet-report`-Eintrag in `Program.inbox`. Das gilt bei lebender wie staler MAIN-Bindung; es wird
kein FleetEvent gemintet und kein Occupant-Zustellbudget gelesen. Die jeweils durch
`boundProgramForMain` gebundene MAIN liest die Zeile, also auch eine Nachfolgerin mit anderem
Tripel. `clarificationReceiverFor` bleibt für Fragen unverändert, weil eine Frage einen lebenden
Antwortenden braucht.

Nur wenn das genannte Program nicht aktiv ist oder die Lane kein Program trägt, gilt die bisherige
Empfänger-Ableitung aus Watch-Evidenz beziehungsweise der Owner-Inbox-Rückfall. Dort bleiben die
Ablehnungen exakt wie sie waren:

- `lane-watch evidence names multiple receiver occupants` — zwei verschiedene Watch-Occupants sind
  kein Empfänger, sondern ein Münzwurf. Bleibt wortgleich (`e2e/pins.ts`, B2).
- `only legacy lane-watch evidence exists without slotOpenedAt` · `no exact clarification receiver
  evidence` — unverändert **als Sätze**; die zweite ist für den Report seit B4 kein Endpunkt mehr,
  siehe unten.

`"program-main"` und `"program-main+lane-watch"` bleiben für persistierte Report-Zeilen lesbar,
werden für neue Reports aber nicht mehr vergeben. Die Event-Payload-Union bleibt unverändert, denn
`basis:"program"` besitzt gerade kein Event.

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

Im Board erscheint die Zeile in `📥` in der eigenen Sektion „Worker reports no session can judge":
der Poll trägt dafür nur die Zahl `reportsAwaitingOwner`, die Zeilen samt vollständigem Report-TEXT
lädt das Panel aus `GET /api/fleet-report` — für diese eine Art IST der Text die Zustellung, und er
reitet darum NICHT auf dem 2-s-Poll (`src/opsevents.ts#opsPollVisible` schneidet Inbox-Reports aus
`events`; die volle Spur mit Payload: `GET /api/events`). Bei
Pane-Transport ohne Session-Ack zeigt die Operations-Fläche zusätzlich `recovery.state`,
`nextAction`, `reason` und `effect`, wenn der Server eine Recovery-Entscheidung gemessen hat.

**Weitere Ablehnungen:** MAIN und `⚙ steward` sind 409 (`not a worker lane — MAIN and the steward
cannot file a fleet report`) — es berichtet, wer ARBEITET. Hat der Empfänger kein
Zustellbudget mehr (offene Events + armed Watches ≥ `FLEET_EVENT_MAX_OPEN_PER_SLOT`, heute 5), ist
es 409 `fleet-report receiver has no FleetEvent delivery budget`. Der Program-Pfad kennt diese
Ablehnung nicht: Program-Inbox-Einträge zählen nicht gegen das FleetEvent-Budget.

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

**`GET /api/self/fleet-report`** liefert die Zeilen, in denen der Aufrufer Worker oder
Occupant-Empfänger ist, plus alle `basis:"program"`-Zeilen des Programs, dessen aktuelle MAIN der
Aufrufer laut `boundProgramForMain` ist. **Retention: `FLEET_REPORT_KEEP = 20`** terminale Zeilen,
älteste zuerst verworfen. Bei `basis:"program"` heißt terminal: `decision` ist vorhanden; eine
unbeurteilte Program-Zeile altert nie allein aus der offenen Schuld. Sonst heißt terminal wie zuvor:
das zugehörige Event steht auf
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
- **`decision` ist EIN Objekt oder es ist nicht da**: `{disposition, at, by:{slot,openedAt,sessionId}|"owner",
  reason}`. `disposition` ist genau einer von zwei (`FLEET_REPORT_DISPOSITIONS` in `server/types.ts`):
  `accepted` · `rejected`. Fehlt der Schlüssel oder ist er `null`, ist die Zeile UNBEURTEILT — eine
  vor dieser Tür persistierte Zeile bleibt beobachtbar unbeurteilt und wird nie zu einem Urteil
  repariert, das niemand gefällt hat. `reason` ist optionale Prosa ≤ 500 Zeichen oder `null`.
  `by: "owner"` ist die Owner-Tür unten — dieselbe Prinzipal-Asymmetrie wie
  `AttentionRequest.answer.by`, und sie ist von einem Occupant-Urteil UNTERSCHEIDBAR, weil sie ein
  Urteil von AUSSERHALB des Programs ist.
- **Bei den alten Event-Basen entscheidet die gebundene Empfänger-OCCUPATION** — `slot` + `openedAt`, und `sessionId` wird
  getragen, nie verglichen. Das ist exakt die Regel, mit der `clarificationReceiverFor` den
  Empfänger AUFLÖST („deliberately reported, never gated": ein Codex-Bind darf die Session-Id
  innerhalb EINER Occupation bewegen). Bis zum 2026-09-07 verglich diese Tür alle drei Felder und
  war damit strenger als die Auflösung: gemessen an Slot 12, dessen `Program.main` `sessionId: null`
  trug, während die lebende Pane längst eine gebunden hatte — die MAIN bekam den Report und konnte
  ihn nie beurteilen, und die Owner-Tür griff nicht, weil der Occupant LEBTE. `fleetReportFrom`
  prüft `decision.by` gegen `receiver` auf derselben Occupation: eine Zeile kann strukturell kein
  Occupant-Urteil eines Prinzipals tragen, an den sie nie gefilet wurde.
- **Bei `basis:"program"` entscheidet die aktuell gebundene MAIN des Programs.** Die Self-Tür
  leitet das Program mit `boundProgramForMain` aus ihrem Token ab und vergleicht dessen ID mit
  `provenance.programId`; kein gespeichertes Empfänger-Tripel kann eine Nachfolgerin aussperren.
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
| Program-Zeile, Aufrufer an anderes Program gebunden | 409 `fleet report belongs to another Program — only the bound MAIN of program <id> may judge it` |
| fremde oder ersetzte MAIN | 409 `fleet report belongs to another or replaced MAIN session` (dieselbe Form wie `replyClarification`) |
| Body mit anderem Schlüssel | 400 `body must contain only reason` — dieselbe Disziplin wie `body must contain only status and text` |
| `reason` kein String / > 500 | 400 mit der Grenze im Text |

**Wo ein Event existiert, wird der Transport mitgeschlossen, durch den SCHREIBER der ACK-Route,
nicht durch einen zweiten.** Eine Program-Zeile besitzt kein Event und schreibt nur ihr Urteil.
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

### Die OWNER-Tür — `POST /api/fleet-report/:id/accept` · `/reject`

**Die Tür oben ist an einen Occupant gebunden, und ein Occupant kann sterben.** Gemessen am
2026-09-07 über sechs Panes: eine Program-MAIN mit einem gefileten, unbeurteilten Report war an
ihren Stuhl genagelt — ein Retire machte die Abnahme nicht schwer, sondern DAUERHAFT UNMÖGLICH,
weil `clarificationReceiverFor` den Empfänger aus dem LEBENDEN Occupant auflöst und
`decideFleetReport` gegen ihn vergleicht. Drei von sechs Sessions waren allein deshalb nicht
schließbar. Das ist der Grund, warum diese Flotte Panes ansammelte.

```
curl -s -X POST http://<fleet-host>:<port>/api/fleet-report/<report-id>/accept \
  -H "authorization: Bearer $FLEET_TOKEN" -H 'content-type: application/json' \
  -d '{"reason":"Die MAIN ist weg; Diff gelesen, Scheibe uebernommen"}'
```

- **Sie gilt NUR, wenn kein Occupant mehr lebt.** Lebt der Empfänger-Slot in der gebundenen
  Occupation, ist die Antwort 409 mit der Adresse der Tür, die OFFEN ist — die Abnahme bleibt
  fachlich bei der MAIN, und diese Tür wäre sonst ein Weg, sie zu übergehen. Die Lebendigkeit
  entscheidet EINE Funktion (`server.ts#reportReceiverLiveness`), die beide Türen lesen: eine
  zweite Kopie wäre eine zweite Antwort, die auseinanderdriftet — und die Drift wäre still in der
  schlimmsten Richtung (zwei Prinzipale dürfen, oder keiner).
- **Für eine Program-Zeile meint „lebt" die aktuelle Program-Bindung.** Solange
  `boundProgramForMain` eine lebende MAIN des Programs ergibt, bleibt das Urteil dort; bei staler
  oder fehlender Bindung öffnet die Owner-Tür wie für einen gegangenen alten Empfänger.
- **Eine Owner-Inbox-Zeile (`receiver: null`) gehört hierher**, und zwar von Geburt an: die
  Self-Tür sagt ihr wörtlich „belongs to the owner, who has no session to bind a decision to" — bis
  zu diesem Schnitt gab es diese Tür nicht, und der Satz zeigte ins Leere.
- **Das Urteil wird als OWNER-Urteil gestempelt** (`decision.by: "owner"`), nie als das der toten
  MAIN. Zusätzlich schreibt sie — anders als ihre Self-Zwillingstür — eine Trail-Zeile
  (`fleet_report_owner_decision`): das Urteil einer MAIN ist über deren eigenes
  `GET /api/self/fleet-report` und die Program-Sicht rücklesbar, ein Owner-Urteil hat keine Session,
  aus der man es lesen könnte.
- **Die erste Entscheidung gewinnt über BEIDE Türen.** Ein Report, den seine MAIN vor ihrem Ende
  beurteilt hat, ist beurteilt; der Owner liest danach das stehende Urteil (409), er überschreibt
  es nicht.
- **Sie aktuiert nichts**, in der Disziplin der Self-Tür: kein `Task.status`, kein Land, kein
  Lane-Schluss, kein Text in eine Pane. Und **kein Tick ruft sie** — ein Report, den der Owner nie
  beurteilt, bleibt sichtbar unbeurteilt, statt in ein Urteil hineinzualtern, das niemand gefällt hat.
- **Der automatische Lane-Schluss wird davon NICHT bewaffnet.** `laneAutoCloseRefusal` lehnt ein
  Owner-Urteil ausdrücklich ab (`a report of this lane was judged by the owner, not by its MAIN`):
  dieser Schluss liest ein Urteil als Beleg, dass die koordinierende MAIN die Arbeit gelesen hat und
  mit der Lane fertig ist — ein Fakt, den ein Owner-Urteil nicht trägt.

| Fall | Antwort |
|---|---|
| unbekannte id | 404 `unknown fleet report` |
| Empfänger-Occupant LEBT | 409 `fleet report receiver slot <n> is live — the verdict belongs to that MAIN through POST /api/self/fleet-report/<id>/accept\|reject` |
| bereits beurteilt | 409 `fleet report was already accepted\|rejected` (die stehende `decision` im Body) |
| Body mit anderem Schlüssel | 400 `body must contain only reason` |
| `reason` kein String / > 500 | 400 mit der Grenze im Text |

**ZWISCHEN DEN BEIDEN TÜREN LAG FÜR OCCUPANT-GEBUNDENE ZEILEN EIN FENSTER — gemessen am
2026-09-09 an Report `4e330915`.** Während die Vorgängerin nach `succeed` noch in der Grace lebte,
war ihre Zeile für die Nachfolgerin wegen des alten Empfänger-Tripels und für den Owner wegen des
noch lebenden Slots zugleich 409; erst der Reap öffnete die Owner-Tür. Das bleibt richtig für
`basis:"owner-inbox"` und für jede Lane, deren Program nicht aktiv ist: ihre Zeile bleibt an den
damals abgeleiteten Principal beziehungsweise Occupant gebunden. Für `basis:"program"` ist dagegen
`boundProgramForMain` der Empfänger: die neue MAIN liest und beurteilt dieselbe Program-Zeile sofort,
auch solange der Vorgänger-Slot noch lebt. **Succession verliert ihre Beurteilbarkeit nicht mehr.**

**Und die Sichtbarkeit, die die Tür allein nicht herstellt.** Ein verwaister Report war nicht nur
unbeurteilbar, er war UNSICHTBAR: sein FleetEvent geht beim Teardown auf `receiver-gone` — terminal,
und damit in KEINER der beiden Klassen, die die Operations-Inbox rendert (`opsOpen` will eine
Inbox-Zeile, `opsUnacked` eine lebende Pane-Schuld). Die Zeile lag still da, und eine Absenz las sich
exakt wie „niemand hat hingesehen". Darum:

- **`GET /api/fleet-report`** (Owner) liefert alle Report-Zeilen, wartende zuerst, jede mit einem
  pro Request ABGELEITETEN `liveness: "live" | "gone" | "owner-inbox"` aus derselben einen Funktion.
  Nie gespeichert — eine gespeicherte Kopie wäre eine Behauptung über einen Slot, der inzwischen neu
  geöffnet wurde.
- **`reportsAwaitingOwner`** reitet auf `/api/sessions` als EINE Zahl (bei 0 weggelassen, wie
  `attentionOpen`, `docs/data-saver.md`) und lässt das 📥 im Board erscheinen; die Zeilen holt das
  Panel beim Öffnen und wenn die Zahl SICH BEWEGT.
- **Die Retention hält eine wartende Zeile fest.** `pruneFleetReports` schneidet den terminalen
  Schwanz auf `FLEET_REPORT_KEEP`, und das Event einer verwaisten Zeile wurde genau in dem Moment
  terminal, in dem der Owner zuständig wurde — sie wegzupruen hätte das einzige Objekt gelöscht, auf
  das die Tür wirkt. Die Grenze ist die Tür: eine beurteilte Zeile pruned wie jede andere.

**Sichtbarkeit, zwei Sichten für zwei Leser:**

- **`GET /api/self/fleet-report`** liefert die volle Zeile inklusive `decision` — an den Worker,
  an alte Occupant-Empfänger und bei Program-Zeilen an die aktuell gebundene MAIN.
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
| `decision.by` hielt bei `decision.at` Autorität | `Program.lineage` bei Program-Zeilen, sonst `receiver` | Succession ändert die heutige Bindung, nicht die persistierte Autoritätsgeschichte |
| `disposition === "killed-empty"` | `buildLaneOutcome` | frischer `rev-list --count`, nicht der Cache |

**Beide Verdikte schließen.** Die Tür heißt „beurteilt", nicht „angenommen": ein `rejected` Report
ist eine gelesene Antwort und beendet die Lane genauso wie ein `accepted`. Was NICHT schließt, ist
eine Zeile ohne Urteil. Eine `owner-inbox`-Zeile trägt kein MAIN-Urteil; eine Program-Zeile schließt
nur, wenn `Program.lineage` den urteilenden Occupant zur Urteilszeit als Autorität belegt.

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
   **AUSNAHME seit 2026-09-06: ein Gate, das den Baum NIE ANGESEHEN hat, bindet den nächsten Aufruf
   nicht.** Trägt das letzte Verdikt `verify.ok:null` mit `waitedOut` (nie gestartet, die ganze
   Wartezeit am Suite-Mutex, dann gekillt) oder `timedOut` (mitten in der Arbeit gekillt), dann hat
   es über diese Bytes nichts ausgesagt — der zweite Lauf wiederholt keine Antwort, er erzeugt die
   erste. Die Ausnahme gilt nur für Verdikte OHNE ungeprüfte Konfliktlösung (die ⏸-Ablehnung von
   Sprosse 13 ist eine andere Frage und bleibt). Gemessen am Land von `c3604ce3`: `resolved,
   landed:false`, `waitedOut`, 44 von 46 Minuten Schlange — die Lane war fertig und sauber, konnte
   ihre Bytes also nicht mehr bewegen, und main-Bewegung öffnet den Guard nicht (`4761020`); der
   Kandidat war auf dieser Sprosse dauerhaft tot. **Ein SKIP (`ok:null` ohne beide Flags) ist
   ausgenommen von der Ausnahme:** er ist die eigene Entscheidung des Kommandos über genau diese
   Bytes, identische Bytes überspringen identisch — die Prämisse des Guards hält.
   **Die Ablehnung nennt ihren Zustand:** das Feld `gate` trägt `measured` · `never-started` ·
   `timed-out` · `skipped`, und nur bei `measured` heißt der Satz noch „repair or escalate". Ein
   unvermessenes Verdikt schickt niemanden auf Fehlersuche in einem Baum, den kein Gate gelesen hat.
10. **Die Arbeit darf nicht schon ABGELEHNT sein** (`server.ts#rejectedReportForLand`, seit
    2026-09-08). Trägt der neueste ENTSCHIEDENE `fleetReport` dieser Arbeit — gefunden über
    `worker.cwd` + `worker.branch`, nicht über das Occupant-Tripel, weil ein Land einen BRANCH
    bewegt — `decision.disposition === "rejected"`, dann 409, und der Satz NENNT Report-Id,
    Ablehnenden und dessen `reason`. **Kein Override an dieser Tür:** die MAIN ist der Prinzipal,
    dessen eigene Tür das Verdikt geschrieben hat; ihr Weg ist „Lane repariert, filet neu, DIESE
    Zeile entscheiden" — eine angenommene Zeile macht die Vorbedingung still. Der Owner behält
    seinen Override an `POST /api/slots/:id/merge` (`{"overrideRejectedReport": true}`, Trail-Zeile
    `land_rejected_report_override`), weil eine Ablehnung nie zweitentschieden wird und ein
    fälschlich abgelehnter Branch sonst für JEDEN Prinzipal unlandbar wäre.
    **Drei Fälle, die ausdrücklich NICHT blocken** (die Vorbedingung ist eng gebaut, weil ein
    Fehl-Nein hier schlimmer wäre als der Befund): KEIN Report (Owner-Pfad, reine Messzeile, Lane
    ohne Program) · eine gefilete, noch UNENTSCHIEDENE Zeile (ein Report ist eine Nachricht, keine
    Zustandsänderung — die gewöhnliche Annahme ist, dass die MAIN den Diff liest und landet, ohne
    „accept" zu drücken) · eine Ablehnung, auf die eine ANGENOMMENE Zeile folgt. Umgekehrt CLEART
    eine unentschiedene Zeile eine stehende Ablehnung nicht: sonst käme jedes „kein Land" mit einer
    weiteren ungelesenen Zeile an dieser Tür vorbei. **Abwesenheit ist kein Beweis:**
    `pruneFleetReports` verwirft entschiedene Zeilen über `FLEET_REPORT_KEEP` — die Vorbedingung
    liest die Zeilen, die der Server noch hält, und behauptet nie, es habe nie ein Verdikt gegeben.
    Anlass, gemessen 2026-09-07: Report `e351772b` war `rejected` („kein Land" im Verdikt selbst),
    dieselben Bytes landeten 87 min später als `522701c`, byte-identisch zum abgelehnten Kandidaten
    — Land-Gate UND Post-Land-Audit waren dabei grün und zu Recht grün: sie beweisen „der Baum
    hält", nie „ein Leser hat die Arbeit angenommen".
11. Lane nicht `done-looking` (`laneWatchSignal`, `MERGE_IDLE_MS`) — lebendig, idle, sauber, ahead.
    Ein Server-Prädikat über Fakten, keine Aussage über die Qualität: die liefert die MAIN, indem
    sie überhaupt ruft.
12. Nicht inflight — dieselbe Reservierung (`mergeStart`/`mergeInflight`), die die Owner-Route
    hält, plus `commitInflight`. Zwei Türen, ein Job pro Lane.
13. Ungeprüfte Konfliktlösungen in der Lane (die ⏸-Sperre) sind unter `green-only` eine
    ABLEHNUNG, und die Ablehnung NENNT die Sprosse, die sie nähme (`guarded`). Unter `guarded`
    greift stattdessen die bestätigte Konflikt-Bestätigung unten.

### Das verlorene Fast-Forward: `errorReason: "ff-lost"` (Sprosse 11, die Ausnahme)

**Gemessen 2026-09-02, 06:09–07:20 CEST** (Programm `66499a03`, MAIN Slot 4, Lane Slot 8): ein
Self-Land rebaste sauber, das Gate lief GRÜN (110 s Arbeit nach 1838 s Wartezeit am Suite-Mutex),
und dann verweigerte `git merge --ff-only` das Vorspulen, weil inzwischen ein reiner Docs-Commit
auf main gelandet war. `mergeJob` schreibt dafür `status:"error"`, `"error"` steht in
`MERGE_BLOCKING` — und ab da war die Lane **strukturell nie wieder `done-looking`**: der
lane-ready-Watch konnte nicht feuern, und Sprosse 11 antwortete auf JEDEN weiteren Aufruf
`the lane is not done-looking (no signal)`. Der Owner musste landen; Schritt 5 des Programms war
still zu einem Owner-Land degradiert.

Seit 2026-09-03 trägt genau dieses Verdikt eine **getypte, geschlossene** Zusatzangabe:

```
{"status":"error","landed":false,"errorReason":"ff-lost","verify":{"ok":true,…},
 "detail":"rebase ok, but fast-forwarding main failed: … — lane kept"}
```

- **Das Enum ist geschlossen und trägt seit M3 (2026-09-07) ZWEI Werte:** `ff-lost` und
  `dirty-main` (`lane-signals.ts#MERGE_ERROR_REASONS`; der zweite hat seinen eigenen Abschnitt
  unten). `ff-lost` wird an EINER Stelle geschrieben — dem sauberen Land-Zweig in `mergeJob`, den
  ein rotes, übersprungenes oder abgelaufenes Verify und jeder Konflikt gar nicht erst erreichen.
  `detail` bleibt Prosa und wird **nie geparst**: eine umformulierte Prosa-Zeile hätte die Lane
  sonst still wieder blockiert.
- **Nur die Werte DIESER LISTE heben die Blockade auf** (`lane-signals.ts#mergeBlocksLane`): die
  Klausel „no blocked/errored merge (a lost fast-forward is not one)" der drei Prädikate testet
  POSITIV gegen das PAAR `status === "error"` UND Mitgliedschaft in `MERGE_ERROR_REASONS` — nie
  gegen den Grund allein, und seit M3 gegen die LISTE statt gegen ein Literal, damit Loader und
  Prädikat nicht über verschiedene Mengen entscheiden können. Ein `blocked` (auch eines, das einen
  Grund trägt), ein `error` aus einem geworfenen Merge-Lauf, ein rotes Verify, ein ungelöster
  Konflikt, ein **abwesender** oder unbekannter `errorReason` — alle blockieren unverändert.
  Abwesend heißt UNKNOWN, nie „war wohl ein Rennen".
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

### Der schmutzige Haupt-Checkout: `errorReason: "dirty-main"` (M3, seit 2026-09-07)

**Gemessen 2026-09-05, zweimal** (`docs/messungen/2026-09-06-merge-prozess-robust.md` §2.3, §3 M3):
`git merge --ff-only` läuft im Checkout, der `main` hält, und git verweigert das Vorspulen, wenn
dort **uncommittete Änderungen an einer Datei liegen, die der Land schreibt**. Bis M3 kam diese
Absage erst am ENDE: die Lane rebaste, das Gate fuhr die volle Kette (Median 107 s Arbeit hinter
p90 1 784 s Schlange), und das Verdikt hieß `ff-lost` mit einem git-Fehlertext im `detail` — der
falsche Name, denn main hatte sich nicht bewegt, und die Retry-Kette wiederholt so etwas
richtigerweise NICHT. Jede dieser Sekunden bezahlte eine Antwort, die schon vor dem Start feststand.

Seit M3 wird derselbe Fakt **zuerst** gemessen, in zwei git-Reads und ohne Gate:

```
{"status":"error","landed":false,"errorReason":"dirty-main",
 "detail":"main checkout holds uncommitted changes to files this land touches: a.ts, b.ts
           — commit or stash them in the main checkout, then land again — lane kept"}
```

- **Zwei Prüfstellen, ein Schreiber** (`server.ts#dirtyMainStop`): einmal VOR dem Verify-Plan (also
  vor Hold, Gate und Mutex — das ist der ganze Gewinn) und einmal unmittelbar vor
  `advanceIntegration`, weil zwischen beiden Minuten Gate liegen und der Haupt-Checkout einem
  Menschen gehört, der darin arbeitet. Die zweite Stelle läuft **vor** der Vorspulung und damit vor
  dem `ff-lost`-Zweig: ein main, das sich bewegt UND schmutzig ist, wäre sonst als das Rennen
  gelesen worden, und die Retry-Kette hätte ein zweites volles Gate unter dem Mutex gekauft, um bei
  genau diesem Verdikt anzukommen.
- **Nur der saubere Pfad.** Der Konfliktpfad hält vor `advanceIntegration` ohnehin zur Review an;
  dort wäre `dirty-main` eine Aussage über einen fremden Baum, die ungeprüfte Auflösungen verdeckt.
- **Was gemessen wird:** die schmutzige Seite aus `git status --porcelain -z` des Checkouts, der
  main HÄLT (kein Halter ⇒ `branch -f` bewegt eine Ref, kein Baum steht im Weg ⇒ leer, nie
  unbekannt), geschnitten mit `git diff --name-only --no-renames -z <mainSha>..<branch>`.
  `--no-renames` mit Absicht: die Vorspulung muss den neuen Pfad schreiben UND den alten entfernen.
- **Eine Sonde, die nicht laufen konnte, mintet nichts.** Ein unlesbarer Status oder Diff gibt
  `null` und der Land läuft wie vor M3 weiter — die Vorspulung selbst fängt den Fall dann immer
  noch. Der Schnitt ist eine Abkürzung, kein neues Tor.
- **`verify` fehlt auf dem Verdikt der ersten Prüfstelle** — es wurde nichts gemessen, und das ist
  Absenz, nicht `null`. Die zweite Prüfstelle trägt das Verdikt, das der Baum verdient hat, plus
  `ffRounds`.
- **Wirkung wie bei `ff-lost`:** der Wert steht in `MERGE_ERROR_REASONS`, also blockiert er
  `done-looking` NICHT (`lane-signals.ts#mergeBlocksLane` testet seit M3 das PAAR aus `status ===
  "error"` und Mitgliedschaft in der Liste, nie einen einzelnen Literalwert). Die Lane hat nichts
  falsch gemacht: sobald im Haupt-Checkout committet oder gestasht ist, geht derselbe Land durch
  dieselbe Tür durch. Ein **abwesender** Grund bleibt UNKNOWN und blockiert.

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

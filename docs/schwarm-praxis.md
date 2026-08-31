# Schwarm-Praxis — N Lanes auf EINE Frage

Eine Arbeitsweise, kein Feature: mehrere Lanes gleichzeitig auf dieselbe harte Frage ansetzen, damit
sie **Befunde** produzieren statt Commits. Beide Bausteine liegen fertig im Server — die
Programm-Bindung, die den Rückkanal legal macht, und die Docs-Kurzkette, die eine Messnotiz in
Sekunden landet. Was fehlte, ist die Anleitung und die vier Deckel-Fakten, die sonst jede Session
neu ausmisst. Wer diese Seite gelesen hat, muss `server.ts` nicht öffnen.

**Wann.** Die Frage ist zu groß für einen Kontext und hart genug, dass unabhängige Antworten sie
widerlegen können: eine Gegenprobe an einem Behauptungs-Korpus, ein Audit über mehrere Nähte, ein
Inventar, eine Rot-Team-Runde gegen ein fertiges Papier.

**Wann nicht.** Wenn eine Session die Frage in einem Kontext beantwortet — dann ist der Schwarm
reiner Overhead. Und nie für Code: ein Schwarm, der landet, erzeugt Merge-Rennen statt Befunde
(Fakt 3 unten).

---

## Der Aufbau in sechs Schritten

Owner-Token in `$FLEET_TOKEN`; alle Routen unter `/api/programs` und `/api/tasks` sitzen hinter dem
Owner-Gate (`server.ts#tokenGate`, akzeptiert `Authorization: Bearer`, das `fleet`-Cookie oder
`?token=`). Rechenbeispiel vorweg: **ein Schwarm aus N Lanes belegt N+1 Slots** — die Lanes plus die
Program-MAIN, die sie empfängt.

### 1. Die Frage schneiden

N Aufträge, jeder für sich beantwortbar, jeder mit eigenem Done-Kriterium und eigenem
Verifikationsweg. Der Schnitt ist die eigentliche Arbeit: zwei Lanes, die dieselbe Datei lesen und
verschiedene Fragen stellen, sind billig; zwei Lanes, die dieselbe Frage stellen, sind eine
Gegenprobe (auch gut — aber dann absichtlich, mit verschiedenen Harnesses); zwei Lanes, deren
Antworten sich gegenseitig voraussetzen, sind ein Fehlschnitt und laufen seriell.

### 2. Programm anlegen, bestätigen, aktivieren

```sh
curl -X POST http://<fleet-host>:<port>/api/programs \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"title":"Gegenprobe Schwarm-Programm","intent":"…","successCriterion":"…",
       "nonGoals":[],"decisions":[],"evidence":[],"openQuestions":[]}'
# → { ok: true, program: { id: "<programId>", status: "proposed", … } }
curl -X POST http://<fleet-host>:<port>/api/programs/<programId>/confirm  -H "authorization: Bearer $FLEET_TOKEN" -d '{}'
curl -X POST http://<fleet-host>:<port>/api/programs/<programId>/activate -H "authorization: Bearer $FLEET_TOKEN" -d '{}'
```

Alle sieben Inhaltsfelder sind Pflicht, auch die leeren Listen — `server.ts#validateProgramContent`
lehnt ein fehlendes `nonGoals` mit 400 ab, nicht mit einem Default. `confirm` darf Korrekturen
mitschicken; `activate` geht nur aus `confirmed`. **Nur ein `active` Programm zählt** — Fakt 1 unten
liest `program.status === "active"` und sonst nichts.

### 3. Program-MAIN öffnen

```sh
curl -X POST http://<fleet-host>:<port>/api/programs/<programId>/bootstrap-main \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"cwd":"/pfad/zum/haupt-checkout","harness":"claude","model":"opus","effort":"high"}'
```

`server.ts#bootstrapProgramMain` nimmt einen **freien** Slot, bootet die Session, wartet auf ihre
Bereitschaft und schickt einen servergebauten Gründungsbrief; erst danach schreibt es
`program.main = { slot, openedAt, sessionId, boundAt }`. Diese Session ist der Empfänger aller
Berichte. Zwei Verhalten, die man kennen sollte: eine **lebende** Bindung wird nie verdrängt (die
Route antwortet `{ok:true, existing:true}` und ändert nichts), eine **tote** wird ersetzt und die
Antwort nennt, was sie ersetzt hat.

### 4. Je Auftrag eine Zeile, program-gebunden, dann starten

```sh
curl -X POST http://<fleet-host>:<port>/api/tasks \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" \
  -d '{"text":"<der ganze Brief>","kind":"auftrag","repo":"/pfad/zum/repo","programId":"<programId>"}'
# → { ok: true, task: { id: "<taskId>", status: "pending", … } }
curl -X POST http://<fleet-host>:<port>/api/tasks/<taskId>/dispatch \
  -H "content-type: application/json" -H "authorization: Bearer $FLEET_TOKEN" -d '{}'
```

Der Dispatch öffnet den Worktree, schickt den Brief und stempelt `taskId`, `originId` und
`programId` auf den Slot. **Das ist die einzige Tür, die eine Lane program-gebunden macht.**
`POST /api/lanes` öffnet zwar auch eine Lane, aber `openSlot` setzt `s.programId = null` und nur der
Dispatch stempelt es zurück — eine per `POST /api/lanes` geöffnete Lane hat keinen
`program-main`-Empfänger und bekommt auf `POST /api/self/fleet-report` eine 409.

Ohne `repo` in der Zeile braucht der Dispatch die Env-Vorgabe `FLEET_DISPATCH_REPO`; fehlt beides,
antwortet er 400. `kind` muss `auftrag` sein — eine `notiz` ist beratend, der Dispatcher führt sie
nie aus.

### 5. Der Brief

Ein Kopfblock für alle Lanes (Verbote, Werkzeug-Eigenheiten, Herkunft der Verify-Zeile) plus je
Lane ein Abschnitt mit: Auftrag in einem Satz · warum kein Code · was belegt in die Notiz gehört ·
Done-Kriterium in einem Satz · die wörtliche Verify-Zeile · Nicht-Umfang. Muster:
`briefs/schwarm-programm-auftraege-2026-08-27.md`, allgemeine Form: `docs/lane-brief-template.md`.

**Bei fremdem Harness gehört das Notiz-Template in den Brief.** Eine Lane unter `pi-*` oder `codex`
hat **keine** Skills im Worktree: der Harness legt seine Skill-Kopien unter `.agents/` ab, das ist
gitignored und existiert in keinem Worktree, und `.claude/skills/mess-notiz/SKILL.md` ist die
claude-seitige Kopie. Beleg, dass das reicht: die GLM-Gegencheck-Lane vom 2026-08-27
(`pi-zai`/`glm-5.3`) lieferte eine formgerechte Notiz, weil die Struktur im Brief stand
(`docs/messungen/2026-08-27-gegencheck-schwarm-programm.md`).

Das Template, das dann in den Brief kopiert wird (Quelle und Feldsemantik:
`.claude/skills/mess-notiz/SKILL.md`):

```markdown
---
frage: <eine Zeile — was gemessen wurde>
urteil: <eine Zeile — die ANTWORT, nicht die Zusammenfassung; kein " — " darin>
bereich: [<tag>, <tag>]
belege: [<pfad>#<symbol>, ...]
nicht-gemessen: <eine Zeile>
stand: YYYY-MM-DD
---

# <Frage, die gemessen wurde>
## Ergebnis
## Methode
## Was nicht gemessen wurde
```

Dazu genau eine angehängte Zeile in `docs/messungen/INDEX.md`:
`- <urteil> — docs/messungen/<datei>.md · bereich: a,b · stand: YYYY-MM-DD`.

### 6. Ernten — und der Schritt, ohne den der Schwarm nur Papier ist

Jede Lane meldet mit `POST /api/self/fleet-report` — Body genau `{status, text}`, `status` eines von
`complete` · `needs-main` · `failed` (`src/protocol.ts`, `FLEET_REPORT_STATUSES`), Text bis
`MAX_FLEET_REPORT_TEXT` = 4000 Zeichen —, landet ihre Notiz und schließt. Die Route ist lane-only:
eine MAIN oder der `⚙ steward` bekommt dort 409. Die Program-MAIN liest die Zeilen mit
`GET /api/self/fleet-report` und quittiert jede mit `POST /api/self/events/<eventId>/ack` —
**Quittieren ist kein Höflichkeitsakt, es gibt Budget frei** (Deckel-Tabelle unten). Vollständige
Referenz beider Routen: `docs/self-api.md` §fleet-report.

Danach kommt der Schritt, der den Unterschied zwischen einem Schwarm und einem Stapel Notizen
macht: **eine Synthese-Lane oder die MAIN selbst liest alle N Notizen und schreibt eine Notiz über
die Notizen** — was sich widerspricht, was mehrfach unabhängig bestätigt wurde, was keine Lane
angefasst hat. Ohne diesen Schritt hat der Lauf N Dateien und keine Antwort.

---

## Die vier Fakten, die den Aufbau tragen

**1 — Programm-Bindung macht den Rückkanal legal.** `server.ts#clarificationReceiverFor` sucht
zuerst nach `lane.programId`, holt das zugehörige `active` Programm und prüft, ob dessen
`program.main` noch auf denselben lebenden Slot mit derselben `openedAt` zeigt. Trifft das zu, ist
das Ergebnis `basis: "program-main"` — und zwar **bevor** irgendeine Watch-Evidenz gelesen wird. Die
`sessionId` wird berichtet, nie gegatet: dieselbe Pane nach `/clear` bleibt derselbe Empfänger.

`server.ts#openFleetReport` hat danach genau zwei 409-Türen, direkt untereinander:

- `const resolved = clarificationReceiverFor(s); if ("error" in resolved) … 409` — kein Empfänger
  auflösbar (kein Programm, keine lebende MAIN, oder bei einer programmlosen Lane mehrdeutige
  Watch-Evidenz).
- `if (slotDeliveryBudget(resolved.receiver.slot).free === 0) … 409` mit dem Satz
  *„fleet-report receiver has no FleetEvent delivery budget"* — der Empfänger ist voll.

Die zweite Tür ist der Grund, warum Ernten (Schritt 6) zum Aufbau gehört und nicht danach kommt.

**2 — Eine Messnotiz landet über die Docs-Kurzkette.** `verify-proportion.ts#ruleFor` gibt für jeden
Pfad unter `docs/`, `briefs/`, `drops/`, für jede `.md` im Wurzelverzeichnis und für `.gitignore` das
`DOC_RULE` zurück, dessen Schritte `DOC_STEPS = ["install", "pins"]` sind. Klassifiziert **jede**
Datei des Diffs so, fährt der serverseitige Land-Gate die kurze Kette und stempelt
`verify.proportional: true` samt `verify.steps` ehrlich auf die `fleet/land`-Note; ein leerer oder
gemischter Diff fällt auf die volle Kette zurück. Gemessen am Gegencheck-Land `e3e5d29`: **559 ms**,
`"proportional": true`, `"steps": ["install","pins"]` (`git notes --ref=fleet/land show e3e5d29`).
Der Post-Land-Audit bleibt unverändert voll — die Kurzkette ist der schnelle Beweis, nie der Ersatz.

**3 — Keine Lane landet Code, also nimmt keine Lane den Suite-Mutex.** Der maschinenweite Mutex
`/tmp/fleet-e2e.lock` wird an genau einer Stelle im Suite-Pfad genommen: `e2e-stage.sh`, das alle
sieben Suite-Wrapper einlesen (`docker-verify.sh` nimmt denselben Pfad für den Container-Lauf).
Eine Findings-Lane fährt keine Suite: `bun e2e/pins.ts` startet keinen Server, kein tmux, kein
Netzwerk und geht nicht durch `e2e-stage.sh`. Der Schwarm konkurriert also **nicht** mit dem
Post-Land-Audit des Servers, der genau diesen Mutex braucht. Landet eine Schwarm-Lane doch Code,
ist dieser Satz sofort falsch — und N Lanes serialisieren sich am Mutex und am Land-Gate.

**4 — Der beaufsichtigte Pfad hat keinen Lane-Deckel.** `DISPATCH_MAX_LANES` (Code-Default 3; der
live laufende Server bekommt `FLEET_DISPATCH_MAX_LANES=2` aus `watchdog.sh`) wird an genau einer
Stelle geprüft: in `server.ts#tickDispatch`, dem unbeaufsichtigten Tick. Weder
`POST /api/lanes` noch `POST /api/tasks/<id>/dispatch` liest ihn — der Kommentar an der
Dispatch-Route sagt es wörtlich („NOT bound by `DISPATCH_MAX_LANES` — the cap bounds UNATTENDED
fan-out, and this is an attended click"). Die einzige Decke, gegen die ein Aufbau von Hand läuft,
ist `MAX_SLOTS = 16` — `POST /api/lanes` und `bootstrap-main` antworten beide mit
`{"error":"no free slot"}`, 409, wenn keiner mehr frei ist.

---

## Deckel, die man vor dem Aufsetzen kennen muss

| Deckel | Wert | Wo | Was passiert beim Anlaufen |
|---|---|---|---|
| Slots insgesamt | `MAX_SLOTS = 16` | `server.ts` | 409 `no free slot` — geteilt mit **allem anderen**, was gerade läuft |
| Lanes je Repo, unbeaufsichtigt | `DISPATCH_MAX_LANES` (Code-Default 3, live 2) | `server.ts#tickDispatch`, `watchdog.sh` | Tick wartet; ein Dispatch von Hand ist davon nicht betroffen |
| Offene Zustellungen je Empfänger | `FLEET_EVENT_MAX_OPEN_PER_SLOT = WATCH_MAX_PER_SLOT` = 5 | `server.ts#slotDeliveryBudget` | 409 auf den nächsten `fleet-report` |
| Text je Bericht | `MAX_FLEET_REPORT_TEXT` = 4000 Zeichen | `server.ts` | 400 |
| Aufbewahrte Berichte | `FLEET_REPORT_KEEP` = 20 | `server.ts` | älteste werden gekappt |

**Das Zustellbudget ist die Zahl, die Schwarm-Größe wirklich bindet, und sie ist geteilt.**
`slotDeliveryBudget` rechnet `free = cap − deliveryDebts − armedReservations`: offene FleetEvents
**und armed Watches auf denselben Slot** zehren aus demselben Topf von 5 (abgeleitet aus der
Funktion, nicht separat gemessen). Praktisch: eine MAIN mit fünf armed Lane-Watches hat null Budget
und weist jeden Bericht ab. Program-Bindung braucht gar keinen Watch — aber sechs Lanes, die
gleichzeitig fertig werden, treffen trotzdem die 5, solange die MAIN nicht quittiert. Also: MAIN
soll wach sein und ackern, oder der Schwarm bleibt bei fünf gleichzeitig berichtenden Lanes.

---

## Risiken

**Maschinenlast.** Die gemessene Nicht-Determiniertheit gilt nicht nur für Suiten: zwei gleichzeitige
`./e2e-isolated.sh` erzeugen auf dieser Maschine zuverlässig Fehler auf **beiden** Bäumen
(`docs/verify-tiering.md`, `docs/suite-contention.md`). N Lanes sind N Agenten, die gleichzeitig
lesen, greppen und tsc laufen lassen — das kostet dieselbe Maschine. Der Schutz hier ist Fakt 3
(keine Suiten im Schwarm), nicht Glück; er hält nur, solange keine Schwarm-Lane Code landet.

**Provider-Kontext.** N Lanes derselben Familie teilen sich Rate Limits und Kontextbudget. Ein
Schwarm aus gemischten Harnesses (`claude`, `pi-*`, `codex`) verteilt die Last und liefert
nebenbei die wertvollere Gegenprobe — kostet aber den Template-Aufwand aus Schritt 5.

**Die 16 Slots sind geteilt.** Ein Schwarm aus 6 Lanes plus MAIN belegt 7 von 16, und die echte
Arbeit — Program-MAINs, der `⚙ steward`, Sessions des Owners — steht daneben. Vor dem Aufsetzen
zählen, nicht hinterher.

**Ein Schwarm ohne Synthese produziert nur Papier.** N Notizen sind kein Ergebnis, sondern N
Behauptungen mit N Belegmengen. Die Synthese ist der Schritt, der aus Widersprüchen einen Befund
macht; sie ist Teil des Laufs, nicht sein Nachspiel.

**Der Empfänger kann sterben.** Der Lauf vom 2026-08-27 wurde ohne Programm-Bindung aufgesetzt: die
Lanes berichteten über einen owner-seitigen Lane-Watch auf die Themen-Session, `basis: "lane-watch"`
— stirbt diese Session, haben die Lanes keinen Empfänger und die Berichte gehen ins Leere
(`HANDOFF.md` vom 2026-08-27, §„Zweite Konsequenz"). Genau dagegen steht Schritt 2–4: eine
`program-main`-Bindung hängt am Programm, nicht an der Session, die den Schwarm aufgesetzt hat.

---

## Was hier bewusst nicht steht

Kein Board-Knopf, keine Route, kein „Schwarm-Objekt". Der Aufbau ist fünf `curl`-Aufrufe plus je
Lane zwei — von Hand, absichtlich. Wenn die Praxis sich bewährt und das Aufsetzen nervt, ist **dann**
der Zeitpunkt für Mechanik.

## Provenienz

Auftrag C aus `docs/attic/schwarm-programm-2026-08-27.md`, Brief in
`briefs/schwarm-programm-auftraege-2026-08-27.md`. Die vier Fakten sind am Baum nachgelesen
(Symbolverweise, keine Zeilennummern — diese Seite trägt kein Datum im Namen und altert mit dem
Code); die 559-ms-Zahl stammt aus der `fleet/land`-Note von `e3e5d29`, die Harness-Tatsache aus dem
Lauf vom 2026-08-27. Was NICHT geprüft wurde: kein Schwarm wurde nach dieser Anleitung tatsächlich
aufgesetzt — die Schritte sind aus den Routen abgeleitet, nicht durchgespielt.

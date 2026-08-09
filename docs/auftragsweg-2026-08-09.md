# Der Auftragsweg: wie eine aufgegebene Aufgabe geprüft und weitergegeben wird

**Sitzung:** zweite MAIN-Session am 2026-08-09. **Baum:** `bbb5dbd` (docs-only über `94b1362`).
Alle Zeilenangaben gegen diesen Stand, alle Zahlen an `fleet.json` / dem laufenden Server gemessen.

Teil 1 (§1–2) ist die Absicherung der vorigen Analyse als **fünf Changes**.
Teil 2 (§3–8) ist die neue Untersuchung: **Pools, Prüfschritte, Werkzeug-Zuordnung** — der Weg, den
Arbeit nimmt, wenn der Owner (später: ein Team) sie an die Main-Session gibt.

---

# TEIL 1 — Die fünf Changes aus der Rückkanal-Analyse

Analyse: `docs/rueckkanal-2026-08-09.md`. Jede Zeile liegt als **Entwurf** (`pending`, nicht
freigegeben) in der Queue, jede mit hartem Done-Kriterium und Verify-Weg.

| # | Zeile | Change | Größe | Hängt an |
|---|---|---|---|---|
| 1 | `0ae22c2d` | **`FLEET_AUDIT_PING_MS=60000`** in `watchdog.sh:153`, `launchctl kickstart` ZUERST. Kein Code. | Betriebszeile | erst `4455adca` landen |
| 2 | `58d03512` | **Der Busy-Gate**: eine Nachricht erreicht nur eine parkende Session (`canDeliver`, `server.ts:3596`). Zweiter Sensor oder Zustellung auf der Turn-Grenze — **Owner-Entscheid vor Bau**. | Entscheidung, dann klein | serialisieren mit `fc47f1e1` |
| 3 | `d45898cb` | **Ein „Grün", das nichts gemessen hat**, ist für den Ping unsichtbar (Filter liest `result === "red"`, `server.ts:5819`). Weg (b) = eine Zeile Filter; Weg (a) = Ledger-Semantik. | klein (b) / mittel (a) | — |
| 4 | `29829dac` | **Deploy-Verdikt `ok:false`/`null` bekommt einen Empfänger.** `DEPLOY_FILE` wird heute an genau einer Stelle gelesen: `server.ts:11242`, der Route. | mittel | erbt #2 |
| 5 | `08230c93` | **Kettenlänge aufzeichnen** (Generation + Ketten-Id + Ledger-Zeile je Übergabe). `handleSelfSucceed` übergibt heute nichts davon. Stufe 1 (record), nichts darüber. | mittel | — |

**Reihenfolge:** 1 → 2 (Entscheid) → 3 → 4 → 5. #1 ist heute wirkungslos (Backlog null) und genau
deshalb billig; #2 ist die Entscheidung, an der 3 und 4 hängen; #5 ist unabhängig.

**Nicht als Change vorgeschlagen und mit Absicht:** der Eingang (`FLEET_BACKLOG_NUDGE_MS`). Seine
erste Bedingung ist eine Frage an den Owner (die Sortierung), keine Arbeit — siehe §3 dort.

---

# TEIL 2 — Wie Arbeit hereinkommt, geprüft wird und weitergereicht wird

## 3. Die vier Pools

**Pool A — die ARBEIT (`Task`).** `MAX_TASKS = 200` (`server.ts:1376`). **Heute: 198.**
Drei orthogonale Achsen, und sie werden regelmäßig verwechselt:

- **`source`** — *wer hat es eingereicht*: `owner` | `intake` | `steward`. Gemessen: **owner 177,
  steward 21, intake 0**.
- **`kind`** — *was ist es*: `lane` (ein Auftrag, den der Dispatcher fahren darf) | `note` (eine
  Beobachtung an den OWNER, die **nie** dispatcht wird). Gemessen: lane 177, note 21 — die Achse
  fällt heute exakt mit `source` zusammen (jede Owner-Zeile ist `lane`, jede Steward-Zeile `note`).
- **`status`** — *wo im Weg*: `pending` → `queued` → `sent` → `done` | `archived`. Gemessen:
  done 101, pending 66, archived 30, **sent 1**, **queued 0**.

**Pool B — die AUSFÜHRENDEN (`Slot`).** `MAX_SLOTS = 16` (`server.ts:34`), feste Plätze. Vier
Rollen, unterschieden **nicht** durch ein Typ-Feld, sondern durch zwei Eigenschaften:
`worktree !== null` → **Lane** · `worktree === null` → **Main-Session** · `label === "⚙ steward"` →
**Steward** (eine stehende Rolle, nie Lane, nie `done-looking`) · Gäste liegen ausserhalb des Repos
unter `~/.claude-fleet-guest/<n>/`. **Deckel für Unbeaufsichtigtes: `DISPATCH_MAX_LANES = 2`, und
zwar pro ZIEL-REPO** (`server.ts:4256-4258`, `inRepo`), nicht fleet-weit.

**Pool C — die WEGWERF-ARBEITER.** Zehn benannte Kontrakte (`WORKER_CONTRACTS`,
`src/protocol.ts:131-148`), alle durch **einen** Trichter: `runWorker` (`server.ts:5203`). Sie
belegen **keinen Slot** — sie sind eine tmux-Session namens `sum-*`, die nach dem Lauf getötet und
deren Transkript gelöscht wird. Beim Boot wird jede überlebende `sum-`-Session gereapt
(`server.ts:10015`).

**Pool D — die FÄHIGKEITEN.** Genau **drei** Tool-Profile, und die Dreizahl ist der Kern der
Sicherheitsarchitektur:

| Profil | Ort | Was es darf |
|---|---|---|
| `TEXT_ONLY_TOOLS` | `server.ts:5092` | `--tools ""` — **gar nichts**. Ein Fähigkeits-Schnitt, den `settings.json` nicht aufweiten kann. |
| `REVIEW_TOOLS` | `server.ts:6738` | `git status/diff/log` + verankertes `Read/Grep/Glob`, mit `--setting-sources ""` |
| `MERGE_TOOLS` | `server.ts:6728` | zusätzlich `Edit/Write` + `git add/rm/checkout/rebase/commit` + `graphify` |

`--setting-sources ""` trägt in beiden verankerten Profilen die ganze Last: ohne es sind die Anker
(`Read(**)`) **nachweislich wirkungslos**, weil `--allowedTools` additiv zur Owner-Allow-Liste ist.

## 4. Wer verarbeitet welches Werkzeug — die Zuordnungstabelle

Alle zehn `runWorker`-Aufrufstellen, am Code abgelesen:

| Worker | Aufrufstelle | Tools | Modell | Stand-in-Env | Wozu |
|---|---|---|---|---|---|
| `analysis` | `server.ts:4049` | **REVIEW** | **`claude-opus-5`** (`3899`) | `FLEET_ANALYSIS_CMD` | urteilt über eine Queue-Zeile: `ready`/`needs-you`/`unknown` + `blockers` + `collides` |
| `refine` | `4203` | **REVIEW** | **`claude-opus-5`** (`4110`) | `FLEET_REFINE_CMD` | schneidet eine rohe Zeile in 1..N Kinder mit Kriterium + `files` |
| `enhance` | `6249` | TEXT-ONLY | `SUMMARY_MODEL` | `FLEET_ENHANCE_CMD` | kompiliert den **Brief** (und bedient ✨ im Compose) |
| `summary` | `5292` | TEXT-ONLY | `SUMMARY_MODEL` | `FLEET_SUMMARY_CMD` | die Sideboard-/Gast-Zusammenfassung eines Slots |
| `review` | `5611` | TEXT-ONLY | `SUMMARY_MODEL` | `FLEET_REVIEW_CMD` | 🔍 ③ Lane-Review (auch auto-③) |
| `commitMsg` | `6155` | TEXT-ONLY | `SUMMARY_MODEL` | `FLEET_COMMIT_CMD` **+ Repo-Override** | schreibt die Commit-Message beim Host-Commit |
| `merge` | `8381` | **MERGE** | `SUMMARY_MODEL` | `FLEET_MERGE_CMD` | der Konflikt-Resolver auf dem Land-Pfad |
| `repair` | `8478` | **MERGE** | `SUMMARY_MODEL` | `FLEET_MERGE_CMD` | die Reparatur-Runde danach |
| `cleanReview` | `8810` | REVIEW | `SUMMARY_MODEL` | `FLEET_CLEAN_REVIEW_CMD` | ② Clean-Path-Reviewer (`FLEET_CLEAN_REVIEW=off`) |
| `digest` | `11432` | TEXT-ONLY | `SUMMARY_MODEL` | `FLEET_DIGEST_CMD` | die 🧭 Steward-Sicht |

**`SUMMARY_MODEL` = `claude-sonnet-5[1m]`** (`server.ts:5031`). **`DEFAULT_MODEL`** (`188`) ist die
Interaktiv-Stufe für Sessions und Lanes ohne eigenen Pin.

Drei Dinge, die diese Tabelle sichtbar macht und die einzeln nirgends stehen:

1. **Nur zwei Worker laufen auf der Interaktiv-Stufe** — `analysis` und `refine`, beide `opus-5`,
   beide mit einer ausdrücklichen Begründung im Code: *„the analyst runs on the interactive tier …
   it is the one worker whose reading the owner delegates his own critical look to"* (`3897-3898`).
   Alles andere ist Sonnet.
2. **Die einzigen zwei Schreiber sind `merge` und `repair`.** Alle acht anderen können den Baum
   strukturell nicht anfassen. Der `cleanReview` wurde ausdrücklich von MERGE auf REVIEW
   heruntergestuft, weil er *„runs on the one path nobody watches"* (`6729-6737`).
3. **Nur EIN Worker ist pro Repo umkonfigurierbar:** `commitMsg` (`REPO_WORKER_KEYS`,
   `server.ts:1324`). `merge`/`repair` (ihre Ausgabe **wird** Code) und `review`/`cleanReview`
   (Urteile, auf die ein Land gated) sind es ausdrücklich nicht.

## 5. Der Weg einer Aufgabe — sechs Stationen, und welche heute leer sind

```
  (1) EINREICHEN        (2) KOMPILIEREN     (3) PRÜFEN         (4) FREIGEBEN   (5) WÄHLEN      (6) ÜBERGEBEN
  owner   POST /api/tasks  ─┐                                    ▸ queue         tickDispatch    briefAndSend
  intake  POST /api/intake ─┼─► tickAnalysisSweep ──► tickAnalysisSweep ──► releaseTask ──► Auswahl ──► Lane
  steward POST /api/steward/tasks ─┘  Task.brief (enhance)   Task.analysis (analysis)   pending→queued   +Gates      queued→sent
                                      ▲                                                       │
                                      └── ↻ refine (Vorschlag) ── refine-confirm (mintet Kinder)
                                      └── ▸ clarify first (Lane schlägt Kriterium vor) ── criterion-confirm
```

**Station (1) — Einreichen.** Drei Türen, mit **verschiedenen Rechten**, und der Unterschied ist die
ganze Sicherheitsaussage:

| Tür | Route | `kind`-Default | `repo` | Deckel |
|---|---|---|---|---|
| Owner | `POST /api/tasks` (`13790`) | `lane`, fest | **wählbar**, an der Grenze als Verzeichnis geprüft | `MAX_TASKS` |
| Intake (Team) | `POST /api/intake` (`9576`) | `lane`, fest | **hart `null`** | 30/Stunde, Text 20 000 |
| Steward | `POST /api/steward/tasks` (`11797`) | **`note`**, opt-in `lane` | **hart `null`** | `STEWARD_MAX_PENDING` |

Der Kommentar sagt, warum: *„a steward text is an observation unless the steward explicitly claims
it is a runnable work brief … the unsafe direction (an observation dispatched into a lane) needs a
deliberate opt-in, not a typo"* (`11792-11794`). Und `repo` ist Owner-only, weil *„intake and
steward can never choose where external text materializes as a working session"* (`1080-1082`).

**Station (2)+(3) — Kompilieren und Prüfen.** Beides passiert in **derselben Funktion**,
`tickAnalysisSweep` (`server.ts:3977`): sie kompiliert fehlende Briefs über `runEnhance`
(`4017-4018`) und lässt danach den Analysten über Entwurf **und** Brief urteilen (`4049`).

**Station (4) — Freigeben.** `releaseTask(t, by)` (`server.ts:1399`) ist bewusst eine Funktion und
keine Zuweisung: `releasedBy` darf an einem künftigen unbeaufsichtigten Promote nicht vergessen
werden. **Gemessen: `owner` 47, `machine` 0** — noch nie hat die Maschine eine Zeile freigegeben.

**Station (5) — Wählen.** `tickDispatch` (`4227`), seriell, eine Lane pro Tick.

**Station (6) — Übergeben.** `briefAndSend` (`3801`): `next.brief?.text ?? next.text`. **Kein
Modellaufruf** — was geprüft wurde, ist auch das, was läuft.

## 6. Die Befunde, gerankt

### B1 — Der Analyst ist AUS, der Dispatcher ist AN. Damit ist die gesamte Prüf-Station leer.

`FLEET_ANALYSIS_MS=0` steht in der srv-Spawn-Zeile (`watchdog.sh:153`; der Config-Sensor von
`./state.sh` bestätigt `live=0`). Der Sweep wird nur bei `> 0` registriert (`server.ts:10181`).
Folgen, alle vier am Code gelesen:

- **Kein Brief wird je kompiliert.** Der einzige Schreiber von `Task.brief` mit einem Modell ist
  `server.ts:4018`, im Sweep. Eine Lane bekommt also den **Rohtext der Zeile**.
- **Keine Analyse.** Keine neue Zeile bekommt je ein `verdict`, `blockers`, `collides`.
- **Der „UNATTENDED INVARIANT" im Dispatcher entfällt vollständig.** Der Block bei
  `server.ts:4269-4308` — nicht-analysiert-Gate, Staleness-Gate, Kollisions-Gate — steht **im
  ganzen** in `if (ANALYSIS_TICK_MS) { … }`. Ist der Analyst aus, wird nichts davon geprüft.
- Das ist **bewusst so konstruiert** und im Kommentar begründet: *„a released queue that silently
  never drains is worse than an unread one … No reader configured, no read required"* (`4266-4268`).

**Warum es trotzdem ein Befund ist:** die Begründung trägt für ein Fleet *ohne* Dispatcher. Hier ist
`dispatch.on = true` mit `maxLanes 2` (live gemessen). Die einzige verbleibende Bremse ist, dass
`queued` ausschließlich aus einem Owner-Klick entsteht (`releasedBy`: 47 owner / 0 machine) — **ein
Klick genügt, und die Zeile geht ungelesen, ungeprüft, unkollisionsgeprüft und mit ihrem Rohtext in
eine Lane.** Heute ist die Lage entschärft, weil **0 Zeilen `queued`** sind; die Aussage ist eine
über den nächsten Klick, nicht über den aktuellen Zustand.

**Zu entscheiden ist nicht „Analyst an/aus", sondern:** soll `▸ queue` bei abgeschaltetem Analysten
überhaupt in eine unbeaufsichtigte Lane führen dürfen — oder ist der richtige Ort für die Aussage
„niemand hat das gelesen" der **Knopf**, nicht der Tick?

### B2 — `POST /api/tasks/:id/reanalyse` ist auf diesem Deployment eine LÖSCHUNG, kein Refresh.

`server.ts:13886-13888` setzt `t.analysis = undefined` und wirft einen un-editierten Brief weg. Der
einzige Wiederhersteller ist der Sweep — der hier **nie läuft**. Ein Klick vernichtet damit
unwiederbringlich ein Opus-5-Urteil und einen kompilierten Brief, und die Route antwortet `ok:true`.

Betroffene Menge, gemessen: **109 Zeilen mit Analyse, 128 mit Brief, davon 84 maschinen-kompiliert.**

Der Kommentar an Ort und Stelle ist korrekt für ein Fleet mit laufendem Analysten
(*„analyse this again means the whole reading"*) — er beschreibt eine Welt, die hier abgeschaltet
ist. Der Schnitt ist klein: die Route verweigert bei `ANALYSIS_TICK_MS === 0` mit 409 und sagt, dass
niemand neu urteilen würde.

### B3 — `Task.files` ist über 198 Zeilen **null mal** gesetzt.

Das Feld ist laut seinem eigenen Kommentar *„the only machine-readable surface a NOT-YET-STARTED
task can have"* (`server.ts:1083-1090`) und wird **ausschließlich** von `refine-confirm` geschrieben
(`13952`). Gemessen: 8 Zeilen tragen ein `refine`, `audit.jsonl` kennt 2 `task_refine_confirm` —
und **0 Zeilen tragen `files`**.

Konsequenz für die Kollisionsprüfung, und `./register.sh` §2 sagt es selbst: alles läuft auf
`[grob]` (Dateinamen aus der Prosa gelesen — „gleiche DATEI ist nicht gleicher Code") und `[modell]`
(das Urteil des Analysten, das hier ohnehin nicht mehr produziert wird). **Die einzige
mechanische Wahrheit über eine noch nicht gestartete Zeile existiert als Feld und ist leer.**

### B4 — Der Team-Eingang ist gebaut, korrekt gebaut, und aus.

`GET /api/sessions` liefert live `intake: false`. `FLEET_INTAKE_SECRET` steht weder in
`watchdog.sh` noch in `.env`; die Route antwortet **404 „intake disabled"** (`9576`) — nicht 401,
also verrät sie nicht einmal, dass es sie gibt. `source: "intake"`: **0 von 198 Zeilen, je.**

Was beim Einschalten mitkommt und was man vorher wissen sollte:
- Rate-Limit 30/Stunde (`9595-9596`), Text auf `MAX_TASK_TEXT` = 20 000 gekappt,
  `from` ist Freitext und **ausdrücklich nie vertraut** (`Task.from`: „for display only").
- `repo: null` hart, `kind: "lane"` hart, `status: "pending"` — eine Team-Zeile **kann** ohne
  Owner-Freigabe nicht laufen.
- **Die eine Asymmetrie, die ein Team betrifft:** eine Intake-Zeile wird als `lane` geboren, eine
  Steward-Zeile als `note`. Fremder Text ist damit einen Klick von einer Lane entfernt, die
  Beobachtung des eigenen Agenten braucht ein ausdrückliches Adopt. Das ist verteidigbar (ein
  Mensch, der etwas einreicht, *will* Arbeit) — aber es ist die Voreinstellung, die ein Team als
  erstes trifft, und sie steht heute nirgends geschrieben.

### B5 — Die Queue steht 2 Zeilen vor ihrem Deckel, und was dann fällt, ist das Gedächtnis.

198 von `MAX_TASKS = 200`. `capTasks` (`server.ts:1379-1386`) hält alle **lebenden** Zeilen und
wirft die **ältesten terminalen** weg. Live sind 67 (66 pending + 1 sent), terminal 131. Ab Zeile
201 fällt also je eine `done`/`archived`-Zeile heraus — leise, ohne Ledger, ohne Zähler.

Das ist genau das Gedächtnis, das ein Team bräuchte, um nicht dieselbe Zeile ein zweites Mal
einzureichen. Der Deckel ist richtig (der 2-s-Poll trug einmal 107 KB Task-Texte); die **stille**
Räumung ist der Teil, der eine Entscheidung verdient.

**Aus einer Vorhersage wurde beim Schreiben dieses Dokuments eine Messung.** Das Ablegen der drei
Zeilen aus §8 hat den Stand von 198 auf 201 gehoben; `capTasks` hat ihn auf 200 zurückgeschnitten
und dabei **genau eine** Zeile gelöscht: `0b4568f2` („steward-truth-Lane: drei Defekte im
Steward-Pfad fixen", `done`, angelegt 2026-07-28). Kein Ledger-Eintrag, kein Zähler, keine Meldung —
ich habe es nur gesehen, weil ich vorher nachgesehen hatte, welche Zeile als nächste fällt.

### B6 — Der Owner schreibt jeden dritten Brief selbst neu. Das ist eine Messung über den Kompiler.

`Task.brief.model` über 128 Briefs: **`claude-sonnet-5[1m]` 84 · `owner` 44** (`model: "owner"` wird
nur von der Edit-Route gesetzt, `13981`, zusammen mit `edited: true`). **34 % Übersteuerungsquote.**

Das ist kein Defekt und keine Empfehlung — es ist die Zahl, die man haben muss, bevor man
entscheidet, ob der Brief-Kompiler auf die Interaktiv-Stufe gehört (wie `analysis` und `refine`) oder
ob der Owner die Station lieber ganz selbst besetzt. Heute läuft er auf `SUMMARY_MODEL`.

## 7. Was das für „ein Team gibt Arbeit an die Main-Session" heißt

Die Kette, die ein Team bräuchte, ist **vollständig gebaut** — und drei ihrer sechs Stationen sind
aus oder leer:

| Station | Für ein Team | Zustand |
|---|---|---|
| (1) Einreichen | `POST /api/intake` mit `x-fleet-intake`-Secret | **AUS** (B4) |
| (2) Kompilieren | Brief aus Rohtext | **läuft nie** (B1) |
| (3) Prüfen | `ready`/`needs-you` + Kollisionen | **läuft nie** (B1) |
| (4) Freigeben | Owner-Klick | funktioniert, 47× benutzt |
| (5) Wählen | Deckel 2/Repo, Gates | Gates leer (B1) |
| (6) Übergeben | Rohtext in die Lane | funktioniert |

**Die Reihenfolge zum Einschalten ist damit nicht (1), sondern (2)+(3).** Ein Team-Eingang ohne
Kompilierung und Prüfung ist ein Kanal, der fremden Rohtext in einen Auftrag verwandelt, den
niemand gelesen hat — und die Owner-Freigabe wäre dann der einzige Filter für eine Textmenge, die
genau deshalb existiert, damit der Owner sie nicht alle lesen muss.

## 8. Die Changes aus Teil 2

Drei Entwürfe (`pending`, nicht freigegeben), je mit hartem Done-Kriterium und Verify-Weg:

| Zeile | Change | Größe | Befund |
|---|---|---|---|
| **`391a6cab`** | `reanalyse` verweigert mit 409, solange kein Analyst konfiguriert ist | klein | B2 |
| **`684a9d99`** | `▸ queue` sagt VOR der Freigabe, dass diese Zeile ungelesen und ohne Brief in eine Lane geht (Weg b von dreien — Owner-Entscheid) | Entscheidung, dann klein | B1 |
| **`6d07877f`** | `files` ohne Umweg über `refine` setzbar; leere Spalte als leer kenntlich | mittel | B3 |

**B4** (Intake) und **B6** (34 % Brief-Übersteuerung) haben bewusst **keine** Zeile bekommen: das
eine ist eine Entscheidung des Owners über ein Team, das es noch nicht gibt; das andere ist eine
Zahl, keine Arbeit. **B5** (der Deckel) auch nicht — solange die Räumung nur terminale Zeilen trifft,
ist der ehrliche nächste Schritt, sie sichtbar zu machen, und das gehört in dieselbe Zeile wie eine
Entscheidung über das Register, die heute niemand gefällt hat.

## 9. Was ich gemessen und was ich nur gelesen habe

**GEMESSEN:** `fleet.json` (198 Zeilen, alle Achsen-Histogramme, Brief-/Analyse-Modelle,
`releasedBy`, `files`, `criterion`, `comments`) · `GET /api/sessions` mit Owner-Token
(`intake:false`, `dispatch.on:true`, `maxLanes:2`) · `audit.jsonl` (`task_refine_confirm` = 2) ·
`grep` über `watchdog.sh` und `.env` für `FLEET_INTAKE_SECRET` (0 Treffer) · `server.ts` gelesen:
`interface Task` (1071-1145), `capTasks`/`releaseTask` (1376-1402), `dispatchTask`/`briefAndSend`
(3706-3870), `tickAnalysisSweep`-Kompilierteil (4008-4056), `tickDispatch` (4227-4320),
`runWorker`+`WorkerSpec` (5150-5240), die Tool-Profile (5092, 6728, 6738), alle zehn
`runWorker`-Aufrufstellen, die drei Einreich-Routen (9576-9612, 11790-11810, 13790-13812),
`reanalyse` (13878-13890), `refine-confirm` (13940-13965) · `src/protocol.ts` (WORKER_CONTRACTS).

**NUR GELESEN, nicht nachgemessen:**
- Dass `--setting-sources ""` die Anker bindet — das ist eine fremde Messung von 2026-07-25, im
  Kommentar zitiert; ich habe sie nicht wiederholt.
- Die 107 KB Task-Texte auf dem 2-s-Poll (Messung 2026-07-26, im Kommentar bei `taskDigest`).
- Ob der Analyst je an war und wann er ausgeschaltet wurde — ich habe nur den heutigen Zustand
  gemessen, nicht die Historie über `git log -S`.
- Ich habe **keinen Worker ausgeführt**, keine Route mit Nebenwirkung aufgerufen (nur `GET`), und
  weder `reanalyse` noch `refine` an einer echten Zeile probiert — B2 ist am Code belegt, nicht am
  Klick.

**NICHT GETAN, mit Absicht:** keine Suite (ein Suite-Mutex, die andere Main-Session arbeitet), kein
Merge/Land, kein Env geändert, kein Deploy.

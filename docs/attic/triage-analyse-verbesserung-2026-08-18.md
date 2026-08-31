# Die Triage/Analyse-Schicht des Arbeitskreises — was sie kostete, was sie wert war, und was sie besser machen würde

**Lies dies als:** die Vertiefung zu Zeile **B** aus `docs/arbeitskreis-prozesse-2026-08-18.md` §3/§4
(„Triage/Analyse — bester Kandidat"). Jene Analyse hat den Unterprozess als besten Markt- und
Verbesserungskandidaten gerankt; diese hier fragt die vier operativen Anschlussfragen: **wieder
einschalten?** · **wie ex-post scoren?** · **welcher Zusatzkontext, über welchen Träger?** · **kann
ein Marktagent das füllen?** Owner-Auftrag 2026-08-18. **PROPOSE only** — dieses Dokument ändert
keinen Code, kein Env, keine Queue-Zeile.

**Haltbarkeit und Anker.** Zeilennummern gelten gegen **`46b7478`**, den Tip der Basis dieser Lane.
Zeilenanker altern am schnellsten, Vertragsbeschreibungen am langsamsten — wo eine Zeile gewandert
ist, das benannte Symbol suchen; **wo eine Aussage hier dem Code widerspricht, gilt der Code.**

**Methode.** Drei Labels, nie verwischt:

- **BUILT** — der benannte Pfad existiert und ich habe ihn in dieser Sitzung gelesen.
- **NOT BUILT** — ich habe danach gesucht und er fehlt; die Suche ist benannt, damit sie
  wiederholbar ist.
- **INFERRED** — meine Folgerung aus dem Gelesenen, nicht etwas, das der Code sagt.

Ich habe keine Pane gelesen, keine Suite über den doc-proportionalen lokalen Beweis hinaus
gefahren, keine Zahl aus einem Ledger neu gemessen (die Ledger sind gitignored und existieren in
einer Lane nicht — jede Ledger-Zahl unten ist **zitiert** aus dem Prozess-Dokument oder aus dem
Body des Abschalt-Commits, mit Quelle). §7 nennt, was ich **nicht** geprüft habe.

---

## 1. Was seit der Abschaltung passiert ist — die drei Fakten, die die Frage neu stellen

Der Sweep wurde am **2026-08-08** abgeschaltet: `ec91075`, „fix(quota): der Queue-Analyst wird
abgeschaltet — 445 Laeufe in 48 h fuer Urteile, auf die nichts gated". Der Commit-Body ist die
einzige Messung, die es zu dieser Schicht gibt, und er nennt drei Zahlen, die man zitieren, nicht
erinnern soll (BUILT — `git log -1 ec91075`):

| Messung im Abschalt-Body | Wert |
|---|---|
| Worker-Transkripte 48 h, nach Contract-Mark klassifiziert | analysis **445** · enhance 122 · review 71 · digest 11 · refine 7 |
| Ursache im Code benannt | `analysisStale()` — jedes Land entwertet das Urteil JEDER offenen Zeile |
| Nachlese-Rate | ~10 Worker-Aufrufe pro Land-Welle bei ~59 offenen Zeilen |
| Preis, den der Owner ausdrücklich benannt hat | ein Durchgang durch alle **28 `needs-you`-Zeilen** ergab: **22 davon falsch** |

Diese letzte Zeile ist der wichtigste Satz des ganzen Vorgangs und wird in der Diskussion um
„einschalten ja/nein" regelmäßig übersehen: **der Analyst wurde nicht abgeschaltet, weil er zu teuer
für seine Güte war, sondern zu teuer bei nachgewiesen schlechter Güte.** 6 von 28 `needs-you` waren
haltbar; das ist eine Falsch-Alarm-Rate von ~79 % auf der einen Seite, die überhaupt Arbeit
verhindert. Ein reines Kostenargument („billigeres Modell, gleicher Sweep") adressiert die falsche
Hälfte.

**Was sich seither im Code geändert hat, und es ist genau eine Sache — aber eine große:**

- **BUILT, `c09e85c` (2026-08-13): Text-Worker laufen über Codex Spark.** `WORKER_ROUTES`
  (`server.ts:7444-7456`) routet `summary`, `commitMsg`, `enhance`, `digest` per
  `codexSparkRoute(...)` (`server.ts:7441`) auf `CODEX_SPARK_MODEL = "gpt-5.3-codex-spark"`
  (`server.ts:7438`), jeweils mit einem eigenen Rollback-Key (`FLEET_WORKER_ROUTE_*`). Die Absenz
  eines Keys fällt **zum billigeren Default**; nur das literale `"claude"` autorisiert
  Claude-Spend.
- **`analysis` ist NICHT migriert** (`server.ts:7455`: `analysis: { route: "claude" }`) — und trägt
  als eine von fünf Einträgen **keinen Env-Rollback-Key**. `refine` ebenso (`:7454`).
- **Der Analyst läuft zusätzlich auf dem teuersten Tier**, per Owner-Entscheid: `ANALYSIS_MODEL`
  default `claude-opus-5` (`server.ts:6023-6024`, Kommentar: „the interactive tier … the one worker
  whose reading the owner delegates his own critical look to").

**INFERRED:** die 445 Läufe von 2026-08-08 waren 445 **Opus-Sitzungen**, und der Anteil davon, den
die Brief-Kompilierung ausmachte (enhance, 122), ist heute schon nicht mehr auf demselben Tier.
Die Kostenrechnung von damals ist damit nicht mehr die von heute — **aber nur auf der
Kompilier-Seite; die Urteils-Seite ist unverändert teuer.**

**Der zweite unveränderte Teil, und er ist der eigentliche Kostentreiber:**
`analysisStale` (`server.ts:2236-2243`) ist eine **Gleichheitsprüfung auf den Integrations-Tip**:

```
if (a.briefAt !== (t.brief?.at ?? null)) return true;
if (!a.head) return false;
return tip !== undefined && tip !== a.head;
```

Es gibt **keinen Bezug zur Oberfläche** der Zeile. Ein Land, das `docs/*.md` bewegt, entwertet damit
das Urteil über eine Zeile, die ausschließlich `src/client.ts` betrifft — mechanisch, ohne dass
irgendetwas an dem Urteil unwahr geworden wäre. Bei 66 offenen Zeilen und `ANALYSIS_BATCH_CAP = 6`
(`server.ts:6034`), einem Batch pro Tick (`server.ts:6127`), sind das **11 Worker-Aufrufe und ~11
Minuten je Land**, unabhängig davon, was das Land berührt hat.

---

## 2. Frage 1 — soll der Sweep wieder an, und wie?

**Empfehlung, in einem Satz: JA, aber nicht als Wiedereinschalten der abgeschalteten Fassung —
sondern erst nach zwei Schnitten, von denen einer den Preis und einer die Güte adressiert; und der
Reihenfolge nach ist der Güte-Schnitt der erste.**

### 2.1 Was ein Wiedereinschalten heute genau kosten würde (gerechnet, nicht gemessen)

INFERRED, aus den Konstanten:

| Größe | Wert | Quelle |
|---|---|---|
| offene `auftrag`-Zeilen | 66 | `docs/arbeitskreis-prozesse-2026-08-18.md` §1 (zitiert) |
| Urteile je Worker-Aufruf | ≤ 6 | `ANALYSIS_BATCH_CAP`, `server.ts:6034` |
| Aufrufe für eine volle Nachlese | ⌈66/6⌉ = **11** | `server.ts:6127` |
| Takt | 1 Batch / 60 s | `ANALYSIS_TICK_MS` default, `server.ts:6026` |
| Dauer einer vollen Nachlese | **~11 min** | INFERRED aus beiden |
| Auslöser einer vollen Nachlese | **jedes Land**, unabhängig von der Fläche | `analysisStale`, `server.ts:2236-2243` |
| Zusätzlich einmalig | bis 29 `enhance`-Aufrufe für fehlende Briefs, 3 parallel | `ANALYSIS_ENHANCE_LIMIT`, `server.ts:6037,6142` |
| Modell des Urteils | `claude-opus-5` | `server.ts:6023-6024` |
| Timeout je Aufruf | 420 s | `ANALYSIS_TIMEOUT_MS`, `server.ts:6033` |

**Was NICHT messbar ist, und das ist selbst ein Befund:** es gibt **kein Ledger für Worker-Läufe**.
`WorkerRunObservation` (`server.ts:7433-7437`) trägt `model`, `backend` und `usage`, aber
`spec.observe?` wird laut seinem eigenen Kommentar (`server.ts:7429`) „only summary" verdrahtet.
**NOT BUILT** (Suche: `rg -n 'WorkerRunObservation|worker-runs|WORKER_RUN' server.ts` → 4 Treffer,
alle Typ-/Deklarationsstellen, kein `appendEvent`). Konsequenz: **„Kosten pro Urteil" ist heute
strukturell nicht beantwortbar** — die 445 von 2026-08-08 wurden aus
`~/.claude/projects/*claude-fleet*/`-Transkripten nachgezählt, also aus einer Quelle, die es für
einen Codex-Spark-Worker gar nicht gibt. Wer den Analysten wieder einschaltet, ohne das zu
schließen, schaltet ihn erneut blind ein.

### 2.2 Schnitt 1 (Güte) — die 22-von-28-Zahl ist ein Kontext-Defekt, kein Modell-Defekt

**INFERRED, und dies ist die zentrale Behauptung dieses Dokuments.** Die drei `needs-you`-Blocker
sind `attribution`, `reach`, `criterion` (`analysis-prompt.ts:60`), und der Prompt verlangt
ausdrücklich: „Anything you could not verify is `needs-you`, never a pass"
(`analysis-prompt.ts:75`). Ein Analyst, der die Oberfläche einer Zeile nicht **sehen** kann, muss
also per Vertrag `attribution` melden. Und genau das ist die Lage:

- Der Sweep füttert dem Prompt `files: t.files ?? null` (`server.ts:6184`) — mit dem im Code
  benannten Grund, dass nur die **owner-bestätigte** `refine-confirm`-Fläche stark genug sei und
  eine text-abgeleitete Fläche in derselben Form „silently relabel them as confirmed" würde.
- `t.files` entsteht heute **nur** über ↻ refine. Das Prozess-Dokument zählt die Population:
  „nur 3 done-Zeilen tragen `criterion`" (§3 Zeile D) — die `files`-Population ist von derselben
  Größenordnung.
- Gleichzeitig **existiert eine mechanische Flächen-Ableitung und läuft bereits**: `taskView`
  (`server.ts:2286-2297`) ruft `deriveTaskMetadata` mit `trackedPaths` aus einem
  index-stamp-gecachten `git ls-files`-Snapshot und liefert `files` + **`filesOrigin`
  (`"confirmed" | "derived"`)** + `cluster` (`task-metadata.ts:21-24,124-132`). `register.sh:126`
  konsumiert genau das und rendert die drei Wahrheitswerte getrennt
  (`[bestätigt/mechanisch]` · `[abgeleitet]` · `UNBEKANNT`, `register.sh:178-185`).

**Also: der Server berechnet für jede Zeile eine deterministische Oberfläche mit Provenienz, zeigt
sie dem Client und dem Register — und verschweigt sie ausgerechnet dem Worker, dessen Urteil daran
hängt.** Der im Code genannte Grund („würde als confirmed gelabelt") ist eine Eigenschaft des
**Prompt-Formats**, nicht der Daten: `AnalysisTask.files` (`analysis-prompt.ts:36-42`) hat kein
Provenienz-Feld, und die Lane-Seite desselben Prompts hat längst gelernt, wie man das löst — dort
ist `files` **dreiwertig** mit ausgeschriebener Semantik je Zustand (`analysis-prompt.ts:45-57`,
gerendert bei `:94-98`: „files: unknown — could not be read" vs. „files: none — holds nothing,
cannot collide").

> **VORSCHLAG 1 (kleinster Schnitt, Güte).** `AnalysisTask.files` bekommt dieselbe Dreiwertigkeit
> wie `AnalysisLane.files`: `{ paths, origin: "confirmed" | "derived" }` bzw. `null`, und der
> Prompt schreibt aus, was jede Provenienz bedeutet — bestätigt = Evidenz, abgeleitet =
> deterministisch aber schwächer, absent = UNBEKANNT und nie „berührt nichts". Gefüttert wird aus
> derselben `deriveTaskMetadata`-Projektion, die `taskView` schon fährt. Kein neuer Datenpfad, kein
> neuer Speicher, ein zusätzliches Feld auf einer reinen Funktion.
> **Erwartete Wirkung (INFERRED, und sie ist prüfbar, nicht behauptet):** der `attribution`-Blocker
> ist der einzige der drei, der aus Blindheit statt aus einem Sachverhalt entstehen kann; wenn die
> 22 falschen `needs-you` überwiegend `attribution` trugen, fällt die Falsch-Alarm-Rate. **Wenn
> nicht, ist Vorschlag 1 wertlos** — und genau deshalb steht Frage 2 (Scoring) VOR dem
> Wiedereinschalten, nicht danach.

### 2.3 Schnitt 2 (Preis) — Staleness an die Fläche binden, nicht an den Tip

**BUILT auf beiden Seiten der Naht, nur nicht verbunden:** `analysisStale` kennt nur
Tip-Gleichheit (`server.ts:2240-2242`). Was ein Land berührt hat, ist dagegen server-seitig
vollständig bekannt — `LaneOutcome.filesTouched` + `mainAfter` (`server.ts:10008-10071`), und der
Post-Land-Audit hängt ohnehin am Land-Pfad.

> **VORSCHLAG 2 (Preis).** Ein Urteil wird nur dann stale, wenn (a) der Brief sich geändert hat
> (unverändert) **oder** (b) der Tip sich bewegt hat **und** die Schnittmenge aus der bewegten
> Fläche und der Zeilen-Oberfläche nicht leer ist **oder** (c) die Zeilen-Oberfläche UNBEKANNT ist
> — Absenz eines Wissens fällt konservativ auf „stale", nie auf „frisch".
> **Erwartete Wirkung (INFERRED):** die volle 11-Aufruf-Nachlese je Land schrumpft auf die Zeilen,
> die das Land wirklich betrifft. Das Prozess-Dokument liefert die Plausibilität: `register.sh`
> nennt `server.ts` als von „most rows" benannte Datei und markiert das ausdrücklich als *schwache*
> Evidenz (`register.sh:241`) — ein `server.ts`-Land würde also weiterhin viel entwerten, ein
> `docs/`-Land fast nichts. **Ehrlich benannt: der Gewinn ist verteilungsabhängig und könnte klein
> sein**, weil dieses Repo `server.ts`-lastig landet.

**GELANDET 2026-08-18 (P5).** Die Regel liegt jetzt rein in `analysis-staleness.ts` und hat vier
Arme statt drei: (a) Brief · (b) Schnittmenge · (c) Zeilen-Oberfläche unbekannt · (c′) **bewegte
Fläche unbekannt** — der vierte fehlte im Vorschlag und ist nicht optional, sonst liest sich ein
gescheiterter git-Aufruf als „nichts bewegt". Der Mechanismus ist **nicht** der oben genannte
`LaneOutcome.filesTouched`-Join, sondern `git diff --name-only --no-renames <head> <tip>`, gecacht
pro `(repo, head, tip)`: ein Direkt-Commit im Haupt-Checkout ist für JEDES land-seitige Ledger
unsichtbar (kein `fleet/land`-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit — gemessen
2026-08-07 an `0e2a672`/`4955444`), ein Ledger-Join hätte also ausgerechnet für die
unbeaufsichtigten Commits „nichts bewegt" gemeldet. Die Zeilenangaben oben
(`server.ts:2236-2243`, `:2240-2242`) sind damit historisch; Vertrag und Begründung:
`docs/queue-analyst.md` §3b. `register.sh` rendert dieselbe Regel, damit „stale" nicht zwei
Bedeutungen bekommt.

### 2.4 Modell/Route und Takt — die billigen Stellschrauben, und warum sie zuletzt kommen

- **Route.** `analysis` auf `codexSparkRoute(process.env.FLEET_WORKER_ROUTE_ANALYSIS)` zu setzen
  wäre eine Zeile in `WORKER_ROUTES` (`server.ts:7455`) und folgte exakt dem schon gebauten
  Muster inklusive Rollback-Key. **Ich empfehle es NICHT als ersten Zug**, und der Grund steht im
  Code: der Analyst ist der Worker, dem der Owner „his own critical look" delegiert
  (`server.ts:6023-6024`), und seine gemessene Güte war bereits auf Opus schlecht. Ein
  Modellwechsel auf einer ungemessenen Schicht tauscht ein bekanntes Problem gegen ein unbekanntes.
  **Reihenfolge: erst Scoring (§3), dann Kontext (Vorschlag 1), dann Spark als A/B gegen die dann
  existierende Kennzahl.**
- **Takt.** `ANALYSIS_TICK_MS` ist der falsche Knopf und war es immer: er bestimmt, wie schnell
  eine Nachlese abgearbeitet wird, nicht wie viel Nachlese entsteht. Die Menge entsteht in
  `analysisDue`/`analysisStale`. Ein größerer Takt (z. B. 300 s) verlängert nur das Fenster, in dem
  eine freigegebene Zeile am Dispatcher-Gate wartet (`server.ts:6401-6411`).
- **`ANALYSIS_BATCH_CAP`** von 6 auf 10–12 zu heben ist der einzige Knopf, der die Aufrufzahl
  linear senkt, ohne die Semantik zu ändern — Preis: ein Batch-Fehlschlag trifft mehr Zeilen auf
  einmal (`unknown()`, `server.ts:6130-6133`), und der Prompt wird länger. **Nicht empfohlen ohne
  Vorschlag 2**, weil er das Symptom skaliert statt der Ursache.

### 2.5 Der Zustand, in dem die Schicht heute steckt — und ein Nebenbefund

`ANALYSIS_ON` (`server.ts:6029`) ist ein einziger Laufzeit-Fakt, und er hängt allein am Takt.
`FLEET_ANALYSIS_MS=0` steht in `watchdog.sh:148`. Konsequenzen, alle BUILT:

1. Der Tick wird gar nicht erst registriert (`server.ts:13682`, `if (ANALYSIS_ON) setInterval(...)`).
2. Das Dispatcher-Gate hebt sich selbst auf (`server.ts:6398-6411`): „No reader configured, no read
   required" — Invariante 3 aus `docs/queue-analyst.md` §4 ist also derzeit **nicht in Kraft**,
   und der Kollisions-Check (Invariante 6) ebenfalls nicht.
3. **Nebenbefund, operativ relevant:** `POST /api/tasks/:id/reanalyse` antwortet bei `!ANALYSIS_ON`
   mit **409** (`server.ts:17656-17657`), mit korrekter Begründung („reanalysis would otherwise only
   delete the existing analysis and machine-generated brief"). Das heißt: **es gibt derzeit keinen
   Weg, ein einzelnes stales Urteil aufzufrischen** — auch keinen Hand-Weg. Das Register kann `!head`
   also nur anzeigen, nie auflösen. Wer aus dem gegenwärtigen Zustand heraus eine einzelne Zeile
   beurteilen will, tut es selbst; die Maschine bietet dafür nichts an.

---

## 3. Frage 2 — wie das Urteil EX-POST gescort werden kann

**Die Kurzfassung: die Hälfte des Joins ist gebaut, die andere Hälfte fehlt, und die fehlende ist
die interessantere.**

### 3.1 Was heute joinbar ist (BUILT)

| Rail | Datei | Schlüsselfelder | Was es beantwortet |
|---|---|---|---|
| Lane-Outcome | `lane-outcomes.jsonl` (`server.ts:81`) | `taskId?` · `briefHash` · `disposition` · `commitCount` · `ownerPrompts` · `sessionMs` · `verified` · `repo`/`mainAfter` (`server.ts:10008-10071`) | wie eine Lane endete |
| Audit | `audit.jsonl` | Event `task_override`, Detail `"<taskId>:<verdict>"` (`server.ts:17874`) | wann der Owner ein `needs-you` überstimmt hat |
| Context-Receipt | `context-receipts.jsonl` (`server.ts:84`) | `taskId` · `branch` · `slot` · `hash` · `head` · `harness`/`model`/`effort` (`server.ts:5950-5962`) | welche Bytes eine Lane wirklich bekam |
| Disposition | `dispositions.jsonl` (`server.ts:87`) | `worker ∈ {land, review3, enhance, analysis}` (seit P8 — `analysis` mit der `taskId` als `ref`) · `disposition ∈ {accepted, edited, ignored, wrong}` (`src/protocol.ts:49-52`) | wie der Owner einen Worker-Output beurteilte |

**Der eine Join, der HEUTE einen echten Score liefert** (INFERRED, aber vollständig aus obigen
Feldern konstruierbar — der Host müsste ihn fahren, nicht diese Lane):

```
audit.jsonl   : event == "task_override", detail.split(":") -> (taskId, "needs-you"), ts
lane-outcomes : taskId == taskId, disposition, commitCount, ownerPrompts
```

Ergebnis: **die Falsch-Positiv-Rate des Analysten auf genau den Zeilen, wo er gebremst hat und der
Owner trotzdem startete.** Ein `landed` mit wenigen `ownerPrompts` nach einem überstimmten
`needs-you` ist ein Falsch-Alarm; ein `killed-empty` bestätigt den Analysten. Das ist genau die
Zahl, die im Abschalt-Body als „22 von 28 falsch" von Hand ermittelt wurde — sie ist heute
**mechanisch** ableitbar, für den Zeitraum, in dem der Sweep lief.

### 3.2 Was fehlt — und warum das Ledger die Frage sonst nicht beantworten kann

- **NOT BUILT: es gibt kein Verdikt-Ledger.** `Task.analysis` (`server.ts:1607-1610`) lebt
  ausschließlich im mutablen `fleet.json`. Kein `appendEvent` schreibt jemals ein Urteil
  (Suche: `rg -n "audit\(.*task" server.ts` → sechs Events, darunter `task_override`, aber
  **kein `task_analysis`**). Ein `ready`-Urteil hinterlässt damit **null Spur**: es wird beim
  nächsten Sweep überschrieben, beim Wechsel auf `done` bedeutungslos und bei
  `capTasks`/`MAX_TASKS = 200` (`server.ts:2129-2140`) samt Zeile evakuiert. **Ein Score kann heute
  nur die überstimmte Minderheit sehen, nie die zustimmende Mehrheit** — also strukturell nur die
  eine Fehlerrichtung.
- **Der `briefHash`-Join ist für alles nach ContextPlan kaputt, und der Code sagt es selbst.**
  `briefHash` ist der Hash des **ersten geloggten Prompts** einer Lane
  (`laneOwnerPrompts`, `server.ts:10121-10143`, `briefHashOf`, `:10171`). Ausgeliefert wird aber
  `deliveredBrief = brief + anchorBlock` (`server.ts:5934-5936`), also der Brief **plus** dem frisch
  abgeleiteten ContextPlan-Ankerblock. `Task.brief.text` trägt diesen Block nicht — der Kommentar
  bei `dossierTaskFor` (`server.ts:10490-10495`) benennt es ausdrücklich: der `briefHash`-Fallback
  vergleicht „against the historical **pre-ContextPlan** shapes". **Für den Scoring-Join heißt das:
  `taskId` ist der Schlüssel, `briefHash` ist es nicht mehr** — und das Prozess-Dokument, das K4 auf
  „`briefHash`-Join!" stützt (§2), stützt sich auf eine Naht, die seit `4f55b48`/ContextPlan nur noch
  für Altzeilen trägt. Wer die Brief-Identität braucht, nimmt **`context-receipts.jsonl`**: dort
  steht `hash` über den *gelieferten* Bytes zusammen mit `taskId` und `branch` (`server.ts:5950-5962`).
- **`disposition` ist überladen.** Das Wort bezeichnet zwei verschiedene Dinge:
  `LaneOutcome.disposition` (`landed|reverted|shelved|killed-dirty|killed-empty`,
  `server.ts:9976`) und `DispositionVerdict` (`accepted|edited|ignored|wrong`,
  `src/protocol.ts:50`). Ein Brief, der „Felder: taskId, briefHash, disposition" sagt, meint das
  erste; ein Join-Skript, das das zweite liest, misst etwas anderes und merkt es nicht.

### 3.3 Die zwei Vorschläge, kleinster Schnitt zuerst

> **VORSCHLAG 3 (objektiv, maschinell).** Ein append-only `analysis-verdicts.jsonl` neben den
> vorhandenen Ledgern (`server.ts:81-87` ist die Reihe, in die es gehört). Eine Zeile je
> geschriebenem Urteil, an der Stelle, an der `t.analysis` gesetzt wird
> (`server.ts:6217-6226`): `{at, taskId, originId?, verdict, blockers, collides, head, briefAt,
> model, route, attempts}`. Damit wird die Zeitreihe der Urteile unabhängig vom Queue-Zustand
> haltbar, und der Score ist ein reiner `taskId`-Join gegen `lane-outcomes.jsonl` **in beide
> Richtungen** — nicht nur auf der Override-Hälfte.
> Zwei Eigenschaften, die dabei nicht verhandelbar sind: `unknown` gehört mitgeschrieben (sonst
> liest sich eine Messlücke als Enthaltung), und die Zeile darf **nichts** enthalten, was der
> Server nicht selbst gestempelt hat — dieselbe Choke-Point-Haltung wie `audit`/`lane-outcomes`
> (`server.ts:9969-9971`).

> **VORSCHLAG 4 (subjektiv, Owner).** `DISPOSITION_WORKERS` (`src/protocol.ts:51`) um `"analysis"`
> erweitern. Die vier Verdikte `accepted|edited|ignored|wrong` passen ohne Anpassung auf die Frage
> „war dieses Urteil brauchbar", `ref` ist die `taskId`. Kosten: ein Listeneintrag plus die
> Client-Aufrufstelle; der Typ macht laut Kommentar (`src/protocol.ts:47-48`) einen Tippfehler zum
> Compile-Fehler. **Wert:** die Owner-Sicht kommt an Fälle heran, die kein Outcome-Join sieht — ein
> `needs-you`, das der Owner *akzeptiert* und daraufhin die Zeile umgeschrieben hat, produziert nie
> eine Lane und ist im Outcome-Ledger für immer unsichtbar, obwohl es der **wertvollste** Treffer
> des Analysten ist.

**Die Joins, die der HOST fahren müsste** (nicht diese Lane — die Ledger sind gitignored und
existieren hier nicht; Formulierung als Rezept, nicht als Ergebnis):

1. **Override-Präzision, heute schon möglich:** `audit.jsonl[event=task_override]` → `taskId` →
   `lane-outcomes.jsonl[taskId]`. Kennzahl: Anteil `landed` unter den überstimmten `needs-you`.
   Vorsicht: nur Zeiträume mit `ANALYSIS_ON` zählen, sonst misst man eine leere Menge als 0 %.
2. **Voller Score, nach Vorschlag 3:** `analysis-verdicts.jsonl` → `taskId` →
   `lane-outcomes.jsonl`. Vier Felder: Verdict × Disposition. `ready` → `killed-empty` ist der
   Falsch-Negativ (der teure Fall: 29 % Leer-Quote, 63 h, §1 des Prozess-Dokuments), `needs-you` →
   `landed` der Falsch-Positiv.
3. **Brief-Identität, wo sie gebraucht wird:** `context-receipts.jsonl[taskId].hash` statt
   `lane-outcomes.briefHash`. Der Receipt trägt zusätzlich `harness`/`model`/`effort`, also die
   Entanglement-Achse, vor der `server.ts:9973-9974` ausdrücklich warnt („never attribute an
   outcome to the model alone").
4. **Abdeckungs-Ehrlichkeit, in jedem der drei:** `taskId` ist auf `LaneOutcome` **optional**
   (`server.ts:10019-10021`) — das Prozess-Dokument misst 38/213 bei `landed` und 5/93 bei
   `killed-empty`. Jede Rate über diesen Join hat einen **Nenner, der nicht die Grundgesamtheit
   ist**, und muss so ausgewiesen werden. Ein `killed-empty` ohne `taskId` ist meist ein
   hand-geöffneter Slot, kein Dispatcher-Ausstoß — die naive Rate überschätzt das Analyse-Versagen.

---

## 4. Frage 3 — welcher Zusatzkontext, und über welchen Träger

### 4.1 Was der Analyst heute sieht (BUILT, vollständig aus `analysis-prompt.ts`)

| Block | Inhalt | Stärke |
|---|---|---|
| `DRAFT` | der rohe Text des Owners | vollständig |
| `BRIEF` | die kompilierten Bytes, oder Absenz mit ausgeschriebener Bedeutung | vollständig |
| `files` je Task | **nur** owner-bestätigte refine-Pfade, sonst gar nichts (`server.ts:6184`) | fast immer leer |
| `LANES` | offene Lanes mit dreiwertiger In-Flight-Fläche (`server.ts:6169-6172`, `laneSurfaces` `:10958`) | stark, seit 2026-08-07 |
| Repo-Zugriff | `REVIEW_TOOLS`, cwd = Repo — er darf lesen, und der Prompt verlangt es | stark, aber ungeführt |

### 4.2 Die vier Kandidaten, gerankt

1. **Die eigene Oberfläche mit Provenienz** — Vorschlag 1 oben. Rang 1, weil er die
   Blocker-Semantik direkt trifft, aus einer **schon laufenden deterministischen Projektion**
   stammt (`deriveTaskMetadata`), nichts speichert und nichts kostet. Alles andere unten ist
   teurer und spekulativer.
2. **Kollisionshistorie statt Kollisions-Momentaufnahme.** Heute sieht der Analyst nur, was
   **jetzt** offen ist (`laneSurfaces`). Was er nicht sieht: welche Dateien in den letzten N Lands
   tatsächlich zusammen bewegt wurden — das steht in `LaneOutcome.filesTouched`
   (`server.ts:10035-10038`) und ist eine echte Ko-Änderungs-Statistik. **INFERRED:** eine
   „diese zwei Pfade wandern erfahrungsgemäß zusammen"-Zeile ist besser als eine geratene Kollision,
   und `register.sh:241` zeigt, warum eine reine Namens-Schnittmenge schwach ist. **Kosten:** ein
   Ledger-Read pro Sweep, kein Modellaufruf. Rang 2.
3. **Ledger-Priors auf die Zeile selbst.** Nach Vorschlag 3 wäre bekannt, wie oft eine Zeile schon
   beurteilt wurde und was daraus wurde. Rang 3 — **nur nach** 3, sonst gibt es die Daten nicht.
4. **Oberflächen-Karten (graphify-Ebene).** `graphify-out/` ist gitignored und existiert in keiner
   Lane (`CLAUDE.md`, Abschnitt graphify) — für einen **Worker** gilt das nicht, er läuft mit
   `cwd = repo` im Haupt-Checkout, könnte also lesen. **Ich empfehle es nicht:** es ist ein
   ungetrackter, alternder Nebenspeicher, und `ast-grep` deckt die strukturelle Frage im Prompt ab,
   ohne einen zweiten Wissensspeicher einzuführen. Rang 4, **unter der Schnittlinie.**

### 4.3 Der Träger — und warum `context-packs` es heute NICHT ist

**BUILT:** der Träger existiert und ist gut gebaut. `CONTEXT_PACKS` sind Zeiger auf Quellen, nie
ein zweiter Wissensspeicher (`context-packs.ts:1-2`); ein Ziel-Repo darf eigene Packs in einem
getrackten `.fleet/context-packs.json` deklarieren (`context-manifest.ts:1-6,14`), gelesen **am
Commit, den der Receipt behauptet**, validiert durch denselben reinen Validator, geplant durch
dieselbe Auslassungsleiter (`planRepoContext`).

**NOT BUILT, und das ist der entscheidende Punkt:** `planContext` wird an **vier** Stellen gerufen —
`server.ts:5932` (Lane-Dispatch), `:12104`, `:12259`, `:12373` (Program-MAIN-Routen). **Keine davon
ist ein Worker-Prompt.** Suche: `rg -n 'planContext\(' server.ts` → genau diese vier. Der Träger ist
also ausschließlich für **Sitzungs-Gründungsbriefe** verdrahtet; `runWorker` (`server.ts:7459`) kennt
weder Plan noch Receipt.

Daraus folgt eine saubere Zuordnung, und sie ist wichtiger als die Wahl selbst:

- **Für Vorschlag 1–3 ist `context-packs` der falsche Träger.** Was der Analyst braucht, sind
  **task-spezifische Fakten** (die Oberfläche *dieser* Zeile, die Historie *dieser* Pfade). Ein
  Pack ist per Konstruktion ein *repo-weiter, statischer Zeiger auf eine Quelle mit Anker* — es
  kann nicht pro Zeile variieren, ohne seine eigene Semantik zu brechen. Diese Fakten gehören in
  den **Prompt-Builder**, wo die Lane-Fakten schon stehen: `buildAnalysisPrompt` ist genau der
  richtige Ort, weil er eine reine Funktion ist und `e2e/tasks.ts` seinen Informationsgehalt
  deterministisch prüfen kann (`analysis-prompt.ts:1-5`).
- **Wofür `context-packs` der richtige Träger WÄRE:** die stehenden Doktrin-Anker, die ein Analyst
  braucht, um `reach` und `criterion` überhaupt zu beurteilen — „was heißt in Reichweite",
  „was ist ein hartes Done-Kriterium". Das sind repo-weite Quellen mit Ankern, also exakt die
  Pack-Form; ein `scope: "task-queue"`-Pack existiert bereits (`context-packs.ts:138`), mit
  Trigger `task-queue` in der geschlossenen Vokabel (`:16-18`).
  **Der Schnitt dafür ist aber nicht klein:** `runWorker` müsste einen Plan annehmen, und die
  Receipt-Frage („was hat dieser Worker bekommen") ist dann eine neue. Das ist ein eigenes
  Vorhaben, kein Zusatz zu diesem — **unter der Schnittlinie**, benannt statt verschwiegen.

---

## 5. Frage 4 — kann ein externer Marktagent (Auftragsmarkt) diese Schicht füllen?

Geprüft gegen K1–K4 aus `docs/arbeitskreis-prozesse-2026-08-18.md` §2.

| Kriterium | Befund für die Triage/Analyse-Schicht | Beleg |
|---|---|---|
| **K1 Vertrag vollständig geschrieben** | **erfüllt, und zwar besser als bei jedem anderen Unterprozess.** Input, Ausgabeschema und Verbote stehen als reine Funktion im Repo; die Antwortform ist striktes JSON mit geschlossener Blocker-Menge, die der Server nachklemmt | `analysis-prompt.ts:64-131`, `ANALYSIS_BLOCKERS` `:60`, Klemmung `server.ts:6205-6212` |
| **K2 Verifikation, die dem Produzenten nicht traut** | **teilweise.** Es gibt eine harte Form-Abnahme (JSON, Ids nur aus TASK-Zeilen, Blocker geklemmt, fehlender Eintrag = `analysisFailed` statt Nachsicht — `server.ts:6222-6226`), aber **keine inhaltliche.** Die inhaltliche Abnahme ist genau das, was §3 erst baut | `server.ts:6194-6226` |
| **K3 Vertrauensfläche begrenzt** | **NICHT erfüllt in der heutigen Form.** Der Analyst läuft mit `REVIEW_TOOLS` und `cwd = repo` im **Haupt-Checkout** (`runWorker(..., repo)`, `server.ts:6177`), nicht in einem Worktree — er liest also den ganzen Baum inklusive der ungetrackten `CLAUDE.md` und `fleet.json`, wenn er will. Lese-Reichweite = Provider-Reichweite | `server.ts:6177`, `CLAUDE.md` (Codex-Sandbox-Absatz) |
| **K4 Outcome ex-post messbar** | **halb**, siehe §3.2: heute nur die Override-Hälfte, und der im Prozess-Dokument genannte `briefHash`-Join trägt nach ContextPlan nicht mehr | `server.ts:10490-10495` |

**Urteil: die Schicht ist markt-fähig in ihrer STRUKTUR (K1 vorbildlich, K2 halb, propose-only per
Konstruktion — das Urteil gated nichts, `docs/queue-analyst.md` §6), aber sie ist HEUTE nicht
markt-reif, und die Lücke ist K4 vor K3.** Einen Anbieter zu bezahlen, dessen Produkt man nicht
bewerten kann, ist genau der Fehler, den §3 des Prozess-Dokuments für die Review-Zeile (H) benennt:
„sonst gekauftes Nichts".

### 5.1 Der kleinste sinnvolle Pilot

**Nicht** „ein Marktagent ersetzt den Sweep". Sondern:

> **PILOT: der Schatten-Analyst auf einer Charge.** Der bestehende Sweep bleibt aus. Eine feste
> Charge von N (Vorschlag: 12) offenen `auftrag`-Zeilen wird **einmal** von zwei Lesern beurteilt —
> dem heutigen Prompt auf `claude-opus-5` und demselben Prompt auf dem Marktagenten — und beide
> Antworten landen als Vorschläge, keiner als `t.analysis`.
> **Warum genau diese Form:** sie braucht **keinen einzigen Code-Schnitt**. Die Prompt-Funktion ist
> rein und exportiert (`analysis-prompt.ts:64`); ein Host-seitiges Skript kann sie aufrufen, die
> Batch-Struktur nachbilden und beide Läufe in eine Datei schreiben. Der Marktagent bekommt eine
> **read-only** Kopie des Repos, damit K3 nicht offen bleibt.
> **Abnahme-Mechanismus, dreistufig und in dieser Reihenfolge:**
> 1. **Form** (deterministisch, keine Meinung): striktes JSON, ein Eintrag je TASK-Zeile, Ids
>    ausschließlich aus den Prompt-Zeilen, Blocker in der geschlossenen Menge. Das ist genau, was
>    `server.ts:6196-6212` schon tut — der Pilot fährt dieselben Prüfungen, nur außerhalb.
> 2. **Übereinstimmung** (mechanisch): Cohens κ zwischen beiden Lesern auf `verdict` und auf der
>    Blocker-Menge. Eine hohe Übereinstimmung bei bekannt schlechter Güte des Referenz-Lesers ist
>    **kein** Bestehen — sie sagt nur, dass beide dasselbe Missverständnis teilen.
> 3. **Wahrheit** (die einzige, die zählt): die 12 Zeilen bekommen ihr Urteil vom **Owner**, und
>    das ist der Anker, gegen den beide Leser gemessen werden — dieselbe propose/promote-Naht wie
>    beim Kriterium (`server.ts:1580-1585`), aus demselben Grund: der Produzent schreibt nie den
>    Anker, an dem er gemessen wird.
> **Abbruchbedingung, vorab benannt:** wenn der Referenz-Leser auf denselben 12 Zeilen die
> 79-%-Falsch-Alarm-Rate von 2026-08-08 reproduziert, ist der Pilot **beendet, bevor der
> Marktagent bewertet wird** — dann ist der Prompt das Problem und nicht der Anbieter, und
> Vorschlag 1 geht vor.

### 5.2 Wie ein Marktagent später einliefern würde (BUILT, ungenutzt)

Zwei Türen existieren, und beide sind bereits propose-only konstruiert:

- `POST /api/steward/tasks` (`server.ts:15335-15380`): Status **hart** auf `pending` gezwungen,
  `programId` verboten, `repo` nie aus dem Body, Default-`kind` `notiz`, Ref-Dedup, Deckel gegen
  Flut. Der Kommentar nennt die Regel beim Namen: „producers write pending; only the owner
  promotes".
- `/intake` (`server.ts:12930`, `:15489`) — eigenes Secret, nie der Owner-Token, heute deaktiviert
  (`FLEET_INTAKE_SECRET` ungesetzt).

**INFERRED:** ein Marktagent, der *Urteile* statt *Zeilen* liefert, hat heute **keine** Tür — es
gibt keine Route, die eine `t.analysis` von außen entgegennimmt, und das ist richtig so: sie müsste
propose-only sein und hätte damit dieselbe Form wie Vorschlag 3s Ledger. **Erst das Ledger, dann
die Tür.**

---

## 6. Rangliste mit Schnittlinie

Owner-Vorgabe wörtlich: „Verbesserung der Triage/Analyse-Schicht des Arbeitskreises" — gerankt nach
*Wirkung je Schnitt*, nicht nach Interessantheit.

1. **Vorschlag 3 — das Verdikt-Ledger** (`analysis-verdicts.jsonl`). Ein `appendEvent` an einer
   Stelle. Ohne ihn ist **jede** weitere Aussage über diese Schicht wieder eine Meinung, und die
   Schicht wurde schon einmal blind eingeschaltet und blind abgeschaltet.
2. **Vorschlag 1 — Oberfläche mit Provenienz in den Analyse-Prompt.** Adressiert die gemessene
   Güte-Lücke direkt, aus einer schon laufenden deterministischen Projektion, ohne neuen Speicher.
3. **Vorschlag 2 — Staleness an die Fläche binden.** Adressiert den benannten Abschaltgrund an der
   Wurzel statt am Takt. Gewinn verteilungsabhängig, Risiko gering (Absenz fällt auf „stale").
4. **Vorschlag 4 — `"analysis"` in `DISPOSITION_WORKERS`.** Ein Listeneintrag; erreicht die
   Fälle, die kein Outcome-Join je sieht.
5. **Wieder einschalten** — danach, mit einer Kennzahl, gegen die man den Zug messen kann. Route
   (Spark) und `ANALYSIS_BATCH_CAP` sind dann A/B-Fragen, keine Glaubensfragen.
6. **Der Pilot (§5.1)** — nach 1–3, weil sein Abbruchkriterium auf deren Kennzahl beruht.

**— Schnittlinie —**

Darunter, benannt statt verschwiegen: **ContextPlan für Worker** (eigenes Vorhaben, neue
Receipt-Frage) · **graphify als Analysten-Kontext** (ungetrackter Nebenspeicher, `ast-grep` deckt
die Frage) · **`analysis` in `REPO_WORKER_KEYS`** (`server.ts:2074` — der Kommentar dort sagt
ausdrücklich, dass Worker, deren Urteil etwas trägt, eine eigene Entscheidung auf eigener Evidenz
brauchen; diese Evidenz ist genau das, was Punkt 1 erst herstellt) · **`ANALYSIS_TICK_MS` erhöhen**
(falscher Knopf, §2.4) · **eine Route, die Urteile von außen annimmt** (erst das Ledger).

---

## 7. Nicht geprüft

Benannt, damit oben nichts als breitere Abdeckung liest, als es ist.

- **Keine Ledger-Zahl ist von mir gemessen.** `lane-outcomes.jsonl`, `audit.jsonl`,
  `dispositions.jsonl`, `context-receipts.jsonl` und `fleet.json` sind gitignored und existieren in
  diesem Worktree nicht. Jede Zahl oben ist zitiert aus `docs/arbeitskreis-prozesse-2026-08-18.md`
  oder aus dem Body von `ec91075`. Die in §3.3 vorgeschlagenen Joins sind **Rezepte, keine
  Ergebnisse** — insbesondere ist die „22 von 28"-Rate eine Owner-Handzählung von 2026-08-08 und
  keine mechanische Messung.
- **Keine Pane gelesen, kein Worker gelaufen.** Ich habe den Analysten nicht gestartet und keine
  Antwort von ihm gesehen; alle Aussagen über sein Verhalten stammen aus dem Prompt-Builder, dem
  Sweep und dem Abschalt-Body.
- **`src/client.ts` nicht gelesen.** Die Aussagen über die Queue-UI (Blocker als Row-Tags,
  Gruppierung) stammen aus Kommentaren in `server.ts` und `docs/queue-analyst.md`, nicht aus dem
  Client.
- **`e2e/tasks.ts` nicht gelesen.** Wo ich „prüfbar durch e2e" schreibe, meine ich die im Code
  benannte Zuständigkeit (`analysis-prompt.ts:1-5`), nicht eine gelesene Sonde. Ob die
  vorgeschlagenen Schnitte bestehende Sonden brechen, ist **nicht** geprüft — Vorschlag 1 ändert
  einen Prompt, dessen Informationsgehalt ausdrücklich gepinnt ist, also ist mit Sonden-Arbeit zu
  rechnen.
- **`refine` nicht vertieft.** Zeile C des Prozess-Dokuments (Brief-Kompilierung) berührt dieselbe
  Naht, ist aber ein eigener Unterprozess; ich habe `refine-prompt.ts` nicht gelesen und über den
  Refiner nur zitiert, was `server.ts` und das Prozess-Dokument sagen.
- **Kosten in Tokens oder Geld: nirgends.** Es gibt kein Worker-Run-Ledger (§2.1), also nenne ich
  ausschließlich **Aufrufzahlen**. Wer eine Geldzahl braucht, muss zuerst `spec.observe` verdrahten.
- **Die Spark-Route nicht erprobt.** Dass `enhance` heute über `gpt-5.3-codex-spark` läuft, habe
  ich aus `WORKER_ROUTES` gelesen, nicht an einem Lauf beobachtet; ob die Brief-Qualität sich damit
  verändert hat, ist eine offene Frage, die den Analysten direkt betrifft (er beurteilt den Brief).
- **Kein Nicht-Fleet-Repo betrachtet.** Die Marktkriterien sind gegen dieses Repo geprüft; ein
  Ziel-Repo mit eigenem `.fleet/context-packs.json` habe ich nur als Mechanismus gelesen
  (`context-manifest.ts`), nie eines gesehen — in diesem Baum existiert die Datei nicht
  (`ls .fleet/` → nicht vorhanden).

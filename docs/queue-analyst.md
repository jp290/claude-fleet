# The queue analyst — RETIRED 2026-09-10  (and the queue contract that outlived it)

*The analyst is gone from this tree. What is left below is the part of the queue's contract that
never depended on it: which bytes a lane receives, who releases a row, and what the dispatcher
actually checks. Restore anchor for the whole subsystem:
`7ff56eab83f64b0826142139c7f4d1be274ebd2d`. Introduced `500ff63a`, last functional core `64c10e4a`.*

*Live code: `server.ts` (`tickBriefSweep`, `compileBriefs`, `tickDispatch`, `releaseTask`),
`src/client.ts` (`qGroupOf`), `task-waves.ts`. Verified by `e2e/tasks.ts` section (h),
`e2e/pins.ts` (the retirement rules and the surviving brief/release contract).*

## 0. What was retired, and what that cost

The analyst read every dispatchable row against the tree and filed an advisory verdict —
`ready | needs-you | unknown`, with `blockers` and a `collides` list. It decided nothing: the
owner's release was always the decision. It also carried, in one sweep, the BRIEF COMPILER, which is
production and stays.

Gone in one cut: `analysis-prompt.ts`, `analysis-staleness.ts`, `task-analysis-warning.ts`,
`Task.analysis` and its type, `tickAnalysisSweep` / `analysisDue` / `analysisFailed` /
`recordAnalysisVerdict` / `analysisStale` and the whole `ANALYSIS_*` configuration, the
`analysis-verdicts.jsonl` writer, `POST /api/tasks/:id/reanalyse`, the poll's `analysis` digest and
`analysis: { on }` fact, the client's verdict cache, chip, panel and `↻ re-analyse` action, the
disposition rail's `analysis` write door, the wave projection's model edges and the running-work
block they alone could fill, and `register.sh`'s verdict column and `[modell]` collision graph.

**Why now.** It had been switched OFF on the live deployment since 2026-08-08 for its measured
false-alarm rate (`FLEET_ANALYSIS_MS=0` in `watchdog.sh`), so the fleet's real behaviour for a month
was already what this cut makes the only behaviour. Every symbol, field, route and vocabulary
survived that month, and each one kept promising a reading nobody was doing — a stale verdict on a
row, a `waiting: not analysed yet` branch nothing could clear, a "trust" state in the wave
projection that could only ever answer `off`. A reader nobody runs is not a safety property.

**What was NOT replaced.** The collision read went with it and nothing took its place. It was a
MODEL judgement over predicted file surfaces; a deterministic intersection of declared surfaces is a
different check with a different failure mode, and proposing one is its own decision.

**The measurement that built it, kept because it is the same argument.** The eval gate it replaced
on 2026-08-05 had produced exactly ONE verdict ever and never a positive one: its population was
empty by construction (intake off, steward files `notiz`, and a task the owner wanted run got
promoted, which bypassed the gate). Its only real subject was the owner's own un-promoted drafts and
its only power was starting them behind his back. The analyst answered that by deciding nothing —
and then, for a month, by not running.

## 1. What a lane receives  (the brief)

The brief is the EXACT bytes a lane is founded on. It is compiled ONCE per draft and never again: it
depends on the draft, not on the tree, so nothing about it improves after a land.

- **Machine-compiled** — `tickBriefSweep` → `compileBriefs` → `runEnhance`, stored as
  `Task.brief` with `edited: false`. Readable AND editable before the start.
- **Owner-written** — `POST /api/tasks/:id/brief` pins it (`edited: true`, model `"owner"`), and
  nothing recompiles over it.
- **Raw** — no brief on the row: the draft text itself is delivered.
- **Clarify** — `buildClarifyBrief`'s deterministic frame around the verbatim request; no model
  call at all.

`briefAndSend` contains **no model call**: it sends `t.brief.text ?? t.text` plus a freshly derived
ContextPlan anchor block. What was approved is what runs, and an e2e check asserts byte-equality
with the prompt that reached the pane.

`compileBriefs` is the ONE site that writes a machine brief, and since the retirement exactly one
sweep reaches it (the analyst's own compile step was the second). A third caller would be a new
producer of the bytes a lane is founded on — pinned in `e2e/pins.ts`.

## 2. Invariants

1. **Nothing starts unattended that the owner did not release.** `tickDispatch` selects
   `status === "queued"` only. (Three machine paths write that status — the requeue after a failed
   spawn, the boot reconcile of orphaned `sent` rows, and a bound Program-MAIN's release door — see
   §4; only the third is a real release, and it stamps `releasedBy: "machine"`.) Since Schnitt 2
   (2026-09-14) it walks those rows in the order of the start plan (`server.ts#startPlanWaves`,
   `start-plan.ts`) instead of oldest-first, and starts a land wave of n rows as ONE lane — but only
   when EVERY row of that wave is `queued`: a wave with a pending partner does not start, and its
   released row says `waiting: wave partner <id> is not released`. The plan runs under the `manual`
   release policy, so this ordering never widens the released set.
2. **What was approved is what runs.** §1.
3. **An observation is not work.** A `notiz` cannot be released (409) at either door. `adopt` — or
   the `/kind` route — converts it into a `pending` `auftrag`, and that conversion is the OWNER's
   act, which is what keeps the steward from ever authoring runnable work.
4. **A raw start says it is raw.** `POST /api/tasks/:id/dispatch` gates on nothing — an attended
   click outranks every advisory — but the UI drops the primary style and requires a second,
   deliberate tick when the row carries no brief, and the acknowledgment rides into the audit line.
   Until 2026-09-10 "raw" meant "no analyst verdict said ready"; it is now grounded on WHICH BYTES
   the lane gets, which is the fact that outlived the reader.
5. **`unknown` is still `unknown`.** The retirement removed a producer of three-valued readings; it
   did not weaken the rule that missing or failed evidence is `unknown`, never zero, false or pass
   (`AGENTS.md`). Nothing in the queue may render an absent brief, an unreadable surface or an
   unresolvable repo as a pass.

6. **Eine Wartenotiz nennt den Grund, der für DIESE Zeile gilt — und ein PERMANENTER Grund schlägt
   jeden temporären.** `tickDispatch` prüft die Harness-Automatisierbarkeit einer Zeile
   (`server.ts#harnessAutomatableFor`) VOR beiden Lane-Deckeln, weil sie die einzige Eigenschaft in
   dieser Schleife ist, die sich durch Warten nie ändert: kein schließendes Lane macht einen
   ablehnenden Adapter automatisierbar, während beide Deckel per Konstruktion vorübergehend sind.
   Stand die Prüfung darunter, erreichte der dauerhafte Grund die Zeile nur in den Fenstern, in denen
   der vorübergehende gerade nicht griff — `waiting` schreibt bei Änderung, der letzte Schreiber
   gewinnt, und der Deckel ist fast immer voll. Gemessen an einer Scratch-Instanz (Tick 250 ms): die
   Harness-Notiz erschien ~4 s nach dem Schließen eines Lanes und wurde vom nächsten Tick dauerhaft
   von der Deckel-Notiz überschrieben. Live war das `746513d1` (Spawn `pi-zai`), die stundenlang
   `waiting: 2/2 lanes busy in claude-fleet — land or close one` trug, obwohl der Deckel nie ihr
   Grund war (Controller-Messung 2026-09-07 04:47–05:14).
   Drei Sätze gehören dazu und sind je ein Check, nicht ein Versprechen (`e2e/tasks.ts` §(e6),
   Form-Pins in `e2e/pins.ts`):
   - **Die Gegenprobe.** Eine Zeile, die NUR am Deckel hängt, meldet weiterhin den Deckel. Ohne sie
     hieße „nenne den dauerhaften Grund" bloß, die halbe Queue wegzuklassifizieren.
   - **Der MASTER-STOP bleibt darüber.** Eine Zeile, die der Tick unter gestoppter Queue gar nicht
     ansieht, behält ihre Notiz byte-genau — sonst begänne der Zuschlag EINES Programs, Sätze auf
     jede fremde `queued`-Zeile der Fleet zu malen.
   - **Die Notiz nennt, WELCHE der zwei Bedingungen ablehnte** (`server.ts#harnessAutomationWhy`,
     eine Fassung, zwei Leser): bei GESETZTEM `FLEET_HARNESS_AUTOMATION` lehnt `pi-zai` mit seinem
     eigenen `automatable: false` ab, und ein Hinweis auf den Flag schickte den Leser zu einer
     Env-Änderung, die nichts ändert. Übrig bleibt für eine solche Zeile genau ein Weg, und die
     Notiz sagt ihn: *hand dispatch only* (`POST /api/tasks/:id/dispatch`).

An invariant that RETIRED with the analyst, named so nobody looks for it: *"nothing starts
unattended against a tree it was not read on."* There is no reading, so there is no staleness, and a
guard nobody can clear is a deadlock wearing a safety property's clothes — which is why that guard
was already written as `if (ANALYSIS_ON) { … }` and had been inert for a month.

## 3. Knobs

| env | default | |
|---|---|---|
| `FLEET_BRIEF_MS` | 0 | the brief compiler's tick; **0 = compiler off**, the default and the live deployment |
| `FLEET_ENHANCE_CMD` | — | subprocess stand-in for harnesses |

Batch cap 6, max 3 attempts, backoff `60s × 2^attempts`, 3 compiles at a time. A harness without a
stand-in **must** leave `FLEET_BRIEF_MS` at 0 or the suite spawns a real agent — the same rule
`FLEET_AUTO_REVIEW_MS` carries. The compiler's backoff lives in memory only: pacing a worker is not
a finding about the work, and a fresh server may well have a working enhancer.

The live deployment is machine-checked rather than re-read:

<!-- pin:watchdog-spawn FLEET_BRIEF_MS=unset -->

Turning the compiler on is an owner act on `watchdog.sh` plus `launchctl kickstart`.

Selection is `briefDue`: a dispatchable `auftrag` with no brief yet. A row it touched is a row whose
bytes are settled — nothing in this fleet claims to have READ one.

## 3b. Die KARTE — was eine Zeile über sich selbst sagt (S3, 2026-09-12)

Neben dem Brief-Kompiler steht seit `FLEET_CARD_MS` ein zweiter, KLEINERER Tick. Er schreibt die
Zeile nicht um; er LIEST sie: `card-extract.ts` gibt einem Haiku genau einen String — den Brief,
sonst den Rohtext — und bekommt ein festes Objekt zurück
(`{ziel, rolle{harness,model,effort}, surface{files,symbols,creates}, done, verify, verboten, program?, size?, after?}`).

**Der Extraktor bekommt KEIN Repository und keine Werkzeuge** (`tools: TEXT_ONLY_TOOLS`, gepinnt in
`e2e/pins.ts`). Das ist kein Sparzwang, sondern die Konstruktion: jedes Feld, das er zurückgibt,
wird danach gegen eine Tatsache geprüft, die dieser Prozess selbst feststellen kann —

| Feld | geprüft gegen |
|---|---|
| `surface.files` | `git ls-files` (der Tracked-Snapshot aus `task-metadata.ts`) **und** den INTENT-Text der Zeile |
| `surface.symbols` | denselben Intent-Text **und** `graphify-out/graph.json`, danach eine Top-Level-Deklaration in der getrackten Datei (`card-extract.ts#declaresSymbol` — der Graph ist ein Schnappschuss; eine Datei mit so aufgelöstem Symbol trägt keine `ranges`); ohne Graph nur die Existenz der Datei, `ranges` bleibt `null` |
| `verify` | die bekannten Kettenschritte (`verify-proportion.ts#LOCAL_PROOF_STEPS`) |
| `surface.creates` | NICHT getrackt, im Intent-Text genannt, Verzeichnis getrackt (`docs/messungen/` frei) — eine geplante NEUE Datei |
| `after` | eine Queue-Zeile, im Text genannt |
| `rolle.*` | **beratend** (seit Validator 5): erst normalisiert — Harness case-insensitiv, Modell-Aliasse (`Opus 5`→`claude-opus-5[1m]`, `Sonnet 5`→`claude-sonnet-5`, `Astra`→`gpt-6-astra`, `Fable 5.1`→`claude-fable-5-1[1m]`), ein Tripel `harness/model/effort` in einem Feld, ein Rollenname vor dem Harness abgeschnitten —, dann gegen die registrierten Harnesses/Efforts und den `MODEL_RE`-Zeichensatz (keine Registry: die Lücke heißt „not a model id"). Eine unauflösbare Rolle bleibt Lücke, macht die Karte aber NICHT ungültig (`card-extract.ts#cardValid`): `rolle` hat keinen Konsumenten, gespawnt wird aus `Task.spawn` |

**Die Zitatregel ist ERZWUNGEN, nicht erbeten.** Der Prompt bittet den Extraktor, einen Pfad aus
einer Kommandozeile nicht als Fläche zu lesen; `validateCard` ENTSCHEIDET es: jeder Wert muss im
Intent-Text der Zeile stehen — dem Text mit maskierten Verify-Zeilen und zitierten Kommandos
(`task-metadata.ts#intentText`, dieselbe Maske, die S1 fährt). Ein Modell, das `e2e/pins.ts` aus
der Verify-Zeile als Fläche zurückgibt, bekommt eine `gaps`-Zeile, obwohl der Pfad getrackt ist.
Dieselbe Zeile fängt die andere Hälfte: einen plausiblen getrackten Pfad, den die Anfrage
überhaupt nicht nennt. Damit ist `card.surface` eine BEGRÜNDETE VERENGUNG der abgeleiteten Fläche
aus S1 — das Modell wählt aus dem, was der Text nennt, und kann nichts hinzufügen.

Was nicht besteht, wird **niemals repariert, ersetzt oder geraten** — es wird eine Zeile in `gaps`,
in den Worten des Extraktors. `valid` ist das UND dieser Prüfungen, kein Urteil über die Arbeit,
(außer den beratenden `rolle.*`-Lücken), und eine Karte mit `valid:false` wird trotzdem gespeichert: „hier wurde gelesen, und das hier
konnte nicht belegt werden" ist mehr wert als ein fehlendes Feld, das sich wie „niemand hat
geschaut" liest. Beim Laden werden `valid` und `surfaceValid` (keine `surface.*`-Lücke — das,
was `confirm-cards` fürs Bündeln liest) aus `gaps` NEU BERECHNET, nie geglaubt — eine
handgeschriebene `fleet.json` kann also nicht die eine Form erzeugen, die eine Lüge wäre. Jede
Karte trägt `validatorVersion` (`card-extract.ts#CARD_VALIDATOR_VERSION`); eine UNGÜLTIGE Karte
älterer oder fehlender Version liest der Tick genau einmal neu (`server.ts#cardDue`), eine gültige nie.

**Die Karte ist eine LESUNG, keine Autorität.** Nichts dispatcht aus ihr, `rolle` ist nicht
`Task.spawn`, und `card.model` trägt das Modell, das WIRKLICH LIEF (aus der
`WorkerRunObservation`), nicht die Konstante der Aufrufstelle — genau der Fehler, den der
Brief-Kompiler heute noch macht (`t.brief = {… model: SUMMARY_MODEL …}` stempelt die Summary-Stufe,
gleich welche Route geantwortet hat). Beide Hälften sind in `e2e/pins.ts` befestigt, damit die
Karte ihn nicht wiederholt.

Jeder Lauf — auch ein gescheiterter — ist eine Zeile in `cards.jsonl`
(`taskId, source, model, ms, valid, surfaceValid, validatorVersion, gaps`). Ein Modell-Lauf trägt
dazu die ROHANTWORT (`answer`, auf 4 KB UTF-8 gekürzt, `answerBytes` = volle Größe;
`card-extract.ts#cardAnswerForLedger`), damit ein Validator-Bump gegen das schon Gesagte geprüft
werden kann statt jede ungültige Zeile erneut durchs Modell zu schicken. Ein Trail, der nur Erfolge schriebe, sagte, der Extraktor falle
nie aus, und das ist das Einzige, was er über sich selbst nicht sagen darf.

| env | default | |
|---|---|---|
| `FLEET_CARD_MS` | 0 | der Karten-Tick; **0 = kein Timer registriert**, nicht ein Tick, der früh zurückkehrt |
| `FLEET_CARD_CMD` | — | Subprozess-Stand-in (Tests), wie `FLEET_REVIEW_CMD` |
| `FLEET_CARD_MODEL` | `claude-haiku-4-5-20251001` | `MODEL_RE`-validiert wie jede andere Modell-Variable |

Batch-Deckel 4, max. 3 Versuche, Backoff `60 s × 2^Versuche`, Timeout 120 s. Alle sieben Suiten
setzen `FLEET_CARD_MS=0` ausdrücklich. Scharfschalten ist ein **Owner-Akt** auf `watchdog.sh` —
die Lane, die das gebaut hat, hat die Datei nicht angefasst.

Auswahl ist `cardDue`: eine dispatchbare `auftrag`-Zeile ohne Karte, oder eine, deren Brief jünger
ist als `card.at`. Eine Eskalation auf ein stärkeres Modell bei `valid:false` ist ein benannter
Haken und ausdrücklich NICHT gebaut.

## 4. What this deliberately is not

It is **not a safety gate**, and since 2026-09-10 there is no worker here that could be mistaken for
one. The safety boundary is where it always was: no tick calls `mergeJob`, so an unattended lane
produces a branch that waits for a human.


## 5. Die Dispatcher-Betriebsreferenz (aus `CLAUDE.md` umgezogen 2026-08-18)

Die Vertrauensgrenzen im Präsens stehen in `CLAUDE.md` §Deploy; hier die Vollreferenz im Original
(kinds, Lane-Deckel, `Task.brief`, `FLEET_BRIEF_MS`, ↻ refine, „▸ clarify first"):

- **Der Dispatcher ist AN, startet aber NUR, was der Owner freigegeben hat** (Stand 2026-08-06: `fleet.json`
  trägt `"dispatch": true` — Zustand nie behaupten, ohne `grep '"dispatch"' fleet.json` zu prüfen; diese Zeile
  stand schon zweimal falsch. Seit `500ff63` wählt `tickDispatch` wörtlich `t.status === "queued"` — **es gibt
  kein Verdict, das eine Task von selbst startet**. ABER (Korrektur 2026-08-06,
  `docs/autonomy-bausteine-2026-08-06.md` §1.2): „nach `queued` kommt eine Zeile ausschließlich durch den
  Owner-Promote" ist FALSCH — **DREI Maschinen-Pfade schreiben `status="queued"`** (Stand 2026-08-22;
  bis `83468e0` waren es zwei, und die Zwei-Pfade-Aussage hier war ab da falsch): (1) der Requeue nach
  fehlgeschlagenem Spawn, `server.ts` grep `requeue`, (2) der Boot-Abgleich verwaister `sent`-Zeilen und
  (3) seit ACP-16 die **Release-Tür einer gebundenen Program-MAIN**,
  `POST /api/self/tasks/:id/release` (Route `server.ts#selfTaskRelease`, Handler `releaseTaskForMain`
  `server.ts#releaseTaskForMain`), die über den Helfer `releaseTask` (`server.ts#releaseTask`) genau dieses Feld schreibt
  und dabei `releasedBy:"machine"` stempelt — die Referenz mit allen Ablehnungen steht in
  `docs/self-api.md` §release. Nur (3) ist eine echte FREIGABE; (1) und (2) stellen eine Zeile in einen
  Zustand zurück, in den sie schon freigegeben WAR, und stempeln darum bewusst kein `releasedBy`. Alle
  drei vertretbar, aber wer auf die Ausschließlichkeit baut (Verb 3!), baut auf einen Satz, der nicht
  gilt. Der **Hand-Knopf**
  `POST /api/tasks/:id/dispatch` läuft unabhängig davon weiter — er prüft weder Master-Stop noch Deckel noch
  Quiet Hours (`server.ts`, grep `taskDispatch`); `dispatchOn` ist ein persistierter Laufzeit-Schalter,
  `POST /api/dispatch {on:true|false}`; Env: `FLEET_DISPATCH_REPO`, `FLEET_DISPATCH_MAX_LANES=1` (Owner-Entscheid 2026-09-07 09:3x, vorher 2 — „fuer vernuenftige Suiten"), dazu
  seit 2026-08-22 zwei weitere Knöpfe: `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` (`server.ts#DISPATCH_MAX_LANES_PER_PROGRAM`,
  UNGESETZT = der Repo-Deckel DIESER Zeile (nicht `FLEET_DISPATCH_MAX_LANES` — siehe (b) unten), ein
  ZWEITER Lane-Deckel je Program, der nach dem Repo-Deckel geprüft
  wird und darum ausschließlich verengen kann — ungesetzt kann er nie derjenige sein, der hält) und
  `FLEET_PROGRAM_MAX_RELEASED` (`server.ts#PROGRAM_MAX_RELEASED`, Default 5, Deckel für Pfad (3) oben: freigegebene,
  vom Tick noch nicht gestartete Zeilen je Program — seit Schnitt 3 nur unter der Freigabe-Politik `manual`,
  `docs/self-api.md` §release)). Er wählt
  aus, spawnt und brieft — **landen kann er nichts**, kein Tick ruft `mergeJob` (nur die Route;
  Owner-Entscheid vom 2026-08-04: „noch nicht", erst echte Läufe ansehen). Seit 2026-08-04 (Queue-Umbau,
  Session 21):
  - **(a)** Tasks tragen `kind` mit VIER Werten — `auftrag` · `richtung` · `notiz` · `betrieb` (seit
    `dd0c9a8`, 2026-08-10; die alten `lane`/`note` werden beim Laden migriert). Steward-Tasks sind default
    `notiz` (Beobachtung; opt-in `kind:"auftrag"` im POST-Body ist der bewusste Claim), Owner/Intake sind
    `auftrag`. **NUR ein `auftrag` darf freigegeben werden — die drei anderen Arten bekommen 409**, an
    BEIDEN Türen: am `▸ queue`-Knopf und an `POST /api/tasks {queue:true}` (Owner-Entscheid 2026-08-05,
    bestätigt und auf alle drei ausgeweitet 2026-08-10). Der Weg für eine beratende Zeile ist die
    KONVERTIERUNG durch den Owner (`adopt` bzw. die `/kind`-Route), danach ist sie ein `auftrag` und wird
    normal freigegeben. **Hier stand bis 2026-08-10 „Promote einer Note bleibt erlaubt", und diese Zeile
    war seit dem 05.08. falsch — sie hat die kind-Umbau-Lane dazu gebracht, den 409-Riegel zu entfernen und
    Sonden zu schreiben, die das Gegenteil der bestehenden behaupteten.** Kein Gate konnte es sehen:
    `e2e/tasks.ts` und `e2e/steward-outcomes.ts` laufen ausschließlich in `./e2e-isolated.sh`, also erst
    NACH dem Land. Die Lehre ist die alte: bei einem Widerspruch gilt der Code, nicht dieses Dokument.
    **UND: EINE UMBENENNUNG IM SERVER MUSS DEN CLIENT MITNEHMEN — `tsc` sagt dir das NICHT.**
    `dd0c9a8` ließ `src/client.ts` unberührt, und dort steht eine EIGENE Typdeklaration der fremden
    Fläche (`interface TaskInfo`, `kind?: …`). Gegen die alte Union compilierte jedes
    `t.kind === "note"` weiter und war nur für immer falsch: Gruppierung, Chip „not work" und drei
    Guards waren tot, ohne ein einziges Compiler-Wort — dieselbe Klasse wie der `awaiting`-Befund
    (eine Deklaration über eine fremde Fläche ist eine BEHAUPTUNG, kein Typ). Das Werkzeug dagegen ist
    billig und war hier entscheidend: **zuerst die Union im Client korrigieren, dann `tsc` die
    Fundstellen aufzählen lassen** (nannte exakt sechs, `TS2367 no overlap`) — nie von Hand suchen.
  - **(a2) Der globale Master-Stop ist seit dem Program-scoped Dispatch KEIN Tick-Gate mehr, sondern
    ein Gate JE ZEILE** (`server.ts#tickDispatch`; die Vorgeschichte steht in
    `docs/game-maker/workflow-v2.md` §7 F1 und in
    `docs/messungen/2026-09-03-private-repo-j-game-maker-gruendung.md` §3). Der Owner kann EINEM Program
    per `POST /api/programs/:id/dispatch` einen Datensatz `{v:1, on, maxLanes}` geben
    (CLOSED/VERSIONED/DEFAULT-ABSENT wie promotion/profile/studio, `confirmedAt` serverseitig
    gestempelt, unlesbar ⇒ ABSENT ⇒ exakt das Alt-Verhalten, Loader `server/types.ts#loadProgramDispatch`);
    dann startet der Tick die freigegebenen Zeilen GENAU dieses Programs auch bei `"dispatch": false`.
    Fünf Sätze, die man braucht:
    - **Der Deckel des Owners kann nur VERENGEN.** `server.ts#programDispatchCap` ist ein
      `Math.min` gegen die MASCHINENZAHL; der Repo-Deckel steht unverändert darüber und wird zuerst
      geprüft. **Die Maschinenzahl ist seit 2026-09-07 `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM`, WENN
      der Operator eine gesetzt hat, sonst der Repo-Deckel DIESER Zeile** (`?? repoMax`). Vorher war
      der Default an `FLEET_DISPATCH_MAX_LANES` verankert, und genau das machte den unkonfigurierten
      Knopf beim ersten gehobenen Repo bindend: Private-repo-j auf 3 heben und die Zeilen — allesamt
      Program-Zeilen — stünden bei 1/1 unter einer Notiz, die das PROGRAM nennt, also den falschen
      Knopf. Der Vertrag des Deckels („inert, bis der Operator ihn KLEINER setzt") ist damit wieder
      wahr. Beweis: `e2e/tasks.ts` §(e5); die Multiplikations-Sicherheit hängt unverändert daran,
      dass der Repo-Deckel ZUERST und UNBEDINGT geprüft wird, nicht an der Größe dieser Zahl.
    - **Der Zuschlag wird nur ausgegeben, solange das Program `active` ist**
      (`server.ts#programDispatchGrant`) — die liegengebliebenen `queued`-Zeilen eines
      abgeschlossenen Programs starten nichts.
    - **Alles andere gilt weiter**: der Autos-Master-Stop (`autosOn`, über `canDeliver`), Repo- und
      Program-Deckel, der Harness-Bolt und der freie Slot. Der
      Datensatz öffnet den Dispatcher, nicht den Hand-Knopf.
    - **Quiet Hours werden für genau EIN Paar übergangen**: eine Zeile mit `releasedBy:"machine"` in
      einem Program mit aktivem Zuschlag. Eine owner-freigegebene Zeile desselben Programs wartet
      weiter — die Nacht-Regel wird nicht aufgeweicht, sie bekommt einen benannten Zweig.
    - **Quiet Hours ÜBERSPRINGT seither die Zeile, statt den Tick zu beenden** (`continue` statt
      `return`): sobald eine Zeile befreit sein kann und ihre Nachbarin nicht, ist das keine
      Bedingung der MASCHINE mehr. Ohne diesen Schnitt hielte die älteste nicht-befreite Zeile die
      befreite das ganze Fenster hinter sich — genau der Stillstand, gegen den der Zuschlag gebaut
      ist. Jedes ANDERE Gate an dieser Stelle (`no free slot`, Autos-Stop) beendet den Tick weiter.
    Owner-Fläche: Program-Detail, Sektion „Program dispatch" neben „Self-land promotion"
    (`src/client.ts#programDispatchState`). Beweis: `e2e/programs.ts`, Sektion
    „Program-scoped dispatch" (sieben Fälle inkl. Positivkontrolle bei offenem Master-Stop);
    Form-Pins in `e2e/pins.ts` (ein Schreiber, ein Leser, die Min-Klausel, das Quiet-Hours-Paar,
    der Loader). **Kein neues `FLEET_*`-Env.**
  - **(b)** Der Lane-Deckel zählt nur noch Lanes im `DISPATCH_REPO` (kanonisiert via realpath — createWorktree
    speichert das Symlink-aufgelöste Toplevel!), und eine wartende Task sagt auf ihrer Row WARUM („waiting:
    N/M lanes busy" / „no free slot").
    **Und die ZAHL, gegen die er zählt, ist seit 2026-09-07 JE REPO** (`server.ts#repoLaneCap`,
    Owner-Auftrag 11:2x: „der sollte ueberhaupt hoeher liegen als 1, damit kann man ja nicht
    arbeiten"). Vorher war es EIN maschinenweites `FLEET_DISPATCH_MAX_LANES` für jedes Repo auf dem
    Board. Der Wert wurde für DIESES Repo gewählt — jede Fleet-Lane fährt im Land-Gate die volle
    Suite gegen den einen Mac-Mutex, eine zweite Lane kauft dort nur Schlange — und traf jedes
    fremde Repo identisch: Private-repo-j (Verify = `bun test`, ~26 s) stand mit
    `waiting: 1/1 lanes busy in astra-main`, ohne dass irgendetwas contended war.
    - **Reihenfolge: Eintrag vor Env.** `repoLaneCaps[repoCanon(repo)]` gewinnt, sonst
      `FLEET_DISPATCH_MAX_LANES`. Ein Repo ohne Eintrag rechnet byte-genau die Zahl von vorher.
    - **Dieser Eintrag darf HEBEN**, anders als `Program.dispatch.maxLanes` (nur senken). Der
      Grund ist Arithmetik, nicht Vorsicht: ein Deckel JE PROGRAM multipliziert sich mit der Zahl
      der Programs gegen ein festes Slot-Board, ein Deckel JE REPO nicht — er wird gegen Lanes
      GENAU DIESES Repos gezählt, und ein Repo hat genau eines. Die Obergrenze ist darum das Board
      selbst: `REPO_MAX_LANES_MAX = MAX_SLOTS` (16), und `no free slot` bleibt das einzige
      fleetweite Gate, das den Tick noch stoppt.
    - **Ein API-Call, kein Deploy:** `POST /api/repo-lane-cap {repo, maxLanes}` (owner-only;
      `0`/`null` löscht den Eintrag zurück auf den Maschinen-Default — ein anderer Zustand als
      „ein Eintrag mit dem Wert des Defaults"), Lesen `GET /api/repo-lane-caps` (`caps` = nur das
      Gespeicherte, `default` = was ein Repo ohne Eintrag bekommt, `max` = das Board).
      Persistiert in `fleet.json` und beim Laden RE-VALIDIERT; eine abgelehnte Zeile fällt laut auf
      den Default zurück. Trail: `repo_lane_cap`.
    - **Die Wartezeile nennt die Quelle**, weil dahinter zwei verschiedene Owner-Handlungen liegen:
      `waiting: 1/1 lanes busy in <repo> (machine default) — land or close one` heißt Env ändern und
      neu starten, `… (repo cap) …` heißt ein API-Call. Beweis: `e2e/tasks.ts` §(e4) (zwei Repos,
      zwei Deckel, Quellen-Text, Clear-Pfad, Türablehnungen); Form-Pins in `e2e/pins.ts` (der Tick
      liest die Zahl NUR über `repoLaneCap` und nennt `DISPATCH_MAX_LANES` nirgends mehr selbst).
    - **Nicht angefasst:** der Hand-Knopf `POST /api/tasks/:id/dispatch` prüft weiterhin KEINEN
      Deckel — er war der Notweg, solange die Zahl nicht je Repo einstellbar war, und bleibt was er
      war: manuelles Routing durch den Owner.
  - **(c)** Der Brief entsteht NICHT mehr beim Dispatch: `tickBriefSweep` kompiliert ihn einmal pro Entwurf
    und legt ihn als `Task.brief` auf die Zeile — vor dem Start lesbar UND editierbar
    (`POST /api/tasks/:id/brief`; eine Bearbeitung pinnt ihn als `edited`, und nichts kompiliert darüber).
    `briefAndSend` hat seither **keinen Modellaufruf mehr** (`next.brief?.text ?? next.text`) — was
    freigegeben wurde, ist damit auch das, was läuft. Bis 2026-09-10 kompilierte der Analysten-Sweep
    denselben Brief in seinem eigenen Durchgang mit; seit seiner Stilllegung ist `tickBriefSweep` der
    EINZIGE Aufrufer von `compileBriefs` (Pin in `e2e/pins.ts`).
  - **(d) Erst das Eval-Gate, dann der Analyst — BEIDE sind Geschichte.** Prüfbar statt zu glauben:
    `tickEvalSweep`, `FLEET_EVAL_MAX_AUTO_PER_DAY`, `evalAuto` und die Route `eval-reset` kommen in
    `server.ts` **null mal** vor; seit dem 2026-09-10 gilt dasselbe für `tickAnalysisSweep`,
    `Task.analysis`, `FLEET_ANALYSIS_MS`/`FLEET_ANALYSIS_CMD` und `POST /api/tasks/:id/reanalyse`
    (Negativ-Pins in `e2e/pins.ts`, Rückbauanker `7ff56eab83f64b0826142139c7f4d1be274ebd2d`).
    Was BLEIBT, ist der Brief-Kompiler mit seinem eigenen Schalter `FLEET_BRIEF_MS` (Default 0 = aus,
    `e15d672`, 2026-08-18): er schreibt Bytes, er urteilt nicht, und Suiten/fremde Harnesses ohne
    `FLEET_ENHANCE_CMD`-Stand-in müssen ihn auf 0 lassen. Owner-Poll trägt `briefCompiler:{on:true}`
    (bei 0 weggelassen); ein `analysis:{on}` daneben gibt es nicht mehr. Die Entscheidung war und
    bleibt der Release des Owners — nur steht daneben jetzt kein Urteil mehr, das man überstimmen
    könnte (`task_override` hat keinen Erzeuger mehr; die Zeilen in `audit.jsonl` bleiben lesbar).
  - **(d2) ↻ refine, der Brief-Kompiler** (`POST /api/tasks/:id/refine` async, `…/refine-confirm`
    all-or-nothing; `briefs/task-refine.md`): read-only-Worker, der eine rohe Zeile in 1..N geschnittene
    Kinder mit Done-Kriterium, Verify-Weg und `files` übersetzt — oder mit `unchanged:true` + Begründung
    zurückgibt (Triage-Riegel gegen Aufblähen; hat bei seinem ersten Live-Einsatz korrekt gegriffen).
    Propose/promote wie beim Kriterium: der Lauf fasst den Text der Zeile nie an, erst der Confirm mintet die
    Kinder — **ohne** `brief`, denn ein Kind ist ein neuer Entwurf und trifft den Kompiler frisch.
  - **(e) „▸ clarify first"** (Knopf neben „▸ start lane", `POST /api/tasks/:id/dispatch {clarify:true}`, NUR
    attended — kein Tick übergibt es): derselbe Spawn, aber der Gründungsprompt ist `clarify-prompt.ts` statt
    `runEnhance` (bewusst kein Enhancer: er kompiliert ein Done-Kriterium, und genau das fehlt hier; kein
    `/sharpen3` aus demselben Grund). `buildClarifyBrief(next.text, …)` nimmt seit 2026-09-10 keinen
    Vor-Verdict mehr entgegen: der Parameter trug ausschließlich `Task.analysis.reason`, und mit dem
    Analysten ist sein einziger Erzeuger weg. Die Lane schlägt via
    `POST /api/self/criterion` vor (`confirmedAt:null`), der Owner bestätigt mit eigenem Text
    (`POST /api/tasks/:id/criterion-confirm`) — propose/promote, damit der Produzent nie den Anker schreibt,
    an dem er gemessen wird. Solange sie wartet: `Slot.awaiting="owner"` (persistiert), und
    `handleStewardSend` weist den Slot mit 409 ab. Historie: `docs/attic/autonomy-trial-1.md`,
    `docs/attic/queue-automation.md`.

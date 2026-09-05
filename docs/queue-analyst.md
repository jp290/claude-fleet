# The queue analyst  (operative — the contract the dispatcher runs under)

*Replaces the eval gate, 2026-08-05. Code: `analysis-prompt.ts`, `server.ts`
(`tickAnalysisSweep`, `tickDispatch`), `src/client.ts` (`qGroupOf`). Verified by
`e2e/tasks.ts` section (h) and `e2e/steward-outcomes.ts`.*

## 1. The split

Two questions had been fused into one worker:

- **What IS this task?** Attributable? In reach? Does it carry a done-criterion? Does it
  collide with work already running? — useful for **every** task, at every status, and
  useful **to the owner first**.
- **May the machine start it without me?** — a policy decision *on top of* that reading.

Because they were the same code, the reader could only ever look at the rows the second
question applied to: `pending` lane tasks. The analyst answers the first question and
answers it everywhere. The second question now has a one-word answer: **no.** The
dispatcher runs `queued` and nothing else, and only the owner puts a row there.

## 2. Why — the measurement that ended the gate

Taken off the live deployment before the rewrite:

| | |
|---|---|
| verdicts the eval gate had ever produced | **1** |
| positive verdicts (`auto`) | **0** |
| `evalAuto` day counter | `{"day":"","count":0}` — never incremented |
| `FLEET_INTAKE_SECRET` in the running srv's env | **absent** → `/intake` answers 404 |

The population was empty by construction. Lane tasks have two producers, the owner and
`/intake`; intake was off, the steward files `note`, and a task the owner *wanted* run got
promoted — which bypassed the gate. So its only real subject was the owner's own
un-promoted drafts, and its only power was starting them behind his back. That is the one
thing it should never have done.

Four further findings from the same audit, and where each one went:

| finding | resolution |
|---|---|
| the gate judged the raw draft; the lane ran a sonnet-tier rewrite of it | the brief is compiled **in a sweep** (§5a — the analyst's, or the compiler's own), stored, judged, and sent verbatim (`Task.brief`) |
| a verdict never expired, though criterion 1 is time-dependent | the verdict records the integration tip and the brief revision it judged; it expires when the brief changes or when the tree moved **under the row's own files** (`analysisStale` → `analysis-staleness.ts`, §3b) |
| a worker timeout became a permanent verdict for its whole batch | a failure is an absence with `attempts` and exponential backoff, never a finding — and since 2026-08-07 never a deletion either (§3a) |
| an override was indistinguishable from an ordinary promote | releasing a flagged row writes a note and a `task_override` audit event |
| priority inversion: an old pending row pre-empted a fresh promote | gone by construction — `pending` and `queued` no longer compete for a tick |
| the reader could not see the running fleet | open lanes ride in the prompt; `collides` names branches, not just batch siblings |
| `collides` was computed every sweep and read by nobody | `tickDispatch` holds a colliding row back (invariant 6) — before that, only the lane cap kept two colliding lanes apart |

## 3. The reading

Three criteria, each with a blocker tag the UI shows as a row label:

| criterion | blocker | means |
|---|---|---|
| attributable | `attribution` | it maps to real files/symbols, and its claims about the tree hold |
| in reach | `reach` | nothing leaves the worktree — no publishing, credentials, shared machine state |
| has a done-criterion | `criterion` | bounded, and the repo's own verification can judge it finished |
| the brief is the draft, thickened | `brief-drift` | the enhancer added a claim or dropped one |

`brief-drift` has no predecessor. It exists because the enhancer's additive-only contract
was, until now, a promise in the enhancer's own prompt with nothing checking it.

Verdicts: `ready` · `needs-you` · `unknown`. Three-valued on purpose — `unknown` is the
analyst failing to *answer*, and that must never be able to read as either judgement.

## 3a. A failure is an absence — and an absence must not delete a reading

`unknown` was built so a broken worker could not produce a finding. It could still produce
a *deletion*, and for three months it did: a failure rewrote `t.analysis` wholesale for
every row of the batch, keeping only `attempts`. Verdict, reason, blockers and collides
were gone, and the row became indistinguishable from one nobody had ever read.

Measured on the live queue, 2026-08-07: at 09:41 one batch of six lost **four `needs-you`
and two `ready`** to `analyst returned no JSON`. A backoff retry healed the register ~80
minutes later; at `ANALYSIS_MAX_ATTEMPTS` it would not have healed at all. The sweep sorts
**released rows first**, so the rows nearest to running went into that window first.

Since then (`analysisFailed`) a failure is filed **beside** the verdict:

| field | after a failed re-reading |
|---|---|
| `verdict` `reason` `blockers` `collides` | the last reading that arrived — unchanged |
| `at` `head` `briefAt` | that reading's own, so the row keeps answering about the tree and brief it was genuinely read against |
| `attempts` | +1 |
| `retry` | `{at, reason}` — when the re-reading failed and why |

Two consequences worth stating, because both are load-bearing:

- **Nothing gains trust.** The preserved verdict keeps its old `head`/`briefAt`, so it
  still answers about the tree and the brief it was genuinely read against, and what
  schedules the re-read is `analysisDue`'s failure arm (`attempts > 0`), which owns the
  clock whatever staleness says. The dispatcher's invariant 3 reads it exactly as before —
  it holds the row back iff the reading has expired under §3b. What changed is that the owner
  can now read what the last reading said while it waits.
- **The failure owns the schedule.** `analysisDue` keys the backoff on `retry.at`, not on
  `at`. Keyed on `at` — which now belongs to the older, successful reading — a preserved
  verdict would hammer every tick or freeze, decided by nothing but how old it happened to
  be. Proven in `e2e/tasks.ts` (h5b), which also counter-probes the hammering case.

A row in this state reads `⚠ … · re-analysis failing (N×)` in the queue and
`verdict(age)!stale?xN` in `register.sh`, with the failure's own words in the detail pane.

## 3b. A verdict expires against its own FLÄCHE, not against the tip

`analysisStale` was a bare equality on the integration tip: any land invalidated the reading
of **every** open row, whatever that land had touched. A docs-only land expired a verdict
about a pure `src/client.ts` row.

That is not a rounding error — it is the named reason the sweep was switched off (`ec91075`):
~59 open rows meant a re-read wave of ~10 workers **per land**, and six lands fell on
2026-08-06 alone. The knobs that look like the fix (`ANALYSIS_BATCH_CAP`, `ANALYSIS_TICK_MS`)
only stretch that wave over more ticks; the trigger is what was wrong.

Since 2026-08-18 the rule lives in `analysis-staleness.ts`, pure, and has three arms (the third
splits into two named reasons, one per unknown side):

| a verdict is stale when | why |
|---|---|
| the **brief** changed (`briefAt`) | unchanged — the verdict is about a string nobody will send |
| the tip moved **and** the files it moved intersect the row's own surface | the ground *this* row stands on actually moved |
| either surface is **UNKNOWN** | absence of knowledge falls to stale, never to fresh |

- **The row's surface** is the same `taskView`/`deriveTaskMetadata` projection the analyst is
  fed (§3). `confirmed` and `derived` both count as known; absence is not an empty list.
- **The moved surface** is `git diff --name-only --no-renames <head> <tip>`, cached per
  `(repo, head, tip)` — never a spawn per row per tick. It is deliberately **not** a join over
  `LaneOutcome.filesTouched`: a direct commit in the main checkout is invisible to every
  land-side ledger (no `fleet/land` note, no `lane-outcomes` line, no post-land audit — measured
  2026-08-07 on `0e2a672` and `4955444`), so a ledger join would report "nothing moved" for
  exactly the commits nobody supervised. Two-dot, tree-vs-tree, because after a rebase the tip
  need not descend from `head` at all. `--no-renames` so a moved file answers under both names.
- **The sweep prefills it, and that is load-bearing.** The git side fills asynchronously, so the
  synchronous reader answers UNKNOWN — conservatively stale — until the process returns. On a row
  badge that is a 2 s flicker; inside `analysisDue` it would undo the whole cut, because the first
  tick after a land would read UNKNOWN for every row and re-read the queue exactly as the tip
  comparison did. `tickAnalysisSweep` therefore fills the surfaces immediately after it refreshes
  the tips, in the same breath and for the same stated reason. Caught by `e2e/tasks.ts` (h9s),
  which failed on it before the prefill existed.
- **Unknown never reads as fresh.** A non-zero git, a head GC'd away, *and* an empty diff where
  the two tips genuinely differ all store UNKNOWN — two commits can share a tree, and "the diff
  is empty" is indistinguishable here from "the diff did not run". An unknown *tip* stays what
  it always was: not stale, because a measurement never taken must not paint every row.

**The residual, stated where the rule is.** A `derived` surface is the paths the row's text
names exactly, so a row that will also touch a file it never named is judged on the narrower
list. That is a widening of invariant 3, not a neutral refactor. It is bounded by the third arm
(no surface ⇒ stale) and by the fact that the alternative — expiring every verdict on every
land — is what took the analyst offline.

`register.sh` renders the same rule from disk (`!head`), for the same reason it renders `!brief`:
two meanings of "stale" in two readers is the drift this repo keeps paying for.

## 4. Invariants

1. **Nothing starts unattended that the owner did not release.** `tickDispatch` selects
   `status === "queued"` only.
2. **What was judged is what runs.** `briefAndSend` contains no model call; it sends
   `t.brief.text ?? t.text`. An e2e check asserts byte-equality with the prompt that
   reached the pane.
3. **Nothing starts unattended against a tree it was not read on** — read since 2026-08-18
   as *the part of that tree the row itself touches* (§3b). A released row waits,
   with the reason on its own row, while its analysis is missing, `unknown`, or stale —
   *unless no analyst is configured at all* (`FLEET_ANALYSIS_MS=0`), because a guard
   nobody can clear is a deadlock wearing a safety property's clothes. A running **brief
   compiler** neither clears nor lifts this: it is not a reader (§5a).
4. **The verdict never disables an action.** It groups, labels and warns. Every button the
   owner had, he still has.
5. **An observation is not work.** A `note` cannot be released (409). `adopt` converts it
   into a `pending` brief — a conversion the *owner* performs, which is what keeps the
   steward from ever authoring runnable work.
6. **Nothing starts unattended on top of work it was told it collides with.** A released
   row whose `collides` names something *actually running* is held, with the match on its
   own row, and starts by itself once that work is gone. Three boundaries make this a wait
   rather than a new gate: it is held only against **running** work (never another queued
   row — two rows naming each other would deadlock, invisibly, both displaying "waiting");
   only on a **fresh** analysis (it sits below the staleness check and inside invariant 3's
   "is there an analyst at all", because a collision list nobody refreshes would pin a row
   on an expired fact); and it **skips to the next row** rather than stopping the tick,
   since a collision clears on lane-land timescales and every other wait clears in seconds.
   The field is mixed — task ids *and* branch names — so both are matched: ids against
   `sent` rows, branches against open lanes. Reading only ids would look like it worked.
   The attended button (`POST /api/tasks/:id/dispatch`) is untouched, like every other
   automation bound. Proven end-to-end in `e2e/tasks.ts` (h10), counter-probe included.

## 5. Knobs

| env | default | |
|---|---|---|
| `FLEET_ANALYSIS_MS` | 60000 | analyst sweep tick; **0 = analyst off**, and then invariant 3 lifts |
| `FLEET_BRIEF_MS` | 0 | the BRIEF COMPILER's own tick, §5a; **0 = compiler off**, the default |
| `FLEET_ANALYSIS_MODEL` | `claude-opus-5` | the interactive tier — the owner's critical look is what is delegated here |
| `FLEET_ANALYSIS_TIMEOUT_MS` | 420000 | its own, not the summarizer's 180 s: this worker reads files for a whole batch |
| `FLEET_ANALYSIS_CMD` | — | subprocess stand-in for harnesses |

Batch cap 6, max 3 attempts, backoff `60s × 2^attempts` **from the last failure** (§3a),
brief compiles 3 at a time. A
harness without a stand-in **must** set `FLEET_ANALYSIS_MS=0` or the suite spawns a real
agent — the same rule `FLEET_AUTO_REVIEW_MS` already carries, and since §5a the same rule
applies to `FLEET_BRIEF_MS`, whose tick exists *only* to run the enhancer.

## 5a. Two tools, two switches

`FLEET_ANALYSIS_MS` used to run two things: the **analyst** (advisory — it reads a row and
files a verdict) and the **brief compiler** (production — what it writes is the prompt a
lane is founded on). The compile step sat inside the analyst's sweep, so switching the
analyst off on 2026-08-08 took the compiler with it: not refuted, just dark, and every lane
started afterwards began from the raw request.

`FLEET_BRIEF_MS` is the compiler's own cadence (`tickBriefSweep`), so four states exist:

| analyst | compiler | |
|---|---|---|
| off | off | the default, and the live deployment — unchanged in every byte |
| off | on | drafts get a compiled brief; **no verdict is written, and the verdict ledger gets no line** |
| on | off | unchanged: the analyst compiles its own batch's briefs, exactly where it always did |
| on | on | both, and one shared busy flag keeps two enhancers off the same row |

The live deployment is the first row, and that is machine-checked rather than re-read:

<!-- pin:watchdog-spawn FLEET_ANALYSIS_MS=0 FLEET_BRIEF_MS=unset -->

Turning the compiler on is an owner act on `watchdog.sh` plus `launchctl kickstart`; this
land ships the capability at its default of off and moves nothing that is running.

Three boundaries, each one a thing the split deliberately does **not** do:

- **The dispatcher gate (invariant 3) still reads `ANALYSIS_ON` alone.** A compiler is not
  a reader: it writes bytes, it never judges a row against the tree it will run on.
- **The compiler writes no reading.** No `t.analysis`, no line on `analysis-verdicts.jsonl`
  — a row it touched is still an unread row, and the queue says so.
- **`reanalyse` still refuses with 409 when the analyst is off.** Its reason names the
  running compiler instead of implying deletion is all that would follow. `↻ refine` remains
  the attended way to a different brief.

Selection is the compiler's own (`briefDue`: a dispatchable `auftrag` with no brief yet),
never `analysisDue` — the compiler's schedule is a property of the *draft* (compiled once,
never again), the analyst's of the *tree*. A failed compile backs off in memory only
(`60s × 2^attempts`, max 3): pacing a worker is not a finding about the work.

## 6. What it deliberately is not

It is **not a safety gate**. It is a reading, and a spend gate on nothing at all. The
safety boundary is still where it was: no tick calls `mergeJob`, so an unattended lane
produces a branch that waits for a human. Do not let the presence of a critical-looking
worker be mistaken for that boundary moving.

## 7. Die Dispatcher-Betriebsreferenz (aus `CLAUDE.md` umgezogen 2026-08-18)

Die Vertrauensgrenzen im Präsens stehen in `CLAUDE.md` §Deploy; hier die Vollreferenz im Original
(kinds, Lane-Deckel, `Task.brief`, Analyse, `FLEET_BRIEF_MS`, ↻ refine, „▸ clarify first"):

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
  `POST /api/dispatch {on:true|false}`; Env: `FLEET_DISPATCH_REPO`, `FLEET_DISPATCH_MAX_LANES=2`, dazu
  seit 2026-08-22 zwei weitere Knöpfe: `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` (`server.ts#DISPATCH_MAX_LANES_PER_PROGRAM`,
  Default = `DISPATCH_MAX_LANES`, ein ZWEITER Lane-Deckel je Program, der nach dem Repo-Deckel geprüft
  wird und darum ausschließlich verengen kann — beim Default kann er nie derjenige sein, der hält) und
  `FLEET_PROGRAM_MAX_RELEASED` (`server.ts#PROGRAM_MAX_RELEASED`, Default 5, Deckel für Pfad (3) oben: freigegebene,
  vom Tick noch nicht gestartete Zeilen je Program)). Er wählt
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
      `Math.min` gegen `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM`; der Repo-Deckel
      `FLEET_DISPATCH_MAX_LANES` steht unverändert darüber und wird zuerst geprüft.
    - **Der Zuschlag wird nur ausgegeben, solange das Program `active` ist**
      (`server.ts#programDispatchGrant`) — die liegengebliebenen `queued`-Zeilen eines
      abgeschlossenen Programs starten nichts.
    - **Alles andere gilt weiter**: der Autos-Master-Stop (`autosOn`, über `canDeliver`), Repo- und
      Program-Deckel, die Analyse, die Kollisionslesung, der Harness-Bolt und der freie Slot. Der
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
  - **(c)** Der Brief entsteht NICHT mehr beim Dispatch: `tickAnalysisSweep` kompiliert ihn einmal pro Entwurf
    und legt ihn als `Task.brief` auf die Zeile — vor dem Start lesbar UND editierbar
    (`POST /api/tasks/:id/brief`; eine Bearbeitung pinnt ihn als `edited` und macht das Urteil stale).
    `briefAndSend` hat seither **keinen Modellaufruf mehr** (`next.brief?.text ?? next.text`) — was geprüft
    wurde, ist damit auch das, was läuft.
  - **(d) Das Eval-Gate ist GESCHICHTE — seit `500ff63` (2026-08-06) gibt es stattdessen eine ANALYSE, und sie
    gated nichts.** Prüfbar statt zu glauben: `tickEvalSweep`, `FLEET_EVAL_MAX_AUTO_PER_DAY`, `evalAuto` und
    die Route `eval-reset` kommen in `server.ts` **null mal** vor. Was es gibt: `tickAnalysisSweep` (Env
    `FLEET_ANALYSIS_CMD` / `FLEET_ANALYSIS_MS`, **0 = aus**; eine Harness ohne Stand-in MUSS
    `FLEET_ANALYSIS_MS=0` setzen, sonst spawnt die Suite einen echten Agenten — `server.ts`, grep
    `FLEET_ANALYSIS_MS=0`) schreibt `Task.analysis` mit dreiwertigem Verdict `ready | needs-you | unknown`
    plus `blockers`/`collides`/`head`/`briefAt`/`attempts`; `unknown` ist die Absenz einer Antwort
    (Worker-Fehler, Backoff 60s×2ⁿ) und darf NIE als eines der beiden Urteile gelesen werden. Der Sweep liest
    `pending` UND `queued` und läuft **unabhängig von `dispatchOn`**. Er ist ADVISORY: die Analyse ist die
    Evidenz, der Promote ist die Entscheidung. Neu urteilen lassen: `POST /api/tasks/:id/reanalyse`. Warum der
    Umbau: das Gate hatte in seiner Lebenszeit genau EIN Verdict erzeugt — seine Population waren die
    un-promoteten Entwürfe des Owners, und seine einzige Macht war, sie hinter seinem Rücken zu starten
    (Messung im Body von `500ff63`). **Seit `e15d672` (2026-08-18, Programm P3) hat der Brief-Kompiler
    einen EIGENEN Schalter `FLEET_BRIEF_MS` (Default 0 = aus):** `FLEET_ANALYSIS_MS=0` schaltet nur noch
    den Analysten ab; ein laufender Kompiler befriedigt das Dispatcher-Gate NICHT und schreibt weder
    `t.analysis` noch eine Zeile auf `analysis-verdicts.jsonl` (das Verdikt-Ledger aus P1, `bee2576`).
    Suiten/fremde Harnesses ohne Stand-in müssen BEIDE Werte 0 setzen. Vertrag: `docs/queue-analyst.md` §5a.
    Owner-Poll trägt `briefCompiler:{on:true}` (bei 0 weggelassen).
  - **(d2) ↻ refine, der Brief-Kompiler** (`POST /api/tasks/:id/refine` async, `…/refine-confirm`
    all-or-nothing; `briefs/task-refine.md`): read-only-Worker, der eine rohe Zeile in 1..N geschnittene
    Kinder mit Done-Kriterium, Verify-Weg und `files` übersetzt — oder mit `unchanged:true` + Begründung
    zurückgibt (Triage-Riegel gegen Aufblähen; hat bei seinem ersten Live-Einsatz korrekt gegriffen).
    Propose/promote wie beim Kriterium: der Lauf fasst den Text der Zeile nie an, erst der Confirm mintet die
    Kinder — **ohne** `brief` und **ohne** `analysis`, denn ein Kind ist ein neuer Entwurf und trifft die
    Analyse frisch.
  - **(e) „▸ clarify first"** (Knopf neben „▸ start lane", `POST /api/tasks/:id/dispatch {clarify:true}`, NUR
    attended — kein Tick übergibt es): derselbe Spawn, aber der Gründungsprompt ist `clarify-prompt.ts` statt
    `runEnhance` (bewusst kein Enhancer: er kompiliert ein Done-Kriterium, und genau das fehlt hier; kein
    `/sharpen3` aus demselben Grund). Der Grund aus `Task.analysis` reist als „prüfen, nicht glauben" mit
    (`buildClarifyBrief(next.text, next.analysis?.reason ?? null, …)`). Die Lane schlägt via
    `POST /api/self/criterion` vor (`confirmedAt:null`), der Owner bestätigt mit eigenem Text
    (`POST /api/tasks/:id/criterion-confirm`) — propose/promote, damit der Produzent nie den Anker schreibt,
    an dem er gemessen wird. Solange sie wartet: `Slot.awaiting="owner"` (persistiert), und
    `handleStewardSend` weist den Slot mit 409 ab. Historie: `docs/attic/autonomy-trial-1.md`,
    `docs/attic/queue-automation.md`.

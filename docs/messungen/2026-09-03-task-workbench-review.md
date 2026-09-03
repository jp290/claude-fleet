---
frage: Erfuellen die vier Task-Workbench-Slices nach dem Land von 15a3e38b die acht Erfolgskriterien des Programs?
urteil: "Vier Kriterien sind erfuellt (b-e), drei bleiben ungeprueft (a, f, g), und eines ist nicht erfuellt (h): clarify-first startet laut Client, Dokumentation und gruenem E2E-Vertrag ausdruecklich eine Lane. Offene P0: keine. Offene P1: dieser Semantikwiderspruch."
bereich: [task-workbench, ux, verify, lane-lifecycle]
belege: [01459c9ef81dfac06dc1a999ac13e7f11c6e1583, 8990fcb7fbda16d8532bac75d07c1faa7893d712, 497873f657c51bd0c069d21d6367e2b2f1b09e18, 71361fa9e3fd59df1789f19ccc71a27964b78754, src/client.ts#qTaskListModel, src/client.ts#qLaneJoins, src/client.ts#qDispatchBody, src/client.ts#qHeadPlan, src/client.ts#renderQueueDetail, src/client.ts#renderQueue, src/client.ts#openQueue, e2e/tasks.ts#run, docs/messungen/2026-09-02-task-workbench-head-fold.md]
nicht-gemessen: Kein eigener authentifizierter Browserlauf mit 0 offenen und 16 geschlossenen Tasks; keine eigene Tastatur- oder Mobile-Interaktion bei 390x844; kein eigener begonnener Text ueber zwei reale 2-s-Refreshes. Die ausgefuehrte Suite prueft diese Flaechen teilweise als Pure-Function- oder Quell-/CSS-Vertrag, nicht als Browser-DOM.
stand: 2026-09-03
---

# Unabhaengiger Review der Task Workbench nach `15a3e38b`

Die Workbench-Abstraktion sollte existieren: Liste, Programmkatalog, Historie und Task-Detail sind
verschiedene Entscheidungen auf derselben Task-Wahrheit und brauchen deshalb getrennte, aber
verbundene Ansichten.

Geprueft wurde der Baum `24f9cfcfa217fb02ce1f3cab77c7124264c55095`. Gelesen wurden der
portable Vertrag, beide vorgegebenen Baselines, die per Graphify gefundene Nachher- und
Falz-Messung, der vorgegebene Pfad-Log sowie die vollstaendigen Diffs der Lands `01459c9`,
`8990fcb` (Task `ff535524`), `497873f` (Task `1b677e58`) und `71361fa` (Task `15a3e38b`).
Die Urteile trennen ausgefuehrte Belege von Ableitungen. Die datierte Falz-Messung wird fuer ihren
exakten Baum und ihre nachweislich unveraenderte Kopfstruktur als Vorbeleg verwendet; neue, hier
nicht gefahrene Browserpfade bleiben ungeprueft.

## Urteil je Kriterium

| Kriterium | Urteil | Beleg und Grenze |
| --- | --- | --- |
| (a) Work zeigt bei 0 offenen und 16 geschlossenen Tasks einen Leerzustand statt geschlossener Zeilen. | **ungeprueft** | Der ausgefuehrte Modellcheck trennt 4 offene von 16 geschlossenen Zeilen, und `src/client.ts#renderQueue` zeigt bei null sichtbaren offenen Zeilen den benannten Leerzustand; die Quellprobe in `e2e/tasks.ts#run` prueft String und fehlende Closed-Gruppe. Kein eigener Renderlauf verband jedoch exakt 0/16 mit dem sichtbaren DOM. |
| (b) Work, Programs und History sind getrennte Ansichten; History erscheint nur auf ausdrueckliche Auswahl oder Suche. | **erfuellt** | `src/client.ts#openQueue` setzt Work als Default und verdrahtet die drei getrennten Views; `src/client.ts#qTaskListModel` gibt History nur getrennt zurueck und setzt `showHistoryInWork` nur bei einer nichtleeren Suche. Die ausgefuehrten Checks `task workbench source: Work is default...` und `History enters Work only...` waren Teil des Runs, dessen terminaler Tail gruen endet. |
| (c) Needs-you, Released, Running und Backlog zeigen jede offene Task genau einmal. | **erfuellt** | `src/client.ts#qGroupOf` liefert fuer jede nicht geschlossene Task genau eine der vier Gruppen oder fuer geschlossene `null`; `src/client.ts#renderQueue` iteriert diese Gruppen einmal. Der ausgefuehrte Fixture-Check `every open task enters exactly one...` ist Teil des gruenen Runs. |
| (d) Das Detail zeigt Status, Program, Repo, Lifecycle und genau eine naechste Hauptaktion ohne Scrollen bei 1440x900. | **erfuellt** | `src/client.ts#qHeadPlan`, `src/client.ts#qMainActionOf` und `src/client.ts#renderQueueDetail` planen und platzieren die Fakten und hoechstens einen Aktionsknoten vor allen Sections. Der aktuelle E2E-Lauf prueft Plan, Reihenfolge und CSS-Falzbudget; die datierte Browsermessung `docs/messungen/2026-09-02-task-workbench-head-fold.md` sah die eine Aktion bei y=274 im 634-px-Pane mit `scrollTop 0`. Geschlossene Zeilen haben absichtlich keine angebotene Aktion, sondern eine begruendete `none`-Entscheidung. |
| (e) Discussion, Brief, Criterion, Evidence und Danger zone bleiben erreichbar, ueberdecken aber nicht die naechste Entscheidung. | **erfuellt** | `src/client.ts#renderQueueDetail` setzt den Kopf zuerst, danach Actions, Overview & discussion, Refinement mit Brief/Criterion, Request, Evidence und die gefaltete Danger zone. Der ausgefuehrte Quellvertrag prueft diese Ordnung; die Falz-Messung bestaetigt die sichtbare Hauptentscheidung. |
| (f) Suche findet Text, ID, Program, Repo und Status; Tastaturfokus und Mobile 390x844 funktionieren. | **ungeprueft** | Die Suche ist durch ausgefuehrte Pure-Function-Fixtures fuer alle fuenf Dimensionen belegt (`src/client.ts#qTaskMatches`). `src/client.ts#openQueue` fokussiert die Suche, und `public/index.html` traegt Focus- und Mobile-Regeln; die Suite nennt diese Checks selbst Quell-/CSS-Vertraege, nicht reale Tastatur- oder DOM-Messungen. Diese beiden Konjunkte wurden hier nicht interaktiv ausgefuehrt. |
| (g) Ein 2-Sekunden-Refresh loescht keinen begonnenen Text und bestehende API-/Autoritaetssemantik bleibt unveraendert (server.ts-Diff in diesen Commits muss leer sein — pruefen). | **ungeprueft** | Die Diffs der vier Lands enthalten jeweils null `server.ts`-Pfade, und der kombinierte Exit ist 0. `src/client.ts#renderQueueDetail` erhaelt Draft-Knoten, Fokus und Caret; der ausgefuehrte Check ist aber nur ein Quellvertrag. Zwei reale Polls ueber begonnenem Text wurden nicht gefahren. |
| (h) Laufende Lanes erscheinen genau einmal an ihrer Task-Zeile; Spawn-Triple ist sichtbar/waehlbar, clarify-first startet keine Lane. | **nicht erfuellt** | `src/client.ts#qLaneJoins` und die ausgefuehrten Fixture-/Live-Poll-Checks belegen die eindeutige Lane-Zuordnung; `src/client.ts#qSpawnRow` plus die Spawn-Matrix belegen die Wahl. Der letzte Konjunkt ist widerlegt: `src/client.ts#qDispatchBody` baut `{clarify:true}`, `src/client.ts#renderQueueDetail` sendet ihn an `dispatch`, und `e2e/tasks.ts#run` erwartet woertlich `(i) clarify start spawns a lane and reports the mode back`. |

## Befunde, nach Kosten

### P1 — `clarify-first` verletzt den woertlichen Programvertrag

`src/client.ts:5936-5948` sagt und implementiert, dass Clarify eine Lane oeffnet;
`src/client.ts:8179-8191` verdrahtet den Button auf den Dispatch-Endpunkt. Der gruen gefahrene
Gegentest in `e2e/tasks.ts:3219-3229` fordert ebenfalls eine neu gespawnte Lane. Das ist kein
unbelegter Verdacht, sondern das derzeit geschuetzte Verhalten.

Kosten: Eine als lane-frei geforderte Klaerung belegt einen Slot, bewegt die Task auf `sent` und
parkt den Slot auf den Owner. Der Owner kann Kapazitaet und Taskzustand daher anders lesen, als das
Erfolgskriterium verspricht. Zugleich verlangt (g) unveraenderte API-Semantik; ohne eine explizite
Entscheidung, welcher Vertrag gelten soll, koennen (g) und der letzte Satz von (h) nicht gemeinsam
als erfuellt gelten.

### P2 — Drei Browserwirkungen haben nur Teilbelege

- (a) verbindet die 16er-History-Fixture nicht mit einem ausgefuehrten 0-offen-Render.
- (f) fuehrt weder Tastaturfokus noch den 390x844-DOM interaktiv aus.
- (g) tippt keinen Text und beobachtet ihn ueber zwei echte 2-s-Polls.

Kosten: Ein DOM-, Fokus-, Overflow- oder Draft-Lifecycle-Regress kann trotz gruenem Pure-/Quelltest
unentdeckt bleiben. Das ist eine Beweisluecke, kein behaupteter Produktdefekt.

## Offene P0/P1

- **P0:** keine.
- **P1:** `clarify-first` startet entgegen (h) eine Lane; Owner-Entscheidung noetig, ob (h) oder die
  in (g) geschuetzte bestehende Dispatch-Semantik gilt.
- **ADJUDIZIERT am 2026-09-03 — dieser P1 ist GESCHLOSSEN, ohne Codeaenderung.** Die geforderte
  Owner-Entscheidung ist gefallen (Attention `cc80f083`): der Widerspruch liegt im Review-BRIEF,
  nicht im Produkt. Begruendung, Belege und Tragweite im Nachtrag am Ende dieser Notiz. Der Befund
  des Reviews bleibt oben stehen, wie er gemessen wurde — er zaehlt ab hier nicht mehr als offener
  P1. **Offene P0/P1 nach Adjudikation: keine.**

## Server-Diff

Wortgetreue Ausgabe der Einzelpruefung:

```text
01459c9 server.ts changed paths: 0
8990fcb server.ts changed paths: 0
497873f server.ts changed paths: 0
71361fa server.ts changed paths: 0
server diff exit: 0
```

## Ausgefuehrte Checks

Der erste `./e2e-isolated.sh`-Lauf erreichte `e2e/tasks.ts` nicht: Vorher fehlte dem Scratch-Tree
die `node_modules`-Quelle. Sein terminaler Tail, woertlich:

```text
 syscall: "lstat",
   errno: -2,
    code: "ENOENT"

      at run (/private/var/folders/sj/sdtvtv7x4j1bxq8ghdpgtr3h0000gn/T/fleet-e2e-instance-54146/e2e/slots.ts:712:30)

Bun v1.3.9 (macOS arm64)
kept test instance for inspection: /var/folders/sj/sdtvtv7x4j1bxq8ghdpgtr3h0000gn/T//fleet-e2e-instance-54146
```

Nach `bun install --frozen-lockfile` lief derselbe Baum vollstaendig. Der gelesene terminale Tail
der Log-Datei `/tmp/fleet-task-workbench-review-e2e-rerun.log`, woertlich:

```text
PASS  trail: rows name the tree under test as a git sha, or null when no repo is resolvable  (tree=24f9cfcfa217fb02ce1f3cab77c7124264c55095 dirty=false)
PASS  trail: a failing check's row keeps its detail, capped at TRAIL_DETAIL_MAX  (len=2012 cap=2000)
PASS  trail: a passing check's row carries no detail  ({"v":1,"run":"isolated-20260903T062530Z-63903","suite":"isolated","tree":"24f9cfcfa217fb02ce1f3cab77c7124264c55095","dirty":false,"check":"x","ok":true,"msSincePrev":5,"ts":1})

ALL PASS
```

`bun e2e/pins.ts` wurde separat ausgefuehrt. Tail, woertlich:

```text
PASS  a remote command job's cmd is allowlisted, and an agent harness is refused whatever the list says — POST /api/self/jobs runs the shared checker and refuses with 400 before a row exists  (checker@398 row@2666)
PASS  a remote command job's cmd is allowlisted, and an agent harness is refused whatever the list says — the daemon runs a command job through runArgv (no sh -c) and never through runCmd  (runArgv=true shCallSites=1)
PASS  the command job's three wire fields stand in HelperJobView, in the claim, and in the daemon's ClaimedJob  (missing view=[] claim=[] daemon=[])
PASS  a command job is offered and claimed only by a daemon that named its own daemonSha  (view=true claim=true)

ALL PASS
```

## Nicht gemessen

Kein eigener authentifizierter Browserlauf, keine neue Pixelaufnahme und keine API-Mutation an der
laufenden Fleet. Insbesondere bleiben der sichtbare 0/16-Leerzustand, echte Tastatur-/Mobile-Nutzung
und der Draft ueber zwei reale Polls ungeprueft. Andere Workbench-Pfade ausserhalb der vier Slices
und ihrer unmittelbar beruehrten Client-/E2E-Symbole wurden nicht bewertet.

---

## Nachtrag: Adjudikation des P1 (Program-MAIN, Owner-Entscheid 2026-09-03)

Dieser Abschnitt ist nicht vom Reviewer. Er wurde von der Program-MAIN „Fleet Task Workbench"
(Slot 2) nach der Owner-Antwort auf Attention `cc80f083` angehaengt. Die Messung oben ist
unveraendert; hier steht nur, wie ihr einziger offener P1 entschieden wurde — dieselbe Form wie bei
einem adjudizierten Post-Land-Audit: **der Befund bleibt der Befund, das Urteil sagt, dass jemand
hingesehen hat.**

**Entscheid: (A) — Brief-Fehler, kein Produktdefekt. Kein Code wurde geaendert.**

### Warum der Satz nicht zu diesem Program gehoert

Der P1 misst gegen ein Kriterium **(h)**, das woertlich so lautet: „Laufende Lanes erscheinen genau
einmal an ihrer Task-Zeile; Spawn-Triple ist sichtbar/waehlbar, clarify-first startet keine Lane."
Dieser Satz stammt aus dem Review-BRIEF der Queue-Zeile `07c061fa`, geschrieben von einer
Vorgaenger-Session. Der achte Satz des owner-bestaetigten Erfolgskriteriums ist ein anderer:
„Vorher-/Nachher-Screenshots, Commit-SHA, woertliche ALL-PASS-Tails und unabhaengiger Codex-Review
ohne offene P0/P1 liegen vor." Der Reviewer hat also korrekt gegen das gemessen, was ihm gegeben
wurde — die Brief-Zeile war falsch, nicht seine Arbeit.

### Dass clarify-first eine Lane oeffnet, ist das SOLL — an vier Stellen belegt

Nachgelesen am Baum `d956daf`, nicht aus dem Review uebernommen:

- `clarify-prompt.ts` — Kopfkommentar nennt die Absicht ausdruecklich: „open the lane anyway, but
  with an explicit instruction to SETTLE the criterion with the owner before writing a line of
  code." Der Brief selbst sagt der Lane „Then STOP and wait."
- `src/client.ts#qDispatchBody` — `▸ clarify first` schickt `{clarify:true}` samt gewaehltem
  Spawn-Tripel an **denselben** Endpunkt `/api/tasks/:id/dispatch` wie `▸ start lane`.
- `server.ts#dispatchTask` — `clarify` legt den Worktree an, setzt die Zeile auf `sent`, schreibt
  die Note `clarify lane <branch> — settling the done-criterion with you` und setzt
  `slot.awaiting = "owner"`. Owner-only per Konstruktion: kein Tick reicht das Flag durch.
- `e2e/tasks.ts` — haelt genau diese Wirkung gruen fest und sagt in seinem eigenen Kommentar, dass
  ein clarify-Start den Status NICHT in Ruhe laesst.

Dazu die Lane-Disziplin im Regelbuch, die es von der anderen Seite bestaetigt: „**Bist du eine
CLARIFY-Lane** (dein Gruendungsprompt sagt ‚settle WHAT DONE MEANS … not to implement it yet')?" —
ein Text, der nur eine Leserin haben kann, naemlich eine Lane.

**Praezisierung zur Begruendung des Entscheids, damit sie nicht falsch weitergetragen wird:** die
Regelbuchzeile „eine Scout-Zeile gehoert ueber `▸ clarify first`, nicht `▸ start lane`" regelt den
WEG einer unscharfen Zeile, nicht die Lane-Freiheit — clarify-first oeffnet sehr wohl eine Lane,
nur eine, die erst das Kriterium klaert und dann stoppt. Der Entscheid haengt daran nicht: das
Verhalten ist an den vier Stellen oben als SOLL belegt.

### Was eine Aenderung gekostet haette

`clarify-first` lane-frei zu machen waere eine Aenderung an `server.ts#dispatchTask`, also an der
Dispatch- und Autoritaetssemantik. Das kollidiert mit dem siebten Erfolgssatz („bestehende API-/
Autoritaetssemantik bleibt unveraendert") und mit dem ersten Non-Goal („Keine Aenderung an
server.ts oder Autoritaetsgrenzen ohne gemessenen Client-Blocker"). Ein gemessener Client-Blocker
existiert nicht. Wollte man die Wirkung dennoch, waere sie eine neue Programmzeile mit eigenem
Kriterium — kein Nachtrag zu diesem Program.

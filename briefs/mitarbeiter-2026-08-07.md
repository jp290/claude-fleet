# Überblick und die Mitarbeiter-Frage — 2026-08-07

*Erdung: `./state.sh` · `./register.sh` · `briefs/work-waves-2026-08-07.md` ·
`git log e89c1bb..HEAD --format=full` · plus ~15 eigene Messungen am Baum `438c326`
und an der Live-Instanz (pid 81145). Kein Code, kein Commit, keine Suite.*

---

## 0 · Über welches Fenster ich rede

Drei, und sie beantworten verschiedene Fragen:

| Fenster | Umfang | beantwortet |
|---|---|---|
| **Ganzes Leben** 2026-07-11 → 08-07 | 27 Tage, 625 Commits | nur hier ist das VERHÄLTNIS lesbar |
| **Seit dem letzten Handoff** `e89c1bb..HEAD` | 3 Commits, heute | die einzigen Bodies, die ich VOLLSTÄNDIG gelesen habe |
| **Der Laufzustand** `fleet.json`, drei Ledger, `ps eww` | kein git-Fenster | das einzige, das sagt, was LÄUFT |

**Ehrlich zur Abdeckung:** 3 Bodies vollständig, ~60 Subjects, der Rest gezielt gegrept.
Ich habe nicht 625 Bodies gelesen und behaupte nicht, es getan zu haben.

Die eine Zahl aus dem großen Fenster: **272 `docs:` · 186 `feat:` · 116 `fix:`.**
Mehr Dokumentations- als Feature-Commits. Das Hauptprodukt dieses Repos sind
aufgeschriebene Befunde — und damit ist sein Hauptrisiko, dass ein Befund schneller
verfällt, als ihn jemand nachprüft. Das ist die tragende Prämisse für Teil 2.

---

## 1 · Woran man von außen erkennt, was die Maschine KANN

Das Repo hat, ohne es je so zu nennen, eine **Beweishierarchie** gebaut. Jede Fähigkeit
lässt sich von außen einsortieren, ohne eine Zeile Prosa zu glauben:

| Grad | Beleg | Messung heute |
|---|---|---|
| **1** | ein e2e-Check | **1430 `check(`** in **36** Modulen (`e2e/*.ts`) |
| **2** | eine Ledger-Zeile | 128 lane-outcomes · 62 post-land-audits · 16 Adjudikationen |
| **3** | eine Live-Env-Variable | `ps eww 81145` — was NICHT dort steht, ist nicht scharf |
| **4** | ein grep-Zähler | `api/deploy` = **0×** · `document.title` = **0×** |
| **5** | ein Satz in `docs/` | **30** offene Marker; `e2e/pins.ts` prüft die prüfbare Teilmenge |

**Die Regel in einem Satz: die Maschine KANN, was eine Zeile oder einen Check hat.
Sie BEHAUPTET, was nur einen Satz hat.** Bemerkenswert ist, dass das Repo diese Grenze
automatisiert hat — `register.sh` druckt „ungeprüft" und „UNBEKANNT" als wörtliche
Urteile statt als Defaults, und `docs/attic/judge-calibration.md` §3 formuliert die
Norm: *„Unknown ≠ zero, everywhere."*

### Was sie belegbar KANN

- **Lanes fahren und landen.** 128 Dispositionen: **99 landed**, 22 killed-empty,
  5 killed-dirty, 2 shelved.
- **Ein Land an einem Verify-Gate mit ZWEI Budgets messen.** Live gemessen am Server-Env:
  `FLEET_VERIFY_TIMEOUT_MS=300000`, `FLEET_VERIFY_WAIT_MS=900000` — der Fix aus `08dc17a`
  ist deployed, das Gate zahlt nicht mehr für die Schlange. 49 Checks in `e2e/verify-queue.ts`.
- **Nach jedem Land die volle Suite fahren und das Rot beurteilen.** 62 Audits, 46 grün /
  16 rot, **16 von 16 Roten adjudiziert** (8 owner, 8 backfill) — Join über `auditAt`,
  nicht `at`. Urteile: 9 unknowable, 4 flake, 2 stale-test, **1 real**.
- **Jede Queue-Zeile mit einem Modell lesen.** 56 offene Lane-Zeilen: 27 ready,
  22 needs-you, 6 unknown, 1 ohne. **Das ist ein diskriminierendes Instrument** — merken
  Sie sich diese Zahl für Teil 2.
- **Die Sicherheitslage per Suite beweisen.** Aus einem echten Audit-Tail: 26 gefährliche
  Owner-Routen × 6 Prinzipale, plus die Kontrolle, dass der Owner auf 25 davon durchkommt.

### Was sie nur BEHAUPTET

- **Deploy als Verb.** `api/deploy` = 0×. Steht als F3 offen.
- **Unbeaufsichtigtes Promoten/Landen.** `tickDispatch` wählt wörtlich `queued`; kein Tick
  ruft `mergeJob`. Das Feld dafür (`releasedBy`, 22× in `server.ts`) ist heute 08:15 gelandet
  und trägt **0 von 128** Ledger-Zeilen. Der Commit-Body sagt das selbst — vorbildlich.
- **Der ② clean-Reviewer.** Code da, `FLEET_CLEAN_REVIEW=off` live, 0× `would_stop` in 23 Zeilen.
- **Das Kriterien-Instrument.** `POST /api/self/criterion` + `criterion-confirm` sind gebaut
  und deployed. **1 bestätigtes Kriterium über alle 128 Zeilen.**
- **36 Briefs**, alle wörtlich `ungeprüft`.

### Und drei Stellen, an denen die Hierarchie selbst lügt

**(a) `state.sh` meldet den Live-Server als Fremdkörper, wenn eine Lane ihn fährt.**
`state.sh:56-58` vergleicht die cwd des Servers mit `$PWD`. Aus einem Lane-Worktree
gefahren druckt es *„stray pid 81145 … not the fleet"*. Gemessen: 81145 IST der
srv-Pane-Prozess (`tmux -L claudefleet list-panes -t srv` → `81145 bun`), gestartet
Fr 07.08. 09:31:31, also NACH `438c326` (08:50:15) — kein Deploy-Gap. CLAUDE.md weist
jede Lane an, `./state.sh` zu fahren. Der Zustandssensor sagt der Lane also das Gegenteil
des Zustands, und die „deploy gap"-Zeile darunter hat dann keinen Anker.

**(b) Die Kollisionsbehauptung überzeichnet ihr Instrument.** `src/client.ts:5541` rendert
*„touches the same files as: …"*, `server.ts:2559` schreibt *„same files, says the analyst"*.
Aber `buildAnalysisPrompt` bekommt `AnalysisTask {id, source, text, brief}` und
`AnalysisLane {branch, task}` (`analysis-prompt.ts:32-41`) — **auf keiner Seite eine
Dateiliste**. Der Analyst rät Dateien aus Prosa. Der Wert-Review vom 06./07.08. fand das
bei `2158-2161`/`2399`; ich habe es am HEAD bei `243`/`2559`/`5541` wiedergefunden — der
Befund hat überlebt, die Zeilennummern nicht.

**(c) `register.sh` §2 kollabiert genau oben.** 39 von 56 Lane-Zeilen nennen `server.ts`.
Das Skript beschriftet das selbst als *„named by most rows, weak evidence"* — und druckt
danach 39 `BUSY … overlaps live lane … on server.ts`. Für die Mehrheitszeile ist die
Antwort unbrauchbar, und die Ausgabe unterscheidet das nicht von einem echten Konflikt.

### Ein Live-Defekt, gefunden beim Nachmessen — noch in keinem Register

**Eine fehlgeschlagene Re-Analyse LÖSCHT das Urteil, das sie ersetzen sollte.**

Mechanismus, im Code verankert:
- `analysisDue` (`server.ts:2244-2252`) wählt eine Zeile mit *veraltetem* Verdict neu aus
  (`analysisStale` — der Baum hat sich bewegt).
- Scheitert der Worker, schreibt `unknown()` (`server.ts:2278-2287`) `t.analysis` für
  **jede** Zeile des Batches neu — ohne das vorherige Urteil zu bewahren. Übernommen wird
  nur `attempts`. Der `reason`, den der Owner auf der Row liest, ist weg.
- Nach `ANALYSIS_MAX_ATTEMPTS = 3` hört die Zeile auf, es zu versuchen, und bleibt
  dauerhaft `unknown`, bis jemand `reanalyse` drückt.

Live passiert, heute, während dieser Sitzung:
- `./register.sh` um ~09:33 zeigte `b3a81fd0 4d7aba33 f6e085d5 6ebb4c85` als
  `needs-you(53m)!head` und `6b9f77d0 54560617` als `ready(53m)!head` — ein Batch, alle sechs stale.
- `fleet.json` (mtime 09:41:32) trägt für dieselben sechs
  `verdict:"unknown", reason:"analyst failed: analyst returned no JSON", attempts:1`.
- **Vier begründete `needs-you` und zwei `ready` sind zu einer Absenz geworden.** Batch-Cap
  ist 6 — es war genau ein Batch.

Verschärfend: der Code-Kommentar bei `2266` sagt selbst *„Every land moves the tip and makes
every verdict stale at once"*, und der Sweep sortiert **released rows first** — die Zeilen,
die als nächstes laufen sollen, gehen als erste in dieses Risiko.

`register.sh` druckt die richtige Warnung (*„'unknown' is the analyst failing to answer,
which is an absence and never one of the two judgements"*) — und niemand hat bemerkt, dass
die Absenz ein Urteil ÜBERSCHREIBT. Das ist kein Lesefehler mehr, das ist Informationsverlust.

**Nachtrag 11:33:** der Backoff-Retry hat das Register um ~11:00 selbst geheilt — alle sechs
Zeilen tragen wieder Urteile, frisch gegen `438c326`. Das Fenster war ~80 Minuten blind, und
`b3a81fd0` kam als `ready` zurück, wo vorher `needs-you` stand: der Flip ist legitim (der Baum
hatte sich bewegt), aber **nirgends verzeichnet** — die Zeile trägt keine Urteils-Historie.
Der Defekt bleibt exakt der beschriebene; nur die Dringlichkeit sinkt von „sechs Zeilen
betroffen" auf „das nächste Worker-Husten blendet wieder einen ganzen Batch aus".

**Warum das hierher gehört:** ich habe es nicht gefunden, indem ich Code gelesen habe. Ich
habe es gefunden, indem ich die Ausgabe eines Instruments gegen den Zustand eines zweiten
gehalten habe, zehn Minuten später. Das ist exakt die Arbeit, um die es in Teil 2 geht.

---

## 2 · Der Mitarbeiter — und was ihn vom Richter unterscheidet

### Zuerst: warum K2 nichts geliefert hat

Die Diagnose in `docs/attic/judge-calibration.md` ist präzise und lautet **nicht**
„Modelle urteilen schlecht". Vier strukturelle Eigenschaften:

1. **Binäre Ausgabe auf ein seltenes Ereignis.** Der interessante Wert (`review`) war selten
   erwartet — also ist Schweigen von einem kaputten Instrument nicht zu unterscheiden.
   Wörtlich: *„A judge stuck at `pass` and a judge correctly seeing nothing wrong write
   byte-identical ledgers."*
2. **Kein Gegenstück.** Niemand sonst beantwortete dieselbe Frage. Es konnte nie widersprechen.
3. **Kein abhängiger Leser.** Shadow-Modus — sein Ausfall wäre niemandem aufgefallen.
4. **Praktisch nicht drillbar.** Feuerprobe #3 lieferte zweimal `rawAnswer: ""` — die
   Fehlerform hat die Kalibrierung aufgefressen.

### Die naive Fassung des Mitarbeiters hat DENSELBEN Defekt

Das muss zuerst gesagt werden, sonst ist der Rest Werbung. Ein Modell, dem man 10 Zeilen
vorlegt und sagt „finde die Lücke", **findet immer eine**. K2 sagte immer `pass`; der
Mitarbeiter sagte immer „hier ist eine Lücke". Beides ist eine konstante Ausgabe, und eine
konstante Ausgabe trägt null Bit. Prosa statt Verdict ist kein Unterschied — es ist derselbe
Defekt in einem Kostüm, das schwerer zu widerlegen ist.

Der Unterschied kann also nicht in der AUSGABEFORM liegen. Er muss darin liegen, dass die
Ausgabe **billig und von jemand anderem als ihm selbst am Baum widerlegbar** ist.

### Was diesen Vorschlag tatsächlich anders macht

**Die Arbeit ist bereits einmal gelaufen und ihr Ertrag liegt gezählt auf Platte.**
`briefs/work-waves-2026-08-07.md` IST dieser Job, von Hand, durch eine Session in Slot 2
gegen 66 offene Zeilen. Sein §5 sind sieben Korrekturen. Drei davon habe ich unabhängig
am HEAD nachgeprüft:

- Kollisionscheck sieht keine Dateien → **bestätigt** (oben, (b)).
- `kind: lane→note` hat keine Route → **bestätigt**: `kind` wird in `server.ts` an vier
  Stellen gesetzt, drei davon erzeugen (`6682`, `9722`, `9848`), genau eine weist einer
  bestehenden Zeile zu (`9972`, `adopt`, note→lane). Einbahnstraße.
- `api/deploy` = 0× → **bestätigt**.

**Der Unterschied zu K2 in einem Satz: K2 wurde gebaut und dann gemessen, dass es nichts
geliefert hat. Beim Mitarbeiter ist der Ertrag der Arbeit gemessen, BEVOR etwas gebaut ist.
Die Reihenfolge ist umgedreht.**

**Und das Loch in diesem Argument, benannt:** N = 1, und der Lauf war eine volle interaktive
Session mit dem Owner in der Schleife — kein geplanter Worker. Gemessen ist, dass die
ARBEIT produktiv ist, nicht dass eine automatisierte Fassung davon es ist. Genau so
unterschied sich Drill #3 von der Produktion.

**Zweiter echter Unterschied, und er ist messbar:** `↻ refine` — der einzige propose/promote-
Worker, der schon lief — hat **6 Vorschläge insgesamt: 4 × `unchanged:true`, 2 echte.**
Ein Worker, der zu zwei Dritteln „hier ist nichts" sagt und es bewiesen hat. ② war per
Prompt *„explicitly false-flag-averse"* — also war „nichts" der DEFAULT statt einer
verdienten Antwort. Der Triage-Riegel ist die Anti-K2-Vorrichtung, und sie existiert bereits.

---

### Frage 1 — Woran misst man INFORMATION statt Fleiß?

Nicht an der Zahl der Befunde. Drei Maße, mechanisch, absteigend nach Härte:

**(1) Widerspruchsrate gegen ein zweites Instrument. ← das ist das Maß.**
Jede Ausgabe muss Zeilen und `file:line` nennen. Dann: wie oft widerspricht sie
`register.sh` §2 ([grob], Dateiebene) oder dem `collides` des Analysten ([modell])?
`register.sh` hat die Metrik schon selbst aufgeschrieben: *„where it disagrees with the
file listing above, THAT is the information."* Ein Lauf ohne einen einzigen Widerspruch
hat nichts hinzugefügt, was ein Skript nicht schon druckt — **das ist die K2-Signatur,
und sie ist nach EINEM Lauf sichtbar, nicht nach 45.**

**(2) Überlebensrate seiner Behauptungen.** Jede Behauptung ist ein `file:line` oder ein
grep-Zähler. Dieselben greps 7 Tage später neu fahren — der L1-Rot-Detektor tut das für
Docs bereits. Wessen Behauptungen schneller verfallen als die des Regals, produziert
plausible Prosa. (Kleines Beispiel: die Zeile `21c6eb4b` sagt „751 rohe Hexwerte"; mein
grep über `index.html` + `client.ts` gibt heute 763. Ich habe ihr Kommando nicht
reproduziert — das ist eine Abweichung zum Nachprüfen, keine Korrektur.)

**(3) Owner-Handlungsquote.** Wie viele Vorschläge wurden ein Owner-Akt (Kommentar,
Promote, Archiv, criterion-confirm)? `audit()` protokolliert die bereits mit Akteur.
**Das ist das schwächste der drei** und muss als solches benannt werden — es misst
Zustimmung, nicht Wahrheit.

**Die Abbruchregel, VOR dem ersten Lauf versiegelt** — genau das, was bei K2 fehlte:
*Zwei aufeinanderfolgende Läufe mit null Widersprüchen gegen `register.sh` und null
Owner-Akten → abgeschaltet.* Versiegeln vor dem Lauf ist Regel 1 der Feuerprobe-Prozedur.

---

### Frage 2 — Darf er revidieren?

**Ja — aber nur vorschlagend, und nie auf der Zeile selbst.** Das Repo hat diese Frage
bereits dreimal gleich beantwortet:

- `↻ refine` (`server.ts:9795ff`): read-only. Eigener Kommentar: *„The task itself is never
  rewritten by the worker; only the owner's confirm mints anything."* Confirm ist
  all-or-nothing; Kinder landen als `pending`, nie `queued`, und **ohne** `brief`, **ohne**
  `analysis` — ein Kind ist ein neuer Entwurf.
- `POST /api/self/criterion`: die Lane schlägt vor (`confirmedAt:null`) und kann ein
  bestätigtes nie überschreiben (409). *„confirming makes the criterion THEIRS, which is
  the whole reason a lane may draft one."*
- `adopt`: eine Umwandlung, die der **Owner** ausführt — Invariante 5 der
  `queue-analyst.md`: *„which is what keeps the steward from ever authoring runnable work."*

**Drei harte Grenzen, die daraus folgen:**

**(a) Er darf KEINEN Kommentar schreiben.** `server.ts:9886` sagt in seinem eigenen
Kommentar: *„A COMMENT — the one text on this row the OWNER writes. Every other text here
is machine output."* Heute: 24 Kommentare auf 15 offenen Zeilen, alle vom Owner. Schreibt
der Mitarbeiter dorthin, verliert der Owner das einzige Feld einer Row, das ihm gehört.
Das ist eine gemessene Grenze, kein Geschmack.

**(b) Eine Revision muss entwerten, was gegen den alten Text geurteilt wurde.** Die
Brief-Route tut das schon (`edited:true` pinnt und macht die Analyse stale). Sonst entsteht
ein Verdict über einen Text, den es nicht mehr gibt — exakt der Defekt des Eval-Gates
(`analysis-prompt.ts:22-28`).

**(c) Höchstens EINE strukturelle Änderung pro Lauf.** Ein Refine fasst eine Zeile an; ein
Mitarbeiter, der zehn als Menge revidiert, macht den all-or-nothing-Confirm entweder
unbenutzbar groß oder zur Lüge. Er schlägt also vor: *„diese drei sind eine"*, oder
*„diese eine sind drei"*, oder *„diese vier warten auf eine Vorbedingung, die keine
von ihnen nennt"* — nie eine Stapelumschrift.

---

### Frage 3 — Eigener Agent oder Prompt auf dem Analysten?

**Eigener Worker — aber modelliert nach `refine`, nicht nach dem Analysten.** Vier gemessene
Gründe, warum der Analyst es nicht sein kann:

1. Sein Prompt sagt wörtlich: *„Judge each task on its own merits. `collides` is the one
   cross-cutting field."* (`analysis-prompt.ts:66`). Die Querlesung ist per Kontrakt
   ausgeschlossen.
2. `ANALYSIS_BATCH_CAP = 6`. Die Queue hat 56 offene Lane-Zeilen. Eine Querlesung von 10
   passt nicht in einen Batch von 6, und das Batching ist nicht beiläufig — es ist, was den
   420-s-Timeout überlebbar macht.
3. Sein Verdict wird von `tickDispatch` (Invariante 6) KONSUMIERT. Eine Quer-Erzählung in
   denselben Worker zu legen, koppelt genau das wieder, was die Trennung vom 2026-08-05
   aufgelöst hat.
4. **Und der entscheidende:** heute, 09:41, hat ein einziger Worker-Fehler sechs Urteile
   gelöscht. Diesen Worker mit einer zweiten Aufgabe zu beladen, vergrößert die Fläche
   genau des Ausfalls, der gerade live zugeschlagen hat.

`refine` dagegen ist bereits alles, was gebraucht wird: attended-only (kein Tick ruft es),
async, read-only, Vorschlag auf der Row, all-or-nothing-Confirm, und mit `unchanged:true`
plus Begründung als geübtem Ausweg (4 von 6).

**Zur Zweiteilung UI / Backend:** die Naht ist gemessen und echt — 29 offene Zeilen nennen
`src/client.ts` (+ 12 `public/index.html`), 39 nennen `server.ts`, und Welle 7 ist aus
genau diesem Grund streng seriell. Zwei Spezialisten sind gerechtfertigt, weil sich ihre
Beweisbasen nicht überschneiden: der eine liest gerenderte Fläche + `client.ts`, der andere
`server.ts` + die Ledger. **Eine Warnung dazu:** der größte Fund des Wellen-Laufs (die
Kollisionsbehauptung) sitzt in der NAHT — `server.ts` + `analysis-prompt.ts` + das
Rendering in `client.ts`. Eine strikte Zweiteilung hätte ihn keinem von beiden gegeben.
Die Linse ist die STARTMENGE an Zeilen, nie eine Mauer um die Belege.

---

## 3 · Empfehlung

**Den Agenten heute noch nicht bauen. Erst das Maß und einen zweiten Lauf von Hand.**

Nicht aus Vorsicht, sondern weil es hier billiger ist als bei K2 — und weil es genau die
Prozedur ist, mit der dieses Repo das Eval-Gate erledigt hat (erst die Population messen:
1 Verdict je, 0 positive):

1. **Den zweiten Lauf gleich fahren wie den ersten**, mit der UI-Linse (der erste war
   queue-weit). **Vorher** das Maß versiegeln: wie viele Widersprüche gegen `register.sh` §2,
   und welche Behauptungen in 7 Tagen nachgegrept werden.
2. **Erst wenn Lauf 2 mindestens einmal widerspricht**, die Route bauen — als
   `refine`-Zwilling: attended-only, Zeilenmenge + Linse rein, raus genau eines von
   *benannte Lücke mit `file:line`* · *≤1 struktureller Vorschlag in propose/promote-Form* ·
   *`unchanged:true` mit Begründung*. Kein Tick, keine Verdrahtung an Dispatch.
3. **Der Drill ist hier billig** — anders als bei ②. Dessen Feuerprobe brauchte einen
   komponierten Worktree und starb zweimal an der Harness. Der Mitarbeiter urteilt über
   DATEN: zehn Zeilen mit einer bekannten, gesiegelten Quer-Lücke in einer Scratch-Instanz,
   fertig. Die Norm gilt (`judge-calibration.md`, 2026-07-25): *no judging instance gets
   even display-trust before a seeded-defect test.*

Zwei Läufe von Hand kosten zwei Sessions und liefern die Zahl, die den Bau entscheidet.
Ein gebauter Agent kostet Route, Prompt-Datei, e2e-Checks — und auf dem K2-Präzedenzfall
45 Zeilen, bevor jemand merkt, dass er nichts sagt.

---

## 4 · Was sofort ansteht, unabhängig von der Entscheidung

- **Der Analyse-Sweep überschreibt Urteile mit Absenzen** (§1, Live-Fenster 09:41–~11:00).
  Der Fix ist klein und die Richtung ist im Repo schon entschieden: ein `unknown` darf ein
  bestehendes Verdict nur ERGÄNZEN (als Fehlschlagsnotiz + `attempts`), nicht ersetzen —
  `Unknown ≠ zero`. → Zeile R1 in §5.
- **`state.sh` meldet aus einer Lane den Live-Server als „stray"** (§1a). Ein Vergleich
  gegen das Repo-Toplevel statt gegen `$PWD` genügt. → Zeile R2 in §5.
- Der `register.sh`-§2-Kollaps auf `server.ts` (39× BUSY) bekommt **bewusst keine eigene
  Zeile**: er ist ein Symptom der fehlenden Dateiwahrheit und wird von Weg (a) —
  `9e0fdc3b` (`files` als Feld) und `5aafbee4` (Kollisions-Sicht) — aufgelöst.

---

## 5 · Die drei Zeilen, fertig zum Filen (DONE + VERIFY im Text)

**R1 — Sweep-Fix** (Fläche `server.ts`; NICHT neben `fleet/260807025408-c8f3` starten,
dessen Diff `analysis-prompt.ts` + `server.ts` trägt):

> Der Analyse-Sweep überschreibt ein stehendes Urteil mit einer Absenz. `unknown()` in
> `tickAnalysisSweep` (`server.ts:2278-2287`) schreibt bei einem Worker-Fehlschlag
> `t.analysis` für JEDE Zeile des Batches neu — verdict/reason/blockers/collides des letzten
> Urteils sind weg, nur `attempts` überlebt. Live gemessen 07.08.: um 09:41 verlor ein
> 6er-Batch vier `needs-you` und zwei `ready` an `unknown (analyst returned no JSON)`;
> ~80 min später heilte der Backoff-Retry das Register, aber das Fenster war blind und der
> Verdict-Flip (`b3a81fd0` needs-you→ready) ist nirgends verzeichnet. Nach 3 Fehlversuchen
> bliebe die Zeile dauerhaft `unknown` bis zum Hand-`reanalyse`. Beleg:
> `briefs/mitarbeiter-2026-08-07.md` §1. DONE: ein Worker-Fehlschlag lässt das letzte Urteil
> auf der Zeile stehen (weiter als stale/retry behandelt) und vermerkt den Fehlschlag
> daneben (`attempts` + Fehlgrund); UI/`register.sh` zeigen „Urteil X, Re-Analyse scheitert
> seit N Versuchen" statt einer Absenz. VERIFY: neuer Check in `e2e/tasks.ts` — Zeile mit
> stehendem Verdict, dann `FLEET_ANALYSIS_CMD` auf Fehlschlag gestellt: das Urteil bleibt
> lesbar, `attempts` steigt; Gate-Suiten grün.

**R2 — state.sh-Fix** (Fläche `state.sh`; shell-only, keine Suite):

> `state.sh` erkennt den Live-Server nur aus dem Haupt-Checkout: Zeile 56-58 vergleicht die
> Server-cwd mit `$PWD` — aus jeder Lane heißt der echte srv „stray pid … not the fleet",
> und die deploy-gap-Zeile darunter hat keinen Anker. Gemessen 07.08. aus Lane
> `denk-mitarbeiter` (pid des srv-Pane-Prozesses als „stray" gemeldet), Beleg:
> `briefs/mitarbeiter-2026-08-07.md` §1a. CLAUDE.md weist jede Lane an, `./state.sh` zu
> fahren — der Sensor sagt der Lane das Gegenteil des Zustands. DONE: der Vergleich läuft
> gegen den kanonischen Haupt-Checkout-Pfad (realpath), aus einem Worktree gefahren druckt
> `state.sh` dieselbe LIVE-Zeile wie aus dem Haupt-Checkout. VERIFY: `./state.sh` einmal aus
> dem Haupt-Checkout, einmal aus einem Worktree — beide zeigen LIVE + up-since für dieselbe
> pid; keine Suite nötig.

**R3 — Mitarbeiter Lauf 2, UI-Linse, von Hand** (read-only, keine Dateien, kein Mutex):

> Mitarbeiter Lauf 2 (UI-Linse), von Hand — VOR jedem Agent-Bau
> (`briefs/mitarbeiter-2026-08-07.md` §3). Das Maß ist mit dieser Zeile versiegelt:
> (1) Widersprüche gegen `register.sh` §2 bzw. das `collides` des Analysten, jede mit
> file:line; (2) Überleben der eigenen Behauptungen nach 7 Tagen — die greps liegen dem
> Report bei; (3) Owner-Akte auf Vorschläge. Abbruchregel: zwei Läufe in Folge mit
> 0 Widersprüchen und 0 Owner-Akten → der Mitarbeiter wird nicht gebaut. DONE:
> `briefs/mitarbeiter-lauf2-<datum>.md` liest ≥10 offene UI-Zeilen quer
> (`src/client.ts`/`public/index.html`-Fläche), jede Behauptung als file:line oder
> grep-Zähler, und liefert EINE benannte Lücke oder EINEN strukturellen Vorschlag in
> propose/promote-Form — oder die begründete Null (die zählt als Strike 1 der
> Abbruchregel). Read-only, kein Code, kein Commit außer dem Report. VERIFY: die greps des
> Reports sind am Baum reproduzierbar; das Dokument ist committet.

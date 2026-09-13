# Queue-Wellen — wie die Queue heute bearbeitet wird, und was eine Wellenzusammenlegung wirklich spart

Stand: 2026-09-06, gemessen aus einer Lane gegen `server.ts` (Working Tree), `fleet.json`,
`post-land-audits.jsonl` (500 Zeilen), `lane-outcomes.jsonl` (808 Zeilen) und 466 `fleet/land`-Notes
des Haupt-Checkouts. Schwesterdokument des Denkauftrags „robuster Merge-Prozess" (Zeile `187aa1a0`).
Kein Code, keine Zeile geändert.

**Urteil in einem Satz:** Die Wellenzusammenlegung ist der richtige Hebel — aber nicht dort, wo das
Repo heute Wellen rechnet. `task-waves.ts` faltet die Queue zu PARALLELEN Lanes (Zeilen ohne
gemeinsame Datei); die Zeit liegt in den LANDS (74,7 h Audit-Wanduhr in 14 Tagen, 236 von 251 Audits
über genau EIN Land). Eine Landewelle ist die umgekehrte Faltung derselben Kollisionsdaten, und sie
ist heute nicht berechenbar, weil 0 von 31 offenen `auftrag`-Zeilen eine bestätigte Fläche tragen.

---

## 1. IST — wie die Queue bearbeitet wird (am Code gelesen)

### 1.1 Der Tick

`server.ts#tickDispatch` (alle 8 s, `FLEET_DISPATCH_TICK_MS`) nimmt als Kandidaten
**ausschließlich** `kind === "auftrag" && status === "queued"`, sortiert nach nichts — die Liste ist
die Reihenfolge in `tasks`, faktisch oldest-first nach `createdAt`. Es gibt **kein Prioritätsfeld
und keine Bewertung**. Je Zeile, in dieser Reihenfolge:

| Tor | Wirkung bei Nichterfüllung | Reichweite |
|---|---|---|
| Master-Stop / Program-Grant (`programDispatchOn`) | `continue` | Zeile |
| Repo-Deckel `FLEET_DISPATCH_MAX_LANES` | `continue` + Wartenotiz | Zeile |
| Program-Deckel (`programDispatchCap`, nur enger) | `continue` + Wartenotiz | Zeile |
| Harness automatisierbar (`harnessAutomatableFor`) | `continue` + Wartenotiz | Zeile |
| **freier Slot** | `return` | **Maschine** |
| Analyse frisch + Kollisionslesung | `return` / `continue` | siehe unten |
| Quiet Hours (`canDeliver`) | `continue` (waivable) | Zeile |

Dann genau **eine** Lane pro Tick (`return` nach `dispatchTask`).

**Der Kollisionsgate ist im Betrieb tot.** Er steht komplett innerhalb von `if (ANALYSIS_ON)`, und
`ANALYSIS_ON = ANALYSIS_TICK_MS > 0` (`server.ts:8197-8200`) — der Live-Server startet mit
`FLEET_ANALYSIS_MS=0` (`watchdog.sh:155`). Der einzige Schutz gegen zwei kollidierende Lanes ist
also heute die Zahl `FLEET_DISPATCH_MAX_LANES=2` (ebenfalls `watchdog.sh:155`), die von Dateien
nichts weiß. Das ist kein Defekt, sondern eine bewusste Deckelung — aber jede Aussage über „die
Kollisionslesung entscheidet" ist für den laufenden Betrieb falsch.

**Was nie startet:** 124 `notiz`-Zeilen und 2 `richtung`-Zeilen sind per Filter nicht dispatchbar,
28 `auftrag`-Zeilen stehen auf `pending` (warten auf Owner- oder MAIN-Freigabe), 3 auf `queued`,
3 laufen (`sent`). Zahlen aus `fleet.json`, 2026-09-06 11:42.

### 1.2 Der Wellen-Projektor, den es schon gibt

`task-waves.ts` (gelandet als `4a0fb98`, konsumiert in `src/client.ts#qWaveProjection`, geprüft in
`e2e/tasks.ts`) ist eine deterministische, read-only Projektion: sie gruppiert `queued`-Zeilen je
Repo in Wellen, in denen **keine zwei Zeilen eine Datei teilen** (`task-waves.ts#pairConflicts`),
begrenzt auf `maxLanes` je Welle. Der Anspruch steht wörtlich im Typ: `claim: "no-known-collision"`.

Das ist die Frage *„welche Zeilen dürfen GLEICHZEITIG in getrennten Lanes laufen"*. Der Owner hat
die andere gestellt: *„welche Zeilen dürfen ZUSAMMEN in einer Lane landen"*. Über demselben
Kollisionsgraphen sind das entgegengesetzte Faltungen — die eine sucht unabhängige Mengen, die
andere Zusammenhangskomponenten. Die IST-Behauptung des Auftrags („die Rohdaten für Wellen
existieren, niemand faltet sie") ist damit zur Hälfte zu korrigieren: sie werden gefaltet, nur in
die andere Richtung, und das Ergebnis steht als Ansicht auf dem Board, nicht auf dem Land-Pfad.

### 1.3 Was ein Land kostet — gemessen

Aus 466 `fleet/land`-Notes (462 mit `verify`-Objekt) und `post-land-audits.jsonl`:

| Größe | n | Median | p90 | Max |
|---|---|---|---|---|
| Gate-ARBEIT, volle Kette (`verify.ms`, `proportional≠true`) | 321 | **106 s** | 1 238 s | 2 704 s |
| Gate-ARBEIT, Docs-Kurzkette (`proportional:true`) | 55 | **0,74 s** | — | 1,36 s |
| Gate-WARTEN am Suite-Mutex (`verify.waitMs`) | 321 | 0 s | **1 137 s** | 2 669 s |
| Post-Land-Audit, echte Verdikte (green/red), alle | 398 | 997 s | 1 634 s | — |
| Post-Land-Audit, echte Verdikte, letzte 14 Tage | — | **1 484 s** | 1 876 s | — |
| Post-Land-Audit, Docs-Kurzkette | 6 | **1,0–2,1 s** | — | — |

Summen: Gate-Arbeit über alle Notes 30,2 h, Gate-Warten 21,1 h (8,9 h allein in den letzten
7 Tagen über 109 Lands). **Audit-Wanduhr letzte 14 Tage: 74,7 h** über 251 Läufe — 5,3 h pro Tag
auf demselben Maschinen-Mutex, den jedes Land-Gate dreimal gewinnen muss.

Die Verdikt-Mischung der letzten 14 Tage: 76 green, 92 red, 83 unknown. Der teuerste Sensor des
Hauses liefert in 70 % der Fälle kein Grün — das ist der Kontext, in dem „ein Rot nennt n Zeilen"
als Wellen-Kosten zu lesen ist.

### 1.4 Warum Koaleszenz heute fast nichts einbringt

Der Audit koalesziert bereits (`server.ts#drainPostLandAudits`: ein Eintrag je Repo, `covers`
wächst, solange der Lauf läuft). Gemessen: **484 von 500 Audits decken genau EIN Land**, 13 decken
zwei, 3 decken drei — 519 Lands auf 500 Audits, Faktor 1,04.

Der Grund ist Arithmetik, kein Fehler: der Median-Abstand zweier Lands ist **2 698 s (45 min)**,
länger als ein Audit dauert (24,7 min Median in den letzten 14 Tagen). Nur 19 % der Lands treffen
innerhalb von 15 min auf ihren Vorgänger. **Warten hilft also nicht — nur weniger Lands helfen.**
Genau das ist eine Welle.

### 1.5 Der Merge-Resolver ist nicht der Engpass

`lane-outcomes.jsonl`, 777 Lanes mit Disposition: `resolvedConflict:true` in **10** (1,3 %),
`repairRounds` in **allen 777** gleich 0. Der Resolver ruft `server.ts#runWorker` ohne eigenes
`model`, erbt also `SUMMARY_MODEL` (`server.ts:9470`); `.env` setzt seit 2026-09-06 06:15
`FLEET_SUMMARY_MODEL='claude-opus-5[1m]'` — wirksam ab dem nächsten Serverstart (Deploy `8b59b434`
ist eine Deploy-Id, kein Commit). Der Sensor `84cf7335` (queued) misst den Resolver erst. Die Modellfrage am Resolver betrifft damit nach heutiger
Datenlage 1,3 % der Lanes — sie ist eine Robustheitsfrage (Schwesterzeile `187aa1a0`), aber
**keine Zeitfrage der Queue**. Wer Zeit sucht, sucht sie im Audit.

Dispositionen gesamt: landed 563 (72 %), killed-empty 159, killed-dirty 33, shelved 22, ohne
Disposition 31.

---

## 2. Drei Wellen-Regeln (prüfbare Sätze)

### R1 — Klassenreinheit: eine Welle ist ganz Docs oder ganz Code, nie gemischt

`server.ts#entryRunsShortChain` verlangt `covers.every(c => c.proportional === true)`. **Ein
einziges Code-File in einer Welle setzt den ganzen Tip auf die volle Suite zurück** — und das ist
richtig, denn der Audit misst den BAUM. Die Kosten der Verletzung sind gemessen: Docs-Land 0,74 s
Gate + ~2 s Audit; dieselbe Welle mit einem Code-File 106 s Gate + 1 484 s Audit. Faktor ~750.

*Falsifiziert durch:* eine Welle mit mindestens einer nach `verify-proportion.ts#verificationProportionFor`
nicht-`proportional`en Datei, deren Land-Note trotzdem `verify.proportional:true` trägt.

### R2 — Wer das Gate ändert, landet allein

Zeilen, deren Fläche nach `verify-proportion.ts#ruleFor` als `e2e-or-merge-land` klassifiziert
(`e2e/`, `e2e-*.sh`, `fleet-e2e*.ts`, `merge-prompt.ts`, `clarify-prompt.ts`) — also
`isolatedPreview === true` — bekommen Wellengröße 1. Grund: die Welle würde von genau dem Gate
verifiziert, das sie verändert, und ein Rot ließe sich zwischen „die Änderung ist falsch" und „die
Änderung hat das Messinstrument verschoben" nicht mehr trennen. Dieselbe Trennung, die
`docs/verify-tiering.md` §11.7 für den Flake-Beweis verlangt.

*Falsifiziert durch:* ein Wellen-Kandidat mit n>1, in dem eine Zeile die Gate-Apparatur anfasst.

**Nachtrag 2026-09-12 — R2 hat seitdem ein EIGENES Prädikat, `task-land-waves.ts#isGateMachinery`.**
Die Fassung oben lieh sich `isolatedPreview === true`, und das ist die Antwort auf eine andere
Frage: `verify-proportion.ts` empfiehlt damit einen isolierten VORSCHAULAUF, und die Empfehlung gilt
für jeden Pfad unter `e2e/` — zu Recht, ein neues Check-Modul verdient eine Tier-2-Vorschau. R2
fragt dagegen, ob die Zeile das MESSINSTRUMENT verschiebt. Gemessen an den 42 offenen
`auftrag`-Zeilen (Baum `edbc153a`, `bun task-land-waves.ts --state fleet.json`): 18 Flächen nennen
`e2e/pins.ts`, 17 `e2e-isolated.sh`, und jede gut geformte Code-Zeile legt einen Check neben seine
Familie unter `e2e/<familie>.ts`. Das geliehene Flag hielt also genau die Zeilen allein, die TESTS
MITBRINGEN; bündelbar blieben nur testlose. Ein Check-Modul ist kein Gate, es ist ein Passagier, den
das Gate trägt.

Gate-Apparatur ist seitdem: jedes `e2e-*.sh` (inkl. `e2e-stage.sh`, `e2e-isolated.sh`), jedes
`fleet-e2e*.ts`, dazu `e2e/harness.ts`, `e2e/ctx.ts`, `e2e/pins.ts`, `merge-prompt.ts`,
`verify-proportion.ts`, `watchdog.sh`. Die beiden Globs sind der Regelteil, die sechs Einzelnamen
der Listenteil; `e2e/pins.ts` befestigt beide Richtungen gegen den Baum (jeder Wrapper auf Platte
wird erkannt · jeder Einzelname existiert noch · ein Check-Modul daneben wird NICHT erkannt).
`verify-proportion.ts` bleibt unverändert — seine Beweis-Empfehlung war nie falsch. §7.3 bleibt
unberührt. **`clarify-prompt.ts` steht bewusst NICHT auf der Liste** (Owner-Vorgabe 2026-09-12): es
steht in der `e2e-or-merge-land`-Regel wegen seiner Beweislast, aber es baut den Gründungsbrief
einer Clarify-Lane und gehört keinem Schritt der Verify-Kette an — `merge-prompt.ts` dagegen liegt
im Merge-/Land-Pfad und wird vom Gate selbst typgeprüft.

### R3 — Gebündelt wird auf BESTÄTIGTER Fläche, und die Bündelung folgt der Überlappung

Die Welle sucht die Zusammenhangskomponente (gemeinsame Dateien = Argument FÜR eine gemeinsame
Lane), nicht die unabhängige Menge. Sie darf das aber nur auf `filesOrigin: "confirmed"` tun.
Gemessen an den 31 offenen `auftrag`-Zeilen (`bun task-metadata.ts --state fleet.json`):

- **0 von 31** tragen `confirmed`; alle 31 tragen `derived` — abgeleitet aus Pfad-Tokens im
  Zeilen-TEXT.
- `server.ts` steht in **27 von 31** Flächen, `e2e/pins.ts` in 20, `AGENTS.md` in 15.
- Unter Datei-Überlappung bilden **30 der 31 Zeilen EINE Komponente**. Das Entfernen der beiden
  Nabendateien ändert daran nichts (weiterhin 30+1).
- Umgekehrt liefert `projectTaskWaves` über dieselben 31 Zeilen bei `maxLanes` 2, 3, 5 **und** 8
  identisch **28 Wellen** (Größen 3,2,1,1,…). Der Deckel ist nicht die Grenze — die Fläche ist es.

Beide Faltungen sind auf dieser Datengrundlage also wertlos: die eine ergibt einen 30er-Klumpen,
die andere 28 Einzelwellen. **Eine Welle, die heute auf `derived` schneidet, schneidet auf Prosa.**

*Falsifiziert durch:* eine Kapazitätserhöhung, die die Wellenzahl senkt — dann war der Deckel doch
die Grenze.

### R4 — Kollision ist ein BEREICH, keine Datei  (Nachtrag 2026-09-12, S2)

`task-land-waves.ts#componentsOf` verbindet zwei Zeilen auf einer gemeinsamen Datei nur noch, wenn
ihre Flächen dort **überlappen oder höchstens `LAND_WAVE_RANGE_GAP` = 40 Zeilen auseinander liegen**.
Zeilen ohne Bereich fallen auf die Dateiebene zurück — und zwar in allen DREI Schreibweisen von
Abwesenheit: `ranges: null` (kein Graph im Checkout, der Normalfall in einer Lane), `[]` (Graph
gelesen, nichts aufgelöst) und „Bereiche, aber keiner für DIESE Datei". Alle drei heißen „wo in
dieser Datei ist unbekannt", und unbekannt darf nie als „kollidiert nicht" gelesen werden.

Gleiches Symbol braucht keinen eigenen Arm: zwei Zeilen, die dasselbe `datei#symbol` nennen, lösen
über denselben Index auf denselben Bereich auf, und ein Bereich überlappt sich selbst.

Die Union musste dafür PAARWEISE werden. Vorher trug jede Datei einen Erst-Anwärter, an den sich
alle anderen hängten — das kann keine Bereichsregel ausdrücken: drei Zeilen in `server.ts` bei 100,
180 und 5000 müssen die dritte draußen lassen, und das ist eine Eigenschaft von PAAREN.

**Warum 40 und nicht 0:** die Bereiche kommen aus einem Graph-Snapshot, dessen Zeilennummern
zwischen zwei Läufen hinter dem Baum herhinken, und die beiden Fehler kosten nicht dasselbe. Zwei
Zeilen zu verbinden, die nicht kollidiert wären, kostet eine Welle eine Größe. Zwei zu trennen, die
kollidiert WÄREN, kostet einen Merge-Konflikt in einer Lane, der man gesagt hat, sie sei allein.

#### Was der Nachweis messen konnte — und was nicht

**Nicht messbar, und das ist selbst ein Befund:** die im Auftrag verlangte Rückschau („hätte die
Regel die 13 echten Konflikte vorhergesagt?") ist aus den vorhandenen Daten NICHT berechenbar.
`lane-outcomes.jsonl` schreibt seine Zeile NACH dem Rebase, also sind `base` und `headSha` beide
Nach-Rebase-Shas; der Fork-Punkt, an dem der Konflikt entstand, steht nirgends. Gemessen an allen 8
Konflikten dieses Repos: `git merge-base <headSha> <base> == base` und `rev-list --count base..pre`
= 0 in 8 von 8 Fällen — es gibt keinen Abstand mehr, an dem man rechnen könnte. (Die verbleibenden 5
der 13 liegen in `private-repo-j`.) Wer diese Rückschau will, muss zuerst den Fork-Punkt in die
Outcome-Zeile schreiben.

**Messbar, und dieselbe Frage von der anderen Seite:** was trennt die Regel auf ECHTER gelandeter
Arbeit? Über die letzten 50 Lands dieses Repos, alle Paare, deren Basen höchstens 5 Commits
auseinander liegen (nur die hätten je eine Welle sein können, und nur bei ihnen ist ein
40-Zeilen-Fenster überhaupt aussagekräftig):

| | |
|---|---|
| Paare im 5-Commit-Fenster | 60 |
| davon mit gemeinsamer Datei (**die heutige Kante**) | 29 |
| davon wirklich innerhalb von 40 Zeilen (**die neue Kante**) | **4** |
| von der Regel getrennt | **25 von 29 (86 %)** |

Die meistgeteilten Dateien dieser 29 Paare sind genau die Naben, die §2 Befund 1 benennt:
`e2e/pins.ts` (19×), `server.ts` (14×), `docs/self-api.md` (5×). 86 % der heutigen Kanten sind also
Nabenkanten und keine Kollisionen.

*Falsifiziert durch:* ein gelandetes Paar, dessen Bereiche mehr als 40 Zeilen auseinander lagen und
das trotzdem den Merge-Resolver brauchte.

#### Was die Regel auf der HEUTIGEN Queue tut — und warum die Komponentenzahl trotzdem steht

`bun task-land-waves.ts --state fleet.json` liefert vorher wie nachher **42 Wellen**, und auch
ohne den Deckel 3 bleiben es **3 Komponenten der Größen 13, 9, 1**. Das ist kein Nullergebnis,
sondern ein präzises: über die 37 offenen Zeilen dieses Repos (666 Paare) —

| | |
|---|---|
| Paare mit gemeinsamer Datei (**heutige Kante**) | 488 |
| davon **von der Regel GESCHNITTEN** (beide Seiten hatten Bereiche, keiner lag nah) | **109 (22 %)** |
| davon durch einen wirklich NAHEN Bereich gehalten | 6 |
| davon durch den **Datei-Rückfall** gehalten | 373 |

Die Regel schneidet also gut ein Fünftel aller Kanten weg — die Komponenten fallen trotzdem nicht
auseinander, weil EINE überlebende Rückfall-Kante genügt, um einen Klumpen zusammenzuhalten. Und
die Rückfälle haben einen Namen: **`server.ts` allein trägt 312 der 373** (danach
`docs/self-api.md` 36, `AGENTS.md` 36, `src/client.ts` 20). Nur 21 der 37 Zeilen tragen überhaupt
einen Bereich.

Der Engpass ist damit benannt und liegt NICHT in dieser Regel: `server.ts` steht im Graph mit 931
Symbolen, aber die Zeilen nennen es in Prosa, ohne `#symbol`. Was die Komponenten aufbricht, ist
mehr BEREICHS-ABDECKUNG — also S3s `card.surface.symbols` oder eine Zeile, die
`server.ts#handleX` statt `server.ts` schreibt. Die Regel steht dann schon bereit.

---

## 3. Kosten und Nutzen einer Welle von n Zeilen

**Ersparnis je vermiedenem Land** (Mediane der letzten 14 Tage, Mutex-Zeit, ohne Warten):

    Gate-Arbeit  107 s  +  Audit  1 484 s  =  1 591 s  ≈  26,5 min

Weil `covers` faktisch 1 ist (§1.4), spart jedes vermiedene Land seinen ganzen Audit. Eine Welle
von n spart `(n−1) × 26,5 min` plus `(n−1)` Wartefenster am Mutex (Median 0 s, p90 1 485 s —
d. h. in einem von zehn Fällen zusätzlich eine knappe halbe Stunde).

Hochgerechnet auf die gemessenen 266 Lands der letzten 14 Tage:

| durchschnittliche Wellengröße | Lands | eingesparte Mutex-Zeit / 14 d |
|---|---|---|
| 1 (heute) | 266 | — |
| 2 | 133 | ~59 h |
| 3 | 89 | ~78 h |

Diese Tabelle ist eine Obergrenze, kein Versprechen: sie unterstellt, dass die Zeilen einer Welle
tatsächlich bündelbar sind — und §2/R3 zeigt, dass heute **keine einzige** es nachweisbar ist.
Die realistisch erreichbare Wellengröße ist unbekannt, bis Flächen bestätigt werden.

**Gegenkosten, jede einzeln benannt:**

1. **Größerer Diff je Land.** Heute Median 4 Dateien je Land (n=553 gelandete Diffs, Mittel 5,7).
   Eine Welle von 3 macht daraus ~12. Der ②-Reviewer-Kontrakt (`e2e-clean-review.sh`) und der
   Merge-Repair-Pfad lesen genau diesen Diff. Der Repair-Pfad ist bei Wellen-Diff-Größe
   **ungetestet**: `repairRounds` ist in allen 777 Lanes 0, `mergeRepairRounds` steht auf 2.
2. **`undo-land` nimmt die ganze Welle.** `server.ts` `UNDO_STACK_MAX = 3` je Repo, ein Record je
   Land. Eine Welle ist ein Record — der Rückweg wird gröber, aber nicht kürzer: der Stack reicht
   dann statt über 3 Lands über 3 Wellen, was ihn eher stärkt.
3. **Ein rotes Audit nennt n Zeilen.** Bei heute 37 % Rot-Anteil (92/251 in 14 Tagen, überwiegend
   als Flake adjudiziert) wird der Bisect zur Regel, nicht zur Ausnahme — und er ist Handarbeit.
   Das ist die teuerste Gegenkosten-Position, und sie skaliert linear in n.
4. **Ein `sent`-Slot bindet genau eine Zeile.** `s.taskId` ist ein Singular (`server.ts`, überall:
   `provenance: { taskId: s.taskId, … }`); es gibt keine N:1-Bindung Lane→Zeilen. Eine Welle braucht
   entweder eine neue Bindung oder eine synthetische Elternzeile — beides ist Code, nicht Konfiguration.

**Die Bilanz:** Positionen 1, 2 und 4 sind einmalige Baukosten. Position 3 ist der laufende Preis,
und er ist genau so groß wie die Ersparnis riskant macht: Wellen tauschen Maschinenzeit gegen
Attributionsarbeit des Owners. Der Tausch lohnt sich, solange die Welle klein (2–3) und klassenrein
ist — die Zahl 3 ist dieselbe, die `UNDO_STACK_MAX` aus derselben Überlegung schon trägt.

> **Überholt 2026-09-12 (S7, Zeile `5ac5565d`):** Die Wellengröße ist kein Zeilen-Deckel 3 mehr,
> sondern ein Größenbudget; Begründung und Abwägung in §4 (6). Position 3 oben ist durch Regel 1
> des Wellen-Briefs (ein Commit je Zeile) zurückgekauft, und die Kopplung an `UNDO_STACK_MAX` war
> Zufall (§5 S3, letzter Punkt).

---

## 4. Die Antworten auf die fünf Fragen

**(1) Wellen-Definition.** Zusammen dürfen: Zeilen desselben Repos, derselben Verify-Klasse (R1),
keine davon Gate-Ändererin (R2), mit bestätigter und überlappender Fläche (R3), vorzugsweise
desselben Programs. Nie zusammen: Docs mit Code (R1) · Suite-Wrapper/Land-Pfad mit irgendetwas
(R2) · zwei Zeilen, deren Flächen nur abgeleitet sind (R3).

**(2) Bewertung / Reihenfolge.** Nicht das Alter. Vorgeschlagene Ordnung, in dieser Rangfolge:
(a) **Klasse** — Docs-Wellen zuerst, weil sie den Mutex faktisch nicht anfassen (0,74 s + 2 s) und
damit nie vor einer Code-Welle stehen dürfen; (b) **Program-Phase**, wo ein Program einen Grant
hält (bestehende Vorfahrt, unverändert); (c) **Wellengröße absteigend**, weil die Ersparnis in
(n−1) linear ist; (d) Alter nur als Tie-Break. Ausdrücklich NICHT: Flächengröße (sagt nichts über
Kosten) und Kollisionsfreiheit (das ist das Kriterium der *anderen* Faltung).

**(3) Kosten/Nutzen.** §3.

**(4) Modellpolitik.** Wellen **schneiden** braucht kein Modell: der Schnitt ist Arithmetik über
bestätigte Flächen und die Verify-Klasse — deterministisch, testbar, und ein Modell könnte hier nur
Nichtdeterminismus hinzufügen. Eine Fable-MAIN prüft den Schnitt und entscheidet Grenzfälle; sie
erzeugt ihn nicht. Wellen **bauen** ist eine Lane, und die fährt nach Modellpolitik 2026-09-02
ohnehin `claude-opus-5[1m]/high` — hier ist nichts zu ändern. Der **Merge-Resolver** liegt mit
10/777 Lanes (1,3 %) außerhalb des Zeitproblems; seine Modellfrage gehört zur Schwesterzeile
`187aa1a0`, nicht hierher.

**(5) Knopf oder Tick.** **Knopf.** Drei Gründe, jeder gemessen: der Tick kann ein rotes Audit nicht
über n Zeilen attribuieren (37 % Rot-Anteil, Handarbeit) · der Tick liest heute gar keine
Kollisionen (`ANALYSIS_ON` ist aus, §1.1), müsste für Wellen also erst einen abgeschalteten Sensor
wiederbeleben · und der Owner-Rückweg `undo-land` ist 3 Records tief, also auf eine Größenordnung
ausgelegt, die eine Person überblickt. Der Tick bleibt, wie er ist: oldest-first, eine Zeile.

**(6) Wellengröße — Nachtrag 2026-09-12 (S7, Zeile `5ac5565d`).** Die erste Fassung schnitt jede
Komponente bei `LAND_WAVE_MAX_DEFAULT = 3` Zeilen und begründete die Zahl damit, dass ein rotes
Audit über mehr Zeilen von Hand nicht mehr zuzuordnen sei. Diese Begründung trägt nicht mehr: der
Wellen-Brief verlangt einen Commit je Zeile (Regel 1), und damit ist der Bisect über eine Welle ein
Bisect über ihre Commits, egal ob es drei oder fünf sind. Einen Messgrund hatte die 3 nie
(`docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md` §4).

Die Grenze, die es wirklich gibt, ist der **Kontext der Lane**: eine Wellen-Lane baut alle ihre
Zeilen in EINER Session. Einzel-Lanes liefen bei 140–190k Tokens, laufende Lanes standen bei
27–43 % von 1M. Drei kleine Zeilen kosten diesen Kontext weniger als zwei große. Deshalb schneidet
`task-land-waves.ts#wavesFor` jetzt nach einem Budget: jede Zeile wiegt ihre Kartengröße
(`card.size`: klein = 1, mittel = 2, gross = 3), und eine Welle nimmt Zeilen in (created, id)-Ordnung
auf, solange die Summe ≤ `LAND_WAVE_BUDGET_DEFAULT` = 5 bleibt (Env `FLEET_LAND_WAVE_BUDGET`). Das
sind fünf kleine, zwei mittlere plus eine kleine oder eine große plus zwei kleine Zeilen. Eine Zeile
ohne Kartengröße wiegt **mittel**: Unbekannt ist nicht klein. Darüber gilt eine harte Obergrenze von
`LAND_WAVE_ROWS_MAX` = 6 Zeilen, die auch ein weiter gestelltes Budget nicht öffnet. Die Wellen-Tür
prüft dieselbe Summe und nennt in der Ablehnung Budget und Summe.

*Die Abwägung, ausdrücklich:* Eine Welle spart Gate und Audit (n−1)-mal (§3), macht das **Bauen**
aber seriell: n Zeilen, die in n Lanes parallel entstünden, entstehen in einer Lane nacheinander.
Größere Wellen senken die Mutex-Zeit, nicht die Wandzeit bis zum letzten Land. Durchsatz kommt aus
mehr Lanes, nicht aus größeren Wellen; das Budget begrenzt nur, wie viel eine einzelne Lane tragen
kann, ohne dass ihr Kontext die Qualität drückt.

*Rückweg:* Eine Welle ist EIN Land und damit EIN `undo-land`-Record. Die Undo-Tiefe
(`server.ts#UNDO_STACK_MAX`, 3 je Repo) zählt Lands, nicht Zeilen; eine Welle von fünf Zeilen
belegt sie genau wie eine von einer, und keine der beiden Zahlen sagt etwas über die andere.

*Was sich an kartenlosen Zeilen ändert:* Drei Zeilen ohne Kartengröße wiegen 6 > 5 und schneiden
jetzt 2 + 1 statt 3. Auf dem Live-`fleet.json` vom 2026-09-13 ändert das nichts, weil dort keine
einzige offene Zeile bündelbar ist (40 Zeilen, 40 Einzelwellen: 30× `flaeche-nur-abgeleitet`,
7× `kein-program`, 3× `keine-flaeche`; 0 Karten). Die Größe kommt aus der Karte: der Extraktor
übernimmt sie nur, wenn der Zeilentext sie nennt (Kopf „KLEINE LANE“ oder eine Zeile
„GROESSE: klein“), und die Create-Türen nehmen `card.size` direkt an.

---

## 5. Schnittliste (3 Schnitte, in dieser Reihenfolge)

### S1 — Wellen-Sensor: die Landefaltung sichtbar machen (read-only, kein Dispatch)

Ein Projektor neben `task-waves.ts`, der die **Lande**-Faltung rechnet: Zusammenhangskomponenten
über bestätigten Flächen, geschnitten durch R1 (Klasse) und R2 (Gate-Änderer), je Kandidat mit der
in Ledger-Sekunden bezifferten Ersparnis und — wo n=1 herauskommt — mit dem **Grund dagegen**.

*Done:* Der Sensor liefert über die offenen `auftrag`-Zeilen je Kandidatenwelle
`{ids, klasse, gemeinsame Dateien, geschätzte Ersparnis, Grund gegen Bündelung}`; für die 31 Zeilen
von heute muss er 31 Wellen der Größe 1 liefern, jede mit dem Grund „Fläche nur abgeleitet".
*Verify:* Checks in `e2e/tasks.ts` neben den bestehenden `projectTaskWaves`-Checks, mit gepinnten
Fixtures für R1/R2/R3 und einem Reinheits-Check (zweimal aufgerufen = identisches Ergebnis, wie
`e2e/tasks.ts:3791`); `bun e2e/pins.ts` grün.
*Gebaut* als `task-land-waves.ts`, gelandet 2026-09-06 20:4x als `863f628` + `49d93bc` (Lane `fleet/260906155855-1a12`, Self-Land der Program-MAIN Slot 4, `verify.ok:true`). Done-Satz im Haupt-Checkout gemessen: `bun task-land-waves.ts --state fleet.json --default-repo <checkout>` ⇒ 40 Wellen der Größe 1, alle `flaeche-nur-abgeleitet`, 0 unresolved.
*Warum zuerst:* Die Faltung ist heute unbekannt. Jeder Knopf, der vor diesem Sensor gebaut wird,
schneidet auf `derived`-Flächen — also auf dem, was die Zeilen textlich nennen.

### S2 — Fläche bestätigen: die Vorbedingung, ohne die S1 immer 1 liefert

Der bestehende `refine-confirm`-Pfad (`confirmedFiles`, `task-metadata.ts`) wird zur sichtbaren
Vorbedingung der Wellenfähigkeit: eine Zeile ohne bestätigte Fläche steht im Sensor aus S1 als
„nicht wellenfähig" und niemals in einer Welle mit n>1.

*Done:* Für eine Zeile mit `filesOrigin:"confirmed"` erscheint eine Wellenkandidatur mit n>1, sobald
eine zweite bestätigte Zeile derselben Klasse dieselbe Datei nennt; für `derived` nie. Der Owner
sieht auf der Zeile, was ihm die Bestätigung einbringt (die Ersparnis-Zahl aus S1).
*Verify:* Ein Check, der eine `derived`-Zeile und eine `confirmed`-Zeile mit identischer Fläche
gegenüberstellt und beweist, dass nur die zweite in eine n>1-Welle gerät; `bun e2e/pins.ts` grün.
*Kosten, offen benannt:* Das ist Owner-Arbeit je Zeile. Sie lohnt erst, wenn S1 die Ersparnis
beziffert — deshalb steht S1 davor und nicht daneben.
*Gebaut* 2026-09-07, gelandet als `974ea00` (Lane `fleet/260907121743-4336`) — aber NICHT als „der bestehende
`refine-confirm`-Pfad wird sichtbar gemacht": §7.3 unten hat gemessen, dass dieser Pfad für eine
BESTEHENDE Zeile gar nicht existiert. Gebaut wurde stattdessen das Paar aus §7.1.3, propose/promote
wie bei `criterion` und `refine`: `POST /api/self/tasks/:id/files-proposal` (self-token, eine Lane
darf) parkt einen Vorschlag NEBEN der Fläche, `POST /api/tasks/:id/files` (Owner-Token) schreibt
`{files, filesOrigin:"confirmed"}` auf dieselbe Zeile — ohne Kinder, ohne Archivierung.
Pfad-Findings melden, sie gaten nicht; `audit.jsonl` hält fest, dass der Owner sie sehen konnte.

**NACHTRAG 2026-09-12 — die Tür stand, der Weg dorthin fehlte.** Gemessen mit
`bun task-land-waves.ts --state fleet.json`: 42 offene `auftrag`-Zeilen, 42 Wellen der Größe 1,
0 `confirmed` — fünf Tage nach dem Bau von S2 also derselbe Befund wie davor. Der Grund war nicht
die Route, sondern ihr einziger Produzent am Board: bestätigen konnte der Owner nur einen
GEPARKTEN VORSCHLAG, und den parkt nur eine Lane. Eine Zeile mit einer bereits abgeleiteten Liste
hatte keinen Knopf. Seitdem bietet `src/client.ts#renderQueueDetail` die vorhandene
`derived`-Liste auch ohne Vorschlag zur manuellen Bestätigung an — ein expliziter Owner-Akt beim
Review einer offenen Zeile, vor dem Release.

Die Liste wird dabei **pro Pfad abgewählt** (Checkbox, Default an), und das ist der eigentliche
Inhalt des Nachtrags: dieselbe Messung fand, dass die Ableitung KOMMANDO-ERWÄHNUNGEN als Pfade
trägt — 17 der 42 Flächen nannten `e2e-isolated.sh`, 18 `e2e/pins.ts`, meist weil der Brief die
Verify-Zeile zitierte. Eine Bestätigung der rohen Liste hätte die Wellen zwar sofort wachsen
lassen, aber auf einer Fläche, die die Zeile nie anfasst: aus einer Prosa-Vermutung wäre ein Fakt
geworden, und R2 (gate-ändernde Pfade) hätte danach auf erfundenen Kanten entschieden. Gesendet
wird genau die verbleibende Auswahl, gelesen am Klick; eine leere Auswahl sendet nichts. Keine
neue Route, kein Auto-Heben, keine Änderung an `task-metadata.ts`.

**NACHTRAG 2026-09-12 (b) — die Ableitung trennt jetzt selbst, und die Fläche wird persistiert.**
Der Nachtrag darüber schob die Trennung von Zitat und Absicht auf den Owner-Klick ab; sie gehört in
die Ableitung. `task-metadata.ts#intentText` blendet seitdem vor jedem Scan aus: eine Zeile, die mit
„Verify"/„Verifikation" beginnt, einen Backtick-Abschnitt, der mit `./`, `bun `, `bunx ` oder
`curl ` anfängt, und ein unquotiertes Kommando ab seinem Kopf bis zum Zeilenende. Gemessen am
LIVE-`fleet.json`, Repo `claude-fleet` (37 seiner 44 offenen `auftrag`-Zeilen; die übrigen 7 liegen
in `private-repo-j`). Rahmen ist das Was-wäre-wenn von §2 — abgeleitet als bestätigt gelesen, sonst
entscheidet R3 alles allein und R2 ist gar nicht sichtbar:

| | vorher (`3c9ca68a`) | nachher |
|---|---|---|
| Wellen | 34 | 25 |
| davon n>1 | 3 | 7 |
| `gate-aenderer` | **20** | **7** |
| `keine-flaeche` | 1 | 2 |
| Ersparnis | 8 575 s | 24 010 s |

**Im UNGERAHMTEN Lauf ändert sich die Zahl nicht, und das ist kein Widerspruch:**
`bun task-land-waves.ts --state fleet.json` liest heute 30 der 42 Zeilen als
`flaeche-nur-abgeleitet`, und R3 steht in `classify` VOR R2 — `gate-aenderer` steht dort vorher wie
nachher auf 1. Die 13 Zeilen sind trotzdem real bewegt; sie sind nur hinter der stärkeren Ablehnung
unsichtbar, bis eine Fläche bestätigt wird.

Die 13 Zeilen, die `gate-aenderer` verlassen, verlieren ausnahmslos zitierte Gate-Apparatur
(`e2e-isolated.sh`, `e2e/pins.ts`, die vier Wrapper und die `fleet-e2e*.ts` aus einer zitierten
`bunx tsc`-Zeile). Die eine Zeile, die neu auf `keine-flaeche` fällt, ist `c269023d`, ein
DENKAUFTRAG ohne Code-Fläche, dessen einziger Treffer `bun e2e/pins.ts` in seinem Verify-Satz war —
sie ist danach ehrlicher beschrieben als vorher. **Der bezahlte Preis, benannt:** ein Pfad, den die
Prosa als `./register.sh` schreibt, gilt als Kommando und nicht mehr als Fläche (`e4409bf2`). Das
ist die Regel des Owners, wörtlich, und der Fehlschuss ist einseitig — er verliert eine Fläche,
er erfindet keine.

Zweitens trägt die Zeile die Fläche seitdem als `Task.surface{files, ranges, origin, at, sha}` in
`fleet.json`, statt sie bei jedem 2-s-Poll neu abzuleiten. Das ist eine Umkehr der alten Regel
(„nie persistieren, sonst wird die schwächere Herkunft durch einen Reload zur stärkeren") und sie
ist bezahlt: `sha` hasht ALLE Eingaben der Ableitung — Text, Brief, bestätigte Liste, den
git-Index-Stempel und den Stempel der Graph-Datei —, also wird ein gespeicherter Wert genau so
lange wiederverwendet, wie jede einzelne davon unverändert ist. Der Grund für den Umbau ist
`ranges`: die Bereichsauflösung liest `graphify-out/graph.json` (10 708 Knoten, 137 Dateien,
~95 ms Aufbau), und das ist keine Projektion mehr, sondern eine Last.

`ranges: null` heißt **kein Symbolindex vorhanden** und ist nicht dasselbe wie `[]`. `graphify-out/`
ist gitignored und liegt nur im Haupt-Checkout — eine Lane bekommt also ehrlich `null`. Der Graph
nennt je Symbol nur eine STARTzeile; das Ende wird abgeleitet (nächstes Symbol minus eins, für das
letzte die Zeilenzahl der Datei), und der Index ist **partiell**: 137 der getrackten Dateien, und
`task-land-waves.ts` steht heute nicht darin. Ein Symbol, das er nicht kennt, liefert deshalb
keinen Bereich statt eines geratenen — und die Datei-Ebene trägt die Zeile weiter.

### S3 — „▸ start wave": ein Owner-Knopf, eine Lane, n Zeilen

Der Knopf gründet EINE Lane auf einen Kandidaten aus S1 (n≤3), mit einem Brief, der die n Zeilen in
fester Reihenfolge trägt, und einer N:1-Bindung Lane→Zeilen (heute ist `s.taskId` Singular). Der
Tick bleibt unverändert.

*Done:* Ein Land der Wellen-Lane erzeugt genau EINEN `fleet/land`-Note, EINEN `undo-land`-Record und
EINEN Audit-Cover, dessen `proportional` genau dann `true` ist, wenn alle n Zeilen Docs waren; alle
n Queue-Zeilen gehen gemeinsam auf `done`; ein Abbruch lässt alle n auf `queued` zurück.
*Verify:* Check im Land-/Merge-Pfad (`e2e/land-durability.ts` + `e2e/tasks.ts`), plus
`./e2e-clean-review.sh` und `./e2e-isolated.sh` als Vorschau, weil dieser Schnitt den Land-Pfad
berührt (Regelbuch, Lane discipline); `bun e2e/pins.ts` grün.
*Gebaut und gelandet* 2026-09-07 als `74a1cde2`..`eb0f03d3` (acht Commits, Lane
`fleet/260907140524-b010`; die letzten zwei sind Nachtraege auf dem rebasierten Baum, siehe unten). Was davon abweicht, wie es hier steht:

* **Die N:1-Bindung brauchte kein neues Feld.** `t.slot` war der Kante schon: `landLane` und
  `detachSlotTasks` schleifen beide über `t.slot === s.id`, seit lange vor diesem Schnitt. Also
  markiert EIN Land ohne Zutun alle n Zeilen `done` und EIN Abbruch gibt ohne Zutun alle n zurück.
  `s.taskId` behält seine alte Bedeutung unverändert — die Zeile, die die Lane GEGRÜNDET hat, und
  die, an die jede Provenienz bindet. Ein zweites Feld auf dem Slot wäre ein zweiter Datensatz
  derselben Kante gewesen, und zwei kommen über einen Restart auseinander.
* **Der Knopf entscheidet nichts selbst.** `POST /api/wave/dispatch` fragt den Sensor
  (`server.ts#landWaveProjectionNow` über `projectLandWaves`) und verlangt eine EXAKTE Mengengleichheit
  mit einer projizierten Welle. Eine Teilmenge einer projizierten Dreier-Welle wird abgelehnt: das
  wäre der Knopf, der sich eine Welle ausdenkt. R1, R2, R3 und die Program-Grenze stehen damit
  weiterhin an genau einer Stelle.
* **Der Abbruch lässt alle n auf `pending`, nicht auf `queued`** — hier weicht der Bau vom
  Done-Satz oben ab, und zwar bewusst. `detachSlotTasks` schreibt seit jeher `pending` mit der
  Begründung „back to owner review, NOT auto-queued — the abort was deliberate", und `queued` würde
  den Tick die Zeilen sofort neu dispatchen lassen: eine Lane, die zweimal am selben Punkt stirbt,
  liefe endlos. Was der Done-Satz wirklich verlangt — dass ein Abbruch alle n GEMEINSAM zurückgibt
  und keine halb erledigt stehen lässt — hält der Bau. Der SPLIT dagegen schreibt `queued`, und das
  ist dort richtig: diese Zeilen waren freigegeben, die Lane sagt nur, dass sie nicht in dieses
  Bündel gehören.
* **`proportional` fällt automatisch richtig**, weil eine Welle EIN Land ist: `verifyPlanFor`
  klassifiziert den tatsächlichen rebasten Diff. Alle n docs ⇒ Docs-Diff ⇒ kurze Kette; eine
  Code-Zeile darin ⇒ voller Diff ⇒ volle Kette. Es gibt keine Stelle, an der eine deklarierte
  Fläche das Kommando wählt.
* **Ein Commit je Zeile** steht als Regel 1 im Wellen-Brief (`wave-brief.ts`). Das ist der Preis,
  den die Welle für ihre Ersparnis zahlt, zurückgekauft: n getrennte Lands hätten dem Leser eines
  roten Stufe-2-Audits den Bisect geschenkt.
* **`LAND_WAVE_MAX_DEFAULT` ist nicht an `UNDO_STACK_MAX` gekoppelt**, und das steht jetzt
  ausdrücklich am Konstanten-Kommentar plus als Pin: eine Welle von n ist EIN Land mit EINEM
  undo-Record, die Zahl 3 ist das Bisect-Budget eines Lesers, und die Übereinstimmung war Zufall.
  *(2026-09-12 abgelöst durch das Größenbudget `LAND_WAVE_BUDGET_DEFAULT` = 5, §4 (6); der
  Kommentar zur Undo-Unabhängigkeit und der Pin gelten für das Budget weiter.)*

*Schnittlinie:* Hier hört die Liste auf. Eine automatische Wellenbildung im Tick, eine
Prioritätsspalte in der Queue und ein Bisect-Assistent für rote Wellen-Audits sind erkennbar
nächste Schritte — sie stehen bewusst NICHT auf dieser Liste, weil keiner von ihnen ohne die
gemessene Wellengröße aus S1/S2 zu bewerten ist.

---

## 6. Was dieses Dokument NICHT geprüft hat

- Ob die Docs-Kurzkette in der Praxis die erwartete Quote trifft. Historisch waren **134 von 553**
  gelandeten Diffs (24 %) rein-docs; die Kurzkette existiert erst seit dem Land von `036ff7c`
  (2026-09-04) und trägt bisher 55 Gate-Läufe und 6 Audit-Läufe. Bei ~19 Lands/Tag entspricht das
  ungefähr der erwarteten Rate, aber die Stichprobe ist zwei Tage alt — eine Messung wert, kein
  Befund.
- Vier der sechs proportionalen Audit-Zeilen stehen auf `red` bei ~1 s Laufzeit (`install+pins`).
  Ob das echte Pin-Brüche oder eine Sondenfrage ist, wurde hier nicht adjudiziert.
- Fremde Repos. Alle Zahlen sind `/Users/owner/claude-fleet`; `repoRunsShortChain` und der
  `exit 42`-Pfad für Produkt-Repos sind ungemessen geblieben.
- Die Wirkung des Helfers: 49 der 500 Audits liefen remote. Ob eine Welle die Helfer-Auslastung
  verbessert oder verschlechtert, ist offen.

---

## 7. Nachtrag 2026-09-07 — Owner-Entscheide und zwei Befunde, die §5 verschieben

*Geschrieben vom Controller (Slot 6) nach der Clarify-Runde mit dem Owner, 12:4x. §1–§6 oben
bleiben unverändert: sie sind der Snapshot vom 06.09. und ihre Zahlen zeigen auf den Baum, den sie
vermaßen. Was hier steht, ändert die SCHNITTLISTE, nicht die Messung.*

### 7.1 Die drei Entscheide

1. **Umfang = Landewelle, S2 + S3.** Nicht die Parallelwelle beim Dispatch. Begründung, die der
   Owner angenommen hat: die Zeit liegt in den Lands (107 s Gate + 1 608 s Audit ≈ 28 min je
   vermiedenem Land, `LAND_WAVE_COSTS_2026_09`), nicht im Start.
2. **`programId` ist das zweite Bündel-Kriterium**, neben der Datei-Fläche. Auslöser war die
   Owner-Frage „was wenn die Dateifläche nicht ausreicht?" — siehe §7.2.
3. **S2 bekommt eine NEUE Tür:** eine Lane schlägt eine Fläche vor, der Owner bestätigt sie am
   Board. Ausdrücklich verworfen: auf `↻ refine` aufsatteln (ein Split ist keine Bestätigung) und
   `derived → confirmed` automatisch heben (das tauft eine Prosa-Vermutung in einen Fakt um).

   **Nachtrag 2026-09-12 (Owner-Entscheid „klingt vernuenftig alles", Queue-Zeile b8cb3c75):** der
   bestätigende Akt darf zusätzlich von der **gebundenen Program-MAIN als Batch** kommen —
   `POST /api/self/tasks/confirm-cards` (`server.ts#confirmCardsForMain`, self-token, nicht-Lane-only)
   schreibt für die genannten Zeilen des EIGENEN Programs `card.surface.files` als
   `{files, filesOrigin:"confirmed"}`, eine `audit.jsonl`-Zeile `task_cards_confirm` je Batch. Der
   Auto-Lift bleibt verworfen: nichts läuft ohne diesen Aufruf, und die Pfade stammen aus einer
   gegen den Baum validierten KARTE, nie aus der Prosa-Ableitung. Ganz oder gar nicht über das
   Bracket (fremdes Program oder fremder Repo ⇒ 409, nichts geschrieben); Zeilen ohne gültige Karte
   oder mit bestehender Owner-Bestätigung werden übersprungen und benannt. Die Owner-Tür
   `POST /api/tasks/:id/files` bleibt unverändert und überschreibt jederzeit.

### 7.2 Warum die Fläche allein nicht reicht

Die Frage zerfällt in zwei Risiken, und nur eines ist offen.

**Das Verifikations-Risiko ist geschlossen — durch Konstruktion.**
`server.ts#verifyPlanFor` klassifiziert nicht die deklarierte Fläche, sondern den **tatsächlichen
rebasten Diff** (`git diff <mainSha>...HEAD --name-only`); ein leerer *und* ein fehlgeschlagener
Diff fallen beide auf die volle Kette. Eine falsche Fläche kann nie eine zu kurze Beweiskette
erkaufen. Was eine unzureichende Fläche kaputtmacht, ist das **Bündel**, nicht der Beweis.

**Drei Arten „reicht nicht", und nur eine ist ein Problem:**

| Fall | Was passiert | Urteil |
|---|---|---|
| Fläche *unbekennbar* (Erkundungszeile) | `reasonAgainst: "keine-flaeche"`, Wellengröße 1 | korrekt, kein Defekt |
| Fläche *zu klein* (Lane fasst mehr an) | Gate bleibt korrekt; der Preis ist der Bisect — ein Audit nennt jetzt n Zeilen | tragbar, siehe §7.3 |
| Fläche *zu grob* | falsches Bündel | **der wunde Punkt** |

Der dritte Fall ist bereits gemessen, und §2 R3 enthält die Zahlen: `server.ts` steht in 27 von 31
Flächen, und unter Datei-Überlappung falten 30 von 31 Zeilen zu EINER Komponente. **Wer eine grobe
Fläche bestätigt, bestätigt genau diesen Klumpen** — die Bestätigung allein macht die Faltung nicht
brauchbar. Dateien sind ein notwendiges, kein hinreichendes Kriterium.

Das fehlende semantische Kriterium liegt schon in den Daten: **40 von 48** offenen `auftrag`-Zeilen
tragen ein `programId` (gemessen 2026-09-07 12:4x an `fleet.json`: `f170dc46` 16 · `9ce08219` 5 ·
`eec69528` 4 · `79036e9a` 4 · `233e1c2b` 3 · `b2aa5b45` 2 · `66499a03` 2 · vier weitere je 1 ·
8 ohne). Gebündelt wird künftig nur INNERHALB eines Programs und über gemeinsame Dateien; eine
Zeile ohne `programId` bleibt Größe 1 mit eigenem, benanntem Grund.

### 7.3 Zwei Befunde, die die Schnittliste korrigieren

- **S2 hat heute keine Tür — die Doc nennt einen Pfad, den es für eine BESTEHENDE Zeile nicht
  gibt.** `filesOrigin: "confirmed"` wird an genau einer Stelle geschrieben: `server.ts:26472`, im
  Pfad `↻ refine → promote`; die **Kinder** eines Splits erben die vom Refiner gegen den Baum
  geprüften Pfade. Eine bestehende Zeile kann ihre Fläche nicht bestätigt bekommen. Das ist der
  eigentliche Inhalt von S2, nicht „der bestehende `refine-confirm`-Pfad wird sichtbar gemacht".
  **NACHTRAG 2026-09-07:** genau so gebaut und gelandet als `974ea00` (siehe S2 oben). Der
  Satz „eine bestehende Zeile kann ihre Fläche nicht bestätigt bekommen" ist damit HISTORIE — er
  beschreibt den Baum, den §7 vermaß, nicht den heutigen. `filesOrigin:"confirmed"` hat jetzt zwei
  Schreiber: den refine-promote und die neue Owner-Tür.
- **S3s Rückweg ist all-or-nothing und damit der falsche.** Das Done-Kriterium in §5 sagt „ein
  Abbruch lässt alle n auf `queued` zurück". Für Fall zwei und drei aus §7.2 — die Fläche reichte
  nicht, und das zeigt sich erst IN der Lane — muss die Lane sich **selbst teilen** dürfen: k von n
  erledigt, n−k gehen als `queued` zurück, und die `note` sagt welche und warum.
- **Nebenbefund, unbewertet:** `maxWave` ist 3 (`task-land-waves.ts`) und `UNDO_STACK_MAX` ist 3
  (`server.ts`). Die beiden stimmen heute überein, aber **zufällig** — nichts koppelt sie. Wenn eine
  Welle immer in einen `undo-land`-Schritt passen soll, gehört das benannt; sonst hebt der Nächste,
  der einen der Werte anfasst, still die Rückfalltür aus.

### 7.4 Was daraus gefilet wurde

Drei Zeilen im Program **Land-Pipeline `233e1c2b`**, jede mit hartem Done-Kriterium, wörtlichem
Verify-Kommando und Verbotsliste: **W1 `e0113460`** (`programId`-Schnitt) · **W2 `0f5019ac`**
(Bestätigungstür) · **W3 `05611418`** (`▸ start wave` samt Selbst-Split). W1 und W2 sind
voneinander unabhängig; W3 setzt beide voraus.

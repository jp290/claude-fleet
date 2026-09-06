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

*Falsifiziert durch:* ein Wellen-Kandidat mit n>1, in dem eine Zeile `isolatedPreview:true` trägt.

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
*Gebaut* als `task-land-waves.ts` (Lane `fleet/260906155855-1a12`; Sha setzt die MAIN nach dem Land ein).
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

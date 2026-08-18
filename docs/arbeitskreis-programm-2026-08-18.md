# Arbeitskreis-Verbesserungsprogramm — die Ernte der beiden Denk-Worker, als Programm geschnitten

**Lies dies als:** das Programm-of-Record über drei Dokumente desselben Tages:
`docs/arbeitskreis-prozesse-2026-08-18.md` (Trichter + Marktgrenze, `46b7478`) →
`docs/triage-analyse-verbesserung-2026-08-18.md` (Worker B, Opus 5, `3a48ae7`) →
`docs/brief-kompilierung-verbesserung-2026-08-18.md` (Worker C, Opus 5, `e5db50b`).
Owner-Entscheid 2026-08-18: **eine Fable-MAIN übernimmt dieses Programm und implementiert es mit
Opus-5-Workern.** Dieses Dokument ist ihr Auftragsanker. Die Tiefe steht in den zwei Worker-Docs —
hier steht nur, was beide zusammen ergeben und in welcher Reihenfolge.

## 1. Die Konvergenz — der eigentliche Fund

Beide Worker, unabhängig gebrieft und unabhängig gelandet, sagen dasselbe:

> **Zuerst das Mess-Substrat reparieren, dann die Blindheit heilen, dann einschalten, dann erst
> der Markt-Pilot.**

Konkret:

- **K4 (Messbarkeit) ist an beiden Schichten gebrochen.** Es gibt kein Verdikt-Ledger
  (`Task.analysis` lebt nur in fleet.json, wird von `capTasks` evakuiert; messbar ist heute nur die
  überstimmte Minderheit — eine einzige Fehlerrichtung). Und `briefHash` joint auf modernen Rows
  nicht auf den Brief (gehasht wird brief+Ankerblock, verglichen wird `brief.text` — der Code sagt
  es selbst, `server.ts:10489-10495`).
- **Die Güte-Lücke des Analysten war Blindheit, kein Modellversagen:** der Sweep bekam
  `files: t.files ?? null` (fast immer nichts), während `taskView` längst eine deterministische
  Oberfläche mit Provenienz je Zeile berechnet — sichtbar für Client und `register.sh`, nur nicht
  für den Worker. Abschalt-Beleg `ec91075`: 445 Läufe/48 h, 22 von 28 `needs-you` falsch (~79 %
  Falsch-Alarm auf der Seite, die Arbeit VERHINDERT).
- **Der Brief-Kompiler ist als Nebenwirkung mit-abgeschaltet** (`FLEET_ANALYSIS_MS=0` ist EIN Wert
  für ZWEI Werkzeuge). **Die KOPPLUNG ist seit P3 aufgehoben** (eigener Schalter `FLEET_BRIEF_MS`,
  `docs/queue-analyst.md` §5a); der Kompiler bleibt aus, bis der Owner ihn in `watchdog.sh` setzt —
  aus einer Nebenwirkung ist damit ein Entscheid geworden. Die Trichter-Zahlen (29 % Leer-Quote, 117/213 0-Prompt-Lands) entstanden
  fast vollständig ohne kompilierten Brief — **der Hebel ist ungetestet, nicht widerlegt.** Und
  eine vertragstreue Clarify-Lane wird per Konstruktion als `killed-empty` verbucht — ein Teil der
  29 % ist Buchungsartefakt.
- **Marktreife:** die Analyse-Schicht ist strukturell die markt-fähigste (K1 vorbildlich — reiner
  Prompt-Vertrag, geschlossene Blocker-Menge, Form-Abnahme im Server), aber heute nicht markt-reif,
  **und die Lücke ist K4 vor K3.** Einen Anbieter bezahlen, dessen Produkt man nicht bewerten kann,
  ist der K2-Shadow-Fehler in neu.

## 2. Das Programm — gemergte Rangliste, jede Zeile ein eigener Lane-Schnitt

Reihenfolge = Abhängigkeit, nicht Geschmack. Details und Belege: B §6, C §8.

| # | Schnitt | Quelle | Art |
|---|---|---|---|
| P1 | **Verdikt-Ledger** `analysis-verdicts.jsonl` (ein `appendEvent` an einer Stelle) | B1 | Code, klein |
| P2 | **`briefHash` + `briefSource` auf die Land-Quittung** (schließt den stillen Fehl-Join) | C2 | Code, ein Feld |
| P3 | **Eigener Schalter für den Brief-Kompiler**, getrennt vom Analysten (`FLEET_ANALYSIS_MS` entkoppeln) — **Code gelandet 2026-08-18 als `FLEET_BRIEF_MS` (Default 0), Owner-Flip offen** | C1 | Code + Owner-Flip |
| P4 | **Oberfläche mit Provenienz in den Analyse-Prompt** (die `taskView`-Projektion dem Worker geben) | B2 | Code, mittel — Achtung: `buildAnalysisPrompt`-Pins ungelesen (B §7) |
| P5 | **Staleness an die Fläche binden** statt an Tip-Gleichheit (`analysisStale`) — **Code gelandet 2026-08-18**: reine Regel `analysis-staleness.ts`, bewegte Fläche per `git diff` statt Ledger-Join, `register.sh` zieht mit (B §2.3, `docs/queue-analyst.md` §3b) | B3 | Code, mittel |
| P6 | **`briefstats.ts`** — reiner Reader in der Form von `slotstats.ts`/`trailstats.ts`, rechnet Leer-Quote je Brief-Herkunft + 0-Prompt-Quote je Land — **Code gelandet 2026-08-18**: `bun briefstats.ts <outcomes> <receipts> [--json]`, Join `taskId+branch` (briefHash disambiguiert), jede Rate mit Zähler/Nenner, jede Zeile in genau einem Eimer (Sonden `e2e/briefstats.ts`, C §4) | C3 | Code, reiner Reader |
| P7 | **Deterministische Abnahme auf Refine-Vorschlägen** (jeder Pfad am HEAD getrackt · `verify` ∈ `LOCAL_PROOF_STEPS`) — zugleich Vorbedingung der Fremdbesetzbarkeit — **Code gelandet 2026-08-18**: reine Regel `refine-validate.ts`, dreiwertig, sechs Codes; Projektion in `taskView` statt an `parseRefineAnswer` (Befund über den Baum von JETZT), am Confirm nachgerechnet; gated nichts, Owner-Latitude bleibt (Sonden `e2e/tasks.ts` §(j2), C §6) | C4 | Code, klein |
| P8 | **`"analysis"` in `DISPOSITION_WORKERS`** (ein Listeneintrag) | B4 | Code, trivial |
| — | **Wieder einschalten** (Sweep + Kompiler) — erst NACH P1–P5, mit Kennzahl | B5 | **Owner-Entscheid** |
| — | **Schatten-Pilot gegen einen Marktagenten** (B §5.1: 12 Zeilen, zwei Leser, Owner als Anker, Abbruchbedingung vorab: reproduziert der Referenz-Leser die 79 %, ist der Prompt das Problem) | B6 | **Owner-Entscheid** |

**— Schnittlinie —** (von beiden Workern benannt, hier nur gesammelt): ContextPlan für Worker ·
graphify als Analysten-Kontext · `analysis` in `REPO_WORKER_KEYS` · `ANALYSIS_TICK_MS`-Tuning ·
eine Route, die Urteile von außen annimmt (erst das Ledger) · dritte Refine-Form · Priors in die
Kompilierung (ohne P3 wirkungslos) · context-packs im Kompiler (abgelehnt mit Begründung, C §5).

## 3. Lose Enden, benannt statt verschluckt

1. **B §7:** die gepinnten `buildAnalysisPrompt`-Sonden wurden nicht gelesen — P4 kann sie
   brechen; die P4-Lane muss sie zuerst lesen.
2. **C-Report:** `GET /api/self/gate` klassifiziert uncommittete Änderungen als
   `classifiedAs:{}` → empfiehlt unnötig die Vollkette. Kleiner echter Defekt, eigener Schnitt
   oder `notiz`.
3. **C §9:** „der Kompiler ist AUS" ist Code-belegt + Deploy-plausibel, nicht live gemessen —
   ein Blick auf `analysis.on` im Owner-Poll schließt das.
4. **Betriebsbeobachtung dieser Session:** das Land von `e5db50b` lief in ein `waitedOut`
   (953 s hinter dem Suite-Mutex, Verify NIE gestartet), der Owner hat es danach bewusst von
   Hand gelandet (`confirmedByHuman:true`, docs-only). Kein Defekt — aber ein Datenpunkt dafür,
   dass ein Land direkt nach einem anderen Land dessen Audit vor sich hat.

## 4. Arbeitsweise der Fable-MAIN (Owner-Entscheid 2026-08-18)

- **Ein Schnitt = eine Lane**, Opus-5-Pin (`claude-opus-5[1m]`), Brief mit Dateien+Zeilenbereichen,
  hartem Done-Kriterium und Verify-Weg; seriell landen, nie zwei Lands gleichzeitig.
- **propose/promote bleibt intakt:** Env-Flips (P3-Aktivierung, Wieder-Einschalten, Pilot) sind
  Owner-Akte; die MAIN bereitet sie vor und fragt.
- Rückkanal: `POST /api/self/watch` (die MAIN ist Nicht-Lane) für Lane-, Merge- und Audit-Ausgänge.
- Nach jedem Land: Audit-Ausgang ansehen; ein Rot gehört adjudiziert, bevor das nächste Programm-
  Land startet.

---

## 5. Vollzug — was die Fable-MAIN am 2026-08-18 gelandet hat

Alle acht Schnitte sind auf `main`, jeder als eigene Opus-5-Lane, seriell gelandet, jeder mit
Post-Land-Audit und Deploy. Ein Land ändert bis heute **kein Live-Verhalten**: alle neuen
Fähigkeiten stehen hinter Schaltern, die aus sind, oder sind reine Mitschreiber/Leser.

| # | Commit | Was jetzt existiert | Audit | Deploy |
|---|---|---|---|---|
| P1 | `bee2576` | `analysis-verdicts.jsonl` — jedes Sweep-Urteil inkl. `unknown` wird mitgeschrieben, an beiden Zuweisungsstellen; `recordAnalysisVerdict`, keine Route von außen | grün 2576/0 | ✓ |
| P2 | `735aa45` | `briefHash` + `briefSource` auf jeder Context-Quittung; **fünf** Schreibstellen entschieden, nicht zwei; Herkunft fünfwertig `compiled\|owner\|raw\|clarify\|founding` | grün 2584/0 | ✓ |
| P3 | `e15d672` | `FLEET_BRIEF_MS` (Default 0) — Kompiler und Analyst haben getrennte Schalter, vier saubere Zustände; zwei Ticks, ein `sweepBusy` | rot → **adjudiziert `flake`** | ✓ |
| P4 | `6a36015` | der Analyst SIEHT die Zeile: dreiwertige Oberfläche mit Provenienz aus `deriveTaskMetadata` im Prompt, Semantik je Zustand ausgeschrieben | grün 2599/0 | ✓ |
| P5 | `64c10e4` | `analysis-staleness.ts` — vier Arme (Brief · Flächenschnitt · unbekannte Fläche · **unbekannte Bewegung**, der vierte fehlte im Vorschlag); `git diff` statt Ledger-Join, weil Direkt-Commits ledger-unsichtbar sind | grün 2607/0 | ✓ |
| P6 | `43e5765` | `briefstats.ts` — reiner Reader, Leer-Quote und 0-Prompt-Quote je Herkunft, jede Rate mit Nenner, Ausschlüsse gezählt statt gefaltet | grün 2633/0 | ✓ |
| P7 | `b0500da` | `refine-validate.ts` — dreiwertige Pfad-/Verify-Abnahme am Vorschlag, sechs Codes, gated nichts (Owner-Latitude); sitzt in `taskView`, nicht an `parseRefineAnswer` | grün 2643/0 | ✓ |
| P8 | `6f3b3e8` | `"analysis"` als vierter Worker auf dem Disposition-Rail, `ref = taskId`; vier Knöpfe unter dem Verdikt | grün 2647/0 | ✓ |

**Erste Messung mit dem neuen Substrat** (`bun briefstats.ts lane-outcomes.jsonl
context-receipts.jsonl`, 2026-08-18 nach P8): 6 joinbare Lanes, alle `raw`, alle gelandet, 0 leer,
6/6 ohne Owner-Prompt — das sind die acht Programm-Lanes selbst. Die Zahl ist noch keine Aussage
über die Schicht; sie ist der Beweis, dass der Join trägt. Ausgewiesen statt gefaltet: 277 Lanes
ohne `taskId`, 39 Quittungen vor P2, 27 Direkt-Commits außerhalb des Scopes.

### 5.1 Lose Enden — Stand

1. **B §7 (Prompt-Pins):** erledigt. Die P4-Lane hat sie zuerst gelesen und mitgezogen.
2. **`classifiedAs:{}` an `/api/self/gate`:** OFFEN, unangetastet — eigener kleiner Schnitt.
3. **C §9 („Kompiler ist AUS"):** geschlossen, live gemessen: `analysis.on:false`,
   `briefCompiler` absent (= `FLEET_BRIEF_MS` 0).
4. **Land direkt nach Land:** bestätigt sich; zusätzlich gelernt und als Betriebsregel übernommen:
   **keinen Lane-Spawn neben einen laufenden Audit stellen** — genau das hat das rote P3-Audit
   erzeugt (442 Checks, 0 failed, 97 s, Test-Server-Crash; Same-Tree-Rerun `ALL PASS` 2595).

### 5.2 Neu aufgelaufen (nicht im ursprünglichen Programm)

- **`notiz f5834dfc`:** der `ctx`-Sensor kennt `claude-fable-5` nicht und meldet ein
  200k-Fenster — `pct` 118,3 an einer gesunden Session. Eine falsche Zahl ist schlechter als das
  `ctx:null` der GPT-Slots, weil sie wie eine Messung aussieht.
- **`docs/verify-tiering.md` §11.2c-bis** (`e218ad5`): das Spiegelbild der sechsten Flake-Familie
  in `fleet-e2e-harness.ts`, zwei Sichtungen an einem Tag, beide nach §11.3 bewiesen; die zweite
  kostete das P8-Land (confirm-land nach Rerun). Keine Basisrate behauptet.
- **Offener Rest aus P7, benannt von der Lane:** die Refine-Findings reisen nur auf
  `GET /api/tasks`, nicht auf dem 2-s-Poll — es gibt keinen Row-Chip ohne Öffnen des Details.
  Kandidat für einen kleinen Folgeschnitt (Digest-Feld), nicht dispatcht.
- **Zwei Regelbuch-Zeilen** in `CLAUDE.md` nachgezogen (gitignored, darum von Hand): der
  `FLEET_BRIEF_MS`-Absatz und die Suite-Teardown-Falle (`kill <wrapper-pid>` tötet nur den
  Wrapper; der Runner läuft weiter, schreibt in denselben fd und verschränkt zwei Läufe in ein Log).

### 5.3 Was jetzt beim Owner liegt

Beides sind Env-Flips in der srv-Spawn-Zeile von `watchdog.sh` plus
`launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` — propose/promote, nie von der MAIN.

1. **Kompiler-only zuerst:** `FLEET_BRIEF_MS=60000`, `FLEET_ANALYSIS_MS` bleibt 0. Testet den
   ungetesteten Hebel gegen die 29-%-Leer-Quote, ohne die Urteilskosten. `briefstats.ts` misst ab
   dem ersten Tag, und die Herkunft steht seit P2 auf jeder Quittung.
2. **Analyst danach:** `FLEET_ANALYSIS_MS=60000`. Jetzt sieht er die Oberfläche (P4), entwertet
   sein Urteil nur noch bei echtem Flächenschnitt (P5), und jedes Urteil landet im Ledger (P1) —
   die 79-%-These wird messbar statt Meinung.
3. **Schatten-Pilot (B6)** bleibt hinter beidem: sein Abbruchkriterium braucht die Kennzahl aus 2.

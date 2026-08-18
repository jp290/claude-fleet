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

# Agent OS P0.5 — Baseline vor Mutation

**Stand:** HEAD `b29d2c7`, 2026-08-11 · **Art:** read-only Baseline · **Gate:** G0

**Ablaufdatum:** Diese Datei wird nach G0 nicht als Live-Dashboard gepflegt. Ihr Stichtag bleibt
der Vergleichsanker; spaetere Populationen gehoeren in abgeleitete Reports/Ledgers.

## Baseline-Verdikt

Die heutige Evidenz reicht, um den Provenienz-Backbone und kontrollierte Boot-/Canary-Proben zu
entwerfen. Sie reicht **nicht**, um eine Verbesserung von Korrekturrate, Scope oder Owner-Zeit
rueckwirkend zu behaupten: Genau die benoetigten Task-/Harness-/Context-Joins fehlen in den alten
Rows. Diese Metriken beginnen vorwaerts mit Phase 2.

## 1. Primaere Kontextmetrik: Prompt-/Tool-Result-Footprint

Der beste bestehende Messpunkt ist `docs/attic/lane-cost-study.md`, eine nachvollziehbare
historische Stichprobe von 18 gelandeten Claude-Lanes:

- 2,72 Mio. Zeichen Tool-Ergebnisse insgesamt, davon 95,4 % read-only Orientierung;
- 75,7 % der gemessenen Kosten waren Cache-Reads des bereits aufgebauten Gespraechskontexts;
- 32,2 Mio. Cache-Read-Tokens pro Lane im Mittel;
- mediane Lane: 142 Turns, 20 Minuten, 3 Dateien, 12,12 USD nach damaligem Preismodell;
- Population: ein Codebase-/Model-/Owner-Schnitt innerhalb von 20 Stunden; nicht auf heutige
  Codex-Lanes oder andere Taskklassen uebertragbar.

Das ist ein belastbarer Mechanismusbefund, aber kein heutiger P50-Footprint pro vergleichbarer
Klasse. `streams/prompts.jsonl` misst 4.769 gesendete Texte mit zusammen 4.690.297 Zeichen, jedoch
**keine Tool-Ergebnisse**; diese Zahl darf die primaere Metrik nicht vortaeuschen.

**Baseline-Status:** historischer Mechanismus `measured`; heutige taskklassengleiche Verteilung
`unknown`. Der erste faire Vergleich startet, sobald Phase 2 jede neue Lane mit Task/Harness/
Context und ein Provider-Normalizer ihren Tool-Footprint verbindet.

## 2. Sekundaere Kontextmetrik: Boot-/Regelbytes

| Traeger | Bytes heute | Bedeutung |
|---|---:|---|
| `AGENTS.md` | 5.534 | automatisch fuer Codex/pi dokumentiert |
| privates `CLAUDE.md` | 98.663 | Claude-Kontext bzw. von Codex/pi manuell verlangte Voll-Lektuere |
| `.claude/CLAUDE.md` | 226 | Claude-Projekthinweis auf `graphify` |

Die reale Boot-Payload pro Harness wurde in dieser Phase nicht neu gestartet/gemessen. Deshalb
gibt es vor P1-D kein ehrliches „always loaded total“. Eine Byte-Senkung ist nur dann nuetzlich,
wenn Loader- und Canary-Korrektheit stabil bleiben; sie ist nicht die primaere Erfolgsmetrik.

## 3. Outcome-Provenienz: kompletter Census

Population: alle 247 parsebaren Rows in `lane-outcomes.jsonl`.

| Feld / Eigenschaft | bekannt | Anteil | Baseline-Aussage |
|---|---:|---:|---|
| `briefHash` | 190 | 76,9 % | Founding-Brief teilweise joinbar |
| `repo` | 171 | 69,2 % | Zielrepo fuer neuere Rows vorhanden |
| `model` non-null | 55 | 22,3 % | oft unknown; kein Harness-Ersatz |
| `review` vorhanden | 243 | 98,4 % | State vorhanden, Subject/Task nicht immer joinbar |
| `releasedBy` bekannt | 66 | 26,7 % | neue Herkunftsmetrik, alte Rows bleiben unknown |
| `verified` bekannt | 160 | 64,8 % | 153 true, 7 false, 87 unknown; nur bool/null |
| `taskId` | 0 | 0 % | fehlt strukturell |
| `originId` / `programId` | 0 / 0 | 0 % | fehlt strukturell |
| `harness` / `effort` | 0 / 0 | 0 % | Slotfakt geht im Outcome verloren |
| Context Plan / Skill-Refs | 0 / 0 | 0 % | noch nicht gebaut |

Die Zielhypothese „100 % neue Rows tragen Provenienz oder benannten Unknown-Grund“ wird erst ab
dem P2-Land gewertet. Altrows werden nicht migriert oder aus Modellnamen erraten.

## 4. Rueckwirkende Stichprobe: 10 juengste Lands

Die zehn juengsten `landed`-Rows wurden als enges, reproduzierbares Fenster gelesen:

- 10/10 tragen ein Modelllabel, 0/10 einen Harness oder `taskId`;
- 9/10 `verified:true`, 1/10 `verified:false`, kein unknown in diesem Fenster;
- 9/10 tragen `releasedBy:"owner"`, eine Row ist unknown;
- zusammen 4 `ownerPrompts`; niemand brauchte mehr als einen;
- 3/10 Reviews sind `covered`, 7/10 `none`;
- beruehrte Dateien: 2, 2, 2, 3, 3, 3, 4, 4, 5, 6 (Median 3).

Diese Rows sind nach Modelllabel und Dateien sichtbar eine enge aktuelle Arbeitswelle, aber ohne
Harness-/Task-/Context-Join **nicht vergleichbar klassifizierbar**. Sie belegen die Join-Luecke;
sie werden nicht als Wirkungsmessung des Agent OS benutzt.

## 5. Owner-Aufwand

Der Outcome-Census traegt 209 `ownerPrompts` ueber 247 Rows:

- 139 Rows mit 0;
- 77 Rows mit 1;
- 31 Rows mit mehr als 1;
- Maximum 17.

Das ist eine Promptzahl, keine Minute und keine Korrekturklassifikation. Review-, Gate- und
Adjudikationszeit werden heute nicht direkt erfasst. Ab G0 erhaelt jede Gate-Vorlage ein
Zeitbudget; bis zu einer bewussten Instrumentierung werden verbrauchte Owner-Minuten einmalig in
der Gate-Entscheidung notiert, nicht aus Promptzahlen hochgerechnet.

## 6. Heute nicht rekonstruierbare Baselines

| Metrik | Warum nicht ehrlich rueckwirkend | Startpunkt |
|---|---|---|
| Owner-Korrektur | Prompttext hat keine bestaetigte Semantik und keinen Task-Join | ab P2/P4 |
| Stop-early | killed/empty ist nicht automatisch ein sinnvoller frueher Stop | ab P4-Taxonomie |
| No-verify | `verified:null` mischt Altrow, nicht gelaufen, nicht messbar | ab P2 Verify-Objekt |
| Scope-Ausweitung | Soll-Files/Surface fehlen am Outcome | ab P2-D/Phase 5 |
| Taskklasse | weder mechanisch ausreichend noch owner-promotet | ab P2-D |
| Harness-Vergleich | Harness fehlt in Outcomes | ab P2-A |
| Context-/Skill-Wirkung | keine IDs/Hashes | ab P2-B/P3 |
| echte Owner-Minuten | kein Timer/Entscheidungsrecord | ab G0-Vorlagen |

Eine manuelle Volltranskript-Klassifikation koennte einzelne alte Lanes etikettieren, wuerde aber
die fehlende eindeutige Herkunft nicht reparieren und Owner-/Analystenzeit in eine scheingenaue
Baseline verwandeln. Der vorhandene n=18-Kostenlauf bleibt die historische Footprint-Stichprobe;
alle anderen Kriterien werden ehrlich vorwaerts datiert.

## 7. Messvertrag fuer die erste neue Population

Pro neuer Lane:

1. `originId/taskId/laneId`, Harness, Modell/Effort und Context-/Skill-Hashes beim Dispatch
   einfrieren;
2. Prompt- und Tool-Result-Zeichen/Tokens provider-spezifisch normalisieren; nicht verfuegbare
   Formate mit Grund `unknown`;
3. Owner-Prompts zaehlen, Owner-Korrekturen nur nach Adjudikation klassifizieren;
4. Taskklasse mechanisch ableiten oder owner-promoten, sonst unknown;
5. Population erst nach Taskklasse, Harness und Context vergleichen;
6. nach 10 vergleichbaren Lanes oder 14 Tagen Gate-Verdikt faellen; bei zu kleiner Population
   `insufficient-evidence` statt Waiver-Prosa.

## 8. Gate-Schwellen

- **G1:** kontrollierte Boot-Matrix + Canary + Redaktionsreview; keine Erfolgsbehauptung aus
  Produktionspopulation noetig.
- **G2:** kontrollierter End-to-End-Join und 100 % neuer Rows mit Feld oder Unknown-Grund.
- **G3:** 0 geroutete Skills bei fehlender Requirement; Context Plan inspectable.
- **G4:** zwei manuelle Populationen; alle hohen Risiken plus max. 12/20-%-Stichprobe adjudiziert.
- **Wirkung:** nach 10 vergleichbaren Lanes oder 14 Tagen. Footprint primaer, Bytezahl sekundaer,
  Korrektur-/Unknown-Rate als Schutzmetrik.

## Nicht geprueft

Keine Volltranskripte, Tool-Rollouts oder Live-Panes wurden neu gelesen. Preise aus der
historischen Studie sind zeitgebunden und keine aktuelle Kostenprognose. Die Stichprobe ist ein
Ledger-Census, keine Modellrangliste.

---
frage: Welcher der drei Stau-Mechanismen des Startplans wird gelockert, damit ein Repo-Deckel von 3 nicht als 1 wirkt — und warum die anderen nicht?
urteil: Gelockert wird (c), die Claims WARTENDER Wellen — sie halten spaetere Wellen nur noch, wo beide Seiten auf der gemeinsamen Datei bekannte Ranges tragen, die nach R4 kollidieren; der Ganz-Datei-Rueckfall bleibt fuer jede Kante, die ueber Gleichzeitigkeit entscheidet (laufende Lane, "now"-Welle). Auf dem Live-Stand mit einer Lane: 0 → 2 now; (a) und (b) abgelehnt.
bereich: [queue, start-plan, dispatch, kollision]
belege: [start-plan.ts#projectStartPlan, start-plan.ts#collision, start-plan.ts#rangesOn, task-land-waves.ts#rangesCollide, land-collision-stats.ts, bun start-plan.ts --state fleet.json (Kontrafaktum)]
nicht-gemessen: Wie oft eine ueberholte vordere Zeile danach laenger wartet als heute (der Plan ist zustandslos, kein Zeitverlauf); ob die Hub-Datei-Klasse (b) mit mehr Lands traegt (n = 6).
stand: 2026-09-15
---

# Startplan-Stau: welcher Mechanismus gelockert wird

Lane Slot 4, 2026-09-15 15:2x, Baum `200d2e9b`. Anlass und Diagnose:
`docs/messungen/2026-09-15-queue-stau-und-orchestrierungs-entscheide.md` §1–2. Diese Notiz ist die
Entscheidung VOR dem Code; der Code folgt im naechsten Commit derselben Lane.

## 1. Was die drei Sicherungen jeweils schuetzen

| Mechanismus | Stelle | entscheidet ueber | Begruendung heute |
|---|---|---|---|
| (a) Ganz-Datei-Rueckfall gegen eine LAUFENDE Lane | `collision` + `rangesOn` (Schritt 3, Lane-Schleife) | Gleichzeitigkeit: zwei Lanes auf demselben Code | „Unbekannt ist nie frei" (`rangesOn`-Kommentar) |
| (b) Hub-Dateien ohne Ranges | Karten: neue Checks/Abschnitte haben kein Symbol | — (Eingabe, kein Code) | — |
| (c) Claims wartender Wellen | `claims`-Regel in `projectStartPlan` | NUR Reihenfolge: eine wartende Welle startet nicht, also laeuft nichts gleichzeitig | Schnitt 1 (`c86bcee9`): „Everything else — now, after, collides, cap — is in line"; ohne weitere Begruendung, und im Entwurf §4 F4 Schritt 5 nicht verlangt (dort: „ohne Kollision mit einer laufenden Lane") |

Der Unterschied ist der Kern der Entscheidung: (a) und der Claim einer „now"-Welle sind
SICHERHEIT (sie verhindern zwei gleichzeitige Lanes auf demselben Code). Der Claim einer WARTENDEN
Welle verhindert keine Gleichzeitigkeit — die wartende Welle laeuft ja nicht —, er haelt nur die
Reihenfolge. Mit dem Ganz-Datei-Rueckfall wird aus dieser Reihenfolge ein Deckel, den niemand
beschlossen hat: dieselbe Klasse, die der Schnitt-2-Kommentar in `start-plan.ts#collision` schon
einmal fuer „keine Flaeche = kollidiert mit allem" beschreibt.

## 2. Messung

**Kontrafaktum auf dem Live-Stand** (`bun start-plan.ts --state fleet.json` des Haupt-Checkouts,
15:1x; Eingabe gedumpt, fuenf Varianten von `projectStartPlan` im Scratchpad, nichts geschrieben).
„1 Lane" = ohne diese Lane (Slot 4), also der Stand, den die Orchestratorin gemessen hat.

| Variante | now (2 Lanes) | now (1 Lane) | was startet |
|---|---:|---:|---|
| heute | 0 | 0 | — |
| (c1) nur „now"-Wellen claimen | 1 | 2 | b4ea42c8, ffcfec48 |
| **(c2) wartende Wellen claimen nur auf bekannten Ranges** | 1 | 2 | b4ea42c8, 2d3cc525 |
| (b) Hub-Klasse: beide Seiten ohne Range auf e2e/tasks.ts, e2e/programs.ts, docs/self-api.md, e2e/pins.ts = frei | 0 | 0 | — |
| (a) eine Lane-Datei ohne Row-Range und ohne Hunk = frei | 1 | 1 | 220d9dcd |

Zwei Befunde darin:
- Die vorderste Sperre ist `d3765352`: sie wartet per `after` auf `e3e5084a`, und `e3e5084a` ist
  keine Zeile der Queue — der `after`-Check wird fuer sie nie wahr. Heute claimt diese Zeile
  `server.ts`, `docs/self-api.md`, `e2e/programs.ts` ohne Range und haelt fuenf freigegebene Zeilen,
  unbefristet.
- (c1) und (c2) unterscheiden sich genau an einer Zeile: `ffcfec48` (server.ts#CODEX_HARNESS
  1123–1308) liegt hinter `fcff67db` (server.ts#CODEX_HARNESS 1124–1309), die auf Slot 1 wartet.
  Das ist eine BEKANNTE Ueberlappung — die beiden werden sicher serialisiert, offen ist nur, in
  welcher Reihenfolge. (c2) laesst die Reihenfolge des Plans stehen, (c1) laesst die spaetere
  vorbei.

**Ledger** (`bun land-collision-stats.ts --forked-only`, 74 Lands mit forkSha): Datei-Rueckfall
P 0.12 R 1.00 (tp 3, fp 23), R4 auf Ranges P 0.60 R 1.00 (tp 3, fp 2). Auf den Hub-Dateien teilte
main waehrend der Lane-Lebenszeit: e2e/tasks.ts 3×, docs/self-api.md 2×, e2e/programs.ts 1×, je 0×
beruehrend; e2e/pins.ts 14×, 1× beruehrend.

## 3. Entscheidung: (c2)

**Regel:** Eine Welle, die in dieser Runde „now" ist, claimt ihre Dateien wie bisher (voller
`collision`, Rueckfall inklusive). Eine WARTENDE Welle (`after`, `collides`, `cap`) haelt eine
spaetere nur auf einer gemeinsamen Datei, auf der BEIDE Seiten Ranges tragen und R4 sie
kollidieren laesst. Unfreigegebene und ungepruefte Wellen claimen weiter gar nicht.

**Welche Begruendung sie ersetzt:** „keine Zeile ueberholt eine fruehere" (Schnitt 1) wird zu
„keine Zeile ueberholt eine fruehere, mit der sie nachweislich kollidiert". „Unbekannt ist nie frei"
bleibt unangetastet fuer jede Kante, die ueber Gleichzeitigkeit entscheidet: laufende Lanes (Rueckfall
und Hunks, `rangesOn`) und „now"-Wellen untereinander. Wird die ueberholte Zeile spaeter startbar,
trifft sie die Lane der ueberholenden mit genau dieser Regel — die Sicherheit haengt nie am Claim.

**Warum bekannte Ranges die Grenze sind:** Eine Reihenfolge ist ein Entscheid; ein Mechanismus soll
Fakten feststellen, nicht urteilen (Owner-Entscheid 2026-09-15 §3.3). Zwei bekannte Ranges innerhalb
von 40 Zeilen sind ein Fakt (R4 P 0.60), die Reihenfolge des Plans darueber bleibt stehen. Ein
Ganz-Datei-Rueckfall ist eine Vermutung (23 von 26 Datei-Kanten falsch) — eine Vermutung einer Zeile,
die nicht startet, darf keine Zeile halten, die starten kann.

**Warum nicht (a):** Eine frische Lane nennt `server/types.ts`, weil ihr Brief sie dort arbeiten
laesst; der erste Hunk kommt, NACHDEM die parallele Zeile gestartet ist — zu spaet. Das ersetzt
„Unbekannt ist nie frei" fuer Gleichzeitigkeit, und alle drei echten Kollisionen im Ledger fing nur
Range-oder-Rueckfall. Kontrafaktisch loest es auch nur eine Zeile.

**Warum nicht (b):** Kontrafaktisch 0 now — die Hub-Dateien sind nicht die einzige Kante jeder
wartenden Zeile. Eine Dateiliste als Klasse waere eine Namensregel ohne Sensor; n = 6 geteilte
Hub-Datei-Faelle (0 beruehrend) traegt keinen Sicherheitsentscheid (bei 0/6 liegt die obere
95-%-Grenze bei rund 40 %). Und sobald die Lane einen Check committet, haette sie echte Hunks auf der
Datei, und eine range-lose Zeile kollidiert wieder — die Lockerung waere nur fuer frische Lanes
wirksam.

**Warum nicht (c1):** Sie loest dieselbe Menge, gibt aber auch die Reihenfolge auf bekannten
Ueberlappungen frei (`ffcfec48` vor `fcff67db`). Dort ist die Serialisierung sicher und nur die
Reihenfolge offen; der Plan-Reihenfolge dort nicht zu folgen, waere eine Umpriorisierung, die kein
Fakt verlangt.

## 4. Preis, benannt

- **Prioritaetsumkehr auf range-losen Dateien.** Eine vordere Zeile ohne Range kann auf ihren
  range-losen Dateien ueberholt werden und wartet danach auch auf die Lane der ueberholenden
  (Rueckfall gegen deren Hunks). Bei Zeilen mit mehreren Dateien ist Aushungern moeglich, wenn sich
  Ueberholer auf wechselnden Dateien abloesen; der Plan ist zustandslos und kann das nicht zaehlen.
  Sensor: die `waiting:`-Note der vorderen Zeile nennt die Lane, die sie haelt.
- **Kein neuer Deckel, keine Server-Automatik:** geaendert wird nur `projectStartPlan`;
  `tickDispatch` liest den Plan wie bisher.

## 5. Beweis (DONE der Zeile)

- Fixture nach dem gemessenen Stand: frische Lane (Ranges nur auf server.ts, keine Hunks), zwei
  vordere wartende Zeilen, dahinter range-lose Zeilen auf server/types.ts, docs/self-api.md,
  e2e/tasks.ts, e2e/programs.ts → mindestens eine Welle „now", heute 0.
- Invariante ueber das Fixture und einen deterministischen Generator: nie zwei „now"-Wellen, die nach
  dem vollen Kollisionsrecht (Rueckfall inklusive) kollidieren, nie eine „now"-Welle gegen eine
  laufende Lane (Row-Ranges, Hunks, Rueckfall).
- Mutation „Lockerung auch auf Dateien mit bekannten Ranges" (= c1): der Check mit der bekannten
  Ueberlappung hinter einer wartenden Zeile wird rot.

## 6. Offen, nicht Teil dieser Zeile

- `d3765352` wartet per `after` auf `e3e5084a`, die keine Queue-Zeile ist — der Plan meldet
  `after: e3e5084a` fuer immer. Ob das `after` falsch ist oder die Zielzeile archiviert wurde,
  entscheidet die MAIN.

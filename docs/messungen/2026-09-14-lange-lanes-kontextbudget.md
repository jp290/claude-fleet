---
frage: Kostet Kontext bei Opus-5-Lanes Landqualitaet, woraus besteht er, was machen Wellen daraus, und was taten die Lanes mit dem Staffelstab-Nudge?
urteil: Nein, messbar nicht (landed 92/100/98/100 %, auditRed 30→16 %, rework3d/inserted steigt nur mit der Landgroesse); der Kontext ist je ein Drittel erster Request, eigene Ausgabe und Tool-Ergebnisse; 3 von 4 Wellen-Lanes enden ueber 40 % gegen 2 von 86 Einzel-Lanes; es gab EINEN Lane-Nudge statt 15, und die Lane nahm die Tuer in 19 s. Entscheid E, die Schwelle bleibt; gebaut ist nur der Messfehler (endContext las die Nachfolgerin).
bereich: [lane-kontext, succession, wellen]
belege: [lane-context-cost.ts#budgetRows, lane-context-cost.ts#sessionAnatomy, lane-context-cost.ts#measureTranscript, land-quality.ts, server.ts#laneMigrateMessage, server.ts#LANE_MIGRATE_PCT, task-land-waves.ts#LAND_WAVE_BUDGET_DEFAULT, e2e/pins.ts]
nicht-gemessen: Token-/Kontingentkosten langer Lanes (Summe Kontext je Turn), Fremd-Harness-Lanes, Fable-Lanes (17), Qualitaet jenseits rework/fix/auditRed (Review-Befunde, Owner-Nacharbeit), Serverseitiger Env-Wert von FLEET_LANE_MIGRATE_PCT
stand: 2026-09-15
---

# Lange Lanes: ist Kontext ein Qualitaetsbudget oder nur ein Kostenposten?

2026-09-15, Lane `fleet/260915155135-e264`, Opus 5, Horizont `main` = `38f5451d` (2026-09-15T15:42:57Z).
Frage: **Faellt die Landqualitaet einer Opus-5-Lane mit ihrem Kontext, und welcher der Hebel A–E ist
der billigste, der eine gemessene Zahl traegt?**

Grundmenge: 221 geschlossene Opus-5-Lanes (`lane-outcomes.jsonl`, juengste Zeile je Branch, `ts` in den
14 d vor dem Horizont, Harness claude oder null, Modellklasse aus Ledger bzw. Transkript). Gemessen wird
die **Peak-Session** jeder Lane: die Session mit dem groessten Einzel-Request, nur Sessions, die der Fleet
selbst in diesem Worktree gepromptet hat (`streams/prompts.jsonl` sessionId). Kontext = `input +
cache_creation + cache_read` EINES Requests; Prozent = Anteil an 1 M (Fenster jeder Opus-5-Lane).
Bänder sind halboffen (lo, hi].

## Ergebnis

### (a) Peak-Kontext gegen Landqualitaet

Qualitaet aus `land-quality.jsonl` (Join per Branch): rework3d = eingefuegte Zeilen, die main binnen 3 d
ueberschrieb (nur geschlossene 3-d-Fenster, 125 der 221); fix3d = ein `fix…`-Commit ueberschrieb Code
der Lane binnen 3 d (nur Code-Lands); auditRed = ein messender Post-Land-Audit war rot und nicht als
`flake` adjudiziert.

| Band | n | landed | rework3d > 0 | rework3d/inserted median | inserted median | fix3d (Code-Lands) | auditRed |
|---|---:|---:|---:|---:|---:|---:|---:|
| ≤ 20 % | 85 | 78/85 (92 %) | 9/29 (31 %) | 0.000 | 104.5 | 4/17 (24 %) | 23/77 (30 %) |
| 20–30 % | 68 | 68/68 (100 %) | 29/48 (60 %) | 0.005 | 256.5 | 6/41 (15 %) | 16/62 (26 %) |
| 30–40 % | 48 | 47/48 (98 %) | 23/34 (68 %) | 0.012 | 504 | 8/30 (27 %) | 9/44 (20 %) |
| > 40 % | 20 | 20/20 (100 %) | 14/14 (100 %) | 0.023 | 817 | 5/14 (36 %) | 3/19 (16 %) |

Das einzige steigende Mass ist rework3d, und mit ihm steigt die Landgroesse (inserted median 104 → 817):
eine grosse Lane hat mehr Zeilen, die ueberschrieben werden koennen. Bei gleicher Landgroesse (Zelle =
n · rework3d/inserted median · fix3d/Code-Lands):

| inserted | ≤ 20 % | 20–30 % | 30–40 % | > 40 % |
|---|---:|---:|---:|---:|
| 0–150 | 17 · 0.000 · 3/13 | 9 · 0.017 · 1/8 | 1 · 0.013 · 0/1 | 1 · 0.008 · 0/1 |
| 151–500 | 11 · 0.000 · 1/4 | 33 · 0.005 · 4/29 | 17 · 0.007 · 2/15 | 3 · 0.031 · 1/3 |
| > 500 | 1 · 0.000 · 0/0 | 6 · 0.001 · 1/4 | 16 · 0.015 · 6/14 | 10 · 0.023 · 4/10 |

In der einzigen Schicht mit Masse ueber 30 % (> 500 Zeilen) liegen 30–40 % und > 40 % bei 0.015 gegen
0.023 (n 16/10) und fix3d bei 6/14 gegen 4/10: kein Band, ab dem die Qualitaet faellt. **Antwort (a):
nein, und es gibt keine Schwelle aus diesen Daten.** Das deckt sich mit der Vorgaengernotiz
(`2026-09-13-lane-kontext-sub-worker-glm.md` §2.2: landed-Rate und repairRounds flach), jetzt mit
Zeilen-Nacharbeit und Fix-Commits. Die Owner-Messung „Qualitaet faellt ab 25 %" (2026-09-06) gilt fuer
Controller; auf Lanes uebertraegt sie sich in diesen drei Groessen nicht.

### (b) Zusammensetzung der Peak-Session

Drei Toepfe: **erster Request** (System, Werkzeuge, Regelbuch, Brief); **eigene Ausgabe** = Σ
`output_tokens` (enthaelt Denken, das im Transkript nicht als Text steht); **Tool-Ergebnisse +
Eingespeistes** = Peak − erster Request − eigene Ausgabe (Tool-Ergebnisse, System-Reminder, Prompts).
Dass Ausgabe wirklich im Kontext bleibt, prueft der **Rueckhalte-Test**: auf Turns mit < 200 Zeichen
Tool-Ergebnis ist (Kontext-Delta) / (vorige Ausgabe) je Lane im Median 1.083 — ≈ 1 heisst, sie bleibt.

| Gruppe | n | Peak | erster Request | eigene Ausgabe | Tool-Ergebnisse + Eingespeistes | Tool-Ergebnis-Zeichen | Tool-Input-Zeichen / davon Heredoc | Text-Zeichen | Bash | Rueckhalte-Test |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| alle | 221 | 225 160 | 69 575 (31 %) | 75 658 (31 %) | 84 091 (38 %) | 176 138 | 76 339 / 38 514 | 4 553 | 77 | 1.083 |
| Peak > 40 % | 20 | 450 914 | 70 630 (16 %) | 212 522 (48 %) | 187 352 (37 %) | 382 208 | 293 096 / 98 706 | 15 054 | 284.5 | 1.076 |

(Anteile sind Mediane je Lane, sie summieren nicht exakt auf 100.) Lange Lanes haben denselben ersten
Request und keine groesseren Tool-Ergebnisse je Aufruf (382 208 / 284,5 ≈ 1 340 Zeichen gegen
176 138 / 77 ≈ 2 290), sondern **3,7× so viele Turns**; der groesste Topf wird dort die eigene Ausgabe.

**Slot 7** (`fleet/260914163129-2bd0`, Welle aus 2 Zeilen, 4 Einheiten, 11 Dateien): 142 Requests,
141 Bash; erster Request 83 426 (21 %), eigene Ausgabe 129 189 (32 %), Tool-Ergebnisse + Eingespeistes
190 953 (47 %) bei 417 355 Ergebnis-Zeichen; Tool-Input 151 487 Zeichen, davon 97 622 Heredoc-Koerper;
Peak 403 568, 40 % erreicht 2026-09-14T17:32:34Z.

Kleiner Render: der erste Request der Lanes mit Brief ab 2026-09-14 17:14 (lokal) liegt bei p50 64 700
(n 32) gegen 73 382 (n 53, Briefs 09-13 00:00 bis 09-14 17:14) — −8,7 k, Brief- und Kartengroesse sind
darin nicht getrennt.

### (c) Wellen-Buendelung

Lanes mit Brief ab der ersten Wellen-Lane (2026-09-12T11:44:39Z); Welle = Brief traegt
„DIESE LANE TRÄGT EINE WELLE: N QUEUE-ZEILEN" (`wave-brief.ts#renderWaveBrief`); Einheiten nach
`task-land-waves.ts#landWaveUnits`, Zeile ohne GROESSE = mittel.

| Gruppe | n | Peak % median | p90 | max | > 40 % | Dateien median | Einheiten median | Peak je Zeile median | auditRed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Einzel-Lane | 86 | 18.9 | 34.1 | 45.1 | 2 | 4 | 2 | 18.9 | 26/82 (32 %) |
| Welle (≥ 2 Zeilen) | 4 | 48.5 | 58.2 | 58.2 | 3 | 12 | 5 | 19.8 | 0/4 (0 %) |

| Einheiten | n | Peak % median | max |
|---:|---:|---:|---:|
| 1 | 29 | 13.9 | 25.4 |
| 2 | 53 | 20.2 | 45.1 |
| 3 | 4 | 35.1 | 39.9 |
| 4 | 2 | 48.5 | 56.7 |
| 6 | 2 | 44.7 | 58.2 |

Die vier Wellen: `1188` 2 Zeilen 56,7 % · `de75` 3 Zeilen 58,2 % · `6a40` 3 Zeilen 31,3 % · `2bd0`
2 Zeilen 40,4 %; alle landed, auditRed 0/4. Eine Welle spart je Zeile keinen Kontext (19,8 % je Zeile
gegen 18,9 % Einzel) — sie legt die Zeilen hintereinander in eine Session. Ein voller Wellen-Deckel
(`LAND_WAVE_BUDGET_DEFAULT` = 5 Einheiten) landet nach dieser Reihe bei ~45–50 %, also am Staffelstab.
n = 4 traegt die Richtung, keine Konstante.

### (d) Der Staffelstab-Nudge

**Die „15 Nudges an 5 Lanes" gibt es nicht.** `grep Staffelstab streams/prompts.jsonl` trifft heute
17 Zeilen: 10 `[self] S8 Staffelstab: …`-Check-ins der S8-Lane `f6b9` an sich selbst (09-12, vor der
Scharfschaltung), 6 Briefs, die das Wort nennen (`f6b9`, `db29`, `655c`, `489a`, `9b50`, diese Lane),
und 1 Server-Zustellung (Slot 7, nach dem Befund). Unter den 15 Treffern zur Zeit des Befunds war keine
`server.ts#laneMigrateMessage`. Die Server-Zustellungen (Text beginnt mit
`[fleet] Dein Kontext ist bei `): **11**, erste 2026-09-13T19:28:02Z, davon 10 an MAIN-Checkouts
(32–36 %, `.env` `FLEET_MIGRATE_PCT='32'`) und **eine** an eine Lane — Slot 7, 40,1 %.

Seit der Scharfschaltung wurden 61 Opus-5-Lanes gebrieft: Peak p50 17,3 %, p90 33,0 %, **eine** ueber
40 % (Slot 7). Was Slot 7 in den 10 min danach tat (Transkript `9f54cf9c…`, `c110e171…`):

- 17:32:34Z erster Request ueber 400 000; 17:34:56Z Nudge zugestellt.
- 17:35:09Z `git status --porcelain` leer, Handoff-Text in den Scratchpad: „the wave is DONE; there is
  nothing left to implement".
- 17:35:14Z fleet-report `status: handoff` (ok) und im selben Aufruf `POST /api/self/succeed` — die
  Session endet (Exit 137).
- 17:35:19Z Session 2 startet mit dem `[fleet staffelstab]`-Prompt, prueft Baum und Branch in einem Bash,
  bestaetigt um 17:35:31Z und geht idle.
- 17:52:42Z gelandet durch MAIN Slot 8; `lane-outcomes.jsonl` traegt `successions: 1`.

**Antwort (d): die eine genudgte Lane nahm die Tuer, 19 s nach dem Nudge; die Frage „warum keine" hat
keine Grundlage.** Die Nachfolge kostete 12 s, weil nichts mehr offen war.

### Messfehler, gefunden und gebaut

`lane-context-cost.ts#measureTranscript` las `endContext` als letzten Request ueber ALLE Dateien des
Transkript-Verzeichnisses. Fuer Slot 7 ergab das 78 729 — die 12 s der Nachfolgerin — statt des Peaks
403 568; eine fremde Probe-Session im selben Verzeichnis (`fd31d830…`, „probe ACP25-C0") zaehlte als Lane
mit. Seit der Staffelstab laeuft, liest das jede uebergebene Lane zu klein, also in die verbotene
Richtung. Neu: `peakContext` in den Metriken, ein optionaler Session-Filter und der `--budget`-Modus, der
jede Zahl dieser Notiz erzeugt; zwei Pins in `e2e/pins.ts` halten Peak, Filter und Toepfe fest. Die
A/B-Kohortentabellen behalten `endContext`, damit die datierten Reproduktionen der Quellpaket-Notiz
gleich bleiben.

## Entscheid

**E — nichts am Server bauen, die Lane-Schwelle bleibt 40 %.** Die Kandidaten an ihren Zahlen:
**A** (Budget-Ansage frueh, Nudge-Text) faellt: der eine Nudge wurde in 19 s befolgt, und von 61 Lanes
seit der Scharfschaltung haette eine fruehe Ansage 60 erreicht, die nie an die Schwelle kamen.
**B** (Wellen-Budget nach Kontext) traegt die Richtung — 3/4 Wellen ueber 40 % gegen 2/86 Einzel-Lanes,
Peak je Zeile wie eine Einzel-Lane —, aber nicht den Schnitt: alle 4 landeten, auditRed 0/4, und die
Folge eines Ueberlaufs ist genau die Nachfolge auf demselben Branch, die B vorschlaegt und die
`succeedLane` schon macht; n = 4 reicht fuer keine neue Konstante. **C** (Erdungskosten) faellt: der erste
Request ist bei langen Lanes gleich gross (70 630 gegen 69 575), der Unterschied sind 284 statt 77 Bash,
und die Quellpaket-Notiz (2026-09-14) fand keinen Erdungseffekt. **D** (Tool-Ausgaben-Disziplin) faellt:
Ergebnisse je Aufruf sind bei langen Lanes kleiner (≈ 1 340 gegen 2 290 Zeichen), ihr Topf ist 37 % —
selbst halbiert bliebe eine 45-%-Lane ueber 36 %. **E** traegt: (a) zeigt keinen Qualitaetsabfall ueber
Kontext, (d) zeigt, dass die bestehende Tuer bei der einzigen Ueberschreitung funktionierte. Kontext ist
fuer Lanes ein Kostenposten, keine Qualitaetsklippe. Neu zu messen, wenn eines kippt: rework3d/inserted
oder fix3d in > 40 % bei gleicher Landgroesse sichtbar ueber 30–40 % mit n ≥ 20, oder ≥ 10 Wellen-Lanes
mit geschlossenem Qualitaetsfenster.

## Korrekturen am Befund der Orchestratorin (2026-09-14 19:1x)

- „15 Staffelstab-Nudges an 5 Lanes, keine nahm die Tuer": 0 Server-Nudges unter diesen Treffern, der
  einzige Lane-Nudge (19:34 lokal, nach dem Befund) wurde genommen — siehe (d).
- „FLEET_LANE_MIGRATE_PCT live 44": `.env` traegt den Schluessel nicht (`grep -n MIGRATE .env` → nur
  `FLEET_MIGRATE_PCT='32'`), und eine Zustellung bei 40,1 % ist mit 44 unvereinbar. Der Env des laufenden
  Servers wurde nicht gelesen (keine Prozess-Kommandozeilen).
- „Eine Nachfolge JETZT wuerde die Hintergrund-Probe toeten": gut 20 min spaeter meldete die Lane selbst
  „nothing left to implement"; gelandet 17 min nach dem Nudge.
- Die Kommentarbehauptungen an `server.ts#LANE_MIGRATE_PCT` („output quality is what the fill costs") und
  der Nudge-Text („statt schlechter zu werden") sind fuer Lanes durch (a) nicht gedeckt. Nicht geaendert:
  der Text wirkt (1/1), und eine reine Wortkorrektur in `server.ts` kauft einen Isolated-Lauf fuer nichts.

## Methode

```sh
# Qualitaet: abgeleitete Sicht in den Scratchpad, nicht in die Ledger des Haupt-Checkouts
bun land-quality.ts --root /Users/owner/claude-fleet --since 14d --out $SP/lq14.jsonl
#   → 281 lands @38f5451d (2026-09-15T15:42:57.000Z)

# (a) (b) (c) (d) — alle Tabellen oben, wortgleich
bun lane-context-cost.ts --budget --quality $SP/lq14.jsonl --until 2026-09-15T15:42:57Z
# dieselben Zeilen als JSON (keine Brief-Texte, keine Kommandos)
bun lane-context-cost.ts --budget --json --quality $SP/lq14.jsonl --until 2026-09-15T15:42:57Z > $SP/budget.json

# Slot 7 und der Render-Vergleich aus dem JSON
bun -e 'const rows=await Bun.file(process.argv[1]).json();
  const s=rows.find(r=>r.branch==="fleet/260914163129-2bd0").peakSession; console.log(s, s.peak-s.first-s.ownOutput);
  const {median}=await import("./lane-context-cost.ts"), cut=Date.parse("2026-09-14T17:14:26+02:00"), from=Date.parse("2026-09-13T00:00:00+02:00");
  console.log(median(rows.filter(r=>r.briefAt>=from&&r.briefAt<cut).map(r=>r.peakSession.first)), median(rows.filter(r=>r.briefAt>=cut).map(r=>r.peakSession.first)))' $SP/budget.json

# (d) Treffer und Zustellungen
grep -c Staffelstab /Users/owner/claude-fleet/streams/prompts.jsonl                        # 17 = 10 [self] + 6 Briefs + 1 [fleet]
grep -c '\[fleet\] Dein Kontext ist bei' /Users/owner/claude-fleet/streams/prompts.jsonl    # 11
# Slot-7-Zeitleiste: ~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-260914163129-2bd0/{9f54cf9c,c110e171}*.jsonl
```

`$SP` ist ein Scratch-Verzeichnis. `land-quality.ts` ist deterministisch gegen `main` und die Ledger;
spaeter angehaengte Ledger-Zeilen verschieben die Grundmenge, `--until` haelt nur das Transkript-Fenster.

## Was nicht gemessen wurde

- Token- und Kontingentkosten: eine > 40-%-Lane liest bei jedem ihrer ~284 Turns ihren ganzen Kontext;
  diese Summe und was eine Nachfolge daran spart, ist nicht gerechnet. Ist sie der Grund fuer die
  Schwelle, dann ist die Schwelle ein Kostenargument, kein Qualitaetsargument.
- Qualitaet jenseits der drei Masse: Review-Befunde, Owner-Nacharbeit, Brief-Treue. rework3d kennt keine
  Move-Erkennung und rechnet Folge-Arbeit desselben Programs als Nacharbeit.
- 96 der 221 Lanes haben keinen rework3d-Wert (Fenster offen), darunter alle vier Wellen.
- Fable-Lanes (17) und Fremd-Harness-Lanes; kompaktierte Sessions wurden nicht getrennt (2 Lanes).
- Der Env-Wert des laufenden Servers fuer `FLEET_LANE_MIGRATE_PCT`.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-15T16:05:00Z	grundlage	Vorgaengernotiz 09-13 §2.2 als Basis, Join auf land-quality neu	landed/repairRounds schon gemessen, rework/fix/auditRed nicht	docs/messungen/2026-09-13-lane-kontext-sub-worker-glm.md	offen
2026-09-15T16:12:00Z	nudges	Staffelstab-Treffer nach Textkopf getrennt	Brief-Zeilen und [self]-Check-ins sind keine Server-Nudges	streams/prompts.jsonl	1 Lane-Nudge statt 15
2026-09-15T16:15:00Z	slot7	Transkript nach dem Nudge gelesen	Befund sagte keine Lane nahm die Tuer	c110e171…jsonl	Tuer in 19 s genommen
2026-09-15T16:20:00Z	messung	Peak-Session statt letzter Request	endContext las Nachfolgerin (78 729 statt 403 568)	lane-context-cost.ts#measureTranscript	peakContext + Filter gebaut
2026-09-15T16:30:00Z	toepfe	Rueckhalte-Test vor Topf-Zuordnung	ohne ihn ist Σ output_tokens kein Kontext-Topf	lane-context-cost.ts#sessionAnatomy	1.083, Ausgabe bleibt
2026-09-15T16:35:00Z	qualitaet	rework nach inserted geschichtet	rework3d>0 steigt mit Landgroesse	§a zweite Tabelle	kein Band-Effekt
2026-09-15T16:50:00Z	entscheid	E statt B	B-Richtung ja, n=4 und 4/4 landed, Nachfolge existiert	§c, §d	Schwelle bleibt
```

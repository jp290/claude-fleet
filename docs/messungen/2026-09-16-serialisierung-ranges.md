frage: Warum tragen 16 der 38 offenen server.ts-Zeilen null Ranges, und lässt sich Topf B (4 Zeilen, deren Karten Symbole NENNEN, denen aber wegen all-or-nothing in card-extract.ts alle Ranges der Datei verlorengehen) schließen, ohne den Filter anzufassen und ohne graphify zu reparieren?
urteil: Ja — der Deklarationsscan (task-metadata.ts#topLevelDeclarations, dieselbe Grammatik wie declaresSymbol) lokalisiert die vier Graph-Lücken-Symbole im Baum selbst (taskDigest@2792, acceptByLandReading@8820, RAIL_TAIL@25197, LANE_EXIT_FOOTER@11390) und füllt NUR Graph-Lücken als synthetische Index-Knoten; resolveSurfaceRanges re-resolviert die Karten-Symbole der vier Zeilen zum Lift-Zeitpunkt gegen den Index von jetzt (SURFACE_RESOLVER-Bump in surfaceSha zwingt jede gespeicherte Fläche zum einmaligen Neuberechnen), gemessen über den Produktionspfad tragen die vier Zeilen 1/2/3/4 server.ts-Ranges; der all-or-nothing-Filter card-extract.ts:374 bleibt UNANGETASTET — die Widerlegungspflicht erledigt sich, weil nie eine Teilliste entsteht, und das Teillisten-Argument des Kommentars wird systemweit geehrt (auch in resolveSurfaceRanges); Topf A (11 Zeilen ohne Symbol) und Topf C (27707a88, FLEET_CARD_MS=0) sind benannt und NICHT gebaut
bereich: [queue, land-waves, start-plan, ranges, card-surface, graphify]
belege: [task-metadata.ts#topLevelDeclarations, task-metadata.ts#readSymbolIndexSnapshot, task-metadata.ts#resolveSurfaceRanges, task-metadata.ts#SURFACE_RESOLVER, card-extract.ts#declaresSymbol, server.ts#taskSurfaceOf, task-land-waves.ts#collidesOn, start-plan.ts#rangesOn, e2e/tasks.ts (potb-Checks), docs/messungen/INDEX.md]
nicht-gemessen: der Live-Server projiziert die neuen Ranges erst nach Land und Deploy (der sha-Bump rechnet beim ersten Lesen neu); graphify selbst ist unverändert und graph-coverage.ts misst weiterhin die EXTRACTION, nicht den Resolver (die vier bleiben in seiner Fehlliste — das ist jetzt Dokumentation der Lücke, kein Auflösungsfehler); Topf A wurde nicht gezählt nach dem Fix (die 11 Zeilen nennen kein Symbol, der Scan erzeugt ihnen keine)
stand: 2026-09-16

---

# Serialisierung durch fehlende Ranges — Topf B geschlossen

2026-09-16, Lane `fleet/260916103126-952c`. Auftrag: Korrekturbrief der Orchestratorin
(10:5x, Nachtrag 11:1x) — nicht „Ranges einführen", sondern **die 16 Blocker reduzieren**, und
davon nur Topf B. Der Brief nennt als Messung: 38 offene Zeilen nennen server.ts, 22 tragen
Ranges auf server.ts (13×1, 7×2, 1×3, 1×4), 16 tragen keine — und weil `start-plan.ts#rangesOn`
ohne Ranges auf whole-file zurückfällt, blockiert jede dieser 16 die ganze Datei für alle.

## Die drei Töpfe (mit Zeilen-IDs, festgehalten)

- **Topf A (11 Zeilen, NICHT gebaut):** ee47b0f8 1832c7eb 9940ec64 2c306a87 b5665e17 04f55eba
  d02fd2bd 5aeaa29d a1610fd7 457ff5f0 69707f16 — die Karte nennt server.ts als DATEI, aber kein
  Symbol. Kein Code-Defekt: der Auftragstext hat nie eins genannt. Das ist Autoren-Disziplin; ob
  eine mechanische Hälfte sie tragen kann (Warnung beim Filen, Sensor in register.sh), ist ein
  Owner-Entscheid. **Nicht gebaut, weil nicht beauftragt** — und Raten von Symbolen ist verboten.
  Der Deklarationsscan hilft dieser Topf-Gruppe nicht: wer kein Symbol nennt, hat nichts, das der
  Scan lokalisieren könnte.
- **Topf B (4 Zeilen, GESCHLOSSEN):** 60fff186 a0474870 87ed77cf bc1d7866 — die Karte NENNT
  Symbole, bekommt aber 0 Ranges auf server.ts, weil card-extract.ts:374 all-or-nothing je Datei
  ist: genau vier Symbole lösen im Graph nicht auf, und ein einziges davon wirft die anderen,
  aufgelösten Ranges derselben Zeile weg.
- **Topf C (1 Zeile, NICHT gebaut):** 27707a88 — keine Karte, weil FLEET_CARD_MS=0 steht; eigene,
  heute gefilte Zeile der Orchestratorin. Für den server.ts-Schnitt (dieselbe Zeile) heißt der
  Befund: seine stärkste Begründung („die Datei serialisiert alles") ist widerlegt — 22 von 38
  Zeilen konnten schon vor diesem Fix nebeneinander laufen, nach dem Fix sind es 26. Der Schnitt
  ist inzwischen per Owner-Entscheid zurückgezogen; hier nur festgehalten, nicht vollzogen.

## Prüfung der Prämisse in einem Lauf (Nachtrag 2 des Briefs)

- `graphify-out/graph.json` (12.4 MB, 10:51): „label":"taskDigest" / "acceptByLandReading" /
  „RAIL_TAIL" / "LANE_EXIT_FOOTER" — **je 0 Treffer**. Auch die Konstanten fehlen dem Graphen
  völlig; es ist also keine Node-Kind-Lücke, die buildSymbolIndex überspringt.
- `declaresSymbol(server.ts, …)` nimmt **alle vier** an (top-level deklariert, Spalte 0).
- `bun graph-coverage.ts` führt taskDigest und acceptByLandReading in seiner Fehlliste
  (41 von 722 = 5,7 %) — Extraktionslücke von graphify, nicht Veraltung. Der Graph ist aktuell
  (gebaut 09:54 an 44c2ec26 = HEAD des Baums).

Damit ist Weg 2 über graphify ungangbar (graphifys Parser ist nicht Teil dieses Repos) — aber
der Brief hat die zweite Tatsache schon benannt: card-extract.ts#declaresSymbol prüft dieselben
Symbole **textlich gegen den Baum** und hat sie immer akzeptiert. Es fehlte nur die ZEILE.

## Der Weg: die zweite Tatsache zu Ranges vervollständigen

1. **task-metadata.ts#topLevelDeclarations** scannt eine Quelle in EINEM Durchlauf nach Spalte-0-
   Deklarationen (dieselbe Grammatik wie declaresSymbol — ein Muster, ein Modul, kein Drift;
   declaresSymbol und splitSymbolRef sind deshalb nach task-metadata gezogen und werden von
   card-extract re-exportiert). **readSymbolIndexSnapshot** scannt je Graph-Datei die Lücken und
   legt sie als synthetische Knoten in denselben buildSymbolIndex-Lauf — die Ends werden also
   genau so abgeleitet wie bei Graph-Symbolen. Der Graph gewinnt by construction: ein bekanntes
   Symbol wird nie doppelt gescannt, die Quelle nie überschrieben.
2. **resolveSurfaceRanges** re-resolviert beim Lift (server.ts#taskSurfaceOf) die Karte-SYMBOLe
   gegen den Index **von jetzt** statt die beim Filen gespeicherte Rangliste zu kopieren — nie
   Prosa, nur die eigenen Karten-Referenzen. Ohne Graph (Lane) steht die gespeicherte Liste.
3. **SURFACE_RESOLVER = "ranges-2"** geht in surfaceSha ein: der Resolver-Code ist eine Eingabe
   der Ableitung wie die zwei Baum-Stempel; der Bump zwingt jede gespeicherte Fläche zum
   einmaligen Neuberechnen nach dem Land, ohne dass ein Stempel sich bewegen muss.

**Zum Filter (Punkt 1 des Briefs, Widerlegungspflicht):** card-extract.ts:374 bleibt unangetastet.
Widerlegt werden muss nichts, weil die Situation, vor der der Kommentar warnt, nicht mehr
entsteht: eine Teilliste kam genau dadurch zustande, dass ein declares-akzeptiertes Symbol keine
Range hatte — mit dem Scan ist genau das Symbol lokalisiert. Das Argument des Kommentars gilt in
seinem Restbereich weiter (ein Symbol, das weder Graph noch Scan locaten kann) und wird jetzt
**systemweit** geehrt: resolveSurfaceRanges wendet dieselbe all-or-nothing-Regel je Datei an —
eine Datei, deren beanspruchte Symbole nicht ALLE auflösen, trägt keine Ranges für diese Datei
und fällt damit (falls confirmed) auf whole-file zurück, nie in „nur nahe dem aufgelösten".

## Messung nach dem Fix (DONE 2, Produktionspfad, `t.surface.ranges`-Äquivalent)

Der abgedruckte Einzeiler (task-metadata-CLI = dieselbe Ableitung, die der Server projiziert):

```sh
bun task-metadata.ts --state ~/claude-fleet/fleet.json --default-repo ~/claude-fleet \
  | bun -e 'const j = JSON.parse(await Bun.stdin.text()); for (const want of ["60fff186","a0474870","87ed77cf","bc1d7866"]) { const id = Object.keys(j.tasks).find(k => k.startsWith(want)); const rs = (j.tasks[id]?.ranges ?? []).filter(r => r.file === "server.ts"); console.log(id, "server.ts ranges:", rs.length, JSON.stringify(rs.map(r => r.symbol + "@" + r.startLine))); }'
```

Ausgabe (2026-09-16, gegen die lebende fleet.json der Hauptauscheckung):

```
60fff186 server.ts ranges: 1 ["taskDigest@2792"]
a0474870 server.ts ranges: 2 ["acceptByLandReading@8820","ADJUDICATION_VERDICTS@20853"]
87ed77cf server.ts ranges: 3 ["RAIL_TAIL@25197","railBlockFor@25312","buildSupervisorBindBrief@25629"]
bc1d7866 server.ts ranges: 4 ["buildLaneSuccessionBrief@7199","succeedLane@7228","laneHandoffReportFor@7182","LANE_EXIT_FOOTER@11390"]
```

Gegenprobe: `grep -n` im lebenden server.ts bestätigt genau diese Zeilen
(function taskDigest:2792, function acceptByLandReading:8820, LANE_EXIT_FOOTER:11390,
RAIL_TAIL:25197). 60fff186 läuft über den Text-Pfad (seine Karte trägt einen veralteten Gap,
`loadState`, das es nicht mehr gibt) und gewinnt taskDigest aus dem Fließtext seiner Zeile.

## Checks (DONE 3)

- **e2e/tasks.ts, Lift-Familie, drei `potb`-Checks** über `projectLandWaves`:
  disjunkte server.ts-Symbole → zwei Wellen; dasselbe Symbol → eine gemeinsame Welle; eine Zeile
  OHNE Ranges in der Datei → whole-file-Fallback (confirmed) und Kollision mit einer Ranged-Zeile.
  Mutationen, die diese rot machen: Überlappung auf always-false verengt (erste beiden), der
  `!ra.length || !rb.length`-Rückfall in `rangesCollide` entfernt (dritter).
- **Deklarations-Scan:** reiner Check der Grammatik (Einrückung und Kommentar sind keine
  Deklaration, Bekanntes wird nicht dupliziert, declaresSymbol liest dieselbe Grammatik) plus
  Produktions-Lesung gegen ein Temp-Checkout mit Fixtur-Graph — die synthetischen Knoten
  verschachteln sich korrekt in die Graph-Ranges (alpha 1–4, beta 5–6, Gamma 7–7).
- **resolveSurfaceRanges:** Teillisten-Schutz (eine unlokalisierbare Referenz wirft die RANGES
  ihrer Datei, nicht die anderen Dateien) und Lane-Verhalten (ohne Graph steht die gespeicherte
  Liste, nie eine Neuableitung).

## Was dieser Fix NICHT tut

- Topf A bleibt offen (11 Zeilen, Autoren-Disziplin, Owner-Entscheid über mechanische Hilfe).
- Topf C bleibt offen (27707a88, FLEET_CARD_MS=0).
- graphify bleibt unverändert; graph-coverage.ts misst weiter die Extraction.
- Der lebende Server zeigt die Ranges erst nach Land + Deploy.

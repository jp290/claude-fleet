---
frage: Wie sieht die Task Workbench nach den Slices ff535524 und 1b677e58 im ausgelieferten Bundle wirklich aus, und welche Erfolgskriterien des Programs sind damit erfuellt?
urteil: "Nachher-Baseline liegt vor: View-Split und Lane-Zeile und Spawn-Tripel sind live belegt; das Detail-Kriterium (Kopf mit Status/Program/Repo/Lifecycle, genau eine Hauptaktion ohne Scrollen bei 1440x900) ist GEMESSEN VERFEHLT und bleibt der Gegenstand von 15a3e38b."
bereich: [task-workbench, ux, sensorik]
belege: [src/client.ts#qEffectiveSpawn, src/client.ts#qDispatchBody, 497873f657c51bd0c069d21d6367e2b2f1b09e18, 8990fcb7fbda16d8532bac75d07c1faa7893d712, 3afb3f09]
nicht-gemessen: Leerzustand bei 0 offenen Tasks (live waren 74 offen), Tastaturfokus, zwei 2-s-Refreshes mit begonnenem Text, Suche ueber ID/Program/Repo, History-Ansicht
stand: 2026-09-02
---

# Nachher-Baseline der Task Workbench (Bundle 3afb3f0)

2. September 2026, 18:06-18:12, Program-MAIN „Fleet Task Workbench" (Slot 3). Gemessen mit dem
Playwright-Browser dieser Session gegen den LIVE-Server nach Deploy `b21b6749`.

## Welche zwei Baeume hier verglichen werden

Das ist der Satz, den die Vorgaenger-Notiz nicht hatte, und ohne ihn vergleicht die Notiz zwei
Baeume, ohne es zu sagen:

- **Vorher** (`docs/messungen/2026-09-01-task-workbench-visual-baseline.md`, drei PNGs vom
  2026-09-01 21:52-21:53): Live-Server auf `d4f2bfc`, Bundle 21:42, enthielt `01459c9`
  (View-Split), NICHT `ff535524` und NICHT `1b677e58`.
- **Nachher** (diese Notiz): Live-Server auf `3afb3f0`, Bundle gebaut 18:04 durch Deploy
  `b21b6749`. Health am Owner-Poll unmittelbar davor: `bundleStale.stale=false`,
  `deployGap.codeBehind=false`, `behindCount=0`. Enthaelt zusaetzlich `8990fcb` (ff535524,
  Lane-Zeile) und `497873f` (1b677e58, Spawn-Tripel).

## Erfuellt, live gesehen

- **Getrennte Ansichten:** Umschalter `Work | Programs | History | Waves`; die Gruppen in Work
  heissen `Released — runs next`, `Running`, `Backlog — about to start`. **Eine Closed-Gruppe
  existiert im Default nicht** (mechanisch abgefragt: die Gruppenkoepfe der Liste sind genau diese
  drei). Kopfzeile: `0 need you · 5 released · 2 running · 67 backlog`.
- **Lane-Zeile an der laufenden Task (ff535524):** eine Running-Zeile traegt
  `⎇ 260902154623-7fa9 · slot 2 · running · quiet 0m`, die zweite
  `⎇ 260902113526-4811 · slot 10 · done-looking · quiet…`. Branch UND Lane-Zustand stehen da, was
  die Vorgaenger-Notiz als fehlend vermass.
- **Spawn-Tripel an der ausfuehrbaren Zeile (1b677e58):** der Actions-Block zeigt `KIND` und
  darunter `HARNESS` (`default (claude)`), `MODEL` (Platzhalter `row: claude-fable-5-1[1m]`) und
  `EFFORT` (`row: high`), dazu die Wirkzeile
  `starts as · harness default claude (default) · model claude-fable-5-1[1m] (row) · effort high (row)`
  und die beiden Akte `▸ start lane — unchecked` und `▸ clarify first`. Die Herkunft je Feld
  (`(default)` / `(row)`) ist damit am Bildschirm sichtbar und nicht geraten.

## Verfehlt, mit Zahlen — der Gegenstand von 15a3e38b

Gemessen an einer gewaehlten `queued`-Zeile, Viewport 1440x900, Detail-Pane oben:

| Groesse | Wert |
| --- | --- |
| Viewporthoehe | 900 px |
| sichtbare Hoehe des Detail-Panes | 634 px |
| Scrollhoehe desselben Panes | 2240 px |
| Abstand `▸ start lane` von der Viewport-Oberkante | 2297 px |
| Hauptaktion ohne Scrollen sichtbar | nein |

Das Detail-Pane ist also 3,5 Bildschirme hoch, und die Hauptaktion liegt hinter dem gesamten
Langtext. Der Detail-KOPF besteht aus genau einem Wort — dem Status (`queued`). Program, Repo und
eine Lifecycle-Leiste fehlen; die Reihenfolge ist weiterhin `Overview & discussion` →
`file surface & cluster` → `comments` → `Refinement` (Rohtext) → `ACTIONS`.

**390x844:** einspaltig mit Zurueck-Pfeil, Umschalter ueber volle Breite; die Zaehlzeile wird
abgeschnitten (`… 2 running · 6…`), und die Aktionen liegen ebenfalls hinter dem Rohtext.

## Bilder

Ungetrackt im Wurzelverzeichnis des Haupt-Checkouts (`.gitignore` `/*.png`), weil sie Account-Pfade
ins Bild malen: `workbench-after-1440x900-work.png`, `workbench-after-1440x900-detail.png`,
`workbench-after-1440x900-spawn-triple.png`, `workbench-after-390x844-detail.png`.

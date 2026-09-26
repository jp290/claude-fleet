---
frage: Welche von vier Session-Marken (Greifarm, Kamon-Kern, Laterne, umverdrahteter Zweig) bestehen die vier Aufnahmebedingungen fuer einen spaeteren Einstellungs-Umschalter?
urteil: Keine. Bei allen vier liegt der kleinste Paarabstand im ruhenden Graubild unter 4,0 (0,93 / 1,40 / 0,52 / 1,72). A und Z trennen Arbeit und Warten, C und L unterschreiten dabei 4,0. Die reduzierte Ansicht ist bei allen vier als volles Standbild bytegleich. Die Kostenmessung schwankt unter Last; der dokumentierte Seitenlauf laesst nur C unter 2 % eines 60-Hz-Bildes. Umschalter-Liste leer, kein Default. Das ist ein Messergebnis, keine Produktentscheidung.
bereich: [leiste, session-marke, identitaet, creative-coding, renderer, aufnahme]
belege: [docs/design/sidebar/marken6.html, docs/design/sidebar/marken6.js, docs/design/sidebar/marken-daten.js, docs/design/sidebar/mess/fps.js, docs/design/sidebar/mess/bewegung.js, docs/design/sidebar/mess/reduced-motion.js]
nicht-gemessen: keine menschliche Erkennung von Rolle oder Zustand, kein Telefon und keine schwache Maschine; die vier Referenz-Vorbilder aus Groks Antwort haben keine Quellenlinks und gelten nicht als belegt; keine Produktausfuehrung und kein Einstellungsfenster.
stand: 2026-09-26
---

# Session-Marke, Runde 6: vier Renderer

Der Owner moechte mehrere Marken-Richtungen spaeter im Einstellungsfenster umschalten koennen. Die
Entwurfsseite `docs/design/sidebar/marken6.html` legt A, C, L und Z auf dieselben 16 Plaetze und
19 Sessions wie Runde 5. `seedOf` bleibt derselbe; beim Umstellen eines Platzes aendert sich der
Seed nicht. Jede Fassung bietet `layout(mark)` und `draw(ctx, mark, cache, t, reduced)` in
`marken6.js`. Die Seite besitzt die Runde-5-Schalter, `?arten=1`, `?tafel=1` und die Platzwahl.
Produktcode wurde nicht geaendert.

## 1. Was jeder Fakt traegt

| Fassung | Fakt | Mittel |
|---|---|---|
| A Greifarm | Rolle | Armzahl, Laenge und Reichweite (MAIN eins, Orchestratorin drei, Astra zwei, Steward kurz und breit, Lane kurz) |
| A Greifarm | Repo | Sockelprofil und Farbton aus demselben Repo-Fach |
| A Greifarm | Harness | rundes, eckiges oder ringfoermiges Gelenk |
| A Greifarm | Session | Segmentlaenge, Ruhe-Neigung, Phase aus dem festen Seed |
| A Greifarm | Zustand | Pick-Place-Bewegung; wartend oeffnet und streckt die Zange nach links |
| C Kamon-Kern | Rolle | Zahl und Anordnung der Innenelemente, Groesse des Siegels |
| C Kamon-Kern | Repo | Innenmotiv und Farbton aus demselben Repo-Fach |
| C Kamon-Kern | Harness | Punkt, Quadrat oder Ring als Kern |
| C Kamon-Kern | Session | fester Siegel-Drehwinkel und Kernphase |
| C Kamon-Kern | Zustand | nur der Kern kreist oder tickt links; das Siegel steht |
| L Laterne | Rolle | Gefaessumriss: Turm, Dreifuss, Doppelglas, Korb oder Stummel |
| L Laterne | Repo | Glasgitter und Farbton aus demselben Repo-Fach |
| L Laterne | Harness | runder, eckiger oder ringfoermiger Docht |
| L Laterne | Session | feste Neigung und Flammenphase |
| L Laterne | Zustand | Flamme flackert oder neigt sich wartend nach links |
| Z Zweig | Rolle | fuenf Topologien: Baum, drei Staemme, zwei Staemme, Busch, Mini |
| Z Zweig | Repo | Aderung/Internodien und Farbton aus demselben Repo-Fach |
| Z Zweig | Harness | Knospe, kahle oder gegabelte Spitze |
| Z Zweig | Session | feste Neigung und Wellenphase |
| Z Zweig | Zustand | arbeitend Welle Wurzel→Spitze; wartend ganze Pflanze nach links |

A sieht wie ein kleiner Zangenarm aus, der bei Arbeit zugreift und beim Warten die Zeile sucht.
C ist ein ruhendes Rundsiegel mit einem beweglichen Punkt im Innern. L ist ein Gefaess mit
kleiner Flamme. Z ist ein verzweigter Stamm, dessen Bewegung von der Wurzel zur Spitze laeuft.

## 2. Vier Aufnahmebedingungen

`?tafel=1&zustand=rest` zeichnet je Fassung alle 19 Sessions grau. Fuer jeden Vergleich liegen
MAIN mit 24 px und Lane mit 19 px in einer 24-px-Zelle bei festem DPR 2; die Lane ist mittig
gesetzt. Verglichen werden alle 171 Paare mit mittlerem absolutem Luma-Abstand (Rec. 709) ueber
48×48 Geraetepixel, wie Runde 5 §3.2. Der Zustandstest vergleicht je Session bei gleichem `t=0,7`
die Graubilder `work` und `need`. Die Bewegung zaehlt Pixel mit mehr als 12 Luma-Stufen Aenderung
nach 1,5 s. Ruhe und Schlaf muessen exakt 0,000 % sein. Der Seitenlauf misst bei 19 arbeitenden
Marken den Median aus fuenf 90-Bild-Durchlaeufen nach einem Warmlauf, geteilt durch 16,67 ms.

| Fassung | 1 Paare ≥4,0 | 2 Arbeit ↔ Warten ≥4,0; Ruhe/Schlaf 0 | 3 Kosten ≤2 % | 4 reduziert, volles Standbild |
|---|---|---|---|---|
| A Greifarm | **NEIN** 0,93 (4~6) | **JA** min 6,24 (3C); 0,000/0,000 % | **NEIN** 0,518 ms = 3,11 % | **JA** bytegleich, 8,94 % Tinte |
| C Kamon-Kern | **NEIN** 1,40 (4A~10A) | **NEIN** min 2,46 (3C); 0,000/0,000 % | **JA** 0,109 ms = 0,65 % | **JA** bytegleich, 19,84 % Tinte |
| L Laterne | **NEIN** 0,52 (1~4) | **NEIN** min 3,38 (15); 0,000/0,000 % | **NEIN** 0,451 ms = 2,71 % | **JA** bytegleich, 15,61 % Tinte |
| Z Zweig | **NEIN** 1,72 (4A~10A) | **JA** min 8,63 (3B); 0,000/0,000 % | **NEIN** 0,449 ms = 2,69 % | **JA** bytegleich, 11,02 % Tinte |

Die Seitenmessung zaehlt Bewegung ueber die 24-px-Vergleichszelle je Session. Ihr Anteil fuer
Arbeit/Warten ist A 9,110/5,297 %, C 3,570/1,078 %, L 3,305/0,704 %, Z 7,564/2,821 %.
Der Runde-5-Bildschirmfoto-Treiber `mess/bewegung.js` zeigt fuer Arbeit ueber die ganze Spalte
0,487/0,185/0,156/0,497 % und fuer Ruhe und Schlaf in allen vier Spalten 0,000 %.

Die separate `mess/fps.js`-Probe sah im Messfall 19 arbeitende Marken pro Spalte 43 Bilder/s
gleichzeitig und 0,149/0,078/0,113/0,390 ms je Bild (A/C/L/Z). Im ersten Lauf zuvor waren es
60 Bilder/s und 0,122/0,124/0,148/0,139 ms. Die Kosten sind auf diesem belasteten Mac nicht
stabil; fuer die Aufnahme gilt der explizite Seitenlauf oben, der die teureren Beobachtungen nicht
wegmittelt. Die Paarbedingung scheitert ohnehin bei jeder Fassung.

`mess/reduced-motion.js` lieferte normal verschiedene Bilder und reduziert zwei bytegleiche
Screenshots nach 2 s (je 179985 Bytes). In jedem der vier Markenstreifen standen sichtbare
Pixel ueber Stufe 24; es ist ein volles Standbild, keine leere Canvas.

## 3. Umschalter

**In den Umschalter: keine Fassung. Default: keiner.** A, C, L und Z scheitern alle an
Bedingung 1; C und L zusaetzlich an Bedingung 2. Der Seitenlauf sah A, L und Z auch ueber dem
Kostenlimit. Die Fassungen wurden nach diesem Befund nicht auf die Schwelle hin nachgebessert.

## Methode

Die Seite wird aus `docs/design/sidebar/` per HTTP serviert. Auf der laufenden Seite steht die
Aufnahme je Spalte und als `window.__aufnahme`; `?tafel=1&zustand=rest` zeigt den Kontaktbogen
und `window.__tafel`. Die Messskripte nehmen die URL als Argument; keine Host-Adresse wird hier
gespeichert. Die Chrome-Bilder und Logs lagen nur im Scratchpad ausserhalb des Repos.

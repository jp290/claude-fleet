---
frage: Welche von vier Session-Marken (Greifarm, Kamon-Kern, Laterne, umverdrahteter Zweig) bestehen die Aufnahmebedingungen relativ zum unveraenderten Zweig B aus Runde 5?
urteil: Keine. Der Runde-5-B-Kontrollrenderer misst in der alten Messart 6,11 wie in Runde 5 und in der neuen Messart 4,74. Die vier Entwuerfe erreichen in der neuen Messart nur 0,93 / 1,40 / 0,52 / 1,72 und verfehlen alle Bedingung 1. A und Z bestehen Zustand, alle vier bestehen die gepaarte Kostenrelation und reduced-motion. Umschalter-Liste leer, kein Default.
bereich: [leiste, session-marke, identitaet, creative-coding, renderer, aufnahme]
belege: [docs/design/sidebar/marken6.html, docs/design/sidebar/marken6.js, docs/design/sidebar/marken5.js, docs/design/sidebar/marken-daten.js, docs/design/sidebar/mess/fps.js, docs/design/sidebar/mess/reduced-motion.js]
nicht-gemessen: keine menschliche Erkennung von Rolle oder Zustand, kein Telefon und keine schwache Maschine; die von Grok ohne Links genannten Vorbilder gelten nicht als belegt; keine Produktausfuehrung und kein Einstellungsfenster.
stand: 2026-09-26
---

# Session-Marke, Runde 6: vier Fassungen und eine Kontrolle

Der Owner moechte mehrere Marken-Richtungen spaeter im Einstellungsfenster umschalten koennen. Die
laufende Entwurfsseite `docs/design/sidebar/marken6.html` legt A, C, L und Z auf dieselben 16
Plaetze und 19 Sessions wie Runde 5. `seedOf` bleibt derselbe; beim Umstellen eines Platzes aendert
sich der Seed nicht. Jede Fassung bietet `layout(mark)` und `draw(ctx, mark, cache, t, reduced)`.
Eine fuenfte Spalte traegt den unveraenderten Zweig B aus `marken5.js` als Kontrolle hinter
derselben Schnittstelle. Der Adapter verwendet `PflanzStage.bau` fuer dessen Layout,
`FASSUNGEN.zweig.paint` fuer die Zeichnung und die originale Zustands-/Farbregel. Runde 5 selbst
wurde nicht geaendert. Die Seite besitzt die Runde-5-Schalter, `?arten=1`, `?tafel=1` und die
Platzwahl. Produktcode wurde nicht geaendert.

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
| Kontrolle R5-B | alle Fakten | Originalmapping aus Runde 5: Repo-Art, Rollen-Wuchs, Harness-Spitze, Seed-Exemplar, Zustand-Wind/Rahmen |

A sieht wie ein kleiner Zangenarm aus, der bei Arbeit zugreift und beim Warten die Zeile sucht.
C ist ein ruhendes Rundsiegel mit einem beweglichen Punkt im Innern. L ist ein Gefaess mit
kleiner Flamme. Z ist ein verzweigter Stamm, dessen Bewegung von der Wurzel zur Spitze laeuft.

## 2. Zwei Messarten und die Plausibilitaetsprobe

Die **neue Messart** zeichnet jede Marke grau: MAIN 24 px, Lane 19 px, die Lane mittig in einer
24-px-Zelle. Bei festem DPR 2 vergleicht die Seite alle 171 Paare ueber 48×48 Geraetepixel mit
mittlerem absolutem Luma-Abstand (Rec. 709). Das ist die tatsaechliche Kleinansicht der Lanes.
Die **Runde-5-Messart** zeichnet alle 19 Marken in Farbe und 24 px, zieht aus denselben Pixeln die
Luma und vergleicht dieselben Paare. Die alte Schwelle 4,0 gilt nur fuer diese alte Messart; sie
wird hier nicht auf 19-px-Lanes uebertragen. `?tafel=1&zustand=rest` zeigt die neue Messart;
`&messart=r5` zeigt den zweiten Kontaktbogen.

| Fassung | Neu: grau, echte Groesse, kleinster | Wie Runde 5: Luma der Farbe, alle 24 px, kleinster |
|---|---:|---:|
| A Greifarm | 0,93 (4~6) | 0,70 (1~4) |
| C Kamon-Kern | 1,40 (4A~10A) | 1,32 (6~12) |
| L Laterne | 0,52 (1~4) | 0,36 (1~4) |
| Z Zweig | 1,72 (4A~10A) | 1,78 (4A~10A) |
| **Kontrolle R5-B** | **4,74 (3B~3C)** | **6,11 (3B~3C)** |

Die alte Kontrollzahl ist ungerundet **6,106668** und trifft Runde 5 §3.2 (**6,11**). Das ist
die Plausibilitaetsprobe fuer den Adapter und die Sonde. Der vorangegangene Bericht hatte
0,52–1,72 gegen die alte 4,0-Schwelle gehalten; dieser Vergleich war methodisch falsch.

## 3. Aufnahme relativ zu R5-B

Bedingung 1: kleinster Paarabstand der neuen Messart ≥ **4,735677** (Kontrolle). Bedingung 2:
`work` gegen `need` fuer jede Session bei gleichem `t=0,7` in derselben grauen Messart ebenfalls
≥ 4,735677; Ruhe und Schlaf bewegen exakt 0,000 % der Pixel. Bedingung 3: Zeichenzeit der
Fassung geteilt durch R5-B-Zeichenzeit im selben Durchlauf ≤ 3,0. Der Seitentreiber malt die
fuenf sichtbaren Canvas abwechselnd fuer 210 Bilder, verwirft 30 Warmlaufbilder und die oberen
und unteren je 10 % der Bildzeiten. Bedingung 4: reduzierte Bewegung zeigt ein volles, nach 2 s
bytegleiches Standbild.

| Fassung | 1 Paare | 2 Zustand | 3 Kosten | 4 reduziert |
|---|---|---|---|---|
| A Greifarm | **NEIN** 0,93 < 4,74 | **JA** min 6,24; Ruhe/Schlaf 0,000 % | **JA** 0,197/0,288 = 0,68× | **JA** |
| C Kamon-Kern | **NEIN** 1,40 < 4,74 | **NEIN** min 2,46; Ruhe/Schlaf 0,000 % | **JA** 0,126/0,288 = 0,44× | **JA** |
| L Laterne | **NEIN** 0,52 < 4,74 | **NEIN** min 3,38; Ruhe/Schlaf 0,000 % | **JA** 0,185/0,288 = 0,64× | **JA** |
| Z Zweig | **NEIN** 1,72 < 4,74 | **JA** min 8,63; Ruhe/Schlaf 0,000 % | **JA** 0,290/0,288 = 1,00× | **JA** |
| Kontrolle R5-B | Referenz 4,74 | min 24,59; Ruhe/Schlaf 0,000 % | Referenz 0,288 ms | bytegleich |

Die Kostenwerte stammen aus einem Seitenlauf. Ein zweiter gepaarter Lauf ergab Verhaeltnisse
A/C/L/Z von 0,63/0,42/0,65/0,93; die absoluten Zeiten wechselten mit der Hostlast. Alle acht
beobachteten Verhaeltnisse blieben unter 3,0. Die Seite zeigt den aktuellen Durchlauf und
berechnet die JA/NEIN-Werte selbst.

Der Pixelanteil mit mehr als 12 Luma-Stufen Aenderung nach 1,5 s ueber die Vergleichszellen
(Arbeit/Warten/Fehler) war A 9,110/5,297/6,200 %, C 3,570/1,078/0,873 %,
L 3,305/0,704/0,000 %, Z 7,564/2,821/0,000 % und R5-B 13,882/7,984/6,437 %.
Ruhe, Schlaf und Fertig blieben bei allen fuenf 0,000 %. Der Runde-5-Bildschirmfoto-Treiber
`mess/bewegung.js` mass ueber die ganze Spalte fuer die vier Entwuerfe bei Arbeit
0,487/0,185/0,156/0,497 % und bei Ruhe/Schlaf ebenfalls 0,000 %.

Die breite Bildschirmfoto-Probe (1450 px, alle fuenf Spalten sichtbar) mit
`mess/reduced-motion.js` lieferte normal unterschiedliche Bilder und reduziert zwei bytegleiche
Screenshots nach 2 s (je 208012 Bytes). In allen fuenf Markenstreifen standen Pixel ueber Stufe
24; es ist ein volles Standbild.

**Z-Cache-Pruefung:** Beim Umschalten auf Arbeit rief die Seite `Z.layout()` 22-mal fuer die 21
Zeilen und die Lupe auf; nach zwei Sekunden Animation stand der Zaehler weiter bei 22.
`MarkenStage.paint()` verwendet den Cache, nur `Z.draw()` berechnet die animierte Astbahn je
Bild. Der vermutete erneute `layout()`-Aufruf je Bild ist kein Bug. Die Gestalt blieb unveraendert.

## 4. Umschalter

**In den Umschalter: keine Fassung. Default: keiner.** A, C, L und Z scheitern alle an
Bedingung 1. Die Kontrolle R5-B ist nur die Latte und kein Kandidat. Die vier Fassungen wurden
nach dem Befund nicht auf die Schwelle hin nachgebessert.

## Methode

Die Seite wird aus `docs/design/sidebar/` per HTTP serviert. Auf der laufenden Seite steht die
Aufnahme je Spalte und als `window.__aufnahme`; beide Kontaktbogen-Messarten stehen unter
`?tafel=1&zustand=rest` beziehungsweise `&messart=r5` und als `window.__tafel`. Die Messskripte
nehmen die URL als Argument; keine Host-Adresse wird hier gespeichert. Chrome-Bilder und Logs
lagen nur im Scratchpad ausserhalb des Repos.

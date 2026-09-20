---
frage: Wie werden die Sessions in der linken Leiste auffälliger UND übersichtlicher, ohne eine zweite Identität zu erfinden?
urteil: Der Zustand trägt heute 45 von 9120 Pixeln einer Zeile (0,49 %) — das ist der Grund für beide Klagen zugleich. Die Antwort ist eine abgeleitete Session-Marke auf dem vorhandenen Algorithmus (projectHue) mit vier Kanälen: Farbton = Projekt, Muster = Harness, Seed = Slot + openedAt, Bewegung = Zustand. Drei Varianten gebaut und gemessen; Empfehlung A als Grundlage, C als Aufsatz, B nur für den Fehlerfall.
bereich: [leiste, session-marke, identitaet]
belege: [src/client.ts#projectHue, src/client.ts#projectOf, src/icons.ts#harnessMark, src/flakes.ts, public/index.html, docs/design/sidebar/marken.js, docs/design/sidebar/marken-a.html, docs/design/sidebar/marken-b.html, docs/design/sidebar/marken-c.html]
nicht-gemessen: kein Produktcode, keine Suite; die CSS-Animationen der Variante B sind nicht in der Zeichenmessung enthalten; versteckter Tab nur am Code belegt, nicht gemessen; keine Messung auf einem echten Handy.
stand: 2026-09-20
---

# Die Session-Marke: auffällig und übersichtlich als dieselbe Sache

Owner-Auftrag 2026-09-20 (über die Orchestratorin, wörtlich): „die session der leiste links hat unser
ui overhaul design recht erfolgreich angewendet, es ist nur leider zu unauffällig und dabei auch
unübersichtlich … Was wenn wir uns hierfür irgendeinen krassen Algorhythmus überlegen der Sessions
irgendwie richtig gut design, mit farben, mustern, effekten, partikeln usw. … Vielleicht darf sich
der Teil irgendwie lebendig anfühlen."

## 1. Was die Übersicht heute kostet (gemessen, nicht gefühlt)

Zwei Zeilen der heutigen Leiste, identisch bis auf EINEN Fakt, gerendert und Pixel für Pixel
verglichen (228 px breit, eine Zeile = 9120 Pixel im Rahmen der Messung):

| Unterschied | Pixel | Anteil der Zeile |
|---|---|---|
| arbeitet vs. ruht | 45 | 0,49 % |
| Projekt A vs. Projekt B | 91 | 1,00 % |

**Die Gleichförmigkeit ist der Befund.** 99 % jeder Zeile sind unabhängig von Zustand und Projekt
dieselben Pixel; der Zustand hängt an einem 7-px-Punkt (`.slot .act`, `public/index.html:134`), das
Projekt an einer 3-px-Kante (`.slot.proj`, dort `:334`). Bei 16 Plätzen stehen damit 16 optisch
gleich schwere Zeilen untereinander, und nichts sagt dem Auge, welche gerade arbeitet: eine seit
12 h schlafende Session ist genauso hell wie eine, die gerade schreibt. „Unauffällig" und
„unübersichtlich" sind deshalb nicht zwei Klagen, sondern eine.

## 2. Die Ableitung: ein Algorithmus, keine zweite Identität

Gebaut auf `src/client.ts#projectHue` (acht quantisierte Töne, „one hue per checkout, derived, never
stored"; die Begründung gegen ein Kontinuum steht dort im Kommentar) — unverändert übernommen.
Dazugekommen sind nur Fakten, die der Server ohnehin liefert:

| Kanal | Fakt | Mittel |
|---|---|---|
| Farbton | Projekt | `projectHue(repo)`, acht Töne, unverändert |
| Muster | Harness | claude = Ringe · codex = Zeilen · pi = Gitter (`src/icons.ts#harnessMark` kennt genau diese drei) |
| Variante | Slot + `openedAt` | FNV-1a-Seed; dieselbe Session zeichnet nach Reload und Neustart dasselbe Zeichen |
| Rahmen | Rolle | MAIN geschlossen, Lane offen — trägt ohne Farbe |
| Bewegung | Zustand | arbeitet läuft · ruht steht · schläft ist gedimmt · rot bricht mit roter Schraffur |

Code: `docs/design/sidebar/marken.js` (`drawMark`, `MarkTicker`, `Mark`). Nichts wird gespeichert,
nichts gewürfelt: derselbe Slot mit derselbe Öffnungszeit ergibt immer dasselbe Bild.

## 3. Drei Varianten (Prototypen, nicht gelandet)

Jede zeigt 16 Plätze, 19 bzw. 33 Marken, drei Projekte, drei Harnesses, alle Zustände, MAIN und Lane.

**A · Marke** (`marken-a.html`) — ein 22-px-Zeichen an der Stelle des heutigen Punkts, sonst bleibt
die Zeile die Chat-Sprache.
- Mittel: Farbton Projekt, Muster Harness, Bewegung Zustand; die Liste selbst ändert sich nicht.
- Kosten: ein Bild über 8 bewegte von 19 Marken = **0,06 ms**, bei 8 Bildern/s **0,05 % eines Kerns**
  (ein gemeinsamer rAF-Takt für alle Marken, nicht einer je Marke).
- Kippt, wenn: mehr als etwa sechs Sessions gleichzeitig arbeiten — dann bewegt sich überall etwas.
  Gegenmittel im Entwurf: nur das Zeichen bewegt sich, 8 Bilder/s, ein Durchlauf dauert 9 s.

**B · Aura** (`marken-b.html`) — wie A, zusätzlich trägt die arbeitende ZEILE ein schwaches Feld im
Projektton, durch das ein Licht wandert, dazu drei Staubkörner in ihrem Ton.
- Mittel: dasselbe wie A, plus Feld und Licht ausschließlich für arbeitend/rot; ruhend ist schwarz.
- Kosten: Canvas **0,10–0,13 ms** je Bild; dazu **32 CSS-Animationen** (8 Lichter, 24 Staubkörner),
  die in dieser Messung NICHT enthalten sind.
- Kippt, wenn: etwa fünf Zeilen gleichzeitig arbeiten — dann leuchtet die halbe Leiste, und
  „auffällig" ist wieder „unübersichtlich". Genau der Fehler, den der Auftrag verbietet.

**C · Panel** (`marken-c.html`) — über der Liste ein 4×4-Feld mit allen 16 Plätzen; Platz 7 ist immer
dieselbe Zelle. Die Liste darunter wird einzeilig.
- Mittel: dieselben vier Kanäle, größer (34 px); zusätzlich trägt der ORT die Adresse, Lanes als
  Punkte in der Zellenecke.
- Kosten: ein Bild über 13 bewegte von 33 Marken = **0,06–0,08 ms**, **0,1 % eines Kerns**; die
  Leiste verliert 150 px Höhe an das Feld.
- Kippt, wenn: der Deckel über 16 Plätze wächst (das Raster ist auf 4×4 gebaut) oder die Leiste
  schmaler als 200 px wird.

### Was die Marke misst (Variante A, dieselbe Messmethode wie §1, Zeile 252×44 = 11 088 Pixel)

| Unterschied | Pixel | Anteil | heute |
|---|---|---|---|
| arbeitet vs. ruht | 644 | 5,81 % | 45 px / 0,49 % |
| ruht vs. schläft | 898 | 8,10 % | 0 px (heute nicht unterschieden) |
| arbeitet vs. rot | 660 | 5,95 % | 45 px |
| Projekt A vs. Projekt B | 340 | 3,07 % | 91 px / 1,00 % |

Der Zustand trägt damit das **14-fache** seines heutigen Gewichts, das Projekt das **3,7-fache**.

## 4. Die harten Grenzen, je Variante geprüft

- **prefers-reduced-motion**: `MarkTicker.moving` ist dann falsch, es wird genau ein Standbild
  gezeichnet. Beleg: derselbe Bildschirm mit `--force-prefers-reduced-motion` unterscheidet sich vom
  laufenden um 0,52 % der Pixel (die Phase der bewegten Marken), alle Marken sind da.
- **Versteckter Tab**: `visibilitychange` → `sync()` → kein rAF. Am Code belegt, nicht gemessen.
- **Kein Layout-Sprung**: jede Marke hat ein Canvas fester Größe; ein Aktualisieren zeichnet nur
  hinein. Die Zeilenhöhe hängt an keiner Marke.
- **Ohne Farbe lesbar**: dieselben Bilder in Graustufen (`c16-marke-*-ohne-farbe.png`). Mittlerer
  Helligkeitsabstand der Musterfamilien: Ringe↔Zeilen 17,5 · Zeilen↔Gitter 12,3 · Ringe↔Gitter 8,5
  (0 hieße ununterscheidbar). Dazu tragen Rahmen (Rolle) und in C die Zellenposition.
- **Text bleibt lesbar**: die Marke sitzt neben dem Text, nie darunter; Label und Zahlen behalten die
  Farben der Chat-Ansicht (`--chat-ink`/`--chat-prose` auf Schwarz).

## 5. Empfehlung

**A als Grundlage, C als Aufsatz, B nicht.** A löst den gemessenen Befund (Zustand 14-fach, Projekt
3,7-fach) ohne die Liste umzubauen und ist die billigste Variante. C ist die einzige, die
„unübersichtlich" STRUKTURELL angeht: ein fester Ort je Platz macht den Fleet in einem Blick lesbar,
und der Ort überlebt jede Übergabe — das passt zum bestätigten Modell (Band = Slot-Nummer). B ist
gebaut und schön, aber ihr Feld skaliert mit der Zahl der arbeitenden Sessions und frisst damit
genau die Ruhe, aus der die Übersicht kommt; ihr roter Fall (Aura + schnellerer Puls) ist der einzige
Teil, den ich behalten würde — als Fehlerdarstellung in A.

Stilgrenze: die Öffnung gilt nur für die Session-Marke in der linken Leiste. Chat-Prosa, Queue-Texte
und die rechte Spalte bleiben neutral (`8874/design-prompt.md`).

## Methode

```
# Prototypen (nur Vorschau, nicht gelandet)
# Vorschau-Server auf Port 8890 mit Wurzel docs/design/sidebar/ (Adresse steht nicht im Baum):
#   marken-a.html · marken-b.html · marken-c.html
# Bilder auf der Vorschau der Chat-Lane
c16-marke-a.png · c16-marke-b.png · c16-marke-c.png · c16-marke-*-ohne-farbe.png
c16-marke-a-reduced-motion.png
# Signalmessung: zwei Renderings, die sich in genau einem Fakt unterscheiden, Pixel verglichen (PIL)
# Zeichenkosten: MarkTicker#bench — 60 volle Durchläufe über alle bewegten Marken, ms je Durchlauf
```

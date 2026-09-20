# Messtreiber für die Session-Marke, Runde 3

Die fünf Dateien hier sind die BROWSER-FERNSTEUERUNG zu den Prototypen eine Ebene höher. Sie liegen
im Baum und nicht im Scratchpad, weil die Zahlen in
`docs/messungen/2026-09-20-session-marke-laufende-systeme.md` sonst nicht nachfahrbar wären: die
Prototypen-Seiten allein zeigen das Bild, sie messen es nicht.

Alle fünf erwarten einen Vorschau-Server mit Wurzel `docs/design/sidebar/`. Die Adresse steht
absichtlich in keiner Datei — sie wird als Argument übergeben.

| Datei | misst | wie |
|---|---|---|
| `shot.sh` | — | ein Bild je Seite, Chrome headless, 1100×900 CSS bei dpr 2 |
| `fps.ts` | Bilder je Sekunde und Zeichenkosten | DevTools-Protokoll an einem Chrome MIT Compositor; headless ohne Compositor meldet 0, und 0 ist kein Messwert |
| `reduced-motion.ts` | ob `prefers-reduced-motion` wirklich alles anhält | zwei Bildschirmfotos im Abstand von 2 s, verglichen werden die BYTES |
| `bewegung.ts` | ob der Zustand am laufenden System ablesbar ist | schaltet die Zustände über die Knöpfe der Seite, je zwei Bilder im Abstand von 1,5 s |
| `kontaktbogen.py` | Unterscheidbarkeit auf 24 px | schneidet `marken-tafel.html` an den bekannten Rasterstellen und vergleicht alle 171 Paare |

Beide `.ts` brauchen `S` im Environment (Verzeichnis für die Bilder) und laufen mit `bun`.
`kontaktbogen.py` braucht `numpy` und `Pillow`.

**Eine Falle, die hier schon bezahlt ist:** `bewegung.ts` zählt zuerst die mittlere
Helligkeitsänderung — und damit ein gleichmäßiges Abdunkeln als Bewegung. Gezählt wird deshalb der
ANTEIL der Pixel, die sich um mehr als 12 Stufen ändern. Ein Zerfall ist kein Zappeln.

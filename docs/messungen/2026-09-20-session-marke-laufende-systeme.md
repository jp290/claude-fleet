---
frage: Was ist die Session-Marke, wenn sie kein Zeichen mehr ist, sondern ein winziges laufendes System je Session?
urteil: Drei laufende Systeme gebaut (Stroemung, Automat, Attraktor), eine Canvas je Leiste, Bauform aus src/flakes.ts. Der tragende Entwurfssatz loest den Widerspruch zwischen „laufendes System“ und „Seed fixieren“: was laeuft, ist der Zustand, was steht, ist die Regel — damit fallen Wachstum, DLA und Reaktions-Diffusion als Kandidaten aus, bevor Code geschrieben ist. Gemessen: 60 Bilder/s bei 19 laufenden Marken je Spalte und allen drei Spalten gleichzeitig, 0,4 bis 2,6 % eines 60-Hz-Bildes; reduced-motion haelt alles an (zwei Bildschirmfotos im Abstand von 2 s sind byteweise gleich, und es ist ein volles Standbild, kein leeres); kein Marken-Paar unter der Verwechslungsschwelle in keinem der drei Systeme, mit und ohne Farbe. Empfehlung: C Attraktor — er gewinnt die Identitaet genau an den Paaren, an denen Runde 1 gescheitert ist (39,2 ohne Farbe gegen 26,5 und 19,0). Drei Entwurfsfehler sind unterwegs gemessen und behoben worden, darunter einer, der jede Identitaet ueber Geraete hinweg gebrochen haette: Math.sin ist in ECMAScript implementierungsabhaengig.
bereich: [leiste, session-marke, identitaet, creative-coding]
belege: [docs/design/sidebar/marken3.js, docs/design/sidebar/marken-laufend.html, docs/design/sidebar/marken-mess3.html, src/flakes.ts, drops/1789897193133-Bericht_Creative_Coding_JS_Python_Agentenbriefing.docx]
nicht-gemessen: kein Produktcode, keine Suite, kein src/client.ts; kein Test mit einem Menschen; keine Messung auf einem echten Handy; keine Messung auf einer schwachen Maschine (alles auf diesem Mac); der Stromverbrauch ist nicht gemessen, nur die Rechenzeit; wie die Systeme nach Stunden Laufzeit aussehen, ist nicht beobachtet, nur nach Sekunden.
stand: 2026-09-20
---

# Die Marke als laufendes System

Owner-Kurswechsel 2026-09-20, wörtlich: „ne. Ich glaube wir brauchen hier nochmal nen ganz neuen
kreativen ansatz." Grundlage ist der beigelegte Recherchebericht zu Creative Coding, und ein Satz
daraus bestimmt alles Weitere: **„Das Werk ist das laufende System, nicht der Screenshot."**

A2, D und E aus Runde 2 sind damit nicht die Wahl. Sie bleiben als Messung stehen
(`docs/messungen/2026-09-20-session-marke-runde-2.md`); gebaut wird keine von ihnen.

## 1. Der Widerspruch, der die ganze Runde trägt

Der Auftrag verlangt zwei Dinge, die einander widersprechen:

| aus dem Bericht | aus dem Fleet |
|---|---|
| „Das Werk ist das laufende System" — es bewegt sich, es verändert sich | „Seed fixieren" — dieselbe Session, dieselbe Marke, über Neustart und Re-Slotting |

**Ein laufendes System verändert sich. Eine Identität darf das nicht.**

Die Auflösung ist die eigentliche Entwurfsarbeit dieser Runde und steht als erster Kommentar in
`marken3.js`: *Was läuft, ist der Zustand; was steht, ist die Regel.* Das Feld, die Regelnummer, die
Attraktor-Parameter kommen aus dem Seed und ändern sich nie — sie sind sichtbar, auch wenn das
System eingefroren ist. Die Bewegung darüber ist der Zustand der Session.

Daraus fällt eine ganze Familie von Kandidaten heraus, bevor eine Zeile Code geschrieben ist: **ein
System, dessen Bild erst durch das Laufen ENTSTEHT — Wachstum, DLA, Reaktions-Diffusion — hat keine
Identität, solange es ruht.** Es wäre schöne Kunst und ein unbrauchbares Werkzeug. Deshalb stehen
unten Strömung, Automat und Attraktor: bei allen dreien ist die Regel im Standbild lesbar.

## 2. Ein Vokabular für den Zustand, drei Systeme, die es sprechen

Der Zustand moduliert das laufende System, er färbt es nicht. Alle drei Systeme lesen dieselben drei
Zahlen (`MOD` in `marken3.js`), deshalb sagen sie dasselbe über den Betrieb, obwohl sie völlig
verschiedene Bilder erzeugen:

| Zustand | `drive` | `erode` | `noiseIn` | was man sieht |
|---|---|---|---|---|
| arbeitet | 1 | 0 | 0 | das System lebt |
| wartet (`need`) | 0,55 | 0 | 0 | läuft langsamer, dazu ein atmender Rahmen — der einzige Zustand, der über den Rand der Zelle hinausgeht |
| ruht | 0 | 0 | 0 | friert ein; das Bild bleibt vollständig stehen |
| fertig | 0 | 0 | 0 | steht, dunkler |
| schläft | 0,13 | 0,012 | 0 | zerfällt sichtbar, ohne je ganz zu verschwinden |
| Fehler | 1,4 | 0 | 0,5 | die Regel selbst wird gestört, schneller und falsch |
| frei | — | — | — | kein System, nur ein Rahmen, der die Achse der Spalte hält |

Dass `sleep` nie ganz ausgeht, ist kein Detail: ein Platz ohne Marke reißt die Achse der Spalte auf
— derselbe Befund, der in Runde 2 unter (6) stand.

**Hartes Constraint, aus dem Bericht („eine Farbe, eine Form"):** jede Marke hat genau EINEN Farbton
— den des Projekts — und variiert nur die Helligkeit. Kein zweiter Ton, kein Verlauf, kein
Schlagschatten. Rot ist die einzige Ausnahme und überschreibt den Projektton, weil ein Fehler kein
Projektmerkmal ist.

**`noise()` statt `random()`:** `Math.random` kommt in `marken3.js` nicht vor. Jede Marke hat einen
eigenen deterministischen Strom (mulberry32) aus ihrem eigenen FNV-Seed, und das Strömungsfeld
kommt aus Wert-Rauschen mit `smoothstep`-Interpolation — benachbarte Gitterpunkte laufen weich
ineinander, statt unabhängig zu würfeln.

## 3. Die Bauform: EINE Canvas, EIN requestAnimationFrame

Vorbild ist `src/flakes.ts`, nicht ein neuer Renderer: eine Canvas, eine Schleife, ein `sync()`, das
auf sichtbaren Tab UND `prefers-reduced-motion` prüft und im Zweifel ein Standbild malt statt nichts.
Der Unterschied zu Runde 1 und 2: dort hatte jede Marke ihre eigene Canvas. Hier liegt EINE Canvas
hinter der ganzen Liste, und die Zellen bekommen ihre Rechtecke aus dem gemessenen Layout der
Zeilen, nicht aus geratenen Zahlen.

**Was die eine Canvas kostet, ist eine eigene Lektion:** weil die Systeme AKKUMULIEREN, wird die
Fläche nie ganz geleert — jede Zelle dunkelt nur ihr eigenes Rechteck. Damit malt eine Zelle, deren
Agenten über den Rand laufen, dauerhaft in ihre Nachbarn hinein, und diese Spur verschwindet nie,
weil sie außerhalb des gedunkelten Rechtecks liegt. Im ersten gerenderten Bild stand das als
Streifen quer durch die Spalte. Jede Zelle bekommt deshalb ihren eigenen Schnitt (`ctx.clip`).

## 4. Die drei Systeme

Je drei Zeilen, wie beauftragt: Regel, Kosten, wo es kippt. Die Kosten sind ein volles Bild ueber
alle 21 Zellen einer Spalte, 19 davon laufend, gemessen im Browser (`MarkStage#bench`, 90 Bilder).
Der Anteil bezieht sich auf das Zeitbudget eines Bildes bei 60 Hz (16,67 ms).

**A · Strömung** — ein Vektorfeld aus Wert-Rauschen; sieben Agenten schwimmen darin und ziehen Spuren.
- *Regel:* Der Winkel an jeder Stelle kommt aus zweidimensionalem Wert-Rauschen mit Seed; die
  Identität ist das FELD, und weil es feststeht, zeichnen zwei Sessions zwei verschiedene
  Linienbilder — auch eingefroren.
- *Kosten:* **0,07 ms** je Bild, **0,4 %** eines 60-Hz-Bildes. Das billigste der drei.
- *Kippt bei:* 24 px fassen nur zwei bis vier Wirbel. Das ist zu wenig Topologie, und die Marken
  werden einander ähnlich — im Kontaktbogen sind es neunzehn Varianten von „ein paar gebogenen
  Kratzern". **Die Messung bestätigt es: kleinster Abstand 14,5 ohne Farbe, der schlechteste
  Median der drei (24,9), und im harten Fall 19,0.** Das System hat seine eigene Kippbedingung
  getroffen.

**B · Automat** — ein elementarer zellulärer Automat; aus einer Zeile wird die nächste, das Bild scrollt.
- *Regel:* Die Regelfamilie kommt vom Harness (claude symmetrische Fraktale · codex einseitige
  Dreiecke · pi Bänder), die Regel darin und die Anfangszeile aus dem Session-Seed.
- *Kosten:* **0,31 ms** je Bild, **1,9 %**. Gezeichnet wird nur bei einem Takt, nicht bei jedem Bild.
- *Kippt bei:* Dichte. Mit den berühmten chaotischen Regeln (30, 45, 105) und einer dichten
  Anfangszeile war das Ergebnis exakt die Rauschwand, vor der die Zeile warnt — fünf claude-Marken
  nebeneinander sahen aus wie fünfmal Fernsehschnee (§5.1). Auch behoben hat der Automat mit
  **61,7 % Tinte** die weitaus vollste Zelle der drei: sechzehn davon untereinander sind viel Bild.

**C · Attraktor** — eine iterierte Abbildung (Clifford), vier Parameter aus dem Seed, akkumulierend gezeichnet.
- *Regel:* Vier Parameter, ein Punkt, der für immer auf derselben Figur wandert. Der Formenraum ist
  so groß, dass zwei Seeds nie gleich aussehen — im Kontaktbogen ist jede Marke ein eigener kleiner
  Körper.
- *Kosten:* **0,43 ms** je Bild, **2,6 %**. Das teuerste der drei und immer noch ein Vierzigstel
  des Budgets.
- *Kippt bei:* Parametersätzen, die zusammenfallen. Ohne Rückweisung ist die Marke leer — und die
  Rückweisung selbst war zweimal falsch gebaut (§5.1). Dazu: seine Bewegung ist die leiseste der
  drei (0,72 % gegen 2,31 % beim Automaten), das System wirkt ruhiger als es ist.

## 5. Was gemessen ist

### 5.1 Drei Entwurfsfehler, unterwegs gemessen und behoben

Sie stehen hier, weil sie die eigentliche Arbeit waren — und weil jeder von ihnen ein Bild erzeugt
hat, das plausibel aussah und falsch war.

**(1) `Math.sin` ist in ECMAScript implementierungsabhängig — das bricht jede Identität.** Dieselben
Seeds ergaben in Bun (JavaScriptCore) und in Chrome (V8) verschiedene Bahnen: die Belegung des
Attraktors von Slot 1 war dort 71, hier 48 Felder. Bei einem chaotischen System genügt ein
Unterschied in der letzten Stelle. Für ein Zeichen wäre das egal; für eine IDENTITÄT heißt es, dass
dieselbe Session auf dem Telefon anders aussieht als auf dem Rechner. Behoben mit einem eigenen
Sinus (Reduktion auf [-π, π], Taylor bis x¹¹, nur +, ·, / und `Math.floor`). Er ist nicht genauer
als `Math.sin`, aber überall derselbe. **Beleg:** `marken-engine-probe.html` gibt je Session
Belegung und Bahnpunkt aus; dasselbe Stück läuft in Bun direkt gegen `marken3.js`. Die 19 Zeilen
stimmen jetzt byteweise überein, vorher nicht.

**(2) Die Rückweisung des Attraktors maß zweimal das Falsche.** Erst die Spannweite — die besteht
ein periodischer Orbit aus fünf Punkten mühelos, und im Bild standen fünf Punkte. Dann die Belegung
eines 12×12-Rasters, aber über die Iterationen 120 bis 600 — das ist bei manchen Parametersätzen noch
der Einschwingvorgang: Slot 1 sah dort mit 48 belegten Feldern gesund aus und lief danach auf einen
Zyklus. Richtig ist die Belegung, spät gemessen (Iteration 900 bis 1800). Wer einen Attraktor messen
will, muss warten, bis die Bahn auf ihm ist.

**(3) Schlafend bewegte sich fast so viel wie arbeitend.** Gemessen als Anteil der Pixel, die sich in
1,5 s um mehr als 12 Stufen ändern: Automat 2,13 % schlafend gegen 2,31 % arbeitend, Attraktor 0,67 %
gegen 0,73 %. Der Zustand war damit nicht ablesbar — der eine Zweck der ganzen Übung. Die Ursache ist
allgemein: **jedes gleichmäßige Verblassen über die ganze Zelle zählt und liest als Bewegung**, egal
wie leise es ist. Zwei Anläufe scheiterten daran (langsames Verblassen, dann ein voller Neuaufbau
alle zwei Sekunden — ein Blitz über die Zelle, 1,23 %). Die Lösung ist, den Zerfall in die STRUKTUR
zu legen statt in die Helligkeit: die schlafende Marke wird einmal mit Lücken gezeichnet und ist
danach still. Was fehlt, ist der Zerfall.

Dazu eine vierte Lektion, die keine Zahl hat, aber ein Bild: **eine gemeinsame Canvas kostet
Clipping.** Weil die Systeme akkumulieren, wird die Fläche nie ganz geleert, und eine Zelle, deren
Agenten über den Rand laufen, malt dauerhaft in ihre Nachbarn — die Spur verschwindet nie, weil sie
außerhalb des gedunkelten Rechtecks liegt. Im ersten Bild stand das als Streifen quer durch die
Spalte.

### 5.2 Zwei Marken derselben Art auf 24 px auseinanderhalten

Kontaktbogen (`marken-tafel.html`): alle 19 Sessions in allen drei Systemen, jede Marke 24 px an
einer bekannten Rasterstelle; verglichen werden 48×48 Gerätepixel, mittlerer absoluter Kanalabstand
über alle 171 Paare. „Befund-(1)-Paare" sind Slot 1, 3, 4 und 15 — gleiches Projekt, gleiches
Harness, keines schlafend: genau der Fall, an dem Runde 1 gescheitert ist.

| | kleinster Abstand | Median | Paare unter 4,0 | Befund-(1)-Paare, min | Tinte |
|---|---|---|---|---|---|
| **in Farbe** | | | | | |
| Strömung | 18,08 | 28,57 | 0 von 171 | 24,89 | 23,3 % |
| Automat | **26,04** | 49,47 | 0 von 171 | 38,57 | 61,7 % |
| Attraktor | 23,17 | **59,03** | 0 von 171 | **47,67** | 37,2 % |
| **ohne Farbe** | | | | | |
| Strömung | 14,46 | 24,91 | 0 von 171 | 18,99 | 21,4 % |
| Automat | 12,75 | 38,65 | 0 von 171 | 26,52 | 59,0 % |
| Attraktor | **19,08** | **53,76** | 0 von 171 | **39,23** | 35,7 % |

**Kein Paar unter der Schwelle, in keinem System, mit und ohne Farbe.** Die Zahlen sind NICHT mit
denen aus Runde 1 und 2 vergleichbar: dort lag ein 26-px-Zeichen in einem 68×68-Feld, hier eine
24-px-Marke in einem 48×48-Feld — schwarzer Rand drückt jeden Pixelabstand. Vergleichbar sind die
drei Systeme untereinander, und da gewinnt der Attraktor den harten Fall deutlich.

### 5.3 Ob der Zustand am laufenden System ablesbar ist

Anteil der Pixel, die sich zwischen zwei Bildern im Abstand von 1,5 s um mehr als 12 Stufen ändern,
über die ganze Spalte, aus der laufenden Seite über das DevTools-Protokoll:

| Zustand | Strömung | Automat | Attraktor |
|---|---|---|---|
| arbeitet | 0,41 % | **2,31 %** | 0,72 % |
| ruht | **0,000 %** | **0,000 %** | **0,000 %** |
| schläft | 0,009 % | 0,000 % | 0,000 % |
| gestört | 0,71 % | 2,41 % | 1,34 % |

`ruht` ist in allen dreien exakt 0 — das Einfrieren ist vollständig, nicht fast. Schlafend ist von
ruhend nicht durch Bewegung getrennt, sondern durch das Aussehen (grau, mit Lücken); das ist nach
§5.1 (3) eine Entscheidung, keine Nachlässigkeit. Beim Automaten fällt zusätzlich etwa alle fünf
Sekunden eine Zeile — über Minuten drainiert das Bild sichtbar, in einem 1,5-s-Fenster sieht man es
nicht.

### 5.4 Kosten, Bilder je Sekunde, reduced-motion

| | ein Bild (19 laufend) | Anteil eines 60-Hz-Bildes | gemessene Bilder/s |
|---|---|---|---|
| Strömung | 0,07 ms | 0,4 % | 60 |
| Automat | 0,31 ms | 1,9 % | 60 |
| Attraktor | 0,43 ms | 2,6 % | 60 |

Die 60 Bilder/s sind ECHT gemessen, über das DevTools-Protokoll an einem Chrome mit Compositor —
und zwar mit **allen drei Systemen gleichzeitig auf einer Seite**, also 63 Zellen in drei Canvas.
Im Betrieb liefe eines davon. Headless ohne Compositor meldet 0, und 0 ist kein Messwert, sondern
eine nicht gelaufene Schleife.

`prefers-reduced-motion`: zwei Bildschirmfotos im Abstand von 2 s sind **byteweise identisch**
(`--force-prefers-reduced-motion`), ohne die Einstellung sind sie es nicht. Und es ist ein volles
Standbild, kein leeres: 67 637 Pixel über Schwelle. Jede Marke steht da, nur still.

## 6. Empfehlung

**C · Attraktor.**

Der Grund ist nicht, dass er der schönste ist, sondern dass er die Frage gewinnt, an der Runde 1 und
Runde 2 gescheitert sind. Der Befund, der diese ganze Arbeit ausgelöst hat, war: *zwei Sessions
desselben Projekts mit demselben Harness sind nebeneinander nicht auseinanderzuhalten.* Genau diese
Paare misst der Attraktor ohne Farbe mit **39,2** gegen 26,5 beim Automaten und 19,0 bei der
Strömung, und im Kontaktbogen sieht man es ohne jede Zahl: jede Marke ist ein eigener kleiner Körper.
Er kostet dafür 2,6 % eines Bildes — ein Vierzigstel des Budgets.

**Zweite Wahl: B · Automat**, und zwar mit einem eigenen Argument, nicht als Trostpreis. Er bewegt
sich am deutlichsten (2,31 % gegen 0,72 %), also ist „läuft gerade" auf einen Blick lesbar, und sein
Harness-Kanal ist eine echte Textur-Familie. Dagegen steht seine Dichte: 61,7 % Tinte, und der
schlechteste kleinste Paarabstand ohne Farbe (12,75). Wer die Leiste lieber lebendig als
unterscheidbar hätte, nimmt ihn.

**A · Strömung fällt weg.** Sie hat ihre eigene Kippbedingung getroffen: bei 24 px ist zu wenig Platz
für Topologie, und die Zahlen sagen dasselbe wie das Bild. Ihr einziger Vorteil ist der Preis, und
den braucht niemand, wenn das teuerste System 2,6 % eines Bildes kostet.

**Eine Sache, die diese Runde verliert und die der Owner sehen sollte:** die Marke trägt jetzt keine
lesbare Adresse mehr. In Runde 2 stand die Slot-Zahl im Zeichen, und das nahm der Zeile eine ganze
Spalte ab. Ein laufendes System hat keinen Platz für eine Ziffer, ohne sein eigenes Bild zu stören.
Beides geht zusammen — das System als Marke, die Slot-Zahl weiter in der Zeile — aber dann ist die
Spalte wieder vier Felder breit. Das ist eine Frage an den Owner, keine Empfehlung von hier.

## Methode

```
# Die laufende Seite (das eigentliche Werkstueck, ein PNG kann sie nicht zeigen):
#   docs/design/sidebar/marken-laufend.html — drei Spalten, dieselben 16 Plaetze, dieselben Seeds
#   Schalter: alle 16 arbeiten · alles einfrieren · alles schlafen · alles stoeren · ohne Farbe
# Kontaktbogen: marken-tafel.html rendert alle 19 Sessions in allen drei Systemen, je 24 px, an
#   bekannten Rasterstellen — ein Bild statt 114 Chrome-Starts, und die Rasterstellen sind genau
#   die Ausschnitte, die der Pixelvergleich misst. `?grau=1` schaltet die Farbe ab.
# Einzelstand: marken-mess3.html rendert GENAU EINE Marke, alles ueber die Adresszeile — fuer den
#   Fall, dass sich zwei Bilder in genau einem Fakt unterscheiden sollen (Methode aus Runde 1 §1).
# Engine-Probe: marken-engine-probe.html gegen `bun` auf demselben Modul; verglichen werden die
#   Textzeilen byteweise. Das ist der Beleg fuer die Geraeteunabhaengigkeit (§5.1 (1)).
# Zustandsbewegung: die laufende Seite ueber das DevTools-Protokoll schalten, je Zustand zwei
#   Bilder im Abstand von 1,5 s, Anteil der Pixel mit mehr als 12 Stufen Aenderung.
# Bilder je Sekunde: ECHT gemessen ueber das DevTools-Protokoll (Chrome --headless=new mit
#   Compositor), nicht unter virtueller Zeit — headless ohne Compositor meldet 0, und 0 ist
#   kein Messwert, sondern eine nicht gelaufene Schleife.
# Zeichenkosten: MarkStage#bench — 90 volle Bilder ueber alle Zellen, ms je Bild.
# reduced-motion: zwei Bildschirmfotos im Abstand von 2 s, einmal normal, einmal mit
#   --force-prefers-reduced-motion; verglichen werden die BYTES.
```

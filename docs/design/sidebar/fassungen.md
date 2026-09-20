# Die Fassungen auf der Testinstanz — Succession-Band und Kopfreihe

Zwei Entwürfe stehen als je drei Fassungen nebeneinander auf der stehenden Testinstanz
(`./testinstanz.sh up`), keiner ist gebaute Meinung: **`#band=a|b|c`** für die Succession-Zeile,
**`#head=a|b|c`** für die Knopfreihe im Kopf. Ohne Hash steht überall der heutige Stand.

## So sieht man sie an

    <instanz-url>#band=a        eine Fassung
    <instanz-url>#head=c        die andere
    <instanz-url>#band=a&head=c beide zugleich

**Ein Hash-Wechsel wirkt SOFORT, ohne Neuladen** — seit dieser Runde. Vorher war das die teuerste
Falle des Vergleichs: beide Schalter waren Modul-Level-`const`, einmal beim Start ausgewertet, und
ein Hash-Wechsel an einer offenen Seite ist eine Same-Document-Navigation. Wer die Fassungen durch
Tippen in der Adresszeile verglich, sah **dreimal dieselbe** und schloss daraus, die Fassung sei
kaputt oder die Daten fehlten. Gemessen von aussen am 2026-09-20 (Playwright: von `#band=a` auf
`#band=c` navigiert, ohne Reload → weiterhin Fassung A). `src/client.ts#readVariant` ist jetzt eine
Funktion, die beiden Schalter sind `let`, und ein `hashchange`-Listener liest neu und zeichnet neu.

Nachfahrbar mit dem Treiber im Baum, der genau diesen Weg geht (laden, danach nur noch
`location.hash` setzen — ein Bild, das sich unterscheidet, IST der Beweis):

    bun docs/design/sidebar/leiste-mess/kopfreihe-shot.js "<instanz-url>" /pfad/basis
    bun docs/design/sidebar/leiste-mess/kopfreihe-shot.js "<instanz-url>" /pfad/basis --reload   # Kontrolle

## Succession-Band — was die drei Fassungen WIRKLICH zeigen

Gemessen am selben Fixture (Succession auf Slot 2 = MAIN, Slot 9 und 10 = Lanes), gezählt sowohl im
DOM als auch nach Sichtbarkeit (`offsetParent !== null`):

| Fassung | Element | im DOM | sichtbar | davon auf einer LANE |
|---|---|---|---|---|
| a — eigenes Band unter der Zeile | `.succband` | 3 | 3 | **2** |
| b — Lesung in Zeile 2 | `.succ` | 3 | **1** | **0** |
| c — Chip in Zeile 1 | `.succhip` | 3 | 3 | **2** |

**FASSUNG B UND SCHNITT 6 SCHLIESSEN EINANDER AUS.** B schreibt in `.r2`, und Schnitt 6
(`.slot.lane:not(.current) .r2 { display: none }`) nimmt der unfokussierten Lane genau diese zweite
Zeile. Die Lesung existiert, sie ist unsichtbar — und die Lane ist der Ort, an dem „s3 · 2/5"
zählt. Die Zahl in der Tabelle ist das: `dom 3, visible 1, auf Lanes 0`.

Daraus folgt eine Kopplung, die der Owner **zusammen** entscheidet, nicht einzeln:
- Fällt Schnitt 6, wird B wieder tragfähig und kostet nichts.
- Bleibt Schnitt 6, ist C die einzige Fassung, die den Fakt auf einer Lane überhaupt zeigt — zum
  Preis von Label-Breite, und Label ist nach der Raumnutzungs-Messung das knappe Gut.
- A zeigt ihn überall, aber als nacktes graues „s4" ohne Bezeichner auf eigener Zeile.

## Kopfreihe — drei Fassungen, ein Satz je Fassung

Anlass, Owner am 2026-09-20: *„die ganzen komischen aktuellen knoepfe sollten auch noch ueberarbeitet
werden, eig ist nur der worktree knopf sinnvoll so wie er ist"*. Der Massstab ist damit gesetzt: die
Zeilen-Marke ⎇+ SAGT, was sie tut, und trägt ihr Repo im Namen. Die acht Knöpfe im Kopf
(🗒 📣 📥 🛡 🧾 💻 🐢 ⋯) sind rohe Emoji, deren Bedeutung nur im `title` steht, während die Tray-Reihe
einen Bildschirm tiefer (Files · History · Schedule) längst SVG + Wort spricht.

| Fassung | Was man sieht | Höhe der Reihe |
|---|---|---|
| **a** | Ikone **und Wort**, die Grammatik der Tray; die Wörter passen nicht auf eine 249-px-Zeile, also umbricht die Reihe auf drei | **94 px** (heute 34) |
| **b** | dieselben Ikonen, **keine Wörter** — die Bedeutung ist gezeichnet statt im `title` versteckt, die Geometrie bleibt exakt die heutige | 34 px |
| **c** | nur das Tägliche bleibt in der Reihe (Queue + die bedingten), **Audit, Lands und Saver falten sich unter ⋯** und lesen sich dort als ganze Zeilen mit Wort | 34 px |

**Die drei BEDINGTEN Knöpfe (📣 attn · 📥 ops · 💻 dev) faltet keine Fassung weg.** Ihre eigenen
Schreiber zeigen sie genau dann, wenn es etwas zu sagen gibt; eine Fassung, die sie unter ⋯ gelegt
hätte, wäre in genau diesem Moment gebrochen. Sie behalten in jeder Fassung ihre Zahl.

Zwei Dinge, die beim Bauen auffielen und keine Fassung sind, sondern Zustand:
- **`#auditbtn` und `#outcomebtn` haben heute GAR KEIN CSS** (`grep` sie in `public/index.html`:
  nur die zwei `<button>`-Zeilen). Sie sind rohe UA-Knöpfe, die nur solange erträglich aussehen,
  wie ihr Inhalt ein einzelnes Emoji ist — sobald er wechselt, stehen zwei weisse Pillen im dunklen
  Kopf. Die Fassungen geben ihnen die Rezeptur ihrer Nachbarn (`#queuebtn`/`#saverbtn`), keine neue.
- Die Reihe spricht noch `--line`/`--raised`/`--dim`, die Leiste darunter `--chat-*`. Das ist eine
  eigene Frage und hier bewusst **nicht** beantwortet: Farbe, Kante, Typo und Radien sind in allen
  drei Fassungen unangetastet, der Unterschied ist die ART des Zeichens.

## Wenn die Wahl steht

Beide Schalter sind Gerüst und gehen mit der Wahl: die verlorenen Zweige, `BAND_VARIANT`,
`HEAD_VARIANT`, `HEAD_BTNS`, der `hashchange`-Listener und die `hv-*`-Regeln in `public/index.html`
fallen ersatzlos. Kein Schalter darf ein Land sehen.

Bilder (1000×950, dsf 2): `leiste-733b/ti-head-{a,b,c,none}.png` und `ti-band-{a,b,c}.png` auf dem
Bild-Server dieser Maschine.

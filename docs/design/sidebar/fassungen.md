# Die Fassungen auf der Testinstanz — Succession-Band und Kopfreihe

Zwei Entwürfe stehen als Fassungen nebeneinander auf der stehenden Testinstanz
(`./testinstanz.sh up`), keiner ist gebaute Meinung: **`#band=a|b|c`** für die Succession-Zeile,
**`#dev=a|b`** für die Geräte-Anzeige im Kopf. Ohne Hash steht überall der heutige Stand.

## So sieht man sie an

    <instanz-url>#band=a        eine Fassung
    <instanz-url>#dev=b         die andere
    <instanz-url>#band=a&dev=b  beide zugleich

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

## Kopfreihe — entschieden, der Schalter `#head` ist weg (2026-09-21)

Owner-Runde 9: *„Zuerst sollte die Ansicht ganz links als quadrat dargestellt werden, dazu sollte auch
ein neuer Ansichts-Knopf hingefügt werden, der drei sessions anzeigt, eine längere, und zwei Kästchen
daneben. Recht davon zeigen wir dann üüberarbeitete buttons für die Funktionen an … mach das nur so das
es gut passt."* Gebaut ist damit Fassung **b** (eine Ikonengrammatik, keine Wörter, Reihenfolge wie
vorher) als Dauerzustand; a und c sind samt Schalter entfernt. Dazu:

- Die vier Ansichtsknöpfe zeichnen ihre Anordnung (`src/icons.ts` `view1`…`view4`), alle im selben
  Quadratrahmen — die Einzelansicht IST ein Quadrat.
- **Ansicht 3 ist neu** (`#panes.l3`: erste Pane über zwei Zeilen, zwei gestapelt daneben); vorher gab
  es nur 1, 2 und 4.
- Eine Form für die ganze Reihe: `#sidetools button`, 23 px, Chat-Tokens. Vier Ansichten + fünf
  stehende Funktionen = 221 px bei 229 verfügbaren (gemessen im DOM; bei 24 px brach ⋯ um). Spricht
  ein bedingter Knopf (attn/ops/dev), bricht die Reihe um, statt überzulaufen.

`leiste-mess/kopfreihe-shot.js` fotografiert den alten `#head`-Schalter und ist damit Messgeschichte.

## Geräte-Anzeige — zwei Fassungen hinter `#dev=a|b`

Owner-Runde 9: *„Das Gerät auf dem wir sind sollte dabei aber vllt eine bessere Anzeige bekommen, die
dem unerfahrenen Endnutzer vllt auch darauf bringt das man mit Claude Fleet mehrere Computer
gleichzeitig benutzen kann"*. Beide lesen dieselben zwei Fakten wie der Chip (`FLEET_INSTANCE`,
`FLEET_INSTANCES`) und navigieren über dieselbe eine `location.assign`-Stelle (Pin in `e2e/pins.ts`).
Ohne Hash steht der Chip wie vorher.

| Fassung | Zwei Computer | Ein Computer | Kosten |
|---|---|---|---|
| **a** eigene Reihe | Kachel je Computer, diese „hier", die andere „↗" | „dieser Computer" + gestrichelte Kachel „+ Computer" (Tooltip) | eine Zeile, 34 px |
| **b** im Titel | Zwei-Bildschirme-Zeichen + „mac 1/2", Menü plus ein erklärender Satz | Bildschirm + „+" (Tooltip) | keine Zeile |

Die Testinstanz zeigt zwei Computer (`testinstanz.sh`, `FLEET_TI_INSTANCES` — leer gesetzt ergibt
den Ein-Computer-Fall). Offen, von keiner Fassung beantwortet: die „+"-Kachel hat keinen Klickweg,
weil es noch keinen Einrichtungsweg für einen zweiten Computer im Board gibt.

## Wenn die Wahl steht

Beide Schalter sind Gerüst und gehen mit der Wahl: die verlorenen Zweige, `BAND_VARIANT`,
`DEV_VARIANT`, der `hashchange`-Listener und die `#devrow`- bzw. `.devb`-Regeln der verlorenen Fassung
fallen ersatzlos. Kein Schalter darf ein Land sehen.

Bilder (1000×950, dsf 2): `leiste-733b/ti-head-{a,b,c,none}.png` und `ti-band-{a,b,c}.png` auf dem
Bild-Server dieser Maschine.

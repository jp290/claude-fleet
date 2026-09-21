# Die Fassungen auf der Testinstanz — Succession-Band und Kopfreihe

Alle Entwürfe dieser Seite sind entschieden und gebaut; es gibt keinen Hash-Schalter mehr. Die
Abschnitte halten fest, was gewählt wurde und warum.

## Der Hash-Schalter (Geschichte — seit Runde 10 entfernt)

**Ein Hash-Wechsel wirkte SOFORT, ohne Neuladen** — ab 2026-09-20. Vorher war das die teuerste
Falle des Vergleichs: beide Schalter waren Modul-Level-`const`, einmal beim Start ausgewertet, und
ein Hash-Wechsel an einer offenen Seite ist eine Same-Document-Navigation. Wer die Fassungen durch
Tippen in der Adresszeile verglich, sah **dreimal dieselbe** und schloss daraus, die Fassung sei
kaputt oder die Daten fehlten. Gemessen von aussen am 2026-09-20 (Playwright: von `#band=a` auf
`#band=c` navigiert, ohne Reload → weiterhin Fassung A). `readVariant` wurde damals eine
Funktion, die Schalter `let`, und ein `hashchange`-Listener las neu und zeichnete neu.

Der Treiber, der das damals bewies (misst heute nichts mehr, der Schalter ist weg) (laden, danach nur noch
`location.hash` setzen — ein Bild, das sich unterscheidet, IST der Beweis):

    bun docs/design/sidebar/leiste-mess/kopfreihe-shot.js "<instanz-url>" /pfad/basis
    bun docs/design/sidebar/leiste-mess/kopfreihe-shot.js "<instanz-url>" /pfad/basis --reload   # Kontrolle

## Succession-Band — gebaut (Owner-Runde 10, 2026-09-21)

Die Fassungen `#band=a–d` und ihr Schalter sind entfernt. Gebaut ist das Zieh-Band aus
`leiste-mess/band-zieh.js` mit den abgenommenen Werten: Strich A am Rand, Maus „weich" (40 px, k 0,8,
28 %, 380 ms), Trackpad/Finger nach Runde 5, Punkte nur bei Bedarf, `DEPTH` als eine Konstante,
Kennwerte „Reihe" (Lane-Punkt · ctx als Zahl, „?" wenn unmessbar · Zustand). Eine vergangene Session
öffnet lesend in der Pane über `GET /api/slots/:id/succession/:n/transcript` (`docs/self-api.md`).
Code: `src/client.ts#bandify`, `Pane#showPast`. Der Abschnitt unten ist Messgeschichte.

## Succession-Band — was die drei Fassungen WIRKLICH zeigten (Geschichte)

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
- Eine Form für alle: `#sidetools button`, 23 px, Chat-Tokens.
- **Zweireihig** (Nachtrag zu Runde 10: *„die pane-split buttons in ein quadrat packen und auch die
  leiste zwei-reihig machen"*): die vier Ansichten als EIN Quadrat (2×2, 48×48 px) links über beide
  Reihen, rechts die Funktionen in alter Reihenfolge auf `#toolrow1` (Queue · Attention · Inbox ·
  Audit) und `#toolrow2` (Lands · Devices · Saver · ⋯). Die Teilung steht im Markup, damit ein
  auftauchender bedingter Knopf nichts verschiebt; gemessen mit allen dreien samt Zahl endet die
  längste Reihe bei 197 von 239 px.

`leiste-mess/kopfreihe-shot.js` fotografiert den alten `#head`-Schalter und ist damit Messgeschichte.

## Geräte-Anzeige — entschieden: B (Owner-Runde 10, 2026-09-21: *„Ich finde B und B am besten"*)

Der Chip im Titel trägt das Zwei-Bildschirme-Zeichen und „mac 1/2", das Menü einen erklärenden
Satz; ein einzelner Computer zeigt Bildschirm + „+" (Tooltip, kein Klickweg — es gibt noch keinen
Einrichtungsweg im Board). Fassung A (eigene Kachelreihe) und der `#dev`-Schalter sind entfernt.
Die Testinstanz zeigt zwei Computer (`testinstanz.sh`, `FLEET_TI_INSTANCES=` leer = ein Computer).

## Wenn die Wahl steht

Beide Schalter sind Gerüst und gehen mit der Wahl: die verlorenen Zweige, `BAND_VARIANT`
und der `hashchange`-Listener fallen ersatzlos. Kein Schalter darf ein Land sehen.

Bilder (1000×950, dsf 2): `leiste-733b/ti-head-{a,b,c,none}.png` und `ti-band-{a,b,c}.png` auf dem
Bild-Server dieser Maschine.

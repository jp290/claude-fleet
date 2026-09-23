---
frage: Was zeigt das Handy quer am gelandeten Hochformat-Stand (970cac21), und welche von zwei Querformat-Richtungen soll gebaut werden?
urteil: Quer mit offener Tastatur zeigt der gelandete Stand 1 Transkriptzeile (vorher 0), das Eingabefeld liegt zu 36 von 46 px unter der iOS-Accessory-Leiste, und ⋯ schiebt Feld und Tray unter die Tastatur; empfohlen ist der Lesemodus B (klein, 21 statt 6 Zeilen bei voller Breite, Feld frei), Nebeneinander A (mittel) nur, wenn der Owner quer auch tippen will, denn nur A zeigt beim Tippen 4 statt 1 lesbare Zeile.
bereich: [mobil, querformat, composer]
belege: [970cac21, src/client.ts#MOBILE_MQ, src/client.ts#mainEl, public/index.html#mobmore, server.ts#/resize, docs/design/grammatik.md#G0.7, docs/design/querformat/]
nicht-gemessen: kein echtes iPhone und kein WebKit, die Accessory-Leiste ist aus einem einzigen Screenshot vermessen (iOS-Version unbekannt), Chat-Ansicht und Mehrfach-Panes nicht gezeichnet
stand: 2026-09-23
---

# Handy quer: Befund am gelandeten Stand und zwei Richtungen zur Wahl

2026-09-23, Lane `fleet/260923212421-1911`, Program `0d51b4d4`, nach Zeile `0c2d5975` (gelandet als
`970cac21` „fix: 0c2d5975 expand mobile transcript above keyboard"). Frage: **Wie sieht der gelandete
Hochformat-Stand quer aus, und welche von zwei Querformat-Richtungen trägt „richtig angegangen"?**

Owner, wörtlich (2026-09-21, Intake Slot 12): „einen landscape mode könnte ich mir auch echt nice
vorstellen, wenn er denn richtig angegangen wird."

Gebaut ist nichts. Produktcode ist unverändert, die Bilder und Mockups liegen unter
`docs/design/querformat/`.

## 1. Befund: der gelandete Stand quer (812 × 375 @3x)

Koordinaten sind Seiten-y in CSS-px ab der Unterkante der Safari-Leiste. Die Geometrie des Geräts ist an
`drops/1789998483852-IMG_2494.png` vermessen (2436 × 1125 px = 812 × 375 css @3x, Haupt-Checkout,
gitignored): Safari-Leiste 89 px, Tastatur ab Bildschirm-y 211, also eine **sichtbare Seite von 122 px**
bei offener Tastatur (286 px ohne). Die **Accessory-Leiste** (⌃ ⌄ ✓) schwebt über der Seite bei
**y 64–108, x 97–714**.

| Zustand | Kopf `#mhead` | Transkript `#panes` | Tastenreihe `#keys` | Composer `#comp` | Tray |
|---|---|---|---|---|---|
| Tastatur zu (Seite 286) | 0–45 | 45–135, **6 Zeilen** (`.xterm-screen` 78 px à 13 px) | 142–176 | 182–232 | 240–280 |
| Tastatur offen (Seite 122) | versteckt | 0–27, **1 Zeile** (7–20) | 30–70, 6 px unter der Leiste | 72–118, **36 von 46 px unter der Leiste** | versteckt |
| Tastatur offen + ⋯ | 0–49 (kommt zurück) | 49–53, **0 Zeilen** | 56–96, unter der Leiste | Feld 101–141, **von der Tastatur bei 122 halb verdeckt** | 146–186, **ganz unter der Tastatur** |
| IMG_2494 (vor 970cac21, am Bild abgelesen) | 0–45 | **0 Zeilen** | 56–90, unter der Leiste | ab 97, von der Tastatur geschnitten | – |

Bilder: `docs/design/querformat/befund-1-ohne-tastatur.jpg`, `befund-2-tastatur.jpg`,
`befund-3-tastatur-optionen.jpg`.

Was das heißt:

- **970cac21 hat quer genau eine Zeile gebracht.** Vorher 0, jetzt 1 Zeile bei offener Tastatur. Der Anteil
  des Transkripts an der sichtbaren Seite liegt bei 27/122 = 22 %, ohne Tastatur bei 90/286 = 31 %.
- **Das Eingabefeld liegt unter der Accessory-Leiste.** `#input` steht bei 75–115, die Leiste bei 64–108.
  Frei bleiben nur der linke Rand (x < 97, dort steht der Platzhalter „Prompt…") und rechts ⋯ und Senden
  (x > 714). Der getippte Text liegt also verdeckt, das ist derselbe Mangel wie auf IMG_2494.
- **⋯ ist quer unbrauchbar.** Mit aufgeklappten Optionen misst der Inhalt 190 px in einer 122-px-Seite:
  das Feld ist zur Hälfte hinter der Tastatur, der Tray ganz. Dieser Befund gehört zum Hochformat-Fix,
  das Hochformat selbst ist nicht betroffen (dort hat die Seite genug Höhe).
- **Randnotiz zur Messung:** die Glyphen im Befundbild sind zu groß gezeichnet (Headless-Chromium-WebGL bei
  @3x). Die Zeilenzahl ist am DOM gemessen (`.xterm-screen`-Höhe / 13 px), nicht am Bild.

## 2. Zwei Richtungen als Mockup

Statische Seiten, kein Produktcode, Material aus den `--chat-*`-Tokens (G0.1), Glyphen sind Platzhalter
für `src/icons.ts` (G0.6). Beide Seiten zeigen dasselbe erfundene Transkript (`mock.js`).

**A · Nebeneinander** (`docs/design/querformat/a-nebeneinander.html`): das Transkript steht links über die
volle Höhe (532 px breit), rechts eine 280-px-Spalte mit Kopf, Composer, Tastenreihe als 3×3-Raster und
Tray. Beim Tippen fällt die Spalte auf das Feld zusammen; das Feld steht oben, über der Accessory-Leiste.
Bilder: `a1-tastatur-zu.jpg`, `a2-tastatur-offen.jpg`.

**B · Lesemodus** (`docs/design/querformat/b-lesemodus.html`): Kopf, Tastenreihe und Tray fallen weg,
das Transkript läuft randlos über 812 × 286. ☰ + Titel oben links und die Eckgruppe oben rechts bleiben
halbtransparent; unten rechts schweben ⌨ (Tastenreihe als Band) und ✎ (Schreiben). Mit ✎ klappt die
Eingabe als Band OBEN auf (0–48, über der Accessory-Leiste), das Transkript rückt darunter. Bilder:
`b1-lesen.jpg`, `b2-tasten.jpg`, `b3-schreiben.jpg`.

Gemessen an den Mockups („ganz lesbar" = Zeile vollständig in der sichtbaren Seite, nicht unter der
Accessory-Leiste y 64–108, linke 200 px nicht unter einem Knopf):

| | Tastatur zu: Zeilen · Breite | Tastatur offen: gezeigt · ganz lesbar | Feld unter der Accessory-Leiste |
|---|---|---|---|
| heute (970cac21) | 6 · 779 px | 1 · 1 | 36 von 46 px |
| A Nebeneinander | 21 · 532 px | 9 · **4** | 0 |
| B Lesemodus | 21 (18 ohne Knopfband) · 812 px | 5 · **1** | 0 |

Die Terminalbreite ist nicht nur eine Frage der Darstellung. Jeder Client-Resize ändert das gemeinsame pty
für alle Betrachter („last connect wins", `server.ts`, `/resize` und der WebSocket-Open-Pfad), und die
Zeilen sind auf mindestens 10 geklemmt. A setzt quer rund 81 statt 123 Spalten, auch für den Desktop, der
denselben Slot zeigt (abgeleitet: 779 px / 123 Spalten = 6,33 px je Spalte, 516 px nutzbar). Hochkant
setzt das Handy heute ohnehin weniger.

## 3. Kosten je Richtung

Beide brauchen **keine neue Grenze**: das Querformat ist genau der zweite Arm von `MOBILE_MQ`,
`(pointer: coarse) and (max-height: 500px)`. Ein Handy quer trifft nur diesen Arm (812 > 700), ein Handy
hochkant nur den ersten, ein Desktop-Fenster keinen der beiden mit `pointer: coarse`. Der Block käme als
eigener `@media`-Block hinter den Mobilblock in `public/index.html` und erbt dort alles.

**A · Nebeneinander, GROESSE mittel.**
- CSS: `#app` wird zweispaltiges Grid. Weil `#mhead` außerhalb von `#main` liegt (`#app` > `#mhead`,
  `#side`, `#main` > `#panes`, `#bar`), geht das nur über `#main { display: contents }`. Dann verliert
  `#droplay` seinen Anker (`#main` ist `position: relative` und das Drag-and-drop-Ziel,
  `src/client.ts#mainEl`). Der andere Weg ist ein DOM-Umzug von `#mhead` per JS.
- Betroffene Klassen: `#keys` (3×3-Raster), `#comp.bar` (hohes Feld), `#comptray` (Beschriftungen passen
  nicht in 268 px, „Schedule" verliert sein Wort), `.panetools` (versetzt), `#mhead`.
- JS: die `keyboard-open`-Logik aus 970cac21 braucht einen Querformat-Zweig (Kopf aus, Feld nach oben,
  ⋯ darf `#mhead` nicht zurückholen).
- Folge: die schmalere Spalte ändert die pty-Breite für alle Betrachter (§2).

**B · Lesemodus, GROESSE klein.**
- CSS, rund 30 Regeln im Querformat-Block: `#mhead`, `#keys`, `#comptray` aus. `.panetools` auf das
  halbtransparente Material (als Token mit Alpha, kein Literal, G0.1). Bei `body.keyboard-open`
  gilt `#main { flex-direction: column-reverse }`, damit `#bar` IM FLUSS oben steht und das Pane darunter
  schrumpft. `body.landkeys #keys` wird zum Band unten.
- JS, rund 20 Zeilen: ein Element `#mread` mit drei Knöpfen. ☰ ruft den vorhandenen `#menu`-Handler,
  ⌨ schaltet `body.landkeys` um, ✎ fokussiert `#input`. Den Rest trägt die vorhandene
  `keyboard-open`-Erkennung aus 970cac21.
- Das ⋯ aus 970cac21 holt quer nur noch den Tray als zweite Zeile im oberen Band zurück, nicht `#mhead`.
  Damit ist der Überlauf aus §1 behoben.
- Die pty-Breite bleibt bei voller Breite, in allen Zuständen.

## 4. Empfehlung: B, gegen die Mobil-Regel der Grammatik begründet

Beide Richtungen **brechen G0.7 Satz 2** („Hoch- und Querformat bekommen dieselbe Behandlung"), und beide
**halten G0.7 Satz 3** („keine Fläche erfindet eine eigene Breitengrenze"), weil sie den vorhandenen
zweiten Arm von `MOBILE_MQ` benutzen. Die Bauzeile muss G0.7 also ändern. Vorschlag für den neuen
Satz 2: „Hoch- und Querformat teilen Trefferflächen und Eingabegröße; das Querformat (zweiter Arm von
`MOBILE_MQ`) darf Kopf, Tastenreihe und Tray einklappen." Verbindlich wird das erst durch
Owner-Promotion. Danach unterscheiden sich die Richtungen so:

- **G3.3 Mobil** („der Tray bleibt eine Zeile unter dem Composer"): B klappt den Tray hinter ⋯, genau wie
  970cac21 es hochkant mit Tastatur schon tut (dort mit G0.7/G1.3/G3.3 begründet). A gibt dem Tray eine
  zweite Heimat in der Spalte, mit gekürzten Beschriftungen.
- **G0.7 Trefferflächen ≥ 40 px, 16 px im Feld:** beide erfüllen das.
- **Kosten:** B klein auf dem Mechanismus von 970cac21, A mittel mit einem Eingriff in die Grundstruktur
  von `#app` und `#main`.
- **Messbarer Gewinn:** beim Lesen liegen beide bei 21 statt 6 Zeilen. B hat dabei die volle Breite und
  lässt die pty-Breite in Ruhe. Beim Tippen zeigt A **4** ganz lesbare Zeilen, B **1**, also so viele wie
  heute. Das Feld ist in beiden frei. Heute liegt es unter der Leiste, und das behebt jede der beiden
  Richtungen.

B ist empfohlen: kleiner, näher an der vorhandenen Grammatik, und sein Gewinn (6 → 21 Zeilen, Feld frei)
hängt nicht an der Lage der Accessory-Leiste. A gewinnt nur beim Tippen, und dieser Gewinn von 3 Zeilen
steht auf einer Leistenposition, die aus einem einzigen Screenshot vermessen ist. **Die Empfehlung kippt,
wenn der Owner quer auch tippen will:** dann ist A die Richtung, die das trägt.

Nicht gezeichnet, als eine Zeile für den Fall „beides": B beim Lesen, A2 nur beim Tippen. Das kostet die
Summe beider Richtungen.

## 5. Die eine Owner-Frage

> **Wofür nimmst du das Handy quer: zum LESEN langer Antworten und Terminal-Ausgaben (dann B), oder willst
> du quer auch bequem TIPPEN und dabei den Verlauf sehen (dann A)?**

Hinweis für die Antwort: IMG_2494 zeigt eine Lage mit offener Tastatur. Beim Tippen bringt B 1 lesbare
Zeile (wie heute) und A 4.

## 6. Karten-Vorlage für die Bauzeile (nicht gefilt, die MAIN filt nach der Wahl)

```
[MOBIL, QUERFORMAT: LESEMODUS (Richtung B) BAUEN · nach Owner-Wahl · Program 0d51b4d4]
ROLLE: codex/gpt-6-sol/high
GROESSE: klein
FLAECHE: public/index.html · src/client.ts · docs/design/grammatik.md
NACH: <diese Entwurfszeile>
VERIFY: pins · bun run build · Screenshot-Probe 812x375@3x (Methode docs/messungen/2026-09-22-mobil-querformat-entwurf.md §Methode)
DONE: Im zweiten Arm von MOBILE_MQ ((pointer: coarse) and (max-height: 500px)), als eigener @media-Block
  hinter dem Mobilblock: (1) Tastatur zu: #mhead, #keys, #comptray aus, Transkript randlos, ≥ 20 Zeilen bei
  vvh 286; #mread mit ☰ (ruft #menu), ⌨ (body.landkeys: #keys als Band unten), ✎ (fokussiert #input), je
  40 px, Material als Token mit Alpha; (2) Tastatur offen (body.keyboard-open aus 970cac21):
  #main column-reverse, #bar im Fluss oben, das Feld liegt bei vvh 122 vollständig ueber y 64 (frei von
  der Accessory-Leiste); ⋯ holt quer nur den Tray zurueck, nie #mhead, und der Inhalt ueberschreitet
  vvh 122 nicht; (3) G0.7 Satz 2 in docs/design/grammatik.md auf den Querformat-Satz der Notiz §4, die
  Tabellenzeile „Mobil quer" nachgezogen; (4) Hochformat 390x844 mit und ohne Tastatur pixelgleich vor/nach
  (Screenshot-Diff im Report).
VERBOTEN: Hochformat aendern · eine neue Breitengrenze · #main display: contents · bun server.ts mit Default-Env
```

Fällt die Wahl auf **A**: gleicher Kopf mit „NEBENEINANDER (Richtung A)", GROESSE mittel. DONE (1): Grid
Transkript | 280-px-Spalte. `#mhead` kommt per DOM-Umzug in die Spalte, nicht über `display: contents`, sonst
verliert `#droplay` seinen Anker. `#keys` als 3×3. DONE (2): Tastatur offen zeigt die Spalte nur das Feld
oben, das Transkript ≥ 4 ganz lesbare Zeilen links. Die pty-Breite (rund 81 Spalten) steht im Report.
(3) und (4) wie oben.

## Methode

```sh
bun install && bun run build
FLEET_TI_PORT=8871 FLEET_TI_SOCK=fleetti1911 FLEET_TI_DIR=/tmp/fleet-testinstanz-1911 ./testinstanz.sh up mixed
# neutrales Transkript in Slot 1 der Testinstanz (eigener Socket); Befehlszeile per clear-history entfernt
tmux -L fleetti1911 send-keys -t s1 "clear; sleep 2; cat /tmp/fleet-testinstanz-1911/t.txt; sleep 99999" Enter
tmux -L fleetti1911 clear-history -t s1
```

Probe (Skript im Lane-Scratchpad, playwright-core 1.58.1, Chromium 1208): Kontext 812 × 375,
`deviceScaleFactor: 3`, `isMobile`, `hasTouch`. Ein Init-Skript überschreibt den Getter
`VisualViewport.prototype.height` (286 ohne, 122 mit Tastatur) und feuert `resize` auf `visualViewport`.
So setzt der echte `sync()` aus 970cac21 `--vvh` und `body.keyboard-open` selbst; `innerHeight − 122 = 253
> 120` erfüllt seine Schwelle. Vor dem Tastatur-Zustand fokussiert die Probe `#input`, für „⋯" klickt sie
`#mobmore`. `html` wird um 89 px verschoben, Safari-Leiste, Tastatur und Accessory-Leiste sind aufgemalte
`position: fixed`-Blöcke an den Koordinaten von IMG_2494. Gemessen wird `getBoundingClientRect` der
Teile minus 89. Leak-Probe je Bild auf `document.body.innerText`
(Konto- und Rechnername, Tailscale-Adressen `100.x.y.z`, Mail-Präfix): 0 Treffer in allen drei Zuständen.

Die Mockup-Zahlen stammen aus derselben Art Probe über `docs/design/querformat/*.html` (Kontext
@2x, je `.phone` ein Screenshot, Zeilen gezählt über `.term > div` gegen Seite, Accessory-Band und
sichtbare Knöpfe).

Testinstanz danach mit `./testinstanz.sh down` (eigener Socket und Port) abgebaut.

## Was nicht gemessen wurde

- Kein echtes iPhone und kein WebKit. Tastatur und Accessory-Leiste sind simuliert, ihre Lage stammt aus
  einem einzigen Screenshot (iOS-Version unbekannt). Liegt die Leiste auf einem anderen iOS anders, ändern
  sich die Zahlen „ganz lesbar" beim Tippen, am stärksten für A.
- Die Chat-Ansicht (`.pane.chat`) und Mehrfach-Panes (`#panes.l2`/`l4`) sind quer nicht gezeichnet. Beide
  Mockups zeigen das Terminal eines Slots.
- Das echte xterm-Verhalten beim Wechsel (Refit, pty-Resize auf 81 Spalten bei A) ist abgeleitet, nicht
  gefahren. Ebenso die Reflow-Kosten für einen gleichzeitig offenen Desktop.
- Safe-Area-Einzüge (Notch links/rechts quer) sind nicht modelliert. Die Mockups nutzen die volle Breite
  von 812 px.

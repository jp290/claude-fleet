# Linke Leiste — Raumnutzung, drei Schnitte je einzeln gemessen (2026-09-20)

Owner-Satz, wörtlich: **„die slotansicht soll den platz effektiv nutzen"** — die Nacharbeit zu Bau 1
(`d2e893c9`), nachdem derselbe Owner die Designsprache abgenommen hatte („Ich finde es passt so vom
design her gut zum rest"). Farbe, Kante, Typo und Radien sind deshalb NICHT angefasst; die Auslegung
des Satzes steht **vor** dem Bau im Baum: `docs/design/sidebar/leiste-mess/auslegung-raumnutzung.md`.

## Apparatur

Vier Wegwerf-Instanzen, ein Stand je Instanz, dasselbe Fixture: **3 Sessions (Slot 2/4/7), 2 Lanes
unter Slot 4, 11 freie Plätze**, Fenster 900 und 1200 px, `deviceScaleFactor: 2`.
Treiber im Baum: `docs/design/sidebar/leiste-mess/` (`instanz-shot.sh` stellt die Instanz,
`cdp-shot.js` fährt Chrome über CDP und klappt den Stack auf, `flaechenbudget.js` liest die Fläche
aus derselben lebenden Seite). Einheit ist px² je Zeile — dieselbe, in der dieser Baum die alte
Leiste schon misst („45 von 9120 Pixeln einer Zeile", `2026-09-20-session-marke-entwurf.md`).

Zwei Reparaturen an der Apparatur, beide vorher gemessen falsch:
- `instanz-shot.sh` löste `dirname $0` NACH dem `cd` in die Instanz auf — beide Treiber starben als
  „Module not found", der Lauf schrieb 0 Bilder und meldete trotzdem `done`.
- Das Ausgabeverzeichnis war die Scratchpad-Adresse der Session, die die Datei geschrieben hat.
- `flaechenbudget.js` bucht jetzt zusätzlich `mark` (die Reservierung) und `lblShort` (wieviel px
  dem Label bis zum Verschwinden der Ellipse fehlen) — ohne die zweite Zahl ist Hebel 4 Geschmack.

## Die drei Schnitte, je mit eigener Messung

| Stand | Session | Lane | frei | Fakt % | Chrome % | Leer % | Zeilen ganz im Bild |
|---|---|---|---|---|---|---|---|
| v0 vorher (`d2e893c9`) | 61 px | 56 px | 45 px | 27,49 | 16,91 | 55,60 | **14 von 16** |
| v1 Schnitt 1 — freie Plätze | 61 | 56 | **29** | 35,35 | 19,49 | 45,16 | 16 von 16 |
| v2 Schnitt 2 — Innenabstände | **54** | **49** | 29 | 37,49 | 20,61 | 41,90 | 16 von 16 |
| v3 Schnitt 3 — Breite ans Label | 54 | 49 | 29 | 36,52 | 22,19 | 41,29 | 16 von 16 |
| v4 Schnitt 4 — linkes Band | 54 | 49 | 29 | 35,87 | 22,77 | 41,35 | 16 von 16 |
| v5 Schnitt 5 — Stacks offen als Default | 54 | 49 | 29 | 35,74 | 22,77 | 41,49 | 16 von 16 |
| v6 Schnitt 6 — unfokussierte Lane einzeilig | 54 | 49 / **32** | 29 | 35,05 | 23,41 | 41,54 | 16 von 16 |

Fläche der ganzen Leiste: **182 950 px² → 137 730 px² (−24,7 %) bei GLEICHEM Fakt-Anteil in
Tinte** (50 295 → 50 298 px², die Streuung ist Messrauschen der Textkästen). Das ist die Aussage des
Owner-Satzes als Zahl: derselbe Inhalt auf einem Viertel weniger Fläche.

- **Schnitt 1 (Hebel 3, freie Plätze).** Ein freier Platz trägt einen Fakt, eine Session acht — er
  kostete 45 px gegen 61. Elf davon assen 495 der 775 px der Leiste, und bei 900 px lief die Achse
  unten aus dem Bild (Platz 16 fehlte). Jetzt 29 px; die Achse steht vollständig. Die BREITE der
  Rinne bleibt, damit die Nummern freier und belegter Plätze auf einer Kante stehen — nur ihre
  Höhe gibt nach, und nur dort, wo es keine Session gibt, für die eine Marke stehen könnte.
- **Schnitt 2 (Hebel 2, Innenabstände).** `padding 8/9` → `5/6`, Abstand Zeile 1/Zeile 2 `2` → `1`.
  Session 61 → 54, Lane 56 → 49. **Die Vorgabe „Richtung 40" ist damit NICHT erreicht und mit
  diesen Hebeln auch nicht erreichbar** — siehe die Rinne unten.
- **Schnitt 3 (Hebel 4, Platz ans Label).** Leisten-Polster 8 + Zeilen-Polster 10 lagen
  übereinander: 36 von 249 px verbraucht, bevor ein Zeichen steht. Jetzt 5 + 8, `r1`-Abstand 7 → 6.
  Das Label bekommt **+14 px** (Session 103 → 117, Lane 96 → 111); der Gesamt-Fehlbetrag aller
  Labels fällt von 284 auf 241 px (−15 %). Drei Labels bleiben beschnitten, alle drei sind
  Lane-Branchnamen — die sind länger als jede erreichbare Spalte. Der Fakt-Anteil sinkt dabei
  optisch von 37,49 auf 36,52 %: die Zeilen werden BREITER (233 → 239 px), und beim ungekürzten
  Label zählt das Messgerät zusätzliche Kastenbreite per Definition als Chrome, nicht als Tinte.

## Schnitt 4 — das leere Band links, am DOM zerlegt

Der Owner hat es am ausgelieferten Bild gesehen („guck dochmal wie viel platz links noch ist bei
v3") und auf ~46 CSS px beziffert, davon ~13,3 px nicht von der Marken-Rinne gedeckt. **Die Zahl
hält:** am DOM gemessen sind es 14,0 px, nicht 13,3 — die Abweichung ist, dass die
Rinnen-Rechnung oben den 6-px-Abstand hinter der Marke der Reservierung zuschlägt.

Das Band einer gewöhnlichen Session-/Frei-Zeile bei v3, jeder Posten eine Kastenkante, keine
Pixelschwelle (`flaechenbudget.js` bucht seit diesem Schnitt `band` je Zeile):

| x (von der Leistenkante) | Breite | was dort steht |
|---|---|---|
| 0 – 5 | 5 px | `#slots` Polster |
| 5 – 14 | 9 px | Polster der Zeile (8) + ihre 1-px-Kante |
| 14 – 40 | **26 px** | **`.mark` — die Reservierung** (Owner-Frage, unangetastet) |
| 40 – 46 | 6 px | `r1`-Abstand; er existiert NUR, weil die Marke vor dem Chip steht |
| 46 – 52 | 6 px | Polster des Adress-Chips — seine eigene Lesbarkeit, keine Leere |

**Also: 32 der 46 px hängen an der Reservierung, 14 sind schlichter Einzug.** Von diesen 14 sind
**5 genommen** (`#slots` 5 → 2, Zeilenpolster 8 → 6); die verbleibenden 9 px sind der Einzug der
Pille und ihr eigenes Polster — darunter stösst Tinte an die gerundete Kante. Ergebnis: die erste
Tinte der Zeile rückt von 52 auf 47 px, Zeile 2 von 46 auf 41, und das Label bekommt die 5 px
(117 → 122 px, Fehlbetrag aller Labels 239 → 225).

**Die Faltspalte liegt NICHT auf 15 von 16 Zeilen.** Der Verdacht war naheliegend und ist am DOM
widerlegt: `stackfold` ist ein Kind von `r1`, das der Client nur anhängt, wenn die Zeile einen
Stack trägt (`src/client.ts#slotRow`, `if (stack)`). In der `band`-Buchung beginnt die
Kinderliste jeder Session-, Lane- und Frei-Zeile mit `mark`; nur die Stack-Elternzeile hat davor
ein `stackfold` bei x = 11 (mit `margin-left: -3px`, deshalb die 15,5 px Tinte im Bild). Es ist
also nichts zu verschieben — die Spalte existiert auf den anderen Zeilen gar nicht.

Zweimal in dieser Tabelle steigt der Chrome-Anteil, obwohl Fläche gewonnen wurde (v3 und v4): die
Zeilen werden BREITER, und beim ungekürzten Label zählt das Messgerät zusätzliche Kastenbreite
per Definition als Chrome statt als Tinte. Die Fakt-TINTE bleibt konstant (50 016 → 50 034 px²).

## Schnitt 5 — die Lanes einer Session sind immer sichtbar

Owner, wörtlich: „ich will nicht das sie immer eingeklappt sind". `stackOpen` wurde aus
`localStorage` mit Default `[]` initialisiert und hielt die OFFENEN Stacks — jeder frische Browser
zeigte also jede Lane zugeklappt, bis jemand klickte. Der Speicher hält jetzt die **Abweichung**
(`fleet.stacks.closed`): leerer Speicher heisst offen, die Faltung bleibt und merkt sich nur, was
bewusst zugeklappt wurde. Kein Migrationspfad, weil die alte Liste nicht als die neue lesbar ist —
ein fehlender Stack hiess dort ZU und heisst hier AUF; der alte Schlüssel wird beim ersten
Schreiben entfernt, damit er nicht liegen bleibt.

**Am Fixture ändert sich keine Zahl, und das ist der Beweis, nicht sein Fehlen:** `cdp-shot.js`
hat den Stack bisher über `localStorage` aufgeklappt, bevor es fotografierte. Dieser Treiber
LÖSCHT den Speicher jetzt — das Bild zeigt, was ein Browser zeigt, dem nie etwas gesagt wurde,
und die Lanes stehen trotzdem da. v5 ist v4 in Zahlen und ein anderes Bild in der Praxis.

**WAS ES AUF EINER VOLLEN LEISTE KOSTET, gemessen, nicht geschätzt** (Testinstanz, Stand `full`:
13 Sessions + 3 Lanes, 0 freie Plätze, Fenster 900 px): zugeklappt trug die Leiste 13 Zeilen und
alle waren im Bild. Offen sind es 16 Zeilen mit zusammen 849 px gegen 775 px Leistenhöhe —
**14 von 16 im Bild, die Achse scrollt.** Das kippt, und es steht hier, statt zu fehlen.

## Schnitt 6 — eine Lane, in der du nicht bist, ist eine Zeile

Die zweite Hälfte des Owner-Satzes („vllt werden sie groesser wenn man direkt drauf geht") als
Vorschlag gebaut: die unfokussierte Lane verliert ihre zweite Zeile, die fokussierte behält sie.
49 → **32 px**. Sie behält Band, Label, Lifecycle-Punkt und Zustand; sie gibt auf: den
Checkout-Namen (der auf einer Lane das Label wiederholt), ihren Kontextstand und ihr Alter.

**Der Preis ist gemessen und ist ein FAKT-Verlust, kein freier Gewinn:** am Fixture fällt die
Fakt-Tinte 50 034 → 47 499 px² (−2 535 px² = die zweite Zeile EINER Lane), am vollen Stand
55 427 → 51 173 px² für drei. **Und es kauft die Zeile nicht zurück:** die 16 Zeilen des vollen
Stands schrumpfen 849 → 798 px, das Fenster hat 775 — **weiterhin 14 von 16**. Der bindende
Posten sind die dreizehn zweizeiligen SESSION-Zeilen (13 × 54 = 702 px), nicht die Lanes.
Wer die zweite Zeile der Lane behalten will, macht eine CSS-Zeile rückgängig.

## Die Succession in der Leiste — drei Fassungen zur Wahl, keine gebaut

„hier fehlt das band wo die succession-session reihe angezeigt wird oder?" — stimmt: die Fakten
stehen in `server.ts#successionFacts` und werden nur von der RECHTEN SPALTE gelesen
(`srow("Baton", …)`), ausgeliefert über `GET /api/slots/:id/brief`, also nur für die eine offene
Session. In der Leiste kam davon nichts vor.

**Wie der Fakt dorthin kommt, und was das kostet.** Er hängt jetzt am 2-s-Poll als `succession`
(`server.ts#successionRowView`). CPU ist nicht der Preis — alle Werte liegen im Speicher
(`laneSuccessions` am Slot, `laneSucceedCounts`, ein Filter über `lineageHandovers`, das auf
dieser Maschine 10 Datensätze hält). Der Preis sind BYTES, und dieser Poll hat ein gemessenes
Budget (14 KiB, ~1 300 B Luft, in `e2e/tasks.ts` gepinnt): **37–43 B je Zeile, die etwas zu sagen
hat**; unbedingt wären es ~640 B für 16 Zeilen, also die halbe Luft für eine Aussage, die auf
einem frischen Fleet auf keiner Zeile steht. Darum folgt das Feld der Regel von `stalled` und wird
WEGGELASSEN, wenn nichts zu sagen ist.

**Abwesend heisst „keine Nachfolge für diesen Platzinhaber verzeichnet" — und ausdrücklich NICHT
„Session 1".** `successionFacts` leitet die Linie einer MAIN mit `lineageStateOf(s)?.line.length ?? 0`
ab und liest damit eine Session ohne jede Lineage genauso wie eine gründende. Eine Fassung, die
aus einem abwesenden Schlüssel „s1" druckte, behauptete etwas, das dieser Server nicht
unterscheiden kann. Also druckt keine der drei etwas, wenn der Schlüssel fehlt.

Die drei Fassungen liegen auf der laufenden Testinstanz, gleiche Plätze, gleiche Fixture-Daten
(`…/?token=…#band=a|b|c` — im HASH, weil `/?token=…` mit 302 auf `/` antwortet und eine Query
dabei verloren geht):

| | was man sieht | was sie kostet |
|---|---|---|
| **A** eigene Bahn | eine dünne Linie unter der Zeile, darauf `s3 · 2/5` | **+17 px Zeilenhöhe** je Zeile mit Nachfolge; bei 900 px fällt der 16. Platz aus dem Bild |
| **B** in Zeile 2 | `s3 · 2/5` zwischen `ctx` und dem Alter, wo die anderen Messwerte stehen | **0 px Höhe, 0 px Label**; dafür steht die Nachfolge zwischen Sensoren, obwohl sie keiner ist |
| **C** Chip in Zeile 1 | ein Chip `s3 · 2/5` neben dem Label, im Rezept des Adress-Chips | **Label-Breite**: das Lane-Label verliert ~45 px; dafür ist es das Einzige, was eine ZUGEKLAPPTE Zeile behält |

Das Gerüst (`BAND_VARIANT`) ist genau das — ein Gerüst. Steht die Wahl, bleibt eine Fassung und
der Schalter geht; er darf kein Land sehen.

## Der EINE Posten, den ich gemessen und NICHT gebaut habe: die Rinne der Marke

Untersagt war ausdrücklich, „in beide Richtungen" etwas zu bauen. Also nur der Preis.

**Die reservierte Spalte kostet 18 038 px² = 13,1 % der ganzen Leiste** (v0: 25 510 px² = 13,9 %).
Gerechnet als (Breite der Marke + Abstand) × volle Zeilenhöhe über alle 16 Zeilen: 32 px auf
Session- und freien Zeilen, 27 px auf Lane-Zeilen. Das Element allein (26×26 bzw. 21×21) ist
7 486 px² = 5,4 %; der Rest ist die Spalte darunter, an der `r2` mit `margin-left` hängt.

**Sie ist zugleich die vertikale Untergrenze jeder belegten Zeile.** Zeile 1 ist 26 px hoch, weil
die Marke 26 px hoch ist; der Adress-Chip darin misst 20 px (12,5 px × 1,45 Zeilenhöhe + 2 × 1 px Polster, aus dem Stylesheet gerechnet). Ohne die Reservierung läge eine
Session-Zeile bei 48 statt 54 px — 6 px je belegter Zeile, hier 5 Zeilen = 30 px. Das ist der Grund,
warum „Richtung 40" mit den erlaubten Hebeln nicht erreichbar ist: **40 px lässt die Reservierung
nicht zu.**

**Und die Doppelbuchung ist bestätigt.** In Variante A2 (`docs/design/sidebar/marken-a2.html`) trägt
die Marke die Adresse in ihrer MITTE — sie steht also dort, wo heute der Chip steht, nicht daneben.
Eine eigene Rinne neben dem Chip bucht denselben Platz zweimal. Wer A2 wählt, bekommt 13,1 % der
Leiste zurück; wer eine Marke NEBEN der Adresse wählt, bezahlt diese 13,1 % dauerhaft. **Das ist
eine Owner-Frage, keine Lane-Entscheidung**, und sie ist mit Bau 2 zu entscheiden, nicht vorher.

## Was nicht gemessen ist

- „schlafend" und „Fehler" am Bild: die Fixture-Sessions sind alle frisch, beide Zustände sind nur
  über die Sonde in `e2e/slots.ts` abgedeckt, nicht fotografiert.
- Die Zahlen gelten für dieses eine Fixture-Verhältnis (3 Sessions : 2 Lanes : 11 frei). Bei voller
  Leiste (0 freie Plätze) trägt Schnitt 1 nichts bei, und der Gewinn fällt auf das, was Schnitt 2
  und 3 halten.

Bilder und die rohen `*-budget.json` liegen unter `/tmp/fleet-shots-public/raumnutzung/` auf dem
Bild-Server dieser Maschine — die Adresse steht bewusst NICHT hier (`leak-pin: tracked files contain
no configured deploy identity` hat genau diese Zeile gestellt). Nachfahrbar ist die Messung ohne die
Bilder: die Treiber und alle Zahlen stehen im Baum.

## Nachtrag (Session 3): die absoluten Tintenzahlen sind NUR innerhalb dieser Tabelle vergleichbar

Ein Nachlauf des Treibers gegen `30d1170f` (HEAD, also derselbe Client wie v6) liefert **nicht**
die v6-Zeile: `fact` 41 245 statt ~48 000–50 000 px², `factPct` 30,43 statt 35,05, `lblShortTotal`
30 px statt 225. Die Ursache ist kein Regress am Client, sondern **die Apparatur hat sich zwischen
v6 und diesem Lauf geändert**: bis `30d1170f` bekamen Slot 2/4 und beide Lanes `$SRC` — also DIESES
Repository — als `cwd`/`repo`. Die Zeilen trugen damit echte Git-Fakten (Lane-Diff, Lifecycle-Punkt
mit Inhalt) und lange, echte Namen. Seit dem Fix zeigt das Fixture auf ein Wegwerf-Repo mit einem
Commit: kürzere Namen, keine Diffs, weniger Tinte bei gleicher Geometrie.

Was das für Leser heißt:

- Die Tabelle v0…v6 bleibt gültig — alle sieben Stände wurden mit **derselben** Apparatur gemessen,
  und die Aussage ist ein VERHÄLTNIS (−24,7 % Fläche bei gleicher Fakt-Tinte).
- Ein einzelner Nachlauf nach `30d1170f` darf **nicht** gegen eine Zelle dieser Tabelle gehalten
  werden. Wer v0 und HEAD erneut vergleichen will, misst BEIDE Stände neu mit dem heutigen Treiber.
- Geometrie ist unverändert nachprüfbar: `rows` 16, `occupied` 5, `medianRowH` 29,
  `rowsVisibleInBar` 16 — der Nachlauf bestätigt, dass bei 900 px alle sechzehn Zeilen im Bild
  stehen.

Vorher/Nachher als Bild (900 und 1200 px, `deviceScaleFactor: 2`) liegt unter `leiste-733b/` auf dem
Bild-Server dieser Maschine, `vorher-*` ist der Stand `d2e893c9^` (vor Bau 1), `nachher-*` ist
`30d1170f`. Eine Einschränkung, die am Bild sichtbar ist: im `vorher`-Lauf blieb der Lane-Stack
ZUGEKLAPPT (der alte Client reagierte nicht auf den Aufklapp-Schritt von `cdp-shot.js`), das Bild
zeigt daher 14 Zeilen und keine Lane-Zeile. Als Vergleich der DESIGNSPRACHE taugt das Paar, als
Flächenvergleich nicht.

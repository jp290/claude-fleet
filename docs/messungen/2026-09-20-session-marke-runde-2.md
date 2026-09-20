---
frage: Was an Variante A hält einer Prüfung am gerenderten Bild nicht stand — und was macht aus ihr eine Marke in AA-Qualität?
urteil: Acht Befunde des Owners am Bild von Runde 1 sind nachgeprüft; alle acht treffen zu, zwei kamen dazu. Der gemeinsame Nenner ist, dass A ein ZEICHEN ist und kein MESSGERÄT: es trägt Typ statt Session, Fläche statt Wert, und eine zweite Adresse neben der ersten. A2 dreht das um — Adresse im Zentrum, Kontext-Füllstand als Bogen, keine Kachel, Spur auch auf freien Plätzen. Zwei Gegenentwürfe (D Kerbe, E Kantenzeile) sind gebaut und beide messbar schwächer. Empfehlung: A2. Nebenbefund über die Methode: die Pixelmetrik aus Runde 1 kann die Verbesserung an Befund (1) NICHT sehen, weil sie Fläche misst und nicht Lesbarkeit.
bereich: [leiste, session-marke, identitaet, messmethode]
belege: [docs/design/sidebar/marken2.js, docs/design/sidebar/marken2.css, docs/design/sidebar/marken-a2.html, docs/design/sidebar/marken-d.html, docs/design/sidebar/marken-e.html, docs/design/sidebar/marken-mess.html, docs/messungen/2026-09-20-session-marke-entwurf.md, src/client.ts#projectHue, src/icons.ts#harnessMark]
nicht-gemessen: kein Produktcode, keine Suite, kein src/client.ts; kein Test mit einem Menschen; keine Messung auf einem echten Handy; die Frage acht gegen zwölf Projekt-Töne bleibt offen wie in Runde 1 §6; wie sich A2 bei mehr als 16 Plätzen verhält, ist nicht gemessen; die Bewegung ist nur als Standbild verglichen (Phase 0), nicht als Film.
stand: 2026-09-20
---

# Runde 2 der Session-Marke: von einem Zeichen zu einem Messgerät

Owner-Auftrag 2026-09-20, wörtlich: „ich mag die Idee aber Ich glaube das bei der Ausarbeitung noch
einiges möglich wäre! Guck dir A am besten einmal selbst an im Kontext zur Idee und dann frag dich
was man vllt besser machen könnte. Sei kritisch und versuch AA Indie artwork quality zu erreichen".

Grundlage ist das gerenderte Bild `c16-marke-a.png` (2200×1800, Marken auf 3× gelesen) und der Code,
der es erzeugt (`marken.js`, `marken-a.html`). Alle acht Befunde der Orchestratorin wurden am Bild
und am Code nachgeprüft, bevor etwas gebaut wurde.

## 1. Der gemeinsame Nenner der acht Befunde

Einzeln gelesen sind es acht Details. Zusammen sagen sie eine Sache: **A ist ein Erkennungszeichen,
und die Leiste braucht ein Messgerät.** Ein Zeichen beantwortet „welches" — und A beantwortet nicht
einmal das, weil es den TYP zeichnet (Harness-Musterfamilie) und nicht die Session. Ein Messgerät
beantwortet zusätzlich „wie viel" und „wie weit", und genau die Werte standen in Runde 1 als Text
daneben, während die Marke ihre 484 CSS-Pixel (22×22) vollständig für Dekoration ausgab.

Daraus folgt der Umbau von A2, und jeder einzelne Kanal folgt einem Befund:

| Kanal | Fakt | Mittel | aus Befund |
|---|---|---|---|
| Farbton | Projekt | `projectHue(repo)`, acht Töne, unverändert | — |
| Tonstufe | Session | fünf Stufen INNERHALB des Projekttons | (2) |
| Strichart | Harness | claude voll · codex Striche · pi Punkte, auf der **Spur** | (1) |
| Bogen | Kontext-% | von 12 Uhr im Uhrzeigersinn, 100 % = geschlossen | (4) |
| Zentrum | Adresse | MAIN die Slot-Zahl, Lane ihr Buchstabe | (1), (5) |
| Spur | Rolle + Platz | MAIN geschlossen · Lane unten offen · frei nur Spur | (6) |
| Zustand | Chroma + Strichstärke + Bewegung | sechs Zustände, zwei Mittel je Paar | (7) |

## 2. Befund für Befund: behoben, verworfen oder gemessen

**(1) Die Marke identifiziert den Typ, nicht die Session — BEHOBEN, aber nicht messbar.**
Bestätigt: 11 der 19 Marken sind Ringe, weil Ringe für `claude` stehen; der Seed aus Slot und
`openedAt` verschiebt nur die Ringphase. In A2 trägt jede Marke ihre Adresse als Zeichen im Zentrum
— 19 von 19 Marken enthalten damit ein direkt lesbares Adressmerkmal, in A sind es 0 von 19. **Genau
gesagt eindeutig ist es bei den 14 MAIN-Marken** (die Slot-Zahl); eine Lane trägt nur ihren
Buchstaben, und `A` kommt dreimal vor (3A, 4A, 10A) — eindeutig wird sie erst mit ihrem Band, das in
der Einrückung und in der Schiene der Gruppe steht. Das ist Absicht: zwei Zeichen sind bei 21 px
nicht mehr lesbar, und die Lane hat ihr Band ohnehin direkt über sich.
*Die Pixelmetrik sieht das nicht* (§4). Zusätzlich ist das Harness von der Musterfamilie auf die
Strichart der Spur gewandert; damit teilen sich alle drei Harnesses EINE Form, und der Platz, den
die drei Formen belegt haben, ist für den Freiheitsgrad je Session frei geworden.

**(2) Fast alles ist lila — BEHOBEN und GEMESSEN, mit einer benannten Grenze.**
Fünf Tonstufen aus dem Seed, die Helligkeit ±12, Sättigung ±12 und den Hue höchstens ±8 Grad
verschieben. Gemessen über alle 19 Sessions:

| | Wert |
|---|---|
| Hue-Abstand INNERHALB eines Projekts | max **16°**, Mittel 8,0° (80 Paare) |
| Hue-Abstand ZWISCHEN zwei Projekten | min **34°**, Mittel 101,2° (91 Paare) |

Die Variation bleibt also nachweisbar innerhalb des Projektbandes: der größte Abstand im Projekt
(16°) ist kleiner als der kleinste Abstand zwischen zwei Projekten (34°). **Grenze, die im Entwurf
stehen muss:** bei 13 Sessions in `claude-fleet` und fünf Stufen kollidieren Stufen zwangsläufig —
Slot 1, 3A, 4A, 10 und 15 landen alle auf Stufe 0. Die Tonstufe lockert die Spalte auf, sie ist
NICHT die Identität der Session. Die Identität ist das Zeichen im Zentrum.

**(3) Die gefüllte Rundkachel ist eine Fremdsprache — BEHOBEN.**
Bestätigt am Bild: 19 gefüllte Rundkacheln untereinander lesen sich wie ein Homescreen. Die Kachel
ist ersatzlos weg; die Marke sitzt auf dem reinen Grund. Was den Platz hält, ist die Spur.

**(4) Die Marke wiederholt keinen Wert — BEHOBEN, die Zahl bleibt.**
Der Bogen IST der Kontext-Füllstand. Der Befund erlaubte, die Zahl zu verwerfen, wenn der Bogen die
Lesbarkeit kostet; verworfen wird sie trotzdem nicht: ein Bogen sagt „ungefähr wie voll", und das
Band, um das es hier geht (25–30 % Kontext), ist eine Grenze, keine Tendenz. Bogen und Zahl sind
bewusst redundant. Was der Bogen bringt, ist messbar — der Unterschied zwischen 18 % und 73 % war
in A 0,48 % der Zeile und ist in A2 **1,55 %**, also das 3,2-fache.

**(5) Marke und Slot-Chip sind zweimal dieselbe Adresse — BEHOBEN.**
Der Mono-Chip ist weg, die Adresse steht im Zentrum der Marke. Die Zeile hat drei Spalten statt vier:
Marke · Name · Zahlen.

**(6) Freie Plätze haben keine Marke — BEHOBEN.**
Ein freier Platz zeichnet die Spur und seine Zahl, ohne Bogen. Die Achse der Spalte bricht nicht
mehr; die Zahl der gezeichneten Marken steigt dadurch von 19 auf 21 (16 Plätze + 5 Lanes).

**(7) Ruhend und schlafend sind beide nur gedimmt — BEHOBEN mit ZWEI Mitteln.**
`rest` behält den Projektton und steht still, `sleep` verliert die Farbe (Sättigung 0). Das allein
reichte nicht: im Graustufenbild fiel der Unterschied wieder zusammen, weil Chroma dort per
Definition weg ist. Deshalb hat `sleep` ein zweites, farbfreies Mittel bekommen — halbe
Strichstärke. Dazu kamen zwei Zustände, die A überhaupt nicht zeichnen konnte (§3).

**(8) Bei 3A fehlt die senkrechte Lane-Linie — BEHOBEN, und es war kein Ausrutscher im Raster.**
Die Ursache steht in `marken-a.html`: die Linie hing an `.row.work::before`, war also der
Arbeits-Indikator und nicht die Gruppenlinie — sie fehlt bei 3A (Zustand `need`) und bei 10A
(`done`), und sie steht bei 4A, weil das arbeitet. Ein Mittel mit zwei Bedeutungen. In A2 ist die
Schiene eine echte Schiene (`border-left` an der Lane-Gruppe), und der Arbeitszustand lebt
ausschließlich in der Marke.

**(9) Eigener Befund: die Zahlenspalte war keine Spalte — BEHOBEN.**
In A saßen Prozent und Alter als `flex:none` hinter einem flexiblen Label, also verschob die Länge
des Alters-Textes die Prozentzahl. Gemessen am Messstand, drei Bilder, die sich in genau einem Fakt
unterscheiden (`meta` = `jetzt` / `9 min` / `84 min`):

| | Wanderung der Prozentspalte |
|---|---|
| A | **12 CSS-px** |
| A2 | **0 CSS-px** |

**(10) Eigener Befund: die Marke kannte vier Zustände, die Daten tragen sechs — BEHOBEN.**
`STATE` in `marken.js` kennt `work`, `rest`, `sleep`, `bad`. `marken-daten.js` führt zusätzlich
`need` (3A) und `done` (10A). Beide fielen über `STATE[state] ?? STATE.rest` still auf `rest` zurück
— ausgerechnet `need`, der einzige Zustand, der den Owner braucht, war nicht zeichenbar. A2 zeichnet
alle sechs plus `free`; `need` ist der lauteste (invertiertes Zentrum plus atmender Außenring) und
das einzige Mittel, das über den Rand der Marke hinausgeht.

## 3. Was die Zustände jetzt trennt (Zeile 504×96 = 48 384 Pixel, Methode wie Runde 1 §1)

| Fakt | A | A2 |
|---|---|---|
| arbeitet vs. ruht | 5,50 % | 3,74 % |
| ruht vs. schläft | 5,55 % | 3,78 % |
| ruht vs. wartet (`need`) | 1,78 % | **6,21 %** |
| arbeitet vs. rot | 5,52 % | 5,54 % |
| Projekt A vs. Projekt B | 3,72 % | 1,95 % |
| Session vs. Session (gleiches Projekt) | 2,77 % | 2,05 % |
| 18 % vs. 73 % Kontext | 0,48 % | **1,55 %** |

Die Zahlen für `need` und für den Kontext gehen deutlich hoch — das sind die beiden Kanäle, die A
gar nicht hatte. Die übrigen gehen HERUNTER, und das ist kein Versehen: siehe §4.

## 4. Die Metrik aus Runde 1 misst Fläche, nicht Lesbarkeit — das ist selbst ein Befund

A2 ist nach der Pixelmetrik bei „arbeitet vs. ruht" schwächer als A (3,74 % gegen 5,50 %). Der Grund
ist mechanisch: A füllt eine 22-px-Kachel, also kippt jede Zustandsänderung eine große Fläche; A2
zeichnet Striche, also kippen wenige Pixel. **Die Metrik belohnt genau das, was Befund (3)
verbietet.** Am schärfsten sieht man es an dem Fall, den Befund (1) namentlich nennt — Slot 1, 3, 4
und 15, gleiches Projekt, gleiches Harness:

| Paar | A | A2 |
|---|---|---|
| 1 ~ 3 | 10,41 | 8,56 |
| 1 ~ 4 | 6,39 | 5,45 |
| 1 ~ 15 | 6,29 | 7,06 |
| 3 ~ 4 | 13,96 | 10,11 |

(mittlerer absoluter Kanalabstand über das 68×68-Feld der Marke)

Die Zahlen sind praktisch gleich, teils niedriger — und trotzdem ist der Unterschied in A2 der
zwischen einer gedruckten `1` und einer gedruckten `4`, in A der zwischen zwei Ringphasen. Eine
Pixeldifferenz kann nicht unterscheiden, ob ein Unterschied BENENNBAR ist. Deshalb steht in §2 unter
(1) eine Abzählung statt einer Pixelzahl: 19 von 19 Marken tragen ein lesbares Adressmerkmal gegen
0 von 19. Für die nächste Runde gilt: die Pixelmetrik taugt für Zustände, die als Fläche
wirken, und nicht für Identität.

Die Verwechslungsmessung über alle 171 Paare bestätigt das Bild nur schwach und aus demselben Grund
(die engsten Paare sind immer die dunklen, schlafenden Marken, weil dunkel gegen dunkel wenig
Pixelabstand ergibt):

| | Paare unter 4,0 | kleinster Abstand | Median |
|---|---|---|---|
| A | 8 von 171 | 1,10 (5 ~ 11) | 14,70 |
| A2 | **5 von 171** | 1,06 (2 ~ 8) | 14,50 |
| D | 12 von 171 | 1,70 (3B ~ 3C) | 14,17 |

Eine Stelle sagt die Metrik allerdings klar, und es ist die entscheidende: bei **D** stehen unter den
engen Paaren `1 ~ 15` (2,51), `1 ~ 4` (3,29) und `4 ~ 15` (3,48) — also genau die Marken, die Befund
(1) namentlich nennt. Bei A und A2 taucht keines dieser drei Paare in der Liste auf. D wiederholt den
Befund nicht nur dem Auge nach, sondern auch nach der Zahl.

## 5. Die beiden Gegenentwürfe — beide gebaut, beide schwächer

**D · Kerbe** (`marken-d.html`) — dieselbe Scheibe, Zentrum und Adresse getauscht: im Zentrum das
Projekt als Monogramm (`cf`, `pr`, `ko`), die Adresse als Kerbe an der Uhrzeit des Slots.
- Was D gewinnt: das Projekt liest sich ohne Farbe und ohne Gedächtnis.
- Was D verliert, am Bild belegt: sechs Marken untereinander sagen alle `cf` — **das ist Befund (1),
  nur mit Buchstaben statt mit Ringen**. Dazu liegt die Kerbe für Slot 1 auf 12 Uhr und damit genau
  unter dem Anfang des Bogens, und `need` verliert sein Mittel, weil das Zentrum besetzt ist.
- Gemessen: 12 von 171 Paaren liegen unter 4,0 gegen 8 bei A und 5 bei A2 — und drei davon sind die
  Paare aus Befund (1) (§4).
- Verworfen. Der Grund ist nicht Geschmack: D löst den Befund nicht, der die Runde ausgelöst hat.

**E · Kantenzeile** (`marken-e.html`) — der skeptische Gegenentwurf: gar keine Marke. Die Kante der
Zeile trägt Projekt (Ton) und Kontext (Füllhöhe), ein Zeichen vor dem Namen das Harness, die Schrift
den Zustand. Kein Canvas, kein Bild pro Sekunde, 0 ms Zeichenkosten.
- Was E gewinnt: es kann strukturell nicht flimmern und braucht keinen Takt.
- Was E verliert, am Bild belegt: die Adresse muss als eigene Spalte zurück, und damit hat E FÜNF
  Spalten — Zeichen, Name, Adresse, Prozent, Alter. Im Bild sind dadurch `Land-Pipel…`,
  `Orchestrat…` und `Fleet-Betri…` abgeschnitten, wo A2 sie ganz zeigt. E verschärft Befund (5),
  statt ihn zu lösen, und der Zustand hat wieder nur Helligkeit als Mittel — der Ausgangsbefund von
  Runde 1.
- Verworfen, aber mit Gewinn: E ist der Beleg, dass „weniger" hier nicht die Antwort ist, und er ist
  gebaut statt behauptet.

## 6. Kosten und harte Grenzen

| | bewegte Marken | ein Bild | Anteil eines Kerns bei 8 Bildern/s |
|---|---|---|---|
| A (Runde 1) | 8 von 19 | 0,06 ms | 0,05 % |
| A2 (Leiste + Zustandstafel) | 12 von 28 | 0,08–0,13 ms | 0,1 % |
| D (nur Leiste) | 9 von 21 | 0,06 ms | 0,0 % |
| E | 0 von 0 | 0 ms | 0 % |

A2 bewegt mehr Marken als A, weil `need` dazugekommen ist und weil die Zustandstafel der Seite
mitzählt; in der Leiste allein sind es 9 von 21 — dieselbe Zahl, die D misst, das keine Tafel hat.
Die 0,08 und die 0,13 ms sind zwei Läufe derselben Seite; bei 0,1 % eines Kerns entscheidet die
Streuung nichts. Alles andere aus Runde 1 §4 gilt unverändert und
ist am selben Code belegt: ein gemeinsamer `MarkTicker` statt einer Schleife je Marke,
`prefers-reduced-motion` und ein versteckter Tab halten ihn an, jede Marke hat ein Canvas fester
Größe, also kann kein Layout springen.

**Ohne Farbe** (`*-ohne-farbe.png`): Adresse, Bogenlänge, Strichart, offene Spur und die Strichstärke
von `sleep` tragen alle ohne einen Farbwert. Was in Graustufen NICHT mehr trennt: `bad` gegen `need`
— beide sind dann „ein Ring mehr, der sich bewegt". Das bleibt so und ist vertretbar, weil beide
dasselbe verlangen: hinsehen.

## 7. Empfehlung

**A2.** Sie behebt acht von acht Befunden des Owners und zwei eigene, sie kostet 0,1 % eines Kerns,
und sie ist die einzige der drei, die die Zeile schmaler macht statt breiter. D und E sind gebaut,
gemessen und verworfen — D, weil es Befund (1) mit anderen Mitteln wiederholt, E, weil es Befund (5)
verschärft.

Nicht gelandet, nicht in `src/client.ts`: der Stufenplan-Schritt S2 ist weiter blockiert, solange
Client-Lanes offen sind (Runde 1 §6; `GET /api/self/drift` meldet am 2026-09-20 zwei offene Lanes
auf `src/client.ts`, `fleet/260920065326-d5fa` und `fleet/260918203940-4198`).

## Methode

```
# Prototypen (nur Vorschau, nicht gelandet), Vorschau-Server mit Wurzel docs/design/sidebar/
#   marken-a2.html · marken-d.html · marken-e.html · marken-mess.html
# Bilder: Chrome headless, 1100x900 CSS bei dpr 2 = 2200x1800 — die Masse von c16-marke-a.png
c16-marke-a2.png · c16-marke-d.png · c16-marke-e.png · c16-marke-*-ohne-farbe.png
c16-marke-a2-vergleich.png   (A links, A2 rechts, gleicher Ausschnitt)
# Signalmessung: marken-mess.html rendert EINE Zeile, jeder Fakt ueber die Adresszeile steuerbar.
#   Zwei Bilder unterscheiden sich in genau einem Fakt; verglichen werden 504x96 dpr-Pixel.
# Verwechslungsmessung: alle 19 Sessions einzeln gerendert, Marke auf 68x68 dpr-Pixel
#   zugeschnitten, mittlerer absoluter Kanalabstand ueber alle 171 Paare.
# Toene: marken2.js#toneOf ueber alle 19 Sessions, Hue-Abstand innerhalb vs. zwischen Projekten.
# Zeichenkosten: MarkTicker#bench — 60 volle Durchlaeufe ueber alle bewegten Marken, ms je Durchlauf.
```

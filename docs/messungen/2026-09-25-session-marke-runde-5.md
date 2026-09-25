---
frage: Kann die Session-Marke eine Pflanze sein, deren Gestalt sich aus Repo und Rolle (+ Harness, Zustand) ableitet, statt eines abstrakten Musters?
urteil: Drei Fassungen gebaut (A Bluete, B Zweig, C Samenstand) auf denselben 16 Plaetzen und mit denselben Seeds wie Runde 3. Eine Grammatik fuer alle drei — Art = Repo (dasselbe Fach wie projectHue), Wuchs = Rolle (einzeln · drei · zwei · geduckt · klein), Kleinmerkmal = Harness, Exemplar = Session, Bewegung = Zustand. Gemessen: 0,10 bis 0,25 ms je Bild bei 19 laufenden Marken (0,6 bis 1,5 % eines 60-Hz-Bildes), 60 Bilder/s in 3 von 4 Laeufen mit allen drei Spalten gleichzeitig; ruht und schlaeft bewegen exakt 0,000 % der Pixel; reduced-motion: zwei Bildschirmfotos im Abstand von 2 s byteweise gleich, volles Standbild; kein Paar unter der Verwechslungsschwelle 4,0, weder mit noch ohne Farbe, der knappste Fall ist A ohne Farbe mit 4,09. Empfehlung: B Zweig — der groesste kleinste Paarabstand (6,11 ohne Farbe, alle ruhend) und die Wuchsregel ist genau die "gewisse Logik", die der Owner an B Automat mochte.
bereich: [leiste, session-marke, identitaet, creative-coding, pflanzen]
belege: [docs/design/sidebar/marken5.js, docs/design/sidebar/marken5.html, docs/design/sidebar/marken3.js, docs/design/sidebar/marken-daten.js, docs/design/sidebar/mess/fps.js, docs/design/sidebar/mess/bewegung.js, docs/design/sidebar/mess/reduced-motion.js]
nicht-gemessen: kein Test mit einem Menschen — ob man zwei Slots "in einem Wort" auseinanderhaelt und nach zehn Sekunden ahnt, was die Bewegung bedeutet, ist die Probe des Auftrags und hier NICHT gemacht; kein Telefon, keine schwache Maschine (alles auf diesem Mac unter Last ~13); die Geraeteunabhaengigkeit ist nur per grep belegt (kein Math.sin/cos/random in marken5.*), die Engine-Probe aus Runde 3 ist nicht wiederholt; der Kontext-Fuellstand ist in keiner Fassung abgebildet; kein Produktcode, keine Suite.
stand: 2026-09-25
---

# Die Marke als Pflanze

Der Owner, woertlich (2026-09-25): „wir könnten sicherlich mit javascript irgendwelche blumen, pflanzen
oder ähnliche Unterscheidungssymbole, erstellen lassen." Zu Runde 3: „Ich fand alle davon zugegebener
maßen zu abstrakt und gar nicht wirklich stimmig.." und „B gefäät mir so ein bisschen weil es einer
gewissen Logik zu folgen scheint.."

Die laufende Seite ist das Werkstueck: `docs/design/sidebar/marken5.html`. Dazu `?arten=1`, eine
Artentafel (jede Art, Rolle, jedes Harness und jeder Zustand in 56 px, `&z=120` fuer groesser), und
`?tafel=1`, der Kontaktbogen, der die Paarabstaende in der Seite selbst ausrechnet.

## 1. Eine Grammatik, drei Zeichensprachen

Jedes Mittel traegt genau einen Fakt. Die Grammatik ist allen drei Fassungen gemeinsam, damit der
Vergleich die ZEICHENSPRACHE misst und nicht drei verschiedene Abbildungen.

| Fakt | Merkmal | A · Bluete | B · Zweig | C · Samenstand |
|---|---|---|---|---|
| Repo | Art (8 Faecher = die 8 Toene von `projectHue`) | Tulpe · Margerite · Glocke · Stern · Mohn · Winde · Distel · Rose | Farn · Tanne · Gras · Weide · Baum · Kaktus · Bambus · Busch | Pusteblume · Dolde · Ähre · Rispe · Sonnenblume · Kolben · Traube · Quirl |
| Repo | Farbton | `projectHue`, unveraendert | dito | dito |
| Rolle | Wuchs: Zahl und Groesse der Exemplare | MAIN einzeln · Orchestratorin drei · Astra zwei · Steward geduckt mit Blattrosette · Lane klein | dito | dito |
| Harness | Kleinmerkmal | Blatt rund (claude) · schmal (codex) · gefiedert (pi) | Knospe an jeder Spitze (claude) · kahl (codex) · gegabelt (pi) | Blatt wie A |
| Session | Exemplar | Neigung, Kruemmung, Blattseite, Bluetendrehung aus dem Seed | Neigung, Einrollen, Gabelwinkel | wie A, dazu welche Samen fliegen |
| arbeitet | Bewegung | wiegt sich; der Wind laeuft als Welle von der Wurzel zur Spitze | dito, durch jede Verzweigung | wiegt sich, drei Samen loesen sich und treiben davon wie Flakes |
| wartet (`need`) | Bewegung + Rand | leiser, langsamer Wind und der atmende Rahmen aus Runde 3 | dito | dito, Samen fliegen langsamer |
| ruht | — | steht, Bluete offen | steht | steht, Kopf voll |
| fertig | Struktur | verblueht: nur der Fruchtknoten steht | keine Knospen mehr | abgeblasen: ein Drittel der Samen bleibt |
| schlaeft | Struktur + grau | haengt, Bluete geschlossen, Blaetter bis auf eins ab | haengt, jeder zweite Ast fehlt | haengt, die Haelfte der Samen fehlt |
| Fehler | Struktur + rot | Stiel geknickt, zittert | Stamm geknickt, zittert | geknickt, die Samen zittern |
| frei | — | nackte Erde (eine Linie) | dito | dito |
| Kontext-% | — | nicht abgebildet | nicht abgebildet | nicht abgebildet |

Warum Art und Farbton DERSELBE Fakt sind: die Art ist der Index des Farbtons in `PROJECT_HUES`. Damit
bleibt das Projekt ohne Farbe lesbar, und zwei Repos teilen eine Art genau dann, wenn sie heute schon
einen Farbton teilen — die Kollision, die `src/client.ts#projectHue` nach §F2 akzeptiert, und keine
zweite. Warum Kontext-% fehlt: jede Kandidatin (Blattfarbe, Stielhoehe, Wasserlinie) war entweder ein
Balken in Pflanzenkleidung oder aenderte die Gestalt mit der Zeit — die Zahl steht weiter in der Zeile.

**Der Schalter:** Platz waehlen (oder eine Zeile anklicken), dann Repo, Rolle und Harness umstellen.
Der Seed bleibt dabei stehen — er ist EXAKT der aus `marken-laufend.html` (`seedOf` mit role main/lane) —,
also zeigt das Umstellen nur, was der Fakt aendert: Slot 1 wird von „die violette Distel · einzeln" zu
„die rote Tulpe · Gruppe aus drei" und behaelt dabei die Neigung seiner Hauptpflanze. Die Lupe zeigt
den gewaehlten Platz in allen drei Fassungen auf 96 px. Geprueft ueber das DevTools-Protokoll:
Beschriftung vor, nach und nach „zuruecksetzen" wie erwartet.

**Aus Runde 3 unveraendert:** was laeuft, ist der Zustand; was steht, ist die Regel — die Pflanze ist
ab Bild 0 fertig gewachsen. Eigener Sinus (`dsin`/`dcos` aus `marken3.js`), kein `Math.random`.
Zerfall in der Struktur. Eine Canvas je Leiste, ein rAF, Clip je Zelle. Anders als dort akkumuliert
nichts: eine laufende Zelle wird je Bild geleert und neu gezeichnet, eine stehende einmal — Ruhe
braucht damit keinen Trick.

## 2. Was man je Fassung sieht (ein Satz)

- **A · Bluete** — eine Umrisszeichnung aus Stiel, Blaettern und einer Bluete; man sagt „die violette
  Distel", und im Wind wiegt sie sich.
- **B · Zweig** — eine Wuchsregel, mit der Schildkroete gezeichnet (Fieder, Etage, Gabel, Bogen); der
  Wind laeuft als Welle von der Wurzel bis in die Spitzen.
- **C · Samenstand** — ein Kopf aus Punkten wie die Flakes der Chat-Ansicht; arbeitend loesen sich
  Samen und treiben davon, ruhend ist der Kopf voll und still.

## 3. Gemessen

### 3.1 Rechenzeit je Bild

`window.__bench()` (Bauform `MarkStage#bench` aus Runde 3: 90 volle Bilder ueber alle Zellen),
getrieben von `mess/fps.js` unveraendert. Anteil = ms / 16,67 ms.

| | echter Betrieb (9 laufend) | Messfall: alle 19 arbeiten | Anteil eines 60-Hz-Bildes (Messfall) |
|---|---|---|---|
| A · Bluete | 0,06–0,14 ms | 0,094–0,097 ms | 0,6 % |
| B · Zweig | 0,07–0,12 ms | 0,100–0,101 ms | 0,6 % |
| C · Samenstand | 0,09–0,11 ms | 0,242–0,249 ms | 1,5 % |

Bilder je Sekunde, echt gemessen mit Compositor und allen drei Spalten gleichzeitig (57 Zellen in drei
Canvas): **60 in 3 von 4 Laeufen**. Der erste, kalte Lauf meldete im Messfall 31 — bei einer
Maschinenlast um 13 (`uptime`: 12,96 13,53 11,01). Das ist ein Zeichen fuer Last, nicht fuer die
Seite: die Zeichenkosten lagen im selben Lauf bei 0,09 bis 0,24 ms.

### 3.2 Unterscheidbarkeit ueber ALLE Paare

Kontaktbogen `marken5.html?tafel=1`: 19 Sessions je Fassung, jede Marke 24 px bei festem dpr 2, also
48×48 Geraetepixel; mittlerer absoluter Kanalabstand ueber alle **171 Paare**, wie in Runde 3
(`mess/kontaktbogen.py`), nur in der Seite gerechnet. Ohne Farbe = Luma (Rec. 709) derselben Pixel.
„Gleiche Fakten" = gleiche Art, Rolle und gleiches Harness: nur das Exemplar trennt sie (7 Paare je
Fassung, u. a. 4A~10A, 6~12).

Zwei Laeufe: mit dem echten Zustand jeder Session und mit allen ruhend (`&zustand=rest`, nur die
Identitaet, der haertere Fall).

| | kleinster | Median | unter 4,0 | gleiche Fakten, kleinster | Tinte |
|---|---|---|---|---|---|
| **echter Zustand, Farbe** | | | | | |
| A · Bluete | 5,29 (5~8) | 20,27 | 0 / 171 | 8,10 | 12,4 % |
| B · Zweig | **8,64** (3B~3C) | **24,50** | 0 / 171 | **10,36** | 15,2 % |
| C · Samenstand | 5,22 (5~10A) | 18,19 | 0 / 171 | 7,15 | 10,9 % |
| **echter Zustand, ohne Farbe** | | | | | |
| A · Bluete | 5,29 | 16,83 | 0 / 171 | 6,68 | 11,8 % |
| B · Zweig | **7,67** | **21,39** | 0 / 171 | **9,75** | 14,8 % |
| C · Samenstand | 4,75 | 15,35 | 0 / 171 | 6,08 | 10,1 % |
| **alle ruhend, Farbe** | | | | | |
| A · Bluete | 5,27 (3B~3C) | 21,18 | 0 / 171 | 6,11 | 13,3 % |
| B · Zweig | **7,03** (3B~3C) | **24,96** | 0 / 171 | **7,69** | 15,7 % |
| C · Samenstand | 5,06 (3B~3C) | 19,61 | 0 / 171 | 5,78 | 11,1 % |
| **alle ruhend, ohne Farbe** | | | | | |
| A · Bluete | 4,09 (3C~10A) | 17,67 | 0 / 171 | 4,97 | 12,5 % |
| B · Zweig | **6,11** (3B~3C) | **23,10** | 0 / 171 | **7,39** | 15,0 % |
| C · Samenstand | 4,22 (3B~3C) | 17,49 | 0 / 171 | 4,71 | 10,1 % |

**Kein Paar unter 4,0, in keiner Fassung, in keinem der vier Faelle.** B gewinnt jede Spalte. Die Zahlen
sind NICHT mit Runde 3 vergleichbar: eine Pflanze ist eine Linienzeichnung mit 10 bis 16 % Tinte, der
Attraktor hatte 37 %, und schwarzer Grund drueckt jeden mittleren Pixelabstand. Verglichen werden die
drei Fassungen untereinander.

Zwei Befunde stecken in den engsten Paaren:

1. **Die Lanes sind der enge Fall** (3B~3C, 3C~10A, 4A~10A): alle drei claude-fleet, alle drei klein,
   auf 24 px bleibt fuer die kleine Wuchsform wenig Bild. Im echten Betrieb sind Lanes 19 px, also noch
   enger; gemessen ist 24.
2. **Schlaf nimmt die Farbe weg.** Im echten Zustand ist in A das engste Paar 5~8 — zwei SCHLAFENDE
   Sessions aus zwei verschiedenen Repos. Grau ist die Entscheidung aus Runde 3 („schlafend verliert die
   Saettigung"), und hier kostet sie sichtbar: ein haengender grauer Stiel ist ein haengender grauer
   Stiel. Die Art bleibt die einzige Spur des Projekts.

Dazu ein Befund ueber die Daten, nicht ueber die Fassungen: **13 von 19 Sessions sind claude-fleet**,
also eine Art. Innerhalb davon tragen Rolle, Harness und Exemplar die ganze Unterscheidung — das ist
genau der Fall aus Runde 1, und hier ist er entschaerft (kein Paar unter 4,0), nicht geloest.

### 3.3 Ob der Zustand am laufenden Bild ablesbar ist

`mess/bewegung.js` unveraendert (schaltet ueber dieselben Knopf-IDs wie Runde 3), dann Anteil der Pixel
mit mehr als 12 Stufen Aenderung in 1,5 s, je Spalte ab der Spaltenoberkante (die animierte Lupe im
Kopf liegt ausserhalb):

| Zustand | A · Bluete | B · Zweig | C · Samenstand |
|---|---|---|---|
| arbeitet | **0,842 %** | 0,672 % | 0,637 % |
| ruht | **0,000 %** | **0,000 %** | **0,000 %** |
| schlaeft | **0,000 %** | **0,000 %** | **0,000 %** |
| gestoert | 0,118 % | 0,134 % | 0,220 % |

Ruhe und Schlaf sind exakt still und unterscheiden sich durch die Gestalt (aufrecht offen gegen
haengend geschlossen grau), nicht durch Bewegung — die Entscheidung aus Runde 3 §5.1 (3). Anders als
dort bewegt sich „gestoert" WENIGER als „arbeitet": der Fehler ist hier ein Knick plus Rot plus ein
kleines, schnelles Zittern, kein staerkerer Wind. Ob das als Fehler liest, ist eine Frage an den Owner
am laufenden Bild.

### 3.4 prefers-reduced-motion

`mess/reduced-motion.js` unveraendert, einmal normal, einmal mit `--force-prefers-reduced-motion`:

- normal: zwei Bildschirmfotos im Abstand von 2 s **nicht** gleich;
- reduziert: **byteweise gleich** (`cmp` still, beide 229 527 Bytes);
- und es ist ein **volles Standbild**: im Markenstreifen der drei Spalten (x 8–56 je Spalte) 3 255 /
  3 423 / 2 872 Pixel ueber Schwelle 24, gegen 3 264 / 3 440 / 2 888 im laufenden Bild. Jede Marke
  steht da, nur still.

## 4. Empfehlung

**B · Zweig.**

Erstens gewinnt B jede Spalte der Unterscheidbarkeit, im haertesten Fall (alle ruhend, ohne Farbe)
mit 6,11 gegen 4,09 und 4,22 — der Abstand kommt aus der Silhouette: Farn, Tanne, Gras, Weide, Baum,
Kaktus, Bambus und Busch unterscheiden sich im UMRISS, waehrend sieben der acht Blueten und die meisten
Samenstaende ein Stiel mit einem Kopf sind und nur der Kopf wechselt. Zweitens ist die Wuchsregel die
„gewisse Logik", die der Owner an B Automat gemocht hat: man sieht, dass eine Regel die Pflanze baut,
und der Wind laeuft sichtbar durch diese Regel. Es kostet 0,6 % eines Bildes.

**A · Bluete** ist die Fassung, die am unmittelbarsten „Blume" sagt und sich am deutlichsten bewegt
(0,84 %), aber sie ist ohne Farbe die knappste (4,09). **C · Samenstand** ist die mit der Chat-Ansicht
am engsten verwandte (die Flakes werden Samen), aber die Punkte sind auf 24 px die leiseste Gestalt und
claude-fleets Traube liest in der Lane als Streuung.

Die Wahl bleibt beim Owner am laufenden Bild; die Seite zeigt alle drei nebeneinander.

## Methode

```
# Seite serviert aus docs/design/sidebar/ (die Adresse in keiner getrackten Datei):
#   python3 -m http.server <port> --bind "$FLEET_HOST" --directory docs/design/sidebar
# Laufende Seite:  marken5.html            Artentafel: marken5.html?arten=1 (&z=120)
# Kontaktbogen:    marken5.html?tafel=1    (&zustand=rest); Ergebnis als JSON in <pre id=ergebnis>
#                  und window.__tafel, z. B. per Chrome --headless --dump-dom
# Kosten + fps:    S=<dir> bun docs/design/sidebar/mess/fps.js <url>/marken5.html
# Bewegung:        S=<dir> bun docs/design/sidebar/mess/bewegung.js <url>/marken5.html
#                  Auswertung: je Zustand |bild1 - bild2| > 12 in irgendeinem Kanal, Anteil je Spalte
#                  (je 300 CSS-px breit), ab der Zeile, in der die Spaltengrenze #1b1b1f 200 px lang
#                  durchlaeuft — darueber liegt der Kopf mit der animierten Lupe
# reduced-motion:  S=<dir> bun docs/design/sidebar/mess/reduced-motion.js <url>/marken5.html [reduce]
#                  dann cmp der beiden PNGs; Standbild = Pixel mit Maximalkanal > 24 im Streifen x 8..56
# Verbote:         grep -n "Math\.\(sin\|cos\|random\)" docs/design/sidebar/marken5.*  -> nur der Kommentar
```

# Private-repo-j Intake — 2026-08-25 (Arbeitstitel: „Private-repo-j")

## Provenienz und Vertrauen

Dieses Dokument ist das Ergebnis einer Owner-Ideation-Session am 2026-08-25 in der
Controller-Konversation. Es ist ein gebundenes Intake für den Product-Studio-Workflow, kein
promoviertes Programm: **kein Engine-Entscheid, kein Visual Territory, kein Vertical Slice ist
hiermit promoviert.** Der Owner bleibt die einzige Promotions- und Geschmacksautorität
(`docs/product-studio-working-circle.md`, `docs/product-studio-calibration-2026-08-22.md`).

Vertrauensstufen in diesem Dokument:
- **[Owner-Entscheid]** — in der Session ausdrücklich gewählt, für den ersten Schnitt verbindlich.
- **[Fakt, robust]** — geographisch/ökologisch belastbares Allgemeinwissen; darf gebaut werden.
- **[Fakt, zu prüfen]** — plausibel, aber vor Verwendung in Marketing/Lerntexten quellenprüfen.
- **[Vorschlag]** — Design- oder Technikhypothese des Controllers; der Workflow validiert.

## Pitch

Ein 2000er-AoE-artiges RTS, in dem vier Biber-Kolonien ein degradiertes, kanalisiertes Ödland
(topographisch: Deutschland) renaturieren, indem sie Wasser **verlangsamen** — Dämme, Teiche,
Feuchtgebiete. Produktives Land entsteht durch steigendes Grundwasser; das Feuchtgebiet speist
Ökonomie UND Armee. Schlachten werden nicht primär durch Einheiten-Micro entschieden, sondern
durch Private-repo-j-Thema: Wer das Wasser legt, legt das Schlachtfeld. Spieler lernen Wasserdynamik und
Renaturierung, weil die Mechanik selbst die Lektion ist — nicht durch Texttafeln.

Der Namens-Glücksfall: Der deutsche Fachbegriff für den Biberbau ist wörtlich **„Private-repo-j"** —
die AoE-Burgen-Fantasie ist zoologisch buchstäblich. [Fakt, robust]

## Owner-Geschmacksentscheidungen (2026-08-25)

1. **Karte: echte Höhendaten.** [Owner-Entscheid] Freies DEM (Kandidaten: SRTM 30 m, Copernicus
   EU-DEM, BKG DGM200 — Lizenz je Quelle prüfen [Fakt, zu prüfen]), runterskaliert; Flüsse
   entstehen emergent aus der echten Topographie. Asymmetrie ist Identität; Balance kommt aus
   Jahreszeiten und Startpositionen, nicht aus Kartensymmetrie.
2. **Kampfgewicht: Voll-RTS, hydro-zentriert.** [Owner-Entscheid] Schlachten sind Kern wie bei
   AoE, aber die Belagerungskunst ist Wasser (Schwall, Trockenlegen, Damm-Sabotage).
3. **Einheiten: Biber + Biotop-Tiere.** [Owner-Entscheid] Biber-Kerneinheiten plus Rekrutierung
   über das Biotop — das Feuchtgebiet lockt Arten an, die zu Einheiten werden. Renaturierung ist
   wörtlich die Armee.
4. **Ausführung: übernimmt der Workflow.** [Owner-Entscheid] Dieses Intake ist die Übergabe;
   Dekomposition, Worker-Wahl und Prototyp-Reihenfolge liegen beim Programm-MAIN.

## Die hydrologische Grundlage

Die ursprüngliche Prämisse „aus beiden Enden (Meer und Alpen) kommt Wasser" ist **falsch** und
wurde in der Session korrigiert — die Korrektur ist das Design-Fundament:

- Wasser fließt in Deutschland gerichtet Süd→Nord: Alpen und Mittelgebirge sind Quellen, das Meer
  ist der Abfluss. Rhein/Elbe/Weser/Ems → Nordsee, Oder → Ostsee. [Fakt, robust]
- Aus dem Norden kommt trotzdem Wasser, nur anderes: **Gezeiten und Sturmfluten der Nordsee
  (Salzwasser)**; die Ostsee ist nahezu gezeitenlos, hat winddrivene Sturmhochwasser und
  **friert in harten Wintern küstennah zu**. [Fakt, robust; Vereisungs-Häufigkeit zu prüfen]
- Durch Süddeutschland läuft die Europäische Hauptwasserscheide: die **Donau** fließt vom
  Schwarzwald weg Richtung Schwarzes Meer. Die **Donauversickerung** lässt Donauwasser real im
  Karst verschwinden und im Aachtopf (Rheinsystem) wieder auftauchen. [Fakt, robust; Details für
  Lerntexte zu prüfen]
- Biber **stoppen** Wasser nicht, sie **verlangsamen** es (Retention): Damm → Teich →
  Grundwasser steigt → Feuchtgebiet → Weichholz (Weiden, Espen) = Nahrung + Baumaterial.
  Feuchtgebiete puffern Flut UND Dürre („Schwammlandschaft"). [Fakt, robust]
- Biber sind streng territorial; Revierkämpfe sind real und können tödlich enden. Biber graben
  real Kanäle als Transportwege. [Fakt, robust] Der Tail-Slap ist real ein Warnsignal, im Spiel
  eine Schockwellen-Fähigkeit — bewusste Überzeichnung. [Vorschlag]

## Design-Säulen

1. **Wasser ist die einzige Primärressource.** Holz, Nahrung, Bevölkerung — alles leitet sich aus
   Wasserstand und Grundwassernähe ab.
2. **Verlangsamen statt stoppen.** Jede Stau-Entscheidung hat Downstream-Folgen für Mitspieler —
   die Upstream/Downstream-Kopplung ist die zentrale Multiplayer-Dynamik.
3. **Die Karte ist die Waffe.** Private-repo-j-Thema schlägt Einheiten-Micro; Truppen setzen um, was die
   Landschaft vorbereitet.

## Referenzrahmen [Vorschlag]

Drei Vergleichstitel, je mit dem, was zu übernehmen und was zu vermeiden ist — der Workflow
sollte sie vor dem ersten RTS-Schnitt tatsächlich ansehen, nicht aus Erinnerung zitieren:

- **Northgard** — der nächste Verwandte: asymmetrische Clans, Jahreszeiten als Match-Rhythmus,
  kleine lesbare Armeen, Gebietskontrolle. Übernehmen: Saison-Druck als Balance-Mechanismus,
  Schlachten mit wenigen Einheiten. Prüfen: wie es Spätspiel-Monotonie (nicht) vermeidet.
- **Timberborn** — Beweis, dass „Biber + Wasserphysik" ein Publikum trägt, und die beste
  Referenz für Stau-/Dürre-Mechanik. Abgrenzung: reiner Städtebau ohne Gegner — unser Spiel ist
  ein RTS, die Wassersim ist Mittel, nicht Zweck.
- **Age of Empires II** — der 2000er-Anker des Owners: Epochen-Aufstieg, Burgen, Belagerung,
  Konter-Lesbarkeit. Übernehmen: das Gefühl von Dorf→Burg-Progression (hier: Sukzession).
  Vermeiden: 200-Einheiten-Micro — unsere Schlachten entscheidet die Landschaft.

## Die vier Kolonien

| Kolonie | Lage | Identität | Saison-Peak |
|---|---|---|---|
| Friesland | Nordseeküste | Deichbauer; Tidenuhr, Sturmflut-Events; Salz als Feind und Waffe (Sturmflut ins Feindgebiet = Versalzung, verbrannte Erde) | Herbst |
| Bodden | Ostseeküste | Ruhige, fast gezeitenlose Lagunen; im Winter frieren Wasserwege zu — Eisbrücken sind Invasionsfenster in beide Richtungen | Winter |
| Alpenrand | Isar/Inn-Oberläufe | Wildbach-Biber; Schmelzwasserpuls, steilste Gradienten = stärkste Schwallangriffe | Frühjahr |
| Wasserscheide | Schwarzwald/Obere Donau | Einzige Kolonie, die Wasser in zwei Flusssysteme routen kann; Donauversickerung als unterirdischer Karst-Korridor | Sommer (Dürre-Resilienz) |

[Vorschlag — Faktions-Details sind Hypothesen; die Saison-Peak-Zuordnung ist die
Balance-These und muss simuliert/getastet werden.]

## Jahreszeiten als Match-Rhythmus [Vorschlag]

Schneeschmelze (Flutpuls aus Süd) → Sommerdürre (Retention zahlt aus) → Herbststürme (Sturmflut
im Norden) → Winter (Eis kippt Mobilität, Dammbau verlangsamt). Jede Kolonie hat ihre Saison;
das ist der Balance-Mechanismus für die asymmetrische Karte.

## Ökonomie und Sukzession [Vorschlag]

- Kette: Wasserstand → Vegetation (Weiden/Espen) → Holz + Nahrung → Population → Bautrupps.
- Epochen sind **Sukzessionsstufen** statt Tech-Ages: Ödland → Pionierbiotop → Weichholzaue →
  Auwald. Aufstieg über renaturierte Fläche + Private-repo-j-Ausbau.
- Menschen-Ruinen (Wehre, Schleusen, Pumpwerke, Drainagerohre) als eroberbare/abreißbare
  Superstrukturen — Kontrolle über einen alten Schleusenkomplex ist Map-Control.

## Kampf und Private-repo-j-Thema [Vorschlag]

- **Kern-Asymmetrie:** Biber sind im Wasser schnell und stark, an Land langsam und verwundbar.
  Wasserwege = Straßen + Kampfvorteil; selbst gegrabene Kanäle = Logistik + Angriffsvektoren.
- **Biber-Einheiten:** Kloppertrupp (alte Männchen, Nahkampf, Tail-Slap-Schockwelle), Sappeur
  (nagt feindliche Dämme an), Späher-Jungtier (schnell, schwach), Träger (Holzlogistik).
- **Biotop-Rekrutierung:** das eigene Feuchtgebiet lockt Arten an, die zu Einheiten werden —
  z. B. Reiher (Anti-Späher/Luftaufklärung), Wildschwein (gemieteter Dammbrecher), Fischotter
  (Wasser-Raider). Artenliste ist offen; Kriterium: jede Art muss eine echte Feuchtgebiets-Art
  sein und eine taktische Rolle füllen, die Biber nicht füllen.
- **Prädatoren als neutrale Gefahr:** Wolf, Seeadler, Fuchs machen trockenes Land gefährlich —
  ein weiterer Grund, Wasser zu legen.
- **Private-repo-j-Thema-Verben:** Schwallangriff (gestauten Teich ablassen → Flutwelle reißt stromab
  Dämme und Einheiten weg), Trockenlegen (oberhalb umleiten, Feindteich verlandet), Versalzen
  (nur Küste: Sturmflut einlassen), Karst-Routing (nur Wasserscheide).
- **Siegbedingungen:** militärisch (feindliche Haupt-Private-repo-j gebrochen = ihr Teich abgelassen)
  oder ökologisch (X % der Karte renaturiert, „Schwamm-Sieg").

## Lern-Schicht

Die Renaturierungs-Lektion steckt in der Mechanik: Retention schlägt Drainage, kanalisiertes Land
wird von Flut und Dürre gleichermaßen zerlegt, Feuchtgebiete puffern beides. UI benutzt echte
Begriffe (Pegel, Retention, Grundwasser, Aue, Sukzession). Keine Belehrungs-Popups; optional ein
„Feldführer"-Kompendium für Arten und Begriffe. Lerntexte erst nach Quellenprüfung der
[zu prüfen]-Fakten.

## Ton und Humor

Owner-Vorgabe wörtlich: ein „interessant witzig cooles Bieber RTS". Der Ton ist damit Teil des
Auftrags, nicht Beiwerk: **liebevoll-augenzwinkernd, nicht albern** — der Humor kommt aus
Verhalten und Sprache, nie auf Kosten der ernsten Wasser-Mechanik. Konkrete Kandidaten
[Vorschlag, Visual/Audio-Territory bleibt Owner-Taste]:

- Einheiten-Barks und Bau-Animationen mit Biber-Charakter (empörtes Tail-Slap, Nage-Besessenheit).
- Deutsche Toponymie als Namensquelle: echte Orte wie Biberach tragen den Biber schon im Namen;
  Karten-Orte dürfen so klingen (Nagelsheim, Dammstadt, Kluppenbrück).
- Die verschwundenen Menschen nur als rostende Infrastruktur und absurde Hinterlassenschaften —
  stiller Humor statt erklärter Apokalypse.

## Technik-Vorschlag [Vorschlag — nicht promoviert]

- **Web-first, TypeScript** — passt zur bestehenden Studio-Pipeline (alle bisherigen Spiele sind
  Browser-Artefakte). Renderer: Three.js, orthografische Top-Down-Kamera, Heightmap-Terrain,
  Instancing für Einheiten. Das Rendering ist NICHT das Risiko.
- **Das Risiko ist die Wassersim + die Spaßfrage.** Grid-basierte Flow-Sim (Pipe-Modell o. ä.)
  auf der CPU, Zielgröße 256²–512² Zellen, GPU nur für Darstellung. Machbarkeit ist zu MESSEN,
  nicht zu behaupten.
- **iOS später** via Capacitor-Wrapper (gelöster Pfad; Studio-Kalibrierung: lokal kein volles
  Xcode — externe Grenze bleibt Owner-Sache). Godot wäre die native Alternative, bricht aber die
  TS-Pipeline; in der Session verworfen, Rückholung möglich falls Web-Perf auf iOS scheitert.
- **Das iOS-Fernziel wirkt schon HEUTE auf die Steuerung:** von Anfang an touch-tauglich denken —
  kein Hover-Zwang, keine Hotkey-only-Funktionen, große Trefferflächen, Radial-/Kontextmenüs,
  Pause + Spielgeschwindigkeit als Bürger erster Klasse. Ein nachträglich „portiertes"
  RTS-Interface ist der bekannte Todesweg des Genres auf Mobile; billiger ist, es nie zu bauen.
  Zielformat erster Schnitt: Single-Player-Skirmish, 20–40 Minuten pro Partie. [Vorschlag]

## Vorgeschlagener erster Schnitt: das „Wasserspielzeug"

Ein einziger gebundener Build-Auftrag, bevor irgendetwas anderes entsteht:

> Heightmap Deutschlands (echtes DEM, runterskaliert) + Regen + Flow-Sim + Dämme setzen per
> Klick. Teiche entstehen, Grundwasser-Overlay färbt Land produktiv, Downstream-Pegel sinkt
> sichtbar.

Prüfbare Prädikate (jedes muss brechbar sein):
1. **Sim-Budget:** Flow-Tick für die Zielgröße ≤ N ms auf dieser Maschine (N vom Workflow zu
   setzen und zu messen, nicht zu schätzen); Frame-Budget getrennt ausweisen.
2. **Emergenz:** Aus dem DEM entstehen ohne handgemalte Flüsse erkennbar Rhein-, Elbe- und
   Donau-artige Abflusspfade (Screenshot-Beweis gegen eine Referenzkarte).
3. **Kausalität:** Ein gesetzter Damm erzeugt messbar (a) Teichbildung oberhalb, (b)
   Pegelsenkung unterhalb, (c) Grundwasseranstieg im Umkreis — als Zahlenreihe, nicht als Optik.
4. **Falsifikator Spaß (Owner-Taste-Gate):** Der Owner spielt 10 Minuten damit. Wenn das Stauen
   ohne jedes Spielziel nicht trägt, wird die Kernprämisse überarbeitet, bevor RTS-Schichten
   gebaut werden.

## Offene Fragen und Risiken

- **DEM-Lizenz und Beschaffung** (SRTM/EU-DEM/DGM200): welche Quelle, welche Auflösung, welche
  Attributionspflicht. [zu prüfen]
- **Sim-Auflösung vs. RTS-Lesbarkeit:** 512² Zellen für ganz Deutschland heißt Zellkante ~1,5 km
  — auf dieser Skala sind „Dämme" Abstraktion. Alternative: Karte ist ein topographisch treues,
  aber verdichtetes Deutschland (Skalen-Lüge wie bei jeder AoE-Karte). Entscheid beim Workflow,
  Taste beim Owner.
- **Balance-Risiko der Asymmetrie:** Downstream-Positionen könnten strukturell unterlegen sein;
  die Saison-Peak-These ist ungetestet.
- **Multiplayer-Scope:** 4 Spieler + Sim-Determinismus (Lockstep?) ist ein eigenes Forschungsfeld;
  erster Schnitt ist ausdrücklich Single-Player/Sandbox.
- **Kampf-Lesbarkeit:** Private-repo-j-Thema-Folgen (Flutwelle) brauchen Sekunden bis Minuten — ob das
  als „interessante Schlacht" liest oder als Warten, muss ein Prototyp zeigen.

## Stop-Linie

Dieses Intake promoviert nichts. Der Workflow dekomponiert, misst und baut den ersten Schnitt;
Owner-Gates sind mindestens: Engine-/Territory-Promotion, das Spaß-Gate am Wasserspielzeug,
jede externe Wirkung (Datenquellen-Downloads mit Lizenzfragen, App-Store-Pfad). Bei Widerspruch
zwischen diesem Dokument und Code/Messung gilt die Messung.

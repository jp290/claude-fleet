# Neues-Spiel-Intake — 2026-08-27 (Arbeitstitel: „Augenwerk“)

## Provenienz, Bindung und Vertrauen

Dieses Dokument bindet den Vorschlag für die Gründung einer neuen Fable-MAIN. Es beruht auf dem
Owner-Brief dieser Session sowie `docs/product-studio-working-circle.md` und
`docs/product-studio-calibration-2026-08-22.md`. Es promoviert weder Architektur, Renderer,
Creative Territory noch Produktionsumfang. Die Fable-MAIN arbeitet die Architektur aus, setzt
einen reversiblen Creative Anchor, brieft ihre Worker und führt den Vor-Owner-Loop aus. [belegt]

Vertrauensstufen in diesem Dokument:

- **[gemessen]** — auf dieser Maschine ausgeführte Messung mit Build-Stamp, Bedingungen,
  Rohwerten und benanntem Messweg. Dieses Intake enthält noch keinen so markierten Produktwert,
  weil noch kein Build existiert.
- **[belegt]** — steht im Owner-Brief oder in einer der beiden genannten Studio-Quellen.
- **[These, zu prüfen]** — Design-, Technik-, Markt- oder Produktionsannahme. Sie wird erst durch
  den benannten Test belastbar.

Schwellenwerte unten sind bis zur Ausführung `[These, zu prüfen]`. Ein späterer Bericht darf sie
nur dann `[gemessen]` nennen, wenn er Messbedingungen und Rohwerte enthält.

## Auswahlentscheidung

Ich wähle **Augenwerk**, weil sein Blickgraph mit wenigen Regeln Kettenreaktionen erzeugen kann
und diese Reaktionen im ersten Raum sichtbar sind. **Tiefenchor** hat ebenfalls ein tragendes
System, doch sein erster Schnitt liest sich trotz akustischer Ökologie als Navigation und liegt
damit zu nah an Private-repo-q. **Konzept-A** hat eine klare Fantasy, braucht für anhaltende Tiefe aber
wahrscheinlich viele handgebaute Zeiträtsel. Augenwerk grenzt sich mit Blick, Verdeckung und
gegenseitiger Beobachtung als Kernhandlungen von RTS, Handel, Fahrstraßen, Duell-Taktik, Racing,
Shooting, Survival und Sammeln ab. [These, zu prüfen]

## Pitch

Du bist Nachtkurator eines lebenden Museums, in dem Skulpturen nur unter den Blicken anderer
Exponate gehorchen — Spiegel, Licht und Vorhänge sind deine Werkzeuge.

## Intent

**Augenwerk** ist ein räumliches Systemspiel über Beobachtung. Vor der Öffnung muss der Spieler
einen unmöglichen Ausstellungssaal in ein stabiles Tableau bringen. Er dreht Standspiegel, öffnet
Vorhänge und schaltet Saallicht; dadurch verändert er, welches Exponat welches andere direkt oder
über eine Reflexion sieht. Die Exponate reagieren nur auf lokale Blick-, Licht- und
Verdeckungsregeln. Aus neu entstehenden und abbrechenden Blickbeziehungen sollen Bewegungsfolgen
entstehen, die weder als Zeitleiste noch als Lösungssequenz im Raum hinterlegt sind. [These, zu
prüfen]

Die Maschine kann den ersten Beweis als lokalen Browser-Build tragen: Web-first TypeScript/Bun ist
der gesetzte Vorschlags-Default, Browser-Capture und die tatsächliche Bildübergabe an eine Fable
sind im Studio-Profil belegt. Der erste Schnitt braucht keine externen Daten, keine lizenzierten
Assets und keine Content-Pipeline. Seine Produktionsfrage ist ein kleiner Simulationsgraph plus
eine komponierte Galerieansicht. Ob Canvas2D, WebGL oder eine vorhandene Bibliothek diese Ansicht
am günstigsten trägt, entscheidet die MAIN nach einem kleinen Vergleich. [belegt für Host und
Workflow; These, zu prüfen für Aufwand und Renderer]

## Erste-Minute-Fantasy und Spielversprechen

Der Spieler sieht einen stillen Saal, dreht einen Spiegel und fängt den Blick einer steinernen
Wächterfigur ein. Der Wächter wendet den Kopf; dadurch verliert ein zweites Exponat seinen
Beobachter, steigt vom Sockel und kreuzt den Lichtkegel einer dritten Figur. Der Spieler hat mit
einer Handbewegung eine Kette ausgelöst und versucht nun, sie zu verstehen, zu unterbrechen oder
für das verlangte Nachtbild zu nutzen. [These, zu prüfen]

Das Versprechen lautet: **Jede sichtbare Reaktion hat eine räumlich lesbare Ursache, aber ihre
Folgekette gehört dem System.** Der Spieler löst keinen Textcode und füllt keine Anzeigen; er liest
Köpfe, Körper, Licht, Schatten, Reflexion und Bewegung im Raum. [These, zu prüfen]

## Das tragende System: der Blickgraph

Die Simulation berechnet in festen Ticks einen gerichteten Graphen. Ein Knoten ist ein Exponat;
eine Kante `A → B` existiert nur, wenn A auf B ausgerichtet ist, Licht und Reichweite genügen und
keine Geometrie die Sicht verdeckt. Ein Standspiegel kann eine indirekte Kante erzeugen, ein
Vorhang kann Kanten entfernen, und ein Lichtwechsel kann mehrere Kanten zugleich aktivieren oder
deaktivieren. [These, zu prüfen]

Der erste Schnitt enthält drei Exponate mit je einer lokalen Regel:

1. Der **Läufer** bewegt sich zum nächsten beleuchteten freien Sockel, solange keine eingehende
   Blickkante besteht.
2. Der **Wächter** dreht sich zur letzten Bewegung, die innerhalb seines Sichtfelds stattfand.
3. Die **Scheue** dreht sich von einer direkten eingehenden Blickkante weg; ihre neue Ausrichtung
   kann selbst eine Kante setzen oder brechen.

Keine Regel nennt einen konkreten Spiegel, eine feste Reihenfolge oder einen Zeitpunkt. Der Raum
enthält keine unsichtbaren Triggerzonen für die Lösung. Das Ziel ist erreicht, wenn alle drei
Exponate fünf zusammenhängende Sekunden auf ihren markierten Sockeln bleiben. [These, zu prüfen]

Die AA-Tiefe soll aus zyklischen Beobachtungen, Abschattung, indirekten Spiegelkanten und den
lokalen Reaktionen entstehen. Neue Räume dürften später andere Geometrien und Regelkombinationen
verwenden; sie dürften die Tiefe nicht durch Dialogmenge, Gegnerwellen oder hundert Einzelobjekte
ersetzen. [These, zu prüfen]

## Qualitätsbalken für den ersten Schnitt

| BAR | FAILS WHEN | INSTRUMENT |
|---|---|---|
| Blickänderung ist als Handlung in der Welt lesbar. | Eine anonyme Hands-on-Kritik ordnet in weniger als zwei von drei Clips das bewegte Werkzeug dem reagierenden Exponat korrekt zu. | Drei 5–8-Sekunden-Clips ohne Debug-UI; Antwort enthält Werkzeug, Exponat und beobachtete Folge. |
| Grafik zeigt echten Spielzustand. | Ein sichtbarer Exponat-, Licht-, Schatten- oder Reflexionszustand hat keinen entsprechenden Simulationszustand, oder ein Simulationswechsel bleibt länger als zwei gerenderte Frames unsichtbar. | Zustandslog mit Frame-IDs plus drei benannte Captures aus demselben Build. |
| Das Nachtbild ist eine Spielaufgabe, kein Debugger. | Der Player-Build zeigt Blickkanten, Knotennamen, Zustandszahlen oder ein Telemetriepanel dauerhaft im Saal. | Capture der ersten 30 Sekunden und DOM-/Canvas-Prüfung des Player-Builds. |
| Eine Eingabe kann eine Folge auslösen. | Der kontrollierte Eingriff ändert nur den direkt manipulierten Spiegel, aber keinen nachgelagerten Exponatzustand. | A/B-Lauf mit gleichem Seed und Ereignislog. |

Debug-Logs und Beweis-Captures sind erlaubt, aber nicht als Player-UI. Die Galerie rendert
Kausalität durch Kopfwendung, Pose, Staub, Licht, Schatten und Spiegelglanz. Jeder dieser Effekte
muss an einen echten Zustandswechsel gebunden sein. [These, zu prüfen]

## Erster Schnitt — etwa zwei Tage

Der Schnitt ist **ein Saal, ein Nachtbild, ein vollständiger Versuch**. Er enthält drei autonome
Exponate, zwei drehbare Standspiegel, einen Vorhang, zwei schaltbare Lampen, die fünfsekündige
Stabilitätsbedingung, Erfolg, Scheitern nach 120 Sekunden und sofortigen Neustart. Alle
Spielhandlungen funktionieren über Zeigerereignisse: Spiegel ziehen, Vorhang antippen, Lampen
antippen, Neustart antippen. Tastaturkürzel dürfen zusätzlich existieren, aber keine Handlung darf
sie voraussetzen. [These, zu prüfen]

Der Spieler sieht vom ersten Frame an eine komponierte, schräg von oben gezeigte Galerie mit drei
unterscheidbaren Silhouetten, tatsächlichen Lichtflächen, Schatten, Spiegelbildern und animierten
Zustandswechseln. Die Darstellung darf aus code-eigenen Formen und prozeduralen Texturen bestehen;
graue Kollisionskästen, permanenter Raster-Overlay oder beschriftete Zustandsknoten erfüllen den
Schnitt nicht. Es werden keine externen Assets heruntergeladen. [belegt für die Grafik- und
Lizenzgrenze; These, zu prüfen für die konkrete Darstellung]

Der Spieler tut in den ersten 30 Sekunden genau Folgendes: Er dreht mindestens einen Spiegel,
beobachtet mindestens eine Reaktion und kann die Ausgangslage mit einem sichtbaren Neustart
wiederherstellen. Danach kann er mit den vier Werkzeugarten das Nachtbild erreichen oder die
120-Sekunden-Grenze auslösen. [These, zu prüfen]

## Prüfbare Prädikate des ersten Schnitts

Jedes Prädikat endet in `JA` oder `NEIN`; Zahlen definieren die Grenze. P0–P7 brauchen im
Beweisbericht je einen demonstrierten Breaker. Der Bericht muss
`predicates_without_breaker: 0` ausgeben; jeder andere Wert ist `NEIN`. [belegt als
Studio-Proof-Regel]

| ID | PASS-Prädikat | Beweis und demonstrierter Breaker |
|---|---|---|
| P0 — echter Spielpfad | **JA**, wenn eine frische Agent-Lane den gebundenen Build mit einem dokumentierten Startbefehl öffnet, nur über den ausgelieferten Zeigerpfad mindestens einen Spiegel dreht, mindestens eine Exponatreaktion auslöst und Neustart benutzt; sonst **NEIN**. | Build-Stamp, Startbefehl, 20–40-Sekunden-Capture und Eingabelog. Breaker: Zeiger-Handler deaktivieren; der Lauf muss vor der ersten Weltänderung scheitern. |
| P1 — Performance-Budget | **JA**, wenn ein zehnminütiger Lauf auf dieser Maschine bei 1280×720 CSS-Pixeln und `devicePixelRatio = 1` nach 30 Sekunden Warm-up `[gemessen]` `p95 frame interval ≤ 18 ms`, `p99 sim tick ≤ 4 ms` und `0` Pausen `> 100 ms` ausweist; sonst **NEIN**. Schätzung oder Einzel-Screenshot ist **NEIN**. | Build-Stamp, Browser/Hardware-Kennung, Anzahl Samples, p50/p95/p99 und Rohdatenpfad. Breaker: pro Sim-Tick eine kalibrierte Zusatzlast einschalten, bis `p99 sim tick > 4 ms`; P1 muss rot werden. |
| P2 — Emergenz/Systembeweis | **JA**, wenn der feste Startzustand ohne Eingabe nach `t = 0` in 20 Sekunden mindestens vier Exponat-Zustandswechsel über alle drei Exponate erzeugt und eine einzige anfängliche Spiegelabweichung von `15°` mindestens zwei nachgelagerte Ereignisse im Trace ändert. Im Szenario dürfen `0` zeit- oder objektnamegebundene Lösungstrigger stehen; sonst **NEIN**. | Zwei Traces mit gleichem Seed, Regel-IDs und Graphkanten; strukturelle Suche nach Timeline-/Objektname-Triggern. Breaker: Sichtkanten auf die Baseline einfrieren; die Trace-Divergenz muss unter zwei Ereignisse fallen und P2 rot werden. |
| P3 — Kausalität | **JA**, wenn A und B mit identischem Seed starten, nur B bei `t = 2 s` einen Spiegel um `30°` dreht, sich binnen eines Sim-Ticks mindestens eine Blickkante unterscheidet und binnen fünf Sekunden mindestens ein nicht direkt manipuliertes Exponat eine andere Position von `≥ 64` Bildpixeln oder einen anderen diskreten Pose-Code erreicht. Drei Wiederholungen pro Variante müssen je denselben Trace-Hash liefern; sonst **NEIN**. | A/B-Video, Kanten- und Zustandslog, sechs Trace-Hashes. Breaker: Spiegelrotation aus dem Graph-Update entfernen; Kanten- und Folgezustand dürfen sich nicht ändern und P3 muss rot werden. |
| P4 — Renderwahrheit | **JA**, wenn für alle drei Exponate jeder diskrete Simulationszustand in den Prüftraces binnen höchstens zwei Frames eine sichtbare Poseänderung hat, `0` sichtbare Reaktionen ohne Zustandsereignis auftreten und zwei Spiegelbilder aus der tatsächlichen Szenengeometrie stammen; sonst **NEIN**. | Frame-IDs mit Sim-Events, drei benannte Captures, Renderer-Inspektion. Breaker: Pose-Aktualisierung des Wächters unterdrücken; mindestens ein Zustandswechsel muss länger als zwei Frames unsichtbar bleiben und P4 rot werden. |
| P5 — Kausalitätslesbarkeit | **JA**, wenn eine frische, read-only Agent-Lane nach höchstens fünf Minuten am echten Inputpfad in mindestens zwei von drei anonymisierten Clips Werkzeug, betroffenes Exponat und Bewegungsrichtung korrekt nennt und ihren ersten Versuch entweder mit Erfolg oder dem 120-Sekunden-Endzustand beendet; sonst **NEIN**. | `agent-hands-on`-Verdikt, Build-Stamp, Antworten vor Einsicht in Logs, Capture. Breaker: dieselben Clips mit verdecktem Werkzeugmoment; die Zuordnung muss unter zwei von drei fallen, sonst misst der Test keine sichtbare Kausalität. |
| P6 — Ende und Neustart | **JA**, wenn fünf zusammenhängende stabile Sekunden genau einmal Erfolg auslösen, `119,9 s` ohne Stabilität noch keinen Zeitablauf auslösen, `120,0 s` Zeitablauf auslösen und Neustart in beiden Endzuständen Seed, Exponate, Werkzeuge und Uhr auf den dokumentierten Startzustand setzt; sonst **NEIN**. | Deterministischer Zustandslauf plus Hands-on-Capture. Breaker: Stabilitätszähler beim Verlassen eines Sockels nicht zurücksetzen; der Grenztest muss rot werden. |
| P7 — Touch-Vorbereitung | **JA**, wenn Spiegelrotation, Vorhang, beide Lampen und Neustart in einem 1024×768-Touch-Viewport per `pointer`-Ereignis bedienbar sind, `0` Pflichtaktionen Hover oder Tastatur verlangen und jede der fünf Bedienflächen mindestens `44×44` CSS-Pixel misst; sonst **NEIN**. | Automatisierter Pointer-Lauf und Bounds-Liste. Breaker: die Bedienfläche einer Lampe auf `32×32` setzen; P7 muss rot werden. |
| P8 — Owner-Spaß-Gate | **JA**, wenn der Owner den ausgelieferten Build zehn Minuten spielt und danach ausdrücklich `weiter` auf die Frage „Willst du einen zweiten Saal mit denselben Regeln spielen?“ antwortet; `ändern`, `stoppen`, kein Urteil oder weniger als zehn Minuten sind **NEIN**. | Owner-Wortlaut, zehnminütige Spielzeit, Build-Stamp. Dieses Prädikat hat keinen automatischen Ersatz und keinen Modell-Judge. |

P1 ist das Performance-Budget. Es gilt nur als erfüllt, wenn die angegebenen Werte tatsächlich auf
dieser Maschine gemessen wurden. P2 beweist die nicht direkt gescriptete Systemreaktion, P3 den
Spieler-Eingriff und seine Folge, P8 bleibt das Owner-Taste-Gate. [belegt für die geforderten
Beweisarten; These, zu prüfen für die Schwellenwerte]

## Kill-Kriterien und genau ein Rettungsversuch

Der Kernloop gilt nach dem ersten Schnitt als tot, wenn P2 oder P3 nach ausgeschöpfter gewöhnlicher
MAIN-Reparatur weiterhin `NEIN` ist: Dann existiert entweder kein Systemverhalten oder kein
wirksamer Spielereingriff. Er gilt auch als tot, wenn P2 und P3 `JA` sind, aber P8 `NEIN` bleibt.
Wenn P5 `NEIN` ist und der Owner die Bewegungen als nicht zurechenbar beschreibt, ist noch nicht
entschieden, ob der Blickgraph oder nur seine Darstellung versagt. [These, zu prüfen]

Für genau diesen letzten Fall ist **ein** Rettungsversuch erlaubt: eine blind präsentierte A/B-
Runde mit identischem Raum, Seed, Ziel und Blickregeln. B darf nur Antizipation und Folgen sichtbar
machen — Kopfvorlauf, Materialspannung, Staubstoß, Lichtreaktion, Spiegelglanz und Eingabe-Timing —
und darf `0` neue Exponate, Werkzeuge, Regeln oder Ziele hinzufügen. Ein frischer Critic erhält die
anonymisierten Builds in zufälliger Reihenfolge; danach spielt der Owner beide je zehn Minuten.
Nur eine ausdrückliche Präferenz für B **und** ein `weiter` rettet den Kernloop. Präferenz für A,
`indifferent`, `ändern`, `stoppen` oder kein Urteil beendet Augenwerk; ein zweiter Rettungsversuch
ist nicht erlaubt. [These, zu prüfen]

Ein rotes Performance-Prädikat tötet zunächst den gewählten Renderer oder die Implementierung,
nicht automatisch den Blickgraphen. Die MAIN darf innerhalb ihres Fortschrittsbudgets Darstellung
oder Updatepfad vereinfachen, solange Raum, Regeln und Taste-Gate unverändert bleiben. [belegt als
Studio-Reparaturgrenze]

## Non-Goals des ersten Schnitts

1. Keine zweite Galerie und kein Level-Editor.
2. Keine Kampagne, Dialoge, Lore-Sequenzen oder vertonte Figuren.
3. Keine Inventar-, Upgrade-, Metaökonomie- oder Sammelsysteme.
4. Keine Gegner-KI, Kämpfe, Lebenspunkte oder Stealth-Wachen.
5. Kein Online-Multiplayer, Account, Backend, Telemetrieversand oder Cloud-Speicher.
6. Keine prozedurale Level-Erzeugung und kein Anspruch auf eine allgemeine Puzzle-Engine.
7. Keine extern heruntergeladenen Fonts, Modelle, Texturen, Musikstücke oder Datensätze.
8. Kein Mobile-Build, App-Store-Pfad oder Touch-Polish; nur die in P7 definierte Eingabegrenze.
9. Kein Diagnose-Overlay in der Player-Ansicht.
10. Keine Markt-, Preis- oder Release-Entscheidung.

## Technik-Vorschlag — nicht promoviert

- Web-first TypeScript/Bun, lokaler Browser-Build und ein dokumentierter Startbefehl. [belegt als
  Maschinen-Default]
- Fester Simulations-Tick, reine Zustandsdaten für Exponate und ein separat gerenderter
  Blickgraph. Dieselben Seeds und Eingaben sollen dieselben Trace-Hashes erzeugen. [These, zu
  prüfen]
- Renderer-Auswahl erst nach einer Szene mit zwei Spiegeln, drei Silhouetten und bewegtem Licht.
  Der Vergleich misst P1 und prüft P4; Bekanntheit einer Bibliothek ist kein Kriterium. [These, zu
  prüfen]
- Pointer-Ereignisse als Eingabegrenze; keine Hover-Pflicht. [belegt als Owner-Vorgabe]
- Alle visuellen Mittel des ersten Schnitts entstehen im Repository aus Code, einfachen lokalen
  Vektorformen oder prozeduralen Texturen. Jede spätere externe Quelle braucht vor Download eine
  Lizenzprüfung am Owner-Gate. [belegt]

## Offene Fragen und Risiken

- **Ist der Blickgraph ohne Linien und Zustandslabels lesbar?** P5 und der erlaubte A/B-Versuch
  entscheiden das. Das ist das größte Risiko: Unlesbare Kausalität sieht wie zufällige
  Figurenbewegung aus. [These, zu prüfen]
- **Erzeugt die Dreierregel neue Situationen oder nur eine einzige optimale Zugfolge?** P2 beweist
  zunächst Trace-Divergenz, aber erst weitere Seeds könnten strategische Breite zeigen. Für den
  ersten Schnitt werden keine weiteren Räume gebaut. [These, zu prüfen]
- **Ist direkte Spiegelrotation die richtige Hauptgeste?** Der erste Hands-on-Lauf misst Bedienung
  und Ursache; Verschieben, freies Laufen oder Inventar bleiben außerhalb des Schnitts. [These, zu
  prüfen]
- **Welche Darstellung trägt Spiegel, Licht und Silhouetten innerhalb P1?** Canvas2D, WebGL und
  vorhandene Bibliotheken sind Kandidaten; keine davon ist gewählt. [These, zu prüfen]
- **Braucht die Kausalität Ton?** Der erste Schnitt darf kurze lokal erzeugte Reaktionsklänge
  enthalten, aber P5 muss auch mit stummgeschaltetem Ton ausgeführt werden. [These, zu prüfen]
- **Ist „Augenwerk“ als Produkttitel verfügbar?** Namens-, Marken- und Store-Prüfung wurden nicht
  durchgeführt; bis dahin ist es nur der Arbeitstitel. [These, zu prüfen]
- **Welche Spiele oder Kunstwerke sind brauchbare positive und negative Referenzen?** Es wurde
  keine externe Referenzrecherche und keine Lizenzprüfung durchgeführt. Die MAIN darf vor ihrem
  Creative Anchor recherchieren, muss Quelle, tatsächliche Sichtung, Lizenzgrenze und Consumer
  festhalten. [These, zu prüfen]
- **Kann der volle Horizont ohne Content-Masse tragen?** Der erste Schnitt beweist nur einen Raum
  und einen Graphen. Ein zweiter Raum ist erst nach P8 erlaubt und muss dieselben Regeln in einer
  anderen Geometrie verwenden. [These, zu prüfen]

## Hinweis an die Fable-MAIN

Dieses Intake ist ein **Vorschlag mit Begründungen**, keine vorweggenommene Architektur. Die MAIN
darf jeder These mit Messung, Quellbeleg oder Hands-on-Befund widersprechen. Jede Abweichung bei
Fantasy, Hauptgeste, Blickregeln, erstem Schnitt, Schwellenwert oder Stop-Linie muss sie mit Anlass,
Beleg, Wirkung und Reopen-Trigger in ihrem Entscheid-Log festhalten. Eine materielle Änderung der
Produktidentität, das Owner-Spaß-Gate, neue Kosten oder Secrets, externe Downloads mit ungeklärter
Lizenz und jede Veröffentlichung bleiben Owner-Gates. [belegt]

Vor dem Owner-Tasting gelten die Studio-Schritte: reversibler Creative Anchor, tiny playable,
frische `agent-hands-on`-Kritik auf dem echten Inputpfad, begrenzte Reparatur mit benanntem
Fortschritt und ein dauerhafter Ein-Schritt-Start. `automaton-demo` ist kein Ersatz für P5 oder P8.
[belegt]

## Anhang: drei Kurzkonzepte

### A. Augenwerk — gewählt

**Arbeitstitel:** Augenwerk  
**Fantasy in einem Satz:** Du bist Nachtkurator eines lebenden Museums, in dem Skulpturen nur
unter den Blicken anderer Exponate gehorchen — Spiegel, Licht und Vorhänge sind deine Werkzeuge.

**Kernloop in drei Sätzen:** Der Spieler liest die Blickrichtungen der Exponate und verändert sie
durch Spiegelrotation, Licht und Verdeckung. Jede Änderung setzt oder bricht Kanten in einem
gerichteten Beobachtungsgraphen; lokale Exponatregeln können daraus eine Bewegungskette machen.
Der Spieler nutzt diese Ketten, bis das verlangte Tableau fünf Sekunden stabil bleibt.

**Warum AA-anspruchsvoll:** Der Blickgraph koppelt Geometrie, Beleuchtung, Spiegelung und
autonomes Verhalten. Tiefe soll aus Zyklen und Kaskaden kommen, nicht aus einer Liste gescripteter
Rätsel. [These, zu prüfen]

**Größtes Risiko:** Ohne Debug-Linien kann die Ursache einer Bewegung unsichtbar bleiben; dann
wirkt das System zufällig. [These, zu prüfen]

**Erster Zwei-Tage-Schnitt:** Ein komponierter Saal mit drei Exponaten, zwei Spiegeln, einem
Vorhang, zwei Lampen, Erfolg, Zeitablauf und Neustart zeigt einen messbaren Eingriff sowie eine
nicht als Timeline hinterlegte Reaktionskette.

### B. Tiefenchor — verworfen

**Arbeitstitel:** Tiefenchor  
**Fantasy in einem Satz:** Du dirigierst ein blindes Forschungsschiff in einem lebenden
unterirdischen Ozean; jeder gesungene Puls malt die Dunkelheit und verändert, was ihn hört.

**Kernloop in drei Sätzen:** Der Spieler sendet einen von drei Pulstypen und sieht seine
Ausbreitung, Reflexion und Abschattung. Tiere reagieren auf lokale Frequenz und Lautstärke,
wodurch Locken, Fliehen und Jagd Ketten bilden. Der Spieler setzt wenige Pulse ein, um eine Probe
zu bergen und die Kammer wieder zu verlassen.

**Warum AA-anspruchsvoll:** Wellenfeld, Geometrie und autonome Hörreaktionen könnten eine
akustische Ökologie erzeugen, die Information und Gefahr aus derselben Handlung ableitet. [These,
zu prüfen]

**Größtes Risiko:** Die Frequenzen können wie drei farbige Schlüssel wirken; ohne hör- und
sichtbare Wechselwirkung bleibt nur ein dunkles Navigationsspiel. [These, zu prüfen]

**Erster Zwei-Tage-Schnitt:** Eine Kammer, drei Pulstypen und drei Kreaturen zeigen sichtbare
Wellenfronten, einen ausgelösten Fress-/Fluchtzyklus und die Bergung einer Probe.

**Warum nicht gewählt:** Die Systemidee trägt, aber die erste Handlung ist Wegefinden mit
Pulsen. Damit ist die Abgrenzung zu Private-repo-qs Linien-Navigation schwächer als bei Augenwerks
Blickmanipulation.

### C. Konzept-A — verworfen

**Arbeitstitel:** Konzept-A  
**Fantasy in einem Satz:** Du reparierst eine unmögliche Nachtfabrik, indem jede vergangene
20-Sekunden-Schicht als körperlicher Arbeiter zurückkehrt und deinen alten Ablauf wiederholt.

**Kernloop in drei Sätzen:** Der Spieler führt 20 Sekunden lang Handlungen aus und schreibt damit
eine Schicht auf. Nach dem Rücksprung wiederholen frühere Schichten ihre Eingaben, während der
Spieler eine neue Spur ergänzt. Förderbänder, Türen, Lasten und Kollisionen koppeln die Spuren, bis
die Maschine einen vollständigen Takt schafft.

**Warum AA-anspruchsvoll:** Aufgezeichnete Eingaben plus veränderliche Physik können aus wenigen
Regeln Synchronisation, Störung und improvisierte Arbeitsteilung erzeugen. [These, zu prüfen]

**Größtes Risiko:** Jede neue Aufgabe könnte eine handgebaute Timing-Lösung brauchen; dann kommt
die Tiefe aus Level-Content statt aus dem System. [These, zu prüfen]

**Erster Zwei-Tage-Schnitt:** Ein Raum mit Förderband, Druckplatte, Ofen und drei aufgezeichneten
Schichten zeigt, ob eine kleine Abweichung zwei frühere Abläufe messbar verändert.

**Warum nicht gewählt:** Der erste Schnitt ist klar, aber der volle Horizont hat das höchste
Risiko, in eine Folge einzeln gescripteter Zeiträtsel zu kippen.

# Private-Repo-C-Intake — 2026-08-27 (Arbeitstitel: „Private-repo-o“)

## Provenienz, Bindung und Vertrauen

Der Owner hat die freie Konzeptwahl aus dem vorherigen Intake aufgehoben und den Kern wörtlich
festgelegt: „ich denke wir sollten einen neuen privateRepoO Private-repo-c bauen lassen“. Dieses
Dokument bindet den daraus entwickelten Vorschlag für die Gründung einer neuen Fable-MAIN. Das
vorherige `docs/intake-neues-spiel-2026-08-27.md` bleibt Archiv und ist keine konkurrierende
Produktanweisung. [belegt]

Der spätere Owner-Wortlaut „ich hätte lieber ein nices browwser based mario kart^^“ setzt den
Browser als Ziel und korrigiert die Tonlage: sofort verständlicher, farbiger Arcade-Kartspaß vor
einer erklärungsbedürftigen Weltprämisse. „Mario Kart“ wird hier ausschließlich als
Geschmacks-Kurzform für zugängliches Fahren, Drift-Boost, Item-Boxen, Positionskampf und lebendige
Kurse gelesen. Der Controller-Nachstups im Auftrag des Owners hebt die frühere Strenge gegen das
klassische Genre-Kit ausdrücklich auf. Geschützt bleibt allein das Material: Das Spiel übernimmt
keine Nintendo-Figuren, -Namen, -Sounds oder Assets. [belegt]

Dieses Intake promoviert keine Architektur oder Bibliothek. Figurensteuerung und Renderdimension
bleiben mit Empfehlung offen; Drift-Ladestufen und klassisches Arcade-Kit sind durch den aktuellen
Owner-Nachstups entschieden. Danach setzt die gebundene Fable-MAIN einen reversiblen Creative
Anchor, hält das Inhalts-Register, briefed isolierte Worker und führt den Vor-Owner-Loop aus.
[belegt]

Vertrauensstufen:

- **[gemessen]** — auf dieser Maschine ausgeführte Messung mit Build-Stamp, Bedingungen,
  Rohwerten und benanntem Messweg. Dieses Intake enthält noch keinen so markierten Produktwert,
  weil noch kein Build existiert.
- **[belegt]** — steht im Owner-Wortlaut oder in den benannten lokalen Quellen.
- **[These, zu prüfen]** — Design-, Technik-, Markt- oder Produktionsannahme. Sie wird erst durch
  den benannten Test belastbar.

Die Zahlen in diesem Intake sind Gates, keine vorweggenommenen Messwerte. Ein späterer Bericht
darf sie nur mit ausgeführtem Messweg `[gemessen]` nennen.

## Owner-Entscheid und unverhandelbarer Kern

Das Spiel ist ein Private-Repo-C mit genau diesem Kern:

1. Zwei gleichzeitig sichtbare Figuren sitzen auf jedem Kart.
2. Eine Figur fährt, die andere wirft.
3. Beide können während der Fahrt ihre Rollen tauschen.
4. Figuren haben Eigenschaften je Rolle; ein Paar besitzt mindestens eine gemeinsame Synergie.
5. Wurf-Items gehören zum Rennen.
6. Der Zielbuild läuft direkt im Browser.
7. Das Spiel ist im ersten Rennen als bunter, fröhlicher Arcade-Private-Repo-C mit Item-Boxen,
   Drift-Boost und Boost-Pads erkennbar.

Diese sieben Punkte dürfen Architektur und Prototyp-Reihenfolge formen; sie dürfen nicht zu einer
kosmetischen Sitzwechsel-Animation reduziert werden. Der Rollentausch muss in der ersten
fahrbaren Scheibe Fahrzustand oder Wurfwirkung messbar ändern. [belegt]

Das klassische Genre-Kit ist erwünscht: drehende Überraschungs-Boxen auf der Strecke,
Drift-Boost mit Ladestufen und Funken, Boost-Pads, Geschosse nach vorn, Fallen nach hinten,
rangabhängig gewichtete Item-Ausgabe, Positions- und Rundenanzeige, fröhliche Figuren sowie
verspielte Kursthemen. Eigene Figuren, Namen, Modelle, Texturen, Animationen, Sounds und Musik
bleiben Pflicht; Nintendos konkretes Material bleibt draußen. [belegt]

## Pitch

Ein sofort als Mario-Kart-artig erkennbarer, bunter, fröhlicher Browser-Arcade-Private-repo-c mit dem
Double-Dash-Zweierteam als Alleinstellung.

## Intent

**Private-repo-o** ist ein farbiger Browser-Arcade-Private-repo-c, dessen Identität direkt aus dem Paar kommt.
Zweiercrews treten mit selbstgebauten Karts bei einem wandernden Rennfest an. Der Fahrer hält
Linie und Drift, der Werfer bedient physische Rally-Werkzeuge vom Heckstand. Beim Rollentausch
klettern beide sichtbar über das Kart; ihre fahrerabhängigen Koeffizienten, ihre werferabhängige
Itemwirkung und ihre gemeinsame Synergie wechseln im laufenden physikalischen Zustand. Der
Spieler entscheidet, *wann* er wirft, *wer* wirft und wer die nächste Kurve fährt. [These, zu
prüfen]

Der erste Schnitt ist verbindlich browserbasiert. TypeScript/Bun passt zum lokalen Build- und
Capture-Weg; für die empfohlene echte 3D-Szene ist Three.js eine Kandidatenebene, kein
vorgezogener Renderer-Entscheid. Der Schnitt braucht einen Rundkurs, ein Kart, zwei Figuren, einen
Rollenwechsel und ein physisches Wurfobjekt; er braucht keine Gegnerflotte, Kampagne oder
Asset-Bibliothek. [belegt für Browserziel, Host und Workflow; These, zu prüfen für Renderweg und
Aufwand]

## Figuren- und Kursvorschlag

Die **Wander-Rally** ist ein mobiles Rennfest aus bemalten Straßenmodulen, Stoffbannern,
aufblasbaren Streckenmarken und handgebauten Karts. Die erste Strecke heißt
**Windwiesen-Ring**: ein sonniger Rundkurs über eine offene Festwiese, mit drei Kurvenfamilien,
zwei Reihen drehender Überraschungs-Boxen, zwei Boost-Pads und einer breiten Überholkurve. Die Welt
braucht für den ersten Spielspaß keine Lore-Erklärung; Strecke, Figuren, Karts, Item-Boxen und HUD
erklären das Rennen im ersten Bild. [These, zu prüfen]

Das erste Paar ist **Nia & Boro**. Nia hat eine schmale, aufrechte Silhouette und reagiert am
Lenkstand schneller; auf der Wurfplattform korrigiert Nia eine Wurfrichtung innerhalb eines
kleinen Zielkegels. Boro hat eine breite, tiefe Silhouette und hält das Kart als Fahrer stabiler;
als Werfer überträgt Boro mehr Impuls. Die Werte bleiben Tuninghypothesen, bis P3–P5 sie messen.
[These, zu prüfen]

Die gemeinsame Synergie heißt **Gegenzug**: Die Heckfigur lehnt sichtbar gegen die seitliche
Beschleunigung. Weil Nia und Boro unterschiedliche Massen- und Reaktionsparameter haben, ändert
der Rollentausch bei erhaltener Geschwindigkeit den Schwerpunkt, die Gierreaktion und die
Driftstabilität. Gegenzug zeigt sich durch Körperlage, Federweg und einen kurzen Paar-Impuls im
HUD; die drei Drift-Stufen behalten ihre eigenen farbigen Funken. [These, zu prüfen]

Die erste Item-Box vergibt eines von zwei eigenen Items. Der **Wirbelball** fliegt nach vorn,
platzt beim ersten Treffer in einen Luftstoß und bremst das getroffene Kart. Das
**Farbkissen** fällt nach hinten, bleibt als sichtbare Falle liegen und senkt beim Überfahren kurz
den Seitengriff. Eine drehende Überraschungs-Box, eine kurze Item-Anzeige und ein deutliches
Aufnahmegeräusch gehören zur beabsichtigten Genre-Lesbarkeit. Rang 2 erhält den Wirbelball öfter
als Rang 1; Rang 1 erhält das Farbkissen öfter als Rang 2. [These, zu prüfen]

## Lehren aus Anlauf 1–3

`~/private-repo-i/AGENTS.md:3`–`7` nennt die beiden Vorgänger „Steinbruch, kein Erbe“ und hält trotz 155
grüner Tests drei rein visuelle Kernlücken fest; deshalb übernimmt der vierte Anlauf keinen alten
Kern still und baut in der ersten Scheibe Paar, Kart, Strecke, Tausch und Item gemeinsam sichtbar.
[belegt]

Die Statusspalte von `~/private-repo-d/docs/content-ledger.md:29`–`40` enthält neunmal `delivered` und
dreimal `missing` (`:33`–`:35`), während `~/private-repo-i/AGENTS.md:6`–`7` alle drei Lücken als visuell
benennt; deshalb hat das neue Erstscheiben-Register sechs sichtbare Kernzeilen und öffnet den
Taste-Gate erst bei `missing_core_rows: 0`. [belegt]

`~/private-repo-d/docs/decision-record.md:353`–`365` verlangt, dass MAIN durchläuft, Tastefragen bündelt
und keinen Appeal-Gate mit fehlendem Core öffnet; deshalb erhält der Owner den Zehn-Minuten-Link
erst nach P0–P9, während die zwei offenen Richtungsentscheide gebündelt vor dem ersten Builder
geschlossen und der Drift-Entscheid im Log vermerkt werden. [belegt]

`~/private-repo-d/docs/decision-record.md:376`–`404` misst den Preis einer ungebundenen MAIN als fehlenden
Founding Brief, unerreichbare Nudge-Route und Unsichtbarkeit in programmbasierten Sichten; deshalb
wird die neue Fable-MAIN vor dem ersten Worker als gebundene Program-MAIN gegründet und der
Binding-Beleg im neuen Repo vermerkt. [belegt]

`~/private-repo-d/docs/decision-record.md:531`–`546` zeigt Direktcommits auf `main` und Selbstbenotung
durch den Builder, während `:552`–`:568` den fehlenden echten Gate-Pfad benennt; deshalb besitzt
jede Bau-Lane eine isolierte Schreibfläche und einen tatsächlichen Verify-Weg, und eine frische
read-only Kritik setzt erst danach `delivered`. [belegt]

## Was der vierte Anlauf anders macht

- Der erste Produktbeweis ist kein generischer Fahrkern. Er ist bereits das Zwei-Figuren-Kart mit
  sichtbarem Tausch und einem Paar-System.
- Grafik ist eine Core-Zeile. Ein grauer Kollisionskurs mit später versprochenen Figuren ist
  `missing`, nicht `delivered`.
- Vorhandener Drift-, Kontakt- oder Sim-Code darf als Steinbruch untersucht werden. Jede Übernahme
  nennt Quell-Commit, übernommene Grenze, neuen Breaker und den Grund gegen Neuerfindung.
- Der Builder bewertet weder seine Grafik noch sein Fahrgefühl selbst. Eine frische Lane fährt den
  ausgelieferten Pfad und sieht bewegte Bilder, bevor der Owner gefragt wird.
- Der Owner-Link weist den tatsächlich servierten Build-Stamp pro Request aus und ist vom
  Owner-Gerät erreichbar; HTTP-Erreichbarkeit allein ist kein Beleg.

## Das tragende System: Rolle × Figur × Fahrzustand

Die Simulation trennt drei Dinge:

1. Das Kart trägt den kontinuierlichen Zustand: Position, Geschwindigkeit, Giergeschwindigkeit,
   Lenkwinkel, Schlupf und Federzustand.
2. Der aktuelle Fahrer liefert Fahrparameter wie Lenkansprache, Seitengriff und Stabilisierung.
3. Der aktuelle Werfer liefert Zielkegel, Wurfgeschwindigkeit und Impulsmultiplikator des Items.

Beim Tausch bleiben Kartzustand und bereits fliegende Items erhalten. Nur Rollenbelegung und die
daraus abgeleiteten Parameter wechseln nach der sichtbaren Übergabe. Der Tausch ist damit keine
vorgeschnittene Bonuszone: Derselbe Eingriff kann auf einer Geraden fast nichts, am Driftansatz
eine Linienänderung und kurz vor einem Wurf eine andere Itembahn bewirken. [These, zu prüfen]

Die Paar-Synergie berechnet sich aus beiden Figuren und dem aktuellen Fahrzustand. Sie darf weder
einen Streckenabschnitt beim Namen kennen noch bei einer festen Rennsekunde feuern. Für Nia &
Boro nutzt Gegenzug seitliche Beschleunigung, Rollenmasse und Körperlage. Spätere Paare müssten
mit denselben Systemgrenzen neue Fahr-/Wurfentscheidungen schaffen; bloße Prozentboni oder neue
Kostüme zählen nicht als Paar. [These, zu prüfen]

## Drift-Boost mit Ladestufen

Der Spieler löst den Drift mit Bremsen plus Lenken aus und hält ihn durch Lenken oder Gegenlenken.
Stabiler Schlupf lädt drei klar getrennte Boost-Stufen. Jede Stufe hat eigene Funkenfarbe,
Partikeldichte und Tonhöhe; beim Lösen gibt sie einen numerisch begrenzten Geschwindigkeitsimpuls.
Ein kleines HUD-Symbol darf die erreichte Stufe wiederholen. Karosseriewinkel, Vorderräder,
Reifenspur und Federung bleiben zusätzliche Weltzeichen, aber nicht der einzige erlaubte Beweis.
[belegt für Ladestufen und Funken; These, zu prüfen für Eingabe und konkrete Schwellen]

Die Tiefe liegt im Übergang: Ein früher Tausch verändert die Driftkurve, ein später Tausch kann
die aktuelle Ladung mitnehmen oder abbrechen, und kein Tausch bleibt die sichere Linie. Der erste
Schnitt braucht genau drei Ladestufen und eine beherrschbare Kurvenfamilie; Reifentemperatur,
Oberflächenklassen und Setup-Tuning bleiben draußen. [These, zu prüfen]

## Qualitätsbalken für den ersten Schnitt

| BAR | FAILS WHEN | INSTRUMENT |
|---|---|---|
| Zwei Personen sind die Handlung, nicht Dekoration. | In einem 8-Sekunden-Clip ist vor, während oder nach dem Tausch nicht erkennbar, wer fährt und wer wirft. | Drei Clips ohne Debug-UI; frischer Critic nennt Fahrer, Werfer und Tauschrichtung. |
| Rollentausch ändert denselben Fahrzustand. | Swap und No-Swap ergeben unter identischem Input nach zwei Sekunden weniger als zwei der drei in P3 definierten Differenzen. | Deterministischer A/B-Replay mit Zustandslog. |
| Drift-Ladung ist ablesbar. | Eine frische Kritik ordnet in weniger als vier von fünf Clips die gezeigte Ladung `0`, `1`, `2` oder `3` korrekt zu. | Fünf anonymisierte 4–6-Sekunden-Clips mit Player-HUD und Funken, aber ohne Debug-Telemetrie. |
| Items erzeugen Positionskampf. | Wirbelball und Farbkissen ändern nach echtem Treffer weder Geschwindigkeit noch Seitengriff messbar, oder die Item-Box umgeht ihre Ranggewichtung. | Trefferlogs, Item-Ausgabe nach Rang und Capture. |
| Grafik zeigt echten Zustand. | Sitzposition, Körperlage, Radstellung, Spur, Drift-Stufe, Item, Box, Pad oder Treffer widersprechen dem Sim-Log länger als zwei Frames. | Frame-IDs, Zustandslog und benannte Captures aus demselben Build. |

Der Player-Build darf Position, Runde, Rundenzeit, gehaltenes Item, Drift-Stufe und kurze
Trefferhinweise zeigen. Debugwerte wie Giergeschwindigkeit, exakte Schlupfzahl, KI-Zielwerte,
Kollisionsformen, Trace-Hash oder Performancegraph bleiben draußen. [belegt]

## Erster Schnitt — etwa zwei Tage

Die Scheibe ist ein fahrbares Zwei-Kart-Rennen auf **Windwiesen-Ring**: Nia & Boro im
Spieler-Kart, eine feste Rivalencrew in einem einfachen Pace-Kart, zwei Runden, eine Ziellinie,
drei unterscheidbare Kurven, zwei Reihen drehender Überraschungs-Boxen, zwei Boost-Pads,
Wirbelball, Farbkissen, Erfolg, 240-Sekunden-Ablauf und sofortiger Neustart. Eine Runde zielt auf
45 bis 75 Sekunden; das ist ein Zielkorridor, bis ein Hands-on-Lauf ihn misst. [These, zu prüfen]

Der Spieler lenkt, beschleunigt, lädt Drift-Boost, fährt über Boost-Pads, sammelt Item-Boxen,
wirft nach vorn oder legt nach hinten und löst den Rollentausch aus. Im empfohlenen
Single-Player-Modell steuert er immer die Figur am Lenkrad. Die Wurfplattform richtet sich
innerhalb eines begrenzten Vorwärts- oder Rückwärtskegels aus; der Spieler entscheidet Richtung
und Zeitpunkt. Nach dem Tausch bleibt die Steuerperspektive beim Fahrer, aber Figur,
Fahrparameter, Werfereigenschaft und Paar-Synergie wechseln. [These, zu prüfen]

Der Spieler sieht vom ersten Frame beide Figuren auf einem asymmetrischen, farbig lackierten Kart,
den sonnigen Windwiesen-Ring, das Rivalen-Kart, bewegte Stoffbanner, rotierende Item-Boxen,
Boost-Pads und Drift-Funken. Der Tausch zeigt beide Körper auf dem Kart; kein Teleport und kein
bloßer Namenswechsel erfüllt die Scheibe. Beide Items sind vor und während ihres Einsatzes als
Weltobjekte sichtbar. Reifenstellung, Spur, Karosserieneigung, Körperlage, Funkenstufe,
Projektilflug, Falle und Treffer rendern Simulationszustand. Rohbau-Meshes sind erlaubt, wenn
Silhouette, Material, Licht und Bewegung absichtlich gestaltet sind; graue Kästen, Debugraster
und Debug-Telemetrie sind es nicht. [belegt für die Grafikgrenze; These, zu prüfen für die
konkrete Bildsprache]

## Inhalts-Register des ersten Schnitts

Der Taste-Gate bleibt geschlossen, solange eine dieser sechs Zeilen `missing` ist:

| Core-Zeile | `delivered` bedeutet |
|---|---|
| Karts + Strecke | Spieler- und Pace-Kart fahren zwei Runden auf Windwiesen-Ring; Start, Position, Rundenzählung, Ziel, Ablauf und Neustart funktionieren. |
| Zwei Figuren pro Kart | Beide Karts tragen je zwei gleichzeitig sichtbare Figuren; beim Spieler-Kart ist die aktuelle Rolle aus Körperposition und Handlung erkennbar. |
| Rollentausch | Beide Figuren wechseln während der Fahrt sichtbar die Plätze; P3 misst eine Folge. |
| Paar-Synergie | Gegenzug verändert ohne Streckentrigger mindestens zwei Fahrgrößen in P4. |
| Item-Kit | Rotierende Boxen vergeben ranggewichtet Wirbelball oder Farbkissen; beide werden sichtbar eingesetzt und verändern den Rivalen gemäß P5. |
| Drift + Boost | Drei Drift-Ladestufen, Funken, Boost-Auslösung und zwei Fahrbahn-Pads erfüllen P6 und P7. |

`delivered` braucht Pfad, Build-Stamp, Beweis und frisches Urteil. Fehlt eines davon, bleibt die
Zeile `missing` oder trägt einen CAVEAT. [belegt]

## Prüfbare Prädikate des ersten Schnitts

Jedes Prädikat endet in `JA` oder `NEIN`; Zahlen definieren die Grenze. P0–P9 brauchen je einen
demonstrierten Breaker. Der Bericht gibt `predicates_without_breaker: 0` und
`missing_core_rows: 0` aus; jeder andere Wert ist `NEIN`. [belegt als Studio-Proof-Regel]

| ID | PASS-Prädikat | Beweis und demonstrierter Breaker |
|---|---|---|
| P0 — echter Fahrpfad | **JA**, wenn eine frische Agent-Lane den gebundenen Browser-Build mit einem dokumentierten Startbefehl öffnet, ein Zwei-Kart-Rennen beginnt, mindestens `100 m` Weltstrecke fährt, einmal tauscht, eine Item-Box aufnimmt, mindestens Drift-Stufe `1` auslöst, ein Item benutzt und Neustart drückt; sonst **NEIN**. | Build-Stamp, Startbefehl, Inputlog und 30–60-Sekunden-Capture. Breaker: Beschleunigungs-Handler deaktivieren; der Lauf muss vor `100 m` scheitern. |
| P1 — Performance- und Render-Budget | **JA**, wenn ein zehnminütiger Release-Lauf auf dieser Maschine bei `1280×720` CSS-Pixeln und `devicePixelRatio = 1` nach `30 s` Warm-up `[gemessen]` `p95 frame interval ≤ 18 ms`, `p99 sim+physics tick ≤ 4 ms`, `0` Pausen `> 100 ms`, maximal `140` Draw Calls pro Frame und maximal `180.000` sichtbare Dreiecke ausweist; sonst **NEIN**. Schätzung oder Einzel-Screenshot ist **NEIN**. | Build-Stamp, Browser-/Hardware-Kennung, Samplezahl, p50/p95/p99, Renderer-Maxima und Rohdatenpfad. Breaker: kalibrierte Zusatzlast einschalten, bis `p99 sim+physics tick > 4 ms`; P1 muss rot werden. |
| P2 — sichtbarer Core | **JA**, wenn `missing_core_rows = 0`, beide Karts in mindestens `95 %` der Rennzeit je zwei sichtbare Figuren tragen, der Spielertausch beide Sitzpositionen wechselt, jede Box in verfügbar/drehend, geöffnet und Respawn gerendert wird und beide Items in Hand-, Einsatz- und Trefferzustand sichtbar sind; sonst **NEIN**. | Register, Framezählung und acht benannte Captures. Breaker: die Heckfigur des Rivalen ausblenden; die Zwei-Figuren-Zeile muss rot werden. |
| P3 — Kausalität Rollentausch | **JA**, wenn Swap und No-Swap aus identischem Seed und Zustand starten, nur der Swap bei `t = 2,0 s` abweicht, die Fahrer-ID binnen eines Sim-Ticks wechselt und nach weiteren `2,0 s` unter identischem aufgezeichnetem Input mindestens zwei Werte diese Differenz erreichen: Gierwinkel `≥ 5°`, laterale Abweichung `≥ 0,75 m`, Geschwindigkeit `≥ 0,5 m/s`; drei Wiederholungen je Variante müssen denselben Varianten-Trace-Hash liefern. Sonst **NEIN**. | Sechs Replays, Rollen-/Physiklog und Trace-Hashes. Breaker: Fahrerkoeffizienten nach dem Sitzwechsel auf den alten Werten lassen; weniger als zwei Grenzwerte müssen erreicht werden und P3 muss rot werden. |
| P4 — System-/Synergiebeweis | **JA**, wenn vier Läufe aus demselben Zustand — kein Tausch, Tausch auf der Geraden, Tausch am Driftansatz, Tausch im stabilen Drift — mindestens drei verschiedene Ergebnis-Tupel `(Kurvenausgang m/s, maximale Linienabweichung m, Driftzeit s)` erzeugen und `0` Paarregeln Streckenname, Checkpoint-ID oder Rennsekunde abfragen; sonst **NEIN**. | Vier Traces, Tupel und strukturelle Suche in Paar-/Swap-Regeln. Breaker: Rollenmasse, Körperlage und Fahrerkoeffizienten einfrieren; die Tupelzahl muss unter drei fallen und P4 rot werden. |
| P5 — Item-Kausalität und Ranggewichtung | **JA**, wenn `10.000` deterministische Ausgaben je Rang den Wirbelball auf Rang `2` mindestens `20` Prozentpunkte häufiger als auf Rang `1` und das Farbkissen auf Rang `1` mindestens `20` Prozentpunkte häufiger als auf Rang `2` vergeben, ein Wirbelball-Treffer die Rivalengeschwindigkeit für `0,6–1,2 s` um mindestens `20 %` senkt, ein Farbkissentreffer den Seitengriff für `0,8–1,5 s` um mindestens `25 %` senkt und ein Fehlschuss `0` dieser Effekte erzeugt; sonst **NEIN**. | Seed, vier Ausgabequoten, Treffer-/Fehlschuss-Traces und Capture. Breaker: Ranggewichte angleichen und beide Treffereffekte auf `0` setzen; Verteilungs- und Wirkungsteil müssen rot werden. |
| P6 — Drift-Boost und Lesbarkeit | **JA**, wenn stabile Drifts bei `0,6 s`, `1,2 s` und `2,0 s` die Stufen `1`, `2` und `3` erreichen, ihre Freigabe je mindestens `0,4 m/s` mehr Geschwindigkeitsimpuls als die vorige Stufe liefert und eine frische Kritik in mindestens vier von fünf Clips die gezeigte Stufe `0–3` korrekt nennt; sonst **NEIN**. | Drift-/Boost-Trace, fünf Clips mit Funken, Ton und Player-HUD sowie Antworten vor Logeinsicht. Breaker: alle Stufen auf dieselben Funken und denselben Impuls setzen; Physik- und Lesbarkeitsteil müssen rot werden. |
| P7 — Renderwahrheit | **JA**, wenn Fahrer-ID, Werfer-ID, Sitzpositionen, Körperlage, Radwinkel, Reifenspur, Drift-Stufe, Itemzustand, Boxzustand, Pad-Boost, Treffer, Position und Runde in den Prüftraces binnen höchstens zwei gerenderten Frames ihrem Spielzustand entsprechen und `0` sichtbare Reaktionen ohne Ereignis auftreten; sonst **NEIN**. | Frame-IDs, Sim-Events und acht benannte Captures aus einem Build. Breaker: Drift-Stufe `2` als Stufe `1` rendern; der Widerspruch muss länger als zwei Frames bestehen und P7 rot werden. |
| P8 — frisches Hands-on | **JA**, wenn eine frische Agent-Lane ohne Sim-API, Replay-Policy oder Debug-Overlay innerhalb von fünf Minuten zwei Runden beendet oder den `240-s`-Ablauf erreicht, mindestens zweimal tauscht, zwei Item-Boxen aufnimmt, je einmal Wirbelball und Farbkissen benutzt, ein Boost-Pad befährt, Drift-Stufe `2` auslöst und ihren stärksten wahrgenommenen Defekt benennt; sonst **NEIN**. | `agent-hands-on`-Verdikt auf festem Erstscheiben-Seed, tatsächlicher Inputpfad, Build-Stamp und Capture. Breaker: Item-Aufnahme vom Player-Kart trennen; die Zwei-Item-Bedingung muss scheitern. |
| P9 — Owner-erreichbarer Build | **JA**, wenn genau ein URL- oder Dateipfad vom Owner-Gerät öffnet, der im Spiel sichtbare Build-Stamp dem pro Request gelesenen servierten Commit entspricht, der Host nicht fest auf Loopback beschränkt ist und Neustart denselben Stamp behält; sonst **NEIN**. | Owner-Gerät-Fetch, Request-/Asset-Stamp und Startanweisung. Breaker: einen absichtlich abweichenden Asset-Stamp servieren; P9 muss vor Übergabe rot werden. |
| P10 — Owner-Spaß-Gate | **JA**, wenn der Owner den ausgelieferten Build zehn Minuten selbst fährt und danach ausdrücklich `weiter` auf die Frage „Willst du mit diesem Paar noch eine Runde fahren?“ antwortet; `ändern`, `stoppen`, kein Urteil oder weniger als zehn Minuten sind **NEIN**. | Owner-Wortlaut, zehnminütige Fahrzeit und Build-Stamp. Kein Agent, Replay oder Modell-Judge ersetzt dieses Prädikat. |

P1 ist das gemessene Performance- und Render-Budget. P3 beweist die Folge des Rollentauschs. P4
prüft, ob Rollen, Driftzustand und Paarparameter ohne Streckenskript mehrere Ergebnisse erzeugen.
P10 bleibt Geschmack. [belegt für die Beweisarten; These, zu prüfen für die Schwellenwerte]

## Kill-Kriterien und genau ein Rettungsversuch

Der Kernloop gilt als tot, wenn P3 oder P4 nach ausgeschöpfter gewöhnlicher MAIN-Reparatur `NEIN`
bleibt: Dann ist der Rollenwechsel kosmetisch oder die Paar-Synergie ein benannter Sondertrigger.
Der erste Schnitt ist nicht tastefähig, solange P5 oder P6 `NEIN` ist: Ohne Item-Positionskampf
und Ladestufen-Drift fehlt das jetzt fixierte Arcade-Kit. Der Kern gilt außerdem als tot, wenn
P2–P8 `JA` sind und der Owner nach zehn Minuten ausdrücklich `stoppen` sagt. Kein Owner-Urteil ist
`unknown`: Es stoppt die Erweiterung, beweist aber nicht den Tod des Kerns. [These, zu prüfen]

Falls P3–P6 `JA` sind, aber P8 oder P10 wegen unlesbarer, unterbrechender oder kraftloser
Rennrückmeldung `NEIN` wird, ist genau **ein** Rettungsversuch erlaubt. Eine Builder-Lane erzeugt
B aus A und darf Tausch-Antizipation, Körperanimation, Kameraimpuls, Input-Puffer, Drift-Schwellen,
Funken/Ton, Item-Trefferfeedback, Boost-Pad-Impuls und die Hierarchie des normalen Player-HUDs
ändern. Die Tauschdauer bleibt zwischen `300` und `700 ms`. B fügt `0` Figuren, Strecken, Items,
Regeln oder Gegner hinzu. [These, zu prüfen]

Ein frischer Critic fährt die anonymisierten Builds in zufälliger Reihenfolge je fünf Minuten;
danach fährt der Owner beide je zehn Minuten. Nur eine ausdrückliche Präferenz für B und ein
`weiter` rettet den Kern. Präferenz für A, `indifferent`, `ändern`, `stoppen` oder kein Urteil
beendet den Rettungsversuch ohne zweite Runde. [These, zu prüfen]

Ein rotes P1 tötet zuerst Renderer oder Szenenbudget, nicht automatisch den Paar-Kern. Die MAIN
darf Darstellung oder Updatepfad innerhalb des Fortschrittsbudgets vereinfachen, solange
Zwei-Figuren-Sichtbarkeit, P3–P5 und die Bildidentität bestehen bleiben. [belegt als
Studio-Reparaturgrenze]

## Non-Goals des ersten Schnitts

1. Kein Netz-Multiplayer, Matchmaking, Account oder Backend.
2. Keine parallele Umsetzung von KI-Partner und Hotseat; der vom Owner nicht gewählte
   Steuerungsweg ist Non-Goal der ersten Scheibe.
3. Kein Feld mit mehr als einem Rivalen-Kart, keine Meisterschaft und kein Qualifying-Raster.
4. Keine zweite Strecke, alternative Route oder Streckenwahl.
5. Kein zweites spielbares Paar und keine Charakterauswahl; die feste Rivalencrew ist nicht
   auswählbar und braucht im ersten Schnitt keine eigene Synergie.
6. Kein drittes Item, kein Reserve-Inventar und keine vollständige Comeback-Balancierung für mehr
   als zwei Ränge.
7. Keine Werkstatt, Kartteile, Werte-Upgrades, Währung oder Meta-Fortschritt.
8. Keine Sprünge, Tricks, Stunts, Luftsteuerung oder Zerstörungsmodell.
9. Kein Wetter, Tag-Nacht-Wechsel oder prozedurales Streckenfalten während der Runde.
10. Kein Mobile-Build, App-Store-Pfad oder Gamepad-Pflicht; Touch wird nur in der Eingabegrenze
    mitgedacht.
11. Keine extern heruntergeladenen Modelle, Texturen, Musikstücke, Fonts oder Datensätze ohne
    vorherige Lizenzprüfung und Owner-Gate.
12. Keine Nintendo-Figuren, -Namen, -Modelle, -Texturen, -Animationen, -Sounds oder Musikdateien.

## Technik-Vorschlag — nicht promoviert

- Browserbasiertes TypeScript/Bun, lokaler Web-Build und ein dokumentierter Startbefehl. [belegt
  als Owner-Entscheid und Maschinen-Default]
- Empfohlen ist echtes 3D über eine dünne Three.js-Ebene mit fester Verfolgerkamera, kleiner Szene,
  code-eigenen Meshes und ohne Render-Framework über der Spielarchitektur. P1 entscheidet, ob die
  Ebene im Budget bleibt. [These, zu prüfen]
- Fester Simulations-Tick; Kartzustand, Rollenparameter, Itemprojektil und Renderer bleiben getrennt.
  Gleicher Seed plus gleiche Eingaben müssen gleiche Trace-Hashes liefern. [These, zu prüfen]
- Pointer-/Touch-, Tastatur- und Gamepad-Aktionen sollen dieselben semantischen Inputs speisen:
  lenken, Gas, bremsen/driften, tauschen, werfen, neu starten. Der erste Schnitt beweist Tastatur
  und Pointer für Menüs; Touch-Fahrgefühl und Gamepad-Polish sind Non-Goals. [These, zu prüfen]
- Vorhandener Code aus den drei Kart-Repos wird zuerst gesucht. Übernahme ist nur mit Quell-Commit,
  Eignungsbeleg und neuem Breaker erlaubt; `copy because tested` reicht nicht. [belegt]

## Offene Owner-Fragen und geschlossener Drift-Entscheid

Partner-Steuerung und Renderdimension bleiben ein gebündelter, deklarierter Owner-Gate vor dem
ersten Builder. Die Driftfrage hat der aktuelle Owner-Nachstups geschlossen. [belegt]

### 1. Partner-Steuerung im Single-Player

**Empfehlung: KI-Partner mit explizitem Spieler-Wurf, Hotseat erst nach dem ersten Taste-Gate.**
Der Spieler steuert immer den Fahrer; die Heckfigur wählt nur innerhalb eines begrenzten
Vorwärts- oder Rückwärtskegels ein gültiges Ziel und zeigt das durch Körperausrichtung; der
Spieler bestätigt Richtung und Einsatz. So kann der Owner allein zehn Minuten fahren, der
Rollentausch bleibt erlebbar und die KI entscheidet weder Linie noch Item-Zeitpunkt. Hotseat würde
den Kern sozial zeigen, verlangt aber für jeden First-Run eine zweite Person und verdoppelt die
gleichzeitige Eingabefrage. [These, zu prüfen]

**Owner-Entscheid offen:** `KI-Partner` oder `Hotseat`. Netz-Multiplayer bleibt in beiden Fällen
außerhalb des ersten Schnitts. Wählt der Owner `Hotseat`, schreibt die MAIN P0 und P8 vor dem
Builder als gleich starke Zwei-Personen-Proben um und protokolliert die Abweichung; ein einzelner
Agent, der beide Eingabesätze bedient, gilt nicht als Hands-on-Beleg. [belegt für den Entscheid;
These, zu prüfen für die Ersatzprobe]

### 2. 3D oder 2.5D und Render-Budget

**Empfehlung: echtes 3D mit fester Verfolgerkamera und hartem P1-Budget.** Zwei Körper müssen auf
dem Kart Plätze tauschen, Reifenwinkel und Karosseriegier müssen Drift zeigen, der Wirbelball
braucht eine lesbare Flugbahn zum Rivalen, und Boxen sowie Pads müssen auf der Strecke lesbar
bleiben. Eine begrenzte 3D-Szene zeigt diese Tiefenbeziehungen direkt; 2.5D spart nur dann Arbeit,
wenn Körpertausch, Positionskampf und Kurvenraum dort tatsächlich schneller lesbar werden. Das
vorgeschlagene Erstbudget ist `1280×720 @ DPR 1`,
`p95 frame interval ≤ 18 ms`, maximal `140` Draw Calls und maximal `180.000` sichtbare Dreiecke;
P1 misst statt zu schätzen. [These, zu prüfen]

**Owner-Entscheid offen:** `3D` oder `2.5D`. Bei `2.5D` muss die MAIN P2, P6 und P7 mit demselben
Anspruch beweisen; die Wahl senkt nicht die Grafikgrenze. [belegt]

### 3. Drift-Tiefe oder Lesbarkeit — geschlossen

**Owner-Entscheid:** Drift-Boost hat drei Ladestufen mit Funken-Feedback. Ein kontinuierlicher
Schlupfwert darf darunter die Physik treiben, aber die Player-Schicht zeigt Stufe `0–3`, eindeutige
Funken und einen gestuften Ausgangsimpuls. HUD-Wiederholung ist erlaubt; exakte Physikwerte bleiben
Debug-Telemetrie. P3, P4 und P6 messen Tauschfolge, Systemwirkung und Stufenlesbarkeit getrennt.
[belegt]

## Weitere offene Fragen und Risiken

- **Ist Rollenwechsel unter Geschwindigkeit eine Entscheidung oder eine Pflichtanimation?** P3
  und P4 messen Folgen; P10 entscheidet, ob sie gewollt sind. [These, zu prüfen]
- **Kann der KI-Partner zielen, ohne dem Spieler das Item abzunehmen?** Die Empfehlung begrenzt KI
  auf Zielkegel und Körperausrichtung. Ein Fehlwurf muss möglich bleiben. [These, zu prüfen]
- **Bleiben beide Figuren aus der Verfolgerkamera sichtbar?** P2 verlangt `95 %` der Fahrframes;
  Kamera, Silhouetten und Kartaufbau müssen diesen Wert gemeinsam erreichen. [These, zu prüfen]
- **Ist Gegenzug neben Item-, Positions- und Drift-HUD noch lesbar?** P4 kann die Systemwirkung
  belegen; P6 und Owner-Taste müssen die Wahrnehmung klären. [These, zu prüfen]
- **Trägt die Wander-Rally über einen Kurs hinaus?** Der erste Schnitt beweist nur
  Windwiesen-Ring. Eine zweite Strecke ist vor P10 verboten. [These, zu prüfen]
- **Ist „Private-repo-o“ als Produkttitel verfügbar?** Namens-, Marken- und Store-Prüfung wurden
  nicht durchgeführt; bis dahin ist es ein Arbeitstitel. [These, zu prüfen]
- **Welche alten Physikteile sind übernehmbar?** `~/private-repo-d` behauptet getesteten Drift,
  Kontakt und Sim-Kern, aber Eignung für Rollenparameter, aktuellen Toolchain-Stand und Lizenz des
  Zielprodukts ist nicht geprüft. [belegt für die Alt-Behauptung; These, zu prüfen für Übernahme]

## Hinweis an die Fable-MAIN

Dieses Intake ist ein **Vorschlag mit Begründungen**, keine vorweggenommene Architektur. Die MAIN
darf jeder These mit Messung, Quellbeleg oder Hands-on-Befund widersprechen. Jede Abweichung bei
Fantasy, Zwei-Figuren-Kern, Rollentausch, Paar-Synergie, Item, erstem Schnitt, Schwellenwert oder
Stop-Linie muss sie mit Anlass, Beleg, Wirkung und Reopen-Trigger in ihrem Entscheid-Log
festhalten. Den fixierten Kern und die Null-Nintendo-IP-Grenze darf sie nicht umdeuten. [belegt]

Die MAIN legt dem Owner die zwei offenen Richtungsentscheide gebündelt vor und führt Drift-Stufen
sowie Arcade-Kit als geschlossene Owner-Entscheide. Vor dem finalen Taste-Gate gelten: gebundene
MAIN, Creative Anchor, tiny playable, tatsächlicher Verify-Weg, frische `agent-hands-on`-Kritik,
begrenzte Reparatur mit benanntem Fortschritt und owner-erreichbarer Ein-Schritt-Start.
`automaton-demo`, grüne Sim-Tests oder ein HTTP-200 ersetzen weder P8 noch P10. [belegt]

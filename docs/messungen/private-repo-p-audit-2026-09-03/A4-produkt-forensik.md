# A4 — Produkt-Forensik am Build: was der Nutzer tatsächlich bekommt

Quellen: `/Users/owner/private-repo-p` @ `5ecc505` (alle 19 Swift-Dateien gelesen), `docs/PRODUCT.md`,
`docs/reviews/*.md`, `AGENTS.md`, `$S/ios-programs.json`, Video `private-repo-y-tour.mp4` → 99 Frames
@0,6 fps (`$S/work-A4/frame-*.png`, alle über vier Kontaktbögen gesichtet, sechs einzeln gelesen).
`make check` einmal gefahren: `ALL-PASS repository`. Kein `verify`/`xcodebuild`/`simctl`.

## Was der Lauf geleistet hat

In ~6 Lane-Stunden entstand eine kompilierende, native SwiftUI-App mit fünf Screens, 7 124 Zeilen
Swift, einem geschlossenen JSON-Vertrag (`WorkflowPack 1.0.0`) mit deterministischem Validator und
32 Negativ-Fixtures, einem SPM-Core-Target, 53 nativen Unit-Tests + 59 Host-Package-Tests + 5
XCUITests mit Accessibility-Audit in jedem UI-Pfad, zwei unabhängigen Codex-Reviews mit
Reproduktions-Rezepten und einem Land-Gate, das den Simulator selbst leaset und aufräumt. Der
Datenschutz-Pfad ist ehrlich gebaut: `unknown` wird nirgends zu `0` (`StageMeasurement.swift#Measured`),
Senden bleibt bis Freigabe **und** Hash-Gleichheit gesperrt (`ReleaseGate.swift`), und der
Disabled-Zustand ist bewusst kontraststark statt ausgegraut (`ReleaseAndAcceptanceView.swift#GateButtonStyle`).
Das ist mehr Ingenieurdisziplin als der Private-repo-x-Canary hatte.

## 1. Der Nutzer-Pfad, wie gebaut

Fünf Screens, `NavigationStack` + `NavigationLink`, eine lineare Kette ohne Rückweg außer der
System-Back-Chevron:

| # | Screen | Datei | Eingaben | Was passiert |
|---|---|---|---|---|
| 1 | „Kostenlose Orientierung" | `OrientationView.swift` | 4 Freitextfelder (Ziel, Eingaben, gewünschtes Ergebnis, Risiken) + 4 Radiogruppen (Belegstatus, Art des Ergebnisses, Datenlage, Zielsystem) | „Eignung prüfen" → reine Funktion, danach zwei Bestätigungsschritte („Projekt anlegen" → Konditionen → „bestätigen") |
| 2 | WorkflowPack | `WorkflowPackView.swift` | 4 Checkboxen (Zustand/Formular/Validierung/Checkliste) | „WorkflowPack erstellen" → deterministischer Bau + Validator-Verdikt |
| 3 | Sicherer Probelauf | `DemoView.swift` | keine | rendert 7 synthetische Testfälle aus dem eben gebauten Pack |
| 4 | Freigabe und erster Test | `ReleaseAndAcceptanceView.swift` | Freitext-Original, Satzauswahl, Vertraulich-Toggle, Freigabeknopf, „Senden", danach **Selbstauskunft** „Erster Test bestanden/fehlgeschlagen" + 2 Zahlenfelder (Tokens, Kosten) | erzeugt Übergabetext in die Zwischenablage; Akzeptanz-Zustandsmaschine; max. 1 Reparatur; Speichern |
| 5 | Übergabe und Messung | `ExportView.swift` | keine | zwei Startblöcke + SHA-256 je Provider + Messtabelle |

**Wo ist das „Consulting"?** In genau einer `if`-Zeile. `OrientationResult.swift#OrientationRules.evaluate`
(Zeilen 111–125): fehlende Pflichtfelder → `.incomplete`; **`resultKind == .bindingDecision` → `.unsuitable`**;
**alles andere → `.suitable`**. Das ist die vollständige Entscheidungslogik. `evidence`,
`dataSensitivity` und `targetSystem` ändern nur Textbausteine (`bindingDecisionAnswer`,
`privacyBoundary`), nie das Urteil.

**Welche Antwort bekommt eine Nutzerin, die ein reales Vorhaben beschreibt?** Ihre eigenen Wörter,
neu verkettet. `OrientationResult.swift:118`:
`"\(resultKindLabel) zu „\(goal)" aus \(inputs); Ergebnis: \(desiredResult). Risiken: \(risks)."`
Im Video (Frame 029, 032) heißt das wörtlich: „Entwurf zu „Ankuendigung klar formulieren" aus
Oeffentlicher Text; Ergebnis: Klares Ergebnis. Risiken: Fehlentscheidung." Der Program-Intent verlangt
„grenzt das sinnvolle AI-Teilstück ab" — abgegrenzt wird nichts; es wird umformatiert.

Der WorkflowPack ist ebenso eine Schablone: `WorkflowPackBuilder.swift#compose` erzeugt für **jede**
Eingabe immer dieselben 2 Erfolgskriterien, 2 Validierungen, 2 Schritte, 5 Zustände, 1 Stop-, 1
Eskalationsbedingung; variabel sind nur die eingesetzten Strings und die Zahl der Inputs (Split der
Freitextliste an `,`/`;`/` und `, `WorkflowPackBuilder.swift#inputLabels`).

## 2. Versprechen vs. Lieferung (Program-Intent Satz für Satz)

| Versprechen (Intent/successCriterion) | Lieferung | Beleg |
|---|---|---|
| kostenlose Orientierung | **echtes Erlebnis** — Formular, Ergebnis, keine Kosten | `OrientationView.swift`, Frame 029 |
| „erklärt konkret, warum AI nicht passt und welche Alternative hilft" | **eine einzige hartkodierte Antwort** für den einzigen Unsuitable-Zweig; die vier Felder sind Konstanten mit eingesetztem `goal`/`inputs` | `OrientationResult.swift#bindingDecisionAnswer`, Frame 044 |
| „grenzt das sinnvolle AI-Teilstück ab" | **fehlt** — Umfang = Konkatenation der Eingaben | `OrientationResult.swift:118` |
| WorkflowPack-Erzeugung, versioniert, validiert | **echtes Erlebnis + Schema-Validierung** (stärkster Teil des Builds) | `WorkflowPackValidator.swift` (732 Z.), 32 Reject-Fixtures |
| Chat-only vs. Mini-App regelbasiert | **echtes Erlebnis**, aber die „Regel" ist ein OR über vier Checkboxen, die die Nutzerin selbst setzt | `RendererDecision.swift:29` |
| sicherer Probelauf | **Fixture-Demo** — zeigt die vom Builder selbst erzeugten Erwartungswerte; Status wird aus `expectedOutcome.status` abgeschrieben | `DemoRun.swift:191/208`, Codex-Re-Review Finding 2 (HIGH) |
| geführte Übergabe | **echtes Erlebnis** (Copy-Button, ehrlicher „kein Netzwerkaufruf"-Hinweis) | `ReleaseAndAcceptanceView.swift#payloadCard` |
| erster realer Test | **Selbstauskunft** — die Nutzerin drückt selbst „bestanden"/„fehlgeschlagen"; die App misst nichts | `ReleaseAndAcceptanceView.swift#testControls` |
| Reparatur (genau eine) | **echte Zustandsmaschine**, aber die Reparatur ergänzt eine generische Validierung, die niemand ausführt | `AcceptanceAndRepair.swift`, Frame 070 |
| lokal wiederverwendbar gespeichert | **write-only** — s. Befund P1 | `LocalWorkflowStore.swift#save` vs. `Private-repo-y/App/` |
| Golden-Case-Messung entscheidet 3 vs. 5 Projekte | **Selbstbestätigung** — `workflowQuality` zählt, ob die eigenen Strings nicht leer sind (`3/3`) | `StageMeasurement.swift#StageMeasures.orientation` |

**„Private-repo-y ohne Modellaufruf":** das ist **Programm-Vorgabe, kein Lieferfehler** — der
Program-Entscheid sagt wörtlich „Der echte Abnahmelauf erfolgt im tatsächlichen Zielsystem, weil ein
interner Modelllauf ChatGPT- oder Claude-Verhalten nicht beweist", die nonGoals verbieten
Provider-Konten und Credentials. **Der Lieferfehler ist ein anderer:** ohne Modell wurde die
Beratungsleistung nicht durch *Wissen* ersetzt (kuratierte Fallmuster, Gegenfragen, Beispiel-Packs
für typische Vorhaben), sondern durch *Textformatierung*. Ein regelbasiertes Consulting mit 20
Vorhabenstypen wäre ohne Modell möglich gewesen und war nicht verboten.

## 3. Visuelle und interaktive Qualität

Nicht Default-SwiftUI: eigene Farbpalette (`accent 0.12/0.32/0.48`, `warning`, Papier-Hintergrund
`0.95/0.96/0.94`), Karten mit `RoundedRectangle(22)`, `design: .rounded` für Titel, `maxWidth: 620`,
eigene Options- und Toggle-Zeilen mit ≥44 pt Trefferfläche und `accessibilityIdentifier`/`-Label`
überall. Das ist über Default-Niveau. Konkrete Stellen, die trotzdem Wert kosten:

1. **Kein App-Icon, kein Display-Name, kein Asset-Katalog** — `find . -name '*.xcassets'` ist leer.
   Auf dem Home-Screen (Frame 018) stehen nur `Private-repo-xUITe…` und `Private-repo-yUIT…`, die
   Test-Runner, mit leeren Kacheln. Der Owner sah nie ein Produkt auf dem Springboard.
2. **~30 der 99 Frames zeigen Springboard oder Weißbild** (Frames 001–021 = die ersten ~35 s, dann
   037, 046–047, 095–099). Der Owner sah ein Viertel des 134-s-Videos beim App-Installieren zu.
3. **Deutsch mit ASCII-Ersatzschreibung im gesamten sichtbaren Testkorpus** —
   `UITestingScenario.swift:41/53/56/65/66`: „Massnahmenliste", „Angebotspruefung", „Pruefung",
   „Ankuendigung", „Oeffentlicher Text". Im Video ist das der Fließtext jeder Ergebniskarte
   (Frames 029, 024, 076). Das liest sich für einen deutschen Nutzer wie ein defektes Encoding.
4. **Der Screen-Titel ist Englisch, alles darunter Deutsch** — `OrientationView.swift:69`
   `navigationTitle("Private-repo-y")` über „Ist KI für deinen Fall geeignet?" (Frame 029).
5. **Der Export-Screen ist ein Ingenieur-Screen** — dominant sind zwei identische SHA-256-Strings
   und Byte-Zahlen (`ExportView.swift:78–86`, Frame 024). Für die Zielgruppe („mehr Aufgaben als
   AI-Erfahrung") ist das Rauschen, nicht Vertrauen.
6. **Wortumbruch bricht bei großer Dynamic Type** — Frame 032: „Ankuendi-|gung klar formulieren" a|us".
   Die Ursache ist Punkt 1 der Kette: der Umfangstext ist eine lange Konkatenation
   (`OrientationResult.swift:118`), kein für Umbruch gestalteter Satz.
7. **Es gibt keinen Ladezustand und keinen Fortschritt** — alle Übergänge sind synchron; es fehlt
   jede Orientierung, an welcher der fünf Stufen man steht (kein Stepper, kein „Schritt 3 von 5"),
   obwohl `docs/PRODUCT.md:228` die Stufen benennt.
8. **Leerzustände sind Fehlerprosa, kein Onboarding** — `OrientationView.swift#incompleteNotice`
   listet rot die fehlenden Feldnamen; einen Erst-Start-Screen, ein Beispiel oder eine
   ausgefüllte Musterantwort gibt es nirgends (Frame 043: die Nutzerin startet vor einem leeren
   8-Felder-Formular).
9. **Der Preis steht als Rohsatz in der UI** — „2,99 EUR für fünf Projekte — eine Hypothese, keine
   bestätigte Preis- oder Margenaussage" (`OrientationResult.swift#priceHypothesis`, Frame 029).
   Interne Vorsichtssprache im Kundentext.
10. **Der „erste reale Test" fragt die Nutzerin, welches `criterion-result`/`criterion-risk`
    fehlschlug** (`ReleaseAndAcceptanceView.swift#testControls`, Frame 065) — IDs aus dem Schema
    als Auswahlbeschriftung.

## 4. Was die Gates beweisen — und was strukturell nie

Belegt (Codex-Re-Review „Machine proof", `docs/reviews/2026-09-02-independent-codex-re-review.md`):
53/53 native Unit, 59/59 Host-Package, 5/5 UI, 0 Failures, 428 s, plus Accessibility-Audit in jedem
UI-Pfad. Das beweist: die App startet, die fünf Pfade sind erreichbar, kein Kontrast-/Trefferflächen-
Verstoß im auditierten Zustand, kein `URLSession`/`WKWebView`/`JavaScriptCore` im Korpus, Exporte
byte-identisch, genau eine Reparatur, `unknown` wird nie zu `0`.

Strukturell nie belegt: ob die Orientierung **nützlich** ist, ob ein Nutzer versteht, was ein
WorkflowPack ist, ob der Übergabetext in ChatGPT/Claude etwas Brauchbares erzeugt, ob der Preis
trägt. **Kein Test dieses Repos berührt ein Zielsystem** — das ist per nonGoal richtig, macht aber
jede Aussage über Produktnutzen unbelegt.

**Sind die Golden Cases Realfälle?** Nein. GC1 ist ein Fixture, das die einzige Regel bestätigt
(`OrientationTests.swift:32`: `resultKind == .bindingDecision` rein, `.unsuitable` raus). GC2 und GC3
sind **handgeschriebene JSON-Dateien** (`Fixtures/WorkflowPack/valid-golden-case-2/3-*.json`), die der
Builder so nie erzeugt — sie prüfen den Validator, nicht das Produkt. GC5 ist der einzige Fall, der
durch den echten Builder läuft (`UITestingScenario.goldenCase5Answers`). Der Codex-Re-Review hat den
Kern selbst benannt (Finding 2, HIGH): „demo quality is an oracle echo, not an objective synthetic
result" — GC2s erwartete Termine stehen bereits in den Eingaben und im nicht ausgeführten
Checklistentext, also ist der Fall grün ohne jede Umformulierung.

## 5. Private-repo-x-Vergleich

Private-repo-x (`Private-repo-x/App/ContentView.swift`, 280 Z. + 31 Z. `JobMath` + 10 Z. App = 321) war ein
**fertiges Ein-Screen-Produkt**: Angebot, Aufwand, Kosten rein → effektiver Stundensatz gegen
Zielsatz raus, „in under a minute", Englisch, konsistent, mit Sofort-Feedback. Private-repo-y hat die
**Infrastruktur** übernommen (dasselbe `Private-repo-x.xcodeproj` mit neuen Targets, `scripts/verify.sh`,
`make check/verify/review`, Simulator-Lease, Accessibility-Audit-Muster) und beim **Produkt** bei null
angefangen — neu ist `Package.swift` mit `Private-repo-yCore` (der Canary hatte kein SPM-Target).
Übernommen wurde die Beweis-Maschine, nicht die Produkthaltung: Private-repo-xs Wert war in fünf Sekunden
sichtbar, Private-repo-ys Wert steht am Ende von fünf Screens und ist dort ein Zwischenablage-Text.

## 6. Der Abstand zum Möglichen

Dieselben ~6 Lane-Stunden mit einem **Produkt-Brief** statt eines Schema-Briefs hätten liefern
können: einen Katalog von 15–25 konkreten Vorhabenstypen („Angebot prüfen", „Protokoll zu Maßnahmen",
„Reklamation beantworten") mit je einem fertigen, handgeschriebenen WorkflowPack — die Nutzerin
wählt statt zu tippen und sieht in zehn Sekunden ein Ergebnis, das nicht ihre eigenen Wörter sind.
Der Validator wäre dann der Prüfer eines echten Korpus statt der Prüfer seiner eigenen Fixtures, die
Golden Cases wären fünf dieser Vorlagen, und dieselben fünf UI-Tests hätten dieselbe Beweiskraft.
Die eine Sache, die heute am meisten Wert kostet, ist **die leere Regelbasis**: eine einzige
`if bindingDecision`-Zeile trägt das gesamte Produktversprechen „Consulting", und alles, was die
Nutzerin zurückbekommt, ist ihre eigene Eingabe in anderer Reihenfolge.

## Gerankte Produktbefunde

**P1 — Der gespeicherte Workflow ist nicht wiederverwendbar (write-only).** `LocalWorkflowStore`
hat `save`, `list`, `load` (`LocalWorkflowStore.swift:48/74/77`), aber **keine View ruft `list`
oder `load`** (`grep -rn "store.list\|StoredWorkflow" Private-repo-y/App/` → nur die
`@State`-Deklaration). `Private-repo-yApp.swift` startet ohne Testargument immer in `OrientationView()`.
*Kosten:* das bezahlte Kernversprechen („lokal wiederverwendbar gespeichert", Intent + PRODUCT.md:41)
ist im Build unerfüllbar; nach App-Neustart ist die Arbeit unerreichbar. Beim nächsten Lauf: ein
Brief, der eine Stufe als „gespeichert" abnimmt, ohne den Rückweg zu verlangen, produziert diese
Klasse erneut.

**P2 — Die Orientierung berät nicht; sie formatiert.** Eine Regel, ein Textbaustein-Satz
(`OrientationResult.swift:111–125`). *Kosten:* das ist die Fläche, an der der Owner „weit unter dem
Möglichen" gesehen hat; kein Gate kann es je melden, weil kein Gate Nutzen misst.

**P3 — Der Probelauf beweist sich selbst.** `DemoRun.swift:191/208` leitet den Status aus
`expectedOutcome.status` ab; `StageMeasures.demo` zählt das als Qualität. *Kosten:* jede
Qualitätszahl im Produkt (`3/3`, „7 davon wie erwartet", Frame 083) ist informationsfrei; die
Preisentscheidung 3-vs-5-Projekte, die laut Program genau darauf beruhen soll, hat keine Grundlage.
Vom Re-Review als HIGH offen, Repair-Brief 9 nie dispatcht.

**P4 — Der „erste reale Test" ist eine Selbstauskunft.** `testControls` — die Nutzerin drückt
„bestanden". *Kosten:* die einzige Stelle, an der externe Realität ins Produkt käme, ist ein
Knopf; die Akzeptanz-Zustandsmaschine (128 Z. Core + Tests) verwaltet einen Wert, den niemand misst.

**P5 — Produktoberfläche ohne Identität.** Kein App-Icon, kein Display-Name, kein Asset-Katalog;
englischer Titel über deutschem Text; ASCII-Umlaute im gesamten sichtbaren Korpus; SHA-256 als
Hauptinhalt des letzten Screens. *Kosten:* Owner-Vertrauen — das Video zeigt 35 s Springboard mit
zwei Test-Runner-Kacheln, bevor überhaupt etwas erscheint.

--- Schnittlinie (darunter: Handwerk, nicht Produktwert) ---

P6 fehlender Fortschrittsindikator über die fünf Stufen · P7 Preishypothesen-Vorsichtssatz im
Kundentext · P8 Wortumbruch bei XXXL · P9 Kriterien-IDs als Auswahlbeschriftung · P10 kein
Onboarding/Beispiel beim leeren Formular.

## Verifiziert / Abgeleitet / Nicht geprüft

**Verifiziert (Code gelesen bzw. Frame gesehen):** alle 19 Swift-Dateien in `Private-repo-y/` und
`Private-repo-y*Tests/`; die eine Entscheidungsregel; die Builder-Schablone; das Fehlen jeder
`list()`/`load()`-Aufrufstelle in `App/`; das Fehlen eines Asset-Katalogs (`find`); die
ASCII-Schreibweisen (`UITestingScenario.swift`); `make check` = `ALL-PASS repository` auf `5ecc505`;
99 Frames gesichtet, sechs einzeln gelesen (018, 024, 032 + Kontaktbögen 0–3); beide Codex-Reviews;
`docs/PRODUCT.md` §Produktgrenze/§Golden Cases/§Brief 1–2; `ios-programs.json` (alle drei Records);
Private-repo-x-Zeilenzahlen und `Package.swift`-Historie (`git log --follow`).

**Abgeleitet:** die Frame-Zählung „~30 von 99 Springboard/Weiß" stammt aus den Kontaktbögen per Auge,
nicht aus einer Bildmetrik · dass die Demo-Zahlen informationsfrei sind, folgt aus `DemoRun` +
`StageMeasures`, gemessen habe ich es nicht · dass ein Vorlagen-Katalog in derselben Zeit machbar
gewesen wäre, ist eine Schätzung aus dem Umfang von `WorkflowPackBuilder.compose` (260 Z. für eine
Vorlage).

**Nicht geprüft:** die App nie selbst bedient (kein Simulator, per Brief verboten) — alle Aussagen
über Bedienbarkeit stammen aus Code + Videoframes · `make verify`/`review` nicht gefahren, die
53/59/5-Zahlen sind aus dem Review-Receipt zitiert, nicht neu gemessen · `WorkflowPackValidator.swift`
(732 Z.) nur überflogen, die Contradiction-Regeln nicht selbst nachvollzogen (der Re-Review führt
dort ein offenes HIGH) · `artifacts/verification/*` nicht gelesen · `Private-repo-x/`-Tests nicht
gelesen · keine Transkripte (Strang-fremd).

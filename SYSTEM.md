# Claude Fleet — Systemmodell

Status: **Owner-ausgerichtetes Zielbild.** Dieses Dokument beschreibt die stabile Semantik, auf
die Fleet hin entwickelt wird. Es behauptet nicht, dass jede Kante bereits implementiert ist. Der
gemessene Ist-Befund und die bekannten Abweichungen stehen in
`docs/kontextschicht-analyse-2026-08-20.md`.

`SYSTEM.md` ist die kurze mentale Karte des Produkts. `AGENTS.md` bleibt der portable normative
Arbeitsvertrag; `rulebook/*.md` bleibt das private operative Overlay; Code, Ledger und Live-Sensoren
entscheiden, was heute tatsächlich existiert. Routen, Harness-Matrizen und Featureinventare gehören
nicht handgepflegt hierher, sondern später in eine aus Code generierte Capability-Sicht.

## Produktversprechen

Claude Fleet vermittelt Arbeit, Wissen, Spezialisten und Ergebnisse zwischen Owner, Projekten und
Coding Agents. Fleet startet nicht nur Sessions. Es soll:

1. das Ziel des Owners in adressierbare Arbeit übersetzen;
2. jeder Agenteninstanz nur den nötigen, aber vollständigen Kontext geben;
3. Arbeit über klar benannte Funktionen delegieren, beobachten und zurückführen;
4. Fragen, Entscheidungen, Artefakte und Belege dauerhaft miteinander verbinden;
5. dem Owner in der UI einen ehrlichen Projekt- und Arbeitsstand zeigen;
6. Modell, Harness und Kontext nach dem Act auswählen, nicht nach Gewohnheit.

Fleet ersetzt dabei weder Owner-Entscheidungen noch unabhängige Verifikation. Mehr Agenten sind nur
dann ein Gewinn, wenn Zuständigkeit, Kontext, Rückweg und Ergebnis klarer werden.

## Rollenmodell

```text
Owner
  <-> Fleet Controller
        <-> Project MAIN
              <-> Worker-Lanes

Supervisor beobachtet quer dazu Zustände und Ereignisse.
```

Diese vier sichtbaren Rollen bilden nur zwei Autoritätsklassen: **Coordinator** halten Ziele,
Entscheidungen und Act-Reihenfolgen zusammen; **Specialists** bearbeiten genau einen begrenzten Act.
Fleet Controller und Project MAIN sind Coordinator mit verschiedenem Scope. Worker sind Specialists.
Der Supervisor ist ein beobachtender Coordinator beziehungsweise deterministischer Sensor mit
optionalem Digest-Specialist. Research, Build, Repair, Critique und Tasting sind Specialist-Modi,
keine neuen dauerhaften Autoritäten.

### Fleet Controller

Der Fleet Controller ist die owner-facing Session. Er versteht Prioritäten über Projekte hinweg,
startet oder adressiert Project MAINs und aggregiert Fragen, Fortschritt, Risiken und Ergebnisse für
den Owner. Er soll nicht die Detailarbeit jeder Lane selbst steuern.

### Project MAIN

Eine Project MAIN besitzt den Arbeitszusammenhang eines Projekts oder Programs. Sie kennt dessen
Ziel, autoritative Wissensquellen, aktive Acts und offenen Entscheidungen. Sie zerlegt Arbeit,
wählt benötigte Fähigkeiten, delegiert und führt Ergebnisse wieder zusammen.

### Worker

Ein Worker bearbeitet einen begrenzten Act. Er kann interaktiv in einer Lane oder headless laufen
und je nach Act bauen, analysieren, kritisieren, reparieren, verifizieren oder testen. Ein komplexer
Worker darf als **Act Lead** Child-Acts erzeugen; dafür braucht Fleet keine weitere permanente
Hierarchiestufe oder eigene „Fable-MAIN“-Rolle.

### Supervisor

Ein Supervisor beobachtet Sessions, Acts, Fragen, Fristen und Belegketten. Er erkennt Stillstand,
fehlende Zustellung und widersprüchliche Zustände und nudged den zuständigen Principal. Er ist keine
zweite Owner-Stimme und keine zusätzliche Befehlsebene. Falls später mehrere spezialisierte
Supervisoren nötig sind, teilen sie dieselbe Rolle und unterscheiden sich nur durch Watch-Scope und
Capability-Profil.

## Vier verbindende Kernobjekte

### `AgentInstance`

Die konkrete laufende Agenteninstanz. Ein Slot ist nur ein wiederverwendbarer Sitz. Wenn Process,
Session oder Occupant wechselt, ist das eine neue `AgentInstance`; alter Kontext darf ihr nicht
zugerechnet werden. Eine neue Instanz beginnt `unbriefed`, bis ihr Bootstrap beobachtbar zugestellt
wurde.

### `Act`

Die kleinste adressierbare Arbeitseinheit. Ein Act trägt mindestens:

- Projekt/Program und optionalen Parent-Act;
- Ziel und Bedeutung für das Endergebnis;
- benötigte Fähigkeiten sowie gewählten Principal;
- Eingaben und Kontextzeiger;
- erlaubten Modus und exklusives Write-Set;
- Done- und Proof-Kriterium;
- Frage-, Ergebnis- und Wake-Ziel;
- Status, Artefakte, Fragen und Resultat.

Acts bilden einen Graphen, keinen erzwungenen linearen Prozess. gameStudio-Schritte wie Kriterien,
Build, Kritik, Reparatur, Verify und Tasting sind `kind`-Varianten desselben Objekts. Sie dürfen
parallel, wiederholt, übersprungen oder an verschiedene Agents delegiert werden. Das Ergebnis bleibt
wichtiger als das vollständige Durchlaufen einer Schablone.

Ein **Attempt** bindet genau einen Ausführungsversuch des Acts an genau eine `AgentInstance`.
`actId` bleibt über Retry oder Succession stabil; jeder neue Versuch bekommt eine neue `attemptId`.
Attempt ist damit die ausführbare Verbindung der Kernobjekte, keine weitere Rollen- oder
Wissensschicht.

### `ContextEnvelope`

Der für genau eine `AgentInstance` und einen Act gebaute Kontextvertrag. Er entscheidet explizit:

- Rolle, Mission, Authority und Stop-Grenze;
- verfügbare Fleet-Funktionen und Rückkanal;
- relevante Projektquellen und ausgewählte Context Packs;
- konkreten Act-Brief, Outputform und Proof;
- ausgewählte **und ausgelassene** Kontextquellen;
- Zielinstanz und Renderer-/Schemaversion.

Ein ContextEnvelope ist kleiner als das gesamte Projektwissen. Es macht tieferes Wissen gezielt
auffindbar, statt es vollständig in den Startprompt zu kopieren.

### `Trace`

Eine append-only Belegkette für den Lebenszyklus eines Acts. Sie verbindet mindestens:

- gebauten ContextEnvelope und Ziel-`AgentInstance`;
- Transportversuch und beobachtbaren Zustellstatus;
- Fragen, Antworten, Watches und Nudges;
- Child-Acts und Rückgaben;
- Ergebnis, Artefakte, Commit und Verify;
- optional Land, Audit und Owner-Entscheidung.

Fleet unterscheidet dabei ehrliche Evidenzstufen. Ein erfolgreicher Paste-Vorgang beweist Transport,
nicht Verständnis. Normaler Produktbetrieb verlangt keine Überwachung innerer Modellzustände: Es
genügt, Konstruktion, Zielinstanz, beobachtete Zustellung, wichtige Acknowledgements und Resultate
korrekt zu erfassen.

### Promotion als Policy, nicht als Agentenurteil

Der Owner muss nicht jeden Routine-Diff selbst prüfen. Er promoviert stattdessen die bindende
`PromotionPolicy`: welche Klassen Fleet automatisch weiterführen darf, welche Belege dafür frisch
vorliegen müssen und welche Fälle immer eskalieren. Ein konkreter Land kann dadurch entweder auf
einen benannten Owner-Akt oder auf eine benannte, zuvor vom Owner promovierte Policy zurückgehen.

Vor jedem Land wird der konkrete `LandCandidate` unveränderlich gebunden: mindestens Main-SHA,
Candidate-SHA beziehungsweise Lane-Tip, Tree-/Diff-Identität und Verify-Lauf. Die konkrete
Landentscheidung referenziert zusätzlich die angewandte Policy-Version. Ändert sich einer dieser
Gegenstände, sind frühere Bewertungen stale und dürfen nicht verwendet werden. Ein ephemerer
read-only Merge Critic kann `no-objection`, `needs-human` oder `unknown` liefern. Er liefert Evidenz
innerhalb der Policy; er promoviert, landet und deployt niemals selbst. Geschmack,
Richtungsfragen, unbekannte Messungen und von der Policy benannte Hochrisikofälle gehen weiterhin
an den Owner.

## Kontextschichten

Kontext wird von stabil und allgemein nach konkret und flüchtig aufgebaut:

1. **Portable Core** — gemeinsame Begriffe, Authority und Invarianten aus `AGENTS.md`.
2. **Role Bootstrap** — Rolle, Mission, Capabilities, Rückkanal und Done-/Wake-Vertrag.
3. **Project Context** — Produktbild und Zeiger auf autoritative Projektquellen.
4. **Context Packs** — selektive Vertiefungen für Rolle, Act, Harness und Capability.
5. **Act Brief** — konkretes Ziel, Inputs, Output, Proof und Grenzen.
6. **Runtime Context** — neue Evidenz, Fragen, Antworten, Nudges und Child-Act-Ergebnisse.

Context Packs sind Auswahlmechanismen, kein zweiter Wissensspeicher. Sie sollen an jeder relevanten
Gründungs- und Delegationsnaht verwendbar sein, aber nicht pauschal an jede Session gehen. Der
Planner entscheidet aus `{role, act, project, harness, capabilities}`. Ein Restart baut für die neue
AgentInstance erneut mindestens Role Bootstrap und aktiven Act-Brief.

## Funktionen statt Routenwissen

Agenten sollen Fleet über wenige stabile, typisierte Funktionen benutzen. Die konkrete HTTP-, MCP-
oder lokale Transportform ist ein Adapterdetail. Das angestrebte minimale Vokabular ist:

- `describe_self` — Identität, Rolle, Authority, Capabilities und aktiver Act;
- `get_project_context` — autoritative Projektquellen und selektierbare Packs;
- `get_act` — Brief, Inputs, Grenzen, Fragen, Status und Proof;
- `delegate_act` — einen begrenzten Child-Act an einen geeigneten Principal geben;
- `ask_question` — eine adressierte, haltbare Frage mit Wake-Ziel öffnen;
- `watch_act` — auf ein benanntes Ereignis oder Terminalprädikat warten;
- `report_result` — Ergebnis, Artefakte, Unsicherheiten und Belege zurückführen;
- `verify_result` — den vorgesehenen Proof ausführen oder referenzieren.

Eine zentrale Capability-Registry soll später für jede Funktion Rolle, Autorität, Zustandswirkung,
UI-Geste, Route/Adapter, Harness-Support und Probe definieren. Aus derselben Quelle werden Agenten-
Toolbeschreibungen, die lesbare Capability-Karte und Freshness-Checks erzeugt. So können Dokument,
UI, Runtime und Berechtigungsmodell nicht unabhängig auseinanderdriften.

Clarification ist dabei ein typisierter Request-Zustand eines Acts, nicht zwingend eine eigene
Sessionrolle. Steward-Fakten sollen soweit möglich deterministische Sensoren liefern; für einen
Digest kann bei Bedarf ein temporärer Specialist laufen. Verify- und Land-Gates bleiben Maschinen,
nicht Agentenrollen.

## Ende-zu-Ende-Lebenszyklus

1. Der Owner formuliert Ziel, Grenze und gewünschtes Ergebnis gegenüber dem Fleet Controller.
2. Der Controller bindet oder gründet eine Project MAIN und übergibt ein ContextEnvelope.
3. Die Project MAIN erzeugt den kleinsten Act, der einen überprüfbaren Fortschritt liefert.
4. Fleet wählt einen Principal anhand benötigter Capabilities; Modell und Harness sind Teile dieser
   Entscheidung, keine eigene Hierarchiestufe.
5. Der Worker erhält das Act-spezifische ContextEnvelope und arbeitet innerhalb seiner Authority.
6. Blockierende Fragen werden als adressierte Objekte zugestellt und wecken nach Antwort den
   richtigen Requester.
7. Resultat, Artefakte und Proof laufen über denselben Act zur Project MAIN zurück.
8. Supervisor und Fleet Controller aggregieren nur belegte Zustände. Der Server führt einen Land
   nur nach frischem Recheck unter einer owner-promovierten Policy oder einem konkreten Owner-Akt
   aus; Tasting, Policy-Ausnahmen, Hochrisiko und Richtungswechsel bleiben beim Owner. Deploy ist
   davon getrennt.

## UI als Arbeits- und Beobachtungsfläche

Die UI wird aus Project-, Act-, AgentInstance- und Trace-Zuständen aufgebaut, nicht aus frei
interpretiertem Terminaltext. Der Owner soll von außen nach innen navigieren können:

```text
Projekte -> aktive Acts -> zuständige Agenten -> Fragen/Ergebnisse -> Artefakte/Commits -> Proof
```

Terminals bleiben für direkte Interaktion wichtig, sind aber nicht die einzige Zustandsquelle. Der
rechte Tab braucht deshalb sowohl solide Grundnavigation — anklickbare Commits, echten File Explorer,
Suche und Tastaturbedienung — als auch später Programbindung, ContextEnvelope-/Trace-Stand, offene
Fragen, Wake-Zustand und Verify-/Land-Fakten einschließlich Candidate-, Policy- und Critic-
Provenienz.

## Wissensordnung

- `README.md` erklärt öffentlich Produktversprechen, Einstieg und sichtbare Nutzung.
- `SYSTEM.md` erklärt das stabile Rollen-, Objekt- und Lebenszyklusmodell.
- `AGENTS.md` ist der portable normative Arbeitsvertrag.
- `rulebook/*.md` erzeugt das private operative Overlay.
- Die geplante Capability-Registry im Code ist die ausführbare Featurewahrheit; ihre Dokumentansicht
  wird generiert und nie handgeschrieben.
- Context Packs zeigen auf bestehende Quellen; sie kopieren diese nicht.
- Datierten Analysen und Audits sind Snapshots mit Tree und Messzeitpunkt, keine laufend
  nachgeschriebene Systemwahrheit.
- Commit-Bodies und lokale Codekommentare bewahren Begründung und Historie an der Änderung.

Ausdrücklich nicht vorgesehen sind getrennte Rollenhandbücher, eine handgeschriebene
Rolle-mal-Harness-Matrix, ein zweites Context-Pack-Register oder weitere „Stand heute“-Summaries.

## Implementierungsgrenze

Dieses Zielbild autorisiert noch keinen Umbau von Loader, Briefcompiler, Sessionstart oder
Zustellwegen. Umsetzung erfolgt outside-in in kleinen vertikalen Acts: zuerst Owner-Journey und
sichtbare Abnahme, dann das kleinste Domain-/Funktionsstück, dann echte Agenten- und Browser-Canaries.
Der datierte Program Brief nennt Reihenfolge, Agentenbriefs und Stop-Grenzen.

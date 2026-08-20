# Claude Fleet — Outside-in-Programm für Schichten & Tools

Status: **Owner-ausgerichteter Program Brief, noch nicht implementiert.**  
Befundbasis: Tree `db35dc6e5a5c`, ergänzt durch read-only Code-/Pane-/Ledger-Messungen am
2026-08-20. Spätere Umsetzung muss jede Ist-Aussage am dann aktuellen Tree neu prüfen.

Dieser Brief übersetzt `SYSTEM.md` in einen ausführbaren, schrittweise promovierbaren Bauplan. Er
ist kein weiteres Regelbuch und keine Beschreibung des heutigen Runtime-Stands. Aktuelle Befunde
und Abweichungen stehen in `docs/kontextschicht-analyse-2026-08-20.md`. Loader, Briefcompiler,
Sessionstart und Zustellwege bleiben unverändert, bis der jeweilige Act belegt und vom Owner
freigegeben ist.

## 1. Owner-Ziel

Fleet soll Arbeit und Wissen zwischen Owner, Projekten und unterschiedlichen Agents zuverlässig
vermitteln. Ein Owner-facing Controller hält die Gesamtperspektive. Eine Project MAIN versteht und
koordiniert genau ihr Projekt oder Program. Sie kann begrenzte Arbeitsschritte an Claude-, Codex-,
Sol-, GLM- oder spätere Agents delegieren. Ein Supervisor beobachtet quer dazu Stillstand und
fehlende Zustellung. Fleet erfasst die entstehenden Fakten und aggregiert sie so, dass die UI für
den Nutzer einen ehrlichen, verständlichen Arbeitsstand zeigt.

Das Ziel ist ausdrücklich **nicht**, möglichst viele Agentenebenen zu schaffen. Komplexe Arbeit darf
verschachtelt delegiert werden; dafür erzeugt ein Act Lead Child-Acts, keine neue dauerhafte
Rollenklasse.

## 2. Drei sichtbare Journeys

### Journey A — der Owner untersucht eine Session

1. Der Owner wählt eine Session oder Lane.
2. Ein Klick auf einen Commit öffnet exakt diesen Hash mit Dateien und Diff.
3. „Files in this repo“ ist ein echter Explorer: Ordner öffnen, nach Pfad suchen, Datei öffnen,
   Revision erkennen und nach Refresh an derselben Stelle bleiben.
4. Fehler, gecappte Bäume, ungetrackte Änderungen und fehlende Git-Daten sehen nicht wie leere
   Ergebnisse aus.

Diese Journey wird im echten Browser abgenommen. Source-Strings allein beweisen sie nicht.

### Journey B — der Owner verteilt Studio-Arbeit auf verschiedene Agents

1. Der Owner öffnet ein Projekt oder Program und sieht Mission, gebundene Project MAIN, aktive
   Acts, Agenteninstanzen, offene Fragen und die letzten belegten Ergebnisse.
2. Die Project MAIN legt einen begrenzten Act an und wählt benötigte Capabilities. Modell und
   Harness werden explizit oder durch eine nachvollziehbare Routing-Hypothese ausgewählt.
3. Der Worker erkennt Rolle, Authority, Objekt, Done/Proof, Fleet-Funktionen und Rückkanal, ohne
   `server.ts` linear zu lesen.
4. Eine Blockade wird als adressierte Frage mit Subject und Reply-Ziel erzeugt. Die Antwort weckt
   exakt den zugehörigen Attempt.
5. Ergebnis, Artefakte, Commit und Verify laufen zum Act zurück. Ein frischer Critic kann das
   Ergebnis unabhängig prüfen. Der Owner entscheidet Tasting und Promotion.
6. Die UI trennt ehrlich gebauten Kontext, Transport, beobachtete Zustellung, Acknowledgement,
   Resultat und weiterhin unbekannte Stufen.

### Journey C — ein Agent wird ersetzt

1. Eine laufende Instanz endet, wird restarted, resumed oder durch Succession ersetzt.
2. Der Slot darf bestehen bleiben; die neue `AgentInstance` beziehungsweise der neue `Attempt`
   erhält aber eine neue Identität.
3. Alte Receipts gelten nicht automatisch für die neue Instanz. Sie beginnt `unbriefed` und erhält
   mindestens Role Bootstrap und aktiven Act erneut.
4. UI und Trace zeigen den Wechsel statt scheinbarer Kontinuität.

## 3. Arbeitsmodell für Agents

Die sichtbaren Produktrollen aus `SYSTEM.md` reduzieren sich auf zwei Autoritätsklassen:

| Klasse | Lebensdauer | Aufgabe | Mutation |
|---|---|---|---|
| **Coordinator** | langlebig | Ziel, Entscheidungen, Fragen und Act-Reihenfolge zusammenhalten | Program-/Act-Zustand; Produktcode nur als eigener geleaster Act |
| **Specialist** | genau ein Act | untersuchen, bauen, reparieren, kritisieren oder testen | nur bei mutierendem Act und nur im exklusiven Write-Set |

- Fleet Controller und Project MAIN sind Coordinator mit unterschiedlichem Scope.
- Supervisor ist ein beobachtender Coordinator beziehungsweise deterministischer Sensor plus
  optionaler Digest-Specialist. Er ist keine parallele Owner-Autorität.
- Builder, Researcher, Context Cartographer, Browser-Taster, Visual Critic und Reviewer sind Modi
  temporärer Specialists, keine dauerhaften Rollen.
- Clarification ist ein Zustand und ein Request-Objekt, keine notwendige Sessionart. Eine
  Clarify-Lane wird nur gegründet, wenn wirklich unabhängige Recherche nötig ist.
- Verify- und Land-Gates sind Maschinen. Ein Agent darf Evidenz interpretieren, ersetzt das Gate
  aber nicht.

## 4. Welche Agents dieses Programm braucht

### Program Coordinator

Genau eine Project MAIN hält dieses Program zusammen. Sie baut standardmäßig keinen Produktcode,
führt keine Selbstreviews durch und kopiert keine freien Agentenzusammenfassungen als Wahrheit. Sie
erzeugt Acts, vergibt Write-Leases, verwaltet Entscheidungen und führt belegte Results zusammen.

### UI Journey Specialist

Besitzt für seinen Act exklusiv `src/client.ts` und unmittelbar gekoppelte UI-Flächen. Er beginnt
mit echtem Browser-, Bundle- und Request-Befund. Vorhandene Explorer-, File-View- und Review-
Mechanik wird wiederverwendet.

### Domain/Protocol Specialist

Besitzt die Typen und pure Projektion für `AgentInstance`, `Act`, `Attempt`, `ContextEnvelope`,
`Request`, `Result` und `Trace`. Er extrahiert nur, was der aktuelle vertikale Act benötigt; kein
allgemeiner `server.ts`-Refactor.

### Context/Runtime Specialist

Besitzt eine exakt benannte Bootstrap-/Brief-/Receipt-Naht. Er verbindet Role Bootstrap,
Capability-Auswahl und Zielinstanz, ohne Ambient-Loader oder alle Rollen gleichzeitig umzubauen.

### Harness Canary Specialists

Echte Claude-, Codex- und Pi/GLM-Sessions bearbeiten denselben harmlosen, schema-validierten Act.
Sie ändern im Canary keinen Produktcode. Gemessen werden Discovery, Rollenverständnis, erlaubte
Fleet-Funktion, Rückgabeform, Latenz und Fehler – nicht die Selbsteinschätzung des Modells.

### Independent Critic und Browser Verifier

Ein frischer read-only Specialist erhält Ziel, Nichtziele, Primärartefakte und Proof, aber zunächst
nicht die Builder-Selbsterklärung. UI-Claims werden am Browserartefakt, nicht am Source allein
geprüft. Kleine vollständig deterministische Änderungen benötigen keinen zeremoniellen LLM-Critic.

### Modellwahl

Modellnamen sind Routing-Hypothesen, keine Rollen. Der Act nennt benötigtes Fenster, Modalität,
Tools, Rechte, Transcript-/Ack-Bedarf und Qualitätsrisiko. GLM hat sich in dieser Analyse als starker
adversarialer Code-/Kontextleser erwiesen; Opus ist ein Kandidat für mehrdeutige Produkt- oder
Direction-Arbeit; coding-orientierte Modelle sind Kandidaten für begrenzte Builder-Acts. Keine
dieser Annahmen wird Default, bevor der gleiche Act sie im Canary trägt.

## 5. Ein Briefschema, viele Renderings

Jeder Specialist arbeitet aus einem strukturierten Act, aus dem Fleet die harnessgerechte Fassung
rendert. Der Brief enthält mindestens:

```yaml
schema: fleet.act/v1
trace: { programId, actId, parentActId, attemptId }
role: { principal, mode }
goal: { importance, observableOutcome, successCriterion, nonGoals }
subject: { repo, baseHead, objects, inputArtifacts }
authority: { mode, writeSet, forbidden, externalActions }
context: { decisionRefs, packRefs, requiredAnchors, omitted }
capabilityRequirements: { tools, modalities, runtime }
routingHypothesis: { harness, model, reason, fallback }
proof: []
output: { schema, artifacts, commitRequired }
communication: { questionRecipient, replyTo, stopConditions, wakeOn }
```

Der gerenderte Prompt enthält nur portablen Kern, relevanten Program-Ausschnitt, den Act,
ausgewählte Quellen, aktuelle Live-Fakten und Output-/Kommunikationsvertrag. Er enthält nicht die
gesamte Queue, rohe Vorgängertranscripts, alle Context Packs oder fremde Acts.

Ein Specialist antwortet typisiert:

```yaml
status: complete | blocked | needs-decision | failed
claims: [{ claim, evidenceRefs }]
changed: { baseHead, head, files }
proofRuns: [{ command, exit, resultRef }]
artifacts: [{ id, sha256, pathOrUri }]
unknowns: []
questions: []
proposedNextAct: null
```

Owner-Entscheidungen werden einmal gespeichert und per `decisionId` referenziert. Folge-Agents
bekommen Primärartefakte und Hashes, nicht eine Kette freier Paraphrasen. Kürzung und Omission sind
sichtbar; fehlende Ausgabe ist `missing`, nicht „nichts gefunden“.

## 6. Outside-in-Reihenfolge

Jeder Act ist einzeln review- und landbar. Acts 1 und 2 dürfen parallel laufen, weil ihre
Mutationsflächen getrennt sind. Danach gilt grundsätzlich `3 -> 4 -> 5 -> 6 -> 7`. `server.ts` und
`src/client.ts` gehören jeweils höchstens einem mutierenden Act gleichzeitig.

### Act 1 — UI-Grundbedienung

**Outcome:** Journey A funktioniert im echten Browser: Commit-Klick, echter Explorer, Suche,
Dateiansicht, Tastatur und stabiler Refresh.

**Agent:** UI Journey Specialist; unabhängiger Browser Verifier.

**Write-Set:** `src/client.ts`, unmittelbar gekoppelte Shell-/HTML-Flächen und eine isolierte
Browser-Spec. Keine Program-, Context-, Server- oder Loader-Änderung. Zeigt die Vorprüfung einen
reinen Bundle-/Deploy-Skew, endet der Act bei genau diesem Befund oder Fix.

**Proof:** echter Browser gegen sichere Fixture; exakten Commit öffnen, Ordner expandieren, filtern,
Datei öffnen, Refresh abwarten und Zustand prüfen. Fehler- und Cap-Zustände separat prüfen.

### Act 2 — ausführbare Capability-Quelle

**Outcome:** Eine fremde MAIN kann eine erlaubte Fleet-Funktion finden, ohne Monolithen linear zu
lesen. Rollen-, UI-, API-, Trace- und Harness-Aussage entstehen aus einer Quelle.

**Agent:** Domain/Protocol Specialist; read-only Foreign-MAIN-Canary.

**Write-Set:** zunächst ein enger Registry-/Generator-Schnitt nahe `src/protocol.ts`, die generierte
`docs/system-capabilities.generated.md` und der zugehörige Freshness-Pin. `SYSTEM.md` wird nur
geändert, wenn Objekt- oder Rollensemantik betroffen ist.

**Proof:** deterministischer Generator; der Tree ist bytegenau frisch; Routen/Symbole lösen auf;
Foreign MAIN findet Rolle, Authority, Rückkanal und einen sicheren GET ausschließlich über
`SYSTEM.md` plus generierte Projektion.

**Stop:** noch kein Link aus Auto-Loadern und keine Änderung an `AGENTS.md`, Rulebook oder Briefen.

### Act 3 — read-only Project-/Program-Projektion

**Outcome:** Journey B beginnt sichtbar. Die UI zeigt für ein gewähltes Program Mission, gebundene
MAIN, effektiven Harness/Modell, AgentInstance, Brief-/Receipt-Provenienz, offene Requests und
ehrliche UNKNOWNs.

**Agent:** zuerst Domain Projection Specialist, danach seriell UI Journey Specialist.

**Write-Set:** kleine pure Projektion und Protokoll; nur die benannten Read-Endpunkte im Server;
danach Program-Detail in `src/client.ts`. Keine Lifecycle- oder Dispatch-Mutation.

**Proof:** API-Fixtures für Restart, Occupant-Wechsel und malformed Ledgerzeilen; Browser zeigt
dieselbe Projektion. Ein Slot ohne belegten aktuellen Brief erscheint `unbriefed/unknown`.

### Act 4 — `Program -> Act -> Attempt` als minimale Datenspur

**Outcome:** Genau ein Studio-Act kann angelegt, einer AgentInstance zugewiesen, beantwortet und als
Result zurückgeführt werden. Retry erzeugt einen neuen Attempt, ohne alten Briefingstatus zu erben.

**Agent:** Domain/Protocol Specialist und danach ein Runtime Specialist; frischer read-only Critic.

**Write-Set:** Protokoll und eine kleine neue Domainfläche; im Monolithen nur exakt benannte
Persistenz-/Handler-Nähte; passende bestehende E2E-Familie. Kein vollständiger Program-Umbau.

**Proof:** Contract- und API-Eval für Create, Assign, Result, Retry und malformed state. Dieselbe
`traceId` verbindet Envelope, Request, Result und Proof; `attemptId` plus Occupant-Identität trennt
Retries.

### Act 5 — Role Bootstrap und Fleet-Funktionen

**Outcome:** Project MAIN und ein Worker bekommen jeweils den kleinsten expliziten Vertrag:
Identität, Mission, Authority, aktiver Act, erlaubte Funktionen, Rückkanal und Quellenanker.

**Agent:** Context/Runtime Specialist; reale Claude-, Codex- und GLM-Canaries.

**Write-Set:** eine benannte ContextEnvelope-/Role-Context-Domain und genau die benötigten Boot-/
Brief-Builder. Ambient-Loader bleiben unverändert.

**Proof:** Jede echte Session beantwortet vor Codearchäologie dieselbe Rollenprüfung, benutzt genau
einen erlaubten sicheren Fleet-GET und liefert ein schema-valides Result. Receipt bindet an den
Attempt. Ein fehlgeschlagener Canary erweitert nicht automatisch alle Briefs.

### Act 6 — Harnesswahl und adressierte Frage

**Outcome:** Eine Project MAIN kann zwei Child-Acts bewusst verschiedenen Harnesses/Modellen geben.
Eine blockierende Frage trägt Act, Subject, Receiver und Reply-Ziel; die Antwort weckt den richtigen
Attempt.

**Agent:** Dispatch/Runtime Specialist; je ein harmloser Harness Canary.

**Write-Set:** Task-/Dispatch-/Harness-Registry-Nähte und bestehende Task-/Harness-/Watch-Tests;
danach seriell der schmale UI-Composer. Keine automatische „bestes Modell“-Heuristik.

**Proof:** identischer sicherer Act an mindestens zwei echte Harnesses; gewähltes und effektives
Routing, ContextEnvelope und Result stimmen. Ungültige Capability-Kombination wird sichtbar
abgelehnt. Frage und Antwort joinen über dieselbe Request-/Act-/Attempt-Identität.

### Act 7 — gameStudio-Feuerprobe

**Outcome:** Eine kleine reale Studio-Schleife läuft Ende zu Ende: Kriterien -> zwei getrennte
Specialist-Acts -> unabhängige Kritik -> gegebenenfalls Reparatur -> Verify -> Owner-Tasting. Die UI
zeigt Acts, Agenten, Fragen, Artefakte und Proof aus denselben Daten.

**Agent:** Project MAIN als Coordinator; Specialists nach Bedarf; frischer Critic; Owner entscheidet
Tasting. Supervisor nur als Watcher.

**Write-Set:** zunächst keines im Fleet-Produktbaum. Der Canary läuft in einem sicheren Projekt oder
Wegwerf-Repo. Ein gefundener Defekt wird als neuer enger Reparatur-Act geschnitten und nicht während
der Probe zum Großumbau erweitert.

**Proof:** feste Aufgabe und Rubrik vor Start; Time-to-first-valid-action, Rückfragen, stille
Wanduhr, Reparaturrunden, Ergebnisqualität und Owner-Tasting werden erfasst. Resume, Restart und
Succession werden separat mit Kontextmarke A/B geprüft.

## 7. Mutations-, Review- und Promotion-Regeln

- Ein mutierender Act besitzt genau eine Lane, einen `baseHead` und ein exklusives Lease auf
  benannte Konfliktdomänen. Protokoll plus Consumer oder Schema plus Persistenz zählen gemeinsam.
- Read-only Specialists dürfen parallel arbeiten. Zwei Builder auf derselben UI-, Feel- oder
  Zustellnaht sind verboten, selbst wenn Dateigloben nicht überlappen.
- Write-Set-Erweiterung wird vorgeschlagen und neu geleast, nicht still genommen.
- Coordinator darf einen winzigen Builder-Act übernehmen, darf ihn danach aber nicht selbst
  reviewen.
- Deterministische Proofs laufen vor LLM-Review. Review-Aufwand folgt dem Risiko.
- Commit zeichnet Arbeit auf. Land und Deploy bleiben getrennte Owner-/Server-Promotionen.
- Jeder Act endet an seiner Stop-Grenze. Ein neuer Befund wird ein neuer Act.

## 8. Dokument- und Wissenslandschaft

Fleet soll dauerhaft nur diese Verantwortungen tragen:

| Quelle | Verantwortung |
|---|---|
| `README.md` | öffentliche Landingpage, Produktversprechen und Einstieg |
| `SYSTEM.md` | stabiles Rollen-, Objekt- und Lebenszyklusmodell |
| `AGENTS.md` | portabler normativer Arbeitsvertrag |
| `rulebook/*.md` -> `CLAUDE.md` | privates operatives Overlay; Generat nie handändern |
| Capability-Registry -> `docs/system-capabilities.generated.md` | ausführbare und deterministisch gerenderte Feature-/Rollenwahrheit |
| Program/Act/Trace | Owner-Ziel, laufende Arbeit und Belegkette |
| datierte Audits/Analysen | unveränderliche Mess-Snapshots mit Tree, Scope und `supersededBy` |

`docs/README.md` bleibt nur Router und muss Vollständigkeit mechanisch prüfen. Context Packs wählen
Quellen; sie werden kein zweites Register. Externe Videos oder Research erhalten vor Promotion
Source-ID, Zeitpunkt, Hash, Extraktionsweg, Claim und lokalen Gegenbeleg; Rohmaterial und private
Details bleiben privat.

Nicht anlegen: eigene Handbücher je Rolle/Harness, manuelle Capability-Matrix, weitere „Stand
heute“-Summary, Promptkopien pro Modell oder ein zweites Context-Pack-/Skill-Register.

## 9. Gefährliche Abkürzungen

- God-MAIN: planen, bauen, reviewen und das eigene Ergebnis abnehmen.
- permanente Rollenflotte statt temporärer Specialist-Acts;
- Slot als Agentenidentität behandeln;
- `sent` mit gelesen oder verstanden gleichsetzen;
- Modellname als Capability-Beweis verwenden;
- Kontext durch Summary-Stapel von Agent zu Agent reichen;
- Owner-Frage ohne Subject, Receiver und Reply-Ziel;
- Context Pack als globalen Wissensmüllplatz verwenden;
- UI aus Terminalprosa statt aus typisierten Zuständen ableiten;
- Browserclaims mit Source-Regex und Modellclaims mit Fake-Harnesses abnehmen;
- Loader-Umbau vor dem ersten vertikalen Canary.

## 10. Founding Brief für die nächste Program MAIN

```text
Du koordinierst das owner-ausgerichtete Outside-in-Programm für Claude Fleet. Lies `SYSTEM.md` als
Zielmodell und `docs/agentic-control-plane-program-2026-08-20.md` als Program Brief. Der gemessene
Ist-Befund in `docs/kontextschicht-analyse-2026-08-20.md` ist Evidence, keine unfehlbare Spezifikation.

Dein Auftrag ist zunächst Koordination, nicht ein Big-Bang-Umbau. Lege die sieben Acts aus dem
Program Brief mit ihren Outcomes, Write-Sets, Proofs und Stop-Grenzen an. Prüfe vor Start jedes Acts
den aktuellen Code und Live-Sensor; markiere Abweichungen VERIFIED, CODE-ONLY, STALE oder UNKNOWN.

Starte Act 1 (UI-Grundbedienung) und Act 2 (Capability-Quelle) nur dann parallel, wenn zwei
mutierende Lanes nachweislich disjunkte Konfliktdomänen besitzen. Danach arbeite 3 -> 4 -> 5 -> 6 ->
7. `server.ts` und `src/client.ts` gehören jeweils höchstens einer mutierenden Lane gleichzeitig.

Nutze Specialists pro Act, keine permanente Agentenarmee. Modell und Harness sind begründete
Routing-Hypothesen und werden durch echte Canaries gemessen. Ein Specialist erhält nur seinen
strukturierten Act, Primärquellen, Authority, Rückkanal und Proof; kein rohes Program-Scrollback.

Vor Änderungen an Loader, `AGENTS.md`, Rulebook, Briefcompiler, Sessionstart oder Zustellwegen:
lege dem Owner den reproduzierten Ist-Befund, den genauen vertikalen Schnitt, seine UI-/Runtime-
Wirkung und den Canary vor und warte auf Freigabe. Nicht landen oder deployen ohne ausdrückliche
Autorität.

Done für deine erste Runde: Der Owner sieht die angelegten Acts, ihre Reihenfolge, Agentenwahl,
Write-Leases, Proofs und offenen Promotionen; Act 1 und Act 2 besitzen ausführbare Briefs. Noch kein
Produktcode muss dafür geändert sein.
```

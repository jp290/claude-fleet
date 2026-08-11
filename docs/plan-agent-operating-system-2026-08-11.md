# Schlachtplan: das lernende Agent Operating System fuer Claude Fleet (2026-08-11)

*Programmplan und Gate-Vertrag. Quelle der Leitideen: das Rohtranskript des Videos
`e1snsuY4lTI`; Fleet-spezifische Ausformung gegen den heutigen Baum und seine gemessenen
Fehler. Dieses Dokument ist fuer die Uebergabe an eine neue MAIN-Session und fuer sauber
geschnittene Worker-/Lane-Auftraege geschrieben. Das Review in
`docs/feedback-plan-agent-operating-system-2026-08-11.md` ist in Reihenfolge, Messmodell und
Owner-Budget eingearbeitet.*

## 0. Owner-Auftrag, Ziel und harte Schnittlinie

Owner-Auftrag dieser Session, woertlich:

> "Bitte erstelle dann jetzt ein Schlachtplan-dokument mit dem wir diese Punkte sauber und
> vernuenftig angehen. Ueberleg wie du dieses Dokument aufsetzen, auch soweit treu und mit
> Beruecksichtigung der entnommenen Ideen, um es gleich in einer neuen Session und oder mit
> workern usw. vernuenftig angehen koennen. Ich denke das wir hier gross denken muessen und
> zum Teil features verlangen muessen die das ganze am ende ermoeglichen, robust machen, und
> tragen koennen."

**Das grosse Ziel:** Fleet wird nicht nur ein Dashboard, das Agenten startet und landet,
sondern ein **lernendes Betriebssystem fuer die Zusammenarbeit mit Agenten**. Es liefert jeder
Session genau den relevanten Arbeitskontext, kennt die verfuegbaren Faehigkeiten, macht ihre
Provenienz und Ergebnisse messbar, hilft Menschen durch gute Kommunikationsartefakte zu
entscheiden und verbessert Regeln/Skills aus echten, bestaetigten Fehlern.

**Die harte Schnittlinie:** Das Zielbild ist ein Programm; jeder Bauauftrag bleibt ein kleiner,
einzeln landbarer Schnitt. Dieser Plan ist **keine Freigabe, alle Features auf einmal zu bauen**.
Jede Phase endet an einem messbaren Gate. Die naechste Phase beginnt nur, wenn ihr eigener
Mehrwert die zusaetzliche dauerhafte Flaeche rechtfertigt. Gross denken, schmal landen.

**Backbone v1 endet nach Phase 4:** Dann sind Regelkontext, Provenienz, Capability-/Skill-Routing
und der manuelle Lernkreislauf real und messbar. Surface-Vertraege, Artefakte, Maschinen-Sync und
spaetere Automatisierung stehen im Zielbild, werden aber erst nach diesem Backbone einzeln
freigegeben. Eine Rangliste ohne diese Schnittlinie waere ein Portfolio, kein Plan
(`docs/scope-inflation.md`).

## 1. Wie eine neue Session dieses Dokument benutzt

1. Erdung wie im aktuellen Regelbuch: `./state.sh`, `./register.sh`, oberster Abschnitt von
   `HANDOFF.md`, dann dieses Dokument und `docs/plan-queue-refinement-2026-08-11.md`.
2. Den Statusblock in Abschnitt 14 aktualisieren: Was ist noch Vorschlag, was gebaut, was
   gemessen, was verworfen?
3. Immer nur **eine Phase** in konkrete Tasks kompilieren. Erst deren Owner-Gate bestaetigen.
4. Breite Bestandsaufnahmen duerfen an read-only Worker gehen. Jeder Worker besitzt eine eigene
   Ergebnisdatei; niemand editiert ein gemeinsames Zielartefakt parallel.
5. Aus einem Worker-Befund wird nicht automatisch Code. Die MAIN-Session synthetisiert,
   schneidet an der Owner-Vorgabe ab und schreibt erst dann einzelne Tasks mit Done+Verify.
6. Fremde Harness-Lanes produzieren; der Host committet und landet. Die Sandbox-Grenzen und der
   Codex-Dispatch-Boot-Race aus `CLAUDE.md` gelten unveraendert.
7. Dieses Dokument traegt Absicht, Abhaengigkeiten und Entscheidungen. Lebender Zustand bleibt
   abgeleitet (`state.sh`, `register.sh`, Queue, Ledgers), nicht hier nacherzaehlt.
8. Bei Widerspruch gilt der heutige Code-/Ledger-/Sensorbefund vor diesem Plan. Die uebernehmende
   Session korrigiert dann den Statusblock und den betroffenen Plansatz, statt die veraltete Prosa
   auszufuehren.

## 2. Die eine These, aus der das Programm folgt

Der Kern des Transkripts ist nicht "schreibe eine bessere AGENTS.md". Er ist ein geschlossener
Verbesserungskreis:

```text
reale Arbeit
  -> wiederkehrenden Fehler oder Kommunikationsbruch beobachten
  -> nach Task, Modell, Harness und Kontext quantifizieren
  -> das Gegenmittel an der schmalsten passenden Stelle verankern
  -> nur beim passenden Trigger und mit vorhandener Capability laden
  -> Scope, Stopppunkt und Verify vor der Ausfuehrung festlegen
  -> Ergebnis in der fuer den Menschen richtigen Form kommunizieren
  -> Wirkung auf den naechsten vergleichbaren Runs messen
  -> Regel/Skill behalten, korrigieren, teilen oder ausmustern
```

**Primaere Zielgroesse ist menschliche Entscheidbarkeit.** Mehr Agentendurchsatz hilft nicht,
wenn der Owner jede Ausgabe neu herleiten muss. Ein guter Lauf endet in einem landbaren Diff oder
einem klaren Befund, dessen Problem, Loesung, Beweis und offene Grenze in einem Blick erkennbar
sind. Codequalitaet, Kontextkosten und Automatisierung dienen diesem Ziel; sie ersetzen es nicht.

## 3. Nicht verhandelbare Konstruktionsregeln

Diese Regeln binden jede Phase und verhindern, dass das Lernsystem selbst zur naechsten
unkontrollierten Maschine wird.

1. **Beobachtungen vor Schlussfolgerungen.** Rohdaten bleiben erhalten; Modelllabels sind
   Vorschlaege. `unknown` wird nie zu `0`, `gut` oder `schlecht` gefaltet.
2. **Propose/promote.** Ein Worker darf Finding, Regel, Skill, Brief oder Sunset vorschlagen.
   Nur der Owner bestaetigt die bindende Fassung. Kein Tick editiert Regelbuecher.
3. **Eine Quelle pro Aussage.** Gemeinsame TS-Vertraege gehoeren nach `src/protocol.ts`,
   TS-zu-Nicht-TS-Paare nach `e2e/pins.ts`, betriebliche Wahrheit in abgeleitete Sensoren.
4. **Kontext wird geroutet, nicht angehaeuft.** Immer geladen wird nur der harte Kern. Alles
   Weitere hat Trigger, Scope, Kosten und eine ehrlich pruefbare Verfuegbarkeit.
5. **Capabilities fail-closed.** Ein Skill, Token, Browser, Netzwerk, tmux, Git-Schreibrecht oder
   Host-Service wird nur angekuendigt, wenn die Zielsession ihn wirklich hat.
6. **Fragen/Reviews/Diagnosen sind read-only.** Mutation braucht einen ausdruecklichen Auftrag;
   ein Stopppunkt bindet Commit, Land, Deploy und Maschinen-Sync.
7. **Ein Schnitt, ein Owner, ein Diff.** Parallelitaet ist fuer unabhaengige Flaechen oder
   adversarielle read-only Pruefung. File Ownership wird vor jedem Fan-out benannt.
8. **Keine zweite Queue, kein zweiter Wissensspeicher, kein zweites Dashboard.** Das Programm
   erweitert die bestehenden Task-, Doc-, Brief-, Comment-, Protocol- und Ledger-Flaechen.
9. **Privat bleibt privat.** Transkripte, Prompts, Tokens, lokale Maschinenidentitaet und
   Artefakte verlassen den Owner-Rechner nicht implizit. Das Repo ist oeffentlich.
10. **Der Lernloop misst sich selbst.** Eine Regel ohne benoetigten Trigger, geladene Bytes,
    vergleichbare Population und spaetere Wirkung ist eine Behauptung, kein Lernen.
11. **Owner-Aufmerksamkeit ist ein Budget.** Ein Gate ohne Zeitbudget, Stichprobe und sichtbaren
    `insufficient-evidence`-Ausgang ist kein Gate, sondern ein unbefristeter Stau.

## 4. Was Fleet schon besitzt — und was wirklich fehlt

### 4.1 Tragende vorhandene Bausteine

- `AGENTS.md`: getrackter, automatisch geladener Lane-Kern fuer Codex/pi; Done, Verify,
  Tree-Hygiene, Fail-/Probe-Disziplin und Reporting sind bereits stark.
- `CLAUDE.md`: private, lokale Betriebsrealitaet und viele aus echten Incidents verdiente Regeln;
  zugleich ungetrackt, pro Lane kopiert und als Ganzes zu gross fuer billiges Laden.
- `docs/tailored-context.md`, `docs/lane-brief-template.md`: Environment, Done, stiller
  Complement, schmaler Output und Executor-Kalibrierung sind als Doktrin vorhanden.
- `refine-prompt.ts`, `analysis-prompt.ts`, Task-Briefs und Criterion-Propose/Confirm: Fleet kann
  rohe Arbeit bereits vor einem Spawn schaerfen und vom Owner bestaetigen lassen.
- Queue-Kinds, Analyse, Comments, Refinement und der aktive Dashboard-/Workspace-Plan in
  `docs/plan-queue-refinement-2026-08-11.md`: die kuenftige Arbeitsflaeche existiert im Embryo.
- `src/protocol.ts` und `e2e/pins.ts`: gemeinsame Wahrheiten koennen mechanisch statt per Erinnerung
  zusammengehalten werden.
- `streams/prompts.jsonl`, `lane-outcomes.jsonl`, Audit-/Disposition-/Trail-Ledgers und
  Transkripte: reale Beobachtungen existieren bereits, wenn auch mit Luecken und verschiedenen
  Schemas.
- Harness-Adapter (`claude`, `pi`, `codex`, `container`) kennen Modell-, Sandbox-, Container- und
  Automationsfaehigkeiten bereits teilweise.
- `docs/README.md`, Commit-Bodies und Code-Kommentare bilden ein bewusst geschichtetes
  Wissensregal statt eines Suchdienstes.

### 4.2 Die strukturellen Luecken

1. **Kein expliziter Arbeitsvertrag als Ganzes.** Questions-read-only, Ceremony, Stopppunkt,
   Parallel-Ownership, Kommunikationsform, Defaults-vs.-Invarianten und Glossar sind verteilt.
2. **Kein Kontext-Router mit Beleg.** Codex/pi laden `AGENTS.md` und werden heute auf das gesamte
   private Regelbuch verwiesen; welche Abschnitte fuer diese Task wirklich gebraucht wurden, wird
   weder kompiliert noch aufgezeichnet.
3. **Kein Skill-/Capability-Inventar.** Skill-Scope (global/repo/harness/machine), Trigger,
   Requirements, Mutationsklasse, Version und tatsaechliche Verfuegbarkeit sind nicht gemeinsam
   modelliert.
4. **Unvollstaendige Provenienz.** Outcomes koennen nicht jede Lane sicher zu Owner-Request,
   Task/Programm, Harness, Kontextpaket und verwendeten Skills zurueckfuehren. Dadurch bleibt auch
   der Fehler "eine Bitte erzeugte vier ueberfluessige Lanes" unsichtbar.
5. **Kein bestaetigter Failure-Learning-Loop.** Es gab starke Einmalanalysen, aber keinen
   wiederholbaren Ablauf aus Extract -> Vorschlag -> Owner-Adjudikation -> Regel -> Wirkung ->
   Sunset.
6. **Surface-Vollstaendigkeit ist Prosa.** Adapter-, Client-, Wire-, Reverse-State-, Doc- und
   Real-Client-Entscheidungen werden nicht als ein gemeinsamer Task-/Outcome-Vertrag getragen.
7. **Kommunikationsartefakte fehlen als Fleet-Flaeche.** Screenshot, Video, Log oder HTML-Bericht
   koennen nicht sicher und dauerhaft an Task/Lane/Outcome haengen.
8. **Keine deklarative Verteilung.** Maschinen- und Harness-spezifische Skills/Requirements sind
   weder dry-run-faehig synchronisierbar noch gegen Drift sichtbar.
9. **Kein Rule/Skill-Sunset.** Das System kann Regeln sammeln, aber ihre Kosten, Ueberholung und
   Nichtwirkung nicht als Lifecycle behandeln.

## 5. Zielarchitektur — sieben Schichten, eine vorhandene Arbeitsflaeche

### Schicht A — Governance-Kern und gemeinsames Vokabular

Der immer geladene Kern sagt knapp:

- wer `owner`, `maintainer`, `user`, `agent`, `session`, `slot`, `lane`, `harness`, `provider`,
  `model`, `worker`, `task`, `brief`, `verify`, `land`, `deploy` und `audit` sind;
- was Fleet nie kompromittiert: menschliche Promotion, isolierte Produktion, Fakten vor Claims,
  explizites Unknown, deterministisches Done, ehrliche Oberflaechen und kleiner Review-Aufwand;
- welcher Arbeitsmodus aus dem User-Verb folgt: fragen/erklaeren/reviewen/diagnostizieren =
  read-only; aendern/bauen = Mutation im benannten Scope; monitoren = persistent bis Terminalzustand;
- wie der Maintainer arbeiten und angesprochen werden will: einfache Systeme, mutige aber
  begruendete Ideen, wenig Zeremonie, problemorientierte Sprache und keine Komplexitaet als Status;
- welche Regeln harte Invarianten und welche nur Defaults sind;
- wie Stopppunkt, Scope, Reporting und Parallel-Ownership funktionieren.

**Form:** `AGENTS.md` bleibt der getrackte portable Kern. Private Main-/Deploy-Realitaet bleibt im
ungetrackten `CLAUDE.md`, aber dieses wird vom allumfassenden Buch zum privaten Overlay und Router.
Thematische, oeffentlich tragbare Regeln leben in wenigen getrackten Modulen, die das vorhandene
`docs/`-Regal referenzieren statt es zu kopieren.

### Schicht B — Context Packs und der Kontext-Compiler

Ein **Context Pack** ist kein neuer Wissensspeicher. Es ist ein getrackter, versionierter Verweis
auf bereits vorhandene Regel-/Wissensabschnitte mit Metadaten:

```text
id · scope · triggers · hardness · paths/anchors · requiredCapabilities
harnesses · modes · estimatedBytes · evidence · owner · status/supersedes
```

Der Compiler nimmt Task, Files/Surfaces, Harness, Modell, Modus und Capabilities und erzeugt einen
inspectable **Context Plan**:

```text
core packs (immer) + task packs (getriggert) + private overlay (nur wenn erlaubt)
```

Er nennt fuer jedes Pack `warum`, verweigert unerfuellbare Requirements und speichert IDs, Hashes
und geladene/verwiesene Bytes auf Task/Lane/Outcome. Ein starkes Modell bekommt kuratierte Pfade
und Complement-Fragen; ein schwacheres Modell darf dieselben Invarianten expliziter eingebettet
bekommen (`docs/tailored-context.md` §8). Der Output ist vor Dispatch im Task-Detail sichtbar.

**Keine Generic-Context-Megapipe:** Die vorhandenen `/api/self/*`-Seams bleiben entlang ihrer
natuerlichen Fakten geschnitten. Der Context Plan wird mit Task/Brief/Outcome getragen, nicht als
zweiter Sammelendpunkt neben ihnen.

### Schicht C — Skill- und Capability-Registry

Ein Skill deklariert mindestens:

```text
id · trigger phrases · one job · scope(global|repo|harness|machine)
readOnly/mutating · requires · produces · source/version · status
```

- Die Description ist Trigger, keine Mini-Anleitung.
- Lesen und Schreiben sind getrennte Skills, wenn sie andere Autoritaet oder Requirements haben.
- Subjektive Outputs bekommen hoechstens ein oder zwei echte Gut-/Schlecht-Beispiele; die Beispiele
  kalibrieren Geschmack und Sprache, waehrend die Description klein bleibt.
- Jeder mutierende Skill benennt seinen Terminalzustand und Stopppunkt. `create/file` ist nicht
  automatisch `watch/babysit`, und weder eines davon bedeutet ungefragtes Deploy oder Merge.
- Ueberladene Skills werden geteilt; erstes konkretes Objekt ist `graphify` (Query/Read versus
  Build/Update/Import/Watch).
- `requires` kann Binary, Env-Credential, Browser, Netzwerk, Host-Service, tmux, Git-Write oder
  Sandbox-Faehigkeit nennen.
- Fleet zeigt pro Slot, was **wirklich** verfuegbar ist. Absenz ist benannt, nie erraten.
- Universal-, Repo-, Harness- und Command-Center-Skills haben getrennte Installationsziele, aber
  einen gemeinsamen deklarativen Katalog.

Spaeter kann ein attended `plan/apply/verify`-Sync daraus Maschinen konfigurieren. Der erste
Schnitt ist nur Inventar + Driftansicht; kein SSH-Schreibpfad.

Externe PR-Arbeit ist ein spaeteres, konditionales Skill-Paar, kein globaler Fleet-Ritus:
`file-pr` prueft vorhandenen PR/Diff/Konventionen und erklaert zuerst Problem, dann Loesung;
`watch-pr` verfolgt nur neue Checks/Kommentare, verifiziert Bot-Findings gegen den Code, markiert
Antworten als Agentenarbeit und laesst Review-Feedback den Originalscope nicht aufblasen. Gebaut
wird es erst, wenn reale Fleet-Arbeit diesen GitHub-Pfad wiederholt braucht; Fleets interner
serverseitiger Land-Pfad bleibt davon unberuehrt.

### Schicht D — Provenienz und Beobachtungsmodell

Jede neue Ausfuehrung soll auf folgende Kette zurueckfuehrbar sein:

```text
owner request / intake
  -> program or task cluster
  -> task + confirmed criterion + brief
  -> lane/session + harness/model/effort
  -> context-plan + skill set + capability snapshot
  -> changes/verification/review/artifacts
  -> disposition + owner corrections + final outcome
```

Minimal neue oder zu vervollstaendigende Felder:

- `originId`/`programId` als Klammer ueber mehrere Tasks/Lanes aus einer Bitte;
- `taskId`, `harness`, `model`, `effort` auf Outcome;
- `contextPlan{id, packs, hashes, bytes}` und `skills[]`;
- Capability-Snapshot nur als IDs/Booleans, niemals Secrets;
- `taskClass`/Surface- und Groessenfakten, damit Modellvergleiche nicht harte Tasks mit leichten
  verwechseln;
- Ende/Stopppunkt, Verify-Status, Reviewstatus und Artefaktreferenzen;
- Schema-Version und explizite Unknowns fuer alte Rows.

Rohbeobachtungen bleiben append-only. Neue Projektionen duerfen alte unvollstaendige Rows nicht
nachtraeglich mit Defaults "reparieren".

### Schicht E — Learning Engine und Rule Lifecycle

Der erste Learning-Run ist **manuell und read-only**:

1. Adapter-spezifische Reader normalisieren nur, was sie mechanisch kennen: Prompts, Turns,
   Tool Calls, Usage, Verify und Outcome. Nicht unterstuetzte Harnesses liefern `unknown`.
2. Ein Analyse-Worker schlaegt Failure-Klassen mit Evidenzanker vor, zum Beispiel:
   `scope-creep`, `unasked-edit`, `unsafe-process`, `stopped-early`, `no-verify`,
   `wrong-surface`, `overbuilt`, `tool-waste`, `communication-gap`, `context-gap`.
3. Der Owner bestaetigt, aendert oder verwirft jede Klassifikation. Nur diese Adjudikation zaehlt.
4. Ein Report rechnet pro 100 Owner-Prompts oder pro vergleichbare Lane, aufgeschluesselt nach
   Taskklasse, Harness und Modell. Rohzahlen ohne Nenner sind verboten.
5. Wiederholte bestaetigte Fehler erzeugen **Rule/Skill Proposals** als Queue-`notiz`/`richtung`,
   niemals direkt als bindende Datei oder `auftrag`.
6. Der Owner adoptiert einen Vorschlag. Erst dann wird er als kleiner Doc-/Skill-Task gebaut.
7. Die naechsten vergleichbaren Runs messen Wirkung und Kontextkosten. Ergebnis:
   `graduate | revise | sunset | insufficient-evidence`.

Eine Regel braucht damit einen Lifecycle:

```text
candidate -> confirmed -> active experiment -> graduated
                         -> revise / sunset / insufficient-evidence
```

Scheduling kommt zuletzt. Vor mindestens zwei manuellen, nuetzlichen Durchlaeufen und einer
stabilen Adjudikationsflaeche gibt es keinen Auto-Tick.

### Schicht F — Surface-/Contract-Vollstaendigkeit

Der Brief-Kompiler erzeugt fuer cross-cutting Arbeit eine **Surface Decision List**, keine
universelle laute Checkliste. Kanonische Gruppen:

- Wire: Serverprojektion, `src/protocol.ts`, Clienttyp, Validierung;
- Harness: claude, pi, codex, container — apply/not-supported/not-applicable mit Grund;
- Lifecycle: create, persist, resume/adopt, terminal/abort, reverse transition;
- State: happy, absent, explicit `null`, unknown, stale;
- UI: Owner Desktop/Mobile, Share-Zuschauer, echte Client-Passage wenn sichtbar;
- Docs: User- versus Maintainer-Zielgruppe;
- Betrieb: isolierte Instanz, notierte PID/Socket, keine Pattern-Kills;
- Test: passende e2e-Familie, Probe-Voraussetzung, Build-Artefakt.

Mechanische Ableitung (Files, API-/Typ-Kanten, Harness-Tabelle) kommt zuerst. Das Modell darf nur
die Entscheidung vervollstaendigen, nicht Fundstellen erfinden. Surface-Entscheidungen reisen mit
Brief und Outcome; so kann ein spaeterer Audit "nicht betrachtet" von "nicht anwendbar"
unterscheiden.

Langfristig werden weitere Server-/Client-Payloads aus ihren doppelten lokalen Interfaces nach
`src/protocol.ts` gezogen. Das ist ein Migrationstakt pro beruehrtem Vertrag, kein Big Bang.

### Schicht G — Kommunikations- und Artefaktflaeche

Jeder Abschluss folgt dem kleinen Kommunikationsvertrag:

```text
Problem / warum es wichtig war
-> Loesung / was jetzt anders funktioniert
-> Beweis / was wirklich lief
-> offene Grenze
```

Wenn Prosa nicht das beste Medium ist, kann eine Session ein Artefakt an Task/Lane/Outcome haengen:

- Screenshot oder kurzes Video fuer sichtbare Arbeit;
- Log oder Build-Artefakt fuer Diagnose;
- selbstenthaltenes HTML fuer Plan, Spec, Findings, Vergleich oder UI-Mocks;
- stabile Artefaktidentitaet mit Revisionen ueber Iterationen.

**Sicherer Fleet-Schnitt:** privat und authentifiziert per Default; Ablage ausserhalb des
Worktrees, damit kein untracked File den Land blockiert; Groessen-/MIME-Deckel; keine beliebigen
Host-Pfade; Symlink-/Boundary-Pruefung; 0600; Task-/Slot-gebundene Autorisierung; Retention sichtbar.
Oeffentliches Teilen ist eine spaetere, ausdrueckliche Owner-Aktion, kein Skill-Default.

Die Queue-/Task-Workspace-Flaeche aus dem aktiven Refinement-Plan ist der menschliche Einstieg.
Dieses Programm baut keinen zweiten Agent-OS-Tab: Context Plan, Proposals, Feedback und Artefakte
werden dort beziehungsweise im vorhandenen Lane-Dossier sichtbar.

## 6. Zwei End-to-End-Flows, die das System am Ende tragen muss

### 6.1 Arbeit ausfuehren

```text
Owner formuliert Task
  -> Queue kind/cluster/refine/criterion
  -> Surface- und Context-Plan werden vorgeschlagen
  -> Owner sieht Scope, Stopppunkt, Harness/Capabilities und bestaetigt
  -> Lane erhaelt kuratierten Brief + relevante Packs
  -> Lane produziert im eigenen Slice
  -> Host commit/verify/land
  -> Outcome traegt Provenienz, Surface Decisions, Context, Skills und Artefakte
  -> Report beginnt beim Problem, nicht beim Implementierungsinventar
```

### 6.2 Aus Arbeit lernen

```text
Owner waehlt Population/Fenster
  -> read-only Reader normalisieren vorhandene Beobachtungen
  -> Worker schlaegt Failure-Klassen mit Quellen vor
  -> Owner adjudiziert
  -> Report zeigt Rate, Nenner, Unknowns und Kontextkosten
  -> wiederholter Befund wird Rule/Skill Proposal in der vorhandenen Queue
  -> Owner adoptiert und baut einen kleinen Schnitt
  -> spaetere Population misst Wirkung
  -> graduate/revise/sunset
```

## 7. Programmphasen und ihre Gates

### Gate-Protokoll fuer alle Phasen

Ein Gate kennt drei ehrliche Verdikte: `pass`, `fail` und `insufficient-evidence`. Das dritte ist
keine versteckte Freigabe: Nach Ablauf der Evidenz-Timebox entscheidet der Owner ausdruecklich,
ob der Schnitt weiter beobachtet, zurueckgebaut oder mit kleinerem Scope fortgesetzt wird. Ein
population-abhaengiges Gate wartet hoechstens 14 Kalendertage oder auf 10 vergleichbare Lanes,
je nachdem was zuerst eintritt; andere Gates werden direkt gegen ihren kontrollierten Probe-Lauf
entschieden. Jede Vorlage beginnt mit Entscheidung, Risiko und Unknowns und passt in dieses
Owner-Budget:

| Gate | Owner-Budget | Entscheidungsgegenstand |
|---|---:|---|
| G0 | 30 min | Programmvertrag, private/oeffentliche Grenze, Backbone-Schnitt |
| G1 | 25 min | Boot-/Canary-/Redaktionsbeweis des Regelkontexts |
| G2 | 20 min | Provenienz-Join und ehrliche Unknowns |
| G3 | 20 min | Registry-/Routing-Gegenproben und inspectable Context Plan |
| G4 | 45 min je manuellem Lauf | Stichprobe adjudizieren, wiederholten Fehler und Wirkung entscheiden |
| G5 | 20 min | cross-cutting Surface-Stichprobe |
| G6 | 20 min | privates Artefakt, Boundary und Retention |
| G7 | 20 min | exakter Sync-Dry-run und Capability-Verify |

Wenn die Vorlage im Budget nicht entscheidbar ist, wird nicht einfach mehr Material angehaengt:
der Produzent verdichtet oder schneidet die Frage kleiner.

### Phase 0 — Vermessen und festlegen (read-only + Docs)

**Zweck:** Keine Architektur aus Bauchgefuehl bauen. Die vier Inventare unten werden unabhaengig
erhoben und von der MAIN-Session synthetisiert. Sie sind Arbeitsmaterial mit Ablaufdatum: Nach G0
ist `docs/triage/agent-os-synthesis.md` die operative Wahrheit; die vier Inventare werden beim
ersten Phase-1-Land nach `docs/attic/agent-os-2026-08-11/` verschoben und danach nicht gepflegt.

| Paket | Eigene Ergebnisdatei | Auftrag |
|---|---|---|
| P0-A Regeln/Kontext | `docs/triage/agent-os-rules.md` | aktuelle Regeln klassifizieren: core/private/topic/history; Dubletten, Widersprueche, Bytes, Trigger und private Inhalte |
| P0-B Skills/Capabilities | `docs/triage/agent-os-skills.md` | Skill-Wurzeln, Trigger, Ueberladung, Requires und tatsaechliche Harness-/Maschinenfaehigkeiten inventarisieren |
| P0-C Provenienz/Daten | `docs/triage/agent-os-data.md` | Prompt-, Transcript-, Outcome-, Audit- und Task-Schemas; Join-Luecken, Unknowns, Retention und sensible Felder belegen |
| P0-D Surfaces/Kommunikation | `docs/triage/agent-os-surfaces.md` | heutige Contract-/Adapter-/Lifecycle-/UI-Flaechen und moegliche Artefakt-Anker kartieren |

**Worker-Form:** read-only Analyse gegen denselben HEAD; jede Datei gehoert genau einem Worker;
keine gemeinsamen Code-Edits, keine Suiten. Maximal zwei gleichzeitig, damit Review und Kontext
nicht explodieren.

### Phase 0.5 — Baseline vor Mutation (read-only + Docs)

P0-E schreibt `docs/triage/agent-os-baseline.md` und trennt drei Klassen: heute mechanisch
zaehlbar, durch eine bestehende historische Stichprobe belegt und strukturell noch unbekannt.
Primär sind Prompt-/Tool-Result-Footprint pro vergleichbarer Lane und Owner-Aufwand; Boot-/Pack-
Bytes sind Sekundaermetriken. Wo alte Rows Task-, Harness- oder Context-Join nicht tragen, wird
nichts erraten. Eine rueckwirkende Stichprobe nutzt vorhandene belastbare Studien; nicht sauber
rekonstruierbare Korrektur-/Scope-Felder werden ab Phase 2 vorwaerts datiert. Damit darf eine
billige Zaehlluecke die Baseline nicht still ersetzen.

**Gate G0 — Owner bestaetigt:** Glossar, Nicht-Verhandelbares, private/oeffentliche Trennlinie,
minimale Provenienzfelder, Skill-Scope-Modell und Backbone-v1-Schnitt. Vor G0 kein Product-Code.

### Phase 1 — Getrackter Kern, Routing und Driftbeweis

**Lands, seriell:**

1. P1-A: Glossar + Arbeitsvertrag + Invarianten als kompakter getrackter Kern; keine private
   Deploy-Identitaet.
2. P1-B: Context-Pack-Manifest und pure Validierung; alle Pfade/Anchors/IDs/Requirements gepinnt.
3. P1-D: Boot-Matrix live messen: welcher Harness laedt welche Datei/Section wirklich? Nach
   Baumwechsel erneut messen, nicht aus Adapterannahmen ableiten.
4. P1-C: Nur wenn die Boot-Matrix einen Split rechtfertigt, wird `AGENTS.md` Router und das private
   `CLAUDE.md` als Host-Arbeit umgebaut: Vorher/Nachher-Inventar, private Sicherung, verschieben
   statt kopieren. Zwei bis drei bekannte Fallen aus dem Incident-Archiv werden vor und nach dem
   Split als Canary-Fragen an frische Lanes gestellt. Ein zweiter read-only Redaktionsblick prueft
   den getrackten Diff auf Identitaets-, Betriebs-, Netzwerk- und Maschineninterna; Literal-Grep
   allein ist kein Redaktionsbeweis.

**Gate G1:**

- jeder Harness bekommt den harten Kern oder scheitert sichtbar;
- jedes Context-Pack hat Trigger, Quelle, Requirements, Status und Bytekosten;
- keine private Identitaet steht im getrackten Baum;
- Gate-/Verify-Wahrheit wird nicht mehr an mehreren Prosa-Stellen von Hand kopiert;
- die Canary-Antworten verlieren keine sicherheits- oder landkritische Regel;
- Boot-/Pack-Bytes sind gemessen, aber nur als Sekundaermetrik und nicht als Qualitaetsgewinn.

### Phase 2 — Provenienz-Backbone

**Empfohlene Schnitte:**

1. P2-A: `originId/programId` + `taskId/harness/model/effort` bis Outcome durchreichen;
   Altrows bleiben explizit unbekannt.
2. P2-B: Context-Plan-/Skill-/Capability-IDs und Hashes auf Task/LaneOutcome; keine Inhalte und
   keine Secrets im Ledger.
3. P2-C: read-only Projektion/Report, der Request -> Tasks -> Lanes -> Outcomes joinen kann und
   Auslassungen zaehlt.
4. P2-D: Taskklasse/Surface-/Groessenfakten fuer spaetere faire Vergleiche. Mechanisch ableitbare
   Fakten (`files`, Prozesscluster, Groesse) bleiben Ableitungen; ein Modell darf `taskClass` nur
   vorschlagen und der Owner promotet sie. Fehlt beides, bleibt die Klasse `unknown`.

Neue pure Module sind einem weiteren `server.ts`-Block vorzuziehen (Kandidaten:
`agent-context.ts`, `agent-provenance.ts`); die Lane, die sie baut, entscheidet Namen erst gegen
die vorhandenen Communities. Gemeinsame Shapes gehoeren nach `src/protocol.ts`.

**Gate G2:** Jede neue gelandete Lane ist einer Request-/Task-Kette, einem Harness/Modell und der
getrackten Kontext-/Skill-Fassung zurechenbar. Private Packs tragen Content-Hash + Zeitstempel;
eine aufloesbare Versionsbehauptung gibt es erst, wenn das private Overlay eine eigene History hat.
Alte Luecken werden als Luecken gezaehlt. Damit ist erstmals messbar, ob Routing und Regelarbeit
etwas bewirken.

### Phase 3 — Skill-/Capability-Registry und Kontext-Compiler

1. P3-A: deklarativer Skill-/Capability-Katalog, zunaechst read-only sichtbar.
2. P3-B: `graphify-query` von `graphify-build/update` trennen; Trigger-Descriptions kuerzen;
   Verhalten vor/nach anhand echter Invocations pruefen.
3. P3-C: Context-Compiler als pure Funktion aus Task-/Surface-/Harness-/Capability-Fakten;
   deterministische Gegenproben fuer missing capability und weak-executor expansion.
4. P3-D: Context Plan im vollen Task-Detail/Brief sichtbar und vor Dispatch bestaetigbar. Nicht in
   den 2-s-`/api/sessions`-Poll legen.
5. P3-E: Context Plan beim Dispatch verwenden und auf Outcome schreiben.

**Gate G3:** Kein Skill wird auf einer Session beworben, die seine Requirements nicht erfuellt;
jede Lane erklaert inspectable, welche Packs warum galten; das gesamte private Regelbuch wird nur
noch geladen, wenn der Context Plan es ausdruecklich begruendet.

### Phase 4 — Manueller Learning Loop (Ende Backbone v1)

1. P4-A: Normalizer fuer die erste ehrlich unterstuetzte Population. Empfehlung: mit Claude-Lanes
   beginnen; Codex kommt nach gemessenem Rollout-Reader hinzu. pi/container bleiben `unknown`,
   bis ihre Datenform gemessen ist.
2. P4-B: Failure-Taxonomie + strict output contract + Evidenzanker; keine automatische Wahrheit.
3. P4-C: append-only Adjudikations-Ledger und Owner-Route; Vorschlag und Urteil getrennt. Die
   Owner-Flaeche zeigt alle Findings, verlangt aber nur Urteil ueber alle hohen Risiken plus eine
   reproduzierbar gezogene Stichprobe der uebrigen Rows (Default: max. 12 Rows oder 20 %, was
   kleiner ist). Ungepruefte Rows bleiben sichtbar `unadjudicated`, nie implizit bestaetigt.
4. P4-D: manueller Report nach Taskklasse/Harness/Modell mit Nenner, Unknowns, Kontext-/Tool-
   Footprint und Korrekturrate.
5. P4-E: Rule/Skill Proposal als vorhandene Queue-`notiz`/`richtung`; Adopt bleibt Owner-Akt.
6. P4-F: denselben manuellen Lauf ein zweites Mal auf neuer Population fahren und dokumentieren,
   was er diesmal **nicht** gefunden hat.

**Gate G4 / Backbone v1 DONE:** Zwei manuelle Durchlaeufe lieferten nachvollziehbare Ergebnisse
mit vollstaendig sichtbarer Population und adjudizierter Risiko-/Zufallsstichprobe; mindestens ein
bestaetigter wiederholter Fehler wurde als kleiner Rule/Skill-Schnitt gebaut und auf spaeteren
vergleichbaren Runs gemessen; kein Regelbuch und keine Queue-Zeile wurde automatisch mutiert. Erst
jetzt Expansion diskutieren.

### Phase 5 — Surface-/Contract-Vertrag (Expansion, einzeln freigeben)

- Surface Decision List in Refine/Brief/Outcome integrieren;
- mechanische Ableitung vor Modellurteil;
- pro beruehrtem API-Vertrag gemeinsame Types nach `src/protocol.ts` ziehen;
- Reverse-/Null-/Unknown-/Stale-Cases in der passenden e2e-Familie;
- echte Client-Passage nur bei sichtbarer Aenderung und auf Anfrage/Brief-Kriterium.

**Gate G5:** Bei einer bewusst gewaehlten cross-cutting Stichprobe ist jede relevante Surface
entweder umgesetzt, explizit nicht unterstuetzt oder begruendet nicht anwendbar; keine fehlende
Flaeche wird als stilles `false` gelesen.

### Phase 6 — Private Kommunikationsartefakte (Expansion)

- Datenmodell + lokale Ablage + Boundaries zuerst;
- Upload/Attach-Route mit self-/owner-scope, Deckeln, MIME und Symlink-Gegenproben;
- Lane-/Task-/Outcome-Dossier rendert Artefakte;
- getrennte Skills fuer `artifact-upload`, `html-communication` und `html-read`;
- spaeter optional explizites, zeitlich begrenztes Teilen.

**Gate G6:** Eine UI-Lane kann ein sichtbares Ergebnis als Screenshot/Video und einen komplexen
Vergleich als stabiles HTML privat zeigen, ohne Worktree-Dirt, beliebigen Host-Read oder oeffentliche
Freigabe.

### Phase 7 — Maschinen-Sync und Skill-Lifecycle (Expansion)

- private Maschinen-/Capability-Overlays gegen getracktes Schema;
- `plan` zeigt add/update/remove/drift und Requirements, ohne zu schreiben;
- attended `apply` nur auf explizit benannten Maschinen/Zielen;
- Verify liest installierte Version/Hash und Capability-Probe;
- Sunset entfernt erst Trigger, dann Installation, dann nach Beobachtungsfrist Altdateien;
- Provisioning bleibt eigener Skill mit enger Maschinenautoritaet.

**Gate G7:** Eine frische Maschine kann aus deklarierter Auswahl reproduzierbar vorbereitet werden;
ein fehlendes Token/Tool scheitert als es selbst; ein Dry-run nennt exakt jede beabsichtigte
Mutation; kein Sync schreibt ausserhalb explizit gewaehlter Ziele.

### Phase 8 — Graduation und vorsichtige Automatisierung (spaeter)

Moegliche Automatisierung nach belegter manueller Wirkung:

- periodischen Audit **vorschlagen** oder auf Owner-Klick starten;
- stale/teure/unwirksame Rules zur Review markieren;
- Context-Pack-Drift und fehlende Requirements sichtbar machen;
- niemals autonom Rulebook, Skill, Task-Kind, Promote, Land, Deploy oder Maschinenzustand aendern.

## 8. File-Ownership- und Kollisionsplan

Konkrete Dateinamen nach Phase 0 gegen den dann aktuellen Baum neu ankern. Die Ownership-Grenzen
bleiben:

| Flaeche | Primaerer Owner-Schnitt | Darf nicht parallel laufen mit |
|---|---|---|
| Kern/Glossar | `AGENTS.md` + neues getracktes Agent-Kontext-Modul | anderem Rulebook-Edit |
| Private Overlay | Host/Main `CLAUDE.md` | jeder gleichzeitigen privaten Rulebook-Pflege |
| Manifest/Pins | Context-/Skill-Manifest + `e2e/pins.ts` | zweitem Manifest-Schema-Edit |
| Shared Types | `src/protocol.ts` | anderem Protocol-Umbau |
| Task/Outcome Schema | Task-/LaneOutcome-Typen + passende e2e-Familie | Queue-Refinement-Schema-Lane |
| Compiler | neues pures Modul + Prompt/Task-Projektion | Skill-Registry-Schema, bis Vertrag steht |
| Learning Data | Reader/Normalizer + eigenes Ledger/Tests | Artifact-Retention/Trail-Retention |
| Task UI | `src/client.ts` Queue-/Detailbereich | aktiver Task-Dashboard-Lane |
| Artifact Store | eigenes Modul + Security-Suite | anderer Upload/Share/Security-Umbau |
| Skill Sync | Manifest/Planner, spaeter Host-Apply | jede andere Maschinen-/SSH-Arbeit |

**Aktive Abhaengigkeit und Prioritaet:** `docs/plan-queue-refinement-2026-08-11.md` hat bei einem
Konflikt um Owner-Aufmerksamkeit, Task-Schema oder Queue-UI Vorrang. Dieses Programm darf
Phase-0-Analyse und doc-/manifestseitige Phase 1 daneben
vorbereiten, baut aber keine konkurrierende Task-Oberflaeche. Context Plan, Proposals und
Artefakte werden nach dem Dashboard-Schnitt in dessen volles Task-Detail integriert.

## 9. Messplan — woran Nutzen und Schaden erkennbar werden

### 9.1 Vor dem ersten Bau als Baseline erfassen

- Prompt-/Tool-Result-Footprint je vergleichbarer Lane als primaere Kontextmetrik;
- Owner-Minuten je Gate und Owner-Prompts/Adjudikationsrows als getrennte Proxies;
- Bytes/Tokens von `AGENTS.md`, privatem `CLAUDE.md` und tatsaechlichem Boot-Kontext je Harness;
- welcher Harness welche Regeldatei wirklich laedt;
- Anteil Outcomes mit Task-, Harness-, Modell- und Verify-Provenienz;
- Owner-Korrekturen, Owner-Prompts, Stop-early, No-verify und Scope-Ausweitung — Unknown separat;
- heute installierte Skills/Versionen/Requirements je Ziel;
- Reviewzeit ist noch nicht direkt instrumentiert: bis dahin Owner-Prompts und Adjudikation als
  Proxy benennen, nicht als identisch verkaufen.

### 9.2 Backbone-Erfolg

- 100 % der **neuen** Lanes tragen Task-/Origin-, Harness/Modell-, Context-Pack- und Skill-
  Provenienz oder einen benannten `unknown`-Grund.
- 0 Skills werden trotz fehlender Requirement in einen Brief geroutet.
- Boot-Matrix: jeder unterstuetzte Harness erhaelt den harten Kern; ein absichtlich gebrochener
  Loader faellt als Loader-Probe.
- Primaer: P50 Prompt-/Tool-Result-Footprint sinkt oder bleibt stabil, ohne steigende Korrektur-
  oder Unknown-Rate. Sekundaer: always-loaded/Pack-Bytes sinken, wenn Routing-Korrektheit und
  Canary-Proben gleich bleiben. Die erste Entscheidung faellt nach 10 vergleichbaren Lanes oder
  14 Tagen mit `insufficient-evidence`, nicht nach unbefristetem Warten auf 20 Rows.
- Jeder Learning-Finding traegt Population, Nenner, Unknowns und mindestens einen nachpruefbaren
  Evidenzanker.
- Jede aktive experimentelle Rule traegt `introduced`, erwarteten Fehler, Zielpopulation und
  Review-/Sunset-Zeitpunkt.

### 9.3 Keine falschen Erfolgsmetriken

- Weniger Tokens allein sind kein Erfolg, wenn Korrekturen steigen.
- Mehr Regeln allein sind kein Erfolg.
- Mehr Skills oder mehr automatisch klassifizierte Findings sind kein Erfolg.
- Ein Modellvergleich ohne Taskmix/Context/Harness ist keine Modellrangliste.
- Eine niedrige Korrekturrate kann bedeuten, dass der Owner aufgegeben oder das Modell gewechselt
  hat; qualitative Adjudikation bleibt notwendig.
- Ein Audit mit 0 gelesenen Rows oder ohne unterstuetzte Population darf nie gruen sein.

## 10. Sicherheits-, Datenschutz- und Ehrlichkeitsgrenzen

1. **Transcript-Minimierung:** Analyse bevorzugt lokale Reader und speichert abgeleitete
   Ereignisse/Anker, nicht noch eine Vollkopie sensibler Unterhaltung.
2. **Provider-Grenze:** Ein externer Analyse-Worker darf nur die Daten sehen, fuer deren Provider
   der Owner das erlaubt hat. Keine stillschweigende Cross-Provider-Auswertung privater Repos.
3. **Prompt Injection:** Task-, Commit-, Log-, Review- und Transcript-Text ist untrusted DATA;
   bestehende `defuseDelimiters`-/strict-JSON-Disziplin gilt.
4. **Artefakt-Read:** Kein API-Body darf einen beliebigen Host-Pfad zum Upload machen. Boundary,
   Symlink, Typ, Groesse und Scope werden vor dem Read mechanisch geprueft.
5. **Sync:** `plan` vor `apply`; explizite Zielmaschine; keine Globs, keine Secrets im Manifest,
   kein autonomer SSH-Fan-out.
6. **Rule Governance:** Modellvorschlag und Ownerurteil bleiben getrennte Records. Eine verworfene
   Regel wird nicht geloescht, sondern mit Grund historisch auffindbar.
7. **Oeffentliches Repo:** keine Hostnamen, IPs, Klarnamen, Tokens, private Skillpfade oder
   Maschineninventare in getrackten Dateien.

## 11. Risikoregister und eingebaute Gegenmittel

| Risiko | Fruehes Signal | Gegenmittel / Stop |
|---|---|---|
| Das Programm inflationiert | mehrere Phasen werden gleichzeitig zu Lanes | Backbone-Schnitt + ein Phase-Gate; Ownerauftrag vor jedem Fan-out zitieren |
| Regelzerlegung verliert kritischen Kontext | Canary oder Korrekturrate kippt nach Split | Boot-/Canary-Matrix, Redaktionsreview, 10 Lanes/14 Tage, Pack rollback |
| Router wird zweite Wissensdatenbank | Pack kopiert ganze Docs | Pack traegt Pfad/Anchor/Trigger; Inhalt bleibt an heutiger Quelle |
| Analytics behauptet Modellqualitaet aus Taskmix | Modell A hatte nur UI/einfache Tasks | Taskklasse/Surface/Scope als Strata; unknown/insufficient-evidence |
| Modell bestaetigt seine eigene Diagnose | Auto-Label wird als Fakt gespeichert | propose/promote + Owner-Adjudikation |
| Telemetrie wird Ueberwachung/Datensenke | Volltranskripte dupliziert, Retention unklar | lokale Reader, minimale Events, Retention-Entscheid vor Persistenz |
| UI wird vor Daten gebaut | Dashboard voller `unknown` oder Textcasts | Data-/Projection-Schnitt vor Client; bestehendes Queue-Dashboard abwarten |
| Skill-Sync beschaedigt Maschinen | Apply ohne exakten Diff/Target | zuerst read-only plan; attended apply; Hash-/Capability-Verify |
| Artifact-Upload wird Exfil-/Traversal-Pfad | beliebige Pfade oder public-by-default | scoped store, Boundary/Symlink/MIME/Size, private Default, Security-Suite |
| `server.ts` waechst weiter monolithisch | jede Phase editiert denselben Block | pure Module mit expliziten Inputs; gemeinsame Types im Protocol |
| Rules sterben nie | active ohne Reviewdatum/Evidenz | Lifecycle-Pflicht; Sunset-Report; Trigger zuerst entwaffnen |
| Parallelitaet vervielfacht Review | mehr offene Diffs als Owner pruefen kann | max zwei Produktionslanes; serielles Land; read-only Fan-out separat |

## 12. Owner-Entscheide — mit empfohlenem Default

Diese Entscheide muessen nicht alle heute fallen. Der jeweils genannte Gate braucht sie.

1. **Programmname:** "Agent Operating System" als Arbeitsname? Empfehlung: ja; er benennt die
   Schichten, nicht ein neues Runtime-Produkt.
2. **Rulebook-Split (G0/G1):** getrackter oeffentlicher Kern + private lokale Overlay? Empfehlung:
   ja; private Sicherung/History muss vor dem Umbau stehen.
3. **Adjudikation (G0/G4):** Modell schlaegt vor, Owner bestaetigt? Empfehlung: ja, niemals
   Auto-Wahrheit.
4. **Datenfreigabe (G0/G4):** Welche Provider duerfen welche Transkripte analysieren? Empfehlung:
   lokal/gleicher vertrauter Provider als Default; Cross-Provider nur explizit.
5. **Erste Harness-Population (G4):** Empfehlung: Claude zuerst; Codex erst nach gemessenem
   Rollout-Reader, pi/container erst nach eigener Formatmessung.
6. **Artefakte (vor G6):** Empfehlung: privat/authentifiziert, keine Public-URL in v1.
7. **Maschinen-Sync (vor G7):** Empfehlung: read-only Drift/Plan zuerst; attended apply spaeter;
   keine automatische Verteilung.
8. **Queue-Integration:** Empfehlung: aktiver Task-Dashboard-Plan besitzt UI und Workspace;
   dieses Programm liefert nur neue Daten/Projektionen hinein.
9. **Gate-/Adjudikationsbudget:** Empfehlung: Tabelle in Abschnitt 7 und Risiko+Zufallsstichprobe;
   `unadjudicated` bleibt ein sichtbarer Zustand.
10. **Private Pack-Provenienz:** Empfehlung: in v1 Hash+Zeitstempel ehrlich ausweisen; eigene
    private History als separaten Owner-Entscheid behandeln, nicht in G2 vortaeuschen.

## 13. Direkt nutzbarer Start fuer die naechste MAIN-Session

Den folgenden Auftrag als ersten Arbeitsauftrag verwenden; er startet **nur Phase 0**:

```text
Arbeite im Haupt-Checkout von Claude Fleet. Lies zuerst CLAUDE.md vollstaendig, dann
./state.sh, ./register.sh, den obersten HANDOFF-Abschnitt,
docs/plan-agent-operating-system-2026-08-11.md und
docs/plan-queue-refinement-2026-08-11.md.

Unser Ziel ist das lernende Agent Operating System aus dem Schlachtplan. Heute baust du
KEIN Product-Feature und aenderst weder AGENTS.md noch CLAUDE.md. Fuehre ausschliesslich
Phase 0 und 0.5 aus: vier belegte Inventare fuer Regeln/Kontext, Skills/Capabilities,
Provenienz/Daten und Surfaces/Kommunikation plus eine ehrliche Baseline. Maximal zwei read-only Worker gleichzeitig;
jeder besitzt genau seine eigene Datei unter docs/triage/agent-os-*.md. State file ownership
vor jedem Dispatch. Worker duerfen keine anderen Dateien aendern.

Synthetisiere danach in `docs/triage/agent-os-synthesis.md` als kurze Owner-Vorlage: Glossar, Nicht-Verhandelbares,
private/oeffentliche Trennlinie, minimales Provenienzschema, Skill-Scope-Modell,
Backbone-v1-Schnitt und alle echten Widersprueche zum heutigen Plan. Zitiere fuer jeden
Befund Code/Datei/Transcript-Fakten; Vermutungen bleiben als solche markiert. Stoppe vor
jeder Implementierung und bitte um G0. Done = die vier separaten Inventare, Baseline und Synthese
sind committed und sonst ist nichts veraendert. Verifikation: bun e2e/pins.ts plus
Pfad-/Anchor-Check fuer alle sechs Dateien.
```

### Worker A — Regeln und Kontext

```text
Du bist read-only Auditor fuer Phase P0-A. Eigene Datei:
docs/triage/agent-os-rules.md; keine andere Datei aendern.

Inventarisiere AGENTS.md, das aktuelle private CLAUDE.md, docs/README.md und die direkt
gerouteten Brief-/Wissensdocs. Klassifiziere jede Regelgruppe als core, private-overlay,
topic-routed oder history/evidence. Miss Bytes, finde Dubletten/Widersprueche und benenne
welche Harnesses sie heute wirklich laden (Claims getrennt von Live-Beleg). Liefere einen
Vorschlag fuer Glossar, harte Invarianten, Defaults und Context-Pack-Schnitte. Verschiebe
oder editiere nichts. Output: Fakten, Luecken, empfohlene Schnitte, offene Owner-Entscheide,
nicht geprueft. Done = jede Empfehlung hat einen konkreten Quellanker.
```

### Worker B — Skills und Capabilities

```text
Du bist read-only Auditor fuer Phase P0-B. Eigene Datei:
docs/triage/agent-os-skills.md; keine andere Datei aendern.

Finde alle repo-, global-, harness- und maschinennahen Skill-/Command-Flaechen, soweit sie
dieser Session sichtbar sind. Pro Skill: heutiger Trigger, Jobs, Read/Write-Autoritaet,
Requirements, Zielscope, Version/Quelle und nachweisbare Verfuegbarkeit. Markiere Ueberladung,
insbesondere Query versus Build/Update, und stille Annahmen ueber Tokens/Binaries/Netz/Browser.
Entwirf nur das minimale Registry-Schema und eine Capability-Probe-Matrix; keinen Sync bauen.
Output wie Worker A, inklusive unknown fuer unsichtbare globale/machine-private Quellen.
```

### Worker C — Provenienz und Lerndaten

```text
Du bist read-only Auditor fuer Phase P0-C. Eigene Datei:
docs/triage/agent-os-data.md; keine andere Datei aendern.

Verfolge Task/Brief/Slot/LaneOutcome, prompt log, transcripts, audit, disposition, review und
trail vom Writer bis zu jedem Reader. Erstelle eine Feld-/Join-Matrix: origin/program/task,
harness/model/effort, context/skills/capabilities, verify/review/corrections/artifacts.
Zaehle auf der heutigen realen Population, welche Felder vorhanden, absent oder strukturell
unbekannt sind. Benenne sensible Inhalte und Retention. Entwirf das kleinste append-only
Provenienz- und Adjudikationsschema; keine Daten migrieren, keine Logs schreiben.
```

### Worker D — Surfaces und Kommunikationsartefakte

```text
Du bist read-only Auditor fuer Phase P0-D. Eigene Datei:
docs/triage/agent-os-surfaces.md; keine andere Datei aendern.

Kartiere die heutigen Server/Protocol/Client/Share/Harness/Lifecycle/Docs/Test-Surfaces und
wo sie bereits mechanisch gekoppelt sind. Pruefe, wie Refine/Brief/Outcome eine Surface
Decision List tragen koennten, ohne eine laute Universal-Checkliste zu werden. Kartiere
ausserdem die engste sichere Stelle, an der private Screenshots, Videos, Logs und HTML an
Task/Lane/Outcome haengen koennten: Auth, Pfadgrenze, Worktree-Dirt, MIME/Groesse, Retention,
UI-Anker. Keine Route und keine UI bauen.
```

### Worker E — Baseline

```text
Du bist read-only Auditor fuer Phase P0.5. Eigene Datei:
docs/triage/agent-os-baseline.md; keine andere Datei aendern.

Miss vor jedem Product-Code: Prompt-/Tool-Result-Footprint als primaere Kontextmetrik,
Boot-/Regelbytes sekundaer, Provenienz-Coverage, Owner-Prompts und alle echten Unknowns. Nutze
eine vorhandene belegte historische Stichprobe, falls alte Rows fuer einen neuen Join strukturell
nicht ausreichen; errate weder Taskklasse noch Harness aus Modellnamen. Datiere nicht
rekonstruierbare Korrektur-/Scope-Metriken ehrlich ab Phase 2 vorwaerts. Output: Population,
Methode, Messwerte, Grenzen, Gate-Schwellen und nicht geprueft. Keine Transkripte kopieren, keine
Logs schreiben und keine Erfolgsbehauptung aus Bytes allein.
```

## 14. Statusblock — von jeder uebernehmenden Session zuerst aktualisieren

Stand 2026-08-11 nach Phase 0/0.5 im Codex-Main-Checkout:

- **Phase 0:** INVENTARE ERSTELLT (`docs/triage/agent-os-{rules,skills,data,surfaces}.md`).
- **Phase 0.5:** BASELINE ERSTELLT (`docs/triage/agent-os-baseline.md`).
- **G0-Synthese:** ERSTELLT (`docs/triage/agent-os-synthesis.md`).
- **G0 Owner-Entscheid:** OFFEN.
- **Phase 1–8:** NUR ZIELBILD, kein Bauauftrag.
- **Aktive Abhaengigkeit:** `docs/plan-queue-refinement-2026-08-11.md`; dessen Task-Dashboard-
  Reihenfolge nicht umgehen.
- **Neue Queue-Zeilen fuer dieses Programm:** keine in dieser Session erzeugt.
- **Product-Code:** unveraendert.
- **Private Rulebooks/Skills/Maschinen:** unveraendert.
- **Landing:** Alle Agent-OS-Dokumente sind in diesem Checkout noch untracked und muessen vor
  serverseitigem Land gemeinsam committed werden.

Wenn eine Phase landet, hier nur den neuen Phasenstatus, Commit/Task-IDs, Gate-Verdikt und den
naechsten noch offenen Entscheid notieren. Messwerte und Arbeitszustand gehoeren in ihre Ledgers
beziehungsweise in `state.sh`/`register.sh`, nicht in diesen Block.

## 15. Definition of Done fuer das Gesamtprogramm

Das Programm ist nicht fertig, wenn alle Phasen gebaut sind. Es ist fertig, wenn Fleet den Kreis
nachweislich tragen kann:

1. Eine neue Task erhaelt einen kleinen, richtigen, inspectable Kontext- und Capability-Plan.
2. Eine Session kann nur Skills benutzen, die an diesem Ort wirklich existieren.
3. Ihr Ergebnis ist bis zur Owner-Absicht, zum Executor und zur geladenen Regel-/Skill-Fassung
   zurueckfuehrbar.
4. Cross-cutting Arbeit traegt explizite Surface-Entscheidungen statt stiller Auslassungen.
5. Der Owner bekommt Problem, Loesung, Beweis, offene Grenze und bei Bedarf ein passendes privates
   Artefakt.
6. Ein manueller Audit kann wiederkehrende Fehler mit ehrlichem Nenner finden; der Owner kann sie
   adjudizieren und als Rule/Skill Proposal behandeln.
7. Eine aktive Regel wird an spaeteren vergleichbaren Runs gemessen und kann sichtbar revidiert
   oder ausgemustert werden.
8. Kein Teil dieses Kreises braucht eine automatische Regelmutation, einen zweiten
   Wissensspeicher, eine zweite Queue oder eine Behauptung, wo Fleet `unknown` hat.

Erst wenn dieser End-to-End-Beweis auf realer Arbeit zweimal gelungen ist und der zweite Lauf
weniger Handarbeit als der erste braucht, ist aus dem Plan ein lernendes System geworden.

---
frage: Welche Aufgabe, welchen Kontext und welche Ausfuehrungsklasse braucht jede Fleet-Rolle beim Start und unterwegs?
urteil: Fleet sollte den Brief auf einen vollstaendigen Handlungsrahmen kuerzen, Rollenrechte und Ausfuehrungsklassen getrennt aufloesen und Providerzustand separat halten; zuerst Drift und Delegationswirkung pruefen, dann Profile verbindlich machen.
bereich: [rollen, briefs, kontext, modellklassen, delegation]
belege: [SYSTEM.md#Kontextschichten, AGENTS.md#Portable operating contract, rulebook.ts#FRAGMENTS_FOR, server.ts#briefAndSend, server.ts#handleSelfSucceed, card-extract.ts#FORMAT_KEYS, docs/plan-fleet-betrieb-2026-09-13.md#4, docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md#2.1]
nicht-gemessen: Wirkung der vorgeschlagenen Texte und Klassen, K1-Nachher-Ergebnis, reale Starttokens ausserhalb der zitierten Claude-Stichproben, Gesamtverbrauch mit Subagents und Providerquoten.
stand: 2026-09-13
---

# Rollen, Briefe und Gueteklassen — eigenstaendiger Astra-Entwurf

Entwurf zur Owner-Synthese, keine Promotion. Der Dateiname folgt dem Auftrag; erhoben und geschrieben am Frontmatter-Datum.
Gelesener Code-Stand: `fc7434137ee7b83ce3cf0377fcbda6eef7f5f70e`, Haupt-Checkout nur lesend; die Snippet-Verdrahtung aus Auftrag `25b90648` ist enthalten.
Eingaenge waren die Queue-Texte samt vorhandenen Kommentaren `6bd2e49c`, `21ade485`, `c269023d`, `504b0854`, die im Auftrag genannten Abschnitte und das private Brief-Prinzip, die Prompt-Axiome sowie `sharpen3`.
Der parallele Rollenentwurf wurde weder gelesen noch gesucht. Die aelteren Messnotizen mit Fable im Namen sind gemeinsame Quellen.

**Abstraktionsentscheid:** Ein Ausfuehrungsprofil soll existieren, weil derselbe begrenzte Job heute Modellwahl, Lesedosis und Werkzeugvertrag an verschiedenen Stellen zusammenfinden muss; Rollenautoritaet bleibt separat, weil Rechenfaehigkeit keine Befugnis begruendet.

## §1 Ist-Inventar (F1)

### Lesekette und Groessen

**Gemessen hier:** Dateibytes und benannte Quellliterale, keine Starttokens. **Uebernommen gemessen:** historische Messwerte mit Datum und Population. **Abgeleitet:** was aus dem Loader-Vertrag zusammen geladen werden sollte. Die reale Summe pro Rolle ist ausserhalb der genannten Transkripte `unknown`.

| Rolle | Traeger | Was drinsteht | Groesse | Fundstelle |
|---|---|---|---|---|
| Orchestrator / Fleet Controller | Claude-MAIN-Render, portabler Vertrag, `docs/controller.md`, Auftrag; generischer Nachfolgebrief | Portfolio, vorgeschlagene Programs, Owner-Grenzen, Supervisor-Rueckweg; Scope ohne eigene Bindung | hier gemessen: Render 85 369 B, Rollenkarte 8 956 B; historische dateibasierte Laderechnung 114 084 B, keine vollstaendige Tokenmessung | `rulebook.ts#FRAGMENTS_FOR`; `docs/controller.md#Auftrag und Schnitt`; `server.ts#buildSuccessionBrief`; Kontext-Gesundheit §1 |
| Program-MAIN, Claude | derselbe MAIN-Render; bestaetigte Program-Inhalte, Rail und Anker | Charter, Projektzugang, bounded Autonomie, Tasks, Release, Land/Watch; bei Nachfolge eigener Program-Datensatz | historisch 123 590 B als Laderechnung; hier Standard-Rail 4 703 B Quelltext ohne Interpolation, Charter/Anker variabel | `server.ts#buildProgramMainBrief`, `#railBlockFor`, `#standardHandoverLines`; Kontext-Gesundheit §1 |
| Worker-Lane, Claude | globaler Loader, Lane-Render; AGENTS-Kern auf Leseauftrag; Karte/Prosa, Notizen, Quellpaket, Studio, Anker, Footer | begrenzter Auftrag, Beweis und Abschluss; private Betriebsdetails teilweise auch fuer fremde Rollen | hier Lane-Render 36 889 B inkl. Backrefs, portabler Abschnitt 15 440 B; uebernommen erster Turn p50 69 314 Tokens bei 180 Transkripten, Einzelzerlegung 71 387 | `rulebook.ts#FRAGMENTS_FOR`; `server.ts#briefAndSend`; Startkontext-Fixkosten §Ergebnis |
| Worker-Lane, codex/pi | automatisch `AGENTS.md`; gleicher Dispatch-Builder; private Abschnitte nur auf Anlass | portabler Vertrag, Aufgabe, Quellen, ausdrueckliche Kommandos; eigener Harness-Unterbau | hier AGENTS 25 041 B; historisch 27 167 B fuer AGENTS + Median-Brief abgeleitet; wirklicher Startkontext `unknown` | `AGENTS.md#If you are a Codex or Pi lane`; `rulebook/loader.md`; Kontext-Gesundheit §1 |
| Clarify-Lane | normaler Harness-Loader plus deterministischer Clarify-Brief und Anker | erst Kriterium erden/vorschlagen, `criterion` persistieren, auf Owner-Bestaetigung warten | hier leerer Rahmen 2 404 B mit Platzhalteradresse; Anfrage, Anker und Harness kommen hinzu | `clarify-prompt.ts#buildClarifyBrief`; `server.ts#briefAndSend` |
| Supervisor | MAIN-Render, portabler Kern, Supervisor-Body und Anker | typisierte Querbeobachtung, Nudge an MAIN, Transition-Abschluss; keine Owner-Attention | historisch 108 443 B dateibasiert; heute Body variantenuebergreifend geteilt, gesamte Laufzeitladung `unknown` | `server.ts#supervisorBriefBody`, `#buildSupervisorBrief`, `#buildSupervisorBindBrief`; Kontext-Gesundheit §1 |
| Steward | privates Regelbuch, `docs/steward.md`, Lade-Ritual und Journal | Planungsdialog, Digest, begrenzte Vorschlaege, Wiederholungen per Register vermeiden | hier Rollen-Doc 11 711 B; historisch 197 726 B Ladeplan; heutiger Ritualvollzug `unknown` | `docs/steward.md#Session start (the load ritual)`, §The two pulses; Kontext-Gesundheit §1/§2 Befund 8 |
| Astra-Analyse-Session | codex-AGENTS, rollenabhaengiger Gruendungsbrief; optional Astra-Baustein | Analyse plus dauerhafte Artefakte, erlaubte Wartearbeit, Abbruchregel, Fuellstandsschaetzung | hier Baustein 20 799 B; historischer target-repo-MAIN-Fall 30 831 B ohne Nachweis, dass dieser Baustein dabei war | `docs/astra-briefbaustein-2026-09-07.md#BAUSTEIN`; `server.ts#buildProgramMainBrief`; Kontext-Gesundheit §1 |
| Wegwerf-Worker: merge / repair | Promptbuilder, Toolprofil, `runWorker` | konkrete Baum-/Konfliktlage bzw. Reparaturauftrag, Abschlussmarke und strukturierter Status | jeweiliger Auftrag variabel; geladene Tokens hier `unknown` | `merge-prompt.ts`; `server.ts#runWorker`; `src/protocol.ts#WORKER_CONTRACTS` |
| Wegwerf-Worker: review / cleanReview | Diff-/Review-Prompt, eingeschraenktes Toolprofil | Findings bzw. Verdict; Lesemodus ist Teil des Vertrags | `unknown`; kein Schluss von SUMMARY_MODEL auf die Ladegroesse | `server.ts#reviewResponse`, `#runWorker`; `merge-prompt.ts#GIT_GRANT_REVIEW`; `src/protocol.ts#WORKER_CONTRACTS` |
| Wegwerf-Worker: summary / card | Summary-Prompt bzw. `buildCardPrompt`, Route und Antwortschluessel | Session-Zusammenfassung bzw. reine Formextraktion; Karte wird anschliessend deterministisch validiert | variabler Summary-Kontext; card bekommt Text ohne Repo/Werkzeuge; Tokens `unknown` | `server.ts#summaryResponse`, `#WORKER_ROUTES`, `#CARD_MODEL`; `card-extract.ts#buildCardPrompt` |

Astra bezeichnet hier einen Executor. Eine Astra-MAIN hat MAIN-Pflichten, eine Astra-Lane Lane-Pflichten; eine freie Analyse-Session erhaelt nur ihren konkreten Auftrag. Ein Modellname soll keine weitere Rolle gruenden.

Die historischen Laderechnungen stammen aus `docs/messungen/2026-09-06-kontext-gesundheit-fable.md` §1. Sie summieren Dateien und leiten Tokens ab. Die neuere `docs/messungen/2026-09-14-lane-startkontext-fixkosten.md` §Ergebnis misst dagegen den ersten Claude-Turn: 32 467 Tokens fester Praefix, 18 335 Lane-Render, 6 618 Skill-Listing; AGENTS kostet dort beim Start 0 und erst beim Lesen. Die aeltere Annahme ueber fehlendes Worktree-Memory wird durch das neuere Attachment mit 2 806 Tokens widerlegt. Diese Verfahren duerfen keine gemeinsame Rangliste aus scheinbar gleichen Tokenzahlen ergeben.

Reproduktion der billigen Messungen, im untersuchten Checkout:

```sh
wc -c SYSTEM.md AGENTS.md CLAUDE.md docs/controller.md docs/steward.md docs/astra-briefbaustein-2026-09-07.md
# MAIN-Render: dasselbe wc -c CLAUDE.md lesend im Haupt-Checkout.
bun -e 'import {buildClarifyBrief} from "./clarify-prompt"; process.stdout.write(String(new TextEncoder().encode(buildClarifyBrief("", "http://<fleet-host>:<port>")).length)+"\n")'
python3 - <<'PY'
from pathlib import Path
import re
s = Path('server.ts').read_text()
for name in ['LANE_EXIT_FOOTER', 'RAIL_HEAD', 'RAIL_ROLE_STANDARD', 'RAIL_TAIL']:
    m = re.search(r'const '+name+r' = `([\s\S]*?)`;', s)
    print(name, len(m.group(1).encode()) if m else 'unknown')
print('portable', len(Path('AGENTS.md').read_text().split('## Portable operating contract\n')[1].split('\n## Before you start')[0].encode()))
PY
```

Quellliterale: Footer 2 368 B; Rail-Teile 905 + 903 + 2 895 = 4 703 B. Das sind UTF-8-Bytes einschliesslich unaufgeloester Interpolation; die tatsaechlich ausgelieferte Laenge steht im Receipt. SYSTEM umfasst hier 13 120 B und ist laut eigenem Kopf das Zielbild, kein universeller Zusatz-Leseauftrag.

### Was heute Modell- oder Harness-abhaengig ist

| Regel / Auswahl | Heutiger Ort | Konsequenz und Grenze |
|---|---|---|
| Fable fuer Orchestrierung und Steward, Opus fuer Lanes; Controller-Versuch mit Opus | `rulebook/einstieg.md` §MODELLPOLITIK | mehrere datierte Owner-Entscheide in Prosa; keine zentrale Job-Klasse |
| Supervisor Opus, high | `rulebook/supervisor.md` §Supervisor-Rolle | spezielle Rollenpolitik; die danebenstehende Korrekturhistorie erschwert die Gegenwartslesung |
| Interaktiver Default | `server.ts#DEFAULT_MODEL`; `src/protocol.ts#FLEET_DEFAULT_MODEL` | Env-Override mit Formatpruefung, ansonsten Opus-Default; keine Faehigkeitszertifizierung |
| Summary-Default, Kartenmodell, alternative Workerroute | `server.ts#SUMMARY_MODEL`, `#CARD_MODEL`, `#WORKER_ROUTES`, `#runWorker` | Summary faellt auf Sonnet, card auf Haiku; ausgewaehlte Leseworker koennen codex-exec benutzen; merge/repair/review bleiben in dieser Routentabelle Claude |
| Effort und Modellsyntax; automatische Zustellbarkeit | `server.ts#HARNESSES`, `#taskSpawnFromBody`, `#modelOf`, `#effortOf` | Claude und Codex haben unterschiedliche validierte Effort-Saetze; pi-zai ist automatable:false. Ein gueltiger Modellstring beweist keine Lieferfaehigkeit |
| MAIN-/Lane-Leserschaft | `rulebook.ts#FRAGMENTS_FOR` | Lane bekommt loader, lane-discipline, self-scheduling; MAIN alle Fragmente. Modellklasse ist noch keine Auswahlachse |
| Dichte fremder Briefs und expliziter Proof | `rulebook/einstieg.md` §GPT-Lane-Brief-Checkliste und §Eine Lane muss nicht claude sein; `docs/tailored-context.md` §8 | fehlendes Loaderwissen muss geliefert werden; Schluss auf geringere Denkfaehigkeit allein aus fremdem Harness ist unbelegt |
| Kontextband, Compact, Nachfolge | `AGENTS.md#Context self-management`; Astra-Baustein R5; `rulebook/einstieg.md` §GPT-Lane-Brief-Checkliste; `server.ts#migrateRailOf`, `#handleSelfSucceed` | portable Warnschwelle, modellspezifische Vorbehalte und Rollenrail treffen zusammen; Fensterprozent ersetzt keine gemessene Arbeitsreserve |
| Wortwahl bei Fable-Zugriffsfragen | `rulebook/loader.md` §Loader-Vertrag | historischer Umgang mit Fehlalarmen; benoetigt einen konkreten Anlass, keine volle Vorfallgeschichte in jedem Brief |

## §2 Dynamik (F2)

### Was wann ankommen muss

| Zeitpunkt | Fuer die ausfuehrende Rolle noetig | Komplement, das sie still klaert |
|---|---|---|
| Start | Identitaet/Bindung, Auftrag und Bedeutung, Write-Set, erste Quellen, Done/Proof, erreichbarer Rueckkanal | Welches Ergebnis braucht der Empfaenger? Was ist Quelle, was Auftrag? Welche Nachbarbedingung koennte das Ergebnis entwerten? |
| Erste Aenderung | passende Quellausschnitte samt Stand/Auslassungen; eigener sauberer Ausgangsbaum; tatsaechlicher Verify-Umfang | Welche Aufrufer, Datenformen und Gegenfaelle tragen die Aenderung? Reicht das gekuerzte Symbol wirklich? |
| Rotes Pruefergebnis | exakter Fehler, gepruefter Baum, benannter Reparaturzug und Stop-Linie; Familienwissen erst bei Bedarf | Lief die Probe? Ist Setup rot? Welche Beobachtung unterscheidet Defekt und Nichtdeterminismus? |
| Warten | ein erreichbarer Ereignisrueckweg mit Terminalzustand; unabhaengige Restarbeit im bereits autorisierten Scope | Darf ich jetzt ueberhaupt etwas anderes anfangen? Wartet ein Mensch auf eine Entscheidung von mir? |
| Abschluss | konkrete Artefaktadresse, exakter Prueftail, Berichtsschema/Deckel, Commit- und Stop-Vertrag | Kann der Empfaenger den Befund ohne mein Transkript pruefen? Sind behauptete Erfolge belegt? |
| Uebergabe | rollenpassender dauerhafter Zustand und erster naechster Zug; offene Fragen/Pflichten mit Herkunft | Welche Verpflichtung wird nur gespeichert, welche wirklich weiterbetrieben? Was muss die Nachfolge selbst erneut beobachten? |

Rollenunterschiede: Der Controller braucht am Start Portfolioziel und eine bestaetigte Zustelladresse; eine Program-MAIN Charter, Bindung und aktuellen Program-Zustand. Die Worker-Lane braucht den konkreten Aenderungsraum. Clarify braucht die ungeklaerte Anfrage und die Grenze vor Implementierung. Supervisor braucht beobachtbare Terminalpraedikate samt Nudge-Empfaenger. Steward braucht aktuellen Registerstand samt widerlegten Befunden. Die Analyse-Session braucht Gegenhypothese und Evidenzgrenze. Der Wegwerf-Worker braucht ein geschlossenes Eingabepaket und einen maschinenlesbaren Ausgang. Quellen: `AGENTS.md#Role contract`, `clarify-prompt.ts#buildClarifyBrief`, `server.ts#supervisorBriefBody`, `docs/steward.md#The two pulses`, `src/protocol.ts#WORKER_CONTRACTS`.

Beim Warten kann MAIN bereits autorisierte naechste Briefe oder eigene Belege fertigstellen; Worker kann die eigene Dokumentation abschliessen. Fehlt unabhaengige Restarbeit, endet der Turn. Clarify wartet nach dem Kriteriumsvorschlag. Ein Supervisor beobachtet den beauftragten Uebergang. Keiner dieser Zuege braucht eine neue Rollenbeschreibung bei jedem Event.

### Befunde nach Wirkung

1. **Fehlende Pflichtinformation war teuer und ist inzwischen ergaenzt.** Worktrail IV §2.1 mass 130/181 betroffene Claude-Lanes und 334 Report-Abweisungen am 4000-Zeichen-Deckel. `AGENTS.md#Reporting` und `server.ts#LANE_EXIT_FOOTER` nennen heute Deckel, Scratch und das geschlossene Schema. Die Wirkung nach dem Fix ist offen. Diesen Fix erneut vorzuschlagen wuerde Arbeit duplizieren.
2. **Ein alter Rollenbaustein sendet falsche Handlungszuege.** Astra-Baustein R3 verlangt einen HANDOFF-Commit von jeder dort adressierten MAIN und erneutes Stellen alter Attention. `server.ts#handleSelfSucceed` sowie `#standardHandoverLines` unterscheiden heute Standard-Program, Game-Maker, Lane und generische Nachfolge; aktuelle Program-Attention ueberlebt die bewusste Program-Nachfolge. Kosten der Drift: unnoetige Commits oder doppelte Owner-Fragen. Ebenso behauptet der Baustein unter §Verifiziert / nicht verifiziert, `self/notes` existiere nicht; der eigene GET dieser Lane lieferte die im Brief benannte Notiz. Kein allgemeiner Neubau eines Rueckkanals ist dafuer noetig.
3. **Die Quellenlast sitzt vor der ersten Aenderung.** Worktrail IV §2.2: erster Schreibmarker p50 144 382 Tokens bei 171 gelandeten Lanes; §2.3 findet trotz verbreiteter Anker keine gemessene Entlastung durch Anker allein. Der heutige `server.ts#briefAndSend` liefert bereits `laneSnippetBlock`. Kosten weiterer universeller Lesepflichten: dieselbe Erdung erneut bezahlen. Wirkungsentscheidung dazu bleibt K1 (§7).
4. **Ein Brief kann seine Prioritaet durch Form verlieren.** `wave-brief.ts#withCardHead` stellt die Karte vor die Prosa; `docs/tailored-context.md` §6c nennt ausdrueckliche Kuerzung. Ein gekuerztes DONE muss als Vorschau erkennbar bleiben, der vollstaendige Auftrag erreichbar sein. Wiederholte Autoritaetsformeln und Grossbuchstaben daneben machen unklar, welcher Satz die konkrete Ausnahme traegt. Das ist eine Wirkungsannahme, keine hier gemessene Fehlerquote.
5. **Historische Ladeplaene sind keine Laufzeitmessung.** Kontext-Gesundheit §2 dokumentiert Datums- und Korrekturschichten; die heutige Supervisor-Prosa enthaelt weiterhin alte und korrigierte Aussagen zur Modellumstellung. Der generische `buildSuccessionBrief` adressiert den obersten HANDOFF-Block ohne Rollenidentitaet. Kosten: der Leser muss Aktualitaet bzw. Zugehoerigkeit selbst rekonstruieren. Fuer die aktuelle Program-Nachfolge ist der Program-Datensatz bereits die bessere Adresse.

### Implizite Wirkung gezielt verwenden

Ein Satz wie „der Empfaenger entscheidet anhand von Diff und Prueftail“ induziert Belegauswahl und knappen Bericht. Eine konkrete Gegenbedingung wie „ein gruenes Setup darf einen ungelesenen Ergebniszweig nicht verdecken“ lenkt die Probe. Das sind sinnvolle Komplementfragen aus `brief-principle.md` und `prompt-axioms.md` A1–A9; ihre Antwort muss keinen eigenen Reportabschnitt bilden.

„Bezahlt am …“ kann einen ungewohnten Schutz begruenden. Im Starttext genuegt der Mechanismus mit dem beobachtbaren Schaden; die Geschichte bekommt einen Belegzeiger. Grossbuchstaben reserviert der Renderer fuer Feldnamen und echte Stop-Grenzen. Mehrere Datumsnachtraege werden durch eine geltende Regel mit Herkunft ersetzt. Eine Rueckfalltuer braucht Ausloeser, erlaubten Zug und Endpunkt; ein historisches „sonst probier …“ verleitet zu veralteter Autoritaet. Diese Gestaltungsurteile sind abgeleitet, ihre Verhaltenswirkung ist ungemessen.

`sharpen3` §What you do und das Brief-Prinzip §Boundary begrenzen die Dosis: ein bereits passender Brief bleibt unveraendert; eine laufende, geerdete Session braucht bei einer Korrektur nur das Delta. Bei einem Denkauftrag werden die wirklich offenen Spannungen benannt. Ein universeller Ablaufplan wuerde den Entwurf voreilig festlegen.

## §3 Traeger-Zuordnung und Bloat-Regel (F3)

| Inhalt | Ein verantwortlicher Traeger | Was der Agent davon sieht |
|---|---|---|
| Produktbegriffe und Zielsemantik | `SYSTEM.md` | bei Architekturarbeit die relevanten Abschnitte; gebaute und geplante Faehigkeit klar getrennt |
| Autoritaet, Isolation, Beweispflicht, ehrliches unknown | `AGENTS.md` | portabler Kern fuer alle; Modellprofile duerfen ihn nur verengen |
| Aktuelle Rollenbindung, Rueckweg, Nachfolgeschiene | servergebauter Rollenbrief | genau die eigene Rolle und erreichbaren Zuege; kein fremdes Routenhandbuch |
| Oertliche Betriebsbesonderheiten | private Rulebook-Fragmente | nur passende Leserschaft und Anlass; keine Geheimnisse im oeffentlichen Pack |
| Rolle erklaeren und Grenzen begruenden | bestehende Rollen-Docs | kurze lesbare Ansicht desselben Rollenvertrags, mit Details auf Abruf |
| Ziel, Bedeutung, Scope, Done, Proof, Delegation | Karte und aufgabenspezifischer Brief | kompakter vollstaendiger Auftrag; valide Karte als Uebersicht, Prosa fuer notwendige Gruende |
| Quellinhalt und Bereichswissen | bestehendes Context-Manifest plus Snippet-Renderer | selektierte Abschnitte aus einem benannten Baum, Auslassungen sichtbar; tieferer Pfad auf Abruf |
| Klasse → Ausfuehrung und Lesedosis | versioniertes Ausfuehrungsregister, Vorschlag §4c | eigene aufgeloeste Konfiguration und Grenzen |
| Quoten, Cache, Reset, Anschlusswahl | separater Providerzustand im Server | nur handlungsrelevanter Ausgang: startbar, wartet, unzulaessige Alternative, unknown |
| Ergebnis und Verpflichtungen unterwegs | bestehende Reports, Program-/Inbox-/Handover-Fakten | adressierter Zustandswechsel; keine Neuauflage des gesamten Startbriefs |

**Pruefbare Bloat-Regel:** Jeder an eine Rolle ausgelieferte normative Satz hat genau eine kanonische Quelle, eine benannte Zielrolle und einen Ausloeser, bei dem er eine erlaubte Entscheidung oder einen erforderlichen Beweis veraendert; ohne diese Zuordnung wird er aus dem Starttext entfernt oder als gezielter Belegzeiger geliefert.

Ein Pin kann Quell-IDs, Auswahl, doppelte Regel-IDs, aufloesbare Anker, Bytebudgets und fehlende Pflichtfelder pruefen. Der Leser prueft den Gegenfall: „Welche falsche Handlung wird ohne diesen Satz wahrscheinlicher?“ Semantische Nuetzlichkeit laesst sich durch blosses Zaehlen nicht beweisen. Wiederholung an der Handlungskante ist erlaubt, wenn sie aus derselben Quelle generiert wird: insbesondere Report-Deckel im Abschlussrahmen. Das ist keine zweite handgepflegte Norm.

Rollen-Docs werden dabei keine neuen Rollenhandbuecher; `SYSTEM.md#Wissensordnung` schliesst solche ausdruecklich aus. Die Gerueste in §4 ersetzen spaeter bestehende Texte bzw. dienen als Renderansicht. Auch ctxPacks bleiben Auswahl ueber das vorhandene Manifest. Quellkopien und ein zusaetzlicher Ordner mit konkurrierenden Invarianten wuerden die Driftflaeche vergroessern.

**K1-Entscheidungsstelle:** Wenn gelieferte Snippets den Marker-Kontext bereits ausreichend senken, bleiben zusaetzliche Bereichspakete auf die beobachteten Restluecken begrenzt. Verfehlt K1 sein Ziel, werden erst Auswahl, Kuerzung und tatsaechliche Nutzung untersucht. Das fehlende K1-Nachher-Ergebnis verhindert heute die Entscheidung ueber Pack-Ausbau; Rollenrechte, Pflichtfelder und zentrale Modellaufloesung haengen davon nicht ab.

## §4 Entwuerfe, woertlich einsetzbar

Alle Texte sind Vorschlaege. Platzhalter werden vor Zustellung ausgefuellt; unbekannte Tatsachen erscheinen als `unknown`. Der Auftraggeber setzt die Grenzen, der Renderer setzt aktuelle Laufzeitfelder. Der Agent soll keine leere Vorlage zurueckliefern.

### (a) Lane-Brief-Template — aus Sicht der Lane

```text
KARTE · <Task-ID> · <gueltige Karte / keine validierte Karte>
ZIEL: <welches konkrete Ergebnis fuer wen gebraucht wird>
FLAECHE: <bestehende Dateien und datei#symbol>; NEU: <neue Dateien oder keine>
DONE: <ein vollstaendiger, pruefbarer Satz>
VERIFY: <ausgewaehlte Kettenschritte und ausgeschriebene Kommandos>
VERBOTEN: <ausgeschlossene Flaeche, Aussenwirkung und konkrete Stop-Grenze>

Du fuehrst diesen Auftrag als Worker-Lane aus.
BINDUNG: <Task/Program oder ungebunden>; <eigener Branch und Ausgangsstand>.
ROLLE: <aufgeloestes Harness/Modell/Effort>; KLASSE: <ID@Version oder legacy>.
AUTORITAET: <konkret erlaubtes Lesen/Aendern/Committen>; der portable Vertrag gilt.
DELEGATION: nur <benannte unabhaengige Lese-/Zaehlfragen>, hoechstens
<bewusst gesetztes Limit> Subagents, keine weitere Delegation. Ist kein Teilauftrag
benannt, arbeite selbst. Alle Schreiber dieser Lane bleiben bei dir.

AUFTRAG
<Problem, Bedeutung, gewuenschtes Ergebnis und die noetige Begruendung.
Keine Wiederholung der Karte; keine Aufforderung zu einem groesseren Projekt.>

ERDUNG
Zuerst <wenige datei#symbol bzw. Dokumentabschnitte in sinnvoller Reihenfolge>.
<Quellpaket mit Baum/Blob/Abschnitt und ausdruecklich markierten Auslassungen.>
Fehlende Definitionen gezielt mit rg -n oder ast-grep suchen. Gekuerzte Ausschnitte
bei Bedarf vervollstaendigen. Code lesen, bevor du eine Aussage darauf gruendest.
Klaere dabei still: <die fuer diesen Auftrag entscheidenden Nachbarbedingungen,
Gegenfaelle und Annahmen>. Berichte nur Unsicherheit, die das Ergebnis begrenzt.

ARBEIT UND BEWEIS
Vor der Aenderung Done und Beweis benennen. GET /api/self/gate lesen;
bei geaenderter Flaeche die aktuelle Klassifikation nachziehen.
Fuehre die oben genannten, zur Flaeche passenden Kommandos in Reihenfolge aus.
Erster roter Schritt stoppt die Kette. Probe/Setup und Produktfehler trennen;
die gleiche Baumversion erneut zu pruefen kann Nichtdeterminismus belegen.
Nach wiederholtem gleichen Fehlschlag <konkrete Abbruchregel des Auftrags> melden.
Laufende Befehle ueber ihren Abschlussrueckweg abwarten; kein sleep/tail-Polling.

RUECKWEG
Basisadresse: <vom Server eingesetzte Adresse>.
Credential: x-fleet-self-token aus FLEET_SELF_TOKEN; Wert nie ausgeben.
Blockierende Fachfrage: POST /api/self/clarifications an die zustaendige MAIN.
<Bei fehlendem Empfaenger: konkret bestaetigter Ersatzweg oder unknown.>
Du startest keine weiteren Fleet-Lanes und nutzt keine fremde Pane als Rueckweg.

ABSCHLUSS
<Bei erteilter Commit-Autoritaet:> Nur deine Aenderungen committen;
git status --porcelain muss leer sein. Commit ist der gepruefte Lane-Stand.
POST /api/self/fleet-report mit ausschliesslich {status,text}.
status: complete|needs-main|failed|handoff. text: hoechstens 4000 Zeichen.
Report vorher im Scratch schreiben und Laenge pruefen; wc -c <= 4000 ist
fuer UTF-8 eine konservative Grenze. Text: Ergebnis, Artefaktpfad, exakter
Prueftail, offene Grenze und gemessener oder geschaetzter Fuellstand.
Die Quelle fuer Schema und Deckel ist der Serververtrag; im Renderer einsetzen.
Nach angenommenem Report endet dein Turn; Antworten kommen ueber den Rueckweg.

UEBERGABE, FALLS VORHER NOETIG
Begonnene Arbeit an einem sauberen Schnitt committen. Einen handoff-Report mit
done / open / next step / open numbers ablegen, dann POST /api/self/succeed
ohne carry. Das fuehrt dieselbe Lane mit frischem Kontext fort.
```

Das ist eine **Dispatchansicht**. Zum Filen bleibt bis zur Profilmigration die heutige Reihenfolge aus `card-extract.ts#FORMAT_KEYS` verbindlich: ROLLE, GROESSE, FLAECHE, optional NEU/NACH, VERIFY, DONE, dann Prosa. KLASSE ist vorgeschlagen und heute kein neuer API-Parameter. Die Kopfkarte darf gekuerzt werden; der vollstaendige Done-Satz bleibt im erreichbaren Auftrag. Einmalige Laufzeitwerte werden nicht von der MAIN aus einer alten Vorlage abgeschrieben.

### (b) Rollenkarten-Geruest

```text
PROGRAM-MAIN · <Program-ID> · <bestaetigte Charter/Version>
Aufgabe: Fuehre dieses Program bis <konkreter Endzustand>; der Owner entscheidet
<benannte Scope-/Promotion-/Geschmacksgrenzen>.
Du entscheidest: Reihenfolge, Zerlegung, Workerwahl innerhalb des freigegebenen
Rahmens und gewoehnliche Reparatur/Integration. Kleine reversible Akte kannst du
selbst tun; umfangreiche oder unabhaengig zu beweisende Arbeit bekommt eine Lane.
Start: eigene Bindung und Program-Projektion, Repo-Vertrag, relevante Quellen.
Aktueller Zustand: GET /api/self/program-execution; dauerhafter Rueckweg:
GET /api/self/inbox. Fehlende Quellen bleiben unknown.
Handlungen: eigene Tasks filen und separat releasen; Reports gegen Diff/Proof
pruefen; Land nur bei passender Projektion und Owner-Promotion.
Warten: ein Ereignisrueckweg pro erwarteten Ausgang; unabhaengige autorisierte
Arbeit fortsetzen. Owner-Grenze mit konkretem Vorschlag ueber self/attention.
Delegation: <benannte Workerklassen und Lese-Subagents samt Limits>.
Abschluss: Program-Ergebnis und Beweiskette lesbar; offene Owner-Entscheidung benannt.
Nachfolge: <vom Server ausgewaehlte Schiene und konkreter Persistenz-/Leseweg>.

ORCHESTRATOR / FLEET CONTROLLER · <Owner-Auftrag und Portfolio-Scope>
Aufgabe: Uebersetze Owner-Ziele in abgegrenzte Program-Vorschlaege und fuehre
Entscheidungen, Abhaengigkeiten und bereits autorisierte Abschluesse zusammen.
Du entscheidest: Erdung, Formulierung und Reihenfolge deiner Vorschlaege.
Autoritaet: <konkrete Owner-Delegation>; Controller ist Scope ohne eigene Bindung.
Program-Arbeit besitzt die jeweilige MAIN; fremde Lanes haben ihren Auftrag.
Start: relevante Program-Fakten und offene Owner-Entscheidungen; benoetigte
Sicht oder Zustelladresse fehlt: unknown samt Auswirkung nennen.
Beobachtung: benannten Uebergang dem gebundenen Supervisor geben, wenn der
Rueckweg existiert. Keine stehende Pane- oder Queue-Pollschleife.
Delegation: <benannte unabhaengige Erdungsfragen>; Program-Ausfuehrung ueber MAIN.
Output: entscheidbarer Vorschlag mit Beleg und Grenze; kein wiederholter Statusstrom.
Nachfolge: <tatsaechliche Bindung pruefen; generischen oder Program-Weg einsetzen>.
```

Studio/Game-Maker erhaelt in beiden Geruesten nur einen ausgewaehlten Zusatz: akzeptierter Preflight, konkrete Spiel-/Beweisschiene, Checkpoint-Nachfolge und nach realem Spiel versiegelter Input fuer den unabhaengigen Sensory Critic. Die Pflicht bleibt in `AGENTS.md#Hard invariants` erhalten, bis der Owner einen gleich starken, nachweisbar geladenen Ersatz promoviert. Gueteklassen koennen diese Reihenfolge nicht aufheben.

### (c) Beispiel-Datensatz fuer Gueteklassen

Schemavorschlag fuer ein versioniertes, getracktes Ausfuehrungsregister. Werte und Limits sind **Entwurfswerte**, keine Messresultate. Modellbindungen folgen den lokalen Quellen aus §1 bzw. dem Astra-Auftrag; sie sind kein externer Leistungsvergleich. Nur hier stehen die Modell-Tripel.

```yaml
version: entwurf-a
classes:
  form:
    jobs: [card, summary, digest]
    executor: {harness: claude, model: claude-haiku-4-5-20251001, effort: low}
    qualification: ungeprueft-fuer-summary-und-digest
    context: {density: geschlossenes-input-output-beispiel, band: inputpaket, continuation: neuer-versuch}
    delegation: {subagents: none, workers: none}
    scripts: [deterministische-leseauswertung]
  werk:
    jobs: [bounded-build, repair, merge]
    executor: {harness: claude, model: 'claude-opus-5[1m]', effort: high}
    qualification: owner-politik-lanes
    context: {density: ziel-quellen-gegenfall, band: projektvertrag, continuation: rollenrail}
    delegation: {subagents: benannte-lesearbeit, maxConcurrent: 2, depth: 1, workers: none}
    scripts: [repo-lokal-im-write-set, ausgewaehlter-proof-durch-principal]
  fuehrung:
    jobs: [program-main, orchestrator, steward]
    executor: {harness: claude, model: fable, effort: high}
    qualification: owner-politik-mit-rollenversuchen
    context: {density: charter-entscheidungsgrenzen, band: projektvertrag, continuation: rollenrail}
    delegation: {subagents: benannte-lesearbeit, maxConcurrent: 2, depth: 1, workers: rollenautoritaet}
    scripts: [deterministische-leseauswertung, autorisierter-eigenakt]
  urteil:
    jobs: [analyse, review]
    executor: {harness: codex, model: gpt-6-astra, effort: medium}
    qualification: auftrag-gebunden-keine-pauschale-paritaet
    context: {density: quellen-gegenhypothese-evidenzgrenze, band: unknown, continuation: rollenrail}
    delegation: {subagents: benannte-lesearbeit, maxConcurrent: 2, depth: 1, workers: none}
    scripts: [deterministische-leseauswertung]
jobExample:
  kind: analyse
  executionClass: urteil
  executionClassVersion: entwurf-a
  role: worker-lane
  delegation: {questions: [zaehle-belegte-loader-dopplungen], maxConcurrent: 1}
  authority: {writes: [benannte-messnotiz], commit: true, land: false}
  resolvedExecutor: aus-dem-register-beim-dispatch
  providerConnection: nur-serverseitige-referenz
```

Die Anzahlklammern begrenzen Ressourcen im vorgeschlagenen Pilot. `scripts` beschreibt zulassbare Kategorien, noch keine technische Sandbox. Der konkrete Job nennt Kommandos und Flaeche. Die effektive Erlaubnis ist die Schnittmenge aus Owner-Autoritaet, Rollenrechten, Harness-Faehigkeit, Klassenlimit und Jobgrenze. Ein leeres oder unbekanntes Recht wird durch keine Klasse ergaenzt.

### (d) Vorgeschlagener AGENTS.md-Absatz zu Sub-Agents

```text
Sub-Agents lohnen fuer benannte, unabhaengige Lese- oder Zaehlfragen, deren
umfangreiche Quellen der Principal nicht vollstaendig selbst braucht. Der Brief
nennt die erlaubten Fragen und das Ressourcenlimit in DELEGATION; ohne benannte
Delegation arbeitet der Principal selbst. Jeder Teilauftrag enthaelt Dateien bzw.
Abschnitte, noetigen Kontext, Done, Werkzeuge und eine knappe belegte Rueckgabe.
Der Principal prueft die entscheidenden Belege und bleibt allein verantwortlich.
Sub-Agents fuehren keine Suite, keinen Commit, keinen Land und keinen /api/self-POST
aus; sie schreiben keine gemeinsamen Dateien und delegieren nicht weiter.
Schreibende Sub-Agents brauchen einen gesondert promovierten Versuch mit exklusiver
Dateizuteilung und Integrationsbeweis. Eine Worker-Lane startet keine Fleet-Kindlanes.
Ein Subagent-Ergebnis ist eine Behauptung; fehlende Belege bleiben unknown.
Kosten umfassen Principal und alle Subagents, einschliesslich deren Startkontext.
```

## §5 Gueteklassen und Profile (F4, F5)

### Guete bezeichnet eine bestandene Aufgabe

Die vorgeschlagenen Klassen form, werk, fuehrung und urteil sind Einsatzklassen mit Qualifikationsstatus. Ihre Namen versprechen keine universelle Rangfolge. Ein Modelldatensatz bekommt Eignung **pro Jobfamilie**: welche Eingaben, welches Proof-Verfahren, welcher Umfang wurden beherrscht? Fuer eine Aussage wie „guenstiger Executor genuegt“ braucht es vergleichbare Aufgaben und gleich strenge Ergebnispruefung.

Die A–E-Messung §A fand bei denselben drei Kartenfragen keine gueltige Karte durch blossen Wechsel auf groessere Modelle. Das begruendet `form` mit starkem Validator. Lane-Kontext §4 berichtet 16/18 gelandete GLM-Lanes bei filesTouched p50 1 und nur einer e2e-Lane; daraus folgt keine Freigabe fuer die typische server/e2e-Arbeit. Deshalb bleibt pi-zai ein benannter Kandidat fuer einen qualifizierenden Pilot und wird nicht automatisch zur billigsten werk-Besetzung.

Zuordnung der Rollen: Worker-Build und begrenzte Reparatur beginnen bei werk; Analyse- und anspruchsvolle Review-Arbeit bei urteil; Program-MAIN, Controller und Steward bei fuehrung. Clarify verlangt eine Quellen-/Kriteriumsleistung und startet als urteil oder ausdruecklich qualifizierter werk-Job. Supervisor behaelt bis zu einer gesonderten Qualifikation seine heutige spezielle Modellpolitik; deterministische Beobachtung bleibt im Server, eine Digest-Zusammenfassung kann spaeter form bekommen. Summary/card sind unterschiedliche Qualifikationen innerhalb von form. Merge/repair duerfen nur ihre bestehenden Toolvertraege nutzen. Diese Disposition ist vorgeschlagen, keine Umstellung der laufenden Slots.

### Ein Klassenregister, zwei Profile mit unterschiedlichem Lebenszyklus

**Agentenseite (`21ade485`):** ein versioniertes Ausfuehrungsprofil enthaelt Executor, Qualifikation, Lesedosis, erlaubte Delegationsarten und Kontextstrategie. Job und gespeicherter Versuch referenzieren Klasse plus Version; beim Dispatch wird das Tripel aufgeloest und als Snapshot receiptiert. Der Agent sieht nur seine Aufloesung. Alte Tasks behalten ihr explizites Spawn-Tripel als `legacy`; eine Besitzerentscheidung migriert sie. Gleichzeitige widerspruechliche Angaben werden laut verweigert. Die schon existierende Wellen-`klasse` aus `wave-brief.ts` erhaelt dadurch keine neue Bedeutung: das neue Feld heisst `executionClass`.

**Serverseite (`c269023d`):** ein Anschlussprofil haelt Konto-/Providerreferenz, beobachtete oder konfigurierte Quoten-/Reset-/Cachewerte, Zeitstempel, Herkunft und unknown. Diese Daten aendern sich im Betrieb und gehoeren nicht in ein getracktes Rollenprofil. Beide Profile sind ueber eine Referenz verbunden. Zwei getrennte Datensaetze erlauben eine stabile reproduzierbare Jobentscheidung und zugleich aktuelle Anschlussfakten; ein grosser Datensatz mit zwei Lesern vermischt vertraulichen Zustand und promovierte Arbeitsregeln.

Zulaessige Alternativen werden vorab je Jobfamilie qualifiziert. Bei knapper Quote waehlt der Server nur daraus; sonst wartet der Job mit Grund. Ein unbekannter Reset darf kein „jetzt frei“ ergeben. Ein billigeres Modell darf keine verdeckte Verringerung des zugesagten Beweises erzeugen. Historische Cache-/Reset-Zahlen aus der Queue sind Annahmen fuer Sensorarbeit, keine hier bestaetigten Providerfakten.

**Kontext:** Absolute Startlast, verbleibender Arbeitsbedarf und Sensorqualitaet sind getrennte Felder. Das portable Band bleibt bis zur Promotion gueltig; diese Notiz setzt keine neue Prozentgrenze. Fuer codex/pi bleibt die serverseitige Fuellung unknown, eine Selbstschaetzung ist als solche sichtbar. Nativer Compact behaelt die Instanz, Succession wechselt sie und benutzt den Rollenrail. Dauerhafte Arbeit/Pflichten werden vor beiden gesichert. Die Entscheidung zwischen beiden folgt der gemessenen Rolle-/Harness-Kombination und der realen Uebergabefaehigkeit; der alte pauschale Satz, Succession verliere alles, traegt heute fuer Program-MAIN nicht mehr.

**Brief-Dichte:** Fremder Loader und schwache Aufgabenqualifikation sind verschiedene Gruende fuer mehr explizite Information. Fehlende Fleet-Kommandos werden fuer jeden fremden Harness ausgeschrieben, auch fuer Astra. Zusaetzliche Beispiele fuer kleine Executor werden nach beobachteten Fehlern dosiert. Harte Invarianten bleiben identisch.

### Delegation nach Rolle und Preis

| Rolle | Wann sie voraussichtlich hilft | Grenze |
|---|---|---|
| Controller / MAIN | getrennte Program-Erdung, Quellenpruefung vor einer Disposition | Execution bleibt beim gebundenen Principal; keine heimliche Zweitsteuerung von Lanes |
| Worker-Lane | unabhaengige Lesefrage mit grosser Quelle und kleiner, nachpruefbarer Rueckgabe | Parent muss den entscheidenden Code seiner eigenen Aenderung weiter lesen; noch ein Suchprozess spart bei kleinem Slice wenig |
| Clarify / Analyse | unabhaengige Fakten oder Gegenhypothesen zu einem begrenzten Auftrag | Endurteil und Formulierung bleiben beim Principal; kein vorgezogenes Implementieren |
| Supervisor / Steward | begrenzter Digest aus bereits beobachteten Fakten | keine delegierten Pollschleifen, keine neuen Befugnisse |
| Wegwerf-Worker | im ersten Entwurf keine weitere Delegation | der schon kleine Eingabevertrag wuerde um einen weiteren Rueckweg wachsen |

Der Pilot bleibt bei Lesearbeit. Datei-Anzahl allein entscheidet nicht: eine zusammenhaengende Aenderung ueber viele Dateien kann mehr Parent-Verifikation brauchen als die Delegation spart. Eine grosse unabhaengige Dokumentensammlung ist der bessere Kandidat. Falls Rueckgabe plus Gegenlesen so gross wie die Quelle werden, wird selbst gelesen. Bei knapper Zeit begruendet der Principal die gewaehlte Arbeitsteilung im Teilauftrag, ohne daraus einen neuen Reportritus zu machen.

Die Verbote Suite/Commit/Land/Self-POST gelten fuer **Subagents einer Session**. Ein servergestarteter Merge-Worker ist ein anderer Principal mit eigenem begrenztem Vertrag; `merge-prompt.ts#GIT_GRANT_MERGE` erlaubt ihm heute unter anderem Commit. Diese bestehende Befugnis wird durch ein Lese-Subagent-Profil weder kopiert noch still gestrichen. Fleet-Kindlanes/Act Lead bleiben mangels gebautem Delegationsweg ausserhalb des Vorschlags (`AGENTS.md#Role contract`; `SYSTEM.md#Worker`).

## §6 Schnittliste (F6)

| Rang / Schnitt | Done-Satz | Verify-Weg | Wer promoviert |
|---|---|---|---|
| S1 · geltenden Rollen-/Abschlussrahmen konsistent machen | Bestehende Rollen-Docs, Astra-Baustein und Render nennen pro Rolle genau die heute gueltige Nachfolgeschiene, den realen Rueckweg und denselben Reportvertrag; historische Gegenanweisungen sind aus dem aktiven Text entfernt. | Textvergleich gegen `handleSelfSucceed`, `standardHandoverLines`, `LANE_EXIT_FOOTER`; Pins fuer Pflichtinformation und Gegenfaelle, danach der vom Gate klassifizierte Proof. Clarify muss vor Implementierung stoppen. | Owner promoviert Normtext; Umsetzung durch beauftragte Lane |
| S2 · K1 auswerten und einen schmalen Briefversuch fahren | K1-Population, Quellpaket-Zustellung und Markerdefinition sind dokumentiert; ein Rollenrender-Pilot entfernt nur zugeordnete Fremdrollen-/Historientexte und behaelt alle Pflichtfelder. | K1-Kommando aus §7, Render-/Auslassungspins, Vorher-/Nachher-Bytes und beobachteter Start. Fehlendes Pflichtfeld ist rot; fehlende K1-Wirkung stoppt Pack-Ausbau. | Orchestrator im delegierten K1-Rahmen, Owner fuer geaenderte Leseverpflichtungen |
| S3 · Delegationspilot mit Kostenzaehlung | Vergleichbare Leseaufgaben mit und ohne DELEGATION liefern belegte Ergebnisse; subagentCalls, Gesamtusage und fehlende Sensoren werden zusammen mit Land/Audit ausgewiesen. | Transkriptparser mit Positiv-, Null- und unbekannter Population sowie Dedupe-Probe; Pilotverfahren §7. Keine Nutzung wird nur bei vollstaendig lesbarer Quelle als null gezaehlt. | Owner fuer Pilot und spaetere dauerhafte Regel |
| S4 · Klassenregister im Schatten aufloesen | Jobreferenz, Profilversion und aufgeloestes Tripel sind durch Filing, Dispatch, Nachfolge und Workerroute pruefbar; Schattenlauf aendert keine reale Modellwahl. | Deterministische Resolver-Tests fuer legacy, unbekannte Klasse, unzulaessigen Effort, fehlende Faehigkeit und widerspruechliche Overrides; ein beobachteter Spawn je freizugebender Route, mit identischem Auftrag gegen den bisherigen Pfad. | Owner fuer Register und jede produktive Klassenbindung |
| S5 · Providerzustand verbinden | Ein Job kann wegen bekannter Anschlusslage nachvollziehbar warten; Ersatz erfolgt nur innerhalb seiner qualifizierten Alternativen, unknown bleibt sichtbar. | Sensor-/Resolver-Proben mit veralteten, fehlenden und widerspruechlichen Quoten, Resetwechsel und konkurrierenden Reservierungen; Board zeigt dieselbe Entscheidung wie der Dispatch. | Owner fuer Anschlussdaten, Reservierungspolitik und produktiven Betrieb |

**Schnittlinie nach S3:** Erst die beobachteten Fehler und Lesekosten senken und Delegation messen. S4/S5 bleiben reviewbare Entwuerfe, bis die Synthese Klassenbegriff und Autoritaetsgrenzen promoviert hat. Eine Profilverwaltung vor diesem Entscheid wuerde eine unbewiesene Taxonomie festschreiben. Weitere Bereichspakete bleiben zusaetzlich an K1 gebunden.

Fuer S4/S5 muessen die relevanten Oberflaechen ausdruecklich disponiert werden: Wire/Server **apply**; Client/Board **apply** fuer die sichtbare Aufloesung; Reverse-State/Nachfolge **apply** fuer tatsaechliches Modell und Profilversion; Docs und Probes **apply**. Claude, codex und pi erhalten nur nach ihren Adapterproben Freigabe. pi-zai bleibt fuer unbeaufsichtigten Dispatch **unsupported**; pi-ox, pi-unfenced und container sind im ersten Klassenpilot **not-applicable**, ihre bestehenden Pfade bleiben unveraendert. Eine fehlende Native-Subagent-Faehigkeit ist **unsupported**, kein Anlass fuer einen verdeckten Fleet-Worker-Fallback.

## §7 Messplan

Historische Zahlen sind Vergleichshinweise mit jeweiliger Population. Die neue Messung verwendet identische Definitionen auf beiden Seiten; unterschiedliche Populationen und Marker werden getrennt ausgewiesen. Ein kleiner Pilot gibt eine Richtungsentscheidung, keinen statistischen Paritaetsbeweis.

| Zielgroesse | Vorher-Zahl und Quelle | Nachher-Pruefung / Entscheid |
|---|---|---|
| Startlast | p50 69 314 Tokens, 180 Claude-Transkripte; Einzelzerlegung 71 387, davon Render 18 335 — Startkontext-Fixkosten §Ergebnis | erster Assistant-Turn inkl. Cache-Read/-Creation/Input; getrennt nach Harness, Modell, Render- und Werkzeugstand. Byteverringerung allein bestaetigt keine Tokenwirkung |
| Kontext bei erster Aenderung | K1 neu definiert: p50 134 k, p90 185 k, Bash davor p50 23, n=178 — Plan §4 K1 | Plan-Ziel: mit geliefertem Paket p50 <115 k und weniger Bash, n≥10. Alte 151 k aus Plan §1 sind ausdruecklich kein Vergleichswert |
| Report-Deckel | 130/181 Lanes betroffen, 334 Abweisungen — Worktrail IV §2.1 | nach aktuellem Footer jede laengenbedingte Abweisung zaehlen; Ziel keine. Reportanzahl und unbekannte Logs mitfuehren |
| Warten | 1 676 sleep-Aufrufe in 135/181 Lanes — Worktrail IV §2.5 | nur echte Statuspolls zaehlen, keine legitimen Warteprimitive; fehlender Rueckweg separat. Keine neue Pollschleife durch Delegation |
| Subagent-Adoption | Queue-Notiz 504b0854: 6/369 Transkripte, 18 Aufrufe; Lane-Kontext §4: 0/142 in anderer Auswahl | Parser auf echte tool_use plus Parent-/Child-Verknuepfung kalibrieren; den Unterschied der Grundmengen vor dem Vergleich aufloesen |
| Gesamttokens | vor dem Pilot unknown; Lane-Kontext §2.1 misst Endkontext p50 253 366, keine Gesamtkosten | Usage aller Principal-/Subagent-Versuche summieren, Input/Cache/Output getrennt und pro Request dedupliziert; fehlende Childlogs bleiben unknown |
| Land-Quote / Guete | GLM 16/18 gegen Opus 93,8 %, mit verschiedenen Scopes — Lane-Kontext §4; kein Klassenvergleich | in gleichen Jobfamilien Erstversuch, Land, Abbruch und Nachbesserung ausweisen; kein leichterer Scope im Delegationsarm |
| Rote Audits | Lane-Kontext §2.2: 209 Fenster-Audits, 102 nicht gruen; nur 67/142 Lanes bedeckt | rot, unknown und nicht gemessen getrennt, Join auf tatsaechlichen Land-Commit samt covers; „nicht gruen“ niemals pauschal als rot werten |
| Owner-Attentions je Session | unknown; Lane-Kontext §4 zaehlt Owner-Prompts, keine typisierten Attentions | neue typisierte Entscheidung mit Grund je Session zaehlen, Retries separat; weniger Meldungen bei mehr verschwiegenen Grenzen waere Verschlechterung |
| Pruefaufwand des Empfaengers | unknown — Worktrail IV §nicht-gemessen | Zeit und erforderliche Nachfragen fuer dieselbe Ergebnisart erfassen; zentrale Zielgroesse neben Tokens |

K1 ist im gelesenen Plan als Nachher-Entscheid noch offen. Der dort vorhandene Messweg lautet:

```sh
python3 docs/messungen/k1-kontext-erste-aenderung.py --since <Boot-des-Deploys> --rows
```

Das Skript wurde abschnittsweise gelesen, hier nicht mit einem geratenen Deployzeitpunkt ausgefuehrt. Es erkennt schreibende Bash-Muster heuristisch; die Nachher-Ergebnisse muessen denselben Filter benutzen. Fuer codex/pi fehlt in dieser Quelle die entsprechende Transkriptmessung.

Delegationspilot nach Notiz `504b0854(c)`: vorgeschlagen 4–6 vergleichbare Lanes mit/ohne DELEGATION-Zeile; das sind geplante Fallzahlen. Nach Bereich, Flaeche, Executor und Beweislast paaren und die Zuordnung vorab festhalten. Im ersten Versuch keine gleichzeitige Werkzeug-Diaet: das Entfernen des Agent-Werkzeugs veraendert die Startbasis. Danach kann ein separater Versuch den Preis des gesamten Delegationsangebots messen.

Erfolg fuer eine spaetere Promotion: niedrigerer Principal-Kontext, keine hoeheren vollstaendig erfassten Gesamttokens, keine Verschlechterung von Belegvollstaendigkeit oder Ergebnis. Einzelne rote Audits werden am Ursache-/Setupbefund geprueft. Mit fehlender Gesamtusage wird nur Kontextentlastung behauptet. Ein ungenutzter Subagent ist kein Fehlschlag, wenn die Frage sinnvoll selbst geloest wurde; zusaetzliche Aufrufe sind kein Erfolgssignal.

## §8 Nicht gemessen, Annahmen, Owner-Fragen

**Nicht gemessen:** K1-Nachher-Wirkung, neues Klassenrouting, nativer Subagent-Support jeder Harness, kausale Qualitaetswirkung von Tonfall oder Kontextband, reale Providerquoten/Cachezeiten, Geld, vollstaendige Nicht-Claude-Ladelast und Empfaengerzeit. Kein Code wurde geaendert und keine Modell-/Hostpolitik umgestellt. Die Subagent-Notiz ist eine uebernommene Messung; ihre Transkripte wurden hier nicht neu gezaehlt. Die historische Datenschichten-Notiz auf der gemeinsamen INDEX-Flaeche ist kein erneut durchgefuehrter Audit.

**Annahmen:** Der Owner will weniger Einlesen bei vollstaendigem Auftrag und gleicher Beweislast. Die sinnvollste Klasse kann je Jobfamilie wechseln. Promovierte Autoritaet bleibt auch bei einem groesseren Modell begrenzt. Alte Regeln werden bei der spaeteren Umsetzung nach Quellenlage ersetzt; diese Notiz ist dafuer ein Vorschlag und selbst kein neuer Loader.

**Fragen fuer die Synthese, keine Blockade dieses Entwurfs:**

1. Soll „Gueteklasse“ die pro Jobfamilie belegte Eignung mit qualifizierten Ersatzmodellen bezeichnen? Empfehlung: ja; die vier vorgeschlagenen Einsatzklassen zunaechst als Pilotvokabular verwenden.
2. Soll der erste Subagent-Pilot ausschliesslich benannte Lesearbeit erlauben? Empfehlung: ja; schreibende Delegation erst nach gemessenem Nutzen und eigener Integrationsprobe promovieren.
3. Welcher Ressourcenentscheid soll bei gesperrtem Anschluss gelten: innerhalb zuvor freigegebener Alternativen wechseln oder warten? Empfehlung: qualifizierte Alternativen vorab festlegen; bei fehlender Alternative warten und den Grund sichtbar machen.

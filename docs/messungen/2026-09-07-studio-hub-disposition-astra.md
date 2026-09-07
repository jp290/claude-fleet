---
frage: Welche bestehenden Auftraege tragen Slot 16s F1-F5, und welche begrenzten Restarbeiten fehlen?
urteil: F1 ist zwischen Abnahmetuer, Rueckmeldung und Herkunft aufgeteilt; F5 gehoert N2. F2/F3 und Teile von F4 brauchen begrenzte Restarbeiten, keine neue Gesamtreview und keine stillen Studio-Gates.
bereich: [studio, hub, reports, kontext, lifecycle]
stand: 2026-09-07
nicht-gemessen: Keine neue historische Critic-Rekonstruktion, kein Studio-Livelauf, keine Nacht-Dispatch-Freigabe, keine Implementation aus dieser Disposition.
---

# Disposition F1-F5 fuer Slot 16 und Controller

Eigenes Artefakt von Astra Review-MAIN, Program eec69528. Quelldatei von Slot 16 nur gelesen, nicht editiert oder mitcommittet: docs/messungen/2026-09-07-studio-hub-uebergaenge.md, SHA256 aac797600ba282ffef673e0c161d5e18e6da7bb141d0a040444732a0074d40b6. Ihre Untersuchung pinnt 0a116bd0; dieser Abgleich pinnt 9822d6b504f8e66a750c57bc8920f5e292a555c1. Die folgenden Aussagen und Schnittgrenzen sind hier selbst enthalten und brauchen keinen /tmp-Inhalt. Quelldatei zum Untersuchungszeitpunkt noch uncommittet; ihre spaetere Land-SHA ist unknown.

Die Uebergaenge sollen existieren: Hub und Agenten brauchen dieselben fachlichen Gegenstaende, ohne Transportstatus als Urteil zu lesen. Dies ist Disposition, keine zweite Gesamtreview. Keine Implementierungs-Lane gestartet und keine fremde Zeile umgeschrieben.

Aktueller dauerhafter Quellbezug: Program-Notiz **bf3dd138** in eec69528, vollstaendig aus fleet.json gelesen, Text-SHA256 **50e00caddd27040b9bbcd0c00a6c104156ea3768a869541df8d3eb5523317430**. Sie enthaelt den Befundtext samt Probe und eine Uebergabezeile; deshalb ist ihr Hash nicht der Dateihash. Die uncommittete Quelldatei wird von Slot 16 selbst entfernt. Keine Abhaengigkeit dieses Ergebnisses von deren Fortbestand.

**HOLD e0d625a5, nicht unveraendert releasen:** program-phase.ts:25-29 schliesst fleetReports gerade wegen deren Pruning explizit aus. Der alte Brief verlangt genau diesen neuen Eingang. Das ist ein Vertragswiderspruch, nicht nur ein fehlender Test. Zuerst dauerhafte fachliche Ausgangsrelation und zustaendigen Traeger klaeren; alternativ ein separat ausgewiesenes Reportproblem neben der bestehenden Phase, ohne deren garantierte Eingangsmenge still zu aendern. R-P allein macht eine fluechtige Report-Liste nicht automatisch zu einer erlaubten Reduktionsquelle. Diese Entscheidung ist Teil des bestehenden Auftragsabgleichs, keine neue Review-Lane.

## Ergebnis je Befund

| Befund | Disposition | Bereits vorhandener Traeger | Was dadurch NICHT erledigt ist |
|---|---|---|---|
| F1 Reportentscheidung/Pruning/Artefaktbindung | Teilweise bestehende Tasks, zwei begruendete Restgrenzen R-P und R-B unten. | 89279f1f Owner-Abnahme bei totem Empfaenger; 18e87e67 Entscheidung zur Lane; eec64457 C5 rekonstruiert Artefakt-/Entscheidungsrelationen. Neu gefunden: e219d486 soll rejected vor Land blockieren. | Keine dieser gelesenen Aufgaben garantiert allein dauerhafte Erhaltung offener Entscheidungen oder Annahme exakt bestimmter Bytes. C5 ist Analyse, kein Fix. |
| F2 Studio-Stufen/Gates/Revision | Begruendeter neuer Schnitt S-STATUS innerhalb C5/Studio-Anschluss; ausfuehrbare Studio-Stufen spaeter separat. | 70ffca29 ist Hinweis im Workflow-v2-Program, kein Implementierungsauftrag; eec64457 kann die fehlenden Beziehungen benennen. | Stage-Spawn wird nicht durch taskSpawnOf aufgeloest; gespeicherte Gate-Bools sind kein Gate. Aktuelle Revision plus Drift-Hinweis ist bewusst implementiert, kein bewiesener Verstoss gegen zugesagte Snapshot-Semantik. Kein ungefragtes Pinning oder Einschalten der Bools. |
| F3 Critic-Kontext | Begruendeter neuer Schnitt B-INPUT im bestehenden C4, nicht durch N2 erledigt. | Kontextplan/Receipt/Prompt-Journal vorhanden; bestehende C4-Planung wiederverwenden. | Audience=lane und generischer Notiz-Join enthalten keine beweisbare Critic-Blindheitsgrenze. Kein historisch kontaminierter Lauf nachgewiesen. |
| F4 Complete/Retention/terminal ohne Land | Teilweise e0d625a5; separater Abschluss-/Erhaltungsvertrag C-CLOSE fehlt. | e0d625a5 behandelt eine SENT-Lane mit complete-Report und ahead=0. | Er behandelt NICHT das terminale UNKNOWN in R2, NICHT complete mit offenen Tasks und NICHT capPrograms. R2 ist ausdruecklich konservativ; UNKNOWN nicht pauschal zu Erfolg umdeuten. |
| F5 Notizvolltext/Verdikt | Bestehender Auftrag f98facad N2; KEINE Doppelzeile. | Land-Pipeline 233e1c2b. | N3 ist lediglich Dispatcher-advisory und setzt Analyst-Aktivierung voraus; weder Volltext- noch Retention-Fix. Rollen-/Blindheitsfilter bleiben B-INPUT. |

Keiner der Gesamtbefunde ist am Pin als vollstaendig geloest nachgewiesen. Widerlegt sind die Gleichsetzungen '89279f1f loest ganz F1', 'e0d625a5 loest ganz F4' und 'N3 liefert Notiz-Volltext'.

## Bestehende Auftraege: Status, Abhaengigkeiten, exklusive Flaechen

Queue beim Abgleich gelesen; Status ist keine Ausfuehrungsfreigabe. Bestehende Briefs wurden vollstaendig fuer 89279f1f, 18e87e67, eec64457, f98facad und e0d625a5 gelesen.

- **89279f1f — sent, Fleet-Betrieb f170dc46.** Report-Abnahmetuer, Actor/Board-Sicht; server.ts, server/types.ts soweit noetig, e2e/programs.ts und betroffene Client-/Doc-Flaechen. Laufenden Write-Set nicht erweitern. Nach terminalem Ergebnis erst 18e87e67 an dieselbe Naht. Gegenfaelle: Owner darf lebende MAIN nicht uebergehen; tote/recycelte Bindung; null-sessionId konsistent; Actor bleibt Owner, nicht erfundene alte MAIN.
- **18e87e67 — pending, Fleet-Betrieb.** Bestehenden Decision->Event-Pfad vervollstaendigen, keine neue Inbox. Exklusiv server.ts Reportentscheidung/Zustellung und e2e/programs.ts Reportfamilie; Types nur bei benoetigter Eventform. Verify: reject mit Grund erreicht exakten Worker; Idempotenz; recycelter oder fehlender Worker erhaelt nichts und Grund bleibt sichtbar. Wiederholte Entscheidung selbst darf weiterhin 409 geben; Event-Dedupe ist eine andere Frage. Originalbriefs Aussagen zu Isolation/Suite mit aktuellem self/gate abgleichen.
- **eec64457 — pending, Architektur e3b3a064.** Sechs bereits definierte read-only Gegenfaelle; eigener Messnotizpfad plus INDEX.md, keine Produktflaeche. F1 Artefaktbindung und F4 Verlust als zu pruefende Luecken aufnehmen, nicht daraus Schema voraussetzen. Keine zweite C5-Lane.
- **f98facad — pending, Land-Pipeline.** N1-Land nachweisen, dann server.ts landLane/Notes-Routen, server/types.ts TaskComment/touched, task-notes.ts, src/client.ts, e2e/tasks.ts, e2e/land-durability.ts, docs/self-api.md und benannte N2-Doczeile exklusiv. Verify: Receipt-eigene Id Volltext; fremde Id 409; ungueltiges Verdikt 400; beruehrt ist nicht erledigt; killed bleibt pending; erledigt erst am richtigen Land. Neuer Gegenfall: aelteres erledigt-Verdikt darf ein neueres offen/widerlegt nicht ueberstimmen; akzeptiert muss zum tatsaechlich gelandeten Kandidaten passen.
- **e0d625a5 — pending, gebunden an b2aa5b45.** Vor Freigabe Traeger reparieren: gespeicherte MAIN Slot9/openedAt stimmt NICHT mit aktuellem Occupant ueberein. Kein Start an die andere Slot9-MAIN. Der bereits geschnittene Fall bleibt server.ts Projektionsadapter, program-phase.ts, e2e/programs.ts; sent+completeReport+ahead0 -> OWNER_GATE, ahead1 positive Kontrolle. Report-Pruning als Eingangsverlust pruefen; nur 'latest report' aus fluechtiger Liste darf keine dauerhafte Abschlussrelation vortaeuschen.
- **e219d486 — queued, programId=null.** Bestehender neuer Reject-Land-Guard, kein Auftrag von mir. Erst zuständigen Traeger zuordnen und mit 89279f1f/18e87e67 serialisieren; server.ts mergeJob/Report-Bezug und e2e/programs.ts. Entscheidender Zusatzfall vor Start: rejected Report -> Pruning -> Landversuch darf nicht als legitimer Fall 'nie ein Report vorhanden' behandelt werden. Ebenfalls A rejected, B neuer Kandidat: nicht durch Text-/Branch-Naehe entscheiden, welche Ablehnung gilt. Die bewusste Erlaubnis 'kein Report' nicht versehentlich abschaffen. Offene Policy zu decision=null an fachliche Instanz geben, nicht durch Kommentar zu einer Owner-Promotion machen.

Binding-Sensor beim Abgleich: Review eec69528 und Architektur e3b3a064 sowie Land-Pipeline 233e1c2b stimmen im openedAt mit Slots 3/9/8 ueberein. Fleet-Betrieb f170dc46 zeigt noch Slot7 mit abweichendem openedAt. Controller muss die aktuelle Nachfolge vor neuer Zustellung bestaetigen. Historische Slotnummern sind keine Empfaengeradressen.

## Begruendete neue Schnittentwuerfe, NICHT gefilet oder released

Diese lokalen Namen sind KEINE Task-IDs. Controller/jeweilige MAIN disponiert sie nach Slot16s Nachtabgleich. Kein Auftrag startet aus diesem Dokument allein.

### R-P — fachlich offene Reports gegen Transport-Pruning schuetzen

Traeger Fleet-Betrieb, nach 89279f1f; mit e219d486 gemeinsamer Erhaltungsgegenfall. Kosten: ACK kann sonst das einzige spaeter entscheidbare Objekt aus dem Bestand entfernen. Exklusive Flaechen server.ts#pruneFleetReports und dessen Aufrufer, e2e/programs.ts; Types nur wenn eine neue explizite Disposition nach dem Architekturentscheid noetig ist. Minimaler Done: 21 unentschiedene ACK-Reports verlieren keinen offenen Gegenstand; entschiedene/archivierte Gegenstaende bleiben fuer Leser nach Policy aufloesbar; historische Zeile ohne Decision ist nicht automatisch erledigt. Fehlendes Event ist keine Fachentscheidung. Obergrenze/Backpressure oder Archivstrategie vor Bau explizit festlegen: weder unbeschraenktes Wachstum als kostenlose Loesung noch stiller Verlust. Negativmutation alter Prune-Pfad muss den offenen Gegenstand verlieren und den Test rot machen. R-P ist keine automatische Abnahme.

### R-B — Entscheidung an bestimmten Gegenstand binden

Architektur e3b3a064 schliesst zuerst C5; Fleet-Betrieb implementiert danach die kleinste fehlende Relation im vorhandenen Report/Entscheidungspfad. Nicht parallel zu 89279f1f oder R-P. Kandidatenflaechen server/types.ts#FleetReport/Decision, server.ts Report-Create/Decide/Loader, e2e/programs.ts; genaue Flaechen erst aus C5. Verify: Annahme von A gilt nicht fuer B; alte Records ohne Artefaktbezug unknown; Nachfolge darf lesen, nicht alte Schreibautoritaet erben; Transport-Pruning verliert den benoetigten Fachbeleg nicht. Kein freier SHA aus Workertext als bestaetigte Bindung. Noch kein fertiger Implementierungsbrief, weil die kanonische Relation C5s Frage ist.

### B-INPUT — expliziter Blind-Input fuer Critic, bestehende Renderer/Receipts nutzen

Architektur verantwortet C4-Vertrag, Fleet-Betrieb den begrenzten Dispatch-Schnitt. Abhaengigkeit: benannte, validierte Task-Rolle/Input-Policy, nicht Modellname oder Freitext-Heuristik. Nach N2 an task-notes.ts/server.ts arbeiten oder exklusive Reihenfolge umdrehen, niemals gleichzeitig. Kandidatenflaechen server/types.ts Task-Eingang, server.ts Task-Validierung/Dispatch/Studio-Audience/Receipt, task-notes.ts nur fuer benoetigte Policy, e2e/context-plan.ts und e2e/tasks.ts; scope vor Start exakt zuweisen. Done: explizite Critic-Fixture bekommt autorisierten Critic-/Pflichtkontext und versiegelte Inputs, aber keinen generischen frueheren Urteilshinweis; normale Worker behalten relevante Notes; gefaelschte Rolle/Policy abgelehnt; unverfuegbare Quelle unknown. Vollstaendiger gelieferter Brief/Prompt-Journal und briefHash sind der Testgegenstand, nicht ein zweiter erfundener Receipt. Mutation generic-notes-on muss im Critic-Fall rot werden. Client und Wire-Loader explizit apply/unsupported/not-applicable bestimmen. Keine Garantie gegen alle nativen Loader nur aus dem Fleet-Renderer ableiten.

### S-STATUS — deklarierte Studio-Einstellungen nicht als wirksame Gates verkaufen

Architektur e3b3a064, dann benannte Fleet-Implementierungs-MAIN. Erster kleiner Schritt ist Wahrheit am Leser: deklarierte Gatewerte, effektive Durchsetzung, aktuelle und gebundene Revision unterscheidbar im MAIN-Brief/Hub. Exklusiv server.ts#studioBlockFor/Projektion, server/types.ts/src/protocol.ts soweit Payload noetig, src/client.ts Studio-Sicht und e2e/programs.ts Studio-Fixtures. Verify: alle drei Gate-Bools an/aus zeigen deklarierte Werte, nie behauptete nicht existente Enforcement; rev1->rev2 zeigt reale Lieferrevision und Drift; Program ohne Studio unveraendert. Kein automatisches Aktivieren gespeicherter Gates, keine stille Revision-Pinning-Aenderung. Task-Stage-Join und ausgefuehrte Workflow-Instanz sind eigener nachfolgender Vertrag; Owner entscheidet Snapshot vs bewusstes Folgen, vor einer wirksamen Hub-Steuerung.

### C-CLOSE — Abschluss braucht Disposition, nicht 'alle pending Tasks sind Fehler'

Architektur e3b3a064 entwirft zusammen mit bestehendem Lebenszyklus-Traeger; Fleet-Betrieb setzt nach Freigabe um. Exklusive Kandidatenflaechen server.ts#handleOwnerProgramRoute/#capPrograms, program-phase.ts nur falls explizite fachliche Ausgangsrelation vorhanden, server/types.ts und e2e/programs.ts. Policy offen: Owner darf offene Beobachtungen bewusst archivieren/uebertragen; kein pauschales Verbot von complete und kein automatisches Releasen alter Auftraege. Done: complete mit unbehandelter Arbeit benennt diese; bewusste Disposition/Transfer bleibt nach Retention rekonstruierbar; leerer bzw. vollstaendig disponierter Bestand positive Kontrolle; terminale Analyse ohne Land bleibt fachlich interpretierbar, aber niemals landed/Verify-Pass. UNKNOWN ohne Beleg bleibt korrekt. Owner-/Retention-Entscheid vor Implementierung, nicht als beiläufiger Schemafix.

## Nacht-Reihenfolge, als Vorschlag an Slot 16

1. Laufende 89279f1f zu Ende pruefen, exakten Traeger/Bindings aktualisieren. e219d486 mit R-P/R-B-Gegenfaellen und eigener programId disponieren, bevor ein scheinbar sicherer Guard gelandet wird. Keine parallele server.ts/e2e/programs.ts-Mutation.
2. Bestehende 18e87e67 und f98facad seriell nach Write-Set-Freigabe. C5 eec64457 kann read-only parallel laufen, solange sein INDEX-Edit nicht mit anderen Docs-Lanes kollidiert.
3. R-P nach Retention-Entscheid; B-INPUT vor Einsatz eines automatisierten blind genannten Studio-Critics. Reihenfolge R-P/N2 nach freier Flaeche und finalem Nachtplan, nicht aus dieser Liste blind dispatchen.
4. C5-Ergebnis fuer R-B/S-STATUS nutzen; C-CLOSE nach Dispositionspolicy. Hub nur echte wirksame Status zeigen lassen; Game-Ablauf erst mit eindeutigem Rollen-/Input-Vertrag. Bestehender Widerspruch MAIN-eigenes-Play vs v2-Verbot bleibt Owner-Rollenentscheidung, kein neues Gate aus dieser Notiz.

N3/Analyst-Aktivierung, Modellwechsel, Deckel, Deploy und globale Config bleiben ausserhalb. 95d09e33 (Audit Work/Wait) ist querliegende bestehende Effizienzarbeit, kein F1-F5-Fix; sie ist ebenfalls queued ohne programId und braucht Zustaendigkeit, keine Doppelzeile.

## Gegenpruefung und Verify

Gelesen am Pin: server.ts:6511-6521 prune; :6784-6830 Entscheidung/ACK; :1625-1632 capPrograms; :8159 taskSpawnOf; :8408-8470 Studio/Notes/Receipt; :19553-19596 Studio-Renderer; :21225-21237 complete. server/types.ts:416-424 Decision und :1365-1370 Studioform; task-notes.ts:17-22/:72-121; program-phase.ts:137-147; docs/notizen-verarbeitung-2026-09-06.md:102-132. Gezielte Suche Gate-Bools in server.ts/server/src fand Validator-/Typstellen, keinen auswertenden Verbraucher. Kein Vollstaendigkeitsbeweis ueber beliebige andere Repos.

Die eingebettete reine Funktionsprobe von Slot 16 wurde nach Lesen erneut ausgefuehrt: Pruning mit 21 ACK-Reports, R2 killed-empty vs landed, gleiche-Datei-Notiz vs fremdes Repo. Originaltail: `ALL EXPECTED OBSERVATIONS CONFIRMED`. Kein Server gestartet, kein Livezustand geschrieben. Ein vorheriger eigener kombinierter Probeversuch hatte einen Syntaxfehler und mass nichts; er ist kein Produkt-Fail. F2-Render/Gate/Rev-Verhalten hier am Code gegengelesen, deren zusaetzliche Funktionsproben nicht erneut ausgefuehrt. Historische Critic-Kontamination und globale Vollstaendigkeit bleiben unbekannt.

Reproduktion der hier wiederholten Beobachtungen ohne fremde Datei:

```sh
bun run - <<'TS'
import {phaseOf} from './program-phase.ts';
import {notesForTask,renderNotesBlock} from './task-notes.ts';
const source=await Bun.file('server.ts').text();
const start=source.indexOf('function pruneFleetReports():');
const end=source.indexOf('// STN-1 envelope',start);
if(start<0||end<start) throw Error('probe extraction failed');
const body=new Bun.Transpiler({loader:'ts'}).transformSync(source.slice(start,end));
const reports=Array.from({length:21},(_,index)=>({id:'r'+index,eventId:'e'+index,reportedAt:index,decision:null}));
const events=reports.map(report=>({id:report.eventId,status:'acknowledged'}));
const after=new Function('fleetReports','fleetEvents','FLEET_EVENT_TERMINAL','FLEET_REPORT_KEEP','audit',body+'\npruneFleetReports();return fleetReports;')(reports,events,['acknowledged'],20,()=>{});
if(after.length!==20||after.some(report=>report.id==='r0')) throw Error('F1 observation changed');
const input={task:{id:'probe',kind:'auftrag',status:'done',note:null},lane:null,merge:{inflight:false,start:false,last:null},openAttention:0,outcome:{disposition:'killed-empty',headSha:null},idleThresholdMs:1000};
if(phaseOf(input).phase!=='UNKNOWN') throw Error('F4 observation changed');
if(phaseOf({...input,outcome:{disposition:'landed',headSha:'a'.repeat(40)}}).phase!=='CONTINUE') throw Error('landed control failed');
const note={id:'n',repo:'/a',files:['game.ts'],kind:'notiz',status:'pending',created:1,text:'Prior critic judgement.'};
if(!renderNotesBlock(notesForTask({id:'critic',repo:'/a',files:['game.ts']},[note])).includes(note.text)) throw Error('F3 observation changed');
if(renderNotesBlock(notesForTask({id:'critic',repo:'/b',files:['game.ts']},[note]))!=='') throw Error('foreign-repo control failed');
console.log('ALL EXPECTED OBSERVATIONS CONFIRMED');
TS
```

Fuer spaetere Code-Lanes: self/gate, volle selektierte Kette, Suite-Offer/isolated bei e2e-/Lebenszyklus-Aenderung, Mutation je Gegenfall; Logs ausserhalb Repo und Originaltail. Hier nur Docs-only install+pins zur Landbarkeit dieser Disposition, kein Nachweis eines fertigen Produkts. Probe- und Kurzkettentail werden im Commit-Body festgehalten. Kein Claim 'F1-F5 geloest'.

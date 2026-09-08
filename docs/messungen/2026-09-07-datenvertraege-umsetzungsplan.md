---
frage: Wie werden Datenvertraege, Agenten-Briefs und Effizienz ohne weitere parallele Wahrheitsschichten umgesetzt?
urteil: Bestehende Rueckwege, Rollen-/Kontextuebergaben und gemeinsame Evidenzprojektionen schliessen; C0-C5 sind abgegrenzte Umsetzungsvorschlaege, keine erledigten oder automatisch freigegebenen Arbeiten.
bereich: [datenlayer, kontext, briefs, workflow, hub]
stand: 2026-09-07
nicht-gemessen: Kein vollstaendiger neuer Live-Abgleich aller Task-Staende; kein Nachweis bereits implementierter C0-C5-Schnitte oder eingesparter Modellkosten.
---

## Lesestatus dieser versionierten Fassung

Dies ist Astras konsolidierter Plan einschliesslich Slot-16-Abgleich, zur Sicherung aus der lokalen Arbeitsfassung uebernommen. Die datierten Zwischenstaende bleiben als Entscheidungsherkunft erhalten. Fruehere Aussagen in diesem Text wie „lokaler Arbeitsplan“ beschreiben den Status vor dieser Versionierung; diese Fassung ist das dauerhafte Referenzartefakt. Aktuelle Dispatch-, Land- und Deploy-Freigaben ergeben sich NICHT aus historischen Slotnummern, Queue-Reihenfolgen oder diesem Dokument. Fortschritt muss je Task neu belegt werden. Der abschliessende Outside-in-Befundregister-Auftrag wird durch diesen Umsetzungsplan nicht als erledigt markiert.

# Datenvertraege, Agenten-Brief und Effizienz: Umsetzungsauftrag

Aktualitaet: Die unten genannten Slotnummern und Queue-Reihenfolgen sind datierte historische Staende, keine heutigen Dispatch-Anweisungen. Neuester fachlicher Nachtrag: Slot-16-Abgleich am Ende dieses Dokuments. Vor Umsetzung Live-Bindung, Task-Zustaendigkeit, Landstand und exklusive Schreibflaeche erneut pruefen.

Owner-Richtung 2026-09-07 an Astra Review-MAIN: Vorschlaege sorgfaeltig ausarbeiten und implementieren, Brief-Schicht und Effizienz einschliessen, Controller zur priorisierten Umsetzung einbinden. Dieser Plan konkretisiert die Richtung; er erteilt keine neue globale Rolle, keine Host-Schreibrechte und keine automatische Retention-Loeschung. Stand des Quellenabgleichs: c45ebebca51263c333344732929170de0e3127cf. Controller aktuell Slot 6, Nachfolger von Slot 10.

## Ziel und Abschluss

Fleet soll eine Entscheidung und ihre Belege vom bestaetigten Ziel bis zur ausfuehrenden Rolle tragen, ohne dass eine Frontier-Session sie aus der gesamten Geschichte rekonstruieren muss. Fertig ist ein Schnitt nur mit akzeptiertem Diff, Originalbeweis, terminalem Land und benanntem Audit-Ergebnis. Unknown bleibt unknown. Der Gesamtauftrag ist erst fertig, wenn ein frischer gebundener Empfaenger an den unten genannten Gegenfaellen den richtigen Zielstand bekommt und die benoetigten Quellen auffinden kann.

Keine neue Program-Sammlung: Umsetzung in vorhandenen Traegern. Astra entwirft/prueft, Controller koordiniert Prioritaet und autorisierte Integration/Deploy, jeweilige MAIN fuehrt ihren Teil. Bounded Produktarbeit durch Opus 5 high, unveraendertes Tripel claude / claude-opus-5[1m] / high. Fable/Opus-Controller soll urteilen und bestehende MAINs beauftragen, nicht nur die Nachricht archivieren. Kein eigenmaechtiger Modellwechsel an lebenden Slots.

## Die gemeinsame Mindestform, kein neues Universalobjekt

Jede neue oder geaenderte Datenschicht beantwortet vor ihrem Bau:

| Dimension | Zu entscheiden und zu pruefen |
|---|---|
| Identitaet | Stabile Id des fachlichen Gegenstands; Session/Slot nur bei occupantgebundenen Akten. |
| Schreiber | Wer schreibt welchen Fakt, mit welcher Autoritaet und welchem Commit-/Persistenzpunkt? |
| Leser | Konkrete Route oder Funktion und die Entscheidung, die diese Information ermoeglicht. |
| Herkunft | Program/Task/Report/Commit/Audit als Referenzen; kopierte historische Teile als Snapshot mit Version kenntlich. |
| Gueltigkeit | Bestaetigt, vorgeschlagen, widerlegt, ersetzt oder unknown; Deutung wird nie implizit Owner-Regel. |
| Lebensdauer | Was bleibt aktiv, was wird archiviert, was darf nach welcher bestaetigten Policy entfernt werden? |
| Verlust | Fehlende Quelle, Schreibfehler, Teilabdeckung, Rotation und Sessiontod bleiben unterscheidbar. |
| Kosten | Begrenzte Abfrage-/Payload-Groesse; keine dauernde Vollauswertung durch Modelle. |

Die Tabelle ist eine Entwurfscheckliste, kein neuer verpflichtender Regelbuchtext. Keine AGENTS-/Regelbuch-Promotion in diesem Auftrag.

## C0: belegter Nullbudget-Fehler, jetzt implementierbar

Traeger Astra Review. server.ts:2025-2030#capTasks benutzt slice(-keepDone). Bei keepDone=0 behaelt slice(-0) alle terminalen Zeilen. Isolierte Bun-Sprachprobe ist ausgefuehrt: keepDone=0, vier terminale Zeilen behalten. Das widerlegt nicht die beabsichtigte Erhaltung aller offenen Tasks; MAX_TASKS ist dafuer keine harte Schranke.

Nur Nullbudget-Auswahl und zugehoerige Regression pruefen/reparieren, keine Evakuierung/Retention/Deckelpolitik. Cases: leere Liste, unter Deckel unveraendert, 199 live + mehrere terminale behaelt genau neueste eine terminale, 200 live + terminale behaelt null terminale, >200 live behaelt alle live aber keine terminale, nur terminale behaelt neueste 200; Reihenfolge unveraendert. Tests gegen tatsaechlich ausgefuehrte Produktionsfunktion, keine Regex-Implementierungs-Abschrift. Mutation alter Nullbudget-Pfad muss gezielt rot sein. Keine Live-Queue zu Testzwecken fuellen oder beschneiden.

Done ist der Code-/Testbeleg, nicht ein live beobachteter Loeschvorgang. Deploy-Auswirkung auf derzeitige terminale Zeilen im Report nennen; bestehender historische Join-Verlust wird dadurch nicht geloest. Land/Deploy nur durch Integrator nach Review. Die aktive server.ts-Lane 779eb456 und spaetere Belegungen vor Start abgrenzen.

## C1: Rueckweg und Program-Handoff, bestehende Arbeit vorziehen

Traeger Fleet-Betrieb. Vorhanden: 18e87e67 Reportentscheidung -> Lane; c464af30 Attention-Schreiber; 417d2be5 Report -> Program; 288f6359 Audit -> Program; c62aa3e9 adressierter MAIN/Controller-Rueckweg; 8e1e0be4 Handoff am Program statt in Git. Inbox-Basis d6d5cb2/453092c existiert. Kein zweites Inbox-Ledger und keine parallele Nachrichtenzustellung bauen.

Reihenfolge im Traeger: zuerst kleinste Report-Rueckgabeschleife 18e87e67; danach Program-Schreiber und Handoff nach deren bestehenden Voraussetzungen. Schnitt c62aa3e9 gegen Adressierbarkeits-Tagesmandat 446e77f8168e9d8bb5612ce6 abgrenzen, dessen Publikation 180d3c92 queued ist. D2 e88884c8 bleibt eigene frische-Codex-Identitaetsnaht, nicht blind hineinziehen.

Zusaetzliche Done-Faelle zur Schaerfung bestehender Briefe: reject kommt beim exakten Worker an, Wiederholung erzeugt keine zweite Entscheidung; recycelter Slot bekommt keine Nachricht; Nachfolge-MAIN sieht offene Program-Schuld; Bezug auf geloeschte Quelle zeigt unknown; gelesen ist nicht akzeptiert. Handoff enthaelt nur Urteil/Restunsicherheit, nicht Kopien ableitbaren Zustands. Eine Frischgruendung fuer das Program braucht keinen globalen HANDOFF-Stapel. Andere Dateien im selben Git-Branch loesen das main-Bewegungsproblem NICHT.

## C2: Notiz-/Befund-Lebenszyklus, erst den Leser fertig bauen

Traeger Land-Pipeline: f98facad N2 setzt gelandetes N1 voraus. Bestehenden Brief aus docs/notizen-verarbeitung-2026-09-06.md:102-126 verwenden. N1 task-notes.ts:72-120 bleibt fuer Dateirelevanz zustaendig.

Schwerpunkt: beruehrt ist keine Erledigung, Worker-Urteil ist keine Owner-Promotion, Erledigung muss an den passenden gelandeten Stand gebunden sein. Gleiche Branch mit spaeter revidiertem Report, failed Land und killed Lane duerfen nicht versehentlich die Notiz erledigen. Fremde Id und andere Occupants sind Negativfaelle. Textdokumente mit Regeln duerfen durch ein erledigt-Urteil keine neue bindende Regel erhalten.

Erst danach separater begrenzter Dispositions-/Archiv-Schnitt: unverarbeitete Beobachtung, bestaetigter Befund, offene Entscheidung, ausfuehrbarer Auftrag und explizit blockierter Auftrag unterscheiden. Diese Unterscheidung muss nicht je eine neue Datei/Top-Level-Art bekommen. Bestehende Mechanismen nach Codeabgleich vorziehen. Kein Auto-Verfall von pending nach Alter. Befund darf aus aktiver Queue verschwinden, wenn sein zustaendiger Leser und seine Disposition im Archiv weiter aufloesbar bleiben. Erster Migrationstest nur Kopie/synthetischer Bestand; kein Live-Loeschskript.

## C3: Historischer Join und ehrliche Abdeckung, nicht grenzenlose Historie

Noch keine dedizierte offene Implementierungszeile bei der gezielten Suche gefunden; Controller muss aktive Charters gegenpruefen und GENAU EINEN Traeger benennen. Architekturvertrag in e3b3a064, Implementierung nach Annahme in Fleet-Betrieb; Audit-Determiniertheit beurteilt Messfaelle, bekommt keinen zweiten parallelen Flake-Auftrag.

Quellen: server/persist.ts:1-75, server.ts#TRAIL_DIRS/#TRAIL_MAX_FILES/#TrailStatsView (am gelesenen Stand :23610-23705), e2e/trailstats.ts:1-353, docs/messungen/2026-09-04-datenschichten-audit.md:70-106. Vor Implementation alte Outcomes ohne taskId, alte Tasks ohne Program und .1-Rotation ausdruecklich behandeln.

Erster landbarer Schnitt: Reader-Vertrag samt Tests fuer vollstaendig/teilweise/unlesbar/nicht-mehr-vorhanden. Danach minimaler Archiv-/Herkunftsbeleg fuer neu aus aktiver Queue entfernte referenzierte Tasks. Wahl Snapshot vs Archivzeile anhand bestehender Leser; keine vollstaendige Task-Kopie in jedes Ledger. Ein fehlender historischer Beleg darf nicht kuenstlich erzeugt werden.

Done: Neuer Outcome-Bezug bleibt nach Task-Evakuierung mit begrenzter Herkunft aufloesbar; Legacy-Verlust wird benannt. Fuer angefragte Suite+Zeitfenster stimmen Resultat, Coverage und ausgelassene Teilmenge gegen eine bekannte Fixture. Beide Trail-Register, Rotation waehrend Lesen und kaputte JSONL-Zeile abdecken. Readergrenze darf keine globale never-failed-Aussage erzeugen. Archiv-/Loeschfristen sind eine explizite Owner-Entscheidung, keine beilaufige Implementierungswahl.

## C4: Agenten-Brief als Verbrauchervertrag

Bestehender Anknuepfungspunkt 21ade485 Modellklassen-Profile, aktuell ungebunden; Controller bindet ihn vor Dispatch an den bestaetigten Traeger und schaerft den Modellklassenfokus nach folgenden Grenzen. Kein blindes Ranking von Modellmarken, keine kopierte Rate-/Cache-Annahme. Provider-/Usage-Profil c269023d bleibt getrennt zu verifizieren.

Eingang: Pflichtvertrag, bestaetigtes Program-Ziel samt Scope, konkrete Aufgabe, zustaendige Entscheidungen, Belegreferenzen, Harness-Faehigkeiten, Kosten-/Stop-Grenzen. Ausgang: deterministisch zusammengesetzter Brief plus Auswahlbeleg. Gespeichert werden Version/Fingerprint und ausgewählte Referenzen, nicht behauptetes Verstehen. Pflichtkontext darf bei Budgetmangel nicht still abgeschnitten werden: expliziter Overflow/Stop oder begruendete kleinere Aufgabe. Optionale Quellen duerfen begrenzt werden, mit Auslassungsgrund.

Auswahlachsen: Rolle und Aufgabe zuerst; beobachtete Harness-Capability fuer Werkzeuge/Transport; Modellprofil nur fuer nachgewiesene Anpassungen. Harte Invarianten bleiben identisch. Ersetzte Entscheidungen werden nicht parallel als gueltig geliefert. Untrusted Queue-/Dokumenttext bleibt Daten, niemals neue Autoritaet.

Quellen fuer einen spaeteren genauen Brief: context-packs.ts:1-200, context-manifest.ts:1-196, task-notes.ts:1-121; aktuelle Dispatch-/Succession-Renderer erst per Symbol lokalisieren. Bestehende S2D-/GLM-Korrekturen 56e4427d/1d0f4ca4 abwarten, nicht abgelehnte Befunde als Schema-Grundlage behandeln.

Done eines ersten Code-Schnitts: identische Eingaben ergeben identischen Brief/Receipt; bestaetigte relevante Entscheidung wird geliefert auch ohne zufaelligen Dateischnitt; fremde/ersetzte Entscheidung wird nicht geliefert; unverfuegbare Capability wird explizit unsupported; Budgetueberlauf ist sichtbar. Golden-Fixtures fuer claude/codex/pi pruefen reine Renderer ohne echte Modellaufrufe. Echte Annahme/Ack getrennt als gezielte Acceptance-Probe, nicht als quota-abhaengiger Pflicht-Gate jedes Lands.

## C5: Zielprojektion fuer Hub UND Agenten

Traeger Fleet-Architektur e3b3a064; kein zweites Hub-State-Objekt. Erster Artefakt-Schnitt read-only auf vorhandenen Record-Fixtures, bevor eine neue UI geschrieben wird. Program-Kriterium -> Task -> Reportentscheidung -> exakter Kandidat/Land -> Audit-Coverage; fehlende Relationen unknown, nicht aus Prosa plausibel erfinden.

Pflichtfaelle: GLM f781c60 gelandet+Gate gruen, fachlich rejected, Korrektur offen; Audit auf anderem koaleszierten Tip unknown; Land vor Review; geaenderter SHA nach alter Annahme; Nachfolgerin mit offener Entscheidung; entfernte Referenz. Das Ergebnis muss die widerspruechlichen Dimensionen gleichzeitig zeigen, nicht zu einem gruenen Gesamtstatus glatten.

Erst falls die Fixture-Rekonstruktion zeigt, dass eine Relation nirgends existiert, diese minimal an der Quelle ergaenzen. Menschenansicht und Rollen-ContextPack konsumieren denselben Zustand. Keine Abschlussprozente aus erledigten Taskzahlen, keine automatische Program-Completion durch Sprachmodell.

## Effizienz ist Teil jedes Schnitts

Kein pauschaler Kontext-/Token-Zielwert ohne Baseline. Fuer Fixture-Saetze messen: ausgewaehlte Bytes, ausgelassene Pflichtinformationen (muss 0 sein), gelesene Records/Bytes, Renderzeit, deterministische Cache-Invalidierung. Fuer echte bounded Arbeit spaeter vergleichen: Rueckfragen wegen fehlender Fakten, manuelle Relaisakte, Korrekturrunden, Zeit bis fachlich angenommenem Ergebnis, Verify-Wait getrennt von Work. Kleine Fallzahl als solche markieren; mehr Lands ist kein Qualitaetsbeweis.

Ordnung: redundante Informationen entfernen, Quellenzugriff vereinfachen, begrenzte Abfragen/Indexe, erst dann Cache/Automatisierung. Cache-Key muss relevante Quellrevisionen und Auswahl-/Profilversion tragen, nicht nur TTL. Kein Voll-Graphify je Entscheidung im heissen Pfad. Keine globale Pipeline auf echte Modell-Auth/Usage als Pflichtpruefung aufbauen.

## Wellen: sinnvoll, aber kein Abkuerzen der Bedeutung

Bestehende Zeilen in Land-Pipeline: W1 e0113460 Program-Grenze, W2 0f5019ac bestaetigte Flaeche, W3 05611418 n Tasks -> eine Lane mit Selbst-Split. Alle bei Lesung pending. W3 darf erst nach W1+W2 landen/startbar werden; die heutige singular taskId-Bindung nicht mit Briefprosa umgehen.

Buendel-Kriterium ueber die technische Eignung hinaus: gleicher bestaetigter Traeger, gemeinsames fachliches Problem, kompatible Schreibflaeche, gemeinsamer Proof, klare individuelle Abnahme. Derselbe Name server.ts reicht nicht. Sinnvoller Kandidat nach Pruefung: zwei kleine Korrekturen derselben Notiz-/Receipt-Naht. Schlechter Kandidat: Retention-Loeschung + Rollenprofil + Audit-Scheduling. C0 ist bereits EIN Problem mit seinen Tests, keine kuenstliche Zwei-Task-Welle.

Eine Welle braucht pro Task Accepted/Unresolved mit Beleg-SHA. Bei Teilerfolg duerfen nur die nachgewiesenen Tasks done werden; verbleibende bleiben mit Grund offen. Proportionalitaet aus tatsaechlichem Diff/Verify-Plan, nie aus Brief-Etiketten. Ein Land spart nicht automatisch einen ganzen Audit, weil Coalescing und Laufzeit variieren; Einsparung erst nach Messung behaupten. Gate-aendernde Arbeit und Docs/Code-Klassenregeln nicht still aufweichen.

## Konkrete Controller-Uebergabe

1. KORRIGIERT nach Controller-Rueckbestaetigung Slot 6, 2026-09-07 14:2x: W1 -> die zwei bereits queued Docs-Korrekturen -> W2 -> C0 a42aa900 -> W3. Die vorgeschlagene Zurueckstellung der Docs-Korrekturen ist zurueckgenommen. C0 bleibt pending und wird von Astra NICHT vor W2-Land released: die gemeinsame Schreibflaeche liegt in e2e/tasks.ts, nicht nachgewiesen in server.ts#capTasks. Controller nennt W1 laufend und den Je-Repo-Deckel 779eb456 noch ungelandet; dies sind Controller-Messungen, hier nicht unabhaengig reproduziert. Keine fremde Lane abbrechen. Nach terminalem W2-Land den aktuellen Write-Set erneut pruefen, nicht lediglich eine alte Slotnummer freigeben.
2. Fleet-Betrieb-MAIN soll 18e87e67 und 8e1e0be4 sowie benoetigte Schreiber anhand dieses Plans konkret vorziehen; Land-Pipeline-MAIN N2 und W1/W2/W3. Keine Duplikate filen. Jede MAIN nennt naechsten tatsaechlich startbaren Schnitt und exklusiven Write-Set.
3. Architektur-MAIN nimmt C3/C4/C5 als zusammenhaengenden Vertragsentwurf auf und klaert bestehende Tagesmandate/21ade485, statt erneut die Gesamtcodebase zu reviewen. Neue Implementierung erst nach belegter Gap-/Traegerentscheidung und kleinem Brief.
4. Rueckantwort an Astra mit IDs, Empfaengerbindung, Reihenfolge, write-set-Konflikten und einem terminalen Beleg pro erledigtem Schnitt. Keine Erfolgsmeldung allein wegen filed/queued. Controller-Inbox/Notizroute verwenden; keine tmux-Injection.
5. Land nur nach fachlicher Annahme des exakten Kandidaten; Controller/Integrator hat Land-/Deploy-Verantwortung. Aktuelle Owner-Promotion beachten. Eine Ablehnung ist Nacharbeit, nicht ein zu archivierter Transporthinweis.

Dieses Dokument ist ein ausgearbeiteter Plan, nicht die Behauptung, dass C0-C5 bereits implementiert sind. Skript-/Suite-Outputs und empfangene Entscheidungen werden an den jeweiligen Task gebunden; eine neue Fortschrittserzaehlung ersetzt keinen Beleg.

## Controller-Nachtrag 2026-09-07 14:2x

Die Rueckbestaetigung ist eingegangen. Land-Pipeline-MAIN laut Controller nun Slot 8, Fleet-Betrieb Slot 7; Autoritaet vor eigener Aktion stets live pruefen. Die Wellen-Zahlen sind Kandidaten-Schaetzungen, keine gemessene eingesparte Laufzeit. Program-Grenze, Selbst-Split und N:1 sind bereits Teil W1/W3; keine neue Parallelbeauftragung. Gemeinsame fachliche Ursache/Proof bleibt Astras Auswahlvorschlag, kein heimlich zusaetzlicher Owner-Gate.

Zwei vom Controller uebermittelte Owner-Entscheide fuer spaeteren Review-Abgleich: Deploy-Preflight gegen schmutzigen Tree bzw. Tip ohne fleet/land-Note -> Fleet-Betrieb; undo-land auf dem eigenen Hub mit force-with-lease -> Land-Pipeline. Quellbehauptungen kommen aus P3-Fassung 027deaa5, laut Controller noch NICHT akzeptiert. Owner-Richtung, fachliche Annahme und nachgewiesener Ist-Mechanismus deshalb getrennt halten. Hier weder P3 neu untersucht noch Deploy/Force-Push ausgefuehrt oder freigegeben. Konkrete Task-IDs der Umsetzung noch nicht mitgeteilt. Beim Deploy-Vertrag den bereits beobachteten Unterschied zwischen Commit innerhalb eines Lands und terminalem Land-Tip pruefen lassen; keine Behauptung, jeder legitime Git-Commit trage eine eigene Land-Note.

## Slot-16-Abgleich: vorhandene Mechanismen bis zum Empfaenger schliessen

Owner-Auftrag 2026-09-07: Slot 16 lesen und in Plan/Vorgehen aufnehmen. Einmalige ausdruecklich angeforderte Pane-Lesung, keine Ueberwachung. Gepruefter Occupant: openedAt 1788796142583, sessionId 01a07c8f-0863-7452-ad3b-0937623fc75c, Codex im Fleet-Checkout, keine aktuelle Program-Bindung. Das historische complete Program mit MAIN slot=16 hat ein anderes openedAt und ist NICHT diese Session. Modell/Effort im Fleet-Slotrecord null; die Pane zeigt Astra/medium, unterschiedliche Sensorquellen nicht verschmelzen.

Slot 16 hat drei begrenzte Opus-5-Lese-Worker fuer Historie, Betrieb/Hub und Rollen/Kontext eingesetzt und deren Schlussfolgerungen selbst korrigiert. Gelesen wurde ihre sichtbare Synthese, nicht erneut jeder Workerbericht. Sie nennt den API-Zugriff 401; ihr behaupteter Livezustand bleibt daher unknown. Kein Nachweis eines bereits implementierten Fixes. Ihre Empfehlung passt zum Owner-Ziel: Frontier-Urteil nicht als Ersatz fuer fehlende Betriebsdaten verwenden.

### Einordnung statt neuer Auftraege

| Bestehender Schnitt | Aufgenommene Schaerfung | Abnahme / Grenze |
|---|---|---|
| C1 Rueckweg/Nachfolge | Zuerst einen vollstaendigen vorhandenen Informationsweg schliessen: Antwort entsteht -> Program erhaelt sie -> berechtigte Nachfolgerin kann sie lesen. Schreiber und Leser zusammen testen, nicht nur Inbox-Form. | Nachfolge sieht offene Antwort; fremdes Program/recycelter Slot nicht; gelesen bleibt ungleich akzeptiert; fehlende Referenz unknown. Bestehende Schreiber-Auftraege nutzen. |
| C4a Rollenuebergabe | Generische Nachfolge und Program-MAIN-Gruendung unterscheiden. Kompakter Einstieg aus tatsaechlicher Bindung bzw. explizitem Auftrag, ohne aus Slotlabel/Harness Controller-Autoritaet zu erfinden. | Renderer-Fixtures fuer Program-MAIN, Supervisor und ungebundene Session. Fehlende Rollenautoritaet explizit unknown; keine automatische Supervisor-Umbindung. Ein uebergebener Auftrag erteilt keine neue Promotion. |
| C4b Kontextauswahl | Bestehenden Plan mit benoetigter Aufgabe/Anlass speisen, bevor neue Packs entstehen. Pflichtorientierung direkt; vertiefende Evidenz nachladen. Ein neues Rollenfeld nur, falls vorhandene Eingaben die benoetigte Auswahl nicht ausdruecken koennen. | Gleiche Eingaben deterministisch; verschiedene reale Aufgaben waehlen passende Quellen; Pflichtkontext nicht abgeschnitten. Tests am gerenderten Empfaengerbrief und Auswahlbeleg, nicht bloss Textsuche nach Funktionsnamen. |
| C5 Hub/Agentensicht | Kompakte Betriebsprojektion anzeigen, Details bei Bedarf. Die Owner-Programliste und MAIN-Ausfuehrungsprojektion nicht als identische Payload behandeln: Status allein enthaelt nicht automatisch Land-/Auditbeweise. | Gemeinsame Fixtures pruefen die Uebereinstimmung derselben Fakten und sichtbar fehlende Evidenz; Berechtigungsunterschiede bleiben erhalten. Keine blosse Client-Aenderung versprechen, bevor benoetigte Evidenz in der passenden Route vorhanden ist. |
| Effizienz / Land-Pipeline | Slot 16 nennt Land 974ea00 mit ffRounds=2 als Beispiel fuer konkurrierende main-Bewegungen. Kein neuer Check-vor-Commit als vermeintliche Sperre: zwischen Check und Schreiben bleibt ein Rennen. | Beleg hier nur aus ihrer Synthese, nicht unabhaengig nachgemessen. Vor neuem Auftrag vorhandene Land-Pipeline-Arbeit abgleichen; ein spaeterer Fix muss das Rennen deterministisch reproduzieren und verhindern oder offen als nur beratend gelten. |

C4a/C4b sind Teilgrenzen des bestehenden C4, keine zwei automatisch gefileten Lanes. Sie werden seriell in exklusiven Schreibflaechen geschnitten. Fachliche Reihenfolge: bestehende Rueckwege fertig -> Rollen-/Kontextuebergabe -> gemeinsame Hub-/Agentenprojektion. C0 und bestehende Land-Pipeline-Abhaengigkeiten werden dadurch nicht umpriorisiert; kein neuer Dispatch aus diesem Dokument.

### Eigene begrenzte Gegenpruefung am Fleet-HEAD edda7cf4b6e5d1fdadd370303a1a4d4bb67445aa

- server.ts:5930-5943 gelesen: buildSuccessionBrief erhaelt nur carry und verweist auf state/register/HANDOFF/Queue; diese Funktion selbst fuegt keine konkrete Rollenbindung ein. Kein Anspruch, damit alle spaeteren Loader untersucht zu haben.
- context-plan.ts:25-31 gelesen: Eingaben sourceTree/harness/mode/triggers/capabilities; kein explizites role-Feld. Das allein beweist nicht, dass Rollenrelevanz mit bestehenden Eingaben unmoeglich waere.
- server.ts:19124 und :19226 lokalisiert: Gruendung nutzt always/verification. Andere Dispatch-/Succession-Auswahlstellen aus Slot 16 noch nicht erneut vollstaendig gelesen; ihre pauschale Deckung nicht als eigenen Befund ausgegeben.
- Gezielte Suche appendProgramInbox( liefert die Definition server.ts:1494; dies bestaetigt den benannten direkten Suchbefund, keine umfassende Laufzeitpruefung aller Inbox-Schreibwege.
- server.ts:20909 lokalisiert executionStatus/supervisorHealth im Owner-Endpunkt. Die vollstaendige Client-/Detailroute hier nicht neu geprueft; C5 bleibt verifikationspflichtig.

### Anwendung auf Biber und Erfolgsmessung

Der Biber-Uebergabenreview bleibt der konkrete Fall, Slot 16 liefert die Fleet-seitige Anschlussrichtung. Im naechsten vorgesehenen Biber-Schritt pruefen: bekam die Rolle den richtigen autorisierten Input, konnte sie Quellen-/Bildwerkzeuge tatsaechlich nutzen, bleibt ihr Gegenbeleg im Report erhalten, und veraendert er die naechste Entscheidung? Kein zusaetzlicher Kritiker nur fuer dieses Messschema.

Fuer einen spaeteren Opus-Betriebsvergleich feste Fall-Fixtures vorab bestimmen: Frischstart, Nachfolge mit offener Antwort, unbekannter Auditstand und ersetzter Occupant. Zuerst deterministische Korrektheit/Isolation; danach tatsaechliche zusaetzliche Quellenabrufe, Rueckfragen und manuelle Eingriffe beobachten. Native fehlende Harness-Sensorik bleibt unknown. Keine behauptete Tokenersparnis, keine Aussage ueber Modellueberlegenheit aus einem einzelnen Lauf.

Status: Plan ergaenzt, keine Produktdatei geaendert, kein Program/Task gefilet, kein Land/Deploy. Diese Datei bleibt ein lokaler Arbeitsplan; dauerhafte versionierte Integration und Rueckkanal-Zustellung sind separate offene Schritte.

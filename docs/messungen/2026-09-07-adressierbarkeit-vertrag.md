---
frage: Welche Nachrichtenwege ueberleben einen Fleet-Occupant, und welcher Vertrag fehlt?
urteil: Program-Inbox und Succession existieren; Producer, dauerhafte Entscheidungsrueckgabe und Schutz offener Quellen fehlen am gepinnten Baum.
bereich: [adressierung, lifecycle, program-inbox]
stand: 2026-09-07
---

# Adressierbarkeit ueber den Sessiontod hinaus

2026-09-07 · P2 `446e77f8168e9d8bb5612ce6` · Vertragsentwurf, keine promovierte Invariante und keine Implementierung.
Quellstand fuer alle Codezeilen: `e917a48b1a0dfa894cd9470b683606252725b0e9`.

Die dauerhafte fachliche Adresse soll existieren, weil ein Program bereits mehrere MAIN-Occupants ueberlebt; eine neue allgemeine Nachrichten-Infrastruktur ist damit noch nicht begruendet. `server.ts#succeedProgramMain:20295-20307` wechselt die MAIN-Bindung und Lineage. `server.ts#dropWatchesFor:6705-6723` beendet dagegen Transportpfade des alten Occupants. Der Vertrag trennt diese beiden Lebensdauern.

## Ergebnis und Reichweite

Am gepinnten Baum gibt es die Program-Inbox mit Leser und Loader, aber keinen Aufruf ihres Schreibers `appendProgramInbox`. Die implementierte MAIN-Succession beweist deshalb keinen vollstaendigen Nachrichtenweg. Die groessten belegten Luecken sind die fehlenden Producer, Report-Entscheidungen ohne Rueckgabe und Retention, die einen fachlich unentschiedenen Report nach einem Transportabschluss entfernen kann. Die folgenden Tabellen belegen den Iststand; die Vertrags- und Testabschnitte sind Vorschlaege an die bestehenden Traeger.

Das Owner-Ziel lautet: Jede Fleet-Nachricht hat einen Adressaten ueber den Occupant hinaus, und der Absender erfaehrt terminal ihren Ausgang. Das ist hier **kein gemessener Betriebszustand**. Insbesondere eine nicht gebundene Controller-Rolle, programlose Absender und geloeschte Quellen sind offene Grenzen. Keine Slotnummer und kein Label ersetzt eine fehlende autorisierte Adresse.

## Vorgeschlagener Vertrag

Eine fachliche Nachricht und ihre Transportversuche sind verschiedene vorhandene Fakten. Fuer Attention, Report und Audit bleiben die bestehenden Quellrecords massgeblich; die Inbox bleibt ein Zeiger. Das folgende Modell beschreibt benoetigte Semantik, kein neues Serverobjekt:

| Dimension | Vorschlag | Bestehender Traeger / offene Grenze |
|---|---|---|
| Fachliche Identitaet | Ein angenommener Quellvorgang hat eine stabile ID; bei Audit Identitaet aus eindeutigem Ledgerbeleg einschliesslich Repo/Baum/Covers. Wiederholungsversuche aendern sie nicht. | Attention-ID, Report-ID und Audit-Ledger; Audit-`at` allein muss auf Kollisionsfreiheit geprueft werden. |
| Ziel | Program-ID aus belegter Quelle; bei Report zusaetzlich Task-/Lane-Provenance. Die aktuelle MAIN ist der Leser, nicht die gespeicherte Adresse. | Program, Task, provenance; S3a-ii/S3b/S3c. |
| Absender/Rueckweg | Stabile fachliche Herkunft plus exakter ausfuehrender Occupant als historischer Beleg. Dieselbe Quell-ID verbindet Antwort/Decision und Rueckgabe. | Bestehende Report-/Attention-Provenance; sichtbare Rueckgabedisposition bei totem Worker fehlt noch. |
| Ausfuehrung | Vor jedem nach einem Await moeglichen Send/Write wird der exakte Occupant neu bewiesen. Eine fachliche Umadressierung uebertraegt niemals den alten Token, ACK oder eine alte Schreibbefugnis. | Occupant-Tripel und aktuelle Programbindung; D2 muss spaet gelernte ID von Ersatz unterscheiden. |
| Annahme | Positives Filing-ACK erst nach erfolgreichem dauerhaften Quell-/Zeiger-Snapshot. Fehler heisst Speicherzustand unbekannt bis zum Abgleich, nicht automatisch nichts geschrieben. | `saveStateNow`; keine behauptete Rollback-Transaktion. |
| Empfang | `delivered` ist Transportbeobachtung; `acknowledged` bzw. `readAt/readBy` quittiert Empfang. GET allein quittiert nichts. | FleetEvent, Inbox-Read. |
| Fachlicher Abschluss | Report `accepted/rejected`, Attention beantwortet/verweigert; Transport `receiver-gone` beendet nur den konkreten Versuch. Eine fortbestehende Program-Pflicht wird dadurch nicht erledigt. | Quelle bleibt massgeblich; Inbox-Lesen ist kein Reviewentscheid. |
| Rueckmeldung bei Tod | Exakter alter Worker bekommt nichts mehr. Seine persistierte, korrelierte Rueckgabedisposition bleibt fuer die berechtigte Program-Nachfolge lesbar, einschliesslich benanntem Nichtzustellungsgrund. | Ergaenzung an 18e87e67/417d2be5 vorzuschlagen; kein Post an einen Ersatz-Worker allein wegen gleicher Slotnummer. |
| Kapazitaet | Ungelesene Inbox-Zeiger duerfen nach bestehender Cap-Regel fallen; offene fachliche Quellen duerfen dadurch nicht verschwinden. Bei erschoepfter Quellkapazitaet neue Annahme benannt verweigern. Retention nach terminalem Abschluss hat eine explizite Replay-Grenze. | Vorhandene Quellen/Loader weiterverwenden; Zahl der offenen Schulden nicht aus `dropped` rekonstruierbar. |
| Replay | Dedupe umfasst Quelle+Ziel, nicht nur aktuell vorhandene Inbox-Zeiger. Ein alter evictierter Vorgang wird nicht automatisch neu ausgespielt. Nach Retention-Grenze benannt expired/unknown statt zweiter Annahme als neuer Erfolg. | Persistierte Quellmarke oder begrenzter Quellcursor im jeweiligen bestehenden Record zu entscheiden; kein unbeschraenkter historischer Reconcile. |
| Fehlende Adresse | Bekanntes aktives Program ohne lebende MAIN: speichern, Rueckantwort benennt wartenden Leser. Unbekannte/nicht autorisierte Adresse: benannt verweigern. | c62aa3e9: Controller weiterhin unsupported; fehlender Lane-Owner nicht aus idle/Label raten. |

Ein Neustart, ein Owner-Kill und eine MAIN-Succession sind getrennte Ereignisse. Der bestehende S3a-ii-Brief erlaubt offene Attention nur bei `why === "handoff"` zu erhalten und verweigert sie beim Boot ohne `why` wieder (`docs/program-lebenszyklus-architektur-2026-09-04.md:374-376`). Das schliesst Sessiontod plus spaeteren Neustart nicht. Vorschlag: die weiterhin aktive fachliche Programzugehoerigkeit traegt die Pflicht; ein ausdruecklicher Abbruch wird als eigener fachlicher Abschluss gespeichert. Ob Owner-Kill zugleich fachlicher Abbruch sein soll, bleibt eine vom zustaendigen Traeger zu bestaetigende Policy. Keinen solchen Abbruch aus fehlender Prozess-Liveness erfinden.

Liveness-Grenze: Persistenz kann eine offene Pflicht auffindbar halten, aber weder einen kuenftigen Menschenentscheid noch eine unbegrenzt tote MAIN zum Lesen zwingen. Der pruefbare Vertrag lautet deshalb: Jeder angenommene Vorgang ist innerhalb der vereinbarten Retention entweder offen mit benanntem fehlenden Schritt oder terminal mit korreliertem Ausgang lesbar. Eine unbedingte Frist oder Erfolgsgarantie ohne lebenden Leser wird nicht behauptet.

### Kleinste vorgeschlagene Schema-Ergaenzungen fuer offene Rueckwege

Diese Felder sind Entwurf, am Pin nicht implementiert und nicht zur Umsetzung freigegeben. Sie erweitern bestehende Quellrecords statt eines neuen Message-Ledgers. Sie muessen vor Bau durch die jeweils zustaendige MAIN in den bestehenden Brief uebernommen werden.

- Report-Decision: optionale `notificationEventId: string | null` verweist auf genau EIN eigenes FleetEvent der Entscheidung; der vorhandene `report.eventId` bleibt das Event des Report-Eingangs. Vorgeschlagener geschlossener Event-Kind `fleet-report-decision`, Payload mindestens `reportId` plus unveraenderte Decision. Empfaenger bleibt das originale Worker-Tripel. Ist es weg, wird der Versuch als `receiver-gone` mit Grund gespeichert und niemals an den numerischen Ersatz gesendet. `GET /api/self/fleet-report` der aktuell gebundenen Program-MAIN zeigt bei derselben Report-ID `decision` und eine vorgeschlagene abgeleitete `notification` mit `eventId`, `status` und `reason`; alte Records ohne Referenz liefern `notification:null` und benanntes unknown. Der Report wird nicht geloescht, solange entweder Entscheidung oder Rueckgabedisposition offen ist. Fehlender Event-Inhalt nach Retention ist unknown, kein erfundenes ACK.
- Watches/Autos: optionale unveraenderliche `programId` aus der belegten Registrierung und historischer Occupant-Bezug. Watch besitzt bereits `slotOpenedAt`; Auto benoetigt fuer diesen Vertrag auch `slotOpenedAt` und optional belegte Session-ID. Beim Ende wird die Ausfuehrung deaktiviert und `lastResult` benennt den Abschluss; der Record bleibt innerhalb der terminalen Retention erhalten. Die bestehende Program-Execution-Projektion soll diese Quellen als `operations.programSubscriptions` zeigen: `{id, source:"watch"|"auto", programId, status:"open"|"cancelled"|"completed", reason:string|null}`. Das ist eine vorgeschlagene Projektion bestehender Records, kein neuer Serverobjekttyp. Ein Nachfolger liest den Abschluss; er erbt keinen aktivierten Auto-Befehl. Neuer Auftrag braucht eine neue, gegen aktuelle Autoritaet validierte Registrierung.
- Clarifications: bestehender Question-Record behaelt beide exakten Endpunkte und seinen benannten `refused`-Ausgang; Program-/Task-Provenance soll die Rueckgabesicht der eigenen MAIN ermoeglichen. Eine antwortende Nachfolge darf keinen Text an einen recycelten Worker senden. Die gezielte Lesung reicht nicht fuer eine konkrete Antwortpfad-Aenderung; dieser Teil bleibt ein ausdruecklich fehlender Brief, nicht ein stiller Zusatz zu S3a-ii.

Die vorgeschlagenen optionalen Felder verlangen geschlossene Loader- und Cliententscheidungen. Fehlende historische Provenance wird nicht aus heutigen Slots nachgetragen. Programlose Quellen behalten ihren bestehenden Owner-Pfad, soweit er belegt existiert; fehlt ein solcher, ist die dauerhafte Rueckgabe unsupported. Damit wird die noch nicht erfuellte Universalitaet des Owner-Ziels sichtbar.

## Nachrichtenmodell am Pin

Alle genannten Zustandsarrays werden zusammen mit `programs` im selben JSON-Snapshot serialisiert (`server.ts#queueStateSave:2668–2684`); Loader-Zeilen: Autos 21160–21165, Watches 21167–21169, Events 21172–21174, Clarifications 21177–21179, Reports 21182–21184, Attentions 21187–21189. Ein gespeichertes Objekt allein beweist weder fachlichen Empfang noch Sender-Rückmeldung.

| Quelle | Adressat-Typ heute | Persistenz/Retention | Terminalzustand heute | Wer liest / Beleg |
|---|---|---|---|---|
| Program-MAIN Attention | Owner-Prinzipal nach außen; Antwortziel ist ursprünglicher Requester-Occupant; `programId` ist Provenienz | `attentionRequests`, maximal 20 terminale Zeilen global | `answered` oder `refused`; Tod/Tripelwechsel verweigert mit `requester session ended`, löscht dabei vorhandene Antwort | Owner `attentionOwnerView`; Self nur exakter Requester. `server.ts#openAttention:7683–7693`, `#attentionBound:7638–7640`, `#attentionFor:7698–7699`, `#refuseAttention:7702–7708`, `#reconcileAttention:7714–7726`, `#attentionOwnerView:7732–7737`, `#pruneAttention:6739–6745`; `server/types.ts#AttentionRequest:458–474`; Deckel `server.ts:2411` |
| Owner Attention-Antwort | Requester-Tripel, nicht aktuelle Program-MAIN | Vor Send wird `send-uncertain` samt Antwort awaited gespeichert; nach Send `answered`; kein Inbox-Append | `answered` bedeutet Send-Pfad erfolgreich, kein Lese-ACK; Tod verweigert statt neu zu adressieren | Exakter Requester/Owner. `server.ts#answerAttention:7761–7805`; Antwort identisch wiederholbar, fremder Text bei Ungewissheit 409: 7748–7759 |
| Auto | Slotnummer; Auto-Typ trägt kein `openedAt`/`sessionId` | `autos`; beim Öffnen/Teardown entfernt; Boot behält nur Slot mit cwd | `enabled=false`, `runsLeft=0` für verbraucht; `lastResult` sent/skipped/failed, kein fachliches ACK | `/api/self` eigene Autos; `server/types.ts#Auto:53–66`, `server.ts#openSlot:4549`, `#teardownSlotOccupant:4640`, Boot:21760, `#advanceAuto:7827–7835`, `#tickAutos:7910–7918,7972–7990`, Self:24015 |
| Watch | Slot plus optionale Eröffnungszeit; Completion erzeugt Event mit Occupant-Tripel oder Inbox-Transport | `watches`; Empfänger-Teardown löscht Watch; Target-Teardown disarmiert verbleibenden Watch mit Grund | `armed=false`, `lastResult`; vor Completion kein dauerhaftes Event zwingend vorhanden | Self-Watches/Owner-Sicht. `server/types.ts#WatchBase:76–93`; `server.ts#dropWatchesFor:6715–6723`, `#tickWatches:11110–11120`; Self:24016 |
| FleetEvent (Watch/Report/Clarification/sonstige typisierte Completion) | Transport-Occupant-Tripel; Owner-Fallback hat null-Tripel und inbox | `fleetEvents` unabhängig von Watch; terminale Tail-Retention pro Slotnummer bzw Owner; `send-uncertain` Crashmarker vor Send | Nur `acknowledged`, `receiver-gone`, `subject-gone` sind terminal; delivered ist kein terminaler Beweis | Self nur exaktes Tripel; Owner-Inbox nur Owner-ACK. `server/types.ts#FleetEventBase:278–317`; `server.ts#fleetEventReceiver:6171–6175`, `#markFleetEventReceiverGone:6278–6293`, `#pruneFleetEvents:6055–6063`, `#acknowledgeFleetEvent:6562–6587`, `#ownerAcknowledgeFleetEvent:6594–6611`; Self:24017–24018; Boot:21779–21788; Transport:11208–11289 |
| Worker FleetReport | Beim Filing aktuelle MAIN über Programbindung, dann eingefrorenes Receiver-Tripel; eng begrenzter owner-inbox-Fallback für Program-lose Task-Lane | `fleetReports` plus eigenes Event gemeinsam awaited gespeichert; 20 terminale Reports global; terminal zählt über Event oder dessen Abwesenheit | Fachlich `decision.accepted/rejected` separat vom Transport; status des Reports ist Worker-Claim | Exakter Worker oder Receiver über Self; successor sieht reduzierte Daten per taskId+programId-Join. `server.ts#clarificationReceiverFor:6091–6109`, `#openFleetReport:6425–6475`, `#fleetReportsFor:6356–6361`, `#pruneFleetReports:6364–6372`, `#latestReportFor:1705–1718`; Deckel:2410; `server/types.ts#FleetReport:426–449` |
| MAIN Review-Entscheidung über Report | Report-Zeile; aktuell keine selbständige Rückgabe an Worker oder Task-Prinzipal | `report.decision`, awaited Snapshot; erste Entscheidung gewinnt | accepted/rejected; kein Rückgabe-Empfang/ACK | Nur ursprünglicher Receiver darf entscheiden; Self-Worker kann Ergebnis pullen solange Tripel passt. Keine Pane-Nachricht. `server.ts#decideFleetReport:6635–6682`; Doku bestätigt bewusst fehlende Nachricht `docs/self-api.md:925–940` |
| Program-Inbox-Eintrag | Stabile Program-ID via Container, Leser ist aktuelle gebundene MAIN; `readBy` lediglich erster Lese-Beleg | Zeiger `{kind,ref}`; maximal 100, zuerst älteste gelesene entfernen, dann ungelesene; `dropped` zählt; referenzierte Zeile kann separat fehlen | `readAt/readBy` quittiert Lesen; keine fachliche Disposition und kein Sender-Rückweg | `server.ts#appendProgramInbox:1471–1484`, `#inboxProgramFor:7036–7041`, `#inboxSubject:7052–7059`, `#programInboxView:7065–7075`, `#readProgramInboxEntry:7100–7120`; `server/types.ts#ProgramInbox:1622–1635`. `audit-red` hat am Pin immer subject:null ohne unknown. **Am Pin existiert kein Aufruf von appendProgramInbox**, nur Definition; Volltext-Symbolsuche in server.ts. |
| Worker Clarification/Rückantwort (benachbarte Rückgabe) | Zwei feste Occupant-Tripel | `clarifications` und eigenes Event | answered/refused; Tod jedes Endes verweigert, kein Program-Neuadressieren | Exakte Endpunkte. `server.ts#openClarification:6319–6342`, `#clarificationsFor:6350–6353`, `#reconcileClarifications:6151–6168`; nicht komplette Antwort-Implementierung geprüft |

## Succession und Identitätsgrenze

`server.ts#succeedProgramMain:20295–20307` ersetzt `program.main`, ergänzt Lineage und speichert mit Retirement-Marker. Alte Nachrichten-/Transportadressaten werden in dieser Schlusssequenz nicht umgebunden. Danach `scheduleSuccessionRetirement` (20324) → `retireSucceededSession` (5758–5765) → kill/teardown. Teardown entfernt Autos (4640), ruft `dropWatchesFor` (4641); letzterer terminalisiert offene Receiver-Events, reconciliert Attentions/Clarifications, löscht Receiver-Watches (6705–6723). Der Autoritätswechsel und der spätere Tod sind getrennte Zeitpunkte, kein sofortiges pauschales „Succession löscht alles“.

D2-Signatur ist aus Vergleichsregeln erklärbar, nicht hier live reproduziert: Program-MAIN-Resolver bindet über slot+openedAt und übernimmt aktuelle sessionId (6097–6100), Event-Reader/ACK verlangt anschließend strikte sessionId-Gleichheit (6175,6576–6577). Ein null→bekannt-Wechsel bei gleichem slot+openedAt ist deshalb als ersetzt klassifizierbar. Kleinstes Falsifikationsfixture: Event an null-ID herstellen, nur live sessionId lernen lassen, GET und ACK vorher/nachher vergleichen. Harness-spezifischer tatsächlicher Lernpfad wurde nicht gelesen.

## Durabilität: genaue Grenze

`server.ts#queueStateSave:2668–2684` erzeugt synchron einen JSON-String-Snapshot. Die Promise-Kette schreibt diesen in einzigartige temporäre Datei, fsync't Datei, kopiert bisherigen Zustand best-effort nach .bak, renamet und fsync't das Verzeichnis (2706–2719). `saveChain=raw.catch(...)` macht die Kette nach Fehler nutzbar, `return raw` reicht den ursprünglichen Fehler an den aufrufenden Await weiter (2723–2727). `saveState()` verwirft den Rückgabewert (2729–2731), `saveStateNow()` gibt ihn zurück (2738–2739).

Damit ist ein erfolgreich awaited Snapshot eine Code-Durabilitätsbarriere für seine serialisierten Bytes. Es ist **keine allgemeine Transaktion**: Autoren mutieren Speicher vor dem Await; Report-Filing/Decision/Inbox-Receipt haben in den gelesenen Funktionen keinen Rollback bei Save-Fehler. Nach fehlgeschlagenem Save kann ein späterer Snapshot die bereits mutierten Daten speichern. Eine HTTP-Fehlerantwort beweist daher nicht „nichts geschrieben“, und gleiche Snapshot-Mitgliedschaft beweist keinen erfolgreichen Producer-Aufruf. Die Behauptung des Writer-Kommentars (1468–1470) über gemeinsames Speichern ist am Pin noch kein ausgeführter Producer-Vertrag, weil der Writer unaufgerufen bleibt. Keine Crash-/Datenträgerprobe durchgeführt.

## Rangfolge der Lücken gegen P2-Ziel, Kosten, kleinste Widerlegung

1. **Fehlende fachliche Producer-Anbindung / fehlender Entscheidungsrückweg.** Inbox-Writer ist unaufgerufen; Entscheidung schreibt nur Report und optional Transport-ACK (6470–6475,6676–6682), Doku 925–930 bestätigt fehlende Worker-Nachricht. Kosten: Nachfolgende MAIN erhält keinen Inbox-Zeiger; geschlossene Lane erfährt Ablehnung nicht durch dieses Rail. Falsifier: an isoliertem Pin Aufmerksamkeit beantworten bzw Report file/entscheiden und Program-Inbox sowie benannten stabilen Sender-Rückweg lesen; genannter Mechanismus müsste Einträge erzeugen.
2. **Durable fachliche Identität endet weiterhin am ursprünglichen Receiver.** Report kann reduziert über Program gelesen werden (1705–1718), Entscheidung bleibt alter MAIN vorbehalten (6647–6649); Attention wird bei Requestertod refused (7714–7726). Kosten: Nachfolger sieht Arbeit gegebenenfalls, kann sie über bestehende Entscheidungstür nicht adjudizieren; offene Owner-Frage muss erneut gestellt werden. Falsifier: alte Request/Report-Zeile über echte isolierte Succession übernehmen, lesen UND abschließend disponieren, ohne Ursprung zu verfälschen.
3. **Retention bewahrt nicht jede offene fachliche Schuld.** `pruneFleetReports` klassifiziert nach Event-Terminalität, nicht fehlender Entscheidung (6364–6372). Inbox hält bis 100 Zeiger, Report-/Attention-Zeilen nur 20 terminale globale Einträge. Kosten: Zeiger kann ohne Inhalt verbleiben; ein unentschiedener Report kann nach Transport-ACK aus der begrenzten Tail fallen. Falsifier: über Deckel hinaus bestätigte, fachlich unentschiedene Reports erzeugen und erste Zeile/Zeiger prüfen. `inboxSubject` meldet fehlende Quelle immerhin unknown (7057–7058).
4. **Gelerntes sessionId und Lebensdauer werden in Transport-ACK gleich behandelt.** Regeln oben belegt; Kosten: ACK kann ohne Occupant-Recycle 409 liefern, obwohl Nachricht gelesen wurde. Falsifier: null→ID Fixture wie oben. Tatsächliche Häufigkeit und Adapterpfad unknown.
5. **Autos/noch nicht erfüllte Watches hinterlassen bei Receiver-Ende keinen dauerhaften Senderabschluss.** Entfernung 4549/4640 bzw 6715, Auto hat keinen fachlichen Sender. Kosten: geplante Zukunft fällt aus rekonstruktierbarer Program-Arbeit heraus. Falsifier: Registrierung, Receiver-Ende und Neustart isoliert durchführen; stabile Referenz muss danach entweder übernommen oder begründet abgeschlossen lesbar sein.


## Tatsächlich vorhandene Testnähte

- `e2e/harness.ts#check:73`: `check(name, ok, detail)` schreibt PASS/FAIL und wirft **nicht**. Fehlerhafte Fixtures benötigen `check(..., false, detail); return` im abgegrenzten Testblock, sonst folgen Scheinfehler. `post(path, body, headers)` bei Zeile 93 sendet mit Owner-Headers als Default; `get(path)` bei Zeile 95 ebenfalls. Self-Aufrufe benötigen explizite Header oder die vorhandenen lokalen Wrapper.
- `e2e/programs.ts#selfInbox:225`, `selfInboxRead:230`, `slotToken:232`, `selfSucceed:238`, `selfExecution:218` sind echte lokale Wrapper. Erfolgssuccession und frisch committetes Fixture-HANDOFF sind bereits aufgebaut, Zeilen 1941–1948, 2035–2057. Das sind Suiten-Fixtures, keine Erlaubnis, die Produktion anzufassen.
- `e2e/watch.ts#ackEvent:147`, `decideReport:152`, `selfFleetReport:180`, `selfFleetReports:186`, `eventRows:114`, `fleetReportEventRows:193`, `watchRows:110` existieren. Sie sind lokal und nicht exportiert: eine Implementierung setzt ihren Test in die jeweilige Familie oder übernimmt den winzigen HTTP-Aufruf ausdrücklich; sie importiert keine erfundenen Helfer.
- Persistenzbilder werden nur am gestoppten isolierten `srv` geändert (`e2e/programs.ts:7452–7463`, `e2e/watch.ts:2363–2380`). `restartSrv` existiert (`e2e/harness.ts:109–124`); kein generischer `simulateLearn`, `tickOnce`, `getProgramOutcome` oder `withSuccessionRace` wurde in diesen gelesenen Helfern gefunden. Solche Namen unten zu erfinden würde keine übernehmbare Probe ergeben.

## P2-I1 — Program-Leserecht überlebt Succession, vergangene Quittung bleibt vergangen

**Prüfbarer Satz:** Für jeden vorhandenen Program-Inbox-Eintrag ändern erfolgreiche Succession und Serverneustart weder Eintrags-ID/Referenz noch die Quittung des Vorgängers; ungelesene Einträge bleiben ungelesen. Ein Occupant ohne aktuelle eindeutige Program-Bindung erhält daraus kein Leserecht.

Vorhandener Beweisentwurf: `e2e/programs.ts:1776–1812` pflanzt Einträge und referenzierte Zeilen; `:1857–1870` prüft Scope, Join und unbekannte Referenz; `:1883–1897` prüft idempotentes Lesen und fremde Einträge; `:1911–1918` prüft Slot-Recycling; `:2092–2107` prüft Succession. **Dies beweist keinen Produzenten:** `server.ts#appendProgramInbox:1471–1484` hat am SHA nur seine Definition als Symboltreffer, keinen Aufruf.

Ergänzung im bestehenden Succession-Fixture (Variablen und Wrapper existieren dort):

```ts
const beforeEntries = JSON.stringify(inboxAfterRead.view?.entries.map(({ subject, ...e }) => e));
const afterEntries = JSON.stringify(inboxSuccessorView.view?.entries.map(({ subject, ...e }) => e));
check("P2-I1: succession preserves every inbox entry and predecessor receipt",
  inboxAfterRead.response.ok && inboxSuccessorView.response.ok
    && Array.isArray(inboxAfterRead.view?.entries)
    && Array.isArray(inboxSuccessorView.view?.entries)
    && inboxAfterRead.view.entries.length > 0 && beforeEntries === afterEntries,
  JSON.stringify({ beforeEntries, afterEntries }));
await restartSrv();
const restartedInbox = await selfInbox(inboxSuccessorToken);
check("P2-I1: successor inbox survives restart byte-for-byte",
  restartedInbox.response.ok
    && JSON.stringify(restartedInbox.view?.entries.map(({ subject, ...e }) => e)) === afterEntries,
  JSON.stringify(restartedInbox.view));
const twice = await Promise.all([
  selfInboxRead(inboxSuccessorToken, inboxEntryReport),
  selfInboxRead(inboxSuccessorToken, inboxEntryReport),
]);
const receipts = await Promise.all(twice.map(r => r.json())) as
  { existing: boolean; entry: ProgramInboxEntry }[];
check("P2-I1: concurrent reads persist one immutable receipt",
  twice.every(r => r.ok)
    && receipts.filter(r => r.existing === false).length === 1
    && receipts.filter(r => r.existing === true).length === 1
    && JSON.stringify(receipts[0]?.entry) === JSON.stringify(receipts[1]?.entry),
  JSON.stringify(receipts));
```

Den ersten Snapshot unmittelbar nach `inboxAfterRead` aufnehmen, nicht erst nach der Succession. Für fehlende `view` gesonderte Fixture-FAIL/return verwenden, damit `undefined === undefined` nie grün ergibt. Leeres Program: `entries:[]`, `unread:0`, `dropped:0`, ohne synthetische Persistenz; Altbestand ohne Inbox ist bereits bei `:1824–1828` abgedeckt. Mutation, die den Test tötet: `succeedProgramMain` leert Inbox oder schreibt alle `readBy` auf Nachfolger; fehlende Synchronität beim Read erzeugt zwei `existing:false`.

## P2-I2/S3b — neues Entscheidungsrecht, kein alter Event-ACK

**Pruefbarer Satz:** Nach Bindungstransfer darf nur die aktuelle MAIN einen noch offenen Report ihres Programs entscheiden; weder erbt sie alte Event-ACKs noch darf sie einen vorhandenen Entscheid ueberschreiben.

Fixture-Voraussetzungen: In `e2e/programs.ts` erfolgreichen Succession-Block nutzen. `mainSelfTokenAfterRestart` ist Vorgänger-Token, `inboxSuccessorToken` der frisch gelesene Nachfolger-Token. Vor Succession echten noch unentschiedenen Program-Report erzeugen und dessen ID als `oldReportId` festhalten. Separat ein gültiges, delivered oder send-uncertain **Legacy-FleetEvent** mit Vorgänger-Tripel pflanzen und seine ID als `oldEventId` festhalten; es stammt nicht aus dem neuen Program-Report (S3b: dessen eventId ist null). Das Report-Program muss `mainProgram.id` sein; der neue Program-Report hat `receiver:null`; nur das getrennte Legacy-Event traegt den ursprünglichen `bound`. Dieser Fixture-Check muss vor Übergang exakt vergleichen und bei fehlender ID den abgegrenzten Probe-Block beenden. Der negative Vorgänger-Aufruf erfolgt nach Transfer, aber vor Retirement; dafür den bestehenden isolierten Grace-Mechanismus der Succession-Fixture nutzen, nicht eine feste Sleep-Wette. Nach Retirement wird stattdessen separat 401 geprüft.

```ts
const decide = (token: string, verdict: "accept" | "reject") =>
  fetch(`${BASE}/api/self/fleet-report/${oldReportId}/${verdict}`, {
    method: "POST", headers: { "x-fleet-self-token": token },
  });
const predecessorDecision = await decide(mainSelfTokenAfterRestart, "reject");
const successorDecision = await decide(inboxSuccessorToken, "accept");
const accepted = await successorDecision.json() as {
  report?: { id: string; decision?: {
    disposition: string; by: { slot: number; openedAt: number; sessionId: string | null }
  } }
};
const oldAck = await fetch(`${BASE}/api/self/events/${oldEventId}/ack`, {
  method: "POST", headers: { "x-fleet-self-token": inboxSuccessorToken },
});
check("P2-I2/S3b: transfer revokes predecessor judgement and grants current Program judgement",
  predecessorDecision.status === 409 && successorDecision.ok
    && accepted.report?.id === oldReportId
    && accepted.report.decision?.disposition === "accepted"
    && accepted.report.decision.by.slot === successorSlot
    && accepted.report.decision.by.openedAt === transferredBinding?.openedAt
    && oldAck.status === 409,
  JSON.stringify({ predecessor: predecessorDecision.status, successor: successorDecision.status,
    report: accepted.report, oldAck: oldAck.status }));
const decidedBytes = JSON.stringify(accepted.report?.decision);
const overwrite = await decide(inboxSuccessorToken, "reject");
const currentReports = await fetch(`${BASE}/api/self/fleet-report`, {
  headers: { "x-fleet-self-token": inboxSuccessorToken },
});
const currentBody = await currentReports.json() as {
  reports: { id: string; decision?: unknown }[]
};
check("P2-I2/S3b: new authority never rewrites an existing verdict",
  overwrite.status === 409 && currentReports.ok
    && JSON.stringify(currentBody.reports.find(r => r.id === oldReportId)?.decision) === decidedBytes,
  JSON.stringify(currentBody));
```

Mutation: nur ursprünglichen Receiver autorisieren macht Nachfolgerarm rot; ursprünglichen Receiver als zusätzliche Autorität belassen macht Vorgängerarm rot; ACK auf Program-ID erweitern macht oldAck rot. Ein schon vor Transfer entschiedener zweiter Report muss danach dieselben vollständigen decision-Bytes behalten.

## P2-I3 — D2: Identitätsanreicherung ist keine Ersetzung

**Vertragsvorschlag:** Der nachgewiesene Übergang `sessionId:null → bekannte ID` desselben Occupants darf dessen bereits zugestelltes Event nicht unquittierbar machen. Ein anderer `openedAt` oder eine bereits bekannte abweichende ID darf niemals durch denselben Mechanismus legitimiert werden.

Ist: `server.ts#backfillProgramMainSessionId:6980–6996` reichert nur Program-MAIN und letztes Lineage-Element an. `fleetEventReceiver:6171–6175` und `acknowledgeFleetEvent:6575–6577` verlangen exakte ID. Vorhandene passende Fixture-Technik bei `e2e/programs.ts:7443–7519` prüft Program-Land-Identität, **kein Event-ACK**. `e2e/self-token.ts` wurde auf entsprechende Treffer gelesen; dort kein D2-Event-ACK-Beweis gefunden.

Test in `e2e/watch.ts` neben Event-Restart: gültiges `delivered` und getrennt `send-uncertain` Event mit `receiverSessionId:null` erzeugen/pflanzen, exaktes `slot/openedAt` und Token speichern; isolierten Server stoppen, nur Slot-ID zu gültiger UUID anreichern, neu starten; `ackEvent(sameToken,id)` aufrufen. Gegenmatrizen separat aus frischen Zeilen: null→null; null→UUID bei anderem openedAt; bekannte A→B; fehlender Token; fremder Slot. Erwartung:

```ts
const ack = await ackEvent(sameToken, eventId);
const ackBody = await ack.json() as { event?: { status?: string }; error?: string };
check("P2-I3: an enriched identity can acknowledge its own delivered event",
  sameSlot && sameOpenedAt && previousSessionId === null
    && learnedSessionId !== null && ack.ok
    && ackBody.event?.status === "acknowledged",
  JSON.stringify({ status: ack.status, body: ackBody }));
```

Alle Variablen sind gemessene Fixture-Werte, keine angenommene Liveness. Dies ist ein **erwartet roter Zieltest** am gepinnten SHA, keine Erfolgsbehauptung. Neustart prüft Loader-Seite; für „live gelernt“ fehlt in gelesener Harness-API eine deterministische Learn-Naht. Implementierungsbrief muss eine begrenzte isolierte Learn-Sonde oder vorhandene echte Sessiondatei-Fixture benennen, bevor Live-Lernen als bewiesen gilt. Mutation: keine Event-Anreicherung macht Positivarm rot; wildcards für jede null-ID machen openedAt-Gegenarm rot; überschreiben bekannter IDs macht A→B-Gegenarm rot. D2-Begriff hier = spät gelernte Session-ID; nicht mit dem anders benannten D2-Autoclose-Block `e2e/watch.ts:3028ff` verwechseln.

## P2-I4 — angenommene Producer-Ergebnisse sind dauerhaft adressiert

**Pruefbarer Satz:** Jeder erfolgreich eingegangene Program-Report hat genau einen ungelesenen, bereits gespeicherten Inbox-Zeiger im richtigen Program; ein programloser Report erscheint dort nicht.

Einfügestelle `e2e/watch.ts:2823`, unmittelbar nach dem D1-Fixture-Check. Die vorhandenen Produzenten-Aufrufe `:2806–2813` sind die Aktion; dieser Block prüft ausschließlich ihre Wirkung und erzeugt daher keine zusätzlichen Reports, die spätere D1-Zählungen verfälschen. Alle unten verwendeten Namen existieren in diesem lokalen Block. Der Check wird am gepinnten Quellstand erwartbar rot; das ist der fehlende Produzentenanschluss.

```ts
{
  type InboxEntry = { id: string; kind: string; ref: string;
    readBy: { slot: number; openedAt: number; sessionId: string | null } | null;
    readAt: number | null };
  type InboxView = { program?: string; entries?: InboxEntry[]; unknown?: string[] };
  const response = await fetch(`${BASE}/api/self/inbox`, {
    headers: { "x-fleet-self-token": d1MainTok },
  });
  const inbox = await response.json() as InboxView;
  const reports = [acceptReport, rejectReport, terminalReport];
  check("P2-I4 fixture: all producer responses yielded distinct typed report IDs",
    filed.every(r => r.ok) && reports.every(r => typeof r?.id === "string")
      && new Set(reports.map(r => r?.id)).size === 3,
    JSON.stringify(reports.map(r => r?.id ?? null)));
  check("P2-I4: every accepted Program report has one persisted unread pointer",
    response.ok && inbox.program === d1ProgramId
      && Array.isArray(inbox.entries)
      && reports.every(report => {
        if (!report) return false;
        const matches = inbox.entries!.filter(e => e.kind === "fleet-report" && e.ref === report.id);
        return matches.length === 1 && matches[0]?.readBy === null && matches[0]?.readAt === null;
      })
      && !inbox.entries.some(e => e.ref === inboxReport?.id),
    JSON.stringify(inbox));
  const disk = JSON.parse(readFileSync(d1Path, "utf8")) as {
    programs?: { id: string; inbox?: { entries: InboxEntry[] } }[];
  };
  const persisted = disk.programs?.find(p => p.id === d1ProgramId)?.inbox?.entries;
  check("P2-I4: HTTP success already persisted the same report pointers",
    Array.isArray(persisted) && reports.every(report =>
      report !== undefined && persisted.filter(e => e.kind === "fleet-report" && e.ref === report.id).length === 1),
    JSON.stringify(persisted ?? null));
}
```

Das Owner-Inbox-Gegenbeispiel ist bereits echt produziert (`inboxReport`); es darf nicht versehentlich in dasselbe Program geroutet werden. Das parallele Produzieren verschiedener Reports ist bereits `Promise.all` und prüft drei eigene Referenzen. Die Tests beanspruchen keine Text-Retry-Idempotenz.

## P2-I5 — Ablehnung nach Lane-Tod bleibt im Program, Rückgabe hat eigene Event-Identität

**Pruefbarer Satz:** Die erste Entscheidung bleibt unveraendert und erzeugt hoechstens einen eigenen Rueckgabevorgang; nach Tod des Workers liest die Program-Nachfolge denselben Entscheid samt benanntem Transportabschluss, der recycelte Worker-Slot erhaelt nichts.

Vorgeschlagenes Schema aus dem Abschnitt „Kleinste vorgeschlagene Schema-Ergaenzungen“: `report.decision.notificationEventId` verweist auf ein eigenes FleetEvent `kind:"fleet-report-decision"`, Payload `{reportId,decision}`. Das originale `report.eventId` bleibt Eingangstransport. Das Rückgabe-Event adressiert exakt das originale Worker-Tripel. Bei Tod: `receiver-gone` mit Grund, kein Senden an numerischen Ersatz. Der nach S3b erweiterte bestehende GET liefert zum Report eine abgeleitete `notification:{eventId,status,reason}`; Altbestand ohne Referenz liefert null und unknown.

Fixture im D1-Block vor Cleanup: frischen Report per `selfFleetReport(rejectTok,...)` erzeugen und als `deadReport` parsen. Nach den bestehenden D1-Zählungen einfügen. Worker vor Entscheid killen, danach echte Program-Succession und Worker-Reopen wie oben durchführen; `successorToken` und `replacementWorkerToken` frisch aus deren jeweiligen Occupants lesen. Diese Schritte sind echte vorhandene APIs; keine neue Helper-Naht.

```ts
const killed = await post(`/api/slots/${rejectLane.slot}/kill`, {});
const verdict = await decideReport(d1MainTok, deadReport.id, "reject", { reason: "P2 dead sender" });
type ReturnedReport = Omit<FleetReportRow, "decision"> & {
  decision?: NonNullable<FleetReportRow["decision"]> & { notificationEventId?: string | null };
  notification?: { eventId: string; status: string; reason: string | null } | null;
};
const verdictBody = await verdict.json() as { report?: ReturnedReport };
const returnId = verdictBody.report?.decision?.notificationEventId;
const decisionBytes = JSON.stringify(verdictBody.report?.decision);
check("P2-I5 fixture: dead-worker rejection has its own return event reference",
  killed.ok && verdict.ok && verdictBody.report?.decision?.disposition === "rejected"
    && typeof returnId === "string" && returnId.length === 24 && returnId !== deadReport.eventId,
  JSON.stringify(verdictBody));
// Fixture actions here: successful Program succession, then reopen the old worker slot;
// read successorToken and replacementWorkerToken freshly from those observed occupants.
await restartSrv();
const successorRead = await selfFleetReports(successorToken);
const surviving = successorRead.reports.find(r => r.id === deadReport.id) as ReturnedReport | undefined;
const eventResponse = await get("/api/sessions");
const eventBody = await eventResponse.json() as { events: {
  id: string; kind: string; status: string;
  receiverSlot: number; receiverOpenedAt: number; receiverSessionId: string | null;
  payload?: { reportId?: string; decision?: unknown }
}[] };
const returns = eventBody.events.filter(e => e.kind === "fleet-report-decision"
  && e.payload?.reportId === deadReport.id);
const replacementView = await selfFleetReports(replacementWorkerToken);
check("P2-I5: same rejection survives for Program successor; dead-worker return ends by name",
  successorRead.response.ok && surviving?.id === deadReport.id
    && JSON.stringify(surviving.decision) === decisionBytes
    && surviving.notification?.eventId === returnId
    && surviving.notification.status === "receiver-gone"
    && typeof surviving.notification.reason === "string" && surviving.notification.reason.length > 0
    && eventResponse.ok && returns.length === 1 && returns[0]?.id === returnId
    && returns[0]?.status === "receiver-gone"
    && returns[0]?.receiverSlot === deadReport.worker.slot
    && returns[0]?.receiverOpenedAt === deadReport.worker.openedAt
    && returns[0]?.receiverSessionId === deadReport.worker.sessionId
    && replacementView.response.ok
    && !replacementView.reports.some(r => r.id === deadReport.id),
  JSON.stringify({ surviving, returns, replacementIDs: replacementView.reports.map(r => r.id) }));
```

Für Payload-Vergleich die unveränderlichen Urteilsfelder `disposition,at,by,reason` einzeln gleich Report-Decision prüfen; die Referenz selbst gehört nicht notwendig in den Payload. Wiederholte/konkurrierende Entscheidung darf kein zweites Rückgabe-Event minten. Zeilen nach erstem terminalem Entscheid nicht erneut entscheiden. Fehlende historische notificationEventId muss `notification:null` plus konkretes unknown ergeben. Ein gelöschtes Rückgabe-Event nach Retention darf keinen erfundenen terminalen Empfang erzeugen. Tod des Absenders bedeutet nicht, dass er gelesen hat: gemessen sind ein gescheiterter exakter Zustellungsversuch und dessen Program-lesbarer Abschluss.

## P2-I6 — Watch/Auto bleiben Quellen, ihre alte Ausführung endet

**Pruefbarer Satz:** Bei Ende eines registrierenden Occupants bleiben seine programbezogenen Watch-/Auto-IDs mit Abschlussgrund lesbar; ihre alte Ausfuehrung ist deaktiviert und wird durch Succession nicht reaktiviert.

Vorgeschlagene additive Quellfelder für program-bezogene `Watch`/`Auto`: `programId`, historischer Occupant-Bezug; `Watch.armed:false` beziehungsweise `Auto.enabled:false` beendet Ausführung, `lastResult` nennt den Abschluss. Die vorgeschlagene Projektion ist `operations.programSubscriptions:{id,source:"watch"|"auto",programId,status:"open"|"cancelled"|"completed",reason:string|null}[]`. Die Projektion ist kein neuer Ledger. Programlose Altzeilen werden explizit als solche behandelt und keinem Program erfunden zugeordnet.

Fixture: Die konkreten Registrierungs-, Retirement- und Trigger-Schritte stehen unmittelbar nach dem Projektionsblock. Zuerst echte Program-Succession, dann beobachtetes Ende des Vorgaenger-Occupants; erst danach die folgende cancelled-Projektion lesen. `retiredWatchId` und `retiredAutoId` bezeichnen die vor dem Ende erfassten Quell-IDs. Bindungstransfer allein ist kein Retirement-Beweis.

```ts
const execution = await fetch(`${BASE}/api/self/program-execution`, {
  headers: { "x-fleet-self-token": inboxSuccessorToken },
});
const body = await execution.json() as { programs: { program: { id: string };
  operations: { programSubscriptions?: { source: "watch" | "auto"; id: string; programId: string;
    status: "open" | "cancelled" | "completed"; reason: string | null }[] } }[] };
const row = body.programs.find(p => p.program.id === mainProgram.id);
const required = [{ source: "watch", id: retiredWatchId }, { source: "auto", id: retiredAutoId }];
const subscriptions = row?.operations.programSubscriptions;
check("P2-I6: succession retains both promise sources but cancels predecessor execution",
  execution.ok && Array.isArray(subscriptions)
    && required.every(expected => {
      const matches = subscriptions.filter(s => s.source === expected.source && s.id === expected.id);
      return matches.length === 1 && matches[0]?.programId === mainProgram.id
        && matches[0]?.status === "cancelled"
        && typeof matches[0]?.reason === "string" && matches[0].reason.length > 0;
    }),
  JSON.stringify(subscriptions ?? null));
```

**Schema-Beleg:** `program:{id}` und `programs[]` entsprechen `e2e/programs.ts:122-125,156-159`; `operations` existiert bei `:150-153`. Nur `operations.programSubscriptions` ist additiv vorgeschlagen.

Die konkrete Auto-Familie ist jetzt gelesen: `e2e/autos.ts:13-34` erzeugt einen One-shot, beobachtet `lastRun/lastResult`, History und `plogRead()`; `:38-42` erzeugt eine weit zukuenftige Auto-Persistenzfixture. `server.ts#tickAutos:7973-7987` schreibt beim Send Prompt-Log und `auto_fire`, kein FleetEvent. Ein verbrauchter Auto kann danach wieder `enabled:false` sein; dieser Wert allein ist kein Gegenbeweis einer unerlaubten Ausfuehrung.

Die folgenden Teile kommen in eine eigene abgegrenzte async-Probe neben die Succession-Familie; bei Fixturefehler `check(..., false, ...)` und `return`. Importierte bestehende Helfer: `BASE`, `ROOT`, `REPO`, `post`, `get`, `check`, `restartSrv`, `tmuxOut`, `plogRead`, `AUTOS_TICK_MS`, `afterTick` aus `e2e/harness.ts:35-60,73-124,161-163`. `selfRetire` ist der vorhandene lokale Wrapper (`e2e/programs.ts:242-245`). Reopen entspricht `e2e/watch.ts:4283-4296`. Alles laeuft ausschliesslich in der kuenftigen isolierten Opus-Suite mit beobachtbarem Stand-in; kein Live-Aufruf dieser Notiz.

VOR der bereits beschriebenen echten Succession den Auto beim Vorgaenger registrieren; Watch-ID stammt aus dem unveraenderten Watch-Familienfixture. Der Marker muss fuer dieses Program neu sein:

```ts
const retiredAutoText = `P2-I6-retired-${mainProgram.id}`;
const createdAuto = await fetch(`${BASE}/api/self/autos`, {
  method: "POST", headers: { "content-type": "application/json",
    "x-fleet-self-token": mainSelfTokenAfterRestart },
  body: JSON.stringify({ text: retiredAutoText, inSec: 3600, idleSec: 0 }),
});
const autoBody = await createdAuto.json() as { auto?: { id: string; lastRun: number } };
if (!createdAuto.ok || !autoBody.auto || autoBody.auto.lastRun !== 0) {
  check("P2-I6 fixture: fresh far-future auto exists and has never run", false, JSON.stringify(autoBody));
  return;
}
const retiredAutoId = autoBody.auto.id;
```

NACH erfolgreichem Bindungstransfer und VOR der cancelled-Projektionspruefung das Ende des alten Occupants beweisen. `selfRetire` wartet `killSlot(...,"handoff")` ab (`server.ts#handleSelfRetire:6035-6041`); war der Grace-Timer schneller, sind 401 **und** nicht mehr vorhandener alter Occupant erforderlich. Ein beliebiges 401 allein ist kein Todesbeweis.

```ts
const retired = await selfRetire(mainSelfTokenAfterRestart);
const afterRetire = JSON.parse(await Bun.file(`${ROOT}/fleet.json`).text()) as {
  slots: Record<string, { cwd?: string | null; openedAt?: number }>;
};
const oldSlot = afterRetire.slots[String(mainSlot)];
const predecessorGone = !oldSlot?.cwd || oldSlot.openedAt !== bound?.openedAt;
if (!(retired.ok || retired.status === 401) || !predecessorGone) {
  check("P2-I6 fixture: predecessor retirement is observed before cancellation assertions",
    false, JSON.stringify({ response: retired.status, predecessorGone }));
  return;
}
check("P2-I6: retired predecessor cannot use its previous self credential",
  (await fetch(`${BASE}/api/self`, {
    headers: { "x-fleet-self-token": mainSelfTokenAfterRestart },
  })).status === 401);
```

Danach den alten Slot mit `/api/slots/${mainSlot}/open` und `{cwd:REPO}` wieder oeffnen und die geaenderte `openedAt` sowie neue Credential nach vorhandener Reopen-Fixture beweisen. Erst dann den Server stoppen, die erhaltene deaktivierte Auto-Quelle lesen und nur deren `nextAt` auf 0 setzen. Das macht den alten Befehl faellig, ohne ihn zu autorisieren. Die Watch-Quelle separat auf dieselbe alte ID und `armed:false` pruefen. Der folgende Block setzt `reopened.ok` und beobachteten neuen Occupant als Fixture-Voraussetzung voraus:

```ts
await tmuxOut("kill-session", "-t", "srv");
type AutoSource = { id: string; enabled: boolean; nextAt: number;
  lastRun: number; text: string };
const stopped = JSON.parse(await Bun.file(`${ROOT}/fleet.json`).text()) as {
  autos: AutoSource[]; watches: { id: string; armed: boolean }[];
};
const oldAuto = stopped.autos.find(a => a.id === retiredAutoId);
const oldWatch = stopped.watches.find(w => w.id === retiredWatchId);
if (!oldAuto || oldAuto.enabled || oldAuto.lastRun !== 0 || !oldWatch || oldWatch.armed) {
  check("P2-I6 fixture: both retired sources remain disabled and auto never ran", false,
    JSON.stringify({ oldAuto, oldWatch }));
  await restartSrv();
  return;
}
await Bun.write(`${ROOT}/fleet.json`, JSON.stringify({ ...stopped,
  autos: stopped.autos.map(a => a.id === retiredAutoId ? { ...a, nextAt: 0 } : a) }));
await restartSrv();
const controlText = `P2-I6-control-${mainProgram.id}`;
const control = await post(`/api/slots/${mainSlot}/autos`,
  { text: controlText, inSec: 1, idleSec: 0 });
const controlBody = await control.json() as { auto?: { id: string } };
const orderResponse = await get("/api/sessions");
const orderBody = await orderResponse.json() as { autos: AutoSource[] };
const oldIndex = orderBody.autos.findIndex(a => a.id === retiredAutoId);
const controlIndex = orderBody.autos.findIndex(a => a.id === controlBody.auto?.id);
if (!orderResponse.ok || oldIndex < 0 || controlIndex <= oldIndex) {
  check("P2-I6 fixture: old due source precedes the authorized control in the same auto loop",
    false, JSON.stringify({ oldIndex, controlIndex }));
  return;
}
const deadline = Date.now() + afterTick(1000, AUTOS_TICK_MS) + 10_000;
let controlSeen = false;
while (Date.now() < deadline && !controlSeen) {
  controlSeen = (await plogRead()).some(p => p.source === "auto" && p.text === controlText);
  if (!controlSeen) await Bun.sleep(100);
}
if (!control.ok || !controlSeen) {
  check("P2-I6 fixture: authorized control proves a real auto tick after old command became due",
    false, JSON.stringify({ response: control.status, controlSeen }));
  return;
}
const observed = await get("/api/sessions");
const observedBody = await observed.json() as { autos: AutoSource[] };
const finalAuto = observedBody.autos.find(a => a.id === retiredAutoId);
const prompts = await plogRead();
check("P2-I6: a due retired auto never executes into the recycled slot",
  observed.ok && finalAuto?.enabled === false && finalAuto.lastRun === 0
    && !prompts.some(p => p.source === "auto" && p.text === retiredAutoText),
  JSON.stringify({ finalAuto, controlSeen }));
```

Der positive Kontroll-Auto belegt eine echte Ausfuehrung nach Faelligkeit des alten Befehls; der alte Auto steht davor im erhaltenen Array, der neue Kontroll-Auto wird angehaengt (`server.ts#createAutoForSlot:5301-5315`, `lastRun:0` und Auto-Append; vor dem Kontrolllauf Reihenfolge aus `/api/sessions` als Fixture pruefen). Der Test prueft eine benannte Tick-Gelegenheit, nicht unendliche Zukunft. Eine Mutation, die die alte Auto-Quelle kurz aktiviert und nach einem Send wieder deaktiviert, faellt an `lastRun` oder am eindeutigen Prompt-Text. Fuer Watch bleibt die getrennte Gegenprobe auf Events mit genau `watchId === retiredWatchId` passend: nach Retirement den eigenen Target-Zustand herstellen, echten Watch-Tick durch einen unabhaengigen positiven Kontroll-Watch auf denselben Zustand belegen, dann keine Event-Neuproduktion fuer die alte ID verlangen. Ein reiner Auto-Kontrollsend ist kein Watch-Tick-Beweis.

Nach abschliessendem Restart dieselben terminalen Quell- und Projektionswerte lesen. Programfremde/recycelte Credentials erhalten weiterhin keine Rueckgabesicht. Mutation Quellenloeschung faellt an den erhaltenen IDs; Mutation automatisches Re-Arm faellt an Quellen-/Wirkungspruefung. Fehlende neue Schemafelder bleiben am Pin erwartete Zielluecken, kein gemessener Runtime-Fehler.

## Ergänzende Retention-Grenze / nicht gemessen

`server.ts#pruneFleetReports:6364–6372` wählt heute nach terminalem/fehlendem Event, nicht nach fachlicher Entscheidung. Zielgegenprobe: undecided Report mit terminalem Legacy-Event und Program-Pointer pflanzen; echte Prune-Produktion wie `e2e/watch.ts:2360–2395` auslösen; derselbe offene Report muss erhalten bleiben. Terminale Zeile mit offener Rückgabedisposition ebenfalls behalten. Erst beides terminal erlaubt die ausgewiesene Retention. Verlorener alter Event-Inhalt ergibt notification unknown, nie erfundenes ACK. Inbox-Cap separat: 100 gültige Einträge, 101. echt produzieren, genaue entfernte ID und dropped+1 prüfen (gelesene zuerst); vorhandener dangling-Join-Beleg `e2e/programs.ts:1864–1866`. Mutation: Entscheidung an Transport-ACK koppeln oder offene Quellen prunen.

Alle sechs Blöcke sind statische Entwürfe, nicht ausgeführt; neue Schemafelder stammen ausdrücklich aus dem Abschnitt „Kleinste vorgeschlagene Schema-Ergaenzungen“ und sind am Pin fehlend/erwartet rot. Geprüft wurden fokussierte Quellenblöcke, keine vollständigen Event-/Adapter-/Auto-Familien. Kein Runtime-Erfolg, kein Suite-Beweis. Finale Dokumentkontrolle: geschlossene Codefences, sechs Invarianten, gepinnter SHA; kein Compilerlauf für die eingebetteten Fixture-Entwürfe.


## Invarianten zu bestehenden Traegern

| Invariante | Bestehende Zeilen / fehlender Teil |
|---|---|
| P2-I1 dauerhafte Sicht/Quittung | c464af30 + 417d2be5; Leserbasis bereits vorhanden, Producer und Restart-Erhalt ergaenzen. |
| P2-I2 aktuelle Entscheidungsautoritaet | 417d2be5; D2 e88884c8 darf Event-Autoritaet nicht auf Program-Leserecht erweitern. |
| P2-I3 belegte ID-Anreicherung | e88884c8 im Review-Program; keine neue Fleet-Betrieb-Zeile. |
| P2-I4 echte Producer | c464af30 Attention, 417d2be5 Report, 288f6359 Audit; pro Producer derselbe Quell-/Persistenz-/Scope-Vertrag. |
| P2-I5 terminale Rueckgabe | 18e87e67 lebender Worker; Ergaenzung mit 417d2be5 fuer Program-Nachfolge bei totem Worker fehlt im engen Brief. c62aa3e9 traegt freie Prinzipalantwort, nicht Reportentscheidung. |
| P2-I6 erhaltene abgeschaltete Subscription | Kein voller Traeger; 74319808 behandelt nur Dedupe beim Report, nicht Tod des Registranten. Fehlenden Schnitt an Fleet-Betrieb zur Disposition geben. |

## Queue-Abgleich und Brief-Vorschlaege

Lesestand 2026-09-07; Live-Projektion P2 und gefilterte private Queue-Lesung. Massgeblich ist `Task.brief.text`, sofern vorhanden, sonst `Task.text`. Die elf fachlichen Zeilen stimmen in diesem effektiven Text mit `/tmp/astra-tagesmandat-2026-09-07/probleme-quellen.json` ueberein; der Snapshot nennt als Herkunft `2026-09-07 before proposal`, Quellbaum `8644b37d3da289337fabda99332e014833a9f3e7`. Das ist ein datierter Datenvergleich, keine Ausfuehrungsautoritaet. Alle elf stehen beim Lesen pending. Operative Empfaengerbindung wird vor Rueckgabe neu gelesen; Slotnummern sind nur historische Hinweise.

| Bestehende Zeile | Eigentuemer / Zweck | Vorschlag und Grenze |
|---|---|---|
| c464af30 | Fleet-Betrieb f170dc46e4b026ee34d9392e; S3a-ii | Attention-Quelle und Inbox-Zeiger gemeinsam bestaetigen; echte Succession, Restart, fremdes Program, Replay/Retention pruefen. Architekturbrief §3-ii ist Ziel, kein Istbeweis. Sein handoff-only-Survival reicht fuer beliebigen Sessiontod nicht: beim spaeteren Boot-Reconcile fehlt `why`. Dauerhafte Zugehoerigkeit an Program/Quelle belegen, Owner-Kill als benannte Policy getrennt behandeln. |
| 417d2be5 | Fleet-Betrieb; S3b | Reports ueber provenance.programId lesen, Entscheidung nur durch aktuell gebundene MAIN, historische Entscheidungsautoritaet separat. Offene unbeurteilte Reports nicht wegen eines abgeschlossenen Transportevents prunen. Quelle: Architekturbrief §4:401-437. |
| 74319808 | Fleet-Betrieb; S3d, zusaetzlich in Live-Queue gefunden | Kein neuer Task: bestehende Lane-Watch-Dedupe nach 417d2be5 verwenden. Nur dieselbe Lane und denselben exakt gebundenen Watch-Halter entwaffnen; Merge-/Audit-Fakten bleiben verschieden. Quelle: Architekturbrief §6:479-526. |
| 288f6359 | Fleet-Betrieb; S3c | Rote Audits an jedes aus exakten covers belegte Program; lokale und Helper-Schreiber gleich behandeln. Fehlende Provenance ist unknown, nicht programlos. Dedupe pro Audit/Program, Ledger-Join und Retention im selben Schnitt. Quelle: Architekturbrief §5:443-473. |
| 18e87e67 | Fleet-Betrieb; Decision-Rueckgabe | Bestehenden Reportpfad reparieren; ein Ereignis je Entscheidung an den noch lebenden exakten Worker. Fuer toten/recycelten Worker keine Umadressierung; benannter Transportausgang mit Reportbezug muss fuer das Program auffindbar bleiben. Letzteres fehlt im jetzigen engen Brief: als explizite Ergaenzung vorschlagen, nicht heimlich Inbox-/Kanalbau hineinziehen. |
| c62aa3e9 | Fleet-Betrieb; adressierte Prinzipalnachricht | Effektiven geschaerften Brief lesen. §2 sagt Controller unsupported, §3 fordert dennoch Supervisor-Aufloesung und §4(1) Rollen-Succession, der Pin fordert Supervisor-Kopplung. Diese Widersprueche vor Freigabe entfernen: Program→Program-Fall pruefen, Controller benannt nicht-adressierbar. Sender-Provenance, Antwortkorrelation, Replay-Grenze, fehlende Antwort und Terminalsicht nach Sendertod entscheiden. Kein neuer Serverrecord durch P2. |
| e88884c8 | Review-Program eec695280b9ca5a84824eec0; D2 | Bestehenden engen ACK-Auftrag behalten; unknown→bekannt desselben Occupants gegen echtes A→B und Recycle unterscheiden. Keine Duplikatzeile in Fleet-Betrieb, keine Wiederholung des ganzen Review-Programs. |
| e7e356e9 | Review-Program; advisory Vertragsvorschlag an Fleet-Betrieb | Keine Implementierungszeile. Seine Sender-/Retention-/Replay-/Subject-Join-Pruefungen in obige bestehende Briefs integrieren. Ueberschneidung ist Vertragsarbeit, keine doppelte Umsetzung. |
| 1832c7eb | Fleet-Betrieb; S5c Dispatch-Env | Keine Adressierungsinvariante. Architekturbrief §8-c:626-636 betrifft einen Program-Deckel. Nicht als P2-Fortschritt zaehlen. |
| 201d0240 | Fleet-Betrieb; R6 Wartegrund | Ehrlicher Harness-/Deckelgrund, keine dauerhafte Nachricht oder terminale Rueckgabe. Nicht als Adressierungsschnitt zaehlen. |
| 328fd28f | Game-Maker-v2 b2aa5b453d0f2bf9ddce8232; Critic-Supersession | Ueberschneidung nur bei terminalem unknown und veraltetem Erstreport. Critic-Versuchszaehler, Fristen und Requeue sind nicht P2; bestehendes Program behaelt die Zeile. |
| e0d625a5 | Game-Maker-v2; Abschluss ohne Commit | Projektion OWNER_GATE fuer complete/ahead=0, keine Adressierung. Der typisierte Widerspruch konsumiert den Reportvertrag; nicht uebernehmen. |

Fehlende Schnitte werden NICHT als neue Queue-Auftraege angelegt: (1) dauerhafte Rueckgabesicht bei totem Sender an 18e87e67/417d2be5 antragen; (2) Watches/Autos/Clarifications brauchen eine ausdrueckliche Entscheidung zwischen wiederauffindbarer Sachpflicht und occupantgebundener Ausfuehrung, weil die genannten Inbox-Schreiber diese Familien ausnehmen; (3) eine autorisierte Controller-Adresse samt Nachfolge bleibt ein Owner-Entscheid ausserhalb dieser Charter. Die bestehende Reihenfolge S3a-ii → S3b → S3d → S3c bleibt beim Traeger; D2 und die engen Decisions nur seriell nach dessen Kollisionsfreigabe. Kein Produktcode, Release oder fremder Task wird von P2 geaendert.

## Adapter und Oberflaechen

Die Einstufung bezeichnet die Relevanz fuer diesen Vertrag, keine gemessene Funktionsfaehigkeit.

| Adapter / Flaeche | Entscheidung | Pruefgrenze |
|---|---|---|
| Claude | apply | Program-Lesen, Succession, Occupant-Pruefung und terminale Rueckgabe; keine reale TUI-Probe hier. |
| Codex | apply | Dieselben Vertraege, zusaetzlich D2 null→bekannt; direkter Live-Lernpfad und echte Zustellung/ACK bleiben ungemessen. |
| Pi | apply | Program-/Occupant-Vertrag gilt ebenfalls; kein gelesener Beleg fuer dieselbe spaete Codex-ID-Naht. Pi-Adapterausfuehrung ungemessen. |
| Controller als Rollenadresse | unsupported | Keine ausdruecklich autorisierte dauerhafte Controller-Bindung nachgewiesen; keine Aufloesung ueber Supervisor/Label/Slot. |
| Server / Persistenz | apply | Producer, Reader, Retention, gespeicherte Rueckgabedisposition und Await-Identitaet. |
| Wire / Loader | apply | Geschlossene Kinds, IDs und optionale Felder; alte Records bleiben lesbar oder benannt unknown, keine null-Wildcards. |
| Reverse-State / Program-Projektion | apply | Offene Pflicht, terminaler Transport und fachliche Entscheidung getrennt und nach Succession auffindbar. |
| Client | apply | Neue Basis/terminaler Grund muessen in geschlossenen Fallunterscheidungen sichtbar sein; kein UI-Redesign. Client-Quellpfade wurden hier nicht vollstaendig gelesen. |
| Docs / Probes | apply | Existierende Aussagen ueber Loeschung und fehlende Worker-Nachricht beim jeweiligen Schnitt aktualisieren; negative Lifecycle- und Retention-Proben neben ihrer Familie. |
| P3 Land/Deploy-Ausfuehrung | not-applicable fuer P2-Produktion | P3 konsumiert Identitaets- und Terminalvertrag. Ein persistierter Report-Review, Git-Commit, Land und Deploy bleiben verschiedene Akte. Keine dieser Aktionen wird durch Inbox-Read oder ACK autorisiert. |

## Methode, Belegpfade und Abnahme

Quellen werden reproduzierbar aus dem Pin gelesen, beispielsweise:

```sh
git show e917a48b1a0dfa894cd9470b683606252725b0e9:server.ts | nl -ba | sed -n '6635,6682p'
git show e917a48b1a0dfa894cd9470b683606252725b0e9:server.ts | rg -n 'appendProgramInbox'
```

Graphify war Orientierung, keine Quelle fuer aktuelle Zeilennummern. Gelesene Belegpfade: `server.ts`, `server/types.ts`, `docs/self-api.md`, `docs/program-lebenszyklus-architektur-2026-09-04.md`, gezielte Familien in `e2e/programs.ts`, `e2e/watch.ts`, `e2e/autos.ts`, `e2e/self-token.ts`, `e2e/harness.ts`; `docs/messungen/INDEX.md` auf bestehende Messnotizen geprueft. Die Quellen- und Testlekture erfolgte durch die Autor-MAIN und zwei native Leseagenten; diese Leseagenten sind nicht die unabhaengige abschliessende Abnahme.

Private Arbeitsbelege liegen unter `/tmp/astra-p2-2026-09-07/`: `message-paths.md`, `property-design.md`, `queue.json`, `queue-mapping.md`. Der Gruendungssnapshot ist `/tmp/astra-tagesmandat-2026-09-07/probleme-quellen.json`; Task-IDs und effektive Briefpassagen oben sind die datierten Rueckverweise. Diese privaten Dateien werden nicht publiziert; sie koennen nach Aufraeumen fehlen. Das getrackte Dokument enthaelt deshalb die entscheidenden Codebelege und Brief-Widersprueche selbst. Keine historischen Incident-Pfade wurden als erneut gemessener Betrieb ausgegeben.

Abnahmeweg: Ein unabhaengiger zweiter Astra-Reviewer liest dieses vollstaendige Dokument, die relevanten Quellen am Pin und den vorgesehenen Indexsatz. Sein gesonderter Beleg lautet `ACCEPT sha256:<Datei-Hash>` fuer genau die gelesenen Bytes oder benennt belegte Ablehnungsgruende. Der Datei-Hash ist kein Git-SHA und kein Testbeweis. Er kann nicht als eigener Hash in diese Datei eingefuegt werden, ohne die versiegelten Bytes zu veraendern.

Danach uebernimmt eine isolierte serielle Opus-Publikationslane diese Bytes, traegt den Indexsatz ein und committet selbst. Sie liefert absolute Original-Logpfade, Exitcodes und ungekappte Tails der kurzen Dokumentpruefung:

```sh
bun install --frozen-lockfile
bun e2e/pins.ts
```

MAIN liest die Originalausgaben (Pins-Tail `ALL PASS`), vergleicht Draft und publizierte Datei byteweise und mit SHA-256, und liest den Git-Commit-SHA separat. Jede Aenderung der Vertragsbytes verlangt erneute unabhaengige Abnahme der geaenderten Teile im Gesamtdokument. Erst danach dokumentiert die zustaendige MAIN ihre Annahme. Land und Deploy bleiben beim Controller. P2 startet keine Astra-Suite und keinen Default-Server.

## Nicht gemessen

Keine Live-Zustellung, kein ACK einer realen Codex-Session, kein isolierter Serverlauf, keine Crash-/Datentraegerfehlersonde, kein Helperlauf und keine historische Basisrate wurden fuer diesen Vertrag ausgefuehrt. Die im Mandat genannten Vorfaelle bleiben fremde Claims; D2 wird hier am Vergleichspfad erklaert, nicht historisch reproduziert. Die Property-Bloecke sind Testentwuerfe fuer eine spaetere Implementierung, keine ausgefuehrten gruenen Checks. Insbesondere vorgeschlagene Schemaerweiterungen sind am Pin nicht vorhanden.

Keine vollstaendige Lektuere aller Event-Kinds, Client-Ansichten, Adapter oder Send-Await-Pfade; daraus wird keine umfassende Sicherheits- oder Vollstaendigkeitsaussage abgeleitet. Unbekannt bleiben reale Wiederanlaufzeiten, Fehlerhaeufigkeiten, kuenftige Leser-Liveness und der dauerhaft autorisierte Controller-Rueckweg. Das Zielversprechen des Owner-Mandats bleibt vom belegten Istbetrieb getrennt.

# Das Band ziehen: gibt es das Transkript der Vorgängerin? (2026-09-21)

Stand: dieser Baum (Lane `fleet/260920104118-733b`), gemessen am LIVE-`fleet.json` des
Haupt-Checkouts und an `~/.claude/projects/` (nur lesend). Anlass: Owner-Runde 3 zur Leiste.

## 1. Der Satz des Owners und was daraus folgt

Wortlaut: „das mir das band nicht gefällt. Es scheint auch irgendwie die Idee dahinter verloren
gegeangen zu sein. Ich möchte das man die einzelnen session slots quasi durch ein Band ziehen kann,
um so dann z.b das transscript der vorherigen session ansehen und analysieren zu können"

| Satz | Element |
|---|---|
| „das band nicht gefällt" | Fassungen A–D (Zähler, Pillenkette) werden nicht weiter verfolgt. D wird nicht poliert |
| „die Idee dahinter verloren" | Die Idee steht in `2026-09-18-slot-system-und-linke-leiste.md` §3.2: je Slot ein waagrechtes Band, die Vorgängerin schaut links 20 px hervor, die Nachfolgerin erscheint rechts. Das Band ist eine ZEITACHSE je Slot, kein Zähler und keine Deko |
| „session slots … durch ein Band ziehen" | Der Kasten des Slots liegt auf einer Spur, die man seitwärts zieht (Maus, Finger, Shift+Rad, ← →). Nach rechts ziehen geht zurück in der Zeit, und das Band rastet auf einer Session ein |
| „das transscript der vorherigen session ansehen" | Die Session, auf der das Band einrastet, öffnet ihr Transkript in der Hauptfläche, nur lesend, darüber ihr Übergabe-Report |
| „… und analysieren" | ✨ an genau diesem Transkript: die Zusammenfassung, die es heute für die laufende Session gibt. Im Entwurf nicht verdrahtet |

Was keinen Satz hat, kommt nicht hinein: Kappen-Umrisse für noch freie Staffelstäbe, Zähler
(„s3 · 2/5“), Animationen der Übergabe. Metall- und Farbflächen aus §3.2 sind hier nicht Thema.

## 2. Messung: ist das Transkript einer abgelösten Session heute erreichbar?

Die 💬-Ansicht liest `~/.claude/projects/<slug(cwd)>/<sessionId>.jsonl` (`server.ts#transcriptFile`)
und kennt nur den LAUFENDEN Occupant (`/api/slots/:id/transcript`). Für eine Vorgängerin braucht
das Ziehen also deren `sessionId` und `cwd`.

**Lanes: ja, 3 von 3.** Slot 4 (diese Lane, Session 4) hat drei vergangene Sessions. Jede hat
einen `handoff`-Report in `fleet.json#fleetReports`, dessen `worker` `sessionId` und `cwd` trägt:
`a2c78974…`, `9331ca99…`, `e50fc86d…`. Alle drei Dateien liegen auf der Platte (Zeitspannen
20.09. 10:41 bis 21.09. 04:40, aneinander anschließend).

Zwei Einschränkungen, beide am Code gelesen:
- Das Append-Ledger `fleet-reports.jsonl` speichert KEINE `sessionId` (`server.ts#ledgerReportOpen`:
  id, taskId, programId, slot, branch, status, basis, text, at). Die Zuordnung lebt nur in den
  Zeilen von `fleet.json`.
- Diese Zeilen werden beschnitten (`server.ts#pruneFleetReports`, `FLEET_REPORT_KEEP = 20` über
  die transportseitig fertigen Zeilen). Heute stehen 152 Zeilen, der Schnitt greift also noch
  nicht. Er ist aber die Stelle, an der ein älteres Band leer würde.

**MAINs: nein, 0 von 11.** Ein Linien-Record (`LineageHandover`) nennt den Vorgänger nur als
`{slot, openedAt}` (`server/types.ts#LineageOccupant`). Keiner der 11 Records im Live-State hat
einen Report desselben Occupants mit `sessionId`, und `audit.jsonl` schreibt die `sessionId` nur
bei `slot_sleep`, `program_main_session_backfill` und `migrate_gave_up`. Raten über die Zeit hilft
nicht: in den vier MAIN-cwds liegen 621 Transkripte, und pro Record fallen 2 bis 29 davon in das
Fenster [openedAt, Übergabe]. Also mehrdeutig, und eine Ansicht, die das falsche Gespräch als „die
Vorgängerin" öffnet, ist schlimmer als eine leere.

Nebenbefund: eine MAIN-Linie wechselt die Slots. Die Linie von Slot 1 (Orchestratorin, `f54c59…`)
hat ihre fünf Vorgänger auf den Slots 10, 6, 7, 6 und 7. Das Band gehört also der LINIE, nicht
der Slot-Nummer.

**Was das Ziehen für MAINs füllen würde** (nicht gebaut): beim Nachfolgen die `sessionId` und den
`cwd` der Abgelösten in den Linien-Record schreiben, und für Lanes dauerhaft auf dem Slot statt
nur im beschnittenen Report. Beides sind Server-Fakten, die im Moment der Übergabe im Speicher
stehen (`s.sessionId`). Eine Route `GET /api/slots/:id/succession/:n/transcript` läse dann
dieselbe Datei wie die 💬-Ansicht.

## 3. Das Mockup

`docs/design/sidebar/leiste-mess/band-zieh.js` baut EINE HTML-Datei aus der echten Nachfolge-Kette
zweier Slots: Slot 4 (Lane, 3 Vorgängerinnen mit Transkript) und Slot 1 (MAIN, 5 Vorgänger ohne
Transkript, mit dem Befund aus §2 im Klartext). Die Datei liegt AUSSERHALB des Baums, weil
Transkripte privates Arbeitsmaterial sind. Tokens und lange Hex-Kennungen werden vor dem Schreiben
entfernt (geprüft: 0 Treffer für `[0-9a-f]{32,}`).

Gemessen per Chrome/CDP mit echten Zeigerereignissen: Laden öffnet Slot 4 auf der laufenden
Session 4. Zieh nach rechts rastet auf Session 3 ein (47 Beiträge), noch einmal auf Session 2 (24),
nach links zurück auf 3. Auf Slot 1 zeigt Session 5 „Kein Transkript: a lineage record names slot +
openedAt only …".

## 4. Nachtrag: gebaut (2026-09-21, Branch `fleet/260921195502-0682`, Shas setzt die MAIN)

Anlass, Owner woertlich: „die private-repo-a-Session auf slot2 hat gerade eine succession auf slot6
gemacht.. und wenn ich auf dem band ziehe, sehe ich nichtmal die alte session :(" — gemessen am
Live-Server: `GET /api/slots/6/succession` fuenf vergangene Sessions, jede `report: null`, jede
`assigned: false`.

Was §2 als „nicht gebaut" beschrieb, steht jetzt:
- **Linien-Record (Orchestratorin, Legacy-MAIN, Supervisor):** `from` traegt `sessionId` und `cwd`
  der Abgeloesten (`server/types.ts#LineageSeat`), gelesen in `server.ts#handleSelfSucceed`
  direkt nach der letzten Occupant-Pruefung. Ein Record ohne die beiden Schluessel laedt weiter
  (Alt-Record); `sessionId: null` heisst „die Session hatte keine" (FLEET_CMD=true, fremder Harness).
- **Lane:** jede Uebergabe schreibt einen Sitz `{openedAt, handedAt, sessionId, cwd}` auf den Slot
  (`Slot.laneSeats`, persistiert, max. 50, Reset in openSlot wie `laneSuccessions`). Der Report bleibt
  Rueckfall, der Sitz ueberlebt `pruneFleetReports`.
- **Lesen:** `server.ts#successionLine` nimmt das Paar aus Sitz/Record zuerst, den Report danach;
  `successionChain` gibt es nicht auf den Draht, `pastTranscript` liest es.
- **Program-MAIN** ist nicht Teil dieses Schnitts: `ProgramHandover.from` und `ProgramLineageEntry`
  tragen `sessionId` schon, aber `successionChain` liest fuer eine Program-MAIN gar keine Linie
  (sie hat keine `lineageId`, ihr Band zeigt Session 1). Offen.

Alte Records bleiben `assigned: false` — kein Backfill ueber Zeitfenster (§2). Die fuenf Sessions
der Bewerbung-Linie bleiben also leer; erst die naechste Nachfolge nach dem Deploy fuellt das Band.


# Agent OS P0-D — Surfaces und Kommunikationsartefakte

**Stand:** HEAD `b29d2c7`, 2026-08-11 · **Art:** read-only Inventar · **Gate:** G0

**Ablaufdatum:** Nach G0 ist `agent-os-synthesis.md` die operative Wahrheit. Dieses Inventar
wandert beim ersten Phase-1-Land ins Agent-OS-Attic.

## Ergebnis in einem Satz

Fleet hat bereits Task-Detail, Lane-Akte, Shares, Text-Export und einen gut abgesicherten
Worktree-Upload; es fehlt kein generischer „Dateien hochladen“-Mechanismus, sondern ein gemeinsamer
Surface-Vertrag und eine dauerhafte private Referenz von Task/Lane/Outcome auf Kommunikations-
artefakte.

## Heutige Surface-Landkarte

| Surface | Server-/Datenanker | Client / Beweis | Kopplung heute |
|---|---|---|---|
| Task Queue/Detail | `server.ts::Task`, `GET/POST /api/tasks*` | `src/client.ts::TaskInfo`, `e2e/tasks.ts` | viele Shapes server/client doppelt; Volltexte nur bei Overlay-Open |
| Task-Dateiflaeche | `task-metadata.ts::deriveTaskMetadata` | Queue-Projektion, `register.sh`, `e2e/tasks.ts` | pure read-only Ableitung; `confirmed` und `derived` getrennt |
| Harness Picker | `server.ts::Harness`, `/api/harnesses` | `HarnessInfo`, einmaliger Fetch | Supports serverseitig; Client kopiert Wire-Shape noch lokal |
| Lane Runtime | Slot, LaneRef, LaneAnchor, Git-/Context-Fakten | `/api/sessions`, Sidebar/Panes | 2-s-Poll bewusst kompakt; Volltexte gehoeren nicht hinein |
| Lane Outcome/Akte | `LaneOutcome`, `/api/lane-outcomes`, `/api/lane?branch=...` | Outcome-/Dossier-Lens, `e2e/outcomes.ts` | Branch/Repo/Commit-Fakten vorhanden, Task-/Harness-Join fehlt |
| Audit/Adjudikation | Audit-Ledgers und Ownerroute | Audit-Overlay/Steward | append-only Urteilspraezedenz existiert |
| Session Share | `Share`, `ShareComment`, `/api/slots/:id/share` | `src/share.ts`, Share-Dialog, `e2e/share.ts` | laufende Session view/interact; secret/password, keine Artefaktakte |
| Session Export | Export-Route mit Attachment-Header | Slot-Aktion, `e2e/slots.ts` | Text-/Sessiondownload, nicht an Task/Outcome referenziert |
| File Drop | `/api/slots/:id/upload`, `drops/` | Drag, Paste, Button; `e2e/drops.ts` | owner-auth, 20 MB, sanitisiert, lane-lokal und vergaenglich |

`src/protocol.ts` ist die richtige mechanische Heimat fuer Werte/Shapes, die mehr als eine
TypeScript-Datei identisch brauchen. Es traegt bereits Git-, LaneAnchor-, Disposition-, Audit-,
Modellfenster- und Worker-Vertraege. `Task`, `LaneOutcome`, Harness-Wire-Info, Shares und Artefakte
sind noch nicht als gemeinsamer Vertrag dort angekommen.

## Contract-Luecken

1. **Task-Shape:** `server.ts::Task` und `src/client.ts::TaskInfo` sind getrennte Interfaces; neue
   Context-/Provenienzfelder koennten auf einer Surface fehlen, ohne Compile-Fehler.
2. **Outcome-Shape:** `LaneOutcome` ist serverlokal; Tests und Client deklarieren Teilshapes.
3. **Harness-Shape:** die Registry ist serverseitig stark, aber `HarnessInfo` kopiert die
   Wire-Sicht. `worker`, Context-Sensor und Host-Commit sind gar nicht Teil desselben Katalogs.
4. **Reverse-State:** Viele alte Rows koennen neue Felder nicht tragen. Abwesenheit muss auf Wire,
   Client und Report `unknown` bleiben, nicht `false`.
5. **Lifecycle:** Task -> Slot -> Outcome ist nicht first-class verknuepft; Surface-Entscheidungen
   koennen deshalb nach dem Land nicht mit dem Auftrag verglichen werden.
6. **Dokumentation/Test:** `e2e/pins.ts` deckt TS↔Doc/Shell-Paare ab, aber es gibt noch keine
   Regel, die einen neuen Surface-Status auf Task, Brief und Outcome zusammenhaelt.

## Surface Decision List: klein statt universal

Die Liste wird nur fuer mechanisch relevante Surfaces erzeugt. `task-metadata.ts` liefert mit
Dateien und Prozesscluster bereits den ersten Filter; ein Modell darf ergaenzen, aber nicht aus
Abwesenheit „nicht relevant“ machen.

```text
surfaceId: server | client-ui | shared-protocol | e2e | docs | harness | security | deploy
relevance: derived | proposed | promoted | unknown
decision: implement | not-applicable | deferred | unknown
reason
evidenceRefs[]
decidedBy: mechanism | owner
```

Regeln:

- Nur `derived` relevante Surfaces und explizite Vorschlaege erscheinen im Task-Detail.
- `not-applicable` braucht einen Grund; ein fehlender Eintrag ist `unknown`.
- Modellvorschlaege werden nicht still in den Brief geschrieben; der Owner promotet bei
  cross-cutting Arbeit die bindende Liste.
- Outcome speichert die bestaetigte Soll-Liste plus mechanisch beobachtete Ist-Flaechen. Der
  Report zeigt die Differenz, ohne ein Modellurteil als Fakt zu behandeln.
- Sichtbare Client-Aenderungen verlangen die passende echte Client-Passage nur dann, wenn Done/
  Brief sie nennt; keine Universal-Browser-Zeremonie fuer Server-only Arbeit.

## Der vorhandene Upload: nicht neu bauen

`server.ts::DROP_DIR` und `/api/slots/:id/upload` leisten bereits:

- Owner-Bearer-Auth und aktiver Slot als Ziel;
- 20-MB-Cap vor und nach Multipart-Decoding;
- Drain des abgewiesenen Request-Bodys, damit die Verbindung weiterlebt;
- rebuilt Filename gegen Traversal;
- `realpath` des Session-cwd und serverbestimmten Unterordner;
- Git-Ignore-Gate: in Repos wird verweigert, wenn `drops/` den Land-Baum dirty machen wuerde;
- Audit-Event und exakte Byte-/Landability-/Teardown-Gegenproben in `e2e/drops.ts`;
- Retention durch Worktree-Lebensdauer: beim Entfernen der Lane verschwinden die Drops.

Was er bewusst **nicht** ist:

- kein dauerhafter Store;
- keine Task-/LaneOutcome-Referenz;
- keine MIME-Allowlist oder Inhaltsvalidierung;
- kein Download-/Preview-Vertrag fuer historische Ergebnisse;
- kein Self-Token-Upload fuer eine Lane und keine oeffentliche Freigabe;
- kein Beweis, dass ein im Prompt erwaehnter Pfad spaeter noch existiert.

Phase 6 erweitert deshalb den Traeger, statt eine zweite Upload-UI parallel zu bauen.

## Engster sicherer Artefakt-Anker fuer Phase 6

### Metadaten

```text
artifactId
taskId + laneId? + outcomeId?
kind: screenshot | video | log | html | file
scope: owner-private | lane-self
name + mediaType + bytes + sha256
createdAt + createdBy
storageRef                 # server erzeugt, niemals Caller-Hostpfad
expiresAt? + deletedAt?
source: upload | promoted-drop | generated
```

Task und Outcome tragen nur `artifactRefs[]`. Binaerdaten liegen in einem Fleet-eigenen lokalen,
nicht getrackten Store mit zufaelliger ID; kein Request darf einen beliebigen Hostpfad zum Read
bestimmen. Bestehende Drops koennen spaeter explizit in diesen Store **promotet** werden, aber nie
automatisch beim Land.

### Auth und Boundaries

- Default `owner-private`; keine Public-URL in v1.
- Lane-Self darf nur an die eigene `laneId/taskId` schreiben und nie fremde Artefakte lesen.
- Ownerroute bestimmt Task/Lane/Outcome; Body bestimmt weder absoluten Pfad noch Store-Ziel.
- Store-Root wird `realpath`-validiert; keine Symlinks/Junctions, atomare Datei+Metadaten-
  Publikation, Hash nach Write.
- Per-File- und per-Task-Caps, MIME-Allowlist je `kind`, HTML immer passiv/sandboxed ausliefern.
- Delete/Expiry ist ein eigener auditierter Zustand; Outcome-Referenz zeigt `deleted`, nicht 404
  als vermeintlich nie vorhanden.

### UI-Anker

Eine einzige Artefaktliste im vollen Task-Detail; Lane-Akte und Outcome projizieren dieselben Refs.
Keine Karte im 2-s-Session-Poll. Preview nur fuer erlaubte Typen; Download bleibt authentifiziert.
Share-Links werden nicht als Abkuerzung benutzt, weil sie eine laufende Session und andere
Lebensdauer/Auth-Semantik tragen.

## Testfamilien fuer spaetere Schnitte

- Pure Protocol-/Projection-Tests neben `task-metadata.ts` und in `e2e/tasks.ts`.
- Upload/Boundary/MIME/Symlink/Cap/Auth in `e2e/security.ts` oder einer klar registrierten
  Artifact-Familie; Runner bleibt nur Runner.
- Lifecycle Task -> Lane -> Outcome -> deleted/expired in `e2e/outcomes.ts`.
- Real-Client-Passage fuer sichtbare Preview/Download-Aenderung; null/unknown/stale jeweils als
  eigener Gegenfall.

## Offene G0-Entscheide

- Darf die Surface Decision List mechanisch klein starten und nur bei cross-cutting Tasks vom
  Owner promotet werden? Empfehlung: ja.
- Ist der vorhandene Drop der kurzlebige Ingress und ein spaeter Fleet-Store nur fuer explizit
  dauerhafte Artefakte? Empfehlung: ja.
- Bleiben Artefakte in v1 owner-private ohne Share/Public-URL? Empfehlung: ja.

## Nicht geprueft

Keine Route wurde aufgerufen und kein Upload erzeugt. MIME-Verhalten im Browser und bestehende
Share-Deployment-Details wurden nicht live getestet. Die vorgeschlagene Store-Grenze ist ein
Phase-6-Designanker, kein Bauauftrag vor G5/G6.

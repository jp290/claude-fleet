# Notizen smart verarbeiten — wo die 127 `notiz`-Zeilen heute enden, und der Join, der fehlt

2026-09-06, Program-MAIN „Land-Pipeline 2026-09" (Slot 9), Denkauftrag Queue-Zeile `b7577779`.
Owner-Vorgabe woertlich (2026-09-06 12:0x): **„das bringt erst wirklich was wenn solche notizen dann
wiederum an task's, repo's oder mindestens vom 'dispatcher', smart verarbeitet und mit einbezogen
werden, bitte denk mal einmal drueber nach was hier am besten waere."**

Alle Zahlen aus `fleet.json` und `bun task-metadata.ts --state fleet.json` um 14:2x; Methode in §6.

## 1. IST — belegt am Code und an der Queue

**Konsumenten einer `notiz` heute: der Owner, und sonst niemand.** Am Code (`rg -n '"notiz"' server.ts`):

- `server.ts` Route `tasks/:id/adopt`: eine pending `notiz` wird in place zum `auftrag` (Kind
  umgeschrieben, Zeile bleibt); alles andere 409. Das ist der EINZIGE Uebergang.
- `server.ts#tickBacklogNudge` filtert `kind === "auftrag"`; `server.ts#tickDispatch` ebenso;
  `server.ts#briefDue` (Brief-Kompiler) ebenso. `projectTaskWaves` (`task-waves.ts`) ebenso.
- `server.ts#compileBriefs` bekommt nur Auftrag-Zeilen — und **laeuft im Betrieb gar nicht**:
  `FLEET_BRIEF_MS` fehlt in `watchdog.sh` und `.env` (Default 0, `./state.sh` Config-Sensor
  fuehrt keinen Wert), ebenso `FLEET_ANALYSIS_MS=0`. Eine Lane bekommt heute den ROHTEXT der
  Zeile (`briefAndSend`: `next.brief?.text ?? next.text`), gefolgt von Studio-Block,
  Kontext-Anker-Block und Exit-Footer. Der Controller-Vorschlag „beim Kompilieren des Briefs
  anhaengen" traefe damit einen toten Pfad — wie der Kollisionsgate in `tickDispatch`
  (`docs/queue-wellen-2026-09-06.md` §1.1). **Der lebende Ort ist `briefAndSend`, der Dispatch.**
- **Lebenszyklus: keiner.** `capTasks` (MAX_TASKS 200) verdraengt nur TERMINALE Zeilen; eine
  pending `notiz` ist „live" und faellt nie heraus. Nichts schliesst sie, wenn ein Land ihre
  Flaeche anfasst; `landLane` markiert nur die `sent`-Zeile des eigenen Slots `done`.
- **Es gibt keine Leseroute fuer eine Lane:** `/api/self/tasks` existiert nur als POST
  (`createTaskForMain`); eine Lane kann heute keinen Queue-Text abrufen.

**Die Queue (14:2x):** 127 `notiz` pending (Median 3,2 Tage alt, aelteste 5,3 — die Kategorie ist
jung, nicht aufgeraeumt), 39 `auftrag` offen (pending/queued/sent).

| Groesse | Wert |
|---|---|
| Notizen mit ableitbarer Flaeche (`files`, derived) | **61 von 127** (48 %) |
| Notizen mit Cluster | 49 von 127 — cross-cutting 31 · server 7 · e2e-gates 6 · betrieb 2 · docs 2 · client-ui 1 |
| Notiz-Text | Median 1 397 B, p90 2 914 B, Summe 211 KB |
| Erster Satz einer Notiz | Median 267 B, p90 444 B |
| Auftrag-Text | Median 2 578 B |
| Gruendungsprompt einer Lane (`streams/prompts.jsonl`, heute) | 4 542 – 9 842 B |

## 2. Antworten auf die vier Fragen der Zeile

**(1) Ist die Flaechen-Schnittmenge scharf genug?** Nein, roh nicht — mit zwei Messern ja.
Gemessen ueber alle 39 offenen Auftraege gegen die 61 Notizen mit Flaeche:

| Schluessel | Notizen je Auftrag, Median | Bandbreite |
|---|---|---|
| ≥ 1 gemeinsame Datei | **42** | 0 – 48 |
| … ohne die vier Nabendateien (`server.ts`, `e2e/pins.ts`, `AGENTS.md`, `CLAUDE.md`) | **5** | 0 – 22 |
| ≥ 1 gemeinsame Datei UND gleicher Cluster-Prozess | 24 | 0 – 29 |
| ohne Naben UND gleicher Cluster | **3** | 0 – 17 |

`server.ts` steht in fast jeder Flaeche; die rohe Schnittmenge ist damit „alle". Die Naben-Ausnahme
ist das scharfe Messer (42 → 5), der Cluster das zweite (5 → 3). Zehn Auftraege haben ohne Naben
gar keinen Treffer; das ist richtig so — ihre Flaeche IST nur `server.ts`.

**(2) Kosten je Brief in Bytes.** Eine angehaengte Zeile = Id (8) + erster Satz (Median 267, p90
444) + Trenner ≈ 280–460 B. Bei Deckel 5: **1,4 KB Median, 2,3 KB p90** — auf Gruendungsprompts von
4,5–9,8 KB also +15 bis +30 %, in Tokens ~350–600. Die Zahl wird nach dem Bau nicht geschaetzt,
sondern gelesen: `context-receipts` traegt `deliveredBytes` je Dispatch.

**(3) Rueckkanal.** Kein neues Report-Feld und keine neue Notiz: eine Lane meldet je angehaengter
Notiz ueber eine lane-only Route ein Urteil `erledigt | widerlegt | offen` mit einem Satz; das
landet als `TaskComment` auf der Notiz (bestehendes Feld, mit Branch statt Owner-Stimme), und
`erledigt` wird erst WIRKSAM (Notiz → `done`), wenn diese Lane landet — die Behauptung wird durch
das Land verifiziert, nicht durch den Report.

**(4) Reihenfolge, max. 3:** N1 Anhaengen beim Dispatch → N2 Lebenszyklus (beruehrt / Urteil /
erledigt-durch-Land) → Schnittlinie. Der Dispatcher als Konsument (Controller-Punkt C) ist im
Betrieb tot (`FLEET_ANALYSIS_MS=0`) und bleibt unter der Linie.

## 3. Schnittliste

### N1 — „Notizen auf deiner Flaeche": Anhaengen beim Dispatch

*Mechanismus:* In `server.ts#briefAndSend`, zwischen `brief` und `studioLaneBlock` (also VOR dem
Anker-Block, dessen Bytes allein der Kontext-Receipt hasht), ein Block aus hoechstens 5 Zeilen
`notiz <id> · <erster Satz>`. Auswahl rein und deterministisch in einem neuen Modul
`task-notes.ts#notesForTask(auftrag, notizen, {hubs, cap})`: Kandidat = pending `notiz`
desselben Repos mit `files`, deren Flaeche OHNE Naben die des Auftrags schneidet; Rang = gleicher
Cluster-Prozess zuerst, dann Anzahl gemeinsamer Nicht-Naben-Dateien absteigend, dann `created`
absteigend; Naben = `server.ts`, `e2e/pins.ts`, `AGENTS.md`, `CLAUDE.md` (Konstante, gepinnt). Kein
Treffer ⇒ kein Block, Brief byte-identisch zu heute. Der Block endet mit einem Satz: „Volltext:
`GET /api/self/notes` — melde je Notiz `POST /api/self/notes/<id>/verdict`" (die Routen kommen mit
N2; bis dahin steht der Satz nur, wenn die Route existiert — Feature-Test im Renderer, kein Datum).
Der Block ist Teil von `deliveredBytes` im Receipt; die angehaengten Ids stehen als
`notes: string[]` im Receipt.
*Done:* Der Gruendungsprompt eines Dispatches, dessen Auftrag mit ≥ 1 Notiz eine Nicht-Naben-Datei
teilt, traegt den Block mit ≤ 5 Zeilen in der Rangordnung oben; ein Dispatch ohne Treffer traegt
keinen Block; der Receipt nennt die Ids und die Bytes.
*Gebaut* in Lane `fleet/260907054253-88b6`, gelandet 2026-09-07 09:4x als `24cd54e` + `189f815` (Self-Land der
Program-MAIN Slot 5, `verify.ok:true`, 149 s Arbeit, 0 s Schlange) (`task-notes.ts` + der Einbau in `server.ts#briefAndSend`
und das Receipt-Feld `notes`); die Checks stehen in `e2e/tasks.ts` als Sektion `(d5)`/`(d5-live)`.
*Verify:* Checks in `e2e/tasks.ts` (Dispatch-Familie, `FLEET_CMD=true`, Prompt aus
`streams/prompts.jsonl` bzw. Pane lesen): (a) 7 passende Notizen ⇒ genau 5 Zeilen, Reihenfolge
Cluster → Anzahl → Alter; (b) nur Naben-Ueberlappung ⇒ kein Block; (c) Reinheit von `notesForTask`
(zweimal identisch, Input unveraendert); (d) Receipt traegt `notes` und `deliveredBytes` waechst um
die Blocklaenge; `bun e2e/pins.ts` gruen; volle Verify-Zeile.

### N2 — Lebenszyklus: beruehrt, beurteilt, erledigt-durch-Land

*Mechanismus, drei Schreibstellen:*
1. **beruehrt:** in `landLane` (dort, wo die `sent`-Zeile `done` wird) bekommt jede pending `notiz`
   desselben Repos, deren `files` `git diff --name-only <mainBefore>..<mainAfter>` schneiden (ohne
   Naben), einen Eintrag `touched: [{sha, branch, at}]` (Deckel 5, aelteste faellt). Das Board zeigt
   „beruehrt von n Lands, zuletzt <sha>".
2. **beurteilt:** lane-only `GET /api/self/notes` (nur die im eigenen Receipt genannten Ids,
   Volltext) und `POST /api/self/notes/:id/verdict {verdict: erledigt|widerlegt|offen, text}` ⇒
   `TaskComment` auf der Notiz mit `from: <branch>`; 409 fuer Ids ausserhalb des eigenen Receipts.
3. **erledigt-durch-Land:** landet eine Lane, deren `erledigt`-Urteil auf einer Notiz steht, wird
   die Notiz `done` mit `note: "erledigt durch Land <sha> (<branch>)"`. `widerlegt` bleibt pending
   mit dem Kommentar — Entscheidung des Owners (archivieren oder halten). Ein `killed-*`-Ausgang
   der Lane laesst alles pending; das Urteil bleibt als Kommentar lesbar.
*Done:* Nach einem Land, dessen Diff eine Nicht-Naben-Datei einer pending Notiz enthaelt, traegt die
Notiz `touched[0].sha == mainAfter`; nach einem Land einer Lane mit `erledigt`-Urteil ist die Notiz
`done` mit der Land-Sha in `note`; ein Urteil auf eine fremde Id antwortet 409.
*Verify:* Checks in `e2e/land-durability.ts` (touched nach Land) und `e2e/tasks.ts` (Routen,
409-Grenze, erledigt-durch-Land, killed laesst pending); `./e2e-clean-review.sh` lokal, weil
`landLane` beruehrt wird; `bun e2e/pins.ts` gruen.
*Gebaut* in Lane `fleet/260907235032-17ed` (`server/types.ts` `TaskVerdict`/`TaskTouch`/`touched`,
`server.ts#applyLandToNotes` + `#laneNoteIds` + die zwei `/api/self/notes`-Routen, `task-notes.ts`
`NOTES_READ_ROUTES_EXIST: true`, die Queue-Zeile in `src/client.ts#qTouchedLine`); die Checks stehen
als `(n2-*)` in `e2e/land-durability.ts` §H und `e2e/tasks.ts` §(d5-live). Die Land-Sha setzt die
MAIN nach dem Land ein.

**Schnittlinie.** Nach N1 erreicht jede Notiz die Lanes, die ihre Dateien anfassen; nach N2 sieht
der Owner je Notiz, ob sie beruehrt, widerlegt oder erledigt ist, und erledigte verschwinden von
selbst. Das ist „an tasks … smart verarbeitet und mit einbezogen". Was folgt, sind getrennte
Vorschlaege.

### Unter der Linie

- **N3 — Dispatcher advisory** (Controller-Punkt C): eine `real`-Notiz auf der Flaeche macht das
  Verdict `needs-you`. Setzt `FLEET_ANALYSIS_MS > 0` voraus, was heute ein Owner-Akt an
  `watchdog.sh` ist (Nicht-Ziel des Programs). Ohne den Schalter waere der Schnitt tot.
- **Notizen ohne Flaeche (66 von 127):** heute Owner-Lesestoff. Eine Hand-Flaeche
  (`refine-confirm` gibt es fuer Auftraege; fuer Notizen fehlt der Knopf) oder ein Verfall nach
  N Tagen ohne Beruehrung sind beides Owner-Entscheide ueber Lesearbeit; die Zahl 66 sagt, wie
  gross die Entscheidung ist.
- **„an repos":** `Task.repo` ist Owner-only und die Flaechen-Ableitung kennt nur die getrackten
  Pfade des Fleet-Repos (`readTrackedSnapshot`). Notizen fuer Fremd-Repos bekaemen erst mit einem
  Snapshot je Repo eine Flaeche — Teil des Dual-Host-/Multi-Repo-Programs, nicht dieses.

## 4. Was NICHT gebaut wird

- Die Liste der 127 in irgendeinen Brief (Deckel 5, gemessen +1,4 KB).
- Ein Modellaufruf zur Auswahl: der Join ist Mengenarithmetik ueber `files` und `cluster`, die
  `task-metadata.ts` schon liefert; ein Modell wuerde nur die 66 flaechenlosen Notizen lesen
  koennen, und deren Zuordnung ist eine Owner-Frage.
- Ein eigenes Notiz-Objekt neben `Task`: die Zeile traegt schon `files`, `cluster`, `comments`,
  `analysis`; N1/N2 fuegen `touched` und die Herkunft eines Kommentars hinzu, sonst nichts.

## 5. Erfolgskriterium, messbar

Nach N1: `context-receipts` traegt fuer Dispatches mit Treffern ein nicht-leeres `notes`; der
Median von `deliveredBytes` steigt um ≤ 2,3 KB (p90 der Blockgroesse). Nach N2: `fleet.json` traegt
Notizen mit `touched`, und `done`-Notizen mit `erledigt durch Land` in `note`; der Bestand pending
Notizen mit Flaeche sinkt, ohne dass der Owner eine Zeile anfasst.

## 6. Methode

`bun task-metadata.ts --state fleet.json` liefert je Zeile `files`/`filesOrigin`/`cluster`;
`fleet.json` liefert `kind`, `status`, `text`, `created`. Schnittmengen als Python-Mengen ueber
`files`; Naben wie oben; Cluster = `cluster.prozess`. Bytes = UTF-8 des Textes; erster Satz =
Split am ersten `.!?` + Leerraum. Gruendungsprompt-Bytes aus `streams/prompts.jsonl` (`source:
auto`, Texte > 3 000 B von heute). Code: `server.ts#briefAndSend` (Aufbau `deliveredBrief`, Receipt),
`server.ts#compileBriefs`/`briefDue`, `server.ts#capTasks`, `server.ts#landLane`, Route `adopt`,
`server/types.ts#Task`.

## 7. Nicht gemessen

- Ob die fuenf bestplatzierten Notizen fuer eine Lane NUETZLICH sind — das misst erst N2s Urteil.
- Die Flaechen-Ableitung selbst (Pfad-Tokens im Text): ihre Trefferquote gegen die wahre Flaeche
  ist nicht bekannt; `docs/queue-wellen-2026-09-06.md` §2 R3 nennt sie „Prosa".
- Fremd-Repos: alle 127 Notizen sind gegen den Fleet-Snapshot abgeleitet.

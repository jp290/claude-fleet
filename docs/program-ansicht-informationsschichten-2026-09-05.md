# Program-Ansicht — welche Informationsschichten ein Program aggregieren muss (2026-09-05)

Vorarbeit fuer die neue Ansicht, die der Owner am 2026-09-05 frueh baut. Verfasst vom Controller
Slot 3 in der Nacht auf den 05.09., waehrend das Land von `0a099c62` im Suite-Mutex wartete. Jede
Quellenangabe ist am Code, an `fleet.json` oder an den Ledgern nachgezaehlt; Zahlen sind Stand
00:5x. Baut auf dem Lebenszyklus-Paket auf (`docs/program-lebenszyklus-2026-09-04.md`, Schnitt 2
= D2-Projektion `9fd34beb`, S12 = Client-Detail `7ed73694`) und wiederholt es nicht — es sagt,
was AUSSERHALB von D2 fehlt, und schneidet daraus ein v1.

## 0. Das Ergebnis in vier Saetzen

1. Ein Program hat heute KEIN Repo-Feld (`Program`-Keys in `fleet.json`: `id title intent status
   successCriterion decisions evidence openQuestions nonGoals proposedBy …At`). Repo ist eine
   Ableitung aus `main.cwd`, `Task.repo`, `Slot.cwd` und `outcome.repo` — und diese Ableitung ist
   lueckenhaft (Outcome-Zeilen mit `repo`: 694/770, mit `programId`: 234/770).
2. Die Nacht vom 04./05.09. waere mit DREI Schichten auf einen Blick sichtbar gewesen: Steuerung
   (vier Programs `active` mit `occupancy: stale`), Maschine (ein Mutex-Anwaerter verlor 2 h 45 min
   lang drei Rennen) und Kommunikation (Attentions sterben mit der Succession). Keine der drei ist
   heute auf dem Board; die erste kommt mit D2, die anderen beiden haben keinen Sensor.
3. Zwei Schichten, die der Owner heute von Hand ersetzt, entstehen mit dem Lebenszyklus-Paket
   ohnehin: das Routing von Nachrichten (D1-Inbox, Schnitte 3a–3d) und das Gedaechtnis der MAIN
   (D3, Handoff am Program). Die Ansicht soll sie ANZEIGEN, nicht nachbauen.
4. v1 = eine Seite je Program aus fuenf Schichten, EINE neue Owner-Route mit Ledger-Lesen auf
   Abruf (nicht im Poll), kein Knopf ausser `archive`/`complete`, die es schon gibt.

## 1. Die Schichten

Je Schicht: die Frage des Owners · Quelle der Wahrheit heute · Join-Schluessel zum Program ·
Halbwertszeit · was keinen Sensor hat.

### L0 Identitaet und Absicht
- Frage: Was will dieses Program, woran erkennt man Erfolg, was wurde entschieden?
- Quelle: `fleet.json#programs[]` (`title intent successCriterion decisions[] evidence[]
  openQuestions[] nonGoals status promotion deliveryBudget`), gerendert heute in
  `src/client.ts#renderProgramDetail` (zeigt `id title intent status main successCriterion
  deliveryBudget`, sonst nichts).
- Join: das Program selbst. Halbwertszeit: Tage (ownergeschrieben). Sensor: vollstaendig.

### L1 Steuerung — wer fuehrt, und lebt sie noch
- Frage: Welche Session ist die MAIN, ist sie am Leben, wie voll ist sie, wartet sie auf mich?
- Quelle: `server.ts#programHealth` → `occupancy live|stale|unbound` + `sessionIdMatch`
  (Occupant-Tripel `{slot, openedAt, sessionId}` gegen `slots[]`), `lineage` am Program (API-
  seitig angehaengt), `ctx`/`agent`/`model`/`effort` aus dem Owner-Poll `GET /api/sessions`,
  `awaiting` NUR aus `fleet.json#slots` (der Poll traegt es nicht).
- Join: `program.main.slot` + `openedAt`. Halbwertszeit: Minuten — jede Succession und jeder
  Pane-Heal aendert das Tripel, `model` in der Pane und im Datensatz koennen auseinanderlaufen.
- Sensor fehlt: Effort einer LAUFENDEN Pane (nur Spawn-Wert bekannt), und `stale` steht heute
  nur in der API, nicht auf dem Board (D2/S12 bringen `programsStale` + Detail).
- Beleg der Nacht: `f99e9354 07ee8a6d 2c073232 b2aa5b45` alle `active`, alle `stale`.

### L2 Arbeit — die Queue des Programs
- Frage: Was liegt an, was ist freigegeben, was startet als Naechstes, was blockiert den Start?
- Quelle: `fleet.json#tasks[]` mit `programId` (134/200 Zeilen tragen es), `status
  pending|queued|sent|done`, `kind auftrag|notiz|richtung|betrieb`, `brief`, `slot`-Link.
  Startreihenfolge = ARRAY-POSITION der `queued`-Zeilen (`server.ts#tickDispatch` iteriert
  `tasks` in Reihenfolge, keine Prioritaet), Deckel `FLEET_DISPATCH_MAX_LANES` (2) und je Program
  (`programLanes` im selben Tick), Master-Stop `dispatch`, Quiet Hours.
- Join: `task.programId`. Halbwertszeit: Sekunden bis Stunden.
- Sensor fehlt: „warum startet nichts" als Satz (Deckel? Program-Deckel? Position?) — der Tick
  schreibt es als `note` an die Zeile, das Board zeigt es nicht gebuendelt. Und die 105
  `notiz`-Zeilen ohne Leser: Notizen mit `programId` gehoeren als eigener Zaehler ans Program.

### L3 Ausfuehrung — Lanes, Worktrees, Sessions
- Frage: Welche Lanes arbeiten fuer dieses Program, wo stehen sie, sind sie landbar, wie voll?
- Quelle: `fleet.json#slots{}` mit `programId` (4/10 belegte Slots), `cwd`, `worktree`, `taskId`,
  `harness model effort`; live vom git-Tick `ahead/dirty/idle` und `lane-signals.ts#laneWatchSignal`
  (done-looking · spent-looking); Worktrees AUF PLATTE nur ueber `git worktree list` — verwaiste
  Worktrees (ohne Slot) kennt allein `state.sh`, kein Endpoint.
- Join: `slot.programId`, `slot.taskId → task.programId`. Halbwertszeit: Sekunden.
- Sensor fehlt: die vier Zwillingszustaende einer idle Lane (fertig · Messzeile · wartet auf dich ·
  Brief kompiliert) sind dem Praedikat nicht unterscheidbar — nur die Pane. Eine Ansicht darf
  „done-looking" nie als „fertig" beschriften.

### L4 Integration — Lands
- Frage: Was ist gelandet, was liegt im Land, was ist geparkt, was koennte man rueckgaengig machen?
- Quelle: `lane-outcomes.jsonl` (`programId taskId branch repo disposition mainAfter verified
  landedBy releasedBy repairRounds review`), `fleet.json#merges{}` (laufende Lands, slot-keyed),
  `mergeParked{}`, `undoLands` (Stack Tiefe 3), Land-Notes `git notes --ref=fleet/land`.
- Join: `outcome.programId` (nur 234/770 — aeltere Zeilen tragen es nicht; Fallback ueber
  `taskId → task.programId`, 391/770). Halbwertszeit: die Zeile ist endgueltig; `merges` ist
  slot-keyed und ueberlebt ein Slot-Recycling (nach BRANCH vergleichen, wie `laneAutoCloseRefusal`).
- Sensor fehlt: „Land wartet im Suite-Mutex seit N min" — `runVerify` streamt es nur ins Log.

### L5 Beweis — Post-Land-Audits
- Frage: Ist das, was gelandet ist, gruen — und wenn rot, hat jemand hingesehen?
- Quelle: `post-land-audits.jsonl` (`mainSha covers[]{branch,mainAfter} result checks ms fails`),
  Adjudikationen separat (`adjudicationsByAudit()`), Lauf/Queue in `GET /api/post-land-audits`.
- Join: KEIN `programId` — ausschliesslich `covers[].mainAfter ↔ outcome.mainAfter` (D2 baut genau
  diesen Join). Halbwertszeit: endgueltig; ein Audit entsteht erst am Laufende (~25–35 min), eine
  fehlende Zeile heisst „laeuft", nie „verloren".
- Sensor fehlt: `fails[]` in nur 11/470 Zeilen (Schnitt 1 des Pakets schliesst es); ein Sammel-
  Audit deckt N Lands mehrerer Programs — die Ansicht muss das Audit an JEDEM gedeckten Program
  zeigen, nicht am ersten.

### L6 Auslieferung — Deploy
- Frage: Laeuft der gelandete Code schon?
- Quelle: `deploys.jsonl` (`head bootHead ok by stage`), `deployGap{bootHead, codeBehind}` im Poll.
- Join: `lastLand.sha` ist Vorfahr von `bootHead` ⇒ deployt. Gilt NUR fuer dieses Repo; fuer
  jedes andere Repo ist die Schicht `null` und muss so gerendert werden (D2 tut das).

### L7 Kommunikation — Nachrichten und Rueckwege
- Frage: Wartet die MAIN auf mich, wartet jemand auf die MAIN, ist eine Frage verloren gegangen?
- Quelle: `attentionRequests[]` (20/20 mit `programId`; `refused` +
  `refusedReason: "requester session ended"` = mit der Succession gestorben), `fleetReports[]`
  (30, Empfaenger = Occupant-Tripel, `pruneFleetReports` haelt nur die juengsten), `events[]`
  (103 Watch-Zustellungen, `acknowledgedAt`), `watches[]` (13), `autos`.
- Join: `attention.programId`; Reports/Events/Watches nur ueber den Empfaenger-SLOT → `slot.programId`.
- Halbwertszeit: die Occupant-Bindung — ein Succession-Teardown verwirft Autos, Mission, Watches
  und stellt Attentions auf `refused`. Genau das ersetzt D1 (Inbox am Program, 3a-i/3a-ii).
- Fuer die Ansicht: `refused`-Attentions eines Programs sind UNBEANTWORTETE Fragen und muessen
  als solche stehen, nicht als abgelehnte.

### L8 Gedaechtnis — Handoffs, Messungen, Entscheide
- Frage: Was hat die letzte MAIN gelernt, welche Messung traegt diese Zeile?
- Quelle: `HANDOFF.md` (15 gestapelte `# HANDOFF`-Abschnitte verschiedener MAINs, in git),
  `docs/messungen/` (81 Dateien), `program.decisions[]`/`evidence[]` (je ≤ 300 Zeichen),
  Commit-Bodies, Land-Notes.
- Join: nur Text (Program-Id im Handoff-Titel). D3 verschiebt den Handoff ans Program; bis dahin
  zeigt die Ansicht den Handoff-Abschnitt, dessen Titel die Program-Id nennt — als Link, nicht Text.

### L9 Maschine und Kapazitaet — fleet-weit, aber jedes Program haengt daran
- Frage: Warum bewegt sich nichts?
- Quelle: Suite-Mutex NUR als `/tmp/fleet-e2e.lock/pid` + Prozessliste (kein Feld, keine Route);
  Deckel-Lage aus `slots` vs `FLEET_DISPATCH_MAX_LANES`; Helfer `helperDevices[]` (2) und
  Suite-Angebote `laneSuiteJobs[]` (20); `deployGap`; TMPDIR-Scratch (3,1 GB, kein Reaper).
- Sensor fehlt: die Mutex-SCHLANGE (Halter, Anwaerter, Wartezeit je Anwaerter). Zeile `d4342a62`
  (FIFO-Tickets als Dateien) wuerde sie nebenbei lesbar machen — die Ticket-Dateien sind der
  Sensor, den der Server nur noch einsammeln muesste.

## 2. Repo als Querschnitt, nicht als Schicht

Programs spannen Repos: Private-repo-j (`2c073232`) arbeitet in `game-maker-private-repo-j`, seine Zeilen
und Docs liegen teils hier. Die Ansicht braucht je Program eine ABGELEITETE Liste
`repos[] = distinct(repoCanon(main.cwd, task.repo, slot.cwd, outcome.repo))` und je Repo die
Schichten L3–L6 getrennt (Lands und Audits sind repo-gebunden; Deploy gibt es nur hier). Ohne ein
explizites Feld bleibt die Liste eine Heuristik — siehe Frage 1.

## 3. v1-Schnitt fuer morgen frueh

- **Eine Route, auf Abruf:** `GET /api/programs/:id/view` (Owner-Token) liefert L0 + L1 + L2
  (Zaehler je Status/Kind, naechste startbare Zeile, Blockgrund) + L3 (Lane-Tabelle mit
  Signal, ahead/dirty, ctx) + L4/L5 (`lastLand`/`lastAudit` aus D2s `programStatusView`) + L7
  (offene UND `refused` Attentions) + `repos[]`. Ledger werden hier gelesen, nicht im Poll — D2
  hat die Owner-Liste bewusst ledgerfrei gelassen; die Detailseite ist der richtige Ort.
- **Ein fleet-weites Banner ueber allen Programs:** Deckel-Lage, laufende Lands (`merges`),
  laufendes Audit, Mutex-Halter (vorerst aus `/tmp`-Lock + `ps -eo command | grep -c`, ehrlich
  als Prozess-Sicht beschriftet) — L9, weil die Frage „warum nichts?" immer fleet-weit ist.
- **Weggelassen in v1:** L8 (bis D3), Deploy jenseits von `codeBehind`, per-Repo-Aufschluesselung
  jenseits der Liste, jeder Knopf ausser den bestehenden `archive`/`complete`.
- **Reihenfolge:** die Route zuerst, mit einem e2e-Check in `e2e/programs.ts` (stale Bindung,
  refused Attention und ein rotes unadjudiziertes Audit sind im JSON sichtbar; Mutation: Feld
  weglassen → rot); dann das Rendern in `renderProgramDetail`. S12 (`7ed73694`) rendert D2s
  Felder — die neue Ansicht ERWEITERT diese Flaeche, ein zweites Board waere ein Fehler.

## 4. Drei Entscheide vor dem Bauen

1. **Repo explizit oder abgeleitet?** Ein `repos[]`-Feld am Program (gesetzt bei `bootstrap-main`
   und beim Filen einer Zeile mit `repo`) macht L3–L6 eindeutig; abgeleitet bleibt es eine
   Heuristik mit 76 Outcome-Zeilen ohne Repo.
2. **Ledger im Poll oder auf Abruf?** D2 sagt: Poll ledgerfrei. Die Detailroute liest drei Ledger
   je Aufruf (Outcomes 770, Audits 470, Deploys 167 Zeilen) — heute Millisekunden, aber ohne
   Cache waechst es mit jedem Tag. mtime-Cache je Datei ist der billige Mittelweg.
3. **Was tut die Ansicht mit `stale`?** Nur zeigen (D2-Doktrin: der Tick meldet, der Owner
   entscheidet) — oder `archive`/`rebind` als Knopf am Program. Heute gibt es `archive` und
   `complete`, kein Parken und kein Rebind; vier Programs warten seit Stunden genau darauf.

# Kern 5 — Datenschichten von Claude Fleet (Befund, kein Umbau)

Stand: 2026-09-25 ~14:15, Baum `07e998e9`, Haupt-Checkout `/Users/owner/claude-fleet`. Nur gelesen:
kein Server, keine Suite, keine Schreibroute, keine Datei im Repo verändert. Messskripte:
`scratchpad/stats.py` und `scratchpad/trace.py`. Zeilennummern gelten für diesen Baum (datierter Snapshot).

**Soll es diese Abstraktion geben?** Ja. Append-only-Ledger neben einem veränderlichen Zustandsdokument
ist das richtige Grundmuster für eine Einzelmaschinen-App. Das Problem liegt nicht in der Form,
sondern darin, dass es 16 Ledger mit 9 verschiedenen Schlüsseln gibt, keinen Ereignisschlüssel, der
über alle Ledger reicht, und Leser, die nur die zwei jüngsten Generationen sehen.

Abdeckungsplan (vorab): jede Schreibstelle in `server.ts`/`server/*.ts` (`rg appendFile|writeFile|Bun.write|renameSync`
plus die Datei-Konstanten `server.ts:189-258`, `:5129`, `:16725`, `:37234-37237`), jede Datei auf Platte vermessen,
Leser per `rg` in `server.ts`, Skripten und `src/*.ts` gefunden, dann 3 gelandete Tasks über alle Schichten verfolgt.

---

## 1. Inventar

Größe/Zeilen/Zeitraum: gemessen mit `stats.py`. Wachstum: Bytes der letzten 7 Tage. „R" = Rotation über
`server/persist.ts#queueEventWrite` bei 5 000 000 B (`AUDIT_ROTATE_BYTES`, `persist.ts:6`): aktiv → `.1`,
das alte `.1` wird an `.archive` angehängt (`persist.ts#rotateEventLog`). `readLedger` liest **nur `.1` + aktiv**
(`persist.ts:115`). Das `.archive` liest nur der Rückwärtsleser (`persist.ts#scanGenerationBackward`) für die Memory-Tür.

| Schicht | Schreiber | Leser (Code / Skript / UI) | Größe · Zeilen · 7-Tage-Wachstum | Zeitraum | Korrelationsschlüssel | Rotation |
|---|---|---|---|---|---|---|
| `fleet.json` | `server.ts#saveState` → tmp+rename `:5295`, `.bak` 2,6 MB | Boot, alle Routen, `state.sh` (10×), `register.sh` (11×) | 2,6 MB; tasks 200 (1,15 MB), programs 75 (455 KB), events 130, fleetReports 57, attention 21, clarifications 18, watches 29, laneSuiteJobs 21 | Zustand | tasks.id/originId/programId/slot; slots.{id,openedAt,sessionId,taskId,programId,worktree.branch}; programs.main.{slot,openedAt,sessionId} | ersetzt, gedeckelt (s. §2/B3) |
| `audit.jsonl` (+`.1`, `.archive`) | `server/audit-log.ts#audit` → `appendEvent` `:497` | `/api/audit` `:40143` (UI), slot-stats `:5064`, `laneDossier` `:28152`, Boot `:35576`, `:37813`; `state.sh:336` (nur `.1`+aktiv) | 1,8 MB + 5,0 + 5,0 MB; 13 818 + 37 749 + 41 760 Zeilen; 1,81 MB/7 T | 2026-07-21 … heute (Archiv ab 07-21, `.1` ab 09-07, aktiv ab 09-20) | `slot` (ohne `openedAt`), `event`, freies `detail`; `taskId` als Feld nur in 298 von 51 568 Zeilen (`.1`+aktiv) | R, zweimal rotiert |
| `lane-outcomes.jsonl` | `server.ts#emitLaneOutcome` `:27891/:27895` (+ Main-Direct `:27966`) | ~14 Leser (`:2640`, `:2990`, `:28142`, `:28272`, `/api/lane-outcomes` UI `src/client.ts:16189`), `state.sh`, `land-quality.ts`, `briefstats.ts` u. a. | 1,73 MB; 1 362; 0,28 MB/7 T | 07-24 … heute | `branch`, `ts`, `taskId` (866/1073 landed), `programId`, `headSha`, `mainAfter`, `briefHash`; **kein `slot`, kein `sessionId`, kein `id`** bei Lane-Zeilen; 34 `origin:"main-direct"`-Zeilen mit anderem Schema | R (35 %) |
| `post-land-audits.jsonl` | `appendEvent` `:24859`, `:26120`, `:26494` | `memoryAuditState` `:2918`, `laneDossier` `:28203`, `/api/post-land-audits` `:40187`, Boot `:35541`, `state.sh`, `land-quality.ts` | 3,90 MB; 950 (589 grün / 192 rot / 169 unknown); 0,85 MB/7 T | 07-26 … heute | PK = `at` (ms; 0 Duplikate), `mainSha`, `covers[]{branch, mainAfter, at}`; **kein taskId** | R bei 78 % → erste Rotation in ≈ 9 Tagen (hochgerechnet) |
| `audit-adjudications.jsonl` | `:27020`, `:27070`, `:27227` | `adjudicationsByAudit` `:26858` | 71 KB; 198 | 08-06 … heute | `auditAt` → `post-land-audits.at` (0 Waisen) | R |
| `helper-artifacts.jsonl` | `:26723` | `:27168`, `/api/post-land-audits/artifact` `:40218` | 156 KB; 707 | 09-04 … heute | `rowAt` + `jobId`; **ob Audit oder Vorschau, sagt die Zeile nicht** | R |
| `fleet-reports.jsonl` | `:11278` (open), `:11287` (decision), `:12065` (escalation) | nur `:3196` (Memory-Historie); `memoryTaskRow`/`resolveTaskLane` lesen den **Live-Tail** (`:2966`, `:28290`) | 1,87 MB; 601 open / 591 decision; 1,18 MB/7 T | **erst ab 09-14 14:58** | `id`, `taskId` (592/601), `programId`, `slot`, `branch` | R |
| `context-receipts.jsonl` | `:15483` (Dispatch), `:32283`, `:32378`, `:32468`, `:32593`, `:33459`, `:33650` (Gründungen) | `:2641`, `:3104`, `:5809`, `:6693`, `/api/context-receipts` (UI `src/hub.ts`), `state.sh`, `lane-context-cost.ts`, `briefstats.ts` | 2,35 MB; 1 246; 0,67 MB/7 T | 08-14 10:36 … heute | `id`, `taskId`, `originId`, `programId`, `slot`, `branch`, `head`, `briefHash` — **die dichteste Join-Zeile** | R |
| `tasks-archive.jsonl` | `server.ts#archiveTaskLine` `:4437` (sync, bewusst ohne Rotation) | `youngestArchivedTask` `:4469`, `register.sh` (6×), `land-quality.ts`, `ctl.sh` | 5,91 MB; 1 037 Zeilen = 633 Tasks (terminal + evicted = 2 Kopien); 4,28 MB/7 T | **erst ab 09-15 18:06** | `task.id` + ganzes Task-Objekt (größte Zeile 31 KB, davon 27 KB `comments`) | **keine** (118 % der Schwelle) |
| `streams/prompts.jsonl` | `:5158` (direktes `appendFile`) | `laneDossier` `:28160`, `/api/prompts` `:40133`, `:27500`, `:37795`, `continuity.ts` | **35,1 MB**; 19 934; **10,0 MB/7 T** | 07-05 … heute | `slot`+`openedAt` (100 %), `sessionId` (4 503/4 554), `cwd` (Pfad), `sendId` (401/4 554) | **keine** |
| `state-snapshots.jsonl` | `setInterval` `:35695` | nur `GET /api/self/memory?view=observations` (`:3363-3470`, `:3574`) | 3,13 MB; 4 081; 3,14 MB/7 T | 09-22 … heute | `lanes[]` mit Branch, `bootEpoch` | R → `.archive` unbegrenzt |
| `cards.jsonl` | `:16035`, `:16048` | **kein Produktionsleser** (nur `e2e/tasks.ts:9699`) | 595 KB; 814 | 09-13 … heute | `taskId` | R |
| `deploys.jsonl` + `deploy-inflight.json` | `:37278`; Marker `:37324` (tmp+rename) | `/api/deploys` `:38015`/`:40235`, `:37306`, `:37396`, `:32816` | 74 KB; 266 | 08-09 … heute | `id`, `target`/`head`/`bootHead` (sha) | R |
| `post-land-audit-queue.json` | `:24225` (ganz neu geschrieben) | Boot `:35593` | 239 B | Zustand | covers | — |
| `steward-journal.jsonl` | `:36089` | `:36070`, `:36092`, `:38246`, `/api/steward/journal` | 95 KB; 184 | 07-22 … **09-13** (seit 12 Tagen still) | `kind`, `ref`, `task` | R |
| `dispositions.jsonl` | `:28361` | `/api/dispositions` `:28340`, UI (`src/client.ts`, 5×) | 212 B; **2 Zeilen** | 07-25 … 08-06 | `ref`, `worker` | R |
| `land-quality.jsonl` | **nur von Hand**: `bun land-quality.ts --out` (`land-quality.ts:282`) | `state.sh:266` (`--summary`), `lane-context-cost.ts:330` | 303 KB; 642 | 08-03 … **09-17** | `branch`, `taskId`, `mainAfter` | — |
| `inspektion-register.jsonl` | **niemand** (einziger Treffer: `.gitignore`) | **niemand** | 9,6 KB; 26 | 07-29 … 07-30 | `key`, `task` | — |
| `variant-compare.jsonl` | `:17140` | nur `e2e/tasks.ts:3669` | **Datei existiert nicht** (nie live geschrieben) | — | Gruppen-id | R |
| git notes `refs/notes/fleet/land` | `server.ts#writeLandNote` `:22704-22730` | `readLandNote` `:12699`/`:28032`, `laneDossier`, `state.sh:278`, `land-log.ts:139` | 914 Notizen, jede mit vollem `verify.out` | ab Land-Einführung | Commit-sha (= `mainAfter`), `branch`, `mainBefore`; `actor.{slot,program,task}` nur in neueren Notizen (älteres Schema: 282 Notizen ohne `actor`) | — |
| git notes `refs/notes/fleet/handoff` | **niemand im Code** | **niemand im Code** | 1 Notiz | — | sha | — |
| `streams/s<slot>-<openedAt>-<hash>.raw`, `s<N>.history.json` | Stream-Capture `:7606-7612`, `:5121` | Seed/Replay | 14 raw-Dateien, größte 166 MB | nur lebende Occupants | `slot`+`openedAt` | beim Kill gelöscht (`:7892-7895`) |
| `streams/helper-artifacts/` | `:26712` | `:40222` | 49 MB | — | `jobId/rowAt` | `HELPER_ARTIFACT_KEEP`=30 (`:27134`) |
| `e2e-trail/` | `e2e/trail-emit.ts` | Trail-Leser mit `TRAIL_MAX_FILES = 400` (`:37833`) | **10 673 Dateien / 915 MB** (am 09-04: 5 925 / 443 MB laut `docs/messungen/2026-09-04-datenschichten-audit.md` §A) | 08-07 … heute | `run`, `tree`, `branch`, `check` | **keine** |

Leser-Skripte: `state.sh` liest `fleet.json`, `audit.jsonl` (`.1`+aktiv, `:336`), `lane-outcomes`, `post-land-audits`,
`context-receipts`, Land-Notizen, `land-quality` (über `land-quality.ts`) und 12 API-Routen. `register.sh` liest
nur `fleet.json` und `tasks-archive.jsonl`.

**Vorhandene Join-Schicht:** `server.ts#laneDossier` (`:28136`) verbindet 6 Quellen je Branch (Outcome,
Slot-Fenster aus `slot_open` in `audit.jsonl`, Prompts über `cwd`, `git log base..head`, Land-Notizen, Audits
samt Adjudikation/Artefakt), `resolveTaskLane` (`:28262`) findet ihn über die Task-id, `memoryTaskRow` (`:2955`)
projiziert eine Task. Die UI ruft den Dossier auf (`src/client.ts:15951`).

---

## 2. Tote und verwaiste Schichten (verifiziert per `rg` über getrackte Dateien)

| Schicht | Zustand | Beleg |
|---|---|---|
| `inspektion-register.jsonl` | tot: kein Schreiber, kein Leser, seit 07-30 unverändert | einziger Treffer `.gitignore`; bereits am 09-04 als tot gemeldet |
| `refs/notes/fleet/handoff` | verwaist: 1 Notiz, kein Schreiber/Leser im Code | `rg fleet/handoff` ohne Treffer in `*.ts`/`*.sh` |
| `cards.jsonl` | nur geschrieben: 814 Zeilen, kein Produktionsleser | Leser nur `e2e/tasks.ts:9699`; Kommentar `server.ts:15930` nennt einen „späteren Validator" |
| `variant-compare.jsonl` | Schreiber da, Datei nie entstanden | `ls` → nicht vorhanden |
| `dispositions.jsonl` | Route + UI leben, 2 Zeilen in 2 Monaten | `stats.py` |
| `steward-journal.jsonl` | seit 09-13 kein Eintrag (Steward-Rolle ruht, gefolgert) | letzter `ts` 09-13 15:41 |
| `land-quality.jsonl` | veraltet: 8 Tage alt, `state.sh` zeigt die Werte trotzdem an (mit `@asOf`-Label, `land-quality.ts:198`) | letzte Zeile 09-17 |
| `analysis-verdicts.jsonl` | laut Kommentar `server.ts:227-230` stillgelegt; auf Platte nicht mehr vorhanden | `ls` |
| `helper-artifacts.jsonl`, Vorschau-Zeilen | 412 Zeilen zeigen auf Lane-Vorschauen; nur für 18 lebt der Job noch (`laneSuiteJobs` ist auf 20 gedeckelt, `:23767`), für 20 existiert die Datei noch | `trace`-Messung |

---

## 3. Drei Spurverfolgungen (gelandete Tasks, Anlage → Audit)

Methode: `trace.py` liest **alle drei** Generationen jedes Ledgers (mehr als die Server-Leser) plus `fleet.json`
und die git-Notizen.

### T1 — `2808a559`, Branch `fleet/260813234853-1b41`, gelandet 08-14 03:01
| Stufe | Befund |
|---|---|
| Anlage / Task-Zeile | **gerissen:** nicht in `fleet.json`, nicht in `tasks-archive.jsonl` (das Archiv beginnt 09-15). Text, Brief, Anlagezeit, Program: verloren |
| Karte / Kontext-Receipt | keine (Receipts starten 08-14 10:36, Dispatch war 01:48) |
| Dispatch | `audit.jsonl.archive`: `task_dispatch` slot 2, 01:48:53 (manueller Knopf) — **nur im `.archive`, für `readLedger` unsichtbar** |
| Lane | `slot_open` slot 2 (ebenfalls nur im `.archive`) → `laneDossier` meldet `events` als unmeasured; 2 Prompts über `cwd` |
| Outcome | `landed`, `taskId` vorhanden, `programId` null, `slot` fehlt |
| Land-Notiz | vorhanden, `actor` fehlt (älteres Schema), `verify.ok` true |
| Audit | grün 03:14:43, `covers` Branch+mainAfter passen |
| Report | keiner (Ledger beginnt 09-14) |
| **Risse** | Task-Zeile weg · Dispatch/Slot nur im Archiv · kein Report |

### T2 — `5ac5565d`, Branch `fleet/260913033331-855f`, Program `f170dc46`, gelandet 09-13 06:38
| Stufe | Befund |
|---|---|
| Task-Zeile | **gerissen:** weder in `fleet.json` noch im Archiv (Verdrängung vor 09-15 war ein Löschen) |
| Karte | keine Zeile in `cards.jsonl` |
| Receipt | 1 (09-13 05:33:37, slot 4, Branch, mode mutating) — **einzige Stelle, die Task↔Slot↔Branch bindet** |
| audit.jsonl | `task_files_confirm` (09-12), `self_land_start` slot 3, `land_actor` |
| Lane | `slot_open` slot 4, 3 Prompts |
| Outcome / Notiz | landed; Notiz mit `actor{kind:main, slot 3, program, task:5ac5565d}` |
| Audit | grün 07:17:28, 1 Artefakt |
| Report | **gerissen:** keiner im Ledger (Report lag vor 09-14), Live-Tail längst verdrängt |
| **Risse** | Task-Text/Anlage/Freigabe weg · Report weg |

### T3 — `e01a4e95`, Branch `fleet/260925102412-48d0`, gelandet 09-25 13:24
| Stufe | Befund |
|---|---|
| Task-Zeile | live (`done`) + Archivzeile `terminal` 13:24:22; `created` 12:23:09 |
| Anlage | `main_task` slot 4 (`taskId` nur im `detail`-Text) |
| Karte | valid, 12:24:08 |
| Freigabe | `task_release` 12:24:12 „by=policy card-valid" (`taskId` im `detail`) |
| Dispatch | **kein Dispatch-Ereignis mit taskId**: der Tick-Pfad schreibt `slot_open`(cwd) + `send brief 5839B` ohne `taskId` (`dispatchTask` ab `:14962` auditiert nur Requeue/Park). Zuordnung nur über die 880 ms Abstand oder das Receipt (12:24:18) |
| Slot-Recycling | Slot 19 wurde 19,4 s vorher mit einer anderen Lane (`claude-fleet-demo`) geschlossen und dann neu belegt — `slot` ohne `openedAt` ist kein Schlüssel |
| Report | open 13:11 (slot 19, complete), Entscheidung `accepted` 13:24:34 von slot 4 |
| Outcome / Notiz / Audit | landed · Notiz mit `actor.task` · Audit **rot** 13:44:59, adjudiziert `flake`, 1 Artefakt |
| land-quality | keine Zeile (Ledger seit 09-17 nicht erzeugt) |
| **Risse** | keiner hart; Dispatch-Zeitpunkt nur gefolgert; Übergänge `queued→sent→done` ohne eigene Zeitstempel in der Task |

**Quer gemessen (Lands der letzten 10 Tage, n = 322):** `taskId` 319, `programId` 298, Receipt über Branch 319,
Report über Branch 316, Audit-Cover 321 (der eine fehlende: `claude-fleet-demo`, kein Audit-Kommando). **Die
Kette ist für junge Lands zu ~99 % vorhanden. Sie reißt an Aufbewahrung und Rotation, nicht an fehlenden Schreibern.**

**Außerhalb jeder Spur:** 117 von 659 First-Parent-Commits auf `main` in 10 Tagen (18 %) liegen in keinem
`mainBefore..mainAfter`-Bereich einer Land-Notiz. Davon 8 `fix/feat/refactor`, der Rest docs. Dazu kommt 1
`main-direct`-Outcome-Zeile. Diese Commits haben kein Fleet-Ereignis.

---

## 4. BLEIBT

- **`persist.ts#appendEvent`/`readLedger`**: serialisierte Append-Kette, mode 600, kaputte Zeilen werden gezählt
  statt verschluckt (`malformed`). Ein gutes Fundament.
- **`tasks-archive.jsonl`**: Seit 09-15 ist Verdrängung kein Löschen mehr. Das hat T1/T2-artige Verluste für
  neue Tasks beendet.
- **`context-receipts.jsonl`** ist schon heute die dichteste Join-Zeile (taskId, originId, programId, slot,
  branch, head, briefHash). Sie ist der natürliche Kandidat für das „dispatched"-Ereignis.
- **Occupant-Schlüssel `slot+openedAt`** in Stream-Pfaden (`:5103`) und `prompts.jsonl` (100 %): der richtige
  Schlüssel gegen Slot-Recycling.
- **`laneDossier`/`resolveTaskLane`/`memoryTaskRow`** mit `basis`/`unmeasured`-Ehrlichkeit: Das ist bereits
  der Prototyp einer Traceability-Seite. Er sollte ausgebaut werden, nicht neu geschrieben.
- **Land-Notiz am sha** und `covers{branch, mainAfter}` im Audit: stabile, git-verankerte Kette Land → Audit.
- **Seitenschienen für Urteile** (Adjudikation, Disposition): Ein Urteil kann das Ergebnis nicht überschreiben.
  Das ist strukturell richtig.

---

## 5. ÄNDERN — gerankt nach Wirkung (max. 10)

**Ä1. Leser sehen nur zwei Generationen, die Historie verschwindet still.** `readLedger` liest `.1` + aktiv
(`persist.ts:115`). `audit.jsonl` ist bereits zweimal rotiert: alles vor 09-07 liegt nur im `.archive`. In
T1 fand `laneDossier` deshalb weder `slot_open` noch Events. `post-land-audits.jsonl` steht bei 78 % und
rotiert hochgerechnet in ≈ 9 Tagen. Nach der **zweiten** Rotation liefert `memoryAuditState` für ältere Lands
`unknown` (`:2946`). Dieselbe Regel trifft `lane-outcomes`, `fleet-reports` und `context-receipts`.
*Kosten:* Die Traceability-Seite hätte einen Horizont von ~2–6 Wochen je Ledger, verschieden je Datei, und
würde „älter als der Horizont" wie „nie passiert" aussehen lassen. *Richtung:* Für Historien-Ansichten den
vorhandenen Drei-Generationen-Leser (`persist.ts#ledgerCut`/`scanGenerationBackward`) nutzen, oder einen
Index bauen (s. §6).

**Ä2. Die Task hat keine Lebenslauf-Zeitstempel und keinen Dispatch-Fakt.** `Task` trägt nur `created`
(`server/types.ts:1295ff`), `slot` ohne `openedAt`, keinen Branch. Der Tick-Dispatch schreibt keine Zeile mit
`taskId` (T3). `taskId` steht als Feld in 298 von 51 568 `audit.jsonl`-Zeilen, sonst nur im Freitext `detail`.
*Kosten:* „wann freigegeben / gestartet / fertig" lässt sich nur aus Textsuche und Zeitnähe rekonstruieren.
Nach Slot-Recycling (T3: 19 s) ist die Nähe irreführend.

**Ä3. Owner-Entscheidungen und Gesprächsschienen ohne Ledger.** `pruneAttention` (`:12334`),
`pruneClarifications` (`:10675`) und `pruneFleetEvents` (`:10661`) behalten 20 terminale Zeilen und schreiben
beim Verdrängen nur die id nach `audit.jsonl`. Gezählt: `attention_prune` 336, `fleet_event_prune` 3 162.
Program-Inbox ist auf 100 gedeckelt (`types.ts:2665`), 3 Programs stehen am Deckel. `capPrograms` (`:2424`)
verdrängt abgeschlossene Programs über 100 ohne Archiv (latent: heute 75). *Kosten:* Für eine
Traceability-Seite fehlt genau die wertvollste Klasse, nämlich was der Owner wann entschieden hat, jenseits der
letzten 20.

**Ä4. Reports werden aus dem Tail gelesen, obwohl der Ledger existiert.** `memoryTaskRow` (`:2966`) und
`resolveTaskLane` (`:28290`) lesen `fleetReports` im Speicher (`FLEET_REPORT_KEEP = 20`, `:4956`), nicht
`fleet-reports.jsonl`. *Kosten:* Für jede Task, deren Report aus dem Tail verdrängt ist, zeigt die Ansicht
`report: null`, obwohl er im Ledger steht (seit 09-14 vollständig). Zwei Ansichten beantworten dieselbe
Frage verschieden.

**Ä5. Kein durchgehender Schlüssel, zu viele Hand-Joins.** Die Ledger verwenden 9 verschiedene Schlüssel:
Outcome (`branch`+`ts`, kein `id`/`slot`/`sessionId`), Audit (`at`-Millisekunde als PK), Adjudikation
(`auditAt`), Artefakt (`rowAt`+`jobId`, Typ unbestimmt), Notiz (sha), `audit.jsonl` (`slot` ohne
`openedAt`), Prompts (`cwd`-Pfad), Receipts (taskId/slot/branch). `laneDossier` findet den Slot nur über
exakte Pfadgleichheit von `slot_open.detail` mit `worktreePathFor` (`:28115-28128`). *Kosten:* Jede neue Sicht
braucht eigenen Join-Code. Ein Pfadformatwechsel bricht die Slot-Zuordnung still.

**Ä6. Unbegrenztes Wachstum der meistgelesenen Rohdaten.** `prompts.jsonl` 35 MB, +10 MB/Woche, keine
Rotation (`:5158`), und wird bei jedem Dossier-Aufruf ganz geparst (`:28160`) (Latenz nicht gemessen).
`tasks-archive` +4,3 MB/Woche, 2 Vollkopien je Task inkl. `comments`. `e2e-trail/` 915 MB, in 3 Wochen
verdoppelt, Leser sieht 400 von 10 673 Dateien. `state-snapshots` +3,1 MB/Woche in ein unbegrenztes
`.archive`. *Kosten:* Platte und Antwortzeit. Das `.archive` wächst ohne Deckel.

**Ä7. 18 % der main-Historie ist für Fleet unsichtbar.** 117 von 659 Commits in 10 Tagen liegen außerhalb
jedes Land-Bereichs, dagegen steht 1 `main-direct`-Zeile. *Kosten:* Eine Seite, die „alles, was geschehen
ist" verspricht, lässt jeden fünften Commit aus. Nötig ist ein Git-seitiger Sammler (Commit ohne Notiz =
Ereignis `commit.direct`).

**Ä8. Tote Schichten bereinigen oder benennen.** `inspektion-register.jsonl`, `refs/notes/fleet/handoff`,
`cards.jsonl` (nur geschrieben), `variant-compare.jsonl` (nie entstanden), `land-quality.jsonl` (Hand-Erzeuger,
veraltet). *Kosten:* gering in Bytes. Aber jede tote Schicht ist eine Zeile im Traceability-Inventar, die
nichts bedeutet, und `land-quality` liefert `state.sh` 8 Tage alte Zahlen.

**Ä9. Vorschau-Artefakte werden unverknüpfbar.** 412 `helper-artifacts`-Zeilen gehören zu Lane-Vorschauen.
Ihre Job-Zeile ist auf 20 gedeckelt (`:23767`), ihre Datei auf 30 (`:27134`). 394 Zeilen zeigen auf nichts
mehr, und die Zeile selbst trägt weder Branch noch Slot noch Art (`:26714`). *Kosten:* klein, aber es ist
dasselbe Muster wie Ä3: Die Seitenschiene überlebt ihr Ziel.

**Ä10. Land-Notizen tragen den vollen Verify-Output.** Jede der 914 Notizen enthält `verify.out` (die
gezeigte Notiz: ~830 Zeilen ausgelassen, trotzdem mehrere KB). Dazu kommt `out` in `post-land-audits`. Das ist
eine uncosted observation: Die Größe von `.git` wurde nicht neu gemessen (09-04: 127 MB laut Vor-Audit).

---

## 6. Skizze: minimales einheitliches Ereignismodell für Traceability

Grundsatz: **Die Ledger nicht ersetzen, sondern einen Umschlag und einen Index danebenstellen.** Die Schreiber
existieren, die Joins gelingen für junge Lands zu ~99 %. Es fehlen ein gemeinsamer Umschlag, ein
Lane-Schlüssel und ein generationsfester Leser.

```
TraceEvent {
  id:      string            // ULID, zeitlich sortierbar, eindeutig (ersetzt `at` als PK)
  at:      number            // ms
  kind:    string            // verb.noun, geschlossene Liste (s. u.)
  actor:   { kind: "owner"|"main"|"lane"|"tick"|"helper"|"server",
             occ?: { slot, openedAt, sessionId? } }       // Occupant, nie nackter slot
  refs:    {                 // jeder Schlüssel optional, aber jeder, der BEKANNT ist, MUSS rein
             taskId?, originId?, programId?,
             lane?: { repo, branch },                    // der Lane-Schlüssel
             occ?:  { slot, openedAt },                  // der Slot-Belegungs-Schlüssel
             sha?, mainBefore?, mainAfter?,
             auditId?, reportId?, attentionId?, deployId?, jobId? }
  cause?:  string            // id des auslösenden TraceEvent (Kette statt Zeitnähe)
  src:     { file, gen, offset } | { gitNote: sha }      // Zeiger auf die volle Zeile im Fach-Ledger
  summary: string            // ≤ 200 Zeichen, nie Prompt-/Token-Text
}
```

Minimale `kind`-Liste (deckt die drei Spuren ab):
`task.created · task.carded · task.released · task.held · task.dispatched · task.done · task.archived` —
`lane.opened · lane.prompted · lane.reported · lane.closed(outcome)` — `land.started · land.verdict ·
land.landed · commit.direct` — `audit.queued · audit.finished · audit.adjudicated · audit.artifact` —
`deploy.started · deploy.verified` — `attention.raised · attention.answered · clarification.* · owner.decided`
— `program.created · program.activated · program.succeeded · program.completed`.

Einbau in drei Schritten, vom billigsten zum teuersten:
1. **Index als Projektion, ohne Schreiberänderung:** Ein Leser über alle drei Generationen jedes Ledgers plus
   Notizen plus `git log` baut `TraceEvent`s. Machbar heute für ≥ 99 % der Lands seit 09-15 (Messung §3).
   Das ist die Traceability-Seite in Version 1.
2. **Lücken an der Quelle schließen:** `task.dispatched` mit `refs.taskId` + `occ` im Tick-Pfad. Den
   Receipt-Schreiber `:15483` gibt es schon, er muss nur ein Ereignis mit ausgeben. `occ` in jede
   `audit()`-Zeile, `taskId` als Feld statt im `detail`, ein Inhalts-Ledger für Attention/Clarification/Events
   vor dem Prune, `slot`+`openedAt`+`sessionId` auf die Outcome-Zeile, `kind` auf die Artefakt-Zeile.
3. **Aufbewahrung festlegen:** Historien-Leser lesen `.archive` mit. Rotation für `prompts.jsonl` und
   `tasks-archive`, Retention für `e2e-trail/` und die `.archive`-Dateien. Die Seite nennt ihren Horizont je
   Quelle (das `basis`-Muster aus `memoryTaskRow`).

---

## 7. Verifiziert vs. gefolgert vs. nicht geprüft

**Verifiziert (am Code oder an der Datei gemessen):** alle Größen, Zeilenzahlen, Zeiträume, Schlüsselfelder,
Wachstumsraten; Schreib- und Leseorte (per `rg`, Zeilen oben); die drei Spuren; Join-Abdeckung über 322 Lands;
117/659 unverknüpfte Commits; Deckel `ATTENTION_KEEP_TERMINAL`/`FLEET_REPORT_KEEP`/`MAX_TASKS`/`MAX_PROGRAMS`/
`PROGRAM_INBOX_MAX`/`LANE_SUITE_KEEP`/`TRAIL_MAX_FILES`; Tick-Dispatch ohne taskId-Audit (`:14962` + 400 Zeilen
gegrept); Slot-Recycling in 19 s (T3).

**Gefolgert:** Rotationsdatum `post-land-audits` (linear aus 7 Tagen); Parse-Latenz von `prompts.jsonl`
(nicht gemessen); Steward ruht (nur aus Schweigen des Journals); `capPrograms` löscht ohne Archiv (Code
gelesen, noch nie ausgelöst).

**Nicht geprüft:** `.git`-Größe und Notiz-Bytes; Inhalt von `e2e-trail/` über eine Zeile hinaus;
Claude-/Codex-Transkripte unter `~/.claude/projects` und `~/.codex/sessions` (externe Schichten über
`sessionId`); Helper-seitige Ledger auf dem Second-host; `fleet.json.bak`; `.git/fleet-betrieb-R4-strich.json`;
die Memory-Sichten `:3363-3470` nur überflogen; `register.sh` nur auf gelesene Dateien geprüft; UI-Darstellung
des Dossiers nicht angesehen; Notizen und Ledger anderer Repos (`undoLands` nennt 17 Repos).
**Vorarbeiten nicht gelesen** (mögliche Überschneidung): `docs/messungen/2026-09-10-datenschichten-*.md`,
`2026-09-15-worktrail-orchestrator-bash-datenschichten.md`, `2026-09-17-worktrail-bash-datenschichten-strategisch.md`
(nur die Überschriften; §5 P2 dort ist der Ursprung von `resolveTaskLane`). Von `2026-09-04-datenschichten-audit.md`
nur §A und B1.

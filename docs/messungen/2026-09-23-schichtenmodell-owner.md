---
frage: Haengen die Datenschichten von Claude Fleet heute sauber an den Achsen Host, Repo, Program und Aufgabe, welche Zellen sieht der Owner nicht, und welcher Schnitt ist der erste?
urteil: "Von 40 Zellen (10 Schichten x 4 Achsen) haengen 18 sauber an ihrer Achse; die Aufgaben-Achse ist die sauberste (6/10), die Host-Achse die duennste (2/10, und die einzige Stelle im ganzen Ledger-Korpus, die eine Maschine nennt, nennt nur die FREMDE: audit.remote.name 282/827). Nicht 3d5ee33f ist der erste Schnitt, denn die Program-Achse hat ihre Lesung schon (programStatusView joint 6 Schichten auf GET /api/programs) und genau eine gemessene Macke: sie kollabiert ein Program mit Lands in zwei Repos auf EINEN letzten Land und zeigt dann deploy null (3/6 aktive Programs). Erster Schnitt ist die Repo-Achse, die der Owner selbst nennt: sie traegt ihre Schluessel bereits (Audits 827/827, Lands 1151/1227) und hat als einzige Sicht die Stack-Gruppierung im Board"
bereich: [datenschichten, achsen, program, repo, dual-host]
belege:
  - server.ts#programStatusView
  - server.ts#programsForAuditRow
  - server.ts#ledgerReportOpen
  - server/types.ts (interface Task, interface Program)
  - src/client.ts (byRepo, renderProgramDetail)
  - e2e-stage.sh#FLEET_SUITE_LOCK
  - watchdog.sh#195
  - context-plan.ts#ProgramContextPack
  - docs/program-ansicht-informationsschichten-2026-09-05.md
  - docs/messungen/2026-09-22-system15-datenschichten.md
  - docs/messungen/2026-09-23-zwei-geraete-board-und-queue.md
nicht-gemessen: alles auf der zweiten Maschine (kein ssh, kein Login) — die Host-Spalte ist von DIESER Instanz aus vermessen; ausserdem ungemessen: tasks-archive.jsonl als Join-Ziel, audit.jsonl als Achsentraeger, die Laufzeit-/Bytekosten jeder vorgeschlagenen Sicht und jede gerenderte Board-Flaeche (die Sichten sind aus src/client.ts gelesen, nicht aus einem Frame)
stand: 2026-09-23
---

# Das Schichtenmodell, das der Owner sieht — Host x Repo x Program x Aufgabe

2026-09-23, Lane `fleet/260922235217-316f`, Messstand 02:03 Europe/Berlin. Frage: **haengt jede
Datenschicht dieses Systems heute an genau einer der vier Achsen, oder vermischen sie sich — und
welche EINE Sicht macht die meisten der unsichtbaren Zellen sichtbar?**

Anlass, Owner 2026-09-23 ~01:2x woertlich, als Nachtrag zur Zwei-Geraete-Idee: „Dies könnte meiner
Meinung nach auch die datenschichten eines Repo's sowie die von Aufgabe klarer machen, sauber
trennen und so dem user näher bringen und hoffentlich zu mehr innovationen führen. Wenn so darüber
nachdenke könnte dieses Prinzip überhaupt auch claude Fleet sehr stark helfen"

**Die Schichten sind nicht neu erfunden.** L0–L9 sind woertlich die zehn Schichten aus
`docs/program-ansicht-informationsschichten-2026-09-05.md` §1. Neu ist hier nur, sie gegen VIER
Achsen zu halten statt gegen eine, und jede Zelle gegen den heutigen Baum und die heutigen Ledger
nachzuzaehlen. Die Zahlen der Vorgaenger-Notizen (09-04, 09-22) werden zitiert, nicht neu erhoben;
wo diese Notiz sie nachgerechnet hat, steht es dabei.

## §0 · Das Urteil in fuenf Saetzen

1. **18 von 40 Zellen haengen sauber.** Die Achse, an der am wenigsten vermischt ist, ist die
   **Aufgabe** (6/10 sauber) — sie hat als einzige eine gebaute Join-Sicht (`laneDossier` hinter
   `GET /api/lane?task=`). Die duennste ist der **Host** (2/10).
2. **Die Host-Achse wird im gesamten Ledger-Korpus genau einmal geschrieben — und nur ueber die
   FREMDE Maschine.** Zensus ueber 9 Ledger und 10 677 Zeilen: ein einziger Ledger nennt einen
   Geraetenamen, `post-land-audits.jsonl`, in zwei Pfaden (`remote.name` 282/827,
   `shards[].name` 132/827). Kein Lane-Outcome, kein Deploy, keine Karte, kein Report-Ledger, keine
   Audit-Zeile sagt, auf welcher Maschine sie entstand: „hier" ist die Abwesenheit von „remote".
3. **Die Program-Achse ist nicht die Luecke, fuer die sie gehalten wird.** `programStatusView`
   (`server.ts`) joint heute schon L1, L2, L4, L5, L6 und L7 auf `GET /api/programs` — sechs
   Schichten, fuer jedes Program, bei jedem Poll. Ihre eine gemessene Macke ist eine
   REPO-Macke (§2, R5).
4. **Die Repo-Achse traegt ihre Schluessel und hat fast keine Sicht.** Audits 827/827, Lands
   1151/1227 (229/229 ab 15.09.), Kontext-Quittungen 1075/1075 tragen `repo` — sichtbar ist davon
   eine einzige Flaeche: die Stack-Gruppierung der Sessions (`src/client.ts`, `byRepo`).
5. **Erster Schnitt ist deshalb nicht `3d5ee33f`** (Program-Workbench), sondern der Repo-Schnitt in
   zwei Schritten (§4): der Repo-Split in der bestehenden Program-Lesung, dann ein Repo-Blatt.
   Beides ohne ein neues Feld, ohne eine Perimeter-Beruehrung, beides auf dieser Maschine.

---

## §1 · Die vier Achsen — wer sie ueberhaupt traegt

| Achse | Traeger heute | Form |
|---|---|---|
| **Host** | `FLEET_INSTANCE` → `server.ts#INSTANCE_NAME` (live `mac`) · `fleet.json#helperDevices` (2: `mainMacbook`, `second-host`) · `laneSuiteJobs[].claim.deviceId` (3/23) · `post-land-audits` `remote.name` / `shards[].name` | **Prozess- und Geraeteebene**, nie Zeilenebene |
| **Repo** | `Task.repo` (90/202 explizit, 112 null = `FLEET_DISPATCH_REPO`) · `outcome.repo` · `audit.repo` · `laneSuiteJobs.repo` · `Slot.worktree.repo` · git-Seite strukturell | **Zeilenebene**, breit vorhanden |
| **Program** | `Task.programId` (173/202) · `Slot.programId` · `outcome.programId` (200/229 ab 15.09.) · `report.provenance.programId` (138/148) · `attention.programId` (22/22) | **Zeilenebene**, vorhanden mit benannten Loechern |
| **Aufgabe** | `Task.id` ← `Slot.taskId` · `outcome.taskId` (221/229) · `card.taskId` (650/650) · `report.provenance.taskId` (148/148) · `context-receipt.taskId` | **Zeilenebene**, im heutigen Fenster am dichtesten |

Zwei Dinge, die diese Tabelle allein schon sagt:

- **Der Host ist keine Datenachse, sondern eine Prozessachse.** `STATE_FILE = ${import.meta.dir}/fleet.json`
  (`server.ts`): eine Zeile gehoert der Maschine, deren Datei sie enthaelt. `interface Task`
  (`server/types.ts`) hat `repo`, aber kein `host`, `instance`, `device` oder `machine` — gemessen
  0/202 Zeilen mit einem solchen Feld. Das ist derselbe Befund, den `3659ee3c` §2.2 fuer die Queue
  hielt; er gilt fuer JEDE Schicht, nicht nur fuer die Queue.
- **Das Program hat kein Repo-Feld** — 0/73 Programs tragen `repo` oder `repos`
  (`server/types.ts interface Program`, Schluessel-Union der Live-Datei nachgezaehlt). Das ist
  woertlich der Befund vom 2026-09-05 (§2 „Repo als Querschnitt"), 18 Tage spaeter unveraendert,
  jetzt mit einer Zahl fuer seine Kosten (R5 unten).

---

## §2 · Die Tabelle: Achse x Schicht

Lesart der Marker — **sauber** = die Schicht traegt die Achse als expliziten Schluessel (oder ist
strukturell an sie gebunden) und ein `null` ist definiert · **abgeleitet** = kein Schluessel, aber
ein im Code benannter Join traegt die Achse (mit gemessener Trefferquote) · **blind** = kein
Traeger; die Achse ist der Prozess, der die Zeile schrieb. *Abgeleitet und blind sind beide „nicht
sauber"; sie stehen getrennt, weil der Preis und der Fix verschieden sind: abgeleitet kostet
Genauigkeit, blind kostet ein Feld.* Jede nicht-saubere Zelle traegt einen Beleg `[H*/R*/P*/A*]`,
aufgeloest unter der Tabelle.

| Schicht (Quelle) | Host | Repo | Program | Aufgabe |
|---|---|---|---|---|
| **L0 Identitaet & Absicht**<br>`fleet.json#programs[]` | blind — die Liste ist die der laufenden Instanz `[H1]` | abgeleitet — kein Feld (0/73), aus `tasks`/`slots`/`outcomes` `[R1]` | **sauber** — die Achse selbst | **sauber** — `Task.programId` 173/202 |
| **L1 Steuerung**<br>`program.main`, `fleet.json#slots`, `server.ts#programHealth` | blind — ein Slot ist eine tmux-Pane dieser Maschine, ohne Feld `[H1]` | abgeleitet — `Slot.cwd` bzw. `worktree.repo`; ein Nicht-Lane-Slot hat nur `cwd` `[R2]` | **sauber** — `slot.programId` 6/15 belegte, `program.main` | **sauber** — `slot.taskId` 6/15 |
| **L2 Arbeit**<br>`fleet.json#tasks`, `tasks-archive.jsonl` | blind — `interface Task` hat kein Host-Feld, 0/202 `[H2]` | **sauber** — `Task.repo` 90/202, `null` = `FLEET_DISPATCH_REPO`; aber der Default ist host-relativ `[R3]` | **sauber** — 173/202 | **sauber** als Schluessel; die SCHICHT mischt sich mit L8: 56/108 nicht-terminale Zeilen sind `richtung`/`notiz` `[A1]` |
| **L3 Ausfuehrung**<br>`slots`, Worktrees, `laneSuiteJobs` | teils — `claim.deviceId` 3/23 ist der EINZIGE Arbeitssatz mit Maschinennamen; Worktrees selbst blind `[H3]` | **sauber** — `worktree.repo`, `laneSuiteJobs.repo` 23/23; das Board gruppiert danach (`src/client.ts`, `byRepo`) | **sauber** — `slot.programId`, `laneSuiteJobs.programId` 17/23 | **sauber** — `slot.taskId`; `laneSuiteJobs` traegt keine `taskId`, nur `slot`+`branch` `[A2]` |
| **L4 Integration**<br>`lane-outcomes.jsonl`, `merges`, `git notes --ref=fleet/land` | blind — 0/1227 `[H4]` | **sauber** — 1151/1227, ab 15.09. 229/229 | **sauber** im heutigen Fenster — 634/1227, ab 15.09. 200/229 `[P1]` | **sauber** im heutigen Fenster — 832/1227, ab 15.09. 221/229; die Land-Note nennt nur `branch`/`mainAfter` `[A3]` |
| **L5 Beweis**<br>`post-land-audits.jsonl` | **sauber, aber halb** — `remote.name` 282/827, `shards[].name` 132/827: nur die FREMDE Maschine `[H5]` | **sauber** — 827/827 | abgeleitet — 0/827; Join `server.ts#programsForAuditRow` ueber `repo+branch+mainAfter`, Bruecke `outcome.mainAfter` 209/229 `[P2]` | abgeleitet — 0/827, derselbe Zwei-Sprung `[P2]` |
| **L6 Auslieferung**<br>`deploys.jsonl`, `deployGap` | blind — 0/249 `[H4]` | blind/strukturell — 0/249; der Sensor misst nur `REPO_DIR` `[R4]` | abgeleitet — nur ueber `lastLand.repo == REPO_DIR`, sonst `null` `[R5]` | blind — 0/249 `[R4]` |
| **L7 Kommunikation**<br>`attentionRequests`, `fleetReports`, `fleet-reports.jsonl`, `events`, `watches` | im Speicher **sauber**, im Ledger blind — `provenance.instance` 148/148 live, `ledgerReportOpen` schreibt es nicht mit (0/775) `[H6]` | abgeleitet/teils — Report und Attention ohne Feld; `events.subjectRepo` 17/106, `watches.repo` 4/11 `[R6]` | gemischt — Attentions 22/22 und Reports 138/148 sauber, `events` 0/106 und `watches` 0/11 nur ueber den Empfaenger-SLOT `[P3]` | **sauber** — `provenance.taskId` 148/148 |
| **L8 Gedaechtnis**<br>`HANDOFF.md`, `docs/messungen/`, `decisions`/`evidence`, `contextPacks`, `cards.jsonl` | blind — kein Traeger | strukturell sauber (die Datei liegt im Repo), aber Notizen UEBER fremde Repos liegen hier `[R7]` | Prosa, kein Schluessel — 66/251 Notizen nennen ein Program nur im Text; `contextPacks` 1/73; 6 HANDOFF-Abschnitte nennen es im Titel `[P4]` | gemischt — `cards.jsonl` 650/650 `taskId`; Notizen tragen keine `taskId`, 45/251 stehen nicht im INDEX `[A4]` |
| **L9 Maschine & Kapazitaet**<br>`helperDevices`, Suite-Mutex, `laneSuiteJobs`, `deployGap` | **sauber** — `helperDevices` traegt `id`+`name`: die einzige Schicht, die die Achse als Feld fuehrt | vermischt — EIN Mutex je Maschine fuer ALLE Repos (`e2e-stage.sh`, `FLEET_SUITE_LOCK=/tmp/fleet-e2e.lock`) `[R8]` | teils — `laneSuiteJobs.programId` 17/23 | abgeleitet — `laneSuiteJobs` ohne `taskId` `[A2]` |

**Zaehlung je Achse (sauber / 10):** Host 2 · Repo 5 · Program 5 · Aufgabe 6.

### Die Belege

- **[H1]** `server.ts`: `STATE_FILE = ${import.meta.dir}/fleet.json`. Program und Slot existieren
  nur in der Datei der Instanz, die sie schrieb; die zweite Maschine fuehrt ihre eigenen
  (11 Tasks / 2 Programs am 2026-09-11, `39857582`, seither nicht nachgemessen).
- **[H2]** `server/types.ts interface Task`: Felder `id originId programId text source kind repo
  spawn variants… files…`. Kein `host`/`instance`/`device`/`machine`; live 0/202 Zeilen mit einem
  solchen Schluessel.
- **[H3]** `fleet.json#laneSuiteJobs`: 23 Auftraege, 3 mit `claim.deviceId` (`secondhostlinux1`).
  Die Arbeit laeuft drueben, die ZEILE, die sie ausloeste, weiss nichts davon.
- **[H4]** Zensus §6: ueber `lane-outcomes.jsonl` (1227), `deploys.jsonl` (249), `cards.jsonl`
  (650), `fleet-reports.jsonl` (775), `context-receipts.jsonl` (1075), `land-quality.jsonl` (642),
  `state-snapshots.jsonl` (487) und `audit.jsonl` (4745) faellt **kein einziger** bekannter
  Geraetename.
- **[H5]** `post-land-audits.jsonl`: `remote.name` in 282/827 Zeilen, `shards[].name` in 132/827
  (Beispiel `{"name":"second-host","claimedAt":…,"clonedSha":…,"jobId":…}`). Der lokale Lauf
  schreibt kein Gegenstueck — die Achse existiert genau dort, wo jemand sie gebraucht hat, und
  nur in der Richtung „nicht hier".
- **[H6]** `server.ts#ledgerReportOpen` schreibt acht Felder (`kind id taskId programId slot branch
  status basis text at`) — `provenance.instance` ist nicht darunter. Live tragen 148/148 Reports
  `instance: "mac"`; im Ledger 0/775. Die Host-Achse lebt so lange wie der Prozess.
- **[R1]** 0/73 Programs mit `repo`/`repos`. Die Ableitung ueber `tasks`/`slots`/`outcomes` ist
  moeglich (§4 unten nutzt sie), aber sie ist eine Heuristik, und `outcome.repo` fehlt in 76/1227
  Zeilen.
- **[R2]** `Slot` hat `cwd` und `worktree.repo` (`LaneRef`), aber kein eigenes `repo`. Fuer eine
  Lane ist die Achse eindeutig; fuer einen handgeoeffneten Slot ist sie ein Pfad-Praefix.
- **[R3]** `Task.repo = null` bedeutet „der Dispatcher-Default", und der ist host-relativ:
  `watchdog.sh:195` setzt `FLEET_DISPATCH_REPO='$FLEET_DIR'`, also den Checkout DIESER Maschine.
  112/202 Zeilen sind so. Dieselbe Zeile bedeutet auf der zweiten Maschine ein anderes
  Verzeichnis — der einzige Ort, an dem die Host-Achse heute in die Repo-Achse hineinragt.
- **[R4]** `deploys.jsonl` traegt `at bootHead bundleStale by head hitTarget id ms ok stage target` — kein
  `repo`. Der Deploy ist strukturell die eine Instanz dieses einen Checkouts; fuer die 18 anderen
  Repos, in denen Lanes gelandet sind, existiert die Schicht nicht.
- **[R5] Die Kollaps-Zelle, gemessen.** `server.ts#programStatusView` filtert `landed` allein nach
  `programId`, nimmt den NEUESTEN Land und setzt `deploy` nur, wenn dessen `repo` gleich `REPO_DIR`
  ist. Live:

  | Program | Lands je Repo | neuester Land | `deploy`-Zelle |
  |---|---|---|---|
  | `f170dc46` Fleet-Betrieb | claude-fleet 290 | claude-fleet | gefuellt |
  | `f9dc8e10` Leichtgewicht | claude-fleet 15 | claude-fleet | gefuellt |
  | `0d51b4d4` Oberflaeche | claude-fleet 11 | claude-fleet | gefuellt |
  | `9ce08219` Private-repo-j | private-repo-j 1 | private-repo-j | **null** |
  | `247a3746` Private-repo-aa | private-repo-aa 5 | private-repo-aa | **null** |
  | `98f3eef9` Jev | claude-fleet 2 · private-repo-ad 1 | private-repo-ad | **null** |

  `98f3eef9` ist der teure Fall: zwei seiner drei Lands liegen in diesem Repo und koennten
  deployt sein — die Zelle sagt `null`, und `null` ist von „noch nicht deployt" nicht
  unterscheidbar. 3 von 6 aktiven Programs stehen heute so da; 3/42 Programs mit Lands haben
  Lands in mehr als einem Repo.
- **[R6]** `fleet.json#events`: 17/106 mit `subjectRepo`; `watches`: 4/11 mit `repo`. Ein Report
  traegt das Repo nur implizit ueber `worker.cwd`.
- **[R7]** Die 5 Private-repo-aa-Lands liegen in `private-repo-aa`, die Notizen dazu hier. Strukturell
  haengt L8 am Repo, inhaltlich nicht.
- **[R8]** `e2e-stage.sh`: `FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"` — ein
  Pfad je Maschine. Die 726 claude-fleet-Audits und die 101 Audits der anderen Repos haben sich
  ueber denselben Mutex serialisiert.
- **[P1]** `outcome.programId` 634/1227 gesamt, 200/229 ab 15.09. Der historische Teil ist
  duenn und bleibt es (Retention, `docs/messungen/2026-09-22-system15-datenschichten.md` §3).
- **[P2]** `server.ts#programsForAuditRow` joint `repo + branch + mainAfter` und ist ehrlich („A
  cover with no matching landed row stays PROGRAMLESS"). Die Bruecke ist `outcome.mainAfter`:
  904/1227 gesamt, 209/229 ab 15.09. — im heutigen Fenster faellt also rund jeder elfte Land aus
  der Program-Zuordnung eines Audits heraus, ohne dass die Sicht es beziffert.
- **[P3]** `events` 0/106 und `watches` 0/11 mit `programId`; ihr einziger Weg zum Program ist der
  Empfaenger-Slot, und Slot-Nummern werden recycelt (`…-system15-datenschichten.md` §3: DS-J6
  93,64 % Nummern-Aufloesung, DS-J7 1,37 % Occupant-Bindung).
- **[P4]** 66/251 Notizen unter `docs/messungen/` nennen eine Program-Id im TEXT; keine traegt sie
  als Feld. `contextPacks` hat 1/73 Programs (`context-plan.ts#ProgramContextPack` =
  `{id, useWhen, sources}` — keine Tags, kein Attribut).
- **[A1]** 108/202 Zeilen sind nicht-terminal, 56 davon `richtung`/`notiz` im Status `pending`:
  beratende Zeilen ohne Motor in der ausfuehrbaren Liste. Das ist B4 aus dem Audit vom 2026-09-04
  („die Queue ist das Befundregister geworden"), heute nachgezaehlt.
- **[A2]** `laneSuiteJobs`-Schluessel: `branch claim claimWas commitSha cwd endedAt id offeredAt
  programId repo result slot slotOpenedAt state treeSha untracked` — keine `taskId`.
- **[A3]** Eine Land-Note (`git notes --ref=fleet/land`) traegt `branch mainBefore mainAfter verify
  hubPush confirmedByHuman actor at` — weder `taskId` noch `programId` noch `repo` (das Repo ist
  strukturell das, in dem die Note liegt).
- **[A4]** 251 Notizen, 207 INDEX-Zeilen, 45 Notizen nicht im INDEX genannt. Die Skill-Regel
  (`.claude/skills/mess-notiz`) verlangt genau eine Zeile je Notiz; nichts prueft sie.

---

## §3 · Was der Owner heute NICHT sieht — und welche EINE Sicht das meiste zeigt

**Was heute eine Flaeche hat** (aus `src/client.ts` und den Routen gelesen, nicht aus einem Frame):

| Sicht | Achse | Schichten |
|---|---|---|
| `GET /api/programs` → `programStatusView` | Program | L1 (`main`+health), L2 (`lanes running/queued/waiting`), L4 (`lastLand`), L5 (`lastAudit`+Adjudikation), L6 (`deploy.codeBehind`), L7 (`attention.open`, `inbox`) |
| Session-Liste, Stack-Gruppierung (`byRepo`) | Repo | L3 |
| `GET /api/lane?task=`/`?branch=` → `laneDossier` (CLI `./ctl.sh task`) | Aufgabe/Lane | L3, L4, L5 |
| Geraetekarte (`deviceCard`) | Host | L9, nur die Helfer-Rolle |
| Queue-Liste, Karten-Detail | Aufgabe | L2, L8-Teil (`card`) |

**Die unsichtbaren Zellen, sortiert danach, ob sie heute ueberhaupt zeigbar sind:**

1. **Zeigbar, Schluessel vorhanden, keine Sicht (Repo-Achse):** „welche Queue-Zeilen zielen auf
   Repo X" (L2, Schluessel 90/202 + Default-Regel) · „was ist in Repo X gelandet" (L4, 1151/1227) ·
   „welches Audit ist in Repo X rot" (L5, 827/827) · „gibt es fuer Repo X ueberhaupt einen
   Deploy-Sensor" (L6, strukturell nein, heute als leere Zelle statt als Antwort). **Vier Zellen.**
2. **Zeigbar, Schluessel vorhanden, falsch dargestellt (Program x Repo):** der Kollaps aus [R5] —
   eine Zelle, die heute nicht fehlt, sondern irrefuehrt.
3. **Nicht zeigbar ohne neues Feld (Host-Achse):** acht der zehn Schichten der zweiten Instanz.
   `3659ee3c` hat gemessen, dass keine Sicht sie erreicht: fremder Origin → HTTP 403
   `cross-origin request blocked`, Cookie `SameSite=Strict`. Sie brauchen erst den Herzschlag
   (dessen K1), und kommen dann als aggregierte Gesundheit, nicht als Schichten.
4. **Nicht durch eine Sicht loesbar (L8):** Gedaechtnis haengt an keiner Achse als Schluessel. Das
   ist kein Sicht-Problem, sondern ein fehlender Traeger (§4, Punkt 3).

**Die eine Sicht: ein Repo-Blatt.** Es zeigt die vier Zellen aus Punkt 1, macht Punkt 2
darstellbar, braucht **kein neues Feld**, keine Perimeter-Aenderung und liest nur Ledger, die es
schon gibt. Die Host-Achse hat zwar mehr unsichtbare Zellen (acht), aber sie sind fuer JEDE
einzelne Sicht unerreichbar, solange die zweite Instanz nichts von sich meldet — das ist die
Aussage von `3659ee3c`, nicht eine Konkurrenz zu dieser.

**Ein ehrlicher Daempfer:** die Repo-Achse ist schief besetzt. 995 der 1151 Lane-Outcomes mit Repo-Feld (86 %)
liegen in `claude-fleet`, der Rest verteilt sich auf 18 Repos mit 1 bis 36 Zeilen. Ein Repo-Blatt
zeigt also ein grosses Blatt und 18 kleine. Sein Wert liegt nicht in der Symmetrie, sondern darin,
dass die kleinen Repos heute GAR KEINE Flaeche haben: ein rotes Audit in `private-repo-aa` steht in
derselben undifferenzierten Audit-Liste wie eines hier.

---

## §4 · Der erste Schnitt — und wie `3d5ee33f`, `6ec7ab69` und `3659ee3c` sich einfuegen

**Urteil: `3d5ee33f` ist die richtige FORM, aber nicht der erste SCHNITT.**

Die Richtung `3d5ee33f` beschreibt eine Workbench je Program, „auf der der Owner/User dynamisch die
Daten dann auf versch Art&Weise aggregieren kann". Drei gemessene Gruende, sie nicht zuerst zu
bauen:

1. **Ihre Achse ist die, die ihre Lesung schon hat.** `programStatusView` joint sechs Schichten je
   Program bei jedem Poll (§3). Die Vorarbeit vom 2026-09-05 beschrieb diese Sicht als fehlend —
   sie ist seither gebaut. Eine freie Aggregation obendrauf waere die zweite Schicht ueber einer
   ersten, die es gibt.
2. **Sie wuerde zuerst ueber die eine Macke aggregieren, die diese Lesung hat.** Der Repo-Kollaps
   [R5] trifft 3 von 6 aktiven Programs; eine Workbench, die „Lands je Program" frei gruppieren
   laesst, wuerde ihn multiplizieren statt ihn zu zeigen.
3. **Die Owner-Zeile nennt Repo und Aufgabe, nicht Program.** Woertlich: „die datenschichten eines
   Repo's sowie die von Aufgabe klarer machen, sauber trennen". Die Aufgaben-Achse ist die
   sauberste (6/10) und hat ihre Join-Sicht; bleibt das Repo.

**Also, in dieser Reihenfolge:**

- **(a) Der Repo-Split in der bestehenden Program-Lesung.** Klein, korrigiert eine Zelle, die heute
  nicht fehlt, sondern falsch aussieht. Karte K1.
- **(b) Das Repo-Blatt.** Die Sicht aus §3, alle Schluessel vorhanden. Karte K2.
- **(c) Dann `3d5ee33f`.** Sobald (a) und (b) stehen, ist die Workbench genau das, was sie sein
  soll: eine UI ueber drei vorhandene Lesungen, ohne neuen Zustand — und die „Aggregation nach
  Achse", die der Owner beschreibt, hat dann getrennte Achsen, ueber die sie aggregieren kann.

**`6ec7ab69` (Packs ueber Attribute) ist kein Konkurrent, sondern die Antwort auf die EINE Zeile
der Tabelle, in der keine Achse einen Schluessel hat: L8.** Ein Attribut ist genau der Traeger, den
eine Schicht braucht, die an keiner Achse haengt — 66/251 Notizen nennen ein Program nur im Text,
45/251 stehen nicht im Index, kein Dokument traegt eine `taskId`. Zwei Praezisierungen aus dieser
Messung: (1) der erste Datenbestand fuer ein Attribut-Schema sind nicht die Packs (1 von 73
Programs hat ueberhaupt welche), sondern der Notiz-Korpus und `cards.jsonl`; (2) `ProgramContextPack`
ist heute `{id, useWhen, sources}` — ein Attribut-Feld ist additiv moeglich, ohne die
Program-Bindung (die Zustaendigkeit) anzutasten, genau wie die Lesart der Richtung es sagt.

**`3659ee3c` (Host-Achse) behaelt seine Reihenfolge und kollidiert mit (a)/(b) nicht** — andere
Achse, andere Flaeche (`setHelperDevice`/`helperDevicesView` gegen `programStatusView` und eine
neue Repo-Route). Diese Messung liefert ihm ein zusaetzliches Argument: die Host-Achse ist
maschinell bereits einmal geschrieben worden, als jemand sie brauchte (`remote.name` 282/827,
`shards[].name` 132/827) — der Herzschlag-Vorschlag erfindet keine Achse, er schreibt die
vorhandene in die andere Richtung.

---

## §5 · Kartenentwuerfe (die MAIN filet, nicht diese Lane)

Vier Zeilen in Reihenfolge. **Die Schnittlinie liegt nach K2:** K1+K2 erfuellen die Owner-Zeile
(„die datenschichten eines Repo's … klarer machen, sauber trennen"). K3 und K4 sind Vorbereitung
fuer `6ec7ab69` bzw. fuer die Karten-Pruefung und koennen entfallen, ohne K1/K2 unvollstaendig zu
machen.

### K1 — Die Program-Lesung splittet ihre Lands nach Repo

```
[DATENSCHICHTEN · AUFTRAG · DIE PROGRAM-LESUNG SPLITTET NACH REPO, STATT ZU KOLLABIEREN]
ROLLE: pi-zai/glm-5.3-flash
GROESSE: klein
FLAECHE: server.ts#programStatusView · src/client.ts#renderProgramDetail · e2e/programs.ts
VERIFY: install, pins, tsc, build, ./e2e-isolated.sh
DONE: programStatusView liefert lastLand je Repo des Programs statt EINEN neuesten ueber alle
  Repos, und die deploy-Zelle nennt fuer ein Repo ohne Sensor den GRUND ("kein Deploy-Sensor
  fuer dieses Repo") statt null; das Program-Detail zeigt beides. Ein Check in e2e/programs.ts
  faellt, wenn ein Program mit Lands in zwei Repos auf eine Zeile kollabiert (Mutation: den
  Repo-Schluessel aus der Gruppierung nehmen -> rot). Beleg im Commit-Body: 98f3eef9 (2 Lands
  claude-fleet, 1 private-repo-ad) zeigt vorher deploy null, nachher zwei Zeilen.
VERBOTEN: eine neue Route · ein repo/repos-Feld am Program schreiben (offene Frage 1 des
  Inventars 2026-09-05, Owner-Entscheid) · Ledger in den Poll ziehen (D2-Doktrin) · die
  Audit-Zuordnung anfassen (programsForAuditRow bleibt, wie sie ist)
```

### K2 — Das Repo-Blatt: eine Lesung je Repo

```
[DATENSCHICHTEN · AUFTRAG · EIN REPO-BLATT — DIE VIER SCHICHTEN, DIE IHREN SCHLUESSEL HABEN UND KEINE SICHT]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts (neue Owner-Route GET /api/repos/:canon/view) · src/client.ts (ein Panel) ·
  e2e/ (neue Checks in der passenden Familie, kein neues Top-Level-Verzeichnis)
VERIFY: install, pins, tsc, build, ./e2e-isolated.sh
DONE: die Route liefert je kanonischem Repo, Ledger AUF ABRUF (nicht im Poll): offene Lanes (L3,
  aus slots), Queue-Zeilen die auf dieses Repo zielen inkl. der null-Zeilen ueber
  FLEET_DISPATCH_REPO (L2), die letzten N Lands mit verified/branch (L4), das juengste Audit mit
  result + Adjudikation (L5), Deploy NUR fuer REPO_DIR und sonst ausdruecklich "kein Sensor" (L6),
  dazu der Lane-Deckel aus repoLaneCaps. Jede Schicht nennt im JSON ihre Quelle. Je Schicht ein
  Check; Mutation: eine Schicht weglassen -> rot. Das Panel rendert die Route, es rechnet nichts.
VERBOTEN: ein neues Feld auf irgendeiner Zeile · jede Schreiboperation · den 2-s-Poll um Ledger
  erweitern · ein zweites Board (das Panel gehoert in die bestehende Flaeche)
```

--- Schnittlinie: K1+K2 erfuellen die Owner-Zeile. Alles darunter ist Vorbereitung. ---

### K3 — Das Gedaechtnis bekommt einen mechanischen Schluessel

```
[DATENSCHICHTEN · AUFTRAG · KEINE NOTIZ OHNE INDEX-ZEILE]
ROLLE: pi-zai/glm-5.3-flash
GROESSE: klein
FLAECHE: e2e/pins.ts · docs/messungen/INDEX.md
VERIFY: install, pins
DONE: ein Pin faellt, wenn eine getrackte Datei unter docs/messungen/*.md (ausser INDEX.md) in
  INDEX.md nicht namentlich vorkommt; die heute fehlenden 45 Zeilen sind nachgetragen, jede mit
  dem urteil-Feld aus dem Front-Matter der Notiz woertlich. Der Pin nennt in seiner Fail-Zeile
  die fehlenden Dateinamen.
VERBOTEN: den Index generieren (die Skill-Regel sagt: fortgeschrieben, nie erzeugt) · Notizen
  umschreiben · Notizen ohne Front-Matter nachruesten (das ist eine eigene Zeile)
```

### K4 — Die Karte traegt ihr Program

```
[DATENSCHICHTEN · AUFTRAG · cards.jsonl TRAEGT programId NEBEN taskId]
ROLLE: pi-zai/glm-5.3-flash
GROESSE: klein
FLAECHE: server.ts (die Schreibstelle von cards.jsonl im Karten-Sweep) · e2e/
VERIFY: install, pins, tsc, build, ./e2e-isolated.sh
DONE: eine NEUE Kartenzeile traegt programId, wenn die Task-Zeile eines hat, und nichts, wenn
  nicht; alte Zeilen bleiben unveraendert (kein Backfill). Ein Check belegt, dass die Pruefung
  "Karte gegen Program" (Richtung 6ec7ab69) damit ein Sprung statt zwei ist — heute
  card.taskId -> task -> programId, und 66,99 % der historischen Outcome-taskIds finden ihre
  Task nicht mehr (2026-09-22-system15-datenschichten.md §4, DS-W2).
VERBOTEN: alte Zeilen backfillen · ein Urteil/Gate bauen (6ec7ab69: Datenschicht zuerst, kein
  Gate, bis die Fehlrate gemessen ist)
```

---

## §6 · Methode

Alle Zahlen stammen aus EINEM Lauf, Stand 2026-09-23 02:03 Europe/Berlin, read-only im
Haupt-Checkout. Zwei Konventionen, ohne die die Zahlen anders aussehen:

- **`repo: null` wird als `FLEET_DISPATCH_REPO` gelesen**, nicht als „unbekannt" — `watchdog.sh:195`
  startet den Server mit `FLEET_DISPATCH_REPO='$FLEET_DIR'`, und `server.ts` loest ueberall
  `t.repo ?? DISPATCH_REPO` auf.
- **Worktree-Pfade werden auf ihr Eltern-Repo kanonisiert** (`…/x.worktrees/y` → `…/x`), sonst
  zaehlt jede Lane als eigenes Repo.

```python
#!/usr/bin/env python3
# Achsen-Zensus. Liest nur; im Haupt-Checkout laufen lassen.
import json, os, collections, datetime
D, NAMES = "/Users/owner/claude-fleet", {"second-host","secondhostlinux1","mainMacbook","mac"}
LEDGERS = ["lane-outcomes.jsonl","post-land-audits.jsonl","deploys.jsonl","cards.jsonl",
           "fleet-reports.jsonl","context-receipts.jsonl","land-quality.jsonl",
           "state-snapshots.jsonl","audit.jsonl"]
def rows(p):
    out = []
    for l in open(os.path.join(D, p)):
        l = l.strip()
        if l:
            try: out.append(json.loads(l))
            except Exception: pass
    return out
def canon(p): return (p.split(".worktrees/")[0] if ".worktrees/" in p else p) if p else D
def walk(o, path=""):                      # sucht WERTE, nicht Feldnamen — siehe Trail-Zeile 2
    if isinstance(o, dict):
        for k, v in o.items(): yield from walk(v, path + "." + k)
    elif isinstance(o, list):
        for v in o: yield from walk(v, path + "[]")
    elif isinstance(o, str) and o in NAMES: yield path
for f in LEDGERS:                          # §0.2, [H4], [H5]
    rs, hit = rows(f), collections.Counter()
    for r in rs:
        for p in set(walk(r)): hit[p] += 1
    print(f"{f:26s} {len(rs):5d}  {dict(hit) or 'KEINE'}")
CUT = datetime.datetime(2026,9,15,tzinfo=datetime.timezone(datetime.timedelta(hours=2))).timestamp()*1000
def ts(r):                                  # Fenstergrenze wie in der 09-22-Notiz
    for k in ("ts","at","startedAt","reportedAt"):
        if isinstance(r.get(k), (int,float)): return r[k]
    return 0
for f, keys in [("lane-outcomes.jsonl",["repo","programId","taskId","mainAfter"]),
                ("post-land-audits.jsonl",["repo","programId","taskId"]),
                ("deploys.jsonl",["repo","programId","taskId"]),
                ("cards.jsonl",["repo","programId","taskId"]),
                ("fleet-reports.jsonl",["repo","programId","taskId","slot"]),
                ("context-receipts.jsonl",["repo","programId","taskId","slot"])]:
    rs = rows(f); rec = [r for r in rs if ts(r) >= CUT]
    print(f, " ".join(f"{k}={sum(1 for r in rs if r.get(k) not in (None,''))}/{len(rs)}"
        f"({sum(1 for r in rec if r.get(k) not in (None,''))}/{len(rec)})" for k in keys))
st = json.load(open(os.path.join(D, "fleet.json")))   # §1, [H2], [R1], [A1], [P4]
out = rows("lane-outcomes.jsonl")
for p in [x for x in st["programs"] if x.get("status") == "active"]:   # [R5]
    landed = [o for o in out if o.get("programId") == p["id"] and o.get("disposition") == "landed"]
    if not landed: continue
    newest = max(landed, key=lambda o: o.get("ts") or 0)
    print(p["id"][:8], collections.Counter(os.path.basename(canon(o.get("repo"))) for o in landed),
          "newest:", os.path.basename(canon(newest.get("repo"))),
          "deploy:", "gefuellt" if canon(newest.get("repo")) == D else "null")
```

Die uebrigen Belege sind Datei-Lesungen ohne Skript:
`rg -n "interface Task" -A 40 server/types.ts` · `rg -n "function programStatusView" -A 60 server.ts` ·
`rg -n "function ledgerReportOpen" -A 6 server.ts` · `rg -n "function programsForAuditRow" -A 20 server.ts` ·
`rg -n "byRepo" -B 12 src/client.ts` · `rg -n "FLEET_SUITE_LOCK" e2e-stage.sh` ·
`rg -n "FLEET_DISPATCH_REPO" watchdog.sh` · `git notes --ref=fleet/land show <sha>`.

---

## §7 · Was nicht gemessen wurde

- **Alles auf der zweiten Maschine.** Kein `ssh`, kein Login auf deren Board. Die Host-Spalte ist
  von DIESER Instanz aus vermessen; was der Second-host ueber sich selbst weiss, steht hier nicht.
- **`tasks-archive.jsonl` (655 Zeilen) als Join-Ziel.** Die Waisenquote der historischen
  Outcome-`taskId`s ist aus `…-system15-datenschichten.md` §4 (DS-W2, 66,99 %) zitiert, nicht neu
  gerechnet.
- **`audit.jsonl` (4 745 Zeilen) als Achsentraeger.** Nur auf Geraetenamen geprueft (keiner), nicht
  auf `repo`/`programId` je Ereignisart.
- **Die Trefferquote des Zwei-Sprung-Joins je Program.** Gemessen ist nur die Bruecke
  (`outcome.mainAfter` 209/229 ab 15.09.), nicht, wie viele Audits je aktivem Program dadurch
  ihr Program verfehlen.
- **Jede Laufzeit- und Byte-Kosten-Schaetzung** fuer K1/K2. Die Karten nennen keine Zahl, weil hier
  keine gemessen wurde.
- **Gerenderte Flaechen.** Was das Board zeigt, ist aus `src/client.ts` und den Routen gelesen,
  nicht aus einem geoeffneten Board.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-23T00:05:00Z	vokabular	Schichten L0-L9 aus dem 09-05-Inventar uebernommen statt eigene zu bilden	die Auftragszeile verbietet ein neues Inventar, wo eines existiert	docs/program-ansicht-informationsschichten-2026-09-05.md §1	10 Zeilen, 4 Spalten
2026-09-23T00:40:00Z	zensus	Host-Suche ueber WERTE bekannter Geraetenamen auf allen Ebenen statt ueber Top-Level-Feldnamen	der erste Lauf nach host/instance/device haette audit.remote.name uebersehen	achsen-final.py §1	1 von 9 Ledgern nennt eine Maschine, in 2 Pfaden
2026-09-23T01:05:00Z	konvention	repo:null als FLEET_DISPATCH_REPO gezaehlt, nicht als unbekannt	watchdog.sh startet den Server mit dem Checkout als Default	watchdog.sh:195	112 von 202 Zeilen zaehlen zu claude-fleet
2026-09-23T01:10:00Z	konvention	Worktree-Pfade auf ihr Eltern-Repo kanonisiert	sonst waere jede Lane ein eigenes Repo	achsen-final.py#canon	19 Repos in den Outcomes
2026-09-23T01:35:00Z	urteil	Urteil erst nach dem Lesen von programStatusView gefaellt	der Entwurf davor haette die Program-Lesung als fehlend beschrieben — sie joint sechs Schichten	server.ts#programStatusView	Urteil gedreht: nicht 3d5ee33f zuerst
2026-09-23T01:50:00Z	schnitt	Rangliste nach K2 abgeschnitten	die Owner-Zeile nennt Repo und Aufgabe; K3/K4 sind Vorbereitung	docs/scope-inflation.md §7	2 Karten ueber, 2 unter der Linie
2026-09-23T02:03:00Z	messung	alle zitierten Zahlen aus EINEM Lauf gezogen	zwei Laeufe haetten zwei Staende gemischt (1226 vs 1227 Outcomes zwischen zwei Proben)	achsen-final.py	ein Stand, 02:03
```

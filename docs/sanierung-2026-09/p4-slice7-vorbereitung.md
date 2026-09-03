# P4 Slice 7 — die Post-Land-Audit-QUEUE, vermessen am Baum `1552bec` (server.ts 23760 Z.)

Der Plan (`plan-2026-08-31.md`, P4 Punkt 3) führt als letzten offenen Tier-1-Posten
„audit-queue". `p4-slice4-vorbereitung.md` sagte ausdrücklich, dass **nicht entscheidbar** sei,
ob damit das Audit-LOG (erledigt als Slice 4, `server/audit-log.ts`) oder die
Post-Land-Audit-QUEUE gemeint war. Diese Notiz vermisst die QUEUE — und beantwortet die Frage
nicht durch Auslegung, sondern durch die Zahl: das Log ist weg, die Queue steht noch im Kern.

**Alle Zeilennummern zeigen auf `1552bec`.** Wer auf einem jüngeren Baum liest, sucht die
Symbole, nicht die Zeilen.

## 1. Der Schnitt-Kandidat: fünf zusammenhängende Bereiche, 530 Zeilen

| Bereich | Inhalt (Leitsymbole) | Z. |
| --- | --- | ---: |
| 11760–11800 | `POSTLAND_AUDIT_CMD`, `auditCmdFor`, `auditConfiguredAnywhere`, `POSTLAND_AUDIT_TIMEOUT_MS`/`_OUT_CAP`/`_KILL_GRACE_MS`, `AuditCover`, `coverKey` | 41 |
| 11840–11866 | `auditQueue`, `auditDraining`, `RunningAudit`, `runningPostLandAudit`, `auditRunningRepo`, `auditGraceTimer` | 27 |
| 12269–12456 | `auditDurations`, `auditCounts`, `recordAuditDuration`, `auditStats`, `savePostLandAuditQueue`, `schedulePostLandAudit`, `drainPostLandAudits` | 188 |
| 12457–12710 | `snapshotIntegrationTree`, `auditChildEnv`, `postLandAuditChecks`, `runPostLandAudit`, `postLandAuditSummary`, `postLandAuditLiveView` | 254 |
| 12863–12882 | `kickAuditDrain`, `armAuditGraceKick` | 20 |
| | **Summe** | **530** |

Deckel des Slice-Protokolls: ~2.000 bewegte Zeilen. Der Kandidat liegt bei einem Viertel davon.
Zum Vergleich: Slice 4 bewegte −186, Slice 5+6 −92. **Dieser wäre der größte P4-Schnitt bisher**
— und der einzige verbliebene Tier-1-Posten.

Ein großer Teil der 530 Zeilen ist NARRATIV, nicht Code (der Block trägt die Begründung, warum
Tier 2 default-off ist, warum `coverKey` drei Felder hat, warum `result` dreiwertig ist). Für
Erfolgsmaß 2 ist das ein Kandidat für die Exkavation nach `server-narrativ-archiv.md` im selben
Paket — aber als eigener Schritt, nicht vermischt mit dem Move.

## 2. Der eine ESM-Blocker — und die Gegenprobe, die zeigt, dass die Sonde feuern kann

Vier Bindungen des Bereichs sind `let` auf Modulebene. Die Frage ist nicht, ob sie `let` sind,
sondern ob der **Kern sie beschreibt** — eine importierte ESM-Bindung ist read-only, und ein
solcher Move ist ein Laufzeit-`TypeError`, den `tsc` nicht sieht (dieselbe Klasse wie `let TOKEN`
in Slice 5+6, dort erst vom Compiler gefunden).

| Bindung | Referenzen außerhalb | davon ZUWEISUNGEN |
| --- | ---: | --- |
| `auditDraining` | 4 | **1 — `server.ts:18936`, `auditDraining = true;` im Boot-Resume** |
| `runningPostLandAudit` | 7 | 0 |
| `auditRunningRepo` | 4 | 0 |
| `auditGraceTimer` | 0 | 0 |

Die drei Nullen sind **gemessen, nicht geraten**: dieselbe Sonde findet die Zuweisung bei
`:18936`, sie kann also feuern. Die Leere der anderen drei ist damit ein Befund.

**Folge für den Brief:** der Boot-Resume-Block muss die Bindung über eine exportierte Funktion
setzen (z. B. `markAuditDraining()`), oder der Resume wandert mit ins Modul. Zweiteres ist
sauberer und ist die Empfehlung — der Block bei `:18930-18940` gehört inhaltlich zur Queue.

## 3. Was der Kern zurückimportieren müsste (14 Symbole, ~34 Stellen)

`auditCmdFor` (6) · `AuditCover` (8) · `auditQueue` (6) · `coverKey` (2) · `auditCounts` (2) ·
`recordAuditDuration` (2) · `savePostLandAuditQueue` (1) · `schedulePostLandAudit` (1) ·
`drainPostLandAudits` (1) · `postLandAuditChecks` (2) · `postLandAuditSummary` (1) ·
`postLandAuditLiveView` (1) · `kickAuditDrain` (2) · `AUDIT_HELPER_GRACE_MS` (1).

Das ist die gleiche Größenordnung wie `server/auth.ts` (zwölf Symbole) und deutlich unter dem,
was `server/types.ts` trägt.

## 4. Die eine echte Kopplung nach außen — und sie ist kleiner als befürchtet

Der Bereich liegt MITTEN im Helfer-Portal (Claims, Devices, Bundles, LaneSuiteJobs,
CommandJobs — Tier 3 nach Plan), und die Übergabe der Slot-9-Session nannte das als Grund,
die Queue für „deutlich größer" zu halten. **Gemessen ist die Kopplung zwei Aufrufstellen**,
beide in `drainPostLandAudits`:

- `helperClaimCandidateExists()` — `server.ts:12371`
- `helperClaimOf(r)` — `server.ts:12375`

Alle übrigen Treffer auf `helper*` in den fünf Bereichen sind Prosa in Kommentaren. Zwei
Aufrufstellen sind ein Import, keine Verflechtung. **Die Reihenfolge Queue-vor-Portal ist damit
möglich** — das Modul importiert zwei Funktionen aus dem Kern, wie jedes andere Blattmodul auch.

## 5. Was diese Messung NICHT geprüft hat

- **Kein Compiler-Lauf.** Slice 5+6 hat gezeigt, dass erst `tsc` den blockierenden Fall zeigt;
  die Sonde oben ist eine Textsonde. Der Brief muss den Probe-Move + `tsc` als ERSTEN Schritt
  der Lane verlangen, vor jedem Commit.
- **Die Aufteilung Move vs. Exkavation.** Die 530 Zeilen enthalten Narrativ; wie viel davon ins
  Archivdokument geht, ist nicht vermessen.
- **Neun Namen wären Importe INS Modul:** `mintAuditEvents`, `lastPostLandAudit`,
  `reportServerRun`, `retainRunOutput`, `killProcessTree`, `descendantPids`, `workerCmdFor`,
  `repoWorkers`, `VERIFY_SKIP_EXIT`. Gezählt, nicht auf Verträglichkeit geprüft.
- **Verstreute Audit-Symbole, die NICHT im Kandidaten liegen** und die der Slice bewusst stehen
  lässt oder bewusst mitnimmt — die Entscheidung ist offen: `newestAuditFor` (`server.ts:5453`,
  liest das Ledger, wird von einer Route und von `tickWatches` benutzt), der Audit-Ping-Tick
  (`auditPings`, `auditPingMessage`, ~`server.ts:9884-10017`, eigener Zweck: Zustellung an eine
  Session) und `POSTLAND_AUDIT_FILE`/`_QUEUE_FILE`/`AUDIT_ADJUDICATION_FILE` im Pfad-Nest ganz
  oben. Wer sie mitnimmt, sprengt die 530 Zeilen; wer sie stehen lässt, hat zwei Orte.
- **Die Suiten.** `./e2e-postland-audit.sh` ist die einzige Suite, die auf diesem Pfad etwas
  beweist, und kein Gate fährt sie. Sie gehört ausgeschrieben in den Brief, zusätzlich zur
  `./e2e-isolated.sh`-Vorschau.

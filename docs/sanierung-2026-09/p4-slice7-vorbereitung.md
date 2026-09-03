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

---

## 6. NACHTRAG, gemessen 2026-09-03 nach dem Deploy — §1–§4 beschreiben einen Schnitt, den die Modul-Invariante dieses Repos NICHT zulässt

**Die Invariante, die ich beim ersten Schreiben nicht geprüft habe:** jedes bestehende Modul
unter `server/` ist ein BLATT. `server/auth.ts` importiert `node:crypto`, `./audit-log`,
`./http`, `./types`; `server/audit-log.ts` importiert `node:path` und `./persist`;
`server/transport.ts` importiert `node:fs`, `node:path`, `bun`, `./types`. **Keines importiert
aus `server.ts`.** Der Kern importiert die Module, nie umgekehrt — und `server/audit-log.ts`
zeigt auch, wohin ein Pfad-Konstante gehört: `AUDIT_FILE` liegt IM Modul, der Kern importiert
sie von dort.

§3 oben zählt 14 Rückimporte in den Kern — das ist die richtige Richtung und unproblematisch.
§5 zählt neun Namen als „Importe INS Modul" und nennt sie ungeprüft. **Geprüft sind sie jetzt,
und sie sind der eigentliche Befund: sie brechen die Blatt-Invariante.**

### Was je Einheit wirklich am Kern hängt

| Einheit | Kern-Abhängigkeiten |
| --- | --- |
| `state 11840-11866` (`auditQueue`, `auditDraining`, `runningPostLandAudit`, …) | **keine — Blatt** |
| `schedulePostLandAudit` | **keine — Blatt** |
| `snapshotIntegrationTree` | **keine — Blatt** |
| `auditChildEnv` | **keine — Blatt** |
| `postLandAuditLiveView` | **keine — Blatt** |
| `kickAuditDrain` + `armAuditGraceKick` | **keine — Blatt** |
| `savePostLandAuditQueue` | `POSTLAND_AUDIT_QUEUE_FILE` — Pfad, zieht nach dem `AUDIT_FILE`-Muster MIT ins Modul |
| `durations` (12269–12323) | `PostLandAuditRow` — Typ, steht bei `:11803` und zieht mit |
| `postLandAuditChecks` | `PostLandAuditChecks` — Typ, `:11802`, zieht mit |
| `postLandAuditSummary` | `lastPostLandAudit` — `:11836`, zieht mit |
| `consts+types 11760-11800` | **`repoWorkers`, `workerCmdFor`** (Repo-Worker-Registry im Kern) |
| **`drainPostLandAudits`** | **`helperClaimCandidateExists`, `helperClaimOf`** (Helfer-Portal, Tier 3) **, `reportServerRun`** |
| **`runPostLandAudit`** | **`mintAuditEvents`** (`:5471`, Event-System), **`retainRunOutput`** (`:10874`), **`descendantPids`** (`:11114`), **`killProcessTree`** (`:11138`), **`VERIFY_SKIP_EXIT`** (`:10912`) |

Die Typen und `lastPostLandAudit` sind also GRATIS — sie stehen ohnehin im Bereich. Übrig
bleiben **sieben echte Kern-Bindungen**, und sie verteilen sich auf zwei Funktionen: den Drain
und den Runner. Genau die beiden sind das Herz des Slice.

### Was daraus folgt

**Slice 7 als „Move der Audit-Queue" ist kein reiner Move.** Er hat drei Formen, und die Wahl
ist eine Entscheidung, keine Messung:

1. **Injektion** — Drain und Runner nehmen ihre sieben Bindungen als Parameter. Verhaltenserhaltend,
   aber KEIN Move: die Signaturen ändern sich, und `c.` des Slice-Protokolls („Verhaltens-Delta?")
   bekommt echte Arbeit. Bricht mit dem Muster aller sechs bisherigen Slices.
2. **Vorher die Abhängigkeiten schneiden** — erst die Blätter, dann die Queue.
3. **Nur die Blätter nehmen** und Drain + Runner im Kern lassen. Ehrlich, aber es bewegt
   vielleicht 200 der 530 Zeilen und lässt die zwei größten Funktionen stehen.

**Empfehlung: (2), und der erste Schnitt ist ein eigener, vollständig vermessener Mini-Slice.**

### Der Mini-Slice, der vorher gehört: `server/proc.ts`

Drei der sieben Bindungen sind selbst Blätter und gehören zusammen — Prozess- und
Ausgabe-Hygiene, die nichts mit Audit zu tun hat:

| Symbol | Z. | eigene Abhängigkeit |
| --- | --- | --- |
| `retainRunOutput` | `:10874` | `STDERR_MARK`, `byteLen`, `retainSection` — alle drei lokal, ziehen mit |
| `descendantPids` | `:11114` | `KILL_TREE_MAX_DEPTH` — zieht mit |
| `killProcessTree` | `:11138` | **keine** |

Zusammen ~100 Zeilen, echtes Blatt, und `retainRunOutput` wird auch vom Verify-Gate benutzt —
der Schnitt zahlt also zweimal. **Warnung an den, der ihn briefet:** meine erste Sonde schrieb
`killProcessTree` fälschlich `MergeLast`/`VerifyPlan` zu, weil ich seinen Endpunkt geraten statt
gelesen hatte — die beiden gehören `runVerify` bei `:11146`. Die Grenzen jeder Einheit werden
GELESEN, nicht geschätzt.

Danach bleiben für die Queue vier echte Bindungen: `mintAuditEvents`, `reportServerRun`,
`repoWorkers`/`workerCmdFor` und das Helfer-Paar. **Ob die überhaupt schneidbar sind, ohne den
Kern umzubauen, ist offen und ist die Frage, die vor jedem Queue-Brief beantwortet sein muss.**

### Und was das für Erfolgsmaß 1 heißt

Der Befund ist größer als dieser Slice. `HANDOFF.md` §7 hält Erfolgsmaß 1 (Kern ≤ 8.000 Z.) für
unerreichbar und begründet es damit, dass die Kernzeilen AUFRUFSTELLEN sind, keine Definitionen.
Diese Messung nennt den zweiten Grund: **die verbleibenden Bereiche sind keine Blätter.** Sechs
Slices lang war „das nächste Blatt" verfügbar; ab hier ist es das nicht mehr, und jeder weitere
Schnitt kostet entweder eine Signaturänderung oder einen vorgelagerten Slice. Das gehört in den
Owner-Entscheid, der zu Erfolgsmaß 1 ohnehin aussteht.

## 7. ENTSCHIEDEN 2026-09-03 (Sanierungs-MAIN Slot 4), vermessen am Baum `f606e75` (server.ts 23.966 Z.): Form (2), und der Entscheid ist MEINER, nicht der des Owners

Meine Vorgängerin hat die drei Formen aus §6 als **Owner-Tor** gestellt (Attention `d3b14a4d`,
Status heute `open`, Antwort `null`, Requester-Slot weg — eine Antwort darauf bekäme 409 und
würde die Zeile refusen; das ist B-12, zum dritten Mal). **Ich stelle sie nicht neu.** Grund:
die Wahl zwischen (1)/(2)/(3) ist eine ZERLEGUNG, und Zerlegung ist ausdrücklich die Arbeit der
Program-MAIN. Form (2) ist außerdem die einzige der drei, die *keine* Owner-Erlaubnis braucht:
sie ist verhaltenserhaltend, ein reiner Move, ändert keine Signatur, bricht mit keinem Muster
der sechs bisherigen Slices, wächst nicht über den bestätigten Scope hinaus und ist einzeln
revertierbar. (1) wäre eine Richtungsänderung (Signaturen), (3) ein halber Schnitt.

**Was WIRKLICH offen und Owner-Sache bleibt** — und getrennt davon gestellt gehört: die
Erreichbarkeit von **Erfolgsmaß 1** (Kern ≤ ~8.000 Z.), für die §6 den zweiten unabhängigen
Grund liefert. Das ist eine Änderung am bestätigten Erfolgsmaß, nicht an der Schnittform.

### Die Messung, an der ich §6 vor der Freigabe nachgeprüft habe

`graphify query` liefert für diesen Bereich **zwei Fehlkanten**, die ein Brief nicht erben darf:
`retainRunOutput --calls--> trim()` (server.ts:10875) und `descendantPids --calls--> trim()`
(:11124) sind beide `String.prototype.trim`, nicht der lokale Helfer `trim` bei `server.ts#trim`;
`descendantPids --references--> Task` ist ebenfalls unbelegt. Am Code gelesen (nicht geraten):

| Symbol | eigene Abhängigkeit | außerhalb server.ts referenziert |
| --- | --- | --- |
| `retainRunOutput` | `retainSection`, `byteLen`, `STDERR_MARK` | nein (nur Prosa) |
| `retainSection` | `byteLen`, `tailBytes`, `FAIL_LINE`, `ELIDE_COST` | nein |
| `tailBytes` / `byteLen` | `utf8`, `utf8Dec` (TextEncoder/Decoder) | nein |
| `descendantPids` | `KILL_TREE_MAX_DEPTH`, `Bun.spawn`, `pgrep` | nein |
| `killProcessTree` | `process.kill` | nein |

**Damit ist die Einheit ein echtes Blatt: node/bun und sonst nichts.** Kein `e2e/pins.ts`-Pin
nennt eines dieser Symbole (geprüft), also gibt es hier nichts umzuhängen.

**Vier Rück-Importe in den Kern** (die erlaubte Richtung): `retainRunOutput` (7 Aufrufstellen —
`runVerify`, `runPostLandAudit`, 4× Helfer-Report-Tails, 2× Deploy), `byteLen` (:11241 in
`runVerify`), `descendantPids` (2), `killProcessTree` (4). `VERIFY_OUT_CAP`,
`POSTLAND_AUDIT_OUT_CAP`, `HELPER_TAIL_CAP` und `DEPLOY_OUT_CAP` bleiben im Kern — es sind
Budgets ihrer Aufrufer, keine Eigenschaft der Retention.

**Die eine Falle des Schnitts:** der Modulname `utf8` (`const utf8 = new TextEncoder()`) kollidiert
namentlich mit dem String-Literal `"utf8"`, das in `server.ts` ~15× als Encoding-Argument steht.
Ein `sed`-artiger Move fasst die Literale an. Der Move ist deshalb per Hand-Schnitt zu fahren.

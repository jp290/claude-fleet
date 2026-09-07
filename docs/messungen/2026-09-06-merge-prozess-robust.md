---
frage: Woran sterben Lands heute wirklich, und welcher eine Schnitt je Schicht holt den groessten Anteil zurueck?
urteil: Nicht am Resolver und nicht an der Gate-Arbeit (Median 107 s, nie ueber 186 s seit 01.09.), sondern an der Schlange vor dem Suite-Mutex (8,5 h Warten gegen 2,3 h Arbeit seit 01.09.; 6 Lanes in 5 Tagen als `waited` gestorben) und an Zustaenden, die kein Ledger benennt — der erste Schnitt ist der Server-Hold ueber das ganze Gate plus eine Verdikt-Zeile im Ledger.
bereich: [land-pfad, suite-mutex, ledger]
belege: [server.ts#mergeJob, server.ts#holdSuiteLock, server.ts#runVerify, server.ts#LAND_FF_RETRY_ROUNDS, server.ts#tickAuditPing, e2e-stage.sh, lane-outcomes.jsonl, post-land-audits.jsonl, audit.jsonl, git notes --ref=fleet/land]
nicht-gemessen: die Ursache der 14 `error`-Verdikte seit 03.09. — der Server persistiert je Slot nur das LETZTE Verdikt, kein Ledger traegt errorReason
stand: 2026-09-06
---

# Robuster Merge-Prozess — woran Lands sterben, und der eine Schnitt je Schicht

2026-09-06, Program-MAIN „Land-Pipeline 2026-09" (Slot 9), Denkauftrag Queue-Zeile `187aa1a0`.
Owner-Vorgabe woertlich (2026-09-06 09:5x): **„ein robuster merge prozess koennte uns echt einiges
ersparen"**. Frage: **Welche Schicht des Land-Pfads kostet heute die Stunden, und welcher EINE
Schnitt je Schicht holt den groessten Anteil zurueck?**

Alle Zahlen sind aus den Ledgern dieses Checkouts gezogen (Methode in §6); gemessen und abgeleitet
sind je Absatz getrennt.

## 1. Ergebnis in fuenf Saetzen

1. **Die Gate-ARBEIT ist kein Problem.** Volle Kette seit 2026-09-01, n = 75 Land-Notes: Arbeit
   (`verify.ms − verify.waitMs`) Median **107 s**, p90 **141 s**, Maximum **186 s**. Kein einziger
   Lauf kam dem Arbeitsbudget `FLEET_VERIFY_TIMEOUT_MS` = 480 s nahe. Ueber alle 321 Voll-Notes seit
   Juli: Median 103 s, p90 123 s. (Die Wellen-Notiz `docs/queue-wellen-2026-09-06.md` §1.3 nennt
   „p90 1 238 s Gate-Arbeit" — das ist `verify.ms` OHNE Abzug des Wartens und damit die Schlange,
   nicht die Arbeit.)
2. **Die Schlange ist das Problem.** Dieselben 75 Notes: Warten am Suite-Mutex Median 0 s, p90
   **1 784 s**, Maximum 2 669 s; 33 von 75 warteten ueberhaupt; Summe **8,5 h Warten gegen 2,3 h
   Arbeit** — 79 % der Gate-Wanduhr seit dem 01.09. war Schlange. Und das sind nur die Lands, die
   GELANDET sind: eine Land-Note entsteht nur auf main.
3. **Die Toten stehen in keinem Ledger.** Seit 2026-09-02 traegt `audit.jsonl` 35
   `merge_verdict_sent`-Ereignisse fuer nicht gelandete Verdikte: **`waited` fuer 6 verschiedene
   Lanes** (9 Zustellungen; das juengste heute 13:01, Slot 1: 2 682 s Schlange, Verify nie
   gestartet), `error` fuer 11 Lanes (14 Zustellungen), `review` fuer 7 Lanes. Warum die 11
   `error` starben, weiss kein Ledger: `MergeLast.errorReason` lebt nur im letzten Verdikt je Slot
   in `fleet.json`, `lane-outcomes.jsonl` traegt kein Merge-Feld, und die 19 `FAILED`-Land-Notes
   sind alle vom 25.07. bis 15.08. — **kein einziges Verdikt seit dem 15.08. hat eine Note mit
   `verify.ok:false`**. Das Erfolgskriterium (c) des Programs („keine neue FAILED-Note aus der
   Familie") misst diese Familien deshalb strukturell nicht; §4 sagt, woran stattdessen gemessen
   wird.
4. **Der Resolver ist es nicht.** `resolvedConflict:true` in 10 von 778 Outcomes (1,3 %),
   `repairRounds` in allen 778 gleich 0 (die Schleife bewaffnet sich nur bei !clean UND rotem
   Verify). Der Modell-Sensor `84cf7335` steht queued; bis er gemessen hat, ist jede Modellfrage am
   Resolver eine Frage ueber 1,3 % der Lanes.
5. **R2' (bounded ff-Retry) ist GELANDET und wirkt** — `server.ts#LAND_FF_RETRY_ROUNDS` (Default 2):
   genau eine Note traegt `ffRounds: 1` (2026-09-05 23:02), das Land ging durch. Die Regelbuch-Zeile
   „Die Handregel gilt, bis R2' gelandet ist" ist damit ueberholt. Die dirty-main-Klasse (uncommittete
   Aenderung im Haupt-Checkout) erkennt die Schleife korrekt als „main hat sich nicht bewegt" und
   wiederholt sie NICHT — sie stirbt weiterhin, aber nach genau einem Gate.

## 2. Die drei Schichten — was heute mechanisch gilt, welche Zahl den Schaden traegt

### 2.1 Konfliktloesung

*Mechanik:* `server.ts#mergeJob` faehrt `tryScriptRebase`; nur bei Konflikt laeuft `runMerge` (Agent
ohne eigenes `model`, erbt `SUMMARY_MODEL` = seit 06.09. 06:15 `claude-opus-5[1m]`), danach
`MERGE_REPAIR_ROUNDS` (2) Resolver↔Verify-Runden, die sich nur bei !clean UND verify rot bewaffnen.
*Zahl:* 10/778 Lanes, 0 Repair-Runden je. 44 Notes tragen `resolverDetail`, 4 `resolvedBy`.
*Schnitt:* **keiner in diesem Program.** Der Sensor `84cf7335` zuerst; ein Schnitt ohne Messung
waere ein Schnitt an 1,3 %.

### 2.2 Gate-Oekonomie

*Mechanik, am Code gelesen:* Ein Land-Gate ist `runVerify` mit der Kette install → pins → tsc →
build → `e2e-clean-review.sh` → `e2e-security.sh` → `e2e-claude-gate.sh`. **Der Server haelt den
Suite-Mutex fuer den ERSTEN Gate-Lauf nicht** — jeder der drei Wrapper zieht in `e2e-stage.sh` ein
eigenes Ticket und stellt sich einzeln an (Poll 15 s, `FLEET_SUITE_POLL_SEC`). Nur die ff-Retry-Runde
nimmt `holdSuiteLock(VERIFY_WAIT_MS)` und laesst die Wrapper per `FLEET_SUITE_LOCK_HELD_BY` erben
(`runVerify(…, true)`). Der Wartekill (`waitedOut`) kommt nach `FLEET_VERIFY_WAIT_MS` = 2 700 000 ms
Schlange, egal in welchem Wrapper; das Verdikt heisst `resolved, landed:false, verify.ok:null` und
ist TERMINAL — ein Mensch oder eine MAIN muss neu druecken.
*Zahlen:* Geblockte Stufen je Gate seit 01.09. (aus dem `[suite mutex: …]`-Tail der Notes, n = 75):
0 Stufen 42 · 1 Stufe 26 · 2 Stufen 4 · 3 Stufen 2 · ohne Feld 4. Die sechs Gates mit ≥ 2 Wartestellen
warteten 1, 2, 22, 31, 39 und 40 Minuten. Die Konkurrenz am selben Mutex: Post-Land-Audits der
letzten 7 Tage n = 124, davon 94 volle mit Verdikt, Median **26,8 min**, p90 34,2 min, Summe
**41,0 h in 7 Tagen** (5,9 h/Tag); 39 der 124 liefen remote auf dem Second-host (31 %), 23 endeten
`unknown` (17 %, Timeout 45 min). Dazu lokale Vorschau-Laeufe der Lanes (heute 34 Trail-Dateien im
`$TMPDIR/fleet-e2e-trail`) — der heutige Tod von Slot 1 stand hinter Flake-Beweislaeufen von Slot 4.
*Schnitt:* §3, Zeile 1 und 2.

### 2.3 Integrationssicherheit

*Mechanik:* `advanceIntegration` macht den `--ff-only`-Merge im Haupt-Checkout; scheitert er, prueft
die Schleife `mainMoved` — nur ein bewegtes main loest die Retry-Runde aus (Re-Rebase, Re-Gate unter
Hold, `ffRounds++`). Ein schmutziger Haupt-Checkout (Datei des Lands uncommittet) scheitert am selben
Aufruf, bewegt main nicht und endet nach EINEM Gate als `ff-lost` mit dem `adv.error` im Detail.
`undo-land` Stack Tiefe 3 (`UNDO_STACK_MAX`), Post-Land-Audit koalesziert (`drainPostLandAudits`).
*Zahlen:* dirty-main-Tode 2× am 2026-09-05 (Regelbuch, „Pruefe das VOR JEDEM EINZELNEN Commit");
seit R2' 0 gemessene Wiederholungen dieser Klasse — aber auch kein Sensor, der sie zaehlt (§1.3).
Der gesamte Verlust je Vorfall: ein volles Gate (Median 107 s) plus seine Schlange plus die Latenz,
bis jemand neu drueckt.
*Schnitt:* §3, Zeile 3.

## 3. Schnittliste — Rangliste, an der Owner-Vorgabe abgeschnitten

Owner-Vorgabe woertlich: „ein robuster merge prozess koennte uns echt einiges ersparen." Robust
heisst hier: **ein Land stirbt nur noch an seinem Baum, nie an der Maschine.** Die Liste hoert dort
auf, wo das erfuellt ist. Kosten sind Ledger-Sekunden, wie oben gemessen. Jede Zeile ist eine Lane
(Opus 5 high), max. eine dieses Programs gleichzeitig.

### M1 — Gate unter Server-Hold, und jedes Verdikt eine Ledger-Zeile

*Mechanismus:* Vor dem ersten `runVerify` im clean-Pfad von `mergeJob` nimmt der Server
`holdSuiteLock(VERIFY_WAIT_MS)` und faehrt das Gate mit `runVerify(…, true)` — genau der Weg, den die
ff-Retry-Runde heute schon geht (`ffHeld`). Wird der Hold im Budget nicht gewaehrt, ist das Verdikt
`waitedOut` OHNE dass install/tsc/build je liefen. Zusaetzlich schreibt dieselbe Stelle, an der
`MergeLast` gesetzt wird, EINE Zeile `merge_verdict` nach `audit.jsonl`:
`{branch, slot, status, landed, errorReason, waitedOut, timedOut, ms, waitMs, ffRounds, actor}`.
*Was es kauft:* aus drei Wartestellen wird eine (6/75 Gates standen ≥ 2×, bis 40 min); kein Gate
laeuft mehr halb und stirbt dann; das Server-Poll (5 s, `SUITE_LOCK_POLL_MS`) gegen 15 s der
Shell-Anwaerter gibt dem Land Vorfahrt vor Vorschau-Laeufen — dieselbe Vorfahrt, die die
ff-Retry-Runde schon hat. Und die Familien aus §1.3 werden zaehlbar.
*Nicht angefasst:* `e2e-stage.sh`, der Mutex selbst, Ticket-Protokoll (Program Audit-Determiniertheit).
*Done:* Eine Land-Note eines Code-Lands nach M1 traegt im `[suite mutex: …]`-Tail „0 of 3 staged
steps blocked" bei `verify.waitMs > 0` (das Warten lag im Hold, nicht in den Stufen), und
`audit.jsonl` traegt fuer jedes Merge-Verdikt seit M1 genau eine `merge_verdict`-Zeile.
*Gebaut* in Lane `fleet/260906222646-5fb3`, gelandet 2026-09-07 02:5x als `f388de1` + `f0bcea6` (Self-Land
der Program-MAIN Slot 4, `verify.ok:true`, 140 s Arbeit, 0 s Schlange). **Der Done-Satz war erst nach dem
DEPLOY messbar, und ist es seit dem Deploy `4fc0afa7` (03:08, Id in `deploys.jsonl`) — GEMESSEN 2026-09-07 07:2x von der Program-MAIN
Slot 5:** `audit.jsonl` traegt 8 `merge_verdict`-Zeilen fuer 8 Verdikte seit dem Deploy (4 `merged`
per MAIN/Owner, 2 `error ff-lost`, 1 `resolved`, 1 Owner-Land mit `waitMs null`); drei tragen
`waitMs > 0` — 710 000, 450 000, 255 000 ms — und jede dieser drei Land-Noten sagt „0 of 3 staged steps
blocked": das Warten lag im Hold, hinter einem TOTEN Halter (der Befund, den M5 schliesst). Das erste
Code-Land der MAIN nach dem Deploy (M5 selbst, `b2ab2cf`) traegt `merge_verdict … ms 139475 waitMs 0`;
`./state.sh` zaehlt weiterhin 19 FAILED-Notes, keine neue. Eine Abweichung von der Nicht-Liste war noetig und ist
gemessen: die e2e-Instanzen teilten sich bis dahin den Maschinen-Mutex `/tmp/fleet-e2e.lock` mit
dem Wrapper, der sie startet — mit dem Hold vor dem Gate stand jeder saubere Land-Pfad in einer
Schlange hinter seinem EIGENEN Runner (gemessen 2026-09-06: `./e2e-clean-review.sh` haengt in
`waitMerge`, 60 s Timeout). Drei Wrapper (`e2e-isolated.sh`, `e2e-clean-review.sh`,
`e2e-postland-audit.sh`) sagen ihrer Instanz darum per `FLEET_SUITE_LOCK_HELD_BY=$_st_lock_pid`, in
wessen Hold sie laeuft; `server.ts#inheritedSuiteHolder` honoriert das nur unter den drei Bedingungen
von e2e-stage.sh (pid genannt · Lock-Datei nennt dieselbe · Prozess lebt). **Dort stand zuerst das
literale `$$`, und das kostete nach dem M1-Deploy JEDE Code-Lane** (Fix 2026-09-07, `b8b5e48`): im
Land-Gate ist so ein Wrapper selbst ein GEERBTER Schritt, die Lock-Datei nennt den LIVE-Server, also
scheiterte `$$` an genau der zweiten Bedingung, der Test-Server stellte sich hinter den Hold des
Live-Servers und das Land starb nach 60 s in `waitMerge` (gemessen am ersten Code-Land nach dem
Deploy, Slot 1, 04:24; unter simuliertem Halter vor und nach dem Fix reproduziert). Ausserhalb eines
Holds IST `$_st_lock_pid` gleich `$$` — darum sah es kein Standalone-Lauf. Am Mutex-Protokoll selbst
ist nichts geaendert; die Alternative eines privaten Locks je Instanz wurde gebaut und verworfen,
weil sie `e2e/verify-queue.ts` §1/§2 die Grundlage naehme.

*Verify:* Checks im Merge-/Land-Pfad (`e2e/land-durability.ts` oder die Datei, in der
`LAND_FF_RETRY_ROUNDS` heute geprueft wird): (a) ein Gate unter besetztem Mutex und Budget 0 endet
`waitedOut` mit `steps` leer bzw. `ms` < 5 s; (b) ein Gate unter freiem Mutex laeuft mit gesetztem
`FLEET_SUITE_LOCK_HELD_BY` (Env-Sonde am Verify-Kommando); (c) je Verdiktform genau eine
`merge_verdict`-Zeile; `./e2e-clean-review.sh` und `./e2e-isolated.sh` als Vorschau (Land-Pfad
beruehrt), Suite-Offer an den Second-host; `bun e2e/pins.ts` gruen.

### M2 — `waitedOut` ist eine Wiedervorlage, kein Tod

*Mechanismus:* Endet M1s Hold ohne Lock, legt `mergeJob` das Land nicht als terminales `resolved`
ab, sondern als `waiting` mit `retryAt`; ein Tick versucht den Hold erneut, gedeckelt durch
`FLEET_LAND_WAIT_ROUNDS` (Default 1 — also hoechstens 2 × 45 min). Erst danach das heutige
`resolved, landed:false, waitedOut`. Zwischen den Runden ist der Slot `merge running`, die Lane
unangetastet; bewegt sich main, greift die bestehende Re-Rebase-Logik.
*Was es kauft:* die 6 `waited`-Lanes der letzten 5 Tage haetten ohne MAIN-Turn einen zweiten
Versuch bekommen; heute blieb Slot 1 anderthalb Stunden ohne Wiederholung liegen.
*Done:* Ein Land, dessen erster Hold scheitert, erscheint auf `GET /api/slots/:id/merge` als
`running` mit `waitRound: 1` und landet, sobald der Mutex frei wird; nach `FLEET_LAND_WAIT_ROUNDS`
gescheiterten Holds das heutige Verdikt mit `waitRounds` im Detail.
*Verify:* Check: Mutex besetzt → Land in Runde 1 wartend → Mutex frei → Land geht durch, Note
traegt `waitRounds: 1`; Gegenprobe mit Deckel 0 = heutiges Verhalten byte-gleich. Vorschau wie M1.

### M3 — Vorflugpruefung: schmutziger Haupt-Checkout stirbt in Sekunden, nicht nach einem Gate

*Mechanismus:* Vor dem Hold berechnet `mergeJob` `git diff --name-only <mainSha>..<laneTip>` und
schneidet es mit `git status --porcelain` des Haupt-Checkouts. Nicht leer ⇒ sofortiges Verdikt
`error`, `errorReason: "dirty-main"` (neuer Wert in `MERGE_ERROR_REASONS`), Detail nennt die Dateien;
dieselbe Pruefung noch einmal unmittelbar vor `advanceIntegration`, weil ein Edit dazwischen
moeglich ist (dann wie heute `ff-lost`). Kein Gate, kein Mutex verbrannt.
*Was es kauft:* je Vorfall ein Gate (107 s) plus Schlange (p90 1 784 s) plus die Latenz bis zum
naechsten Druck; 2 Vorfaelle am 05.09. Vor allem: der Grund steht im Verdikt statt in einem
git-Fehlertext, und `dirty-main` ist als Familie zaehlbar (M1).
*Done:* Ein Land gegen einen Haupt-Checkout mit uncommitteter Aenderung an einer Datei des Lands
endet in < 5 s mit `errorReason: "dirty-main"`; dieselbe Aenderung an einer NICHT beruehrten Datei
laesst das Land durch.
*Verify:* zwei Checks im Land-Pfad genau mit diesen beiden Faellen; `lane-signals.ts#mergeBlocksLane`
behandelt `dirty-main` wie `ff-lost` (die Lane bleibt done-looking); Vorschau wie M1.

*Gebaut* in Lane `fleet/260907091244-2e44`, gelandet 2026-09-07 13:5x als `6c70f01` + `79e1c36` + `94a8840` (Self-Land
der Program-MAIN Slot 5, `verify.ok:true`, 141 s Arbeit, 0 s Schlange; Vorschau §8h 7/7 gruen).

### M5 — Hold-Hygiene: der tote Halter wird gereapt, die proportionale Kette nimmt keinen Hold

*Warum, zwei Messungen vom 2026-09-07 (Controller, 04:11–04:23, am docs-only-Land von Slot 11,
Task `580cc453`; am Code gegengelesen):*

1. **Niemand reapte den toten Halter mehr.** `/tmp/fleet-e2e.lock` trug pid 77910 (birth 04:18:16),
   der Prozess war tot, kein Wrapper lief (Prozess-Zaehler 0). Vor M1 traf so ein Leichnam nur die
   Wrapper-Schlange, und die reapt selbst; seit M1 nimmt JEDES saubere Land den Hold, und
   `holdSuiteLock` reapte per Konstruktion nie (`docs/suite-contention.md` §7/§7b/§7c nannten das
   ausdruecklich als Entscheidung). Folge: das Land pollte **710 s**, bis ein Mensch die Lock-Dir
   raeumte. Ohne diesen Menschen haette es die vollen `FLEET_VERIFY_WAIT_MS` (2 700 000 ms)
   verbrannt und waere `waitedOut` gestorben, **ohne den Baum je angesehen zu haben** — und jedes
   folgende Land ebenso, bis zufaellig ein Wrapper-Kontender reapt.
2. **Die proportionale Kette nahm denselben Hold.** Ein docs-only-Land faehrt
   `VERIFY_PROPORTIONAL_CMD` = `bun install --frozen-lockfile && bun e2e/pins.ts` (zwei Schritte,
   `install`+`pins`; `verify-proportion.ts`, `server.ts#verifyPlanFor`). Sie braucht weder Socket
   noch Port noch Maschinenlast — aber seit M1 stand sie in derselben Schlange. Die Land-Note dieses
   Lands: `verify.proportional:true`, `steps [install,pins]`, **`ms 710837`** = `waitMs 710000` +
   ~1 s Arbeit. Hinter einem Post-Land-Audit wartet ein docs-Land damit bis zu 35 min fuer eine
   Sekunde Arbeit.

*Ein vierter Datenpunkt zu (1) am selben Morgen:* die lokale Vollkette einer Lane (Slot 11, 04:26,
laut ihrem Report gruen) hinterliess einen Lock mit toter PID 19458 — die Wrapper-Freigabe hat also
einen Pfad, der den Lock nicht zurueckgibt. Der Controller reapte an diesem Morgen zweimal von Hand
(77910, 19458), beide Male hing ein Server-Land dahinter. **Dieser Wrapper-Pfad ist hier NICHT
gefixt** (Nicht-Ziel; er gehoert dem Program Audit-Determiniertheit) — der Server-Reap macht ihn
fuer Lands folgenlos, und genau das ist Done-Satz (a).

*Mechanismus:* `server.ts#suiteLockReapStale`, aus `holdSuiteLock` vor jedem Poll gerufen, spiegelt
die Dreiteilung von `e2e-stage.sh` (Kopf, `_st_`-Wartschleife) **ohne sie zu aendern**: pid tot oder
unlesbar ⇒ Waise, reapen · pid lebt mit ANDERER birth ⇒ recycelte pid, reapen · pid-lose Dir MIT
birth ⇒ zerrissene Akquise, reapen · pid-lose Dir OHNE birth ⇒ **manueller Park, nie reapen** · pid
lebt mit fehlender/malformter/unmessbarer birth ⇒ unbekannt, behalten. Vor dem `rm` werden pid- UND
birth-WERT erneut gelesen (dieselbe Fensterverengung wie im Wrapper), und ein gereapter Leichnam
wird im selben Zug genommen statt nach einem Poll. Zweitens: ist `firstVerifyPlan.proportional`,
ruft der clean-Pfad `holdSuiteLock` gar nicht und mintet `FLEET_SUITE_LOCK_HELD_BY` nicht ins
Gate-Kind; die Note sagt das positiv (`[suite mutex: NOT TAKEN — …]`) statt als Abwesenheit.

*Nicht angefasst:* `e2e-stage.sh` und das Mutex-Protokoll (mkdir = Claim, pid/birth = Identitaet,
Reap-Dreiteilung) · die ff-Retry-Kette, die einen ANDEREN Baum klassifiziert und den Mutex nimmt wie
vor M1 · der pid-lose Park.

*Done (beide gebaut und geprueft):*
(a) Ein `waitedOut`-Verdikt kann nur noch entstehen, wenn ein LEBENDER Halter die ganze Zeit hielt.
(b) Bei `proportional === true` wird kein Hold genommen, nichts gemintet, und die Note sagt es.

*Verify:* `e2e/programs.ts` §8g, fuenf Arme am echten Land-Pfad (Self-Land einer gebundenen MAIN,
Lock-Dir vorher von Hand geformt): (i) toter Halter ⇒ gereapt, Gate spawnt (`gateRuns === 1`), Land
faellt, Lock danach weg · (ii) **Gegenprobe** pid-lose Dir ⇒ Land verweigert, Park unberuehrt ·
(iii) **Gegenprobe** lebende pid ohne birth ⇒ nicht gereapt, Halter haelt weiter · (iv) docs-only-Land
bei BESETZTEM Lock (lebende pid, bewiesene birth) laeuft ohne zu warten und traegt den Marker ·
(v) **Kontrollarm** Code-Land gegen denselben Halter wird weiter verweigert (`waitedOut`), sonst
haette (iv) nichts gemessen. Dazu zwei Pins in `e2e/pins.ts` (Reap-Dreiteilung gegen die des
Wrappers; Kein-Hold plus die Eigenschaft, die es sicher macht: das proportionale Kommando nennt
keinen `e2e-*.sh`-Wrapper).

*Gebaut* in Lane `fleet/260907031403-3744`, gelandet 2026-09-07 07:2x als `94dd5e4` + `a15b59a` + `b2ab2cf` (Self-Land der
Program-MAIN Slot 5, `verify.ok:true`, 139 s Arbeit, 0 s Schlange — der Lock trug beim Land den DRITTEN toten
Halter des Tages, pid 22947, birth 06:28:40, von der MAIN vor dem Land von Hand gereapt; fuenfter Datenpunkt).

**Schnittlinie.** Nach M1–M3 (M5 repariert eine M1-Regression und fuegt der Liste
keine neue Todesart hinzu) stirbt ein Land nur noch an rotem Verify, an einem Konflikt, den der
Resolver nicht loest, oder an 90 Minuten durchgehend besetzter Maschine — alles drei Aussagen ueber
den Baum oder ueber eine Entscheidung, die ein Mensch sehen soll. Das ist die Vorgabe. Was folgt,
sind getrennte Vorschlaege, keine Lanes dieses Programs.

### Unter der Linie: M4 — Audit-Ping an die MAIN, der das Land gehoert (offene Frage des Programs)

`server.ts#tickAuditPing` liefert ein rotes Audit an die am laengsten idle Nicht-Lane-Session
(`candidates.sort(lastOutput)`), nicht an die MAIN des Programs, das gelandet hat. Der Join
existiert: `covers[].branch` → `lane-outcomes.jsonl#taskId` → `task.programId` → `program.main`.
Vorschlag: erster Kandidat ist diese MAIN, wenn sie live ist; sonst wie heute. Kosten: ~30 Zeilen,
ein Check. Nutzen ist Zuordnung, nicht Robustheit — deshalb unter der Linie.

## 4. Was NICHT gebaut wird, und warum

- **Gate-Offload auf den Second-host-Helfer.** Der Audit laeuft dort schon zu 31 %; ein Land-Gate
  remote bindet ein Verdikt an einen fremden Host und gehoert ins Dual-Host-Program (`1e7765c9`).
- **Prioritaetsklassen im Ticket-Protokoll** (`e2e-stage.sh`). Nicht-Ziel dieses Programs; gehoert
  dem Program Audit-Determiniertheit (Slot 7). M1 kauft die Vorfahrt fuer Lands ohne dieses Protokoll
  anzufassen — die Nebenwirkung „Server ueberholt Shell-Anwaerter" ist im Regelbuch schon
  dokumentiert und fuer die ff-Retry-Runde akzeptiert.
- **Resolver-Modell / Fable-Eskalation / Sonnet-Trichter.** 1,3 % der Lanes; Sensor `84cf7335` zuerst.
- **Auto-Rollback auf rotes Audit, `rerere`, hartes Land-Gate.** Beerdigt (Register §7).
- **Ein Land-Gate ohne Suite-Mutex** (parallel zum Audit). Zwei Suiten gleichzeitig erzeugen auf
  dieser Maschine Fehler auf beiden Baeumen (Regelbuch, `docs/attic/regelbuch-messgeschichten-2026-08.md` §11).
- **Wiederbelebung der `killed-dirty`-Lanes als Pipeline-Problem.** 33 Lanes, alle mit Commits, 30
  davon unverifiziert — das sind Owner-Kills, keine Land-Tode; das Program Fleet-Betrieb fuehrt den
  Lebenszyklus (`c3604ce3`).

Zum Kriterium (c) des Programs: FAILED-Notes tragen die adressierten Familien nicht (§1.3). Gemessen
wird stattdessen an der `merge_verdict`-Zeile aus M1: **nach M1 keine Zeile mit `waitedOut:true`
und `steps` nicht leer; nach M2 keine terminale `waitedOut`-Zeile mit `waitRounds` < Deckel; nach M3
keine `ff-lost`-Zeile, deren Detail „Your local changes" enthaelt.** `./state.sh` bekommt dafuer
eine Zeile, sobald M1 gelandet ist (Teil von M1s Done, nicht dieser Notiz).

## 5. Ledger-Zahlen als Tabelle

| Groesse | n | Median | p90 | Max | Summe |
|---|---|---|---|---|---|
| Gate-ARBEIT (`ms − waitMs`), volle Kette, seit 01.09. | 75 | 107 s | 141 s | 186 s | 2,3 h |
| Gate-WARTEN (`waitMs`), volle Kette, seit 01.09. | 75 | 0 s | 1 784 s | 2 669 s | 8,5 h |
| Gate-ARBEIT, volle Kette, alle Notes | 321 | 103 s | 123 s | — | — |
| Post-Land-Audit, volle Kette mit Verdikt, 7 Tage | 94 | 26,8 min | 34,2 min | — | 41,0 h |
| Nicht gelandete Verdikte seit 02.09. (`merge_verdict_sent`) | 35 | waited 9 (6 Lanes) · error 14 (11) · review 12 (7) |
| Lane-Ausgaenge gesamt | 778 | landed 564 (72 %) · killed-empty 159 · killed-dirty 33 · shelved 22 |
| Resolver | 778 | resolvedConflict 10 · repairRounds > 0: 0 |
| ff-Retry seit R2' | 1 | `ffRounds: 1`, 2026-09-05 23:02, gelandet |

## 6. Methode

Notes: `git notes --ref=fleet/land list`, je Objekt `show`, JSON-Felder `verify.ms`, `verify.waitMs`,
`verify.proportional`, `verify.waitedOut`, `ffRounds`, `at`; Arbeit = `ms − waitMs`; Fenster
`at ≥ 2026-09-01T00:00 lokal`. Geblockte Stufen: Regex `(\d) of 3 staged steps blocked` ueber das
serialisierte `verify`. Audits: `post-land-audits.jsonl`, `at ≥ now − 7 d`, `result`, `ms`,
`proportional`; remote = ein `remote`/`helper`/`host`-Feld gesetzt. Verdikte:
`audit.jsonl`, `event == "merge_verdict_sent"`, `ts ≥ now − 4 d`, Lane = Branch im `detail`.
Outcomes: `lane-outcomes.jsonl`, `disposition`, `resolvedConflict`, `repairRounds`, `commitCount`.
Code: `server.ts` an `mergeJob` (Retry-Schleife ab `let ffRounds = 0`), `holdSuiteLock`,
`runVerify` (zwei Uhren `timedOut`/`waitedOut`), `LAND_FF_RETRY_ROUNDS`, `tickAuditPing`;
`e2e-stage.sh` Ticket-Schlange und `FLEET_SUITE_POLL_SEC`.

## 7. Was nicht gemessen wurde

- Die Todesursache der 11 `error`-Lanes seit 03.09. (kein Ledger; M1 schliesst die Luecke).
- Wer den Mutex waehrend der 8,5 h Wartezeit hielt (Audit vs. Vorschau vs. fremdes Gate) — der Trail
  traegt Laeufe, aber keine Halter-Zuordnung je Wartezeit.
- Ob das Server-Poll von 5 s gegen die 15-s-Schlange in der Praxis jedes Mal gewinnt; die Aussage
  „Vorfahrt" ist aus dem Code abgeleitet, nicht gemessen.
- Die `waited`-Zaehlung ist eine Untergrenze: `merge_verdict_sent` entsteht nur, wenn eine Session
  das Verdikt zugestellt bekam.

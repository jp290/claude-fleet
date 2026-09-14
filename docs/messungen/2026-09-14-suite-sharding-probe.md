 | Lauf | Baum (Trail-`tree`, Vor-Rebase-SHA, s. Hinweis) | Checks |---
frage: Kann ./e2e-isolated.sh in n unabhaengigen Shards laufen, und was bringt das an Wanduhr?
urteil: Ja, per --shard k/n ohne Verhaltensaenderung ohne Flag (Vereinigung der Check-Namen aus 4 seriellen Shards gegen den ungeshardeten Lauf ist diff-leer, 4 378 = 4 378), aber eine Unit `core` aus 17 gekoppelten Modulen traegt 58 % der Suite (1 239 von 2 120 s), deckelt die Wanduhr ab n=2 auf ~21 statt 35 min (Faktor 1,7) und macht n=4 wertlos, bis programs/tasks von der self-token-Lane entkoppelt sind; die Laeufe fanden fuenf versteckte Kanten, die keine Karte sah
bereich: [verify, e2e, suite-kontention, multi-host]
belege: [fleet-e2e.ts, e2e/ctx.ts#SHARD_UNITS, e2e/ctx.ts#shardPlan, e2e/pins.ts, e2e/slots.ts, e2e/restart.ts#cmdEnv, e2e/tasks.ts, e2e/supervisor.ts, e2e/watch.ts, e2e/harness.ts#plogRead, docs/messungen/2026-09-06-second-host-parallel-suiten.md]
nicht-gemessen: kein paralleler Lauf (Auftrag); die Wanduhr bei Parallelitaet ist aus seriellen Shard-Dauern ABGELEITET, RAM je Shard aus der Second-host-Messung 2026-09-06 uebernommen, Flake-Basisraten der Shards nicht erhoben
stand: 2026-09-14
---

# Kann `./e2e-isolated.sh` in n unabhaengigen Shards laufen?

2026-09-13/14, Lane `fleet/260913194407-382d`. Frage: **Kann die volle Suite (`bun fleet-e2e.ts`,
42 Module gegen EINE Server-Instanz) in n unabhaengige Teile zerlegt werden, ohne eine Pruefung zu
verlieren — und welche Wanduhr ist bei paralleler Ausfuehrung zu erwarten?**

Auftrag (Owner 2026-09-13): nur das `--shard`-Flag und die Karte, KEIN paralleles Fahren, keine
Aenderung an Helfer-Daemon oder Audit-Pfad. Gemessen Slot 5 am 2026-09-13: volle Suite ~39 min,
4 384 Checks, 69 % Warten; Erwartung (abgeleitet) 4 Shards ~10–15 min.

## Ergebnis

**1. Das Flag.** `bun fleet-e2e.ts --shard k/n` (argv) oder `FLEET_E2E_SHARD=k/n ./e2e-isolated.sh`
(Env — die Runner-Zeile des Wrappers reicht kein argv weiter: `eval "… bun fleet-e2e.ts"`). Ohne
Flag laeuft jeder Schritt: die Folge der `await <modul>.run(`-Zeilen in `fleet-e2e.ts` ist gegen
den Stand vor dem Umbau (`1e2a25d2`) diff-leer bis auf die Schleifenzeile `await step.run(` selbst
(M1). Ein malformiertes `k/n` ist ein Fehler, nie „alle". Ein Shard druckt vor den Ergebnissen
`shard k/n: units=[…]` und je Unit `shard-unit <name> <ms>`; der Tail bleibt `ALL PASS`/`N FAILURES`.
Ein Shard ohne `core` oeffnet vor dem ersten Schritt Slot 1 (`~/claude-fleet`) und Slot 2 (`~`) mit
denselben zwei Aufrufen wie `e2e/slots.ts` (Begruendung §3, Kante K2).

**2. Die Abhaengigkeitskarte** (`e2e/ctx.ts#SHARD_UNITS`, 20 Units). Drei Kopplungsarten, jede am
Code gelesen — und dazu die Kanten, die erst die Laeufe zeigten (§3):

| Kopplung | Produzent → Konsument | Beleg |
| --- | --- | --- |
| Ctx-Feld `sh*` | share → review, intake, restart, security | `grep -o 'ctx\.[a-zA-Z]*' e2e/*.ts` (M2) |
| Ctx-Feld `aPersistId`/`aPerpPersistId` | autos → restart | M2 |
| Ctx-Feld `restartSelfTok`/`restartSelfSlot` | self-token → programs, tasks, trailstats, restart | M2; `e2e/programs.ts` nutzt den Lane-Token in `selfPropose`/`selfPrograms`, `e2e/tasks.ts` schont `ctx.restartSelfSlot` beim Aufraeumen |
| Ctx-Feld `auditPath`/`gapRepo`/`planted*` | restart → steward-core, security (`cmdEnv`/`gapEnv` liest ausser restart.ts niemand) | M2 |
| Rueckgabewert `StewardCtx` | steward-core → steward-outcomes, security | `fleet-e2e.ts` (`sc = await stewardCore.run(ctx)`) |
| LaneCtx `lnSlot`/`lnPath` | lanes-basic → lanes-lifecycle, merge | `fleet-e2e.ts` (`lc`) |
| Server-Zustand: Slot 1+2 offen | slots → history, summary, transport, autos, share, intake | `e2e/slots.ts` (`/api/slots/1/open`, `/api/slots/2/open` — die EINZIGEN Oeffner in `e2e/`, M3); Leser: `e2e/history.ts` (`/api/slots/2/history`, `/api/slots/1/brief`), `e2e/summary.ts` (`/api/slots/1/summary`), `e2e/autos.ts`, `e2e/share.ts`, `e2e/intake.ts` (`/api/slots/2/share`), Runner-Kommentar zu transport; Toeter: `e2e/restart.ts` §kill semantics |
| Server-Zustand: ein bestaetigtes Program (K1) | outcomes → tasks | `e2e/tasks.ts`: „outcomes.ts runs before this module and leaves the Program used by its restart probe in the confirmed state. Reuse it" |
| Server-Env nach Restart (K5) | restart → steward-core | `e2e/restart.ts#cmdEnv` (handgepflegte Liste) gegen `e2e/steward-core.ts#settleForSteward` (800 ms) und `server.ts#STEWARD_MIN_IDLE_MS` (Default 60 000) |

Die transitive Huelle ist EINE Unit, `core`, mit 17 Modulen: slots, history, summary, transport,
autos, share, review, self-token, programs, trailstats, outcomes, tasks, intake, restart,
steward-core, steward-outcomes, security. Jedes andere Modul oeffnet und toetet eigene Slots/Lanes
(so sagt es sein Kopfkommentar, und `grep -n 'slot: 3\b\|"/api/slots/3/'` ueber die Nicht-core-
Lane-Module liefert keine feste Slot-Nummer, M3) — 19 weitere Units, davon nur `lanes` (3 Module,
LaneCtx) mehrmodulig. Die Trail-Familie (`e2e/trail.ts`) laeuft in jedem Shard: sie prueft die
Zeilen ihres EIGENEN Prozesses. Zwei Pins (`e2e/pins.ts`, Regel „every check module the runner boots
sits in exactly one shard unit") halten Tabelle und Runner deckungsgleich: jedes gebootete Modul in
genau einer Unit (42 = 42), jeder Schritt-Unit-Name bekannt.

**3. Was die Laeufe fanden, was die Karte nicht sah — fuenf Kanten, jede mit Signatur.**

| # | Shard | Signatur | Kante | Reparatur |
| --- | --- | --- | --- | --- |
| K1 | 1/4 (1. Lauf, 21:57) | 3 FAIL `Task.programId owner mint accepts a confirmed Program …` (400 bad programId) + TypeError tasks.ts | tasks liest das von outcomes bestaetigte Program | outcomes → `core` (`4d1465fd`) |
| K2 | 2/4 (1. Lauf, 23:23) | FAIL `shelve rejects a non-worktree slot` | Slot 2 als OFFENER Nicht-Worktree-Slot ist Negativkontrolle in lanes-basic/lanes-lifecycle/lane-risk/merge (`grep -n 'slots/2/' e2e/*.ts`); diff/land (lanes-basic) und risk/commit (lane-risk) antworten auch einem NICHT offenen Slot 400, shelve nicht, merge wurde nicht erreicht | Basisfixture Slot 1+2 im Shard ohne `core` (`b1beb0de`) |
| K3 | 2/4 (1. Lauf) | ENOENT `streams/prompts.jsonl` in lanes-lifecycle (Baton-Sektion, `plogRead`) → Prozessabbruch nach 419 Checks | die Datei entsteht mit dem ersten zugestellten Prompt; im Shard sendet vorher niemand | `harness.ts#plogRead`: fehlende Datei = `[]` (`b1beb0de`) |
| K4 | 3/4 (1. Lauf, 23:24) | FAIL `supervisor setup: a live session self credential … (self=0 steward=32)` + 4 Zwillinge | supervisor braucht IRGENDEINEN Slot mit Self-Token in fleet.json | dieselbe Basisfixture; 3b gruen |
| K5 | 1/4 (2. und 3. Lauf, identisch: 23:02 und 00:25) | 5 FAIL steward-core, Wurzel `typed send … {"error":"target slot not idle"}` | restart.ts' Env-Liste traegt `FLEET_STEWARD_MIN_IDLE_MS` nicht; der Server gated 60 s, die Sonde wartet 800 ms. In der vollen Suite stellen verify-queue/deploy-facts/errors die Wrapper-Env per `harness.restartSrv()` wieder her — ein Zufall der Reihenfolge, kein Vertrag (Register: 736 gruen / 0 rot in Vollaeufen, 2/2 rot im Shard) | Knopf in die Liste (`1b6350c3`); Shard 1c gruen |

Dazu ein Namensbefund: acht Check-Namen in `e2e/watch.ts` trugen die zugeteilte SLOT-ID
(`V1b: the MAIN subscribes to lane 7…10`, `self-watch fills the cap: subscribing to peer lane
11…14`); im Shard hiessen dieselben Pruefungen `lane 3…6` / `7…10`. Die Nummer ist ein Artefakt
dessen, was die Suite vorher geoeffnet hat (Trail-Register: 310 Zeilen je Nummer 7–10, 4–6 je
Nummer 3–6). Die Namen tragen jetzt `#1…#4` (`deb0fa80`); acht Namen verlieren damit ihre
Register-Historie. Und ein Flake, kein Befund: `an unattended send whose payload is NOT accepted
rolls its own payload back out of the composer` (watch) fiel in Shard 3 (1. Lauf) und im fremden
Vollauf `isolated-20260913T201053Z-85738` derselben Nacht; Register 23 gruen / 2 rot; in 3b gruen.

**4. Der Beweis: n=4 seriell gegen ungeshardet.** HINWEIS ZU DEN SHAS: jede Commit-SHA in dieser Notiz ist die SHA des Lane-Baums, auf dem der Lauf gemessen wurde (identisch mit dem `tree`-Feld der genannten Trail-Dateien unter `e2e-trail/`). Die Lane landet per Rebase, auf main heissen dieselben Commits anders — die MAIN traegt nach dem Land die main-SHAs nach, zuordenbar ueber die Commit-Subjects: „--shard k/n im Runner" (b371155c), „outcomes gehoert in die Shard-Unit core" (4d1465fd), „der outcomes-Schritt im Runner heisst core" (c0f476e6), „Shard-Basisfixture" (b1beb0de), „zwei Watch-Checknamen tragen den Ordinal" (deb0fa80), „restart.ts traegt FLEET_STEWARD_MIN_IDLE_MS" (1b6350c3). Alle Laeufe auf dem Mac, seriell durch den
Suite-Mutex, `FLEET_E2E_SHARD=k/4 ./e2e-isolated.sh` bzw. ohne Env.

| Lauf | Baum | Checks | Failures | Runner-Dauer | Units |
| --- | --- | --- | --- | --- | --- |
| ungeshardet | `b1beb0de` | 4 419 | 0 (ALL PASS) | 2 113 s (Trail-Spanne) | alle |
| ungeshardet | `deb0fa80` | 4 419 | 0 (ALL PASS) | 2 120 s (Trail `isolated-20260913T224812Z-32907`) | alle |
| ungeshardet | `1b6350c3` (final) | 4 419 | 0 (ALL PASS) | 2 122 s (Trail `isolated-20260914T043130Z-27323`) | alle |
| ungeshardet, Second-host (Command-Job `c2dc827e62d3`) | `b371155c` | — | 0 (ALL PASS) | 1 839 s (Job `ms`) | alle |
| ungeshardet, Second-host (`b97832fa63a2`) | `deb0fa80` | — | 0 (ALL PASS) | 1 835 s | alle |
| Shard 1/4 (1c) | `1b6350c3` | 2 535 | 0 | 1 239 s | core |
| Shard 2/4 (2b) | `b1beb0de` | 705 | 0 | 300 s (pure 0 · lanes 291 · ref-advance 4 · errors 4) | pure lanes ref-advance errors |
| Shard 3/4 (3b) | `deb0fa80` | 770 | 0 | 271 s (auth 2 · watch 177 · explorer 1 · drops 2 · concurrency 12 · supervisor 36 · verify-queue 42) | auth watch explorer drops concurrency supervisor verify-queue |
| Shard 4/4 (4b) | `deb0fa80` | 445 | 0 | 243 s (attention 11 · lane-risk 3 · land-provenance 114 · ctl 13 · lane-suite 4 · land-durability 73 · sweep 1 · deploy-facts 23) | attention lane-risk land-provenance ctl lane-suite land-durability sweep deploy-facts |

Summe der vier Shards: 4 455 Checks gegen 4 419 im ungeshardeten Lauf; die Differenz von 36 sind
die 12 Checks der Trail-Familie, die in jedem Shard laufen (3 × 12).

**Vereinigung der Check-Namen der vier Shards (1c, 2b, 3b, 4b) gegen die Check-Menge des
ungeshardeten Laufs: 4 378 = 4 378, `comm -3` LEER — 0 fehlend, 0 zusaetzlich, gegen `deb0fa80` UND gegen den finalen Baum `1b6350c3` (M4).**
Die 12 Namen, die in mehr als einem Shard vorkommen, sind genau die Trail-Familie. Die drei Baeume
`b1beb0de` → `deb0fa80` → `1b6350c3` unterscheiden sich ausschliesslich in `e2e/watch.ts` (zwei
Namens-Templates, darum ist `deb0fa80` die Vergleichsbasis fuer die Namen) und `e2e/restart.ts`
(eine Env-Zeile, kein Name): `git diff --stat b1beb0de 1b6350c3` = 2 Dateien, +15/−5.

**5. Shard-Dauern und die vorhergesagte Wanduhr.** Seriell gemessen (Tabelle §4): core 1 239 s,
Shard 2 300 s, Shard 3 271 s, Shard 4 243 s; Summe 2 053 s gegen 2 120 s ungeshardet (die
Differenz sind vier Trail-Laeufe und die weggefallene Vorgeschichte). Die Referenzgewichte in
`SHARD_UNITS` (Trail `isolated-20260913T155454Z-52907`, vor `67c36fc8`) sind durchweg hoeher, aber
in derselben Rangfolge (M5): core 1 461 → 1 235 s im ungeshardeten Lauf, lanes 375 → 333, watch
224 → 180, verify-queue 97 → 42, deploy-facts 88 → 23.

| n | laengster Shard (seriell gemessen) | ungeshardet | Faktor |
| --- | --- | --- | --- |
| 1 | 2 120 s | 2 120 s | 1,00 |
| 2 | core 1 239 s (Rest 814 s) | 2 120 s | 1,71 |
| 4 | core 1 239 s (Rest 300 / 271 / 243 s) | 2 120 s | 1,71 |

**Vorhergesagte Wanduhr bei paralleler Ausfuehrung** (abgeleitet: max der seriellen Shard-Dauern
plus ~5 s Instanz-Start; die Second-host-Messung 2026-09-06 hat fuer zwei gleichzeitige Suiten
+0,2–0,3 % Laufzeit gemessen, also kein Lastaufschlag im Modell): **~21 min statt 35 min**, gleich
fuer n=2 und n=4. Die Owner-Erwartung „~10–15 min" erreicht n=4 NICHT — nicht wegen der Maschine,
sondern weil `core` eine Unit ist. Auf dem Second-host (ungeshardet 1 835–1 839 s = 30,6 min)
skaliert dasselbe Verhaeltnis auf ~18 min.

**6. Was `core` teilen wuerde** (nicht gemacht, ausserhalb der Flaeche). Die Kante, die programs
(613 s in Shard 1b) und tasks (257 s) an den Rest bindet, ist EIN Feld: `ctx.restartSelfTok` aus
`e2e/self-token.ts` (23 s) — plus K1 (outcomes → tasks, 49 s). Liefe self-token in jedem Shard,
der es braucht (Kosten: 23 s und 96 doppelte Check-Namen — die Vereinigung bliebe identisch),
oder muenzte programs.ts seine eigene Lane, zerfiele `core` in {slots…share, self-token, programs}
≈ 48+1+9+5+26+6+45+23+613 = 776 s und {self-token, outcomes, tasks, intake, restart, steward-core,
steward-outcomes, security, trailstats} ≈ 23+49+257+1+63+16+17+48+1 = 475 s; LPT ueber alle Units
ergaebe bei n=4 einen laengsten Shard von ~776 s (13 min), Faktor 2,7 statt 1,7 — das ist der
Schnitt, der die Owner-Erwartung erreicht. Slot 1+2 als Fixture zu oeffnen (statt slots.ts
mitzunehmen) spart dagegen nur 48 s.

**7. Eigene Instanz je Shard, RAM.** Ja, jeder Shard braucht eine eigene Server-Instanz: jede Unit
oeffnet Slots per Nummer, restart/verify-queue/deploy-facts/errors starten `srv` neu, Shard 1
toetet Slot 1+2. `e2e-isolated.sh` leitet SOCK/PORT/DIR aus `$$` ab — vier parallele Wrapper sind
fuer Socket/Port/Verzeichnis heute schon disjunkt; der Suite-Mutex (`e2e-stage.sh`) serialisiert
sie allerdings, und `maxParallelSuites` am Second-host muesste die Zahl tragen. RAM: ~250–300 MB je
Suite-Arm (2026-09-06: +224 MB fuer den zweiten Arm, Spitze 1 543 MB bei zwei Armen auf 7 858 MB),
also ~1,0–1,2 GB fuer vier Shards — auf dem Second-host tragbar; auf dem Mac nicht vorgesehen („nie
zwei gleichzeitig"), und dort hat die Harness-Speicherbremse in dieser Nacht zweimal einen bloss
WARTENDEN Wrapper getoetet (22:12, 22:59), bevor er den Mutex hatte.

**8. Flake-Familien, die auf Parallelitaet reagieren** (abgeleitet aus dem Mechanismus in
`docs/verify-tiering.md` §11, nicht hier gemessen): alle, deren Sonde eine Wanduhr-Schranke um eine
Pane-/tmux-Beobachtung legt — §11.2c (`stalled`-Fixture, `e2e/review.ts`), §11.2e (Commit-Route-
Idle-Gate), §11.2n (`settleForMerge`, `e2e/merge.ts`), §11.2u/Notiz `b55059a1` (Pane stirbt statt
langsam zu malen — Signatur von Speicherdruck, `e2e/programs.ts`), §11.2v (s2-Pane-Trias,
`e2e/slots.ts`), §11.2b (Reseed + Live-Bytes), dazu die Composer-Sonden in `e2e/watch.ts` (§3, der
Flake dieser Nacht). Sharding aendert zweierlei: parallel steigt die Last je Sonde, aber jede Sonde
sieht eine Instanz mit WENIGER Vorgeschichte (Shard 2–4 hatten je 5–13 Server-Boots weniger vor
sich) — welcher Effekt ueberwiegt, ist eine Messung, die dieser Schnitt nicht faehrt.

## Methode

- **M1 Reihenfolge-Beweis:**
  `diff <(git show 1e2a25d2:fleet-e2e.ts | grep -o 'await [a-zA-Z]*\.run(') <(grep -o 'await [a-zA-Z]*\.run(' fleet-e2e.ts)`
  → einzige Differenz `> await step.run(`.
- **M2 Ctx-Kanten:** `for f in $(grep -l 'from "./ctx"' e2e/*.ts); do grep -o 'ctx\.[a-zA-Z]*' $f | sort -u; done`.
- **M3 Server-Zustand:** `grep -n '"/api/slots/[12]/open"' e2e/*.ts` (nur slots.ts und vier
  400-Erwartungen in steward-outcomes.ts); `grep -n '"/api/slots/[123]/kill' e2e/*.ts`;
  `grep -n 'slots/2/' e2e/*.ts` fuer die Negativkontrollen.
- **M4 Vereinigung:** je Log `grep -E '^(PASS|FAIL)  '`, Name = Text bis zum ersten `  (`,
  `sort -u`; Shards vereinigt mit `sort -u`, Vergleich `comm -3` gegen den ungeshardeten Lauf.
  Kontrolle: die Namen aus dem Log stimmen mit dem `check`-Feld der Trail-Datei ueberein (4 378 = 4 378).
- **M5 Unit-Gewichte:** Skript `modtime.ts` (Scratchpad): literale Check-Namen je Modul aus
  `check("…"`/`` check(`…` `` gesammelt, Trail-Zeilen in Reihenfolge durchlaufen, `msSincePrev`
  je Modul summiert; Zeilen ohne literalen Treffer (275 von 4 384 im Referenz-Trail, 272 von 4 419
  im ungeshardeten Lauf) erben das Modul der Vorgaengerzeile — die Reihenfolge im Trail IST die
  Modulreihenfolge.
- **Laeufe:** detachte Ketten (`nohup`, doppelter Fork) aus dem Lane-Worktree, weil die
  Harness-Hintergrundverwaltung wartende Wrapper unter Speicherdruck toetet; Runner-Dauer aus
  `shard-unit`-Zeilen bzw. Trail-Spanne (erste bis letzte `ts`).

## Was nicht gemessen wurde

- Kein paralleler Lauf; die Wanduhr ist max(serielle Shard-Dauern), der Lastaufschlag aus der
  Zwei-Suiten-Messung 2026-09-06 uebernommen, nicht fuer vier Arme gemessen.
- Ein gruener Lauf je Shard: Flake-Basisraten der Shards sind nicht erhoben; ein Rot in einem
  Shard ist nach der Regel „erst denselben Baum erneut" zu behandeln, nicht als Sharding-Regress.
- Die Referenzgewichte stammen vom Baum VOR `67c36fc8`; die Rangfolge stimmt (§5), die Zahlen sind
  15–75 % hoeher als heute.
- Ob ein Modul auf einen weiteren ungenannten Zustand baut, ist nur so weit widerlegt, wie die
  vier Shards gruen sind (K1–K5 zeigen, dass die Karte allein nicht reicht).

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-13T19:55:00Z	karte	Slot 1+2 als Server-Zustands-Kante gefuehrt, slots-Familie in core	einzige Oeffner slots.ts, Leser bis restart.ts	e2e/slots.ts, e2e/restart.ts	core = 16 Module
2026-09-13T19:56:00Z	design	Schrittliste in Originalreihenfolge statt Unit-Reihenfolge	Default muss bytegleich bleiben	fleet-e2e.ts	M1 diff-leer
2026-09-13T19:57:00Z	baseline	ungeshardeter Lauf als Command-Job zum Second-host	Suite-Offer/Daemon tragen kein Shard-Argument	POST /api/self/jobs c2dc827e62d3	gruen, 1 839 s, aber Artefakte nur als Metadaten
2026-09-13T20:10:00Z	K1	outcomes in core	tasks.ts liest das bestaetigte Program	e2e/tasks.ts Kommentar	4d1465fd
2026-09-13T20:58:00Z	fehler	Schritt-Unit-Name nicht mitgezogen, Startup-Check nach 1 546 s Schlange	Tabelle und Runner ohne Pin	c0f476e6	Pin ergaenzt
2026-09-13T21:02:00Z	laeufe	detachte Kette statt Harness-Hintergrund	Speicherbremse toetete wartende Wrapper 2x	chain.sh	Shard 1–4 + Baseline seriell
2026-09-13T21:27:00Z	K2/K3	Basisfixture Slot 1+2 nur im Shard ohne core; plogRead ohne Datei = []	Negativkontrollen und Baton-Sektion	b1beb0de	2b/3b/4b gruen
2026-09-13T22:10:00Z	namen	zwei Watch-Checknamen auf Ordinal	Slot-Id im Namen ist Allokationsartefakt	deb0fa80	8 Namen ohne Register-Historie
2026-09-13T22:47:00Z	K5	FLEET_STEWARD_MIN_IDLE_MS in restart.ts#cmdEnv	2/2 rot im Shard, 736/736 gruen in Vollaeufen; Env-Liste handgepflegt	1b6350c3	Shard 1c gruen (2 535 / 0)
2026-09-13T22:48:00Z	vorfall	Live-Server (pid 70255) ueber die PID aus /tmp/fleet-e2e.lock/pid beendet, ohne Identitaet zu pruefen	fuer den eigenen Baseline-Wrapper gehalten; der Server hielt per holdSuiteLock	server.log 00:48:05 „[watchdog] srv was down, restarted"	Watchdog-Neustart nach ~2 s; Push an Owner; welcher Land-Hold abbrach, ist aus der Lane nicht lesbar
2026-09-13T22:49:00Z	laeufe	keine weiteren Kills; 1c und finale Baseline hinter die verwaiste Baseline gehaengt	Null-Risiko vor Zeitersparnis	chain5.sh	Deadlock: chain5 wartete auf eine exit=-Zeile, deren Schreiber (chain4) ich selbst beendet hatte — 5 h ohne Suite, von der MAIN um 06:06 gemeldet
2026-09-14T04:06:00Z	laeufe	chain5 ueber die eigene PID beendet, 1c + finale Baseline neu gestartet	Identitaet geprueft: /bin/sh, ppid 1, pgrep-Treffer	chain6.sh	1c gruen 06:27; Baseline gruen 07:06 (4 419 / 0, 2 122 s); Vereinigung gegen sie ebenfalls diff-leer
```

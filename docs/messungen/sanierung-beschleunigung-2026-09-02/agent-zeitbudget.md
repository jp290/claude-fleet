# Suite-Mutex-Zeitbudget der Generalsanierung, 2026-08-31 00:00 – 2026-09-02 ~14:40 Europe/Berlin

Messagent, read-only. Snapshot der Ledger: 2026-09-02 ~14:45 (`post-land-audits.jsonl` 419 Zeilen,
`lane-outcomes.jsonl` 704, `audit.jsonl` 33 792, `e2e-trail/` 5319 Dateien).
Ableitungsskript: `zeitbudget.py` daneben — jede Zahl unten nennt ihren Abschnitt.

## 0. Was "Mutex" hier heisst, und warum `ms` nicht dasselbe ist

Alle sieben Suite-Wrapper sourcen `e2e-stage.sh`; der Lock wird DORT genommen
(`e2e-stage.sh:73` `FLEET_SUITE_LOCK="${FLEET_SUITE_LOCK:-/tmp/fleet-e2e.lock}"`, `:93` `while ! mkdir …`,
`:148` `[suite-lock] … acquired after Ns`). Sourcen = Suite starten = Lock halten.

Daraus drei Groessen, die getrennt bleiben muessen:

- **deklarierte `ms`** einer Audit-Zeile *enthaelt* die Wartezeit vor dem Lock.
- **Mutex-HALTEN** = `audit.at − runid-Zeitstempel des zugehoerigen Trail-Laufs`. Die run-id wird
  vergeben, NACHDEM `e2e-stage.sh` den Lock hat und gestaged ist (`docs/e2e-trail.md` §2/§3).
- **Lock-Warten** = `runid-Zeitstempel − audit.startedAt`.

Verprobt: Audit `09-02 08:16:31` hat `lockwait=733 s`; der Halter davor ist der Vorschaulauf
`isolated-20260902T051948Z-41238` (07:19:48 .. 07:48:11), der Audit-Trail beginnt 07:48:20 —
9 s spaeter. Der Mutex ist real und seriell.

**Gegenprobe auf Ueberlappung** (`zeitbudget.py`, Abschnitt 1 + Ad-hoc-Union): ueber alle 297
Trail-Laeufe seit 08-31 betraegt die Summe der Ueberlappungen aufeinanderfolgender Intervalle
**16,3 min** — davon 15,4 min die eine bekannte Stelle (drei gleichzeitige `isolated`-Laeufe am
09-02 07:32:52/07:33:07/07:33:07, alle nach <1 min tot, `n=22` Checks). Die Serialisierung haelt.

Fuer den Land-Gate gilt dieselbe Trennung, dort schon im Ledger: `verify.ms` ist Gesamt,
`verify.waitMs` die Schlangenzeit. **Arbeit = `ms − waitMs`** (verprobt: Lands mit `waitMs=0`
liegen bei 96–132 s Gesamt; `79acd2e8` hat `ms=2 454 029`, `waitMs=2 313 000` → 141 s Arbeit).

## (a) Tabelle — Minuten Mutex je Tag und Kategorie (Anzahl in Klammern)

| Kategorie | 2026-08-31 | 2026-09-01 | 2026-09-02 (bis 14:40) |
|---|---|---|---|
| Gate-Arbeit (`verify.ms − waitMs`) | 3,4 min (4) | 20,8 min (12) | 20,8 min (11) |
| Gate-Warten (`verify.waitMs`) — **kein Verbrauch, Aushungern** | 0,0 min (4) | 26,8 min (12) | **200,2 min (11)** |
| Audit gruen | 50,7 min (2) | 51,7 min (2) | 141,1 min (5) |
| Audit rot | 25,2 min (1) | 105,3 min (9) | 65,6 min (4) |
| Audit unknown-Wand | 0,0 min (1) | 15,3 min (1) | 58,8 min (2) |
| Audit unknown-nie-gelaufen | — (0) | 0,0 min (1) | 0,0 min (5) |
| Reruns/Beweislaeufe | 25,2 min (1) | 0,0 min (0) | 56,3 min (2) |
| Vorschau in Lanes | **311,9 min (12)** | **745,6 min (31)** | **422,8 min (18)** |
| *(zusaetzlich, nicht in der Vorgabe)* Gate-Ketten am Mutex, Trail-Spanne aller `clean-review`/`security`/`claude-gate`-Wrapper | 15,0 min (66) | 44,9 min (192) | 58,4 min (197) |
| *(zusaetzlich)* `./e2e-postland-audit.sh` | — (0) | 6,3 min (2) | 7,3 min (2) |
| **SUMME Mutex (ohne Gate-Warten, Gate-Arbeit als Wrapper-Spanne gezaehlt)** | **429,5 min** | **973,1 min** | **805,5 min** |
| **Gegenprobe: verschmolzene Union der Trail-Intervalle** | **429,6 min** | **943,6 min** | **841,5 min** |
| **Anteil "rot + unknown + Rerun" an der Tagessumme** | 50,4 = **11,7 %** | 120,6 = **12,4 %** | 180,7 = **22,4 %** |

Lesehinweise, ohne die die Tabelle falsch gelesen wird:

1. **`Gate-Arbeit` ist NICHT ganz Mutex.** Die Kette hat sieben Schritte
   (`install pins tsc build clean-review security claude-gate`, aus `verify.steps` jeder Land-Note);
   nur die letzten drei sourcen `e2e-stage.sh`. Darum steht die Wrapper-Spanne als eigene Zeile und
   geht in die SUMME ein, nicht die 20,8 min.
2. **`Gate-Warten` gehoert nicht in die Summe** — es ist Zeit, in der der Gate NICHTS tut, weil ein
   anderer haelt. Es ist trotzdem die zweitgroesste Zahl des 09-02.
3. **Audit-Zeilen mit `remote:{name:"second-host"}` verbrauchen 0 min lokalen Mutex.** 09-01: 5 Zeilen /
   112,4 min deklariert; 09-02: 2 Zeilen / 46,6 min. Sie belegen die Audit-SCHLANGE (`drainPostLandAudits`
   startet die naechste erst nach der vorigen), nicht die Maschine.
4. **Auslastung:** Fenster erster..letzter Suite-Lauf je Tag — 08-31 07:24:39..23:41:22 (977 min, Union 429,6
   → 44 %), 09-01 00:04:26..00:29:27 (1465 min, Union 943,6 → 64 %), **09-02 00:29:47..14:40:24 (851 min,
   Union 841,5 → 98,9 %)**. Der 09-02 ist bis auf ~10 Minuten durchgehend belegt.
5. Summe-vs-Union weichen am 09-01 um 29,5 min (3,0 %) ab (Intervalle, die sich im Trail ueberlappen);
   die Union ist die konservative Tageszahl.

### Die Owner-Hypothese, quantifiziert

> "die Hauptdauer heute kam von einer Reihe fehlerhafter Suites"

**Teilweise bestaetigt, aber nicht als Hauptposten.** Am 09-02:

- Enge Lesart (rot + unknown-Wand + Rerun): **180,7 min von 805,5 = 22,4 %**.
- Weite Lesart, jeder `./e2e-isolated.sh`-Vorschaulauf mit mindestens einem FAIL zaehlt mit:
  8 Laeufe / 188,5 min, plus Audit rot 65,6 + unknown-Wand 58,8 + Rerun 56,3 = **369,2 min = 45,8 %**
  (die 56,3 min Rerun sind darin nicht doppelt: die zwei zitierten Reruns liefen 0 FAIL).
- **Der groesste Einzelposten bleibt "Vorschau in Lanes": 422,8 min = 52,5 % des Tages**, in 18 Laeufen.
  Zusammen mit den 2 Reruns sind es 479,1 min = 59,5 % — mehr als das Doppelte aller lokalen Audits
  (265,6 min Haltezeit, 9 Zeilen).

**Zweiter, unabhaengiger Befund, der die Hypothese praeziser macht: die Suite ist am 09-02 messbar
langsamer geworden, nicht fehlerhafter.** Millisekunden je Check (Mutex-Haltezeit / `checks.ran`,
`zeitbudget.py` Abschnitt "SUITE-LAUFZEIT-DRIFT"):

| Tag | ms/Check (lokale claude-fleet-Audits) |
|---|---|
| 08-31 | 454, 453, 457 |
| 09-01 | 457, 457, 473, 490, 461, 459, 458 |
| 09-02 | 506, 455, **596**, **692**, 473, 548, 494, 479, **675** |

Die Check-ZAHL waechst nur von 3333 auf 3443 (+3,3 %), die Dauer von 25,2 auf 38,7 min (+54 %).
**Beide `unknown-Wand`-Zeilen des 09-02 sind direkte Folge dieser Drift**: sie liefen 3010 bzw. 2508
Checks fehlerfrei durch (3 FAILs, aber keine Abbruchursache) und wurden bei 30 min gekillt — bei der
Rate vom 08-31 waeren sie in ~23 min fertig gewesen. Die Wand stand bei diesen zwei Zeilen noch auf
`1800000` (die Reason-Zeile sagt es woertlich), obwohl `watchdog.sh:155` seit `64c05bf` (09-02 03:55)
`FLEET_POSTLAND_AUDIT_TIMEOUT_MS=2700000` setzt — der srv-Restart, der das aktiviert, kam erst um
04:24:23 (`deploy 1425522f`, audit.jsonl). Der laufende Server las noch den Default
(`server.ts:12200` `?? 1_800_000`).
Eine Korrelation mit der Zahl offener Slots ist NICHT nachweisbar (9–14 Slots ueber alle drei Tage;
11 Slots → 30,0-min-Wand, 14 Slots → 25,6-min-gruen).

### Korrektur der Vorgaengerzaehlung fuer 2026-09-02

Die Zaehlung "16 Audits, alle lokal, 326 min Mutex" (`docs/messungen/denksession-zusammenarbeit-2026-09-02.md`
und der Handoff-Auftrag) stimmt in der ZEILENZAHL und sonst in keinem Punkt:

| Behauptung | Gemessen |
|---|---|
| 16 Audits | 16 Audit-ZEILEN, ja |
| alle lokal | **9 lokal claude-fleet · 2 remote second-host (claude-fleet) · 4 lokal private-repo-p · 1 remote private-repo-p** |
| 326 min Mutex | **265,6 min** Mutex-Halten (lokal claude-fleet); deklarierte `ms` derselben 9 Zeilen: 279,8 min. Die 326 min entstehen nur, wenn man alle 16 Zeilen inkl. remote und private-repo-p addiert |
| 5 gruen ~28 min | 5 gruen, aber Haltezeiten 28,6 / 25,7 / 31,2 / 28,2 / 27,5 = **141,1 min**, Mittel 28,2 min |
| 4 rot | 4 rote Zeilen, davon **2 remote** (0 min lokaler Mutex). Lokal rot: 26,9 + 38,7 = **65,6 min** |
| 2 unknown an der 30-min-Wand | bestaetigt, 29,9 + 28,9 = 58,8 min Halten |
| 5 unknown mit ~0 ms | bestaetigt — **alle fuenf sind repo=private-repo-p**, siehe (b) |

## (b) H5 — jede `unknown`-Zeile mit ~0 ms, mit Ursache

Alle Ursachen aus `out` + `exitCode` + `repo` derselben Zeile; `cmd` ist der `AUDIT_CMD` aus
`watchdog.sh:108`, dessen erste Klausel `[ -f fleet-e2e.ts ] || { echo "audit skipped: not the fleet
repo"; exit 42; }` lautet.

1. **2026-09-01 22:01:32, 85 ms, exit 42** — `repo=/Users/owner/private-repo-p`, `main@f1555201`,
   Lane `fleet/260831143421-06eb`. `out` = woertlich `audit skipped: not the fleet repo`. Ursache:
   private-repo-p hat kein `fleet-e2e.ts`, die erste Klausel des Audit-Kommandos greift. Der zugehoerige
   Land steht als `land_actor` `private-repo-p … slot=3 program=07ee8a6dee2b36d11203db2b` in `audit.jsonl`
   um 22:01:31. **Kein Fehler, kein Mutex, keine Sanierungsarbeit.**
2. **2026-09-02 01:15:34, 90 ms, exit 42** — private-repo-p, `main@91e6a774`, Lane `fleet/260901215805-c384`;
   `out` identisch. Gleiche Ursache. Land-Zeile 00:55:54.
3. **2026-09-02 04:23:38, 217 ms, exit 42** — private-repo-p, `mainSha=cee2ed0a`, `covers[0].mainAfter=889d5852`
   (die beiden weichen ab: der Audit misst den Tip, die cover-Zeile das gelandete Ergebnis), Lane
   `fleet/260902012023-8ce8`; `out` identisch. Land-Zeile 04:15:35.
4. **2026-09-02 06:37:59, 108 ms, exit 42** — private-repo-p, `mainSha=30def005`, `covers.mainAfter=e6cdf617`,
   Lane `fleet/260902034932-1e59`; `out` identisch. Land-Zeile 06:28:16.
5. **2026-09-02 11:04:13, 223 ms, exit 42** — private-repo-p, `main@a4f8f083`, Lane `fleet/260902070540-dfdb`;
   `out` identisch. Land-Zeile 11:04:13.
6. **2026-09-02 12:14:28, 92 ms, exit 127, `remote:{name:"second-host"}`** — private-repo-p, `main@466f318f`,
   Lane `fleet/260902090528-3713`. `out` = `bun install --frozen-lockfile failed (exit 1)\nerror: Bun
   could not find a package.json file to install from\nnote: Run "bun init" to initialize a project`.
   Ursache: der Second-host-Helfer bekam eine Audit-Arbeit fuer ein Repo, das er nicht ausgecheckt hat;
   sein Arbeitsverzeichnis hatte keine `package.json`. Ebenfalls 0 min lokaler Mutex.

**Befund H5: keine der sechs Zeilen ist ein Deploy-Kill, ein srv-Restart, eine Helfer-Grace oder ein
ausgelaufener Mutex-Wait.** Alle sechs sind private-repo-p-Lands, deren Repo den Fleet-Audit strukturell
nicht fahren kann; die Ablehnung ist ehrlich und kostet 85–223 ms. Sie sind Rauschen in der ZAEHLUNG,
kein Zeitverlust.

**Aber es gibt eine siebte Zeile, die genauso aussieht und etwas anderes ist** — und die in der
Vorgaengerzaehlung fehlt, weil sie am 08-31 liegt:

- **2026-08-31 21:33:43, `ms=1 800 356`, `result=unknown`, `reason="audit timed out after 1800000ms —
  no verdict"`, `repo=claude-fleet`, `main@2cd464b7`** — es gibt **keinen Trail-Lauf** in
  `$TMPDIR/fleet-e2e-trail` in ihrem Fenster (21:03:43..21:33:43). Grund: der Mutex war durchgehend
  fremd gehalten — `isolated-20260831T184547Z-29549` bis 21:12:59 und `isolated-20260831T191305Z-82534`
  ab 21:13:05 bis 21:39:24. Der Audit hat den Lock **nie bekommen** und wurde an der 30-min-Wand
  getoetet, ohne einen einzigen Check zu messen. **Mutex-Verbrauch: 0 min. Erkenntnisgewinn: 0.**
  Das ist eine dritte, im Ledger nicht unterscheidbare Art von `unknown` ("ausgehungert, nie gemessen"),
  die sich wie "30 min gelaufen und gekillt" liest.
  Die 09-01-18:44:47-Zeile ist der Mischfall: 883 s ausgehungert, dann 15,3 min gehalten (1990 Checks,
  0 FAIL), dann gekillt.

## (c) Was NICHT ableitbar war

- **Die tatsaechliche Lock-Haltezeit ist eine UNTERGRENZE.** `e2e-stage.sh` nimmt den Lock vor dem
  Staging; der Trail beginnt erst beim ersten `check()`. Staging + Server-Boot + Teardown je Lauf
  (~20–60 s, nicht vermessen) fehlen in jeder Spannen-Zahl. Bei ~70 Wrapper-Laeufen pro Tag sind das
  grob ~25–70 min/Tag, die niemand im Ledger sieht. Ich habe sie NICHT addiert.
- **Die drei remote-Audits am 09-02 (und fuenf am 09-01) haben keinen abrufbaren Trail und keine
  `checks`** (`checks:null`, `out` ist Tail-Kappe). Ihre 46,6 bzw. 112,4 min sind Wanduhr AUF DEM
  HELFER; wie viel davon dort Warten war, ist von hier nicht messbar. Die Adjudikationen im
  `audit.jsonl` nennen sie deshalb siebenmal `unknowable`.
- **"Vorschau in Lanes" ist nicht nach Program aufgetrennt.** Der Trail traegt `tree` (Commit-SHA)
  und `dirty`, aber kein Program-, Task- oder Slot-Feld. Ich kann daher NICHT sagen, welcher Anteil der
  311,9 / 745,6 / 422,8 min auf `b2a14b545fd31fd71ba7b9e1` (Generalsanierung) entfaellt und welcher auf
  `66499a038db3393f8a2228e1` oder andere Lanes desselben Repos. Die Zahl ist "alle
  `./e2e-isolated.sh`-Laeufe im claude-fleet-Baum", nicht "Sanierung".
- **Die Zuordnung Vorschaulauf → Rerun ist konservativ**: als "Rerun/Beweislauf" gilt nur ein Lauf,
  dessen run-id woertlich in einem `postland_audit`-Adjudikationstext in `audit.jsonl` steht. Das sind
  drei (08-31 `isolated-20260831T130226Z-19136`, 09-02 `isolated-20260902T064422Z-62019` und
  `isolated-20260902T105017Z-87425`). Die Adjudikation vom 09-02 05:29:44 zitiert einen Rerun nur ueber
  seine Uhrzeit ("gleicher Baum seriell 3416/0 ALL PASS (05:01-05:28)") — das ist
  `isolated-20260902T030148Z-69547`, aber weil die id nicht dasteht, zaehlt er hier als "Vorschau".
  Die Rerun-Zeile ist also um mindestens 26,7 min zu klein und die Vorschau-Zeile um denselben Betrag
  zu gross.
- **Die Zuordnung Trail-Wrapper → Land-Gate ist unscharf**, wenn ein Gate lange in der Schlange stand:
  fuer `87c5be66` fielen 31 Wrapper-Trails in sein 32,5-min-Fenster, obwohl seine eigene Kette nur 6
  hat. Deshalb steht in der Tabelle die Wrapper-Spanne ALLER Gate-Ketten (Server-Land plus lane-lokal)
  als eine Zahl und nicht als Aufteilung.
- **`lane-outcomes.jsonl` traegt keine Suite-Zeit.** Die 673 Zeilen mit `disposition` haben
  `sessionMs`/`e2eTouched`/`verified`, aber kein Verify- oder Suite-Zeitfeld; die 31 Zeilen mit `verify`
  sind `origin:"main-direct"`-Saetze mit `{cmd, ok, tail}` und ohne `ms`. Die Gate-Zeiten stammen
  ausschliesslich aus `git notes --ref=fleet/land`. Von 96 main-Commits seit 08-31 tragen **27** eine
  solche Note — die uebrigen 69 sind Direkt-Commits aus dem Haupt-Checkout und fuer jedes land-seitige
  Ledger unsichtbar (`CLAUDE.md`, Abschnitt "Direkt-Commit"). Deren Verifikation, falls von Hand
  gefahren, ist in KEINER dieser Zahlen enthalten.
- **Kein Adjudikations-Ereignis traegt eine Dauer.** `postland_audit`-Zeilen mit `adjudicated …` sind
  Zeitpunkte; die Arbeitszeit des adjudizierenden Menschen/Agenten ist nicht messbar.
- Der Tag 09-02 ist **unvollstaendig** (Schnitt 14:40); 08-31 beginnt um 07:24 mit dem ersten Trail-Lauf
  des Tages, was aber nicht heisst, dass davor nichts lief — nur, dass es nicht getrailt wurde.

## (d) Herkunft jeder Zahl

| Zahl | Erzeugt von |
|---|---|
| Audit-Zeilen, `result`, `ms`, `exitCode`, `out`, `remote`, `repo` | `zeitbudget.py` Abschnitt 2 (`AUD`), Ausgabe `=== AUDITS ===` |
| Feldnamen der drei Ledger | `python3` + `collections.Counter` ueber alle Keys; `post-land-audits.jsonl` 14 Keys / 419 Zeilen, `lane-outcomes.jsonl` 40 Keys / 704 Zeilen (zwei Satzformen), `audit.jsonl` 4 Keys / 33 792 Zeilen, 52 `event`-Werte |
| Mutex-Halten und Lock-Warten je Audit | `zeitbudget.py` Abschnitt 2, `_trail`/`_lockwait_ms`/`_hold_ms` (Join Audit-Fenster ↔ `$TMPDIR/fleet-e2e-trail`-run-id) |
| Gate-Arbeit / Gate-Warten | `zeitbudget.py` Abschnitt 3 `land_notes()` = `git -C <repo> log --since=2026-08-31T00:00:00+02:00 --format=%H main` je SHA `git notes --ref=fleet/land show`, Felder `verify.ms` / `verify.waitMs`; Ausgabe `=== LAND-GATES ===` |
| Vorschau-/Rerun-Laeufe, Spannen, FAIL-Zahlen, `tree`/`dirty` | `zeitbudget.py` Abschnitt 1 `scan_trail("e2e-trail")`, Ausgabe `=== HOST-VORSCHAU/RERUN ===` |
| Rerun-Erkennung | `zeitbudget.py` Abschnitt 4, `t["runid"] in ADJ_TEXT`, `ADJ_TEXT` = alle `detail`-Felder der `postland_audit`-Ereignisse aus `audit.jsonl` |
| Gate-Ketten-Spanne, `postland-audit`-Wrapper | Ad-hoc-Aggregation ueber `e2e-trail/*.jsonl` nach Wrapper-Familie (Ausgabe im Bericht oben; identische Logik wie `scan_trail`) |
| Ueberlappungs-Gegenprobe 16,3 min und die Tages-Union | Ad-hoc-Skript: alle Trail-Intervalle `[runid-ts, letzter check-ts]` sortiert, Nachbarvergleich + Intervall-Merge |
| ms/Check-Drift | `zeitbudget.py`, Ausgabe `=== SUITE-LAUFZEIT-DRIFT ===` (`_hold_ms / checks.ran`) |
| Slot-Zahl je Audit-Start | Ad-hoc: `slot_open`/`slot_kill` aus `audit.jsonl` als Mengenoperation bis zum Zeitpunkt |
| Timeout-Konstanten | `server.ts:12200` (`?? 1_800_000`), `watchdog.sh:155` (`FLEET_POSTLAND_AUDIT_TIMEOUT_MS=2700000`, `FLEET_VERIFY_TIMEOUT_MS=480000`, `FLEET_VERIFY_WAIT_MS=2700000`), `watchdog.sh:108` (`AUDIT_CMD`), `.env:15` (`FLEET_AUDIT_HELPER_GRACE_MS='0'`) |
| Lock-Mechanik | `e2e-stage.sh:73`, `:93`, `:146`, `:148` |
| Trail-Format und -Ort | `docs/e2e-trail.md` §2, §3 |
| Deploy-Zeitpunkte, Land-Akteure, Adjudikationen | `audit.jsonl`, Ereignisse `deploy` (32), `land_actor` (33), `self_land_start` (38), `postland_audit` (42) seit 08-31 |

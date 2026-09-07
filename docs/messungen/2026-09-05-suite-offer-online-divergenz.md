---
frage: Woher nimmt `GET /api/self/suite-offer` seinen `online`-Wert, woher der Post-Land-Audit-Zuteilungspfad seinen — und wo divergieren sie, nachdem am 2026-09-05 14:06 die Offer-Tuer `online:false / lastSeenAgeMs 390552` meldete, waehrend derselbe Helfer laufend Audits fuhr?
urteil: Es gibt keine zwei Uhren. Beide Pfade lesen dieselbe und einzige `HelperDevice.lastSeen`, gestempelt allein von `POST /api/helper/device`; die Offer-Tuer liest sie als Punktfrage vor dem Minten, und der Audit-Pfad liest sie fuer die REMOTE-Zuteilung ueberhaupt nicht (Pull-Queue, jederzeit claimbar). Die Divergenz war ein DAEMON-Defekt: bis `84c16f2` (2026-09-06 20:43) stand `await work(cfg, open)` im `tick()`, also schwieg der Heartbeat fuer die volle Suite-Laufzeit — am 2026-09-05 von 14:01:14 bis 14:31:03 (1789 s um einen 1768-s-Lauf). `online:false` war RICHTIG gemessen, die Behauptung „der Daemon pollte alle 15 s" war falsch. Am heutigen HEAD besteht die Divergenz nicht mehr, A/B auf demselben Geraet in derselben Nacht belegt es. Was bleibt, ist teurer als die Divergenz war: `SUITE_OFFER_WAIT_HELD_MS` = 800 s steht gegen eine gemessene Fern-Laufzeit von p50 1448 s / p90 2101 s (68 von 75 Laeufen ueber 800 s), und 6 von 26 geclaimten Vorschauen sind an genau diesem Deckel abgebrochen worden, waehrend der Helfer noch 10–25 min weiterrechnete
bereich: [multi-host, helper-daemon, helper-portal, suite-kontention, verify]
belege: [server.ts#helperPresence, server.ts#helperClaimCandidateExists, server.ts#drainPostLandAudits, 'helper-daemon/daemon.ts#tick', 'helper-daemon/daemon.ts#start', 84c16f206c731a11b65059b35674d9609d805512, d923ab8e29fb9a617fcbddd10a60fd98139e7cc8, docs/messungen/2026-09-06-second-host-parallel-suiten.md]
nicht-gemessen: Ob `AUDIT_HELPER_GRACE_MS` (60 s) gegen `HELPER_FRESH_MS` (45 s) je eine Zuteilung gekostet hat; ob ein zweites Helfer-Geraet die `helperPresence`-Wahl des FRISCHESTEN Geraets je falsch machen wuerde; die Lane-Seite der 800-s-Aufgabe (die Wartelogik lebt in der Pane, nicht im Server, und ist hier nicht instrumentiert)
stand: 2026-09-07
---

# Die Offer-Tuer sah den Helfer nicht, der Audit-Pfad schon

Gemessen am 2026-09-07 02:4x–02:5x aus Lane `fleet/260907024235-cdd0` (Slot 1), Quellen: der
`journalctl -u fleet-helper` des Geraets `secondhostlinux1` (ssh, lesend), `audit.jsonl` des
Live-Servers, und der Code an `HEAD = a1f8b65`. Der Befund, den diese Notiz prueft, stammt vom
2026-09-05 14:06 (Controller Slot 12).

## 1. Was der Befund behauptete — und was davon stimmt

| Behauptung | Befund |
|---|---|
| `GET /api/self/suite-offer` meldete `online:false`, `lastSeenAgeMs 390552` | **stimmt**, und der Wert war korrekt gemessen |
| „der Second-host-Daemon pollte laut Controller alle 15 s" | **falsch** — er schwieg von 14:01:14 bis 14:31:03 |
| „das Angebot fand keinen Helfer" | **falsch** — das Angebot wurde 14:00:59 gemintet und 14:01:17 vom Second-host geclaimt |
| „Slot 1 fuhr `./e2e-isolated.sh` lokal und hielt den Mutex" | **stimmt**, aber die Ursache ist eine andere (§5) |

Die Zeitachse aus `audit.jsonl` (Feld `ts`, Europe/Berlin):

```
14:00:59  helper_claim    offered the preview suite of claude-fleet fleet/260905114820-f746 to the portal
14:01:17  helper_claim    second-host claimed the preview suite of … @d83e5020 tree c0149974
14:15:16  helper_result   abandoned the preview offer of … while second-host held it
```

…und aus dem Journal des Geraets (`suite finished … in 1768s`, Ergebnis mit HTTP 409 abgewiesen):

```
14:01:14  req POST /api/helper/device      ← letzter Heartbeat vor der Stille
14:01:17  claimed lane-suite … → run-8d7afe530bcb-…
14:30:47  suite finished exit=1 timedOut=false in 1768s
14:30:48  reported 8d7afe530bcb … → 409 no live claim for this preview — it lapsed, was withdrawn, or was already reported
14:31:03  req POST /api/helper/device      ← erster Heartbeat danach
```

Zwischen 14:01:14 und 14:31:03 liegen **1789 s ohne einen einzigen Heartbeat**. Das Fenster, in
dem `helperPresence()` ein Geraet als anwesend liest, ist `DEVICE_ONLINE_MS` = 90 s. Um 14:06 war
die Lesung also richtig: das Geraet war seit Minuten stumm.

## 2. Die zwei Lesungen im Code — es ist EINE Uhr

Der einzige Stempel auf `HelperDevice.lastSeen` ist `POST /api/helper/device`
(`server.ts`, Route `/api/helper/device` → `setHelperDevice`) plus vier Claim-Pfade, die die Zeile
nur **beruehren**, wenn sie schon existiert. `GET /api/helper/jobs` stempelt NICHT — der Job-Poll
ist ein reiner Leser.

| Pfad | Lesung | Fenster | Zeitpunkt | Wirkung |
|---|---|---|---|---|
| Offer minten (`POST /api/self/suite-offer`) | `helperPresence()` — frischestes `lastSeen` | `DEVICE_ONLINE_MS` = 90 s | genau wenn die Lane fragt | bei `false`: `offer:null, reason:"no helper online"` |
| `GET /api/self/gate`, `GET /api/self/suite-offer` | dieselbe `helperPresence()` | 90 s | bei jeder Frage | nur Anzeige |
| Audit **remote** zuteilen | **keine Praesenzlesung** | — | — | die Zeile steht offen in `helperJobsView`, der Daemon claimt, wann immer er wiederkommt |
| Audit **lokal** drainen (Grace) | `helperClaimCandidateExists()` — dasselbe `lastSeen` plus Owner-Wunsch plus Geraete-Mode | `HELPER_FRESH_MS` = 3 × 15 s = 45 s | je Drain-Durchlauf | verzoegert den LOKALEN Lauf um bis zu `AUDIT_HELPER_GRACE_MS` = 60 s |

Beide Praesenzlesungen lesen denselben Zeitstempel. Sie unterscheiden sich nur im Fenster, und zwar
in die **entgegengesetzte** Richtung zum Befund: die Offer-Seite ist mit 90 s die groszuegigere.
Eine Divergenz „Audit sieht ihn, Offer nicht" kann daraus nicht entstehen.

**Der Divergenzpunkt ist nicht ein zweiter Wert, sondern eine nicht gestellte Frage.** Die
Remote-Zuteilung eines Audits ist reines Pull: `recordLand` legt die Zeile in `auditQueue`,
`helperJobsView` zeigt sie, und der Daemon nimmt sie, sobald er wieder da ist. Ob er gerade
anwesend ist, fragt dabei niemand. Darum stand im `server.log` weiter
`POST-LAND AUDIT RED (remote, second-host)`, obwohl die Uhr des Geraets stillstand: die Zeilen wurden
in den Wachfenstern ZWISCHEN den Laeufen geclaimt. Die Offer-Tuer dagegen ist seit `d923ab8`
(2026-09-04, einen Tag vor dem Befund) eine Punktfrage — sie hat den Defekt nicht erzeugt, sie hat
ihn **sichtbar gemacht**.

## 3. Warum die Uhr stillstand

Bis `84c16f2` (2026-09-06 20:43, „der Daemon ZAEHLT parallele Suiten, statt Last zu messen") endete
`tick()` in `helper-daemon/daemon.ts` so:

```ts
const open = (list.jobs ?? []).find((j) => !j.claim && !j.localRunning);
if (open) await work(cfg, open);
```

Der Heartbeat steht am ANFANG von `tick()`; die Schleife in `main()` ist
`for (;;) { await tick(cfg, st); await Bun.sleep(pollSec * 1000); }`. Ein `await` auf einen
30-Minuten-Suite-Lauf haelt also den naechsten Heartbeat 30 Minuten auf. `84c16f2` ersetzte die
Zeile durch einen nicht erwarteten Start:

```ts
for (const j of open) start(cfg, j);   // start() ruft `void work(...)` und kehrt sofort zurueck
```

## 4. A/B auf demselben Geraet, in derselben Nacht

Zwei Audit-Laeufe desselben Repos auf `secondhostlinux1`, wenige Stunden auseinander, unterschieden
nur durch den Daemon-Baum (`git merge-base --is-ancestor 84c16f2 <tree>`):

| Daemon-Baum | enthaelt `84c16f2` | Lauf (Europe/Berlin) | Dauer | Heartbeats waehrend des Laufs |
|---|---|---|---:|---:|
| `780d2f54` | nein | 00:27:03 → 01:02:17 | 2112 s | **0** (letzter 00:26:59, naechster 01:02:33 — 2134 s Stille) |
| `fed0a414` | ja | 04:42:38 → laufend | — | **alle 15 s, lueckenlos** |

Die Beat-Zeitstempel des zweiten Laufs, mitten in der Arbeit abgelesen:

```
04:49:20 04:49:35 04:49:50 04:50:05 04:50:20 04:50:35 04:50:50 04:51:05 04:51:20 04:51:35 04:51:50
```

## 5. Live-Nachweis aus der Lane

`GET /api/self/suite-offer` (Self-Token, Lane Slot 1), waehrend der Helfer den Audit von
`main@a1f8b65f` fuhr — genau die Konstellation, die am 2026-09-05 `online:false` ergab:

```
2026-09-07T02:49:37Z  online=True name=second-host mode=active ageMs=1556 offer=None
2026-09-07T02:49:52Z  online=True name=second-host mode=active ageMs=1722 offer=None
2026-09-07T02:50:07Z  online=True name=second-host mode=active ageMs=1926 offer=None
2026-09-07T02:50:22Z  online=True name=second-host mode=active ageMs=2092 offer=None
2026-09-07T02:50:38Z  online=True name=second-host mode=active ageMs=2292 offer=None
2026-09-07T02:50:53Z  online=True name=second-host mode=active ageMs=2485 offer=None
2026-09-07T02:51:08Z  online=True name=second-host mode=active ageMs=2705 offer=None
2026-09-07T02:51:23Z  online=True name=second-host mode=active ageMs=2868 offer=None
2026-09-07T02:51:38Z  online=True name=second-host mode=active ageMs=3072 offer=None
```

`lastSeenAgeMs` bleibt unter 3,1 s. **Die Divergenz besteht am heutigen HEAD nicht mehr.**

## 6. Was den Mutex wirklich kostet: `heldMs` gegen die gemessene Fern-Laufzeit

`SUITE_OFFER_WAIT_HELD_MS` = 800 s ist im Code als „the measured p50 of a full run" begruendet —
das ist die p50 des LOKALEN Audits (800 s, `docs/attic/helper-lane-suiten-entwurf-2026-08-26.md`).
Die Laufzeit auf dem Helfer ist eine andere Verteilung. Alle 75 `suite finished`-Zeilen des
Journals:

```
n=75   min=0   p50=1448 s   p90=2101 s   max=2149 s
ueber 800 s: 68 von 75
```

Folge, aus `audit.jsonl` gezaehlt: von 45 gemachten Angeboten wurden 26 geclaimt, und **6 davon hat
die Lane am Deckel aufgegeben**, jeweils nach 832–1455 s (vier davon bei ~840 s = 800 s plus eine
Poll-Runde):

```
fleet/260901155944-dfd8   09-01 18:30:49 → 18:44:54    845 s
fleet/260901155945-6e5d   09-01 20:33:30 → 20:47:31    841 s
fleet/260904055850-898f   09-04 08:11:18 → 08:29:55   1118 s
fleet/260904083919-f581   09-04 10:47:31 → 11:01:23    832 s
fleet/260905114820-f746   09-05 14:01:17 → 14:15:16    839 s   ← der Fall des Befunds
fleet/260906134025-8f4b   09-06 15:50:13 → 16:14:28   1455 s
```

In jedem dieser Faelle rechnete die zweite Maschine danach noch 10–25 min zu Ende und bekam ihr
Verdikt abgewiesen (der 409 oben), waehrend die Lane denselben Baum lokal fuhr und dabei den
Mac-Mutex hielt. Das ist der Engpass, den der Nachtrag der MAIN am 2026-09-06 19:4x wieder
gemessen hat — und er ist von der Praesenz-Divergenz unabhaengig, also durch `84c16f2` NICHT
behoben.

## 7. Ausdruecklich nicht gemessen

- Ob die Lane-seitige Wartelogik den Deckel tatsaechlich so anwendet, wie `waitPolicy` ihn
  anbietet — sie ist eine Vordergrundschleife in der Pane und hinterlaesst keinen Sensor.
- Ob `AUDIT_HELPER_GRACE_MS` (60 s) gegen `HELPER_FRESH_MS` (45 s) je eine Zuteilung gekostet hat.
- Verhalten mit mehr als einem Helfer-Geraet: `helperPresence()` waehlt das FRISCHESTE, und ob
  dessen `mode` fuer die Frage „koennte jemand uebernehmen?" dann noch die richtige Antwort ist,
  ist hier nicht geprueft.

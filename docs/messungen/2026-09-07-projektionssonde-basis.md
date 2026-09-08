# Die `basis`-Zeile der Projektions-Sonde, zum ersten Mal gelesen — R10/`observed`, und die Familie feuert seit dem Fix nicht mehr

**Stand 2026-09-08 · gemessen an `e2e-trail/` (6 745 Laufdateien) und `post-land-audits.jsonl`
(532 Eintraege) im Haupt-Checkout · EINE Frage, keine Reparatur**

Auftrag: den juengsten roten Lauf mit der NEUEN Signatur der Sonde
`projection nextAction: …` (`e2e/programs.ts`, Land-Tuer-Block) lesen und genau eine Frage
beantworten — **welche Regel feuert, und welcher Fakt fehlt ihr** —, daraus (a) „die Sonde misst
etwas, das der Code legitim nicht mehr garantiert" oder (b) „echter Regress" belegt waehlen.

## 1. Der gelesene Lauf

Der juengste rote Lauf mit der neuen Signatur, den dieser Host lesen kann:

| | |
| --- | --- |
| Lauf | `isolated-20260905T223238Z-91124` |
| `at` (Check-Zeile) | `1788648630512` = **2026-09-05T22:50:30.512Z** |
| Baum | `b4ed08487647efb84e8307eae323ff89370322ab`, `dirty: true` |
| Suite | `isolated` |

Der juengste ROTE POST-LAND-AUDIT, der dieselbe Zeile im `fails`-Feld traegt, ist derselbe Baum als
`mainSha`: **`b4ed08487647efb84e8307eae323ff89370322ab`, `at` = `1788642352807`
= 2026-09-05T21:05:52Z, `remote: true`** (Second-host). Fuer Fern-Laeufe liegt die Trail-Datei auf dem
Helfergeraet; das Ledger fuehrt nur den Check-NAMEN, kein `detail` — die `basis`-Zeile ist dort auf
diesem Host strukturell nicht lesbar. Darum ist der lokale Lauf oben der gelesene.

## 2. Die `basis`-Zeile, woertlich

    "basis":["R10: lane facts incomplete — the predicate cannot be evaluated (pane never observed (lastOutput 0))"]
    "basisWithout":["R10: lane facts incomplete — the predicate cannot be evaluated (pane never observed (lastOutput 0))"]
    "unknown":["1 task (e2522038) projects as phase UNKNOWN: pane never observed (lastOutput 0)."]
    "unknownWithout":["1 task (e2522038) projects as phase UNKNOWN: pane never observed (lastOutput 0)."]

**Die feuernde Regel ist R10 („lane facts incomplete"), der fehlende Fakt ist `observed`, und sein
Traeger ist `lastOutput === 0`** — die Pane wurde nie beobachtet. Beide Beine tragen dieselbe Basis,
also ein stehender Zustand und kein Rennen zwischen den zwei GETs.

Im ganzen lokalen Register gibt es **genau drei** rote Zeilen mit der neuen Signatur — die dritte
oben plus `isolated-20260905T145210Z-77794` (Baum `e897f038`) und
`isolated-20260905T155619Z-69988` (`tree: null`). **Alle drei tragen buchstabengleich dieselbe
`basis`.** Damit gilt die Klausel aus `docs/verify-tiering.md` §11.2o („wenn dort etwas anderes
steht als `pane never observed (lastOutput 0)`, ist es ein NEUER Befund") ausdruecklich NICHT: es
steht nichts anderes da.

## 3. (a) oder (b) — und warum die Frage anders ausgeht, als die Alternative es anbietet

Weder (a) noch (b) im Wortsinn. Der Code hat die Zusage **verletzt** (das war (b)-foermig), sie ist
aber am **2026-09-05** repariert worden, und die Sonde misst seither wieder ein erfuelltes
Praedikat. Beleg, Vorfahren-Test gegen `4c562e7` („fix(stream): das Ruhefenster verliert sein Veto
ueber ‚nie beobachtet'", Committer-Zeit 2026-09-05T20:59:51Z; Ahn von `main`, geprueft mit
`git merge-base --is-ancestor`):

| Baum des Laufs | Sonden-Laeufe | davon rot |
| --- | ---: | ---: |
| traegt `4c562e7` | **37** | **0** |
| ohne `4c562e7` | 235 | 28 (11,9 %) |
| Baum unbekannt/`null` | 33 | 12 |

Und dieselbe Trennung am Audit-Ledger, das auch die Second-host-Laeufe enthaelt:

| `mainSha` des Audits | Audits | rot | davon mit dieser Sonde im `fails` |
| --- | ---: | ---: | ---: |
| traegt `4c562e7` | **38** | 6 | **0** |
| ohne `4c562e7` | 107 | 72 | 12 |

Die einzige rote Sonden-Zeile nach der Landezeit des Fixes ist die aus §1: sie laeuft um 22:50Z auf
`b4ed0848` + `dirty`, einem Baum von 20:36Z, also **23 Minuten VOR** dem Fix. Kein einziger roter
Lauf liegt auf einem Baum, der die Reparatur enthaelt — lokal nicht und auf dem Second-host nicht.
Die sechs roten Nach-Fix-Audits fallen an anderen Zeilen (D2-Setup, Watch-Trail, Codex-Resume,
`fleet-sync.sh`-Probe, `ctl.sh`-Probe).

Gegenprobe, dass die Sonde nicht bloss stumm geworden ist: die Setup-Zeile davor
(`self-land green fixture: the row is running on a live lane that is idle, clean and ahead`, seit
`21150ac` mit eigener `row.lastOutput > 0`-Klausel) ist auf Fix-Baeumen **74-mal gelaufen und
0-mal rot**. Waere die Vorbedingung weiter ausgefallen, faellt sie jetzt dort — sie faellt nicht.

**Verdikt: (a), aber mit korrigierter Begruendung.** Faellig ist eine DOC-Korrektur, nicht weil der
Code eine Garantie aufgegeben haette, sondern weil §11.2o die Familie noch als offene, laufend zu
adjudizierende Flake-Familie fuehrt, obwohl sie seit `4c562e7` **empirisch geschlossen** ist. **An
der Sonde ist NICHTS zu aendern** — sie hat den Defekt korrekt angezeigt, ihre Diagnose-Zeile hat
die Frage in einem einzigen Lauf beantwortet, und sie ist auf Fix-Baeumen gruen. Ein Rot dieser
Zeile auf einem Baum mit `4c562e7` ist ab jetzt ECHT und deins.

## 4. Vorgeschlagene Doc-Korrektur (nicht angewandt — Entscheid liegt bei der Program-MAIN)

Anzufuegen am Ende von `docs/verify-tiering.md` §11.2o, und die Kopfzeile der Sektion entsprechend:

```diff
-### 11.2o Eine siebzehnte Familie: die Projektions-Sonde in `e2e/programs.ts` — KEIN Flake um eine feste Rate, sondern ein REGIME-WECHSEL am 2026-09-04 (Stand 2026-09-05: Evidenzzeile repariert, R10/`observed` GEMESSEN, Mechanismus am Code gelesen — **die Wurzel ist seit `4c562e7` REPARIERT, der Regime-Wechsel selbst bleibt offen**)
+### 11.2o Eine siebzehnte Familie: die Projektions-Sonde in `e2e/programs.ts` — KEIN Flake um eine feste Rate, sondern ein REGIME-WECHSEL am 2026-09-04 (Stand 2026-09-08: **GESCHLOSSEN** — Wurzel seit `4c562e7` repariert, 0 Rot in 37 Sonden-Laeufen und 38 Audits auf Baeumen mit dem Fix; der Regime-Wechsel selbst bleibt unerklaert und ist ueber diesen Check nicht mehr beobachtbar)
+
+**NACHGEMESSEN 2026-09-08, und damit ist die Familie geschlossen.** Vorfahren-Test gegen `4c562e7`
+ueber das lokale Trail-Register und `post-land-audits.jsonl` (das auch die Second-host-Laeufe fuehrt):
+
+| Baum | Sonden-Laeufe | rot | | Audits | rot | mit dieser Sonde |
+| --- | ---: | ---: | --- | ---: | ---: | ---: |
+| traegt `4c562e7` | 37 | **0** | | 38 | 6 | **0** |
+| ohne `4c562e7` | 235 | 28 | | 107 | 72 | 12 |
+
+Die letzte rote Zeile ueberhaupt ist `isolated-20260905T223238Z-91124` (2026-09-05T22:50:30Z) auf
+`b4ed0848`+dirty — einem Baum von 23 min VOR dem Fix. Auch die Setup-Zeile davor ist auf
+Fix-Baeumen 74-mal gelaufen und nie rot, die Sonde ist also nicht stumm, sondern gruen.
+**Ein Rot dieser Zeile auf einem Baum mit `4c562e7` ist wieder ECHT** und gehoert dem Baum, nicht
+der Familie. Messnotiz: `docs/messungen/2026-09-07-projektionssonde-basis.md`.
```

## 5. Was NICHT gemessen wurde

- **Die neun unbeurteilten roten Audits sind NICHT adjudiziert.** Als Material fuer den
  Owner/Controller, ohne Urteil: die vier dicht beieinander liegenden tragen die Sonde im
  `fails`-Feld und laufen alle auf Baeumen OHNE `4c562e7` — `10ba7afd` (2026-09-04T19:01:21Z,
  remote, EINZIGER Fail) · `126a82dc` (2026-09-05T11:54:58Z, remote, 4 Fails) · `1d5efb95`
  (2026-09-05T13:46:36Z, remote, 2 Fails) · `cba88078` (2026-09-05T14:21:28Z, remote, 2 Fails).
- **Die Basisrate der Familie wurde nicht neu ausgezaehlt** (Auftragsgrenze). Die Zahlen oben sind
  ein Vorfahren-Split zur Entscheidung von (a)/(b), keine Rate.
- **Kein Rerun, kein frischer Baum, keine Reparatur.** Nichts an `e2e/programs.ts`, am Land-Gate
  oder am Audit-Pfad angefasst.
- **`basis` eines FERN gelaufenen Rots wurde nie gelesen** — die Trail-Dateien der Second-host-Laeufe
  liegen auf dem Helfergeraet, das Ledger fuehrt fuer sie nur Check-Namen. Die Aussage „auf dem
  Second-host feuert die Familie seit dem Fix nicht mehr" stuetzt sich auf das `fails`-Feld
  (0 von 38 Fix-Baum-Audits), nicht auf eine gelesene `basis`.
- **Der Regime-Wechsel vom 2026-09-04 bleibt unerklaert.** Diese Notiz sagt nichts darueber; §11.2o
  haelt bereits fest, dass er ueber diesen Check nicht mehr beobachtbar ist.
- **`tree: null` in 33 Laeufen (12 rot) ist nicht aufgeloest** — diese Laeufe konnten dem Split
  nicht zugeordnet werden; alle 12 roten liegen dem Zeitstempel nach vor dem Fix, das ist aber ein
  Datums- und kein Vorfahren-Argument.

## 6. Verify

    bun install --frozen-lockfile && bun e2e/pins.ts

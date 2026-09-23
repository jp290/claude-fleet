---
frage: Welche Stufe eines laufenden Checks publiziert der Server heute, was zeichnet die Suite-Strecke daraus, und welche feinere Auflösung ist Client- oder Server-Arbeit?
urteil: Der Server publiziert von keinem Lauf eine Stufe, und kein Land-Gate traegt eine erwartete Dauer. Die Suite-Grenzen des Gates liest runVerify schon heute zeilenweise mit (der Name des Wrappers wird verworfen), also ist die Stufe auf Suite-Ebene kleine Server-Arbeit. Laufzeit samt Art und Branch ist fast reine Client-Arbeit. Die erwarteten Dauern aus dem Brief (110 s Gate, 680 s Audit) passen nicht zum Ledger (p50 218 s bei der vollen Kette, p50 1052 s beim Helfer-Audit)
bereich: [suite-strecke, board, verify-gate]
belege: [src/suitemeter.ts#suiteMeter, src/suitemeter.ts#METER_STATIONS, src/client.ts#meterState, src/client.ts#renderSuiteMeter, src/client.ts#auditLiveRows, src/client.ts#gateSection, server.ts#gateView, server.ts#reportServerRun, server.ts#runVerify, server.ts#SUITE_LOCK_RE, server.ts#postLandAuditLiveView, server.ts#auditCounts, server.ts#heldClaimsByDevice, server.ts#suiteOffersView, e2e-stage.sh, src/pollplan.ts, docs/design/grammatik.md]
nicht-gemessen: kein laufender Check live beobachtet (Code und Ledger, keine Testinstanz); die Stufen eines Helfer-Laufs nur bis zum Herzschlag verfolgt, nicht im Daemon
stand: 2026-09-23
---

# Was die Suite-Strecke über einen laufenden Check sagen kann

2026-09-23, Lane `fleet/260923212357-052b`, Baum `9319367e`. Der Dateiname trägt das Datum der
Zeile (2026-09-22), gemessen wurde am 23.09. Frage: **Welche Stufe eines laufenden Land-Gates,
einer Vorschau und eines Post-Land-Checks publiziert der Server heute, was zeichnet die Suite-Strecke
daraus, und was kostet jede feinere Auflösung?**

Owner, wörtlich (2026-09-21, Intake Slot 12): „Die 'Suite-Strecke könnte etwas hochauflösender sein
und auch etwas mehr aufschluss geben was nun eigentlich passiert". Das ist die Messlatte. Unten steht
ein Vorschlag, noch kein Bau.

Zeilennummern in dieser Notiz beziehen sich auf den Baum `9319367e`.

## (1) Was der Server publiziert und in welchem Takt

**Takt.** Alle Zeilen unten fahren auf dem einen `/api/sessions`-Poll: 2 s, im Datensparmodus 10 s,
im verborgenen Tab 0 (`src/pollplan.ts`, `NORMAL`/`SAVER`). Das Board zeichnet alle 3 s neu
(`boardMs`). Die Strecke selbst zeichnet bei jedem Poll neu (`src/client.ts:8137`,
`renderSuiteMeter()` im Poll-Handler). Einen zweiten Takt gibt es nicht und braucht keine der
Auflösungen unten.

| Lauf | Wire-Zeile | Was sie sagt | Stufe? | Erwartete Dauer? |
|---|---|---|---|---|
| **Land-Gate** | `gate.reports[]` mit `origin:"server"` (`server.ts#gateView` aus `serverRuns`, geschrieben von `server.ts#reportServerRun`, Aufruf `gateRun` `server.ts:28302`) | `slot`, `label`, `branch`, `suite:"land gate"`, `phase:"running"` (per Konstruktion), `at` | **nein** | **nein** |
| Lane-Vorschau, lokal | `gate.reports[]` mit `origin:"lane"` (aus `verifyIntents`, `POST /api/self/verify-intent`) | `phase` ∈ waiting/running/done/failed, `suite` = frei gewähltes Etikett der Lane (`VERIFY_SUITE_RE`), `exitCode` | nur wenn die Lane sie selbst ins Etikett schreibt | nein |
| Lane-Vorschau, Helfer | `suiteOffers[]` (`server.ts#suiteOffersView`) | `state` ∈ open/claimed/reported, `device`, `at` (Claim- bzw. Angebotszeit), `result` | nein | nein |
| **Post-Land-Check, lokal** | `postLandAuditLive` (`server.ts#postLandAuditLiveView`) | `running{phase running\|starting, main, mainSha, startedAt, covers}`, `waiting[]`, `stats{n,p50,p90}` | nein (nur `starting` vs. `running`) | **ja**, `stats` |
| **Post-Land-Check, Helfer** | nur `helperDevices[].claims[]` mit `kind:"audit"` (`server.ts#heldClaimsByDevice`) | `repo`, `ref`, `expiresAt`, ein Claim je Shard | nein | nein, und **keine Startzeit** (kein `claimedAt` auf dem Draht) |
| Sperre + Schlange | `gate.lock`, `gate.queue[]` (`server.ts#suiteQueueView`) | Halter-PID, Zustand, Alter; je Ticket die Position | — | — |
| `/api/self/gate` | Konfiguration: `verify{cmd,timeoutMs,waitMs}`, `suiteLock`, `helper`, `localProof.steps` | die GEPLANTEN Schritte für den Baum der fragenden Lane | kein laufender Lauf | nein |

Das heißt:

- **Kein Lauf publiziert seine Stufe.** Das Land-Gate schreibt beim Start eine Zeile und löscht
  sie im `finally` (`server.ts#reportServerRun`). Dazwischen ändert sich nichts.
- **Die Suite-Grenzen des Gates sieht der Server schon.** `runVerify` liest stdout Zeile für Zeile
  (`drain(p.stdout, onLine)`), und jeder Suite-Wrapper druckt beim Start
  `[suite-lock] <wrapper> acquired after Ns (pid P)` (`e2e-stage.sh:415`, `_st_who=$(basename "$0")`),
  auch wenn er die Sperre des Servers erbt (`after 0s`). `onLine` gleicht die Zeile gegen
  `server.ts#SUITE_LOCK_RE` ab, nimmt aber nur Gruppe 1 (waiting/acquired) und die Sekundenzahl und
  wirft den Wrapper-Namen weg. Die Kette hat heute drei Wrapper: `e2e-clean-review.sh`,
  `e2e-security.sh`, `e2e-claude-gate.sh` (`GET /api/self/gate` → `verify.cmd`, live am 2026-09-23).
- **Die Schritte vor den Suiten sind stumm.** `install`, `pins`, `tsc` und `build` drucken keine
  Grenzmarke, und `tsc` druckt im Erfolgsfall gar nichts. Die geplante Schrittliste
  (`VerifyPlan.steps`, `server.ts#verifyPlanFor`) kennt der Server beim Spawn, veröffentlicht sie
  aber erst mit dem Ergebnis (`MergeLast.verify.steps`).
- **`at` misst beim Land-Gate ab dem Sperr-Warten.** `gateRun` umschließt schon
  `holdSuiteLock` (`server.ts:28437`), nicht erst `runVerify`. Eine Laufzeit ab `at` enthält also
  die Schlange (7 Tage: `waitMs` p50 0, siehe unten).
- **Ein Helfer-Check hat auf dem Draht keinen Anfang.** Der Ball dafür steht mit `at: 0` in
  `src/suitemeter.ts#suiteMeter` (Zweig `else if (auditHeld)`). Bei drei Shard-Claims nimmt
  `auditHeld` den ersten (`…[0] ?? null`), die Strecke zeigt also einen Ball für drei Läufe.
- **Der Helfer-Herzschlag** trägt `running` und `maxParallelSuites` je Gerät, keine Stufe je Job
  (`server.ts:21583–21600`).

## (2) Was der Client heute daraus zeichnet

- **Röhre mit vier Stationen**, `src/suitemeter.ts#METER_STATIONS` = `wait · run · helper · done`,
  beschriftet über `METER_WORD` (waiting/running/on helper/done) mit Zähler. Pro Wire-Zeile ein Ball,
  der Schlüssel bleibt über Polls gleich, so dass ein Ball per CSS-Transition wandert
  (`src/client.ts#renderSuiteMeter`).
- **Bis zu sechs Namenszeilen** (`METER_ROWS_MAX`), jede mit `name · what · where`. Der Zustand
  steckt nur im Punkt (hohl, gefüllt, beringt) und im Titel, dort über `src/client.ts#meterState` in
  vier Worten: waiting/running/failed/passed bzw. „no result".
- **Keine Laufzeit auf der Strecke.** `MeterBall.at` wird nur zum Sortieren benutzt (`a.at - b.at`)
  und nie gezeichnet.
- **Nur in der aufgeklappten Lesung** (`src/client.ts#gateSection`) stehen Sperrkopf mit Alter,
  Report-Zeilen mit `gateAge` (ganze Minuten) und für einen LOKALEN Post-Land-Check
  `src/client.ts#auditLiveRows`: `m:ss` laufend und `p50 · p90 (n=…)`.
- **Was ein Ball als `what` zeigt:** beim Land-Gate das rohe `suite`-Etikett **„land gate"**. Das
  ist ein Prozess-Nomen im sichtbaren Text (G0.5) und fehlt in der Wortschatz-Tabelle der Grammatik
  unter „Info-Tab · Suite-Strecke". Bei einer Lane-Vorschau ist es das Etikett der Lane, beim Angebot
  „offered check run", beim Post-Land-Check `main@sha8` oder „starting".

## (3) Drei Auflösungen, je mit Kosten

### (a) Gate-Stufen als Stationen: install · pins · tsc · build · Suiten

- **Auf Suite-Ebene ist das kleine Server-Arbeit.** `onLine` in `runVerify` behält den
  Wrapper-Namen und reicht ihn an die `serverRuns`-Zeile weiter (`ServerRun.stage`, z. B.
  `clean-review 1/3`). Dafür muss `runVerify` einen Rückruf oder den Schlüssel `land:<slot>`
  bekommen, weil es seine Zeile heute nicht kennt. `GateReport` erhält ein optionales Feld, und die
  Strecke zeigt es. Die Schritte vor der ersten Suite fallen zu einer Stufe „vorbereiten" zusammen.
  Kosten: Server rund 20 Zeilen plus Protokollfeld, Client rund 10 Zeilen, ein e2e-Check. Die Kette
  selbst ändert sich nicht.
- **Alle sieben Stufen einzeln kosten viel.** Dafür bräuchte die Kette Grenzmarken für
  install/pins/tsc/build, also Änderungen an `watchdog.sh#VERIFY_CMD`, dem `.env`-Eintrag
  `FLEET_VERIFY_CMD_REPOS` (beide müssen gleich bleiben, CLAUDE.md), an `RULE_VERIFY` in
  `e2e/pins.ts` und an `verify-proportion.ts`. Das ist ein Griff in den Land-Pfad und verlangt
  `./e2e-clean-review.sh`. Der Ertrag ist klein: laut Ledger (unten) liegt der Großteil der 218 s in
  den Suiten.
- **Bei einer Lane-Vorschau** nennt heute nur die Lane selbst eine Stufe, über ihr
  verify-intent-Etikett. Das wäre eine Konvention, keine Messung.
- **Bei einem Helfer-Lauf** wäre das Arbeit an Daemon und Server (Stufe im Herzschlag je Job). Das
  liegt außerhalb dieser Zeile.

### (b) Laufzeit gegen erwartete Dauer

Gemessen am 2026-09-23 im Haupt-Checkout (Methode unten):

| Lauf | Quelle | n | p50 | p90 | Bemerkung |
|---|---|---|---|---|---|
| Land-Gate, volle Kette | `audit.jsonl` `merge_verdict`, `landed`, `ms − waitMs` ≥ 60 s, 7 Tage | 65 | 218 s | 353 s | min 188 s, max 402 s |
| Land-Gate, kurze Kette (docs-only) | ebenso, < 60 s | 27 | — | — | max 11 s. Zwischen 11 s und 188 s liegt keine Probe. |
| Post-Land-Check auf dem Helfer (ganzer Lauf) | `post-land-audits.jsonl`, `remote`, green/red, 48 h | 43 | 1052 s | 1091 s | die drei Shards laufen parallel, der langsamste bestimmt die Dauer. Letzte Zeile: k1 621 s, k2 1079 s, k3 553 s. |
| Post-Land-Check, was der Draht als `stats` meldet | `server.ts#auditCounts`-Filter über das Ledger | 200 | 1446 s | 2053 s | nur lokale Läufe, jüngste Probe vom 2026-09-17. In 7 Tagen liefen 118 von 163 Checks auf dem Helfer, und die zählt `auditCounts` absichtlich nicht mit. |

Die Zahlen im Brief („~110 s Gate, ~680 s Audit") decken sich mit keiner Zeile. 680 s liegt in der
Größenordnung EINES Shards.

- **Laufzeit an jedem Ball ist Client-Arbeit.** `at` liegt auf jedem Ball, `m:ss` wird im Repaint
  aus `Date.now() - at` gerechnet, wie `auditLiveRows` es schon tut. Dafür braucht es keinen neuen
  Timer. Ausnahme: Beim Land-Gate zählt die Uhr das Sperr-Warten mit. Das steht im Titel, nicht in
  der Zahl.
- **Die erwartete Dauer eines lokalen Post-Land-Checks ist Client-Arbeit.** `stats` liegt schon auf
  dem Draht und muss nur von der aufgeklappten Lesung auf die Zeile.
- **Die erwartete Dauer eines Land-Gates ist Server-Arbeit.** Sie braucht eine `gateStats`-Verteilung
  analog zu `auditStats`, getrennt nach voller und kurzer Kette, und zwar über `proportional` bzw.
  `steps`, nicht über eine Schwelle: `merge_verdict` trägt heute kein `proportional`. Kosten:
  Server rund 30 Zeilen mit Ledger-Einlesen beim Boot, ein Protokollfeld.
- **Beim Helfer-Check ist beides Server-Arbeit.** Ohne `claimedAt` auf `HelperDeviceClaimView` hat
  der Ball keinen Anfang, und die Remote-Verteilung existiert auf dem Draht nicht, weil `auditCounts`
  sie für eine andere Frage ausschließt. Das muss ein zweiter Wert werden, kein Umbau von
  `auditCounts`.

### (c) Art, Branch und Lauf direkt lesbar

- **Die Art ist Client-Arbeit.** Welche Art von Lauf es ist, steht schon auf dem Draht: `origin`
  (server/lane), `suite` („land gate"/„post-land audit"), Angebot oder Claim-`kind`. Heute landet
  davon das rohe Etikett in `what`. Ein festes Wort pro Art in Owner-Sprache („land check", „preview",
  „post-land check"), abgeleitet in `suiteMeter`, behebt nebenbei die G0.5-Abweichung
  „land gate".
- **Der Branch ist Client-Arbeit.** Er liegt bei Gate-Zeilen (`branch`) und Angeboten vor, und
  `laneTail` existiert.
- **Die Zahl der Shards ist kleine Client-Arbeit.** Die Claims liegen einzeln im Array, nur
  `suiteMeter` nimmt `[0]`. Daraus folgt „post-land check · 3 parts on second-host" statt eines Balls
  für drei Läufe.

## (4) Empfehlung und Karten-Vorlage

**Regel.** Die Zeile unter der Röhre ist eine Statuszeile nach G2.3: eine Zeile Sans 400,
`--chat-mute`, Zeiten mit `tabular-nums`, der Zustand als Wort, ein Signalpunkt nur mit den Farben
aus G0.2. Der Abschnitt bleibt ein Reiter nach G3.2. Sichtbarer Text folgt G0.5: „check" statt
„audit/gate/suite".

**Empfohlen: eine Bauzeile mit drei Lesarten, die Röhre bleibt.** Die vier Stationen beantworten
schon, WO ein Lauf ist. Was fehlt, ist WAS er tut und WIE WEIT er ist. Das gehört in die Zeile, nicht
in mehr Stationen. Sieben Stufen in einer Röhre von etwa 267 px Breite wären nicht lesbar: an genau dieser Breite musste schon die
Zustandsspalte gehen (Kommentar in `src/client.ts#renderSuiteMeter`, 2026-09-20). Also:

```
● 7 · auth-fix   land check · security (2/3) · 2:41 / ~3:38     Mac
○ post-land check · 3 parts                · 11:02 / ~17:32    second-host
```

In der Zeile stehen Art, Stufe, Laufzeit und erwartete Dauer (p50). Wo eine Angabe fehlt, fällt sie
weg, ohne Platzhalter. Hinter p90 bekommt die Zeit ein WORT („länger als üblich“), keine Farbe:
G0.2 vergibt `--amber` an „ungemessen“, und ein langer Lauf ist gemessen. Zuerst
wird geschnitten, was der Owner zuerst ablesen will (Frage unten). Bis zur Antwort gilt die
Reihenfolge Art → Laufzeit → Stufe.

**Karten-Vorlage für die Bauzeile** (nicht gefilt, die MAIN filt nach der Owner-Antwort):

```
[RECHTER TAB · SUITE-STRECKE: ZEILE SAGT ART, STUFE, LAUFZEIT · Program 0d51b4d4]
ROLLE: pi-zai/glm-5.3-flash oder codex/gpt-6-sol
GROESSE: mittel
FLAECHE: src/suitemeter.ts · src/client.ts · src/protocol.ts · server.ts · e2e/outcomes.ts
NACH: d5a60f5e (gleiche Flaeche) · diese Messnotiz
VERIFY: pins + tsc + FLEET_E2E_MODULES=outcomes per Suite-Offer; Screenshot 1200 und 390 px
REGELN: G2.3 (Statuszeile), G3.2 (Reiter), G0.5 (Owner-Sprache), G0.2 (keine neue Signalfarbe)
DONE: Jede Namenszeile der Strecke traegt (i) die ART des Laufs als festes Owner-Wort statt des
  rohen suite-Etiketts ("land gate" ist aus dem sichtbaren Text weg), (ii) m:ss seit `at`, im
  bestehenden Repaint gerechnet, OHNE neuen Timer oder neues Poll-Intervall, (iii) "/ ~p50", wo eine
  Verteilung existiert, und hinter p90 das Wort "länger als üblich" (keine Farbe, G0.2), (iv) beim Land-Check die zuletzt gestartete Suite
  als "<name> (k/N)": server.ts#runVerify reicht den Wrapper-Namen aus der Acquire-Zeile
  (SUITE_LOCK_RE) an die serverRuns-Zeile weiter (GateReport.stage, optional). Serverseitig
  kommen dazu: gateStats {n,p50,p90} je Kette (voll/kurz, getrennt ueber verify.proportional,
  beim Boot aus audit.jsonl merge_verdict eingelesen) auf gate, und claimedAt auf
  HelperDeviceClaimView. suiteMeter zeigt je Shard-Claim eine Zahl statt nur claims[0].
  e2e/outcomes.ts prueft suiteMeter mit (1) einer Gate-Zeile mit stage, (2) drei Audit-Claims,
  (3) einer Zeile ohne stats (keine Erwartung gezeichnet, kein "~0:00").
VERBOTEN: watchdog.sh/VERIFY_CMD oder .env anfassen (keine Grenzmarken in der Kette) · auditCounts
  aendern · ein zweites Poll-Intervall · neue Stationen in METER_STATIONS
```

## (5) Owner-Frage

**Was willst du auf der Strecke zuerst ablesen, wenn du hinschaust?**
(1) **welche Stufe** gerade läuft („security, 2 von 3"),
(2) **wie lange noch** (Laufzeit gegen das Übliche),
(3) **wessen Lauf** es ist (Lane, Land oder Nach-Land-Check, und welcher Branch)?

Die Antwort bestimmt die Reihenfolge in der Zeile und was bei 390 px zuerst abgeschnitten wird. (3)
und der Client-Teil von (2) sind billig. (1) und die Gate-Erwartung aus (2) kosten Server-Arbeit.

## Methode

Wire-Felder und Schreibstellen stammen aus dem Code, die Fundstellen stehen in der Tabelle unter (1):

```
rg -n 'gateInfo\s*=|postLandLive\s*=|meterSuites\s*=' src/client.ts         # 8122–8135
rg -n 'reportServerRun\(|gateRun' server.ts                                 # zwei Schreibstellen
rg -n 'const SUITE_LOCK_RE|const SUITE_LOCK_LINE' server.ts; sed -n 400,415p e2e-stage.sh
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" ${FLEET_SELF_URL:-http://<fleet-host>:8790}/api/self/gate
```

Die Dauern stammen aus Ledgern im Haupt-Checkout, nur lesend. Das Zeitfenster endet am jeweils
jüngsten Eintrag (2026-09-23 23:23 bzw. 23:02):

```python
# Land-Gate: audit.jsonl, event merge_verdict, landed, ms und waitMs; 7 Tage; Schnitt bei 60 s
work = (r['ms'] - r.get('waitMs', 0)) / 1000
# Post-Land-Check: post-land-audits.jsonl; remote = Feld 'remote' vorhanden; result green/red; 48 h
# Draht-stats: auditCounts nachgebaut (nicht remote, nicht proportional, green/red,
#              kein exit 129..165, ms > 0), die letzten 200, Nearest-Rank-Perzentil wie auditStats
```

## Was nicht gemessen wurde

- Kein laufender Check live beobachtet, keine Testinstanz. Alles oben ist aus Code und Ledger
  gelesen. Ob die Acquire-Zeile im Gate-Lauf wirklich ungepuffert ankommt, ist aus der
  `onLine`-Verdrahtung geschlossen, nicht beobachtet.
- Die Aufteilung der 218 s auf install/pins/tsc/build und die drei Suiten ist NICHT gemessen. Die
  Aussage „der Großteil liegt in den Suiten" ist abgeleitet: kurze Kette ≤ 11 s, Kette mit Suiten
  ≥ 188 s.
- Der Helfer-Daemon (`helper-daemon/daemon.ts`) wurde nur auf Herzschlag-Felder gelesen, nicht
  darauf, ob er Zwischenstände eines Jobs kennt.
- Die Zeilenbreite von 267 px ist aus dem Kommentar in `renderSuiteMeter` übernommen, nicht
  nachgemessen. Kein Screenshot.
- Die Kostenangaben (rund 20, rund 30 Zeilen) sind Schätzungen aus dem gelesenen Code, keine
  Probeimplementierung.

---
frage: Wohin geht die Wartezeit der vollen Suite, je Phase (boot/tmux/http/sleep/rest) und je Aufrufstelle, besonders im 3–10-s-Band?
urteil: Sleep traegt 1 289 von 2 225 s (58 %), http 698 s, boot 135 s, tmux 14 s, Rest 88 s; im 3–10-s-Band sind es 716 s sleep und 345 s http von 1 124 s. Drei Server-Wartefenster erklaeren zusammen rund 530 s: der 10-s-Git-Tick (199 s), die festen Boot-Grace-Konstanten fuer Gruendung und Zustellung (187 s) und das Merge-Idle-Gate (145 s). Die Hypothese „Git-Tick widerlegt" haelt am direkt gemessenen Aufrufort nicht.
bereich: [verify, e2e, suite-kontention]
belege: [e2e/trail-emit.ts#createPhaseClock, e2e/harness.ts#installPhaseProbes, e2e/programs.ts#waitDoneLooking, e2e/lane-helpers.ts#settleForMerge, e2e/programs.ts#beginBootstrap, e2e/security.ts#agentOf, server.ts#tickGit, server.ts#FOUNDING_BOOT_GRACE_MS, server.ts#SEND_BOOT_WAIT_MS, docs/e2e-trail.md]
nicht-gemessen: synchrone Arbeit bleibt ungeteilt im Rest; Second-host-Trail ging verloren; die Gegenbewegung an waitMerge (+50 s, Nachtrag) ist als git-Index-Streit nur vermutet, nicht gemessen; ob der verschobene Beobachtungsmoment der Backlog-Nudge-Fixture ihre 2 von 9 Rote erklaert, ist NICHT gemessen (zweiter Nachtrag 2026-09-16, docs/verify-tiering.md §11.2y). ERLEDIGT im Nachtrag 2026-09-16: der Umschalt-Lauf, der die drei Wartefenster beweist.
stand: 2026-09-16 (Nachtrag; Messlauf 2026-09-14)
---

# Wohin geht die Wartezeit der vollen Suite?

2026-09-14, Lane `fleet/260914102649-e60f`. Frage: **Welche Phase und welche Aufrufstelle traegt
die Sekunden, die der Trail bisher nur als `msSincePrev` kannte, besonders die 1 070 s der 217
Checks mit 3–10-s-Luecke (Orchestrator-Befund an `isolated-20260914T043130Z-27323`)?**

## Messlauf

| Feld | Wert |
| --- | --- |
| Lauf | `isolated-20260914T114551Z-36054` (Trail im Haupt-Checkout `e2e-trail/`) |
| Host | Mac `owner` (lokal, seriell, Suite-Mutex), `./e2e-isolated.sh` |
| Baum | `14252131` (dieser Branch vor dem Rebase-Land), `dirty:false` |
| Ergebnis | ALL PASS, 4 514 Trail-Zeilen, alle mit `phases`, 0 Zeilen mit Summenabweichung |
| Laufzeit | 2 225 s (Summe `msSincePrev` = Spanne erster bis letzter Check) |
| getimte Aufrufe | boot 794 · tmux 1 833 · http 15 564 · sleep 13 237 (Detail der Vakuitaets-Sonde) |

Zwei Laeufe davor zaehlen nicht als Messung. Der Second-host-Vorschaulauf (Offer `c36dd72d9e8f`, Baum
`b5a12b8e`, 4 512 Checks, 2 005 s) hatte `phases` auf allen 4 495 Trail-Zeilen, aber der Helfer
loeschte seinen Klon samt Trail nach dem Lauf. Zurueck kamen nur die Zahl der getimten Aufrufe
(boot 794 · tmux 1 757 · http 14 365 · sleep 10 939) und ein rotes Verdikt, siehe unten. Ein
lokaler Lauf auf `bf49946e` wurde bei 3 275 Zeilen wegen Speicherdruck vom Harness abgeschossen.
Diese 3 275 Zeilen haben den Grund fuer `phaseSum` geliefert (§Methode).

## Ergebnis

**Phasen je Luecken-Band.** `phases` bucht jede Millisekunde exklusiv an genau eine Phase, nach
Prioritaet boot > tmux > http > sleep. `rest` ist der Remainder: synchrone Arbeit wie
`spawnSync`-git-Fixtures und JSON, dazu `setTimeout`- und WebSocket-Wartezeiten und direkte
`Bun.spawn`-tmux-Aufrufe.

| Band `msSincePrev` | Checks | Summe s | boot | tmux | http | sleep | rest |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| < 1 s | 4 069 | 395 | 90 | 3 | 207 | 70 | 24 |
| 1–3 s | 191 | 347 | 26 | 1 | 64 | 236 | 21 |
| **3–10 s** | **227** | **1 124** | **12** | **10** | **345** | **716** | **41** |
| ≥ 10 s | 27 | 358 | 7 | 0 | 82 | 267 | 2 |
| alle | 4 514 | 2 225 | 135 | 14 | 698 | 1 289 | 88 |

Das Band hat 227 statt 217 Checks, weil der Baum seit dem Bezugslauf gewachsen ist (4 514 statt
4 419 Zeilen). Die Groessenordnung haelt: 1 124 s gegen 1 070 s.

**Die 15 teuersten Aufrufstellen im 3–10-s-Band.** Summiert ist `phaseSum`: je Zeile und Phase die
Aufrufstelle, deren aeusserste Aufrufe in dieser Zeile zusammen am laengsten warteten. Diese
Stichprobe deckt im Band 611 von 716 sleep-Sekunden, 289 von 345 http-Sekunden, 11 von 12
boot-Sekunden und 10 von 10 tmux-Sekunden. Zeilennummern gelten fuer den datierten Baum `14252131`.

| # | s | Aufrufe | Phase | Aufrufstelle | wartet auf |
| ---: | ---: | ---: | --- | --- | --- |
| 1 | 88,3 | 350 | sleep | `e2e/programs.ts#waitDoneLooking` (:8034) | `git.ahead > 0` aus dem Git-Tick-Cache plus Idle ≥ 2 s |
| 2 | 87,6 | 575 | sleep | `e2e/lane-helpers.ts#settleForMerge` (:80) | `now − lastOutput ≥ FLEET_MERGE_IDLE_MS` (Suite: 2 000) |
| 3 | 41,3 | 404 | sleep | `e2e/lane-helpers.ts#waitMerge` (:63) | Merge-Job fertig (100-ms-Poll) |
| 4 | 22,6 | 45 | sleep | `e2e/tasks.ts#dispatchAndRead` (:2979) | zugestellter Brief nach Dispatch |
| 5 | 21,1 | 42 | sleep | `e2e/tasks.ts#rowAfter` (:3781) | Readiness-Verdikt (4 s Grace + 3 s Budget) |
| 6 | 16,0 | 3 | http | `e2e/programs.ts#bootstrapRevocationMain` (:5118) | `bootstrap-main`-POST |
| 7 | 15,9 | 3 | http | `e2e/programs.ts#foundInto` (:749) | `bootstrap-main`-POST |
| 8 | 15,9 | 3 | http | `e2e/programs.ts#foundStudioBrief` (:7542) | `bootstrap-main`-POST |
| 9 | 10,8 | 43 | sleep | `e2e/programs.ts#pdUntil` (:6450) | Dispatch-Tick |
| 10 | 9,7 | 18 | http | `e2e/programs.ts#conflictLane` (:8653) | Dispatch-POST |
| 11 | 9,6 | 38 | sleep | `e2e/tasks.ts#pTill` (:1892) | Zeilenzustand nach Release |
| 12 | 9,3 | 1 | tmux | `e2e/slots.ts#panePath` (:106) | `paneEnv` auf der recycelten Pane |
| 13 | 9,0 | 18 | sleep | `e2e/land-durability.ts#n3Lane` (:959) | Brief in Lane A |
| 14 | 9,0 | 18 | sleep | `e2e/tasks.ts#autoPromptFor` (:6316) | zugestellter Brief |
| 15 | 9,0 | 18 | sleep | `e2e/tasks.ts#dispatchInto` (:3563) | zugestellter Brief |

Die Spalte „wartet auf" ist am Code gelesen, nicht gemessen.

**Drei Server-Wartefenster, ueber alle Baender** (`phaseSum` je Aufrufstelle, ganzer Lauf):

1. **Git-Tick, 199 s.** `waitDoneLooking` wartet 33-mal, zusammen 190,7 s. 21 dieser Wartezeiten
   dauern mindestens 6 s (20 davon 6–10 s, eine 14,1 s) und summieren sich auf 166,0 s. 12 dauern 1,8–3 s, das passt zum Idle-Gate allein.
   Die Schleife liest `row.git.ahead`, und `server.ts#tickGit` schreibt diesen Cache nur alle
   `FLEET_GIT_TICK_MS` (Default 10 000, in der Suite nicht gesetzt). Dazu kommen 33,0 s aus drei
   festen Sleeps `GIT_TICK_MS + 1000` in `e2e/security.ts#agentOf` (Konstante 10 000, liest keine Env). Die
   Widerlegung aus dem Brief stuetzte sich auf Git-Woerter in Check-Namen. Hier ist der Aufrufort
   direkt gemessen, und die 6–10-s-Haeufung passt zum 10-s-Takt. Bewiesen ist die Ursache damit
   noch nicht: dafuer braeuchte es einen Lauf mit kuerzerem Tick (Schnitt 1).
2. **Boot-Grace, 187 s.** 43 Gruendungen ueber `e2e/programs.ts#beginBootstrap` warten 143,3 s als
   http, 3,3 s je POST, weil der Server die Antwort erst nach der Gruendung schickt. Dazu
   `dispatchAndRead` und `rowAfter` mit zusammen 43,7 s in 9 Wartezeiten von rund 4,9 s. Beides
   passt zu `server.ts#FOUNDING_BOOT_GRACE_MS` (4 000) und `server.ts#SEND_BOOT_WAIT_MS` (3 000).
   Beide Konstanten sind fest verdrahtet und in der Suite nicht einstellbar.
3. **Merge-Idle-Gate, 145 s.** `settleForMerge` wartet 77-mal, zusammen 145,4 s. 69 dieser
   Wartezeiten liegen bei 1,5–2,0 s, das ist das Suite-Gate `FLEET_MERGE_IDLE_MS=2000`
   (`e2e-isolated.sh`) abzueglich Pollschritt.

`waitMerge` (90,7 s) wartet auf echte Server-Arbeit (Rebase, Fake-Verify) in 100-ms-Schritten.
Mit kuerzeren Sleeps ist dort nichts zu gewinnen.

**Gegen die Astra-Notiz** (`docs/messungen/2026-09-14-astra-suiten-types-tests-befunde.md` §1.8).
Der feste `Bun.sleep(8000)` in `e2e/review.ts` (Check „a review completing after a slot recycle is
NOT filed under the new lane") steht mit 8 500 ms in einer Zeile und traegt dort http 4 808 ms,
sleep 3 692 ms. Das un-awaitete `void post(…/review)` zwei Schritte davor ist noch offen, und http
schlaegt sleep. Mit rund 8 s ist die Stelle kein Grossposten: sie ist so gross wie Platz 13–15
oben, eine Wartezeit einmal je Lauf.

**Die rote Second-host-Vorschau.** Auf `b5a12b8e` fiel „clarification identical retry re-attempts
the send and only a successful one answers and clears the wait" (1 von 4 512). Das Detail zeigt
eine korrekte Server-Antwort (`healed=0`, `200`, `status:"answered"`, `closedAt` gesetzt).
Gescheitert ist also eine der drei Nachlesungen direkt nach der Antwort (Pane-Capture,
State-Datei, `awaiting`), keine davon mit Retry. Der Messlauf oben enthaelt dieselbe Harness-Aenderung
und bestand den Check. Das zeigt Nicht-Determiniertheit auf aehnlichem Baum. Dass der Check
fremd faellt, zeigt es nicht: die Basisrate ist unbekannt, und `/api/self/flakes` meldete fuer
14 gelesene Laeufe 0 Fehler, bei gekapptem Lesefenster.

## Overhead der Instrumentierung

Gleicher Host (Mac `owner`), gleicher Baum `14252131`, beide `dirty:false`, beide ALL PASS
mit 4 514 Zeilen, seriell direkt nacheinander gelaufen:

| Lauf | `FLEET_E2E_PHASES` | Summe `msSincePrev` | Trail-Datei |
| --- | --- | ---: | ---: |
| `isolated-20260914T114551Z-36054` | an | 2 224,7 s | 1 902 172 B |
| `isolated-20260914T122425Z-32305` | `0` | 2 216,5 s | 1 224 991 B |

Differenz +8,2 s = **+0,37 %**, unter der 2-%-Grenze. Wie viel davon Instrumentierung ist, sagt
die Obergrenze aus dem Mikro-Benchmark: rund 4–5 µs je getimtem Aufruf. Gemessen wurde
`Bun.sleep(0)` umwickelt gegen roh, mit Stack-Formatierung je Aufruf und `cut` je siebtem Aufruf,
auf dem Mac waehrend eines fremden Suite-Laufs. Mal 31 428 Aufrufe ergibt das rund 0,15 s. Der
Rest der 8,2 s ist Streuung zwischen Laeufen. Zum Vergleich lagen zwei Laeufe ohne Instrumentierung
auf demselben Baum `1b6350c3` 2 s auseinander (2 120 s gegen 2 122 s,
`isolated-20260913T224812Z-32907` / `isolated-20260914T043130Z-27323`).

Die Trail-Datei waechst um 55 % (677 KB je Lauf), weil `phases`, `phaseTop` und `phaseSum` je
Zeile anfallen. `docs/e2e-trail.md` §3 fuehrt das Wachstum des Verzeichnisses schon als
ungeloest.

## Methode

**Instrumentierung** (`e2e/trail-emit.ts#createPhaseClock`, eingehaengt in
`e2e/harness.ts#installPhaseProbes`). `Bun.sleep` und `globalThis.fetch` werden einmal
umwickelt, `tmuxOut`/`paneEnv` als tmux, `stopSrv`/`restartSrv` als boot. Keine Aufrufstelle
wurde geaendert. Jeder Start und jedes Ende eines getimten Aufrufs ist ein Uebergang, und das
Intervall seit dem vorigen Uebergang geht an die hoechste aktive Phase. Die fuenf Felder summieren
sich darum exakt zu `msSincePrev`, was `e2e/trail.ts` an jeder Zeile prueft. Vertrag:
`docs/e2e-trail.md` §4a. `FLEET_E2E_PHASES=0` schaltet alles ab.

**Warum `phaseSum` und nicht nur `phaseTop`.** Auf dem abgebrochenen Lauf (3 275 Zeilen) deckte
die laengste Einzelwartezeit je Zeile im 3–10-s-Band nur 77 von 506 sleep-Sekunden. Eine
Pollschleife besteht aus vielen kurzen Sleeps einer Zeile. Mit `phaseSum` sind es im Messlauf 611
von 716.

**Auswertung.** Das Skript liegt nicht im Baum. Kern, reproduzierbar gegen jede Trail-Datei:

```ts
const rows = (await Bun.file(TRAIL).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const band = rows.filter((r) => r.msSincePrev >= 3000 && r.msSincePrev < 10000);
const perPhase = (k) => band.reduce((a, r) => a + (r.phases?.[k] ?? 0), 0);   // Tabelle 1
const bySite = new Map();                                                     // Tabelle 2
for (const r of band) for (const [ph, t] of Object.entries(r.phaseSum ?? {})) {
  const e = bySite.get(`${ph} ${t.at}`) ?? { ms: 0, n: 0 };
  bySite.set(`${ph} ${t.at}`, { ms: e.ms + t.ms, n: e.n + t.n });
}
```

Symbolnamen: die naechste umschliessende `function`/`const … = async`/Pfeil-Definition oberhalb
der Zeile, fuer alle 15 von Hand gegen den Baum geprueft.

## Was nicht gemessen wurde

- Kein Lauf mit gekuerzter Wartezeit. Die drei Wartefenster sind aus Wartedauer und Code
  abgeleitet. Erst ein Umschalt-Lauf beweist sie; genau das tun die Schnitte unten.
- `rest` (88 s) ist nicht weiter zerlegt. Die 780 `spawnSync`-Aufrufstellen, `setTimeout`- und
  WebSocket-Wartezeiten landen dort.
- Die Prioritaet bucht ueberlappende Zeit an die hoehere Phase. Ein offener Hintergrund-fetch
  verdeckt darum Sleeps (Beispiel `e2e/review.ts` oben). `http` heisst „ein Request war offen",
  nicht „nur auf HTTP gewartet".
- Nur ein Messlauf auf einem Host. Die Second-host-Phasen gingen mit dem Klon verloren.

## Ausgang

Drei Schnitt-Zeilen, gerankt nach gemessenen Sekunden. Die MAIN filet sie.

**1 · Git-Tick-Latenz der Suite beweisen und schneiden (199 s)**
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: klein
- FLAECHE: `e2e-isolated.sh` (Server-Env), `e2e/security.ts` (feste `GIT_TICK_MS`-Konstante liest die Env), `e2e/pins.ts` falls ein Pin den Wert haelt
- VERIFY: install, pins, tsc, build; zwei `./e2e-isolated.sh`-Laeufe auf demselben Baum mit und ohne `FLEET_GIT_TICK_MS=2000`, beide mit `phases`; Auswertung wie in `docs/messungen/2026-09-14-suite-wartezeit-phasen.md` §Methode
- DONE: ALL PASS mit dem kuerzeren Tick; `phaseSum` sleep an `e2e/programs.ts#waitDoneLooking` sinkt von 190,7 s auf ≤ 60 s und an `e2e/security.ts#agentOf` von 33,0 s auf ≤ 12 s; der Lauf ohne Umschaltung reproduziert die Ausgangszahl ±15 %. Bleibt die 6–10-s-Haeufung trotz 2-s-Tick, ist die Git-Tick-Zuordnung widerlegt, und das steht dann als Ergebnis in der Notiz.

**2 · Boot-Grace-Konstanten fuer die Suite einstellbar machen (187 s)**
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: mittel
- FLAECHE: `server.ts#FOUNDING_BOOT_GRACE_MS`, `server.ts#SEND_BOOT_WAIT_MS` (Env-Override mit Produktions-Default), `e2e-isolated.sh`, `e2e/pins.ts`
- VERIFY: install, pins, tsc, build; `./e2e-isolated.sh` mit gesetzten Suite-Werten; `./e2e-claude-gate.sh`, weil der Zustellpfad beruehrt ist
- DONE: ohne Env bleiben die Produktionswerte 4 000/3 000 (Pin); ALL PASS mit Suite-Werten; `phaseSum` http an den `beginBootstrap`-Aufrufstellen sinkt von 143,3 s um ≥ 50 %, und sleep in `e2e/tasks.ts#dispatchAndRead` + `#rowAfter` sinkt von 43,7 s um ≥ 40 %; kein Check, der die Grace selbst prueft, verliert seine Gegenprobe.

**3 · Merge-Idle-Gate der Suite senken (145 s)**
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: klein
- FLAECHE: `e2e-isolated.sh` (`FLEET_MERGE_IDLE_MS`), `e2e/pins.ts` (Suite-Wert), Checks, die das Idle-Gate selbst verweigern lassen (`e2e/lane-helpers.ts#settleForMerge`-Aufrufer in `e2e/merge.ts`)
- VERIFY: install, pins, tsc, build; `./e2e-isolated.sh` und `./e2e-clean-review.sh` (Merge-Pfad) mit `FLEET_MERGE_IDLE_MS=500`, beide mit `phases`
- DONE: ALL PASS in beiden Suiten; `phaseSum` sleep an `e2e/lane-helpers.ts#settleForMerge` sinkt von 145,4 s auf ≤ 50 s; die Idle-Gate-Verweigerungs-Checks bleiben rot bei Pane-Output innerhalb des Fensters (Gegenprobe im Lauf nachgewiesen).

---

## Nachtrag 2026-09-16: die drei Schnitte, gemessen

Die drei Schnitt-Zeilen oben wurden als EINE Lane umgesetzt (`fleet/260916142521-8d9d`) — sie
aendern dieselbe `SRV_ENV`-Zeile und dieselbe Pin-Datei, parallel waeren sie ein Textkonflikt.
Vier Server-Wartefenster sind jetzt Env-Knoepfe, deren UNGESETZTER Wert das Produktions-Literal
ist (gepinnt in `e2e/pins.ts`, wo keine Suite-Env hinreicht); `e2e-isolated.sh` setzt sie auf
`FLEET_MERGE_IDLE_MS=500`, `FLEET_GIT_TICK_MS=2000`, `FLEET_FOUNDING_BOOT_GRACE_MS=750`,
`FLEET_SEND_BOOT_WAIT_MS=500`. Kein Baseline-Lauf, wie beauftragt: verglichen wird gegen die
Zahlen dieser Notiz. Methode unveraendert (§Methode).

| `phaseSum` | 2026-09-14 | Lauf 1 | Lauf 3 | Ziel |
| --- | ---: | ---: | ---: | --- |
| sleep `e2e/programs.ts#waitDoneLooking` | 190,7 s | 20,9 s | 24,5 s | ≤ 60 s ✔ |
| sleep `e2e/security.ts#agentOf` | 33,0 s | 9,0 s | 9,0 s | ≤ 12 s ✔ |
| sleep `e2e/lane-helpers.ts#settleForMerge` | 145,4 s | 24,1 s | 22,7 s | ≤ 50 s ✔ |
| http an den `beginBootstrap`-Aufrufstellen | 143,3 s (n=43) | 52,1 s (n=43) | 52,6 s (n=44) | −50 % ✔ (−63 %) |
| sleep `#dispatchAndRead` + `#rowAfter` | 43,7 s | 15,0 s | 15,7 s | −40 % ✔ (−65 %) |
| **sleep `e2e/lane-helpers.ts#waitMerge`** | **90,7 s** | **140,7 s** | **148,8 s** | GEGENBEWEGUNG |
| Spanne (erster bis letzter Check) | 2 224,7 s | 1 626,8 s | 1 682,6 s | −25 bis −27 % |

**Die Git-Tick-Zuordnung haelt.** Sie war in dieser Notiz abgeleitet, nicht bewiesen. Mit 2 s
Tick faellt `waitDoneLooking` um 87 % und `agentOf` exakt auf das Dreifache des Tick-Sleeps
(3 × 3 s statt 3 × 11 s) — das ist die Konstante, die dort wartet, und sie liest die Env jetzt.

**Die Gegenbewegung ist echt und reproduziert.** `waitMerge` wartet auf Server-Arbeit, nicht auf
ein Fenster, und steigt in beiden Laeufen um 50–58 s. Hypothese, NICHT gemessen: der fuenfmal
haeufigere `tickGit` streitet sich mit den Merges um den git-Index der Lane-Worktrees — die Naht,
die `e2e/lane-helpers.ts:176` schon benennt. Wer sie messen will, braucht einen Lauf mit
`FLEET_GIT_TICK_MS=2000` nur fuer `deploy-facts` und 10 000 sonst. Netto bleiben −540 bis −600 s.

**Was die Verkuerzung sichtbar gemacht hat — zwei Befunde, kein Nebenprodukt.**

1. **`server.ts#briefAndSend` liess die Quiet-Hours-WAIVER am Post-Spawn-Gate fallen** (behoben in
   dieser Lane). `tickDispatch` waivt Quiet Hours fuer genau ein Paar — aktiver Program-Grant und
   MASCHINEN-freigegebene Zeile —, spawnt die Lane, und das Gate danach fragte dieselbe Frage OHNE
   den Waiver, hielt die Zeile mit `dispatch held (quiet-hours) — requeued` und riss ihre Lane
   wieder ab. In Produktion ist das JEDE solche Zeile ueber das ganze Fenster, ein Worktree pro
   Versuch angelegt und entfernt — genau der Stau, den der Grant beenden soll. Unsichtbar war es,
   weil die Zeile fuer die Dauer der Boot-Grace `sent` liest: bei 4 000 ms las jede Sonde einen
   Start, bei 750 ms nicht mehr. `e2e/pins.ts` haelt jetzt beide Leser gegeneinander.
2. **Zwei Fixtures ruhten auf einem Fenster statt auf einer Tatsache** (beide repariert, keine
   Gegenprobe aufgeweicht): der Backlog-Nudge-Block nahm an, „A sondieren, 200 ms warten, B
   sondieren" mache A zum laengst-idlen Main — der Aktivitaets-Stempel wird aber innerhalb des
   Post-Attach-Quiet-Fensters unterdrueckt (`server.ts`, `s.quietUntil`), und da die Boot-Adoption
   Slot fuer Slot laeuft, kippt die Reihenfolge. Jetzt wird sie ETABLIERT (B wird sondiert, bis der
   Server selbst B als juenger liest) und mit beiden Zahlen behauptet. Und `program-dispatch (6)`
   pflanzte seinen v2-Satz in `fleet.json`, waehrend der Server lief und ihn ueberschreiben konnte;
   jetzt steht der Server dabei.

## Nachtrag 2026-09-16 (zweiter, spaeter am selben Tag): die Ruecknahme zu Punkt 2 und das Register

**Punkt 2 oben ist fuer den Backlog-Nudge-Block ZURUECKGENOMMEN: er ist nicht repariert.** Das
Etablieren der Reihenfolge (B sondieren, bis der Server B als juenger liest) stellt die Praemisse
nur fuer den Augenblick ihrer Messung her. Der Lauf, aus dem die DONE(b)-Zahlen dieser Notiz
stammen — `isolated-20260916T185756Z-92628`, Baum `2f11ee72`, `dirty:false`, Spanne 1 650,1 s —
hat die Setup-Zeile GRUEN (`delta=31ms`) und die Kopfzeile trotzdem ROT. Zwischen Herstellung und
Runde liegen ein `POST /api/lanes` und mehrere Tick-Wartezeiten; eine zweistellige
Millisekunden-Marge ueberlebt das nicht zuverlaessig.

**Registerauswertung, 8 631 Trail-Laeufe** (eigene Abfrage ueber `e2e-trail/` im Haupt-Checkout;
545 Laeufe haben die Kopfzeile ueberhaupt gefahren, 6 davon rot = 1,1 %). Nach DETAIL statt nach
Check-Namen getrennt sind das drei Signaturen: **S1** „ein Prompt, an B statt A, Setup gruen" —
2 Sichtungen, **beide auf Baeumen dieser Lane** (`9b296576` dirty 14:38, `2f11ee72` clean 18:57),
0 von 536 auf allen anderen Baeumen; **S2** „zwei Prompts in einer Runde" — 1 Sichtung auf
`037d246349cd` (Ancestor von main, 2026-08-26), auf der Fixture-Fassung, die die Reihenfolge noch
ANNAHM; **S3** — 3 Sichtungen (`1ba06c2b2638`, `519ff13ee95a`, `69c98c72ab2e`) mit ROTER
Setup-Zeile, also UNGEMESSEN und §11.2p, nicht diese Familie. Vollstaendig mit Belegen in
`docs/verify-tiering.md` §11.2y.

**Beide S1-Sichtungen liefen MIT den verkuerzten Fenstern** — auch die um 14:38, vor dem Commit:
ihre Spanne ist 1 626,8 s gegen 2 224,7 s der Baseline, der Schnitt war also im dirty-Baum. Die
Entlastung „aelter als der Schnitt" haelt fuer S1 damit nicht.

**Was am Code entschieden ist und keinen Lauf mehr braucht:** die Verkuerzung haengt NICHT an
`s.quietUntil`. Dessen sechs Schreiber in `server.ts` tragen drei Breiten (`+1500` nach
`pipe-pane`, `= 0` beim Teardown, `+OWN_PASTE_QUIET_MS`/`+OWN_PASTE_QUIET_TAIL_MS` im Sende-Pfad,
`+1500` am Resize); keiner liest `FLEET_FOUNDING_BOOT_GRACE_MS` oder `FLEET_SEND_BOOT_WAIT_MS`.
`FOUNDING_BOOT_GRACE_MS` ist ausschliesslich `Bun.sleep` an sieben Gruendungs-Aufrufstellen;
`SEND_BOOT_WAIT_MS` begrenzt nur die Alive-Probe in `sendText`, deren Quiet-Fenster unmittelbar vor
`paste-buffer` scharf wird — es haengt am Paste, nicht an der Wartezeit davor. Die einzige
env-gespeiste Breite (`OWN_PASTE_QUIET_MS = 150 + 3 * ACCEPT_WAIT_MS + 2000`) haengt an
`FLEET_ACCEPT_WAIT_MS`, und das ist in der `SRV_ENV`-Zeile unveraendert 800. Der Pfad, der das Rot
erzeugt, benutzt `sendText` ohnehin nicht: `e2e/harness.ts#paneEnv` fährt tmux direkt.
**Bewegt hat die Verkuerzung den BEOBACHTUNGSMOMENT der Fixture gegen das feste 1 500-ms-Fenster
des Servers — dass das die 2 von 9 erklaert, ist NICHT gemessen und wird hier an keinen Knopf
geheftet.**

**Grenze der Stichprobe, die das nicht klaeren konnte:** `FLEET_E2E_SHARD=2/8` (~520 s, Einheit
`core` allein) auf ruhiger Maschine, 3 gueltige Gruene; ein vierter Lauf wurde nach 924 s
Lock-Wartezeit OOM-getoetet und zaehlt nicht. Die S1-Rote fielen auf einer Maschine, die parallel
Suiten fuhr. Drei Gruene heissen „reproduziert nicht unter 2/8", NICHT „Flake weg". Beendet am
2026-09-16 per MAIN-Entscheid zugunsten der Registerauswertung.

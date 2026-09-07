---
datum: 2026-09-07
bereich: [audit, helper-portal, suite-kontention, verify]
urteil: "Die Gnadenfrist hat den heutigen Fall nicht verursacht — ihre UHR ist der Defekt: sie läuft ab dem Land, nicht ab dem Moment, in dem der Eintrag überhaupt erst nehmbar wird, und in 3 von 5 lokalen Läufen war sie beim Zugriff seit 3,4–30,8 min abgelaufen, während der Helfer 5–14 ms zuvor frei geworden war"
---

# Audit-Platzierung: warum lokal gewählt wird, und was das kostet

Diagnose- und Vertragsnotiz, kein Bau. Erhoben am 2026-09-07 aus dem Ledger dieser Maschine.
Es wurde keine Suite gestartet, kein Server gestartet, keine `.env` und kein `watchdog.sh`
geändert. Alle Uhrzeiten sind **UTC** (lokal = UTC+2).

## Ergebnis in einem Absatz

Die Platzierungsentscheidung hat heute **zwei verschiedene Fehlerbilder**, nicht eines. Das
häufigere (3 von 5 lokalen Voll-Läufen) ist die **Übergabesekunde**: der lokale Drain startet
5–14 ms nachdem der Helfer sein eigenes Ergebnis für dasselbe Repo gemeldet hat — also in
genau dem Moment, in dem der Helfer beweisbar frei ist. Die Gnadenfrist greift dort nicht,
weil ihre Uhr am **jüngsten Cover** hängt und nicht am Moment, in dem der Eintrag nehmbar
wird: sie war beim Zugriff seit 204 806 ms, 848 351 ms bzw. 1 846 864 ms abgelaufen, verbraucht
während der Eintrag hinter dem Claim desselben Repos lag. Das seltenere (2 von 5) ist der
**belegte Helfer**: die 60 s liefen korrekt ab, der Helfer hielt eine Lane-Vorschau, der Deckel
`maxParallelSuites` ließ ihn die Liste gar nicht erst abfragen. Beide Fehlerbilder kosten
dasselbe: die reine Suite-ARBEIT eines lokalen Laufs (2 418–2 551 s) ist länger als der
GESAMTE Rundlauf des Helfers vom Claim bis zum Ergebnis (2 145–2 295 s).

## Methode und Beweisgrenze

Gelesen: `post-land-audits.jsonl` (522 Zeilen, davon 14 mit `at` am 2026-09-07),
`audit.jsonl` (41 175 Zeilen, 82 Helfer-Ereignisse am 2026-09-07), fünf lokale Trail-Dateien
unter `$TMPDIR/fleet-e2e-trail/`, `.env` (nur die Schlüsselnamen, keine Werte gedruckt),
`watchdog.sh`, `server.ts`, `helper-daemon/daemon.ts`, `helper-daemon/config.example.json`.

**Nicht gemessen, ausdrücklich:**
- **Der Helfer selbst.** Kein SSH-Zugang aus dieser Lane; der im Brief verlangte
  `journalctl`-Auszug fehlt vollständig. Jede Aussage über die Fern-Maschine stammt aus
  Server-seitigen Ledger-Zeilen (`remote.name`, `helper_claim`/`helper_result`) und aus dem
  im Repo eingecheckten Daemon-Quelltext, nie aus ihrer eigenen Beobachtung.
- **Die live geladene Daemon-Konfiguration** (`pollSec`, `maxParallelSuites`). Die Zahlen
  unten sind der Default aus `helper-daemon/config.example.json` (15 s / 1), gestützt durch
  eine beobachtete Claim-Latenz nach einem Angebot von 5–20 s in 10 von 12 Fällen
  (`audit.jsonl`), nicht durch die Datei auf jener Maschine.
- **Warum ein lokaler Voll-Lauf ~5 min länger arbeitet als der Helfer-Rundlauf.** Der
  Unterschied ist gemessen, seine Ursache (CPU, Platte, Checkanzahl, Fern-Vorbereitung) nicht.
- **Die interne Zeitaufteilung des Helfers.** Sein `suite.log` trägt keine Zeitstempel je
  Zeile; Clone, Install und Suite sind aus der Ledger-Dauer nicht trennbar.
- **Ob die beiden `unknown`-Zeilen lokal liefen**, ist an ihrer eigenen Zeile nicht
  entscheidbar — sie tragen keine `run`-id. Der Beleg unten ist ihr Trail (siehe §Zuordnung).

## Der Vorfall am Ledger

Zeilennummern sind Zeilen in `post-land-audits.jsonl`.

| Fakt | Zeit (UTC) | Beleg |
|---|---|---|
| Helfer claimt `b2ab2cf` | 05:21:21.926 | `audit.jsonl:40492` |
| Cover `…-519b` landet | 05:29:59 | `post-land-audits.jsonl:513`, `covers[0].at` |
| Cover `…-ca39` landet | 05:42:50 | ebenda, `covers[1].at` — Gnadenfrist endet 05:43:50 |
| Helfer meldet `b2ab2cf` grün | 05:57:58.353 | `audit.jsonl:40552`, Zeile 512 (2 196 416 ms, 3792/0) |
| Lokaler Drain startet | 05:57:58.358 (**+5 ms**) | Zeile 513, `startedAt` |
| Lokaler Lauf stirbt ohne Urteil | 06:42:58.705 (2 700 347 ms) | Zeile 513, `checks:null` |

Die Kette des Briefs ist an drei Stellen zu korrigieren, und alle drei Korrekturen zeigen in
dieselbe Richtung:

1. **Die 60 s haben hier nichts verzögert.** Der Eintrag war ab 05:43:50 gnadenfrist-frei; er
   lag danach 14 min ausschließlich deshalb still, weil `server.ts#helperClaimOf` **pro REPO**
   sperrt — der laufende Claim auf `b2ab2cf` blockierte auch die neuen Cover desselben Repos.
   Die Gnadenfrist war also längst verbraucht, als der Eintrag zum ersten Mal wählbar wurde.
2. **Es standen keine drei Lane-Suiten vor dem Audit im Mutex.** Der aufbewahrte Tail der
   Zeile 513 sagt `position 2 of 2 — held by live pid … (up 40:52): /bin/sh ./e2e-isolated.sh`:
   EIN Halter, EIN Wartender. Dasselbe hat `docs/messungen/2026-09-07-verifikation-zielbild.md`
   an den Angebots-/Rückzugszeiten (98 025 / 203 150 / 73 185 ms statt dreimal 180 s) belegt.
3. **`acquired after 1576s` ist Schlange, nicht Vorlauf** — und der Vorlauf war ~6 s, nicht
   1 124 s (siehe §Zuordnung unten; dies korrigiert auch den Commit-Body von `c7184f85`).

## Zuordnung: welcher Lauf lief wo, und woraus die Zeit bestand

`remote.name` nennt den Helfer; fehlt es, lief der Eintrag lokal. Für die beiden `unknown`-
Zeilen greift dieser Sensor nicht (keine `run`-id im aufbewahrten `out`), dort entscheidet der
lokale Trail: jede Trail-Datei trägt `run`, erste und letzte `ts`.

| Zeile | tip | Ergebnis | Ledger-Dauer | Wo | Trail-Datei (lokal) | erste→letzte `ts` | Checks |
|---|---|---|---|---|---|---|---|
| 509 | `f0bcea62` | green | 2 145 326 ms | Helfer | — | — | 3785 |
| 510 | `a1f8b65f` | **red** | 2 146 177 ms | Helfer | — | — | 3785 |
| 511 | `75367029` | green | 2 424 150 ms | **lokal** | `isolated-…T031829Z-24058` | 03:18:29→03:58:47 | 3785 |
| 512 | `b2ab2cfc` | green | 2 196 416 ms | Helfer | — | — | 3792 |
| 513 | `5b676958` | **unknown** | 2 700 347 ms | **lokal** | `isolated-…T062420Z-17389` | 06:24:20→06:42:57 | 2042 von 3835 |
| 514 | `19ddef50` | green | 2 212 388 ms | Helfer | — | — | 3806 |
| 515 | `1846a268` | **unknown** | 2 700 643 ms | **lokal** | `isolated-…T081923Z-33811` | 08:19:23→08:57:21 | 3420 von 3835 |
| 516 | `c7184f85` | green | 2 224 695 ms | Helfer | — | — | 3824 |
| 517 | `94a8840a` | green | 2 261 889 ms | Helfer | — | — | 3832 |
| 518 | `01c3b35b` | green | 2 559 024 ms | **lokal** | `isolated-…T121815Z-11958` | 12:18:15→13:00:46 | 3835 |
| 519 | `9e766050` | green | 2 557 551 ms | **lokal** | `isolated-…T130744Z-31136` | 13:07:44→13:50:14 | 3853 |
| 521 | `974ea006` | green | 2 294 496 ms | Helfer | — | — | 3880 |

(Die Zeilen 520 und 522 sind proportionale Kurzketten, 2 s und 439 Checks — sie werden dem
Portal per Vertrag nie angeboten und sind für die Platzierungsfrage bedeutungslos.)

Daraus die **Zeitaufteilung der beiden Todesfälle**, ohne Schätzung, weil `startedAt`, die
`acquired after`-Zeile und die erste Trail-`ts` zusammenpassen:

- Zeile 513: ~6 s Vorlauf · **1 576 s Mutex-Schlange** · 1 117 s Arbeit (2042 von 3835 Checks) = 2 699 s.
- Zeile 515: ~5 s Vorlauf · **394 s Mutex-Schlange** · 2 278 s Arbeit (3420 von 3835 Checks) = 2 677 s.

**Korrektur an einem gelandeten Commit-Body:** `c7184f85` zerlegt dieselbe Zeile 513 als
„1 124 s Vorlauf + 1 576 s Schlange + 0 s Messung". Der Trail widerlegt beide Randterme: der
Lauf begann 6 s nach dem Spawn zu warten und hat nach dem Zuschlag 2 042 Checks geschrieben.
Der Irrtum ist erklärbar und ohne Schuld: der aufbewahrte `out` **beider** Vor-Fix-Zeilen endet
auf ihrer `acquired after`-Zeile, obwohl Zeile 515 danach nachweislich 38 min gemessen hat —
vor `c7184f85` wurde die Ausgabe erst am Ende gelesen, und der blockgepufferte Suite-Ausgabeteil
eines SIGKILLten Kindes geht verloren, während die Shell-eigenen `[suite-lock]`-Zeilen
durchkommen. **Das Ende von `out` datiert also nicht das Ende der Arbeit.** Der Schnitt von
`c7184f85` bleibt davon unberührt richtig; nur seine Beispielrechnung ist es nicht.

## Die zwei Fehlerbilder der Platzierung

Für jeden lokalen Lauf: `graceRest` = (jüngstes Cover + 60 000 ms) − `startedAt`;
`Δ Helfer` = `startedAt` minus dem letzten `helper_result` desselben Repos davor.

| Zeile | `graceRest` | Δ Helfer | Zustand des Helfers | Fehlerbild |
|---|---|---|---|---|
| 511 | −204 806 ms | **+7 ms** | meldete gerade `a1f8b65f` rot | F1 Übergabesekunde |
| 513 | −848 351 ms | **+5 ms** | meldete gerade `b2ab2cfc` grün | F1 Übergabesekunde |
| 515 | −1 846 864 ms | **+14 ms** | meldete gerade `19ddef50` grün | F1 Übergabesekunde |
| 518 | −14 ms | +1 922 902 ms | hielt Vorschau `…-ced0` bis 12:23:58 | F2 belegter Helfer |
| 519 | −1 ms | +4 891 916 ms | hielt Vorschau `…-4336` bis 13:08:59 | F2 belegter Helfer |

**F1 — die Übergabesekunde (3 von 5).** `server.ts#helperResult` löscht den Claim und ruft im
selben synchronen Block `kickAuditDrain()`; der Drain wählt und markiert
`auditRunningRepo = repo` ohne ein einziges `await` dazwischen. Der Helfer, der eine
Millisekunde zuvor bewiesen hat, dass er frei ist, erfährt frühestens beim nächsten Poll
davon. Die Gnadenfrist kann das strukturell nicht abfangen: sie ist ein fester Versatz auf
`cover.at`, und ein Eintrag, der hinter einem Claim lag, bringt sie aufgebraucht mit.
**Die Uhr ist der Defekt, nicht die Länge.**

**F2 — der belegte Helfer (2 von 5).** Hier lief alles wie entworfen: die 60 s liefen ab
(`graceRest` −14 ms und −1 ms — das ist der `armAuditGraceKick`-Timer, der auf die Millisekunde
genau feuert), und der Drain nahm den Eintrag. Der Helfer konnte ihn nicht nehmen, weil
`helper-daemon/daemon.ts#tick` bei `freeSuiteSlots(...) <= 0` **zurückkehrt, bevor es die
Jobliste überhaupt anfragt**. Die Gnadenfrist wurde also einer Maschine gewährt, die in diesen
60 s beweisbar nicht claimen konnte — `server.ts#helperClaimCandidateExists` fragt ausdrücklich
NICHT, ob das Gerät schon einen Claim hält (der Kommentar dort nennt das als bewusste Wahl).

## Die drei Code-Belege des Auftrags

**(a) Wo die Gnadenfrist ausgewertet wird, und dass sie ohne Helfer nichts kostet.**
`server.ts#drainPostLandAudits` bildet je Schleifendurchlauf
`graceOn = AUDIT_HELPER_GRACE_MS > 0 && helperClaimCandidateExists()`. Ist `graceOn` falsch,
verlässt der Auswahl-Prädikator den Eintrag über `if (!graceOn) return true` — kein Timer, kein
Skip, keine Latenz. `server.ts#helperClaimCandidateExists` verlangt drei Ja: der Wunsch des
Owners (`desiredMode`, unbesetzt = `active`), die Selbstauskunft des Geräts (`quiet` claimt nie)
und die Uhr (`HELPER_FRESH_MS`). Es fragt bewusst nicht nach einem bereits gehaltenen Claim.
Ein Kurzketten-Eintrag wird zusätzlich VOR der Gnadenfrist durchgelassen
(`entryRunsShortChain` → `return true`), damit ein Sekundenjob nie auf ein Fremdgerät wartet.
`server.ts#armAuditGraceKick` hält genau EINEN Timer und weckt den Drain zum frühesten
`readyAt` — was die −14 ms und −1 ms der Zeilen 518/519 erklärt.

**(b) Warum ein einmal lokal gestarteter Eintrag nicht mehr übernehmbar ist — präzisiert.**
Er verschwindet NICHT aus dem Portal: `server.ts#helperJobsView` listet ihn weiter, mit
`localRunning: auditRunningRepo === repo || runningPostLandAudit?.repo === repo`. Zwei andere
Stellen machen ihn unnehmbar: `helper-daemon/daemon.ts#tick` filtert
`!j.claim && !j.localRunning` heraus, und `server.ts#helperClaim` antwortet 409 („the local
drain is already auditing this tree — nothing to take over"), einmal vor und einmal nach dem
Bundle-Bau. Die Covers werden erst NACH dem Lauf konsumiert
(`q.covers.splice` in `drainPostLandAudits`), der Eintrag existiert also die ganze Zeit — was
fehlt, ist eine **übertragbare Wartephase**, nicht eine Listenzeile. (Dieselbe Präzisierung
steht in `docs/messungen/2026-09-07-verifikation-zielbild.md`; sie wird hier nicht neu
begründet, sondern bestätigt und um F1 ergänzt.)

**(c) Wie das Arbeitsbudget die Mutex-Wartezeit mitzählt.** Seit `c7184f85` gibt es zwei Uhren:
`server.ts#runPostLandAudit` bewegt sie in seinem `arm()` an den `[suite-lock]`-Zeilen des
Kindes zwischen `POSTLAND_AUDIT_WAIT_MS` (wartend) und `POSTLAND_AUDIT_TIMEOUT_MS` (arbeitend);
das Arbeitsbudget bekommt die nachgewiesene Wartezeit als Gutschrift, gedeckelt aufs
Wartebudget. **Was das nicht abdeckt:** alles vor der ersten `[suite-lock]`-Zeile (Snapshot,
`bun install`, das Staging des Wrappers) bleibt Arbeit — heute ~5–6 s, also unkritisch, aber
strukturell unattribuiert. Das ist genau die Naht, die die Queue-Zeile `ff4544f5` behauptet;
sie wird hier **verwiesen, nicht gedoppelt** — ihre eigenen Zahlen (15 Timeouts in 500 Zeilen,
p50 1 001 454 ms, 45-min-Decke) sind seit `61e407d` (Arbeitsbudget 45 → 75 min, live ab dem
Server-Neustart 15:51 lokal) überholt. Der in `c7184f85` benannte Deploy-Akt
(`FLEET_POSTLAND_AUDIT_WAIT_MS` in die srv-Spawnzeile) ist **nicht ausgeführt**; folgenlos, weil
der Default denselben Wert trägt — aber der Wert ist damit implizit statt konfiguriert.

## Was die beiden heute gelandeten Änderungen bereits erledigen

Gegenrechnung mit den gemessenen Termen oben, ausdrücklich ein Kontrafaktual:

- Zeile 513 hätte unter `c7184f85` ein Budget von 2 700 s + 1 576 s Gutschrift = 4 276 s gehabt
  und ~4 082 s gebraucht (6 + 1 576 + ~2 500 s voller lokaler Arbeit) → **Urteil statt `unknown`.**
- Zeile 515: 2 700 s + 394 s = 3 094 s gegen ~2 959 s Bedarf → **ebenfalls Urteil.**

**Die Timeouts sind damit adressiert, die Platzierung nicht.** Was ohne Platzierungs-Schnitt
bleibt, ist Latenz und Maschinenzeit: die reine Suite-Arbeit eines lokalen Laufs liegt bei
2 418–2 551 s und damit über dem gesamten Helfer-Rundlauf von 2 145–2 295 s; dazu kommt in
F1-Fällen die Wartezeit hinter einem fremden Suite-Halter (heute 394 s und 1 576 s), die der
Helfer nicht hat (`acquired after 0s` in beiden im Zielbild-Dokument gehashten Helfer-Logs).
Der Vorrat schrumpft zusätzlich mit `checks.ran` (3785 → 3880 an einem Tag).

## Die Optionen

Keine davon wird hier gebaut. Der Vertragssatz ist ein VORSCHLAG an die Program-MAIN (Slot 7);
die Land-Pipeline (Slot 5) besitzt die Land-Gate-Seite und ist von jeder Option unberührt.

**(i) Gnadenfrist auf die Größenordnung einer Helfer-Suite heben (~40 min).**
*Deckt:* F1 und F2 — alle fünf lokalen Läufe von heute wären an den Helfer gegangen (die drei
F1-Einträge waren beim lokalen Start 4,4 / 15,1 / 31,8 min nach ihrem jüngsten Cover, also
alle unter 40 min; in F2 wurde der Helfer 5,8 min bzw. 1,4 min nach dem lokalen Start frei). *Kostet:* im Worst Case die volle Frist als reine Latenz, wenn
der Helfer online, aber dauerhaft belegt ist — und das war er heute den ganzen Tag
(19 Vorschau-Angebote, 12 davon vom Helfer geclaimt, `audit.jsonl` 2026-09-07). Ohne Helfer kostet sie nichts (`graceOn` ist dann
falsch). *Antwort auf die Frage des Briefs:* nein, nicht immer besser — sie ist besser, solange
die Restlaufzeit des Helfers kleiner ist als die Mac-Schlange plus die ~5 min Mehrarbeit, und
genau diese Restlaufzeit misst heute nichts.
*Vertragssatz:* „Ein nicht-proportionaler Audit-Eintrag wartet bis zu N ms auf ein claim-fähiges
Fremdgerät, bevor der lokale Drain ihn nimmt; ohne solches Gerät wartet er nie."
*Done-Sätze eines späteren Baus:* (1) bei `helperClaimCandidateExists() === false` ist die
Startlatenz eines Eintrags unverändert (Sonde: Skip-Pfad wird nicht betreten); (2) ein Eintrag,
dessen Frist abläuft, während kein Gerät claimt, startet lokal spätestens `N ms + Tick` nach dem
jüngsten Cover; (3) ein Gerät, das innerhalb von N claimt, gewinnt.

**(ii) Re-Offer eines WARTENDEN Eintrags, bis er wirklich startet.**
*Deckt:* nichts an F1 — und das ist der wichtigste Befund zu dieser Option. In allen drei
F1-Fällen gibt es überhaupt keine Wartephase: der Eintrag geht in 5–14 ms von
„claim-blockiert" nach „lokal committet". *Deckt* F2 nur, wenn der Deckel des Helfers
zwischenzeitlich frei wird, was dort erst 1,4–5,8 min nach dem lokalen Start geschah.
*Wo „wartend" von „laufend" im Code trennbar wäre:* die Grenze ist heute
`auditRunningRepo = repo` in `server.ts#drainPostLandAudits` — davor gibt es keinen
persistierten Wartezustand, und `server.ts#reportServerRun` publiziert `running` erst danach.
Ein Re-Offer bräuchte also zuerst diesen dritten Zustand, nicht nur eine Listenregel.
*Risiken laut Astra, am Code geprüft:* Doppelclaim ist bereits verriegelt (`helperClaim` prüft
`auditRunningRepo` zweimal, vor und nach dem Bundle-Bau); der wechselnde Executor ist real
(`remote.name` müsste den tatsächlichen Ausführer tragen); Budget: ein zusätzlicher Bundle-Bau
je Re-Offer.
*Vertragssatz:* „Ein Audit-Eintrag hat einen sichtbaren Zustand `waiting`, in dem er weiterhin
claimbar ist; `running` beginnt erst mit dem Spawn des Kommandos."
*Done-Sätze:* (1) ein Eintrag im Zustand `waiting` erscheint mit `localRunning:false` und wird
von `helperClaim` angenommen; (2) ein Claim während `waiting` verhindert den lokalen Spawn;
(3) es entsteht nie eine zweite Zeile für dieselbe `mainSha`.

**(iii) Lane-Suiten hinter Audits einreihen (Priorität im Ticket-Verfahren).**
*Deckt:* nur die Mac-Schlange, also 394 s und 1 576 s in den beiden Todesfällen — nicht die
2 418–2 551 s Arbeit, die den lokalen Lauf teuer machen. *Kostet:* die Fairness-Ordnung von
`d0befb9` (FIFO-Ticket) wird gebrochen, Lanes warten länger, und der Server umgeht die Schlange
über `holdSuiteLock` ohnehin schon. *Bewertung:* das kleinste Deckungsverhältnis der vier —
sie repariert den Term, den `c7184f85` bereits ehrlich bepreist hat.
*Vertragssatz:* „Ein Post-Land-Audit erhält im Suite-Ticket Vorrang vor jeder Lane-Vorschau."
*Done-Sätze:* (1) ein Audit-Ticket, das nach einem Lane-Ticket ankommt, erhält den Lock zuerst;
(2) kein Lane-Ticket verhungert (obere Schranke messbar); (3) ein Schritt innerhalb eines
fremden Holds reiht sich weiterhin nicht ein.

**(iv) Nichts tun, weil `FLEET_DISPATCH_MAX_LANES=1` die Konkurrenz senkt.**
*Widerlegt, mit zwei unabhängigen Messungen:* die der Program-MAIN (Zeile 518 lief mit
`waitMs 0`, also ohne jede Mutex-Konkurrenz, 2 559 024 ms gegen die damalige 45-min-Decke —
2,3 min Luft) und meine eigene Zerlegung von Zeile 511 (`isolated-…T031829Z-24058`: erste
Trail-`ts` 5 s nach `startedAt`, 2 418 s reine Arbeit, keine Schlange). **Ich widerspreche
nicht.** Zusätzlich: der Deckel adressiert F1 ohnehin nicht — dort ist der Konkurrent nicht
eine Mac-Lane, sondern die 15-Sekunden-Blindheit des Helfers in der Übergabesekunde.
*Vertragssatz:* entfällt.

**(v) Nicht im Brief, aber die kleinste Änderung, die F1 trifft: die Uhr der Gnadenfrist an
den Moment der Wählbarkeit hängen statt an `cover.at`.**
*Deckt:* alle drei F1-Fälle (60 s reichen: nach einem Angebot claimte der Helfer heute in
10 von 12 Fällen binnen 5–20 s; die beiden Ausreißer, 519 s und 1 331 s, fielen in Fenster, in
denen er belegt war). *Deckt nicht:* F2 — dort war die Frist ehrlich abgelaufen. *Kostet:* höchstens
60 s Latenz, und nur in der Übergabesekunde; ohne Fremdgerät weiterhin null. *Warum getrennt
von (i):* (i) ändert die LÄNGE, (v) die UHR — und die Messung sagt, dass in 3 von 5 Fällen die
Uhr das Problem war.
*Vertragssatz:* „Die Gnadenfrist eines Audit-Eintrags läuft ab dem Moment, in dem er für den
lokalen Drain zum ersten Mal wählbar wird — nicht ab dem jüngsten Land."
*Done-Sätze:* (1) ein Eintrag, der hinter einem Claim desselben Repos lag, erhält nach dessen
Freigabe volle N ms, in denen er claimbar bleibt; (2) ein Eintrag ohne vorangehenden Claim
verhält sich unverändert; (3) `helperClaimCandidateExists() === false` überspringt weiterhin
jede Wartezeit.

## Rangfolge, und wo sie abgeschnitten ist

Der Auftrag verlangt Diagnose und Vertragsvorschlag, nicht ein Programm. Nach Deckung der
gemessenen fünf Fälle: **(v)** deckt 3, **(i)** deckt 5 zum Preis einer unbeschränkten
Wartezeit gegen eine ungemessene Restlaufzeit, **(ii)** deckt 0 ohne einen vorher gebauten
dritten Zustand, **(iii)** deckt einen Term, den `c7184f85` schon bepreist, **(iv)** ist
widerlegt. Hier ist Schluss — die Wahl gehört der Program-MAIN.

## Vorschlag an `.env` (nur als Vorschlag, nicht ausgeführt)

Keiner. Beide heute vorgenommenen Werte-Änderungen (`c7184f85`s Zwei-Uhren-Schnitt, `61e407d`s
75-min-Arbeitsbudget) sind live und hätten die beiden Todesfälle verhindert; eine Erhöhung von
`FLEET_AUDIT_HELPER_GRACE_MS` ohne den Uhr-Schnitt aus (v) wäre die teure Hälfte der billigen
Reparatur. Wenn ein Wert vor einem Bau bewegt werden soll, dann `FLEET_POSTLAND_AUDIT_WAIT_MS`
explizit in die srv-Spawnzeile — nicht wegen seines Wertes, sondern weil ein Budget, das nur
als Default existiert, bei der nächsten Default-Änderung stillschweigend mitwandert.

# Die vier Erfolgskriterien von Program `f170dc46` (Fleet-Betrieb 2026-09), am Baum nachgemessen

Gemessen 2026-09-08 ~05:2x von der Program-MAIN (Slot 4) an `40c3e0a4`, gegen den LIVE-Server
(Listener pid 20128, Boot 02:21:01 — Sensor `lsof -nP -iTCP:8790 -sTCP:LISTEN`, nicht `pgrep`).

Anlass: die vier Kriterien standen seit der Gruendung ungeprueft, und zwei von ihnen zitieren
Task-Ids, die es nicht mehr gibt. Wer das nicht nachmisst, fuehrt erledigte Arbeit als offen und
offene als unerreichbar. **Dies ist eine Messung, kein Urteil ueber den Program-Abschluss.**

## (a) „Keine Fleet-Lane ohne Program-Zuordnung mehr in der Queue" — NICHT ERREICHBAR, Owner-Entscheid faellig

Unveraendert gegenueber `48f2ea48` / `docs/messungen/2026-09-08-program-zuordnung-nachtraeglich.md`:
eine Zeile bekommt ihre `programId` ausschliesslich bei der Entstehung durch die program-gebundene
Self-Tuer. Es gibt keine Route, die sie nachtraeglich vergibt; `/adopt` ist das Kategorie-Verb
notiz→auftrag. Zwei eigene Zeilen belegen es von innen: `950d614d` und `fa8ac047` tragen
`programId: null, source: owner` **trotz** `[FLEET-BETRIEB …]` im Titel.

## (b) „S2 und 74d90c5e gelandet mit gruener Land-Note" — die Ids sind tot, die SACHE ist erledigt

Beide im Kriterium zitierten Ids sind aus `fleet.json` verschwunden (`0555828b`, `74d90c5e`) — eine
DRITTE Instanz der Klasse, die `7081f072` fuer `c9791a49`/`d51e02ca` vermessen hat, und die
teuerste: hier steht die tote Referenz im **bestaetigten Program-Inhalt selbst**, wo kein
Brief-Nachtrag sie einfangen kann.

- **S2 ist gelandet:** `940887dc` (2026-09-04 09:04:44), `git merge-base --is-ancestor 940887d main`
  sagt JA. Sein Post-Land-Audit `at=1788541056390` war **rot** (3628 ran / 2 failed) und ist
  **adjudiziert**: `audit-adjudications.jsonl at=1788541978493`, Verdikt `flake`, `by: owner`, mit
  kausalem Ausschluss (5/237 rot mit identischem Detail, zwei davon auf Baeumen AELTER als S2).
  Das Rot bleibt rot; das Urteil sagt, dass jemand hingesehen hat.
- **Die S2-Datenschicht ist LIVE, nicht nur gelandet:** `GET /api/self/program-execution` liefert
  heute genau die Schnitt-2-Felder — `main{slot,occupancy}`, `attention{open}`,
  `lanes{running,queued,waiting}`, `lastLand{sha,verifyOk,at}`,
  `lastAudit{result,fails,adjudicated}`, `deploy{codeBehind}`.
- **`74d90c5e` (Program-Ansicht) lebt heute als `7ed73694`** („LEBENSZYKLUS S12 · PROGRAM-BLICK").
  Seine eigene Freigabebedingung lautet woertlich „FREIGABE erst nach Land von S2" — sie ist
  seit `940887dc` erfuellt. Diese MAIN hat die Zeile am 2026-09-08 released (`releasedBy: machine`).

## (c) Die zwei Reparaturen — GELANDET UND GEPROBT, beide Haelften

| Reparatur | Code | Sonde in `e2e/` |
|---|---|---|
| Merge-Verdikt an die Program-MAIN statt an die Lane-Pane | `server.ts#deliverMergeVerdict` — der Empfaenger wird aus dem AKTOR gepinnt (`verdictTo`), und auf dem MAIN-Zweig faellt eine gescheiterte Zustellung **nicht** auf die Lane zurueck | `e2e/merge.ts`, neun `check()` der Familie „land verdict receiver", darunter woertlich „a receiver that is GONE is told nothing and the LANE is not told either — no fallback" und „an owner land records no receiver — absent is the lane, and stays the lane" |
| bounded Rebase+ff-Neuversuch | `ded6c34e`, `server.ts#mergeJob`: `LAND_FF_RETRY_ROUNDS` (`FLEET_LAND_FF_RETRY_ROUNDS`, Default 2) | `e2e/programs.ts:8054ff` fahren die Race ueber das produkteigene TEST-ONLY-Latch `FLEET_TEST_LAND_FF_LATCH` und pruefen die Land-Note dreifach: `ffRounds === 1`, `verify.ok === true`, `verify.mainSha === <intruder>` und `verify.out` enthaelt „run 2" |

Beide Commits liegen VOR dem Boot des laufenden Servers (`ded6c34e` 09-07 23:47, `6c70f01c` 09-07
11:25 gegen Boot 09-08 02:21:01) — sie sind also nicht nur auf main, sondern **im laufenden Code**.
**Gemessen ist die EXISTENZ der Sonden am Baum, nicht ein eigener Lauf** — sie fahren in
`./e2e-isolated.sh`, nicht im Land-Gate.

## (d) „Der Controller hat seit Gruendung keinen Merge mehr selbst gefahren" — EINMAL VERLETZT, dokumentiert

`40ee5965` am 2026-09-08 04:56:46, `landedBy {kind:owner, via:bearer,
suspect:owner-token-outside-board}` bei `programId f170dc46`. Der Controller (Slot 8) hat es selbst
gemeldet, bevor die MAIN es fand. Die mechanische Konsequenz ist als `fa8f6220` gefilt (pending) —
heute sagt einer Zeile nichts an, dass sie jemandem gehoert.

## Was diese Messung NICHT geprueft hat

Ob die Sonden aus (c) heute gruen LAUFEN (kein eigener `./e2e-isolated.sh`-Lauf; die letzte
Ledger-Zeile ist ein proportionaler Kurzketten-Audit). Den Inhalt der uebrigen sieben
Lebenszyklus-Zeilen. Ob `7ed73694`s Brief-Anker (`docs/program-lebenszyklus-architektur-2026-09-04.md`)
gegenueber dem heutigen `src/client.ts` noch stimmen — der Brief traegt die richtige Vorsichtsregel
(„was der Code widerspricht, gewinnt der Code"), aber geprueft ist sie nicht.

---

## Nachtrag 06:5x — der Post-Land-Audit dieses Lands ist ROT, und der Befund ist ein MESSFEHLER, kein Baumfehler

Waehrend dieser Messung feuerte der oben armierte Watch: Audit `at=1788843000681` auf Tip
`6207182d` (covers Land `40ee5965`) — **rot, 3973 ran / 1 failed**, und die eine Zeile ist eine
SETUP-Zeile: „ctl setup: the source tree resolves and carries an executable ctl.sh".

**Der Detailstring, aus dem Trail:** `src=unresolved ctl=-`. `e2e/ctl.ts#sourceTree` ruft
`resolveSourceTree(ROOT, readlinkSync(ROOT/node_modules), isWorkTree)` und bekam `null`.

Drei gemessene Folgen, aufsteigend nach Schaden:

1. **45 Checks sind ABWESEND, nicht gruen und nicht rot.** Nach der roten Setup-Zeile steht
   `if (!reachable) return;`. `grep -c 'check(' e2e/ctl.ts` = 46, und die Laufdifferenz zum
   benachbarten gruenen Audit ist exakt 45 (4018 ran gegen 3973 ran). Am Ledger steht „1 failed" —
   die 45 ungemessenen sieht dort niemand.
2. **Der ganze Lauf verliert sein Trail.** `trail-emit.ts#defaultDir` leitet das
   Trail-VERZEICHNIS aus demselben `SRC` ab. Loest SRC nicht auf, gehen die Zeilen nach
   `$TMPDIR/fleet-e2e-trail` mit `"tree": null` statt nach `<repo>/e2e-trail`. Damit fehlen
   **genau die Laeufe, in denen etwas schiefging, im Register**, das das Regelbuch zum
   Schiedsrichter jeder Flake-Frage macht. Beide Seiten belegt: die zwei Fehl-Laeufe
   (`isolated-20260907T220214Z-95830`, `isolated-20260908T040518Z-23356`) liegen in TMPDIR mit
   `tree: null`, die erfolgreichen im Repo mit echter Sha.
3. **Haeufigkeit 2 von 11** vollen Post-Land-Audits, seit `e2e/ctl.ts` am 2026-09-07 17:25 mit
   `fbe44b3d` landete.

**Was es NACHWEISLICH NICHT ist: Hostlast.** Die Laufzeit trennt die beiden Populationen nicht —
ein 85,8-min-Audit war gruen (`at=1788810175324`), ein 44,4-min-Audit war ctl-rot
(`at=1788821143810`). Ich hatte Last zuerst vermutet und die Vermutung an diesen zwei Zeilen
verworfen; sie steht hier, damit die naechste Leserin sie nicht neu aufstellt.

**Nebenbefund:** der Check-Name behauptet „an executable ctl.sh", das Praedikat ist aber nur
`existsSync(CTL)` — das execute-Bit wird nie geprueft.

**Stand:** als Zeile `b09cd2f9` gefilt (pending; der `auftrag`-Deckel stand auf 5/5 und wurde durch
die Freigabe von `fa8f6220` geoeffnet). **Die Adjudikation des roten Audits steht aus und ist
NICHT meine** — `POST /api/post-land-audits/adjudicate` ist owner-positioniert, es gibt keine
Self-Tuer, und ein Griff zum Owner-Token waere genau der Fehler, den `fa8f6220` abstellen soll.
Sachlage fuer den Urteilenden: die Zeile ist `stale-test`-artig (die Sonde konnte ihre eigene
Voraussetzung nicht aufloesen), NICHT `real` — der Baum ist auf diesen 46 Checks nie gemessen
worden.

## Nachtrag 08:1x (Nachfolge-MAIN, Slot 6) — die Kosten der S12-Wire-Frage, jetzt GEMESSEN

Die Vorgaengerin hat die Owner-Frage zu S12 mit einer ausdruecklichen Luecke gestellt: „ich habe
die Kosten NICHT gemessen. `/api/programs` ist der Board-Poll, und ob der Ledger-Kontext dort
gecacht ist oder je Poll von Platte liest, weiss ich nicht." Nachgemessen, mit dem Ergebnis, dass
ihre eigene Empfehlung faellt.

**1. Die Trennung selbst, unabhaengig nachgeprueft.** `GET /api/programs` liefert
`executionStatus` mit genau vier Feldern (`main`, `attention`, `inbox`, `lanes`); `lastLand`,
`lastAudit`, `deploy` sind absent. Mechanismus ist keine Auslassung, sondern eine benannte
Ueberladung: `server.ts#programStatusView` hat zwei Signaturen, und die Owner-Liste ruft die
kontextlose — der Kommentar dort sagt es woertlich („the owner list calls the no-context overload,
so its … reader gets only the in-memory half and never opens a ledger").

**2. `readLedger` hat KEINEN Cache** (`server/persist.ts#readLedger`): jeder Aufruf liest die
Datei ganz und `JSON.parse`t sie zeilenweise, ueber beide Rotationsgenerationen. Heutige Groessen:
`lane-outcomes.jsonl` 1 186 581 B, `post-land-audits.jsonl` 2 103 941 B, `audit-adjudications.jsonl`
61 951 B. Append-only, also wachsend.

**3. Laufzeit, je drei Laeufe gegen den laufenden Server:** `GET /api/programs` 0,01 s,
`GET /api/self/program-execution` (dieselben zwei Ledger, ein `Promise.all`) 0,02 s. Der Aufschlag
ist heute also **~10 ms je Poll** und haengt am LEDGER-WACHSTUM, nicht am Takt.

**4. Der Takt ist niedriger als befuerchtet:** `src/client.ts#PROGRAMS_FLOOR_MS` = 30 000, und
`loadPrograms` kehrt zusaetzlich frueh um, solange der Digest aus `[id, status, title]` unveraendert
ist. Der Board-Poll von `/api/programs` ist damit kein 2-s-Reader.

**5. WIDERLEGT — „nur `lastAudit` statt aller drei Felder" spart nichts.** Die Empfehlung der
Vorgaengerin setzte voraus, dass ein einzelnes Feld billiger ist. Der Audit-Join baut
`landedMainAfter` aus den GELANDETEN `outcome`-Zeilen und filtert die Audit-Zeilen dagegen;
`lastAudit` braucht also BEIDE Ledger. Billiger wird nur, wer gar keinen Ledger anfasst.

**6. Eine dritte Option, die die Vorgaengerin nicht hatte.** Eine Detail-Route
`GET /api/programs/:id` existiert heute NICHT (die Regex-Routen unter `/api/programs/` sind
ausschliesslich `profile` · `promotion` · `studio` · `dispatch` · die fuenf Aktionen). Sie waere der
natuerliche Ort fuer den Ledger-Kontext: bezahlt wird beim Oeffnen einer Zeile, nicht bei jedem
Poll. Groesser als (A), aber die Kosten haengen dann am Klick.

Die Frage steht als Attention `04f4b7e6e37ef7ed9545fae5` neu beim Owner. Die Fassung der
Vorgaengerin (`6d51202e451b5e3166d24c8d`) ist inzwischen `refused` mit
`requester session ended` — genau der stille Tod, den §5e ihres Handoffs vorhergesagt hat; sie war
unbeantwortet, nicht abgelehnt.

## Nachtrag 08:1x — (a) hat jetzt eine ZAHL

`13 von 49` offenen `auftrag`-Zeilen tragen keine `programId`. Alle DREI gerade laufenden
Fleet-Lanes sind darunter (`8f14a22b`, `95d09e33`, `e53716b9`), alle drei `source: owner`. Das
bestaetigt den Mechanismus aus §(a) von der Betriebsseite: die Zeilen, die der Owner selbst filt und
der Tick startet, entstehen ohne Bindung, und es gibt keine Tuer, die sie nachtraeglich vergibt.
Adoption an der MAIN-Tuer waere Neu-Filen, also eine ZWEITE Zeile fuer dieselbe Arbeit.

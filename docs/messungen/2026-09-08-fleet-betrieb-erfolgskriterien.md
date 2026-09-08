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

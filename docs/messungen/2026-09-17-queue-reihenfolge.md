# Queue-Reihenfolge und drei Adjudikationen — gestapelte Analyse, 2026-09-17

Vier Agenten (drei Analysten auf je einer Datenschicht, ein Sequenzer der ihre
Widersprueche entscheidet), beauftragt von der Orchestratorin Slot 6. Jede tragende
Behauptung ist am Baum `d8ece3a0` geprueft; MAIN Slot 8 hat die Code-Zeilen unabhaengig
gegengelesen und bestaetigt.

## Die Reihenfolge

| # | Akt | Wer | Loest |
|---|---|---|---|
| 1 | 32 verworfene rote Lane-Vorschauen quittieren (Inbox-Deckel 20) | Owner | kostet nichts, laeuft sonst weiter |
| 2 | `slot`+`branch`+`offered` in den Isolated-Trail-Header (neue Zeile) | MAIN f170dc46 | entscheidet eine 6,6 h/Tag-Frage |
| 3 | `53daa39c` | MAIN f170dc46 | muss vor JEDER Briefarbeit landen |
| 4 | `c2904891` erweitert + `CARD_VALIDATOR_VERSION` -> 6 | MAIN f170dc46 | 10 blockierte Zeilen |
| 5 | Audit-Grace-Defekt `server.ts:18925` (neue Zeile) | MAIN f170dc46 | ~1 h/Tag Suite-Mutex |
| 6 | `4b02bd09` umpointen, dann `a1610fd7`/`3f79ff74`/`d518d09d` schliessen | Orchestrator | haengt hinter 3 |
| 7 | `archived`-`after`-Deadlock, Program 247a3746 | Orchestrator | 3 tote Zeilen |
| 8 | `67abe12c` | MAIN f9dc8e10 | ~3,8 h/Tag, falls 2 es bestaetigt |

Unter der Schnittlinie und WARUM: `2e99a34e` (NUL-Bytes verifiziert, Ausloeser nie
reproduziert), `b0f272b8`/`4bb96744`/`3f7363bf` (reparieren Zahlen, keine Minuten),
`a43caeae` (echte Kollision auf `server.ts`), `803c1869` (entfernt den haeufigsten roten
Check, 12x, kostet aber keine Mutex-Zeit — erster Kandidat ueber der Linie),
`84888f35` (sein Deliverable IST diese Analyse).

## Drei Adjudikationen

**1. `d518d09d` ist tot, nicht ein Top-Hebel.** Die Zeile las `shards` als Offload-Marker
und uebersah `remote`. Ueber die letzten 200 Audit-Zeilen: local/unsharded n=53 p50 0,0 min ·
remote/sharded n=53 p50 18,6 min · remote/unsharded n=94 p50 37,4 min. Die "147 lokal" ist
die REMOTE-Zahl; 74 % verlassen den Mac laengst. Ihr Deliverable ist seit `server.ts:18956`
live, und die vier Werte die sie ledgern will sind der ganze Rueckgabetyp von
`helperClaimBar` — der teure Fall "no claim-capable helper is beating" ist ein SEPARATER Arm
(`server.ts:18964`) und waere nicht dabei.

**2. `card-valid` liest nicht `card.valid`.** `start-plan.ts:92`
`HARD_GAP = /^(?:done|answer|verify|surface\.files|surface\.creates):/` — `surface.symbols`,
`size`, `after`, `rolle` sind Hints und geben frei. Blockiert sind 17 Zeilen, nicht 23.
Der tragende Teil jedes Kartenfixes ist der Bump: `server.ts#cardDue` liest eine ungueltige
Karte nur neu wenn `(validatorVersion ?? 1) < CARD_VALIDATOR_VERSION`, alle gespeicherten
Karten stehen auf 5 und `card-extract.ts:52` ist 5. Ohne Bump erreicht kein Fix je eine
Zeile — am 2026-09-15 schon einmal passiert, `5619800c` sagt es im eigenen Commit-Body.

**3. Die Kette "Kartenfix entsperrt den groessten Durchsatzhebel" haelt NICHT.**
`67abe12c` ist heute freigebbar (Karte gueltig, Tick released selbst, `server.ts:12943`);
ihm fehlt nur eine Lane. Blockiert ist `531bab26` — die andere Zeile.

## Zwei Klassen, die vorher niemand gesucht hatte

**Eine Zeile ohne Code-Flaeche faellt durch `card-valid`.** `start-plan.ts:110` ist
`if (!c.cardFiles || ...)`, und `!0` ist `true`. Betroffen mit GUELTIGER Karte: `ee47b0f8`,
`1832c7eb`, `e4409bf2`. Strukturell kann damit keine Denk- oder Clarify-Zeile freigegeben
werden. **Abhilfe als Filing-Konvention, am selben Tag belegt:** Zeile `16ec0000` ist eine
reine Analysezeile und traegt `cardFiles 9`, weil ihre `FLAECHE:`-Zeile die getrackten
Dateien nennt, die die Lane LIEST. `start-plan.ts:110` fragt nicht, ob geschrieben wird.
Ob der Code-Fix danach noch gewollt ist, ist offen.

**Ein Deadlock, den kein Code herstellt.** `c2904891` trug "collides with row 53daa39c ahead
in the plan", waehrend `53daa39c` PENDING war — ein Warten auf eine nie freigegebene Zeile.
Gefunden von MAIN Slot 8 an der eigenen Reihenfolge. Keine Sonde sieht das, weil es in der
Freigabe-Hand entsteht, nicht im Baum.

**Und der Rat aus 2 laeuft in den Schaden aus 3.** `c2904891` erweitern heisst einen Brief
schreiben; ein Brief triggert den Karten-Re-Read, und genau der verliert `VERBOTEN`
(`card-extract.ts:389` FORMAT_KEYS) und kuerzt ein mehrzeiliges `ziel`. Darum 3 vor 4 —
nicht wegen Dateikollision, sondern weil der eine Punkt in den anderen hineinlaeuft.

## Es gibt keine Route, die eine Karte auf einer bestehenden Zeile ersetzt

`authorCardFrom` sitzt nur an den beiden CREATE-Tueren (`server.ts:10840`, `:34269`).
Umpointen von `4b02bd09.card.after` geht darum nur ueber einen Brief — und dessen Karte ist
gueltig, also trifft sie der verlustbehaftete Re-Read. `a1610fd7` deshalb NICHT schliessen,
bevor `53daa39c` gelandet und `4b02bd09` umgepointet ist: `start-plan.ts:305` blockiert auch
auf ein FEHLENDES Ziel, ein Schliessen vorher ist ein dauerhafter Deadlock.

## Was niemand gelesen hat

34 `notiz`- und 11 `richtung`-Zeilen. Eine Stichprobe von drei fand darin bereits die
Owner-Vorgabe vom 2026-09-07 "Lanes aus DIESER Queue laufen auf dem Second-host
(Cross-Host-Dispatch), nicht nur Suiten", nie in eine Zeile ueberfuehrt. Das ist die
groesste uninspizierte Flaeche im Portfolio.
Ebenfalls unkostiert: der Token-/Kontext-Kanal (`context-receipts.jsonl`, `toolResultBytes`,
Zeilen `10e2f7c0`, `2cf40772`, `2f147b22`). Dafuer laeuft seit 2026-09-17 15:18 die
Astra-Zeile `16ec0000`.

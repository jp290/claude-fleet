---
frage: Wie wurde die Queue am 2026-09-18 von 40 Einzelauftraegen auf sieben Sammelzeilen umgestellt, und welche Pruefung traegt jeden Schritt?
urteil: 40 offene Auftraege sind jetzt 7 Sammelzeilen mit NACH-Kette D-A-E-B-C plus F und G, 21 Quellzeilen archiviert, 1 erledigt, Deploy auf b2d92216 ok, Deckel 3, der Tick startet; ein unqueue haelt unter der Politik card-valid nichts, anhalten kann nur ein Hold
bereich: [queue, sammelzeilen, betrieb]
belege: [card-extract.ts#parseFormattedCard, card-extract.ts#validateCard, task-metadata.ts#declaresSymbol, start-plan.ts, server.ts#deployBlocker, server.ts#releaseTaskForMain, docs/messungen/2026-09-18-queue-sichtung-40-auftraege.md, docs/queue-sammelzeilen-verfahren.md, b2d92216]
nicht-gemessen: ob die Sammelzeilen schneller landen als die Einzelzeilen (erst nach den Lands messbar); der erste Tick-Start einer pi-zai-Lane stand beim Schreiben noch aus
stand: 2026-09-18
---

# Queue-Umstellung auf Sammelzeilen, 2026-09-18

2026-09-18, Orchestratorin Slot 16, Haupt-Checkout. Frage: **Wie wurde die Queue von 40
Einzelauftraegen auf sieben Sammelzeilen umgestellt, und welche Pruefung traegt jeden Schritt?**

Die Notiz gehoert zu zwei Geschwistern:
- `docs/messungen/2026-09-18-queue-sichtung-40-auftraege.md` ist das Register: ein Urteil je alter
  Zeile, mit Beleg, und wohin sie ging.
- `docs/queue-sammelzeilen-verfahren.md` ist das Verfahren fuer das naechste Mal, ohne die Fehler
  von heute.

## Anlass

Owner, woertlich, 2026-09-18:
- „wenn ich so die tasks angucke, dann macht eigentlich nichts für mich so wirklich sinn wie sie
  geschrieben sind. Es fühlt sich an als würde wir einfach nur abarbeiten ohne irgendwelche
  resultate zu erzielen"
- „ich habe darin dann doch vllt meine bedenken ob man solche tasks dann nicht mehr zusammenlegen
  sollte"
- „Am ende passt alles eben nichtmehr richtig zusammen"
- „Wir machen diese sichtung der queue jetzt auch schon zum dritten mal oder so in den letzten 24h"

Drei Befunde lagen schon auf main und stuetzen das:
- `32d9d93a`: 78 % der Durchlaufzeit einer Zeile liegen vor dem Dispatch.
- `./state.sh` land-quality ueber 14 Tage: 52 % der Lands werden innerhalb von drei Tagen wieder
  angefasst.
- `./register.sh` Abschnitt 2: 28 offene Auftraege fassen `server.ts` an und serialisieren sich
  damit gegenseitig.

Ein vierter Beleg entstand waehrend der Arbeit. `f3ca2e05` (Lanes auf dem Second-host) stand in der
Reihenfolge v2 auf Rang 2 und wurde als Clarify-Lane gestartet. Die Clarify-Lane fand, dass die
Zeile ueberholt war: Program `710fbf40` fuehrt Cross-Host-Dispatch als Nicht-Ziel, und
Owner-Entscheid `39857582` sagt „NICHT: f3ca2e05 in seiner heutigen Fassung". Niemand hatte die
Zeile gegen die spaeteren Entscheide gegengelesen.

## Ergebnis

Stand nach der Umstellung, 2026-09-18 ~10:20Z:

| Menge | Zahl | Definition |
|---|---|---|
| offene `auftrag`-Zeilen vorher | 40 | `fleet.json` tasks, kind=auftrag, status pending/queued/sent, Snapshot ~10:00Z |
| neue Sammelzeilen | 7 | alle `queued`, Karte `valid: true`, `gaps: []` auf dem Server |
| archivierte Quellzeilen | 21 | 17 in Sammelzeilen aufgefangen, 4 ueberholt; jede mit `disposition.grund` und `beleg` |
| auf `done` gesetzt | 1 | `f68d27d7` (Private-repo-aa K4), gelandet als private-repo-aa `cd8e0b7` |
| vorher archiviert | 1 | `f3ca2e05`, ueberholt (siehe Anlass) |
| einzeln behalten | 11 | Liste im Register §3 |

Die sieben Zeilen, in der Reihenfolge, in der der Start-Plan sie fuehrt:

| Thema | Id | Titel | Worker | wartet auf |
|---|---|---|---|---|
| D | `1a373ca6` | Jedes Warten hat einen Grund und einen Adressaten | claude/opus-5/high | — |
| A | `43e7dab2` | Zustellung, die ankommt | claude/opus-5/high | `NACH` D |
| E | `9780234b` | Varianten zu Ende gebaut | pi-zai/glm-5.3-flash/high | `NACH` A |
| B | `5abfda7c` | Die Land-Tuer sagt nur „lande", wenn es stimmt | claude/opus-5/high | `NACH` E |
| C | `6adec096` | MAIN-Tueren und Lane-Nachfolge | pi-zai/glm-5.3-flash/high | `NACH` B |
| F | `85fa31bc` | Die Pruefapparatur hoert auf, falsch rot zu sein | pi-zai/glm-5.3-flash/high | Kollision |
| G | `a1e2826f` | Erdung kurz, Kennzahlen ehrlich | pi-zai/glm-5.3-flash/high | Kollision |

Warum die Kette: D, A, E, B und C fassen alle `server.ts` an. `NACH` wartet auf den Status `done`
des Vorgaengers (`start-plan.ts`, Zweig `after`: `statuses[id] !== "done"`), also auf dessen Land.
F und G haben keine Kante. Sie warten, bis ihre Dateien frei sind (`collides` im Start-Plan).

Betrieb nach der Umstellung:
- Deploy `9cf31f46`: `ok: true`, `hitTarget: true`, Boot auf `b2d92216`, `bundleStale: false`.
  Damit ist `pi-zai` live automatisierbar (`b2d92216`, Readiness-Naht fuer den Trust-Prompt).
- `repo-lane-cap` claude-fleet steht wieder auf 3, Quelle `repo`.
- Rollen: die MAIN gibt frei und landet, der Tick startet, die Orchestratorin plant nur, was in der
  Queue steht. Das steht als „REIHENFOLGE v3" an Zeile `0f2024dc` (Kommentar `ca81c611`), der
  ausgefuehrte Stand als Kommentar `c6b4a814`.

Start-Plan unmittelbar nach dem Deckel-Wechsel:

| Zeile | naechstes Hindernis |
|---|---|
| D `1a373ca6` | `collides` mit Slot 3 auf `server/types.ts` |
| F `85fa31bc` | `collides` mit Slot 1 auf `server.ts` |
| G `a1e2826f` | `collides` mit Slot 1 auf `docs/controller.md` |
| A, E, B, C | `after` des jeweiligen Vorgaengers |

## Die Falle: unqueue haelt unter `card-valid` nichts

Vor dem Posten wurden alle 13 `queued`-Zeilen per `POST /api/tasks/:id/unqueue` auf `pending`
gesetzt, damit der Tick keine alte Einzelzeile startet. Das hielt nicht. Program `f170dc46` laeuft
unter der Freigabe-Politik `card-valid`. Nach dem Deploy-Boot hat der Server jede `pending`-Zeile
mit gueltiger Karte **ohne Hold** wieder freigegeben. Das Audit-Ledger zeigt es:

```
{"ts":1789726689531,"event":"task_release","detail":"7d70eaeb program=f170dc46… by=policy card-valid"}
```

10:18:09Z, 24 s nach dem Boot. Eine Sekunde vorher (10:18:08Z) stand der Deckel auf 3. Der Tick hat
`7d70eaeb` (Denkauftrag, docs-only) sofort in Slot 3 gestartet. Die Zeile war fuer eine
Sammel-Messzeile vorgesehen. Sie laeuft einzeln zu Ende, weil sie keinen Code anfasst.

Welche Zeilen dieselbe Politik noch treffen kann, zeigt die Lesung danach: `pending`, im Program,
**kein Hold**, Karte gueltig. Das traf genau eine Zeile, `ee47b0f8` (Lebenszyklus S5b). Einen Hold
setzt nur die MAIN (`POST /api/self/tasks/:id/hold`), eine Owner-Route dafuer gibt es nicht. Die
MAIN wurde darum gebeten (Receipt `10f567e3…`, acceptance observed).

Folgerung, auch im Verfahren: **anhalten = Hold, nicht unqueue.**

## Methode

Jeder Schritt mit dem Kommando, das ihn traegt. `<host>` steht fuer den Fleet-Host aus `.env`; das
Owner-Token liest man aus `fleet.json`, `token`.

**1. Sichtung.** Ein Subagent las alle offenen Zeilen (`fleet.json`), die offenen `richtung`- und
`notiz`-Zeilen (dort stehen Owner-Entscheide), die Program-Records, `git log` seit 09-01 mit Bodies
und den gelandeten Wellenplan `5388765c`. Er aenderte nichts. Ein Urteil `ueberholt` oder `erledigt`
galt nur mit Beleg. Mechanische Endpruefung: jede offene Id kommt genau einmal in der Datei vor.
Das Ergebnis ist das Register.

**2. Drei Belege der Sichtung selbst nachgeprueft**, statt dem Bericht zu glauben:

```sh
git log -1 --format=%B d190ff8d | grep -c '95/101'          # 1
git merge-base --is-ancestor 5388765c main && echo on-main   # on-main
grep -n -i 'e41ccec1\|pane-leser' docs/messungen/2026-09-18-jev-entscheidungsvorlage-astra.md
#   :38 (Kandidat) und :204 (Liste), beide unter der Schnittlinie :198
git -C <private-repo-aa> merge-base --is-ancestor cd8e0b7 main && echo on-main   # on-main
```

**3. Karten lokal validiert, bevor etwas gepostet wurde.** Ein Skript im Scratchpad ruft
`card-extract.ts#parseFormattedCard` und `validateCard` mit dem Kontext, den der Server benutzt:
getrackte Pfade aus `git ls-files`, die Queue-Ids aus `fleet.json` fuer `rowKnown`, `symbolIndex:
null`. Ergebnis: alle sieben `valid true`, `gaps []`.

Eine Mutationsprobe zeigte eine Grenze dieser Probe:
- `NACH: deadbeef` wurde erkannt (`after: "deadbeef" is not a queue row`).
- Ein erfundenes Symbol `server.ts#gibtEsNichtXyz` ging dagegen **durch**. Ohne Graph-Index prueft
  der Validator nur, ob die Datei existiert (so dokumentiert an `CardValidationContext.symbolIndex`).

Darum eine zweite Probe: jedes `datei#symbol` aus `FLAECHE` gegen `task-metadata.ts#declaresSymbol`.
Ergebnis: 19 von 19 deklariert, und das erfundene Symbol wurde als `MISSING` gefangen.

**4. Kanten gegen das Archivieren geprueft.** Hat eine verbleibende Zeile eine `card.after`-Kante
auf eine Zeile, die archiviert wird, bleibt sie stehen. `start-plan.ts` meldet dann „ist keine
Queue-Zeile mehr — MAIN oder Owner entscheidet". Treffer:
- `d61133e3` (K5) → `f68d27d7` (K4). Loesung: K4 auf `done` statt archivieren (`POST
  /api/tasks/:id/done`).
- `ad3b3960` → `32fed872`. Beide wurden archiviert, also unkritisch.

**5. Posten in Kettenreihenfolge.** `POST /api/tasks` mit `{text, kind:"auftrag", programId, queue:
true}`. `queue: true` ist eine Freigabe durch den Poster (`releasedBy: "owner"`). D wurde zuerst
gepostet, jede folgende Karte bekam `NACH: <id des Vorgaengers>` unter der `GROESSE`-Zeile. Das
Format ist in `card-extract.ts#FORMAT_KEYS` festgelegt:
- Kopfschluessel sind nur `ROLLE GROESSE FLAECHE NEU NACH VERIFY DONE VERBOTEN`.
- `FILES:` oder `QUELLEN:` im Kopf beenden den Kopfblock.
- Darum steht `QUELLEN` als Absatz nach dem Ziel.

**6. Server-Karte gelesen.** Der Karten-Tick schreibt `task.card` asynchron. Ein Warte-Loop bis alle
sieben eine Karte tragen, dann: `valid true`, `gaps []`, `after` wie gepostet, `rolle` wie gepostet,
`verboten` 3–4 Eintraege je Zeile.

**7. Archivieren.** `POST /api/tasks/:id/archive {grund, beleg}` fuer 21 Zeilen. Der Grund nennt die
Sammelzeile und den Owner-Entscheid, der Beleg die neue Queue-Id oder den Commit. Rueckweg:
`POST /api/tasks/:id/unarchive`, `./register.sh --archived <muster>`.

**8. Deploy.** Vorbedingungen, alle mechanisch gelesen:
- `./ctl.sh merges` → exit 0, kein Land in Flug.
- `postLandAuditLive.running: null`. Das Audit zu `b2d92216` stand `waiting`.
- `server.ts#deployBlocker` zaehlt nur laufende Lands und laufende Audits. Eine wartende Audit-Zeile
  liegt in `post-land-audit-queue.json` und ueberlebt den Neustart.

Dann `POST /api/deploy`. Das Verdikt schreibt der naechste Boot nach `GET /api/deploys`:
`ok: true`, `hitTarget: true`, `ms 4764`. Danach auf `/api/sessions`: `deployGap.codeBehind:
false`.

**9. Deckel.** `POST /api/repo-lane-cap {repo, maxLanes: 3}` → `effective 3, source repo`.

**10. Start-Plan gelesen** (`./ctl.sh get /api/start-plan --json`), Tabelle oben.

## Was nicht gemessen wurde

- Ob die Sammelzeilen schneller zu einem spuerbaren Ergebnis fuehren als die Einzelzeilen. Messbar
  erst nach ihren Lands, gegen die Durchsatz-Zahlen von `32d9d93a`.
- Der erste Tick-Start einer `pi-zai`-Lane: beim Schreiben hatte der Tick noch keine Flash-Zeile
  gestartet. Ein Hintergrund-Watcher der Orchestratorin lief darauf.
- Ob `ee47b0f8` bis dahin einen Hold traegt. Die Bitte an die MAIN ist zugestellt, ihre Ausfuehrung
  ist nicht geprueft.
- Die Sammel-Messzeile aus `b0279bc6` (nur H1) und `76e08dd3` ist nicht angelegt.
- Die Sichtungs-Urteile, die nicht unter Methode §2 stehen, sind Urteile des Subagenten, nicht von
  der Orchestratorin nachgeprueft (Register §4).

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-18T09:28Z	uebernahme	Watches 1/4/6/15 neu armiert, Slot 9 per Hintergrund-Watcher	pi-zai-Slot: /api/self/watch 409	Linien-Record f54c5977	armiert
2026-09-18T09:39Z	dispatch	f3ca2e05 als Clarify-Lane (Rang 2 v2), weil Rang 1 auf 2cf40772 wartet	v2 an 0f2024dc	Slot 4, fleet/260918093916-67b3	gestartet
2026-09-18T09:42Z	clarify	f3ca2e05 ueberholt: 710fbf40 nonGoal + 39857582	Kriterium der Clarify-Lane	criterion.proposedAt 1789724521835	archivieren
2026-09-18T09:4xZ	owner	Sammelzeilen statt Einzelzeilen, Sichtung per Subagent	Owner: „zusammenlegen"	Gespraech	ja
2026-09-18T09:46Z	regel	REIHENFOLGE v3: MAIN gibt frei, Tick startet, Orchestratorin plant	drei Haende an einer Tuer	Kommentar ca81c611	gilt
2026-09-18T09:5xZ	korrektur	Subagent auf den Wellenplan umgelenkt statt vierter Sichtung	Owner: dritte Sichtung in 24 h	5388765c	uebernommen
2026-09-18T10:0xZ	auswahl	1832c7eb NICHT archiviert, obwohl vom Subagenten vorgeschlagen	nur abgeleitet, kein Owner-Entscheid	Register §4	behalten
2026-09-18T10:0xZ	pruefung	Karten lokal validiert, Symbol-Luecke per Mutation gefunden, zweite Probe gebaut	validateCard ohne Index prueft keine Symbole	§Methode 3	19/19
2026-09-18T10:0xZ	kanten	K4 auf done statt archivieren	K5 haengt per after an K4	start-plan.ts after-Zweig	done
2026-09-18T10:1xZ	queue	13 queued -> pending (unqueue), dann 7 posten, dann 21 archivieren	Tick soll keine alte Einzelzeile starten	§Methode 5, 7	ok
2026-09-18T10:17Z	deploy	Deploy trotz wartendem Audit	deployBlocker zaehlt nur laufende; Queue persistiert	post-land-audit-queue.json	ok, b2d92216
2026-09-18T10:18Z	deckel	repo-lane-cap 1 -> 3	pi-zai live, Queue sauber	audit repo_lane_cap	3
2026-09-18T10:18Z	falle	7d70eaeb durch Politik card-valid freigegeben und gestartet	unqueue haelt unter card-valid nicht	audit task_release by=policy	laeuft einzeln
2026-09-18T10:19Z	abhilfe	MAIN um Hold auf ee47b0f8 gebeten	einzige Zeile ohne Hold mit gueltiger Karte	Receipt 10f567e3	zugestellt
```

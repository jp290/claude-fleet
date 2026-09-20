---
frage: Soll die Retention eine im Fliesstext genannte Task-Id schuetzen, welche Lesung zeigt eine reife Quelle, und ist die Deckel-Kollision in task-notes.ts ein Fehler?
urteil: Nein — eine Prosa-Referenz wird nicht geschuetzt, sondern angeheftet oder als MARKIERTE Kopfzeile gelesen (das Muster dafuer existiert und laeuft: namedAfterIds + releaseCardRefusal); die reife Quelle ist ein abgeleitetes Zaehlerfeld auf der notiz-Zeile in taskView, heute mit LEERER Menge (5 Notizen mit Urteil, alle `offen`, keines gelandet); die Deckel-Kollision ist die richtige Prioritaet mit falschem Schweigen (mechanisch belegt: ab 5 expliziten Pins fallen die Join-Treffer aus `reachable`, nicht nur aus der Vorschau).
bereich: [retention, quellen, notizen, queue, deckel]
belege: [server.ts#capTasks, server.ts#sourceHoldersIn, task-notes.ts#laneNoteSources, waits.ts#namedAfterIds, server.ts#releaseCardRefusal, program-phase.ts#PHASE_RULES]
nicht-gemessen: Ob ein Owner die drei vorgeschlagenen Kriterien annimmt; die Texte der zwoelf verschwundenen QUELLEN (sie existieren in keinem Speicher mehr, auch nicht im Ledger).
stand: 2026-09-20
---

# Referenzen, die die Retention nicht sieht

2026-09-20, Lane `fleet/260920103416-bb2e`, Baum `c6848e48`. Klaerung ohne Produktcode: die drei
Befunde der Auftragszeile gegen den Baum pruefen, je Befund ein pruefbares Done-Kriterium samt
Verifikationsweg vorschlagen, Q1–Q5 beantworten.

## 1 Was am Baum anders steht als in der Zeile

| Behauptung der Zeile | Am Baum gemessen |
|---|---|
| `MAX_TASKS = 200` an `server.ts:2081` | Wert stimmt, Zeile gewandert: `server.ts:2792` (`server.ts#capTasks` liest ihn an 2943/2945) |
| N3-Begruendung an `server.ts:4025-4032` | Text existiert woertlich, an `server.ts:5133` |
| Legacy-Auto-Close-Ausnahme an `server.ts:4050-4056` | existiert, an `server.ts:5162`: `if (sourceHolders(t.id).length > 0 \|\| (t.verdicts?.length ?? 0) > 0) continue;` |
| `task-notes.ts:190-192` Deckel-Kollision | stimmt zeilengenau; Symbol `task-notes.ts#laneNoteSources` |
| `NOTES_CAP_DEFAULT = 5` | `task-notes.ts:14`. Dazu, in der Zeile nicht genannt und fuer Befund 3 entscheidend: `TASK_NOTES_MAX = 20` (`server/types.ts:1459`) — der Pin-Deckel je Zeile liegt VIERFACH ueber dem Join-Deckel, die Kollision ist also erreichbar |
| 11 Pins seit 2026-09-11 | **EINER**, fleet-weit: Zeile `5e5588c5` (done) haelt Notiz `00279c52`. Bei 43 Notizen im Zustand |
| zwoelf Quell-Ids fehlen | 12 von 12 fehlen in `fleet.json` — **und alle zwoelf fehlen auch in `tasks-archive.jsonl`** (381 Zeilen, 172 `evicted`, 209 `terminal`, aelteste 2026-09-15 18:06:59). Sie wurden verdraengt, BEVOR das Ledger existierte: unwiederbringlich aus jedem Speicher |
| zehn betroffene Zeilen | **acht von zehn sind selbst nicht mehr im Zustand** und liegen im Ledger (wiederherstellbar per `unarchive`); `cf0d3cd4` und `66df05b4` liegen nirgends — nicht in `fleet.json`, nicht im Ledger, und es sind auch keine Commit-Shas (`git cat-file -t` scheitert fuer beide) |

Zustand beim Messen: 200 Zeilen (genau am Deckel), 58 lebend, 142 terminal — also
`keepDone = 200 − 58 = 142`, der Deckel verdraengt aktiv bei jeder neuen Zeile.

## 2 Der Mechanismus, praeziser als die Zeile ihn nennt

Die Zeile sagt, es gaebe zwei Referenzarten. Am Baum sind es DREI, und die mittlere ist die Antwort:

1. **Angeheftet** (`Task.notes`) — geschuetzt an vier Tueren durch EIN Praedikat
   (`server.ts#sourceHoldersIn`): Retention (`capTasks`, 2979), `delete`/`archive` (37542-37545),
   `kind`-Wechsel (36985), Legacy-Close (5162).
2. **Markiert im Text** (`NACH: <id>`) — geschuetzt, obwohl es Prosa ist: `waits.ts#namedAfterIds`
   liest 8-Hex-Tokens aus `t.text` und `t.brief.text`, die Karte traegt sie als `card.after`, und
   `capTasks` haelt sie (N3b, `afterHeld`, 2977). Der Uebergang von Prosa zu Mechanik ist
   `server.ts#releaseCardRefusal` (10904): nennt der Text eine Ordnung, die die Karte nicht traegt,
   wird die FREIGABE verweigert — mit dem Satz „put the ids on a NACH: header line".
3. **Unmarkiert im Text** — ungeschuetzt. Die zwoelf verlorenen Quellen stehen in dieser Klasse.

Klasse 2 ist der Beweis, dass „Prosa schuetzen" in diesem Repo schon geloest ist — aber nur fuer
eine MARKIERTE Form, und mit einer Verweigerung statt einer Heuristik. `namedAfterIds` sagt den
Grund selbst: „a commit sha in prose is not an order."

## 3 Befund 3, mechanisch nachgestellt

Sonde gegen `task-notes.ts#laneNoteSources` (fuenf pinbare Notizen, zwei Join-Treffer auf derselben
Flaeche, `cap = 5`):

```
explicit=0  reachable: j1,j2,p1,p2,p3    shown: j1,j2,p1,p2,p3   overflow: 0
explicit=1  reachable: p1,j1,j2,p2,p3    shown: p1,j1,j2,p2,p3   overflow: 0
explicit=4  reachable: p1,p2,p3,p4,j1    shown: p1,p2,p3,p4,j1   overflow: 0
explicit=5  reachable: p1,p2,p3,p4,p5    shown: p1,p2,p3,p4,p5   overflow: 0
```

Bestaetigt und praezisiert: der Verlust ist **graduell, nicht erst bei 5** — jeder Pin nimmt einen
Join-Platz (`cap - explicit.length`), bei 5 Pins sind beide Join-Treffer weg. Und er trifft
`reachable`, nicht nur `shown`, weil `reachable` die Join-Haelfte aus `shown` bezieht
(`task-notes.ts:192`). Explizite Pins gehen NIE verloren: `reachable` traegt `...explicit`
vollstaendig, und was ueber den Deckel laeuft, nennt `renderNotesBlock` als `overflow`. Genau diese
Gegenbuchung fehlt fuer die Join-Haelfte: sie verschwindet spurlos.

## 4 Antworten

**Q1 — Soll eine Prosa-Referenz schuetzen? Nein.** Drei Gruende, jeder gemessen. (a) Die
Unterscheidung „Task-Id oder Commit-Sha" ist im Baum schon einmal entschieden worden, und zwar
gegen die Heuristik: `namedAfterIds` liest nur die markierte Form, `releaseCardRefusal` verweigert
statt zu raten. Eine Retention, die frei parst, muesste dieselbe Frage ohne Verweigerungsmoeglichkeit
beantworten — sie laeuft im Hintergrund, es gibt niemanden, dem sie eine Nachfrage stellen koennte.
(b) Die Anheft-Tuer ist nicht knapp: `TASK_NOTES_MAX = 20` je Zeile, und fleet-weit steht genau EIN
Pin. Nicht der Mechanismus fehlt, die Gewohnheit. (c) Der Preis der Gegenrichtung ist heute schon
sichtbar: `a05fa7ff` nennt zwei Quellen, eine Task-Id (`328fd28f`, weg) und ein getracktes Doc
(`docs/game-maker/workflow-v2.md` §7 F2, da — Zeile 523). Die Referenz auf das getrackte Artefakt
hat ueberlebt, die auf den Zustand nicht. Die Lehre ist nicht „Prosa schuetzen", sondern: **ein
Brief verankert in Git oder heftet an; eine nackte Id im Text ist ein Zeiger auf einen Deckel.**

**Q2 — Wenn dennoch geschuetzt wird: woran erkennt die Retention die Referenz?** An einer
MARKIERTEN Kopfzeile, nie an freier Prosa — `QUELLE: <id>`, gelesen wie `NACH:`. Konkret als
kleinster Schnitt: ein Schluessel `QUELLE` in `card-extract.ts#FORMAT_KEYS` (424) und
`FORMAT_LINE` (427), das Ergebnis als `card.sources` neben `card.after`, und in
`server.ts#capTasks` ein `sourceNamedHeld` neben dem bestehenden `afterHeld` (2977) — mit
derselben Asymmetrie, die N3b schon akzeptiert: **nur ueber die LEBENDEN Zeilen gelesen**, weil die
Kopfzeile einer terminalen Zeile Geschichte ist. Dazu, kostenlos, die Verweigerung, die schon
existiert: `releaseCardRefusal` kann denselben Satz fuer `QUELLE` sagen wie fuer `NACH` — „heft sie
an oder setz sie auf die Kopfzeile". Kein Brief wird geparst, nur eine Zeile gelesen.

**Q3 — Die Lesung fuer eine reife Quelle.** Am billigsten und am schwersten falsch zu lesen: ein
ABGELEITETES Feld auf der `notiz`-Zeile in `server.ts#taskView`, gerendert in der bestehenden
`notes`-Ansicht des Boards (`src/client.ts`, `QView`). Grund: der Payload traegt fuer diese Zeilen
schon `notes: {n, at}` und `verdicts: {n, at}` (`src/client.ts:345-346`), und der Poll beobachtet
diese Felder bereits (`src/client.ts:6967`) — die Lesung kostet keinen Kanal, keine Route und
keinen zweiten Wahrheitsort. `./register.sh` waere die schlechtere Wahl: ein Textlauf, den der Owner
gelegentlich liest, und ein weiterer Ort, der gegen den Zustand altert.

Drei Werte, nicht zwei, und der dritte ist der Punkt:
`ohne-verwendung` (nie zugewiesen, nie beurteilt — das ist die Klasse des Legacy-Close, nicht diese
Lesung) · `offen` (mindestens ein lebender Halter oder ein `offen`-Urteil) · `reif` (mindestens eine
Verwendung, keine offene). **Der Grenzfall, der die Definition entscheidet und heute schon
existiert:** Notiz `9238013d` haelt ein Urteil zu Zeile `04f55eba`, und `04f55eba` ist verdraengt.
Ein Urteil, dessen `taskId` nicht mehr existiert, muss als FREIGEGEBEN zaehlen, nicht als offen —
sonst ist diese Notiz dauerhaft unreif und die Lesung faellt genau an ihrem ersten echten Fall aus.
Und die Flaeche sagt „keine offene Verwendung", nie „schliesse das": sie bleibt eine Lesung.

Heutiger Messwert der vorgeschlagenen Lesung: **leer.** 43 Notizen, 5 mit Urteil, alle Urteile
`offen`, keines mit `landedAt`. Das ist kein Argument gegen die Lesung — es ist ihr billigster
Abnahmefall: eine Flaeche, die heute ehrlich „nichts reif" sagt, ist an ihrem ersten `erledigt`
pruefbar.

**Q4 — Deckel-Kollision: richtige Prioritaet, falsches Schweigen.** Explizit schlaegt zufaellig ist
richtig; eine vom Owner gewaehlte Quelle darf nicht von einem Dateitreffer verdraengt werden. Falsch
ist nur, dass der Verlust unsichtbar ist: `overflow` bucht ausschliesslich explizite Zeilen gegen,
und `renderNotesBlock` nennt im Text seinen Deckel, aber nie die Zahl der Join-Treffer, die er
gefressen hat. Also **dokumentieren UND gegenbuchen** — nicht die Prioritaet aendern. Wenn nur eines
geht: dokumentieren, denn die gemessene Exposition ist ein Pin fleet-weit.

**Q5 — Welche der zehn Zeilen sind ohne Quelle noch ausfuehrbar?** Die Frage hat ihre Praemisse
verloren: **keine der zehn ist heute eine offene Queue-Zeile.** Gemessen, Zeile fuer Zeile:

| Zeile | Zustand | Arbeit am Baum | Urteil |
|---|---|---|---|
| `a17a630b` | `done`, im Ledger | — (Read-only-Beleg-Lane, gelaufen) | erledigt, nichts zu entscheiden |
| `60257e41` | `done`, im Ledger | — (Read-only-Beleg-Lane, gelaufen) | erledigt |
| `67abe12c` | `done`, im Ledger | `FLEET_E2E_MODULES` existiert (`fleet-e2e.ts:94-101`, `verify-proportion.ts:38`) | erledigt, Arbeit gelandet |
| `db756205` | `done`, im Ledger | — (Watch-/Q6-Familien) | erledigt |
| `04f55eba` | `done`, im Ledger | — (C5 Zielprojektion) | erledigt |
| `531bab26` | `archived`, im Ledger | `until(pred,{timeoutMs,stepMs})` existiert (`e2e/harness.ts:175`) | ueberholt — die Arbeit ist da, die Zeile nicht mehr gebraucht |
| `9940ec64` | `archived`, im Ledger | Regel `R11b` „report says complete, git.ahead=0" → `OWNER_GATE` (`program-phase.ts:280-286`) | ueberholt |
| `a05fa7ff` | `archived`, im Ledger | `server.ts:28087`: „There is no standing Advisor, automatic nudge or Critic route in this Program" — NICHT gebaut | **die einzige lebende Arbeit.** Braucht keine Reparatur der Quelle: ihr zweiter Anker `docs/game-maker/workflow-v2.md` §7 F2 (Zeile 523) traegt den Auftrag vollstaendig. Wiederherstellbar per `POST /api/tasks/a05fa7ff/unarchive` (`server.ts#taskAct`, Ledger-Zweig) |
| `cf0d3cd4` | nirgends | die `capTasks`-Nullbudget-Korrektur steht im Code (`server.ts:2945-2956`) | erledigt, Zeile unwiederbringlich |
| `66df05b4` | nirgends | unbekannt — kein Text, kein Ledger-Eintrag, keine Sha | **nicht beurteilbar.** Das ist der teuerste Einzelfall dieser Messung, und er liegt eine Ebene ueber Befund 1: nicht die Quelle fehlt, die ZEILE fehlt |

Damit: neun von zehn sind aus Belegen entschieden, keine muss zurueck ueber `clarify first`, eine
(`a05fa7ff`) ist ein Wiederherstellungs-Entscheid mit intaktem Auftrag, und eine (`66df05b4`) ist
nicht mehr lesbar. Das mechanische Kriterium fuer „wiederherstellbar" ist
`server.ts#youngestArchivedTask` — genau das, was der `unarchive`-Zweig fragt.

## 5 Vorgeschlagene Done-Kriterien

**Befund 1 — die Prosa-Referenz.** Fertig ist dieser Schnitt, wenn eine Task-Id, die nur im Text
einer LEBENDEN Zeile steht, nicht mehr stillschweigend verdraengt werden kann: entweder weil eine
markierte `QUELLE:`-Kopfzeile existiert, die `capTasks` wie `afterHeld` haelt, oder weil die
Freigabe die Zeile verweigert, bis die Quelle angeheftet ist. Verifikationsweg: ein Check in
`e2e/tasks.ts`, der bei vollem Deckel eine im Text genannte, nicht angeheftete Quelle
setzt und `capTasks` gegen sie laufen laesst — die Quelle bleibt, und derselbe Fall ohne Markierung
faellt weiter (der Unterschied IST die Aussage). Kommando: `./e2e-isolated.sh` (Tier-2, weil eine
`supports`-nahe Kontraktaussage entsteht) plus `bun e2e/pins.ts`.
Wird Q1 wie vorgeschlagen entschieden (nicht schuetzen), ist dieser Schnitt **ein Dokumentations-
und Entscheidungsschnitt**: Kriterium erfuellt, wenn die drei Referenzklassen aus §2 an einer Stelle
stehen und die zehn Zeilen aus Q5 entschieden sind.

**Befund 2 — die Lesung.** Fertig, wenn `GET /api/tasks` fuer jede `notiz` einen abgeleiteten
Reifegrad traegt (drei Werte, Definition wie Q3, verdraengter Halter zaehlt als freigegeben) und die
`notes`-Ansicht ihn zeigt. Verifikationsweg, deterministisch und ohne Board: ein Check in
`e2e/tasks.ts` mit drei Fixtures — Notiz ohne Verwendung, Notiz mit `offen`-Urteil, Notiz mit
ausschliesslich gestempelten `erledigt`-Urteilen — der die drei Werte einzeln behauptet, plus ein
vierter mit einem Urteil auf eine nicht mehr existierende Zeile, das `reif` ergeben MUSS. Kommando:
`./e2e-isolated.sh`. Nicht Teil des Kriteriums: irgendein automatisches Schliessen.

**Befund 3 — die Deckel-Kollision.** Fertig, wenn (a) `task-notes.ts#laneNoteSources` in einem
Kommentar sagt, dass explizite Pins Join-Plaetze verbrauchen und ab `cap` alle, und (b) die
verdraengten Join-Treffer gegengebucht sind statt zu verschwinden. Verifikationsweg: ein Check in
der zustaendigen `e2e/`-Familie, der bei 5 Pins und 2 Join-Treffern die Gegenbuchung behauptet —
und, weil ein Kommentar keine Verifikation ist, ein Pin in `e2e/pins.ts` auf den Satz. Kommando:
`bun e2e/pins.ts` plus `./e2e-isolated.sh`. Minimalvariante, falls der Owner nur (a) will:
`bun e2e/pins.ts`.

## 6 Methode

```
git log --oneline -1                                  # c6848e48
grep -n "MAX_TASKS\|sourceHoldersIn\|TASK_NOTES_MAX" server.ts server/types.ts
python3 …  fleet.json                                 # 200 Zeilen, 58 lebend, 142 terminal, 1 Pin, 43 Notizen
python3 …  tasks-archive.jsonl                        # 381 Zeilen; 12/12 Quellen absent, 8/10 Zeilen present
bun <scratch>/probe.ts                                # laneNoteSources, explicit=0/1/4/5
bun e2e/pins.ts                                       # ALL PASS (vor und nach dieser Notiz)
```

Die Sonde lag im Session-Scratchpad, nicht im Baum. `fleet.json` und `tasks-archive.jsonl` wurden
nur GELESEN.

## 7 Was nicht gemessen wurde

Die Texte der zwoelf verlorenen Quellen — sie existieren in keinem Speicher mehr, und was in Docs
von ihnen weiterlebt, wurde hier nicht zusammengesucht. Ob der Owner die drei Kriterien annimmt.
Ob `66df05b4` je eine Zeile war oder ein Tippfehler im Brief; beides ist mit den heutigen Daten
nicht unterscheidbar. Und die Kosten der `QUELLE:`-Kopfzeile im Karten-Sweep (ein weiterer
Schluessel in `FORMAT_KEYS` beruehrt `releaseCardRefusal` und jede Karte) sind geschaetzt, nicht
gemessen.

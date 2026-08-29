---
frage: Konnte die parallele zweite Session vom 08-29 den Baum vergiftet haben, den der Second-host fuer das rote Audit auf 748ec97 auditiert hat?
urteil: Nein. Das Bundle enthielt beweisbar main=748ec97; die beiden Commits der Parallel-Session landeten 3m19s NACH dem Bericht. Die Praemisse der `unknowable`-Adjudikation ist widerlegt — die Ursache des 401 bleibt trotzdem ungemessen, jetzt aber aus einem engeren Grund.
bereich: [verify, harness, ledger]
belege: [server.ts#buildHelperBundle, server.ts#helperClaim, post-land-audits.jsonl at=1787999568052, helper-daemon/daemon.ts]
nicht-gemessen: Warum `successorToken` auf dem Linux-Second-host leer war; der Lauf ist weiterhin nicht wiederholt.
stand: 2026-08-29
---

# Das Bundle war nicht das Problem — `mainSha` ist eine Messung, keine Behauptung

2026-08-29, Haupt-Checkout, Nachfolge-Session. Diese Notiz korrigiert eine Praemisse in
`docs/messungen/2026-08-29-adjudikation-second-host-401.md` (`40f62f7`). Sie widerruft NICHT dessen
Selbstkorrektur — die war richtig und aus dem richtigen Grund. Sie zeigt, dass der Weg, den die
Korrektur einschlug, an einer Stelle weiter ging, als der Baum es hergibt.

## Die widerlegte Praemisse

Die Vorgaengernotiz schreibt: *"`mainSha` in der Ledger-Zeile ist die BEHAUPTUNG des Servers, nicht
die Messung des Helfers"*, und leitet daraus ab, main koenne zwischen Land und Claim gewandert sein,
ohne dass die Zeile es zeigt.

**Der erste Halbsatz stimmt fuer die falsche Haelfte der Frage, der zweite folgt nicht.**
`server.ts#buildHelperBundle` fuehrt `git bundle create <datei> main` aus und liest den SHA danach
**aus dem Header der geschriebenen Bundle-Datei zurueck** (Regex `^([0-9a-f]{40}) refs/heads/main$`
ueber die ersten 4096 Bytes). `helperClaim` schreibt genau diesen Wert als `mainSha`. Der Code sagt
es in seinem eigenen Kommentar: *"its header's second line names the exact object it packed, so the
claim never has to guess which tree it handed over."*

Damit ist `mainSha` **die Messung des uebergebenen Objekts**. Ein zwischenzeitlich gewandertes main
haette die Zeile nicht verdeckt, sondern **einen anderen `mainSha` erzeugt** — genau das ist der
Zweck des Rueckwaerts-Lesens. Die Zeile sagt `748ec97`, und `covers[0].mainAfter` sagt dasselbe.

## Drei unabhaengige Messungen, alle in dieselbe Richtung

| # | Messung | Kommando | Ergebnis |
|---|---|---|---|
| 1 | Herkunft von `mainSha` | Lesen von `server.ts#buildHelperBundle` / `#helperClaim` | aus dem Bundle-Header, nicht aus einem zweiten `rev-parse` |
| 2 | Ahnenschaft | `git merge-base --is-ancestor 748ec97 <c>` | `0cd5e23` und `972dd48` sind **Nachfahren** von `748ec97` — ein Bundle von main@748ec97 kann sie nicht enthalten |
| 3 | Chronologie | `git log -1 --format=%cd` vs. die drei Zeitstempel der Ledger-Zeile | siehe unten |

Die Chronologie, in Ortszeit:

```
12:20:52  748ec97 committed
12:22:40  Land (covers[0].at)
12:22:51  Claim — das Bundle wird gebaut, Header sagt 748ec97
12:32:48  Bericht des Second-host (result=red)
12:36:07  0cd5e23 UND 972dd48 committed  ← 3m19s NACH dem Bericht
```

Die Vorgaengernotiz datiert `972dd48` auf *"12:24, mitten im Lauf 12:22–12:32"*. Das ist die
**Autoren**-Zeit; die Commits sind per Rebase um 12:36:07 auf main gelandet, also nach dem Bericht.
Der Unterschied ist hier nicht kosmetisch — er ist der ganze Punkt.

## Was daraus folgt und was nicht

**Folgt:** Die Hypothese *"der Helfer hat einen von der Parallel-Session veraenderten Baum
auditiert"* ist fuer DIESE Zeile widerlegt. Sie war nie nur unbewiesen; sie ist am Baum falsch.

**Folgt nicht:** dass der Helfer den Baum ausgefuehrt hat, den er bekam. Diese eine Verknuepfung
— uebergebenes Bundle → tatsaechlich ausgechecktes Arbeitsverzeichnis — hatte **keinen Sensor**.
Das ist der eigentliche Befund der Vorgaengernotiz und er steht unveraendert; nur seine Reichweite
ist kleiner, als sie las: es fehlte ein Glied, nicht die halbe Kette.

**Deshalb wird hier NICHT neu adjudiziert.** Ein `unknowable` durch ein `stale-test` zu ersetzen,
weil eine Praemisse gefallen ist, waere derselbe Fehler in die Gegenrichtung — die Ursache des
leeren `successorToken` auf dem Second-host ist weiterhin geschlossen, nicht gemessen. Das Urteil
gehoert hinter die Wiederholung (Auftrag 2), nicht vor sie.

## Der Signaturbeweis am Tail

Der `out`-Tail der Zeile trennt sauber: **jede** rote Zeile geht durch `successorToken`, **jede**
gruene Zeile daneben (`ACP-16 (d)`, `ACP-16 cleanup`, `task-spawn (1d)`) durch das Owner-Token. Neun
FAILs, alle mit `401`/`{"error":"unauthorized"}`, plus der `TypeError` auf
`spawnOkBody.task.id` als Folge. Eine Wurzel, kein Streufeld — die Signatur eines leeren Credentials,
nicht die eines Produkts, das seine eigene MAIN abweist.

## Methode

Nur lesend plus `git`-Abfragen: `server.ts#buildHelperBundle`, `#helperClaim`, `#helperResult`;
`helper-daemon/daemon.ts` (Klon-Pfad); `post-land-audits.jsonl` Zeile `at=1787999568052` vollstaendig
(`out` 3464 Bytes); `git merge-base --is-ancestor` fuer beide Commits; `git log -1 --format=%cd/%ad`.
Kein Suite-Lauf fuer diese Notiz, kein Server gestartet.

## Was diese Notiz nicht gemessen hat

- **Warum `successorToken` auf dem Second-host leer war.** Die naheliegende Spur ist die Succession
  selbst: `POST /api/self/succeed` scheitert auf dieser Maschine reproduzierbar mit
  `prompt not accepted — composer still holds 98 chars after 3000ms` (zweimal beobachtet, exakt 98
  Zeichen bei unterschiedlich langem `carry`). Eine Succession, die den Nachfolge-Slot nicht fertig
  aufsetzt, liefert genau den leeren Token. **Inferiert, nicht gemessen** — die Fixture nutzt
  `waitForLabel` plus `respawnScreen`, nicht die Live-Route.
- **Ob `checks.ran: 12` aus dem gedeckelten Tail gefuellt wird.** Punkt 3 der Vorgaengernotiz, hier
  unangetastet.
- **Ob dieselbe `?? ""`-Klasse weitere Fixtures trifft.** Ein Sweep steht weiterhin aus.

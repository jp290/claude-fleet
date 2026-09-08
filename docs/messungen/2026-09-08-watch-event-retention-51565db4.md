# Zwei Watch/Event-Checks gegen eine Retention-Decke — der rote Audit auf `51565db4`

**Stand: 2026-09-08 · Lane `fleet/260908030537-52af` · Auftrag: den roten Post-Land-Audit
`51565db4` mechanisch erklären, nicht adjudizieren.**

## 0. Antwort in einem Satz

**(a) — ein Sondendefekt.** Die beiden roten Checks behaupten das Überleben genau der Zeile, die
die per-Receiver-Retention des Servers garantiert wegwirft; sie waren nur deshalb meist grün, weil
ein anderer, unbeachteter Ack still mit 409 scheiterte. Der Server verhält sich wie zugesagt, die
Sonde bekommt den Fix.

## 1. Der Lauf

| Feld | Wert |
|---|---|
| Audit-Lauf | `isolated-20260907T212226Z-625727` |
| Baum (`clonedSha` / `tree`) | `51565db4e1fe4e691f8cafa42c0a627b38762e6d` |
| jobId | `26ea1a205005` |
| Ort | Helfer `second-host`, Arbeitsverzeichnis `run-26ea1a205005-1788816138824` |
| Testinstanz | `/tmp/fleet-e2e-instance-623856` (auf dem Helfer, am 2026-09-08 noch vorhanden) |
| Ergebnis | 3953 ran / 2 failed, 2 343 880 ms |
| Fails | `deleting a Watch does not delete its acknowledged event` · `subject teardown after event creation leaves the event trail intact` (`e2e/watch.ts`) |

Vergleichslauf, grün, derselbe Helfer, ~80 min später:
`isolated-20260907T225519Z-871545`, Baum `15108892f6d450856780399cdc692e2cac8f8224`,
`run-26ea1a205005-1788821712344`, Tail `ALL PASS`.

**Die beiden Bäume sind an der gemessenen Naht identisch** (geprüft, nicht angenommen):
`git diff 15108892 51565db4 -- e2e/watch.ts server/types.ts` ist LEER, und
`git diff 15108892 51565db4 -- server.ts` enthält **null** Hunks, die `pruneFleetEvents` oder
`KEEP_TERMINAL` berühren. Der Vergleich ist damit ein Vergleich desselben Mechanismus.

## 2. Was die Program-MAIN schon gemessen hatte — nachgeprüft

**(1) Bestätigt: `e2e/ctl.ts` kann es nicht gewesen sein.** In `fleet-e2e.ts` steht
`await watch.run()` in Zeile 99 und `await ctl.run()` in Zeile 119. Was in `watch.run()` fällt,
läuft vor `ctl.run()`.

**(2) Bestätigt und präzisiert: das Event existierte und verschwand.** Der rote `suite.log` zeigt
in Zeile 1191 den Bestand des Receivers unmittelbar vor dem Sturz:

```
PASS  GET /api/self exposes only this exact receiver session's events, including uncertainty
      (["71a6afc41a713f79ad37c804:acknowledged","306b3ef4a6f531e560a8a5cd:acknowledged",
        "84e495860c50aef985f46e7b:acknowledged","254bcf4da45faedb31027533:acknowledged",
        "3a283ea207e3cdf50b89e90e:acknowledged","crashboundaryfixture:send-uncertain"])
```

`71a6afc41a713f79ad37c804` ist eventA. Zeile 1192 macht die sechste Zeile terminal:

```
PASS  the bound session may explicitly resolve a possibly-seen send-uncertain event
      (200 {"ok":true,"existing":false,"event":{"id":"crashboundaryfixture", … "receiverSlot":6,
       … "status":"acknowledged","acknowledgedAt":1788816451046, …}})
```

Acht Zeilen später fallen 1200 und 1201.

**(3) Die Retention-Hypothese ist BESTÄTIGT — und die Intermittenz hat einen benannten Grund, den
die Hypothese noch nicht hatte.** Siehe §3 und §4.

## 3. Die Decke, und die Aufrufstelle — direkt gemessen

`server.ts` hält pro RECEIVER fünf terminale Events:

```ts
const WATCH_KEEP_SPENT = 5;
const FLEET_EVENT_KEEP_TERMINAL = WATCH_KEEP_SPENT;

function pruneFleetEvents(slotId: number | null): void {
  const terminal = fleetEvents.filter((e) => e.receiverSlot === slotId
    && FLEET_EVENT_TERMINAL.includes(e.status))
    .sort((a, b) => (a.acknowledgedAt ?? a.createdAt) - (b.acknowledgedAt ?? b.createdAt));
  const keep = slotId === null ? FLEET_EVENT_KEEP_TERMINAL_OWNER_INBOX : FLEET_EVENT_KEEP_TERMINAL;
  if (terminal.length <= keep) return;
  const drop = new Set(terminal.slice(0, terminal.length - keep).map((e) => e.id));
  for (const id of drop) audit("fleet_event_prune", slotId ?? undefined, id);
  fleetEvents = fleetEvents.filter((e) => !drop.has(e.id));
}
```

Terminal ist `["acknowledged", "receiver-gone", "subject-gone"]` (`server/types.ts`).
Sortiert wird nach `acknowledgedAt ?? createdAt`, gedroppt wird von VORNE — also die ÄLTESTE.

**Der `fleet_event_prune`-Eintrag des roten Laufs selbst ist nicht mehr da**, und zwar aus einem
banalen Grund: `audit.jsonl` der Testinstanz ist rotiert. Der Ack liegt bei `ts 1788816451046`,
die älteste erhaltene Zeile (`audit.jsonl.1`) trägt `ts 1788817919010` — 24,5 min später. Es gibt
nur `audit.jsonl` und `audit.jsonl.1`; dazwischen fehlt alles. Das ist eine ausdrückliche Lücke im
Beleg, kein Gegenbeweis, und sie ist der Grund für die folgende eigene Messung.

**Eigene Messung der Aufrufstelle, 2026-09-08, isolierte Scratch-Instanz** (eigener Port/Socket,
`FLEET_CMD=true`, außerhalb des Repos; Aufbau: ein Slot geöffnet, Server gestoppt, in `fleet.json`
fünf `acknowledged` plus eine `send-uncertain`-Zeile für denselben Receiver gepflanzt, Server
gebootet, dann die sechste Zeile per Self-Token gequittet):

```
{"ts":1788837218132,"event":"fleet_event_ack","slot":1,"detail":"probeevent06"}
{"ts":1788837218132,"event":"fleet_event_prune","slot":1,"detail":"probeevent01"}
```

Bestand vor dem Ack: `probeevent01..05:acknowledged`, `probeevent06:send-uncertain`.
Bestand nach dem Ack: `probeevent02..06:acknowledged` — `probeevent01` ist weg.

**Damit ist die letzte feuernde Aufrufstelle benannt und belegt:** `server.ts#acknowledgeFleetEvent`
→ `server.ts#settleFleetEventAcknowledged` → `pruneFleetEvents(event.receiverSlot)`, in derselben
Millisekunde wie der `fleet_event_ack`. Nicht der Boot-Prune (der lief in derselben Messung
vorher NICHT: fünf terminale Zeilen ≤ fünf), nicht `markFleetEventsSubjectGone`, nicht
`markFleetEventReceiverGone`.

## 4. Warum das nur in 1,4 % / 1,6 % der Läufe rot wird

Die Fixture treibt Receiver `aId` durch SECHS terminale Events:

| # | Event | Wo im Fixture |
|---|---|---|
| 1 | `lane-ready` eventA | Ack nach dem Transport-Check |
| 2 | `deploy-terminal` `d0000001` | `deployAck1` |
| 3 | `deploy-terminal` `d0000004` | `if (inflightEvent) await ackEvent(...)` |
| 4 | `command-job` (Verdikt) | `if (ev) await ackEvent(...)` |
| 5 | `command-job` (LATE, level-getriggert) | `if (lateEvent) await ackEvent(...)` |
| 6 | `crashboundaryfixture` (`send-uncertain` → `acknowledged`) | `resolveUncertain` |

Sechs > fünf ⇒ die älteste (eventA) fällt. Das ist der rote Lauf.

**Der grüne Lauf hat nur FÜNF terminale Zeilen** — und die Differenz steht wörtlich in seinem
eigenen Log, an derselben Zeile 1191:

```
(["802dcc8be28da6db66e1439a:acknowledged","37b1f16ddded8bd981ed50eb:acknowledged",
  "16885cbd23089f91844d5fde:acknowledged","31f43ef5b215de5465b8d64b:acknowledged",
  "d4bac935cc553232429a74fc:delivered","crashboundaryfixture:send-uncertain"])
```

Die fünfte Zeile ist `delivered`, nicht `acknowledged`. `d4bac935cc553232429a74fc` ist per Zeile
1178 desselben Logs das Event der LATEN Job-Subscription.

**Mechanismus der Intermittenz:** `waitJobEvent` liefert die Zeile zurück, sobald sie EXISTIERT —
für ein frisch gemintetes Event heißt das `pending`. `server.ts#acknowledgeFleetEvent` lehnt ein
Ack auf `pending` mit 409 `event is not acknowledgeable` ab. Die alte Zeile
`if (lateEvent) await ackEvent(aTok, lateEvent.id as string);` warf diese Antwort weg. Ob der
Transport-Tick die Zeile vor dem Ack-Aufruf auf `delivered` gehoben hatte, entschied also darüber,
ob der Receiver mit fünf oder sechs terminalen Zeilen in den Crash-Boundary-Ack ging — und damit
über rot oder grün. Der Nachbar-Ack in Zeile 4508 hat das Problem nicht: ihm geht `waitPaneText`
voraus, das bis zum Erscheinen des Pane-Textes pollt, also bis NACH der Zustellung.

Die Basisraten der Vierer-Familie (5/367 = 1,4 % und 6/367 = 1,6 %,
`docs/verify-tiering.md` §11.2l-Nachtrag) sind damit die Rate, mit der dieser Tick zu früh kam.

## 5. Urteil: (a), und was daraus folgt

Der Server gibt keine Überlebensgarantie für die älteste terminale Zeile eines Receivers — die
Decke ist dokumentierter Zweck (`fleet.json` ohne Schranke wäre der Defekt, den sie verhindert).
Die Sonde behauptete eine Zusage, die es nicht gibt. **Kein Server-Fix, kein Befund gegen den
Code.**

**Ausdrücklich NICHT vorgeschlagen:** die Decke zu erhöhen. Das wäre ein Produktentscheid als
Testfix verkleidet. Falls der Owner es dennoch erwägt: der Preis wäre eine größere `fleet.json`
pro Receiver, der Nutzen wäre nur, dass eine Fixture bequemer zu schreiben ist — kein guter
Tausch. Die Fixture kann die Decke kennen.

## 6. Die Sondenänderung

`e2e/watch.ts`, drei Teile, kein „assert weniger":

1. **Der späte Job-Ack wartet auf `delivered` und wird ASSERTIERT** (neuer Check
   `job watch: the late verdict's event is acknowledged FROM delivered, never silently refused
   while pending`). Damit ist die Zahl terminaler Zeilen deterministisch sechs — der stille 409
   ist geschlossen, und er war selbst ein Sondendefekt.
2. **Die Decke ist gepinnt** (neuer Check `per-receiver retention keeps exactly the newest five
   terminal events and evicts the oldest`): er zählt mit `FLEET_EVENT_TERMINAL` aus
   `server/types.ts` — nicht mit einer nachgebauten Liste — und belegt, dass genau fünf Zeilen
   bleiben und eventA gegangen ist.
3. **Beide Haltbarkeitsaussagen bleiben beweispflichtig, aber auf Zeilen, die die Decke BEHÄLT:**
   `deleting a Watch does not delete its acknowledged event` löscht jetzt ZWEI verbrauchte Watches
   (die Lane-Transport-Watch wie bisher, dazu die Deploy-Watch) und assertiert das `acknowledged`
   Deploy-Event; `subject teardown after event creation leaves the event trail intact` assertiert
   die aufgelöste Crash-Boundary-Zeile, deren `subjectSlot` genau die Lane ist, die der Teardown
   killt (im roten Log: `"subjectSlot":5`, und `tgt.slot` ist 5).

Der stromabwärts liegende Rest der Sektion ist davon unberührt: heute stirbt eventA ohnehin
spätestens beim `kill` von `aId` (die dann noch `delivered`e late-Zeile wird `receiver-gone`,
sechs terminale, gleicher Prune). Die Menge der fünf überlebenden Zeilen ist vor und nach der
Änderung dieselbe, weshalb `replacedDeployAck` (409) und der Byte-Gleichheits-Check auf
`successEvent` weiter greifen.

## 7. Was NICHT gemessen wurde

- **Der `fleet_event_prune`-Eintrag des roten Laufs selbst.** Rotiert (§3). Die Aufrufstelle ist
  über eine eigene Reproduktion belegt, nicht über den Originaleintrag.
- **Ein Wiederholungslauf auf `51565db4`.** Der Regelbuch-Weg (§11.7: denselben Baum erneut
  fahren) würfelt gegen eine 1,4-%-Rate; die Ursache ist stattdessen aus den beiden vorhandenen
  Läufen plus einer deterministischen eigenen Messung gelesen. Gefahren wurde `./e2e-isolated.sh`
  auf dem Baum DIESER Lane (mit dem Fix) — siehe Report.
- **Die drei anderen Mitglieder der Vierer-Familie** (`subject-gone: the torn-down lane's
  undelivered event…`, `restart keeps the busy pending event…`). Sie teilen die Naht, aber nicht
  notwendig diesen Mechanismus; der Nachtrag in §11.2l vermutete eine gemeinsame Vorbedingung
  (Empfänger-Beschäftigung). Diese Messung sagt darüber nichts.
- **Ob die Decke für andere Receiver in derselben Suite ebenfalls überschritten wird.** Nur
  `aId` wurde gezählt.
- **Der Land-Pfad, der Audit-Pfad, `ctl.sh`** — auftragsgemäß nicht angefasst.
- **Das rote Audit ist NICHT adjudiziert.** Das gehört Owner/Controller.

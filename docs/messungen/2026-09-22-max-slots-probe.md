---
frage: Was hängt außer MAX_SLOTS an der Zahl 16, was macht der heutige Build mit einem belegten Slot 17, und welche Form braucht die interne Slot-Id?
urteil: MAX_SLOTS = 25 macht in slots, lanes-basic, lanes-lifecycle und restart genau einen Check rot (den Pin „all 16 fixed slots"); der unveränderte Build verwirft einen Slot-17-Record ohne jede Logzeile, lässt die tmux-Session s17 unverwaltet weiterlaufen und hat die Zeile nach zwei Speicherungen auch aus fleet.json.bak getilgt; Empfehlung ist die interne Zahl-Id (Lane-Plätze oberhalb der Bänder, etwa 12 Stellen) statt Slot.id number|string (rund 255 zu prüfende Stellen)
bereich: [slot-system, max-slots, persistenz]
belege: [server/types.ts#MAX_SLOTS, server/types.ts#PROGRAM_DISPATCH_MAX_LANES_MAX, server/types.ts#loadProgramLineage, server/types.ts#loadProgramInbox, server.ts#slotFrom, server.ts#observeTmuxSlots, server.ts#saveState, server.ts#REPO_MAX_LANES_MAX, e2e/slots.ts, e2e/lanes-lifecycle.ts, docs/messungen/2026-09-22-slot-baender-stufen-nach-32014c79.md]
nicht-gemessen: die übrigen 35 Suite-Module mit MAX_SLOTS = 25; Client-Darstellung von 25 Zeilen im Browser; RAM; die Ursache der zwei Shelve-Rots, die auch auf dem unveränderten Baum rot sind
stand: 2026-09-22
---

# Was hängt an 16 außer MAX_SLOTS? (Probe P3)

2026-09-22, Lane `fleet/260922095157-fada`, Baum `e7e93c05` (= main zum Messzeitpunkt).
Frage: **Was bricht, wenn MAX_SLOTS 25 ist, was macht der heutige Build mit einem persistierten
Slot 17, und welche Form sollte die interne Id bekommen: Zahl mit Lane-Plätzen oberhalb der Bänder
oder `Slot.id: number | string`?**

Über den Deckelwert selbst entscheidet der Owner. Diese Notiz misst nur.

## 1. Suite mit MAX_SLOTS = 25

Zwei `git archive`-Kopien desselben Baums. In der einen ist nur `server/types.ts#MAX_SLOTS` von 16
auf 25 gesetzt (nicht committet). Beide liefen mit
`FLEET_E2E_MODULES=slots,lanes-basic,lanes-lifecycle,restart ./e2e-isolated.sh`, nacheinander.
Der Filter zog fixturebedingt vier Module nach: 8 von 43 liefen (`slots autos share lanes-basic
lanes-lifecycle self-token intake restart`).

| Kopie | PASS | FAIL |
|---|---|---|
| MAX_SLOTS = 25 | 958 | 3 |
| unverändert (16) | 959 | 2 |

Die Differenz ist genau ein Check:

| roter Check | nur bei 25? | Ursache |
|---|---|---|
| `the sidebar API exposes all 16 fixed slots in order` | ja | `e2e/slots.ts` pinnt die Länge literal auf `=== 16`. `/api/sessions` lieferte `[1..25]` lückenlos. Das ist der Pin, nicht ein Produktfehler. |
| `shelved lane is an orphan (no holding slot)` | nein, auch bei 16 rot | `e2e/lanes-lifecycle.ts` (Shelve-Block): Die geshelfte Lane fehlt in `/api/slots/:id/worktrees` (`orphan` ist `undefined`). Die Ursache wurde nicht untersucht. In keinem Flake-Register oder Audit-Ledger gefunden. |
| `shelve note surfaced on the orphan` | nein, auch bei 16 rot | Folgefehler desselben fehlenden `orphan`. |

Was bei 25 grün blieb, obwohl es an der Zahl hängt: Lane-Vergabe, Neustart samt Persistenz,
Self-Token-Export, Shares und Autos über Neustart. Der Grund: die acht Lader-Prüfungen in
`server/types.ts` und `server.ts#slotFrom` lesen den Wert über `MAX_SLOTS`, nicht als Literal 16.
`REPO_MAX_LANES_MAX` ist ebenfalls `= MAX_SLOTS`.

Ein zweites, **unabhängiges** Literal 16, das der Lauf nicht sieht:
`server/types.ts#PROGRAM_DISPATCH_MAX_LANES_MAX = 16`, gespiegelt in `src/client.ts`
(`PROGRAM_DISPATCH_MAX_LANES_UI = 16`). Es deckelt Lanes je Program und bleibt bei MAX_SLOTS = 25
auf 16. Das ist kein Fehler, aber eine zweite 16, die ein Gesamtdeckel-Umbau kennen muss.

## 2. Unveränderter Build gegen eine fleet.json mit belegtem Slot 17

Scratch-Instanz aus einer dritten `git archive`-Kopie mit `FLEET_SOCK=fleetp3probe`,
`FLEET_PORT=8871` und `FLEET_CMD=true`. Eingabe: `sock` = eigener Socket, Slots `1` und `17` mit
`cwd`/`label`/`openedAt`, dazu je ein Auto auf Slot 1 und Slot 17. Vor dem Boot liefen auf dem
Scratch-Socket die Sessions `s1` und `s17` (`sleep`).

| Beobachtung | Ergebnis |
|---|---|
| `/api/sessions` | 16 Zeilen; aktiv nur Slot 1 (`eins`). Slot 17 fehlt. |
| Serverlog | 4 Zeilen, keine erwähnt 17. Es gibt **weder Warnung noch Fehler**. |
| Auto auf Slot 17 | verworfen, das Auto auf Slot 1 bleibt. |
| `fleet.json` nach Boot 1 | Slots `["1"]`: Die erste Speicherung schreibt Zeile 17 nicht mehr. |
| `fleet.json.bak` nach Boot 1 | `["1","17"]`, die letzte Kopie mit der Zeile. |
| `fleet.json.bak` nach Boot 2 | `["1"]`: Nach zwei Speicherungen ist die Zeile auf der Platte verloren. |
| tmux `s17` | läuft nach beiden Boots weiter (`pane_dead=0`). Sie wird weder adoptiert noch gekillt, und das Self-Heal kennt sie nicht. |

Urteil: **verworfen, stumm, und die Pane bleibt verwaist.** Mechanismus: die Slot-Schleife beim
Laden ruft `slotFrom(k)`, das bei `id > MAX_SLOTS` `null` gibt; die Zeile wird übersprungen. Die
Boot-Adoption (`/^s(\d+)$/` → `slotFrom`) und das Filtern von Shares, Autos und Watches über
`slotFrom(...)?.cwd` fallen durch denselben Nullfall. Nichts davon loggt.

Aus dem Code gelesen, nicht geprobt: Eine Program-Linie oder ein Inbox-Eintrag mit `slot: 17`
kostet **den ganzen Record**, nicht nur die Zeile. `loadProgramLineage` bzw. `loadProgramInbox`
geben beim ersten ungültigen Eintrag `ok: false` zurück. Das Program lädt dann ohne Linie bzw. Inbox
und mit Record-Loss-Marker, ist also laut und nicht stumm. Das gilt für einen Rückbau auf einen
16er-Build nach JEDER der beiden Varianten: Auch ein String `"4A"` fällt durch `Number.isInteger`.

## 3. Interne Zahl-Id oder `Slot.id: number | string`

Gezählt mit `rg` über die Produktionsdateien `server.ts server/*.ts src/client.ts src/protocol.ts
lane-signals.ts waits.ts start-plan.ts continuity.ts program-phase.ts slotstats.ts`. Die
`fleet-e2e-*.ts`-Harnesses sind nicht mitgezählt.

**(a) Interne Zahl, Lane-Plätze oberhalb der Bänder, `4A` als persistierter Name:**

| Stelle | Anzahl |
|---|---|
| `MAX_SLOTS` wird Gesamtzahl der Plätze, neue Konstante für die 16 Bänder (`server/types.ts`) | 1 |
| Vergabe `slots.find/filter(!cwd && !laneSpawn.has)` auf Band- bzw. Lane-Bereich beschränken (`server.ts`, 7 Treffer) | 7 |
| `src/client.ts#renderSlots`: Lane-Plätze nicht als freie Bänder zeichnen | 1 |
| `REPO_MAX_LANES_MAX` bzw. der Gesamtdeckel | 1 |
| Pin `e2e/slots.ts` („all 16 fixed slots"), der einzige rote Check aus §1 | 1 |
| Owner-Öffnen eines bestimmten Slots (`/api/slots/:id/open`): nur Bänder zulassen | 1 |
| **Summe** | **≈ 12** |

Unverändert bleiben die acht Lader-Prüfungen (sie folgen `MAX_SLOTS`), `slotFrom`, die 7 direkten
`slots[n - 1]`-Zugriffe (Anker, Shares, WebSocket), tmux `s<n>`, die Boot-Adoption,
`FLEET_SELF_SLOT` und `ctl.sh`. Die Auflösung von `4A` in `slotFrom` braucht es in beiden
Varianten (Karte S3c). Sie ist darum nicht mitgezählt.

**(b) `Slot.id: number | string`:**

| Stelle | Anzahl |
|---|---|
| `slot?: number`-Deklarationen | 145 |
| `Number.isInteger(…slot…/…id…)`-Prüfungen, davon 21 im Lader `server/types.ts` | 34 |
| `Number(raw/…slot…)`-Parses | 32 |
| numerische Sortierung `a.id - b.id` | 8 |
| direkte `slots[n - 1]`-Indizes (Array wird Map) | 7 |
| tmux-Namens-Regex `/^s(\d+)$/` (Boot-Adoption, Founding-Prüfung) | 2 |
| Routen-Regex `/api/slots/(\d+)…` in `server.ts` | 26 |
| `ctl.sh` liest `FLEET_SELF_SLOT` | 1 |
| **Summe (zu prüfen, nicht alle zu ändern)** | **≈ 255** |

Dazu kommt: Ein älterer Server sieht eine Pane `s4A` nicht. Die Regex matcht nicht, also gibt es
weder Adoption noch Kill. Das ist derselbe Verwaist-Befund wie §2, nur dauerhaft.

**Empfehlung: (a).** Der Lauf in §1 zeigt, dass die Zahl-Id schon heute über 16 hinaus trägt: ein
roter Pin und sonst nichts in den vier Modulen. (b) fasst etwa 20-mal so viele Stellen an, und
tmux-Name, Pane-Env sowie Lader-Typprüfung laufen dabei alle über denselben Wechsel. Beide
Varianten teilen den Rückbau-Befund aus §2. Karte S3b sollte deshalb dem Lader für
`slot > MAX_SLOTS` eine Logzeile mitgeben, statt stumm zu verwerfen.

## Methode

```sh
S=<scratchpad>
git archive HEAD | tar -x -C $S/m25; git archive HEAD | tar -x -C $S/m16   # + bun install je Kopie
sed -i '' 's/^const MAX_SLOTS = 16;/const MAX_SLOTS = 25;/' $S/m25/server/types.ts
(cd $S/m25 && FLEET_E2E_MODULES=slots,lanes-basic,lanes-lifecycle,restart ./e2e-isolated.sh)
(cd $S/m16 && FLEET_E2E_MODULES=slots,lanes-basic,lanes-lifecycle,restart ./e2e-isolated.sh)

# Slot-17-Probe (dritte Kopie m16b, fleet.json mit sock=fleetp3probe, Slots 1+17, Autos a1+a17)
tmux -L fleetp3probe new-session -d -s s17 -c $S/dirB 'sleep 100000'   # ebenso s1
env -u FLEET_SELF_TOKEN -u FLEET_SELF_SLOT … FLEET_HOST=127.0.0.1 FLEET_PORT=8871 \
  FLEET_SOCK=fleetp3probe FLEET_CMD=true FLEET_TOKEN=p3test bun server.ts   # Boot 1, dann Boot 2
tmux -L fleetp3probe kill-server                                          # Aufräumen

# Zählung §3
rg -c 'slot\??: number' <Dateien>; rg -c 'Number\.isInteger\([^)]*(slot|Slot|\.id|target)\b' <Dateien>
rg -n 'slots\.(find|filter)\(\(?\w+\)? => !\w+\.cwd' server.ts; rg -n 'slots\[[^\]]*- ?1\]' …
```

## Was nicht gemessen wurde

- die übrigen 35 Module mit MAX_SLOTS = 25. Der gefilterte Lauf ist eine Vorschau, kein Gate.
- die Ursache der zwei Shelve-Rots; sie sind auf dem unveränderten Baum identisch rot und damit nicht Folge von 25.
- das Zeichnen von 25 Zeilen im Browser und RAM bei 25 Sessions (siehe `2026-09-22-slot-baender-stufen-nach-32014c79.md` §3.1).
- die Stellenzahlen in §3 sind Grep-Treffer, keine gebaute Änderung. Die ≈ 12 für (a) sind eine Untergrenze ohne S3c.

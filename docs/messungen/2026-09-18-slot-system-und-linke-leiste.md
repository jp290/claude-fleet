---
frage: Wie wird die linke Leiste neu gebaut und wie weit muss dafür das Slot-System weichen?
urteil: Die Slots bleiben der interne Prozess-Pool; neu ist allein die LINIE (die vorhandene lineageId, ab dem Start vergeben, mit einem Etikett, das nie eine Adresse ist), an der Nachfolge und Lane-Anker hängen. Vier Stufen S0 bis S3, S0 (der Lane-Anker folgt der Nachfolge) repariert einen heute live gemessenen Defekt und ist ohne jede Leisten-Änderung landbar.
bereich: [leiste, slot-system, succession]
belege: [src/client.ts#renderSlots, src/client.ts#stacksOf, server.ts#decideLaneAnchor, server.ts#handleSelfSucceed, server.ts#succeedLane, server.ts#openSlot, server/types.ts#MAX_SLOTS, docs/design/sidebar/index.html]
nicht-gemessen: kein Produktcode, keine Suite gefahren; Rollback-Verhalten von saveState mit einem neuen Feld nur aus dem Lademuster erschlossen; Zustände wartet/fertig im Mockup aus idle+git erschlossen, nicht aus einem Server-Feld.
stand: 2026-09-18
---

# Die linke Leiste und das Slot-System dahinter

2026-09-18/19, Lane `fleet/260918212812-1f4d`. Frage: **Was zeigt die neue Leiste, was muss sich am
Slot-System dafür ändern, und in welchen einzeln landbaren Stufen?** Phase 1, kein Produktcode.
Mockup: `docs/design/sidebar/index.html`.

## 1. Die Vorgabe des Owners (wörtlich, 2026-09-18/19)

„Ich will nun die linke Slot-Leiste vollkommen ueberarbeiten, ich will weg vom Slots-System" · RAM
ist knapp, also wenige Sessions · „die slot verweisung in gesprächen [macht] total sinn, weil sie
[…] teil der state.sh ist" · Lanes „klauen" die Zahlen · „dass man z.b selber seine session nach
oben oder unten packen kann" gefällt · es gibt Hintergrund-Lanes · „ich will immernoch irgendwo
hinklicken können um eine session zu starten" · „die succession einer session [löst] ein ausgrauen
und erscheinen eines neuen session-kastens rechts davon aus (… animationen und effekte)" · der
Kasten zeigt „alles genauso weiter", aber „wesentlich übersichtlicher und vollständiger" · Lanes
sind „eigene kleinere kästen" an der Linie, keine Zähler · „Ram möchte ich außerdem auch nicht
anzeigen" · „keine richtigen bänder […], nur guidance für die Kästen" · „deine beibehaltung der
slots ist wahrscheinlich soweit das beste" · eine „absolut minimalistische UI".

Reichweite damit: **Leiste (a) plus eine dünne Identitätsschicht**, nicht das Modell (c). Die Gabel
konnte nicht als Tool-Frage gestellt werden (Lane-Hook verweigert `AskUserQuestion`, und
`POST /api/self/clarifications` antwortete `no exact clarification receiver evidence`, siehe §3.3);
sie wurde im Gespräch geklärt. Offen ist genau eine Geschmacksfrage: Etikett als Buchstabe oder Zahl
(§4.1); das Mockup schaltet zwischen beiden um.

## 2. Vermessung: wo die Slot-Nummer Identität trägt

Gezählt mit `rg -c` im Baum `8619af25`; `server.ts` 36 492 Zeilen, `src/client.ts` 12 076.

| Schicht | Fundstellen | trägt die Nummer Identität? | stabile ID daneben |
|---|---|---|---|
| Server-Routen | `slotFrom(` 96, `/api/slots/` 8 Literale (Rest per Regex), `body.slot`/`slot: s.id` 47 | ja, jede Owner-Route | nein; Schutz nur per `openedAt`-Pin |
| Zustand | `slots` ist ein Array fester Länge, `server/types.ts#MAX_SLOTS` = 16, Zugriff auch per `slots[n - 1]` | ja, Index = Identität | `openedAt` 323, `sessionId` 272, `[oO]ccupant` 409 Treffer |
| Env und tmux | `FLEET_SELF_SLOT` 63 Treffer im getrackten Baum (2 in `server.ts`), tmux-Name `s<id>` 4 Bildestellen | ja, Spawn-Zeit-Snapshot in der Pane | `FLEET_SELF_TOKEN` bindet an den Occupant |
| Self-API | Token → Slot, kein Slot-Feld im Body wird gelesen | nein | ja, per Konstruktion |
| Program-Bindung | `main.slot` 54 | ja, aber mit `openedAt`+`sessionId` | `Program.lineage`, `lineageId` 35 |
| Events, Watches | `receiverSlot`/`subjectSlot` 82, Autos 22 | ja, mit Occupant-Tripel | teils |
| Messages | Adresse ist Program oder Rolle (`docs/self-api.md` §messages) | nein | ja |
| Client | `/api/slots` 44, Wort `slot` 464, `renderSlots`-Familie 17, `public/index.html` 14 Leisten-Selektoren | ja | `worktree.anchor` `{slot, openedAt}` |
| Skripte | `ctl.sh` 102, `state.sh` 5, `register.sh` 1 | `ctl.sh` ja | `ctl.sh send --main` löst Program → Slot frisch auf |
| e2e | 54 von 60 Dateien, 6 749 Treffer, `/api/slots` 1 114, `e2e/pins.ts` 263 | ja | n. a. |

Was bricht, wenn die Nummer wegfiele: alle Owner-Routen, tmux-Adoption nach srv-Neustart, jede
Pane-Env, 1 114 Suite-Aufrufe. **Deshalb fällt sie nicht weg.** Was heute schon ohne Nummer
adressiert: Self-API, Messages, `send --main`.

### 2.1 Vier Befunde, die den Entwurf tragen (gemessen)

1. **Die Leiste faltet Lanes schon unter ihre Herkunft.** `src/client.ts#stacksOf` gruppiert nach
   `worktree.anchor`; `src/client.ts#renderSlots` zeichnet Anker-Zeile plus eingerückte Lanes, Lanes
   ohne passenden Anker unter `repoHeaderRow`. Der Anker entsteht in `server.ts#decideLaneAnchor`.
2. **Der Anker ist `{slot, openedAt}` und überlebt keine Nachfolge.** Anker-Schreiber gibt es genau
   zwei (Lane-Öffnung, `loadState`); keine Nachfolge-Schiene hängt um. Live am 2026-09-18: die Lanes
   in Slot 6, 7 und 12 tragen `anchor {slot:3, openedAt:1789727616767}`; `audit.jsonl` zeigt
   `send slot 13 succession` bei 1789767315999 und `slot_kill 3 handoff` bei 1789767436020. Slot 3
   ist leer, die drei Lanes sind Waisen ihrer eigenen Orchestratorin.
3. **Eine MAIN-Nachfolge wechselt den Platz, eine Lane-Nachfolge nicht.** Zehn Stellen nehmen den
   ERSTEN freien Platz (`slots.find`/`filter((x) => !x.cwd && !laneSpawn.has(x.id))`: sieben
   Sitzungs-/Nachfolge-Pfade, drei Dispatch-Pfade); `server.ts#succeedLane` bleibt im Slot. Beide
   Occupants leben während der Übergabe gleichzeitig, der zweite Platz ist also nötig.
4. **Die Linie existiert, aber zu spät und unsichtbar.** `server.ts#openSlot` setzt
   `lineageId = null`; erst `handleSelfSucceed` vergibt sie (`s.lineageId ?? randomBytes`). Der
   Slot-Teil von `GET /api/sessions` trägt sie nicht, `src/client.ts` hat 0 Treffer für `lineage`.

### 2.2 Berührte Queue- und Archivzeilen

Archiv (`tasks-archive.jsonl`, 311 Zeilen, 30 Treffer auf Recycling/Anker/Waise, davon einschlägig):
`bf6fc2ea` (Owner-`/send` in einen spawnenden Lane-Slot tötet die Lane, der Vorfall vom 14.09.) ·
`8c5ecf37` (`ctl.sh send`) · `11441e5e` (Merge-Verdikt `merges["3"]` überlebt keine MAIN-Nachfolge)
· `f58d0112`, `0d3a5b76` (e2e-Sonde erkennt eine MAIN an der Slot-Nummer statt an der Occupation) ·
`2630483e` (134 unzustellbare MAIN-Entscheide). Offen: `85f45012` (berührt `e2e/slots.ts`,
`server.ts`, `server/types.ts`). Gelesene Vornotizen: `2026-08-30-agent-slot-session-nahtstellen-glm.md`
(F3: ein Plain-Slot ist Prozess-Fakt ohne Intent), `2026-09-14-ram-slots-sessions-astra.md`
(Session-Anzahl ist ein RAM-Hebel), `2026-09-15-second-host-sessions-optionen.md` (B1 hält EINEN
Namensraum, was für „Slots intern behalten" spricht).

## 3. Der Entwurf

### 3.1 Begriffe

- **Platz** (heute Slot): interner Prozessplatz `s1…s16`. Bleibt Adresse aller Routen. Erscheint in
  der Leiste nur noch im Tooltip und im Pane-Kopf.
- **Linie**: eine Arbeit über alle ihre Nachfolgen. Technisch die `lineageId`, neu ab dem Start
  vergeben. Sie trägt ein **Etikett** und eine Position in der Leiste. Das Etikett ist NIE eine
  Adresse: keine Route nimmt es an. So entsteht keine zweite Zahlenwelt, in der „4" zwei Dinge hieße
  (die Fehlerklasse von `bf6fc2ea`).
- **Lane-Kasten**: hängt an der Linie, von der die Lane ausging, heißt `<Etikett><n>` („A3") und
  verbraucht kein Etikett. Lanes ohne Herkunft: EIN Sammelbereich am Ende, nicht je Repo.
- **Repo**: kein Strukturelement. Farbstreifen am Kasten (der bestehende `tintProject`-Ton) plus
  Name in Zeile zwei. Die Leiste wächst mit der Zahl der Linien, nie mit der Zahl der Repos.

### 3.2 Was ein Kasten zeigt

Zeile eins: Zustand (eine Form UND eine Farbe: arbeitet, wartet auf dich, fertig, rot, ruht), Label,
Rolle klein, Kontext-%. Zeile zwei: Repo, Modell, zuletzt aktiv. Bodenlinie: Kontextfüllstand, amber
ab 25 % und NUR für claude-Sessions (codex kompaktiert selbst, Owner-Korrektur 2026-09-14). Hover:
Lane starten, übergeben, schließen ersetzen den rechten Rand. Effort, git-Stand und interner Platz
stehen im Tooltip. Kopf der Leiste: EIN Satz („1 rot, 2 warten auf dich"), jeder Teil springt zur
nächsten betroffenen Session. Kein RAM.

Vorgänger: höchstens drei graue Striche links vom lebenden Kasten, Hover nennt Label, Zeitpunkt und
Füllstand der Übergabe. Übergabe: der alte Kasten ergraut und schrumpft in ~0,55 s zum Strich, der
neue wächst von rechts herein; die Lane-Kästen bleiben hängen. Eine **Lane übergibt in derselben
Form, nur kleiner** (Owner 2026-09-19): `server.ts#succeedLane` bleibt in Platz, Worktree und Branch,
der Lane-Kasten bekommt eigene 3-px-Striche. Der Server hält dafür heute nur die Anzahl
(`laneSuccessions`, in `loadState` persistiert), keine Vorgänger-Details; der Strich-Tooltip nennt
deshalb die Anzahl, bis S1 die Linien-Liste auch für Lanes liefert. Freie Stellen zwischen Linien sind
eine Haarlinie, die sich beim Zeigen zu „hier eine Session starten" öffnet; am Ende steht ein
fester Start-Knopf. Linien lassen sich ziehen, weil das Etikett an der Linie hängt und nicht an der
Position. Eingeklappt (50 px): Etikett, Zustand, darunter ein Zustandspunkt je Lane. Handy: die
Leiste ist das Blatt, Zeilen in Daumenhöhe, Aktionen wie heute im Zeilen-Streifen.
„20+ Sessions" gibt es nicht: `MAX_SLOTS` ist 16; das Mockup zeigt 16 belegte Plätze auf 900 px Höhe.

### 3.3 Erschlossen, nicht gemessen

- „wartet auf dich" und „fertig" haben heute kein eigenes Feld im Slot-Teil von `/api/sessions`
  (Keys: agent, ctx, git, lastOutput, mergePending, autoCloseRefusal …). `awaiting` liefert
  `/api/self`. S2 braucht dafür ein abgeleitetes Feld oder `awaiting` im Payload.
- Diese Lane hat keinen Clarification-Empfänger, vermutlich weil ihr Anker (Befund 2) tot ist und
  keine Lane-Watch existiert (`server.ts#clarificationReceiverFor`, Fehlertext
  `NO_RECEIVER_EVIDENCE`). S0 würde das vermutlich mit heilen; nicht nachgewiesen.
- `loadState` liest Slot-Zeilen Feld für Feld und ignoriert Unbekanntes, ein älterer Server verträgt
  also ein neues Feld. Ob sein `saveState` es beim nächsten Schreiben verwirft, ist nicht gelesen;
  die Folge wäre ein neu vergebenes Etikett, kein Sessionverlust.

## 4. Stufenplan mit Prüfplan

Jede Stufe ist eine eigene Karte, einzeln landbar und rückrollbar. Für alle gilt: `bun e2e/pins.ts`,
tsc und build als Gate; `./e2e-isolated.sh` als Vorschau (Suite-Offer an den Helfer), weil jede
Stufe eine Aussage berührt, über die Checks in `e2e/slots.ts` stehen.

| Stufe | Inhalt | Beweis | neue Sonde | Scratch-Live-Test vor dem Land | Rückfalltür |
|---|---|---|---|---|---|
| **S0** Anker folgt der Nachfolge | Bei MAIN-, Supervisor- und generischer Nachfolge hängen alle Lanes mit `anchor == Vorgänger-Occupant` auf die Nachfolgerin um; Schreibpunkt beim Linien-Record | `e2e/slots.ts` (44 anchor-Treffer), `e2e/programs.ts`, `e2e/supervisor.ts`, `./e2e-claude-gate.sh` | Lane öffnen, MAIN übergibt, Anker zeigt auf die Nachfolgerin; Gegenprobe: fremde Lane bleibt unberührt | Instanz `FLEET_CMD=true`, eigener Socket: Lane, succeed, `GET /api/sessions` | Revert, Anker bleiben gültige Occupants |
| **S1** Linie ab Start, Etikett, im Payload | `lineageId` in `openSlot` statt erst bei der Nachfolge; Feld `tag` an der Linie, vererbt; `lineage {id, tag, past[]}` im Slot-Teil von `/api/sessions`; EIN Platz-Verteiler statt zehn Stellen, Lanes von oben, Sessions von unten | `e2e/slots.ts`, `e2e/restart.ts`, `e2e/self-token.ts` (24 lineage-Treffer), Pins für den Verteiler | srv-Neustart mitten in einer Übergabe: Etikett und Vorgänger-Liste überleben; keine Route akzeptiert ein Etikett | Neustart der Scratch-Instanz mit drei Sessions, davon eine übergeben; danach alter Build gegen dieselbe `fleet.json` | Feld ist additiv; Revert lässt es ungelesen |
| **S2** neue Leiste hinter Schalter | `renderSlots` bekommt eine zweite Zeichenroutine, Schalter in `localStorage` (Muster `STACK_LS`), alte Leiste bleibt Default | tsc, build, `e2e/slots.ts`-Leistenchecks gegen BEIDE Schalterstellungen | Headless-Bild je Zustand (Chrome-Aufruf siehe Methode) | Scratch-Instanz mit 16 Plätzen, Übergabe, Landen, Rot; Handy am echten Gerät | Schalter aus |
| **S3** Etikett in den Werkzeugen | `state.sh`/`ctl.sh` drucken `A (s13) Label`; danach Default-Schalter umlegen, alte Zeichenroutine abbauen | `e2e/ctl.ts`, Pins auf die Ausgabeform | `ctl.sh` verweigert ein Etikett als Slot-Argument mit Namen | `FLEET_CTL_HOME` auf Scratch | Ausgabeform zurück |

Reihenfolge-Zwang: S2 erst, wenn die drei Client-Lanes (Queue-Ansicht, Info-Leiste, Chat) gelandet
sind; S0 und S1 berühren `src/client.ts` nicht. Deploy: S0 und S1 ändern nur, was beim NÄCHSTEN
Öffnen oder Übergeben geschrieben wird; laufende Sessions ohne `lineageId` bekommen sie beim Laden
nachgetragen (Muster `backfillProgramMainSessionId`), ihr tmux-Name und ihre Env bleiben unberührt.

Nicht in diesem Programm: das Dispatcher-Blatt mit Lane-Profilen (Owner-Idee 2026-09-19). Die Naht
ist der Start-Klick; vorhandene Basis ist `profileKind` bei der Program-Gründung. Eigene Karte.

### 4.1 Offene Owner-Entscheidung

Etikett als **Buchstabe** (A, A3; nicht mit `s13` verwechselbar, Empfehlung) oder als **Zahl**
(vertraut, aber „4" hieße dann Linie 4 UND Platz 4). Im Mockup umschaltbar.

## Methode

```
rg -c 'slotFrom\(' server.ts; rg -c '/api/slots' src/client.ts e2e/; rg -c FLEET_SELF_SLOT .
rg -n 'slots\.(find|filter)\(\((x|s)\) => !(x|s)\.cwd' server.ts          # zehn Vergabestellen
rg -n 'lineageId\s*=[^=]' server.ts; rg -c lineage src/client.ts           # Befund 4
./ctl.sh get /api/sessions --json                                          # Live-Stand, Anker je Lane
grep -E '"slot":(3|13)\b' <main>/audit.jsonl | grep -E 'succe|handoff'     # Befund 2
"<Chrome>" --headless=new --window-size=900,800 --virtual-time-budget=4000 \
  --screenshot=x.png "file://$PWD/docs/design/sidebar/index.html#do=succeed,red"
```

Das Mockup spielt Schalter aus dem Hash ab (`#do=full,collapse`, `#do=phone`), so ist jeder Zustand
verlinkbar und headless prüfbar. Geprüft am Bild: Desktop, Übergabe, Rot, 16 Plätze, eingeklappt, Handy.

## Was nicht gemessen wurde

Keine Suite und kein Scratch-Server liefen, weil kein Produktcode entstand. Die Animation ist nur im
Chrome-Headless-Endbild geprüft, nicht in Bewegung und nicht in Safari auf dem Handy. Die Zählungen
sind Textsuchen, keine Aufrufgraphen: `slot` als Wort trifft auch Kommentare. Ob `saveState` eines
älteren Builds ein unbekanntes Slot-Feld verwirft, ist nicht gelesen. Wie viele der 1 114
`/api/slots`-Aufrufe in e2e eine Nummer als Identität PRÜFEN statt nur benutzen, ist nicht gezählt.

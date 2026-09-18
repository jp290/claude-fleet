---
frage: Wie wird die linke Leiste neu gebaut und wie weit muss dafür das Slot-System weichen?
urteil: Die Slot-Nummer bleibt die eine Nummernwelt und wird zur Bandnummer: eine Session behält sie über jede Übergabe, Lanes belegen keine sichtbare Nummer mehr und hängen als kleine Kästen am Band ihrer Herkunft. Fünf Stufen S0 bis S4; S0 (der Lane-Anker folgt der Nachfolge) repariert einen heute live gemessenen Defekt, die neue Leiste (S2) kommt vor dem riskanten Serverteil (S3, nummernstabile Übergabe).
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
sind „eigene kleinere kästen" am Band, keine Zähler · „Ram möchte ich außerdem auch nicht
anzeigen" · „keine richtigen bänder […], nur guidance für die Kästen" · „deine beibehaltung der
slots ist wahrscheinlich soweit das beste" · eine „absolut minimalistische UI".

Reichweite damit: **Leiste plus eine dünne Identitätsschicht**, nicht das Modell (c). Die Gabel
konnte nicht als Tool-Frage gestellt werden (Lane-Hook verweigert `AskUserQuestion`, und
`POST /api/self/clarifications` antwortete `no exact clarification receiver evidence`, siehe §3.3);
sie wurde im Gespräch geklärt. Bestätigt hat der Owner den Stand „Band = nummerierter Platz, die
Nachfolgerin bleibt im Band, Lanes ohne eigene Nummer" („ok", 2026-09-19).

**Fassung 1 dieser Notiz und des Mockups wich davon ab** (Owner: „entspricht kein Stück dem was
vorher besprochen wurde"): Vorgänger als 4-px-Strich statt als ausgegrauter Kasten, Buchstaben
statt Zahlen (nur vorgeschlagen, nie bestätigt), Haarlinien statt nummerierter freier Plätze, Lanes
als Listenzeilen, ein erfundener Kopfsatz. Fassung 2 leitet jedes Element aus einem Satz in §1 ab.

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

- **Band**: ein nummerierter Platz, der dem Owner gehört, also der Slot, wie er ihn heute benutzt.
  Die Nummer ist die Slot-Nummer; es gibt EINE Nummernwelt, „schau auf 3" und `/api/slots/3` meinen
  dasselbe. Neu: die Nummer bleibt über eine Übergabe beim Band (heute springt sie, Befund 3). Das
  Band wird nicht gezeichnet; es ist nur die Flucht, in der die Kästen laufen.
- **Kasten**: eine Session. Übergibt sie, ergraut ihr Kasten und bleibt als Kasten stehen, der neue
  erscheint rechts davon. Die Daten dafür sind die Linie (`lineageId`, `Program.lineage`).
- **Lane-Kasten**: kleiner Kasten am Band der Session, von der die Lane ausging (der bestehende
  `worktree.anchor`). Er heißt `3a`, `3b` und belegt keine Bandnummer. Sein Prozess läuft weiter auf
  einem internen Platz, der von OBEN vergeben wird und nur im Tooltip steht (`s12`); das bleibt seine
  Routen-Adresse. `3a` enthält immer einen Buchstaben und ist darum nie mit einem Platz verwechselbar.
  Hintergrund-Lanes des Ticks hängen am Band der MAIN ihres Programs; Lanes ohne Herkunft an einem
  Sammelband am Ende.
- **Repo**: kein Strukturelement. Farbton am Kastenrand (der bestehende `tintProject`) plus Name in
  Zeile zwei. Die Leiste wächst mit der Zahl der Sessions, nie mit der Zahl der Repos.

### 3.2 Was die Leiste zeigt (jedes Element mit seinem Satz aus §1)

| Owner | Element |
|---|---|
| „auf einer Art Band laufen … ausgrauen und erscheinen eines neuen session-kastens rechts davon" | Jedes Band ist ein waagrechter Streifen. In der 228-px-Leiste steht er so, dass der lebende Kasten ganz zu sehen ist und der ausgegraute Vorgänger links 20 px hervorschaut; ein Klick darauf fährt das Band zurück. Schalter „breit" (660 px) zeigt die ganzen Bänder mit bis zu drei Vorgängern als Kästen |
| „animationen und effekte" | Übergabe: der lebende Kasten ergraut an Ort und Stelle, der neue fährt in 0,55 s von rechts aufs Band, ein Lichtrand klingt 1,1 s aus; die Lane-Kästen ziehen mit |
| Lanes „eigene kleinere kästen", Hintergrund-Lanes, „auch lanes [können] successions machen" | Kleine Kästen unter dem lebenden Kasten, zwei je Reihe, mit Zustand, Buchstabe, Label, Füllstand-Haarlinie. Eine Lane-Übergabe zeichnet dieselbe Grammatik klein: grauer Mini-Kasten, neuer rechts davon. Der Server kennt dafür heute nur die Anzahl (`laneSuccessions`) |
| „irgendwo hinklicken … session starten", „selber … nach oben oder unten packen" | Freie Plätze bleiben als nummerierte, stille Zeilen stehen (bis zum höchsten belegten plus eins); Klick startet dort. Die Wahl der Nummer IST das Ordnen, wie heute (`emptyRow → openPicker`) |
| „alles genauso weiter …, aber wesentlich übersichtlicher und vollständiger" | Zeile eins: Zustand (Form UND Farbe: arbeitet, wartet auf dich, fertig, rot, ruht), Label, Rolle, Kontext-%. Zeile zwei: Repo, Modell, zuletzt aktiv. Bodenlinie: Füllstand, amber ab 25 % nur für claude-Sessions. Effort und git im Tooltip |
| „Ram … nicht anzeigen", „absolut minimalistisch" | Kein RAM, kein Kopfsatz, keine Gruppenüberschriften, keine gezeichneten Bänder |

Eingeklappt (50 px): Nummer, Zustand, ein Zustandspunkt je Lane. Handy: die Leiste ist das Blatt,
Zeilen in Daumenhöhe, das Band wischt waagrecht. „20+ Sessions" gibt es nicht: `MAX_SLOTS` ist 16;
das Mockup zeigt 11 Sessions plus 5 Lanes.

### 3.3 Erschlossen, nicht gemessen

- „wartet auf dich" und „fertig" haben heute kein eigenes Feld im Slot-Teil von `/api/sessions`
  (Keys: agent, ctx, git, lastOutput, mergePending, autoCloseRefusal …). `awaiting` liefert
  `/api/self`. S2 braucht dafür ein abgeleitetes Feld oder `awaiting` im Payload.
- Diese Lane hat keinen Clarification-Empfänger, vermutlich weil ihr Anker (Befund 2) tot ist und
  keine Lane-Watch existiert (`server.ts#clarificationReceiverFor`, Fehlertext
  `NO_RECEIVER_EVIDENCE`). S0 würde das vermutlich mit heilen; nicht nachgewiesen.
- `loadState` liest Slot-Zeilen Feld für Feld und ignoriert Unbekanntes, ein älterer Server verträgt
  also ein neues Feld. Ob sein `saveState` es beim nächsten Schreiben verwirft, ist nicht gelesen;
  die Folge wäre eine verlorene Vorgänger-Liste, kein Sessionverlust.

## 4. Stufenplan mit Prüfplan

Jede Stufe ist eine eigene Karte, einzeln landbar und rückrollbar. Für alle gilt: `bun e2e/pins.ts`,
tsc und build als Gate; `./e2e-isolated.sh` als Vorschau (Suite-Offer an den Helfer), weil jede
Stufe eine Aussage berührt, über die Checks in `e2e/slots.ts` stehen. Der Wert kommt vor dem Risiko:
die Leiste (S2) braucht die nummernstabile Übergabe (S3) nicht, sie zeichnet bis dahin das Band an
der Nummer der Nachfolgerin.

| Stufe | Inhalt | Beweis | neue Sonde | Scratch-Live-Test vor dem Land | Rückfalltür |
|---|---|---|---|---|---|
| **S0** Anker folgt der Nachfolge | Bei MAIN-, Supervisor- und generischer Nachfolge hängen alle Lanes mit `anchor == Vorgänger-Occupant` auf die Nachfolgerin um | `e2e/slots.ts` (44 anchor-Treffer), `e2e/programs.ts`, `e2e/supervisor.ts`, `./e2e-claude-gate.sh` | Lane öffnen, MAIN übergibt, Anker zeigt auf die Nachfolgerin; fremde Lane bleibt unberührt | Instanz `FLEET_CMD=true`, eigener Socket: Lane, succeed, `GET /api/sessions` | Revert, Anker bleiben gültige Occupants |
| **S1** Linie im Payload, ein Verteiler | `lineageId` schon in `openSlot`; `lineage {id, past[]}` im Slot-Teil von `/api/sessions` (Label, Zeitpunkt, Füllstand je Vorgänger, auch für Lanes); EIN Platz-Verteiler statt zehn Stellen: Lanes von oben, Sessions am gewählten Platz oder von unten | `e2e/slots.ts`, `e2e/restart.ts`, `e2e/self-token.ts` (24 lineage-Treffer), Pin auf den Verteiler | srv-Neustart mitten in einer Übergabe: die Vorgänger-Liste überlebt; bei 15 belegten Plätzen nimmt eine Lane nie den Platz unter einer Session weg | Neustart der Scratch-Instanz mit drei Sessions, eine übergeben; danach alter Build gegen dieselbe `fleet.json` | Felder sind additiv; Revert lässt sie ungelesen |
| **S2** neue Leiste hinter Schalter | zweite Zeichenroutine neben `renderSlots`, Schalter in `localStorage` (Muster `STACK_LS`), alte Leiste bleibt Default | tsc, build, Leistenchecks in `e2e/slots.ts` gegen BEIDE Schalterstellungen | Headless-Bild je Zustand (Aufruf siehe Methode) | 16 Plätze, Übergabe, Lane-Übergabe, Landen, Rot; Handy am echten Gerät | Schalter aus |
| **S3** nummernstabile Übergabe | Die Nachfolgerin wird mit der Nummer des Bands geboren; der Vorgänger zieht beim Übergeben in einen nummernlosen Abgangsplatz (tmux `rename-session`, Slot-Objekt umhängen), bis `retireSucceededSession` ihn beendet | `e2e/programs.ts` (84 lineage-Treffer), `e2e/supervisor.ts`, `e2e/restart.ts`, `./e2e-claude-gate.sh`, `./e2e-clean-review.sh` | Übergabe: Nummer bleibt, Self-Token des Vorgängers gilt bis zu seinem Ende, ein `/send` an die Nummer trifft nie den Sterbenden; srv-Neustart WÄHREND der Übergabe verliert keine der zwei Panes | Scratch mit echtem `claude`-Harness, Neustart im Übergabefenster, tmux-Namen vorher/nachher | eigenes Flag; aus = heutiges Verhalten |
| **S4** Werkzeuge | `state.sh`/`ctl.sh` drucken Lanes als `3a (s12)`; alte Zeichenroutine abbauen, Schalter-Default umlegen | `e2e/ctl.ts`, Pins auf die Ausgabeform | `ctl.sh` verweigert `3a` als Slot-Argument mit Namen | `FLEET_CTL_HOME` auf Scratch | Ausgabeform zurück |

Reihenfolge-Zwang: S2 erst, wenn die drei Client-Lanes (Queue-Ansicht, Info-Leiste, Chat) gelandet
sind; S0, S1 und S3 berühren `src/client.ts` nicht. Deploy: S0 und S1 ändern nur, was beim NÄCHSTEN
Öffnen oder Übergeben geschrieben wird; laufende Sessions ohne `lineageId` bekommen sie beim Laden
nachgetragen (Muster `backfillProgramMainSessionId`), tmux-Name und Env bleiben unberührt. S3 ist
die einzige Stufe, die eine laufende Pane anfasst, darum steht sie hinter einem Flag und zuletzt.
S3 ist **erschlossen, nicht erprobt**: dass `slots[n - 1]`-Zugriffe und die Pane-Env
(`FLEET_SELF_SLOT` des Vorgängers wird unwahr, er stirbt aber und wird per Token adressiert) das
tragen, muss die Karte zuerst vermessen.

Nicht in diesem Programm: das Dispatcher-Blatt mit Lane-Profilen (Owner-Idee 2026-09-19). Die Naht
ist der Start-Klick; vorhandene Basis ist `profileKind` bei der Program-Gründung. Eigene Karte.

## Methode

```
rg -c 'slotFrom\(' server.ts; rg -c '/api/slots' src/client.ts e2e/; rg -c FLEET_SELF_SLOT .
rg -n 'slots\.(find|filter)\(\((x|s)\) => !(x|s)\.cwd' server.ts          # zehn Vergabestellen
rg -n 'lineageId\s*=[^=]' server.ts; rg -c lineage src/client.ts           # Befund 4
./ctl.sh get /api/sessions --json                                          # Live-Stand, Anker je Lane
grep -E '"slot":(3|13)\b' <main>/audit.jsonl | grep -E 'succe|handoff'     # Befund 2
"<Chrome>" --headless=new --window-size=900,800 --virtual-time-budget=4000 \
  --screenshot=x.png "file://$PWD/docs/design/sidebar/index.html#do=succeed,wide"
```

Das Mockup spielt Schalter aus dem Hash ab (`#do=full,collapse`, `#do=phone`, `#do=succeed,wide`),
so ist jeder Zustand verlinkbar und headless prüfbar. Geprüft am Bild: schmal, breit, Übergabe
(Session und Lane), Lane-Start, Rot, 16 Plätze, eingeklappt, Handy.

## Was nicht gemessen wurde

Keine Suite und kein Scratch-Server liefen, weil kein Produktcode entstand. Die Animation ist nur im
Chrome-Headless-Endbild geprüft, nicht in Bewegung und nicht in Safari auf dem Handy. Die Zählungen
sind Textsuchen, keine Aufrufgraphen: `slot` als Wort trifft auch Kommentare. Ob `saveState` eines
älteren Builds ein unbekanntes Slot-Feld verwirft, ist nicht gelesen. Wie viele der 1 114
`/api/slots`-Aufrufe in e2e eine Nummer als Identität PRÜFEN statt nur benutzen, ist nicht gezählt.

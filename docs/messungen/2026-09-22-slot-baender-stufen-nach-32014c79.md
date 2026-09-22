---
frage: Welche Stufen des Slot-Band-Plans vom 18.09. bleiben nach der In-place-Nachfolge (32014c79) offen, wie werden sie als Karten geschnitten, und was heißt der Owner-Vorschlag „Gesamtdeckel 25 Sessions" am Code?
urteil: S1, S2 und S4 sind geliefert (S4 in anderer Form: Töten, dann auf demselben Slot neu öffnen, ohne Abgangsplatz); S0 ist offen und seit der In-place-Nachfolge bei JEDER MAIN-Übergabe fällig (live gemessen, eine Lane wird zu 0A); offen bleiben S0, der feste Lane-Buchstabe, eine Probe vor dem Bau, der Umzug der Lanes aus der Nummernreihe samt Gesamtdeckel, die Adresse 4A in Routen und Werkzeugen. Ein Gesamtdeckel existiert heute schon implizit (16 Plätze für MAINs und Lanes zusammen); 25 als Zahl ist ein RAM-Entscheid des Owners, der Umbau sollte mit Default 16 verhaltensneutral landen.
bereich: [slot-system, succession, deckel]
belege: [server.ts#respawnInPlace, server.ts#decideLaneAnchor, server.ts#slotFrom, server.ts#openLaneInSlot, server.ts#successionRowView, server.ts#successionLine, src/client.ts#stacksOf, src/client.ts#laneBandNames, server/types.ts#MAX_SLOTS, server/types.ts#LaneRef, 7963f3f9, daa09fa6, 4cefdd2a, 0d2c6ede, 2da0434b, 44c2ea0b]
nicht-gemessen: kein Scratch-Server und keine Suite; ob MAX_SLOTS > 16 außerhalb der gezählten Stellen etwas bricht (dafür ist Karte P3 da); RAM nur als Momentaufnahme (10 claude-Prozesse, 11:42), keine Last über Zeit; Queue-Inhalt nur in fleet.json gelesen, nicht über die Owner-API.
stand: 2026-09-22
---

# Slot-Bänder: was nach der In-place-Nachfolge offen ist, als filbare Karten

2026-09-22, Lane `fleet/260922093956-8d7c`, Baum `c1045bf2`. Frage: **Welche Stufen S0 bis S5 der
Notiz `2026-09-18-slot-system-und-linke-leiste.md` §4 sind am Code erledigt, wie sehen die offenen
als einzeln filbare Karten aus, und was bedeutet „insgesamt 25 Sessions" für `MAX_SLOTS` und die
Lane-Deckel?** Kein Produktcode.

## 1. Die Vorgabe des Owners (wörtlich)

- 2026-09-19: „slot1A 1B und 1C".
- 2026-09-22 08:0x: „Kann es außerdem kaum erwarten wenn wir dann bald auch die slot positionen
  vernünftig für mainSessions nutzen und die lanes dann auf 1A B C usw legen. So bleibt die
  Nummereihe intakt :')".
- 2026-09-22 ~09:xx: „Wann haben wir es eigentlich soweit das sich der z.b der 14A slot dann
  nichtmehr einen slot zb. slot1 nimmt, sondern dann 14A direkt übernimmt? Dann bruachten wir vllt
  einfach nur noch ne insg obergrenze von 25sessions oder so".

Die Liste der Stufen hört dort auf, wo diese drei Sätze erfüllt sind: die Nummern 1..16 gehören den
MAINs, eine Lane heißt `nA` und nimmt keine Nummer, ein Gesamtdeckel ersetzt die feste Slot-Zahl.
Die Optik der Leiste gehört nicht dazu (Richtung 52a25990, beim Owner).

`32014c79` ist die Queue-Zeile, keine Commit-Sha. Gelandet sind unter ihr `7963f3f9` (In-place-
Nachfolge), `13d98173` (zwei Sonden), `daa09fa6` (Nachfolge-Schulden) und `4cefdd2a` (Schuld nur für
die eigene Linie); alle vier sind Vorfahren von `main` (`git merge-base --is-ancestor`).

## 2. Stand je Stufe, am Code

| Stufe (18.09.) | Stand | Beleg |
|---|---|---|
| **S0** Anker folgt der Nachfolge | **offen, und dringender als am 18.09.** | siehe 2.1 |
| **S1** Linie im Payload | **geliefert, in anderer Form** | `server.ts#successionRowView` legt `succession {session, taken, cap}` in den 2-s-Poll (nur wenn es etwas zu sagen gibt, Budget-Grund dort kommentiert); `GET /api/slots/:id/succession` liefert je Vorgänger Beginn, Übergabe, Report, ctx (`server.ts#successionLine`, `ba0c2392`); Program-MAINs lesen ihre Linie aus `Program.lineage` (`server.ts#programMainLineOf`, `7963f3f9`); Lanes aus `Slot.laneSeats` (persistiert). Rest: `openSlot` setzt `lineageId = null` weiterhin (`server.ts:6139`); keine offene Owner-Anforderung braucht es |
| **S2** neue Leiste | **geliefert** | `0d2c6ede` (Leiste in der Chat-Sprache, Lane heißt `3A`, freie Plätze nummeriert), Band zum Zurückziehen `2da0434b`, Transkript der Vorgängerin `822b7269`, `2c701b9e`. Ohne Schalter gebaut: die alte Zeichenroutine ist weg, also entfällt auch dieser Teil von S5. Offen und NICHT hier: Session-Marke, Trennstrich (Queue `bc98af80`), Zieh-Band-Tiefe (`25d9ac1e`) |
| **S3** Lane-Name als Adresse | **offen**; im Client nur ABGELEITET, und nicht stabil | siehe 2.2 |
| **S4** nummernstabile Übergabe | **geliefert, anders als geplant** | `server.ts#respawnInPlace` (`7963f3f9`): alles vor dem Kill bauen, Vorgänger als `handoff` beenden, Nachfolgerin auf DERSELBEN Nummer öffnen, Bindung sofort umhängen. Kein Abgangsplatz, kein `rename-session`, kein Überlapp. Die Lücke, die das reißt (Brief nicht zustellbar, Respawn scheitert), fängt `daa09fa6`/`4cefdd2a` als Nachfolge-Schuld; `deployBlocker` sperrt Deploys während `successionInflight`. „no free slot" ist aus allen Nachfolge-Schienen weg. Die Lane-Schiene (`server.ts#succeedLane`) war schon vorher in place |
| **S5** Werkzeuge | **offen** | `ctl.sh` kennt nur Zahlen (`ctl.sh:653` `[1-9]…`), `send` nimmt nur `--main <programId>` (`ctl.sh:1170`); `state.sh` druckt keinen Lane-Namen (0 Treffer für `band`/`anchor` als Lane-Bezug) |

### 2.1 S0: jede In-place-Nachfolge macht die Lanes ihrer MAIN zu Waisen (gemessen)

Der Anker ist `{slot, openedAt}` (`src/protocol.ts#normalizeLaneAnchor`). Er wird genau zweimal
geschrieben: bei der Lane-Öffnung (`server.ts#decideLaneAnchor`, Aufrufer `openLaneInSlot` und
`tickDispatch`-Pfad) und beim Laden (`fleet.json` → `worktree.anchor`). `server.ts#respawnInPlace`
fasst ihn nicht an. Der Server selbst liest den Anker sonst nirgends
(`rg -n 'worktree\??\.anchor|wt\.anchor' server.ts server/*.ts` → 0); sein einziger Leser ist der
Client: `src/client.ts#stacksOf` gruppiert nach exakt `${slot}:${openedAt}`,
`src/client.ts#laneBandNames` legt ankerlose Lanes auf Band 0.

Vor `7963f3f9` wechselte eine MAIN bei der Übergabe den Slot, der Anker zeigte danach auf eine
leere oder fremde Nummer. Jetzt bleibt die Nummer, aber `openedAt` ist neu, und der Anker trifft
wieder nicht. Live, `fleet.json` des Haupt-Checkouts, 11:4x:

| Lane-Slot | Anker | lebende MAIN auf dem Anker-Slot | Folge in der Leiste |
|---|---|---|---|
| 1 | `{4, 1790062976264}` | `{4, 1790062976264}` | `4A` |
| 7 | `{4, 1790062976264}` | dieselbe | `4B` |
| **2** | `{4, 1790015559216}` | `{4, 1790062976264}` | **`0A`** (Waise) |
| 3 | `{13, 1790065951828}` | `{13, 1790065951828}` | `13A` |

`audit.jsonl`: `main_succession` Slot 4 „program f170dc46… respawned in place (predecessor openedAt
1790015559216 → 1790062976264)". Die Lane in Slot 2 ist vor dieser Übergabe gestartet, die in 1 und
7 danach. `grep -ac 'respawned in place' audit.jsonl` = 3 seit dem Deploy; jede davon verwaist alle
Lanes ihrer MAIN. Das trifft die Owner-Vorgabe direkt: eine Lane der Program-MAIN Fleet-Betrieb
(Band 4, Program `f170dc46`) heißt in der Leiste `0A`, nicht `4A`.

### 2.2 S3: der Name `4A` ist heute eine Position, keine Identität

`src/client.ts#laneBandNames` sortiert die Lanes eines Bands nach Slot-Nummer und vergibt den
Buchstaben nach Rang. Landet `4A`, heißt die bisherige `4B` beim nächsten Poll `4A`. Der Name
taugt damit für die Leiste, aber nicht für „schau auf 4A" im Gespräch, nicht für eine Route und
nicht für `ctl.sh`. Der Server kennt keinen Lane-Namen (0 Treffer für `bandName`/`laneLetter` in
`server.ts`). Jede Stufe, die `4A` als Adresse nimmt, braucht zuerst einen FEST vergebenen,
persistierten Buchstaben.

## 3. Was heute die Zahl 16 trägt (für den Gesamtdeckel)

`rg -n 'MAX_SLOTS' server.ts server/*.ts src/*.ts e2e/*.ts` und `rg -n 'slots\[' …`, Baum `c1045bf2`:

| Stelle | Rolle von 16 | bei „Lanes nehmen keine Nummer" |
|---|---|---|
| `server.ts:2004` `slots = Array.from({ length: MAX_SLOTS })` | **der einzige wirksame Maschinendeckel**: 16 Plätze für MAINs UND Lanes zusammen | wird zu Bändern (MAINs) + Lane-Plätzen; der Deckel wird eine Zählung |
| sieben Vergabestellen `slots.find/filter((x) => !x.cwd && !laneSpawn.has(x.id))` in `startVariantGroup`, `tickDispatch`, `bootstrapSupervisor`, `bootstrapProgramMainReserved`, `POST /api/lanes`, `POST /api/wave/dispatch` (2×) | nehmen den ERSTEN freien Platz; sechs antworten „no free slot" bzw. warten | Lane-Stellen suchen nur im Lane-Bereich, MAIN-Stellen nur in 1..16; alle prüfen zusätzlich den Gesamtdeckel. Am 18.09. waren es zehn; die drei Nachfolge-Stellen hat `7963f3f9` entfernt |
| `server.ts#slotFrom` (`id > MAX_SLOTS` → null), 103 Aufrufer | Routen-Adresse | muss `4A` auflösen können (S3c) |
| `server/types.ts` acht Lader-Prüfungen `slot … 1..MAX_SLOTS` (Zeilen 2256, 2347, 2503, 2672, 2808, 2826, 2944, 3022) | persistierte Records mit Slot-Nummer | Obergrenze muss die Lane-Plätze einschließen, sonst verwirft der Lader Records über Lanes |
| `slots[n - 1]` direkt: `decideLaneAnchor` (4780), Share-Routen (36112, 36227), WebSocket (39198, 39286, 39295) | Index = Nummer | bleiben richtig, solange die interne Id eine Zahl bleibt |
| `REPO_MAX_LANES_MAX = MAX_SLOTS` (`server.ts:2069`, gepinnt `e2e/pins.ts:2976`) | Obergrenze des Repo-Lane-Deckels | wird der Gesamtdeckel |
| Kommentar-Rechnung `PROGRAM_MAX_RELEASED` / `PROGRAM_MAX_PENDING` (16 × 5 = 80, 16 × 15 = 240) | „höchstens 16 Programs gleichzeitig" | bleibt wahr, solange MAINs höchstens 16 Bänder haben |
| tmux `server.ts#sess` → `s<id>`, Boot-Adoption `/^s(\d+)$/` (`server.ts:32352`, `:6540`) | Pane-Name | bei numerischer interner Id unberührt; bei `s4A` sieht ein älterer Server die Pane nicht (kein Match, keine Adoption, kein Kill) |
| `FLEET_SELF_SLOT='${occupant.slot}'` (`server.ts:5925`) | Pane-Env | bei numerischer interner Id unberührt |
| Client: `src/client.ts#renderSlots` zeichnet jede Zeile aus `/api/slots`, leere als `emptyRow` | 16 Zeilen | Lane-Plätze dürfen nicht als freie Bänder erscheinen |
| `e2e/slots.ts:20` „exposes all 16 fixed slots in order" | Pin | wird Bänder + Lane-Bereich |
| Typen: `slot: number` 152 Deklarationen (types 42, server 47, client 56, lane-signals 5, protocol 2) | Nummer als Typ | bei `number \| string` alle zu prüfen; bei numerischer interner Id keine |

Die Lane-Deckel und was ein Gesamtdeckel davon ersetzt:

| Deckel | live | wovor er schützt | nach dem Umbau |
|---|---|---|---|
| `FLEET_DISPATCH_MAX_LANES` | 1 (`watchdog.sh`), pro Repo überschrieben durch `repoLaneCaps`: claude-fleet 7, private-repo-aa 2 (`fleet.json`) | Warteschlange vor dem Suite-Mutex eines Repos, nicht RAM (Kommentar über `repoLaneCaps`) | **bleibt** |
| `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` | ungesetzt → inert | Lanes je Program | **bleibt** |
| `FLEET_PROGRAM_MAX_RELEASED` (5) | Default | Queue-Tiefe je MAIN, zählt Zeilen, keine Sessions | **bleibt**, unberührt |
| `REPO_MAX_LANES_MAX` | = 16 | Obergrenze für einen Repo-Deckel | **wird** der Gesamtdeckel |
| volle Slot-Tafel („no free slot") | 16 | Maschinenlast, heute der einzige Gesamtdeckel | **wird ersetzt** durch `FLEET_MAX_SESSIONS` |

### 3.1 Antwort auf „insgesamt 25 Sessions"

Der Mechanismus stimmt: einen Gesamtdeckel gibt es heute schon, nur ist er die Länge des Arrays,
und deshalb nimmt eine Lane eine Nummer. Trennt man Nummer und Deckel, bleibt die Reihe 1..16 den
MAINs, und der Deckel zählt alle Sessions. Das ist genau „14A übernimmt direkt".

Die Zahl 25 ist ein RAM-Entscheid. Gemessen 2026-09-22 11:42 (`ps -eo rss=,comm=`, nur
Programmnamen): 10 `claude`-Prozesse = 1 846 MiB RSS, im Mittel 185 MiB; Swap 1 743 von 3 072 MiB
belegt; Mac mit 8 GiB (`hw.memsize`). Belegt waren 12 Plätze (8 MAINs, 4 Lanes, 0 schlafend). Die
Notiz vom 13.09. (`2026-09-14-ram-slots-sessions-astra.md`) maß 7 Slot-Prozesse mit 1 359 MiB, also
~194 MiB je Session. Abgeleitet, nicht gemessen: 25 wache claude-Sessions ≈ 4,6 GiB RSS allein für
die Agenten, auf einer Maschine, die bei 12 schon 1,7 GiB auslagert. Schlafende Sessions (💤,
`44c2ea0b`) halten keinen Prozess, aber Lanes und Program-MAINs dürfen nicht schlafen
(`SleepRefusal` `"lane"`, `"program-main"`).

Empfehlung für den Schnitt: `FLEET_MAX_SESSIONS` zählt alle belegten Plätze (so wie der Owner es
sagt), Default **16**, damit der Umbau ohne Verhaltensänderung landet; 25 setzt der Owner per `.env`,
wenn er es will. Ob der Deckel schlafende Sessions mitzählt, ist eine Owner-Frage und steht in der
Karte S3b als benannte Annahme (mitzählen).

## 4. Die offenen Stufen als Karten

Reihenfolge-Zwänge: **S0 zuerst** (repariert einen Live-Defekt und ist unabhängig). **S3a vor S3c
und S5** (eine Adresse braucht einen festen Namen). **P3 vor S3b** (die Probe entscheidet, ob S3b
eine numerische interne Id nimmt). S3a und S3b sind unabhängig voneinander; S3b und S3c berühren
beide `server.ts#slotFrom` und dürfen nicht parallel laufen. S0 und S3a berühren beide den Anker
bzw. `LaneRef`: S3a nach S0 landen, damit das Umhängen den Buchstaben mitnimmt.

Die Probe P3 klärt, was die Notiz vom 18.09. „erschlossen, nicht erprobt" nannte. Zwei Wege liegen
auf dem Tisch: (a) die interne Id bleibt eine Zahl, Lanes wohnen auf Plätzen oberhalb der 16
Bänder, `4A` ist ein persistierter Name, den `slotFrom` zusätzlich auflöst; (b) `Slot.id` wird
`number | string` wie am 18.09. entworfen (152 Typ-Deklarationen, tmux `s4A`, `FLEET_SELF_SLOT=4A`).
(a) lässt tmux-Namen, Pane-Env, WebSocket- und Share-Pfade unverändert; der Owner sieht die interne
Zahl nicht, eine Pane-Env schon. Welche Stellen außer den gezählten an 16 hängen, zeigt erst ein
Lauf.

### Karte S0

```
[SLOT-SYSTEM · S0 · DER LANE-ANKER FOLGT DER IN-PLACE-NACHFOLGE · Notiz 2026-09-22-slot-baender-stufen-nach-32014c79 §2.1]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#respawnInPlace/#decideLaneAnchor, e2e/self-token.ts, e2e/programs.ts, e2e/supervisor.ts
NACH: 32014c79
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: Nach jeder erfolgreichen In-place-Nachfolge (generisch, Supervisor, Program-MAIN) trägt jede Lane, deren worktree.anchor den Vorgänger {slot, openedAt} nannte, den Anker {slot, openedAt der Nachfolgerin}, eine Lane mit anderem Anker bleibt byte-gleich, beim Laden wird ein Anker, der einen Vorgänger derselben Linie (Program.lineage bzw. lineageHandovers) auf demselben Slot nennt, auf den lebenden Occupant umgehängt und als audit-Zeile gemeldet, und je eine Sonde in e2e/self-token.ts und e2e/programs.ts war vor dem Fix rot und ist danach grün; install, pins, tsc, build grün, e2e-isolated ALL PASS.
VERBOTEN: Anker umhängen, wenn der Respawn scheitert (respawnLost) · src/client.ts#stacksOf ändern · einen Anker ohne Beleg aus der Linie umhängen (nur Slot-Gleichheit reicht nicht) · Lane-Buchstaben einführen (Karte S3a)

Grund für Opus: die Nachfolge-Schiene ist am 2026-09-22 neu gebaut (7963f3f9, daa09fa6, 4cefdd2a), und ihr Timing (Bindung nach dem Open, vor der Zustellung) ist die Stelle, an der das Umhängen stehen muss.
Live-Befund: die Lane in Slot 2 trägt anchor {4, 1790015559216}, Slot 4 hält seit der In-place-Nachfolge (audit main_succession, 1790062976807) openedAt 1790062976264; die Leiste zeigt sie als 0A statt 4A. Die Lade-Heilung soll genau diesen Fall reparieren.
```

### Karte P3 (Probe vor S3b)

```
[SLOT-SYSTEM · PROBE P3 · WAS HAENGT AN 16 AUSSER MAX_SLOTS · Messnotiz, kein Produktcode]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: klein
FLAECHE: docs/messungen/INDEX.md
NEU: docs/messungen/2026-09-22-max-slots-probe.md
VERIFY: install, pins
DONE: Die Messnotiz liegt committet mit INDEX-Zeile und nennt für eine Scratch-Kopie mit MAX_SLOTS = 25 (einzige Änderung, nicht committet) die roten Checks aus FLEET_E2E_MODULES=slots,lanes-basic,lanes-lifecycle,restart je mit Ursache (datei#symbol), das Ladeverhalten des unveränderten main-Builds gegen eine fleet.json mit belegtem Slot 17 (verworfen, gewarnt oder übernommen, dazu was mit der tmux-Session s17 passiert), und eine Empfehlung zwischen interner Zahl-Id (Lane-Plätze oberhalb der Bänder) und Slot.id number|string mit der Zahl der Stellen, die jede Variante ändern muss.
VERBOTEN: Produktcode committen · bun server.ts mit Default-Env · die Scratch-Instanz auf Socket claudefleet oder Port 8790 · eine Entscheidung über den Deckelwert (Owner)

Methode-Hinweis: Scratch-Instanz nach dem Muster in e2e-isolated.sh (eigener FLEET_SOCK, FLEET_PORT 88NN, FLEET_CMD=true), aufräumen per tmux -L <scratch-socket> kill-server. Die Suite-Module über Suite-Offer oder FLEET_E2E_MODULES auf der Scratch-Kopie.
```

### Karte S3a

```
[SLOT-SYSTEM · S3a · DER LANE-BUCHSTABE WIRD FEST VERGEBEN · Notiz 2026-09-22-slot-baender-stufen-nach-32014c79 §2.2]
ROLLE: pi-zai/glm-5.3-flash/high
GROESSE: mittel
FLAECHE: server.ts#openLaneInSlot/#decideLaneAnchor, server/types.ts#LaneRef, src/client.ts#laneBandNames, e2e/slots.ts
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: Eine Lane bekommt beim Öffnen den kleinsten in ihrem Band freien Buchstaben als persistiertes Feld in worktree (LaneRef), er überlebt srv-Neustart und das Landen einer Nachbar-Lane im selben Band (Sonde: 4A und 4B öffnen, 4A landen, die verbliebene Lane heißt weiter 4B, eine neue Lane bekommt 4A), src/client.ts#laneBandNames nimmt den gespeicherten Buchstaben und leitet nur für Lanes ohne Feld ab, und ein älterer Lader ignoriert das Feld ohne Fehler; install, pins, tsc, build grün, e2e-isolated ALL PASS.
VERBOTEN: Lanes aus der Nummernreihe nehmen (Karte S3b) · Routen oder ctl.sh auf 4A umstellen (S3c, S5) · Leisten-Optik ändern

VORBEDINGUNG: Karte S0 ist gelandet (ihre Queue-Id als NACH eintragen). Das Umhängen des Ankers muss den Buchstaben mitnehmen.
```

### Karte S3b

```
[SLOT-SYSTEM · S3b · LANES NEHMEN KEINE NUMMER MEHR · GESAMTDECKEL FLEET_MAX_SESSIONS STATT FESTER SLOT-ZAHL]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: gross
FLAECHE: server/types.ts#MAX_SLOTS, server.ts#slotFrom/#tickDispatch/#startVariantGroup/#bootstrapSupervisor/#bootstrapProgramMainReserved/#openLaneInSlot/#repoLaneCap, src/client.ts#renderSlots, e2e/slots.ts, e2e/lanes-basic.ts, e2e/pins.ts
VERIFY: install, pins, tsc, build, clean-review, e2e-isolated
DONE: Hinter einem Schalter (Default aus) öffnen POST /api/lanes, POST /api/wave/dispatch, startVariantGroup und tickDispatch Lanes nur außerhalb der Bänder 1..16 und MAINs nur in 1..16, alle Vergabestellen verweigern mit einer benannten Meldung, sobald FLEET_MAX_SESSIONS (Default 16, zählt jeden belegten Platz einschließlich schlafender) erreicht ist, REPO_MAX_LANES_MAX folgt FLEET_MAX_SESSIONS, die Leiste zeigt Lane-Plätze nie als freie Bänder, und Sonden zeigen: 16 MAINs + 0 Lanes und 1 MAIN + 15 Lanes halten beide den Deckel 16, mit Deckel 25 öffnet die 17. Session eine Lane ohne Nummer aus 1..16, und ein srv-Neustart adoptiert alle Lanes auf ihren Plätzen; Schalter aus = heutiges Verhalten byte-gleich in /api/slots; install, pins, tsc, build, clean-review grün, e2e-isolated ALL PASS.
VERBOTEN: den Deckelwert 25 als Default setzen (Owner-Entscheid per .env) · FLEET_DISPATCH_MAX_LANES, repoLaneCaps oder FLEET_PROGRAM_MAX_RELEASED ändern · Routen auf 4A umstellen (S3c) · laufende Lanes umziehen (gilt nur für neu geöffnete)

Die Form der internen Id (Zahl oberhalb der Bänder oder number|string) übernimmt diese Karte aus der Notiz der Probe P3. Annahme, die der Owner kippen kann: der Deckel zählt schlafende Sessions mit.
VORBEDINGUNG: die Messnotiz der Probe P3 ist gelandet (Queue-Id als NACH eintragen); nicht parallel zu S3c (beide an server.ts#slotFrom).
```

### Karte S3c

```
[SLOT-SYSTEM · S3c · 4A IST EINE ADRESSE DER OWNER-ROUTEN]
ROLLE: claude/claude-opus-5[1m]/high
GROESSE: mittel
FLAECHE: server.ts#slotFrom, e2e/slots.ts, e2e/lanes-basic.ts
VERIFY: install, pins, tsc, build, e2e-isolated
DONE: server.ts#slotFrom löst neben einer Zahl einen Lane-Namen wie 4A über den persistierten Buchstaben auf die Lane auf, /api/slots/4A/… trifft die Lane und nie Band 4, ein freier oder nie vergebener Name antwortet 404 mit dem Namen im Text, ein wiedervergebener Buchstabe mit altem openedAt-Pin antwortet 409, GET /api/sessions trägt je Lane ihren Namen; install, pins, tsc, build grün, e2e-isolated ALL PASS.
VERBOTEN: Slot.id-Typ ändern · tmux-Namen oder FLEET_SELF_SLOT ändern · ctl.sh/state.sh anfassen (S5)

VORBEDINGUNG: S3a und S3b sind gelandet (beide Queue-Ids als NACH eintragen).
```

### Karte S5

```
[SLOT-SYSTEM · S5 · ctl.sh UND state.sh SPRECHEN 4A]
ROLLE: pi-zai/glm-5.3-flash/high
GROESSE: klein
FLAECHE: ctl.sh, state.sh, e2e/ctl.ts
VERIFY: install, pins, e2e-isolated
DONE: state.sh druckt je Lane ihren Namen (4A) neben der Slot-Zeile, ctl.sh nimmt überall, wo es eine Slot-Nummer nimmt, auch einen Lane-Namen und scheitert an einem freien Namen mit diesem Namen in der Meldung, und e2e/ctl.ts belegt beides; install und pins grün, e2e-isolated ALL PASS.
VERBOTEN: ctl.sh send für Nummern öffnen (send bleibt --main <programId>) · grep in state.sh auf rg umstellen

VORBEDINGUNG: S3c ist gelandet (Queue-Id als NACH eintragen).
```

## Methode

```
git log --format='=== %h %ad %s%n%b' --date=short 7963f3f9^..4cefdd2a
for s in 7963f3f9 13d98173 daa09fa6 4cefdd2a; do git merge-base --is-ancestor $s main && echo $s; done
git log --since=2026-09-18 --format='%h %ad %s' --date=short main | grep -iE 'anchor|lineage|leiste|band|succession|slot'
rg -n 'decideLaneAnchor|LaneAnchor|\.anchor\b' server.ts src/client.ts src/protocol.ts server/*.ts
rg -n 'worktree\??\.anchor|wt\.anchor' server.ts server/*.ts                   # 0: nur der Client liest ihn
rg -n 'MAX_SLOTS' server.ts server/*.ts src/*.ts e2e/*.ts; rg -n 'slots\[' server.ts
rg -n 'slots\.(find|filter)\(\((x|s)\) => !(x|s)\.cwd' server.ts                # sieben Vergabestellen
rg -c 'slot: number|Slot: number|slot\?: number' server/types.ts server.ts src/protocol.ts src/client.ts lane-signals.ts
python3: fleet.json slots → je Lane anchor gegen lebende MAINs {id, openedAt}     # Tabelle 2.1
grep -a main_succession audit.jsonl | grep -a 'respawned in place'                # 3 Treffer
ps -eo rss=,comm= | awk '$2 ~ /claude$/'; sysctl -n vm.swapusage hw.memsize       # 3.1
```

## Was nicht gemessen wurde

Kein Scratch-Server, keine Suite: ob `MAX_SLOTS` > 16 an ungezählten Stellen bricht, misst erst
Karte P3. Die Lade-Heilung in S0 ist aus den vorhandenen Linien-Daten erschlossen (Program-Lineage
nennt `slot`+`openedAt` je Eintrag, `lineageHandovers` `from`/`to`), nicht an einer Instanz erprobt.
Der RAM-Wert ist eine Momentaufnahme; Spitzen, Suiten-Last und Codex-Anteile über Zeit sind nicht
gemessen. Die Queue ist nur als `fleet.json` gelesen (200 Zeilen, Suche nach Band-/Anker-Begriffen);
eine inhaltlich passende Zeile ohne diese Begriffe kann fehlen. Die Karten sind nicht durch
`card-extract.ts#validateCard` mit Symbolindex gelaufen, nur durch `parseFormattedCard` (siehe
Report); die Symbole sind per `rg` im Baum `c1045bf2` aufgelöst.

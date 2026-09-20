---
frage: Wie wird die linke Leiste neu gebaut und wie weit muss dafür das Slot-System weichen?
urteil: Die Slot-Nummer bleibt die eine Nummernwelt und wird zur Bandnummer: eine Session behält sie über jede Übergabe, Lanes heißen nach ihrem Band (3A, 16B), belegen keine Nummer mehr und hängen als kleine Kästen am Band ihrer Herkunft. Sechs Stufen S0 bis S5; S0 (der Lane-Anker folgt der Nachfolge) repariert einen heute live gemessenen Defekt, die neue Leiste (S2) kommt vor den zwei riskanten Serverteilen (S3 Lane-Name als Adresse, S4 nummernstabile Übergabe).
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
  `worktree.anchor`). Er heißt nach seinem Band: `3A`, `3B`, an Band 16 `16A` (Owner 2026-09-19:
  „slot1A 1B und 1C"). Das ist sein EINZIGER Name: Leiste, Gespräch, `state.sh`, tmux-Session `s3A`,
  Route `/api/slots/3A/…`, `FLEET_SELF_SLOT=3A`. Eine Lane belegt damit keinen der nummerierten
  Plätze mehr; der RAM-Deckel wird eine Zählung (Sessions + Lanes ≤ 16). Ein frei gewordener
  Buchstabe wird wieder vergeben, geschützt durch den vorhandenen `openedAt`-Pin. Hintergrund-Lanes
  des Ticks hängen am Band der MAIN ihres Programs. Offen: Lanes ohne Band (Vorschlag: Sammelband
  `0`, also `0A`).
- **Repo**: kein Strukturelement. Farbton am Kastenrand (der bestehende `tintProject`) plus Name in
  Zeile zwei. Die Leiste wächst mit der Zahl der Sessions, nie mit der Zahl der Repos.

### 3.2 Was die Leiste zeigt (jedes Element mit seinem Satz aus §1)

| Owner | Element |
|---|---|
| „auf einer Art Band laufen … ausgrauen und erscheinen eines neuen session-kastens rechts davon" | Jedes Band ist ein waagrechter Streifen. In der 228-px-Leiste steht er so, dass der lebende Kasten ganz zu sehen ist und der ausgegraute Vorgänger links 20 px hervorschaut; ein Klick darauf fährt das Band zurück. Schalter „breit" (660 px) zeigt die ganzen Bänder mit bis zu drei Vorgängern als Kästen |
| „animationen und effekte" | Übergabe: der lebende Kasten ergraut an Ort und Stelle, der neue fährt in 0,55 s von rechts aufs Band, ein Lichtrand klingt 1,1 s aus; die Lane-Kästen ziehen mit |
| Lanes „eigene kleinere kästen", Hintergrund-Lanes, „auch lanes [können] successions machen" | Kleine, eingerückte Kästen unter dem lebenden Kasten (halbe Höhe), mit Zustand, Name (`3A`), Label, Füllstand-Haarlinie. Eine Lane-Übergabe zeichnet dieselbe Grammatik klein: grauer Mini-Kasten, neuer rechts davon. Der Server kennt dafür heute nur die Anzahl (`laneSuccessions`) |
| „irgendwo hinklicken … session starten", „selber … nach oben oder unten packen" | Freie Plätze bleiben als nummerierte, stille Zeilen stehen (bis zum höchsten belegten plus eins); Klick startet dort. Die Wahl der Nummer IST das Ordnen, wie heute (`emptyRow → openPicker`) |
| „alles genauso weiter …, aber wesentlich übersichtlicher und vollständiger" | Zeile eins: Zustand (Form UND Farbe: arbeitet, wartet auf dich, fertig, rot, ruht), Label, Rolle, Kontext-%. Zeile zwei: Repo, Modell, zuletzt aktiv. Bodenlinie: Füllstand, amber ab 25 % nur für claude-Sessions. Effort und git im Tooltip |
| „voll gefärbte stylische boxen …, high quality mit leichtem metallik look" (2026-09-19) | Kästen vollflächig in der Repo-Farbe (der echte `src/client.ts#projectHue`), darüber Glanzkante, feine Bürstung, dunkler Fuß; ein Lichtstreif beim Zeigen. Vorgänger werden Stahl (grau, gedämpft), Auswahl ist ein heller Rand mit Schein. Lanes: dasselbe Metall, kleiner und gedeckter |
| „Ram … nicht anzeigen", „absolut minimalistisch" | Kein RAM, kein Kopfsatz, keine Gruppenüberschriften, keine gezeichneten Bänder |

Eingeklappt (50 px): Nummer, Zustand, ein Zustandspunkt je Lane. Handy: die Leiste ist das Blatt,
Zeilen in Daumenhöhe, das Band wischt waagrecht. „20+ Sessions" gibt es nicht: `MAX_SLOTS` ist 16;
das Mockup zeigt 11 Sessions plus 5 Lanes.

### 3.2a Fassung 3: dieselbe Leiste, neu verpackt (`docs/design/sidebar/v3.html`)

Owner 2026-09-19 zu Fassung 2: Ideen „ganz gut", aber „noch weit entfernt davon wie eine
hochqualitative moderne UI auszusehen", Messlatte „AA Indie studio level UI". Fassung 2 bleibt als
`index.html` unverändert stehen; das Modell aus §3.1/§3.2 ist in Fassung 3 unberührt. Befunde am
2x-Bild von Fassung 2 und was Fassung 3 dagegen setzt:

| Befund an Fassung 2 | Fassung 3 |
|---|---|
| `hsl(45 48% 38%)` ist Khaki, nicht Gold; 8 von 11 Kästen tragen es; HSL wiegt jede Farbe anders | Farben in OKLCH mit fester Helligkeit und Buntheit je Zustand; derselbe `projectHue`-Ton, auf den OKLCH-Winkel umgerechnet |
| Glanz oben, dunkler Fuß, farbiger 1-px-Rand: liest sich als Plastik-Button | eloxiertes Aluminium: flacher Verlauf, richtungsloses Korn (SVG-Turbulenz per `overlay`), gefräste Fase aus heller Ober- und dunkler Unterkante, kein farbiger Rand |
| eine seit 12 h ruhende Session ist so laut wie eine arbeitende; der Zustand ist ein 9-px-Punkt, auf `private-repo-r` grün auf grün | wer ruht, ist tiefer eloxiert (L .40 statt .50); der Zustand sitzt auf einem immer dunklen Schild und ist auf jedem Repo-Ton lesbar |
| blaue Nummernspalte neben den Kästen konkurriert mit dem Inhalt | die Adresse ist ins Metall gestanzt: dunkles Schild links im Kasten mit Nummer (`3`) bzw. Lane-Name (`3A`); eingeklappt bleibt genau dieses Schild stehen |
| eine Monospace für alles, bei 10 px so breit, dass „claude-…" und „Land-Pipe…" abschneiden | DIN Alternate für alles, was Adresse oder Zahl ist, Avenir Next (Condensed) für Wörter; beide auf macOS und iOS vorhanden, nichts wird nachgeladen |
| Füllstand als 2-px-Haarlinie am Kastenboden | eingelassene Nut mit einem Strich bei 25 %, der Übergabe-Schwelle des Owners (nur claude-Sessions) |
| Lichtstreif auf jedem Hover, Schein auf jeder Auswahl | ein inszenierter Moment: bei der Übergabe läuft der alte Kasten zu Stahl an, der neue fährt ein, einmal zieht Licht über das frische Metall. Auswahl ist ein weißer Ring mit Luft |
| drei verschiedene Einzüge für Lanes, leerer grauer Stummel | Lanes hängen per Winkel-Linie am Kasten; Vorgänger sind Stahl mit derselben Fase; freie Plätze sind leere Fassungen mit der Nummer an derselben Stelle |

Offen für S2: die Schriftwahl gilt hier nur für die Leiste, der Rest der App ist Monospace; und die
Abstufung ruhend/aktiv über die Helligkeit ist mein Vorschlag, kein Owner-Satz.

### 3.2b Fassung 4: gebürsteter Edelstahl (`docs/design/sidebar/v4.html`)

Owner 2026-09-19 zu Fassung 3: „insgesamt besser", aber „eher leicht eloxiertes und gebürstetes
edelstahl mit verlauf, textur und vllt auch shader", ein „professionellen AA Indie Industrial
Designer look". Fassung 4 = Fassung 3 mit anderem Material; Struktur und Modell unverändert.

- **Stahl statt Farbe:** Grundton OKLCH L .60 / Buntheit .03 (Fassung 3: .50 / .105); die Repo-Farbe
  ist nur noch ein Hauch Eloxal. Ruhende Sessions L .52, Vorgänger blanker, stumpfer Stahl (grau, .62).
- **Bürstung aus einem Shader:** ein WebGL-Fragment-Shader rechnet beim Laden einmal eine
  1024×256-Textur (je Zeile eigene lang gezogene Schwankungen, Zeilenrauschen, feines Korn, Grau um
  .5) und legt sie als `--brush` per `overlay` über den Grundton; jede Platte bekommt einen eigenen
  Ausschnitt. Rückfall ohne WebGL: gestreckte SVG-Turbulenz (`baseFrequency 0.004 0.9`).
- **Licht:** eine Lampe für alle Platten (`background-attachment: fixed`), die dem Zeiger folgt; der
  Glanz ist ein senkrechter Streif, weil gebürsteter Stahl quer zur Bürstrichtung streut. Dazu ein
  senkrechter Lichtabfall und eine gefräste Fase.
- **Gravur und LED:** die Adresse (`3`, `3A`) ist eingraviert (dunkel mit heller Unterkante); der
  Zustand ist eine versenkte LED in dunkler Fassung, ruhend = aus. Form und Farbe je Zustand bleiben.

Geprüft: Headless-Chrome meldet `data-brush="shader"`, der Shader läuft also dort; Bilder bei 2x und
4x (Detail), volle Belegung, Übergabe breit, eingeklappt, Handy. Nicht geprüft: das Zeigerlicht in
Bewegung, Safari auf iOS (dort ignoriert Safari `background-attachment: fixed`; das Licht steht dann
still, die Platte bleibt korrekt).

### 3.2c Fassung 5: die Sprache der App statt eines erfundenen Materials (`docs/design/sidebar/v5.html`)

Owner 2026-09-19/20 zu Fassung 4 (Edelstahl): „ansich schon nicht schlecht", aber „ich denke nicht
dass es so zu unserem restlichen Layout passt … sehr minimalistisch übersichtlich und AA
Indie-professional like". Der Fehler der Fassungen 3 und 4 war derselbe: beide erfanden ein Material
UND ein Schriftsystem (Eloxal/Stahl, DIN/Avenir), statt die Sprache zu benutzen, die die App spricht.
Fassung 5 baut die Leiste aus den Bauteilen, die in `public/index.html` schon stehen:

| Element | Herkunft in der laufenden App |
|---|---|
| Token (`--text`, `--dim`, `--faint`, `--accent`, `--focus`, `--amber`, `--danger`, `--proj-s/l`) | `public/index.html:328-333` |
| Schrift `ui-monospace, Menlo, Consolas`, Zeile 12 px, Nebenzeile 10.5 px | `public/index.html:18`, `.slot` 124-126, `.stackn` 344 |
| Kasten = die Slot-Zeile: Radius 8, 1px Rahmen, Hover `#242424`, gewählt `#26314f` + `--focus` | `public/index.html:124-129` |
| Repo-Farbe als 3-px-Kante links (Session) bzw. 2 px (Lane), nie als Fläche | `.slot.proj` 334-335, `.slot.lane` 294 |
| Lane-Name `3A` als Chip im Repo-Ton auf 16 % | `.stackn` 344-346 |
| Lanes 10 px eingerückt unter ihrem Kasten | `.slot.stacked` 349 |
| Zustand als 7-px-Punkt (grün `#3fb950` = arbeitet) | `.slot .act` / `.act.hot` 134-135 |
| Bandnummer in 16-px-Spalte, `--accent`, frei = `#555` | `.slot .n` 130-133 |
| Leiste 228 px / eingeklappt 50 px, `#1a1a1a`, `--line-soft` rechts | `public/index.html:73-74, 146-152` |
| kein Übergang bei Hover/Auswahl (die App hat keinen) | Bericht §7: in `.slot` kein `transition` |

Eigene Zutaten (mein Geschmack, kein Owner-Satz): die zweite Zeile mit Repo, Modell und Ruhezeit in
`--faint`; die 2-px-Füllstandsnut an der Unterkante mit dem Strich bei 25 %; die Rolle (`main`) als
Chip. Die Übergabe bleibt die EINZIGE Bewegung: der Vorgänger wird still (Opazität .62, graue Kante),
der neue fährt in 0,5 s von rechts ein und blitzt einmal in `--accent` auf — derselbe Ring, den die
App für `paneflash` benutzt (`public/index.html:177`).

Geprüft an 2x-Bildern: volle Belegung, Übergabe schmal und breit, eingeklappt, Handy, dazu
`public/index.html` selbst headless gerendert als Vergleich derselben Schrift und Flächen. Zwei
Fehler dabei gefunden und behoben: `--tint` auf `:root` rechnet mit dem dort fehlenden `--h` und
färbte alle Chips rot (die hsl()-Formel steht jetzt in jeder Regel, wie in der App auch); und in der
breiten Ansicht stand das Band am rechten Ende, sodass der älteste Vorgänger abgeschnitten war.

### 3.2d Der eigentliche Befund: die App hat ZWEI Sprachen, und die Leiste folgte der alten

Owner 2026-09-20 zu Fassung 5: „in gewisser hinsicht gar nicht so schlecht, aber vom Design
immernoch ziemlich weit weg von dort wo es sein sollte" — dazu ein Screenshot seiner Chat-Ansicht.
Der Screenshot löst auf, woran die Fassungen 3 bis 5 scheiterten:

**`public/index.html` trägt zwei Gestaltungssprachen nebeneinander.** Die ALTE (Leiste, Slot-Zeilen,
Board) ist Monospace auf `#1a1a1a`, 12 px, dicht, Radius 7–8. Die NEUE ist die Chat-Ansicht mit
eigenem Token-Block (`public/index.html:193-198` auf `main`): `--chat-sans` (ui-sans-serif/Inter),
`--chat-fs: 14px`, `--chat-ink #e7e7ea`, `--chat-prose #d4d4d8`, `--chat-mute #8b8b94`,
`--chat-faint #5c5c66`, `--chat-surface #111113`, `--chat-raised #17171a`, `--chat-edge #26262b`,
Radius 10–18, Code als Mono-Chip auf `--chat-raised` mit 1-px-Kante (`.mdcode`), dazu die driftenden
Flocken (`.chatflakes`, Kommentar dort: „modern like other GUI coding agents"). Die Queue-Ansicht
ist dieser Sprache schon gefolgt (`f5ed3188`: „the queue reads the chat view's :root block").

Fassung 5 war also nicht schlecht gebaut, sondern an der falschen Hälfte gemessen: sie hat die ALTE
Sprache perfekt getroffen. **Fassung 6 (`docs/design/sidebar/v6.html`) nimmt den `--chat-*`-Block
wörtlich** und baut die Leiste daraus:

- Fläche schwarz mit ruhigen Flocken; keine Zeilenkästen mehr, nur Luft.
- Die Bandnummer ist ein Mono-Chip in der Zeile — derselbe Chip, mit dem die Chat-Ansicht Code und
  IDs setzt (`.mdcode`: mono, `--chat-raised`, 1-px-Kante, Radius 5). Die Adresse ist damit dasselbe
  Objekt wie eine ID im Text, passend zu „hoverbare IDs" aus dem Chat-Feedback vom 18.09.
- Ein Lane-Name (`3A`) ist derselbe Chip, eine Stufe kleiner; die Repo-Farbe lebt nur noch als
  leichte Tönung IM Chip (Buntheit 30–45 %), sonst ist die Leiste monochrom.
- Label in `--chat-fs`/Sans, Nebenzeile und Chips in `--chat-ui-fs`; gewählte Zeile `--chat-raised`
  mit `--chat-edge`-Kante, Hover fast unsichtbar.
- Der Füllstand ist nur noch eine Zahl (amber ab 25 %); die Haarlinie erscheint nur an der gewählten
  Zeile. Die Übergabe bleibt die einzige Bewegung.

Vergleichsblatt `docs/design/sidebar/richtungen.html`: dieselben Daten in vier Sprachen (A Regal =
Fassung 5, B Schwarzplan, C Karten, D Konsole) — gebaut, BEVOR der Screenshot kam, und damit
überholt; es bleibt nur als Beleg, wie weit die Sprachen auseinanderliegen.

**Folge für den Stufenplan:** S2 baut die Leiste in der Chat-Sprache, nicht in der alten. Damit ist
S2 kein reiner Leisten-Umbau mehr, sondern der Punkt, an dem auch die Leiste auf den `--chat-*`-Block
umzieht — so wie die Queue es in `f5ed3188` schon getan hat.

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
die Leiste (S2) braucht S3 und S4 nicht: bis dahin zeichnet sie das Band an der Nummer der
Nachfolgerin und zeigt `3A` als abgeleiteten Namen einer Lane, die intern noch einen Platz belegt.

| Stufe | Inhalt | Beweis | neue Sonde | Scratch-Live-Test vor dem Land | Rückfalltür |
|---|---|---|---|---|---|
| **S0** Anker folgt der Nachfolge | Bei MAIN-, Supervisor- und generischer Nachfolge hängen alle Lanes mit `anchor == Vorgänger-Occupant` auf die Nachfolgerin um | `e2e/slots.ts` (44 anchor-Treffer), `e2e/programs.ts`, `e2e/supervisor.ts`, `./e2e-claude-gate.sh` | Lane öffnen, MAIN übergibt, Anker zeigt auf die Nachfolgerin; fremde Lane bleibt unberührt | Instanz `FLEET_CMD=true`, eigener Socket: Lane, succeed, `GET /api/sessions` | Revert, Anker bleiben gültige Occupants |
| **S1** Linie im Payload | `lineageId` schon in `openSlot`; `lineage {id, past[]}` im Slot-Teil von `/api/sessions` (Label, Zeitpunkt, Füllstand je Vorgänger, auch für Lanes) | `e2e/slots.ts`, `e2e/restart.ts`, `e2e/self-token.ts` (24 lineage-Treffer) | srv-Neustart mitten in einer Übergabe: die Vorgänger-Liste überlebt | Neustart der Scratch-Instanz mit drei Sessions, eine übergeben; danach alter Build gegen dieselbe `fleet.json` | Felder sind additiv; Revert lässt sie ungelesen |
| **S2** neue Leiste hinter Schalter | zweite Zeichenroutine neben `renderSlots`, Schalter in `localStorage` (Muster `STACK_LS`), alte Leiste bleibt Default | tsc, build, Leistenchecks in `e2e/slots.ts` gegen BEIDE Schalterstellungen | Headless-Bild je Zustand (Aufruf siehe Methode) | 16 Plätze, Übergabe, Lane-Übergabe, Landen, Rot; Handy am echten Gerät | Schalter aus |
| **S3** Lane-Name als Adresse | `Slot.id` wird `number \| string`; `server.ts#slotFrom` (96 Aufrufer, heute `Number(raw)` + `slots[id - 1]`, dazu 7 direkte Index-Zugriffe) löst `3A` auf Band 3, Lane A; Lanes leben als Kinder ihres Bands statt im 16er-Array; tmux `s3A`, Env `FLEET_SELF_SLOT=3A`; von zehn Vergabestellen bleiben die für Sessions | `e2e/slots.ts`, `e2e/lanes-basic.ts`, `e2e/lanes-lifecycle.ts`, `e2e/merge.ts`, `e2e/restart.ts`, `./e2e-clean-review.sh` (der Land-Pfad adressiert Lanes) | `/api/slots/3A/…` trifft die Lane, `/api/slots/3` nie; srv-Neustart adoptiert `s3A`; 16 + 0 und 1 + 15 halten beide den Deckel; recycelter Buchstabe mit altem `openedAt` = 409 | Scratch: Lane starten, landen, Buchstabe neu vergeben, Neustart dazwischen | Flag; aus = Lanes nehmen wieder Plätze |
| **S4** nummernstabile Übergabe | Die Nachfolgerin wird mit der Nummer des Bands geboren; der Vorgänger zieht beim Übergeben in einen nummernlosen Abgangsplatz (tmux `rename-session`, Slot-Objekt umhängen), bis `retireSucceededSession` ihn beendet | `e2e/programs.ts` (84 lineage-Treffer), `e2e/supervisor.ts`, `e2e/restart.ts`, `./e2e-claude-gate.sh`, `./e2e-clean-review.sh` | Übergabe: Nummer bleibt, Self-Token des Vorgängers gilt bis zu seinem Ende, ein `/send` an die Nummer trifft nie den Sterbenden; srv-Neustart WÄHREND der Übergabe verliert keine der zwei Panes | Scratch mit echtem `claude`-Harness, Neustart im Übergabefenster, tmux-Namen vorher/nachher | eigenes Flag; aus = heutiges Verhalten |
| **S5** Werkzeuge | `state.sh`/`ctl.sh` drucken und nehmen `3A`; alte Zeichenroutine abbauen, Schalter-Default umlegen | `e2e/ctl.ts`, Pins auf die Ausgabeform | `ctl.sh send` an `3A` trifft die Lane; an einen freien Buchstaben scheitert es mit Namen | `FLEET_CTL_HOME` auf Scratch | Ausgabeform zurück |

Reihenfolge-Zwang: S2 erst, wenn die drei Client-Lanes (Queue-Ansicht, Info-Leiste, Chat) gelandet
sind; S0, S1 und S4 berühren `src/client.ts` nicht. Deploy: S0 und S1 ändern nur, was beim NÄCHSTEN
Öffnen oder Übergeben geschrieben wird; laufende Sessions ohne `lineageId` bekommen sie beim Laden
nachgetragen (Muster `backfillProgramMainSessionId`), tmux-Name und Env bleiben unberührt. S3 gilt
nur für NEU gestartete Lanes, laufende behalten ihren Platz bis zum Land. S4 ist die einzige Stufe,
die eine laufende Pane anfasst, darum steht sie hinter einem Flag und zuletzt. S3 und S4 sind
**erschlossen, nicht erprobt**; für S4 gilt: dass `slots[n - 1]`-Zugriffe und die Pane-Env
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

Fassung 3 zusätzlich mit `--force-prefers-reduced-motion`: ohne das friert Headless-Chrome die
Breiten-Transition ein und malt „eingeklappt" und „Handy" in der alten Breite (das DOM meldet 50 px
bzw. 390 px, das Bild nicht). Das Mockup spielt Schalter aus dem Hash ab (`#do=full,collapse`, `#do=phone`, `#do=succeed,wide`),
so ist jeder Zustand verlinkbar und headless prüfbar. Geprüft am Bild: schmal, breit, Übergabe
(Session und Lane), Lane-Start, Rot, 16 Plätze, eingeklappt, Handy.

## Was nicht gemessen wurde

Keine Suite und kein Scratch-Server liefen, weil kein Produktcode entstand. Die Animation ist nur im
Chrome-Headless-Endbild geprüft, nicht in Bewegung und nicht in Safari auf dem Handy. Die Zählungen
sind Textsuchen, keine Aufrufgraphen: `slot` als Wort trifft auch Kommentare. Ob `saveState` eines
älteren Builds ein unbekanntes Slot-Feld verwirft, ist nicht gelesen. Wie viele der 1 114
`/api/slots`-Aufrufe in e2e eine Nummer als Identität PRÜFEN statt nur benutzen, ist nicht gezählt.

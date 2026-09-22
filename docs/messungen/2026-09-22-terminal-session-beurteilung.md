---
frage: Wie funktionieren Terminal-Ansicht (tmux → Server-Stream → WebSocket → xterm) und Hover-Modus heute, und welche Schnitte verbessern das Terminal selbst zuerst?
urteil: Das Terminal hat drei Korrektheitsfehler, die heute jede Nutzung treffen, und keinen Leistungsengpass. Ein automatischer Reconnect haengt den Seed ohne reset() an den alten Puffer (jeder Verbindungsabriss dupliziert bis zu 3000 Zeilen). Der Resize- oder ⟳-Reseed schiebt den gemeinsamen Stream-Cursor und schneidet damit Ausgabe aus allen anderen Sockets. ⟳ holt entgegen seinem eigenen Kommentar kein WebGL zurueck. Hover gibt es nur im Chat, dort per Tastatur nie und per Touch vermutlich nie erreichbar. Schnittlinie nach Schnitt 4, Terminal-Hover (5) erst nach der Lupe d5a399ff.
bereich: [terminal, hover, xterm]
belege: [src/client.ts#Pane, src/client.ts#openTermLink, server.ts#SEED_LINES, server.ts#ownerSeedCapture, server.ts#afterSeed, server.ts#poll, src/backoff.ts#reconnectDelay, src/entcard.ts#attachEntityCards, src/md.ts#ENT, src/client.ts#describeEntity, f7ca1fdb, 9c4237eb, 74486e20, a70e1d05]
nicht-gemessen: kein Browser, also kein Laufzeitverhalten (Touch, WebGL-Kontextverlust, Scrollgefuehl, echte Duplikate im Puffer). Nur Code, Commit-Bodies und xterm-5.5.0-Typings gelesen, nichts ausgefuehrt.
stand: 2026-09-22
---

# Terminal-Session und Hover-Modus: Beurteilung aus vier Blickwinkeln

2026-09-22, Lane `fleet/260922003850-a399`, Baum `070ff9bc`. Frage: **Wie arbeitet der Weg tmux → Server-Stream →
WebSocket → xterm heute, was kann der Hover-Modus im Terminal und im Chat, und welche hoechstens fuenf Schnitte
verbessern zuerst das Terminal selbst?**

Owner, woertlich (2026-09-21, Intake Slot 12): „Ich würde außerdem die terminal session nochmal versuchen wollen zu
optimieren, vllt indem wir mehrere Agenten benutzen die dann im Endeffekt die Art und Weise wie es heute funktioniert,
beurteilen und wir aus deren berichten dann am Ende einen plan aggregieren können." Und um 14:52: „außerdem würde ich
gerne den hover-mode hinter einem lupen-button packen und in der funktion, sowie auch für die terminal ansicht, sauber,
ambitioniert und AA Indie professionell, auswerten". Die Lupe selbst wird in Zeile d5a399ff gebaut. Diese Notiz
beurteilt nur.

**Lesart.** Zeilennummern in Klammern beziehen sich auf `070ff9bc` (datierter Schnappschuss). **G** heisst gemessen:
im Code oder in einer Befehlsausgabe gesehen. **V** heisst vermutet: gefolgert, und dazu gehoert alles
Browser-Verhalten, denn hier laeuft kein Browser. Mit **✓** markierte Befunde hat die aggregierende Session selbst
nachgelesen, also nicht nur vom Subagenten uebernommen.

## Methode

Vier Subagenten liefen parallel, je einer pro Blickwinkel, alle nur lesend. Jeder bekam eine eigene Leseliste und
dieselben Regeln: datei#symbol belegen, G und V trennen, jeden Befund mit Kosten versehen, Ungeprueftes nennen.
Danach hat die aggregierende Session die tragenden Befunde selbst nachgelesen (siehe §6):

```
sed -n 1180,1275p src/client.ts        # Pane#connect, ws.onclose, assign, reconnect
sed -n 1305,1320p src/client.ts        # markRenderer-Kommentar gegen reconnect
sed -n 38676,38740p server.ts          # websocket.open, drei Seed-Zweige
sed -n 15105,15200p server.ts          # afterSeed, ownerSeedCapture, broadcast, poll
grep -n 'setInterval(() => void poll' server.ts
grep -n 'pointer\|focusin\|OPEN_MS\|CLOSE_MS' src/entcard.ts
grep -n '^ *\.entcard {' public/index.html
```

Hinweis zum Brief: Er nennt fuer die Terminal-Links den Commit `1c23a04b`. Der Feature-Commit ist aber `f7ca1fdb`
(`feat(links): terminal urls clickable via addon-web-links`). `1c23a04b` ist ein e2e-Folgefix an `runLinks`.

## 1. Render- und Scroll-Pfad

**So laeuft es heute (alles G):**

- Der xterm-Konstruktor in `src/client.ts#Pane` (737–756) setzt `scrollback: 10000`, `smoothScrollDuration: 100`,
  Schriftgroesse 11 px mobil und 12 px sonst sowie eine feste Schriftfamilie. Versionen in `package.json`: xterm 5.5.0,
  addon-webgl 0.18.0, addon-canvas 0.7.0, addon-fit 0.10.0, addon-web-links 0.11.0.
- Frueheres Owner-Feedback steht bereits als Kommentar am Code:
  - Stottern pro Zeile, Meldung vom 2026-09-11, behoben mit `74486e20` (smoothScrollDuration 0 → 100).
  - Scrollback 50k → 10k, damals gerechnet mit „sechs Panes = 300 000 Zeilen".
  - Stiller Wechsel von WebGL auf Canvas, seit `9c4237eb` im ⟳-Tooltip sichtbar.
- Die Renderer-Wahl: Zuerst wird `WebglAddon` versucht, bei einer Exception `CanvasAddon`. `onContextLoss` ist
  behandelt: Das Addon wird entsorgt, Canvas geladen und `renderer` gesetzt. Danach wird nie wieder WebGL versucht.
  Sichtbar ist das nur im ⟳-Tooltip (`markRenderer`).
- `setLayout` entsorgt alle Panes und baut bis zu 4 neue (`LAYOUTS`). Jede neue Pane fordert einen frischen
  WebGL-Kontext und einen frischen Seed an.
- Es gibt keine Behandlung fuer devicePixelRatio, zur Laufzeit wird nie `term.options` geschrieben, und
  `clearTextureAtlas` kommt nicht vor.

**Befunde:**

1. **✓ G: ⟳ repariert einen herabgestuften Renderer nicht, obwohl Kommentar und Commit das behaupten.** Der Kommentar
   ueber `markRenderer` sagt: „⟳ is also the button that fixes a degraded one (reload rebuilds the Terminal and asks
   for a fresh context)". `Pane#reconnect` ruft aber nur `term.reset()`, `fit()` und `connect(true)` auf. Kein Addon
   wird neu geladen. Nach der Repo-Regel gilt bei einem Widerspruch zwischen Doc und Code der Code. Der Kommentar ist
   also falsch. **Kosten:** Der dokumentierte Ausweg aus dem Zwei-Zustaende-Stottern wirkt nicht. Die Diagnose-Frage
   aus `9c4237eb` („sagt die stotternde Pane canvas?") laesst sich mit ⟳ nicht schliessen, nur mit einem Neuladen der
   Seite oder einem Layoutwechsel.
2. **G Code, V Wirkung: Ein Layoutwechsel fordert bis zu 4 neue WebGL-Kontexte an, waehrend die alten noch freigegeben
   werden.** Der Konstruktor-Kommentar nennt das selbst als Ursache fuer Kontextverlust. Eine Gegenmassnahme gibt es
   nicht. **Kosten:** scheinbar zufaelliges Stottern nach einem Layoutwechsel.
3. **G: Nichts misst oder prueft den Render- und Scroll-Pfad.** `rg` ueber `e2e/` nach `smoothScroll`,
   `onContextLoss`, `WebglAddon`, `pinToBottom` und `term.reset` findet nichts. **Kosten:** Faellt
   `smoothScrollDuration` auf 0 zurueck, merkt es niemand.
4. **G: Ein Kommentar rechnet mit einer veralteten Zahl.** Die Rechnung „sechs Panes → 300 000 Zeilen" passt nicht
   mehr, denn `LAYOUTS` erlaubt hoechstens 4 Panes, also heute 40 000 Zeilen. **Kosten:** Leser werden irregefuehrt,
   sonst gering.

## 2. Transport, Reconnect, Seed und Resize

**So laeuft es heute (alles G):**

- **tmux → Datei.** `server.ts#ensureSlot` (~5985–6004) schreibt die ganze Pane-History in eine Stage-Datei und haengt
  danach `pipe-pane -o "exec cat >> <datei>"` an. Die Datei waechst nur.
- **Datei → Sockets.** `setInterval(() => void poll(), 100)` treibt `server.ts#poll`. Das liest vom gemeinsamen Cursor
  `s.offset` bis zur aktuellen Dateigroesse und verteilt ueber `server.ts#broadcast`.
  `server/transport.ts#transportWs` erzwingt per-message-deflate und zaehlt die Bytes.
- **Upgrade.** Cols werden auf 20–300 begrenzt, Rows auf 10–200, der Seed auf 50 bis `server.ts#SEED_LINES` (3000).
- **Seed beim Oeffnen, drei Zweige** (`websocket.open`, 38685–38735):
  - Resize oder `force`: `resize-window` → `capture-pane` → `s.offset = size` → `repaint`.
  - Gast: nur `capture-pane`.
  - Owner bei passender Breite: `server.ts#ownerSeedCapture` (stat → capture → stat, hoechstens
    `OWNER_SEED_ROUNDS` = 3 Runden). Danach schneidet `server.ts#afterSeed` den Ueberlapp nur fuer diesen Socket weg.
    Laut `a70e1d05` ist dieser Pfad 15,2-mal sparsamer als der alte Raw-Tail.
- **Client.** `Pane#connect` baut den WebSocket mit cols, rows, `force` und `seed`. Nach einem Close wartet er
  `src/backoff.ts#reconnectDelay` ab (1,5 / 3 / 6 / 12, dann 15 s). Zurueckgesetzt wird das erst, wenn der Socket
  `RECONNECT_SETTLED_MS` lang stand. Der Datensparmodus fordert ueber `src/pollplan.ts#pollPlan` einen kuerzeren Seed an.

**Befunde:**

1. **✓ G: Ein automatischer Reconnect dupliziert den Scrollback.** Der Retry in `ws.onclose` ruft `this.connect()` ohne
   `term.reset()` und ohne `pinPending` auf. Nur `assign` und `reconnect` setzen zurueck. Der Seed traegt keine
   Loeschsequenz, er ist `crlf(cap.out) + "\r\n"`. Der Gast-Client (`src/share.ts`, `term?.reset()`) setzt dagegen vor
   jedem Seed zurueck. Die beiden Clients widersprechen sich also. **Kosten:** Jeder Verbindungsabriss (auf dem Handy
   Alltag, dazu Schlaf und Server-Neustart) haengt bis zu 3000 Zeilen an, die schon da sind. Nach etwa drei Abrissen
   ist der 10k-Puffer ueberwiegend Kopie. Beim Hochscrollen sieht das Gespraech wiederholt aus (V, nicht im Browser
   gesehen), und jeder Abriss parst 3000 Zeilen auf dem Main-Thread. Den Befund haben der Render- und der
   Transport-Agent unabhaengig voneinander gefunden.
2. **✓ G Code, V Ausmass: Der Resize- oder ⟳-Reseed schiebt den gemeinsamen Cursor.** Im Resize-Zweig wird die
   Dateigroesse *nach* `capture-pane` gelesen und als `s.offset = size` gesetzt. Damit sind zwei Byte-Bereiche
   betroffen:
   - Bytes, die zwischen Capture und stat ankommen, stehen weder im Seed noch in einem Broadcast.
   - Den Bereich vom alten `s.offset` bis `size` bekommt kein *anderer* Socket je gesendet.

   `afterSeed` sagt im eigenen Kommentar, dass „the resize reseed … move[s] that cursor without broadcasting". Der
   Kommentar zu `ownerSeedCapture` stellt die Regel „a gap is worse than an overlap" auf. Der Resize-Zweig bricht sie.
   `repaint` malt nur den sichtbaren Schirm neu. **Kosten:** Jedes ⟳ und jeder Connect mit anderer Breite kann bei
   allen anderen Betrachtern Zeilen aus dem Scrollback schneiden, ohne dass es jemand merkt. Der Check in
   `e2e/slots.ts` („width-aware reseed", 834 ff.) prueft Umbruch und CRLF, nicht die Kontinuitaet fuer einen zweiten
   Socket.
3. **G: Mehrere Betrachter derselben Pane: Die Groesse setzt, wer zuletzt verbindet, und die anderen erfahren es
   nie.** `sendResize` bricht ab, wenn sich die eigene Groesse nicht geaendert hat. Nichts meldet `s.cols` an die
   anderen Clients. **Kosten:** Ein Handy-Reconnect mit etwa 45 Spalten bricht die Desktop-Ansicht derselben Pane auf
   Handybreite um. ⟳ am Desktop holt die Breite zurueck und loest dabei Befund 2 aus.
4. **✓ G: `poll` hat keinen Reentranz-Schutz.** `setInterval` startet alle 100 ms einen neuen Lauf, auch wenn der
   vorige noch in einem `await` haengt. Der Slice wird vor dem `await` mit `s.offset` berechnet, `from = s.offset`
   danach. V: Dauert ein Dateilesen laenger als 100 ms, geht derselbe Bereich zweimal hinaus. Das passt zur Signatur
   „DOPPELT" der Flake-Familie §11.2b in `docs/verify-tiering.md`, die diesen Weg nicht nennt. **Kosten:** doppelte
   Ausgabe unter Last, im Terminal und im Suite-Rauschen.
5. **G Code, V Wirkung: Der Verbindungspunkt kann luegen, und Backpressure fehlt.**
   - `setConn` laeuft nur fuer die fokussierte Pane in `onopen`/`onclose`.
   - Es gibt keinen `online`-, `pageshow`- oder `visibilitychange`-Handler fuer den Socket und keinen Heartbeat.
   - `broadcast` ignoriert den Rueckgabewert von `ws.send`.

   **Kosten:** Nach dem Aufwachen kann ein halb offener Socket gruen aussehen, ohne dass Ausgabe kommt (V). Eine
   langsame Leitung verliert Frames, ohne dass es gezaehlt wird (V, Bun-Defaults nicht nachgelesen).

## 3. Bedienung: Eingabe, Kopieren, Mobil, Fokus, Links

**So laeuft es heute (alles G):**

- **Tippen.** `term.onData` → `Pane#sendRaw` → WS-Frames von hoechstens `src/protocol.ts#WS_INPUT_MAX_BYTES`
  (1024 B) → serverseitig ein `tmux send-keys -H` pro Frame.
- **Composer.** Er ist eine eigene Textarea und sendet ueber `POST /send` (bracketed paste plus Enter).
- **Kopieren.** Nur ⌘C mit Auswahl ueber `attachCustomKeyEventHandler` → `src/client.ts#copyText`. Einen Knopf oder
  ein Kontextmenue gibt es nicht. Der Chat kopiert als Markdown (`selectionMarkdown`).
- **Mobil.** `textarea.inputMode = "none"`. Eingabe laeuft nur ueber die Tastenreihe `#keys` (esc, tab, ⇧tab, Pfeile,
  ⏎, ^C) und das Live-Feld `#livein`.
- **Addons und Optionen.** Geladen sind nur fit, web-links, webgl und canvas. Es gibt kein `macOptionIsMeta`, keine
  Such-Erweiterung und keine Unicode11-Erweiterung.
- **Links** (`f7ca1fdb`). `src/client.ts#openTermLink` behandelt bare URLs und OSC 8, nur http(s). Auf dem Desktop
  oeffnet ⌘/Strg-Klick, auf Touch ein Tipp, jeweils in einem neuen Tab mit `noopener`. Der e2e-Check
  `e2e/history.ts#runLinks` ist ein Quelltext-Pin.
- **Tastenkuerzel.** Strg/⌘ +/−/0 wird nur in der Chat-Ansicht abgefangen. Einen harten Konflikt zwischen den
  Seiten-Kuerzeln und Terminal-Tasten fand der Agent nicht.

**Befunde:**

1. **G Codepfad, V Browser: Auf dem Handy laesst sich aus dem Terminal nichts kopieren.** Kopieren gibt es nur ueber
   ⌘C, und der Kommentar an `openTermLink` sagt selbst „xterm there does no drag-selection". **Kosten:** Pfade und
   Fehlermeldungen muss der Owner ueber die Chat-Ansicht holen, also genau die Parallelansicht, die er nicht als
   Ersatz will.
2. **G: Im Scrollback kann man nicht suchen.** Es gibt keine `@xterm/addon-search`. Canvas und WebGL malen Pixel,
   deshalb findet die Browsersuche den Text vermutlich nicht (V). **Kosten:** 10 000 Zeilen sind nur durch Scrollen
   erreichbar. iTerm, Ghostty und das VS-Code-Terminal haben alle ⌘F.
3. **G (Messung aus dem Body von `f7ca1fdb`): Ein harter Umbruch zerschneidet Links und Kopien.** Der Seed wird ohne
   `-J` erfasst, und die TUI bricht selbst um, also ohne `isWrapped`. Ein Link greift dann nur ueber die erste Zeile,
   und eine Kopie enthaelt einen eingebauten Zeilenumbruch.
4. **G: Die Terminal-Schrift ist fest.** `fontSize` ist 11 oder 12, und `src/chatsize.ts#SIZE_SPEC` setzt nur
   `--chat-*`. Im Terminal zoomt Strg +/− deshalb die ganze Seite.
5. **G: Tastatur-Luecken.** ⌥ ist kein Meta, und die Tastenreihe hat kein ^R, ^O, ^D, PgUp/PgDn oder Home/End.

## 4. Hover-Modus in Chat und Terminal

**So laeuft es heute (alles G):**

- **Chat, Markierung.** `src/md.ts#text` markiert Treffer von `src/md.ts#ENT` (8-hex-Ids und „slot N"/„Slots 6/7")
  als `span[data-ent][data-id]` ueber `src/md.ts#entity`. Markiert wird nur, was `src/client.ts#entityKnown`
  bestaetigt, also Ids in `tasksList` oder Slots in `fleet`.
- **Chat, Karte.** `src/entcard.ts#attachEntityCards` verwaltet eine Karte pro Seite: `OPEN_MS` 350, `CLOSE_MS` 120,
  kein Warten beim Wechsel zwischen Ids, Escape, Scroll und `focusout` schliessen. Timing und Form stammen von t3codes
  `PullRequestLinkPreview` (`docs/messungen/2026-09-19-t3code-chat-muster.md` §3c).
- **Chat, Inhalt.** `src/client.ts#describeEntity` liefert fuer Tasks Status, erste Prompt-Zeile, Worker-Slot, Alter
  und Groesse, fuer Slots Harness, Modell, Branch, aktuelle Task und letzte Ausgabe. Der Prompt-Text wird beim ersten
  Hover ueber `loadTaskTexts()` nachgeladen, und zwar das ganze `/api/tasks`.
- **Queue-Detail.** Dieselbe Karte, dort setzt `src/client.ts#qMarkIds` zusaetzlich `tabIndex = 0`.
- **Terminal.** Kein Hover. `WebLinksAddon` und `linkHandler` setzen keinen `hover`-Callback. xterm 5.5.0 bringt
  `registerLinkProvider` mit `ILink.hover`/`leave` mit (in den Typings nachgelesen). Nach dem Verhalten des Linkifiers
  wird `provideLinks` nur beim Wechsel der Pufferzeile neu gefragt.

**Referenzarten, nach Wert fuer den Owner geordnet:**

| Art | Chat heute | Terminal heute | Wert | Kosten im Terminal |
|---|---|---|---|---|
| Task-Id (8-hex) | ja | nein | am hoechsten, vom Owner benannt | S: Link-Provider plus rect-basierte Karte, Daten schon im Client |
| Slot N | ja (heutiger Belegner) | nein | hoch | S fuer das Nachschlagen, M fuer eine Antwort, die bei altem Text stimmt (Befund 3) |
| Commit-Sha | nein | nein | hoch, Lane-Ausgabe steckt voller Shas | M: Lazy-Cache ueber `/api/commits`, muss gegen Task-Id abgegrenzt werden |
| URL | Link | Link | niedrig als Karte, Klick reicht | keine |
| Program-Id (Praefix) | nein | nein | mittel | M: Praefix-Kollision mit Task-Ids und Shas |
| datei#symbol | nein | nein | niedrig als Karte | M–L: cwd noetig, harter Umbruch (§3 Befund 3) |

**Befunde:**

1. **✓ G Code, V Browser: Per Touch oeffnet die Karte vermutlich nie.** Der `pointerout`-Handler raeumt `openTimer`
   ab. Ein Touch-Pointer feuert `pointerout` direkt nach `pointerup`, und ein Tipp ist kuerzer als 350 ms.
   **Kosten:** Auf dem Handy fehlt die Funktion praktisch.
2. **✓ G: Chat-Ids sind per Tastatur nicht erreichbar.** `src/md.ts#entity` setzt kein `tabindex`, der
   `focusin`-Weg feuert im Chat also nie. Die Queue setzt `tabIndex = 0`. **Kosten:** Eine Karte verhaelt sich in
   zwei Ansichten verschieden, und der Tastaturteil der AA-Messlatte faellt.
3. **G: „Slot N" in altem Text beschreibt den Slot, wie er jetzt ist.** `describeEntity` liest das Live-`fleet`, und
   Slot-Nummern werden wiederverwendet. **Kosten:** Beim Zurueckscrollen zeigt die Karte etwas selbstsicher Falsches.
   Mit Terminal-Hover wuerde das mehr, weil der Scrollback laenger ist.
4. **✓ G Code, V Haeufigkeit: Die Karte kann dauerhaft falsch „(no text on this board)" sagen.**
   `loadTaskTexts` kehrt bei `taskTextBusy` still zurueck, und `entTextAsked` hat die Id dann schon gemerkt. Die
   Karte fragt nie wieder nach. **Kosten:** eine falsche Aussage auf der Karte.
5. **✓ G: Das Karten-CSS steht zweimal in `public/index.html`** (`.ent`/`.entcard` bei 506/510 und 1215/1219). Der
   einzige e2e-Check ist der Quelltext-Pin „hover wiring" in `e2e/tasks.ts`. **Kosten:** Der An/Aus-Zustand der Lupe
   muesste an zwei Stellen gestylt werden, und ein Regress in der Chat-Markierung bliebe unentdeckt.

Falsch-Positive der 8-hex-Regex sind vernachlaessigbar (G), denn nur bestaetigte Ids werden markiert. Die Luecke
laeuft andersherum: Commit-Shas haben dieselbe Form und werden nie markiert.

**Was die AA-Indie-Messlatte hier konkret heisst:**

- Die Karte erscheint nach 350 ms, beim Wechsel zwischen Ids sofort, und der nachgeladene Text kommt danach.
- Touch: Tipp oeffnet, Tipp daneben schliesst.
- Tab und Escape verhalten sich in Chat, Queue und Terminal gleich.
- Die Karte hat in jeder Ansicht dieselben Felder.
- Sie sagt nie etwas Falsches (Befunde 3 und 4).

**Die Lupe (d5a399ff) als Schalter:**

- Terminal: Der Link-Provider wird nur registriert, solange die Lupe an ist. Aus heisst null Scan-Kosten und keine
  Verwechslung mit den ⌘-Klick-URLs.
- Chat: Die Markierung bleibt, Unterstreichung und Karte haengen an einer Body-Klasse.

**Vergleich mit t3code:** Es gibt eine Hover-Karte nur fuer PR-Links (350/120 ms, Daten erst beim Oeffnen geholt) und
fuer Dateipfade nur einen Tooltip. Ein Terminal-Hover kommt dort nicht vor. Beim Terminal gibt es also keine Vorlage.
Der Fleet waere mit einem Terminal-Link-Provider dort weiter als die Referenz.

## 5. Aggregierter Plan

Die Owner-Vorgabe war, das Terminal zu optimieren und den Hover „sauber, ambitioniert und AA Indie professionell"
auszuwerten. Nach „native over parallel views" kommt dabei das Terminal selbst zuerst. Deshalb stehen die Fehler, die
heute jede Terminal-Nutzung treffen, vor neuen Faehigkeiten.

### Schnitt 1: Reconnect setzt vor jedem Seed zurueck

- FLAECHE: `src/client.ts` (`Pane#connect`, der `ws.onclose`-Retry, `ws.onmessage`)
- DONE: Jeder Socket, der einen Seed empfaengt, schreibt in einen frisch zurueckgesetzten Puffer mit
  `pinPending = true`, auch beim automatischen Reconnect. `onmessage` verwirft Frames eines abgeloesten Sockets
  (Generationspruefung). Nach N erzwungenen Abrissen steht jede Seed-Zeile genau einmal im Puffer.
- VERIFY: Gate-Kette (`GET /api/self/gate`). Dazu ein Check in `e2e/slots.ts` neben den `reconnectDelay`-Checks
  gegen eine herausgeloeste reine Funktion, nach dem Vorbild von `pollPlan`. Danach `bun run build`.

### Schnitt 2: Stream-Kontinuitaet, Resize-Reseed ohne Lueckenbildung und poll ohne Reentranz

- FLAECHE: `server.ts` (`websocket.open`-Resize-Zweig, `ownerSeedCapture`, `poll`)
- DONE: Der Resize-Zweig verschiebt `s.offset` nicht mehr. Er nutzt `ownerSeedCapture` und `seedUntil` wie der
  Owner-Zweig. `poll` laeuft pro Slot hoechstens einmal gleichzeitig. Ausgabe, die waehrend eines ⟳ eines zweiten
  Clients laeuft, kommt bei beiden Sockets genau einmal an.
- VERIFY: ein neuer Check in `e2e/slots.ts` neben „width-aware reseed": zwei Sockets, der zweite oeffnet mit
  `force=1`, waehrend Markerzeilen fliessen, und beide Folgen muessen lueckenlos sein. Dazu `./e2e-isolated.sh` mit
  Ende „ALL PASS" (Pflicht, weil der Stream-Pfad angefasst wird). Danach die §11.2b-Rate im Trail
  (`docs/e2e-trail.md`) beobachten.

### Schnitt 3: ⟳ holt WebGL zurueck, und der Renderer ist ohne Hover sichtbar

- FLAECHE: `src/client.ts` (Renderer-Block des Konstruktors als `Pane#loadRenderer`, `Pane#reconnect`,
  `markRenderer`), `public/index.html` (eine Klasse)
- DONE: Nach einem Kontextverlust versucht ⟳ erneut WebGL, und bei Erfolg zeigt der Tooltip „webgl". Eine Pane, die
  nicht auf WebGL laeuft, traegt eine sichtbare Markierung am ⟳-Knopf. Der falsche Kommentar ueber `markRenderer` ist
  korrigiert.
- VERIFY: Gate-Kette. Dazu ein Quelltext-Pin in `e2e/history.ts` neben `runLinks`, dass `reconnect` den Renderer neu
  laedt. Im Browser: `WEBGL_lose_context.loseContext()` ausloesen, die Markierung zeigt „canvas", nach ⟳ „webgl".

### Schnitt 4: Hover-Grundlage fuer beide Ansichten (Touch, Tastatur, keine falsche Aussage)

- FLAECHE: `src/entcard.ts`, `src/md.ts#entity`, `src/client.ts#describeEntity`, `public/index.html`
- DONE:
  - Chat-Spans tragen `tabindex="0"`.
  - Ein Touch-`pointerdown` schaltet die Karte ohne 350-ms-Timer.
  - Ein beschaeftigter Nachlade-Lauf zeigt „…" statt „(no text on this board)".
  - Eine Slot-Karte ueber Text, der aelter ist als die jetzige Belegung, sagt das.
  - `.entcard` ist nur noch einmal definiert.
- VERIFY: Gate-Kette. Dazu ein `renderStub`-Check in `e2e/history.ts`, dass Entity-Spans `tabindex === "0"` tragen,
  und `grep -c '^ *\.entcard {' public/index.html` = 1.
- Hinweis an die MAIN: Schnitt 4 teilt Flaeche und Zweck mit der Lupe d5a399ff. Die Lupe schaltet eine Karte, die auf
  dem Handy heute nicht aufgeht. Der natuerliche Ort ist deshalb vor d5a399ff oder als Teil davon (Sammelzeile).

**─── Schnittlinie ───** Oberhalb stehen drei Fehler, die heute jede Terminal-Nutzung treffen, und die Mindestbedingung,
damit die Lupe „sauber" ist. Unterhalb steht die erste neue Faehigkeit. Sie kommt erst, wenn die Lupe gelandet ist,
denn die Lupe ist ihr Schalter.

### Schnitt 5: Hover im Terminal fuer Task-Ids und Slots hinter der Lupe

- FLAECHE: `src/client.ts` (Link-Provider im Konstruktor neben `WebLinksAddon`), `src/entcard.ts` (Karte an einem
  Rechteck statt an einem Element, Karte unter `Terminal.element` mit der Klasse `xterm-hover`)
- DONE: Mit eingeschalteter Lupe zeigt Hover ueber einer bekannten Task-Id im Terminal dieselbe Karte wie im Chat. Mit
  ausgeschalteter Lupe ist kein Provider registriert.
- VERIFY: Gate-Kette. Die reine Funktion „Zeile → Bereiche" wird in ein Modul herausgeloest und in `e2e/history.ts`
  gegen String-Fixtures geprueft, auch fuer umgebrochene Zeilen. Dazu ein Quelltext-Pin, dass der Provider beim
  Ausschalten entsorgt wird.

**Unterhalb der Linie, nicht als Karte:** Suche im Scrollback (`@xterm/addon-search`), Kopieren auf dem Handy,
Terminal-Schrift an „Aa" koppeln, `macOptionIsMeta`, Commit-Sha als Hover-Art, Resize-Meldung an andere Betrachter,
Heartbeat und `online`-Handler, Zaehlen der `ws.send`-Rueckgaben. Suche und Kopieren auf dem Handy stehen davon am
hoechsten. Sie kamen nicht in die fuenf, weil sie etwas Neues bauen, statt etwas Falsches zu reparieren.

**Widersprueche zwischen den Berichten und ihre Entscheidung:**

- Der Render-Agent schlug das Zuruecksetzen vor dem Seed als Render-Schnitt vor, der Transport-Agent als
  Transport-Schnitt. Es ist ein Befund, und er wird Schnitt 1.
- Der Bedienungs-Agent sah im Terminal keine Kollision mit Seiten-Kuerzeln. Der Hover-Agent sah eine moegliche
  Verwechslung zwischen ⌘-Klick-URLs und kuenftigen Hover-Links. Das ist kein Widerspruch. Die Lupe als Schalter loest
  das (Schnitt 5 registriert nur bei eingeschalteter Lupe).
- Der Kommentar ueber `markRenderer` widerspricht `Pane#reconnect`. Es gilt der Code, siehe §1 Befund 1.

## 6. Was selbst nachgelesen wurde und was nicht geprueft wurde

**Von der aggregierenden Session nachgelesen (✓):**

- §1 Befund 1: `Pane#reconnect` gegen den Kommentar an `markRenderer`.
- §2 Befund 1: `ws.onclose` ohne reset, Seed ohne Loeschsequenz, `share.ts` mit reset.
- §2 Befund 2: `s.offset = size` im Resize-Zweig und der Kommentar von `afterSeed`.
- §2 Befund 4: `setInterval(() => void poll(), 100)` ohne Guard.
- §4 Befunde 1, 2, 4 und 5: `pointerout` raeumt `openTimer`, `entity()` ohne tabindex, `taskTextBusy`/`entTextAsked`,
  die zwei `.entcard`-Bloecke.

Die uebrigen Befunde stammen aus den Subagenten-Berichten und sind hier nicht erneut gelesen.

**Nicht geprueft:**

- Alles Laufzeitverhalten im Browser: Touch-Ereignisse, WebGL-Kontextlimits, Scrollgefuehl, ob die Duplikate aus §2
  Befund 1 sichtbar sind, IME und Soft-Keyboards.
- Bun-Defaults fuer Backpressure und Ping in der installierten Version.
- Reale Groesse von `/api/tasks` und wie oft `taskTextBusy` greift.
- Die Wirkung auf den Demo-Checkout (`~/claude-fleet-demo`, `@app/*`-Alias), falls `entcard` seine API aendert.
- `src/shell.ts` (Tasten-Capture der Fenster), Maus-Reporting der TUI, der Share-Pfad jenseits der reset-Zeile, die
  Kosten von per-message-deflate auf dem Server.
- Keine Zahl ist hier neu gemessen. Die Byte-Zahlen zum Seed stammen aus dem Body von `a70e1d05`.

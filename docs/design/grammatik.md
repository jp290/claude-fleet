# Gestaltungsgrammatik — wo Knöpfe, Hinweise, Aufklapper, Menüs, Einstellungen und Karten leben

Stand 2026-09-22, Baum `a2e15ae4`. Program „Oberfläche aus einem Guss" (`0d51b4d4`), Entscheid A:
diese Notiz ist die Abnahmebasis jeder UI-Bauzeile des Programs. Eine Bauzeile nennt die Regel-
nummern, die sie herstellt; die Abnahme prüft genau diese Regeln.

**Woraus sie gebaut ist.** Drei Subagenten, je ein Blickwinkel, jeder hat die Flächen selbst gelesen:
**(a) Owner-Sprache** (Beschriftungen, Tooltips, Innenvokabular), **(b) Konsistenz** mit der Sprache
von Chat-Ansicht (`db81f382`) und Leiste v6 (`f29538f8`, `docs/design/sidebar/v6.html`), **(c) Bau-
und Pflegekosten** (was mit vorhandenen Klassen in einem Schnitt geht, wo eine Basis fehlt). Dazu
eigene Screenshots einer Testinstanz (`./testinstanz.sh up full`, eigener Port und Socket) bei
1200 × 900, 390 × 844 und 844 × 390. Jede Regel nennt in eckigen Klammern, welcher Blickwinkel sie
trägt; wo zwei sich widersprachen, steht der Entscheid im Abschnitt „Widersprüche".

**Anker.** Jede Regel nennt als Anker eine Klasse, eine ID, ein Token oder ein Symbol, das heute in
`public/index.html` oder `src/*.ts` existiert. Probe: `rg -n -F '<anker>' public/index.html src/`.
Ein Anker ist das VORBILD der Regel, nicht die Stelle, die schon stimmt; wo das Vorbild selbst
abweicht, steht es in der Tabelle.

**Was die Grammatik nicht tut.** Sie erfindet kein zweites Token-Set: alle Farben, Größen, Radien
kommen aus dem `--chat-*`-Block am `:root` (`public/index.html`, Kommentar „Three size variables")
und aus den dort schon deklarierten Hilfswerten `--c-hover`, `--c-edge-hi`, `--r1`…`--r3`, `--t`.
Zustandsfarben (`--danger`, `--amber`, `--q-live`, `--q-wait`) existieren heute nur im Board-`:root`;
sie werden benutzt, nicht neu erfunden. Sie erfindet keine Fläche, die der Owner nicht genannt hat.

---

## 0. Grundregeln (gelten für alle sechs Klassen)

**G0.1 Ein Material.** Grund `--chat-void` (reines Schwarz), Flächen `--chat-surface` →
`--chat-raised`, Kanten `--chat-edge-soft`/`--chat-edge`, Tinte in drei Stufen
`--chat-faint` → `--chat-mute` → `--chat-ink` (Ruhe · Hover · bereit/aktiv). Kein Hex-Literal in
einer neuen oder umgebauten Regel. Anker: `--chat-void`, `#board` (die Aliasse `--b-ink` … `--b-surface` zeigen
alle auf `--chat-*` — die sauberste Token-Disziplin im Blatt). [b]

**G0.2 Blau hat keine Bedeutung mehr.** `--accent`/`--sel` verlassen die Chat-Sprache: „an" ist
Tinte, nicht Blau (G1.3); der Fokusring ist der des Composers, 1 px `--chat-mute` (Anker: `#comp`).
Farbe ist nur noch Signal: `--danger` Fehler, `--amber` ungemessen, `--q-live` läuft von selbst,
`--q-wait` wartet auf dich. [b]

**G0.3 Schrift.** `--chat-sans` für alles, was ein Mensch liest (400 Text, 500 Beschriftung);
`--chat-mono` nur für Adressen, IDs, Shas, Branches, Pfade, Befehle und Zahlenwerte, die man
kopiert. Größen nur `--chat-fs` / `--chat-code-fs` / `--chat-ui-fs` — damit skaliert jede Fläche
mit dem Aa-Regler (`src/chatsize.ts`). Anker: `.slot .laneref` (die Adresse in Mono, alles andere
Sans). [b]

**G0.4 Maße.** Radien `--r1` 6 (Chips, Knöpfe, Zeilen) · `--r2` 10 (Popover, Panels, Karten,
Codeblock) · `--r3` 18 (Blase, Composer). 4-px-Raster. Eine Bewegung `--t`, nur Farben, aus unter
`prefers-reduced-motion`. Die heute gestreuten 5/7/8/12/14/999 wandern auf diese drei, wenn ihre
Fläche umgebaut wird; `.slot` behält 12 (die Zeile ist abgenommen, v6). Anker: `#comp` (der
Grammatik-Kommentar darüber). [b, c]

**G0.5 Owner-Sprache.** Kein Prozess-Nomen im sichtbaren Text: *baton, succession, rail, audit,
suite, gate, mutex, tier, carry, srv, bundle, seed, TTL, ctx, „‹x› only"* stehen höchstens am
Ende eines Tooltips hinter „intern:". Ein Tooltip beantwortet zuerst „was passiert, wenn ich
klicke / was heißt das für mich", danach das Wie. Gleiches Ding, gleicher Name über alle Flächen.
Sichtbare Beschriftungen sind **deutsch** (benannte Annahme, Frage 1). Anker: `.chatsizebtn`
(der einzige Eckknopf mit deutschem Tooltip heute). [a]

**G0.6 Eine Glyphen-Sprache.** Ikonen kommen aus `src/icons.ts#icon` (SVG, `currentColor`), nicht
aus Emoji oder Unicode-Pfeilen. Ausgenommen bleibt `PK_ICONS` (vom Security-Pin gehalten). Anker:
`#sidetools button`. [b, c]

**G0.7 Mobil ist eine Bedingung, nicht zwei.** Mobil heißt `MOBILE_MQ`
(`(max-width: 700px), ((pointer: coarse) and (max-height: 500px))`, in `src/client.ts` und
`src/shell.ts` gleich) — Hoch- und Querformat bekommen dieselbe Behandlung; dort Trefferflächen
≥ 40 px und Eingaben 16 px (kein iOS-Zoom). Keine Fläche erfindet eine eigene Breitengrenze.
Anker: `MOBILE_MQ`. [b, c]

---

## 1. Knöpfe — Icon-, Wort-, Umschalt-Knopf

**Zuhause.** Ein Knopf lebt an der Fläche, auf die er wirkt: Pane-Knöpfe in der Eckreihe der Pane,
Leisten-Knöpfe in `#sidetools`, Sitzungs-Handlungen im Info-Tab bzw. im `.slotact`-Streifen,
Composer-Knöpfe in der Composer-Zeile. Nie eine zweite Kopie desselben Knopfs anderswo (heute:
↻ steht mobil zweimal, `#refresh` im `#mhead` und `.panereload` in der Pane — Screenshot m390).

**G1.1 Icon-Knopf.** 23 × 23 px (Pane-Ecke: 26 px hoch, Trefferfläche), Radius `--r1`,
`--chat-raised` auf `--chat-edge`, Glyphe `--chat-mute`, Hover `--chat-ink`, SVG aus
`src/icons.ts`. Pflicht: `title` in Owner-Worten, gebaut als Verb + Objekt („Neu verbinden").
Anker: `#sidetools button`. [b; Titelpflicht a]

**G1.2 Wort-Knopf.** Sans `--chat-ui-fs`, Radius `--r1`, Kante `--chat-edge`, Hover `--c-hover`
+ `--c-edge-hi`. Genau drei Töne: normal · primär (Tinte gefüllt, schwarze Schrift) · Gefahr
(`--danger` nur als Schrift/Kante). Anker: `#board .bbtn` (Grundform), `.cmdapply` (primär).
Die vier Beinahe-Doppel `.riskbtn`, `.shrbtn`, `.qbtn`, globales `.bbtn` wachsen in eine Basis
(Karte K6). [b, c]

**G1.3 Umschalt-Knopf.** „An" = Tinte `--chat-ink` + Kante `--chat-mute` auf `--chat-surface`;
„aus" = G1.1. Zustand zusätzlich als `aria-pressed`. Kein Blau. Anker: `#layouts button.active`.
[b; aria c]

**Mobil.** Dieselben Knöpfe, Trefferfläche ≥ 40 px (wie `.rowact` heute im Mobilblock); nichts
hover-only — was am Desktop auf Hover erscheint, steht mobil im Fluss (Vorbild: `.slotact` unter
`@media (hover: none)`).

---

## 2. Hinweise und Banner — Alarm, Hinweis, Statuszeile

**Zuhause.** Ein Alarm lebt oben über der Arbeitsfläche, ein Hinweis direkt an dem Ding, das er
erklärt, eine Statuszeile in der Zeile des Dings, dessen Zustand sie ist. Nichts schwebt über
fremdem Inhalt.

**G2.1 Alarm** (etwas ist schiefgegangen und gilt für die ganze Maschine). Eine volle Breite
oben, **im Fluss** — er schiebt Leiste und Panes nach unten, statt sie zu verdecken. Grund
`--chat-void`, getönt per `color-mix` aus `--danger` (rot = gemessen fehlgeschlagen) bzw.
`--amber` (ungemessen), Unterkante in der Signalfarbe, Text in Tinte, eine Handlung als G1.2-Knopf
„Gesehen". Wortlaut: Folge + Handlung in Owner-Worten; Befehle und Pfade in Mono im Tooltip oder
als Link. Anker: `.plaudit` (Zuhause stimmt, Material und Lage nicht). Einzige weitere
Alarm-artige Fläche bleibt `#newver` — das ist Neuigkeit, kein Fehler, und behält ihre Ecke unten
rechts, aber im Chat-Material. [b entscheidet Material, c hält die Trennung, Lage: Entscheid W2]

**G2.2 Hinweis** (erklärt, warum etwas so ist). Ein Satz, Sans `--chat-ui-fs`, `--chat-mute`,
optional in einem Kästchen `--chat-edge` Radius `--r2` — direkt unter dem, was er erklärt. Die
13 Einzelklassen (`.landhint`, `.bnote`, …) wachsen in eine Basis `.hint` (Karte K6). Anker:
`.headnote`, `.instnote`. [b, c]

**G2.3 Statuszeile** (was gerade passiert). Eine Zeile Sans 400, `--chat-mute`, Zeitangaben
`tabular-nums`; der Zustand steht als Wort, ein Signalpunkt nur mit den Zustandsfarben aus G0.2.
Sie sitzt in der Fläche des Dings (Slot-Zeile `.r2`, Info-Tab-Kopf, unter dem Composer). Anker:
`#comppark`. [b; Idee 2 „sichtbar, was gerade passiert"]

**Mobil.** Der Alarm bleibt oben im Fluss über `#mhead`; Hinweise brechen um, nie abgeschnitten.

---

## 3. Aufklapper — Tabs, Reiter, Tray

**Zuhause.** Umschalten *zwischen Ansichten derselben Sache* = Tabs; Auf- und Zuklappen *eines
Abschnitts in einer Spalte* = Reiter; *Werkzeuge, die ein eigenes Fenster öffnen* = Tray.

**G3.1 Tabs** (Segment-Steuerung). Eine Reihe G1.2-Knöpfe ohne Rahmen, der gewählte mit Fläche
`--c-hover` + inset `--chat-edge`, Zähler in `--chat-faint`. Ein Zustandsname: `.on` +
`aria-pressed`. Anker: `.qview` (Vorbild; `.actlens` und `#layouts` folgen, Karte K6). [b, c]

**G3.2 Reiter** (Abschnitt in einer Spalte). Überschrift in Satzschreibung (nicht VERSALIEN),
Sans 500, links, Chevron aus `src/icons.ts` rechts (heute zwei Chevrons: CSS-Rand `.bchev` und
SVG `.optchev` — SVG gewinnt), Zustand pro Browser gemerkt über die Einstellungs-Registry (G5.1).
Abschnitte trennt Raum, nie ein Kasten. Anker: `.bsec` im Info-Tab. [b]

**G3.3 Tray** (Werkzeugleiste unter dem Composer). Nur Starter: Glyphe + Wort, 24 px, `--r1`,
`--chat-mute` → `--chat-ink`, Hover `--c-hover` (heute das Literal `#141416`). Ein Tray-Eintrag
öffnet ein Fenster (G4/G6) oder schaltet einen Modus (Live → dann G1.3). Anker: `#comptray`. [b, c]

**Mobil.** Tabs scrollen waagerecht statt umzubrechen; der Tray bleibt eine Zeile unter dem
Composer, Einträge ≥ 40 px.

---

## 4. Untermenüs und Popover — Kontextmenü, Optionsleiste, Auswahl

**Zuhause.** Ein Popover hängt an genau dem Knopf, der es öffnet, und sonst nirgends. Größere
Dialoge (mehr als eine Liste) sind Fenster, keine Popover.

**G4.1 Ein Popover-Material.** `--chat-raised`, Kante `--chat-edge`, Radius `--r2`, Schatten
`color-mix(in srgb, var(--chat-void) 70%, transparent)`, Zeilen Radius `--r1`, Hover `--c-hover`,
aktuelle Zeile in Tinte. Schließt bei Außenklick und Esc, gibt den Fokus an den Auslöser zurück,
Pfeiltasten bewegen. Das leistet heute **nur** `.optpop` (Tastatur) bzw. `#instmenu` (Material);
drei eigene Außenklick- und drei Esc-Handler (`src/chatsize.ts#sizePanel`, `#instmenu`,
`.optpop`) werden ein Helfer (Karte K5). Anker: `#instmenu`, `.instrow`. [b Material, c Helfer]

**G4.2 Kontextmenü** (Handlungen an einer Sache). G4.1-Liste, jede Zeile Verb + Objekt, die
Gefahr-Zeile zuletzt und in `--danger`. Anker: `.instrow`. [a, b]

**G4.3 Optionsleiste** (Einstellung einer laufenden Sache, z. B. Modell/Effort). Der Schalter
zeigt den aktuellen Wert als Wort + Chevron, das Popover öffnet darüber. Anker: `.optsw`,
`.optpop`. [b]

**G4.4 Auswahl** (eine aus mehreren, mit Bestätigung). Zwei Zustände und nur diese: *aktuell* =
Fläche `--c-hover`, *vorgemerkt* = Tintenkante; ein primärer G1.2-Knopf übernimmt. Anker:
`.cmdlevel`, `.cmdmodel`. [b]

**G4.5 Bestätigungen sind Fenster, nicht `confirm()`.** Eine Rückfrage vor einer folgenreichen
Handlung (beenden, zurücknehmen, einbauen) nutzt die vorhandene `.riskbtns`-Form in einem
Dialog-Helfer; die sechs kopierten Risiko-Dialoge in `src/client.ts` (`showRiskPreview`,
`confirmCommand`, …) werden einer (Karte K3). Natives `alert/confirm/prompt` (~38 Stellen) ist
Altbestand und wandert erst in einem späteren L-Schnitt. [c]

**Mobil.** Ein Popover wird zur vollen Breite der Fläche, unten angesetzt (Vorbild: `.optpop`
im Mobilblock); ein Fenster wird Vollbild (`src/shell.ts#openShell` tut das schon).

---

## 5. Einstellungen — lokal gegen serverseitig

**Zuhause.** Ein Einstellungsfenster, geöffnet von **einem** Zahnrad oben rechts (Owner:
„ein Einstellungsmenü oben rechts … das wir dann langsam füllen"). Das Zahnrad ist der
rechteste Knopf der Eckreihe der Pane, die die obere rechte Ecke des Fensters berührt — in jeder
Aufteilung genau eine; mobil sitzt es in `#mhead` rechts, auf dem Platz, den das doppelte
`#refresh` räumt. Das Fenster ist ein `src/shell.ts#openShell`-Fenster wie Explorer und
Gründungsfenster. (Benannte Annahme; Frage 2.)

**G5.1 Lokal = dieses Gerät, per localStorage, über eine Registry.** Alles, was nur die Ansicht
dieses Browsers ändert (Schriftgröße, Datensparen, versteckte Lanes, Reiter-Zustände,
„nicht mehr zeigen"), liegt unter einem `fleet.*`-Schlüssel, der in EINER Registry mit Name,
Owner-Beschriftung und Standardwert steht, gelesen und geschrieben mit try/catch. Heute: 23
Schlüssel, 46 Aufrufstellen, kein Wrapper, nur 5 mit try/catch, mehrere ungeschützt beim Laden
(Blickwinkel c, aus dem Code gelesen, nicht reproduziert). Jeder Schlüssel mit sichtbarer Wirkung
hat im Einstellungsfenster unter „Dieses Gerät" eine Zeile — und damit einen Rückweg (heute hat
`fleet.plaudit.ack` und „Don't show again" (`fleet.modelSwitchWarn`) keinen). Anker:
`fleet.chatsize` (der einzige mit try/catch und eigenem Panel). [c Registry, a Rückweg]

**G5.2 Serverseitig = die Fleet, per Route.** Alles, was das Verhalten der Fleet ändert (für alle
Geräte, für Sessions), wird über eine Route gesetzt, die es schon gibt oder die die Bauzeile ihres
Themas mitbringt — die Grammatik erfindet keine (`/api/settings` gibt es heute nicht). Im Fenster
unter „Fleet", jede Zeile mit dem Satz, was sie für alle bedeutet. Vorbild für eine per GUI
gesetzte Server-Einstellung: der Modell-Schalter (`optSwitch`, setzt den Slot-Eintrag). [c; Idee 4]

**G5.3 Aussehen des Fensters.** Zeilen: Beschriftung links (Sans), Regler rechts (G1.3 bzw.
Schieber), Wert als Zahl in Mono, ein Hinweis (G2.2) unter der Zeile, „Standard" als Wort-Knopf
je Abschnitt. Anker: `.sizepanel` (Zeilenform `.sizerow`, `.sizereset`), das heute einzige
Einstellungs-Panel; es wandert als Abschnitt „Schrift" ins Fenster, der Aa-Knopf bleibt als
Abkürzung (G6: kein zweites Zuhause, der Knopf öffnet dieselbe Zeile). [b, c]

**Mobil.** Vollbild-Fenster; die Abschnitte „Dieses Gerät" und „Fleet" als Tabs (G3.1).

---

## 6. Karten — Hover-Karte, Detail-Pane

**Zuhause.** Kurz und flüchtig über der Sache = Hover-Karte; dauerhaft und ausführlich neben der
Pane = die rechte Spalte (Info-Tab). Keine Parallelansicht: was man über eine Session wissen
will, steht im Info-Tab, nicht in einem dritten Panel (Owner-Geschmack „native over parallel
views").

**G6.1 Hover-Karte.** Jede ID, jeder Slot, jede Sha im Text ist hoverbar und zeigt eine Karte:
G4.1-Material, erste Zeile Name in Sans, Metazeile mit IDs in Mono, höchstens vier Zeilen.
Öffnet auf Hover und Fokus, schließt auf Hover-weg, Scroll, Esc. Wortlaut nach G0.5 (heute
`ctx 42%` → „Kontext 42 %"). Anker: `.entcard`, `src/entcard.ts#attachEntityCards`. (Die
wörtliche Doppelung des `.entcard`-Blocks in `public/index.html` fällt, Karte K1.) [b, c, a]

**G6.2 Detail-Pane.** Die rechte Spalte `#board`, eine Spalte pro Fenster, Grund `--chat-void`,
Abschnitte als Reiter (G3.2), Handlungen als Wort-Knöpfe (G1.2) am Ende ihres Abschnitts,
Adressen in Mono. Der Kopf trägt einen Titel in Owner-Worten („Info" — heute „Session brief")
und das Schließen. Anker: `#board`, `#boardhead`. [b, a]

**G6.3 Fenster** (Explorer, Gründungsfenster, Verlauf, Einstellungen). Ein
`src/shell.ts#openShell`-Fenster im Chat-Material (heute noch `.panel`/`.shellwin` auf der alten
Palette — nur `#shell-queue` ist umgezogen). Anker: `openShell`, `#shell-queue`. [b, c]

**Mobil.** Keine Hover-Karte ohne Hover: Tippen auf eine ID zeigt die Karte, Tippen daneben
schließt. Die rechte Spalte ist mobil verborgen; ihr Inhalt erreicht man über ℹ als
Vollbild-Fenster (G6.3).

---

## Widersprüche zwischen den Blickwinkeln — entschieden, nicht gemittelt

- **W1 Sprache: deutsch (a) gegen „die App spricht englisch" (b hält die bestehende Sprache).**
  Entschieden: deutsch für sichtbare Beschriftungen. Grund: der Owner schreibt und entscheidet auf
  Deutsch, die zuletzt abgenommene Fläche spricht es schon (Aa-Tooltip „Schriftgröße …", `.sizereset`
  „Standard"), und Idee 3 verlangt Owner-Sprache. Die Umstellung passiert je Fläche mit ihrer Bauzeile, nicht als
  Suchen-und-Ersetzen. Offen als Frage 1.
- **W2 Alarm: sichtbar über allem (c, und der Kommentar über `.plaudit`: „being SEEN is the entire
  mechanism") gegen „nichts verdeckt fremden Inhalt" (b).** Entschieden: im Fluss oben, volle
  Breite. Das erhält das Gesehen-werden (oberste Zeile, Signalfarbe) und nimmt dem Alarm nur das
  Verdecken von Kopfzeile und Leisten-Kopf.
- **W3 Radius 12 für Karten (b: Skala erweitern) gegen 6/10/18 (Composer-Grammatik).**
  Entschieden: 6/10/18; Karten und Panels auf 10. `.slot` behält 12, weil die Leiste abgenommen
  ist — die einzige benannte Ausnahme.
- **W4 „Ausgewählt" als Fläche oder als Kante (b fand beide).** Entschieden: beide, je ein Ort —
  Kante für Umschalt-Knöpfe (G1.3), Fläche für die aktuelle Zeile in Listen/Tabs (G3.1, G4.4).
- **W5 Einstellungen: erst die Registry (c) oder erst das Menü (Owner-Wunsch).** Entschieden:
  Registry zuerst (S, Karte K2) — ein Menü, das Schlüssel ohne Registry liest, müsste jede Zeile
  mit der Hand verdrahten, und die ungeschützten Lesezugriffe beim Laden sind ein echter Fehler.

---

## Tabelle — heutige Flächen, ihre Regel, ihre Abweichung

| Fläche | Folgt | Weicht heute ab (Beleg) |
|---|---|---|
| Sechs Pane-Eckknöpfe ↻ ℹ 💬 ↑ ↓ Aa (`Pane`-Konstruktor; `.panereload` `.boardtoggle` `.viewtoggle` `.promptnav` `.chatsizebtn`) | G1.1, G1.3, G0.6 | fünf Byte-Kopien derselben drei Deklarationen mit `var(--line)`, `rgba(38,38,38,.85)`, `var(--dim)`, Radius 7; „an" in Blau (`.pane.chat .viewtoggle` `--accent`, `.promptnav` sogar in Ruhe blau); Unicode statt `icons.ts`; Tooltips englisch mit Innenvokabular („reconnect + reseed scrollback") |
| Info-Tab: Files-Block (`fileTreeSection`, „Open explorer", „Re-read") | G6.2, G1.2, G0.5 | englisch; Leertext nennt `git ls-files`; „Files" heißt auch der Tray-Eintrag fürs Anhängen |
| Info-Tab: Suite-Strecke (`renderSuiteMeter`, `src/suitemeter.ts`) | G2.3, G3.2 | „Suites", „post-land audit", „suite offer", Kopf in VERSALIEN (`FLEET`, `SESSION`) |
| Info-Tab: Zeile „Baton" und Nachbarn Fill/Handover/Rail (`srow`) | G2.3, G0.5 | reines Innenvokabular, Tooltip nennt `FLEET_LANE_SUCCEED_MAX`; Owner-Fassung z. B. „Nachfolgen: 1 von 3" |
| Info-Tab: Schild „‹instanz› only" (`.smscope`) | G0.5, G2.3 | „mac only" — das Owner-Beispiel; Fassung „nur dieser Rechner" |
| Info-Tab: deploy-due-Zeile (`deploySection`) | G2.2 | Befehl als Hinweistext („restart srv", „run bun run build") statt Folge + Handlung |
| Post-Land-Alarm (`.plaudit`, `renderPostLandAudit`) | G2.1 | fixiertes Overlay über der Seite; 14 Hex-Literale; `.plahd` fett statt 500; „POST-LAND AUDIT FAILED … integration tip", Knopf „acknowledge"; Quittung ohne Rückweg |
| Composer-Optionszeile ＋ · Cache · Modell · Effort · ⌘ (`optSwitch`, `commandSwitch`, `tickCacheAge`) | G4.3, G4.4, G1.2 | stimmt im Material; „⌘ 4" erklärt sich nicht, „Apply" englisch, Cache-Alter nur im Tooltip mit „TTL" |
| Tray Files · History · Schedule · Live (`#comptray`, `TRAY`) | G3.3 | Hover-Literal `#141416`; englisch |
| `.slotact`-Streifen | G1.1, G0.5 | Glyphen ⏸ ✕ ⇲ ⏏ ✔ statt `icons.ts`; Tooltips „land", „shelve", „conflict resolutions" |
| Dialoge der Leiste: kill, rename, risk (`showRiskPreview`, `startRename`, `confirm()`) | G4.5, G4.2 | Risiko-Dialog sechsfach kopiert; kill per nativem `confirm()`; rename inline über das `.bmenu`-Menü (folgt G4.2, Menü selbst ohne Esc/Außenklick) |
| Verstreute `fleet.*`-localStorage-Schalter | G5.1 | 23 Schlüssel ohne Registry, ohne Übersicht, teils ohne Rückweg |
| Künftiges Einstellungsmenü oben rechts | G5 (ganz) | existiert nicht |
| Datei-Explorer (`openExplorer`) | G6.3 | `openShell`-Fenster (Zuhause stimmt), Material noch `.panel`-Palette |
| Hover-Karte (`src/entcard.ts`) | G6.1 | Material `rgba(12,12,14,.97)` statt G4.1, Radius 12; CSS-Block doppelt; `ctx`, `lane` im Text |
| Gründungsfenster am leeren Slot (`openPicker`) | G6.3, G4.4 | `openShell` (stimmt); Filter/Pfad-Felder mit Literalen (`.pkfilterin`, `.pkpathin`), „harness", „⎇ hide lanes" |
| Mobil hoch (390 × 844) | G0.7 und je Klasse | `#mhead` alte Palette, Titel in Mono (Screenshot m390); ↻ doppelt (`#refresh` + `.panereload`); `#keys` alte Palette |
| Mobil quer (844 × 390) | G0.7 | gleiche Behandlung wie hoch (gewollt, `MOBILE_MQ`); die Eckreihe frisst von 390 px Höhe vier Knopfhöhen — nicht gesondert vermessen |

---

## Karten-Vorlagen für die MAIN (nicht gefilt — die MAIN filt)

Reihenfolge nach Kosten und Abhängigkeit (Blickwinkel c). Jede Karte nennt ihre Regeln; VERIFY
jeweils `pins` plus Screenshot bei 1200 und 390 px gegen die Regel.

- **K1 (S)** Doppelten `.entcard`-Block entfernen; `.entcard` auf G4.1-Material. Regeln G6.1, G4.1.
- **K2 (S)** Einstellungs-Registry `src/prefs.ts` (get/set mit try/catch, Schlüssel mit Beschriftung
  und Standard), alle 46 Aufrufstellen umziehen. Regel G5.1. Vorsicht: `e2e/outcomes.ts` pinnt den
  Import von `PLA_ACK_KEY` aus `./plaudit`.
- **K3 (S)** Ein Dialog-Helfer für die sechs Risiko-Dialog-Kopien. Regel G4.5.
- **K4 (M)** Pane-Eckreihe: eine Basis für die fünf Knopf-Kopien, Glyphen aus `icons.ts`, „an" in
  Tinte, Tooltips in Owner-Worten, das Zahnrad als sechster Knopf, mobil `#refresh` weg. Regeln
  G1.1, G1.3, G0.6, G5 (Zuhause). Vorsicht: `e2e/slots.ts` parst die Regel
  `.pane.past .viewtoggle, .pane.past .panereload, .pane.past .boardtoggle`.
- **K5 (M)** Popover-Helfer (Außenklick, Esc, Fokus zurück, Pfeiltasten — Vorbild `.optpop`) und
  Material, Umzug `#instmenu`, `sizePanel`, `.optpop`, `.bmenu`. Regeln G4.1–G4.4.
- **K6 (M)** Wort-Knopf-Basis (`.riskbtn`, `.shrbtn` zuerst, dann `.qbtn`, `.bbtn`), Tabs-Basis
  (`.qview`, `.actlens`, `#layouts`), `.hint`. Regeln G1.2, G3.1, G2.2. Vorsicht: `e2e/tasks.ts`
  pinnt `.shrbtn`-CSS wörtlich — die Pins ziehen in derselben Lane mit.
- **K7 (M)** Alarm im Fluss und im Chat-Material, Owner-Wortlaut, Quittung mit Rückweg. Regel G2.1.
- **K8 (M)** Einstellungsfenster mit „Dieses Gerät" (aus der Registry) und „Schrift"; „Fleet"
  bleibt leer, bis eine Themen-Zeile ihre Route mitbringt. Regeln G5.1–G5.3. Nach K2 und K4.
- **K9 (L, je Fläche)** Owner-Sprache im Info-Tab (Baton-Block, Suite-Strecke, Schild, deploy-due),
  dann Tray, `.slotact`, Gründungsfenster. Regel G0.5. Braucht die Antwort auf Frage 3.

Die Demo (`~/claude-fleet-demo`) baut gegen `src/client.ts`; eine Karte, die Klassen oder Exporte
umbenennt, prüft dort `bun run typecheck`.

---

## Drei Fragen an den Owner

1. **Deutsch überall?** Die Grammatik stellt sichtbare Beschriftungen auf Deutsch um (W1) — auch
   Handlungswörter, die du heute englisch liest („Land lane", „Shelve", „Apply"). Oder sollen
   kurze Handlungswörter englisch bleiben und nur Erklärtexte deutsch werden?
2. **Das Zahnrad nur an der oberen rechten Pane?** In einer 2er- oder 4er-Aufteilung steht es
   so genau einmal, aber es wandert mit der Aufteilung. Alternative: ein fester Platz in der
   Fensterecke, unabhängig von den Panes.
3. **Deine Wörter für die Kernbegriffe.** Welche Namen willst du sehen für *land* (heute
   „Land lane"; Vorschlag „In main einbauen"), *lane* (bleibt „Lane"?), *succession/baton*
   (Vorschlag „Nachfolge") und *audit* (Vorschlag „Prüfung nach dem Einbau")?

## Was nicht geprüft wurde

- Kein Alarm gerendert: die Testinstanz hatte keinen roten Post-Land-Audit; `.plaudit` ist nur aus
  dem CSS und `src/plaudit.ts` beurteilt.
- Das Gründungsfenster und der Explorer sind nicht fotografiert (der Klick auf einen leeren Slot
  fand in der `full`-Fixture keinen freien Platz); beide nur aus dem Code.
- Die ungeschützten localStorage-Lesezugriffe beim Laden sind aus dem Code gelesen (c), nicht mit
  blockiertem Speicher reproduziert.
- Queue-, Verlauf-, Schedule- und Share-Fenster nur stichprobenhaft; `src/hub.ts`, `src/share.ts`,
  `src/opsevents.ts` nicht nach weiteren Popovern durchsucht.
- Die deutschen Vorschlagswörter sind nicht am Owner-Wortschatz belegt (daher Frage 3).
- Das parallele Untermenü-Inventar (Zeile `d8e37852`) lag nicht vor; es sollte die Zahl der
  Popover/Menüs aus G4.1 (hier sieben) bestätigen oder erweitern — jede neu gefundene Fläche
  bekommt eine Zeile in der Tabelle, keine neue Regel.
- Die Demo nicht gebaut.

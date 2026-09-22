---
frage: Welche Menü-, Popover-, Panel-, Dialog- und Fensterflächen hat der Client, wie weit sprechen sie die --chat-*-Sprache, und welche Stellschrauben der Fleet gehören in ein Einstellungsmenü oben rechts?
urteil: 71 Flächen, davon sprechen nur die Aufgaben-Queue, der Composer samt Optionsleiste und das Instanz-Menü die --chat-*-Sprache; alle 14 `.overlay > .panel`-Dialoge und der gemeinsame Fensterrahmen stehen noch auf der alten Palette (#1d1d1d, --line, Radius 14), 36 native alert/confirm/prompt in src/client.ts, und zwei Handlungsfehler sind gemessen (⏏ öffnet am Handy UNTER der Schublade; „✕ delete" in der Queue löscht ohne Rückfrage). Stellschrauben: 23 Browser-Schlüssel (Klasse 0), 17 Server-Schalter mit Route, davon 8 ohne GUI (Klasse 1), 149 FLEET_*-Umgebungsnamen, die alle nur beim Start gelesen werden (Klasse 2/3); das Einstellungsfenster zieht mit Klasse 0 und den routenfertigen Klasse-1-Schaltern ein, Klasse 2 höchstens als Anzeige.
bereich: [client, untermenues, einstellungen]
belege: [src/shell.ts#openShell, src/client.ts#openQueue, src/client.ts#showLandReview, src/client.ts#setDrawer, src/client.ts#renderBoard, src/chatsize.ts#sizePanel, src/entcard.ts#attachEntityCards, server.ts#stateSnapshot, server/dir-explorer.ts#FILE_WRITE_DENY, watchdog.sh, public/index.html]
nicht-gemessen: Grammatik liegt nicht auf main (nur Branch a9cdb3ee) — Abweichungen gegen die --chat-*-Tokens gemessen; Alarm (.plaudit), Neu-Version-Knopf, Lightbox, Hub-/Teilen-/Helfer-Seite, Datei-Editor und Picker-Ordnerdetail nicht fotografiert; Touch-Verhalten der Hover-Karte nicht geprüft
stand: 2026-09-22
---

# Inventar aller Untermenüs und aller Stellschrauben

2026-09-22, Lane `fleet/260922031946-ff2c`, Baum `a2e15ae4`. Program „Oberfläche aus einem Guss"
(`0d51b4d4`), Zeile `d8e37852`. Frage: **Welche Flächen gibt es, wie weit weichen sie von der
App-Sprache ab, und was gehört in ein Einstellungsmenü oben rechts?**

Owner, wörtlich (2026-09-21): „eine vernünftige Überarbeitung aller Untermenüs usw." — „ein
Einstellungsmenü oben recht einführen, das wir dann langsam füllen, so das da wo es Sinn macht,
Claude Fleet soweit komplett über eine GUI konfiguriert werden kann" — zur Zieh-Band-Tiefe: „eine
variable in den einstellungen … die dann z.b nur die letzten 3 oder 5 session zurück anzeigt".

**Maßstab.** `docs/design/grammatik.md` liegt **nicht auf main** (`git show main:docs/design/grammatik.md`
→ fatal); sie steht fertig auf Branch `fleet/260922025219-743e` (`a9cdb3ee`, Zeile `8d7d47b7`) und
wartet auf das Land. Gemessen ist darum gegen die `--chat-*`-Tokens (`public/index.html`, `:root` mit
„Three size variables", dazu `--c-hover`, `--c-edge-hi`, `--r1`…`--r3`, `--t` im Board-`:root`).
**Grammatik ausstehend.** Wo eine Fläche schon eine Karte der ungelandeten Grammatik trifft, steht
deren Nummer (K1…K9) in der Vorschlagsspalte, damit die MAIN beim Abgleich nichts doppelt filt.

**Bilder.** Alle Pfade relativ zu `docs/messungen/2026-09-22-untermenue-bilder/`, Endung
`-1200.jpg` (1200 × 900) bzw. `-390.jpg` (390 × 844, Touch). Aufgenommen an einer eigenen
Testinstanz (`FLEET_TI_PORT=8886 FLEET_TI_SOCK=fleetti2ff2c ./testinstanz.sh up full`, danach
`fixtures mixed` und drei Aufgaben per `POST /api/tasks` an DIESE Instanz), Chromium per
`playwright-core`. Terminal-Text ist in jedem Bild ausgeblendet (`.xterm-screen` unsichtbar), weil
er Account- und Rechnernamen trägt; Pfade und Tailscale-Adressen im DOM sind längentreu ersetzt
(`ownerbox`, `100.x.y.z`); eine Probe über `document.body.innerText` je Bild fand danach 0 Treffer.

---

## Ergebnis in Zahlen

- **71 Flächen** in Tabelle A (A1 Leiste 17, A2 Pane/Composer 25, A3 Info-Spalte 14, A4 Fenster 15),
  jede mit einem gelesenen Öffner. 3 davon sind eigene Seiten (Hub, Teilen, Helfer). 44 Bilder.
- **In der --chat-*-Sprache:** die Aufgaben-Queue (`#shell-queue`, über 200 Regeln in
  `public/index.html` ab dem Selektor `#shell-queue {`), der Composer mit Optionsleiste
  (`.optpop`, `.cmd*`), das Instanz-Menü (`#instmenu`), die Info-Spalte über die Aliasse `--b-*`,
  die Schublade `#side`. **Alle anderen** tragen Literale oder die alte Palette
  (`--text --dim --line --raised --accent --sel`).
- **Zwei Materialien fehlen als Basis:** `.overlay > .panel` (14 Dialoge: `#attndlg #opsdlg #devdlg
  #autodlg #sharedlg #codexdlg #hist #gate` plus die sechs zur Laufzeit gebauten `.riskoverlay`-Dialoge aus
  `showRiskPreview`, `showCommitPreview`, `confirmMidRun`, `showVerifyOutput`, `showLandReview`, `confirmCommand`) mit `#1d1d1d`,
  `var(--line)`, Radius 14; und der Fensterrahmen `.shellwin` (alle sechs `openShell`-Fenster) mit
  denselben Werten. Nur `#shell-queue` überschreibt ihn.
- **Native Dialoge:** `rg -o '\b(confirm|prompt|alert)\(' src/client.ts` = 27 `alert`, 6 `confirm`,
  3 `prompt` (36).
- **Esc:** der globale Handler (`src/client.ts`, `window.addEventListener("keydown"` mit „the picker
  and the review window are src/shell.ts windows") schließt nur `#hist`, `#sharedlg`, `#autodlg` und
  die Schublade. `#attndlg`, `#opsdlg`, `#devdlg`, `#codexdlg` schließen nur per Außenklick oder
  eigenem Knopf; das Session-Menü `.bmenu` nur über seinen eigenen ⋯-Knopf.
- **Gemessener Fehler 1 (Handy):** ⏏ in der Zeilenaktion öffnet den Land-Dialog bei offener
  Schublade — `body.drawer` bleibt gesetzt, `.overlay.riskoverlay` hat `z-index 20`, `#side` 30
  (Playwright-Probe, Bild `29-handy-landen-unter-schublade-390`). Ursache: `showRiskPreview` ruft
  `setDrawer(false)`, `showLandReview`, `confirmMidRun`, `showCommitPreview` nicht
  (`sed` über die ersten 12 Zeilen je Funktion, 0 Treffer).
- **Gemessener Fehler 2:** „✕ delete" im Aufgaben-Detail (`src/client.ts#renderQueueDetail`,
  Abschnitt „⋯ done · archive · delete") ruft `qAct` direkt; die einzige Warnung ist die Hinweiszeile
  „there is no restore" (Bild `24-queue-mehr-1200`).

## A — Inventar der Flächen

Spalten: **Bild** (Präfix wie oben; „—" = nicht fotografiert) · **Öffner** (`datei#symbol` + Auslöser)
· **Abweichung Token** (Beispiele, `index.html`-Selektoren) · **Abweichung Sprache/Verhalten** ·
**Vorschlag** (ein Satz) · **Gr.** (S/M/L). Englisch in Anführungszeichen ist sichtbarer Text.

### A1 — Leiste, Kopf, Schublade

| # | Fläche | Bild | Öffner | CSS | Abweichung Token | Abweichung Sprache/Verhalten | Vorschlag | Gr. |
|---|---|---|---|---|---|---|---|---|
| 1 | Handy-Kopfleiste | 00-390 | Markup `#mhead`; `src/client.ts#setDrawer` über `#menu` | `#mhead #menu #mtitle #refresh` | `#1a1a1a`, `--line/--raised/--text`, Radius 8, `#mtitle` Mono | ☰ ↻ als Text; „sessions", „refresh session"; ↻ doppelt (`#refresh` + `.panereload`) | Chat-Tokens, `icon()`, ein ↻ (Grammatik K4) | S |
| 2 | Schublade + Abdunklung | 16-390 | `setDrawer` | `#side`, `body.drawer`, `#shade` | `#shade #0009` | Esc und Außenklick schließen — aber Dialoge ohne `setDrawer(false)` öffnen darunter (Fehler 1) | `setDrawer(false)` in jedem Dialog-Öffner | S |
| 3 | Leiste einklappen | 00-1200 | `setCollapsed` über `#collapse` | `#collapse` | Radius 7 | ‹ › Glyphen; „collapse sidebar" | `icon()`, `--r1` | S |
| 4 | Instanz-Menü | 01-1200, 01-390 | `renderInstanceHead` → `setInstMenu` über `#instbtn` | `#instmenu .instrow .instnote` | sauber (Vorbild der Grammatik) | „you are here", „open … (its own login)"; Env-Name `FLEET_INSTANCES` im sichtbaren Hinweis | Deutsch, Env-Name raus | S |
| 5 | Ansichts-Umschalter | 14-layout4-1200 | `#layouts button` | `#layouts` | sauber | „single pane", „2-up split"; am Handy verborgen | Deutsche Titel | S |
| 6 | Werkzeugzeile | 00-1200 | `paintHead`, `HEAD_BTNS` | `#sidetools .toolrow .hbadge` | `.hot` `#5a4a2a` + `--amber` | lange englische Titel; ⚠ im Geräte-Badge als Text | `.hot` → `--q-wait`, deutsche Titel | S |
| 7 | „⋯ mehr"-Fach | 04-1200, 04-390 | `morebtn.onclick` → `applyMore` | `#morepanel .morehead .bbtn` | `.bbtn` Board-Sprache | ⎇ 📂 Glyphen; Titel „mehr — open the panel of further board actions" halb deutsch | `icon()` | S |
| 8 | Hinweis „Eigener Knopf" (+) | 05-1200 | `plusBtn.onclick` | `#headplus .headnote` | Radius 8 | verschwindet nach 4 s, kein Esc | Radius `--r1` | S |
| 9 | Aufmerksamkeit 📣 | — (Fixture hat keine) | `renderAttnDlg` über `#attnbtn` | `#attndlg .attnrow .attnkind .attnta` | `.attnrow #171717/#232323`, `.attnkind.k-decision --accent` | natives `prompt()` bei „refuse"; **kein Esc**; „decision/blocked/review-ready" roh | Grundangabe als Feld im Dialog, Esc, Deutsch | M |
| 10 | Betriebs-Eingang 📥 | — | `renderOpsDlg` über `#opsbtn` | `#opsdlg`, `.attnrow` | wie 9 | **kein Esc**; „Operations — completions filed instead of typed into a pane"; `kind` roh („fleet-report") | Wörter statt `kind`, Esc | M |
| 11 | Hilfsgeräte 💻 | — | `renderDevDlg` über `#devbtn` bzw. `.smdev` | `#devdlg .bdev .bidmeta` | `.bdev #242424`, `.bidmeta #777` | 2× `alert()`; **kein Esc**; „Helper devices" neben „wecken" | Meldung im Dialog, Esc, eine Sprache | M |
| 12 | Datensparer | 00-1200 | `setSaver` über `#saverbtn` | `#saverbtn.active` | `#5a4a2a` | Zustand steht nur im Titel | sichtbarer Zustand + `aria-pressed` | S |
| 13 | Session-Zeile + Hover-Leiste | 13-slothover-1200 | `slotRow`, `.slotact` | `.slot .r1 .slotact .kill .revb .autobadge` | `.slot` Radius 12 (abgenommen, bleibt), `.kill` Radius 5 | ✕ ⏱ ⏸ 💬 Glyphen; „land", „shelve" | `icon()` (Grammatik K9) | M |
| 14 | Handy-Zeilenaktionen | 28-390, 29-390 | `slotRow` → `.rowacts` | `.rowacts .rowact` | sauber | Nur Glyphen ⤴ ⇩ ✎ ✔ ⏏ ⇲; ✔ bei sauberem Baum = natives `alert` (gemessen); ⏏ unter der Schublade (Fehler 1) | Wort unter der Glyphe, Dialoge über der Schublade | M |
| 15 | Umbenennen (inline) | — | `startRename` (Doppelklick, ✎) | `.renamein` | sauber | Esc/Enter richtig | nichts | — |
| 16 | Session beenden | 27-slotkill-1200 | `.kill.onclick` → `showRiskPreview` (Lane) bzw. `confirm()` (Haupt-Session) | `.riskoverlay .riskpanel .riskbtn` | `.risklist #141414`, `.riskbtn --line/--raised`, `.danger #5e2c3a` | zwei Wege für dieselbe Handlung; „cancel/kill" | ein Dialog für beide (Grammatik K3) | S |
| 17 | Zugangs-Token | 15-gate-1200, 15-390 | `showGate` bei 401 | `#gate #gatein` | `#gatein --line/--raised/#eee`, Radius 9 | „Access token", „Paste the fleet token…" | Chat-Tokens, Deutsch | S |

### A2 — Pane und Composer

| # | Fläche | Bild | Öffner | CSS | Abweichung Token | Abweichung Sprache/Verhalten | Vorschlag | Gr. |
|---|---|---|---|---|---|---|---|---|
| 18 | Pane-Eckknöpfe ↻ ℹ 💬 | 00-1200 | `Pane`-Konstruktor | `.panereload .boardtoggle .viewtoggle` | `rgba(38,38,38,.85)`, `--line --dim --accent`, Radius 7 | „reload this session (reconnect + reseed scrollback)"; ℹ-Titel nennt noch „📋 summary" | Grammatik K4 | S |
| 19 | Sprung zum Prompt ↑↓ | 08-1200 | `Pane`-Konstruktor | `.promptnav` | wie 18, in Ruhe blau | „previous prompt of yours" | Grammatik K4 | S |
| 20 | Schriftgröße „Aa" | 09-1200 | `Pane`-Konstruktor | `.chatsizebtn` | wie 18 | deutscher Titel (einziger) | Grammatik K4 | S |
| 21 | Schriftgrößen-Panel | 09-1200, 09-390 | `src/chatsize.ts#sizePanel` | `.sizepanel .sizerow .sizereset` | `rgba(12,12,14,.97)`, Radius 12/7 | Esc + Außenklick richtig; am Handy feste `top:102px` | wird Abschnitt „Schrift" im Einstellungsfenster (Grammatik K8) | S |
| 22 | Nach-unten-Knopf | 08-390 | `Pane` | `.jump` | `#444`, `rgba(30,30,30,.7)` | ▼, kein Titel | `icon()`, Tokens | S |
| 23 | Hover-Karte | 23-entcard-1200 | `src/entcard.ts#attachEntityCards` | `.entcard` (zweimal deklariert), `.ent` | `rgba(12,12,14,.97)`, Radius 12, `.ent:hover #1b2233` | nur Hover/Fokus, Touch ungeprüft | Grammatik K1 | S |
| 24 | Composer | 08-1200 | `mountComposer` | `#comp #input #send` | redeklariert `--r1..3`, `--c-hover` lokal | „Prompt for slot N… (Enter sends)" | lokale Doppeldeklaration löschen | S |
| 25 | Park-Hinweis | — | `renderParkHint` | `#comppark` | sauber | ⏳ Emoji | `icon()` | S |
| 26 | Modell-Popover | 10-modell-1200, 10-390 | `optSwitch("model")` | `.optpop .cmdmodel .cmdinput .cmdapply` | `.cmdapply #000`, `.cmdstatus` Mono für Prosa | „Apply"; Esc + Außenklick richtig (Vorbild) | Deutsch | S |
| 27 | Effort-Popover | 10b-effort-1200 | `optSwitch("effort")` | `.cmdlevels .cmdlevel` | sauber | „default" | Deutsch | S |
| 28 | Modellwechsel-Rückfrage | — | `optConfirm` | `.optconfirm` | sauber | „Don't show again" ohne Rückweg (`fleet.modelSwitchWarn`) | Rückweg im Einstellungsfenster | S |
| 29 | Befehls-Popover ⌘ | 10c-befehl-1200 | `commandSwitch` | `.optpop.cmds .cmdline` | sauber | „⌘ 4" erklärt sich nicht; ⚠ als Text | Wort statt Zahl | S |
| 30 | Befehls-Rückfrage | — | `confirmCommand` | `.riskoverlay .bmidrun` | wie 16 | „Send /x to slot N?" | Grammatik K3 | S |
| 31 | Cache-Alter | 10-modell-1200 | `tickCacheAge` | `.optage` | sauber | Erklärung nur im Tooltip („TTL"), kein Touch-Weg | Kurzwort sichtbar | S |
| 32 | Tray | 08-1200 | `buildTray`, `TRAY` | `#comptray` | Hover `#141416` | „Files/History/Schedule/Live"; „Files" öffnet nur den Datei-Wähler des Systems | `--c-hover`, Deutsch | S |
| 33 | Prompt-Verlauf | 11-history-1200, 11-390 | `openHist` über `#histbtn` | `#hist .histrow .histcopy` | `.histrow --raised --text`, Radius 7, `.histcopy --accent` | ⧉ ✓ Glyphen; „this session/all sessions" | Chat-Material (Karte D-2) | M |
| 34 | Zeitplan | 12-schedule-1200, 12-390 | `renderAutoDlg` über `#autobtn` | `#autodlg .autorow .autoform` | `#171717/#232323`, `.autopreview #141414` | ⏸▶✕ Glyphen; „Scheduled prompts", „once/recurring" | Chat-Material (D-2) | M |
| 35 | Live-Zeile | 22-live-390 | `setLive` über `#live` | `#livebar #livein` | `#livein --raised`; zwei „an"-Regeln (`#live.on --amber`, spezifischer `#comptray > #live.on --c-hover` gewinnt) | Tray-Eintrag nur bei grobem Zeiger | eine „an"-Regel | S |
| 36 | Tastenreihe | 00-390 | `#keys` | `#keys button` | `--line --raised --sel --accent`, Radius 7/8 | — | Chat-Tokens | S |
| 37 | Befehls-Chips | — | `renderChips` | `.chip` | `--sel --accent #10131c` | — | Chat-Tokens | S |
| 38 | Ablegen-Fläche | — | Drag-Handler | `#droplay` | `#0a1424dd`, `--accent` | „Drop to hand the file to this session" | Tokens, Deutsch | S |
| 39 | Bild-Lightbox | — | `openLightbox` | `.lightbox` | Radius 10 als Literal | Esc richtig | `var(--r2)` | S |
| 40 | Neu-Version-Knopf | — | `armReload` | `#newver` | `#3c5488 #1b2438 #cfe0ff`, Radius 999 | „a newer version is ready — reload" | Chat-Material, Ecke bleibt | S |
| 41 | Post-Land-Alarm | — (kein rotes Audit in der Fixture) | `renderPostLandAudit`, `src/plaudit.ts#postLandAlarm` | `.plaudit .plahd` | 14 Hex-Literale | fixiert über der Seite; VERSALIEN; „acknowledge" ohne Rückweg | Grammatik K7 | M |
| 42 | Fehler-Toast | — | `toast()` (27 Aufrufe) | Inline-`cssText` | `#fff`, `rgba(0,0,0,.4)`, Radius 6, `z-index 9999` | englische Meldungen, 2,6 s, kein Schließen | Klasse mit Tokens | S |

### A3 — Info-Spalte (`#board`; am Handy verborgen, `renderBoard` kehrt bei `isMobile()` zurück)

| # | Fläche | Bild | Öffner | CSS | Abweichung Token | Abweichung Sprache/Verhalten | Vorschlag | Gr. |
|---|---|---|---|---|---|---|---|---|
| 43 | Spalte + Kopf | 07-info-1200 | `setBoard` über `.boardtoggle` | `#board #boardhead #boardclose` | tote Altregeln `#boardclose --line --raised` vor dem Alias-Block | „Session brief", „close brief"; am Handy nicht erreichbar (ℹ verborgen) | Kopf „Info", Altregeln löschen, Handy-Weg (Grammatik G6.2) | S |
| 44 | Suite-Strecke | 07-info-1200 | `renderSuiteMeter` | `.smhead … .smst` | `#2e2e2e #262626 #050505 #222`, viele `rgba(255,…)` | „Suites", „waiting/running/on helper/done", „mac only" | Glas-Farben als Token, Owner-Worte (K9) | M |
| 45 | Gate-Anzeige (aufgeklappt) | — | `gateSection` über `.smtog` | `.smdetail` | `#0a0a0a`, Radius 8, Mono für Prosa | „pid …", „identity proven/mismatch" | Prosa in Sans | M |
| 46 | Maschinenhinweise deploy/Fehler | — | `deploySection`, `errorsSection` | `.balert` | `rgba(224,175,104,.07)`, Radius 8 | Befehl als Text („restart srv"); Fehlerzeile ist ein `div` ohne Tastaturweg | `button`, Folge + Handlung | S |
| 47 | Kopf/Identität + Nachfolge-Zeilen | 07-info-1200 | `renderBoard`, `srow` | `.bhead .bsrow .bskey .bsval` | `.bheadname #f4f4f4`, `.bchip` Radius 4 | „Fill/Handover/Rail/Baton", Tooltip nennt `FLEET_LANE_SUCCEED_MAX` | Grammatik K9 | S |
| 48 | Session-Menü ⋯ | 17-infomenue-1200 | `mbtn.onclick` → `boardMenuOpen` | `.bmenu .bmenuitem` | Radius 8/5 | **kein Esc, kein Außenklick**; „Bring session back" per `confirm()`+`alert()`; „Copy worktree path / Share… / Export / Rename" | Popover-Helfer (Grammatik K5) | M |
| 49 | Setup + Kontextpakete-Chip | 07-info-1200 | `renderBoard` „Setup" | `.bsetup .bspack` | `.bspack` Radius 4 | „Setup", „Profile" | Radius `--r1` | S |
| 50 | Änderungen (Commit/Diff/Rebase/Land/Shelve/Undo) | 07-info-1200 | `renderBoard` | `#board .bbtn .buncf .bmergenote .vbadge` | `#2c4a5e #1c2c37`, `.vbadge #12210f #5e2c34` | Land/Shelve/Undo/Commit über native `alert/prompt/confirm`; „merge INTERRUPTED" | Rückfragen als Dialog (K3), Badges als Token | L |
| 51 | Risiko-/Land-/Commit-/Mittendrin-/Verify-Dialog | 27-slotkill-1200, 29-390 | `showRiskPreview`, `showLandReview`, `showCommitPreview`, `confirmMidRun`, `showVerifyOutput` | `.riskoverlay .riskpanel .landreviewpanel .difftxt .bmidrun` | wie 16; `.difftxt #101010` | vier von fünf ohne `setDrawer(false)`; „cancel/commit anyway/retry"; „suite mutex", `git add -u` | ein Dialog-Helfer (K3) + Schublade schließen | M |
| 52 | Verlauf / Dateien / Prompts (Reiter) | 07-info-1200 | `renderBoard`, `fileTreeSection`, `boardFold` | `.brow .bfile .bfoldhd .fxtree` | `#c9c9c9` | „History", „Open explorer", „Re-read", „Your prompts" | `--chat-prose`, Deutsch | S |
| 53 | Lanes-Abschnitt + Verwerfen-Bestätigung | 07-info-1200 | `renderBoard`, `discardArm` | `.bwt .bwtact .bdiscard` | `.bwt #aaa`, `.bdiscard #5e2c3a`, Radius 8 | Ergebnis per `alert()`; ☠ Glyphe | Ergebnis im Abschnitt | M |
| 54 | Hilfsgeräte-Abschnitt (ohne Fokus-Pane) | — | `devicesSection` | `.bdev .bidmeta` | `#777` | „helper devices" | mit 11 | S |
| 55 | Teilen-Dialog | — | `openShareDlg` (⋯ „Share…", 💬 in der Zeile) | `#sharedlg .shrline .shrbtn .shrcmt` | `.shrline code #141414`, `.shrbtn.primary --accent` | 2× `confirm()`; 💬 Emoji | Chat-Material (D-2) | M |
| 56 | Codex-Bindung | — | `openCodexDlg` über `.needline` (Zeile 5 „Codex lost track…", 00-1200) | `#codexdlg .cxrow` | `#171717`, `.cxrow code #c5d4f5` | **kein Esc**; „Bind Codex conversation", „Recovery state: …" | Esc, Deutsch (D-2) | S |

### A4 — Fenster (`src/shell.ts#openShell`) und eigene Seiten

| # | Fläche | Bild | Öffner | CSS | Abweichung Token | Abweichung Sprache/Verhalten | Vorschlag | Gr. |
|---|---|---|---|---|---|---|---|---|
| 57 | Fensterrahmen (alle sechs) | 06-queue-1200 | `src/shell.ts#openShell` | `.overlay.shell .shellwin .shellhead .shellclose .shellrow` | `.shellwin #1d1d1d --line` Radius 14; `.shellrow.sel --sel` | ‹ ✕ Glyphen; „close (Esc)"; Esc + Außenklick richtig; Handy-Vollbild richtig | Chat-Werte aus `#shell-queue` auf `.shellwin` heben (D-2) | M |
| 58 | Aufgaben-Fenster | 06-queue-1200, 06-390 | `openQueue` über `#queuebtn` | `#shell-queue` | Chat-Sprache (Referenz); Rest: `.qdtext` Mono für Prosa | „Task queue"; 🗒 | Referenz behalten | S |
| 59 | › Ansichten + Werkzeugzeile | 06-queue-1200 | `openQueue` | `.qview .qnewbtn .qbundlebtn .qlayoutbtn` | Basisregeln alte Palette, nur unter `#shell-queue` überschrieben | „Work/Notes/Programs/History/Waves", ＋ ⧉ ⇥ | Chat-Werte in die Basisregel | S |
| 60 | › Aufgaben-Detail + Aktionen | 20-queuedetail-1200, 20-390 | `renderQueueDetail` über `qSelect` | `.qd2 .qdrail .qlife .shrbtn.qact` | sauber | „pending → queued → sent"; „release ▸", „clarify first", „refine" | Deutsch (Grammatik-Frage 3) | M |
| 61 | › Löschen | 24-queue-mehr-1200 | `mk("✕ delete")` → `qAct` | `.shrbtn.danger` | sauber | **löscht ohne Rückfrage** (Fehler 2) | zweistufig: scharf machen, dann löschen (D-1) | S |
| 62 | › Programm-Detail | — | `renderProgramDetail` | `.ocfacts .occhip .pkdwarn` | `.occhip #1c1c1c/#2e2e2e/#aaa` nicht überschrieben | Routen-Prosa „POST /api/programs/…/bootstrap-main"; „grant green-only" | Owner-Worte statt Routen | M |
| 63 | › Dispatcher-Fuß | 06-queue-1200 | `openQueue` | `.qdisp` | Basis `--dim` | Env-Name im Text „set FLEET_DISPATCH_REPO…" | Satz ohne Env-Namen | S |
| 64 | Aktivität (Lands/Commits/Audit/Akte) | 02-audit-1200, 03-aktivitaet-1200, je -390 | `openActivity` über `#auditbtn` 🛡, `#outcomebtn` 🧾, ⋯ mehr | `#shell-outcomes .actlens .auditctl .occhip .ocdispo-btn` | `.shrbtn.active --accent #1c2437`, `.occhip.rel-* #7dcfff #bb9af7` | „Outcome feed", „Audit trail", „③ coverage", ✓ ✗ ohne Wort; Linsen ohne `aria-pressed` | Chat-Override wie Queue, Linsen = `.qview` (D-2, K6) | M |
| 65 | Dateien-Fenster + Datei-Ansicht | 18-explorer-1200 | `openExplorer` („Open explorer"), `showFileView` | `#shell-files .fxrow .fvback .pkfilterin` | `.fxrow:hover #242424`, `.sel #1c2437`, `.fvback --accent` | „Files", „Pick a file on the left…" | Chat-Tokens (D-2) | M |
| 66 | › Datei-Editor | — | `openFileEditor` („✎ edit this file") | `.fvedit-ta` | `#101010 --sel`, Fokus `--accent` | `confirm()` beim Verwerfen | Inline-Rückfrage | S |
| 67 | Review-Fenster | 19-review-1200 | `openReview` („View diff", Datei-/Commit-Zeilen) | `#shell-review .rvhead .shrbtn` | `.shellrow.ctx #232a3a`, `.rvsub #9aa7c7` | „⏏ land" schließt das Fenster und meldet per 3× `alert()`; Quellen-Umschalter ohne `aria` | Ergebnis im Fenster, Umschalter = `.qview` | M |
| 68 | Kontextpakete-Fenster | — | `openPacks` (Setup-Chip) | `#shell-packs .cpkrow .cpksrc` | `#e6e6e6`, `.cpksrc #0a0a0a` Radius 8 | „Context packs", „omitted" | zwei Literale tauschen | S |
| 69 | Gründungsfenster (Picker) | 25-picker-1200, 25-390 | `openPicker` über `.slot.empty` („free · start a session") | `#shell-picker .pkfilterin .pkpathin .pktoggle .pkrow` | `.pkfilterin #1a1a1a` Radius 9, `.pkpathin` Mono, `.pktoggle.on #2a2320` | „New session — slot N", „⎇ hide lanes", „start ▸"; 3× `alert()`; `PK_ICONS` vom Security-Pin gehalten | Chat-Override `#shell-picker` | M |
| 70 | › Ordner-Detail + Harness-Wahl | — | `showDirDetail`, `appendSpawnOptions` | `.pkdopts .pkdsel .pkdin .pkdwarn` | `.pkdsel/.pkdin` Mono + `--text` | „harness/model/effort", „Start session here" | mit 69 | S |
| 71 | Eigene Seiten Hub · Teilen · Helfer | — | `src/hub.ts`, `src/share.ts`, `src/helper.ts` (`public/*.html`) | je eigenes `:root` | alte Namen `--text --dim --accent --sel`, Mono-Body | Teilen: ✨ ➤ ⟳ Glyphen, Passwort-Tor ohne Esc (gewollt); Helfer ohne Handy-Regel | eigener Schnitt, nicht in diesem Program | L |

**Keine Flächen** (gelesen und verworfen): Zwischenablage-`textarea` (`src/client.ts`, erste
`document.body.appendChild`), `#qrepodl` (`<datalist>`), `.panehint`, der Tray-Eintrag „Files"
(System-Dialog), `quickLaneChip`/`laneCountChip`/`repoHeaderRow` (Umschalter ohne Fläche),
`public/landing.html` (keine Knöpfe).

---

## B — Inventar der Stellschrauben

### Klasse 0 — Schalter im Browser (`localStorage`), 23 Schlüssel, 46 Aufrufstellen

`rg -n "localStorage" src/` = 51 Zeilen, davon 5 Kommentare. Nur 5 Schlüssel sind mit try/catch gelesen;
ungeschützte Lesezugriffe beim Laden des Moduls in `src/client.ts` (`fleet.datasaver`,
`fleet.board`, `fleet.hidewt`), `src/share.ts`, `src/helper.ts` — bei gesperrtem Speicher lädt die
Seite nicht (aus dem Code gelesen, nicht reproduziert).

| Schlüssel | Wirkung | Eigener Schalter heute | Einstellungsfenster? |
|---|---|---|---|
| `fleet.chatsize` | Schrift, Code, Oberfläche, Breite | Aa-Panel | **ja, Abschnitt „Schrift"** |
| `fleet.datasaver` | Datensparen (seltener abfragen) | 🐢 | **ja** |
| `fleet.modelSwitchWarn` | Warnung vor Modellwechsel aus | „Don't show again" — ohne Rückweg | **ja (Rückweg)** |
| `fleet.plaudit.ack` (`src/plaudit.ts#PLA_ACK_KEY`) | Alarm quittiert | „acknowledge" — ohne Rückweg | **ja (Rückweg)**; Pin in `e2e/outcomes.ts` beachten |
| `fleet.hidewt` · `fleet.pkdot` | Picker: Lanes/Dot-Ordner verbergen | im Picker | ja, als Standardwert |
| `fleet.queue.scope` | Queue als Baum oder Zeile | in der Queue | ja, als Standardwert |
| `fleet.histall` | Verlauf: alle Sessions | im Verlauf | ja, als Standardwert |
| `fleet.sidecollapsed` · `fleet.board` · `fleet.board.folds` · `fleet.meter.open` · `fleet.more` · `fleet.stacks.closed` · `fleet.view` · `fleet.pkdir` | Auf-/Zu-Zustände, Layout, letzter Ordner | am Ort | nein — Zustand, keine Einstellung; nur „alles zurücksetzen" |
| `fleet.current` · `fleet.stacks` | Altschlüssel | — | nein (aufräumen) |
| `fleetShareFont` · `fleetShareName` · `fleetShareSide` | Teilen-Seite (Gast) | dort | nein — andere Seite, anderer Leser |
| `fleetHelperDevice` · `fleetHelperClaim` | Helfer-Portal | — | nein |
| *(kommt)* Zieh-Band-Tiefe (`25d9ac1e`) | wie viele Vorgängerinnen das Band zeigt | — | **ja**; heute `src/client.ts#DEPTH = Infinity`, gelesen an genau einer Stelle (`bandReach`) |
| *(kommt)* Lupe (`d5a399ff`) | Hover-Karten für Referenzen an/aus, auch im Terminal | — | **ja**; Voreinstellung an/aus |

### Klasse 1 — Zustand in `fleet.json` mit Route, 17 Schalter

Geschrieben von `server.ts#stateSnapshot`; Owner-Routen hinter `tokenGate`. Stichprobe gegen den
Code: `rg -c -F '"<route>"' server.ts` je 1 Treffer, `rg -c -F '<route>' src/client.ts` wie in der
Spalte „GUI".

| Schalter | Route | GUI heute |
|---|---|---|
| Dispatcher an/aus | `POST /api/dispatch` | ja (Queue-Fuß) |
| **Automatische Prompts: Not-Aus** (`autosOn`) | `POST /api/autos/switch` | **nein** |
| **Ruhezeiten** (`quietHours`) | `POST /api/autos/quiet` | **nein** |
| **Integrations-Branch je Repo** (`repoBases`) | `POST /api/repo-base` | **nein** |
| **Lane-Deckel je Repo** (`repoLaneCaps`) | `POST /api/repo-lane-cap`, `GET /api/repo-lane-caps` | **nein** |
| Worker je Repo (`repoWorkers`: `commitMsg`, `audit`) | `POST /api/repo-worker`, `GET /api/repo-workers` | nein — speichert einen **Befehl**, gehört wie Klasse 3 nicht in ein Formular |
| Program: Dispatch, Promotion (Self-Land), Profil | `POST /api/programs/:id/{dispatch,promotion,profile}` | ja (Programm-Detail) |
| Program ↔ Studio | `POST /api/programs/:id/studio` | **nein** |
| Slot: Modell/Effort | `POST /api/slots/:n/model` | ja (Composer) |
| Slot: Mission · Schlafen/Wecken | `POST /api/slots/:n/{mission,sleep,wake}` | **nein** (Handler von sleep nicht gelesen) |
| Slot: Zurücklegen | `POST /api/slots/:n/shelve` | ja |
| Picker-Pins | `POST /api/pins` | ja |
| Helfergerät-Modus | `POST /api/helper/devices/:id/mode` | ja |
| Autos je Slot | `POST /api/slots/:n/autos` u. a. | ja (Zeitplan) |

`/api/settings` oder `/api/config` gibt es nicht.

### Klasse 2 — `.env` / `watchdog.sh`, Neustart nötig

`rg -o 'process\.env\.(FLEET_[A-Z_]+)' -r '$1' server.ts server/*.ts --no-filename | sort -u | wc -l`
= **149** Namen (darunter 14 `FLEET_TEST_*`-Nähte). **Keiner wird zur Laufzeit neu gelesen.** Zwei
Wege, zwei Kosten:
- **In `.env`** gesetzt: srv-Neustart genügt, weil `watchdog.sh` beim Start des srv-Fensters `.env`
  neu einliest (`set -a; . ./.env`); `POST /api/deploy` macht diesen Neustart.
- **Inline in `watchdog.sh`** (heute 12: `FLEET_VERIFY_CMD`, `_VERIFY_TIMEOUT_MS=480000`,
  `_VERIFY_WAIT_MS`, `_POSTLAND_AUDIT_CMD`, `_POSTLAND_AUDIT_TIMEOUT_MS`, `_CLEAN_REVIEW=off`,
  `_HARNESS_AUTOMATION=1`, `_AUTO_REVIEW_MS=0`, `_AUDIT_PING_MS`, `_DISPATCH_REPO`,
  `_DISPATCH_MAX_LANES=1`, `_LANE_AUTOCLOSE=1`): nur `launchctl kickstart -k …watchdog` (so steht
  es in der Datei selbst).

Themen (Anzahl grob, Namen im Code nachschlagen): Dispatch und Deckel (`FLEET_DISPATCH_MAX_LANES`,
`_PER_PROGRAM`, `FLEET_PROGRAM_MAX_*`, `FLEET_LANE_SUCCEED_MAX`, Steward-Raten), Gate/Audit-Budgets
(`FLEET_VERIFY_*_MS`, `FLEET_POSTLAND_AUDIT_*_MS`, `FLEET_MERGE_*`), Helfer (`FLEET_HELPER_*_MS`,
`FLEET_DEVICE_ONLINE_MS`), Modelle (`FLEET_MODEL`, `FLEET_CARD_MODEL`, `FLEET_SUMMARY_MODEL`),
Takte (`FLEET_*_TICK_MS`, `FLEET_MIGRATE_PCT`, `FLEET_LANE_MIGRATE_PCT`, `FLEET_STALLED_IDLE_MS`).
Totes Config: `FLEET_ARENA_HOST` steht in `.env`, kein Servercode liest es (nur `attic/`).

### Klasse 3 — gehört nie in eine GUI

| Werte | Warum |
|---|---|
| `FLEET_TOKEN`, `FLEET_INTAKE_SECRET`, `FLEET_PI_ZAI_KEY_FILE` | Geheimnis oder Ort eines Geheimnisses |
| `FLEET_HOST`, `FLEET_PORT`, `FLEET_ALLOWED_HOSTS`, `FLEET_SHARE_*`, `FLEET_SITE_URL`, `FLEET_INSTANCES`, `FLEET_HUB_REMOTE`, `FLEET_HELPER_WAKE_ADDR`, `FLEET_HELPER_MAC_*` | Adressen: ein falscher Wert sperrt dich aus dem eigenen Dashboard aus |
| `FLEET_CMD`, `FLEET_VERIFY_CMD`/`VERIFY_CMD`, `FLEET_VERIFY_CMD_REPOS`, `FLEET_POSTLAND_AUDIT_CMD`, `FLEET_DEPLOY_*_CMD`, alle `FLEET_*_CMD`, `FLEET_CODEX_EXEC_BIN`, `repoWorkers` | Befehlszeilen: ein Formular wäre ein Befehls-Ausführer; `VERIFY_CMD` ist zudem in `e2e/pins.ts` gepinnt |
| `FLEET_REPO_DIR`, `FLEET_DISPATCH_REPO`, `FLEET_TRAIL_DIRS`, `FLEET_*_AGENT_DIR`, `FLEET_SUITE_LOCK`, `FLEET_SOCK` | Pfade und Socket: entscheiden, welcher Code läuft; ein falscher Socket übernimmt die Live-Panes |
| `FLEET_TEST_*`, `FLEET_SUITE_LOCK_HELD_BY` | Test-Nähte |

**Beobachtung, kein Vorschlag:** `POST /api/file/write` (Owner-Token, Datei-Editor im
Dateien-Fenster) sperrt per `server/dir-explorer.ts#FILE_WRITE_DENY` nur `.env*`, `fleet.json` und
`.git` — `watchdog.sh` ist über den Editor heute schreibbar, sofern ein Slot auf dem Fleet-Checkout
steht. Kosten: ein Tippfehler dort trifft erst beim nächsten `kickstart` und fällt dann den
byte-genauen Pin `RULE_VERIFY`. Ob das gewollt ist, entscheidet die Zeile, die die Klassen
festschreibt; hier wird keine Schreibroute vorgeschlagen.

---

## C — Gerüst für das Einstellungsmenü oben rechts

**Ort.** Ein Zahnrad; Grammatik G5 (ungelandet) setzt es als rechtesten Eckknopf der Pane an der
oberen rechten Fensterecke, mobil in `#mhead` rechts auf den Platz des doppelten `#refresh`. Diese
Notiz übernimmt das und stellt die Ortsfrage nicht neu (Grammatik-Frage 2 ist offen).
**Form.** Ein `src/shell.ts#openShell`-Fenster (`id: "settings"`) — Esc, Außenklick, Handy-Vollbild
und Zurück-Pfeil kommen mit dem Rahmen; Material nach D-2.

**Aufbau — drei Abschnitte, von oben nach unten:**

1. **Dieses Gerät** (Klasse 0, sofort wirksam, `localStorage` über die Registry aus Grammatik K2):
   Schrift (das heutige Aa-Panel als Zeilen) · Datensparen · Zieh-Band-Tiefe (alle / 3 / 5 / 10;
   schreibt den heute festen `DEPTH`) · Lupe an/aus als Voreinstellung · „Warnung vor
   Modellwechsel" zurückholen · „Alarm-Quittung zurücknehmen" · Standardwerte für Picker, Queue-Form,
   Verlauf · „Ansicht zurücksetzen" (Klapp-Zustände, Layout).
2. **Fleet** (Klasse 1, wirkt für alle Geräte, jede Zeile mit dem Satz „gilt für alle Sessions"):
   erste Bewohner sind die vier Schalter, deren Route es gibt und die keine GUI haben —
   Automatische Prompts Not-Aus, Ruhezeiten, Lane-Deckel je Repo, Integrations-Branch je Repo —
   dazu der Dispatcher-Schalter als zweiter Zugang (erster bleibt der Queue-Fuß). Nicht hierher:
   `repoWorkers` (Befehl), Slot- und Program-Schalter (die leben an ihrem Ding).
3. **Diese Maschine** (Klasse 2, **nur Anzeige**): die Zahlen, die der Owner heute per SSH liest —
   Lane-Deckel gesamt (`FLEET_DISPATCH_MAX_LANES`), Gate-Budgets (`timeoutMs`/`waitMs`, die
   `GET /api/self/gate` für Lanes schon liefert), Migrations-Schwellen, Standardmodell — jede mit dem
   Satz „ändern: `.env` + Neustart" bzw. „`watchdog.sh` + kickstart".

**Sicherheitsurteil.** Klasse 3 erscheint nicht, auch nicht als Anzeige. Klasse 2 erscheint nur
über eine im Code fest verdrahtete **Positivliste** von Namen (nie „alle `FLEET_*`"), nur lesend,
nur hinter dem Owner-Token; sie braucht eine Leseroute, die es heute nicht gibt — das ist Bau, keine
Konfiguration, und darum eigene Karte D-5 unter der Schnittlinie. Eine Schreibroute auf `.env` oder
`watchdog.sh` wird hier nicht vorgeschlagen.

---

## D — Karten-Vorlagen (nicht gefilt; die MAIN filt)

Abgleich: die ungelandete Grammatik trägt K1–K9. K2 (Registry) + K8 (Einstellungsfenster „Dieses
Gerät"/„Schrift") stehen als Zeile `25c33089`, die Band-Tiefe als `25d9ac1e` (NACH `25c33089`), die
Lupe als `d5a399ff`. Die fünf Vorlagen unten decken, was dort **fehlt**.

**D-1 · Folgenreiche Handlungen: sichtbar und rückfragbar** (Rang 1 — zwei gemessene Fehler)
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: klein
- FLAECHE: src/client.ts
- DONE: (a) `showLandReview`, `confirmMidRun`, `showCommitPreview`, `showVerifyOutput`, `confirmCommand` schließen am Handy die Schublade wie `showRiskPreview` — Playwright bei 390 px: nach ⏏ in `.rowacts` ist `body.drawer` false und das Overlay sichtbar; (b) „✕ delete" im Aufgaben-Detail verlangt einen zweiten Klick („wirklich löschen") und ein Esc/Timeout entschärft; (c) `#attndlg`, `#opsdlg`, `#devdlg`, `#codexdlg` schließen auf Esc (im globalen Handler neben `hist`/`sharedlg`/`autodlg`).
- VERIFY: pins · Suite-Offer mit `FLEET_E2E_MODULES` für die Queue-Familie · Screenshot 390 px vorher/nachher
- VERBOTEN: native `confirm()` für (b) · neue Dialog-Basis bauen (das ist K3) · Material ändern

**D-2 · Fenster und Altdialoge ins Chat-Material** (Rang 2)
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: mittel
- FLAECHE: public/index.html · src/shell.ts
- NACH: Grammatik-Land (`8d7d47b7`)
- DONE: `.shellwin`, `.shellhead`, `.shellclose`, `.shellrow(.sel)` und `.overlay > .panel` tragen die Werte, die heute nur unter `#shell-queue` stehen (`--chat-surface`/`--chat-raised`, `--chat-edge`, `--r2`, `--c-hover`); die Overrides unter `#shell-queue`, die danach gleich sind, fallen weg; die Flächen 9–11, 17, 33, 34, 55–57, 64, 65, 67–70 dieser Notiz zeigen bei 1200 und 390 px kein `#1d1d1d`/`--line`/Radius 14 mehr (Probe: `getComputedStyle` je Fläche); Queue sieht pixelgleich aus.
- VERIFY: pins · Screenshots der genannten Flächen gegen dieses Bilderset · Demo `bun run typecheck`
- VERBOTEN: Beschriftungen ändern (das ist K9) · `.slot` anfassen · `PK_ICONS` (Security-Pin)

**D-3 · Einstellungsfenster, Abschnitt „Fleet"** (Rang 3)
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: mittel
- FLAECHE: src/client.ts
- NACH: 25c33089
- DONE: das Einstellungsfenster aus `25c33089` hat einen Abschnitt „Fleet" mit genau fünf Zeilen über bestehende Routen — Dispatcher (`/api/dispatch`), Automatische Prompts (`/api/autos/switch`), Ruhezeiten (`/api/autos/quiet`), Lane-Deckel je Repo (`/api/repo-lane-cap`), Integrations-Branch je Repo (`/api/repo-base`) —, jede zeigt den Serverwert nach dem Setzen neu gelesen und trägt den Satz, was sie für alle Sessions heißt; e2e-Check je Zeile: Setzen über die GUI ändert den Wert in `GET` der Route.
- VERIFY: pins · Suite-Offer mit dem neuen Check · Screenshot 1200/390
- VERBOTEN: neue Server-Route · `repoWorkers` in ein Formular · irgendein Klasse-2/3-Wert

— Schnittlinie: D-1 bis D-3 erfüllen die beiden Owner-Sätze (Untermenüs überarbeiten, Einstellungsmenü füllen). D-4 und D-5 sind Rest. —

**D-4 · Info-Spalte: Session-Menü und Altlasten** (Rang 4)
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: mittel
- FLAECHE: src/client.ts · public/index.html
- NACH: K5 (Popover-Helfer)
- DONE: `.bmenu` benutzt den Popover-Helfer (Esc, Außenklick, Fokus zurück); „Bring session back" fragt im Dialog statt `confirm()`/`alert()`; die toten `#boardclose`-Altregeln vor dem `--b-*`-Aliasblock sind gelöscht; die Fehlerzeile in `errorsSection` ist ein `button`.
- VERIFY: pins · Screenshot `17-infomenue` vorher/nachher
- VERBOTEN: Wortlaut der Nachfolge-Zeilen (K9) · Suite-Strecke umbauen

**D-5 · „Diese Maschine": Klasse-2-Werte nur lesen** (Rang 5, erst nach Owner-Antwort auf Frage 1)
- ROLLE: claude/claude-opus-5[1m]/high
- GROESSE: mittel
- FLAECHE: server.ts · src/client.ts
- NACH: D-3
- DONE: eine Owner-Leseroute liefert eine im Code fest verdrahtete Positivliste (höchstens zwölf Namen aus §C.3) mit Wert und „wie ändern"; das Einstellungsfenster zeigt sie ohne Eingabefeld; ein e2e-Check beweist, dass ein Name außerhalb der Liste (z. B. `FLEET_TOKEN`) nie in der Antwort steht.
- VERIFY: pins · `./e2e-isolated.sh` (Aussage über eine Grenze) bzw. Suite-Offer
- VERBOTEN: Schreibzugriff auf `.env`/`watchdog.sh` · Klasse-3-Namen · Liste aus `process.env` ableiten

## E — Fragen an den Owner und das Ungeprüfte

1. **Soll das Einstellungsfenster Werte zeigen, die du dort nicht ändern kannst?** („Diese
   Maschine": Lane-Deckel, Gate-Budgets, Standardmodell — nur lesen, ändern weiter per `.env` und
   Neustart.) Annahme bis zur Antwort: nein, D-5 bleibt unter der Schnittlinie.
2. **Sollen Fleet-weite Schalter sofort wirken oder erst nach „Übernehmen"?** (Not-Aus,
   Ruhezeiten, Lane-Deckel.) Annahme in D-3: sofort, mit neu gelesenem Serverwert als Bestätigung.
3. **Dürfen Screenshots im Repo liegen?** Diese Notiz legt 44 JPEGs (1,4 MB) unter
   `docs/messungen/2026-09-22-untermenue-bilder/` ab, mit ausgeblendetem Terminal und ersetzten
   Namen/Adressen. Alternative: künftig nur außerhalb des Baums.

**Ungeprüft.** Nicht fotografiert: Aufmerksamkeit, Betriebs-Eingang, Hilfsgeräte (die Fixture hat
keine), Alarm, Neu-Version, Lightbox, Toast, Datei-Editor, Kontextpakete, Picker-Ordnerdetail,
Hub/Teilen/Helfer — diese nur aus dem Code. Die Info-Spalte hat kein Handy-Bild, weil sie am Handy
nicht erreichbar ist. Touch der Hover-Karte, ungeschützte `localStorage`-Lesezugriffe bei gesperrtem
Speicher und `confirmMidRun` am Handy nicht reproduziert (✔ auf einer sauberen Lane ergab das
`alert` „nothing to commit", nicht den Dialog). Die Bedeutung der Klasse-2-Namen stammt aus Symbol
und Kommentar, nicht aus der Verbraucherlogik. Die Sichtung lief über drei lesende Subagenten
(Leiste · Pane/Composer/Info · Fenster) und einen für die Stellschrauben; stichprobenhaft am Code
nachgeprüft sind Fehler 2, die Esc-Liste, das `prompt()` in der Aufmerksamkeit, die fehlenden
`setDrawer`, die doppelte `.entcard`, die zwei `#live.on`-Regeln, `FILE_WRITE_DENY`, die
Routen-Zählung und `DEPTH` — Fehler 1 zusätzlich im Browser gemessen.

## Methode

```sh
bun install && bun run build   # Worktree hatte kein node_modules
FLEET_TI_PORT=8886 FLEET_TI_SOCK=fleetti2ff2c FLEET_TI_DIR=/tmp/fleet-testinstanz-ff2c ./testinstanz.sh up full
FLEET_TI_PORT=8886 FLEET_TI_SOCK=fleetti2ff2c FLEET_TI_DIR=/tmp/fleet-testinstanz-ff2c ./testinstanz.sh fixtures mixed
# playwright-core im Scratchpad, Chromium aus ~/Library/Caches/ms-playwright/chromium-1208;
# je Schritt frischer Kontext, Klickfolge, dann: .xterm-screen unsichtbar, Textknoten ersetzen,
# Screenshot, Probe innerText auf /owner|Owner|\b100\.\d+\.\d+\.\d+|owner-mail/ = 0 Treffer
rg -o '\b(confirm|prompt|alert)\(' src/client.ts | sort | uniq -c
rg -n "localStorage" src/
rg -o 'process\.env\.(FLEET_[A-Z_]+)' -r '$1' server.ts server/*.ts --no-filename | sort -u | wc -l
for r in /api/dispatch /api/autos/switch /api/autos/quiet /api/repo-base /api/repo-worker /api/repo-lane-cap; do
  rg -c -F "\"$r\"" server.ts; rg -c -F "$r" src/client.ts; done
```

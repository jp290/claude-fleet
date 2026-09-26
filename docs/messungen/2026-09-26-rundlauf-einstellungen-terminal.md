---
frage: Was ist am Einstellungsfenster und an der Terminal-Ansicht beim Bedienen im Browser (1200 und 390 px) falsch oder verbesserungswürdig, und welche Bau-Zeilen folgen daraus?
urteil: Das Terminal hört in 18 von 24 Läufen nach Slot-Wechsel, Laden, ⟳ oder Reconnect auf, der Ausgabe zu folgen (mit smoothScrollDuration 0 in einer Testkopie 0 von 12); das Einstellungsfenster ist am Handy kein Vollbild (358×620 px oben links), verwirft vorgemerkte Fleet-Werte bei Esc/Außenklick ohne Nachfrage, und der Not-Aus der automatischen Prompts ist nur dort sichtbar. Dazu 16 weitere Befunde, acht Bau-Karten, Schnitt nach Karte 6.
bereich: [einstellungen, terminal, rundlauf]
belege: [src/client.ts#openSettings, src/client.ts#fleetSection, src/client.ts#machineSection, src/client.ts#Pane, src/client.ts#pinToBottom, src/client.ts#sendRaw, src/prefs.ts#PREFS, public/index.html, server.ts#observeTmuxSlots, testinstanz.sh, 74486e20, 4fae545b, 814b0bec, 450291c3]
nicht-gemessen: echte Agenten-Pane (Claude-TUI, Maus-Modus, Alternate Screen), Darstellung bei DPR 2 (Playwright-Artefakt), Soft-Keyboard/IME, echte Zwischenablage über http auf iOS, WebGL-Kontextverlust, Chat-Ansicht
stand: 2026-09-26
---

# Rundlauf: Einstellungsfenster und Terminal-Ansicht, im Browser bedient

2026-09-26, Lane `fleet/260926070148-83c3`, Baum `4fd76b1a`. Program „Oberfläche aus einem Guss"
(`0d51b4d4`). Frage: **Was hakt, wenn man das Einstellungsfenster und das Terminal wirklich bedient,
und welche Zeilen bauen das rund?**

Owner, wörtlich (über die Orchestratorin): „ja auf jeden Fall, aber es sollte stark optimiert werden,
guck dir selbst an was damit falsch ist oder man verbessern könnte und dann mach es". Und: „wir
sollten denke ich auch nochmal nach anderen pot verbeserungen schauen wie z.b die terminal usability
usw, es ist wichtig das am ende alles rund läuft".

**Lesart.** **G** heißt: im Browser gemessen (headless Chromium 1208, Playwright 1.57) oder im Code
gelesen, die Stelle ist genannt. **V** heißt: gefolgert. Jeder Befund hat einen Reproduktionsschritt
in der Testinstanz dieses Worktrees (`./testinstanz.sh up mixed`, Fixture-Slots 1–12, Slot 7 „Shell"
ist eine reine Shell). Bilder liegen außerhalb des Baums unter `/tmp/rundlauf-einstellungen-terminal/`,
die Playwright-Skripte daneben unter `skripte/`. In den Einstellungsbildern ist das Terminal
ausgeblendet, weil die Fixture-Texte die Instanzadresse enthalten. Terminal-Messungen liefen bei
DPR 1 (Grund: §Methode, Artefakt 2).

Vorgänger, deren Befunde hier nicht neu erhoben werden: Inventar
`2026-09-22-untermenue-und-einstellungen-inventar.md` (Klassen 0–3, §C Gerüst), Terminal-Beurteilung
`2026-09-22-terminal-session-beurteilung.md` (Schnitte 1–3 gelandet). Wo diese Notiz einen dort nur
vermuteten Punkt jetzt misst, steht das dabei.

## Ergebnis (a): Einstellungsfenster (`src/client.ts#openSettings`)

Gerankt nach Kosten. „Repro" = Klickfolge in der Testinstanz.

| # | Befund | Kosten | Repro | Bild |
|---:|---|---|---|---|
| E1 | **G: Am Handy ist das Fenster kein Vollbild.** Bei 390×844 misst `.shellwin` 358×620 px und sitzt bei x=0/y=0; rechts 32 px und unten 224 px Terminal bleiben sichtbar, der Inhalt scrollt in 569 px. Ursache: `.shell.solo .shellwin { width: min(520px, calc(100vw - 32px)); max-height: min(78vh, 620px) }` in `public/index.html` steht außerhalb der Media-Query und schlägt die Handy-Regel `.shellwin { width: 100vw; height: 100dvh }`. `solo` trägt nur das Einstellungsfenster (`src/client.ts#openSettings`, einziger `classList.add("solo")`). Bei 430 px dasselbe (398×620). | Das einzige Fenster, das am Handy nicht wie alle anderen aussieht; Fleet-Zeilen und Apply liegen unter dem Falz eines 569-px-Kastens | 390 px, ☰-Kopf → Zahnrad `#mset` | `set-390-dev.png`, `set-390-fleet.png` |
| E2 | **G: Vorgemerkte Fleet-Werte gehen ohne Nachfrage verloren.** Automatic prompts umschalten („1 vorgemerkt"), dann Esc, Außenklick oder ✕: das Fenster schließt, beim Wiederöffnen ist nichts mehr vorgemerkt. | Der Owner stellt drei Werte ein, tippt am Handy daneben, und nichts ist gespeichert — ohne dass er es merkt | 1200 px, Zahnrad → Fleet → Automatic prompts klicken → Esc → Zahnrad | `set-apply-1-staged.png` |
| E3 | **G: Not-Aus und Ruhezeiten sind nur im Einstellungsfenster sichtbar.** Mit `autosOn=false` und Ruhezeit 22–07 zeigt der Zeitplan-Dialog (`#autodlg`) „No schedules … schedule" ohne Hinweis; `autosOnSrv`/`quietHoursSrv` werden nur in `src/client.ts#fleetSection` gelesen (`rg -n autosOnSrv src/client.ts`: 1 Leser). | Ein geplanter Check-in, der nie feuert, und kein Ort außer dem Fenster sagt es | Fleet → Automatic prompts off → Apply → Schedule | `autos-off-schedule.png` |
| E4 | **G: Am Desktop ist das Wichtige 2,4 Bildschirme tief.** Kein Reiter am Desktop (`.settabs { display: none }`), vier Abschnitte gestapelt: Inhalt 2203 px in 567 px Sicht; „Fleet" beginnt bei 1347 px, „This machine" bei 1783 px. Von den 17 Zeilen unter „Dieses Gerät" sind 9 Ansichtszustand, keine Einstellung: 5 Wertzeilen (Zuletzt gewählter Ordner, zugeklappte Abschnitte, zugeklappte Stapel, Fenster-Layout, Quittung) und 4 Auf/Zu-Schalter (Info-Spalte, Seitenleiste, Checks aufgeklappt, Panel „mehr"). Das Inventar vom 22.09. §B hatte für genau diese Schlüssel „nein — Zustand, keine Einstellung; nur ‚alles zurücksetzen'" festgelegt. | Die fünf Server-Schalter erreicht nur, wer weiß, dass sie ganz unten liegen | 1200 px, Zahnrad → scrollen | `set-1200-open.png`, `set-1200-sec1.png`, `set-1200-sec2.png` |
| E5 | **G: Aa öffnet „Schrift" am Desktop nicht.** In der Chat-Ansicht öffnet Aa das Fenster mit `scrollTop 0`; „Schrift" steht bei 974 px in einer 567-px-Sicht. `at: "schrift"` setzt nur den Reiter, und Reiter gibt es nur am Handy. | Der Knopf, dessen Tooltip „Schrift und Spalte — in den Einstellungen" sagt, zeigt die Schrift nicht | 1200 px, 💬 → Aa | — |
| E6 | **G: „Dieses Gerät" und „This machine" heißen fast gleich und meinen Verschiedenes** (Browser gegen Server). Die Maschinenzeilen zeigen nackte Namen (`FLEET_VERIFY_TIMEOUT_MS`), Millisekunden ohne Einheit (`900000`) und keinen Satz, was der Wert bewirkt; nur „ändern: …". | Eine Anzeige, die der Owner ohne `.env`-Wissen nicht lesen kann | Zahnrad → This machine | `set-390-machine.png` |
| E7 | **G: Apply meldet Erfolg nur indirekt.** Nach dem Klick steht ~1,5 s lang weiter „1 vorgemerkt — gilt erst nach Apply" bei gesperrtem Knopf, dann verschwindet die Zeile und der Wert springt um; kein „gespeichert". Zeilen mit Serverfehler bleiben vorgemerkt und gehen bei jedem Apply erneut raus (drei Apply-Klicks = 7× HTTP 400 im Konsolenprotokoll). | Kein Fehler, aber keine Rückmeldung — der Owner muss den Wert selbst vergleichen | Fleet → umschalten → Apply | `set-apply-3-done.png` |
| E8 | **G: Wert und Schalter zeigen dasselbe doppelt** („on" neben [on], „off" neben [off ▾]); bei „Dispatcher" steht „unavailable" neben einem gesperrten [off] ohne Grund. | Rauschen in der Zeile; „unavailable" ohne Warum ist eine Sackgasse | Zahnrad → Fleet | `set-1200-sec2.png` |
| E9 | **G: Lane-Deckel nimmt −1, 1000, 2.5 an** (`type=number`, `min=0`); der Server lehnt mit englischem Rohtext ab („maxLanes must be a whole number between 1 and 16 …"). Integration branch „gibt-es-nicht": „Server lehnt ab: no such branch" — korrekt an der Zeile. | Gering; der Server schützt | Fleet → Lane cap → -1 → Apply | `set-apply-4-caperr.png`, `set-apply-5-branch.png` |
| E10 | **G: Vier Zahnräder im 2×2-Layout**, dazu die Lupe in leeren Panes; das Fenster ist global. Kein Tastenkürzel (⌘, öffnet nichts). | Gering; Suchbild ohne Mehrwert | 1200 px, 2×2 | `layout-2x2.png` |
| E11 | **G: Beschriftungen in zwei Schriften** — Gerätezeilen in Mono, Fleetzeilen in Sans (`.fleetrow .setlabel` ist die einzige Sans-Regel). | Gering; wirkt wie zwei Fenster | Zahnrad | `set-1200-sec2.png` |

**Was fehlt**, gemessen an Inventar §C (Klasse 0/1, noch nicht drin): Lupe als Voreinstellung (heute
je Pane in `fleet.view.hovers`, eine neue Pane startet aus); „Ansicht zurücksetzen" als eine Zeile
statt neun; die Terminal-Schriftgröße (siehe T6). Die vier routenfertigen Klasse-1-Schalter und der
Dispatcher sind drin (`814b0bec`); Program↔Studio und Slot-Mission/Schlafen gehören laut Inventar an
ihr Ding, nicht hierher — kein Vorschlag.

**Was trägt (G):** Esc schließt, der Fokus kehrt zum Zahnrad zurück; Datensparen und Info-Spalte sind
mit 🐢 bzw. ℹ synchron (in beide Richtungen umgeschaltet); Serverablehnungen stehen an ihrer Zeile;
der gespeicherte Branch wird beim Öffnen gelesen; am Handy laufen die vier Reiter ohne waagrechten
Überlauf (Reiterleiste 330 px in 330 px).

## Ergebnis (b): Terminal-Ansicht (`src/client.ts#Pane`)

| # | Befund | Kosten | Repro | Bild |
|---:|---|---|---|---|
| T1 | **G: Das Terminal folgt nach dem Andocken der Ausgabe nicht.** Nach Laden, Slot-Wechsel, ⟳ oder Rückkehr zu einem Slot steht der Viewport 1–2 Zeilen über dem Ende; ab da wächst der Abstand mit jeder neuen Zeile (30 neue Zeilen → Abstand 31–33, ▼ sichtbar). Zwei Läufe à 12: **8/12 und 10/12 folgen nicht**. Derselbe Ablauf mit `smoothScrollDuration: 0` in der Testkopie (nicht im Repo) : **0/12**. Mechanismus (V, durch das Experiment gestützt): `Pane#pinToBottom` stößt `scrollLines(-1)` + `scrollToBottom()` im selben Frame an; mit der seit `74486e20` (2026-09-11) aktiven 100-ms-Glättung endet die Animation vor dem Ende, xterm hält den Viewport dann für „vom Nutzer hochgescrollt" und hört auf zu folgen. Auch nach Server-Neustart (Abstand 1 → 3 nach einer Zeile). Tippen ins Terminal holt es zurück (xterm scrollt bei Eingabe), deshalb fällt es beim Arbeiten mit Tastatur weniger auf als beim Zusehen. | Der Hauptzweck der Ansicht — zusehen, was die Session tut — scheitert still; die neue Ausgabe liegt unter dem Rand | 1200 px, Slot 7 anklicken, dann `tmux -L <sock> send-keys -t =s7: 'seq 1 30' Enter` | `term-pin-after.png` |
| T2 | **G: Am Handy lässt sich aus dem Terminal nichts kopieren.** Langes Drücken (900 ms, Touch per CDP) erzeugt keine Auswahl (0 Auswahl-Elemente, leere Dokumentauswahl). War am 22.09. §3 Befund 1 nur vermutet. | Pfade und Fehlermeldungen muss der Owner über die Chat-Ansicht holen | 390 px Touch, Slot 7, lang drücken | `term-390-longpress.png` |
| T3 | **G: Ein Verbindungsabbruch ist in der Pane unsichtbar, Tastendrücke verfallen.** Server der Testinstanz 8 s aus: einziges Zeichen ist der 6-px-Punkt neben „Claude Fleet" (rot); die Pane zeigt den alten Stand ohne Hinweis. `Pane#sendRaw` verwirft Eingaben bei geschlossenem Socket (`if (this.ws?.readyState !== WebSocket.OPEN) return`). Wiederverbindung: Socket zu bei +0,5 s, wieder offen 10,7 s danach (Backoff). Der Puffer verdoppelt sich nicht (1687 → 1743 Zeilen, +1 Bildschirm): Schnitt 1 vom 22.09. hält. | Getippte Befehle verschwinden ohne Spur; am Handy (Schlaf, Netzwechsel) Alltag | Slot 7, Instanz-Server stoppen (Skript `restart-srv.sh`), tippen | `term-srv-down.png` |
| T4 | **G: Die Handy-Tastenreihe schneidet ^C ab.** `#keys` ist 374 px breit, Inhalt 436 px: ⏎ liegt bei 351–395, ^C bei 400–444 — ^C ist ohne waagrechtes Wischen unsichtbar, ohne Hinweis darauf. | Die Abbruch-Taste ist die, die man im Ernstfall sofort braucht | 390 px, Slot 7 | `term-390-bottom.png` |
| T5 | **G: Die Eckknöpfe liegen auf dem Terminaltext.** 390 px: vier 40×40-Knöpfe decken die Spalten 36–55 von 55 in den Zeilen 0–6 (36 % der Breite der obersten sieben Zeilen). 1200 px: sechs Knöpfe über den Spalten ~107–131 von 131 in den Zeilen 0–4. Lange Zeilen oben sind dort nicht lesbar. | Text unter Knöpfen; bei Vollbild-TUIs (Kopfzeile oben rechts) trifft es gerade die Statuszeile (V) | 390 px, Slot 7, eine lange Zeile oben | `term-390-bottom.png`, `term-link-meta.png` |
| T6 | **G: Die Terminalschrift ist fest.** `fontSize` 11/12 px im Konstruktor, zur Laufzeit nie gesetzt (`rg -n "options.fontSize" src/client.ts` = 0); ⌘= im Terminal ändert nichts (Bildschirmbreite 917 → 917 px, `fleet.chatsize` unverändert). „Schrift" kennt nur Text/Code/Oberfläche/Breite. | Am Handy 11 px ohne Ausweg; die Seite zu zoomen ist der einzige Weg | 1200 px, Terminal fokussiert, ⌘= | — |
| T7 | **G: Keine Suche im Scrollback** (`package.json` ohne `@xterm/addon-search`; Canvas/WebGL malen Pixel, V: die Browsersuche findet nichts). Unverändert seit 22.09. §3 Befund 2. | 10 000 Zeilen nur durch Scrollen | — | — |
| T8 | **G: Am Handy öffnet ein Tipp auf Linktext sofort einen Tab** (Tipp auf `row-297 https://…` → neuer Tab). | Gering; in URL-reicher Ausgabe landet ein Fokus-Tipp in einem Tab | 390 px Touch, Tipp auf eine URL-Zeile | — |

**Was trägt (G):** Rad 100 px je Raste, feine Trackpad-Schritte glatt (40 × −3 → 120 px); Touch-Wischen
1:1 (300 px Wisch → 300 px); Shift+PgUp; neue Ausgabe reißt einen hochgescrollten Nutzer nicht weg
(4196 → 4200 px); ▼ erscheint und springt; Desktop-Kopieren per Ziehen + ⌘C liefert den markierten
Text; ⌘-Klick öffnet den Link; Einfügen (auch mehrzeilig) erreicht die Pane; Resize 1200 → 900 → 1200
setzt die tmux-Breite 131 → 88 → 131.

## Ergebnis (c): Werkzeug — die Testinstanz pflanzt auf dieser Maschine keine Sessions

**G:** `./testinstanz.sh up mixed` meldet „0 occupied" und für jeden Slot `503 pane availability is
unknown` — derselbe Befund steht in `2026-09-26-untermenue-staffel-inventar.md` als Grund, warum dort
keine Session-Flächen fotografiert wurden. Ursache: `testinstanz.sh` startet den Server hinter
`env -i` ohne Locale; tmux 3.6a gibt dann das Tab in `-F '#{session_name}\t#{pane_current_path}'` als
`_` aus (geprüft: ohne Locale und mit `LC_ALL=C` → `_`, mit `LANG=en_US.UTF-8` → `\t`), und
`server.ts#observeTmuxSlots` wertet die Zeile als „unreadable row" → `known:false` → 503. Mit
`LANG=en_US.UTF-8` im Start der Instanz: 12 belegt, 4 Lanes. **Kosten:** jede Browser-Messung und jede
VERIFY-Zeile, die sich auf die Testinstanz stützt, sieht nur einen leeren Fleet. Der Live-Server ist
nicht betroffen (V: er erbt die Locale der Login-Shell, nicht gemessen).

## Bau-Karten (Vorschlag; die Orchestratorin filt)

Rangfolge nach Kosten und Abhängigkeit. Alle Karten reparieren oder schärfen bestehende Flächen;
Annahme: Basis `main` (Live-Fixes), sofern die Orchestratorin sie nicht `overhaul` zuordnet. VERIFY
nutzt die Skripte unter `/tmp/rundlauf-einstellungen-terminal/skripte/` als Protokoll; Terminal-Bilder
bei DPR 1.

**K1 · Testinstanz mit UTF-8-Locale** (Rang 1 — Voraussetzung für jedes Browser-VERIFY unten)
- ZIEL: `./testinstanz.sh up mixed` pflanzt auf dieser Maschine wieder Sessions
- ROLLE: codex/gpt-6-luna/high
- GROESSE: klein
- FLAECHE: testinstanz.sh · docs/testinstanz.md
- DONE: der `env -i`-Start setzt `LANG=en_US.UTF-8` (Name in `env-names` mitgeschrieben); `./testinstanz.sh up mixed` meldet „12 occupied … 4 lanes"; docs/testinstanz.md nennt den Grund in einem Satz (tmux-Tab unter C-Locale)
- VERIFY: `./testinstanz.sh up mixed` Ausgabe „fixtures (mixed): 12 occupied" · `./testinstanz.sh down` · `bun e2e/pins.ts`
- VERBOTEN: `server.ts#observeTmuxSlots` ändern · Live-Port/Socket · weitere Env-Namen durchreichen

**K2 · Terminal folgt der Ausgabe nach jedem Andocken** (Rang 2 — T1)
- ZIEL: nach Laden, Slot-Wechsel, ⟳ und Reconnect steht das Terminal am Ende und folgt neuer Ausgabe
- ROLLE: codex/gpt-6-sol/high
- GROESSE: klein
- FLAECHE: src/client.ts · e2e/history.ts
- DONE: `Pane#pinToBottom` erreicht das Ende ohne Glättung (z. B. `smoothScrollDuration` für den programmatischen Sprung auf 0 und danach zurück), die Rad-Glättung aus `74486e20` bleibt für Nutzer-Scrollen; im Protokoll `skripte/t5.ts` (3 × 4 Einstiege, danach 30 Zeilen Ausgabe) 12/12 mit Abstand 0 und ohne ▼; ein Quelltext-Pin in `e2e/history.ts` neben dem von Schnitt 3 hält fest, dass `pinToBottom` die Glättung umgeht
- VERIFY: `bun e2e/pins.ts` · `bun run build` · `skripte/t5.ts` gegen die Testinstanz (12/12) · Gate-Kette laut `GET /api/self/gate`
- VERBOTEN: `smoothScrollDuration` global auf 0 · Seed-/Server-Pfad ändern · Scrollback-Größe ändern

**K3 · Einstellungsfenster am Handy als Vollbild, vorgemerkte Werte nicht still verwerfen** (Rang 3 — E1, E2, E5)
- ZIEL: das Einstellungsfenster verhält sich am Handy wie jedes andere Fenster und verliert keine Eingabe
- ROLLE: codex/gpt-6-sol/high
- GROESSE: klein
- FLAECHE: public/index.html · src/client.ts
- DONE: bei 390×844 misst `#shell-settings .shellwin` 390×844 (die `solo`-Breitenregel gilt nur außerhalb der Handy-Media-Query); Esc, Außenklick und ✕ bei ≥1 vorgemerkter Fleet-Zeile fragen einmal im Fenster („N Änderungen verwerfen?") statt zu schließen, ohne native `confirm()`; Aa öffnet am Desktop mit „Schrift" oben im Sichtbereich
- VERIFY: `bun e2e/pins.ts` · `bun run build` · Playwright 390 und 1200 px: Rechteck-Messung wie `skripte/set4.ts`, Esc mit vorgemerktem Wert, Aa in der Chat-Ansicht (`skripte/t9.ts`, `schriftTop` < `clientH`) · Screenshots vorher/nachher
- VERBOTEN: `src/shell.ts` für alle Fenster umbauen · Material ändern · Fleet-Routen ändern

**K4 · Not-Aus und Ruhezeit dort zeigen, wo geplant wird** (Rang 4 — E3)
- ZIEL: wer einen Prompt plant, sieht, dass er wegen Not-Aus oder Ruhezeit nicht gesendet wird
- ROLLE: codex/gpt-6-sol/high
- GROESSE: klein
- FLAECHE: src/client.ts · public/index.html
- DONE: bei `autosOn=false` trägt der Zeitplan-Dialog oben eine Zeile „Automatische Prompts sind aus — geplante Prompts werden nicht gesendet" mit Sprung ins Einstellungsfenster (Abschnitt Fleet); bei gesetzter Ruhezeit „Ruhezeit HH–HH: wiederkehrende Prompts pausieren"; der Schedule-Knopf in der Werkzeugzeile trägt bei Not-Aus eine Markierung
- VERIFY: `bun e2e/pins.ts` · `bun run build` · Playwright: `POST /api/autos/switch {on:false}` → Schedule öffnen → Zeile sichtbar; `{on:true}` → Zeile weg · Screenshot 1200/390
- VERBOTEN: neue Server-Route · Autos-Logik ändern · Schedule-Dialog neu bauen

**K5 · Handy-Terminal: kopieren, ^C erreichen, Knöpfe vom Text** (Rang 5 — T2, T4, T5)
- ZIEL: am Handy lässt sich Terminaltext kopieren, ^C ist ohne Wischen erreichbar, die Eckknöpfe verdecken keinen Text
- ROLLE: claude/claude-opus-5-5[1m]/high
- GROESSE: mittel
- FLAECHE: src/client.ts · public/index.html
- DONE: langes Drücken im Terminal wählt die Zeile (oder das Wort) und bietet „Kopieren", das über `src/client.ts#copyText` geht; ^C liegt bei 390 px vollständig im sichtbaren Bereich von `#keys` (z. B. an erster Stelle oder zweizeilig); bei 390 px überdeckt kein Eckknopf die Textfläche `.xterm-screen` (Knöpfe über dem Terminal statt darauf, oder hinter einem ⋯)
- VERIFY: `bun e2e/pins.ts` · `bun run build` · Playwright 390 px Touch bei DPR 1: Long-Press → kopierter Text gleich der Zeile (Kopier-Haken wie `skripte/cliphook.ts`), `#keys` ^C-Rechteck innerhalb `clientWidth`, Überdeckungs-Messung wie `skripte/t7.ts` = 0 Knöpfe · Screenshots
- VERBOTEN: `inputMode` der xterm-Textarea ändern · Desktop-Eckreihe umbauen · Chat-Ansicht anfassen

**K6 · Verbindungsabbruch in der Pane sichtbar, Eingabe nicht still verwerfen** (Rang 6 — T3)
- ZIEL: eine getrennte Pane sagt es und verliert keine Tastendrücke ohne Spur
- ROLLE: codex/gpt-6-sol/high
- GROESSE: klein
- FLAECHE: src/client.ts · public/index.html
- DONE: solange der Socket der Pane zu ist, zeigt die Pane eine Zeile „getrennt — neuer Versuch in N s" mit Knopf „jetzt verbinden" (ruft `Pane#reconnect`); `Pane#sendRaw` bei geschlossenem Socket verwirft nicht still, sondern puffert bis 1024 B und sendet nach dem Seed, oder zeigt „Eingabe verworfen" — eine der beiden, im Commit-Body begründet
- VERIFY: `bun e2e/pins.ts` · `bun run build` · Playwright mit `skripte/restart-srv.sh`: Zeile erscheint ≤ 1 s nach dem Stopp, verschwindet nach Wiederverbindung; Puffer-Zeilen vor/nach wie `skripte/t6.ts` ohne Verdopplung
- VERBOTEN: Backoff-Stufen in `src/backoff.ts` ändern · Server-Seed-Pfad · Heartbeat-Protokoll einführen

— Schnittlinie: K1–K6 beheben, was heute beim Bedienen falsch läuft oder still verloren geht („es ist wichtig das am ende alles rund läuft"). K7 und K8 schärfen, was funktioniert. —

**K7 · Einstellungsfenster straffen** (Rang 7 — E4, E6, E7, E8, E11, Lupe-Voreinstellung)
- ZIEL: das Fenster zeigt Einstellungen statt Ansichtszustand, die Server-Schalter sind ohne Scrollen erreichbar, Apply sagt, was gespeichert ist
- ROLLE: claude/claude-opus-5-5[1m]/high
- GROESSE: mittel
- FLAECHE: src/client.ts · src/prefs.ts · public/index.html
- DONE: Reiter auch am Desktop; die neun Ansichtszustands-Zeilen aus E4 werden eine Zeile „Ansicht zurücksetzen" (die Schlüssel bleiben in `PREFS`, `row: false`); neue Zeile „Lupe in neuen Panes" als Klasse-0-Schlüssel; Abschnitt „This machine" heißt nach seinem Gegenstand (Server) und jede Zeile trägt einen deutschen Satz zur Wirkung plus Einheit (Minuten/Sekunden statt ms); Apply zeigt nach Erfolg „gespeichert" mit Uhrzeit, fehlgeschlagene Zeilen gehen nur erneut raus, wenn sie geändert wurden; die Wertspalte entfällt, wo der Schalter denselben Wert zeigt; Dispatcher „unavailable" nennt den Grund; Beschriftungen in einer Schrift
- VERIFY: `bun e2e/pins.ts` (e2e/tasks.ts pinnt den Routen-Satz von `fleetSection`) · `bun run build` · Playwright 1200/390: Fleet-Abschnitt ohne Scrollen per Reiter erreichbar, Zeilenzahl „Dieses Gerät" ≤ 9 · Screenshots · Demo `bun run typecheck`
- VERBOTEN: Schlüsselnamen umbenennen (K2 aus der Grammatik) · neue Server-Route · Klasse-2/3-Werte editierbar machen

**K8 · Terminalschrift und Suche** (Rang 8 — T6, T7)
- ZIEL: die Terminalschrift ist einstellbar und der Scrollback durchsuchbar
- ROLLE: codex/gpt-6-sol/high
- GROESSE: mittel
- FLAECHE: src/client.ts · src/chatsize.ts · package.json · bun.lock · public/index.html
- DONE: „Schrift" hat eine Zeile „Terminal" (z. B. 9–18 px), die `term.options.fontSize` aller Panes setzt und refittet; ⌘/Strg + / − / 0 wirkt auch mit fokussiertem Terminal; `@xterm/addon-search` mit ⌘F/Strg+F in der fokussierten Pane, Treffer markiert, Esc schließt
- VERIFY: `bun install --frozen-lockfile` · `bun e2e/pins.ts` · `bun run build` · Playwright 1200 px: Schrift 12 → 16 px ändert `cols` im WS-Connect und die tmux-Breite; Suche nach einer Marker-Zeile scrollt zu ihr · Demo `bun run typecheck`
- VERBOTEN: Seed-Pfad · Scrollback-Größe · Chat-Schriftlogik ändern

## Methode

```sh
bun install --frozen-lockfile
./testinstanz.sh up mixed --ttl 240          # 0 occupied, 503 je Slot (Befund c)
# Server der eigenen Instanz per notierter PID (Port-Identität geprüft) gestoppt und mit demselben
# env -i-Aufruf plus LANG=en_US.UTF-8 neu gestartet, FLEET_INSTANCES leer; dann:
./testinstanz.sh fixtures mixed              # 12 occupied, 16 free, 4 lanes
# tmux-Beweis für (c):
env -i PATH=… tmux -L <probe> list-sessions -F '#{session_name}<TAB>#{pane_current_path}' | od -c
# Playwright 1.57 (playwright-core im Scratchpad), Chromium 1208 headless, --use-angle=swiftshader.
# Skripte: /tmp/rundlauf-einstellungen-terminal/skripte/ (set1–set6, t1–t9, cliphook, restart-srv.sh)
```

- Einstellungen: 1200×900 DPR 1 und 390×844 DPR 2 mit `isMobile`/`hasTouch`; Geometrie über
  `getBoundingClientRect`, Staging/Apply über die Klassen `.staged`/`.seterr` und die Fußzeile.
- Terminal: 1200×900 und 390×844, beide DPR 1; Ausgabe per `tmux send-keys` in `s7`; Scroll-Lage aus
  `.xterm-viewport` (`scrollTop` gegen `scrollHeight − clientHeight`, 14 px je Zeile); Touch per CDP
  `Input.dispatchTouchEvent`. Kopieren ohne echte Zwischenablage: ein `copy`-Listener in der Seite
  zeichnet den Text auf und ruft `preventDefault` (die Seite läuft über http, `navigator.clipboard`
  fehlt, `copyText` nimmt den `execCommand`-Weg); Einfügen per synthetischem `ClipboardEvent`.
- T1-Experiment: `smoothScrollDuration: 100 → 0` nur in `/tmp/fleet-testinstanz-…/src/client.ts`,
  `bun run build`, 12 Läufe; danach die Datei zurückkopiert (`cmp` gegen den Worktree: identisch),
  neu gebaut, 12 weitere Grundlinien-Läufe.

**Zwei Messartefakte, keine Befunde:**
1. Die erste Klickfolge (t2) meldete „Kopieren leer" und „⌘-Klick öffnet nichts": falsche Zeile
   gezielt (nach `clear` stand anderer Text in Zeile 1). Mit der gerenderten Zeile: beides geht.
2. **Bei DPR 2 malt xterm die Glyphen doppelt so groß und schneidet rechts ab** (WebGL und Canvas
   gleich). Ursache ist die Emulation, nicht der Client: Playwrights `deviceScaleFactor` meldet
   `devicePixelContentBoxSize` 100 statt 200 für ein 100-px-Element (gemessen), xterm dimensioniert
   seine Leinwand danach. Terminal-Bilder deshalb bei DPR 1; die DPR-2-Darstellung ist ungemessen.

## Was nicht gemessen wurde

- Eine echte Agenten-Pane (Claude-TUI mit Maus-Modus, Alternate Screen, Statuszeile oben rechts):
  die Testinstanz fährt `FLEET_CMD=true`. Ob T5 dort die Statuszeile trifft und ob T1 bei einer TUI
  anders läuft: **ungemessen**.
- Darstellung bei DPR 2 (Retina, Handy) — siehe Artefakt 2.
- Soft-Keyboard, IME, echte iOS-/Android-Browser, echte Zwischenablage über http in Safari.
- WebGL-Kontextverlust und ⟳-Rückweg (Schnitt 3 vom 22.09.) im Browser.
- Chat-Ansicht (außer Aa), Info-Spalte, Hover-Karten im Terminal.
- T1 in einem nicht-headless Browser: der Mechanismus ist per Experiment gestützt, die Rate von
  18/24 gilt für headless Chromium.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-26T09:04+02:00	aufbau	testinstanz up mixed	Rezept docs/testinstanz.md	ti-up-Log	0 occupied, 503 je Slot
2026-09-26T09:06+02:00	aufbau	Instanz-Server mit LANG=en_US.UTF-8 neu gestartet	tmux gibt Tab ohne UTF-8-Locale als _ aus	od -c-Probe	12 occupied, 4 lanes
2026-09-26T09:13+02:00	terminal	DPR-2-Bilder verworfen, Terminal bei DPR 1	devicePixelContentBoxSize=100 bei DPR 2	skripte/s6.ts	Artefakt, kein Befund
2026-09-26T09:24+02:00	terminal	Folge-Abbruch als Befund geführt	12 Läufe, 8 ohne Folgen	skripte/t5.ts	T1
2026-09-26T09:27+02:00	terminal	smoothScroll 0 nur in der Testkopie probiert	Mechanismus prüfen statt vermuten	build-Log der Kopie	0/12 ohne Folgen
2026-09-26T09:28+02:00	terminal	Kopie zurückgesetzt, zweite Grundlinie	Rate bestätigen	cmp identisch	10/12 ohne Folgen
2026-09-26T09:30+02:00	terminal	Server-Neustart 8 s	Reconnect und Duplikate messen	skripte/restart-srv.sh	1687→1743 Zeilen, 10,7 s
2026-09-26T09:35+02:00	bilder	Einstellungsbilder mit ausgeblendetem Terminal neu	Fixture-Text trägt die Instanzadresse	lib.ts HIDE_TERM	18 Bilder in /tmp/rundlauf-einstellungen-terminal
```

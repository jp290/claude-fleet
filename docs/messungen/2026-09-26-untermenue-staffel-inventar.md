---
frage: Welche der 71 Flächen aus Teil A vom 22.09. plus neue Flächen sind im gelandeten Baum geändert, welche sind noch offen, und wo liegt der mechanische Modulschnitt?
urteil: 80 Zeilen inventarisiert (71 alte, 9 neue). Die aktuellen Browserbilder decken nur die ohne Fixture-Sessions erreichbaren Zustände; die übrigen Pfade sind ausdrücklich Kontextbilder, keine visuelle Abnahme der benannten Fläche.
bereich: client,untermenues,staffel,modulschnitt
belege: [docs/messungen/2026-09-22-untermenue-und-einstellungen-inventar.md, src/client.ts, src/shell.ts, src/popover.ts, src/dialog.ts, git log 56a47579..ed483c7]
nicht-gemessen: sessiongebundene Flächen im aktuellen Browser; Queue-Livezustand der genannten offenen Zeilen; nicht gelandeter Zweig overhaul
stand: 2026-09-25 23:01 Europe/Berlin
---

# Restliche Untermenüs und Panels: Fortschreibung und Schnitt

Ausgang: [Inventar vom 22.09.](2026-09-22-untermenue-und-einstellungen-inventar.md), Teil A, Zeilen 1–71. Baum `ed483c7`, `src/client.ts` 18 022 Zeilen. `git log --format=%B 56a47579..HEAD -- src/ public/` wurde gelesen. **Stand** bezeichnet nur eine nachweisbare Änderung an der Fläche, keine visuelle Freigabe. „In Arbeit“ stammt aus dem Auftrag; die Queue selbst ist dieser Lane nicht offen und der Endzustand bleibt unbekannt.

Bildpfade liegen **außerhalb** des Baums unter `/tmp/staffel-inventar/screens/`. `S` = die genannte Oberfläche ist im aktuellen 1200×900- bzw. 390×844-Bild sichtbar; `H22` = historisches Bild vom 22.09., als Referenz aus dem alten Inventar außerhalb des Baums kopiert; `K` = aktuelles Kontextbild, die Fläche selbst ist **nicht** sichtbar. `H22` belegt nicht den heutigen Stand, `K` beweist kein Aussehen. Die Testinstanz `./testinstanz.sh up mixed` meldete 0 belegte Slots; `fixtures mixed` gab für Slots 1–8 `503 pane availability is unknown` zurück, daher lassen sich Session-, Board-, Explorer-, Review- und Detailzustände hier nicht seriös fotografieren. Die Bilder vom 22.09. werden ausdrücklich nur als historische Referenz ausgegeben.

## Fortschreibung von Teil A und neue Flächen

| # | Fläche | Einstieg / `datei#symbol` | `src/client.ts` Zeilen | Stand | Desktop 1200 | Handy 390 | Schnittziel |
|---:|---|---|---|---|---|---|---|
| 1 | Handy-Kopfleiste | Markup `#mhead`; `src/client.ts#setDrawer` über `#menu`; `src/client.ts#setDrawer` | 81–101 | überarbeitet durch `d824fca7` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/sidebar.ts` |
| 2 | Schublade + Abdunklung | `setDrawer`; `src/client.ts#setDrawer` | 81–101 | überarbeitet durch `3e619590` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/schublade-390.png` (S) | `src/sidebar.ts` |
| 3 | Leiste einklappen | `setCollapsed` über `#collapse`; `src/client.ts#setCollapsed` | 102–128 | überarbeitet durch `97f92ce8` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/sidebar.ts` |
| 4 | Instanz-Menü | `renderInstanceHead` → `setInstMenu` über `#instbtn`; `src/client.ts#renderInstanceHead` | 129–202 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/screens/instanz-1200.png` (S) | `/tmp/staffel-inventar/screens/instanz-390.png` (S) | `src/sidebar.ts` |
| 5 | Ansichts-Umschalter | `#layouts button`; `src/client.ts#setLayout` | 6192–6240 | überarbeitet durch `f2084049` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/sidebar.ts` |
| 6 | Werkzeugzeile | `paintHead`, `HEAD_BTNS`; `src/client.ts#paintHead` | 16710–16880 | überarbeitet durch `d824fca7` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/sidebar.ts` |
| 7 | „⋯ mehr"-Fach | `morebtn.onclick` → `applyMore`; `src/client.ts#applyMore` | 16586–16623 | unverändert | `/tmp/staffel-inventar/screens/mehr-1200.png` (S) | `/tmp/staffel-inventar/screens/mehr-390.png` (S) | `src/sidebar.ts` |
| 8 | Hinweis „Eigener Knopf" (+) | `plusBtn.onclick`; `src/client.ts#openIdee` | 16633–16709 | überarbeitet durch `47f0a5a9` | `/tmp/staffel-inventar/screens/idee-1200.png` (S) | `/tmp/staffel-inventar/screens/idee-390.png` (S) | `src/idea.ts` |
| 9 | Aufmerksamkeit 📣 | `renderAttnDlg` über `#attnbtn`; `src/client.ts#renderAttnDlg` | 17195–17478 | unverändert | `/tmp/staffel-inventar/screens/mehr-1200.png` (K) | `/tmp/staffel-inventar/screens/mehr-390.png` (K) | `src/attention.ts` |
| 10 | Betriebs-Eingang 📥 | `renderOpsDlg` über `#opsbtn`; `src/client.ts#renderOpsDlg` | 17479–17609 | unverändert | `/tmp/staffel-inventar/screens/mehr-1200.png` (K) | `/tmp/staffel-inventar/screens/mehr-390.png` (K) | `src/attention.ts` |
| 11 | Hilfsgeräte 💻 | `renderDevDlg` über `#devbtn` bzw. `.smdev`; `src/client.ts#renderDevDlg` | 3505–3577 | unverändert | `/tmp/staffel-inventar/screens/mehr-1200.png` (K) | `/tmp/staffel-inventar/screens/mehr-390.png` (K) | `src/devices.ts` |
| 12 | Datensparer | `setSaver` über `#saverbtn`; `src/client.ts#setSaver` | 10139–10170 | überarbeitet durch `450291c3` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/sidebar.ts` |
| 13 | Session-Zeile + Hover-Leiste | `slotRow`, `.slotact`; `src/client.ts#slotRow` | 9384–9569 | in Arbeit durch `929f6a26` (Basis `485190bc`) | `/tmp/staffel-inventar/referenz-22-09/13-slothover-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/sidebar.ts` |
| 14 | Handy-Zeilenaktionen | `slotRow` → `.rowacts`; `src/client.ts#toggleRowMenu` | 9676–9723 | überarbeitet durch `485190bc` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/sidebar.ts` |
| 15 | Umbenennen (inline) | `startRename` (Doppelklick, ✎); `src/client.ts#startRename` | 9081–9122 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/sidebar.ts` |
| 16 | Session beenden | `.kill.onclick` → `showRiskPreview` (Lane) bzw. `confirm()` (Haupt-Session); `src/client.ts#killSlot` | 9654–9675 | überarbeitet durch `3e619590` | `/tmp/staffel-inventar/referenz-22-09/27-slotkill-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/sidebar.ts` |
| 17 | Zugangs-Token | `showGate` bei 401; `src/client.ts#showGate` | 227–246 | unverändert | `/tmp/staffel-inventar/referenz-22-09/15-gate-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/15-gate-390.jpg` (H22) | `src/auth-panel.ts` |
| 18 | Pane-Eckknöpfe ↻ ℹ 💬 | `Pane`-Konstruktor; `src/client.ts#Pane` | 842–1757 | überarbeitet durch `97f92ce8` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/pane.ts` |
| 19 | Sprung zum Prompt ↑↓ | `Pane`-Konstruktor; `src/client.ts#Pane` | 842–1757 | überarbeitet durch `d824fca7` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/pane.ts` |
| 20 | Schriftgröße „Aa" | `Pane`-Konstruktor; `src/client.ts#openSettings` | 2493–2543 | überarbeitet durch `450291c3` | `/tmp/staffel-inventar/screens/einstellungen-1200.png` (K) | `/tmp/staffel-inventar/screens/einstellungen-390.png` (K) | `src/settings.ts` |
| 21 | Schriftgrößen-Panel | `src/chatsize.ts#sizePanel`; `src/client.ts#openSettings` | 2493–2543 | überarbeitet durch `450291c3` | `/tmp/staffel-inventar/screens/schrift-1200.png` (S) | `/tmp/staffel-inventar/screens/schrift-390.png` (S) | `src/settings.ts` |
| 22 | Nach-unten-Knopf | `Pane`; `src/client.ts#Pane` | 842–1757 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/pane.ts` |
| 23 | Hover-Karte | `src/entcard.ts#attachEntityCards`; `src/client.ts#describeEntity` | 674–835 | überarbeitet durch `9727d744` | `/tmp/staffel-inventar/referenz-22-09/23-entcard-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/entity-card.ts` |
| 24 | Composer | `mountComposer`; `src/client.ts#mountComposer` | 5713–5800 | überarbeitet durch `02be3dbf` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/composer.ts` |
| 25 | Park-Hinweis | `renderParkHint`; `src/client.ts#renderParkHint` | 5785–5800 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer.ts` |
| 26 | Modell-Popover | `optSwitch("model")`; `src/client.ts#optSwitch` | 6047–6159 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/referenz-22-09/10-modell-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/10-modell-390.jpg` (H22) | `src/composer-options.ts` |
| 27 | Effort-Popover | `optSwitch("effort")`; `src/client.ts#optSwitch` | 6047–6159 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/referenz-22-09/10b-effort-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer-options.ts` |
| 28 | Modellwechsel-Rückfrage | `optConfirm`; `src/client.ts#cancelConfirm` | 5809–5826, 6160–6167 | überarbeitet durch `450291c3` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer-options.ts` |
| 29 | Befehls-Popover ⌘ | `commandSwitch`; `src/client.ts#commandSwitch` | 5986–6034 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/referenz-22-09/10c-befehl-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer-options.ts` |
| 30 | Befehls-Rückfrage | `confirmCommand`; `src/client.ts#confirmCommand` | 6022–6034 | überarbeitet durch `3e619590` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer-options.ts` |
| 31 | Cache-Alter | `tickCacheAge`; `src/client.ts#tickCacheAge` | 5827–5883 | unverändert | `/tmp/staffel-inventar/referenz-22-09/10-modell-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/10-modell-390.jpg` (H22) | `src/composer-options.ts` |
| 32 | Tray | `buildTray`, `TRAY`; `src/client.ts#buildTray` | 6168–6191 | überarbeitet durch `432d0b0a` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (S) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/composer.ts` |
| 33 | Prompt-Verlauf | `openHist` über `#histbtn`; `src/client.ts#openHist` | 17610–17638 | unverändert | `/tmp/staffel-inventar/screens/history-1200.png` (S) | `/tmp/staffel-inventar/screens/history-390.png` (S) | `src/history.ts` |
| 34 | Zeitplan | `renderAutoDlg` über `#autobtn`; `src/client.ts#renderAutoDlg` | 16949–17194 | unverändert | `/tmp/staffel-inventar/referenz-22-09/12-schedule-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/12-schedule-390.jpg` (H22) | `src/schedule.ts` |
| 35 | Live-Zeile | `setLive` über `#live`; `src/client.ts#setLive` | 6374–6417 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/composer.ts` |
| 36 | Tastenreihe | `#keys`; `src/client.ts#KEYS` | 6359–6373 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (S) | `src/pane.ts` |
| 37 | Befehls-Chips | `renderChips`; `src/client.ts#renderChips` | 9724–9747 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/composer.ts` |
| 38 | Ablegen-Fläche | Drag-Handler; `src/client.ts#Pane` | 842–1757 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/pane.ts` |
| 39 | Bild-Lightbox | `openLightbox`; `src/client.ts#openLightbox` | 17848–17920 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/lightbox.ts` |
| 40 | Neu-Version-Knopf | `armReload`; `src/client.ts#armReload` | 9750–9780 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/notification.ts` |
| 41 | Post-Land-Alarm | `renderPostLandAudit`, `src/plaudit.ts#postLandAlarm`; `src/client.ts#renderPostLandAudit` | 9866–10138 | in Arbeit durch `17b3a28f` (Basis `e0e496c8`) | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 42 | Fehler-Toast | `toast()` (27 Aufrufe); `src/client.ts#toast` | 17639–17680 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/notification.ts` |
| 43 | Spalte + Kopf | `setBoard` über `.boardtoggle`; `src/client.ts#setBoard` | 2898–2939 | überarbeitet durch `d824fca7` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 44 | Suite-Strecke | `renderSuiteMeter`; `src/client.ts#renderSuiteMeter` | 3141–3314 | in Arbeit durch `17b3a28f` (Basis `d9f4b413`) | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 45 | Gate-Anzeige (aufgeklappt) | `gateSection` über `.smtog`; `src/client.ts#gateSection` | 3069–3140 | überarbeitet durch `432d0b0a` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 46 | Maschinenhinweise deploy/Fehler | `deploySection`, `errorsSection`; `src/client.ts#deploySection / errorsSection` | 3585–3698 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 47 | Kopf/Identität + Nachfolge-Zeilen | `renderBoard`, `srow`; `src/client.ts#renderBoard` | 4576–5712 | überarbeitet durch `432d0b0a` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 48 | Session-Menü ⋯ | `mbtn.onclick` → `boardMenuOpen`; `src/client.ts#renderBoard` | 4576–5712 | überarbeitet durch `4034a266` | `/tmp/staffel-inventar/referenz-22-09/17-infomenue-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 49 | Setup + Kontextpakete-Chip | `renderBoard` „Setup"; `src/client.ts#renderBoard` | 4576–5712 | überarbeitet durch `450291c3` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 50 | Änderungen (Commit/Diff/Rebase/Land/Shelve/Undo) | `renderBoard`; `src/client.ts#renderBoard` | 4576–5712 | überarbeitet durch `3e619590` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 51 | Risiko-/Land-/Commit-/Mittendrin-/Verify-Dialog | `showRiskPreview`, `showLandReview`, `showCommitPreview`, `confirmMidRun`, `showVerifyOutput`; `src/client.ts#showRiskPreview / showLandReview` | 2016–2417 | überarbeitet durch `3e619590` | `/tmp/staffel-inventar/referenz-22-09/27-slotkill-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 52 | Verlauf / Dateien / Prompts (Reiter) | `renderBoard`, `fileTreeSection`, `boardFold`; `src/client.ts#fileTreeSection / renderBoard` | 4064–4137, 4576–5712 | überarbeitet durch `c29d30e9` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 53 | Lanes-Abschnitt + Verwerfen-Bestätigung | `renderBoard`, `discardArm`; `src/client.ts#renderBoard` | 4576–5712 | überarbeitet durch `f97dbf10` | `/tmp/staffel-inventar/referenz-22-09/07-info-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 54 | Hilfsgeräte-Abschnitt (ohne Fokus-Pane) | `devicesSection`; `src/client.ts#devicesSection` | 3359–3504 | überarbeitet durch `432d0b0a` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/devices.ts` |
| 55 | Teilen-Dialog | `openShareDlg` (⋯ „Share…", 💬 in der Zeile); `src/client.ts#openShareDlg` | 16921–16948 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/share-dialog.ts` |
| 56 | Codex-Bindung | `openCodexDlg` über `.needline` (Zeile 5 „Codex lost track…", 00-1200); `src/client.ts#openCodexDlg` | 9134–9253 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/codex-dialog.ts` |
| 57 | Fensterrahmen (alle sechs) | `src/shell.ts#openShell`; `src/shell.ts#openShell` | client: 14990–16425; Kern in src/shell.ts | in Arbeit durch `8bf4ffe6` (Basis `364b194f`) | `/tmp/staffel-inventar/screens/queue-1200.png` (S) | `/tmp/staffel-inventar/screens/queue-390.png` (S) | `src/shell.ts` |
| 58 | Aufgaben-Fenster | `openQueue` über `#queuebtn`; `src/client.ts#openQueue` | 14990–16425 | überarbeitet durch `f2084049` | `/tmp/staffel-inventar/screens/queue-1200.png` (S) | `/tmp/staffel-inventar/screens/queue-390.png` (S) | `src/queue.ts` |
| 59 | › Ansichten + Werkzeugzeile | `openQueue`; `src/client.ts#renderQueue` | 14598–14989 | überarbeitet durch `f2084049` | `/tmp/staffel-inventar/screens/queue-1200.png` (S) | `/tmp/staffel-inventar/screens/queue-390.png` (S) | `src/queue.ts` |
| 60 | › Aufgaben-Detail + Aktionen | `renderQueueDetail` über `qSelect`; `src/client.ts#renderQueueDetail` | 13356–14597 | unverändert | `/tmp/staffel-inventar/referenz-22-09/20-queuedetail-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/20-queuedetail-390.jpg` (H22) | `src/queue.ts` |
| 61 | › Löschen | `mk("✕ delete")` → `qAct`; `src/client.ts#qAct` | 12333–12455, 13356–14597 | unverändert | `/tmp/staffel-inventar/referenz-22-09/24-queue-mehr-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/queue-390.png` (K) | `src/queue.ts` |
| 62 | › Programm-Detail | `renderProgramDetail`; `src/client.ts#renderProgramDetail` | 12456–13190 | unverändert | `/tmp/staffel-inventar/screens/queue-1200.png` (K) | `/tmp/staffel-inventar/screens/queue-390.png` (K) | `src/queue.ts` |
| 63 | › Dispatcher-Fuß | `openQueue`; `src/client.ts#openQueue` | 14990–16425 | unverändert | `/tmp/staffel-inventar/referenz-22-09/06-queue-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/06-queue-390.jpg` (H22) | `src/queue.ts` |
| 64 | Aktivität (Lands/Commits/Audit/Akte) | `openActivity` über `#auditbtn` 🛡, `#outcomebtn` 🧾, ⋯ mehr; `src/client.ts#openActivity` | 16426–16920 | überarbeitet durch `f2084049` | `/tmp/staffel-inventar/screens/aktivitaet-1200.png` (S) | `/tmp/staffel-inventar/screens/aktivitaet-390.png` (S) | `src/activity.ts` |
| 65 | Dateien-Fenster + Datei-Ansicht | `openExplorer` („Open explorer"), `showFileView`; `src/client.ts#openExplorer` | 3699–4436 | in Arbeit durch `17ceb928` (Basis `c29d30e9`) | `/tmp/staffel-inventar/referenz-22-09/18-explorer-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/explorer.ts` |
| 66 | › Datei-Editor | `openFileEditor` („✎ edit this file"); `src/client.ts#openFileEditor` | 7641–7701 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/explorer.ts` |
| 67 | Review-Fenster | `openReview` („View diff", Datei-/Commit-Zeilen); `src/client.ts#openReview` | 10320–12332 | überarbeitet durch `d9e2f98c` | `/tmp/staffel-inventar/referenz-22-09/19-review-1200.jpg` (H22) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/review.ts` |
| 68 | Kontextpakete-Fenster | `openPacks` (Setup-Chip); `src/client.ts#openPacks` | 4444–4527 | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/packs.ts` |
| 69 | Gründungsfenster (Picker) | `openPicker` über `.slot.empty` („free · start a session"); `src/client.ts#openPicker` | 8424–8594 | überarbeitet durch `136dfd70` | `/tmp/staffel-inventar/referenz-22-09/25-picker-1200.jpg` (H22) | `/tmp/staffel-inventar/referenz-22-09/25-picker-390.jpg` (H22) | `src/picker.ts` |
| 70 | › Ordner-Detail + Harness-Wahl | `showDirDetail`, `appendSpawnOptions`; `src/client.ts#showDirDetail / appendSpawnOptions` | 7062–7482 | überarbeitet durch `c4bba5d0` | `/tmp/staffel-inventar/screens/gruendung-1200.png` (K) | `/tmp/staffel-inventar/screens/gruendung-390.png` (K) | `src/picker.ts` |
| 71 | Eigene Seiten Hub · Teilen · Helfer | `src/hub.ts`, `src/share.ts`, `src/helper.ts` (`public/*.html`); `src/hub.ts`, `src/share.ts`, `src/helper.ts` | — (eigene src/*.ts, keine Client-Fläche) | unverändert | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | außerhalb `client.ts` |
| 72 | Einstellungsfenster: Gerät, Schrift, Fleet | neu: siehe Symbol; `src/client.ts#openSettings / fleetSection` | 2455–2897 | überarbeitet durch `450291c3, 814b0bec` | `/tmp/staffel-inventar/screens/einstellungen-1200.png` (S) | `/tmp/staffel-inventar/screens/einstellungen-390.png` (S) | `src/settings.ts` |
| 73 | Exportdialog: Inhalt und Format | neu: siehe Symbol; `src/client.ts#openExportDlg` | 9570–9653 | überarbeitet durch `4b969878` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/export.ts` |
| 74 | Notizblock je Worktree | neu: siehe Symbol; `src/client.ts#notepadBlock` | 4528–4575 | überarbeitet durch `229227be` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/board.ts` |
| 75 | Repo-Blatt im Queue-Fenster | neu: siehe Symbol; `src/client.ts#repoSheetFacts / renderRepoDetail` | 13191–13355 | überarbeitet durch `f1036efb` | `/tmp/staffel-inventar/screens/queue-1200.png` (K) | `/tmp/staffel-inventar/screens/queue-390.png` (K) | `src/queue.ts` |
| 76 | Gründung: Rolle, Profil/Kontext, Repo | neu: siehe Symbol; `src/client.ts#gfStep1 / gfStep2 / gfStep3` | 7810–8423 | überarbeitet durch `136dfd70, c4bba5d0` | `/tmp/staffel-inventar/screens/gruendung-1200.png` (S) | `/tmp/staffel-inventar/screens/gruendung-390.png` (S) | `src/founding.ts` |
| 77 | Eigene Idee als Queue-Zeile | neu: siehe Symbol; `src/client.ts#openIdee` | 16633–16709 | überarbeitet durch `47f0a5a9` | `/tmp/staffel-inventar/screens/idee-1200.png` (S) | `/tmp/staffel-inventar/screens/idee-390.png` (S) | `src/idea.ts` |
| 78 | Handy-Zeilenmenü ⋯ | neu: siehe Symbol; `src/client.ts#toggleRowMenu` | 9676–9723 | überarbeitet durch `485190bc` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/schublade-390.png` (K) | `src/sidebar.ts` |
| 79 | Explorer: Inhalts-/Pfadsuche | neu: siehe Symbol; `src/client.ts#fxSearchInput / openExplorer` | 3700–4436 | überarbeitet durch `d666595b` | `/tmp/staffel-inventar/screens/00-basis-1200.png` (K) | `/tmp/staffel-inventar/screens/00-basis-390.png` (K) | `src/explorer.ts` |
| 80 | Maschineneinstellungen als Anzeige | neu: siehe Symbol; `src/client.ts#machineSection` | 2591–2642 | überarbeitet durch `7f02d644` | `/tmp/staffel-inventar/screens/maschine-1200.png` (S) | `/tmp/staffel-inventar/screens/maschine-390.png` (S) | `src/settings.ts` |

## Grenzflächen des mechanischen Schnitts

Die Schnittziele in der letzten Spalte sind **Vorschläge**, keine bereits existierenden Dateien. Zu übertragen wären jeweils die genannte Render-/Öffnerstrecke und ihr lokaler UI-Zustand. Im `client.ts` bleiben zunächst `api`/`post` (247–255), die zentralen Session- und Aufgaben-Snapshots (416–534), `Pane` samt Terminal/WebSocket (842–1757), `focused`/`layout` (1758–1760) sowie die Aufrufstellen; die neuen Module erhalten diese als schmale Argumente/Callbacks. `src/shell.ts#openShell`, `src/popover.ts#popover` und `src/dialog.ts#askRisk` sind die vorhandenen Hüllen, nicht noch einmal zu extrahieren. Die Bereichsangaben sind Such-/Schnittfenster; bei `renderBoard`, `openQueue`, `openExplorer` und `openReview` liegen mehrere Unterflächen ineinander, daher ist keine Tabellenzeile ein unabhängiger Copy/Paste-Block.

Gekoppelte Stellen, die vor einem Split zusammengezogen werden müssen: `renderBoard` (4576–5712) liest `fleet`, `focused`, Worktrees, Gate/Suite und Notizblock; `openQueue` (14990–16425) teilt `tasksList`, `dispatch`, `qAct` und `renderQueueDetail`; `openExplorer` (4138–4436) benutzt Datei-/Git-Caches ab 3699 sowie `showFileView`/`openFileEditor` bei 7483–7701; die Gründung (7810–8594) teilt `pk*`-Auswahl, `spawnBody`, Harness-Daten und Sessionstart; Composer-Popover (5801–6167) teilen `compOpts`, Slot-/Harness-Wahl und `popover()`. `e2e/` und Security-Pins lesen einzelne Quellbereiche; deren Anpassung gehört in die spätere Split-Lane, nicht in diese Messnotiz.

## Restliche Flächen und je ein Schnittziel

„Restlich“ heißt hier: kein abgeschlossener, flächenspezifischer Umbau aus den gelesenen Commits oder laut Auftrag noch in Arbeit. Gemeinsames Chat-Material (`364b194f`) zählt allein nicht als Abschluss der enthaltenen Dialoge. Eigene Seiten (71) sind aufgeführt, liegen jedoch laut Ausgangsinventar außerhalb des UI-Programms.

| # | Restliche Fläche | Ziel | Geteilter Anschluss bleibt zunächst in `client.ts` |
|---:|---|---|---|
| 7 | „⋯ mehr"-Fach | `src/sidebar.ts` | `fleet`, `renderSlots`, `focused`, `setDrawer` |
| 9 | Aufmerksamkeit 📣 | `src/attention.ts` | Aufmerksamkeits-/Report-Snapshot, `api` |
| 10 | Betriebs-Eingang 📥 | `src/attention.ts` | Aufmerksamkeits-/Report-Snapshot, `api` |
| 11 | Hilfsgeräte 💻 | `src/devices.ts` | Geräte-Snapshot, `api` |
| 13 | Session-Zeile + Hover-Leiste | `src/sidebar.ts` | `fleet`, `renderSlots`, `focused`, `setDrawer` |
| 15 | Umbenennen (inline) | `src/sidebar.ts` | `fleet`, `renderSlots`, `focused`, `setDrawer` |
| 17 | Zugangs-Token | `src/auth-panel.ts` | Token-Submit/API |
| 22 | Nach-unten-Knopf | `src/pane.ts` | `Pane`, `focused`, WebSocket |
| 25 | Park-Hinweis | `src/composer.ts` | `compEl`, `focused`, `Pane` |
| 28 | Modellwechsel-Rückfrage | `src/composer-options.ts` | `compOpts`, Harness-/Slotdaten, `popover()` |
| 31 | Cache-Alter | `src/composer-options.ts` | `compOpts`, Harness-/Slotdaten, `popover()` |
| 33 | Prompt-Verlauf | `src/history.ts` | `focused`, Verlauf-API |
| 34 | Zeitplan | `src/schedule.ts` | `focused`, Autos-Snapshot |
| 35 | Live-Zeile | `src/composer.ts` | `compEl`, `focused`, `Pane` |
| 36 | Tastenreihe | `src/pane.ts` | `Pane`, `focused`, WebSocket |
| 37 | Befehls-Chips | `src/composer.ts` | `compEl`, `focused`, `Pane` |
| 38 | Ablegen-Fläche | `src/pane.ts` | `Pane`, `focused`, WebSocket |
| 39 | Bild-Lightbox | `src/lightbox.ts` | Bild-Aufrufstellen |
| 40 | Neu-Version-Knopf | `src/notification.ts` | `toast`-/Reload-Aufrufstellen |
| 41 | Post-Land-Alarm | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 42 | Fehler-Toast | `src/notification.ts` | `toast`-/Reload-Aufrufstellen |
| 43 | Spalte + Kopf | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 44 | Suite-Strecke | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 45 | Gate-Anzeige (aufgeklappt) | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 46 | Maschinenhinweise deploy/Fehler | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 47 | Kopf/Identität + Nachfolge-Zeilen | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 49 | Setup + Kontextpakete-Chip | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 50 | Änderungen (Commit/Diff/Rebase/Land/Shelve/Undo) | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 52 | Verlauf / Dateien / Prompts (Reiter) | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 53 | Lanes-Abschnitt + Verwerfen-Bestätigung | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 54 | Hilfsgeräte-Abschnitt (ohne Fokus-Pane) | `src/devices.ts` | Geräte-Snapshot, `api` |
| 55 | Teilen-Dialog | `src/share-dialog.ts` | Share-API, `focused` |
| 56 | Codex-Bindung | `src/codex-dialog.ts` | Kandidaten-API, `focused` |
| 60 | › Aufgaben-Detail + Aktionen | `src/queue.ts` | `tasksList`, `dispatch`, `qAct`, `openShell()` |
| 61 | › Löschen | `src/queue.ts` | `tasksList`, `dispatch`, `qAct`, `openShell()` |
| 62 | › Programm-Detail | `src/queue.ts` | `tasksList`, `dispatch`, `qAct`, `openShell()` |
| 63 | › Dispatcher-Fuß | `src/queue.ts` | `tasksList`, `dispatch`, `qAct`, `openShell()` |
| 65 | Dateien-Fenster + Datei-Ansicht | `src/explorer.ts` | `fx*`-Caches, `showFileView`, `openShell()` |
| 66 | › Datei-Editor | `src/explorer.ts` | `fx*`-Caches, `showFileView`, `openShell()` |
| 68 | Kontextpakete-Fenster | `src/packs.ts` | `BriefSetup`, `openShell()` |
| 70 | › Ordner-Detail + Harness-Wahl | `src/picker.ts` | `pk*`, Harnessdaten, Sessionstart |
| 71 | Eigene Seiten Hub · Teilen · Helfer | `src/hub.ts` / `src/share.ts` / `src/helper.ts` | keiner; eigene Seiten |
| 73 | Exportdialog: Inhalt und Format | `src/export.ts` | Export-API, `focused` |
| 74 | Notizblock je Worktree | `src/board.ts` | `fleet`, `focused`, Worktree-/Gate-/Suite-Snapshot |
| 75 | Repo-Blatt im Queue-Fenster | `src/queue.ts` | `tasksList`, `dispatch`, `qAct`, `openShell()` |
| 78 | Handy-Zeilenmenü ⋯ | `src/sidebar.ts` | `fleet`, `renderSlots`, `focused`, `setDrawer` |
| 79 | Explorer: Inhalts-/Pfadsuche | `src/explorer.ts` | `fx*`-Caches, `showFileView`, `openShell()` |
| 80 | Maschineneinstellungen als Anzeige | `src/settings.ts` | Prefs-Registry, Server-Snapshot |

Offene Beweisgrenze: Die Pfade mit `H22` oder `K` brauchen eine funktionierende Fixture mit belegten Sessions und je eine neue gezielte Aufnahme. Die im Auftrag genannten Zeilen `929f6a26` (Lane-Namen), `17b3a28f` (Bugs/Alarmkarten/Suite), `17ceb928` (Explorer X3b) und `8bf4ffe6` (Desktop/Mobile-Schnitt, Zweig overhaul) sind hier nur Auftragsstand; ein gelandeter Commit dafür wurde im angegebenen `git log` nicht gefunden. `89c336b9`/Lupe und `37d4e5c8`/Arbeitsanzeige sind über die gelandeten Commits `9727d744` bzw. `02be3dbf` sichtbar.

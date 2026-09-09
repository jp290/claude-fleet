---
frage: Halten die fuenf Datenschicht-Befunde der Fable-Session vom 2026-09-09 einer adversariellen Nachpruefung am Code und am Live-Zustand stand?
urteil: B1, B2, B4 bestätigt; B3 und B5 teilweise — Kernmechaniken und Zahlen reproduzieren sich (20/44 pending exakt, 7069 Trail-Dateien exakt), aber die Note-Recovery-Datei ist kein Arbeitsgedächtnis, und zwei B5-Angaben (TRAIL_MAX_FILES-Name, ~25477) halten nicht.
bereich: [gegencheck, datenlayer, autonomie]
belege: [server.ts#tickInboxNudge, server.ts#sendText, server.ts#detachSlotTasks, server.ts#boundProgramForMain, server.ts#tickDispatch, server.ts#queueStateSave, server.ts#capTasks, server/persist.ts, e2e/trail-emit.ts, composer.ts#composerResidue]
nicht-gemessen: Composer-Inhalt der Panels per tmux (wer die 49 Zeichen wirklich tippte), fsync-Kosten je Save (nur mtime-Frequenz), Prozess-Env jenseits der watchdog.sh-Startzeile, e2e-Suiten.
stand: 2026-09-10
---

Gegenchcheck der fuenf Befunde (Fable, 2026-09-09, gemessen an 42692a0a). Geprueft an HEAD
4f56c192 (42692a0a ist Vorfahr; Zeilen heute). Live-Messungen: fleet.json/`*.jsonl` in
`/Users/owner/claude-fleet` (python3), API mit Owner-Token (nur GET), Fehler- und
Pollgroessen per curl, Live-Config aus watchdog.sh:192. Keine Mutation, keine Suite ausser der
Docs-Kurzkette.

## §1 Tabelle

| Befund | Urteil | Beleg (heute) | nachgemessen vs behauptet | gepinnt in e2e? |
|---|---|---|---|---|
| B1 Zustellung | BESTAETIGT | server.ts#tickInboxNudge 11993, #tickAuditPing 11936, #tickBacklogNudge 12046, #tickMigrate 12107, #deliverMergeVerdict 19564 (je `sendText` ohne Rollback); #sendText 5579/5657; #canDeliver 8747; composer.ts#composerResidue 40 | errors: „composer occupied (49 chars)" n=8 (wie behauptet ×8) + zusaetzlich n=1 „prompt not accepted — still holds 49 chars after 3000ms"; prompts.jsonl 3120 auto-Zeilen, 0 mit `delivery` | Teilmenge: Rollback der Watch-Familie gepinnt (e2e/watch.ts, pins.ts), die Luecke der fuenf Sender nicht |
| B2 Autonomie-Naht | BESTAETIGT | server.ts#detachSlotTasks 5046 (Aufrufer 4935, 5137), #boundProgramForMain 7823, #releaseTaskForMain 8027, #tickDispatch 9922–10130, #programDispatchCap 9917, watchdog.sh:192 | 6 aktive Programs, genau eec69528/e3b3a064/9ce08219 tot-gebunden (Slot 7/9 weg, Slot 2 openedAt-Drift); pending auftrag 43, davon 20 nur-Owner (10 tot + 1 inaktiv + 9 ohne programId) vs 20/44 — exakt reproduziert | Verhalten gepinnt als beabsichtigt (e2e/tasks.ts:5570, pins.ts), die Naht-Kosten nicht |
| B3 Schattenschicht | TEILWEISE | rg `decisions\.push|evidence\.push` ueber server.ts/server/*/ts/src leer; /api/self/programs 26033 nur `proposed`; Program-Inhaltsschreiben nur in #handleOwnerProgramRoute hinter tokenGate 26835 | Datei 1 609 504 B / 60 Schluessel vs 1 608 823 / 55 (gewachsen); Selbstauskunft: „recovery register, not active Fleet state", kein Code referenziert sie | Program-Routen dicht gepinnt (e2e/programs.ts, security.ts) |
| B4 Persistenz | BESTAETIGT | server.ts#queueStateSave 2865, #saveState/#saveStateNow 2944/2953 (kein Debounce), #capTasks 2181, #setAuditPing 11861 (kein Prune) | 164 Aufrufzeilen vs 162; fleet.json 1 688 810 B (tasks 648 227, programs 275 348, events 222 646) vs 1 683 088 (628 KB/271 KB/219 KB); 7 mtime-Wechsel in 60 s vs 6 in 90 s; /api/sessions 323 841 B vs 322 203; auditPings 116 Eintraege | capTasks gepinnt (pins.ts, tasks.ts), Save-Pfad nicht |
| B5 Beweisschichten | TEILWEISE | server/persist.ts#queueEventWrite (renameSync auf `.1`, eine Generation; Latch einmalig); e2e/trail-emit.ts (kein unlink); server.ts#trailStatsView 25502 (n=400); #tickAuditPing 11872 + #adjudicationsByAudit 16956 | e2e-trail 7069 Dateien / 543 MB exakt; Trail-Zeilen gesamt 2 132 197 („~25477" nicht reproduzierbar); post-land-audits.jsonl 2 183 533 B ≈ 2,2 MB; watchdog.sh setzt FLEET_AUDIT_PING_MS=60000 → 60-s-Tick laeuft wirklich | Rotation gepinnt (e2e/restart.ts, briefstats.ts), Trail-Anhäufung nicht |

## §2 Begruendung je Befund

**B1 — BESTAETIGT.** Alle fuenf genannten Sender rufen `sendText` ohne `rollbackOwnPayload`
auf und verwerfen den `acceptance`-Rueckgabewert; nur die Watch-Familie rollt zurueck. Der
staerkste Gegenfall war Zeile 12183: `recoverFleetReportDelivery` nutzt das Rollback ebenfalls —
die Behauptung „nur tickWatches" ist also unvollstaendig, aendert aber die Kostenrechnung nicht,
weil auch dieser zweite Rollback-Sender zur Watch-Familie gehoert und keiner der fuenf
betroffenen Sender. Der zweite Gegenfall: `sendText` verweigert vor dem Paste bei belegtem
Composer (SendRefused, nichts wird getippt) — das eigentliche Einfuegen eines Owner-Entwurfs
wird also verhindert. Doch die Live-Fehler legen die schwaechere, dauerhafte Variante offen:
eine Sendung wurde getippt und nicht akzeptiert (n=1, 20:03), ohne Rollback blieb sie im
Composer liegen, und jede folgende Zustellung desselben Kanals scheitert seither an eben diesem
Rest (n=8, bis 20:16) — nach Notiz 529e5914 (98-Zeichen-Fall) liest der Residue-Leser fuer
Glyph-Formen nur EINE Zeile, die Zahl ist Lesartefakt, der Block aber real. Der Bericht
unterschaetzt: Die `delivery`-Spalte existiert in `logPrompt` (2797), kein Aufrufer setzt sie —
das Journal koennte den Zustellzustand tragen, tut es strukturell nicht.

**B2 — BESTAETIGT.** `detachSlotTasks` schreibt bei jedem Teardown `sent → pending`
(Kommentar: absichtlich zurueck zum Owner), `boundProgramForMain` verlangt slot+openedAt, und
`releaseTaskForMain` lehnt ohne live Binding ab — die Kette traegt. Die Zahl „20 von 44"
rekonstruiert sich auf die Zeile genau (heute 43 pending, da eine Zeile weiterlief; dieselben
20: 10 in tot-gebundenen aktiven Programs, 1 in inaktivem, 9 ohne programId). Live-Config
(watchdog.sh:192) bestaetigt die drei Randbehauptungen: kein FLEET_BACKLOG_NUDGE_MS → Tick nie
registriert (23927); FLEET_ANALYSIS_MS=0 → Kollisionslesung (innerhalb `if (ANALYSIS_ON)`,
~10094) tot; FLEET_LANE_AUTOCLOSE=1 → der Autoclose-Pfad laeuft wirklich. `dispatchTask`
requeue't bei Fehlschlag ohne Versuchszaehler (nur der Analyst hat `attempts`) — latent wie
behauptet. Der Bericht unterschaetzt: Der Programm-Deckel ist nicht nur inert, er ist
harmlos, WEIL der Repo-Deckel (live FLEET_DISPATCH_MAX_LANES=1) ohnehin zuerst greift — die
20 nur-Owner-Zeilen sind das eigentliche Nadelöhr, nicht die Deckel.

**B3 — TEILWEISE.** Bestaetigt: Kein `decisions.push`/`evidence.push` irgenwo; die Self-Tuer
erzeugt nur `proposed`; Program-Inhalte (inkl. decisions/evidence) werden ausschliesslich in
`handleOwnerProgramRoute` geschrieben (confirm merge Korrekturen, ~22678), und diese Route
steht hinter `tokenGate(tokenFrom(req))` — Bearer/Cookie/Query gegen das Owner-TOKEN. Ein
MAIN-Self-Token ist ein anderer Schluessel und scheitert an `secretEq` → 401. Es gibt
wirklich keine MAIN-schreibbare Program-Flaeche. Widerlegt: Die Note-Recovery-Datei ist nicht
„das Arbeitsgedächtnis des Controllers" — sie traegt selbst `purpose: "Repair Controller note
archival; single recovery register, not active Fleet state"`, `capturedAt` 2026-09-08T09:40,
und kein Code im Baum referenziert sie (nur Codex-Sitzungslogs). Sie ist ein totes
Recovery-Register einer einmaligen Reparatur, kein lebender Zustand. Der Bericht
ueberschaetzt damit die Schicht selbst und unterschaetzt die eigentliche Luecke: Dass 1,6 MB
Reparatur-Snapshot unregiert im State-Verzeichnis liegen, ist ein Hygiene-Befund, kein
Steuerungs-Befund.

**B4 — BESTAETIGT.** `queueStateSave` baut den Body synchron je Aufruf, dann write+fsync+
`.bak`-Kopie+rename+fsync(dir); `saveState` und `saveStateNow` reihen sich ohne Debounce oder
Fenster ein — die Promise-Kette serialisiert nur, sie verschmilzt nichts („Coalescing" fehlt
also genau wie behauptet, die Kette existiert aber und verhindert Interleaving). `capTasks`
haelt ALLE nicht-terminalen Zeilen unbeding („Live rows can exceed the cap"), `auditPings`
hat keinen Prune (116 Eintraege, rein appendisch). Alle Groessenordnungen reproduzieren sich
innerhalb natuerlichen Wachstums; die Save-Frequenz liegt mit 7/60 s sogar ueber der
behaupteten 6/90 s. Der Bericht ueberschaetzt leicht: /api/sessions ist kein Dump je Poll —
Program-Inhalte und Prompt-Texte sind bewusst ausgespart (TaskDigest), und der Pollplan
drosselt hidden Tabs auf 10 s (src/pollplan.ts). 323 KB alle 2 s je sichtbarem Tab bleiben
trotzdem ein messbarer Preis.

**B5 — TEILWEISE.** Bestaetigt: persist.ts rotiert auf genau eine Generation (`.1` wird
ueberschrieben), der Schreibfehler-Latch meldet einmal; e2e-trail haelt 7069 Dateien / 543 MB,
`trail-emit.ts` enthaelt kein Loeschen, und `tickAuditPing` parst pro Lauf post-land-audits
(2,18 MB, beide Generationen) plus `adjudicationsByAudit` (62 KB) mindestens zweimal — die
60-s-Kadenz ist live (watchdog.sh: FLEET_AUDIT_PING_MS=60000), mein Anfangszweifel (.env ohne
den Schalter) war falsch, die Startzeile ist der bessere Sensor. Nicht haltbar: Ein
`TRAIL_MAX_FILES` existiert nicht — die 400 sind das Lese-Cap `n` in `trailStatsView` (mit
explizitem `filesOmitted`), d.h. 6669 Dateien sind fuer Flake-Abfragen unsichtbar, aber der
Constant-Name ist erfunden. Die Zahl „~25477" ist mit keinem meiner Kommandos reproduzierbar
(gemessen: 7069 Dateien, 2 132 197 Zeilen) — UNPRUEFBAR. Der Bericht unterschaetzt: Nicht das
Rotation-Cap ist das Risiko, sondern dass bei jeder Rotation die gesamte Vorgeschichte
(5 MB Audit) endgueltig faellt, während trailstats-Termine jenseits von 400 Dateien niemand
mehr sieht.

## §3 Was der Bericht uebersehen hat (dieselbe Klasse, je mit Zeile und Kosten)

1. **Eigener Paste zaehlt als Occupant-Output** (B1-Klasse). `sendText` setzt
   `s.quietUntil` nur unter `rollbackOwnPayload` (5621–5625); der Output-Wachter
   unterdrueckt lastOutput-Updates nur bis `quietUntil` (10201). Ohne das Flag speist
   Fleets eigener Paste die Idle-Messung des Slots — die gescheiterte Zustellung
   verschiebt damit auch noch die `busy`-Werte derselben `canDeliver`-Kette, die sie
   wiederholen will. Kosten: Automation verfaelscht ihren eigenen Aktivitaetssensor;
   Messartefakt und Block-Spirale aus B1 verstaerken sich gegenseitig.
2. **prompts.jsonl: 19 MB, keinerlei Rotation** (B4/B5-Klasse). `logPrompt` (2797) haengt
   an eine eigene Kette mit blankem `appendFile` — nicht durch `queueEventWrite`, also ohne
   die 5-MB-Rotation, die nur audit.jsonl hat (persist.ts-Kommentar: „today that's just
   AUDIT_FILE"). Gemessen 19 082 149 B / 12 338 Zeilen, streng wachsend, gelesen von
   Continuity-Views. Kosten: unbegrenztes Journal plus Voll-Parse in jedem Continuity-Lesen,
   dieselbe Klasse wie der B4-Vollsave, aber ohne auch nur einen Deckel.
3. **Prozess-lokale Nudge-Budgets vs. Watchdog-Restarts** (B2-Klasse). `migrateTried`,
   `backlogNudgeTried`, `inboxNudgeTried`, `reviewAutoTried` sind Modul-Maps; der Kommentar
   bei `MigrateAttempt` (~12003) nennt das Reset-bei-Restart ausdruecklich gewollt. Der
   Deploy-Ritual-Kommentar in `queueStateSave` zaehlt `kill-session -t srv` ~10×/Tag, und der
   Watchdog startete den Server heute um 19:27 neu — die Inbox-Nudge-Fehler 20:03–20:16
   (B1) laufen direkt nach eben diesem Restart mit frischem Budget an. Kosten: Jeder
   Restart reaktiviert alle Erinnerungs-Budgets; ein dauerhaft blockierter Kanal (B1) wird
   pro Restart erneut bis zum Deckel probiert statt einmalig verworfen.

## §4 Nicht gemessen / inferiert

- Wer die 49 Zeichen im Composer wirklich tippte (Fleets eigener, nicht zurueckgerollter
  Payload vs. fremder Entwurf) ist INFERIERT aus der Fehlerreihenfolge (n=1 „not accepted"
  vor n=8 „occupied") und Notiz 529e5914; ein tmux-Lesen der Panels unterblieb (Eingriff in
  laufende Panes, hier read-only vermieden).
- Save-Frequenz nur als mtime-Wechsel gemessen (7 in 60 s, ein Zeitfenster 21:5x); fsync- und
  Kopierkosten je Save nicht profiliert.
- „~25477" (B5) mit `wc -l` ueber alle Trail-Dateien (2 132 197) und Dateizaehlung (7069)
  geprueft und nicht reproduziert; keine weitere Hypothese getestet.
- Prozess-Env des Servers nur ueber watchdog.sh:192 belegt; ein direktes Environ-Lesen
  unterblieb (Sensorenregel). /api/errors und /api/sessions mit Owner-Token nur gelesen (GET).
- e2e-Suiten nicht ausgefuehrt (Auftrag:Docs-Kurzkette); „gepinnt in e2e?" beruht auf
  Quelltext-Lektuere der Pins, nicht auf deren Lauf.

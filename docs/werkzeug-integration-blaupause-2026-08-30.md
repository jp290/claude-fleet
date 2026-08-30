---
frage: Welche Werkzeuge aus den fuenf Lauf-Audits vom 2026-08-30 gehoeren in Workflow und Entwicklungsumgebung von claude-fleet/Game-Maker (und welche nicht), in welcher Reihenfolge, und wie werden sie geschnitten?
urteil: >
  Die gemessenen Verluste sitzen in drei Klassen — Brief-Loecher, Env-Reibung, fehlende stehende
  Werkzeuge/Rueckkanaele — und keines davon ist ein Arbeiterfehler. Der hoechste Ertrag je Aufwand
  liegt NICHT in Code, sondern in einem stehenden Briefprofil (ENV-Block, Render-Pflichtfeld,
  Report-Zeile, ToolSearch-Zeile, Orchestrierungs- und Pre-Check-Regeln): reiner Text haette am
  2026-08-30 die wirkungslose R11-Land (11,0 min, 4,54 USD, plus Folgelane R12 mit 17,8 min und
  5,98 USD) und je Lane ~5 Calls/1,5 min Env-Reibung verhindert. Danach folgen vier kleine
  Spiel-Repo-Werkzeuge (capture, seal+KIT, pixelcmp/serve-pair), eine triviale Fleet-Meldung
  (Report-Ist-Zahl), ein git-basierter branch-Watch als Rueckkanal fuer nicht-automatable Lanes
  und der Kaltstart-Schnitt pack.ts; nach dem Nachlesen der zwischendurch gelandeten
  infra-reichweite-Notiz zusaetzlich die Hook-Guard-Drossel (402 Nudges : 9 Nutzungen) als
  Bau-Eintrag. Verworfen: Deckel-Anhebung des fleet-report, graphify-Erstbau im Spiel-Repo
  (bedingt, mit Lane-E-Zahlen), Auto-Archiv fuer stale pending.
bereich: [game-maker, lane-lifecycle, verify]
belege:
  - docs/messungen/2026-08-30-lane-audit-akt2-r7-r9-glm.md (zit. [akt2-r7-r9])
  - docs/messungen/2026-08-30-lane-audit-akt2-r10-r13-glm.md (zit. [akt2-r10-r13])
  - docs/messungen/2026-08-30-lane-audit-critic-main-glm.md (zit. [critic-main])
  - docs/messungen/2026-08-30-kontext-packs-game-maker-glm.md (zit. [packs])
  - docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md (zit. [synthese])
  - docs/messungen/2026-08-30-worktrail-audit-stufe2-kontext-modellmix.md (zit. [stufe2])
  - docs/messungen/2026-08-30-private-repo-o-prozess-forensik-anhang.md (zit. [anhang])
  - docs/messungen/2026-08-30-game-maker-instrument-audit-glm.md (zit. [instrument])
  - docs/messungen/2026-08-30-infra-reichweite-frische-glm.md (zit. [infra]; erst waehrend dieser
    Arbeit auf main gelandet — s. nicht-gemessen)
  - Code am heutigen Baum: server.ts, lane-signals.ts (jede Code-Aussage selbst per rg/sed geprueft)
  - Spiel-Repo /Users/owner/private-repo-o.worktrees/game-maker-private-repo-o-fresh @ f4973b5 (AGENTS.md, HANDOFF.md, tools/-Inventar)
nicht-gemessen:
  - Die fuenfte Audit-Notiz (infra-reichweite) war beim Start NICHT verfuegbar (weder main noch
    Schwester-Worktree fleet-260830124819-b585, beide geprueft) und die Erstfassung dieser
    Blaupause rankte ohne sie; sie landete WAHREND der Arbeit auf main (1daa00e) und wurde
    nachtraeglich per git show main: gelesen und eingearbeitet (B7 Drossel neu in die Bau-Liste,
    §3.2 graphify mit ihren Zahlen revidiert). Vor dem Land war ihr Inhalt nicht einsehbar.
  - Controller-Befunde von heute (5 Hand-Watcher gegen die Watch-Weigerung; task-create-Quoting)
    sind UEBERNOMMEN (Controller-Session gemessen), nicht von dieser Lane nachgemessen; die
    Watch-Weigerung selbst ist am Code verifiziert (server.ts:6753).
  - Alle Einsparungs- und Aufwandszahlen sind GROSSORDNUNGEN aus den Audits bzw. eigene Schaetzungen
    (dann als [schaetz] markiert), keine Kalkulation.
  - Keine Transcripts gelesen (das haben die Audits erledigt); kein Spiel-Repo-Verify gefahren
    (read-only).
stand: 2026-08-30
---

# Werkzeug-Integration in claude-fleet — Blaupause (Entscheidungsvorlage, 2026-08-30)

Owner-Auftrag (Wortlaut): „guckt sich das alles nochmal im Kontext zu claude fleet an und
ueberlegt ob es sinn macht und welche tools wir in den workflow oder die entwicklungsumgebung
einbauen sollten. Bzw wie wir das alles verbessert aufsetzen koennten um dem beizukommen."

Diese Datei ist PROPOSE. Promoten kann nur der Owner (Loader-Vertrag). Alle Zeilenverweise auf
Code beziehen sich auf den Baum dieses Worktrees (fork von main 86cf406); Zeilenverweise in
Audits auf deren Messbäume sind als Zitat gekennzeichnet.

---

## 1. Lagebild (eine Seite)

**Alle fuenf Audits tragen derselben Dreiteilung, und keine der Kosten ist ein Arbeiterfehler:**

### Verlustklasse A — Brief-Loecher (teuerste Einzelposten)

- **R11, wirkungslose Land:** 11,0 min, 4,54 USD, 46 Calls — die Lane rechnete Lichtseite gegen
  Schattenseite in WELT-Koordinaten; die Kamera sieht per Konstruktion die Schattenseite
  (camera.ts:131–151, Blickachse +z). Folgekosten: MAIN-Pixelnachmessung + komplette Folgelane
  R12 (17,8 min, 5,98 USD). „Der teuerste Posten des Tages" [akt2-r10-r13, R11-Sonderfrage].
  R12s Brief enthielt die Bezugsflaechen-Anweisung („RECHNE FUER DAS, WAS DIE KAMERA SIEHT") —
  und R12 lief fast ohne Selbstbeschaffung: „das Gegenexperiment zu R11 und der staerkste
  verfuegbare Beleg dafuer, dass das Pflichtfeld im Brief der richtige Hebel ist."
- **R7, Boundary-Roundtrip:** 5,5 min, ~12 Calls — drift.test.ts kodierte die gespiegelte
  Lenkung, der Brief schloss src/input/** aus der Schreibflaeche aus; needs-main statt Fix
  [akt2-r7-r9, R7.1]. Ein grep von MAIN vor dem Filing haette die Datei vorausfreigegeben.
- **R13, mehrdeutige Mutationsvorgabe:** 1 Extra-Loop („nimm deine Bedingung heraus" liess sich
  zweideutig lesen) [akt2-r10-r13, R13.3].
- **Erstlauf-Klasse:** die Lenk-Spiegelung ueberlebte jede grueene Breaker-Kette und beide
  MAINs [synthese, Wurzel 1] — der Konventions-Pin ist seit der Owner-Taste Pflicht-Breaker
  (private-repo-o AGENTS.md Regel 1, VERIFIZIERT am Spiel-Repo @ f4973b5).

### Verlustklasse B — Env-Reibung (immer dieselben vier Posten)

- **Frischer Worktree ohne node_modules + Scratch-Modulaufloesung:** alle 7 vermessen Worker-Lanes
  (R7–R13) bezahlten je ~4 Calls/~1 min [akt2-r7-r9 Sammelabschnitt 1; akt2-r10-r13 Sammelabschnitt 1];
  `bun install` selbst dauert ~40–62 ms.
- **Report-Deckel 4000 ueberrascht:** an EINEM Tag 12 fehlgeschlagene POSTs (R10:1, R11:3, R12:6,
  R13:1; [akt2-r10-r13 Sammelabschnitt 4]) plus R9-Verdichtung 4,2 min/9 Calls [akt2-r7-r9, R9.1];
  die Grenze stand in keinem der Briefs (R7-Ausnahme bestätigt die Regel).
- **Shell-/Hook-Stolperer:** GNU timeout existiert nicht; `verify | tail` mit erhoehtem Timeout
  wird vom Hook blockiert (16 BLOCKED im Private-repo-o-Lauf, ~136 historische im Fleet-Slug
  [infra F7]); ungequotete Globs rotten — je Frischsession neu gelernt [akt2-r10-r13, R11.2/R12.3].
- **Screenshot-Bytes:** R7 73 % (541/740 KB), R8 83 % (624/751 KB), R10 968 KB in 27 Calls inkl.
  Vollplatten-`find` [akt2-r7-r9 R7.2/R8.1; akt2-r10-r13 R10.1]; Critic: 7,69 MB Read-Bytes =
  99,6 % seiner Result-Bytes [critic-main, Faktenkasten 1].

### Verlustklasse C — fehlende stehende Werkzeuge / Rueckkanaele

- **MAIN orchestriert mit Wegwerf-Instrumenten:** 46 % Wanduhr Wartezeit (53,6 min in 116 min,
  groesster Block 24 min um den seriell geschalteten Critic — vermeidbar per Parallelierung)
  [critic-main, 2.1]; ~20 min Hands-on-Messtechnik, alle Werkzeuge (pixelcmp.py, Sealed-Pack-Bau,
  Checkpoint-Pflege mit ~20 Substitutions-Calls) nur im Scratchpad [critic-main, 2.2–2.4].
- **Kein Fleet-Rueckkanal fuer GLM/pi-Lanes:** POST /api/self/watch verweigert kind:"lane" auf
  nicht-automatable Harnesses ehrlich (server.ts:6753, VERIFIZIERT; Begründung: aliveInfo faltet
  harnessAutomatable in alive, server.ts:4613, und beide looking-Prädikate verlangen alive ===
  true, lane-signals.ts:49/:75). Die Controller-Session baute dafuer heute 5× einen Hand-Watcher
  (Hintergrund-Loop auf ahead/clean) [Controller-Befund, uebernommen].
- **Task-Erzeugung aus einer Session ist Quoting-Akrobatik** (python3+urllib von Hand)
  [critic-main, Sammelabschnitt 7].
- **Board-Muell:** 127 stale pending-Tasks bis zum Owner-Sweep heute (VERIFIZIERT: fleet.json
  jetzt 124 archived + 3 pending).
- **Post-Land-Audit wertlos fuer Nicht-Fleet-Repos:** 11/11 Audits unknown (exit 42), Fehldiagnose
  kostete 2 Doku-Commits + 1 Attention [anhang, Gate-Realität; synthese V6].
- **Kaltstart-Ganzlesen:** B2 las ~71 KB Card + ~54 KB Vorgaenger-Quellen, R4 ~170 KB Render-
  Quelle; der 68-KB-Card-Call lieferte wegen Persistenz nur 2,3 KB — der Vertrag war faktisch
  ungelesen [packs, §1.2/§1.3].
- **Nudge-Ökonomie (Fleet-MAIN):** 402 Search-Nudges + 28 Read-Nudges gegen 9 echte graphify-
  Nutzungen in 8 Sessions (45:1); Worst-Case-Session 198 Nudges ≈ 47 KB injizierter Mahntext
  [infra F5]. Im Spiel-Lauf: null Nudges, null Graph, null Nutzung [infra F1].

**Kernzahl der Relationen:** die Env-/Report-Reibung aller 7 Lanes zusammen (~20 Calls/6 min
R10–R13 + ~15 Calls/4 min R7–R9) ist KLEINER als der EINZELE Brief-Fehler R11 (11 min + 17,8 min
Folgelane + MAIN-Nachmessung). Text vor Code heisst das nicht — capture.ts und KIT sind
Werkzeuge — aber das Profil ist Rang 1.

---

## 2. Bau-Liste (gerankt nach Ertrag je Aufwand)

Legende: WO ∈ {Fleet-Code, Fleet-Doku, Spiel-Repo tools/, Fleet-Skript}. Aufwand in Agenten-Stunden
[schaetz]. BELEG nennt Audit + Zahl (Code-Aussagen am heutigen Baum verifiziert).

### B1 — Game-Maker-Briefprofil (stehende Pflichtzeilen je Brief-Typ) — Rang 1

- **WAS:** Eine Profil-Sektion mit den wortfertigen Bloecken aus §5 (ENV-Block, Render-Pflichtfeld,
  Report-Zeile, ToolSearch-Zeile, Orchestrierungsregel, Write-Surface-Pre-Check), die MAIN je
  Brief-Typ kopiert; dazu der GEMESSENE-FAKTEN-Block je Lauf (Playwright-Haltetasten, SwiftShader,
  5173=Owner-Port, Pilot-Lateral-Stat) nach [packs §4].
- **WO:** Fleet-Doku — neuer Game-Maker-Abschnitt in `docs/lane-brief-template.md` (die Datei
  existiert und ist der natuerliche Ankerpunkt; keine neue Datei noetig).
- **AUFWAND:** 1–2 h (Text aus §5 zusammentragen, landen).
- **BELEG:** Verlustklassen A+B komplett: R11/R12-Gegenexperiment [akt2-r10-r13]; ~35 Env-Calls
  ueber 7 Lanes [akt2-r7-r9, akt2-r10-r13]; 12 fehlgeschlagene Report-POSTs; R7-Roundtrip 5,5 min;
  Critic-Parallelisierung ~20 min/Runde [critic-main 2.1]; getrackte Flaechen statt Memory als
  Reiseweg der Fallen [infra F4: 422 Lane-Slugs, null Memory-Erbe; ToolSearch-Zeile reicht
  laut infra F6: 31 Discovery-Calls im Lauf].
- **DONE + VERIFY:** Profil gelandet; jeder Block traegt seine Herkunftszahl im Kommentar. Beweis:
  docs-only-Kette (`bun install --frozen-lockfile && bun e2e/pins.ts`, Exit 0). Nach dem naechsten
  Lauf: die ersten ~25 Calls einer Worker-Session tragen zu 100 % den Brief-Bestandteilen an
  (Messindikator aus [akt2-r7-r9, Sammelabschnitt 6]).
- **ABHAENGIGKEIT:** keine. Reiner Text.

### B2 — fleet-report-Fehlermeldung mit Ist-Zahl — Rang 2

- **WAS:** Die 400er-Meldung der Report-Route nennt die Ist-Laenge:
  `text must be at most 4000 chars (yours: 6475)`.
- **WO:** Fleet-Code, server.ts:7572–7573 (VERIFIZIERT: heute `text must be at most
  ${MAX_FLEET_REPORT_TEXT} chars` ohne Ist-Zahl; Konstante server.ts:3240).
- **AUFWAND:** 0,5 h inkl. e2e-Zeile in der Selbst-Routen-Familie (e2e/self-token.ts uebt die
  Route bereits).
- **BELEG:** 12 failed POSTs an einem Tag [akt2-r10-r13 §4]; R9: 8 Laengenstaende in 6
  Kuerzungsrunden, 1 Ablehnung [akt2-r7-r9 R9.1]; R12: 8 POST-Versuche [akt2-r10-r13 R12.1].
  Die Ist-Zahl beendet das Zaehlen-und-Raten (R9 mass 7× nach, ob es schon passt).
- **DONE + VERIFY:** Meldung enthaelt die Ist-Zahl; e2e prueft Both-Laengen (ueber/unter Grenze).
  Beweis: volle Verify-Kette (server.ts geaendert).
- **ABHAENGIGKEIT:** keine.

### B3 — tools/capture.ts im Spiel-Repo (Serve + Playwright + benannte Regionen) — Rang 3

- **WAS:** Ein Aufruf: startet serve.ts auf freiem Port, laedt eine definierte Startbedingung
  (Seed/t/Query-Params), macht benannte Regionen-Shots, skaliert PNGs auf <=256 px Breite,
  schreibt PNG+Zahlen (Leuchtdichte je Flaeche) AUSSERHALB des Worktrees, entfernt
  `.playwright-mcp/`, respektiert Port 5173 (=Owner).
- **WO:** Spiel-Repo tools/ (neben serve.ts, trace.ts — VERIFIZIERT: nur ambient.d.ts, serve.ts,
  trace.ts existieren; capture/seal/pixelcmp/serve-pair/checkpoint/ndc-probe/pack fehlen alle).
- **AUFWAND:** 3–4 h [schaetz].
- **BELEG:** R10: 27 Calls/968 KB fuer 9 Bilder inkl. Vollplatten-`find` und Cleanup [akt2-r10-r13
  R10.1]; R7/R8: 73–83 % der Result-Bytes unskalierte PNGs [akt2-r7-r9 R7.2/R8.1]; R11-Sonderfrage
  Antwort 2: „zweites, robusteres Standbein — ein stehendes Capture-Werkzeug, das auch eine
  Brief-Luecke nicht mehr teuer machen kann"; [critic-main 1.1] Kernframe-Schema halbiert die
  Bild-Bytes des Critic.
- **DONE + VERIFY:** capture.ts laeuft gegen einen Build end-to-end (PNG + Zahlen ausserhalb des
  Baums, verify ALL PASS unberuehrt); ein Aufruf ersetzt R10s Dreischrift take→cp→Read durch
  1–2 Calls. Beweis: Ausfuehrung an einem Stand + verify im Spiel-Repo.
- **ABHAENGIGKEIT:** keine (serve.ts existiert). Sinnvoll in EINER Lane mit B4 (gleiche
  Playwright-Muster).

### B4 — tools/seal.sh mit Selbsttest + Critic-ENV-KIT — Rang 4

- **WAS:** `seal.sh <sha>`: build → main.js am Root → Stempel einbrennen → minimaler Server ohne
  git → Selbsttest (beide Ressourcen HTTP 200, Canvas rendert, Konsole leer) → serve.log
  AUSSERHALB des Packs → shots/-Verzeichnis + kit.md vorangelegt (semantikfreie Mechanik-Zeilen,
  Formulierung in §5.C).
- **WO:** Spiel-Repo tools/.
- **AUFWAND:** 2–3 h [schaetz].
- **BELEG:** [critic-main 1.3]: 5 Calls/~85 s Startreibung, ausgeloesst u. a. durch die
  KONTRAPRODUKTIVE Brief-Zeile „Schreibe Screenshots auf absolute Pfade" (das MCP verweigert
  genau die) und ein serve.log im Pack; 1.4: 3 abgewiesene Code-Calls (kein require/import im
  Page-Kontext); [critic-main 2.3]: Blank-Render-Firsttry (main.js am falschen Ort), 50 s Fix;
  [packs] Ranking 1: „die zwei, die beim naechsten Lauf sofort existieren sollten".
- **DONE + VERIFY:** seal.sh laeuft end-to-end auf einem Stand; der Selbsttest faengt den
  gemessenen Fehlerfall (main.js fehlt am Root → rot, nicht Blank); `grep -iE 'card|handoff|
  hypothese|urteil|erwartung' kit.md` liefert leer (Blindheits-Nebenbedingung). Beweis: Ausfuehrung
  + verify im Spiel-Repo.
- **ABHAENGIGKEIT:** keine.

### B5 — watch-kind „branch": git-basierter Rueckkanal fuer nicht-automatable Lanes — Rang 5

- **WAS:** Drittes Watch-Kind neben lane/merge/audit/deploy: feuert auf `clean + ahead > 0 +
  idle >= Schwelle + kein gitOp + kein blockierter Merge` — OHNE die alive-Klausel. Nachricht
  bleibt Server-Praedikat („kein Bericht der Lane — Pane lesen"). kind:"lane" und seine
  Weigerung bleiben unberuehrt.
- **WO:** Fleet-Code: lane-signals.ts (dritte Regel-Liste + Selektor-Arm, rein — die Datei ist
  dafuer gebaut: Spezifikation und Implementierung in einer Liste), server.ts Watch-Route
  (~server.ts:6725–6760, kind „branch" ueberspringt die automatable-Weigerung server.ts:6753),
  Tick-Auswertung (server.ts:11831 folgt laneWatchSignal — dort den dritten Arm),
  docs/self-api.md §watch.
- **AUFWAND:** 4–6 h inkl. e2e (Watch-Familie: e2e/watch.ts) [schaetz].
- **BELEG:** server.ts:6753 VERIFIZIERT — die Weigerung begruendet sich selbst („its slot never
  reads as alive"); der Kommentar ebenda (Messung 2026-08-29) dokumentiert den armed-forever-Fall;
  der merge-watch feuert bereits auf genau solchen Lanes (Präzedenz im selben Code-Kommentar,
  server.ts:6746–6752): Beobachten ist nicht Fahren. Controller-Session baute heute 5× Hand-Watcher
  [uebernommen]. Inputs sind alle host-seitig vorhanden (gitInfo, lastOutput→idleMs,
  laneSignalView server.ts:20534) — der Schnitt ist klein, weil das Praedikat eine reine Funktion
  ueber Fakten bleibt, die der Tick ohnehin rechnet.
- **DONE + VERIFY:** In einer Test-Instanz abonniert eine Session {kind:"branch"} auf eine
  nicht-automatable Lane mit clean+ahead und wird GENAU EINMAL geweckt; toter Ziel-Slot entwaffnet
  wie heute („session gone or replaced"); e2e in e2e/watch.ts. Beweis: volle Verify-Kette +
  e2e-isolated (Watch-Familie + Tick beruehrt).
- **ABHAENGIGKEIT:** keine. Design-Grenze: die alive-Klausel von done-looking selbst NIEMALS
  lockern — die haengt an auto-③ (Session-Spawn) und der Land-Route (server.ts:8319); der
  branch-Watch notifiziert nur.

### B6 — Spiel-Repo-Messtechnik-Stapel (pixelcmp.py, serve-pair.sh, checkpoint.py, ndc-probe.ts) — Rang 6

- **WAS:** MAINs Wegwerf-Instrumente als tools/: (a) `pixelcmp.py` — 9 PATCH-Regionen als
  benannte Flaechen, Leuchtdichte vorher→nachher, Doku-Zeile „nur bei identischem Weltzustand";
  (b) `serve-pair.sh` — zwei Staende parallel (Wegwerf-Worktree + zweiter Port, Startbild t=0,
  gleicher Seed); (c) `checkpoint.py` — Feld-Setter fuer die Checkpoint-Felder + Budget-Pruefung
  (4096 B) VOR dem Commit; (d) `ndc-probe.ts` — Weltpunkt/Mittellinie durch die echte
  Chase-Kamera.
- **WO:** Spiel-Repo tools/.
- **AUFWAND:** (a)+(b) 2 h; (c) 2 h; (d) 1–2 h [schaetz; teils existieren die Ad-hoc-Versionen
  im Controller-/MAIN-Scratchpad als Vorlage].
- **BELEG:** [critic-main 2.2]: ~6 min pixelcmp-Wiederaufbau je Lichtfrage, „jede kuenftige
  Licht-Frage baut das Instrument neu" (LEHRE A); [critic-main 2.3]: seal-Erstversager; 2.4:
  ~20 Substitutions-Calls + Byte-Budget-Nachbesserung + selbst gefangener fabrizierter SHA;
  [akt2-r7-r9 R7-Kontext-Pack]: ndc-Sonde als tools/ndc-probe.ts = „5,2-min-Beweis-Bau → 30-s-
  Aufruf"; HANDOFF Next @ f4973b5: „VERSCHIEDENE BUILDS parallel serven" — serve-pair ist die
  Maschine dafuer.
- **DONE + VERIFY:** je Tool: ein Aufruf ersetzt den dokumentierten Ad-hoc-Weg (Beispiel in der
  Task-Zeile nennen); verify ALL PASS; checkpoint.py lehnt >4096 B vor dem Commit ab (der
  gemessene Fall „Committed 13 bytes over budget").
- **ABHAENGIGKEIT:** keine. (a)+(b) VOR dem naechsten A/B-Lauf; (c)+(d) spaeter moeglich.

### B7 — Hook-Guard-Drossel: graphify-Nudge nur 1× je Session — Rang 7

- **WAS:** Der graphify-hook-guard (search/read) feuert seine Ermahnung nur EINMAL je Session
  statt bei jedem grep-artigen Call — Zaehlerdatei im graphify-Cache (upstream-Aenderung).
  Billigere Variante: Matcher in der Settings von `Bash|Grep` auf `Grep` verengen.
- **WO:** graphify upstream (hooks.py) fuer die Zaehler-Variante; `.claude/settings.json` des
  Fleet-Haupt-Checkouts (gitignored) fuer die Matcher-Variante.
- **AUFWAND:** Zaehler-Variante klein-mittel; Matcher-Variante 1 Zeile (aber ungetrackt — stirbt
  mit einem Checkout-Neubau still, deshalb nur zweite Wahl).
- **BELEG:** [infra F5, verifiziert]: 402 Search-Nudges + 28 Read-Nudges gegen 9 echte Nutzungen
  in 8 Fleet-MAIN-Sessions (45:1); Worst-Case-Session 198 Nudges ≈ 47 KB Mahntext — Kontextkosten
  genau in dem Band, das der Owner als Qualitaetsgrenze gemessen hat (25 %, AGENTS.md §Context
  self-management). NICHT absstellen: die 9 Nutzungen zeigen, dass der Graph Nutzen stiftet,
  wenn er frisch und erreichbar ist [infra F5].
- **DONE + VERIFY:** eine grep-lastige Session sieht den Nudge genau einmal (Zaehlerdatei
  belegt); ohne graphify-out aendert sich nichts (Spiel-Repos haben den Guard ohnehin nicht,
  infra-Reichweiten-Matrix).
- **ABHAENGIGKEIT:** keine. **Grab-Abgrenzung:** das ist NICHT das beerdigte „Hook-Pflege /
  graphify watch / Cron auf .git/hooks" — keine git-hooks, kein Cron, nur eine Drossel im
  Claude-hook-guard; die Frische-Problematik von .git/hooks bleibt unangetastet (§3.2).

### B8 — V6: Post-Land-Audit stempelt not-applicable fuer Nicht-Fleet-Repos — Rang 8

- **WAS:** Der Tier-2-Audit erkennt per Repo-Klasse, dass sein Kommando (Fleet-Guard,
  `fleet-e2e.ts`-Probe) fuer dieses Repo nie zuständig sein kann, und stempelt
  `not-applicable` mit Begruendung statt `unknown` exit 42.
- **WO:** Fleet-Code, Post-Land-Audit-Pfad (Queue/Drain; Familie: fleet-e2e-postland-audit.ts,
  e2e-Check in e2e-postland-audit.sh — die Suite MUSS mitlaufen, wenn der Pfad angefasst wird).
- **AUFWAND:** 2–4 h [synthese V6].
- **BELEG:** [anhang, Gate-Realität]: 11/11 unknown mit exit 42, MAIN-Fehldiagnose als
  „reproduzierbarer Fleet-Defekt" → 2 Doku-Commits + 1 Attention-Punkt + Hand-verify je Stand.
- **DONE + VERIFY:** ein Land in einem Nicht-Fleet-Repo schreibt eine not-applicable-Audit-Zeile
  mit Begruendung; e2e-postland-audit.ts prueft beide Klassen (Fleet-Repo laeuft weiter voll).
- **ABHAENGIGKEIT:** keine.

### B9 — task-create-Helferskript (Datei rein, POST raus) — Rang 9

- **WAS:** `./task-create.sh <briefdatei> [--repo …] [--kind auftrag]`: liest den Brief aus einer
  Datei, POSTet an POST /api/self/tasks mit dem Pane-Self-Token, gibt die Server-Antwort 1:1
  durch. Kein Token in der Kommandozeile, kein Quoting in der Shell.
- **WO:** Fleet-Skript neben state.sh/register.sh im Wurzelverzeichnis (oder scripts/).
- **AUFWAND:** 1 h.
- **BELEG:** [critic-main, Sammelabschnitt 7]: MAIN posted Briefs per python3+urllib von Hand
  (Zeile 502); Audit C Sammelpunkt 7 dieselbe Akrobatik.
- **DONE + VERIFY:** eine MAIN erzeugt eine Task aus einer Datei in einem Aufruf; Fehler
  (z. B. Deckel, falsches kind) kommen 1:1 durch; `ps`-Sicherheit (Token nur aus Env).
  Beweis: Ausfuehrung gegen die Live-API von einer Session aus + kurze Demo in der Task-Zeile.
- **ABHAENGIGKEIT:** keine.

### B10 — tools/pack.ts: Kaltstart-Schnitt (Card-Manifest + contract.ts + Signaturtabellen) — Rang 10

- **WAS:** `bun tools/pack.ts <brief>` erzeugt `build/pack-<brief>.md` (gegitignored) vom
  gepinnten HEAD: Abschnitts-Manifest der Card NUR fuer den eigenen Brief (Zeilenbereiche),
  contract.ts WOERTLICH, `git grep '^export'`-Signaturtabellen statt Vorgaenger-Implementierungen.
  Regel: das Pack ERSETZT das Card-Ganzlesen (addiert nicht).
- **WO:** Spiel-Repo tools/.
- **AUFWAND:** ~1 Tag [packs, Typ B].
- **BELEG:** [packs §1.2]: B2-Kaltstart ~127 KB (71 KB Card + 54 KB Quellen) fuer <20 KB
  slicespezifische Relevanz; [packs §1.3]: R4 ~170 KB Render-Ganzlesen ohne Priorisierung; das
  Persist-Orakel (68-KB-Call → 2,3 KB, Vertrag ungelesen) — das Pack liefert relevante Zeilen IN
  den Kontext statt Zeigern auf alles.
- **DONE + VERIFY:** pack.ts erzeugt fuer einen Muster-Brief ein Manifest mit Zeilenbereichen;
  die naechste Builder-Lane liest Pack statt Card (Brief-Zeile); Kaltstart-Bytes messbar kleiner
  (Ziel B2-Klasse ~127→~40 KB [ABGELEITET aus packs]). Anti-Rott: je Filing frisch geschnitten —
  es existiert keine zweite, pflegebeduerftige Dokumentversion.
- **ABHAENGIGKEIT:** Card braucht Abschnittsmarker (Typ-A-Template bzw. V7-Entscheidung des
  Owners). Der Katalog nennt es richtig: Beweis-Aufbau dafuer, dass Schnitte tragen, BEVOR V7
  promotet ist.

### B11 — Advisory-Zeile „stale pending" (kein Auto-Archiv) — Rang 11

- **WAS:** Die bestehende advisory Queue-Analyse (tickAnalysisSweep) druckt bei >N pending-Zeilen
  ohne Aktivitaet seit >X Tagen eine Zeile „stale pending: N — Sweep ist Owner-Handlung". Rendert
  kein Urteil, mutiert keinen Status.
- **WO:** Fleet-Code, Analyse-Pfad.
- **AUFWAND:** 1 h.
- **BELEG:** 127 stale pending bis zum Owner-Sweep heute (VERIFIZIERT: fleet.json 124 archived +
  3 pending). Die Auto-Variante ist bewusst verworfen (§3.4).
- **DONE + VERIFY:** Zeile erscheint im Analyse-Verdict (ready/needs-you-Kontext), wenn die
  Bedingung wahr ist; keine Statusaenderung (e2e: Analyse-Familie).
- **ABHAENGIGKEIT:** keine.

### B12 — API-Karte der MAIN-Rolle als Generat — Rang 12

- **WAS:** Tabelle der /api/self/*-Routen MIT Auth-Klasse (self-token/owner/lane-only) als
  Generat aus server.ts-Routen (regeneriert je Deploy), plus Spawn-Tripel-Tabelle; MAIN bekommt
  den Pfad im Founding-Brief.
- **WO:** Fleet-Doku als Generat (Skript o. ae.) + Founding-Brief-Zeile.
- **AUFWAND:** 2–3 h [packs, Typ F].
- **BELEG:** [packs §1.5]: MAIN-old feuerte 5 Probes auf 401-Routen (Transcript Z. 79–81) und
  brauchte einen Owner-Zuruf fuer das Spawn-Tripel (Z. 105).
- **DONE + VERIFY:** Karte existiert und stimmt gegen den Live-Server (Abgleich GET /api/self
  vs. Karte); die naechste Founding-MAIN braucht 0 Probes auf 401-Routen.
- **ABHAENGIGKEIT:** keine; zaehlt erst, wenn das naechste Programm gegruendet wird.

**SCHNITTLINIE (Owner-Vorgabe erfuellt):** Nach **B4** sind alle drei Verlustklassen je
mindestens doppelt bedient (A: B1-Blöcke Render-Pflichtfeld/Pre-Check/Orchestrierung; B: B1
ENV/Report + B2; C: B3+B4 Werkzeuge). B5–B12 sind geordnete Folgearbeiten — wertvoll, aber der
naechste Game-Maker-Lauf wird von keinem von ihnen blockiert.

---

## 3. Verworfen (bewusst nicht gebaut)

### 3.1 Deckel-Anhebung des fleet-report ueber 4000 Zeichen

Was der Deckel heute schuetzt (am Code VERIFIZIERT): `fleetReports` persistieren in fleet.json
(server.ts:3916) mit `FLEET_REPORT_KEEP = 20` (server.ts:3241) — der Deckel begrenzt die
State-Datei und die Lesbarkeit der EINEN Owner-Inbox. Die 12 POST-Fiaskos des Tages waren
Ueberraschungskosten (keine Ist-Zahl in der Meldung, keine Vorcheck-Zeile im Brief), nicht
Grenzkosten: R9 rettete das woertliche verify-Zitat in den Report zurueck, „statt es zu opfern —
richtig" [akt2-r7-r9 R9.1]; der Critic verlor 2/3 seines 12k-Zeichen-Berichts — die Loesung dafuer
ist Langfassung-im-Scratchpad + Verweis im Report [critic-main 1.5], nicht ein groesserer Deckel.
Kosten einer Anhebung: staetig wachsender State, schwaechere Verdichtungsdisziplin, Nutzen
ungemessen. **Ersetzt durch B2 + B1-Report-Zeile.**

### 3.2 graphify-Erstbau im Spiel-Repo + Query-Auszug ins Kontext-Pack (BEDINGT verworfen)

Nach Lesen der zwischenzeitlich gelandeten infra-reichweite-Notiz [infra] lautet die Lage mit
Zahlen: der Graph existiert nur im Fleet-Haupt-Checkout (7708 Knoten, gitignored); im ganzen
Private-repo-o-Lauf (23 Sessions, 2226 Bash-Calls, 51 Transkripte) liefen NULL graphify-Calls —
der CLI lag auf PATH, aber niemand rief ihn [infra F1, verifiziert]. Im Fleet-MAIN, wo der Graph
existiert: 9 echte query-Nutzungen in 7 Sessions [infra F1]. Daraus zwei verschiedene Schluesse
im Markt: [infra] empfiehlt „Reichweite vor Frequenz" (Erstbau ~10 min + Query-Auszug-Zeile
~30 min); diese Blaupause sieht die gemessene LANE-Last weiterhin als Ganzlesen genannter
Dateien (B2: Card + Schnittstellen; R4: render/**) — keine „wo sitzt X"-Suche [packs §1.2/§1.3]
— und pack.ts (B10) liefert dieselbe Ersparnis deterministisch (Abschnittsmarker statt
Graph-Traversal).

**Entscheidungsvorschlag (Synthese):** Die billigste Haelfte von [infra]s Fix ist frei und
bedingungslos — die Query-Auszug-ZEILE gehoert als OPTIONALER Block ins Briefprofil (B1): „Wenn
fuers Repo ein Graph existiert: 2–4 vorbereitete `graphify query`/`explain`-Ergebnisse zu den
Brief-Kernsymbolen beilegen; der Graph selbst reist nie in Lanes." Der Erstbau + der Land-Trigger
([infra] F2: nach --ff-only-Land ein detached `graphify update .` im Haupt-Checkout, ~5–15 Zeilen
Server-Code) bleiben HINTER DER KONDITION: erst bauen, wenn eine MAIN ihn im naechsten Lauf
tatsaechlich nutzen will — sonst steht ein zweiter Graph neben pack.ts ohne Verbraucher.
**Grab-Abgrenzungen (beide Varianten muessen sie tragen):** beerdigt ist „Hook-Pflege / graphify
watch / Cron auf .git/hooks" (docs/work-register-2026-08-06.md §7 — der Server bewegt main mit
--ff-only/branch -f, kein git-hook feuert, .git/hooks ist ungetrackt). (a) Der Query-Auszug ist
reine Pull-Arbeit des MAIN beim Filing — keine Hooks, kein Cron. (b) Der F2-Land-Trigger ist
SERVER-CODE im Land-Pfad, nicht .git/hooks — aber [infra] F2 misst selbst, dass genau dort die
Luecke sitzt (12 FF-Lands → 0 Rebuilds, stale bis 8h49m): eine .git/hooks/post-merge-Variante
waere das beerdigte Ding und scheidet aus (ob post-merge bei --ff-only ueberhaupt feuert, ist
gemaess [infra] ungemessen).

### 3.3 Auto-Archiv fuer stale pending-Tasks

Der Dispatcher vertraut bewusst nur Owner-Freigaben; ZWEI Maschinen-Pfade schreiben `queued`
(Requeue, Boot-Abgleich), und die Freigabe-Tuer ist eine Owner-Tuer (CLAUDE.md Dispatcher-
Abschnitt, Quell-Checkout rulebook/deploy.md). Ein Auto-Archiv wuerde an genau der Tuer rankraten,
die der Owner haelt — der Sweep von heute WAR eine Owner-Handlung, und das ist kein Bug.
**Ersetzt durch die advisory Zeile B11.**

---

## 4. Schnitt-Vorschlag (Slices, Reihenfolge, vor/nach dem naechsten Lauf)

| Slice | Inhalt | WO | Art | Aufwand | Vor naechstem Lauf? |
|---|---|---|---|---|---|
| S1 | B1 Briefprofil (§5 wortfertig) | Fleet-Doku | docs-only, MAIN direkt oder Mini-Lane | 1–2 h | **JA** |
| S2 | B2 Report-Ist-Zahl | Fleet-Code | eigene kleine Lane (server.ts + e2e) | 0,5 h | egal (frueh) |
| S3 | B3 capture.ts + B4 seal.sh+KIT | Spiel-Repo | EINE Lane, Schreibflaeche tools/ | 5–7 h | **JA** (Critic-Parallellauf) |
| S4 | B6(a) serve-pair.sh + pixelcmp.py | Spiel-Repo | gleiche Lane wie S3 oder Folgelane | 2 h | **JA** (A/B-Serving) |
| S5 | B6(b) checkpoint.py + ndc-probe.ts | Spiel-Repo | eigene Lane | 3–4 h | nein |
| S6 | B5 branch-watch | Fleet-Code | eigene Lane (lane-signals+server+e2e) | 4–6 h | nein |
| S7 | B8 V6 not-applicable · B9 task-create | Fleet-Code/Skript | je eigene kleine Lane | 3–5 h | nein |
| S8 | B7 Drossel · B10 pack.ts · B11 advisory · B12 API-Karte | gemischt | je eigene kleine Arbeit/Lane | 1–2 Tage | nein (B10 haengt an V7-Entscheidung) |

- **Reihenfolge:** S1 → S2 (parallel) → S3+S4 → *naechster Game-Maker-Lauf kann starten* →
  S6 → S7 → S5/S8.
- **Was VOR dem naechsten Lauf stehen muss:** S1 (die Briefe des Laufs tragen die Bloecke),
  S3 (Capture + Critic-KIT — der Lauf will den Critic parallel nach PLAYABLE fahren) und S4
  (HANDOFF Next @ f4973b5 will A/B-Varianten parallel serven). S2 ist trivial und faellt nebenbei.
- **Bereits in der Queue, nicht dupliziert:** Task `051cc1c2` (pending, VERIFIZIERT) — ctx-Fuellstand
  auf GET /api/self; er schliesst die Sensorluecke, auf die Context self-management (AGENTS.md)
  heute nur mit Selbstauskunft antworten kann.
- **Nicht Teil dieser Bau-Liste (bleiben Owner-Entscheidungen):** V4 (selfLand-Default) und V5
  (Quiet-Hours-Ausnahme) aus [synthese] — Politik, keine Werkzeug-Integration.
- **Host-seitig, 1 Zeile, Owner-Hand (aus [infra] F3, hier nur Erinnerung):** der Knowledge-Pointer
  `~/.Codex/knowledge` existiert nicht — Symlink auf `~/.claude/knowledge` (oder Pointer-Korrektur
  in ~/AGENTS.md) macht die portablen Arbeitskonzepte fuer pi-/Codex-Lanes erreichbar. Diese Lane
  (pi/GLM) war selbst der Testfall: Shelf lag ausserhalb der Reichweite.

---

## 5. Anhang — Wortfertige Artefakte (Copy-paste-faehig)

### A. ENV-Block (in jeden Game-Maker-Worker-Brief, direkt nach der Schreibflaeche)

```text
== UMGEBUNG (stehende Zeilen — nicht neu erfinden)

- Frischer Worktree: als ERSTES `bun install` (~50 ms aus dem Cache). Ein erster Testlauf
  ohne Install rotet an "Cannot find package 'three'".
- Scratch-Probes: Skriptdatei AUSSERHALB des Repos (Session-Scratchpad), ausgefuehrt mit dem
  Repo als cwd (cd <repo> && bun /pfad/zu/probe.ts); Imports von der Repo-Wurzel. Relative
  Pfade vom Skriptort aus scheitern.
- GNU `timeout` existiert auf dieser Maschine nicht. Laeufe mit erhoehtem Timeout NIE in
  `| tail` pipen (der PreToolUse-Hook guard-tail-pipe-on-longrunner.sh blockt das) — in eine
  Datei umleiten und den Tail lesen.
- Globs in grep-Optionen quoten: grep -rn 'muster' --include='*.ts' (ungequotet rotet in zsh).
- Port 5173 gehoert dem Server des Owners. Eigener Server: freien Port nehmen (z. B. 5273+).
- Screenshots: Playwright-MCP nimmt nur RELATIVE Pfade (schreibt .playwright-mcp/ im cwd).
  Vor dem Lesen auf <=256 px Breite kleinskalieren; Ziel max 3 Captures, benannt nach
  Startbedingung; `.playwright-mcp/` vor dem Commit entfernen (blockt das Land).
- BERICHTE: Report-Text <=3900 Zeichen. In Datei schreiben, `wc -c` PRUEFEN, erst dann POSTEN.
```

### B. Render-Pflichtfeld (in jeden Brief, der am Bild / an Licht / an Lesbarkeit arbeitet)

```text
== RECHNE FUER DAS, WAS DIE KAMERA SIEHT (Pflichtfeld fuer jeden Bild-/Render-Brief)

Deine Messgroesse ist die Bezugsflaeche, die die Verfolgerkamera SIEHT — nicht die Welt-
Bezugsebene. Rechne fuer die Flaechennormalen, die aus der Verfolgerkamera bei yaw=0 sichtbar
sind (Kartheck, beide Kartflanken, Ruecken und Aussenseiten beider Figuren; die Kamera steht
hinter dem Kart und blickt +z, src/render/camera.ts:131–151). Liefere vorher -> nachher je
sichtbarer Flaeche. Wenn deine Aenderung richtungsabhaengig ist: pruefe mindestens drei
Headings (z. B. yaw 0/90/180) und nenne den SCHLECHTESTEN Heading mit seinem Wert. Eine Zahl
gegen eine Welt-Bezugsflaeche, die die Kamera nicht sieht, zaehlt nicht.
Bilder ansehen ist erlaubt (Capture-Rezept s. UMGEBUNG bzw. tools/capture.ts) — behaupten
darfst du daraus nichts ueber MAINs Urteil; ueber das Aussehen urteilt MAIN am laufenden Build.
```

*(Vorbild: R12-Brief 10db781e, Abschnitt „RECHNE FUER DAS, WAS DIE KAMERA SIEHT" — die
Verallgemeinerung ist die einzige Aenderung gegen das Original.)*

### C. Critic-ENV-KIT-Briefabschnitt (ersetzt die kontraproduktive „absolute Pfade"-Zeile; semantikfrei)

```text
== WERKZEUG-KIT (nur Mechanik — kein Inhalt)

- Server: `bun serve.ts <port>` im Pack-Verzeichnis (Port und URL stehen im Kit). Ein serve.log
  im Pack ist Rest aus dem Bau — ignorieren, nicht lesen. Probe: curl -s http://127.0.0.1:<port>/
  | head -c 200.
- Browser-Tools: EIN ToolSearch-Aufruf nach "playwright", dann browser_navigate auf die Kit-URL.
- Screenshots NUR auf relative Pfade unter dem vorangelegten shots/-Verzeichnis (absolute Pfade
  verweigert das MCP: "File access denied").
- Eine Fahrt = EIN browser_run_code_unsafe-Aufruf: keyboard.down am Anfang, keyboard.up im
  finally, Screenshots inline ueber einen shot()-Helper (down/wait/shot/up). Zwischen Aufrufen
  laeuft das Spiel mit gehaltenen Tasten weiter — nie getrennt druecken.
- Viewport einmal fixieren (1280x800). Aufnahme-Rhythmus: je Fahrt 3–5 benannte Frames
  (Start/Mitte/Ende/Fehler), Detailshots in halber Aufloesung. Lade nur die Frames, die du
  berichtest — jede Zahl im Bericht nennt die Aufnahmen, die du dafuer geladen hast.
- Page-Kontext kennt kein require/import — Bildauswertung am geladenen Screenshot oder mit
  inline Dekoder.
- Bericht: Skelett aus dem Brief, <=3900 Zeichen (`wc -c` vorher); Langfassung in dein
  Scratchpad, nur der Verweis im Report.
```

**Kit-Datei (von seal.sh erzeugt, enthaelt NUR):** Port + URL, shots/-Pfad, serve-Startzeile,
diesen Abschnitt. **Verboten im Kit (Blindheit):** Erwartungen, Frame-Koordinaten,
Interessen-Regionen, Vorverdicte, Testnamen, Quelltext, Doku, jede Form von „sieh dir X an"
[packs Typ E; critic-main Sammelabschnitt].

### D. ToolSearch-Zeile (in jeden Brief, der Browser/Captures braucht)

```text
- Bevor du Browser oder Screenshots brauchst: EIN ToolSearch-Aufruf "playwright" und die
  Treffer selektieren — die browser_*-Tools stehen einer frischen Session nicht automatisch
  bereit (R10 fand sie so in 1 Call; R11 rief ToolSearch nie und sah kein Bild).
```

### E. Orchestrierungsregel (fuer das Game-Maker-Profil; konkretisiert V2)

```text
- Der sensory Critic startet PARALLEL zum naechsten Slice, sobald ein PLAYABLE-Artefakt
  versiegelt ist, sofern der naechste Slice nicht den gerade geprueften Sinn veraendert
  (Licht, Fahrbarkeit, HUD). Sein Bild-Verdikt zahlt auf den naechsten vollstaendigen Build
  ein. Eine Owner-Taste-Attention wird erst gefilet, wenn das Checkpoint-Feld `Critic:` einen
  Verdict traegt.
```

### F. Write-Surface-Pre-Check (MAIN-Regel vor Konventions-/Namens-/Umbenenn-Tasks)

```text
- Vor jedem Konventions-/Namens-Task: grep -rl 'Arrow\|links\|rechts' src --include='*.test.ts'
  und die Treffer vorausfreigeben (in die Schreibflaeche oder die Nicht-anfassen-Liste aufnehmen).
  R7s 5,5-min-Roundtrip um src/input/drift.test.ts war genau dieses Loch.
```

### G. Query-Auszug-Zeile (OPTIONALER Block, nur wenn fuer das Repo ein graphify-Graph existiert)

```text
- Falls fuer dieses Repo ein graphify-Graph existiert (Haupt-Checkout): 2–4 vorbereitete
  `graphify query`/`explain`-Ergebnisse zu den Kernsymbolen dieses Briefs stehen unten als
  AUSZUG dabei. Der Graph selbst reist nie in Lanes; der Auszug ist Startpunkt, nicht Beweis —
  Code und Live-Sensoren schlagen ihn.
```

*(Bedingung s. §3.2: der Block kostet nichts, feuert aber erst, nachdem der Owner den Erstbau
freigegeben hat — bis dahin bleibt er einfach unbenutzt.)*

---

## Deckung

**VERIFIZIERT (diese Lane, eigener Augenschein):** alle zitierten Code-Fakten — server.ts:3240
(MAX_FLEET_REPORT_TEXT), :7572–7573 (Meldung ohne Ist-Zahl), :3916 (Persistenz der Reports),
:4613 (aliveInfo×harnessAutomatable), :6725–6760 (Watch-Route inkl. Weigerung :6753 und
merge-watch-Präzedenz-Kommentar), :8319 (done-looking an der Land-Route), :11831 (Tick-Auswertung
der Watches), :20534 (laneSignalView); lane-signals.ts:47–53 (DONE_LOOKING_RULES), :91–96
(Selektor); pi-zai-Adapter automatable:false; Spiel-Repo tools/-Inventar (serve.ts, trace.ts,
ambient.d.ts — mehr nicht); kein graphify-out im Spiel-Repo; Task 051cc1c2 pending; fleet.json
124 archived + 3 pending; Brieftexte 10db781e (R12), 3f422975 (R7), 887756f4 (Critic) aus
fleet.json im Wortlaut gelesen; infra-reichweite-Notiz per `git show main:` ganz gelesen
(Landing 1daa00e, nach dem Fork dieses Worktrees).

**UEBERNOMMEN (aus den Audits bzw. der Controller-Session, nicht nachgemessen):** alle
Transkript-Zahlen der Audits inkl. [infra] (Dauern, Calls, USD, Bytes, Nudge-Zaehlungen,
Rebuild-Zeitachsen); die 5 Hand-Watcher der Controller-Session; alle Aufwands- und
Einsparungsschaetzungen ([schaetz]/[ABGELEITET] markiert).

**NICHT GEPRUEFT:** ob eine Anhebung des Report-Deckels die Verdichtungsqualitaet aendert
(deshalb verworfen statt erprobt); ob jpeg-Captures die Critic-Urteilsqualitaet erhalten
[packs markiert dieselbe Grenze]; ob `git post-merge` bei --ff-only feuert [infra, ungemessen];
ober der Fleet-Server heute schon einen graphify-Rebuild aus `git archive` anstoesst (das
Work-Register §7 behauptet das fuer 2026-08-06, [infra] F2 findet dafuer keinen Beleg mehr —
Widerspruch als offen markiert, fuer die Bau-Liste folgenlos, weil §3.2 ohnehin hinter der
Kondition steht).

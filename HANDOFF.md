# HANDOFF — Themen-Session „hugFaceInci" (Slot 9), 2026-08-27, zweite Fassung

Zustand wird ABGELEITET: `./state.sh` · `./register.sh` · Live-Queue. Vorgänger-Handoffs: `3cc7f95`
(erste Fassung dieser Session, dort die volle Vorgeschichte) und `820bf9a` (Controller — Private-repo-j
läuft weiter auf Slot 5, gehört NICHT mir).

Thema der Session: OpenAI/HF-Vorfall → Schwarm-Programm → Ausführung. Programm:
`docs/schwarm-programm-2026-08-27.md` · Aufträge: `briefs/schwarm-programm-auftraege-2026-08-27.md`.
Owner-Entscheid inzwischen: **`bereich` = freie Tags**, Startvokabular die neun aus dem P0-Report.

## 1. Stand der Pakete

- **P0 GELANDET** (`c098d87`): Skill-Template mit sechs Front-Matter-Feldern + leerer
  `docs/messungen/INDEX.md`.
- **P0b FLIEGT** — Slot 8, `fleet/260827120929-bb8c`, **pi-zai/glm-5.3/max**. Retrofit der 31
  Notizen. Brief trägt den Owner-Entscheid (freie Tags, neun Startbegriffe).
- **C FLIEGT** — Slot 14, `fleet/260827120935-b549`, opus/high. Schwarm-Praxis-Doku.
- **D1 FERTIG, NICHT GELANDET** — Slot 10, `fleet/260827083510-80fe`, 1 ahead, sauber. Land ist
  **zu Recht geblockt**: siehe §2. Bericht der Lane ist stark (Evidenz-statt-Verdikt-Route,
  `dirty`-Asymmetrie als eigentlicher Trennmechanismus, ihre e2e-Checks laufen erst im
  Post-Land-Audit).
- **A WARTET** auf P0bs gefüllten Index. Brief liegt fertig in der Auftragsdatei.
- **B GESTRICHEN** (1,9 % gemessen), **elfte Flake-Familie GEFILET** (`dda507d`,
  `docs/verify-tiering.md` §11.2i — offen, Fix vorgeschlagen, nicht gebaut).

## 2. WARUM D1 NICHT LANDET — nichts tun, bis Slot 16 committet

`POST /api/slots/10/merge` → `blocked: main is checked out … with uncommitted changes to server.ts`.
Das ist **lebende Arbeit von Slot 16** (GPT-5.6-Sol, cwd = Haupt-Checkout, um 13:26–13:56 editiert):
`server.ts` +44/−19 (u. a. `LANE_EXIT_FOOTER` drei→fünf Akte, `BASE_CMD`-Default), `AGENTS.md`,
`README.md`, `e2e/pins.ts|programs.ts|tasks.ts` — mit laufendem `./e2e-isolated.sh` (der
Mutex-Halter). **Nicht committen, nicht stashen, nicht checkout** — Slot 16 committet selbst, danach
D1s Merge neu anstoßen (`POST /api/slots/10/merge`, dann `{"kind":"merge","target":10}`-Watch).
D1 wird dabei server-seitig auf das neue main rebased; ihr Diff berührt `server.ts`
(`tickGit`-Vorprobe) — **Kollision mit Slot 16s server.ts-Arbeit ist MÖGLICH**; wenn der Merge
`resolved` mit Konflikten meldet, Pane lesen, nicht raten.

## 3. Die drei operativen Lehren dieser Session (alle zweimal gesehen oder gemessen)

1. **`acceptance: "unobservable"` nach `POST /send` auf eine frische Lane = in die Pane schauen.**
   Zweimal passiert (Slots 6/10, dann Slot 14): Brief liegt im Composer, Enter verpuffte im Boot.
   Fix: `tmux -L claudefleet send-keys -t s<N> Enter` nachschieben, dann ctx-% prüfen. Ein
   `observed` (Slot 8/pi) braucht nichts. Panes heißen **`s<N>`**, nicht `claude-<N>`.
2. **Ein Direkt-Commit auf main während eines laufenden Lands killt den Fast-Forward** — auch ohne
   gemeinsame Datei (P0-Land-Versuch 1, mein `2377769` fiel ins 253-s-Fenster). Und das Fenster war
   so groß, weil `.claude/skills/…` bei `ruleFor` **`conservative-default`** ist, nicht Doku.
   Reihenfolge seither: erst main-Commits, dann Land, nie beides.
3. **`last.status:"interrupted"` + `running:true` = Startmarker ohne Verdikt**, kein abgebrochener
   Lauf („the server was interrupted mid-run" liest sich dramatischer als es ist). Und ein
   `resolved/landed:false` mit `exitCode:3` + „no server.log" ist §11.2i, nicht dein Regress.

## 4. Empfänger-Problem der fliegenden Lanes — WICHTIG für die Nachfolge

P0b (8), C (14) und D1 (10) melden per `fleet-report` an **meine lane-Watches auf Slot 9**. Stirbt
Slot 9, laufen ihre Reports in 409. Nachfolge-Session: sofort eigene Watches setzen
(`POST /api/self/watch {"kind":"lane","target":8|14}` + merge-Watch auf 10, sobald Slot 16 durch
ist) — oder Panes direkt lesen. Für künftige Schwarm-Läufe: programm-gebunden öffnen (Empfänger
`program-main`, sessionunabhängig).

## 5. Offene Kleinigkeiten, geordnet

1. **Slot 16 abwarten → D1 landen** (§2). Danach läuft D1s Check-Familie erstmals im Post-Land-Audit
   — ein Rot dort zuerst gegen §11.2i und die zwei ungefahrenen Route-Checks halten.
2. **A starten**, sobald P0b gelandet ist (Brief fertig; opus/high; Verify volle Kette + isolated-
   Vorschau, steht im Brief).
3. **Rulebook-Edits sammeln** (rulebook.ts ist getrackt → volle Kette): „Zehn Flake-Familien" → elf
   (§11.2i) · watch kennt 5 Arten, Slot-Art heißt `lane` · Panes heißen `s<N>` · Verify-Zeile ist
   Vereinfachung von `watchdog.sh:91`. Ein Commit, EIN Land-Fenster.
4. **§11.2i-Fix** (bounded `has-session`-Wait vor `new-session`, zwei Stellen) — eigener kleiner
   Auftrag, Suite-Dateien → volle Kette + isolated-Vorschau.
5. D1s Folgefund (`STUCK_LOOPING_PROSE` + Anti-Drift-Check in `e2e/steward-core.ts`) · 46 alte
   `fleet-e2e-*instance-*`-Verzeichnisse unter /var/folders (nur zählen war erlaubt) · `.agents/`-
   Schreiber unbelegt (`.gitignore:49`-Kommentar nennt ~/.claude/skills, dort liegt nur graphify).
6. **B-Wiedervorlage** erst nach C, mit frischer Ledger-Messung (Einzeiler steht im Programm-Doc §B).

## 6. Grundlinien (2026-08-27, vor Wiederverwendung neu ziehen)

`lane-outcomes.jsonl`: 567 Ausgänge, 123 `killed-empty` (21,7 %) — das Erfolgsmaß des Programms.
Wiederholer: 4/211 originIds (1,9 %) — hat B gestrichen.

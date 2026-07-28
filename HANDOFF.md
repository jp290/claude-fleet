# HANDOFF — 2026-07-28 (Session 11: verifizieren, dann ausführen — die Kette läuft)

*Zustand ist ein KOMMANDO: `./state.sh` (jetzt mit Config-Sensor). Was passiert ist, steht in
`git log <letzter Handoff>..HEAD` mit Bodies. Diese Datei trägt nur, was git nicht tragen kann.*

## Was in Flug ist / die Kette

Serielle Lane-Kette, Reihenfolge durch **gemessene Kollisionen** erzwungen
(`docs/analysis-2026-07-28-verification.md` §4 — das Faktendokument dieser Session):

1. **fold — GELANDET** (`3d38960`): e2e-stage.sh, eine abgeleitete Kopier-Regel für alle sieben
   Skripte; Gate schreibt erstmals Trail-Rows. Akzeptanztest mit gespleißtem `./src/protocol`.
2. **protocol/pins — LÄUFT** (Slot 2, Brief in `<session-scratchpad>/brief-A.md`, auch unten §Briefs).
   Enthält den einzigen owner-sichtbaren Live-Bug (BACKGROUND_MARKS: 6/8 Worker-Sites unmarkiert).
3. **delete** (Intervention-Outcome) — Brief liegt: `brief-C.md`. ERSTE SCHIEBE-KANDIDATIN.
4. **merge-Härtung** (Git-Race: Abort-Exit verworfen `server.ts:3784`, tickGit-Guard, Cross-Run-
   Fall-Through) + zwei promovierte e2e-Fixes (merge.ts:377 .ok-only, security-Alias-Blindstelle).
   Landet ZULETZT (undo-Tiefe 1, most-want-back).
5. **steward-truth** (entparkt auf Owner-Signal): ref:"verify" liest `landed` nicht (`:5026`),
   Pulse-mtime-Fallback zitiert fremde Sessions, Journal-POST ohne Cap. §7 des Faktendokuments.

**Lane-Ritual dieser Session (funktioniert, n=2):** Residuum-Brief per `POST /send`, Monitor auf
Pane-Idle-Transition (Busy-Regex: `esc to interrupt|· ↓|thinking|ing… \(` — die Spinner-Verben
rotieren!), Land per `POST /api/slots/:id/merge` (NICHT /land — der verweigert bei Commits),
Ergebnis-Poll auf `/api/slots/:id/merge`, rote Audits ZUERST per Trail adjudizieren.

## Entscheidungen dieser Session (mit Owner)

- **Schnittlinie:** Tasks interact-Guard, Ring-2.3/3.4/3.5-Rest, Ring-4-Rest sind GEPARKT bis
  Anlass. Wichtig = live Defekt ODER härtet den Land-Pfad.
- **② bleibt shadow** bis N≥25 echte Verdicts — kein Schalter, eine Beweislast. Serie steht bei ~0.
- **Nächste Session öffnet NICHT mit Analyse**, sondern mit echter Arbeit durch die Fleet
  (Autonomie-Trial: Dispatcher an nach Queue-Kuration, Steward briefed nach dem Ritual oben).
  Begründung: Meta:Produktion ≈ 2:1, die restlichen Unbekannten sind Laufzeit-Unbekannte.

## Korrekturen an Session-10-Claims (Faktendokument hat die Anker)

- outcomeTally hat VIER Schreiber, propose lief 11×, promotionEligible wäre heute TRUE.
- „−260 Zeilen Fold" trägt nur TS+Shell zusammen; „158 Gate-Checks" nicht reproduziert (~104).
- Die „Ringe" existierten nur im Session-10-Scratchpad — geborgen als
  `docs/simplification-plan-2026-07-28.md` (Provenienz-Header). Ring 0 + 2.1 waren schon gelandet.

## Nicht-offensichtlicher Zustand

- **Atlas läuft:** `http://100.64.0.1:8794/` — tmux-Session `atlas` (Live-Socket), Regen alle
  120 s, `atlas.sh` im Repo. Owner-Sicht aufs Projekt ohne FS-Zugriff; nur Abgeleitetes.
- **Roter Post-Land-Audit auf 3d38960 = adjudizierter Flake:** 968/969, der eine ist FIX1 mit
  wortgleicher merge/resolver-Signatur (dokumentierte 0/1/0/1-Historie). Kein Regress des Folds.
- **Slot 7 zeigt ggf. noch ein Geister-Merge-Verdict** der Session-10-Lane `0a5b` (heute 07:46,
  am Untracked-File-Konflikt gewedgt — exakt der Lane-4-Defekt). Branch hatte 0 Commits vor main,
  gelöscht; kosmetisch, überschreibt sich beim nächsten Merge auf Slot 7.
- **81 gemergte `fleet/*`-Branch-Leichen gelöscht** (nur `--merged`, verlustfrei). 693 Sockets +
  109 Scratch-Dirs (~800 MB) gereapt; der Wachstums-Mechanismus (kein Reaper) besteht.
- **Stash vom 21.07. ist NICHT überholt** (will `klaus.example.com` aus den Host-Listen
  + share.html-Emoji). Owner-Entscheid offen; nicht anwenden, nicht droppen.
- Steward-Worktree unverändert auf 8c513df.

## Deploy-Checkliste am Ketten-Ende (Reihenfolge!)

1. `tmux -L claudefleet kill-session -t srv` (server.ts-Änderungen der Lanes 3-5 live).
2. `bun run build` (Lane 2 ändert src/client.ts; bundleStale prüfen).
3. `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` (Lane 2 ändert watchdog.sh:
   pins als Gate-Erststufe + tsc-Liste) — erst NACH dem Land der Lane.
4. Health: `curl http://100.64.0.1:8790/` + Atlas neu laden.

## Briefs (falls Scratchpad weg ist: Residuum reicht, Fakten stehen im Faktendokument)

- **delete-Lane:** propose-Block = eigene Entscheidung (audit() behalten, bumpTally kappen);
  e2e-Kopplungen umbauen statt schneiden; Persistenz selbstheilend, kein Migrationscode; die zwei
  falschen dismissed-Rows NICHT reparieren (gegenstandslos). Verify inkl. claude-gate + isolated.
- **merge-Lane:** Abort-Exit prüfen + gitRetry an rebase/abort, tickGit-Merge-Inflight-Guard,
  Fall-Through-Guard re-prüfen sobald main sich bewegt hat; Regressionstest für den Abort-Pfad;
  merge.ts:377 Platte-Beweis; security-Stray-Guard für destrukturierte Routen.
- **steward-truth-Lane:** `landed`-Feld lesen statt status!=interrupted; Pulse: transcriptFact-
  Disziplin statt mtime-Fallback; Journal-Rate-Cap. Token-Rotation als Route = eigener Entscheid.

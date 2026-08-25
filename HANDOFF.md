# HANDOFF — Controller (Slot 9, Fable), 2026-08-25

Vorheriger Inhalt (Supervisor Slot 1, 23.08.) liegt in der git-Historie. Zustand wird ABGELEITET:
`./state.sh` · `./register.sh` · Live-Queue. Hier steht nur, was daraus nicht hervorgeht.

## Rolle und Owner-Auftrag dieser Session

Diese Session hat die **Controller-Rolle vom Codex-Controller (Slot 2) übernommen** (Owner-Entscheid).
Slot 2 ist in bestätigtem Standby — ob er stirbt, entscheidet der Owner. Arbeitsmodus, vom Owner
ausdrücklich gesetzt: **Controller erörtert Probleme, AGENTEN fixen sie** — selbst nur briefen,
landen, deployen, ernten. Owner-Ziel: Fleet **autonom** laufen lassen (Apps/Spiele), Priorität
Autonomie > Funktionsfähigkeit > Härtung.

## Was diese Session geschlossen hat (Kurzform, Details in den Commit-Bodies)

1. **Die verschwundene Autonomie erklärt und behoben:** Die Authority-Kette (23./24.08.) ist
   default-deny — kein aktives Programm war promotet, jede MAIN parkte an
   `self-land not promoted (absent)`. Fix: 4 Promotions `guarded` erteilt (Programme 69305ad8,
   6fcc2971, 20081c5c, 5457c0e5), `computer-use-bridge` in `FLEET_VERIFY_CMD_REPOS` eingetragen
   (`make verify`), deployed.
2. **Bindungs-Deadlock gefunden und per Lane gefixt** (`f16b470`): Bindungen mit `sessionId:null`
   von vor dem ID-Learn erstarrten zur Dauer-409; jetzt Backfill an 4 Lernstellen inkl. Boot.
   **Der Deploy dafür steht noch aus** (siehe In-Flight) — erst der nächste Boot heilt die zwei
   erstarrten Bindungen (S1: 69305ad8, S3: 6fcc2971).
3. **Analyse-Staffel gelandet:** `docs/messungen/system-analyse-2026-08-25.md` (Opus, 459 Z.;
   Kernbefund: jeder Weg Maschine→Owner beginnt mit einem Agenten-Akt — die Fehlerklasse „der
   Agent ist das, was stehenblieb" hat keinen Kanal; Rangliste: waitingOn-Zeile je Programm ·
   Uhr im Phasenmodell · Heil-Tür für Bindung) und `docs/messungen/program-triage-2026-08-25.md`
   (GLM; 7 COMPLETE / 7 REBIND / 1 UNKLAR / 10 proposed).
4. **Codex-Hooks repariert** (`~/.codex/hooks/block-no-verify.sh`, `stop-reminder.sh`): Codex parst
   Hook-stdout strikt als JSON; Klartext/Echo brach jede Codex-Session. Lektion in
   `~/.claude/knowledge/stacks/fugen.md`.
5. Zwei Owner-Verb-Lands für die Bridge (`c5b0653`→`6a0179c` via `8ef31c8c`), ehrlich geflaggt als
   `owner via=bearer suspect=owner-token-outside-board` — das ist der Provenienz-Mechanismus, kein
   Vorfall.

## IN FLIGHT — Rückwege liegen als Watches auf Slot 9; stirbt Slot 9, neu verankern

- **Deploy wartet auf Audit:** Audit-Watch `70094433` auf `mainAfter=f16b470` feuert, wenn die
  serielle Audit-Queue leer ist → dann `POST /api/deploy` (wurde einmal korrekt mit 409
  „audit running" abgewiesen). **Ohne diesen Deploy bleiben die zwei Codex-Bindungen tot.**
- **S8** (Sol, xhigh): Türen-Inventar → `docs/messungen/autonomie-tueren-2026-08-25.md`. Läuft lang
  (großer Lesejob). Lane-Watch armed.
- **S10** (Sol, xhigh): **Stab-Review** der Systemanalyse → `system-analyse-review-2026-08-25.md`,
  endet mit **3 ausformulierten dispatchbaren Slices** — die dispatcht der Nachfolger direkt.
- **S4** (Opus): Auth-Fail-Forensik (Task `afaaaf94`) · **S13** (GLM): Hygiene-Report REPORT-ONLY
  (Task `e6edd49b`). Beide docs-only, Watches armed.
- **Pending, Startbedingung wartet:** `0c1b3145` GLM-Gegencheck der Sol-Verdikte — dispatchen
  (pi-zai/glm-5.3/high), sobald das Review auf main liegt. `d825eca6` Merge-Sensor-Fix
  (`last:"interrupted"` neben `running:true` — 3× beobachtet, kosmetisch aber unehrlich) —
  dispatchen, wenn Slots frei.

## Offene OWNER-Entscheide (nicht selbst treffen)

- **7 COMPLETE-Empfehlungen** aus der Programm-Triage ausführen? (mechanisch belegt; ein Wort genügt)
- **Hygiene-Discard**: der S13-Report liefert die SAFE-Liste; Löschen ist Owner-Akt.
- **Slot 2** (Codex-Controller im Standby) töten oder umwidmen?
- REBIND-Kandidaten (private-repo-i, Private-repo-f, Worktrail B …) wieder aufwecken? Needle ruht per Owner-Pause.

## Was der Nachfolger wissen muss, das nirgends sonst steht

- **Watch-/Report-Budget 5 pro Slot ist ein reales Koordinations-Limit** (§B.6b der Systemanalyse,
  an dieser Session bewiesen: 4 armed Watches blockten den Report der eigenen Lane 7×). Vor jedem
  Watch: Budget denken. Sols Review bewertet den Befund — Fix-Entscheid danach.
- **Nie zwei Lands parallel, und die Audits teilen denselben Mutex** — der dritte Land des Tages
  wartete ~40 min hinter Vorschau+Audits. Owner-Idee dazu: die **alte Linux-Maschine** als zweite
  Suite-/Audit-Maschine — als Programm-Kandidat aufnehmen, nicht ad hoc bauen.
- Promotion neuer Programme ist seit `fe27764` **ein Board-Klick** (Programm-Detail); default bleibt
  deny — jedes neue Programm braucht den Grant, sonst parkt seine MAIN wieder.
- Der 15-min-**Triage-Takt** (`f77be39a`, Auto auf Slot 9) beantwortet Attentions mechanisch selbst
  und bereitet nur Geschmack/Release/Identität für den Owner auf — beim Nachfolger neu anlegen,
  Autos sterben mit dem Slot.
- Codex-MAINs nach `/clear` oder resume bleiben `divergent` (Doktrin der Tür) — Owner-Rebind bleibt
  dafür der Weg; nur das null→ID-Erstarren ist geschlossen.

## Reihenfolge für die nächste Session

1. Deploy nachziehen (falls Audit-Watch noch nicht gefeuert hat) und **verifizieren, dass S1/S3
   wieder self-landen können** (Trail: `self_land_start`, kein 409 identity).
2. S8/S10/S4/S13 ernten und landen (seriell), GLM-Gegencheck `0c1b3145` dispatchen.
3. Aus Sols 3 Slices + Gegencheck die nächste Bau-Welle briefen — das ist der eigentliche
   Verbesserungs-Pfad aus der Analyse-Staffel.
4. Owner-Entscheide oben einholen, `d825eca6` dispatchen.

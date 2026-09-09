---
frage: Was entsteht in Briefschicht, Nachfolge, Client-Poll und E2E ohne Leser, was stirbt still bei Succession, und was von B1–B8 ist heute gepinnt?
urteil: Der Client liest vier gesendete Poll-Felder nicht (ganzes watches-Array, autosOn, quietHours, programsStale), der 14-KiB-Budget-Pin misst die leere E2E-Instanz statt der 200-Zeilen-Live-Queue, und von B1–B8 sind B1/B3-retry/B6 plus Stage-Lock repariert und gepinnt — B2/B4/B5/B7 und der HANDOFF-Kollisionsschreiber stehen offen, B4 und B5 gewachsen.
bereich: [briefschicht, nachfolge, client, e2e]
belege: [context-plan.ts#contextOmissionFor, context-packs.ts#CONTEXT_PACKS, context-manifest.ts#stampObservedSourceHashes, task-notes.ts#laneNoteSources, server.ts#briefAndSend, server.ts#buildSuccessionBrief, server.ts#captureProgramHandover, server.ts#reconcileAttention, server.ts#teardownSlotOccupant, server.ts#succeedProgramMain, server.ts#taskDigest, src/client.ts#refresh, src/client.ts#loadPrograms, e2e/pins.ts, e2e/programs.ts, e2e/tasks.ts, e2e/context-plan.ts]
nicht-gemessen: Live-Antwort von /api/sessions (401 — Größe rekonstruiert), Supervisor-/Generic-Rail-Nachfolge am Ledger, Browser-Renderpfad, jede Suite außer der Docs-Kurzkette
stand: 2026-09-10
---

## §1 Die vier Bereiche

### Brief-/Kontextschicht

Gelesen: context-plan.ts, context-packs.ts, context-manifest.ts, task-notes.ts komplett; server.ts#briefAndSend mit #renderContextAnchorBlock und der Exit-Footer-/Rail-Definition; server.ts#buildSuccessionBrief. Zeilenangaben des Auftrags stimmten (HEAD hier 4f56c192, jünger als das genannte 42692a0a; alle Symbole via `rg -n 'function <name>'` neu lokalisiert).

Zahlen (context-receipts.jsonl, gitignored, python3): 662 Quittungen total; letzte 24 h 14 — davon 4 MAIN-Gründungen 9 475–11 094 B und 9 Worker-Dispatches, Median 8 991 B; die drei größten Zeilen: 13 586 B (Worker, 5 Notizen), 11 094 B (MAIN-Gründung), 11 004 B (Worker, 3 Notizen). Statische Anteile: LANE_EXIT_FOOTER 1 447 B je Worker-Dispatch (≈16 % des Medians), PROGRAM_MAIN_RAIL_BLOCK ≈ 4,7 KB (RAIL_HEAD 903 + RAIL_ROLE 903 + RAIL_TAIL 2 895 B) je MAIN-Gründung.

Determinismus: Der Quittungs-Hash (sha256 über anchorBlock + planFacts) ist deterministisch — er rechnet über Konstanten (CONTEXT_PACKS) und Baumfakten (Blob-Shas am geplanten Commit, context-manifest.ts#observedSourceHash). Der gelieferte Brief ist es bewusst nicht: Notizjoin, Studio-Block, carry variieren. duplicate briefHash in 24 h: 0.

Instruktion vs Fakt: Der Worker-Brief ist Tasktext (Fakt/Arbeitsauftrag) + Notizblock (Fakt, Deckel 5 Zeilen) + Ankerblock (Zeiger) + Exit-Footer (Instruktion). Akt 1 des Footers (commit, keine untracked Dateien) wiederholt die Regel, die AGENTS.md ##Landing jedem Worktree bereits mitgibt; Akt 2/3 (curl-konkrete Report-Route, Idle-Vertrag) stehen nur im Footer — also Teil-Duplikation mit eigener Begründung. Kostenpfad ohne Deckel: keiner gefunden — carry ist auf MAX_SUCCESSION_CARRY gedeckelt, Notizen auf Cap 5, Renderer sind rein.

Pinnung der Auswahlentscheidung: contextOmissionFor ist verhaltensgepinnt — e2e/context-plan.ts (34 Checks: jede Pack genau einmal selected/omitted, erster gefallener Grund der Leiter, capability-missing- und trigger-not-matched-Fälle), die Grund-Ordnung gegen CONTEXT_PLAN_OMISSION_REASONS, und e2e/context-packs.ts kreuzt DISPATCH_CONTEXT_MODE/TRIGGERS/CAPABILITIES gegen die server.ts-Quelle. Nicht gepinnt: nichts Materielles an der Leiter selbst; die Live-Auslieferung des Repo-Manifests am Seam ist über e2e/context-packs.ts abgedeckt.

### Nachfolge-Handover

Gelesen: server.ts#succeedProgramMain, #handleSelfSucceed, #buildSuccessionBrief, #teardownSlotOccupant, #reconcileAttention, #captureProgramHandover mit #standardHandoverLines und #handoverCaptureRefusal; program-phase.ts komplett.

Was heute überlebt: die Program-Inbox (Program-Zustand), offene Attention seit ebf42e0e über die Program-Tür (reconcileAttention#survives-Klausel: `why === "handoff"` + aktives Program), der Handover-Record (Watches/Autos/historische Attentions komplett mit reArm-Zeigern, carry-forward über A→B→C seit 2026-09-09, `dropped: 0`, lossless-Refusal wenn der Record seinen eigenen Loader nicht überlebt), Lineage und Ledger-Events. Was stirbt: armed Watches (dropWatchesFor), Autos (slot-Filter), Shares, mission/awaiting — alle an den Occupant gebunden, nicht re-armed (steht so im Nachfolger-Brief: „NOTHING was re-armed — that is deliberate").

Gegenprobe am Ledger (python3, audit.jsonl + fleet.json): 12 `slot_kill … handoff`; 6 Attentions mit refusedReason „requester session ended"; davon fallen 5 zeitgleich (0–1 s Diff) mit einem Handoff-Kill desselben Slots zusammen, die 6. (c95dc0c8) ohne Kill in ±10 min. Alle 5 liegen VOR dem Fix-Commit ebf42e0e (09-09 15:18; letzte Refusal 14:04) — die Verlustklasse ist geschlossen, seitdem null neue Fälle; der jüngste Handover-Record (f170dc46, 09-09 21:45) trägt 0 obligations, dropped 0.

Bindung: attentionRequests an {slot, openedAt, sessionId}, watches an {slot, slotOpenedAt}, Autos an slot allein (als eigene Zeilenform dokumentiert); Record/Inbox an das Program. Das ist die gesunde Umkehrung der Befundklasse: Live-Pflichten sterben mit dem Occupant, Retention hängt am Gegenstand. Lücke: die Generic- und Supervisor-Rail haben kein captureProgramHandover — dort ist HANDOFF.md (409-geprüft: existiert, clean, neuer als die Session) der einzige Kanal.

### Client-Poll

Gelesen: src/client.ts#refresh (der 2-s-Poll, pollMs-getaktet) komplett, #loadPrograms, loadTaskTexts-Nähe; server.ts#taskDigest und die /api/sessions-Projektion.

Kein Vollfetch auf Timer: /api/tasks wird nur beim Öffnen des Queue-Overlays geholt, /api/programs nur bei bewegtem Poll-Digest oder 30-s-Floor (PROGRAMS_FLOOR_MS) — der Client-Timer ist diszipliniert.

Felder ohne Leser: Der Server sendet `watches` als volles Array („an armed subscription nobody can SEE is the silent state … so it rides the owner poll") — src/client.ts liest `watches` nirgends (rg über data.watches und \bwatches\b: 0 Treffer; das einzige Watch-Konzept des Clients ist das lokale mergeWatch-Set). Ebenfalls ohne Leser: `autosOn`, `quietHours` (beide unbedingte Globals) und `programsStale`. Klein an Bytes, aber exakt die Klasse „Daten ohne Leser" auf dem teuersten Pfad.

Budget: e2e/tasks.ts pinnt /api/sessions < 14 KiB — an einer frisch gebooteten E2E-Instanz mit einer angelegten Zeile. Live: MAX_TASKS=200; Rekonstruktion der Task-Digests aus fleet.json ≈ 53,5 KB allein für `tasks`, plus 16 Slots (≈183–285 B/Zeile, vom Pin selbst gemessen) plus watches — Größenordnung ≥60 KB je 2-s-Poll je offenem Tab; die frühere Livemessung 322 203 B (Notiz d53b7c98, 09-02) ist plausibel in der Klasse. Der Pin kann bei Queue-Wachstum strukturell nicht rot werden, weil seine Instanz leer startet. Nicht d53b7c98-neu gemessen am Code bestätigt: taskDigest und Slot-Projektion tragen weiterhin kein originId/sessionId.

### E2E-Abdeckung der B1–B8 (docs/messungen/2026-09-04-datenschichten-audit.md §B)

- B1 Attention stirbt bei Succession — REPARIERT + GEPINNT: survives-Klausel (ebf42e0e); e2e/programs.ts prüft verhaltensseitig, dass die offene Attention die Nachfolgerin über die Program-Tür erreicht, Watch/Auto mit kompletter Konfiguration retained bleiben und der Brief Preview-vs-Record trennt.
- B2 sauber unterbrochener Merge auto-landet — OFFEN, KEIN Pin: needsMergeReview und parkMergeVerdict bewerten nur `interrupted && conflicted > 0`; der Kommentar an parkMergeVerdict nennt die engere ⏫-Guard-Wahl selbst. Kein Check in e2e/merge.ts erwähnt den interrupted-Fall.
- B3 ff-Fenster — Retry-Hälfte REPARIERT + STARK GEPINNT (e2e/pins.ts RULE_FF-Block: bounded retry, re-rebase, RE-VERIFY, stop-on-non-green vor jedem weiteren advance, LAND_FF_RETRY_ROUNDS=2); S-Hälfte OFFEN und gewachsen: HANDOFF.md jetzt 462 KB mit 143 Commits seit 09-04 — jeder davon bewegt main und entwertet fremde Gates.
- B4 Nicht-terminale Zeilen verfallen nie — OFFEN, GEWACHSEN: 190 pending + 4 queued + 4 sent von 200 (am 04.: 107/5/2). Der capTasks-Pin deckt die Quellen-Retention (N3), nicht das Wachstum. Task a42aa900 (ASTRA C0, capTasks-Nullbudget) pending.
- B5 e2e-trail unbegrenzt — OFFEN, GEWACHSEN: 7 069 Dateien / 543 MB (am 04.: 5 925 / 443 MB); 3 831 Dateien älter als TRAIL_DEFAULT_DAYS=14; kein Reaper im Code; e2e/trailstats.ts pinnt nur die Statistikfunktion.
- B6 Audit-Evidenz lügt für Remote-Läufe — REPARIERT + GEPINNT: ranIsLowerBound (server.ts) und e2e/helper-daemon.ts prüfen Stamp und Legacy-Shape.
- B7 Ein-Generationen-Rotation — OFFEN: server/persist.ts macht weiterhin renameSync(file, file+".1"); eine Rotation fand statt (audit.jsonl.1 = 5,0 MB vom 09-07, aktive Datei 1,41 MB) — die NÄCHSTE löscht sie still. Gepinnt ist nur die Reader-Toleranz (e2e/briefstats.ts).
- B8 Maschinenhygiene — Lock REPARIERT (e2e-stage.sh pid+birth-Fingerprint, pid-loser Dir gilt als manueller Halt); server.log 611 KB unrotiert.

Pins, die Abwesenheit als Pass lesen: Zwei Scans über die 501 check/pin-Aufrufe von e2e/pins.ts (reiner Negations-Konjunkt-Scan; optionaler-Body-Scan) fanden KEINE Sonde, deren Bedingung bei fehlender Voraussetzung true wird — der Korpus verlangt positive `.includes`-Marker neben jeder Negation, und skip() ist ein eigener benannter Zustand (SKIP …, Zeile), kein Grün. Der einzige deklarierte Abwesenheitsfall ist der Docs-Kurzproof selbst, der bei fremdem Baum laut SKIPPED verweigert.

## §2 Rangfolge (max. 6)

1. src/client.ts#refresh liest `watches` nie, Server sendet es alle 2 s komplett · Gegenfall: Kommentar der /api/sessions-Projektion behauptet Owner-Sicht · Kosten: unnötige Poll-Bytes + die Unsichtbarkeit, die das Feld schließen sollte, bleibt · Verify: rg watches src/client.ts leer · Task: keine.
2. e2e/tasks.ts Budget-Pin misst die leere Instanz · Gegenfall: Live-Queue 198/200 Zeilen nicht-terminal → rekonstruiert ≥60 KB Poll vs 14-KiB-Pin · Kosten: jede 2 s je Tab, wächst mit B4 · Verify: Pins-Reparatur = Fixture mit 200 Digest-Zeilen · Task: keine (B4-verwandt a42aa900).
3. B4: capTasks räumt keine nicht-terminalen Zeilen · Gegenfall: 190 pending/200, Join auf lane-outcomes hängt für Historie · Kosten: Poll-Bytes + Owner-Lesbarkeit der Queue · Verify: fleets.json-Zählung nach Retention-Land · Task: a42aa900.
4. B5: e2e-trail ohne Reaper · Gegenfall: 7 069 Dateien/543 MB, 3 831 über dem eigenen 14-Tage-Default · Kosten: Platte + trailStats degradiert (filesOmitted blockiert never-failed) · Verify: du -sh nach Reaper-Land · Task: keine.
5. B7: persist.ts Ein-Generationen-Rotation · Gegenfall: nächste Rotation löscht audit.jsonl.1 (5,0 MB einzige Kill/Land-Spur) still · Kosten: Historie-Verlust ohne Ereignis · Verify: Rotation auslösen und .1 vorfinden · Task: keine.
6. B2: sauber unterbrochener Merge ohne Guard, ohne Pin · Gegenfall: kill-session -t_srv mitten im cleanen Land → nächster ⏫ landet den Baum des toten Laufs · Kosten: ein verkehrtes Land · Verify: e2e/merge.ts Unterbrechungs-Fixture · Task: keine.

## §3 Robust wider Erwarten — nicht anfassen

1. Die Succession-Kette succeedProgramMain → captureProgramHandover → handoverCaptureRefusal: Occupant-Paar-Join, Carry-forward über A→B→C, lossless-Refusal vor Slot-Öffnung, eine State-Cut für Bindung und Record — verhaltensgepinnt in e2e/programs.ts bis in die Preview-Zeilen des Briefs.
2. Der Zwei-Stufen-Vertrag des Poll-Digests (taskDigest): Texte, Kriterien, Pins, Verdicts reiten nie im 2-s-Poll; der e2e/tasks.ts-Probe beweist die 15-KB-Zeile im SELBEN Payload als ABWESENT, der klein gemessen wird — eine nicht-tautologische Sonde.
3. e2e/pins.ts Abwesenheit-fail-Disziplin inklusive eigenem skip()-Zustand (§1 letzter Absatz).
4. program-phase.ts: reine Projektion mit UNKNOWN als Wert, nicht als Default-Zweig — „a phase that reads READY for a row nobody can account for is worse than no phase at all".

## §4 Nicht gemessen / inferiert

- /api/sessions konnte live nicht gefetcht werden (401 ohne Board-Auth); die ≥60-KB-Aussage ist eine Rekonstruktion aus fleet.json plus den vom Pin selbst gemachten Slot-Zeilen-Kosten, keine Antwortmessung. Die 322 203 B sind Vor-Vermessung (09-02), als Anspruch geführt.
- Supervisor- und Generic-Rail-Nachfolge wurden nur am Code gelesen, nicht am Ledger gejoint (die 12 Handoff-Kills wurden nicht nach Rail aufgetrennt).
- Browser-Renderpfad (was refresh() verwirft, ohne es je zu speichern) aus Code gelesen, nicht beobachtet.
- Keine Suite außer der Docs-Kurzkette lief; die Pins-Analysen sind statische Scans über den Korpus, kein Beweis über die Laufzeit-Umgebung.
- Die Notiz-Verdicts (bf3dd138, 832b2126, d53b7c98, ae7f0f1e) sind gemeldet; der erste Posting-Versuch hinterließ je einen Quoting-Müll-Kommentar, je Notiz folgt die saubere Korrektur (offen).

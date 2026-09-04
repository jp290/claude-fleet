# Datenschichten-Audit Claude Fleet — 2026-09-04 (Baum `2b4b4ea`)

Auftrag des Owners, woertlich: „Ich will, dass die Systeme und Datenschichten von Claude Fleet
selbst, die die Agenten benutzen um zu funktionieren, robust aufgesetzt sind und sauber arbeiten."

Erhoben von einem Opus-5-Read-only-Agenten im Auftrag des 🎛 Fleet Controllers (Slot 5, Fable),
17:5x–18:0x. Zeilenverweise zeigen auf den Baum `2b4b4ea` und rotten; Symbolverweise bleiben.
VERIFIED = am Code/Ledger gelesen; INFERRED = abgeleitet. Nichts wurde mutiert, keine Suite lief.
Der Controller hat B1, B3 und die Widerlegung in der `post-land-audits`-Zeile selbst nachgeprueft
(siehe Kommentar dort); alles andere ist Agentenbefund.

## A. Inventar

| Schicht | Writer | Reader | Haltbarkeit | Deckel | Bekannte Fehlerart |
|---|---|---|---|---|---|
| `fleet.json` (1,50 MB) | `server.ts#queueStateSave` | Boot-Loader, jede Route | tmp + `wx` 0600 + fsync(file) + rename + fsync(dir) + `.bak` | `MAX_TASKS=200`, `MAX_PROGRAMS=100`, `MAX_COMMENTS_PER_TASK=50`, `UNDO_STACK_MAX=3`, `WATCH_MAX_PER_SLOT=5`, `MAX_HISTORY=100` | `capTasks` raeumt NIE nicht-terminale Zeilen → der Deckel ist keine Schranke (VERIFIED) |
| 9 × `*.jsonl` | eine gemeinsame Kette `server/persist.ts#queueEventWrite` | `#readLedger` / `#readEventLog` | `O_APPEND`, eine Zeile, kein fsync, kein Lock | Rotation bei `AUDIT_ROTATE_BYTES=5 000 000`, EINE Generation | zweite Rotation loescht still ~5 MB; Schreibfehler werden einmal gemeldet, dann verriegelt (VERIFIED) |
| `audit.jsonl` 38 238 Zeilen / 4,60 MB | `server/audit-log.ts#audit` | `/api/audit`, `slotStatsView` | s.o. | 92 % der Rotationsschwelle | Voll-Parse + Voll-Sort je Request fuer 300 Zeilen (VERIFIED) |
| `post-land-audits.jsonl` 462 | `appendEvent` in `server.ts#drainPostLandAudits`-Pfad | `newestAuditFor`, `tickAuditPing`, Boot | Zeile wird NUR AM ENDE geschrieben (`at: Date.now()`) | keiner auf der Queue | Tod mitten im Lauf = at-least-once ueber die persistierte Queue, KEIN Verlust. **Die Controller-Behauptung „Audit zu 84e3297 verloren" ist WIDERLEGT:** eine gruene Zeile, `startedAt 13:28:50 → at 13:53:31`, `ran 3602 failed 0` — der Controller hatte VOR dem Ende nachgesehen (VERIFIED) |
| `lane-outcomes.jsonl` 759 | `emitLaneOutcome` (un-awaited) | `programExecutionView` | append | keiner | `taskId`-Join haengt bereits (B4) |
| `audit-adjudications.jsonl` 133 | `writeAuditAdjudication` | `adjudicationsByAudit` | append | keiner | ganze Datei je Aufruf neu geparst, je Kandidaten-Slot in `tickAuditPing` alle 60 s (VERIFIED) |
| `inspektion-register.jsonl` | KEINER | KEINER | — | — | tote Datei, einzige mit Modus 0644 (VERIFIED) |
| git-Seite | `markLandIntent`/`recordLand` | `git notes --ref=fleet/land` (426) | git-Objekte | `UNDO_STACK_MAX=3`, `killUndoStack` | 382 lokale Branches, 344 `fleet/*`, 329 bereits gemergt, nichts pruned; `.git` 127 MB (VERIFIED) |
| Session-Zustand (Attentions/Watches/Autos/Merges) | Routen + `teardownSlotOccupant` | Ticks | in `fleet.json` | Watches begrenzt und gepruned | B1/B2 |
| `e2e-trail/` 5 925 Dateien / 443 MB | `e2e/trail-emit.ts` (jede Lane schreibt ins HAUPT-Checkout) | `trailStats`, `TRAIL_MAX_FILES=400` | Dateien | keine Retention | Reader sieht 400 von 5 925 (VERIFIED) |
| TMPDIR-Scratch | `e2e-isolated.sh` | — | Verzeichnisse | `rm -rf` NUR bei exit 0 | 115 Instanzen / 2,7 GB; 858 `fleet-*`-Dirs / 3,05 GB (VERIFIED) |

## B. Die acht wichtigsten Probleme, nach Wirkung

**B1. Eine Attention stirbt, wenn ihre MAIN succeedet — der Owner sieht die Frage nie. (M)**
Mechanismus: Attention bindet das volle Occupant-Tripel `{slot, openedAt, sessionId}`
(`server/types.ts`, AttentionRequest); `succeedProgramMain` verschiebt `program.main` auf die
Nachfolgerin, fasst `attentionRequests` aber nirgends an; das 120-s-Retirement ruft `killSlot` →
`dropWatchesFor` → `reconcileAttention` → refuse `"requester session ended"`. Beleg: 6 von 21
Attentions sind genau so refused, 3 davon heute (`f16fff33`, `5f5da618`, `65aa1937`); zwei tragen in
`audit.jsonl` DIESELBE Millisekunde wie `slot_kill … handoff`. Derselbe Teardown verwirft still die
`autos`, `mission` und armed `watches` der Nachfolgerin. Kosten: jede Uebergabe kann eine offene
Owner-Frage verschlucken; die Nachfolgerin kann „wartet noch" nicht von „kommt nie" unterscheiden.
Fix: im selben `saveStateNow`, das die Authority verschiebt, jede nicht-terminale Attention, jedes
Auto und jeden armed Watch mit Requester-Tripel = Vorgaengerin UND gleicher `programId` auf die
Nachfolgerin umhaengen; die Refusal bleibt fuer Owner-Kills. Dateien: `server.ts`,
`server/types.ts`, `e2e/programs.ts`.

**B2. Ein unterbrochener SAUBERER Merge laesst den naechsten ⏫ den Baum eines toten Laufs
auto-landen. (M)**
`mergeJob` schreibt seine Absicht vor dem ersten await und verfeinert sie nur, wenn Konflikte
bekannt sind; sonst nichts bis zum Terminalverdikt. `carriedFromPendingVerdict` und
`needsMergeReview` halten einen Re-Run NUR bei `status==="interrupted" && conflicted.length>0`.
Ein sauberer Rebase-Lauf, den das ~10×/Tag laufende `kill-session -t srv` toetet, hinterlaesst
also keinen Guard; der saubere Pfad laeuft neu, findet `tryScriptRebase` exit 0 und auto-landet,
was der tote Lauf hinterliess. Der Kommentar an der Stelle sagt, genau dieses Loch sollte der
Marker schliessen — er schliesst es nur fuer den Konfliktpfad. Fix: ein drittes Intent-Write vor
`tryScriptRebase` mit Lane-HEAD + Ziel-SHA; der Boot vergleicht — HEAD unveraendert ⇒ sicherer
Re-Run, HEAD bewegt ⇒ halten, egal ob `conflicted`. Zudem: unterbrochene Zeilen beim Laden nicht
mehr verwerfen, wenn der Worktree fehlt. Dateien: `server.ts`, `e2e/merge.ts`.

**B3. Das ff-lost-Fenster ist der ganze Verify-Lauf, und HANDOFF.md ist der Haupt-Kollisionsschreiber. (S, dann M)**
`mainSha` wird einmal gelesen, der Baum darauf rebased, das Gate laeuft ~110 s (Audits schieben
es weiter), dann `advanceIntegration` mit `git merge --ff-only`; jede main-Bewegung dazwischen
ergibt `errorReason:"ff-lost"`, und das ganze Gate ist vertan. Der Kommentar nennt das Fenster
„a few milliseconds" — das beschreibt nur den Latch, nicht das Gate. Beleg: von 57 Commits im
heutigen Fenster beruehren **21 nur `HANDOFF.md`** (37 % aller main-Bewegungen); Commit `5b2ef3b`
heisst „das ff-Fenster ist breiter als der Land-Abstand". HANDOFF.md ist EINE 90-KB-Datei mit 100
Commits seit 09-01. Fix (S): Handoff aufteilen — `docs/handoffs/<programId>.md` oder `HANDOFF.d/`,
damit ein Handoff-Commit keine main-Bewegung ist, die ein fremdes Gate entwertet; (M) den ff nach
frischem Rebase EINMAL wiederholen, solange `verify.mainSha` noch Vorfahr ist, statt ein gruenes
Gate zu verwerfen (= Fleet-Betrieb R2 `0c4a7692`, Richtung (b) unter gehaltenem Lock, Gate je
Runde neu). Dateien: `server.ts`, `rulebook/`, `state.sh`.

**B4. Nicht-terminale Task-Zeilen verfallen nie; die Queue ist das Befundregister geworden. (M)**
`capTasks` raeumt nur `done`/`archived`. Live: 107 pending + 5 queued + 2 sent = 114 von 200,
davon 42 `[P6-Zeile`-Befunde, 39 noch `pending`. Folge: nur 78 `done`-Zeilen ueberleben gegen 759
`lane-outcomes.jsonl`-Zeilen, der `taskId`-Join haengt fuer den Grossteil der Historie (der Code
gesteht es ein). Bei 200 nicht-terminalen waechst die Liste ueber ihren Deckel und der 2-s-Poll
mit. Fix: eine `befund`-Art (oder ein `disposition`-Feld) mit eigener Retention, aus `tasks` in
ein `findings.jsonl` evakuiert; altersbasiertes Archiv fuer `notiz`. Dateien: `server.ts`,
`src/client.ts`, `docs/queue-analyst.md`.

**B5. `e2e-trail/` ist unbegrenzt, sein Reader zu 93 % blind. (M)**
`e2e/trail-emit.ts` schreibt aus jeder Lane ins Haupt-Checkout, bedingungslos; `TRAIL_MAX_FILES=400`,
`TRAIL_DEFAULT_DAYS=14`. Gemessen: 5 925 Dateien, 443 MB, aelteste 2026-07-27 — nie etwas geloescht.
`trailStats` verweigert `never-failed`, solange `filesOmitted>0`: das Instrument, das §11.2l und
§11.2m adjudizierte, ist strukturell degradiert, genau wenn die Flake-Last steigt. Fix: `*.jsonl`
aelter als 30 Tage nach jedem Write loeschen; den veralteten „1115 files"-Kommentar korrigieren.

**B6. Die Evidenzfelder des Audits logen fuer jeden Remote-Lauf, und luegen weiter fuer
Nicht-Fleet-Repos. (S)**
`postLandAuditChecks` bekommt lokal die vollen Pipes, auf dem Helfer-Pfad nur den Tail — ohne
`ranIsLowerBound` in irgendeiner persistierten Zeile. Gemessen: 12 Remote-Zeilen 09-02 bis 09-04
09:26 melden `ran` 22–26, waehrend ihr `out`-Tail nach ~3 600 Checks in `ALL PASS`/`5 FAILURES`
endet; seit 10:32 heute (Deploy `52673b6`) melden Remote-Zeilen 3 597–3 621 — der Live-Pfad ist
repariert, die historischen Zeilen nicht, und die Regelbuch-Regel „Gruen an `ran` und `ms`
pruefen" liest sie als „nichts gemessen". Getrennt: 7 Zeilen eines anderen Repos melden
`ran:0 failed:0`, waehrend die Ausgabe `295 pass / 0 fail` sagt — der Parser kennt nur
`PASS `/`FAIL `-Zeilenpraefixe. Fix: `ranIsLowerBound:true` auf die betroffenen Zeilen backfillen
oder `evidence:"tail-only"` stempeln; dem Parser bun-tests Summenzeile beibringen, sonst `null`
(unknown) statt `0`.

**B7. `audit.jsonl`-Rotation vernichtet Historie, Append-Fehler sind unsichtbar. (S + M)**
`AUDIT_ROTATE_BYTES=5 000 000`, `renameSync(file, file+".1")` — eine Generation. Die Datei steht
bei 4,60 MB (92 %); die erste Rotation ist verlustfrei, die zweite loescht still ~5 MB der
einzigen Slot/Kill/Land-Spur. Jedes Ledger ausser den Gruendungs-Quittungen ist fire-and-forget,
kein fsync im Append-Pfad, `auditWriteFailed` meldet ein verklemmtes Log einmal und nie wieder —
`writeAuditAdjudication` antwortet `200 {ok:true}`, bevor die Zeile existiert. Fix (S): monotoner
`eventLogFailures`-Zaehler auf `/api/sessions`; (M) Rotation auf `.<ts>` mit N Generationen oder
Alters-Prune.

**B8. Maschinenhygiene: 3 GB ungereapter Scratch, unrotiertes Log, ein Lock, das sich
verklemmen kann. (S)**
`e2e-isolated.sh` raeumt sein Verzeichnis NUR bei exit 0 — 115 Instanzen / 2,7 GB, 858
`fleet-*`-Dirs / 3,05 GB, aelteste 08-30; nichts reapt sie, bei 22 GB freier Platte, 57 MB freien
Pages und 71 % Swap (3 634/5 120 MB), ~1,7 GB der Top-10-RSS sind Fleet-Panes. `server.log` ist
524 KB, von `watchdog.sh` appended, nirgends rotiert. Und `e2e-stage.sh` nimmt den Lock per
`mkdir`, schreibt `pid`/`birth` aber erst spaeter: ein Tod in der Luecke hinterlaesst ein
PID-loses Dir, das der Reaper als absichtlichen Park-Halt liest und NIE reklamiert — die
Maschine verklemmt, bis ein Mensch `rmdir` tippt. Fix: Alters-Reap neben dem Socket-Reap,
Log-Rotation im Watchdog, Lock-Dir mit pid+birth bauen und dann per `mv` einsetzen.

## C. Drei Dinge, die robust sind — nicht anfassen

1. **`queueStateSave`.** Eindeutiger tmp-Name, `wx` mit 0600 (Credentials nie kurz
   weltlesbar), fsync von Datei UND Verzeichnis, `.bak` zur Rename-Zeit, eine serialisierende
   Kette. Die Begruendung steht daneben.
2. **Die `openedAt`-Identitaetsdoktrin an Program-Bindungen.** Jeder Konsument
   (`programOccupancy`, `clarificationReceiverFor`, `supervisorNudge`, `boundProgramForMain`,
   der Game-Maker-Lease) prueft `slot.id === main.slot && slot.openedAt === main.openedAt`.
   Heute zeigen 4 von 7 aktiven Programs auf Slots, die andere halten (`2c073232` → Slot 7, jetzt
   MAIN von `f170dc46`), und JEDER Pfad faellt geschlossen. Nie auf einen Slot-id-Check
   „vereinfachen".
3. **Die unknown-vs-red-Asymmetrie im Audit-Klassifikator.** Timeout, exit 42, 126/127 ergeben
   `unknown`, nie ein erfundenes Rot oder Gruen — bewusst das Gegenteil von `runVerify`.
   `watchdog.sh` setzt 45 min gegen 24–25 min reale Laeufe. Folgeposten: `FLEET_POSTLAND_AUDIT_TIMEOUT_MS`
   in `e2e/pins.ts` pinnen — der 30-min-DEFAULT ist nur 83 % eines echten Laufs.

## D. Nicht geprueft

Keine Suite lief, nichts wurde mutiert. Merge-Unterbrechung, Attention-Refusal und ff-Verlust
sind aus Code plus heutigen Ledgern gelesen, nicht reproduziert. `e2e/`-Fixtures fuer
Attention/Succession/Merge nicht gelesen — ob B1/B2 schon gepinnt sind, ist offen. Ob eine
partielle JSONL-Zeile auf APFS physisch moeglich ist, nicht verifiziert (heute keine: alle
40 463 Zeilen aller neun Ledger parsen). `src/client.ts`, `share.ts`, Helper-Daemon-Protokoll,
`streams/`, `drops/`, `graphify-out/` nicht auditiert. 15 von 42 P6-Zeilen gesampelt.

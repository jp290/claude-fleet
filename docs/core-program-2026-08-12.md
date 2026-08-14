# Fleet-Core-Programm

**Stand:** 2026-08-12 · **Status:** das EINE aktive Programm-Dokument (Owner-Auftrag). Ältere Pläne
sind Quelle oder pausiert, nie konkurrierende Wahrheit. Bei Widerspruch gilt Code/Ledger/Sensor.

## Vision

Claude Fleet reift vom Lane-Dispatcher zum nahezu autonomen Arbeitskreis für Softwareentwicklung
und Instandhaltung: Repo/Betrieb verstehen → Arbeit erkennen/annehmen → Done klären → kleinsten
Ausführungsweg wählen → ausführen → proportional beweisen → verständlich berichten → aus realen
Work Trails kleine Verbesserungen vorschlagen. Maß des Erfolgs ist menschliche Entscheidbarkeit
und weniger manuelle Rettung, nicht Agentendurchsatz. Vollständige Doktrin:
`drops/agent-os-prep/owner-doctrine-adaptive-main-core-first-2026-08-12.md` ·
Gesamtkarte: `drops/agent-os-prep/claude-fleet-architecture-transition-handoff-2026-08-12.md`.

## Die vier Ausführungswege

MAIN ist adaptiver Maintainer, kein reiner Dispatcher. Pro Akt wird bewusst gewählt:

| Weg | wofür |
|---|---|
| **MAIN direkt** | kleine, klare, reversible Arbeit ohne Kollision; Preflight + voller Verify von Hand |
| **Read-only Worker** | Recherche, Audit, Gegenprüfung, Trail-Analyse |
| **Worker-Lane** | Isolation, Parallelität, unsicherer Scope, Spezialharness, eigener Diff |
| **Fleet-Hintergrundjob** | Suiten, Watches, Monitoring, periodische Analyse |

Lanes und langsame Suiten sind kostenpflichtige Werkzeuge, kein Ritual (Doktrin §3/§4).

## Full Access ist der Normalzustand (seit `fc8f4ad`, 2026-08-12)

Claude, Pi und Codex laufen mit dem vollen lokalen Zugriff des Owners: editieren, Git/Commit,
Fleet-API, tmux, Netz, unbeaufsichtigter Boot ohne Trust-/Approval-Prompt. Der pi-Zaun
(sandbox-exec) ist entfernt; codex spawnt mit Bypass-Flag plus persistiertem Trust-Eintrag;
`hostCommits` ist überall `false` — **jeder Agent committet selbst**, `POST /api/slots/:id/commit`
ist nur noch Notweg. `container` bleibt der ausdrücklich isolierte Ort. Messgrundlage:
`docs/triage/p1d-boot-matrix.md` (Loader-/Capability-/Canary-Matrix vom selben Tag).

## Gebaut · offen · pausiert

**Gebaut (Belege):** Governance-Kern P1-A (`1d28a6c`) · Context-Pack-Manifest+Validator P1-B
(`90d711c`, `context-packs.ts`) · Watch-Fix (`be7b827`, deployt `dcc271ed`) · P1-D+H0-Messmatrix
(`8c71ed6`) · Full-Access-Harness-Schnitt (`fc8f4ad`) · Bestand: Queue/Brief/Clarify/Refine,
serverseitiger Land-Pfad, Post-Land-Audit/Undo, Watches, Ledgers.

**Offen (Core-Workstreams, Reihenfolge = Abhängigkeit):**

1. **Harness-Readiness — GEBAUT 2026-08-12.** Mechanismus des Paste-Race zuerst GEMESSEN (Opus-
   Session, gerenderte Frames, codex-cli 0.147.0): Trust-Prompt und Sign-in-Screen halten den
   node-Wrapper am Leben (Probe sagt `alive`) und ein Paste+Enter BEANTWORTET den Prompt — der
   Brief ist restlos weg, ohne Fehler. Schnitt: `Harness.readiness{accept,blocks}` (nur codex
   deklariert; Marker aus den Frames, Composer-Platzhalter rotiert und ist bewusst KEIN Marker),
   `paneReadiness()` als Screen-Schicht neben `paneAgentAt`, canDeliver-Gate `blocked-screen`
   (nur „blocked" verweigert — „pending" bleibt zustellbar, sonst dunkelt jede etablierte Pane),
   und im Dispatch-Tail ein bounded Accept-Marker-Wait (`FLEET_READY_WAIT_MS`, Default 20 s;
   der 4-s-Sleep ist Gnadenfrist, nie Beweis) mit ehrlichem Requeue samt Screen-Name.
   `codex.automatable:true` — gekoppelt an die Naht, Pin erzwingt „ein Entscheid, zwei Felder".
   Gegenproben: e2e/tasks.ts f3 (Trust · Sign-in · Ready-Composer · Timeout, node-Fixtures).
2. **Typed Rückkanal — GEBAUT 2026-08-13** (`638114f`, genau eine Codex-Lane, gpt-5.6-sol high).
   Eine Watch-Vollendung wird ZUERST ein persistiertes `FleetEvent` (ID, `kind`
   lane-ready/host-commit-ready, geschlossene typisierte Payload aus `laneWatchSignal`-Fakten —
   kein Text-Escape), die Pane-Zustellung ist nur noch Transport. Zustände
   pending → send-uncertain → delivered → acknowledged | receiver-gone; `send-uncertain` wird VOR
   dem `sendText` persistiert (Crash-Grenze bleibt sichtbar, nie blinder Replay, nie erfundenes
   Ack). Ack: `POST /api/self/events/:id/ack`, hart an `slot+openedAt+sessionId` gebunden,
   idempotent; ersetzte Session/fremder Slot 409. Sichtbar in `GET /api/self` (eigene) und am
   Owner-Poll (`events`, komplett). Legacy-Watches laden ohne erfundene Zustellung; Retention
   prunt nur Terminal-Zustände. Elf Gegenproben in `e2e/watch.ts`. Gate-Rot war 1 Fixture-Flake
   (`silent-alive`, Same-Tree-Rerun ALL PASS), Post-Land-Audit grün (2080 Checks/0, 897 s),
   Deploy `d38097fc` live, End-to-End-Canary (Watch → Event → Zustellung mit Event-ID →
   Ack + Idempotenz) real durchgeführt. Quelle: Harness-Brief §5.3.
3. **Provenienz P2 — P2-A GEBAUT 2026-08-13** (`2fbdf09`, genau eine Codex-Lane, gpt-5.6-sol
   high; P2-B Context/Skills/Capabilities, P2-C Join-Report und P2-D Taskklassen bleiben OFFEN).
   Schnitt: Root-Tasks minten `originId = id` an allen drei Intake-Nähten (Owner/Intake/Steward),
   Refine-Kinder erben die Klammer (`t.originId ?? t.id`) mit je eigener frischer `taskId`;
   `dispatchTask` stempelt `taskId`/`originId` auf den Slot (das `releasedBy`-Muster: gesetzt nach
   openSlot, auf open/kill geleert, persistiert, überlebt Restart); `buildLaneOutcome` emittiert
   `...(s.taskId ? {taskId} : {})` + originId auf JEDER Disposition und dazu `harness`/`effort`
   mit exakt der `model`-Semantik (angeforderter Pin, null = Default-Adapter, nie über
   `harnessOf()` nachaufgelöst). Manuelle Lanes und Alt-Rows bleiben feldlos (Absenz = „kann
   nichts sagen"), Reverted-Rows erfinden nichts, kein Backfill, kein `programId`. Gegenproben:
   e2e/tasks.ts (Mint/Refine/Legacy-Load) + e2e/outcomes.ts (Dispatch-Stempel, Restart-Persistenz,
   explizit/Default-Pins, manuelle Lane, Reverted, Legacy-Ledger). Post-Land-Audit grün
   (2090 Checks/0, 771 s), Deploy `9f3fa372` live. Ehrlicher Canary-Befund: die P2-A-Lane selbst
   lief noch auf dem Vor-Deploy-Server — ihre eigene Row trägt die Felder korrekt NICHT; die erste
   Row mit voller Provenienz schreibt die nächste taskgebundene Lane nach diesem Deploy.
4. **MAIN-direct-Naht — GEBAUT 2026-08-13** (`1bbedc7`, eine Codex-Lane; Phase-1-Befund davor:
   keine nachträgliche Ableitung möglich, `writeLandNote` ist best-effort und `finishLandsInFlight`
   verweigert erfundene Provenienz — also explizites Protokoll statt Git-Heuristik). Schnitt:
   `/api/self/main-direct` (GET Sicht + `preflight`/`finalize`/`abandon`, Self-Token, nur
   Nicht-Lane), Server liest beide Integration-HEADs selbst, Session-Bindung
   `slot+openedAt+sessionId`, Finalize idempotent per Vorgangs-ID+`mainAfter` (Widerspruch 409;
   `landed` verlangt bewegten HEAD gleich Claim), abandon/expire mit Pflicht-Grund, Preflights
   persistiert/boot-validiert/`stale` sichtbar ohne Reconciler. Ledger bleibt
   `lane-outcomes.jsonl` (`origin:"main-direct"`); Lane-Reader filtern, `state.sh` weist
   MAIN-direct separat aus, Lane-Zahlen byte-gleich. Post-Land-Audit grün (2062 Checks),
   Deploy `0c5d4f26` live. Nutzungspflicht der MAIN-Sessions ist Doktrin, kein Zwang im Code.
5. **Proportionale Verifikation — GEBAUT 2026-08-13** (`b09f6c4`, genau eine Codex-Lane,
   gpt-5.6-sol high). Schnitt: pures Modul `verify-proportion.ts` (geschlossener Step-Katalog
   install/pins/tsc/build/clean-review/security/claude-gate; konservative Grobzuordnung, Zweifel ⇒
   volle Kette; `isolatedPreview` true/false/"self-assess"), `GET /api/self/gate` trägt
   `localProof` (Lane-Diff `baseSha...HEAD`; Git unbeantwortbar ⇒ `null` = „fahre die volle
   Kette", nie ein leeres Array), `AGENTS.md` §Verify ist der proportionale Vertrag. Der
   serverseitige Land-Gate (`VERIFY_CMD`), Post-Land-Audit, Red-Check-/Same-Tree-Regel und
   isolated-Regel sind byte-gleich unverändert — der lokale Beweis ist der schnelle, der Gate der
   autoritative, kein zweiter Verify-Service, keine Memoisierung. Gegenproben: Mapper-Funktionsfälle
   + Route-Fixtures in e2e/self-token.ts, Pins ergänzt. Post-Land-Audit grün (2102 Checks/0,
   773 s), Deploy `ebc2dcfe` live. ③-Review `covered`, 3 Findings, alle eingeordnet unschädlich
   (Eskalations-Lattice heute korrekt · uniformes null ist der bewusste konservative Vertrag ·
   Rename-Drift fällt auf den identisch-strengen Default). **P2-A-Live-Canary bestanden an genau
   dieser Lane:** ihre Outcome-Row trägt erstmals `taskId`/`originId` (`edf08ee5`),
   `harness:"codex"`, `effort:"high"`.

6. **Worker-Migrationskorridor Codex — SCHNITT 1 GEBAUT 2026-08-13** (`3e60648`, genau eine
   Codex-Lane, gpt-5.6-sol high, Task `7159c484`; Owner-Entscheid: interne Wegwerf-Worker
   schrittweise von Claude auf Codex, Spark für Micro-Text-Worker, Qualität vor Usage). Schnitt:
   headless Transport `workerViaCodexExec` (`codex exec` in Arrayform via Bun.spawn, Prompt über
   stdin, `--ephemeral -s read-only --skip-git-repo-check --color never --json -o <tmp> -m`,
   Binary-Test-Naht `FLEET_CODEX_EXEC_BIN`, Cleanup im finally, kein Claude-Fallback — Fehler
   bleibt benannter Workerfehler) · geschlossene per-Worker-Routing-Tabelle `WORKER_ROUTES`
   (kein globaler Schalter; `FLEET_WORKER_HARNESS`-Semantik unberührt) · NUR `summary` →
   `codex-exec` mit Konstante `gpt-5.3-codex-spark`; Rückweg explizit
   `FLEET_WORKER_ROUTE_SUMMARY=claude`, ungültiger Wert fällt auf den Default ·
   `SummaryResult` trägt wirkliches `model`, `backend:"codex-exec"` und NUR beobachtete `usage`
   (sonst absent, nie geschätzt). Präzedenz in runWorker: Test-Stand-in (`spec.cmd`) → Route →
   Claude-Session; damit sind alle Alt-Suiten byte-gleich. Gegenproben in e2e/summary.ts
   (argv/stdin/-o, Cache, Nonzero/Timeout/Missing-Output, tmp-Cleanup, Rollback, Worker-
   Isolation; der Timeout-Check kostet real 180 s pro isolated-Lauf). Post-Land-Audit grün
   (2117 Checks/0, 974 s), Deploy `4d416e63` live. **Live-Canary bestanden:** ein echter
   Summary-Lauf in 7,7 s mit `backend:"codex-exec"`, `model:"gpt-5.3-codex-spark"`, `raw:false`,
   `usage {input:16907, output:2022}`, null `sum-*`-tmux-Sessions; Cache-GET danach `cached:true`.
   **Noch auf Claude:** review, cleanReview, refine, analysis, merge, repair, commitMsg, enhance,
   digest — Migration je Worker einzeln über `WORKER_ROUTES`, mutierende Resolver zuletzt.
   Zweite Welle bewusst NICHT begonnen.

7. **Worker-Migrationskorridor Codex — SCHNITT 2 GEBAUT 2026-08-13:** Die Test-Timeout-Naht
   `FLEET_CODEX_EXEC_TIMEOUT_MS` wird ausschließlich hinter einem nichtleeren
   `FLEET_CODEX_EXEC_BIN` gelesen; positive endliche Werte verkürzen nur den kontrollierten
   Binary-Test, sonst bleibt das Aufruferbudget (Produktion unverändert 180 s). Der echte
   Timeout-Prozess stirbt im Test nach 1,5 s mit TERM-Beweis und tmp-Cleanup. `commitMsg`, `enhance`
   und `digest` routen nun zusätzlich zu `summary` auf dieselbe eine Spark-Konstante
   `gpt-5.3-codex-spark`, mit je eigenem expliziten Claude-Rückweg; Stand-ins bleiben Präzedenz 1,
   Fehler fallen nie still auf Claude zurück. Kontrollierte Gegenproben liegen für Summary,
   Commit-Message und Enhance in `e2e/summary.ts`, für den steward-geschützten Digest in
   `e2e/steward-core.ts`; der Tabellen-Pin hält die sechs übrigen Worker auf Claude.
   **Zahlenkorrektur der Lane-Zeile (sie schrieb 783 s):** ihr eigener isolierter Lauf maß
   `ISOLATED_SECONDS=790`; der Post-Land-Audit dieses Lands ist grün mit **2139 Checks/0 in
   901,9 s** gegen 2117/0 in 974 s davor. Die Naht spart deterministisch ~178,5 s Schlafzeit je
   Lauf; die Audit-Differenz ist mit −72 s kleiner, weil Audit-Wallclock Maschinenlast enthält —
   die Ersparnis ist am Check gemessen, nicht an der Audit-Differenz behauptet. Deploy `4d86c614`
   live (`bootHead == c09e85c`, `bundleStale:false`). **Live-Canaries mit Prozessbeweis:** enhance
   (6 s) und commitMsg (5 s, echtes Conventional-Commit-Subject, kein `messageFallback`) liefen je
   als eigene `codex exec --ephemeral -s read-only … -m gpt-5.3-codex-spark`-Ausführung, und es
   entstand keine einzige `sum-*`-tmux-Session — der Claude-Hintergrundworker-Pfad wurde für keinen
   der beiden benutzt. **Rand des commitMsg-Canarys, ehrlich:** seine Wegwerf-Lane wurde über
   `/api/slots/2/open-worktree` OHNE `harness`-Feld geöffnet, war also eine
   **Default-Claude-Trägerlane**. Bewiesen ist damit der Spark-Workerpfad und die Abwesenheit eines
   Claude-Hintergrundworkers für commitMsg; **nicht** bewiesen ist, dass dabei null Claude-Usage
   anfiel — die Trägerlane wurde nicht benutzt, ihr Verbrauch ist aber schlicht UNBEKANNT, nicht
   null. Die Lane wurde mit ihrem Commit verworfen. **Regel für künftige Commit-Canaries:
   ausdrücklich eine Codex-Lane (`harness:"codex"`) oder eine agentenlose Worktree-Fixture
   verwenden** — sonst zieht die Testumgebung einen zweiten Harness hoch, den der Test gar nicht
   braucht. Genau diese versteckten Nebenkosten soll die spätere Session-/Work-Trail-Analyse finden.
   **Digest-Canary NICHT gefahren:** `/api/steward/digest` verlangt einen aktiven
   `⚙ steward`-Slot (`server.ts:12383`), es gibt keinen — für digest ist der Beweis darum
   ausschließlich die isolierte Suite, kein Live-Lauf. **Weiter auf Claude:** review, cleanReview,
   refine, analysis, merge, repair. Keine dritte Welle in diesem Schnitt.

   **Incident-Beleg für den nächsten Typed-Operation-Event-Schnitt (an diesem Land angefallen):**
   Ein Waiter auf Main-Bewegung verpasst ein terminal verify-rotes Gate strukturell. Der Merge
   endete `resolved`/`landed:false` (clean rebase, Verify rot mit genau einem FAIL), main blieb
   deshalb korrekt stehen — und der Waiter, der auf eine HEAD-Bewegung wartete, hätte ewig
   gewartet. Der Land-Ausgang hat keinen typisierten Rückkanal: `POST /api/self/watch` deckt
   Lane-Fertigstellung ab, nicht den Ausgang einer Operation. Bis es ihn gibt, ist der Merge-Status
   (`GET /api/slots/:id/merge`) zu pollen, nie eine HEAD-Bewegung.

8. **Typed Operation Events — GEBAUT 2026-08-13/14** (`5da9c4d`, genau eine Codex-Lane,
   gpt-5.6-sol high, Task `cc5807e5` über den Dispatch-Knopf; Incident-Beleg: der Workstream-7-
   Absatz unten). Schnitt: der bestehende Watch → FleetEvent → Zustellung → Ack-Rückkanal trägt
   jetzt zwei weitere Subscription-Arten — **`kind:"merge"`** (konkrete Merge-Operation über
   Slot + `targetCwd`+`targetBranch`, nie eine nackte Slotnummer) und **`kind:"audit"`**
   (konkretes Land über Repo + `mainAfter`, Join gegen `mainSha`/`covers[].mainAfter`).
   `Watch` und `FleetEvent` sind diskriminierte Unions (`merge-terminal`, `post-land-audit`)
   mit geschlossenen typisierten Payloads; Legacy-Zeilen laden byte-stabil (Feldreihenfolge
   bewusst erhalten), `fleetEventFrom` validiert per Kind. **Merge-Events werden an den
   Verdikt-/Land-Stellen gemintet** — `record()` in `mergeJob`, Confirm-Land, already-merged,
   beide Teardown-Failed-Formen — über einen `beforeTeardown`-Hook in `landLane`, VOR
   `killSlot`/`dropWatchesFor`, weil der Confirm-Pfad `mergeLast` löscht und ein rein
   level-getriggerter Leser den Landed-Fall strukturell verpasste. Audit-Events mintet die
   Row-Schreibstelle (`await appendEvent` + `mintAuditEvents`). Beides zusätzlich
   level-getriggert beim Subscribe (persistierter Fakt ⇒ Event sofort) und im Tick;
   Dedup über `spendWatch` (ein Event je Watch), Refusals laut („könnte nie feuern":
   kein laufender/persistierter Merge bzw. kein Row/Queue/Running-Audit ⇒ 409).
   `resolved && landed:false` rendert nie als Erfolg; ein terminal-negatives Ergebnis ist eine
   ERFOLGREICHE Benachrichtigung. Persistenz vor Transport unverändert (`send-uncertain` vor
   `sendText`), Ack idempotent und sessiongebunden, Lane-Subscriber-409 bleibt. Gegenproben:
   e2e/merge.ts (Merge-Lifecycle inkl. Restart vor/nach Terminalfakt, `VERIFYSLOWPASS`-Naht in
   e2e-isolated.sh), fleet-e2e-postland-audit.ts (green/red/unknown, Cover-Bindung),
   e2e/watch.ts (Malformed-Rejection, Legacy-Load), e2e/land-durability.ts. Land-Gate grün
   (105,8 s, 0 s Mutex-Wartezeit), Post-Land-Audit **grün, 2159 Checks/0 in 819 s**, Deploy
   `2e8a4f1c` live (`bootHead == 5da9c4d`, `bundleStale:false`). **Live-Canary bestanden
   (Audit, level-triggered):** Subscription nach Deploy gegen die soeben persistierte Row
   feuerte im Subscribe-Aufruf selbst (`armed:false`, Event `9701c7dd…`), wurde servergerendert
   zugestellt und idempotent geackt. **Merge-Live-Canary ehrlich verschoben:** das eigene Land
   riss Slot 2 ab, `kind:"merge"` auf den toten Slot antwortet korrekt `target slot not active`
   — der Beweis gehört an den nächsten realen Land, keine künstliche Canary-Lane. Die
   Übergangsregel „Merge-Status pollen, nie HEAD" ist damit durch die Subscription ersetzt.

9. **Program/Origin Artifact v1 — GEBAUT 2026-08-14** (`aa6a86b`, genau eine Codex-Lane,
   gpt-5.6-sol high, Task `d97519ca` über den Dispatch-Knopf; 44 min Lane-Laufzeit). Der erste
   Baustein des halbautonomen Korridors: ein persistiertes `Program`-Artefakt als Klammer ÜBER
   späteren Tasks — nie selbst ein Task, von keinem Tick gelesen, in keiner Queue-Projektion
   gezählt. Schnitt: `Program` mit stabiler ID, `title`/`intent`/`successCriterion` (begrenzt),
   `nonGoals`/`decisions`/`evidence`/`openQuestions` (je ≤20×begrenzte Strings; Evidenz sind
   REFERENZEN, nie kopierter Inhalt), Status `proposed|confirmed|active|complete`, `createdAt`
   und ehrlicher Provenienz `proposedBy` (`{kind:"session", slot, openedAt, sessionId}` vom
   authentifizierten Slot oder `{kind:"owner"}` — nie vom Client akzeptiert). Persistenz als
   `programs`-Feld im fleet.json-State; Altzustand ohne das Feld lädt als `[]`, kein Backfill;
   Retention nach dem capTasks-Muster (`MAX_PROGRAMS=100`, nur `complete` evictable).
   **Propose/Promote streng getrennt:** `POST/GET /api/self/programs` ist Non-Lane-Self-Fläche
   (Lane → 409 „brackets above lanes"; Steward als Planungssession erlaubt); Owner-only sind
   `GET/POST /api/programs` und `confirm|activate|complete|discard` — der Handler sitzt VOR dem
   Steward-Interceptor, ein Steward-/Self-Token fällt als gewöhnliches tokenGate-401. Confirm
   nimmt Owner-Korrekturen (Merge über den Vorschlag, revalidiert; gespeichert wird die bestätigte
   Fassung, Provenienz unverändert); identische Wiederholungen sind `existing:true`, widersprüchliche
   409 (`conflicting confirm`), illegale Übergänge 409. `discard` nur auf `proposed` — der
   sanktionierte Wegwerfpfad. Der 2-s-Poll trägt exakt `{id,status,title,createdAt}` als Digest;
   Volltexte nur auf den beiden GET-Routen. Eine geteilte Validierung mit benannten 400ern für
   beide Türen. Gegenproben: `e2e/programs.ts` (14 Checks: Provenienz, Lane-409, Idempotenz beider
   Türen, Auth-Matrix, illegale Übergänge, benannte 400er, Restart-Byte-Ehrlichkeit,
   Digest-Grenze, Task-/Dispatch-Isolation inkl. „kein Task trägt programId", Discard);
   Security-Perimeter (`e2e/security.ts`) um die neuen Pre-Auth-Formen ergänzt. Land-Gate grün
   (102 s, 0 s Wartezeit), Post-Land-Audit **grün, 2181 Checks/0 in 811 s**, Deploy `212e6394`
   live (`bootHead == aa6a86b`, `bundleStale:false`). **Merge-Live-Canary bestanden — der aus
   Workstream 8 offene Beweis:** Subscription `{kind:"merge"}` NACH dem Merge-POST und VOR dem
   Terminalfakt (die kanonische Reihenfolge — ein Subscribe vor dem POST 409t mechanisch,
   `createWatchForSlot`; das Level-Triggering deckt die Lücke bis zum Terminalfakt), typisiertes
   `merge-terminal`-Event (`merged`/`landed:true`/`verify.ok:true`) empfangen, gegen Land-Note
   und HEAD geprüft, idempotent geackt; Audit-Ausgang ebenso über `{kind:"audit"}` empfangen und
   geackt. **Program-Live-Canary bestanden:** Wegwerfprobe („WEGWERFPROBE Live-Canary
   Session 57") gegen den deployten Server — propose mit korrekter Session-Provenienz,
   idempotente Wiederholung `existing:true`, Row in Self- und Owner-Sicht, Poll-Digest exakt
   vierschlüsselig, per `discard` geräumt. Kein Owner-Promote behauptet: confirm/activate/complete
   liefen live NICHT (nur isoliert bewiesen). **Bewusst nicht gebaut:** `programId` auf
   Tasks/Slots/Outcomes (P2-B, wartet auf reale Produzenten — dieser ist jetzt der erste),
   Context-Plan-Producer, MAIN-Bootstrap, UI.

10. **Typed Deploy Outcome — GEBAUT 2026-08-14** (`42ec025`, genau eine Codex-Lane, gpt-5.6-sol
   high, Task `2808a559` über den Dispatch-Knopf; 54 min Lane-Laufzeit). Die letzte Operation
   ohne Rückkanal: das Deploy-Verdikt (geschrieben vom NÄCHSTEN Boot, `deploys.jsonl`) hatte
   keinen Empfänger — wer wissen wollte, pollte die Liste und las heuristisch die neueste Zeile.
   Schnitt: **`POST /api/self/watch {kind:"deploy", deployId:<8-hex>}`** abonniert den terminalen
   Ausgang GENAU EINER Deploy-Operation; Event **`deploy-terminal`** mit geschlossener Payload aus
   der `DeployRow` (`{ok: true|false|null, stage, target, bootHead, hitTarget, bundleStale, at,
   reason?≤200}`), validiert in beide Richtungen (`validDeployRow` beim Ledger-Lesen,
   `fleetEventFrom` beim State-Laden). **Level-Trigger ist der Garantiepfad** (Subscribe-Aufruf +
   Watch-Tick joinen per deployId gegen Marker/Ledger; kein Edge-Mint nötig — die Boot-Row
   entsteht vor `Bun.serve`, der Tick fängt sie); der Boot-Filter hält Deploy-Watches am Leben
   (Subjekt ist kein Slot), damit ist der Mechanismus restartfest — genau der Restart, den der
   Deploy selbst verursacht. `ok:null` wird als UNVERIFIED gerendert, nie als Pass; die Nachricht
   sagt ausdrücklich „successful notification of the terminal result, not a claim that the deploy
   succeeded". Refusals laut: unbekannte deployId 409 („could never fire"), malformte 400, Dup
   `existing:true`, Lane 409 (bestehende Regel). Ack/Empfängerbindung/Retention: unverändert die
   bestehende FleetEvent-Maschinerie. Keine neue Route, kein Bus, keine UI, `deploys.jsonl`
   byte-unverändert. Gegenproben: 13 benannte Checks in `e2e/watch.ts` (alle 10 Pflicht-Beweise:
   Erfolg/Fehlschlag/Unbekannt, Sub vor/nach Terminalfakt, geschlossene Payload, idempotentes +
   sessiongebundenes Ack, ersetzte/fremde Session, Legacy, Refusals) + Boot-Restart-Zyklus in
   `e2e/deploy-facts.ts`. Lane-Verify: volle Gate-Kette + isolated-Preview grün (zwei rote
   Checks im ersten Lauf waren ein echter Probenfehler — die neue Probe überfüllte den
   Retention-Deckel ihres Receivers — Same-Tree-reproduziert, von der Lane selbst diagnostiziert
   und behoben). Land-Gate grün (102,6 s, 0 s Wartezeit), Post-Land-Audit **grün, 2197 Checks/0
   in 785,6 s** (+16 — die neuen Proben liefen mit), Deploy **`821b4b0b`** live
   (`bootHead == 42ec025`, `bundleStale:false`). **Live-Canary level-triggered mit der konkreten
   Deploy-ID bestanden, kein heuristisches Zeilen-Lesen:** Subscribe `{kind:"deploy",
   deployId:"821b4b0b"}` NACH dem Boot feuerte im Subscribe-Aufruf selbst aus dem persistierten
   Verdikt (`armed:false`, Event `c6c5c138…`), typisiert zugestellt (`ok=YES`, `hitTarget:true`),
   idempotent geackt (zweites Ack `existing:true`, `acknowledgedAt` unverändert); Refusal- und
   Dup-Proben live wiederholt (409/400/`existing:true`). Merge- und Audit-Rückweg dieses Lands
   liefen selbst über die typisierten Events aus WS8 (beide empfangen, gegen Land-Note/HEAD bzw.
   Audit-Row geprüft, geackt). **Briefing-Befund (Prozess, nicht Code):** der Lane-Brief
   verbot den vollständigen CLAUDE.md-Read (GPT-Kontextdisziplin), während AGENTS.md ihn als
   harte Loader-Pflicht verlangt — die Lane stoppte korrekt vor Arbeitsbeginn und eskalierte den
   Widerspruch wörtlich nach der AGENTS.md-Regel („stop and report any contradiction"); Owner-
   Klarstellung ersetzte den Brief-Satz. Die beiden Regeln widersprechen sich für fremde
   Harnesses STRUKTURELL; bis P1-D einen schmaleren Loader-Pfad beweist, gilt: ein Brief darf
   den CLAUDE.md-Read dosieren wollen, aber nur, indem er die AGENTS.md-Pflicht ausdrücklich
   owner-seitig adressiert — nicht durch einen stillen Gegenbefehl. Kein Deploy-Schnitt-Scope
   daraus gemacht (Owner-Vorgabe).

11. **P2-B1 — `programId` von Task bis Outcome — GEBAUT 2026-08-14** (`c20988f`, genau eine
   Codex-Lane, gpt-5.6-sol high, Task `9d28dd48` über den Dispatch-Knopf; 50 min Lane-Laufzeit).
   **Der Korridor-Schritt, der die scheinbare Zirkularität auflöst:** P2-B stand als EIN Block im
   Handoff und wartete laut Owner-Einordnung auf reale ContextPlan-/SkillRef-/CapabilitySnapshot-
   Produzenten — aber es zerfällt ehrlich in zwei Hälften mit verschiedenen Voraussetzungen. Die
   Program-Hälfte hat ihren Produzenten seit Workstream 9 (`Program` ist real, propose/confirm/
   activate/complete laufen), die Context-Hälfte hat ihn nicht. Nur die erste ist gebaut; die
   zweite bleibt ausdrücklich unangefasst und wartet weiter.
   **Keine materielle Architekturentscheidung nötig gewesen** — die drei offenen Fragen der
   Zuordnungsnaht sind aus bestehender Doktrin konservativ ableitbar: die TÜR (owner-only, exakter
   Spiegel der `Task.repo`-Regel „intake und steward können nie wählen, wo Arbeit materialisiert",
   `server.ts:1283`), die STATUS-MENGE (nur `confirmed`/`active` — `proposed` ist noch keine
   Owner-Wahrheit, `complete` ist geschlossen) und die MUTABILITÄT (unveränderlich in v1;
   Aufweiten ist billig, Zurücknehmen nicht — dieselbe Regel wie beim Lane-Watch-Ausschluss).
   Schnitt: `Task.programId?` nur an der Owner-Tür (`server.ts:15086` ff.) mit lauten Refusals
   (nicht-String/leer → 400 `bad programId`, unbekannte ID → 409 mit Nennung, falscher Status →
   409 mit Nennung des Status); die Steward-Tür lehnt ein `programId` im Body mit 400 ab
   („only the owner may attach work to a program"); die Intake-Tür bleibt byte-identisch, weil sie
   nur text/from liest. Refine-Kinder erben die Klammer wie `originId` — **auch wenn das Program
   inzwischen `complete` ist**: der Owner hat beim Mint validiert, ein später geschlossenes Program
   darf eine bestehende Klammer nicht rückwirkend zerreißen (eigene Sonde). `Slot.programId` mit
   exakt der taskId/originId-Lebensdauer (Stempel in `dispatchTask`, geleert in `openSlot`/
   `killSlot`, im Active-Slot-Snapshot persistiert, beim Laden String-validiert restauriert);
   `LaneOutcome.programId?` wird per `...(s.programId ? … : {})` emittiert, Reverted-Rows lassen es
   weg. Load-Normalisierung ohne Registry-Abgleich in BEIDE Richtungen: ein Pre-Field-Wert wird nie
   erfunden, ein persistierter nie gestrichen, weil die Registry sich bewegt hat. `TaskDigest` trägt
   die ID (kleine ID, kein Body), `src/client.ts` zieht seine eigene `TaskInfo`-Deklaration mit
   (die kind-Migrations-Lehre: ein Cast über eine fremde Fläche compiliert ewig und lügt ewig).
   **Kein Konsument** — kein Tick, Dispatcher, Sweep oder Gate liest das Feld; reine Provenienz.
   Die bestehende Isolations-Sonde in `e2e/programs.ts:187` wurde ehrlich umformuliert statt
   gelöscht („no task gains programId **without the owner naming one**"). Land-Gate grün,
   Post-Land-Audit **grün, 2207 Checks/0** (+10 — die neuen Proben liefen mit), Deploy
   **`914537f2`** live (`bootHead == c20988f`, `hitTarget:true`, `bundleStale:false`), Verdikt über
   das typisierte `deploy-terminal`-Event empfangen. Alle vier Operations-Rückwege dieses Lands
   liefen über die typisierten Events (lane-ready → merge-terminal → post-land-audit →
   deploy-terminal, je empfangen, gegen Land-Note/HEAD/Audit-Row/Boot-Fakt geprüft, geackt).
   **Live-Canary bestanden:** Wegwerf-Program („WEGWERFPROBE Live-Canary Session 59") gegen den
   deployten Server — Task gegen `proposed` 409 mit Status-Nennung, nach `confirm` gemintet,
   `programId` exakt im 2-s-Digest, unbekannte ID 409, malformte 400, Steward-Tür 400; Program
   danach über activate/complete geschlossen, Task gelöscht. **Ehrlicher Canary-Rand, gleiche Form
   wie bei P2-A:** die P2-B1-Lane selbst lief auf dem Vor-Deploy-Server und ihr Task trug kein
   Program — ihre Outcome-Row zeigt `taskId`/`originId`/`harness:"codex"`/`effort:"high"` und
   korrekt KEIN `programId`. Der Slot→Outcome-Pfad ist damit isoliert bewiesen, live noch nicht;
   die erste Row mit voller Program-Provenienz schreibt die nächste programgebundene Lane.
   **Bewusst nicht gebaut:** Re-Link-/Unlink-Route, Backfill der 56 offenen Zeilen, `programId` auf
   Event-/Watch-Payloads, UI-Rendering, jeder Konsument.

## Nächster eigener Korridor (Owner-Auftrag 2026-08-13; erster Baustein GEBAUT, Rest offen)

Die manuell bereits funktionierende halbautonome Kette soll mechanisiert werden:
Owner-/Ideengespräch → vorgeschlagenes **Program-/Origin-Artefakt** (✓ Workstream 9) →
Owner bestätigt/promotet (✓ API, noch kein UI-Knopf) → **Context-Plan-Producer** wählt Context
Packs und Anker → Fleet erzeugt den MAIN-Gründungsprompt → MAIN wählt Direktarbeit oder Worker →
Tasks/Outcomes tragen `programId`, `originId` und Context-Plan-Referenzen → Work Trails schlagen
Verbesserungen vor. **Ausdrücklich noch nicht bauen:** Program Registry ·
Context Compiler/Context-Plan-Producer · neue Context Packs ohne realen Trigger · Task-Wellen ·
Worker-Migrationswelle 3 · Self-Land · Learning Loop · allgemeine UI.

**Empfohlener nächster Schnitt: der Context-Plan-Producer — er ist jetzt der einzige echte
Engpass.** P2-B ist geteilt und die Program-Hälfte ist gebaut (Workstream 11); was von P2-B
übrig ist (ContextPlan-/SkillRef-/CapabilitySnapshot-Referenzen auf Tasks/Outcomes) wartet
unverändert auf reale Produzenten (Owner-Einordnung 2026-08-13), und der einzige fehlende
Produzent ist der Context-Plan-Producer selbst. **Vor seinem Bau steht eine materielle
Owner-Entscheidung**, die nicht ableitbar ist: ob ein ContextPlan ein VORGESCHLAGENES,
owner-bestätigtes Artefakt ist wie ein Program (Propose/Promote, teuer, inspizierbar) oder eine
ABGELEITETE Projektion wie `Task.cluster`/`files`, die der Server pro Dispatch neu rechnet und
nie persistiert. Die beiden Formen haben verschiedene Provenienz-Verträge und verschiedene
Rückwege, und die Wahl bestimmt, was P2-B überhaupt referenzieren KANN. Workstream 1, 2, 4,
P2-A, 5 und P2-B1 sind gebaut (oben). Dahinter: Self-Land als Shadow-Klassifikation (unten).

**Ziel dahinter (gesetzt, nicht begonnen):** Self-Land als inspizierbare Eligibility-Entscheidung
(Shadow-Klassifikation zuerst; Tatsachenliste: Kickoff §7 / Doktrin §12) und der manuelle
Work-Trail-Learning-Loop (P4; Owner promotet).

**Pausiert (Owner-Stop 2026-08-12):** Task-Wellen, Cluster-Fan-out, Queue-/Dashboard-Ausbau
(`docs/plan-queue-refinement-2026-08-11.md` = geparkte Quelle) · vorzeitige Token-/Kosten-
optimierung (Rulebook-Split P1-C bleibt hinter G1) · Capability-Großmatrix, Event-Sourcing,
Maschinen-Sync (Anti-Ziele: Theo-Vergleich §8, Harness-Brief §14).

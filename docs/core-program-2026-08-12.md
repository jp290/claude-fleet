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

12. **ContextPlan v1 — Projektion + unveränderlicher Delivery-Receipt — GEBAUT 2026-08-14**
   (`c72b22b`, genau eine Codex-Lane, gpt-5.6-sol high, Task `8a0ec556` über den Dispatch-Knopf;
   44 min Lane-Laufzeit). **Owner-Entscheid, den dieser Schnitt umsetzt:** ein ContextPlan ist eine
   FRISCH ABGELEITETE PROJEKTION — advisory, nie persistiert, keine Owner-Bestätigung, wie
   `Task.cluster`/`files` und ausdrücklich NICHT wie `Program`. **Aber** was tatsächlich an eine
   Session ausgeliefert wurde, darf später nicht aus einem inzwischen bewegten Baum neu hergeleitet
   werden — also braucht die Ausführungsgrenze einen unveränderlichen RECEIPT.
   **Befund, der den Schnitt geformt hat:** `context-packs.ts` (187 Zeilen) und
   `context-pack-validator.ts` waren seit P1-B eine TOTE INSEL — nur `e2e/context-packs.ts`
   importierte sie, `server.ts` referenzierte beide null mal. Dieser Schnitt gibt ihnen ihren
   ERSTEN realen Konsumenten, statt eine zweite Schicht daneben zu bauen (Owner-Vorgabe: „keine
   tote Typ-/Registry-Schicht").
   Schnitt, drei Teile: **(1)** reiner Producer `context-plan.ts` (kein I/O, kein Server-Import,
   testbar wie `verify-proportion.ts`): `planContext({harness, mode, triggers, capabilities})`
   wählt aus den sechs unveränderten Pack-Seeds und ist TOTAL — jedes Pack landet in `selected`
   oder `omitted` mit einem Grund aus geschlossener Menge (`status-not-active` ·
   `harness-unsupported` · `mode-unsupported` · `trigger-not-matched` · `capability-missing`); ein
   Pack, das in keinem von beidem stünde, wäre genau die stille Kürzung, gegen die der Receipt
   existiert. Null/unbekannter Harness löst zentral auf den Default-Adapter auf.
   **(2)** Der reale Konsument sitzt an DER einen Auslieferungsgrenze — `briefAndSend`s einzigem
   `sendText` — und liefert wirklich: die gewählten Packs gehen als kompakter ANKER-BLOCK an den
   Brief (Pack-ID, Pfad, Anker; **nie Inhalt**, denn Packs sind per erster Zeile ihrer eigenen
   Datei Zeiger und kopierter Inhalt wäre der zweite Wissensspeicher, den sie verbietet). Der
   gespeicherte `Task.brief` wird dabei NIE mit der Projektion überschrieben. Der Integration-HEAD
   wird serverseitig VOR dem Send gelesen; ist er unlesbar, wird nicht ausgeliefert, statt einen
   Receipt mit erfundenem HEAD zu schreiben (der bestehende Requeue-Pfad übernimmt).
   **(3)** Der Receipt: append-only `context-receipts.jsonl` über das bestehende
   `appendEvent`-Muster, geschrieben aus dem TATSÄCHLICH gesendeten Text und erst NACH erfolgreichem
   Send — ein fehlgeschlagener/gehaltener Dispatch schreibt nichts. Felder: stabile `id`, `hash`
   (sha256 über Anker-Block + receipt-sichtbare Plan-Fakten, im Kommentar exakt benannt, damit ein
   späterer Leser ihn nachrechnen kann), `at`, `repo`, `head`, `taskId`/`originId`/`programId`,
   `slot`, `branch`, `harness`/`model`/`effort`, `mode`, `triggers`, `selected` mit Ankern,
   `omitted` mit Gründen, `deliveredBytes`, `truncated`. Leser: `GET /api/context-receipts`
   (owner-only) — gehört in DIESEN Schnitt, weil er es ist, der die spätere Sessionanalyse sehend
   hält. **Kein Konsument des Receipts:** nichts liest ihn in eine Entscheidung zurück.
   **Warum das auf den Program-MAIN-Gründungsprompt zuläuft:** der spätere Bootstrap ist ein
   ANDERER Aufrufer desselben Producers, der denselben Receipt schreibt — deshalb nimmt der
   Producer schlichte Fakten statt eines Slots, und deshalb trägt der Receipt `programId` von Tag
   eins.
   **Der Review-Punkt, der genau geprüft wurde, weil eine geschwächte Sonde wie eine Anpassung
   aussieht:** die Lane stellte die Dossier-Assertion von `text-hash` auf `outcome-task-id` um.
   Das ist KEINE Aufweichung — sie führte im Produktionscode einen VIERTEN Join ein, der vor beiden
   Hash-Joins greift und auf der unveränderlichen `taskId` der Outcome-Row beruht, während beide
   Hash-Joins für Alt-Rows erhalten bleiben. Der Grund ist derselbe wie der des ganzen Schnitts und
   steht im Code: aktuelle Prompt-Hashes enthalten jetzt einen frisch abgeleiteten Anker-Suffix und
   dürfen nie aus einem späteren Baum re-derived werden. Zwei Sonden fielen im ersten isolierten
   Lauf genau daran (exakte Prompt-Erwartungen) — echte Kontraktdrift, korrekt nachgezogen.
   Land-Gate grün, Post-Land-Audit **grün, 2223 Checks/0** (+16), Deploy **`d44277d5`** live
   (`bootHead == c72b22b`, `hitTarget:true`, `bundleStale:false`), Verdikt über das typisierte
   `deploy-terminal`-Event. **Live-Canary bestanden, und er beweist die Nicht-Fiktionalität:** ein
   echter Dispatch mit programgebundenem Task erzeugte GENAU EINEN Receipt — 2 selected + 4 omitted
   = 6 Packs (total), `head == c72b22b`, `taskId`/`originId`/`programId` alle drei gesetzt,
   `harness:"codex"`, `effort:null` ehrlich (keiner angefordert) — und die PANE zeigte exakt die
   drei Anker, die der Receipt nennt. Nach Löschen des Tasks und Abschluss des Programs trägt die
   Zeile die `programId` unverändert weiter: die Unveränderlichkeit, die den Zweck erfüllt.
   **Damit ist auch der P2-B1-Live-Beweis nachgeholt:** dies ist die erste reale Auslieferung, in
   der eine `programId` vom Task über den Slot bis in ein Ledger durchläuft.
   **Bewusst nicht gebaut:** Context Registry, Context Compiler (nichts erzeugt Prosa — es werden
   nur vorhandene Zeiger ausgewählt), neue/geänderte Packs, UI, Rücklesen eines Receipts, eine
   Capability-PROBE (die Fähigkeitsliste ist eine benannte Konstante mit Begründung, keine Messung).

13. **Program-MAIN Bootstrap v1 — GEBAUT 2026-08-14** (`971c8da`, genau eine Codex-Lane,
   gpt-5.6-sol high, Task `2d9e8928` über den Dispatch-Knopf; 49 min Lane-Laufzeit). **Der
   Korridor-Schritt, für den WS12 den Producer auf schlichte Fakten geschnitten hat:** ein aktives
   Program kann owner-gesteuert genau einen autoritativen Program-MAIN gründen, und
   Authority-Bindung und Gründungsauslieferung sind EIN atomarer Vertrag — `Program.main` existiert
   genau dann, wenn der Gründungsbrief tatsächlich zugestellt wurde.
   Schnitt: `POST /api/programs/:id/bootstrap-main` (owner-only, im bestehenden
   `handleOwnerProgramRoute`; Gate- und Action-Regex erweitert, der Security-Regex-Pin in
   `e2e/security.ts` zog mit). Body `{cwd (Pflicht), harness?, model?, effort?, label?}` —
   validiert über dieselben `harnessIdOf`/`modelOf`/`effortOf` wie jeder attended Spawn.
   `Program.main? {slot, openedAt, sessionId, boundAt}` aus servergelesenen Occupant-Fakten, nie
   aus dem Body; `proposedBy` bleibt unveränderte Herkunft; `Slot.programId` bleibt reine
   Task-/Lane-Provenienz und wird NICHT zur MAIN-Bindung umgedeutet. Ablauf nach der
   Succession-Rail-Disziplin: freier Slot + `laneSpawn`-Reservierung → `openSlot` mit explizitem
   cwd → Boot-Gnadenfrist + `canDeliver` mit Owner-Waiver (das Alive-Gate hält: eine leere Shell
   würde den Brief AUSFÜHREN) → Readiness über den NEU EXTRAHIERTEN geteilten Helfer
   `waitForFoundingReadiness` (beide Gründungs-Rails — Dispatch-Tail und Bootstrap — nehmen
   dieselbe Schleife; der Pin verlangt es) → servergebauter Gründungsprompt
   (`buildProgramMainBrief`: Rolle + owner-bestätigter Program-Inhalt verbatim als JSON +
   Erdungsschritte im Succession-Ton + ContextPlan-Anker-Block aus `planContext` unter eigenen
   `BOOTSTRAP_CONTEXT_*`-Konstanten mit begründeten Capabilities) → HEAD+Branch serverseitig VOR
   dem Send (unlesbar ⇒ keine Auslieferung, kein erfundener Receipt) → `sendText` → erst DANACH
   Bindung + Receipt (bestehende Mechanik, `context-receipts.jsonl`, `taskId:null`/`originId:null`,
   `programId` gesetzt) + `saveStateNow`. Jeder Fehlpfad (openSlot-Throw, Gate, blocked screen,
   Readiness-Timeout, Git unlesbar, Send-Throw) räumt den Slot ab und hinterlässt weder Bindung
   noch Receipt. Identische Wiederholung bei lebender Bindung ⇒ `existing:true` (die Bindung ist
   die Identität, der Body wird nicht re-verglichen); tote/verschobene Bindung ⇒ 409
   „stale … slot N openedAt T", kein Auto-Rebind; falscher Status/unbekannte ID/kein Slot/
   Concurrent-Bootstrap ⇒ laute 409/404. Self-Sicht: `GET /api/self/programs` zeigt zusätzlich
   Programs, deren `main` DIESEN Occupant nennt (slot+openedAt); Lane-409 bleibt. Load
   rekonstruiert `main` feldvalidiert, Legacy ohne `main` lädt unverändert. Kein Konsument der
   Bindung in Tick/Gate/Dispatcher.
   Lane-Verify: volle Gate-Kette + isolated-Vorschau ALL PASS (zwei rote claude-gate-Läufe von der
   Lane korrekt per Same-Tree-Rerun als nichtdeterministisch adjudiziert, Transkripte extern).
   Land-Gate grün (92,9 s, 0 s Wartezeit). Post-Land-Audit **rot mit genau einem Fail — Flake-
   Familie 5 in Wortlaut-Signatur** („reseed + live bytes … 41 marks, 1..40", verify-tiering
   §11.2b); Beweis nach der Ordnung: serieller Same-Tree-`e2e-isolated`-Lauf auf `971c8da` =
   **ALL PASS** (run `isolated-20260814T110009Z-56123`), adjudiziert als `flake` mit Beleg. Deploy
   **`5f9a435e`** live (`bootHead == 971c8da`, `hitTarget:true`, `bundleStale:false`), Verdikt über
   das typisierte `deploy-terminal`-Event (level-getriggert aus dem persistierten Fakt).
   **Live-Canary bestanden, voller Kreis:** Wegwerf-Program → Bootstrap auf `proposed` 409 mit
   Status-Nennung, unbekannte ID 404, fehlendes cwd 400 → nach confirm/activate echter Bootstrap
   (4,5 s, Bindung nennt den realen Occupant samt sessionId), Pane zeigt den Gründungsprompt mit
   Program-Titel und Anker-Block, Receipt trägt `programId`/`taskId:null`/`originId:null`/
   `head == Live-HEAD`/`branch main`/2+4=6 Packs → Wiederholung (auch mit anderem cwd)
   `existing:true`, kein zweiter Receipt → Self-Sicht: nur der gebundene Occupant sieht das
   Program, die unbeteiligte MAIN-Session nicht → Slot-Kill, erneuter Bootstrap 409 „stale …
   slot 2 openedAt …" → Program über complete geschlossen.
   **Bewusst nicht gebaut:** program-aware Succession, CompletionView/complete-abort-Umbau,
   Self-Land, Auto-Task-Erzeugung, Event-Bus, SkillRef/CapabilitySnapshot, Context Registry, UI.

14. **Program-aware Succession v1 — GEBAUT 2026-08-14** (`46e0653`, genau eine Codex-Lane,
   gpt-5.6-sol high, Task `b020a086` über den Dispatch-Knopf; 72 min Lane-Laufzeit). **Der
   Schnitt, der die in WS13 benannte stale Bindung schließt:** ein `succeed` des gebundenen
   Program-MAIN übertrug die Authority bis dahin nicht — der Nachfolger erbte sie nicht, die
   Bindung zeigte auf einen sterbenden Slot.
   Schnitt: `handleSelfSucceed` bestimmt NACH dem HANDOFF-Gate die Menge
   `programs.filter(status === "active" && main.slot === s.id && main.openedAt === s.openedAt)` —
   Bindungsidentität ist slot+openedAt (dieselbe wie die Occupancy-Prüfung in
   `bootstrapProgramMain`), `sessionId` ist aufgezeichnete Evidenz und nie das Gate. **0 Treffer ⇒
   der bestehende ungebundene Pfad läuft unverändert** (kein zusätzlicher Git-Read, kein
   Readiness-Wait, gleiche Fehlertexte); **>1 ⇒ lautes numeriertes 409**
   („ambiguous succession: … N active programs") ohne Slot- oder Receipt-Nebenwirkung; **genau 1 ⇒
   `succeedProgramMain`**. Dieser Pfad spiegelt die Bootstrap-Rail exakt: synchrone
   `programBootstrapInflight`-Reservierung vor dem ersten await (zusammen mit
   `successionInflight`/`successionStarted` der Riegel gegen zwei Nachfolger) → freier Slot +
   `laneSpawn` → `openSlot` mit dem bestehenden Succession-Erbe (cwd, model, label verbatim inkl.
   null, harness, effort, container/containerContext) → Boot-Gnadenfrist → `canDeliver` mit
   Owner-Waiver → geteilter `waitForFoundingReadiness` → frischer `planContext` (nie ein alter
   Receipt gelesen oder kopiert) → `buildProgramMainSuccessionBrief` (Rolle als FORTGESETZTER
   Program-MAIN + HANDOFF-Verweis + Erdungsschritte + optionaler carry + owner-bestätigter
   Program-Inhalt verbatim als JSON + Anker-Block) → HEAD+Branch serverseitig VOR dem Send →
   `sendText` → **erst danach** Bindung auf den Nachfolger, Receipt
   (`programId`, `taskId:null`, `originId:null`, `deliveredBytes` aus dem tatsächlich gesendeten
   Text), Retirement-Persistenz, `saveStateNow`, dann `scheduleSuccessionRetirement`. Jeder
   Fehlpfad (open, Gate, blocked screen, Readiness-Timeout, Git unlesbar, Send-Throw) räumt den
   Nachfolger-Slot und lässt den Vorgänger **gebunden, unretired und receiptlos**.
   **Crash-Grenzen sind einseitig und stehen als Kommentar im Code:** Verlust VOR dem Send ⇒
   Reboot lädt die alte Bindung, der Vorgänger lebt und bleibt autoritativ (sein Retirement wurde
   nie persistiert). Verlust NACH dem Send vor `saveStateNow` ⇒ dieselbe alte Bindung, und der
   zugestellte Nachfolger ist eine gewöhnliche, sichtbare, UNGEBUNDENE MAIN-Session — der Owner
   entscheidet. **Kein heuristisches Rebind, an keiner Grenze.** Die Self-Sicht wechselt ohne
   neuen Code: die `main`-Klausel in `GET /api/self/programs` existiert seit WS13, also sieht nach
   dem Transfer nur noch der Nachfolger das Program; `proposedBy` bleibt unangetastet (Herkunft,
   nicht Authority). Watches, FleetEvents und Autos werden ausdrücklich NICHT übertragen — ihre
   Rekonstruktion gehört in die ProgramExecutionView.
   Pin erweitert: alle DREI Gründungs-Rails (Dispatch-Tail, Bootstrap, Succession) müssen dieselbe
   bounded `waitForFoundingReadiness`-Schleife nehmen — Regel über Funktionskörper-Slices, kein
   Snapshot. 17 neue Gegenproben in `e2e/programs.ts`.
   **Land-Weg, und er weicht von der Routine ab:** Lane-Verify voll grün (Gate-Kette +
   isolated-Vorschau, alle Tails `ALL PASS`; zwei frühere rote isolierte Läufe waren ECHT und
   deckten einen fehlenden `return await`-Guard auf). Der Land-Gate wurde dennoch **rot mit genau
   einem Fail**: `the delayed TUI's model received the immediate send byte-for-byte`
   (`fleet-e2e-harness.ts:161`, Boot-Race-Fixture in Phase 2 des claude-gate, von der Lane nicht
   angefasst; die Sonden-Vorbedingungen daneben waren grün). Beweis nach der Ordnung: **serieller
   Same-Tree-Rerun von `./e2e-claude-gate.sh` auf `46e0653` = ALL PASS, 0 FAILs** — Nichtdeterminismus
   direkt bewiesen, nicht per Flake-Namen behauptet. Ein Re-Run des Merges lief korrekt in den
   ⏸-Riegel (ein `resolved`-Verdikt bei unbewegtem main blockt, damit niemand eine ungeprüfte
   Auflösung überfährt); gelandet wurde daher über den **Confirm-Land**
   (`POST /api/slots/:id/merge {confirm:true}`, verifiziert per Konstruktion nicht neu, Garantie
   ist rein git). Die Land-Note trägt `confirmedByHuman:true` samt vollständigem rotem
   Gate-Verdikt — im Ledger bleibt dauerhaft sichtbar, dass hier ein Mensch über ein Rot
   entschieden hat. Post-Land-Audit **grün und substanziell geprüft: 2261 Checks/0 (+15),
   `ms` 806 200 (13,4 min), `exitCode` 0, 17 aufbewahrte PASS-Zeilen, `covers` genau ein Land** —
   die drei Zahlen, die ein „nichts gemessen"-Grün von einem echten trennen. Deploy **`6d1682b1`**
   live (`bootHead == target == 46e0653`, `hitTarget:true`, `bundleStale:false`), Verdikt über das
   typisierte `deploy-terminal`-Event.
   **Bewusst nicht gebaut:** ProgramExecutionView, Übertragung alter Events/Watches,
   complete-/abort-Umbau, Task-Erzeugung, adaptive Execution-Policy, Self-Land, Event-Bus,
   SkillRef/CapabilitySnapshot, Context Registry, UI. Kein Client-Code (kein neuer Poll-Payload).

## Nächster eigener Korridor (Owner-Auftrag 2026-08-13; erster Baustein GEBAUT, Rest offen)

Die manuell bereits funktionierende halbautonome Kette soll mechanisiert werden:
Owner-/Ideengespräch → vorgeschlagenes **Program-/Origin-Artefakt** (✓ Workstream 9) →
Owner bestätigt/promotet (✓ API, noch kein UI-Knopf) → **Context-Plan-Producer** wählt Context
Packs und Anker → Fleet erzeugt den MAIN-Gründungsprompt → MAIN wählt Direktarbeit oder Worker →
Tasks/Outcomes tragen `programId`, `originId` und Context-Plan-Referenzen → Work Trails schlagen
Verbesserungen vor. **Ausdrücklich noch nicht bauen:** Program Registry ·
Context Compiler/Context-Plan-Producer · neue Context Packs ohne realen Trigger · Task-Wellen ·
Worker-Migrationswelle 3 · Self-Land · Learning Loop · allgemeine UI.

**Der Program-MAIN-Gründungsprompt ist GEBAUT (Workstream 13, 2026-08-14).** Die Korridor-Kette
Owner-Gespräch → Program (WS9) → Owner-Confirm → planContext (WS12) → **servergebauter
MAIN-Gründungsprompt mit atomarer Bindung (WS13)** steht damit durchgehend mechanisiert bis zur
gegründeten MAIN-Session; der Receipt macht jede Auslieferung rückwirkungssicher. **Program-aware Succession ist seit
2026-08-14 GEBAUT (Workstream 14)** — die Kette trägt damit über den Sessionwechsel hinweg, eine
gebundene MAIN-Session kann ihre Authority atomar weitergeben. **ProgramExecutionView ist seit 2026-08-15 GEBAUT (Workstream 18, `4ef21e2`, unten)** — die
Rekonstruktion, die WS14 ausdrücklich nicht überträgt, ist damit als read-only-Projektion da.
**Empfohlener nächster Schnitt:** Self-Land als Shadow-Klassifikation (unten). Was
von P2-B übrig ist (SkillRef-/CapabilitySnapshot-Referenzen) wartet weiter auf seine Produzenten;
ContextPlan-Referenzen braucht es NICHT als Task-Feld (Receipt = die Zuordnung, WS12).
Workstream 1, 2, 4, P2-A, 5, P2-B1, ContextPlan, Program-MAIN-Bootstrap und program-aware
Succession sind gebaut (oben). **Codex Conversation Recovery v1 ist seit 2026-08-15 GEBAUT
(Workstream 15, `813149d`, Owner-Tipp vom 2026-08-14 22:13):** eine Codex-Conversation überlebt
den Pane-Tod — `tickCodexRecovery` bindet die Conversation-ID lazy aus dem Rollout (exaktes cwd,
`thread_source:"user"`, Zeitfenster des aktuellen Pane-Lebens, genau EIN Kandidat, nie Rezenz oder
`--last`), ensureSlot heilt mit `codex resume '<exakte-id>'` nur bei existierendem Rollout zur ID,
und 0/≥2 Kandidaten bzw. fehlender Rollout stehen typisiert als `pending`/`ambiguous`/`lost` an
der Slot-Row (`codexRecovery`), samt advisory `stream disconnected`-Sichtung. Single Writer per
Konstruktion: Resume nur nach mechanisch bewiesenem Pane-Tod, ensureSlot ist die einzige
spawnCmd-Aufrufstelle (Pin). Live bewiesen an MAIN- und Lane-Fall (Codewort-Recall über den
Pane-Tod, gleiche Session-ID, genau ein Rollout je cwd). **Codex Attended Recovery v1.1 ist seit
2026-08-15 GEBAUT (Workstream 16, `511c2c2`):** die v1-Lücke — bestehende/manuell resumte
Conversations blieben terminal `pending` — ist geschlossen. Der Owner öffnet am `cx`-Chip ein
One-Shot-Inventar (`GET /api/slots/:id/codex-candidates`: ohne Pane-Zeitfenster, first-line-only,
stabil sortiert und gecapt, `sessionsRoot:false` = unknown ≠ leer, fremd Gebundenes separat als
`boundElsewhere`) und bindet mit `POST /api/slots/:id/codex-bind` genau eine ausdrücklich gewählte
ID nach voller Re-Validierung am Write-Seam — idempotent, 409 ohne Mutation bei Konflikt/
verschwundener/fremder ID, keine tmux-Berührung aus der Route (Pin); ein toter Slot resumed
weiterhin ausschließlich über ensureSlots eine spawnCmd-Aufrufstelle. Keine neue Persistenz
(bestehende Felder `sessionId`/`codexRecoveryState`), damit restartfest per Konstruktion. Live
bewiesen: voller attended Kreis auf einem Wegwerf-Slot (Recycle → Kandidat → exakter Bind →
Pane-Tod → `codex resume '<id>'` → Codewort-Recall) und die manuell resumte MAIN-Conversation
`019fefd0-…` nichtdestruktiv gebunden (Pane-PID unverändert). Weiterhin bewusst NICHT gebaut:
Prompt-Replay, Rezenz/`--last`, Claude-/Pi-Recovery, allgemeiner Session-/Transcript-Browser —
Zustandsmaschine und Grenzen: `docs/codex-recovery.md`.

**pi-zai (GLM-5.3 über Z.ai Coding Plan) ist seit 2026-08-15 GEBAUT (Workstream 17, `9659901`;
genau eine Codex-Lane, gpt-5.6-sol high, Task `22e28ba9`).** Vorlauf war ein isolierter H0-Test
(read-only, Wegwerf-HOME): Pi 0.84.0 hat den Provider `zai` NATIV (baseUrl
`api.z.ai/api/coding/paas/v4`, Key-Quelle env `ZAI_API_KEY`), Live-Messungen grün (Identität
zai/glm-5.3, Streaming, Tool-Roundtrip, 140k-Input akzeptiert, Effort low/high/max akzeptiert,
Session-Resume, Fehler laut: fehlender Key lokal exit 1, Fremdmodell API-400 code 1214), und im
Architektur-Blindvergleich (fixierte 8-Kriterien-Rubrik, geheimnisfreier 6,7-KB-Pack) schlug GLM
den Fable-Entwurf 16/16 zu 12/16 mit zwei echten codegestützten Funden (WatchBase trägt kein
`openedAt`; keine persistierte MAIN-Lineage) und null Halluzination — Verdict go. Der Adapter
(`PI_ZAI_HARNESS`, server.ts, neben den Pi-Adaptern): fester Provider/Modell `zai`/`glm-5.3`
(`modelRe /^glm-5\.3$/`, alles andere 400), Effort exakt low/high/max, prozesslokales Agent-Dir
über `PI_CODING_AGENT_DIR` (Default `~/.config/claude-fleet/pi-zai-agent`, Override
`FLEET_PI_ZAI_AGENT_DIR`; models.json mit dem fehlenden glm-5.3-Katalogeintrag wird idempotent
hergestellt — Pis Bündelkatalog endet bei glm-5.2, `~/.pi/agent` bleibt unberührt), Key erst in
der Pane-Shell via `$(cat '<keyfile>')` (Default `~/.config/claude-fleet/secrets/…`, Override
`FLEET_PI_ZAI_KEY_FILE`; laute Wache bei fehlender/leerer Datei, pi startet nicht), Pins halten
`$(cat` als einzigen Key-Mechanismus. `automatable:false` (keine Feuerprobe), `allowsLanes:true`,
`comms:["pi"]`, worker/transcript unsupported wie pi, eigener Session-Reader unter dem
Fleet-Agent-Dir plus `contextWindowFor("glm-5.3") = 1_000_000` — **erster fremder Harness mit
livem ctx-Sensor** (Canary: `ctx {usedTokens, 1000000, pct}` am Owner-Poll). Land normal (Gate
grün 94,7 s), Audit substanziell grün (837 s, 2328/0, 17 PASS-Zeilen, covers genau dieses Land),
Deploy `511cc15e` (`ok:true`, `hitTarget:true`, `bundleStale:false`). Live-Canary voller Kreis:
Identität zai/glm-5.3 aus der Session selbst (`PI_PROVIDER=zai`), Tool-Roundtrip, Pane-Kill →
Heal mit gepinnter `--session-id` → Codewort-Recall (`SILBERDISTEL-88`), keine Key-Bytes in
Startkommando/Scrollback. Grenzen, gewollt: Effort-Monotonie und volles 1M-Fenster ungemessen;
`pi -p` braucht nicht-interaktiv `< /dev/null` (H0-Stolperstein, TUI unbetroffen); Key liegt als
Env im pi-Prozess (Design der Env-Injektion, nie auf Platte außerhalb der Secrets-Datei).
Bewusst NICHT gebaut: Provider-Abstraktion, ProgramExecutionView, `automatable:true`.**

**ProgramExecutionView v1 ist seit 2026-08-15 GEBAUT (Workstream 18, `4ef21e2`; genau eine
Codex-Lane, gpt-5.6-sol high, Task `e5f02773` über den Dispatch-Knopf, ~54 min Worker-Laufzeit).**
Der Schnitt schließt genau die Lücke, die WS14 ausdrücklich offenließ: ein gebundener Program-MAIN
kannte seinen Program-INHALT, aber nicht seinen AUSFÜHRUNGSZUSTAND — Watches, Events und laufende
Arbeit wurden bei der Succession bewusst nicht übertragen.

**Was die View IST:** eine bei jedem Aufruf frisch abgeleitete Projektion über bestehende
autoritative Fakten. Kein neues persistiertes Urteil, kein zweites Ledger, kein neues Feld an
Program/Task/LaneOutcome/ContextReceipt, kein Cache. Eine neue Route,
`GET /api/self/program-execution` (self-token, Nicht-Lane-only 409 mit dem
Programs-Bracket-Begründungssatz), plus **ein** optionales Provenienzfeld.

**Was sie WEISS, und über welchen Join — jeder ist eine exakte ID-Gleichheit oder das volle
Occupant-Tripel, keiner ist eine Heuristik:**
- **Programme**: `p.main.slot === s.id && p.main.openedAt === s.openedAt` — dieselbe
  Bindungsidentität, die `handleSelfSucceed` und `bootstrapProgramMain` benutzen. NIE über
  `proposedBy` (das ist Herkunft, nicht Authority). `sessionId` wird als `sessionIdMatch`
  (`exact|divergent|unknown`) BERICHTET und ist nie das Gate.
- **Tasks / aktive Lanes / Outcomes / Receipts**: strikte `programId`-Gleichheit
  (`Task.programId`, `Slot.programId`, `LaneOutcome.programId`, die persistierte `programId` der
  Context-Receipt-Zeile). Ledger-Zeilen kommen über `readLedger`, `malformed` wird durchgereicht.
- **Events**: das volle Empfänger-Tripel (`receiverSlot`+`receiverOpenedAt`+`receiverSessionId`),
  plus `openDebts` = noch nicht quittierte Zustellschulden.
- **Watches**: nur bei exaktem `slotOpenedAt`.

**Was `unknown` BLEIBT, und zwar benannt statt als 0/false:** die **MAIN-Lineage** (es gibt keinen
persistierten Fakt über frühere gebundene Sessions eines Programs — die Zeile steht IMMER da, auch
in der sonst vollständigen Sicht) · Legacy-Watches ohne `slotOpenedAt` · Watches eines fremden
Occupants · Events mit passendem slot+openedAt aber abweichender `receiverSessionId` (gezählt als
`sessionMismatch`, nie stillschweigend gedroppt) · malformte Ledger-Zeilen · ein Program-Status
!= `active`. Jede `unknown`-Zeile trägt eine Zahl (eigene Gegenprobe).

**Die eine ergänzte Provenienz, minimal und an der echten Erzeugungsnaht:** `WatchBase` bekommt
`slotOpenedAt?: number`, gesetzt AUSSCHLIESSLICH im gemeinsamen `common`-Objekt in
`createWatchForSlot` — beide Watch-Routen (self und owner) und alle vier Watch-Arten laufen dort
durch, es gibt keine zweite Schreibstelle. `watchFrom` lässt eine fehlende Angabe als ehrliche
Legacy-Zeile byte-identisch durch und verwirft einen VORHANDENEN malformten Wert fail-closed.
**Kein Backfill**, an keiner Stelle: Slot-Ids werden recycelt, also darf der heutige Occupant nie
auf eine alte Watch geschrieben werden.

**Semantik-Riegel:** ein `complete`/`confirmed`/`proposed` Program rendert `executionState:
"not-executing"` und nennt seinen Status in `unknown` — geschlossene Programme sehen nie wie
laufende Ausführung aus. Ein Slot-Recycle (gleiche Nummer, neues `openedAt`) erbt nichts. Die View
liest ihre eigene Ausgabe nirgends zurück; kein Tick, Dispatcher oder Consumer ändert sein
Verhalten wegen ihr. Ein Pin hält das mechanisch: der Handler-Körper darf `saveState`,
`saveStateNow`, `appendEvent`, `sendText`, `spawnCmd` nicht enthalten (Regel über einen
Funktionskörper-Slice, kein Snapshot).

**Flächen-Entscheid:** protocol/wire apply · server apply · reverse-state apply (nur `watchFrom`) ·
probes apply (27 neue Gegenproben: 23 in `e2e/programs.ts`, 4 in `e2e/watch.ts`, 1 Pin) ·
`e2e/security.ts` apply (EIN Eintrag in `PRE_AUTH_ROUTES`, owner-freigegeben — s. u.) ·
**client not-applicable** (Konsument ist die MAIN-Session über self-token; kein Owner-Poll-Feld,
kein UI) · docs apply (dieser Abschnitt, MAIN-direct).

**Die Gegenproben sind adversarisch, nicht bestätigend:** der unattributierte Task trägt *denselben
Branch und dieselbe Erzeugungszeit* wie der attributierte und erscheint trotzdem nicht — das ist
die Probe gegen Nähe-Zuordnung, nicht bloß gegen ein fehlendes Feld. Ebenso: Receipt mit *fremder*
und Receipt *ohne* `programId` werden beide ausgeschlossen; `fleet.json` bleibt über einen Aufruf
byte- UND mtime-identisch, beide Ledger ebenso; der Restart-Vergleich ist feldweise; das
Fixture-Cleanup stellt die Ledger-Baselines wieder her.

**Land-Weg, und er weicht wie bei WS14 von der Routine ab:** Lane-Verify voll grün (Gate-Kette +
isolated, alle Tails wörtlich `ALL PASS`). Der Land-Gate wurde dennoch **rot mit genau einem
Fail**: `boot-race fixture: the pane is still unobserved before immediate /send`
(`fleet-e2e-harness.ts`, Phase 2 des claude-gate) — eine FIXTURE-VORBEDINGUNG in einer Datei, die
die Lane nicht angefasst hat, bei `clean rebase` und `waitMs 0`. Beweis nach der Ordnung:
**serieller Same-Tree-Rerun von `./e2e-claude-gate.sh` auf `4ef21e2` = `ALL PASS`, 0 FAILs** —
Nichtdeterminismus direkt bewiesen, nicht per Flake-Namen behauptet. Dieselbe Sondenfamilie hat
schon `46e0653` rot gemacht; die Queue führt sie offen als `911bdb73`. Gelandet über den
**Confirm-Land** (`{confirm:true}`, Garantie rein git, kein Re-Verify) — die Land-Note trägt
`confirmedByHuman:true` samt vollständigem rotem Gate-Verdikt. Post-Land-Audit **grün und
substanziell**: `ms 846716` (14,1 min), `exitCode 0`, **2355/0 Checks (+27 gegenüber 2328)**, 17
aufbewahrte PASS-Zeilen, Tail `ALL PASS`, `covers` genau ein Land. Deploy **`93a5693a`**
(`ok:true`, `bootHead == target == 4ef21e2`, `hitTarget:true`, `bundleStale:false`).

**Live-Canary voller Kreis (nach dem Deploy, Wegwerf-Program `cfa94f4f`):** gebundener MAIN sieht
GENAU sein Program mit `sessionIdMatch:"exact"` und `executionState:"active"`; der Task MIT
`programId` ist gejoint, der zeitgleich angelegte OHNE bleibt unattributed; der Bootstrap-Receipt
ist über seine persistierte `programId` gejoint; die Lineage-`unknown`-Zeile steht auch in der
sonst vollständigen Sicht; die **unbeteiligte MAIN-Session im selben Repo zur selben Zeit sieht
`programs: []`**; nach `complete` steht `executionState:"not-executing"` plus Status-Zeile. Der
neue Deploy-Watch trug sofort `slotOpenedAt` — das Provenienzfeld ist live bewiesen.

**Bewusst NICHT gebaut:** Client/UI, Owner-Route, persistierte MAIN-Lineage, Übertragung alter
Events/Watches bei der Succession, allgemeines Operationsmodell, Self-Land, Event-Bus,
Task-Erzeugung, adaptive Execution-Policy, jede Automatik auf Basis der View.

**Zwei Befunde aus diesem Schnitt, als Befunde und NICHT als Workstream:**
1. **`done-looking` ist kein Help-Kanal.** Der Worker wartete 34 min korrekt auf eine
   Scope-/Authority-Entscheidung — Worktree dirty, uncommitted, `ahead=0` — und war damit für
   JEDES Watch-Prädikat unsichtbar (`laneWatchSignal` kennt nur `done-looking` und
   `host-commit-looking`, letzteres verlangt `hostCommits`, seit `fc8f4ad` überall `false`). Ohne
   die Owner-Meldung hätte MAIN blind auf ein Signal gewartet, das nie kommt. Kleinste spätere
   Form (Owner-Präzisierung 2026-08-15), NICHT jetzt bauen: REUSE des FleetEvent-Pfads für
   Worker→MAIN als `clarification-request` mit serverseitiger Slot-/Session-/Task-/Program-
   Provenienz, REUSE von `canDeliver`/`sendText` für MAIN→Worker, eine schmale Reply-Naht, die
   Request-ID + Text koppelt und `answered` ERST nach erfolgreichem Send setzt. Kein zweiter Bus,
   kein Pane-Parsing, kein Event-Sourcing, keine generische RPC-Abstraktion.
2. **Graphify ist als Architekturbeleg NICHT tragfähig** (abgeschlossene owner-autorisierte
   Kalibrierung auf exakt `cc0d339`: `reflect` = 0 useful, 3 dead_end, 2 corrected; 1 von 7
   geprüften Zeilenankern korrekt, fehlende materielle Knoten, ein schädliches leeres
   `affected`-Ergebnis). Dieser Schnitt wurde vollständig source-first erdet. Der `PreToolUse`-Hook
   dieses Checkouts fordert weiterhin bei JEDEM Bash-Aufruf `graphify query` — das ist ein
   dokumentierter DRIFTBEFUND gegen die Messung. **Daraus wird hier ausdrücklich noch kein Hook-
   oder Tool-Umbau abgeleitet.**

**Ziel dahinter (gesetzt, nicht begonnen):** Self-Land als inspizierbare Eligibility-Entscheidung
(Shadow-Klassifikation zuerst; Tatsachenliste: Kickoff §7 / Doktrin §12) und der manuelle
Work-Trail-Learning-Loop (P4; Owner promotet).

**Pausiert (Owner-Stop 2026-08-12):** Task-Wellen, Cluster-Fan-out, Queue-/Dashboard-Ausbau
(`docs/plan-queue-refinement-2026-08-11.md` = geparkte Quelle) · vorzeitige Token-/Kosten-
optimierung (Rulebook-Split P1-C bleibt hinter G1) · Capability-Großmatrix, Event-Sourcing,
Maschinen-Sync (Anti-Ziele: Theo-Vergleich §8, Harness-Brief §14).

## Workstream 19 — Clarification-Kanal v1 (gelandet `ebb6f02`, 2026-08-15)

Der Befund aus WS18 („`done-looking` ist kein Help-Kanal") ist geschlossen. Eine taskgebundene
Lane kann jetzt eine Frage stellen; der Server leitet den koordinierenden MAIN **ausschließlich
aus exakten Serverfakten** ab, stellt die Frage über die BESTEHENDE FleetEvent-Maschinerie zu, und
MAIN antwortet über `canDeliver`/`sendText` als normale Pane-Nachricht. Kein zweiter Bus, kein RPC.

**Empfängerregel (der Kern).** Zwei Belege, sonst nichts: (A) ein `status:"active"` Program mit
`main`, dessen `slot+openedAt` auf einen lebenden Slot zeigt — `sessionId` wird berichtet, nie
gegatet (ein Codex-Bind ändert sie innerhalb desselben Occupant; dieselbe Regel wie
`ProgramExecutionView.authority.sessionIdMatch`); (B) eine Lane-/Merge-Watch auf exakt diese
Lane-Identität **mit** `slotOpenedAt` und lebendem, exakt passendem Empfänger-Occupant. `armed` ist
bewusst kein Gate — eine gespendete Watch benennt denselben Koordinator, und eine armed-only-Regel
ließe den Kanal genau dann verschwinden, wenn MAIN zuletzt informiert wurde. Vier unterscheidbare
fail-closed 409: kein Beleg · nur Legacy-Watch ohne `slotOpenedAt` · Program/Watch widersprechen ·
mehrere Watch-Occupanten. Keine Rezenz, Slotnähe, Label-, Text- oder Zeitheuristik.

**Die drei Nebenentscheide, alle additiv.** `FleetEventBase.watchId: string | null` mit erzwungener
Äquivalenz `null ⟺ kind==="clarification-request"` (Pin) — ein Clarification-Event entsteht ohne
Watch, die vier alten Arten behalten String-Zwang und byte-stabile Feldreihenfolge. ·
`Slot.awaiting: "owner" | "main" | null`: `"owner"` heißt weiter wörtlich „wartet auf den OWNER"
und `handleStewardSend` liest es so (Wortlaut unverändert, weil gepinnt), `"main"` bekam einen
eigenen 409-Zweig; die vorhandenen `awaiting:null`-Klauseln in `HOST_COMMIT_LOOKING_RULES` und
`STALLED_RULES` machen eine wartende Lane damit automatisch weder host-commit-looking noch stalled.
· **Ack bleibt für ALLE Arten reines Lesequittieren** und beantwortet ausdrücklich nichts; nur ein
erfolgreicher `sendText` schließt Request und Wartezustand (Quell-Pin: die `answered`-Zuweisung
muss hinter `await sendText` stehen).

**Gemessen, nicht berichtet.** Land-Gate rot mit GENAU EINEM Fail — `silent-alive fixture: the pane
has still never printed before /send` (`fleet-e2e-claude-gate.ts:85`, Detail ein Zeitstempel statt
`0`), eine Fixture-VORBEDINGUNG in einer von der Lane nicht angefassten Datei; der darauf
aufbauende Verhaltens-Check war grün. Serieller Same-Tree-Rerun auf `ebb6f02`: **116 PASS, 0 FAIL,
alle drei Phasen `ALL PASS`**, die Sonde grün mit `lastOutput (0)`. Gelandet per Confirm-Land, die
Land-Note trägt das volle rote Verdikt plus `confirmedByHuman:true`. Post-Land-Audit **grün und
substanziell**: 879 991 ms, 2387/0 Checks, 17 PASS-Zeilen, `covers` genau dieses Land (+32 gegen
2355 = exakt die neuen Sonden). Deploy `dcd10b88` `ok:true`, `bootHead == target == ebb6f02`,
`hitTarget:true`, `bundleStale:false`.

**Live-Canary, voller Kreis** (echte Wegwerf-Lane, danach restlos entfernt): Refusal ohne Beleg
(`409 no exact clarification receiver evidence`) und **nachgewiesen ohne Mutation** · nach dem
Watch-Abo derselbe Request mit absichtlich gefälschten Body-Feldern (`worker.slot:99`,
`receiver.slot:13`, `taskId:"gefaelscht"`, `basis:"program-main"`) → der Server stempelte Worker 2,
Receiver 1, Provenienz `null`, `basis:"lane-watch"`; **kein Body-Feld kam durch** · zweiter Request
mit anderem Text bei offenem Vorgang → `existing:true`, EIN Event, `watchId:null`, `awaiting:"main"`
· Event blieb `pending`, solange die MAIN-Pane beschäftigt war, und wurde nach der Ruhe-Schwelle
genau einmal typisiert zugestellt · Reply → Antwort wörtlich in der Worker-Pane, **genau eine**
ANSWER-Zeile · identische Zweit-Reply `existing:true` (kein zweiter Send), abweichender Text 409
ohne Mutation · danach Event `acknowledged`, Request `answered`, `awaiting` gelöscht.

**Drei benannte Grenzen (Befunde, kein Workstream).** (1) Die Reply-Naht hat **kein**
`send-uncertain`: wirft tmux nach teilweiser Zustellung, bleibt der Request offen und ein zweiter
Versuch könnte den Text doppelt schreiben — direkte Folge von „niemals Erfolg vor Send" und die
richtige Seite des Trade-offs, aber ungebucht. (2) Owner-`/send` löscht `awaiting` bedingungslos,
auch ein `"main"`-Warten, während der Request `open` bleibt (Budgetplatz belegt, GET zeigt weiter
offen). (3) `clarificationsFor` teilt nach `s.worktree`: der `⚙ steward` darf antworten, trägt aber
einen Worktree und würde in GET als *Worker* gefiltert — reine Sichtbarkeitslücke, das Event trägt
alles Nötige.

**Bewusst NICHT gebaut:** UI/Client, Owner-Kanal-Adapter, Push, Event-Sourcing, generisches
RPC/Helpdesk, Pane-Parsing, Auto-Approve, Task-Welle, Self-Land. Die spätere Owner-Kanal-Idee ist
nur dokumentiert: Program-MAIN bekommt operative Ereignisse, ein Owner-Kanal soll später nur
`needs-owner`, Rot und wichtige Abschlüsse dedupliziert und ackbar erhalten.

## Workstream 20 — die Verify-Drift geschlossen (gelandet `446d74b` main-direct, 2026-08-15)

Der Truth-Slice darunter ist **gebaut**; er bleibt als Befund stehen, weil er den Zustand VOR
diesem Commit beschreibt. Was sich änderte, in drei Zeilen:

- **`watchdog.sh:91`** — `VERIFY_CMD` bekam `bun run build` und `merge-prompt.ts`. Aufwärts
  angeglichen, weil die dokumentierte Kette die richtige war und nur der Gate zurückhing.
- **`AGENTS.md` §Verify** — `merge-prompt.ts` in den Fence; alle drei Quellen nennen dieselben elf
  tsc-Ziele. (`merge-prompt.ts` ist redundant, nicht Lücke — `docs/verify-tiering.md` hat die
  transitive Abdeckung per Mutation bewiesen. Es steht explizit da, damit die drei Listen EINE sind.)
- **`e2e/pins.ts`** — `RULE_VERIFY` vergleicht jetzt die GEORDNETE Schrittfolge statt zweier
  Teilmengen, gegen eine **dritte** Quelle: `LOCAL_PROOF_STEPS` aus `verify-proportion.ts`. Das ist
  die Pointe des Befunds — Fleet empfahl jeder Lane über `localProof.steps` einen Schritt, den sein
  eigener Gate nie fuhr. Schritte werden über eindeutige Marker und ihre POSITION gefunden, darum
  brauchen Repo-Guard, `|| { echo … }`-Handler und der `;`/`&&`-Mix in `VERIFY_CMD` kein Parsing.
  `verify-proportion.ts` wird als DATEI gelesen, nicht importiert: `e2e/pins.ts` ist fs-only per
  Konstruktion, so bleibt die dritte Quelle eine gepinnte Seite statt einer Compile-Abhängigkeit.

**Der Pin fällt auch** (Mutationsprobe, Datei danach byte-identisch wiederhergestellt): ohne
`bun run build` in `VERIFY_CMD` meldet er
`FAIL … gate=[install>pins>tsc>clean-review>security>claude-gate]`, exit 1 — exakt der Zustand, der
vorher grün war. Weiter gemessen: volle NEUE Kette von Hand exit 0 mit sieben `ALL PASS`;
`./e2e-isolated.sh` 2387/0 `ALL PASS`.

**Aktivierung ist ZWEI Schritte, nicht einer** (Owner-Klarstellung, und sie ist der Teil, den man
sonst falsch macht): `launchctl kickstart` startet nur den Watchdog neu — der laufende `srv` trägt
`FLEET_VERIFY_CMD` in seiner Spawn-Env und bleibt auf dem alten Wert, bis er selbst neu startet.
Also kickstart **und** Deploy/srv-Neustart (`3cf78f2c`, `ok:true`, `bootHead == target == 446d74b`,
`hitTarget:true`, `bundleStale:false`).

**Live-Beweis ohne Waiver.** `GET /api/self/gate` ist lane-only und antwortet einer Nicht-Lane
`409 not a lane — the gate judges a lane's land`. Statt das zu umgehen, hat eine Wegwerf-Lane die
Route mit ihrem EIGENEN Self-Token gefragt: `verify.cmd` enthält `bun run build` **und**
`merge-prompt.ts`, und `localProof.steps` = `install>pins>tsc>build>clean-review>security>claude-gate`
ist jetzt deckungsgleich mit dem, was der Gate wirklich fährt. Lane danach restlos entfernt.

**Eine eigene Sonde ist mir dabei kaputtgegangen, und das gehört ins Register:** der Vorher/Nachher-
Vergleich lief zuerst als `ps eww <pid> | tr ' ' '\n' | grep -c "bun run build"` — der Wort-Split
zerlegt das Muster in drei Zeilen, also konnte der Zähler NIE treffen. Er meldete „0" für den alten
srv (richtige Antwort, falsche Begründung) und „0" für den neuen (schlicht falsch). Dieselbe Lektion
wie im Regelbuch: eine Sonde, die nicht messen kann, meldet denselben Wert wie eine Messung. Der
korrekte Vorher-Beleg ist ein dauerhafter Fakt statt einer Live-Sonde — die **Land-Note von
`ebb6f02`** trägt den `verify.cmd`, der dieses Land tatsächlich gatete: `bun run build` 0 Treffer,
`merge-prompt.ts` 0 Treffer.

## Truth-Slice (Befund 2026-08-15, GEBAUT als WS20 darüber — beschreibt den Zustand davor)

Gefunden von einem read-only Sol-Ultra-Scout, der korrekt an der Stelle anhielt statt zu raten;
vom Owner und danach hier source-seitig gegengeprüft. Drei Beschreibungen derselben Kette, und
keine zwei sind gleich:

| Quelle | Schritte |
|---|---|
| `AGENTS.md` §Verify (Fence) | install · pins · tsc (10 Dateien) · **`bun run build`** · clean-review · security · claude-gate |
| `watchdog.sh:91` `VERIFY_CMD` (der LIVE serverseitige Land-Gate) | install · pins · tsc (dieselben 10) · clean-review · security · claude-gate — **KEIN Build** |
| `CLAUDE.md` §Lane discipline | install · pins · tsc (**11** — zusätzlich `merge-prompt.ts`) · build · die drei Suiten, mit der Behauptung, das sei inhaltlich der Live-Gate |

**Der reale Coverage-Gap ist genau einer: der fehlende `bun run build` im serverseitigen Gate.**
Ein Bruch, den nur der Bundler sieht (`src/client.ts`/`src/share.ts`-Seite), kommt am Land-Gate
vorbei und fällt erst im Post-Land-Audit oder beim Deploy auf.

**`merge-prompt.ts` ist KEIN Gap** — die Präzisierung gehört dazu, sonst wandert der Befund beim
nächsten Lesen an die falsche Stelle: `docs/verify-tiering.md` §(Zeilen 156-170) hat per
**Mutationsprobe** bewiesen, dass `tsc` die Datei transitiv über die Importkette der explizit
genannten Wurzeln typechecked (eingebauter Typfehler → `merge-prompt.ts(192,7): error TS2322`;
unveränderte Kopie → still). Die CLAUDE.md-Zeile ist also redundant, nicht falsch.

**Warum der Drift GRÜN blieb, und das ist der eigentliche Befund:** `e2e/pins.ts:370` heißt
`RULE_VERIFY` = „AGENTS.md's verify block runs **exactly** what watchdog.sh's VERIFY_CMD gates",
vergleicht aber nur zwei Mengen — die `./e2e-*.sh`-Suiten und die explizite `tsc`-Dateiliste
(`e2e/pins.ts:376-396`). `bun install`, `bun e2e/pins.ts` und `bun run build` liegen in KEINER der
beiden extrahierten Mengen. Der Pin sagt „exactly" und prüft zwei von mindestens fünf Schrittarten;
die Schrittmenge und ihre Reihenfolge sind ungepinnt. Ein Pin, dessen Name mehr behauptet als sein
Vergleich deckt, ist teurer als gar keiner — er macht die Lücke unsichtbar.

**Empfohlener späterer kleiner Schnitt (Owner-Vorgabe: jetzt NICHT bauen, kein Eingriff in den
Clarification-Diff):**
1. Zielkette owner-seitig **aufwärts** angleichen — `bun run build` in `VERIFY_CMD` aufnehmen
   (gemessene Kosten ~90 ms, also faktisch gratis gegen ein 94-s-p50-Gate).
2. Die explizite `tsc`-Liste über alle drei Quellen vereinheitlichen (eine Liste, eine Wahrheit).
3. `RULE_VERIFY` auf die **vollständige Schrittmenge und ihre Reihenfolge** schärfen, statt auf
   zwei Teilmengen — und den Regelnamen erst dann „exactly" nennen dürfen.

Bis dahin gilt für jede Lane unverändert: der lokale Beweis fährt den Build, der serverseitige
Gate tut es nicht — ein grünes Land ist kein Beweis, dass das Bundle baut.

## Workstream 21 — Program-MAIN gründet im Ziel-Repo (gelandet `5467ce2` + `5edee9f`, 2026-08-15)

**Gefunden hat die Lücke ein echter Consumer, nicht eine Sonde.** Das Product-Studio-Programm
*private-repo-h* (`9f42350e…`, `active`) sollte ein Program-MAIN in seinem eigenen Repo gründen —
und genau daran wurde sichtbar, dass Fleet das mechanisch KANN und dabei einen falschen Vertrag
ausliefert. Der Private-repo-h-Bootstrap blieb bis zu diesem Schnitt absichtlich aus.

**Der Zustand davor, an HEAD `f146162` gelesen.** `buildProgramMainBrief` und
`buildProgramMainSuccessionBrief` gaben JEDEM Program-MAIN — in jedem cwd — dieselben vier
Fleet-Erdungsschritte (`./state.sh`, `./register.sh`, oberster `HANDOFF.md`-Abschnitt, „inspect the
live queue through Fleet"). `BOOTSTRAP_CONTEXT_CAPABILITIES` behauptete acht Fleet-Repo-Fähigkeiten
bedingungslos, und alle sechs Context Packs zeigen auf Fleet-Quellen bzw. die private Overlay-ID.
`bootstrapProgramMain` band und schrieb trotzdem ein Receipt, sobald HEAD/Branch lesbar waren und
`sendText` durchkam. **Und die bestehende positive Sonde war ein bewiesener False-Success:** sie
bootstrappte mit `cwd: REPO`, dem isolierten FREMD-Repo `$DIR/testrepo` ohne `AGENTS.md`, ohne
`state.sh`, ohne `HANDOFF.md`, und prüfte nur Header-Substring und Hash-Rekonstruktion.

**Was gebaut wurde, in fünf Zeilen:**

- **Repo-Identität ausschließlich aus git.** `FLEET_REPO_ROOT = repoRootOf(import.meta.dir)` einmal
  beim Boot; ein Ziel ist `fleet-control` genau dann, wenn sein kanonisches Toplevel damit
  übereinstimmt. `null` auf der Fleet-Seite heißt: KEIN cwd ist fleet-control — fail-safe, nie eine
  Fleet-Fähigkeit auf Verdacht. Dateinamen entscheiden nie (Decoy-Sonde unten).
- **Preflight VOR jeder Slot-Öffnung**, geteilt von Bootstrap und Succession: kanonisches Toplevel ·
  HEAD · Branch · und für ein Fremd-Repo eine getrackte, nichtleere Root-`AGENTS.md`
  (`git cat-file -s HEAD:AGENTS.md`). Ein Fehlschlag öffnet keinen Slot, sendet nichts, bindet
  nichts und schreibt kein Receipt. Der Post-Open-HEAD-Lesevorgang beider Routen ist damit
  ersetzt, nicht verdoppelt.
- **Zwei Frames, ein Builder je Route.** `fleet-control` ist wortgleich das Alte (an der geordneten
  Schrittliste gepinnt, nicht per Substring). `target-repo` liefert einen ausführbaren Vertrag:
  Root-`AGENTS.md` vollständig lesen, auf git erden, die REPO-EIGENEN Run-/Proof-Kommandos und
  Quellen ermitteln, das eingebettete Program als Owner-Wahrheit nehmen, den nächsten kleinsten
  Akt wählen — und nennt Fleet-Skripte, HANDOFF, Fleet-Docs, die private Overlay-ID und die
  Fleet-Queue nicht.
- **Ein neuer geschlossener Auslassungsgrund, `source-unavailable`**, als ERSTE Stufe der Leiter:
  im Fremd-Repo werden alle sechs Packs mit genau diesem Grund ausgelassen, nichts wird
  ausgewählt, und der Anker-Block bleibt dadurch von selbst leer — kein zweiter Leerpfad.
  Receipt-Schema unverändert; Legacy-Zeilen laden byte-identisch (eigene Sonde).
- **Bewusst NICHT geschlossen, benannt statt versteckt:** ein *linked worktree* von Fleet hat sein
  eigenes Toplevel und klassifiziert damit als `target-repo` (Code-Kommentar). Und der
  Dispatch-Pfad behält sein heutiges Verhalten mit explizitem `sourceTree: "fleet"` — ein fremdes
  `FLEET_DISPATCH_REPO` bekäme dort weiterhin Fleet-Packs. Beides ist eine benannte Grenze dieses
  Schnitts, keine Nebenwirkung.

**Die Fixture war der teure Teil, und daraus wurde der zweite Commit.** Ein `fleet-control`-cwd
existierte in der isolierten Suite gar nicht (das gestagte Instanzverzeichnis ist kein Repo), also
`git init` auf `$DIR` — plus die beiden ausgewählten Pack-Quellen an ihren Repo-Pfaden, damit die
Anker am Receipt-HEAD wirklich auflösen. Genau das brach eine Prämisse, die zwei Dateien weiter als
Kommentar stand: `e2e/trail-emit.ts` `sourceTree()` fällt auf ROOT zurück, „a throwaway copy with no
`.git` of its own". Sichtbar wurde es NUR unter dem Post-Land-Audit, der die Suite aus einem
`git archive`-Snapshot fährt (`snapshotIntegrationTree`) — dort ist der Symlink-Kandidat kein
Work-Tree, der Rückfall greift, und der Trail landet INNERHALB der Instanz. Vier FAILs, eine Wurzel,
adjudiziert als `real`. Der Fix ist die Regel, nicht das Symptom: existiert der
`node_modules`-Symlink, ist ROOT per Konstruktion eine gestagte Instanz und kommt als Kandidat nicht
mehr vor; `resolveSourceTree()` ist dafür rein und injizierbar herausgezogen, die Gegenprobe braucht
keine echte Audit-Instanz. **Die allgemeine Form gehört ins Register:** eine Fixture, die einem
Wegwerf-Verzeichnis eine ECHTE Identität gibt, kann eine Sonde umlenken, die diese Identität als
Unterscheidungsmerkmal benutzt — und die Kollision zeigt sich dann nur in der Invokations-Form, die
die Lane nicht fährt.

**Beweise.** Land 1 `5467ce2`: `verify.ok:true`, 97 455 ms Arbeit, 0 ms Mutex-Wartezeit,
`confirmedByHuman:false` — der erste fremde Schnitt an der seit `446d74b` angeglichenen Kette
(`install → pins → tsc(11) → build → drei Suiten`). Audit rot, 2395/4, eine Wurzel, `real`.
Land 2 `5edee9f`: verify grün; Audit **grün und substanziell, 2396 Checks / 0 FAIL / 905 802 ms** —
und die Trail-Familie beweist die Reparatur unter genau der Form, die die Lane ausdrücklich nicht
fahren konnte (`$TMPDIR/fleet-e2e-trail/`, `tree=null`). Deploy `b7621e70`: `ok:true`,
`bootHead == target == 5edee9f`, `hitTarget:true`, `bundleStale:false`.

**Live-Canary, voller Kreis, drei echte Wegwerf-Repos gegen den deployten Server** (danach restlos
entfernt, Programme `complete`):
- Fremd-Repo OHNE getrackte `AGENTS.md` → `400 target repository requires a tracked, non-empty root
  AGENTS.md`, und nachgemessen: Receipt-Zahl unverändert, Slot-Belegung unverändert,
  `program.main` weiter `null`.
- Fremd-Repo MIT `AGENTS.md` → Ziel-Vertrag ausgeliefert, Receipt auf `…/canary-with`, HEAD
  `2493ad4` = der HEAD dieses Repos, `selected: []`, alle sechs `source-unavailable`,
  `deliveredBytes` = tatsächliche Prompt-Bytes. Das Builder-Präfix enthält keinen der sechs
  Fleet-Begriffe, während der Owner-Pfad `docs/program-origin.md` im JSON verbatim überlebt.
- Fleet-Root → die vier alten Schritte in Reihenfolge, zwei Packs (`portable-core`, `verify-e2e`),
  drei Anker, und die Anker lösen am Receipt-HEAD `5edee9f` wirklich auf (`git show` auf beide
  Dateien, Überschriften vorhanden).

## Workstream 22 — Communication Cut 1: drei Clarification-Kanten (gelandet `8be79d3`, 2026-08-16)

Erster Schnitt des owner-bestätigten Programms „Fleet Communication Truth". Genau eine
Claude-Opus-5-Lane (Task `756cf668`, Dispatch-Knopf), Fable-MAIN entwarf, reviewte, landete.

- **Kante A — `send-uncertain` am Reply-Pfad.** `replyClarification` ließ einen `sendText`-Wurf
  als `open` zurück: blinder Retry, kein Restart-Beweis. Jetzt spiegelt der Reply exakt das
  FleetEvent-Transportmuster (FACT 2 in `tickWatches`): Status + pending answer `{text,at,by}`
  werden VOR tmux persistiert (`saveStateNow`), ein Wurf bewahrt den Marker, Retry ist
  prinzipal-getrieben und nur byte-identisch (anderer Text → 409, pending answer unangetastet),
  kein Tick sendet je nach. Nicht terminal (Prune = answered|refused only), aber refusierbar
  (Worker weg → sonst unprunebar). Worker-`awaiting:"main"` hält bis zum bestätigten answered.
- **Kante B — Owner `/send` löscht nur noch einen `"owner"`-Wait.** Ein `"main"`-Wait wartet auf
  Program-MAINs Antwort; der tippende Owner ist nicht diese Antwort, und das Löschen hätte
  Steward-Nudges an einer unbeantworteten Frage vorbei wieder geöffnet.
- **Kante C — GET-Scope folgt der ROLLE, nicht worktree-ness.** `clarificationsFor` ist die Union
  exakter worker-/receiver-Binding-Matches; ein Receiver im Worktree (⚙-steward-Form) sieht
  seine empfangenen Zeilen.
- **Beweise:** neuer Pin (Ordnung send-uncertain → saveStateNow → sendText + Terminal-Menge),
  sechs neue e2e-Checks (Kante-B-Gegenprobe in beide Richtungen, awaiting aus der State-Datei
  statt `/api/sessions`-Cast, Fixture-eigene Checks), Land-Gate grün 107 s, Audit grün 2402/0
  (1000 s), Deploy `c904ccee` `hitTarget:true`, Live-Canary voller Kreis auf dem deployten
  Server (Clarification öffnen → Owner-/send während `awaiting:"main"` → Wait hält → Reply →
  answered, Wait null, Antwort in der Pane). Der send-uncertain-Zweig selbst wurde nur in
  e2e/Audit bewiesen, nicht live erzwungen (eine gesunde Pane wirft nicht).
- **Entschieden (offene Frage 2 des Programms):** die zwei kleinen Kanten landeten MIT dem
  Transportzustand als ein Land — gleiche ~80-Zeilen-Region, gleiche e2e-Familie, ein zweiter
  Audit-Zyklus hätte nichts isoliert. Offene Frage 1 (Zustandsform) = die FleetEvent-Form,
  wiederverwendet statt erfunden.
- **Nächster Schnitt laut Programm:** Program-MAIN→Owner attention, typed owner-send receipt,
  Client-Inbox (Cut 2) — beginnt ausdrücklich erst jetzt.

## Workstream 23 — Communication Cut 2: AttentionRequest v1 (gelandet `03019e1`, 2026-08-16)

Zweiter Schnitt desselben Programms, gleiche Arbeitsteilung (eine Claude-Opus-5-Lane, Task
`57f29dcb`; Fable-MAIN entwarf, reviewte, landete). Ein gebundener Program-MAIN erreicht den
OWNER — durable, einmal, außerhalb des Composers.

- **Modell:** `AttentionRequest` = ClarificationRequest mit getauschten Rollen; der Owner ist
  PRINCIPAL, kein Slot (`answer.by: "owner"`, kein erfundenes Occupant-Tripel). Kinds
  decision|blocked|review-ready. `programId` wird serverseitig aus der MAIN-Bindung abgeleitet
  (`boundProgramForMain`, dieselbe Occupant-Regel wie ProgramExecutionView), nie aus dem Body.
- **Routen:** `POST/GET /api/self/attention` (POST nicht-Lane; Dedupe je Binding+Kind+Text;
  Open-Cap 5) · `GET /api/attention` (Owner, Programm-Titel zur Lesezeit gejoint) ·
  `POST /api/attention/:id/answer` — exakt der Cut-1-Transport (send-uncertain + saveStateNow VOR
  sendText, byte-identischer Retry, Terminal = answered|refused) · `POST /api/attention/:id/refuse`
  (Grund PFLICHT: die Refusal ist die Quittung „gesehen und abgelehnt").
- **Fail-safe:** `reconcileAttention` (Teardown+Boot) refused Zeilen mit verschwundenem/ersetztem
  Requester — nichts routet je auf einen recycelten Slot; die Nachfolge-MAIN erhebt neu.
- **Client-Inbox:** 📣-Badge nur bei offenen Zeilen; auf dem 2-s-Poll reitet EIN Feld
  (`attentionOpen`, bei 0 ausgelassen — der 12-KiB-Wächter blieb hart, die Vorschau fing die
  4-Byte-Überschreitung); Zeilen via `GET /api/attention` beim Öffnen/Zählerwechsel. Drafts
  überleben Repaints; send-uncertain sperrt die Textarea auf den pending Text.
- **Beweise:** Pin (Ordnung + Terminal-Menge, Spiegel des Cut-1-Pins), 19 Checks in neuem
  `e2e/attention.ts` (+`e2e/security.ts`-Allowlist-Eintrag mit Begründung), Gate grün, Audit grün
  2422/0 (896 s), Deploy `f87cd3c7` `hitTarget:true`. **Live-Kreis vollständig und
  selbst-referentiell:** dieser Program-MAIN (Slot 2, gebunden an `628fd762`) erhob live eine
  review-ready-Zeile über die eigene Route, der Owner-Poll trug `attentionOpen:1`, das Board
  zeigte 📣1, die Antwort wurde IM BOARD-UI getippt (Playwright), und die typisierte
  `OWNER ANSWER [attention 260e326e…]`-Quittung kam in die Requester-Pane — Zeile terminal
  `answered/by:"owner"`, Badge zurück auf leer, Row collapsed. Der send-uncertain-Zweig ist wie
  bei Cut 1 e2e-/audit-bewiesen, nicht live erzwungen.
- **Offen laut Programm:** typed owner-send receipt am generischen `/send` (receiver
  openedAt/sessionId/sendId) blieb außerhalb dieses Schnitts; Client-Inbox zeigt nur Attention,
  keine Clarifications (bewusst nicht aufgeblasen).

## Workstream 24 — Communication Cut 3: typed owner-send receipt (gelandet `cafb39b`, 2026-08-16)

Dritter und letzter benannter Schnitt des Communication-Programms (eine Claude-Opus-5-Lane, Task
`815db0cb`; Fable-MAIN entwarf, reviewte, landete). Schließt die Evidenz-Lücke des
Tool-Evidence-Audits: `/send` und Promptjournal trugen weder receiver openedAt/sessionId noch eine
Send-Identität, und ein partieller Send war ein untypisierter 500 ohne Spur.

- **Journal:** `logPrompt` schreibt `openedAt`+`sessionId` UNBEDINGT für jeden Aufrufer (die
  Slot-NUMMER identifiziert eine Row, die recycelt wird — das Occupant-Paar identifiziert, wer den
  Text wirklich bekam), plus optional `sendId`/`delivery` (absent statt null). Alle sieben
  Journal-Leser vorab geprüft: additiv tolerant, keiner musste angefasst werden.
- **`/send`:** `sendId` (24 hex) VOR dem Transport gemintet, damit Receipt und Journalzeile in
  beiden Ausgängen joinbar sind. Erfolg → `{ok, receipt:{sendId, at, submitted, receiver}}` +
  Journal `delivery:"sent"`. Wurf → Journal `delivery:"uncertain"` PFLICHT im catch + typisierter
  409 mit uncertain-Receipt; kein Retry, kein Tick; History bekommt den Eintrag NICHT (Recall darf
  eine Vermutung nicht als Fakt abspielen). Cut-1-`awaiting`-Klausel byte-identisch erhalten.
- **Client:** der 409 hebt zusätzlich einen Toast („send outcome uncertain — check the pane before
  retrying") — der rote Flash allein las sich als „nichts ging raus" und lud zum Doppel-Send ein.
- **Beweise:** Pin (genau ein sendText im /send-Slice, im try, catch journalt vor „uncertain"),
  14 Checks in `e2e/slots.ts` (Receipt, Journal-Attribution gepollt, uncertain-Pfad deterministisch
  via entferntem cwd, Recycling-Gegenprobe mit neuem openedAt), Gate grün, Audit grün 2436/0
  (891 s), Deploy `3384abd3` `hitTarget:true`. **Live BEIDE Zweige bewiesen:** ein Leer-Text-Send
  warf real (tmux verweigert leeren Paste) → typisierter 409 + Journal `uncertain`; der echte Send
  lieferte das Erfolgs-Receipt, dessen `sendId` die Journalzeile joint — beide exakt auf das
  Occupant-Tripel von Slot 2 attribuiert.
- **Programm-Stand danach:** alle im Programm benannten Elemente des Korridors sind gelandet —
  Cut 1 (drei Clarification-Kanten, `8be79d3`), Cut 2 (AttentionRequest v1 + Inbox, `03019e1`),
  Cut 3 (typed owner-send receipt, `cafb39b`). Das Erfüllungs-Urteil über das successCriterion
  gehört dem Owner; die review-ready-Attention-Zeile dafür ist erhoben und wartet offen.

## Workstream 25 — Supervisor Operations Inbox v1: Delivery als Subskriptions-Fakt (gelandet `3ed2074`, 2026-08-16)

Schließt die live gemessene Last-Mile-Kollision (Event `10e8c1233666c6686d638f7f`, Receiver
Slot 4): `tickWatches` FACT 2 tippte JEDES pending FleetEvent per `sendText` in die Receiver-Pane —
bei einer owner-attended Konversation landete der Completion-Fakt im Composer des Owners. Eine
Claude-Opus-5-Lane implementierte (Slot 6, `529b3b8` → rebased `3ed2074`); Fable-MAIN entwarf,
reviewte, landete, deployte, bewies.

- **Der Fix ist ein FAKT, keine Heuristik:** `Watch.delivery?: "pane"|"inbox"` (absent = Legacy-
  Pane, nie backfilled), validiert am Loader UND an `createWatchForSlot` (unbekanntes Wort =
  benannter 400, nie ein Default). Das Event erbt das Feld plus GENAU EIN neues Statuswort
  `"inbox"`; `deliveredAt` bleibt auf solchen Rows für immer null.
- **Split per Konstruktion, nicht per Guard:** alle vier Mint-Stellen spreaden `mintTransport(w)`;
  FACT 2 selektiert weiterhin `status === "pending"` allein — eine Inbox-Row kann `sendText`,
  History-Append und Promptjournal strukturell nie erreichen. Clarifications sind watch-los und
  pane-only; `delivery:"inbox"` darauf wird am Loader abgewiesen.
- **Ack-Split, weil Sichtbarkeit ≠ Konsum:** Self-Ack 409t eine Inbox-Row („belongs to the
  owner"); der neue Owner-Twin `POST /api/events/:id/ack` 409t eine Pane-Row, 404t Unbekanntes,
  409t receiver-gone, ist idempotent und schreibt das EIGENE Audit-Wort `fleet_event_owner_ack`.
  Identität fällt weiter geschlossen: ein recycelter Receiver macht die Row terminal.
- **Client:** 📥-Badge/Panel über den Events, die der 2-s-Poll ohnehin trägt (null Payload-Kosten),
  strikt getrennt von 📣 — ein Operations-Fakt ist keine Entscheidungsanfrage.
- **Beweise:** 12-Check-Inbox-Familie in `e2e/watch.ts` + zwei strukturelle Pins (FACT 2 selektiert
  nur „pending"; Ack-Split hält in beide Richtungen). Gate grün; Audit ROT 2451/1 — der eine Fail
  war der 12-KiB-Budget-Check (12476 B), Same-Tree-Rerun auf `3ed2074`: ALL PASS mit exakt den
  12224 B der Lane → adjudiziert `flake` (Run-State-Varianz der retained Fixture-Rows; die ~64 B
  Headroom sind eine BENANNTE Fragilität, Commit-Body). Deploy `5bc2cc68` `hitTarget:true`,
  `bundleStale:false`. **Live BEIDE Modi auf dem deployten Server, dasselbe reale Deploy-Fakt:**
  (1) Inbox-Modus an Slot 10 — Event `325866bd` mintete direkt zu `status:"inbox"`, saß 10 s Ticks
  bei `attempts:0`/`deliveredAt:null`, Pane-Hash byte-identisch über den ganzen Zyklus, Owner-Ack
  einmal echt + einmal `existing:true`; (2) Pane-Modus an Slot 1 (Legacy, `delivery` absent) —
  typisierte Nachricht kam in die Pane, Self-Ack normal. Rückkanäle der Session selbst durchgehend
  typisiert: merge-watch → audit-watch → deploy-watch, kein Hand-Polling.

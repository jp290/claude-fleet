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

**Empfohlener nächster Schnitt: restliche Provenienz (P2-B–D), sobald reale Produzenten
existieren** — P2-B wartet ausdrücklich darauf, dass ContextPlan-/SkillRef-/CapabilitySnapshot-
Quellen real werden (Owner-Einordnung 2026-08-13). Workstream 1, 2, 4, P2-A und 5 sind gebaut
(oben). Dahinter: Self-Land als Shadow-Klassifikation (unten).

**Ziel dahinter (gesetzt, nicht begonnen):** Self-Land als inspizierbare Eligibility-Entscheidung
(Shadow-Klassifikation zuerst; Tatsachenliste: Kickoff §7 / Doktrin §12) und der manuelle
Work-Trail-Learning-Loop (P4; Owner promotet).

**Pausiert (Owner-Stop 2026-08-12):** Task-Wellen, Cluster-Fan-out, Queue-/Dashboard-Ausbau
(`docs/plan-queue-refinement-2026-08-11.md` = geparkte Quelle) · vorzeitige Token-/Kosten-
optimierung (Rulebook-Split P1-C bleibt hinter G1) · Capability-Großmatrix, Event-Sourcing,
Maschinen-Sync (Anti-Ziele: Theo-Vergleich §8, Harness-Brief §14).

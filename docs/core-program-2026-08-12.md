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
2. **Typed Rückkanal** — Watch → durable Event (ID, persistiert, idempotent, Ack); kein
   Event-Sourcing-Umbau. Quelle: Harness-Brief §5.3.
3. **Provenienz P2** — `taskId`/`harness`/`effort`/Context auf Outcomes (heute 0 %, Baseline §3);
   nach den Readiness-Typen schneiden, damit `capabilitySnapshot` von Anfang an passt.
4. **MAIN-direct-Naht** — Direkt-Commits sind für alle Land-Ledger unsichtbar; Outcome-Eintrag +
   Preflight (Doktrin §4.3), damit Direktarbeit im Learning Loop nicht fehlt.
5. **Proportionale Verifikation** — kleinster Beweis am Arbeitsort, autoritativer Gate einmal pro
   Tree; eigener Schnitt, bis dahin gilt der AGENTS.md-Vertrag wörtlich.

**Empfohlener nächster Schnitt: Workstream 1, der Codex-Ready-Handshake.** Done: eine unattended
Zustellung an einen codex-Slot wird verweigert, solange die Pane auf Login/Trust steht, und
zugestellt, sobald der Composer real annimmt; Beweis: Fixture mit Fake-Login-Pane + Live-Canary;
danach `automatable:true` als Ein-Zeilen-Folge-Entscheid. Warum zuerst: es ist die letzte Lücke
zwischen „Full Access" und „unbeaufsichtigt nutzbar", und Rückkanal wie Provenienz messen erst
dann echte unbeaufsichtigte Läufe.

**Ziel dahinter (gesetzt, nicht begonnen):** Self-Land als inspizierbare Eligibility-Entscheidung
(Shadow-Klassifikation zuerst; Tatsachenliste: Kickoff §7 / Doktrin §12) und der manuelle
Work-Trail-Learning-Loop (P4; Owner promotet).

**Pausiert (Owner-Stop 2026-08-12):** Task-Wellen, Cluster-Fan-out, Queue-/Dashboard-Ausbau
(`docs/plan-queue-refinement-2026-08-11.md` = geparkte Quelle) · vorzeitige Token-/Kosten-
optimierung (Rulebook-Split P1-C bleibt hinter G1) · Capability-Großmatrix, Event-Sourcing,
Maschinen-Sync (Anti-Ziele: Theo-Vergleich §8, Harness-Brief §14).

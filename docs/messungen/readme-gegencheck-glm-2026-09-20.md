# README-Gegencheck — jede Behauptung am Code, 2026-09-20

Gegengelesen wurde der neu aus der Codebase geschriebene `README.md` (Lane
`fleet/260920065330-96a5`, Auftragszeile „README aus der Codebase"). Die Karte verlangte als
Gegenlese-Arm eine **GLM-Lane (`pi-zai`/`glm-5.3`, read-only auf den Branch)**.

**Dieser Arm ist NICHT gelaufen, und das ist eine Lücke, keine Erledigung.** Eine claude-Lane kann
keine zweite Lane gründen (`POST /api/self/*` bindet hart an den eigenen Slot), und der Dispatcher
startet eine `pi-zai`-Zeile nur mit `FLEET_HARNESS_AUTOMATION` plus automatabler Adapter-Erklärung.
Der Kartendefekt steht als Kommentar auf der Zeile (Orchestratorin, 2026-09-17). Was stattdessen
lief, ist eine **mechanische Selbst-Gegenlese**: jede Behauptung des README gegen eine Probe im
Baum, Probe notiert. Das ersetzt den unabhängigen Modell-Arm nicht — es macht nur sichtbar, welche
Sätze am Code stehen und welche nicht.

Baum: `fleet/260920065330-96a5`, Basis `6fa127a1`. Alle Proben aus dem Lane-Worktree.

## 1. Bestätigt (Behauptung → Probe)

| README-Behauptung | Probe | Befund |
|---|---|---|
| 16 feste Slots | `grep -n "MAX_SLOTS =" server/types.ts` | `const MAX_SLOTS = 16;` |
| Default-Bind `127.0.0.1:8790` | `server/http.ts` | `HOST = process.env.FLEET_HOST ?? "127.0.0.1"`, `PORT = … ?? 8790` |
| Pane-Ausgabe per `pipe-pane`, WS je Slot | `grep -c "pipe-pane" server.ts` = 3; `src/client.ts` baut `/ws/${this.slot}?cols=…` | bestätigt |
| `sleepSlot`/`wakeSlot` beenden die Belegung nicht | `server.ts#sleepSlot`, `#wakeSlot` | bestätigt |
| `openSlot`-Parameter | `server.ts:5759` Signatur | cwd, worktree, model, label, harness, effort, box, lease, browser, context |
| Lane = Worktree auf eigenem Branch | `server.ts#createWorktree`, `#removeWorktreeSafe` | bestätigt |
| Lane-Sensoren drift/gate | `server.ts#laneDrift`, `#gateView` | bestätigt |
| Vier Task-Kinds, nur `auftrag` ausführbar | `server/types.ts:1154` `TASK_KINDS`, Feldkommentar `kind:` | „auftrag is the one executable category … every dispatch path skips them" |
| Zeile entsteht `pending`, Owner-Akt macht `queued` | `server/types.ts:1150` ff., `server.ts#releaseTask` | „a task only leaves `pending` when the OWNER promotes it" |
| Program-Status-Vierklang | `server/types.ts:1709` `PROGRAM_STATUSES` | `proposed · confirmed · active · complete` |
| MAIN-Bindung entscheidet über die MAIN-Türen | `server.ts#boundProgramForMain`, `#programExecutionView` | bestätigt |
| Land = Server-Job: Rebase → Suite-Mutex → Verify → Fast-Forward | `server.ts#mergeJob` (26570), `#advanceIntegration`, `#recordLand` | bestätigt |
| `waitedOut`/timeout/skip ist KEIN Verdikt und landet nicht automatisch | `server.ts:26525`–26566 | drei benannte Arme, alle `landed: false` |
| Tier 2 ist opt-in | `server.ts:19464` | „DEFAULT OFF — `FLEET_POSTLAND_AUDIT_CMD` unset means tier 2 does not exist" |
| Audit-Rot wird adjudiziert, Verdikt erreicht Programme | `server.ts#writeAuditAdjudication`, `#addressedProgramsFor`, `#writeAuditInboxEntries` | bestätigt |
| Brief-/Card-Kompilierung | `server.ts#compileBriefs`, `card-extract.ts` | bestätigt |
| Dispatcher auf Timer, Lane-Deckel | `FLEET_DISPATCH_TICK_MS ?? 8000`, `FLEET_DISPATCH_MAX_LANES ?? 3` | bestätigt |
| Gründungsbrief trägt Kontext-Anker | `server.ts#briefAndSend`, `#renderContextAnchorBlock`, `context-plan.ts`, `context-packs.ts` | bestätigt |
| Vier Report-Status | `src/protocol.ts:39` | `["complete","needs-main","failed","handoff"]` |
| Deploy: Route → Build+Restart → Verdikt beim nächsten Boot | `server.ts:33351`/`35393` `POST /api/deploy`, `#deployVerb`, `#judgeDeploy`, `GET /api/deploys` | bestätigt; der Kommentar an `deployVerb` sagt „the restart kills this process" |
| Ledger-Dateinamen | `server.ts:194/198/206/223`, `server/audit-log.ts:8`, `server.ts:3495` | `lane-outcomes.jsonl`, `fleet-reports.jsonl`, `context-receipts.jsonl`, `post-land-audits.jsonl`, `audit.jsonl`, `streams/prompts.jsonl` |
| Sieben Harness-Adapter | `server.ts:1435` `HARNESSES` | claude, pi, pi-zai, pi-ox, pi-unfenced, container, codex |
| Adapter-Felder (spawnCmd, worker, context, pinsSession, comms, readiness) | `server.ts:380` `interface Harness` | bestätigt |
| Unbeaufsichtigter Start nur automatabel + `FLEET_HARNESS_AUTOMATION` | `server.ts:1433`, `:12368` | bestätigt |
| Owner-Token auf jeder Route | `server.ts#tokenGate` | bestätigt |
| Self-Token je Slot, nur eigener Slot | `Slot.selfToken` (`server.ts:1913`), Lane-Türen antworten 409 | bestätigt (`rg -n "not a lane" server.ts`) |
| Self-Credentials stehen in der Prozessliste | `ensureSlot` exportiert sie in die Pane (`server.ts:800`, `:1195`) | bestätigt — Hygiene-Fakt, keine Isolation |
| Share = Fenster, eigene Hostnamen | `SHARE_HOSTS` (`server.ts:3450`), `server.ts:33641` 404 für alles andere | bestätigt |
| Cross-Site-Wächter | `server/auth.ts:105` `export function guard` | Host- und Origin-Prüfung |
| Zwei Sicherheits-Suiten | `e2e/security.ts` (Routen oberhalb `tokenGate`, Source-Pin) vs. `fleet-e2e-security.ts`/`./e2e-security.sh` (Lockout, Injection, Self-Token-Scope, pending-never-dispatch) | bestätigt aus beiden Dateiköpfen |
| Ein Suite-Lock maschinenweit | `server.ts#holdSuiteLock`, `#suiteLockTryTake` | bestätigt |
| Land bewegt ggf. einen bewohnten Baum | `docs/land-mechanics.md` §2 | bestätigt |
| xterm auf 5.5.0 gepinnt | `package.json:19` | `"@xterm/xterm": "5.5.0"` |
| Client-Ansichten | `src/client.ts#renderQueue`, `#renderQueueDetail`, `#renderBoard`, `#renderOpsDlg` | bestätigt |
| `public/` trägt share/helper/landing | `ls public/` | `share.html`, `helper.html`, `landing.html`, `hub.html`, `index.html` |

## 2. Widerlegt und deshalb gestrichen

1. **„`openSlot` … label, harness, model und mission"** — `mission` ist kein `openSlot`-Parameter
   (Signatur `server.ts:5759`). Satz auf die tatsächliche Parameterliste umgeschrieben.
2. **„Self-heal … resuming the pinned conversation rather than starting a new one"** — gilt nur für
   Adapter mit `supports.resume` (`server.ts:660` ff.); um „where the adapter supports it" ergänzt.
3. **„`e2e/security.ts` … runs only in `./e2e-isolated.sh`"** als ganze Sicherheitsaussage — die
   Perimeter-Prüfung ist auf ZWEI Harnesses verteilt, und die zweite (`./e2e-security.sh`) fährt der
   Land-Gate. Satz ersetzt.

## 3. Was diese Gegenlese NICHT geprüft hat

- Kein unabhängiger Modell-Arm (GLM) — siehe Kopf. Die Sätze sind gegen den Code geprüft, aber von
  derselben Instanz, die sie geschrieben hat; eine Fehldeutung, die beim Schreiben passierte, kann
  beim Prüfen wiederholt worden sein.
- Kein Lauf der Suiten gegen den README-Text (es gibt keinen Pin auf `README.md`; der `docs/README.md`-
  Zeigerpin in `e2e/pins.ts` §5a betrifft den Doc-Index, nicht diese Datei).
- Der UI-Absatz ist an Symbolen verankert, aber nicht gegen einen gerenderten Frame geprüft.

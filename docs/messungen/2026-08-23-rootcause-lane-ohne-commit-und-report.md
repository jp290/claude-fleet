---
frage: Warum hat die dispatchte C1-Critic-Lane (Task d527fb9f) weder committet noch berichtet?
urteil: Wurzel ist ein fehlender Completion-Kontrakt auf der Dispatch-Schicht (briefAndSend liefert Task-Text plus Ankerblock, keinen Commit-/Report-/Idle-Auftrag); Harness- und Modellverhalten vom Transkript widerlegt
bereich: [lane-lifecycle, harness]
belege: [server.ts#briefAndSend, server.ts#openFleetReport, docs/self-api.md, 45a402d]
nicht-gemessen: Die ~34 Minuten MAIN-Verzögerung zwischen lane-ready und Land (Slot-7-Transkript) lagen außerhalb des Scopes
stand: 2026-08-23
---

# Root-Cause: warum eine dispatchte Lane weder committete noch berichtete (2026-08-23)

**Geerntet, nicht nacherzaehlt.** Die Lane hat ausdruecklich nichts geaendert und nichts committet
(`No files edited, nothing committed`) — ihr Ergebnis existierte nur als typisierte
Result-Rail-Zeile und waere mit dem Slot gestorben. Der Text unten ist der Bericht WOERTLICH.

| | |
|---|---|
| Report-Id | `502511f8c93ce47949aae42d` |
| Gemeldet | 1787485501118 (`status: complete`) |
| Worker | Slot 12, `fleet/260823092612-470f` (Ox-Ersatz fuer die rate-limitierte GLM-Attempt `543e626d`) |
| Provenienz | Task `e8c245d2` · Program `eeba7c04caae64d79969199b` |
| Untersuchter Fall | Task `d527fb9f` (C1-Critic, codex, Tower-Worktree `fleet-260823074543-4c72`) |

## Der Bericht, woertlich

[Ox replacement for rate-limited GLM attempt 543e626d] Read-only root-cause diagnosis of task d527fb9f (C1 critic, codex, slot 3, tower worktree fleet-260823074543-4c72). No files edited, nothing committed.
ROOT CAUSE (evidenced): compound completion-contract omission at the generated-dispatch layer. Delivered brief = task text + anchor block only (briefAndSend); context receipt shows selected=[] with all six Fleet seed packs omitted source-unavailable (foreign-tree rule) and no .fleet/context-packs.json in tower@b5ed243; git show b5ed243:AGENTS.md has zero commit/report language; docs/self-api.md does not document POST /api/self/fleet-report and the UI client does not expose it. Harness/model behavior and one-off noncompliance REFUTED by transcript: turn 1 ended with final verdict per its received contract; worker then complied instantly with both owner prompts.
TIMELINE FACTS: 09:45:30 dispatch; 09:49:45 verdict.md written untracked, idle-dirty ~20min, watch 338ff3e1 (lane-ready = idle+clean+ahead>0) could not fire; 10:09:32 owner prompt #1 (source=owner) ordered commit/report; commit 45a402d touched only verdict.md (+109); ~7min route discovery ("report route not exposed by UI client"); 10:17:39 report 519529ac POSTed; 10:20:24 lane-ready fired, MAIN unparked; 10:31:51 owner prompt #2 misread residual task status sent as worker non-completion (openFleetReport never moves task status; only land does, server.ts:4392) -> duplicate report fd3ed220 to the wrong actor; land 10:54:47.
CONTRIBUTING: brief prohibited reading anything under /Users/owner/claude-fleet/ where the docs live; Supervisor structurally blind (supervisorView has no live git/idle facts; stalled/stalled-dirty computed but "nothing acts on it").
SMALLEST FIXES PROPOSED (not implemented): (1) systemic generated-contract fix - deterministic lifecycle footer appended in briefAndSend to every mutating lane brief naming commit + POST /api/self/fleet-report + idle, pinned by e2e/pins.ts rule; brief-only fix insufficient; (2) add fleet-report section to docs/self-api.md; (3) Supervisor rule reusing existing stalled predicates surfaced into supervisorView + one facts-only nudge on stalled-dirty + sent task + no report; no auto-commit, idle+dirty never treated as completion.
REGRESSION PROBES: footer-presence probe (fails under its own name), pins rule doc<->route pair, supervisorView stalled-row probe (unknown git -> row absent, never false).
OPEN BOUNDARY: MAIN's ~34min delay between consuming report+lane-ready (10:20 ack) and land (10:54) lives in slot 7's transcript, outside this task's scope.

## Warum das dieses Program angeht (und nicht nur Tower)

1. **Der Befund trifft die generierte Dispatch-Schicht, nicht einen Agenten.** `briefAndSend`
   liefert Task-Text plus Ankerblock — und keinen Lifecycle-Kontrakt. Harness-/Modellverhalten und
   Einzelfall-Ungehorsam sind vom Transkript ausdruecklich WIDERLEGT, nicht offen. Jede kuenftige
   dispatchte Lane erbt dieselbe Luecke.
2. **Er trifft den Rueckweg, auf den dieses Program baut.** Der `lane-ready`-Watch feuert auf
   `idle + clean + ahead>0`. Die Lane schrieb `verdict.md` UNTRACKED und lag ~20 min idle-DIRTY —
   der Watch `338ff3e1` KONNTE nicht feuern. Das ist keine Fehlfunktion, sondern die Grenze des
   Praedikats: **idle+dirty ist der blinde Fleck des Rueckkanals**, und er sieht von innen aus wie
   „die Lane arbeitet noch".
3. **`docs/self-api.md` fehlt auch §fleet-report** — dieselbe Klasse wie der seit ACP-23 getragene
   fehlende §tasks. Der Bericht nennt zusaetzlich, dass der UI-Client die Route nicht anbietet, die
   Lane also ~7 min mit Routen-Suche verbrachte.
4. **`openFleetReport` bewegt den Task-Status NICHT — nur ein Land tut das** (`server.ts:4392`
   laut Bericht, vor Verwendung am Baum pruefen). Genau diese Verwechslung hat hier zu einem
   Doppelbericht an den falschen Akteur gefuehrt.

## Was hier NICHT entschieden wird

Die drei vorgeschlagenen Fixes (deterministischer Lifecycle-Footer in `briefAndSend` mit Pin ·
§fleet-report in `docs/self-api.md` · Supervisor-Regel auf den bestehenden `stalled`-Praedikaten)
sind **Vorschlaege der Lane, nicht promotet**. Sie ueberlappen sichtbar mit den aktiven
Fable+GLM+GLM-Audits; nach Owner-Anweisung 2026-08-23 wird die alte Kette geparkt und nichts
gefilt (siehe `docs/acp-selfland-chain-parked-2026-08-23.md`).

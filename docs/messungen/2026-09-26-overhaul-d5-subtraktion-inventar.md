---
frage: Welche D5-Mechanik um Session, Recht und Konfiguration kann nach D1/D2 entfernt oder neu gebunden werden, und was davon hat heute einen Halter?
urteil: D5 hat drei inventarisierte, nicht entschiedene Posten; 11 Steward-Routen ohne Halter, drei Supervisor-Türen hinter stale Bindung und zwei Grants mit 0/18 Haltern plus deaktiviertem Intake.
bereich: [overhaul, d5, berechtigung]
belege: [server.ts#handleStewardRoute, server.ts#isBoundSupervisor, server.ts#effectiveGrant, server.ts#effectiveDelegate, server.ts#handleIntake, e2e/security.ts#STEWARD_ROUTES]
nicht-gemessen: Keine Credential- oder Zustandsdatei gelesen; Slotaggregate stammen von MAINs Owner-Projektion. Keine Entscheidung über D4, Steward oder Supervisor, keine D5-Codeänderung.
stand: 2026-09-26
---

# Welche D5-Mechanik hat heute einen Halter und wo sitzt sie?

26.09.2026, Lane `fleet/260926125232-1a76`. Frage: **Welche D5-Mechanik hat heute einen Halter und wo sitzt sie?** Stand: `main`-Ausgang `a0d9e2248b34`; Grundlage `docs/messungen/2026-09-25-overhaul-s2-rechte-synthese.md` §A.3, §C1, §C5, §D5 und §D6, aus `main` gelesen. Die heutige Messung trennt Code, rotierende Logs und MAINs Owner-Projektion. Sie legt **keinen** Rückbau fest. Kostenangaben unten sind die zu prüfende Wartungs- oder Betriebsfläche, keine bereits erzielte Einsparung.

## Ergebnis

## Vorher → heute, mit Messgrenze

| Aussage vom 25.09. | Nachmessung 26.09. | Basis und Abweichung |
|---|---|---|
| Steward: 11 Türen; 0 `steward_*` im aktuellen Audit-Log; letzte Zeile 13.09.; 0/267 Deploys | **11** Routen; **0** im aktuellen `audit.jsonl`, **4** in `.1`, **208** im `.archive`; letzte Steward-Zeile 13.09. **13:41:22 UTC**; **0/270** Deploys `by:"steward"` (268 `owner`, 2 `unattributed`) | Routen aus `server.ts#handleStewardRoute` gegen `e2e/security.ts#STEWARD_ROUTES`; Logs nur nach Ereignistyp/Zeit bzw. `by` aggregiert. Deploy-Nenner **+3**, Ergebnis 0 unverändert. |
| Kein Steward-Slot, Supervisor-Bindung seit 09.09. stale, Grants je 0/20 | **0/18** aktive Slots mit Label `⚙ steward`; Supervisor weiter **stale** (gebunden Slot 2/`openedAt 1788958257705`, aktuell Slot 2/`1790184006767`); `memoryGrant` **0/18**, `reportDelegate` **0/18** in Kraft | MAIN-Messung über Owner-Projektion `GET /api/sessions` und `GET /api/programs`, 26.09.; aktiver Nenner **−2**, Status unverändert. Diese Lane hat keine Zustandsdatei gelesen. `supervisorHealth()` in `server.ts#supervisorHealth` vergleicht Slot und Occupant. |
| Intake-Secret unset → `/intake` 404 | `enabled=false` laut MAINs Konfigurationsprüfung; ein `POST /intake` ohne Credential antwortete **404** | `server.ts#handleIntake` und `server.ts#fetch`. Ein `POST /api/intake` antwortet **401**, trifft aber **nicht** die registrierte Intake-Route; er ist kein Gegenbeleg zur 404-Aussage. |

## 1 · Steward-Prinzipal: eine Credential, elf Türen, weitere Auswüchse

**Zugangsweg.** `server.ts#STEWARD_LABEL` definiert das magische Label; `server.ts#ensureSlot` exportiert nur für dessen Occupant das Steward-Token in die Pane. `server.ts#saveState` persistiert die Credential, der Startpfad lädt oder erzeugt sie; `server.ts#fetch` prüft sie vor dem Owner-Gate und verweigert unbekannte Pfade mit 403. `server.ts#stewardSlot` findet den Halter, `server.ts#"/api/steward/token"` ist die Owner-Lesetür. `server.ts#handleStewardRoute` implementiert die elf Türen; `e2e/security.ts#STEWARD_ROUTES` pinnt exakt diesen Satz. Der heutige Halter ist 0/18. **Kosten:** Eine zusätzliche Credential- und Label-Lebensdauer mit eigener Auth-Kante trotz leerer Rolle.

| Methode und Pfad | Handler / direkte Abhängigkeit |
|---|---|
| GET `/api/steward/sessions` | `server.ts#handleStewardRoute`, `server.ts#stewardSlotsView` |
| GET `/api/deploys`; POST `/api/deploy` | `server.ts#handleStewardRoute`, `server.ts#deploysRoute`, `server.ts#deployVerb` |
| GET `/api/steward/digest` | `server.ts#handleStewardRoute`, `server.ts#runStewardDigest`, `server.ts#readStewardJournal` |
| GET `/api/steward/slots/:id/brief`; GET `/api/steward/slots/:id/transcript` | `server.ts#handleStewardRoute`, `server.ts#briefPayload`, `server.ts#transcriptPayload` |
| GET `/api/dispositions` | `server.ts#handleStewardRoute`, `server.ts#readDispositions` |
| POST `/api/steward/autos`; POST `/api/steward/tasks` | `server.ts#handleStewardRoute`, `server.ts#createAutoForSlot` |
| POST `/api/steward/send` | `server.ts#handleStewardRoute`, `server.ts#handleStewardSend` |
| GET/POST `/api/steward/journal` | `server.ts#handleStewardRoute`, `server.ts#readStewardJournal`, `server.ts#writeStewardJournal` |

**Mitlaufende Flächen:** `server.ts#STEWARD_LABEL`, `server.ts#stewardSlot`, `server.ts#ensureSlot`, `server.ts#handleStewardSend`, `server.ts#runStewardDigest`, `server.ts#stewardSlotsView`, `server.ts#handleStewardRoute`, `server.ts#fetch`; `server/types.ts#Task` (`source:"steward"`), `server/audit-log.ts#AuditEvent` (Steward-Ereignisse); `src/client.ts#GfRole` und `src/client.ts#taskSourceLabel` (Rollen- und Quellenanzeige); `continuity.ts#ContinuitySource`; `suite-modules.ts#FixtureOrigin`; `e2e/security.ts#STEWARD_ROUTES`, `e2e/steward-core.ts#run`, `e2e/steward-outcomes.ts#run`, `e2e/tasks.ts#run`, `e2e/watch.ts#run`, `e2e/programs.ts#run`, `e2e/pins.ts#pin`, `e2e/ctx.ts#SHARD_UNITS`; `docs/steward.md#The three conventions` und `.claude/commands/steward.md`. Bei einem Rückbau müssten die Label-Sonderfälle für Lane/MAIN, Anzeige, Auditvokabular und Prüfungen einzeln zugeordnet werden. **Kosten:** Elf geroutete Rechte plus eigene Digest-/Journal-/Send- und UI-Verträge; die drei Owner-Duplikate `/api/deploy`, `/api/deploys`, `/api/dispositions` brauchen vor Entfernung einen benannten Ersatz.

## 2 · Supervisor-Bindung: stale, aber drei echte Self-Türen

`server/types.ts#SupervisorBinding` ist der gespeicherte Occupant-Schlüssel. `server.ts#bootstrapSupervisor`, `server.ts#bindSupervisor` und `server.ts#succeedSupervisor` können die Bindung schreiben oder weitertragen; `server.ts#saveState` und der Startpfad erhalten sie. `server.ts#isBoundSupervisor` prüft `slot+openedAt`; `server.ts#supervisorHealth` meldet hier `stale`; `server.ts#supervisorRefusal` übersetzt das in 409. Die drei Türen sind `GET /api/self/supervisor-view` (`server.ts#supervisorView`), `POST /api/self/nudge` (`server.ts#supervisorNudge`) und `POST /api/self/supervisor-watch/:id/complete` (`server.ts#completeTransitionWatch`), alle an `server.ts#fetch` mit derselben Ablehnung. `e2e/pins.ts#pin` verlangt genau drei Refusal-Stellen; `e2e/supervisor.ts#run`, `e2e/self-token.ts#run`, `e2e/programs.ts#run` und `docs/supervisor-succession.md#1.4` dokumentieren/proben die Rolle. Weitere Verbraucher sind `server.ts#memoryPortfolioScope` (Supervisor-Projektblick), `server.ts#messageAddressesFor` (`role:supervisor`) und `server.ts#handleOwnerProgramRoute` (Health-Projektion). **Kosten:** Ein stale Singleton stellt drei legitime Betriebs-Sinne auf 409 und trägt zusätzlich Nachfolge-, Adress- und Memory-Semantik. Ob neu binden, mit einer anderen Session zusammenlegen oder streichen, ist eine Owner-Entscheidung; `docs/messungen/2026-09-15-rollen-controller-supervisor-abloese.md` benennt den möglichen Verlust des Querblicks.

## 3 · Grants ohne Halter und der tote Intake-Eingang

**`memoryGrant` 0/18 in Kraft.** `server/types.ts#MemoryGrant` und `server/types.ts#Slot` definieren den Datensatz; `server.ts#effectiveGrant` ist die Occupant-Prüfung, `server.ts#memoryPortfolioScope` der Leser von `GET /api/self/memory?view=portfolio`. `server.ts#patchMemoryGrant` und `server.ts#memoryGrantView` bedienen `GET/PATCH /api/slots/:id/memory-grant` im Owner-Teil von `server.ts#fetch`; `server.ts#memoryGrantCarry` und `server.ts#transferMemoryGrant` regeln generische Nachfolge. `server.ts#saveState`, Start-Lader und Slot-Reset persistieren beziehungsweise verwerfen den Datensatz. Prüf-/Vertragssurfaces: `e2e/self-token.ts#run`, `e2e/programs.ts#run`, `docs/self-api.md#memory`. **Kosten:** Ein zusätzlicher Owner-Grant mit Revision, Persistenz, Nachfolge und Scope-Fehlern, derzeit ohne nutzenden Occupant.

**`reportDelegate` 0/18 in Kraft.** `server/types.ts#ReportDelegate` und `server/types.ts#Slot` definieren den Datensatz; `server.ts#effectiveDelegate`, `server.ts#reportDelegateHolder`, `server.ts#patchReportDelegate` und `server.ts#reportDelegateView` setzen/lesen `GET/PATCH /api/slots/:id/report-delegate`. `server.ts#transferReportDelegate` trägt ihn auf der generischen Nachfolge, `server.ts#saveState`/Start-Lader/Slot-Reset halten die Lebensdauer; `server.ts#delegateDecideFleetReport` und `server.ts#fetch` bieten die delegierte Self-Report-Beurteilung. `e2e/programs.ts#run` und `docs/self-api.md#Der Report-DELEGIERTE` sind die Prüf-/Vertragsflächen. **Kosten:** Zweite Revision-/Occupant-Maschine samt exklusivem Halter und eigenem Urteilspfad, derzeit ohne Halter; die Owner-Richtung „Reports selbst beurteilen, Ausnahmen an mich“ bleibt als Bedarf von D4 getrennt zu bewerten.

**Intake ist ein vierter, benachbarter Konfigurationsrest, keine vierte Grant-Art.** `server.ts#INTAKE_SECRET` liest `FLEET_INTAKE_SECRET`; `server.ts#fetch` routet `POST /intake` vor Share-/Owner-Gates; `server.ts#handleIntake` antwortet bei leerer Konfiguration 404 und könnte sonst nur eine `pending` Task erzeugen. `server/types.ts#Task` erlaubt `source:"intake"`; `e2e/intake.ts#run`, `e2e/security.ts#PRE_AUTH_ROUTES` und `e2e/restart.ts#run` tragen den Vertrag. **Kosten:** Öffentlicher Eingangs-, Secret-, Rate-Limit- und Testpfad ohne Konfiguration; Plan §2 will einen externen Eingang, daher ist „tot“ keine Streichfreigabe.

## Schnittlinie und offene Entscheidung

Die Nachmessung gilt dem heutigen `main`-Code. `git show overhaul:server/auth.ts` zeigt `server/auth.ts#resolvePrincipal` mit `owner`, `session`, `device`, `guest`, `machine`, **ohne** Steward- oder Supervisor-Prinzipal; auf diesem `main` gibt es die Funktion noch nicht. Das ändert die Rückbaureihenfolge: Erst D1/D2 auf `main` prüfen, dann die elf Steward-Routen und die Supervisor-/Grant-Flächen gegen die tatsächlich aufgelösten Rollen und Audit-Aktoren zuordnen. D4 und das Steward-Aus entscheidet der Owner. Dieses Inventar trifft weder diese Wahl noch ändert es Code.

## Methode

Ausgeführt: `git show main:docs/messungen/2026-09-25-overhaul-s2-rechte-synthese.md`, `rg -n 'handleStewardRoute|STEWARD_LABEL|isBoundSupervisor|supervisorRefusal|effectiveGrant|report-delegate|FLEET_INTAKE_SECRET' server.ts server/*.ts e2e/ docs/`, `git show overhaul:server/auth.ts`, `curl -X POST /intake` ohne Credential mit leerem JSON (HTTP 404). Die rotierenden `audit.jsonl*` wurden per Python zeilenweise als JSON gelesen und nach `event.startswith('steward_')` gezählt; für jede Rotation wurde nur Anzahl und größter `ts` ausgegeben. `deploys.jsonl` wurde nach `by` gruppiert. Die Slotzahlen und `enabled` lieferte MAIN am 26.09. als reine Aggregate aus `GET /api/sessions`/`GET /api/programs` und ihrer Konfigurationsprüfung. Kein Secret und keine Zustandsdatei wurde von dieser Lane gelesen.

## Was nicht gemessen wurde

Kein Secretwert, keine individuelle Slot-Konfiguration, keine historische Nutzung außerhalb der drei Audit-Rotationen und des einen Deploy-Logs. Die fachliche Ersatzfähigkeit der elf Steward-Routen und der drei Supervisor-Türen nach D1/D2 ist nicht live geprobt. Keine Entscheidung über D4 oder Streichung; der 404-Probeaufruf misst nur den heutigen Intake-Zustand.

## Entscheidungs-Trail

ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-26T13:20:04Z	verifikation	auf das Ende von `claude-gate` warten	ohne Terminal-Tail kein Pass	`/tmp/d5-claude-gate.log`	offen
2026-09-26T13:33:04Z	verifikation	Terminal-Tail als Beweis nehmen	der gestartete Lauf endete mit `ALL PASS`	`/tmp/d5-claude-gate.log`	bestanden

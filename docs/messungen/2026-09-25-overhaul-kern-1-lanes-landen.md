# Kernprozess 1: Lane-Lebenszyklus und Landen, Befund vom 2026-09-25

Stand: Haupt-Checkout `07e998e9`, `server.ts` 43 085 Zeilen. Gelesen habe ich nur die unten zitierten Symbole und Zeilenbereiche, nicht die ganze Datei.
Soll diese Abstraktion existieren? Ja. Ein serialisierter, verifizierter Land-Pfad ist der Engpass, der viele parallele Agenten auf einem `main` zusammenhält. Die Befunde betreffen den Zuschnitt, nicht die Existenz.

## Prozesskarte

1. **Freigabe:** Eine Queue-Zeile wird `queued`, entweder durch den Owner oder durch eine MAIN über `POST /api/self/tasks/:id/release`. `server.ts#tickDispatch` (17203) wählt sie aus, `server.ts#dispatchTask` (14962) legt Worktree und Branch an (`createWorktree`, 6383) und öffnet den Slot.
2. **Zustellung:** `server.ts#briefAndSend` (15205) prüft die Pane mit `canDeliver` (Gate `blocked-screen`) und `waitForFoundingReadiness`. Dann baut es den Kontextplan und pastet den Brief. Der Brief endet mit `laneExitFooter`: Commit, dann ein fleet-report, dann idle. Scheitert die Zustellung, wird die Lane abgebaut und die Zeile wieder eingereiht. Seit `036df834` (09-24) parkt sie nach 3 gleichen Screens.
3. **Arbeit und lokale Verifikation:** Die Lane fragt `GET /api/self/gate` (39054) nach Gate-Kommando, Budgets, Mutex-Stand und Helfer. `localProof` kommt aus `verify-proportion.ts#verificationProportionFor`. Optional bietet sie ihre Suite per `suite-offer` an.
4. **Ende der Lane:** Commit, dann `POST /api/self/fleet-report` mit dem Status complete, needs-main, failed oder handoff. Ist der Kontext voll, übergibt `server.ts#succeedLane` (10243) an eine frische Session auf demselben Worktree. Das braucht einen `handoff`-Report und ist durch `FLEET_LANE_SUCCEED_MAX` gedeckelt.
5. **Wer landet:**
   - **(a) Die MAIN** über die Self-Land-Tür (`self_land_start`, 13907/13929). Die Tür hat Guards: Program-Politik `guarded` oder `green-only`, keine Wiederholung ohne Fortschritt, done-looking, kein abgelehnter Report.
   - **(b) Eine Session mit dem Owner-Token (bearer)** über `POST /api/slots/:id/merge` (41049).
   - **(c) Der Owner am Board (cookie).** Kommt praktisch nicht vor, siehe Zahlen.
6. **Land:** `server.ts#mergeJob` (30260) läuft in dieser Reihenfolge:
   - Er schreibt einen Intent-Marker.
   - Er nimmt den Suite-Mutex **vor** dem Rebase (Block ab 30399).
   - `tryScriptRebase`. Bei einem Konflikt geht der Fall an die Autor-Lane (`wakeAuthor`, Verdikt `awaiting-author`) oder an einen Resolver (`runMerge`).
   - `dirtyMainStop` (6977), dann `runVerify` als Gate-Kette aus `watchdog.sh#VERIFY_CMD`.
   - Nur wenn ein Konflikt vorlag und das Gate danach rot ist: Repair-Runden (30712).
   - Hub-Arbitrierung und ff-Retry-Schleife (`LAND_FF_RETRY_ROUNDS`, 30809 ff.), dann `landLane`.
   - `record()` schreibt `merge_verdict` in `audit.jsonl` und eine Land-Note `git notes --ref=fleet/land`. `buildLaneOutcome` schreibt nach `lane-outcomes.jsonl`.
7. **Konflikt oder rotes Gate:** Beides endet als Verdikt `resolved`. Danach bestätigt entweder die MAIN (`confirmResolvedCandidate`, `byHuman:false`, Verify läuft frisch) oder der Owner-Arm (`byHuman:true`, Verify wird nur als stale markiert).
8. **Stufe 2:** `drainPostLandAudits` (24256) fährt `./e2e-isolated.sh` gegen den neuen Tip, meist in 3 Shards auf dem Second-host. Das Ergebnis landet in `post-land-audits.jsonl`. Ein rotes Audit wird von Hand adjudiziert (`audit-adjudications.jsonl`).
9. **Rücknahme:** `undo-land` ist ein Stack mit höchstens 3 Einträgen (`UNDO_STACK_MAX`, 22344; `pushUndo`/`killUndoStack`).
10. **Aufräumen:** `tickLaneAutoClose` (19544) schließt nur Lanes, die `killed-empty` sind und deren Reports alle von der MAIN entschieden wurden. Die Ablehnungsgründe liegen auf `/api/sessions` als `autoCloseRefusal`. Alles andere schließt von Hand der Owner oder die MAIN.

## BLEIBT (wirkt nachweislich)

1. **Mutex vor dem Rebase** (`mergeJob`, Block ab 30399, owner brief 09-12).
   - Beleg: `ffRounds` steht in 8 von 914 Land-Noten. In 535 `merge_verdict` seit 09-07 gab es 2 ff-Retries und 3 × `ff-lost`.
   - Das Warten ist billig: `waitMs` p50 0 s, p90 285 s.
   - Das früher teure „main zieht unter dem Gate weg“ ist damit praktisch erledigt.
2. **Self-Land-Tür der MAIN.**
   - 444 von 630 Lands seit 09-01 (70 %) gingen über sie, im 5-Tage-Fenster alle 130 mit `sessionIdMatch=exact`.
   - Vom `complete`-Report bis zum Start des Lands vergehen p50 3,4 min, p75 11 min, p90 50 min (n = 378, 09-07 bis 09-25).
   - Das ist der Pfad, der ohne Owner läuft, und er ist schnell.
3. **Konflikte gehen an den Autor statt an einen Wegwerf-Resolver** (`wakeAuthor`).
   - 6 `awaiting-author` seit 09-07, alle 6 später gelandet (`resolvedConflict:true` in `lane-outcomes`).
4. **Der Brief sagt der Lane, wie sie endet** (`server.ts#laneExitFooter`): Commit, dann Report, dann idle, ohne Pollen. Dazu `/api/self/gate` mit echtem Env, Budgets und `localProof`. Einer Lane fehlt damit keine Information für ihren eigenen Abschluss.
5. **Watch-Rückkanal statt Polling.**
   - 530 `watch_fire kind=merge` und 483 `kind=audit` im Audit-Log.
   - Die MAIN abonniert den Ausgang, statt HEAD zu beobachten.
6. **Die Schleifen-Guards greifen.**
   - Lane-Succession: am 09-15 gab es 97 `lane_succession` (die „89-succession loop“ aus `succeedLane`). Seit dem Cap und dem `complete`-Check waren es 28 in 10 Tagen.
   - Dispatch-Park nach 3 (`036df834`) schließt die Screen-Schleife vom 09-24.
7. **Autoclose ist konservativ und nie falsch gelaufen.**
   - Es schließt nur `killed-empty` (`tickLaneAutoClose`, 19566 ff.): 9 Schließungen insgesamt, keine mit Commits.
   - Seit `7cacbd0b` sind die Ablehnungsgründe als Poll-Feld lesbar.
   - Die Abdeckung ist klein: 9 von 31 `killed-empty` seit 09-05. Das ist beabsichtigt und kein Defekt.
8. **Der Gate-Pfad ist schnell genug.** Gate-Arbeit für claude-fleet p50 226 s, p90 306 s (n = 31 mit `repo`-Feld). `waitedOut` kam seit 09-07 nie vor.

## ÄNDERN (nach Wirkung gerankt)

### 1. Agenten landen über das Owner-Token, und die Ledger halten sie für den Menschen
- **Belege:**
  - Von 186 „owner“-Lands seit 09-01 kamen 183 über `via=bearer` und nur 3 über `cookie`. Der Mensch am Board landet also praktisch nie; wer das Owner-Token hält, ist eine Session.
  - 110 dieser Bearer-Lands tragen `suspect=owner-token-outside-board`, laufen also an einer lebenden MAIN vorbei. Pro Woche: KW36 24, KW37 30, KW38 3, KW39 53.
  - Im 5-Tage-Fenster hatten 16 von 52 Bypass-Lands den Report-Stand `undecided`.
  - 11 von 12 `confirmedByHuman:true` seit 09-01 kamen über bearer. Der Owner-Arm von `confirmResolvedCandidate` (29653; `byHuman:true`, 29696/29770) startet keinen frischen Verify, sondern markiert den alten als stale.
  - `tokenChannel` (22480 ff.) kennt nur den Kanal, nicht die Session. Das Ledger kann deshalb nicht sagen, wer gelandet hat.
- **Kosten:**
  - Die Provenienz „confirmedByHuman“ ist faktisch falsch.
  - Ein Agent nimmt den schwächeren Confirm-Arm, also keinen frischen Verify über einer bewegten `main`.
  - Die Guards der Self-Land-Tür greifen nicht: Fortschrittssperre, done-looking und die Politik-Sprosse.
  - Die Frage „Wer landet?“ ist für 29 % der Lands nicht beantwortbar.
- **Richtung:**
  - Die Orchestratorin bekommt einen eigenen Prinzipal (`actor.kind:"orchestrator"`) mit der Semantik des MAIN-Arms.
  - `byHuman` gilt nur für cookie.
  - Ein Bearer-Land an einer lebenden MAIN vorbei wird 409, außer mit explizitem `force`.

### 2. Das Ledger kann die Wirkung des Land-Gates nicht messen
- **Belege:**
  - `record()` in `mergeJob` (30334 ff.) schreibt `status/landed/errorReason/ffRounds/waitedOut/timedOut/ms`, aber nicht `verify.ok`.
  - `cleanVerifyStop` gibt bei einem roten Gate auf sauberem Rebase `status:"resolved"` zurück, denselben Status wie „Konflikt gelöst“.
  - Gefolgert: Von 41 `resolved`/`awaiting-author`-Verdikten seit 09-07 hatten 22 keinen Konflikt. Davon waren 4 `waitedOut`/`timedOut`, also sind etwa 18 rote Gates auf 535 Verdikte (~3 %) zu vermuten. Belegen lässt sich das nicht.
- **Kosten:** Die Kernfrage des Umbaus, was das 226-s-Gate pro Land fängt, bleibt unbeantwortbar. Jede Entscheidung über den Gate-Zuschnitt ist dann geraten.
- **Richtung:** `verifyOk` und `stopKind` (`conflict|red|unmeasured|review`) in die `merge_verdict`-Zeile aufnehmen, am selben einen Schreibort.

### 3. Ungenutzte oder abgeschaltete Maschinerie, die trotzdem gewartet oder bezahlt wird
- **Belege:**
  - **Repair-Loop** (`MERGE_REPAIR_ROUNDS`, 30712): 0 von 914 Land-Noten und 0 von 1 328 Outcomes tragen `repairRounds>0`. Der Code kommentiert das selbst („Latent, never observed“, 22040).
  - **undo-land:** 0 `repo_undo_land`-Events von 07-21 bis 09-25 (93 328 Audit-Zeilen), keine `reverted`-Outcome-Zeile. Dem stehen 97 Undo-Treffer in `server.ts`, 45 in `src/client.ts` und 146 in `e2e/` gegenüber.
  - **auto-③-Reviewer:** live aus (`watchdog.sh` Zeile 195 setzt `FLEET_AUTO_REVIEW_MS=0` seit `be3b21e6`, 09-01). Entsprechend `review.state=none` in 687 von 690 Outcomes. `CLAUDE.md` §Deploy sagt trotzdem „AN per Default“.
  - **clean-review:** live `off`. Trotzdem läuft `./e2e-clean-review.sh` in jedem claude-fleet-Land-Gate (`watchdog.sh#VERIFY_CMD`). Laut Trail ~28 s Check-Zeit pro Lauf, ohne Boot.
- **Kosten:**
  - Wartungsgewicht und Pins für Pfade ohne Nutzen.
  - Gate-Zeit für ein ausgeschaltetes Feature.
  - Falsche Doc-Aussagen, auf die Agenten ihre Briefs bauen.
  - Dazu `CLAUDE.md` „~110 s Gate“ und „Audit ~9,4 min“, gemessen sind 226 s und 17 min.
- **Richtung:** Pro Mechanismus ausdrücklich zurückziehen oder behalten. Solange clean-review aus ist, gehört seine Suite ins Post-Land-Audit, nicht ins Land-Gate. Die Doc-Zahlen aus dem Ledger ableiten statt sie aufzuschreiben.

### 4. Das Post-Land-Audit ist verrauscht und bindet MAIN-Aufmerksamkeit
- **Belege:**
  - Seit 09-01: 560 Audits, davon 352 green, 123 red, 85 unknown.
  - Adjudikation der 123 roten: 8 real, 45 flake, 15 stale-test, 16 unknowable, 39 nie beurteilt.
  - Seit 09-18: 17 red, davon 3 real und 9 unbeurteilt.
  - 141 `unknown`-Zeilen sind nur „audit skipped: not the fleet repo“. `auditCmdFor` (siehe `rg 'function auditCmdFor'`) gibt fremden Repos das Fleet-Kommando, das sich dann selbst überspringt.
  - `/api/self/gate` meldet einer Fremd-Lane trotzdem `postlandAudit:true`.
- **Kosten:**
  - Nur ~7 % der Rots sind echt. Jedes Rot kostet eine MAIN-Adjudikation, und ein Drittel bleibt liegen. Das Signal verfällt.
  - Die „unknown“-Zahl ist für jeden Leser falsch, der nicht filtert.
- **Richtung:**
  - Ein fremdes Repo ohne Audit als `not-applicable` schreiben, nicht als `unknown`, und auch so auf `/api/self/gate` melden.
  - Flake-Quarantäne auf Check-Ebene statt Adjudikation pro Lauf.

### 5. Dispatch-Retry ohne Backoff, und Branches werden nie gelöscht
- **Belege:**
  - Am 09-24 liefen 13:39–14:11 241 `dispatch_requeued` für Task `52c33c3b` (Trust-Dialog). Jedes Mal wurde ein neuer Branch und Worktree angelegt, dazu 242 Paare `slot_open`/`slot_kill`. Der Commit-Body von `036df834` sagt „243 in zwei Stunden“. Mein Audit-Fenster zeigt 32 min.
  - In `~/private-repo-ae` liegen noch 244 `fleet/*`-Branches, 241 davon auf demselben Sha `e180741`.
  - `removeWorktreeSafe` (6626) löscht den Branch nie. `branch -D` gibt es nur in `/api/worktrees/discard` (40779).
  - In claude-fleet: 865 `fleet/*`-Branches, 844 davon schon in `main` gemergt.
  - Der Fix `036df834` zählt nur gleiche Screens hintereinander. Andere Ablehnungen (`not-alive`, `slot changed`) requeuen weiter ohne Deckel.
- **Kosten:**
  - Maschinen-Churn: eine Claude-Session alle ~8 s.
  - Ref-Müll, der jede `git branch`-Sicht unbrauchbar macht.
  - Die nächste Ablehnungsklasse wiederholt denselben Sturm.
  - Kosten des Branch-Mülls für die Git-Performance: unbeziffert.
- **Richtung:**
  - Beim Teardown den Branch mitlöschen, wenn er 0 Commits vor `base` hat.
  - Einen Backoff pro Zeile für jede Post-Spawn-Ablehnung, nicht nur für Screens.

### 6. Die Verify-Kette existiert vierfach und wird nur durch Pins zusammengehalten
- **Belege:**
  - Die Kopien: `watchdog.sh#VERIFY_CMD`, `.env FLEET_VERIFY_CMD_REPOS` (gitignored), `AGENTS.md` §Verify (Zeilen 283–291) und `verify-proportion.ts#LOCAL_PROOF_STEPS`. Zusammengehalten durch `e2e/pins.ts` `RULE_VERIFY` (1379).
  - `96bb83c4` (5) fand live: Dem `.env`-Eintrag fehlten 7 tsc-Dateien.
  - Heute ist die Land-Note gleich `VERIFY_CMD`, geprüft an `07e998e9`.
  - Das Land-Gate ist binär: `proportional` nur bei reinen Docs, 2 von 87 Gates mit dem Feld. Ein reiner `src/`-Change zahlt die volle 3-Suiten-Kette, obwohl `localProof` dafür nur `tsc`/`build` verlangt.
- **Kosten:** Eine Drift fällt erst an einem Pin oder live auf. Die Lane-Probe und das Land-Gate messen unterschiedliche Dinge.
- **Richtung:** Eine Quelle, aus der Env, Doc und Proportions-Tabelle generiert werden. Das Gate folgt derselben Tabelle wie `localProof`.

### 7. Die Dirty-Main-Prüfung existiert doppelt
- **Belege:**
  - `dirtyMainOverlap` (6960) arbeitet mit `-z`, Basis `mainSha..branch`, nur getrackte Pfade. Sie gilt für den MAIN- und den Owner-Pfad in `mergeJob`.
  - Die Merge-Route hat eine eigene Inline-Fassung (41158–41186): Porcelain ohne `-z`, Basis `merge-base..branch`, dazu untracked.
  - Die Self-Land-Tür bekommt nur die erste.
- **Kosten:** Zwei Antworten auf dieselbe Frage. Die untracked-Kollision ist für MAIN-Lands ungeprüft (gefolgert).
- **Richtung:** Eine Funktion, beide Pfade.

## FEHLT

- **Wer hinter einem Bearer steht:** keine Identität der Session, siehe ÄNDERN 1.
- **`verifyOk` im Verdikt-Ledger**, siehe ÄNDERN 2.
- **Beleg der Brief-Annahme:** Von 266 Brief-Sends im Fenster 09-20 bis 09-25 sind 197 `acceptance:"unobservable"` (74 %) und nur 69 `observed` (Semantik in `server.ts` 8290–8302). Dass eine Lane ihren Auftrag angenommen hat, ist meistens nicht bewiesen, nur „nicht widersprochen“. Gefolgert: Das betrifft vor allem Harnesses ohne Composer-Lesung. Die Aufteilung nach Harness habe ich nicht gezählt.
- **Eine Phasen-Sicht für die Lane selbst.** Die MAIN hat `program-phase.ts#phaseOf` und `server.ts#nextActionFor` (2594): READY, REVIEWABLE, INTEGRATING, OWNER_GATE plus die Tür, die dazugehört. Die Lane sieht nach ihrem Report nicht, wer sie landet, ob ihr Verdikt rot war oder ob sie wartet. Sie bekommt nur, was ihr zugestellt wird. Ein `GET /api/self/phase` mit derselben Projektion würde den Vier-Zustands-Zwilling aus `CLAUDE.md` („Idle heißt nicht fertig“) für die Lane selbst auflösen.
- **Ledger für Direkt-Commits:** Seit 09-18 gingen 77 von 473 `main`-Commits an jedem Land vorbei. 73 davon sind Docs, 4 sind Code (`fix(e2e)` ×2, `fix`, `fix(pi-zai)`), also ohne Note, Outcome und Audit-Zuordnung.
- **Backoff für nicht-Screen-Ablehnungen** beim Dispatch und **Branch-Aufräumen**, siehe ÄNDERN 5.

## Zahlen

| Messgröße | Wert | Zeitraum / Quelle |
|---|---|---|
| Lane-Outcomes | 690: landed 630, killed-empty 39, killed-dirty 15, shelved 3, ohne 3 | 09-01 bis 09-25, `lane-outcomes.jsonl` |
| Lands nach Akteur | MAIN 444 (70 %) · Owner-Token bearer 183 (davon 110 an lebender MAIN vorbei) · cookie 3 | wie oben, `landedBy` |
| Bypass-Lands pro KW | KW36 24 · KW37 30 · KW38 3 · KW39 53 | wie oben |
| `confirmedByHuman:true` | 12, davon 11 über bearer | wie oben |
| Merge-Verdikte | 535: merged 488, resolved 35, awaiting-author 6, error 6 (ff-lost 3, hub-unreachable 2, hub-only 1), blocked 0 | 09-07 bis 09-25, `audit.jsonl*` `merge_verdict` |
| Gate-Arbeit claude-fleet | p50 226 s, p90 306 s (n = 31) | 09-24 bis 09-25 (erst ab dann mit `repo`-Feld) |
| Gate-Warten (alle) | p50 0 s, p90 285 s, max 3 440 s | 09-20 bis 09-25 |
| Report `complete` bis Land-Start | p50 3,4 min, p75 11,1 min, p90 50,2 min (n = 378) | 09-07 bis 09-25 |
| Lane-Session bis Land | p50 69 min, p90 304 min (`sessionMs`) | 09-01 bis 09-25 |
| ffRounds > 0 | 8 von 914 Land-Noten | alle `fleet/land`-Noten |
| repairRounds > 0 | 0 von 914 Noten, 0 von 1 328 Outcomes | alle |
| undo-land genutzt | 0 | Audit-Log 07-21 bis 09-25 |
| Post-Land-Audits | 560: green 352, red 123, unknown 85 (66 davon Fremd-Repo-Skip) | 09-01 bis 09-25 |
| davon seit 09-18 | 226: green 151, red 17, unknown 58 (57 Skip) | 09-18 bis 09-25 |
| Audit-Dauer green, claude-fleet | p50 16,9 min, p90 19,8 min | 09-18 bis 09-25 |
| Adjudikation der roten Audits | real 8 · flake 45 · stale-test 15 · unknowable 16 · offen 39 | 09-01 bis 09-25 |
| Autoclose | 9 insgesamt, 9 von 31 killed-empty | 09-05 bis 09-25 |
| Dispatch-Requeues | 298, davon 296 `blocked-screen` am 09-24 (241 für eine Zeile) | 09-20 bis 09-25 |
| Lane-Successions | 137, davon 97 am 09-15 | 09-14 bis 09-25 |
| Brief-Annahme beobachtet | 69 von 266 (26 %) | 09-20 bis 09-25 |
| Übrig gebliebene `fleet/*`-Branches | claude-fleet 865 (844 gemergt), elektro… 244 | Stand 09-25 |
| Commits seit 09-01 | 1 626, davon 138 `fix/test(e2e\|sonde\|pins)` und 107 fix/feat mit land/merge/gate/audit im Subject | `git log` |

## Nicht geprüft

- **Nicht gelesen:**
  - `runMerge`/`runRepair`/`wakeAuthor` (Resolver-Prompt und Autor-Weckung).
  - Die Hub-Arbitrierung (`a9a5e8d4`, `FLEET_HUB_REMOTE`), Clone-Form-Lanes, `buildLaneOutcome` im Detail.
  - `confirmResolvedCandidate` jenseits von 29630–29775.
  - Die Kollisionslogik und den Startplan von `tickDispatch` (`start-plan.ts`), Varianten-Gruppen, `drainPostLandAudits` intern, die Shard-Verteilung auf den Helfer.
  - Den Client (`src/client.ts`), die Succession-Brief-Inhalte, den Inhalt der e2e-Suiten.
- **Nicht gemessen:**
  - Welche Session den Owner-Bearer hält. Das ist im Ledger nicht vorhanden; dass es die Orchestratorin ist, ist unbelegt.
  - Brief-Annahme nach Harness aufgeschlüsselt.
  - Ob der Branch-Müll `git` oder `tickGit` messbar bremst.
  - Die Qualität der Lands (`land-quality.jsonl` Rework) habe ich nur gelistet, nicht ausgewertet.
  - `killed-dirty` (15): ob dabei Arbeit verloren ging.
- **Gefolgert statt belegt:** die ~18 roten Gates (ÄNDERN 2) und die fehlende untracked-Prüfung auf dem MAIN-Pfad (ÄNDERN 7).
- **Fenster:** `audit.jsonl` ist rotiert. `merge_verdict` gibt es erst ab 09-07, `land_actor`-Details nur für 09-20 bis 09-25. Die Akteur-Zahlen für den ganzen September stammen aus `lane-outcomes.landedBy`.

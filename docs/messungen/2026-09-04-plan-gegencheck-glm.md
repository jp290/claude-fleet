---
frage: Traegt der Plan docs/program-lebenszyklus-2026-09-04.md (Program als dauerhafte Einheit, D1–D4) gegen den Code, Satz fuer Satz?
urteil: Der Plan ist im Kern tragfaehig — 8 von 9 Behauptungen bestaetigt (2 davon mit wesentlichen Praezisierungen), 1 teilweise; die Leitidee (Dauerhaftes an programId binden, Occupant nur bei Zustellung aufloesen) wird vom Code nicht widerlegt. Drei Stellen braucht der Plan korrigiert, bevor ein Schnitt filed wird: 3b vergisst laneAutoCloseRefusal (der scharfe Autoclose stuende still), D4-Schnitt 1 attribuiert einen Scan, den der Remote-Pfad nicht hat, und D3 ignoriert die Game-Maker-Succession, fuer die HANDOFF.md in git der EINE Kanal ist.
bereich: [architektur, zusammenarbeit, program, ledger]
belege: [server.ts#teardownSlotOccupant, server.ts#killSlot, server.ts#dropWatchesFor, server.ts#parkMergeVerdict, server.ts#clarificationReceiverFor, server.ts#openFleetReport, server.ts#handleSelfSucceed, server.ts#succeedProgramMain, server.ts#tickAuditPing, server.ts#tickWatches, server.ts#fleetReportsFor, server.ts#clarificationsFor, server.ts#runPostLandAudit, server.ts#helperResult, server.ts#postLandAuditChecks, server.ts#helperFailNames, server.ts#laneAutoCloseRefusal, server.ts#slotDeliveryBudget, server.ts#writeAuditAdjudication, server.ts#ownerLandActor, server/types.ts#Program, server/types.ts#AttentionRequest, server/types.ts#FleetReport, server/types.ts#PostLandAuditRow, lane-signals.ts#laneWatchSignal, watchdog.sh, e2e/pins.ts, e2e/watch.ts, docs/messungen/stichprobe-tiefenpruefung-2026-08-26.md]
nicht-gemessen: keine Ledger gelesen (gitignored, nicht im Worktree — alle Zahlen der beiden Grundlagen-Notizen sind unkritisch uebernommen); keine Suite gefahren (einziger Verify: bun e2e/pins.ts); e2e/ nur an zwei Stellen stichprobenartig; src/client.ts, supervisorView, merge-/land-Pfad nicht gelesen; Abwesenheit einer paneModel-Ruecklese nur per Messnotiz plus gezielter Suche belegt, nicht exhaustiv widerlegt
stand: 2026-09-04
---

# Plan-Gegencheck Program-Lebenszyklus (GLM-Lane, 2026-09-04)

Read-only-Gegencheck von `docs/program-lebenszyklus-2026-09-04.md` (HEAD im Lane-Baum) gegen den
Code. Grundlagen: selbiger Plan und `docs/messungen/2026-09-04-architektur-zusammenarbeit.md` §1
(je vollstaendig gelesen). Es wurde kein Code geaendert, kein Plan-Satz editiert, nichts mutiert,
kein `POST`. Symbolverweise, keine Zeilennummern.

## Ergebnis — die neun Behauptungen

| Nr | Urteil | Beleg | Uebersehen |
|---|---|---|---|
| 1 | BESTAETIGT (2 Praezisierungen) | `server.ts#teardownSlotOccupant` entnichtigt `s.mission`, filtert `autos`, nullt `s.programId`, ruft `dropWatchesFor`; `server.ts#dropWatchesFor` ruft `markFleetEventReceiverGone` (Events → `receiver-gone`), `reconcileClarifications`, `reconcileAttention` (→ `refused`) und disarmed Watches. Attention bindet ans Requester-Tripel (`server/types.ts#AttentionRequest`), Event und Report ans Empfaenger-Tripel (`server/types.ts#FleetReport`), Watch/Auto/Mission/mergeLast an die Slot-Nummer (`server.ts#mergeLast` ist `Map<number, …>`). `server.ts#handleSelfSucceed` → `server.ts#succeedProgramMain` oeffnet die Nachfolgerin und retiret den Vorgaenger-Slot, der ueber `killSlot` → Teardown geht — bei jeder Program-Succession. | (a) mergeLast wird vom Teardown nicht einfach „geraeumt": `server.ts#parkMergeVerdict(s.id, false)` hebt genau die REVIEWABLE Verdicts (resolved / awaiting-author / interrupted-mit-Konflikten) nach BRANCH in `mergeParked` — sie ueberleben den Kill seit 2026-08-05 (Kommentar „has LANE lifetime, not slot lifetime"). Das ist der bereits gebaute Park-Vorlaeufer genau der D1-Idee, kein blosses Opfer. (b) „Reports rerouten still auf Watch-Evidenz" ist kein Teardown-Effekt: der Teardown fasst `fleetReports` nicht an; bestehende Rows bleiben an das tote Tripel gebunden und werden nur unsichtbar (bis `FLEET_REPORT_KEEP`-Prune). Reroutet wird der NAECHSTE Report ueber `server.ts#clarificationReceiverFor`. (c) Der Plan nennt sechs Befund-IDs in einem Satz, behauptet aber sieben — der siebte bleibt unbenannt. |
| 2 | BESTAETIGT | `server/types.ts#AttentionRequest.programId` ist Pflichtfeld (string), `server/types.ts#FleetReport.provenance.programId` existiert (string \| null). Als ADRESSE benutzt keine von beiden: Zustellung laeuft ueber `server.ts#clarificationReceiverFor` (liest `lane.programId` am SLOT, nicht das Row-Feld), Empfang ueber das Tripel in `server.ts#fleetReportsFor`; Attention wird vom Owner-Prinzipal beantwortet. | `programId` ist nicht unbenutzt: `server.ts#programPhaseInput` filtert offene Attentions nach `a.programId` (Phase-Anzeige), die Attention-Sicht reichert `programTitle` an. „Wird nicht als Adresse benutzt" stimmt; „liegt nur herum" waere falsch — es ist Gruppierungs-Lesestoff, und D1 kann darauf aufsetzen. |
| 3 | BESTAETIGT | `server/types.ts#Program` vollstaendig gelesen: id, title, intent, successCriterion, nonGoals, decisions, evidence, openQuestions, status, createdAt, proposedBy, main?, promotion?, profile?, studio?, founding?, lineage?, confirmedAt?, activatedAt?, completedAt?. Kein Inbox-, kein Handoff-Feld. D1/D3 sind echte Feld-Neubauften am Typ — und `promotion`/`profile`/`studio` zeigen die etablierte Disziplin, die ein neues Feld verlangt: closed, versioned, default-absent, eine Route. |
| 4 | BESTAETIGT | `server.ts#handleSelfSucceed` ruft `handoffCommittedAfterOpen` und verweigert mit 409 „HANDOFF.md must exist, be clean, and have a commit newer than this session". Gilt fuer die generische UND die Program-Succession (Gate steht vor `succeedProgramMain`); Game-Maker zusaetzlich `gameMakerCheckpointError` (committete Checkpoint-UEberschrift, carry wird 409-refused). | (a) Supervisor-Succession rendert ebenfalls HANDOFF.md (Succession-Prompt „everything handed over is in HANDOFF.md") — die Plan-Aufzaehlung „Sessions ohne Program (Controller, Steward)" ist unvollstaendig. (b) Das Gate prueft exist + clean + Commit-juenger; D3 (`handoff.at > session.openedAt`) erzeugt kein Aequivalent fuer „clean" — die verlorene Pruefungskomponente ist im Plan unbenannt. |
| 5 | TEILWEISE | `server.ts#openFleetReport` delegiert die Empfaengerwahl an `server.ts#clarificationReceiverFor`: eine LEBENDE Program-Bindung gewinnt und liefert `basis: "program-main"` — das Program geht sehr wohl in die Wahl ein. `basis: "lane-watch"` ist der Rueckfall bei STALER Bindung (`programReceiver` wird null, wenn die MAIN nicht mehr exakt lebt) oder programloser Lane; der Kommentar „a lane WITH a programId keeps its binding and its 409" gilt nur fuer den Fall ganz ohne Evidenz. | `server.ts#laneAutoCloseRefusal` prueft nur, dass `decision.by` das EXAKTE Empfaenger-Tripel nennt — nie, dass dieser Empfaenger die MAIN des Programs ist. Wer via lane-watch empfing, darf ueber die Lane eines fremden Programs urteilen und ihren Autoclose autorisieren (`FLEET_LANE_AUTOCLOSE=1` scharf). Der Plan erwaehnt laneAutoCloseRefusal nirgends, obwohl Schnitt 3b sie umstoesst (siehe Kollisionen D1). |
| 6 | BESTAETIGT | `server.ts#tickAuditPing` sortiert Kandidaten `(a, b) => a.lastOutput - b.lastOutput \|\| a.id - b.id` nach Filter `cwd && worktree === null && label !== STEWARD_LABEL && awaiting !== "owner"`. `covers[].branch` und jede Programm-Provenienz gehen nicht in die Wahl ein. | Der Filter nimmt JEDE nicht-Lane-Session mit cwd — auch Controller- oder Owner-Slots ohne Worktree sind waehlbar. At most EIN Empfaenger pro Tick, `auditPings`-Marker verhindert Doppelauslieferung; die Adjudikations-Route steht owner-only by position. D1-Ansatz (Program des Lands aus `covers[].branch`) braucht eine branch→task→programId-Bruecke, die der Plan stillschweigend voraussetzt — im Code existiert sie als generisches Lookup nicht an einer Stelle. |
| 7 | BESTAETIGT | `server.ts#fleetReportsFor` und `server.ts#clarificationsFor` binden `worker \|\| receiver` auf `slot && openedAt && sessionId` (gelesen). Sondenlage: `e2e/watch.ts` Q3 stellt worker / gebundene MAIN / FREMDE MAIN gegenueber — drei verschiedene Slotnummern; `docs/messungen/stichprobe-tiefenpruefung-2026-08-26.md` §5 belegt, dass keine Sonde in e2e/ dieselbe Slotnummer mit neuem `openedAt` haelt, und nennt drei Familien (programs, steward-outcomes, share), die das Muster etabliert haben. | Die Luecke ist real, aber die Aussage „nur slot ist geprueft" beruht fuer die e2e-Gesamtheit auf der Sekundarquelle (Stand 2026-08-26) plus eigener Q3-Lektuere, nicht auf einer neuen Vollsuche aller Sondendateien. Der Plan (Schnitt 3a, fehlender Check) zieht die richtige Konsequenz. |
| 8 | BESTAETIGT (Nenn-Nuance) | `server.ts#openFleetReport` mintet ein `fleet-report`-FleetEvent und fasst `watches` nicht an; `server.ts#tickWatches` (FACT 1) mintet fuer den armed Lane-Watch derselben Lane zusaetzlich `lane-ready` (`lane-signals.ts#laneWatchSignal`), Watch disarmed erst mit dem Feuern. Beide Events sind nicht-terminal und zaehlen in `server.ts#slotDeliveryBudget` gegen `cap = FLEET_EVENT_MAX_OPEN_PER_SLOT`, das per Konstantendefinition `=== WATCH_MAX_PER_SLOT` (5) ist; der armed Watch selbst belegt bis zum Feuern eine zusaetzliche armedReservation (drei von fuenf Plaetzen fuer EINE Lane inkl. Watch). | Formal zaehlen beide gegen `FLEET_EVENT_MAX_OPEN_PER_SLOT`, nicht gegen `WATCH_MAX_PER_SLOT` — wertidentisch, nur der Name unterscheidet sich. Fuer die Dedupe (D1-Schnitt 3b) liegt der Empfaenger in `openFleetReport` bereits berechnet (`bound.receiver`), der lokale Entwaffnungs-Schnitt ist also dort moeglich, wo die Messnotiz ihn vorschlug; Pin in `e2e/pins.ts` („watchId is null exactly for clarification-request and fleet-report") bleibt unberuehrt. |
| 9 | BESTAETIGT (Attributionsfehler im Plan) | `server/types.ts#PostLandAuditRow.fails` — Typkommentar wortwoertlich „remote-only, validated and capped names; absent on local and historical rows". Lokaler Pfad `server.ts#runPostLandAudit` schreibt die Row ohne `fails` (nur `out`, `trail?`, `checks`); der Remote-Pfad `server.ts#helperResult` fuellt `fails` aus `server.ts#helperFailNames(body?.fails)`. | Der Plan sagt „derselbe PASS/FAIL-Scan, den der Remote-Pfad schon fuellt" — falsch attribuiert: Der Remote-Pfad SCANNT nicht, der HELPER meldet die Namen und der Server validiert/capped sie. `server.ts#postLandAuditChecks` zaehlt `PASS `/`FAIL `-Zeilen, extrahiert aber keine Namen. Der lokale Schnitt ist NEU (Namens-Extraktion aus completeOutput plus Cap), wenn auch billig, weil completeOutput vor dem Byte-Cap anliegt. Alternative, die der Plan uebersieht: die durable per-check trail (`PASS  trail: …`-Zeile, `postLandAuditTrailFile`) liefert die Namen ohnehin pro Zeile. |

Zahl: 8 bestaetigt (1, 2, 3, 4, 6, 7, 8, 9 — davon 1 und 9 mit wesentlichen Praezisierungen), 1
teilweise (5), 0 widerlegt.

## Kollisionen je Datenschicht

### D1 — Program-Inbox

- **`server.ts#laneAutoCloseRefusal` ist der vergessene Aufrufer.** Der Autoclose ist scharf
  (`FLEET_LANE_AUTOCLOSE=1`) und verlangt fuer JEDEN Report der Lane ein `decision`, das den EXAKTEN
  Empfaenger-Occupanten nennt; `r.receiver === null` ist bereits eine refusal („an owner-inbox
  report carries no MAIN verdict to close on"). Wird der Empfaenger in 3b das Program (kein
  Occupant-Tripel), stuende jede Program-adressierte Lane dauerhaft auf „undecided" und der
  Autoclose waere stillgelegt — nicht rot, nur weg. 3b muss laneAutoCloseRefusal, decideFleetReport
  und fleetReportFrom MIT umziehen; der Plan nennt keines der drei.
- **`receiver`/`basis` sind EIN Fakt.** `server/types.ts#FleetReport`: „null exactly when basis is
  owner-inbox … fleetReportFrom checks them together". Eine Program-adressierte Row braucht eine
  neue basis-Stufe plus Loader-Anpassung; die Q3-Sonde in `e2e/watch.ts` („bound MAIN gets …
  receiver?.slot === main") wuerde ueber die neue Semantik FALSE werden und mitsamt 3b umgezogen
  werden muessen.
- **Budget-Kopplung:** `server.ts#slotDeliveryBudget` rechnet offene FleetEvents plus armed Watches
  gegen EIN Cap, das drei Tueren (watch-Route, beide Report-Tueren) und zwei Sichten teilen. Liefert
  die Inbox kuenftig ohne FleetEvent, verliert diese Arithmetik ihre Basis — D1 muss sagen, was mit
  dem Cap geschieht (entfaellt es, oder zaehlen Inbox-Eintraege weiter?).
- **Schnittgroesse:** 3a (Datenmodell + Schreiber + GET/POST /api/self/inbox; Route existiert heute
  nicht) ist eine Lane. 3b ist zu gross: drei unabhaengige Zustell-Umstellungen (Report→Program
  inkl. Autoclose-Abhaengigkeit, Audit-rot→Program inkl. tickAuditPing-Rueckfall, Lane-Watch-Dedupe)
  in einem Schnitt — mindestens dreiteilen.

### D2 — Program-Status-Projektion

- **Pin-Kollision direkt:** `e2e/pins.ts` haelt eine Regel, dass `server.ts#programExecutionView`
  keine Mutations-Primitive enthaelt (kein saveState/appendEvent/sendText/spawnCmd) — D2 muss
  read-only bleiben oder der Pin faellt. Ein zweiter Pin prueft Text-Gaps um „GET
  /api/self/program-execution" — Route darf nicht umbenannt oder ausgeloehlt werden.
- **Halb gebaut:** `programOccupancy`, `programHealth`, `programReturnPath`/`programDeliveryBudget`
  und die Execution-View existieren schon; `deliveryBudgetNote: "return path unknown …"` ist genau
  die D2-Warnung, schon im Code formuliert. D2 ist Erweiterung einer bestehenden Projektion, kein
  Neubau — der Plan stellt das korrekt dar, nennt die bestehende Route aber nicht.
- **Neuer Aufwand sind die Joins:** `lastLand`/`lastAudit` brauchen Lesepfade auf
  `lane-outcomes.jsonl`, `post-land-audits.jsonl` und Land-Notes (zwei davon sind heute
  Board-/Trail-Quellen). Read-only, aber drei neue Lese-Rails in einem Pull-Handler.
- **Schnittgroesse:** fuer EINE Lane machbar — der kleinste der vier.

### D3 — Handoff am Program

- **Game-Maker-Kollision (hart):** `server.ts#handleSelfSucceed` verlangt fuer Game-Maker-Programs
  den COMMITTEN Checkpoint als „the one handover channel" (`gameMakerCheckpointError`; carry wird
  409-refused). Der Plan-Satz „HANDOFF.md in git bleibt nur fuer Sessions ohne Program" widerspricht
  dem direkt: Game-Maker-Programs sind Programs, deren Succession aber zwingend ueber git laeuft.
  D3 muss Game-Maker ausnehmen oder den Kanal mit ziehen — keine der beiden Varianten steht im Plan.
- **Supervisor fehlt in der Aufzaehlung** (siehe Behauptung 4): die Supervisor-Succession rendert
  HANDOFF.md und hat kein Program. „Controller, Steward" ist unvollstaendig.
- **Verlorene „clean"-Komponente:** das heutige Gate prueft exist + clean + Commit-juenger;
  `handoff.at > session.openedAt` ersetzt nur die dritte. Bei git war „uncommittete Aenderungen"
  sichtbar; am Feld ist niemand, der es prueft — die Lücke muss benannt oder kompensiert werden
  (z. B. `bySession`-Bindung als Teilersatz).
- **Boot-Analogregel noetig:** der Restore pflegt heute, dass ein aelterer HANDOFF-Commit nicht
  „frisch" wird, nur weil der Komparator fehlte (`openedAt` faellt auf SERVER_BOOT_AT). Die
  Feld-Variante braucht dieselbe Fail-closed-Regel fuer fehlendes `session.openedAt`.
- **Schnittgroesse:** Gate + Gruendungsprompt + Route + e2e — EINE Lane, seriell nach 3a (die
  Plan-Reihenfolge ist korrekt).

### D4 — Vollstaendige Ledger-Zeilen

- **`fails[]` lokal:** keine Pin- oder Validator-Kollision; der Typkommentar („absent on local and
  historical rows") und `server.ts#helperFailNames` (Cap/Validierung) sind die Vorlage. Der Schnitt
  ist ein NEUER Namens-Extraktor (oder Trail-Leser), kein vorhandener Scan — Plan-Text korrigieren,
  Schnitt bleibt klein.
- **Adjudikations-Actor:** `server.ts#writeAuditAdjudication` hat heute kein Request-Argument und
  stempelt `by: "owner"`; `server.ts#ownerLandActor` + `loadLandActor` liefern via/suspect samt
  Persistenz-Disziplin. Kleine Signatur- plus Caller-Aenderung; `by: "backfill"` bleibt unberuehrt.
  Keine Kollision.
- **`paneModel`:** es existiert keine Ruecklese-Sonde (Messnotiz B-A6; eigene gezielte Suche fand
  keine Widerlegung — nicht exhaustiv). Risiko, das der Plan nicht nennt: das `/model`-Senden
  laeuft ueber sendText IN die Pane eines laufenden Agenten — der Agent kann die Zeile als
  Benutzereingabe interpretieren statt als Kommando; der Kanal ist kein definiertes
  Befehlsinterface. Der Plan behandelt es als harmlose Zusatzzeile.
- **Dispatch-Env:** `watchdog.sh` srv-Spawn hat `FLEET_DISPATCH_MAX_LANES=2` und KEIN
  `FLEET_DISPATCH_MAX_LANES_PER_PROGRAM` — der Plan-Schnitt ist eine reine Env-Ergaenzung;
  `server.ts#tickDispatch` liest sie (Default bleibt `DISPATCH_MAX_LANES`, „inert until smaller").
  Keine Pin-Kollision (die watchdog-Pins pruefen Existenz der Zeile, nicht Vollstaendigkeit der
  Env-Keys).
- **Schnittgroesse:** der Plan teilt D4 selbst in vier unabhaengige, einzeln landbare Schnitte —
  korrekt; keiner ist fuer sich zu gross.

## Korrekturen am Plan, gerankt nach Kosten (billig zuerst)

1. **(reiner Text) 3b um die Autoclose-Abhaengigkeit erweitern:** `laneAutoCloseRefusal`,
   `decideFleetReport`, `fleetReportFrom` muessen im selben Schnitt mit umziehen, sonst steht der
   scharfe Autoclose hinterher still. Groesster einziger Plan-Fehler.
2. **(reiner Text) D4-Schnitt 1 neu attribuieren:** der Remote-Pfad scannt nicht — der Helper
   meldet die Namen, der Server validiert/capped sie (`helperFailNames`). Der lokale Schnitt ist
   ein neuer Extraktor aus completeOutput (oder ein Trail-Leser); Aufwand bleibt ein Feld, aber die
   Begruendung „derselbe Scan" ist falsch.
3. **(reiner Text) D3 um Game-Maker und Supervisor ergaenzen:** Game-Maker-Programs behalten den
   committeten Checkpoint als EINEN Kanal (Ausnahme formulieren), Supervisor in die
   „ohne-Program"-Aufzaehlung, und die verlorene „clean"-Komponente des Gates benennen.
4. **(reiner Text) §0 mergeLast und Reports praezisieren:** reviewable Verdicts ueberleben den
   Teardown seit 2026-08-05 per `mergeParked` by branch — das ist der gebaute Park-Vorlaeufer der
   D1-Idee und gehoert in die Argumentation, nicht in die Opferliste; „Reports rerouten still" ist
   ein `clarificationReceiverFor`-Effekt kuenftiger Reports, kein Teardown-Effekt.
5. **(Planstruktur) 3b dreiteilen:** Report→Program (inkl. Autoclose), Audit-rot→Program (inkl.
   tickAuditPing-Rueckfall), Lane-Watch-Dedupe — jede einzeln landbar, zusammen mit 3a zu gross
   fuer eine Lane.
6. **(Verify-Zeile, billig)** Schnitt 1 Verify ergaenzen: „lokale rote Zeile traegt NUR gescannte
   Namen im selben Format wie `helperFailNames`" — sonst kann der Check gruen werden, ohne das
   Feldformat zu binden.

## Methode

- graphify (read-only, Main-Graph): eine Query `teardownSlotOccupant …` (BFS Tiefe 2, 258 Knoten,
  Ausgabe truncatiert — diente nur der Symbol-Lokalisierung: teardownSlotOccupant, killSlot,
  dropWatchesFor, MergeLast, closeProgramLineageForOccupant).
- `rg -n` zur Lokalisierung aller Einstiegssymbole in `server.ts`, `server/types.ts`,
  `lane-signals.ts`; dann gezielte Lesebereiche (40–130 Zeilen) um jeden Treffer: Teardown/Kill,
  dropWatchesFor-Reconciler, clarificationReceiverFor, openFleetReport komplett, fleetReportsFor /
  clarificationsFor, handleSelfSucceed, succeedProgramMain, tickAuditPing, tickWatches (FACT 1),
  slotDeliveryBudget, PostLandAuditRow-Typ, runPostLandAudit, helperResult, postLandAuditChecks,
  writeAuditAdjudication, ownerLandActor, laneAutoCloseRefusal, boundProgramForMain, parkMergeVerdict,
  Program-/Attention-/FleetReport-Typen, Q3-Sonde in `e2e/watch.ts`, relevante Regeln in
  `e2e/pins.ts`, srv-Spawn-Zeile in `watchdog.sh`.
- Sekundaerquelle: `docs/messungen/stichprobe-tiefenpruefung-2026-08-26.md` §5 (Sondenlage zu
  Behauptung 7), gelesen und am Rand verifiziert.

## Was nicht gemessen wurde

- **Keine Ledger-Zahlen neu erhoben:** `fleet.json`, `audit.jsonl`, `post-land-audits.jsonl`,
  `audit-adjudications.jsonl` sind gitignored und fehlen im Lane-Worktree. Alle Zahlen in dieser
  Notiz stammen aus den beiden Grundlagen-Notizen und wurden als CLAIMS uebernommen, nicht
  nachgerechnet.
- **Keine Suite gefahren** (einziger Verify dieser Docs-Lane: `bun e2e/pins.ts`); die Aussage
  „Q3 bliebe bei gekuerztem `bound()` gruen" der Stichprobe wurde nicht reproduziert.
- **e2e/ nicht vollstaendig durchsucht:** „keine Sonde haelt same-slot-new-openedAt gegen
  fleet-report" beruht auf der Stichprobe 2026-08-26 §5 plus eigener Q3-Lektuere, nicht auf einer
  neuen Vollsuche aller Sondendateien.
- **Nicht gelesen:** `src/client.ts` (Renderpfade/Badges), supervisorView und
  `completeTransitionWatch`, der merge-/land-Pfad (B2-Bezug), `GET /api/self/programs`-Payload,
  Game-Maker-Promptkette jenseits der Prompt-Strings, `programReturnPath` im Detail.
- **paneModel-Ruecklese-Abwesenheit** nur per Messnotiz B-A6 plus gezielter Symbolsuche belegt —
  keine exhaustive Widerlegung ueber alle Dateien.
- **Traeger-Zahlen des Plans** (MAIN bei 29 %, Deckel 2) sind Ledger-Fakten und hier nicht
  pruefbar.

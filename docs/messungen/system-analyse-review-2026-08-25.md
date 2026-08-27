---
frage: Welche der Vorschläge der SYSTEM.md-Analyse überleben den adversariellen Gegenbeweis (Verdikte V1 bis V4 plus Delivery)?
urteil: V1 bestätigt (stark geschnitten), V2 und V3 refutiert, V4 bestätigt mit erweitertem Scope, Delivery zurückgestellt; überleben V1a Authority-Gesundheit, V2-Ersatz (null-zu-ID-Nachführung an der Quelle) und V1b Rückweg-Budget als erste dispatchbare Slices
bereich: [autoritaet, verify]
belege: [docs/messungen/system-analyse-2026-08-25.md, server.ts#boundProgramForMain, docs/authority-slice-brief-2026-08-23.md, docs/messungen/program-triage-2026-08-25.md]
nicht-gemessen: V1s 24-Stunden-Nutzungsrate; die tatsächliche Lesefrequenz von supervisorView; eine post-d0fa215 Held-Event-Verteilung; die Historie aller heutigen Pending-Zeilen
stand: 2026-08-25
---

# Adversarialer Review der SYSTEM.md-Analyse — was den Gegenbeweis überlebt

2026-08-25, Lane `fleet/260825130027-0c11`, Ausgangsbaum `0dc7a33`. Startbedingung erfüllt:
`git show main:docs/messungen/system-analyse-2026-08-25.md` war lesbar.

**Abstraktionsurteil vor der Implementationskritik:** Eine programmübergreifende Gesundheitsprojektion
soll existieren, weil Owner und Supervisor heute aus getrennten Fakten dieselben Blockaden herleiten
müssen. Sie soll aber **keine dritte Lebenszyklusprojektion** und kein pauschales `waitingOn`-Urteil
werden: eine gemeinsame reine Ableitung muss die vorhandenen Owner- und Supervisor-Sichten speisen.

Geprüft wurden `SYSTEM.md` vollständig, `AGENTS.md` §Portable operating contract/Verify,
`docs/work-register-2026-08-06.md` §7, die Owner-Policy in
`docs/authority-slice-brief-2026-08-23.md`, die Vorgängeranalyse vollständig sowie die jeweils
zitierten Code-Nähte mit `rg -n` und `ast-grep --lang ts`. Nicht gelesen wurden das gitignorierte
Live-`fleet.json`, fremde Panes und Ledgers außerhalb dieser Lane. Daher ist die 24-h-Nutzungsrate
von V1 **nicht gemessen**; die aktuelle Programm-Triage wird als fremde Messung gekennzeichnet, nicht
als eigene Beobachtung.

## Verdikte

| Vorschlag | Verdikt | Beleg und Fallversuch | Realistische Kosten / kleinster zulässiger Schnitt |
|---|---|---|---|
| **V1 Betriebs-Blick** | **CONFIRM — stark geschnitten** | Der Baum hat bereits die richtige gemeinsame Naht für Occupancy (`server.ts:6363-6375`) und benutzt sie in `GET /api/programs` und `supervisorView` (`server.ts:15058-15095`, `server.ts:15576-15582`). Die fremde Messung vom selben Main-Stand fand 15 tote von 19 aktiven Bindungen (`docs/messungen/program-triage-2026-08-25.md:10-23`): ein sichtbarer Nicht-null-Fall existiert also, auch wenn seine 24-h-Dauer hier ungeprüft bleibt. Der zweite Falsifizierer fällt strukturell: `openAttention` verlangt eine aktive MAIN-Bindung (`server.ts:6897-6899`), obwohl der Supervisor-Brief die Route fälschlich als eigenen Owner-Kanal nennt (`server.ts:14786-14792`, `e2e/supervisor.ts:45-51`). Ein Supervisor kann diese Fakten heute nicht über diese Route „binnen einer Stunde“ abladen. **Geschnitten werden** `oldest*AgeMs`, der pauschale Principal `waitingOn` und eine neue Route. Zuerst nur gemeinsam abgeleitete, rohe Authority- und Rückwegfakten auf den zwei vorhandenen Sichten; keine davon behauptet schon einen Owner-Akt. | Kein „ein Feld“-Commit: `wc -l server.ts src/client.ts` misst 21.338/9.854 Zeilen; hinzu kommen Program-/Supervisor-/Watch-Probes und Docs. Weil diese Verhaltensproben in `e2e/programs.ts`, `e2e/supervisor.ts`, `e2e/watch.ts` beziehungsweise `e2e/restart.ts` laufen, braucht jeder vertikale Schnitt volle lokale Kette plus `./e2e-isolated.sh`; danach wiederholt der Land-Gate die ~101-s-Kette und stößt den seriellen ~8-min-Post-Land-Audit an (`docs/verify-tiering.md:1233-1238`, `docs/suite-contention.md:242-245`, `watchdog.sh:91-108`). Unbelastet sind das grob 18–20 Suite-Minuten pro Schnitt; Mutex-Wartezeit kommt hinzu, der Live-Land-Warteetat ist 45 min (`watchdog.sh:129-148`). |
| **V2 Self-Rebind für `sessionId`** | **REFUTE** | Die angeblich offene Vorfrage war auf Main schon beantwortet: frischer Codex startet mit `sessionId:null`, `tickCodexRecovery` lernt später genau eine ID und zieht `program.main` nicht nach (`docs/harvest-portabilitaet-J-2026-08-21.md:57-72`; aktueller Code `server.ts:4147-4161`, Bindung `server.ts:15429-15431` und `server.ts:15543-15545`). Eine Self-Route würde die Land-Eigenschaft vom owner-bestätigten exakten Triple auf „hält das Pane-Token“ senken; genau dieses Triple ist Owner-Policy der Land-Tür (`docs/authority-slice-brief-2026-08-23.md:36-46`) und wird absichtlich gegatet (`server.ts:6581-6590`). Der kleinere Gegenentwurf ist stromaufwärts: nur beim serverbeobachteten Übergang `null → genau eine erkannte ID` die noch-nullige Bindung desselben `slot+openedAt` nachführen; niemals einen fremden non-null Wert überschreiben, niemals bei Mehrdeutigkeit. | Eine Route, Security-Fläche und Owner-Knopf entfallen. Der Ersatz bleibt ein Land-/Identitäts-Schnitt in `server.ts` plus `e2e/restart.ts` und `e2e/programs.ts`; deshalb volle Kette + isolierte Vorschau + Land-Gate + Post-Land-Audit, also ebenfalls grob 18–20 Suite-Minuten unbelastet. |
| **V3 billige Uhr aus `created`** | **REFUTE** | Der Falsifizierer war zu eng. Nicht nur `sent → pending` macht `created` falsch: `detachSlotTasks` schreibt `sent → pending` ohne Zeitstempel (`server.ts:5010-5020`), die Owner-Routen schreiben auch `queued → pending` und `archived → pending` (`server.ts:20869-20871`), während `created` unverändert bleibt (`server.ts:1922-1935`). Eine eben entparkte Altzeile würde daher sofort als „seit Wochen pending“ erscheinen. Außerdem hatten nur 18 der 80 gezählten ausführbaren Pending-Zeilen überhaupt ein `programId` (`docs/messungen/system-analyse-2026-08-25.md:93-103`); V1s Programmstreifen könnte die behaupteten „80“ also nicht sichtbar machen. Die frühere Triage ließ 21 Zeilen bewusst zum zweiten Blick pending (`docs/messungen/2026-08-19-queue-triage.md:10-18`, `:39-50`). | Die billige Scheibe existiert nicht. Ein ehrliches `statusAt` müsste alle Übergänge, Loader-Legacy (`unknown`, nie 0), Projektion und UI umfassen und wäre mindestens ein voller `server.ts`-/E2E-Land mit denselben ~18–20 Suite-Minuten. Vorher fehlt eine Statushistorien-Messung; ohne sie wird kein Persistenzfeld dispatcht. |
| **V4 „owner draft“-Vokabular korrigieren** | **CONFIRM — Scope erweitert** | Die Owner-Korrektur ist nicht offen: `3f22392` hält den Entscheid fest; getrackt steht „Claude Codes eigener Rest, nie ein Owner-Entwurf“ auf `docs/attic/regelbuch-bedeutungsprobe-2026-08-18.md:129-132`, die spätere Analyse benennt die promovierte Regel und die Board-/`POST /send`-Interaktion (`docs/kontextschicht-analyse-2026-08-20.md:211-214`). Der Vorgänger zählt aber nur sechs Server-Kommentare. Aktiv steht dieselbe falsche Benennung zusätzlich im Client (`src/client.ts:9616-9630`) und in Verhaltens-/Akzeptanzproben (`e2e/watch.ts:220-264`, `acceptance-probe.ts:100-108`, `:170-176`). Nur sechs Kommentare zu ändern ließe die falsche Spezifikationssprache stehen. | Ein gemeinsamer Terminologie-Schnitt über aktive Code-, Client- und Probe-Flächen; historische Analysen bleiben Historie. Weil `server.ts`, Client und E2E berührt werden, ist auch Textarbeit kein Gratis-Land: volle Kette; bei geänderten E2E-Proben zusätzlich isolierte Vorschau; Land-Gate und Post-Land-Audit bleiben unverändert. Härtung, daher unter der Schnittlinie. |
| **Zustellung: Backoff + Terminalzustand + Eskalation** (zusätzlicher Ranglistenposten) | **DEFER** | Der Vorgänger hat den einzigen großen Retry-Fall selbst nach `d0fa215` als nicht mehr reproduziert ausgewiesen (`docs/messungen/system-analyse-2026-08-25.md:168-190`). Vor einem Zustandsautomaten fehlt eine neue Messung **nur ab `d0fa215`**: Anzahl Events, Attempts-Verteilung, längste Held-Dauer, Ursache und Ausgang. Der gemeinsam gedeckelte Report-/Watch-Rückweg ist davon getrennt und wird als V1b sichtbar gemacht; er rechtfertigt keinen Backoff. | Kosten erst nach der Messung schätzbar; Backoff + Terminal + neue Eskalationsautorität wären mindestens Server, Wire/Loader, Client, Reverse-State, Docs und E2E. Ohne Opfer und Policy ist das eine mehrlandige Härtungsscheibe, nicht dispatchbar. |

Damit hat jeder echte Vorschlag des Vorgängers genau ein Verdikt. Die Restliste
`Act`/`ContextEnvelope`/`Trace`, Grün-ohne-Messung und die nur gezählten Audit-Ereignisse war
ausdrücklich keine Vorschlagsliste und wurde nicht künstlich zu weiteren Slices umgedeutet.

## Invarianten-, Policy- und Friedhofsprüfung

- Kein überlebender Schnitt macht den Owner wieder zum Routine-Land-Operator. Die Owner-Policy legt
  clean/green, Konfliktlösung und bounded recovery bei MAIN ab und reserviert nur Scope, irreversible
  Wirkung/Kosten, Taste/Release, widersprüchliche Provenienz und Erschöpfung für den Owner
  (`docs/authority-slice-brief-2026-08-23.md:10-27`). Darum darf „Promotion fehlt“ allein **nie**
  `waitingOn:"owner"` erzeugen; erst eine konkret REVIEWABLE Zeile ohne nutzbare Policy benennt die
  bestehende Owner-Tür.
- Der Self-Rebind fällt, weil owner promotion und exakte Identität nicht gegen Bequemlichkeit
  getauscht werden dürfen (`AGENTS.md:24-28`, `:80-84`). Die automatische `null→ID`-Nachführung
  präzisiert einen serverbeobachteten Fakt desselben Occupants und verändert weder Slot noch
  `openedAt`, Program, Policy oder Authority.
- Keiner der Schnitte öffnet die sechs beerdigten Ideen wieder
  (`docs/work-register-2026-08-06.md:218-231`): kein Auto-Rollback, kein volles hartes Pre-Land-Gate,
  kein Hook/Graphify/Cron, keine Stop-Hook-Uhr, kein K2-Shadow-Richter und kein Eval-Gate. Die
  bestehende volle **lokale** Verifikation und der bestehende Server-Land-Gate sind Beweiswege, kein
  Vorschlag, die beerdigte Full-Suite zum synchronen Pre-Land-Gate zu machen.
- Provider-/Lifecycle-/Client-Flächen sind entschieden: V1a/V1b: protocol/wire **apply**, server
  **apply**, client **apply**, reverse-state **not-applicable** (rein abgeleitet), docs **apply**,
  probes **apply**. Identitätsnachführung: protocol/wire **not-applicable**, server **apply**, client
  **not-applicable**, reverse-state **apply** (Loader und Persistenz), docs **apply**, probes
  **apply**. V4: protocol/wire **not-applicable**, server/client/docs/probes **apply**.

Eine aktive Schichten-Kollision bleibt und wird nicht bequem aufgelöst: `AGENTS.md:57` sagt korrekt,
der Supervisor habe keinen Owner-Kanal; `server.ts:14791` und `e2e/supervisor.ts:50` behaupten
gleichzeitig, `POST /api/self/attention` erreiche den Owner, aber die Route verweigert ihn über
`boundProgramForMain` (`server.ts:6897-6899`). Das ist ein separater Honest-Surface-Defekt. Eine
Supervisor-Autorität zum Owner ist mit Program `e04cd5d8` nur vorgeschlagen
(`docs/messungen/program-triage-2026-08-25.md:57-65`) und bleibt eine Owner-Promotion; keiner der
folgenden Slices baut sie still ein.

## Finale Rangliste

Gerankt nach **Autonomie > Funktionsfähigkeit > Härtung** und nach landbarer Größe, nicht nach der
Nummerierung des Vorgängers:

| Rang | Überlebende Arbeit | Warum hier |
|---:|---|---|
| 1 | **V1a — gemeinsame Authority-Gesundheit auf vorhandener Owner-/Supervisor-Sicht** | macht unbrauchbare Autonomie sichtbar, ohne neue Authority oder dritten Lebenszyklus |
| 2 | **V2-Ersatz — späte Session-ID stromaufwärts nachführen** | beseitigt die gemessene Ursache, ohne das exakte Land-Gate zu schwächen |
| 3 | **V1b — Rückweg-Budget als gemeinsamer Gesundheitsfakt** | macht den konkret gemessenen Watch/Report-Selbstverschluss sichtbar, ohne Retry oder Mutation |

**— SCHNITTLINIE —**

| Rang | Arbeit | Warum darunter |
|---:|---|---|
| 4 | **V4 aktive Terminologie korrigieren** | bestätigt und billig im Diff, aber nur Härtung; jeder Land zahlt trotzdem Gate/Audit |
| 5 | **24-h-Nutzungsmessung für weitere V1-`waitingOn`-Klassen** | erst messen: Anteil/Zeit mit nicht-null je aktivem Program sowie tatsächliche Owner-Nutzung |
| 6 | **Statusalter / `statusAt`** | V3 refutiert; erst Übergangshistorie und Owner-Semantik für geparktes Material messen |
| 7 | **Delivery-Backoff/Terminal/Eskalation** | post-`d0fa215` ohne gemessenes Opfer; Härtung mit noch offener Policy |

## Die ersten drei dispatchbaren Slices

**1 · V1a — Authority-Gesundheit.** Exklusives Write-Set: `server.ts`, `src/client.ts`,
`e2e/programs.ts`, `e2e/supervisor.ts`, `docs/self-api.md`. **DONE:** genau ein reiner Helfer liefert
je Program `health:{occupancy,sessionIdMatch}`; `sessionIdMatch` ist nur beim live gebundenen
Occupant `exact|divergent` und sonst `unknown`. `GET /api/programs` und
`supervisorView.portfolio` benutzen denselben Helfer; das Supervisor-Portfolio ergänzt den rohen
`promotion`-Record (sonst `null`), während der Owner-GET seinen vorhandenen Top-Level-Record behält.
Das Board zeigt jede aktive Zeile dauerhaft, kein Feld wird persistiert, kein Ledger wird auf dem
2-s-Poll gelesen und weder pending/queued noch `promotion:null` behauptet `waitingOn:"owner"`. Der
bestehende reine Client-Helfer `promotionState` bleibt der einzige Übersetzer in
`absent|off|green-only|guarded|unreadable`. Wenn dafür doch
eine zweite Phasenableitung oder ein Ledger-Read im Owner-GET nötig wird, ist die Slice falsch
geschnitten und wird neu gerahmt. **Verify-Kommando:**
`bun install --frozen-lockfile && bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts merge-prompt.ts && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh && ./e2e-isolated.sh`; sauber nur mit letztem Tail `ALL PASS`.

**2 · V2-Ersatz — `null→ID` an der Quelle.** Exklusives Write-Set: `server.ts`, `e2e/restart.ts`,
`e2e/programs.ts`, `docs/self-api.md`. **DONE:** wenn `tickCodexRecovery` aus genau einem Kandidaten
erstmals `s.sessionId` setzt, wird ausschließlich die noch-nullige `main.sessionId` der **genau
einen aktiven** Programbindung desselben `slot+openedAt` mit dieser serverbeobachteten ID präzisiert;
ein non-null Unterschied und null oder mehrere passende aktive Programbindungen bleiben
unverändert, `codexRecoveryState:"ambiguous"` schreibt keine Bindung, und eine Codex-MAIN erreicht das
exakte Self-Land-Gate erst nach dieser Nachführung. Keine neue Route, kein Request-Body, keine
Änderung von `slot`, `openedAt`, `boundAt`, Policy oder Programstatus. **Verify-Kommando:**
`bun install --frozen-lockfile && bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts merge-prompt.ts && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh && ./e2e-isolated.sh`; sauber nur mit letztem Tail `ALL PASS`.

**3 · V1b — Rückweg-Budget.** Exklusives Write-Set: `server.ts`, `src/client.ts`,
`e2e/programs.ts`, `e2e/watch.ts`, `docs/self-api.md`. **DONE:** ein gemeinsamer reiner Helfer
projiziert `deliveryBudget` als
`{state:"known",deliveryDebts,armedReservations,cap,free}` oder
`{state:"unknown",reason}`; Program-Zuordnung erfolgt nur über die eindeutige live
`slot+openedAt`-Bindung, Mehrdeutigkeit oder fehlende Bindung ergibt `unknown`, nie 0. Owner- und
Supervisor-Sicht zeigen bei 0 freien
Plätzen denselben Satz; die 4-Watches-plus-1-Debt-Gegenprobe reproduziert die bisherige
`fleet-report receiver has no FleetEvent delivery budget`-Ablehnung, während die Sicht selbst weder
Watch/Event acked noch Cap/Retry verändert. **Verify-Kommando:**
`bun install --frozen-lockfile && bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts src/share.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts merge-prompt.ts && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh && ./e2e-isolated.sh`; sauber nur mit letztem Tail `ALL PASS`.

## Offene Messgrenze

Nicht bestimmt sind V1s 24-h-Nutzungsrate, die tatsächliche Lesefrequenz von `supervisorView`, eine
post-`d0fa215` Held-Event-Verteilung und die Historie aller heutigen Pending-Zeilen. Diese Werte
bleiben `unknown`; sie rechtfertigen weder Null noch Pass noch einen weiteren Bau-Slice.

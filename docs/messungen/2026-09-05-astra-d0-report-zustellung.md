---
frage: Warum erreichten die Fleet-Reports vom 2026-09-05 die Codex-MAIN auf Slot 3 nicht, obwohl Report und FleetEvent gespeichert wurden — und was ist der kleinstmoegliche Reparaturschnitt?
urteil: "Belegte Ursache, isoliert reproduziert: JEDER Fleet-Event-Text endet mit dem Token `$FLEET_SELF_TOKEN.`; in der Codex-TUI oeffnet ein cursor-benachbartes `$`-Token das Mention-Overlay (`no matches` / `Press enter to insert or esc to close`), und dieses Overlay FRISST das Enter. Der Composer behaelt die volle Nutzlast, Fleet rollt sie korrekt zurueck (`rollback cleared`) und wiederholt — fuenfmal identisch, dann `blocked` am Cap. Kontrolllauf mit identischer 308-Zeichen-Nutzlast OHNE `$` wird sofort abgeschickt; Kontrolllauf mit `$`-Token NICHT am Ende ebenfalls. Betroffen sind fuenf Stellen (lane-signals.ts:274,291; server.ts:6264,6271,10497), damit report/merge/audit/deploy/command-job/supervisor-transition/lane-ready und der Migrate-Nudge. Auf Slot 3 wurden 9 von 9 Events NIE zugestellt (deliveredAt: null); jeder Claude-Empfaenger im selben Ledger lieferte bei attempts=1."
bereich: [zustellung, harness, codex, verify]
belege: [fleet.json#events, audit.jsonl:38929-38933, audit.jsonl:38975-38979, server.ts#sendText, server.ts#fleetReportMessage, server.ts#recoverFleetReportDelivery, server.ts#recordFleetReportNonAcceptance, composer.ts#composerRows, lane-signals.ts#eventAck, lane-signals.ts#laneWatchMessage, acceptance-probe.ts, docs/messungen/ernte-arbeit-worktrees-2026-08-26.md:214-217]
nicht-gemessen: Der Fix selbst (nicht implementiert, nicht gefahren); Pi-Composer gegen `$`; jede Live-Pane (nie gelesen, nie beschrieben); ob der Migrate-Nudge auf Slot 3 je feuerte; ob `@` denselben Ausloeser hat; der 400-Randfall der Merge-Watch (nur aus Code abgegrenzt, nicht reproduziert); Codex-Verhalten unter anderer Terminalbreite als 200
stand: 2026-09-05
---

# D0 — Warum die Reports die Codex-MAIN nicht erreichten

Lane-HEAD `535fa05`, `main` bei Messbeginn `1388caf`. Einzige geschriebene Datei: diese.

**Warum es diese Zustellabstraktion ueberhaupt geben soll:** ein Agent hat keinen Posteingang,
sondern einen Composer — die einzige gerenderte Tatsache, die "angekommen" von "getippt" trennt,
ist ob dieser Composer nach dem Enter geleert wurde; genau das misst `server.ts#sendText`, und
genau deshalb darf die Schicht existieren. Der Befund unten ist kein Argument gegen sie: sie hat
den Fehlschlag korrekt erkannt, ehrlich `send-uncertain` geschrieben, ihre eigene Nutzlast
zurueckgerollt und nie `delivered` behauptet. Sie hat ihn nur nicht ERKLAERT.

## 1. Die Belegkette am konkreten Fall

`fleet.json` (gelesen 2026-09-05 ~11:05 und ~11:24; die Datei bewegte sich zwischen den Lesungen,
MAIN hat inzwischen quittiert):

| Stufe | Befund |
|---|---|
| Report gespeichert | `0791092a8689a17e1266e0c9` / `f23422ef8ec7ce7a52b79ea8`, Text 3834 bzw. 3997 Zeichen |
| Event gemintet | `c65dfee12cb97c4e38e340a2` (createdAt 1788590233033), `78096980ed86c8777cfee583` (1788593330216) |
| Empfaenger | Slot 3, `harness: "codex"`, `model: "astra"`, openedAt 1788588759699 — Tripel stabil, nie gewechselt |
| Zustellversuch | 5 Versuche je Event, alle `not accepted` |
| Agenteneingang | keiner: `deliveredAt: null` bei allen |
| ACK | erst 1788593990xxx, per Hand durch MAIN — nicht durch Zustellung |

**Der entscheidende Ledger-Beleg** (`audit.jsonl:38929-38933`, fuenfmal buchstabengleich, und
:38975-38979 fuer das zweite Event):

```
prompt not accepted — composer still holds 195 chars after 3000ms; Fleet payload rollback cleared
```

Zwei Dinge daran sind das Fundament: `195` ist ueber BEIDE Events und alle zehn Versuche
identisch — also keine Eigenschaft des Report-Textes; und `rollback cleared` heisst laut
`server.ts#rollbackOwnComposerPayload`, dass `composerHoldsExactly` die **vollstaendige** Nutzlast
im Composer wiedergefunden und exakt so viele BSpaces gesendet hat. Der Composer hielt die ganze
Nachricht. Das Enter hatte nichts bewirkt.

**Der gepastete Text ist NICHT der Report.** `server.ts#fleetReportMessage` (server.ts:6267) baut
einen 308 Zeichen langen Einzeiler ohne Zeilenumbruch, der auf
`… using x-fleet-self-token from $FLEET_SELF_TOKEN.` endet. Fuer beide Events exakt 308 Zeichen —
was die konstanten 195 als erste, an der Panebreite umbrechende Composerzeile erklaert
(`composerResidue` liest bei `kind:"glyph"` genau die letzte `›`-Zeile, also die erste Reihe).

**Der Kontrast im selben Ledger:** von 41 `fleet-report`-Events gingen alle an
Claude-Empfaenger adressierten bei `attempts: 1` mit `deliveredAt` durch — bei gleicher
Groessenordnung des Report-Textes. An Slot 3 wurden **9 von 9** Events (3 report, 3 merge, 3 audit)
nie zugestellt. Der Diskriminator ist der Empfaenger-Harness, nicht die Nutzlast.

## 2. Die ausgefuehrte isolierte Reproduktion

Eigene Fixture, eigener tmux-Socket `fleetprobeA`, eigenes `CODEX_HOME` (nur `auth.json` kopiert +
Trust-Eintrag fuer das Scratch-Verzeichnis), Pane 200x50, `codex --sandbox read-only`,
codex-cli **0.153.4** (das Repo pinnt Messungen auf 0.147.0 — Versionsdrift, siehe §6).
Ablauf je Fall wie `sendText`: `load-buffer` → `paste-buffer -p` → 150 ms → Frame → `send-keys
Enter` → 3000 ms → Frame. Skript und Nutzlasten:
`…/scratchpad/probe.sh`, `payA.txt`, `payB.txt`, `payC.txt`; Frames unter `…/scratchpad/out/`
(absolute Basis:
`/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260905091307-b710/cf590708-c74f-4bf5-b775-937942059ae9/scratchpad`).

Alle drei Nutzlasten sind exakt 308 Zeichen, einzeilig, und unterscheiden sich NUR im Schwanz.

**A — Schwanz `… from $FLEET_SELF_TOKEN.`** (`out/A.prepaste-enter.txt`, `out/A.after3s.txt`):

```
› [probe] INERT reproduction line for a Fleet delivery test. Do nothing at all; reply …
  xxxxxxxx… using x-fleet-self-token from
  $FLEET_SELF_TOKEN.

  no matches

  Press enter to insert or esc to close
```

`cmp` der beiden Frames: **byte-identisch**. Das Enter wurde vom `$`-Mention-Overlay verschluckt,
nichts abgeschickt, der Composer haelt die vollen 308 Zeichen. Das ist der Live-Fehlschlag.

**B — identisch, aber `FLEET_SELF_TOKEN` ohne `$`** (`out/B.*`): Composer geleert, Turn
abgeschickt, Codex antwortet `OK`. Frames unterscheiden sich.

**C — `$FLEET_SELF_TOKEN` vorhanden, aber NICHT am Ende** (`out/C.*`): ebenfalls abgeschickt. Der
Ausloeser ist also **positionell**: er feuert, wenn das `$`-Token an der Cursorposition steht — nach
einem Paste ist das das letzte Token.

## 3. Warum die Schleife stumm war

`composer.ts#composerRows` toleriert unterhalb der Composer-Leerzeile genau drei bekannte
Chrome-Formen — darunter woertlich `no matches` und `Press enter to insert or esc to close`. Das
offene Overlay ist damit kein Grund, den Composer als unlesbar zu melden: der Reader liefert die
Reihen, `composerHoldsExactly` passt, der Rollback meldet `cleared`, und
`server.ts#recordFleetReportNonAcceptance` stuft genau darauf `retryable` ein. Fleet wiederholt
also exakt denselben Paste, der exakt denselben Popup oeffnet, bis
`FLEET_REPORT_RECOVERY_MAX_ATTEMPTS` (5) greift. Jede Stufe verhaelt sich vertragsgemaess; keine
Stufe sieht das Overlay.

Zwei Nebenbefunde aus demselben Code, beide nur code-abgeleitet:
- **merge/audit haben gar keinen Recovery-Pfad.** `recoverFleetReportDelivery` (server.ts:10557)
  wirkt nur auf `kind === "fleet-report"`; die sechs Nicht-Report-Events auf Slot 3 blieben bei
  `attempts: 1` liegen. Fuer sie ist der Cap nicht das Problem — es gibt keinen zweiten Versuch.
- **`migrateMessage` (server.ts:10497) endet ebenfalls auf `$FLEET_SELF_TOKEN.`**, wird aber OHNE
  `rollbackOwnPayload` gesendet (server.ts#tickMigrate). Auf einer Codex-MAIN bliebe der Text im
  Composer stehen und wuerde jede spaetere Zustellung mit `composer occupied` abweisen; ausserdem
  zaehlt `tickMigrate` einen geworfenen Send nicht als Nudge, wiederholt also unbegrenzt. Nicht
  gemessen, ob das auf Slot 3 je feuerte.

Der Befund selbst ist nicht neu: `docs/messungen/ernte-arbeit-worktrees-2026-08-26.md:214-217`
meldet ihn als "nicht gefixt, gemeldet". Neu ist die Reproduktion und die Zaehlung des Schadens.
Warum ihn keine Suite fing: die Codex-Zelle in `acceptance-probe.ts` sendet einen langen
Einzeiler, der auf `Reply with exactly the word OK.` endet — ohne `$`-Schwanz. Die Sonde war gruen,
weil sie die eine Eigenschaft der echten Nachricht nicht trug.

## 4. Der Reparaturbrief (ein Schnitt, nicht implementiert)

**Aenderung:** kein von Fleet komponierter Pane-Text endet auf ein `$VARNAME`-Token. Fuenf Stellen,
je ein Wort:

| Datei | Stelle | Symbol |
|---|---|---|
| `lane-signals.ts` | :271-291 | `laneWatchMessage` (`ack`), `eventAck` (merge/audit/deploy/command-job) |
| `server.ts` | :6258-6272 | `supervisorTransitionMessage`, `fleetReportMessage` |
| `server.ts` | :10493-10498 | `migrateMessage` |

`$FLEET_SELF_TOKEN` → `FLEET_SELF_TOKEN` (Prosa: "aus der Umgebungsvariablen FLEET_SELF_TOKEN").
Belegt durch Fall B und positionsunabhaengig. Die Alternative "Token nur weg vom Zeilenende"
(Fall C) ist ebenfalls belegt, aber bricht beim naechsten Umformulieren still.

**Wirkung:** Codex-Empfaenger nehmen Event-Zustellungen bei `attempts: 1` an. Claude/Fable
unveraendert (dort gingen 10 Live-Zustellungen mit demselben Schwanz durch).

**Ausdruecklich NICHT Teil des Schnitts:** Timeouts oder `FLEET_REPORT_RECOVERY_MAX_ATTEMPTS`
hochsetzen. Fuenf buchstabengleiche Fehlschlaege sind der Beweis, dass Wiederholung dieses
Zustands nichts kaufen kann. Ebenso wenig ein Anfassen von `recordFleetReportNonAcceptance` —
sein `retryable` war ueber dem gemessenen Rollback korrekt.

**Regressionstest, drei Ebenen:**
1. *Pin (deterministisch, im Land-Gate)* — `e2e/pins.ts`: kein Pane-Text-Literal in `server.ts` /
   `lane-signals.ts` endet auf `/\$[A-Z][A-Z_]*[.\s]*$/`. Faengt die ganze Familie und jede
   kuenftige Nachricht, kostet Millisekunden, braucht keine TUI.
2. *Frame-Pin* — `e2e/watch.ts` neben den vorhandenen Composer-Reader-Pins (:256-352): der Frame
   aus `out/A.prepaste-enter.txt` als Fixture; erwartet `composerResidue !== ""` UND
   `composerRows(...)` liefert die Reihen. Das haelt fest, WARUM der Rollback `cleared` sagte und
   die Schleife stumm blieb.
3. *Echte TUI* — `acceptance-probe.ts`, Codex-Block: eine Zelle mit der echten
   `fleetReportMessage`-Form, Erwartung `acceptance === "observed"`.

Die vier vom Brief geforderten Faelle: **leerer/ruhender Codex-Composer → Report wirklich
angenommen** = (3), heute nicht abgedeckt. **Besetzter/waehrend await geaenderter Composer → nichts
ueberschrieben** = bereits `acceptance-probe.ts` (Codex "owner draft"-Zelle) plus die
`sameBoundPane`-Kette in `sendText`; von diesem Schnitt unberuehrt. **Slot-Recycle → kein falscher
Empfaenger** = `server.ts#receiverStillMatchesFleetEvent` + `fleetEventReceiver`; unberuehrt.
**Unsichere Annahme → kein falsches delivered/ACK, kein blindes Mehrfach-Submit** = genau das
Verhalten, das hier korrekt griff; der Schnitt darf es nicht anfassen, (1) haelt die Ursache
stattdessen vorne fest.

**Bewertung des gemeinsamen Pfades:** Claude *apply* (Textaenderung harmlos, kein Overlay
gemessen) · Codex *apply* (dies IST der Fix) · Pi *apply als Text, als Defekt not-applicable*
(Composer `kind:"rules"`, `$`-Verhalten UNGEPRUEFT). Report/merge/audit sowie
deploy/command-job/supervisor-transition/lane-ready: *apply*, sie teilen `eventAck`.
`clarification-request` traegt das Token schon in der Mitte → *not-applicable* als Defekt (Fall C),
wird aber gleich mitgezogen. `clarificationReplyMessage`/`attentionAnswerMessage`: *not-applicable*,
kein Sigil.

## 5. Abgegrenzter Randfall (keine gemeinsame Reparatur)

`POST /api/self/tasks/17b75e3a/land` gab `watch {kind:"merge",target:9}`; die unmittelbar folgende
Registrierung bekam 400 `target slot not active`. Aus dem Code: `server.ts:5291` prueft `!t.cwd`
BEVOR die persistierte Merge-Identitaet aufgeloest wird — eine Merge-Watch auf eine bereits
gelandete und abgeraeumte Lane kann strukturell nie scharf werden. Anderer Mechanismus (Rennen
zwischen Land-Abschluss und advisory Watch-Hinweis), nicht reproduziert, kein gemeinsamer Schnitt.

## 6. Grenzen und laufende fremde Arbeit

Nicht geprueft: der Fix (nicht geschrieben, nicht gefahren); Pi gegen `$`; `@` als moeglicher
zweiter Ausloeser; ob `tickMigrate` auf Slot 3 feuerte; andere Panebreiten. Keine Live-Pane
gelesen oder beschrieben, kein Live-Send, keine Audit-Adjudikation. Die Reproduktion lief auf
codex-cli **0.153.4**; `server.ts` dokumentiert seine Composer-/Readiness-Messungen gegen
**0.147.0** — die Chrome-Zeile lautet heute `gpt-6-astra default · <cwd>`, und `default` steht
NICHT in der `known`-Effort-Liste von `composer.ts#composerRows`; auf einem Slot mit dieser
Statuszeile lieferte der Reader `null` statt Reihen. Eigener, hier nicht verfolgter Befund.

Aktive fremde Arbeit, nicht angefasst: Task `2de16229` (Program 79036e9a) an der
pi-unfenced-Watch-Familie in `e2e/watch.ts` — der Frame-Pin oben faellt in dieselbe Datei und
gehoert danach eingeplant. Lane `ec0bf175` (Fleet-Betrieb) am Lifecycle.

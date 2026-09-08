---
frage: Tragen Erstellung, Sichtbarkeit, Zustellung, Receipt und Entscheidung an den Inbox-/Report-Naehten denselben autorisierten Gegenstand ueber Succession, Recycle und Restart?
urteil: Der Record- und Entscheidungsvertrag traegt; die Anfrage-Schiene (Attention-Antwort, Clarification-Reply) beweist ihren Occupant nach dem canDeliver-Await nicht neu und ueberschreibt dabei ein nebenlaeufiges refused, und der Empfaenger einer program-losen Lane wird aus einer self-beschreibbaren Tabelle nominiert.
bereich: [contract, security, program-inbox, fleet-report, attention, succession]
stand: 2026-09-08
nicht-gemessen: Keine ausgefuehrte Security-Suite an diesem Baum, kein Live- oder Scratch-Probelauf, keine Schreib-/Angriffsprobe, kein vollstaendiger Blattmodul-Sweep, kein S4-Flake-/Mutex-Anteil.
---

# S3 — Contract/Security an den Inbox-/Report-Naehten

Program `eec695280b9ca5a84824eec0`, Astra Review-Lane, `claude/claude-opus-5[1m]/high`.
Kandidaten-SHA dieser Lesung: **`178eb78df9349e117a53c637f19aa4b5cf1ab948`** (Worktree sauber vor der Notiz).
Alle Zeilenangaben unten gelten an genau diesem Baum; undatierte Verweise nennen zusaetzlich das Symbol.

Diese Abstraktion soll bestehen, weil ein Program mehrere MAIN-Occupants ueberlebt, ein Report aber
einen Occupant adressiert: die Trennung von dauerhaftem Gegenstand (Program, Report-Zeile,
Inbox-Zeiger) und sterblichem Transportendpunkt (Occupant-Tripel, FleetEvent) ist genau der Grund,
warum es hier ueberhaupt zwei Objektklassen gibt — und jede Naht, an der beide verwechselt werden,
ist der Fehler, den diese Review sucht.

## Gelesene Bereiche

Vollstaendig gelesen (kein Ueberfliegen, kein Namensschluss):

- `server.ts`: `appendProgramInbox` (1509–1523) · `latestReportFor` (1748–1761) · `reconcileClarifications` (6447–6465) · `fleetEventReceiver` (6467–6471) · `markFleetEventReceiverGone` (6574–6590) · `clarificationReceiverFor` (6387–6431) · `refuseClarification` (6433–6445) · `openClarification` (6592–6650) · `fleetReportsFor` (6652–6661) · `reportReceiverLiveness` / `reportAwaitsOwner` (6674–6683) · `pruneFleetReports` (6775–6792) · `openFleetReport` (6814–6896) · `replyClarification` (6898–6979) · `acknowledgeFleetEvent` (6981ff) · `decideFleetReport` (7056–7110) · `ownerDecideFleetReport` (7113–7178) · `fleetReportOwnerView` (7186–7192) · `dropWatchesFor` (7212–7231) · `pruneAttention` (7246–7256) · `boundProgramForMain` (7524–7534) · `inboxProgramFor` (7543–7550) · `inboxSubject` (7559–7568) · `programInboxView` (7572–7585) · `programInboxStatus` (7588–7593) · `programInboxFor` (7595–7599) · `readProgramInboxEntry` (7607–7629) · `releaseTaskForMain` (7643ff) · `refuseAttention` (8225–8232) · `reconcileAttention` (8237–8249) · `attentionOwnerView` (8254–8261) · `answerAttention` (8263–8329) · `teardownSlotOccupant` (4883–4956) · `killSlot` (4958–4978) · `sendText` (5351–5411ff) · `createWatchForSlot` Ziel-Zweige (5700–5760) · `recoverFleetReportDelivery` (11699–11772) · `tickWatches` FACT 1/2/3 (11774–12025) · Self-Routen-Dispatch (25150–25270) · Boot-Reconcile (22805–22834) · State-Restore der Slots (22480–22525) · `succeedProgramMain` Kopf (21089–21135) · `readJson` (19762–19770) · Rename-Route (28056–28063).
- `server/types.ts`: FleetEvent-Decoder-Regeln (247–263, 270–320, 522–560) · `FleetReport` + Basis-Allowlist (426–460, 583–592) · `ProgramInboxKind`/`ProgramInboxEntry`/`ProgramInbox` (1679–1700) · `loadProgramInboxEntry` (1701–1739) · `loadProgramInbox` (1745–1767).
- `e2e/pins.ts`: Clarification-/Attention-Ordnungs-Pins (470–511) · Recovery-Ordnungspin latch<guard<send (3751–3775) · `clarificationReceiverFor`-Pins (4306–4330) · Boot-Reconcile-Pin (4350–4360) · D1b-Receiver-Pin (4511–4515) · Inbox-Loader- und Writer-Pin (6655–6672).
- `e2e/security.ts`: Routenliste mit ihren Vertragskommentaren (60–150).
- `e2e/watch.ts`: lane-watch-Empfaengerfamilie (1390–1570), Report-/Recovery-Fixtures (1860–2340) gezielt.
- Vor eigenem Urteil aus `main:` gelesen: `docs/messungen/2026-09-07-adressierbarkeit-vertrag.md` (vollstaendig, Pin `e917a48b`), `docs/messungen/2026-09-review-aussen-nach-innen.md` (vollstaendig), `docs/messungen/2026-09-07-datenvertraege-umsetzungsplan.md` §Mindestform/C0/C1/C2, `docs/messungen/INDEX.md` gezielt.

Nicht gelesen und darum ohne Aussage: `src/client.ts`-Rueckleseseite der Inbox/Report-Zeilen,
`e2e/programs.ts` ausser den in der Vorgaengernotiz zitierten Fixture-Zeilen, `context-plan.ts`,
`program-phase.ts`, die uebrigen Blattmodule, der Land-/Deploy-Pfad.

## Was seit `e917a48b` geschlossen ist (nicht erneut als Befund gezaehlt)

Die Vorgaengernotiz vom 2026-09-07 nannte fuenf Luecken. An `178eb78d` gilt:

| Vorgaengerbefund | Stand heute | Beleg |
|---|---|---|
| 2 · unentschiedener Report bleibt am toten Receiver haengen | **geschlossen** durch eine eigene Owner-Tuer | `server.ts#ownerDecideFleetReport:7132` refuest bei lebendem Receiver und uebernimmt sonst; `#fleetReportOwnerView:7186` macht die Zeile ueberhaupt erst sichtbar |
| 3 · Retention konnte einen unentschiedenen Report wegkuerzen | **geschlossen** | `server.ts#pruneFleetReports:6784` haelt jede Zeile mit `reportAwaitsOwner(report)` explizit zurueck |
| 4 · gelerntes `sessionId` sperrt den eigenen Entscheid aus | **auf der Report-Schiene geschlossen** | `#decideFleetReport:7076` und `#fleetReportsFor:6657` vergleichen bewusst nur `slot`+`openedAt`; die Session-Id steht auf `decision.by` als Beleg |
| 1 · fehlender Producer | **offen**, unveraendert | siehe B4 |
| 5 · Autos/Watches ohne dauerhaften Senderabschluss | nicht Gegenstand dieses Schnitts | — |

Der Record-Layer der Inbox ist an diesem Baum sauber und braucht keinen Befund: `loadProgramInbox`
(server/types.ts:1745) erzwingt geschlossenen Schluesselsatz, `v:1`, `PROGRAM_INBOX_MAX`,
Nicht-Negativitaet von `dropped`, Duplikatfreiheit der Ids und die Paarigkeit von `readBy`/`readAt`
(1734–1736) — ein halber Receipt ist ein Ladefehler, kein reparierter Datensatz.

## Contract-Matrix je Naht

`erwartet` ist aus `AGENTS.md`/Scope und dem angenommenen Vertragsentwurf abgeleitet, nicht aus
beobachtetem Ist-Verhalten. `belegt` heisst: am gelesenen Code nachgewiesen. `unknown` heisst:
strukturell nicht aus Quelllesung entscheidbar oder ohne Laufbeleg.

| Naht | Erwartet | Belegt | Unknown / Kosten |
|---|---|---|---|
| **Erstellung Report** | Identitaeten serverseitig abgeleitet, kein Body-Feld nominiert Empfaenger, geschlossene Feldmenge, Deckel | ja — `#openFleetReport:6815` (nur `status`+`text`), `:6817` Enum, `:6821–6823` leer/Laenge, Empfaenger nur ueber `#clarificationReceiverFor:6387`, Budget `:6850` (Owner-Inbox) / `:6852` (Slot) | Der Empfaenger einer **program-losen** Lane stammt aus Watch-Zeilen, die jede Nicht-Lane selbst schreiben darf → **B2** |
| **Erstellung Inbox-Zeiger** | genau ein Schreiber, gedeckelt, `dropped` zaehlt | Schreiber existiert und ist gepinnt (`e2e/pins.ts:6667`) | **kein Aufrufer am Baum** → Erstellung produktiv NIE ausgefuehrt → **B4** |
| **Sichtbarkeit Report** | nur exakter Worker oder Receiver | ja — `#fleetReportsFor:6652`, Doppelscope Worker/Receiver bei `:6661`, `openedAt`-gebunden | Nachfolge-MAIN sieht nur 4 abgeleitete Felder (`#latestReportFor:1748`), nie den Text; nach Retirement ist die Zeile **owner-only** und das steht in keiner Regel → **B5** |
| **Sichtbarkeit Inbox** | Program-gebunden, Succession aendert nichts, fremdes Program benannt verweigert | ja — `#inboxProgramFor:7543` (Lane 409, dann `#boundProgramForMain:7524` mit Aktiv- und Eindeutigkeitspruefung), `#readProgramInboxEntry:7616–7620` trennt „fremdes Program" von „unbekannt" | `audit-red` rendert `subject:null` **ohne** `unknown`-Zeile und hat keinen Join → **B3** |
| **Zustellung (Event-Schiene)** | vor jedem Send nach einem Await der exakte Occupant neu bewiesen | ja fuer Recovery — `#recoverFleetReportDelivery:11735–11737` Latch → `receiverStillMatchesFleetEvent` → Send, **gepinnt** in `e2e/pins.ts:3761`. FACT 2 liest nach seinem Latch (`:11940`) `event.status` (`:11941`) und `laneEventSubject` (`:11942`) neu, was einen Receiver-Teardown ueber `markFleetEventReceiverGone` mitfaengt | Restfenster in FACT 2 ist nur das `saveStateNow` bei `:11954` — sub-ms, hier **nicht** als Befund gezaehlt |
| **Zustellung (Anfrage-Schiene)** | dieselbe Regel | **nein** — `#answerAttention:8294` und `#replyClarification:6933` awaiten `canDeliver` und senden danach ohne jede Neupruefung → **B1** |
| **Receipt** | Receipt ist kein ACCEPT; erster Leser gewinnt; kein Ueberschreiben | ja — `#readProgramInboxEntry:7621` gibt `existing:true` zurueck und schreibt nichts; `#acknowledgeFleetEvent` ist Transport, `#decideFleetReport` ist fachlich, zwei Routen | — |
| **Entscheidung** | genau einmal, nur autorisierter Principal, Owner-Zeile hat keine Session | ja — `#decideFleetReport:7064` (owner-inbox 409), `:7076` (Occupation), `:7092` first-wins; `#ownerDecideFleetReport:7138` (lebender Receiver 409), `:7153` first-wins ueber **beide** Tueren | `e2e/security.ts:124` beschreibt die Regel dieser Tuer falsch → **B5** |
| **Succession** | Leserecht folgt dem Program, Quittung des Vorgaengers bleibt | Inbox ja (Program-gebunden, `#inboxProgramFor` liest zur Lesezeit neu); Report nein (Occupant-gebunden, Owner-Tuer als Ausgang) | Waehrend der Grace-Frist kann **nur** die scheidende MAIN entscheiden, danach **nur** der Owner — die Nachfolge nie → **B5** |
| **Recycle** | kein Post an einen Ersatz allein wegen gleicher Slotnummer | Event-Schiene ja (`#fleetEventReceiver:6467` vergleicht alle drei Felder; Teardown terminalisiert ueber `#dropWatchesFor:7215`) | Anfrage-Schiene: der Slot-Objektzeiger wird ueber den Await gehalten, Teardown mutiert **dasselbe Objekt** (`#teardownSlotOccupant:4883`) → **B1** |
| **Restart** | malformed/leer faellt geschlossen aus, Verlust bleibt unterscheidbar | ja — `loadProgramInbox`/`loadProgramInboxEntry` (server/types.ts:1701–1767); Boot terminalisiert Events mit totem Receiver (`server.ts:22807–22815`), reconciled Clarifications/Attentions (`:22819`, `:22823`) | Codex-Slot mit nicht-UUID-`sessionId` wird beim Boot genullt (`:22512`) und verliert danach Event **und** Attention — bekannte D2-Familie, Traeger `e88884c8` |
| **malformed/null/empty** | benannt verweigert, nie stillschweigend repariert | ja — Report-Body (`:6815–6823`), Decision-Body (`:7079–7087`), Inbox-Id ueber Pfad-Regex `[0-9a-f]{24}` (`:25218`), Watch-Ids/Shas in `#createWatchForSlot` | — |
| **fehlender Empfaenger** | benannt, kein erfundener Principal | ja — owner-inbox-Fallback eng geschnitten (`:6845–6853`), Owner-Zeile bekommt keine Session (`:7064`, `:7158` `by: "owner"`) | Fallback wird durch **eine einzige** fremde Watch-Zeile unterdrueckt → **B2** |
| **fehlendes referenziertes Objekt** | als `unknown` benannt, nie als Leere | ja fuer `attention-answer`/`fleet-report` (`#inboxSubject:7565`) | nein fuer `audit-red` (`:7560`) → **B3** |
| **fremdes Program/Repo** | benannt verweigert | ja — `#readProgramInboxEntry:7616`, `#releaseTaskForMain` Program-Vergleich, `#latestReportFor:1755` joint auf `taskId` **und** `programId` | — |
| **Doppelentscheidung** | zweite Entscheidung 409, Zeile unveraendert | ja, ueber beide Tueren | — |
| **Doppelzustellung** | ein Event, ein Versuchszaehler, gedeckelte Recovery | ja — `FLEET_REPORT_RECOVERY_MAX_ATTEMPTS` an einer Stelle definiert (`:2478`) und ueber `fleetReportRecoveryExhausted` (`:6481`) einmal gefragt, Rollback nur bei `cleared` (`:6504`) | — |

Client-/Ruecklese-Seite (`src/client.ts`) und die Probes ausserhalb der oben genannten Bereiche:
**nicht geprueft**, kein apply/unsupported-Urteil.

## Fuenf Befunde, rangiert

### B1 — Die Anfrage-Schiene beweist ihren Occupant nach dem Await nicht neu und ueberschreibt dabei ein nebenlaeufiges `refused`

`server.ts#answerAttention:8284–8310` und `server.ts#replyClarification:6923–6950`.

Beide pruefen das Occupant-Tripel (`:8285`, `:6924`), awaiten dann `canDeliver` (`:8294`, `:6933`)
— das schreibt zu `ps`/`pgrep` aus, also ein echtes, nicht sub-ms-Fenster — und senden danach
(`:8310`, `:6950`) **ohne** die Bedingung noch einmal zu lesen. Der Schwesterpfad auf derselben
Transportschicht tut genau das Gegenteil: `#recoverFleetReportDelivery` setzt zwischen `canDeliver`
und `sendText` `receiverStillMatchesFleetEvent(event, receiver, expected)` (`:11736`), und die
Reihenfolge Latch < Guard < Send ist in `e2e/pins.ts:3761` festgenagelt. FACT 2 liest nach seinem
Latch wenigstens `event.status` und `laneEventSubject` neu (`:11941`, `:11942`) mit einem Kommentar, der
genau diese Gefahr benennt („THE WORLD ABOVE WAS VALIDATED BEFORE AN AWAIT, AND IT MOVES INSIDE
ONE"). Die Anfrage-Schiene hat weder Guard noch Pin: die Pins bei `e2e/pins.ts:477`, `:489` und `:508`
sichern ausschliesslich die **Reihenfolge** des Crash-Markers und die Terminalworte.

Der Schaden braucht **keine** Neubelegung des Slots. Faellt der Requester waehrend `canDeliver`
weg, laeuft im Teardown `#dropWatchesFor:7220–7221` → `#reconcileAttention:8237` →
`#refuseAttention:8225`, und die Zeile steht korrekt auf `refused` mit
`refusedReason:"requester session ended"`. Danach kehrt `answerAttention` zurueck, sieht bei `:8302`
nur `status !== "send-uncertain"` und schreibt `status="send-uncertain"`, `refusedReason=null`,
`closedAt=null` (`:8303–8306`). `sendText` wirft anschliessend („slot unavailable for send",
`:5354`), der Handler antwortet 409 „stays send-uncertain" — und die Zeile bleibt **dauerhaft**
nicht-terminal: `#pruneAttention` raeumt nur `answered|refused`, und `#reconcileAttention` laeuft
nur beim Boot und beim Teardown, der fuer diesen Slot schon vorbei ist. In `#attentionOwnerView:8256`
zaehlt `send-uncertain` als Rang 0, also als offen. `replyClarification` ist zeichengleich
(`refuseClarification` → Ueberschreibung bei `:6941–6947`, `pruneClarifications` terminalisiert
ebenfalls nur `answered|refused`).

Kommt der Slot im selben Fenster neu hoch, ist die zweite Haelfte erreichbar: `#teardownSlotOccupant`
mutiert **dasselbe** Slot-Objekt (`:4911` `s.openedAt = 0`, `:4925` `s.worktree = null`, `:4954`
`s.cwd = null`), `#openSlot:4706` rotiert bei `:4792` den Self-Token **im selben Objekt** — die im Handler
gehaltene Referenz `requester`/`worker` zeigt danach auf den Ersatz-Occupant. `#sendText:5353`
faengt das nicht ab: es nimmt seinen Occupant-Schnappschuss bei seinem **eigenen** Eintritt und
prueft nur noch Aenderungen ab da. Dann geht der Antworttext in eine fremde Pane, und
`replyClarification:6969` schreibt zusaetzlich `worker.awaiting = null` auf den Fremden.

**Kosten.** Ohne Neubelegung: eine offene Owner-Frage, die die Maschine bereits korrekt als tot
abgeschlossen hatte, steht dauerhaft als „Antwort ist vielleicht in der Pane" in der Owner-Sicht und
ist von keiner Route mehr zu schliessen — genau die Ununterscheidbarkeit von „wartet noch" und
„kommt nie", gegen die dieser Kanal gebaut wurde. Mit Neubelegung: Zustellung an einen Ersatz allein
wegen gleicher Slotnummer, plus ein Statusschreiben (`awaiting`) auf einen fremden Principal.

**Gegenprobe.** Zwei Schnitte, beide klein:
(a) *Quell-Ordnungspin, sofort baubar, deterministisch* — in `e2e/pins.ts` neben `:3761`:
`answerAttention`/`replyClarification` enthalten zwischen dem `await canDeliver(` und dem
`await sendText(` einen Re-Read der Zeile (`request.status`) **und** des Occupant-Tripels.
(b) *Verhaltensprobe* — braucht eine neue Latch in genau diesem Fenster, dem Muster von
`waitForFleetReportRecoveryTestLatch:5293` nachgebaut (`FLEET_TEST_ATTENTION_ANSWER_LATCH`); an der
Latch halten, den Requester-Slot toeten, freigeben, dann pruefen: die Zeile bleibt `refused` mit dem
urspruenglichen `refusedReason`, die Route antwortet 409, und `attentionOwnerView` zeigt sie als
terminal. Ein bestehender Latch trifft dieses Fenster nicht — `FLEET_TEST_SEND_BEFORE_PASTE_LATCH`
sitzt **innerhalb** von `sendText`, also nach dem Schnappschuss, und `FLEET_TEST_SLOT_TEARDOWN_LATCH`
liegt vor `dropWatchesFor`.

**Falsifizierende Mutation.** Guard entfernen ⇒ (a) rot. Guard nur auf `request.status` statt auch
auf das Tripel ⇒ der Recycle-Arm von (b) rot. Guard vor statt nach `canDeliver` ⇒ beide gruen,
obwohl nichts gewonnen ist — deshalb muss (a) die **Position** relativ zum `await` pruefen, nicht
nur die Existenz.

**Traeger.** Kein bestehender Task deckt das ab: `18e87e67` ist die Report-Rueckgabe, `e88884c8` die
Codex-Identitaet, `c62aa3e9` der adressierte Rueckweg. Enger Folgebrief-Schnitt: *„Anfrage-Schiene
erhaelt den Occupant-Re-Proof der Event-Schiene: Pin + Latch + zwei Probes, kein weiterer Umbau."*

### B2 — Der Report-Empfaenger einer program-losen Lane wird aus einer self-beschreibbaren Tabelle nominiert

`server.ts#clarificationReceiverFor:6408–6427` fuer die Ableitung, `server.ts#createWatchForSlot:5703–5724`
fuer das Schreiben, `server.ts#openFleetReport:6845` fuer die Folge.

Fuer eine Lane **mit** `programId` gewinnt die Programmbindung, ausdruecklich und vor jeder
Watch-Lesung (`:6405`) — dort ist der Empfaenger unbestreitbar. Fuer eine Lane **ohne** `programId`
— nach `docs/messungen/2026-09-07-datenlayer-ordnung-bericht.md` die Mehrheit der aktuellen Lanes,
weil `FLEET_DISPATCH_MAX_LANES=1` Handdispatches erzwingt — ist die einzige Evidenz eine
`{kind:"lane"}`-Watch-Zeile. `#createWatchForSlot` prueft an dieser Stelle: Ziel existiert, ist
aktiv, ist eine Lane, ist nicht der Steward, ist nicht der Aufrufer selbst, hat eine automatisierbare
Harness (`:5705–5722`). Es prueft **nicht**, ob der Abonnent irgendeine Beziehung zu dieser Lane
hat. Jede Nicht-Lane-Session darf abonnieren — die MAIN eines beliebigen anderen Programs, der
Steward, ein Controller.

Wer als einziger abonniert hat, ist damit `basis:"lane-watch"`-Empfaenger: er bekommt den vollen
Reporttext in die Pane gepastet (`#fleetReportMessage:6808`), sieht die Zeile in
`#fleetReportsFor:6652` und haelt die ACCEPT/REJECT-Tuer (`#decideFleetReport:7076`) ueber Arbeit,
die ihm nie gegeben wurde. Die „laute Verweigerung", auf die sich der Kommentar bei `:6838` beruft,
greift nur bei **mehreren** verschiedenen Abonnenten (`:6421`, „lane-watch evidence names multiple
receiver occupants") — ein einzelner Fremder gewinnt sauber und still. Zusaetzlich unterdrueckt seine
blosse Anwesenheit den Owner-Inbox-Fallback, denn der verlangt exakt `NO_RECEIVER_EVIDENCE`
(`:6848`): der Owner faellt aus dem Pfad, den dieser Fallback fuer ihn gebaut hat.

Das ist **kein unbemerkter Defekt** — `e2e/watch.ts:1530` prueft das Verhalten als gewollt
(„a non-program lane routes to its fresh exact Watch subscriber"). Der Befund ist, dass die
Autorisierung selbst unbegrenzt ist und nirgends als Regel steht, waehrend derselbe Code an jeder
anderen Stelle betont, dass kein Body-Feld einen Empfaenger nominieren darf (`:6890`,
`e2e/security.ts:105`). Hier nominiert ein Body-Feld (`target`) ihn doch — nur auf einer anderen
Route und zu einer frueheren Zeit.

**Korrektur einer Quellangabe im Code:** der Kommentar `server.ts:6832` schreibt, eine Watch
„armed only to manufacture receiver evidence" werde „von `b6956c9` korrekt verweigert".
`git log -1 b6956c9` sagt etwas anderes: dieser Commit verweigert `{kind:"lane"}`-Watches auf
**nicht-automatisierbare Harnesses**. Er bindet Abonnent und Ziel in keiner Weise aneinander.

**Kosten.** Ein Worker-Report (bis `MAX_FLEET_REPORT_TEXT`) geht an den erstbesten Abonnenten statt
an den Owner, und die fachliche Annahme/Ablehnung dieser Arbeit wird dort getroffen. Reputationell
harmloser, operativ nicht: eine `accepted`-Zeile ist die Vorbedingung der Land-Tuer
(`server.ts:6685`, `THE ACCEPTANCE PRECONDITION AT THE LAND`), first-wins ist endgueltig, und der Owner sieht die Zeile danach nicht mehr als
`reportAwaitsOwner`.

**Gegenprobe.** In `e2e/watch.ts` neben `:1530`: Program-lose Lane; MAIN eines **fremden** aktiven
Programs armt `{kind:"lane", target:<lane>}`; Lane filet ihren Report. Erwartet nach Fix:
`basis:"owner-inbox"` (bzw. eine benannte 409), nicht `lane-watch` mit dem Fremden als Receiver; die
fremde MAIN erhaelt auf `/api/self/fleet-report` keine Zeile und auf `…/accept` eine benannte 409.

**Falsifizierende Mutation.** Die Beziehungspruefung wieder entfernen ⇒ der Fremde wird erneut
Receiver, der Check wird rot. Nur den Mehrfach-Abonnenten-Fall pruefen (heutiger Stand) ⇒ der
Ein-Abonnenten-Arm bleibt rot, was genau den Unterschied misst.

**Traeger.** Kein bestehender Task. Folgebrief-Schnitt: *„Wer darf Empfaenger einer program-losen
Lane sein? Regel festlegen (Owner-Inbox als Default, Abonnement nur mit belegter Beziehung), eine
Probe, kein zweites Ledger."* Vorher ist eine **Owner-Entscheidung** faellig, denn die heutige
Weite kann gewollt sein.

### B3 — `audit-red` ist die eine Inbox-Art, deren fehlender Gegenstand als Schweigen rendert

`server.ts#inboxSubject:7559–7568`, Zeile `:7560`.

Fuer `attention-answer` und `fleet-report` gibt der Join bei fehlender Zeile
`{subject:null, unknown:"entry … names a … row that is no longer present (retention)"}` zurueck —
richtig, weil beide Quellen gedeckelte Tails sind. Fuer `audit-red` gibt er
`{subject:null, unknown:null}` zurueck, begruendet mit: „its writer and its ledger join arrive
together in the audit slice, so a line saying 'no longer present' would report a retention loss that
never happened."

An diesem Baum existiert weder das eine noch das andere. `rg -n 'audit-red' server.ts src/client.ts`
liefert **genau zwei** Treffer, beide in diesem einen Zweig (`:7556` Kommentar, `:7560` Code) — kein
Schreiber, kein Audit-Slice-Join, keine Client-Darstellung. Ein `audit-red`-Zeiger rendert heute
also als Eintrag ohne Gegenstand und ohne Erklaerung: ununterscheidbar von „da ist nichts". Das ist
exakt die Antwort, die `loadProgramInbox` in seinem eigenen Kopfkommentar (server/types.ts:1740–1744)
verbietet: „A repair would turn 'these pointers were lost' into 'there were never any', which is the
one answer this record may never give."

**Kosten.** Solange kein Schreiber existiert, ist der Schaden latent. Er wird beim Landen des
Audit→Program-Schreibers (`288f6359`) sofort real: dessen Zeilen kommen an einem Leser an, der sie
stumm schluckt, und der erste Beleg dafuer waere eine MAIN, die einen roten Audit nicht sieht.

**Gegenprobe.** Fixture in `e2e/programs.ts` neben den bestehenden gepflanzten Inbox-Eintraegen
(`:1776–1812`): ein `audit-red`-Eintrag mit einem `ref`, zu dem kein Ledgerbeleg existiert.
`GET /api/self/inbox` muss ihn mit einer benannten `unknown`-Zeile ausliefern — oder mit einem
gejointen Audit-Fakt. `unknown:[]` bei `subject:null` ist der rote Fall.

**Falsifizierende Mutation.** Die `unknown`-Zeile fuer `audit-red` wieder entfernen ⇒ rot. Den
Join einbauen und die `unknown`-Zeile fuer den Fall „Ledgerzeile vorhanden" weglassen ⇒ der
Positivarm bleibt gruen, der Negativarm rot — das trennt „gejoint" von „stumm".

**Traeger.** `288f6359` (Audit → Program). Diese Notiz **schlaegt vor**, den Leser-Fix in dessen
Brief aufzunehmen, statt einen eigenen Task zu eroeffnen.

### B4 — Erstellung ist an diesem Baum weiterhin ohne Aufrufer; der Pin dagegen bleibt gruen

`server.ts#appendProgramInbox:1509`. Gezaehlt an `178eb78d`:
`rg -c 'appendProgramInbox\(' server.ts` = **1** (die Definitionszeile), und ein repo-weites `rg`
findet ausser dieser Definition nur Kommentare (`server/audit-log.ts:275`, `server/types.ts:1686`,
`:1695`) und den Pin selbst. Der Befund der Vorgaengernotiz vom 2026-09-07 (Pin `e917a48b`) gilt am
2026-09-08 unveraendert.

Neu ist die Beobachtung zum **Beweismittel**: der einzige Pin ueber diesem Record
(`e2e/pins.ts:6667`, `RULE_INBOX — appendProgramInbox is the only writer`) prueft
`writers === 1`, also die Zahl der `program.inbox = `-Zuweisungen im Server-Universum. Diese
Bedingung ist bei **null** Aufrufern genauso gruen wie bei einem korrekten Producer: der Pin sichert
Einzigkeit, nicht Erreichbarkeit. Ebenso beweisen die Succession-/Scope-Fixtures in
`e2e/programs.ts` den Leser gegen **gepflanzte** Eintraege — sie koennen einen Producer, der das
falsche `kind`, den falschen `ref` oder das falsche Program schreibt, strukturell nicht sehen.

**Kosten.** Die gesamte Kette Erstellung → Sichtbarkeit ist produktiv **unbewiesen**, nicht bewiesen-
gut. Jede Aussage der Form „die Program-Inbox traegt die Nachricht ueber die Succession" ist heute
eine Aussage ueber eine leere Flaeche. Konkret heisst das fuer die Pruefrage dieses Schnitts:
`GET /api/self/inbox` liefert an `178eb78d` fuer jedes Program `entries:[]`, `unread:0`, `dropped:0`.

**Gegenprobe.** Beim Landen des ersten Producers: derselbe fachliche Akt (Attention beantworten bzw.
Report entscheiden) muss genau einen Eintrag mit dem richtigen `kind` und einem aufloesbaren `ref`
erzeugen, und der Pin muss zusaetzlich **mindestens einen Aufrufer** verlangen.

**Falsifizierende Mutation.** Producer-Aufruf entfernen ⇒ der erweiterte Pin rot, der heutige gruen —
das ist der Unterschied, den diese Zeile misst.

**Traeger.** `c464af30` (Attention-Schreiber), `417d2be5` (Report → Program), `288f6359` (Audit →
Program). **Nicht** hier implementieren.

### B5 — Zwei Vertragsaussagen beschreiben den heutigen Code falsch, beide in Richtung „strenger als er ist"

(a) `e2e/security.ts:124` sagt ueber `POST /api/self/fleet-report/:id/(accept|reject)`: „the receiver
triple is compared inside the handler **the way replyClarification compares** a clarification's".
`#decideFleetReport:7076` vergleicht `slot` und `openedAt`; `#replyClarification:6923–6925`
vergleicht alle drei einschliesslich `sessionId`. Die beiden Tueren folgen seit dem Slot-12-Fund
(2026-09-07) **verschiedenen** Regeln, und das ist gewollt und im Code ausfuehrlich begruendet
(`:7065–7075`). Die Sicherheitsaussage des Satzes („a replaced MAIN session at the same slot is
refused") bleibt wahr — ein Ersatz-Occupant traegt ein neues `openedAt`. Falsch ist die Begruendung.

(b) `server.ts:6832` schreibt `b6956c9` eine Verweigerung zu, die dieser Commit nicht enthaelt
(siehe B2).

**Kosten.** Beide Saetze zeigen einen kuenftigen Haerter auf die falsche Invariante. Bei (a) ist die
naheliegende „Konsistenz-Reparatur" — `sessionId` in `decideFleetReport` wieder aufnehmen — genau
die Regression, die am 2026-09-07 gemessen und behoben wurde: eine MAIN, die einen Report empfangen
hat, koennte ihn nicht mehr entscheiden, und die Owner-Tuer waere zu, weil der Occupant lebt. Bei (b)
lehnt sich der Owner-Inbox-Fallback auf einen Schutz, den es nicht gibt.

**Gegenprobe.** `e2e/pins.ts`: der Vertragssatz in `e2e/security.ts` fuer diese Route darf
`replyClarification` nicht als Vergleichsregel nennen, solange die beiden Praedikate verschieden
sind — oder, staerker und billiger: ein Pin, der die **Feldmengen** beider Vergleiche extrahiert und
verlangt, dass ein Text, der sie gleichsetzt, nicht existiert.

**Falsifizierende Mutation.** `sessionId` in `#decideFleetReport` wieder aufnehmen ⇒ der bestehende
D1b-Pin (`e2e/pins.ts:4511`) wird rot; das ist der vorhandene Schutz und er greift. Der neue Pin
schuetzt die **Prosa**, die heute ungeschuetzt ist.

**Traeger.** Kein Task. Zwei Kommentarzeilen, gehoeren als Anhaengsel in den naechsten Schnitt an
dieser Naht (B1 oder B2), nicht in eine eigene Lane.

## Was ich nicht messen konnte, und der benannte Folgeprobe-Schnitt

- **Ein tatsaechlicher Race-Beleg fuer B1** ist aus Quelllesung strukturell nicht zu holen und mit den
  vorhandenen Latches nicht deterministisch herstellbar (Begruendung und Latch-Position oben). Der
  Schnitt lautet: eine Latch im Muster von `waitForFleetReportRecoveryTestLatch`, zwei Probes, ein
  Ordnungspin. Fuenfmaliges Rerollen einer nichtdeterministischen Probe waere hier wertlos.
- **Client-/Ruecklese-Seite** (`src/client.ts`) und die uebrigen Blattmodule: nicht gelesen, kein Urteil.
- **Der Anteil der Anfrage-Schiene an realen Vorfaellen**: `audit.jsonl` traegt `attention_refused`
  mit Grund, aber der Uebergang refused→send-uncertain hinterlaesst **keine** Trailzeile (die
  Ueberschreibung bei `:8303` schreibt kein `audit(...)`). Historische Haeufigkeit deshalb `unknown`,
  nicht „null Vorfaelle". Ein Zaehler dafuer waere Teil des B1-Schnitts.

## Laufbelege

**Diese Lane hat keine Security-Suite ausgefuehrt.** Quelllesung belegt keinen ausgefuehrten
Security-Test; die Befunde oben sind Vertrags- und Abdeckungsluecken, mit denen eine gruene Suite
vollstaendig vertraeglich ist.

Ausgefuehrt in dieser Lane (Kurzkette, reine Docs-Aenderung — `GET /api/self/gate` meldete
`localProof.steps` voll bei leerem `classifiedAs`, weil zum Abfragezeitpunkt kein Diff existierte;
der serverseitige Gate klassifiziert am Diff):

```
$ bun install --frozen-lockfile
9 packages installed [56.00ms]

$ bun e2e/pins.ts
…
ALL PASS
```

Fremdbeleg, an SHA/Host/Lauf gebunden — **nicht** meiner: der letzte Post-Land-Audit mit voller
Kette lief am Tree `d832a679cfe2d79ff1402f95bb31f404767be576` auf dem Helfer `second-host`
(`jobId 26ea1a205005`, `at 1788857901963`, `ms 2431197`), `checks.ran 4033`, `failed 0`,
Originaltail aus `post-land-audits.jsonl`:

```
PASS  trail: a passing check's row carries no detail  (…"tree":"d832a679cfe2d79ff1402f95bb31f404767be576","dirty":false…)
ALL PASS
```

Dieser Lauf ist fuer meine Lesung bindend, weil `git diff --stat d832a679 178eb78d` ausschliesslich
`HANDOFF.md` und `docs/suite-contention.md` nennt — `server.ts`, `server/types.ts` und alle
`e2e/`-Module sind zwischen beiden Baeumen byte-gleich, und `d832a679` ist Vorfahre von `178eb78d`
(`git merge-base --is-ancestor` = 0). Der Audit an meinem eigenen HEAD `178eb78d`
(`at 1788861769463`) ist **gruen, aber kurzkettig** (`short: true`) und hat `e2e/security.ts`
folglich **nicht** ausgefuehrt. Die Per-Check-Trail-Datei des vollen Laufs liegt auf `second-host` und
nicht auf dieser Maschine; nur der Ledger-Tail oben ist lokal belegbar.

Keine Land-SHA in dieser Notiz: eine Lane kann ihre eigenen Commit-Shas nach dem Rebase-Land nicht
kennen. Die Integration setzt sie ein, falls sie gebraucht werden.

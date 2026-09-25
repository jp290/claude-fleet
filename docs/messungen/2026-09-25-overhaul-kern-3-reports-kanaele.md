# Kern 3 — Kommunikation Agenten ↔ Owner: Befund

Stand 2026-09-25 ~14:15, HEAD `07e998e9`. Nur gelesen: kein Schreib-Call, kein /send, kein Server.
Zeiträume: `audit.jsonl` 09-20 11:56 – 09-25 14:15 (≈5,1 Tage, 13 816 Zeilen) · `fleet-reports.jsonl`
09-14 14:58 – 09-25 14:13 (601 open, 591 decision) · `fleet.json` Momentaufnahme.

Sollte die Abstraktion existieren? Ja. Ein Mehr-Agenten-System braucht adressierte, quittierte
Nachrichten mit Besitzer. Das Problem ist nicht zu viel Mechanik, sondern dass die wichtigste
Nachricht (der Startbrief) auf dem schwächsten Transport fährt: einmal per Paste, ohne Rückweg.

## 1. Kanalkarte

| Kanal | Sender → Empfänger | Persistenz | Quittung | Gemessen (Zeitraum oben) |
|---|---|---|---|---|
| Fleet-Report (`fleet-reports.jsonl`) | Lane → Program-MAIN / Owner-Inbox | Ledger + `fleet.json` | Entscheidung (accepted/rejected + reason) | 601 open; Median bis zum Urteil 26,8 min, p90 12 615 min (bimodal, siehe F3) |
| Report-Verdikt zurück an die Lane | MAIN/Regel → Lane-Pane | Ledger-Zeile | keine | 158 zugestellt, 222 nicht zugestellt (140 „lane ended“, 56 „recycled“) |
| FleetEvent (watch/merge/audit/lane-suite) | Server → Slot-Pane oder Owner-Inbox | `fleet.json` events, geprunt | `./ctl.sh events --ack` / Owner-Ack | 412 Watch-Events: 404 zugestellt, 7 unsicher, 410 quittiert; Fire→Zustellung Median 3,4 s, p90 27 s; Zustellung→Ack Median 0,1 min |
| Watch (`/api/self/watch`) | Session abonniert, Server feuert | `fleet.json` watches | einmaliges Feuern → Event | 526 `watch_fire`, 49 `watch_superseded`, 2 `watch_skip`, 0 `watch_expire` |
| Auto (`/api/self/autos`) | Session → eigene Pane (Timer) | `fleet.json` autos | keine | 17 `auto_fire`, 3 `auto_skip`; aktuell 0 Autos |
| Attention (`/api/attention`) | MAIN/Stall-Sensor → Owner | `fleet.json` + Program-Inbox | answered/refused | 150 geöffnet (85 Sensor, 62 selbst, 3 Kriterium); Median bis Antwort 38,5 min |
| Program-Inbox | Server → Program-MAIN | Program-Record | read | 437 append / 434 read |
| POST /send (Owner) + geparkter Send | Owner/Orchestratorin → Pane | nur Audit + Transkript; geparkt: prozesslokal | Acceptance | owner: 118 observed / 204 unobservable / 38 SendRefused; `send_parked` 4 Zeilen |
| Gründungs-/Nachfolge-Brief (Paste) | Server → neue Session | Audit-Zeile; bei Fehlschlag Succession-Debt | Acceptance (s. F2) | 53 In-place-Nachfolgen seit 09-22 09:42 (20 generic, 33 Program) + 14 Lane-Nachfolgen; 1 abgelehnt (heute) |
| Linien-Record (`GET /api/self` → `lineage`) | Vorgängerin → Nachfolgerin (Pull) | `fleet.json` lineageHandovers (17) | keine | 17 Records, 15 mit `intent`, Pflichten ≠ 0 in 2 |
| Succession-Debt + Owner-Inbox-Event | Server → Owner | `fleet.json` successionDebts | Owner-Resend | 1 offen (`fa7892d8`), Event `40e389f0` Status `inbox`, nicht quittiert |
| migrateMessage / migrate-nudge | Server → Controller-Pane | nur Audit | keine | 40 observed |
| HANDOFF.md | Session → Nachfolgerin/Owner | git | keine | 4 Commits seit 09-20, 12 in 09-14…09-19 (Regel A wirkt) |
| dispositions.jsonl | Owner → Enhance-Worker | Datei | – | 2 Zeilen, beide 2026-07/08; tot |

## 2. Startbrief bei der Nachfolge (Slot 9, heute)

**Verifiziert, Ablauf aus `audit.jsonl`:**
- 14:12:34 `main_succession 9 generic respawned in place (… 1790324974505 → 1790338354198)`
- 14:12:38 `send 9 succession 0B SendRefused`
- 14:12:38 `main_succession 9 generic brief-undelivered: brief failed: composer occupied (17 chars) — nothing typed`
- 14:12:38 `succession_debt … fa7892d825f0260520d9f07d … brief held (3565 chars), owner inbox 40e389f03df3037444726ea8`
- Erste Nutzerzeile im Transkript der Nachfolgerin (`2d6822ba…jsonl`) um 12:13:45Z: „irgendwie hat die
  succession nicht geklappt, ich war währenddessen am schreiben“. Die 17 Zeichen waren also Text des Owners.
- Der Linien-Record 09-25 14:12 für `0fdc0bf9`, Slot 9, mit `intent` liegt in `fleet.json`. Der Brief hätte
  darauf verwiesen: „die Übergabe ist der Linien-Record 0fdc0bf9… (GET /api/self, Feld `lineage`)“.

**Mechanismus (Code):**
1. `server.ts#handleSelfSucceed`: `respawnInPlace` beendet die Vorgängerin und öffnet die Nachfolgerin. Danach
   `writeLineageHandover`. Erst dann kommt die Zustellung: `Bun.sleep(FOUNDING_BOOT_GRACE_MS)` (4000 ms,
   `server.ts:8288`), `canDeliver`, `waitForFoundingReadiness`, und genau **ein** `sendText(s, brief, true,
   {path:"succession"})`.
2. `server.ts#sendText` liest vor dem Paste den Composer. Steht dort Text, wirft es `SendComposerOccupied`
   (Kommentar: „an occupied composer is an owner draft“). Es wird nichts getippt.
3. Der Catch ruft `failed()`, also `recordSuccessionDebt`: Der Brief wird gehalten, es entsteht eine
   Owner-Inbox-Zeile, und der Aufrufer bekommt eine 500. Laut Kommentar an `recordSuccessionDebt` erreicht diese
   500 niemanden, weil die Pane des Aufrufers schon beendet ist.
4. Es gibt **keinen zweiten Versuch**. Für genau diese Ablehnung existiert bereits ein Warte-Mechanismus:
   `tickParkedSends`/`parkSend` (`POST /send whenFree`) und die Event-Holds (`holdBackoffMs`). Der
   Nachfolge-Pfad nutzt keinen davon.
5. Nachsenden ist nur über die Owner-Route möglich: `POST /api/succession-debts/:id/resend`
   (`server.ts#resendSuccessionDebt`). Sie macht ebenfalls genau einen `sendText`-Versuch und scheitert an
   einem belegten Composer genauso.
6. Einen Pull-Weg gibt es nicht. `grep -c lineage` ergibt in `CLAUDE.md` und `AGENTS.md` jeweils **0**. In
   `.claude/settings.json` gibt es keinen SessionStart-Hook. Eine Nachfolgerin ohne Brief erfährt also nicht,
   dass ein Record auf sie wartet.

**Warum paralleles Tippen den Brief verliert:** Das Board leitet Owner-Tastendrücke per WS in die neue Pane. In
den ≥4 s Boot-Grace plus Readiness-Wartezeit reichen 17 Zeichen, damit die einzige Composer-Probe „belegt“
meldet. Die Schutzregel „nie in einen Owner-Entwurf pasten“ ist richtig. Sie ist aber als endgültiger Abbruch
gebaut, nicht als Warten.

## 3. BLEIBT (wirkt nachweislich)

- **Watches als Rückkanal:** 404 von 412 Watch-Events zugestellt, Median 3,4 s. Nur 2 `watch_skip` bei 526
  Fires. Die Level-Trigger-Semantik (`server.ts` Watch-Tick, „FACT 1“) trägt.
- **Die Event-Ack-Schleife:** 410 von 412 quittiert, Median 0,1 min nach Zustellung. Das Ack ist faktisch eine
  Transportquittung, keine Aussage über eine Handlung (gefolgert aus der Latenz).
- **Program-Inbox:** 437 append, 434 read.
- **Linien-Record als dauerhafter Beleg:** Er überlebte den heutigen Zustellausfall unverändert.
- **Pre-Paste-Schutz vor fremdem Composer-Text** (`SendComposerOccupied`) und der Paste-Deckel mit Datei-Umweg
  (`PASTE_MAX_BYTES`, `storePaneInboxText`).
- **Regel A (HANDOFF nur bei echter Nachfolge):** 12 HANDOFF-Commits in 09-14…09-19, 4 seit 09-20.
- **Supersede für Owner-Inbox-Reports** (`server.ts#closeSupersededReports`) und die **Report-Delegation**
  (`server.ts` `effectiveDelegate`, seit 09-24): Die Delegation schließt die frühere Lücke, dass Urteile der
  Orchestratorin als `by:"owner"` im Ledger standen.

## 4. ÄNDERN (nach Wirkung gerankt)

**F1: Der Startbrief ist ein einziger Push ohne Warten und ohne Pull-Rückfall.** Belege stehen in §2.
*Kosten:* Die Nachfolgerin arbeitet ohne Übergabe, obwohl der Record intakt ist. Der Owner muss den Ausfall
selbst bemerken; das Debt-Event `40e389f0` steht ungelesen auf `inbox`. Das Risiko fällt bei jeder der ≈16
Nachfolgen pro Tag an (53 in ~3,2 Tagen), sobald jemand in die frische Pane tippt. *Richtung:* (a) Einen
belegten Composer auf dem Nachfolge-Pfad an `parkSend` übergeben statt an die Debt; der Pin auf den Occupant
existiert dort schon. (b) Ein Pull-Anker, der unabhängig vom Paste greift: ein SessionStart-Hook oder eine
Rulebook-Zeile „erste Handlung: `GET /api/self` → `lineage`“. (c) Optional: das Board sperrt die Eingabe
während des Gründungsfensters.

**F2: Die Acceptance-Sonde ist bei großen Briefen blind.** Sendungen ≥ 8 kB: 16 von 219 `observed` (7 %). Die
letzte war 09-21 03:04. Seit 09-21 sind alle `succession`- und `founding`-Sendungen `unobservable` (Liste
`audit.jsonl`). Grund laut Code (`sendText`, Kommentar zum 20.09. 23:45): Als `observed` zählt nur noch eine
`arrival === "complete"`. Gefolgert, nicht geprüft: Claude Code faltet große Pastes zusammen, sodass
`complete` nie gelesen wird. *Kosten:* Ein verlorener Brief sieht im Ledger genauso aus wie ein zugestellter.
Nur eine Ablehnung vor dem Paste (wie heute) wird sichtbar. Der Verlust vom 20.09. stand als `observed` im
Ledger. *Richtung:* Die Quittung auf der Empfängerseite holen: eine Nonce im Brief, die per Self-Route bestätigt
wird, oder den sha des Briefs im Session-Transkript nachsehen.

**F3: Program-Reports ohne lebende MAIN laufen voll, und nichts bremst die Lane.** 89 `complete`-Reports aus
einer Lane (`fleet/260915151443-70a2`, Slot 7, Program `247a3746` Private-repo-aa) kamen am 09-15 zwischen 17:30
und 21:23, Median-Abstand 127 s, 89 verschiedene Texte. 95 Reports dieses Programs wurden am 09-24 13:30 in
einem Zug abgelehnt, Latenz Median 12 626 min (≈8,8 Tage). `closeSupersededReports` greift nur bei `basis
=== "owner-inbox"`, und `reportReceiverLiveness` gibt ohne gebundene MAIN `gone` zurück. *Kosten:* ≈4 h
verbrannte Lane und ein Stapel von 96 `reportsAwaitingOwner`. Die Lane bekam nie „niemand liest“ zurück.
*Richtung:* Supersede auch auf Program-Zeilen ohne lebende MAIN anwenden. Die Report-Tür antwortet der Lane
ausdrücklich „kein lebender Empfänger“, dazu ein Rate-Limit pro Branch.

**F4: Das Rulebook widerspricht dem Code bei Composer-Text, und heute hatte der Code recht.** `CLAUDE.md`
(Supervisor-Abschnitt) sagt: „ungesendeter Text im Composer … nie ein Owner-Entwurf“, und nennt die
Vorsichtsregel „WIDERLEGT“. `sendText` und `SendComposerOccupied` behandeln ihn als Owner-Entwurf. Das heutige
Transkript belegt Owner-Text. *Kosten:* Eine Session, die dem Rulebook folgt, darf den Composer leeren und damit
Owner-Text löschen. Der Code gilt. Das Rulebook-Fragment braucht eine Korrektur über propose/promote.

**F5: Die Attention-Zahlen sind maschinell aufgebläht und falsch zugeschrieben.** 85 von 150 Opens kommen vom
Stall-Sensor. 75 von 140 „answered“ sind die Selbstschließung des Sensors, mit `answer.by: "owner"`
(`server.ts#closeStallAttention`). *Kosten:* Jede Auswertung „wie schnell antwortet der Owner / die
Orchestratorin“ ist etwa zur Hälfte Sensor-Rauschen. Das Ledger behauptet Owner-Handlungen, die es nicht gab.
*Richtung:* ein eigenes `by: "sensor"` oder eine eigene Art `stall`.

**F6: Bei der Nachfolge werden Watches nicht übertragen, nur benannt.** `dropWatchesFor` löscht
`w.slot === slotId`. `captureLineageObligations` listet sie per ID mit `reArm: "POST /api/self/watch"`, und der
Brief sagt „nichts ist neu armiert“. Gemessen: Pflichten ≠ 0 in 2 von 17 Records (09-22 20:41: 3 report,
2 inbox, 1 watch; 21:50: 3 report, 1 watch). *Kosten:* Zusammen mit F1 bleibt ein Merge- oder Audit-Ausgang
unzugestellt, und niemand weckt die Nachfolgerin. Die Häufigkeit ist klein. *Richtung:* Bei einer In-place-
Nachfolge auf demselben Slot die Watches auf den neuen `openedAt` umbinden, statt sie zu löschen.

**F7: Report-Verdikte an Lanes sind überwiegend Ritual.** 222 nicht zugestellt gegenüber 158 zugestellt. 140
davon „lane ended“, 56 „recycled“. Die 193 `accepted-by-land`-Urteile entstehen, nachdem die Lane fertig ist.
*Kosten:* Ledger-Rauschen (`fleet_report_decision_undelivered`), keine verlorene Information. *Richtung:*
Zustellung gar nicht erst versuchen, wenn der Worker nicht mehr lebt; als `n/a` buchen.

**F8: Das strukturierte `fulfilled` geht bei Sammelurteilen verloren.** `fulfilledFromReason` erwartet
`ERFUELLT:` an Position 0. Die 95 Sammelurteile beginnen mit „Orchestratorin Slot 9 …“ und haben daher
`fulfilled: null`. Gesamtverteilung: 455 null, 112 ja, 23 teilweise, 1 nein. *Kosten:* Eine Auswertung
„Anteil erfüllt“ untertreibt oder fällt aus. Klein.

**F9: `dispositions.jsonl` ist tot.** 2 Zeilen, beide enhance/ignored aus Juli/August. Der Schreiber existiert
noch (`server.ts:226` `DISPOSITION_FILE`, e2e-Proben). *Kosten:* Pflege ohne Nutzen. Nicht geprüft habe ich,
ob die Route `/api/dispositions` noch einen Aufrufer hat.

## 5. FEHLT: „Wer wartet auf mich, auf wen warte ich?“

`GET /api/self` liefert `slot, label, cwd, mission, awaiting, lane, idleMs, observed, autos, watches, events,
lineage` (`server.ts:38347` ff.). Das ist nur die **ausgehende** Hälfte: meine Watches, meine Autos, meine
Events. Es fehlt:
- **Eingehend:** welche Watches anderer Slots auf mich zielen (`target === mein Slot`), welche geparkten Sends
  auf meinen Composer warten (`parkedSendView` gibt es nur für das Board), welche Succession-Debt für mich
  offen ist (heute `fa7892d8`, nur über die Owner-Route lesbar).
- **Ausstehend:** welche Reports ich urteilen muss und welche Attention-Zeilen ich gestellt habe, die noch offen
  sind, samt Alter, zusammen in einer Sicht.
- **Ein Pull-Einstieg**, den jede neue Session unabhängig vom Paste bekommt (siehe F1b).
Ein Agent, der das wissen will, müsste heute mindestens 4 Routen und `fleet.json` zusammenlesen.

## 6. Zahlen (Zeitraum und Quelle)

- Nachfolgen: 53 In-place (`main_succession … respawned in place`, 09-22 09:42 – 09-25 14:12; 20 generic,
  33 Program), 14 Lane (`lane_succession … session=`), 1 `brief-undelivered` (heute). Die Archive
  `audit.jsonl.1` und `.archive` enthalten 0 `brief-undelivered`.
- Sends (09-20 – 09-25): `succession` 8 observed / 36 unobservable / 1 refused. `founding` 2 / 44. ≥ 8 kB
  16 / 203 unobservable.
- Reports: 601 open (477 complete, 94 needs-main, 30 handoff). Urteile: 193 Regel `accepted-by-land`, 232 durch
  die MAIN (Median 3–5 min), 139 durch das Owner-Token (davon 95 Sammelurteil 09-24). Unentschieden: 37 (19
  needs-main, 16 handoff, 2 complete), die ältesten 208 h.
- Attention: 150 open, 140 answered (75 vom Sensor), 10 refused. Aktuell 1 offen.
- Events: 880 IDs gesehen, 778 quittiert. 102 ohne Ack geprunt, davon 5 receiver-gone und 4 unsicher. Die
  übrigen 92 habe ich nicht klassifiziert; wahrscheinlich wurden sie vor dem Fensterbeginn quittiert
  (ungeprüft). 119 `send_uncertain`, davon 115 später quittiert.
- `owner_token_ambient_use` 101 (98 `task=… program=… via=bearer`).

## 7. Nicht geprüft

- Ob `readComposer` eine Platzhalter- oder Vorschlagszeile von Claude Code als Text liest. Heute ist der Fall
  durch das Transkript als echter Owner-Text belegt, allgemein nicht geprüft.
- Die Ursache von F2 (Paste-Faltung). Gefolgert, nicht an einer Pane gemessen.
- `succeedProgramMain`, `succeedSupervisor` und `succeedLane` im Detail. Nur die generische Schiene habe ich
  vollständig gelesen. Die Debt-Aufrufe in `server.ts:32446` und `33434` zeigen, dass sie dieselbe Debt-Form
  nutzen.
- `migrateRailOf` und `migrateMessage` (`server.ts:20130`, `20355`) nicht gelesen, nur Audit-Zahlen.
- Der Inhalt von `docs/self-api.md` außer der Grep-Trefferzahl, AGENTS.md außer dem `lineage`-Grep.
- Clarifications (18 Zeilen, 5 open/answered im Fenster) und Messages (21 append / 15 read) nicht vertieft.
- Wie lange Owner-Inbox-Events im Mittel bis zum Owner-Ack brauchen: nur 20 `fleet_event_owner_ack` im
  Fenster, nicht ausgewertet.

# Triage-Batch B-rueckkanal — Rückkanal, Session-Lebenszyklus, Watch/Ping/Deploy

**10 Zeilen.** Erzeugt 2026-08-09 aus `fleet.json` (gitignored — deshalb steht der Text hier).
Der Auftrag, das Urteilsvokabular und die Beweisregeln stehen in `docs/triage/README.md`. **Lies die zuerst.**
Die als „wörtlich“ markierten Zeilentexte bleiben inhaltlich unverändert; reine Dokumentpfade
folgen späteren Regal-Moves, damit sie weiterhin auflösen.

---

## `58d03512`  ·  kind=lane  ·  angelegt 2026-08-09 11:11  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rueckkanal, ENTSCHEIDUNG VOR BAU] Der Busy-Gate der Zustellung erreicht nur eine PARKENDE Session — jeder weitere Kanal erbt diesen Fehler. Analyse: docs/attic/rueckkanal-2026-08-09.md §0.

BEFUND (Code gelesen, nicht hergeleitet): `canDeliver` (server.ts:3573) entscheidet in Zeile 3596 `now - s.lastOutput < idleMs => busy`. `lastOutput` ist ein BYTE-Sensor; eine arbeitende Claude-Code-Pane repaintet ihren Spinner, ist also nie idle. Gemessen von Queue-Zeile fc47f1e1 (2026-08-09, erste Live-Nutzung des Watch): Slot 9 idleMs=64ms mitten in einer 10-min-Kette ohne sichtbare Ausgabe; der Watch blieb ~25 min armed, waehrend sein Ziel-Praedikat 818 s true stand. ALLE fuenf Nachrichten-Ticks laufen durch diese eine Klausel (Aufrufstellen: server.ts:5846 auditPing, 5913 backlogNudge, 5973 migrate, 6051 watch, 10410 steward).

WARUM DAS EINE ENTSCHEIDUNG UND KEIN BUG IST: ein Prompt, der mitten in einen Turn getippt wird, kann im Composer stehenbleiben, ohne dass ein Turn laeuft — genau die Fehlerform von 94b1362 (sendText) und c845a392 (Respawn ohne Settle). "Sofort zustellen" ist also nicht selbstverstaendlich besser.

ZU ENTSCHEIDEN, bevor irgendwer baut (darum Entwurf, kein Auftrag):
 (a) Ist der Spinner-Repaint ueberhaupt als Pane-Ausgabe gewollt, oder braucht es einen ZWEITEN Sensor ("arbeitet an einem Tool-Call") neben dem Byte-Sensor?
 (b) Oder wartet die Zustellung auf die Turn-Grenze statt auf Byte-Stille?
 (c) fc47f1e1 nennt zusaetzlich: es gibt KEINE Route, einen Watch zu entwaffnen/umzuhaengen (kein DELETE) — der dokumentierte idleSec:0-Opt-out ist damit unerreichbar, sobald ein Watch mit idleSec>0 auf dasselbe Ziel existiert. Diese Zeile und fc47f1e1 gehoeren SERIALISIERT, sie beruehren dieselbe Flaeche.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): eine Nachricht (Watch ODER Audit-Ping) erreicht eine Session, die zum Zeitpunkt des Ereignisses AKTIV in einer Werkzeugkette steht, innerhalb von <= 2 min — belegt an einer echten Pane, nicht an einer Fixture. Gegenprobe, gleichrangig: der zugestellte Prompt startet einen Turn (steht nicht im Composer), belegt ueber prompts.jsonl UND die Pane.

VERIFY-WEG: ./e2e-isolated.sh (e2e/watch.ts ist die Familie) plus eine Live-Probe an zwei Slots. Wer den Sensor anfasst, faehrt zusaetzlich ./e2e-claude-gate.sh (sendText-Pins liegen dort).

NICHT ANFASSEN: der Byte-Sensor `lastOutput` traegt AUCH die stalled-Uhr (lane-signals.ts, STALLED_RULES) und die unobserved-Regel (lastOutput===0 ist UNBEKANNT, nie idle — server.ts:5842, 6045). Ein zweiter Sensor darf diese Semantik nicht mitverschieben.
```

## `29829dac`  ·  kind=lane  ·  angelegt 2026-08-09 11:12  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rueckkanal] Das Deploy-Verdikt hat KEINEN Empfaenger — `ok:false`/`ok:null` heisst "gelandeter Code ist nicht live", und niemand erfaehrt es. Analyse: docs/attic/rueckkanal-2026-08-09.md §2 Ereignis 3.

BEFUND (gemessen 2026-08-09 an HEAD 94b1362): Verb 2 ist so konstruiert, dass der Verdikt-Schreiber der NAECHSTE BOOT ist (server.ts:10969 im Regionskommentar; `judgeDeploy` schreibt nach DEPLOY_FILE ueber appendDeployRow, server.ts:11028). `DEPLOY_FILE` (server.ts:10988) wird im ganzen server.ts an genau EINER Stelle GELESEN: server.ts:11242, die Route `GET /api/deploys`. Kein Tick, kein Ping, keine Board-Karte zieht daran. Das Verdikt ist ausdruecklich DREIWERTIG und `null` ist nie ein Pass (Regionskommentar) — dieselbe Ehrlichkeit endet an der Zustellung.

WARUM ES ZAEHLT: der Zweck von Verb 2 ist, dass Landung und Live-Zustand nicht auseinanderlaufen (der Anlass war 7 Commits / 150 min Bundle-Lag, server.ts:10958). Ein fehlgeschlagener Restart wird dadurch heute erst beim naechsten `./state.sh` einer FRISCHEN Session sichtbar — also durch dieselbe Zufallsmechanik, die 7d3a309 zum Phantom-Gruen gefuehrt hat.

SCHNITT (Vorschlag): kein neuer Kanal. Die Boot-Auswertung, die den Verdikt-Row ohnehin schreibt, meldet ihn bei `ok !== true` an genau eine taugliche Main-Session — Empfaengerfilter und Ereignis-Marker BUCHSTABENGLEICH wie `tickAuditPing` (server.ts:5828-5830 Filter, setAuditPing-Muster fuer den einmal-und-nicht-verfallend-Marker). Ein `ok:true` wird NICHT gemeldet: das ist ein Board-Feld.

ABHAENGIGKEIT, die zuerst entschieden gehoert: die Zustellung erbt den Busy-Gate aus Zeile `58d03512` (docs/attic/rueckkanal-2026-08-09.md §0) — ohne dessen Antwort erreicht auch diese Meldung nur eine parkende Session. Serialisieren.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): ein Deploy, dessen Restart nachweislich nicht durchschlaegt (erzwungen: RESTART_CMD auf `true` gesetzt in einer Scratch-Instanz), erzeugt am naechsten Boot eine Zeile in `deploys.jsonl` mit `ok:false` UND genau eine Nachricht in genau einer Main-Session, die `stage`, `target`, `bootHead` und `reason` nennt. Ein `ok:true`-Deploy erzeugt KEINE Nachricht. Ein zweiter Boot schickt nichts nach.

VERIFY-WEG: `./e2e-isolated.sh` (die Deploy-Familie liegt dort; FLEET_DEPLOY_RESTART_CMD ist der Hebel fuer die Fixture) und der Pin-Lauf `bun e2e/pins.ts`. Live-Gegenprobe NICHT noetig und ausdruecklich nicht erwuenscht: ein absichtlich kaputter Live-Deploy kostet den Server.
```

## `d45898cb`  ·  kind=lane  ·  angelegt 2026-08-09 11:12  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[rueckkanal/audit] Ein "gruenes" Audit, das NICHTS gemessen hat, ist fuer den Ping unsichtbar — der Filter liest `result === "red"`. Analyse: docs/attic/rueckkanal-2026-08-09.md §2 Ereignis 2.

BEFUND: `tickAuditPing` waehlt seine Zeile mit `r.result === "red"` (server.ts:5819). `7d3a309` hat aber belegt, dass die gefaehrlichere Klasse GRUEN heisst: ein abgeschnittenes `e2e-isolated.sh` fiel mit Status 0 ans Ende, der Server buchte gruen, und `./state.sh` meldete es der naechsten Session als "newest audit: green on 613faa3c" — 1797 ms, null PASS-Zeilen. Zwei Lands haben so ein Gruen bekommen, das nichts gemessen hat. Der Commit-Body sagt es selbst: "Das ist schlechter als rot: ein Rot laesst jemanden nachsehen."

DER SENSOR IST SEIT `54ea616` DA und wird hier nur nicht gelesen: `checks: {ran, failed} | null` am Audit-Eintrag, ausdruecklich dreiwertig — `{0,0}` = "gemessen, dass nichts lief", `null` = "Ausgabe nicht auswertbar", und `null` darf NIE als 0 gelesen werden (`auditChecksOn`, server.ts:5743-5752). `3f3772b` hat die Konsequenz auf der state.sh-Seite gezogen und die Server-Seite bewusst offengelassen ("wer das schliessen will, schliesst es am Server, nicht hier").

ZU ENTSCHEIDEN, und das ist der Grund fuer den Entwurfsstatus — ZWEI Wege, sie schliessen einander aus:
 (a) Der Server bucht `result:"green"` bei `checks.ran === 0` gar nicht erst als gruen (ein neuer Wert, z.B. "unmeasured"). Ehrlicher, aber es ist eine LEDGER-Semantik-Aenderung: jeder bestehende Leser von post-land-audits.jsonl (state.sh, GET /api/post-land-audits, das Board, register.sh) muss den dritten Wert vertragen, und alte Zeilen haben das Feld nicht.
 (b) Nur der Ping-Filter wird geweitet: `red` ODER (`green` UND `checks.ran === 0`). Klein und rueckwaertskompatibel, aber das Ledger behaelt eine Zeile, die "gruen" sagt und es nicht ist.
Empfehlung der Analyse: (b) zuerst, (a) als eigene Zeile — aber der Owner entscheidet, weil (a) die ehrlichere Karte ist.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): ein Audit-Lauf, der vor dem ersten `check()` stirbt und mit Status 0 endet, erreicht innerhalb von <= 2 min genau eine Main-Session mit einer Nachricht, die woertlich sagt, dass NICHTS gemessen wurde und der Baum unverifiziert ist. Gegenprobe, gleichrangig: ein echtes Gruen (`checks.ran > 0`) erzeugt KEINE Nachricht — sonst ist der Kanal nach einem Tag Rauschen.

VERIFY-WEG: `./e2e-postland-audit.sh` (die einzige Suite, die den Ping fuehrt — sie armiert ihn selbst ueber FLEET_AUDIT_PING_MS=250, fleet-e2e-postland-audit.ts:143, und prueft die AUS-Seite bei Zeile 708). Zusaetzlich `bun e2e/pins.ts`. Bei Weg (a) zusaetzlich `./e2e-isolated.sh` und ein Blick auf jeden Leser von `post-land-audits.jsonl` (state.sh eingeschlossen — sie ist gitignored und faellt keinem Compiler auf).
```

## `08230c93`  ·  kind=lane  ·  angelegt 2026-08-09 11:12  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[autonomie/bremse] Die KETTENLAENGE ist nirgends aufgezeichnet — "laeuft seit 40 Sessions im Kreis" ist von "arbeitet" nicht unterscheidbar. Analyse: docs/attic/rueckkanal-2026-08-09.md §4.

BEFUND (Code gelesen, 2026-08-09, HEAD 94b1362): `handleSelfSucceed` (server.ts:3441-3500) oeffnet den Nachfolge-Slot mit `openSlot(free, predecessor.cwd, null, s.model, label, s.harness, s.effort, {container, containerContext})`. Uebergeben werden cwd, Modell, Label, Harness, Effort, Box — und NICHTS ueber die Kette: kein Generationszaehler, kein Vorgaenger-Feld auf dem neuen Slot, keine Ledger-Zeile. `MAX_SUCCESSION_CARRY = 500` ist ausdruecklich als "tiny bridge" begruendet (server.ts:3417), und das ist fuer INHALT richtig — die IDENTITAET der Kette ist kein Inhalt.

DIE EINZIGE SPUR: `killSlot(s, "handoff")` schreibt `audit("slot_kill", s.id, why)`. Gezaehlt in audit.jsonl: `handoff` kommt 1x vor, gegen 459 `slot_kill` insgesamt. Es gibt keinen Weg, Vorgaengerin und Nachfolgerin zu VERBINDEN — nur zwei Ereignisse mit demselben cwd zu verschiedenen Zeiten.

WARUM DAS DIE BREMSE IST, nicht der Eingang: unter Autonomie ist die teuerste Fehlerform nicht "es passiert nichts", sondern "es passiert immer dasselbe". Der Ausgang (tickMigrate + succeed, gelandet 613faa3) macht Ketten erst MOEGLICH; damit ist die fehlende Zaehlung von einer theoretischen Luecke zu einer offenen Flanke geworden. Verwandt, aber NICHT dasselbe: `succeed` antwortet mit 409 "no free slot" (server.ts:3466) — das ist eine synchrone Antwort an eine lebende Session und braucht keinen Kanal; was fehlt, ist dass niemand mitzaehlt, wie oft das schon passiert ist.

ZU ENTSCHEIDEN, bevor gebaut wird: ist "diese Kette laeuft im Kreis" ein Fakt, den Fleet FUEHREN soll — oder reicht es, die Uebergaben zaehlbar zu machen und das Urteil dem Menschen zu lassen? Die Hausdoktrin (record -> display -> advise -> gate -> act, lane-signals.ts) sagt: eintreten auf Stufe 1, wie `stalled` es getan hat. Diese Zeile schlaegt genau Stufe 1 vor und NICHTS darueber: kein Auto-Stopp, kein Nudge, keine Eskalation.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): nach drei aufeinanderfolgenden `POST /api/self/succeed` traegt `GET /api/self` eine Ketten-Id und die Generation (1, 2, 3), und ein Ledger fuehrt je Uebergabe eine Zeile mit {chainId, generation, vorherige sessionId, cwd, ts}. Gegenprobe, gleichrangig: eine Session, die OHNE succeed geoeffnet wird (Owner-Klick, dispatch, self-heal-Respawn), bekommt Generation 1 und eine NEUE Ketten-Id — ein Respawn ist keine Uebergabe. Zweite Gegenprobe: die Kette ueberlebt einen srv-Neustart (sie liegt in fleet.json, nicht im Prozessspeicher) — das ist genau der Defekt, den der Kritiker am Rueckzugs-Timer gefunden hat.

VERIFY-WEG: `./e2e-isolated.sh` (e2e/watch.ts fuehrt die Migrations-/succeed-Familie; die Suite armiert FLEET_MIGRATE_PCT=44 selbst, e2e-isolated.sh:441) plus `bun e2e/pins.ts`.

NICHT ANFASSEN: `s.openedAt` — daran haengt das succeed-Gate `handoffCommittedAfterOpen` (server.ts:3436), und c845a392 beschreibt genau diese Falle.
```

## `0ae22c2d`  ·  kind=lane  ·  angelegt 2026-08-09 11:13  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[betrieb, KEIN BAU] `FLEET_AUDIT_PING_MS` einschalten — aber NACH `4455adca`. Empfehlung mit Preis: docs/attic/rueckkanal-2026-08-09.md §5.

ZUSTAND, gemessen 2026-08-09 (nicht gelesen): `grep -c FLEET_AUDIT_PING_MS watchdog.sh` = 0, Default 0 (server.ts:5646), Tick registriert nur bei > 0 (server.ts:10186) — der Kanal, den 54ea616 heute gelandet hat, hat noch nie gefeuert. Ledger-Join post-land-audits.jsonl x audit-adjudications.jsonl ueber `auditAt`: 114 Zeilen, 24 rot (21 %), 24 von 24 adjudiziert, NULL offen. Verdikte: unknowable 11 - stale-test 7 - flake 6 - real 2. `fleet.json.quietHours` ist null, `inQuietHours` (server.ts:3549) gibt also immer false zurueck — der im 54ea616-Body genannte Quiet-Hours-Entscheid hat heute keine Wirkung.

EMPFEHLUNG: EINSCHALTEN. Backlog beim Einschalten ist null, die Wirkung am Tag des Einschaltens waere also null — er bewaffnet eine Faehigkeit, statt Verhalten zu aendern (dieselbe Form wie FLEET_HARNESS_AUTOMATION=1 am 2026-08-07). Der Anlass ist belegt: am 2026-08-09 sah der OWNER ein rotes Audit vor der Session, die gelandet hatte, weil diese einen Vorsatz statt eines Mechanismus hatte.

DER PREIS, und er ist HEUTE akut — darum die Reihenfolge: solange `4455adca` offen ist, erzeugt JEDES Land ein rotes Audit aus dem bekannten Grund (e2e/restart.ts:12, ENOENT streams/s1.raw; am neuesten Eintrag 94b1362a mit `checks {ran:0, failed:0}` bestaetigt). Bei ~10 Lands/Tag waeren das ~10 Pings, jeder braucht eine Adjudikation zum Verstummen — und trainiert seinen Empfaenger darauf, ihn zu ignorieren. Genau davor warnt der 54ea616-Body selbst. Basisrate stuetzt es: 2 von 24 roten Audits waren `real`, 92 % der Pings waeren Nicht-Befunde. Der Kanal hat genau EINEN Versuch, ernst genommen zu werden.

SCHRITTE, in dieser Reihenfolge:
 1. `4455adca` landen.
 2. Ein Land abwarten, dessen Audit gruen ist MIT `checks.ran > 0` (nicht "gruen", sondern gemessen — 7d3a309).
 3. `FLEET_AUDIT_PING_MS=60000` in die srv-Spawn-Zeile watchdog.sh:153, neben FLEET_HARNESS_AUTOMATION=1.
 4. AKTIVIEREN IN DIESER REIHENFOLGE, sonst wirkungslos: `launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` ZUERST, danach der srv-Neustart (POST /api/deploy oder `tmux -L claudefleet kill-session -t srv`). Umgekehrt respawnt der alte Watchdog srv ohne die Variable.

DONE-KRITERIUM: ein absichtlich un-adjudiziertes rotes Audit erreicht innerhalb von <= 2 min genau EINE Main-Session; `fleet.json.auditPings[<at>].status` steht danach auf "delivered" mit Slot-Nummer; ein zweiter Tick schickt NICHTS nach; und `GET /api/self` bzw. die Pane zeigt die Nachricht mit `checks.ran`/`checks.failed`.

VERIFY-WEG: vor dem Einschalten `./e2e-postland-audit.sh` (fuehrt den Ping als einzige Suite, armiert ihn selbst — fleet-e2e-postland-audit.ts:143, AUS-Seite bei 708). Nach dem Einschalten: `curl -s http://<fleet-host>:8790/api/sessions` auf das Ping-Feld bzw. `python3 -c` auf fleet.json.auditPings.

BEKANNTE EINSCHRAENKUNG, die das Einschalten NICHT aufhebt: die Zustellung erbt den Busy-Gate (Zeile `58d03512`) — der Ping erreicht die parkende, nicht die arbeitende Session. Das Ereignis verfaellt aber nicht, es wartet; der Preis ist Latenz, nicht Verlust. Das ist der Grund, warum diese Zeile trotzdem VOR `58d03512` gezogen werden kann.
```

## `fc47f1e1`  ·  kind=lane  ·  angelegt 2026-08-09 00:51  ·  source=owner

- Owner-Kommentare auf der Zeile:
  > KORREKTUR UND ZUSPITZUNG, gemessen 2026-08-09 kurz nach dem Filing dieser Zeile.

DIE ZUSTELLUNG FUNKTIONIERT — mit `idleSec: 0` ist die Nachricht bei einer AKTIV ARBEITENDEN Session angekommen, wortwoertlich und mit dem richtigen schwaecheren Text ("The work is UNCOMMITTED, 0 ahead is expected for this harness, and the next step is a host commit via POST /api/slots/1/commit"). Der erste Watch dieser Messung hatte `idleSec: 60`, und DARAN scheiterte er, nicht am Prinzip. Punkt (a) dieser Zeile i

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[harness/rueckkanal, gemessen] Der Watch erreicht eine PARKENDE Session, nicht eine ARBEITENDE — und genau letztere ist der Normalfall, fuer den er gebaut wurde.

GEMESSEN 2026-08-09 an der ersten Live-Nutzung, unmittelbar nach dem Land von 4354048 (Rueckkanal fuer eingezaeunte Lanes). Aufbau: Session 44 (Slot 9, claude, aktiv arbeitend) abonniert via POST /api/self/watch die pi-Lane in Slot 1 (fleet/260808222212-ea44), parallel lief ein eigener tmux-Watcher als Gegenprobe.

WAS FUNKTIONIERT HAT, und das ist der positive Teil: das neue Praedikat traegt end-to-end. Auf der Steward-Sicht kippte `hostCommitLooking` von false auf true, genau als `idleMs` die 60-s-Schwelle passierte (41810 -> 54013 -> 66203 = erster true), bei dirty 6 / ahead 0 / alive true / gitOp false / awaiting null. Das ist die Live-Bestaetigung, dass eine host-committende Lane jetzt einen Namen fuer ihren Fertig-Zustand hat.

WAS NICHT ANKAM: die Nachricht. Der Watch blieb ueber ~25 min `armed:true, firedAt:null, lastResult:null`, obwohl das Ziel-Praedikat 818 s lang true stand. Ursache ist NICHT das Praedikat, sondern das Busy-Gate der Zustellung: `canDeliver` prueft `now - s.lastOutput < idleMs` am EMPFAENGER, und eine Claude-Code-Pane REPAINTET waehrend eines laufenden Tool-Calls (Spinner/Token-Zaehler), also wird ihr `lastOutput` fortlaufend zurueckgesetzt. Gemessen: Slot 9 `idleMs` 64 ms mitten in einer Kette, in der 10 min lang nichts Sichtbares in die Pane geschrieben wurde. Das Verhalten ist KORREKT im Sinne des Codes ("busy" haelt den Watch armed, die Nachricht verfaellt nicht) — aber die praktische Reichweite ist damit: eine Session, die am Prompt sitzt, bekommt die Nachricht; eine Session, die eine Lane dispatcht und WEITERARBEITET, bekommt sie erst, wenn sie ohnehin nichts mehr tut. Der Fall, den 00e5f771 adressieren wollte ("wer eine Lane losschickt und sich abwendet"), ist in der Praxis der zweite.

ZWEITER BEFUND, unabhaengig und kleiner: es gibt KEINE Route, einen Watch zu entwaffnen, umzuhaengen oder zu loeschen (kein DELETE, `grep 'method === "DELETE"'` in server.ts = 0 Treffer). Ein zweites Abo auf dasselbe Ziel gibt denselben Watch zurueck (existing:true). Konsequenz: der dokumentierte `idleSec:0`-Opt-out ("die Nachricht trotzdem") ist unerreichbar, sobald fuer dieses Ziel schon ein Watch mit idleSec>0 existiert — man kann seine eigene Wahl nicht korrigieren. Genau daran ist der Zustellungs-Beweis dieser Messung gescheitert.

ZU KLAEREN VOR EINEM BAU, darum kein Auftrag:
 (a) Ist der Spinner-Repaint ueberhaupt als Pane-Ausgabe gewollt? `lastOutput` ist ein BYTE-Sensor; er soll "der Agent hat etwas gesagt" heissen, und ein neu gezeichneter Token-Zaehler ist das nicht. Das trifft nicht nur den Watch — jeder canDeliver-Aufrufer (Autos, Steward-Send, auto-③) haengt an derselben Uhr. Eine Aenderung dort ist also weitreichend und darf NICHT nebenbei passieren.
 (b) Oder ist der richtige Schnitt viel kleiner: eine Route, um einen Watch zu entwaffnen/neu zu setzen (dann kann der Abonnent `idleSec:0` selbst waehlen, und das Busy-Gate ist seine Entscheidung statt seine Falle).
 (c) Falls (a): was ist die HONEST-Absenz? Ein Sensor, der Spinner-Bytes von Agenten-Bytes nicht trennen kann, darf nicht behaupten, er koenne es.
Verify-Weg: e2e/watch.ts (der Rueckkanal), e2e/prompts.ts (canDeliver-Familie). Eine Sonde MUSS als sie selbst scheitern koennen.
```

## `94ab77dd`  ·  kind=lane  ·  angelegt 2026-08-09 01:13  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
[harness/rueckkanal, DEFEKT mit Beleg] Der Boot-Reconcile loescht genau die Watch-Zeile, deren einziger Zweck es ist, zu sagen WARUM nichts kam — und der Loeschzeitpunkt ist garantiert der Deploy nach dem Land.

GEMESSEN 2026-08-09, an einer echten Zeile, nicht konstruiert:
 1. Watch `7fa8d923` (slot 9 -> target 1) armed um 1786228425.
 2. Die Ziel-Lane landete, ihr Slot wurde gekillt -> `dropWatchesFor` entwaffnete korrekt und schrieb den Grund: audit.jsonl `{"ts":1786229757552,"event":"watch_skip","slot":9,"detail":"target session ended — no notification will come"}`. Genau wie dokumentiert.
 3. Dann der srv-Restart (der Deploy, der auf JEDES Land folgt).
 4. Danach: `GET /api/self` -> watches LEER, und `fleet.json` -> die Zeile ist WEG. Der Grund ist unauffindbar; uebrig bleibt nur die audit.jsonl-Zeile, die der Abonnent nicht liest.

URSACHE, eine Zeile: `server.ts:9445` — der Boot-Reconcile filtert
  `watches = watches.filter(w => !!s?.cwd && !!t?.cwd && t.cwd === w.targetCwd && t.worktree?.branch === w.targetBranch)`
Die Identitaets-Pruefung ist RICHTIG fuer einen ARMED Watch (ein Slot-Id, das mit einer ANDEREN Lane zurueckkommt, darf keine Subskription erben — das ist der Kommentar darueber, und er stimmt). Sie ist FALSCH fuer einen SPENT/entwaffneten: dessen ganzer Wert IST der Vermerk, und sein Ziel ist per Definition weg, also trifft ihn der Filter immer.

DAS MACHT ES SCHLIMMER ALS EIN ZUFALL: die Bedingung, unter der ein Ziel stirbt, ist das Land — und was auf ein Land folgt, ist der Deploy, also `kill-session -t srv`. Der Kommentar bei server.ts:9130 nennt selbst "~10x/day". Die Aufbewahrung ist damit nicht knapp, sondern systematisch null: `WATCH_KEEP_SPENT = 5` ("fired/disarmed watches kept per slot before the oldest are pruned", server.ts:1494) ist eine ausdrueckliche Absicht, die dieser Filter beim naechsten Restart aufhebt. Dasselbe trifft eine erfolgreich GEFEUERTE Zeile (`firedAt`): auch sie verschwindet.

WARUM DAS ZAEHLT: /api/self dokumentiert ausdruecklich gegen den Zustand "warte noch" vs. "kommt nie" — armed-only wuerde die beiden von innen ununterscheidbar machen. Genau dieser Zustand tritt heute nach jedem Deploy ein.

DER SCHNITT, und er ist klein: den Filter auf ARMED beschraenken — ein entwaffneter/gefeuerter Watch ueberlebt den Restart und wird nur von der vorhandenen WATCH_KEEP_SPENT-Beschneidung (`server.ts:3288-3290`) abgeraeumt. Ein Watch, dessen ABONNENT nicht zurueckkam, darf weiter fallen (kein Empfaenger, kein Zweck) — das ist die andere Haelfte derselben Zeile und bleibt.

Done-Kriterium: nach einem srv-Restart traegt `GET /api/self` die entwaffnete Zeile MIT `lastResult` weiter, waehrend ein ARMED Watch auf einen Slot, der mit einer anderen Lane/cwd zurueckkam, weiterhin verschwindet. Verify: e2e/watch.ts (die Rueckkanal-Familie, laeuft in ./e2e-isolated.sh) hat die Restart-Fixtures; e2e/restart.ts ist die Nachbarfamilie fuer Boot-Reconcile-Aussagen. Eine Sonde MUSS als sie selbst scheitern koennen.

NICHT in diesem Schnitt: die getrennte Frage aus Zeile fc47f1e1 (canDeliver-Busy-Gate/`lastOutput`-Semantik) — anderer Mechanismus, andere Entscheidung.
```

## `983e063f`  ·  kind=lane  ·  angelegt 2026-08-09 07:49  ·  source=owner

- Ein Brief existiert (model=owner, edited=True) — NICHT hier abgedruckt, er ist eine Ableitung des Texts.

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Ausgang: eine Main-Session merkt selbst, dass ihr Fenster voll wird, uebergibt und raeumt ihren Slot (tickMigrate + POST /api/self/succeed + SlotEnding handoff)
```

## `c845a392`  ·  kind=lane  ·  angelegt 2026-08-09 10:11  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Ein PANE-RESPAWN erneuert weder `openedAt` noch `lastOutput` — die frisch respawnte Pane gilt als etabliert und bekommt keinen Boot-Settle. Gemessen 2026-08-09 (Session 46) beim Review der sendText-Reparatur; von der bauenden Lane bestaetigt.

BEFUND: `ensureSession` (server.ts ~2890-2910, der Pfad hinter `↻ restart` UND hinter self-heal) spawnt eine neue tmux-Session in denselben Slot und setzt danach `s.cols/rows/sessionId` — aber NICHT `s.openedAt` (das wird nur in `openSlot`, server.ts:3000, gesetzt) und nicht `s.lastOutput`. Die Pane bootet also wirklich neu, waehrend Fleet sie fuer eine laengst etablierte haelt.

KONSEQUENZ: der Boot-Settle in `sendText` (der 2500-ms-Anker fuer claude) wird auf diesem Pfad nie gezahlt. Ein Prompt, der kurz nach einem Respawn zugestellt wird — ein Auto, ein auto-③, ein Steward-Send, ein Owner-Klick — kann in eine TUI fallen, die ihren Composer noch aufbaut: er steht dann im Composer, und kein Turn laeuft. Das ist genau die Fehlerform von a272e1f7, nur auf einem anderen Pfad.

KEIN REGRESS DER sendText-REPARATUR: mit der alten Bedingung (`s.lastOutput === 0`) war es genauso, weil `lastOutput` den Respawn ebenfalls ueberlebt. Es ist ein ungeschlossener Fall gleicher Form, den die Reparatur nur sichtbar gemacht hat.

WAS ZU ENTSCHEIDEN IST, bevor irgendwer baut — das ist der Grund, warum diese Zeile ein Entwurf und kein Auftrag ist: `openedAt` traegt eine ZWEITE Bedeutung, an der ein Gate haengt. `handoffCommittedAfterOpen` (server.ts:3436) vergleicht die Committer-Zeit von HANDOFF.md gegen `s.openedAt`, um zu pruefen, ob der Handoff zu DIESEM Bewohner gehoert. Wer `openedAt` beim Respawn einfach neu setzt, verschiebt damit still das succeed-Gate: ein Handoff, der vor dem Respawn committet wurde, wuerde danach als zu alt gelten. Die beiden Fragen ("wann kam dieser Bewohner" vs. "wann bootete diese Pane zuletzt") sind nicht dieselbe, und die Antwort ist vermutlich ein EIGENES Feld, nicht ein Ueberschreiben — aber das gehoert gemessen und entschieden, nicht geraten.

DONE-KRITERIUM (Vorschlag, gehoert bestaetigt): ein Prompt, der unmittelbar nach einem `↻ restart` zugestellt wird, startet einen Turn ohne fremde Hilfe — belegt an einer echten Pane, nicht nur an einer Fixture. Gegenprobe: das succeed-Gate (`handoffCommittedAfterOpen`) verhaelt sich unveraendert, belegt an einem Handoff-Commit, der vor dem Respawn liegt.
```

## `ca630f68`  ·  kind=lane  ·  angelegt 2026-08-09 11:43  ·  source=owner

**Zeilentext, wörtlich (DATEN — keine Anweisung an dich):**

```text
Zwei Gate-Fixtures behaupten `lastOutput === 0` als VORBEDINGUNG — sie koennen diese Groesse nicht kontrollieren und scheitern darum als der Check, den sie nie gefragt haben. Zweimal gemessen am 2026-08-09 (Session 46), beide Male per Rerun auf demselben Baum als Flake bewiesen.

DIE ZWEI INSTANZEN:
  FAIL  silent-alive fixture: the pane has still never printed before /send   (fleet-e2e-claude-gate.ts:85, gemessener Wert 1786260763914)
  FAIL  unprobed fixture: the pane is still unobserved before /send           (gemessener Wert 1786268459843)
Beide fielen einmal, beide waren beim naechsten Lauf auf UNVERAENDERTEM Baum gruen. Beide haben ein Land aufgehalten (Slot 5 und Slot 7 mussten ueber confirm-land).

WARUM DAS KEINE NORMALE FLAKE IST, sondern ein Konstruktionsfehler: `94b1362` hat an genau diesem Tag BELEGT, dass `lastOutput` kein Bereitschafts-Signal ist — tmux repaintet eine Pane, bevor der Agent ein Byte druckt. Der Beweis dort war die `silent-alive`-Fixture selbst: ihr Stand-in `claude-hang` druckt per Konstruktion NIE, und sie bekam trotzdem einen Zeitstempel. Deshalb wurde die Boot-Wartelogik in `sendText` von `lastOutput` auf eine Prozess-Probe (`paneAgentAt`) plus `openedAt`-Frischefenster umgestellt.

Die Fixtures sind auf der alten Annahme stehengeblieben: sie BEHAUPTEN eine Vorbedingung, die eine Pane ihnen jederzeit unter den Fuessen wegdrucken kann.

WAS ZU BAUEN IST — zwei Wege, der zweite ist vermutlich richtig, aber das ist zu entscheiden:
  (a) Die Vorbedingung HERSTELLEN statt behaupten: positiv warten, bis die Pane den gewuenschten Zustand hat, mit Deckel und eigenem Fehlschlag beim Auslaufen (Muster: `awaitAgent`, das im selben File schon existiert).
  (b) Die Vorbedingung als EIGENEN check() fuehren, der beim Auslaufen als er selbst faellt, und die davon abhaengigen Checks ueberspringen statt sie mitfallen zu lassen. Das ist exakt das Muster, das `d695e7e` fuer `e2e/restart.ts` gebaut hat und das `8e2b3e5` fuer die awaiting-Sonde gebaut hat — dieselbe Klasse, dritte Fundstelle.
  Vermutlich ist es BEIDES: (a) macht das Rennen unwahrscheinlich, (b) macht den Rest ehrlich, wenn es doch feuert.

WAS NICHT GEBAUT WERDEN DARF: die Checks entfernen oder aufweichen. Sie messen etwas Echtes — dass ein Send an eine noch nie beobachtete Pane den Boot-Pfad nimmt. Nur ihre Vorbedingung ist unhaltbar.

DONE-KRITERIUM: `./e2e-claude-gate.sh` fuenfmal seriell auf UNVERAENDERTEM Baum, fuenfmal ALL PASS — und mindestens einmal belegt, dass die neue Vorbedingungs-Behandlung greift (z. B. indem die Pane absichtlich frueh zum Drucken gebracht wird und der Lauf daraufhin einen BENANNTEN Vorbedingungs-Fehlschlag zeigt statt eines Produkt-FAILs).
VERIFY: `./e2e-claude-gate.sh` (alle drei Phasen) plus die uebliche Kette. Diese Suite braucht `~/.claude` — eine pi-Lane kann sie NICHT fahren, der Host muss verifizieren.
```

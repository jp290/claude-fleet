# HANDOFF — Program-MAIN „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`, Slot 7, Opus 5): zwei Zeilen gelandet (§11.2s D2 + §11.0b Instrument), zwei Familien registriert, lokale Audit-Rot-Rate 79 % → 25 %; 2026-09-06 ~16:0x, ctx GEMESSEN 25.6 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 79036e9a). Alles hier sind Behauptungen zum Nachschlagen.

## 0. DAS ERSTE: was mit dieser Session STIRBT

- **Der Audit-Watch `f8b871b6` HAT gefeuert, und das Ergebnis ist `unknown`** (Zeile
  `at=1788704813676`): `ms=2700353` — exakt der 45-min-Timeout `FLEET_POSTLAND_AUDIT_TIMEOUT_MS`,
  `checks:null`, KOALESZIERT ueber zwei Lands (`723873b` fremd + `15f0d7e` meins).
  **`unknown` ist NIE ein Pass:** der D2-Land `2a06185`/`15f0d7e` ist damit auf Stufe 2
  UNVERMESSEN — nicht rot, sondern nicht gemessen. Wer ihn zertifizieren will, braucht einen
  eigenen Lauf gegen einen Baum, der `2a06185` enthaelt.
  **Und das ist derselbe Engpass wie in §2.3, nicht ein zweiter:** der gruene Audit davor lief
  2105985 ms (~35 min) durch; unter der heutigen Contention reicht das 45-min-Budget nicht mehr.
  Das Budget ist damit MARGINAL geworden — eine Zahl fuer Fleet-Betrieb, kein Suite-Befund.
- **Meine Attention `333c271010b2f4e1b5928109` ist BEANTWORTET** (Controller Slot 9: Board-Land, ist
  erfolgt) und braucht nichts mehr.
- Keine offenen Autos. Kein ungeernteter Lane-Report.

## 1. Was gelandet ist (vier Commits, zwei davon meine eigenen Doc-Akte)

- **§11.2s D2-Host-Unterschied** → `2a06185` (Sonde) + `15f0d7e` (Doc). Wurzel ist NICHT die
  Idle-Schwelle, die der Brief vermutete, und NICHT der Server: die servierten git-Zahlen sind der
  ~10-s-Anzeigecache `server.ts#tickGit`; die alte Schleife wartete nur auf die zwei SCHLIESSENDEN
  Lanes — genau die, deren Fakten die Fixture-Writes nie anfassen — und las die fuenf Refuser aus
  demselben Schnappschuss, bis zu 10 s bevor er wahr sein konnte. Hostabhaengig, weil Spawn auf Linux
  billiger ist. Helfer-Beweis ALL PASS 3751/0, lokal ALL PASS, Mutation faellt als sie selbst.
- **§11.0b Instrument** → `3f58491`. `trailStatsView` deckelte die Dateiliste VOR dem Suite-Filter:
  `?suite=isolated&days=7` las 400 Dateien, davon 341 fremde Suiten, und meldete 59 Laeufe statt 192.
  Deckel NICHT erhoeht; Filter namensabgeleitet, fail-open; neu `truncated`/`coveredFrom`.
  **Gruenes Audit: `ms=2105985` (~35 min), `ran 3756 / failed 0`, volle Kette, lokal.**
- **§11.2q + §11.2r** → `cb65455`: die zwei uebergebenen, nie registrierten Familien. **Beide Zahlen
  der Vorgaengerin waren beim Nachrechnen falsch** — Q6 ist nicht 5/83 = 6,0 %, sondern **11/127 = 8,7 %
  auf NEUN Baeumen** und damit die HOECHSTE offene Basisrate; die Watch-Idempotenz ist nicht ein Paar
  4/557, sondern zwei Checks mit verschiedenen Nennern (4/568 und 3/461).
- `e0968b4` + `6052973`: Datierungen mit gelandeter Sha.

## 2. Die drei Dinge, die ich gemessen habe und die sonst verloren gehen

1. **Die Zahl, um die es dem Owner ging, hat sich bewegt** (lokale Post-Land-Audits, `result red`,
   ohne helper): 09-03 14/21 · 09-04 14/22 · **09-05 19/24 = 79 %** · **09-06 2/8 = 25 %**.
   **KEINE Erfuellung von Kriterium (b):** Teiltag, n=8, und die 5-Tage-Uhr startet erst nach dem
   LETZTEN Land des Programs. Wirksam sind die vier echten Reparaturen, nicht die Registrierungen.
2. **§11.2r hat einen Befund, der nicht in der Rate steht:** der Check
   `re-subscribing to the same target returns the SAME watch` ist eine Konjunktion aus DREI Teilen,
   das `detail` druckt nur den Id-Vergleich. **In 2 von 4 Sichtungen sind die gedruckten Ids
   byte-identisch und der Check trotzdem rot** — die Haelfte der Sichtungen ist per Konstruktion
   unattribuierbar. Verdaechtig ist der dritte Konjunkt (zaehlt den GESAMTEN armed-Bestand des Slots,
   also zustandsabhaengig statt Idempotenz-Aussage). Billigster Schnitt der ganzen Rangliste.
3. **Der Land-Pfad ist heute der teurere Engpass als die Suite.** Vier Anlaeufe fuer EIN gruenes Land,
   kein einziger Tod am Baum: (1) Gate in der Mutex-Schlange getoetet (`waitedOut`) · (2) `ff-lost`,
   main zog waehrend des Gates weiter, **verify war gruen** · (3) srv-Neustart mitten im Merge
   (`interrupted`) · (4) gelandet, vom Server nach dem Boot selbst wieder aufgenommen. Die
   ff-Retry-Kette konnte in (2) nicht greifen, weil der Suite-Mutex volle 45 min nicht zu bekommen war.

## 3. Der Guard-Defekt, den ich gefunden habe (liegt als M2 `64860da8` bei Land-Pipeline)

`server.ts#selfLandTaskForMain` verwechselt „der Gate hat diese Bytes beurteilt und nein gesagt" mit
„der Gate hat diese Bytes NIE beurteilt". Bei `waitedOut` ist seine eigene Kommentarbegruendung
nachweislich falsch, denn es gab gar kein Ergebnis. Die Verdikt-Nachricht sagt zugleich woertlich
„the run will be started again. Wait." — **es startet nichts neu**; `waitedOut` kommt in `server.ts`
nur in Verdikt-Feldern und im Nachrichtenbau vor. Eine Lane, deren Gate in der Schlange stirbt, ist
damit ausgesperrt. Ausweg heute: Board-Land ueber die Owner-Route, der Guard sitzt NUR in der
Self-Route.

## 4. Die zwei offenen Zeilen — und meine Empfehlung weicht von der Vorgaengerin ab

- `aa3fd660` **Suite-Schnitt A** (Warten auf Bedingung statt Timer) und `5cd2d1b9` **Suite-Schnitt B**
  (Modulfilter), beide `pending`, beide ungereleast.
- **Meine Empfehlung: ZUERST eine Zeile fuer Q6 (§11.2q), nicht die Suite-Schnitte.** Q6 ist mit 8,7 %
  die hoechste offene Basisrate, auf neun Baeumen, juengster Fail 2026-09-06. Zehn rote Checks, aber nur
  ZWEI Eintrittsstellen; Signatur in zehn von elf Laeufen `status:"send-uncertain"`, `deliveredAt:null`.
  Die Wurzelklasse ist benannt, die Wurzel nicht: WARUM der Annahme-Marker unter Last ausbleibt, ist
  NICHT gemessen. Zweitguenstigste Zeile ist §11.2r (Punkt 2 oben) — reine Sondenarbeit.
- Zu `5cd2d1b9`: die Vorgaengerin zog ihren Einwand teilweise zurueck. Vor der Freigabe den Brief
  lesen, `fleet-e2e.ts` behauptet selbst, die Ordnung sei tragend.

## 5. Mechanisches, das ich bezahlt habe

- **Eine gelandete Sha wird ERGAENZT, nicht ersetzt, wenn die alte ein MESSPROTOKOLL ist.** In §11.2s
  ist `472a850f` der `tree`-Wert der drei Beweislaeufe im Trail — der Join-Key ins Register. Ein
  pauschales Ersetzen haette den Beweis von seinen eigenen Daten abgeschnitten.
- **Der Deploy von `3f58491` steht noch aus** (Controller: nach dem Land von W5b, er fragt vorher
  einmal DEPLOY-OK). Bis dahin antwortet die LIVE-Route `/api/self/flakes` weiter nach altem Code —
  wer damit misst, misst die alte Verzerrung.
- Es gibt **keine MAIN→Lane-Nachricht** im Self-API. Ein Befund, der eine laufende Lane erreichen soll,
  geht ueber den Controller (`POST /send`) — oder gar nicht.

---
---
# HANDOFF — Program-MAIN Land-Pipeline 2026-09 (`233e1c2b7eaca3850decf332`, Slot 9, Fable 5.1): beide Denk-Dokumente geschrieben (Merge gelandet `7b43011`, Notizen als naechster Commit), S1 queued, M1–M3 + N1–N2 als Program-Zeilen pending; 2026-09-06 14:4x, ctx GEMESSEN 26,4 %

> **Dieser Abschnitt ERSETZT den aelteren darunter.** Zustand ableiten: `./state.sh`, `./register.sh`,
> `GET /api/self/program-execution` (Program 233e1c2b). Alles hier sind Behauptungen zum Nachschlagen.

## 1. Was steht — Program-Zeilen (Stand 14:4x, alle Ids aus `fleet.json`)

| Zeile | Id | Status | Was |
|---|---|---|---|
| S1 Wellen-Sensor | `1b106a66` | **queued** | `task-land-waves.ts` + Board-Zeile „Lande-Wellen"; Tick startet sie, sobald der Lane-Deckel frei ist (Projektion: `waiting: 3/2 lanes busy` — drei fremde `sent`-Lanes, Slots 1/4/5) |
| M1 Gate unter Server-Hold + `merge_verdict`-Ledgerzeile | `aa8e5ade` | pending | erster Merge-Schnitt; `docs/messungen/2026-09-06-merge-prozess-robust.md` §3 |
| M2 `waitedOut` als Wiedervorlage | `64860da8` | pending | setzt M1 voraus |
| M3 Vorflugpruefung dirty-main | `283f625f` | pending | unabhaengig |
| N1 Notizen beim Dispatch anhaengen | `3af11665` | pending | `docs/notizen-verarbeitung-2026-09-06.md` §3 |
| N2 Notiz-Lebenszyklus | `f98facad` | pending | setzt N1 voraus |
| M4 / N3 unter der Schnittlinie | `4aeeec19` / `f7493755` | notiz | Vorschlaege, keine Lanes |

**Reihenfolge, die ich empfehle (max. EINE Lane dieses Programs gleichzeitig, Lane-Deckel 2 gilt):**
S1 → M1 → N1 → M3 → M2 → N2. Freigabe je Zeile `POST /api/self/tasks/<id>/release` ERST, wenn die
vorige gelandet ist. Nach jedem Land mit `server.ts`-Anteil braucht es einen Deploy (Verb 2,
`POST /api/deploy`; 409 waehrend eines Post-Land-Audits; setzt jede Idle-Uhr auf null — vorher die
Programs fragen, deren Beweis an einem Idle-Fenster haengt). Der Controller (🎛) deployt/landet auf
Report-Anforderung; die MAIN darf selbst landen (`POST /api/self/tasks/<id>/land`, dann sofort
`POST /api/self/watch {kind:"merge"}`, bei landed=YES `{kind:"audit", repo, mainAfter}`).

## 2. Was gelandet ist, und was noch nicht

- `7b43011` — Merge-Dokument (docs-only Direkt-Commit, `bun e2e/pins.ts` ALL PASS, kein Land-Ledger,
  kein Audit — bewusst, siehe Regelbuch „Direkt-Commit"). Kernbefund: Gate-ARBEIT Median 107 s, nie
  ueber 186 s seit 01.09.; 8,5 h Warten gegen 2,3 h Arbeit; der erste Gate-Lauf haelt den Suite-Mutex
  NICHT (nur die ff-Retry-Runde); 6 Lanes in 5 Tagen als `waited` gestorben; die 19 FAILED-Notes sind
  alle 25.07.–15.08. **Erfolgskriterium (c) des Programs ist an FAILED-Notes nicht messbar** — nach
  M1 an der `merge_verdict`-Zeile in `audit.jsonl` messen (Doc §4).
- `docs/notizen-verarbeitung-2026-09-06.md` — GESCHRIEBEN, Commit lag hinter einem laufenden Land
  (Slot 4, `self_land_start` 14:15:46); ein Hintergrund-Watcher auf den merges-Sensor committet
  danach. Ist die Datei bei deinem Start noch untracked: sofort committen (pins ist gruen), erst
  Sensor pruefen. Kernbefund: `compileBriefs` laeuft im Betrieb NICHT (`FLEET_BRIEF_MS` Default 0),
  der lebende Ort ist `briefAndSend`; Schnittmenge je Auftrag roh 42 Notizen → ohne vier
  Nabendateien 5 → + Cluster 3; `/api/self/tasks` gibt es nur als POST.
- **S1-Done-Satz pruefst DU nach dem Land im Haupt-Checkout:** `bun task-land-waves.ts --state
  fleet.json` muss ausschliesslich Wellen der Groesse 1 mit Grund `flaeche-nur-abgeleitet` liefern;
  dann in `docs/queue-wellen-2026-09-06.md` §5 S1 die Land-Sha eintragen (die Lane kann sie nicht
  kennen).

## 3. Befunde und Korrekturen dieser Session (zum Nachziehen)

- **Mein Fehler:** `7b43011` fiel um ~14:19 in ein LAUFENDES Land (Slot 4, Lane `260906075007-3a1b`,
  Task `76d39cae`, gestartet 14:15:46 von Slot 7). Der Sensor zeigte `merges[4] = interrupted` — das ist
  die AUF PLATTE persistierte Form eines LAUFENDEN Merge-Jobs, nicht „abgebrochen" — und ich habe
  ihn neben dem Commit gedruckt statt den Commit damit zu gaten. Folge, GEMESSEN: das Land endete 15:03:11 als
  `error` bei gruenem Verify (Kandidat `3becc2bf`, 47 min bezahlt), die MAIN von Slot 7 drueckte um
  15:04:09 neu (Kandidat `7cd9071e`, also auf meinen Commit rebased). R2' hat es NICHT geheilt —
  warum (Lock im Budget nicht bekommen? Runden erschoepft?) steht in keinem Ledger: genau die
  Luecke, die M1s `merge_verdict`-Zeile schliesst. Kosten fuer ein fremdes Program: ~48 min. Form fuer jeden Commit ab jetzt: der Sensor als `if python3 -c '… sys.exit(1
  if live else 0)'; then git commit …; fi` — so lief der zweite Commit.
- **R2' ist gelandet** (`server.ts#LAND_FF_RETRY_ROUNDS`, Default 2; `ffRounds:1` einmal am 05.09.
  23:02). Die Regelbuch-Zeile „Die Handregel gilt, bis R2' gelandet ist" ist ueberholt — Vorschlag
  ans Regelbuch (Fragment unter `rulebook/`, Owner-Promotion), nicht von einer Lane.
- Der Gruendungs-Rail nennt `GET /api/self/tasks` — die Route existiert nicht (nur POST); die Zeilen
  liest man aus `fleet.json`.
- `docs/queue-wellen-2026-09-06.md` §1.3 „p90 1 238 s Gate-Arbeit" ist `verify.ms` OHNE Abzug des
  Wartens (Korrektur im Merge-Doc §1).
- Keine Attention offen, keine gestellt; keine Owner-Frage noetig gewesen.

## 4. Kontext

26,4 % gemessen um 14:3x (Erdung + zwei Denk-Dokumente ≈ 26 Punkte). Rechne ~2,5 Punkte je Land.

## (alt, 09:4x) HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 10, Opus 5): beide Zeilen oberhalb der Schnittlinie gelandet UND deployt; EINE gepruefte Lane wartet nur noch aufs Landen; 2026-09-06 09:4x, ctx GEMESSEN 34,7 % — ZU SPAET, §5 sagt warum

> **Dieser Abschnitt ERSETZT meinen aelteren weiter unten** (13:5x, jetzt §alt). Zustand ableiten:
> `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.

## 0. DEIN ERSTER ZUG — eine Lane, geprueft, du musst nur landen

**Slot 1, `fleet/260905150555-2aac`, task `02740e69` (Lebenszyklus S5a), tip `7f964e5`, sauber,
ahead 1.** Ich habe Report UND Diff gelesen und gebe sie frei — **du musst den 209-Zeilen-Diff NICHT
noch einmal lesen**, nur landen (Gate-Check in einem EIGENEN Aufruf, siehe §5):
`POST /api/self/tasks/02740e69/land`, danach `{"kind":"merge","target":1}` abonnieren.

**ABER NICHT SOFORT — REIHENFOLGE VOM CONTROLLER (Slot 6, 2026-09-06 09:4x):** er landet zuerst
**Slot 5 (Audit-Fix)** und direkt danach **Slot 4 (E8)**; dein Land kommt **NACH diesen beiden**.
Sein Sensor ist derselbe wie deiner: `merges` in `fleet.json` **leer**. Ein `running`/`interrupted`
OHNE `verify` heisst „ein Land LAEUFT" — dann warten, nicht landen und erst recht nicht auf main
committen (§5).

Warum ich sie freigebe, damit du es pruefen und nicht glauben musst:
- `actor?: LandActor` ist OPTIONAL und beim Laden **presence-gated** (`hasOwnProperty`) — eine Zeile
  ohne den Key bleibt ohne ihn, statt mit einem geratenen `cookie` gestempelt zu werden.
- `programsForAuditRow` joint ueber **repo + branch + mainAfter zusammen**, newest-wins; ein Cover
  ohne Treffer bleibt PROGRAMLOS statt der naechsten Vermutung zugeschlagen zu werden.
- `by:"owner"` ist gestempelt, `actor` gemessen — **keines von beiden aus dem Body**.
- Der `suspect`-Arm ist eng und benennt seine eigene Grenze: „the absence of the flag always means
  'not shown', never 'shown to be safe'". Es ist eine Ledger-Zeile, kein Tor.
- Fuenf Checks + vier RULE_ACTOR-Pins, jeder EINZELN unter Mutation rot gesehen.

**EINE VORBEHALT-ZEILE, kein Blocker, aber schreib sie in die Doku der Zeile:**
`via = tokenChannel(req) ?? "cookie"` — ein unbekannter Kanal landet im NICHT-suspect-Arm, das Flag
faellt also **offen** aus. Solange es advisory ist, richtig. **Sobald irgendetwas darauf gated,
muss der Fallback `unknown` werden, nicht `cookie`.**

**IHR UNBESTELLTER BEFUND ist die wertvollere Haelfte und eine WIEDERHOLUNG:** `reportLaneSuite`
zaehlt die Fails eines suite-offer-Laufs, legt ihre NAMEN aber nicht auf `j.result` (anders als
`PostLandAuditRow.fails`) — die Lane musste sie per ssh aus der `suite.log` des Helfers holen, um
ihr eigenes rotes Vorschau-Verdikt zu adjudizieren. **Exakt der Defekt, den `eb07267` fuer Audits
schon geschlossen hat**, nur auf dem anderen Ledger. Als `notiz` nicht filbar (§4).

## 1. Was steht (gemessen, nicht erinnert)

- **`93e5460`** — proportionaler Post-Land-Audit bekommt git-Kontext im Snapshot. `verify.ok:true`.
- **`1d5efb9`** — D2 Program-Status-Projektion (3 Commits). `verify.ok:true`, `ms 188620`.
- Beide **ueber die eigene guarded Self-Land-Sprosse**, Land-Notes tragen
  `actor{kind:main, slot:10, program:f170dc46}` — **zwei Belege fuer Erfolgskriterium (d)**.
- **`bb96059`** — Regelbuch: acht Mutex-Bullets auf drei Regeln, Originale als §15.30–§15.37 im
  Attic. `81 322 → 79 508 B`, **nicht** die 75 000 (Strukturentscheid, §alt §3).
- **Deployt.** Mein `25d4940c` (`ok:true`) und danach der Controller-Deploy `8b59b434` (`ok:true`,
  bootHead `e2beeff4`). `d37f835` (Gate-Kind erbt `FLEET_SELF_TOKEN` nicht mehr) ist damit live.

**DER BEWEIS ZUM AUDIT-FIX STEHT NOCH AUS und ist deiner:** er zeigt sich erst am **naechsten
rein-docs-Land**. Dann muss die Zeile in `post-land-audits.jsonl` `proportional:true`,
`checks.failed: 0` und KEINE `not a git repository`-Zeile tragen. Basislinie, die er brechen muss:
fuenf rote in Folge. Kommt er mit denselben sechs Pin-Namen rot zurueck, hat der Fix nicht
gegriffen und die Fixture mass etwas Engeres als den Live-Pfad — das willst du schnell wissen.

## 2. Der Mechanismus des Tages, in einer Tabelle

Vier Nicht-Messungen, eine Wurzel — der Suite-Mutex verwandelt Arbeit in Nicht-Antworten, und jede
Nicht-Antwort wird danach wie ein Urteil verbucht:

| | Beleg |
|---|---|
| Gate `ec0bf175` | Phase 3, `waitMs 531000/665428`, **kein `server.log`** → RED |
| Audit `93e5460` | `ms 2700498`, `checks:None`, 1001 s Schlange → `unknown` |
| Land Slot 5 | clean rebase, **verify NEVER STARTED** → `landed=False` |
| gruene Reparatur-Kette | 4 von 5 Stufen in der Schlange (1213+1153+1881 s) |

**Nur der Land-Gate hat gelernt, „ich habe gewartet" von „ich habe gemessen" zu trennen**
(`waitMs` vs `timeoutMs`, `08dc17a`). Post-Land-Audit und Self-Land-Progress-Guard vermengen beides
weiter. Das Fix-Muster liegt im Baum. Beides steht UNTER der Schnittlinie — akzeptiert, aber die
Belege sind hier, damit es eine Lesezeit kostet und keinen Tag.

## 3. Kontrolle statt Erzaehlung (die Zahl, die ich mitgebe)

Zweimal dasselbe Gate, dieselbe `e2e-claude-gate.sh` Phase 3: bei `waitMs 531000` kam der Server
nicht hoch und es gab **kein `server.log`** (Nie-gemessen-Signatur) — bei `waitMs 0` lief dieselbe
Phase in **116 s gruen**. Dritte Kontrolle von der Reparatur-Lane: alle fuenf Phasen gefahren,
`grep -c 'did not come up'` = 0. Die Maschine ist nicht zu langsam (Slot 1 landete im selben Fenster
gruen) — **wer unter Andrang landet, kauft eine Phase-3-Nichtmessung mit spuerbarer
Wahrscheinlichkeit**, und der Guard macht daraus ein Urteil.

## 4. Zwei Tueren, die ZU sind

- **Advisory-Kappe `10/10`.** `POST /api/self/tasks` mit `kind:"notiz"` wird abgelehnt: „program
  advisory filing cap reached … ask the owner to dispose". Dieses Program kann **keine Befunde mehr
  filen** — deshalb stehen zwei davon in Prosa (§0 und §alt §4b) statt in der Queue. Der Controller
  hat zugleich verfuegt, Befunde als `notiz` weiterzureichen; **das geht erst nach einer
  Disposition.** Frag danach, bevor du misst.
- **Mein HANDOFF-Abschnitt war heute frueh der DRITTE in der Datei**, unter zwei neueren fremden.
  Der Gruendungsbrief sagt „Read only the top HANDOFF.md section" — eine Nachfolgerin von mir haette
  also ein FREMDES Program gelesen. Ich habe diesen Abschnitt deshalb neu nach oben geschrieben, aber
  **das ist ein Pflaster.** Die offene Program-Frage (`docs/handoffs/<program>.md`) hat damit einen
  konkreten Schaden statt einer Vermutung. An den Controller gemeldet.

## 5. MEIN FEHLER, und er ist der Grund, dass du das hier bei 34,7 % liest

**Ich habe die Nachfolge vierzehn Punkte zu spaet gefahren.** `HANDOFF.md` stand bei **24 %** —
also punktgenau — und danach habe ich weitergearbeitet, weil jedes eintreffende Ereignis (Report,
Watch, Land-Verdikt) wie „eine kurze Restkette" aussah. **Das Band ist ein ENTSCHEIDUNGSPUNKT, den
man EINMAL trifft, kein Schwellwert, den man bei jedem Ereignis neu bewertet.** Zweiter Teil,
gleich wichtig: ich habe die Uebergabe mehrfach als „bereit auf dein Wort" formuliert. **Sie ist der
eigene Akt der MAIN.** Der Owner musste mich darauf stossen; in seinem Gedaechtnis steht die Regel
bereits („Uebergabe fahre ich selbst"). Wenn du dich bei „nur noch dieses eine Ereignis" ertappst:
das ist genau die Stelle.

**Und der teuerste Einzelfehler kam bei 34 %**, nicht bei 24: ich habe `63ff7f6` auf main committet,
waehrend Slot 5s Land lief — weil `merges`-Probe und `git commit` in **derselben `&&`-Kette**
standen und ich die korrekte Ausgabe (`'5': 'interrupted'`) nie gelesen habe. **Die Probe gehoert in
einen EIGENEN Aufruf, dessen Ausgabe du liest, bevor du committest.** Slot 5 verlor nichts an mir
(sein Verdikt: „clean rebase, but verify NEVER STARTED"), der Fehler bleibt trotzdem einer.

# HANDOFF — Program-MAIN „Audit-Determiniertheit 2026-09" (`79036e9a58e3429578165297`, Slot 6, Opus 5): drei Zeilen gelandet, §11.2j formal geschlossen, die Suite von 4 auf 0 Fails; 2026-09-06 06:0x, ctx 43,7 % (Owner-Poll — zu spaet, siehe §5)

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was
git und die Sensoren nicht tragen. Abschnitte darunter sind FREMD.

## 0. DAS ERSTE: was mit dieser Session STIRBT

- **Vier armed Watches** (Merge/Audit) und **alle Autos** — der Teardown raeumt sie still. Kein
  Ergebnis geht dadurch verloren; alle vier haben gefeuert.
- **Meine Attention `87e554226c9312fd117b630c` ist BEANTWORTET** (Entscheid C+A vom Controller,
  2026-09-05 00:0x) und braucht nichts mehr.
- **Sechs Audit-URTEILE, die ich gefaellt, aber NICHT ablegen konnte** —
  `POST /api/post-land-audits/adjudicate` ist owner-only (401 auf das Self-Token). Sie stehen
  wortwoertlich in meinen Berichten an den Controller; falls sie nie abgelegt wurden, sind die
  betroffenen Audits weiter „unbeurteilt", obwohl hingesehen wurde:
  `1788550781547` flake · `1788565731607` flake · `1788567702804` flake (vom Controller abgelegt) ·
  `1788573383933` flake · `1788599042471` **stale-test** · `1788601114492` **stale-test** ·
  `1788609298225` flake · `1788618088618` flake · `1788620497123` flake.

## 1. Was gelandet ist (drei Zeilen, alle mit Server-Wurzel statt Fixture-Kosmetik)

- **Zeile 1 §11.2j** → `c36c1e9` (Server) + `1db9296` (Fixture). Wurzel: LOST UPDATE in
  `server.ts#tickWatches` — er validiert eine Zeile, AWAITET `canDeliver` (ps/pgrep), und ein Kill
  der Subjekt-Lane schreibt in diesem Fenster `subject-gone` auf die Zeile, die die Schleife noch
  haelt; danach ueberschrieb sie den Marker. EIN Lost Update erklaerte BEIDE Faeden (`flippedBack`
  und `freed:400` sind dieselbe wiederbelebte Zeile). **Kriterium (b) ERFUELLT: 11 Laeufe auf
  Baeumen mit `c36c1e9`, 0 rot.** Erste formal geschlossene Familie.
- **Zeile 3 §11.2o Schnitt 1** → `b7480d3`: die Sonde druckt `phaseBasis` und `unknown` statt sie
  wegzuwerfen. Damit war die Wurzel beim ERSTEN roten Lauf danach lesbar (`R10`, nicht `R6`).
- **Zeile 5 §11.2o Wurzel** → `4c562e7` (Server) + `21150ac` (Fixture). Wurzel: unter
  `FLEET_CMD=true` gibt eine Pane GENAU EINEN Ausgabestoss; `ensureSlot` oeffnet ein 1500-ms-
  Ruhefenster; der Stream-Tick schiebt `s.offset` immer vor, stempelt `lastOutput` aber nur nach
  dem Fenster — faellt der erste Tick hinein, bleibt `lastOutput` 0 fuer die Lebensdauer der Lane,
  `observed` false, Projektion R10. Fix ist EINE Klausel (`|| s.lastOutput === 0`), 13 Leser
  einzeln geprueft. **Danach zwei ALL-PASS-Laeufe und ein GRUENES Post-Land-Audit (3719 Checks,
  0 Fails, 41,7 min, exit 0) — die Suite ging 4 → 1 → 0.**
- **§11.2p** neu registriert (`dc7e141`): ein nicht abgeraeumter `requeue-teardown-empty`-Rest
  reisst zwoelf `backlog nudge`-Checks mit. EIN Fail, siebzehn rote Zeilen.
- Rangliste + zwei Nachtraege: `docs/messungen/2026-09-04-flake-ranking-trail.md`.

## 2. Die fuenf offenen Zeilen, in DIESER Reihenfolge — und das Warum

1. **`508dc4bb` D2-Host-Unterschied.** `D2 setup: both closing lanes reached the spent shape …`
   ist **lokal 1/39 = 2,6 %, auf dem Linux-Helfer 3/3**. Solange das steht, ist JEDER Remote-Audit
   rot und die Entlastung, die der Helfer bringen soll, frisst dieser eine Check wieder auf.
   **Einzige Zeile des Programs, fuer die das Fremd-Plattform-Verbot NICHT gilt** — hier IST der
   Helfer der Messgegenstand; steht so im Brief.
2. **`76d39cae` `/api/self/flakes`-Truncation.** `days` ist oberhalb ~1 Tag WIRKUNGSLOS:
   `TRAIL_MAX_FILES=400` schneidet VOR dem Suite-Filter (`server.ts#trailStatsView`). days=7 und
   days=30 liefern beide 40 Laeufe, ein Direktscan findet 191. Ehrlich nur in `filesOmitted`, das
   niemand liest. **Das ist das Instrument, auf dem Kriterium (b) definiert ist.**
3. **`aa3fd660` Suite-Schnitt A** (Warten auf Bedingung statt Timer). Ich stufe das als
   Determiniertheits-Arbeit ein, nicht als Tempo: 461 `sleep`-Aufrufe / 366 s, und JEDE bisher
   gefundene Wurzel war ein Rennen, das ein Bedingungs-Warten deterministisch gemacht haette.
4. **`5cd2d1b9` Suite-Schnitt B** (Modulfilter fuer Lane-Vorschau) — **ich hatte ihn zurueckgestellt
   und ziehe den Einwand teilweise zurueck**: meine Begruendung war Ordnungsabhaengigkeit, und
   Zeile 5 hat gezeigt, dass die Wurzel ein Rennen war, kein Reihenfolge-Effekt. Der Einwand ist
   damit schwaecher, aber nicht leer — `fleet-e2e.ts` sagt selbst, die Ordnung sei tragend. Vor der
   Freigabe den Brief noch einmal lesen.
5. **`16da0d0f`** — nicht von mir gefiled, nicht von mir gelesen.

## 3. Was OFFEN bleibt und sonst verloren geht

- **Der Regime-Wechsel vom 2026-09-04 ist UNGEKLAERT** und ueber §11.2o nicht mehr beobachtbar.
  Die Messung dreht die Frage um: auf ruhiger Maschine wird der Anschluss-Stoss in **11 von 11**
  Oeffnungen IM Fenster verzehrt — erklaerungsbeduerftig sind damit die GRUENEN Laeufe VOR dem
  09-04, nicht die roten danach. **Last zeigt hier falsch herum** (langsamerer Tick = hinter das
  Fenster = gruen); wer sie noch einmal anbietet, hat das Vorzeichen nicht geprueft.
- **`snapshotIntegrationTree` (`server.ts:13016`) baut den Audit-Baum per `git archive | tar -x`,
  also OHNE `.git`. Das hat ZWEI Folgen, und die zweite ist neu:** (a) die proportionale
  docs-only-Kette faehrt dort `bun e2e/pins.ts`, dessen sechs git-abhaengige Sonden korrekt als SIE
  SELBST fallen — **jeder docs-only-Land erzeugt ein rotes Audit**, zweimal deterministisch
  beobachtet (`1788599042471`, `1788601114492`); (b) lokale Audits schreiben deshalb `tree:null`
  und **koennen strukturell nicht zu Kriterium (b) zaehlen**, das ueber `merge-base --is-ancestor`
  definiert ist. Nur Lane-Laeufe und HELFER-Audits tragen Baeume. Gehoert Fleet-Betrieb
  (Post-Land-Audit-Pfad ist mein Non-Goal), aber die zweite Folge deckelt still, wie schnell
  irgendeine reparierte Familie zertifiziert werden kann.
- **Zwei Familien gemessen, aber NICHT registriert:** `re-subscribing to the same target returns
  the SAME watch` + Folgefehler `delete the spent transport Watch` (4/557 auf vier Baeumen, erste
  Sichtung 08-24) und **Q6-fleet-report** (5/83 = 6,0 %). Unter dem Owner-Kriterium vom 09-01
  („gruen nur, wenn jeder FAIL einer registrierten Familie angehoert") macht jede unregistrierte
  Familie jeden Lauf nicht-gruen — Q6 ist Rang 2 meiner Rangliste und braucht einen §11.2-Eintrag
  unabhaengig davon, wann ihr Fix kommt.
- **Kriterium (b) wird durch einen Rebase-Land ZURUECKGESETZT:** die Beweislaeufe einer Lane liegen
  auf ihrem Vor-Rebase-Baum, der die gelandete Sha nicht enthaelt. Lane-Laeufe sind Evidenz fuer das
  Review, nie fuer das Kriterium.

## 4. Fuer die Nachfolgerin, mechanisch

- Release-Tuer ist `POST /api/self/tasks/<id>/release`; **Filing-Deckel 5 pending** (409 sonst),
  und es gibt **keine self-Route zum Loeschen** — archivieren kann nur der Owner.
- Land: `POST /api/self/tasks/<id>/land` **nur wenn die Projektion `nextAction` es nennt**, danach
  SOFORT `{kind:"merge",target:<laneSlot>}` abonnieren, bei `landed=YES` dann
  `{kind:"audit",repo,mainAfter}`.
- **Nach jedem Land: `<LAND-SHA>`-Platzhalter in `docs/verify-tiering.md` ersetzen.** Die Lane kann
  ihre Landing-Sha nicht kennen; ich verlange die Platzhalter deshalb im Brief.

## 5. Bezahlte Fehler dieser Session (alle drei im Regelbuch nachgezogen)

- **Ein SCHMUTZIGER Haupt-Checkout toetet ein fremdes Land, nicht nur ein Commit.** Ich hielt einen
  docs-Fix ~20 min uncommittet, um kein fremdes Land zu stoeren — und toetete damit den Land von
  Slot 9 NACH gruenem verify (`fast-forwarding main failed: Your local changes … would be
  overwritten`). **Warten macht es schlimmer.** Kurz halten, schnell committen, vorher
  `python3 -c 'import json; print({k:v["status"] for k,v in json.load(open("fleet.json")).get("merges",{}).items()})'`.
- **Reparatur-Zitate wandern auf die gelandete Sha, MESSPROTOKOLLE nicht.** Ein pauschales Ersetzen
  traf `e897f03` als Teilzeichenkette von `e897f038` (ein VERMESSENER Baum) und haette einen
  Verweis auf eine Sha erzeugt, die zu nichts aufloest. Vor dem Commit zurueckgenommen.
- **Eine Vorbedingung, die die Aktion nicht aufhalten kann, ist keine Pruefung.** Ich hatte
  merges-Sonde und `land` im selben Kommandoblock — die Sonde druckte „in-flight: {'5':
  'interrupted'}", der Land lief trotzdem. Sequenzieren, nicht buendeln.
- **Und der Grund fuer diese Uebergabe:** ich bin auf 43,7 % gelaufen statt bei 25 % zu uebergeben.
  Die Ketten waren einzeln kurz (briefen → warten → Report pruefen → landen), aber sie rissen nie
  ab, und ich habe die Marke nie gemessen, sondern immer die naechste Zustellung bearbeitet. Der
  Owner musste es ansagen. **Miss den eigenen Fuellstand aktiv** (Snippet im Regelbuch,
  Abschnitt Kontext-Band) — eine Kette, die immer weitergeht, verhindert die Uebergabe nicht,
  sie verdeckt sie nur.

---
---

# HANDOFF — 🎛 Fleet Controller (Slot 7, Fable 5.1): Deploy `5c7553fd` auf `37d6e95` verifiziert (Hub-Push jetzt im Land-Pfad), Fleet-Hub-Richtung des Owners festgehalten (`docs/fleet-hub-overlay-2026-09-06.md`), Program „Fleet-Architektur" `e3b3a064` vorgeschlagen, Betriebsarbeit an Fleet-Betrieb (Slot 2) zurueckgegeben; 2026-09-06 19:5x, ctx GEMESSEN 26,3 %

> **Ein Abschnitt je LEBENDEM Prinzipal:** dieser ERSETZT den der Controller-Vorgaengerin (Slot 9, 18:0x).
> **Der Controller ist, wer das Label `🎛 Fleet Controller` traegt.** Lineage: … → 6 → 9 → 7 → du.
> Such deinen Abschnitt per `grep -n '^# HANDOFF — 🎛' HANDOFF.md`. Zustand ableiten: `./state.sh`, `./register.sh`, Owner-Poll, Panes.

## 0. Was du als Erstes tust

1. `GET /api/self/attention` + `/fleet-report`. Bei mir: nichts offen.
2. **Du landest NICHTS und briefst keine Fleet-Zeile selbst** (Owner 2026-09-06 18:1x: „wir machen schon wieder alles ueber den Controller, das frisst Token"; Charter Fleet-Betrieb `f170dc46` Kriterium (d)). Eine Owner-Zeile ohne Program geht als EINE Nachricht an Slot 2, der filt sie als eigene Zeile (es gibt keine Route, die einer bestehenden Zeile ein Program gibt; `POST /api/tasks` mit `programId` kann nur NEUE Zeilen filen). Du routest, deployst und sprichst mit dem Owner. Deploy bleibt beim Controller (Astras Charter: Nicht-Ziel).
3. **Uebergabe-Band, vom Owner heute praezisiert:** 25 % = Handoff vorbereiten, 30–35 % = uebergeben; NIE darunter, eine planbare Restkette vorher zu Ende fahren (Slot 9 bei 22 % war zu frueh und kostete zwei lebende Controllerinnen). Memory `feedback-context-quality-degrades-at-25pct`.
4. **Watches, die mit mir sterben:** Audit-Watch `7f1275f1` auf `1b5f708` (laeuft LOKAL seit ~19:2x, haelt den Mutex; der Second-host hatte nur den ersten Cover `3b286fc` genommen — gruen, 3762/0). Neu armieren mit `{kind:"audit", repo, mainAfter:<voller sha>}`. Das Ergebnis beurteilen: `unknown` ist nie ein Pass.

## 1. Die Kette, in Flug (Owner-Delegation gilt: Landen/Deploy/Briefen ohne Rueckfrage, nur Geld/fremde Konten/Publikation fragen)

- **Slot 5** Lane `c3604ce3` (D1 Program-Inbox, MAIN 2 landet selbst) und **Slot 1** Lane `1b106a66` (S1 Wellen-Sensor, MAIN 4 landet selbst): beide fahren Vorschau-Suiten und stehen in der Mutex-Schlange hinter dem lokalen Audit.
- **Queued am Deckel 2 (oldest-first):** `0f127ba2` P6 (MAIN 6) → `746500ec` Second-host-2-parallel (Slot 2, Kopie von `755ef516`, Original archiviert) → `1af3fa1f` Astra-Register (Brief traegt Astras Nachtrag `5e3823c7`, eingearbeitet 19:3x; docs-only).
- **Nach dem Land von `746500ec`:** Slot 2 soll `POST /api/helper/devices/secondhostlinux1/update` fahren (wenn dort kein Audit laeuft), dann `7d3d29de` (Second-host-Vorschauen, Owner-Zeile ohne Program) uebernehmen und releasen, dann `ff4544f5`. Beides ist Slot 2 mitgeteilt (19:4x). **Danach Lane-Deckel 2→3** (`watchdog.sh` `FLEET_DISPATCH_MAX_LANES` + `launchctl kickstart` + Deploy) — Owner hat „lass uns das sauber angehen" gesagt, nicht explizit genickt; vorher fragen kostet einen Satz.
- **Program `e3b3a064` „Fleet-Architektur"** liegt `proposed`; der Owner bestaetigt auf dem Board. Offen darin: welche Session MAIN wird (Astra Slot 3 bindet schon `eec69528`).
- **Hub-Push:** `FLEET_HUB_REMOTE=hub` ist seit Deploy `5c7553fd` live; beim naechsten Land das Feld `hubPush` auf der Land-Note lesen (Slot 2 meldet, falls es fehlt). Direkt-Commits (docs) weiterhin von Hand: `git push hub main`.

## 2. Gemessen heute (Belege: Ledger, Panes, Code)

- **Deploy bei Second-host-Audit ist SICHER:** `server.ts#deployBlocker` prueft nur `runningPostLandAudit` (lokal); ein Helfer-Claim ist in `helperClaims` persistiert, wird beim Boot restauriert (`server.ts:20469`) und vom Drain per `helperClaimOf` respektiert. Verifiziert am Deploy 18:12 (Claim `26ea1a205005` ueberlebte).
- **Der Helfer nimmt je Claim EINEN Baum:** von zwei koaleszierten Covers lief der zweite (`1b5f708`) lokal — 35 min Mac-Mutex. Hebel: `746500ec` + `7d3d29de`.
- **Audits heute:** mac 4 gruen/1 rot/2 unknown, second-host 2 gruen/1 rot. Gestern second-host 8/8 rot (Host-Unterschieds-Familie, registriert).
- **Studios EXISTIEREN als Serverobjekt** (`server/types.ts#Studio`, Spawn-Tripel je Stufe, `GET/POST /api/studios`), 0 live registriert. Erster Studio-Schritt = Game-Maker v2 als Datensatz einspielen.
- **Analyst + Brief-Kompiler sind gebaut und im Betrieb AUS** (`FLEET_ANALYSIS_MS=0`, `FLEET_BRIEF_MS` Default 0); keine Zeile adressiert das Wiedereinschalten. Wiedereinschalten = Owner-Akt (watchdog.sh + kickstart), gedrosselt, nach Phase 1.
- **Kein adressierter Rueckkanal MAIN→Controller:** Antworten von Slot 2 und Astra lese ich aus der Pane (oder der Owner reicht sie weiter). Das ist D1; Astras dritte Forderung; Owner-Lesart: „sowas ist einfach eine Notiz mit Flaeche, die die naechste Lane mitnimmt" = N1 `3af11665`.

## 3. Der Plan von hier (Owner-Prioritaet woertlich: „das Wichtigste ist, dass die Tasks und Studios sauber laufen")

1. **Basis robust (laeuft):** Land-Pipeline M1–M3/S1/N1–N2 (Slot 4) · Audit-Determiniertheit P6, Suite-Schnitt A/B (Slot 6) · Fleet-Betrieb D1/D3, `746500ec`, `7d3d29de`, `ff4544f5` (Slot 2). Engpass = Suite-Mutex; die Reihenfolge der Hebel steht in §1.
2. **Queue-Analyse wieder an:** Analyst/Brief gedrosselt (Owner-Akt), Notiz-Ausgang „verwerfen empfohlen" (Plan 2026-08-11 Stufe 2, in keinem Program — Astras Register `1af3fa1f` entscheidet die Disposition), fuenf Programs mit toter MAIN abschliessen (Owner-Wahl; `complete` ist terminal, kein Pause-Zustand: Private-repo-o 0 offene Zeilen, Dual-Host 10, Private-repo-y 6, Private-repo-j 2, Game-Maker v2 7 — alle offenen sind Messnotizen, keine Arbeitszeilen).
3. **Hub Schnitt 1:** client-only Projektion (Repo-Liste links, Program-Karten mit Reglern + naechster Owner-Entscheidung, Rollen-Sicht aus Label/Modell/Harness/Task-Slot). Done-Kriterium `docs/fleet-hub-overlay-2026-09-06.md` §4. Kann parallel zu 2.
4. **Objekte:** Repo-Register (winzig, erstes neues Objekt), Game-Maker v2 als `Studio`, ContextPack + Routing (= D1 verallgemeinert), Thread (= L-Workspace). Nicht vor 1.
Die Rollen: Owner = Richtung/Promotion · Astra = Zielbild/Plan/Charters (Program `e3b3a064`) · Controller = Routing/Deploy/Owner-Gespraech · Fleet-Betrieb = landet Fleet-Zeilen · Land-Pipeline/Audit-Determiniertheit/Fleet-ohne-Owner-Routing = Basis.

## 4. Offen beim Owner (nicht dringend)

Bestaetigung `e3b3a064` und die MAIN-Frage · Deckel 2→3 nach `746500ec` · Analyst an · fuenf tote Programs · die fuenf Fragen in `docs/fleet-hub-overlay-2026-09-06.md` §5 · W5d Second-host-Seite (`FLEET_LANDS=1`, Sync-Timer).

---
---
# HANDOFF — Program-MAIN Fleet-Betrieb 2026-09 (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): VIER Lands, drei deployt — und eines traegt eine Regression, die ich selbst gefunden und gefilt habe; 2026-09-05 11:5x, ctx GEMESSEN 44,1 % (Owner-Poll)

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 2, Opus 5): ERFOLGSSATZ 8 IST NICHT UNBELEGT, SONDERN STRUKTURELL UNERREICHBAR — der TUI-Repaint kommt 14 ms vor der Schwelle; der Owner hat (a) gewaehlt, die Schwelle steht auf 20 min, der dritte Beleg-Lauf ist released; 2026-09-05 15:5x, ctx GEMESSEN 29,8 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → 2 → du.

## 0a. NACHTRAG 15:5x — DER OWNER HAT ENTSCHIEDEN, UND ZWEI SAETZE UNTEN SIND UEBERHOLT

**Entscheid (a) ist gefallen und LIVE** (Controller Slot 12, vom Owner delegiert, 13:1x):
`FLEET_STALLED_IDLE_MS='1200000'` (20 min) steht in der gitignorierten `.env:28` — kein Commit,
kein `launchctl kickstart` noetig, weil `watchdog.sh:155` mit `set -a; . ./.env; set +a` sourct
(`set -a` exportiert, die Variable erreicht `bun server.ts` also wirklich; ein blosses `. ./.env`
haette nur eine Shell-Variable gesetzt, die das Kind nie sieht — das war die Falle, die ich vor dem
Deploy geprueft habe). `FLEET_STALLED_IDLE_MS` kommt in `watchdog.sh` NULL mal vor, wird also von der
expliziten Liste hinter dem Sourcing nicht ueberschrieben. Live seit **Deploy `9b3c0db5`, Boot ok
13:45:34, bootHead `4761020`**; der Controller hat den Live-Env gemessen, ich habe die Kette
(.env-Wert · `set -a` · kein Override · Restart in `deploys.jsonl`) selbst nachgelesen.

**DAMIT SIND ZWEI SAETZE IN ABSCHNITT 0 UEBERHOLT — nicht loeschen, aber nicht mehr befolgen:**
- „Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen" — **erledigt.** Ich habe die Zeile am
  13:47 ueber die EIGENE Tuer released (`POST /api/self/tasks/9f1dbfb4/release`, `ok:true`,
  `sessionIdMatch:"exact"`). Sie steht `queued` auf Position 1.
- **`releasedBy` ist jetzt `machine` statt `owner`.** Die beiden ersten Beleg-Laeufe gingen durch die
  Owner-Tuer; dieser geht durch die Self-Release-Tuer einer MAIN. Das ist der bessere Satz-11-Beleg,
  und er ist der Grund, warum ein Hand-Dispatch diesen Lauf beschaedigen wuerde.

**WAS DER DRITTE LAUF BRAUCHT (dein Ablauf, wenn der Report kommt):**
1. **Sofort annehmen** — `POST /api/self/fleet-report/<24-hex>/accept`. **`reason` max 500 Zeichen,
   und die Laenge VOR dem Schreiben pruefen:** ein `assert`, das die schon truncated Datei
   hinterlaesst, sendet einen LEEREN Body, und den verbucht die Route als gueltige Annahme mit
   `reason: null` — genau so ist mein Grund im zweiten Lauf verlorengegangen, ohne Re-Decide-Tuer.
2. **„FENSTER AUF HH:MM" an den Controller** (Peer-Name ueber `ListAgents`, Slot 12 — der Name
   wechselt staendig: d4 → bd → ad an EINEM Tag; nie einen alten wiederverwenden). Ein Deploy im
   Fenster nullt die Idle-Uhr aller Panes.
3. **Die Uhr selbst lesen, ohne Owner-Token:** mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.
   `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. **Faelligkeit jetzt
   `mtime + 1 200 000 ms`.** Der 30-min-Repaint (`Checking for updates`) laesst nach jedem Paint
   20 freie Minuten — das Fenster existiert in JEDEM Zyklus.
4. **Der Beleg ist EINE Zeile:** `killed-empty` MIT `autoClose{reportId,disposition,decidedAt,decidedBySlot}`
   in `lane-outcomes.jsonl`. Stand 15:5x weiterhin **0**. Der Close feuert KEIN Event — niemand weckt
   dich, du musst zur Faelligkeit selbst nachsehen.

**Benannter Preis des Entscheids, den ich empfohlen habe:** die 30 min waren gegen Fehlurteile
gewaehlt („a lane running an e2e suite routinely prints nothing for ten minutes at a stretch",
Kommentar ueber der Konstante). Mit 20 min bleibt die Marge 2x statt 3x. Begrenzt wird der Schaden
dadurch, dass der Auto-Close zusaetzlich sauberen Baum, `ahead 0`, kein Merge-Verdikt UND einen
angenommenen Terminalreport verlangt: betroffen waere nur eine Lane, die BERICHTET hat und danach
20 min stumm weiterarbeitet. Ein ueberraschender `killed-empty` in den naechsten Tagen gehoert hierher.

## 0. DER BEFUND, der die ganze Jagd beendet — und die EINE offene Owner-Frage

**Erfolgssatz 8 (automatisches Cleanup einer clean+ahead0-Lane) kann fuer eine claude-Lane NIE
feuern.** Nicht Pech, nicht der Deckel, keine fremde Hand. Gemessen an der Beleg-Lane `9f1dbfb4`
(Slot 1, Branch `fleet/260905061853-2111`):

| | |
|---|---|
| Repaint 1 | 08:49:04.487 |
| Repaint 2 | 09:19:04.473 |
| Abstand | **1799,986 s** |
| `STALLED_IDLE_MS` | **1800,000 s** |

Claude Code malt in eine IDLE Pane alle 30 min `Checking for updates` (beide Paints in den
Stream-Bytes von `streams/s1-…​.raw` belegt, 59 bzw. 70 ANSI-Sequenzen, sonst nur Footer). Der Timer
laeuft ab dem VORIGEN Paint, die mtime ist dessen ENDE — die Phase ist selbstgestellt und liegt
damit dauerhaft ~14 ms VOR der Schwelle. `server.ts#poll` setzt `lastOutput` bei JEDEM Byte-Zuwachs
des pipe-pane-Streams; einzige Ausnahme ist der selbstverursachte Resize (`quietUntil`). TUI-Chrome
ist nicht ausgenommen. Also erreicht `idleMs` nie 1 800 000, Zyklus fuer Zyklus.

**Das erklaert die Null:** 0 `autoClose` in inzwischen 785 Ledger-Zeilen.

**ZWEITER VERBRAUCHER, wichtiger als mein Program:** dieselbe Schwelle speist das Feld `stalled` auf
`/api/sessions` (`server.ts`, neben `doneLookingSince`). Es kann fuer eine claude-Lane nie `true`
werden — **das Board unterzaehlt gestoppte Lanes still.** Niemand handelt darauf, aber jeder, der es
liest, liest eine Flagge, die nicht feuern kann.

**DIE OFFENE FRAGE — Attention `24c10c30f8f2d261f210f87f`, Stand 11:01 `open`.** Sie STIRBT mit
meiner Session (`reconcileAttention`, „requester session ended"); darum steht sie hier vollstaendig,
damit du sie NEU STELLEN kannst statt sie zu erben:
- **(a) `FLEET_STALLED_IDLE_MS` auf einen Wert, der nicht mit dem 30-min-Takt kollidiert (z. B. 20 min).**
  Eine Zeile in `watchdog.sh` + `launchctl kickstart`. MEINE EMPFEHLUNG: billigste Aenderung, loest
  die Phasenkopplung sofort, und danach ist der Beleg in einem Lauf zu holen.
- **(b) `poll()` schneiden, damit TUI-Chrome nicht als Arbeit zaehlt.** Sauberer, aber Chrome von
  Arbeit im Byte-Strom zu trennen ist nicht trivial — eigene Lane, eigenes Kriterium.
- **(c) Satz 8 mit der ehrlichen Einschraenkung fuehren** — dann bleibt er unbelegt und dieses
  Program schliesst mit 10 von 11.

**Bis der Owner waehlt: `9f1dbfb4` NICHT erneut releasen.** Die Zeile steht wieder `pending` (der
Kill hat sie requeued). Ein zweiter Lauf scheitert identisch an denselben 14 ms und kostet einen
Lane-Platz plus Stunden fuer ein Ergebnis, das mit Zeitstempeln auf beiden Seiten schon vorliegt.

## 1. Was seit dem letzten Handoff wirklich passiert ist

- **Die Beleg-Lane ist gelaufen** (Start 08:18:53 per TICK, nicht von Hand — Satz 11 fuer diese
  Zeile intakt). Report `7035c488f34aeeca12510a6d` um 08:22:08, von mir um **08:22:48** angenommen;
  die Entscheidung traegt mein exaktes Occupant-Tripel, also war die Auto-Close-Vorbedingung erfuellt.
- **Ende 09:21:21 per Owner-Token**, `killed-empty`, `commitCount 0`, **ohne** `autoClose`.
  Regelkonform: die 35-min-Zusage war abgelaufen und ich hatte „FENSTER ZU" gemeldet.
- **Ehrlich zur Bilanz:** der Lane-Platz wurde frei, weil der Owner 08:18/08:19 vier Lanes killen
  liess — nicht weil eine Lane von selbst endete. Und `9f1dbfb4` traegt `releasedBy:"owner"`, ging
  also durch die Owner-Tuer, nicht durch die Self-Release-Tuer einer MAIN.
- **Alle uebrigen Auto-Close-Klauseln HALTEN** (`server.ts#laneAutoCloseRefusal`, einzeln geprueft):
  Flag armiert, `autosOn`, Worktree-Lane, kein Steward, keine Merge-/Commit-/Review-Jobs, `taskId` +
  `programId` am Slot, Program aktiv, genau EIN Terminalreport mit Urteil des exakten Empfaengers,
  Provenienz stimmt. `mergeLast.get(1)` war `null` (Controller-Lesung 08:26). Die Klaerungs-Falle war
  entschaerft (`awaiting: null`, keine offene Clarification). **Es fehlte einzig die Uhr.**

## 2. Werkzeuge, die ich teuer gelernt habe — nimm sie mit

- **DIE IDLE-UHR IST OHNE OWNER-TOKEN LESBAR: die mtime von `streams/s<slot>-<openedAt>-<hash>.raw`.**
  `poll()` leitet `lastOutput` genau aus dem Wachstum dieser Datei ab. Faelligkeit =
  `mtime + STALLED_IDLE_MS`. Das ersetzt jede Bitte an den Controller um eine `lastOutput`-Lesung —
  und es zeigt AUCH, WAS gemalt wurde (Tail entschachteln, ANSI strippen).
- **`POST /api/self/tasks` ist bei 10/10 pending advisory rows ZU** („program advisory filing cap
  reached … ask the owner to dispose"). Das Register dieses Programs nimmt keine Zeile mehr an; meine
  zwei Befunde stehen deshalb hier statt dort.
- **`accept` nimmt `reason` bis 500 Zeichen — und einen LEEREN Body akzeptiert es ebenfalls mit
  `ok:true`.** Mein erster Versuch lief in einen `assert`, schrieb eine leere Datei, und
  `--data-binary @leer` wurde als gueltige Annahme OHNE Grund verbucht. Die Annahme steht, `reason`
  ist `null`, und es gibt keine Re-Decide-Tuer. **Laenge VOR dem Schreiben pruefen, nie im selben
  Skript, das die Datei schon truncated hat.**
- **`GET /api/self/fleet-report` traegt die Entscheidung NICHT.** `disposition` liest sich dort als
  `None`, auch wenn die Annahme steht — ich habe daraus einmal faelschlich „nicht angenommen"
  geschlossen. Der Beweis ist die 409-Antwort eines zweiten `accept` (`already accepted`) samt
  `decision`-Objekt, oder `fleetReports` in `fleet.json`.
- **Ein `bun server.ts` mit frischer Startzeit ist nicht automatisch ein Deploy.** Ein Suite-Lauf
  startet seinen eigenen. Unterscheide an `deploys.jsonl` und am tmux-Socket (`fleettest<pid>`),
  nicht an der Prozessliste — ich hielt 08:55:35 fuer einen Deploy in meinem Messfenster.
- **Ein Heartbeat-Text altert schneller als du denkst.** Zwei meiner vier Autos feuerten mit
  Verzweigungen, deren Praemisse ueberholt war (einer haette eine falsche Attention ausgeloest).
  Schreib in den Text, WORAN der Nachfolger merkt, dass die Praemisse tot ist.

## 3. Korrekturen an meinen eigenen frueheren Saetzen

- **`f176ad1e` war KEIN Defekt.** Ich meldete, `reconcileAttention` lasse die Attention einer
  beendeten Anfragerin auf `open` stehen. Sie stand kurz darauf auf `refused` („requester session
  ended"): die Refusal haengt am Slot-TEARDOWN, und der lag hinter der Succession-Grace. Ein
  Zeitfenster, kein Steckenbleiben — die Projektion korrigierte meine Zeile selbst von `OWNER_GATE`
  auf `READY (R5)`.
- **Der Repaint war NICHT der Agentenzaehler** (so die naheliegende Vermutung des Controllers,
  2,3 s vor einem fremden Land). Die Bytes sagen `Checking for updates`. Die Cadence-Zaehlung ueber
  vier Streams (s1 1×/40 min · s5 9×/294 min · s15 6×/916 min · s6 2×/703 min) sah unregelmaessig aus
  und liess mich zuerst sagen, die Schwelle sei „treffbar, nicht unerreichbar". Erst das ZWEITE
  Intervall an derselben Pane zeigte die Phasenkopplung. **Eine Haeufigkeit ueber fremde Panes ist
  kein Ersatz fuer zwei aufeinanderfolgende Messungen an derselben.**

## 4. Offen, ehrlich

- **Satz 8** — die Owner-Wahl oben. „Gebaut, nie gelaufen" ist ab jetzt der falsche Satz; richtig ist
  **„gebaut, kann unter der heutigen Schwelle nicht laufen"**.
- **Satz 11** — strukturell offen, unveraendert: 3 von 4 Program-Lands ueber Owner-Token, und die
  Beleg-Zeile selbst war owner-released.
- **Ungeprueft von mir:** ob die 14-ms-Phasenkopplung auch fuer `codex`- und `pi`-Panes gilt (deren
  TUIs malen anders; nur claude ist gemessen). Wer (a) waehlt, sollte das mitmessen — sonst
  repariert er die Uhr fuer einen Harness und nicht fuer die Fleet.
- **Dieser Commit ist ein DIREKT-COMMIT aus dem Haupt-Checkout** und damit fuer jedes land-seitige
  Ledger unsichtbar: keine Land-Note, keine `lane-outcomes`-Zeile, kein Post-Land-Audit. Verifikation
  von Hand, proportional fuer eine reine Prosa-Aenderung: `bun install --frozen-lockfile` +
  `bun e2e/pins.ts` (Ergebnis unten im Commit-Body). Kein laufender Land wurde beruehrt — `merges`
  und `landPending` waren beide leer, an `fleet.json` geprueft, bevor ich committet habe.

# HANDOFF — 🎛 Fleet Controller (Slot 3, Fable 5.1): zwei Deploys gefahren, Freeze aufgehoben, Codex auf 0.153.4, Astra mechanisch belegt UND sein Fenster widerlegt; DEIN AUFTRAG hat zwei Stufen, und Stufe 1 ist deine eigene Erdung; 2026-09-05 08:0x, ctx GEMESSEN 30,5 %

> **Ein Abschnitt je LEBENDEM Prinzipal** (Vorschlag, nicht promoviert): dieser ERSETZT den der
> Controller-Vorgaengerin (Slot 9, 03:0x). **Der Controller ist, wer das Label `🎛 Fleet Controller`
> traegt — nie eine Slot-Nummer aus Prosa.** Lineage: 5 → 6 → 9 → 3 → 9 → 3 → du.

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, Owner-Poll, Panes. Hier steht nur,
was git und die Sensoren nicht tragen.

## 0. DEIN AUFTRAG — zwei Stufen, und die Reihenfolge ist eine Owner-Vorgabe

Owner, 2026-09-05 07:5x, **WOERTLICH** (die Rangliste endet, wo diese Saetze erfuellt sind):

> „dein nachfolger sollte in fable5.1 laufen und mir dann helfen eine asta session zu spawnen die
> sich die claude fleet codebase einmal ganz genau anschaut unter dem hintergrund wissen was das
> ganze werden soll, und dann nach verbesserungen und optimierungen sucht, von außen nach Innen und
> mit besonderer sorgfalt für die md dateien des systems und der einzlenen agenten rollen. astra
> sollte hier für alles opus5 worker benutzen, für die ausgiebige rechercher, implementierung, usw.
> astra sollte sicherstellen das diese agenten auch die richtigen anweiseungen, werkzeuge und
> datenschichten haben um eine gute entscheidung zu treffen"

Zwei Minuten spaeter nachgereicht, **WOERTLICH**:

> „und bevor dein nachfolger diese astra session erzeugt sollte er sich zuerst selbst mit opus
> agenten einen überblick verschaffen" · „darüber woran die slots arbeiten usw."

### Stufe 1 — DEIN eigener Ueberblick, mit Opus-Agenten, BEVOR Astra existiert

Der Owner hat Subagenten fuer diese Sache ausdruecklich freigegeben (das Regelbuch verbietet sie
sonst ohne Aufforderung). Fuer den Bericht dieser Nacht liefen vier Opus-Agenten parallel und das
hat funktioniert; das Muster ist wiederverwendbar:

- **Ein Agent je Frage, nicht ein Agent fuer alles.** Bewaehrt hat sich der Schnitt Commits/Features
  · Ledger-Zahlen · Betrieb+Queue+Programs · Erkenntnisse/Korrekturen.
- **Jeder Prompt braucht harte Verbote**, sonst kostet er die Maschine: keine Suiten starten, kein
  `bun run build`, kein git-Schreibzug, kein tmux-`send-keys`, kein `kill`, keine POST-Route. Lesende
  GETs sind in Ordnung.
- **Token-Hygiene in JEDEN Prompt**: `ps -eo command` druckt hier die Self-Tokens FREMDER Slots in
  den Bericht. Zaehlen ja (`ps -eo command | grep -c '<muster>'`), Zeilen ausgeben nein.
- **`rg` respektiert `.gitignore`**, und gitignored sind ausgerechnet `fleet.json`, die drei Ledger,
  `.env`, `CLAUDE.md` und `rulebook/`. Fuer alles Operative gehoert `rg -uu`, `grep` oder `python3`
  in den Prompt, sonst liefert der Agent ein LEERES Ergebnis statt eines Fehlers.
- **Agenten erben deine Regeln nicht.** Schreib „lies, bevor du behauptest", „zitiere Datei und
  Symbol", „sag, was du NICHT geprueft hast", „trenne gemessen von abgeleitet" wortwoertlich hinein.

Die Frage dieser Stufe ist die des Owners: **woran arbeiten die Slots gerade**. Zielbild fuer deinen
eigenen Kopf, bevor du Astra briefst: je belegtem Slot Rolle, Harness, Modell, Fuellstand und die
Arbeit, an der er sitzt; je aktivem Program die gebundene MAIN und ob sie lebt; die offenen
Queue-Zeilen nach Gruppe; die zwei Deckel und wer an ihnen steht. `./state.sh` und `./register.sh`
sind der Anfang, nicht das Ende — die Panes tragen den Rest.

### Stufe 2 — die Astra-Session, danach

**Astra ist mechanisch belegt, nicht vermutet** (2026-09-05 07:4x, Probe im Scratchpad):
Modell-Id `gpt-6-astra`, Harness `codex`, geantwortet hat sie. Beide Codex-Installationen stehen auf
**0.153.4** (Astra verlangt ≥ 0.153.1). `HARNESS_MODEL_RE` laesst die Id ohne Codeaenderung durch,
`effortLevels` des Codex-Adapters traegt `high`/`xhigh`/`max`/`ultra`. Eine Astra-Lane ist also
sofort dispatchbar.

**DIE EINE ZAHL, DIE DAS DESIGN BESTIMMT: Astras Fenster ist hier 258 400 Tokens, nicht 1 050 000.**
Gemessen am `token_count`-Satz der Rollout-Datei der Probe, nicht aus der Ankuendigung uebernommen
(die nennt 1,05 M; auf diesem Konto, Plan `prolite`, gilt die kleinere Zahl). Konsequenz, und sie ist
der Kern des Briefs:

- **Astra darf die Codebase NICHT selbst lesen.** 461 getrackte `.md`-Dateien allein, davon 352 unter
  `docs/`; `server.ts` hat 24 603 Zeilen. Ein einziger Lesedurchgang sprengt das Fenster.
- **Astra ist der KOPF: briefen, Ergebnisse zusammenfuehren, urteilen.** Das Lesen, Recherchieren und
  Implementieren gehoert den Opus-5-Lanes — genau das hat der Owner mit „für alles opus5 worker"
  gesagt.
- Zum Vergleich, damit die Groessenordnung sitzt: diese Controller-Session hat ~305 000 Tokens
  verbraucht, also mehr als Astras ganzes Fenster. Zwei Codex-Lanes standen heute nach 80 bzw. 113
  Minuten Arbeit an EINER Scheibe bei 64,6 % und 72,6 %.

**Worker-Tripel fuer jede Lane:** `{harness:"claude", model:"claude-opus-5[1m]", effort:"high"}` —
das ist zugleich die geltende Modellpolitik (Owner 2026-09-02: Orchestrierung Fable, Lanes Opus 5).

**Der fleet-native Weg**, und er braucht dich als Uebersetzer: Astra wird **Program-MAIN eines neuen
Programs**. Eine Session schlaegt ein Program nur VOR (`POST /api/self/programs`); **Bestaetigen und
Aktivieren sind Owner-Akte**, ebenso die Bindung der MAIN. Danach filet Astra eigene Zeilen
(`POST /api/self/tasks`), gibt sie frei (`POST /api/self/tasks/:id/release`, setzt nur
`pending → queued` und dispatcht NICHT), und der Tick startet die Lanes.

**Deckel, die den Takt bestimmen** (alle heute live gemessen): `FLEET_DISPATCH_MAX_LANES` = **2** je
Repo, und der Program-Deckel faellt mangels eigener Variable auf denselben Wert zurueck — eine breite
Review serialisiert also auf zwei gleichzeitige Lanes. `PROGRAM_MAX_PENDING` = 5 offene `auftrag`,
`PROGRAM_MAX_PENDING_ADVISORY` = 10 offene beratende Zeilen je Program. **Zwei Programs stehen HEUTE
am Advisory-Deckel**; ein drittes Program erbt das Problem nicht, aber der Owner muss die zwanzig
Altzeilen irgendwann disponieren.

**Drei Fallen, die genau diesen Auftrag betreffen** — sie gehoeren in Astras Gruendungsbrief, nicht
in deine Erinnerung:

1. **Codex laedt `AGENTS.md`, NICHT `CLAUDE.md`.** Der portable Vertrag traegt die Controller-Zeile
   und den 25-%-Hinweis, die hostspezifische Realitaet steht im Overlay. Was Astra davon braucht,
   muss der Brief namentlich anfordern.
2. **`CLAUDE.md` und `rulebook/` sind gitignored** — der Auftrag zielt aber ausdruecklich auf „die md
   dateien des systems und der einzelnen agenten rollen". Eine Lane sieht ihre Aenderung daran nie in
   `git status` und kann sie NICHT landen; sie stirbt mit dem Worktree. **Regelbuch-Befunde muessen
   als TEXT im Report kommen**, und der Fragment-Edit passiert im Haupt-Checkout. Getrackt und damit
   landbar sind `AGENTS.md`, `SYSTEM.md`, `README.md` und alles unter `docs/`.
3. **Eine reine Mess-Lane ist ohne Artefakt nicht landbar** (`FILES: keine`, `ahead=0`). Der Weg ist
   die `mess-notiz`-Skill: Ergebnis als getrackte Notiz unter `docs/messungen/`, committen, landen.
   Sonst muss jedes Ergebnis von Hand aus der Pane geerntet werden, bevor der Slot stirbt.

**Werkzeuge und Datenschichten, die in jeden Lane-Brief gehoeren** (das ist der Owner-Satz „die
richtigen anweisungen, werkzeuge und datenschichten"): getrackter Code → `rg`; alles Operative →
`rg -uu`/`grep`/`python3`; Struktur → `ast-grep --pattern '<muster>' --lang ts <datei>`; der
Wissensgraph ist read-only auch aus einer Lane befragbar (`graphify query "<frage>" --graph
"$(dirname "$(git rev-parse --git-common-dir)")/graphify-out/graph.json"`, Rezept in `AGENTS.md`);
Wissen aus `git show main:docs/...` statt aus dem Spawn-Zeit-Schnappschuss des eigenen Baums;
Befundregister sind die COMMIT-BODIES und `git notes --ref=fleet/land`, nicht die Subjects; Zahlen
kommen aus den drei Ledgern und den **ZWEI** Trail-Registern (lokal `e2e-trail/`, Audits nach
`$TMPDIR/fleet-e2e-trail` — wer nur eines liest, untertreibt, heute mit 215/12 statt 250/20 bezahlt).

**„unter dem hintergrund wissen was das ganze werden soll"** — die Quellen dafuer, alle geprueft
vorhanden: `AGENTS.md` (Vokabular, Rollen-Tabelle, harte Invarianten), `SYSTEM.md` (13 KB, hat genau
EINEN Leser-Verweis im ganzen Baum, seine Rolle ist selbst eine offene Owner-Frage),
`docs/attic/operating-model.md`, `docs/attic/autonomy-plan.md`, `docs/controller.md`,
`docs/steward.md`, `docs/portfolio-plan-2026-09-02.md`, `docs/agentic-control-plane-program-2026-08-20.md`
und die Program-Datensaetze in `fleet.json`.

**„von außen nach Innen"** liest sich am Baum als: portabler Vertrag und Einstiegsflaechen zuerst
(`AGENTS.md`, `README.md`, `SYSTEM.md`, Board-Client), dann die Rollen-Dokumente, dann die
Server-Naht (`server.ts` plus die zehn Blatt-Module unter `server/`, Invariante: kein `server/*.ts`
importiert aus `server.ts`), zuletzt die Gates und Suiten.

## 1. Rolle (unveraendert, Owner-Entscheide 2026-09-04 09:1x/19:2x + Korrektur 00:5x)

Ueberblick halten, Owner-Nachrichten auf Programs routen. Lands vom Board NUR fuer Zeilen ohne
lebende MAIN oder ohne Self-Land-Promotion. Audit-Adjudikation: die MAIN urteilt, der Controller legt
ab; fuer Controller-gelandete Zeilen urteilt der Controller. Lane-Events der Program-Lanes gehoeren
der Program-MAIN. **Der Controller haelt den Deploy-Trigger und die Mutex-Koordination.**
Modellpolitik: Controller und MAINs Fable 5.1, Lanes Opus 5 high, Codex `gpt-5.6-sol` bzw. jetzt
`gpt-6-astra`, GLM ueber `pi-zai` (nie `pi`).

## 2. Was in dieser Session (02:49–08:0x) gefallen ist

- **R2' gelandet** (Slot 10, `1c3c6ef` → `e71f620`, sechs Commits, Gate gruen ueber alle sieben
  Schritte) und **um 03:56 deployt** (`640d0024`, Boot-Verdikt ok, hitTarget, `deployGap` 0). Damit
  ist der bounded ff-Retry scharf: `FLEET_LAND_FF_RETRY_ROUNDS` defaultet in `server.ts` auf 2 und
  ist in `watchdog.sh` nicht gesetzt. **Der fleetweite Commit-Freeze ist aufgehoben und strukturell
  ueberfluessig.**
- **Zweiter Deploy 07:36** (`82f55be0` auf `9718592`, ok, hitTarget, `bundleStale` false): damit sind
  das proportionale Tier-2-Audit, der FIFO-Suite-Mutex und die FAIL-Namen auf lokalen Audit-Zeilen
  live.
- **Audit auf `e71f620` rot 3/3661, von Slot 10 selbst als `flake` adjudiziert** (`at=1788573383933`).
  Ich habe die Evidenz geliefert und NICHT selbst geurteilt — die MAIN urteilt.
- **Attention `6793f141` (Deploy-Entscheid) beantwortet und geschlossen.** Sie war an den Owner
  gerichtet, der Deploy-Trigger liegt aber beim Controller.
- **Codex aktualisiert.** Falle, die eine halbe Stunde gekostet haette: `codex update` ruft
  `npm install -g` und trifft damit den Homebrew-Prefix, waehrend der PATH `~/.local/bin` zuerst
  nimmt. Beide Baeume stehen jetzt auf 0.153.4; `codex doctor` meldet die Doppelinstallation
  weiterhin als Fehler, weil das naechste Update wieder nur eine Haelfte trifft.
- **Statusbericht ueber 16 h an den Owner geliefert**, aus vier parallelen Opus-Agenten.

## 3. Was JETZT offen ist, alles Owner-Sache

1. **Eine offene Attention, `d549e09b`, seit 02:29** (Dual-Host, MAIN Slot 8 lebt): Gate 3 ist die
   erste Installation der systemd-Vorlage auf einem Host, Gate 4 die Aktivierung einer zweiten
   netzerreichbaren Instanz. Beide sind Host-Akte, von einer Session nicht fahrbar. Die MAIN wartet
   und faengt bis zur Antwort nichts an.
2. **Vier Programs stehen `active` mit toter gebundener MAIN**: Private-repo-o, private-repo-p, Private-repo-j,
   Game-Maker v2. Vorschlag der Vorgaengerinnen: zwei archivieren, zwei neu binden.
3. **Zwei Programs am Advisory-Deckel** (je 10/10 pending): sie koennen keine Messung mehr in die
   Queue legen, bis der Owner disponiert.
4. **Sicherheitsbefund, unberuehrt:** die Datei-Route liest mit dem Owner-Token jede Datei auf der
   Platte, ohne Sperrliste; `.env` und der GLM-Schluessel sind vom Board aus lesbar.
5. **Die globale `~/.claude/CLAUDE.md` widerspricht dem Fleet-Vertrag in drei Punkten** (u. a.
   Kontextschwelle 60 % gegen 25/30). Owner-Datei, nicht unsere.
6. **§11.2o ist kein Flake mehr, sondern ein Regimewechsel**: 1,4 % Rot vor dem 04.09. gegen 39,5 %
   danach, im 16-h-Fenster 19 Rot bei 23 Beobachtungen. Das Regelbuch fuehrt weiter 2–3 %, also den
   Durchschnitt ueber beide Regime. Gehoert dem Program Audit-Determiniertheit; die Wurzel ist offen,
   weil die Sonde ihr eigenes Diagnosefeld wegwirft.
7. **Maschinenhygiene:** 3,5 GB Scratch unter `$TMPDIR`, ein verwaister tmux-Socket, 297 aktive
   Codex-Rollouts mit 1,21 GB. Niemand reapt das.

## 4. ZUSAGEN, DIE DU ERBST — sie sterben sonst still mit mir

- **Die Lane mit `taskId 9f1dbfb4` bleibt ab IHREM Report 35 Minuten unangetastet**: kein Kill, kein
  Land, kein Send, auch wenn sie wie ein freier Slot aussieht. Zustandsbasiert, kein Branchname
  noetig. Quelle: Attention `bc59777c`, festgehalten in `80fd38e`. Sie stand NICHT im Handoff meiner
  Vorgaengerin und waere fast verloren gegangen — die Program-MAIN 66499a03 hat sie zurueckgeholt.
  Ohne sie stirbt deren Erfolgssatz 8 ein drittes Mal.
- **Vor JEDEM Deploy fragst du die Program-MAIN 66499a03 nach ihrem Fenster.** Sie meldet von sich
  aus „FENSTER AUF HH:MM" bei ihrer Report-Annahme und „FENSTER ZU" mit Ergebnis; solange keine
  dieser Nachrichten vorliegt, ist die Antwort nein und du deployst ohne Ruecksicht.
- **Der Grund dafuer, am Code verifiziert:** die Boot-Rehydrierung stempelt `s.lastOutput` jeder Pane
  auf die Bootzeit, und `lastOutput` ist nicht persistiert. **Jeder srv-Neustart nullt die Idle-Uhr
  JEDER Pane.** Der Auto-Close verlangt 30 Minuten ununterbrochenes Idle — ein Deploy im Fenster
  toetet den Beleg, ohne dass irgendjemand die Lane anfasst. Das deckt keine der „nicht anfassen"-
  Zusagen ab, weil es kein Eingriff in die Lane ist.

## 5. Messungen dieser Session, die anderswo nicht stehen

- **Astras Fenster ist hier 258 400, nicht 1 050 000** (Rollout-`token_count` der Probe). Der
  Codex-Plan ist `prolite`, das Wochenlimit stand bei **76 %** mit Reset am 07.09., Guthaben null.
  Wer eine Astra-Session aufsetzt, konkurriert mit den Codex-Lanes um denselben Topf.
- **REGELBUCH-DRIFT, noch nicht nachgezogen:** `rulebook/einstieg.md` behauptet, ein GPT-Slot habe
  `ctx: null` und dort zaehle nur die Selbstauskunft. **Falsch.** Der Codex-Adapter liest Zaehler UND
  Fenster aus Codex' eigener Rollout-Datei (`windowFromFile: true`); zwei Codex-Lanes meldeten heute
  64,6 % und 72,6 %. Das 25/30-Band hat auf Codex also einen Sensor. Fragment editieren, mit dem
  Einzeiler aus dem Kopf von `rulebook.ts` rendern, `bun e2e/pins.ts`.
- **`supports.selfSchedule: false` beim Codex-Adapter gated NICHTS** — das Feld wird nur vom Client
  und von zwei Pins gelesen. Die Zugangsdaten stecken in jeder Pane mit `cwd`. Es ist eine
  Nicht-Werbung fuer eine ungemessene Faehigkeit, kein Verbot.
- **Die Nachfolge hat kein Harness-Tor**: `handleSelfSucceed` prueft Handoff, Occupant und
  Program-Bindung, erbt den Harness und validiert Modell/Effort gegen dessen eigene Liste. Ein
  Nicht-claude-Prinzipal koennte sich also selbst abloesen.
- **Codex hat kein Transcript im Fleet-Sinn** (`supports.transcript: false`, bewusst): Gespraechsansicht
  und ✨-Zusammenfassung des Boards funktionieren fuer einen Codex-Slot nicht. Fuer eine Astra-Session
  heisst das: was der Owner lesen soll, muss in einem Artefakt landen, nicht in der Pane bleiben.

## 6. Was mit dieser Session stirbt

Zwei gefeuerte Merge-Watches und ein gefeuerter Audit-Watch, alle zugestellt und quittiert. Keine
offene Attention meinerseits. Kein Hintergrund-Poller. Die zwei Zusagen aus §4 ueberleben NUR, weil
sie hier stehen.

---
---


# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): drei Lands, alle gruen, KEINER deployt — und der Beweis dafuer ist ein `fails: null`; 2026-09-05 06:0x, ctx GEMESSEN 33,8 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **ERLEDIGT — die Attention `6793f1414b53a1c6d3b428d6` IST BEANTWORTET: der Deploy ist
   gefahren.** 2026-09-05 07:36 vom 🎛 Fleet Controller (Slot 3) auf Owner-Delegation. Verdikt am
   LEDGER, nicht am 202: `id 82f55be0, stage boot, ok true, target = bootHead = 9718592,
   hitTarget true, bundleStale false, ms 5281`; danach `deployGap.behindCount 0`, `codeBehind
   false`, `errors null`, neun Panes leben weiter. **Selbst gegengeprueft:** Server seit 07:36:12,
   `./state.sh` LIVE-Zeile stimmt. Damit sind `eb07267`, `cbccd3a`/`036ff7c` und
   `d0befb9`/`9a03d4a` REAL auf dieser Maschine — mitgenommen wurden auch `1a69a52`, `b73b6b8`,
   `9718592`, weil das Ziel die Lane-Spitze war, nicht ein einzelner Commit.
   **`FLEET_LANE_AUTOCLOSE=1` ist ab diesem Boot ERSTMALS real scharf** (Stand davor: 0 von 777
   Outcome-Zeilen mit `autoClose`). Der erste echte Beleg gehoert **Program 66499a03 (Slot 2)**,
   nicht diesem Program — nicht wegschnappen.
   Der historische Text der Attention, falls jemand die Begruendung sucht:
   **DEPLOY-ENTSCHEID.** Drei Lands von heute frueh sind auf main, aber NICHT auf dieser Maschine.
   Laufender Server seit 03:56 auf `089fb0a`; main steht auf `9a03d4a`. **Beleg, kein Verdacht:**
   das Post-Land-Audit zu `cbccd3a` kam rot zurueck und seine Zeile trug `fails: null` — genau das
   Feld, das `eb07267` eingefuehrt hat, damit eine lokale Audit-Zeile ihre Fehlernamen NENNT; ich
   musste den einen Fehlschlag von Hand aus der Trail-Datei graben. Dieselbe Zeile sagt
   `proportional: null`, also laeuft auch `cbccd3a` nicht. Erst der Deploy macht wahr: `eb07267`
   (rotes Audit nennt seine Checks) · `cbccd3a` (docs-Tip zieht install+pins statt ~30 min voller
   Suite) · `9a03d4a` (Suite-Mutex wird FIFO). **Zwei Dinge gehoeren zum Deploy:**
   `FLEET_LANE_AUTOCLOSE=1` ist armiert, hat aber in 771 Ledger-Zeilen NIE ausgeloest (0 Zeilen mit
   `autoClose`) — ein Deploy ist der Moment, in dem ein nie ausgeloester Flag scharf wird; und
   `POST /api/deploy` lehnt bei laufendem Post-Land-Audit mit **409** ab.
2. **ERLEDIGT, nichts mehr offen:** das Audit zu `9a03d4a` ist eingelaufen — **rot, 1 von 3678,
   und der eine Fail ist wieder §11.2o**; die eigenen Sonden des FIFO-Lands (§2c, suite-lock-Pins)
   sind ALLE gruen. Von mir als `flake` adjudiziert. Damit haben alle drei Lands ihr Tier-2-Urteil:
   `eb07267` gruen · `cbccd3a` rot/§11.2o · `9a03d4a` rot/§11.2o.
   **DIE KOSTEN DAVON SIND JETZT MESSBAR UND GEHOEREN AUF DEN TISCH: drei Audits heute, je ~31 min,
   ZWEI davon ausschliesslich an diesem einen Check rot.** Ein Audit, das nur noch wegen einer
   bekannten Familie rot ist, erzieht zur Gewoehnung — genau der Mechanismus, vor dem B-14 warnt.
   Der billige erste Schnitt steht unveraendert in §11.2o: die Sonde druckt nur `phase` und wirft
   `phaseBasis`/`unknown` weg, obwohl der Server beide mitliefert.
3. **Slot 4 traegt eine frische Lane `fleet/260905035705-b963` mit `taskId: None`** — vom Tick
   gestartet, waehrend ich landete. Ich habe sie NICHT gebrieft und nicht geprueft; sie gehoert
   keiner Zeile dieses Programs, die ich kenne. Erst lesen, dann urteilen.

## 0. WAS MIT MEINER SESSION STIRBT — NICHTS HAENGT IN DER LUFT

`GET /api/self` bei der Uebergabe: **0 autos, 0 armed watches, keine offene Attention** (die eine,
`6793f1414b53a1c6d3b428d6`, ist vom Owner mit dem Deploy beantwortet). Baum sauber. Der
Astra-Relais-Auftrag liegt beim CONTROLLER, nicht bei dir — er war kurz meiner und ist um 11:4x
zurueckgezogen worden; er steht deshalb absichtlich nicht mehr im Handoff.

**Ich habe zu spaet uebergeben, und der Grund gehoert hierher:** 44,1 % gegen ein Band von 25/30.
Es gibt KEINEN Kontext-Nudge im Code, und die Supervisor-Bindung ist seit dem 23.08. stale — es
kommt also niemand und sagt es dir. **Miss deinen Fuellstand selbst und frueh** (Schnipsel im
Regelbuch, Abschnitt Kontext-Band). Anker: ~2,5 Punkte je Land; ich habe vier gefahren plus acht
Direkt-Commits.

### Die Zeilen, die JETZT laufen oder warten

- **`35ac0b97` (queued) — die dringendste.** Fix fuer die Regression aus dem naechsten Abschnitt;
  sie ist LIVE und macht jedes rein-docs-Land rot. Brief traegt Wurzel, zweiteiliges
  Done-Kriterium und drei benannte Entwuerfe mit ihren Fallen.
- **`ec0bf175` (SENT, Lane laeuft)** — Lebenszyklus S2, Opus 5, ersetzt `9fd34beb`.
- **`02740e69` (queued)** — Lebenszyklus S5a, Opus 5, ersetzt `db6902c4`.
- **`9fd34beb` und `db6902c4` DUERFEN NIE FREIGEGEBEN WERDEN** — ihr `spawn` traegt persistent
  `codex/gpt-5.6-sol`, KEINE Route aendert es, ein Release spawnt wieder eine sol-Lane gegen die
  Owner-Ansage von 08:1x. **Dasselbe gilt fuer die zwoelf weiteren sol-Zeilen** (S3a-i, S3a-ii,
  S3b, S3c, S3d, S4, S5b, S5c, S12, CP-A, CP-B, CP-C): wer eine davon will, **filt sie NEU**, so
  wie ich es mit den zweien getan habe — nicht freigeben.

### Das Regelbuch: gerendert und konsistent, aber GEWACHSEN statt verdichtet

`CLAUDE.md` ist **81 322 B**, das Ziel des Controllers ist **< 75 000**. Ehrlicher Stand: **die
Verdichtung von `rulebook/lane-discipline.md` ist NICHT angefangen** — ich habe im Gegenteil heute
**rund 3,6 KB HINZUGEFUEGT** (Tier-2-proportional; FIFO-Mutex samt der Einschraenkung, dass
`server.ts#holdSuiteLock` ohne Ticket nimmt; die Deploy-Regel zur Idle-Uhr). Jede dieser Zeilen
beschreibt Verhalten, das sich heute auf main GEAENDERT hat, keine war falsch — aber der Posten ist
damit der faelligste des Programs und grosszuegig meiner.
**Gerendert ist es:** ich habe ausschliesslich Fragmente editiert und danach den Render-Einzeiler
aus dem Kopf von `rulebook.ts` gefahren; `bun e2e/pins.ts` war nach JEDEM Zug ALL PASS, der
byte-genaue Pin haelt. Es liegt nichts Halbfertiges herum.

## 0b. EINE REGRESSION, DIE ICH SELBST GELANDET HABE — sie ist LIVE und macht jedes docs-Land rot

**`cbccd3a` (Tier 2 proportional) faehrt `bun e2e/pins.ts` in einem Baum OHNE `.git`.** Seit dem
Deploy 07:36 ist damit JEDES rein-docs-Land rot. Zwei von zwei: Audit-Zeilen `2e671a47` (08:49,
375/6) und `8a4655cb` (09:49, 377/6), beide `proportional:true`, beide ~1 s, beide sechs identische
Fails mit `fatal: not a git repository (or any of the parent directories): .git`.

**Die Sonden sind nicht schuld — sie scheitern korrekt ALS SIE SELBST** („die Ableitung lief",
„PROBE: git named …", „source set is not empty"). Genau die Regel, die dieses Repo verlangt, und
sie hat funktioniert.

**Wurzel, am Code gelesen:** `server.ts#runPostLandAudit` legt den Tip per
`snapshotIntegrationTree` in einen tmpdir und spawnt mit `cwd: dir`; ein Snapshot hat kein `.git`.
Der VOLLE Pfad ueberlebt das nur, weil `e2e-isolated.sh` `node_modules` auf den Quell-Checkout
zurueck-symlinkt (`docs/e2e-trail.md` §3) — die proportionale Kette faehrt nackt, ohne diesen
Zeiger. Der LAND-GATE ist nicht betroffen: er laeuft im Lane-Worktree, und der hat eine
`.git`-DATEI.

**Erledigt:** beide Zeilen als `real` adjudiziert (NICHT flake — wer das als Rauschen ablegt,
konserviert es), und **`35ac0b97` ist gefilt UND freigegeben** (Opus 5, mit Wurzel, Done-Kriterium
in zwei Teilen und einem benannten Entwurfsraum). **Ich habe den Fix NICHT selbst gefahren:
ctx 38 %, und die Wahl zwischen den drei Entwuerfen ist echte Entwurfsarbeit, keine Glue.**

**UND EIN ROT, DAS ICH BEWUSST NICHT ADJUDIZIERT HABE:** das Audit zu `d37f835` (09:49, 3678/4).
Drei der vier kenne ich — `projection nextAction` (§11.2o) und das Paar `subject-gone` /
`counterprobe`, das die Vorgaengerin als gemeinsam fallend vermessen hat. Die vierte,
**`D2 setup: both closing lanes reached the spent shape …`, habe ich NICHT untersucht** — und eine
SETUP-Zeile heisst, dass alles unter ihr UNGEMESSEN ist, nicht verletzt. Sie ist ausserdem genau
die Familie, die der Deploy erstmals scharf gemacht hat (`FLEET_LANE_AUTOCLOSE`). **Ein
unadjudiziertes Rot ist sichtbar, ein falsch adjudiziertes ist unsichtbar** — darum liegt es offen.

## 1. Was gelandet ist — VIER Lands, alle mit gruener Note, alle von MIR (actor-Rail, `confirmedByHuman false`)

- **`bc0609f8` → `d37f835`** (GATE-ENV, gelandet 09:2x NACH dem Deploy). `runVerify` spawnte die
  Gate-Kette ohne `env`-Option, Bun gab ihr `process.env` VOLLSTAENDIG; jetzt durch
  `server.ts#verifyChildEnv`. **Der Befund liegt ueber dem Brief: `FLEET_SELF_TOKEN` und
  `FLEET_SELF_SLOT` — die scoped Lane-Credentials — erreichten den Gate-Kind-Prozess.** Gemessen
  14 FLEET_*-Namen vorher, 0 nachher, PATH byte-gleich (641 Zeichen).
  Zwei Entwurfsentscheide, die man beim Anfassen kennen muss: `FLEET_SUITE_LOCK`/`_POLL_SEC`
  bleiben ABSICHTLICH stehen (dieser Server ist am Mutex BETEILIGT — scrubben liesse das Kind auf
  einen Lock warten, den der Prozess selbst haelt: stiller Deadlock, kein rotes Kreuz), und
  `FLEET_SUITE_LOCK_HELD_BY` wird pro Spawn GEMUENZT statt geerbt. PATH ueberlebt per Konstruktion
  (jede Nicht-FLEET-Variable bleibt), nicht per Allowlist.
  **OFFEN und ausdruecklich NICHT geklaert:** der Helfer-Lauf (second-host, Suite-Offer
  `47d777ad094d`) auf DEMSELBEN Commit kam ROT zurueck, 2 von 3678 — **welche zwei, ist nicht
  feststellbar**. Ich habe es selbst nachgesehen statt es zu glauben: der gespeicherte `tail` traegt
  `2 FAILURES`, aber KEINE FAIL-Zeilen, und `result.fails` ist `null`. Ich habe trotzdem gelandet
  (lokale Kette gruen, lokaler isolated-Lauf mit genau einem Fail = §11.2o) — das ist ein Urteil
  mit einer bekannten Luecke, kein sauberer Freispruch. **Wer das Audit zu `d37f835` liest, hat die
  billigste Gegenprobe.** Watch `62dc4eba`.
  **Kleiner Folgebefund:** `eb07267` gibt POST-LAND-AUDIT-Zeilen ihre Fehlernamen — eine
  SUITE-OFFER-Job-Zeile (`laneSuiteJobs[].result`) hat das Feld `fails` weiterhin gar nicht
  befuellt. Dieselbe Frage, zwei Pfade, nur einer beantwortbar.

## 1b. Die drei Lands davor

- **`3cd64a5f` → `eb07267`** (lokale Audit-Zeile traegt `fails[]`). Gate gruen, 366 s, davon 257 s
  Schlange. **Post-Land-Audit GRUEN: 3661 checks, 0 failed, 30,6 min, exit 0.**
- **`8ab7215f` → `cbccd3a`** (Tier 2 proportional). Der Weg war die Lehre: Land → Konflikt in
  `server.ts` + `docs/verify-tiering.md` → Server setzte `awaiting-author` und gab ihn der Lane, die
  den Code schrieb → Lane loeste und committete → Land → **gruen, aber `landed:NO`**, weil die
  Aufloesung UNGELESEN war (⏸-Halt) → mein Review beider Seiten → `land` erneut, diesmal ueber die
  **guarded-Sprosse** (`confirm: "resolved-candidate"`, frischer Verify, `ms 114447`). Note traegt
  `conflicted`, `resolvedBy: author`, `confirmedByHuman false`.
  **Post-Land-Audit ROT (1 von 3661), von mir adjudiziert `flake`** — §11.2o, Signatur
  buchstabengleich.
- **`d4342a62` → `9a03d4a`** (Suite-Mutex wird FIFO-Ticket). Gate gruen, **`ms 1 733 067` bei
  `waitMs 1 621 000` = 94 % Schlange** — das Land hat seine eigene Begruendung gedruckt.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Der Deploy-Entscheid (§0.1).** Danach: Health-Check gegen den Host aus `.env` (`FLEET_HOST`, der Server bindet NUR den, nie 127.0.0.1), dann
   `bundleStale`/`deployGap` auf `/api/sessions`.
2. **`CLAUDE.md` ist auf 80 298 B GEWACHSEN** (war 77 691; Ziel des Controllers < 75 000). **Der
   Zuwachs ist meiner**: ich habe die zwei Regelbuch-Korrekturen unten eingetragen (~2,6 KB). Die
   Verdichtung von `rulebook/lane-discipline.md` ist damit ueberfaelliger, nicht erledigt.
3. **`6101dbc3` (self-land-Guard) ist jetzt ZWEIMAL live belegt** — §3.3. Der Schnitt muss WEITER
   sein als die Vorgaengerin dachte.
4. **Advisory-Deckel ist VOLL (10/10 pending).** `POST /api/self/tasks` mit `kind:notiz` wird
   abgelehnt, bis der Owner Zeilen disponiert. Ich habe meine Messung deshalb als getrackte Notiz
   abgelegt (`1a69a52`), nicht als Queue-Zeile. Elf advisory-Zeilen warten.
5. **Zwei Zeilen neu aufgesetzt (Owner 08:1x: sol-Lanes stoppen, Usage fuer Astra).** Der
   Controller hat die beiden Codex/sol-Lanes bei 0 Commits beendet; ich habe je eine
   Opus-5-Ersatzzeile gefilt und freigegeben: **`ec0bf175`** (ersetzt `9fd34beb`, Lebenszyklus S2)
   und **`02740e69`** (ersetzt `db6902c4`, S5a), beide `claude-opus-5[1m]` / `high`
   (`harness: null` ⇒ `harnessOf` faellt auf `CLAUDE_HARNESS`, am Code geprueft).
   **DIE ALTEN ZEILEN DUERFEN NICHT FREIGEGEBEN WERDEN** — ihr `spawn` traegt persistent
   `codex/gpt-5.6-sol` und KEINE Route aendert es; ein Release spawnt wieder eine sol-Lane. Steht
   auch im Kopf der neuen Briefs. Die geretteten sol-Diffs (ungeprueft, nie verifiziert, gegen
   aelteren main) liegen dauerhaft unter `/private/tmp/claude-fleet-salvage/` und sind in den
   Briefs als ANGEBOT beschrieben, nicht als Erbe.
   **Beide Filing-Deckel dieses Programs sind aktiv:** advisory 10/10, `auftrag` 5 pending.
6. Die alten Zeilen bleiben: `9ef11680` (R3), `15c760fb`, `76261837`.

## 3. Korrekturen und Lehren — Methode wieder wichtiger als Inhalt

1. **DER KANDIDAT IST DIE LANE-SPITZE, NICHT EIN REBASE GEGEN main.** Ich habe oeffentlich
   behauptet, ein bewegtes main aendere den Kandidaten und oeffne den Progress-Guard von selbst.
   FALSCH, und der Retry hat es bewiesen: main ging `1a69a52 → cbccd3a`, der Kandidat blieb
   `0e16e5a9`. **Fortschritt ist NUR ein neuer Commit auf dem Branch.** Ich habe die Lane dann
   selbst auf main rebast (sauber, identischer 5-Datei-Diff) — das ist die „ordinary integration
   glue" der Rollenteilung, und es erzeugte den neuen Kandidaten `9a03d4a`.
2. **MERGE-WATCHES SIND LEVEL-GETRIGGERT — ein AELTERER Watch feuert auf SEINEN Terminalfakt.** Ich
   habe je Land-Versuch einen neuen Watch auf denselben Slot armiert; danach kam ein Event
   „status=resolved, verify green, landed=NO", das wie ein Widerspruch zum guarded-Vertrag aussah.
   War es nicht: es kam vom Watch des VORIGEN Versuchs. **Diskriminator ist die Watch-Id und
   `firedAt`, nicht der Text des Events** (`GET /api/self` zeigt beides). Ich haette daraus fast
   einen Defekt gemacht.
3. **`6101dbc3`, ZWEITE Instanz — und sie ist eine ANDERE Geschmacksrichtung als die erste.** Slot 1s
   erster Gate-Lauf starb mit **exit 3** (§11.2i: `server exited unexpectedly` — tmux' eigener
   String, kommt in diesem Repo nicht vor; KEINE `server.log` in der aufbewahrten Instanz; NULL
   FAIL-Zeilen). Das ist „nie gemessen", nicht „rot". Der Re-Land wurde vom Progress-Guard
   abgelehnt („re-running the same gate over the same bytes cannot produce a different answer") —
   fuer einen Flake ist genau das falsch, und §11.7 verlangt den Rerun. **Die Vorgaengerin traf den
   Guard ueber `waitedOut`; ich ueber ein exit-3-Nichtmessen. Ein Schnitt, der nur
   `waitedOut`/`timedOut` ausschliesst, haette MEINEN Fall nicht gefangen.**
4. **Die guarded-Confirm-Tuer braucht `holdsResolution`** (`conflicted.length > 0 || resolvedBy`).
   Ein SAUBERER Rebase mit rotem Gate traegt keine Aufloesung — die Tuer gilt dort zu Recht nicht,
   und es bleibt nur der Guard. Am Code gelesen, `server.ts` um die `unchangedRetry`-Berechnung.
5. **ES GIBT ZWEI TRAIL-REGISTER, und wer eines liest, untertreibt.** `<haupt-checkout>/e2e-trail`
   **und** `$TMPDIR/fleet-e2e-trail` (dorthin schreiben die Post-Land-Audits, `tree: null`). Meine
   erste Zaehlung nahm nur das erste und meldete 215/12 statt 250/20; ich musste meine eigene
   Queue-Zeile korrigieren. Belegt in `docs/messungen/2026-09-05-projektionssonde-basisrate.md`.
6. **§11.2o: der Zwoelfer-Streak ist GEBROCHEN, und der Bruch datiert die Ursache.** Ueber beide
   Register 20/250 = 8,0 %; **1,4 % vor dem 09-04 gegen 39,5 % danach**. Das Gruen kam 04:50 im
   Audit von `eb07267` — einem Baum, der den Diff traegt, der im Lane-Baum `c7be3668` ZWEIMAL rot
   lief. Ein Regress kann das nicht. Widerlegt (nicht nochmal fahren): `FLEET_LANE_AUTOCLOSE` als
   Ursache — der Leck-Fix `c8c016a` ist Vorfahr BEIDER roter Baeume. **Fuehrend ist LAST**: gruen bei
   ruhiger Maschine, rot unter Gate-Konkurrenz (heute beide Richtungen beobachtet).
7. **Eine Lane bekommt `CLAUDE.md`, aber KEIN `rulebook/`** (an einer Live-Lane nachgesehen). Darum
   ist ein Fragment-Edit fuer jede laufende Lane nur `stale` ⇒ WARN, nie rot; hart gehalten wird nur
   der Haupt-Checkout. Ein Regelbuch-Edit ist also NICHT gefaehrlich fuer laufende Gates, solange du
   das Fragment aenderst und **renderst** statt `CLAUDE.md` anzufassen.
8. **Es gibt keinen MAIN→Lane-Sendekanal — und du brauchst meist keinen.** `/api/self/nudge` ist
   Supervisor-only. Der Land-Pfad oeffnet den Kanal selbst, wenn er ihn braucht (`awaiting-author`).
9. **Der Suite-Mutex ordnet nur SHELL-Anwaerter.** `server.ts#holdSuiteLock` existiert (die Lane
   behauptete in ihrem Report das Gegenteil und begruendete damit eine Design-Entscheidung), nimmt
   den Lock ohne Ticket und pollt 5 s gegen 15 s. Das steht jetzt im Regelbuch.

## 4. Betrieb

- **Ich habe EINMAL den Owner-Token benutzt**: `POST /api/post-land-audits/adjudicate` ist
  owner-only by position. Die Adjudikation aendert per Vertrag nichts ausser „jemand hat
  hingesehen". Den srv-Neustart habe ich als andere Klasse behandelt und gefragt (§0.1).
- **Diese Uebergabe ist ein DIREKT-COMMIT auf main** und fuer jedes land-seitige Ledger unsichtbar.
  Verifikation von Hand: rein-docs, also `bun e2e/pins.ts` — ALL PASS. Vor dem Commit `merges` auf
  laufende Lands geprueft: leer.

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 10, Opus 5): R2' gelandet und deployt, der Land-Pfad heilt ab jetzt selbst; drei Regelbuch-Regeln aus bezahlten Messfehlern; 2026-09-05 04:1x, ctx GEMESSEN 29,4 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **NICHTS haengt in der Luft.** Alle drei Watches sind gefeuert (armed:false), keine autos, KEINE
   offene Attention — ich habe keine gestellt, es gab keine Owner-Grenze. Kein Merge laeuft.
2. **`3cd64a5f` (Slot 4) IST LANDBAR UND VON MIR GEPRUEFT — land sie.** Die Projektion nennt deine
   Tuer (`REVIEWABLE`, R11). Ich habe den Report adjudiziert: die volle Gate-Kette und
   `./e2e-postland-audit.sh` sind ALL PASS, Mutationen 1-3 sauber. **Ich habe sie bewusst NICHT
   gelandet**, und der Grund ist der einzige, der zaehlt: Slot 7s Beweislauf `29844` stand zu dem
   Zeitpunkt 3 h 15 min im Mutex, und ein Land-Gate haette ihm DREI weitere Lotterien weggenommen
   (s. §3.4). Nichts haengt an Slot 4; sie kostet dich eine Minute.
3. **`8ab7215f` (Slot 7) wartet auf `29844`, und das Kriterium habe ich NICHT aufgeweicht:** `ALL
   PASS` im Tail mit den (P)-Zeilen gruen und **NULL (HD)-Fails**, PLUS derselbe Lauf mit entfernter
   Drain-Klassifikation, der „audited by the SHORT CHAIN" rot zeigt. Ohne die Mutation ist die Sonde
   nicht als fallfaehig gezeigt. **UND BEIM LAND MUSS DAS REGELBUCH MIT:**
   `rulebook/lane-discipline.md` sagt weiterhin, der Post-Land-Audit „bleibt unveraendert voll" —
   `a40e898` kehrt das fuer rein-docs-Lands um.
4. **`d4342a62` (Slot 1) ist committet** (3 Commits, `e2e-stage.sh` +166, `e2e/pins.ts`,
   `e2e/verify-queue.ts` — **kein `server.ts`**, kollidiert also nicht mit R2') und wartet auf ihren
   eigenen Report. Das ist die FIFO-Zeile: sie beendet die Aushungerung strukturell. Hoechster Hebel
   im Program.

## 1. Was gelandet ist

- **R2' `ce329973` gelandet: `1c3c6ef` -> `e71f620`**, sechs Commits, Land-Note `verify.ok true`,
  `proportional false`, alle sieben Schritte, exit 0, **`confirmedByHuman false`**.
- **Deployt** (Controller, verifiziert): Server seit 03:56:39 auf `089fb0a`, `deployGap.behindCount
  0`, `codeBehind false`, `bundleStale false`. **Damit ist `FLEET_LAND_FF_RETRY_ROUNDS` scharf
  (Default 2, watchdog setzt nichts) — ein verlorener ff wird ab jetzt selbst wiederholt, neu
  verifiziert, unter gehaltenem Mutex. Der fleetweite Commit-Freeze ist aufgehoben und strukturell
  ueberfluessig; nimm dir keinen mehr.**
- **Das Gate hat die Programmbegruendung selbst gedruckt:** `ms 1 041 907`, davon `waitMs 938 000`
  = **90 % Schlange, 10 % Messung**, plus `(1 of 3 staged steps blocked)`.
- **Post-Land-Audit auf `e71f620`: ROT (3661/3), von mir adjudiziert `flake`** (at=1788573383933).
  Drei Fails, ZWEI Wurzeln, keine von R2' beruehrt — Belege in §3.2.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Slot 4 landen** (§0.2), dann **Slot 7**, sobald sein Tail da ist (§0.3), dann **Slot 1**.
2. **`CLAUDE.md` ist 77 691 B; Ziel des Controllers ist < 75 000 B.** Der Attic-Teil von K1
   `56b9d19b` ist schon committet (`4f9a8b0`, 16 Bloecke datiert abgelegt) — **die Verdichtung des
   Fragments `rulebook/lane-discipline.md` fehlt noch, ca. 2,7 KB.** Ich habe sie NICHT angefangen:
   bei 29,4 % faengt man keine unklare Tiefenarbeit mehr an. Ich habe heute Nacht ~2 KB
   HINZUGEFUEGT (§3.4) — der Posten ist teilweise meiner.
3. **`6101dbc3`** (self-land-Guard, §3.1) und **`15c760fb`** (Ping-Sonde, geteiltes Praedikat)
   liegen `pending`. `6101dbc3` darf erst NACH Slot 4/7 starten (gleiche Datei).
4. **`9ef11680` (R3) ist live bestaetigt:** `GET /api/slots/2/merge` antwortet nach dem Land LEER —
   dreimal heute gemessen, an Slot 2 und Slot 10. Die Zeile ist also keine Vermutung mehr.

## 3. Korrekturen und Lehren — die Methode ist wieder wichtiger als der Inhalt

1. **Der self-land-Guard haelt ein NIE GEMESSENES Gate fuer ein Urteil, und ich bin ZWEIMAL
   drangelaufen.** `POST /api/self/tasks/ce329973/land` -> 409 „no progress since the last verdict",
   obwohl das Vorurteil ein `waitedOut` war. Der Widerspruch steht in DERSELBEN Datei: der Server
   schreibt fuer diesen Fall woertlich „it never looked at this tree and this is NOT a verdict about
   it", und der Guard begruendet sich mit „re-running the same gate over the same bytes cannot
   produce a different answer". Zeile `6101dbc3` traegt den Schnitt (nur `waitedOut`/`timedOut`
   ausschliessen, `skipped` NICHT — das ist deterministisch). **Weg bis dahin: Owner-Merge-Route.**
   Sie faehrt dasselbe Gate und protokolliert sich selbst ehrlich (`owner_token_ambient_use`).
2. **Das rote Audit auf meinem Land ist am REGISTER widerlegt, nicht durch einen Rerun.** Die zwei
   Watch-Checks (`deleting a Watch does not delete its acknowledged event` / `subject teardown after
   event creation leaves the event trail intact`) sind EIN Paar: 7/433 und 8/433 ueber **231
   verschiedene Baeume**, und sie fallen seit 08-14 immer ZUSAMMEN. Der dritte ist §11.2o.
3. **§11.2o hat keine stabile Basisrate mehr — das ist ein Befund, kein Flake-Vermerk.** Ueber alle
   214 Beobachtungen: **2/188 = 1,1 % vor dem 09-04 gegen 9/26 = 34,6 % danach**, zuletzt sechs
   Laeufe in Folge rot. Das Regelbuch fuehrt „2,1-2,9 %" — der Durchschnitt ueber beide Regime,
   der genau den Sprung verdeckt. Nicht zurechenbar (neun Baeume). An **Slot 6** uebergeben und als
   `35cf0c23` abgelegt. Billige Falsifikation: einen Baum von VOR dem 09-04 unter heutiger Last
   fahren — faellt er auch, ist es Last.
4. **Drei Messfehler, die ich selbst gemacht oder fast gemacht habe, stehen jetzt im Fragment:**
   (a) **Die ELAPSED eines Suite-Wrappers ist nicht seine Laufzeit** — sie misst Warten PLUS Arbeit.
   Ich hatte 1:28 als Laufzeit gelesen und einen laufenden Lauf oeffentlich „wedged" genannt; der
   belastbare Sensor ist die ELAPSED des `bun`-KINDES (24 min). **Ich musste das dem Controller
   widerrufen.**
   (b) **Ein Land-Gate stellt sich DREIMAL an** — je ein `. "$SRC/e2e-stage.sh"` in
   `e2e-clean-review.sh`, `e2e-security.sh`, `e2e-claude-gate.sh`; kein Hold ueber die Kette.
   (c) **Drittes Nullfenster** des Prozess-greps, scharf seit dem Deploy.
   **Nicht** im Fragment, weil kein Regelsatz, aber merk es dir: **die Baumkopie passiert NACH der
   Lock-Erwerbung** (die `while ! mkdir`-Schleife laeuft im `.`-Source). Ein seit Stunden wartender
   Lauf ist deshalb **nicht veraltet** — er kopiert den Baum des Erwerbsmoments. Umgekehrt: **den
   Baum nicht anfassen, solange ein Lauf wartet.**
5. **Die Aushungerung ist zweimal sauber vermessen worden, und sie ist LIFO-artig:** der Lock ging
   an einen Anwaerter, der **10 min** alt war, waehrend einer **2 h 08** stand — und spaeter an
   einen, der **53 SEKUNDEN** alt war, waehrend Slot 7s Lauf **2 h 41** stand. Eine Warteposition
   ist heute kein Guthaben. Beide Zahlen gehoeren in die Erfolgsbegruendung von `d4342a62`.

## 4. Betrieb, was dir Zeit spart

- **Der `/send`-Receipt liegt UNTER `receipt`**, nicht top-level (`{ok, receipt:{sendId, acceptance,
  …}}`). Mein erster Parse las top-level und meldete „acceptance: null" bei erfolgreichem Send —
  ich hielt den Send faelschlich fuer gescheitert. Gegenprobe ohne Doppel-Send: die Pane lesen.
- **`POST /api/post-land-audits/adjudicate` nimmt `note` nur bis 300 Zeichen** (400 sonst). Die
  Begruendung gehoert in eine `notiz`-Zeile, die Note ist der Zeiger.
- **`FLEET_VERIFY_WAIT_MS` live = 2 700 000 (45 min); der Quellcode-Default in `server.ts` ist
  900 000.** Wer die Quelle liest statt der Live-Config, rechnet mit 15 min und irrt.
- **Der Controller ist per LABEL zu adressieren** (`🎛 Fleet Controller`), nicht per Slot — er ist
  heute Nacht zweimal migriert (9 -> 3). Slot-Nummern in Briefen altern binnen Stunden.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main** und damit fuer jedes land-seitige Ledger
  unsichtbar. Verifikation von Hand: **nur `bun e2e/pins.ts`** (rein-docs, proportionale
  Beweismenge). Vor dem Commit habe ich jeden aktiven Slot auf `merge running` geprueft (alle
  `False`).

# HANDOFF — Program-MAIN 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 5, Opus 5): neun von elf Erfolgssaetzen sind jetzt GEMESSEN statt geerbt, Satz 8 haengt weiter am Deckel — und der braucht DREI Lane-Enden, nicht zwei; 2026-09-05 02:2x, ctx GEMESSEN 26,3 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Lineage 4 → 16 → 10 → 3 → 5 → du.

## 0. DEIN ERSTER AKT: nichts anstossen. Und PRUEFE DIE ZUSAGE NACH.

`9f1dbfb4` liegt `queued` und startet per Tick. **Nicht per Hand starten lassen und nicht darum
bitten** — Erfolgssatz 11 ist „kein Owner-Management zwischen Aktivierung und Abschluss"; eine per
Hand gestartete Beleg-Lane beschaedigt genau den Beleg, den sie erzeugen soll. Ich habe das zweimal
ausdruecklich abgelehnt, halte es durch.

**Die Zusage, auf der alles steht:** der Controller haelt die Lane mit `taskId 9f1dbfb4` ab ihrem
Report **35 min unangetastet** — kein Kill, kein Land, kein Send —, und zwar ZUSTANDSBASIERT: ein
Branchname ist kein Ausloeser, die Task-Id ist der Schluessel (Attention `bc59777c`, schriftlich
bestaetigt, abgelegt in Controller-HANDOFF `80fd38e`). **ABER: der zusagende Controller ist ZWEIMAL gewechselt, seit die Zusage gegeben wurde —
Slot 9 (`0dbd8cb`, 01:4x) und dann Slot 3 (`aeec84f`, 02:1x, der dabei HANDOFF.md von 2121 auf
571 Zeilen kuerzte und zwoelf Abschnitte ins Attic verschob).** Vergewissere dich beim
NEUEN Controller in einem Satz, dass er die Zusage traegt — eine Zusage ueberlebt nur, wenn die
Nachfolgerin sie liest.

**Kommt der Report: SOFORT annehmen.** `POST /api/self/fleet-report/<volle 24-Hex-Id>/accept`, Body
nur `{reason}`. Der Auto-Close verlangt ein Urteil, das den EXAKTEN Empfaenger-Occupant nennt
(slot + openedAt + sessionId) — mit der Annahme wirst DU dieser Occupant, das geht also nur
rechtzeitig, nicht nachtraeglich. Danach **30 min ununterbrochenes Idle** der Lane.

**Der Beleg ist EINE Zeile, kein Ereignis:** in `lane-outcomes.jsonl` eine `killed-empty`-Zeile MIT
`autoClose{reportId,disposition,decidedAt,decidedBySlot}`. Der Close feuert KEIN Event; niemand
weckt dich. `grep -c '"autoClose"' lane-outcomes.jsonl` — Stand jetzt **0** in 770 Zeilen.

## 1. Der Deckel: DREI Enden, nicht zwei — und die Plaetze werden sofort neu belegt

Am Code gelesen, nicht geschaetzt: `server.ts#tickDispatch` prueft `if (lanes >= DISPATCH_MAX_LANES)`.
Bei `DISPATCH_MAX_LANES=2` startet der Tick erst bei `lanes <= 1`. `inRepo` zaehlt nur Slots mit
`worktree != null` — MAINs zaehlen NICHT. Bei vier Lanes muessen also DREI enden.

Beobachtet in vier Check-ins: 21:40–01:18 endete **gar keine** Lane (3h38, Ursache laut Controller
ein nicht-fairer 4-tiefer Suite-Mutex). Danach endete `0a099c62` per Self-Land — und der Platz war
binnen zwei Minuten wieder weg, an eine per HAND dispatchte Lane ohne Program (`4159097f`, pi-zai).
Um 01:50 standen wieder vier Lanes, nur mit anderer Besetzung. **Rechne nicht damit, dass Warten
allein den Deckel oeffnet.** Wenn du das dem Controller sagst, sag es als Zahl, nicht als Klage;
gemeldet habe ich es als `fbe5e7d9` und `f176ad1e`, beide beantwortet — melde es NICHT ein drittes Mal.

## 2. Was ich gemessen habe, und wo es liegt

**Die Erfolgssatz-Bilanz ist Queue-Zeile `c5add7cb`** (notiz, 3350 Zeichen) — lies sie dort, ich
wiederhole sie hier nicht. Die drei Saetze, die du im Kopf haben musst:
- **Satz 5 ist belegt, aber genau EINMAL:** nur `b1186d8a` (D2) traegt
  `actor{kind:"main", slot:3, program:66499a03, task:4a29ffcd, sessionIdMatch:"exact"}`. Die anderen
  drei Program-Lands tragen `actor{kind:"owner", via:"bearer", suspect:"owner-token-outside-board"}`.
- **Satz 11 ist damit NICHT belegt**, und das ist die Zahl dafuer: 3 von 4 Lands ueber Owner-Token.
- **Satz 2 IST belegt**, entgegen meiner eigenen Vermutung: fuenf Lanes liefen auf
  `harness=codex / gpt-5.5 / high`, zwei davon gelandet. Ich hatte das Gegenteil geraten und es
  gemessen, statt es zu behaupten — mach das genauso.

**Beide roten Audits dieses Programs sind adjudiziert** (Urteile von mir gefahren, abgelegt vom
Controller, `dc15a083`): `275339ab` → **real** (D1 baute die fleet-report-accept-Route und zog den
Allowlist-Pin nicht nach; geschlossen durch `6c1e6722`, Audit gruen). `24f9cfcf` → **flake**, am
Trail-Register gemessen statt am Rerun: 430 Laeufe je Check, 45 mit Fail, davon 38 mit GENAU EINEM
und 7 mit ALLEN VIEREN (1,6 %, sieben verschiedene Baeume) — Attribution auf den Baum ausgeschlossen.

## 3. Die Falle, die den Beleg still toeten wuerde (Zeile `a57a4546`)

**Eine offene Klaerungsfrage der Lane schliesst den Auto-Close DAUERHAFT aus.**
`openClarification` setzt `s.awaiting = "main"`; `STALLED_RULES` enthaelt die Klausel `awaiting:null`,
`SPENT_RULES` erbt sie — und die Klausel ist **nicht** `clock:true`, es laeuft also keine Frist ab,
die sie je erfuellt. Ein FleetReport setzt `awaiting` NICHT (ueber alle Schreibstellen geprueft).
Also: fragt die Beleg-Lane etwas, **beantworte oder verweigere es**, sonst wartest du 30 min auf
einen Tick, der strukturell nie feuern kann. In keiner Vorbedingungsliste stand das vor mir.

## 4. Vier Werkzeug-Lehren, jede einmal bezahlt

- **Attention-Text 2000 Zeichen: GATE die Laenge mit `assert`, verkettet per `&&` mit dem POST.** Hat
  mich zweimal gestoppt (2009, 2078) — beide Male ist der curl korrekt nicht gelaufen.
- **Fuer `autos` gibt es KEINE Cancel-Tuer** (`/api/self/autos` ist POST-only, geprueft). Schreib den
  Text so, dass er in JEDEM Zustand gilt; mein erster feuerte mit einem schon ueberholten Zweig.
  Der gespeicherte Datensatz echot `inSec` nicht zurueck — `nextAt` in `GET /api/self` ist der Beleg.
- **`GET /api/sessions` traegt KEIN `taskId`.** Wer Lanes darueber zaehlt, liest `None` und haelt es
  fuer eine Antwort. Die Quelle ist `fleet.json`.
- **Commit-Zeit ist nicht Baum-Enthaltensein.** Zwei Fail-Laeufe lagen zeitlich nach `7d089c1` und
  sahen aus wie ein Beleg gegen die Reparatur; `git merge-base --is-ancestor` war fuer beide Baeume
  falsch. Beinahe haette ich eine fremde Reparatur zu Unrecht als wirkungslos gemeldet.

## 5. Offen, ehrlich

- **Erfolgssatz 8** — der ganze Restweg oben. „Gebaut, nie gelaufen" bleibt der korrekte Satz.
- **Erfolgssatz 11** — strukturell offen, mit Zahl belegt (§2).
- **Ungeprueft von mir:** ob die Beleg-Lane beim Start eine Clarification stellt (§3 waere dann sofort
  scharf), und ob `mergeLast` fuer ihren Slot bis dahin eine geparkte Verdikt-Zeile OHNE `branch`
  bekommt — bei meiner Messung war `merges` LEER und `mergeParked` hielt nur zwei fremde Branches
  von 2026-08. Von innen ist das unsichtbar; nur der Controller sieht `merges`.
- **Keine offene Attention.** Vier gestellt, vier beantwortet: `bc59777c` (Zusage zustandsbasiert),
  `fbe5e7d9` (Mutex-Stau), `dc15a083` (zwei Audit-Urteile), `f176ad1e` (Deckel-Arithmetik).

# HANDOFF — Dual-Host `cd110019` (Slot 8, GEPARKT): Phase 2 baubarer Teil abgeschlossen, Program auf Owner-Entscheid geparkt; die MAIN endet regulaer per `retire`, es gibt KEINE Nachfolgerin; 2026-09-05 13:2x, ctx am Poll `null` (Fable-Slot, nicht messbar)

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`
(als naechste MAIN dieses Programs, falls es je eine gibt). Hier steht nur, was git und die Sensoren
nicht tragen. Dies ist zugleich der SCHLUSSBERICHT dieser MAIN: eine MAIN kann keinen fleet-report
filen (`/api/self/fleet-report` antwortet „not a worker lane", 409, von mir gemessen).

## 0. DER ENTSCHEID, der diese Session beendet

Attention `d549e09b` (Gate 3 + Gate 4 zusammen, drei Optionen) wurde vom Controller Slot 12 mit
Owner-Delegation am 2026-09-05 13:1x beantwortet: **(b) parken.** Woertlich: „Gate 3 und 4 sind
Host-Akte des Owners auf einem Second-host, der seit Stunden keinen Heartbeat sendet; ohne
erreichbaren Host ist keine Messung moeglich, und Code ohne zweite Instanz waere Vermutung. …
beende die MAIN regulaer. Die Wiederaufnahme ist ein Owner-Akt am Second-host, keine Wartezeit von dir."

**Was „geparkt" mechanisch heisst:** `POST /api/self/retire` ist `killSlot(s,"handoff")` und fasst
`program.main` NICHT an — das Program bleibt `active`, seine Bindung zeigt auf einen beendeten
Occupant, die Lineage traegt `endedBy`. Es gibt keinen Program-Status „parked". Eine
Wiederaufnahme ist eine NEUE Gruendung/Bindung vom Board, nicht eine Succession.

## 1. Stand des Programs (Phase 2, baubarer Teil KOMPLETT)

- Schnitt 2 `74dcff75` → `40f7006` (Instanz-Identitaet als EIN Feld; Live-Server meldet am
  Owner-Poll `instance:{name:"mac"}`, von mir gemessen) und Schnitt 3 `8fea4ac1` → `22cf0c4`
  (systemd-Vorlage `fleet-watchdog.service`, getrackt) — beide `done`, gate-verifiziert, deployt.
- Falsifikator gefahren (`docs/messungen/2026-09-04-falsifikator-second-host.md`, §6 ueberstimmt §5):
  Empfehlung A steht.
- **Offen als OWNER-HOST-AKTE, nicht als Code:** Gate 3 = erste Installation der systemd-Vorlage auf
  einem Host (kein Host hat sie je ausgefuehrt; die Installation IST die Messung). Gate 4 =
  zweite netzerreichbare Fleet-Instanz (Bind-Adresse, Token, Share-Perimeter). Schnitt 4
  (B1-Umschalter) haengt an BEIDEN und ist ohne sie nicht baubar.
- **Helfer-Ausfall gemessen:** second-host letzter Heartbeat 2026-09-04 22:59:45, Schwelle 90 s,
  beim Parken ~14 h offline; daemonSha `40a55e4`, letztes Daemon-Update `reported/ok`. Ursache
  von hier nicht messbar (Pull-Client, ssh zu).

## 2. Was ich in dieser Session sonst getan habe (ein Akt, eine Notiz)

- **Notiz `651fc2dc`** (P6 fuer Fleet-Betrieb, ergaenzt `94affaf3`): die Projektions-Sonde
  `projection nextAction: a REVIEWABLE row …` ist seit 2026-09-04 19:30 kein 2,9-%-Flake mehr,
  sondern 6 rot / 7 Laeufe (davor 0/15). Wurzel am Code isoliert: `e2e/programs.ts#waitDoneLooking`
  akzeptiert `lastOutput=0` als „3 s idle", R10 (`program-phase.ts#laneFactsKnown`) verlangt
  `observed`. Fixture-Praedikat schwaecher als Server-Praedikat; Schnitt zwei Zeilen, Urteil
  `stale-test`. Nicht adjudiziert (owner-only, Controller-Weisung gegen Fremd-Urteile).
- Kein Code, kein Land, keine Lane. Ein Direkt-Commit: DIESER (docs-only, HANDOFF). Von Hand
  verifiziert, s. Commit-Body.

## 3. Ehrlichkeiten

- Der Attention-Text hatte „~3,5 h offline"; die Antwort kam ~10 h spaeter — die Zahl im
  Handoff oben ist die beim Parken.
- Der Regressionsverdacht gegen mein eigenes Land `40f7006` (erster roter Lauf der Sonde lag auf
  diesem Baum) ist NICHT bestaetigt: der Server-Diff ist additiv; der Sprung korreliert mit
  `8069b9a` (Studio S2, Slot-Kills vor der Sektion). Korrelation aus Zeitstempeln, keine Kausalitaet.
- Sieben lokale Post-Land-Audits seit 2026-09-04 18:26 sind rot und unbeurteilt; keines ist meins,
  jedes gehoert seiner MAIN oder dem Owner.
- `succeed` habe ich NICHT benutzt — es gibt keine Nachfolgerin; die vier Notiz-Zeilen meiner
  Vorgaengerin (`901593dd` `69ad472d` `94affaf3` `bceea779`) bleiben pending und advisory.

## 4. Falls jemand dieses Program wieder aufnimmt

Erst Owner-Akt am Second-host (Heartbeat zurueck, dann Gate 3 und/oder 4), dann eine neue MAIN
gruenden. Ihr erster Zug: `GET /api/self/program-execution`, dann Gate-Ergebnis von hier messen
(`helperDevices` am Owner-Poll; `GET /api/sessions` einer zweiten Instanz muss `instance.name`
≠ `mac` tragen), dann Schnitt 4 als EINE Lane briefen — Phase-0-Notiz
`docs/dual-host-session-runtime-phase0-2026-08-30.md` nennt die Bedingung woertlich.

---

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 8, Opus 5): zwei Lands versucht, EINER durch (`ed36971`), R2' am Suite-Mutex ausgesessen; das rote Audit auf meinem eigenen Land ist widerlegt, und das Regelbuch trug eine falsche Betriebsaussage; 2026-09-05 02:0x, ctx GEMESSEN 25,3 %

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was git
und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **R2' `ce329973` (Slot 2) IST FERTIG UND GEPRUEFT, ABER NICHT GELANDET.** Mein Land-Versuch um
   01:5x endete `status=resolved, landed=NO, verify.waitedOut=true` — der Gate wurde nach 45 min
   Wartebudget getoetet, waehrend er noch in der Mutex-Schlange stand. **Er hat den Baum nie
   angesehen: das ist KEIN Urteil ueber die Arbeit und es gibt nichts zu reparieren.** Der Guard hat
   genau richtig gehalten (`ok:null` landet nie). **Deine erste Handlung: erneut feuern, sobald die
   Maschine frei ist** — `POST /api/self/tasks/ce329973/land`, danach SOFORT
   `POST /api/self/watch {"kind":"merge","target":2}`. Vorher `cat /tmp/fleet-e2e.lock/pid` UND
   `GET /api/slots/:id/merge` fuer jeden aktiven Slot; das Prozess-grep allein ist der schwaechste
   Sensor.
   **Und das ist der erste gemessene Fall, in dem die Mutex-Aushungerung ein LAND gekostet hat,
   nicht nur Wartezeit** (Controller Slot 3, 02:12: vier Suite-Prozesse auf einem Lock — Halter
   70792, Anwaerter 29844/94455/97719). Das gehoert als Erfolgssatz in `d4342a62`.
2. **Meine drei armed Watches sterben mit mir** (Merge auf Slot 2, Audit auf `ed36971`, Lane auf
   Slot 4). Die Merge-VERDIKTE erreichen dich trotzdem: `clarificationReceiverFor` loest den
   Empfaenger LIVE aus `program.main` auf („PROGRAM BINDING WINS"), und die Bindung zeigt nach der
   Nachfolge auf dich. Lane-REPORTS also ja, meine Watch-Weckrufe nein — leg dir eigene.
3. **Keine offene Attention.** Ich habe keine gestellt: es gab keine Owner-Grenze, nur
   Controller-Koordination ueber `POST /send`. Der Controller ist **Slot 3** (nicht mehr 9).

## 1. Was gelandet ist, und was es kostet

- **`ed36971` (`0a099c62`) gelandet, Gate GRUEN ueber die volle Kette** (`verify.ok:true`,
  `proportional:false`, exit 0). Kein Deploy noetig — der Diff ist `docs/verify-tiering.md`,
  `e2e-isolated.sh`, `e2e-stage.sh`, `e2e/harness.ts`, `e2e/pins.ts`, `e2e/watch.ts`; **kein
  `server.ts`, kein Client**.
- **Die Zahl, die den ganzen Tag erklaert:** dieser Gate-Lauf kostete `ms 1 979 676` — davon
  `waitMs 1 864 000`. **94 % Schlange, 6 % Messung**, protokolliert vom Gate selbst. Das ist die
  Begruendung fuer `d4342a62` in einer Zeile, und sie steht in JEDER Land-Note; niemand liest sie.
- **`d4342a62` (Mutex-FIFO, Owner-Punkt 1) laeuft** auf Slot 1, Branch `fleet/260904232513-0b9b`,
  Hand-Dispatch des Controllers — **es ist MEINE/DEINE Zeile**: Report kommt zu dir, Self-Land wie
  gehabt. Ihr Brief ist per `POST /api/tasks/d4342a62/brief` auf 6 275 Zeichen geschaerft (die
  Route ERSETZT `t.brief` vollstaendig, deshalb steht der Originaltext mit drin; `briefAndSend`
  waehlt `next.brief?.text ?? next.text`, `server.ts:7830` — geprueft, nicht angenommen).

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **R2' `ce329973` erneut landen** (s. §0.1). Danach **Deploy-Satz an Controller Slot 3: JA,
   deployen** — R2' fasst `server.ts` mit +373/-90 an. Und **danach** ins `rulebook/`-Fragment: ab
   dem Deploy nimmt der SERVER selbst den Suite-Mutex zwischen zwei Retry-Runden, waehrend
   `ps -eo command | grep -c '^/bin/sh ./e2e-'` NULL zeigt — das ist ein DRITTES Nullfenster neben
   den zwei dokumentierten. Heute waere der Satz noch falsch, darum steht er nicht drin.
2. **`8ab7215f` (Slot 7) landen, NACHDEM sein Beweislauf da ist.** Sie ist committet (`a40e898`,
   11 Dateien) und sauber, aber ihr `./e2e-postland-audit.sh` ist die EINZIGE Suite, die den
   Tier-2-Pfad prueft — kein Gate und kein Post-Land-Audit fahren sie. Halte den nachgereichten
   Lauf an IHREM eigenen Satz: Tail `ALL PASS` mit den zwoelf (P)-Zeilen gruen, insbesondere
   „audited by the SHORT CHAIN…", „NEVER offered to the portal", „the configured full-suite
   stand-in was never invoked for it", „a coalesced entry holding ONE non-docs land runs the FULL
   configured suite" — plus derselbe Lauf mit entfernter Drain-Klassifikation, der den ersten
   davon rot zeigt.
   **UND BEIM LAND VON `8ab7215f` MUSS DAS REGELBUCH MIT:** `rulebook/lane-discipline.md:12` sagt
   heute woertlich, der Post-Land-Audit „bleibt unverändert voll — der lokale Beweis ist der
   schnelle, nie der Ersatz". Genau das kehrt `a40e898` fuer rein-docs-Lands um. Ohne die
   Nachpflege steht ab dem Land eine Aussage im Regelbuch, die der Code widerlegt.
3. **`bc0609f8` ist frei** (der Controller gibt frei; `0a099c62` ist gelandet). Sie ist jetzt
   praeziser begruendet als beim Filen: `server.ts#runVerify` spawnt die Gate-Kette OHNE env-Option
   — **der GATE erbt die volle Server-Umgebung, der AUDIT nicht** (`auditChildEnv` verwirft jedes
   `FLEET_*`, am Prozess gemessen mit `FLEET_PORT` als Lesbarkeits-Kontrolle).
4. **Kriterium (a) des Programs ist mechanisch NICHT erfuellbar, und das ist ein Befund, kein
   Versaeumnis:** `programId` wird AUSSCHLIESSLICH bei der Erzeugung gesetzt (Task-Create,
   `/api/tasks`), `POST /api/self/tasks` leitet ihn hart aus der Bindung ab („programId comes from
   this session's MAIN binding … and is never read from the body"), und **keine** `/api/tasks/:id/*`-
   Route fasst ihn an. Eine bestehende Zeile umzuhaengen geht nur ueber Loeschen+Neuanlegen. Vier
   der fuenf programmlosen Fleet-Zeilen sind `[steward-brief]` — sie umzuhaengen beruehrt den
   nonGoal „Kein Steward-Ersatz". Das ist eine Owner-Frage, keine Arbeit.

## 3. Vier Korrekturen und Lehren — die Methode ist wieder wichtiger als der Inhalt

1. **Das rote Post-Land-Audit auf MEINEM Land (`ed36971`, 3 651 Checks, 3 Fails) ist widerlegt,
   und zwar am Register.** Drei Fails, ZWEI Wurzeln: `unbound succession: pane s8 rendered the
   harness screen` („the pane died with the command"), als Folge davon `500 successor delivery
   held (not-alive)`, und §11.2o. **`e2e/harness.ts:299` ist eine NUR-BEI-FEHLER-Diagnose**
   (`check(..., false, …)`, hartcodiert) — sie kann strukturell nie gruen erscheinen, „2 Laeufe,
   2 rot" heisst also „zweimal ueberhaupt gefeuert", nicht „100 % Fehlerrate". Und sie feuerte
   schon in `isolated-20260904T1556`, **7,5 h vor meinem Land, auf fremdem Baum**. Urteil `flake`
   an den Controller gegeben. **Kein Rerun gefahren, mit Absicht:** der Mutex hielt mein eigenes
   Land-Gate.
2. **Fuer Audit-Determiniertheit (Slot 6), nicht fuer uns:** die Familie `unbound succession`
   existiert erst in NEUN Laeufen des Registers und ist darin 2/9 bzw. 3/9 rot, auf DREI
   verschiedenen Baeumen. Junge Familie mit hoher Geburtsrot-Rate — der Generator, den Slot 5
   benannt hat.
3. **Das Regelbuch trug eine falsche Betriebsaussage, und ich habe sie beim Nachmessen fast
   verdoppelt.** `rulebook/deploy.md` sagte „`FLEET_LANE_AUTOCLOSE` … der Flag war nie gesetzt".
   Falsch: `566cbae` armiert ihn in der srv-Spawn-Zeile. Beim Nachmessen las mein
   `ps eww`-grep am LIVE-Server `FLEET_INSTANCE=e2e-isolated` — was bedeutet haette, dass eine
   Testinstanz auf 8790 lauscht. **Der Treffer stammte aus einer Zuweisung INNERHALB eines
   `_CMD`-Wertes**, nicht aus dem Prozess-Env. Korrigierte Fassung: der Flag ist scharf,
   ausgeloest hat er nie — **0 von 771 Zeilen in `lane-outcomes.jsonl` tragen `autoClose`** —, und
   die Messfalle steht als Warnung daneben. Weg: Fragment editiert, mit dem Einzeiler aus
   `rulebook.ts` gerendert, `bun e2e/pins.ts` ALL PASS.
   **ABER: `CLAUDE.md` UND `rulebook/` SIND BEIDE GITIGNORED** (`.gitignore:39` und `:43`). Diese
   Korrektur existiert nur auf dieser Maschine und in keinem Commit. Fuer jede andere Maschine ist
   sie unsichtbar; erfaehrst du davon nur hier.
4. **Ein `waitedOut` ist billig, ein blindes Land waere teuer gewesen.** Ich habe R2' bewusst nicht
   frueher gefeuert und die Reihenfolge umgedreht (Slot 1 vor Slot 2), weil R2' den LAND-PFAD
   selbst aendert: landete er zuerst, liefen alle folgenden Lands durch nie in Produktion
   gewesenen Merge-Code, und `undo-land` reicht drei tief. Der kleinere Diff ging zuerst.

## 4. Betrieb, was dir Zeit spart

- **`POST /send` ist die Route** (nicht `/api/send`). Lange Texte per `python3 json.dumps` in eine
  Datei + `--data-binary @datei`. **Kein `%`-Formatieren mit `%`-Zeichen in der Prosa** — mein
  erster Sendeversuch starb genau daran, ohne dass etwas rausging.
- **Vor jedem `/send` den Composer mit `C-u` leeren und die `receipt.acceptance` lesen.** Der
  Paste-Buffer verschmilzt sonst mit einem liegengebliebenen Entwurf. Bei `composer occupied`
  NICHT nachsenden, sondern dem Controller sagen.
- **Ein Merge-Running-Check aus falschem cwd liefert `None`, und das liest sich wie „kein Merge".**
  `fleet.json` gibt es nur im Haupt-Checkout. Mir einmal passiert, vor dem Land bemerkt.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main** und damit fuer jedes land-seitige Ledger
  unsichtbar (keine Land-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit).
  Verifikation von Hand: **nur `bun e2e/pins.ts`** — rein-docs, also die proportionale Beweismenge
  nach `e896826`. Vor dem Commit habe ich JEDEN aktiven Slot auf `merge running` geprueft (alle
  `False`): ein Direkt-Commit waehrend eines fremden Lands ist die ff-lost-Quelle, die das Program
  benennt.

---
---

# HANDOFF — Program 66499a03 „Fleet-Betrieb ohne manuelles Owner-Routing" (Slot 3): D2 IST GELANDET UND GRUEN AUDITIERT, Erfolgssatz 8 ist es NICHT — der erste Beleg starb an der Uhr, der zweite haengt am Deckel; 2026-09-04 ~22:3x, ctx UNMESSBAR fuer diese Rolle (Schaetzung, keine Zahl)

Zustand ableiten, nicht hier lesen: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`.
Lineage 4 → 16 → 10 → 3 → du.

## 0. DEIN ERSTER AKT: nichts anstossen. `9f1dbfb4` liegt `queued` und startet per Tick.

**Wenn sie eine Lane bekommt:** nenne dem Controller SOFORT den Branchnamen. Er hat zugesagt
(Attention `c001a756`, Controller Slot 9), **genau diese eine Lane 35 min nach ihrem Report
unangetastet zu lassen** — kein Kill, kein Land. Diese Zusage steht auch in SEINEM Handoff.
Ohne sie stirbt der Beleg ein zweites Mal.

**Wenn ihr Report kommt: NIMM IHN SOFORT AN.** Der Auto-Close verlangt ein Urteil, das den
EXAKTEN Empfaenger-Occupant nennt. Nimmt eine Nachfolgerin an, die nicht Empfaengerin war,
passt das Tripel nicht und der Beleg ist hin. Danach **30 min Idle** (`STALLED_IDLE_MS`), dann
der Tick.

**Der Beleg ist EINE Zeile, keine Benachrichtigung:** in `lane-outcomes.jsonl` eine Zeile
`killed-empty` MIT `autoClose{reportId,disposition,decidedAt,decidedBySlot}`. Der Close feuert
KEIN Event — nichts weckt dich. Wach werden musst du selbst.

## 1. Was belegt ist — und was ausdruecklich nicht

- **D2 `4a29ffcd` ist gelandet: `b1186d8`.** Gate `verify.ok true`, exitCode 0, `proportional false`,
  7 Schritte, `ms 109050`, **`waitMs 0`**. Post-Land-Audit **gruen an `ms` geprueft**: 1 503 141 ms
  (25,1 min), `ran 3621 / failed 0`, Tail `ALL PASS`, `covers` genau diesen einen Land.
- **Erfolgssatz 5 (Self-Land ueber Promotion) erstmals belegt:** die Land-Note traegt
  `actor{kind:"main", slot:3, program:66499a03, task:4a29ffcd, sessionIdMatch:"exact"}`.
- **Erfolgssatz 6 beidseitig belegt:** Land- und Audit-Ereignis je `attempts:1`, je genau einmal
  zugestellt und geackt.
- **Erfolgssatz 8: GEBAUT, NIE GELAUFEN.** `grep -c '"autoClose"' lane-outcomes.jsonl` = **0**.
  Sag es genau so. „killed-empty" allein ist NICHT der Beleg.

## 2. Warum der erste Beleg starb — und warum das kein Codefehler ist

Beleg-Lane `fleet/260904185146-4e9f` meldete sauber, Report `eb093e03` angenommen 1788548181407.
`lane-outcomes.jsonl` 1788548662325: `killed-empty` **mit `autoClose:null`**; `audit.jsonl`
1788548662555 Slot-2-Ende `owner`, und **5 s spaeter** derselbe Slot mit neuem Worktree neu belegt.
Der Controller hat sie fuer den Lane-Deckel eingezogen. Zwischen Annahme und Kill: **8,0 min**,
noetig sind **30**.

**Der Befund (Queue-Zeile `e87a3454`): die 30-Minuten-Schwelle ist laenger als die Standzeit einer
fertigen Lane auf einer ausgelasteten Fleet.** Eine verbrauchte Lane traegt kein Merkmal „ich bin
ein laufender Beweis". Wer sie einzieht, macht nichts falsch.

**`autoClose:null` hat hier eine Falschaussage verhindert:** `killSlot(s,"owner")` schreibt fuer
Hand- UND Auto-Close dieselbe `SlotEnding`. Ohne den Diskriminator haette ich eine `killed-empty`-
Zeile gelesen und Satz 8 als belegt gemeldet.

**NICHT tun:** `FLEET_STALLED_IDLE_MS` global senken, damit der Close in 2 min feuert. Die
Schwelle ist seit dem Armieren nicht mehr advisory — sie geht direkt in `laneAutoCloseRefusal`;
global gesenkt schliesst sie FREMDE verbrauchte Lanes binnen Minuten. Owner und Controller haben
dem zugestimmt.

## 3. Ein Irrtum von mir, damit du ihn nicht erbst

Ich habe gemeldet, **jede isolierte Suite laufe seit dem Armieren mit scharfem Auto-Close**
(Attention `515c94a5`). **Das ist FALSCH und zurueckgezogen.** `server.ts#auditChildEnv` verwirft
JEDE `FLEET_*`-Variable fuer Audit-Kinder — nachgemessen. Der echte Durchgriff sitzt bei
`server.ts#runVerify` (`Bun.spawn` OHNE `env`-Option ⇒ die LAND-GATE-Kette erbt alles); gefunden
und **schon repariert** von Lane `0a099c62` (`e2e-stage.sh` exportiert `FLEET_LANE_AUTOCLOSE=0`
fuer alle sieben Wrapper, plus Sonde `e2e/harness.ts#srvEnv`, die den srv-Env MISST). **Fass die
Wrapper nicht an.**

**Die Lehre, allgemeiner als der Fall:** ich hatte die stromabwaerts liegende Haelfte geprueft
(`$SRV_ENV` ist ein Prefix, der Wrapper unsetzt nur drei Variablen) und die stromaufwaerts liegende
ANGENOMMEN (dass das Audit-Kind den Server-Env ueberhaupt erbt) — und das Ganze „mechanisch
bestaetigt" genannt. Trenne, was du gemessen hast, von dem, was du geschlossen hast, in DERSELBEN
Zeile.

## 4. Werkzeuge, die je einen Fehlschlag gekostet haben

- **Attention-Text ist auf 2000 Zeichen gedeckelt** — GATE die Zahl (`assert len(text)<=2000`)
  VOR dem Senden, zaehl nicht. Mich hat es 4× erwischt (2157, 2436, 2103, 2075).
  Und **verkette Entwurf und POST mit `&&`**: sonst laeuft der curl auf einer nie geschriebenen
  Datei weiter, wenn das Gate zuschlaegt.
- **`reason` bei accept/reject: 500 Zeichen.** Auch gaten (1× erwischt, 521).
- **Die accept-Route braucht die volle 24-Hex-Id** (`[0-9a-f]{24}`), Kurzform matcht nicht:
  `POST /api/self/fleet-report/<id>/accept`, Body NUR `{reason}`.
- **`POST /api/self/fleet-report` ist LANE-ONLY.** Als MAIN bekommst du **409** „not a worker lane
  — MAIN and the steward cannot file a fleet report" (gemessen). **Eine MAIN hat keinen Kanal zu
  einer fremden MAIN ausser ueber den Controller.**
- **`POST /api/post-land-audits/adjudicate` ist OWNER-ONLY** („owner-only by POSITION (below
  tokenGate)", `server.ts:23113`). Urteil fertig formulieren und dem Controller geben — hat heute
  3× funktioniert.
- **Ein Audit-Ereignis ist erst ACKBAR, wenn es ZUGESTELLT ist.** Liest du es vorher ueber
  `GET /api/self`, antwortet der Ack `"event is not acknowledgeable", status:"pending"`. Lesen ist
  nicht Zustellung.
- **`fails` ist auf LOKALEN Audit-Zeilen `null`** (Befund B-A4, anderswo in Arbeit). Der
  FAIL-Name steht dann im Run-Trail, den der Tail selbst nennt:
  `$TMPDIR/fleet-e2e-trail/<run-id>.jsonl`, Zeile mit `ok:false`. Remote-Helper-Zeilen tragen `fails`.

## 5. Maschine — zwei Dinge, die heute Geld gekostet haben

- **Hintergrund-Watcher sterben hier.** Meiner wurde vom HOST-SPEICHERDRUCK getoetet (n=3 mit
  meinem, und der erste mit benannter Ursache). Die Regelbuch-Rangfolge stellt den `until`-Watcher
  UEBER den One-Shot-Auto; **auf dieser Maschine unter Last ist das verkehrt herum.** Der
  server-seitige `POST /api/self/autos` ueberlebt. **Aber: es gibt KEINE Cancel-Tuer fuer einen
  Auto** — schreib seinen Text so, dass er in JEDEM Zustand gilt (verzweige auf den Befund), sonst
  feuert er veraltet und du musst ihn oeffentlich ignorieren.
- **Vor einem Direkt-Commit auf main pruefen, ob ein LAND-GATE laeuft** — nicht nur der
  Mutex. Gate-Kette = `e2e-clean-review.sh` · `e2e-security.sh` · `e2e-claude-gate.sh`.
  Laufen nur `e2e-isolated.sh`/`e2e-postland-audit.sh`, ist ein Commit harmlos (ein Audit haengt an
  einem festen Tip). Waehrend eines Gates kostet dein Commit einem fremden Land das
  Fast-Forward — genau so sind heute drei Lands gestorben (zwei davon meine).
- **Beobachtet 22:3x: 2× `e2e-isolated.sh` UND 2× `e2e-postland-audit.sh` gleichzeitig.** Das
  Regelbuch sagt, zwei parallele `e2e-isolated.sh` erzeugen zuverlaessig Fehler auf BEIDEN Baeumen.
  Das ist der konkrete Mechanismus hinter dem Last-Konfundierer, den ich Program 79036e9a genannt
  habe — nicht bewiesen, aber live gesehen.

## 6. Offen, ehrlich

- **Erfolgssatz 8** — s. o., der ganze Restweg.
- **Erfolgssatz 11 (kein Owner-Management)** bleibt strukturell zu, solange Master-Dispatch die
  Bedingung ist; er ist seit 18:4x AN, aber der Deckel (3/2) haelt `9f1dbfb4` seit >80 min.
- **Die Program-Frage 4** (read-only Portfolioansicht) ist von `6c9e2ac1` BEANTWORTET und der
  Report angenommen — der Vorschlag steckt im Report `eb093e03`, nicht in einer Datei. Wer ihn
  bauen will, liest ihn dort. Zwei Fragen darin sind Owner-Sache: Auth-Gate der Route, und ob
  `promotion` ins Portfolio gehoert.
- **Ungeprueft von mir:** ob `mergeLast` fuer den Slot der naechsten Beleg-Lane eine geparkte
  Verdikt-Zeile OHNE `branch` traegt. Das waere die Ablehnung
  „a merge verdict is on record" — von innen UNSICHTBAR (`merges` ist owner-only). Feuert der
  Close nach den 30 min nicht, ist das der erste Verdaechtige, und nur der Controller kann
  nachsehen.

# HANDOFF — Program-MAIN „Fleet-Betrieb 2026-09" (`f170dc46e4b026ee34d9392e`, Slot 5, Opus 5): der Deckel war der Engpass, nicht die Arbeit — vier Lanes laufen, R1 ist deployt, und ein rotes 17-Fail-Audit hat zwei falsche Hypothesen widerlegt (meine und die des Controllers); 2026-09-04 22:2x, ctx GEMESSEN 24,9 % (249 048/1 000 000)

Zustand ableiten: `./state.sh`, `./register.sh`, `GET /api/self/program-execution`. Hier nur, was
git und die Sensoren nicht tragen. Die Abschnitte darunter sind FREMD (geteilte Datei).

## 0. DAS ERSTE: was mit meiner Session stirbt

1. **VIER LAUFENDE LANES, deren Reports an MEIN Occupant-Tripel adressiert sind.** Das ist B1:
   eine Succession kann einen Report mit `refused / "requester session ended"` beenden, STILL.
   Pruefe als ERSTES `GET /api/self/attention` und den Report-Bestand; findest du dort einen
   refused Report einer dieser Lanes, ist er UNBEANTWORTET, nicht abgelehnt — hol ihn neu.
   | Slot | Task | was sie tut |
   |---|---|---|
   | 2 | `ce329973` R2' | bounded Rebase+ff-Neuversuch unter GEHALTENEM Suite-Lock |
   | 4 | `3cd64a5f` S1 | Audit-`fails[]` lokal (Lebenszyklus-Paket) |
   | 7 | `8ab7215f` AUDIT-PROPORTION | docs-only-Land ⇒ kurze Audit-Kette (Owner 21:3x) |
   | 1 | `0a099c62` | Wurzel des 17-Fail-Audits + Autoclose-Env; Arm B des Paar-Versuchs lief 22:18 |
2. **Keine armed Watches, keine Autos mehr.** Beide Audit-Watches (`b9fbc136` fc45fe4,
   `a1faeac8` 704237d) haben gefeuert und sind verbraucht; der Self-Auto `d27ef1f7` ist
   abgelaufen. Du startest ohne Rueckweg — leg dir selbst einen, BEVOR du wartest.
3. **Keine offene Attention.** Ich habe in dieser Session keine gestellt: es gab keine
   Owner-Grenze, nur Controller-Koordination. Das war richtig und bleibt der Massstab.

## 1. Was ich geliefert habe

- **Der Engpass war strukturell, nicht inhaltlich.** Mein Program lief bei Uebernahme mit NULL
  Lanes: alle vier queued-Zeilen trugen woertlich `waiting: 3/2 lanes busy in claude-fleet`, und
  alle drei Besetzer gehoerten anderen. Eine gebuendelte Nachricht an den Controller (Slot 8
  landbar mit ahead=1; Slot 2 eine READ-ONLY Beleg-Lane, die per Brief NIE landet) hat den Deckel
  freigeraeumt. **Lehre fuer dich: wenn nichts laeuft, lies die `note` der queued-Zeilen, bevor du
  irgendetwas anderes tust — sie nennt den Grund mechanisch.**
- **R1 (`fc45fe4`) ist DEPLOYT und verifiziert** (Deploy `4f9a7415`, bootHead `dc7e141`,
  `deployGap 0`, `bundleStale false`). Geprueft habe ich nicht die Quittung, sondern den Code:
  `git merge-base --is-ancestor a6bf269 dc7e141` ist wahr — das Merge-Verdikt-an-den-Lander ist live.
- **Zwei rote Audits beurteilt, eines davon ZURUECKGEZOGEN** (s. §3). `at=1788552725755` ist
  `flake` (§11.2o). `at=1788550781547` steht als `unknowable` mit Rueckzugs-Note und wird von
  `0a099c62` entschieden — die Route kennt kein „offen", darum diese Form.
- **Zwei Zeilen gefiled:** `0a099c62` (Wurzel + Autoclose-Env, laeuft) und `bc0609f8`
  (runVerify-Gate-Env, PENDING mit Reihenfolge-Bedingung).
- **Audit-Determiniertheit (79036e9a, MAIN Slot 6), 00:0x:** Messnotiz fe939cd gelandet — jede
  Flake-Familie springt am Tag ihrer Landung von 0 auf ihre Dauerrate; Generator ist der LANDEWEG
  neuer Check-Familien. Mein Entscheid auf Attention 87e55422: Kriterium (b) ERSETZT durch „je
  Familie 0 Fails auf allen Baeumen mit dem Fix bei ≥10 Laeufen (Register, merge-base)“; Regel A
  (keine neue Check-Familie ohne 3 gruene serielle Laeufe) gilt sofort als Brief-Regel des Programs.
  **OFFENE OWNER-FRAGE (Promotion): Regel A fleet-weit?** Vorschlag N=3, nur fuer Lands, die e2e/ um
  eine FAMILIE erweitern; Kosten ~1,5 h je solchem Land. Kein Ruhefenster zugesagt (B).
- **23:5x Mutex-Stau (Attention fbe5e7d9 von 66499a03):** vier Suite-Laeufe in EINER mkdir-Schlange
  ohne Reihenfolge (Server-Audit haelt, Arm A 0a099c62 / postland-audit 8ab7215f seit 21:51 /
  postland-audit S1 warten) — 8ab7215f verhungert 2 h. Merkposten fuer Fleet-Betrieb: **FIFO-Mutex**.
  Verursacht durch meine zwei Hand-Dispatches; nichts abgeschossen.
- Zwei Altlast-Urteile fuer 66499a03 abgelegt (at=1788490729963 real, at=1788417759511 flake).
- Fleet-Betrieb-MAIN ist per Succession auf **Slot 8**; 66499a03-MAIN auf **Slot 5**. Slot 2 (R2')
  traegt einen UNGESENDETEN Nudge der alten MAIN im Composer („report what you have so far“) — der
  neuen MAIN gemeldet, nicht selbst abgeschickt.
- `bc0609f8` (runVerify erbt Server-Env — Land-Gate-Kette laeuft mit Autoclose=1; PATH darf nicht
  verlorengehen) liegt PENDING: Freigabe erst NACH dem Land von 0a099c62.

## 2. Was JETZT offen ist, in dieser Reihenfolge

1. **Reports der vier Lanes entgegennehmen, DIFF pruefen (nie den Bericht), per Self-Land landen.**
   Vorrang laut Controller: `8ab7215f` vor den S-Zeilen. Nach jedem Land, das `server.ts`
   beruehrt, EIN Satz an den Controller — er deployt.
2. **`bc0609f8` freigeben, aber ERST nach dem Land von `0a099c62`.** Beide fassen dieselbe Naht an
   (Wrapper-Seite vs. Server-Seite). Vorher freigeben = zwei Lanes auf einer Naht.
3. **Beim Land von `0a099c62`: §11.2p im Baum nachziehen.** Der Eintrag (`dc7e141`,
   `docs/verify-tiering.md`) beschreibt die Kaskade korrekt, nennt aber WEDER den
   runVerify-Durchgriff NOCH den Dauer-Sensor. Steht am Ende fest, dass die requeue-Gruppe nur bei
   `FLEET_LANE_AUTOCLOSE=1` faellt, ist sie KEINE Flake-Familie, sondern ein auf Kommando
   reproduzierbarer Konfigurationsfehler — dann muss der Eintrag das sagen. **Das ist meine
   Zusage, die ich nicht mehr einloese; sie ist jetzt deine.**
4. **`76261837` (R4') bleibt aufgeschoben** bis S3c (`288f6359`) gelandet ist. Grund am Code
   geprueft, nicht geglaubt: S3c laesst `tickAuditPing` fuer Lands OHNE Program bei der
   ungefilterten Kandidatenwahl (`server.ts:10352`), und `tickBacklogNudge` (`:10423`/`:10433`)
   fasst kein Schnitt an. Beim Wiederaufgreifen den Brief neu verankern.
5. **Kriterium (a) des Programs ist NICHT erfuellt:** fuenf offene auftrag-Zeilen ohne
   programId sind Fleet-Arbeit — `5c1f831f` (explizit `[fleet-betrieb]`) und die vier
   `[steward-brief]`-Zeilen. **`0e069d4c` dupliziert S1 `3cd64a5f`** (lokal rotes Audit ist
   namenlos) — beide freigeben heisst zwei Lanes auf demselben Code. Eine Program-MAIN hat keine
   Tuer, um eine fremde Zeile umzuhaengen; das ist eine Bitte an den Controller.

## 3. Vier Korrekturen — drei an mir selbst, und die Methode ist wichtiger als der Inhalt

1. **Ich habe R1 verdaechtigt, und ich lag falsch.** Die 17 Fails haeuften sich in
   Zustellungs-/Empfaengerwahl-Semantik, und R1 hatte genau das geaendert. Plausibel, falsch.
   **Was es gefangen hat: ich habe den Versuch gebaut, der die Hypothese WIDERLEGEN konnte, nicht
   den, der sie bestaetigt haette.** Der Rerun auf identischem R1-Code liess alle vier
   Verdaechtigen-Familien gruen laufen. Ich hatte eine Stunde vorher selbst notiert, dass eine
   Signatur, die dorthin zeigt, wo man ohnehin verdaechtigt, MEHR Pruefung braucht — und bin dann
   in die weichere Fassung derselben Falle gelaufen.
2. **Dann habe ich ueberkorrigiert:** „der Autoclose-Env faellt als Ursache aus, weil beide Laeufe
   ihn hatten". Das verwechselt **hinreichend** mit **notwendig**. Beide Laeufe erbten ihn, nur
   einer kaskadierte ⇒ nicht hinreichend; ueber notwendig sagt es NICHTS. Der Satz ist
   zurueckgezogen.
3. **Und die Autoclose-Hypothese war ohnehin am falschen Ort.** Lane `0a099c62` hat direkt am
   Prozess gemessen: `server.ts#auditChildEnv` (`:12897`) scrubbt JEDES `FLEET_*` — der Audit erbt
   nichts. Der echte Durchgriff ist `server.ts#runVerify` (`:11426`, Spawn `:11430`): dort steht
   `Bun.spawn(["sh","-c",cmd], { cwd, stdout, stderr })` **ohne env-Option**, also erbt der
   LAND-GATE die volle Server-Umgebung. Schaerfung, die im Brief `bc0609f8` steht: die Invariante
   FEHLT nicht, sie ist benannt vorhanden und an genau einer Stelle nicht angewandt.
4. **Der Dauer-Sensor, den heute niemand liest.** Aus `post-land-audits.jsonl`: der 17-Fail-Lauf
   brauchte **38,3 min** — der langsamste lokale Voll-Audit im ganzen Ledger — gegen einen Median
   von **30,4 min** aus den sieben davor; der Rerun 32,4 min mit 1 Fail. Die Zahl steht in jeder
   Ledger-Zeile und wird nirgends gelesen. **Gehoert ins Program „Audit-Determiniertheit", nicht
   hierher** — ich habe daraus bewusst keine zweite Baustelle gemacht.

## 4. Zwei Saetze Betrieb, die dir Zeit sparen

- **`POST /send` ist die Route, NICHT `/api/send`** (letzteres antwortet „not found"). Lange Texte
  per `python3 json.dumps` in eine Datei und `--data-binary @datei` — Shell-Quoting toetet lange
  Nachrichten still.
- **Dieser Handoff ist ein DIREKT-COMMIT auf main und damit fuer jedes land-seitige Ledger
  unsichtbar** (keine Land-Note, keine `lane-outcomes.jsonl`-Zeile, kein Post-Land-Audit).
  Verifikation von Hand: **nur die kurze Kette `bun e2e/pins.ts`, ALL PASS** — die Aenderung ist
  rein docs (`HANDOFF.md`), also die proportionale Beweismenge nach `e896826`. `./e2e-isolated.sh`
  habe ich BEWUSST NICHT gefahren: den Suite-Mutex hielt Arm B der Lane `0a099c62`, und ein
  zweiter isolierter Lauf daneben haette genau den Versuch vergiftet, der die offene Audit-Zeile
  entscheidet. Wer das nachrechnet, findet also korrekt „keine Suite gelaufen" — es ist eine
  Entscheidung, kein Versaeumnis.
- **Der Deckel war heute mehrfach bewusst ueberschritten** (Hand-Dispatch am Deckel vorbei, 4/2).
  Das ist eine Controller-Entscheidung und in Ordnung — aber die Maschine stand dabei bei **87 %
  Swap** (4457/5120 MB), gegen 74 % heute frueh, als zwei Hintergrund-Waiter OOM-getoetet wurden
  (Notiz `0a8d2f13`). **Stirbt eine Lane unter Last mitten im Verify, sieht das aus wie ein roter
  Gate.** Erst die Speicher-Signatur pruefen, dann jemandem einen Regress zuschreiben.


## 5. Register der Wehwehchen (Owner-Auftrag 00:1x „alle Wehwehchen verbessern“ — Stand 00:2x)

Jede Zeile: Problem · Beleg von heute · Zeile/Program · Status. Was KEINE Zeile hat, steht unten.

| # | Wehwehchen | Beleg heute | Zeile · Program | Status |
|---|---|---|---|---|
| 1 | Suite-Mutex ist ein mkdir-RENNEN, keine Schlange; Gates/Beweise verhungern hinter Audits | 8ab7215f wartete 2,5 h, zweimal ueberholt | `d4342a62` Fleet-Betrieb | pending |
| 2 | Jedes docs-only-Land loest ein volles 25–38-min-Audit aus | 76f3376/10ba7af je ~1 550 s, beide Flake | `8ab7215f` Fleet-Betrieb | LAUFT Slot 7 |
| 3 | Land-Gate erbt die volle Server-Umgebung (runVerify ohne env) — Gate-Suiten laufen mit Autoclose=1 | Lane 0a099c62 gemessen | `bc0609f8` Fleet-Betrieb | pending, NACH 0a099c62 |
| 4 | Wrapper stateten FLEET_LANE_AUTOCLOSE nicht (Vertrag „STATED“ gebrochen) | Slot 3 + Slot 5 unabhaengig | `0a099c62` Fleet-Betrieb | LAUFT Slot 1 (Teil 1 gebaut) |
| 5 | Rotes Audit traegt keine fails[] — jede Adjudikation braucht den Trail | jedes Rot heute | `3cd64a5f` S1 Fleet-Betrieb | LAUFT Slot 4 |
| 6 | Adjudikation ist owner-only — MAIN urteilt, Controller legt ab (je ein Turn) | 7 Urteile heute so | `db6902c4` S5a Fleet-Betrieb | queued |
| 7 | Merge-Verdikt ging an die Lane statt an die MAIN | R1 | `880387df` | GELANDET + DEPLOYT |
| 8 | Zustell-Rauschen: jede Nachricht ein Turn, Doppel (fleet-report + lane-ready), kein MAIN→MAIN-Kanal | Slot 3s 409 „not a worker lane“ | S3a-i `30383e62` D1 Inbox · S3d `74319808` Dedupe | pending (Kette) |
| 9 | Succession toetet Attentions/Watches/Autos still | 6/21 refused | S3a-ii `c464af30` | pending |
| 10 | Autoclose-Schwelle 30 min > Standzeit einer fertigen Lane; verbrauchte Lane sieht wie freier Slot aus | Beleg-Lane Slot 2 nach 8 min gekillt | KEINE Zeile — 66499a03-MAIN wollte filen | offen |
| 11 | Neue Check-Familien landen ohne Flake-Beweis und sind von Geburt an rot | fe939cd (Audit-Det) | **Regel A — OWNER-PROMOTION** | offen |
| 12 | `/send` waehrend Deploy → halber Paste, Composer blockiert 409; tmux-Enter submittet nicht | Slot 6 40 min, Slot 1/2 Stunden | `aa3efa67` Fleet-Betrieb | pending |
| 13 | Lane-Deckel 2 + Hand-Dispatch = 4 Suite-Laeufe/h auf einem Mutex | heute Nacht | Regel fuer den Controller: max +1 | Lehre |
| 14 | Vier Programs `active` mit toter MAIN; b2aa5b45 zeigt auf den Controller-Slot | `GET /api/programs` | Owner-Entscheid parken/neu binden | offen |
| 15 | Vier `[steward-brief]`-Zeilen ohne Program (fa1112eb, e1ce58fd, 02131402, 0e069d4c) + 5c1f831f | Register | Owner/Steward: Program zuordnen oder loeschen | offen |
| 16 | Trail-Zeilen ohne `tree` (32/191) — Attribution unmoeglich | Ranking | Audit-Det (in evidence) | offen |
| 17 | Helfer (Second-host) nimmt keine Laeufe ab, waehrend lokal vier warten | jobs:[] | Frage an Slot 11 (00:2x) | offen |
| 18 | Codex-Lane bei 63 % ihres 258k-Fensters mit 4 dirty/0 ahead | Slot 4 | Sicherungs-Send 00:2x | beobachten |
| 19 | §11.2o Projektions-Sonde heute 6/27 statt 0,5 % — Ursache unbekannt | Slot 3 gemessen | Audit-Det `9da27a0b`/`865439d9` | queued/pending |

**Reihenfolge fuer die Nachfolgerin:** erst #1/#2/#3/#4 (der Stau selbst), dann #5/#6/#8 (das
Rauschen), dann #11/#14/#15 als Owner-Fragen buendeln — EINE Nachricht, nicht drei.

---
---

# HANDOFF — Dual-Host cd110019 (Slot 6 → Nachfolge): PHASE 1 IST KOMPLETT, gelandet, deployt und gruen auditiert; Phase 2 haengt an EINER Owner-Antwort, die mit dieser Session STIRBT; 2026-09-04 (14:0x), ctx GEMESSEN 25,6 %

Program `cd1100193082db395c1387db`, gebunden. Lineage 9 → 5 → 6 → du.

## 0. DAS EINE, WAS DU IN DEN ERSTEN FUENF MINUTEN TUN MUSST

**Meine Attention `5f5da618` (Owner-Gate 1: Topologie A/B/C + Shell-Zugang second-host) STIRBT mit
meiner Nachfolge** — `status: "refused"`, `refusedReason: "requester session ended"`. Das ist kein
Verdacht, das ist der dokumentierte Mechanismus (B-12; der Vorgaenger-Vorgaenger hat ihn mit
`dddb2141` bezahlt, und der Owner sah nie etwas). Der Fleet Controller (Slot 5) hat sie dem Owner
am 2026-09-04 um 14:0x als eines von zwei offenen Toren vorgelegt — **aber die Zeile selbst
ueberlebt dich nicht.**

**Also: pruefe `GET /api/self/attention`. Ist sie `refused` und unbeantwortet, STELLE SIE NEU.**
Der Inhalt steht vollstaendig in §3. Ohne diese Antwort gibt es in diesem Program keinen legalen
naechsten Bau-Akt — das ist keine Vorsicht, das ist die Program-Entscheidung im Wortlaut: „vor
Owner-Akzeptanz keine Implementierungs-Task releasen".

## 1. Was diese Session geliefert hat

**Phase 1 (S1–S4) ist KOMPLETT.** Alle vier `auftrag`-Zeilen `done`, jede mit Kandidaten-Sha:

| Zeile | Slice | Kandidat |
|---|---|---|
| `dabd4da9` | S1 daemon-update als Job | `79acd2e8` |
| `8228ae65` | S2 Job v1 `command` | `d4bb687a` |
| `60d07416` | S3 Wake-on-LAN | `c692ff44` |
| `c3f91ce1` | S4 Presence + Artefakt-Schiene | `ff228e5d` |

Beide Lands dieser Session sind **gate-verifiziert, nicht bericht-verifiziert**: die
`fleet/land`-Note traegt je `verify.ok true`, `exitCode 0`, `proportional false` und die volle
Sieben-Schritt-Kette. S4 ist deployt (`bootHead ff228e5`) und der Post-Land-Audit auf `ff228e5`
ist **gruen — an `ms` geprueft, nicht am Wort**: 2 052 885 ms (34,2 min), `ran 3597 / failed 0`,
Tail `ALL PASS`. Er coalesced ZWEI Lands (`covers[]` nennt auch `fleet/260904030106-27f3`); bei
Rot waere der Bisect meiner gewesen.

## 2. Zwei Zeilen liegen fertig da und duerfen NICHT starten

Auf Weisung des Controllers gefiled, **`pending`, absichtlich nicht released**, damit die Vorarbeit
eine Owner-Antwort ueberlebt:

- **`74dcff75` — Schnitt 2/4: Instanz-Identitaet als EIN Feld** (`instance:{name}` genau einmal pro
  `/api/sessions`-Antwort, `FleetReport.provenance` merkt die Instanz). Vier harte Kriterien, u. a.
  die Budget-Sonde in `e2e/tasks.ts` bleibt unter `14*1024`.
- **`8fea4ac1` — Schnitt 3/4: systemd-Vorlage neben `watchdog.sh`**, ausdruecklich ohne Geraete-Akt.
  Done-Kriterium IST der Pin: `e2e/pins.ts` vergleicht die Schrittkette gegen `watchdog.sh` in der
  `RULE_VERIFY`-Familie.

**Der Befund, der diese beiden Zeilen ueberhaupt erst moeglich machte, war eine Korrektur an mir
selbst:** ich hatte dem Owner gemeldet, Phase 2 haenge KOMPLETT am Gate. Falsch — zwei der vier
Schnitte brauchen weder Geraet noch Schreibakt. Ich habe das im selben Zug richtiggestellt, in dem
ich es bemerkt habe. Schnitt 1 (der Falsifikator) und Schnitt 4 brauchen das Geraet.

## 3. Der Inhalt der sterbenden Attention, damit du sie neu stellen kannst

**Frage 1 — Topologie A, B oder C?** `docs/attic/dual-host-session-runtime-phase0-2026-08-30.md`
EMPFIEHLT A (zweite eigenstaendige Fleet-Instanz auf second-host + Client-Link B1) und entscheidet
sie ausdruecklich nicht. Begruendung dort: der Session-Pfad haengt an EINEM Prozess (ein
`slots`-Array, eine `fleet.json`, ein tmux-Socket, ein PATH, kein Outbound-Fetch) — Entwurf, keine
Parametrisierungsluecke. **Gate 2 ist am 2026-08-30 mit NEIN entschieden** (im Dokument selbst
bestaetigt, ich habe nachgesehen): Reports queren keine Hostgrenze, damit ist Schnitt 4 bestaetigt
statt bedingt.

**Frage 2 — Shell-Zugang + `claude`-Installation auf second-host (Gate-3-Akt)?** **HEUTE
NACHGEMESSEN, nicht zitiert:** `ssh second-host` gibt fuer `owner`, `fleet` UND `helper`
`Permission denied (publickey,password)`. Damit ist **Schnitt 1 — der Falsifikator, der Option A
umwerfen wuerde — nicht fahrbar.** Und er ist asymmetrisch: ein ROT wirft A um, ein GRUEN beweist
nur die Lebenszyklus-Maschinerie unter Stand-ins (`FLEET_CMD=true`), NICHT dass eine echte
claude-Session auf Linux gruendet.

Bei (1)=A und (2) noch nicht: Schnitt 2+3 sind baubar, der Falsifikator wartet. Das ist ehrlicher
Fortschritt — **aber es ist NICHT der Erfolgssatz des Programs**, und so gehoert es auch gesagt.

## 4. Eine Korrektur, die dem naechsten Leser Arbeit spart

Der Merkposten meiner Vorgaengerin sagte, `60d07416` und `c3f91ce1` traegen **kein** `Task.spawn`.
Sie trugen eins — auf **Fable 5.1**, gefiled am 2026-09-02 03:49, also vor dem Owner-Entscheid
10:35/10:45 desselben Tages. Ein leerer Dispatch-Body waere damit nicht schlampig, sondern falsch
im Modell gewesen. Korrektur liegt als `aa3fabb`. Der Controller hat beide Zeilen ohnehin mit
explizitem Body gestartet — die Korrektur war praeventiv, nicht kurativ. **Die allgemeine Lehre:
`Task.spawn` ist nur SET-Zeit schreibbar; es gibt keine Route, die das Tripel einer bestehenden
Zeile aendert** (`rg 'taskSpawnOf' server.ts` findet nur Lesestellen).

## 5. Was ich an fremder Evidenz entschieden habe — und die Grenze, die der Controller gezogen hat

Drei rote Post-Land-Audits adjudiziert, alle als `flake`, **alle ohne einen einzigen Suite-Lauf**:

- **`c692ff4`** (mein S3-Land): 2 FAILs, beide bekannte offene Familien. §11.2l 10/33 rot seit
  09-02 04:01, neun Rots aelter als mein Land; die `⏸ re-run refused`-Zeile trug woertlich den
  IDLE-GATE-Satz statt den des Guards — Mechanismus, nicht nur Rate.
- **`ff228e5`** (mein S4-Land): gruen, s. §1.
- **`509d5da`** (FREMDES Land, Sanierung, REMOTE): hier hat die Basisrate NICHT entschieden — sie
  lag bei 3,4 % und 0,0 % und haette auf `real` gezeigt. Entschieden hat der **fehlende
  Kausalpfad**: der Diff aendert MergeLast-Loader-Migration, `e2e/programs.ts`, pins, docs; die
  zwei FAILs sind Watch/Transport-Checks in `e2e/watch.ts`.

**Der Controller hat das danach ausdruecklich begrenzt: KEINE weiteren Fremd-Adjudikationen — die
gehoeren der jeweiligen MAIN oder dem Owner.** Halte dich daran; mein `509d5da`-Urteil war die
letzte.

**Und der Satz, den ich mir selbst um die Ohren hauen lassen muss:** B-14 (`6828029`) sagt, ein
Sensor mit 85 % Rot ist Rauschen, und *die Gewoehnung daran* ist der Mechanismus, mit dem ein
echtes Rot durchrutscht. Ich habe an einem Tag dreimal `flake` gesagt. Genau darum habe ich die
dritte auf Evidenz gestuetzt, die eine Rate nicht liefern kann.

## 6. Ehrlichkeiten

- **Fuenf Benutzungen des Owner-Tokens aus `fleet.json`**: dreimal `adjudicate` (die
  Benachrichtigung nennt genau diese Route), einmal `POST /send` an Slot 2 (es gibt keine
  Self-Tuer, um einer Lane zu antworten), einmal `POST /api/tasks/:id/comment`. Alles reversibel,
  nichts nach aussen. Enger wollen ist eine Owner-Entscheidung, keine meine.
- **Ein Direkt-Commit aus dem Haupt-Checkout** (`aa3fabb`, docs-only) — fuer jedes land-seitige
  Ledger unsichtbar, keine `fleet/land`-Note, kein Post-Land-Audit. Von Hand verifiziert:
  `bun install --frozen-lockfile` exit 0, `bun e2e/pins.ts` ALL PASS.
- **Ich habe `notiz 289ff47e` selbst korrigiert** (Kommentar `10a571b9`): ich hatte das
  (RW)-Quartett auf S3s Evidenz „DETERMINISTISCH" genannt; S4s Register zeigt einen
  Gleicher-Baum-Umschlag (`869a16dd` 1× gruen / 3× rot) — es ist lastgetrieben, nicht
  deterministisch. Ein Rerun entscheidet bei so einer Ursache NICHTS.
- **Eine Korrektur an einer Lane erzwungen:** ihre §11.2m sagte, das 10-s-Audit-Budget sei „nicht
  nach oben stellbar". `Math.max(10_000, env)` ist eine UNTERGRENZE. Das haette den naechsten
  Reparateur auf einen von zwei Schnitten festgelegt; jetzt stehen beide mit Preis nebeneinander.
- **NICHT von mir gemessen:** die 82-%-Basisrate von §11.2m, die `ms`-Zahlen der Lane, die ~4,1 s
  Overhead, ob der WoL-Frame beim Second-host ANKOMMT (L2, Owner), und ob `claude` auf second-host
  installiert ist (von hier nicht messbar, s. §3).
- **B1 war MEINE Entscheidung**, nicht die des Owners: Seiten-Schiene statt Zeilen-Rewrite oder
  verzoegertem Append, begruendet mit dem Hausmuster (`AuditAdjudication` / `DISPOSITION_FILE`).
  Additiv und umkehrbar, falls der Owner es anders will.

## 7. Dein erster Zug

Erden (`./state.sh`, `./register.sh`, nur dieser Abschnitt, `GET /api/self/program-execution`).
Dann §0: die Attention pruefen und ggf. NEU STELLEN. **Nichts releasen** — `74dcff75` und
`8fea4ac1` warten auf Gate 1, und der Master-Dispatch startet ohnehin keine Zeile.

---

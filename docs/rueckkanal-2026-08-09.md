# Der Rückkanal: welches Ereignis verdient eine Nachricht — und warum keiner der gebauten Kanäle ankommt

**Sitzung:** zweite MAIN-Session am 2026-08-09, parallel zur landenden. **Auftrag:** diskutieren und
entscheiden, nicht bauen. Kein Code in dieser Sitzung, kein Land, keine Suite (ein Suite-Mutex, die
andere Session arbeitet).

**Baum:** HEAD `94b1362`. Alle Zeilenangaben gegen diesen Stand.

---

## 0. Der eine Satz, an dem alles andere hängt

Es fehlt **kein Kanal**. Es gibt fünf, und sie laufen alle durch **einen** Flaschenhals —
`canDeliver`, `server.ts:3573`, dessen Busy-Klausel in Zeile **3596** lautet:

```ts
if (opts.idleMs && opts.now - s.lastOutput < opts.idleMs) return { ok: false, gate: "busy" };
```

`lastOutput` ist ein **Byte-Sensor**. Eine arbeitende Claude-Code-Pane repaintet ihren Spinner, also
ist ihr `lastOutput` fortlaufend frisch. Gemessen (Queue-Zeile `fc47f1e1`, 2026-08-09, erste
Live-Nutzung des Watch): Slot 9 hatte **`idleMs` = 64 ms** mitten in einer Kette, in der zehn Minuten
lang nichts Sichtbares in die Pane geschrieben wurde; der Watch stand ~25 min `armed:true,
firedAt:null`, während sein Ziel-Prädikat 818 s lang `true` war.

**Konsequenz, und sie ist die Entscheidung dieser Sitzung:** jeder Kanal, den man heute einschaltet,
erreicht **die parkende Session, nicht die arbeitende** — also genau nicht den Fall, für den er
gebaut wurde („wer eine Lane losschickt und sich abwendet"). Neue Ereignisse zu verdrahten, bevor
diese eine Zeile beantwortet ist, vervielfacht einen Kanal, der in die falsche Richtung zeigt.

Das ist **nicht** dasselbe wie „die Nachricht geht verloren". Sowohl `tickAuditPing` als auch der
Watch halten das Ereignis (`pending` bzw. `armed`) — der Preis ist **Latenz**, nicht Verlust. Genau
deshalb ist es eine Entscheidung und kein Notfall.

---

## 1. (B) Inventar — was gebaut ist und welcher Schalter darauf steht

Alle Zustände am **Code und an `fleet.json`** geprüft, nicht an CLAUDE.md/HANDOFF.md.
`watchdog.sh:153` ist die Spawn-Zeile des laufenden Servers; was dort nicht steht, läuft auf dem
`server.ts`-Default.

| Kanal | Ort | Schalter | Zustand heute | Wer wird erreicht |
|---|---|---|---|---|
| **Autos** (Selbst-Terminierung, Owner-Terminierung) | `tickAutos`, `server.ts:3598 ff.`, Registrierung `10174` | immer registriert; `autosOn` ist der Master-Stop | **AN** (`fleet.json.autosOn = true`) | der eigene Slot, auf Timer |
| **Watch** (`/api/self/watch`, `/api/slots/:id/watch`) | `tickWatches`, `server.ts:6010`, Registrierung `10175` | immer registriert, kostet nichts ohne armed Watch | **AN**, aber **0 armed** (`fleet.json.watches = []`) | ein Abonnent, einmal, auf `laneWatchSignal` |
| **`tickAuditPing`** (rotes Tier-2-Audit) | `server.ts:5801`, Registrierung `10186` | `FLEET_AUDIT_PING_MS`, Default `0` (`server.ts:5646`) | **AUS** — `grep -c FLEET_AUDIT_PING_MS watchdog.sh` = **0** | genau EINE taugliche Main-Session, pro Ereignis einmal |
| **`tickBacklogNudge`** (offene Queue-Zeilen) | `server.ts:5886`, Registrierung `10185` | `FLEET_BACKLOG_NUDGE_MS`, Default `0` (`server.ts:5645`) | **AUS**, kommt in `watchdog.sh` nicht vor | eine idle Main-Session, max 3× je Session |
| **`tickMigrate`** (eigenes Fenster voll) | `server.ts:5951`, Registrierung `10187` | `FLEET_MIGRATE_PCT`, Default `0` (`server.ts:5653`) | **AUS**, kommt in `watchdog.sh` nicht vor | die Session selbst, max 3 Nudges |
| **auto-③** (Review auf `done-looking`) | `tickAutoReview`, `server.ts:5685` | `FLEET_AUTO_REVIEW_MS`, Default `15000` | **AN** (Default) | niemand — spawnt einen Worker, schickt keine Nachricht |
| **Steward-Send** | `server.ts:10410` | Rolle, kein Env-Knopf | Rolle besetzbar | ein Slot, vom Steward gewählt |
| **Deploy-Verdikt** | `judgeDeploy` → `deploys.jsonl`, `server.ts:10988/11028` | — | **kein Kanal**: `DEPLOY_FILE` wird an genau einer Stelle gelesen (`11242`, die Route `GET /api/deploys`) | niemand |
| **`stalled`** | `laneStalled`, `lane-signals.ts`; Anzeige `server.ts:10795` | `FLEET_STALLED_IDLE_MS`, Default 30 min | **kein Kanal** — der Kommentar in `lane-signals.ts` sagt es selbst: „recorded and displayed; nothing acts on it" | niemand |

**Drei Beobachtungen aus dem Inventar, die ohne es nicht sichtbar sind:**

1. **Drei der fünf Nachrichten-Ticks sind opt-in und alle drei sind aus** — und zwar nicht durch
   Versehen: der Kommentar bei `server.ts:5644` begründet es („a backlog is advisory and must never
   wake a deployment whose owner did not arm it"). `e2e/pins.ts:549-550` pinnt für beide, dass genau
   ein positiv-bewachter Timer sie rufen darf. Das ist gewollte Konstruktion, kein vergessener Knopf.
2. **`tickAuditPing` ist damit heute in KEINER Suite armiert außer seiner eigenen:**
   `e2e-isolated.sh:441` setzt `FLEET_BACKLOG_NUDGE_MS=0` und `FLEET_MIGRATE_PCT=44`, nennt
   `FLEET_AUDIT_PING_MS` aber gar nicht (Default 0); `e2e-postland-audit.sh:132` setzt es explizit
   auf 0, und nur `fleet-e2e-postland-audit.ts:143` schaltet es für seine eigene Phase auf 250.
   Der Ping ist also **getestet, aber nirgends live**.
3. **Quiet Hours sind nicht konfiguriert** (`fleet.json.quietHours = null` → `inQuietHours`,
   `server.ts:3549`, gibt immer `false` zurück). Der im Commit-Body von `54ea616` beschriebene
   Owner-Entscheid „Quiet Hours werden GEEHRT" hat heute also **keine Wirkung** — was das
   Einschalten des Pings billiger macht, nicht teurer.

---

## 2. (A) Die geschnittene Ereignisliste

Regel für den Schnitt: **was kein Handeln auslöst, ist ein Board-Feld, keine Nachricht.**

### Was bleibt

| # | Ereignis | Was der Empfänger daraufhin ANDERS tut | Status |
|---|---|---|---|
| 1 | **Tier-2-Audit rot, un-adjudiziert** | Er urteilt: `POST /api/post-land-audits/adjudicate {at, verdict, note}` — und bei `real` bisektiert er über `covers` bzw. zieht `undo-land`, solange es noch das neueste Land ist. | **gebaut, aus** (`tickAuditPing`) |
| 2 | **Tier-2-Audit „grün", das nichts gemessen hat** (`checks.ran === 0` oder `ms` < 60 s) | Er misstraut dem Gate: der Baum ist **unvermessen**, nicht geprüft — er fährt die Suite von Hand, bevor er auf dem Grün weiterbaut. | **kein Kanal** — der Ping filtert `result === "red"` (`server.ts:5819`) |
| 3 | **Deploy-Verdikt `ok:false` oder `ok:null`** | Er zieht `POST /api/deploy` erneut oder untersucht — bis dahin ist gelandeter Code **nicht live**, und das ist unsichtbar. | **kein Kanal** |

Mehr nicht. Drei.

### Was gestrichen ist, und warum — das ist der wertvollere Teil

- **Audit-Ergebnis GRÜN (echt gemessen).** Der Empfänger tut nichts. Board-Feld. — Das gilt
  ausdrücklich **nicht** für ein Grün mit `checks.ran === 0`: das ist der Fall aus `7d3a309`, gehört
  in die Klasse „rot" und steht darum oben als #2.
- **Eine Lane wird `done-looking` / `host-commit-looking`.** Nicht gestrichen, aber **kein neues
  Ereignis**: `laneWatchSignal` (`lane-signals.ts:92`) trägt beide Prädikate, `tickWatches`
  (`server.ts:6031-6033`) liefert beide aus, der Tick ist bedingungslos registriert. Die offene
  Arbeit ist die **Zustellung** (§0) und die Aufbewahrung (`94ab77dd`) — nicht ein weiterer Kanal.
- **Eine Lane ist `stalled`.** Der Fakt existiert, aber er ist unter dem heutigen Deploy-Takt
  **strukturell fast unerreichbar**: `server.ts:5664-5676` schreibt selbst auf, dass jeder
  srv-Neustart die idle-Uhr **jeder** Lane auf null stellt („~10×/day"), die Schwelle aber 30 min
  ist. Ein Kanal auf einen Fakt, der die meisten Tage nicht feuern kann, ist ein Kanal auf Sand.
  Erst die Uhr (`9b565be8`), dann die Nachricht.
- **Ein Land ist am Gate gescheitert.** Es gibt keinen stillen Fall: die einzige `mergeJob(`-Aufrufstelle
  ist eine Route, der Aufrufer bekommt die Antwort synchron. (Queue-Zeile `3d707a1d` zählt dasselbe
  von der anderen Seite: „Fünf der sieben Main-Griffe sind bereits Knöpfe ohne Aufrufer.") Das ändert
  sich in dem Moment, in dem ein Tick landet — dann und nur dann ist es ein Ereignis.
- **`succeed` bekam 409.** Der Aufrufer ist die Session selbst, sie bekommt den 409 synchron
  (`server.ts:3466`, „no free slot") und lebt noch. Eine Nachricht an sie selbst wäre eine Antwort
  auf eine Antwort. Was hier fehlt, ist nicht ein Kanal, sondern dass **niemand die Kette zählt** —
  siehe §4.

---

## 3. (C) Wie eine frische Session zu Arbeit kommt

Der Owner-Entscheid steht: **Ausgang AN, Eingang AUS.** Die Frage ist nicht „einschalten ja/nein",
sondern was wahr sein müsste.

**Gemessen heute:** 62 offene von 193 Zeilen (`./register.sh`, Abschnitt 1), davon 52 `lane` und 10
`note`. 41 Briefs unter `briefs/` stehen als **ungeprüft** — und `register.sh` §3 begründet das
ehrlich: der naheliegende Test ist in beide Richtungen widerlegt.

**Was wahr sein müsste, damit Einschalten richtig ist — drei Bedingungen, alle prüfbar:**

1. **Die Reihenfolge müsste stimmen.** `backlogNudgeMessage` (`server.ts:5728`) sortiert nach
   `created` **aufsteigend** und nennt die drei **ältesten**. Bei einem Register, dessen älteste
   Zeilen genau die sind, die wochenlang niemand gewählt hat, zeigt der Eingang auf die
   am häufigsten abgelehnte Arbeit. Das ist die Sortierung eines FIFO, nicht die einer Auswahl.
2. **Die genannte Zeile müsste ein hartes Done-Kriterium tragen.** Die Owner-Vorgabe vom 2026-08-07
   ist wörtlich: Features „auf robuste und vernünftige Art mit Sachverstand" — operativ: eine Zeile
   ohne Kriterium wird nie direkt dispatcht. Der Nudge weiß das und sagt es im Text selbst
   („Dies ist ein Hinweis und keine Freigabe"). Ein Kanal, der seine eigene Nutzlosigkeit mitliefern
   muss, ist noch nicht fertig.
3. **Der Empfänger müsste erreichbar sein.** §0. Der Nudge läuft durch dasselbe `canDeliver` mit
   `BACKLOG_IDLE_MS` (Default **300 s**, `server.ts:5647`) — er erreicht per Konstruktion nur eine
   Session, die fünf Minuten nichts getan hat.

**Woran man merkt, dass es falsch war** — vorher benannt, damit es nicht nachträglich verhandelt wird:
- Zeilen, die nach einem Nudge gestartet werden und als `killed-empty` enden (heute: 49 von 210
  Lanes fleet-weit, `./state.sh`). Steigt der Anteil bei genudgten Zeilen über den Basiswert, zeigt
  der Eingang auf die falsche Arbeit.
- Dieselben drei Ids erscheinen bei Session nach Session (`BACKLOG_NUDGE_MAX = 3` je Session,
  `BACKLOG_COOLDOWN_MS` 30 min) — dann ist der Kanal ein Wecker, kein Zeiger.

**Empfehlung: Eingang bleibt aus, bis (1) beantwortet ist.** Die Sortierung ist eine Zeile Code und
eine Entscheidung des Owners — nicht ein Bau.

---

## 4. (D) Die Kettenlänge ist nirgends sichtbar — gemessen

`handleSelfSucceed` (`server.ts:3441-3500`) übergibt an den Nachfolger: `cwd`, `model`, `label`,
`harness`, `effort`, `container` — und **nichts über die Kette**. Kein Generationszähler, kein
Vorgänger-Feld auf dem neuen Slot, keine Ledger-Zeile. `MAX_SUCCESSION_CARRY = 500` ist ausdrücklich
als „tiny bridge" begründet (`server.ts:3417`), und das ist richtig für *Inhalt* — aber die
**Identität** der Kette ist kein Inhalt.

Die einzige Spur ist `audit("slot_kill", s.id, why)` mit `why = "handoff"` (`killSlot`,
`server.ts:3072 ff.`). Gezählt: **1** Vorkommen von `handoff` in `audit.jsonl`, gegen 459 `slot_kill`
insgesamt. „Läuft seit 40 Sessions im Kreis" ist von „arbeitet" damit tatsächlich nicht
unterscheidbar — und das ist die Bremse, die unter Autonomie fehlt, nicht der Eingang.

Der Schnitt ist klein und braucht keinen neuen Kanal: eine Generation + eine Ketten-Id, im
`succeed`-Pfad gesetzt, auf `GET /api/self` sichtbar, und **eine Ledger-Zeile je Übergabe** — dann
ist „Kette 7, Generation 12, seit 9 h, 0 Lands" eine Zahl statt eines Gefühls.

---

## 5. Empfehlung zu `FLEET_AUDIT_PING_MS`: **EINSCHALTEN — aber nach `4455adca`**

**Der Zustand, gemessen, nicht gelesen** (`post-land-audits.jsonl` × `audit-adjudications.jsonl`,
Join über `auditAt`):

- 114 Audit-Zeilen, 24 rot (21 %), **24 von 24 adjudiziert, 0 offen**.
- Verdikte: `unknowable` 11 · `stale-test` 7 · `flake` 6 · **`real` 2**.
- Neueste Zeile: `94b1362a`, **rot**, 453 s, `checks {ran:0, failed:0}` — der bekannte Absturz aus
  `e2e/restart.ts:12` (Queue-Zeile `4455adca`).

**Warum einschalten:** Der Anlass dieser Sitzung ist genau der Fall, den `tickAuditPing` schließt —
ein Rot, das der Owner vor der landenden Session sah, weil die Session einen *Vorsatz* statt eines
Mechanismus hatte. Der Ping ist gebaut, gepinnt (`e2e/pins.ts:550`), getestet
(`fleet-e2e-postland-audit.ts:708` prüft ausdrücklich die AUS-Seite), hält sein Ereignis statt es zu
verfallen, und schickt die Fakten zum Urteilen mit — inklusive der Zeile „NICHTS wurde gemessen"
(`server.ts:5779-5780`), die der teure Fund des Tages war. **Backlog beim Einschalten: null.** Die
Wirkung am Tag des Einschaltens wäre also **null** — er bewaffnet eine Fähigkeit, statt Verhalten zu
ändern; dieselbe Form wie `FLEET_HARNESS_AUTOMATION=1` am 2026-08-07.

**Der Preis, und er ist heute akut:** Solange `4455adca` offen ist, erzeugt **jedes Land** ein rotes
Audit aus diesem bekannten Grund (HANDOFF.md sagt es voraus, `94b1362a` bestätigt es). Bei ~10 Lands
am Tag wären das ~10 Pings, jeder braucht eine Adjudikation zum Verstummen — und trainiert seinen
Empfänger darauf, ihn zu ignorieren. Genau davor warnt der Commit-Body von `54ea616` selbst
(„ein Ping, der nur ‚rot' sagt, verteilt Fehlalarme"). Die Basisrate stützt das: **2 von 24 roten
Audits waren `real`** — 92 % der Pings wären Nicht-Befunde.

**Also die Reihenfolge, und sie ist die ganze Empfehlung:**

1. `4455adca` landen (die Suite scheitert wieder als sie selbst).
2. Ein Land abwarten, dessen Audit grün ist **mit `checks.ran > 0`** — sonst schaltet man den Ping
   auf ein Register, das gerade nichts messen kann.
3. Dann `FLEET_AUDIT_PING_MS=60000` in die srv-Spawn-Zeile von `watchdog.sh:153`, direkt neben
   `FLEET_HARNESS_AUTOMATION=1`.
4. **Reihenfolge des Aktivierens, sonst wirkungslos:** `launchctl kickstart -k
   gui/$(id -u)/com.claude-fleet.watchdog` **ZUERST**, danach der srv-Neustart (`POST /api/deploy`
   oder `tmux -L claudefleet kill-session -t srv`). Umgekehrt respawnt der alte Watchdog srv ohne
   die Variable.
5. Verify: ein absichtlich un-adjudiziertes Rot erreicht innerhalb von ≤ 2 min genau eine
   Main-Session, `GET /api/sessions` bzw. `fleet.json.auditPings[<at>].status` steht auf
   `delivered` mit Slot-Nummer, und ein zweiter Tick schickt **nichts** nach.

**Nicht empfohlen:** ihn heute einzuschalten und die Flut als „Kalibrierung" zu buchen. Der Kanal
hat genau einen Versuch, ernst genommen zu werden.

---

## 6. Die offenen Entscheidungen, die dem Owner gehören

Alle fünf sind als **Entwurf** (`pending`, nicht freigegeben) in der Queue abgelegt, jede mit hartem
Done-Kriterium und Verify-Weg.

| Zeile | Entscheidung | Rang |
|---|---|---|
| **`0ae22c2d`** | `FLEET_AUDIT_PING_MS` einschalten — nach `4455adca`, mit `launchctl kickstart` ZUERST (§5) | zuerst: billig, Backlog null, Wirkung heute null |
| **`58d03512`** | **Der Busy-Gate (§0).** Soll eine Nachricht eine *arbeitende* Session erreichen? Keine Bugfrage, eine Haltungsfrage: ein Prompt mitten im Turn kann im Composer landen (Fehlerform `94b1362`/`c845a392`). Zweiter Sensor oder Zustellung auf der Turn-Grenze? Serialisieren mit `fc47f1e1`. | die eigentliche Entscheidung — alles andere hängt daran |
| **`d45898cb`** | Ein „Grün, das nichts gemessen hat" (§2 #2): nur den Ping-Filter weiten, oder das Ledger ehrlich machen? `3f3772b` hat es bewusst offengelassen. | danach |
| **`29829dac`** | Deploy-Verdikt `ok:false`/`null` bekommt einen Empfänger (§2 #3) | danach, erbt `58d03512` |
| **`08230c93`** | Kettenlänge (§4): soll Fleet führen, dass eine Kette im Kreis läuft? Stufe 1 (record) und nichts darüber. | eigenständig, hängt an nichts |

**Nicht als Zeile abgelegt und mit Absicht:** der Eingang (§3, `FLEET_BACKLOG_NUDGE_MS`). Seine
Bedingung 1 — die Sortierung — ist eine Frage an den Owner, keine Arbeit; und die Zeile dafür wäre
ein Bau, den §3 gerade nicht empfiehlt.

---

## 7. Was ich gemessen und was ich nur gelesen habe

**GEMESSEN** (Kommando ausgeführt, Ausgabe gelesen):
- `grep -c FLEET_AUDIT_PING_MS watchdog.sh` = **0**; die vollständige srv-Spawn-Zeile
  (`watchdog.sh:153`) gelesen — weder `AUDIT_PING` noch `BACKLOG_NUDGE` noch `MIGRATE` darin.
- `server.ts` gelesen, nicht gegrept, für: `canDeliver` (3573-3597), `tickAutoReview` (5685),
  `tickAuditPing` (5801-5883), `tickBacklogNudge` (5886-5933), `tickMigrate` (5951-5999),
  `tickWatches` (6010-6060), `handleSelfSucceed` (3441-3500), die Tick-Registrierungen (10174-10190),
  die VERB-2-Region (10956-11060).
- `lane-signals.ts` vollständig (188 Zeilen).
- `post-land-audits.jsonl` × `audit-adjudications.jsonl`, Join über `auditAt`: 114/24/0-offen und
  das Verdikt-Histogramm. **Ein erster Join über `at` war mein Fehler und gab 24 offene Rote — die
  Zahl oben ist die korrigierte.**
- `fleet.json`: `quietHours = null`, `autosOn = true`, `dispatch = true`, `watches = []`,
  `auditPings = {}`, 62 offene von 193 Tasks; die Volltexte von `fc47f1e1`, `94ab77dd`, `c845a392`,
  `3d707a1d`, `4455adca`.
- `audit.jsonl`: Event-Histogramm; `handoff` = 1 Vorkommen gegen 459 `slot_kill`.
- `./state.sh`, `./register.sh` (alle Abschnitte), `git log 54ea616~1..HEAD` mit Bodies.
- `grep -n 'canDeliver('` — alle 12 Aufrufstellen.

**NUR GELESEN, nicht nachgemessen:**
- Die Zahlen aus `fc47f1e1` (idleMs 64 ms, 818 s Prädikat, 25 min armed) — fremde Messung von heute,
  von mir nicht reproduziert. §0 hängt daran; wenn sie fällt, fällt §0.
- Der Kommentar `server.ts:5664-5676` über „~10 Restarts/Tag" — nicht gegen `audit.jsonl` gezählt.
- Die Behauptung aus HANDOFF.md, `4455adca` sei die Ursache **jedes** kommenden roten Audits. Ich
  habe die Signatur nur an `94b1362a` (`checks {0,0}`) bestätigt, nicht am `out`-Feld.
- `e2e-isolated.sh` / `e2e-postland-audit.sh` nur an den gegrepten Env-Zeilen, nicht ganz gelesen.

**NICHT GETAN, mit Absicht:** keine Suite gefahren, kein Merge/Land angefasst, kein Env geändert,
kein `launchctl`, kein Deploy — die andere Main-Session landet, und es gibt einen Suite-Mutex.

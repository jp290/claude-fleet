---
frage: Was misst der Folger second-host beim ersten realen S4-Lauf an sich selbst — lands, Instanz und Modell, bundleStale, HEAD, Helfer, Ledger?
urteil: Der Folger steht wie entworfen (lands:false, bundleStale:false, HEAD gleich main, Helfer inactive), aber sein lokaler Proof ist auf diesem Host strukturell rot und nicht durch meinen Commit: der leak-pin sucht die Deploy-Identitaet des Quell-Checkouts, und die traegt das Wort `second-host`, das in 46 getrackten Dateien 252-mal steht
bereich: [multi-host, programs, verify]
belege:
  - e2e/pins.ts#leak-pin
  - server.ts#bundleStale
  - server.ts#DEFAULT_MODEL
  - src/client.ts#defaultModel
  - audit.jsonl
  - b224ef8bd545e0ab3b396f85902b8083abef2e9c
nicht-gemessen: Das Board selbst (Owner-Token fehlt der Lane), die Gegenprobe auf dem kanonischen Host (dessen .env ist von hier nicht lesbar), und jede Land-, Task- oder Release-Tuer (Non-Goal des Programs)
stand: 2026-09-06
---

# Dual-Host S4 — der Folger-Lauf auf second-host, an dieser Instanz gemessen

2026-09-06, Lane `fleet/260906032010-5d95`, Slot 2 unter dem MAIN-Worktree `s4-main`.
Frage: **Was misst der Folger an sich selbst, wenn eine echte Lane real auf ihm laeuft?**

Jede Zahl steht mit der Tuer, durch die sie kam. Was mir eine Tuer verweigert hat, steht als
`unknown` mit dem Fehlertext; was ich aus einer Regel nachgebaut habe, steht als `abgeleitet`.

## Ergebnis

| Groesse | Tuer | Wert | Art |
| --- | --- | --- | --- |
| `lands` | `GET /api/self/gate` | `false` | gemessen |
| `localProof.steps` | dieselbe | `install, pins, tsc, build, clean-review, security, claude-gate` | gemessen |
| `localProof.isolatedPreview` | dieselbe | `self-assess` | gemessen |
| `localProof.classifiedAs` | dieselbe | `{}` (leer) | gemessen |
| `postlandAudit` | dieselbe | `true` | gemessen |
| `verify.cmd` | dieselbe | siehe Block unten, `timeoutMs` 480000, `waitMs` 2700000, `skipExit` 42 | gemessen |
| `cleanReview` / `autoReview` | dieselbe | `"off"` / `null` | gemessen |
| `mergeRepairRounds` | dieselbe | `2` | gemessen |
| `rulebookDrifted` | dieselbe | `null` | gemessen |
| `helper.online` | dieselbe | `false`, `name`/`mode`/`lastSeenAgeMs` je `null` | gemessen |
| `suiteLock.state` | dieselbe | `stale`, pid 201952 fort, `heldMs` 24108125.7, `nextAction` `reap on next contender` | gemessen |
| HTTP-Status der Gate-Tuer | dieselbe | 200 | gemessen |
| `FLEET_INSTANCE` | `grep` auf `/home/second-hostowner/claude-fleet/.env` | `second-host` | gemessen |
| `FLEET_LANDS` | dieselbe | `0` (Kommentar: „2026-09-05 W2 Controller Slot 7: Folger landet nie (Dual-Host S2)") | gemessen |
| `FLEET_MODEL` | dieselbe | `claude-opus-5[1m]` (Kommentar: „2026-09-06 05:16 Controller Slot 2 (mac): Lane-Default wie auf dem kanonischen Host (Modellpolitik 2026-09-02)") | gemessen |
| Modell im Footer/Picker des Boards | `server.ts:24793` `defaultModel: DEFAULT_MODEL`, `server.ts:279-280`, `src/client.ts:319` | `claude-opus-5[1m]` | abgeleitet |
| `public/app.js` mtime | `stat -c '%Y'` | 1788664456 = 2026-09-06 05:14:16 CEST | gemessen |
| `public/share.js` mtime | dieselbe | 1788664456 = 05:14:16 | gemessen |
| `public/helper.js` mtime | dieselbe | 1788664456 = 05:14:16 | gemessen |
| neueste Datei unter `src/` | `find -printf '%T@ %p'` | 1788655692.2023073830 `src/protocol.ts` = 02:48:12 | gemessen |
| `bundleStale` | Regel aus `server.ts#bundleStale` nachgerechnet | `false` (alle drei Bundles 8764 s juenger als die neueste src-Datei) | abgeleitet |
| Worktree-HEAD | `git rev-parse HEAD` | `b224ef8bd545e0ab3b396f85902b8083abef2e9c` | gemessen |
| HEAD des Haupt-Checkouts | `git -C /home/second-hostowner/claude-fleet rev-parse HEAD` | derselbe SHA | gemessen |
| `main` des Haupt-Checkouts | dasselbe Kommando, Ref `main` | derselbe SHA | gemessen |
| `fleet-helper` | `systemctl --user is-active` | `inactive` | gemessen |
| `fleet-sync.timer` | `systemctl --user list-timers` | naechster Lauf 2026-09-06 05:29:19 CEST (in 8 min), letzter 05:11:33 (vor 9 min), Unit `fleet-sync.service` | gemessen |
| Zeilen in `audit.jsonl` | `wc -l` | 28 | gemessen |
| `lane_*`-Zeilen zu meinem Slot | `grep` im selben Ledger | 0 | gemessen |
| `bun install --frozen-lockfile` | im Lane-Worktree | letzte Zeile `9 packages installed [5.00ms]` | gemessen |
| `bun e2e/pins.ts` | im Lane-Worktree | 419 Zeilen: 410 PASS, 8 SKIP, **1 FAIL**, exit 1, letzte Zeile `1 FAILURES` | gemessen |
| Treffer des roten Pins | dessen eigener Detailtext | 252 Treffer in 46 getrackten Dateien | gemessen |
| Nadel, die diese 252 erklaert | `git grep -I -i -n -F -e second-host` | 252 Treffer, gleicher erster (`HANDOFF.md:21`) und letzter (`server/proc.ts:89`) | gemessen |
| eigene Session | Spawn-Prompt dieser Lane | Harness `claude`, Modell `claude-opus-5[1m]` | gemessen |

`verify.cmd` woertlich, wie die Gate-Tuer sie ausliefert:

```
[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; bun install --frozen-lockfile || { echo "verify failed: bun install could not establish node_modules"; exit 1; }; bun e2e/pins.ts && bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun e2e/pins.ts src/client.ts src/share.ts src/helper.ts server.ts fleet-e2e.ts fleet-e2e-claude-gate.ts fleet-e2e-clean-review.ts fleet-e2e-security.ts fleet-e2e-postland-audit.ts fleet-e2e-harness.ts merge-prompt.ts && bun run build && ./e2e-clean-review.sh && ./e2e-security.sh && ./e2e-claude-gate.sh
```

`lands:false` ist Absicht, kein Befund: `FLEET_LANDS='0'` traegt den Grund im eigenen
Zeilenkommentar. Der Folger landet nicht.

### Der rote Pin, und warum er nicht meiner ist

Der lokale Proof ist rot. Der Kopf des Fehlers woertlich:

```
FAIL  leak-pin: tracked files contain no configured deploy identity  (252 hit(s): [HANDOFF.md:21, HANDOFF.md:25, ...])
```

Der Mechanismus steht in `e2e/pins.ts#leak-pin` (Abschnitt 0, „Public-repository deployment
identity"): der Pin liest `FLEET_HOST`, `FLEET_ALLOWED_HOSTS` und `FLEET_SHARE_HOSTS` aus der
`.env` des QUELL-Checkouts (fuer eine Lane loest `SOURCE_DIR` ueber die `gitdir:`-Zeile auf
`/home/second-hostowner/claude-fleet` auf), zieht aus jedem Wert den URL-Hostnamen, ergaenzt bei
drei oder mehr Labels die Elterndomain und sucht die so gewonnenen Identitaeten mit
`git grep -I -i -n -F` in den getrackten Dateien. Alle drei Schluessel stehen in der `.env` dieses
Hosts.

Zwei Messungen trennen die Ursache von meiner Lane:

1. **Der Baum ist unveraendert.** Der Lauf fand auf `b224ef8b` statt, `git status --porcelain` war
   davor leer, und jeder der 252 Treffer liegt in einer Datei, die ich nicht angefasst habe
   (`HANDOFF.md`, `docs/`, `e2e/`, `server.ts`, `server/proc.ts`, `helper-daemon/`).
2. **Die Nadel ist ein gewoehnliches Wort dieses Korpus.** `git grep -I -i -n -F -e second-host`
   liefert exakt dieselben 252 Treffer mit demselben ersten und letzten Fund. Die gesuchte
   Deploy-Identitaet und der Instanzname des Folgers teilen sich das Token `second-host` — und dieses
   Token ist zugleich das Wort, mit dem dieses Repo seit dem 2026-08-27 ueber diesen Host schreibt.

Daraus folgt [abgeleitet], was S4 fuer kuenftige Lanes wissen muss: solange die Deploy-Identitaet
des Quell-Checkouts dieses Token traegt, ist `bun e2e/pins.ts` auf dem Folger fuer JEDE Lane rot,
docs-only eingeschlossen, und zwar deterministisch statt flaky. Der Pin misst dabei genau das, wofuer
er gebaut wurde; verschoben ist nicht der Pin, sondern die Konfiguration unter ihm.

Diese Notiz vergroessert die Trefferzahl selbst, weil sie den Instanznamen nennt — was der Auftrag
verlangt und der Dateiname ohnehin traegt. Und in ihrem ersten Entwurf tat sie mehr als das: der
Lauf nach dem Commit meldete 274 Treffer, waehrend `git grep` auf das Token `second-host` nur 273
fand. Die eine Differenz war MEINE, keine geerbte — die Methoden-Zeile mit dem `curl` hatte die
Origin dieser Instanz als IP in eine getrackte Datei geschrieben, und das ist genau die Klasse, die
der Pin bewacht. Die einzige vorbestehende Nennung derselben Adresse (`HANDOFF.md:308`) faellt nicht
zusaetzlich auf, weil auf jener Zeile auch das Wort `Second-host` steht und der Pin Zeilen zaehlt,
nicht Vorkommen. Die Zeile ist auf `<eigene Instanz>` zurueckgebaut; der Pin hat hier als Sensor
funktioniert, nicht als Hindernis.

Die Gegenprobe auf dem kanonischen Host ist von hier **unknown**: dessen `.env` liegt auf der
anderen Maschine, und dieser Lauf hat keine Tuer dorthin. Ob der Pin dort gruen ist, sagt diese
Messung nicht.

### Ledger, woertlich

`audit.jsonl` des Haupt-Checkouts traegt zum Messzeitpunkt 28 Zeilen. Die des laufenden Programs:

```
{"ts":1788664526591,"event":"dispatch_switch","detail":"on"}
{"ts":1788664627240,"event":"slot_open","slot":1,"detail":"/home/second-hostowner/claude-fleet.worktrees/s4-main"}
{"ts":1788664627257,"event":"self_heal_recreate","slot":1,"detail":"created:no-session"}
{"ts":1788664631911,"event":"program_dispatch","detail":"4f6f3144fe214781b56a0ac5 on=true maxLanes=1"}
{"ts":1788664652883,"event":"owner_auth_fail"}
{"ts":1788664803354,"event":"main_task","slot":1,"detail":"cfd49c10 program=4f6f3144fe214781b56a0ac5 auftrag"}
{"ts":1788664810083,"event":"task_release","slot":1,"detail":"cfd49c10 program=4f6f3144fe214781b56a0ac5"}
{"ts":1788664810658,"event":"slot_open","slot":2,"detail":"/home/second-hostowner/claude-fleet.worktrees/s4-main.worktrees/fleet-260906032010-5d95"}
{"ts":1788664810674,"event":"self_heal_recreate","slot":2,"detail":"created:no-session"}
```

In Ortszeit: `dispatch_switch on` 05:15:26, `slot_open` des MAIN-Worktrees `s4-main` 05:17:07,
`program_dispatch` des Programs `4f6f3144fe214781b56a0ac5` 05:17:11, `main_task` und `task_release`
der Auftragszeile `cfd49c10` 05:20:03 und 05:20:10, `slot_open` meines eigenen Slots 2 um 05:20:10.

Zu meinem Slot traegt der Ledger **zwei** Zeilen: das `slot_open` und das `self_heal_recreate`.
`lane_*`-Zeilen gibt es zu ihm null. Die drei `owner_auth_fail` und die 16 aelteren Zeilen aus
`/home/second-hostowner/claude-fleet` stammen aus Slots vor diesem Program.

## Methode

Jedes Kommando lief aus dem Lane-Worktree
`/home/second-hostowner/claude-fleet.worktrees/s4-main.worktrees/fleet-260906032010-5d95`;
`/home/second-hostowner/claude-fleet` wurde ausschliesslich gelesen.

```sh
# 1 — Gate
curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" "http://<eigene Instanz>:8790/api/self/gate"

# 2 — Instanz und Modell, nur diese drei Schluessel
grep -E '^FLEET_(INSTANCE|LANDS|MODEL)=' /home/second-hostowner/claude-fleet/.env

# 3 — bundleStale, nachgebaut aus server.ts#bundleStale
stat -c '%Y %n' /home/second-hostowner/claude-fleet/public/{app,share,helper}.js
find /home/second-hostowner/claude-fleet/src -type f -printf '%T@ %p\n' | sort -n | tail -1

# 4 — HEAD hier und dort
git rev-parse HEAD
git -C /home/second-hostowner/claude-fleet rev-parse HEAD main

# 5 — Helfer
systemctl --user is-active fleet-helper
systemctl --user list-timers --no-pager | grep fleet

# 6 — Ledger
cat /home/second-hostowner/claude-fleet/audit.jsonl

# Proof (docs-only: install + pins)
bun install --frozen-lockfile
bun e2e/pins.ts

# Nadel des roten Pins
git grep -I -i -n -F -e second-host -- | wc -l
```

Die `bundleStale`-Regel aus `server.ts#bundleStale`: `stale` ist wahr, wenn irgendein Bundle
AELTER ist als die neueste Datei unter `src/` (`!bundles.every((m) => m >= srcNewestMtime)`), und
`null`, wenn ein Bundle oder die src-Zeit fehlt. Hier: 1788664456 gegen 1788655692, dreimal juenger,
also `false`. Die Rechnung ist deshalb `abgeleitet` und nicht `gemessen` — den Wert des Servers
selbst gibt die Gate-Route nicht heraus, sie steht in `/api/steward/...` hinter dem Owner-Token.

Nach dem Commit dieser Notiz gemessen: der Pin meldet 276 Treffer, `git grep` auf dasselbe Token
ebenfalls 276 (vorher je 252), verteilt auf 47 statt 46 Dateien. Die 24 neuen Zeilen sind die
Nennungen des Instanznamens in dieser Datei (23) und ihre Index-Zeile (1). Die Zahl ist
selbstbezueglich: jede weitere Nennung des Tokens `second-host` in dieser Datei erhoeht sie um eins.
Der Wert oben ist deshalb nach der letzten inhaltlichen Aenderung erhoben und danach nur noch
bestaetigt worden.

## Was nicht gemessen wurde

- **Das Board.** Footer und Modell-Picker sieht diese Lane nicht; sie hat kein Owner-Token. Der
  Wert `claude-opus-5[1m]` ist deshalb `abgeleitet`: er ist die Server-Konstante `DEFAULT_MODEL`
  (`server.ts:279-280`, gespeist aus `FLEET_MODEL`), die `server.ts:24793` als `defaultModel`
  ausliefert und die `src/client.ts:319` als Platzhalter in Footer und Picker zeigt. Gesehen habe
  ich die Konstante und ihren Weg, nicht das gerenderte Bild.
- **`provenance.instance` der Report-Zeile.** Entsteht erst mit meinem Report; zitieren kann das
  nur die MAIN im HANDOFF, nicht diese Notiz.
- **`program_main_*`, `fleet_report_open`, `slot_kill … handoff`.** Diese Ledger-Zeilen sind zum
  Messzeitpunkt strukturell noch nicht vorhanden: die erste entsteht mit meinem Report, die letzte
  erst mit dem Succeed der MAIN. Sie fehlen nicht, sie sind noch nicht faellig.
- **Die Gegenprobe des leak-pins auf dem kanonischen Host** — dessen `.env` ist von hier nicht
  lesbar (`unknown`).
- **Jede schreibende Tuer.** Kein Land-Versuch, kein `POST` auf `/api/self/tasks`, `/release` oder
  `/attention` (409 by design), keine Aenderung an `server.ts`, `e2e/`, den Suiten, `watchdog.sh`,
  `.env` oder den systemd-Units. Non-Goals des Programs, unberuehrt.
- **Die uebrigen fuenf Stufen des `verify.cmd`** (`tsc`, `build`, `clean-review`, `security`,
  `claude-gate`). Fuer eine docs-only-Lane ist der Proof `install + pins`; die anderen liefen nicht.
- **Warum `fleet-helper` inactive ist.** Gemessen ist der Zustand, gelesen an zwei Tueren
  (`systemctl` und `helper.online:false` im Gate). Die Ursache habe ich nicht verfolgt.

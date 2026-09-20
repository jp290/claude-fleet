# `bun run build` raeumt `bundleStale` nicht ab — die Messfrage, gegen den Code und gegen eine lebende Instanz beantwortet

Gemessen 2026-09-20 von der Lane `fleet/260920194230-0583` am Baum `ea3b141b`.
Anlass: eine Beobachtung vom 2026-09-17 11:30 — alle vier Bundles frisch gebaut, `GET /api/sessions`
meldete weiter `appJsMtime: 1789622411679` und `stale: true`. Die Frage der Auftragszeile lautete:
**hat der Refresh geworfen, oder lief der Tick nicht?** — und danach: Sensor reparieren ODER die
Regelbuch-Zeile korrigieren, eines von beiden sei falsch.

**Antwort in einem Satz:** keines von beiden ist falsch — die Arithmetik des Sensors ist an einer
lebenden Instanz als korrekt gemessen, die Regelbuch-Zeile sagt bereits, was sie sagen muss, und die
Frage selbst war 2026-09-17 nicht mehr beantwortbar, weil beide Zeugen mit jenem Boot gestorben sind.
Der Defekt liegt daneben und ist echt: **die Lesung trug nicht, WANN sie entstand** — eine
eingefrorene Lesung war von einer frischen nicht unterscheidbar. Genau das ist repariert.

## 1 · WAS DIE 09-17-ZAHLEN BELEGEN, bevor irgendeine Hypothese drankommt

`1789622411679` = **2026-09-17 07:20:11.679**. Das Deploy-Ledger (`deploys.jsonl`) fuehrt fuer
denselben Tag sieben `boot`-Zeilen; die relevante:

| Zeit | stage | ok | bundleStale | bootHead |
| --- | --- | --- | --- | --- |
| 07:20:17 | boot | true | **false** | `e4d8e1ba` |
| 15:03:56 | boot | true | false | `d8ece3a0` |

Die gemeldete `appJsMtime` liegt **5 s vor** dem Boot um 07:20:17, und der naechste Boot kam erst
um 15:03:56. Die 11:30-Lesung stammt also aus dem 07:20:17-Boot, und sie zeigte den Stand, den
`public/app.js` bei genau diesem Boot hatte. Das Ledger sagt fuer denselben Moment `bundleStale:
false` — und diese Zeile wird FRISCH berechnet, nie aus `deployFacts` (`server.ts`, Kommentar
„THE VERDICT … computed FRESH (never `deployFacts`…)").

## 2 · DIE BEIDEN GENANNTEN URSACHEN — eine ist nicht stumm, die andere gemessen unauffaellig

**(a) „Der Refresh hat geworfen."** `refreshDeployFacts` faengt jeden Fehler und behaelt die vorige
Lesung — das ist der einzige wirklich stumme Pfad der Region. Seine beiden Eingaben sind
`deployGap()` und `bundleStale()`.

**(b) „Der Tick lief nicht."** Ein Wurf, der aus `tickGit` ENTKOMMT, ist NICHT stumm:
`setInterval(() => void tickGit().catch((e) => logError("tickGit", e)), GIT_TICK_MS)`. Ein solcher
Wurf steht in der `server.log` der Instanz **und** im `errors`-Kanal auf `/api/sessions`.

**Gegenprobe an einer lebenden Instanz** (Wegwerf-Kopie im Scratchpad, eigener Socket
`fleetlane73`, Port 8873, `FLEET_CMD=true`; danach `tmux -L fleetlane73 kill-server`, Port tot):

1. Vier Bundles angefasst (`utimes`), ohne Slot → die Route zeigte die neuen Mtimes **beim
   naechsten Tick** (≈ 6 s, `GIT_TICK_MS` 10 s).
2. Einen Slot mit echtem cwd geoeffnet, den cwd **weggeloescht** (der haeufigste Zustand der
   Live-Box: eine gelandete Lane ohne Baum), dann wieder alle vier Bundles angefasst → die Route
   zeigte die neuen Mtimes nach 8 s, `errors: null`. Der Tick traegt also auch ueber einen Slot
   hinweg, dessen Verzeichnis unter ihm verschwindet.

Damit ist (a) fuer die naheliegenden Stressoren widerlegt und (b) als STUMME Ursache ausgeschlossen.

## 3 · DIE DRITTE URSACHE, die die Auftragszeile nicht nannte — und die einzige, die still ist

`tickGit` beginnt mit `if (gitTickBusy) return; gitTickBusy = true;` und ruft `refreshDeployFacts()`
als **letzte** Anweisung seines `try`. Haengt irgendein `await` in der Slot-Schleife, laeuft der Tick
nie zu Ende, `gitTickBusy` bleibt `true`, und **jeder weitere Tick kehrt sofort um**. Nichts wirft,
nichts wird geloggt, die alte Lesung wird fuer immer weitergereicht.

Der Kandidat dafuer steht im Code und ist eine bewusste Entscheidung, kein Versehen: `tmux()`
(`server/tmux.ts`) hat **keinen Timeout** — der Kommentar daneben begruendet es („Only process
creation gets a wall-clock bound"). Die Schleife ruft `capture-pane` je Slot. Ein haengender
tmux-Server friert damit die Deploy-Fakten ein, lautlos.

**Was daraus NICHT folgt:** dass es am 2026-09-17 so war. Es folgt nur, dass die Frage der
Auftragszeile eine dritte Antwort hatte, die niemand haette sehen koennen.

## 4 · WARUM DIE FRAGE FUER 09-17 NICHT MEHR BEANTWORTBAR IST

Beide Zeugen sind **per Boot**: die `server.log` der Instanz wird beim Start ueberschrieben, und
`errors` zaehlt seit dem Boot (dieselbe Klasse, die `docs/messungen/2026-09-11-inbox-nudge-composer-129.md`
§1 schon einmal bezahlt hat). Der fragliche Boot endete am 09-17 um 15:03:56. Die heutige
`server.log` der Live-Instanz traegt 0 `tickGit`-Zeilen — das ist eine Aussage ueber den HEUTIGEN
Boot und keine ueber den vom 17.

## 5 · DIE REGELBUCH-ZEILE IST NICHT FALSCH

`rulebook/deploy.md` sagt woertlich: `stale:true` → `bun run build` **im Haupt-Checkout**, sonst ist
der Client-Teil des Lands unsichtbar. Der Zusatz „im Haupt-Checkout" ist der Punkt: `REPO_DIR` ist
`process.env.FLEET_REPO_DIR || import.meta.dir`, fuer den Live-Server also `~/claude-fleet`. Ein
Build in einem Lane-Worktree schreibt ein anderes `public/` und laesst die Lesung des Servers
voellig unberuehrt — **von einem eingefrorenen Cache nicht unterscheidbar**, solange die Lesung kein
Datum traegt. Das ist die parsimonischste Erklaerung der 09-17-Beobachtung, und sie ist heute nicht
mehr pruefbar. Die Zeile bleibt, wie sie ist.

## 6 · DIE REPARATUR — nicht die Arithmetik, die EHRLICHKEIT

`deployFacts` traegt jetzt `at` (den Zeitpunkt der Lesung), und die Zahl reist unter demselben Namen
auf beiden Oberflaechen: `deployFactsAt` auf `/api/sessions` (dem Owner-Poll) und in der
`integration`-Projektion der Steward-Sicht. Der `catch` laesst `at` beim Wert der BEHALTENEN Lesung —
die Zahl datiert die Tatsache, nie den Versuch. Die Steward-Sicht sagt es zusaetzlich in Worten: ist
die Lesung aelter als zehn Ticks, kommt eine `unknown`-Zeile mit ihrem Alter in Sekunden, statt dass
eine vier Stunden alte Zahl als Gegenwart gelesen wird.

Sonden in `e2e/deploy-facts.ts` §1, zwei, und die zweite ist die, die zaehlt: `deployFactsAt` ist
eine Zahl und liegt nicht in der Zukunft — und sie **BEWEGT sich mit dem Tick**. Einmal beim Boot
gestempelt (die naheliegende falsche Implementierung) faellt der zweite Check.

## 7 · WAS NICHT GEMESSEN IST

- Ob am 2026-09-17 der Tick haengengeblieben war oder in einem Lane-Worktree gebaut wurde. Nicht
  entscheidbar, siehe §4.
- Ob `tmux()` auf der Live-Box je wirklich gehangen hat. Der Pfad ist am Code gelesen, nicht
  beobachtet; ein Timeout dort waere eine eigene Entscheidung mit eigenen Kosten (der Kommentar in
  `server/tmux.ts` nennt sie) und ist hier NICHT angefasst.
- Die Messung lief auf einer Instanz mit 0 und mit 1 Slot, nicht mit den zehn der Live-Box.

# second-host-Baseline: 3× `./e2e-isolated.sh` auf dem Linux-Helfer (2026-08-29)

S4-Messlauf des Programms Linux-Work-Horse-Anbindung (`docs/linux-second-host-programm-2026-08-28.md`
§S4). Zweck laut Plan: die Flake-Familien des Regelbuchs sind an tmux 3.6a/macOS vermessen — diese
Notiz ist die **Adjudikationsgrundlage für jedes spätere Remote-Rot** von diesem Gerät. Gerätename
„second-host"; Adressen, Nutzer und Hardware-Kennungen stehen bewusst nicht hier (Repo public), der
private Setup-Report führt sie.

## Versionsstand (gemessen am Gerät)

| | |
|---|---|
| OS / Kernel | Debian GNU/Linux 13 (trixie), 6.12.105+deb13-amd64 |
| tmux | **3.5a** (Regelbuch-Flakes sind an 3.6a vermessen) |
| bun | 1.4.0 (Linux x64) |
| git / zsh | 2.47.3 / 5.9 |
| `sh` | **dash** (Debian-Default; auf macOS ist `sh` bash im sh-Modus) |
| Baum | `0d4dca8` (identisch zum Mac-HEAD beim Messzeitpunkt) |
| CPU-Last daneben | keine (frisch gebootet, load < 0,4, kein weiterer Nutzer) |

Referenz Mac (gleicher Baum, Live-Audit vom selben Morgen): grün, 3133 Checks / 0 FAIL, 1281 s.

## Die drei Läufe

Seriell (nie parallel — Regelbuch §Suite-Kontention), via `nohup setsid`, Log je Lauf in Datei.

| Lauf | Exit | Dauer | PASS | FAIL | Abbruchpunkt |
|---|---|---|---|---|---|
| 1 | 1 | 598 s | 1655 | 67 | TypeError `e2e/programs.ts:2250` |
| 2 | 1 | 611 s | 1655 | 67 | TypeError `e2e/programs.ts:2250` (identisch) |
| 3 | 1 | 604 s | 1655 | 67 | TypeError `e2e/programs.ts:2250` (identisch) |

**Das zentrale Ergebnis: die Fails sind DETERMINISTISCH, kein Flake-Rauschen.** Lauf 1 und 2
unterscheiden sich in der anchored-FAIL-Menge um exakt eine Zeile, und die nur im gemessenen
ms-Wert (30015 vs. 30013); Crash-Punkt und Reihenfolge sind byte-identisch. Für die Adjudikation
heißt das: **ein Remote-Rot vom second-host mit einer Signatur AUSSERHALB der untenstehenden Liste
ist ein echter Befund** — die bekannte Linux-Differenz rauscht nicht, sie steht still.

Zweitens: der Lauf ist ENTHAUPTET — der TypeError bricht `fleet-e2e.ts` bei Check ~1722 von 3133
ab, alle Module hinter `programs.ts` liefen NIE. 1655 PASS sind also kein „1655 von 1722 gut",
sondern „die erste Hälfte der Suite besteht bis auf die untenstehenden Familien". Ein second-host-Grün
gibt es erst, wenn die Wurzel behoben ist; bis dahin ist jedes Remote-Verdikt dieses Geräts für den
Fleet-Baum bestenfalls „rot mit bekannter Signatur".

## Die Fail-Familien (67, aber wenige Wurzeln)

1. **Program-MAIN-Kaskade (~55 der 67, `e2e/programs.ts`):** Wurzel in der Succession-Sektion —
   der Codex-Stand-in-Spawn etabliert die Fixture nicht (`ACP-16 fixture: … cwd=undefined
   harness=undefined`), danach fällt alles stromabwärts mit 33× `401 unauthorized` (Self-Token der
   nie etablierten Bindung) und endet im TypeError bei `programs.ts:2250` (`spawnOkBody.task`
   undefined nach einem 401 auf dem Filing). EINE Wurzel, nicht ~55.
2. **Kill-Eskalation (`V1: SIGKILL escalation` + `V1: WAIT budget`, 2 Checks):** beide Läufe
   enden exakt bei `standInExitsAt=30000` — der SIGKILL erreichte den Arbeiter nie, der Stand-in
   lief bis zu seinem eigenen Exit. Kandidat: `sh -c` ist hier **dash**; wo dash resident bleibt
   statt zu exec-en, landet der Kill auf der Shell, das Kind überlebt. (Dieselbe Naht, die
   `helper-daemon/daemon.ts#runCmd` für macOS im Kommentar begründet.)
3. **Transcript-Endpoint (`total=0 entries=0 source=null`, 1 Check):** Quelle liefert auf Linux
   nichts; Mechanismus ungeklärt, nicht weiter verfolgt.
4. **Rest (~9):** Folge-Checks der Familien 1–2 in Nachbarsektionen (V1a/V1b-Sichten auf die von
   der Kaskade hinterlassene Welt); keine eigene Signatur.

Ungeprüft blieb: die Wurzel von Familie 1 im Detail (welcher Schritt des Stand-in-Spawns auf
Linux abweicht — tmux 3.5a-Verhalten, dash, oder ein `ps`-Format sind die Kandidaten in dieser
Reihenfolge), und alles hinter Check ~1722, das nie lief.

## Operative Konsequenzen

- Der Helper-Daemon läuft auf dem second-host mit einem `suiteCmd`, der den `AUDIT_CMD` des
  Watchdogs WÖRTLICH spiegelt (Skip-Wache + install + Suite) — ein remote-Verdikt und ein
  lokales müssen dasselbe bedeuten, auch im Skip-Fall (Nicht-Fleet-Repo ⇒ exit 42 ⇒ unknown,
  nie 127).
- Beim Deploy gefunden, im Unit-Template nachgezogen: systemds Default-PATH kennt das
  bun-Prefix nicht, und `childEnv()` reicht den Daemon-PATH an install/suite durch — ohne
  `Environment=PATH=…` stirbt beides als exit 127, und zwar STILL (unknown, nie rot).
- „Leiser gewinnt" live bewiesen (Owner-Wunsch `quiet` überstimmt lokal-aktiv abwärts,
  Journal-Zeile `mode quiet (local active — owner wishes quiet)`); die Aufwärts-Hälfte (lokale
  Quiet Hours schlagen Owner-`active`) beweist `e2e/helper-daemon.ts`.

## Nachtrag (später am 2026-08-29)

- **Aktivierung vollzogen:** `FLEET_AUDIT_HELPER_GRACE_MS` steht live auf `60000`
  (Config-Sensor: `live=60000 | .env='60000'`), Server-`bootHead` == HEAD == `050f96c`,
  `bundleStale` false. Ohne diese Grace kickt ein Land den lokalen Audit-Drain synchron und der
  15-s-Poll des Daemons sieht den Job nie — Mechanismus und die Claim-Fähigkeits-Regel stehen in
  `docs/linux-second-host-programm-2026-08-28.md` §„S4 — was der Erstbetrieb geändert hat".
- **Die Vergleichszahl für die Adjudikation, gleicher Tag, gleiche Suite:** der Mac auditierte
  `050f96c` grün mit `checks{ran:3133,failed:0}` in 1273566 ms. Der second-host kam auf
  1655 PASS / 67 FAIL mit Abbruch bei Check ~1722 (die drei Läufe oben, Baum `0d4dca8`; die
  Commits dazwischen fassen die gefallenen Familien nicht an). Diese beiden Zahlen nebeneinander
  sind der eigentliche Wert dieser Notiz: **ein Remote-Rot mit GENAU dieser Signatur ist
  Plattform, kein Regress — jede ANDERE Signatur ist ein echter Befund.**
- **Erwartung für den ersten echten Remote-Job, vorab hingeschrieben, damit sie später nicht
  umgedeutet wird:** er wird ROT sein. Solange die Signatur die bekannte ist, ist genau das der
  bestandene Beweis für S4-(5) — nicht sein Fehlschlag.

## Nachtrag (2026-08-30): die Wurzeln, gemessen — und der Lauf ist nicht mehr enthauptet

Diese Notiz sagte oben „Ungeprüft blieb: die Wurzel von Familie 1 im Detail (tmux 3.5a-Verhalten,
dash, oder ein `ps`-Format sind die Kandidaten in dieser Reihenfolge)". **Keiner der drei war es.**
Die Kandidatenliste wird hier korrigiert, weil sie sonst die nächste Sitzung in die falsche
Richtung schickt. Alle Messungen unten stammen von derselben Maschine, gegen `run1.log`.

| Familie | Wurzel | Was sie wirklich war |
|---|---|---|
| 1 (~55 Zeilen + Abbruch) | **`node` ist auf dem second-host nicht installiert** | `respawnScreen`/`screenLane` pflanzten ihre Pane-Bildschirme als `node -e …`. `tmux respawn-pane` reicht das Kommando nur an eine Shell weiter und antwortet **0**; das Kommando stirbt, die Pane stirbt, die tmux-Session `sN` stirbt — und jeder Delivery-Gate liest danach `not-alive`. Die Fixture meldete Erfolg, während sie den Slot zerstörte. |
| 2 (2 Zeilen) | **`sh -c "<ein Kommando>"` wird von dash GEFORKT, von bash EXECT** | Die Kill-Staffel signalisierte damit eine Shell, unter der nichts mehr hing, während die Kette samt Kindern weiterlief und die stdout-Pipe offen hielt (`ms:30015` = der EIGENE Exit des Stand-ins). Die Vermutung dieser Notiz („wo dash resident bleibt statt zu exec-en") war richtig — hier ist die Messung dazu. |
| 3 (1 Zeile) | **Die Zeile hatte gar keine Fixture** | Sie las Slot 1 (`~/claude-fleet`) und behauptete damit über die echten claude-Chatverläufe der ausführenden Maschine. Auf dem second-host hat dort nie jemand claude laufen lassen, also antwortete die Route korrekt `total=0`. Kein Mechanismus, eine unausgesprochene Vorbedingung. |
| 4 (~9 Zeilen) | Folge von 1 | bestätigt. |

**Zwei Dinge, die diese Notiz noch nicht sehen konnte, weil der Lauf enthauptet war:**

- **`ast-grep` fehlt auf dem Gerät** (auf dem Mac `~/.local/bin/ast-grep`, 0.45.1). Zehn
  `sweep`-Zeilen werden dadurch rot — korrekt, `review-sweep.ts` meldet exit 2 und
  `checksThatCouldNotRun:["cast"]`, es misst dann eben nichts. **Der Daemon-PATH
  (`fleet-helper.service`, `Environment=PATH=…/.bun/bin:/usr/local/sbin:/usr/local/bin:
  /usr/sbin:/usr/bin:/sbin:/bin`) enthält `~/.local/bin` nicht** — eine Installation dorthin
  würde der Daemon also nicht sehen. Owner-Akt, ein statisches Binary.
- **Ein zweiter Enthauptungspunkt**, hinter dem ersten versteckt: `e2e/sweep.ts` warf
  `TypeError: undefined is not an object (evaluating 'closed.id')`, weil eine Fixture (eine zuvor
  gemintete Zeile) fehlte, die ohne ast-grep nicht entstehen kann. Behoben; die Familie fällt
  jetzt als sie selbst und lässt den Rest der Suite laufen.

**Stand nach den Reparaturen** (Lane `fleet/260830005056-09e6`, gleiche Maschine, task-eigener
Scratch-Klon, ast-grep task-lokal bereitgestellt): die Familien 1–4 sind weg, der Lauf ist
vollständig statt enthauptet. Die Zahlen stehen im Lane-Report und in den Commit-Bodies dieser
Lane; die adjudikatorische Aussage dieser Notiz kehrt sich damit um: **ein Remote-Rot vom
second-host ist ab jetzt wieder ein Befund, nicht Plattform** — mit der einen benannten Ausnahme
`ast-grep`, solange es dem Daemon fehlt.

## Plattform-Signatur (2026-09-01): die Locale-Falle in der Geburtsidentität des Suite-Locks

**Symptom.** `ps -o lstart=` ist locale-formatiert. Auf dem second-host (Debian 13, `de_DE`)
liefert es `Di Sep  1 ...`; `e2e-stage.sh#_st_valid_birth` verlangt englische Monats- und
Tagesnamen (`^[A-Z][a-z]{2} [A-Z][a-z]{2} ...`) und weist die Zeile ab. Der Lock trägt dann keine
gültige Geburt, `identityProven` bleibt `null`, und die Checks der Lock-Familie fallen
**geschlossen** — sie melden nicht „die Identität stimmt nicht", sondern „nie gemessen", was sich
in der Zeile wie ein Regress liest.

Dieselbe englische Erwartung steht an drei weiteren Stellen: `e2e/verify-queue.ts#processBirthOf`
(schreibt die Geburt in die Sonden-Locks), `server.ts#PROCESS_BIRTH_RE` (liest sie zurück) und
`state.sh` (nur Anzeige).

**Datum und Anlass.** Gemessen am 2026-09-01 am Gerät. Der auslösende Lauf ist der erste
Remote-Audit des Programms Generalsanierung (Tip `3058556`, `post-land-audits.jsonl` `at`
1788249040866, 3366 Checks, „10 FAILURES", exit 1). Er ist als **`unknowable`** adjudiziert —
nicht als Plattform-Signatur: `server.ts#helperResult` speichert nur eine Tail-Kappe, in der
keine einzige `FAIL`-Zeile steht, also gibt es keine Namen zu vergleichen
(`docs/messungen/p0-baseline-generalsanierung-2026-09-01.md` §Tip `3058556`). Die **Zahl** 10
deckt sich mit der Lock-Familie; das ist eine Übereinstimmung, kein Beweis. Was gemessen ist:
die deutsche `lstart`-Ausgabe und ihre Abweisung durch den Validator.

**Fix** (Queue-Zeile `5e79be26`, W3 Schnitt 4 der Zeile `e4fe3d88`): `LC_ALL=C` an jeder Stelle,
an der eine `lstart`-Ausgabe gegen ein Regex oder einen gespeicherten Wert gelesen wird —
`e2e-stage.sh#_st_birth_of`, `e2e/verify-queue.ts#processBirthOf`, `state.sh`. Festgehalten von
zwei Pin-Zeilen in `e2e/pins.ts`: die bestehende Zeile „suite-lock contender proves a live holder
by pid AND process birth" verlangt jetzt wörtlich `LC_ALL=C ps -o lstart=`, und eine neue Regel
über eine ABGELEITETE Menge (alle `lstart`-Aufrufe in den Shell-Skripten und den `e2e/`-Modulen)
fängt einen vierten, morgen hinzugefügten Leser.

**Offen, benannt statt still zugedeckt:** `server.ts#processBirthFingerprint` liest `lstart`
genauso und prüft gegen `PROCESS_BIRTH_RE` — **ohne** `LC_ALL=C`. Der Schnitt durfte `server.ts`
nicht anfassen (Feature-Freeze P1). Konsequenz auf einem Nicht-C-Locale-Host: der Validator der
Shell akzeptiert die Geburt jetzt, die Sonde des Servers liefert weiter `null`, und beide Werte
können sich unterscheiden statt nur zu fehlen. Auf dieser Maschine (macOS, launchd-PATH, C-Locale)
ändert sich nichts. Die Zeile gehört in die erste `server.ts`-berührende Runde nach dem Freeze.

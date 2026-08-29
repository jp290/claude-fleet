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

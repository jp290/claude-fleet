---
frage: Gehoert der eine rote Check des Post-Land-Audits von 4846d831 zum gelandeten Diff (P4 Slice 3), oder faellt er auch ohne ihn — und laesst sich das entscheiden, OHNE die Suite ein zweites Mal zu fahren?
urteil: "Nein, er gehoert nicht zum Diff, und ja, es ging ohne Suite-Lauf: der Trail zeigt denselben Check mit BUCHSTABENGLEICHEM detail schon am 2026-08-30, drei Tage vor dem Land — Basisrate 2 von 33 aufbewahrten isolated-Laeufen (6,1 %). Mechanismus benannt: settleForMerge gibt nach 12 s STILL auf, danach antwortet der Idle-Gate statt des Guards unter Test. Verdikt flake, abgelegt."
bereich: [verify, flake, merge-land, ledger]
belege: [e2e/merge.ts#L420, e2e/lane-helpers.ts#L73, isolated-20260902T220305Z-86314, isolated-20260830T113355Z-25461, 4846d8312a72be1a995a2ff01e31770a0fc7b7b4]
nicht-gemessen: ob die 12-s-Schranke unter welcher konkreten Hostlast reisst (kein Lastprofil erhoben); ob weitere Checks derselben Suite dieselbe Vorbedingung teilen und mit ihr fallen; die Reparatur selbst ist VORGESCHLAGEN, nicht gebaut
stand: 2026-09-03
---

# Die erste Flake-Basisrate aus dem Trail — und warum sie 30 Sekunden statt elf Minuten gekostet hat

3. September 2026, Program-MAIN „Dual-Host Fleet — Second-host Session Runtime" (`cd110019`, Slot 5).
Das Land ist **nicht** dieses Programs: `4846d831` ist P4 Slice 3 der Generalsanierung
(`b2a14b545fd31fd71ba7b9e1`). Das Audit-Ereignis kam in diese Pane, die Evidenz war ohne
Suite-Mutex zu haben, also wurde hier hingesehen.

## 1. Der Check, den die Ledger-Zeile nicht nennen konnte

Das Audit meldete `red · exitCode 1 · checks 3508/1`. Die aufbewahrten fuenfzehn Ausgabezeilen
enthielten **ausschliesslich PASS-Zeilen** und danach `1 FAILURES` — der Name des gefallenen Checks
war elidiert. Der Trail hat ihn:

    ⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)

`e2e/merge.ts#L420`. Erwartet `status === "resolved"` und ein `detail`, das `review` enthaelt;
bekommen:

    {"status":"blocked","detail":"the session is actively working right now — let it settle for a moment, then land"}

Das ist nicht der Guard unter Test, der geantwortet hat, sondern der **Idle-Gate**. Die Sonde ist
nie zum Messen gekommen.

## 2. Die Basisrate, gemessen statt geraten

`docs/e2e-trail.md` legt je `check()`-Aufruf eine Zeile ab, ausserhalb des Instanzverzeichnisses,
also ueberlebt sie auch einen gruenen Lauf. Im aufbewahrten Fenster liegen **33 isolated-Laeufe**,
und alle 33 enthalten diesen Check.

| | |
|---|---|
| Laeufe mit diesem Check | 33 |
| davon FAIL | **2 (6,1 %)** |
| verschiedene `detail`-Texte der FAILs | **1** (buchstabengleich) |
| aeltester FAIL | `isolated-20260830T113355Z-25461`, **2026-08-30** |
| juengster FAIL | `isolated-20260902T220305Z-86314` (dieses Audit) |

Der aeltere Lauf ist **drei Tage aelter als das Land** und kann dessen Diff nicht enthalten. Damit
ist die Attribution an `4846d831` widerlegt — nach der Beweisregel des Regelbuchs, die hier ohne
zweiten Lauf greift: *ein gruener Kontrolllauf beweist nichts, ein roter beweist alles.* Der rote
Kontrolllauf lag bereits auf Platte; er musste nur gelesen werden.

## 3. Der Mechanismus, benannt

`settleForMerge` (`e2e/lane-helpers.ts#L73`) haelt die Vorbedingung des Checks:

    export const settleForMerge = async (slot: number): Promise<void> => {
      for (let i = 0; i < 80; i++) {
        ... if (sl && sx.now - sl.lastOutput >= MERGE_IDLE_MS) return;
        await Bun.sleep(150);
      }
    };

Die Schleife laeuft **80 × 150 ms = 12 s** und faellt danach **still durch** — kein `check()`, kein
Rueckgabewert, kein Wort. Bleibt die Pane laenger als 12 s beobachtet-beschaeftigt (Hostlast, und
`./e2e-isolated.sh` ist unter Last messbar nicht-deterministisch), kehrt der Helfer zurueck, als
haette er gesettelt; der folgende `/merge`-POST trifft den Idle-Gate; die Sonde faellt als **das,
was sie messen sollte**, statt als sie selbst.

Das ist buchstaeblich die Defektform, die das Regelbuch benennt: *eine Sonde, die nicht laufen
konnte, muss als SIE SELBST scheitern (eigener `check()` auf ihre Voraussetzung), nie als das, was
sie messen sollte.* Sie steht damit in derselben Familie wie die Send-Boot-Fixtures (§11.2f) und
die `waitForLabel`-Rennstelle (`docs/messungen/acp18-fleet-frame-rot-2026-08-21.md`) — beide
test-seitig repariert, beide vorher als Produktcode-Regress gelesen.

## 4. Vorschlag, nicht gebaut

`settleForMerge` gibt `boolean` zurueck (bzw. setzt einen eigenen `check()`), die Aufrufstellen
lassen einen Lapse als **Vorbedingungs-Fehlschlag** sichtbar werden, und die 12 s werden gegen ein
Lastprofil neu gewaehlt. Das ist Suite-Arbeit und gehoert nicht in dieses Program; die Zeile steht
hier, damit sie nicht mit dem Audit-Ereignis verfaellt.

## 5. Was diese Notiz nebenbei zeigt

`docs/knowledge-currency.md:140` fuehrt *„the flake ranking from (a)"* als **unbebaut** mit dem
Zusatz, der Trail habe die Daten. Hat er: die Rangliste ist ein Einzeiler ueber
`$TMPDIR/fleet-e2e-trail/*.jsonl`, und sie hat hier eine Adjudikation entschieden, die sonst
entweder elf Minuten Suite-Mutex oder ein geratenes Urteil gekostet haette. Die Grenze ist die
Aufbewahrung: 33 Laeufe, nicht die 5421 Zeilen, die `./state.sh` fuer den Haupt-Checkout zaehlt.

## 6. Nachtrag, gleicher Tag: dieselbe Methode auf drei Checks eines REMOTE-Audits

Audit `at=1788462365585`, Baum `6b8b89d9` (Slice 7a der Generalsanierung, `server.ts` +
`server/proc.ts`, reiner Move), gefahren **auf second-host** (`cmd: "remote helper (second-host):
./e2e-isolated.sh"`, `ms` 1 398 441 = 23 min, `remote.clonedSha == mainSha`, also kein
Baum-Zweifel). Rot mit drei FAILs.

**Diesmal standen die Namen schon auf der Ledger-Zeile** — das Feld `fails[]`, das die
Remote-Seite seit `3974883` fuellt. Nur die Pane-Benachrichtigung elidierte sie. Wer bei einem
REMOTEN Rot das Ledger liest statt der Benachrichtigung, spart sich den Trail-Umweg aus §1.

| Check | seen | fail | Rate |
|---|---|---|---|
| `subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees its budget` | 30 | 7 | **23,3 %** |
| `counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is never typed` | 30 | 5 | **16,7 %** |
| `restart keeps the busy pending event with the same id and no invented attempt` | 30 | 8 | **26,7 %** |

Fehlschlaege ab 2026-08-31, ueber viele Baeume, und drei davon am **2026-09-03 vor** dem Land
(`…T014544Z`, `…T085614Z`, `…T092428Z` — der Land liegt bei 15:30Z). Sie treten gebuendelt auf
(`isolated-20260902T135103Z-50990` traegt alle drei). Das ist die Q5/Q6-ops-event-Familie, die
das Regelbuch fuehrt und die der Dual-Host-Handoff §3 schon am Vor-Land-Baum `fda6fda` gemessen
hatte. Verdikt `flake` abgelegt.

**Der Vorbehalt, ausgesprochen statt verschwiegen:** der Diff fasst Prozess-/Ausgabe-Hygiene an,
und ein Check namens „restart keeps the busy pending event" klingt danach, als koenne er davon
abhaengen. Die Basisrate entscheidet das trotzdem — er fiel achtmal, bevor dieser Diff existierte.

## 7. Ein Sensor, der weniger misst, als sein Name sagt

Dieselbe Zeile meldet `checks: {ran: 24, failed: 3}` — waehrend eine ihrer eigenen PASS-Zeilen
`rows=3538 results=3538` ausweist. Grund: `server.ts#postLandAuditChecks` zaehlt `PASS `- und
`FAIL `-Zeilen **im aufbewahrten, elidierten Text**. Bei 3 538 Checks ueberleben ~24 Zeilen die
Elision, also ist `ran` deren Anzahl, nicht die der Laeufe. `failed: 3` stimmt nur, weil es aus
der `3 FAILURES`-Summenzeile rekonziliert wird.

Konsequenz fuer die Regelbuch-Regel „ein Audit-Gruen prueft man an `ms` und an den PASS-Zeilen":
die `ms`-Haelfte traegt (hier 23 min = echter Lauf), die `checks.ran`-Haelfte traegt **nicht** als
Mass fuer „wurde etwas gemessen" — `ran` ist bei jedem grossen Lauf zweistellig, egal wie viel
lief. Nur `ran: 0` bleibt aussagekraeftig, weil dann auch die Elision nichts zu behalten hatte.

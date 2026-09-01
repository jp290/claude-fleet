---
frage: Ist die P0-Baseline der Generalsanierung (drei konsekutive serielle e2e-isolated-Laeufe) auf dem Baum NACH den beiden Flake-Reparaturen geschlossen — und was sagt das rote Remote-Audit desselben Baums?
urteil: Baseline GESCHLOSSEN und staerker als das Kriterium — drei konsekutive serielle Laeufe je ALL PASS, 3375/3375, kein einziger FAIL, also erst recht kein Check zweimal; das rote Second-host-Audit desselben Baums ist als unknowable adjudiziert, weil die Ledger-Zeile die zehn gefallenen Checks strukturell nicht nennen kann
bereich: [verify, hygiene]
belege: [docs/sanierung-2026-09/plan-2026-08-31.md, docs/verify-tiering.md, post-land-audits.jsonl, server.ts#helperResult, server.ts#postLandAuditChecks]
nicht-gemessen: Die zehn FAIL-Namen des Remote-Laufs (aus der Zeile nicht ableitbar, Trail liegt auf dem Helfer); die neun Checks Differenz lokal-vs-remote sind gezaehlt, aber nicht namentlich bestimmt; keine Aussage ueber Laeufe bei stiller Maschine (die drei liefen neben acht lebenden Sessions)
stand: 2026-09-01
---

# P0-Baseline der Generalsanierung: geschlossen (2026-09-01)

Programm `Generalsanierung 2026-09`, offene Frage 1 des Programms („P0-Baseline laeuft noch —
Messnotiz folgt"). Sie stand seit dem 31.08. offen und hat den Plan zweimal aufgehalten: der
Nachtrag des Plans hielt fest „**P0-Baseline ist NICHT abgeschlossen** (`a1615be`): 1/3 gruen",
und der HANDOFF vom 01.09. hielt fest, dass §11.2k in drei konsekutiven Laeufen zweimal fiel.
Diese Notiz misst dieselbe Frage auf dem Baum **nach** beiden Flake-Reparaturen.

## Kriterium (Owner-Entscheid 2026-09-01, Plan §Entscheide 1)

Erfolgsmass 5 gilt auf **Check-Ebene**: ein Lauf zaehlt gruen, wenn jeder FAIL einer in
`docs/verify-tiering.md` registrierten Familie angehoert; die Baseline ist geschlossen, wenn ueber
drei konsekutive Laeufe **kein Check zweimal** faellt. Ein unregistrierter FAIL macht den Lauf rot.

## Der Messaufbau

| | |
|---|---|
| Baum | `3058556` (`docs(verify): §11.2j-Status auf REPARIERT nachgezogen`), `git status --porcelain` leer |
| enthaelt | `b20e7e4` (§11.2j, beide Schnitte) und `05f37f1` (§11.2k) — die zwei Reparaturen, deren Fehlen die vorherige Baseline kippte |
| Kommando | `./e2e-isolated.sh`, dreimal, **seriell** (Treiberskript wartet je auf den Exit; zusaetzlich serialisiert der `e2e-stage.sh`-Mutex) |
| Maschine | nicht stillgelegt — acht lebende Sessions daneben, das ist der REALISTISCHE, nicht der guenstigste Fall |
| Host | dieselbe Maschine wie die Flake-Historie (macOS, tmux 3.6a) |

## Das Ergebnis

| Lauf | Start | Ende | Dauer | loadavg bei Start | Ergebnis | Checks | FAIL |
|---|---|---|---|---|---|---|---|
| 1 | 09:24:18 | 09:49:47 | 25 min 29 s | 1,49 | `rc=0`, **ALL PASS** | 3375 | 0 |
| 2 | 09:49:47 | 10:15:32 | 25 min 45 s | 1,35 | `rc=0`, **ALL PASS** | 3375 | 0 |
| 3 | 10:15:32 | 10:41:10 | 25 min 38 s | 1,73 | `rc=0`, **ALL PASS** | 3375 | 0 |

Gezaehlt wurde je Lauf aus dem Logfile: Zeilen mit `^PASS`/`^FAIL` = 3375, davon `^FAIL` = 0, und
genau eine `ALL PASS`-Zeile. Die drei Laeufe sind damit nicht knapp gruen, sondern **leer an
FAILs** — das Kriterium „kein Check zweimal" ist erfuellt, ohne dass es ueberhaupt greifen musste,
und die zwei reparierten Familien (§11.2j, §11.2k) haben in 10 125 Check-Ausfuehrungen kein
einziges Mal gefeuert.

**Damit ist die offene Frage 1 des Programms zu.** Die Vorbedingung des Plans „bis dahin kein
P4/P5-Start" ist erfuellt; die uebrigen Vorbedingungen des Fensters (auto-③ aus, Fenster-Checkliste)
bleiben davon unberuehrt.

## Der Gegenbefund am selben Baum: ein rotes REMOTE-Audit

Parallel lief der Post-Land-Audit von `b20e7e4` auf dem Linux-Helfer und meldete fuer denselben
Tip `3058556`: **rot, 3366 Checks, „10 FAILURES", exit 1** (`post-land-audits.jsonl`, `at`
1788249040866, `cmd: "remote helper (second-host): ./e2e-isolated.sh"`, 22 min).

Adjudiziert als **`unknowable`**, und der Grund ist eine Konstruktionsgrenze, keine Meinung:

- `server.ts#helperResult` speichert `out` als **Tail-Kappe** (`HELPER_TAIL_CAP`). Die FAIL-Zeilen
  einer 3366-Check-Suite stehen nicht am Ende, also enthaelt die gespeicherte Zeile **keine einzige
  `FAIL`-Zeile** — nur die Summenzeile „10 FAILURES" ueberlebt.
- `server.ts#postLandAuditChecks` verweigert daraufhin **korrekt** die Zahl: die Summenzeile sagt
  10, die gezaehlten `FAIL`-Zeilen sagen 0, das ist eine Nicht-Uebereinstimmung, und die Funktion
  gibt `null` zurueck statt eine Zahl zu erfinden. Deshalb steht `checks: null` an einer Zeile mit
  `result: "red"`.
- Der vollstaendige Trail existiert — 3366 Zeilen, eine je `check()` — aber er liegt **auf dem
  Helfer** (`/var/lib/fleet-helper/work/run-…/tree/e2e-trail/isolated-….jsonl`); `remote.trail`
  speichert davon nur einen Pfad-STRING (≤120 Zeichen).

Ein Remote-Rot ist damit heute nicht adjudizierbar, ohne die Suite 22 min lang lokal nachzufahren.
Als P6-Vorschlag gefiled (Queue-Zeile `d2335500`, thematisch zu `d07646bc`): der Helfer schickt
zusaetzlich zur Tail-Kappe die FAIL-Zeilen bzw. die failenden Check-NAMEN aus seinem Trail
(bounded), und `postLandAuditChecks` darf dann korroborieren statt zu verweigern.

**Was der rote Remote-Lauf NICHT beweist:** einen Defekt am Baum. Derselbe Baum lief hier dreimal
ALL PASS. Der Verdacht bleibt die Locale-Falle (Queue-Zeile `5e79be26`: auf Debian/de_DE liefert
`ps -o lstart=` „Di Sep 1 …", der Validator `e2e-stage.sh#_st_valid_birth` verlangt englische
Namen, `identityProven` bleibt `null`, zehn Checks der Lock-Familie fallen geschlossen) — die
Zahl **10** deckt sich, aber ohne Namen ist das eine Uebereinstimmung, kein Beweis. Der Fix laeuft
als Schnitt 4 der W3-Zeile `e4fe3d88`.

**Ein zaehlbarer Nebenbefund:** lokal 3375 `check()`-Ausfuehrungen, remote 3366 — neun Checks
laufen auf dem Helfer gar nicht erst an. Welche, ist hier nicht bestimmt; die Differenz ist
gezaehlt und gehoert in die Second-host-Baseline nachgetragen, sobald der Trail lesbar ist.

## Was diese Notiz nicht sagt

Sie sagt nichts ueber Laeufe bei **stiller** Maschine — die drei liefen neben acht lebenden
Sessions, was das Ergebnis staerker macht, nicht schwaecher. Sie sagt nichts darueber, ob die
Familien §11.2i (offen) und die uebrigen elf ruhig BLEIBEN; drei Laeufe sind drei Laeufe. Und sie
adjudiziert die zehn Remote-FAILs nicht — sie erklaert, warum das aus der Zeile heraus nicht geht.

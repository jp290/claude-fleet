# P6-Befundregister — Generalsanierung 2026-09

**Warum diese Datei existiert.** Erfolgsmass 6 des Plans verlangt, dass jeder P6-Befund
disponiert wird — „gefixt / begruendet verworfen / als Queue-Zeile uebergeben, nichts still".
Der vorgesehene Weg dafuer ist eine `notiz`-Zeile am Program. Dieser Weg ist **verstopft**:
`POST /api/self/tasks` lehnt mit 409 ab, sobald zehn `pending` advisory-Zeilen mit
`source:"main"` an diesem Program haengen (`server.ts#PROGRAM_MAX_PENDING_ADVISORY`, Default 10,
Ablehnung an der Stelle mit dem Text `program advisory filing cap reached`). Der Deckel ist
richtig konstruiert — er zwingt zur Disposition —, aber solange der Owner nicht disponiert hat,
hat ein Befund **kein Zuhause**, und am 2026-09-02 ist genau deshalb einer im Scratchpad einer
sterbenden Session gelandet. Diese Datei ist das getrackte Zwischenlager, nicht ein zweites
Register: Zeilen, die als Queue-Zeile existieren, stehen hier nur als Verweis auf ihre ID.

Ein Eintrag hier ist **kein** Auftrag. Er wird zur Arbeit erst durch eine Queue-Zeile oder einen
Owner-Entscheid.

---

## B-01 — Der Vorschau-Pfad wirft die Fehlernamen weg (der Audit-Pfad daneben nicht)

*Erfasst 2026-09-02 von der Sanierungs-MAIN Slot 1; hier am Baum `847c17a` nachgeprueft,
korrigiert und um zwei Messungen erweitert. Nicht uebernommen.*

**Die Naht ist eine Asymmetrie zwischen zwei Zeilen, die 130 Zeilen auseinanderliegen.**
Der Helfer-Daemon schickt die Fehlernamen auf BEIDEN Remote-Pfaden: `helper-daemon/daemon.ts`
berechnet sie in `failNamesOf(logPath, trail)` aus der VOLLEN Logdatei (Deckel `FAILS_KEEP = 50`,
daemon.ts:277/284) und legt sie als `fails` in den Report.

  * **Audit-Pfad, `server.ts:13834`** — persistiert sie:
    `...(fails !== undefined ? { fails } : {})`.
  * **Lane-Vorschau-Pfad, `server.ts#reportLaneSuite:13703`** — persistiert sie NICHT. Sie werden
    gelesen (`const fails = helperFailNames(body?.fails)`, :13690) und ausschliesslich als drittes
    Argument von `postLandAuditChecks(tail, exitCode, fails)` benutzt. Gespeichert wird
    `{exitCode, result, reason?, tail, trail?, checks, remote, treeSha, ms}` — die Namen ueberleben
    nur als Zahl in `checks.failed`.

**Was KEIN Befund ist, und das war die erste Fassung dieses Eintrags falsch.** Dass LOKAL
gefahrene Audits keine Namen tragen, ist Absicht und am Typ dokumentiert:
`server.ts:12105` — `fails?: string[];  // remote-only, validated and capped names; absent on
local and historical rows`; der lokale Pfad ruft `postLandAuditChecks(text, exitCode)` ohne
drittes Argument (`server.ts:12904`). Das ist eine Entwurfsgrenze, kein Defekt. Ihre KOSTEN
bleiben trotzdem real und stehen unten als B-02.

**Messung am Ledger `post-land-audits.jsonl` (425 Zeilen, Stand 2026-09-02):**

| Pfad | Zeilen | mit `fails`-Feld | rote Zeilen mit Namen |
| --- | ---: | ---: | ---: |
| lokal | 404 | 0 | 0 von 73 |
| remote | 21 | 3 | 0 von 11 |
| **gesamt** | **425** | **3** | **0 von 84** |

**Und die dritte Messung, die den Fix von `3974883` betrifft:** das `fails`-Feld taucht im Ledger
zum ersten Mal am 2026-09-02 16:02 auf. Seither gibt es drei Remote-Zeilen — `unknown`, `unknown`,
`green`. **Der rote Remote-Pfad mit Namen ist noch NIE gelaufen.** `3974883 fix: carry remote audit
failure names` (2026-09-01 17:54) ist damit fuer genau den Fall, fuer den er geschrieben wurde,
unbewiesen. Das ist keine Anklage gegen den Fix, sondern die fehlende Gegenprobe.

**Kosten.** Ein rotes Remote-Vorschau-Verdikt kann nicht sagen, WELCHE Checks fielen. Die Lane muss
den Lauf lokal wiederholen — also genau die Ersparnis aufgeben, fuer die das Angebot existiert.
Am 2026-09-02 an P4 Slice 3 bezahlt: Remote rot mit 4 Fails bei 3457 Trail-Zeilen, Namen nicht
beschaffbar, derselbe Baum lokal gruen 3466/0. Der Widerspruch blieb ungeklaert und musste als
„nicht als Flake bewiesen" berichtet werden.

**Der groessere Verlust liegt auf der Daemon-Seite.** `tailOf(end, 40)` (daemon.ts:269, aufgerufen
:483) ist ein dummer Letzte-40-Zeilen-Schnitt, nicht signal-first. Fails aus der MITTE eines
3457-Check-Laufs erreichen den Server ueber den Tail nie. `fails` ist die vorhandene Reparatur
dafuer — und sie wird auf dem Vorschau-Pfad fallengelassen.

**Vorgeschlagene Reparatur.** Ein Feld: `fails` auf `j.result` persistieren, so wie `:13834` es
tut. **Gegenprobe gehoert in `e2e/helper-portal.ts`:** ein rot gemeldetes lane-suite-Ergebnis MUSS
seine Fehlernamen fuehren. Ohne diese Sonde ist der Fix nicht bewiesen — und die Messung oben
zeigt, dass genau diese Luecke beim Schwesterfix `3974883` heute offen ist.

**Status:** offen, nicht disponiert. Kein Fix ohne Owner-Freigabe — P6 beginnt laut Plan nach P5,
und der Feature-Freeze steht bis P7.

---

## B-02 — Ein rotes LOKALES Audit nennt seine Fehlernamen nur im Check-Trail, und das weiss niemand

*Gemessen 2026-09-02, unabhaengig bestaetigt vom Fleet Controller Slot 1.*

Aus B-01 folgt betrieblich: fuer 73 rote lokale Audits ist die Ledger-Zeile stumm darueber, WELCHE
Checks fielen. Weder die Zeile noch ihr `out`-Tail tragen es — beide sind auf 4096 B gekappt und
zeigen nur „N FAILURES" plus Elisionsmarker. **Die Namen existieren, aber im Per-Check-Trail**,
und der Weg dorthin ist heute muendliche Ueberlieferung statt Doku:

```
ls -t "${TMPDIR}/fleet-e2e-trail" | head -3
python3 -c "import json;rows=[json.loads(l) for l in open('<trailfile>')];print([r['name'] for r in rows if r.get('ok') is False])"
```

Die richtige Datei ist die, deren Zeilenzahl `checks.ran` der Audit-Zeile entspricht.

**Zweimal belegt, nicht mehr nur behauptet** (Controller Slot 1, 2026-09-02):
`isolated-20260902T161436Z-31724.jsonl` = 3481 Zeilen / 2 fails (deckt Audit `d4bb687a`,
`ran 3481, failed 2`) und `isolated-20260902T135103Z-50990.jsonl` = 3443 / 11 (deckt Audit
`01ccfb30`, `ran 3443, failed 11`).

Das Rezept gilt NUR fuer lokal gefahrene Laeufe — ein Remote-Lauf laesst seinen Trail auf dem
Helfergeraet, und genau dort greift B-01.

**Vorgeschlagene Disposition:** kein Code-Fix noetig, sondern eine Zeile in `docs/e2e-trail.md`
plus ein Verweis aus der Audit-Ansicht. Billigste Variante zuerst pruefen: die Audit-Zeile traegt
`trail` bereits als Feld auf dem Remote-Pfad — ob der lokale Pfad denselben Dateinamen mitschreiben
kann, ist ungeprueft.

---

## Bereits als Queue-Zeile abgelegte P6-Befunde (nur Verweis, Inhalt lebt an der Zeile)

| ID | Kurz |
| --- | --- |
| `8244622e` | remote `failed` traegt, `ran` ist nur eine untere Schranke |
| `76e6aa3b` | Korrektur/Voraussetzung zu `8244622e` |
| `d2e4f219` | `SUITE_OFFER_WAIT_HELD_MS = 800_000` ist falsch dimensioniert (remote p50 1323 s; 3/13 Laeufe unter Budget, alle drei ROT — das Budget selektiert auf rot) |
| `df22cf14` | ein vom Remote-Helfer gemeldeter Audit ... (s. Zeile) |
| `f0c28e8f` | No-Progress-Pfad am Land von `d7b89fd6` |
| `0ac22a00` | Post-Land-Audit hat EIN Budget fuer Warten UND Arbeit |
| `6d2a4d4b` | Land-Gate, gemessen an der Land-Note von `e9c10ee` |
| `af8dd29c` | `server.ts#teardownSlotOccupant` raeumt `reviewCache`, aber nicht `reviewInflight` |
| `e4a001b0` | Claude-Trust-Dialog eines frischen cwd frisst die erste Zustellung |
| `9c7d6e02` | `POST /api/se…` (zweimal identisch reproduziert) |
| `372b3cef` | ein SPENT merge-Watch blockiert die Re-Subscription desselben Ziels |
| `563ec115` | `program-execution` kennt den … (s. Zeile) |

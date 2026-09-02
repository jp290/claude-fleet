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

## B-01 — Der Vorschau-Pfad wirft die Fehlernamen weg

*Erfasst 2026-09-02 von der Sanierungs-MAIN Slot 1; hier am Baum `0ccfe0e` nachgeprueft und
bestaetigt, nicht uebernommen.*

**Mechanismus, verifiziert.** Der Helfer-Daemon schickt die Fehlernamen auf BEIDEN Pfaden:
`helper-daemon/daemon.ts` berechnet sie in `failNamesOf(logPath, trail)` aus der VOLLEN Logdatei
(Deckel `FAILS_KEEP = 50`) und legt sie als `fails` in den Report. Der **Audit**-Pfad
persistiert sie — eine Ledger-Zeile in `post-land-audits.jsonl` traegt `"fails"` als eigenes
Feld. Der **Lane-Vorschau**-Pfad nicht: `server.ts#reportLaneSuite` liest sie zwar
(`const fails = helperFailNames(body?.fails)`), benutzt sie aber ausschliesslich als drittes
Argument von `postLandAuditChecks(tail, exitCode, fails)` und schreibt sie NICHT auf `j.result`.
Gespeichert wird dort `{exitCode, result, reason?, tail, trail?, checks, remote, treeSha, ms}` —
die Namen sind nach dem Aufruf nur noch als Zahl in `checks.failed` vorhanden.

**Kosten.** Ein rotes Remote-Vorschau-Verdikt kann nicht sagen, WELCHE Checks fielen. Die Lane
muss den Lauf lokal wiederholen — also genau die Ersparnis aufgeben, fuer die das Angebot
existiert. Am 2026-09-02 an P4 Slice 3 bezahlt: Remote rot mit 4 Fails bei 3457 Trail-Zeilen,
Namen nicht beschaffbar, lokal derselbe Baum gruen 3466/0. Der Widerspruch blieb ungeklaert und
musste als „nicht als Flake bewiesen" berichtet werden.

**Der groessere Verlust liegt auf der Daemon-Seite.** `tailOf(end, 40)` (daemon.ts:269, aufgerufen
:483) ist ein dummer Letzte-40-Zeilen-Schnitt, nicht signal-first. Fails aus der MITTE eines
3457-Check-Laufs erreichen den Server ueber den Tail nie. `fails` ist die vorhandene Reparatur
dafuer — und sie wird auf dem Vorschau-Pfad fallengelassen.

**Vorgeschlagene Reparatur.** Ein Feld: `fails` auf `j.result` persistieren, so wie der
Audit-Pfad es tut. **Gegenprobe gehoert in `e2e/helper-portal.ts`:** ein rot gemeldetes
lane-suite-Ergebnis MUSS seine Fehlernamen fuehren. Ohne diese Sonde ist der Fix nicht bewiesen.

**Status:** offen, nicht disponiert. Kein Fix ohne Owner-Freigabe — P6 beginnt laut Plan nach P5,
und der Feature-Freeze steht bis P7.

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

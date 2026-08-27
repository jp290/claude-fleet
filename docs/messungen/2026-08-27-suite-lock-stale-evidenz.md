---
frage: Was belegt der Befund „terminaler isolierter Lauf, Suite-Lock danach state=stale (pid 36538, alive=false, heldMs 1175742), gate.reports leer, keine wartende Session" für die D1-/Suite-Sicht?
urteil: Der stale Lock gehört nicht dem terminalen Lauf 49666, sondern einem unidentifizierten Halter, der ihn 16:51:08Z übernahm und vor 17:10:44Z spurlos starb; stale-nach-terminal und reports=[] sind dagegen designtes Ruheverhalten, und Trail-Id-Raum (Runner-Pid) und Lock-Pid-Raum (Wrapper-$$) sind disjunkt, sodass die Sicht diesen Join heute nicht leisten kann
bereich: [suite-mutex, sensorik, verify]
belege: [e2e-stage.sh, server.ts#suiteLockView, server.ts#gateView, e2e/trail-emit.ts#TRAIL_RUN, /tmp/fleet-e2e.lock]
nicht-gemessen: Identität des Halters pid 36538 (tot, keine ps-Zeile, keine Ledger-Zeile, keine server.log-Zeile) und die Ursache der 6 Composer-Rollback-FAILs
stand: 2026-08-27
---

# Suite-Lock stale nach terminalem Lauf — Evidenz-Auswertung

2026-08-27, Lane `fleet/260827164432-4c00`. Owner-Beobachtung: Lauf
`isolated-20260827T161210Z-49666` auf Tree `2d88521` terminal (3136 Checks, 6 FAILURES,
Composer-Rollback-Familie); der Live-Sensor zeigte danach `state=stale, pid=36538, alive=false,
heldMs=1175742` und `gate.reports=[]`; keine andere Session sah das Ende oder hatte eine Suite in
der Queue. Frage: **was davon ist Mechanismus, was Anomalie, was bleibt Inferenz?**

Alle Zeiten UTC (Maschine läuft CEST, +2; `date`-Anker in §Methode). Der Lock war zur Messzeit
dieser Lane (17:14Z) unverändert vorhanden — pid-Datei `36538`, mtime 16:51:08Z, `kill -0` tot,
kein `/bin/sh ./e2e-*`-Prozess auf der Maschine.

## Ergebnis

### 1. „stale nach terminalem Lauf" ist designtes Ruheverhalten, keine Anomalie

`e2e-stage.sh` (Kommentarblock am Lock): **„Release is IMPLICIT: no EXIT trap"** — ein Halter
entfernt seinen Lock nie selbst; „a lock dir existing therefore ≠ held", gereapt wird
ausschließlich vom **nächsten Anwärter**. Ein Lock-Verzeichnis mit toter pid nach einem terminal
gewordenen Lauf ist der normale Endzustand jedes Suite-Laufs auf dieser Maschine, und er bleibt
beliebig lange stehen, wenn niemand ansteht. `server.ts#suiteLockView` misst das pro Request
frisch von der Platte (`kill(pid, 0)`, kein Cache) und nennt es korrekt `stale`: „the holder is
gone; the next contender reaps this dir." **Teil 1 der Beobachtung belegt also das Design, nicht
einen Defekt** — und „keine wartende Session" ist keine dritte Merkwürdigkeit, sondern die
Erklärung, warum stale persistiert: kein Anwärter ⇒ kein Reap.

### 2. `gate.reports=[]` ist konsistent, kein verlorener Bericht

`server.ts#gateView` speist `reports` aus `verifyIntents` (Lane-deklarierte Absichten; terminale
werden beim Lesen gepruned) und Server-Läufen. Ein von Hand bzw. außerhalb des Intent-Wegs
gestarteter isolierter Lauf registriert nie einen Intent — leere `reports` nach seinem Ende sind
der erwartete Wert, nicht der Verlust eines Berichts.

### 3. Die echte Anomalie: der stale Lock gehört NICHT dem terminalen Lauf (gemessen)

Drei Zeitanker, alle von der Platte bzw. aus dem Trail-Schema:

| Anker | Wert | Quelle |
| --- | --- | --- |
| Runner-Boot des Laufs 49666 | 16:12:10Z | Trail-Stempel im Run-Namen (`e2e/trail-emit.ts#TRAIL_RUN`, gebaut beim Runner-Start) |
| Lock-Erwerb des stale Halters | 16:51:08Z | mtime von `/tmp/fleet-e2e.lock/pid` (einmal geschrieben, beim Erwerb) |
| Owner-Sensorlesung | ≈ 17:10:43Z | 16:51:08Z + heldMs 1 175 742 ms |

`e2e-isolated.sh` nimmt den Lock in Zeile 57 (`. e2e-stage.sh`) und bootet den Runner erst in
Zeile 734 — der Wrapper des Laufs 49666 hielt den Lock also **vor** 16:12:10Z. Ein pid-Eintrag
von 16:51:08Z, 39 Minuten nach Runner-Boot, kann nicht von diesem Wrapper stammen: um 16:51
musste 49666s Wrapper bereits tot sein (sonst hätte der Reap ihn nicht überschrieben — der Reap
prüft die pid auf Leben). **Gemessene Kette:** Lauf 49666 lief ≈ 16:12–16:4xZ und wurde terminal;
sein Lock blieb designgemäß mit toter pid stehen; um 16:51:08Z reapte ein neuer Anwärter
(pid 36538), erwarb — **und starb selbst vor 17:10:44Z**, ohne Ledger-Zeile
(`post-land-audits.jsonl`: letzte Zeile 14:32Z, exit 42), ohne server.log-Zeile danach, ohne
`ps`-Spur zur Messzeit. Wer 36538 war — ein weiterer Audit-Anlauf, eine Lane-Vorschau, ein
Hand-Start — **bleibt Inferenz bis zur Sensorprüfung**, genau wie vom Owner gerahmt. Fest steht
nur: zwischen 16:51 und 17:10Z hat auf dieser Maschine ein Suite-Prozess den Mutex übernommen und
ihn nicht überlebt, und keine Fleet-Fläche hat davon eine Zeile.

Randbefund derselben Lesung: die beiden claude-fleet-Audits des Tages (main@6ee13a3d,
main@2d88521f) stehen im Ledger als `unknown, audit timed out after 1800000ms` (Start 12:48:50Z,
Decke 13:18:52Z) — der Audit-Rückstand des Tages ist real, liegt aber Stunden vor dem Lock-Fenster
und ist nicht der stale Halter.

### 4. Was das für die D1-/Suite-Sicht heißt

D1 (`docs/schwarm-programm-2026-08-27.md` §D1) ist ein Sensor für „Budget wächst, Fortschritt
nicht" — Sensor ja, Handlung nein. Diese Beobachtung ist Evidenz für die Suite-Seite derselben
Lücke, in zwei Sätzen:

- **Die Sicht kann „ruhender Lock nach terminalem Lauf" nicht von „Halter mitten im Lauf
  gestorben" unterscheiden.** Beide rendern als `stale` mit wachsendem heldMs; heldMs misst seit
  pid-mtime und wächst nach dem Tod unbegrenzt weiter — die 19,6 min des Owners waren nicht
  Arbeitszeit, sondern Erwerb-bis-Lesung.
- **Der Join Sensor↔Lauf ist strukturell unmöglich:** der Trail-Run-Name trägt die pid des
  bun-Runners (`process.pid`, `e2e/trail-emit.ts:88`), die Lock-pid ist das `$$` des
  Wrapper-Shells (`e2e-stage.sh`). Zwei disjunkte Id-Räume, kein gemeinsames Feld — 49666 vs
  36538 in der Owner-Beobachtung sah nach Widerspruch aus und ist strukturell erwartbar; dass es
  HIER trotzdem zwei verschiedene Läufe waren, war nur über mtime-Arithmetik zu zeigen.

Sensorkandidaten daraus (VORSCHLAG, ungebaut, gehört neben D1 in die Schwarm-Rangliste, nicht
über die Owner-Vorgabe hinaus verfolgt): (a) der Wrapper schreibt neben `pid` auch den
Trail-Run-Namen in die Lock-Dir, `suiteLockView` reicht ihn durch — der Join wird ein Feld statt
Arithmetik; (b) die Sicht nennt den Erwerbszeitpunkt (pid-mtime) explizit, statt ihn in heldMs zu
verrechnen. Beides Sensorik; nichts davon gated oder handelt.

## Methode

```
grep -n "lock" e2e-stage.sh                        # Implicit-Release-Vertrag, Reap-Schleife
sed -n '14343,14400p' server.ts                    # suiteLockView: per-Request, kill(0), stale-Def.
grep -n 'e2e-stage.sh\|fleet-e2e.ts' e2e-isolated.sh   # Lock Z.57 vor Runner Z.734
grep -n 'TRAIL_RUN' e2e/trail-emit.ts              # Run-Name = Suite-Stamp-process.pid (Runner)
date; date -u                                      # CEST-Anker (+2)
ls -la /tmp/fleet-e2e.lock/; cat …/pid; kill -0 36538   # 36538, mtime 16:51:08Z, tot (17:14Z)
ps -eo command | grep -c '^/bin/sh ./e2e-'         # 0 laufende Suiten zur Messzeit
tail post-land-audits.jsonl (Haupt-Checkout, bun/python gelesen, nicht rg)   # letzte Zeile 14:32Z
grep 'audit' /Users/owner/claude-fleet/server.log | tail    # Timeout-Zeilen 6ee13a3d/2d88521f
```

## Was nicht gemessen wurde

Die Identität von pid 36538 (tot; kein ps-Register auf dieser Maschine, das rückwirkend auflöst)
— die Ursachen-Aussage bleibt Inferenz, bis die vorgeschlagene Sensorprüfung (Trail-Name im Lock)
existiert oder ein Log des Halters auftaucht. Die 6 Composer-Rollback-FAILs des Laufs 49666: nicht
adjudiziert, gehören dem Lauf-Besitzer (Beweisordnung: derselbe Baum erneut, seriell). Ob der
Owner-Sensorwert und meine Platte dasselbe Lock-Exemplar sahen, ist über pid+mtime praktisch
sicher, formal aber zwei Lesungen.

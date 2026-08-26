# HANDOFF — Lane B: Lane-Suiten im Remote-Helper-Portal (S1–S9)

Geschrieben 2026-08-26 auf Owner-Anweisung bei ~50 % Kontext. Eine frische Session uebernimmt
DIESEN Worktree (`fleet/260826185915-512e`). Diese Datei ist der vollstaendige Transfer — der
Scratchpad der Vorgaengerin stirbt mit ihr, also steht hier alles drin, was nicht im Repo liegt.

**Behandle jede Zahl hier als BEHAUPTUNG, nicht als Fakt** (Regelbuch: HANDOFF ist ein Claim).
Die Commits und ihre Bodies sind die belastbare Quelle: `git log acd79bb^..HEAD` mit Bodies.

---

## 1. Auftrag und autoritativer Plan

Auftrag: S1–S9 aus `docs/helper-lane-suiten-entwurf-2026-08-26.md` (auf main, 585 Z., Commit
`898bd53`) implementieren; Sonden in eine NEUE Datei `e2e/lane-suite.ts` im HAUPT-Runner; je Sonde
den BREAKER vorfuehren (Mutation rein, Sonde faellt, Mutation raus) und im Report zitieren.

Done-Kriterium des Auftrags, woertlich:
> alle S1-S9 umgesetzt, e2e/lane-suite.ts-Sonden gruen mit je vorgefuehrtem Breaker, volle
> Verify-Kette gruen UND ./e2e-isolated.sh Tail ALL PASS ... UND ./e2e-postland-audit.sh gruen.

---

## 2. Stand: S1–S9 sind UMGESETZT. Vier Commits.

| SHA | Was |
| --- | --- |
| `acd79bb` | S1–S6: `LaneSuiteJob` + zweite Quelle in `helperJobsView` + `kind` · `POST/GET /api/self/suite-offer` + `/withdraw` (lane-only) · `buildLaneSuiteBundle` aus `git stash create` ueber transientes Ref · `helperClaim` ueber beide Quellen · `helperResult` verzweigt (Lane-Ergebnis NIE ins Audit-Ledger) · Rueckweg mit `remote{}` + `treeSha`. Neue Sonden-Familie `e2e/lane-suite.ts`, im Runner nach `selfToken.run(ctx)` eingehaengt. |
| `fb855be` | S7–S9: zwei `/api/self/suite-offer`-Eintraege in `e2e/security.ts#PRE_AUTH_ROUTES` (Helfer-Perimeter UNVERAENDERT — das war das Ziel) · `src/helper.ts` `bootstrapText` mit `git clone -b`, Karte/Knopf/Unterzeile fuer beide Job-Arten · `public/helper.html` Titel/h1/statische Unterzeile · drei neue Pins in `e2e/pins.ts` · `SUITE_OFFER_WAIT_FREE_MS`/`_HELD_MS` in `server.ts` · `reapLaneSuiteOffersFor` am Slot-Teardown. |
| `7f91a90` | `docs/self-api.md` §suite-offer — Feldformen, alle Ablehnungen, curl-Formen, die zwei Wartezahlen. |
| `bae56ae` | Sonden-Haertung: `remote`/`treeSha` im Sonden-Typ OPTIONAL + durchgaengiges `?.`, damit der S6-Breaker als drei benannte Checks faellt statt als TypeError-Absturz. |

Working tree beim Schreiben dieser Datei: sauber, keine untracked Files (ausser dieser Datei, die
mit ihrem eigenen Commit landet).

### Zwei Abweichungen vom Plan, beide bewusst und begruendet

1. **`public/helper.html` wurde DOCH geaendert.** Der Entwurf leitete ABGELEITET ab, die Seite baue
   jeden Knoten in `helper.ts`. Ein `grep` zeigt das Gegenteil: Zeile 53 traegt eine STATISCHE
   Unterzeile (`id="sub"`), die ein Betrachter liest, bis der erste Poll antwortet — und die trug
   genau den audits-only-Satz, der §0 des Entwurfs als Befund benennt. Code schlaegt Prosa.
   Mitgeaendert: Titel und h1 heissen jetzt „Fleet helper" (die `(K)`-Assertion in
   `e2e/helper-portal.ts` wurde mitgezogen).
2. **`reapLaneSuiteOffersFor` am Slot-Teardown** (nicht im Plan). Der 15-s-Sweep raeumte ohnehin
   auf und der Claim-Pfad prueft die Lebendigkeit nach — korrekt war es schon; was fehlte, war
   dass die Portal-Seite bis zu einem Sweep lang einen Job fuer eine tote Lane zeigte. Macht die
   Sonde „an offer whose LANE IS GONE" ausserdem deterministisch statt zu einem Rennen mit dem Sweep.

### Ein Befund aus dem ersten Sonden-Lauf, repariert

Der Reaper markierte ein Angebot, dessen Lane GETOETET wurde, als `withdrawn` — der Helfer las
daraufhin „die Lane faehrt die Suite selbst" ueber eine Lane, die es nicht mehr gab. Eigener
Zustand `reaped` mit eigenem Satz. (Enthalten in `acd79bb`.)

---

## 3. Verify-Stand

**GRUEN, alle rc 0:**

```
bun install --frozen-lockfile   ok
bun e2e/pins.ts                 ALL PASS
bunx tsc (12 Dateien, strict)   sauber
bun run build                   ok
./e2e-clean-review.sh           ALL PASS
./e2e-security.sh               ALL PASS
./e2e-claude-gate.sh            ALL PASS  (alle drei Phasen)
./e2e-postland-audit.sh         ALL PASS
```

`./e2e-postland-audit.sh` enthaelt die zwei Audit-seitigen Gegenproben, die diese Lane dort
ergaenzt hat, beide gruen:

```
PASS  (K) an audit job is labelled kind:'audit' — the field that keeps two sources on one list  ({"kind":"audit","covers":1})
PASS  (K) …and the audit report added EXACTLY ONE ledger row (the control for the preview's zero)  (1 new row(s) for this repo)
```

**`./e2e-isolated.sh`: 3125 PASS / 2 FAIL (rc 1).** Alle 34 neuen `(LS)`-Checks GRUEN (0 FAIL).
Die zwei Fehlschlaege, woertlich mit Signatur:

```
FAIL  ⏸ a re-run is refused while the resolution is still rebased onto main (guard unchanged)
      ({"status":"blocked","detail":"the session is actively working right now — let it settle for a moment, then land"})

FAIL  owner-token ambient use fixture: the BEARER merge LANDED — main moved off the tip this probe recorded
      ({"ready":true,"before":"825c8716","after":"825c8716","branch":"fleet/260826194439-cd3b",
        "drive":["no job ran — the merge was refused and left no verdict"]})
```

**Die gemeinsame Signatur:** beide sind ein Merge-POST, den der PANE-IDLE-GATE abgelehnt hat
(`MERGE_IDLE_MS`) — nicht der Guard, den der jeweilige Check misst. Beim zweiten haben alle acht
`driveMerge`-Versuche so geendet („no job ran — the merge was refused").

**Was das NICHT beweist.** Der erste Fail liegt in `e2e/merge.ts`, und `merge.run(lc)` laeuft im
Runner VOR `laneSuite.run()` — Ausfuehrungsreihenfolge schliesst einen Einfluss dieser Lane dort
aus. Der zweite liegt in `e2e/programs.ts`, das direkt NACH dem neuen Modul laeuft; dort ist ein
Timing-Einfluss durch die Slot-/Pane-Churn des neuen Moduls nicht ausgeschlossen. Beide gehoeren
zu bekannten Flake-Familien (`docs/verify-tiering.md` §11.2e/§11.2c fuer den Idle-Gate,
§11.2h fuer die owner-token-ambient-Gruppe) — **aber §11.2h gilt seit `70698a7` als repariert, ein
Rot dort ist also laut Regelbuch wieder ECHT, bis das Gegenteil bewiesen ist.** Die Maschine war
waehrend des Laufs stark belegt (mehrere Suiten in der Schlange, ein fremder `e2e-claude-gate.sh`
wartete).

**Deshalb ist der Fail bis zum Gegenbeweis DIESER LANE ihrer.** Der Gegenbeweis ist der Re-Run.

Aufbewahrte Instanz des roten Laufs (fuer Post-Mortem, falls noch da):
`/var/folders/sj/sdtvtv7x4j1bxq8ghdpgtr3h0000gn/T//fleet-e2e-instance-21123`

---

## 4. Re-Run: Status, Pfade, und ob er den Session-Tod ueberlebt

Beweisordnung nach Regelbuch: **ZUERST denselben Baum erneut laufen lassen.** Laeuft er gruen, ist
die Nicht-Determiniertheit direkt bewiesen und die Sache erledigt. Der frische HEAD-Worktree ist
nur der Fallback fuer einen Baum, der identisch weiter faellt.

Ein solcher Re-Run wurde gestartet, auf **demselben Commit `bae56ae`, Baum unveraendert**.

**Log-Pfade (Scratchpad der Vorgaengerin — er stirbt mit ihr, die Dateien aber nicht sofort):**

```
/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260826185915-512e/33b53b82-513f-4264-bdf7-1d33c20cf57f/scratchpad/logs/
  rerun-chain.log      <- traegt am Ende `rerun=<exit>` und `RERUN-DONE`
  isolated-rerun.log   <- der Lauf selbst; Urteil ist der TAIL ("ALL PASS" / "N FAILURES")
  isolated.log         <- der ERSTE, rote Lauf (die zwei FAILs oben)
  chain.log pins.log tsc.log build.log clean-review.log security.log claude-gate.log postland.log
```

**Ueberlebt der Watcher-Prozess den Session-Tod? — Gemessen, nicht geraten.**

```
ps -eo pid,ppid,command:
  76895     1  sh .../scratchpad/rerun.sh ...
  88696 76895  /bin/sh ./e2e-isolated.sh
```

`rerun.sh` hat **ppid 1** — es ist bereits an init reparentiert und mit `nohup` gestartet, also
KEIN Kind der sterbenden Session mehr. Es sollte weiterlaufen. **Trotzdem nicht darauf verlassen:**

- Falls `rerun-chain.log` eine Zeile `rerun=0` traegt und `isolated-rerun.log` mit `ALL PASS`
  endet → Flake bewiesen, Punkt 5.1 ist erledigt.
- Falls `rerun=1` → die FAILs im Tail lesen. Sind es dieselben zwei mit derselben Signatur, ist der
  Baum reproduzierbar rot und der naechste Schritt ist der frische HEAD-Worktree (Fallback).
  Sind es ANDERE, ist das eine dritte Messung und die Suite ist unter Last nicht-deterministisch.
- Falls die Datei fehlt, leer ist, oder kein `rerun=` erscheint und **kein** `./e2e-isolated.sh`
  mehr laeuft (`ps -eo command | grep -c '^/bin/sh ./e2e-'`) → **Re-Run von Hand neu starten**:
  `./e2e-isolated.sh > <eigene-logdatei> 2>&1` und nur den Tail lesen.

**Wichtige Nebenbedingung:** waehrend des Re-Runs stand ein ZWEITER `./e2e-isolated.sh` auf der
Maschine (fremder Post-Land-Audit, pid 94099). Der Suite-Mutex serialisiert die beiden, einer
wartete also nur — aber wer das pruefen will, liest die `[suite-lock] … acquired after Ns`-Zeile
am Kopf von `isolated-rerun.log`. Zwei GLEICHZEITIG laufende Instanzen wuerden beide Ergebnisse
wertlos machen; dann neu und seriell fahren.

**Prozesse dieser Lane nur ueber ihre notierte PID beenden** (`kill 76895` bzw. `kill 88696`),
NIE ueber ein Namensmuster: auf dieser Maschine laeuft der Post-Land-Audit des Servers unter
demselben Namen.

---

## 5. Was noch offen ist, in Reihenfolge

### 5.1 (BLOCKIEREND fuer „complete") Den Re-Run auswerten
Siehe §4. Erst danach ist eine ehrliche Aussage ueber `./e2e-isolated.sh` moeglich. Bis dahin gilt:
volle Kette gruen AUSSER `isolated`, dort 3125/2 mit der oben zitierten Signatur.

### 5.2 Den Lane-Report absetzen
Diese Lane hat ihren typisierten Fleet-Report NOCH NICHT gesendet (die Vorgaengerin wurde vorher
zur Uebergabe angewiesen). Der Nachfolgerin obliegt er:

```
curl -s -X POST http://100.64.0.1:8790/api/self/fleet-report \
  -H "x-fleet-self-token: $FLEET_SELF_TOKEN" -H 'content-type: application/json' \
  -d '{"status":"<complete|needs-main|failed>","text":"<summary + quoted verification result>"}'
```

`complete` nur, wenn 5.1 den Flake beweist. Sonst `needs-main` mit der Signatur im Text.

### 5.3 Drift pruefen vor dem Done-Report
Zuletzt gemessen (vor den letzten Commits):
`{"behind":1,"wouldConflict":false,"dirty":false,"stale":false}` — kein Konflikt, kein Rebase noetig.
**Neu messen**, main bewegt sich:
`curl -s -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://100.64.0.1:8790/api/self/drift`
Bei `wouldConflict:true` erst selbst auf main rebasen und verifizieren.

### 5.4 Das Regelbuch-Fragment (S9) — OWNER-AKT, nicht Lane-Akt
Volltext in §6 unten. Die Lane hat es bewusst NICHT selbst in
`/Users/owner/claude-fleet/rulebook/lane-discipline.md` geschrieben: `rulebook/` liegt
gitignored im Haupt-Checkout, eine Lane sieht die Aenderung nie in `git status` und kann eine
Regel ohnehin nur VORSCHLAGEN. Der Pin dazu ist gebaut und steht auf **SKIP**, solange die Regel
nicht im Fragment steht (`the suite-offer rule is not in the rulebook yet — proposed, not
promoted`). Sobald das Fragment die Zahlen `180 s` und `800 s` und den String
`/api/self/suite-offer` traegt, wird der Pin HART und faellt bei Drift.
Nach dem Einfuegen: CLAUDE.md neu rendern mit dem Einzeiler im Kopfkommentar von `rulebook.ts`.

### 5.5 Nicht gebaut, ausdruecklich (die Linie aus §7 des Entwurfs)
Kein zweiter Job-Typ im Portal · keine zweite Queue · kein zweites Ledger · kein zweiter Transport ·
kein Gate (ein rotes Remote-Verdikt blockiert keinen Land) · kein Auto-Dispatch · **kein
`kind:"suite"`-Watch** (§4.2: erst messen, ob eine Lane ueberhaupt schlafen will) · **kein
Trail-Upload** (§6: das waere der eine Fakt, der ein Remote-Verdikt falsifizierbar machte —
Stufe 2, braucht Upload-Pfad, Groessenbegrenzung, Aufbewahrungsregel).

### 5.6 Eine Falle aus §1.3 des Entwurfs, unveraendert offen
`watchdog.sh:91` fuehrt `src/helper.ts` in der tsc-Liste, der LAUFENDE Server tut es nicht (der
srv-Pane backt `FLEET_VERIFY_CMD` beim Spawn ein). Bis zu einem
`launchctl kickstart -k gui/$(id -u)/com.claude-fleet.watchdog` deckt der Live-Land-Gate genau die
Datei nicht ab, die diese Lane am meisten angefasst hat. Ein blosser srv-Restart genuegt NICHT.
Diese Lane hat `bunx tsc` von Hand ueber `src/helper.ts` gefahren (sauber) — wer nach ihr dort
etwas aendert, muss dasselbe tun, sonst ist „Gate gruen" hier ohne Aussage.

---

## 6. S9 — VOLLTEXT des Regelbuch-Vorschlags

Einzufuegen in `/Users/owner/claude-fleet/rulebook/lane-discipline.md`, direkt NACH dem Absatz
„**`./e2e-isolated.sh` ist Tier-2-Vorschau, kein Gate**…" und VOR „Keep the lane landable".
Danach CLAUDE.md neu rendern.

```markdown
- **Musst du die Vorschau fahren, biete sie zuerst dem Helfer-Portal an** (2026-08-26): einmal
  `curl -s -X POST -H "x-fleet-self-token: $FLEET_SELF_TOKEN" http://100.64.0.1:8790/api/self/suite-offer`
  — lane-only, Body leer (Repo, Branch und Baum kommen aus deiner eigenen Zeile; kein Feld
  nominiert, WELCHER Baum gebuendelt wird). Der Server nimmt deinen ARBEITSBAUM ueber
  `git stash create` auf, nicht HEAD: uncommittete Arbeit reist mit, untracked Dateien NICHT —
  ihre Zahl steht im Job, damit ein gruenes Verdikt nicht ueber einen anderen Baum spricht.
  Solange dein Angebot `open` oder `claimed` ist, faehrst du NICHT lokal: die 200 auf
  `POST /api/self/suite-offer/withdraw` IST die Erlaubnis, und sie ist **409, solange ein Geraet
  laeuft** — `{"abandon":true}` gibt den Lauf bewusst auf, wenn der Helfer stumm bleibt.
  Wie lange du wartest, entscheidet `suiteLock` aus `GET /api/self/suite-offer`: **frei oder stale
  → 180 s**, dann withdraw + lokal (auf einen p50-Lauf von 800 s sind das 22,5 % Aufschlag, dafuer
  ~18 Auffrischungen der Portal-Seite, die alle 10 s pollt); **held → weiterwarten, solange
  gehalten, gedeckelt bei 800 s** (laenger warten als der Lauf selbst dauert ist nie richtig);
  **parked → bis zum Deckel warten, dann MELDEN statt lokal fahren** (dort startet ein lokaler Lauf
  nie). Drei Ausgaenge, kein vierter: ein Verdikt, ein lokaler Lauf, oder ein Bericht.
  **Der Satz, den ein Remote-Gruen erlaubt**, woertlich: „Vorschau gruen — REMOTE auf
  <Geraetename>, exit 0 vom Helfer GEMELDET (nicht von dieser Maschine gemessen), Baum
  <tree-sha8>, unveraendert seit der Uebergabe, trail <id>." Nie „`./e2e-isolated.sh` gruen" ohne
  Zusatz: der Exit-Code wird von Hand eingetippt (`src/helper.ts#doReport` prueft nur `/^-?\d+$/`).
  Ob dein Baum sich seit der Uebergabe bewegt hat, beantwortet der `treeSha` im Verdikt gegen
  `git rev-parse "$(git stash create)^{tree}"` — inhaltsadressiert, der Commit-Sha wandert.
  Die Zahlen 180 s / 800 s haengen an `SUITE_OFFER_WAIT_FREE_MS` / `SUITE_OFFER_WAIT_HELD_MS` in
  `server.ts`; `e2e/pins.ts` haelt beide Seiten zusammen und faellt, wenn eine wandert.
  Feldformen, alle Ablehnungen und die curl-Formen: `docs/self-api.md` §suite-offer.
```

---

## 7. Die neun vorgefuehrten Breaker (fuer den Report zitierbar)

Jeder: Mutation rein → Sonde faellt mit dem zitierten Detail → Mutation raus → wieder gruen.
S1–S3 und S8/S9 gegen den Arbeitsbaum, S4–S6 gegen eine KOPIE des Baums im Scratchpad (damit der
Arbeitsbaum waehrend der laufenden Suiten-Kette nie mutiert war).

| Schnitt | Mutation | Was rot wurde |
| --- | --- | --- |
| S1 | zweite Schleife in `helperJobsView` auf die alte Einzelschleife zurueck | 3 FAILs, u.a. „THE OFFER IS IN THE PORTAL'S JOB LIST, marked kind:'lane-suite'" |
| S2 | `if (!s.worktree) … 409` an der Angebots-Tuer entfernt | „a PLAIN session's credential is refused 409 'not a lane'" (500 statt 409) |
| S3 | Bundle aus `HEAD` statt aus dem Stash-Commit | „THE UNCOMMITTED WORK TRAVELLED" mit `file="suiteoffer work\n"` — der Klon ist sauber, die Suite liefe, sie pruefte nur den falschen Baum |
| S4 | Withdraw-/Abandon-Ablehnung aus `claimLaneSuite` entfernt | „A WITHDRAWN OFFER CANNOT BE CLAIMED — 404" (409 „the offer changed while the bundle was being built") |
| S5 | Lane-Suite-Zweig zusaetzlich durch `appendEvent(POSTLAND_AUDIT_FILE, …)` | „THE AUDIT LEDGER DID NOT MOVE" (`before=0 after=1`) |
| S6 | `remote{}` + `treeSha` aus `laneSuiteView` gestrichen | 3 FAILs: verdict-Rueckweg, „…MARKED REMOTE", Tree-Sha |
| S8a | das `-b` aus dem Bootstrap gestrichen | „the portal's preview bootstrap clones with -b" (`laneArm=false`) |
| S8b | Leer-Karte zurueck auf „no audit is waiting" | „…name BOTH job sources, not audits alone" |
| S8c | statische Unterzeile in `public/helper.html` zurueck auf audits-only | „…including the static fallback subline" — mit dem alten Satz woertlich im Detail |
| S9 | in einer gestagten Kopie mit Fixtur-Fragment: `180 s` → `120 s`, Code unveraendert | „the suite-offer waiting numbers are the same…" (`free=false held=true`). Baseline derselben Kopie: 2 Fixtur-Fehlschlaege; nach der Mutation 3 — genau einer ist der gemessene. |

S7 hat keinen eigenen neuen Breaker: seine Sonde IST die bestehende Perimeter-Gleichheit
(`e2e/security.ts` §1), und der Beweis ist, dass `HELPER_ROUTES` sich NICHT bewegt hat.

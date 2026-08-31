---
frage: Welche Befunde der GLM-Gegenpruefung (P0b) des Sanierungs-Programmplans sind bestaetigt, welche zu korrigieren, und was aendert sich am Plan, bevor P1 startet?
urteil: 10 von 10 Befunden tragen; B1/B2/B5/B7 habe ich selbst nachgemessen und dabei zwei praezisiert (B2 enger als behauptet, B5 mit einer sicherheitsrelevanten Zusatzmessung), B3/B4/B8/B9/B10 nehme ich auf Basis der zitierten Belege an, ohne sie selbst zu reproduzieren. Drei Befunde kommen hinzu, die eine Lane strukturell nicht machen kann (A1 Sensor-Verfaelschung, A2 rulebook-Zahl, A3 Live-Zustand). Kein Befund kippt die Phasenordnung; P1 bleibt nach der Planreparatur startbar.
bereich: [sanierung-plan, verify-gate, pins, w1-archiv, messbasis, state-sensor]
belege: [verify-proportion.ts#ruleFor, task-metadata.ts#processesForPath, server.ts:11459, server.ts:11838, state.sh:203, docs/messungen/2026-09-01-sanierung-plan-glm-review.md, ps-eww pid 50010 vs 29535]
nicht-gemessen: B3 (12 tote Doc-Pfade), B4 (8 Wrapper), B8, B9, B10 — auf Basis der Lane-Belege angenommen, nicht reproduziert; Import-Zyklen; P3-Build-SHA-Determinismus; ~100 Archiv-Kandidaten; docs/README.md-Abschnittsgrenze (Lane sagt 16 kuratierte, ich zaehle 24 Aufzaehlungspunkte gesamt — nicht dieselbe Menge, nicht aufgeloest).
stand: 2026-08-31
---

# P0b — Adjudikation der GLM-Gegenpruefung

Pruefling: `docs/messungen/2026-09-01-sanierung-plan-glm-review.md` (Lane
`fleet/260831185004-71f9`, harness pi-zai, Commit `2cd464b`). Gelesen wurde der Diff, nicht der
Report ueber ihn. Adjudiziert im Haupt-Checkout auf HEAD `6f173d7`.

## 1. Nachgemessen und BESTAETIGT

**B1 (704 nicht reproduzierbar) — bestaetigt und geschaerft.** Eigene Messung im Haupt-Checkout,
wo `rulebook/` anders als in der Lane existiert:

| Kommando | Wert |
|---|---|
| `grep -rEoh 'server\.ts:[0-9]+' docs/ rulebook/ \| wc -l` (das Plan-Kommando) | **1941** |
| dasselbe, nur `docs/` | 1937 |
| `grep -Eoh 'server\.ts:[0-9]+' docs/*.md \| wc -l` (nicht-rekursiv) | **700** |
| nur `rulebook/` | 4 |

Die Planzahl 704 stammt also aus einem nicht-rekursiven Lauf, das notierte Kommando traegt `-r`.
Der Plan nennt eine Zahl, die sein eigenes Kommando nicht liefert — genau die Bauart, die die
Messbasis-Ueberschrift ("neu messen, nicht glauben") verhindern soll.

**B2 (attic/ faellt zwischen W1 und P2 auf DEFAULT_RULE) — bestaetigt, aber ENGER als behauptet.**
`ruleFor` (verify-proportion.ts) gibt DOC_RULE nur an `docs/`, `briefs/`, `drops/`, Root-`.md` und
`.gitignore`; `attic/` faellt auf DEFAULT_RULE (volle Kette, `isolatedPreview:"self-assess"`).
Die Reihenfolge-Korrektur (die zwei Praefix-Zeilen in W1 statt P2) ist richtig.
**Korrektur am Befund:** die Lane schreibt, `processesForPath` gebe fuer attic/-Pfade `null`.
Das gilt nicht pauschal — `path.endsWith(".md")` liefert `["docs"]`, also behalten `attic/*.md`
ihren Cluster. `null` trifft nur die NICHT-`.md`-Dateien, die W1 verschiebt: `worker-deepseek.py`,
`atlas.sh`, `steward-arena.sh`, `find-conv.py`. Das verkleinert den Befund, hebt ihn nicht auf.

**B5 (auto-③-Klausel gegenteilig lesbar) — bestaetigt, mit einer Zusatzmessung, die der Plan
BRAUCHT.** `server.ts:11459` traegt `FLEET_AUTO_REVIEW_MS ?? 15_000` mit dem Kommentar
"0 disables the tick" — der Schalter existiert, er ist nur kein Live-Schalter (nicht in der
Spawn-Zeile, wirkt erst nach `launchctl kickstart -k`). Die Umformulierung der Lane ist korrekt.
**Wichtiger ist, was daneben steht:** `server.ts:11838-11839` sagt woertlich, der AUSGEHENDE
Kanal beider Completion-Fakten (Watch-Zustellung) laeuft auf der AUTOS-Kadenz und
"`FLEET_AUTO_REVIEW_MS=0` does not disable it". Damit ist belegt, was die Fenster-Checkliste
bisher nur hoffte: **auto-③ auf 0 zu stellen toetet den Steuerkanal des Program-MAIN nicht.**
Ohne diesen Satz wuerde eine vorsichtige Session den gefaehrlichsten Spawner im Fenster
anlassen, um ihre eigenen Benachrichtigungen nicht zu verlieren.

**B7 (Kleinabweichungen) — zwei von drei bestaetigt.** `git log --since=2026-07-01 --oneline --
server.ts | wc -l` = **393** (Plan: 392); `grep -c 'pin(' e2e/pins.ts` = **329** (Plan: ~324).
Die dritte Zahl (19 vs 16 indizierte Docs) habe ich NICHT aufgeloest: ich zaehle 24
Aufzaehlungspunkte in `docs/README.md` insgesamt, was nicht die Menge ist, die die Lane meint.

## 2. Angenommen ohne eigene Reproduktion

B3 (12 tote Doc-Pfade ohne Filterbegriff, real 11–16 je Filter), B4 ("8 Wrapper" nicht zaehlbar:
6 Root-`e2e-*.sh` vs. 10 `stage_instance`-Aufrufer), B8 (drei Messbasis-Zeilen ohne Kommando),
B9 (die "2 tsc-toten Symbole" brauchen Flags + Scope, sonst findet die Gate-tsc 0), B10 (die
Kommentar-Stale-Klasse nach den W1-Moves ist unvollstaendig gelistet). Alle fuenf sind
strukturell — sie behaupten eine fehlende Definition, nicht eine falsche Zahl, und der Beleg
liegt jeweils an der zitierten Stelle. Sie kosten nichts zu beheben und werden mit der
Planreparatur erledigt.

B6 (P0-Baselinemessnotiz fehlt) ist richtig und **war zum Zeitpunkt des Reviews bereits in
Arbeit**: die Kette der gruendenden Session (3× serielles `./e2e-isolated.sh` auf HEAD `6f173d7`,
bun 1.3.9) laeuft seit 20:45:42. Die Messnotiz ist Schuld dieser Session, nicht des Plans.

## 3. Was die Lane strukturell NICHT sehen konnte — drei eigene Befunde

### A1 — HOCH: `./state.sh`s config sensor meldet waehrend eines Suite-Laufs die Werte der TEST-Instanz als `live=`

Der Sensor (`state.sh:203-209`) nimmt jeden `bun server.ts`, dessen `cwd` das Haupt-Checkout ist,
und schreibt dessen Env in ein Dict — **spaetere PIDs ueberschreiben fruehere**. Eine laufende
`./e2e-isolated.sh` spawnt einen Server, der genau diesen Filter passiert:

```
pid=50010  cwd=/Users/owner/claude-fleet   FLEET_AUTO_REVIEW_MS=<unset>   <- der ECHTE Fleet
pid=29535  cwd=/Users/owner/claude-fleet   FLEET_SOCK=fleettest27807 FLEET_PORT=10607 FLEET_AUTO_REVIEW_MS=1000
pid=38187  cwd=<TMPDIR>/fleet-e2e-instance-27807  (derselbe Testlauf, wird korrekt gefiltert)
```

`./state.sh` druckte in diesem Zustand `FLEET_AUTO_REVIEW_MS live=1000`, `FLEET_PORT live=10607`,
`FLEET_INTAKE_SECRET live='e2e-intake-secret'` und 250-ms-Ticks — alles Werte der Test-Instanz.
Derselbe Block markiert pid 29535 als `LIVE`.

Kosten, und sie treffen genau dieses Programm: die Fenster-Checkliste (Plan :141-144) prueft
`FLEET_AUTO_REVIEW_MS` und `FLEET_AUDIT_PING_MS`, bevor ein Split-Fenster geoeffnet wird. Waehrend
der Sanierung laeuft fast immer eine Suite (jeder Slice endet mit einer). Eine Session, die das
Fenster gegen `./state.sh` verifiziert, verifiziert es gegen ein Phantom — und sieht auto-③
womoeglich als "steht auf 1000, also gesetzt" statt als "ist gar nicht gesetzt".
Sofort-Rueckweg ohne Codeaenderung: die Werte am ECHTEN Server ablesen
(`ps eww -p <pid mit leerem FLEET_SOCK>`), nie an der `live=`-Spalte, solange eine Suite laeuft.

### A2 — MITTEL: Die Planzahl "Zeilenrefs in rulebook/ ≥15" ist real 4

`grep -rnE '(server|client)\.ts:[0-9]+' rulebook/` liefert **4** Treffer. Der Plan (:26) budgetiert
W2 auf "≥15". Die Lane konnte das nicht messen (`rulebook/` ist gitignored und in jedem Worktree
physisch abwesend — sie hat das korrekt als Nicht-geprueft deklariert). W2s rulebook-Haelfte ist
also rund viermal kleiner als geplant.

### A3 — Live-Zustand, den der Plan als Vorbedingung annimmt (gemessen am echten Server pid 50010)

`FLEET_ANALYSIS_MS=0`, `FLEET_AUDIT_PING_MS=60000`, `FLEET_CLEAN_REVIEW=off`,
`FLEET_HARNESS_AUTOMATION=1`, `FLEET_DISPATCH_MAX_LANES=2`; `dispatch=false` in `fleet.json`
(Master-Stop AN), `autosOn=true`. **`FLEET_AUTO_REVIEW_MS` ist nirgends gesetzt** — weder in
`.env` noch in `watchdog.sh` —, auto-③ laeuft also auf dem Default **15 s** mit
`AUTO_REVIEW_IDLE_MS` 60 s. Die Plan-Anweisung (0 setzen + kickstart) ist damit korrekt und
**unerfuellt**. Relevant jetzt und nicht erst in P4: Lane `fleet/260831133127-8d97` ist in diesem
Moment done-looking (1 Commit, sauber) — auto-③ spawnt darauf eine echte claude-Session, waehrend
der Feature-Freeze laeuft.

## 4. Was sich am Plan aendert (Planreparatur vor P1)

1. Messbasis :25 — Zahl auf **1941** (rekursiv, `docs/` + `rulebook/`) korrigieren, die
   nicht-rekursive **700** als eigene Zeile mit eigenem Kommando fuehren, und die Banner-Policy
   (:92) ausdruecklich auf die nicht-rekursive Top-Level-Menge beziehen.
2. Messbasis :26 — "≥15" auf **4** korrigieren (A2).
3. Messbasis :21/:22 — **393** und **329**.
4. Messbasis :23/:24/:27 — aus der Kommando-Spalte nehmen und als Schaetzung deklarieren, oder
   je ein Kommando nachliefern (B8).
5. W1 (:83) — die beiden Praefix-Zeilen (`attic/`→DOC_RULE in verify-proportion.ts,
   `attic/`-Nicht-`.md` in task-metadata.ts) aus P2 nach W1 vorziehen (B2).
6. W2 (:91) — Filterdefinition fuer "tote Doc-Pfade" als Kommando (B3); Erfolgsmass 3 bekommt
   dieselbe Definition, sonst ist "geschlossen" unmessbar. W2-Arbeitsset um e2e-stage.sh:6/:11/:89,
   e2e/pins.ts:168 und server.ts:2821 ergaenzen (B10).
7. W4 (:96) — Ableitungskommando fuer die 2 toten Symbole mit Flags und Scope (B9).
8. RB2 (:38) — "8 Wrapper" durch die zaehlbare Invariante ersetzen (B4).
9. Fenster-Checkliste (:142) — Klausel umformulieren ("kein LIVE-Schalter") **und** den
   belegten Satz aufnehmen, dass `FLEET_AUTO_REVIEW_MS=0` die Watch-Zustellung nicht toetet (B5).
10. Fenster-Checkliste — neuer Punkt: Live-Werte NICHT aus `./state.sh`s `live=`-Spalte lesen,
    solange eine Suite laeuft (A1).

## 5. Offen, nicht von mir entscheidbar

Die zwei Punkte in `POST /api/self/attention` (Freeze-Durchsetzbarkeit gegenueber den sieben
weiteren lebenden Sessions in diesem Checkout; Disposition der done-looking Lane
`fleet/260831133127-8d97` vor dem Split) sowie der unpromovierte AGENTS.md-Regelvorschlag in
`fleet/260822143207-d70d`.

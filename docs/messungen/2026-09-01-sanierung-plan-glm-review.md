---
frage: Hat der Programmplan Generalsanierung (docs/sanierung-2026-09/plan-2026-08-31.md, Baum 49038af) Konstruktionsfehler, fehlende Lockstep-Stellen, missverständliche Slice-Kriterien oder unbelegte Behauptungen?
urteil: Substanz trägt — Struktur, Phasenordnung und die zitierten Lockstep-Stellen sind fast ausnahmslos codebestätigt —, aber die zentrale W2-Budgetzahl 704 ist mit dem eigenen Kommando nicht reproduzierbar (rekursiv real 1936/1937, nur ohne -r 700), attic/ läuft zwischen W1 und P2 durch DEFAULT_RULE statt DOC_RULE, die W2-Eingangszahl „12 tote Pfade" ist ohne Filterbegriff nicht ableitbar (11–16 je nach Filter), und die P0-Baselinemessnotiz existiert noch nicht im Baum.
bereich: [sanierung-plan, verify-gate, pins, w1-archiv, messbasis]
belege: [verify-proportion.ts#ruleFor, task-metadata.ts#processesForPath, server.ts:11459, server.ts:10969, server.ts:15623, e2e/pins.ts:216, e2e/pins.ts:986, e2e/pins.ts:2580, e2e/merge.ts:9, watchdog.sh:91, docs/README.md#curated-shelf, Messbasis-Reruns auf 49038af]
nicht-gemessen: Import-Zyklen null; Bun-Build-SHA-Determinismus (P3-Beweis); ~100 Archiv-Kandidaten; rulebook/-Zahlen (≥15 Zeilenrefs, Steward-Fragment) — rulebook/ in Lane absent; Live-Zustände (dispatchOn, ungeerntete Lanes, FLEET_AUDIT_PING_MS-Status, Dispatcher-Stop, graphify); Zwillinge-Branch-Diffs; Token-Schätzung 400–480k.
stand: 2026-09-01
---

# GLM-Gegenprüfung (P0b) des Sanierungs-Programmplans

2026-09-01, Lane `fleet/260831185004-71f9`, Baum `6f173d7` (= Plan-Baum `49038af` + Plan-Commit;
seither keine weitere Änderung — alle Zahlen auf beiden Bäumen identisch gemessen). Auftrag:
adversarialer Review des Plans, keine Implementierung. Jeder Befund zitiert die Planzeile und
nennt den Repo-Beleg. **BESTÄTIGT** = am Code dieses Baums gelesen; **NICHT REPRODUZIERBAR** =
mit dem angegebenen Kommando nicht ableitbar.

## Vorab: was der Plan richtig macht (BESTÄTIGT, Auswahl)

- Messbasis-Zeilen 25.522 / 9.124 (35,7 %) / 10.578 / TODO 0: exakt (Plan :18–:20, :11).
- „2 tsc-tote Symbole": exakt `WorkerRoute` (server.ts:10969, TS6196) und `branch` in
  `dossierTaskFor` (server.ts:15623, TS6133) — W4 :96 nennt beide korrekt (Ableitung s. B9).
- Alle stichprobenartig geprüften Zeilenrefs stimmen: BOTH-Trio server.ts:1299/23100/23145,
  Tombstone :500–505, task-metadata.ts:96/100 (root, nicht e2e/), e2e/tasks.ts:2713/2734/2748,
  README.md:78/85, register.sh §3 führt `git ls-files briefs/` aus (register.sh:315),
  pins.ts:15 (Regel-Philosophie), pins.ts:216–220 (steward-arena-Ausnahme), pins.ts:4214-Umfeld
  (Ein-Datei-Universum über `client.indexOf/slice`).
- Keep-Set „~11 Briefs": exakt 11 distinct aus Code zitiert (server-first-sync, task-refine,
  work-register, lane-stalled-fact, ui-next-level-2026-08-06, verify-queue-2026-08-04,
  phantom-park, codex-adapter-2026-08-08, lane-stalled-ledger, pi-messungen-2026-08-07,
  resolver-both-sides). 17 getrackte Symlinks (Mode 120000) in lerntisch/ bestätigt.
- RB2/RB5 tragfähig: `land-candidate.ts` wird live aus e2e/merge.ts:9 importiert (Ausschluss
  korrekt); Dockerfile/state.sh/e2e-stage.sh referenzieren server.ts als Entry; RULE_PATHS/
  RULE_GREPS skippen lane-seitig mit „no rulebook in this tree" (e2e/pins.ts:2580–2582);
  DIRECTORY_NOTES-Pin (e2e/pins.ts:986) deckt den W1-Schritt „+DIRECTORY_NOTES + Regen" ab.
- verify-tiering §11.7 existiert (docs/verify-tiering.md:1568; Beweisordnung = dort Regel 1
  „same tree re-run first", :1574) — der Pointer in P4-g trägt.
- Tag `vor-generalsanierung` → 49038af; server.ts = 1.696.092 B ≈ 1,7 MB; die im
  Ernteprotokoll genannten Branches existieren alle.

## Befunde (gerankt nach Schadenshöhe)

### B1 — HOCH: Die W2-Budgetzahl 704 ist mit dem angegebenen Kommando nicht reproduzierbar; real ~2,7× höher

Plan :25: „`server.ts:NNNN`-Zitate in docs/ | 704 | `grep -rEoh 'server\.ts:[0-9]+' docs/
rulebook/ | wc -l` (grep, nicht rg — gitignored Teile)".

Gemessen auf dem Plan-Baum (tracked, via `git grep -o` über 49038af): **1936**; im Worktree
(inclusive Plandatei): **1937** — nur docs/, denn `rulebook/` existiert in Lanes nicht und der
Befehl endet mit `grep: rulebook/: No such file or directory` (Exit 2). Ohne `-r` auf
`docs/*.md`: **700** ≈ 704. Die Zahl entstand also vermutlich nicht-rekursiv, das Kommando
sagt aber `-r`.

Schaden: Plan :92 budgetiert danach die „Banner-Policy für die 704 doc-seitigen Zeilenrefs".
Eine W2-Lane, die dem Messbasis-Versprechen (:14 „jede Zahl mit Ableitungs-Kommando — neu
messen, nicht glauben") folgt, misst ~2,7× mehr und weiß nicht, welcher Subset politisch
gemeint ist. Zusätzlich: dieselbe Zeile ist in einer Lane prinzipiell nur zur Hälfte messbar
(rulebook/-Hälfte fehlt); die Messbasis markiert das nicht, obwohl RB5 (:45) es weiß.

Richtung: Kommando auf das korrigieren, was 704 liefert (nicht-rekursiv, Top-level), und die
rekursive Wahrheit (1937) als zweite Zeile führen — oder Zahl auf 1937 berichtigen und die
Policy-Fläche explizit auf die indizierten Top-Level-Docs einschränken.

### B2 — HOCH: attic/ entsteht in W1, wird aber erst in P2 klassifiziert — bis dahin läuft jedes attic/-Dokument durch DEFAULT_RULE

Plan :83 (W1 schafft `attic/`) vs. Plan :100 (P2: „`attic/`→DOC_RULE in verify-proportion.ts").

Beleg: verify-proportion.ts:44–58 `ruleFor` — nur `docs/`, `briefs/`, `drops/`, Root-`.md`
und `.gitignore` erhalten DOC_RULE; alles andere fällt auf DEFAULT_RULE („conservative-default",
volle LOCAL_PROOF_STEPS, `isolatedPreview: "self-assess"`). Gleichzeitig gibt
task-metadata.ts `processesForPath` für attic/-Pfade `null` zurück (task-metadata.ts:107 f.),
was den Task-Cluster auf unknown setzt.

Schaden: Kein rotes Gate (DEFAULT_RULE ist konservativ und grün-fähig) — aber jede
dokumentarische Landung in attic/ zwischen W1 und P2 zahlt die volle Proof-Kette inkl.
isolation-Selbst-Einschätzung statt des kurzen Docs-Beweises, und die in AGENTS.md
formulierte Erwartung „docs-only → kurzer Beweis" stimmt für attic/ nicht mehr. Das ist ein
reiner Reihenfolge-/Kostenfehler mit simpler Behebung: die zwei Präfix-Zeilen (DOC_RULE +
task-metadata) in W1 mitziehen statt auf P2 zu verschieben.

### B3 — MITTEL: W2-Eingangszahl „12 tote docs/-Pfade in lebendem Code" hat kein Kommando und keinen Filterbegriff

Plan :91. Mechanische Reproduktion (`rg -o 'docs/[A-Za-z0-9._-]+\.md'` über `*.ts`/`*.sh`,
Existenz-Check): **56** unique tote Pfade gesamt — der Löwenanteil jedoch e2e-Fixtures
(absichtliche Temp-Pfade). Ohne e2e/: **16** distinct Pfade aus lebendem Code (server.ts 8,
watchdog.sh 3, src/client.ts 2, continuity.ts / lane-signals.ts / merge-prompt.ts /
fleet-e2e-security.ts je 1, atlas.sh 2, dedupliziert 16). Die meisten Ziele liegen in
`docs/attic/` (verschoben, nicht gelöscht); mindestens `efficiency-pilot-result.md` und
`security.md` sind wirklich weg. Je nach Filter („lebend" = nur .ts? watchdog zählen? atlas.sh
zählen, das W1 selbst archiviert?) ergeben sich 11–16 — **12 ist plausibel, aber nicht
ableitbar**.

Schaden: Die W2-Lane kann ihren Umfang nicht verifizieren, und Erfolgsmaß 3 (:166, „0 tote
Doc-Pfade aus Code — als Pin-KLASSE geschlossen") braucht eine messbare Definition, sonst ist
„geschlossen" eine Behauptung. Richtung: Filter definieren (Quellenmengen, e2e-Fixture-Ausschluss)
und als Kommando in die Messbasis aufnehmen.

### B4 — MITTEL: „8 Wrapper" (RB2) ist keine zählbare Menge

Plan :38: „`server.ts` bleibt Entry-Name (Stage-Sentinel e2e-stage.sh, 8 Wrapper, Dockerfile,
watchdog.sh, state.sh-pgrep)". Real: **6** Root-`e2e-*.sh`; die `stage_instance`-Menge umfasst
**10** Skripte (6 + acceptance-probe.sh + docker-verify.sh + steward-arena.sh + drills/drill-3.sh).

Schaden: RB2 sichert den Entry-Namen gegen den Split — wer die Referenzmenge warten soll,
muss wissen, welche 8 gemeint sind (vermutlich 5 e2e-Wrapper ohne Stage-Sentinel + docker-verify
+ acceptance-probe + drill-3). Eine Lane, die nachzählt, findet weder 6 noch 10 gleich 8 und
rät. Richtung: die 8 namentlich nennen oder auf die zählbare Invariante umstellen („alle
`stage_instance`-Aufrufer", pins.ts:216-Umfeld kennt die Menge bereits).

### B5 — MITTEL: Fenster-Checkliste liest sich beim auto-③-Punkt als Gegenteil des Code-Befunds

Plan :142: „auto-③ hat KEINEN Laufzeitschalter: `FLEET_AUTO_REVIEW_MS=0` in watchdog.sh +
`launchctl kickstart` …". Code: server.ts:11459 liest `FLEET_AUTO_REVIEW_MS` (Default 15_000)
mit Kommentar „0 disables the tick" — der Schalter **existiert**, er ist nur kein Live-Schalter:
Er steht nicht in der Spawn-Zeile (watchdog.sh setzt nur `FLEET_ANALYSIS_MS=0`,
`FLEET_AUDIT_PING_MS=60000`) und wirkt erst nach `launchctl kickstart -k`.

Schaden: Die Anweisung ist korrekt und ausführbar, aber die Begründungsklausel „hat KEINEN
Laufzeitschalter" ist wörtlich falsch (es gibt ihn, nur nicht live). Eine Lane im Zeitdruck
kann die Zeile als „nicht abschaltbar, skip" lesen — ausgerechnet über dem gefährlichsten
Spawner während eines stillgelegten Fensters (RB3 :42 koppelt Split-Sicherheit an genau diese
Fenster). Richtung: „kein Live-Schalter ohne Restart: `FLEET_AUTO_REVIEW_MS=0` in die
Spawn-Zeile von watchdog.sh und `launchctl kickstart -k` für die Programmdauer".

### B6 — NIEDRIG-MITTEL: Die P0-Baselinemessnotiz existiert noch nicht

Plan :74–:76: P0 (als „2026-08-31 begonnen" markiert) verlangt „Baseline = 3 konsekutive
serielle `./e2e-isolated.sh`-Läufe mit Timings (Messnotiz)". docs/messungen/ enthält keine
solche Notiz (`2026-08-31-task-workbench-baseline.md` ist eine UX-Baseline, 0 Treffer für
`e2e-isolated`; `second-host-baseline-2026-08-29.md` ist vor dem Baum und anders geartet).

Schaden: P0b soll laut Plan :80 „Befunde adjudizieren, dann erst P1" — wenn P1 ohne die
Baseline startet, fehlt der Vorher-Referenz für alle P4-Fenstervergleiche und für Erfolgsmaß 5
(„3 serielle Beweisläufe"). Kein Konstruktionsfehler, sondern eine offene P0-Schuld, die vor
P1-Beginn sichtbar sein muss.

### B7 — NIEDRIG: Messbasis-Kleinabweichungen (392→393, ~324→329, „~19"→16)

- Plan :21: 392 Commits seit 1. Juli — `git log --since=2026-07-01 --oneline -- server.ts |
  wc -l` liefert **393**, auch am Plan-Baum selbst (`git rev-list 49038af --since=2026-07-01
  -- server.ts | wc -l` = 393; das Plan-Commit fasst server.ts nicht an).
- Plan :22: `pin(` ~324 — gemessen **329**, auch auf 49038af. Innerhalb der Tilde, aber die
  abgeleitete Zahl ~255 (:23) baut darauf.
- Plan :92: „~19 indizierte operative Docs" — docs/README.md listet unter „Curated operative
  docs" **16** Einträge (19 nur mit den beiden datierten Entry-Points und SYSTEM.md, das
  außerhalb von docs/ liegt — nicht ableitbar).

Einzeln harmlos; gemeinsames Muster untergräbt das Messbasis-Versuchen „neu messen, nicht
glauben" aber dort, wo es billig wäre.

### B8 — NIEDRIG: Drei Messbasis-Zeilen haben überhaupt kein Kommando

Plan :23 (~255, „Heuristik 60-Zeilen-Fenster"), :24 (~11 Pins auf PROSA, „Nadeln gegen
Kommentarzeilen abgleichen"), :27 (~100 Archiv-Kandidaten, „Explorer-Inventar"). Der
Tabellen-Header :14 verspricht „jede Zahl mit Ableitungs-Kommando". Für W3 ist ~255 die
Kerngröße („Ein-Datei-Universen auf Modul-Mengen generalisieren") — eine Lane kann Vorher/
Nachher nicht vergleichen, weil es kein Vorher-Kommando gibt. Richtung: auch Heuristiken als
Skript-Zeile fassen (z. B. das Fenster als grep/awk-Einzeiler) oder explizit als Schätzung
deklarieren und aus der Kommando-Spalte herausnehmen.

### B9 — NIEDRIG: „tsc findet 2 tote Symbole" — die Ableitung steht nirgends, und sie ist scope-abhängig

Plan :11. Gate-tsc (watchdog.sh:91, ohne `--noUnused*`) findet **0**; mit
`--noUnusedLocals --noUnusedParameters` auf server.ts allein genau **2** (die korrekt
benannten); auf der vollen Gate-Entry-Liste **19** (16 weitere in e2e/). W4 :96 nennt die
Symbole exakt richtig — aber eine Lane, die „tsc" mit den Gate-Flags läuft, findet nichts und
verwirft den W4-Punkt als bereits erledigt. Richtung: das Kommando (Flags + Scope server.ts)
in die Messbasis/W4-Zeile schreiben.

### B10 — NIEDRIG: Kommentar-Stale-Klasse nach den W1-Moves ist unvollständig gelistet

Plan W1 (:83–:89) listet task-metadata, e2e/tasks.ts, register.sh, README, rulebook-Fragment,
pins.ts:216. Nicht gelistet (jeweils nur Kommentare, keine mechanische Breakage — aber exakt
die Klasse, die W2 als „tote Pfade aus Code" schließen will): e2e-stage.sh:6/:11/:89 und
e2e/pins.ts:168 (steward-arena-Erwähnungen), server.ts:2821 (worker-deepseek.py-Erwähnung).
Richtung: in das W2-Arbeitsset explizit aufnehmen.

## Nicht geprüft

- Import-Zyklen null (Diagnose :11) — kein madge/Äquivalent gelaufen.
- P3-Beweis: Determinismus des `bun build server.ts --target=bun`-SHA („nach stdout" ist
  zudem keine bun-build-Flag-Angabe; exakte Aufrufform fehlt im Protokoll-Schritt).
- ~100 Archiv-Kandidaten (Plan :27) — Explorer-Inventar nicht reproduziert.
- Alles Rulebook-seitige: ≥15 Zeilenrefs (:26), steward-arena-Fragment + Re-Render (:89) —
  rulebook/ ist gitignored und in dieser Lane physisch absent (Bestätigung von RB5 :45, aber
  eben unprüfbar hier).
- Live-Zustände: dispatchOn, done-looking ungeerntete Lanes, FLEET_AUDIT_PING_MS-Status,
  Dispatcher-Master-Stop, graphify update — Laufzeitfakten des Haupt-Checkouts, nicht des Baums.
- Ernteprotokoll-Details: Branch-Existenz BESTÄTIGT (alle 5 stichprobenartig geprüften
  Branches vorhanden), Diff-Gleichheit der „Zwillinge" und Byte-Identität der 10 Doc-Lanes
  nicht verglichen.
- Token-Schätzung 400–480k (RB6 :48) — nicht abgeleitet, nur 1,7 MB bestätigt.
- „Stage-Kopierlisten sind import-abgeleitet" (:38) — am Kommentar e2e-isolated.sh:50–53
  belegt, aber nicht mit einem Probe-Split durchexerziert.

Kontext: Fenster etwa zur Hälfte voll — Review hier abgeschlossen, keine Weiterarbeit nötig.

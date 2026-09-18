---
frage: In welcher Reihenfolge und in welchen Wellen sollen die offenen auftrag-Zeilen von claude-fleet starten — welche werden zusammengelegt, welche zuerst, welche dürfen warten?
urteil: 34 offene Zeilen (20 pending, 5 queued, davon 2 als Sammelkarten neu gefilet). Welle 1 gehört der pi-zai-Freischaltung (f437d2b4), dem Warte-Register (84888f35+4ae22c7a) und der ersten vorbereiteten Flash-Zeile (10e2f7c0). Zwei neue Zusammenlegungen (1e170a25+c14fcd75; bedingt ee47b0f8+1832c7eb), eine bestätigte Wellenpaarung, 11 Zeilen sind Schaerf-Faelle, 2 Archiv-Kandidaten nicht bestätigt. 26 der 34 Zeilen tragen WORKER-Default Flash; sie starten heute alle per Owner-Hand, bis f437d2b4 gelandet ist.
bereich: [queue, wellenplan, orchestrierung, worker-politik]
belege: [ctl.sh get /api/tasks, GET /api/start-plan, register.sh §1+§2, docs/messungen/2026-09-18-queue-durchsatz.md §a/§b/§c.4/§e, docs/messungen/2026-09-17-queue-reihenfolge.md, docs/messungen/2026-09-15-sichtung-wartende-auftraege.md, server.ts#PI_ZAI_HARNESS, server.ts#helperClaimBar, tasks-archive.jsonl]
nicht-gemessen: Wartegrund je Zeile historisch (kein Ledger, Durchsatz §b); die Auslösebedingung des stillen grep an NUL-Dateien (2e99a34e nennt sie offen); ob der ff-lost-Einzelwriter-Umbau (server.ts:4907–4964) das Loch der Zeile e66d9bfc geschlossen hat; die Task-Zuordnung der zwei Lanes b56e/c0e7 im Start-Snapshot
stand: 2026-09-18
---

# Wellenplan über die offenen Aufträge — smart zusammenlegen, hilfreiche Brocken zuerst, dann Durchsatz

2026-09-18, Lane `fleet/260918092425-ba02` (pi-zai/glm-5.3-flash), Snapshot **2026-09-18T09:37Z**.
Kommando des Stands: `./ctl.sh get /api/tasks` (dazu `GET /api/start-plan`, `GET /api/programs`,
`./register.sh` §1+§2, `git log`, `rg -a` — server.ts trägt ein NUL-Byte, ohne `-a` meldet rg
still "binary file matches"). Owner-Vorgabe, wörtlich (2026-09-18): *"wir sollten gleichzeitig
nicht einfach nur auf durchsatz gehen, sondern einzelne tasks smart zusammenlegen, die hilfreichen
grossen brocken zuerst machen"*.

Was inzwischen schon lief: die Fleet-Betrieb-MAIN hat im Queue-Revue-Paket 1+3 **selbst zwei
Sammelkarten gefilet** (17d80823 = 4b02bd09+f733e80d, b5dc4dc2 = 2630483e+0144fbf8, beide
card.valid, belegt im Kommentar an 17d80823) und die Holds von 37 auf 24 Zeilen abgebaut; der
Repo-Deckel steht seit 11:2x auf **1** (`GET /api/start-plan`: `cap {max: 1, source: repo}`) —
der Workaround, solange Flash-Lanes per Hand dispatcht werden (WARUM-Block von f437d2b4). Dieser
Plan rechnet damit, dass der Deckel nach der pi-zai-Freischaltung auf 3 zurückgeht, und schlägt
das Erhöhen sonst nicht vor (Gegenliste Durchsatz §e).

## (a) Die Tabelle über jede offene auftrag-Zeile

Population: 34 Zeilen mit `kind=auftrag`, `status` ∈ {pending, queued}, Repo claude-fleet
(20 Zeilen ohne Repo-Eintrag + 14 mit Pfad). Laufend bei Lane-Start und deshalb **nicht** in der
Tabelle: `2cf40772` (Auftrags-Dossier, Slot 1), `3f7363bf` (Prüfapparatur-Determinismus, Slot 4),
`e8a5baab` (Erdungs-Agent, Slot 6), diese Lane (`453f7615`), dazu die zwei Lanes b56e/c0e7
(Start 09:15/09:26, Zuordnung im Snapshot nicht sichtbar; b56e passt zeitlich zu `3d339443`).
WORKER-Default nach Owner-Entscheid 2026-09-15/17/18: **pi-zai/glm-5.3-flash/high**; Opus nur mit
benanntem Grund (Harness-/Land-/canDeliver-Naht, oder grosser Brocken mit Urteilsanteil).
Hold-Grund: Einzelkommentar wo vorhanden, sonst "Massen-Hold 09-17" (42 Holds ohne Grund,
Durchsatz §b). Zeilennummern in der Fläche beziehen sich auf HEAD `6a038105`.

| ID | Kopf | GROESSE | Fläche (Dateien · Symbole) | Hold + Grund | card.valid | Urteil | WORKER |
|---|---|---|---|---|---|---|---|
| `e66d9bfc` | P6 guarded-confirm verliert Fast-Forward in resolved-Verdikt | — | server.ts · Land-Pfad; Fläche ungelöst | nein | false (`verify: no command named`) | **schaerfen** — erst prüfen, ob der Single-Writer-Umbau (server.ts:4907–4964) das Loch geschlossen hat; dann VERIFY+Fläche nachtragen oder mit dem Beleg archivieren | Opus (Land-Naht) |
| `ee47b0f8` | Lebenszyklus S5b — paneModel als Rücklese und Push | — | AGENTS.md, lane-signals.ts, server.ts, fleet-e2e.ts · Sessions-Sicht | nein; queued, kollidiert mit Lane 1 auf server.ts | true | **starten** — wenn die server.ts-Lane gelandet ist; released | Flash |
| `1832c7eb` | Lebenszyklus S5c — Program-Deckel 1 pro Programm | — | wie S5b · server.ts#programDispatchCap | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | true | **schaerfen** — Sichtung 09-15: Brief setzt Repo-Deckel 2 voraus, Deckelabsicht ist offen; heute zusätzlich: Deckel steht auf 1 | Flash |
| `9940ec64` | complete-Report-Widerspruch bei ahead=0 | — | program-phase.ts, e2e/programs.ts, server.ts#programExecutionView | ja (MAIN 10) — Massen-Hold, kein Einzelgrund | true | **starten** — Release des Leichtgewicht-MAIN hebt den Hold | Flash |
| `531bab26` | Suite-Schnitt A — until/Dreiläufe/20-Prozent-Rest | — | e2e/harness.ts#until | ja (MAIN 10) — Massen-Hold, kein Einzelgrund | false (verify ohne Kettenschritt, until kein Ziel) | **schaerfen** — Sichtung 09-15: Steward-Idle ist gelandet, Restmenge neu basieren statt dieselben vier Minuten | Flash |
| `c14fcd75` | Idee B4 — Weckruf bündeln + Inbox benutzbar | — | server.ts#tickWatches (:6339), e2e/watch.ts, docs/self-api.md | nein; kein Programm (kein-program) | false (verify nennt kein Kettenglied) | **zusammenlegen mit `1e170a25`** (M1, §b) | Flash |
| `42c53378` | Migrate — zurückgekehrte Sends zählen, Erschöpfung offen | — | server.ts#migrateMessage (:14952-Umgebung), watchdog.sh, docs | ja (MAIN 10) — Massen-Hold, kein Einzelgrund | false (verify ohne Kettenschritt, tickMigrate kein Ziel) | **schaerfen** — Sichtung 09-15: E2E-Fläche und Laufzeitdelta konkretisieren | Flash |
| `d02fd2bd` | Brief-Gegenlese als Messversuch | mittel | refine-prompt.ts, refine-validate.ts, e2e/tasks.ts, server.ts, types | ja (MAIN 1, 09-14, eigener Hold vor dem Massen-Hold) | true | **starten** — der Gegenlese-Versuch ist der gebuchte Nachfolger des veralteten Refine-Rückbaus (666d0b67 archiviert) | **Opus** (Urteilsanteil: die Gegenlese IST das Experiment) |
| `4ae22c7a` | MAIN-Freigabe ohne Karte lässt after LEER | klein | server.ts Release-Pfad, e2e/programs.ts, docs/self-api.md | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | true | **starten** — als Wellenpartner von `84888f35` (so im Start-Plan w13 gepaart) | Flash |
| `bc1d7866` | Nachfolge-Brief sagt die Wahrheit + Deckel (Fremdrepo-Befunde) | mittel | server.ts, types, e2e/self-token.ts, docs/self-api.md | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | false (`size` fehlt im Anfragetext) | **schaerfen** — Queue-Revue: Paket 2a liegt bei Slot 3; Partner 3f79ff74 ist archiviert, Entscheidung abwarten, Karte validieren | Flash |
| `803c1869` | Land-Tür öffnet über Lane mit geschuldetem Vorschaulauf | klein | verify-proportion.ts, program-phase.ts, server.ts | ja (MAIN 8, 09-17 14:13) — Massen-Hold, kein Einzelgrund | true | **starten** — Reihenfolge-Notiz: entfernt den häufigsten roten Check (12×), "erster Kandidat über der Linie" | **Opus** (Land-Naht: Gate-/Proportions-Klassifikation) |
| `a43caeae` | §11.2y-Schutz sitzt auf 2 von 32 Wartestellen | klein | e2e/programs.ts, server.ts, e2e/pins.ts, docs/verify-tiering.md | nein; queued, kollidiert mit Lane 1 auf server.ts | false (2 Symbol-Gaps: waitDoneLooking, awaitFoundingBrief) | **schaerfen** — Symbole als Ziel benennen oder aus der FLAECHE streichen; danach startet sie als queued | Flash |
| `68a45516` | T4+T7 Varianten-Vergleich mit A2, ersetzt a1610fd7 | mittel | server.ts, types, lane-signals.ts, e2e/tasks.ts, docs | ja (MAIN 7, 09-17, eigener Hold) | false (`variant-compare.jsonl-Schreiber` untracked → creates) | **schaerfen** — Karte auf creates; Start NACH 17d80823 (deren VERBOTEN verbietet Parallelität) | Flash |
| `3d339443` | Sammelzeile land-quality: Anteil statt Diff-Proxy + auditRedReal | mittel | land-quality.ts, state.sh, e2e/pins.ts — **kein server.ts** | nein; queued, wartet auf Deckel | false (renderSummary kein benanntes Ziel) | **schaerfen** — Card-Gap fixen; dann startet sie als queued | Flash |
| `9fe80661` | README aus der Codebase statt abgelesener UI-Features | mittel | README.md | nein; kein Programm (kein-program) | true (soft gap: model "Opus 5") | **starten** — nach Programm-Zuordnung oder Owner-Dispatch; DONE verlangt den GLM-Gegencheck als eigene Mini-Lane | Flash |
| `f3ca2e05` | Cross-Host-Dispatch, CLARIFY FIRST | mittel | server.ts, helper-daemon/daemon.ts, 3 docs | ja (MAIN 3, 09-18): CLARIFY FIRST, Owner-Richtung 17.09. (Abgleich statt Auslagerung) hat verschoben | true | **schaerfen** — Rest auf das "Abgleich prozess/server"-Ziel zuschneiden; Q1–Q3 zur Lane-Auslagerung sind teils hinfällig | Flash |
| `e4409bf2` | Referenzen, die die Retention nicht sieht, CLARIFY FIRST | mittel | server.ts, task-notes.ts | ja (MAIN 8, 09-18): CLARIFY FIRST, zwei Befunde ohne gemeinsames Done | true | **schaerfen** — ein Done-Kriterium über beide Befunde bestätigen lassen | Flash |
| `8b2baf60` | Rollen-Synthese S2 — Delegation gebrieft und messbar | mittel | card-extract.ts, server.ts#buildLaneOutcome, types, e2e/tasks.ts | ja (MAIN 8, 09-18): VERBOTEN-Hälfte gelandet (0497df33), Karte beschreibt noch das Ganze | false (2 Symbol-/Pfad-Gaps) | **schaerfen** — Brief/Karte auf den Rest kürzen und valid; danach starten | Flash |
| `fa07734f` | Rollen-Synthese S3-Schatten — Klasse als Register | mittel | card-extract.ts, server.ts#briefAndSend, types, e2e/tasks.ts | ja (MAIN 8, 09-18): sagt selbst NACH S2; Fläche nennt NEU-Pfade als files | false (creates-Gaps) | **schaerfen** — Karte (creates statt files) + after 8b2baf60; Welle danach | Flash |
| `84888f35` | Warte-Register: jedes Warten mit Adressat als Datenschicht | **gross** | server.ts (startPlanNow :11641, Tick), types, e2e/tasks.ts, NEU waits.ts | nein; queued, Wellenpartner 4ae22c7a nicht released | true | **starten** — Welle 1, Platz 2 (§d) | **Opus** (grosser Brocken mit Urteilsanteil) |
| `b5a03766` | MAIN kann eigene offene Attention nicht zurückziehen | klein | server.ts, types, e2e/programs.ts, docs/self-api.md | nein; kein Programm (kein-program) | false (StudioGates ist kein benanntes Ziel — der Text nennt es nur als Nicht-Ziel) | **schaerfen** — StudioGates aus der FLAECHE streichen (Orchestratorin-Kommentar sagt genau das); Programm zuordnen, dann starten | Flash |
| `e41ccec1` | Pane-Leser: findet eine Sonde die Verfehlungs-Klasse? | mittel | lane-signals.ts, server.ts (lesend) | nein; queued, wartet auf Deckel | false (creates-Gap), aber released | **starten** — startet als queued, sobald der Deckel es zulässt | Flash |
| `1e170a25` | P6: 200-KB-Paste kommt vollständig an (Datei/Inbox statt Paste) | mittel | server.ts, e2e/slots.ts | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | true | **zusammenlegen mit `c14fcd75`** (M1, §b); danach starten | Flash |
| `a8e75559` | Ruhenende Session schläft statt RAM zu halten; Zustellung weckt | mittel | server.ts#ensureSlot, #canDeliver, types, e2e/slots.ts | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | true | **starten** — Welle 3, NACH f437d2b4 (§c, gleiche Naht) | **Opus** (canDeliver-Naht: jeder Zustellweg muss wecken) |
| `2e99a34e` | Vier Quelldateien tragen ein echtes NUL-Byte; grep still "kein Treffer" | klein | server.ts (:18492 auditShardJobId), context-snippets.ts, e2e/attention.ts, e2e/helper-portal.ts | ja (MAIN 8, 09-17): läuft als nächste server.ts-Zeile nach 2cf40772 | true | **starten** — als die server.ts-Zeile der Welle 3 | Flash |
| `10e2f7c0` | Erdung hat keine Kurzform — jede Session truncatet zweimal | klein | state.sh, register.sh, docs/controller.md | ja (MAIN 10, 09-17) | true | **starten** — Welle 1; MAIN-Kommentar setzt ROLLE bereits auf pi-zai/glm-5.3-flash | Flash |
| `7d70eaeb` | Welche Felder einer Queue-Zeile tragen die Aggregate | mittel | card-extract.ts, start-plan.ts, land-quality.ts, types, register.sh (lesend) | nein; queued, wartet auf Deckel | true | **starten** | Flash |
| `b0279bc6` | (b)-Klassifikation stehend: H1-Sensor + H2-Klassifikator | mittel | card-extract.ts, docs (lesend), measure.py im Scratch | nein; queued, kollidiert mit Lane 1 auf server.ts | false (measure.py untracked) | **schaerfen** — Karte auf getrackte Fläche; Start ins Astra-Fenster (Reset Sa 19.09., WORKER-Hinweis der Zeile) | codex/gpt-6-astra |
| `d518d09d` | Audit-Claim-Bar geht der Zeile verloren — Grund wird weggeworfen | klein | server.ts#helperClaimBar (:18105), e2e/helper-portal.ts, docs/verify-tiering.md | ja (MAIN 8, 09-17) — Massen-Hold, kein Einzelgrund | true | **schaerfen** — Reihenfolge-Notiz Adjudikation 1: die "147 lokal" ist die Remote-Zahl; neu messen (rg -a) und DONE um den zweiten Arm (:18964-Umgebung) erweitern | Flash |
| `cd0dda27` | Dev-Schnittstellen zum Testen von Instanzen — SKIZZE, später | mittel | 6 e2e-Wrapper, scratch-reap.sh, e2e/ctx.ts (lesend) | ja (MAIN 3, 09-18): SKIZZE ohne hartes Kriterium, Owner sagt ausdrücklich SPÄTER | true | **Owner-Frage** — die eigene Q1 der Zeile: *Was soll getestet werden können, das die sechs Wrapper nicht schon testen?* Bis dahin bleibt der Park | Flash |
| `76e08dd3` | Der Join: was die Quittung wegließ gegen was die Lane von Hand las | mittel | context-packs.ts, context-plan.ts, docs (lesend) | nein; queued, `after b0279bc6` | false (creates-Gap) | **schaerfen** — Karte (creates); Start nach b0279bc6 | Flash |
| `17d80823` | Sammelkarte A (4b02bd09+f733e80d): Variantengruppe ganz-oder-gar-nicht | mittel | server.ts#releaseTaskForMain (:10213), #variantReserveHolds (:13120), e2e/tasks.ts | ja (MAIN 3, 09-18, eigener frischer Hold) | true | **starten** — Welle 2, Platz 1 (§d) | Flash |
| `b5dc4dc2` | Sammelkarte C (2630483e+0144fbf8): MAIN-Entscheid erreicht busy Lane | mittel | server.ts#deliverFleetReportDecision (:8870), types, e2e/programs.ts, docs/self-api.md | ja (MAIN 3, 09-18, eigener frischer Hold) | true | **starten** — Welle 2 | **Opus** (Zustell-Naht: idle-Übergang, Occupation-Identität) |
| `f437d2b4` | pi-zai wird für den Tick automatisierbar — GLM-Worker ohne Handgriff | mittel | server.ts#PI_ZAI_HARNESS (:789), #harnessAutomatableFor, #paneReadiness (:6608), e2e/pins.ts | nein | (keine Karte nötig) | **starten** — Welle 1, Platz 1 (§d) | **Opus** (Harness-Naht, Grund steht in der Zeile) |

Zählung: **starten 15 · zusammenlegen 2 · schaerfen 16 · Owner-Frage 1 · archivieren 0** (davon
2 in Sammelkarten bereits gefilet: 17d80823, b5dc4dc2). Kein `archivieren`, weil keine Zeile einen
gelieferten Ersatz benennen kann, der selbst nachgelesen wurde; die zwei nächstliegenden Kandidaten
(e66d9bfc, d518d09d) bekommen schaerfen mit Prüfauftrag — eine Archivierung ohne eigenen
Baum-Beleg wäre ein Verkauf ohne Messung.

## (b) Zusammenlegungen

**M1 — `1e170a25` + `c14fcd75` (Idee B4, ein Tag, ein Zustellpfad).** Beide stammen aus der
Denksession 2026-09-02 §2.2/§2.5 B4; beide schreiben am selben Zustellweg (`server.ts` Paste-/
Deliver-Fenster, tickWatches :6339). c14fcd75 trägt ohnehin keine gültige Karte und kein Programm
(kein-program — niemand kann sie freigeben, server.ts#releaseTaskForMain nennt Programmlose
"nobody's"); ihre zwei Sätze (Weckruf bündeln, Inbox benutzbar) passen als DONE-Erweiterung auf
1e170a25s valide Karte. Sammelzeile: Dateien `server.ts, e2e/slots.ts, e2e/watch.ts,
docs/self-api.md`; VERIFY die volle Kette (server.ts angefasst) plus je ein Watch-/Slots-Check;
GROESSE **mittel**. Warum eine Lane billiger ist: eine KLEIN-Lane braucht bis "fertig" so lange
Wanduhr wie eine MITTEL-Lane (p50 50 gegen 51 min, Durchsatz §a/§c.4) — die zweite Zeile kostet in
einer Lane fast nur die Arbeit, getrennt zusätzlich Brief, Karte, Land-Gate und Post-Land-Audit.
Und getrennt würden die zwei Zeilen auf server.ts kollidieren.

**M2, bedingt — `ee47b0f8` + `1832c7eb` (Lebenszyklus S5b+S5c, Geschwister aus demselben Programm).**
Gemeinsame Fläche zu 6 Dateien (AGENTS.md, lane-signals.ts, server.ts, fleet-e2e.ts, 2
Programm-docs). Bedingung: erst die Deckelabsicht klären (1832c7eb ist schaerfen) — dann kann eine
Lane beide Schnitte tragen, statt zweimal dieselben Dateien anzufassen. Sammel-VERIFY: Kette plus
fleet-e2e-Check je Schnitt; GROESSE **mittel**. Gleiche Rechnung wie M1; ohne die Klärung nicht
zusammenlegen, weil die Frage der einen Zeile die andere nicht aufhält.

**Bestätigt, nicht neu: die Sammelkarten des Queue-Revue.** `17d80823` (4b02bd09+f733e80d) und
`b5dc4dc2` (2630483e+0144fbf8) sind heute mit validen Karten gefilet worden (Kommentar an
17d80823, Owner-Ja Paket 1+3) — sie sind die lebenden Belege, dass das Verfahren trägt. Ebenso
besteht das Paar `84888f35`+`4ae22c7a` schon als Start-Plan-Welle w13; es bleibt Paar, keine
Sammelkarte, weil die Summe gross > mittel wäre.

**Nicht zusammengelegt, mit Grund:** `e41ccec1`+`b0279bc6` (beide Modell-als-Parameter-Klassifikator,
aber Panetext gegen Bash-Spur — verschiedene Daten, verschiedene Fläche, und b0279bc6 gehört ins
Astra-Fenster); `2e99a34e`+`d518d09d` (beide "Entscheidung fällt, niemand schreibt sie auf", aber
NUL-Escape und Claim-Bar-Ledger teilen keine Datei jenseits von server.ts in weit auseinander
liegenden Regionen :18492 gegen :18105-Umgebung); `803c1869`+`a43caeae` (Land-Naht gegen
e2e-Warteschleifen — verschiedene Nähte, je klein genug).

## (c) Der Wellenplan

Regeln je Welle: höchstens 3 Lanes; höchstens eine auf server.ts ohne bekannte disjunkte Ranges;
Platz 1 ist die hilfreichste GROSSE/mittlere Zeile nach benanntem Nutzen, nicht nach Größe.
Regionen sind an HEAD `6a038105` benannt; beim Start gegen die aktuellen Zeilen prüfen.

**Welle 1 — die Freischaltung, das Register, die erste Flash-Zeile.**

1. `f437d2b4` (mittel, Opus) — server.ts:789–1375 Adapterblock + :6608 paneReadiness + e2e/pins.ts.
2. `84888f35` (gross, Opus) + `4ae22c7a` (klein) als Paar, sobald der Deckel ≥ 2 —
   server.ts Plan-Region (:11641 startPlanNow, Tick) + NEU waits.ts. Disjunkt zu 1: Adapterblock
   gegen Plan/Tick-Region, beides Symbol-benannt.
3. `10e2f7c0` (klein, Flash, Owner-Dispatch; der MAIN-Kommentar hat die ROLLE schon umgestellt) —
   state.sh/register.sh/docs, kein server.ts.

After-Kanten: `f437d2b4` → der Tick fährt Flash-Default, und der Deckel-1-Workaround kann vom
Owner auf 3 zurückgesetzt werden; `84888f35` → alle späteren Reihenfolge-Entscheide bekommen
Warte-Daten mit Adressat; `10e2f7c0` → Blatt.

**Welle 2 — die zwei Sammelkarten und das Feld-Kataster.**

1. `17d80823` (mittel, Flash) — server.ts Release-/Varianten-Region (:10213, :13039–13446).
2. `7d70eaeb` (mittel, Flash; läuft als queued ohnehin nach Plan-Reihenfolge) — lesend, kein
   server.ts-Write.
3. `b5dc4dc2` (mittel, Opus) — server.ts :8335–9003 (decideFleetReport/deliverFleetReportDecision);
   disjunkt zu 1 (Report-Delivery gegen Release-Mechanik).

After-Kanten: `17d80823` → `68a45516` (nicht parallel, VERBOTEN benannt); `b5dc4dc2` →
needs-main-Entscheidungen werden an busy Lanes zustellbar; `7d70eaeb` → Grundlage für die
Aggregierungs-Aufträge der Owner-Richtung 09-17.

**Welle 3 — RAM, ehrliches grep, der README-Brocken.**

1. `a8e75559` (mittel, Opus) — NACH `f437d2b4` (beide an der automatable/canDeliver-Naht,
   server.ts :6608-Umgebung und :710–1297).
2. `2e99a34e` (klein, Flash) — server.ts :18492 auditShardJobId (eine Zeile, Bit-Identität
   bewiesen) + 3 Dateien; disjunkt zu 1.
3. `9fe80661` (mittel, Flash; der GLM-Gegencheck des DONE ist eine eigene Mini-Lane) — README.md;
   braucht vorher Programm-Zuordnung oder Owner-Dispatch (kein-program).

After-Kanten: `a8e75559` nach `f437d2b4`; `2e99a34e` zahlt auf jede künftige server.ts-Suche ein.

**Welle 4 — Zustell-Robustheit, Land-Zahlen, das Pseudo-Rot.**

1. M1 = `1e170a25` + `c14fcd75` (mittel, Flash) — server.ts Paste-/Deliver-Fenster (:6339
   tickWatches-Umgebung) + Composer-Pfad; Welle 4 startet nach Welle 3, keine Kollision.
2. `3d339443` (mittel, Flash; Card-Gap vorher fixen) — land-quality.ts/state.sh/e2e/pins.ts,
   kein server.ts.
3. `803c1869` (klein, Opus) — verify-proportion.ts/program-phase.ts; Release des MAIN hebt den Hold.

After-Kanten: `3d339443` macht die Land-Zahlen lesbar, gegen die Durchsatz §e seine Gegenliste
führte; `803c1869` entfernt den häufigsten roten Check der Wellen danach.

**Welle 5 und der Rest (starten je nach Schärf-Fortschritt):** `68a45516` (nach 17d80823),
`ee47b0f8` (queued), `e41ccec1` (queued), `b0279bc6` (Astra-Fenster ab Sa 19.09.) → danach
`76e08dd3` (after b0279bc6), `d02fd2bd` (Opus-Gegenlese), `9940ec64`, `531bab26` und `42c53378`
(je nach Schärfung), `8b2baf60` → `fa07734f` (Kette, benannt), `a43caeae` und `b5a03766` (je nach
Card-Fix als queued), `bc1d7866` (nach Slot-3-Entscheid Paket 2a), `1832c7eb` (nach
Deckelabsicht, ggf. als M2), `f3ca2e05`/`e4409bf2` (clarify first), `cd0dda27` (Park),
`d518d09d`/`e66d9bfc` (je nach Schärf-Ausgang).

## (d) Rangbegründung der ersten fünf Zeilen

1. **`f437d2b4`** (pi-zai automatisierbar). 26 der 34 offenen Zeilen tragen WORKER-Default Flash;
   solange `automatable:false` steht (server.ts:826, Probe 3cdffd97 "nicht belegt"), fährt sie
   keine einzige über den Tick — die Freigabe-Hand, die Durchsatz §b als Engpass misst, bleibt für
   alle 26 an der Owner-Session hängen. 9 dieser Zeilen sind startnah (queued oder nur ein Release
   entfernt): `3d339443`, `7d70eaeb`, `e41ccec1`, `10e2f7c0`, `2e99a34e`, `1e170a25`, `d518d09d`,
   `4ae22c7a`, `9940ec64`. Außerdem ist der Deckel 1 der Preis dieser Sperre — mit Tick-Fähigkeit
   kann er auf 3 zurück. Die Zeile berührt die Harness-Naht selbst, darum Opus.
2. **`84888f35`** (Warte-Register, gross). Es ist die Datenschicht unter jedem späteren
   Reihenfolge-Entscheid: Durchsatz §b zählt 1.394 min Unterdeckung mit wartender, freigegebener
   Zeile und keinen ablesbaren Grund, und genau das benennt die Zeile als ihre Lücke. Beide
   Betriebs-Schnitte aus Durchsatz §e (Hold-Disziplin, Reihenfolge) sind ohne sie nicht messbar;
   die Messung selbst sagt, die zwei Posten, die das Warten adressieren, seien "genau die, die
   nicht gebaut sind". Opus wegen Umfang und Urteilsanteil.
3. **`10e2f7c0`** (Erdung-Kurzform, klein). Die vorbereitete Flash-Zeile: MAIN-Kommentar setzt die
   ROLLE bereits auf pi-zai/glm-5.3-flash, Karte valid, Hold nur durch Freigabe zu lösen. Nutzen
   je späterer Session: 68.250 B Erdung (Live-Messung im Kommentar) werden zu ≤ 8.000 B Kurzform —
   bei 430+362 Aufrufen in 14 Tagen (Zahl in der Zeile) ein direkter Kontextkostenhebel für jede
   Welle dieses Plans.
4. **`17d80823`** (Sammelkarte A, Variantengruppen). Zwei Zeilen sind hier bereits zusammengelegt
   und die Karte valid — der Start kostet keine Vorbereitung. Nutzen: Teilstart-Schaden (eine
   Variantengruppe, deren zweiter Spawn fehlschlägt, lässt Halbfertiges stehen) und die
   Deckel-Lücke (n zählt nicht gegen PROGRAM_MAX_RELEASED) fallen weg; `68a45516` ist hinter
   dieser Zeile explizit gesperrt. Fläche Release-/Reserve-Region (:10213, :13039–13446), in
   Welle 2 ohne server.ts-Nachbar.
5. **`7d70eaeb`** (Feld-Kataster, mittlere Notiz). Der Owner will Aggregation über Tasks
   (Richtung 09-17); diese Zeile liest dazu JEDES Task-Feld gegen seine Leser und schneidet
   höchstens drei Hebel. Sie läuft ohnehin als queued nach Plan-Reihenfolge, kostet also keinen
   Wellenplatz, und ihre Five-Finding-Liste (Modell 16 % ungestempelt, size 79 % null, Programm
   "nobody's", VERIFY-Politik, kommentarloser Kommentar) ist die Grundlage, damit die
   Sammelkarten-Politik dieses Plans künftig im Filing statt in der Nacharbeit ansetzt.

**Gehört die pi-zai-Freischaltung in Welle 1? Ja.** Sie ist der einzige Posten, der die
Durchsatz-Diagnose ("die Zeit liegt vor dem Dispatch") ohne Betriebsregelung angreift: 26
Flash-Default-Zeilen werden vom Tick startbar, 9 davon sofort startnah, und der Deckel-1-Workaround
fällt mit ihrer Ursache weg. Ohne sie bleibt jeder Wellenstart dieses Plans an eine Hand gebunden;
mit ihr ist der Rest des Plans eine Reihenfolge statt einer Disposition.

## (e) Schnittlinie

**Über der Linie — das erfüllt die Owner-Vorgabe:** Welle 1–3 vollständig, Welle 4 Posten 1–2,
plus die Card-Fixes der startnahen Zeilen (`a43caeae`, `b5a03766`, `3d339443`, `68a45516`,
`76e08dd3` — Orchestrator-Akte, keine Lanes). Begründung: hier liegen die großen Brocken mit
benanntem Nutzen (84888f35 entsperrt die Messung, a8e75559 den RAM, 9fe80661 die Lesefassade),
die Zusammenlegungen (M1, M2, die zwei bestätigten Sammelkarten) und der Durchsatzhebel (pi-zai),
der die Reihenfolge überhaupt maschinell macht.

**Unter der Linie — das darf warten, mit Grund:** die clarify-first-Parks (`cd0dda27`,
`f3ca2e05`, `e4409bf2` — der Owner hat "später" bzw. Klärung ausdrücklich vor den Start gesetzt);
die S-Synthese-Kette (`8b2baf60` → `fa07734f` — Karte und Vorgänger benennen die Ordnung selbst);
die Suite-Reste (`531bab26`, `42c53378` — Sichtung 09-15 verlangt Neubasierung, nicht Start);
`b0279bc6` → `76e08dd3` (Astra-Fenster, Reset Sa 19.09.); `bc1d7866` (Slot-3-Entscheid Paket 2a
steht aus); `1832c7eb` (Deckelabsicht; im besten Fall M2-Partner); `d518d09d` und `e66d9bfc`
(Beleglage gegen ihre Prämisse — erst schärfen, dann darf eine Welle sie tragen). Grund überall:
keiner dieser Posten sperrt eine andere Zeile, die nicht ohnehin an der eigenen Karte hängt — das
Warten kostet also keine Wellenzeit, nur Listenplatz.

## Methode

Nur lesend: `./ctl.sh get /api/tasks` (Snapshot 09:37Z, 200 Zeilen gesamt, 147 auftrag, 34 offen
in claude-fleet), `GET /api/start-plan` (33 Wellen, cap {max:1, source:repo}, lanes 4),
`GET /api/programs`, `./register.sh` §1 (87 offene Zeilen, Flächen je Karte) und §2
(Kollisionsfläche: server.ts 28×, dann types 10×, self-api 8×), `git log --oneline -25`,
`rg -a` für PI_ZAI_HARNESS (:789, automatable:false bei :826), helperClaimBar (:18105),
ff-lost (:4907–4964) und die Symbolzeilen der Regionstabelle. tasks-archive.jsonl im
Haupt-Checkout für den Status der Partnerzeilen (3f79ff74/a1610fd7/666d0b67 archiviert;
67abe12c, eeacda0a, abd10a06 done). Pflichtlektüre: die drei genannten Messnotizen. Keine
Prozess-Kommandozeile ausgegeben; keine Queue-Zeile verändert.

## Was nicht gemessen wurde

- Der Wartegrund je Zeile (collides/after/card-invalid) bleibt ohne Ledger unbekannt — genau
  deshalb ist 84888f35 Platz 2 der Welle 1, nicht Feinschliff.
- Ob der Single-Writer-Umbau um ff-lost (server.ts:4907–4964) das Loch von e66d9bfc geschlossen
  hat: ungelesen im Detail, darum schaerfen statt archivieren.
- Die 9 "startnahen" Flash-Zeilen sind ein Zählurteil über Karte+Hold+Programm im Snapshot, keine
  geprüfte Startbarkeitsgarantie; der Start-Plan ist die lebende Instanz davon.
- Die Task-Zuordnung der Lanes b56e/c0e7 im Start-Snapshot; ein Irrtum hier ändert an der Tabelle
  nichts, weil beide Zeilen ohnehin queued stehen.
- Wie viele der 26 Flash-Zeilen nach der Freischaltung tatsächlich den Tick nehmen, hängt an der
  Karten-/Release-Qualität je Zeile — die Zählung nennt die Obergrenze, nicht die Prognose.

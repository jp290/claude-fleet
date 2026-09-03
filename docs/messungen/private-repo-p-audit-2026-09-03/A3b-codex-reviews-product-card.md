# Strang A3b — Unabhängiger Review und Product-Card-Entstehung (Codex-Seite)

Quellen: Codex-Rollouts `~/.codex/sessions/2026/09/02/rollout-…T13-35-31-*.jsonl` (Brief 5),
`…T19-36-27-*.jsonl` (Brief 7), `~/.codex/sessions/2026/08/31/rollout-…T16-26-39-*.jsonl` (MAIN N0),
`…T16-34-21-*.jsonl` (Product-Card-Lane b0ad8a79); `docs/reviews/*.md`, `docs/PRODUCT.md`,
`ios-tasks.md`, `ios-programs.json`, `ios-audit-log.jsonl`, Swift-Code unter `Private-repo-y/`.
Zeiten lokal (CEST). Werkzeug: `work-A3b/idx.py` (Ereignis-Index über die Rollouts).

## Was der Lauf geleistet hat

Die Codex-Seite ist der handwerklich sauberste Teil des ganzen Laufs. Beide Review-Lanes haben den
kompletten vorgeschriebenen Korpus wirklich gelesen (Brief 5: 19 `nl -ba`-Ausgaben über Core, App,
Tests, UITests, alle Fixtures in ~6,5 min; Brief 7 dasselbe in ~5 min), beide haben den echten
Land-Gate `sh scripts/verify.sh` gefahren (Brief 7: exit 0, 428 s, Simulator, 53+5+59 Tests), beide
haben ihre Vorgabe „genau ein Lauf" gegen einen Land-Fehlschlag verteidigt statt zu rerollen
(b5.txt 14:00:23: „I won't rerun: the original owner instruction capped this review lane at exactly
one `sh scripts/verify.sh`"), beide haben sich beim Verdikt an die Beweislage gehalten und ein FAIL
geschrieben, obwohl das Maschinen-Gate grün war. Brief 7 hat zu jedem geschlossenen Vorbefund die
brechende Mutation benannt — der einzige Ort im ganzen Trail, an dem „der Test kann fallen" belegt
statt behauptet wird. Die vier Vorbefunde von Review 1 sind sachlich richtig; die zwei HIGH-Befunde
von Review 2 habe ich am Code nachgeprüft und beide bestätigt. Und die Product Card ist kein
Wunschzettel: sie sagt selbst, dass die vier ALL-PASS-Tails keine Nutzbarkeit beweisen
(`docs/PRODUCT.md:353`).

## Befunde, nach Folgekosten

### B1 (HIGH) — „independent-codex-review" ist ein Vertrags-Abgleich, kein Produkt-Review; er kann per Konstruktion nicht finden, was der Owner im Video sah

Brief 5 nennt zehn Invarianten (`ios-tasks.md:236-249`); alle zehn sind aus `docs/PRODUCT.md`
abgeleitet, und `docs/PRODUCT.md` hat dieselbe MAIN-Linie geschrieben, die die Briefs schrieb. Der
Reviewer prüft also den Code gegen die Karte — nie die Karte gegen ein Produkt. Beide Receipts
sagen das in denselben Worten unter „Not verified": *„I did not verify a physical-device run, a real
ChatGPT/Claude acceptance run, paid-service behavior, **owner usability**, signing, installation,
deployment"* (`docs/reviews/2026-09-02-independent-codex-review.md:88`, wörtlich wiederholt in
`…-re-review.md:100`). Genau die Achse, auf der der Owner sein Urteil fällte, steht zweimal
schriftlich als ungeprüft da — und kein Gate, keine Queue-Zeile und keine MAIN-Notiz hat sie je
aufgegriffen.
**Was der Reviewer gebraucht hätte:** eine bediente App. Er *konnte* Bilder sehen — Brief 5 rief
`view_image` zweimal (14:02:15/14:02:21) auf die aus dem `.xcresult` exportierten
Element-Screenshots und diagnostizierte damit den Kontrastfehler an `release.sentences.empty`
korrekt. Brief 7 rief `view_image` **null**mal. Die Fähigkeit war da, der Brief hat sie nicht
bestellt. Der Brief, der sie bestellt hätte (Brief 8, Computer-Use-Drive), wurde entworfen und nie
gefilet (`ios-tasks.md:333`, Bedingung: „File it only after Brief 7 returns ALL-PASS" — Brief 7 kam
FAIL zurück, also fiel er aus).
**Kosten:** zwei Review-Runden (Brief 5 ~29 min Lane + Brief 7 ~18 min Lane + 428 s Simulator +
2,5 h queued) haben sechs Konformitätsbefunde erzeugt und null Produktbefunde. Beim nächsten Lauf
kostet dieselbe Konstruktion dasselbe wieder: der Owner bleibt der einzige Sensor für Produktqualität.

### B2 (HIGH) — Das Instrument, das die zentrale Produktfrage entscheiden soll, existiert nur in einer Testdatei

Program-`successCriterion` und Card verlangen, dass die fünf Golden Cases über 2,99 € × 5 vs. 3
Projekte entscheiden. Das Rechenwerk dafür ist `GoldenCaseReport.build(...)`
(`Private-repo-y/Core/StageMeasurement.swift:267`). Seine einzigen Aufrufstellen im ganzen Repo liegen
in `Private-repo-yTests/ExportAndMeasurementTests.swift` (Z. 277, 318, 330, 340, 350, 361, 364, 367,
375). Die App baut nie einen Report und zeigt nie eine Preisentscheidung; `ExportView` zeigt nur
`Measure` je Stufe (`Private-repo-y/App/ExportView.swift:23-31`). Auch die fünf Golden Cases sind
Schema-Demonstration, nicht Produktrealität: als WorkflowPack-Fixture existieren **zwei von fünf**
(`valid-golden-case-2-…`, `valid-golden-case-3-…`); GC1/GC4/GC5 leben ausschließlich als
`record(...)`-Zeilen in derselben Testdatei (Z. 454-484).
**Kosten:** die Frage, deretwegen das Program „fünf Golden Cases" heißt, ist nach dem First Slice
genauso unbeantwortet wie vorher — und niemand kann es an der App merken, weil die App die Frage
nicht stellt. Kein Reviewer-Befund deckt das ab: die zehn Invarianten sagen nichts über die fünf
Golden Cases als Produktinstrument.

### B3 (HIGH) — „Private-repo-y" enthält keinen einzigen Modellaufruf, und niemand im Trail hat das je als Problem benannt

Der Widerspruch aus der Aufgabenstellung ist real und wurde nicht aufgelöst, sondern *umdefiniert*.
Die Card löst ihn in der Messtabelle: „Tokens: tatsächlich gemessene Nutzung; **ohne Modellaufruf
`0`**, sonst bei fehlendem Signal `unknown`" (`docs/PRODUCT.md:227`). Damit wird die Abwesenheit von
KI zu einem *Messwert* statt zu einer Lücke. Von dort wandert sie in jeden Brief als **Produktregel**:
Brief 1 „No network, no credential, no model. Cost for the orientation stage is therefore exactly 0"
(ios-prompts ts 1788312028711); Brief 2 „creation makes no provider call … (\"Entwurf ohne
Modellaufruf\")" (ts 1788320977704); Brief 4 „a stage with no model call records tokens 0 and cost 0"
(ts 1788339934313). Im Code ist das `StageMeasures.local(...)` → `tokens: .measured(0), cost:
.measured(0)` für Orientierung, Erstellung und Demo (`StageMeasurement.swift:83-85`). Ich habe
`ios-tasks.md`, `ios-prompts.jsonl` (117 Zustellungen) und beide Receipts nach einer Stelle
durchsucht, an der jemand „die App konsultiert nichts" als Befund, Risiko oder offene Frage notiert:
**keine**. Die drei Treffer sind genau die drei Briefzeilen, die es festschreiben.
**Kosten:** der Owner sah im Video ein Formular-und-JSON-Werkzeug mit dem Namen „Private-repo-y". Die
Diskrepanz zwischen Name/Claim („Dein AI-Workflow, eingerichtet") und Erlebnis ist die
wahrscheinlichste Wurzel seines „recht weit unter dem was möglich wäre". Beim nächsten Lauf
wiederholt sich das, solange eine `nonGoal`-Zeile (kein Credential, keine Live-Kosten) still in eine
Produkteigenschaft umgeschrieben werden darf, ohne dass jemand den Verlust registriert.

### B4 (HIGH) — Die Brief-6-Reparatur hat einen FALSCHEN Vertrag in Fixtures und Tests einzementiert

Verifiziert am Code: `WorkflowPackValidator.areIncompatible` beginnt mit
`if first.kind == second.kind { return first.value != second.value }`
(`Private-repo-y/Core/WorkflowPackValidator.swift:449-451`). Zwei `min`-Schranken mit verschiedenen
Werten gelten damit als unvereinbar, obwohl `min 80` ∧ `min 120` jeden Wert ≥ 120 zulässt. Der
Doc-Kommentar direkt darüber definiert Unvereinbarkeit als „no single scalar value can satisfy both"
(Z. 446) — die Implementierung widerspricht ihrer eigenen Spezifikation drei Zeilen tiefer. Die
Negativ-Fixture `reject-contradiction-constraint-same-kind-twice.json` trägt genau `min 80`,
`min 120`, `max 160` und erwartet Ablehnung. **Finding 1 des Re-Reviews ist damit korrekt, und
HIGH ist die richtige Schwere** — nicht wegen der Häufigkeit redundanter Schranken, sondern weil ein
Test jetzt das falsche Verhalten VERTEIDIGT: die Reparatur hat den Bug zur Spec gemacht.
**Mechanismus-Kette:** Review-1-Finding 1 sagte „es fehlt ein Kompatibilitätspass" → Brief 6 nahm
den Satz als Auftrag → die Lane implementierte einen Pass, ohne die Semantik „unvereinbar" neu
herzuleiten → sie schrieb Fixture + Contract-Test aus der eigenen Implementierung → grünes Gate.
**Kosten:** ein Reparatur-Zyklus (Brief 6, 1 h 36 min Lane, ein rotes Land, ein Re-Land) hat einen
Befund gegen einen anderen getauscht. Beim nächsten Lauf wiederholt sich das überall dort, wo ein
Reparatur-Brief aus einem Review-Satz kompiliert wird, ohne die Definition mitzuliefern, gegen die
repariert wird.

### B5 (HIGH) — Die „objektive synthetische Demo" ist ein Orakel-Echo; der Re-Review hat das korrekt als OPEN gehalten

Verifiziert: `DemoRun.runCase` setzt `let expected = testCase.expectedOutcome.status` und gibt für
`.stop`/`.escalate` sofort `result(status: .stop, …)` zurück, bevor ein Schritt läuft
(`Private-repo-y/Core/DemoRun.swift:190, 208-222`). `statusMatches` ist für diese Fälle also
tautologisch wahr. `demonstratedValidationIDs` liefert bei null ausgeführten Schritten *alle*
Schritt-Validierungen (Z. 103-105) — ein präemptierter Fall behauptet jede Validierung. `outputMatches`
sucht in `renderedText`, das die echoten Eingaben enthält (Z. 118-137). `StageMeasures.demo` zählt
`matchesExpectation` als vollständige Demo-Qualität (Z. 154). Damit ist die Demo — das im Video
sichtbarste Artefakt — kein Beweis über den Pack, sondern über die Testdatei.
**Kosten:** Golden-Case-2 kann grün sein, ohne dass je ein umformulierter Text entsteht. Das ist
genau die Sorte „grün, aber nichts gemessen", vor der das Fleet-Regelbuch beim Audit warnt — hier
im Produkt statt in der Suite. Brief 9 (`ba896b1b`, queued seit 09-03 08:22) würde beide HIGH
reparieren, ist aber nicht dispatcht.

### B6 (HIGH, Prozess) — MAIN N0 starb still nach dem Land-Fehlschlag; 26 h 20 min ohne jeden Sensor

Gemessen: `ios-audit-log.jsonl` zeigt für Program 07ee8a6d zwischen `self_land_start` **08-31
19:23:26** (slot 4, Kandidat `e225cd37`) und `slot_open` **09-01 21:44:08** (slot 3) **keinen
einzigen Eintrag**. Der Rollout von MAIN N0 endet auf derselben Sekundenlage: letzte Zeile
19:24:54, „Kandidat `e225cd3` läuft; Merge-Watch `d5c83788` ist abonniert. Du musst nichts tun."
Der Land schlug fehl (`sh tools/verify.sh` → exit 127, `tools/verify.sh` existiert nicht; die Lane
reproduzierte das um 19:24:36 deterministisch und meldete `needs-main`). Die Lane bekam das Verdikt,
MAIN nicht — bzw. MAIN wachte nie wieder auf. Die Karte landete erst 09-01 22:01 als `f1555201`,
gelandet von der neu gegründeten MAIN N1 (`land_actor … main slot=3 … task=b0ad8a79`).
**Zweite Beobachtung derselben Klasse:** MAIN N0 wartete schon davor 16:47 → 19:19 (2 h 32 min)
untätig auf den Worker-Report und wurde erst vom Owner geweckt („soo, slot5 ist fertig, lass uns die
ergebnisse jetzt auswerten, soll ich eben landen oder machst du das?", 19:19:14). Sie hatte sich
ausdrücklich das Pollen verboten und keinen Rückweg gelegt.
**Kosten:** 26,3 h von einem Dreitageslauf, plus 2,5 h davor. Der Owner ist zweimal der Watchdog.

### B7 (MEDIUM) — Was in den Review-Briefs 5/7 fehlte

Was sie richtig machten (und was zu behalten ist): Schreibfläche auf genau eine Datei, wörtlicher
Pflicht-Tail als Verdikt, genau ein Gate-Lauf, „a claimed pass without quoted evidence is a FAIL",
und in Brief 7 zusätzlich die Pflicht, je Vorbefund die *brechende Mutation* zu nennen. Das ist der
schärfste Brief des ganzen Laufs. Was fehlte:
1. **Keine Produkt- oder UX-Invariante.** Zehn Invarianten, alle strukturell (Schema, Renderer,
   Netz, Hashes, Freigabe, Reparaturzahl, `unknown`, Seam, Tautologie, Accessibility-Audit).
   Accessibility ist die einzige, die überhaupt in Richtung Erlebnis zeigt — und sie prüft, ob der
   *Audit aufgerufen wird*, nicht wie die App aussieht.
2. **Kein Auftrag, die Karte selbst zu kritisieren.** Beide Receipts enthalten unter „Abstraction
   judgment" genau einen bestätigenden Satz („the WorkflowPack validator … should exist because…").
   Das ist die Ritualzeile aus `AGENTS.md`, kein Urteil. Der Reviewer hat die Product Card an keiner
   Stelle in Frage gestellt — er wurde nicht danach gefragt.
3. **Keine Instruktion, die App zu bedienen**, obwohl der Simulator ohnehin lief und `view_image`
   verfügbar war (siehe B1).
4. **Kein Rückweg bei FAIL.** Brief 7 endet mit dem Receipt; was danach geschieht, lag bei einer
   MAIN, die den Owner-Stop abwartete. Brief 9 liegt seit 09-03 08:22 `queued`.

## Schnittlinie

Alles darunter ist Beobachtung ohne bezifferbare Folgekosten.

- Der zitierte Tail von `schema-negative.log` („Test run with 0 tests in 0 suites passed") liest sich
  wie ein Null-Messung-Grün, ist aber die swift-testing-Zusammenfassung neben 59 XCTest-Tests
  derselben Ausführung; der Reviewer hat beide Zahlen zitiert. Kein Loch, aber ein Beweisformat, das
  „letzte zwei Zeilen" verlangt, wo „die Zeile mit der Testzahl" gemeint ist.
- `ios-lane-outcomes.jsonl` führt für `fleet/260831143421-06eb` `ownerPrompts: 0`, obwohl der Rollout
  zwei Owner-Turns enthält (19:26:28, 19:28:02). Der Zähler sieht Codex-Pane-Eingaben nicht.
- Die Product-Card-Lane und MAIN N0 haben je ~7-8 Minuten damit verbracht, `graphify/SKILL.md`
  (≈760 Zeilen) in drei bis vier `sed`-Blöcken zu lesen, um dann festzustellen, dass es keinen
  Graphen gibt und keiner gebaut werden darf. Dreimal derselbe Leerlauf (b5.txt 13:35:50-13:36:38,
  b7.txt 19:36:40-19:37:24, o-34-21 16:34:43-16:35:29).

## Zur Product-Card-Entstehung (Frage 4, verdichtet)

- **Wer/woraus:** Codex-Lane `b0ad8a79` (gpt-5.6-sol/high), Worktree `fleet-260831143421-06eb`.
  Input war ausschließlich der 5353-Zeichen-Brief von MAIN N0 plus vier Repo-Dateien (`AGENTS.md`,
  altes `docs/PRODUCT.md`, `docs/PROOF.md`, `README.md`), gelesen 16:35:34 in **einem** `cat`.
  Kein Owner-Gespräch, keine Marktrecherche, kein Nutzer, kein Blick auf ein Konkurrenzprodukt.
- **Zeit:** erster Lesebefehl 16:35:34 → erster Patch (343 Zeilen, ein Zug) 16:40:50 → Commit
  `166267e` 16:43:35. **8 min 1 s.**
- **Prüfung:** `git diff --check`, ein `rg` auf die Pflicht-Feldnamen, `jq -e .` auf den normativen
  JSON-Block, ein `cmp` des Private-repo-x-Alttexts, `make check`. Alles Formprüfung; keine einzige
  Aussage über Produktqualität wurde geprüft, weil keine prüfbar formuliert war.
- **Die Nachschärfung `f155520`** stammt nicht von der Lane, sondern von **MAIN N0**, die am 08-31
  19:22:47 direkt in den Lane-Worktree patchte (`e225cd3`) — nach dem Owner-Anstoß. Sie ist inhaltlich
  die wertvollste Änderung des Tages: sie ersetzte fünf abstrakte Golden Cases durch fünf konkrete
  Fixtures mit benannten Eingaben und Erwartungen. Genau diese Konkretisierung machte GC2/GC3 später
  überhaupt implementierbar. Dauer: ~25 s Patch.
- **Trägt die Card den AGENTS.md-Anspruch als prüfbares Gate?** Nein. Sie *benennt* ihn korrekt:
  „Simulator-Playability braucht zusätzlich den frischen beobachteten Lauf und dessen Artefakte; die
  vier Tails allein beweisen keine Nutzbarkeit" (`docs/PRODUCT.md:353`). Aber dieser Satz steht
  **außerhalb** der vier verbindlichen Tails, hat kein Kommando, keinen Ort und keinen Adressaten.
  Was die vier Tails beweisen: dass die Pflichtdateien da sind und Shell/Projekt syntaktisch sind
  (`ALL-PASS repository`), dass 59 Host-Package-Tests grün sind (`schema-negative`), dass 53 Unit-
  und 5 UI-Tests inkl. `performAccessibilityAudit` grün sind (`unit-ui-accessibility`), und dass
  ein zweiter Agent den Code gegen zehn strukturelle Invarianten gelesen hat
  (`independent-codex-review`). Was sie nicht beweisen: dass die App etwas Nützliches tut, dass sie
  gut aussieht, dass sie zusammenhängend zu bedienen ist, oder dass irgendein Mensch sie je bedient hat.

## Verifiziert

- Brief-5-Ablauf, Kommandos und Zeiten aus `work-A3b/b5.txt` (66 `exec`-Aufrufe): Korpuslesung
  13:35:50-13:40:46; ein `sh scripts/verify.sh` ab 13:42:11; Receipt-Patch 13:52:57; Commit
  `74e9e50` 13:53:18; `fleet-report status=failed` 13:53:53; danach zwei Land-Verdikte
  (14:00:05 landed=NO Accessibility, 14:39:15 landed=NO verify timed out) mit read-only-Diagnose,
  darunter zwei `view_image` auf `.xcresult`-Anhänge.
- Brief-7-Ablauf aus `work-A3b/b7.txt`: Korpuslesung 19:36:40-19:41:12; `uptime`-Vorprobe 4,80;
  ein Gate-Lauf 19:41:38-19:48:46 (exit 0, 428 s); Receipt 19:52:32/19:53:12; Commit
  `b18d161`; `fleet-report status=needs-main`; **kein** `view_image`.
- Re-Review Finding 1 gegen `WorkflowPackValidator.swift:449-451` + Fixture Z. 22-42: bestätigt.
- Re-Review Finding 2 gegen `DemoRun.swift:100-105, 118-152, 190, 208-222` und
  `StageMeasurement.swift:154`: bestätigt.
- `GoldenCaseReport.build` hat keine Aufrufstelle außerhalb von `ExportAndMeasurementTests.swift`
  (grep über `Private-repo-y`, `Private-repo-yTests`, `Private-repo-yUITests`, `scripts`).
- `StageMeasures.local` setzt `tokens/cost = .measured(0)` (`StageMeasurement.swift:83-85`);
  Orientierung/Erstellung/Demo nutzen es.
- Zwei von fünf Golden Cases existieren als WorkflowPack-Fixture (`ls Fixtures/WorkflowPack`).
- Lücke MAIN N0 → N1: `ios-audit-log.jsonl`, kein Eintrag zwischen 08-31 19:23:26 und 09-01 21:44:08;
  Land-Note von `f155520` nennt `actor {kind:main, slot:3, task:b0ad8a79}`, `at` = 09-01 22:01.
- Product-Card-Zeiten und -Input aus `work-A3b/o-34-21-0.txt`; `f155520`-Autorschaft (MAIN N0,
  Patch in den Lane-Worktree) aus `work-A3b/o-26-39-0.txt` 19:22:47/19:23:11.
- Keine Fundstelle in `ios-tasks.md`, `ios-prompts.jsonl` oder den beiden Receipts, die die
  Abwesenheit jedes Modellaufrufs als Problem benennt.

## Abgeleitet

- Dass der Reviewer *hätte* die App bedienen können, folgt aus zwei erfolgreichen `view_image`-
  Aufrufen und aus dem Vorhandensein von Brief 8 als Entwurf — nicht aus einem durchgeführten Versuch.
- Die Zuschreibung von B4 („Reparatur zementiert falschen Vertrag") an den Brief-6-Kompilationsweg
  stützt sich auf Brief-6-Text und Ergebniscode, nicht auf das Brief-6-Lane-Transkript (nicht mein Strang).
- Dass MAIN N0 am Merge-Watch starb (statt an Kontext, Crash oder Kill), ist die naheliegendste
  Lesart des abrupten Rollout-Endes 19:24:54 mitten in einer Warteschleife — ich habe keinen
  Slot-/Prozess-Beleg dafür geprüft.

## Nicht geprüft

- Das Video selbst (Strang mit Videozugriff), `HANDOFF.md`, die Claude-MAIN-Transkripte N1/N1.5/N2
  und die sechs Claude-Lane-Transkripte.
- Brief-6-Lane (`2f60`): warum die Reparatur die falsche Semantik wählte, ist nicht am Transkript belegt.
- `scripts/verify.sh` wurde gelesen, aber nicht ausgeführt (Brief-Verbot); alle Gate-Zahlen stammen
  aus den Receipts und den Land-Notes.
- Ob die zwei HIGH-Befunde heute noch offen sind: `ba896b1b` ist `queued`, ein Fix-Commit auf main
  wurde nicht gesucht.
- Ob der Owner die Preisfrage überhaupt beantwortet haben wollte oder sie bewusst vertagte.

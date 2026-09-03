# A3a — Die sechs Bau-Lanes: Brief → Ausführung → Beweis

Quellen: die sechs Lane-Transkripte (`~/.claude/projects/-Users-owner-private-repo-p-worktrees-fleet-<branch>/*.jsonl`),
`/private/tmp/claude-501/-Users-owner-claude-fleet/694703e9-66cc-4d09-bd16-9279e253eaed/scratchpad/audit/ios-tasks.md` (Briefs wörtlich), `/private/tmp/claude-501/-Users-owner-claude-fleet/694703e9-66cc-4d09-bd16-9279e253eaed/scratchpad/audit/ios-lane-outcomes.jsonl`, `/private/tmp/claude-501/-Users-owner-claude-fleet/694703e9-66cc-4d09-bd16-9279e253eaed/scratchpad/audit/ios-land-notes.txt`,
`/Users/owner/private-repo-p` (AGENTS.md, docs/PRODUCT.md, docs/reviews/*). Zeiten lokal (CEST).
Arbeitsskripte: `/private/tmp/claude-501/-Users-owner-claude-fleet/694703e9-66cc-4d09-bd16-9279e253eaed/scratchpad/audit/work-A3a/{idx,attr,big,phase,runs,png,ground,rep}.py`.

## Was der Lauf geleistet hat

Sechs Lanes, sechs Lands, **null Fehlschläge**: jede Lane hat ihren Slice gebaut, den literalen
Gate-Befehl mindestens zweimal selbst gefahren, den Tail wörtlich in den Report genommen und ihre
Abweichungen vom Brief benannt — keine einzige stille Abweichung gefunden. Die Werkzeug-Disziplin ist
hoch: **kein einziger** Suite-Lauf wurde in den Kontext geleitet, alle liefen detached in eine Logdatei,
gelesen wurden Tails; Bash-Ausgaben liegen je Lane bei 150–322 KB, unabhängig von der Laufzeit
(`ios-lane-outcomes.jsonl`, `toolResultBytes.byTool`). Fünf der sechs Lanes haben ihren eigenen
Screenshot angesehen, eine (c384) hat aus dem XCUITest-**Video** per ffmpeg Frames extrahiert, um einen
Keyboard-Focus-Flake zu diagnostizieren (`work-A3a/c384.idx:85`, 00:23:57). Drei Lanes haben ihre
Gate-Lehren in eine Projekt-Memory geschrieben. Das ist deutlich mehr Beweisführung als der
Private-repo-o-Lauf hatte.

## Kennzahlen (gemessen)

| Lane | Brief | aktiv | Erdung bis 1. Schreibaktion | tool_result gesamt | davon Screenshots | Commits | Land-Verify |
|---|---|---|---|---|---|---|---|
| c384 | 1 | 51 min | 6,0 min / 7 Aufrufe / 40 KB | 0,34 MB | 0,19 MB (3) | 1 | 146 s |
| 8ce8 | 2 | 48 min | 4,4 min / 10 / 104 KB | 0,70 MB | 0,48 MB (5) | 1 | 193 s |
| 1e59 | 3a | 31 min | 5,4 min / 14 / 186 KB | 0,97 MB | 0,72 MB (6) | 1 | 194 s |
| dfdb | 3b | 109 min | 4,7 min / 23 / 229 KB | **5,21 MB** | **4,66 MB (11)** | 3 | 300 s TIMEOUT → 249 s |
| 3713 | 4 | 62 min | 6,1 min / 26 / 239 KB | 1,12 MB | 0,77 MB (3) | 1 | 191 s |
| 2f60 | 6 | 87 min | 8,4 min / 28 / 214 KB | 0,38 MB | 0,05 MB (2) | 2 | 452 s (Budget 480) |

Summe tool_result 8,71 MB, davon **6,87 MB = 79 % Screenshot-Reads**. Bash (aller Code, alle Log-Tails,
alle git- und Fleet-Aufrufe zusammen) sind 1,48 MB = 17 %.

---

## Befunde, gerankt nach Folgekosten

### 1. Der Brief schrieb die Reparatur-REGEL vor — und sie war falsch. Beide HIGH-Befunde der Re-Review stammen aus Brief-6-Zeilen, nicht aus Lane-Arbeit. **(verifiziert)**

Brief 6 F1 gab die Prüfregel wörtlich vor: „derive the incompatible pairs from ConstraintKind itself
(at least: a lower bound greater than an upper bound of the same measure, **two constraints of the same
kind with different values on one input**, …)" (`ios-tasks.md:282`). Die zweite Klausel ist sachlich
falsch — `min 80` + `min 120` ist erfüllbar. 2f60 hat sie buchstabengetreu implementiert
(`WorkflowPackValidator.swift:450`) und dafür eine Negativ-Fixture gebaut. Die Re-Review führt das
Ergebnis als **HIGH-Regress**: „compatible constraints are rejected as contradictions … the supposedly
closed contract has acquired an undocumented uniqueness rule"
(`docs/reviews/2026-09-02-independent-codex-re-review.md:51`).

Dasselbe bei F2: Brief 6 definierte „rendered text" als Titel + Meldung + Step-Titel + Input-Labels +
gerenderte Werte + State-Ids + **Checklisten-Regeln** (`ios-tasks.md:283`). Genau diese Definition macht
die Prüfung zum Echo — die Re-Review: „demo quality is an oracle echo, not an objective synthetic result
… output fragments are matched against inputs and unevaluated checklist prose" (`…re-review.md:53`),
Befund bleibt **OPEN**.

Mechanismus: der Brief-Autor (MAIN) hat nicht nur das Ziel, sondern den ALGORITHMUS diktiert. Die Lane
las das korrekt als Auftrag, nicht als Vorschlag, und hat an keiner Stelle zurückgefragt (im
2f60-Transkript keine einzige Erwägung zur Erfüllbarkeit von Constraint-Paaren). **Kosten:** eine
komplette Review-Runde (Brief 7, Codex, 24 min Lane + 336 s Land) plus Brief 9, seit 09-03 08:22 queued
und nicht dispatcht — der „erste geprüfte Workflow" endet mit zwei offenen HIGH.
**Fehlende Zeile im Brief:** „Wenn die hier genannte Regel dir sachlich falsch erscheint, baue sie NICHT
— melde den Widerspruch und stoppe." Das ist der einzige Befund, der Produktqualität direkt kostet.

### 2. AGENTS.md verlangt visuelle Kohärenz; in keinem der sechs Briefs steht davon ein Wort. **(verifiziert)**

`AGENTS.md:5-6`: „Product quality, interaction, accessibility, and visual coherence are part of the
slice; a green compile alone is never a usable-app claim." Ein `grep -niE
"visual|kohär|design|typograph|spacing|layout|polish|playab|bedien|usable"` über alle Briefs in
`ios-tasks.md` trifft **keinen einzigen** Bau-Brief; die einzigen Treffer sind der Product-Card-Brief und
dort als VERBOT („Do not claim … product playability", `ios-tasks.md:11`).

Was die Briefs stattdessen bestellen, ist überall dieselbe Formel: „Accessibility identifiers on every
interactive element … each UI test runs performAccessibilityAudit at least once" (Brief 2 §3, 3a §4,
3b §5). Folge: **der Accessibility-Audit wurde de facto zum einzigen UI-Qualitätsgate** — und er hat
echte Produktänderungen erzwungen (8ce8-Report: „no long placeholders, wrapping option rows instead of
segmented pickers, a 44 pt bordered button, a darker warning colour"; dfdb: „five red runs went to
accessibility-audit rejections"; 3713: „two accessibility-audit failures … now fixed as 44 pt chips";
2f60 15:02: ein Clipping-Befund auf einer nie zuvor auditierten Karte). Der Audit prüft Trefferflächen,
Kontrast und Clipping — **nicht** Hierarchie, Rhythmus, Typografie, Zustandsführung.

Die Screenshots haben die Lanes gesehen, aber die Brief-Frage dazu war jedes Mal eine INHALTSfrage
(„confirmation that brief-2-orientation.png exists **and shows the four labelled parts**"). Entsprechend
berichten sie: dfdb beschreibt elf Elemente, kein Wort über Anmutung. **Kosten:** genau die Lücke, die
der Owner im Video sah („nicht super super schlecht … recht weit unter dem was möglich wäre").
**Fehlende Zeile:** ein stehender Brief-Block „sieh dir den Screenshot als Produkt an und benenne drei
Dinge, die ein Designer ändern würde" — plus mindestens ein freier Bedien-Lauf statt nur der von
XCUITest gefahrenen Zustände.

### 3. Vollauflösende Retina-PNGs sind 79 % des gesamten Kontextverbrauchs aller sechs Lanes. **(verifiziert)**

Die Lanes exportieren die xcresult-Attachments und lesen sie unverkleinert: dfdb elf Bilder zu 23–661 KB
= 4,66 MB von 5,21 MB (95 %), 1e59 zwei Bilder à 350 KB, 8ce8 eines à 443 KB, 3713 zwei à 456/325 KB
(`work-A3a/png.py`). Kein `sips`, kein `convert`, keine Skalierung in irgendeinem der sechs Transkripte.
dfdb las `brief-3-privacy-block.png` **zweimal** (09:51 580 KB, 09:59 660 KB) — 1,2 MB für eine Frage,
die es schon beantwortet hatte. **Kosten:** dfdb ist damit die einzige Lane, die überhaupt in die Nähe
eines Kontextproblems kam, und der Grund ist keine Produktkomplexität, sondern fehlende Bildhygiene.
**Fehlende Zeile:** „Screenshots vor dem Ansehen auf ≤900 px Breite skalieren (`sips -Z 900`), jedes Bild
höchstens einmal lesen." Ersparnis nach Messung: ~5,5 MB über sechs Lanes, davon ~4,2 MB allein in dfdb.

### 4. Das Wall-Time-Budget wurde in der Lane gemessen und im Gate unter anderer Last eingelöst. **(verifiziert)**

Jeder Brief nennt eine harte Schranke (240 / 270 / 220 / 250 s) und verlangt zwei Lane-Läufe darunter.
Die Lane misst dabei unter LANE-Last, das Gate läuft unter GATE-Last. Die Differenzen:
dfdb meldete 226/239 s, das Land lief in den 300-s-Timeout (`ios-tasks.md:224`, Notiz d139ad7c);
2f60 meldete 249/249 s, das Land brauchte **452 s** (`ios-land-notes.txt:20`, `ms:451923`) — Faktor 1,8;
3713s erster Gate-Versuch war rot bei 450 s gegen zwei Lane-Läufe von 239/217 s.
Mechanismus: das Budget ist ein absoluter Wert ohne Lastbezug, auf einem 8-GB-Host mit ~30 Sessions.
**Kosten, exakt bezifferbar:** dfdbs zweite Sitzungshälfte, **10:14 bis 10:55 = 41 Minuten reiner
Gate-Kampf** ohne eine Zeile Produktarbeit (verify.sh parallelisiert, Type-Check dedupliziert, zwei
UI-Tests auf Prefill-Seams umgebaut, Shell-Trap repariert) — plus die MAIN-Zeit für die
Budget-Erhöhung 300→480 s. **Fehlende Zeile:** ein RELATIVES Kriterium („dein Lauf muss ≤ 55 % des
Gate-Budgets liegen") oder ein Lastwert im Report.

### 5. Der vorgeschriebene Beweis-Tail lautet „0 tests in 0 suites passed" — und alle sechs Lanes zitierten ihn brav. **(verifiziert)**

Alle sechs Reports enthalten identisch:
`✔ Test run with 0 tests in 0 suites passed after 0.00x seconds.` / `ALL-PASS schema-negative`.
Die echten Zahlen (5 → 17 → 29 → 41 → 52 → 59 XCTest-Fälle) stehen in einer anderen Zeile, die kein
Brief anfordert. Nur c384 hat den Widerspruch bemerkt und erklärt („SwiftPM's Swift Testing runner
notice"). **Kosten:** der Tail, den `docs/PRODUCT.md:344` als verbindliches First-Slice-Gate führt, ist
für einen Leser (auch für MAIN, auch für den Owner) inhaltsleer bis irreführend — ein Lauf, in dem der
XCTest-Block gar nicht startet, sähe genauso aus. Klasse „ein grünes Audit, das nichts gemessen hat".
**Fehlende Zeile:** den `Executed N tests, with 0 failures`-Block zum Pflichtzitat machen.

### 6. Die Erdungskosten wachsen linear mit dem Repo, weil jeder Brief „read in full" per Glob bestellt. **(verifiziert)**

Bytes bis zur ersten Schreibaktion: 40 → 104 → 186 → 229 → 239 → 214 KB, Aufrufe 7 → 10 → 14 → 23 → 26 →
28 (`work-A3a/ground.py`). Ursache ist die von Brief zu Brief mechanisch fortgeschriebene Leseliste
(„Private-repo-y/Core/*.swift, Private-repo-y/App/*.swift, Private-repo-yTests/*.swift,
Private-repo-yUITests/*.swift"). `cat docs/PRODUCT.md` (20 KB) läuft in **allen sechs** Lanes. Die Zeit ist
konstant klein (4,4–8,4 min), die Bytes nicht. **Kosten:** heute tragbar, aber die Kurve ist die
eigentliche Aussage — bei Brief 10 wäre die Erdung ~400 KB, bevor eine Zeile entsteht.
**Fehlende Zeile:** je Brief eine Leseliste mit ZWECK statt mit Glob („WorkflowPack.swift nur für die
Feldnamen — nutze `grep -n 'case '`").

---
*Schnittlinie — darunter gemessen, aber kein Handlungsdruck:*

- Die Lane-Memory ist für Lanes **unsichtbar**: die drei Lanes, die Gate-Lehren schrieben (8ce8 04:08,
  1e59 06:16, dfdb 10:54), schrieben nach `~/.claude/projects/-Users-owner-private-repo-p/memory/`, das
  nur eine Session mit cwd `/Users/owner/private-repo-p` automatisch lädt. Die sechs Lane-Projektordner
  haben **kein** `memory/`-Verzeichnis (geprüft: `ls ~/.claude/projects/-Users-owner-private-repo-p-worktrees-fleet-*`).
  Der Transport lief allein über den Brief — und nur Brief 6 nannte die Datei (`ios-tasks.md:276`).
  1e59 und dfdb fanden sie aus eigenem Antrieb (05:50:01 bzw. 09:06:41); **3713 nicht** und lief in zwei
  Accessibility-Audit-Reds, genau die Klasse, die die Datei dokumentiert.
- Der MAIN hat 2f60 eine **uncommittete** Reparatur in den laufenden Lane-Worktree gelegt
  (`waitUntilSelected`, später `b5c62cd`); die Lane fand sie, übernahm sie bewusst unverändert und
  begründete das (15:37:50). Diesmal gutgegangen — dieselbe Bewegung als `git checkout --` wäre
  Datenverlust gewesen.
- dfdb-Zeitprofil (der Ausreißer, aufgeschlüsselt): 09:05–09:10 Erdung · 09:10–09:18 Produktcode
  (4 Core-Dateien + View, ~8 min) · 09:18–09:51 elf Gate-Läufe, davon fünf rot auf Accessibility-Audits ·
  09:51–10:01 Commit + Report · 10:01–10:14 Wartezeit auf das Land · **10:14–10:55 Gate-Timeout-Kampf**.
  Produktarbeit ≈ 8 min von 109. Brief 3b war der größte Brief des Laufs (8 Punkte, 4 neue Core-Dateien,
  ein großer View, ein Test-Seam, zwei Testdateien, verify.sh-Änderung) — ein Schnitt, kein Slice.
- Die Land-Note trägt `verify.steps: ["install","pins","tsc","build","clean-review","security","claude-gate"]`
  für JEDES private-repo-p-Land — das sind die Schrittnamen des Fleet-Repos, nicht die von `scripts/verify.sh`.
  Kosmetisch, aber ein Leser, der die Note als Beweis liest, liest falsche Stufen.

## Verifiziert
Alle Tabellenzahlen (Turn-Index, Byte-Attribution, Erdungsschnitt, Screenshot-Zählung), die
Brief-Wortlaute aus `ios-tasks.md`, die sechs Lane-Abschlussberichte, `AGENTS.md:5-6`, die beiden
Codex-Review-Receipts, `ios-land-notes.txt` (ms/exitCode je Land), die Abwesenheit von `memory/` in den
Lane-Projektordnern, die Abwesenheit von Skalierungsbefehlen und von Design-Vokabular in den Briefs.

## Abgeleitet
Dass Befund 1 die Ursache der zwei offenen HIGH ist (Brief-Zeile → Code-Zeile → Review-Zitat sind je
einzeln belegt, die Kausalkette ist mein Schluss). Dass Screenshot-Skalierung ~5,5 MB gespart hätte
(Rechnung aus Bildgrößen, nicht gemessen). Dass 3713s zwei Audit-Reds durch die Memory vermeidbar
gewesen wären.

## Nicht geprüft
Die Codex-Rollouts (Brief 5/7 — Strang A3b), die drei MAIN-Transkripte, das Video, die
Product-Card-Lane, `ios-prompts.jsonl`/`ios-attention.json` (Zustellwege), der tatsächliche
Swift-Code-Diff je Land über die Review-Zitate hinaus, und ob die vier
`ALL-PASS`-Tails in `docs/PRODUCT.md:340-355` je vollständig gemeinsam vorlagen.

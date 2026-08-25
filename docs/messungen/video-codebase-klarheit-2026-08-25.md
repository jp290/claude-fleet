# Video-Zweitanalyse: wie ein Codebase sich selbst erklärt

2026-08-25, Lane `fleet/260825204003-e600`. Quelle: dasselbe Video wie die Erstanalyse —
„Turn off Claude Code's Memory" (Theo / t3.gg), 39:28,
`https://www.youtube.com/watch?v=Jf54k7tFeEc`.
Erstanalyse: `docs/messungen/video-memory-theo-2026-08-25.md` (Punkte P1–P121, Transkript-Rezept §5.1).

Frage dieser Passe: **Was sagt das Video über Codebase-Selbsterklärung — und was davon trifft
diesen Codebase?** Die Memory-Frage ist beantwortet und wird hier nicht erneut aufgemacht.

Arbeitsmodus: Transkript neu gezogen und gegen die Erstanalyse abgeglichen (1.130 Cues, 142 Blöcke,
8.197 Wörter — Erstanalyse 1.130/142/8.339; die Wortdifferenz ist Tokenisierung, das Material ist
dasselbe). Vertieft gelesen: 00:30–08:19, 22:23–25:34, 32:10–37:58. Alle Repo-Zahlen unten sind in
dieser Lane neu gemessen, nicht aus der Erstanalyse übernommen — wo sie abweichen, steht es dabei.

---

## 1. Punkte

Nummerierung: `P…` = Punkt der Erstanalyse (ÜBERNOMMEN, hier nur eingeordnet). `C…` = in dieser
Passe neu erfasst (NEU). Zeitmarken = Blockbeginn im `en-orig`-Auto-Transkript.

### 1.1 Der Kern: Code ist die einzige Ablage, jede zweite driftet

| # | Zeit | Punkt | Status |
|---|---|---|---|
| P14 | 03:13 | „Code is truth. Code is the ground truth. It's also evolving and I don't need another place that I need to maintain. I already have a code base to maintain." | ÜBERNOMMEN |
| P15 | 03:43 | Kommentar veraltet → „It's now actively harmful because it steers people and agents the wrong way." | ÜBERNOMMEN |
| P16 | 03:59 | „the more you split up that knowledge, the more split brain problems you end up with where if you change something in one place and you forget to change it in all the others, everything falls apart." | ÜBERNOMMEN |
| P17 | 04:18 | „slop markdown plan files" veralten; „it's so easy to context yourself to hell". Zeitraum des Schadens genannt: „things that haven't been true for sometimes months or years even" (04:36). | ÜBERNOMMEN |

### 1.2 Was statt eines Index — und unter welcher Bedingung

| # | Zeit | Punkt | Status |
|---|---|---|---|
| P18 | 04:36 | Modelle erschließen Struktur und Stil aus ein, zwei Dateien. | ÜBERNOMMEN |
| **C1** | 04:36 | **Die Bedingung, die die Erstanalyse wegließ:** „…just based on reading one or two files **and if you have that in order** then you don't need an HSMD \[AGENTS.md] for it to follow your coding style". Der Verzicht auf eine Stil-Datei ist an die Konsistenz des Codes gebunden, nicht an die Fähigkeit des Modells. Ein inkonsistenter Codebase erklärt sich aus zwei Dateien **falsch**. | **NEU** |
| **C2** | 04:50 | Die Ordner-Karte („a list of folders and short descriptions") ist „easy to maintain **by the clanker itself**" — sie wird vom Agenten gepflegt, nicht von Hand. Die Erstanalyse (P18) las „billig zu pflegen"; die Zuständigkeit fehlte. | **NEU** |
| P19 | 04:50 | Alles oberhalb (Embeddings, RAG) sei Zeitverschwendung; keine eigene Evaluation genannt. | ÜBERNOMMEN |
| P23/P25 | 06:15, 07:25 | „if you just give it the tools it needs and bash, it can find what it needs relatively well" · wer stattdessen einen Graphen baut, ist „behind the curve now". | ÜBERNOMMEN |

### 1.3 Struktur als Fehlerursache

| # | Zeit | Punkt | Status |
|---|---|---|---|
| **C7** | 23:11 | Drei benannte Ursachen wiederkehrender Agentenfehler: Denkweisen-Unterschied · „**the codebase is architected in a way that's unintuitive for the agent**" · Kommunikationslücke. Die mittlere ist die klarheits-relevante: eine Regel, die man wiederholt schreiben muss, kann ein Struktur-Symptom sein. Die Erstanalyse faltete das in P68 („all of these different layers") ein und verlor die Aufzählung. | **NEU** |
| P75 | 25:17 | „my efforts to make codebases easier to contribute to for devs of all skill levels, I ended up inadvertently making them good for agents as well" — und: Typsicherheit „makes it much less likely that you **or a contributor** makes a mistake". Menschen-Lesbarkeit und Agenten-Lesbarkeit sind dieselbe Größe. | ÜBERNOMMEN |

### 1.4 Der AGENTS.md-Durchgang, klarheits-gelesen

| # | Zeit | Punkt | Status |
|---|---|---|---|
| **C3** | 32:28 | Das Qualitätskriterium, das er für seine Dateien beansprucht: „somebody has mentioned in chat that I have the **least generic** agent MD files". Spezifität, nicht Vollständigkeit. Die Erstanalyse zitierte den Halbsatz in ihrem Kandidaten K2 ohne Zeitmarke und ohne ihn als Punkt zu führen. | **NEU** |
| P96 | 32:44 | Aufbau: „I describe the pieces that matter first and foremost, **what it is**, and then **how it works**." | ÜBERNOMMEN |
| **C4** | 33:01 | **Was „how it works" bei ihm konkret ist:** EIN Mechanismus-Satz — „how the node websocket server wraps provider CLIs in order to serve the different platforms" — den er selbst als „a really simple concise way of saying all of the parts that matter" bezeichnet. Kein Verzeichnisbaum, keine Modulliste. Zusammen mit P112 („where code lives … probably the least useful thing within this") ist das seine Antwort auf die Strukturfrage: **ein Satz über den Mechanismus ersetzt die Karte über die Ablage.** | **NEU** |
| P99/P100 | 33:28, 33:47 | „what makes T3 code special" richtet Contributors UND ihre Agenten aus; der Wert „open at the core" schneidet eine ganze Vorschlagsklasse ab („This removed all of that", 34:16). | ÜBERNOMMEN |
| **C5** | 34:16 | Genauer als P101: der Wertsatz „performance without compromise" wirkte gegen **agenten-verursachte** Regressionen — „the regressions kept happening because of the agents. This reduced a lot of them **and then my CI cleaned up the rest**." Die Ordnung ist Wertsatz zuerst, CI danach; beide, nicht eines. | **NEU** |
| P106 | 35:35 | Glossar: gemeinsame Sprache, und gegen „Claude's thing where it just makes up these fancy terms". | ÜBERNOMMEN |
| P110/P111/P112 | 36:22, 36:40 | Verification-Abschnitt („not to run all these giant repo wide checks all the time unless it's asked") · PRs mit lesbaren Titeln · „a really brief where code lives. **Not that it actually matters.** Probably the least useful thing within this." | ÜBERNOMMEN |
| P114 | 36:54 | Taste: Komplexität an der Adapter-Boundary, dumme UI, einfache Orchestrierung; keine `any`, keine unnötigen Annotationen, inferiert bevorzugt; „Comments should describe how a thing is used and they should move when the code moves." | ÜBERNOMMEN |
| **C6** | 37:09 | Die zweite Hälfte der Kommentar-Regel, in der Erstanalyse abgeschnitten: „To be used mostly to describe **functions**, not to annotate every line of behavior." | **NEU** |

### 1.5 Zwei Negativbefunde — und was sie sperren

| # | Beleg | Befund | Status |
|---|---|---|---|
| **C8** | `grep -iE 'god file\|too (big\|large)\|thousand lines\|line count\|split (the\|a\|up) file\|smaller files\|monolith\|one file'` über das Transkript: **genau ein Treffer**, 14:59 — „god file cleanup refactors" als Aufzählungspunkt einer Memory-LISTE, keine Empfehlung. | **Das Video sagt zu Dateigröße nichts.** Weder für noch gegen große Dateien. | **NEU** |
| **C9** | `grep -iE 'name (it\|things)\|naming\|variable name\|function name'`: **null Treffer**. | **Das Video sagt zu Namensgebung nichts.** Das einzig Angrenzende ist P106 (Glossar gegen erfundene Begriffe) und P111 (lesbare PR-Titel). | **NEU** |

Konsequenz beider: Die Owner-Regel dieser Analyse lautet „keine Umbau-Empfehlung ohne Video-Beleg
UND Ist-Stand-Zitat". Für die Ein-Datei-Bauweise von `server.ts` und für Namenskonventionen gibt es
**keinen Video-Beleg** — in beide Richtungen nicht. Beide Fragen sind damit unten als
TRIFFT-NICHT geführt und stehen unter der Schnittlinie, nicht als Kandidat.

---

## 2. Mapping auf diesen Codebase

Ist-Stand-Zahlen dieser Lane (`fleet/260825204003-e600`, Basis `203e055`):
`server.ts` 21.432 Zeilen · `src/client.ts` 9.854 · `AGENTS.md` 15.507 B / 219 Zeilen ·
`CLAUDE.md` (Lane-Fassung) 32.490 B / 374 Zeilen · 34 Top-Level-`.ts` + 15 `.sh` · 10 Verzeichnisse ·
`docs/` 81 `.md` (58 mit Datum im Namen, 23 ohne).

### 2.1 P15/P16 — Kommentare und Verweise, die falsch steuern

**TRIFFT-UNS — und zwar gemessen, nicht vermutet.**

Der Kommentar-Stil selbst hält der Kritik stand:

- `server.ts`: 7.864 Kommentarzeilen auf 21.432 Zeilen (36,7 %). **161** davon tragen ein Datum
  (`2026-08-…`), 10 eine Commit-SHA. Ein datierter Kommentar ist eine Beobachtung mit
  Messzeitpunkt — er kann nicht still zur Gegenwartsbehauptung werden, wie P15 sie beschreibt.
  Beispiel `server.ts:428`: „Kept as an adapter rather than deleted: it works, no slot uses it
  (measured 2026-08-10)".
- Die Form, die bei P15 rottet — der Kommentar, der auf eine andere Stelle zeigt —, ist im Code
  fast abwesend: **3** Kommentarzeilen in `server.ts` tragen einen `datei.ts:zeile`-Verweis,
  175 nennen eine Datei ohne Zeile.
- `docs/rulebook-entwuerfe/geschmack.md` (heute geschrieben, unpromoviert) hat die Regel bereits
  abgeleitet: „Ein Kommentar erklärt den Mechanismus und seinen Preis, nie was die Zeile tut."
  Das ist eine Verschärfung von P114/C6, kein Widerspruch: C6 sagt „beschreibe Funktionen, nicht
  jede Zeile", `geschmack.md` sagt zusätzlich „nenne den Preis".

Die **Prosa** hält nicht stand. In `docs/*.md` stehen **1.083** `datei.ts:zeile`-Verweise
(766 verschiedene), **741** davon in `server.ts`. Probe: jedes Paar aus einem gebacktickten
Bezeichner und einem `server.ts:NNN` im selben Satz — trifft der Bezeichner ein Fenster von
±4 Zeilen um die genannte Zeile?

| | Paare | trifft | verfehlt |
|---|---|---|---|
| Dokumente **mit** Datum im Namen | 164 | 5 | **159 (96 %)** |
| Dokumente **ohne** Datum im Namen | 28 | 1 | **27 (96 %)** |

Der identische Prozentsatz in beiden Klassen ist die Signatur, vor der das Regelbuch warnt
(„derselbe Wert in der Zeile UND ihrer Gegenprobe") — deshalb vier Handproben gegen die Sonde:

| Behauptung | Fundstelle der Behauptung | IST | Abstand |
|---|---|---|---|
| `handleSelfSucceed`, `server.ts:4885-4921` | `docs/supervisor-succession.md:283` (Commit **2026-08-25**) | `server.ts:5826` | 941 Zeilen |
| `runVerify` … `server.ts:3247` | `docs/verify-tiering.md:201` | `server.ts:10906` | 7.659 Zeilen |
| `VERIFY_SKIP_EXIT`, `server.ts:10049` | `docs/acp-selfland-chain-parked-2026-08-23.md:58` | `server.ts:10769` | 720 Zeilen |
| `projDir`, `server.ts:361` | `docs/container.md:11` | `server.ts:3127` | 2.766 Zeilen |
| `laneWatchSignal`, `lane-signals.ts:92` | `docs/verify-tiering.md` | `lane-signals.ts:92` | **0 — trifft** |
| `VERIFY_CMD`, `watchdog.sh:91` | mehrfach | `watchdog.sh:91` | **0 — trifft** |

Die Sonde ist korrekt. Und die beiden Treffer nennen den Mechanismus: **Verweise in kleine Dateien
halten, Verweise in `server.ts` rotten.** Das ist nicht die Schuld der Prosa, es ist der Preis der
Ein-Datei-Bauweise — jede Einfügung oben verschiebt jede Zeilennummer darunter, und niemand merkt es.

Zwei Einordnungen, damit die Zahl nicht mehr behauptet als sie zeigt:

1. **Für datierte Dokumente ist das kein Rot.** `SYSTEM.md:231` sagt: „Datierten Analysen und Audits
   sind Snapshots mit Tree und Messzeitpunkt, keine laufend nachgeschriebene Systemwahrheit." Ein
   Snapshot darf auf den Baum zeigen, den er vermaß. Das Datum im Dateinamen leistet hier genau,
   wofür es da ist. Die 159 sind Beleg für die Wirksamkeit des Datums, nicht gegen sie.
2. **Für die 27 in undatierten Dokumenten ist es genau P15.** `docs/container.md`, `land-mechanics.md`,
   `queue-analyst.md`, `suite-contention.md`, `supervisor-succession.md`, `ungoverned-artifacts.md`,
   `verify-tiering.md`, `harness-adapter.md` behaupten Gegenwart und zeigen daneben.

**Selbstanwendung.** Die Erstanalyse, heute gelandet, zitiert `CLAUDE.md:193` für
„Treat HANDOFF.md/notes/memory as claims" und `CLAUDE.md:230` für die `rg`-Regel. In der Fassung
dieser Lane stehen sie auf **197** und **198**. `CLAUDE.md` ist ein Generat aus `rulebook/` — jede
Fragment-Änderung verschiebt alles darunter. Ein `CLAUDE.md:NNN` ist damit ein Verweis mit
eingebauter Verfallszeit; in `docs/` stehen 9 davon, dazu 38 `AGENTS.md:NNN`. Die Erstanalyse war
zum Zeitpunkt ihres Schreibens vermutlich richtig; falsch ist sie nach Stunden geworden. Das ist
P15 in seiner reinsten Form, an unserem eigenen Material.

### 2.2 P17 — die undatierten Dokumente, inhaltlich gestichprobt

**TRIFFT-UNS TEILWEISE — schwächer als die Zahl „23 undatierte" nahelegt.**

Die Erstanalyse maß 22 undatierte von 79 und prüfte sie ausdrücklich **nicht** inhaltlich (§5.3).
Neu gemessen: **23 von 81** (ein Dokument kam seither dazu). Die fünf ältesten, gelesen:

| Datei | letzter Commit | Gegenwarts-Behauptung? |
|---|---|---|
| `docs/lane-brief-template.md` | 2026-08-05 | **JA.** „the enhancer now runs in the analysis sweep (`tickAnalysisSweep`), the compiled brief is stored on the task (`Task.brief`)". Beides existiert weiter (`tickAnalysisSweep` 4×, `brief?: TaskBrief` in `server.ts:1952`) — die Behauptung hält, aber sie ist ungeschützt. |
| `docs/scope-inflation.md` | 2026-08-05 | **NEIN.** Kopf: „*Fallstudie und Ideensammlung, 2026-07-26 … Hier steht **nichts Gebautes***." Selbstdatiert im Text und ausdrücklich kein Zustandsbericht. |
| `docs/knowledge-currency.md` | 2026-08-07 | **NEIN.** Kopf: „*2026-07-27*", eine Argumentation über eine Owner-Frage. Entscheidungsprotokoll, kein Zustand. |
| `docs/land-mechanics.md` | 2026-08-07 | **TEILWEISE.** Kopf: „Everything below was measured on 2026-08-05" — selbstdatiert. Der Titel („what actually moves") und die Leseanweisung („Read before touching the land path") verkaufen es aber als lebende Anleitung. Zwei seiner Zeilenverweise zeigen falsch. |
| `docs/container.md` | 2026-08-08 | **JA.** Durchgehend Präsens, kein Datum im Text, zwei falsche Zeilenverweise (`projDir`, `ALLOWED_HOSTS`). |

**Befund: 2 von 5 rein, 1 gemischt, 2 selbstdatiert.** „Undatiert im Dateinamen" und „undatiert"
sind nicht dasselbe — drei der fünf tragen ihr Datum im ersten Absatz. Der Vorwurf aus P17 trifft
also nicht 23 Dokumente, sondern die Teilmenge, die Präsens ohne Datum spricht. Ein Sonderfall:
`docs/system-capabilities.generated.md` ist undatiert im Namen und **kann nicht rotten** — sie wird
von `capability-map.ts` erzeugt und von `e2e/pins.ts:694` byteweise gegen die Quelle gehalten.

### 2.3 P19/P23/P25 — graphify gegen Marios Anti-RAG

**HABEN-ANDERS-GELÖST — mit einer Korrektur an der Erstanalyse.**

Die Erstanalyse schrieb: „`graphify` existiert als **on-demand**-Werkzeug, nicht als stehender
Index". Der Startkontext-Teil stimmt: `CLAUDE.md:198` nennt `graphify` nur in der Zugriffsregel
(„deckt dieselbe Ebene ab, aber NUR im Haupt-Checkout"), keine Lane bekommt einen Index gereicht,
und der Zugriffsweg ist `rg`/`grep`/`ast-grep` — genau P23.

Der Ausgabe-Teil stimmt so nicht. Gemessen (nur gelesen, Haupt-Checkout, nichts angefasst):
`/Users/owner/claude-fleet/graphify-out` = **96 MB in 21 datierten Snapshot-Verzeichnissen**
(`2026-08-04` … `2026-08-25`). Das ist ein persistierender, täglich fortgeschriebener Index-Bestand,
kein flüchtiges Werkzeug-Ergebnis. Was ihn von Marios Zielscheibe trennt, ist **wohin er zeigt**:
in keinen Agenten-Startkontext. Er ist ein Ablage-Bestand ohne Leser-Zwang, nicht eine
Kontextquelle. Der Vorentscheid „Memory-Layer indexless" bleibt damit unberührt — aber die
Formulierung „kein stehender Index" ist zu stark und sollte nicht weiterzitiert werden.

### 2.4 P18/C2/C4/P112 — haben wir eine Ordner-Karte, und fehlt sie messbar?

**TRIFFT-UNS.**

Was wir haben, deckt C4 (der Mechanismus-Satz) sehr gut ab:

- `SYSTEM.md` ist genau P96s Bauform: „`SYSTEM.md` ist die kurze mentale Karte des Produkts"
  (`SYSTEM.md:8`), Produktversprechen → Rollenmodell → Kernobjekte → Lebenszyklus. Und
  `SYSTEM.md:10` weist die Ablage-Karte ausdrücklich ab: „Routen, Harness-Matrizen und
  Featureinventare gehören nicht handgepflegt hierher, sondern später in eine aus Code
  generierte Capability-Sicht." Das ist P112, unabhängig zur selben Antwort gekommen.
- `README.md:41` „Architecture — tmux without attach, ×16" leistet den Mechanismus-Satz für den
  Server: Socket, `pipe-pane` → `streams/sN.raw`, Bun-Server tailt, Broadcast per Slot.
- `AGENTS.md` hat **keinen** „where code lives"-Abschnitt (`grep` über alle Überschriften: kein
  Treffer) — konsistent mit P112.
- Die Capability-Ebene ist bereits generiert und gepinnt: `capability-map.ts` → 142 Zeilen
  `docs/system-capabilities.generated.md`, gehalten von `e2e/pins.ts:694` („the generated system
  capability map is byte-for-byte fresh from capability-map.ts"). Das ist C2 in strenger Form —
  gepflegt von der Maschine, nicht vom Menschen, und mit einer Sonde, die das Nachlassen bemerkt.

Was fehlt, ist P18s billige Hälfte: die Liste der **Verzeichnisse** mit einem Satz. Gemessen —
in wie vielen Dokumenten (`docs/*.md` + README + SYSTEM + AGENTS + CLAUDE) taucht jedes der
zehn Top-Level-Verzeichnisse überhaupt auf?

```
 66 docs/      52 e2e/       46 src/       15 briefs/     7 studio-kit/
  7 public/     3 drills/     3 arbeitskreis-atlas/   2 commands/   1 lerntisch/
```

**Kein einziges Dokument nennt alle zehn** — und keine der vier Startkontext-Dateien
(`README.md`, `SYSTEM.md`, `AGENTS.md`, `CLAUDE.md`) erwähnt `lerntisch/` oder `studio-kit/`
überhaupt. Auf Dateiebene dasselbe Bild: von 34 Top-Level-`.ts` werden **`acceptance-probe.ts`
und `task-waves.ts` in null Prosa-Dokumenten genannt**, `composer.ts`, `task-metadata.ts` und
`task-analysis-warning.ts` in je einem.

Das ist die messbare Lücke: ein frischer Agent findet über `rg` jede Datei, die er **benennen**
kann — aber `lerntisch/` und `task-waves.ts` kann er nicht benennen, weil ihn nichts auf ihre
Existenz stößt. P23 („bash findet, was es braucht") setzt voraus, dass man weiß, wonach man sucht.

### 2.5 C1 — die Bedingung „if you have that in order"

**TRIFFT-UNS, und sie ist erfüllbar geprüft.**

C1 sagt: der Verzicht auf eine Stil-Datei setzt voraus, dass zwei gelesene Dateien den Stil
korrekt lehren. Für diesen Codebase ist das jetzt belegbar, weil `docs/rulebook-entwuerfe/geschmack.md`
den Stil **aus dem Code abgeleitet** hat, statt ihn zu erfinden — jede seiner 15 Regeln nennt ihre
Fundstelle (`server.ts:1-5`, `e2e/harness.ts:66`, `verify-proportion.ts:16`, `lane-signals.ts:61`).
Ein Stil, der sich aus dem Code ableiten ließ, ist per Konstruktion einer, den ein Modell aus dem
Code lesen kann. C1 ist damit für uns eher bestätigt als bedroht — mit einer Einschränkung: der
Entwurf sagt „`server.ts` hat 21 405 Zeilen", gemessen sind es heute **21 432**. Eine
Gegenwartszahl in einem undatierten Dokument, 27 Zeilen alt am ersten Tag.

### 2.6 C7 — Regeln, die ein Struktur-Symptom sind

**TRIFFT-UNS, ungekostet.**

C7 nennt „architected in a way that's unintuitive for the agent" als eigenständige Ursache.
Mehrere unserer dauerhaften Regeln haben genau diese Form — sie beschreiben eine Falle, die aus
der Ablage folgt, nicht aus dem Verhalten des Agenten:

- `CLAUDE.md:198`: „`rg` respektiert `.gitignore` — und gitignored sind hier ausgerechnet
  `CLAUDE.md`, `fleet.json`, die drei Ledger und `.env`. Ein `rg` darüber liefert kein
  Fehlerergebnis, sondern ein LEERES — und leer liest sich wie ‚gibt es nicht'."
- `CLAUDE.md:191`: „`CLAUDE.md` ist gitignored und wird beim Lane-Spawn nur KOPIERT" — eine Lane
  sieht ihre eigene Regelbuch-Änderung nie in `git status`.

Auf Laurens Leiter (P72–P89) sind beide Stufe 3 (Regel), obwohl die Ursache auf Stufe 1 liegt
(was gitignored ist). Ob ein Umbau dort billiger wäre als die Regel, ist **nicht gemessen** — die
Kosten (die Ledger sind bewusst untracked) sind hier nicht bewertet. Deshalb steht das unten unter
der Schnittlinie und nicht als Kandidat.

### 2.7 Restliche Punkte, kurz

| Punkt | Verdikt | Beleg |
|---|---|---|
| P14 (Code ist Ground Truth) | **HABEN-ANDERS-GELÖST** | `CLAUDE.md:14`: „Für Fakten gewinnen aktueller Code und Live-Sensoren vor Prosa … Bei Doc-vs-Code-Widerspruch gilt der Code." Steht als harte Invariante über jedem Absatz des Regelbuchs. |
| P16 (Split-Brain) | **HABEN-ANDERS-GELÖST, maschinell** | `e2e/pins.ts` ist die erste Stufe des Land-Gates und hält **251** Pins; `RULE_VERIFY` vergleicht die Ordnung der Verify-Kette über `watchdog.sh`, `AGENTS.md` und `verify-proportion.ts`. Split-Brain wird hier nicht vermieden, sondern erkannt. |
| C3 (least generic) | **HABEN-ANDERS-GELÖST** | `AGENTS.md` hat keinen generischen Abschnitt; jede Invariante nennt ihren Gegenstand. Die Erstanalyse hat für den **Code-Geschmack** die Lücke benannt — sie ist seither als `docs/rulebook-entwuerfe/geschmack.md` geschlossen worden, unpromoviert. |
| C5 (Wertsatz + CI, beides) | **HABEN-ANDERS-GELÖST** | `AGENTS.md:24` trägt die Werte („never trades away owner promotion, isolated production, observations before claims, explicit `unknown`…"), das Land-Gate trägt die CI-Hälfte. Beide Hälften vorhanden. |
| C6 (Kommentare beschreiben Funktionen) | **HABEN-ANDERS-GELÖST, strenger** | `geschmack.md`: „Ein Kommentar erklärt den Mechanismus und seinen Preis, nie was die Zeile tut", Beleg `e2e/harness.ts:98-101`. 36,7 % Kommentaranteil in `server.ts` — ob der Anteil zu C6 („nicht jede Zeile annotieren") passt, ist **nicht gemessen**: gezählt wurden Zeilen, nicht Kommentarsorten. |
| P106 (Glossar) | **HABEN-ANDERS-GELÖST** | `AGENTS.md:30` „Shared vocabulary" trennt Akte statt Begriffe zu erklären: „**Verify** proves a tree; **commit** records it; **land** promotes it server-side; **deploy** updates a running instance; **audit** measures a landed tree." |
| P110 (keine repoweiten Checks) | **HABEN-ANDERS-GELÖST, als Route** | `GET /api/self/gate` → `localProof.steps`, Mapper `verify-proportion.ts`. Bitte bei ihm, Messung bei uns. |
| **C8 (Dateigröße)** | **TRIFFT-NICHT** | Kein Video-Beleg in beide Richtungen (1 Treffer, eine Memory-Liste). Die Ein-Datei-Bauweise ist hier weder gestützt noch angegriffen. `geschmack.md` beantwortet die Frage bereits repo-intern („Eine Datei darf groß sein; sie darf nicht unehrlich sein") — das bleibt unberührt. **Die einzige video-belegbare Aussage über `server.ts` ist indirekt: 741 Zeilenverweise hinein, 96 % daneben** (§2.1). |
| **C9 (Namensgebung)** | **TRIFFT-NICHT** | Null Transkript-Treffer. `geschmack.md` („Ein Name trägt seine Unsicherheit mit") steht ohne Video-Bezug — weder bestätigt noch bestritten. |
| P115 (Reifegrad-Test) | **TRIFFT-NICHT** | Wie in der Erstanalyse: subjektiv, kein Verifikationsweg. |

---

## 3. Kandidaten

**Zwei**, nicht drei. Die Vorgabe lautete „MAXIMAL 3 Kandidaten MIT Schnittlinie"; der dritte Platz
wird nicht gefüllt, weil kein weiterer Punkt beide Bedingungen erfüllt (Video-Beleg UND
Ist-Stand-Zitat UND eine Kostenaussage). `docs/scope-inflation.md` §7: die Rangliste dort
abschneiden, wo sie erfüllt ist.

### K1 — Zeilenverweise in undatierten Dokumenten durch Symbolverweise ersetzen

- **Video-Beleg:** P15 (03:43) „It's now actively harmful because it steers people and agents the
  wrong way" · P16 (03:59) „if you change something in one place and you forget to change it in all
  the others".
- **Ist-Stand:** 1.083 `datei:zeile`-Verweise in `docs/`, 741 davon in `server.ts`. Von 28 prüfbaren
  Bezeichner-Zeile-Paaren in **undatierten** Dokumenten verfehlen **27** ihr Ziel (§2.1), darunter
  vier handgeprüfte mit Abständen von 720 bis 7.659 Zeilen. Ein Fall stammt aus einem Dokument mit
  Commit von heute (`docs/supervisor-succession.md:283`).
- **Die Form, die nicht rottet, existiert bereits im Repo:**
  `docs/system-capabilities.generated.md:7` zitiert seine Quellen als
  „`capability-map.ts#SYSTEM_CAPABILITIES`, `src/protocol.ts#SystemCapability`" — Datei plus
  Symbol, kein Zeilenzahl. Ein `server.ts#handleSelfSucceed` überlebt jede Einfügung und ist mit
  `grep` in einem Schritt auflösbar. Der Umbau ist eine Schreibkonvention, kein Mechanismus.
- **Kosten des Nichtstuns:** Jeder Verweis, der danebenzeigt, kostet einen Agenten einen
  Fehlschlag-Lesevorgang und riskiert eine falsche Aussage über Code, den er nicht gelesen hat.
  Das ist genau die Klasse, die `~/.claude/CLAUDE.md` verbietet („Never characterize code you
  haven't read").
- **Was zuerst zu klären ist:** Ob die Konvention nur für **undatierte** Dokumente gelten soll.
  Für datierte Snapshots ist der Zeilenverweis korrekt (er zeigt auf den vermessenen Baum) und ein
  Umbau wäre Geschichtsfälschung. Die 159 Fehlschüsse in datierten Dokumenten sind ausdrücklich
  **kein** Ziel dieses Kandidaten.

### K2 — Eine generierte Verzeichnis- und Dateikarte, gepinnt wie die Capability-Karte

- **Video-Beleg:** P18 (04:36) „you might give it a map of where things are which is just a list of
  folders and short descriptions that's fine" · C2 (04:50) „easy to maintain **by the clanker
  itself**" · gegen P112 (36:40) „where code lives … the least useful thing" abgegrenzt: die Karte
  ersetzt nicht C4s Mechanismus-Satz, sie steht neben ihm.
- **Ist-Stand:** Kein Dokument nennt alle zehn Top-Level-Verzeichnisse; `lerntisch/` steht in einem
  einzigen, `commands/` in zwei, und keine der vier Startkontext-Dateien nennt `lerntisch/` oder
  `studio-kit/`. Von 34 Top-Level-`.ts` stehen `acceptance-probe.ts` und `task-waves.ts` in null
  Prosa-Dokumenten (§2.4).
- **Warum generiert und nicht geschrieben:** `SYSTEM.md:10` verbietet die handgepflegte Variante
  ausdrücklich („gehören nicht handgepflegt hierher, sondern … in eine aus Code generierte
  Capability-Sicht"). Eine handgeschriebene Karte wäre dieselbe Klasse Artefakt, die K1 gerade
  ausräumt. Die Bauform steht fertig daneben: `capability-map.ts` rendert
  `docs/system-capabilities.generated.md`, `e2e/pins.ts:694` hält es byteweise. Eine zweite
  Renderer-Funktion desselben Zuschnitts wäre die kleinste Fassung — die Kurzbeschreibungen kämen
  aus der ersten Kommentarzeile jeder Datei, die in diesem Repo bereits durchgängig existiert
  (`capability-map.ts:1`, `rulebook.ts:10-11`).
- **Kosten des Nichtstuns:** P23 („bash findet, was es braucht") setzt voraus, dass man weiß, wonach
  man sucht. Zwei Top-Level-Module und zwei Verzeichnisse sind heute nur durch `ls` auffindbar —
  also nur von jemandem, der bereits vermutet, dass dort etwas ist.
- **Was zuerst zu klären ist:** Ob die Karte in den **Startkontext** soll oder nur in `docs/`.
  Im Startkontext kostet sie Bytes in jeder Session (`docs/kontextlast-architektur-2026-08-19.md`
  ist genau deshalb geschrieben worden); in `docs/` findet sie nur, wer schon sucht. Das ist eine
  Owner-Entscheidung, keine Ableitung.

### ── Schnittlinie ──

**Darunter bewusst nicht**, jeweils mit Grund:

1. **`server.ts` aufteilen (C8).** Kein Video-Beleg — das Transkript sagt zu Dateigröße nichts
   (1 Treffer, eine Memory-Liste). Die Regel dieser Analyse verbietet die Empfehlung ohne Beleg.
   Der gemessene Preis der Ein-Datei-Bauweise (§2.1: Verweise hinein rotten, Verweise in kleine
   Dateien halten) wird von K1 an der Prosa-Seite behoben, ohne den Code anzufassen — das ist die
   billigere Hälfte derselben Wirkung.
2. **Namenskonventionen (C9).** Null Transkript-Treffer. `geschmack.md` hat dazu bereits eine
   abgeleitete Regel; sie braucht dieses Video nicht.
3. **`geschmack.md` promoten.** Ist bereits der Kandidat K2 der Erstanalyse und seither zum Entwurf
   gereift. Diese Passe fügt nur zwei Belegzeilen hinzu (C6, C3) und keine neue Entscheidung — sie
   erneut als Kandidaten zu führen wäre dieselbe Empfehlung zweimal gezählt.
4. **Die gitignore-Fallen strukturell auflösen (C7).** Video-Beleg vorhanden (23:11) und Ist-Stand
   zitierbar (`CLAUDE.md:191`, `:198`), aber die Kosten sind **nicht gemessen**: die Ledger sind
   bewusst untracked, und was ihr Tracking im Land-Pfad kostet, hat diese Lane nicht geprüft. Ein
   Kandidat ohne Kostenaussage ist eine Portfolio-Zeile.
5. **Die 159 falschen Zeilenverweise in datierten Dokumenten reparieren.** Sie sind korrekt —
   ein Snapshot zeigt auf den Baum, den er vermaß (`SYSTEM.md:231`).
6. **Kommentaranteil in `server.ts` (36,7 %) gegen C6 prüfen.** Gezählt sind Zeilen, nicht
   Kommentarsorten; ohne diese Trennung ist jede Aussage dazu eine Vermutung.

---

## 4. Was nicht gemessen wurde

- **Die 96-%-Sonde prüft Position, nicht Wahrheit.** Sie fragt „steht der Bezeichner innerhalb von
  ±4 Zeilen?" — nicht, ob die inhaltliche Aussage des Satzes noch stimmt. Bei den vier Handproben
  stimmte der Sachverhalt jeweils weiter, nur der Zeiger nicht. Ob es Sätze gibt, deren **Inhalt**
  falsch geworden ist, wurde nicht geprüft.
- **Nur `server.ts`-Verweise wurden vermessen.** Die 342 Verweise in andere Dateien
  (1.083 − 741) sind ungeprüft; die zwei Stichproben (`watchdog.sh:91`, `lane-signals.ts:92`)
  trafen beide, was eine Vermutung stützt, aber keine Messung ist.
- **Nur 5 der 23 undatierten Dokumente wurden gelesen** (die ältesten nach letztem Commit). Die
  übrigen 18 sind nicht inhaltlich beurteilt.
- **Ob eine Ordner-Karte einem frischen Agenten wirklich hilft**, ist nicht experimentell geprüft.
  Gemessen ist nur die Abwesenheit (§2.4) und der Mechanismus, der die Abwesenheit teuer macht
  (P23 setzt Benennbarkeit voraus).
- **`graphify-out` wurde nur gelistet, nie geöffnet.** Ob und wodurch die 21 Snapshots erzeugt
  werden (Cron, Hand, Skill), ist nicht nachgesehen — das läge außerhalb dieses Repos.
- **Das Video wurde nicht angesehen**, nur sein Auto-Transkript gelesen. Was er auf dem Bildschirm
  zeigt und nicht ausspricht (die AGENTS.md selbst, ihre Länge, ihre Abschnittsreihenfolge), ist
  hier nur so weit erfasst, wie er es vorliest. Das betrifft diese Passe stärker als die
  Erstanalyse: eine Analyse über Codebase-Klarheit hätte von der gezeigten Datei am meisten gehabt.

## 5. Methode

Transkript nach dem Rezept der Erstanalyse (§5.1) neu gezogen; Gegenprobe der Vergleichbarkeit:
1.130 Cues / 142 Blöcke in beiden Passen. Alle in §1 zitierten Sätze stammen wörtlich aus
`transcript.en-orig.srt`; die Negativbefunde C8/C9 sind `grep`-Ergebnisse über dieselbe Datei und
im Text mit ihrem Muster genannt. Transkript blieb im Scratchpad, nicht im Repo.

Repo-Messungen: `wc -l`, `grep -c`, `ls`, `git log -1 --format=%ad` sowie eine Python-Sonde für die
Bezeichner-Zeile-Paare (Muster: gebacktickter Bezeichner, höchstens 40 Zeichen ohne Backtick,
dann `` `server.ts:NNN` ``; Treffer = Bezeichner-Stamm im Fenster ±4 Zeilen). Die Sonde wurde gegen
vier Handproben gestellt, weil ihr identischer Prozentsatz in beiden Klassen die vom Regelbuch
benannte „nie gemessen"-Signatur trägt; sie hielt in allen vier Fällen.

**Eigenprobe.** Die 14 `datei:zeile`-Verweise dieses Dokuments wurden vor dem Commit einzeln gegen
den Baum gestellt. **Drei waren falsch** — `SYSTEM.md:232` statt `:231`, `CLAUDE.md:190` statt
`:191`, `CLAUDE.md:9` statt `:14` — und zwar in einem Dokument, das an diesem Tag geschrieben wurde
und dessen Gegenstand genau dieser Fehler ist. Sie sind oben korrigiert. Das ist der stärkste
verfügbare Beleg für K1: die Fehlerquote entsteht nicht durch Alterung allein, sondern schon beim
Schreiben, und nur eine Gegenprobe fängt sie. Die verbleibenden elf trafen. Ein Symbolverweis
(`SYSTEM.md#Wissensordnung`) hätte in allen drei Fällen ohne Gegenprobe gestimmt.

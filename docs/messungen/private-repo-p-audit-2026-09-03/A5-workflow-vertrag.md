# Strang A5 — Der iOS-Workflow selbst, kritisch gelesen

Stand 2026-09-03. Gegenstand: Program `07ee8a6dee2b36d11203db2b` (Private-repo-y), Repo
`/Users/owner/private-repo-p` @ `5ecc505`. Ebene: Design des Workflows, nicht Transkripte.

## Vergleichsbasis — was der Lauf geleistet hat

In ~22 h Wanduhr (09-01 21:47 → 09-02 20:00) und 8,6 h summierter Lane-Zeit
(`ios-lane-outcomes.jsonl`, 13 Zeilen) entstand aus einer Produkt-Card eine native SwiftUI-App
mit 19 Swift-Dateien, ein geschlossenes JSON-Schema mit deterministischer Ablehnungsordnung,
33+ Negativ-Fixtures, 53 Unit- / 5 UI- / 59 Package-Tests, drei wörtliche Maschinen-Tails und
**zwei unabhängige Cross-Model-Reviews, die beide FAIL sagten und deren Findings die MAIN am Code
gegenprüfte, bevor sie sie annahm** (`HANDOFF.md#Open work` Punkt 3). Alle 9 Produkt-Commits kamen
aus Lanes über die Fleet-Task-Rails; kein Schatten-Worktree (K10 nicht wiederholt). Die Briefs 1,
5, 7, 9 sind fachlich unter den schärfsten, die ich in diesem Fleet gesehen habe: Schreibfläche,
Lese-Liste, Negativmatrix, Verify-Kommando, Berichtsform und ein „ein Test, den du nicht brechen
kannst, ist kein Beleg" stehen wörtlich drin (`ios-tasks.md:43-66, 228-256, 316-332`). Die
Kritik unten betrifft **nicht** die Bauqualität.

## 1. Was IST der iOS-Workflow — und wo ist er als Ganzes benannt?

| Artefakt | Wer sah es | Belegstelle |
|---|---|---|
| Servergebauter Rail-Brief (Program-JSON + „HOW THIS PROGRAM IS EXECUTED", 112 Z.) | nur MAIN N0/N1 (Gründung) bzw. N1.5/N2 (Nachfolge-Fassung, +3 Z. carry) | `founding-brief-…txt`, `succession-brief-…txt` |
| Program-Record (intent/successCriterion/nonGoals/decisions/openQuestions) | MAIN wörtlich im Brief; Lanes nur als 1-Satz-Zusammenfassung | `ios-programs.json` |
| `AGENTS.md` (19 Zeilen) | MAIN + jede Lane (Brief verlangt „read in full") | `private-repo-p/AGENTS.md` |
| `docs/PRODUCT.md` (396 Z., Product Card) | MAIN + jede Lane, abschnittsweise benannt | `private-repo-p/docs/PRODUCT.md` |
| `docs/PROOF.md`, `scripts/verify.sh` | Lanes | Repo |
| `HANDOFF.md` | nur MAIN-Nachfolge | Repo |
| Fleet-Regelbuch (`CLAUDE.md`/`AGENTS.md` in claude-fleet) | Lanes über den Worktree-Snapshot | claude-fleet |
| **`product-studio-working-circle.md`** (Working Circle, Anti-Slop, pre-owner-loop, sensory Critic) | **NIEMAND** | 0 Treffer, siehe unten |
| **`attic/private-repo-p-sol-research-2026-08-23.md` §5 (das Private-repo-p-Profil)** | teilweise, über Private-repo-x-Erbe | am 09-01 00:18 nach `attic/` verschoben (`ff5b813`) |

**Verifiziert:** `grep -ric 'working.circle|product-studio'` über beide Rail-Briefe, `ios-tasks.md`
(alle 24 Zeilen), `AGENTS.md` und `docs/PRODUCT.md` ergibt **0** in jeder Datei. Der Studio-Vertrag
hat den Lauf nirgends berührt.

**Eine Stelle, an der „Workflow" benannt/versioniert/konfigurierbar wäre, existiert nicht.**
Der Server hat das Feld dafür: `Program.profile` (`server/types.ts:1102`), geschrieben von genau
einer Route. Aber `ProgramProfileKind = "game-maker"` ist der **einzige** erlaubte Wert
(`server/types.ts:1172-1174`), und alle drei iOS-Programs tragen `profile: null`
(`ios-programs.json`). Ein Private-repo-p-Profil gibt es als Objekt nicht — nur als Prosa, verteilt
über sieben Dokumente, von denen zwei niemand las. Für die Owner-Idee „Idee → Workflow → Sessions"
fehlt damit die mittlere Ebene komplett; die untere übrigens auch: `Program.lineage` führt nur
MAIN-Autorität, und selbst dort fehlt MAIN N1 (`0def056c`) — die Kette beginnt erst bei N1.5
(`ios-programs.json#lineage`, zwei Einträge, erster `via: backfill-unknown`).

## 2. Design-Defekte des START-Workflows

### 2a. Kein Augenpaar mit fremder Wahrnehmung — dieselbe Wurzel 1 wie Private-repo-o

`grep -i 'critic|sensory|taste|usability|Geschmack'` über **alle 24 Brief-/Notiz-Zeilen**
(`ios-tasks.md`) → **0 Treffer**. Über `docs/PRODUCT.md` → 0. Über `AGENTS.md` → 1, und die sagt
nur, Critic-Verdikte seien als Record *getrennt zu halten*, nicht dass eines zu erzeugen sei.
Der „independent-codex-review" ist per Brief-Text zehn Code-/Vertrags-Invarianten mit `file:line`
(Grep nach `WKWebView`, `URLSession`, Fixture-Pfade — `ios-tasks.md:228-256`): ein Code-Review,
kein Nutzungsurteil. Das Owner-Video war eine Aufzeichnung der fünf XCUITests, also genau der
Frames, die das Gate ohnehin behauptet (`HANDOFF.md#Owner touchpoint`: „Recording the existing UI
suite is the cheapest honest product tour"). **Der Owner hat die App nie bedient** — und
`scripts/review.sh` (das genau dafür existiert, seit Private-repo-x, mit Blank-Frame-Erkennung über
`image-has-content.swift`) wurde in keinem Brief und in keiner Attention aufgerufen.
Kosten im Lauf: das einzige Produkturteil über 22 h stammte vom bauenden System selbst; das
Owner-Urteil („recht weit unter dem was möglich wäre") ist der erste fremde Blick, wie bei
Private-repo-o. Kosten beim nächsten Lauf: identisch, denn nichts im Rail verlangt einen Critic.

### 2b. Der successCriterion enthält drei Klauseln, die er strukturell nicht erfüllen kann

1. **Kosten/Token ohne Provider.** Er verlangt „Tokenverbrauch und Kosten für Orientierung,
   Erstellung, Probelauf und Reparatur" und „Erst diese Messung entscheidet, ob 2,99 Euro drei
   oder fünf … tragen". `nonGoals` und `openQuestions[5]` verbieten jede Credential und jeden
   Live-Providerlauf. Ergebnis war zwangsläufig: Brief 4 landete mit „price decision undecidable"
   (`HANDOFF.md`, Zeile zu `466f318`). Eine Messgröße, die im eigenen Nichtziel liegt, wird zu
   Buchhaltung über `unknown`.
2. **„Post-Land-Audit sind grün".** Für private-repo-p ist der Tier-2-Audit konstruktionsbedingt der
   Fleet-Guard und endet immer `unknown` (9/9, `HANDOFF.md#Fleet facts`: „always reports unknown
   here"). Die Klausel kann nie wahr werden. Das ist Private-repo-o-Wurzel 3 wörtlich, und V6 ist bis
   heute nicht gelandet.
3. **Computer-Use-Worker als Erfolgsbedingung, während dieselbe Fähigkeit noch `openQuestion` ist.**
   `successCriterion` verlangt den Codex-Drive im Simulator; `openQuestions[4]` fragt „Kann eine
   Fleet-Codex-Lane das zuverlässig … ? **Vor Produktimplementation messen**." Gemessen wurde nie;
   implementiert wurden Briefs 1–7; Brief 8 existiert als Notiz `f39265ee`, nie gefilet.
   Die eigene Reihenfolgevorgabe des Programs wurde am ersten Tag verletzt.

### 2c. Ein hartes Tor wurde erklärt und still fallengelassen (K1)

Product Card und Program sagen: die First-Slice-Briefs „dürfen wegen des roten
Fleet-Post-land-Audits auf MAIN `bc9e7de` **erst nach dessen Owner-bestätigter Auflösung** als
Build- oder Release-Arbeit gestartet werden" (`docs/PRODUCT.md:269-271`). `bc9e7de` kommt im
gesamten iOS-Repo **genau einmal** vor — in dieser Zeile. Keine Attention, kein Commit, kein
HANDOFF-Absatz löst es auf; Brief 1 wurde 09-01 22:12 gefilet. Kosten: keine im Lauf (das Tor war
sachlich irrelevant), aber der Mechanismus ist teuer — eine Stop-Bedingung im owner-bestätigten
Vertrag verfällt geräuschlos, und niemand merkt es. Genau K1.

### 2d. Der successCriterion belohnt Schema-Theater

Die vier verbindlichen Gates sind vier wörtliche Tails (`ALL-PASS repository`,
`schema-negative`, `unit-ui-accessibility`, `independent-codex-review`,
`docs/PRODUCT.md:340-355`). Alle vier messen Vertragstreue gegen ein **selbstdeklariertes**
Universum. Die Card sagt selbst: „Simulator-Playability braucht zusätzlich den frischen
beobachteten Lauf; die vier Tails allein beweisen keine Nutzbarkeit" — und definiert dann kein
einziges Kriterium für diesen Lauf, keinen Beobachter, keine erste nutzbare Minute, keine Bar für
Aussehen, Verständlichkeit oder Tempo. Die fünf Golden Cases sind fünf Fixture-Fälle, geschrieben
vom selben Erzeuger, den sie prüfen. Dass das ein Orakel-Echo ist, hat nicht der Workflow gefunden,
sondern der fremde Reviewer: Finding 2 lautet, `DemoRun.runCase` schalte auf
`testCase.expectedOutcome.status`, weshalb `statusMatches` für Stop-/Eskalations-Fälle **nicht
fehlschlagen kann** (`HANDOFF.md#Open work` 3). Das ist K7 in Reinform, produziert vom
Erfolgsmaß selbst.

### 2e. Zu früh eingefrorene Owner-Entscheide

`nonGoals` friert „kein Providerkonto, keine Credential" ein — für ein Produkt, dessen Kern
„Private-repo-y" heißt. Damit ist die einzige Klasse von Beweisen ausgeschlossen, die zeigen würde,
ob der WorkflowPack in ChatGPT/Claude *tut, was er verspricht*; der „erste reale Zielsystem-Test"
des Produktversprechens bleibt Prosa in der Card. Der Owner wurde dazu nie gefragt: alle 10
Attentions sind Fleet-Mechanik (Hand-Dispatch, Verify-Budget, Hostlast) — **null Produkt- oder
Geschmacksfrage** (`ios-attention.json`). Private-repo-o hatte 4:1; iOS hat 10:0.

## 3. CONTINUE-Workflow — er existiert nicht. Der Owner hat recht.

**Verifiziert:**
- Private-repo-x endete am 08-24 21:55 (`ed42a7d`, letzter Produkt-Commit). Sein eigener HANDOFF sagt
  dort: „Fresh critic verdict and owner review remain separate future records; **neither exists
  yet**" (`git show ed42a7d:HANDOFF.md:28`), und die „Exact next action" (`make verify` nach der
  Xcode-Installation) steht unerledigt.
- Das Program `69305ad8` wurde trotzdem am **08-30 15:27** `complete` gesetzt — sechs Tage nach dem
  letzten Commit, ohne einen weiteren. Sein `successCriterion` („der Owner kann den
  First-Minute-Check abschließen, `make verify` besteht") ist an keiner Stelle erfüllt belegt; sein
  `openQuestion` „Does the first runnable flow feel useful and clear to the owner?" ist unbeantwortet.
- Am 09-02 06:29 ersetzte `30def00` („replace the Private-repo-x handoff with the Private-repo-y slice
  state", −117/+49 Zeilen) das Erbe; `docs/PRODUCT.md:364` führt Private-repo-x als „obsoleter, nicht
  mehr aktiver Vertrag". `scripts/verify.sh` fährt nur noch `-scheme Private-repo-y`; die
  Private-repo-x-Quellen liegen ungeprüft im Baum, das Projekt heißt weiter `Private-repo-x.xcodeproj`.

Es gibt also **keinen zweiten Iterationszug**: eine App wurde nicht weitergebaut, sie wurde
ersetzt. Das verletzt den einzigen Satz, den der Studio-Vertrag dazu hat: „Changing direction must
preserve reusable code, assets, decisions and lessons rather than resetting the studio to zero"
(`product-studio-working-circle.md:897-899`) — den niemand las.

**Was faktisch übertrug** (und das ist echt): der Beweis-Apparat. `scripts/verify.sh`,
`check-repo.sh`, `review.sh`, das Simulator-Lease, `image-has-content.swift`, die
Flake-Gegenmittel — alles Private-repo-x-Erbe, in Private-repo-y weiterentwickelt.
**Was nicht übertrug:** Produktwissen, Nutzerurteil, Geschmack (es gab keines), und die
Gate-/Flake-Tabelle nur über die Prosa in `HANDOFF.md`. Ein Mechanismus dafür existiert nicht:
`HANDOFF.md` wird bei jedem Programmwechsel überschrieben, `Program.lineage` trägt nur
MAIN-Autorität, und die 24 Brieftexte sind für die MAIN selbst nicht mehr lesbar
(`HANDOFF.md`: „GET /api/self/tasks is unauthorized for the MAIN token; brief texts live only in
the Fleet rows"). Eine zweite Private-repo-y-Iteration müsste heute als **neues Program im selben
Repo** gegründet werden und würde am `Private-repo-x.xcodeproj`/`Package.swift` mit jeder
Parallel-App kollidieren — genau die Kollision, die der Portfolio-Plan für Private-repo-z nennt.

## 4. Wiederholungs-Matrix Private-repo-o → iOS

Spalte (b): war der Vorschlag am 2026-09-01 21:44 gelandet **und** normativ?

| # | (a) im iOS-Lauf wiederholt | Beleg | (b) Stand 09-01 21:44 |
|---|---|---|---|
| Wurzel 1 Wahrnehmungs-Monopol | **JA, schärfer** (0 Critic-Treffer in 24 Briefs, Owner sah ein Testvideo) | `ios-tasks.md` grep | — |
| Wurzel 2 52 % Türen/Timer | **JA, andere Tür**: Master-Stop statt Quiet Hours; Brief 7 saß 2,5 h queued, 8 von 10 Attentions sind Hand-Dispatch-Bitten | `HANDOFF.md#Open work` 3, `ios-attention.json` | — |
| Wurzel 3 Verify/Audit am Fleet-Schlüssel | **teilweise**: Verify-Eintrag existierte (repariert), Audit 9/9 `unknown` | `HANDOFF.md#Fleet facts` | V6 nicht gelandet |
| V1 Konventions-Pin | n/a (kein Steuerungsvertrag), Analogon fehlt: kein Pin auf Bildschirm-/Nutzungs-Aussagen | — | gelandet `75b2110`, **game-maker-scoped** |
| V2 Critic vor Taste | **JA wiederholt** — Regel existiert, gilt aber nur für Game-Maker-Cards (Zeile 319 liegt in §Game-Maker-Profil, 177–340) | `product-studio-working-circle.md:319` | gelandet, nicht erreichbar |
| V3 unknown-Resolver | **JA** — `unknown` blieb Endzustand (Preis, Audit, Kosten) | `docs/PRODUCT.md:233-235` | wie V2 |
| V4 selfLand-Default | **nicht wiederholt** — `promotion.selfLand:"green-only"` schon bei Confirm | `ios-programs.json` | wirksam angewandt |
| V5 Quiet-Hours-Ausnahme | Ersatzfall Master-Stop, dieselbe Kostenklasse | s. Wurzel 2 | nicht gelandet |
| V6 Audit `not-applicable` | **JA, 1:1** | 9/9 unknown | nicht gelandet (`grep not-applicable server.ts` = andere Domäne) |
| V7 Card-Schnitt/erzeugte Verify-Zeilen | **teilweise**: 396 statt 1254 Zeilen, aber Gates weiter hand-geschrieben | `docs/PRODUCT.md` | nicht gelandet |
| Lifecycle 1 lebender Worker blockiert Self-Land | **JA** („the land door refuses while the worker session is still alive … retry about 90 s later") | `HANDOFF.md#Fleet facts` | nicht repariert |
| Lifecycle 2 Owner-Land ohne Watch | Variante: gefeuerter Merge-Watch nicht re-armbar, zweites Verdikt kam still an | `HANDOFF.md#Fleet facts` | teil-repariert (`8b1cc95`) |
| Lifecycle 3 Board bestätigt Land nicht | nicht beobachtbar (MAIN landete per API) | — | offen |
| Lifecycle 4 Receipt ohne Modell | **nein** — `model` überall gesetzt | `ios-lane-outcomes.jsonl` | — |
| Lifecycle 5 Controller↔MAIN untypisiert | **JA** — der Rückweg war jedes Mal der Attention-Antworttext | `ios-attention.json` | offen |
| Lifecycle 6 Verify erst spät sichtbar | **Klasse wiederholt in neuer Koordinate**: Eintrag da, aber 300-s-**Budget** erst am Brief-3b-Land entdeckt | `HANDOFF.md#Proof chain` | offen |
| Lifecycle 7 unstartbare Harness + Dubletten | **JA** — `55f9637d` (codex) archiviert, ersetzt durch `dac21cc7`; 7 pending-Notiz-Zeilen bleiben liegen | `ios-tasks.md:23,43` | offen |
| Lifecycle 8 Captures ohne sauberen Kandidaten | **JA** — Video ohne Manifest/Build-Stamp-Bindung an `af9f429` | `HANDOFF.md#Owner touchpoint` | offen |
| K1 Fühlbarkeits-/Stop-Gate verfällt | **JA** — `bc9e7de`-Tor (§2c) | `docs/PRODUCT.md:269` | offen |
| K2 Vertrag erreicht den Brief nicht | **JA, teuerste Instanz** — Working Circle + sol-Profil §5 (`fresh sensory Critic`) in 0 Briefs | grep = 0 | offen |
| K3 grüner Funktionsbeweis als Qualitätsbeweis | **JA** — vier ALL-PASS-Tails + Testvideo als „product tour" | `HANDOFF.md#Owner touchpoint` | offen |
| K4 tragendes Wissen ungetrackt | **JA** — 24 Brieftexte nur in Fleet-Rows, für die MAIN unlesbar | `HANDOFF.md#Fleet facts` | offen |
| K5 Vokabular ohne Bars | **teilweise** — Card extrem präzise beim Schema, **null** Bars für Aussehen/Verständlichkeit | `docs/PRODUCT.md` | offen |
| K6 Confound-Messstellen | nicht geprüft | — | — |
| K7 Selbsterklärte Fläche als Orakel | **JA, bewiesen** — Re-Review-Finding 2, `runCase` schaltet auf `expectedOutcome.status` | `HANDOFF.md#Open work` 3 | offen |
| K8 Spawn-Snapshot ohne Rücklesetür | **JA** — Rail-Brief und Briefe nicht rücklesbar; `docs/`-Snapshot der Lane | `HANDOFF.md#Fleet facts` | offen |
| K9 Claim vs. Serverzustand | **JA** — „its report arriving is not yet idleness" | `HANDOFF.md#Fleet facts` | offen |
| K10 Schatten-Orchestrierung | **NEIN** — alles auf den Rails | `ios-tasks.md` | — |
| K11 geteiltes Zustellbudget | nicht geprüft | — | — |
| S1 Briefprofil (Pflichtzeilen je Brieftyp) | **JA wiederholt** — jeder Brief hand-geschrieben, kein ENV-/Render-/Critic-Block | `ios-tasks.md` | nicht gelandet (nur Blaupause `43360f1`) |
| S2 Report-Ist-Zahl | nicht beobachtet | — | nicht gelandet |
| S3 capture.ts + seal.sh + Critic-ENV-KIT | **JA, ursächlich** — der Critic hatte kein Kit und lief nie; kein `tools/` in private-repo-o, keines in private-repo-p | `ls` | nicht gelandet |
| S4 serve-pair/pixelcmp | **JA** — kein visueller A/B-Vergleich | — | nicht gelandet |

**Ergebnis.** iOS-NEU ist praktisch nichts. Zwei Dinge sind besser geworden (V4 selfLand ab
Gründung; Lifecycle 4 Modell im Receipt), eines wurde stärker (die unabhängige Review griff
wirklich, zweimal). **Alles andere sind bekannte, dokumentierte, unreparierte Fehler** — und die
drei Regeln, die aus Private-repo-o tatsächlich normativ wurden (V1–V3, `75b2110`), landeten in einem
Abschnitt, den ein iOS-Program konstruktionsbedingt nicht erbt.

## 5. iOS-spezifisch vs. Studio-generisch (für Stufe 2)

| Fläche | iOS-spezifisch → `private-repo-p` | Studio-generisch → Fleet |
|---|---|---|
| Simulator-Lease, UDID-Lebenszyklus, Xcode/`DEVELOPER_DIR` | ✔ `scripts/verify.sh` | — |
| Hostlast als Flake-Quelle (8 GB, XCUITest-SIGKILL, Contrast-Audit) | ✔ Testtiming, Poll-Muster | Gate-**Budget** und Last-Gate sind Fleet (`FLEET_VERIFY_TIMEOUT_MS`) |
| `make check/verify/review`, ALL-PASS-Tails | ✔ | die Regel „Tail statt Erinnerung" ist Fleet |
| **Program-Rail** (Brief, release, land, watch, attention) | — | ✔ |
| **Brief-Zerlegung / Briefprofil je Typ (S1)** | Inhalte iOS | ✔ Form + Pflichtzeilen |
| **Review-Stufe** (unabhängig, Cross-Model, Receipt-Datei) | Invarianten iOS | ✔ Rolle, Reihenfolge, Waiver-Verbot |
| **Critic-Lücke** (sensorisch/UX, vor der Owner-Taste) | Kit (Screenshots, Drive) iOS | ✔ die *Pflicht* + Reihenfolge (V2 über Game-Maker hinaus) |
| **Audit `unknown`** für Nicht-Fleet-Repos (V6) | — | ✔ |
| **`Program.profile`** — heute nur `game-maker` | Profil-Inhalt iOS | ✔ Mechanismus, zweiter Kind-Wert |
| **Session-/Iterations-Bestand** (welche Sessions, welche Iteration, was trägt weiter) | — | ✔ |
| Master-Stop / Hand-Dispatch-Reibung | — | ✔ |

## Gerankte Design-Befunde

| # | Befund | Kosten im Lauf | Kosten beim nächsten Lauf |
|---|---|---|---|
| 1 | **Kein Akteur mit fremder Wahrnehmung im ganzen Rail.** Der Rail-Brief endet bei „PLAYABLE = es läuft und du hast es laufen sehen"; kein Critic, kein Nutzungsurteil, keine Owner-Bedienung. `review.sh` existiert und wurde nie gerufen. | Das Owner-Urteil war der erste fremde Blick — nach 22 h | Identisch, mit Sicherheit: nichts im Rail hat sich geändert |
| 2 | **Der Workflow ist kein Objekt.** `profile:null`, `ProgramProfileKind` kennt nur `game-maker`; die Lehren aus Private-repo-o sind in einen Profil-Abschnitt gelandet, den iOS nicht erbt. | V1–V3 wirkungslos, K2 in Reinform | Jede neue Studio-Art fängt bei null an; jede Lehre ist genau einen Profiltyp weit |
| 3 | **Der successCriterion enthält drei nie erfüllbare Klauseln** (Kosten ohne Provider · Audit grün · Computer-Use als Bedingung und offene Frage zugleich). | „undecidable", 9/9 `unknown`, Brief 8 nie gefilet; Program kann formal nicht abschließen | Ein Erfolgsmaß, das nicht schließen kann, macht *jede* Fertigstellungs-Aussage zur Ermessensfrage |
| 4 | **Kein CONTINUE-Zug.** Private-repo-x wurde `complete` gesetzt, ohne sein eigenes Kriterium und seine eigene Owner-Frage; danach ersetzt statt fortgeführt. Nichts trägt Produktwissen über eine Program-Grenze außer einer überschriebenen `HANDOFF.md`. | Eine halbfertige App liegt ungeprüft im Baum | Bei jeder zweiten Iteration derselben App: Neugründung, Repo-Kollision, Wissensverlust |
| 5 | **Gates und Beweise messen das selbstdeklarierte Universum** (K7/K3). Vier ALL-PASS-Tails + fünf selbstgeschriebene Golden Cases; das Orakel-Echo fand nur der fremde Reviewer. | Zwei Review-Runden, zwei HIGH offen, ein Repair-Brief ungefilet | Ohne eine Regel „jede Prüfung braucht eine benannte brechende Mutation" wiederholbar |
| — | **Schnittlinie** | | |
| 6 | Ein erklärtes Stop-Tor (`bc9e7de`) verfiel geräuschlos (K1) | keine | mittel — Vertragsklauseln ohne Prüfer |
| 7 | Türreibung: 10/10 Attentions Fleet-Mechanik, 0 Produkt (Master-Stop, Budget, Hostlast) | ~2,5 h + Owner-Unterbrechungen | hoch, aber bekannt und nicht Design-neu |
| 8 | Lifecycle 1/5/7/8 + K4/K8/K9 unverändert offen | einzeln klein | additiv, jedes Mal dieselben Handgriffe |

## Deckung

**Verifiziert:** beide Rail-Briefe im Volltext + `diff` · `ios-programs.json` (alle drei Records,
`profile`, `promotion`, `lineage`) · `ios-attention.json` (10 Zeilen, Kind/Text) ·
`ios-lane-outcomes.jsonl` (13 Zeilen) · alle 24 Zeilen `ios-tasks.md` (Briefs 1/5/7/8/9 wörtlich
gelesen) · `AGENTS.md`, `docs/PRODUCT.md`, `HANDOFF.md`, `scripts/verify.sh`, `review.sh`,
`image-has-content.swift` · `git show ed42a7d:HANDOFF.md`, `git show 30def00 --stat`,
`git log private-repo-p --all` · `server/types.ts:1100-1178`, `server.ts:1359-1429` (Profil-Kinds) ·
`75b2110` (V1–V3, Landung + Abschnittslage) · `ff5b813` (Datum der attic-Verschiebung) ·
alle grep-Zählungen oben (critic/taste = 0, working-circle = 0, `bc9e7de` = 1).

**Abgeleitet:** dass die vier Tails „Schema-Theater belohnen" (Schluss aus Brief-Texten + Card,
nicht aus einer Messung, wie viel Zeit in Schema- vs. Produktarbeit ging) · dass die
Private-repo-z-Kollision am `Package.swift`/`Private-repo-x.xcodeproj` eine zweite Iteration behindern
würde (aus der Repo-Struktur, nicht ausprobiert) · dass V5/Master-Stop dieselbe Kostenklasse sind.

**Nicht geprüft:** Transkripte (alle sechs Lanes, drei MAINs, zwei Codex-Rollouts — Strang-Sache
anderer) · das Video selbst (keine Frames gezogen) · `ios-prompts.jsonl`, `ios-events.json`,
`ios-audit-log.jsonl`, `ios-context-receipts.jsonl` · K6 und K11 · ob `make review` auf diesem Host
heute grün liefe · die beiden Codex-Review-Dateien unter `docs/reviews/` im Volltext (nur über die
HANDOFF-Zusammenfassung und die Brief-Vorgaben gelesen).

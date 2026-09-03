# Game-Maker-Workflow v2 — der eine Workflow

Adjudiziert aus zwei unabhaengigen Entwuerfen (`entwurf/entwurf-A-opus.md`, 750 Z. ·
`entwurf/entwurf-B-sol.md`, 745 Z.), einer Kreuzreview (`entwurf/kreuzreview-glm.md`, 408 Z.) und
der versiegelten Faktenlage (`entwurf/evidenz-pack.md`, 799 Z., 65 513 B, sha256 `dccc78a8f3113702`,
Commit `51430a6`, Blob `09bf67b7`). Wer je Punkt gewonnen hat und was vom Verlierer uebernommen
wurde, steht in `entwurf/adjudikation.md` — hier steht nur das Ergebnis. Zitierweise: `Pack n-m` =
Pack-Befund · `W1..W8` = seine offenen Widersprueche · `A`/`B` = Uebernahme aus dem jeweiligen
Entwurf · `E1..E5` = Evidenz, die das Programm nach der Versiegelung selbst gemessen hat ·
`datei:zeile` / `datei#symbol` = in diesem Baum nachgemessen. Gerechnet statt gemessen heisst
`[ANNAHME]`.

Die tragende Regel, aus der alles folgt (aus A): **die MAIN liest Lane-REPORTS, nie ein Artefakt
vollstaendig, und sieht nie ein Bild an.** Der Preis der Gegenprobe ist gemessen — Slot 6 fuellte
528k Kontext in 5,5 h, 150k davon in den ersten 45 min, mit 0 Subagenten (Pack 1-1, 1-6); 56 % der
Zeichen waren Bash-ERGEBNISSE, 33 % Bash-EINGABEN (Pack 1-3); die zwoelf groessten Ergebnisse waren
ausnahmslos Dokument-Lektuere, die Card zweimal ganz — „das ist die Arbeit der Reviewer-Lane, nicht
der MAIN" (Pack 1-4).

## 1 ROLLEN-GRAPH

### 1.1 Der Graph

Kanten: `--brief-->` Auftragszeile + Gruendungsbrief · `--report-->` getypter Lane-Report (`POST
/api/self/fleet-report`, Deckel §2) · `--verdict-->` Report mit geschlossenem Ergebnisvokabular (aus
B) · `--watch-->` Server-Praedikat, kein Bericht (`POST /api/self/watch`).

```
OWNER --(confirm/activate · promotion · Taste · GLM-Dritt-Blick)--> MAIN (Fable 5.1 / claude)
  MAIN liest    : Reports · Watch-Nachrichten · diff --stat · zitierter Verify-Tail
  MAIN liest NIE: Card · Volldiff · PNG · Lane-Transcript · Pane

MAIN --brief--> ARCHITECT (Opus 5) --DRAFT-Card + SHA--> REVIEWER (codex/sol)
       REVIEWER --verdict ACCEPT <final-card-sha> | RETHINK <evidenz> | OWNER <frage>--> MAIN
MAIN --brief--> BUILDER (Opus 5)     --report-->  MAIN
MAIN --brief--> CRITIC A (codex/sol) --verdict--> MAIN      (faellt er aus: §3)
       CRITIC A --(§3-Frist gerissen)--> CRITIC B (Opus 5) --verdict--> MAIN
MAIN --brief--> ADJUDICATOR (Opus 5, frisch) --verdict--> MAIN
MAIN --attention--> OWNER    (genau eine Grenzfrage)

MAIN --watch--> {kind:"merge"} : Ausgang eines Lands (landed=YES|NO + Verify-Verdikt)
MAIN --watch--> {kind:"audit"} : Ausgang des Post-Land-Audits (green|red|unknown)
```

Die einzige Kante, die die MAIN NICHT hat, ist die zum Artefakt. **Ausserhalb des automatischen
Takts, mit Absicht:** GLM (`pi-zai`) ist der OWNER-dispatchte dritte Blick, nie eine Rolle im
Graphen — Grund ist die Konstruktionsgrenze §1.4 / E2, kein Geschmack.

### 1.2 Die Tabelle

Zwei Zahlen je Rolle, NICHT dasselbe: das **Budget** ist, was der Akt nach Pack-Messung kosten soll
(aus B), die **Stop-Linie**, wo die Rolle aufhoert und meldet (aus A); die **Folge** beim Reissen
war in beiden Entwuerfen nur fuer den Builder definiert und ist hier je Rolle ergaenzt.

| Rolle | Zweck | Harness / Modell / effort | Budget (Tokens) | Stop-Linie (Tokens) | Folge beim Reissen |
|---|---|---|---:|---:|---|
| **MAIN** | ein bestaetigtes Game-Program end-to-end fahren: zerlegen, filen, freigeben, landen, Beleg schreiben | `claude` / `claude-fable-5-1[1m]` / `high` | **142 000** (§6) | **250 000** = 25,0 % (§6.5) | `HANDOFF.md` schreiben, committen, `POST /api/self/succeed` |
| **Preflight-Architect** | Owner-Intent in EINE kleine Card, messbare Bars und 1–4 ausfuehrbare Slice-Briefs uebersetzen | `claude` / `claude-opus-5[1m]` / `high` | **60 000** | **150 000** | `needs-main` mit „Preflight zu gross: <was fehlt>"; nie kompaktieren |
| **Reviewer** | frischer, unabhaengiger Cross-Model-Review der DRAFT-Card; committet die Endfassung, meldet `ACCEPT <final-card-sha>` | `codex` / `gpt-5.6-sol` / `high` | **90 000** | **150 000** | `needs-main`; ein halber Review ist `OWNER`, nie `ACCEPT` |
| **Builder** | genau eine Scheibe mit exklusivem Write-Set bauen und mit einem literalen Kommando beweisen | `claude` / `claude-opus-5[1m]` / `high` | **180 000** | **600 000** | `needs-main` mit „Scheibe zu gross: <was fehlt>"; nicht selbst kleiner schneiden |
| **Critic A** | fremder Blick am laufenden Build: starten, mit echter Eingabe bedienen, capturen, gegen einen VORAB fixierten Blindstandard urteilen | `codex` / `gpt-5.6-sol` / `high` | **80 000** | **150 000** | `needs-main` mit den bis dahin gefaellten Bars; nie einen Bar umformulieren |
| **Critic B** | derselbe Blindstandard auf der anderen Modellfamilie, wenn A nicht antwortet (§3) | `claude` / `claude-opus-5[1m]` / `high` | **80 000** | **150 000** | wie Critic A |
| **Adjudicator** | zwei widersprechende Urteile oder zwei konkurrierende Entwuerfe zu genau einem Ergebnis fuehren | `claude` / `claude-opus-5[1m]` / `high`, frische Lane | **65 000** | **150 000** | `OWNER <die eine Frage>` — nie ein Mehrheitsmittel |

**Herleitung der Budgets** (alle aus B, weil B jede aus einer Pack-Zahl fuehrt): Architect
`47 124 B` gemessene Erdung + `12 kB` Pack Typ A = 59 124 · Builder `129 750` deduplizierte
Output-Tokens + `40 kB` Slice-Pack = 169 750 · Critic `40+` Bilder à `~1,5k` = mind. 60k, Rest fuer
Umgebung und Textreport · Reviewer `47 124 B` + `35 kB` Pack-Obergrenze + 4 000 Zeichen zwei Reports
= 86 124 · Adjudicator `47 124 B` + `12 kB` + 4 000 = 63 124; alle aufgerundet (Pack 5-1, 5-3, 5-6,
5-8, 8-3, 1-5). **Herleitung der Stop-Linien** (alle aus A): Builder 600k, weil B2 Renderer
`1 835 984 B` ≈ 460k und R4 `3 786 504 B` ≈ 950k Tokens gemessen sind `[ANNAHME 4 B/Token]` — ein
Builder faehrt legitim ins 1M-Fenster, und 600k ist die Linie, an der die SCHEIBE als zu gross
bewiesen ist (Pack 5-4, 5-5); alle anderen 150k, das ~7-fache des gemessenen Akts und unter dem
25 %-Band, damit keine Nebenrolle zur zweiten MAIN wird.

### 1.3 Warum diese Modellzuordnung

Drei gemessene Randbedingungen, keine Praeferenz: **die MAIN orchestriert auf Fable**, gemessen am
Gruendungs-Tripel des Programs (Pack 2-8: `bootstrap-main (claude, claude-fable-5-1[1m], high)`) ·
**der fremde Blick muss automatisierbar sein** (§1.4) · **der Critic braucht Browser und Auge** —
codex 0.147.0 traegt `browser_use`, `browser_use_external`, `browser_use_full_cdp_access`,
`computer_use`, `in_app_browser`, `image_generation`, `view_image`, alle `stable true`, mechanisch
geprobt (Pack 2-3). Offen bleibt W5: keine Quelle belegt, ob „der Private-repo-o-Critic vom 30.08."
derselbe Akteur war wie der gemessene `ec20370b`.

### 1.4 Die Konstruktionsgrenze: nicht-automatisierbare Harness (E2)

In diesem Baum nachgemessen, nicht zitiert:

| Harness | `automatable` | `readiness` | Fundstelle |
|---|---|---|---|
| `claude` | `true` | **keine** | `server.ts:451` / `:487` |
| `pi` | `true` | keine | `server.ts:560` / `:608` |
| `pi-zai` (GLM) | **`false`** | **ausdruecklich abwesend** („readiness is not applicable and is deliberately absent") | `server.ts:655` / `:677-678` / `:682` |
| `pi-ox` | `true` | `/Model scope: x-preview-f-free/` | `server.ts:705` / `:738` / `:747` |
| `pi-unfenced` | `false` | keine | `server.ts:773` / `:786` |
| `codex` | `true` | `/>_ OpenAI Codex \(v/` | `server.ts:975` / `:1061` / `:1086` |

**E2 — eine Rolle auf einem nicht-automatisierbaren Modell kann NIE im automatischen Takt stehen.**
`POST /api/self/tasks/:id/release` weist sie woertlich ab: `harness <id> is not automatable — no
unattended path may drive it` (`server.ts:6714`, Praedikat `harnessAutomatableFor`) — am laufenden
Program tatsaechlich gefeuert. GLM/`pi-zai` ist darum ein Hand-Schritt des Owners, nie eine Kante im
Graphen, und der `modelRe` von `pi-zai` (`/^glm-5\.3$/`, `server.ts:686`) heisst: es gibt keinen
automatisierbaren Weg zu GLM. **Zweitens schuetzt die 20-s-Readiness-Sonde genau den codex-Critic
und genau nicht den claude-Critic** — `waitForFoundingReadiness` gibt fuer eine Harness ohne
`readiness` sofort `{ok:true}` zurueck (`server.ts:5082`). Deshalb ist Critic A codex und Critic B
claude, nie umgekehrt: der ungeschuetzte Weg ist der Ersatzweg. GLM bleibt trotzdem wertvoll — die
Kreuzreview dieses Programms erzeugte fuenf Befunde, die keiner der beiden Entwuerfe hatte —, aber
sein Trigger ist eine Owner-Tuer mit Owner-Verfuegbarkeit als Latenz (Pack 3-6 / W6).

## 2 REPORT-VERTRAG

### 2.1 Was die MAIN lesen darf, in Zeichen

| Kanal | Deckel | Herkunft |
|---|---|---|
| Lane-Report (`POST /api/self/fleet-report`) | **2000 Zeichen** Workflow-Deckel | Pack 1-8.3; der Serverdeckel liegt bei 4000 (`MAX_FLEET_REPORT_TEXT`, `server/types.ts:785`) — der Workflow verengt ihn, der Server zertifiziert ihn nicht |
| Clarification einer Lane an die MAIN | 2000 Zeichen | `MAX_CLARIFICATION_QUESTION`, `server/types.ts:782` (Servergrenze) |
| Antwort der MAIN an eine Lane | 2000 Zeichen Workflow-Deckel | Server erlaubt 4000 (`MAX_CLARIFICATION_ANSWER`, `server/types.ts:783`) |
| `git diff --stat <base>..<sha>` | ≤ 1000 Zeichen | eine Stat-Zeile je Datei; bei ≤ 12 Dateien ~400 B |
| gezielte Diff-Hunks NUR in Dateien des benannten Write-Sets | ≤ 8 KB je Land | `AGENTS.md` §Hard invariants („A worker's report is a CLAIM. Proof is the diff plus the exact verification output") — der Beweis wird gedeckelt, nicht aufgegeben |
| zitierter Verify-Tail | ≤ 3 Zeilen, woertlich | `CLAUDE.md` §Lane discipline |
| Watch-Nachricht (merge / audit) | wie der Server sie sendet | `docs/self-api.md` §watch |
| Card · Volldiff · PNG · Transcript · Spielstand · Pane | **0** | Pack 1-4 |

**Einheit, praezisiert:** der Server prueft `text.length` (`server/types.ts:528`), also
UTF-16-Code-Units, nicht Bytes und nicht Grapheme; der 2000er-Deckel steht in derselben Einheit. Bs
konservative Byte-Obergrenze `2000 × 4 = 8000 UTF-8-Bytes` bleibt Kontrollzahl, nicht zweites
Budget.

### 2.2 Pflichtformat (uebernommen aus A)

```
STATUS: complete | needs-main | failed
SHA:    <candidate sha>   BRANCH: <lane branch>   FILES: <n> (+<a>/-<d>)
SUMMARY:
  <bis zu 8 Zeilen; jede Zeile eine Aussage mit einer Zahl oder einem Dateinamen>
VERIFY:
  $ <das literale Kommando aus dem Brief>
  <bis zu 3 Zeilen Tail, WOERTLICH aus der Konsole>
OFFEN: <genau eine Zeile; "nichts" ist erlaubt, Schweigen nicht>
```

Drei Eigenschaften, jede gegen einen gemessenen Schaden. **`VERIFY:` ist ein Zitat, kein Satz** —
Pack 4-6: der R6-Bericht behauptete „--drift → Stufe 3 in allen sechs Kurven", der bitgleiche Rerun
zeigte Kurve B unveraendert; „die Codeaenderung war sauber, die Berichtszeile falsch", und sie fiel
nur auf, „weil Verdacht bestand". **`OFFEN:` ist eine Pflichtzeile, kein Feld** — Pack 4-7: das
`Open defect`-Feld hielt fuenf nummerierte Defekte gegen „one defect, or none". **`SUMMARY:` traegt
keine Geschmacksaussage** — Pack 4-7: „traegt der Slice als Spiel" ist eine Owner-Klasse-Aussage,
„die ein Nachfolger als Fakt erbt; der Owner urteilte Tage spaeter anders"; verboten sind woertlich
*traegt*, *fuehlt sich*, *sauber*, *schoen*, *beeindruckend*, *stabil* ohne Messwert, und ein Urteil
dieser Klasse gehoert als `bar/fails_when/instrument`-Tripel in einen Critic-Report (§5).

### 2.3 Ueberlaenge — die Lane verdichtet, niemand schneidet ab (uebernommen aus B)

**Kein MAIN-seitiger Schnitt.** Ein Schnitt bei 2000 wuerde exakt `OFFEN:` zerstoeren, den letzten
Block des Pflichtformats und die einzige Pflichtzeile zur Grenze — genau die Zeile, die Pack 4-4 als
Schutz begruendet. Die Lane misst VOR dem POST mit `wc -m` und `wc -c`; Ueberlaenge wird nie
abgeschnitten, sondern committet als Artefakt und im Report auf Pfad, sha256-Prefix und Bytes
verdichtet. Gelingt das nicht, meldet sie INNERHALB des Deckels `needs-main` mit `OFFEN:
Report-Vertrag nicht erfuellt` — nie `complete`. Kommt trotzdem ein Report zwischen 2000 und 4000
Zeichen an, ist er bereits in der Pane (der Server liefert bis 4000 aus und lehnt erst darueber mit
400 ab, `server.ts:6181`): die MAIN stempelt `report over budget: <n> Zeichen` in ihren
Program-Beleg (aus A) und repariert das **Brief-Template dieser Rolle**, nie die Lane — drei solche
Stempel derselben Rolle heissen, der Deckel steht nicht im Brief.

### 2.4 Wie ein Artefakt zur MAIN kommt, ohne dass sie es oeffnet

Je Typ genau ein Stellvertreter, nie die Bytes. **Bild:** Pfad, sha256-Prefix, Viewport, Seed,
Build-SHA und das Text-Urteil je Bar — nie ein `Read` auf ein PNG (Pack 1-5). **Diff:** `--stat`
plus gedeckelte Hunks nur im benannten Write-Set. **GAME-CARD:** `ACCEPT <final-card-sha>` plus
`wc -l`, nie der Text (Pack 1-4, 4-5). **Proof-Artefakt:** ≤ 5 zitierte Felder — `config`,
`evidence_sha`, `reproduction_command`, `overturning_observation`, `verdict` —, nie die JSON-Datei
(Pack 8-5 fordert genau diese). **Langes Log:** der zitierte Tail.

### 2.5 Die Gegenprobe zur zitierten Verify-Zeile

Beide Entwuerfe vertrauten dem Zitat, obwohl Pack 4-6 eine falsche Berichtszeile als gemessenen
Schaden fuehrt. Ohne neue Maschine zu schliessen: der Land-Gate faehrt seine eigene Verify-Kette,
und der `{kind:"merge"}`-Watch liefert `landed=YES|NO` **plus das Verify-Verdikt**
(`docs/self-api.md` §watch). Regel: **die MAIN haelt die zitierte Verify-Zeile gegen das
Watch-Verdikt** — weichen sie ab, ist das ein Befund gegen die LANE und die Zeile geht als `RETHINK`
zurueck; ein `resolved`/`landed:false` wird nie als Erfolg gelesen. Was der Vertrag NICHT loest: ein
Report kann luegen; der Schutz ist die zweite unabhaengige Instanz — Reviewer (§4), Critic (§5),
Post-Land-Audit als Watch. Pack 8-2: `ALL PASS` bewies dort „Typecheck, Tests und die Form
vorhandener JSON-Artefakte, nicht die aktuelle Gueltigkeit der Produktpraedikate"; der juengere
Stand W3 / Pack 9-9 daneben — „Die Proof-Luecke ist heute ein fehlendes Stop-Gate" (§5.5).

## 3 CRITIC-ZWEITWEG

**Nie ein Rueckfall auf die MAIN.** Pack 1-5: „Die MAIN hat die Builds selbst gespielt und geschaut,
weil die Codex-Critic-Lane «no liveness signal after 20 minutes» gab" — Preis 34 Bilder ≈ 50k
Tokens. Pack 4-2 sagt, warum der Rueckfall auch inhaltlich wertlos ist: „MAIN spielt selbst"
verifiziert eine Abbildung, „nie eine **Konvention** … und kein **Handling**" — die volle
42,48-s-Runde war unter BEIDEN Lenkmappungen fahrbar (Pack 3-3).

### 3.1 Die Uhr (Phasenstruktur aus B, Trigger aus A, Spielraum ergaenzt)

Alle Fristen laufen **ab ACCEPT**, nicht ab Release: die Antwort auf `release` ist ein QUEUE-Fakt,
keine Lane — „kein Slot, kein Branch, keine Worker-Identitaet; wer darauf wartet, wartet auf nichts"
(`docs/self-api.md` §release). Eine Frist ab Release misst die Queue, nicht den Critic.
| t (s) | Basis | Wer | Was |
|---|---|---|---|
| 0 | Release | MAIN | `release` der Critic-A-Zeile. Danach GENAU EINE Selbst-Terminierung: `POST /api/self/autos` mit `{everySec:null, inSec:900, idleSec:60}`. Kein zweiter Schedule, kein Poll, kein tmux. |
| 0–20 | Dispatch | Server | `waitForFoundingReadiness` gegen den codex-Accept-Marker; `READY_WAIT_MS` Default **20 s** (`server.ts:4705`). Ein blockierender Screen ist `blocked`, kein Timeout. |
| +60 | Readiness | Critic A | Bis hier muss ein persistiertes Lebenszeichen existieren (Commit, `fleet-report` oder `clarification`). Die Minute ist der erprobte Takt des Program-Dispatcher-Notwegs (Pack 2-9). |
| 900 | Release | MAIN | Der eine Auto feuert. GENAU EIN Blick: `GET /api/self/program-execution`, gelesen werden `phase` + `phaseBasis` der einen Zeile. `RUNNING` ⇒ ein ZWEITER one-shot auf t=2400. `UNKNOWN` ⇒ sofort auf die Zeile t=2400. |
| 1200 | Release | (Referenz) | die gemessene Ausfallschwelle des Falls: „no liveness signal after 20 minutes" (Pack 1-5). Der Workflow entscheidet davor und danach, nie genau darauf. |
| +2400 | ACCEPT | MAIN | **Zweitweg zwingend.** Die MAIN filed und released eine zweite Critic-Zeile mit IDENTISCHEM Seal, aber `harness: claude`, `model: claude-opus-5[1m]`, `effort: high`. |
| +2400 (B) | ACCEPT | MAIN | derselbe Takt fuer Critic B. Antwortet auch der nicht, ist das KEINE dritte Runde: `POST /api/self/attention` mit „zwei Critic-Wege ohne Liveness-Signal, Bilder liegen unter `<pfad>`, kein Urteil", und der Zyklus stoppt. |

**Warum 2400 s und nicht 1800 s.** Beide Entwuerfe setzten die Frist exakt auf den Messwert — ein
gesunder Sensory Critic brauchte gemessen **30 Minuten** (Pack 5-6, `ec20370b`, 13:18:08 →
13:48:23); ohne Spielraum ist ein 31-Minuten-Critic ein Ausfall. 2400 s = 1800 s Messwert + 600 s.
Das ist die einzige Zahl hier, die weder aus A noch B noch dem Pack stammt. **Supersession (aus
B):** ein verspaeteter Report von Critic A wird `superseded` und bewegt die MAIN nicht — sonst liest
sie zwei Urteile auf denselben Seal und weiss nicht, welches gilt.

### 3.2 Wer den Requeue ausloest

**Heute: die MAIN, ueber ihren eigenen one-shot-Auto.** Er benutzt nur existierende Tueren (`autos`,
`program-execution`, `tasks`, `release`), braucht keinen Serverumbau und verletzt die Warteregel
nicht: `AGENTS.md` §Hard invariants erlaubt eigenes Sampeln, „when no return path exists" — fuer
eine dispatchte Lane ohne Lebenszeichen existiert keiner. Der Owner-Hand-Notweg wird ausdruecklich
NICHT gewaehlt: er haengt jeden Critic-Ausfall an die teuerste gemessene Kostenklasse (Pack 3-6).
**Kuenftig: der Server-Sweep** (§7 F2) raeumt zusaetzlich die tote Lane auf; solange er fehlt,
bleibt die erste Zeile als Leiche im Slot und isst einen Lane-Deckel (Pack 2-2 `:25`, „OFFEN
(Fleet)"). **Nie: die MAIN spielt selbst**, auch nicht „nur kurz".

Preis: die MAIN verbraucht drei Autos und zwei `program-execution`-GETs ≈ 5,2 KB ≈ 1,3k Tokens
`[ANNAHME 4 B/Token]`; der Rueckfall kostet nach Pack 1-5 **50 000 Tokens** — der Zweitweg ist rund
**38× billiger** als das, was er ersetzt.

## 4 PREFLIGHT ALS EINE LANE MIT 2000-ZEICHEN-REPORT

### 4.1 Was „eine Lane" heisst — und was nicht

Der bindende Rahmen wird nicht angetastet. `AGENTS.md:90` (hier nachgelesen) schreibt fuer jedes
neue Game Program vor: **Architect → 0-2 named fact/risk probes → fresh independent cross-model
Review → MAIN `ACCEPT|RETHINK|OWNER`**, mit „THIS PREFLIGHT IS A BINDING ROLE OBLIGATION, NOT A
SERVER GATE; EXISTING DOORS DO NOT AUTHORIZE A BYPASS." Architect und Reviewer in eine Session zu
falten waere die Aufhebung der Unabhaengigkeit.

„EINE LANE" ist darum eine Aussage ueber die MAIN, nicht ueber die Zahl der Sessions: **der
Preflight liefert der MAIN genau EINEN handlungsleitenden Report — den des Reviewers.** Der
Architect-Report landet formal in der Pane, aber die MAIN entnimmt ihm nur drei Felder fuer den
Beleg (Task-Id, Modell, SHA). Warum nicht die Private-repo-o-Form mit der MAIN in der Mitte, in drei
Zahlen: teuerste Einzelposition der vermessenen MAIN (Pack 1-4, ~200k Zeichen Dokumentlektuere) ·
der Architect hatte kein Kontextproblem, sein Loch war FORM (Pack 5-3: „Ein Byte-Pack fuer den
Architect loest nichts") · die Card verrottet schneller, als die MAIN sie lesen kann (Pack 4-5).

### 4.2 Akt 1 — Architect-Lane (`claude` / `claude-opus-5[1m]` / `high`)

| Feld | Wert |
|---|---|
| Input | Owner-Program-Text woertlich · Ziel-Repo + Seed-SHA · 0–2 benannte Fakt-/Risiko-Proben, die die MAIN vorgibt (nicht der Architect) · **die aktuelle Owner-Stilentscheidung** · der Rahmen-Block (die stehenden Maschinen-Fakten, Pack 5-9) |
| Output-Dateien | `GAME-CARD.md` (DRAFT) · bei sichtbarer Arbeit `VISUAL_DIRECTION.md` · `docs/briefs/<slice-id>.md` (1–4) · `proof/preflight-manifest.json` |
| Harte Deckel | ≤ 250 Zeilen Card · 0 Zeilen eingebetteter Code · jede Zahl traegt genau eine Marke `breaker:<id>` \| `[TASTE]` \| `[ANNAHME]` · je steuerbarer Achse ein Konventions-Pin als breaker |
| Done-Kriterium | „Ein Commit traegt alle Pflichtoutputs; `wc -l GAME-CARD.md` ≤ 250; 0 dreifach-Backtick-Bloecke; jeder der 1–4 Slice-Briefs traegt Abhaengigkeiten, exklusives Write-Set, Stop-Linie, Done-Satz und ein LITERALES Verify-Kommando; das Repo-Verify endet gruen." |
| Was die MAIN liest | den Report NICHT handlungsleitend; sie entnimmt Task-Id, Modell, Commit-SHA |

**Das Stilfeld ist keine Kosmetik.** W1 ist eine ausdrueckliche Ersetzung: Quelle 7 (2026-08-25)
band „AA-Indie-Anspruch und ausdruecklich nicht als Retro-Pixel-Klon", Quelle 2 (2026-09-03) haelt
fest „der Owner-Wortlaut vom 2026-09-03 ersetzt ihn" — Pixel-Art. Ein Architect, der auf Repo-Doku
groundet, groundet auf die ALTE Bindung und baut eine Card auf toter Praemisse: die 19-h-Klasse
(Pack 2-2 `:22`) in neu. W2 (ob die Nicht-Promotion von Probe A mit aufgehoben ist) gehoert in die
`OFFEN:`-Zeile, nicht in eine stille Annahme. Die zwei zusaetzlichen Output-Dateien loesen
Pack-Befunde ein: `VISUAL_DIRECTION.md` ist Pack 7-8 Fix 1 („drei bis fuenf beobachtbare
Bild-/Motion-Bars statt «AA/AAA» … genau fuenf verbotene Defaults; Provenienz und Reopen-Trigger"),
`proof/preflight-manifest.json` die Formantwort auf das Card-Rott-Loch (Pack 4-5).

### 4.3 Akt 2 — Reviewer-Lane (`codex` / `gpt-5.6-sol` / `high`)

| Feld | Wert |
|---|---|
| Input, abschliessend | Owner-Program-Text · Repo · **der Architect-SHA** · die benannten Probe-Fakten. Nie Chat, nie Rationale, nie der Architect-Report, nie `HANDOFF.md` (`AGENTS.md`) |
| Output | die finale `GAME-CARD.md`, committet — der Reviewer DARF im bestaetigten Scope optimieren |
| Done-Kriterium | „Zeile 1 des Reports ist genau eines von `ACCEPT <final-card-sha>` / `RETHINK <benannte neue Evidenz>` / `OWNER <die eine Frage>`, und bei `ACCEPT` zeigt der SHA auf einen Commit, dessen Pflichtoutputs alle Deckel erfuellen." |
| Was die MAIN liest | **diesen Report ganz** (≤ 2000 Zeichen) — und sonst nichts aus dem Preflight |

`RETHINK` braucht NEUE benannte Evidenz, nie eine Review-Schleife (`AGENTS.md`).

### 4.4 Akt 3 — MAIN, drei Schritte, zusammen ≤ 6 KB Lektuere

1. `git rev-parse <reviewer-branch>` gegen den gemeldeten SHA halten („MAIN checks the Reviewer's
   live HEAD against its report and lands exactly that commit", `AGENTS.md`).
2. Landen, dann `{kind:"merge"}` abonnieren; bei `landed=YES` `{kind:"audit", repo, mainAfter}`.
3. Den auditierbaren Beleg schreiben und VERGLEICHEN: Architect task/model/SHA · Reviewer
   task/model/gemeldeter SHA · tatsaechlich gelandeter SHA. `AGENTS.md`: „Fleet does not assemble or
   prove this receipt; missing comparison remains `unknown`."

Erst danach kopiert die MAIN die akzeptierten Briefs **verbatim** und released nur wurzelnde,
abhaengigkeitsfreie Zeilen — jede Umformulierung ist eine Gelegenheit, die Card doch gelesen zu
haben. **E5 — der Gratis-Kontrolllauf:** ist ein Land rein docs (`git diff <letzter-Code-Commit>
<mainSha> -- . ':!docs' ':!*.md'` leer), hat der Post-Land-Audit denselben Code vermessen wie zuvor.
Zwei solche Laeufe dieses Programms hatten DISJUNKTE Fehlermengen — ein `red` ist dort ein
Flake-Beweis, kein Regress, ein `green` widerlegt keinen frueheren roten Lauf.

## 5 BILDER NUR IN CRITIC-LANES

### 5.1 Das ENV-KIT (sechs Zeilen, kein Semantik-Halbwort)

Pack 5-8 Typ E: „NICHT-INHALT: ALLES Semantische … Ein einziges semantisches Halbwort im Kit
entwertet den Critic."

```
BUILD:      <sha>            # exakt der Commit, den du startest
INSTALL:    <literales Kommando>
LAUNCH:     <literales Kommando>   PORT: <eigener Port, NIE 5173>
BROWSER:    isolierte Instanz mit eigenem Profilverzeichnis <pfad>
SHOTS:      <existierender, beschreibbarer Ordner>   VIEWPORT: <b>x<h>   SEED: <n>
INPUT:      <die echten Tasten/Klicks, als Folge, mit Haltezeiten>
```

Jede Zeile ist gemessene Reibung: die zwei gescheiterten Screenshot-Pfade kosteten „8 Calls ≈ 2–3
min und 2 Fehlerbilder" (Pack 5-6) · Port 5173 war vom MAIN-Server belegt (Pack 5-5, 5-9) ·
`BROWSER: isolierte Instanz` ist ein Vorfall, keine Hygiene — codex „schrieb `shot.png` … **im
laufenden Chrome des Owners**" (Pack 2-3, Probe 1).

### 5.2 Der Blindstandard (vor dem ersten Bild fixiert, im Brief, nicht im Kit)

Form woertlich aus Pack 8-10:

```
- bar: <beobachtbare Eigenschaft>
  fails_when: <konkrete Gegenbeobachtung>
  instrument: <Kommando, State-Feld, Ereignis-Capture oder Owner-Taste>
```

Drei bis fuenf Bars, nicht mehr (Pack 7-8 Fix 1). Je Bar genau eines von **`survives | withdrawn |
unknown`** (Pack 8-10), genau EIN benannter Hauptdefekt (Pack 7-8 Fix 2); fuer eine kompakte
Geschmacksrubrik ist die im Pack vorgeschlagene `3/3/3/2`-Form zulaessig (Pack 1-8.4).

### 5.3 Wie das Urteil als Text zur MAIN kommt

```
SUMMARY:
  bar1 steer-convention: withdrawn — ArrowRight 1,5 s, Bildschirm-x-Delta -41 px (erwartet > 0)
  bar2 dam-readability:  survives  — S2 vs S3 unterscheidbar in <2 s, 3/3 Durchlaeufe
  bar3 frame-time:       unknown   — headless, keine gueltige Bildrate messbar
  HAUPTDEFEKT: bar1
  SHOTS: <ordner>/s1.png a3f1c9de… , s2.png 77b204e1… , s3.png 0cc1ab52…
```

Die PNGs bleiben, wo sie sind; `AGENTS.md` sagt, was der Hash nicht ist: „Hashes identify the sealed
bytes only; they do not prove blindness or delivery." **`unknown` ist eine Warteschlange, kein
Endzustand** — Pack 4-4: „im gesamten Lauf wurde keine einzige unknown-Zeile durch ein Instrument
aufgeloest … Die Regel verhindert Luege, erzeugt aber keinen Druck zur Messung." Darum erzeugt jedes
`unknown` in derselben MAIN-Runde entweder eine benannte Instrument-Zeile oder ein dokumentiertes
`defer` mit Grund (Pack 3-9 V3: „unknown ohne Resolver blockiert `Next: hold`").

### 5.4 Faehigkeits-Disposition VOR dem Dispatch

Die MAIN disponiert je Critic-Faehigkeit `apply` / `unsupported` / `not-applicable`; Schweigen ist
keine Entscheidung (`AGENTS.md`-Oberflaechenregel, Pack 7-8 Fix 3). Bestaetigt die Harness eine
Voraussetzung nicht mechanisch, wird die Aufgabe vor dem Dispatch `unsupported` und faellt in §3 —
nicht an die MAIN. **Browser:** `codex` 0.147.0 (`browser_use`, `browser_use_external`,
`browser_use_full_cdp_access`, `in_app_browser`), Grenze W5. **Bild ansehen:** `codex`
(`view_image`, `computer_use`) · `claude` belegt durch die 34 PNG-Reads der alten MAIN. **Bild
erzeugen:** `codex` (`image_generation`); die Probe lieferte `biber.png` 64×64, RGB, 1486 Farben —
KEIN palettengebundenes Pixel-Bild, waehrend der Owner-Entscheid Pixel-Art ist (Pack 2-7):
Rohmaterial ist kein Stilnachweis. **Unbeaufsichtigt startbar:** §1.4 — GLM/`pi-zai` faellt an
`release` mit 409 (E2).

Zeitregel darueber: **`SENSORY CRITIC IS POST-PLAY ONLY`** (`AGENTS.md`), **nach dem ersten
PLAYABLE**, nicht nach allen Repair-Runden (Pack 3-9 V2). Preis der falschen Reihenfolge, Pack 4-3:
„der «richtige Zeitpunkt» kam nach elf Repair-Runden, waehrend die Owner-Attention … offen stand und
der Owner vorher spielte."

### 5.5 Zwei Deckel, die beide Entwuerfe vergessen haben

**(a) Repair-Runden-Deckel.** Pack 8-10 woertlich: „Maximal zwei Folgeakte. Jeder Akt braucht einen
Test, der bei einer benannten Mutation tatsaechlich fehlschlaegt. Ein Folgeakt ohne Gegenprobe wird
… als `unknown` zurueckgewiesen." Schaden ohne Deckel: elf Repair-Runden (Pack 4-3). Nach dem
zweiten Folgeakt auf denselben Hauptdefekt entscheidet die MAIN `OWNER`, nie eine dritte Runde.

**(b) Stop-Gate nach Fuehlbarkeits-Fail.** Pack 6-8 Platz 1, woertlich: „Ein Owner-Befund der Klasse
«quasi kein Einfluss» oeffnet einen PFLICHT-Produktentscheid (Pivot/Kill/Route-Wechsel) — die
naechste Mess-Lane auf derselben Praemisse ist ab da nicht mehr freigebbar." Schaden: 21 Commits
nach dem Fail, davon 1 Bau, und der fiel durch (Pack 9-7); Pack 9-9 nennt genau diese Luecke als
das, was heute offen ist. Operativ setzt ein `withdrawn` am Hauptdefekt oder ein
Owner-Fuehlbarkeits-Fail das Program auf `hold` — die MAIN filed KEINE weitere Zeile auf derselben
Praemisse, bevor ein Produktentscheid im Beleg steht. Messung aus derselben Quelle: „kein zweiter
Fall von ≥5 Folge-Mess-Commits nach einem Fuehlbarkeits-Fail ohne dokumentierten Produktentscheid."

## 6 DIE MESSBARE VORHERSAGE

### 6.1 Die Behauptung

**Nach EINEM vollen Zyklus — Preflight (Architect + Reviewer + Land) → erster Builder-Slice (Land) →
erstes Critic-Urteil gelesen — steht die MAIN bei 142 250 Tokens, 14,2 % eines 1M-Fensters.**
Uebernommen aus Entwurf A, Posten fuer Posten; die Kreuzreview hat As Arithmetik unabhaengig
nachgerechnet und bestaetigt („Summe nachgerechnet: 142 250"). Umrechnungsregel: **4 Bytes/Token
`[ANNAHME]`**, ausser wo das Pack direkt Tokens nennt.

### 6.2 Der Kostenvoranschlag

| # | Posten | Menge | Tokens | Quelle / Herleitung |
|---|---|---:|---:|---|
| S1 | Gruendungsflaeche: System + `AGENTS.md` (21 063 B, gemessen) + Rail-Block + **Gruendungsbrief** | — | **44 000** | Pack 5-7, zitierter Messweg der Stufe 2 („Brief+AGENTS+System in Tokens"). Kollidiert mit W8 (14 380 Zeichen erste User-Nachricht); die Gegenseite von W8 ist NICHT versiegelt, die Zahl steht darum mit Marke |
| S2 | Erdung vor dem ersten Filing: `GET /api/self`, `program-execution`, `git log --oneline -20`, `ls` | ≤ 20 KB | **5 000** | Deckel dieses Workflows. Gegenzahl: Pack 1-1, 150k Tokens in 45 min durch `cat`-Erdung |
| S3 | 6 Lane-Reports à ≤ 2000 Zeichen plus Event-Rahmen ≈ 500 B | 15 KB | **3 750** | §2 |
| S4 | 4 Lands à (stat 0,4 KB + gedeckelte Hunks 8 KB + Verify-Tail 0,6 KB + merge/audit-Watch 2 KB) | 44 KB | **11 000** | §2.4, `docs/self-api.md` §watch |
| S5 | eigene Bash-Arbeit der MAIN, gedeckelt auf 60 Aufrufe à (0,3 KB ein + 2,0 KB aus) | 138 KB | **34 500** | Deckel dieses Workflows. Gegenzahl: Pack 1-3, 195 Aufrufe / 401 986 B Ergebnisse / 236 699 B Eingaben |
| S6 | Harness-Erinnerungen (gemessen 515 Stueck in 459 Turns) | — | **40 000** | Pack 1-7: „die Groessenordnung ist zweistellige Tausender, nicht die Ursache" — obere Kante dieser Groessenordnung |
| S7 | eigener Text + Thinking der MAIN | ~16 KB | **4 000** | Pack 1-3: 25 836 + 7 258 Zeichen ueber 5,5 h, hier fuer einen Zyklus voll angesetzt |
| S8 | Bilder | 0 | **0** | §5. Gegenzahl: Pack 1-5, 34 Bilder ≈ 50 000 Tokens |
| | **Summe** | | **142 250** | |

### 6.3 Wo die beiden Rechnungen wirklich auseinandergehen

Die Differenz ist **77 250 Tokens** (142 250 − 65 000) und liegt NICHT bei der Gruendungsflaeche:
**beide Entwuerfe buchen dieselben 44 000** aus Pack 5-7.

| Posten | A | B | Delta |
|---|---:|---:|---:|
| Gruendungsflaeche (System + AGENTS + Brief) | 44 000 | 44 000 | 0 |
| Gruendungsbrief, ein ZWEITES Mal gebucht | 0 | +11 000 | −11 000 |
| Erdung vor dem ersten Filing (S2) | 5 000 | 0 | +5 000 |
| Reports + Lands (S3 + S4) | 14 750 | 10 000 | +4 750 |
| **eigene Bash-Arbeit (S5)** | **34 500** | **0** | **+34 500** |
| **Harness-Erinnerungen (S6)** | **40 000** | **0** | **+40 000** |
| eigener Text + Thinking (S7) | 4 000 | 0 | +4 000 |
| **Summe** | 142 250 | 65 000 | **+77 250** |

**Der eine Posten, der den Unterschied macht, sind die Betriebskosten einer ARBEITENDEN MAIN — S5
und S6 zusammen 74 500 der 77 250.** B bucht sie mit null („Nicht eingetroffene Reports und nicht
geoeffnete Artefakte werden mit null gebucht") und zaehlt dafuer den Gruendungsbrief doppelt: Pack
5-7 misst die 44 000 als **Brief + AGENTS + System**, B etikettiert sie als „System, AGENTS und
Erdung" und bucht den Brief mit 11 000 zusaetzlich (Doppelbuchung eingeraeumt, Fehletikett nicht).
B's 65 000 ist damit eine Untergrenze fuer eine MAIN, die NICHTS tut — die alte verbrannte allein in
der Erdung 150k Tokens in 45 Minuten (Pack 1-1), mehr als B's Gesamtvorhersage.

### 6.4 Empfindlichkeit

Statt 4 mit **3 B/Token** gerechnet, steigen die byte-abgeleiteten Posten (S2+S3+S4+S5+S7 = 233 KB)
von 58 250 auf 77 667 — Summe **161 667 Tokens (16,2 %)**; die Grenze reisst erst bei **1,40
B/Token**, wo kein natuerlicher Text liegt. Bekannte Schwaechen, benannt statt verschwiegen:
S6 = 40 000 uebertraegt die obere Kante einer FULL-SESSION-Groessenordnung (459 Turns) auf EINEN
Zyklus — konservativ-hoch, verkleinert also den Sicherheitsabstand statt ihn zu schoenen; S1 haengt
an W8, dessen Gegenseite nicht versiegelt ist.

### 6.5 Die Widerlegungsgrenze, und wie sie mit EINEM Blick geprueft wird

**Der Workflow gilt als widerlegt, wenn die MAIN am Messpunkt bei `ctx.pct` ≥ 25,0 steht** — also
≥ 250 000 Tokens, wenn `ctx.windowTokens` 1 000 000 meldet. **Messpunkt (Definition aus B):**
unmittelbar nachdem das erste terminale Critic-Urteil in der MAIN-Pane eingetroffen ist und bevor
ein Repair-Slice gefilet wird. **Der eine Blick:** `GET /api/sessions` → Zeile der MAIN → Feld `ctx`
mit `{usedTokens, windowTokens, pct}` (`server.ts:22043`, gerechnet in `server.ts#contextFill`); es
steht auf JEDER Slot-Zeile, und sein `null` ist eine Antwort („Fleet kann es nicht sagen").

```
bestaetigt   : ctx.usedTokens <= 200 000  (und ctx.pct <= 20,0 bei 1M-Fenster)
unentschieden: 200 000 < ctx.usedTokens < 250 000
widerlegt    : ctx.pct >= 25,0
ungueltig    : ctx == null, oder ctx.windowTokens != 1 000 000
```

Die vierte Zeile ist kein Ausweichen: die Vorhersage ist fuer ein 1M-Fenster gerechnet — meldet der
Sensor ein anderes, ist der AUFBAU falsifiziert, nicht die Vorhersage.

**Warum die Grenze in `pct` steht.** Eine Kollision, die beide Entwuerfe stillschweigend in
verschiedene Richtungen aufloesten: `AGENTS.md:146-147` schreibt das Band als „~25 % **of the
window**", Pack 1-2 misst es aber als ueberschritten, als die MAIN bei **202k** stand — 20,2 % eines
1M-Fensters, nicht 25 %. Keine Quelle sagt, warum. A las das als „250k ist die Bandkante", B als
„202k ist schwellennah" (Stop bei 200 000). Aufloesung hier: die Grenze steht in derselben Einheit,
in der `AGENTS.md` das Band schreibt und `contextFill` misst — Prozent des Fensters, das der Sensor
selbst NENNT; damit kann die Kollision den Test nicht entwerten. Bs 200 000 bleibt
**Vorwarnlinie**: dort beginnt die MAIN keine neue tiefe Arbeit mehr. **Abstand:** 250 000 /
142 250 = **1,76×** — der Voranschlag darf sich um 76 % irren, bevor der Workflow faellt. Gegenzahl
am selben Meilenstein: Slot 6 stand bei **528k** (Pack 1-1), dem 3,7-fachen der Vorhersage.

### 6.6 Zwei fruehe Falsifikatoren (uebernommen aus A)

**Vor der ersten Release** duerfen die Bash-ERGEBNISSE der MAIN 60 KB nicht ueberschreiten (Pack
1-1: +150k in 45 min, „alles per `cat` gelesen"). **Bei der ersten Release** darf `ctx.usedTokens`
nicht ueber 100 000 stehen — S1+S2+ein Report+ein Land ≈ 52 400, die Grenze traegt fast das Doppelte.

### 6.7 Was die Vorhersage NICHT behauptet

Nichts ueber Wanduhr (Pack 3-6: ~10h10m Wartezeit von 19h41m — §7 F1) und nichts ueber Qualitaet
(Pack 8-4). Zur Zyklenzahl, die keiner der beiden Entwuerfe gerechnet hat: bei diesem Postensatz
passen von 142 250 bis 250 000 noch rund **zwei weitere Slice→Critic-Zyklen** (je ~46 000), bevor
die MAIN in die Succession geht.

## 7 FLEET-VORAUSSETZUNGEN

Vier Zeilen. **Dieser Workflow baut keine davon**; jede ist so formuliert, dass die MAIN sie 1:1 als
`auftrag` filen kann. Je Zeile steht, ob der Workflow ohne sie faehrt — keine ist ein Tor.

### F1 — Program-scoped Dispatch (Zeile `5c1f831f` existiert bereits, `pending`)

**Titel:** Ein `dispatch`-Schalter je Program, damit ein Studio-Lauf nicht am Master-Stop der
Fleet-Queue haengt.

**Mechanismus, drei Saetze.** `Program.dispatch?: {v:1, on:boolean, maxLanes:number, confirmedAt}`
mit einer Owner-Tuer nach dem Muster der promotion-/profile-Tuer (CLOSED / VERSIONED /
DEFAULT-ABSENT). `server.ts#tickDispatch` waehlt bei globalem Master-Stop ausschliesslich
`releasedBy:"machine"`-Zeilen eines aktiven Programs mit `dispatch.on` und behaelt
Repo-/Program-Deckel, Analyse, Kollisionslesung, Harness-Automation und freien Slot unveraendert als
Gates. Quiet Hours duerfen nur fuer so eine maschinell freigegebene Program-Zeile uebergangen
werden; jede andere Zeile folgt unveraendert `canDeliver`.

**Done-Kriterium mit Fixture-Ort.** „Eine Fixture in `e2e/programs.ts` startet den Server mit
globalem Dispatch AUS, aktiviert Dispatch fuer genau ein aktives Program, released je eine
identische `auftrag`-Zeile in dieses und in ein Kontroll-Program und beweist in einem Lauf: nur die
Program-Zeile steht auf `sent`, die Kontrollzeile bleibt `queued`, und die Gegenproben fuer
Quiet-Hours, Deckel und Kollision bleiben ebenfalls `queued`."

**Laeuft der Workflow ohne sie?** Ja, mit Notweg und Preis. **E1, an diesem Program gemessen: eine
Program-MAIN kann ihre eigene Zeile filen und freigeben, aber NICHT starten** — `fleet.json` traegt
`"dispatch": false`, `server.ts#tickDispatch` kehrt bei globalem Stop sofort zurueck, der Start war
jedes Mal ein fremder Handgriff. Ersatz ist der Shell-Loop aus Pack 2-9, der „jede Minute die queued
`auftrag`-Zeilen GENAU dieses Programs ueber `POST /api/tasks/:id/dispatch` startet … er umgeht
damit dieselben drei Dinge wie der Hand-Knopf: Master-Stop, Deckel, Quiet Hours" — ein Notweg mit
abgeschaltetem Schutz. Wert in Wanduhr: Pack 3-6 misst 2h55m Quiet-Hours-Wartezeit an 19h41m.

### F2 — Critic-Requeue mit Liveness und Supersession

**Titel:** Eine dispatchte Critic-Zeile, die innerhalb ihrer Frist kein Lebenszeichen gibt, wird
ehrlich requeued statt still einen Slot zu belegen.

**Mechanismus, drei Saetze.** Ein Critic-Task traegt persistent `criticGroup`, `attempt`,
`acceptedAt`, `lastLivenessAt`, `deadlineAt` und den opaken Seal-Hash; kein Feld enthaelt Bildbytes.
Ein Sweep wendet die Fristen aus §3.1 an (20 s Readiness, 60 s Annahme, 2400 s Report ab ACCEPT),
praegt bei Ausfall genau eine Ersatz-Zeile mit dem zweiten Spawn-Tripel
(`claude`/`claude-opus-5[1m]`/`high`) und markiert den ersten Versuch `superseded`. Nach Ausfall des
Ersatzes erzeugt derselbe Sweep ein terminales `unknown`-Event fuer die gebundene MAIN, oeffnet
weder Artefakt noch MAIN-Pane und dispatcht keinen dritten Critic.

**Done-Kriterium mit Fixture-Ort.** „Eine Fixture in `e2e/tasks.ts` haelt den ersten Critic einmal
VOR Readiness und einmal NACH Accept ohne Report fest und beweist fuer beide Pfade: der Ersatz
startet mit demselben Seal-Hash auf `claude`, ein verspaeteter Erstreport wird nicht zugestellt,
`attempts` steht auf 1, der Slot des Ersten ist frei, und nach Ausfall des Ersatzes erhaelt die MAIN
genau ein terminales `unknown` statt eines dritten Dispatches."

**Laeuft der Workflow ohne sie?** Ja — §3.2 ist genau dieser Notweg. Preis ohne F2: die tote Lane
bleibt im Slot und isst `DISPATCH_MAX_LANES` (Pack 2-2 `:25`, Stand „OFFEN (Fleet)"); bei Deckel 2
gleichzeitigen Lanes (Pack 2-9) stallen zwei Critic-Ausfaelle das ganze Program.

### F3 — Readiness-Gate fuer `POST /api/self/succeed`

**Titel:** Die Succession pastet den Gruendungsbrief blind nach 3000 ms; sie muss dieselbe bounded
Readiness-Naht fahren wie der Dispatch.

**Mechanismus, drei Saetze.** Der Succession-Pfad ruft heute keinen Readiness-Check, sondern wartet
3000 ms und pastet — reproduzierbar dreimal an der Nachfolge Slot 1 → 12: „composer still holds 98
chars after 3000ms", die Succession bricht ab, die Vorgaengerin bleibt stehen (`fd6b7dea`). Die
Reparatur ist keine neue Maschine, sondern ein vorhandener Aufruf:
`server.ts#waitForFoundingReadiness` mit `READY_WAIT_MS` (`server.ts:4705`, Default 20 s) und
ehrlichem Requeue statt Paste. Weil `claude` KEINE `readiness` deklariert (§1.4), muss die Naht dort
auf das `agent=="alive"`-Signal zurueckfallen, mit dem die Gegenprobe „nach 5 s bereit" gelang.

**Done-Kriterium mit Fixture-Ort.** Woertlich aus `fd6b7dea`, weil es dort schon prueffaehig steht:
„eine Fixture in `e2e/`, die eine Succession gegen eine langsam bootende Pane fahrt und beweist,
dass der Brief ankommt statt an der 3000-ms-Sonde zu sterben." Ort: `e2e/slots.ts` — dort liegt die
Send-/Heal-Familie.

**Laeuft der Workflow ohne sie?** Ja, aber die Selbstnachfolge der MAIN ist unzuverlaessig — und
genau die braucht sie, wenn §6 sich irrt. Notweg: der Owner gruendet die Nachfolgerin von Hand.

### F4 — Lane-Abschluss ohne Commit hat einen typisierten Ausgang

**Titel:** Eine Lane, die `complete` berichtet, aber `ahead=0` steht, bekommt einen typisierten
Endzustand statt auf ewig `RUNNING` zu heissen.

**Mechanismus, drei Saetze.** `program-phase.ts#phaseOf` kennt den Fall und benennt ihn schon
ehrlich — `idle >= threshold, dirty>0, ahead=0 — not reviewable by predicate` als
`phaseBasis`-Zeile, bewusst ohne erfundenes `STALLED`. Die Zeile fuegt keinen Zustand hinzu, sondern
eine Verbindung: liegt fuer eine `sent`-Zeile ein `fleet-report` mit `status:"complete"` vor UND ist
`ahead=0`, tritt sie in `OWNER_GATE` statt in `RUNNING`. Kein neues persistiertes Feld — die
Reduktion rechnet weiter pro Request.

**Done-Kriterium mit Fixture-Ort.** „Eine Fixture in `e2e/programs.ts` erzeugt eine `sent`-Zeile mit
einem `complete`-Report und `ahead=0`, ruft `GET /api/self/program-execution` und beweist: `phase`
ist `OWNER_GATE`, `phaseBasis` nennt den Widerspruch woertlich, `unknown[]` traegt einen
nummerierten Satz dazu — und dieselbe Zeile mit `ahead=1` bleibt unveraendert `REVIEWABLE`."

**Laeuft der Workflow ohne sie?** Ja, ohne Notweg-Kosten: der getypte Report kommt ohnehin in die
MAIN-Pane. F4 ist die billigste der vier und die einzige, die man streichen kann, ohne dass etwas
Gemessenes wiederkehrt.

### Was ausdruecklich KEINE Voraussetzung ist

`ada76ad9` (Supervisor-Bootstrap dauerhaft durch ein veraltetes Binding 409-blockiert) ist ein
echter Befund derselben Send-/Bindungs-Klasse — **aber dieser Workflow braucht ihn nicht.** Seine
Rollen werden ueber Task-Dispatch gegruendet, nicht ueber `POST /api/supervisor/bootstrap`. Wer sich
im Critic-Zweitweg auf einen „gebundenen Supervisor" stuetzt, stuetzt sich auf eine Rolle, die es
laut `ada76ad9` moeglicherweise nicht gibt — §3.2 tut das darum nicht.

## 8 WAS DIESER WORKFLOW NICHT ENTSCHEIDET

- **W1/W2** (AA-Indie vs. Pixel-Art; ob die Nicht-Promotion von Probe A mit aufgehoben ist) sind
  Produktinhalt — der Workflow zwingt die aktuelle Entscheidung nur ins Architect-Input-Feld (§4.2).
- **W5** (Identitaet des Critics vom 30.08.) bleibt offen, steht in §5.4 als Grenze.
- **W6/W7** (Belastbarkeit der Wartezeit-Zahlen) beruehren F1; dessen Begruendung ruht darum auf der
  Quiet-Hours-Zahl (Pack 3-6, ohne Vorbehalt), nicht auf dem Nacht-Stall.
- **W8** (14 380 Zeichen vs. ~44k Messweg) traegt den groessten Einzelposten der Vorhersage; S1
  steht mit Marke, und ein Riss prueft diesen Posten zuerst.
- **Die Band-Kollision 202k vs. 250k** ist in §6.5 nicht entschieden, sondern umgangen.

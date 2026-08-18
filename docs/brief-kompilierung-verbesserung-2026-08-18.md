# Die Brief-Kompilierungs-Schicht — was gebaut ist, was sie heute nicht tut, und woran man sie messen würde

**Lies dies als:** die Vertiefung zu Zeile **C** aus `docs/arbeitskreis-prozesse-2026-08-18.md` §3
(Rang 2 der dortigen Schnittlinie). Der Trichter fragte, *welche* Unterprozesse sich lohnen; dieses
Dokument fragt für genau einen von ihnen: **was ist die Kennzahl, wer rechnet sie, welche Priors
gehören wohin, und sind refine/clarify/Analyse-Brief ein Mechanismus oder drei.**

**Anker und Haltbarkeit.** Zeilennummern gegen **`46b7478`**, den Tip der Basis dieser Lane.
Zeilenanker altern am schnellsten, Nahtbeschreibungen am langsamsten — wo eine Zeile gewandert ist,
such das genannte Symbol; wo eine Aussage hier dem Code widerspricht, **gilt der Code**.

**Methode.** Drei Etiketten, nie vermischt:

- **BUILT** — der Pfad existiert und ich habe ihn in dieser Session gelesen.
- **NOT BUILT** — ich habe danach gesucht und er fehlt; die Suche ist benannt, damit sie
  wiederholbar ist.
- **INFERRED** — meine Folgerung aus dem Gelesenen, nicht etwas, das der Code sagt.

Ich habe **kein Pane gelesen, keine Suite über den doc-proportionalen lokalen Beweis hinaus
gefahren, kein Ledger gelesen** (`lane-outcomes.jsonl`, `context-receipts.jsonl`, `fleet.json` sind
gitignored, `.gitignore:8-15` — in einem Worktree existieren sie nicht). Wo eine Zahl gebraucht
wird, benenne ich den **Host-Join**, statt eine Zahl zu erfinden. §7 sagt, was ich nicht geprüft
habe. Dies ist ein **PROPOSE**-Dokument: kein Code, keine Env-Änderung, keine Queue-Schreibung.

---

## 1. Die Schicht, wie sie steht

**BUILT.** Es gibt heute **drei** Stellen, an denen aus einer rohen Zeile Text für eine Session
wird, und sie schreiben **drei verschiedene Dinge**:

| # | Mechanismus | Modellaufruf | Schreibt | Lebensdauer |
|---|---|---|---|---|
| 1 | Sweep-Kompilierung — `runEnhance` in `tickAnalysisSweep` (`server.ts:6142-6148`) | ja (`SUMMARY_MODEL`) | `Task.brief` — **die exakten Bytes, die eine Lane bekommt** (`server.ts:1594-1601`) | einmal pro Entwurf, dann gespeichert |
| 2 | ↻ refine — `runRefineJob` (`server.ts:6332-6349`, `refine-prompt.ts`) | ja (`REFINE_MODEL`, default `claude-opus-5`, `server.ts:6241-6242`) | `Task.refine` = **Vorschlag für einen neuen REQUEST**; der Confirm mintet Kinder-Rows (`server.ts:17693-17741`), deren Text `refineChildText` deterministisch komponiert (`server.ts:6265-6273`) | Vorschlag bis zum Owner-Akt |
| 3 | ▸ clarify first — `buildClarifyBrief` (`clarify-prompt.ts`) | **nein**, deterministischer Rahmen (`server.ts:5849-5851`) | nichts auf der Row; die LANE schlägt später ein `Task.criterion` vor | eine ganze Lane |

Zugestellt wird an genau einer Stelle: `briefAndSend` (`server.ts:5845`). Die Auswahl ist eine
Zeile — `clarify ? buildClarifyBrief(…) : next.brief?.text ?? next.text` (`server.ts:5849-5851`) —
danach hängt der Server einen frisch abgeleiteten ContextPlan-Ankerblock an
(`server.ts:5938-5943`) und quittiert die Zustellung auf `context-receipts.jsonl`
(`server.ts:5950-5962`).

**Der vierte Kompiler, der keiner mehr ist:** `runEnhance` lebt zusätzlich am ✨-Knopf
(`server.ts:16528`) — dort veredelt er einen Owner-Entwurf für eine LAUFENDE Session, nicht für
eine Queue-Zeile. Derselbe Worker, anderer Zweck; er gehört nicht in diese Schicht.

---

## 2. Befund 1 — der Brief-Kompiler ist heute AUS, und zwar durch fremden Schalter

Dies ist der Befund, gegen den jede Antwort unten gerechnet werden muss.

**BUILT, Kette in vier Gliedern:**

1. `Task.brief` wird von genau **einer** Maschinen-Stelle geschrieben: `server.ts:6146`
   (`grep -n '\.brief = ' server.ts` → 6146, 17661, 17759; 17661 ist ein *Löschen*, 17759 ist die
   Hand des Owners).
2. Diese Stelle liegt **im Rumpf von `tickAnalysisSweep`**, der auf `ANALYSIS_ON` wacht
   (`server.ts:6106`).
3. `ANALYSIS_ON = ANALYSIS_TICK_MS > 0` (`server.ts:6029`), gespeist aus `FLEET_ANALYSIS_MS`
   (`server.ts:6026`).
4. `watchdog.sh:148` startet den Live-srv mit **`FLEET_ANALYSIS_MS=0`**.

> **Nachtrag 2026-08-18 (P3 gelandet):** Punkt 2 gilt nicht mehr. Die Kompilier-Stelle ist jetzt
> `compileBriefs`, und ZWEI Sweeps rufen sie — `tickAnalysisSweep` (`ANALYSIS_ON`, unverändert) und
> das neue `tickBriefSweep` (`BRIEF_ON`, gespeist aus `FLEET_BRIEF_MS`, Default **0**). Die Messung
> oben beschreibt damit weiterhin den LIVE-Zustand (beide aus), aber nicht mehr eine Kopplung: der
> Kompiler ist einschaltbar, ohne den Analysten mitzunehmen. Vertrag und die drei Grenzen des
> Schnitts: `docs/queue-analyst.md` §5a.

**Folge (BUILT, der Server sagt es selbst):** jede heute dispatchte Zeile ohne hand-geschriebenen
Brief läuft auf `next.text` — dem rohen Entwurf. `classifyAnalystOffWarning` gibt für genau diesen
Zustand `delivery: "raw-request"` zurück und schreibt es in die Queue-Warnung
(`task-analysis-warning.ts:34-41`). Die e2e-Fixtures setzen den Brief deshalb **von Hand**, mit
genau dieser Begründung im Kommentar (`e2e/tasks.ts:724-729`).

**Zwei Konsequenzen, die man nicht verwechseln darf:**

- **Der Kompiler hat keinen eigenen Schalter.** Abgeschaltet wurde ein *Urteilswerkzeug* (der
  Analyst, ausdrücklich advisory: `server.ts:1608-1612`); mitgestorben ist ein
  *Produktionswerkzeug* (die Bytes). Und der attended Rückweg ist zu: `POST /api/tasks/:id/reanalyse`
  antwortet bei ausgeschaltetem Analysten mit **409** und nennt als Grund genau das —
  „reanalysis would otherwise only delete the existing analysis and machine-generated brief"
  (`server.ts:17656-17659`). **Es gibt heute keinen Knopf, der die Maschine einen Brief
  kompilieren lässt.**
- **↻ refine ist NICHT der Ersatz.** Es schreibt keinen `brief`, sondern `text` — und der
  refine-Confirm setzt auf den Kindern ausdrücklich **weder `brief` noch `analysis`**, damit sie den
  Sweep als frischer Entwurf treffen (`server.ts:17718-17721`). Ein Kind eines refine läuft also,
  solange der Sweep aus ist, ebenfalls als roher Text in die Lane — nur als *besser
  geschriebener* roher Text (`refineChildText` hängt `Files:`/`Done:`/`Verify:` an,
  `server.ts:6265-6273`).

**INFERRED, und es ist die wichtigste Einschränkung dieses Dokuments:** die gemessenen Zahlen des
Trichters — 29 % Leer-Quote, 117/213 Lands mit 0 Owner-Prompts — sind fast vollständig **ohne
kompilierten Brief** entstanden. Der Hebel „besserer Brief" ist damit weder belegt noch widerlegt;
er ist **ungetestet**. Wer die Schicht verbessern will, verbessert heute etwas, das nicht läuft.

---

## 3. Befund 2 — `briefHash` joint auf modernen Rows nicht auf den Brief

**BUILT.** `LaneOutcome.briefHash` ist der Hash des **ersten owner-oder-auto-Prompts aus dem
Prompt-Log** (`server.ts:10221` ← `laneOwnerPrompts`, `server.ts:10121-10143`). Das ist die
**zugestellte** Zeichenkette, also `brief + anchorBlock` (`server.ts:5943` `deliveredBrief`).

`dossierTaskFor` versucht den Rückweg mit `briefHashOf(t.brief.text)` (`server.ts:10517`) — also
**ohne** den Ankerblock. Der Kommentar direkt darüber sagt es bereits selbst: dieser Fallback
erreicht nur „the historical pre-ContextPlan shapes", und „current prompt hashes include a freshly
derived anchor suffix" (`server.ts:10489-10491`).

**INFERRED:** ein Host-Join „Outcome-Zeile → der Brief, der sie erzeugt hat" **über `briefHash`
trifft auf jeder heutigen Lane null Zeilen** und sieht dabei aus wie „kein Brief gefunden", nicht wie
„nicht joinbar". Das ist genau die Fehlerklasse, die dieses Repo mehrfach teuer bezahlt hat (ein
leeres Ergebnis liest sich wie eine Aussage). Der Join, der trägt, ist `taskId`
(`server.ts:10214`) — und der existiert nur auf jüngeren Zeilen (Trichter §1, 38/213 bei landed).

---

## 4. Frage 1 — welche Kennzahl misst Brief-Qualität, und wer rechnet sie?

**Wer rechnet sie: NOT BUILT.** Gesucht in `state.sh`, `register.sh`, `slotstats.ts`,
`trailstats.ts` (`grep -n 'briefHash\|ownerPrompts\|disposition'`): der einzige Treffer ist
`state.sh:127`, und der zählt nur Dispositionen. Kein Leser dieser Schicht existiert. Die gebaute
**Form**, in der ein solcher Leser gehört, existiert dagegen dreifach und ist selbstähnlich:
`slotstats.ts:8-18`, `trailstats.ts:12-30`, `continuity.ts` — *pure Reader, jeder Input ein
Argument, kein Tick, kein Gate, und „ein unkennbarer Wert wird AUSGESCHLOSSEN und GEZÄHLT, nie als
Null gefaltet"*.

**Die Rangliste der Kennzahlen:**

**1. Leer-Quote je Brief-Herkunft.** `killed-empty / alle Lanes mit taskId`, geschnitten nach
Herkunft des zugestellten Textes (`compiled` | `owner-edited` | `raw`). Sie ist die Kennzahl, die
die 63 h benennt, und ihr Nenner ist die ganze Pointe: *alle* Lanes, nicht die Lands — dieselbe
Nenner-Disziplin, die `state.sh:132` schon ausschreibt („a land-success rate over lands only is a
rate over survivors").
**Host-Join, präzise:** `lane-outcomes.jsonl` (`disposition`, `taskId`, `branch`, `ts`) ⋈
`context-receipts.jsonl` (`taskId`, `branch`, `at`, `deliveredBytes`) ⋈ `fleet.json` `tasks[]`
(`brief.model`, `brief.edited`).
**Ehrliche Grenze:** die Herkunft ist heute **nicht im Ledger** (§5), und `capTasks` räumt
terminale Rows irgendwann weg (`server.ts:10494`) — der `fleet.json`-Arm des Joins verfällt
also. Diese Kennzahl ist **vorwärts** rechenbar, nicht rückwirkend. Das ist ein Argument für das
eine Ledger-Feld in §5, nicht für einen Retro-Join.

**2. 0-Owner-Prompt-Quote je gelandeter Lane, geschnitten nach Brief-Herkunft.**
`ownerPrompts` steht bereits auf **jeder** Outcome-Zeile (`server.ts:10223`, Semantik
owner-only bei `server.ts:10133-10135`: auto zählt nicht, weil es keine Aufmerksamkeit kostet).
Nenner: `disposition == "landed"`. Das ist die direkte Messung von „der Brief hat die Lane
getragen". **Heute schon teilweise rechenbar** — für die Rows mit `taskId`.
Direktionsdisziplin, die in den Reader gehört: eine Lane ohne `taskId` wird **ausgeschlossen und
gezählt**, nie als „raw" verbucht.

**— Schnittlinie —**

**3. Owner-Edit-Rate am Brief** (`Task.brief.edited`, gesetzt in `server.ts:17759` mit
`model: "owner"`). Unter die Linie aus zwei Gründen: sie ist ein **Zustand auf einer flüchtigen
Row**, kein Ledger-Ereignis (kein `audit()` an dieser Route — anders als bei refine, das drei eigene
Audit-Wörter hat, `server.ts:2614`), und sie ist heute **degeneriert**: mit ausgeschaltetem Sweep
ist *jeder* existierende Brief owner-geschrieben, die Rate also 1 per Konstruktion. Sie wird erst
zur Kennzahl, wenn §2 behoben ist.

**Was ich NICHT vorschlage:** eine Kennzahl aus `sessionMs` (`server.ts:10224`). Sie mischt
Denkzeit, Suite-Wartezeit und Pane-Leerlauf; ohne Trennung misst sie den Suite-Mutex, nicht den
Brief.

---

## 5. Frage 2 — Ledger-Priors / context-packs in den Kompiler, und an welcher Stelle?

Drei Kandidatenstellen im Pfad, jede mit anderem Vertrag:

**Dispatch (`server.ts:5934-5943`) — schon getan, und die falsche Stelle für mehr.** `planContext`
läuft dort bereits und liefert **Zeiger, nie Inhalt**: der Ankerblock sagt wörtlich „no source
content is copied" (`server.ts:5974`). Mehr Priors dort einzuziehen hieße, die zugestellten Bytes
zu ändern, nachdem der Owner den Brief freigegeben hat — genau der Vertrag, den `Task.brief`
verkörpert („the EXACT bytes a lane will receive", `server.ts:1594`) und den der Kommentar an der
Kommentar-Route ausdrücklich schützt („appending to it behind the owner's back would break the one
contract that makes it reviewable", `server.ts:1601-1606`, gepinnt in `e2e/tasks.ts:651-653`).

**↻ refine (`server.ts:6332`) — die falsche Stelle für Ledger-Priors, aus Vertragsgründen.** Der
Refiner-Prompt bindet drei Klauseln, alle wortwörtlich gepinnt (`e2e/tasks.ts:2365-2387`):
TRIAGE FIRST, ONLY VERIFIED PATHS, **FACTS, NEVER DIAGNOSES** (`refine-prompt.ts`, Regel 3: „you see
the state of the repo, never the cause of a problem"). Ein Prior der Form „Lanes auf dieser
Dateifläche starben 4× leer" **ist** eine Diagnose. Er einzuziehen hieße, die Klausel zu brechen,
gegen die vier Pins stehen — und die Klausel ist nicht Zierde: sie ist der Grund, warum die Ausgabe
des Refiners als Vorschlag lesbar bleibt.

**Sweep-Kompilierung (`server.ts:6142-6148`) — die richtige Stelle, und nur für eine Klasse.**
Sie hat die Zutaten bereits eingesammelt: `laneSurfaces(repo)` mit den offenen Lanes und ihren
Dateien (`server.ts:6170-6176`) und die owner-bestätigte `files`-Fläche der Zeile
(`server.ts:6182-6185`, bewusst nur die *starke*, refine-bestätigte Variante, nie die projizierte).
Ein **Dateiflächen-Prior** braucht dort keinen neuen Ledger-Zugriff.

**Rangliste mit Schnittlinie:**

1. **Nichts, bis der Kompiler wieder läuft** (§2). Ein Prior in einen Kompiler, der nie feuert, ist
   exakt null Wirkung. Diese Zeile ist nicht Rhetorik: sie ist die einzige Reihenfolge, in der die
   übrigen Punkte überhaupt messbar werden.
2. **Dateiflächen-Prior in die Sweep-Kompilierung** — aus schon vorhandenen Eingaben, kein neuer
   Ledger-Leser, kein neuer Vertrag.
3. **Outcome-Prior — an den ANALYSTEN, nicht an den Kompiler.** Die Analyse ist ausdrücklich
   advisory und gated nichts (`server.ts:1608-1612`); ihr Urteil darf aus dem Ledger gespeist
   werden, ohne dass sich ein zugestelltes Byte ändert. Der Kompiler schreibt Bytes; ein Prior, der
   Bytes ändert, umgeht die Freigabe.

**— Schnittlinie —**

**context-packs in den Kompiler: nein.** Packs sind ein **Zustellungs**-Mechanismus, aufgelöst
gegen genau den Commit, den die Quittung behauptet (`context-manifest.ts:1-13`,
`server.ts:5934-5940`). Kompilierzeit ist ein anderer Commit; Pack-Inhalt in einen *gespeicherten*
Brief zu backen machte die Quittungszeile „no source content is copied" (`server.ts:5974`) unwahr —
und die Quittung ist der einzige Ort, an dem heute steht, was eine Lane bekommen hat.

**Das eine Feld, das ich stattdessen vorschlage (PROPOSE, ein Feld, kein Programm):** die Quittung
in `server.ts:5950-5962` trägt `deliveredBytes`, aber **keinen Hash der zugestellten Bytes** — ihr
`hash` deckt nur `{anchorBlock, planFacts}` (`server.ts:5945-5948`). Ein zusätzliches
`briefHash: briefHashOf(deliveredBrief)` (dieselbe Funktion, `server.ts:10171`) plus ein
`briefSource: "compiled" | "owner" | "raw"` machte den Join aus §4 exakt **und** schlösse den
Fehl-Join aus §3 — ohne neue Route, ohne Tick, ohne Modellaufruf.

---

## 6. Frage 3 — der Marktschnitt (K3) und die misstrauische Abnahme (K2)

**Was ein externer Brief-Kompiler heute NICHT bekommen kann.** Der Refiner läuft mit
`REVIEW_TOOLS` im Repo (`server.ts:6334`) — read-only, aber auf dem **ganzen Baum**, inklusive der
hineinkopierten privaten Overlay-Datei. Das ist genau die Vertrauensfläche, die K3 begrenzt:
Lese-Reichweite = Provider-Reichweite. Der heutige Refiner ist also nicht verkaufbar, so wie er
steht — nicht wegen seines Vertrags, sondern wegen seines Zugriffs.

**Der kuratierte Schnitt (K3), aus schon gebauter Maschinerie:**

- **Der Request-Text**, defused in der DATA-Fence — der Mechanismus existiert und ist gegen
  Injection gepinnt (`refine-prompt.ts`; `e2e/tasks.ts:2383-2387`). Queue-Text ist über `/intake`
  attacker-reachable, das ist der Grund.
- **Die Anker der öffentlichen Packs**, nie deren Inhalt: `audience: "agent" | "maintainer"`.
  Der Ausschluss ist bereits mechanisch — `planRepoContext` verwirft jeden Eintrag mit
  `audience: "private-ops"` oder `privateSourceId` als `manifest-invalid`
  (`context-manifest.ts:114-116`), und `private-deploy-overlay` ist genau so deklariert
  (`context-packs.ts:174-185`).
- **Eine Dateiflächen-Liste** statt eines Arbeitsbaums.

**Was dieser Schnitt kostet, und es ist der Kern:** ohne Baum kann der Kompiler die Klausel
ONLY VERIFIED PATHS **nicht mehr selbst einhalten** — sie ist heute eine Selbstverpflichtung des
Modells („your own ls, Read or Glob", `refine-prompt.ts`). Sie muss von der Produktion in die
**Abnahme** wandern. Genau das ist der Grund, warum der Marktschnitt und die Abnahme dieselbe Frage
sind, und nicht zwei.

**K2 — woran der Owner einen schlechten gekauften Brief VOR dem Dispatch erkennt, gerankt nach
Determinismus:**

1. **Jeder genannte Pfad ist am HEAD getrackt.** Maschinell prüfbar, kein Modell — und die
   Maschinerie existiert in Form: `validateContextPacks` prüft Quellpfade gegen
   `repo.trackedPaths` und emittiert `SOURCE_PATH_MISSING` als Fehler
   (`context-pack-validator.ts:261-262`), inklusive der dritten Kategorie
   `SOURCE_BYTES_UNKNOWN` für „konnte nicht geprüft werden" (`:266`) — dieselbe
   Nicht-Messung-ist-kein-Pass-Disziplin, die dieser Prüfung fehlt. Der halluzinierte Pfad ist die
   *eine gemessene* Fehlerklasse, die `briefs/task-refine.md` benennt.
2. **Das `verify`-Feld nennt einen Schritt aus der geschlossenen Menge.**
   `LOCAL_PROOF_STEPS` (`verify-proportion.ts:5-15`) ist diese Menge; ein gekaufter Verify-Weg
   außerhalb davon ist off-contract und ohne Urteil ablehnbar.
3. **Der gekaufte Kompiler besteht dieselben Prompt-Pins** wie der eigene
   (`e2e/tasks.ts:2365-2387`) — das ist eine **Einkaufsbedingung**, kein Review.
4. **— Schnittlinie —** darunter: den Brief lesen. Das ist genau die Arbeit, die der Markt abnehmen
   soll; sie als Abnahme zu verwenden hebt den Kauf auf.

**Der strukturelle Punkt, und er ist erfreulich:** die Naht ist bereits propose/promote gebaut —
ein refine-Lauf fasst `t.text` nie an (`server.ts:1590-1593`), erst der Owner-Confirm mintet Rows
(`server.ts:17709-17741`), und ein Fehlschlag ist fail-closed mit Notiz statt Halbvorschlag
(`server.ts:6341-6345`). **Was fehlt, ist nicht die Marktschnittstelle, sondern die deterministische
Abnahme davor** — also (1) und (2). NOT BUILT: ein Pfad-/Verify-Validator auf einem
Refine-Vorschlag; gesucht in `server.ts` um `parseRefineAnswer` (`:6277-6309`), das clamped
Längen und Anzahl, prüft aber **keinen Pfad gegen den Baum**.

---

## 7. Frage 4 — ein Mechanismus, zwei oder drei?

**Aus dem Code, nicht aus Ordnungsliebe: ZWEI.** Die drei unterscheiden sich in *Ausgabe* und
*Lebensdauer*, und genau eine dieser Unterscheidungen ist echt.

**Brief bleibt eigenständig — der Code sagt warum an einer Stelle.** `server.ts:1598-1601`:
„↻ refine proposes a new REQUEST …, while this is the prompt the request compiles down to. Refine
rewrites what you asked for; the brief is how it is said." Brief in refine zu falten hieße, einem
Kompiler zu erlauben, das umzuschreiben, was freigegeben wurde. Das ist dieselbe Grenze wie die
Kommentar-Regel (§5) — und sie hat einen Pin (`e2e/tasks.ts:651-653`).

**refine und clarify sind derselbe Mechanismus in zwei Ausführungsorten.** Beide beantworten „was
wird eigentlich verlangt und was heißt fertig"; beide sind propose/promote; beide enden in etwas,
das der Owner bestätigt (`refine-confirm`, `server.ts:17693` / `criterion-confirm`,
`clarify-prompt.ts` Schritt 4). Der Unterschied ist der **Preis**: clarify verbraucht einen Slot,
einen Worktree und eine ganze Session (`server.ts:5790`), um zu tun, was refine in einem Worker tut.

**INFERRED, und es verbindet diese Frage mit dem teuersten Trichter-Befund:** eine clarify-Lane,
die vertragsgemäß endet — Kriterium vorgeschlagen, **„kein Code, kein Commit"** (`CLAUDE.md`,
Lane-Disziplin; `clarify-prompt.ts`: „Then STOP and wait") — erzeugt per Konstruktion `commitCount
== 0` und wird von `buildLaneOutcome` als **`killed-empty`** verbucht
(`server.ts:10202-10203`: `kind === "killed" ? (commitCount > 0 ? "killed-dirty" : "killed-empty")`).
Die vertragstreue Ausführung des einen Mechanismus ist im Ledger von seinem Totalausfall **nicht
unterscheidbar**. Das ist zugleich eine plausible Teil-Erklärung der 29 % und die Begründung, warum
Trichter §1 die Leer-Toten überwiegend hand-geöffneten Slots zuschrieb — und es ist eine Aussage
über den **Messprozess**, nicht über die Arbeit.

**Vorschlag, mit Schnittlinie:**

1. **Die Frage-Hälfte von clarify in refine falten** — ein refine-Vorschlag darf eine dritte Form
   haben: „ich brauche diese N Antworten" (heute kennt `RefineProposal` genau zwei Formen,
   `server.ts:1651`). Das ist ein Worker statt einer Lane für den häufigsten Fall.
2. **Die Lane-Form von clarify behalten** für den Fall, den ein Worker nicht bedienen kann: eine
   Frage, deren Antwort erfordert, *etwas laufen zu lassen*.
3. **— Schnittlinie —** darunter: Brief und refine zusammenlegen (bricht die Freigabe-Naht), und
   clarify ganz abschaffen (es gibt Fälle, die ein read-only-Worker nicht beantwortet).

**Was ich NICHT vorschlage und ausdrücklich verwerfe:** eine Disposition `clarified` neben
`killed-empty` erfinden. Das wäre eine Änderung an `LaneDisposition` (`server.ts:9976`) zugunsten
der Statistik, und die ehrliche Reihenfolge ist umgekehrt — erst §7.1, dann gibt es diese Lanes
kaum noch; ein Etikett für einen Prozess, den man gerade abzuschaffen vorschlägt, ist die falsche
Investition.

---

## 8. Die Rangliste über alle vier Fragen, mit Schnittlinie

1. **§2 zuerst: der Brief-Kompiler braucht einen eigenen Schalter, getrennt vom Analysten.** Alles
   andere in diesem Dokument misst oder verbessert etwas, das nicht läuft. Owner-Entscheid, kein
   Lane-Entscheid: `FLEET_ANALYSIS_MS` ist heute *ein* Wert für *zwei* Werkzeuge.
2. **Ein Feld auf die Quittung** (`briefHash` + `briefSource`, §5). Es macht die Kennzahlen aus §4
   vorwärts rechenbar und schließt den stillen Fehl-Join aus §3.
3. **Ein `briefstats.ts` in der Form von `slotstats.ts`/`trailstats.ts`** — reiner Reader, jeder
   Input ein Argument, kein Tick, kein Gate; er rechnet Kennzahl 1 und 2 aus §4.
4. **Deterministische Abnahme auf dem Refine-Vorschlag** (Pfad getrackt · Verify in
   `LOCAL_PROOF_STEPS`, §6) — sie ist zugleich die Vorbedingung dafür, dass die Rolle überhaupt
   fremdbesetzbar wird.

**— Schnittlinie —** darunter: die dritte Refine-Form (§7.1, erst wenn 1–4 stehen), Priors in die
Kompilierung (§5.2, ohne 1 wirkungslos), context-packs im Kompiler (§5, abgelehnt mit Begründung).

---

## 9. Nicht geprüft

- **Der laufende Server.** Ich habe `watchdog.sh:148` gelesen, nicht den Env des Prozesses.
  `GET /api/self/gate` trägt `ANALYSIS_ON` nicht; die Tatsache reist auf dem **Owner-Poll**
  (`server.ts:16171`), den eine Lane nicht abfragen kann. Die Aussage „der Kompiler ist AUS" ist
  damit **Code-belegt und Deploy-plausibel, nicht live gemessen** — der Owner prüft sie mit einem
  Blick auf `analysis.on` in `/api/sessions`.
- **Alle Ledger-Zahlen.** `lane-outcomes.jsonl`, `context-receipts.jsonl`, `audit.jsonl` und
  `fleet.json` sind gitignored und in dieser Lane nicht vorhanden. Jede Zahl in §4 ist ein
  **benannter Join**, keine Messung. Die Zahlen des Trichters habe ich übernommen, nicht
  nachgerechnet.
- **Die Queue-Detail-UI.** Ich habe `src/client.ts` nur gegrept (`refine`, `brief`) und die
  Digest-Felder gelesen (`server.ts:2187`, `2219-2221`; `src/client.ts:212-230`); die
  Vorschlags-Ansicht und den ↻-Knopf habe ich **nicht** gelesen. Aussagen über *was der Owner
  sieht* in §6 sind daher auf die Server-Fläche gestützt, nicht auf das Rendering.
- **Die übrigen `FLEET_*_CMD`-Worker** und `worker-deepseek.py` — für Frage 2/3 relevant, weil
  `POST /api/repo-worker` der gebaute Präzedenzfall der Austauschbarkeit ist; ich habe nur seinen
  Schlüsselraum aus dem Regelbuch übernommen, den Code nicht gelesen.
- **`e2e/prompts.ts`** über die eine Zeile hinaus, die sagt, warum der Refiner dort fehlt
  (`e2e/prompts.ts:128-129`) — die Paar-Prüfungen der anderen Builder habe ich nicht gelesen.
- **Ob refine je live gelaufen ist** und mit welchem Ergebnis. `briefs/task-refine.md` und der
  Trichter nennen einen `unchanged:true`-Treffer; das Audit-Ledger, das es beweisen würde
  (`task_refine`, `server.ts:2614`), ist in dieser Lane nicht lesbar.

---
frage: Welche Ideen aus den oeffentlichen X-Posts und Artikeln von Josh Rosen (2026-09-05 bis 2026-09-15) treffen Fleets Wissens-System, und was davon ist uebernehmen, pruefen oder verwerfen?
urteil: 5 Quellen (ohne Login erreichbar), 10 Ideen, davon 5 uebernehmen, 4 pruefen, 1 verwerfen. Die belegte Luecke liegt in der Rohschicht. appendEvent rotiert Ledger mit genau einer Generation, und audit.jsonl.1 (5 000 098 B, ab 2026-07-21) wird beim aktuellen Zuwachs in ungefaehr 1,4 Tagen ueberschrieben. Dem angehaengten Notiz-Register fehlen 41 von 180 Notizen, 22 davon mit Frontmatter, und kein Pin prueft das.
bereich: [wissens-system, kontext, ledger]
belege: [server/persist.ts#queueEventWrite, server/persist.ts#readLedger, server.ts#FLEET_REPORT_LEDGER_FILE, server.ts#TASK_ARCHIVE_FILE, server.ts#contextReceiptSelections, server/types.ts#Watch, context-packs.ts#CONTEXT_PACKS, context-plan.ts#planContext, context-plan.ts#planProgramContext, card-extract.ts#validateCard, docs/knowledge-currency.md, docs/attic/knowledge-layers.md, docs/attic/judge-calibration.md, docs/messungen/2026-09-14-grok-antwort-rag-suche.md, docs/messungen/2026-09-14-queue-intelligenz-schichten.md, docs/messungen/2026-09-15-gedaechtnis-tricks-gegen-fleet.md, .claude/skills/mess-notiz/SKILL.md]
nicht-gemessen: Posts zwischen 2026-09-08 und 2026-09-15 jenseits der 5 sichtbaren (Login-Wall); die verlinkten Produkte (CortexDB, Statewave, Zep u. a.) nicht geoeffnet; Harness-Transkript-Retention; Wirkung jeder vorgeschlagenen Aenderung.
stand: 2026-09-15
---

# Josh Rosen auf X (2026-09-05 bis 2026-09-15) gegen Fleets Wissens-System

2026-09-15, Lane-Branch dieser Lektuere. Frage: **Welche Ideen des Autors sollte Fleets Wissens-System
uebernehmen, pruefen oder verwerfen, mit Beleg im Code oder in den Docs?**

„Wissens-System" meint hier fuenf Schichten: (1) `docs/messungen/` + `INDEX.md` · (2) `AGENTS.md` als
portabler Vertrag + generiertes `CLAUDE.md` · (3) mechanische Kontextzustellung (Context-Plan, Packs,
Quellpaket, Receipts) · (4) Nachfolge und Ledger ueber den Sessiontod hinaus · (5) Auto-Memory und das
portable Regal `~/.claude/knowledge/`.

**Abstraktionsentscheid:** Die Lektuere lohnt nur dort, wo sie eine Fleet-Entscheidung aendert oder
bestaetigt. Deshalb wird jede Idee gegen gelesenen Code gespiegelt und nicht als eigene Taxonomie
uebernommen. Fleet hat mit L1–L3 (`docs/attic/knowledge-layers.md` §2) schon ein Schichtvokabular.

## 1. Quellen

Zugriff ohne Login, ohne Konto, ohne Cookies (Playwright, `browser_navigate` + DOM-Auslese).

| Datum | Typ | URL | Kernaussage in einem Satz |
|---|---|---|---|
| 2026-09-08 | Artikel | https://x.com/JoshARosen/article/2097324183428444499 | LLM-Judges wandern aus der Offline-Evaluierung in den Kontrollfluss der Anwendung, und deterministischer Code soll entscheiden, welche Kombination von Urteilen weiterlaesst. |
| 2026-09-15 | Artikel | https://x.com/JoshARosen/article/2099928522521244073 | Kontext-Infrastruktur uebernimmt das Lakehouse-Muster: Rohhistorie zuerst bewahren, Gedaechtnis als wiederaufbaubare Sicht darueber ableiten. |
| 2026-09-15 | Tweet (Zitat des Artikels) | https://x.com/JoshARosen/status/2099928684631073214 | Rohkontext eines Agenten ist Material fuer den naechsten und sollte nicht weggeworfen werden. |
| 2026-09-15 | Thread (Post + eigene Antwort) | https://x.com/JoshARosen/status/2099908882424590433 · Antwort https://x.com/JoshARosen/status/2099930048056688755 | Die Ausloesung wandert von „Nutzer ruft" ueber „Software-Event ruft" zu „semantische Aenderung im modellierten Kontext ruft den Agenten, betroffene Arbeit neu zu pruefen". Beispiel in der Antwort: ein Entity-Updated-Event mit Vorher/Nachher. |
| 2026-09-15 | Tweet (Zitat eines Fremdposts) | https://x.com/JoshARosen/status/2099903285922607466 | Zustimmung zu Wissens-Systemen aus typisierten Markdown-Dateien („+1 for typed artifacts"). |

Kurzzitate, je Quelle hoechstens zwei Saetze:

- Lakehouse-Artikel: „Once the underlying information is gone, better retrieval cannot recover it."
  Und: „If a fact was inferred by a model rather than stated by a user, the system needs to preserve
  that distinction."
- Judge-Artikel: „If something can be checked deterministically, check it deterministically with tests
  or schema checks or even a database check."
- Thread: „Context triggered: A semantic change in modeled context invokes the agent to reconsider
  affected work."

**Login-Wall:** Die Profil-Timeline zeigt ausgeloggt nur die 5 neuesten eigenen Eintraege und endet mit
„See Josh Rosen's full profile · Continue to X". Die Seitenhoehe blieb nach 15 Scroll-Schritten bei
2782 px, weitere Posts wurden nicht geladen. `syndication.twitter.com` antwortete mit HTTP 429. Zwei
Websuchen fanden keinen weiteren Post im Fenster, nur einen Artikel vom 2026-08-13
(`/status/2087944178558791874`, „graph engineering"). Der liegt ausserhalb des Fensters und wurde nicht
gelesen.

## 2. Ideen gegen Fleet

### I1 · Rohhistorie zuerst, spaeter entscheiden, was zaehlt (Lakehouse, Tweet)

Die Schreibseite soll nichts verwerfen, weil erst ein spaeterer Leser weiss, was wichtig war. **Schicht
(4), mittelbar (1).** Fleet hat das Prinzip schon am 2026-07-27 formuliert, fast wortgleich:
„Fleet records conclusions and discards observations. Conclusions rot; observations do not."
(`docs/knowledge-currency.md` §4). Daraus entstanden der Check-Trail (`e2e/trail-emit.ts`),
`server.ts#FLEET_REPORT_LEDGER_FILE` (jeder Report als `open`- und `decision`-Zeile, append-only) und
`server.ts#TASK_ARCHIVE_FILE`. Letzteres traegt den Kommentar, die Ein-Generationen-Rotation sei
„a delete with extra steps".

**Gelesen, die Luecke:** `server/persist.ts#queueEventWrite` benennt eine Datei ab 5 000 000 B
(`AUDIT_ROTATE_BYTES`) nach `x.jsonl.1` um, und die aeltere Generation wird dabei ueberschrieben
(Kommentar Zeile 5: „oldest overwritten"). `server/persist.ts#readLedger` liest bewusst genau zwei
Generationen („Bounded by construction"). Ueber `appendEvent` laufen unter anderem `LANE_OUTCOME_FILE`,
`FLEET_REPORT_LEDGER_FILE` und `CONTEXT_RECEIPT_FILE` (`rg` im Server: 2/2/3 Aufrufe), dazu `audit.jsonl`.

Gemessen im Haupt-Checkout (nur `ls -l` und erster Zeitstempel, kein Inhalt):

| Ledger | Groesse | aeltester Eintrag (UTC) |
|---|---|---|
| `audit.jsonl.1` | 5 000 098 B | 2026-07-21 |
| `audit.jsonl` | 4 255 276 B | 2026-09-07T15:31 |
| `lane-outcomes.jsonl` | 1 370 339 B (1042 Zeilen) | 2026-07-24 |
| `context-receipts.jsonl` | 1 451 369 B (838 Zeilen) | 2026-08-14 |
| `fleet-reports.jsonl` | 369 955 B (257 Zeilen) | nicht gelesen |

Abgeleitet, nicht gemessen: `audit.jsonl` wuchs in ca. 8,2 Tagen um 4,26 MB, also ca. 0,52 MB/Tag. Bei
gleichem Tempo fehlen noch 744 724 B bis zur Rotation, das sind ca. 1,4 Tage. Dann ueberschreibt
die Rotation die Generation mit 2026-07-21 bis 2026-09-07. `lane-outcomes.jsonl` erreicht 5 MB bei
gleichem Tempo erst in rund 140 Tagen.

**Urteil: uebernehmen.** Das Prinzip ist bereits Fleet-Doktrin. Die Rotation widerspricht ihm fuer
jede Datei, die sie zweimal trifft, und die naechste davon ist in Tagen faellig. → §3 S1.

### I2 · Gedaechtnis ist eine Sicht, die man neu bauen kann (Lakehouse)

Zusammenfassungen, Fakten und Graphen werden aus der Historie abgeleitet und ersetzt, nicht als einzige
Wahrheit gespeichert. **Schicht (1), (3).** Fleet speichert Kontext als Zeiger, nicht als Kopie
(`context-packs.ts` Kopf: „never a second knowledge store"; `context-plan.ts#planProgramContext`: „the
content stays in the source file"). Das Flake-Ranking ist eine abgeleitete Sicht auf den Trail
(`docs/messungen/2026-09-04-flake-ranking-trail.md`). Das Notiz-Register geht bewusst den anderen Weg:
`.claude/skills/mess-notiz/SKILL.md` §Die Index-Zeile sagt „angehaengt, nicht erzeugt", weil ein
generierter Index gegen die Dateien drifte.

Gemessen: 180 Notizen unter `docs/messungen/` (ohne `INDEX.md`). 41 davon haben keine Zeile im Index,
22 dieser 41 beginnen mit Frontmatter. `rg` nach `frage:`, `nicht-gemessen` und `INDEX.md` in
`e2e/pins.ts` und `review-sweep.ts` findet 0 Treffer.

**Urteil: pruefen.** Die angehaengte Sicht driftet heute durch Weglassen (41/180), nicht durch
Widerspruch. Ein Generator ist nicht die kleinste Antwort. Ein Vollstaendigkeits-Pin, der die Sicht
gegen die Dateien prueft, haelt die Owner-Entscheidung und schliesst die gemessene Luecke. → §3 S2.

### I3 · Medaillon-Schichten Bronze/Silber/Gold fuer Kontext (Lakehouse)

Rohereignisse (Bronze), kompilierte Erinnerungen (Silber) und eine aufgabenbezogene Projektion (Gold).
**Schicht (1)–(4).** Die Zuordnung liesse sich ablesen: Ledger, Trail und Git-Historie als Bronze,
Messnotizen und Commit-Bodies als Silber, Brief, Context-Plan und Quellpaket als Gold
(`context-plan.ts#planContext`). **Urteil: verwerfen als neues Vokabular.** `docs/attic/knowledge-layers.md`
§2 fuehrt L1/L2/L3 mit je einem Pruefsatz, und ein zweites Schichtmodell waere eine zweite Benennung
derselben Dateien, die unabhaengig altert. Die Zuordnung steht hier als Lesehilfe und nirgends sonst.

### I4 · Speichern ≠ Senden: Schreibseite fuer Erhalt, Leseseite fuer Nutzen optimieren (Lakehouse)

**Schicht (3).** Fleet sendet Zeiger und kurze Ausschnitte statt Historie. `planContext` waehlt Packs per
Auslassungsleiter, und der Grok-Entscheid schliesst Transkripte aus jedem Index aus
(`docs/messungen/2026-09-14-grok-antwort-rag-suche.md` §3). Gemessen am 2026-09-14: Median-Brief 13 KB,
davon das Quellpaket 56 % (`docs/messungen/2026-09-14-queue-intelligenz-schichten.md`, urteil).
**Urteil: uebernehmen, bereits Praxis.** Kein Schnitt.

### I5 · Kontext-Sumpf: Aktualitaet und Herkunft pro Fakt (Lakehouse)

Bei fuenf Versionen eines Fakts muss klar sein, welche gilt. Ein erschlossener Fakt muss von einem
beobachteten unterscheidbar bleiben. **Schicht (1), (3).** Aktualitaet in Fleet: Frontmatter-Feld `stand`
(140 von 180 Notizen tragen es), die `main:`-Regel (`docs/knowledge-currency.md` §5c), `rulebookDrifted`
auf `GET /api/self/gate`, der Pack-`sourceHash` mit `observedAt`-Pflicht
(`context-pack-validator.ts`, Code `SOURCE_OBSERVATION_INCOMPLETE`). Ablösung einer Notiz steht nur in
Prosa: 51 Notizen enthalten „korrigiert", „abgeloest" oder „supersed". Kein Frontmatter-Feld zeigt auf
die Nachfolgerin. Die Herkunft ist Inhaltsregel („gemessen und abgeleitet getrennt", mess-notiz-Skill)
und kein Feld. Die Grok-Notiz markiert sich als „ROHMATERIAL" nur im Freitext ihres `urteil`.
**Urteil: pruefen.** Ein optionales Feld fuer Ablösung waere billig. Ob Leser an veralteten Notizen
scheitern, ist ungemessen. → §3 S4, unterhalb von S1–S3.

### I6 · Materialisierte Sichten fuer teure Interpretation (Lakehouse)

**Schicht (4).** Fleet materialisiert schon: `land-quality.ts --summary` liest „three lines off the
written ledger, no git" (Dateikopf), und der Karten-Sweep schreibt seine Modellantworten nach
`cards.jsonl` (`queue-intelligenz-schichten.md` belege). **Urteil: uebernehmen, bereits Praxis.** Kein
Schnitt.

### I7 · Reaktiver Kontext: eine semantische Aenderung weckt den Agenten (Thread)

**Schicht (3), (4).** Fleets Rueckwege sind ereignisgetrieben, aber auf Software-Ereignisse:
`server/types.ts#Watch` kennt `lane`, `merge`, `audit`, `deploy`, `transition` und `job`. Keine Watch
feuert, wenn sich eine Wissensquelle aendert, auf der laufende Arbeit steht. `rulebookDrifted` wird nur
beim Abruf von `GET /api/self/gate` berechnet (`server.ts`, Route), und die `main:`-Regel ist Leserpflicht.
Die Rohdaten fuer eine Messung liegen vor: `server.ts#contextReceiptSelections` schreibt je gewaehltem
Pack den beobachteten `sourceHash` ins Receipt. **Urteil: pruefen.** Vor einem Push-Mechanismus ist die
Haeufigkeit zu messen: Wie oft aenderte sich die Quelle eines ausgelieferten Packs auf `main`, waehrend
die Lane lief? `docs/knowledge-currency.md` §3 belegt bisher einen Einzelfall (sieben Minuten
Re-Beweis). → §3 S3.

### I8 · Typisierte Artefakte statt freiem Markdown (Zitat-Tweet)

**Schicht (1), (2).** Fleet typisiert an drei Stellen und validiert zwei davon: Karten
(`card-extract.ts#validateCard`, 400 bei Luecke) und Packs (`context-pack-validator.ts`). Die dritte
Stelle, die sechs Pflichtfelder der Messnotiz, prueft keine Maschine (0 Treffer, siehe I2). 141 von 180
Notizen beginnen mit Frontmatter. **Urteil: uebernehmen.** Der Typ existiert schon, es fehlt nur die
Pruefung. Gleicher Schnitt wie I2. → §3 S2.

### I9 · Determinismus um den Judge, der Judge im Kontrollfluss (Judge-Artikel)

Deterministisch pruefen, was deterministisch pruefbar ist. LLM-Urteile nur fuer das, was es nicht ist,
und Code kombiniert sie. **Schicht (1), (2).** Fleets Aufnahme ins Regal ist nicht LLM-geurteilt: Workers
„propose", nur der Owner „promote[s]" (`AGENTS.md` §Hard invariants), und der Land-Gate faehrt fuer
Docs `install` + `pins` (`AGENTS.md` §Verify). Die Variantenwahl entscheidet eine feste Stufenregel
(DONE je Teil > Suite gruen > kleinerer Diff; `docs/messungen/2026-09-14-variantenpaar-1.md`).
Gemessener Gegenfall: K2/Eval-Gate „lieferten nichts, weil sie ohne Zielsatz, ohne Kalibrierung und
ohne Nicht-Messungs-Zustand urteilten" (`queue-intelligenz-schichten.md`, urteil). **Urteil: uebernehmen
(die deterministische Haelfte). Teilaspekt verworfen: ein LLM-Aufnahmegate am Regal.** Ein
unkalibrierter Judge vor der Notiz wiederholt den gemessenen K2-Fall. Die pruefbaren Teile gehoeren in
Pins (S2) und die Belegaufloesung (S5).

### I10 · Den Judge gegen Menschen kalibrieren, Uneinigkeit als Eskalationssignal (Judge-Artikel)

**Schicht (5), mittelbar (4).** Fleet hat die Kalibrierungsnorm: „no judging instance gets even
display-trust before a seeded-defect test" (`docs/attic/judge-calibration.md`, gespiegelt im Regal
`~/.claude/knowledge/judge-calibration.md`). Mehrere Urteiler gibt es als Kreuzmodell-Review im
Game-Preflight (`AGENTS.md` §Hard invariants) und als Zweitmeinungs-Notizen. Die periodische Stichprobe
gegen Menschen kollidiert mit der Owner-Vorgabe, Bewertung ohne Owner-Stufe zu fuehren
(`queue-intelligenz-schichten.md`: „alle ohne Owner-Stufe, per Owner-Vorgabe 2026-09-14").
**Urteil: pruefen (Uneinigkeit als Signal). Teilaspekt verworfen: die wiederkehrende
Menschenstichprobe.** Ob zwei Modell-Lesungen derselben Notiz auseinanderliegen und das Fehler vorhersagt, ist
ungemessen. Kein Schnitt unterhalb dieser Messung.

Nicht als eigene Idee gezaehlt, weil schon in I9/I10 enthalten: paarweiser Vergleich statt Punktwert
(Fleet vergleicht Varianten per Stufenregel, nicht per LLM-Paarurteil) und „die Arbeit statt die
Antwort beurteilen" (`land-quality.ts` misst Zeilen-Nacharbeit ≤3/7 Tage als verzoegertes Urteil ueber
den Land).

**Zaehlung (je Idee das fuehrende Urteil):** uebernehmen 5 (I1, I4, I6, I8, I9), pruefen 4 (I2, I5,
I7, I10), verwerfen 1 (I3). Verworfene Teilaspekte stehen bei I9 (LLM-Aufnahmegate) und I10
(wiederkehrende Menschenstichprobe).

## 3. Schnittliste (Vorlage fuer Queue-Zeilen, nicht gefilet)

Geordnet nach Ertrag je Aufwand, Schnittlinie nach S3.

**S1 · Ledger-Rotation verliert keine Rohzeile.** Ertrag: Die aelteste Audit-Generation (ab
2026-07-21) geht nach Hochrechnung in ca. 1,4 Tagen verloren, danach je Rotation jede weitere.
Aufwand: eine Funktion (`server/persist.ts#queueEventWrite`) plus Fixture.
DONE: Mit `FLEET_AUDIT_ROTATE_BYTES` klein gesetzt uebersteht eine Datei drei Rotationen, und jede je
geschriebene Zeile ist danach in einer Datei auffindbar (Archiv ausserhalb des Leserpfads,
`readLedger` liest weiter genau zwei Generationen). Die Fixture wird rot, wenn das Archiv entfaellt.
VERIFY: e2e-Fixture in der Ledger-Familie + Gate-Kette. Offen fuer die Karte: Kompression,
Dateirechte 0600 fuer das Archiv.

**S2 · Pin: jede Messnotiz ist typisiert und indiziert.** Ertrag: schliesst 41/180 fehlende
Index-Zeilen und macht die sechs Felder pruefbar. Aufwand: eine Regel in `e2e/pins.ts` plus Nachtrag
der 22 Frontmatter-Notizen. Die 19 ohne Frontmatter bekommen eine explizite Ausnahmeliste, nicht
stilles Ueberspringen.
DONE: `bun e2e/pins.ts` wird rot, wenn eine Notiz mit Frontmatter eine der sechs Felder in Reihenfolge
vermisst oder nicht genau eine INDEX-Zeile mit ihrem woertlichen `urteil` hat. Nach dem Nachtrag endet es
mit ALL PASS.
VERIFY: `bun e2e/pins.ts`, Negativprobe durch Entfernen einer Index-Zeile.

**S3 · Messung vor reaktivem Kontext.** Ertrag: entscheidet I7 mit einer Zahl statt mit einem
Einzelfall. Aufwand: eine Messnotiz, kein Code.
DONE: Eine Notiz nennt fuer alle Receipts mit `sourceHash` (838 Zeilen Stand 2026-09-15) den Anteil der
Lanes, bei denen sich die Quelle eines ausgelieferten Packs zwischen Auslieferung und Land auf `main`
aenderte, als n/N, mit Methode und `unknown`-Zaehler fuer nicht aufloesbare Zeilen.
VERIFY: `bun e2e/pins.ts` (docs-only) + reproduzierbares Skript in der Notiz.

— Schnittlinie —

**S4 · Optionales Frontmatter-Feld fuer Ablösung.** DONE: Der mess-notiz-Skill nennt ein optionales Feld
`abgeloest-durch: <pfad>`, der S2-Pin prueft, dass der Pfad existiert, und die INDEX-Zeile der alten
Notiz traegt den Verweis. VERIFY: `bun e2e/pins.ts`. Unter der Linie, weil kein Leserschaden gemessen
ist (I5).

**S5 · `belege` einer Notiz aufloesen.** DONE: Fuer jede neue Notiz werden `datei#symbol`-Belege mit
derselben Aufloesung wie `card-extract.ts#validateCard` geprueft (Datei getrackt, Symbol deklariert oder
im Graph), und ein nicht aufloesbarer Beleg wird benannt. VERIFY: Pin oder `review-sweep.ts`-Check mit
Negativfixture. Unter der Linie, weil die Kosten falscher Belege nicht gemessen sind.

## 4. Nicht gemessen

- Alle Posts im Fenster ausser den 5 sichtbaren. Die Login-Wall der Timeline ist in §1 belegt, der
  Artikel-Tab wurde laut Auftrag nicht benutzt. Die Quellenliste ist deshalb **unvollstaendig, nicht
  leer**.
- Die im Lakehouse- und Judge-Artikel verlinkten Produkte, Papiere und Benchmarks: nicht geoeffnet,
  deren Behauptungen nicht geprueft. Die Kurzbeschreibungen oben sind die des Autors.
- Die Wachstumsrate von `audit.jsonl` ist aus zwei Punkten hochgerechnet. Ob vor 2026-07-21 schon eine
  Generation verloren ging, ist `unknown`. `post-land-audits.jsonl`, `streams/prompts.jsonl` und
  `steward-journal.jsonl` wurden nicht auf ihren Rotationsweg geprueft.
- Die Retention der Harness-Transkripte (`~/.claude/projects/…`, 506 JSONL, 607 MB fuer dieses Repo) als
  moegliche Bronze-Schicht ausserhalb Fleets: Loeschpolitik nicht nachgeschlagen.
- Keine Wirkungsmessung einer vorgeschlagenen Aenderung. Nichts ist implementiert, nichts gefilet.
- Die Zaehlungen in I2/I5/I8 (180 · 41 · 22 · 140 · 141 · 51) stammen aus `grep`-Schleifen ueber den
  Baum dieser Lane (Methode unten). Die Treffer „korrigiert/abgeloest/supersed" koennen auch Notizen
  enthalten, die nur ueber fremde Korrekturen sprechen.

## Methode

```sh
# Index-Abdeckung (Baum dieser Lane)
n=0; m=0; for f in docs/messungen/*.md; do [ "$f" = docs/messungen/INDEX.md ] && continue
  n=$((n+1)); grep -qF "$f" docs/messungen/INDEX.md || m=$((m+1)); done; echo notes=$n missing=$m
for f in docs/messungen/*.md; do head -1 "$f" | grep -q '^---$' && ! grep -qF "$f" docs/messungen/INDEX.md && echo "$f"; done | wc -l
grep -l "^stand:" docs/messungen/*.md | wc -l
grep -il "supersed\|abgeloest\|korrigiert" docs/messungen/*.md | wc -l
rg -n "frage:|nicht-gemessen|INDEX.md" e2e/pins.ts review-sweep.ts   # 0 Treffer
# Ledger (Haupt-Checkout, nur Groesse und erster Zeitstempel)
ls -l audit.jsonl* lane-outcomes.jsonl* fleet-reports.jsonl* context-receipts.jsonl*
head -c 400 audit.jsonl | grep -o '"ts":[^,]*'
```

X-Auslese: Die Profilseite wurde per `document.querySelectorAll('article')` gelesen, dazu 15 Scroll-Schritte
à 1500 px mit 2 s Pause (danach 6 Artikel-Knoten, davon 5 eigene, Seitenhoehe unveraendert 2782 px).
Die Artikel- und Statusseiten wurden per `main.innerText` gelesen. Websuche mit `allowed_domains: x.com`.

---
frage: Was antwortete Grok (2026-09-14) auf die Nachfrage aus Notiz 922b37c7 — lohnt ein Index/RAG fuer "haben wir das schon entschieden/gemessen?" ueber docs, Commit-Bodies, Transkripte und Queue?
urteil: ROHMATERIAL, WOERTLICH (vom Owner ueber den Board-Editor eingefuegt; zuerst versehentlich unter "Antwort 1" der Spiele-Datei). Groks Linie: keine Embeddings, Transkripte nie indexieren (Secret-Flaeche), hoechstens SQLite-FTS5 ueber Docs+Commits und nur nach einem A/B mit 20 echten Fragen (Kriterien in §4). Auswertung und Entscheid in eigener Notiz.
bereich: [wissens-system, suche, rag, docs, transkripte]
belege: [Notiz 922b37c7 (Frage), Notiz 17b67cf8 (Wissens-System), docs/messungen/2026-09-14-queue-intelligenz-schichten.md]
nicht-gemessen: alles — Recherche eines Dritten; Quellen (arXiv 2605.15184, Cursor 11.2025, Sverklo 04.2026, Laravel Boost 09.2026) ungeprueft, bis eine Auswertungs-Zeile sie nachschlaegt
stand: 2026-09-14
---

# Grok-Antwort: Suche/RAG ueber die eigene Historie — Rohmaterial

Die RAG-Absage gilt hier **nicht** als Default gegen „Suche überhaupt“, sondern gegen **Embeddings/Vektoren auf eurem Korpus und eurer Frageform**. Startkontext bleibt außen vor.

---

## 1. Was 2026 belegt ist

**Belegt**

*Agentische Suche (grep/`rg`/`git log` + Nachlesen)*  
Boris Cherny (Claude Code), 01.02.2026: frühe Versionen hatten RAG + lokale Vektor-DB; Agentic Search war besser und vermeidet Security, Privacy, Stale-Index, Reliability. Dasselbe in Latent Space (Mai 2025) und HN. Claude Code indexiert den Code nicht.

*Semantik + Grep auf Code (groß, Cloud)*  
Cursor, 06.11.2025: Semantic Search **zusätzlich** zu Grep, +12,5 % Fragegenauigkeit (6,5–23,5 % je Modell). Code-Retention +0,3 %, **+2,6 % ab ≥1000 Dateien**. Server-Embeddings, eigener Index. Explizit: am stärksten auf **großen Codebases**, wo Grep allein knapp wird.

*Genau euer Fragetyp — Historie, nicht Code-Navigation*  
Sen et al., arXiv **2605.15184**, 14.05.2026, LongMemEval-S (116 Fragen über Multi-Session-Chat): Inline-**Grep schlägt Vector in jedem** Harness–Modell-Paar (Claude Code, Codex, Gemini CLI, Chronos). Beispiele: Codex+GPT-5.4 93,1 % vs. 75,9 %; Chronos+Opus 4.6 93,1 % vs. 83,6 %. Limitation der Autoren: gilt für Fakten/Daten/Vorlieben in **Originalwortlaut**; Paraphrase-lastige Domänen können anders aussehen.

*Code-Retrieval (andere Frage)*  
Sverklo, 28.04.2026, 60 Aufgaben: getuntes Grep **F1 0,67** vs. Hybrid **0,58**; Hybrid gewinnt Tokens (255 vs. 731). Also: Index spart Tokens, nicht zwingend Trefferqualität.  
Peng et al., SWE-QA, Aug 2026: Semantic Search 65,2 % vs. Deep-Agentic-Search 46,2 % — **Repo-Code-QA**, nicht Entscheidungsnotizen.

*Kleine Wissenskorpora*  
Laravel Boost (03.09.2026): Semantic-Memory-MCP nach **5 Tagen gelöscht**. Begründung: „few dozen“ Markdown-Regeln; Embeddings + Invalidierung sind Overkill und erzeugen Drift; Ersatz: Markdown + generiertes Zwei-Spalten-Index, Agent nutzt `ls`/`grep`.

**Erfahrungsbericht**

- Augment (zitiert 23.03.2026): kleine Repos mit markanten Identifiern — Grep reicht, Embeddings bringen nichts.
- Entire.io (03.09.2026, Vendor): 9 History-Fragen × 10 Runs: Git-History-Agent 70/90, plus Search 81/90, weniger Tokens. Hybrid BM25+ANN, nicht unabhängig.
- Tools wie `agsearch` (2026) indexieren Agent-Transkripte lokal mit **BM25**, ohne Embeddings — genau das „Session wiederfinden“-Problem, lexical.

**Meine Meinung**

Zwei Welten werden ständig vermischt. Cursor/SWE-QA messen **„wo im Code steckt das Konzept?“** auf großen Repos. Ihr fragt **„haben wir X entschieden/gemessen/verworfen?“**. Das zweite ist LongMemEval-artig: Eigennamen, Toolnamen, Datumsanker, wörtliche Befunde. Dafür ist Grep/BM25 die stärkere empirische Linie 2026, nicht Voyage/Cursor-Cloud.

---

## 2. Ab wann kippt es?

**Belegt (Schwellen, so grob sie sind)**

| Signal | Quelle | Was kippt |
|---|---|---|
| ≥ ~1000 Codedateien | Cursor 11.2025, Retention 2,6 % | Semantik **neben** Grep auf **Code** |
| „few dozen“ kurze MD | Laravel 09.2026 | Semantik lohnt nicht |
| LongMemEval, Dutzende Sessions | Sen 05.2026 | Grep ≥ Vector für Faktenfragen |
| Getuntes Grep vs. Hybrid | Sverklo 04.2026 | Hybrid spart Tokens, verliert F1 |

**Keine** publizierte Schwelle der Form „ab 50 MB Markdown braucht ihr FTS5“ oder „ab 2 GB JSONL Embeddings“.

**Meine Meinung (auf eure Zahlen gemünzt)**

- **444 MD / 10 MB + 3,6 MB Commits:** unter jeder Code-Schwelle, die Semantik rechtfertigt. `rg` über 14 MB ist Millisekunden. Ein Index hier ist Komfort, kein Muss.
- **3,5 GB JSONL:** Größe spricht für *irgendeine* Vorauswahl — aber nicht für Vektoren. Parallel 15 Agenten × Full-Scan ist Token-teuer, wenn jeder roh im Heuhaufen wühlt. Das ist das einzige Segment, wo ein **lexikalischer** Index je kippen *könnte*.
- Kippen zugunsten Embeddings erst, wenn die 20 Fragen in §4 zeigen: Agent findet mit 3 `rg`/`git log`-Versuchen die Stelle **nicht**, weil die Query **keine** der Originalwörter trifft (echtes Vocabulary-Mismatch). „Auth-Flow vs. `verify_credentials`“ ist Code. „Haben wir Worktree-Memory verworfen?“ trifft fast immer wörtlich.

---

## 3. Kleinstes lokales Design — und Transkripte

**Belegt / Technik**

- FTS5 ist **kein** Loadable Extension, sondern Compile-Flag. Apple/`bun:sqlite` auf macOS nutzen oft System-`libsqlite3` — FTS5 ist dort typisch an, `load_extension` (sqlite-vec) nicht. User-Constraint „keine Extensions ohne Homebrew“ trifft **Vektor-Extensions**, nicht FTS5.
- Transkript-Tools 2026 (`agentscrub`, 12.08.2026): Claude/Codex-JSONL enthalten Keys, URIs, Tokens; Scrubben lokal mit Gitleaks/TruffleHog-Klasse.

**Meinung — Minimaldesign, falls ihr überhaupt indexiert**

Nur **Docs + Commit-Bodies**, eine Datei, on demand, kein Daemon:

```text
history.sqlite          -- FTS5 über path, date, title, body
rebuild: bun-Skript, git ls-files docs + git log --format
query:  SELECT snippet, path FROM fts WHERE fts MATCH ? ORDER BY rank LIMIT 20
```

Agent bleibt der Ranker: Index liefert Pfade, Agent **liest die Quelle**. Kein MCP, kein Dauerprozess. Rebuild nach Commit-Hook oder manuell.

**Transkripte: nicht in denselben Index.**

| Risiko | Kosten |
|---|---|
| Secrets im Invert-Index | Key steht als Token in FTS; `MATCH` findet ihn später wieder — persistente Leak-Fläche |
| Tool-Output (Logs, `cat .env`, Stacktraces) | 3,5 GB → Index-RAM/Disk + Müllhits; 8 GB + 15 Sessions ist das falsche Gerät |
| Retention | JSONL unbegrenzt = unbegrenztes Secret-Archiv |
| Redaction | Pflicht *vor* Index: nur `user`/`assistant`-Text, keine Tool-Results; Gitleaks-Pass; Treffer verwerfen nicht maskieren-und-trotzdem-indexieren |
| Nutzen | „Welche Session?“ ist `agsearch`-Problem (BM25 über Titel+erste User-Message), nicht Embeddings |

Wenn Transkripte überhaupt: **separater**, redigierter Extrakt (eine Zeile User-Prompt + 200 Zeichen Assistant-Fazit pro Session), Retention 30–90 Tage, nie Roh-JSONL.

Queue (200 JSON): `rg`, fertig.

---

## 4. A/B in zwei Wochen — 20 echte Fragen

Kein Laborkorpus. 20 Fragen aus eurer Praxis, vorher aufschreiben, **Gold-Pfad** (Datei + Commit-SHA oder „gibt es nicht“) fixieren. Mischung:

- 8 Lookup: „Haben wir X entschieden/verworfen?“ (Namen, Tools, Daten)
- 6 Messung: „Was war die Zahl / der Fehlschlag zu Y?“
- 4 Synonym: absichtlich andere Wörter als im Doc
- 2 Negativ: bewusst nie dokumentiert

Protokoll, gleiche Agent-Version, Worktree, Netz aus:

| Arm | Was der Agent darf | Limit |
|---|---|---|
| A | `rg`, `git log -S/-G/--grep`, Read | max. 8 Tool-Calls |
| B | dazu `bun search-history.ts "…"` auf FTS5(Docs+Commits) | gleiche 8 Calls |

Pro Frage loggen: Treffer ja/nein, Calls, gelesene Tokens, Wandzeit, ob die **Quelle** die aktuelle war (nicht ein widersprüchlicher Alt-Commit).

**Lohnt sich B**, wenn nach 20 Fragen mindestens **eins**:

- A-Misses ≥ 4 und B rettet davon ≥ 3, **oder**
- Median-Tokens A → B um ≥ 40 % bei gleicher Trefferquote, **oder**
- Median-Zeit A > 90 s und B ≤ 40 s

Sonst Index löschen. Synonym-Arm getrennt ausweisen: nur der rechtfertigt später Semantik.

---

## 5. Empfehlung

**Nichts mit Embeddings. Transkripte nicht indexieren. FTS5 höchstens über Docs+Commits, und nur nach dem A/B.**

Default die nächsten zwei Wochen: **Arm A** plus ein `INDEX.md` über die 444 Docs (Laravel-Muster). Optional das 20-Zeilen-FTS5-Skript bauen, **nicht** einschalten, bis Arm A die Kriterien in §4 reißt.

Warum das euch umstimmen würde — konkret, nicht philosophisch:

1. Im A/B scheitert A an ≥ 4 der 8 Lookup-Fragen, B trifft sie (Index hat also einen Job).
2. Oder der Synonym-Arm ist ≥ 50 % der Misses **und** lokale Embeddings ohne Cloud und ohne Daemon sind machbar (tut ihr heute nicht: Netz + 8 GB + 15 Sessions).
3. Oder Docs+Commits wachsen in eine Größe, in der `rg` ohne Pfadfilter regelmäßig >2 s braucht **und** der Agent trotzdem die Stelle verfehlt.

Solange 1–3 falsch sind, ist ein Vektor-Stack auf 10 MB Notizen das, was Laravel nach fünf Tagen weggeworfen hat — plus Secret-Risiko auf 3,5 GB JSONL.

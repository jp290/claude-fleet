---
frage: Welcher Prompt geht an Grok zur Frage "was lernt man aus Agenten-Spuren, das die Ergebnis-Kennzahlen nicht zeigen", und was heisst der Anlass fuer unsere eigene Worktrail-Analyse?
urteil: VORLAGE, NOCH KEINE ANTWORT. Die Luecke in Worktrail I-V ist benannt und mit vier gemessenen Exemplaren belegt: die Analyse fragt bisher nur "welche Datentuer fehlte", nie "was hat der Agent falsch gemacht". Der Prompt unten ist zum Relayen durch den Owner; die Antwort kommt als eigene Notiz in der Form von 2026-09-14-grok-antwort-rag-suche.md.
bereich: [worktrail, evals, agenten-spuren, kennzahlen]
belege: [docs/messungen/2026-09-17-worktrail-bash-datenschichten-strategisch.md, docs/messungen/2026-09-17-worktrail-v.md, e2e/watch.ts (Anker-Reparatur in f3b625d2), server.ts#capTasks (38c20ed5), Queue-Zeile 0144fbf8, Queue-Notiz c1ac3700]
nicht-gemessen: Groks Antwort existiert noch nicht; die vier Exemplare sind Einzelfaelle aus EINEM Betriebstag, keine Rate; ob eine Pitfall-Taxonomie ueber den Bestand rechenbar ist, ist unbewiesen
stand: 2026-09-17
---

# Agenten-Spuren lesen: die zweite Frage an dasselbe Material

## 1. Anlass und Befund

Der Owner zeigte am 2026-09-17 einen Tweet: *"it's unfortunate that most people don't spend time
reading agent traces via evals to understand the major pitfalls of agents. there are leaps and
bounds of model capabilities left to learn if you know where to look."*

**Worktrail I-V IST Spurenlesen — aber mit genau einer Frage: welche Datentuer fehlte?** Das ist
eine Installateurs-Taxonomie (a unbekannt · b falsch geschnitten · c keine Schicht) und liefert
Installateurs-Befunde: 91,9 % Roh-Anteil der Ledger-Lesungen, fuenf Ledger ohne einen einzigen
Routen-Leser in 14 Tagen, die Schnitte P1-P3. Nie gestellt wurde die zweite Frage an dasselbe
Material: **was hat der Agent falsch gemacht?**

Vier Exemplare, alle am 2026-09-17 im laufenden Betrieb gefunden, keines von a/b/c erfassbar:

1. **Ein Check, der PASST UND NICHTS MISST.** `e2e/watch.ts` verglich `indexOf('answered') >
   indexOf(<Literal>)`; seit der Anker nicht mehr matchte, stand rechts `-1`, und die Aussage war
   fuer JEDEN Baum wahr. Repariert in `f3b625d2`: beide Anker muessen existieren, beide Indizes
   werden gedruckt. Ein rotes Rot meldet sich; ein gruenes Vakuum nicht.
2. **Ein Warten, das niemand je beenden kann.** Zeile `a1610fd7` wartete per `after` auf `1ed2f6a0`,
   das gelandet (`891c7d98`) und danach als `done` aus der Queue ausgesondert war; ihre Notiz sagte
   einen Tag lang "not landed". Mechanisch geschlossen in `38c20ed5`.
3. **Eine Frage ohne Antwortkante.** Ein `fleet-report` mit Status `needs-main` erreicht die MAIN,
   aber keine MAIN-Tuer erreicht die Lane zurueck. Gefilet als Queue-Zeile `0144fbf8`.
4. **Absenz-Semantik, die am Versionsrand kippt.** `coResident` und `modelOrigin` heissen "kann es
   nicht sagen", wenn sie fehlen — und der noch alte Serverprozess schreibt sie nicht. Details in
   `2026-09-17-deploy-rand-absenz-semantik.md`.

Dazu die zwei Belege aus Worktrail V, die die These des Tweets direkt stuetzen — eine Kennzahl sah
gut aus, bis jemand die Spur las: `rework3d` ist ein Diff-GROESSEN-Proxy (18 % unter 50 eingefuegten
Zeilen, 89 % ueber 400, waehrend der ANTEIL flach bei 1,13-3,30 % bleibt), und `auditRed` traegt
4 echte Defekte auf 90 rote Audits (33 flake, 14 stale-test, 10 unknowable, 29 nie adjudiziert).

**Offene Frage an den Owner** (darum hier und nicht als Auftrag): laeuft die eigene Haelfte — eine
Pitfall-Taxonomie ueber den vorhandenen Trace-Bestand, docs-only, fable 5.1/high — jetzt als Zeile,
oder erst wenn Groks Antwort den Brief schaerfen kann? Empfehlung der MAIN: **jetzt**, die vier
Exemplare sind gemessen, eine externe Antwort macht den Brief schaerfer, nicht anders.

## 2. GROK-PROMPT WOERTLICH

Alles zwischen den Markern ist der Prompt. Er ist selbsttragend, nennt keinen Fleet-Jargon, keine
Hostnamen und keine Pfade dieser Maschine.

--- PROMPT BEGINN ---

We run a local fleet of coding agents (Claude Code, Codex, GLM) on one machine. Every session's tool
calls, every merge, every post-merge test run and every lane outcome is stored locally and joinable:
14 days = 47,877 shell calls, 304 merges, 536 post-merge full-suite audits.

We have already done the obvious trace analysis and it produced infrastructure findings: of 1,204
classified calls, 787 ask no data question at all; of the 417 that do, 283 are symptoms of a missing
or wrongly-shaped data interface. 91.9 % of all ledger reads go to raw files rather than the APIs
that serve them.

We have also found that two of our own quality metrics are bad proxies. (1) "Was any inserted line
rewritten within 3 days" rises monotonically with diff size — 18 % under 50 inserted lines, 89 % over
400 — while the SHARE of rewritten lines stays flat at 1.1-3.3 %. It was ranking models by who got
the big jobs. (2) "A red post-merge audit" has a precision of 4 real defects out of 90 red runs
(33 flake, 14 stale test, 10 unmeasurable, 29 never adjudicated), yet it was counted as a
lane-quality signal.

What we have NOT done is classify traces by AGENT FAILURE MODE rather than by MISSING TOOLING. Four
specimens we found by hand this week: an assertion that passed while measuring nothing (a string
anchor stopped matching, indexOf returned -1, and the comparison became true for every input); an
agent waiting on a precondition that had been deleted and could never be satisfied; a blocked agent
filing a question through an API that has no reply channel; and an optional field whose absence means
"unknown" today but will read as a measured value after a deploy.

Five questions. Answer only what you can source.

1. What failure-mode taxonomies for agent traces exist in published work or serious practice from
   2025-2026? Name them with dates and say which are measured studies versus experience reports. I
   want failure modes visible ONLY in the trace — not ones that show up in outcome metrics.
2. Our two metrics above are size- and flake-proxies. What is actually used in published work to
   measure agent work quality that does not degrade into a proxy for task size or environment noise?
3. Design a concrete labelling loop over stored traces: what unit gets labelled, how many labels
   before the taxonomy is stable, model-as-judge or human, and how to avoid the tautology of judging
   traces with the same model family that produced them.
4. The "passes while measuring nothing" class specifically: beyond mutation testing, is there
   published work on detecting non-falsifiable assertions — checks that cannot fail — at the level of
   agent-written test suites?
5. Where has trace-reading become cargo cult? Name practices that look rigorous and produce nothing.

Constraints: cite sources with dates; mark each claim as measured / experience report / speculation;
state explicitly what is NOT established. No generic "use evals" advice — assume we already have
traces, ledgers and outcomes joined and queryable. If our framing is wrong, say where.

--- PROMPT ENDE ---

## 3. Wohin die Antwort gehoert

In der etablierten Form: eigene Datei unter `docs/messungen/`, Front-Matter, `urteil` beginnt mit
**ROHMATERIAL, WOERTLICH**, Quellen ausdruecklich ungeprueft bis eine Auswertungs-Zeile sie
nachschlaegt, und die **Auswertung in einer EIGENEN Notiz** — genau wie
`docs/messungen/2026-09-14-grok-antwort-rag-suche.md`. Antwort und Urteil nie in derselben Datei.

# Lane-Brief — der Resolver sieht beide Seiten

*Owner-Frage, wörtlich (2026-08-05): „wie der merge agent … den unterschied der builds sieht.
Denn das ist ja neben dem projekt selbst, der git-structure und graphify alles an Informationen
womit er arbeitet … ob graphify z.b. davor oder überhaupt mal gescheduled/regelmäßig laufen
lassen damit es wirkung hat, dies kostet ja nichts."*

## Befund: er bekommt Betreffs, nicht Inhalt

Was `buildMergePrompt` (und seit ② genauso `buildAuthorPrompt`) HINREICHT:

| | Inhalt |
|---|---|
| Konfliktdateien | Liste der Pfade |
| Lane-Auftrag | Task-Text, der die Lane gegründet hat |
| Seine Seite (OURS) | `git log main..HEAD --oneline` — **nur Betreffs** |
| Main-Seite (THEIRS) | `git log mergeBase..main --oneline` — **nur Betreffs** |
| Karte | Pfad zu einem graphify-Graphen **der Lane** (`buildLaneGraph`) |

Was er sich SELBST holen kann: die Konfliktmarker, `git diff` / `git log` / `git status`,
`Read/Grep/Glob` im Worktree, die graphify-Lese-Verben.

Also: **der Unterschied der beiden Seiten erreicht ihn als Einzeiler.** Der echte Inhalt ist
erreichbar, aber nur auf eigene Initiative, und nichts im Prompt sagt ihm, dass er hinsehen
soll. Die einzige Stelle, wo ihm echte Maschinenausgabe hingereicht wird, ist der
Repair-Prompt (Verify-Kommando + Fehlerausgabe). Das Muster existiert, es ist nur nicht auf
den Merge angewandt.

## Der zweite Befund, und er hat einen ersten Entwurf gekippt

Der Lane-Graph ist aus dem **Lane-HEAD** gebaut. Er enthält main bis zum Fork — aber **keinen
Aufrufer, den main seit dem Fork hinzugefügt hat.** Das ist genau der Konfliktfall, der
schiefgeht.

Der naheliegende Fix wäre, den Graphen des Haupt-Checkouts mitzureichen, weil ein
`post-commit`-Hook ihn pflegt. **Das ist falsch, gemessen 2026-08-05:**

- Der Server bewegt main mit `git merge --ff-only` (`server.ts:1183`) bzw. `git branch -f`
  (`:1188`). **Keins von beidem feuert `post-commit`.**
- Installiert sind nur `post-commit` und `post-checkout` — **kein `post-merge`**.
- `.git/hooks/` ist **nicht getrackt**: der Hook reist mit keinem Klon und in keinen Worktree.

Konsequenz: der Graph des Haupt-Checkouts ist **nach einem Land veraltet** — exakt der Moment,
in dem die nächste Lane merged. Er sah nur deshalb aktuell aus, weil der letzte Schritt
zufällig ein Hand-Commit war. **Nicht wieder vorschlagen:** Hook-Pflege, `graphify watch`,
Cron. Ein Produktfeature darf nicht an einer ungetrackten lokalen Datei hängen.

## Zu bauen

**1. Zweiter Graph: die Seite, in die hineingemerged wird.**
Genau wie `buildLaneGraph` es schon tut — `git archive <main-sha>` in ein eigenes TMPDIR,
dort `graphify . --code-only`, Rückgabe des absoluten `graph.json`-Pfads oder `null`.
Der `main-sha` ist der Commit, auf den gerade rebased wird (in `mergeJob` vor `runMerge`
via `git rev-parse <main>` im Root-Repo). Per Konstruktion richtig — **keine
Frische-Prüfung nötig, weil keine Frische-Frage entsteht.**
Aufräumen im selben `finally`, in dem der Lane-Graph schon aufgeräumt wird.
Gebaut wird er NUR auf dem Konfliktpfad, wie der erste (79 von 83 Lanes zahlen nichts).

**2. Beide Graphen im Prompt, unverwechselbar benannt.**
`mapSection` nimmt heute einen Pfad. Es soll beide nehmen und klar beschriften:
„dein Branch" vs. „die Seite, in die du hineinmergest". Fail-closed bleibt pro Graph:
was nicht gebaut wurde, wird nicht erwähnt — auch nicht halb.

**3. Dem Resolver sagen, dass er die Gegenseite ansehen soll.**
In die DO-Liste, mit fertigem Kommando, für jede Konfliktdatei:
`git diff <mergeBase>..<main> -- <datei>` („was THEIRS wirklich geändert hat").
Gilt für `buildMergePrompt` UND `buildAuthorPrompt` — der Autor hat denselben blinden Fleck,
er kennt nur seine eigene Seite gut.

## Explizit NICHT bauen (jedes Stück einzeln verworfen)

- **Den Diff in den Prompt einbetten.** Er ist unbegrenzt groß und untrusted; als Kommando
  bleibt er die Wahl des Agenten, der Prompt bleibt beschränkt und die Injektionsfläche
  unverändert. Ein eingebetteter Diff müsste zusätzlich in den DATA-Block und würde ihn
  sprengen.
- **Das graphify-BAU-Verb an den Agenten geben.** Sein Argument ist ein Pfad — das wäre eine
  unverankerte Leseberechtigung auf die Maschine (`e2e/prompts.ts` pinnt die Abwesenheit).
  Beide Graphen baut der Server.
- **Graphen cachen oder wiederverwenden.** Ein veralteter Graph ist für einen Konflikt
  schlimmer als keiner.
- **Den Graphen des Haupt-Checkouts benutzen** — siehe Befund 2.

## Verify + Report

Volle Kette aus der CLAUDE.md, seriell. Die Prompt-Teile sind in `e2e/prompts.ts` **ohne
Server** prüfbar (reine Funktionen) — dort gehören die neuen Checks hin:
beide Graphen benannt und unterscheidbar; jeder einzeln fail-closed (nur einer gebaut → nur
dieser erwähnt, keiner gebaut → das Wort graphify kommt nicht vor); das Diff-Kommando in
beiden Prompts; die Profil-Checks bleiben grün (kein bares `graphify`).

Report: Zusammenfassung, wörtlich zitiertes Verify-Ergebnis, eine Zeile zu allem Offenen.
Wenn beim Bauen etwas die obigen Befunde widerlegt: **melden statt umbauen** — die Befunde
sind gemessen, aber sie sind nicht unfehlbar.

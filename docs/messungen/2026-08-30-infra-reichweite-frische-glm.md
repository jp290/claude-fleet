---
frage: Welche stehende Werkzeug-Infrastruktur (graphify, Memory, Knowledge, Skills, MCP-Discovery, Hooks) erreicht die Orte, an denen gearbeitet wird, ist sie dort frisch, und wird sie benutzt?
urteil: Die Indexierung ist nicht das Problem — die REICHWEITE ist es: der Graph existiert nur im Fleet-Haupt-Checkout (Rebuild nur bei direkten Commits, Server-Lands als Fast-Forward triggern ihn nie, heute bis 2h14m tagsüber / 8h49m über Nacht stale), der ganze Private-repo-o-Lauf (23 Sessions, 2226 Bash-Calls) lief auf null Graph, null Memory-Erbe, null Knowledge-Shelf und ohne einen einzigen Hook — und was als einziges überall hinkommt, die Nudge-Ermahnung, kostet im Fleet-MAIN 402:9 Ermahnungen pro echter Nutzung.
bereich: [game-maker, lane-lifecycle, kontext]
belege: [server.ts#gitRetry-ff-only-Land, .git/hooks/post-commit#graphify-hook, .gitignore#L45, ~/.claude/settings.json#hooks, ~/.claude/CLAUDE.md#L8-L9, /Users/owner/AGENTS.md#knowledge-pointer, docs/messungen/2026-08-30-lane-audit-critic-main-glm.md, docs/messungen/2026-08-30-lane-audit-akt2-r10-r13-glm.md#L80]
nicht-gemessen: ob git post-merge auch bei --ff-only feuert; ob Claude Code Nudges pro Call voll in den Modellkontext injiziert (nur Transkript-Vorkommen gezählt); pi-ToolSearch-Verhalten; ob Codex-Sessions die dangling Knowledge-Pfade bemerkt haben.
stand: 2026-08-30
---

# Reichweite und Frische der stehenden Werkzeug-Infrastruktur

2026-08-30, Lane `fleet/260830124819-b585`. Frage: **Erreicht die stehende Werkzeug-Infrastruktur die Orte, an denen gearbeitet wird, ist sie frisch, und wird sie benutzt?** Messfall ist der Private-repo-o-Lauf.

Coverage-Plan: Hook-Settings beider Repos lesen, Rebuild-Mechanismus am graphify-Quelltext verifizieren, Stale-Fenster aus git reflog/main gegen Datei-mtimes der Rebuild-Artefakte setzen, Memory-/Knowledge-Reichweite per Verzeichnis census, Nutzung aus per-Skript indexierten Transkripten (8 jüngste Fleet-MAIN-Sessions, 51 Private-repo-o-Transkript-Dateien über 30 Slugs) greppen.

## Ergebnis (gerankt nach Kosten/Nutzen-Saldo)

### F1 — Graph-Reichweite: der Graph existiert nur dort, wo im Lauf NICHT gearbeitet wurde [verifiziert]

- `graphify-out/` (7,6 MB, 7708 Knoten) existiert ausschließlich im Fleet-Haupt-Checkout; es ist **gitignored** (.gitignore:45 und eigene Zeile für `graphify-out/`) — getrackte Dateien reisen in Worktree-Lanes, der Graph nie.
- Die Spiel-Repos haben kein `graphify-out/`, kein `.claude/`-Verzeichnis, keine Hooks (`ls /Users/owner/private-repo-o.worktrees/game-maker-private-repo-o-fresh/.claude/`, `ls /Users/owner/private-repo-o/.claude/` — leer/fehlgeschlagen).
- Nutzung im Private-repo-o-Lauf: **0** graphify-Calls in allen 51 indexierten Transkript-Dateien (2226 Bash-Calls, 149 grep-in-Bash als untere Schranke bei 150-Zeichen-Index-Truncierung; Auftraggeber zählte 387 plain grep). Der CLI liegt auf PATH (`/Users/owner/.local/bin/graphify`) — erreichbar, aber niemand hat ihn gerufen, und es gab nichts zu fragen.
- Nutzung im Fleet-MAIN (zum Vergleich): 7 aktive Sessions heute, **9 echte `graphify query`-Calls** gegen **402 Search-Nudges + 28 Read-Nudges** (45:1). Die Nutzung existiert also — aber nur am einzigen Ort mit Graph.

**Kosten:** Jede Orientierungsfrage im Spiel-Lauf wurde per Volltext-grep statt Graph-Traversal beantwortet; die Lane-Audits (R7–R13) legen nahe, dass ein Teil der 149+ grep-Runde mit einem `graphify query`-Auszug im Brief entfiele. **Fix:** (a) `graphify hook install` + ein initialer Build im Spiel-Haupt-Repo — die git-Hooks (post-commit/post-checkout) halten ihn dann wie im Fleet-Repo automatisch frisch; Aufwand einmalig ~10 min (Klein-Repo). (b) Da der Graph in Lanes nie ankommt: einen **Query-Auszug** (2–4 vorbereitete `graphify query`/`explain`-Ergebnisse zu den Brief-Kernsymbolen) ins Kontext-Pack je Brief — das ist die Form, in der der Graph reisen kann. Aufwand: Briefvorlage + ein Skript, ~30 min.

### F2 — Server-Lands triggern KEINEN Rebuild: Fast-Forward macht keinen Commit, post-commit feuert nie [verifiziert]

- Der Seed-Fakt „PostToolUse ruft graphify" ist **falsch**: `.claude/settings.json` des Fleet-Repos enthält nur PreToolUse-Guards; die Rebuilds stammen aus den **git-Hooks** `.git/hooks/post-commit` und `post-checkout` (installiert von `graphify hook install`; Quelltext `graphify/hooks.py`, Markierung „[graphify hook] N file(s) changed").
- Der Server landet per `git merge --ff-only` (server.ts:5120, `gitRetry(holder.path, "merge", "--ff-only", branch)`) — ein Fast-Forward erzeugt **keinen Commit** und keinen Checkout: weder post-commit noch post-checkout feuern. Lane-Commits im Worktree skipped der Hook ohnehin per Guard (`_GFY_GITDIR != _GFY_COMMONDIR → exit 0`).
- **Stale-Zeitachse heute** (Reflog des Haupt-Checkouts gegen mtimes: erste heutige Rebuild-Sicherung 09:05:23, Sicherungs-graph.json 13:37:08, `graphify-out/graph.json` 14:43:33, Log 14:43:56):
  - 12 Lands (alle „merge fleet/…: Fast-forward": 00:16, 02:20, 07:17, 08:27, 09:10, 11:23, 12:14, 13:33, 14:38, 14:39, 14:41, 14:42) → **0 direkte Rebuilds**.
  - 11 direkte Commits im Haupt-Checkout (09:05:19 … 14:43:52) ↔ exakt **11 topologieändernde Rebuilds** im Log (`-> 2026-08-30/`-Zählung) — 1:1.
  - Stale-Fenster Land→nächster Rebuild: **8h49m** (Land 00:16 → 09:05, über Nacht; der Graph stand seit Vortag 18:28), tagsüber Worst **2h14m** (Land 11:23 → 13:37), daneben 1h23m, 3m, ≤5m.
- Der Schmerz ist schon bezahlt worden: um 09:11:10 lief in einer Session manuell `graphify update . 2>&1 | tail -2` mit Beschreibung „graphify-Graph nach dem docs-Land aktualisieren" — **48 s nach dem 09:10:22-Land** (Transkript f0cb53c8, Zeile 425). Kein Cron, kein LaunchAgent (geprüft) — Rebuilds kommen nur aus git-Hooks und manuellen Updates.

**Kosten:** Bis zu 2¼ h am Tag antwortet der Graph auf Code-Fragen mit Vortages-Topologie; bei Docs-lastigen Lands fehlen Knoten (heutige 14:43-Rebuilds: 7701→7708 Knoten auf INDEX.md/Notiz-Änderungen — Docs stehen im Graph). **Fix:** Der Server stößt nach successful `--ff-only`-Land einen detached `graphify update .` im Haupt-Checkout an (dieselbe detached-launch-Technik wie der git-Hook) — oder ein `.git/hooks/post-merge` (ob post-merge bei FF feuert, ist ungemessen und vor einem Land billig an einem Wegwerf-Repo zu testen). Aufwand: klein (~5–15 Zeilen im Land-Pfad bzw. ein Hook-Skript). Alternativ minimalinvasiv: die.MAIN-Pflege-Routine „nach jedem Land `graphify update .`" als eine Zeile in den MAIN-Brief.

### F3 — Knowledge-Shelf: der Pointer für pi- und Codex-Sessions hängt in der Luft [verifiziert]

- `~/.claude/knowledge/` existiert (INDEX.md, brief-principle, judge-calibration, prompt-axioms, reflexive-operation, sharpen-corpus, stacks/, verification-hierarchy) und wird von Claude-Sessions über `~/.claude/CLAUDE.md:8–9` on-demand geladen.
- Das globale `/Users/owner/AGENTS.md` (identisch mit `~/.Codex/AGENTS.md`, md5 `42934ada…`) referenziert aber `~/.Codex/knowledge/` — **dieses Verzeichnis existiert nicht**. Pi- und Codex-Sessions, die AGENTS.md laden (pi lädt es nachweislich — ich selbst habe es im Kontext), folgen einem toten Pointer; die echte Shelf liegt im Claude-spezifischen Overlay, das sie per Ladevertrag nicht wholesale lesen sollen.
- **Selbstauskunft (Testfall pi/GLM = diese Lane):** Ich habe im Kontext: globales + Projekt-AGENTS.md, den Graphify-Skill-Pointer aus `~/.agents/skills/graphify/` (Version 0.9.32, weicht nur in ~2 Plattform-Wortzeilen von Claude-Kopie und Repo-Kopie ab — beide 0.9.32, md5-gleich untereinander). Ich habe NICHT: die Knowledge-Shelf (Pointer dangelt), die 13 Agents aus `~/.claude/agents/`, die Repo-Skills `mess-notiz`/`kriterium-grill`/`unslop` (getrackt und damit lane-reisend, aber pi lädt `.claude/skills/` nicht — die Notiz-Konvention musste ich per Datei-Lesung holen), kein Auto-Memory.

**Kosten:** Jede pi-/Codex-Lane verliert die portablen Arbeitskonzepte (Brief-Prinzip, Verifikationshierarchie, Kalibrierung), die exactly für „framing a non-trivial task" gebaut sind. **Fix:** ein Symlink `~/.Codex/knowledge → ~/.claude/knowledge` (oder Pointer-Korrektur in AGENTS.md auf den realen Pfad). Aufwand: 1 Zeile. Ertrag: 8 Konzeptdateien werden für alle Harnesses erreichbar.

### F4 — Memory: 422 Lane-Slugs, null Erbe [verifiziert]

- Memory-Verzeichnisse mit MEMORY.md: 8 Slugs — alles Haupt-Checkouts (`-claude-fleet` 2,5 KB heute 10:48; `-private-repo-o` 1,7 KB heute 13:59; `-owner` 17,5 KB 08-03; ferner demo/content-pipeline/rag-job/private-repo-e/tower). Kein einziger der 422 Worktree-Slugs unter `~/.claude/projects/` hat ein MEMORY.md (einziges Treffer-Verzeichnis ist ein `/tmp`-Scratchpad-Artefakt).
- Damit ist der Lane-C-Befund strukturell: Das MAIN-Memory (`-Users-owner-claude-fleet/memory/`) ist an den cwd-Slug gebunden; eine Lane im Worktree startet mit leerem Memory. Der Critic fiel 41 min später in die notierte Falle (docs/messungen/2026-08-30-lane-audit-critic-main-glm.md).

**Kosten:** Wiedererfundene Falle je Lane, im Lauf belegt. **Fix (Vorschlag aus Lane C, hier mit Zahlen unterlegt):** Lane-relevante Fallen gehören in **getrackte, reisende Flächen** — AGENTS.md und Briefvorlagen des Spiel-Repos (getrackt = in jedem Worktree vorhanden), nicht ins MAIN-Memory. Das Fleet-Repo macht es mit `.claude/skills/` genau so vor (reist), nur eben für Claude-Sessions; für pi-Lanes hilft nur der AGENTS.md/Brief-Weg, weil pi `.claude/skills/` nicht lädt (F3-Selbstauskunft). Aufwand: Redaktionsakt, kein Mechanismus.

### F5 — Nudge-Ökonomie: 402 Ermahnungen, 9 Nutzungen — drosseln, nicht absstellen [verifiziert / Kontextkosten abgeleitet]

- Per-Skript-Index der 8 jüngsten Fleet-MAIN-Transkripte (mtime heute 10:33–14:51): Search-Nudges („MANDATORY: … You MUST run `graphify query` …") 48/50/6/34/198/52/14/0 = **402**; Read-Nudges **28**; echte graphify-Calls 11 (9 query, 1 update, 1 ls-Sonde).
- Worst Case eine Session: **198 Nudges ≈ 47 KB** injizierter Mahntext (à ~240 B [abgeleitet aus cli.py:18–24]; das Transkript speichert ~950 B je Vorkommen inkl. Hülle). Der Nudge hängt an jedem grep-artigen Bash- und jedem Grep-Call — Sessions, die viel per plain grep arbeiten, zahlen ihn pro Call.
- Saldo: Ohne Nudge wären vermutlich auch die 9 Queries nicht gelaufen (Gegenfaktisch — ungemessen); 45:1 ist aber ein schlechtes Verhältnis für eine Mahnung, die im Spiel-Repo (wo sie nada ausrichten würde, weil kein Graph) ohnehin nie installiert war.

**Fix:** Drosseln: Nudge nur 1× je Session feuern (Zählerdatei im graphify-Cache, upstream-Änderung am hook-guard), oder repo-seitig den Matcher von `Bash|Grep` auf `Grep` verengen und Bash dem Modell überlassen. Aufwand: klein (Settings-Zeile) bis mittel (upstream). NICHT absstellen — die 9 Queries zeigen, dass der Graph Nutzen stiftet, wenn er frisch und erreichbar ist (F1/F2 zuerst fixen).

### F6 — MCP-Discovery: 31 ToolSearch-Calls = je Session Neusuche; Brief-Zeile reicht, Env-Weg ungemessen [verifiziert]

- 31 ToolSearch-Calls über den Lauf, Muster: `{'query': 'select:mcp__plugin_playwright_playwright__browser_navigate,…'}` — je Session 1–4 select-Calls auf Playwright-Plugin-Tools (4×/4×/4×/2×/2×… Häufigkeitsliste). Das ist Claude-Codes Deferred-Tools-Design: Plugin-MCP-Werkzeuge laden auf Abruf — der Auftrags-Kontext (25×) und meine Zählung (31× über 51 Dateien inkl. heutiger Audits) zeigen dieselbe Struktur.
- Der Fix aus Lane B/C — fertige `ToolSearch select:`-Zeile als ENV-VORBEREITUNG im Brief (docs/messungen/2026-08-30-lane-audit-akt2-r10-r13-glm.md:80) — ist ausreichend für das beobachtete Muster: Sessions mit der Zeile im Brief sparen 1–4 Calls und die Suche. Einen Env-Schalter zum Eager-Loaden konnte ich lokal nicht verifizieren (nicht-gemessen).

**Kosten:** ~2–4 Calls + wenige KB je Session. **Fix:** Briefzeile (schon formuliert, Aufwand ~0). Kein Env-Weg empfehlen, solange unbelegt.

### F7 — Hook-Inventar und Saldo je Hook [verifiziert]

Aktiv: global 8 (`~/.claude/settings.json`), Fleet-MAIN 2 graphify-Guards (gitignored `.claude/settings.json`), Spiel-Repos 0.

| Hook | Verhindert nachweislich | Kosten im Messfall | Saldo |
|---|---|---|---|
| `guard-tail-pipe-on-longrunner.sh` (Bash) | Piped Langläufer durch `tail/head` ohne `-f` → Puffer bis EOF: „gesunder langsamer Job sieht tot aus" (Skriptkopf 1–7) | Private-repo-o-Lauf: **16 BLOCKED** in 5 Transkript-Dateien; Fleet-Slug historisch ~136 BLOCKED-Ereignisse; R11 ~2 Calls + Umleitungs-Workaround | **positiv, aber gesprächsbedürftig** — das Block-Muster („in Datei umleiten") gehört in jede ENV-VORBEREITUNG (steht seit Akt-2-Notiz :80 drin) |
| `block-no-verify.sh` (Bash) | `--no-verify`-Bypass (9 Zeilen, hard block) | 0 beobachtete Blocks im Lauf | positiv, gratis |
| `pre-edit-guard.sh` + `config-protection.sh` (Edit/Write) | Gefährliche Dateien (danger-zones.conf), Linter-Config-Weichspülung | 0 beobachtete Blocks | positiv, gratis |
| `post-edit-format.sh` (Edit/Write) | Formatierungsdrift (biome/prettier je Edit) | Formatter-Latenz je Edit, nie blockend | neutral-positiv |
| `stop-reminder.sh`, `check-console-log.sh`, `verify-code-tested.sh` (Stop) | Erinnerungen (Chime, console.log, Test-Reminder) — advisory | trivial | neutral |
| `graphify hook-guard search/read` (Fleet-MAIN) | nichts Härtes — Mahnung | 402+28 Nudges, ~47 KB Worst-Case-Session | siehe F5 — drosseln |

Die globalen Hooks (~/.claude/settings.json) griffen im Private-repo-o-Lauf durchaus — die 16 tail-pipe-Blocks in den Lanes beweisen es. Was dem Lauf fehlte, waren die **repo-gebundenen** graphify-Guards und der Graph selbst: kein `.claude/` im Spiel-Repo heißt null Graph-Nutzen bei weiterbestehender globaler Hook-Reibung.

## Reichweiten-Matrix (Werkzeug × Kontext; Zelle: existiert/erreichbar · frisch · benutzt, mit Beleg)

| Werkzeug | Fleet-MAIN (Claude) | Fleet-Lane (Claude) | Fleet-Lane (pi/GLM, ich) | Spiel-MAIN (Claude) | Spiel-Lane (Claude) |
|---|---|---|---|---|---|
| graphify-Graph | existiert (gitignored, 7708 Knoten) · Rebuild nur bei direkten Commits (11:11 heute); nach Lands stale bis 2h14m/8h49m · **benutzt: 9 query / 7 Sessions** | nie (reist nicht) · — · 0 | nie · — · 0 | **nie** · — · 0 (51 Transkripte) | nie · — · 0 |
| graphify-CLI | ✓ PATH · — · siehe oben | ✓ PATH · — · 0 | ✓ PATH · — · 0 | ✓ PATH · — · 0 | ✓ PATH · — · 0 |
| Nudge-Guards | ✓ (settings gitignored) · — · 402:9 | nein · — · — | nein (pi kennt keine CC-Hooks) · — · — | nein · — · — | nein · — · — |
| Auto-Memory | ✓ 2,5 KB (heute 10:48) · — · MAIN-only | ✗ 0/422 Slugs | ✗ (kein Mechanismus) | ✓ 1,7 KB (heute 13:59) | ✗ |
| Knowledge-Shelf | ✓ via `~/.claude/CLAUDE.md:8` | Pointer dangelt (`~/.Codex/knowledge` fehlt) | Pointer dangelt (Selbstversuch) | ungemessen | ungemessen |
| Repo-Skills (`mess-notiz` …) | ✓ | ✓ getrackt → reist | ✗ (pi lädt `.claude/skills/` nicht) | n/a | n/a |
| MCP deferred tools | 3 ToolSearch (8 Sessions) | je Session neu | ungemessen (pi) | 31 ToolSearch im Lauf | je Session neu |
| Stop/Edit-Hooks (global) | ✓ | ✓ (16 Blocks im Lauf zeugen) | ✗ | ✓ | ✓ |

## Die zwei besten Fixes je Ertrag/Aufwand

1. **Graph dorthin, wo gearbeitet wird (F1):** `graphify hook install` + initialer Build im Spiel-Haupt-Repo (~10 min, einmalig) — ab dann hält der gleiche Mechanismus, der im Fleet-Repo funktioniert, den Spiel-Graphen bei jedem direkten Commit frisch; und **Query-Auszug in den Brief** (2–4 vorbereitete query/explain-Ergebnisse zu den Brief-Kernsymbolen), weil der Graph selbst nie in eine Lane reist. Das beantwortet die Owner-Frage direkt: „ob sich graphify oft genug selbst neu indexed" — im Fleet-MAIN ja (bei jedem direkten Commit), aber das nützt nichts, wo kein Graph liegt; Reichweite vor Frequenz fixen.
2. **Land → Rebuild (F2):** detached `graphify update .` im Haupt-Checkout nach jedem erfolgreichen `--ff-only`-Land (~5–15 Zeilen im Server-Land-Pfad) — eliminiert die 2h14m-Fenster und die manuellen Nachpflege-Calls (belegt: 09:11:10 „nach dem docs-Land aktualisieren").

Dahinter ( trivial, aber eigener Rang): Knowledge-Pointer reparieren (F3, 1 Zeile) — macht die portablen Konzepte für pi/Codex-Lanes erreichbar.

## Methode

- Index-Skript (aus dem Brief übernommen, `python3`, eine Zeile je tool_use/tool_result, Input auf 150 B gekürzt) über: 8 jüngste `~/.claude/projects/-Users-owner-claude-fleet/*.jsonl` (mtime 10:33–14:51 heute) und 51 `*.jsonl` über alle 30 Private-repo-o-Slugs. Ausgaben nach `/tmp/infra-audit/` (Scratchpad, nicht im Repo). Nudges per `grep -c` auf die Mahntexte direkt in den JSONL gezählt.
- Rebuild-Zeitachse: `git reflog --date=iso` (Haupt-Checkout) gegen `stat`-mtimes von `graphify-out/graph.json`, Sicherungsverzeichnissen `graphify-out/2026-08-29|30/` und `~/.cache/graphify-rebuild.log` (das Log selbst trägt KEINE Zeitstempel — Zeiten nur über Artefakt-mtimes belegbar; 11 topologieändernde Rebuilds heute per `grep -c -- '-> 2026-08-30/'`).
- Memory-Census: `ls -d ~/.claude/projects/*/memory` + `stat` der MEMORY.md; Worktree-Slug-Zählung per `grep -c worktree`.
- Hook-Inventar: `.claude/settings.json` beider Repos + `~/.claude/settings.json`, Skriptköpfe gelesen; graphify-Mechanik aus `graphify/hooks.py` + `cli.py:15–60,491+` (Site-packages der uv-Installation).
- BLOCKED-Zählung: `grep -ho 'BLOCKED…'` über die Transkript-Körper.

## Was nicht gemessen wurde

- Ob `git post-merge` bei `--ff-only` feuert (vor einem echten Land nicht testbar ohne Schreiben).
- Ob Claude Code die Nudge-additionalContext pro Call vollständig in den Modellkontext injiziert oder dedupliziert (nur Transkript-Vorkommen gezählt; Byte-Schätzung ist abgeleitet).
- pi-harnessseitiges ToolSearch/MCP-Verhalten; ob Codex-Sessions dem dangling Knowledge-Pointer je gefolgt sind.
- Ob ohne Nudge auch die 9 Fleet-MAIN-Nutzungen weggefallen wären (Gegenfaktisch).
- fleet.json wurde gelesen (Slot-/Harness-Felder für Kontext-Zuordnung); enthaltene Tokens sind hier NICHT übernommen und dürfen in keinen Bericht.

---
frage: Woraus bestehen die ~69 k Tokens, mit denen jede Claude-Lane ihren ersten Turn beginnt?
urteil: Eine Lane startet bei 71 387 Tokens, 70 316 davon sind Posten zugeordnet (+1,4 % gegen p50 69 314). 32 467 sind der feste Praefix (davon ~30 200 Werkzeug-Schemas), 18 335 der Lane-CLAUDE.md-Render, 6 618 das Skill-Listing, Brief/globale CLAUDE.md/MEMORY.md/Agent-Listing je ~2,6–2,9 k. Hooks und AGENTS.md kosten beim Start 0. Kuerzbar sind am meisten der Render (~6,6 k), die von Lanes ungenutzten Werkzeuge (≥4,9 k gemessen) und die Listings (2,3–8,1 k).
bereich: [lane-kontext, kontext, briefs]
belege: [~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*/ (180 Lane-Transkripte, 14 d), ~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-260913170128-3d03/bee9e7e9-2a84-4468-b809-765dd88f3cea.jsonl, server.ts#slotCmd, rulebook.ts, docs/messungen/opus-lane-kontextkosten-2026-09-12.md, docs/messungen/2026-09-13-lane-kontext-sub-worker-glm.md, docs/plan-fleet-betrieb-2026-09-13.md]
nicht-gemessen: Token-Schemas der nur interaktiv geladenen Werkzeuge (Artifact, AskUserQuestion, SendFeedback) einzeln; ob --disallowedTools interaktiv genauso schrumpft wie in -p; Postenzerlegung anderer Lanes als dieser einen; Fremd-Harness-Lanes; Geld; Wrapper-Rest 1 071
stand: 2026-09-13
---

# Woraus besteht der Start-Kontext einer Claude-Lane?

2026-09-13, Lane `fleet/260913170128-3d03`, Claude Code 2.1.270, `claude-opus-5[1m]`, effort high.
Frage: **Welche Posten ergeben die ~69 k Tokens des ersten Turns, und welche davon lassen sich kuerzen?**

## Ergebnis

**Grundgroesse.** „Start-Kontext" = `input_tokens + cache_creation_input_tokens +
cache_read_input_tokens` der ersten `assistant`-Zeile eines Lane-Transkripts. Ueber 180 Transkripte
unter `~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*` der letzten 14 Tage:
p10 66 708 · **p50 69 314** · p90 73 492 · min 60 621 · max 77 402 (Opus 5: n=161, p50 69 317;
Fable 5.1: n=19, p50 69 314). Die Zahl aus dem Plan (Slot 5, 174 Lanes) ist damit reproduziert.
Sie steigt: Tages-p50 67–69 k bis 09-08, 72 717 am 09-13 (n=22).

**Zerlegt wurde eine Lane: diese.** Erster Turn 71 387 = 2 + 38 918 cache_creation + 32 467
cache_read. Die Posten stammen aus den `attachment`-Zeilen desselben Transkripts vor der ersten
Antwort. Jeder Text wurde einzeln per Injektions-Probe in Tokens gemessen (§Methode).

| Posten | Tokens | Art | Anteil |
|---|---:|---|---:|
| **Fester Praefix** (Werkzeuge + Systemprompt; identisch in allen 19 Lanes vom 09-13) | **32 467** | gemessen (cache_read) | 45,5 % |
| · Systemprompt (`prompt_snapshot`, 6 695 Zeichen) | 2 267 | gemessen | |
| · Werkzeug-Schemas (Praefix minus Systemprompt) | ~30 200 | abgeleitet | |
| **Lane-CLAUDE.md-Render** (36 092 Zeichen) | **18 335** | gemessen | 25,7 % |
| · §Loader-Vertrag | 1 494 | gemessen | |
| · §Lane discipline | 11 863 | gemessen | |
| · §Self-scheduling | 4 546 | gemessen | |
| · §Was in dieser Fassung NICHT steht | 433 | gemessen | |
| **Skill-Listing** (66 Zeilen, 18 581 Zeichen) | **6 618** | gemessen | 9,3 % |
| · davon Figma-Plugin (14 Zeilen) | 2 287 | gemessen | |
| Globale `~/.claude/CLAUDE.md` (8 030 Zeichen) | 2 885 | gemessen | 4,0 % |
| `MEMORY.md` des Projekts (AutoMem, 5 787 Zeichen) | 2 806 | gemessen | 3,9 % |
| Brief dieser Lane (5 569 Zeichen) | 2 619 | gemessen | 3,7 % |
| Agent-Listing (21 Typen, 6 822 Zeichen) | 2 569 | gemessen | 3,6 % |
| Kleinkram (environment, model, session_context, remote_session_change, date, total_tokens) | ≤1 152 | gemessen als JSON, Obergrenze | 1,6 % |
| Deferred-Tool-Namen (inkl. Playwright-MCP und claude.ai-Connectoren) | 865 | gemessen | 1,2 % |
| `~/.claude/rules/typescript.md` | 0 | nicht im `instructions`-Attachment | |
| `AGENTS.md` | 0 beim Start; 8 679, wenn ganz gelesen | gemessen | |
| Hooks | 0 | keine `SessionStart`/`UserPromptSubmit`-Hooks | |
| **Summe der Posten** | **70 316** | | |
| Rest (Attachment-Wrapper) | 1 071 | abgeleitet | 1,5 % |

**Summe 70 316 gegen p50 69 314: +1,4 %.** Gegen das Tages-p50 vom 09-13 (72 717): −3,3 %. Beide
Abweichungen liegen innerhalb von 10 %.

**Der Brief am Median.** Das erste `user`-Element hat im p50 7 639 Zeichen (p10 4 845, p90 11 149).
Diese Lane misst 0,470 Tokens/Zeichen. Ein Median-Brief kostet damit ~3 600 Tokens (abgeleitet).
Den Brief zu halbieren spart ~1,8 k, das ist weniger als jeder der drei Posten unten.

**Anstieg.** Der cache_read-Praefix lag bei 92 der 180 Lanes bei 26 448 und bei den 19 Lanes vom
09-13 bei 32 467. Die +6 019 kommen aus Werkzeugen und Systemprompt, nicht aus Fleet-Texten
(abgeleitet: der Praefix enthaelt keinen Lane-Inhalt).

**Die „~43 k anderer Projekte" (abgeleitet).** Praefix 32 467 + globale CLAUDE.md 2 885 + Listings
~10 000 ≈ 45 k. Dazu kommen fuer eine Fleet-Lane Render 18,3 k + MEMORY.md 2,8 k + Median-Brief
3,6 k ≈ 70 k. Die Differenz zu anderen Projekten ist also im Kern der Render.

**Werkzeuge einzeln** (gemessen in `-p` als Differenz beim Entfernen aus dem Default-Satz,
24 381): Agent 3 275 · Workflow 1 979 · ScheduleWakeup 1 695 · ReportFindings 821 · Read 608 ·
ListAgents 405 · Edit 348 · Write 236. Die Werte addieren sich: Workflow+ScheduleWakeup+
ReportFindings+ListAgents zusammen entfernt = −4 900 = Summe der Einzelwerte. Das Deferral ist
bereits die groesste Ersparnis: ohne ToolSearch steigt der Probe-Kontext auf 45 481 (+21 100), weil
die MCP-Schemas dann voll geladen werden. Artifact, AskUserQuestion und SendFeedback gibt es in
`-p` nicht (`--tools Artifact` = Kontext wie `--tools ""`). Sie liegen im ungeteilten Rest von ~20,8 k
zusammen mit Bash, Skill und ToolSearch.

### Die drei groessten kuerzbaren Posten

1. **Lane-CLAUDE.md-Render, geschaetzt ~6,6 k von 18 335.** Grundlage ist die je Abschnitt
   gemessene Dichte (Lane discipline 0,519 Tokens/Zeichen, Self-scheduling 0,496). (a) Fuenf Absaetze
   in §Self-scheduling beschreiben Tueren, die einer Lane 409 antworten oder nur Controller betreffen:
   release, watch, Controller-`idleSec`, Referenz, succeed. Zusammen 4 297 Zeichen ≈ 2,1 k.
   (b) Zehn Bullets in §Lane discipline sind Mutex-, Flake- und Suite-Innenleben, das eine Lane nur
   braucht, wenn sie selbst Suiten faehrt oder adjudiziert: Suiten serialisieren · Warten GEORDNET ·
   Suite-Lauf an drei Zahlen · claude-gate DREI Phasen · Prozess per Namensmuster · Parallelitaet ·
   Flake-Familien · eigene Shas · Demo · Suite-Offer. Zusammen 8 593 Zeichen ≈ 4,5 k. Die Auswahl ist
   ein Urteil, die Dichte ist gemessen. Weg: Fragment unter `rulebook/` bzw. die Lane-Fassung in
   `rulebook.ts`, mit Verweis statt Volltext.
2. **Werkzeuge, die Lanes nicht benutzen: ≥4 900 gemessen, dazu Artifact und die anderen
   interaktiven Werkzeuge ungemessen.** Workflow (darf ohne Owner-Opt-in ohnehin nicht laufen),
   ScheduleWakeup (/loop), ReportFindings (Code-Review-Skill), ListAgents. Weg: `--disallowedTools`
   in `server.ts#slotCmd` fuer Lanes. In `-p` schrumpft der Kontext damit belegbar. Ob die
   interaktive Session das Schema ebenso weglaesst, ist ungeprueft.
3. **Listings, 2 287 sicher bis ~8 100.** Das Figma-Plugin (14 Skills, 2 287) hat in Lanes keinen
   Zweck. Es haengt an `enabledPlugins` in `~/.claude/settings.json` und ist damit Owner-Sache oder
   braeuchte ein Spawn-Override. Agent-Listing 2 569 + Agent-Werkzeug 3 275 kommen dazu, wenn Lanes
   keine Subagenten starten sollen. Die Messnotiz vom 09-13 zaehlt 0/142 Lanes mit Task-Aufruf,
   empfiehlt aber gebriefte Delegation. Das entscheidet der Owner, nicht die Messung.

Knapp dahinter: `MEMORY.md` mit 2 806, ein Index von Owner-Feedback an Controller und MAINs. Wie
Auto-Memory nur fuer Lanes abschaltbar waere, ist nicht geprueft.

## Methode

**(a) Verteilung** (`first.ts` im Scratchpad, Bun): in jeder `*.jsonl` mit mtime < 14 d unter
`~/.claude/projects/-Users-owner-claude-fleet-worktrees-fleet-*` die erste `assistant`-Zeile mit
`message.usage` nehmen und `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
summieren. Brief-Zeichen = Laenge des ersten `user`-`message.content` (String-Laenge bzw.
`JSON.stringify`). Quantil = sortierter Index `floor((n-1)·p)`.

**(b) Posten-Texte:** die `attachment`-Zeilen vor der ersten Antwort im eigenen Transkript
`bee9e7e9-…jsonl`: `instructions.files[]` (drei Dateien: globale CLAUDE.md, Lane-CLAUDE.md,
MEMORY.md), `skill_listing.content`, `agent_listing_delta.addedLines`,
`deferred_tools_delta.addedLines`, `prompt_snapshot.systemPrompt`, erstes `user.content`.

**(c) Token-Probes**, alle im Session-Scratchpad, nie im Lane-Baum, ohne Self-Token und ohne
Session-Persistenz:

```sh
# probe.sh <name> <dir> [claude-args…]
cd "$dir" && env -u FLEET_SELF_TOKEN -u FLEET_SELF_SLOT -u CLAUDECODE \
  claude -p "antworte nur ok" --output-format json --model 'claude-opus-5[1m]' \
  --no-session-persistence "$@" </dev/null 2>/dev/null
# Zahl = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
```

Injektion: der zu messende Text wird als `CLAUDE.md` in ein leeres Verzeichnis gelegt. Posten =
Probe − Kalibrierung (`CLAUDE.md` = `x`, 24 495, enthaelt den Datei-Header). Die Rohwerte:

| Probe (`<dir>` · Args) | total |
|---|---:|
| leer | 24 381 |
| Kalibrierung `x` | 24 495 |
| Lane-CLAUDE.md-Render | 42 830 |
| · nur §Loader / §Lane discipline / §Self-scheduling / §NICHT steht | 25 989 / 36 358 / 29 041 / 24 928 |
| Kopie `~/.claude/CLAUDE.md` | 27 380 |
| Kopie `MEMORY.md` | 27 301 |
| Kopie `AGENTS.md` | 33 174 |
| Systemprompt-Snapshot | 26 762 |
| Skill-Listing / nur Figma-Zeilen | 31 113 / 26 782 |
| Agent-Listing | 27 064 |
| Deferred-Tool-Namen | 25 360 |
| Brief | 27 114 |
| Kleinkram-JSON | 25 647 |
| leer · `--disallowedTools <T>`: Agent / Workflow / ScheduleWakeup / ReportFindings / Read / ListAgents / Edit / Write | 21 106 / 22 402 / 22 686 / 23 560 / 23 773 / 23 976 / 24 033 / 24 145 |
| leer · `--disallowedTools Workflow ScheduleWakeup ReportFindings ListAgents` | 19 481 |
| leer · `--disallowedTools ToolSearch` | 45 481 |
| leer · `--tools ""` / `--tools Artifact` / `--tools AskUserQuestion` / `--tools SendFeedback` | 12 612 / 12 612 / 12 612 / 12 612 |
| leer · `--strict-mcp-config` / `--setting-sources ""` / `--setting-sources project` | 23 428 / 15 733 / 15 551 |
| leer · `--bare` | Abbruch „Not logged in" |

Hooks: `grep` nach `SessionStart|UserPromptSubmit|PreCompact|SubagentStart` in
`~/.claude/settings.json`, `~/.claude/settings.local.json` und `.claude/settings.json` ergab keinen
Treffer. Die vorhandenen Hooks (PreToolUse, PostToolUse, Stop, PermissionRequest, Notification)
feuern erst nach dem ersten Turn. User-MCP in `~/.claude.json`: keine. `~/.claude`, Plugins und
Settings wurden nur gelesen.

## Was nicht gemessen wurde

- **Die interaktiven Werkzeuge einzeln.** Artifact, AskUserQuestion und SendFeedback laden in `-p`
  nicht. Ihr Anteil steckt im Rest von ~20,8 k (mit Bash, Skill, ToolSearch). Nach Textlaenge ist
  Artifact der groesste, in Tokens nicht gemessen.
- **`-p` gegen interaktiv.** Die Werkzeug-Deltas stammen aus `-p`. Dort traegt Agent 3 275
  moeglicherweise das Agent-Listing mit, und Bash/Skill zu entfernen *vergroesserte* den Probe-Kontext
  (+270 / +150). Die Deltas gelten also nur in `-p` einzeln. Interaktiv sind nur Praefix und
  Attachment-Texte gemessen.
- **Ob `--disallowedTools` in einer interaktiven Lane die Schemas weglaesst.** Das waere der erste
  Schritt vor Hebel 2.
- **Andere Lanes.** Zerlegt ist eine Lane vom 09-13. Fuer die 180 ist nur die Summe gemessen, nicht
  die Posten. Aeltere Lanes haben einen kleineren Praefix (26 448) und andere Render-Staende.
- Kodierungs-Overhead der Attachment-Wrapper (Rest 1 071), Fable-Tokenizer getrennt (die p50 beider
  Modelle sind gleich), Fremd-Harness-Lanes (pi, codex), Geldkosten, und ob eine schmalere Lane
  schlechter arbeitet.

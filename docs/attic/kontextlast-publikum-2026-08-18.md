# Kontextlast nach PUBLIKUM — Inventar 2026-08-18

**Was diese Datei ist:** die Messung, welche Bytes ungefragt in ein Kontextfenster fallen, aufgeteilt
danach, WER sie lädt. Sie ist der Nachfolger der Frage aus `HANDOFF.md` §1 („Das Regelbuch muss nicht
als ein Monolith in jedem Präfix liegen") und die Vorarbeit für Runde 3 des Rulebook-Schnitts.

**Was sie NICHT ist:** ein Schnitt. Hier wird nichts verschoben und nichts gelöscht.

**Anlass:** Owner-Frage 2026-08-18 — „ich will den Kontext-Usage der einzelnen Sessions zurückfahren,
indem ich die Briefe optimiere". Die Messung sagt: **die Briefe sind es nicht.**

## 0. Umrechnung

**2,02 Byte/Token.** Gemessen von Supervisor-Occupant 6 an einer frisch geöffneten Session
(`HANDOFF.md` §2, Tabelle „Startlast"), nicht geschätzt. Wer künftig Byte in Token umrechnet, nimmt
diese Zahl. Alle Byte-Zahlen unten sind am 2026-08-18 gelesen; HANDOFFs Liste „Abschnitte heute" ist
seit Runde 2 (`10ddcab`, `7b5df89`) überholt und darf nicht zitiert werden.

## 1. Was ungefragt in JEDE Session fällt

| Quelle | Bytes | ~Tokens | Lane | MAIN | Supervisor |
|---|---:|---:|:-:|:-:|:-:|
| `CLAUDE.md` (Projekt) | **61.822** | **~30.600** | ja (Spawn-Kopie) | ja | ja |
| `~/.claude/CLAUDE.md` (global) | 8.090 | ~4.000 | ja | ja | ja |
| `MEMORY.md` (Index, 33 Dateien dahinter) | 5.779 | ~2.860 | **nein** | ja | ja |
| `.claude/CLAUDE.md` | 226 | ~110 | ja | ja | ja |
| `AGENTS.md` | 9.572 | ~4.740 | nur pi/codex | – | – |
| **Summe Regelwerk** | **75.917** | **~37.570** | | | |

**Die `MEMORY.md`-Zeile ist GEMESSEN, nicht angenommen:** unter keinem der ~40
Worktree-Projektschlüssel in `~/.claude/projects/` existiert ein `memory/`-Verzeichnis — nur unter
dem Schlüssel des Haupt-Checkouts, dem Demo-Repo und einem Scratchpad-Pfad. Eine Lane bekommt die
Auto-Memory strukturell nicht. Wer das Gegenteil annimmt, überschätzt die Lane-Last um ~2.860 Tokens.

## 2. Harness-Fixkosten, repo-unabhängig, jede Session

| Quelle | Bytes | ~Tokens |
|---|---:|---:|
| Skill-Beschreibungen (15 user/projekt) — davon **figma 6.282 in 12 Skills** | 7.281 | ~1.800 |
| Command-Beschreibungen (26) | ~5.000 | ~1.250 |
| Agent-Beschreibungen (13) | 3.533 | ~880 |

Nur die Frontmatter-`description` lädt, nicht der Skill-Körper: `graphify/SKILL.md` ist 40.495 B,
davon laden 371. Das ist der Grund, warum ein großer Skill billig und ein Plugin mit zwölf kleinen
Skills teuer ist.

## 3. Die Briefe — der vermutete Hebel, der keiner ist

| Brief | Fundstelle | Bytes |
|---|---|---:|
| `supervisorBriefBody` (4 Zeilen, von Gründung UND Nachfolge geteilt) | `server.ts:12528` | **848** |
| `buildSuccessionBrief` (MAIN, ohne carry) | `server.ts:4997` | 377 |
| `buildProgramMainBrief` fleet-control (ohne Programm-JSON) | `server.ts:12467` | 587 |
| `buildClarifyBrief` | `clarify-prompt.ts:22` | ~2.400 |
| ContextPlan-Ankerblock | `server.ts:6150` | **nur Zeiger**, eine Zeile je Anker, nie Quelltext |

**Summe aller Briefe: ~4,2 KB ≈ ~2.080 Tokens.** Das Regelbuch allein ist ~30.600 Tokens. Selbst ein
perfekter Brief-Schnitt spart unter 2.000 Tokens und macht den Brief dabei schlechter — die
Brief-Checkliste für fremde Modelle (`CLAUDE.md`, GPT-Lane-Abschnitt) verlangt ausdrücklich
VOLLSTÄNDIGERE, nicht kürzere Briefe.

## 4. Die Sektionen des Regelbuchs nach Publikum

| Sektion | Bytes | Lane | MAIN | Supervisor |
|---|---:|:-:|:-:|:-:|
| Lane discipline | **21.520** | ja | teils | **nein** |
| Deploy | **14.957** | **nein** | ja | **nein** |
| Einstieg frische MAIN-Session | **14.879** | **nein** | ja | teils |
| Self-scheduling | 5.556 | teils | ja | ja |
| Loader-Vertrag | 2.166 | ja | ja | ja |
| Supervisor-Rolle | 1.497 | **nein** | **nein** | ja |
| graphify | 1.231 | **nein** | ja | ja |

Zwei dieser „nein" stehen wörtlich in der Datei selbst: `## Einstieg` trägt im TITEL „nicht für Lanes
— die haben ihren Brief", und `## graphify` sagt einer Lane im ersten Absatz, dass die Regeln bei ihr
nicht greifen. Beide werden trotzdem vollständig in jede Lane kopiert.

## 5. Der Befund

- **~38 KB (62 %) des Regelbuchs lädt jede Lane und braucht sie nie** (Deploy + Einstieg +
  Supervisor-Rolle + graphify + der Nicht-Lane-Teil von Self-scheduling).
- **~36 KB lädt der Supervisor**, obwohl sein eigener Gründungsbrief ihm sagt, dass er weder landen
  noch deployen noch Code schreiben kann (`server.ts:12530`).
- Der Hebel liegt an der **Kopier-Naht**, nicht im Brief.

## 6. Fünf Schnitte, nach Ersparnis geordnet

**1 · Regelbuch an der Kopier-Naht nach Publikum aufteilen — ~19.000 Tokens/Lane, ~17.800/Supervisor.**
Der Mechanismus existiert bereits: `createWorktree` (`server.ts:3748`) KOPIERT `CLAUDE.md` in die Lane
(die Datei ist gitignored, deshalb überhaupt eine Kopie). Sie kopiert heute alles. Eine Lane bekäme
Loader-Vertrag + Lane discipline + Self-scheduling = 29,2 KB statt 61,8 KB.
**Kosten:** die Bedeutungs-Probe der Runde 2 (117 Regeln, 117/117 bestanden) muss auf die Teilmengen
neu abgebildet werden; eine Lane, die doch eine Deploy-Regel braucht, hat nur noch den Zeiger.
**Der Einwand aus `HANDOFF.md` §1 gilt hier NICHT:** dort ging es um ContextPlan-Packs, die
ausschließlich Zeiger liefern und deshalb einen Read kosten. Die Kopier-Naht liefert INHALT — sie
kostet keinen Read.

**2 · figma-Plugin deinstallieren — ~1.550 Tokens in jeder Session, Kosten null.**
Zwölf Skill-Beschreibungen à 218–899 B in einem Repo ohne Figma. Ein Kommando.

**3 · `## Deploy` (14.957 B) und `## Einstieg` (14.879 B) aus der Lane-Kopie nehmen — ~14.800
Tokens/Lane.** Teilmenge von Schnitt 1; hier separat genannt als der billigste Einstieg, falls die
volle Aufteilung nicht gewollt ist.

**4 · `MEMORY.md` + 33 Memory-Dateien beschneiden — ~2.860 Tokens für MAIN/Supervisor, 0 für Lanes.**
Der Index trägt Einträge, die sich selbst als `RESOLVED` bezeichnen, und Juli-Zustände.
**Kosten:** gehört dem Owner. Kein Agent schneidet dort ohne seinen Durchgang.

**5 · Command-Beschreibungen konsolidieren — ~500 Tokens.** `sharpen`/`sharpen1`/`sharpen2`/`sharpen3`
plus `gosharp`/`gosharp1`/`gosharp2`/`gosharp3` sind acht Varianten von zwei Dingen.

## 7. Was NICHT geprüft wurde

- **Ob der Fixblock beim Supervisor überhaupt dominiert.** Occupant 6 maß 79.993 Tokens Startlast,
  aber `ctx` beim Schreiben lag bei 39 % von 1M — der Rest ist Gesprächsverlauf und Tool-Ausgaben.
  Für eine LANGE Supervisor-Session deckelt jede Regelbuch-Optimierung bei ~37.570 Tokens; darüber
  hinaus hilft nur Tool-Ausgaben-Disziplin. Für eine LANE (kurzlebig, ein Schnitt) ist der Fixblock
  fast alles.
- **Der Supervisor-Teil.** Sein Brief (848 B) ist vermessen, seine Rolle nicht: was er über den
  Gründungsbrief hinaus zieht (`/rundgang` 10.775 B, `/inspektion` 9.923 B, `/projekt-blick` 4.720 B
  — jeweils erst bei Aufruf, nicht beim Spawn), ist Schritt 2 und steht aus.
- **Ob eine geteilte Regelbuch-Kopie das Präfix-Caching bricht.** Nicht gemessen. Vor Schnitt 1 zu
  klären, weil eine pro Lane verschiedene Datei ein pro Lane verschiedenes Präfix bedeutet.

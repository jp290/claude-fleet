// Bildschirme für die Warte-Hinweis-Tests (server/warte-hinweis.test.ts, server/warte-hinweis-route.test.ts). Die
// beiden Fragen sind GEMESSEN (claude 2.1.307, manual mode, 100 Spalten, 22.10.2026), gekürzt um den Pfad des
// Wegwerf-Ordners in Wahl 2; der Rest ist Zeichen für Zeichen der Schirm, samt Leerzeilen von capture-pane am Ende.
const LINIE = "─".repeat(100);
const STRICHE = "╌".repeat(100);
const LEER = "\n".repeat(14);

export const BASH_FRAGE = ` ▐▛███▛█   Claude Code v2.1.307
▝▜██████▀  Haiku 5.5 · Claude Max
 ▝▝   ▝▝   /…/scratchpad/probe


❯ Run this exact bash command with the Bash tool and nothing else: mkdir -p sub && touch sub/x.txt

⏺ Bash(mkdir -p sub && touch sub/x.txt)
  ⎿  Waiting…

${LINIE}
 Bash command
 Tip: auto mode handles these prompts for you — choose "switch to auto mode" below
 Create sub directory and touch sub/x.txt
${STRICHE}
 mkdir -p sub && touch sub/x.txt
${STRICHE}
 Do you want to proceed?
 ❯ 1. Yes
   2. Yes, and don't ask again for mkdir -p sub and touch sub/x.txt commands in
      /…/scratchpad/probe
   3. Yes, and switch to auto mode · auto mode handles these prompts for you
   4. No

 Esc to cancel · Tab to amend
${LEER}`;

export const WRITE_FRAGE = `${LINIE}
 Create file
 notes.txt
${STRICHE}
  1 hello
${STRICHE}
 Do you want to create notes.txt?
 ❯ 1. Yes
   2. Yes, and switch to accept edits (auto-approve file edits and common file commands) for this
      session (shift+tab)
   3. No

 Esc to cancel · Tab to amend
${LEER}`;

// eine Pane, die nur wartet, weil niemand ihr schreibt: Eingabezeile und Fußzeile, gemessen am selben Start
export const LEERLAUF = ` ▐▛███▛█   Claude Code v2.1.307
▝▜██████▀  Haiku 5.5 · Claude Max
 ▝▝   ▝▝   /…/scratchpad/probe


${LINIE}
❯ Try "fix lint errors"
${LINIE}
  ctx [----------] --%  |  Haiku 5.5
  ⏸ manual mode on · ← 8 agents
${LEER}`;

// eine Session, die die Frage nur zitiert (etwa in einem Bericht): darunter steht ihre eigene Eingabezeile
export const ZITIERT = `⏺ Der Sitz stand an dieser Frage:
 Do you want to proceed?
 ❯ 1. Yes
   2. No

 Esc to cancel · Tab to amend

${LINIE}
❯
${LINIE}
  ctx [#---------] 12%  |  Opus 5.5
${LEER}`;

// GEMESSEN 22.10.2026 in 40 Spalten (claude 2.1.308, Testinstanz :8997, capture-pane -p -J): Ink bricht die Frage selbst
// um, „Do you want to create“ / „2026-10-22-lang.md?“, und kürzt den Pfad; -J fügt das nicht zusammen. Unverändert,
// samt Leerzeichen am Zeilenende.
export const SCHMAL_FRAGE: string = " ▐▛███▛█   Claude Code v2.1.308\n▝▜██████▀  Haiku 5.5 · Claude Max\n ▝▝   ▝▝   /…/branch-messung-schmal\n\n\n❯ Use the Write tool to create docs/neu \n  aufbau/befunde/2026-10-22-lang.md     \n  containing the word hallo. Nothing    \n  else.                                 \n                               \n⏺ Write(docs/neuauf…/2026-10-22-lang.md)\n                                      \n────────────────────────────────────────\n Create file                         \n …/neuaufbau/befunde/2026-10-22-lang.md \n╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n  1 hallo                               \n╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌\n Do you want to create                  \n 2026-10-22-lang.md?                  \n ❯ 1. Yes                      \n   2. Yes, and switch to accept edits\n      (auto-approve file edits and\n      common file commands) for this\n      session (shift+tab)\n   3. No\n\n Esc to cancel · Tab to amend\n\n\n\n\n\n\n\n\n\n\n\n\n";

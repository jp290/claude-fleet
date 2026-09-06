---
frage: Was laedt jede Rolle in Claude Fleet beim Start wirklich, und wo widersprechen, rotten oder fehlen die Kontextschichten (global CLAUDE.md, AGENTS.md, rulebook/, Rollen-Docs, Skills, servergebaute Briefs)?
urteil: Der teuerste Defekt ist kein Byte-Problem, sondern ein Adressierungsproblem — `HANDOFF.md` ist ein Stapel von 12 H1-Bloecken aus fuenf Rollen/Programs, und jeder Gruendungs- wie Nachfolgebrief sagt „lies nur den obersten Abschnitt", der heute einer fremden Rolle gehoert. Groessenbild: ein Controller laedt 93 946 B automatisch plus 20 138 B auf Anweisung (~28 500 Token, 11 % eines 258 400-Fensters, 2,9 % von 1M), eine Claude-Lane ~62 KB, eine pi/codex-Lane ~27 KB, der Steward ~198 KB (19 % / 4,9 %) — und im Haupt-Checkout kommen 269–487 B je Tool-Aufruf durch den graphify-Hook dazu.
bereich: [kontext, rollen, rulebook, briefs]
belege: [AGENTS.md, rulebook/loader.md, rulebook/einstieg.md, rulebook/supervisor.md, rulebook/self-scheduling.md, rulebook/graphify.md, rulebook/deploy.md, rulebook.ts#FRAGMENTS_FOR, server.ts#buildSuccessionBrief, server.ts#buildProgramMainBrief, server.ts#buildProgramMainSuccessionBrief, server.ts#supervisorBriefBody, server.ts#briefAndSend, server.ts#LANE_EXIT_FOOTER, server.ts#handoffCommittedAfterOpen, server.ts#laneRulebookFor, docs/controller.md, docs/steward.md, .claude/commands/steward.md, docs/lane-brief-template.md, .claude/skills/mess-notiz/SKILL.md, context-packs.ts, context-manifest.ts#CONTEXT_MANIFEST_PATH, .claude/settings.json, ~/.claude/CLAUDE.md, HANDOFF.md, context-receipts.jsonl]
nicht-gemessen: Pane-seitig nicht gemessen, was pi/codex tatsaechlich laden (nur die Doc-Aussage loader.md:7); `./state.sh`/`./register.sh` nicht ausgefuehrt (Ausgabegroesse unbekannt); merge-prompt.ts, analysis-prompt.ts, enhance-prompt.ts, docs/self-api.md, docs/verify-tiering.md nur nach Groesse/Ueberschriften gelesen; graphify SKILL.md nur die ersten 40 Zeilen; die Owner-Memory-Dateien ausser MEMORY.md nicht gelesen.
stand: 2026-09-06
---

# Kontext-Gesundheit der Rollen und Agenten in Claude Fleet

2026-09-06, Fable-Reviewer im Haupt-Checkout (HEAD `6c089dd`). Frage: **Was laedt jede Rolle beim
Start, wo widersprechen sich die Schichten, was rottet, was fehlt — und was kostet es den Owner?**

Methode: alle Dateien unter §4 „gelesen" mit `cat -n`; jede Behauptung gegen `rg -n` in
`server.ts`/`rulebook.ts`/`lane-signals.ts` bzw. `test -e`/`git cat-file -e` geprueft; Groessen mit
`wc -c`; die Lane-Fassung des Regelbuchs mit `renderRulebook("lane", …)` gerendert; Dispatch-
Briefgroessen aus `context-receipts.jsonl` (574 Zeilen, Median je `briefSource`). Token = Bytes ÷ 4.

## §1 Groessenbild je Rolle

Die Spalte „automatisch" ist, was der Harness ohne Zutun laedt; „auf Anweisung" ist, was der erste
Turn laut Loader/Brief lesen soll. Die letzte Zeile gilt zusaetzlich JE TOOL-AUFRUF.

| Rolle | geladene Dateien | Bytes | ~Token | % von 258 400 | % von 1 000 000 |
|---|---|---|---|---|---|
| 🎛 Controller (Haupt-Checkout, claude) | automatisch: `~/.claude/CLAUDE.md` 8 090 · `CLAUDE.md` (MAIN-Render) 81 293 · `.claude/CLAUDE.md` 226 · Memory `MEMORY.md` 4 337 = **93 946**; auf Anweisung (loader.md:5, server.ts:5764): `AGENTS.md` §Portable operating contract 13 242 · `HANDOFF.md` oberster Block 6 896 | 114 084 | 28 500 | 11,0 % | 2,9 % |
| Program-MAIN, fleet-control-Frame (claude) | wie Controller + Gruendungsbrief (Median `briefSource=founding`, n=121) 9 506 | 123 590 | 30 900 | 12,0 % | 3,1 % |
| Program-MAIN, target-repo-Frame (Astra/codex) | `AGENTS.md` des Zielrepos (hier: 21 368) + Gruendungsbrief (letzte codex-Gruendung, Slot 9: 9 463) | 30 831 | 7 700 | 3,0 % | — |
| 🧿 Supervisor (Haupt-Checkout, claude) | automatisch 93 946 + `AGENTS.md` §contract 13 242 + Supervisor-Brief 1 255 (+ Anchor-Block) | 108 443 | 27 100 | 10,5 % | 2,7 % |
| Worker-Lane (claude) | `~/.claude/CLAUDE.md` 8 090 · `CLAUDE.md` LANE-Render 35 209 + Backref 808 · Dispatch-Brief Median `raw` 5 799 (`owner` 8 368) inkl. `LANE_EXIT_FOOTER` 1 487 · `AGENTS.md` §contract 13 242 auf Anweisung | 63 148 | 15 800 | 6,1 % | 1,6 % |
| Worker-Lane (pi/codex) | `AGENTS.md` 21 368 + Dispatch-Brief 5 799 | 27 167 | 6 800 | 2,6 % | — |
| ⚙ Steward (Worktree, claude) | `~/.claude/CLAUDE.md` 8 090 · handkopierte `CLAUDE.md` 81 293 (docs/steward.md:67) · `/steward`-Regal 10 Dateien 104 867 (davon 8 unter `docs/attic/`) · Command 3 476 | 197 726 | 49 400 | 19,1 % | 4,9 % |
| Zusatz je Tool-Aufruf im Haupt-Checkout | graphify-Hook (`.claude/settings.json`, gitignored): 269 B je Bash/Grep, 487 B je Read/Glob (gemessen per stdin-JSON); in einer Lane ohne `graphify-out/` 0 B | 269–487 / Aufruf | 70–120 | — | — |

Gemessen, nicht geschaetzt: alle `wc -c`; Lane-Render via `bun -e` (35 209 B MAIN 81 293 B);
Backref via `renderBackref("lane", …)` = 808 B; Brief-Mediane aus `context-receipts.jsonl`.
Abgeleitet (INFERRED): dass `MEMORY.md` in einem Worktree NICHT laedt (Projekt-Slug haengt am
cwd-Pfad); dass pi/codex `~/.claude/CLAUDE.md` nicht laden; die Ausgabegroesse von
`./state.sh`/`./register.sh` (nicht ausgefuehrt, beide `-rwx`, existieren).

Bloat-Kennzahlen der sieben Fragmente (10 650 Woerter gesamt): 17 Verweise auf
`docs/attic/regelbuch-messgeschichten-2026-08.md`, 65 Datumsangaben, 27× „gemessen/bezahlt" —
`einstieg.md` 2 761 W. / 20 Daten, `lane-discipline.md` 2 947 W. / 9 Attic-Verweise,
`deploy.md` 2 487 W. / 11 Daten.

## §2 Rangierte Befunde

Rang nach Kosten fuer den Owner: falsche Handlungen > blockierte Entscheidungen > verbrannte Token.
VERIFIZIERT = gelesen und mit Kommando geprueft; INFERRED ist je Befund markiert.

**1. `HANDOFF.md` ist ein Stapel aller Rollen, und jeder Brief sagt „lies nur den obersten Block".**
VERIFIZIERT: `grep -n '^# HANDOFF' HANDOFF.md` liefert 12 H1-Bloecke (143 083 B) aus fuenf
Urhebern — Zeile 1 Program-MAIN „Audit-Determiniertheit" Slot 7, Zeile 92 Program-MAIN
„Land-Pipeline", Zeile 272 dieselbe Program-MAIN Slot 6, Zeile 392 der 🎛 Controller Slot 7,
Zeile 438/440 Program-MAIN Fleet-Betrieb, Zeile 600 Controller Slot 3, Zeile 1251 Dual-Host. Die
Briefe: `server.ts:5764` (Controller-Nachfolge: „Lies nur den obersten Abschnitt von HANDOFF.md"),
`server.ts:18771` und `18836` (Program-MAIN fleet-control, Gruendung und Nachfolge: „Read only the
top HANDOFF.md section"). Das Gate `handoffCommittedAfterOpen` (`server.ts:5770-5779`) prueft nur,
dass die DATEI sauber und juenger als die Session ist — ein Commit einer fremden Rolle erfuellt es.
Kosten: Eine Controller-Nachfolgerin liest heute den Zustand einer Program-MAIN als ihren eigenen;
die eigene Vorgaengerin steht 392 Zeilen tiefer, und nichts im Brief sagt, wie sie zu finden ist.
Fix: Handoff je Rolle/Program in eigener Datei (`HANDOFF-controller.md`, `HANDOFF-<programId>.md`)
und der Brief nennt die Datei; bis dahin das Gate an die H1-Signatur (`Program-MAIN <id>` /
`Fleet Controller`) des obersten Blocks binden.
Verify: `grep -n '^# HANDOFF' HANDOFF.md | head -3; rg -n 'obersten Abschnitt|top HANDOFF' server.ts`.

**2. Der Controller hat keinen servergebauten Rollenbrief; sein Nachfolgebrief nennt
`docs/controller.md` nicht.** VERIFIZIERT: `buildSuccessionBrief` (`server.ts:5754-5768`, 337 Zeichen)
nennt state.sh, register.sh, HANDOFF-Top, Queue; `rg -n 'controller.md' server.ts` ist leer.
`docs/controller.md:6-8` behauptet, der Gruendungsbrief schrumpfe auf „Lies `docs/controller.md`";
im aktuellen `HANDOFF.md` steht der Verweis nur in einem alten Block (Zeile 717). AGENTS.md:49-50
sagt zu Recht, der Controller sei „a scope a plain session carries, not a binding". Zusammen mit
Befund 1: die Rolle wird aus einem fremden Handoff-Block abgeleitet.
Kosten: Rollenklarheit haengt an Prosa-Disziplin der Vorgaengerin, nicht am Mechanismus.
Fix: Eine Zeile in `buildSuccessionBrief`, wenn `cwd === FLEET_REPO_ROOT` und der Slot nicht
Program-gebunden ist: „Rollenbrief: docs/controller.md".
Verify: `rg -n 'controller.md' server.ts` (heute 0 Treffer).

**3. Der graphify-Hook schreibt 269–487 B in JEDEN Tool-Aufruf im Haupt-Checkout und widerspricht
dem Regelbuch.** VERIFIZIERT: `.claude/settings.json:1-20` (gitignored, `.gitignore:47`) matcht
`Bash|Grep` und `Read|Glob`; gemessene Ausgabe „MANDATORY: … You MUST run `graphify query` before
grepping raw files" = 269 B (Bash) / 487 B (Read); in `/tmp` ohne Graph 0 B. Das Regelbuch schreibt
fuer operative Dateien `rg -uu`/`grep` vor (lane-discipline.md, Absatz „`rg` respektiert
`.gitignore`") und `./state.sh` als Erdung (einstieg.md:3) — beides ist per Hook „verboten", der
Graph enthaelt die gitignorten Ledger gar nicht. Dieselbe Anweisung steht ausserdem viermal:
`~/.claude/CLAUDE.md:89-91`, `.claude/CLAUDE.md:1-3`, `rulebook/graphify.md`, Hook.
Kosten: 200 Tool-Aufrufe ≈ 60–100 KB ≈ 15–25 k Token je Session, jede Nachricht erneut mitgeschickt
(einstieg.md:151: „der Verbrauch ist INPUT"); dazu ein Dauer-Widerspruch, den jede Session
stillschweigend zugunsten des Hooks oder des Regelbuchs entscheidet.
Fix: Matcher auf `Grep` beschraenken oder den Guard nur beim ersten Aufruf je Session sprechen
lassen; die drei Prosa-Kopien auf eine (rulebook/graphify.md) reduzieren.
Verify: `echo '{"tool_name":"Bash","tool_input":{"command":"rg x"}}' | ~/.local/bin/graphify hook-guard search | wc -c`.

**4. Das Kontext-Band ist dreifach und widerspruechlich definiert.** VERIFIZIERT:
`~/.claude/CLAUDE.md:76` „Before context reaches ~60%, run /handoff" · `AGENTS.md:146-153`
„~25–30 %" · `rulebook/einstieg.md:100-101` „25 / 30 … gilt fuer Controller EINSCHLIESSLICH
Supervisor". `AGENTS.md:16-17` ordnet den portablen Vertrag ueber „generic global defaults" — aber
die globale Datei laedt trotzdem in jede Session und wird zuerst gelesen.
Kosten: Eine Session, die die 60 % fuer die Marke haelt, uebergibt 35 Punkte zu spaet — genau der
Verlust, den `feedback-context-quality-degrades-at-25pct` (Memory) beschreibt.
Fix: `~/.claude/CLAUDE.md:74-78` auf „projektspezifisch — siehe Projektvertrag" kuerzen.
Verify: `grep -n '60%' ~/.claude/CLAUDE.md`.

**5. Supervisor-Modell und -Mechanik sind in sich widerspruechlich.** VERIFIZIERT:
`rulebook/supervisor.md:4` „Opus 5 mit `effort high` … ab jetzt" (2026-08-18/22) vs
`rulebook/einstieg.md:148-150` MODELLPOLITIK 2026-09-02 „Fable 5.1 fuer alles, was ORCHESTRIERT",
die den Supervisor weder nennt noch ausnimmt, waehrend `einstieg.md:101` ihn fuer das Band als
Controller zaehlt. Innerhalb von `supervisor.md`: Zeile 9 „der LEBENDE Slot kann es nicht — die
verbliebene Falle", Zeile 15 „KORRIGIERT 2026-09-02: der mechanische Schnitt EXISTIERT", Zeile 25
„bis der mechanische Schnitt existiert". Das Fragment ist 555 Woerter fuer eine Regel, die im
Praesens drei Saetze braucht (`POST /api/slots/:id/model`, dann `/model` per `/send`, Effort-Zeile
zitieren).
Kosten: Eine Supervisor-Nachfolge waehlt das Modell danach, welchen Absatz sie zuerst liest.
Fix: `supervisor.md` neu schreiben: Modell laut 09-02-Politik (Owner-Entscheid noetig: Fable oder
Opus), Paar-Regel, Footer-Sensor — Historie in den Attic.
Verify: `grep -n 'Opus 5\|Fable\|Schnitt' rulebook/supervisor.md rulebook/einstieg.md`.

**6. Zeilenverweise im Regelbuch rotten — gegen die eigene Symbol-Regel.** VERIFIZIERT:
`einstieg.md:34` „`laneWatchSignal` (`lane-signals.ts:92`)" → steht bei `lane-signals.ts:127`;
`einstieg.md:36` „`host-commit-looking` (`lane-signals.ts:73`)" → `laneHostCommitLooking` bei `:119`;
`graphify.md:5` „`.gitignore:31`" → `graphify-out/` steht in `.gitignore:45`; `einstieg.md:166`
„`server.ts` sind 24 603 Zeilen (gemessen 2026-09-04 an `a09d9e5`)" → heute 26 268 (`wc -l`);
`self-scheduling.md:14` `docs/harvest-portabilitaet-J-2026-08-21.md:190` → Datei liegt unter
`docs/attic/`. Die Regel „Symbolverweise statt Zeilenverweise" steht in `lane-discipline.md` selbst.
Kosten: Der Watch-Mechanismus ist das, was eine MAIN am haeufigsten braucht; ein falscher Anker
kostet je Nachschlagen eine Suche und untergraebt das Vertrauen in die uebrigen Anker.
Fix: die fuenf Stellen auf `datei#symbol`; die Zeilenzahl von `server.ts` als „`wc -l server.ts`"
statt als Zahl.
Verify: `rg -n 'export function laneWatchSignal|export function laneHostCommitLooking' lane-signals.ts; grep -n graphify-out .gitignore`.

**7. Tote Doc-Pfade in Rollen-Docs, Skills und Server-Kommentaren.** VERIFIZIERT (`test -e`):
`docs/lane-brief-template.md:96` `judge-calibration.md` und `:104` `automation-frontiers.md` →
beide unter `docs/attic/`; `.claude/skills/mess-notiz/SKILL.md:13`
`docs/werkzeugkosten-grundlinie-2026-08-19.md` → `docs/attic/`; `server.ts:8092` „workflow-v2.md
§7 F4" → `docs/game-maker/workflow-v2.md`; `server.ts:8027` „server-narrativ-archiv.md" →
`docs/sanierung-2026-09/`. Der Pfad-Pin in `e2e/pins.ts` prueft Backtick-Pfade in `CLAUDE.md`
(Kommentar `e2e/pins.ts:1528-1560`), nicht in `docs/` oder Skills.
Kosten: Eine Lane, die dem Zeiger folgt, findet nichts und meldet „fehlt" oder erfindet.
Fix: fuenf Pfade nachziehen; den Pfad-Pin auf `docs/controller.md`, `docs/steward.md`,
`docs/lane-brief-template.md` und `.claude/skills/*/SKILL.md` ausdehnen.
Verify: `for f in docs/judge-calibration.md docs/automation-frontiers.md docs/werkzeugkosten-grundlinie-2026-08-19.md; do test -e $f || echo MISS $f; done`.

**8. Der Steward laedt ein Regal, das sein eigenes Konzeptdokument fuer ueberholt erklaert.**
VERIFIZIERT: `docs/steward.md:87-93` nennt die Lesefolge README → tailored-context →
verify-tiering → steward.md und vermerkt eine Korrektur 2026-07-29, weil das Ritual „zwei Tage auf
Attic-Pfade zeigte". `.claude/commands/steward.md:4` liest heute zehn Dateien, acht davon unter
`docs/attic/` (operating-model, interaction-modes, verification, steward-autonomy,
queue-automation, automation-synergies, steward-mail, steward-intelligence 26 119 B) = 104 867 B
≈ 26 k Token.
Kosten: 10 % eines 258 400-Fensters fuer archivierte Theorie, bevor das Gespraech beginnt; und ein
Steward, der Attic-Konzepte als gueltig vortraegt.
Fix: Command auf die Lesefolge aus `docs/steward.md` §Session start kuerzen; Attic-Dateien raus.
Verify: `grep -o 'docs/attic/[a-z-]*\.md' .claude/commands/steward.md | wc -l` (heute 8).

**9. Der Supervisor-Brief setzt den Fleet-Checkout voraus, die Route erlaubt jedes cwd.**
VERIFIZIERT: `server.ts:18850` „Begin: run ./state.sh, then ./register.sh"; die Route oeffnet
`openSlot(free, body.cwd, …)` nach `preflightProgramMain(body.cwd)` (`server.ts:19012-19016`), und
`buildSupervisorBrief` (`server.ts:18853`) hat keinen Frame-Parameter — anders als
`buildProgramMainBrief`, das fuer `target-repo` auf AGENTS.md + git verzweigt
(`server.ts:18754-18775`). INFERRED: dass die Route ein Nicht-Fleet-cwd nicht ablehnt (im gelesenen
Fenster `server.ts:18996-19045` keine Frame-Pruefung gefunden; nur `programMainContextFacts(frame)`
fuer den Anchor-Block).
Kosten: Erster Turn in fremdem cwd scheitert an „no such file"; heute latent, da alle Supervisoren
im Fleet-Checkout gegruendet wurden.
Fix: Frame-Verzweigung wie bei der Program-MAIN, oder Route auf `fleet-control` einschraenken.
Verify: `sed -n '18850p' server.ts; rg -n 'fleet-control' server.ts | rg -c 'Supervisor'`.

**10. Zwei Brief-Doktrinen widersprechen sich beim Verify-Kommando und beim Ort der Regeln.**
VERIFIZIERT: `docs/lane-brief-template.md:73-76` „Never paste the gate command into a brief …
write ‚run the Verify line in the lane's CLAUDE.md'" und `:33` „Project rules are in CLAUDE.md" vs
`rulebook/einstieg.md:206` fuer fremde Modelle „Verify-Kommando ausgeschrieben" und
`rulebook/loader.md:7-8` „Pi-/Codex-Sessions laden `AGENTS.md` … lesen diese Datei nicht";
`.claude/skills/mess-notiz/SKILL.md:91` sagt fuer pi/codex: Template in den Brief.
Kosten: Ein Controller, der nach dem Template briefet, schickt eine GPT-Lane zu einer Datei, die ihr
Harness nie laedt; die Verify-Kette fehlt ihr dann ganz.
Fix: Template bekommt eine Harness-Weiche („claude: Verify-Zeile in CLAUDE.md · pi/codex: AGENTS.md
§Verify, Kommando ausgeschrieben").
Verify: `grep -n 'Never paste the gate' docs/lane-brief-template.md; grep -n 'ausgeschrieben' rulebook/einstieg.md`.

**11. Die Lane-Fassung traegt 6–7 KB Regeln, die einer Lane mit 409 antworten.** VERIFIZIERT:
`rulebook.ts:40` gibt der Lane `loader`, `lane-discipline`, `self-scheduling`; in
`self-scheduling.md` sind `watch` (Z. 69-85), `succeed/retire` (Z. 87-93), `release` (Z. 29-35)
und der Succession-Attention-Absatz (Z. 94-110) Nicht-Lane-only — `server.ts` antwortet „a lane
may not" an 8 Stellen. Von 9 236 B gelten fuer eine Lane nur Token-Hygiene, `GET /api/self` und
`autos` (Z. 1-27, 54-67).
Kosten: ~1 600 Token je Claude-Lane fuer Tueren, die sie nicht oeffnen kann; und drei Regeln, die
sie zum Ausprobieren einladen (die 409 sind gewollt, aber ein Absatz je 409 ist Bloat).
Fix: `self-scheduling` in `self-lane` (autos, self, Hygiene) und `self-main` (watch, succeed,
release, Attentions) teilen; `FRAGMENTS_FOR.lane` bekommt nur `self-lane`.
Verify: `bun -e 'import{RULEBOOK_FRAGMENTS as F,RULEBOOK_DIR as d,fragmentFileName as n,renderRulebook as r}from"./rulebook";import{readFileSync as R}from"node:fs";console.log(Buffer.byteLength(r("lane",new Map(F.map(f=>[f,R(`${d}/${n(f)}`,"utf8")])))))'` (heute 35 209).

**12. Der portable Kern traegt 21 % Game-Maker-Workflow.** VERIFIZIERT: `AGENTS.md:79-109`
(Preflight, Card, Sensory Critic) = 2 818 von 13 242 B des Vertrags; derselbe Inhalt steht
serverseitig im `RAIL_ROLE_GAME_MAKER` (`server.ts:18546-18633`), das nur Game-Maker-Programs
erhalten. Jede pi/codex-Lane in jedem Repo laedt ihn (`AGENTS.md:8-9`), und der target-repo-Frame
verlangt ein `AGENTS.md` im Zielrepo (`server.ts:18331-18332`), das diesen Block dann ebenfalls
mitbringt oder nicht — SYSTEM.md:235 verbietet ausdruecklich „getrennte Rollenhandbuecher".
Kosten: ~700 Token je fremder Lane; und eine Invariante, die fuer 95 % der Leser nicht gilt, senkt
das Gewicht der uebrigen.
Fix: im Kern ein Satz („Game-Maker-Programs: Preflight-Pflicht, Text im Gruendungsrail"), der Rest
bleibt im Rail.
Verify: `sed -n '79,109p' AGENTS.md | wc -c`.

**13. Zeiger auf Riesendokumente ohne Abschnittsanker.** VERIFIZIERT: `lane-discipline.md`
(Absatz „Bekannte Flake-Familien") schickt eine Lane fuer Flake-Adjudikation nach
`docs/verify-tiering.md` „dort und nur dort" — 233 038 B ≈ 58 k Token = 22,5 % eines
258 400-Fensters; `self-scheduling.md` verweist je Route auf `docs/self-api.md` (125 002 B). Beide
Docs haben `## `-Ueberschriften (self-api: 16 Sektionen), die im Regelbuch nur teilweise genannt sind.
Kosten: Eine Lane, die den Zeiger befolgt, verbrennt ein Fuenftel ihres Fensters; eine, die es
nicht tut, adjudiziert ohne Register.
Fix: Jeden Zeiger mit `§`-Anker UND Suchrezept (`grep -n '^## ' docs/verify-tiering.md`) versehen;
das Flake-Register aus verify-tiering.md in eine eigene ≤ 20-KB-Datei ziehen.
Verify: `wc -c docs/verify-tiering.md docs/self-api.md`.

**14. Die globale `CLAUDE.md` traegt Regeln, die `server.ts` per Konstruktion bricht.**
VERIFIZIERT: `~/.claude/CLAUDE.md:39` „800 max — extract when exceeding" vs `wc -l server.ts` =
26 268; `:41` „No console.log" vs 47 Treffer (`rg -c`), und der Stop-Hook
`~/.claude/hooks/check-console-log.sh` meldet es nach jedem Turn; `:66` „not `fs`" vs
`from "node:fs"` in `server.ts`; `:83` „Co-Authored-By: Claude Opus 4.6" vs die Harness-Attribution
dieser Session (Fable 5.1) und `AGENTS.md` ohne Attributionsregel.
Kosten: Jede Session entscheidet still, welche Zeile sie bricht; `AGENTS.md:16-17` deckt nur
„durable agent rules", nicht Code-Stil.
Fix: Eine Zeile in `~/.claude/CLAUDE.md` §Code Principles: „gilt nicht, wo ein Projektvertrag
(AGENTS.md) etwas anderes festlegt"; Attribution aus der Datei nehmen (der Harness liefert sie).
Verify: `wc -l server.ts; rg -c 'console\.log' server.ts`.

**15. Der Lane-Exit-Footer verspricht einen Rueckweg, den es nicht fuer jede Lane gibt.**
VERIFIZIERT: `LANE_EXIT_FOOTER` (`server.ts:7979-8003`) „the server delivers the report to your
coordinator, and any answer arrives in this pane on its own"; der Kommentar an `openFleetReport`
(`server.ts:6380-6396`) dokumentiert zwei live gemessene 409 fuer owner-dispatchte Lanes ohne
Program-Bindung und den engen Fix. `AGENTS.md:54`: der Controller hat „no owner route of its own —
it reports in its own pane". INFERRED: wohin der Report einer Controller-dispatchten Lane heute
zugestellt wird (Zustellpfad nicht gelesen).
Kosten: Eine Lane wartet auf eine Antwort, die strukturell niemand adressiert; der Footer sagt ihr
nicht, dass ihre Landing-SHA nach dem Rebase nicht ihre eigene ist (`lane-discipline.md`, Absatz
„Eine Lane kann ihre EIGENEN Commit-Shas nicht in ein Doc schreiben") — die Regel steht im
Regelbuch, nicht im Brief, und eine pi/codex-Lane hat das Regelbuch nicht.
Fix: Footer um zwei Zeilen: „Deine SHAs existieren nach dem Land nicht mehr — Platzhalter/Branch
schreiben" und „ohne Program-Bindung antwortet niemand: Report ist terminal".
Verify: `sed -n '7979,8003p' server.ts | grep -c 'SHA'` (heute 0).

**16. `.fleet/context-packs.json` schaetzt das Regelbuch auf 25 900 B — es sind 81 293.**
VERIFIZIERT: `.fleet/context-packs.json:16` `estimatedBytes: 25900` fuer Pack `rulebook-generat`,
Quelle `docs/rulebook-inventar-2026-08-18.md` (existiert, datiert 08-18); das Pack wird an JEDEM
Dispatch geliefert (`triggers: ["always"]`, gelesen ueber `context-manifest.ts#CONTEXT_MANIFEST_PATH`
in `server.ts#briefAndSend` Z. 8078). Dasselbe Pack listet `pi-zai`/`pi-ox`/`pi-unfenced`, die
`rulebook/deploy.md:79` als HISTORIE fuehrt (im Code existieren sie: `server.ts:664,714,782`).
Kosten: gering (der Wert ist Metadatum); aber ein Manifest, das um Faktor 3 danebenliegt, taugt
nicht als Planungsgrundlage fuer `estimatedBytes`-basierte Auswahl.
Fix: Wert auf die gerenderte Groesse setzen oder das Feld aus dem Render ableiten.
Verify: `python3 -c 'import json;print([p["estimatedBytes"] for p in json.load(open(".fleet/context-packs.json"))])'; wc -c CLAUDE.md`.

**17. Vier Fragmente sind zur Haelfte Messgeschichte im Praesens-Regelbuch.** VERIFIZIERT
(Zaehlung §1): `einstieg.md` 20 Daten und 7 Attic-Verweise, `lane-discipline.md` 9 Attic-Verweise,
`deploy.md` 11 Daten; Beispiele fuer Absaetze, die ein Datum, einen Vorfall und die Regel tragen:
einstieg.md:44-72 (Land-Takt, checkout, ff-lost — drei Absaetze fuer „vor jedem Commit den
Merge-Sensor lesen"), deploy.md:58-70 (Autoclose-Stand + Env-Probe-Messfehler), supervisor.md
komplett (Befund 5). Das Regelbuch hat dafuer den Attic (`regelbuch-messgeschichten-2026-08.md`,
73 951 B) und benutzt ihn bereits 17-mal — inkonsequent.
Kosten: 81 KB je Turn statt geschaetzt ~45 KB bei Regel + Zeiger; bei 250–350 k Kontext je
MAIN-Nachricht (einstieg.md:151) ist das der groesste steuerbare Posten.
Fix: Je Fragment die „bezahlt am …"-Saetze in den Attic-§ verschieben, im Regelbuch Regel + ein
Zeiger; Messziel `wc -c CLAUDE.md` < 50 000.
Verify: `wc -c CLAUDE.md; grep -c 'regelbuch-messgeschichten' CLAUDE.md`.

**18. Der Program-MAIN-Brief im fleet-control-Frame nennt weder AGENTS.md noch die Rollentabelle.**
VERIFIZIERT: `server.ts:18766-18775` (state.sh, register.sh, HANDOFF-Top, Queue) vs der
target-repo-Frame `server.ts:18757-18760` („Read the repository root AGENTS.md in full"). Die
fleet-control-MAIN erreicht AGENTS.md nur ueber `rulebook/loader.md:5`, und die Rollentabelle
(`AGENTS.md:52-57`, mit den Rueckkanaelen `attention`/`clarifications/reply`/`tasks`/`release`)
steht in keinem der beiden Briefe; der Rail (`server.ts:18501-18516`) nennt nur `program-execution`.
Kosten: Eine MAIN lernt ihre Owner-Tuer (`POST /api/self/attention`) aus einem 81-KB-Overlay oder
gar nicht — Befund „Succession toetet Attentions" (self-scheduling.md:94-110) zeigt, dass genau dort
Fragen verloren gehen.
Fix: Rail-Head um eine Zeile „Deine Tueren: attention, clarifications/:id/reply, tasks, release,
watch — Tabelle AGENTS.md §Role contract" ergaenzen.
Verify: `sed -n '18501,18516p' server.ts | grep -c attention` (heute 0).

**19. Der Loader-Vertrag verlangt eine Doppel-Lektuere, die kein Sensor prueft.** VERIFIZIERT:
`rulebook/loader.md:4-6` und `AGENTS.md:9-10` „lies aus AGENTS.md einmal den Abschnitt Portable
operating contract"; dazu liefert der Anchor-Block jedes Dispatches den Zeiger erneut
(`context-packs.ts:91-99`, `portable-core`, `triggers: ["always"]`) und `lane-discipline.md`
wiederholt Verify/Landing wortgleich (Pin `RULE_VERIFY`, `e2e/pins.ts:932`). Ob eine Session die
13 242 B wirklich liest, weiss niemand — kein Receipt, kein Marker.
Kosten: entweder 3 300 Token doppelt oder eine stille Nicht-Lektuere; beides unsichtbar.
Fix: Fuer Claude-Sessions den Vertragsteil (Vokabular, Rollentabelle, Invarianten; ~8 KB) als
eigenes Fragment `vertrag` rendern und die Lese-Anweisung streichen — dann ist es geladen, nicht
angewiesen.
Verify: `sed -n '22,171p' AGENTS.md | wc -c`.

**20. `docs/steward.md` fuehrt vier Attic-Verweise als lebende Begruendung.** VERIFIZIERT:
`docs/steward.md:38` (`docs/attic/interaction-modes.md`), `:42` (`docs/attic/operating-model.md`),
`:27` (`docs/attic/state-reality-divergence.md` D2/D5), `:187` (`docs/attic/perception-layer.md`);
alle existieren, aber die Datei (11 711 B) ist Teil des Ladens jeder Steward-Session (Befund 8) und
traegt drei „Correction …"-Absaetze (Z. 7-31, 56-64, 88-93), die den Text um Vorfaelle statt um
den heutigen Zustand herum organisieren.
Kosten: klein je Session; strukturell dasselbe wie Befund 17.
Fix: Konzeptteil (§What it is, §Three conventions, §Voice, §NOT) behalten, Korrekturhistorie in
Commit-Bodies/Attic.
Verify: `grep -c 'Correct' docs/steward.md`.

## §3 Was gut ist

- Die Byte-Gleichheit Fragmente ↔ `CLAUDE.md` und die Lane-/MAIN-Partition sind mechanisch
  (`rulebook.ts:34-42`, Pin §6b `e2e/pins.ts:3292`); der Backref-Block nennt einer Lane, was ihr
  fehlt, mit absolutem Lesepfad (`rulebook.ts:130-138`).
- `RULE_VERIFY` (`e2e/pins.ts:932`) haelt AGENTS.md, `watchdog.sh:91` und `verify-proportion.ts` als
  EINE Kette — der Verify-Block darf dreimal stehen, weil er nicht driften kann.
- Der Dispatch-Brief ist rekonstruierbar: `context-receipts.jsonl` traegt `deliveredBytes`,
  `briefHash`, `briefSource`, Plan und Renderer je Zustellung (`server.ts:8104-8122`).
- `LANE_EXIT_FOOTER` liest die Status-Liste aus der Routen-Konstante (`server.ts:7975-7978`) — ein
  Footer kann keinen Status lehren, den die Route ablehnt.
- Die 409-Scope-Regeln (Lane-only / Nicht-Lane-only) sind Code, nicht Prosa: 12× „not a lane",
  8× „a lane may not" in `server.ts`.

## §4 Nicht geprueft

- Nicht gelesen: `merge-prompt.ts` (33 234 B), `analysis-prompt.ts`, `enhance-prompt.ts`, der
  Korpus von `docs/self-api.md`, `docs/verify-tiering.md`, `docs/harness-adapter.md` (nur `wc -c`
  und `grep '^## '`); `.claude/skills/graphify/SKILL.md` ab Zeile 40; die Owner-Memory-Dateien
  ausser `MEMORY.md`; `HANDOFF.md` ab Zeile 30 (nur `grep '^# '`).
- Nicht ausgefuehrt: `./state.sh`, `./register.sh` (Groesse ihrer Ausgabe fehlt im Groessenbild),
  keine Suite, kein Server, keine Pane-Messung dessen, was pi/codex tatsaechlich laden.
- Nicht verfolgt: der Zustellpfad eines Fleet-Reports zum Controller (Befund 15 INFERRED); ob die
  Supervisor-Route ein Nicht-Fleet-cwd ablehnt (Befund 9 INFERRED); die Ausgabe von
  `hook-guard read` in einer Lane (nur `search` in `/tmp` gemessen).
- Nicht vermessen: Doppelungen zwischen `docs/controller.md` und `einstieg.md` (die vier
  Zwillingszustaende, Rueckwege) — nach Lesen deckungsgleich, Bytes nicht gezaehlt.

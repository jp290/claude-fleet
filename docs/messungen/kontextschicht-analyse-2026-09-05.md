# Kontextschichten von Claude Fleet — Ineffizienzen und Schnitte (2026-09-05)

> Datierter Schnappschuss, Baum `0dbd8cb` (main), gemessen 2026-09-05 01:1x–02:0x. Zeilenverweise
> zeigen auf diesen Baum. Auftrag (Owner 01:1x): „die system.md von claude fleet, komplementär dazu
> auch die anderen Agenten-Files und Kontextschichten, auf potenzielle Verbesserungen und bestehende
> Ineffizienzen analysieren". Vorgängerin: `docs/kontextschicht-analyse-2026-08-20.md` (08-20).
> Richtwert 4 Bytes/Token, wie im Auftrag; deutsche Prosa liegt eher bei 3,3, die Tokenzahlen sind
> also Untergrenzen. Kein Server, keine Suite, keine Pane, kein `ps` gestartet.

## §0 Ergebnis in fünf Sätzen

1. Seit 08-20 ist jede Startladung gewachsen, nicht geschrumpft: der MAIN-Render von 62 678 auf
   84 630 B (+35 %), der Lane-Render von 29 529 auf 43 184 B (+46 %), `AGENTS.md` von 9 572 auf
   21 063 B (+120 %) — und 48 von 117 Regelblöcken im Regelbuch tragen ein Datum, obwohl die
   Messgeschichten am 2026-08-18 ins Attic zogen.
2. Der teuerste Einzelposten ist nicht die Lane, sondern der Wegwerf-Worker: `summaryViaSession`
   startet `claude` mit `-c <repo-root>` (`server.ts:9404`), wo das volle MAIN-Regelbuch plus
   globales `CLAUDE.md` (92 720 B ≈ 23 k Tokens) auto-geladen wird — für einen Merge-Prompt von
   ~6 KB, mehrmals je Land (aus Code abgeleitet, nicht an einer Worker-Pane gemessen).
3. Der Succession-Brief sagt „Lies nur den obersten Abschnitt von HANDOFF.md"
   (`server.ts:5670`, `:17758`); HANDOFF.md hat 15 Abschnitte von 6 Prinzipalen, acht Programs sind
   aktiv, und für sieben davon ist der oberste Abschnitt ein fremder — das Game-Maker-v2-MAIN findet
   seinen als 15. von 15 (Zeile 1732).
4. Das Regelbuch rottet in Tagesfrist: `rulebook/deploy.md` behauptet „`FLEET_LANE_AUTOCLOSE` …
   der Flag war nie gesetzt (Stand 2026-09-04)", `watchdog.sh:155` setzt ihn seit `566cbae`
   (2026-09-04); dazu ein toter Zeilenverweis (`killUndoStack :9832`, real `:11800`) und zwei falsche
   Routenzählungen in `self-scheduling.md` gegen `server.ts`.
5. Von den fünf „tot"-Befunden der 08-20-Analyse sind drei behoben (Loader-Satz in `AGENTS.md`,
   Supervisor-Attention-Versprechen, Composer-Warnung in `docs/steward.md`), zwei stehen unverändert
   (`docs/tailored-context.md:172-174` „pi lädt CLAUDE.md"; drei Context-Packs mit 0 von 520
   Receipts), und `SYSTEM.md` hat heute genau einen Leser-Verweis im ganzen Baum (`AGENTS.md:56`).

## §1 Inventar je Rolle (Bytes · ~Tokens · Beleg, wer lädt)

AUTO = der Harness lädt die Datei selbst · PFLICHT = eine geladene Regel schickt den Leser hin ·
ZUGESTELLT = der Server pastet es (`sendText`) · optional = nur auf Zeiger.

| Schicht | Bytes | ~Tok | Wer lädt sie | Beleg |
|---|---:|---:|---|---|
| `~/.claude/CLAUDE.md` (global) | 8 090 | 2,0 k | (a)(b)(d) AUTO | Claude-Loader; (c) nie |
| `CLAUDE.md` MAIN-Render (7 Fragmente) | 84 630 | 21,2 k | (a) AUTO, (d) AUTO bei cwd=Root | `rulebook.ts#FRAGMENTS_FOR`; `e2e/pins.ts:3080` RULE_RENDER byte-gleich (geprüft: `main==CLAUDE.md true`) |
| `CLAUDE.md` Lane-Render (3 Fragmente + Rückweg) | 43 184 | 10,8 k | (b) AUTO; (c) optional | `server.ts#laneRulebookFor` (`:3438`), geschrieben in `createWorktree` (`:3554-3558`) |
| `.claude/CLAUDE.md` | 226 | 0,1 k | (a)(b) AUTO | getrackt, im Worktree vorhanden |
| `AGENTS.md` ganz | 21 063 | 5,3 k | (c) AUTO | `AGENTS.md:8-9`; 08-20 §1 pane-gemessen |
| davon §Portable operating contract | 13 242 | 3,3 k | (a)(b) PFLICHT | `rulebook/loader.md` Absatz 1 |
| davon Game-Maker-Preflight-Bullet | 3 518 | 0,9 k | alle Leser von AGENTS | `AGENTS.md` §Hard invariants, Bullet 3 |
| Program-MAIN-Brief (Standard) | ≥ 6 126 + JSON + Anker | 1,5 k + | (a) ZUGESTELLT | `RAIL_HEAD` 1 025 + `RAIL_ROLE_STANDARD` 2 184 + `RAIL_TAIL` 2 917 (`server.ts:17424-17595`) |
| Program-MAIN-Brief (Game-Maker) | ≥ 10 371 + JSON + Studio + Anker | 2,6 k + | (a) ZUGESTELLT | `RAIL_ROLE_GAME_MAKER` 6 429 statt 2 184 |
| Succession-Brief (Fleet-Frame) | 419 | 0,1 k | (a) ZUGESTELLT | `server.ts#buildSuccessionBrief` |
| Supervisor-Brief | 1 332 + Anker | 0,3 k | (a) ZUGESTELLT | `server.ts#supervisorBriefBody` |
| HANDOFF.md (ganz / oberster Abschnitt) | 148 163 / ~9 100 | 37 k / 2,3 k | (a) PFLICHT | 2 025 Z., 15 `# HANDOFF`, oberster = Z. 1–125 |
| Lane-Brief zugestellt (Roh-Text + Studio + Anker + Exit-Footer) | Median 5 960, p90 10 686, max 20 339 | 1,5 k–5 k | (b)(c) ZUGESTELLT | `context-receipts.jsonl`, 520 Zeilen 2026-08-14…09-04; `LANE_EXIT_FOOTER` 1 488 B (`server.ts:7798`) |
| Pack-Zeiger `always`: `portable-core`→AGENTS §Portable; `rulebook-generat`→`rulebook.ts` + `docs/rulebook-inventar-2026-08-18.md` 22 391; `messnotiz-index`→`docs/messungen/INDEX.md` 29 258 | 13 242 + 22 391 + 29 258 | 16 k | (b)(c) optional | `context-packs.ts:91-97`, `.fleet/context-packs.json`; 281/520 Receipts tragen `rulebook-generat`, 141 `messnotiz-index` |
| Pack-Zeiger `verification`: `verify-e2e`→AGENTS §Verify + `docs/verify-tiering.md` §6 (Datei 185 908 B) | Anker-Abschnitt | — | (b)(c) optional | `context-packs.ts:107-115` |
| Merge-/Repair-/Author-/CleanReview-Prompt | 6 186 / 5 541 / 5 636 / 3 930 (Template) + Diff | 1,5 k + | (d) ZUGESTELLT | `merge-prompt.ts:100-420` |
| `SYSTEM.md` | 13 120 | 3,3 k | NIEMAND auto/pflicht | 0 Treffer in Packs, Briefs, Rulebook; 1 in `AGENTS.md:56` |
| `docs/self-api.md` | 116 644 | 29 k | (a)(b) optional | 3 §-Zeiger aus `self-scheduling.md` |
| Skills 4 · Commands 21 · Agents 13 | 53 511 · 51 410 · 25 288 | — | on demand | nur `catchup.md`/`handoff.md` überschneiden das Regelbuch |

**Summe beim Start, ohne Briefe und Zeiger:**
(a) Controller/Program-MAIN: 8 090 + 84 630 + 226 AUTO = **92 946 B ≈ 23,2 k Tok (2,3 % von 1 M)**;
mit PFLICHT-Read AGENTS-§ und oberstem HANDOFF-Abschnitt ≈ 115 KB ≈ 29 k (2,9 %). 08-20: 80 566 B.
(b) claude-Lane: 8 090 + 43 184 + 226 = **51 500 B ≈ 12,9 k (1,3 %)** + Brief Median 5 960 → 57,5 KB;
folgt sie allen `always`-Zeigern: +64,9 KB → 122 KB ≈ 30 k (3 %). 08-20: 47 417 B.
(c) codex/pi-Lane: 21 063 AUTO + Brief 5 960 = **27 KB ≈ 6,8 k = 2,6 % von 258 400**; mit
Lane-Render als PFLICHT (den der Loader verbietet, den `rulebook-generat` aber anzeigt) 70 KB = 6,8 %;
mit allen `always`-Zeigern 135 KB ≈ 33,8 k = **13 %** des Fensters vor dem ersten Handgriff.
(d) Wegwerf-Worker (claude, cwd = Repo-Root): 8 090 + 84 630 AUTO + ~6 KB Prompt = **98,7 KB ≈ 24,7 k**,
davon 94 % Regelwerk, das ein Merge-Worker nie braucht. Aus Code abgeleitet (`server.ts:9404`
`tmuxNewSession … -c cwd`; in den 60 geprüften Zeilen kein Flag, das Memory-Dateien abschaltet).

## §2 Rangliste der Befunde (Kosten · Beleg · Schnitt · Bezug zu 08-20)

**B1 — Wegwerf-Worker laden das MAIN-Regelbuch.** Kosten: ~23 k Input-Tokens je Worker-Lauf, und
je Land laufen bis zu vier (Merge + `FLEET_MERGE_REPAIR_ROUNDS`=2 + Review) → ~90 k Tokens je Land
für Text, der dem Worker Fleet-MAIN-Pflichten (`./state.sh`, Kontext-Band, Succession) vorschreibt;
Fehlentscheidung: ein Merge-Worker, der einstieg-Regeln befolgt. Beleg: `summaryViaSession`
(`server.ts:9379-9440`) startet `w.cmd` mit `-c cwd` (`:9404`); `runWorker` erhält `cwd` vom Aufrufer;
Claude Code lädt `CLAUDE.md` des cwd auch im Worker-Modus (Standardverhalten, hier nicht gemessen).
Schnitt: Sonde ZUERST — die erste Nachricht des Worker-Transcripts (`projDir(cwd)/<sid>.jsonl`,
`server.ts:9402`) auf `# claude-fleet` prüfen; dann Worker in einem Worktree-Scratch mit leerem
`CLAUDE.md` starten oder den Loader per Flag abschalten (mechanisch beweisen, nie per
Modell-Auskunft — `rulebook/deploy.md` §Tool-Scoping sagt, warum). Bezug 08-20 §2 Zeile
„Wegwerf-Worker … GESCHLOSSEN aus Code" — benannt, unverändert, hier erstmals bepreist.

**B2 — Das Flake-Register steht doppelt: 7 427 B im Lane-Render, „dort und nur dort" in
`docs/verify-tiering.md`.** Kosten: 1,9 k Tokens in JEDER Session (Lane und MAIN, Fragment D ist
in beiden Renders), Pflege an zwei Stellen — der Block selbst beginnt mit „Instanzen und Mechanismen
stehen in `docs/verify-tiering.md`, dort und nur dort, damit die Zahlen nicht an zwei Stellen
altern" und zählt dann 18 Familien mit SHAs und Basisraten auf. Beleg: größter Block in
`rulebook/lane-discipline.md` (7 427 von 30 285 B); 16 von 37 Blöcken des Fragments tragen ein
Datum, 14 ein Messwort (gemessen/bezahlt/passiert/einmal). Schnitt: Block auf drei Sätze kürzen
(Beweisordnung: Rerun desselben Baums → Trail-Register entscheidet → Sonde vor Code; „Rot NACH
dem Fix-SHA ist echt" gehört in §11.2x der Tiering-Doc); Familien-Liste raus. Verify:
`bun e2e/pins.ts` — RULE_PLACED (48 D-Regeln der Bedeutungsprobe müssen weiter treffen),
RULE_PATHS/GREPS/ANCHORS, RULE_RENDER nach Neu-Render; danach `GET /api/self/gate` einer frischen
Lane auf `rulebookDrifted:false`. Bezug 08-20 §3: der Lane-Split galt als „belegter Lastschnitt"
bei 29,5 KB; seitdem +46 % — schlimmer.

**B3 — „Nur der oberste Abschnitt" von HANDOFF.md ist für 7 von 8 aktiven Programs der falsche.**
Kosten: entweder 37 k Tokens (ganze Datei) je Succession, oder eine Nachfolgerin baut auf dem
Zustand eines fremden Programs auf; die MAINs haben es selbst bemerkt (HANDOFF.md:1864 „HANDOFF.md
ist eine geteilte Datei", :1333 „geteilte HANDOFF.md"). Beleg: `# HANDOFF`-Köpfe Z. 1, 126, 283,
435, 549, 662, 747, 817, 946, 1081, 1221, 1340, 1509, 1614, 1732 — Prinzipale 66499a03 (2×),
f170dc46 (3×), Controller (4×), b2a14b54 (3×), cd110019, b2aa5b45; `fleet.json` führt 8 Programs
`active`; der Brief-Satz in `buildSuccessionBrief` (`server.ts:5670`) und
`buildProgramMainSuccessionBrief` Fleet-Frame (`:17758`). Schnitt: der Server kennt `program.id`
— der Brief nennt den Abschnitt, dessen Kopf die Program-Id trägt („Lies den obersten Abschnitt,
dessen Überschrift `<id8>` enthält"), oder je Prinzipal eine Datei `handoffs/<id8>.md` (dann
`handoffCommittedAfterOpen` `server.ts:5677` auf den Pfad umstellen). Verify: neuer Check in
`e2e/programs.ts` (Succession-Brief nennt die Id; Fixture mit zwei gestapelten Abschnitten),
`bun e2e/pins.ts` RULE_PATHS. Bezug 08-20: nicht enthalten — neu.

**B4 — Verfall in Tagesfrist, vier Instanzen.** (i) `rulebook/deploy.md` „`FLEET_LANE_AUTOCLOSE`
… per Default AUS … Stand 2026-09-04: GEBAUT, nie gelaufen — der Flag war nie gesetzt" ↔
`watchdog.sh:155` `FLEET_LANE_AUTOCLOSE=1` seit `566cbae` 2026-09-04 (ob der Watchdog seither per
`launchctl kickstart` neu gestartet wurde, ist hier NICHT geprüft — der Satz ist so oder so falsch,
weil er die Datei beschreibt). Kosten: eine MAIN schreibt eine verschwundene Lane dem Owner zu
statt dem Auto-Close. (ii) `deploy.md` „`killUndoStack` :9832" ↔ `server.ts:11800` — ein
Zeilenverweis in undatierter Prosa, den die eigene Regel (Symbolverweise, Owner-Promotion
2026-08-25, `lane-discipline.md`) verbietet. (iii) `self-scheduling.md` „Lane-only sind genau vier
Routen" ↔ Code: 7 Stellen `not a lane` 409 (`server.ts:22282` clarifications, `:22424` drift,
`:22448` gate, `:22497` criterion, `:22524`/`:22653` suite-offer, verify-intent). (iv) „Nicht-Lane-
only sind VIER Routen" ↔ Code: watch `:22268`, clarifications-reply `:22325`, attention `:22340`,
tasks `:22355`, release `:22369`, land `:22384`, fleet-report-Urteil `:22314`, succeed/retire.
Kosten: eine Lane probiert Türen, die 409 geben, oder eine MAIN kennt `/api/self/tasks/:id/land`
nicht (steht nur in `AGENTS.md`). Schnitt: Zählwörter und Zeilennummern aus dem Regelbuch; die
Routenliste EINMAL in `docs/self-api.md`, das Regelbuch zeigt hin; neuer Pin „kein `:NNNN` in
`rulebook/*.md`" neben RULE_GREPS (`e2e/pins.ts:2879`). Verify: `bun e2e/pins.ts`. Bezug 08-20 §5:
Klasse benannt („Präsens-Prosa"), alle vier Instanzen neu.

**B5 — `AGENTS.md` ist vom portablen Kern zum zweiten Regelbuch geworden (9 572 → 21 063 B).**
Kosten: (c) zahlt die ganze Datei AUTO — 5,3 k von 258 k Tokens, davon 3 518 B Game-Maker-
Preflight, den nur ein Game-Program-MAIN braucht und den `RAIL_ROLE_GAME_MAKER` (`server.ts:17469`,
6 429 B) dieser MAIN ohnehin zustellt; 3 823 B Rollentabelle mit Routen, die `self-scheduling.md`
und die Rail-Blöcke wiederholen. Beleg: Bytes je Abschnitt oben; `RAIL_ROLE_STANDARD` (2 184 B) ist
der AGENTS-Bullet „Where a Project MAIN's own act ends …" in anderer Sprache. Schnitt: Preflight-
Bullet in den Game-Maker-Rail (dort ist er schon in Sinn, nicht in Wortlaut); Rollentabelle auf
Level + Rückkanal-Route ohne Erklärprosa. Verify: `bun e2e/pins.ts` RULE_LOADER_BOUNDARY,
RULE_ANCHORS (`e2e/pins.ts:792`, `:957`); `e2e/programs.ts` hält die vier Founding-Formen
byte-genau. Bezug 08-20 §3 „Brief-Disziplin … nicht durch gemeinsame Struktur erzwungen" —
unverändert; die Asymmetrie (Claude liest einen §, Codex die Datei) besteht fort.

**B6 — Widersprüche zwischen Schichten, sechs Paare.**
(1) `~/.claude/CLAUDE.md` §Context Hygiene „vor ~60 % `/handoff`, dann `/clear`" ↔ `AGENTS.md`
§Context self-management „~25 %" ↔ `rulebook/einstieg.md` „25 / 30" — drei Zahlen für eine
Entscheidung; die globale ist die Fable-5-Fassung mit `/clear`, Fleet migriert per
`POST /api/self/succeed`. (2) global „Co-Authored-By: Claude Opus 4.6" ↔ Session-Attribution „Claude
Fable 5.1" — zwei Pflicht-Trailer je Commit. (3) global §Self-Improvement „add it to the relevant
project's CLAUDE.md" ↔ `loader.md` „bearbeite nie `CLAUDE.md`" (08-20 §4.3, unverändert; der
Loader-Vertrag regelt den Vorrang gegen die globale Schicht weiterhin nicht). (4) `SYSTEM.md`
„ein komplexer Worker darf als Act Lead Child-Acts erzeugen" ↔ `AGENTS.md:56` „Act Lead is not
built" — AGENTS markiert es selbst; `SYSTEM.md` sagt es als Zielbild und verweist für den
Ist-Befund auf 08-20, dessen §10 sich selbst als superseded führt. (5)
`docs/tailored-context.md:172-174` „`pi` does — verified live, it prints `[Context] CLAUDE.md`"
↔ `einstieg.md` „`pi` lädt `AGENTS.md`, NICHT `CLAUDE.md` (seit `b3c08e6`)" — 08-20 §5.3,
unverändert. (6) `einstieg.md` beschreibt den Brief-Kompiler (`FLEET_BRIEF_MS`, ↻ refine) ↔
`watchdog.sh:155` `FLEET_ANALYSIS_MS=0`, Receipts `briefSource`: raw 314 · founding 108 · owner 35 ·
clarify 1 · compiled 0 — der Pfad ist live aus. Kosten: (1)–(3) treffen jede Session; (5) macht
einen Brief-Autor für pi falsch. Schnitt: globale Datei um die drei Fleet-Kollisionen kürzen (sie
gilt für alle Projekte, Fleet ist das einzige mit Generat); `tailored-context.md:172-174` auf den
Attic-Stand; (6) ein Satz „live aus, Receipts sagen es". Verify: Pins RULE_GREPS für docs;
für die globale Datei gibt es keinen Pin — Verify ist `git diff` + Lesen.

**B7 — `always`-Packs zeigen auf datierte oder gewachsene Docs.** `messnotiz-index` sagt
`estimatedBytes: 11700`, `docs/messungen/INDEX.md` hat 29 258 (2,5×); `rulebook-generat` zeigt auf
`docs/rulebook-inventar-2026-08-18.md` (22 391 B, Schnappschuss); `task-queue`, `harness-adapter`,
`private-deploy-overlay`: 0 von 520 Receipts. Kosten: eine Lane, die den Zeigern folgt, liest
51 KB Index/Inventar vor ihrem Task; die drei toten Packs sind Pflege ohne Leser. Schnitt:
`messnotiz-index` auf Trigger `measurement` (gibt es nicht — anlegen oder Pack in die
`mess-notiz`-Skill verschieben); `rulebook-generat` nur `rulebook.ts`-Kopf; tote Packs löschen
oder einen Caller bauen. Verify: `e2e/context-packs.ts`, `context-pack-validator.ts`; neuer Pin
„`estimatedBytes` ≤ 1,5× Ist". Bezug 08-20 §5.1/5.2: dormant benannt, unverändert.

**B8 — Der Lane-Brief nennt keinen Frage-Rückweg.** `LANE_EXIT_FOOTER` nennt nur
`fleet-report`; `/api/self/clarifications` steht in `AGENTS.md` (Tabelle), aber in keinem der drei
Lane-Fragmente (0 Treffer), und eine claude-Lane liest AGENTS nur den §Portable (ohne Tabelle
kommt sie nicht aus, die Tabelle steht aber darin — ok für claude, nicht für den Lane-Render).
Kosten: eine blockierte Lane meldet `needs-main` statt zu fragen — ein Roundtrip über Report +
Owner statt Clarification. Schnitt: ein Satz im Footer („Frage an deine MAIN:
POST /api/self/clarifications — vor einem needs-main"). Verify: der Footer wird in `e2e/tasks.ts`
byte-genau geprüft (Fixture anpassen), `./e2e-claude-gate.sh`. Bezug 08-20 §6.2 — halb behoben
(AGENTS nennt die Route), im zugestellten Brief unverändert.

**B9 — `einstieg.md` (18 754 B) und `supervisor.md` (3 916 B) gehen an jede MAIN, 12/17 bzw. 6/6
Blöcke datiert.** Kosten: 5,7 k Tokens je MAIN, davon der Supervisor-Teil nur für eine Rolle
relevant; sieben Attic-Verweise sagen, wo die Geschichte liegt, und die Blöcke erzählen sie
trotzdem (Kontext-Band-Block ~2,3 KB mit ctx-Schnipsel, Modellpolitik mit Verbrauchszahlen).
Schnitt: `supervisor` aus `FRAGMENTS_FOR.main` in den Supervisor-Brief (`server.ts#supervisorBriefBody`
liefert schon 1,3 KB Rolle), Datums-/Zahlen-Prosa des Einstiegs in Attic §14. Verify:
`bun e2e/pins.ts` RULE_SELECT/RULE_PLACED (S-Regeln 4, E-Regeln 26 müssen weiter treffen).

**B10 — Redundanzpaare (Inventar; Kosten = doppelte Pflege, Widerspruchsfläche).**
`AGENTS.md` §Verify ↔ `lane-discipline.md` Verify-Block ↔ `watchdog.sh:91` ↔
`verify-proportion.ts:6` — gepinnt (RULE_VERIFY `e2e/pins.ts:848`), absichtlich · `AGENTS.md`
§Landing/§Reporting ↔ `LANE_EXIT_FOOTER` ↔ `lane-discipline.md` „Keep the lane landable" ·
`AGENTS.md` Rollentabelle ↔ `RAIL_TAIL` Loop (release/land/watch) ↔ `self-scheduling.md` §watch ·
`AGENTS.md` „Where a Project MAIN's own act ends" ↔ `RAIL_ROLE_STANDARD` · `AGENTS.md`
§Context self-management ↔ `einstieg.md` Kontext-Band ↔ global §Context Hygiene · graphify:
global `CLAUDE.md` ↔ `.claude/CLAUDE.md` ↔ `rulebook/graphify.md` ↔ `AGENTS.md` §Codex (vier
Träger; 08-20 zählte drei) · „Same loop ~5×" global ↔ AGENTS ↔ lane-discipline (08-20 §3,
unverändert) · Suite-Offer-Zahlen `lane-discipline.md` ↔ `server.ts:12647` — gepinnt (RULE_WAIT).

## §3 Uncosted observations

- `SYSTEM.md` (13 120 B) lädt niemand und nichts zeigt hin außer `AGENTS.md:56`; es ist Zielbild
  ohne Leserolle. Kein Token-Posten, aber ein Dokument, dessen Drift kein Pin und kein Leser sähe.
- `OWNER.md` (15 023 B) wird in jeden Lane-Worktree kopiert (`createWorktree`, `server.ts:3560`),
  gelesen nur vom `/steward`-Ritual — Platte, nicht Kontext.
- `docs/self-api.md` (116 644 B) ist die einzige Vollreferenz der Self-Routen; `self-scheduling.md`
  zeigt mit drei §-Ankern hin, `AGENTS.md` mit keinem.
- `.claude/CLAUDE.md` (226 B) ist der vierte graphify-Träger; der Hook, der `graphify query`
  erzwingt, feuert in Lanes ins Leere (kein Graph im Worktree — `graphify.md` sagt es selbst).
- `docs/kontextschicht-analyse-2026-08-20.md` trägt 180 Zeilen superseded Übergabeprompt (§10),
  auf den `SYSTEM.md` als „Ist-Befund" verweist.
- Commands/Agents (76 KB) laden nur auf Aufruf; Überschneidung mit dem Regelbuch nur in
  `handoff.md`/`catchup.md` (nicht tief geprüft).

## §4 Nicht gelesen / nicht gemessen

Nicht gelesen: `docs/self-api.md`, `docs/queue-analyst.md`, `docs/harness-adapter.md`,
`docs/steward.md` (nur gegrept: Composer-Warnung fort), `docs/tailored-context.md` außer :165-180,
`merge-prompt.ts` außer Struktur, `clarify-prompt.ts`, `context-plan.ts`, `dispatchTask`
(`server.ts:7663`) außer dem Aufruf in `briefAndSend`, `compileBriefs` außer :8141-8175, die
Skills/Commands/Agents inhaltlich, `docs/attic/regelbuch-messgeschichten-2026-08.md` außer
Überschriften, `docs/rulebook-inventar-2026-08-18.md`, `docs/messungen/INDEX.md`. Nicht gemessen:
eine lebende Pane oder ein Worker-Transcript (B1 ist Code-Ableitung), ob der Watchdog nach
`566cbae` gekickstartet wurde (B4 i), was pi/codex bei diesem HEAD wirklich laden (08-20-Messung
übernommen), `./state.sh`/`./register.sh`-Ausgabegrößen (Teil der MAIN-Startlast, ungemessen),
Token-Zahlen (Bytes/4, keine Tokenizer-Messung).

## §5 v1-Schnitt für den Owner — drei Änderungen, Reihenfolge nach Hebel je Session

1. **Fragment D entschlacken (B2 + B9-Anteil): −~10 KB in JEDER Session** (Lane und MAIN, das
   Fragment ist in beiden Renders). Flake-Register auf drei Sätze, die fünf weiteren Messgeschichte-
   Blöcke (`e2e-isolated`-Vorschau 1 596 B, Mutex 1 501 B, claude-gate-Phasen, Demo-Repo,
   pkill/kill-Kaskade) auf je eine Regel + Attic-Zeiger. Verify: `bun e2e/pins.ts` grün — RULE_PLACED
   (48 D-Regeln), RULE_PATHS/GREPS/ANCHORS, RULE_RENDER nach `rulebook.ts`-Render; dann ein
   Lane-Spawn und `GET /api/self/gate` → `rulebookDrifted:false`; `wc -c CLAUDE.md` < 75 000.
2. **Worker-Ambientlast beweisen und kappen (B1): −~23 k Tokens je Worker-Lauf, bis ~90 k je Land.**
   Schritt 1 Sonde: `projDir(cwd)/<sid>.jsonl` des nächsten Merge-Workers auf `# claude-fleet`
   lesen. Schritt 2 (nur bei Treffer): Worker-cwd auf einen Scratch-Worktree mit leerem `CLAUDE.md`
   oder Loader-Flag, mechanisch geprüft. Verify: dieselbe Transcript-Sonde ohne Treffer;
   `./e2e-clean-review.sh` + `./e2e-claude-gate.sh` (Worker-Pfade) `ALL PASS`; ein Land mit
   Repair-Runde grün; Pin `MERGE_TOOLS`/`TEXT_ONLY_TOOLS` unverändert.
3. **Succession-Brief adressiert den eigenen HANDOFF-Abschnitt (B3): −37 k Tokens oder eine
   Fehlgrundlage je Succession.** Kleinste Form: Brief-Satz „Lies den obersten Abschnitt, dessen
   Überschrift `<program.id.slice(0,8)>` enthält" in `buildProgramMainSuccessionBrief` Fleet-Frame;
   `buildSuccessionBrief` (ohne Program) bleibt. Verify: neuer Check in `e2e/programs.ts` mit
   zwei gestapelten Abschnitten und Id-Treffer im Brief; die Founding-Byte-Gleichheit für unbound
   Programs bleibt (bestehender Check); `bun e2e/pins.ts`.

Danach, nicht v1: B4 (Pin gegen `:NNNN` im Regelbuch), B5 (Preflight aus AGENTS in den Rail),
B7 (Packs), B8 (ein Footer-Satz), B6 (globale Datei — Owner-Datei, kein Fleet-Pin).

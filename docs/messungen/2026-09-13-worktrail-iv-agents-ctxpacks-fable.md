---
frage: Wo verlieren Lanes und MAINs Zeit, Kontext oder Richtigkeit, und welche Aenderungen an AGENTS.md/Rollenkarten je Bereich oder welche ctxPacks holen das zurueck — plus die Graphify-Hook-Frage (Nutzung, Kosten, Frische, Lane-Leerlauf)?
urteil: Der groesste messbare Verlust ist EXPLIZIT fehlende Information, nicht implizite — 130 von 181 Claude-Lanes (72 %) scheitern mindestens einmal am 4000-Zeichen-Deckel des Fleet-Reports, der weder in AGENTS.md noch im Exit-Footer steht (334 Wiederholungen, ≈98 Mio. Cache-Read- und ≈360 k Output-Tokens in 14 Tagen); danach kommen die 125/181 Briefe, die `./e2e-isolated.sh` verlangen (die Regel verlangt es fuer ~90), und 1676 `sleep`-Aufrufe in 135 Lanes trotz „go idle". Die Erdung vor dem ersten Schreiben (median 75 k Tokens, 33 Tool-Aufrufe, server.ts in 143/171 Lanes) senkt kein AGENTS.md-Satz, nur ein Pack mit INHALT. Der Graphify-Hook erzwingt nichts (nudge-only, `fails open`), feuert in Lanes gar nicht (`.claude/settings.json` gitignored, nie kopiert) und in MAIN-Sessions 9 727-mal in 14 Tagen; 74 % der Queries werden im naechsten Schritt durch rg/Read ersetzt, 48 % sind TRUNCATED, und der frisch gebaute Graph fuehrt 19 % der `function`-Deklarationen von server.ts nicht.
bereich: [reporting, land-pfad, e2e, docs-lanes, studio, fremd-harness, ctxpack, graphify]
belege: [lane-outcomes.jsonl, ~/.claude/projects/-Users-owner-claude-fleet-worktrees-*/ (181 Lanes), ~/.claude/projects/-Users-owner-*-worktrees-*/ (35 Lanes), ~/.claude/projects/-Users-owner-claude-fleet/ (223 Sessions), server.ts#LANE_EXIT_FOOTER, server/types.ts#MAX_FLEET_REPORT_TEXT, AGENTS.md §Verify §Reporting, .claude/settings.json (Haupt-Checkout), graphify cli.py#_run_hook_guard (0.9.32), graphify-out/graph.json@fbc3a0f8, .fleet/context-packs.json, context-snippets.ts, docs/messungen/2026-09-13-task-aggregation-a-e-fable.md, docs/messungen/opus-lane-kontextkosten-2026-09-12.md, docs/messungen/2026-08-30-kontext-packs-game-maker-glm.md, docs/worktrail-audit-II/*, docs/worktrail-audit-III/*, docs/worktrail-B/*, docs/worktrail-contracts-a/act1-analysis.md]
nicht-gemessen: Fremd-Harness-Lanes (59 im Ledger, keine Claude-Transkripte — Codex/Pi-Logs nicht gelesen), Tokenwirkung eines ctxPacks (kein Lauf), Graph-Frische ausserhalb der 31 in MAIN-Transkripten sichtbaren `graphify update`, Geldkosten, Qualitaet der gelandeten Arbeit (Audit-Rot je Lane nicht gejoint), Owner-Zeit
stand: 2026-09-13
---

# Worktrail-Analyse IV — AGENTS.md je Bereich, ctxPacks, Graphify-Hook

Denk- und Messlane Fable 5.1, read-only, Messfenster 2026-08-30 00:00 UTC bis 2026-09-13 12:3x auf
Branch `fleet/260913123458-db6c` (Baum `ba6177e8`). Live-Daten nur als Python-Projektion ohne
Token-Felder; Transkripte nur aggregiert (kein Rohkommando ausgegeben; `ps` nie aufgerufen). Die
vier Worktrail-Audits hat ein Opus-Subagent unter Zitatpflicht gelesen (Q1–Q5 unten, §2.6); jede
Zahl daraus traegt ihre Quelle. Owner-Vorgabe woertlich (2026-09-13 12:1x): *„nochmal eine
ausfuehrliche Worktrail Analyse machen lassen, die dann am Ende mit agent.md
Aenderungen-Verbesserungen in bestimmten Arbeits- oder Themenbereichen oder auch ctxPacks,
ausdenkt und sauber und vernuenftig ausarbeitet"*, plus die Graphify-Zusatzfrage (13:1x).

## 0. Grundmenge und Definitionen

- **Ledger:** `lane-outcomes.jsonl`, 925 Zeilen; Fenster ≥ 2026-08-30, dedupliziert je Branch
  (juengstes `ts` gewinnt) → **300 Lanes**: landed 252 · killed-empty 34 · killed-dirty 9 ·
  shelved 5. Modelle: `claude-opus-5[1m]` 162 · ohne Modell 54 · `gpt-5.6-sol` 29 · `glm-5.3` 25 ·
  `claude-fable-5-1[1m]` 17 · `gpt-5.5` 5 · `gpt-6-astra` 5. `ownerPrompts` = 0 bei 230/300.
- **Transkripte:** 181 dieser Lanes haben ein Claude-Transkript unter
  `-Users-owner-claude-fleet-worktrees-fleet-*` (landed 171 · killed-empty 6 · shelved 4), 35
  weitere unter anderen Repos (private-repo-p 8, private-repo-j 8, private-repo-j 6, private-repo-o 4, …: landed 29 ·
  killed-dirty 5 · killed-empty 1). Die 59 Fremd-Harness-Lanes (gpt/glm) haben hier kein Transkript.
- **Marker** = erster `Edit`/`Write`/`NotebookEdit`, `git commit` oder ein Bash-Schreibbefehl auf
  einen Pfad ausserhalb Scratchpad/`/tmp` (weiter als Astras Marker, der nur Edit/Write/commit
  zaehlt; darum liegen meine Marker-Kontexte unter ihren 177 k). **Kontext** = `cache_read +
  cache_creation + input` des Assistant-Turns. **pre_tools/pre_bytes** = Tool-Aufrufe und
  Result-Bytes strikt vor dem Marker. Bash-Kategorien lexikalisch (read/search/git/self:<route>/
  verify/write); zusammengesetzte Kommandos bekommen EINE Kategorie.
- **Bereich** aus `filesTouched`: `server` (server.ts/server/*) · `e2e` (e2e/*, fleet-e2e*) ·
  `client` (public/index.html, src/client.ts ohne server.ts) · `docs` (nur docs/*.md) · `other`.
- **Graph:** `graphify-out/graph.json` im Haupt-Checkout, `built_at_commit fbc3a0f8` = main-HEAD
  zur Messzeit (14:36:17, ein `graphify update` aus einer MAIN-Session 10 s nach dem Land).

## 1. Stichprobe (a) — 16 Lanes, stratifiziert

| Lane | Ausgang · Bereich · Modell | Brief (Zeichen · Kopfzeilen) | vor dem Marker gelesen | Kontext erst→Marker→Ende | Wiederholte Regelbuch-Fehler | Was fehlte / still gewusst |
|---|---|---|---|---|---|---|
| `…142809-a65e` | landed · server · Opus | 10 233 · WICHTIG, REPORT | server.ts ×9, e2e/outcomes.ts, clarify-prompt.ts (32 Aufrufe) | 65 k → 110 k → 485 k | Report-Cap 4×; 1317 Bash-Aufrufe, 10 Suite-Offer-Aufrufe, 1 waitedOut | Brief nennt Plan-§, keine Symbole; Lane fand `dossierTaskFor` selbst. Wartete pollend auf den Offer |
| `…073536-c509` | landed · server · Opus | 10 067 · VERBOTEN, VOR DEM DONE-REPORT | server.ts ×16, e2e/pins.ts ×3, repo-map.ts (149 Aufrufe, davon 46 TaskOutput) | 70 k → 228 k → 245 k | Report-Cap 5×; Gate-Rot an Stufe 1 (Rulebook-Pin, fremd) | Wusste still: Pin liest den Haupt-Checkout → „nicht meines" korrekt adjudiziert |
| `…201138-9c83` | landed · server · Fable | 11 149 · keine | server.ts ×25, e2e/watch.ts ×10, AGENTS.md ×2 (70 Aufrufe, 252 KB) | 69 k → kein Marker → 312 k | Report-Cap 1×; 13 Fremdnachrichten, endet „Login expired" | Brief ohne Kopfzeilen; 25× server.ts-Lesen fuer eine Recovery-Route |
| `…005056-09e6` | landed · e2e · (leer) | 4 898 · VERIFIZIERTE AUSGANGSEVIDENZ, SCOPE, DONE | e2e/programs.ts ×5, server.ts ×3, drei docs (57 Aufrufe) | 61 k → 179 k → 516 k | Report-Cap 4×; „no FleetEvent delivery budget" 5×; 4 waitedOut; 911 Bash / 2 Sessions | Report stand fertig im Scratchpad und kam nicht raus — der Budget-Deckel des Empfaengers ist in keinem Brief |
| `…063131-c091` | landed · e2e · (leer) | 5 700 · DONE | server.ts ×18, e2e/watch.ts ×6 (37 Aufrufe, 227 KB) | 62 k → 195 k → 377 k | Report-Cap 3×; 2 waitedOut; 3 Sessions | Rebase-Provenienz („my six files are byte-identical") still korrekt gefuehrt |
| `…145701-afa6` | landed · e2e · gpt-5.5 | 0 (Codex, kein Claude-Transkript) | — | — | — | nicht messbar (Fremd-Harness) |
| `…100019-18e9` | landed · docs · Opus | 9 890 · keine | server.ts ×17, src/client.ts ×2, vier docs (39 Aufrufe, 148 KB) | 64 k → 153 k → 168 k | Report-Cap 2× | Docs-Lane las server.ts 17× fuer ein Mess-/Optionen-Doc; Gate gab `[install, pins]`, Lane fuhr proportional (richtig) |
| `…134738-65cb` | landed · docs · fable | 5 886 · DEIN AUFTRAG, VERBOTE, DONE-KRITERIUM | server.ts ×22 (17 relativ + 5 absolut), Scrollback-Datei ×3 (24 Aufrufe, 213 KB) | 62 k → 160 k → 177 k | keine | 213 KB Lesen fuer 7 min Konzept-Doc; kein Cap-Treffer |
| `…133211-b8ea` | landed · client · (leer) | 3 219 · keine | src/client.ts ×3 (12 Aufrufe, 20 KB) | 61 k → 72 k → 156 k | Report-Cap 1×; 1 waitedOut, 2 Sessions | Brief nannte Datei + Symbol (`progShown`) → 12 Aufrufe bis zum ersten Schreiben: die billigste Erdung der Stichprobe |
| `…004850-0d0a` | killed-empty · Opus | 2 536 · keine | nichts (0 Aufrufe) | 60 k → — → 60 k | keine | Sonde per Design („LIVE PROBE ONLY") |
| `…111659-bbcb` | killed-empty · Fable 5 | 8 354 · keine | server.ts ×16, second-host-baseline ×2 (27 Aufrufe) | 64 k → — → 115 k | Report-Cap 1× | Review-Lane ohne Datei: Ergebnis nur im Report (mess-notiz-Fall) |
| `…123433-4394` | shelved · e2e · Opus | 4 333 · keine | server.ts ×22, e2e/pins.ts ×3, AGENTS.md (50 Aufrufe, 243 KB) | 61 k → 193 k → 372 k | 11 Fremdnachrichten, 3 Sessions, 1 graphify | Rerun-Beweis der Nicht-Determiniertheit korrekt (3343 PASS); shelved trotz Gruen — Entscheid lag ausserhalb |
| `…163605-0354` | shelved · server · gpt-5.5 | 0 (Codex) | — | — | — | nicht messbar |
| `…083811-8361` (private-repo-j) | killed-dirty · Preflight-Architect · Fable | 4 199 · ROLLE, INPUT, KONTEXT, WRITE-SET, DONE, VERIFY/TOOLS, STOP, REPORT | MANDAT ×2, engine/sim ×3, WORKTRAIL (24 Aufrufe) | 46 k → — → 136 k | keine | Astra-Schablone vollstaendig; killed-dirty ist der geplante Preflight-Ausgang (Card wartet auf MAIN-`ACCEPT`), kein Lane-Fehler |
| `…085742-314b` (private-repo-j) | killed-dirty · Fakten-Probe · Opus | 4 331 · ROLLE, INPUT, FRAGE, WRITE-SET, DONE, TOOLS/VERIFY, STOP, REPORT | WORKTRAIL ×4, MANDAT ×3, engine/sim ×2, AGENTS.md (40 Aufrufe) | 46 k → — → 150 k | keine | dito; Report mit `taskId` bestaetigt |
| `…005247-0021` (private-repo-c) | landed · Reparatur R3 · Opus | 7 366 · BERICHTE | 94 git-Aufrufe vor dem Marker (Klassifikation unsicher, s. §5) | 44 k → — → 321 k | Report-Cap 1× | Reparaturlane misst erst die Bahn, dann den Hebel — still korrekt |

Lesart: Die drei Lanes mit Symbol im Brief (`b8ea`, beide private-repo-j) liegen bei 12–40 Aufrufen vor
dem Marker; die drei mit „Plan-§"-Verweis oder ohne Kopfzeilen bei 32–149. Das ist n=6, kein
Beweis — die Breite kommt aus §2.

## 2. Muster ueber die 181 Claude-Lanes (b)

### 2.1 Der Report-Deckel: die eine explizite Luecke mit dem groessten Preis

| Groesse | Wert |
|---|---|
| Lanes mit ≥ 1 abgewiesenem Fleet-Report `text must be at most 4000 chars` | **130 / 181 (72 %)** — landed 127/171, killed-empty 2/6, shelved 1/4 |
| abgewiesene Versuche gesamt | **334** (Verteilung je Lane: 1× 65 · 2× 24 · 3× 10 · 4× 15 · 5–12× 16) |
| Laenge des scheiternden Kommandos | median 4 722 Zeichen, p90 7 409 — die Lanes ueberschiessen den Deckel meist um 10–20 % |
| Kontext am Wiederholungs-Turn | median 292 840 Tokens → **≈ 98,2 Mio. Cache-Read-Tokens** und ≈ 359 k Output-Tokens fuer die 334 Wiederholungen |
| pro Tag | 6–23 betroffene Lanes, kein Trend nach unten (09-07: 52 Versuche / 23 Lanes; 09-12: 25 / 10) |
| danach doch ein angenommener Report | 125 / 130 |
| zweite Abweisung `body must contain only status and text` | 57 Versuche in 17 Lanes (Zusatzfelder `files`/`filesOrigin` in 2, Rest nicht parsebar) |

Wo der Deckel steht: `server/types.ts#MAX_FLEET_REPORT_TEXT = 4000`, Fehlertext in
`server.ts` (Route `fleet-report`), dokumentiert NUR in `docs/self-api.md` (§fleet-report, „≤
`MAX_FLEET_REPORT_TEXT` (4000 Zeichen)"). NICHT in `AGENTS.md` §Reporting, NICHT im
`server.ts#LANE_EXIT_FOOTER` (der das curl-Beispiel liefert und „ONLY those two fields" sagt),
nicht in `docs/lane-brief-template.md`. Bereits am 2026-08-30 als Reibung notiert
(`docs/messungen/2026-08-30-kontext-packs-game-maker-glm.md` §1.1 Befund 3) — 14 Tage spaeter
unveraendert. Das ist der Owner-These ENTGEGEN: die teuerste Luecke ist keine implizite
Information, sondern eine Zahl, die an keiner Stelle steht, die die Lane liest.

### 2.2 Erdung vor dem ersten Schreiben — was gelesen wird, unabhaengig vom Brief

| Gruppe (landed) | n | pre_tools med / p90 | pre_bytes med | Kontext erster Turn → Marker (med) | Bash gesamt med | Minuten med |
|---|---:|---:|---:|---:|---:|---:|
| alle | 171 | 33 / 73 | 121 KB | 69 083 → 144 382 (**≈ 75 k Erdung**) | 102 | — |
| server | 40 | 34 | 136 KB | → 137 926 | 126 | 139 |
| e2e | 81 | 35 | 129 KB | → 153 663 | 131 | 138 |
| client | 8 | 18,5 | 133 KB | → 144 554 | 91 | 181 |
| docs | 30 | 20,5 | 76 KB | → 107 969 | 57 | 29 |
| Opus 5 [1m] | 127 | 33 | — | → 147 157 | 124 | — |
| Fable 5.1 [1m] | 12 | 53,5 | — | → 245 285 | 62 | — |

- **Was vor dem Marker gelesen wird (Lanes von 171):** server.ts **143** · e2e/pins.ts 90 ·
  server/types.ts 42 · e2e/programs.ts 40 · e2e/tasks.ts 34 · src/client.ts 32 · e2e-isolated.sh
  31 · e2e-stage.sh 31 · e2e/watch.ts 29 · docs/self-api.md 26 · e2e/harness.ts 26 · AGENTS.md
  13 (18 ueber die ganze Lane) · CLAUDE.md 2 (der Loader liefert sie, Lesen ist unnoetig).
- **Docs-Lanes lesen den Server:** 20 von 30 gelandeten Docs-Lanes lesen `server.ts` vor dem
  Marker; ihre pre_bytes median 109 KB gegen 47 KB bei den zehn anderen. Eine Konzept-Lane
  (`65cb`) las 213 KB fuer ein 7-Minuten-Doc.
- **Erste fuenf Aufrufe:** das haeufigste Muster ist `git-history → read → read → search → read`
  (7 Lanes), Varianten davon in 30+ Lanes; `self:gate` als ERSTER Aufruf nur in 3 Lanes, obwohl
  AGENTS.md §Verify „Ask `GET /api/self/gate` first" sagt (`self:gate` irgendwo vor dem Marker:
  153 Aufrufe).
- **Kategorien vor dem Marker (Summe ueber 171 Lanes):** search 2 790 · read 2 053 · other 878 ·
  git-history 621 · verify/run 178 · git-status 175 · write/script 173 · self:gate 153 ·
  self:suite-offer 82 · self:fleet-report 72 · self:drift 62.
- **Fable-Lanes** (n=12, fast alle server/e2e in der ersten September-Woche) erden mit 53,5
  Aufrufen und 245 k Tokens deutlich teurer als Opus (33 / 147 k) — Beobachtung, kein kausaler
  Befund (Bereichs- und Zeitmischung).

Die Erdung ist ein INHALTS-Problem: 143/171 Lanes lesen server.ts, weil ihr Brief Symbole nennt
(oder nicht nennt), deren Zeilen sie nicht hat. Kein AGENTS.md-Satz ersetzt diese Bytes; nur ein
Paket, das die Zeilen liefert (§3.4), oder ein Brief, der Datei+Symbol traegt (`b8ea`: 12 Aufrufe).

### 2.3 Brief-Merkmale gegen Erdung — die Owner-These an der Stichprobe

| Brief traegt … | n (landed) | pre_tools med | Kontext am Marker med | ohne: n / pre_tools / Marker |
|---|---:|---:|---:|---|
| ContextPlan-v2-Anker | 166 | 33,5 | 144 382 | 5 / 0 / — (Codex-Lanes ohne Transkript) |
| VERIFY-Zeile | 166 | 33,5 | 144 382 | 5 / 0 / — |
| DONE-MEANS-Block | 28 | **22** | 140 196 | 143 / 34 / 144 382 |
| Files/FLAECHE-Zeile | 22 | **25** | 152 319 | 149 / 33 / 143 792 |
| „graphify" erwaehnt | 41 | — | — | 22 Lanes benutzten es (§4) |
| `e2e-isolated` verlangt | 123 | — | — | §2.4 |
| Notizen auf der Flaeche | 64 | — | — | — |
| ctxPack erwaehnt | 1 | — | — | — |

Befund zur These *„implizite Informationen in Briefs und MDs wirken auf die Arbeitsqualitaet"*:
(1) Die Anker (166/171) senken die Erdung NICHT messbar — sie zeigen, liefern aber keine Zeilen;
die Baseline von 33 Aufrufen gilt MIT Ankern. (2) DONE-Block und FLAECHE-Zeile korrelieren mit
weniger Aufrufen (22 bzw. 25 gegen 34), aber n=28/22 und der Marker-Kontext bleibt gleich — die
Lane liest dieselben Dateien, nur schneller. (3) Was die Audits als „still gewusst" fuehren (§2.6
Q4: Kanal selbst oeffnen, Rebase zerstoert den Blindheitsbeweis, Join ueber Event-Id), sind
Handlungswissen-Saetze, keine Dateien — die gehoeren in Invarianten-Zeilen eines Bereichs-Packs,
nicht in einen generischen AGENTS.md-Absatz. (4) Die teuersten Verluste (§2.1, §2.4, §2.5) sind
explizite Einzelsaetze. Die These haelt also fuer QUALITAET (Q2/Q4 der Audits: Kanal, Verdikt,
Blindheit), nicht fuer KOSTEN — dort wirken Zahlen und Mechanik-Saetze.

### 2.4 Verify: die Vorschau wird viel oefter verlangt als die Regel es tut

AGENTS.md §Verify: *„Run it only if you touched the `e2e/` lifecycle, a suite wrapper, or the
merge/land path."* Das Regelbuch (Owner-Entscheid 2026-09-06) zusaetzlich: bei einer Aussage, ueber
die eine Behauptung steht. Gemessen an den 181 Briefen:

| Brief verlangt `./e2e-isolated.sh` | Lane fuhr lokal | Lane bot an (Suite-Offer) | Lane tat nichts |
|---|---:|---:|---:|
| ja (125) | 69 | 30 | 26 |
| nein (56) | 8 | 9 | 39 |

Je Bereich verlangt: e2e 73/81 · server 32/40 · other 8/12 · docs **7/30** · client 3/8. Nach der
Regel duerften es ~90 sein (e2e + Wrapper + Land-Pfad); 125 sind es, und 69 Lanes fuhren die
30–45-min-Suite trotz Offer-Regel lokal (der Offer-Pfad ist seit 2026-09-01 promoviert; „lokal"
schliesst den Fallback nach dem Wartebudget ein — nicht getrennt messbar). `waitedOut` erscheint
in 70 Lanes (232 Treffer). Der Brief-Compiler und die Briefschreiber verlangen die Vorschau also
per Default; die Regel sagt das Gegenteil.

### 2.5 Warten: „go idle" steht im Footer, `sleep` in 135 Lanes

| Groesse | Wert |
|---|---|
| Lanes mit ≥ 1 `sleep N` | 135 / 181 (1 676 Aufrufe; ≥ 10 in 58 Lanes, ≥ 30 in 16, max 74) |
| Kontext des Schlafens | Suite-Lauf/Log-Tail 885 (122 Lanes) · sonstiges 445 (93) · **Suite-Offer 297 (64)** · tmux 37 (20) |
| `TaskOutput`/`Monitor`-Polling | 52 Aufrufe vor dem Marker, eine Lane mit 46 |

Der Footer sagt fuer den Offer „go idle … delivered into this pane by itself"; 64 Lanes pollten den
Offer trotzdem. Fuer den EIGENEN lokalen Suite-Lauf nennt kein Absatz einen Mechanismus (Vordergrund
mit Timeout, `run_in_background` mit Abschlussereignis) — die Lane erfindet die Schleife. Kosten
abgeleitet: 1 676 Wartezuege × ≈ 200–250 k Kontext ≈ 0,3–0,4 Mrd. Cache-Read-Tokens in 14 Tagen.

### 2.6 Regel gelesen ≠ Regel gewirkt — die kleinen, aber echten Klassen

| Signatur (lexikalisch, nur Kommandos ausserhalb Heredocs) | Aufrufe | Lanes |
|---|---:|---:|
| `ps` mit `command`/`args`-Spalte ohne Reduktion (`grep -c`, `wc`, `cut`, `sed`) | 48 | 20 |
| `rg` ueber gitignorte Datei ohne `-uu` (leeres Ergebnis) | 6 | 6 |
| `bun server.ts` ohne Env-Praefix im selben Segment | 5 | 5 |
| `pkill -f` / `killall` | 2 | 2 |
| `$FLEET_HOST` / `http://:8790` | 0 | 0 (die Handoff-Fassung ist tot) |
| `graphify update` aus einer Lane | 0 | 0 |
| 409 `not a lane` | 4 | 4 |
| `no FleetEvent delivery budget` | 7 | 2 |

Aus den Audits (Subagent-Lesung, verifiziert am Transkript, Zitate in den Dateien): `git add -A`
neben laufender Lane mit 497 Fremdzeilen (`docs/worktrail-audit-III/private-repo-g.md` Zeile 5) ·
`self/autos` 0/0 bei 133 min Stille (`private-repo-d.md` §3, §6) · 35 von 88 Lesungen mit dem
Owner-Token aus `fleet.json` statt Self-Token (`docs/worktrail-B/B2-opus-audit-2026-08-23.md` §2.5) ·
erfundene Merge-SHA im HANDOFF (`private-repo-d.md` §1) · eigene Vorbedingungsregel unter Zeitdruck
gebrochen (`tower-grossfehler-glm.md` §5, E9). Gegenprobe, wo die Regel WIRKT: Merge-Polling
`GET /api/slots/:id/merge` 0× in 24 h (`B2` §2.2); kein `ps`-Output in der Fable-Tower-MAIN
(`private-repo-k.md` §2).

Was in den Audits als „fehlte im Brief" wiederkehrt (Q2, ≥ 3 Audits): (i) kein Auslieferungs-KANAL,
nur Artefakte („playable" als Zustand statt als Link, Tower/arcade/private-repo-g) · (ii) Repo nicht in
`FLEET_VERIFY_CMD_REPOS` → jeder Land `verified: null`, Audit `unknown` (private-repo-d, private-repo-g,
Tower: 10/10 Lands) · (iii) Done-Kriterium ohne maschinellen Check (Screenshots „committen" — 0
Dateien getrackt, `private-repo-g.md` (4)) · (iv) Boot-Lesung `register.sh` unbedingt im Brief: 35,8 %
der gelesenen Bytes einer MAIN, von den Aufrufern gleich wieder abgeschnitten (`B2` §M-C).

### 2.7 MAIN-Sessions (Haupt-Checkout, 223 Sessions in 14 Tagen)

17 337 Bash-Aufrufe, 28,0 MB Result-Bytes: read 24,8 % · search 21,4 % · sonstiges 13,6 % ·
`tmux capture-pane` 9,6 % (1 160 Aufrufe) · `/api/self/*` 8,9 % · **`register.sh` 7,9 % (204
Aufrufe, 2,2 MB)** · `/api/other` 4,3 % · `state.sh` 3,5 % · `/api/sessions` 3,0 % · graphify
query 1,2 %. In den ersten fuenf Aufrufen einer Session: `register.sh` 179×, `state.sh` 173× —
der Boot ist ein festes Ritual, das B2 schon 2026-08-23 als groessten Einzelposten mass.

## 3. Vorschlaege je Bereich (c) — Diff-Text, Effekt, Risiko, Verify

Alle Vorschlaege sind PROPOSE; AGENTS.md aendert nur die Owner-Promotion, CLAUDE.md ist generiert
(Fragment unter `rulebook/`, Render, Pin).

### 3.1 Reporting (jede Lane) — der Deckel in Vertrag, Footer und Pin

**AGENTS.md §Reporting, alt:**

```
Summary, the quoted verification tails, and one line for anything left unresolved. Report only your
slice. If you changed `CLAUDE.md`, say so as TEXT in the report — it is git-ignored and your copy
dies with this working copy, so someone else has to carry the change over by hand.
```

**neu:**

```
Summary, the quoted verification tails, and one line for anything left unresolved. Report only your
slice. The report body is `{status, text}` and nothing else; `text` is at most 4000 characters
(`server/types.ts#MAX_FLEET_REPORT_TEXT`) — write it to a scratch file first, check `wc -c`, then
POST once. Numbers and tails belong in the tracked note or commit body, not in the report; the
report points at them. If you changed `CLAUDE.md`, say so as TEXT in the report — it is git-ignored
and your copy dies with this working copy, so someone else has to carry the change over by hand.
```

**`server.ts#LANE_EXIT_FOOTER`, Akt 2, alt:** *„`text` is prose for a human reader: what you did, the
quoted verification result, and one line for anything left unresolved. The body takes ONLY those
two fields."* **neu:** *„`text` is prose for a human reader (at most ${MAX_FLEET_REPORT_TEXT}
characters — write it to your scratchpad, `wc -c`, then POST once): what you did, the quoted
verification result, and one line for anything left unresolved. The body takes ONLY those two
fields."* — die Zahl aus der Konstante, nie als Literal (die Route liest dieselbe Konstante).

**Pin (`e2e/pins.ts`):** `LANE_EXIT_FOOTER` enthaelt `MAX_FLEET_REPORT_TEXT`, und AGENTS.md
§Reporting nennt die Zahl, die `server/types.ts` traegt (Muss-Paar Doc↔Konstante, wie RULE_VERIFY).

**Effekt (aus §2.1):** −334 Wiederholungen / 14 Tage ≈ −98 Mio. Cache-Read- und −359 k
Output-Tokens, ein Turn weniger in 72 % der Lanes; die 5 Lanes, die nach dem Cap NICHT mehr
berichteten, bekommen ihren Ausgang. **Risiko:** keins — die Zahl steht schon in der Route.
**Verify:** `bun e2e/pins.ts` (neuer Pin) + Zaehlung `text must be at most` in Lane-Transkripten
der naechsten 14 Tage → Ziel 0 (Skript §5).

### 3.2 Land-Pfad und e2e — die Vorschau nach Regel verlangen, nicht per Default

**AGENTS.md §Verify, alt:**

```
`./e2e-isolated.sh` is the slow tier and is NOT part of the above. Run it only if you touched the
`e2e/` lifecycle, a suite wrapper, or the merge/land path. Suites take a shared mutex, so a run may
wait a long time before it starts — that is normal, not a hang.
```

**neu:**

```
`./e2e-isolated.sh` is the slow tier and is NOT part of the above. It is owed only if you touched
the `e2e/` lifecycle, a suite wrapper, the merge/land path, or a statement some check asserts
(`supports.*`, `effortLevels`, a contract default) — a brief line demanding it does not widen this
rule, and a docs-only lane never owes it. When it is owed and a helper is online (`GET
/api/self/gate` carries `helper`), OFFER it (`POST /api/self/suite-offer`) and go idle: the verdict
is delivered into your pane. Run it locally only after the offer's wait budget expires, in the
foreground with a timeout — never in a `sleep` loop over a log. Suites take a shared mutex, so a
run may wait a long time before it starts — that is normal, not a hang.
```

**Brief-Compiler / `docs/lane-brief-template.md` §DONE:** „Vorschau nur, wenn `classifiedAs` einer
Diff-Datei `e2e`/`wrapper`/`land-path` ist" — der Compiler hat diese Klassifikation
(`verify-proportion.ts`), der Brief-Satz soll aus ihr gerendert werden, nicht aus Gewohnheit.

**Effekt (aus §2.4):** 125 → ~90 verlangende Briefe; von den 69 lokalen Laeufen fallen die 26–35
weg, deren Brief ohne Regelgrund verlangte (je 30–45 min Mac-Mutex, den der Post-Land-Audit
ohnehin belegt). **Risiko:** weniger Vorschau vor dem Land bei Server-Lanes ohne e2e-Beruehrung —
der Post-Land-Audit misst denselben Baum in Stufe 2, der Owner hat das 2026-09-06 so entschieden.
**Verify:** `e2e/pins.ts#RULE_VERIFY` (Kettenordnung unveraendert) + Zaehlung „Brief verlangt /
Lane fuhr lokal" (Skript §5) in 14 Tagen.

### 3.3 Warten (jede Lane) — der Mechanismus in den Footer

**`LANE_EXIT_FOOTER` Akt 3, alt:** *„THEN GO IDLE. Do not poll for a reply and do not schedule a
check-in to wait for one … after POST /api/self/suite-offer you go idle and the terminal result —
green or red — is delivered into this pane by itself. Do not poll."*

**neu (Ergaenzung, zwei Saetze):** *„The same holds while your OWN verify runs: run it in the
foreground with a timeout, or in the background and wait for its completion event — never a
`sleep`/`tail` loop over a log (a `nohup` log is block-buffered; „0 PASS lines" is your observer
error). A `waitedOut` gate has not looked at your tree; it is not red."*

**AGENTS.md §Hard invariants „Waiting is event-driven"** bleibt; der Satz dort ist richtig, ihm
fehlt nur das Lane-Beispiel — das gehoert in den Footer (er ist der Text, den jede Lane liest).

**Effekt (aus §2.5):** 1 676 Wartezuege in 135 Lanes → Ziel < 200; abgeleitet 0,3–0,4 Mrd.
Cache-Read-Tokens. **Risiko:** eine Lane, die den Vordergrund-Timeout zu kurz waehlt, bricht den
Lauf ab — der Footer nennt `timeoutMs` des Gates als Mass. **Verify:** Zaehlung `sleep N` je Lane
(Skript §5) in 14 Tagen.

### 3.4 ctxPacks — drei Pakete mit INHALT, auf dem Register, das schon existiert

Was existiert: `.fleet/context-packs.json` (dieses Repo: 2 Packs `rulebook-generat` 25,9 KB,
`messnotiz-index` 11,7 KB, beide `triggers: always`, beide nur ANKER — Datei+Ueberschrift, keine
Zeilen), `context-manifest.ts` (validiert, plant, rendert Anker), `context-snippets.ts`
(`planSnippets`/`buildSnippetPackage`, 8 192-B-Deckel, laut A–E-Note „not yet applied", Queue-Zeile
`c71b96eb`). private-repo-j fuehrt dasselbe Register mit 4+ Packs (`spielkarte`, `beweis-verify`,
`messnotiz-form`, `kritik-verdikt`). Die A–E-Note skizziert `karten-und-wellen` und
`self-api-tuer`. Diese Notiz baut darauf auf und aendert EINEN Punkt: ein Pack traegt neben
Ankern eine `snippets`-Liste (`datei#symbol`, ueber `buildSnippetPackage` am Dispatch-Commit
geschnitten) und `invariants` (5–10 Saetze) — die Anker zeigen, das Pack liefert.

| Pack | Trigger | Anker (2–3) | Snippets (`datei#symbol`) | Invarianten (Auszug) | Verify/Flakes | gerendert ≈ |
|---|---|---|---|---|---|---|
| `server-kern` (server-Lanes, 40/171) | `mutating` ∧ Diff-Datei `server.ts`/`server/*` | AGENTS.md#Portable operating contract · docs/self-api.md#<Route> · CLAUDE.md „Zwei Scope-Regeln" | `server.ts#boundProgramForMain`, ein Handler derselben Form, `server/types.ts#Task`, ein Check aus `e2e/self-token.ts` | „409, nie 401" · „`by` nie aus dem Body" · „eine Audit-Zeile je Akt" · „Body liest nur genannte Felder, sonst 400" · „Report ≤ 4000 Zeichen" | volle Kette; `docs/verify-tiering.md` §11.2 (Watch-Familie) | 7 KB / ~180 Zeilen |
| `e2e-check-schreiben` (e2e-Lanes, 81/171) | Diff-Datei `e2e/*` oder `fleet-e2e*` | AGENTS.md#Where a test goes · docs/verify-tiering.md#5b · CLAUDE.md „Suiten serialisieren sich" | `e2e/harness.ts#check`, `#post`, `#paneEnv`, `e2e/ctx.ts` (Kopf), `e2e-stage.sh` (Mutex-Kopf), die Familienliste aus `fleet-e2e.ts` | „Check in die Familie, nie ans Dateiende" · „Pane-Env nur ueber `paneEnv()`" · „Setup-Zeile rot ⇒ alles darunter UNGEMESSEN" · „Rerun desselben Baums beweist Nicht-Determiniertheit" · „Vorschau ueber den Offer" | pins + Vorschau (§3.2); Flake-Familien §11.2b–p | 8 KB / ~200 Zeilen |
| `docs-lane` (docs-Lanes, 30/171) | JEDE Diff-Datei docs-or-prose | docs/messungen/INDEX.md (existiert) · mess-notiz-Skill (Frontmatter, INDEX-Zeile) | keine Quell-Snippets; stattdessen `git show main:<doc>`-Liste der 3 juengsten Notizen des Bereichs | „Symbole per `rg -n 'function <name>'`, nie server.ts ganz lesen" · „Zeilenverweise nur in datierten Snapshots" · „eigene Landing-Sha nie ins Doc" · „kurze Kette install+pins, Audit ebenso" · „Report zeigt auf die Datei" | install + pins | 4 KB / ~100 Zeilen |

**Format:** derselbe JSON-Eintrag wie heute, plus `snippets: [{path, symbol, maxLines}]` und
`invariants: [string]`; Validator prueft Symbol-Aufloesung wie `validateCard`; Receipt traegt
`ctxPack: {id, sha}` wie die Anker. Deckel 16 KB gerendert (A–E). Ablage getrackt, Pflege durch
MAINs, Promotion durch den Owner (propose/promote wie jede Regel).

**Erwarteter Effekt (abgeleitet aus §2.2, nicht gemessen):** die 143/171 server.ts-Lesungen vor dem
Marker sind das Ziel; Erfolgsmass wie in der A–E-Note: Marker-Median < 120 k UND Bash-vor-Marker
< 30 fuer 10 Lanes eines Bereichs, sonst ist das Pack Ballast (`docs/tailored-context.md` §5
over-stuffing). Fuer Docs-Lanes: pre_bytes 109 KB → < 50 KB (die zehn Lanes ohne server.ts-Lesung
liegen bei 47 KB). **Risiko:** ein Pack, das falsche Symbole nennt, erdet falsch — darum Validator
am Dispatch-Commit, nie Freitext. **Verify:** `e2e/context-packs.ts` (existiert) + Pin „jedes
Snippet-Symbol loest auf" + das Messrezept oben.

### 3.5 Graphify — Hook, Rebuild, Verwaesserung (Zusatzfrage, mit Zahlen)

**Was der Hook ist.** `.claude/settings.json` (Haupt-Checkout, gitignored, `.gitignore:50`) haengt
`graphify hook-guard search` an `Bash|Grep` und `hook-guard read` an `Read|Glob`. Der Code
(`graphify/cli.py#_run_hook_guard`, 0.9.32): **nudge-only** — er schreibt `additionalContext`
(„MANDATORY: … You MUST run `graphify query`"), blockiert nie (`permissionDecision: deny` nur mit
`--strict`, hier nicht gesetzt), und tut NICHTS, wenn `graphify-out/graph.json` relativ zum cwd
fehlt („fails open"). Der Owner-Satz „ERZWINGT" stimmt also nicht; es ist eine Mahnung mit dem Wort
MANDATORY.

| Frage | Messung |
|---|---|
| Lanes: Aufrufe je Lane | 79 `graphify`-Aufrufe in **22 / 181** Lanes (41 Briefe erwaehnen graphify); median Ergebnis 151 B; 11 TRUNCATED („71 of 277", „80 of 1037"), 4 Fehler (`timeout` fehlt auf macOS) |
| Lanes: naechster Schritt nutzt die Ausgabe | nach 79 Queries: graphify 26 · search 18 · read 13 · gate 5 · write 5 · verify 3 → **8 / 79 (10 %)** produktiv, 31 (39 %) sofort rg/Read |
| Lanes: Hook-Leerlauf | **0** — der Worktree hat kein `.claude/settings.json` (nicht getrackt, `createWorktree` kopiert nur `.env`/`CLAUDE.md`/`OWNER.md`/`settings.local.json`) und keinen Graph; 0 Nudges in 181 Lane-Transkripten. Lanes zahlen den Hook nicht, sie haben ihn nicht |
| MAIN-Sessions (223, 14 Tage): Nudges | **9 727** modellsichtbare `hook_additional_context` in 149 Sessions (median 46 / Session, p90 88, max 337) ≈ 55 Tokens je Nudge ≈ 2,5 k Tokens dauerhaft je Session; 9 731 Hook-Laeufe × 125 ms = **26 min** Wanduhr |
| MAIN-Sessions: Queries | 156 in 88 Sessions; **75 TRUNCATED (48 %)**; median 2,3 KB, Summe 409 KB ≈ 100 k Tokens; naechster Schritt: search 91 · read/Read 25 · graphify 13 · write 11 · other 11 → **116 / 156 (74 %) danach doch rg/Read**, 11 (7 %) direkt produktiv |
| Frische: heute | `built_at_commit` = main-HEAD (0 Commits dahinter), gebaut 14:36:17 durch `graphify update` einer MAIN-Session — 31 solche Updates in 14 Tagen gegen 252 Lands |
| Frische: zur Query-Zeit | Commits auf main zwischen letztem sichtbaren Update und Query: median **48**, p90 387 (n=147; nur 2 Queries bei 0) — obere Schranke, Updates ausserhalb der MAIN-Transkripte nicht sichtbar |
| Abdeckung im FRISCHEN Graph (server.ts + server/*.ts, Labels normalisiert `name()`→`name`) | `function` 122 / 639 fehlen (**19,1 %**; server.ts 111/582, z. B. `confirmCardsForMain`, `cardDue`, `contextFill`, `taskDigest`) · Arrow-Konstanten 37/161 (23 %) · Typen 51/297 (17 %) · uebrige Konstanten 421/656 (64 %) · gesamt 631/1 757 (35,9 %). Nicht positionsabhaengig (fehlende Funktionen ueber alle 2 000-Zeilen-Buckets gestreut) |
| Verwaesserung | 10 729 Knoten: docs/other 2 158 · docs/attic 2 118 · docs/messungen 1 521 · attic 957 · HANDOFF.md 399 · graphify-out/memory 289 = **7 442 (69 %) Prosa/Archiv** gegen server.ts 932 · src 720 · e2e 418 · server 240. Kanten: EXTRACTED 15 124, **INFERRED 57** — die Verwaesserung kommt aus der KNOTENZAHL (TRUNCATED bei 73 von 159), nicht aus INFERRED-Kanten |

**Vorschlag (Bereich Graphify):**

1. **Hook-Politik: advisory bleibt, das Wort verschwindet.** Den `Read|Glob`-Eintrag aus
   `.claude/settings.json` nehmen (Reads sind zu 74 % ohnehin die Fortsetzung einer Query), den
   `Bash|Grep`-Eintrag behalten; dazu ein Satz in `rulebook/einstieg.md` (Haupt-Checkout-Fassung):
   *„`graphify query` fuer Architektur-Fragen (welche Module, welche Community); `rg`/`ast-grep`
   fuer Symbol-Suche — der Graph fuehrt ein Fuenftel der Funktionen nicht."* Lane-Ausnahme ist
   schon Realitaet (kein Hook, kein Graph; AGENTS.md §Codex/Pi nennt den Rueckweg) — nichts zu
   aendern, nur nicht als Pflicht beschreiben. Effekt: −4 900 Nudges/14 Tage (die Read-Haelfte),
   −13 min Hook-Laufzeit; Risiko keins.
2. **Rebuild als Server-Schritt nach dem Land, `--code-only`.** `server.ts` (Kommentar bei
   `runGraphStep`) misst 5,7 s fuer `graphify . --code-only` (1 158 Knoten / 2 938 Kanten) und
   nennt, dass der Voll-Build an 108 Doc-Dateien einen LLM-Key verlangt. Ein Post-Land-Schritt im
   Haupt-Checkout (nicht `graphify watch`, nicht `.git/hooks` — beerdigt laut
   `docs/work-register-2026-08-06.md` §7) haelt den Graph bei 0 statt median 48 Commits dahinter.
   Risiko: 5,7 s je Land auf dem Mac-Mutex; ein Fehlschlag darf den Land nie rot machen (`null`
   wie heute). Verify: Pin „`built_at_commit` ist Vorfahr von main" als Sensor in `GET /api/self/gate`
   oder Rundgang.
3. **Docs aus dem Query-Graph nehmen, nicht aus dem Repo.** `--code-only` beantwortet das
   direkt: 69 % der Knoten sind Prosa/Archiv, und die INFERRED-Kanten (57) sind es nicht wert,
   dafuer einen Key zu zahlen. Wer Docs-Zusammenhaenge will, hat `docs/messungen/INDEX.md` und
   `git log -S`.
4. **Abdeckungs-Sonde.** Ein `bun`-Skript (Muster §5) vergleicht `function`-Deklarationen gegen
   Graph-Labels; > 10 % fehlend ⇒ der Graph ist fuer Symbol-Aufloesung nicht zu benutzen (der
   Kartenvalidator hat den Deklarations-Fallback zu Recht).

### 3.6 Studio / Game-Maker und Fremd-Harness — kurz

- **Studio:** die fuenf killed-dirty-Lanes des Fensters sind private-repo-j-Preflight-Lanes
  (Architect, Probe) mit vollstaendiger Astra-Schablone (ROLLE/INPUT/…/STOP/REPORT), 24–40
  Aufrufen und 0 Cap-Treffern — killed-dirty ist dort der geplante Ausgang (Card wartet auf
  `ACCEPT`). Kein AGENTS.md-Bedarf; das Pack-Register existiert. Einziger Uebertrag: der
  Report-Deckel (§3.1) gilt auch dort (private-repo-c R3: 1 Treffer), und das GLM-Pack-Katalog-Doc
  vom 08-30 nennt ihn schon.
- **Fremd-Harness:** 59 Lanes (gpt/glm) ohne Claude-Transkript — Cap, Erdung, Polling dort
  ungemessen. AGENTS.md §Codex/Pi braucht denselben Deckel-Satz wie §Reporting; ob Codex-Lanes
  ihn treffen, muesste `audit.jsonl`/Codex-Logs zeigen (nicht gelesen).

## 4. Rangliste — hoechstens fuenf, mit Schnittlinie

Owner-Vorgabe woertlich: *„… mit agent.md Aenderungen-Verbesserungen in bestimmten Arbeits- oder
Themenbereichen oder auch ctxPacks, ausdenkt und sauber und vernuenftig ausarbeitet."* Erfuellt ist
sie mit §3; die Rangliste schneidet nach gemessenem Verlust je Zeile Aenderung.

1. **Report-Deckel in AGENTS.md §Reporting + Footer + Pin (§3.1)** — 130/181 Lanes, 334
   Wiederholungen, ≈ 98 Mio. Cache-Read-Tokens; eine Zahl, drei Zeilen, kein Risiko.
2. **Verify-Absatz und Brief-Compiler: Vorschau nur nach Regel, Offer-first (§3.2)** — 125 → ~90
   verlangende Briefe, 26–35 lokale Suitenlaeufe weniger je 14 Tage.
3. **Warte-Mechanik im Footer (§3.3)** — 1 676 `sleep` in 135 Lanes; abgeleitet 0,3–0,4 Mrd.
   Cache-Read-Tokens.
4. **Graphify: Read-Hook raus, Post-Land-`--code-only`-Rebuild, Abdeckungs-Sonde (§3.5)** —
   9 727 Nudges, 74 % Queries ohne Folge, median 48 Commits alt, 19 % Funktionen fehlend.
5. **ctxPacks mit Inhalt (`server-kern`, `e2e-check-schreiben`, `docs-lane`) auf dem
   bestehenden Register (§3.4)** — Ziel der 75 k Erdungs-Tokens je Lane; als einziger Posten
   ohne gemessenen Effekt zuletzt, mit dem Messrezept der A–E-Note als Done.

— Schnittlinie —

Nicht gefilet: Fable-vs-Opus-Erdung (n=12, Mischung) · `ps`-Hygiene (20 Lanes, Regel steht, Sonde
waere ein Hook) · `register.sh`-Boot der MAINs (B2 hat es, gehoert in die Controller-Rollenkarte,
nicht in AGENTS.md) · Studio-Schablone (steht) · Fremd-Harness (ungemessen).

## 5. Methode und Reproduktion

Scratch: `/private/tmp/claude-501/-Users-owner-claude-fleet-worktrees-fleet-260913123458-db6c/15f0b761-9e66-454f-a886-0e85ed6d73f8/scratchpad/`
(`outcomes14.py` → `lanes14.json` · `lanes_tx.py` → `lanes_tx.json` (181 Zeilen je Lane, Kategorien,
pre_*, Kontexte, Signaturen, graphify) · `lanes_tx_other.py` → `lanes_tx_other.json` (35) ·
`main_tx.py` → `main_tx.json` (Nudges, Queries, Frische) · `deep.py` (Stichprobentabelle) · die
Ad-hoc-Skripte fuer Cap, Signaturen, Suite-Verhalten und Graph-Abdeckung stehen im Transkript
dieser Lane). Kein Skript gibt Kommandozeilen aus; Ergebnis-Bodies werden nur lexikalisch getestet;
Ids ≥ 28 Zeichen sind in der Stichprobentabelle als `<id>` redigiert. Scratch ist kein Archiv.

Kernrezepte, wiederholbar:

```sh
# 4000-Cap je Lane (Tool-Result eines curl-fleet-report-Aufrufs, Text der Route)
python3 - <<'EOF'
# fuer jedes Lane-Verzeichnis: tool_use(Bash, 'fleet-report' in command) -> tool_result mit
# 'text must be at most' zaehlen; Kontext = usage des umgebenden Assistant-Turns
EOF
# Graph-Abdeckung (Haupt-Checkout, read-only)
python3 - <<'EOF'
# labels = {label.rstrip('()') for node in graph.nodes if source_file==f}
# decls  = ^(export )?(async )?function NAME  je Datei server.ts, server/*.ts
# fehlend = decls - labels
EOF
# Hook-Nudges (MAIN-Transkripte): Zeilen type=attachment, attachment.type=hook_additional_context,
# Inhalt 'MANDATORY: graphify-out/graph.json exists'
```

Verifikation dieser Lane: `bun e2e/pins.ts` (Tail im Report), `GET /api/self/drift`, keine Suite,
kein Serverstart, `ps` nie aufgerufen, keine Owner-Route.

## Entscheidungs-Trail

```
ts	phase	entscheidung	warum	beleg	ergebnis
2026-09-13T12:40Z	korpus	Fenster >= 2026-08-30, dedup je Branch, nur Lanes mit Claude-Transkript vermessen	Fremd-Harness hat hier kein Transkript	lane-outcomes.jsonl, ~/.claude/projects	300 / 181+35
2026-09-13T12:55Z	marker	Bash-Schreibbefehle auf Repo-Pfade zaehlen als Marker	Astras Marker (nur Edit/Write/commit) verschiebt 153/187 Marker auf den Commit	opus-lane-kontextkosten §Grundmenge	Marker-Median 144 k statt 177 k
2026-09-13T13:10Z	hook	Nudge-Zaehlung auf attachment.type=hook_additional_context beschraenkt	hook_success ist Log, nicht Modellkontext	Transkript-Struktur, 3 Attachment-Typen	9 727 statt 20 915
2026-09-13T13:20Z	graph	Labels vor dem Vergleich um '()' bereinigt	Rohvergleich meldete 100 % fehlende Funktionen — Sondenfehler, nicht Graphfehler	server.ts-Knotenlabels 'name()'	19,1 %
2026-09-13T13:25Z	signaturen	Ergebnis-Signaturen 'untracked'/'409' verworfen	trafen git-status-Ausgaben und Doc-Texte (165/181)	zweite Zaehlung auf Kommandos/Routen	Tabelle §2.6
2026-09-13T13:30Z	cap	zweite Zaehlung 334 statt 326	erste Zuordnung tool_use->tool_result verlor Faelle bei zusammengesetzten Kommandos	Skript Cap-Kosten	334 / 130 Lanes
2026-09-13T13:40Z	audits	Lesung der 13 Audit-Dateien an Opus-Subagent mit Zitatpflicht delegiert	~400 KB Prosa, nur Zitate gebraucht	Subagent-Report Q1–Q5	§2.6
```

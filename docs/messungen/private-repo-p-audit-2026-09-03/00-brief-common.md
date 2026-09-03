# Gemeinsamer Kontext — Private-repo-p-Worktrail-Audit, Stufe 1 (2026-09-03)

Du bist EIN Strang eines gestaffelten Audits. Stufe 1 = sechs unabhängige Befund-Stränge, jeder
mit eigener Quellenmenge. Stufe 2 (später, nicht du) synthetisiert und optimiert. Dein Auftrag ist
BEFUND, nicht Reparatur: keine Fixes über zwei Sätze hinaus.

## Anlass (Owner, 2026-09-03, wörtlich)

„ich glaube vorgestern habe ich die 'Private-repo-y' App-Idee in Auftrag gegeben. Eine iosApp
session hat dann auch daran gearbeitet, und das ergebnis habe ich dann später als video reviewed,
es war nicht super super schlecht. Aber es war doch recht weit unter dem was so möglich wäre wenn
der Workflow und das alles besser angegangen worden wären. […] eine vernünftig und wohl überlegte
Analyse des privateRepoP's […] einen ausgelagerten worktrail-audit […] ein kritisches durchdenken des
benutzten workflows selbst und dann der wichtigste teil, die Optimierung des ganzen Prozesses […]
open minded gucken wo unser aktuelle workflow, sei es zum anfangen aber auch (ich glaube das haben
wir eig tatsächlich garnicht) zum weiterarbeiten einer iosApp […] ich könnte mir durchaus
vorstellen das wir gleiche oder zumindest ähnliche fehler beim erstellen des workflows [wie beim
Private-repo-o-Game-Maker-Lauf] gemacht haben."

Das Video, das der Owner sah: eine Aufzeichnung der fünf XCUITests (`private-repo-y-tour.mp4`,
Simulator, main af9f429, 134 s), kein freies Bedienen der App.

## Gegenstand

Fleet-Program `07ee8a6dee2b36d11203db2b` „Private-repo-y — erster geprüfter Workflow", Repo
`/Users/owner/private-repo-p` (main heute `5ecc505`). Zeitraum 2026-08-31 16:26 bis 2026-09-03.
Vorgeschichte im selben Repo: Program `d576186d` „iOS App Studio — reusable working circle"
(08-16→08-24) und `69305ad8` „Private-repo-p Canary — Private-repo-x" (08-24→08-30; Private-repo-x-App,
Commits f80eb73..ed42a7d). Private-repo-y begann mit der Product Card `166267e`/`f155520`.

### Akteure und Zeitleiste (Lokalzeit CEST; Transkript-Zeitstempel sind UTC = −2 h)

| Wer | Slot | Session/Lane | Zeit | Modell |
|---|---|---|---|---|
| MAIN N0 (Gründung) | 4 | Gründungsbrief 08-31 16:26; Produkt-Card-Akt b0ad8a79 gefilet | 08-31 16:26 → ? | unklar (prüfen: codex-Rollout 16:26:39?) |
| Product-Card-Lane | 5 | Task b0ad8a79, Branch fleet/260831143421-06eb | 08-31 16:34 → Land f155520 09-01 22:01 | codex / gpt-5.6-sol / high |
| MAIN N1 | 3 | Session 0def056c (Trust-Dialog fraß den ersten Brief 21:44, Wiederholung 21:47) | 09-01 21:47 → 09-02 09:03 (43 % ctx → Nachfolge) | Fable 5.1 → ab 09-02 10:36 Opus 5 |
| MAIN N1.5 | 3 | Session f18befeb | 09-02 09:03 → 14:29 (32 % ctx, Hostlast-Stopp → Nachfolge) | Opus 5 |
| MAIN N2 | 4 | Session 08d0bfa4, lebt noch | 09-02 14:29 → heute | Opus 5 / high |
| Brief 1 Lane (Fehlstart) | 1 | fleet/260901201722-fda8, killed-empty, `agent: no-agent`, tmux-Prefix-Bug s1/s10 | 09-01 22:17 → 23:57 | Fable |
| Brief 1 Lane | 1 | fleet/260901215805-c384, Task dac21cc7 → Land 91e6a77 | 09-01 23:58 → 09-02 00:55 | Fable / high |
| Brief 2 Lane | 10 | fleet/260902012023-8ce8, b78fe350 → 889d585 | 09-02 03:20 → 04:15 | Fable / high |
| Brief 3a Lane | 10 | fleet/260902034932-1e59, 94f6b4ae → e6cdf61 | 09-02 05:49 → 06:28 | Fable / high |
| Brief 3b Lane | 10 | fleet/260902070540-dfdb, e02d2285 → 4826847 (+MAIN d749111, a4f8f08); 1. Land `verify timed out` 300 s, Budget → 480 s, Re-Land | 09-02 09:05 → 11:04 | Opus 5 / high |
| Brief 4 Lane | 10 | fleet/260902090528-3713, 5b822ccc → 466f318 | 09-02 11:05 → 12:14 | Opus 5 / high |
| Brief 5 Review | 13 | fleet/260902113527-8712, dfc21621 → 34612ba (Receipt, FAIL, 4 Findings) | 09-02 13:35 → 17:04 | codex / gpt-5.6-sol / high |
| Brief 6 Lane | 14 | fleet/260902122649-2f60, d7c700b1 → c40a64f (+MAIN b5c62cd); 1. Land verify RED (UI-Toggle-Race) | 09-02 14:26 → 16:02 | Opus 5 / high |
| Brief 7 Re-Review | 7 | fleet/260902173626-47e7, d5c79ce4 → 01d99e6 (Receipt, FAIL, 2 HIGH); saß 2,5 h queued (Master-Stop) | 09-02 19:36 → 20:00 | codex / gpt-5.6-sol / high |
| Brief 8 (Computer-Use-Drive) | — | nur als Notiz f39265ee entworfen, nie gefilet | — | — |
| Brief 9 (Repair 2 HIGH) | — | ba896b1b queued seit 09-03 08:22, nicht dispatcht | — | — |

Fleet-Mechanik, die den ganzen Lauf prägte: Dispatcher master-stopped (`dispatch:false`) — JEDE
Lane wurde nach einer `blocked`-Attention vom Controller per Hand dispatcht · Verify-Budget 300 s →
480 s am 09-02 10:17 · Post-Land-Audit für private-repo-p 9/9 `unknown` (Fleet-Guard exit 42/127) ·
Host 8 GB, Load 37–49 um 14:17, ~30 parallele Sessions · Modellpolitik-Wechsel 09-02 10:36 ·
Owner-Berührung: 09-02 17:21 („wie sieht es aus? Status + Video"), 17:39 („danke für das Video,
ich gehe heute Abend alles mit Fable durch"). Der Owner hat die App nie selbst bedient.

## Quellen (nur lesen)

Scratchpad `S=/private/tmp/claude-501/-Users-owner-claude-fleet/694703e9-66cc-4d09-bd16-9279e253eaed/scratchpad/audit`:
- `ios-commits.txt` / `ios-commits-full.txt` — git log private-repo-p (Subjects / mit Bodies + stat)
- `ios-land-notes.txt` — die 9 Fleet-Land-Notes (verify, Dauer)
- `ios-lane-outcomes.jsonl` — 13 Lane-Outcome-Zeilen (disposition, Modell, sessionMs, toolResultBytes, commitCount, ownerPrompts)
- `ios-tasks.md` — ALLE Briefs 1–7, 9 und die MAIN-Notizen WÖRTLICH (387 Zeilen) — die Briefs sind hier, sonst nirgends getrackt
- `ios-programs.json` — die drei Program-Records (Intent, successCriterion, nonGoals, decisions, evidence, openQuestions, lineage)
- `founding-brief-program-main.txt` / `succession-brief-program-main.txt` — der servergebaute Gründungs-/Nachfolge-Brief der MAIN (= der Workflow-Vertrag, den die MAIN bekam)
- `ios-prompts.jsonl` — 117 Zustellungen in Panes (Briefs, Reports, Land-Verdikte, Owner-Nachrichten, Controller-Sends) mit ts/slot/source
- `ios-attention.json` (10 Attention-Requests + Antworten) · `ios-events.json` · `ios-audit-log.jsonl` (102 Owner-/API-Aktionen) · `ios-context-receipts.jsonl` (18 Brief-Zustell-Quittungen)

Repo `/Users/owner/private-repo-p` (main 5ecc505): `AGENTS.md`, `docs/PRODUCT.md` (Product Card, 396 Z.), `docs/PROOF.md`, `docs/SETUP.md`, `docs/reviews/*.md` (die zwei Codex-Reviews), `HANDOFF.md` (MAIN N2), `scripts/verify.sh` (= Land-Gate), `Private-repo-y/` (19 Swift-Dateien, 7124 Zeilen inkl. Tests), `Private-repo-x/`. Erlaubt: `make check`. VERBOTEN: `make verify`, `make review`, `scripts/verify.sh`, `xcodebuild`, `simctl` (Simulator-Lease, Hostlast).

Transkripte (Claude Code JSONL, eine JSON-Zeile je Ereignis; Felder `type`, `timestamp` (UTC),
`message.content[]` mit Blöcken `text`/`tool_use`/`tool_result`; zuerst mit python/jq Turn-Index
bauen, dann Ausschnitte lesen — NIE am Stück):
- MAIN N1 `~/.claude/projects/-Users-owner-private-repo-p/0def056c-a62b-4443-8d07-13fc8f065a3f.jsonl` (5,5 MB)
- MAIN N1.5 `…/f18befeb-0333-4e4a-8cc7-ff6495665665.jsonl` (8,0 MB)
- MAIN N2 `…/08d0bfa4-c03a-4626-9837-d54a3999f4bd.jsonl` (4,0 MB)
- Lanes: `~/.claude/projects/-Users-owner-private-repo-p-worktrees-fleet-<branch>/<uuid>.jsonl` — c384 1,9 MB · 8ce8 2,4 MB · 1e59 2,8 MB · dfdb 12,1 MB · 3713 3,7 MB · 2f60 2,2 MB
- Codex-Rollouts (anderes Format, erste Zeilen inspizieren): `~/.codex/sessions/2026/09/02/rollout-2026-09-02T13-35-31-*.jsonl` (Brief 5, 4,9 MB), `…T19-36-27-*.jsonl` (Brief 7, 6,1 MB); `~/.codex/sessions/2026/08/31/rollout-2026-08-31T16-2*/T16-3*.jsonl` (MAIN N0 / Product-Card-Lane, per Inhalt zuordnen)
- Video: `/private/tmp/claude-501/-Users-owner-private-repo-p/08d0bfa4-c03a-4626-9837-d54a3999f4bd/scratchpad/serve/private-repo-y-tour.mp4` (3,3 MB; `ffmpeg` unter /opt/homebrew/bin, Frames extrahieren und als Bild lesen)

Vorarbeiten in `/Users/owner/claude-fleet/docs/` (Vergleichsbasis Private-repo-o; NUR für den
Strang, der sie braucht): `messungen/2026-08-30-game-maker-workflow-audit-synthese.md` (3 Wurzeln,
V1–V7), `messungen/2026-08-29-main-lane-lifecycle-gaps.md` (8 Fleet-Befunde),
`messungen/2026-08-27-meta-blindspot-audit.md` (Klassen K1–K11), `attic/werkzeug-integration-blaupause-2026-08-30.md`
(B1–B12, Schnitt S1–S8 „vor dem nächsten Lauf"), `product-studio-working-circle.md`,
`attic/private-repo-p-sol-research-2026-08-23.md` (§5 Fleet-native Private-repo-p profile),
`ideen/2026-09-03-session-ledger-je-program.md`.

## Regeln

- **Nur lesen.** Keine Änderung im Repo oder an Fleet-Dateien, kein Fleet-API-Write, kein
  `bun server.ts`, kein `pkill`, kein Prozess nach Namensmuster. Scratch nur unter `$S/work-<ID>/`.
- **`fleet.json` NICHT öffnen** (trägt Token). Transkripte enthalten Token-Zeilen
  (`FLEET_SELF_TOKEN=`, `Bearer …`): nie in den Report kopieren; Kommandozeilen vor dem Zitieren
  mit `sed 's/TOKEN=[^ ]*/TOKEN=…/g'` schneiden.
- **Belegstandard:** jede Behauptung mit Fundstelle (Datei:Zeile, SHA, Task-ID, Transkript-Zeitstempel
  in Lokalzeit). Zahlen nur aus Werkzeugausgaben, nie geschätzt ohne Tilde. Am Ende drei Listen:
  **Verifiziert / Abgeleitet / Nicht geprüft**.
- **Erst Vergleichsbasis, dann Kritik:** ein Absatz, was der Lauf geleistet hat (Muster:
  `docs/messungen/2026-08-30-game-maker-workflow-audit-synthese.md` §„Was der Lauf geleistet hat").
- **Befunde gerankt nach Folgekosten** (was hat es gekostet / was kostet es beim nächsten Lauf),
  jedes mit Mechanismus-Kette, nicht nur Symptom. Fünf gute schlagen zwanzig. Schnittlinie ziehen.
- Was **fehlt** zählt mehr als was falsch ist: welcher Beweis, welche Rolle, welcher Rückweg, welche
  Zeile im Brief hat gefehlt.
- Report auf Deutsch, Markdown, ≤ ~250 Zeilen, nach `$S/report-<ID>.md`. An den Aufrufer zurück:
  ≤ 300 Wörter — Top-5-Befunde mit Kosten, ein Satz Vergleichsbasis, was nicht geprüft wurde.

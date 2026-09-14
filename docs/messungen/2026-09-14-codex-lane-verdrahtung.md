---
frage: Ist eine codex-/Sol-Lane beim Spawn anders verdrahtet als eine claude-Lane (Regelbuch, Brief-Zustellung, model/effort, Self-Env, Outcome-Sensoren), und was hat die vier Sol-killed-empty am 2026-09-05 06:16–06:18Z verursacht?
urteil: Teilweise. Spawn-Zeile, Brief-Zustellung und Self-Env sind verdrahtet (35/35 Rollouts zeigen das Ledger-Modell und die Ledger-Effort-Stufe, 45/45 Lanes binden 5–15 s nach dem Oeffnen, 35/35 tragen den Exit-Footer); nicht verdrahtet sind das Lane-Regelbuch (CLAUDE.md wird geschrieben, nie geladen) und drei Outcome-Sensoren (sessionMs, toolResultBytes und subagent sind fuer Sol 30/30 null). Die vier killed-empty waren zwei Owner-Kills mit Grund `owner`, keine Fehlverdrahtung; zwei davon hatten 4 bzw. 14 uncommittete Patches, weil killed-empty nur Commits zaehlt.
bereich: [codex, lane-lifecycle, ledger]
belege: [server.ts#CODEX_HARNESS, server.ts#waitForFoundingReadiness, server.ts#briefAndSend, server.ts#createWorktree, server.ts#buildLaneOutcome, server.ts#sessionStart, lane-context-cost.ts, lane-outcomes.jsonl, audit.jsonl.1, streams/prompts.jsonl, ~/.codex/sessions rollouts]
nicht-gemessen: eine lebende Sol-LANE (zur Messzeit lief keine; gemessen an Sol-Supervisor Slot 2 und Astra-Slots), wer den Owner-Kill am 2026-09-05 ausloeste und warum (kein Ledger traegt den Prinzipal oder die Absicht), der Arbeitsbaum der Opus-killed-empty, Tokenkosten
stand: 2026-09-14
---

# Codex-/Sol-Lanes: was beim Spawn wirklich ankommt

2026-09-14, Lane `fleet/260914192347-e279` (claude-opus-5[1m]/high, read-only). Frage: **Ist bei Sol-
und codex-Lanes etwas falsch verdrahtet (Owner-Verdacht 2026-09-14 18:5x), und woran starben die vier
Sol-killed-empty am 2026-09-05?**

Alle Zeitstempel UTC. Baum: `server.ts` am Fork `9e22b1b3`. Ledger im Haupt-Checkout, gelesen
2026-09-14 19:25Z. 14-Tage-Fenster = `ts >= 2026-08-31T19:25:26Z`. codex-cli 0.153.4.

## Ergebnis

### (a) Was eine codex-Lane beim Spawn bekommt, gegenueber einer claude-Lane

| Mechanismus | claude-Lane | codex-Lane | Beleg | Urteil |
|---|---|---|---|---|
| Worktree, Brief-Bytes, Exit-Footer, ContextPlan-Anker | `dispatchTask` → `briefAndSend` | derselbe Pfad, keine Harness-Verzweigung bis zur Readiness | `server.ts#briefAndSend` baut `deliveredBrief` harness-unabhaengig | verdrahtet: ja |
| Readiness vor dem Brief | keine (`readiness` fehlt, nur 4 s `FOUNDING_BOOT_GRACE_MS`) | 4 s Gnadenfrist, dann Warten auf `>_ OpenAI Codex (v` bis `FLEET_READY_WAIT_MS` (Default 20 000 ms, alle 500 ms). Blockscreens (Trust, Sign-in, Update) und Timeout → `requeue` | `server.ts#waitForFoundingReadiness`, `server.ts#CODEX_HARNESS` `.readiness` | verdrahtet: ja |
| Brief kommt an | — | 45/45 codex-Lanes der 14 d: `codex_bind` 5–15 s nach `slot_open`, Median 8 s; 35/35 Haupt-Rollouts (source `cli`) enthalten `HOW THIS LANE ENDS` genau einmal | Methode M3, M4 | verdrahtet: ja |
| Requeue sichtbar | — | Ein Readiness-Requeue schreibt nur `row.note` und `saveState()`; ein Audit-Event gibt es nur fuer `dispatch_requeue_skipped`. In 14 d: 0 Audit-Events mit `ready marker`, `brief withheld`, `requeued` oder Blockscreen-Text | `server.ts#briefAndSend` (`requeue`), Methode M5 | Beobachtbarkeit: nein. Ein Requeue waere nur in der fluechtigen Task-Notiz sichtbar |
| model/effort in der Kommandozeile | `slotCmd` | `--model '<m>'` und `-c model_reasoning_effort='<e>'`, beide nur wenn gesetzt | `server.ts#CODEX_HARNESS` `.spawnCmd` | verdrahtet: ja, mit zwei Luecken (unten) |
| Regelbuch | Lane-Render `CLAUDE.md` (3 von 7 Fragmenten) wird in den Worktree geschrieben und von Claude Code geladen | dieselbe Datei wird geschrieben, codex laedt sie **nicht**. Geladen werden das getrackte `AGENTS.md` (35/35) und das globale `~/.codex/AGENTS.md` („# Global Rules", 35/35). Marker des Lane-Renders („Was in dieser Fassung NICHT steht") in 0/35 Rollouts; 2/35 Lanes lasen `CLAUDE.md` per Tool | `server.ts#createWorktree` (`laneRulebookFor`), AGENTS.md §Loader boundary, Methode M6 | verdrahtet: teilweise |
| Self-Env | `FLEET_SELF_TOKEN`, `_SLOT`, `_URL`, bei Lane `_LANE='1'` | derselbe `selfExport`-String, keine Harness-Bedingung | `server.ts` `ensureSlot` (`selfExport`) | verdrahtet: ja (Code). Gebraucht: 34/35 Lanes riefen `/api/self/gate`, 30/35 `/api/self/fleet-report` |
| Lane-Hook `.claude/hooks/lane-permission.ts` | aktiv | kein Gegenstueck; `.codex/` ist gitignored und wird von `createWorktree` nicht kopiert (Kopierliste: `.env`, `CLAUDE.md`, `OWNER.md`, `.claude/settings.local.json`) | `.gitignore` (`.codex/`), `server.ts#createWorktree` | nicht verdrahtet, durch `--dangerously-bypass-approvals-and-sandbox` ohne Dialog-Anlass |

**Die Spawn-Zeile, an lebenden Panes gemessen.** Zur Messzeit lief keine Sol-Lane (Slot 5 fuehrte
eine Opus-Lane). Gemessen an den vier lebenden codex-Panes. Die Flags stammen aus `ps -o command=`,
herausgefiltert per `grep -o`, der Footer aus `tmux capture-pane`:

| Slot | fleet.json model/effort | Flags in der Kommandozeile | Footer | Rollout `turn_context` |
|---|---|---|---|---|
| 2 (Sol-Supervisor) | gpt-5.6-sol/medium | `--model 'gpt-5.6-sol'` `effort='medium'` | `gpt-5.6-sol medium` | 3× gpt-5.6-sol/medium |
| 10 (Astra-Controller) | gpt-6-astra/medium | `--model 'gpt-6-astra'` `effort='medium'` | `gpt-6-astra high` | 135× medium, dann ab 2026-09-12 06:46 3× xhigh und ab 09:18 9× high |
| 11 (Astra, resumed) | gpt-6-astra/medium | `codex resume '01a094d7…'` `--model` `effort='medium'` | — | 1× high, dann 1× medium |
| 16 (private-repo-aa) | null/null | keine Flags | `gpt-6-astra high` | — |

Daraus zwei Luecken, beide keine Fehler der Spawn-Zeile:

1. **Die Effort-Stufe kann innerhalb der Session wechseln.** Slot 10 wurde mit `medium` gestartet
   und laeuft seit 2026-09-12 auf `high`. `fleet.json` und damit `lane-outcomes.jsonl#effort`
   halten den Wert vom Spawn fest, nicht den beobachteten. Fuer Lanes ist das bisher folgenlos:
   in 35/35 Lanes mit Rollout stimmen alle `turn_context`-Werte mit Modell und Effort im Ledger
   ueberein (M4).
2. **Ohne Modell greift der Default aus `~/.codex/config.toml`**, heute `model = "gpt-6-astra"`,
   `model_reasoning_effort = "high"` (Slot 16). Das Ledger schreibt dann `model: null`. Das betrifft
   5 codex-Lanes vom 2026-09-02/03. Fuer keine davon liegt ein Rollout vor, das Modell ist also nicht
   rekonstruierbar.

**Was codex vom Lane-Regelbuch fehlt** (Zaehlung der Treffer mit `grep -c -i`, `AGENTS.md` gegen
Lane-`CLAUDE.md` dieser Lane): `FLEET_SELF_TOKEN` 0/5, Token-Hygiene `ps -eo` 0/2, `pkill` 0/2
(AGENTS.md hat sinngleich „Never kill a suite run by name pattern"), `bun server.ts` mit Default-Env
0/3, `rg -uu` 0/1, Suite-Mutex/`fleet-e2e.lock` 0/4, `autos` 0/4. Beobachtet: 4/35 codex-Lanes riefen
`ps -e…`/`ps aux`/`pgrep -af` auf, Aufrufe, die Pane-Kommandozeilen mit Self-Tokens drucken
koennen. Ob dabei ein Token ausgegeben wurde, ist nicht geprueft. Den Vergleichswert fuer Opus-Lanes
habe ich nicht gemessen.

**Nebenbefund, ohne bezifferte Kosten:** `~/.codex/config.toml` ist 1 492 105 Byte gross und hat
9 883 `[projects."…"]`-Trust-Eintraege. Davon liegen 8 502 unter `/private/var/folders/…/T/fleet-e…`
und 1 232 unter `/var/folders/sj`; nur 100 sind Fleet-Worktrees. Die Temp-Pfade passen zu Suiten,
die codex-Slots oeffnen (`e2e/restart.ts`, `e2e/security.ts` §6). Der Trust-Prelude in
`CODEX_HARNESS.spawnCmd` schreibt nach `$HOME/.codex/config.toml`, und die Suiten setzen kein eigenes
`HOME`/`CODEX_HOME`. Das habe ich aus Pfadmuster und Code abgeleitet, nicht an einem Suite-Lauf
beobachtet.

### (b) Die vier Sol-killed-empty am 2026-09-05

Die Ursache ist bekannt, eine Fehlverdrahtung war es nicht. Chronologie aus `audit.jsonl.1` (deckt
2026-07-21 bis 2026-09-07 ab; `audit.jsonl` beginnt erst 2026-09-07 15:31Z, deshalb findet eine
Suche nur dort nichts), `lane-outcomes.jsonl` und den vier Codex-Rollouts:

| Zeit | Ereignis |
|---|---|
| 03:57:05 / 03:57:11 | Slot 4 oeffnet `fleet-260905035705-b963` (9fd34beb, „LEBENSZYKLUS S2"), `codex_bind` nach 6 s |
| 04:29:45 / 04:29:51 | Slot 1 oeffnet `fleet-260905042945-1787` (db6902c4, „LEBENSZYKLUS S5a"), `codex_bind` nach 6 s |
| 04:09–05:19 | b963: 14 `apply_patch` auf `server.ts`, `e2e/pins.ts`, `e2e/programs.ts`, `docs/self-api.md`; `git status` 04:10:31 zeigt vier `M`-Dateien; Pins, tsc und Build gruen; dann drei `./e2e-isolated.sh`-Laeufe (Mutanten) |
| 04:35–05:45 | 1787: 4 `apply_patch` (`server.ts`, `e2e/pins.ts`, `e2e/steward-core.ts`, `docs/self-api.md`); `./e2e-isolated.sh` 04:35:57, Suite-Lock-Zeile 04:36:38 „position 1 of 1 — held by live pid", Wiederholungslauf 05:45:49 |
| 06:10–06:16 | beide Lanes schreiben im Minutentakt „Noch kein terminaler Befund. Ich warte erneut." und rufen `write_stdin` mit 45–60 s Yield auf die laufende Suite |
| 06:12:08–06:12:53 | Program `eec69528` („Codebase-Review … Astra fuehrt, Opus-5-Lanes lesen und bauen") wird gegruendet, MAIN Slot 3 bindet |
| **06:16:33** | `slot_kill` Slot 1 und Slot 4, Grund `owner` → Ledger: db6902c4 und 9fd34beb `killed-empty`, `commitCount 0` |
| 06:16:38 / 06:16:45 | Slot 1 oeffnet `…061637-9b97` (9da27a0b, Program `79036e9a`, `releasedBy machine`), Slot 4 oeffnet `…061645-6f86` (9fd34beb erneut). Beide `spawn` = codex/gpt-5.6-sol/high aus der Zeile selbst (`server.ts#taskSpawnOf`), `codex_bind` nach 5 bzw. 8 s |
| **06:18:47** | `slot_kill` Slot 1 und Slot 4, Grund `owner` → 9da27a0b und 9fd34beb `killed-empty`. Rollouts 92 und 109 Zeilen, 0 Patches |
| 06:18:54 / 06:19:02 | dieselben Slots oeffnen Opus-Lanes 9f1dbfb4 und bc0609f8 (`releasedBy owner`) |

Gemessen: Alle vier Lanes haben den Brief bekommen und gearbeitet; die Verdrahtung hat funktioniert.
Die beiden langen Lanes (1 h 47 min und 2 h 19 min) hatten Arbeit im Baum und keinen Commit. Sie
hingen in der Wartephase ihrer eigenen `e2e-isolated.sh`-Laeufe, genau dem Muster, das der Exit-Footer
heute verbietet. Die beiden kurzen Lanes waren Nachfuellungen: 5 bzw. 12 s nach dem ersten Kill
landeten wartende Sol-Zeilen im freien Deckel, 2 min spaeter kam der zweite Kill.

Abgeleitet, nicht belegt: Die Kills raeumten den Lane-Deckel (2/2, Slots 1+4; `fleet.json`
`programs[eec69528].evidence`: „Lane-Deckel live 2026-09-05 08:1x: 2/2 belegt … queued davor
9da27a0b, 9f1dbfb4, bc0609f8") fuer Opus-Lanes frei. **Unbekannt** ist, wer den Kill ausloeste und mit
welcher Absicht. `slot_kill` traegt nur den Grund `owner`, keinen Prinzipal. Ein Dispatch-Audit-Event
gibt es nicht, und die Task-Zeilen sind aus `fleet.json` herausgefallen (`MAX_TASKS = 200`).

**Was „killed-empty" misst:** `server.ts#buildLaneOutcome` setzt `killed-dirty` bei
`commitCount > 0`, sonst `killed-empty`. Uncommittete Aenderungen zaehlen nicht mit. Zwei der vier
„leeren" Sol-Lanes hatten 4 bzw. 14 Patches auf `server.ts`. Der Vergleich 17 % gegen 3 % misst also
„kein Commit zum Kill-Zeitpunkt", nicht „nichts getan".

### (c) Sol gegen Opus, 14 Tage aus `lane-outcomes.jsonl`

Gruppen: `harness=="codex"` nach `model`; Opus = `model=="claude-opus-5[1m]"`.

| Gruppe | n | landed | killed-empty | killed-dirty | sonst | ownerPrompts Summe | Lanes mit ownerPrompts > 0 | verified true/false/null | sessionMs ≠ null | toolResultBytes ≠ null |
|---|---|---|---|---|---|---|---|---|---|---|
| codex gpt-5.6-sol | 30 | 23 (77 %) | 5 (17 %) | 1 | 1 shelved | 12 | 9 (30 %) | 23/0/7 | 0 | 0 |
| codex gpt-6-astra | 10 | 8 | 0 | 2 | — | 1 | 1 | 8/0/2 | 0 | 0 |
| codex model null | 5 | 4 | 0 | 1 | — | 1 | 1 | 5/0/0 | 0 | 0 |
| claude-opus-5[1m] | 185 | 175 (95 %) | 5 (3 %) | 4 | 1 shelved | 91 | 43 (23 %) | 174/1/10 | 175 | 183 |

Die 5 Sol-killed-empty stammen aus **4 Tasks** und **3 Kill-Ereignissen** (06:16:33, 06:18:47,
2026-09-08 05:50).

**Sol-Lanes ohne Land.** `fleet.json#tasks` fuehrt nur noch 7eb74615; die anderen Zeilen sind
wegen `MAX_TASKS = 200` herausgefallen. Den Text-Kopf liefert deshalb das Prompt-Journal
(`streams/prompts.jsonl`, erster `auto`-Prompt je Worktree). Reports: `fleet.json#fleetReports` hat
56 Eintraege, seit 2026-07 gab es 510 `fleet_report_prune`-Events. Kein Report im Store heisst also
nicht, dass nie berichtet wurde.

| Beendet | Branch | Task | Disposition | Text-Kopf (Journal) | Status in fleet.json | Reports |
|---|---|---|---|---|---|---|
| 09-05 06:16:32 | 260905042945-1787 | db6902c4 | killed-empty | „[LEBENSZYKLUS S5a · Codex gpt-5.6-sol · Program Fleet-Betrieb] … §8-a Schnitt 5a — Adjudikations-Actor" | Zeile nicht mehr vorhanden | keiner im Store |
| 09-05 06:16:33 | 260905035705-b963 | 9fd34beb | killed-empty | „[LEBENSZYKLUS S2 · Codex gpt-5.6-sol …] §2 Schnitt 2 — D2 · Program-Status-Projektion" | nicht mehr vorhanden | keiner |
| 09-05 06:18:47 | 260905061637-9b97 | 9da27a0b | killed-empty | „[Program „Audit-Determiniertheit 2026-09", Zeile 1 von N …]" | nicht mehr vorhanden | keiner |
| 09-05 06:18:47 | 260905061645-6f86 | 9fd34beb | killed-empty | wie b963 (S2) | nicht mehr vorhanden | keiner |
| 09-08 05:50:31 | 260908050259-77a0 | 7ed73694 | killed-empty | „[LEBENSZYKLUS S12 · PROGRAM-BLICK (Client) · Codex gpt-5.6-sol …] FREIGABE erst nach Land von S2" | nicht mehr vorhanden; `attentionRequests` 3 und 5 (provenance 7ed73694): „S12 … ist blockiert; die Entscheidung ist eine Wire-Autoritaet" | Report `5082ad2c` per `autoClose` accepted (Slot 4), aus dem Store entfernt |
| 09-12 06:52:00 | 260912061623-30bc | 1e1dcd50 | killed-dirty (1 Commit) | „ROLLE: Ursachenprobe fuer bestehenden Zustellungsfix 1e1dcd50, PHASE 1 … codex/gpt-5.6-sol/medium" | nicht mehr vorhanden; Kommentar an tasks[103]: 1e1dcd50 in eine Buendelzeile ueberfuehrt | keiner |
| 09-14 08:14:10 | 260914071334-201a | 7eb74615 | shelved | „[QUEUE-INTELLIGENZ E2 · land-quality.ts … VARIANTE B (codex gpt-5.6-sol)" | `archived`, Notiz „lane closed before landing — review and requeue if still wanted" | 08:07:09 `complete`: „Commit 7e758850 implementiert den read-only Kalibrierungsanker …". Verliererin des Variantenpaars (`docs/messungen/2026-09-14-variantenpaar-1.md`) |

### (d) Sensoren, die fuer Sol null sind, und die Vergleichbarkeit

| Sensor | Sol | Warum | Quelle im Rollout vorhanden? |
|---|---|---|---|
| `sessionMs` | 30/30 null | `server.ts#sessionStart` liest `~/.claude/projects/<cwd>/<sessionId>.jsonl` | ja: erster/letzter Zeitstempel im Rollout, oder `slot_open`→`slot_kill` im Audit |
| `toolResultBytes` | 30/30 null | nur mit `supports.transcript` erhoben, bei codex `false` | ja: `function_call_output`/`custom_tool_call_output` |
| `subagent*` | kein Ledger-Feld fuer irgendeinen Harness; `lane-context-cost.ts#subagentFiles` liest nur Claude-Transkripte und fuehrt Fremd-Harness-Lanes als „nicht messbar" | — | ja: Rollouts mit `session_meta.source` = `subagent`. Beobachtet bei Astra-Lanes `0e11` (1) und `9b50` (4), bei Sol 0 in 27 Lanes mit Rollout |
| Erdungskosten (Bash bis Marker, Kontext am Marker) | nicht messbar | `lane-context-cost.ts` liest nur `~/.claude/projects` | ja: `token_count`-Records |
| `effort` | Spawn-Wert | Slot-Feld, keine Beobachtung | ja: `turn_context.effort` |

Harness-unabhaengig und damit vergleichbar: `disposition`, `commitCount`, `shortstat`,
`filesTouched`, `ownerPrompts` (Prompt-Journal nach cwd), `verified`, `briefHash`, `repairRounds`.

**Urteil zur Vergleichbarkeit eines Variantenpaars Sol gegen Opus:** Mit dem Ledger allein ist es
nur auf Ergebnisebene vergleichbar (landet, gruen, Diff, Owner-Eingriffe), nicht auf Kostenebene.
Dauer, Tool-Bytes, Subagenten und Erdung fehlen auf der Sol-Seite vollstaendig. Ein Paar, das nach
Aufwand urteilt, braucht fuer Sol einen Rollout-Leser. Die Rohdaten liegen vor: 27/30 Sol-Lanes der
14 d haben ein auffindbares Rollout.

### Urteile je Mechanismus

| Mechanismus | verdrahtet |
|---|---|
| Spawn-Zeile model/effort | ja (35/35 Rollouts = Ledger). Luecken: Effort-Wechsel in der Session und `model: null` → Config-Default bleiben unsichtbar |
| Brief-Zustellung (Readiness, Bind, Footer) | ja (45/45 Bind in 5–15 s, 35/35 Footer) |
| Sichtbarkeit von Readiness-Requeues | nein (kein Audit-Event) |
| Regelbuch | teilweise (AGENTS.md ja, Lane-Render nie geladen) |
| Self-Env | ja (Code harness-frei, Aufrufe 34/35 gate). `FLEET_SELF_URL`/`_LANE` gibt es erst seit `2b9a7fe0` (2026-09-13), an einer codex-Lane nicht gemessen |
| Outcome-Sensoren | teilweise (8 Felder ja, sessionMs/toolResultBytes/subagent nein) |
| Disposition killed-empty | harness-frei, aber sie benennt uncommittete Arbeit falsch (fuer beide Harnesses) |

### Zeilenvorschlaege (kein Fix in dieser Lane)

1. `buildLaneOutcome`: beim Kill `git status --porcelain | wc -l` als `dirtyFiles` erfassen, damit
   killed-empty uncommittete Arbeit nicht mehr verschluckt.
2. Codex-Rollout-Leser fuer `sessionMs`, `toolResultBytes`, `subagentCount` und beobachteten
   `effort` (Quelle: `CODEX_HARNESS.context.file` kennt die Datei schon).
3. `briefAndSend#requeue`: ein Audit-Event `dispatch_requeued` mit dem Grund.
4. Lane-Brief oder AGENTS.md §„If you are a Codex or Pi lane": drei Saetze aus dem Lane-Render
   uebernehmen (Token-Hygiene bei `ps`, nie `bun server.ts` mit Default-Env, `rg` ueberspringt
   gitignorte Ledger).
5. `model: null` bei einer codex-Lane: den aufgeloesten Config-Default oder das beobachtete
   `turn_context.model` ins Ledger schreiben.
6. Suiten, die codex-Slots oeffnen: eigenes `HOME`/`CODEX_HOME`, damit keine Trust-Eintraege mehr in
   `~/.codex/config.toml` landen (erst am Suite-Lauf bestaetigen).

## Methode

Alle Kommandos aus dem Worktree, Ledger unter `/Users/owner/claude-fleet/`. `NOW=1789413926000`.

- **M1 Tabelle (c):** `jq -s --argjson now $NOW 'map(select(.ts >= $now - 14*86400000)) | … group_by(.grp)'`
  ueber `lane-outcomes.jsonl`, pro Gruppe Zaehlungen von `disposition`, `ownerPrompts`, `verified`,
  `sessionMs != null`, `toolResultBytes != null`. Schluessel-Inventur: `jq -r 'keys[]' | sort -u | grep -i sub` → leer.
- **M2 Chronologie (b):** `jq --argjson a <03:50Z> --argjson b <06:25Z> 'select(.ts>=$a and .ts<=$b)' audit.jsonl.1`;
  Abdeckung: `jq -r '.ts/1000|strftime(...)' audit.jsonl{,.1} | sed -n '1p;$p'`.
- **M3 Bind-Latenz:** fuer jeden `slot_open` mit Branch aus den 45 codex-Lanes das naechste
  `codex_bind*`/`slot_kill` im selben Slot (`audit.jsonl.1` + `audit.jsonl`), Differenz in s → 45×
  `codex_bind`, min 5, Median 8, max 15.
- **M4 Rollout-Join:** `session_meta.payload.cwd` (erste Zeile, ohne Byte-Kappung, die erste Zeile
  ist > 20 KB) aller `~/.codex/sessions/2026/08/3*` und `2026/09`-Rollouts → Worktree-Name. Je Lane:
  `turn_context` → `model/effort`, gegen das Ledger verglichen: 35 match, 0 Abweichungen, 10 ohne Rollout.
- **M5 Requeue-Sichtbarkeit:** `audit.jsonl{,.1}` der 14 d nach `detail =~ ready marker|codex trust|sign-in screen|update prompt|blocked-screen|brief withheld|requeued`
  oder `event =~ requeue|readiness|not_accepted|acceptance` → 0.
- **M6 Regelbuch im Rollout:** User-/Developer-Messages der 35 `cli`-Rollouts mit `grep -F` auf
  „Was in dieser Fassung NICHT steht" (0), „# Global Rules" (35), „HOW THIS LANE ENDS" (35);
  Tool-Aufrufe auf `(cat|sed|rg|grep|head)…CLAUDE.md` (2) und `ps (-…e|aux|eww)|pgrep -af` (4) sowie
  auf `/api/self/{fleet-report,gate,drift,suite-offer}` (30/34/20/12).
- **M7 lebende Panes:** `tmux -L claudefleet capture-pane -p -t sN | tail -3` (Footer);
  `ps -o command= -p <pane_pid>|<kind> | grep -o -E "--model '[^']*'|model_reasoning_effort='[^']*'|codex resume '…"`
  (nur Flag-Treffer, keine Zeile); Self-Env nur als `grep -c 'export FLEET_SELF_…='`.
- **M8 Patches je Rollout:** `grep -c 'Begin Patch'` ueber die Tool-Argumente, `*** (Update|Add) File:` fuer die Dateiliste.
- **M9 Config:** `grep -c '^\[projects\.' ~/.codex/config.toml` (9 883), Praefix-Histogramm per `sed | sort | uniq -c`.

## Was nicht gemessen wurde

- Eine lebende Sol-**Lane**: Keine lief zur Messzeit. Die Footer-Messung stammt vom Sol-Supervisor
  (Slot 2) und von drei Astra-Panes. Deshalb ist `FLEET_SELF_URL`/`_LANE` in einer codex-Lane nur
  per Code belegt.
- Wer die Kills am 2026-09-05 06:16:33 und 06:18:47 ausloeste und warum: Das Audit fuehrt keinen
  Prinzipal, und ein Dispatch-Event existiert nicht.
- Der Arbeitsbaum der 5 Opus-killed-empty: Ob sie ebenfalls uncommittete Arbeit hatten, ist offen.
  Die Worktrees existieren nicht mehr.
- Rollouts der 10 codex-Lanes ohne Treffer, darunter die 5 `model: null` vom 2026-09-02/03: nicht
  gefunden, der Grund ist ungeklaert.
- Ob die 4 `ps`/`pgrep -af`-Aufrufe Tokens ausgegeben haben; der Opus-Vergleichswert fehlt.
- Ob die Groesse von `config.toml` (1,49 MB) den codex-Start messbar verlangsamt; die Bind-Latenz
  (Median 8 s) enthaelt Boot und Brief zusammen.
- Tokenkosten je Lane.

# Harness-Implementierungen — Mechanismen-Steinbruch (Research 2026-08-18)

Vier parallele Research-Agents (WebSearch/WebFetch, jede Quelle in der Session geladen), vom
Supervisor beauftragt auf Owner-Anweisung. **P** = Primärquelle (Code / offizielle Docs /
Vendor-Changelog), **S** = sekundär (Blog, DeepWiki, GitHub-Discussion). Unbestätigtes ist als
unverified geführt. Abgrenzung: kein Harness-Ersatz-Vergleich (Queue-Zeile `c5c34b7f` bleibt
geschlossen) — das hier ist Mechanismen-Klau für den eigenen Orchestrator.

## Fleet-Anwendungskarte (Supervisor-Adjudikation, zuerst lesen)

Die fünf Diebstahl-Kandidaten des Berichts, gegen unser Register gehalten:

1. **pi `--mode rpc` mit `agent_settled`-Event** — trifft direkt unsere Rückkanal-Wunde: wir
   fahren pi über tmux-TUI und raten Idle über capture-pane-Stille (CLAUDE.md, der ganze
   Watcher-Absatz), während unser EIGENER Harness ein dokumentiertes „ich mache von allein
   nichts mehr"-Event über JSONL anbietet (`prompt`/`steer`/`abort`/`get_state.isStreaming`).
   Betrifft Queue-Zeilen der Familie `00e5f771`/`58d03512` und den pi-Adapter.
2. **Codex `app-server` (JSON-RPC: `thread/start`, `turn/steer`, `turn/interrupt`)** — die
   gesamte Boot-Screen/Trust-Prompt/Paste-Burst-Fehlerklasse, die wir am 2026-08-12 mit der
   Readiness-Naht bounded-gefixt haben, existiert auf diesem Pfad nicht. Der TUI-Treiber bliebe
   nur für attended Sessions. (Composer-Falle bestätigt: `PasteBurst` kann ein trailing CR als
   Paste-Newline schlucken — `disable_paste_burst` existiert.) Deckt sich mit Queue-Zeile
   `54af57d6` (Codex app-server als zweiter Slot-Typ) — die ist damit von „Zielbild" zu
   „primärquellen-belegt machbar" aufgewertet.
3. **Konvergierter Stop-Hook-Gate** (Claude Code / Codex / OpenHands: exit 2 = darf nicht
   fertig sein, stderr = Anweisung; Formate deklariert kompatibel) — Verify IN der Lane statt
   nur am Land-Gate: eine Lane kann „done" strukturell nicht behaupten, bevor die Kette grün
   ist. Ein Artefakt, drei Harnesses.
4. **Spill-to-file-Disziplin als Orchestrator-Konvention** (Claude ~30k inline + Dateipfad;
   Goose 200k-Grenze; Codex-Hook-Spill mit Head/Tail-Preview) — der größte Hebel für
   GPT-Fenster-Lanes; unsere Brief-Checkliste („Suite-Ausgaben in Log-Datei") ist dieselbe
   Idee von Hand — als Konvention + ggf. Hook mechanisierbar.
5. **Amp `agent.end → continue` / Goose Recipe-`retry`** — harness-eigene
   check-rot-dann-weiter-Schleife (bounded) — genau der Auto-Verify-Nudge, den wir mit
   Watchern + send-keys nachbauen.

Ehrenwert: Amps `/handoff` (Extraktion statt Summary-Stapel) als Modell für unsere
Succession; opencodes prune-before-summarize-Konstanten (`PRUNE_PROTECT=40k`).
**Nichts davon baut der Supervisor — Kandidaten für Owner-Adoption/Queue.**

---

## 1. Context management

- **Claude Code — auto-compact**: `autoCompactWindow` (100k–1M) via `/autocompact`,
  `--autocompact`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW` (env > flag > setting);
  `DISABLE_AUTO_COMPACT`. Sonnet 5 @1M kompaktiert ~967k default; Gateway-Modelle brauchen
  `CLAUDE_CODE_MAX_CONTEXT_TOKENS`. — code.claude.com/docs/en/model-config, /settings — P
- **Claude Code — was Kompaktierung überlebt**: System-Prompt unverändert; Root-CLAUDE.md +
  Auto-Memory von Platte re-injiziert; `paths:`-Regeln und nested CLAUDE.md verloren bis
  passende Datei erneut gelesen; invokte Skills re-injiziert, Kappe 5k/Skill, 25k gesamt,
  älteste fallen, Trunkierung behält den ANFANG der SKILL.md. — /context-window — P
- **Claude Code — Cache-bewusstes Design** (ungewöhnlich gut dokumentiert): Drei-Schichten-
  Request nach Änderungsfrequenz (System → Projekt → Konversation); Cache-Key enthält
  Modell + Effort + Fast-Mode-Header; dokumentierte Cache-Invalidatoren (Modell-/Effort-
  Wechsel, MCP-Connect mit geladenen Tools, bare-tool-name-Deny, Kompaktierung) vs. Cache-
  erhaltende Formen (`/rewind` schneidet auf gecachten Präfix; Skills als User-Messages; der
  Kompaktierungs-Call nutzt den gecachten Präfix — warmes `/compact` ist billig). TTL 1h Abo /
  5min API-Key; Subagents immer 5min; `ENABLE_PROMPT_CACHING_1H=1`. Cache-Scope enthält cwd +
  git-Status-Snapshot → Worktrees teilen nie Caches. — /prompt-caching — P
- **Codex CLI — Kompaktierung**: `compact.rs`: `COMPACT_USER_MESSAGE_MAX_TOKENS = 20_000`
  (jüngste User-Messages rückwärts eingesammelt); Summary wird als USER-Message injiziert
  (`SUMMARY_PREFIX`), zuletzt platziert; überläuft die Kompaktierung selbst, fallen älteste
  Items iterativ bis `max_retries`. Prompt: `templates/compact/prompt.md` („CONTEXT CHECKPOINT
  COMPACTION … handoff summary for another LLM"). — codex-rs/core/src/compact.rs — P
- **Codex CLI — Config**: `model_auto_compact_token_limit` (absolut, nicht Prozent) +
  `model_context_window`; seit ~v0.100.0 `effective_auto_compact_limit = min(user_limit,
  window × 90%)`. Per-Modell-Defaults ~180k–244k und die 258.400-Zahl (272k × 95%): NUR
  sekundär belegt. — developers.openai.com/codex/config-sample — P/S
- **aider**: Repo-Map über Graph-Ranking, Budget `--map-tokens` (1k), expandiert ohne Chat-Files
  (PageRank ist Folklore, nicht in den Docs). History: `ChatSummary` default `max_tokens=1024`,
  Split bei Hälfte, Kopf endet auf Assistant-Message, Rekursion Tiefe 3; Budget
  `min(max(max_input/16, 1024), 8192)`; SCHWACHES Modell zuerst, im Hintergrund-Thread. —
  aider/history.py, models.py — P (Code)
- **OpenHands — Condenser**: `LLMSummarizingCondenser(max_size=10, keep_first=2)` —
  Event-Count-Trigger, erste N immer erhalten, Rest durch EINE Summary ersetzt. Vendor-Eval:
  54% vs 53% SWE-bench-Subset bei <½ Turn-Kosten. — docs.openhands.dev condenser — P
- **Goose**: `GOOSE_AUTO_COMPACT_THRESHOLD` default 0.8; `GOOSE_CONTEXT_STRATEGY:
  summarize|truncate|clear|prompt` (CLI interaktiv `prompt`, headless auto);
  `GOOSE_CONTEXT_LIMIT`, Fallback 128k. — goose docs (Mirror) — P
- **Cline**: Auto-Compact reitet bewusst auf dem Prompt-Cache; Modelle ohne Caching fallen
  still auf Regel-Trunkierung zurück. SDK-Konstanten (S): `COMPACTION_TRIGGER_RATIO=0.9`,
  `TARGET_RATIO=0.7`; „basic" (deterministisch, letzte 3 Assistant-Messages) vs „agentic";
  Legacy-Trunkierung schützt immer Index 0–1, entfernt gerade Anzahl aus der Mitte. — P/S
- **opencode — prune vor summarize**: `compaction.ts`: `PRUNE_MINIMUM=20_000` (nur handeln,
  wenn ≥20k frei werden), `PRUNE_PROTECT=40_000` (jüngste 40k Tool-Output unantastbar),
  `PRUNE_PROTECTED_TOOLS=["skill"]`; Tombstones `time.compacted`. Kompaktierung erhält Tail
  `min(15k, max(2k, usable×0.25))`, dann Auto-Continue mit fester Nudge-Message. — P (Code)
- **Amp — Handoff statt Kompaktierung, dann Teilrückzug**: 2025-10 Kompaktierung entfernt
  („lossy… stacking summary on top of summary"); `/handoff <goal>` extrahiert New-Thread-Prompt
  + relevante-Dateien-Liste als editierbaren Entwurf (Extraktion, keine Summary). 2026-07:
  Kompaktierung zurück; `read_thread`-Subagent explizit auf MISSTRAUEN gegen Summaries getuned
  („inspect original messages when exact requirements matter"). — ampcode.com/news — P
- **SWE-agent — Kontext durch Interface-Design, mit Ablationen**: 100-Zeilen-Viewer-Fenster
  (30-Zeilen und Full-File gemessen SCHLECHTER: 14,3%/12,7%); ≤50 Suchtreffer; nur letzte 5
  Observations voll (volle Historie SENKTE Erfolg auf 15,0%). — arxiv 2405.15793 — P

## 2. Tool-Output-Handling

- **Claude Code — Bash-Spill**: Output streamt in Arbeitsdatei (Kill >5 GB); Erfolg: inline bis
  ~30.000 Zeichen, darüber DATEIPFAD im Session-Dir + Preview, Datei-Kappe 64 MiB, Rest wird
  gegrept; Fehler: inline bis ~10.000, darüber Head+Tail OHNE Dateipfad. Exit 1 nur für
  Whitelist gültig (`grep`,`rg`,`find`,`diff`,`git diff`…). `BASH_MAX_OUTPUT_LENGTH` 30k,
  Decke 150k — vergrößert das Rücklese-Fenster, nicht die Inline-Decke. — /tools-reference — P
- **Claude Code — MCP + Bilder**: MCP-Warnung 10k Tokens, Kappe 25k (`MAX_MCP_OUTPUT_TOKENS`);
  Server kann eigene Schwelle via `_meta["anthropic/maxResultSizeChars"]` bis 500k heben —
  Bild-Tools bleiben token-gekappt. Bilder >500KB → JPEG-Reencode; PDFs >10 Seiten in Ranges. — P
- **Codex CLI — harte Trunkierung, kein Spill**: 256 Zeilen ODER 10 KiB (128 erste + 128
  letzte, `MODEL_FORMAT_MAX_LINES=256`); Util-Layer: `truncate_middle_with_token_budget()`,
  `APPROX_BYTES_PER_TOKEN=4`, exakter 50/50-Split, Marker `…{n} tokens truncated…`;
  `format_exec_output_for_model()` stellt Exit-Code, Wall-Time, „Total output lines: N" voran.
  Spill-to-file ist OFFENER Feature-Request (#14206). — P/S
- **Goose**: `GOOSE_MAX_TOOL_RESPONSE_SIZE` default 200.000 Zeichen → Temp-Datei;
  `GOOSE_TOOL_CALL_CUTOFF` = Anzahl jüngster Tool-Calls voll, ältere summarisiert. — P
- **OpenHands**: `max_message_chars` default 30.000 pro Event (Begründung PR #4788: ein
  `ls -R` auf Django ≈ 120k Tokens). — P
- **opencode/Cline**: opencode `TOOL_OUTPUT_MAX_CHARS=2_000` im Kompaktierungsmodul + der
  retroaktive Prune (P, Code); Cline `TOOL_RESULT_CHAR_LIMIT=2.000` (S).
- **Amp**: File-Reads 500 Zeilen / 2KB pro Zeile; Docs empfehlen Subagents explizit „for
  operations producing extensive output not needed after completion". — P
- **aider**: nichts Substantielles (kein genereller Tool-Loop) — valider Nullbefund.

## 3. Subagent-Orchestrierung

- **Claude Code**: Agents = Markdown+YAML; Präzedenz managed → CLI-JSON → `.claude/agents/` →
  `~/.claude/agents/` → Plugins. Frontmatter u. a. `tools`, `disallowedTools`, `model`
  (`inherit`), `permissionMode`, `maxTurns`, `hooks`, `memory`, `background:true`,
  `isolation:worktree`; `tools: Agent(worker,…)` beschränkt Spawn-Rechte. Non-Fork bekommt
  eigenen MD-Body + CLAUDE.md + git-Snapshot, KEINE Historie; Fork erbt volle Historie + den
  Prompt-Cache des Parents. Limits: 20 parallel, Spawn-Tiefe 3 (am Limit wird das Agent-Tool
  ENTZOGEN). Ergebnisse: nur Summary, auf instruction-shaped patterns GESCANNT bevor der
  Parent sie liest; `SendMessage` setzt fertigen Agent fort; Transkripte überleben
  Parent-Kompaktierung. — /sub-agents — P
- **Codex CLI**: `features.multi_agent` → `spawn_agent`, `send_input`, `resume_agent`,
  `wait_agent`, `close_agent`; `[agents]`: `default_subagent_model`,
  `max_concurrent_threads_per_session`, per-Rolle `agents.<name>.config_file` (eigene
  TOML-Schicht je Rolle). Ältere Form (S, Code gewinnt): Rollen-TOMLs in `~/.codex/agents/`,
  `spawn_agents_on_csv` (CSV-Fan-out), `job_max_runtime_seconds` 1800. — P/S
- **Goose**: `delegate`/`load` der `summon`-Extension; parallel nur auf Prompt-Keywords;
  default 25 Turns, 5-min-Timeout; nur im Autonomous-Mode; harte Kappe 10 parallel, kein
  Nesting; Subrecipes sind die wiederverwendbare Form mit eigenem Modell-Pin. — P/S
- **OpenHands**: `DelegateAction` `spawn`/`delegate` (blockiert bis alle fertig);
  Python-Threads; Kopie des Parent-LLM mit Reset-Metriken + eigenem Event-Log; Persistenz
  unter `subagents/`; Metriken aggregieren mit `delegate:<id>`-Präfix. — P/S
- **Amp**: Oracle (Zweitmeinungs-Tool namens `oracle`), Librarian (GitHub-Suche), Painter;
  Subagents frisch, können nicht miteinander reden, Parent bekommt nur Summary. Custom Agents
  als Plugin-Code: `amp.createAgent({…})`; `thread.appendUserMessage()`/`waitForResponse()`. — P
- **opencode**: Agents als Kind-SESSIONS (`mode: primary|subagent|all`, `steps`,
  Tool-`permission` inkl. `task`-Gate fürs Spawnen); navigierbar per Keybind. — P

## 4. Checkpointing & Session-Persistenz

- **Claude Code**: JSONL `~/.claude/projects/<munged-cwd>/<session>.jsonl` (Format explizit
  instabil). `--continue`, `--resume` (cross-project nur bei genau einem Kandidaten),
  `--fork-session`; `plan`/`bypassPermissions` werden NIE restauriert; gleiche Session in zwei
  Terminals ohne Fork = verzahntes Transkript. Checkpoints: jeder User-Prompt, Datei-Snapshots
  für 100 Checkpoints, `/rewind`; nur eigene File-Tool-Edits erfasst — Bash- und
  Subagent-Edits NICHT. — /sessions, /checkpointing — P
- **Codex CLI — Rollouts**: `~/.codex/sessions/Y/M/D/rollout-<ts>-<uuid>.jsonl`; `RolloutLine`
  mit Varianten (`SessionMeta`, `ResponseItem`, `EventMsg` inkl. TokenCount, `TurnContext`,
  `Compacted`, `InterAgentCommunication`); Resume replayt unter Erhalt der `ThreadId`
  (`Resumed` vs `Forked`); `codex resume --last`, `codex fork`; Resume keyt auf die
  `session_id` IM JSONL, nicht den Dateinamen. `[memories] max_rollout_age_days=30`. — S/P
- **Cline — Shadow-Git**: eigenes Git-Repo je Workspace unter
  `globalStorage/…/checkpoints/<wsId>/.git`; Commits `checkpoint-<wsId>-<taskId>`; Diffs via
  `git --git-dir` gegen das Shadow-Repo; Restore `taskAndWorkspace|workspace|task`.
  Task-State als drei JSONs. Fortsetzung = `new_task`-Tool (modell-entschiedener Handoff mit
  strukturiertem Kontextblock). — P/S
- **pi — Baum-Sessions**: `~/.pi/agent/sessions/--<cwd>--/<ts>_<uuid>.jsonl`; Header v3 mit
  `parentSession`; jeder Entry `id` (8-hex) + `parentId` → BAUM, In-Place-Branching ohne neue
  Dateien; Entry-Typen inkl. `compaction` mit `retainedTail` (selbst-enthaltener Checkpoint)
  und `branch_summary`; Kontext = Walk leaf→root. `-c`, `-r`, `--fork`, `--no-session`. —
  pi-mono session-format.md — P
- **OpenHands — Event-Sourcing**: ein JSON pro Event `sessions/<id>/events/<n>.json`
  (local/S3/GCS/memory); V1: `base_state.json` + append-only EventLog; Crash-Recovery <20 ms
  bei 358 Events (Paper). — P
- **Goose — SQLite**: `sessions.db` (Schema v13); Zeilen tragen `session_type`
  (User/SubAgent/Scheduled/…), `working_dir`, `total_tokens`, `accumulated_cost`. — S
- **Amp**: server-seitige Threads (`T-<uuid>`), in Prompts als `@T-<id>` referenzierbar. — P
- **SWE-agent**: `.traj` mit per-Step `response/thought/action/observation/state/query`;
  `sweagent run-replay` re-executiert. — P

## 5. Zustell-/Readiness-Nähte & programmatische Modi

- **Claude Code — Print-Mode-Vertrag**: `-p`: SIGTERM → Exit 143 nach SessionEnd-Hooks; stdin
  10 MB; `--output-format stream-json`: erstes Event `system/init` (Modell, Tools,
  `capabilities`), `system/api_retry`, final `result`; Subagent-Zeilen mit
  `parent_tool_use_id`. `--input-format stream-json` + `--replay-user-messages` (Echo als
  Bestätigung!). Trust-Dialog ist INTERAKTIV-ONLY — `-p` zeigt ihn nie, führt aber
  Projekt-Hooks/MCP still aus außer `--bare`; Pre-Trust von Hand:
  `projects["<path>"].hasTrustDialogAccepted:true` in `~/.claude.json`. — /headless — P
- **Codex — exec + app-server**: `codex exec --json` (Events `thread.started`,
  `turn.completed` mit Usage, `--output-last-message <path>`, `--output-schema`,
  `--ephemeral`); **`codex app-server`**: JSON-RPC 2.0 über stdio, `thread/start|resume|fork|
  list|read|archive`, `turn/start`, `turn/steer`, `turn/interrupt`; Notifications
  `item/agentMessage/delta`; TS-Export `codex app-server generate-ts`. — P
- **Codex TUI — Trust-Screen + Paste-Burst** (die tmux-Treiber-Fallen, jetzt primärbelegt):
  Trust-Prompt kann sogar mit `approval_policy=never` erscheinen — injizierter Input wird als
  ANTWORT konsumiert (#14547); Antwort schreibt `trust_level="trusted"` in
  `[projects."<path>"]`. `PasteBurst`-State-Machine: PTY-gechunkter Paste hält den Burst am
  Leben, trailing CR wird als Paste-Newline ABSORBIERT statt zu senden;
  `disable_paste_burst` (default false). — PR #9020, config-ref — P
- **pi — RPC-Modus mit echtem Done-Signal**: `--mode rpc`: strikte JSONL über stdin/stdout;
  `prompt` (mit `streamingBehavior: steer|followUp`), `abort`, `steer`, `bash`, `get_state`
  (`isStreaming`), `new_session`, `fork`; Events inkl. **`agent_settled`** („Pi will not
  continue automatically through retry, compaction retry, or queued follow-up") — ein
  dokumentiertes Idle-/Readiness-EVENT, dazu `compaction_start/end`, `queue_update`. —
  pi-mono rpc.md — P
- **opencode — die ganze Naht als HTTP**: `opencode serve` (127.0.0.1:4096, OpenAPI 3.1);
  `POST /session/:id/message` blockiert bis Antwort, `prompt_async`, `GET /event` SSE;
  **`POST /session/:id/permissions/:permissionID` {response, remember?}** — der
  Approval-Roundtrip ist ein REST-Endpoint; `/tui`-Endpoints steuern die TUI von außen. — P
- **Amp/Cline/Goose/aider/OpenHands headless**: Amp `-x` (auto bei redirected stdout),
  `--plugin-ready-timeout` 10 s als explizites Readiness-Gate. Cline CLI 2.0: headless bei
  `--json` ODER piped stdin ODER redirected stdout; `--auto-approve` DEFAULT TRUE; NDJSON
  `{"type":"ask"|"say"}`; läuft als ACP-Agent. Goose `goose run -i - --output-format
  stream-json`, `--max-turns` 1000. aider `--message`/`--yes`. OpenHands headless: immer
  always-approve. — P

## 6. Sandboxing & Permissions

- **Codex**: `sandbox_mode: read-only|workspace-write(default)|danger-full-access`; macOS
  Seatbelt, Linux **bubblewrap** mit userns-Fallback; `[sandbox_workspace_write]`:
  `writable_roots`, `network_access`, `exclude_tmpdir_env_var`, `exclude_slash_tmp`.
  `approval_policy: untrusted|on-request(default: sandboxed-Fehler → Approval →
  unsandboxed-Retry)|never`; granulare Objektform neu. `.git`-Schreibschutz in writable
  roots: nur sekundär + unser eigener Rollout-Beleg — auf aktuellen offiziellen Seiten ABWESEND
  (deckt sich mit unserer Messung vom 2026-08-08). — P (git-Schutz S)
- **Claude Code — Permission-Regeln**: `allow/ask/deny`; Auswertung **deny → ask → allow,
  first match, Spezifität irrelevant**; `Bash(git diff *)`-Präfixform; bare tool name als deny
  ENTFERNT das Tool aus dem Kontext; Parameter-Matches wie
  `Bash(dangerouslyDisableSandbox:true)`; nur `Read()`/`Edit()`-Pfadregeln werden konsultiert
  (Write/Glob-Regeln akzeptiert aber IGNORIERT, mit Warnung); Compound-Approval speichert bis
  5 Sub-Regeln. `dontAsk` auto-VERWEIGERT Unbekanntes; `bypassPermissions` überspringt sogar
  `.git`/`.claude`-Schutz. — /permissions — P
- **Claude Code — Bash-Sandbox + Credential-Masking**: Seatbelt/bubblewrap + socat-Proxy;
  default schreibbar = cwd + Session-Tempdir (sandboxed und unsandboxed sehen VERSCHIEDENE
  `$TMPDIR`!); Eskalation über Bash-Parameter `dangerouslyDisableSandbox`, abschaltbar mit
  `allowUnsandboxedCommands:false`. Tiefe: `sandbox.credentials` — Kommando sieht
  Session-SENTINEL, Proxy substituiert echtes Credential am Egress zu `injectHosts`, inkl.
  JWT-Claim-Masking und SigV4-RE-SIGNING am Proxy. — /sandboxing — P
- **OpenHands**: der Docker-Container IST die Grenze (REST-Action-Server im Container);
  headless kann nicht approval-gated werden. — P
- **Goose**: `GooseMode: auto|approve|smart_approve|chat`; smart_approve = LLM-Klassifikator
  (`PermissionJudge`) entscheidet Read-only-ness; per-Tool `AlwaysAllow|AskBefore|NeverAllow`. — S
- **Cline**: das MODELL setzt selbst `requires_approval` pro Kommando; CLI `--auto-approve`
  default true; `CLINE_COMMAND_PERMISSIONS`-Env mit allow/deny-Globs. — P
- **aider/pi/Amp — kein Sandbox by design**: aider: Confirmations + git als Netz. pi: „No
  permission popups", Docs empfehlen externe Container/Zäune (unser sandbox-exec-Weg war also
  die vom Autor intendierte Form); `/trust` gated was GELADEN wird, nicht Laufzeit. Amp: keine
  Approvals default; `amp.permissions`/`amp.guardedFiles.allowlist`. — P

## 7. Verify-Hooks / Gates im Loop

- **Claude Code**: ~30 Events, u. a. `PostToolBatch` (exit 2 stoppt vor dem nächsten
  Modell-Call), `PermissionRequest/Denied`, `StopFailure` (Matcher `rate_limit|overloaded`),
  `FileChanged`, `WorktreeCreate/Remove`. Vertrag: stdin-JSON; **exit 2 blockt IMMER und
  schlägt jedes JSON — sogar `permissionDecision:"allow"`**; Stop/SubagentStop exit 2
  VERHINDERT das Aufhören, stderr wird zur Anweisung; JSON-Felder `decision/reason`,
  `hookSpecificOutput.{permissionDecision, additionalContext, updatedInput}`. Timeout 600 s;
  Hook-Typen `http`, `prompt`, `agent`; `if`-Bedingungen in Permission-Regel-Syntax. — /hooks — P
- **Codex — Hooks (neu, bewusst Claude-kompatibel)**: gleiches Event-Vokabular in
  `~/.codex/hooks.json` / TOML / `.codex/hooks.json`; gleiche exit-0/2-Semantik und
  `hookSpecificOutput`-Form; Flag `[features] hooks=true`. Nischen: Trust-by-content-hash
  (editierter Hook braucht Re-Trust via `/hooks`); Hook-Output-SPILL (default ~2.500 Tokens,
  Überlauf in `<temp>/hook_outputs/<session>/<uuid>.txt` mit Head/Tail-Preview); async Hooks
  (max 8, können nicht blocken); setzt `CLAUDE_PLUGIN_ROOT` AUS KOMPATIBILITÄT. Legacy
  `notify` übergibt JSON als argv, nicht stdin. — learn.chatgpt.com/docs/hooks — P
- **OpenHands — Stop-Hook als Qualitäts-Gate**: `.openhands/hooks.json`, sechs Events; `stop`
  BLOCKT Task-Completion (das dokumentierte „Tests müssen grün sein bevor fertig"-Muster);
  „Compatible with Claude Code hooks format"; `.openhands/setup.sh` bei jedem Repo-Start. — P
- **aider**: auto-lintet jede editierte Datei; `--lint-cmd`, `--test-cmd` + `--auto-test`;
  non-zero → Output in den Chat, Fix-Versuch; Warnung: Formatter, die nach dem Fixen non-zero
  exiten, brauchen Run-Twice-Wrapper. — P
- **Goose — Recipe-`retry`**: `{max_retries, checks:[{type:"shell",command}], on_failure,
  timeout_seconds:300}` — Shell-Checks NACH dem Agenten; ganzes Recipe re-runt bis Checks
  grün; plus `response.json_schema`-Validierung mit Retry. — P (Mirror)
- **Cline — Hooks v3.36**: Scripts in `.clinerules/hooks/`, Dateiname = Hook-Name OHNE
  Endung; Antwort `{"cancel",errorMessage,contextModification}` — `contextModification` formt
  den NÄCHSTEN Request, nicht den aktuellen; PreToolUse kann canceln, nicht umschreiben. — P
- **opencode/Amp — Hooks als In-Process-Plugins**: opencode: `"tool.execute.before"` —
  `output.args` MUTIEREN schreibt den Call um, `throw` blockt; Events inkl. `session.idle`,
  `lsp.client.diagnostics`. Amp: `tool.call` → `allow | reject-and-continue | modify |
  synthesize` (Tool-Ergebnis FABRIZIEREN ohne Ausführung) `| error`; **`agent.end` →
  `{action:'continue', userMessage}` startet einen neuen Turn** — das dokumentierte
  „weitermachen bis Tests grün"-Muster; `AMP_TOOLBOX`: jedes Executable im Dir wird mit
  `TOOLBOX_ACTION=describe/execute` zum Tool ohne Manifest/MCP. — P

## 8. Echt neu / passt in keine Box

- **Cross-Vendor-Konvergenz auf den Hook-/Skill-Vertrag**: Codex-Hooks nutzen Claude Codes
  JSON-Vertrag UND Env-Namen; OpenHands deklariert Kompatibilität; Skills folgen dem
  Agent-Skills-Standard (agentskills.io), OpenHands migrierte Microagents auf dieselbe
  `SKILL.md`-Spec. EIN Gate-Artefakt kann zunehmend mehrere Harnesses treffen. — P
- **Claude-Code-Skills — Progressive Disclosure**: Start lädt nur Descriptions, 1.536
  Zeichen/Eintrag; `allowed-tools` im Skill ist TURN-SCOPED Permission (cleared bei nächster
  User-Message), nicht trust-gated; `context: fork` führt Skill als Subagent aus. — P
- **Claude-Code-Memory-Mechanik**: CLAUDE.md kommt als USER-Message nach dem System-Prompt;
  `@path`-Imports max 4 Hops, in Code-Fences übersprungen; `.claude/rules/*.md` mit `paths:`
  laden nur bei passenden Datei-Reads; Auto-Memory erste 200 Zeilen / 25 KB. — P
- **Codex AGENTS.md-Discovery**: `~/.codex/AGENTS.override.md` → `~/.codex/AGENTS.md`, dann
  git-root→cwd je Verzeichnis (override → AGENTS.md → Fallback-Namen), root-abwärts
  konkateniert (näher = später = gewinnt); Kappe `project_doc_max_bytes` 32 KiB — HÖRT STILL
  AUF Dateien anzuhängen; kein Scan unterhalb cwd. — P
- **Cline Focus Chain**: per-Task-Markdown-Checkliste, vom Modell via `task_progress`-Parameter
  auf Tool-Calls geschrieben, alle 6 Messages RE-INJIZIERT, gleichzeitig menschlich editierbar,
  überlebt Auto-Kompaktierung — eine Dual-Writer-Anti-Drift-Plandatei mit festem Takt. — P
- **Amp Oracle**: Zweitmeinungs-Reasoning-Modell als Tool namens `oracle`. — P
- **Codex-Recovery-Flächen**: `codex fork`; Doppel-Esc mit leerem Composer → Transcript-Edit
  zum Forken ab früherem Punkt; `codex archive`. — S
- **SWE-agents Negativ-Ergebnisse als Design-Daten**: mehr Kontext ist messbar SCHLECHTER
  (volle Observation-Historie → 15,0% Solve-Rate) — seltene publizierte Evidenz für
  aggressives Observation-Windowing. — P

## Unverified / Sackgassen

- Codex per-Modell-Kompaktierungs-Defaults (180k/244k) und die 258.400-Zahl: nur sekundär.
  (Unsere eigene 258.400-Messung aus `models_cache.json` + Rollout bleibt davon unberührt —
  sie ist unser Primärbeleg, CLAUDE.md GPT-Absatz.)
- Codex `.git`-Schutz in writable roots: sekundär + unser Rollout-Beleg; offizielle Seiten
  schweigen.
- `codex proto`: nirgends mehr dokumentiert — app-server ist der Nachfolger.
- Claude Codes Kompaktierungs-Prompt (closed source), Amps „90%-Trigger", aiders
  PageRank-Zuschreibung, ob Goose-Hooks blocken können: unverified.
- Goose-Original-Docs (block.github.io) durchgängig 404 — Goose-Befunde stehen auf Mirrors +
  DeepWiki.

## Die fünf Diebstähle (Original-Ranking des Research-Agents)

1. pi `agent_settled` + `--mode rpc` — ersetzt jede Idle-Heuristik durch ein Harness-Event.
2. Codex `app-server` / opencode `serve` — Engine statt TUI treiben; eliminiert
   Boot-Screen/Trust/Paste-Burst-Klasse; Approval-Roundtrip programmierbar.
3. Konvergierter Stop-Hook-Gate (exit 2 = darf nicht fertig sein) — Verify in der Lane,
   ein Artefakt für drei Harnesses.
4. Spill-to-file-Disziplin als Orchestrator-Konvention — größter Hebel für GPT-Fenster.
5. Amp `agent.end→continue` / Goose `retry` — harness-eigene Check-rot-weiter-Schleife.

Ehrenwert: Amp `/handoff` (Extraktion statt Summary-Stapel) für die Succession; opencodes
Prune-Konstanten als kopierbarster Kompaktierungs-Vorpass.

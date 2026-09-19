---
frage: Welches ist je Composer-Funktion die einfachste belegte Anbindung von codex und pi an den Chat-Composer der Fleet?
urteil: Beide bleiben im tmux-Pane und brauchen keinen neuen Kanal. pi schaltet Modell und Effort per `/model <provider/id>` und `/thinking <level>` ohne Auswahldialog um; codex nur per Datensatz plus Resume-Neustart. Der Cache-Zaehler liest den neuesten Nutzungsdatensatz der Rollout- bzw. Session-Datei. Gemessen haelt der Cache bei z.ai rund 15 min und bei codex ueber 1 h. Fuer die Chat-Ansicht fehlen zwei Parser. pi-zai verliert Bilder, weil der Fleet-Katalog kein `input` setzt.
bereich: [harness, chat, composer]
belege: [server.ts#CODEX_HARNESS, server.ts#PI_HARNESS, server.ts#PI_ZAI_HARNESS, server.ts#transcriptFile, server.ts#readPiUsedTokens, server.ts#codexContextFile, server.ts#dropMention, docs/harness-adapter.md]
nicht-gemessen: kein Live-Test mit Modellaufruf (verboten). `codex queue`, `/model <arg>` in codex und die Bildwirkung sind nur aus Quellen gelesen. Die Doku-TTL der Anbieter ist nicht gelesen, ein Netzabruf fand nicht statt.
stand: 2026-09-19
---

# Einfachste Anbindung von codex und pi an den Chat-Composer

2026-09-19, Lane `fleet/260919132509-2c59`. Frage: **Wie bindet man codex und pi mit dem kleinsten
Mechanismus je Composer-Funktion an, belegt aus installierter Doku, `--help`, Paketquellen und
vorhandenen Session-Dateien, ohne Modellaufruf?**

Installierte Versionen: `codex --version` → `codex-cli 0.153.4`; `pi --version` → `0.85.0`
(Paket `@earendil-works/pi-coding-agent`, `~/.local/lib/node_modules/…`). Abkürzungen der Pfade
unten: `PI` = `~/.local/lib/node_modules/@earendil-works/pi-coding-agent`, `PIAI` =
`PI/node_modules/@earendil-works/pi-ai/dist`, `CXBIN` = das native codex-Binary
`~/.local/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/bin/codex`
(Rust, keine Doku im Paket. Belege daraus sind String-Tabellen, zitiert mit Byte-Offset). pi läuft
aus `PI/dist/bundle/cli.js`. Die Zeilenangaben zeigen auf die unbundelten `PI/dist/…`-Dateien
desselben Pakets.

Anlass: Der Nachtrag der Chat-Lane db81f382 zu Schnitt 15 sagt: codex ungetestet, pi ohne
Modellknopf, und der Cache-Zähler braucht je Harness einen Referenzpunkt. Report `4e9b6d53` (Schnitt 14)
misst den Zähler an claude: `cacheAge()` = Server-Uhr minus Transkript-Zeitstempel.

## Ergebnis

### Tabelle Funktion × Harness

„Genutzt“ = rg-Treffer in `server.ts` / `src/client.ts` / `server/*.ts` auf dem Baum dieser Lane
(Fork von `1116d10b`).

| # | Funktion | Harness | Mechanismus | Beleg | heute im Fleet genutzt? | Aufwand |
|---|---|---|---|---|---|---|
| 1 | Prompt senden | codex | Wie heute: Paste plus Enter in den tmux-Pane. Kandidat für später: `codex queue --thread <uuid> --message <text>` schreibt in `~/.codex/queue_1.sqlite` (Tabelle `queued_items`). Ob eine laufende TUI den Eintrag abholt, ist UNGEPRUEFT. Der Test braucht einen Modellaufruf. | `codex queue --help`: „Queue a message for an existing session … --thread <THREAD> Session UUID or exact session name … --message <TEXT>“. Fehlertext in CXBIN @165030302: „No active session found matching '..'“ | ja: `server.ts#sendText` (paste, `send-keys … Enter`), Composer `{kind:"glyph", re:/^›/}` in `server.ts#CODEX_HARNESS` | klein (nichts zu tun) |
| 1 | Prompt senden | pi | Paste plus Enter. Enter während eines laufenden Turns ist eine Steering-Nachricht, Alt+Enter ein Follow-up. | `PI/docs/usage.md:63-70` („**Enter** queues a steering message … **Alt+Enter** queues a follow-up message“) | ja: `server.ts#sendText`, `PI_COMPOSER` (rules) | klein (nichts zu tun) |
| 2 | Anhänge/Bilder | codex | Die bestehende Upload-Route legt die Datei in `drops/` ab und schreibt `attached: <pfad> — read it` in den Composer. codex hat ein `view_image`-Tool, das einen Pfad liest. `-i/--image` gilt nur für den Startprompt bzw. `codex queue`. | CXBIN @165161526: `core/src/tools/handlers/view_image.rs … image path \`..\` is not a file`. `codex --help`: „-i, --image <FILE>... Optional image(s) to attach to the initial prompt“ | ja, harness-frei: `server.ts#dropMention`, POST `/api/slots/:id/upload`, `src/client.ts#uploadDrops`. Ob das Modell daraufhin `view_image` aufruft, ist UNGEPRUEFT. | klein |
| 2 | Anhänge/Bilder | pi | Derselbe Upload mit Pfad-Nennung. Das `read`-Tool von pi schickt Bilder als Anhang, aber nur, wenn das Modell `input` mit `image` deklariert. Sonst gibt es den Text „Current model does not support images. The image will be omitted“. **pi-zai verliert Bilder:** Der Fleet-Katalog setzt kein `input`, der Default ist `["text"]`, und eigene Einträge ersetzen den eingebauten mit gleicher Id per Upsert. pis eigener Katalog führt glm-5.3-flash mit `["text","image"]`, glm-5.3 nur mit `["text"]`. | `PI/dist/core/tools/read.js:26-29, 37`. `PI/docs/models.md:206` (`input` default `["text"]`), `:335` („Custom models are upserted by `id`“). `PI/dist/core/provider-composer.js:48-70` (`modelFromJson` baut den Eintrag neu, `input: definition.input ?? ["text"]`, der eingebaute Eintrag wird nicht gelesen). `PIAI/providers/data/zai.json` (glm-5.3-flash `"input":["text","image"]`) | teilweise: Der Upload wird genutzt. `server.ts#PI_ZAI_HARNESS` schreibt den Katalog ohne `input`. | klein (`"input":["text","image"]` am Flash-Eintrag, danach eine Live-Probe) |
| 3 | Modell wechseln | codex | Datensatz setzen und Resume-Neustart. POST `/api/slots/:id/model` ändert nur den Datensatz. Neustart bzw. Heal spawnen `codex resume '<id>' … --model '<m>'`, das Gespräch bleibt erhalten. Im laufenden Betrieb gibt es `/model` („choose what model and reasoning effort to use“). Es öffnet ein Popup („Choose a specific model and reasoning level“). Ob `/model <arg>` ein Argument annimmt, ist UNGEPRUEFT. | CXBIN @170010012 (Slash-Tabelle), @165427524 (`tui/src/chatwidget/model_popups.rs`). `codex resume --help`: „[SESSION_ID] … -m, --model <MODEL>“ | teilweise: Die Route `slotMatch[2] === "model"` in `server.ts` setzt `s.model`, und `server.ts#CODEX_HARNESS` spawnCmd hängt `--model` auch an die Resume-Zeile. Ein Knopf, der danach neu startet, fehlt. | klein (Route plus ↻ restart), Popup-Steuerung per Tasten: gross |
| 3 | Modell wechseln | pi | `/model <provider/id>` in den Composer tippen. Bei exaktem Treffer ruft pi `setModel(model,{persist:false})` ohne Dialog auf und schreibt einen `model_change`-Eintrag in die Session-Datei. Ohne Treffer öffnet sich der Dialog mit Suchbegriff. Das beantwortet „pi ohne Modellknopf“. | `PI/dist/modes/interactive/interactive-mode.js:2377-2381, 4034-4053`. `PI/dist/core/agent-session.js:1254-1261` (`appendModelChange`). `PI/dist/core/slash-commands.js:4` (`argumentHint: "<provider/model>"`) | nein (`rg '/model ' src/client.ts` bzw. `server.ts`: kein Sendepfad) | klein: `sendText("/model zai/glm-5.3-flash")` plus Datensatz. Live-Wirkung UNGEPRUEFT |
| 4 | Effort wechseln | codex | Wie beim Modell: Datensatz plus Resume-Neustart mit `-c model_reasoning_effort='<l>'`. Live nur über das `/model`-Popup, das Modell und Reasoning zusammen wählt. Stufen je Modell stehen im Katalog. | `~/.codex/models_cache.json`, `supported_reasoning_levels` (gpt-5.6-sol: low…ultra, gpt-5.5: low…xhigh). CXBIN @165427524 „Select Reasoning Level“ | teilweise (dieselbe Route, `effortLevels` in `server.ts#CODEX_HARNESS`) | klein |
| 4 | Effort wechseln | pi | `/thinking <level>` ohne Dialog, schreibt `thinking_level_change`. Nur Stufen, die `getAvailableThinkingLevels()` liefert, sonst kommt der Fehler „Unknown thinking level“. Bei glm-5.3 und glm-5.3-flash sind laut Katalog nur low/high/max gemappt, die übrigen sind `null`. | `interactive-mode.js:2383-2387, 3996-4008`. `agent-session.js:1371`. `PIAI/providers/data/zai.json` `thinkingLevelMap` | nein | klein. `server.ts#PI_ZAI_HARNESS` begrenzt `effortLevels` bereits auf `["low","high","max"]`, also dieselbe Menge. |
| 5 | Kontextfenster und Füllstand | codex | Rollout-Datensatz `event_msg/token_count`: `info.last_token_usage.total_tokens` und `info.model_context_window` auf derselben Zeile (258 400 = 272 000 × 95 %). Katalog: `context_window` 272 000, `max_context_window` 872 000, `effective_context_window_percent` 95. Live-Anzeige: `/status` („show current session configuration and token usage“). | `~/.codex/models_cache.json` (gelesen, `client_version` 0.153.4). Rollout-Zeile ordinal 18 in `~/.codex/sessions/2026/09/19/rollout-…01a0b9d1….jsonl`. CXBIN @170010012 | ja: `server.ts#codexContextFile` plus `readCodexContext` (`windowFromFile`) | klein (vorhanden) |
| 5 | Kontextfenster und Füllstand | pi | Zähler: neueste Assistant-Zeile `message.usage` (input + cacheRead + cacheWrite). Nenner: Katalog (`contextWindow` 1 000 000 für beide GLM, sowohl in `zai.json` als auch im Fleet-Katalog). Der pi-Footer zeigt den Wert (`0.0%/1.0M`). RPC `get_session_stats.contextUsage` gibt es nur in `--mode rpc`, nicht in der TUI. | `PI/docs/usage.md:14` (Footer). `PI/docs/rpc.md:554-595`. `server.ts#PI_ZAI_HARNESS` (Katalog 1 000 000) | teilweise: `server.ts#readPiUsedTokens` liefert den Zähler. `src/protocol.ts#contextWindowFor` kennt glm-5.3 und seit `538c3c8d` auch glm-5.3-flash (1 000 000; Nachtrag der MAIN nach dem Land, die Lane las einen älteren Stand). | erledigt |
| 6 | Zeitstempel der letzten Modellanfrage | codex | Neueste `token_usage_record`-Zeile (Top-Level-`timestamp`, dazu `response_id`, `usage`). Eine je Modellantwort. `token_count` trägt dieselbe Zeit ± ms. | Rollout `01a0b9d1…`: 38 `token_usage_record`, 37 `token_count` bei 304 Zeilen. Beispiel ordinal 15 `2026-09-19T13:19:06.661Z` mit `response_id resp_…` | nein für den Zähler. `server.ts#codexRolloutFacts` liest Zeitstempel nur am Terminal-Event (`sessionMs`). | klein (derselbe Tail-Read wie `readCodexContext`) |
| 6 | Zeitstempel der letzten Modellanfrage | pi | Neueste Zeile `type:"message"` mit `message.role:"assistant"`. Das Entry-`timestamp` (ISO) entsteht beim Anhängen nach der Antwort. `message.timestamp` (Unix-ms) wird beim Start des Requests gesetzt. **Falle:** Vor der ersten Assistant-Antwort schreibt pi die Session-Datei gar nicht. | `PI/docs/session-format.md:78, 174-186`. `PIAI/api/openai-completions.js:186` (`timestamp: Date.now()` im Stream-Start). `PI/dist/core/session-manager.js:739-753` (`if (!hasAssistant) … not flushed`) | nein (Datei über `piZaiContextFile`/`piContextFile` gefunden, Zeit nicht gelesen) | klein |
| 7 | Cache-TTL des Anbieters | codex | Lokal nicht dokumentiert: Das Paket enthält keine Doku. Der im Binary gebündelte Migrationstext beschreibt die OpenAI-**API** (`prompt_cache_options.ttl "30m"`), nicht das ChatGPT-Backend der CLI. UNGEPRUEFT. **Gemessen** über die Rollouts, Tabelle unten: Bei 15–60 min Pause haben noch 84 % der Folgeanfragen ≥ 50 % Cache-Anteil, ab 2 h Pause 20 %. | CXBIN @169609367 (Abschnitt „Prompt caching“). Messskript §Methode | nein | klein (Konstante), UNGEPRUEFT gegen Anbieterdoku |
| 7 | Cache-TTL des Anbieters | pi (z.ai) | pi schickt z.ai **keinen** Cache-Parameter. `prompt_cache_key` und `prompt_cache_retention:"24h"` gehen nur an api.openai.com bzw. an Modelle mit `supportsLongCacheRetention`, `cache_control` nur mit `cacheControlFormat:"anthropic"`, und die zai-`compat` hat keins davon. `PI_CACHE_RETENTION=long` wirkt hier also nicht. Die TTL ist das implizite Verhalten von z.ai, in der Doku UNGEPRUEFT. **Gemessen:** ≤ 10 min Pause 76–97 % Treffer, 15–30 min 60 %, 30–60 min 20 %, ab 1 h 0 %. | `PIAI/api/openai-completions.js:581-592, 807-812`. `PI/docs/environment-variables.md:89`. `zai.json` `compat` | nein | klein (Konstante ~15 min), UNGEPRUEFT gegen Anbieterdoku |
| 8 | Konversation strukturiert lesen | codex | Rollout-JSONL. `response_item` mit `payload.type:"message"` und `role` user/assistant/developer, Inhalt `input_text`/`output_text`, Assistant mit `phase` (z. B. `commentary`). Parallel `event_msg/item_completed` mit `item.type` `UserMessage`/`AgentMessage`. Tool-Aufrufe als `custom_tool_call`/`…_output`. Pfad: `codexContextFile`. `/rollout` zeigt den Pfad live. | Rollout `01a0b9d1…`: Typzählung 92 `item_completed`, 10 `message`, 38 `custom_tool_call`, 37 `custom_tool_call_output`, 48 `reasoning`. CXBIN @170010012 („print the rollout file path“) | nein: `supports.transcript:false` in `server.ts#CODEX_HARNESS`. `server.ts#transcriptFile` gibt `null` zurück. | mittel (eigener `viewEntry`-Zweig, Datei ist gefunden) |
| 8 | Konversation strukturiert lesen | pi | Session-JSONL `type:"message"` mit `message.role` user/assistant/toolResult, dazu `model_change`, `thinking_level_change`, `compaction`, `branch_summary`. Die Datei ist ein **Baum** (`id`/`parentId`), die Ansicht muss den Pfad vom Blatt zur Wurzel lesen. | `PI/docs/session-format.md:203-255, 306` („Tree Structure“) | nein: `supports.transcript:false` in `server.ts#PI_HARNESS` bzw. `PI_ZAI_HARNESS` | mittel (Parser plus Blattpfad) |

### Cache-Treffer nach Pause (Referenzpunkt für den Zähler)

Definition: Für jede Modellantwort mit Vorgänger in derselben Datei ist die Pause der Abstand der
Zeitstempel zweier aufeinanderfolgender Nutzungsdatensätze. Treffer bedeutet, dass der Cache-Anteil
der Antwort ≥ 50 % ist. codex: `cached_input_tokens / input_tokens` aus `token_usage_record`. pi:
`cacheRead / (input + cacheRead + cacheWrite)` aus der Assistant-`usage`. Die Pause enthält die
Generierungszeit der Folgeantwort, sie ist also eine obere Schranke der echten Leerlaufzeit.

| Pause | codex n | codex Treffer | z.ai n | z.ai Treffer | openai-codex über pi n | Treffer |
|---|---|---|---|---|---|---|
| 0–1 min | 9 600 | 0,99 | 4 839 | 0,98 | 2 162 | 0,95 |
| 1–5 min | 564 | 0,99 | 388 | 0,97 | 167 | 0,98 |
| 5–10 min | 79 | 0,97 | 34 | 0,91 | 13 | 0,92 |
| 10–15 min | 48 | 0,83 | 29 | 0,76 | 21 | 0,86 |
| 15–30 min | 64 | 0,84 | 20 | 0,60 | 15 | 0,87 |
| 30–60 min | 46 | 0,85 | 30 | 0,20 | 6 | 0,50 |
| 1–2 h | 37 | 0,73 | 7 | 0,00 | 2 | 0,00 |
| > 2 h | 60 | 0,20 | 11 | 0,00 | 2 | 0,00 |

Korpus: codex 320 Rollouts (September 2026, `~/.codex/sessions/2026/09`), 10 498 Paare. pi 209
Session-Dateien aus `~/.config/claude-fleet/pi-zai-agent/sessions`, `~/.pi/agent/sessions` und
`~/.config/claude-fleet/pi-ox-agent`. Modelle nach Zahl der Antworten: zai/glm-5.3 3 895,
openai-codex/gpt-5.6-sol 2 484, zai/glm-5.3-flash 1 642, opencode 785, claude-bridge 427.
Abgeleitet, nicht gemessen: Für z.ai sind ~15 min eine vertretbare Zähler-Schwelle. Für codex liegt
die Kante zwischen 1 und 2 h, dort ist n jeweils < 65.

### Schlusszeilen

- **codex, einfachste Anbindung:** Pane und Paste bleiben. Modell und Effort per Datensatz plus
  `codex resume`-Neustart (beides vorhanden, es fehlt nur der Auslöser). Kontext wie heute aus
  `token_count`. Cache-Zähler: Zeitstempel der neuesten `token_usage_record`-Zeile im schon
  gefundenen Rollout. Chat-Ansicht: ein Parser für `response_item/message`. Bilder über die
  Upload-Nennung.
- **pi, einfachste Anbindung:** Pane und Paste bleiben. Modell per `/model zai/<id>` und Effort per
  `/thinking <low|high|max>` als getippte Composer-Zeile, dazu der Datensatz. Kontext wie heute
  (die Katalogzeile für glm-5.3-flash liegt seit `538c3c8d` auf main). Cache-Zähler: Zeitstempel der neuesten
  Assistant-Zeile (vor der ersten Antwort existiert die Datei nicht). Chat-Ansicht: ein
  Session-Baum-Parser. Bilder erst, wenn der pi-zai-Katalog `input:["text","image"]` für flash trägt.

## Methode

```sh
codex --version; pi --version
codex --help; codex queue --help; codex resume --help; codex app-server --help; codex debug --help
codex features list
pi --help
# Slash-Befehle / Popups aus dem Binary (bgrep.py = Regex über die Bytes, ±N Zeichen Kontext):
python3 bgrep.py "$CXBIN" 'model and reasoning' 300 5
python3 bgrep.py "$CXBIN" 'Queue a message for an existing session|queued message' 200 8
python3 bgrep.py "$CXBIN" '\[Image #|paste image|view_image|prompt_cache' 160 4
sqlite3 -readonly ~/.codex/queue_1.sqlite '.schema'          # Schema nur, keine Zeilen gelesen
python3 -c 'import json;…' ~/.codex/models_cache.json          # context_window, reasoning levels
# pi: PI/docs/{usage,keybindings,rpc,session-format,models,environment-variables}.md,
#     PI/dist/modes/interactive/interactive-mode.js, core/agent-session.js, core/session-manager.js,
#     core/tools/read.js, PIAI/api/openai-completions.js, PIAI/providers/data/zai.json
```

Das Cache-Skript (codex, sinngemäss): Es geht durch jede `~/.codex/sessions/2026/09/*/rollout-*.jsonl`, nimmt
die Zeilen `type=="token_usage_record"`, bildet je Datei Paare aufeinanderfolgender Zeilen,
`gap = ts[i]-ts[i-1]` und `ratio = usage.cached_input_tokens/usage.input_tokens`, und zählt je
Pausen-Klasse n, den Anteil `ratio>=0.5` und den Anteil `ratio==0`. Das pi-Skript geht genauso vor, über
`**/*.jsonl` der drei Session-Wurzeln, Zeilen `type=="message"` und `message.role=="assistant"`,
`ratio = cacheRead/(input+cacheRead+cacheWrite)`, gruppiert nach `message.provider`.

Kein Befehl oben ruft ein Modell auf. `codex queue`, `/model`, `/thinking` und `pi --mode rpc`
wurden nicht ausgeführt.

## Was nicht gemessen wurde

- Keine Live-Probe: Ob `codex queue` eine in tmux laufende TUI erreicht, ob `/model <arg>` in codex
  ein Argument annimmt, ob `/model zai/glm-5.3-flash` in pi-zai ohne Dialog greift, und ob codex
  und pi auf die Upload-Nennung hin das Bild wirklich laden, ist alles UNGEPRUEFT. Jede dieser
  Proben braucht einen Modellaufruf (codex-Kontingent 93 %, Brief) oder einen laufenden Slot
  (Lane db81f382 testet dieselben Harnesses).
- Die Cache-TTL-Doku der Anbieter (OpenAI für das ChatGPT-Backend, z.ai) ist nicht gelesen, ein
  Netzabruf fand nicht statt. Die Tabelle oben ist Verhalten aus dem Bestand, keine Zusage. Die
  langen Pausen-Klassen haben n < 65.
- Der Bildbefund für pi-zai ist aus dem Code abgeleitet (`provider-composer.js:48-70` plus `read.js:26-29`),
  nicht an einer laufenden Pane beobachtet.
- Experimentelle Wege sind nur benannt, nicht bewertet: `pi server`/`pi client` (Unix-Socket,
  `PI/dist/main.js:461-533`, hinter `areExperimentalFeaturesEnabled`), `pi --mode rpc` (ersetzt die
  TUI), `codex app-server`/`remote-control`/`--remote`. Alle drei tauschen den Pane gegen einen
  Protokoll-Client, das ist Aufwand „gross“.
- Einen Schnitt-15-Nachtrag der Chat-Lane als eigene Report-Zeile gibt es in `fleet.json` nicht
  (Suche nach „Schnitt 15“/„cut 15“: 0 Treffer). Grundlage waren die Brief-Zusammenfassung und die
  Reports `4e9b6d53` + `f3084646` (Schnitt 14).

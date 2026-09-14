---
frage: Nimmt Claude Code 2.1.270 einen Channels-Push ohne Composer-Paste in einer offenen Session an, und quittiert es ihn?
urteil: Gate offen nur ueber --dangerously-load-development-channels (unter --channels verwirft die Allowlist einen eigenen Server still); der Push kommt 12–54 ms spaeter als User-Turn mit leerem Composer an; eine Harness-Quittung zum Server gibt es nicht, nur einen vom Modell gerufenen Reply-Tool-Call
bereich: [claude-code, channels, zustellung]
belege: [https://code.claude.com/docs/en/channels, https://code.claude.com/docs/en/channels-reference, /Users/owner/.local/share/claude/versions/2.1.270]
nicht-gemessen: allowlisted Plugin unter --channels, Permission-Relay, Push waehrend laufendem Turn, anderes Modell als Haiku 4.5, -p-Modus, Fleet-Server-Anbindung
stand: 2026-09-14
---

# Nimmt Claude Code 2.1.270 einen Channels-Push ohne Composer-Paste an, und quittiert es ihn?

2026-09-14 (Dateiname nach Brief), Lane `fleet/260914171426-69ff`. Frage: **Kommt eine von einem
Stub-MCP-Server gesendete `notifications/claude/channel` in einer offenen interaktiven Session als
Turn an, ohne Composer-Paste, und geht eine Quittung zurueck?**

Aufbau: `claude` 2.1.270 (Pane-Banner `Claude Code v2.1.270`, Account `Claude Max`, Modell
`claude-haiku-4-5-20251001`, das Modell ist hier nicht der Messgegenstand), in einem eigenen
`tmux -L fleetprobe8090` mit `env -i` (kein `FLEET_*`, kein `CLAUDE_CODE_*` geerbt). Stub: Bun +
`@modelcontextprotocol/sdk` 1.30.0, STDIO, `capabilities.experimental['claude/channel']`, ein Tool
`ack`, HTTP-Trigger auf `127.0.0.1:18788`, jede empfangene JSON-RPC-Nachricht roh geloggt (Lauf C).
Kein Fleet-Server, kein Fleet-Slot, Socket `claudefleet` nicht beruehrt. Laufzeit 17:14–17:24 UTC.

## Ergebnis

| Frage | Verdikt |
|---|---|
| (1) Gate offen, Channel angenommen? | **JA** ueber `--dangerously-load-development-channels server:chprobe`; **NEIN** ueber `--channels server:chprobe` (Allowlist) |
| (2) Push als Turn ohne Composer-Paste? | **JA**, User-Turn (nicht Tool-Result), 12–54 ms Push→Transcript |
| (3) Quittung zurueck zum Stub? | **NEIN** als Harness-Quittung; JA nur als Reply-Tool-Call, den das Modell ausloest |

### (1) Gate

**Lauf A**: `claude --model claude-haiku-4-5-20251001 --mcp-config <scratch>/mcp.json --strict-mcp-config --allowedTools mcp__chprobe__ack --channels server:chprobe`

```
▎ Channels (experimental) messages from server:chprobe inject directly in this session · restart without --channels to stop
▎ server:chprobe · no MCP server configured with that name
▎ server:chprobe · server: entries need --dangerously-load-development-channels
 ctx [----------] --% | Haiku 4.5   server chprobe is not on the approved channels allowlist (use --dangerously-load-development-channels for local dev)
```

Der MCP-Server selbst verbindet sich (Stub-Log `initialized` mit `"version":"2.1.270"`, `list_tools`).
Push `curl -X POST 127.0.0.1:18788 -d "probe run A push"` → Stub-Log
`"ev":"pushed","data":{"msg_id":"m1",…,"writeMs":1}`; im Pane nach 10 s keine Zeile, im
Projektverzeichnis kein Transcript. Die Harness verwirft still, wie die Doku sagt („drops the events
silently and returns no error to your server").

**Lauf B**: gleicher Aufruf mit `--dangerously-load-development-channels server:chprobe` statt
`--channels`. Vollbild-Dialog:

```
  WARNING: Loading development channels
  --dangerously-load-development-channels is for local channel development only. …
  Channels: server:chprobe
  ❯ 1. I am using this for local development
    2. Exit
```

Nach Enter:

```
▎ Channels (experimental) messages from server:chprobe inject directly in this session · restart without --dangerously-load-development-channels to stop
▎ server:chprobe · no MCP server configured with that name
```

Die Zeile „no MCP server configured" erscheint, wenn der Server per `--mcp-config` kommt (`/mcp`
listet ihn dann unter „Built-in MCPs": `chprobe · ✔ connected · 1 tool`); sie verhindert die
Zustellung nicht. **Lauf C** (Server in `.mcp.json` im Projektverzeichnis, ohne `--mcp-config`)
zeigt nur die erste Zeile. Ein Dialog zur `.mcp.json`-Freigabe erschien in Lauf C nicht.

`channel_adopted_mcp` steht in keinem Transcript. Im Binary steht der String neben
`channel_acknowledged` als Stop-Grund einer Drain-Logik
(`he=()=>…?"channel_adopted_mcp":"channel_acknowledged"`, Nachbarstring `device_bridge_register`).
Abgeleitet, nicht gemessen: das sind interne Zustaende einer Bridge, keine Nachricht an den
Channel-Server.

### (2) Zustellung ohne Composer-Paste

Pane-Capture Lauf B, Composer-Zeile vor dem Push: `❯ Try "edit <filepath> to..."` (Platzhalter,
leer). Nach `curl -X POST 127.0.0.1:18788 -d "probe run B push 1"`:

```
← chprobe: probe run B push 1
⏺ I'm not sure what "probe run B push 1" means. Is this: …
✻ Cogitated for 7s · done 7:18 PM
❯
```

Transcript-Eintrag (`~/.claude/projects/…-chprobe/5febff02….jsonl`, gekuerzt):

```
17:18:08.840Z queue-operation  "<channel source=\"chprobe\" msg_id=\"m1\">\nprobe run B push 1\n</channel>"
17:18:08.855Z type=user isMeta=true origin={"kind":"channel","server":"chprobe"}
              content="<channel source=\"chprobe\" msg_id=\"m1\">\nprobe run B push 1\n</channel>"
17:18:12.353Z assistant (thinking) → 17:18:13.131Z assistant text
```

**Form:** ein `user`-Eintrag mit String-Content, `isMeta:true`, `origin.kind:"channel"`. Kein
`tool_result`. Die Nachricht kostet also Kontext wie ein Prompt plus `<channel …>`-Tag.

**Latenz** = Transcript-Timestamp des `user`-Eintrags minus `Date.now()` im Stub direkt vor
`mcp.notification()`, beide Uhren auf derselben Maschine:

| Push | Push→User-Turn | Push→erste Modellreaktion |
|---|---|---|
| B m1 | 18 ms | 3 516 ms (erstes assistant-Event) |
| B m2 | 12 ms | 6 500 ms (tools/call beim Stub, ueber ToolSearch) |
| C m1 | 54 ms | – |
| C m2 | 30 ms | – |
| C m3 | 28 ms | 1 952 ms (tools/call beim Stub) |

Eine Zahl fuer die Karte: **Push→Turn median 28 ms (n=5, 12–54 ms)**.

**Nebenbefund, mechanisch, n=4 Channel-Turns in 2 Laeufen:** ein von einem Channel ausgeloester Turn
bekommt die per-Turn-Attachments nicht. Lauf C m1/m2 tragen nur `instructions` (CLAUDE.md),
`session_context`, `date`, `remote_session_change`, `prompt_snapshot`. Die Kontrolle, ein getippter
Prompt in derselben Session (17:23:06), traegt zusaetzlich `environment`, `model`,
`deferred_tools_delta`, `agent_listing_delta`, **`mcp_instructions_delta` (`## chprobe\nMessages arrive as …`)**
und `skill_listing`. Folge: die `instructions` des Channel-Servers und die Existenz seines Tools
erreichen das Modell erst mit dem ersten getippten Turn oder nach einem Tool-Roundtrip (Lauf B m2:
`mcp_instructions_delta` um 17:19:15.527, direkt nach dem `ToolSearch`-Result). Beide Laeufe
antworteten auf den ersten neutralen Push mit einer Rueckfrage statt mit `ack`. Nach dem getippten
Kontroll-Turn rief das Modell `ack` fuer m1 und m2 nach, und m3 wurde ohne weitere Hilfe quittiert.

### (3) Quittung

Roh-Log aller eingehenden JSON-RPC-Nachrichten beim Stub, Lauf C, ganze Session (3 Pushes):

```
1 "method":"initialize"
1 "method":"notifications/initialized"
1 "method":"tools/list"
3 "method":"tools/call"
```

Zwischen einem Push und dem naechsten `tools/call` kommt keine Nachricht von Claude Code. Die
Harness quittiert eine Notification nicht. Die Doku sagt dasselbe: „Claude Code doesn't acknowledge
notifications. The `await` on `mcp.notification()` resolves when the message is written to the
transport". → **NEIN**.

Was ankommt, ist der Reply-Tool-Call, wenn das Modell ihn macht:

```
17:23:32.655Z pushed    {"msg_id":"m3","content":"probe run C push 3","writeMs":0}
17:23:34.607Z rx        {"method":"tools/call","id":4,…"claudecode/toolUseId":"toolu_01J4io3n8rJDaPqorMWPMckW"…}
17:23:34.609Z call_tool {"name":"ack","arguments":{"msg_id":"m3","text":"ok"}}
```

Der Fleet-Server koennte `observed` also nur aus einem modellabhaengigen Tool-Call fuehren (traegt
`msg_id` und `_meta["claudecode/toolUseId"]`), nicht aus einer mechanischen Harness-Antwort.
Abgeleitet, nicht gebaut: mechanisch belegbar ist die Zustellung auf Claude-Seite ueber den
Transcript-Eintrag `origin.kind:"channel"`, der 12–54 ms nach dem Push geschrieben wird.

## Methode

Stub `stub.ts` (Scratchpad, nicht getrackt), Kern:

```ts
const mcp = new Server({ name: 'chprobe', version: '0.0.1' },
  { capabilities: { experimental: { 'claude/channel': {} }, tools: {} },
    instructions: 'Messages arrive as <channel source="chprobe" msg_id="...">. For every such message call the ack tool exactly once with the msg_id from the tag and the text "ok", then stop. Do nothing else.' })
// ListTools → [ack{msg_id,text}], CallTool → log + "acked"
const transport = new StdioServerTransport(); await mcp.connect(transport)
const orig = transport.onmessage
transport.onmessage = (m, extra) => { log('rx', m); orig?.(m, extra) }
Bun.serve({ hostname: '127.0.0.1', port: 18788, async fetch(req) {
  const before = Date.now()
  await mcp.notification({ method: 'notifications/claude/channel', params: { content: await req.text(), meta: { msg_id } } })
  … } })
```

Session:

```sh
env -i HOME=$HOME PATH=$PATH TERM=xterm-256color USER=$USER SHELL=/bin/zsh LANG=en_US.UTF-8 \
  tmux -L fleetprobe8090 new-session -d -s probe -x 220 -y 50 -c <dir> "zsh -f"
tmux -L fleetprobe8090 send-keys -t probe "claude --model claude-haiku-4-5-20251001 [--mcp-config <dir>/mcp.json --strict-mcp-config] --allowedTools mcp__chprobe__ack --dangerously-load-development-channels server:chprobe" Enter
tmux -L fleetprobe8090 send-keys -t probe Enter        # Dev-Channel-Dialog bestaetigen
tmux -L fleetprobe8090 capture-pane -p -J -t probe     # vor dem Push
curl -s -X POST 127.0.0.1:18788 -d "probe run C push 1"
tmux -L fleetprobe8090 capture-pane -p -J -t probe     # nach dem Push
# Transcript: ~/.claude/projects/<cwd-slug>/<session>.jsonl, Felder timestamp/type/isMeta/origin/attachment.type
tmux -L fleetprobe8090 kill-server
```

Stolperstein: der erste Start in Lauf A erbte `CLAUDE_CODE_CHILD_SESSION` aus der Lane-Pane, und
die Harness meldete `⚠ Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker`. Ohne
`env -i` hat eine aus einer Claude-Session gestartete Probe kein Transcript.

## Was nicht gemessen wurde

- `--channels` mit einem allowlisted Plugin (fakechat): nicht installiert, weil `/plugin install`
  in `~/.claude` schreibt (shared reality). Ob `--channels` ohne Dev-Flag fuer ein offizielles
  Plugin durchgeht, bleibt offen.
- Permission-Relay (`claude/channel/permission`), Pushes waehrend eines laufenden Turns
  (Doku: gebuendelt im naechsten Turn), `-p`-Modus, andere Modelle als Haiku 4.5.
- Ob die fehlenden per-Turn-Attachments bei Channel-Turns Absicht oder Fehler sind. Gemessen ist
  nur: fehlen in 4 von 4 Channel-Turns ohne vorherigen Tool-Roundtrip, vorhanden im getippten
  Kontroll-Turn.
- Seiteneffekte ausserhalb des Scratchpads: zwei Transcript-Verzeichnisse unter
  `~/.claude/projects/*chprobe*` sind entstanden. Die Session trug ein `remote_session_change`-Attachment
  mit einer claude.ai-Session-URL (Remote-Control-Bridge des Accounts), die Statuszeile zeigte
  `← 7 agents`. Die Probe hat keiner dieser Sessions etwas gesendet. Nicht geprueft wurde, was die
  Bridge mit der Probe-Session gemacht hat.
- Keine Anbindung an den Fleet-Server. Produktionsfreigabe offen (Astra-Entscheid a2e9d5d9).

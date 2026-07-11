# Claude Fleet

Desktop web dashboard for up to 10 persistent Claude Code tmux sessions on one machine — sidebar with activity dots, native xterm.js scrollback, direct typing into the focused session, a directory picker with recents for starting sessions per project. Grew out of [claude-deck](https://github.com/jp290/claude-deck) (single-session phone remote), generalized to a slot registry.

![claude-fleet — four Claude Code sessions in a 2×2 grid](docs/screenshot.png)

**Requirements:** [Bun](https://bun.sh), tmux, the `claude` CLI, macOS or Linux.

**Quickstart:**
```sh
bun install
bun run build
FLEET_HOST=$(tailscale ip -4) bun server.ts   # defaults to 127.0.0.1 (loopback only)
```
The server prints a one-click login URL (`http://<ip>:8790/?token=…`) on boot — open it from any machine on the same private network. The token is stored in a `SameSite=Strict` cookie; you log in once per browser.

## Security model

A reachable fleet is **remote code execution as your user** — every session is a shell. Defenses, in order:

1. **Bind address** — defaults to loopback. Only set `FLEET_HOST` to a private (Tailscale/VPN/LAN) address you trust end-to-end; traffic is plain `ws://`, so on anything but an encrypted overlay network (Tailscale is WireGuard) it's sniffable.
2. **Access token** — required on every API/WebSocket request (`?token=` login URL → cookie, or `Authorization: Bearer`). Generated on first boot and persisted in `fleet.json` (mode 600); override with `FLEET_TOKEN`.
3. **Cross-site guards** — `SameSite=Strict` cookie plus Origin and Host checks block cross-site WebSocket hijacking, CSRF, and DNS rebinding (a malicious website in a tab on the same machine can't reach the fleet, even though WebSockets ignore CORS). If you access the fleet via a hostname (e.g. MagicDNS), add it to `FLEET_ALLOWED_HOSTS=myhost.tailnet.ts.net:8790`.
4. **Session command** — defaults to plain `claude` (with its permission prompts). Unattended mode is an explicit opt-in: `FLEET_CMD='claude --dangerously-skip-permissions'`.
5. Stream files and state are chmod 600/700 (terminal output can contain secrets).

Not provided: TLS, multi-user, rate limiting. For HTTPS + tailnet-identity auth in front, `tailscale serve` works well.

## Architecture — tmux without attach, ×10

The core trick: never `tmux attach`. Attaching couples the pane size to the client and fights over one attached view; instead the server tails a `pipe-pane` stream per session and relays raw bytes, parameterized per slot:

- tmux socket `claudefleet`, sessions `s1`..`s10`, each created lazily in a directory chosen via the picker (recents are persisted)
- `pipe-pane` per session → `streams/sN.raw`; the Bun server tails all active streams (100ms poll) and broadcasts per-slot over `ws://…/ws/<N>`
- Reconnect/slot-switch replays the last 2 MB of that slot's stream
- Per-slot input promise chains and per-slot tmux paste buffers (`fleetbufN`) — one hung session can't stall input to the others, and concurrent sends can't race
- `fleet.json` persists slot→cwd + recents + token (writes serialized). Self-heal (2s loop) recreates any *activated* slot whose pane died; **kill via the UI ✕ removes the slot from state first**, so killed slots stay dead. External `kill-session` on an active slot = crash → resurrected. Server restart re-adopts slots from `fleet.json` plus any stray `sN` tmux sessions.

## Client (desktop-first)

- xterm.js stdin is **enabled**: click the terminal and type; keystrokes relay raw over the WS (chunked ≤1000 B). ⌘C/⌘V work natively.
- Compose box for long prompts: Enter sends (bracketed paste + Enter server-side), ⇧Enter = newline. Command-prefix chips are opt-in via `FLEET_CHIPS=/cmd1,/cmd2` (default: hidden).

### Bundled chips: /sharpen and /gosharp

Two general-purpose Claude Code slash commands ship in [`commands/`](commands/) as a working chips demo (canonical home: [jp290/sharpen](https://github.com/jp290/sharpen)):

- **`/sharpen`** — prompt compiler: reshapes a rough prompt into the right context plus only the discipline the task needs; executes it only on clear "do this" intent
- **`/gosharp`** — executor: does the work under sharpened discipline (visible restatement of intent, free self-checks, argue-against-your-own-conclusion before finalizing)

Install them user-wide so every fleet session can invoke them, then surface them as chips:

```sh
cp commands/*.md ~/.claude/commands/
FLEET_CHIPS='/sharpen,/gosharp' bun server.ts
```
- Rename a session via the ✎ icon or double-clicking its name (Enter saves, Esc cancels, blank resets to the folder name). Labels persist in `fleet.json` and die with the session.
- Sidebar polls `/api/sessions` every 2s; green dot = session is visible in a pane, or produced output within 5s (a background claude finishing lights up). Viewer-caused repaints (resize jiggle) don't count as activity; timestamps are compared against server `now` to dodge clock skew. DOM only re-renders on actual change.
- Last-viewed slot is restored from localStorage on reload.

## Ops

```sh
tmux -L claudefleet new-session -d -s srv 'cd ~/claude-fleet && FLEET_HOST=<ip> exec bun server.ts >> server.log 2>&1'   # start
tmux -L claudefleet kill-session -t srv    # stop (claude sessions survive)
bun run build                              # rebuild client after editing src/client.ts
FLEET_E2E_HOST=<ip> bun fleet-e2e.ts       # e2e suite: creates slots 1+2, kills them, restarts srv
```

Env: `FLEET_HOST` (default `127.0.0.1`), `FLEET_PORT` (8790), `FLEET_TOKEN`, `FLEET_ALLOWED_HOSTS`, `FLEET_CMD`, `FLEET_CHIPS`.

## Pinned: xterm 5.5.0, NOT 6.x

6.x removed the overflow-scroll viewport this UI's scrollback relies on. Desktop probably tolerates 6.x, but don't upgrade without testing scroll + stdin.

## Known limits

- `streams/*.raw` grow unbounded (~KB/interaction; killing a slot deletes its stream)
- One terminal size per session, last resize wins — fine for a single client; a second browser window fights over size
- Kill ✕ is destructive (session + scrollback gone) behind a `confirm()` only
- Single shared token, no TLS, no rate limiting — the private network is part of the trust boundary

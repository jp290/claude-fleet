# HANDOFF — session of 2026-07-17/18

Written for a fresh session doing a **security review** of this codebase. Read this,
then `README.md` + `SHARING.md`, then the code. Trust nothing here you can re-verify.

## What this session shipped (a414ada..a942fcf, ~2700 insertions)

| Commit | What |
|---|---|
| `a414ada` | ⌘C copies the canvas/WebGL selection |
| `8135c00` | isolated e2e: `FLEET_SOCK` env + `./e2e-isolated.sh` (throwaway copy, own tmux socket/port) |
| `80049b9` | terminal key row (esc/tab/arrows) on touchscreen devices, compact on desktop |
| `7f4ff61` | per-slot prompt history — server-persisted, 🕘 popover + ArrowUp recall |
| `7b26ed4` | 16 slots; sidebar shows active slots + one "+ new session" row |
| `3a38f8f` | session export ⇩ — printable page + `?format=txt` |
| `b2ef699` | **session sharing** — per-slot password-gated guest access, view/interact |
| `b0abbf2` | landing page on the share-domain root (subagent-built, reviewed) |
| `aa7be82` `516ea28` | conversation view (claude JSONL transcripts) + purpose-restyle |
| `9a634f2` | WebGL renderer (canvas fallback); in-terminal sent-markers built, verified drifting, dropped |
| `0be9e1e` | UI density pass |
| `c2a9c08` | **launchd watchdog** (`watchdog.sh` + `~/Library/LaunchAgents/com.claude-fleet.watchdog.plist`) |
| `7e3f861` | self-heal resumes claude conversations (`--resume` when pinned transcript exists) |
| `a871941` | **scheduled prompts** ⏱ with guard rails |

Docs: `BACKLOG.md` (per-feature analysis + status), `SHARING.md` (share mechanics).

## Live environment (this machine)

- Fleet server: tmux session `srv` on socket `claudefleet`, port **8790**, bound to
  Tailscale IP 100.64.0.1, started by `watchdog.sh` under launchd label
  `com.claude-fleet.watchdog` (KeepAlive — kill the process and it respawns).
- Public: Cloudflare tunnel `cc734c13…` (config `~/.cloudflared/config-logic-extraction.yml`,
  launchd `com.logic-extraction.tunnel`) routes **klaus.example.com → 100.64.0.1:8790**.
  Backup of the pre-change config: `~/.cloudflared/config-logic-extraction.yml.bak-fleet`.
- Ten live claude sessions in slots 1–10. **Do not run `bun fleet-e2e.ts` against the
  live server** — it kills slots 1+2 and restarts srv. Use `./e2e-isolated.sh` (93 checks).
- User's job interview **Tue 2026-07-22** will use session sharing over the public domain.

## New attack surface — review these hardest

1. **Share routes** (`server.ts`, search `shareApi` / `wsShare` / `shareAuthed`):
   public-internet-reachable through the tunnel. Per-share secret in a
   `share_<id>` cookie (HttpOnly, SameSite=Lax, **no `Secure` flag** — deliberate,
   TLS terminates at Cloudflare and local access is plain http; challenge this).
   `timingSafeEqual` compares; brute force = 400ms/attempt + lock after 50/h
   (`failStrike`, in-memory — resets on server restart). View-mode input dropped
   server-side in the WS `message` handler; revoke closes sockets (code 4001).
2. **Share-host isolation** (`SHARE_HOSTS` block at top of `fetch`): on
   klaus.example.com only `/`, `/s/*`, `/ws-share/*`, share assets exist;
   dashboard/login/owner API 404 even with a valid token. The landing page is served
   for GET `/` inside that block. Verify the allowlist regex can't be widened by
   crafted paths.
3. **Share secrets stored plaintext** in `fleet.json` (mode 600) and echoed to the
   owner UI via `/api/sessions`. Deliberate trade-off (owner re-views password);
   a reviewer may want hashing + one-time display instead.
4. **Export endpoint** (`exportMatch`): interpolates capture-pane output and
   label/cwd into HTML — `esc()` covers `& < >`; check attribute contexts.
5. **Transcript endpoint** (`trMatch` + `projDir`/`transcriptFile`): derives a
   filesystem path from the slot's cwd via slug regex `[^a-zA-Z0-9] → "-"`, reads
   `~/.claude/projects/<slug>/*.jsonl`, serves parsed content to the owner. cwd is
   realpath-validated at openSlot; still, path-derivation code deserves eyes.
   Whole-file read per poll (no cap on file size).
6. **Scheduled prompts** (`Auto` / `tickAutos`): unattended text injection into
   sessions. Gates: mandatory runs cap (1–100), min interval 10s, idle gate
   (60s quiet, 10min grace), claude-alive gate (process-tree check via
   `pgrep -P pane_pid` — never types into a bare shell where text would EXECUTE;
   gate active only when `FLEET_CMD` runs claude). Owner-token only.
7. **Watchdog/launchd** (`watchdog.sh`): env (incl. public hostnames) baked into a
   tmux command string; PATH baked into the pane command. Check quoting/injection
   surface if `$PATH`/paths ever contain quotes.
8. **Guest page** (`src/share.ts`, `public/share.html`) and **landing page**
   (`public/landing.html`, subagent-written, human-reviewed once).

## Known weaknesses / open items (honest list)

- Owner token has **no rate limiting** (unchanged pre-existing state); share auth does.
- `authFails` map is unbounded per share id (bounded by #shares in practice).
- Transcript + history + autos endpoints are owner-only but share one token — no
  scoping/audit inside the owner role.
- e2e covers authz boundaries listed above (93 checks) but was never run as an
  adversarial fuzz — inputs are friendly.
- **Unexplained:** tmux sessions on socket `claudefleet` vanished twice on 2026-07-18
  (`s1`, `srv`, old watchdog), and a foreign session `dexter` appeared on that socket
  (08:02). Something outside this repo (suspect: rag-job-channel / serve-dexter on
  port 8899) manipulates the shared socket. Not investigated yet — worth a look
  because it intersects the availability story.
- Untracked in repo: `CLAUDE.md` (private project notes), `fleet.log` (stale).

## Verify before/after any change

```sh
bunx tsc --noEmit --strict --target esnext --module esnext --moduleResolution bundler --types bun src/client.ts src/share.ts server.ts fleet-e2e.ts
bun run build
./e2e-isolated.sh     # must end "ALL PASS" (93 checks)
```
Deploy = `tmux -L claudefleet kill-session -t srv` (watchdog restarts with new code,
sessions survive). Client bundles are built artifacts (`public/app.js`, `public/share.js`, gitignored).

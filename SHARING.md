# Sharing a session

A share exposes **one slot** to a guest at `https://cowork.example.com/s/<id>`,
behind its own password. The owner token never leaves the machine; the public hostname
serves *only* share routes — dashboard, login and owner API 404 there, even with a token.

**A share is a window, never a hand.** The guest watches; nothing they type reaches the
session. There is no interactive mode and no switch to one — the mode was removed
(2026-08-08), not merely defaulted off. The reason is not caution, it is whose account is
being used: a guest typing into your pane sends *their* prompts as *your* Inputs, on your
subscription and your rate-limit tier, which is the thing Anthropic's Consumer Terms §2
names ("make your Account available to anyone else"). Watching is not that; typing is.
A guest who wants something done says so in the comment thread, and you decide.

## Quick start (e.g. the interview)

1. In the dashboard sidebar, hover the session → click **⤴**.
2. **create share link** → copy the link and the generated password.
3. Send the link and the password over **separate channels** (link in chat,
   password verbally).
4. Afterwards: ⤴ → **revoke share**. Connected guests are kicked instantly
   ("This share was revoked by the owner").

Killing the session also kills its share. One share per slot; re-sharing replaces it
(new id + password, old guests disconnected).

## Guest experience

Password gate → live terminal at the session's current size (guests never resize your
pty; small screens scroll), plus the read-only side panel: the working diff, the session
brief, the transcript reader. The terminal takes no input at all. The one channel back is
the **comment thread** — text you read in the share dialog and act on yourself.

## Mechanics / security

- Per-share cookie (`share_<id>`, HttpOnly, SameSite=Lax, 7 days), checked with
  `timingSafeEqual`. Wrong guesses cost 400 ms; >50/hour locks the share for the hour.
- Guest input is dropped **server-side** and unconditionally (`server.ts` WS message
  handler: `if (ws.data.share) return;`), not just hidden in the UI — and there is no
  send route to reach either. Two independent locks, neither of which reads a mode.
- Shares persist in `fleet.json` (mode 600) across server restarts; a share whose
  session didn't survive is dropped on boot.
- Env (set in the fleet-watchdog start command): `FLEET_SHARE_HOSTS` makes the public
  hostname share-only, `FLEET_SHARE_URL` prints proper links in the share dialog,
  `FLEET_ALLOWED_HOSTS` admits the hostname past the DNS-rebinding guard.
- Ingress: `~/.cloudflared/config-logic-extraction.yml` routes
  `cowork.example.com → http://100.64.0.1:8790` (Cloudflare tunnel
  `cc734c13…`, restarts via launchd `com.logic-extraction.tunnel`).
- e2e coverage: `./e2e-isolated.sh` — auth, scope, revoke, restart persistence,
  share-host isolation, and the two negative controls that keep the window a window:
  a connected guest socket's bytes never reach the pane, and a share asked for as
  `mode: "interact"` is minted view-only anyway.

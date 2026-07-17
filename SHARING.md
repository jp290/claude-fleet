# Sharing a session

A share exposes **one slot** to a guest at `https://klaus.example.com/s/<id>`,
behind its own password. The owner token never leaves the machine; the public hostname
serves *only* share routes — dashboard, login and owner API 404 there, even with a token.

## Quick start (e.g. the interview)

1. In the dashboard sidebar, hover the session → click **⤴**.
2. Pick **view only** (guest watches) or **interactive** (guest can type and send —
   it is your real shell, only for people you're actively pairing with).
3. **create share link** → copy the link and the generated password.
4. Send the link and the password over **separate channels** (link in chat,
   password verbally).
5. Afterwards: ⤴ → **revoke share**. Connected guests are kicked instantly
   ("This share was revoked by the owner").

Killing the session also kills its share. One share per slot; re-sharing replaces it
(new id + password, old guests disconnected).

## Guest experience

Password gate → live terminal at the session's current size (guests never resize your
pty; small screens scroll). Interactive guests get a compose bar (Enter sends) and can
type into the terminal directly. Guest prompts land in the session's prompt history.

## Mechanics / security

- Per-share cookie (`share_<id>`, HttpOnly, SameSite=Lax, 7 days), checked with
  `timingSafeEqual`. Wrong guesses cost 400 ms; >50/hour locks the share for the hour.
- View-mode guest input is dropped **server-side** (`server.ts` WS message handler),
  not just hidden in the UI.
- Shares persist in `fleet.json` (mode 600) across server restarts; a share whose
  session didn't survive is dropped on boot.
- Env (set in the fleet-watchdog start command): `FLEET_SHARE_HOSTS` makes the public
  hostname share-only, `FLEET_SHARE_URL` prints proper links in the share dialog,
  `FLEET_ALLOWED_HOSTS` admits the hostname past the DNS-rebinding guard.
- Ingress: `~/.cloudflared/config-logic-extraction.yml` routes
  `klaus.example.com → http://100.64.0.1:8790` (Cloudflare tunnel
  `cc734c13…`, restarts via launchd `com.logic-extraction.tunnel`).
- e2e coverage: `./e2e-isolated.sh` — auth, mode enforcement, scope, revoke,
  restart persistence, share-host isolation.

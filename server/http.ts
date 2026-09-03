// The HTTP primitives of the server: the JSON response helper every route returns through, and
// the address it listens on. A LEAF module — it binds nothing from the core, which is what lets
// `server/auth.ts` (and every later module that answers a request) import it without the
// `server/` → `server.ts` cycle rule 2 of the Slice-Protokoll forbids.

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Defaults to localhost — nothing is network-reachable until you explicitly set FLEET_HOST
// (e.g. your Tailscale IP via `tailscale ip -4`). Even then, every request needs the access
// token (printed on boot), because a reachable fleet is remote code execution as your user.
export const HOST = process.env.FLEET_HOST ?? "127.0.0.1";
export const PORT = Number(process.env.FLEET_PORT ?? 8790);

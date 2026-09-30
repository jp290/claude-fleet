import { timingSafeEqual } from "node:crypto";
import { audit } from "./audit-log";
import { HOST, PORT, json } from "./http";
import type { Share, Slot } from "./types";

// --- auth: single access token, sent once via ?token= then held in a SameSite=Strict cookie.
// Strict cookie + Origin/Host guards below are what stand between "any website you visit"
// and keystroke injection into your shells (WebSockets are not subject to CORS).
// Cookies are host-scoped, not port-scoped, so two instances on one host (a preview lane on
// 8873 next to the board on 8790) used to overwrite each other's login under the one fixed
// name — measured 2026-09-19. The login cookie is therefore named per instance (`fleet_<port>`);
// the bare legacy name stays READABLE so an open board session survives its own redeploy, and
// is replaced by the new name at the next login.
export const cookieName = `fleet_${PORT}`;

// The cookie half of tokenFrom, shared with tokenChannel so the channel report cannot drift
// from what the reader accepts. When two instances share a host the browser hands BOTH names
// over in one Cookie header, so the instance's own name wins and the legacy name is only the
// fallback. `[^;]+` keeps an empty value a non-match, exactly as before.
export function cookieToken(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  const own = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`).exec(cookie);
  if (own) return own[1];
  const legacy = /(?:^|;\s*)fleet=([^;]+)/.exec(cookie);
  return legacy ? legacy[1] : null;
}

export function tokenFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = cookieToken(req);
  if (cookie) return cookie;
  return new URL(req.url).searchParams.get("token");
}

export function secretEq(a: string, b: string): boolean {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export type Principal =
  | { kind: "owner"; via: "cookie" | "bearer" | "query"; session?: Extract<Principal, { kind: "session" }> & { label: string } }
  | { kind: "unknown"; why: "no-credential" }
  | { kind: "session"; slot: number; openedAt: number; role: "lane" | "main" | "generic" }
  | { kind: "device"; deviceId: string }
  | { kind: "guest"; shareId: string }
  | { kind: "machine"; why: "tick" | "sensor" | "policy" | "boot" };

type PrincipalState = {
  slots: () => readonly Slot[];
  ownerToken: () => string;
  helperToken: () => string | null;
  shares: () => readonly Share[];
  sessionRole: (slot: Slot) => Extract<Principal, { kind: "session" }>["role"];
};
let principalState: PrincipalState | null = null;
export function setPrincipalState(state: PrincipalState): void { principalState = state; }

export type AuditActor =
  | Exclude<Principal, { kind: "owner" }>
  | { kind: "owner" }
  | { kind: "unknown" }
  | (Extract<Principal, { kind: "session" }> & { label: string; via: "owner-bearer" });

export function resolveSelfPrincipal(req: Request): Extract<Principal, { kind: "session" }> | null {
  const state = principalState;
  if (!state) return null;
  const given = req.headers.get("x-fleet-self-token") ?? "";
  const slot = given ? state.slots().find((s) => s.cwd && s.selfToken && secretEq(given, s.selfToken)) : undefined;
  return slot ? { kind: "session", slot: slot.id, openedAt: slot.openedAt, role: state.sessionRole(slot) } : null;
}

export function resolvePrincipal(req: Request): Principal | null {
  const state = principalState;
  if (!state) return null;
  const offered = tokenFrom(req);
  if (offered && secretEq(offered, state.ownerToken())) {
    const auth = req.headers.get("authorization");
    const via = auth?.startsWith("Bearer ") ? "bearer" : cookieToken(req) ? "cookie" : "query";
    const self = via === "bearer" ? resolveSelfPrincipal(req) : null;
    const slot = self ? state.slots().find((s) => s.id === self.slot && s.openedAt === self.openedAt) : undefined;
    return { kind: "owner", via, ...(self && slot ? { session: { ...self, label: slot.label ?? "" } } : {}) };
  }
  const self = resolveSelfPrincipal(req);
  if (self) return self;
  const helper = req.headers.get("x-fleet-helper-token") ?? "";
  if (helper && state.helperToken() && secretEq(helper, state.helperToken()!))
    return { kind: "device", deviceId: "helper-token" };
  const cookie = req.headers.get("cookie") ?? "";
  const share = state.shares().find((sh) => {
    const match = new RegExp(`(?:^|;\\s*)share_${sh.id}=([^;]+)`).exec(cookie);
    return !!match && secretEq(match[1], sh.secret);
  });
  return share ? { kind: "guest", shareId: share.id } : null;
}

export function actorFromPrincipal(principal: Principal | null): AuditActor {
  if (!principal) return { kind: "unknown", why: "no-credential" };
  if (principal.kind !== "owner") return principal;
  if (principal.via !== "bearer") return { kind: "owner" };
  return principal.session ? { ...principal.session, via: "owner-bearer" } : { kind: "unknown" };
}

// --- share auth: per-share cookie, brute-force throttled (public-facing) ---
// comment flood guard: per-share sliding minute, cheap and in-memory — guests are
// already authed, this only stops a stuck key / paste loop from filling the thread
const commentTimes = new Map<string, number[]>();
export function commentStrike(id: string): boolean {
  const now = Date.now();
  const list = (commentTimes.get(id) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 10) { commentTimes.set(id, list); return true; }
  commentTimes.set(id, [...list, now]);
  return false;
}
function shareAuthed(req: Request, sh: Share): boolean {
  const cookie = req.headers.get("cookie");
  const m = cookie ? new RegExp(`(?:^|;\\s*)share_${sh.id}=([^;]+)`).exec(cookie) : null;
  return !!m && secretEq(m[1], sh.secret);
}
export const authFails = new Map<string, { count: number; resetAt: number }>();
export function failStrike(id: string): boolean {
  const now = Date.now();
  const f = authFails.get(id);
  if (!f || now > f.resetAt) {
    authFails.set(id, { count: 1, resetAt: now + 3600_000 });
    return false;
  }
  f.count++;
  return f.count > 50; // locked for the rest of the hour
}
// A wrong share COOKIE is a password guess like any other. /s/<id>/auth throttles every guess
// (400ms flat) and locks the share after 50, but the cookie path used to answer an unlimited
// number of guesses at full request rate — the same secret, a cheaper oracle, no lockout. Since
// a share is a live window onto the owner's terminal, that made a weak owner-chosen password
// (the route floor is 8 chars) brute-forceable in the open. Every non-/auth share surface routes
// its credential check through here so both paths feed ONE counter.
// Two deliberate asymmetries:
//  - an ABSENT cookie is not a guess (a guest who hasn't logged in yet, or the share page's own
//    first load) and never consumes a strike — otherwise any stranger could lock a share by
//    loading its URL 51 times.
//  - a VALID cookie is answered before the lock is consulted, so a lockout silences guessers
//    without evicting the authenticated guest (/auth's pre-check does refuse even a correct
//    password while locked — that stays, it is the path a guesser uses).
function shareCookieOffered(req: Request, sh: Share): boolean {
  const cookie = req.headers.get("cookie");
  return !!cookie && new RegExp(`(?:^|;\\s*)share_${sh.id}=`).test(cookie); // id is [a-z0-9], regex-safe
}
export async function shareGate(req: Request, sh: Share): Promise<Response | null> {
  if (shareAuthed(req, sh)) return null;
  if (!shareCookieOffered(req, sh)) return json({ error: "unauthorized" }, 401);
  const locked = failStrike(sh.id);
  audit(locked ? "share_auth_lock" : "share_auth_fail", sh.slot); // never the guessed secret
  await Bun.sleep(400); // flat cost per wrong guess, same as /auth
  return json({ error: locked ? "too many attempts — try again later" : "unauthorized" }, locked ? 429 : 401);
}
export function closeShareClients(s: Slot, shareId: string, code = 4001, reason = "share revoked"): void {
  for (const ws of s.clients) if (ws.data.share === shareId) ws.close(code, reason);
}

const ALLOWED_HOSTS = new Set(
  [`${HOST}:${PORT}`, `localhost:${PORT}`, `127.0.0.1:${PORT}`]
    .concat((process.env.FLEET_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean)),
);

// DNS-rebinding guard (Host) + cross-site guard (Origin). Browsers attach Origin to
// fetch/XHR/WebSocket; if it's present its host must be us.
export function guard(req: Request): Response | null {
  const host = req.headers.get("host") ?? "";
  if (!ALLOWED_HOSTS.has(host))
    return json({ error: `host '${host}' not allowed — set FLEET_ALLOWED_HOSTS` }, 403);
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== host) return json({ error: "cross-origin request blocked" }, 403);
    } catch {
      return json({ error: "cross-origin request blocked" }, 403);
    }
  }
  return null;
}

// The security perimeter, asserted as a perimeter rather than route by route.
//
// The individual guards are already covered where they were built (auth.ts: token/host/origin;
// share.ts: the guest cookie; self-token.ts: the scoped credential; steward-core.ts: the steward
// principal's 403s). What NOTHING covered is the perimeter's two structural properties:
//
//   1. WHICH routes are reachable before the owner gate. `server.ts`'s fetch() is an ordered
//      chain, and the last line of it is `tokenGate` — so everything ABOVE that line is the
//      entire pre-auth attack surface, and everything below is default-deny by construction.
//      A new route added above the line is unauthenticated by accident, and no runtime check can
//      see that: it looks like a working feature. So the pin here is SOURCE-level — the set of
//      pathname matches above the gate must equal a reviewed allowlist, and every syntactic form
//      that reaches a route must be one the extractor recognizes (else a new form escapes it).
//   2. That the four non-owner principals are denied on the DANGEROUS surface as a matrix, not
//      at the four sample points the individual modules happened to test. A denial is a status
//      in {401, 403}: a 400 would mean the request reached body validation, i.e. past auth.
//
// Plus the invariants whose only statement today is a code comment: credentials are revoked when
// a slot dies or is recycled (`server.ts` ~1147), and no secret reaches the audit log or any
// non-owner-readable payload.
import { readFileSync } from "node:fs";
import { BASE, H, REPO, ROOT, TOKEN, check, get, post, readText } from "./harness";
import type { Ctx, StewardCtx } from "./ctx";

interface FleetState {
  token?: string;
  stewardToken?: string;
  slots?: Record<string, { cwd?: string; selfToken?: string }>;
  shares?: { id: string; secret: string }[];
}
const readState = (): FleetState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as FleetState;
// `openSlot` mints the credential and queues `saveState()` BEFORE it awaits the pane spawn
// (server.ts ~1147/1177), and saveState is fire-and-forget through its serializing chain — so the
// route can answer a hair before the file on disk carries the new token. Poll for the shape we
// expect instead of reading once: a timeout still returns the last value read, so a genuine
// failure (no rotation) fails its check rather than hiding behind a retry.
async function selfTokenOf(slot: number, not = ""): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    seen = readState().slots?.[String(slot)]?.selfToken ?? "";
    if (/^[0-9a-f]{32}$/.test(seen) && seen !== not) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

// --- §1 fixtures: the reviewed pre-auth allowlist -------------------------------------------
// Every entry is a route reachable WITHOUT the owner token. Adding one is a security decision;
// this list is where that decision is recorded. `=` is an exact pathname, `~` a regex.
const PRE_AUTH_ROUTES = [
  '= /',                  // login (?token=, tokenGate'd) AND the share-host landing page
  '= /api/dispositions',  // pre-check only: 403s a self token, then falls through to the owner gate
  '= /api/self/autos',    // the scoped per-lane credential
  '= /favicon.ico',
  '= /intake',            // its own secret (FLEET_INTAKE_SECRET), never the owner token
  String.raw`~ /^\/(s\/[a-z0-9]+(\/(auth|info|send|diff|comments|brief|summary|transcript))?|ws-share\/[a-z0-9]+)$/`,
  String.raw`~ /^\/s\/([a-z0-9]+)\/(auth|info|send|diff|comments|brief|summary|transcript)$/`,
  String.raw`~ /^\/s\/[a-z0-9]+$/`,
  String.raw`~ /^\/ws-share\/([a-z0-9]+)$/`,
];
const STATIC_ROUTES = ["/", "/app.js", "/share.js", "/xterm.css", "/manifest.webmanifest", "/icon.svg", "/icon-180.png"];
// The steward token bypasses the owner gate entirely (server.ts ~4499), so its route set is a
// second pre-auth surface — pinned for the same reason.
const STEWARD_ROUTES = [
  "= /api/dispositions", "= /api/steward/autos", "= /api/steward/digest", "= /api/steward/journal",
  "= /api/steward/outcomes", "= /api/steward/send", "= /api/steward/sessions", "= /api/steward/tasks",
  String.raw`~ /^\/api\/steward\/slots\/(\d+)\/brief$/`,
  String.raw`~ /^\/api\/steward\/slots\/(\d+)\/transcript$/`,
];

const LITERAL = /url\.pathname === "([^"]+)"/g;
const REGEXP = /(\/\^[^\n]*?\/)\.(?:exec|test)\(url\.pathname\)/g;
const routeSet = (src: string): string[] => [...new Set([
  ...[...src.matchAll(LITERAL)].map((m) => `= ${m[1]}`),
  ...[...src.matchAll(REGEXP)].map((m) => `~ ${m[1]}`),
])].sort();
// every `url.pathname` use the two extractors above do NOT recognize, minus the two forms that
// deliberately narrow rather than route (the share-host whitelist, the STATIC map lookup)
const unrecognized = (src: string): string[] =>
  (src.match(/.*url\.pathname.*/g) ?? []).map((l) => l.trim()).filter((l) =>
    !/url\.pathname === "/.test(l) && !/\.(?:exec|test)\(url\.pathname\)/.test(l)
    && !/\]\.includes\(url\.pathname\)/.test(l) && !/STATIC\[url\.pathname\]/.test(l));

// --- §2 fixtures: the dangerous owner surface ------------------------------------------------
// `ownerSafe` marks the probes whose invalid-body owner call is provably side-effect-free, so the
// positive control can prove the route exists without the matrix itself changing fleet state.
// /api/dispatch is the one exclusion: it reads `body.on` with no validation (server.ts ~5393).
interface Probe { path: string; method: "GET" | "POST"; body?: unknown; ownerSafe?: boolean }
const dangerous = (slot: number): Probe[] => [
  { path: "/send", method: "POST", body: { slot, text: "x" }, ownerSafe: true },
  { path: `/api/slots/${slot}/kill`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/open`, method: "POST", body: { model: "not a model!" }, ownerSafe: true },
  { path: `/api/slots/${slot}/open-worktree`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/share`, method: "POST", body: { password: "short" }, ownerSafe: true },
  { path: `/api/slots/${slot}/unshare`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/rename`, method: "POST", body: { label: "sec" }, ownerSafe: true },
  { path: `/api/slots/${slot}/mission`, method: "POST", body: { mission: "sec" }, ownerSafe: true },
  { path: `/api/slots/${slot}/land`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/merge`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/shelve`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/slots/${slot}/autos`, method: "POST", body: {}, ownerSafe: true },
  { path: "/api/worktrees/remove", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/worktrees/discard", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/repos/undo-land", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/repo-base", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/autos/switch", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/autos/quiet", method: "POST", body: { start: 99, end: 99 }, ownerSafe: true },
  { path: "/api/dispositions", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/tasks", method: "POST", body: {}, ownerSafe: true },
  // GET /api/tasks serves the full prompt texts (intake mail included) that the 2 s poll no
  // longer carries — a read route, but the most content-bearing one the queue has
  { path: "/api/tasks", method: "GET", ownerSafe: true },
  { path: "/api/dispatch", method: "POST", body: {} },
  { path: "/api/sessions", method: "GET", ownerSafe: true },
  { path: "/api/audit", method: "GET", ownerSafe: true },
  { path: "/api/prompts", method: "GET", ownerSafe: true },
  { path: "/api/steward/token", method: "GET", ownerSafe: true },
  { path: "/api/lanes", method: "POST", body: {}, ownerSafe: true },
];

const fire = (p: Probe, headers: Record<string, string>): Promise<Response> =>
  fetch(BASE + p.path, {
    method: p.method,
    headers: { "content-type": "application/json", ...headers },
    ...(p.method === "POST" ? { body: JSON.stringify(p.body ?? {}) } : {}),
  });

export async function run(ctx: Ctx, sc: StewardCtx): Promise<void> {
  // ===== §1 the pre-auth surface is a pinned allowlist, not an emergent property =====
  const src = await readText(`${ROOT}/server.ts`);
  const gate = src.indexOf("everything below carries authority");
  const preAuth = src.slice(src.indexOf("async fetch(req, server) {"), gate);
  check("§1 the owner gate is still the last line of fetch()'s chain (the whole pin rests on it)",
    gate > 0 && preAuth.length > 1000 && src.slice(gate, gate + 200).includes("tokenGate"), `gate@${gate}`);
  const stray = unrecognized(preAuth);
  check("§1 every pre-auth pathname match uses a form the extractor reads (a new form cannot slip past the pin)",
    stray.length === 0, stray.join(" | "));
  const found = routeSet(preAuth);
  check("§1 the pre-auth route set equals the reviewed allowlist",
    found.join("\n") === [...PRE_AUTH_ROUTES].sort().join("\n"),
    `unexpected: [${found.filter((r) => !PRE_AUTH_ROUTES.includes(r)).join(", ")}] missing: [${PRE_AUTH_ROUTES.filter((r) => !found.includes(r)).join(", ")}]`);
  const statics = [...src.slice(src.indexOf("const STATIC"), src.indexOf("function bundleV")).matchAll(/^\s*"([^"]+)": \{ path/gm)].map((m) => m[1]);
  check("§1 the unauthenticated static map equals the reviewed set (no new file served without a token)",
    [...statics].sort().join(" ") === [...STATIC_ROUTES].sort().join(" "), statics.join(" "));
  const stewSrc = src.slice(src.indexOf("async function handleStewardRoute"), src.indexOf("Bun.serve<WSData>"));
  const stewStray = unrecognized(stewSrc);
  const stewFound = routeSet(stewSrc);
  check("§1 the steward principal's route set equals the reviewed allowlist, in a form the extractor reads",
    stewStray.length === 0 && stewFound.join("\n") === [...STEWARD_ROUTES].sort().join("\n"),
    `stray: [${stewStray.join(" | ")}] unexpected: [${stewFound.filter((r) => !STEWARD_ROUTES.includes(r)).join(", ")}]`);
  // the steward gate is default-deny: an unmatched path must fall to a 403, never to the owner
  // chain below it. If this `?? json(…403)` ever becomes a fallthrough, every owner route opens.
  check("§1 the steward gate ends in a default-deny (an unmatched path 403s, never falls through)",
    /const r = await handleStewardRoute\(req, url\);\s*\n\s*return r \?\? json\(\{ error: "steward token: route not in scope" \}, 403\);/.test(src));

  // ===== §2 the non-owner principals × the dangerous owner surface =====
  const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const idle = sess.slots.find((s) => !s.cwd);
  check("§2 an idle slot is available as the matrix's blast-radius-free target", !!idle, JSON.stringify(sess.slots.map((s) => s.id + (s.cwd ? "*" : ""))));
  const probes = dangerous(idle?.id ?? 16);
  // a lane's scoped credential, taken from state rather than a pane probe (deterministic, and it
  // is the same string the pane exports — server.ts ~1084 reads it from exactly here)
  const st0 = readState();
  const someSelf = Object.values(st0.slots ?? {}).map((s) => s.selfToken).find(Boolean) ?? "";
  check("§2 fixtures: a real lane selfToken and a real guest cookie are available as principals",
    /^[0-9a-f]{32}$/.test(someSelf) && /^share_[0-9a-f]+=/.test(ctx.shICookie),
    `self=${someSelf.slice(0, 8)}… cookie=${ctx.shICookie.slice(0, 16)}…`);
  const principals: { name: string; headers: Record<string, string> }[] = [
    { name: "no credential", headers: {} },
    { name: "an unknown bearer token", headers: { authorization: "Bearer 00000000000000000000000000000000" } },
    { name: "a guest share cookie", headers: { cookie: ctx.shICookie } },
    { name: "a lane selfToken offered as the owner token", headers: { authorization: `Bearer ${someSelf}` } },
    { name: "a lane selfToken in its own header", headers: { "x-fleet-self-token": someSelf } },
    { name: "the steward token", headers: { authorization: `Bearer ${sc.token}` } },
  ];
  for (const p of principals) {
    const res = await Promise.all(probes.map(async (probe) => ({ probe, status: (await fire(probe, p.headers)).status })));
    const leaked = res.filter((r) => r.status !== 401 && r.status !== 403);
    check(`§2 ${p.name} is denied on all ${probes.length} dangerous owner routes (401/403 — never far enough to validate a body)`,
      leaked.length === 0, leaked.map((r) => `${r.probe.path}:${r.status}`).join(" "));
  }
  // the anti-tautology control: the same probes, with the owner token, must NOT be denied —
  // otherwise the matrix above would pass just as well against a list of routes that don't exist.
  const ownerProbes = probes.filter((p) => p.ownerSafe);
  const ownerRes = await Promise.all(ownerProbes.map(async (probe) => ({ probe, status: (await fire(probe, H)).status })));
  const denied = ownerRes.filter((r) => r.status === 401 || r.status === 403 || r.status === 404);
  check(`§2 control: the owner is admitted on all ${ownerProbes.length} of them (so the denials above are about auth, not missing routes)`,
    denied.length === 0, denied.map((r) => `${r.probe.path}:${r.status}`).join(" "));

  if (!REPO) return; // §3–§5 need a lane; the lane sections of the suite are repo-gated too

  // ===== §3 a scoped credential dies with its session =====
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  const selfTok = await selfTokenOf(ln.slot);
  const selfAuto = (tok: string) => fetch(BASE + "/api/self/autos", {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": tok },
    body: JSON.stringify({ text: "security-probe", inSec: 3600 }),
  });
  const live = await selfAuto(selfTok);
  const liveJ = (await live.json()) as { auto?: { id: string } };
  check("§3 control: the live lane's selfToken authenticates (so the refusals below mean revocation)",
    live.ok && !!liveJ.auto, `${live.status} ${JSON.stringify(liveJ)}`);
  if (liveJ.auto) await post(`/api/autos/${liveJ.auto.id}/delete`, {});

  // ===== §4 no secret reaches a non-owner-readable payload =====
  const SHARE_PW = "sec-sweep-password-7712";
  const shRes = await post(`/api/slots/${ln.slot}/share`, { mode: "view", password: SHARE_PW });
  const sh = (await shRes.json()) as { id: string };
  const shAuth = await fetch(BASE + `/s/${sh.id}/auth`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: SHARE_PW }),
  });
  const shCookie = (shAuth.headers.get("set-cookie") ?? "").split(";")[0];
  check("§4 fixture: a fresh view share on the probe lane is authenticated", shAuth.ok && shCookie.startsWith(`share_${sh.id}=`), shCookie.slice(0, 24));
  const stAll = readState();
  // every secret the process holds, keyed by name so a hit names WHICH one leaked. Deduped BY
  // VALUE (the share just created appears twice — as the password sent and as the stored secret),
  // so the ×N in the check names below is the count of distinct strings actually searched for.
  const secrets = [...new Map<string, string>([
    ["owner token", TOKEN], ["steward token", sc.token], ["this share's password", SHARE_PW],
    ...Object.entries(stAll.slots ?? {}).filter(([, v]) => v.selfToken).map(([id, v]) => [`slot ${id} selfToken`, v.selfToken!] as [string, string]),
    ...(stAll.shares ?? []).map((s) => [`share ${s.id} secret`, s.secret] as [string, string]),
  ].map(([n, v]) => [v, n] as [string, string]))].map(([v, n]) => [n, v] as [string, string]);
  check("§4 fixture: the secret inventory covers all four credential classes and nothing too short to be distinctive",
    ["owner token", "steward token", "selfToken", "secret"].every((c) => secrets.some(([n]) => n.includes(c)))
    && secrets.every(([, v]) => v.length >= 8),
    secrets.map(([n, v]) => `${n}:${v.length}`).join(" "));
  const sweep = async (label: string, reqs: [string, Promise<Response>][]): Promise<void> => {
    const bodies = await Promise.all(reqs.map(async ([p, r]) => [p, await (await r).text()] as [string, string]));
    const hits = bodies.flatMap(([p, b]) => secrets.filter(([, v]) => b.includes(v)).map(([n]) => `${p}→${n}`));
    check(`§4 no ${label} payload carries any credential (${bodies.length} endpoints × ${secrets.length} secrets)`,
      hits.length === 0, hits.join(" "));
    const empty = bodies.filter(([, b]) => b.length < 2);
    check(`§4 control: every ${label} endpoint answered with a body to search`, empty.length === 0, empty.map(([p]) => p).join(" "));
  };
  const guest = (p: string) => fetch(BASE + `/s/${sh.id}${p}`, { headers: { cookie: shCookie } });
  await sweep("guest-readable", [["info", guest("/info")], ["brief", guest("/brief")], ["diff", guest("/diff")],
    ["transcript", guest("/transcript")], ["comments", guest("/comments")]]);
  await sweep("steward-readable", [["sessions", sc.stewGet("/api/steward/sessions")],
    ["brief", sc.stewGet(`/api/steward/slots/${ln.slot}/brief`)],
    ["transcript", sc.stewGet(`/api/steward/slots/${ln.slot}/transcript`)],
    ["outcomes", sc.stewGet("/api/steward/outcomes")], ["journal", sc.stewGet("/api/steward/journal?tail=5")],
    ["dispositions", sc.stewGet("/api/dispositions?limit=50")]]);
  await post(`/api/slots/${ln.slot}/unshare`, {});

  // ===== §3 continued: shelve kills the pane → the credential must die with it =====
  const NOTE = "shelve-note-secret-marker-8823";
  check("§3 fixture: the probe lane is shelved with a distinctive note", (await post(`/api/slots/${ln.slot}/shelve`, { note: NOTE })).ok);
  const dead = await selfAuto(selfTok);
  check("§3 a killed lane's selfToken no longer authenticates (the slot's cwd is what the route binds to)",
    dead.status === 401, String(dead.status));
  // recycle the same slot: server.ts ~1147 claims a fresh session mints a fresh credential
  check("§3 fixture: the slot is recycled onto a plain session", (await post(`/api/slots/${ln.slot}/open`, { cwd: REPO })).ok);
  const reTok = await selfTokenOf(ln.slot, selfTok);
  check("§3 a recycled slot mints a NEW selfToken (the prior session's credential is not inherited)",
    /^[0-9a-f]{32}$/.test(reTok) && reTok !== selfTok && selfTok.length === 32, `${selfTok.slice(0, 8)}… → ${reTok.slice(0, 8)}…`);
  const stale = await selfAuto(selfTok);
  check("§3 the prior session's selfToken is refused against the recycled slot", stale.status === 401, String(stale.status));
  await post(`/api/slots/${ln.slot}/kill`, {});
  await post("/api/worktrees/discard", { repo: REPO, path: ln.cwd, branch: ln.branch });

  // ===== §5 the audit log records that things happened, never the secrets they carried =====
  // restart.ts rotates the log mid-suite, so both halves are searched — a secret that rotated
  // out is still on disk.
  const auditRaw = (await readText(ctx.auditPath)) + (await readText(`${ctx.auditPath}.1`));
  check("§5 control: the audit log recorded the shelve (so the absence checks below search a real record)",
    auditRaw.includes(`"slot_shelve"`) && auditRaw.includes(`"note:${NOTE.length}"`), `${auditRaw.length} bytes`);
  check("§5 the audit log records a shelve note's LENGTH, never its text", !auditRaw.includes(NOTE));
  check("§5 the audit log never contains the steward token", !auditRaw.includes(sc.token));
  check("§5 the audit log never contains a lane selfToken (live or revoked)",
    !auditRaw.includes(selfTok) && !auditRaw.includes(reTok)
    && Object.values(readState().slots ?? {}).every((s) => !s.selfToken || !auditRaw.includes(s.selfToken)));
  check("§5 the audit log never contains this section's share password", !auditRaw.includes(SHARE_PW));
}

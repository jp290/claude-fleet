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
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, H, REPO, ROOT, TOKEN, check, get, post, readText, tmuxOut } from "./harness";
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
  // The self family's principal is per-SLOT, not per-lane. It was per-lane until 2026-08-07: the
  // credential was minted for every slot all along, but exported into a lane's pane only, and the
  // widening (server.ts, grep `selfExport`) hands it to every session with a cwd — the ⚙ steward
  // and a plain session in a foreign repo included. Recorded here because this list is where a
  // pre-auth decision is recorded, and this one moved the PRINCIPAL rather than the route set.
  // What it grants is bounded by the routes below: schedule/subscribe/read on your OWN pane, plus
  // the explicit main-session handoff that opens one successor and retires only the caller. The
  // lane-only questions keep their non-lane 409s, and §2 below re-runs the whole dangerous owner
  // surface against a plain session's token.
  '= /api/self',          // same credential, read-only: the session's own row (slot-bound, no lane needed)
  '= /api/self/autos',    // the scoped per-slot credential — no lane check, and never had one
  // A Program is a planning bracket above lanes, so this self route runs in the opposite scope:
  // a non-lane session may propose and read only rows carrying its exact session triple. It never
  // confirms, activates, completes, dispatches, or writes a task; those remain owner acts.
  '= /api/self/programs',
  '= /api/self/program-execution', // read-only and slot-bound; non-lanes only, with no mutation or foreign-slot reach
  // The Supervisor's two Cut-2 channels, on this list for the same reason as their neighbours (the
  // self principal IS the boundary) and narrower than any of them: both answer 409 to every session
  // but the one the OWNER bound as Supervisor. The view is read-only and mutates nothing (pinned as
  // a source rule). The nudge writes into a pane, and that is bounded structurally: the receiver is
  // DERIVED from the named program's bound Program-MAIN and no body field can nominate a slot
  // (pinned), it refuses a program that is not active, a stale/absent binding, an owner debt on the
  // receiver, and a pane with no agent behind it.
  '= /api/self/supervisor-view',
  '= /api/self/nudge',
  '= /api/self/main-direct', // scoped non-lane provenance view; both git heads are server-read
  '= /api/self/main-direct/preflight',
  '= /api/self/main-direct/finalize',
  '= /api/self/main-direct/abandon',
  // added 2026-08-07, and it is the only entry on this list that WRITES INTO A PANE on a trigger
  // the caller does not control. What bounds it: the receiver is the token's slot and nothing in
  // the body can move it (createWatchForSlot takes `s`, never a body field), the message is one
  // server-authored line, it fires at most once per subscription, and WATCH_MAX_PER_SLOT caps how
  // many can be armed. Its subscriber rule runs the OTHER way to the original lane-only routes below:
  // a lane is refused 409 here. The opposite-scope 409s are pinned in self-token.ts/watch.ts.
  '= /api/self/watch',    // same credential: subscribe your OWN pane to a lane's done-looking
  // The three Clarification operations share two pathname shapes: GET+POST on the collection,
  // then one dynamic reply route. All remain pre-owner-gate because their exact self principal is
  // the security boundary; POST collection is lane-only, reply is non-lane-only, GET is dual-scoped.
  '= /api/self/clarifications',
  String.raw`~ /^\/api\/self\/clarifications\/([0-9a-f]{24})\/reply$/`,
  // The result sibling has the same collection split: POST is lane-only (a recognized non-lane,
  // including the steward, gets 409, never 401), while GET is dual-scoped to the caller's exact
  // worker or receiver occupant. Its receiver is derived only through clarificationReceiverFor
  // and no body field can nominate one; the body is the closed three-value status plus length-capped
  // text. The row is report-only: no land, dispatch, auto, Watch or tick gates on its status.
  '= /api/self/fleet-report',
  // The owner-facing twin of the line above, and it is the QUIETEST entry on this list: it writes
  // nothing into any pane and reaches no foreign slot. POST is non-lane-only AND requires the
  // caller to be the current bound MAIN of an active program (programId is derived from that
  // binding, never read from the body); GET returns only rows carrying the caller's exact occupant
  // triple. The answer side — the half that does type into a pane — is owner-gated and lives on
  // /api/attention, deliberately not here.
  '= /api/self/attention',
  '~ /^\\/api\\/self\\/events\\/([a-z0-9]+)\\/ack$/', // same slot+session credential; idempotent receipt only
  '= /api/self/succeed',  // non-lane only: committed HANDOFF → one successor; caller retires on grace
  '= /api/self/retire',   // non-lane only: immediately retire the token's own slot after reporting
  // added 2026-08-07. The widest READ on the every-session tier —
  // it is the only self route whose payload is not this slot's own row but a fleet-wide ledger
  // (the per-check e2e trail). What bounds it: read-only, aggregate (check names, tree shas, run
  // ids — never a check's `detail` and never prose), and it discloses nothing a session could not
  // already read off disk, since `e2e-trail/` sits in the main checkout's common dir that every
  // lane worktree shares. It answers a LANE deliberately — the proof order it replaces is an
  // obligation on lanes — so unlike its neighbours it has no 409 in either direction.
  '= /api/self/flakes',   // same credential, read-only: the flake query over the e2e trail
  '= /api/self/drift',    // same credential, read-only: the lane's own drift view (slot-bound)
  '= /api/self/gate',     // same credential, read-only: the live land-gate facts (env-derived)
  '= /api/self/criterion', // same credential: the lane's PROPOSED done-criterion (slot-bound, owner confirms)
  '= /api/self/verify-intent', // same credential: the lane's advisory gate-phase report (slot-bound)
  // The handler sits before the steward interceptor only so a steward credential meets the same
  // tokenGate 401 as any other non-owner credential. Every matching route calls tokenGate inline
  // before the owner handler; the regex is pinned here as an explicitly reviewed pre-auth shape.
  String.raw`~ /^\/api\/programs(?:\/[^/]+\/(?:confirm|activate|complete|discard|bootstrap-main))?$/`,
  // Same placement and same reason as the Programs regex above, one bracket higher: the Supervisor
  // is cross-program owner identity, so the handler sits before the steward interceptor only so a
  // steward credential meets the same tokenGate 401 as any other non-owner credential. The route
  // calls tokenGate inline before it can mint anything, and it never reads a self-token header —
  // both are pinned as source rules in e2e/pins.ts.
  '= /api/supervisor/bootstrap',
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
  // VERB 2 is the one pair here that is NOT under /api/steward/: the deploy verb and its ledger are
  // the same two functions the owner's routes call, reached by the principal that SEES the gap
  // (deployGap/bundleStale on /api/steward/sessions) and until now could only file a note about it.
  "= /api/deploy", "= /api/deploys",
  "= /api/dispositions", "= /api/steward/autos", "= /api/steward/digest", "= /api/steward/journal",
  "= /api/steward/send", "= /api/steward/sessions", "= /api/steward/tasks",
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
// THE ALIAS GAP. Both functions above key on the literal text `url.pathname`, so a route that
// reads the path under any other name — `const { pathname } = url`, `const p = url.pathname` —
// is invisible to BOTH: it routes, `routeSet` never sees it, `unrecognized` never flags it, and
// the allowlist check passes while an unauthenticated route exists. That is the file's own
// premise (see the header: "every syntactic form that reaches a route must be one the extractor
// recognizes") turned against it, so the alias is banned outright in the pinned regions rather
// than taught to the extractor: one recognized spelling is what makes the pin legible at all.
// Two shapes — the binding itself, and a use in routing position under any other name (in case
// the binding came from elsewhere, e.g. a destructured parameter).
const PATH_ALIAS_BINDING = /(?:const|let|var)\s*(?:\{[^}]*\bpathname\b[^}]*\}\s*=|[A-Za-z_$][\w$]*\s*=\s*url\.pathname)/g;
const PATH_ALIAS_USE = /(?<!\.)\bpathname\b\s*(?:===|!==)|\.(?:exec|test)\(\s*(?!url\.pathname\s*\))[\w$.]*[Pp]ath[\w$]*\s*\)/g;
const pathAliases = (src: string): string[] => [
  ...[...src.matchAll(PATH_ALIAS_BINDING)].map((m) => m[0].trim()),
  ...[...src.matchAll(PATH_ALIAS_USE)].map((m) => m[0].trim()),
];

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
  // the tier-2 adjudication rail's only writer. A judgement on a red audit is EVIDENCE that someone
  // looked, and evidence any principal can forge is worse than none — an empty body answers the
  // owner a side-effect-free 400 (no verdict), so it carries the positive control too.
  { path: "/api/post-land-audits/adjudicate", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/tasks", method: "POST", body: {}, ownerSafe: true },
  // GET /api/tasks serves the full prompt texts (intake mail included) that the 2 s poll no
  // longer carries — a read route, but the most content-bearing one the queue has
  { path: "/api/tasks", method: "GET", ownerSafe: true },
  // Full Program bodies are owner-only. Empty POST is a side-effect-free named 400; GET proves
  // the content-bearing read exists while the principal matrix proves scoped credentials do not.
  { path: "/api/programs", method: "POST", body: {}, ownerSafe: true },
  { path: "/api/programs", method: "GET", ownerSafe: true },
  { path: "/api/dispatch", method: "POST", body: {} },
  // the board editor's pair (§F5). The WRITE route is the only one on this server that puts bytes
  // into a file the caller named, so an auth regression here is not a leak — it is arbitrary code
  // reaching disk. Both answer the owner a side-effect-free 400 on an empty body (no slot), which
  // is what lets them carry the positive control; the containment guards themselves (realpath
  // prefix, the .env/fleet.json refusal, the hash conflict) are proved in fleet-e2e-security.ts §10.
  { path: "/api/file/write", method: "POST", body: {}, ownerSafe: true },
  // the second write route: the owner's drop lands as a FILE inside a session's working directory,
  // so an auth regression here is the same class of thing. An empty JSON body names no active slot,
  // so the owner's own call is a side-effect-free 400 and carries the positive control.
  { path: `/api/slots/${slot}/upload`, method: "POST", body: {}, ownerSafe: true },
  { path: "/api/tree", method: "GET", ownerSafe: true },
  { path: "/api/sessions", method: "GET", ownerSafe: true },
  { path: "/api/audit", method: "GET", ownerSafe: true },
  { path: "/api/prompts", method: "GET", ownerSafe: true },
  { path: "/api/steward/token", method: "GET", ownerSafe: true },
  { path: "/api/lanes", method: "POST", body: {}, ownerSafe: true },
];
// The task-scoped + guest surface (2026-08-05): these routes sat outside the matrix and were
// protected only by §1's structural pin (tokenGate last in the chain). §2 is the mechanism that
// catches a handler regressing to its own weaker inline check — the way /api/dispositions already
// special-cases one principal inline — and it was silent on exactly the newest clarify-adjacent
// surface. `fix` is a DONE fixture task: criterion-confirm / reanalyse / brief / dispatch answer a
// side-effect-free 409 to the owner (proving the route exists) and must answer 401/403 to every
// other principal. The mutating task actions and the guest routes ride matrix-only (no ownerSafe
// control), same stance as /api/dispatch.
const taskSurface = (fix: string): Probe[] => [
  { path: `/api/tasks/${fix}/criterion-confirm`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/tasks/${fix}/reanalyse`, method: "POST", body: {}, ownerSafe: true },
  // the brief is a PROMPT a lane will execute — an unauthenticated write here would be arbitrary
  // remote code execution through the back door, so it belongs on this matrix more than most
  { path: `/api/tasks/${fix}/brief`, method: "POST", body: { text: "probe" }, ownerSafe: true },
  { path: `/api/tasks/${fix}/dispatch`, method: "POST", body: {}, ownerSafe: true },
  // ↻ refine spawns a repo-reading agent and refine-confirm mints task rows — both answer the
  // owner a side-effect-free 409 on this DONE fixture (wrong status / no proposal), so both can
  // carry the positive control while every other principal must be denied outright
  { path: `/api/tasks/${fix}/refine`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/tasks/${fix}/refine-confirm`, method: "POST", body: {}, ownerSafe: true },
  { path: `/api/tasks/${fix}/adopt`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/queue`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/archive`, method: "POST", body: {} },
  { path: `/api/tasks/${fix}/delete`, method: "POST", body: {} },
  // a read, not a write, and on the matrix for what it READS: an error message quotes filesystem
  // paths and git output off the owner's own machine, so it belongs to the owner alone. GET with
  // no side effect at all, which makes it the cheapest possible positive control.
  { path: "/api/errors", method: "GET", ownerSafe: true },
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
  // The pin's blind spot, closed and then PROVEN blind: a destructured route is a working route
  // that neither `routeSet` nor `unrecognized` can see. The negative control is the point — if
  // this ever passes without the alias detector firing, the detector has stopped working and the
  // two checks below it would go quietly vacuous.
  const ALIAS_PROBE = 'const { pathname } = url;\n  if (pathname === "/api/back-door") return json({ ok: true });';
  check("§1 the alias detector fires on a destructured route that both older extractors are blind to",
    pathAliases(ALIAS_PROBE).length > 0 && routeSet(ALIAS_PROBE).length === 0 && unrecognized(ALIAS_PROBE).length === 0,
    `aliases=[${pathAliases(ALIAS_PROBE).join(" | ")}] routes=[${routeSet(ALIAS_PROBE).join(" | ")}] stray=[${unrecognized(ALIAS_PROBE).join(" | ")}]`);
  const preAlias = pathAliases(preAuth);
  check("§1 the pre-auth region routes on `url.pathname` only — no alias the allowlist pin cannot see",
    preAlias.length === 0, preAlias.join(" | "));
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
  const stewAlias = pathAliases(stewSrc);
  check("§1 the steward principal's route set equals the reviewed allowlist, in a form the extractor reads",
    stewStray.length === 0 && stewAlias.length === 0 && stewFound.join("\n") === [...STEWARD_ROUTES].sort().join("\n"),
    `stray: [${stewStray.join(" | ")}] alias: [${stewAlias.join(" | ")}] unexpected: [${stewFound.filter((r) => !STEWARD_ROUTES.includes(r)).join(", ")}]`);
  // the steward gate is default-deny: an unmatched path must fall to a 403, never to the owner
  // chain below it. If this `?? json(…403)` ever becomes a fallthrough, every owner route opens.
  check("§1 the steward gate ends in a default-deny (an unmatched path 403s, never falls through)",
    /const r = await handleStewardRoute\(req, url\);\s*\n\s*return r \?\? json\(\{ error: "steward token: route not in scope" \}, 403\);/.test(src));

  // ===== §2 the non-owner principals × the dangerous owner surface =====
  const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const idle = sess.slots.find((s) => !s.cwd);
  check("§2 an idle slot is available as the matrix's blast-radius-free target", !!idle, JSON.stringify(sess.slots.map((s) => s.id + (s.cwd ? "*" : ""))));
  // a DONE task as the matrix's task-scoped fixture — every ownerSafe probe on it answers 409
  // before any mutation (no criterion, no verdict, not pending/queued), so the owner control
  // proves existence without touching state
  const fixT = (await (await post("/api/tasks", { text: "sec-matrix-fixture", queue: false })).json()) as { task: { id: string } };
  await post(`/api/tasks/${fixT.task.id}/done`, {});
  const probes = [...dangerous(idle?.id ?? 16), ...taskSurface(fixT.task.id)];
  // A scoped self credential, taken from state rather than a pane probe (deterministic, and it is
  // the same string the pane exports — server.ts reads it from exactly here). SLOT 2 BY NAME, and
  // that name is the point: it is a PLAIN (non-lane) session, and since 2026-08-07 its pane carries
  // this credential too (see the self family's note in PRE_AUTH_ROUTES). The widening handed a real
  // Fleet token to sessions that can never land, so the whole dangerous owner surface is fired
  // against one — an escalation shows up here as a status that is neither 401 nor 403.
  //
  // This used to read `Object.values(slots).map(s => s.selfToken).find(Boolean)` under the name "a
  // lane selfToken", which was a mislabel: state keys are slot ids, so it returned whichever slot
  // sorted first and was active — empirically slot 2, the plain one. Nothing is lost by naming it,
  // because the matrix asserts a property of the credential CLASS (the owner gate never honours a
  // self token, whoever holds it); a real LANE's token is exercised against the self routes it CAN
  // reach in §3 below and throughout e2e/self-token.ts.
  const plainSelf = await selfTokenOf(2);
  check("§2 fixtures: a PLAIN session's selfToken and a real guest cookie are available as principals",
    /^[0-9a-f]{32}$/.test(plainSelf) && /^share_[0-9a-f]+=/.test(ctx.shICookie),
    `plain=${plainSelf.slice(0, 8)}… cookie=${ctx.shICookie.slice(0, 16)}…`);
  const principals: { name: string; headers: Record<string, string> }[] = [
    { name: "no credential", headers: {} },
    { name: "an unknown bearer token", headers: { authorization: "Bearer 00000000000000000000000000000000" } },
    { name: "a guest share cookie", headers: { cookie: ctx.shICookie } },
    { name: "a plain session's selfToken offered as the owner token", headers: { authorization: `Bearer ${plainSelf}` } },
    { name: "a plain session's selfToken in its own header", headers: { "x-fleet-self-token": plainSelf } },
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
  await post(`/api/tasks/${fixT.task.id}/delete`, {}); // the task-surface fixture, retired

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
    ["journal", sc.stewGet("/api/steward/journal?tail=5")],
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

  // ===== §6 the model/effort charset is per HARNESS, and every adapter's is an allowlist =====
  // Every spawn option is interpolated into a tmux shell line, so each adapter widening the
  // charset re-opens the same question rather than inheriting an answer. `'` is THE character:
  // it is the one that can terminate the single-quoted word the whole scheme rests on. A space or
  // `;` would split the line; `*` is admitted on purpose and is exactly why the quotes are not
  // decoration (zsh aborts an unmatched glob and takes the pane with it).
  //
  // This suite runs under FLEET_CMD=true — an UNDECLARED command — so the DEFAULT adapter here is
  // judged by MODEL_RE. That is the counter-proof half: a per-slot harness must not have widened
  // the charset for slots that never asked for one. (The live-agent half — that a declared foreign
  // harness's models reach a real pane and the agent survives — is fleet-e2e-harness.ts, phase 2 of
  // ./e2e-claude-gate.sh, and is not duplicated here.)
  // a slot no other module touches: §6 recycles it repeatedly and asserts on the PANE's command
  // line, so a fixture another section left behind would be read as this section's result
  const HARNESS_SLOT = 10;
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {}); // ensure it is free before the first open
  const cat = (await (await get("/api/harnesses")).json()) as
    { harnesses: { id: string; default: boolean; automatable: boolean; allowsLanes: boolean; singleton: boolean; role?: string; supports: { transcript: boolean; effort: boolean; resume: boolean; model: boolean; selfSchedule: boolean; container: boolean }; effortLevels: string[]; note: string | null }[];
      defaultModel?: string };
  const pi = cat.harnesses.find((h) => h.id === "pi");
  const piZai = cat.harnesses.find((h) => h.id === "pi-zai");
  const piHost = cat.harnesses.find((h) => h.id === "pi-unfenced");
  const def = cat.harnesses.find((h) => h.default);
  check("§6 the catalogue names the default and all three explicit Pi-family adapters",
    !!pi && !!piZai && !!piHost && !!def && def.id === "claude", cat.harnesses.map((h) => h.id).join(","));
  check("§6 pi-unfenced is attended, main-only and singleton — the exception cannot become a pool",
    piHost?.automatable === false && piHost.allowsLanes === false && piHost.singleton === true
    && /UNFENCED/.test(piHost.note ?? "") && /unrestricted filesystem writes, git and network/.test(piHost.note ?? ""),
    JSON.stringify(piHost));
  // the caveat is part of the contract, not a UI string: an owner picks this harness from it, and
  // since 2026-08-12 what it must state is the REACH, not a fence — full local access is the
  // normal mode, so a note still promising a write fence would be the concealment now.
  const piNote = pi?.note ?? "";
  check("§6 the pi adapter names its full local reach at pick time, and claims no fence",
    /full local access/.test(piNote) && /git\/commit/.test(piNote) && /network/.test(piNote)
    && !/fence/.test(piNote), piNote);

  // TWO AXES, NOT ONE. `container` answers "where does this run"; claude/pi/codex answer "what am
  // I working with". They shared one field until 2026-08-10, so the picker listed the hull in the
  // harness dropdown as a peer of claude — and `codex in a box` could not be expressed at all. The
  // catalogue now PUBLISHES which is which instead of leaving the client to infer it from the id,
  // and that is the whole point of asserting it here: the client filters on this field, so a
  // harness added later without a role would silently become an agent choice.
  const places = cat.harnesses.filter((h) => h.role === "place").map((h) => h.id);
  const agents = cat.harnesses.filter((h) => h.role === "agent").map((h) => h.id);
  check("§6 every catalogue entry declares an axis — agent (what) or place (where), none unlabelled",
    places.length + agents.length === cat.harnesses.length,
    cat.harnesses.map((h) => `${h.id}:${h.role ?? "MISSING"}`).join(","));
  check("§6 the container hull is the only PLACE, and all five selectable agent modes are agents",
    places.join(",") === "container"
    && ["claude", "pi", "pi-zai", "pi-unfenced", "codex"].every((id) => agents.includes(id)),
    `places=${places.join(",")} agents=${agents.join(",")}`);
  // the inverse, which is what makes the pair meaningful: a `place` is exactly the entry that runs
  // something somewhere else, so it is also the only one carrying supports.container. If these two
  // ever disagree the axis label is decoration rather than the fact the client filters on.
  check("§6 place and supports.container name the SAME entry — the label is not decoration",
    cat.harnesses.every((h) => (h.role === "place") === h.supports.container),
    cat.harnesses.map((h) => `${h.id}:${h.role}/${h.supports.container}`).join(","));
  // the picker shows this as the model field's placeholder, so "leave it empty" is a visible
  // choice. A missing value would silently degrade to the word "default" and hide the real id.
  check("§6 the catalogue publishes what an empty model launches on the default adapter",
    typeof cat.defaultModel === "string" && cat.defaultModel.length > 0, String(cat.defaultModel));

  // --- the quote, per adapter. Rejected BEFORE it can reach a shell line, both times.
  for (const h of ["pi", "pi-zai", "pi-unfenced", "claude", "codex"]) {
    const q = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: h, model: "a/b'c" });
    check(`§6 harness ${h} rejects a model carrying a single quote (400)`, q.status === 400, String(q.status));
  }
  // --- ...and the shapes the WIDER charset exists for are still refused on the default adapter.
  for (const bad of ["claude-bridge/claude-haiku-4-5", "sonnet:high", "anthropic/*"]) {
    const r = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, model: bad });
    check(`§6 the default adapter still rejects the foreign model shape ${bad} (400)`, r.status === 400, String(r.status));
  }
  // --- the glob DOES reach a pi pane, and it reaches it SHELL-QUOTED. A deliberately unresolvable
  // provider: this asserts the spawn STRING (what tmux was told to run), which is recorded whether
  // or not `pi` is installed here — so the pin is about the quoting and nothing else.
  const GLOB = "e2e-probe/*";
  const og = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi", model: GLOB, effort: "low" });
  check("§6 a pi slot accepts a glob model and an effort level (200)", og.ok, String(og.status));
  const gcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6 the pi spawn line quotes the glob model (an unquoted one aborts the pane under zsh)",
    gcmd.includes(`--model '${GLOB}'`), gcmd.slice(-160));
  check("§6 the pi spawn line pins a session id (--session-id is create-or-attach: it IS the resume path)",
    /--session-id [0-9a-f-]{36}\b/.test(gcmd), gcmd.slice(-160));
  check("§6 the pi spawn line carries the effort level as --thinking", gcmd.includes("--thinking low"), gcmd.slice(-160));
  check("§6 ...and it spawns pi, not the fleet's FLEET_CMD", /(^|\s|;)pi --session-id/.test(gcmd), gcmd.slice(-160));

  // The fence this section used to EXECUTE here (extract the SBPL profile off the spawn line, run
  // it over /usr/bin/true, prove the three write rows) is retired by the 2026-08-12 owner
  // decision: full local access is the normal operating mode, so the security property FLIPS from
  // "the profile fences" to "no fence machinery reappears on the spawn line". A re-grown fence
  // would silently re-route lane commits through host rescue — that is the regression this now
  // guards against.
  const gcmdFlat = gcmd.replaceAll("\\", "");
  check("§6 the pi spawn line carries no sandbox machinery — full access is the deliberate contract",
    !gcmdFlat.includes("sandbox-exec") && !gcmdFlat.includes("FLEET_PI_SB"), gcmdFlat.slice(-200));

  // pi-unfenced now shares normal pi's access; what it still pins is POLICY: main-only,
  // singleton, attended. Assert both halves — the command runs bare, and the server refuses the
  // two ways the stricter shape could silently become broader.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const uf = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-unfenced", effort: "low" });
  check("§6 pi-unfenced opens as an attended main session", uf.ok, String(uf.status));
  const ucmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out.replaceAll("\\", "");
  check("§6 pi-unfenced starts Pi without sandbox-exec (the warning describes real host power)",
    /(^|;)\s*(?:export [^;]+;\s*)*pi --session-id/.test(ucmd) && !ucmd.includes("sandbox-exec"), ucmd.slice(-220));
  const UF_OTHER = 12;
  await post(`/api/slots/${UF_OTHER}/kill`, {});
  const secondUf = await post(`/api/slots/${UF_OTHER}/open`, { cwd: REPO, harness: "pi-unfenced" });
  const secondUfJ = (await secondUf.json()) as { error?: string };
  check("§6 pi-unfenced is singleton at the server boundary",
    secondUf.status === 400 && secondUfJ.error === "harness pi-unfenced permits only one active slot",
    `${secondUf.status} ${secondUfJ.error ?? ""}`);
  const laneUf = await post(`/api/slots/${UF_OTHER}/open-worktree`, { repo: REPO, harness: "pi-unfenced" });
  const laneUfJ = (await laneUf.json()) as { error?: string };
  check("§6 pi-unfenced refuses lanes before creating a working copy",
    laneUf.status === 400 && laneUfJ.error === "harness pi-unfenced is main-session only — it cannot open a lane",
    `${laneUf.status} ${laneUfJ.error ?? ""}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  await post(`/api/slots/${UF_OTHER}/kill`, {});

  // --- effort is a CLOSED SET, not a charset: nothing outside it can reach the line at all, and a
  // harness without the concept refuses one rather than accepting a flag it will silently drop.
  const be = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi", effort: "low; rm -rf /" });
  check("§6 a pi effort outside the declared level set is rejected (400)", be.status === 400, String(be.status));
  const ce = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, effort: "high" });
  check("§6 the default adapter refuses an effort it has no flag for, rather than dropping it (400)",
    ce.status === 400, String(ce.status));

  // ▸ start is its own spawn reader, so repeat both effort rejections at that boundary rather
  // than inferring them from /open. The error TEXT is part of the contract: a generic 400 could
  // come from the task, repo or capacity checks and would not prove effortOf judged the request.
  const deT = await post("/api/tasks", { text: "dispatch-effort-rejection-probe", queue: false });
  const deId = ((await deT.json()) as { task?: { id: string } }).task?.id ?? "";
  check("§6 dispatch-effort fixture: a pending task exists for rejection probes", deT.ok && !!deId,
    `${deT.status} id=${deId || "missing"}`);
  if (deId) {
    const badDispatchEffort = await post(`/api/tasks/${deId}/dispatch`,
      { harness: "pi", effort: "high; id" });
    const badDispatchJ = (await badDispatchEffort.json()) as { error?: string };
    const piEffortErr = `bad effort (one of: ${pi?.effortLevels.join(", ") ?? ""})`;
    check("§6 ▸ start rejects a pi effort outside effortLevels with effortErrFor's exact text",
      badDispatchEffort.status === 400 && badDispatchJ.error === piEffortErr,
      `${badDispatchEffort.status} ${JSON.stringify(badDispatchJ)}`);

    const noEffortHarness = await post(`/api/tasks/${deId}/dispatch`,
      { harness: "container", effort: "high" });
    const noEffortJ = (await noEffortHarness.json()) as { error?: string };
    check("§6 ▸ start rejects effort on a harness without the capability with effortErrFor's exact text",
      noEffortHarness.status === 400 && noEffortJ.error === "harness container takes no effort",
      `${noEffortHarness.status} ${JSON.stringify(noEffortJ)}`);
    await post(`/api/tasks/${deId}/delete`, {});
  }

  const uh = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "opencode" });
  check("§6 an unregistered harness is refused (400) — the registry is an allowlist too", uh.status === 400, String(uh.status));

  // --- the transcript degradation, proven where it actually bites. The slot's cwd is REPO, which
  // this suite has had claude-less sessions in; what matters is that transcriptFile's newest-by-
  // mtime FALLBACK is not consulted for a harness that writes no claude transcript. Its `source`
  // is the observable: null means "no transcript", and for a pi slot it must be null ALWAYS,
  // never "whatever .jsonl happened to be newest in this directory". The unfenced-policy probes
  // above deliberately killed their slot, so establish this probe's own Pi precondition explicitly
  // instead of letting an inactive-slot error masquerade as a transcript regression.
  const tpOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" });
  check("§6 transcript fixture: a fenced Pi slot is active before its degradation is measured",
    tpOpen.ok, String(tpOpen.status));
  const tp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6 a pi slot reports NO transcript source (the mtime fallback must not hand it a stranger's conversation)",
    tp.source === null && tp.entries.length === 0, `${String(tp.source)} / ${tp.entries.length}`);

  // --- the SEPARATE context reader. Keep transcript=false above: this fact comes from Pi's own
  // host-side usage file, identity-pinned by cwd + session UUID, and enables no conversation view.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const piCtxOpen = await post(`/api/slots/${HARNESS_SLOT}/open`,
    { cwd: REPO, harness: "pi", model: "openai-codex/gpt-5.6-sol" });
  check("§6 ctx fixture: a Pi GPT slot opens for the usage-file probe", piCtxOpen.ok, String(piCtxOpen.status));
  const piCtxCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  const piSid = piCtxCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  check("§6 ctx fixture: the probe has the pinned Pi session UUID it must identify",
    /^[0-9a-f-]{36}$/.test(piSid), piCtxCmd.slice(-160));
  // REALPATH, because that is where pi itself writes: it is a node process and `process.cwd()`
  // returns the physical path, so a slot opened on $TMPDIR (a symlink on macOS) produces a
  // `--private-var-folders-…--` slug. Deriving this fixture from the RAW REPO was this check's own
  // first red — it planted the file in a directory pi would never use, and the failure then read
  // like "the reader is broken" while nothing had been measured. It also exposed the same blind spot
  // in the reader itself, which is the finding this row exists to protect.
  const piSessionDir = `${process.env.HOME}/.pi/agent/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
  mkdirSync(piSessionDir, { recursive: true });
  const matchingPiFiles = (): string[] => readdirSync(piSessionDir)
    .filter((n) => n.endsWith(`_${piSid}.jsonl`)).map((n) => `${piSessionDir}/${n}`);
  for (const file of matchingPiFiles()) rmSync(file, { force: true });
  check("§6 ctx fixture: the pinned Pi session has NO readable file before the absence probe",
    piSid !== "" && matchingPiFiles().length === 0, matchingPiFiles().join(","));
  type PiFill = { usedTokens: number; windowTokens: number; pct: number } | null;
  const piFill = async (): Promise<PiFill> => {
    const sx = (await (await get("/api/sessions")).json()) as { slots: { id: number; ctx: PiFill }[] };
    return sx.slots.find((s) => s.id === HARNESS_SLOT)?.ctx ?? null;
  };
  check("§6 Pi context absence stays absence: no readable session yields ctx=null, never 0%",
    await piFill() === null);

  // the header carries the PHYSICAL path, because that is what pi records: it is a node process and
  // `process.cwd()` resolves symlinks. Writing the raw REPO here was this fixture's second red — the
  // file then sat in the right directory under the right UUID and was still rejected by the header
  // check, which is indistinguishable from "the reader is broken" unless you look at the row. A
  // fixture that does not model what the real producer writes cannot prove anything about the reader.
  const session = JSON.stringify({ type: "session", version: 3, id: piSid,
    timestamp: "2026-08-08T00:00:00.000Z", cwd: realpathSync(REPO) });
  const piFile = `${piSessionDir}/2026-08-08T00-00-00.000Z_${piSid}.jsonl`;
  const piDuplicate = `${piSessionDir}/2026-08-08T00-00-01.000Z_${piSid}.jsonl`;
  writeFileSync(piFile, `${session}\n`);
  writeFileSync(piDuplicate, `${session}\n`);
  check("§6 ctx fixture: two independently readable files claim the same cwd + pinned UUID",
    existsSync(piFile) && existsSync(piDuplicate));
  check("§6 ambiguous Pi identity stays absent (two matching files are never resolved by mtime)",
    await piFill() === null);
  rmSync(piDuplicate, { force: true });
  const older = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1, output: 9_000_000, cacheRead: 2, cacheWrite: 3, reasoning: 4, totalTokens: 9_000_006 } } });
  const newest = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1_167, output: 585, cacheRead: 51_712, cacheWrite: 0, reasoning: 116, totalTokens: 53_464 } } });
  const trailing = JSON.stringify({ type: "message", message: { role: "user", content: "tail" } });
  writeFileSync(piFile, `${session}\n${older}\n${newest}\n${trailing}\n`);
  check("§6 ctx fixture: exactly one cwd+UUID-pinned Pi usage file remains",
    matchingPiFiles().length === 1 && matchingPiFiles()[0] === piFile, matchingPiFiles().join(","));
  let measured: PiFill = null;
  for (let i = 0; i < 20 && measured === null; i++) {
    measured = await piFill();
    if (measured === null) await Bun.sleep(100);
  }
  check("§6 Pi context reads newest input+cache usage, excludes completion, and uses 258,400 effective",
    measured?.usedTokens === 52_879 && measured.windowTokens === 258_400 && measured.pct === 20.5,
    JSON.stringify(measured));
  rmSync(piFile, { force: true });

  // --- §6a PI-ZAI: one provider/model, one process-local Pi home, and no key bytes in tmux. ---
  check("§6a pi-zai publishes the closed measured capability set",
    piZai?.automatable === false && piZai.allowsLanes === true && piZai.singleton === false
    && piZai.supports.resume === true && piZai.supports.transcript === false
    && piZai.supports.model === true && piZai.supports.effort === true
    && piZai.supports.selfSchedule === false && piZai.supports.container === false
    && JSON.stringify(piZai.effortLevels) === JSON.stringify(["low", "high", "max"]),
    JSON.stringify(piZai));
  check("§6a pi-zai's picker note names fixed zai/glm-5.3, the default key path, local reach and isolated Pi home",
    /zai\/glm-5\.3/.test(piZai?.note ?? "")
      && /~\/\.config\/claude-fleet\/secrets\/zai-coding-plan\.key/.test(piZai?.note ?? "")
      && /full local reach/.test(piZai?.note ?? "") && /~\/\.pi untouched/.test(piZai?.note ?? ""),
    piZai?.note ?? "missing");

  // Every request boundary that accepts a harness/model/effort tuple must apply this adapter's
  // exact model regexp and effort allowlist before any pane or worktree can be created.
  const pzRejectTask = await post("/api/tasks", { text: "pi-zai-rejection-probe", queue: false });
  const pzRejectTaskId = ((await pzRejectTask.json()) as { task?: { id?: string } }).task?.id ?? "";
  check("§6a pi-zai rejection fixture has a pending attended-dispatch task",
    pzRejectTask.ok && !!pzRejectTaskId, `${pzRejectTask.status} id=${pzRejectTaskId || "missing"}`);
  const pzRejectSurfaces = [
    ["open", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, ...body })],
    ["open-worktree", (body: Record<string, unknown>) => post(`/api/slots/${HARNESS_SLOT}/open-worktree`, { repo: REPO, ...body })],
    ["lanes", (body: Record<string, unknown>) => post("/api/lanes", { repo: REPO, ...body })],
    ["dispatch", (body: Record<string, unknown>) => post(`/api/tasks/${pzRejectTaskId}/dispatch`, body)],
  ] as const;
  if (pzRejectTaskId) {
    for (const [surface, call] of pzRejectSurfaces) {
      const wrongModel = await call({ harness: "pi-zai", model: "glm-5.2" });
      check(`§6a ${surface} rejects any pi-zai model except exact glm-5.3 (400)`,
        wrongModel.status === 400, String(wrongModel.status));
      const wrongEffort = await call({ harness: "pi-zai", effort: "medium" });
      check(`§6a ${surface} rejects pi-zai effort outside low/high/max (400)`,
        wrongEffort.status === 400, String(wrongEffort.status));
    }
    await post(`/api/tasks/${pzRejectTaskId}/delete`, {});
  }

  const zaiAgentDir = process.env.FLEET_PI_ZAI_AGENT_DIR ?? "";
  const zaiKeyFile = process.env.FLEET_PI_ZAI_KEY_FILE ?? "";
  const zaiStandIn = "fleet-e2e-zai-stand-in-key";
  const zaiModels = '{"providers":{"zai":{"models":[{"id":"glm-5.3","name":"GLM-5.3","contextWindow":1000000,"maxTokens":131072,"reasoning":true,"thinkingLevelMap":{"off":null,"minimal":null,"low":"low","medium":null,"high":"high","xhigh":null,"max":"max"}}]}}}\n';
  const globalPiModels = `${process.env.HOME}/.pi/agent/models.json`;
  check("§6a pi-zai fixture uses scratch overrides for both external paths",
    realpathSync(zaiAgentDir).startsWith(realpathSync(ROOT) + "/")
      && realpathSync(zaiKeyFile).startsWith(realpathSync(ROOT) + "/"),
    `${zaiAgentDir} / ${zaiKeyFile}`);
  check("§6a global ~/.pi/agent/models.json is absent before the isolated adapter probe",
    !existsSync(globalPiModels), globalPiModels);
  if (zaiAgentDir && zaiKeyFile) {
    mkdirSync(zaiAgentDir, { recursive: true });
    writeFileSync(zaiKeyFile, `${zaiStandIn}\n`);
  }
  const paneComms = async (target: string): Promise<string[]> => {
    const panePid = Number((await tmuxOut("display-message", "-p", "-t", target, "#{pane_pid}")).out);
    if (!panePid) return [];
    const children = spawnSync("pgrep", ["-P", String(panePid)], { encoding: "utf8" }).stdout
      .split("\n").filter(Boolean);
    return [String(panePid), ...children].map((pid) =>
      spawnSync("ps", ["-o", "comm=", "-p", pid], { encoding: "utf8" }).stdout.trim().split("/").pop() ?? "")
      .filter(Boolean);
  };
  const waitForPi = async (target: string): Promise<string[]> => {
    let comms: string[] = [];
    for (let i = 0; i < 40; i++) {
      comms = await paneComms(target);
      if (comms.includes("pi")) break;
      await Bun.sleep(100);
    }
    return comms;
  };
  const waitForModels = async (): Promise<string> => {
    let text = "";
    for (let i = 0; i < 40; i++) {
      try { text = readFileSync(`${zaiAgentDir}/models.json`, "utf8"); } catch { text = ""; }
      if (text === zaiModels) break;
      await Bun.sleep(100);
    }
    return text;
  };

  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const pzOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai", effort: "high" });
  check("§6a a pi-zai slot opens without a model pin (the adapter owns the fixed default)",
    pzOpen.ok, String(pzOpen.status));
  const pzCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  check("§6a pi-zai spawn pins provider/model/session/effort and the process-local agent home",
    pzCmd.includes("pi --provider zai --model 'glm-5.3'")
      && /--session-id [0-9a-f-]{36}\b/.test(pzCmd) && pzCmd.includes("--thinking high")
      && pzCmd.includes(`PI_CODING_AGENT_DIR='${zaiAgentDir}'`), pzCmd.slice(-320));
  check("§6a pane_start_command contains $(cat key-path), never the stand-in key bytes",
    pzCmd.includes(`ZAI_API_KEY="$(cat '${zaiKeyFile}')"`) && !pzCmd.includes(zaiStandIn),
    pzCmd.slice(-320));
  check("§6a the controlled Pi stand-in really started after the key guard",
    (await waitForPi(`s${HARNESS_SLOT}`)).includes("pi"));
  check("§6a models.json is the exact one-entry GLM-5.3 catalogue in the scratch agent directory",
    await waitForModels() === zaiModels, `${zaiAgentDir}/models.json`);
  check("§6a creating the pi-zai catalogue does not create global ~/.pi/agent/models.json",
    !existsSync(globalPiModels), globalPiModels);

  // A second spawn repairs drift back to the exact catalogue rather than appending duplicates.
  writeFileSync(`${zaiAgentDir}/models.json`, "{}\n");
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  const pzAgain = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai", effort: "max" });
  const pzAgainCmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}"))
    .out.replaceAll("\\", "");
  const pzSid = pzAgainCmd.match(/--session-id ([0-9a-f-]{36})\b/)?.[1] ?? "";
  check("§6a repeated pi-zai spawn idempotently restores the exact catalogue",
    pzAgain.ok && await waitForModels() === zaiModels, `${pzAgain.status} / ${zaiAgentDir}/models.json`);

  // The context hook reads the relocated Pi session and the model-less slot still gets GLM-5.3's
  // exact denominator because that model is literal in every pi-zai spawn command.
  const zaiSessionDir = `${zaiAgentDir}/sessions/--${realpathSync(REPO).replace(/^\/+/, "").replaceAll("/", "-")}--`;
  mkdirSync(zaiSessionDir, { recursive: true });
  const zaiSession = JSON.stringify({ type: "session", version: 3, id: pzSid,
    timestamp: "2026-08-15T00:00:00.000Z", cwd: realpathSync(REPO) });
  const zaiUsage = JSON.stringify({ type: "message", message: { role: "assistant",
    usage: { input: 1_167, output: 585, cacheRead: 51_712, cacheWrite: 0, reasoning: 116, totalTokens: 53_464 } } });
  const zaiSessionFile = `${zaiSessionDir}/2026-08-15T00-00-00.000Z_${pzSid}.jsonl`;
  writeFileSync(zaiSessionFile, `${zaiSession}\n${zaiUsage}\n`);
  let zaiMeasured: PiFill = null;
  for (let i = 0; i < 20 && zaiMeasured === null; i++) {
    zaiMeasured = await piFill();
    if (zaiMeasured === null) await Bun.sleep(100);
  }
  check("§6a pi-zai context reads its relocated Pi JSONL and uses the exact 1M GLM-5.3 window",
    zaiMeasured?.usedTokens === 52_879 && zaiMeasured.windowTokens === 1_000_000 && zaiMeasured.pct === 5.3,
    JSON.stringify(zaiMeasured));
  rmSync(zaiSessionFile, { force: true });

  // Missing and empty are separate shell predicates. Both must fail as themselves in the pane and
  // leave only the fallback shell — no provider/model fallback and no Pi process to accept input.
  const keyGuardProbe = async (kind: "missing" | "empty"): Promise<void> => {
    await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
    if (kind === "missing") rmSync(zaiKeyFile, { force: true });
    else writeFileSync(zaiKeyFile, "");
    const opened = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi-zai" });
    let pane = "";
    for (let i = 0; i < 40; i++) {
      pane = (await tmuxOut("capture-pane", "-p", "-t", `s${HARNESS_SLOT}`)).out;
      if (pane.includes(zaiKeyFile)) break;
      await Bun.sleep(100);
    }
    const comms = await paneComms(`s${HARNESS_SLOT}`);
    check(`§6a ${kind} key file prints a loud path-specific error and never starts Pi`,
      opened.ok && pane.includes("pi-zai: missing or empty Z.ai Coding Plan key file:")
        && pane.includes(zaiKeyFile) && !comms.includes("pi"),
      `${opened.status} / ${pane.slice(-220)} / comms=${comms.join(",")}`);
  };
  await keyGuardProbe("missing");
  await keyGuardProbe("empty");
  writeFileSync(zaiKeyFile, `${zaiStandIn}\n`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6a all pi-zai probes leave global ~/.pi/agent/models.json absent",
    !existsSync(globalPiModels), globalPiModels);

  const piProbeOpen = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" });
  check("§6b fixture: a Pi slot is active before the per-slot liveness cache is measured",
    piProbeOpen.ok, String(piProbeOpen.status));

  // --- §6b THE PROBE IS PER SLOT, and this fleet is the sharpest place to prove it: FLEET_CMD is
  // `true`, an UNDECLARED command, so HARNESS_COMMS is empty and every default-adapter slot takes
  // the "unprobed" waiver. A pi slot declares its comms through the ADAPTER, so it is genuinely
  // probed — and since `pi` is not running in that pane, it answers "no-agent". Before the per-slot
  // probe BOTH read "unprobed" (the fleet-wide empty set short-circuits paneAgentAt), so the two
  // rows below cannot both pass unless the resolution really moved from the fleet to the slot.
  // The agent field is a TICK cache, hence the bounded poll rather than a single read.
  // Reads the SETTLED value, not the first non-null one — and that is not belt-and-braces, it is the
  // documented contract: `agent` is a git-TICK cache ("Bericht, nie Gate"), the tick awaits
  // paneAgentAt per slot, and a tick already in flight when a slot is killed and reopened can write
  // the PREVIOUS occupant's answer after the reopen. Measured: this row read `no-agent` (the pi-era
  // value) on a slot that had just become default again. So: wait for a first answer, then let one
  // full tick interval pass and take the second. A stale value cannot survive that; a genuinely
  // wrong one is unaffected, which is what keeps the row a real assertion.
  const GIT_TICK_MS = 10_000; // server.ts: setInterval(tickGit, 10_000)
  const agentOf = async (slot: number): Promise<string | null> => {
    const read = async (): Promise<string | null> => {
      const sx = (await (await get("/api/sessions")).json()) as { slots: { id: number; agent: string | null }[] };
      return sx.slots.find((x) => x.id === slot)?.agent ?? null;
    };
    let first: string | null = null;
    for (let i = 0; i < 60 && first === null; i++) { first = await read(); if (first === null) await Bun.sleep(200); }
    if (first === null) return null;
    await Bun.sleep(GIT_TICK_MS + 1000);
    return await read();
  };
  // The assertion is "genuinely probed", NOT a specific verdict: whether the answer is `alive` or
  // `no-agent` depends on whether `pi` happens to be installed on the machine running the suite,
  // and §6 above says why that must never decide a row. `unprobed` is the only answer that proves
  // the probe did NOT happen — it is what the fleet-wide empty set returns by short-circuit — so
  // "not unprobed" is exactly the discriminator and nothing more.
  const piAgent = await agentOf(HARNESS_SLOT);
  check("§6b a pi slot is genuinely PROBED (adapter-declared comms), not waived like the undeclared FLEET_CMD",
    piAgent !== null && piAgent !== "unprobed", String(piAgent));
  // the counter-case, and it is what makes the row above about the SLOT rather than a blanket
  // strictness: a default-adapter slot on the same fleet still takes the undeclared waiver.
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6b fixture: the same slot reopens on the default harness", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const defAgent = await agentOf(HARNESS_SLOT);
  check("§6b ...while a default-adapter slot keeps the unprobed waiver (agent=unprobed)",
    defAgent === "unprobed", String(defAgent));

  // --- §6c THE POLICY, which is a DIFFERENT question from the probe and stays closed by default:
  // may an unattended path drive a foreign-harness slot? FLEET_HARNESS_AUTOMATION is off here (the
  // suite sets nothing), so the answer is no — and the refusal must NAME the harness instead of
  // reporting a generic not-idle/quiet-hours, because being skipped silently was the expensive half
  // of the defect this closes. Asserted through the steward send, the one gated path with a
  // synchronous error body; the auto/watch paths carry the same reason in their lastResult.
  // Driven through a scheduled AUTO rather than a steward send: same choke-point (canDeliver), no
  // steward token or kind vocabulary in the way, and it exercises the REPORTING too — the refusal
  // has to land in the auto's own lastResult, which is where an owner would actually read it.
  // The auto text is a shell no-op (`:`) on purpose: if a gate ever wrongly opened, what reaches
  // the pane is a bare shell, and this must not be the row that runs something there.
  // `inSec: 1`, not 0: a one-shot with inSec < 1 is refused 400 ("one-shot needs inSec ≥ 1"), and
  // the first version of this helper swallowed that refusal and returned null — which read as "the
  // gate did not fire" for BOTH rows, including the counter-case. Hence the check() on creation:
  // a probe that cannot run must fail as itself, never as the thing it was meant to measure.
  const autoResultOn = async (slot: number, label: string): Promise<string | null> => {
    const c = await post(`/api/slots/${slot}/autos`, { text: ": e2e-harness-policy-probe", everySec: null, inSec: 1, idleSec: 0 });
    const cj = (await c.json()) as { auto?: { id?: string }; error?: string };
    check(`§6c fixture: the probe auto was created (${label})`, c.ok && !!cj.auto?.id, `${c.status} ${JSON.stringify(cj)}`);
    const id = cj.auto?.id ?? "";
    if (!id) return null;
    for (let i = 0; i < 80; i++) { // nextAt is +1s and FLEET_AUTOS_TICK_MS is 250 here
      const sx = (await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] };
      const row = sx.autos.find((a) => a.id === id);
      if (row?.lastResult) return row.lastResult;
      await Bun.sleep(100);
    }
    return null;
  };
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6c fixture: a pi slot for the policy gate", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" })).ok);
  const polRes = await autoResultOn(HARNESS_SLOT, "pi");
  check("§6c an unattended auto into a foreign-harness slot is refused, and the reason NAMES the harness",
    (polRes ?? "").includes("harness pi is not automatable"), String(polRes));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  // the counter-case: the identical auto on a DEFAULT-adapter slot is not refused for that reason.
  // Without it the row above would also pass if every auto were simply broken.
  check("§6c fixture: the same slot on the default harness", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const polRes2 = await autoResultOn(HARNESS_SLOT, "default");
  check("§6c ...and a default-adapter slot is never refused for the harness reason",
    polRes2 !== null && !polRes2.includes("not automatable"), String(polRes2));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  check("§6c fixture: the pi slot is restored for the recycle check below",
    (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "pi" })).ok);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // ===== §6d THE CONTAINER ADAPTER =====
  // Stage 1: a slot whose agent runs inside a container the OPERATOR started. There is deliberately
  // no docker here and there must never be — a container runtime in the gate is an external
  // dependency no lane has (docs/container.md says the same about ./docker-verify.sh). So what is
  // asserted is the SPAWN STRING tmux was told to run, which is recorded whether or not the
  // container (or docker itself) exists. That splits cleanly: the wrapper is the new code and is
  // pinned here; the agent line inside it is agentCmd's, already proven by every slotCmd row in
  // this suite and in ./e2e-claude-gate.sh.
  const con = cat.harnesses.find((h) => h.id === "container");
  check("§6d the catalogue carries the container adapter", !!con, cat.harnesses.map((h) => h.id).join(","));
  // automatable is published for exactly this: `false` means "no unattended path, flag or not",
  // which is a property an owner cannot otherwise see. The pi row is the counter-case — without it
  // this would also pass if the field were hardcoded false for everyone.
  check("§6d the container adapter is NOT automatable, while pi (owner-decided) is",
    con?.automatable === false && pi?.automatable === true, `${String(con?.automatable)} / ${String(pi?.automatable)}`);
  check("§6d the container adapter declares no transcript and no effort concept",
    con?.supports.transcript === false && con?.supports.effort === false && con?.effortLevels.length === 0,
    JSON.stringify(con?.supports));
  // the note is the ONLY place an owner learns that Fleet does not provide the container. It has to
  // name the very container the spawn line will exec into, or the caveat points at nothing.
  check("§6d the container adapter states at pick time that the owner supplies the container",
    !!con?.note && con.note.includes("'fleet'") && /mount/i.test(con.note), String(con?.note));
  // the note must also name the DAEMON, not just the container: with three docker contexts on this
  // machine, "container 'fleet'" is an ambiguous sentence until the context is part of it.
  check("§6d ...and which docker it means, since a container name alone does not identify one",
    !!con?.note && con.note.includes("docker --context 'default'"), String(con?.note));

  const oc = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container" });
  check("§6d a slot opens on the container harness (200)", oc.ok, String(oc.status));
  const ccmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  // `-w "$PWD"` is the adapter's one hard requirement made mechanical: the worktree must be mounted
  // at the IDENTICAL path. Double quotes, not single — it has to expand in the pane shell.
  // Backslashes stripped first: tmux RE-QUOTES pane_start_command for display, escaping `"` and `$`
  // — so the raw capture reads `-w \"\$PWD\"`. The pi rows above never noticed because a single
  // quote is not escaped by that rendering. Nothing else here contains a backslash.
  const ccmdRaw = ccmd.replaceAll("\\", "");
  check("§6d the container spawn line execs into the named container at the pane's OWN cwd",
    ccmdRaw.includes(`docker --context 'default' exec -it -w "$PWD" 'fleet' `), ccmd.slice(-160));
  // THE ROW THAT MATTERS MOST HERE, and it is not defensive: `docker` resolves through a context,
  // the current one is a user setting, and on the machine this was written the ACTIVE context was
  // the VM running two guest containers with other people's live sessions. An ambient `docker exec`
  // would have landed there. So: the spawn line must never contain a bare `docker exec`.
  check("§6d the spawn line pins the docker CONTEXT — never ambient (the active one is a user setting)",
    !/docker exec/.test(ccmdRaw) && /docker --context '[A-Za-z0-9][A-Za-z0-9_.-]*' exec/.test(ccmdRaw),
    ccmd.slice(-160));
  // ...and what it execs is this fleet's agent line verbatim (FLEET_CMD=true here), not a second
  // implementation of the flag rules. A reimplementation would drift and nothing else would notice.
  check("§6d ...and the command inside the box is agentCmd's, not a restatement",
    ccmd.includes(`'fleet' true;`), ccmd.slice(-160));
  // the pane must survive a missing container: docker prints its error, then the shell catches it.
  check("§6d the container spawn line keeps the `; exec $SHELL` fallback (a missing container must"
    + " leave a live pane, not a dead slot)", /;\s*exec\s+\S+$/.test(ccmd.trim()), ccmd.slice(-80));
  // the transcript degradation, and it bites HARDER here than for pi: the mount is at the identical
  // path, so the projDir slug is identical too — the mtime fallback would hand this slot an earlier
  // HOST-side conversation from the same directory and label it this session's.
  const ctp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6d a container slot reports NO transcript source (identical mount path makes the mtime fallback WORSE, not better)",
    ctp.source === null && ctp.entries.length === 0, `${String(ctp.source)} / ${ctp.entries.length}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // --- the rejections. Every one of them is a value that would otherwise reach a tmux shell line.
  const cq = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", model: "a/b'c" });
  check("§6d a container model carrying a single quote is refused (400)", cq.status === 400, String(cq.status));
  const ce2 = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", effort: "high" });
  check("§6d the container adapter refuses an effort it has no flag for (400)", ce2.status === 400, String(ce2.status));
  // modelRe: null means it is judged by the SAME charset as a default slot — the widened foreign
  // shapes must still bounce. This is the row that fails if someone "helpfully" widens the adapter.
  for (const bad of ["claude-bridge/claude-haiku-4-5", "sonnet:high", "anthropic/*"]) {
    const r = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "container", model: bad });
    check(`§6d the container adapter did not widen the model charset: ${bad} refused (400)`, r.status === 400, String(r.status));
  }

  // ----- §6d2 THE BOX IS PER SLOT -----
  // Which container, and on which docker daemon, used to be two module constants read once from the
  // process env — so changing either meant editing watchdog.sh and restarting, and every container
  // slot on the fleet got the same answer. That is the same KIND of decision as `model`, which has
  // been per-slot since the registry existed, and this section proves the pair moved.
  //
  // Two slots AT ONCE is the load-bearing shape: a single slot carrying a non-default value would
  // pass just as well if the value were still fleet-wide and merely settable at boot. Only two
  // simultaneous panes disagreeing about their box prove the resolution is per session.
  const BOX_SLOT_A = HARNESS_SLOT, BOX_SLOT_B = 11; // 11 is untouched by every other module
  const paneOf = async (id: number) =>
    (await tmuxOut("display-message", "-p", "-t", `s${id}`, "#{pane_start_command}")).out.replaceAll("\\", "");
  const oa = await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container", container: "box-a", containerContext: "ctx-a" });
  const ob = await post(`/api/slots/${BOX_SLOT_B}/open`,
    { cwd: REPO, harness: "container", container: "box-b", containerContext: "ctx-b" });
  check("§6d2 two container slots open with DIFFERENT boxes (200/200)", oa.ok && ob.ok, `${oa.status}/${ob.status}`);
  const pa = await paneOf(BOX_SLOT_A), pb = await paneOf(BOX_SLOT_B);
  check("§6d2 slot A execs into its OWN container on its OWN docker context",
    pa.includes(`docker --context 'ctx-a' exec -it -w "$PWD" 'box-a' `), pa.slice(-160));
  check("§6d2 ...and slot B into a different one, at the same time — the pair is per slot, not per fleet",
    pb.includes(`docker --context 'ctx-b' exec -it -w "$PWD" 'box-b' `) && pa !== pb, pb.slice(-160));
  // the values reach the line SHELL-QUOTED, which is the whole reason the charsets exclude `'`.
  // Asserted on the raw line rather than inferred from the includes above: a future line that
  // interpolated them bare would still contain the substring if the surrounding quotes moved.
  check("§6d2 both values are single-quoted in the spawn line (an unquoted one is a shell injection point)",
    /--context 'ctx-a' exec -it -w "\$PWD" 'box-a'/.test(pa), pa.slice(-160));

  // ...and the row can ANSWER "which VM am I in" — the question that motivated this. RESOLVED, and
  // present even when the slot chose nothing, because a default that sends no field leaves the
  // question exactly as unanswerable as the env did.
  const sb = (await (await get("/api/sessions")).json()) as
    { slots: { id: number; harness?: string; container?: string; containerContext?: string }[] };
  const rowA = sb.slots.find((x) => x.id === BOX_SLOT_A);
  check("§6d2 /api/sessions reports slot A's box and daemon",
    rowA?.container === "box-a" && rowA?.containerContext === "ctx-a", JSON.stringify(rowA));
  // a slot on a harness with no box concept must not carry the fields at all — an owner reading
  // "container: fleet" on a plain claude slot would be reading a fiction
  const rowPlain = sb.slots.find((x) => x.id !== BOX_SLOT_A && x.id !== BOX_SLOT_B && !x.harness && x.container !== undefined);
  check("§6d2 ...and no default-harness slot carries them (they would be a fiction there)",
    rowPlain === undefined, JSON.stringify(rowPlain));

  // the box survives a PANE RESPAWN — it is slot state, not a spawn argument that dies with the
  // first pane. ↻ restart is the cheapest observable form of that (ensureSlot rebuilds the line).
  const rs = await post(`/api/slots/${BOX_SLOT_A}/restart`, {});
  check("§6d2 fixture: the slot restarts (200)", rs.ok, String(rs.status));
  check("§6d2 the respawned pane re-enters the SAME box — a persisted choice, not a spawn-time argument",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'ctx-a' exec -it -w "$PWD" 'box-a' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  await post(`/api/slots/${BOX_SLOT_B}/kill`, {});

  // --- ABSENCE. The one property the env default existed for, and the one a per-slot field could
  // quietly lose: nothing given must fall to the NEUTRAL default, never to docker's ambient
  // context (on this machine that is the VM holding the guests' live sessions).
  check("§6d2 fixture: a container slot naming neither field", (await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container" })).ok);
  check("§6d2 absence falls back to the fleet default, never to the ambient docker context",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'default' exec -it -w "$PWD" 'fleet' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  // ...and each half falls back on its own: "the usual box, over in that VM" is a real request,
  // and demanding both would make the common case the awkward one.
  check("§6d2 fixture: a slot naming only the context", (await post(`/api/slots/${BOX_SLOT_A}/open`,
    { cwd: REPO, harness: "container", containerContext: "ctx-only" })).ok);
  check("§6d2 a context without a container keeps the DEFAULT container — the halves are independent",
    (await paneOf(BOX_SLOT_A)).includes(`docker --context 'ctx-only' exec -it -w "$PWD" 'fleet' `),
    (await paneOf(BOX_SLOT_A)).slice(-160));
  await post(`/api/slots/${BOX_SLOT_A}/kill`, {});

  // --- THE REJECTIONS, and they are 400s rather than a silent fold to the default. The env path
  // folds on purpose (one typo in watchdog.sh must not kill every container slot at boot); a spawn
  // request is one owner's one click, and folding it would open a box other than the one they named.
  // The seven metacharacters are the model rows' set: each is a value that would otherwise be
  // interpolated into a single-quoted word on a tmux command line.
  for (const bad of ["a'b", "a b", "a;b", "a$b", "a`b", "a|b", "a&b"]) {
    const rc = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", container: bad });
    check(`§6d2 a container name carrying ${JSON.stringify(bad)} is refused (400)`, rc.status === 400, String(rc.status));
    const rx = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", containerContext: bad });
    check(`§6d2 a docker context carrying ${JSON.stringify(bad)} is refused (400)`, rx.status === 400, String(rx.status));
  }
  // a leading `-` would be read by docker as a FLAG, not a name — the charset requires alphanumeric
  // first, and that is the reason, not tidiness
  const rdash = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: "container", container: "-rm" });
  check("§6d2 a container name starting with a dash is refused (docker would read it as a flag)",
    rdash.status === 400, String(rdash.status));
  // ...and NAMED FOR A HARNESS THAT HAS NO BOX: refused, not dropped. Dropping it is the failure
  // that matters most in this family — the owner would believe the session is contained.
  for (const h of ["claude", "pi", "pi-zai", "codex"]) {
    const rh = await post(`/api/slots/${BOX_SLOT_A}/open`, { cwd: REPO, harness: h, container: "box-a" });
    check(`§6d2 harness ${h} refuses a container it would never enter (400, never silently dropped)`,
      rh.status === 400, String(rh.status));
  }
  // and the lane route takes the same body — the two spawn paths must not disagree about the box,
  // the way they once could about the model
  const lb = await post(`/api/slots/${BOX_SLOT_A}/open-worktree`, { repo: REPO, harness: "container", container: "a'b" });
  check("§6d2 the lane spawn route validates the box too (400) — not just /open", lb.status === 400, String(lb.status));
  await post(`/api/slots/${BOX_SLOT_A}/kill`, {});

  // ===== §6e THE CODEX ADAPTER =====
  // `@openai/codex`, adapter #4. Same discipline as §6d: what is asserted is the SPAWN STRING tmux
  // was told to run, which is recorded whether or not codex is installed on the machine running the
  // suite — a gate must never depend on a third-party CLI being present.
  const cx = cat.harnesses.find((h) => h.id === "codex");
  check("§6e the catalogue carries the codex adapter", !!cx, cat.harnesses.map((h) => h.id).join(","));
  // automatable flipped TRUE on 2026-08-12, alongside the readiness seam that makes it sound: the
  // measured hazard (an un-authenticated pane sits on its sign-in screen with the node wrapper
  // RUNNING, probes alive, and eats an unattended paste) is now refused at the SCREEN level —
  // canDeliver's blocked-screen gate plus the dispatch tail's bounded accept-marker wait
  // (counterprobes: e2e/tasks.ts f3; source coupling: e2e/pins.ts). The pi row keeps the
  // contrast honest — two adapters, both true, for two different reasons.
  check("§6e the codex adapter is automatable ALONGSIDE its readiness seam, like pi (both true, published)",
    cx?.automatable === true && pi?.automatable === true, `${String(cx?.automatable)} / ${String(pi?.automatable)}`);
  // Resume is identity-safe only beside the lazy rollout-discovery seam pinned in e2e/pins.ts:
  // fresh spawn still pins no id, and recency/--last remain forbidden. Transcript remains false;
  // effort is the fixed config-key capability asserted below.
  check("§6e the codex adapter declares exact-id resume and effort, but no Fleet transcript",
    cx?.supports.transcript === false && cx?.supports.effort === true
    && JSON.stringify(cx?.effortLevels) === JSON.stringify(["low", "medium", "high", "xhigh", "max", "ultra"])
    && cx?.supports.resume === true, JSON.stringify(cx));
  // the note is the only place an owner learns, at pick time, that the login is theirs to do
  check("§6e the codex adapter states at pick time that authentication is the owner's act",
    !!cx?.note && /codex login/.test(cx.note), String(cx?.note));

  const bx = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "off" });
  check("§6e codex rejects an effort outside its fixed list (400, never config pass-through)",
    bx.status === 400, String(bx.status));
  const ox = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "ultra" });
  check("§6e a slot opens on the codex harness with a declared effort (200)", ox.ok, String(ox.status));
  const xcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  // THE ROW THAT MATTERS MOST HERE flipped on 2026-08-12: full local access is the owner's
  // decision for normal harnesses, so the spawn line must carry the bypass flag AND the persisted
  // trust entry — without the latter, codex blocks on its own per-path trust prompt (measured:
  // the flag does not cover it) and an unattended brief lands in a dead prompt.
  const xcmdFlat = xcmd.replaceAll("\\", "");
  check("§6e the codex spawn line runs full access and writes the slot's trust entry first",
    xcmdFlat.includes("codex --dangerously-bypass-approvals-and-sandbox")
    && !xcmdFlat.includes("--sandbox workspace-write")
    && xcmdFlat.includes('trust_level = "trusted"'), xcmdFlat.slice(-200));
  // ...and it spawns codex, not the fleet's FLEET_CMD (`true` in this suite)
  check("§6e ...and it spawns codex, not the fleet's FLEET_CMD", /(^|\s|;)codex --dangerously/.test(xcmdFlat), xcmdFlat.slice(-160));
  check("§6e the codex spawn line passes only the fixed effort key, with its value single-quoted",
    xcmd.includes(" -c model_reasoning_effort='ultra'")
    && (xcmd.match(/(?:^|\s)-c(?:\s|$)/g) ?? []).length === 1, xcmd.slice(-180));
  // no session id anywhere: pinsSession is false, and a pinned-but-unpassed id is the shape that
  // makes a respawn silently resume nothing while the state file claims a conversation
  check("§6e the codex spawn line pins NO session id (`--last` cannot identify this pane)",
    !/--session-id/.test(xcmd), xcmd.slice(-160));
  check("§6e the codex spawn line keeps the `; exec $SHELL` fallback (a missing binary must leave a"
    + " live pane, not a dead slot)", /;\s*exec\s+\S+$/.test(xcmd.trim()), xcmd.slice(-80));
  // the transcript degradation, same bite as pi's: codex writes its rollout files under $CODEX_HOME,
  // so transcriptFile's newest-by-mtime fallback in ~/.claude/projects/<slug>/ must not be consulted.
  const xtp = (await (await get(`/api/slots/${HARNESS_SLOT}/transcript?after=0`)).json()) as { source: string | null; entries: unknown[] };
  check("§6e a codex slot reports NO transcript source (codex writes under $CODEX_HOME, not projDir)",
    xtp.source === null && xtp.entries.length === 0, `${String(xtp.source)} / ${xtp.entries.length}`);
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});

  // --- the QUOTING, on the shape that makes it load-bearing. The bracket suffix is the context
  // variant (`claude-opus-5[1m]`) and zsh — tmux's default-shell — aborts the whole line on an
  // unmatched glob, pane and all. It is also the SUPERSET proof: a declared foreign harness must
  // never lose a model name a claude fleet would have taken.
  const BR = "codex-probe-5[1m]";
  const obr = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", model: BR });
  check("§6e a codex slot accepts a bracket-suffixed model (the foreign charset is a superset)", obr.ok, String(obr.status));
  const brcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6e the codex spawn line quotes the bracket model (an unquoted one aborts the pane under zsh)",
    brcmd.includes(`--model '${BR}'`), brcmd.slice(-160));
  // --- §6e-probe: the adapter declares its own comms, so it takes NO "unprobed" waiver. Same
  // discriminator as §6b and for the same reason: whether the verdict is `alive` or `no-agent`
  // depends on whether `codex` happens to be installed on the machine running the suite, and that
  // must never decide a row. `unprobed` is the only answer that proves the probe did not happen —
  // it is what the fleet-wide empty set (FLEET_CMD=true here) returns by short-circuit.
  const cxAgent = await agentOf(HARNESS_SLOT);
  check("§6e a codex slot is genuinely PROBED (adapter-declared comms), never waived like the undeclared FLEET_CMD",
    cxAgent !== null && cxAgent !== "unprobed", String(cxAgent));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
  // --- the rejections. Every value here would otherwise reach a tmux shell line.
  // codex DOES take an effort now (`-c model_reasoning_effort=<level>`, 8e154dd), so the old row here
  // — "it refuses an effort it has no flag for" — stopped describing the adapter and started
  // describing history. The block's own purpose is the one that survives: every value in it would
  // otherwise reach a tmux shell line, so what belongs here is not "any effort" but an effort that
  // is shell-dangerous. The fixed-list rejection has its own row at §6e above; this one proves the
  // list is a MEMBERSHIP test rather than a charset filter that a clever value could satisfy.
  const xe = await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO, harness: "codex", effort: "high; id" });
  check("§6e the codex adapter refuses a shell-dangerous effort, rather than dropping it (400)",
    xe.status === 400, String(xe.status));

  // --- and the harness dies with the session: a recycled slot must not inherit the binary the
  // previous occupant ran. Same rule (and same reason) as the selfToken rotation in §3.
  check("§6 fixture: the slot is recycled with no harness named", (await post(`/api/slots/${HARNESS_SLOT}/open`, { cwd: REPO })).ok);
  const rcmd = (await tmuxOut("display-message", "-p", "-t", `s${HARNESS_SLOT}`, "#{pane_start_command}")).out;
  check("§6 a recycled slot is spawned by the DEFAULT harness, never the previous occupant's",
    !rcmd.includes("pi --session-id") && !rcmd.includes("--thinking") && !rcmd.includes("docker exec")
    // PATH may legitimately contain an installed package directory named `codex`; only an
    // executable command token says the recycled pane actually inherited that harness.
    && !/(^|[; ])codex(?: |$)/.test(rcmd.replaceAll("\\", "")), rcmd.slice(-160));
  await post(`/api/slots/${HARNESS_SLOT}/kill`, {});
}

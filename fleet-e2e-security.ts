// Security e2e: the perimeter properties that must not silently regress. This is a SEPARATE
// harness (not a module of the main suite) for two reasons — it deliberately drives a share
// into its hour-long brute-force LOCKOUT, which no other check may then share a counter with,
// and it needs its own dispatcher-enabled instance to prove that remotely-submitted text is
// never dispatched to an agent without an owner promotion. Run via ./e2e-security.sh.
//
// Scope note, so this file is not mistaken for the whole story: the main suite (e2e/auth.ts,
// e2e/intake.ts, e2e/share.ts, e2e/restart.ts, e2e/steward-core.ts) already covers the host /
// origin guards, the share-host allowlist, owner-token 401s, the steward principal's 403s and
// the file modes + audit-log redaction. What lives HERE is what nothing covered: share-secret
// brute force, the injection charsets that reach a pane command line, the self-token's
// out-of-scope 403s, pending-never-dispatches, and the client's no-HTML-sink invariant.
// docs/security-model.md carries the threat model these checks are derived from.
import { readdirSync, readFileSync, statSync } from "node:fs";

const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "fleetsectest";
if (SOCK === "claudefleet") throw new Error("refusing to run against the live socket");
const BASE = `http://${IP}:${PORT}`;
const ROOT = import.meta.dir;
const REPO = process.env.FLEET_E2E_REPO ?? "";
const DISPATCH_REPO = process.env.FLEET_DISPATCH_REPO ?? "";
const INTAKE = process.env.FLEET_INTAKE_SECRET ?? "";
const SHARE_HOST = process.env.FLEET_SHARE_HOSTS ?? "";

const results: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const state = (await Bun.file(`${ROOT}/fleet.json`).json()) as { token?: string };
const TOKEN = process.env.FLEET_TOKEN ?? state.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown): Promise<Response> =>
  fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (path: string): Promise<Response> => fetch(BASE + path, { headers: H });
const withCookie = (path: string, cookie: string): Promise<Response> =>
  fetch(BASE + path, { headers: { cookie } });

interface ShareRes { id: string; password: string }
async function makeShare(slot: number, mode: string, password: string): Promise<ShareRes> {
  const r = await post(`/api/slots/${slot}/share`, { mode, password });
  return (await r.json()) as ShareRes;
}
const authCookie = async (id: string, password: string): Promise<string> => {
  const r = await post(`/s/${id}/auth`, { password });
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
};

// two ordinary sessions to hang shares off. Slot 2 sits in the throwaway git repo: the guest
// read surfaces (brief/diff) only answer for a git working tree, and §6 asserts what they leak.
await post("/api/slots/1/open", { cwd: "~" });
await post("/api/slots/2/open", { cwd: REPO || "~" });

// ---------------------------------------------------------------------------
// §1 Share-secret brute force. An interact share is keystrokes into a live agent
// session, so its password is the whole boundary; /auth throttles and locks after 50
// guesses, and every OTHER share surface must feed that same counter or the lockout is
// decorative. Each sub-case gets its own share: failStrike's window is an hour, so a
// locked share can never be reused by a later check.
// ---------------------------------------------------------------------------
{
  const sh = await makeShare(1, "interact", "correct-horse-1");
  check("§1 share created for the brute-force case", !!sh.id, JSON.stringify(sh).slice(0, 60));
  const good = await authCookie(sh.id, "correct-horse-1");
  check("§1 correct password issues a share cookie", good.startsWith(`share_${sh.id}=`), good.slice(0, 24));
  check("§1 valid cookie reads the share (positive control — the negatives below are not vacuous)",
    (await withCookie(`/s/${sh.id}/info`, good)).status === 200);

  const wrong = `share_${sh.id}=not-the-secret`;
  check("§1 a wrong share cookie is refused", (await withCookie(`/s/${sh.id}/info`, wrong)).status === 401);

  // 60 concurrent guesses: concurrent so the 400ms flat costs overlap (~1s, not 24s). Arrival
  // order under concurrency is not guaranteed, so the assertion is "the lock engaged at all",
  // with the deterministic proof one request later.
  const burst = await Promise.all(Array.from({ length: 60 }, (_, i) =>
    withCookie(`/s/${sh.id}/info`, `share_${sh.id}=guess-${i}`).then((r) => r.status)));
  check("§1 a burst of wrong cookies is answered 401/429 only — never served",
    burst.every((s) => s === 401 || s === 429), [...new Set(burst)].join(","));
  check("§1 the burst trips the lockout (≥1 of 60 answers 429)", burst.includes(429),
    `${burst.filter((s) => s === 429).length} of 60`);
  check("§1 a further wrong cookie is locked out, not merely refused",
    (await withCookie(`/s/${sh.id}/info`, wrong)).status === 429);
  // the anti-bypass property: ONE counter. If the cookie path had its own limiter (or none),
  // /auth would still answer guesses at full rate after the cookie path was exhausted.
  check("§1 the cookie path and /auth share ONE counter — /auth is locked too",
    (await post(`/s/${sh.id}/auth`, { password: "correct-horse-1" })).status === 429);
  check("§1 the lockout targets guessers, not the authenticated guest (valid cookie still 200)",
    (await withCookie(`/s/${sh.id}/info`, good)).status === 200);
  // the WS handshake is the cheapest oracle of all — no body to send, no response to parse
  const wsRefused = await new Promise<boolean>((resolve) => {
    let opened = false;
    const w = new (WebSocket as unknown as new (u: string, o: { headers: Record<string, string> }) => WebSocket)(
      `ws://${IP}:${PORT}/ws-share/${sh.id}`, { headers: { cookie: wrong } });
    w.onopen = () => { opened = true; w.close(); };
    w.onerror = () => resolve(!opened);
    w.onclose = () => resolve(!opened);
  });
  check("§1 a wrong cookie cannot open the guest WebSocket either", wsRefused);
}
{
  // The deliberate asymmetry: an ABSENT cookie is not a guess. Without this, any stranger
  // could lock a share out of existence by loading its URL 51 times.
  const sh = await makeShare(2, "view", "correct-horse-2");
  const noCookie = await Promise.all(Array.from({ length: 60 }, () =>
    fetch(BASE + `/s/${sh.id}/info`).then((r) => r.status)));
  check("§1 unauthenticated reads (no cookie) are 401, never 429", noCookie.every((s) => s === 401),
    [...new Set(noCookie)].join(","));
  check("§1 an absent cookie consumed no strikes — the share is still guessable-but-open (401, not 429)",
    (await post(`/s/${sh.id}/auth`, { password: "still-wrong" })).status === 401);
  check("§1 …and the correct password still authenticates after that burst",
    (await post(`/s/${sh.id}/auth`, { password: "correct-horse-2" })).ok);
}
{
  const audit = (() => { try { return readFileSync(`${ROOT}/audit.jsonl`, "utf8"); } catch { return ""; } })();
  check("§1 the lockout is recorded in the audit log", audit.includes("share_auth_lock"), audit.slice(-200));
  check("§1 the audit log never carries a guessed secret or a real share password",
    !audit.includes("not-the-secret") && !audit.includes("guess-7") && !audit.includes("correct-horse"));
}

// ---------------------------------------------------------------------------
// §2 Injection into the pane command line. slotCmd interpolates the model into a string
// that tmux runs through the login shell, so MODEL_RE is a shell-safety boundary, not a
// cosmetic validator. (The complementary half — that a VALID `[1m]` model stays single-quoted
// in the real pane command — is asserted in e2e-claude-gate.sh, which runs a stand-in `claude`.)
// ---------------------------------------------------------------------------
{
  const hostile = [
    "claude'; touch " + ROOT + "/pwned-model; '",
    "claude`touch " + ROOT + "/pwned-model`",
    "claude$(touch " + ROOT + "/pwned-model)",
    "claude; touch " + ROOT + "/pwned-model",
    "claude\ntouch " + ROOT + "/pwned-model",
    "claude opus", // a bare space already breaks the argv the pane command builds
    "claude-opus-5[1m]extra",
    "x".repeat(65),
  ];
  const codes: string[] = [];
  for (const m of hostile) {
    const a = await post("/api/slots/3/open", { cwd: "~", model: m });
    const b = REPO ? await post("/api/lanes", { repo: REPO, model: m }) : null;
    codes.push(`${a.status}/${b?.status ?? "-"}`);
  }
  check("§2 every shell-metacharacter model is refused by BOTH the open and the lane route",
    codes.every((c) => c === "400/400" || c === "400/-"), codes.join(" "));
  check("§2 a legitimate 1M-context model name is still accepted (the validator is not just 'deny')",
    (await post("/api/slots/3/open", { cwd: "~", model: "claude-opus-5[1m]" })).ok);
  check("§2 no injected command ran", !readdirSync(ROOT).includes("pwned-model"));
}

// ---------------------------------------------------------------------------
// §3 Branch names reach `git worktree add` and a filesystem path. check-ref-format is the
// gate; the path is additionally slugified. Both halves are asserted, plus containment.
// ---------------------------------------------------------------------------
if (REPO) {
  const hostile = ["$(touch " + ROOT + "/pwned-branch)", "../../escape", "a b", "x..y", "-x", "he~ad", "a\\b"];
  const codes: number[] = [];
  for (const b of hostile) codes.push((await post("/api/lanes", { repo: REPO, branch: b })).status);
  check("§3 every malformed/hostile branch name is refused", codes.every((c) => c === 400), codes.join(","));
  check("§3 no injected command ran from a branch name", !readdirSync(ROOT).includes("pwned-branch"));
  const okLane = await post("/api/lanes", { repo: REPO, branch: "feat/sec-e2e" });
  const okJ = (await okLane.json()) as { ok?: boolean; slot?: number; cwd?: string; branch?: string };
  check("§3 a legitimate slashed branch name is still accepted (not just 'deny')",
    okLane.ok && okJ.branch === "feat/sec-e2e", JSON.stringify(okJ).slice(0, 120));
  // suffix, not equality: the server resolve()s the path, and on macOS /var is a symlink to
  // /private/var — the invariant is the shape of the tail, not the prefix's spelling
  check("§3 the worktree path is slugified (no slash from the branch) and stays inside <repo>.worktrees/",
    !!okJ.cwd && okJ.cwd.endsWith("/testrepo.worktrees/feat-sec-e2e") && !okJ.cwd.includes(".."), okJ.cwd ?? "");
  if (okJ.slot) await post(`/api/slots/${okJ.slot}/kill`, {});
}

// ---------------------------------------------------------------------------
// §4 The scoped lane credential. e2e/self-token.ts proves what it CAN do; these are the
// refusals — and the status codes matter: 403 means "valid credential, wrong scope" (the
// route tells the lane why), 401 means "not a credential this route knows at all".
// ---------------------------------------------------------------------------
if (REPO) {
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
  const persisted = (await Bun.file(`${ROOT}/fleet.json`).json()) as
    { slots?: Record<string, { selfToken?: string }> };
  const selfTok = persisted.slots?.[String(ln.slot)]?.selfToken ?? "";
  check("§4 the lane's selfToken is persisted and 128-bit", /^[0-9a-f]{32}$/.test(selfTok), selfTok.slice(0, 8));
  const dispBody = JSON.stringify({ draftId: "deadbeefdeadbeef", verdict: "kept" });
  const asHeader = await fetch(BASE + "/api/dispositions", { method: "POST",
    headers: { "content-type": "application/json", "x-fleet-self-token": selfTok }, body: dispBody });
  check("§4 a lane cannot label its own work — self token on the disposition rail is 403",
    asHeader.status === 403, String(asHeader.status));
  const asBearer = await fetch(BASE + "/api/dispositions", { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${selfTok}` }, body: dispBody });
  check("§4 …and offering the self token AS the owner token on that route is 403 too, not 401",
    asBearer.status === 403, String(asBearer.status));
  const asRead = await fetch(BASE + "/api/sessions", { headers: { authorization: `Bearer ${selfTok}` } });
  check("§4 the self token is not an owner credential anywhere else (401, unknown credential)",
    asRead.status === 401, String(asRead.status));
  const asLand = await fetch(BASE + `/api/slots/${ln.slot}/land`, { method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${selfTok}` }, body: "{}" });
  check("§4 a lane cannot land ITSELF with its own token", asLand.status === 401, String(asLand.status));
  // rotation: a recycled slot must not honour the token the previous session held
  await post(`/api/slots/${ln.slot}/kill`, {});
  await post(`/api/slots/${ln.slot}/open`, { cwd: "~" });
  const stale = await fetch(BASE + "/api/self/autos", { method: "POST",
    headers: { "content-type": "application/json", "x-fleet-self-token": selfTok },
    body: JSON.stringify({ text: "stale", inSec: 60 }) });
  check("§4 the selfToken dies with its session — the recycled slot refuses the old one",
    stale.status === 401, String(stale.status));
  await post(`/api/slots/${ln.slot}/kill`, {});
}

// ---------------------------------------------------------------------------
// §5 The line that must not be crossed: text submitted from OUTSIDE (the public intake
// dropbox) becomes a `pending` task and nothing else. Only an owner promotion makes it
// dispatchable. Without this, /intake would be remote prompt-injection into an agent
// running with the owner's privileges.
// ---------------------------------------------------------------------------
if (INTAKE && DISPATCH_REPO) {
  const marker = `sec-e2e-intake-${Date.now()}`;
  const inj = await fetch(BASE + "/intake", { method: "POST",
    headers: { "content-type": "application/json", "x-intake-secret": INTAKE },
    body: JSON.stringify({ text: marker, from: "outsider", status: "queued", queue: true, source: "owner", slot: 1 }) });
  check("§5 intake accepts the submission", inj.ok);
  // The 2 s poll carries DIGESTS only (server.ts, grep `TaskDigest`): `text` is gone from it and
  // null-valued fields are omitted entirely. So resolve the id ONCE against the full list, assert
  // the STORED record there — where a rejected `slot` is an explicit null rather than an absent
  // key — and use the digest for the one thing it is for, polling `status`. Joining by id keeps
  // this harness working whatever the digest sheds next; matching on text did not.
  const fullTask = async (): Promise<{ id: string; text: string; status: string; source: string; slot: number | null } | undefined> =>
    ((await (await get("/api/tasks")).json()) as
      { tasks: { id: string; text: string; status: string; source: string; slot: number | null }[] })
      .tasks.find((t) => t.text === marker);
  const t0 = await fullTask();
  // its own named check, so a broken join fails HERE instead of toppling the three below as dominos
  check("§5 the intake task is findable by its marker", !!t0?.id, JSON.stringify(t0));
  const taskOf = async (): Promise<{ id: string; status: string } | undefined> => {
    const j = (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string }[] };
    return j.tasks.find((t) => t.id === t0?.id);
  };
  check("§5 a spoofed status/queue/source/slot in the intake body is ignored — pending, source intake",
    t0?.status === "pending" && t0?.source === "intake" && t0?.slot === null, JSON.stringify(t0));
  const laneCount = async (): Promise<number> => {
    const j = (await (await get("/api/sessions")).json()) as { slots: { worktree: unknown }[] };
    return j.slots.filter((s) => s.worktree).length;
  };
  const lanes0 = await laneCount();
  check("§5 dispatcher switched on", (await post("/api/dispatch", { on: true })).ok);
  // 20s spans two full dispatcher ticks (8s apart) — well past the point a QUEUED task would
  // have been taken (the positive control below settles in one tick plus the 4s boot sleep)
  await Bun.sleep(20_000);
  const t1 = await taskOf();
  check("§5 the dispatcher never takes a PENDING task — no lane, still pending",
    t1?.status === "pending" && (await laneCount()) === lanes0,
    `status=${t1?.status} lanes=${await laneCount()} (was ${lanes0})`);
  // positive control: the same task, once the OWNER promotes it, IS dispatched — so the
  // negative above measures the pending gate, not a dead dispatcher.
  check("§5 owner promotes the task (pending → queued)", (await post(`/api/tasks/${t0?.id}/queue`, {})).ok);
  let sent = false;
  for (let i = 0; i < 60 && !sent; i++) {
    await Bun.sleep(1000);
    sent = (await taskOf())?.status === "sent";
  }
  check("§5 positive control: the PROMOTED task is dispatched into a fresh lane",
    sent && (await laneCount()) > lanes0, `sent=${sent} lanes=${await laneCount()} (was ${lanes0})`);
  await post("/api/dispatch", { on: false });
}

// ---------------------------------------------------------------------------
// §6 A guest must not be able to act on the owner's terminal beyond typing (and not even
// that in view mode — e2e/share.ts covers the input drop). Resizing is the subtler one:
// the pty is shared, so a guest-forced resize would reflow the OWNER's screen.
// ---------------------------------------------------------------------------
{
  const sh = await makeShare(2, "view", "resize-pass-123");
  const cookie = await authCookie(sh.id, "resize-pass-123");
  const before = (await (await withCookie(`/s/${sh.id}/info`, cookie)).json()) as { cols: number; rows: number };
  await new Promise<void>((resolve) => {
    const w = new (WebSocket as unknown as new (u: string, o: { headers: Record<string, string> }) => WebSocket)(
      `ws://${IP}:${PORT}/ws-share/${sh.id}?cols=31&rows=11&force=1`, { headers: { cookie } });
    w.onopen = () => setTimeout(() => { w.close(); resolve(); }, 1200);
    w.onerror = () => resolve();
  });
  const after = (await (await withCookie(`/s/${sh.id}/info`, cookie)).json()) as { cols: number; rows: number };
  check("§6 a guest cannot resize the owner's pty via the WS query string",
    after.cols === before.cols && after.rows === before.rows && before.cols > 31,
    `${before.cols}x${before.rows} → ${after.cols}x${after.rows}`);
  // the guest info tab is the owner sideboard's document minus local filesystem detail — the
  // session's own absolute path is the thing that must never cross to a guest
  const brief = await withCookie(`/s/${sh.id}/brief`, cookie);
  const briefRaw = await brief.text();
  check("§6 the guest brief answers without leaking the session's absolute path",
    brief.ok && !!REPO && !briefRaw.includes(REPO), briefRaw.slice(0, 160));
}

// ---------------------------------------------------------------------------
// §7 The client's XSS invariant, asserted as a property of the SOURCE. Transcript text,
// pane output, guest comments and branch names are all attacker-influenced and all end up
// in the DOM; src/md.ts calls itself "XSS-safe" in a comment, which is not a test. There is
// exactly one safe rule here — nothing untrusted becomes markup — so the check is that no
// HTML sink exists at all, rather than an escaping test per call site.
// ---------------------------------------------------------------------------
{
  const sinks = /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\bsrcdoc\b|\beval\(|new Function\(/;
  // ONE reviewed exception, pinned by its exact text: the directory picker's icons are a const
  // table of static SVG literals, looked up by an internal `kind`, with a static fallback — no
  // data crosses into markup. It is allowlisted rather than rewritten because rewriting working
  // icon markup cannot be verified from here; the two checks below are what keep it honest —
  // change the assignment in any way, or make the table dynamic, and this fails.
  const ALLOWED = "s.innerHTML = PK_ICONS[kind] ?? PK_ICONS.folder;";
  const offenders: string[] = [];
  for (const f of readdirSync(`${ROOT}/src`).filter((f) => f.endsWith(".ts"))) {
    for (const [i, line] of readFileSync(`${ROOT}/src/${f}`, "utf8").split("\n").entries()) {
      const code = line.replace(/\/\/.*$/, "");
      if (sinks.test(code) && code.trim() !== ALLOWED) offenders.push(`src/${f}:${i + 1}`);
    }
  }
  check("§7 no HTML/eval sink in the client sources beyond the one reviewed static-icon exception",
    offenders.length === 0, offenders.join(" "));
  // …and the premise that "all client code lives in src/" has to hold, or the check above scans
  // the wrong files: the served pages may only REFERENCE a bundle, never carry inline script.
  const inline: string[] = [];
  for (const f of readdirSync(`${ROOT}/public`).filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(`${ROOT}/public/${f}`, "utf8");
    for (const tag of html.match(/<script[^>]*>/g) ?? []) if (!/\bsrc=/.test(tag)) inline.push(`${f}: ${tag}`);
    if (sinks.test(html)) inline.push(`${f}: HTML sink in markup`);
  }
  check("§7 the served pages carry no inline script — every line of client code is in src/",
    inline.length === 0, inline.join(" | "));
  const client = readFileSync(`${ROOT}/src/client.ts`, "utf8");
  const table = /const PK_ICONS[\s\S]*?\n};/.exec(client)?.[0] ?? "";
  check("§7 the allowlisted icon table is static — no interpolation, no handler, no script",
    !!table && !table.includes("${") && !/javascript:|\son\w+=|<script/i.test(table), table.slice(0, 80));
  const md = readFileSync(`${ROOT}/src/md.ts`, "utf8");
  check("§7 the shared markdown renderer builds nodes and assigns textContent only",
    md.includes("textContent") && !/innerHTML|createRange|DOMParser/.test(md));
}

// ---------------------------------------------------------------------------
// §8 Credentials at rest. The owner token and every share secret live in fleet.json; the
// pane stream and prompt log carry whatever was typed into a session.
// ---------------------------------------------------------------------------
{
  const mode = (p: string): number => { try { return statSync(p).mode & 0o777; } catch { return -1; } };
  check("§8 fleet.json (owner token, steward token, share secrets) is 0600",
    mode(`${ROOT}/fleet.json`) === 0o600, mode(`${ROOT}/fleet.json`).toString(8));
  check("§8 the stream directory is 0700", mode(`${ROOT}/streams`) === 0o700, mode(`${ROOT}/streams`).toString(8));
  check("§8 a pane stream file is 0600", mode(`${ROOT}/streams/s1.raw`) === 0o600, mode(`${ROOT}/streams/s1.raw`).toString(8));
  check("§8 the audit log is 0600", mode(`${ROOT}/audit.jsonl`) === 0o600, mode(`${ROOT}/audit.jsonl`).toString(8));
  const sessions = await (await get("/api/sessions")).text();
  check("§8 the owner dashboard payload does not echo the owner token back",
    !sessions.includes(TOKEN), sessions.slice(0, 80));
  if (SHARE_HOST)
    check("§8 the owner bundle is not published on the public share host",
      (await fetch(BASE + "/app.js", { headers: { host: SHARE_HOST } })).status === 404);
}

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

// e2e for claude-fleet: run from the repo root with the server already up.
//   bun fleet-e2e.ts
// Creates slots 1+2, kills them, and restarts the `srv` tmux session along the way.
const IP = process.env.FLEET_E2E_HOST ?? "127.0.0.1";
// match the server's env so the whole suite can target an isolated instance
// (own port + own tmux socket) instead of the live fleet — see e2e-isolated.sh
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
// the suite kills slots 1-3 and restarts srv — a bare `bun fleet-e2e.ts` must never
// hit the live fleet by accident. The isolated wrappers set FLEET_SOCK to their own socket.
if (SOCK === "claudefleet" && !process.env.FLEET_E2E_ALLOW_LIVE)
  throw new Error("refusing to run against live socket 'claudefleet' — use ./e2e-isolated.sh (or set FLEET_E2E_ALLOW_LIVE=1)");
const BASE = `http://${IP}:${PORT}`;
const results: string[] = [];
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

async function tmuxOut(...args: string[]) {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const code = await p.exited;
  return { out, code };
}

const state = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const TOKEN = process.env.FLEET_TOKEN ?? state.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown, headers: Record<string, string> = H) =>
  fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
const get = (path: string) => fetch(BASE + path, { headers: H });

// --- auth & request guards ---
const noauth = await fetch(BASE + "/api/sessions");
check("401 without token", noauth.status === 401);
const badtok = await fetch(BASE + "/api/sessions", { headers: { authorization: "Bearer wrong" } });
check("401 with wrong token", badtok.status === 401);
const authed = await get("/api/sessions");
check("200 with token", authed.status === 200);
const badhost = await fetch(BASE + "/api/sessions", { headers: { ...H, host: "evil.example:8790" } });
check("403 DNS-rebinding host", badhost.status === 403);
const badorigin = await fetch(BASE + "/send", {
  method: "POST", headers: { ...H, origin: "http://evil.example" },
  body: JSON.stringify({ slot: 1, text: "x" }),
});
check("403 cross-origin POST", badorigin.status === 403);
const plainpost = await fetch(BASE + "/send", {
  method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "text/plain" },
  body: JSON.stringify({ slot: 1, text: "x" }),
});
check("reject non-JSON content-type", plainpost.status === 400);
const login = await fetch(BASE + `/?token=${TOKEN}`, { redirect: "manual" });
check("login URL sets cookie + redirects", login.status === 302 && (login.headers.get("set-cookie") ?? "").includes("SameSite=Strict"));
const staticOk = await fetch(BASE + "/");
check("static HTML served without auth", staticOk.status === 200);

// --- directory picker API ---
const dirs = (await (await get("/api/dirs?path=~")).json()) as { path: string; dirs: string[]; common: string[]; recents: string[] };
check("/api/dirs lists home", Array.isArray(dirs.dirs) && dirs.dirs.includes("claude-fleet"), `${dirs.dirs.length} dirs`);
check("/api/dirs common includes home", dirs.common.includes(dirs.path));
const badDirs = await get("/api/dirs?path=/nonexistent-xyz");
check("/api/dirs rejects bad path", badDirs.status === 400);

// --- slots ---
const o1 = await post("/api/slots/1/open", { cwd: "~/claude-fleet" });
const o2 = await post("/api/slots/2/open", { cwd: "~" });
check("open slot 1", o1.ok, JSON.stringify(await o1.json()));
check("open slot 2", o2.ok, JSON.stringify(await o2.json()));
const bad = await post("/api/slots/3/open", { cwd: "/nonexistent-dir-xyz" });
check("reject bad cwd", bad.status === 400);
const rec = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
check("recents updated (newest first)", rec.recents[0] === `${process.env.HOME}` && rec.recents[1] === `${process.env.HOME}/claude-fleet`, JSON.stringify(rec.recents));
const s1 = await tmuxOut("has-session", "-t", "s1");
const s2 = await tmuxOut("has-session", "-t", "s2");
check("tmux s1 exists", s1.code === 0);
check("tmux s2 exists", s2.code === 0);

// --- rename ---
const rn = await post("/api/slots/2/rename", { label: "research-agent" });
check("rename slot 2", rn.ok, JSON.stringify(await rn.json()));
const withLabel = (await (await get("/api/sessions")).json()) as { slots: { label: string | null }[] };
check("label visible in /api/sessions", withLabel.slots[1].label === "research-agent");
const rnLong = await post("/api/slots/2/rename", { label: "x".repeat(41) });
check("reject 41-char label", rnLong.status === 400);
const rnInactive = await post("/api/slots/4/rename", { label: "nope" });
check("reject rename of inactive slot", rnInactive.status === 400);
const rnClear = await post("/api/slots/1/rename", { label: "  " });
check("blank label clears to null", rnClear.ok && ((await rnClear.json()) as { label: string | null }).label === null);

// --- streaming + input ---
await Bun.sleep(6000);
const wsUrl = (slot: number) => `ws://${IP}:${PORT}/ws/${slot}?token=${TOKEN}`;
// Bun's WebSocket client accepts { headers } as a second arg — the DOM lib types don't
const wsWithHeaders = (url: string, headers: Record<string, string>): WebSocket =>
  new (WebSocket as unknown as new (u: string, opts: { headers: Record<string, string> }) => WebSocket)(url, { headers });
const replayBytes = await new Promise<number>((resolve) => {
  let n = 0;
  const ws = new WebSocket(wsUrl(1));
  ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
  ws.onopen = () => setTimeout(() => { ws.close(); resolve(n); }, 2000);
  ws.onerror = () => resolve(-1);
});
check("WS replay for slot 1 non-empty", replayBytes > 100, `${replayBytes} bytes`);

// --- width-aware reseed: a client's cols/rows on connect should resize the tmux window
// (tmux reflows history on resize, which is what fixes cross-width scrollback wrapping) ---
const reseedCols = 55, reseedRows = 38;
const seedText = await new Promise<string>((resolve) => {
  let first = "";
  const ws = new WebSocket(`${wsUrl(2)}&cols=${reseedCols}&rows=${reseedRows}`);
  ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => { if (!first) first = new TextDecoder().decode(e.data as ArrayBuffer); };
  ws.onopen = () => setTimeout(() => { ws.close(); resolve(first); }, 800);
  ws.onerror = () => resolve(first);
});
// capture-pane's plain output separates rows with bare LF; xterm.js doesn't treat LF alone
// as a carriage return, so an unterminated LF staggers every line after it off column 0 —
// every LF in the reseed must have a matching CR (see server.ts's crlf() normalizer)
const lfCount = (seedText.match(/\n/g) ?? []).length;
const crlfCount = (seedText.match(/\r\n/g) ?? []).length;
check("reseed content has no bare LF (every line CRLF-terminated)", lfCount > 0 && lfCount === crlfCount, `${crlfCount}/${lfCount}`);
await Bun.sleep(300);
const winSize = await tmuxOut("display-message", "-p", "-t", "s2", "#{window_width} #{window_height}");
check("WS connect with cols/rows reseeds tmux window", winSize.out.trim() === `${reseedCols} ${reseedRows}`, winSize.out.trim());
const rszSame = await post("/resize", { slot: 2, cols: reseedCols, rows: reseedRows });
check("/resize accepts matching size (no-op)", rszSame.ok);

const wsNoTok = await new Promise<boolean>((resolve) => {
  let opened = false;
  const ws = new WebSocket(`ws://${IP}:${PORT}/ws/1`);
  ws.onopen = () => { opened = true; ws.close(); };
  ws.onerror = () => resolve(!opened);
  ws.onclose = () => resolve(!opened);
});
check("WS rejected without token", wsNoTok);

await new Promise<void>((resolve) => {
  const ws = new WebSocket(wsUrl(1));
  ws.onopen = () => {
    ws.send("hello-fleet-typing");
    setTimeout(() => { ws.close(); resolve(); }, 800);
  };
  ws.onerror = () => resolve();
});
await Bun.sleep(500);
const cap1 = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("typed bytes visible in s1 pane", cap1.out.includes("hello-fleet-typing"));

const snd = await post("/send", { slot: 2, text: "compose-box-to-slot-two", submit: false });
check("/send accepted", snd.ok);
await Bun.sleep(700);
const cap2 = await tmuxOut("capture-pane", "-t", "s2", "-p");
check("composed text visible in s2 pane", cap2.out.includes("compose-box-to-slot-two"));
check("no cross-talk (s1 text absent from s2)", !cap2.out.includes("hello-fleet-typing"));
const cap1b = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("no cross-talk (s2 text absent from s1)", !cap1b.out.includes("compose-box-to-slot-two"));
// --- export (before C-u wipes the input line the sent text sits on) ---
const expHtml = await get("/api/slots/2/export");
const expBody = await expHtml.text();
check("export returns HTML", expHtml.ok && (expHtml.headers.get("content-type") ?? "").includes("text/html"));
check("export contains session content", expBody.includes("compose-box-to-slot-two"));
check("export escapes HTML metachars", !/<script/i.test(expBody) && expBody.includes("<pre>"));

// --- regression: the check above never puts a real metacharacter into the source, so
// it can't fail on an escaping regression — exercise the actual esc() path with real
// input, in both the pane-content and the label (title/h1) interpolation sites ---
const o3exp = await post("/api/slots/3/open", { cwd: "~" });
check("open slot 3 for export-escaping fixture", o3exp.ok);
await post("/api/slots/3/rename", { label: `<b>"pwn'd</b>` });
await post("/send", { slot: 3, text: `<script>window.__pwn=1</script>`, submit: false });
await Bun.sleep(400);
const exp3 = await get("/api/slots/3/export");
const exp3Body = await exp3.text();
check("export escapes a real metachar in pane content", exp3Body.includes("&lt;script&gt;window.__pwn=1&lt;/script&gt;")
  && !exp3Body.includes("<script>window"));
check("export escapes a real metachar in the label (title/h1)", exp3Body.includes(`&lt;b&gt;"pwn'd&lt;/b&gt;`)
  && !exp3Body.includes(`<b>"pwn`));
await post("/api/slots/3/kill", {});
const expTxt = await get("/api/slots/2/export?format=txt");
check("export?format=txt is a plain-text download", expTxt.ok
  && (expTxt.headers.get("content-type") ?? "").includes("text/plain")
  && (expTxt.headers.get("content-disposition") ?? "").includes("attachment"), expTxt.headers.get("content-disposition") ?? "");
check("txt export contains session content", (await expTxt.text()).includes("compose-box-to-slot-two"));
const expInactive = await get("/api/slots/4/export");
check("export rejects inactive slot", expInactive.status === 400);

for (const t of ["s1", "s2"]) await tmuxOut("send-keys", "-t", t, "C-u");

// --- prompt history: composed sends recorded, raw WS typing deliberately not ---
const h2 = (await (await get("/api/slots/2/history")).json()) as { history: { text: string; ts: number }[] };
check("history records composed send", h2.history.length === 1 && h2.history[0].text === "compose-box-to-slot-two", JSON.stringify(h2.history));
check("history entry has timestamp", typeof h2.history[0]?.ts === "number" && h2.history[0].ts > 0);
const h1 = (await (await get("/api/slots/1/history")).json()) as { history: unknown[] };
check("raw typed input not recorded in history", h1.history.length === 0, `${h1.history.length} entries`);

// --- global prompt log: every composed send from every surface, append-only,
// survives slot close (slot 3 sent a prompt above and was then killed) ---
const { statSync } = await import("node:fs");
const plogPath = `${import.meta.dir}/streams/prompts.jsonl`;
const plogRead = async () => (await Bun.file(plogPath).text()).trim().split("\n").filter(Boolean)
  .map((l) => JSON.parse(l) as { ts: number; slot: number; cwd: string | null; label: string | null; source: string; text: string });
const plog1 = await plogRead();
check("prompt log records owner send with source 'owner'",
  plog1.some((e) => e.slot === 2 && e.source === "owner" && e.text === "compose-box-to-slot-two"), `${plog1.length} entries`);
check("prompt log survives slot close", plog1.some((e) => e.slot === 3 && e.text.includes("__pwn=1")));
check("prompt log ignores raw WS typing", !plog1.some((e) => e.text.includes("hello-fleet-typing")));
check("prompt log entries carry ts + cwd", plog1.every((e) => typeof e.ts === "number" && typeof e.cwd === "string"));
check("prompt log file is 600", (statSync(plogPath).mode & 0o777) === 0o600, (statSync(plogPath).mode & 0o777).toString(8));

// --- transcript view (slot 1 cwd is ~/claude-fleet, whose project dir has transcripts;
// FLEET_CMD=true means no pinned session id, so this exercises the mtime fallback) ---
const tr1 = await get("/api/slots/1/transcript");
const tr1j = (await tr1.json()) as { entries: { role: string; blocks: unknown[] }[]; total: number; source: string | null };
check("transcript endpoint returns entries", tr1.ok && tr1j.total > 0 && tr1j.entries.length > 0,
  `total=${tr1j.total} entries=${tr1j.entries.length} source=${tr1j.source}`);
check("transcript entries are structured", tr1j.entries.every((e) => (e.role === "user" || e.role === "assistant") && e.blocks.length > 0));
const tr2 = await get(`/api/slots/1/transcript?after=${tr1j.total}`);
const tr2j = (await tr2.json()) as { entries: unknown[]; total: number };
check("transcript incremental fetch returns nothing new", tr2.ok && tr2j.entries.length === 0 && tr2j.total >= tr1j.total, `total=${tr2j.total}`);
check("transcript rejects inactive slot", (await get("/api/slots/4/transcript")).status === 400);

// --- session brief (slot 1 cwd is ~/claude-fleet, a real git repo) ---
const bf1 = await get("/api/slots/1/brief");
const bf1j = (await bf1.json()) as { branch: string | null; worktree: unknown;
  files: string[]; shortstat: string; commits: { hash: string; ts: number; subject: string }[] };
check("brief returns git facts for a repo slot", bf1.ok && typeof bf1j.branch === "string" && bf1j.branch.length > 0,
  `branch=${bf1j.branch}`);
check("brief lists commits with hash+ts+subject", bf1j.commits.length > 0
  && bf1j.commits.every((c) => /^[0-9a-f]{7,}$/.test(c.hash) && c.ts > 0 && c.subject.length > 0),
  `commits=${bf1j.commits.length}`);
check("brief caps commit list at 15", bf1j.commits.length <= 15);
check("brief files is an array", Array.isArray(bf1j.files));
check("brief rejects inactive slot", (await get("/api/slots/4/brief")).status === 400);

// --- scheduled prompts (FLEET_CMD=true → claude-alive gate is off by design) ---
const aBad = await post("/api/slots/2/autos", { text: "x", everySec: 5, runs: 3 });
check("auto rejects sub-minimum interval", aBad.status === 400);
const aBad2 = await post("/api/slots/2/autos", { text: "x", everySec: 60, runs: 999 });
check("auto rejects runs over cap", aBad2.status === 400);
const aFire = await post("/api/slots/2/autos", { text: "auto-fire-check", inSec: 2, idleSec: 0 });
const aFireJ = (await aFire.json()) as { auto: { id: string } };
check("create one-shot auto", aFire.ok && !!aFireJ.auto?.id);
// make slot 1 look busy (fresh output), then schedule with a huge idle gate — must NOT fire
await tmuxOut("send-keys", "-t", "s1", "echo busy-marker", "Enter");
const aBusy = await post("/api/slots/1/autos", { text: "auto-must-wait", inSec: 2, idleSec: 3600 });
const aBusyJ = (await aBusy.json()) as { auto: { id: string } };
check("create idle-gated auto", aBusy.ok && !!aBusyJ.auto?.id);
await Bun.sleep(9000); // past due + one 5s scheduler tick
const cap2a = await tmuxOut("capture-pane", "-t", "s2", "-p");
check("due auto fired into its pane", cap2a.out.includes("auto-fire-check"));
const cap1a = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("idle-gated auto held back while busy", !cap1a.out.includes("auto-must-wait"));
const sess1 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null }[] };
const fired = sess1.autos.find((a) => a.id === aFireJ.auto.id);
const waiting = sess1.autos.find((a) => a.id === aBusyJ.auto.id);
check("fired one-shot is disabled with result 'sent'", !!fired && !fired.enabled && fired.lastResult === "sent", JSON.stringify(fired));
check("gated auto still waiting within grace", !!waiting && waiting.enabled && waiting.lastResult === null, JSON.stringify(waiting));
const h2auto = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
check("auto send recorded in prompt history", h2auto.history.some((h) => h.text === "auto-fire-check"));
check("auto send in prompt log with source 'auto'",
  (await plogRead()).some((e) => e.slot === 2 && e.source === "auto" && e.text === "auto-fire-check"));
check("delete auto", (await post(`/api/autos/${aBusyJ.auto.id}/delete`, {})).ok);
const sess2 = (await (await get("/api/sessions")).json()) as { autos: { id: string }[] };
check("deleted auto gone", !sess2.autos.some((a) => a.id === aBusyJ.auto.id));
// persistence probe: far-future one-shot on slot 2, checked again after the restart section
const aPersist = await post("/api/slots/2/autos", { text: "auto-persist-probe", inSec: 3600 });
const aPersistJ = (await aPersist.json()) as { auto: { id: string } };
check("create persistence-probe auto", aPersist.ok && !!aPersistJ.auto?.id);
await tmuxOut("send-keys", "-t", "s2", "C-u");

// --- session sharing: guest access is slot-scoped, password-gated, mode-enforced ---
const shCreate = await post("/api/slots/2/share", { mode: "view", password: "viewpass123" });
const shView = (await shCreate.json()) as { id: string; path: string; password: string };
check("create view share", shCreate.ok && !!shView.id, JSON.stringify(shView));
const shWrong = await post(`/s/${shView.id}/auth`, { password: "totally-wrong" });
check("share auth rejects wrong password", shWrong.status === 401);
const shAuth = await post(`/s/${shView.id}/auth`, { password: "viewpass123" });
const shCookie = (shAuth.headers.get("set-cookie") ?? "").split(";")[0];
check("share auth sets share cookie", shAuth.ok && shCookie.startsWith(`share_${shView.id}=`), shCookie.slice(0, 20));
const shInfo = await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shCookie } });
const shInfoJ = (await shInfo.json()) as { mode: string; cols: number };
check("share info with cookie", shInfo.ok && shInfoJ.mode === "view", JSON.stringify(shInfoJ));
check("share info without cookie 401", (await fetch(BASE + `/s/${shView.id}/info`)).status === 401);
check("share cookie is not an owner credential", (await fetch(BASE + "/api/sessions", { headers: { cookie: shCookie } })).status === 401);
check("share send blocked in view mode", (await fetch(BASE + `/s/${shView.id}/send`, {
  method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
  body: JSON.stringify({ text: "nope" }),
})).status === 403);
const viewWsBytes = await new Promise<number>((resolve) => {
  let n = 0;
  const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shView.id}`, { cookie: shCookie });
  w.binaryType = "arraybuffer";
  w.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
  w.onopen = () => {
    w.send("view-must-not-type");
    setTimeout(() => { w.close(); resolve(n); }, 1200);
  };
  w.onerror = () => resolve(-1);
});
check("view share WS streams replay", viewWsBytes > 100, `${viewWsBytes} bytes`);
await Bun.sleep(400);
const capV = await tmuxOut("capture-pane", "-t", "s2", "-p");
check("view share WS input dropped server-side", !capV.out.includes("view-must-not-type"));
check("share WS without cookie rejected", await new Promise<boolean>((resolve) => {
  let opened = false;
  const w = new WebSocket(`ws://${IP}:${PORT}/ws-share/${shView.id}`);
  w.onopen = () => { opened = true; w.close(); };
  w.onerror = () => resolve(!opened);
  w.onclose = () => resolve(!opened);
}));
const shICreate = await post("/api/slots/1/share", { mode: "interact", password: "interpass123" });
const shInt = (await shICreate.json()) as { id: string };
check("create interact share", shICreate.ok && !!shInt.id);
const shIAuth = await post(`/s/${shInt.id}/auth`, { password: "interpass123" });
const shICookie = (shIAuth.headers.get("set-cookie") ?? "").split(";")[0];
const sndI = await fetch(BASE + `/s/${shInt.id}/send`, {
  method: "POST", headers: { cookie: shICookie, "content-type": "application/json" },
  body: JSON.stringify({ text: "share-interact-hello", submit: false }),
});
check("interact share can send", sndI.ok);
await Bun.sleep(700);
const capI = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("interact share text reaches its pane", capI.out.includes("share-interact-hello"));
check("share send in prompt log with source 'share'",
  (await plogRead()).some((e) => e.slot === 1 && e.source === "share" && e.text === "share-interact-hello"));
check("share cookie scoped to its own share only", (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shICookie } })).status === 401);
// --- share-mode: flip view/interact in place, same link + password ---
// regression: this must reach an ACTUALLY-CONNECTED guest socket, not just the HTTP
// send route checked below — the WS message handler looks up the share's mode live on
// every message specifically so an already-open interact socket goes silent on a flip
const guestCloseCode = await new Promise<number>((resolve) => {
  let done = false;
  const finish = (v: number) => { if (!done) { done = true; resolve(v); } };
  const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${shInt.id}`, { cookie: shICookie });
  w.onopen = () => void post("/api/slots/1/share-mode", { mode: "view" });
  w.onclose = (e) => finish(e.code);
  w.onerror = () => finish(-1);
  setTimeout(() => finish(-2), 3000);
});
check("share-mode flip closes an already-connected guest socket with 4002", guestCloseCode === 4002, String(guestCloseCode));
const infoFlipped = (await (await fetch(BASE + `/s/${shInt.id}/info`, { headers: { cookie: shICookie } })).json()) as { mode: string };
check("flipped share keeps cookie, reports view", infoFlipped.mode === "view");
check("flipped share blocks send", (await fetch(BASE + `/s/${shInt.id}/send`, {
  method: "POST", headers: { cookie: shICookie, "content-type": "application/json" },
  body: JSON.stringify({ text: "flipped-must-not-send" }),
})).status === 403);
check("share-mode rejects bad mode", (await post("/api/slots/1/share-mode", { mode: "admin" })).status === 400);
check("share-mode 404 on unshared slot", (await post("/api/slots/3/share-mode", { mode: "view" })).status === 404);
check("share-mode needs owner token", (await post("/api/slots/1/share-mode", { mode: "view" },
  { "content-type": "application/json", cookie: shICookie })).status === 401);
const modeBack = await post("/api/slots/1/share-mode", { mode: "interact" });
check("share-mode flips back to interact", modeBack.ok);
const sessAfterFlip = (await (await get("/api/sessions")).json()) as
  { slots: { id: number; share: { mode: string; guests: number; created: number } | null }[] };
const flipSlot = sessAfterFlip.slots.find((x) => x.id === 1);
check("sessions reports share guests + created", flipSlot?.share?.mode === "interact"
  && typeof flipSlot.share.guests === "number" && typeof flipSlot.share.created === "number",
  JSON.stringify(flipSlot?.share));
await tmuxOut("send-keys", "-t", "s1", "C-u");

// --- regression: a share must not outlive its session — reopening a slot onto a
// different cwd must kill the old share, not leave it pointed at the new session ---
const o3 = await post("/api/slots/3/open", { cwd: "~" });
check("open slot 3 for reopen-regression fixture", o3.ok);
const sh3Create = await post("/api/slots/3/share", { mode: "view", password: "reopenpass1" });
const sh3 = (await sh3Create.json()) as { id: string };
const sh3Auth = await post(`/s/${sh3.id}/auth`, { password: "reopenpass1" });
const sh3Cookie = (sh3Auth.headers.get("set-cookie") ?? "").split(";")[0];
const sh3WsClosed = await new Promise<number>((resolve) => {
  let done = false;
  const finish = (v: number) => { if (!done) { done = true; resolve(v); } };
  const w = wsWithHeaders(`ws://${IP}:${PORT}/ws-share/${sh3.id}`, { cookie: sh3Cookie });
  w.onopen = () => void post("/api/slots/3/open", { cwd: "~/claude-fleet" });
  w.onclose = (e) => finish(e.code);
  w.onerror = () => finish(-1);
  setTimeout(() => finish(-2), 3000); // bound the wait — a hang here must not hang the suite
});
check("reopen closes the old share's connected guest socket", sh3WsClosed === 4000, String(sh3WsClosed));
check("reopen invalidates the old share's cookie", (await fetch(BASE + `/s/${sh3.id}/info`, { headers: { cookie: sh3Cookie } })).status === 404);
const sess3Api = (await (await get("/api/sessions")).json()) as { slots: { id: number; share: unknown }[] };
check("reopened slot reports no share", sess3Api.slots.find((x) => x.id === 3)?.share === null);
await post("/api/slots/3/kill", {}); // restore slot 3 to inactive for the rest of the suite

// --- worktree lanes (Phase A/B/C). Uses a throwaway git repo from FLEET_E2E_REPO ---
const REPO = process.env.FLEET_E2E_REPO ?? "";
if (REPO) {
  const wtOpen = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  const wtJson = (await wtOpen.json()) as { ok?: boolean; branch?: string; error?: string };
  check("open-worktree creates a lane", wtOpen.ok && wtJson.branch === "e2e-lane", JSON.stringify(wtJson));
  const wtDir = `${REPO}.worktrees/e2e-lane`;
  check("worktree dir materialized on disk", statSync(wtDir).isDirectory());
  check("untracked .env copied into the worktree", statSync(`${wtDir}/.env`).isFile());
  const wtRefused = await post("/api/slots/5/open-worktree", { repo: REPO, branch: "e2e-lane" });
  check("open-worktree on an active slot is refused", wtRefused.status === 400);
  const sessWt = (await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] };
  check("slot 5 tagged as a worktree lane", sessWt.slots[4].worktree?.branch === "e2e-lane", JSON.stringify(sessWt.slots[4].worktree));
  // the copied .env is gitignored in the test repo, so it must NOT show as dirty — a fresh
  // lane has to be clean, or `land` would be permanently blocked by scaffolding files
  const freshDiff = (await (await get("/api/slots/5/diff")).json()) as { status: string[] };
  check("fresh lane is clean (gitignored .env copy not counted dirty)", freshDiff.status.length === 0, JSON.stringify(freshDiff.status));

  // diff endpoint: make a tracked change in the lane, expect it in the diff
  await Bun.write(`${wtDir}/code.txt`, "root\nlane-edit\n");
  const diff = (await (await get("/api/slots/5/diff")).json()) as { branch: string; status: string[]; diff: string };
  check("diff endpoint reports branch + changed file", diff.branch === "e2e-lane" && diff.status.some((l) => l.includes("code.txt")), JSON.stringify(diff.status));
  check("diff endpoint returns the tracked change", diff.diff.includes("lane-edit"));
  check("diff rejects non-git slot", (await get("/api/slots/2/diff")).status === 400);

  // land refuses a dirty lane
  const landDirty = await post("/api/slots/5/land", {});
  check("land refuses a dirty worktree", landDirty.status === 409, `status ${landDirty.status}`);

  // commit the change → still no upstream, but the branch is at a commit ahead of HEAD,
  // so land must still refuse (unpushed + not merged)
  const { spawnSync } = await import("node:child_process");
  spawnSync("git", ["-C", wtDir, "commit", "-aqm", "lane work"]);
  const landUnpushed = await post("/api/slots/5/land", {});
  check("land refuses unpushed commits", landUnpushed.status === 409, `status ${landUnpushed.status}`);

  // pushing the lane to a remote (WITHOUT -u/upstream) must make land succeed — the work is
  // preserved on the remote even though @{push} is unresolvable. Regression for the
  // over-strict no-upstream fallback.
  const bare = `${REPO}.remote.git`;
  spawnSync("git", ["init", "--bare", "-q", bare]);
  spawnSync("git", ["-C", wtDir, "remote", "add", "origin", bare]);
  spawnSync("git", ["-C", wtDir, "push", "-q", "origin", "e2e-lane"]); // no -u: creates refs/remotes/origin/*
  const landPushed = await post("/api/slots/5/land", {});
  check("land accepts a lane pushed to a remote (no upstream set)", landPushed.ok, await landPushed.text());
  check("pushed lane removed from disk", !((): boolean => { try { return statSync(wtDir).isDirectory(); } catch { return false; } })());

  // a lane clean AND merged into HEAD (fresh lane at HEAD) lands cleanly. Open a second one.
  const wt2 = await post("/api/slots/6/open-worktree", { repo: REPO, branch: "e2e-clean" });
  check("second clean lane opens", wt2.ok);
  const landClean = await post("/api/slots/6/land", {});
  check("land removes a clean, merged lane", landClean.ok, await landClean.text());
  check("landed slot is now inactive", (await (await get("/api/sessions")).json() as { slots: { cwd: string | null }[] }).slots[5].cwd === null);
  check("landed worktree removed from disk", !((): boolean => { try { return statSync(`${REPO}.worktrees/e2e-clean`).isDirectory(); } catch { return false; } })());
  check("land rejects a non-worktree slot", (await post("/api/slots/2/land", {})).status === 400);
}

// --- task queue (Phase D). Owner CRUD + dispatch availability ---
const tCreate = await post("/api/tasks", { text: "e2e owner task", queue: false });
const tJson = (await tCreate.json()) as { ok: boolean; task: { id: string; status: string; source: string } };
check("create owner task as pending", tCreate.ok && tJson.task.status === "pending" && tJson.task.source === "owner");
check("queue a task", (await post(`/api/tasks/${tJson.task.id}/queue`, {})).ok);
const sessT = (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string }[]; dispatch: { available: boolean; on: boolean } };
check("queued task reflected in sessions", sessT.tasks.some((t) => t.id === tJson.task.id && t.status === "queued"));
check("dispatch reports available when repo set", sessT.dispatch.available === true);
check("unqueue a task", (await post(`/api/tasks/${tJson.task.id}/unqueue`, {})).ok);
check("delete a task", (await post(`/api/tasks/${tJson.task.id}/delete`, {})).ok);
check("deleted task gone", !(await (await get("/api/sessions")).json() as { tasks: { id: string }[] }).tasks.some((t) => t.id === tJson.task.id));
const dispOff = await post("/api/dispatch", { on: false });
check("dispatch toggle endpoint works", dispOff.ok);

// --- intake (Phase E). Public dropbox, own secret, pending-only ---
const INTAKE = process.env.FLEET_INTAKE_SECRET ?? "";
if (INTAKE) {
  const noSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "x" }) });
  check("intake without secret is 401", noSecret.status === 401);
  const wrongSecret = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": "nope" }, body: JSON.stringify({ text: "x" }) });
  check("intake with wrong secret is 401", wrongSecret.status === 401);
  const ok = await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": INTAKE }, body: JSON.stringify({ text: "CEO wants dark mode", from: "ceo@acme.co" }) });
  check("intake with secret accepts", ok.ok);
  const sessI = (await (await get("/api/sessions")).json()) as { tasks: { text: string; source: string; from: string | null; status: string }[]; intake: boolean };
  const it = sessI.tasks.find((t) => t.text === "CEO wants dark mode");
  check("intake task lands as pending from intake source", !!it && it.status === "pending" && it.source === "intake" && it.from === "ceo@acme.co", JSON.stringify(it));
  check("sessions reports intake enabled", sessI.intake === true);
  check("intake rejects empty text", (await fetch(BASE + "/intake", { method: "POST", headers: { "content-type": "application/json", "x-intake-secret": INTAKE }, body: JSON.stringify({ text: "   " }) })).status === 400);
}

const SHARE_HOST = process.env.FLEET_SHARE_HOSTS ?? "";
if (SHARE_HOST) {
  // intake is the one write path reachable on the public share host
  if (INTAKE) {
    const pubIntake = await fetch(BASE + "/intake", { method: "POST",
      headers: { host: SHARE_HOST, "content-type": "application/json", "x-intake-secret": INTAKE },
      body: JSON.stringify({ text: "via share host", from: "x" }) });
    check("intake reachable on the share host", pubIntake.ok);
    check("share host still blocks task API (owner-only)", (await fetch(BASE + "/api/tasks", { method: "POST",
      headers: { host: SHARE_HOST, ...H, "content-type": "application/json" }, body: JSON.stringify({ text: "y" }) })).status === 404);
  }
  const landing = await fetch(BASE + "/", { headers: { host: SHARE_HOST } });
  const landingBody = await landing.text();
  check("share host hides the dashboard", landing.status === 200 && landingBody.includes("klaus — live sessions") && !landingBody.includes("app.js"),
    `status ${landing.status}`);
  check("share host hides the manifest", (await fetch(BASE + "/manifest.webmanifest", { headers: { host: SHARE_HOST } })).status === 404);
  const sPub = await fetch(BASE + `/s/${shView.id}`, { headers: { host: SHARE_HOST } });
  check("share host serves the share page", sPub.status === 200 && (await sPub.text()).includes("share.js"));
  check("share host blocks owner API even with token", (await fetch(BASE + "/api/sessions", { headers: { host: SHARE_HOST, ...H } })).status === 404);
  // --- regression: the share-only allowlist regex must not be widenable via path tricks.
  // A plain fetch() normalizes "../" client-side before the request is even sent — but the
  // server parses req.url through the same WHATWG URL rules (verified directly: dot-segments
  // collapse identically whether resolved by the client or the server), so this still guards
  // the real end-to-end invariant. The other two send bytes fetch does NOT pre-normalize,
  // reaching the server's own matching logic unmodified. ---
  check("share host: dot-segment traversal to owner API blocked", (await fetch(BASE + `/s/${shView.id}/../../api/sessions`,
    { headers: { host: SHARE_HOST, ...H } })).status === 404);
  check("share host: encoded-slash path does not decode into a bypass", (await fetch(BASE + `/s/${shView.id}%2f..%2fapi%2fsessions`,
    { headers: { host: SHARE_HOST, ...H } })).status === 404);
  check("share host: uppercase share id does not bypass the lowercase-only regex", (await fetch(BASE + `/s/${shView.id.toUpperCase()}`,
    { headers: { host: SHARE_HOST } })).status === 404);
}
const unshare = await post("/api/slots/2/unshare", {});
check("unshare accepted", unshare.ok);
check("revoked share is gone", (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shCookie } })).status === 404);
const shPersistRes = await post("/api/slots/2/share", { mode: "view", password: "persistpass1" });
const shPersist = (await shPersistRes.json()) as { id: string };
check("re-share after revoke", shPersistRes.ok && !!shPersist.id);

// --- file permissions ---
const streamMode = statSync(`${import.meta.dir}/streams/s1.raw`).mode & 0o777;
const stateMode = statSync(`${import.meta.dir}/fleet.json`).mode & 0o777;
check("stream file is 600", streamMode === 0o600, streamMode.toString(8));
check("fleet.json is 600", stateMode === 0o600, stateMode.toString(8));
const histMode = statSync(`${import.meta.dir}/streams/s2.history.json`).mode & 0o777;
check("history file is 600", histMode === 0o600, histMode.toString(8));

// --- kill semantics ---
const k1 = await post("/api/slots/1/kill", {});
check("kill slot 1 accepted", k1.ok);
await Bun.sleep(4000);
const s1dead = await tmuxOut("has-session", "-t", "s1");
check("killed slot stays dead after 4s", s1dead.code !== 0);
check("killed slot's share died with it", (await fetch(BASE + `/s/${shInt.id}/info`, { headers: { cookie: shICookie } })).status === 404);

await tmuxOut("kill-session", "-t", "s2");
await Bun.sleep(4500);
const s2back = await tmuxOut("has-session", "-t", "s2");
check("externally-killed slot self-heals", s2back.code === 0);

// --- restart persistence ---
const srvKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
await srvKill.exited;
await Bun.sleep(500);
// inherit FLEET_CMD rather than hardcoding one — restarting with a baked-in
// `--dangerously-skip-permissions` would silently leave the server in unattended
// mode after the test run, an escalation the README promises is explicit opt-in
const cmdEnv = ["FLEET_CMD", "FLEET_ALLOWED_HOSTS", "FLEET_SHARE_HOSTS"]
  .filter((k) => process.env[k])
  .map((k) => `${k}='${process.env[k]!.replaceAll("'", "'\\''")}' `)
  .join("");
// restart the server from wherever THIS suite lives (the isolated copy during
// e2e-isolated.sh runs, the repo itself when run against the live instance),
// carrying the port/socket so the restarted server is the same instance we tested
const srvStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
  `cd '${import.meta.dir}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}exec bun server.ts >> server.log 2>&1`]);
await srvStart.exited;
await Bun.sleep(3000);
const api = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
check("after restart: slot 2 still active", typeof api.slots[1].cwd === "string", String(api.slots[1].cwd));
check("after restart: slot 1 still empty", api.slots[0].cwd === null);
check("after restart: label persisted", api.slots[1].label === "research-agent");
const rec2 = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
check("after restart: recents persisted", rec2.recents.length >= 2, JSON.stringify(rec2.recents));
const h2b = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
check("after restart: history persisted", h2b.history.some((h) => h.text === "compose-box-to-slot-two"), `${h2b.history.length} entries`);
const plogAfter = await plogRead();
check("after restart + slot kills: prompt log intact",
  plogAfter.some((e) => e.text === "compose-box-to-slot-two") && plogAfter.some((e) => e.source === "share"), `${plogAfter.length} entries`);
const shPAuth = await post(`/s/${shPersist.id}/auth`, { password: "persistpass1" });
check("after restart: share persisted and answers", shPAuth.ok);
const sess3 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean }[] };
check("after restart: schedule persisted", sess3.autos.some((a) => a.id === aPersistJ.auto.id && a.enabled));
const replay2 = await new Promise<number>((resolve) => {
  let n = 0;
  const ws = new WebSocket(wsUrl(2));
  ws.binaryType = "arraybuffer";
  ws.onmessage = (e) => { n += (e.data as ArrayBuffer).byteLength; };
  ws.onopen = () => setTimeout(() => { ws.close(); resolve(n); }, 2000);
  ws.onerror = () => resolve(-1);
});
check("after restart: WS replay for slot 2 non-empty", replay2 > 100, `${replay2} bytes`);
const ws404 = await get("/ws/1");
check("WS route rejects inactive slot", ws404.status === 404);

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

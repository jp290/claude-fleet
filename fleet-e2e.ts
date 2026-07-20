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
// --- ✨ enhance (FLEET_ENHANCE_CMD stand-in): draft in → reworked prompt out ---
check("enhance rejects empty text", (await post("/api/enhance", { text: "  " })).status === 400);
const enhRes = await post("/api/enhance", { slot: 1, text: "mach mal x" });
const enhJ = (await enhRes.json()) as { prompt?: string };
check("enhance returns reworked prompt via stand-in",
  enhRes.ok && enhJ.prompt === "enhanced prompt. own your work! /sharpen3", JSON.stringify(enhJ));
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

// --- /api/prompts: the global prompt directory served from that log, newest first ---
const pd = (await (await get("/api/prompts")).json()) as { prompts: { ts: number; slot: number; text: string }[]; total: number };
check("prompt directory returns all logged prompts", pd.prompts.length === plog1.length && pd.total === plog1.length,
  `${pd.prompts.length}/${plog1.length}`);
check("prompt directory is newest-first", pd.prompts.every((e, i) => i === 0 || pd.prompts[i - 1].ts >= e.ts));
check("prompt directory includes closed-slot prompts", pd.prompts.some((e) => e.slot === 3 && e.text.includes("__pwn=1")));
const pdLim = (await (await get("/api/prompts?limit=1")).json()) as { prompts: unknown[]; total: number };
check("prompt directory respects limit", pdLim.prompts.length === 1 && pdLim.total === pd.total);
const pdQ = (await (await get("/api/prompts?q=compose-box")).json()) as { prompts: { text: string }[] };
check("prompt directory filters by q", pdQ.prompts.length >= 1 && pdQ.prompts.every((e) => e.text.includes("compose-box")));
const pdNone = (await (await get("/api/prompts?q=zz-no-such-prompt-zz")).json()) as { prompts: unknown[] };
check("prompt directory q with no hits is empty", pdNone.prompts.length === 0);

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

// --- ✨ summary agent (FLEET_SUMMARY_CMD points at a stand-in that answers in
// claude -p's json envelope — tests the real gather→spawn→parse→cache pipeline) ---
const sm0 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; summary?: string };
check("summary GET before any run → cache miss, no spawn", sm0.cached === false && sm0.summary === undefined);
const sm1res = await post("/api/slots/1/summary", {});
const sm1 = (await sm1res.json()) as { summary: string; openThreads: string[]; verification: string;
  cached: boolean; raw: boolean; head: string | null };
check("summary POST runs the agent and parses strict JSON",
  sm1res.ok && sm1.summary === "fake summary of the session" && sm1.raw === false,
  JSON.stringify(sm1).slice(0, 140));
check("summary carries openThreads + verification",
  sm1.openThreads.length === 1 && sm1.openThreads[0] === "thread-a" && sm1.verification === "none seen");
check("summary pins the git state it ran on", typeof sm1.head === "string" && /^[0-9a-f]{40}$/.test(sm1.head ?? ""));
check("summary first run is uncached", sm1.cached === false);
const sm2 = (await (await post("/api/slots/1/summary", {})).json()) as { cached: boolean; summary: string };
check("summary cache hit on unchanged git state", sm2.cached === true && sm2.summary === sm1.summary);
const sm3 = (await (await get("/api/slots/1/summary")).json()) as { cached: boolean; stale: boolean };
check("summary GET now serves the cache", sm3.cached === true && sm3.stale === false);
check("summary rejects inactive slot", (await post("/api/slots/4/summary", {})).status === 400);

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
// guest "± changes" view: read-only working diff behind the share cookie (slot 1 is a git repo)
const shDiff = await fetch(BASE + `/s/${shInt.id}/diff`, { headers: { cookie: shICookie } });
const shDiffJ = (await shDiff.json()) as { branch?: string | null; status?: string[]; diff?: string; commits?: unknown };
check("share diff readable with share cookie", shDiff.ok && typeof shDiffJ.branch === "string"
  && Array.isArray(shDiffJ.status) && typeof shDiffJ.diff === "string", JSON.stringify(shDiffJ).slice(0, 120));
check("share diff carries session commits", Array.isArray(shDiffJ.commits), JSON.stringify(shDiffJ.commits).slice(0, 80));
check("share diff without cookie 401", (await fetch(BASE + `/s/${shInt.id}/diff`)).status === 401);
// guest info tab: session overview behind the share cookie, minus local filesystem details
const shBrief = await fetch(BASE + `/s/${shInt.id}/brief`, { headers: { cookie: shICookie } });
const shBriefJ = (await shBrief.json()) as { branch?: unknown; commits?: unknown; files?: unknown };
check("share brief readable with share cookie", shBrief.ok && typeof shBriefJ.branch === "string"
  && Array.isArray(shBriefJ.commits) && Array.isArray(shBriefJ.files), JSON.stringify(shBriefJ).slice(0, 100));
check("share brief hides local paths (no worktree field)", !("worktree" in shBriefJ));
check("share brief without cookie 401", (await fetch(BASE + `/s/${shInt.id}/brief`)).status === 401);
check("share cookie scoped to its own share only", (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shICookie } })).status === 401);

// --- guest comments: allowed in BOTH modes (they type nothing), owner-moderated ---
const cmtPost = await fetch(BASE + `/s/${shView.id}/comments`, {
  method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
  body: JSON.stringify({ name: "kiebitz", text: "guest-comment-hello" }),
});
const cmtPostJ = (await cmtPost.json()) as { comment?: { id: string } };
check("view-mode guest can post a comment", cmtPost.ok && !!cmtPostJ.comment?.id, JSON.stringify(cmtPostJ));
const cmtListJ = (await (await fetch(BASE + `/s/${shView.id}/comments`, { headers: { cookie: shCookie } })).json()) as
  { comments: { id: string; name: string; text: string }[] };
check("guest sees the posted comment", cmtListJ.comments.some((c) => c.name === "kiebitz" && c.text === "guest-comment-hello"));
check("comments without cookie 401", (await fetch(BASE + `/s/${shView.id}/comments`)).status === 401);
check("comments on unknown share 404", (await fetch(BASE + "/s/nosuchshare0/comments")).status === 404);
check("empty comment rejected", (await fetch(BASE + `/s/${shView.id}/comments`, {
  method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
  body: JSON.stringify({ text: "   " }),
})).status === 400);
check("oversized comment rejected", (await fetch(BASE + `/s/${shView.id}/comments`, {
  method: "POST", headers: { cookie: shCookie, "content-type": "application/json" },
  body: JSON.stringify({ text: "x".repeat(2001) }),
})).status === 400);
const shInfoC = (await (await fetch(BASE + `/s/${shView.id}/info`, { headers: { cookie: shCookie } })).json()) as
  { viewers?: number; comments?: number };
check("share info reports viewers + comment count", typeof shInfoC.viewers === "number" && shInfoC.comments === 1, JSON.stringify(shInfoC));
check("owner comments route needs token", (await fetch(BASE + "/api/slots/2/comments")).status === 401);
const ownCmts = (await (await get("/api/slots/2/comments")).json()) as { comments: { id: string }[] };
check("owner reads the share thread", ownCmts.comments.length === 1, JSON.stringify(ownCmts));
const sessCmt = (await (await get("/api/sessions")).json()) as { slots: { id: number; share: { comments: number } | null }[] };
check("sessions payload carries comment count", sessCmt.slots.find((x) => x.id === 2)?.share?.comments === 1);
check("owner deletes a comment", (await post(`/api/slots/2/comments/${cmtPostJ.comment?.id ?? "x"}/delete`, {})).ok);
const ownCmts2 = (await (await get("/api/slots/2/comments")).json()) as { comments: unknown[] };
check("deleted comment gone", ownCmts2.comments.length === 0);
// owner reply: lands in the same thread, marked, readable by guests
const orep = await post("/api/slots/2/comments", { text: "owner-reply-check" });
const orepJ = (await orep.json()) as { comment?: { id: string; from?: string } };
check("owner reply posts into the thread marked from=owner", orep.ok && orepJ.comment?.from === "owner", JSON.stringify(orepJ));
const cmtAfterReply = (await (await fetch(BASE + `/s/${shView.id}/comments`, { headers: { cookie: shCookie } })).json()) as
  { comments: { text: string; from?: string }[] };
check("guest sees the owner reply", cmtAfterReply.comments.some((c) => c.text === "owner-reply-check" && c.from === "owner"));
check("owner empty reply rejected", (await post("/api/slots/2/comments", { text: "   " })).status === 400);
// guest ✨ summary: same single-flight/cache contract as the owner endpoint
check("share summary without cookie 401", (await fetch(BASE + `/s/${shInt.id}/summary`)).status === 401);
const gsum = await fetch(BASE + `/s/${shInt.id}/summary`, { method: "POST", headers: { cookie: shICookie } });
const gsumJ = (await gsum.json()) as { summary?: string };
check("guest summary POST runs the shared agent path", gsum.ok && gsumJ.summary === "fake summary of the session",
  JSON.stringify(gsumJ).slice(0, 80));
const gsumGet = (await (await fetch(BASE + `/s/${shInt.id}/summary`, { headers: { cookie: shICookie } })).json()) as
  { summary?: string; cached?: boolean };
check("guest summary GET serves the cache", gsumGet.summary === "fake summary of the session" && gsumGet.cached === true);
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

  // --- lane lifecycle v2: worktrees map, one-click lanes, orphan flows, ⏫ merge agent ---
  const exists = (p: string): boolean => { try { statSync(p); return true; } catch { return false; } };
  const setMergeMode = (m: string) => Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/mergemode`, m);
  // merge is an async job — poll GET until the run settles; a 400 means the slot was
  // torn down (the job landed the lane), which IS the success signal for `do`
  const waitMerge = async (slot: number): Promise<{ gone: boolean; last: { status: string; detail: string; landed: boolean } | null }> => {
    for (let i = 0; i < 100; i++) {
      const r = await get(`/api/slots/${slot}/merge`);
      if (r.status === 400) return { gone: true, last: null };
      const j = (await r.json()) as { running: boolean; last: { status: string; detail: string; landed: boolean } | null };
      if (!j.running) return { gone: false, last: j.last };
      await Bun.sleep(100);
    }
    return { gone: false, last: null };
  };

  // one-click lane: the server picks the free slot and auto-names the branch
  const ln1res = await post("/api/lanes", { repo: REPO });
  const ln1 = (await ln1res.json()) as { ok?: boolean; slot?: number; branch?: string; cwd?: string; error?: string };
  check("POST /api/lanes creates a lane in a server-picked free slot",
    ln1res.ok && typeof ln1.slot === "number" && (ln1.branch ?? "").startsWith("fleet/"), JSON.stringify(ln1));
  const lnSlot = ln1.slot ?? 0;
  const lnPath = ln1.cwd ?? "";
  check("lanes slot is tagged as a worktree lane",
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; worktree: { branch: string } | null }[] })
      .slots.find((x) => x.id === lnSlot)?.worktree?.branch === ln1.branch);

  // the lane map: repo-wide worktree list with slot attribution, queryable FROM the lane
  const wm = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as
    { repo: string; main: string; worktrees: { path: string; branch: string; slot: number | null; dirty: number; ahead: number }[] };
  check("worktrees map: primary repo + main branch resolved from a lane slot",
    wm.repo.endsWith("/testrepo") && (wm.main === "main" || wm.main === "master"), JSON.stringify({ repo: wm.repo, main: wm.main }));
  check("worktrees map lists the lane with its holding slot",
    wm.worktrees.some((w) => w.slot === lnSlot && w.branch === ln1.branch), JSON.stringify(wm.worktrees));

  // ⏫ merge: dirty lane → deterministic block, no agent run
  await Bun.write(`${lnPath}/code.txt`, "root\nmerge-work\n");
  const mgDirty = (await (await post(`/api/slots/${lnSlot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("merge blocks a dirty lane deterministically",
    mgDirty.status === "blocked" && (mgDirty.detail ?? "").includes("uncommitted"), JSON.stringify(mgDirty));

  spawnSync("git", ["-C", lnPath, "commit", "-aqm", "merge work"]);
  // diverge main AFTER the lane's commit: a lane that was never rebased is now NOT a
  // descendant of main, so a lying "rebased" claim is deterministically detectable
  await Bun.write(`${REPO}/other.txt`, "mainline\n");
  spawnSync("git", ["-C", REPO, "add", "other.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "mainline work"]);

  await setMergeMode("blocked");
  const mgB = await post(`/api/slots/${lnSlot}/merge`, {});
  check("merge POST starts an async job", ((await mgB.json()) as { running?: boolean }).running === true);
  const vB = await waitMerge(lnSlot);
  check("merge agent 'blocked' verdict passes through with detail",
    !vB.gone && vB.last?.status === "blocked" && vB.last.detail === "fake conflict", JSON.stringify(vB));

  await setMergeMode("lie");
  await post(`/api/slots/${lnSlot}/merge`, {});
  const vL = await waitMerge(lnSlot);
  check("merge re-verifies the rebase claim — lying agent → error, lane kept",
    !vL.gone && vL.last?.status === "error" && exists(lnPath), JSON.stringify(vL.last));

  await setMergeMode("do");
  await post(`/api/slots/${lnSlot}/merge`, {});
  const vD = await waitMerge(lnSlot);
  check("agent rebases → server ff-merges + lands, slot torn down", vD.gone, JSON.stringify(vD));
  check("merged lane removed from disk", !exists(lnPath));
  const mainLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("main received the lane's commit on top of the diverged mainline",
    mainLog.includes("merge work") && mainLog.includes("mainline work"), mainLog.trim());
  check("merge rejects a non-lane slot", (await post("/api/slots/2/merge", {})).status === 400);

  // a correct rebase answered in PROSE must not be thrown away: git verification is the
  // authority, the agent's JSON is only narrative (seen live — injection-distracted agent
  // rebased perfectly, then narrated instead of answering the contract)
  const lnP = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnP.cwd}/prose.txt`, "prose-lane-work\n");
  spawnSync("git", ["-C", lnP.cwd, "add", "prose.txt"]);
  spawnSync("git", ["-C", lnP.cwd, "commit", "-qm", "prose lane work"]);
  await Bun.write(`${REPO}/other.txt`, "mainline\nmoved again\n");
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "mainline moves again"]);
  await setMergeMode("prose");
  await post(`/api/slots/${lnP.slot}/merge`, {});
  const vP = await waitMerge(lnP.slot);
  check("off-contract agent answer over a git-verified rebase still merges + lands", vP.gone, JSON.stringify(vP));
  check("prose-merged lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("prose lane work"));

  // orphan flow: a killed lane's worktree survives on disk, shows slot:null in the map,
  // can be reattached into a fresh slot (landable again) or safely removed
  const ln2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await post(`/api/slots/${ln2.slot}/kill`, {});
  check("killed lane's worktree survives on disk", exists(ln2.cwd));
  const probeRes = await post("/api/lanes", { repo: REPO }); // any repo slot can read the map
  const probe = (await probeRes.json()) as { slot: number; cwd: string };
  const wm2 = (await (await get(`/api/slots/${probe.slot}/worktrees`)).json()) as
    { worktrees: { path: string; branch: string; slot: number | null }[] };
  check("orphaned worktree listed with slot null",
    wm2.worktrees.some((w) => w.branch === ln2.branch && w.slot === null), JSON.stringify(wm2.worktrees));
  const att = await post("/api/lanes", { repo: REPO, attach: ln2.cwd });
  const attJ = (await att.json()) as { ok?: boolean; slot?: number; branch?: string; error?: string };
  check("orphan reattaches into a free slot with its lane tag intact",
    att.ok && attJ.branch === ln2.branch, JSON.stringify(attJ));
  check("attach refuses a worktree already open in a slot",
    (await post("/api/lanes", { repo: REPO, attach: ln2.cwd })).status === 409);
  check("reattached orphan lands (clean, merged)", (await post(`/api/slots/${attJ.slot}/land`, {})).ok);

  // removal path: dirty orphan refused, clean orphan dropped; slot-held worktree refused
  const ln3 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  check("remove refuses a worktree still open in a slot",
    (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).status === 409);
  await post(`/api/slots/${ln3.slot}/kill`, {});
  await Bun.write(`${ln3.cwd}/code.txt`, "root\ndirty-orphan\n");
  check("remove refuses a dirty orphan",
    (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).status === 409);
  spawnSync("git", ["-C", ln3.cwd, "checkout", "-q", "--", "code.txt"]);
  check("remove drops a clean orphan", (await post("/api/worktrees/remove", { repo: REPO, path: ln3.cwd })).ok);
  check("removed orphan gone from disk", !exists(ln3.cwd));
  await post(`/api/slots/${probe.slot}/land`, {}); // clean up the probe lane too
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

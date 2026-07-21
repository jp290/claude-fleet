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
const dirs2 = (await (await get("/api/dirs?path=~")).json()) as { pins: string[]; worktrees: string[]; repos: string[] };
check("/api/dirs exposes pins + worktrees arrays", Array.isArray(dirs2.pins) && Array.isArray(dirs2.worktrees) && Array.isArray(dirs2.repos));

// --- pins ---
const pinPath = `${process.env.HOME}/claude-fleet`;
const pinAdd = (await (await post("/api/pins", { path: pinPath, on: true })).json()) as { ok: boolean; pins: string[] };
check("pin add returns updated list", pinAdd.ok === true && pinAdd.pins.includes(pinPath), JSON.stringify(pinAdd.pins));
const dirsPinned = (await (await get("/api/dirs?path=~")).json()) as { pins: string[] };
check("/api/dirs surfaces the pin", dirsPinned.pins.includes(pinPath));
const pinDup = (await (await post("/api/pins", { path: pinPath, on: true })).json()) as { pins: string[] };
check("re-pinning does not duplicate", pinDup.pins.filter((p) => p === pinPath).length === 1, JSON.stringify(pinDup.pins));
const pinBad = await post("/api/pins", { path: "  " });
check("pin rejects empty path", pinBad.status === 400);
const pinDel = (await (await post("/api/pins", { path: pinPath, on: false })).json()) as { pins: string[] };
check("unpin removes it", !pinDel.pins.includes(pinPath), JSON.stringify(pinDel.pins));

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
// guest reader: transcript is share-gated like every other share resource
check("share transcript without cookie 401", (await fetch(BASE + `/s/${shView.id}/transcript`)).status === 401);
{
  const tr = await fetch(BASE + `/s/${shView.id}/transcript?after=0`, { headers: { cookie: shCookie } });
  const trJ = (await tr.json()) as { entries?: unknown[]; total?: number };
  check("share transcript answers with entries+total for an authed guest",
    tr.ok && Array.isArray(trJ.entries) && typeof trJ.total === "number", JSON.stringify(trJ).slice(0, 80));
}
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
// carried across the server restart below to guard fix A: a lane's selfToken must be
// persisted + restored, else the lane pane (which keeps its OLD baked token across a
// deploy) can never match the fresh in-memory slot and /api/self/autos 401s forever
let restartSelfTok: string | null = null;
let restartSelfSlot = 0;
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

  // FIX 9 adds an idle gate: a merge is refused while the pane produced output within
  // MERGE_IDLE_MS (3s). A freshly-spawned lane pane emits its shell prompt, so wait until
  // the slot's lastOutput is stale enough before firing a merge that must start a job.
  // Deterministic: polls the server's own clock/lastOutput, returns the instant it clears.
  const MERGE_IDLE_MS = 3000;
  const settleForMerge = async (slot: number): Promise<void> => {
    for (let i = 0; i < 80; i++) {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === slot);
      if (sl && sx.now - sl.lastOutput >= MERGE_IDLE_MS) return;
      await Bun.sleep(150);
    }
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

  // --- integration-branch config (/api/repo-base): overrides the branch derived from the
  // primary's HEAD, so the primary can be parked off the integration branch. Set to a decoy
  // real branch, confirm the worktrees map reports it, then clear back to derived. ---
  {
    spawnSync("git", ["-C", REPO, "branch", "-f", "integ-decoy", "HEAD"]);
    const setBad = await post("/api/repo-base", { repo: REPO, branch: "no-such-branch" });
    check("repo-base rejects a nonexistent branch", setBad.status === 400, String(setBad.status));
    const setOk = (await (await post("/api/repo-base", { repo: REPO, branch: "integ-decoy" })).json()) as { ok?: boolean; base?: string };
    check("repo-base sets the integration branch", setOk.ok === true && setOk.base === "integ-decoy", JSON.stringify(setOk));
    const wmCfg = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map reflects the configured integration branch", wmCfg.main === "integ-decoy", wmCfg.main);
    const clr = (await (await post("/api/repo-base", { repo: REPO, branch: "" })).json()) as { base: string | null };
    check("repo-base clears back to derived (null)", clr.base === null, JSON.stringify(clr));
    const wmClr = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { main: string };
    check("worktrees map derives main again after clear", wmClr.main === "main" || wmClr.main === "master", wmClr.main);
  }

  // --- issue 2: risk/merged checks measure against the integration branch, not the primary's
  // HEAD. A lane merged into a CONFIGURED integration branch (distinct from main) must read as
  // safe-to-remove — otherwise landLane's own removeWorktreeSafe would wedge after a
  // ref-advance land (lane merged into main, but primary HEAD parked elsewhere). ---
  {
    const l2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${l2.cwd}/issue2.txt`, "work\n");
    spawnSync("git", ["-C", l2.cwd, "add", "issue2.txt"]);
    spawnSync("git", ["-C", l2.cwd, "commit", "-qm", "issue2 lane work"]);
    // an integration branch that already CONTAINS the lane (points at its tip), unlike main
    spawnSync("git", ["-C", REPO, "branch", "intb", l2.branch]);
    // baseline (unconfigured → integration branch = main): the lane's commit is unmerged
    const riskBefore = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane reads as unpushed vs main before config", riskBefore.unpushedCommits.length === 1 && riskBefore.empty === false,
      JSON.stringify(riskBefore));
    // configure integration branch = intb (which contains the lane) → lane now reads merged/safe
    await post("/api/repo-base", { repo: REPO, branch: "intb" });
    const riskAfter = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane merged into the configured integration branch reads as safe (no unpushed)",
      riskAfter.unpushedCommits.length === 0 && riskAfter.empty === true, JSON.stringify(riskAfter));
    await post("/api/repo-base", { repo: REPO, branch: "" }); // clear config
    spawnSync("git", ["-C", REPO, "branch", "-D", "intb"]);
    await post(`/api/slots/${l2.slot}/kill`, {});
  }

  // --- lane brief must be LANE-SCOPED and match git exactly (regression: it used to show
  // the base branch's whole history for lanes, and truncated the first uncommitted file) ---
  {
    const bl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    // two lane commits on top of the base
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-a.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit one"]);
    await Bun.write(`${bl.cwd}/lane-b.txt`, "b\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-b.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit two"]);
    // main diverges on a file the lane never touched (regression bait for two-dot footprint)
    await Bun.write(`${REPO}/divergent.txt`, "main only\n");
    spawnSync("git", ["-C", REPO, "add", "divergent.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "main divergence"]);
    // mixed uncommitted work: unstaged modify (leading-space porcelain), staged add, untracked
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a changed\n");
    await Bun.write(`${bl.cwd}/lane-staged.txt`, "s\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-staged.txt"]);
    await Bun.write(`${bl.cwd}/lane-untracked.txt`, "u\n");

    const blb = (await (await get(`/api/slots/${bl.slot}/brief`)).json()) as
      { laneScoped: boolean; laneBase: string; ahead: number; behind: number;
        commits: { subject: string }[]; files: string[]; uncommittedFiles: string[] };
    // git truth for comparison
    const gitCommits = spawnSync("git", ["-C", bl.cwd, "log", "--format=%s", `${blb.laneBase}..HEAD`]).stdout.toString().split("\n").filter(Boolean);
    const gitStatus = spawnSync("git", ["-C", bl.cwd, "status", "--porcelain"]).stdout.toString().split("\n").filter(Boolean);
    const gitFootprint = spawnSync("git", ["-C", bl.cwd, "diff", "--name-only", `${blb.laneBase}...HEAD`]).stdout.toString().split("\n").filter(Boolean);

    check("lane brief is laneScoped with the base branch", blb.laneScoped === true && (blb.laneBase === "main" || blb.laneBase === "master"));
    check("lane commits = git main..HEAD exactly (no base history)",
      blb.commits.map((c) => c.subject).join("|") === gitCommits.join("|")
      && blb.commits.length === 2 && !blb.commits.some((c) => c.subject.startsWith("main:")),
      `brief=${JSON.stringify(blb.commits.map((c) => c.subject))} git=${JSON.stringify(gitCommits)}`);
    check("lane ahead/behind vs base match git (ahead 2, behind 1)", blb.ahead === 2 && blb.behind === 1,
      `ahead=${blb.ahead} behind=${blb.behind}`);
    check("lane footprint is three-dot (only lane's own files, not main's divergence)",
      blb.files.map((f) => f.slice(3)).sort().join(",") === gitFootprint.sort().join(",")
      && !blb.files.some((f) => f.includes("divergent.txt")),
      `brief=${JSON.stringify(blb.files)} git=${JSON.stringify(gitFootprint)}`);
    check("lane uncommittedFiles match git status byte-for-byte (columns preserved)",
      blb.uncommittedFiles.join("\n") === gitStatus.join("\n"),
      `brief=${JSON.stringify(blb.uncommittedFiles)} git=${JSON.stringify(gitStatus)}`);
    check("first uncommitted entry keeps its leading status column (not truncated)",
      blb.uncommittedFiles.some((f) => f === " M lane-a.txt"), JSON.stringify(blb.uncommittedFiles));
    await post(`/api/slots/${bl.slot}/kill`, {}); // free the slot; worktree orphaned in the throwaway repo
  }

  // --- 💾 commit endpoint: a LANE stages untracked too (add -A), a MAIN (non-lane) session
  // stages tracked only (add -u) so scratch/secrets never sweep into a shipped branch, and a
  // detached HEAD is refused. All on throwaway repos — never the real checkout. ---
  {
    // (a) lane commit includes untracked → clean tree afterwards
    const cl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cl.cwd}/tracked.txt`, "x\n");
    spawnSync("git", ["-C", cl.cwd, "add", "tracked.txt"]);
    spawnSync("git", ["-C", cl.cwd, "commit", "-qm", "seed"]);
    await Bun.write(`${cl.cwd}/tracked.txt`, "x changed\n");    // tracked modify
    await Bun.write(`${cl.cwd}/fresh-untracked.txt`, "u\n");    // untracked
    const clRes = (await (await post(`/api/slots/${cl.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean };
    const clStatus = spawnSync("git", ["-C", cl.cwd, "status", "--porcelain"]).stdout.toString().trim();
    check("lane commit stages untracked too (add -A) → clean tree", clRes.committed === true && clStatus === "",
      `committed=${clRes.committed} status=${JSON.stringify(clStatus)}`);
    await post(`/api/slots/${cl.slot}/kill`, {});

    // (b) main-session commit stages tracked only (add -u), leaves untracked alone
    const mainRepo = `${REPO}.commit-main`;
    spawnSync("git", ["init", "-q", mainRepo]);
    spawnSync("git", ["-C", mainRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", mainRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${mainRepo}/f.txt`, "1\n");
    spawnSync("git", ["-C", mainRepo, "add", "f.txt"]);
    spawnSync("git", ["-C", mainRepo, "commit", "-qm", "init"]);
    await post("/api/slots/9/kill", {}); // ensure the slot is free before opening
    const mOpen = await post("/api/slots/9/open", { cwd: mainRepo });
    check("open a main (non-lane) session for commit test", mOpen.ok, JSON.stringify(await mOpen.json().catch(() => ({}))));
    await Bun.write(`${mainRepo}/f.txt`, "2\n");                 // tracked modify
    await Bun.write(`${mainRepo}/scratch.txt`, "secret\n");     // untracked — must NOT be committed
    const mRes = (await (await post("/api/slots/9/commit", { mode: "quick" })).json()) as { committed?: boolean };
    const mStatus = spawnSync("git", ["-C", mainRepo, "status", "--porcelain"]).stdout.toString();
    check("main-session commit stages tracked (add -u), leaves untracked untracked",
      mRes.committed === true && /\?\? scratch\.txt/.test(mStatus) && !/f\.txt/.test(mStatus),
      `committed=${mRes.committed} status=${JSON.stringify(mStatus)}`);

    // (c) a detached HEAD is refused (would otherwise be a dangling commit)
    spawnSync("git", ["-C", mainRepo, "checkout", "-q", "--detach"]);
    await Bun.write(`${mainRepo}/f.txt`, "3\n");
    const dRes = (await (await post("/api/slots/9/commit", { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
    check("commit refuses a detached HEAD", dRes.committed === false && (dRes.reason ?? "").includes("detached"), JSON.stringify(dRes));
    await post("/api/slots/9/kill", {});

    // (d) an interrupted rebase is surfaced (brief.gitOp) and blocks commit — restart-recovery
    // detection. Isolated repo so the induced conflict never touches the shared test repo.
    const gopRepo = `${REPO}.gitop`;
    spawnSync("git", ["init", "-q", gopRepo]);
    spawnSync("git", ["-C", gopRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", gopRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${gopRepo}/c.txt`, "base\n");
    spawnSync("git", ["-C", gopRepo, "add", "c.txt"]);
    spawnSync("git", ["-C", gopRepo, "commit", "-qm", "base"]);
    const gl = (await (await post("/api/lanes", { repo: gopRepo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${gl.cwd}/c.txt`, "lane side\n");            // lane edit
    spawnSync("git", ["-C", gl.cwd, "commit", "-aqm", "lane edit"]);
    const gopMain = spawnSync("git", ["-C", gopRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    await Bun.write(`${gopRepo}/c.txt`, "main side\n");           // main edits the SAME line → conflict
    spawnSync("git", ["-C", gopRepo, "commit", "-aqm", "main edit"]);
    spawnSync("git", ["-C", gl.cwd, "rebase", gopMain]);          // stops mid-rebase on the conflict
    const glBrief = (await (await get(`/api/slots/${gl.slot}/brief`)).json()) as { gitOp?: boolean };
    check("brief flags an interrupted rebase (gitOp)", glBrief.gitOp === true, JSON.stringify(glBrief.gitOp));
    const glCommit = (await (await post(`/api/slots/${gl.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
    check("commit is blocked during an interrupted rebase", glCommit.committed === false && (glCommit.reason ?? "").includes("in progress"), JSON.stringify(glCommit));
    spawnSync("git", ["-C", gl.cwd, "rebase", "--abort"]);
    await post(`/api/slots/${gl.slot}/kill`, {});
  }

  // ⏫ merge: dirty lane → deterministic block, no agent run
  await Bun.write(`${lnPath}/code.txt`, "root\nmerge-work\n");
  const mgDirty = (await (await post(`/api/slots/${lnSlot}/merge`, {})).json()) as { status?: string; detail?: string };
  check("merge blocks a dirty lane deterministically",
    mgDirty.status === "blocked" && (mgDirty.detail ?? "").includes("uncommitted"), JSON.stringify(mgDirty));

  spawnSync("git", ["-C", lnPath, "commit", "-aqm", "merge work"]);
  // diverge main on the SAME file+lines the lane touched → a genuine rebase conflict, which
  // is the ONLY case that reaches the agent (a conflict-free rebase is done by the server's
  // script pre-pass; that path is covered separately below). The lane is also not a
  // descendant of main, so a lying "rebased" claim stays deterministically detectable.
  await Bun.write(`${REPO}/code.txt`, "root\nmainline-work\n");
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "mainline work"]);

  await setMergeMode("blocked");
  await settleForMerge(lnSlot);
  const mgB = await post(`/api/slots/${lnSlot}/merge`, {});
  check("merge POST starts an async job", ((await mgB.json()) as { running?: boolean }).running === true);
  const vB = await waitMerge(lnSlot);
  check("conflict → agent 'blocked' verdict passes through with detail",
    !vB.gone && vB.last?.status === "blocked" && vB.last.detail === "fake conflict", JSON.stringify(vB));

  await setMergeMode("lie");
  await settleForMerge(lnSlot);
  await post(`/api/slots/${lnSlot}/merge`, {});
  const vL = await waitMerge(lnSlot);
  check("merge re-verifies the rebase claim — lying agent → error, lane kept",
    !vL.gone && vL.last?.status === "error" && exists(lnPath), JSON.stringify(vL.last));

  await setMergeMode("do");
  await settleForMerge(lnSlot);
  await post(`/api/slots/${lnSlot}/merge`, {});
  const vD = await waitMerge(lnSlot);
  check("agent resolves the conflict → PAUSES for review (verified, NOT landed, lane kept)",
    !vD.gone && vD.last?.status === "resolved" && exists(lnPath), JSON.stringify(vD.last));
  const preLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("resolved conflict has NOT reached main before the owner confirms",
    !preLand.includes("merge work"), preLand.trim());
  const md = (await (await get(`/api/slots/${lnSlot}/merge-diff`)).json()) as { files?: string[]; diff?: string };
  check("merge-diff shows exactly what will land (main..HEAD)",
    (md.files ?? []).includes("code.txt") && typeof md.diff === "string", JSON.stringify(md.files));
  // regression (land-check fix): an UNRELATED dirty tracked file in the primary must NOT
  // block the land — git's ff only rewrites the lane's own files (code.txt), so a dirty
  // .gitignore the lane never touched has to be left alone, not wedge the land. The OLD
  // check refused on ANY dirty tracked file and returned status:"blocked" here.
  await Bun.write(`${REPO}/.gitignore`, ".env\n# unrelated dirty edit — must not block the land\n");
  await settleForMerge(lnSlot);
  const conf = await post(`/api/slots/${lnSlot}/merge`, { confirm: true });
  const confJ = (await conf.json()) as { status?: string; landed?: boolean };
  check("owner confirm → server ff-merges the reviewed resolution + tears down the slot",
    conf.ok && confJ.status === "merged" && confJ.landed === true, JSON.stringify(confJ));
  check("land ignores an UNRELATED dirty file in the primary (ff only touches lane files)",
    confJ.status === "merged" && spawnSync("git", ["-C", REPO, "status", "--porcelain"]).stdout.toString().includes(".gitignore"),
    "expected .gitignore to stay dirty AND the land to still succeed");
  spawnSync("git", ["-C", REPO, "checkout", "--", ".gitignore"]); // restore for later checks
  check("confirmed lane removed from disk", !exists(lnPath));
  const mainLog = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
  check("main received the lane's commit on top of the diverged mainline",
    mainLog.includes("merge work") && mainLog.includes("mainline work"), mainLog.trim());
  check("merge rejects a non-lane slot", (await post("/api/slots/2/merge", {})).status === 400);

  // script pre-pass: a conflict-FREE lane is rebased and landed by the server itself, the
  // agent is NEVER spawned. Proof: mergemode is set to "blocked" — if the agent were
  // consulted the lane would be kept, not landed.
  const lnClean = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnClean.cwd}/clean-lane.txt`, "lane side\n");
  spawnSync("git", ["-C", lnClean.cwd, "add", "clean-lane.txt"]);
  spawnSync("git", ["-C", lnClean.cwd, "commit", "-qm", "clean lane work"]);
  await Bun.write(`${REPO}/clean-main.txt`, "main side\n"); // different file → no conflict
  spawnSync("git", ["-C", REPO, "add", "clean-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "clean main work"]);
  await setMergeMode("blocked"); // agent, if wrongly consulted, would block — it must not be
  await settleForMerge(lnClean.slot);
  await post(`/api/slots/${lnClean.slot}/merge`, {});
  const vC = await waitMerge(lnClean.slot);
  check("conflict-free lane merges + lands via the script, agent never consulted", vC.gone, JSON.stringify(vC));
  check("script-path lane commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("clean lane work"));

  // a correct rebase answered in PROSE must not be thrown away: git verification is the
  // authority, the agent's JSON is only narrative (seen live — injection-distracted agent
  // rebased perfectly, then narrated instead of answering the contract). Conflict setup so
  // the agent actually runs.
  const lnP = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnP.cwd}/code.txt`, "root\nprose-lane\n");
  spawnSync("git", ["-C", lnP.cwd, "commit", "-aqm", "prose lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nprose-main\n"); // same file+line → conflict
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "prose main work"]);
  await setMergeMode("prose");
  await settleForMerge(lnP.slot);
  await post(`/api/slots/${lnP.slot}/merge`, {});
  const vP = await waitMerge(lnP.slot);
  check("off-contract agent answer over a git-verified rebase → resolved (paused for review)",
    !vP.gone && vP.last?.status === "resolved", JSON.stringify(vP.last));
  await settleForMerge(lnP.slot);
  check("prose-resolved lane confirms + lands",
    ((await (await post(`/api/slots/${lnP.slot}/merge`, { confirm: true })).json()) as { landed?: boolean }).landed === true);
  check("prose-merged lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("prose lane work"));

  // review gate is git-anchored, not verdict-trust: if main moves between the resolution and
  // the owner's confirm, the ancestry check refuses the land and sends them back to re-run ⏫
  const lnStale = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnStale.cwd}/code.txt`, "root\nstale-lane\n");
  spawnSync("git", ["-C", lnStale.cwd, "commit", "-aqm", "stale lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nstale-main\n"); // conflict → agent runs → resolved
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "stale main work"]);
  await setMergeMode("do");
  await settleForMerge(lnStale.slot);
  await post(`/api/slots/${lnStale.slot}/merge`, {});
  const vSt = await waitMerge(lnStale.slot);
  check("stale-test lane resolved + paused", !vSt.gone && vSt.last?.status === "resolved", JSON.stringify(vSt.last));
  await Bun.write(`${REPO}/moved.txt`, "moved\n"); // main moves AGAIN before confirm
  spawnSync("git", ["-C", REPO, "add", "moved.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "main moved after resolution"]);
  await settleForMerge(lnStale.slot);
  const staleJ = (await (await post(`/api/slots/${lnStale.slot}/merge`, { confirm: true })).json()) as
    { status?: string; detail?: string };
  check("confirm-land refuses when main moved since the resolution",
    staleJ.status === "blocked" && (staleJ.detail ?? "").includes("moved"), JSON.stringify(staleJ));
  await post(`/api/slots/${lnStale.slot}/kill`, {}); // free the slot for the orphan tests below

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

  // ☠ discard path: the deliberate-destruction endpoint MUST take the dirty+unmerged
  // orphan `remove` refuses — and must itself refuse slot-held trees and stale identities
  const ln4 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${ln4.cwd}/junk.txt`, "experiment gone wrong\n");
  spawnSync("git", ["-C", ln4.cwd, "add", "junk.txt"]);
  spawnSync("git", ["-C", ln4.cwd, "commit", "-qm", "unmerged junk"]);
  await Bun.write(`${ln4.cwd}/dirty.txt`, "uncommitted\n");
  const ln4head = spawnSync("git", ["-C", ln4.cwd, "rev-parse", "HEAD"]).stdout.toString().trim();
  check("discard refuses a worktree still open in a slot",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch })).status === 409);
  await post(`/api/slots/${ln4.slot}/kill`, {});
  check("discard refuses on branch mismatch (stale board)",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: "not-the-branch" })).status === 409);
  const discRes = await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch });
  const discJ = (await discRes.json()) as { ok?: boolean; head?: string | null; branchDeleted?: boolean };
  check("discard drops a dirty, unmerged orphan (the case remove refuses)", discRes.ok, JSON.stringify(discJ));
  check("discard returns the pre-delete head sha as undo ammo", discJ.head === ln4head, `${discJ.head} vs ${ln4head}`);
  check("discarded worktree gone from disk", !exists(ln4.cwd));
  check("discarded branch deleted",
    discJ.branchDeleted === true
      && spawnSync("git", ["-C", REPO, "rev-parse", "--verify", "-q", `refs/heads/${ln4.branch}`]).status !== 0);
  check("discard on an unknown path is refused",
    (await post("/api/worktrees/discard", { repo: REPO, path: ln4.cwd, branch: ln4.branch })).status === 400);
  await post(`/api/slots/${probe.slot}/land`, {}); // clean up the probe lane too

  // --- Part A: worktreeRisk — real dirty files + unpushed commits, not just counts ---
  interface WtRiskRow { path: string; branch: string; dirtyFiles: string[];
    unpushedCommits: { hash: string; subject: string }[]; shortstat: string | null; empty: boolean }
  const lnDirty = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnDirty.cwd}/sweepdirty.txt`, "wip\n");
  spawnSync("git", ["-C", lnDirty.cwd, "add", "sweepdirty.txt"]);
  spawnSync("git", ["-C", lnDirty.cwd, "commit", "-qm", "sweep test unpushed commit"]);
  await Bun.write(`${lnDirty.cwd}/code.txt`, "root\nsweep-uncommitted\n");
  const lnClean2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  const wmRisk = (await (await get(`/api/slots/${lnDirty.slot}/worktrees`)).json()) as { worktrees: WtRiskRow[] };
  const rowDirty = wmRisk.worktrees.find((w) => w.branch === lnDirty.branch);
  check("worktrees map reports real dirty FILE NAMES, not just a count",
    !!rowDirty && rowDirty.dirtyFiles.some((f) => f.includes("code.txt")) && rowDirty.empty === false,
    JSON.stringify(rowDirty));
  // guards fix B: the no-upstream fallback must list the lane's OWN commit ONLY, never
  // the base history — so exactly one entry, and it is the commit this test created
  check("worktrees map reports ONLY the lane's own unpushed commit (not base history)",
    !!rowDirty && rowDirty.unpushedCommits.length === 1
      && rowDirty.unpushedCommits[0].subject === "sweep test unpushed commit",
    JSON.stringify(rowDirty?.unpushedCommits));
  const rowClean = wmRisk.worktrees.find((w) => w.branch === lnClean2.branch);
  check("worktrees map reports empty:true for a clean, fresh lane (provably safe to drop)",
    !!rowClean && rowClean.empty === true && rowClean.dirtyFiles.length === 0 && rowClean.unpushedCommits.length === 0,
    JSON.stringify(rowClean));
  // focused single-path risk endpoint (used by the client before ⏏ land / kill-with-lane)
  const riskDirty = (await (await get(`/api/slots/${lnDirty.slot}/risk`)).json()) as WtRiskRow;
  check("single-slot risk endpoint matches the worktrees-map row for the same lane",
    riskDirty.empty === false && riskDirty.dirtyFiles.some((f) => f.includes("code.txt")), JSON.stringify(riskDirty));
  check("risk endpoint rejects a non-lane slot", (await get("/api/slots/2/risk")).status === 400);

  // --- Part B: 🧹 sweep agent (FLEET_SWEEP_CMD stand-in maps empty→safe-to-remove/remove,
  // non-empty→active-work/none — deterministic, so the contract round-trips exactly) ---
  interface SweepVerdictRow { path: string; verdict: string; reason: string; suggestedAction: string }
  const swRes = await post(`/api/slots/${lnDirty.slot}/sweep`, {});
  const swJ = (await swRes.json()) as { verdicts?: SweepVerdictRow[]; outstanding?: string; error?: string };
  check("sweep endpoint round-trips the documented JSON contract",
    swRes.ok && Array.isArray(swJ.verdicts) && swJ.verdicts.length >= 2, JSON.stringify(swJ));
  // the new {verdicts, outstanding} object shape — the "what's still missing" synthesis
  check("sweep response carries the outstanding synthesis (what's still missing)",
    typeof swJ.outstanding === "string" && swJ.outstanding.includes("fake outstanding"), JSON.stringify(swJ.outstanding));
  const vDirty = swJ.verdicts?.find((v) => v.path === lnDirty.cwd);
  const vClean = swJ.verdicts?.find((v) => v.path === lnClean2.cwd);
  check("sweep verdict for the dirty+unpushed lane is active-work/none",
    vDirty?.verdict === "active-work" && vDirty?.suggestedAction === "none", JSON.stringify(vDirty));
  check("sweep verdict for the clean empty lane is safe-to-remove/remove",
    vClean?.verdict === "safe-to-remove" && vClean?.suggestedAction === "remove", JSON.stringify(vClean));
  const swGet = await get(`/api/slots/${lnDirty.slot}/sweep`);
  const swGetJ = (await swGet.json()) as { verdicts?: SweepVerdictRow[]; cached?: boolean };
  check("sweep GET serves the cache without re-spawning the agent", swGet.ok && swGetJ.cached === true, JSON.stringify(swGetJ));
  // guards fix J: a true cache hit returns the SAME verdicts the POST produced — proving GET
  // did not re-run the agent (which, being non-deterministic in prod, could differ)
  check("sweep GET verdicts are byte-identical to the POST verdicts (agent not re-run)",
    JSON.stringify(swGetJ.verdicts) === JSON.stringify(swJ.verdicts), JSON.stringify(swGetJ.verdicts));

  // --- Part B2: 💾 lane commit — the SAVE that land/merge (dirty-tree refusers) can't do.
  // Commit-only (never push/land); reversible by the owner. lnDirty is dirty here (its
  // uncommitted code.txt edit) — quick mode must commit it and leave the tree clean.
  interface CommitRes { committed?: boolean; hash?: string; subject?: string; reason?: string; error?: string }
  const ciQuick = await post(`/api/slots/${lnDirty.slot}/commit`, { mode: "quick" });
  const ciQuickJ = (await ciQuick.json()) as CommitRes;
  check("commit quick mode commits a dirty lane and returns a short hash",
    ciQuick.ok && ciQuickJ.committed === true && /^[0-9a-f]{7,}$/.test(ciQuickJ.hash ?? ""), JSON.stringify(ciQuickJ));
  check("commit quick mode uses the deterministic wip message",
    (ciQuickJ.subject ?? "").startsWith("wip: saved from Fleet dashboard"), JSON.stringify(ciQuickJ.subject));
  const riskAfterCommit = (await (await get(`/api/slots/${lnDirty.slot}/risk`)).json()) as WtRiskRow;
  check("lane tree is clean after commit (no dirty files remain)",
    riskAfterCommit.dirtyFiles.length === 0, JSON.stringify(riskAfterCommit.dirtyFiles));
  const ciClean = await post(`/api/slots/${lnDirty.slot}/commit`, { mode: "quick" });
  const ciCleanJ = (await ciClean.json()) as CommitRes;
  check("commit on a clean lane is an idempotent no-op (committed:false + reason)",
    ciClean.ok && ciCleanJ.committed === false && (ciCleanJ.reason ?? "").includes("clean"), JSON.stringify(ciCleanJ));
  // agent mode on a fresh dirty lane: the FLEET_COMMIT_CMD stand-in supplies the message
  const lnAgent = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnAgent.cwd}/code.txt`, "root\nagent-commit\n");
  const ciAgent = await post(`/api/slots/${lnAgent.slot}/commit`, { mode: "agent" });
  const ciAgentJ = (await ciAgent.json()) as CommitRes;
  check("commit agent mode lands the agent-supplied conventional-commit message",
    ciAgent.ok && ciAgentJ.committed === true && ciAgentJ.subject === "feat: stand-in commit message", JSON.stringify(ciAgentJ));
  await post(`/api/slots/${lnAgent.slot}/kill`, {});
  check("commit refuses a non-lane (plain repo) slot", (await post("/api/slots/2/commit", { mode: "quick" })).status === 400);

  await post(`/api/slots/${lnDirty.slot}/kill`, {});
  await post(`/api/slots/${lnClean2.slot}/kill`, {});

  // --- Part B3: concurrency / race-hardening regression guards ---
  // helper: read this slot's autos split by enabled from /api/sessions
  const autosFor = async (slot: number): Promise<{ enabled: number; disabled: number; total: number }> => {
    const sx = (await (await get("/api/sessions")).json()) as { autos: { slot: number; enabled: boolean }[] };
    const mine = sx.autos.filter((a) => a.slot === slot);
    return { enabled: mine.filter((a) => a.enabled).length, disabled: mine.filter((a) => !a.enabled).length, total: mine.length };
  };

  // FIX 3 — completed one-shots must be pruned to AUTO_KEEP_DONE (=5) per slot, not grow
  // unbounded. Create AUTO_KEEP_DONE+4 one-shots; toggle all but the last to disabled
  // (deterministic stand-in for a one-shot completing). Each create prunes the slot's
  // disabled set, so after the final create the disabled count is capped at exactly 5.
  {
    const KEEP = 5;
    const lnAuto = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    const mk = async (): Promise<string> => {
      const j = (await (await post(`/api/slots/${lnAuto.slot}/autos`, { text: "prune-test", inSec: 3600 })).json()) as { auto?: { id: string } };
      return j.auto?.id ?? "";
    };
    for (let i = 0; i < KEEP + 3; i++) {
      const id = await mk();
      await post(`/api/autos/${id}/toggle`, {}); // one-shot enabled→disabled, no run needed
    }
    // after KEEP+3 creates the slot retains at most KEEP+1 (each create prunes disabled back
    // to KEEP, then the just-created one is toggled done → KEEP+1) — bounded, not KEEP+3.
    const beforeLast = await autosFor(lnAuto.slot);
    check("FIX3: disabled one-shots stay bounded (KEEP+1) despite KEEP+3 creates — no unbounded growth",
      beforeLast.disabled === KEEP + 1 && beforeLast.total === KEEP + 1, JSON.stringify(beforeLast));
    await mk(); // one more create → prunes again, leaving KEEP disabled + 1 enabled
    const after = await autosFor(lnAuto.slot);
    check("FIX3: a fresh create prunes disabled to exactly AUTO_KEEP_DONE (+ the new enabled one)",
      after.disabled === KEEP && after.enabled === 1 && after.total === KEEP + 1, JSON.stringify(after));
    await post(`/api/slots/${lnAuto.slot}/kill`, {});
  }

  // FIX 4 — a lane with a half-finished git op (MERGE_HEAD present) must not be committed
  // (a plain add+commit would finalize conflict markers) nor merged by Fleet.
  {
    const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const gd = spawnSync("git", ["-C", ln.cwd, "rev-parse", "--absolute-git-dir"]).stdout.toString().trim();
    const head = spawnSync("git", ["-C", ln.cwd, "rev-parse", "HEAD"]).stdout.toString().trim();
    // commit path: needs a DIRTY tree (clean tree short-circuits before the guard) + MERGE_HEAD
    await Bun.write(`${ln.cwd}/code.txt`, "root\nhalf-merge\n");
    await Bun.write(`${gd}/MERGE_HEAD`, `${head}\n`);
    const ciJ = (await (await post(`/api/slots/${ln.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean; reason?: string };
    check("FIX4: commit refuses a lane with a git op in progress",
      ciJ.committed === false && (ciJ.reason ?? "").includes("in progress"), JSON.stringify(ciJ));
    // merge path: needs a CLEAN tree (uncommitted check precedes the guard) + MERGE_HEAD
    spawnSync("git", ["-C", ln.cwd, "checkout", "-q", "--", "code.txt"]);
    const mgJ = (await (await post(`/api/slots/${ln.slot}/merge`, {})).json()) as { status?: string; detail?: string };
    check("FIX4: merge blocks a lane with a git op in progress",
      mgJ.status === "blocked" && (mgJ.detail ?? "").includes("in progress"), JSON.stringify(mgJ));
    spawnSync("rm", ["-f", `${gd}/MERGE_HEAD`]);
    await post(`/api/slots/${ln.slot}/kill`, {});
  }

  // FIX 1 + FIX 5 — merge concurrency + cross-guard with commit. Build a genuine conflict so
  // the merge starts a real (async, non-trivial) job.
  {
    const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${ln.cwd}/code.txt`, "root\nCONC-lane\n");
    spawnSync("git", ["-C", ln.cwd, "commit", "-aqm", "conc lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nCONC-main\n"); // same line → conflict
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "conc main work"]);
    await setMergeMode("do");
    await settleForMerge(ln.slot); // clear FIX 9's idle gate before starting the job

    // FIX 1: two truly-concurrent merge POSTs. Post-fix, the mergeStart reservation is taken
    // BEFORE the readJson await, so only one job is ever started; both requests report
    // running:true and the lane resolves to a single clean verdict (no double-rebase error).
    const [r1, r2] = await Promise.all([post(`/api/slots/${ln.slot}/merge`, {}), post(`/api/slots/${ln.slot}/merge`, {})]);
    const j1 = (await r1.json()) as { running?: boolean; status?: string };
    const j2 = (await r2.json()) as { running?: boolean; status?: string };
    check("FIX1: two concurrent merge POSTs both report running (neither errors)",
      j1.running === true && j2.running === true && !j1.status && !j2.status, JSON.stringify({ j1, j2 }));

    // FIX 5 (commit side): while the merge job is inflight, a commit is refused with the
    // cross-guard 409 — deterministic, mergeInflight is held for the job's whole lifetime.
    const ciDuring = await post(`/api/slots/${ln.slot}/commit`, { mode: "quick" });
    const ciDuringJ = (await ciDuring.json()) as { error?: string };
    check("FIX5: commit is refused (409) while a merge/land is in progress",
      ciDuring.status === 409 && (ciDuringJ.error ?? "").includes("merge/land is in progress"), `${ciDuring.status} ${JSON.stringify(ciDuringJ)}`);

    const vConc = await waitMerge(ln.slot);
    check("FIX1: concurrent merges settle to a single clean resolution (lane intact, no corruption)",
      !vConc.gone && vConc.last?.status === "resolved" && exists(ln.cwd), JSON.stringify(vConc.last));
    await post(`/api/slots/${ln.slot}/kill`, {});
  }

  // --- Part C: scoped self-scheduling token (FLEET_SELF_TOKEN / FLEET_SELF_SLOT) ---
  const lnTok = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await tmuxOut("send-keys", "-t", `s${lnTok.slot}`, `printf 'SELFTOK=[%s] SELFSLOT=[%s]\\n' "$FLEET_SELF_TOKEN" "$FLEET_SELF_SLOT"`, "Enter");
  await Bun.sleep(600);
  const capTok = await tmuxOut("capture-pane", "-t", `s${lnTok.slot}`, "-p");
  const tokMatch = /SELFTOK=\[([0-9a-f]{32})\] SELFSLOT=\[(\d+)\]/.exec(capTok.out);
  check("FLEET_SELF_TOKEN + FLEET_SELF_SLOT present in a lane slot's spawn env",
    !!tokMatch && Number(tokMatch[2]) === lnTok.slot, capTok.out.slice(-200));
  const selfTok = tokMatch?.[1] ?? "";
  await tmuxOut("send-keys", "-t", "s2", `printf 'SELFTOK=[%s]\\n' "$FLEET_SELF_TOKEN"`, "Enter");
  await Bun.sleep(600);
  const capTok2 = await tmuxOut("capture-pane", "-t", "s2", "-p");
  check("FLEET_SELF_TOKEN absent for a non-lane slot", capTok2.out.includes("SELFTOK=[]"), capTok2.out.slice(-200));

  const selfAuto = (opts: { token?: string; body?: unknown }) => fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", ...(opts.token !== undefined ? { "x-fleet-self-token": opts.token } : {}) },
    body: JSON.stringify(opts.body ?? { text: "x", inSec: 60 }),
  });
  const okRes = await selfAuto({ token: selfTok, body: { text: "self-scheduled check-in", inSec: 3600, slot: 2 } });
  const okJ = (await okRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("POST /api/self/autos succeeds with a valid selfToken", okRes.ok && !!okJ.auto, JSON.stringify(okJ));
  check("a spoofed `slot` field in the body is ignored — the auto lands on the token's OWN slot",
    okJ.auto?.slot === lnTok.slot, JSON.stringify(okJ.auto));
  const ownerOnSelf = await selfAuto({ token: TOKEN });
  check("the owner token does not substitute for a selfToken on this route", ownerOnSelf.status === 401);
  const wrongSelf = await selfAuto({ token: "0".repeat(32) });
  check("an unknown selfToken is rejected", wrongSelf.status === 401);
  const noSelf = await selfAuto({});
  check("a missing selfToken header is rejected", noSelf.status === 401);
  if (okJ.auto) check("delete self-scheduled auto (cleanup)", (await post(`/api/autos/${okJ.auto.id}/delete`, {})).ok);
  // KEEP this lane alive across the server restart (below) to prove its selfToken persists —
  // the restart section (guards fix A) uses this token, then tears the lane down.
  restartSelfTok = selfTok;
  restartSelfSlot = lnTok.slot;

  // --- issue 3: ref-advance land. With the integration branch checked out NOWHERE (the
  // primary parked on a working branch), landing advances the ref via `git branch -f` and
  // touches no working tree — so a dirty primary on the SAME file the lane changed no longer
  // blocks the land, and the primary's uncommitted work survives untouched. This is the whole
  // point of the split: it makes the historic "primary-checkout land collision" impossible. ---
  {
    const raRepo = `${REPO}.refadvance`;
    spawnSync("git", ["init", "-q", raRepo]);
    spawnSync("git", ["-C", raRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", raRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${raRepo}/deck.html`, "base\n");
    spawnSync("git", ["-C", raRepo, "add", "deck.html"]);
    spawnSync("git", ["-C", raRepo, "commit", "-qm", "base"]);
    const integ = spawnSync("git", ["-C", raRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const baseSha = spawnSync("git", ["-C", raRepo, "rev-parse", "HEAD"]).stdout.toString().trim();

    // a lane that edits deck.html and commits (clean descendant → server's clean-rebase path)
    const ra = (await (await post("/api/lanes", { repo: raRepo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${ra.cwd}/deck.html`, "lane animation rebuild\n");
    spawnSync("git", ["-C", ra.cwd, "commit", "-aqm", "lane: animation rebuild"]);

    // park the primary OFF the integration branch, dirty on the SAME file the lane changed —
    // the exact collision that used to block the land — then declare the integration branch
    spawnSync("git", ["-C", raRepo, "checkout", "-q", "-b", "desk"]);
    await Bun.write(`${raRepo}/deck.html`, "owner's in-progress live edit — must survive\n");
    await post("/api/repo-base", { repo: raRepo, branch: integ });

    await settleForMerge(ra.slot);
    await setMergeMode("blocked"); // agent must NOT be consulted for a clean descendant
    await post(`/api/slots/${ra.slot}/merge`, {});
    const raV = await waitMerge(ra.slot);
    check("ref-advance: land succeeds with the primary parked off-main AND dirty on the lane's file",
      raV.gone && !exists(ra.cwd), JSON.stringify(raV));
    const integSha = spawnSync("git", ["-C", raRepo, "rev-parse", integ]).stdout.toString().trim();
    check("ref-advance: integration branch ref advanced to include the lane commit (branch -f)",
      integSha !== baseSha && spawnSync("git", ["-C", raRepo, "log", "--oneline", integ]).stdout.toString().includes("animation rebuild"),
      `integ=${integSha} base=${baseSha}`);
    const deskHead = spawnSync("git", ["-C", raRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    const deskFile = await Bun.file(`${raRepo}/deck.html`).text();
    check("ref-advance: primary stayed on desk with its dirty edit untouched by the land",
      deskHead === "desk" && deskFile.includes("owner's in-progress live edit"),
      `head=${deskHead} file=${JSON.stringify(deskFile)}`);
    await post("/api/repo-base", { repo: raRepo, branch: "" }); // clear config
  }

  // --- issue 5: fork point. A new lane forks from the integration branch, NOT the parked
  // primary HEAD — so lanes created while the primary sits on `desk` still branch from `main`
  // and don't inherit desk-only commits. ---
  {
    const fpRepo = `${REPO}.forkpoint`;
    spawnSync("git", ["init", "-q", fpRepo]);
    spawnSync("git", ["-C", fpRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", fpRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${fpRepo}/f.txt`, "base\n");
    spawnSync("git", ["-C", fpRepo, "add", "f.txt"]);
    spawnSync("git", ["-C", fpRepo, "commit", "-qm", "base"]);
    const fpInteg = spawnSync("git", ["-C", fpRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    // park the primary on desk and add a DESK-ONLY commit the integration branch never sees
    spawnSync("git", ["-C", fpRepo, "checkout", "-q", "-b", "desk"]);
    await Bun.write(`${fpRepo}/desk-only.txt`, "desk\n");
    spawnSync("git", ["-C", fpRepo, "add", "desk-only.txt"]);
    spawnSync("git", ["-C", fpRepo, "commit", "-qm", "desk-only commit"]);
    await post("/api/repo-base", { repo: fpRepo, branch: fpInteg });

    const fp = (await (await post("/api/lanes", { repo: fpRepo })).json()) as { slot: number; cwd: string };
    const laneLog = spawnSync("git", ["-C", fp.cwd, "log", "--oneline"]).stdout.toString();
    const laneHasDeskFile = exists(`${fp.cwd}/desk-only.txt`);
    check("issue5: lane forks from the integration branch, not the desk-only primary HEAD",
      !laneLog.includes("desk-only commit") && !laneHasDeskFile, `log=${JSON.stringify(laneLog.trim())} deskFile=${laneHasDeskFile}`);
    await post("/api/repo-base", { repo: fpRepo, branch: "" });
    await post(`/api/slots/${fp.slot}/kill`, {});
  }
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
  check("share host hides the dashboard", landing.status === 200 && landingBody.includes("cowork — live sessions") && !landingBody.includes("app.js"),
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
// guards fix A: the lane's selfToken must survive the restart. The lane pane still holds
// the token baked at spawn; the restarted server must restore the SAME token from state,
// so a /api/self/autos call authed with the pre-restart token still succeeds.
if (restartSelfTok) {
  const restRes = await fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", "x-fleet-self-token": restartSelfTok },
    body: JSON.stringify({ text: "post-restart self check-in", inSec: 3600 }),
  });
  const restJ = (await restRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("after restart: lane selfToken still authorizes /api/self/autos (persisted, not rotated)",
    restRes.ok && restJ.auto?.slot === restartSelfSlot, `${restRes.status} ${JSON.stringify(restJ)}`);
  if (restJ.auto) await post(`/api/autos/${restJ.auto.id}/delete`, {});
  await post(`/api/slots/${restartSelfSlot}/kill`, {}); // tear the persistence lane down
}
const rec2 = (await (await get("/api/dirs?path=~")).json()) as { recents: string[] };
check("after restart: recents persisted", rec2.recents.length >= 2, JSON.stringify(rec2.recents));
const h2b = (await (await get("/api/slots/2/history")).json()) as { history: { text: string }[] };
check("after restart: history persisted", h2b.history.some((h) => h.text === "compose-box-to-slot-two"), `${h2b.history.length} entries`);
const plogAfter = await plogRead();
check("after restart + slot kills: prompt log intact",
  plogAfter.some((e) => e.text === "compose-box-to-slot-two") && plogAfter.some((e) => e.source === "share"), `${plogAfter.length} entries`);
const shPAuth = await post(`/s/${shPersist.id}/auth`, { password: "persistpass1" });
check("after restart: share persisted and answers", shPAuth.ok);
// the size a guest builds its grid from must be TMUX TRUTH, not the fresh process's
// 200×50 default — the restart is exactly the moment the in-memory cache dies while
// the pane keeps the size the last client set (regression: every deploy desynced /info)
{
  // resize the pane BEHIND the server's back (raw tmux, not /resize) — the server cache
  // still holds the old size, so only a live tmux read can answer correctly
  await tmuxOut("resize-window", "-t", "s2", "-x", "77", "-y", "31");
  const shPCookie = (shPAuth.headers.get("set-cookie") ?? "").split(";")[0];
  const inf = (await (await fetch(BASE + `/s/${shPersist.id}/info`, { headers: { cookie: shPCookie } })).json()) as
    { cols: number; rows: number };
  const truth = (await tmuxOut("display-message", "-p", "-t", "s2", "#{window_width} #{window_height}")).out.trim();
  check("share info reports the pane's true size, not the server cache",
    `${inf.cols} ${inf.rows}` === truth && truth === "77 31", `info ${inf.cols}x${inf.rows} vs tmux ${truth}`);
}
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

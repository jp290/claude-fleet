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
const sess1 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null; runsLeft: number }[] };
const fired = sess1.autos.find((a) => a.id === aFireJ.auto.id);
const waiting = sess1.autos.find((a) => a.id === aBusyJ.auto.id);
check("fired one-shot is disabled, result 'sent', runsLeft driven to 0 (spent is one predicate)", !!fired && !fired.enabled && fired.lastResult === "sent" && fired.runsLeft === 0, JSON.stringify(fired));
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

// --- perpetual autos: an owner-only recurring beat that re-arms instead of expiring at the runs
// cap. Proven by CONTRAST — a runs=1 control dies after one fire; a runs=1 perpetual, same params,
// survives it. Both fire on slot 2 (idleSec:0 bypasses the idle gate); the C-u below clears both. ---
const aPerp = await post("/api/slots/2/autos", { text: "perp-beat", inSec: 1, everySec: 10, idleSec: 0, perpetual: true });
const aPerpJ = (await aPerp.json()) as { ok?: boolean; auto?: { id: string; perpetual?: boolean } };
check("owner can create a perpetual auto (flagged perpetual)", aPerp.ok && aPerpJ.auto?.perpetual === true, JSON.stringify(aPerpJ.auto));
const aCtl = await post("/api/slots/2/autos", { text: "ctl-beat", inSec: 1, everySec: 10, runs: 1, idleSec: 0 });
const aCtlJ = (await aCtl.json()) as { auto?: { id: string } };
check("perpetual requires a recurring interval (one-shot + perpetual -> 400)",
  (await post("/api/slots/2/autos", { text: "x", inSec: 2, perpetual: true })).status === 400);
await Bun.sleep(9000); // one fire + a 5s scheduler tick
const sessP = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; runsLeft: number; lastResult: string | null; perpetual?: boolean }[] };
const perp = sessP.autos.find((a) => a.id === aPerpJ.auto?.id);
const ctl = sessP.autos.find((a) => a.id === aCtlJ.auto?.id);
check("control (runs=1, non-perpetual) is spent after one fire", !!ctl && !ctl.enabled && ctl.runsLeft === 0, JSON.stringify(ctl));
check("perpetual SURVIVES the same fire — enabled, runsLeft un-decremented, sent",
  !!perp && perp.enabled === true && perp.runsLeft === 1 && perp.lastResult === "sent" && perp.perpetual === true, JSON.stringify(perp));
check("a perpetual auto is still killable (delete succeeds)", (await post(`/api/autos/${aPerpJ.auto?.id}/delete`, {})).ok);
if (aCtlJ.auto) await post(`/api/autos/${aCtlJ.auto.id}/delete`, {});
const aPerpPersist = await post("/api/slots/2/autos", { text: "perp-persist-probe", inSec: 3600, everySec: 3600, perpetual: true });
const aPerpPersistJ = (await aPerpPersist.json()) as { auto?: { id: string } };
check("create perpetual persistence-probe", aPerpPersist.ok && !!aPerpPersistJ.auto?.id);

// --- global kill-switch (/api/autos/switch): pauses the entire scheduled-auto surface. Proven
// by an auto that must NOT fire while paused, then fires once resumed; persisted immediately. ---
check("autosOn defaults on and is exposed in state",
  ((await (await get("/api/sessions")).json()) as { autosOn?: boolean }).autosOn === true);
check("switch rejects a non-boolean body (400)", (await post("/api/autos/switch", { on: "off" })).status === 400);
const swOff = await post("/api/autos/switch", { on: false });
check("owner kills the automation surface", swOff.ok && ((await swOff.json()) as { autosOn?: boolean }).autosOn === false);
await Bun.sleep(150); // let the route's saveState land
const { readFileSync } = await import("node:fs");
check("the kill-switch state is persisted immediately (so a restart stays killed)",
  (JSON.parse(readFileSync("fleet.json", "utf8")) as { autosOn?: boolean }).autosOn === false);
const aKill = await post("/api/slots/2/autos", { text: "killswitch-probe", inSec: 1, idleSec: 0 });
const aKillJ = (await aKill.json()) as { auto?: { id: string } };
await Bun.sleep(7000); // well past when it would fire if automation were live
const killed = ((await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null }[] }).autos.find((a) => a.id === aKillJ.auto?.id);
check("no auto fires while the kill-switch is off", !!killed && killed.enabled === true && killed.lastResult === null, JSON.stringify(killed));
check("owner re-enables the automation surface",
  ((await (await post("/api/autos/switch", { on: true })).json()) as { autosOn?: boolean }).autosOn === true);
await Bun.sleep(7000); // now it may fire
const resumed = ((await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] }).autos.find((a) => a.id === aKillJ.auto?.id);
check("the same auto fires once automation is resumed", !!resumed && resumed.lastResult === "sent", JSON.stringify(resumed));
if (aKillJ.auto) await post(`/api/autos/${aKillJ.auto.id}/delete`, {});

// --- quiet hours: mute the PERIODIC surface during the owner's local-hour window. Set to cover
// the current hour so the test is deterministic regardless of when it runs; a recurring pulse is
// held while a one-shot still fires; clearing the window lets the held pulse fire. ---
const nowH = new Date().getHours();
check("quiet-hours rejects an invalid window (400)", (await post("/api/autos/quiet", { start: 5, end: 5 })).status === 400);
const qSet = await post("/api/autos/quiet", { start: nowH, end: (nowH + 2) % 24 });
check("owner sets a quiet-hours window covering now",
  qSet.ok && ((await qSet.json()) as { quietHours?: { start: number } }).quietHours?.start === nowH);
const aQuietRec = await post("/api/slots/2/autos", { text: "quiet-recurring", inSec: 1, everySec: 10, runs: 5, idleSec: 0 });
const aQuietRecJ = (await aQuietRec.json()) as { auto?: { id: string } };
const aQuietOne = await post("/api/slots/2/autos", { text: "quiet-oneshot", inSec: 1, idleSec: 0 });
const aQuietOneJ = (await aQuietOne.json()) as { auto?: { id: string } };
await Bun.sleep(9000);
const sessQ = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; lastResult: string | null; nextAt: number }[] };
const qRec = sessQ.autos.find((a) => a.id === aQuietRecJ.auto?.id);
const qOne = sessQ.autos.find((a) => a.id === aQuietOneJ.auto?.id);
check("a recurring pulse is held (does not fire) during quiet hours",
  !!qRec && qRec.enabled === true && qRec.lastResult === null && qRec.nextAt > Date.now(), JSON.stringify(qRec));
check("a one-shot still fires during quiet hours (only the periodic surface is muted)",
  !!qOne && qOne.lastResult === "sent", JSON.stringify(qOne));
check("clearing quiet hours nulls the window",
  ((await (await post("/api/autos/quiet", { start: null })).json()) as { quietHours: unknown }).quietHours === null);
await Bun.sleep(12000); // > everySec, so the held recurring pulse now fires
const qRec2 = ((await (await get("/api/sessions")).json()) as { autos: { id: string; lastResult: string | null }[] }).autos.find((a) => a.id === aQuietRecJ.auto?.id);
check("the held recurring pulse fires once quiet hours are cleared", !!qRec2 && qRec2.lastResult === "sent", JSON.stringify(qRec2));
if (aQuietRecJ.auto) await post(`/api/autos/${aQuietRecJ.auto.id}/delete`, {});
if (aQuietOneJ.auto) await post(`/api/autos/${aQuietOneJ.auto.id}/delete`, {});

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
  type VerifyField = { cmd: string; ok: boolean; out: string; at: number; mainSha: string; stale?: boolean };
  type MergeVerdict = { status: string; detail: string; landed: boolean; verify?: VerifyField; landError?: string };
  const waitMerge = async (slot: number): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
    for (let i = 0; i < 100; i++) {
      const r = await get(`/api/slots/${slot}/merge`);
      if (r.status === 400) return { gone: true, last: null };
      const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
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

  // --- landGate busy block (server.ts merge route, canDeliver idleMs: MERGE_IDLE_MS): a
  // non-confirm land is refused while the pane is ACTIVELY producing output, so an owner never
  // lands mid-work on top of the agent's own trailing changes. Every OTHER merge test calls
  // settleForMerge first, so deleting this gate passes them all — this is the one test that
  // fires the merge WHILE busy. lnSlot is a fresh, clean one-click lane (nothing committed yet →
  // no uncommitted-changes / git-op refusal fires first; the idle gate is what we reach). ---
  {
    // Fire the land WHILE the pane is producing output. Robust against a freshly-spawned lane
    // whose shell isn't yet ready to accept send-keys (the probe would be dropped and the pane
    // read idle): retry send-keys until the server's own clock reports the pane busy well inside
    // MERGE_IDLE_MS, then POST immediately — the eval is one round-trip later, still < the gate.
    const isBusy = async (): Promise<boolean> => {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === lnSlot);
      return !!sl && sx.now - sl.lastOutput < MERGE_IDLE_MS - 1000; // ≥1s margin before the gate
    };
    let busyConfirmed = false;
    let busyMerge: { status?: string; detail?: string; running?: boolean; landed?: boolean } = {};
    for (let attempt = 0; attempt < 15 && !busyConfirmed; attempt++) {
      await tmuxOut("send-keys", "-t", `s${lnSlot}`, `echo landgate-busy-probe-${attempt}`, "Enter");
      for (let i = 0; i < 12; i++) { // ≤600ms for this probe's output to register (poll runs every 100ms)
        if (await isBusy()) { busyConfirmed = true; break; }
        await Bun.sleep(50);
      }
      if (busyConfirmed)
        busyMerge = (await (await post(`/api/slots/${lnSlot}/merge`, {})).json()) as typeof busyMerge;
    }
    check("landgate setup: the lane pane reads BUSY before the land (non-tautology guard)", busyConfirmed);
    check("land is BLOCKED while the pane is actively working (idle gate), never starting a job",
      busyMerge.status === "blocked" && (busyMerge.detail ?? "").includes("actively working"), JSON.stringify(busyMerge));
    // it must have been the gate, not a spawned job — confirm no merge job is running afterward
    const busyAfter = (await (await get(`/api/slots/${lnSlot}/merge`)).json()) as { running?: boolean; error?: string };
    check("the busy-blocked land started no merge job", busyAfter.running === false, JSON.stringify(busyAfter));
  }

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

  // --- shelve → resume round-trip: a lane set aside with a note keeps its worktree AND its
  // uncommitted work; the worktrees map surfaces the note on the now-orphan lane; reopening
  // (attach) re-seats it in a slot and clears the note. (A bare kill leaves a note-less orphan.) ---
  {
    const sh = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${sh.cwd}/shelve-work.txt`, "half done\n"); // uncommitted work that must NOT be lost
    const shRes = await post(`/api/slots/${sh.slot}/shelve`, { note: "finish the parser, then add a test" });
    check("shelve returns ok", shRes.ok, await shRes.text());
    check("shelved slot is now inactive (killed)",
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
        .slots.find((x) => x.id === sh.slot)?.cwd === null);
    check("shelved worktree kept on disk (not destroyed)", exists(sh.cwd));
    check("uncommitted work survives the shelve", exists(`${sh.cwd}/shelve-work.txt`));
    const wmap = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as
      { worktrees: { path: string; slot: number | null; note: string | null }[] };
    const orphan = wmap.worktrees.find((w) => w.path === sh.cwd);
    check("shelved lane is an orphan (no holding slot)", orphan != null && orphan.slot === null, JSON.stringify(orphan));
    check("shelve note surfaced on the orphan", orphan?.note === "finish the parser, then add a test", JSON.stringify(orphan));
    const reopen = (await (await post("/api/lanes", { repo: REPO, attach: sh.cwd })).json()) as { ok?: boolean; slot?: number; error?: string };
    check("resume (attach) re-seats the shelved lane in a slot", reopen.ok === true && typeof reopen.slot === "number", JSON.stringify(reopen));
    const wmap2 = (await (await get(`/api/slots/${lnSlot}/worktrees`)).json()) as { worktrees: { path: string; note: string | null }[] };
    check("resuming clears the shelve note", wmap2.worktrees.find((w) => w.path === sh.cwd)?.note == null,
      JSON.stringify(wmap2.worktrees.find((w) => w.path === sh.cwd)));
    check("shelve rejects a non-worktree slot", (await post("/api/slots/2/shelve", { note: "x" })).status === 400);
    await post(`/api/slots/${reopen.slot ?? 0}/kill`, {}); // free the slot for later tests
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
  // V1 gate: verify runs ONLY against a git-verified rebased tree (design note §6 rule 4).
  // A blocked verdict never rebased anything → no verify field, even though a cmd IS
  // configured. Guards against a mutation that runs verify on a pre-rebase / non-rebased tree.
  check("V1: a blocked verdict (no rebased tree) carries no verify field",
    vB.last !== null && vB.last.verify === undefined, JSON.stringify(vB.last?.verify));

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
  // V1: verify runs on the RESOLVED (conflict) path too — server-side, against the rebased
  // tree, its result recorded as a fact (design note §3, §6 rule 4). This -X theirs resolution
  // leaves no VERIFYBAD marker → green. Proves the call fires on the resolved path (a kept
  // lane whose verdict is readable, unlike a torn-down clean land) and binds mainSha.
  check("V1: resolved verdict carries verify.ok:true against the rebased tree (mainSha bound)",
    vD.last?.verify?.ok === true && vD.last.verify.cmd.endsWith("fakeverify")
      && typeof vD.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vD.last.verify.mainSha),
    JSON.stringify(vD.last?.verify));
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

  // --- F5: merge-job state must not bleed across a slot recycle. A slot recycled while its
  // merge job is still in flight must NOT report the OLD job as running for whatever lane
  // takes the slot next (which would 409 the new lane's commit/merge routes until the stale
  // job's finally fired). openSlot/killSlot now drop the slot's mergeInflight/mergeStart. ---
  {
    const f5 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${f5.cwd}/code.txt`, "root\nf5-lane\n");
    spawnSync("git", ["-C", f5.cwd, "commit", "-aqm", "f5 lane work"]);
    await Bun.write(`${REPO}/code.txt`, "root\nf5-main\n"); // same line → conflict → the agent (hang) runs
    spawnSync("git", ["-C", REPO, "commit", "-aqm", "f5 main work"]);
    await setMergeMode("hang"); // fakemerge sleeps, keeping the job in flight while we recycle
    await settleForMerge(f5.slot);
    const mgStart = (await (await post(`/api/slots/${f5.slot}/merge`, {})).json()) as { running?: boolean };
    check("F5 setup: merge job is in flight (running:true) before the recycle", mgStart.running === true, JSON.stringify(mgStart));
    // recycle the slot mid-job: kill, then re-open a fresh lane in the SAME slot
    await post(`/api/slots/${f5.slot}/kill`, {});
    const reopen = await post(`/api/slots/${f5.slot}/open-worktree`, { repo: REPO, branch: "e2e-f5-recycle" });
    check("F5: recycled slot re-opens a fresh lane", reopen.ok, await reopen.text());
    const mgAfter = (await (await get(`/api/slots/${f5.slot}/merge`)).json()) as { running?: boolean };
    check("F5: recycled slot's new lane reports the stale merge job as NOT running (mergeInflight/mergeStart cleared)",
      mgAfter.running === false, JSON.stringify(mgAfter));
    await post(`/api/slots/${f5.slot}/kill`, {}); // free the slot; the leftover hung job self-checks identity on finish
    await setMergeMode("blocked"); // restore default for later merge tests
  }

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

  // atomic confirm-land: if main moves between the resolution and the owner's confirm, the
  // earlier rebase is stale — but the resolution was already made, so the server REPLAYS it
  // onto the current main and lands in one step (no full agent re-run) when the move doesn't
  // re-conflict. Only a move that touches the SAME lines falls back to ⏫. (Was: confirm hard-
  // refused on ANY move, which in a busy fleet meant a resolved lane could never win the race.)
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
  // main moves on an UNRELATED file before confirm → the resolution still replays cleanly
  await Bun.write(`${REPO}/moved.txt`, "moved\n");
  spawnSync("git", ["-C", REPO, "add", "moved.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "main moved after resolution"]);
  const staleJ = (await (await post(`/api/slots/${lnStale.slot}/merge`, { confirm: true })).json()) as
    { status?: string; landed?: boolean; detail?: string };
  check("confirm-land re-rebases onto a moved main and lands (unrelated move, no agent re-run)",
    staleJ.status === "merged" && staleJ.landed === true, JSON.stringify(staleJ));
  check("confirm-landed lane's resolution + the intervening main move both reached main",
    ((): boolean => { const lg = spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString();
      return lg.includes("stale lane work") && lg.includes("main moved after resolution"); })(),
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().trim());
  check("confirm-landed lane kept its resolved content on main (theirs = lane side)",
    spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString() === "root\nstale-lane\n",
    JSON.stringify(spawnSync("git", ["-C", REPO, "show", "HEAD:code.txt"]).stdout.toString()));

  // the fallback still holds: when the moved main touches the SAME lines the resolution did,
  // the re-rebase re-conflicts — the server aborts it cleanly and sends the owner back to ⏫
  // (never landing a NEW, unreviewed auto-resolution). Lane is left exactly as it was.
  const lnReconf = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnReconf.cwd}/code.txt`, "root\nrc-lane\n");
  spawnSync("git", ["-C", lnReconf.cwd, "commit", "-aqm", "reconf lane work"]);
  await Bun.write(`${REPO}/code.txt`, "root\nrc-main\n"); // conflict → agent resolves
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "reconf main work"]);
  await settleForMerge(lnReconf.slot);
  await post(`/api/slots/${lnReconf.slot}/merge`, {});
  const vRc = await waitMerge(lnReconf.slot);
  check("reconf lane resolved + paused", !vRc.gone && vRc.last?.status === "resolved", JSON.stringify(vRc.last));
  await Bun.write(`${REPO}/code.txt`, "root\nrc-main2\n"); // main re-touches the SAME line before confirm
  spawnSync("git", ["-C", REPO, "commit", "-aqm", "reconf main re-touch"]);
  const rcJ = (await (await post(`/api/slots/${lnReconf.slot}/merge`, { confirm: true })).json()) as
    { status?: string; detail?: string };
  check("confirm-land falls back to ⏫ when the moved main re-conflicts",
    rcJ.status === "blocked" && (rcJ.detail ?? "").includes("re-run"), JSON.stringify(rcJ));
  check("re-conflicting confirm leaves the lane intact (no half-rebase, no git op stuck)",
    exists(lnReconf.cwd)
    && spawnSync("git", ["-C", lnReconf.cwd, "status", "--porcelain"]).stdout.toString().trim() === "",
    spawnSync("git", ["-C", lnReconf.cwd, "status", "--porcelain"]).stdout.toString());
  await post(`/api/slots/${lnReconf.slot}/kill`, {});
  await post(`/api/slots/${lnStale.slot}/kill`, {}); // free the slot for the orphan tests below

  // --- V1: deterministic verify in the merge verdict (design note §3). The server runs
  // FLEET_VERIFY_CMD (here $DIR/fakeverify — a git-grep for a VERIFYBAD sabotage marker)
  // against the REBASED tree, before any land, and records verify:{cmd,ok,out,at,mainSha}.
  // Two CLEAN-rebase lanes (own file, no conflict → the server's script path, agent never
  // consulted) exercise the pass and fail gates. mergemode stays "blocked" throughout: if
  // the agent were wrongly spawned the lane would be kept, so a land here also proves the
  // clean path ran. ---
  await setMergeMode("blocked");

  // (B first) clean rebase whose tree PASSES verify → lands as today. Run BEFORE the fail
  // case: the fail case's owner-confirm-land (below) commits the VERIFYBAD marker onto main,
  // which every later clean lane would then inherit — so the passing case must land first,
  // against a still-clean main.
  const lnVp = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await Bun.write(`${lnVp.cwd}/verify-pass.txt`, "clean lane work, no marker\n");
  spawnSync("git", ["-C", lnVp.cwd, "add", "verify-pass.txt"]);
  spawnSync("git", ["-C", lnVp.cwd, "commit", "-qm", "verify-pass lane work"]);
  await Bun.write(`${REPO}/vp-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vp-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vp main work"]);
  await settleForMerge(lnVp.slot);
  await post(`/api/slots/${lnVp.slot}/merge`, {});
  const vVp = await waitMerge(lnVp.slot);
  check("V1: clean rebase that passes verify lands (verify green never blocks a clean land)", vVp.gone, JSON.stringify(vVp));
  check("V1: passing verify lane's commit reached main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("verify-pass lane work"));

  // (A) clean rebase whose tree FAILS verify → the auto-land is downgraded to a stop-and-
  // review "resolved" verdict (verify.ok:false), NOT landed — broken code never auto-lands.
  const lnVf = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${lnVf.cwd}/verify-fail.txt`, "lane work with a VERIFYBAD marker\n"); // marker survives the rebase
  spawnSync("git", ["-C", lnVf.cwd, "add", "verify-fail.txt"]);
  spawnSync("git", ["-C", lnVf.cwd, "commit", "-qm", "verify-fail lane work"]);
  await Bun.write(`${REPO}/vf-main.txt`, "main side\n"); // different file → clean rebase, no agent
  spawnSync("git", ["-C", REPO, "add", "vf-main.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "vf main work"]);
  await settleForMerge(lnVf.slot);
  await post(`/api/slots/${lnVf.slot}/merge`, {});
  const vVf = await waitMerge(lnVf.slot);
  check("V1: clean rebase that fails verify does NOT auto-land (downgraded to resolved)",
    !vVf.gone && vVf.last?.status === "resolved" && vVf.last?.landed === false && exists(lnVf.cwd), JSON.stringify(vVf.last));
  check("V1: the verdict carries verify.ok:false with the failing command's output tail",
    vVf.last?.verify?.ok === false && vVf.last.verify.cmd.endsWith("fakeverify")
      && vVf.last.verify.out.includes("VERIFYBAD") && typeof vVf.last.verify.mainSha === "string" && /^[0-9a-f]{40,64}$/.test(vVf.last.verify.mainSha),
    JSON.stringify(vVf.last?.verify));
  const vfPreLand = spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString();
  check("V1: verify-failed lane's commit has NOT reached main",
    !vfPreLand.includes("verify-fail lane work"), vfPreLand.trim());
  // owner latitude (OWNER.md §4a): confirm-land must NOT hard-block on verify.ok:false — the
  // owner reviewed the failure and may land anyway. The clean rebase left main an ancestor,
  // so confirm ff-lands directly.
  await settleForMerge(lnVf.slot);
  const vfConf = (await (await post(`/api/slots/${lnVf.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
  check("V1: owner may confirm-land a verify-failed resolution anyway (no hard block on ok:false)",
    vfConf.status === "merged" && vfConf.landed === true, JSON.stringify(vfConf));
  check("V1: after the owner's confirm the verify-failed lane's commit is on main",
    spawnSync("git", ["-C", REPO, "log", "--oneline", "-4"]).stdout.toString().includes("verify-fail lane work"));
  // scrub the VERIFYBAD marker back out of main so later clean lanes (this suite reuses REPO
  // heavily) don't inherit a red verify from this deliberately-broken confirm-land.
  spawnSync("git", ["-C", REPO, "rm", "-q", "verify-fail.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "cleanup: drop VERIFYBAD marker from main"]);

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

  // === Lane A: one-gesture land (commit-if-dirty → land) + ↩ undo-last-land ===
  // Isolated fresh repos so main-mutation + undo never touch the shared REPO later tests use.
  {
    const freshRepo = async (suffix: string): Promise<{ repo: string; main: string; sha: string }> => {
      const repo = `${REPO}.${suffix}`;
      spawnSync("git", ["init", "-q", "-b", "main", repo]); // fakemerge hardcodes `git rebase main`
      spawnSync("git", ["-C", repo, "config", "user.email", "e2e@test"]);
      spawnSync("git", ["-C", repo, "config", "user.name", "e2e"]);
      spawnSync("git", ["-C", repo, "config", "commit.gpgsign", "false"]);
      await Bun.write(`${repo}/base.txt`, "base\n");
      spawnSync("git", ["-C", repo, "add", "base.txt"]);
      spawnSync("git", ["-C", repo, "commit", "-qm", "base"]);
      return { repo, main: "main", sha: spawnSync("git", ["-C", repo, "rev-parse", "HEAD"]).stdout.toString().trim() };
    };
    const headOf = (repo: string, ref = "HEAD"): string => spawnSync("git", ["-C", repo, "rev-parse", ref]).stdout.toString().trim();
    // land a lane with committed work via the clean script path (no conflict → agent never consulted)
    const landClean = async (slot: number): Promise<void> => {
      await setMergeMode("blocked"); // a clean rebase must NOT consult the agent
      await settleForMerge(slot);
      await post(`/api/slots/${slot}/merge`, {});
      await waitMerge(slot);
    };

    // --- one-gesture land: a lane with ONLY uncommitted work lands in one flow (commit → land),
    // the owner never pre-commits. Mirrors doLand: commit (agent message) then /land→/merge. ---
    const og = await freshRepo("onegesture");
    const lane = (await (await post("/api/lanes", { repo: og.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${lane.cwd}/feature.txt`, "feature work\n"); // uncommitted — the friction one-gesture removes
    const ogCommit = (await (await post(`/api/slots/${lane.slot}/commit`, { mode: "agent" })).json()) as { committed?: boolean; subject?: string };
    check("one-gesture land: the dirty tree is committed first (agent message)",
      ogCommit.committed === true && ogCommit.subject === "feat: stand-in commit message", JSON.stringify(ogCommit));
    check("one-gesture land: direct /land refuses the committed-but-unmerged lane (→ /merge fallback)",
      (await post(`/api/slots/${lane.slot}/land`, {})).status === 409);
    // a second lane on the SAME repo, kept open, so the undoable land is observable on the board
    const probe = (await (await post("/api/lanes", { repo: og.repo })).json()) as { slot: number; branch: string };
    const ogBefore = headOf(og.repo, og.main);
    await landClean(lane.slot);
    check("one-gesture land: committed work then landed (landed slot torn down)",
      (await get(`/api/slots/${lane.slot}/merge`)).status === 400);
    const ogAfter = headOf(og.repo, og.main);
    check("one-gesture land: main advanced past its pre-land SHA", ogAfter !== ogBefore, `${ogBefore} -> ${ogAfter}`);
    check("one-gesture land: the committed work reached main with the expected message",
      spawnSync("git", ["-C", og.repo, "log", "--oneline"]).stdout.toString().includes("stand-in commit message"),
      spawnSync("git", ["-C", og.repo, "log", "--oneline"]).stdout.toString().trim());
    // the undoable land surfaces to the board via GET /merge on any live lane of the same repo
    const probeMg = (await (await get(`/api/slots/${probe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("undo: the landed lane is exposed as undoable on the repo's board",
      probeMg.undoable?.branch === lane.branch, JSON.stringify(probeMg.undoable));

    // --- undo resets main to the EXACT pre-land SHA; keeps the branch; is one-shot ---
    const undo = await post("/api/repos/undo-land", { repo: og.repo });
    const undoJ = (await undo.json()) as { ok?: boolean; to?: string };
    check("undo-land resets main to the exact pre-land SHA",
      undo.ok === true && headOf(og.repo, og.main) === ogBefore, `${JSON.stringify(undoJ)} now=${headOf(og.repo, og.main)} want=${ogBefore}`);
    check("undo-land keeps the landed branch (work recoverable by reopening the lane)",
      spawnSync("git", ["-C", og.repo, "rev-parse", "--verify", "-q", `refs/heads/${lane.branch}`]).status === 0);
    check("undo-land clears the undoable record from the board",
      (((await (await get(`/api/slots/${probe.slot}/merge`)).json()) as { undoable?: unknown }).undoable ?? null) === null);
    check("undo-land is one-shot — a second undo has nothing left to undo",
      (await post("/api/repos/undo-land", { repo: og.repo })).status === 404);
    await post(`/api/slots/${probe.slot}/kill`, {});

    // --- undo REFUSES when main moved since the land (a new commit landed on top) ---
    const mv = await freshRepo("undomoved");
    const mvLane = (await (await post("/api/lanes", { repo: mv.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${mvLane.cwd}/f.txt`, "work\n");
    spawnSync("git", ["-C", mvLane.cwd, "add", "f.txt"]);
    spawnSync("git", ["-C", mvLane.cwd, "commit", "-qm", "lane work"]);
    await landClean(mvLane.slot);
    const mvAfterLand = headOf(mv.repo, mv.main);
    await Bun.write(`${mv.repo}/onmain.txt`, "later\n"); // main moves on top of the land
    spawnSync("git", ["-C", mv.repo, "add", "onmain.txt"]);
    spawnSync("git", ["-C", mv.repo, "commit", "-qm", "later main work"]);
    const mvMoved = headOf(mv.repo, mv.main);
    const mvUndo = await post("/api/repos/undo-land", { repo: mv.repo });
    const mvUndoJ = (await mvUndo.json()) as { error?: string };
    check("undo REFUSES when main moved since the land",
      mvUndo.status === 409 && (mvUndoJ.error ?? "").includes("moved"), `${mvUndo.status} ${JSON.stringify(mvUndoJ)}`);
    check("refused undo (moved) leaves main exactly where it was",
      headOf(mv.repo, mv.main) === mvMoved && mvMoved !== mvAfterLand, `now=${headOf(mv.repo, mv.main)}`);

    // --- undo REFUSES when the landed commit is already on a remote (would rewrite shared history) ---
    const rm = await freshRepo("undoremote");
    spawnSync("git", ["init", "--bare", "-q", `${rm.repo}.remote.git`]);
    spawnSync("git", ["-C", rm.repo, "remote", "add", "origin", `${rm.repo}.remote.git`]);
    const rmLane = (await (await post("/api/lanes", { repo: rm.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${rmLane.cwd}/f.txt`, "work\n");
    spawnSync("git", ["-C", rmLane.cwd, "add", "f.txt"]);
    spawnSync("git", ["-C", rmLane.cwd, "commit", "-qm", "lane work"]);
    await landClean(rmLane.slot);
    const rmAfterLand = headOf(rm.repo, rm.main);
    spawnSync("git", ["-C", rm.repo, "push", "-q", "origin", rm.main]); // land now on a remote
    spawnSync("git", ["-C", rm.repo, "fetch", "-q", "origin"]);
    const rmUndo = await post("/api/repos/undo-land", { repo: rm.repo });
    const rmUndoJ = (await rmUndo.json()) as { error?: string };
    check("undo REFUSES when the landed commit is already on a remote",
      rmUndo.status === 409 && (rmUndoJ.error ?? "").includes("remote"), `${rmUndo.status} ${JSON.stringify(rmUndoJ)}`);
    check("refused undo (remote) leaves main exactly where it was", headOf(rm.repo, rm.main) === rmAfterLand);

    // --- REGRESSION GUARD: a CONFLICTING one-gesture land still PAUSES for review (human gate) ---
    const cf = await freshRepo("conflict");
    const cfLane = (await (await post("/api/lanes", { repo: cf.repo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cfLane.cwd}/base.txt`, "base\nlane-side\n"); // uncommitted — one-gesture commits it
    check("regression guard: one-gesture commits the dirty conflicting lane",
      ((await (await post(`/api/slots/${cfLane.slot}/commit`, { mode: "quick" })).json()) as { committed?: boolean }).committed === true);
    await Bun.write(`${cf.repo}/base.txt`, "base\nmain-side\n"); // same line → rebase conflict → agent path
    spawnSync("git", ["-C", cf.repo, "commit", "-aqm", "main conflict"]);
    const cfMainBefore = headOf(cf.repo, cf.main);
    await setMergeMode("do"); // agent resolves the conflict, then the server PAUSES for review
    await settleForMerge(cfLane.slot);
    await post(`/api/slots/${cfLane.slot}/merge`, {});
    const cfV = await waitMerge(cfLane.slot);
    check("regression guard: a conflicting land PAUSES (resolved, NOT landed, lane kept)",
      !cfV.gone && cfV.last?.status === "resolved" && cfV.last.landed === false && exists(cfLane.cwd), JSON.stringify(cfV.last));
    check("regression guard: the human gate held — nothing reached main, no undoable land recorded",
      headOf(cf.repo, cf.main) === cfMainBefore
      && (((await (await get(`/api/slots/${cfLane.slot}/merge`)).json()) as { undoable?: unknown }).undoable ?? null) === null,
      `main=${headOf(cf.repo, cf.main)} before=${cfMainBefore}`);
    await post(`/api/slots/${cfLane.slot}/kill`, {});

    // --- V2: server-written git-note provenance at land ("own your work", design note §4).
    // On every land that MOVES main, the SERVER attaches the review story to the landed tip
    // as a note under refs/notes/fleet/land — server-authored (never the agent), best-effort
    // (a note-write failure never fails the land), never deleted (survives undo-land). ---
    const readNote = (repo: string, sha: string): { ok: boolean; json: Record<string, unknown> | null } => {
      const r = spawnSync("git", ["-C", repo, "notes", "--ref=fleet/land", "show", sha]);
      if (r.status !== 0) return { ok: false, json: null };
      try { return { ok: true, json: JSON.parse(r.stdout.toString().trim()) as Record<string, unknown> }; }
      catch { return { ok: false, json: null }; }
    };

    // (1) clean-path land → a note that PARSES and carries the land's own before/after +
    //     the server verify result (green). Mutation guard: drop writeLandNote → this fails.
    const pn = await freshRepo("provnote");
    const pnLane = (await (await post("/api/lanes", { repo: pn.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pnLane.cwd}/prov.txt`, "clean lane work, no marker\n");
    spawnSync("git", ["-C", pnLane.cwd, "add", "prov.txt"]);
    spawnSync("git", ["-C", pnLane.cwd, "commit", "-qm", "prov lane work"]);
    const pnBefore = headOf(pn.repo, pn.main);
    await landClean(pnLane.slot);
    const pnAfter = headOf(pn.repo, pn.main);
    const pnNote = readNote(pn.repo, pnAfter);
    check("V2: a clean-path land writes a fleet/land git note on the landed tip that parses", pnNote.ok, JSON.stringify(pnNote));
    check("V2: the note records this land's own mainBefore→mainAfter, branch, and confirmedByHuman:false",
      pnNote.json?.mainBefore === pnBefore && pnNote.json?.mainAfter === pnAfter
      && pnNote.json?.branch === pnLane.branch && pnNote.json?.confirmedByHuman === false,
      `before=${pnBefore} after=${pnAfter} ${JSON.stringify(pnNote.json)}`);
    check("V2: the note carries the SERVER verify fact (green), not an agent self-claim",
      (pnNote.json?.verify as { ok?: boolean; mainSha?: string } | undefined)?.ok === true
      && typeof (pnNote.json?.verify as { mainSha?: string } | undefined)?.mainSha === "string",
      JSON.stringify(pnNote.json?.verify));

    // (2) the note SURVIVES undo-land — it is the record THAT the land happened, never deleted.
    const pnUndo = await post("/api/repos/undo-land", { repo: pn.repo });
    check("V2 setup: undo-land succeeds on the clean-path land", pnUndo.ok === true,
      `${pnUndo.status} main=${headOf(pn.repo, pn.main)} before=${pnBefore}`);
    const pnNoteAfterUndo = readNote(pn.repo, pnAfter);
    check("V2: the provenance note survives undo-land (the record of THAT it happened is never deleted)",
      pnNoteAfterUndo.ok && pnNoteAfterUndo.json?.mainAfter === pnAfter, JSON.stringify(pnNoteAfterUndo));

    // (3) confirm-land → confirmedByHuman:true, carrying the reviewed conflicted files + resolver detail.
    const pc = await freshRepo("provconfirm");
    const pcLane = (await (await post("/api/lanes", { repo: pc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pcLane.cwd}/base.txt`, "base\nlane-side\n"); // conflict on base.txt
    spawnSync("git", ["-C", pcLane.cwd, "commit", "-aqm", "prov confirm lane work"]);
    await Bun.write(`${pc.repo}/base.txt`, "base\nmain-side\n");    // same line on main → agent resolves
    spawnSync("git", ["-C", pc.repo, "commit", "-aqm", "prov confirm main work"]);
    await setMergeMode("do");
    await settleForMerge(pcLane.slot);
    await post(`/api/slots/${pcLane.slot}/merge`, {});
    const pcV = await waitMerge(pcLane.slot);
    check("V2 setup: conflicting lane resolved + paused for review", !pcV.gone && pcV.last?.status === "resolved", JSON.stringify(pcV.last));
    const pcBefore = headOf(pc.repo, pc.main);
    await settleForMerge(pcLane.slot);
    const pcConf = (await (await post(`/api/slots/${pcLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("V2 setup: the owner confirm-lands the reviewed resolution", pcConf.status === "merged" && pcConf.landed === true, JSON.stringify(pcConf));
    const pcAfter = headOf(pc.repo, pc.main);
    const pcNote = readNote(pc.repo, pcAfter);
    check("V2: the confirm-land note records confirmedByHuman:true (the human owned this land)",
      pcNote.ok && pcNote.json?.confirmedByHuman === true, JSON.stringify(pcNote.json));
    check("V2: the confirm-land note carries the reviewed conflicted files + the resolver detail",
      Array.isArray(pcNote.json?.conflicted) && (pcNote.json?.conflicted as string[]).includes("base.txt")
      && typeof pcNote.json?.resolverDetail === "string" && (pcNote.json?.resolverDetail as string).length > 0,
      JSON.stringify(pcNote.json));
    check("G1 control: an un-moved confirm-land note carries a FRESH verify (green, no stale marker)",
      (pcNote.json?.verify as VerifyField | undefined)?.ok === true
      && (pcNote.json?.verify as VerifyField | undefined)?.stale === undefined,
      JSON.stringify(pcNote.json?.verify));

    // (4) a land whose NOTE-WRITE FAILS still lands (best-effort provenance, landing is the job).
    //     Sabotage: refs/notes/fleet as a FILE → `git notes add refs/notes/fleet/land` hits a
    //     D/F lock error, while refs/heads/main (the land's own ff) is untouched.
    const pf = await freshRepo("provfail");
    const pfLane = (await (await post("/api/lanes", { repo: pf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${pfLane.cwd}/pf.txt`, "clean lane work\n");
    spawnSync("git", ["-C", pfLane.cwd, "add", "pf.txt"]);
    spawnSync("git", ["-C", pfLane.cwd, "commit", "-qm", "provfail lane work"]);
    await Bun.write(`${pf.repo}/.git/refs/notes/fleet`, "block\n"); // non-directory in the notes-ref path
    const pfBefore = headOf(pf.repo, pf.main);
    await landClean(pfLane.slot);
    const pfAfter = headOf(pf.repo, pf.main);
    check("V2: a land whose note-write FAILS still lands (main advanced, lane torn down)",
      pfAfter !== pfBefore && (await get(`/api/slots/${pfLane.slot}/merge`)).status === 400,
      `before=${pfBefore} after=${pfAfter}`);
    check("V2: the failed note-write left no note and did not wedge the land", readNote(pf.repo, pfAfter).ok === false);

    // --- G1: land provenance survives teardown failure. recordLand must couple to the
    // MAIN-MOVE (advanceIntegration), not the teardown: a landLane failure after a
    // successful advance previously left main ff'd with NO note and NO undo record while
    // the owner read "not landed" — a silent provenance hole on the human-gated action.
    // Lever: chmod the lane worktree dir read-only — every pre-land step is a read
    // (status/rebase-up-to-date/verify/advance-in-repo) and passes, but `git worktree
    // remove` cannot unlink the entries and fails deterministically.

    // (a1) CLEAN path (mergeJob): advance ok, landLane fails → verdict carries a distinct
    // landError, and note + undo record exist anyway.
    const tf = await freshRepo("teardownfail");
    const tfLane = (await (await post("/api/lanes", { repo: tf.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tfLane.cwd}/tf.txt`, "teardown-fail lane work\n");
    spawnSync("git", ["-C", tfLane.cwd, "add", "tf.txt"]);
    spawnSync("git", ["-C", tfLane.cwd, "commit", "-qm", "teardown-fail lane work"]);
    const tfProbe = (await (await post("/api/lanes", { repo: tf.repo })).json()) as { slot: number }; // board observer for undoable
    const tfBefore = headOf(tf.repo, tf.main);
    spawnSync("chmod", ["555", tfLane.cwd]); // the teardown obstacle
    await setMergeMode("blocked"); // clean rebase — agent must not be consulted
    await settleForMerge(tfLane.slot);
    await post(`/api/slots/${tfLane.slot}/merge`, {});
    const tfV = await waitMerge(tfLane.slot);
    spawnSync("chmod", ["755", tfLane.cwd]); // restore before asserting, whatever happened
    const tfAfter = headOf(tf.repo, tf.main);
    check("G1a setup: the obstacle held — main advanced but the lane survived on disk",
      tfAfter !== tfBefore && exists(tfLane.cwd), `before=${tfBefore} after=${tfAfter} exists=${exists(tfLane.cwd)}`);
    check("G1a: clean-path verdict reports the teardown failure as its own landError field (merged, landed:false)",
      !tfV.gone && tfV.last?.status === "merged" && tfV.last.landed === false
      && (tfV.last.landError ?? "").includes("worktree remove failed"),
      JSON.stringify(tfV.last));
    const tfNote = readNote(tf.repo, tfAfter);
    check("G1a: the moved main carries its fleet/land note despite the failed teardown",
      tfNote.ok && tfNote.json?.mainBefore === tfBefore && tfNote.json?.mainAfter === tfAfter
      && tfNote.json?.branch === tfLane.branch && tfNote.json?.confirmedByHuman === false,
      JSON.stringify(tfNote.json));
    const tfUndoable = (await (await get(`/api/slots/${tfProbe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("G1a: the undo record exists despite the failed teardown (the land stays undoable)",
      tfUndoable.undoable?.branch === tfLane.branch, JSON.stringify(tfUndoable.undoable));
    await post(`/api/slots/${tfLane.slot}/kill`, {});
    await post(`/api/slots/${tfProbe.slot}/kill`, {});

    // (a2) CONFIRM-land path: same invariant on the human-gated route — the response
    // reports the teardown failure distinctly instead of a bare "not landed" error.
    const tc = await freshRepo("teardownconfirm");
    const tcLane = (await (await post("/api/lanes", { repo: tc.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${tcLane.cwd}/base.txt`, "base\ntc-lane\n"); // conflict on base.txt → agent path
    spawnSync("git", ["-C", tcLane.cwd, "commit", "-aqm", "tc lane work"]);
    await Bun.write(`${tc.repo}/base.txt`, "base\ntc-main\n");
    spawnSync("git", ["-C", tc.repo, "commit", "-aqm", "tc main work"]);
    const tcProbe = (await (await post("/api/lanes", { repo: tc.repo })).json()) as { slot: number };
    await setMergeMode("do");
    await settleForMerge(tcLane.slot);
    await post(`/api/slots/${tcLane.slot}/merge`, {});
    const tcV = await waitMerge(tcLane.slot);
    check("G1b setup: conflicting lane resolved + paused for review", !tcV.gone && tcV.last?.status === "resolved", JSON.stringify(tcV.last));
    const tcBefore = headOf(tc.repo, tc.main);
    spawnSync("chmod", ["555", tcLane.cwd]);
    const tcConfRes = await post(`/api/slots/${tcLane.slot}/merge`, { confirm: true });
    const tcConf = (await tcConfRes.json()) as { status?: string; landed?: boolean; landError?: string; error?: string };
    spawnSync("chmod", ["755", tcLane.cwd]);
    const tcAfter = headOf(tc.repo, tc.main);
    check("G1b setup: confirm-land advanced main, lane survived on disk",
      tcAfter !== tcBefore && exists(tcLane.cwd), `before=${tcBefore} after=${tcAfter} exists=${exists(tcLane.cwd)}`);
    check("G1b: confirm-land reports the teardown failure as its own landError field (merged, landed:false)",
      tcConf.status === "merged" && tcConf.landed === false
      && (tcConf.landError ?? "").includes("worktree remove failed"),
      `http=${tcConfRes.status} ${JSON.stringify(tcConf)}`);
    const tcNote = readNote(tc.repo, tcAfter);
    check("G1b: the confirm-land note exists despite the failed teardown, owned by the human",
      tcNote.ok && tcNote.json?.mainBefore === tcBefore && tcNote.json?.mainAfter === tcAfter
      && tcNote.json?.confirmedByHuman === true, JSON.stringify(tcNote.json));
    const tcUndoable = (await (await get(`/api/slots/${tcProbe.slot}/merge`)).json()) as { undoable?: { branch: string } | null };
    check("G1b: the undo record exists despite the failed teardown",
      tcUndoable.undoable?.branch === tcLane.branch, JSON.stringify(tcUndoable.undoable));
    await post(`/api/slots/${tcLane.slot}/kill`, {});
    await post(`/api/slots/${tcProbe.slot}/kill`, {});

    // (b) STALE-VERIFY guard: main moves between the verify (at resolve time) and the
    // owner's confirm; the replay lands cleanly — but the recorded verify never saw the
    // landed state ("a verdict is void once main moves past it"). The note must mark it
    // stale, never carry a silently stale green.
    const sv = await freshRepo("staleverify");
    const svLane = (await (await post("/api/lanes", { repo: sv.repo })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${svLane.cwd}/base.txt`, "base\nsv-lane\n"); // conflict → agent resolves, verify runs
    spawnSync("git", ["-C", svLane.cwd, "commit", "-aqm", "sv lane work"]);
    await Bun.write(`${sv.repo}/base.txt`, "base\nsv-main\n");
    spawnSync("git", ["-C", sv.repo, "commit", "-aqm", "sv main work"]);
    await setMergeMode("do");
    await settleForMerge(svLane.slot);
    await post(`/api/slots/${svLane.slot}/merge`, {});
    const svV = await waitMerge(svLane.slot);
    check("G1c setup: lane resolved with a green verify bound to the pre-move main",
      !svV.gone && svV.last?.status === "resolved" && svV.last.verify?.ok === true
      && typeof svV.last.verify.mainSha === "string", JSON.stringify(svV.last?.verify));
    const svVerifiedSha = svV.last?.verify?.mainSha ?? "";
    await Bun.write(`${sv.repo}/moved.txt`, "moved after verify\n"); // unrelated move → replay lands
    spawnSync("git", ["-C", sv.repo, "add", "moved.txt"]);
    spawnSync("git", ["-C", sv.repo, "commit", "-qm", "sv main moved after verify"]);
    const svConf = (await (await post(`/api/slots/${svLane.slot}/merge`, { confirm: true })).json()) as { status?: string; landed?: boolean };
    check("G1c setup: the replayed confirm-land landed", svConf.status === "merged" && svConf.landed === true, JSON.stringify(svConf));
    const svAfter = headOf(sv.repo, sv.main);
    const svNote = readNote(sv.repo, svAfter);
    const svNoteVerify = svNote.json?.verify as VerifyField | undefined;
    check("G1c: the landed note marks the outdated verify STALE (never a silently stale green)",
      svNote.ok && svNoteVerify?.ok === true && svNoteVerify.stale === true,
      JSON.stringify(svNoteVerify));
    check("G1c: the stale verify still names the main it actually verified (≠ the landed mainBefore)",
      svNoteVerify?.mainSha === svVerifiedSha && svNote.json?.mainBefore !== svVerifiedSha,
      `verified=${svVerifiedSha} mainBefore=${String(svNote.json?.mainBefore)}`);

    await setMergeMode("blocked"); // restore the suite default for later tests in this scope
  }

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
  const selfPerp = await selfAuto({ token: selfTok, body: { text: "self immortal", inSec: 5, everySec: 10, perpetual: true } });
  check("a self-token lane cannot mint a perpetual auto (owner-only, 403)", selfPerp.status === 403, String(selfPerp.status));
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

// --- Tier-0 (synergy-findings.md #1): the master stop + quiet hours reach the DISPATCHER too,
// not just scheduled autos. MUST run before the restart section below — that restart respawns srv
// WITHOUT FLEET_DISPATCH_REPO, permanently disabling the dispatcher. Non-tautological: the SAME
// queued task is actually dispatched once both gates open (positive control), proving the negatives
// stayed queued because of the gate, not a dead queue. Preserves the persistence lane
// (restartSelfSlot) that the restart section needs alive. ---
{
  const DISP_TICK_MS = 9000; // > the 8s tickDispatch interval, so a full tick fires within the wait
  const sessJson = async (): Promise<{ slots: { id: number; cwd: string | null; worktree: unknown | null }[]; tasks: { id: string; status: string; note?: string }[]; dispatch: { on: boolean; maxLanes: number }; autosOn: boolean; quietHours: unknown }> =>
    (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; worktree: unknown | null }[]; tasks: { id: string; status: string; note?: string }[]; dispatch: { on: boolean; maxLanes: number }; autosOn: boolean; quietHours: unknown };
  const laneIds = async (): Promise<number[]> => (await sessJson()).slots.filter((s) => s.worktree).map((s) => s.id);
  // free every worktree lane EXCEPT the persistence lane, so lanes < maxLanes and a slot is free
  for (const id of await laneIds()) if (id !== restartSelfSlot) await post(`/api/slots/${id}/kill`, {});
  await Bun.sleep(600);
  await post("/api/dispatch", { on: true });
  const sess0 = await sessJson();
  const lanes0 = new Set(sess0.slots.filter((s) => s.worktree).map((s) => s.id));
  check("dispatch gate: precondition — dispatcher on, a free slot, lanes < cap (non-tautology guard)",
    sess0.dispatch.on === true && sess0.slots.some((s) => !s.cwd) && lanes0.size < sess0.dispatch.maxLanes,
    `on=${sess0.dispatch.on} free=${sess0.slots.filter((s) => !s.cwd).length} lanes=${lanes0.size}/${sess0.dispatch.maxLanes}`);
  const taskStatus = async (id: string): Promise<string | undefined> => (await sessJson()).tasks.find((t) => t.id === id)?.status;

  // (a) master stop: pause BEFORE queuing (no consumption window), then a full tick must not consume
  await post("/api/autos/switch", { on: false });
  const dTask = (await (await post("/api/tasks", { text: "dispatch-gate-probe", queue: false })).json()) as { task: { id: string } };
  const tid = dTask.task.id;
  await post(`/api/tasks/${tid}/queue`, {});
  await Bun.sleep(DISP_TICK_MS);
  check("master stop (autosOn=false) keeps a dispatch task QUEUED — dispatcher never spawns a lane",
    (await taskStatus(tid)) === "queued" && (await laneIds()).length === lanes0.size, `status=${await taskStatus(tid)} lanes=${(await laneIds()).length} (was ${lanes0.size})`);

  // (b) quiet hours: quiet fleet must NOT consume the still-queued task either
  await post("/api/autos/switch", { on: true });
  const dQh = new Date().getHours();
  await post("/api/autos/quiet", { start: dQh, end: (dQh + 2) % 24 });
  await Bun.sleep(DISP_TICK_MS);
  check("quiet hours keep a dispatch task QUEUED — dispatcher suppressed like the autos surface",
    (await taskStatus(tid)) === "queued" && (await laneIds()).length === lanes0.size, `status=${await taskStatus(tid)} lanes=${(await laneIds()).length} (was ${lanes0.size})`);

  // (c) positive control: both gates open → the SAME task is dispatched (proves the gate is causal)
  await post("/api/autos/quiet", { start: null });
  let consumed = false;
  for (let i = 0; i < 30; i++) { // up to ~15s (≈2 ticks) for the now-eligible task to be dispatched
    await Bun.sleep(500);
    if ((await taskStatus(tid)) !== "queued") { consumed = true; break; }
  }
  const sessEnd = await sessJson();
  const tEnd = sessEnd.tasks.find((x) => x.id === tid);
  check("with both gates open the dispatcher DOES consume the same task (proves the gate, not a dead queue)",
    consumed, `task=${JSON.stringify(tEnd)} dispatchOn=${sessEnd.dispatch.on} autosOn=${sessEnd.autosOn} quiet=${JSON.stringify(sessEnd.quietHours)}`);

  // cleanup: kill only the lane the positive control spawned (a worktree slot new since setup, never
  // the persistence lane), delete the probe task, restore the dispatcher off (persisted off).
  for (const id of await laneIds()) if (!lanes0.has(id) && id !== restartSelfSlot) await post(`/api/slots/${id}/kill`, {});
  await post(`/api/tasks/${tid}/delete`, {});
  await post("/api/dispatch", { on: false });
}

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
  check("share host blocks the audit read endpoint even with token", (await fetch(BASE + "/api/audit", { headers: { host: SHARE_HOST, ...H } })).status === 404);
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
  // an all-digit id (≈2.3% of runs) has no uppercase variant — the premise doesn't exist, pass vacuously
  check("share host: uppercase share id does not bypass the lowercase-only regex", !/[a-f]/.test(shView.id) || (await fetch(BASE + `/s/${shView.id.toUpperCase()}`,
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
// FLEET_OUTCOME_WINDOW_MS / FLEET_PROMOTION_MIN_N must ride across the restart too, or the
// post-restart server reverts to the 10-min default window and the outcome tests (which run
// after this section) can never measure a send inside the test's time budget.
// FLEET_DISPATCH_REPO + the fake-agent cmds must ride across too, or every post-restart test
// meets a server whose dispatcher is permanently unavailable and whose merge/summary/commit
// agents are the real `claude` instead of the suite's stand-ins.
// FLEET_VERIFY_CMD is DELIBERATELY excluded here (do not add it): the post-restart server
// must run with NO verify command so the V1 "no cmd → verify field absent, clean path lands
// as today" case below is exercised against a genuinely unconfigured server (§3). The
// configured-server verify cases run before this restart.
const cmdEnv = ["FLEET_CMD", "FLEET_ALLOWED_HOSTS", "FLEET_SHARE_HOSTS", "FLEET_AUDIT_ROTATE_BYTES",
  "FLEET_OUTCOME_WINDOW_MS", "FLEET_OUTCOME_SUSTAIN_MS", "FLEET_HARM_ATTEST_TTL_MS",
  "FLEET_PROMOTION_MIN_N", "FLEET_INTAKE_SECRET", "FLEET_DISPATCH_REPO",
  "FLEET_SUMMARY_CMD", "FLEET_ENHANCE_CMD", "FLEET_MERGE_CMD", "FLEET_COMMIT_CMD", "FLEET_DIGEST_CMD"]
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

// --- V1 case C: an UNCONFIGURED server (no FLEET_VERIFY_CMD — deliberately dropped from
// cmdEnv above). The verify field must be ABSENT from the verdict ("unverified", never
// silently green — design note §3), and today's clean-path behavior is otherwise unchanged.
// A CONFLICT lane keeps its verdict readable (a clean land tears the slot down), so we can
// assert the field's absence directly; that resolved path is exactly where verify WOULD run
// were a command configured. ---
{
  const REPO_C = process.env.FLEET_E2E_REPO ?? "";
  if (REPO_C) {
    const { spawnSync } = await import("node:child_process"); // block-scoped import at line 624 is out of scope here
    const modeFile = `${REPO_C.replace(/\/[^/]+$/, "")}/mergemode`;
    await Bun.write(modeFile, "do"); // fakemerge (carried across the restart) really resolves
    const lc = (await (await post("/api/lanes", { repo: REPO_C })).json()) as { slot: number; cwd: string };
    await Bun.write(`${lc.cwd}/code.txt`, "root\nnoverify-lane\n");
    spawnSync("git", ["-C", lc.cwd, "commit", "-aqm", "noverify lane work"]);
    await Bun.write(`${REPO_C}/code.txt`, "root\nnoverify-main\n"); // same line → conflict → agent
    spawnSync("git", ["-C", REPO_C, "commit", "-aqm", "noverify main work"]);
    // settle: wait until the lane pane has been idle ≥ MERGE_IDLE_MS (3s) so the land gate lets
    // the merge start (mirrors the in-block settleForMerge, which is out of scope here)
    for (let i = 0; i < 80; i++) {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === lc.slot);
      if (sl && sx.now - sl.lastOutput >= 3000) break;
      await Bun.sleep(150);
    }
    await post(`/api/slots/${lc.slot}/merge`, {});
    let lastC: { status?: string; verify?: unknown } | null = null;
    for (let i = 0; i < 100; i++) {
      const j = (await (await get(`/api/slots/${lc.slot}/merge`)).json()) as
        { running?: boolean; last: { status?: string; verify?: unknown } | null };
      if (!j.running) { lastC = j.last; break; }
      await Bun.sleep(100);
    }
    check("V1: with NO FLEET_VERIFY_CMD the resolved verdict omits the verify field (unverified, not silently green)",
      lastC?.status === "resolved" && lastC !== null && !("verify" in lastC), JSON.stringify(lastC));
    await post(`/api/slots/${lc.slot}/kill`, {});
    await Bun.write(modeFile, "blocked"); // restore the default merge mode
  }
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
const sess3 = (await (await get("/api/sessions")).json()) as { autos: { id: string; enabled: boolean; perpetual?: boolean }[] };
check("after restart: schedule persisted", sess3.autos.some((a) => a.id === aPersistJ.auto.id && a.enabled));
check("after restart: perpetual auto persisted with its flag intact",
  sess3.autos.some((a) => a.id === aPerpPersistJ.auto?.id && a.enabled && a.perpetual === true),
  JSON.stringify(sess3.autos.find((a) => a.id === aPerpPersistJ.auto?.id)));
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

// --- audit log: security-relevant event trail, own file/write-chain, owner-gated read ---
const auditPath = `${import.meta.dir}/audit.jsonl`;
const auditRead = async (): Promise<{ ts: number; event: string; slot?: number; detail?: string }[]> =>
  (await Bun.file(auditPath).text()).trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
check("audit endpoint requires owner token", (await fetch(BASE + "/api/audit")).status === 401);
const auditRes = await get("/api/audit?limit=1000");
const auditJ = (await auditRes.json()) as { events: { event: string; slot?: number }[]; total: number };
check("audit endpoint returns events", auditRes.ok && Array.isArray(auditJ.events) && auditJ.events.length > 0,
  `${auditJ.events.length}/${auditJ.total}`);
const auditAll = await auditRead();
check("audit records slot_open", auditAll.some((e) => e.event === "slot_open" && e.slot === 2), `${auditAll.length} events`);
check("audit records slot_kill", auditAll.some((e) => e.event === "slot_kill" && e.slot === 1));
check("audit records share_create", auditAll.some((e) => e.event === "share_create"));
check("audit records share_revoke", auditAll.some((e) => e.event === "share_revoke"));
check("audit records share_mode_change", auditAll.some((e) => e.event === "share_mode_change"));
check("audit records guest auth failure", auditAll.some((e) => e.event === "share_auth_fail"));
check("audit records guest auth success", auditAll.some((e) => e.event === "share_auth_ok"));
check("audit records owner auth failure", auditAll.some((e) => e.event === "owner_auth_fail"));
check("audit records guest ws connect", auditAll.some((e) => e.event === "guest_ws_connect"));
const readText = async (p: string): Promise<string> => {
  try {
    return await Bun.file(p).text();
  } catch {
    return "";
  }
};
const auditRaw = (await readText(auditPath)) + (await readText(`${auditPath}.1`));
check("audit log never contains the guessed guest password", !auditRaw.includes("totally-wrong"));
check("audit log never contains a share secret", !auditRaw.includes("viewpass123") && !auditRaw.includes("interpass123"));
check("audit log never contains the owner token", !auditRaw.includes(TOKEN));
const auditMode = statSync(auditPath).mode & 0o777;
check("audit log file is 600", auditMode === 0o600, auditMode.toString(8));

// --- rotation: restart with the threshold pinned to the CURRENT file size, so the very
// next audit event is guaranteed to push it over and trigger exactly one rotation —
// deterministic regardless of how many bytes the rest of the suite happened to produce
const auditSizeBeforeRotate = statSync(auditPath).size;
check("audit log has content to rotate", auditSizeBeforeRotate > 0, `${auditSizeBeforeRotate} bytes`);
const rotKill = Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]);
await rotKill.exited;
await Bun.sleep(500);
const rotStart = Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
  `cd '${import.meta.dir}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${cmdEnv}FLEET_AUDIT_ROTATE_BYTES=${auditSizeBeforeRotate} exec bun server.ts >> server.log 2>&1`]);
await rotStart.exited;
await Bun.sleep(3000);
// one cheap, deterministic audit event: a failed owner-token request (no state mutated)
await fetch(BASE + "/api/sessions", { headers: { authorization: "Bearer wrong-for-rotation-test" } });
await Bun.sleep(300); // let the fire-and-forget audit write chain flush
const auditRotExists = ((): boolean => { try { return statSync(`${auditPath}.1`).isFile(); } catch { return false; } })();
check("audit log rotates to .1 once the size threshold is crossed", auditRotExists);
if (auditRotExists) {
  const rotSize = statSync(`${auditPath}.1`).size;
  check("rotated .1 preserves the pre-rotation history", rotSize >= auditSizeBeforeRotate, `${rotSize} vs ${auditSizeBeforeRotate}`);
  const freshSize = statSync(auditPath).size;
  check("post-rotation audit.jsonl starts fresh, smaller than what rotated out", freshSize < auditSizeBeforeRotate, `${freshSize} vs ${auditSizeBeforeRotate}`);
}

// --- steward principal: scoped token, typed+capped sends, read-only fleet-wide access ---
{
  const stewTokRes = await get("/api/steward/token");
  const stewTokJ = (await stewTokRes.json()) as { token?: string };
  check("owner can read the steward token", stewTokRes.ok && !!stewTokJ.token, JSON.stringify(stewTokJ));
  const STEW = stewTokJ.token ?? "";
  const stewH = { "content-type": "application/json", authorization: `Bearer ${STEW}` };
  const stewGet = (path: string) => fetch(BASE + path, { headers: stewH });
  const stewPost = (path: string, body: unknown) =>
    fetch(BASE + path, { method: "POST", headers: stewH, body: JSON.stringify(body) });

  const lnStew = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "⚙ steward" });

  // --- reads: fleet-wide, but reduced (no share secrets, no thinking/tool-result payloads) ---
  const stewSessRes = await stewGet("/api/steward/sessions");
  const stewSessJ = (await stewSessRes.json()) as { slots: { id: number; cwd: string | null; label: string | null }[] };
  check("steward token reads /api/steward/sessions", stewSessRes.ok && Array.isArray(stewSessJ.slots), JSON.stringify(stewSessJ).slice(0, 200));
  check("steward sessions payload carries no share secret field",
    !JSON.stringify(stewSessJ).includes("password"));
  const stewBriefRes = await stewGet(`/api/steward/slots/${lnStew.slot}/brief`);
  check("steward token reads a lane's brief", stewBriefRes.ok, String(stewBriefRes.status));
  const stewTrRes = await stewGet(`/api/steward/slots/${lnStew.slot}/transcript`);
  check("steward token reads a lane's transcript", stewTrRes.ok, String(stewTrRes.status));

  // --- transcript REDACTION value-assertions (server.ts steward transcript route): the steward
  // is a fleet-wide reader, so its transcript view must strip claude's private thinking blocks
  // and clamp long tool_result payloads to 400 chars — a `.ok` check alone (above) passes even
  // if both guards are deleted. Plant a transcript with a KNOWN thinking block + an oversize
  // tool_result into the lane cwd's claude project dir, then read it back through the route.
  // The project dir slug matches server.ts's projDir(); the cwd is a unique throwaway worktree
  // path, so this file cannot collide with any real project and is removed right after. ---
  {
    const { rmSync } = await import("node:fs");
    const projDir = `${process.env.HOME}/.claude/projects/${lnStew.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const THINK_MARKER = "THINKING_SECRET_MUST_BE_REDACTED_zzq";
    const VISIBLE_MARKER = "visible-assistant-answer-marker";
    // tool_result: head marker within the first 400 chars (kept), tail marker past 400 (trimmed off)
    const toolContent = `TOOLHEAD_${"x".repeat(500)}_TOOLTAIL_MARKER_MUST_BE_TRIMMED_${"z".repeat(200)}`;
    const jsonl =
      JSON.stringify({ type: "assistant", timestamp: "2026-01-01T00:00:00Z",
        message: { content: [{ type: "thinking", thinking: THINK_MARKER }, { type: "text", text: VISIBLE_MARKER }] } }) + "\n" +
      JSON.stringify({ type: "user", timestamp: "2026-01-01T00:00:01Z",
        message: { content: [{ type: "tool_result", content: toolContent }] } }) + "\n";
    await Bun.write(`${projDir}/planted-redaction.jsonl`, jsonl);
    try {
      const redRes = await stewGet(`/api/steward/slots/${lnStew.slot}/transcript`);
      const redJ = (await redRes.json()) as { entries: { role: string; blocks: { t: string; text: string }[] }[] };
      const raw = JSON.stringify(redJ);
      const allBlocks = redJ.entries.flatMap((e) => e.blocks);
      // positive control: the planted entries actually flowed through (else the redaction asserts are vacuous)
      check("redaction: planted transcript is served (positive control)",
        redRes.ok && allBlocks.some((b) => b.t === "text" && b.text.includes(VISIBLE_MARKER)), raw.slice(0, 200));
      // guard 1 — thinking stripped: no thinking block, and the secret text appears nowhere
      check("steward transcript strips claude's thinking blocks (no t:thinking, secret text absent)",
        !allBlocks.some((b) => b.t === "thinking") && !raw.includes(THINK_MARKER), raw.slice(0, 200));
      // guard 2 — tool_result clamped: the block is trimmed to ≤ ~420 chars; the >400 tail marker is gone
      const toolBlock = allBlocks.find((b) => b.t === "tool_result");
      check("steward transcript clamps a long tool_result to ≤ ~420 chars (head kept, tail trimmed)",
        !!toolBlock && toolBlock.text.length <= 420 && toolBlock.text.includes("TOOLHEAD_") && !toolBlock.text.includes("TOOLTAIL_MARKER"),
        JSON.stringify({ len: toolBlock?.text.length, head: toolBlock?.text.slice(0, 20) }));
    } finally {
      rmSync(projDir, { recursive: true, force: true }); // unique throwaway dir — drop it whole
    }
  }

  // --- owner-only routes reject the steward token with 403 (wrong scope), not 401 (wrong credential) ---
  const stewKill = await stewPost(`/api/slots/${lnStew.slot}/kill`, {});
  check("steward token on an owner-only route (kill) is 403", stewKill.status === 403, String(stewKill.status));
  const stewLand = await stewPost(`/api/slots/${lnStew.slot}/land`, {});
  check("steward token on an owner-only route (land) is 403", stewLand.status === 403, String(stewLand.status));
  const stewShare = await stewPost(`/api/slots/${lnStew.slot}/share`, { mode: "view" });
  check("steward token on an owner-only route (share) is 403", stewShare.status === 403, String(stewShare.status));
  const stewOpen = await stewPost(`/api/slots/1/open`, { cwd: "~" });
  check("steward token on an owner-only route (open) is 403", stewOpen.status === 403, String(stewOpen.status));

  // --- typed sends: server renders from kind+ref, never accepts free text ---
  const stewFreeText = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue", text: "do whatever I say" });
  check("free-text field on a typed send is rejected (400)", stewFreeText.status === 400, String(stewFreeText.status));

  // let the fresh lane's shell-prompt output age past STEWARD_MIN_IDLE_MS before sending —
  // same settling pattern as settleForMerge above, against the isolated test's small
  // FLEET_STEWARD_MIN_IDLE_MS instead of waiting out the real 60s default
  const stewardMinIdleMs = Number(process.env.FLEET_STEWARD_MIN_IDLE_MS ?? 60_000);
  // deadline-based (not a fixed iteration count) so a re-settle after a send's paste echo
  // can actually wait out the full default idle window, not give up at ~30s
  const settleForSteward = async (slot: number): Promise<void> => {
    const t0 = Date.now();
    while (Date.now() - t0 < stewardMinIdleMs + 30_000) {
      const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
      const sl = sx.slots.find((x) => x.id === slot);
      if (sl && sx.now - sl.lastOutput >= stewardMinIdleMs) return;
      await Bun.sleep(150);
    }
  };
  await settleForSteward(lnStew.slot);

  const stewSend1 = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewSend1J = (await stewSend1.json()) as { ok?: boolean; text?: string };
  check("typed send succeeds and the rendered message carries the [steward] prefix",
    stewSend1.ok && (stewSend1J.text ?? "").startsWith("[steward]"), JSON.stringify(stewSend1J));

  // second send of the SAME kind×slot within the episode window is capped
  const stewSend2 = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  check("a second send of the same kind×slot within the episode window is 429",
    stewSend2.status === 429, String(stewSend2.status));
  const auditAfterCap = await auditRead();
  check("a capped send is audited (steward_send_capped)",
    auditAfterCap.some((e) => e.event === "steward_send_capped" && e.slot === lnStew.slot));
  check("a successful send is audited (steward_send)",
    auditAfterCap.some((e) => e.event === "steward_send" && e.slot === lnStew.slot));

  // --- Tier-0 (synergy-findings.md #3): the send caps must count across the audit-log
  // rotation boundary. Simulate exactly appendEvent's rotation (renameSync file → file.1),
  // so the pre-rotation steward_send now lives ONLY in .1 — the caps must still see it
  // there, not reset toward zero because the live file is fresh/absent. ---
  const { renameSync, writeFileSync } = await import("node:fs");
  await Bun.sleep(300); // let the fire-and-forget audit chain flush before renaming
  renameSync(auditPath, `${auditPath}.1`);
  // stewSend1's paste echo reset the target pane's idle clock — wait it out again so the
  // attempt reaches the cap gates (canDeliver runs before them) instead of 409ing on busy
  await settleForSteward(lnStew.slot);
  const stewRotSend = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewRotSendJ = (await stewRotSend.json()) as { error?: string; ok?: boolean };
  check("episode cap survives an audit rotation — pre-rotation send still counted from .1 (429)",
    stewRotSend.status === 429 && !stewRotSendJ.ok && (stewRotSendJ.error ?? "").includes("episode"),
    `${stewRotSend.status} ${JSON.stringify(stewRotSendJ)}`);
  // hourly "should refuse" across the same boundary: top .1 up with a cap's worth (server
  // default 10) of recent steward_send lines — exactly what .1 holds right after a real
  // mid-window rotation — then a DIFFERENT kind (immune to the episode cap) must still be
  // refused by the hourly counter. The refused attempt pasted nothing, so the pane is idle.
  const preForge = await readText(`${auditPath}.1`);
  const forged = Array.from({ length: 10 }, () =>
    JSON.stringify({ ts: Date.now(), event: "steward_send", slot: lnStew.slot, detail: "state_relay:merge_resolved" })).join("\n");
  await Bun.write(`${auditPath}.1`, `${preForge}${forged}\n`);
  const stewHourlyRot = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "lifecycle_op", ref: "handoff" });
  const stewHourlyRotJ = (await stewHourlyRot.json()) as { error?: string; ok?: boolean };
  check("hourly cap survives an audit rotation — a cap's worth of pre-rotation sends still refuses (429)",
    stewHourlyRot.status === 429 && !stewHourlyRotJ.ok && (stewHourlyRotJ.error ?? "").includes("hourly"),
    `${stewHourlyRot.status} ${JSON.stringify(stewHourlyRotJ)}`);
  await Bun.write(`${auditPath}.1`, preForge); // drop the forged lines so later real sends aren't hourly-capped

  // --- Tier-0 (synergy-findings.md #1): the master stop and quiet hours now reach the steward's
  // OWN /api/steward/send, not just the scheduled-auto surface. canDeliver runs BEFORE the send
  // caps, so a paused/quiet fleet returns 409 (its own reason) rather than the 429 episode cap
  // already held above — and the distinct error string proves WHICH gate fired (not "not idle"). ---
  await post("/api/autos/switch", { on: false });
  const stewKilled = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewKilledJ = (await stewKilled.json()) as { error?: string; ok?: boolean };
  check("master stop (autosOn=false) blocks a direct steward send — no delivery (409, 'paused')",
    stewKilled.status === 409 && !stewKilledJ.ok && (stewKilledJ.error ?? "").includes("paused"),
    `${stewKilled.status} ${JSON.stringify(stewKilledJ)}`);
  await post("/api/autos/switch", { on: true });

  const stewQh = new Date().getHours();
  await post("/api/autos/quiet", { start: stewQh, end: (stewQh + 2) % 24 });
  const stewQuietBlocked = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "continue_nudge", ref: "continue" });
  const stewQuietBlockedJ = (await stewQuietBlocked.json()) as { error?: string; ok?: boolean };
  check("quiet hours now mute a direct steward send too — no delivery (409, 'quiet hours')",
    stewQuietBlocked.status === 409 && !stewQuietBlockedJ.ok && (stewQuietBlockedJ.error ?? "").includes("quiet hours"),
    `${stewQuietBlocked.status} ${JSON.stringify(stewQuietBlockedJ)}`);
  await post("/api/autos/quiet", { start: null });

  // --- scope: unknown kind, unknown ref, and slot 2 (not the steward's own slot) for autos ---
  const stewBadKind = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "not_a_kind", ref: "x" });
  check("an unknown kind is rejected (400)", stewBadKind.status === 400, String(stewBadKind.status));
  const stewBadRef = await stewPost("/api/steward/send", { slot: lnStew.slot, kind: "lifecycle_op", ref: "not_a_ref" });
  check("an unrecognized ref is rejected (400)", stewBadRef.status === 400, String(stewBadRef.status));

  const stewAutoRes = await stewPost("/api/steward/autos", { text: "steward self check-in", inSec: 3600, slot: 2 });
  const stewAutoJ = (await stewAutoRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("steward's own autos route lands on the steward's OWN slot regardless of a spoofed `slot` field",
    stewAutoRes.ok && stewAutoJ.auto?.slot === lnStew.slot, JSON.stringify(stewAutoJ));
  if (stewAutoJ.auto) await post(`/api/autos/${stewAutoJ.auto.id}/delete`, {});
  const stewPerp = await stewPost("/api/steward/autos", { text: "steward immortal", inSec: 5, everySec: 10, perpetual: true });
  check("steward cannot mint a perpetual auto (owner-only, 403)", stewPerp.status === 403, String(stewPerp.status));
  const stewSwitch = await stewPost("/api/autos/switch", { on: false });
  check("steward cannot flip the global automation kill-switch (out of scope, 403)", stewSwitch.status === 403, String(stewSwitch.status));
  const stewQuiet = await stewPost("/api/autos/quiet", { start: 0, end: 6 });
  check("steward cannot set quiet hours (owner-only, 403)", stewQuiet.status === 403, String(stewQuiet.status));

  // --- an unknown steward token is unauthorized like any other unrecognized credential ---
  const wrongStew = await fetch(BASE + "/api/steward/sessions", { headers: { authorization: "Bearer " + "0".repeat(32) } });
  check("an unknown steward-shaped token is 401 (falls through to the owner gate)", wrongStew.status === 401, String(wrongStew.status));

  // --- self-token regression: the pre-existing self-autos route is untouched by the steward lane ---
  await tmuxOut("send-keys", "-t", `s${lnStew.slot}`, `printf 'SELFTOK=[%s]\\n' "$FLEET_SELF_TOKEN"`, "Enter");
  await Bun.sleep(600);
  const capStewTok = await tmuxOut("capture-pane", "-t", `s${lnStew.slot}`, "-p");
  const stewSelfTok = /SELFTOK=\[([0-9a-f]{32})\]/.exec(capStewTok.out)?.[1] ?? "";
  const selfRegRes = await fetch(BASE + "/api/self/autos", {
    method: "POST",
    headers: { "content-type": "application/json", "x-fleet-self-token": stewSelfTok },
    body: JSON.stringify({ text: "self regression after steward lane build", inSec: 3600 }),
  });
  const selfRegJ = (await selfRegRes.json()) as { ok?: boolean; auto?: { id: string; slot: number } };
  check("self-autos route still works unchanged for a lane that also happens to be labeled steward",
    selfRegRes.ok && selfRegJ.auto?.slot === lnStew.slot, JSON.stringify(selfRegJ));
  if (selfRegJ.auto) await post(`/api/autos/${selfRegJ.auto.id}/delete`, {});

  // --- FLEET_STEWARD_TOKEN is baked into the ⚙ steward pane's spawn env (bake-at-spawn, keyed
  // on the steward label) so the Rundgang can self-serve /api/steward/* without the owner token.
  // Env is only injectable at spawn: the lane above was spawned label-less then relabeled, so
  // the token appears only after the pane (re)spawns WITH the label set — identical semantics to
  // FLEET_SELF_TOKEN. Force a self-heal respawn to observe it. ---
  await tmuxOut("kill-session", "-t", `s${lnStew.slot}`);
  for (let i = 0; i < 80; i++) {
    if ((await tmuxOut("has-session", "-t", `s${lnStew.slot}`)).code === 0) break;
    await Bun.sleep(100);
  }
  await Bun.sleep(700); // let the resumed shell settle before it can echo the env
  await tmuxOut("send-keys", "-t", `s${lnStew.slot}`, `printf 'STEWTOK=[%s]\\n' "$FLEET_STEWARD_TOKEN"`, "Enter");
  await Bun.sleep(700);
  const capStewEnv = await tmuxOut("capture-pane", "-t", `s${lnStew.slot}`, "-p");
  const bakedStewTok = /STEWTOK=\[([0-9a-f]{32})\]/.exec(capStewEnv.out)?.[1] ?? "";
  check("FLEET_STEWARD_TOKEN is baked into a steward-labeled pane's spawn env and equals the steward token",
    bakedStewTok === STEW && STEW.length === 32, `baked=[${bakedStewTok}] steward=[${STEW}]`);

  // a non-steward slot never carries the steward token
  await tmuxOut("send-keys", "-t", "s2", `printf 'STEWTOK=[%s]\\n' "$FLEET_STEWARD_TOKEN"`, "Enter");
  await Bun.sleep(700);
  const capS2Stew = await tmuxOut("capture-pane", "-t", "s2", "-p");
  check("FLEET_STEWARD_TOKEN absent for a non-steward slot", capS2Stew.out.includes("STEWTOK=[]"), capS2Stew.out.slice(-200));

  // --- steward journal: the typed durable pulse ledger (POST/GET /api/steward/journal), the
  // delta anchor that survives /clear. The route acks without awaiting the append chain, so
  // settle briefly before each read. ---
  const jPost1 = await stewPost("/api/steward/journal", { counts: { "healthy-running": 3, "stalled-dirty": 1 }, decisions_surfaced: 1, changed: true });
  const jPost1J = (await jPost1.json()) as { ok?: boolean; ts?: number };
  check("steward journal accepts a typed record", jPost1.ok && jPost1J.ok === true && typeof jPost1J.ts === "number", JSON.stringify(jPost1J));
  await Bun.sleep(200);
  const jGet1J = (await (await stewGet("/api/steward/journal?tail=1")).json()) as { records: { kind?: string; counts?: Record<string, number>; decisions_surfaced?: number; changed?: boolean; ts?: number }[] };
  const r1 = jGet1J.records?.[0];
  check("steward journal returns the record it stored, server-stamped",
    r1?.kind === "rundgang" && r1?.counts?.["stalled-dirty"] === 1 && r1?.decisions_surfaced === 1 && r1?.changed === true && typeof r1?.ts === "number",
    JSON.stringify(jGet1J).slice(0, 200));

  // typed choke-point: malformed bodies are rejected, no free-text leaks into the ledger
  check("steward journal rejects non-object counts (400)", (await stewPost("/api/steward/journal", { counts: "all clear", decisions_surfaced: 0, changed: false })).status === 400);
  check("steward journal rejects non-number count values (400)", (await stewPost("/api/steward/journal", { counts: { x: "many" }, decisions_surfaced: 0, changed: false })).status === 400);
  check("steward journal rejects a missing changed flag (400)", (await stewPost("/api/steward/journal", { counts: { x: 1 }, decisions_surfaced: 0 })).status === 400);

  // owner token is out of scope for the steward journal, same 404 as the other steward routes
  check("owner token on the steward journal route is out of scope (404)", (await get("/api/steward/journal?tail=1")).status === 404);

  // --- 🧭 steward digest (P3 demand-triggered bounded-wait): prior/slots are computed FRESH
  // every call; only the `digest` field is cached {digest, computedAt}. A GET triggers the
  // worker only on a stale cache, races it against a caller-chosen ?wait (default ~30s, clamped
  // ≤60s), and returns fresh-if-ready else the last snapshot (or null on cold cache) + digestAt/
  // digestAge. The slow FLEET_DIGEST_CMD stand-in sleeps $DIR/digestdelay s to bound the race. ---
  type DigJ = {
    now?: number; prior?: { kind?: string } | null; slots?: { id: number }[];
    digest?: { conditions?: Record<string, string>; changed?: string[]; attention?: string[] } | null;
    digestAt?: number | null; digestAge?: number | null; waitMs?: number; error?: string;
  };
  const setDigestDelay = (s: number) => Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/digestdelay`, String(s));

  // (a) cold cache + ?wait=0: returns instantly with fresh prior/slots and a null digest+age,
  //     and STARTS the worker in the background (which will populate the cache).
  await setDigestDelay(3);
  const coldT = Date.now();
  const coldRes = await stewGet("/api/steward/digest?wait=0");
  const coldMs = Date.now() - coldT;
  const coldJ = (await coldRes.json()) as DigJ;
  check("steward digest ?wait=0 on a cold cache returns instantly with fresh prior/slots and a null digest",
    coldRes.ok && coldMs < 1500 && coldJ.digest === null && coldJ.digestAt === null && coldJ.digestAge === null
    && coldJ.waitMs === 0 && Array.isArray(coldJ.slots) && coldJ.slots.length > 0
    && coldJ.prior?.kind === "rundgang" && typeof coldJ.now === "number",
    JSON.stringify({ coldMs, digest: coldJ.digest, digestAt: coldJ.digestAt, slots: coldJ.slots?.length, prior: coldJ.prior?.kind }));

  // (c-i) a second GET while the worker is still in flight, ?wait < worker time → joins the same
  //       inflight (no second spawn), times out, returns the still-null snapshot bounded by wait.
  const midT = Date.now();
  const midJ = (await (await stewGet("/api/steward/digest?wait=1")).json()) as DigJ;
  const midMs = Date.now() - midT;
  check("steward digest ?wait below worker time returns the stale snapshot bounded by wait",
    midJ.digest === null && midJ.waitMs === 1000 && midMs >= 900 && midMs < 2500,
    JSON.stringify({ midMs, digest: midJ.digest, waitMs: midJ.waitMs }));

  // (b)+(c-ii) once the in-flight worker completes it writes the cache; a later GET returns the
  //   now-cached fresh digest INSTANTLY. digestAge >> the worker's 3s run proves it is the cached
  //   snapshot, not a fresh run (delay is set to 0 first so a stray miss couldn't slow this call).
  await new Promise((r) => setTimeout(r, 4500)); // 3s worker delay + spawn margin on a loaded box
  await setDigestDelay(0);
  const warmT = Date.now();
  const warmJ = (await (await stewGet("/api/steward/digest?wait=30")).json()) as DigJ;
  const warmMs = Date.now() - warmT;
  check("steward digest returns the now-cached fresh digest instantly after the worker completes",
    warmMs < 1500 && warmJ.digest?.conditions?.["1"] === "healthy-running"
    && warmJ.digest?.changed?.length === 1 && warmJ.digest?.changed?.[0] === "slot 1 committed"
    && Array.isArray(warmJ.digest?.attention) && warmJ.digest?.attention.length === 0
    && typeof warmJ.digestAt === "number" && typeof warmJ.digestAge === "number" && (warmJ.digestAge ?? 0) >= 3000,
    JSON.stringify({ warmMs, digest: warmJ.digest, digestAge: warmJ.digestAge }));
  // prior is recomputed FRESH each call, and since P-1a it is kind-FILTERED: a parked outcome
  // resolving into the journal between the two calls can no longer move the anchor, so the kind
  // is asserted exactly. now/slots must be fresh alongside the cached digest.
  check("steward digest carries the deterministic payload (fresh prior + slots) alongside the cached verdict",
    Array.isArray(warmJ.slots) && warmJ.slots.length > 0 && warmJ.prior?.kind === "rundgang" && typeof warmJ.now === "number",
    JSON.stringify({ slots: warmJ.slots?.length, prior: warmJ.prior?.kind, now: typeof warmJ.now }));

  // (d) ?wait is clamped to [0, 60s] — observable via the echoed waitMs (cache is fresh, so these
  //     return instantly): an over-max value is capped to 60s, a non-numeric falls back to ~30s.
  const clampJ = (await (await stewGet("/api/steward/digest?wait=9999")).json()) as DigJ;
  check("steward digest clamps an over-max ?wait to 60s", clampJ.waitMs === 60000, JSON.stringify({ waitMs: clampJ.waitMs }));
  const defJ = (await (await stewGet("/api/steward/digest?wait=notanumber")).json()) as DigJ;
  check("steward digest falls back to the ~30s default on a non-numeric ?wait", defJ.waitMs === 30000, JSON.stringify({ waitMs: defJ.waitMs }));

  check("owner token on the steward digest route is out of scope (404)", (await get("/api/steward/digest")).status === 404);
  // no steward slot → 404 (rename the steward slot away, probe, restore)
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "not-steward" });
  check("steward digest without a steward slot is 404", (await stewGet("/api/steward/digest")).status === 404);
  await post(`/api/slots/${lnStew.slot}/rename`, { label: "⚙ steward" });

  // --- steward files PENDING tasks (queue-automation.md item 1): observations become
  // reviewable proposals; the pending→queued gate stays with the owner. ---
  const stTask = await stewPost("/api/steward/tasks", { text: "steward proposal: rebase lane 3", queue: true });
  const stTaskJ = (await stTask.json()) as { ok?: boolean; task?: { id: string; status: string; source: string } };
  check("steward files a task and queue:true is DISCARDED — status hard-forced to pending",
    stTask.ok && stTaskJ.task?.status === "pending" && stTaskJ.task?.source === "steward",
    JSON.stringify(stTaskJ));
  const sessSt = (await (await get("/api/sessions")).json()) as { tasks: { id: string; status: string; source: string }[] };
  check("steward-filed task lands in the owner's queue as pending/steward",
    sessSt.tasks.some((t) => t.id === stTaskJ.task?.id && t.status === "pending" && t.source === "steward"));
  check("owner promotes the steward-filed task (pending → queued, the meta-gate)",
    (await post(`/api/tasks/${stTaskJ.task?.id}/queue`, {})).ok);
  check("steward task rejects empty text (400)", (await stewPost("/api/steward/tasks", { text: "  " })).status === 400);
  // cap: open steward-pending tasks are bounded — fill to the cap, expect 409, then clean up
  const capIds: string[] = [];
  let capHit = false;
  for (let i = 0; i < 12; i++) {
    const r = await stewPost("/api/steward/tasks", { text: `cap probe ${i}` });
    if (r.status === 409) { capHit = true; break; }
    capIds.push(((await r.json()) as { task: { id: string } }).task.id);
  }
  check("steward pending cap refuses the overflow proposal (409)", capHit, `filed=${capIds.length}`);
  for (const id of [...capIds, stTaskJ.task?.id]) await post(`/api/tasks/${id}/delete`, {});
  check("owner token on the steward tasks route is out of scope (404)",
    (await post("/api/steward/tasks", { text: "x" })).status === 404);

  // --- B1 (F-C): owner promote/dismiss of a STEWARD-origin proposal is a causally-clean
  // `propose`-class outcome. Promote → propose.helped; dismiss → the DISTINCT propose.dismissed
  // signal (not folded into noEffect, not harmed). Owner-source tasks never touch propose. ---
  const readPropose = async (): Promise<{ helped: number; noEffect: number; harmed: number; dismissed: number }> => {
    const o = (await (await stewGet("/api/steward/outcomes")).json()) as { tally: Record<string, { helped: number; noEffect: number; harmed: number; dismissed: number }> };
    return o.tally.propose ?? { helped: 0, noEffect: 0, harmed: 0, dismissed: 0 };
  };
  const pBefore = await readPropose();
  const propA = (await (await stewPost("/api/steward/tasks", { text: "propose A: promote me" })).json()) as { task: { id: string } };
  check("B1: promoting a steward proposal is accepted", (await post(`/api/tasks/${propA.task.id}/queue`, {})).ok);
  const pPromote = await readPropose();
  check("B1: promote (queue) of a steward proposal records propose.helped +1 (only helped moves)",
    pPromote.helped === pBefore.helped + 1 && pPromote.dismissed === pBefore.dismissed
      && pPromote.harmed === pBefore.harmed && pPromote.noEffect === pBefore.noEffect,
    JSON.stringify({ before: pBefore, after: pPromote }));

  const propB = (await (await stewPost("/api/steward/tasks", { text: "propose B: dismiss me" })).json()) as { task: { id: string } };
  check("B1: dismissing a steward proposal is accepted", (await post(`/api/tasks/${propB.task.id}/delete`, {})).ok);
  const pDismiss = await readPropose();
  check("B1: dismiss (delete) of a steward proposal records propose.dismissed +1 — NOT helped, NOT harmed",
    pDismiss.dismissed === pPromote.dismissed + 1 && pDismiss.helped === pPromote.helped
      && pDismiss.harmed === pPromote.harmed,
    JSON.stringify({ before: pPromote, after: pDismiss }));

  const ownerT = (await (await post("/api/tasks", { text: "owner task, not a proposal", queue: false })).json()) as { task: { id: string } };
  await post(`/api/tasks/${ownerT.task.id}/queue`, {});
  const pOwner = await readPropose();
  check("B1: promoting an OWNER-source task does NOT touch the propose tally (source guard)",
    pOwner.helped === pDismiss.helped && pOwner.dismissed === pDismiss.dismissed
      && pOwner.harmed === pDismiss.harmed && pOwner.noEffect === pDismiss.noEffect,
    JSON.stringify({ before: pDismiss, after: pOwner }));
  await post(`/api/tasks/${ownerT.task.id}/delete`, {});

  // idempotency: propA was already promoted (helped +1); deleting the now-queued proposal is
  // cleanup, not a dismissal — the pending-only guard must make it a no-op (fire ONCE per task).
  const pIdemBefore = await readPropose();
  await post(`/api/tasks/${propA.task.id}/delete`, {});
  const pIdemAfter = await readPropose();
  check("B1 idempotency: deleting an ALREADY-promoted steward proposal does NOT double-count",
    pIdemAfter.helped === pIdemBefore.helped && pIdemAfter.dismissed === pIdemBefore.dismissed,
    JSON.stringify({ before: pIdemBefore, after: pIdemAfter }));

  // --- Slot.model (synergy-findings Tier-2): per-slot claude model, validated at set time
  // (the value is baked into the pane's shell command — charset is load-bearing), persisted
  // on the slot and echoed on the owner + steward reads. The --model spawn-string proof
  // lives in the claude-gate suite (FLEET_CMD=true here never appends it). ---
  check("open rejects a bad model string (400)",
    (await post("/api/slots/1/open", { cwd: ".", model: "bad model; rm -rf" })).status === 400);
  check("lane create rejects a bad model string (400)",
    (await post("/api/lanes", { repo: REPO, model: "$(evil)" })).status === 400);
  const lnModel = (await (await post("/api/lanes", { repo: REPO, model: "sonnet-test.1" })).json()) as { slot: number };
  const sessModel = (await (await get("/api/sessions")).json()) as { slots: { id: number; model: string | null }[] };
  check("lane created with a model echoes it on /api/sessions",
    sessModel.slots.find((s) => s.id === lnModel.slot)?.model === "sonnet-test.1",
    JSON.stringify(sessModel.slots.find((s) => s.id === lnModel.slot)));
  const stewModelJ = (await (await stewGet("/api/steward/sessions")).json()) as { slots: { id: number; model: string | null }[] };
  check("steward sessions view carries the slot model",
    stewModelJ.slots.find((s) => s.id === lnModel.slot)?.model === "sonnet-test.1");
  await post(`/api/slots/${lnModel.slot}/kill`, {});
  const sessModel2 = (await (await get("/api/sessions")).json()) as { slots: { id: number; model: string | null }[] };
  check("the per-slot model dies with the session (kill clears it)",
    sessModel2.slots.find((s) => s.id === lnModel.slot)?.model === null);

  // rotation-immunity of the delta anchor: force the current file to .1, write again, assert
  // tail=2 reads BOTH (the first record from the rotated .1, the second from the fresh file)
  renameSync("steward-journal.jsonl", "steward-journal.jsonl.1");
  await stewPost("/api/steward/journal", { counts: { "healthy-running": 4 }, decisions_surfaced: 0, changed: false });
  await Bun.sleep(200);
  // tail wide enough (server max) to be robust against interleaved outcome records: the 1.5s test
  // window can close a pending send-outcome into the journal at any point around this block, and
  // B1's propose-outcome trail adds one record per owner promote/dismiss of a steward task — the
  // cap-probe cleanup above dismisses ~10 in a burst, which pushed the anchor past a tail of 10.
  const jGet2J = (await (await stewGet("/api/steward/journal?tail=50")).json()) as { records: { kind?: string; counts?: Record<string, number>; decisions_surfaced?: number; changed?: boolean }[] };
  check("steward journal delta anchor survives a rotation boundary (reads across .1)",
    jGet2J.records?.some((r) => r.kind === "rundgang" && r.decisions_surfaced === 1)
    && jGet2J.records?.some((r) => r.kind === "rundgang" && r.counts?.["healthy-running"] === 4 && r.changed === false),
    JSON.stringify(jGet2J).slice(0, 200));

  // --- intervention-outcome fuel (steward-intelligence.md §4): per-send measurement + a
  // HARM-AWARE durable per-class tally, read from STATE (never a journal scan, §3). The server
  // runs with FLEET_OUTCOME_WINDOW_MS=1500 + FLEET_PROMOTION_MIN_N=1 so this measures in seconds.
  // Measurement is folded into tickGit (~10s), so each awaitMeasured tolerates one tick. ---
  const { spawnSync } = await import("node:child_process");
  interface Outcomes {
    tally: Record<string, { helped: number; noEffect: number; harmed: number; dismissed: number }>;
    pending: { slot: number; class: string }[];
    candidates: { slot: number; class: string }[];
    eligibility: Record<string, boolean>;
    config: { minN: number; windowMs: number; harmChannelActive: boolean };
  }
  const readOutcomes = async (): Promise<Outcomes> => (await (await stewGet("/api/steward/outcomes")).json()) as Outcomes;
  const outcomeFor = async (slot: number): Promise<string | undefined> => {
    const recs = ((await (await stewGet("/api/steward/journal?tail=50")).json()) as { records: Record<string, unknown>[] }).records;
    return recs.filter((x) => x.kind === "outcome" && x.slot === slot).map((x) => x.outcome as string).pop();
  };
  const awaitMeasured = async (slot: number): Promise<void> => {
    for (let i = 0; i < 140; i++) { // ~28s: window (1.5s) + one tickGit (≤10s) + margin
      if (!(await readOutcomes()).pending.some((p) => p.slot === slot)) return;
      await Bun.sleep(200);
    }
  };

  // five fresh lanes (distinct slots) so continue_nudge's per-kind×slot episode cap never collides.
  // oc4 = dirty-delta-only (ahead unchanged), oc5 = sustained-output positive path (A1).
  const oc1 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const oc2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const oc3 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const oc4 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const oc5 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  // slots age their idle in parallel, so these sequential awaits total ~one MIN_IDLE window, not five
  await settleForSteward(oc1.slot); await settleForSteward(oc2.slot); await settleForSteward(oc3.slot);
  await settleForSteward(oc4.slot); await settleForSteward(oc5.slot);

  const oc1send = await stewPost("/api/steward/send", { slot: oc1.slot, kind: "continue_nudge", ref: "continue" });
  check("outcome: a steward send parks a pending-outcome baseline (survives via saveState)",
    oc1send.ok && (await readOutcomes()).pending.some((p) => p.slot === oc1.slot), String(oc1send.status));
  await stewPost("/api/steward/send", { slot: oc2.slot, kind: "continue_nudge", ref: "continue" });
  await stewPost("/api/steward/send", { slot: oc3.slot, kind: "continue_nudge", ref: "continue" });
  await stewPost("/api/steward/send", { slot: oc4.slot, kind: "continue_nudge", ref: "continue" });
  await stewPost("/api/steward/send", { slot: oc5.slot, kind: "continue_nudge", ref: "continue" });

  const tally0 = (await readOutcomes()).tally.continue_nudge ?? { helped: 0, noEffect: 0, harmed: 0 };
  // oc1: a real git delta (a new commit → ahead increases) in the window → helped
  spawnSync("git", ["-C", oc1.cwd, "commit", "--allow-empty", "-qm", "outcome effect delta"]);
  // oc3: transient output that BEGINS but does not still-emit at window close → no-effect
  await tmuxOut("send-keys", "-t", `s${oc3.slot}`, "echo outcome-blip", "Enter");
  // oc4: a DIRTY-only change — ahead unchanged, dirty count moves — must score no-effect. The old
  // helpedGit (`dirty !== baseline.dirty`) scored this 'helped'; ahead-increase-only fixes it (F-B.1).
  writeFileSync(`${oc4.cwd}/outcome-dirty.txt`, "uncommitted work, no new commit\n");
  // oc5: sustained output — a loop that keeps emitting so the slot is still-emitting at window
  // close (recency ≤ FLEET_OUTCOME_SUSTAIN_MS) → helped via the OUTPUT signal (not git). This path
  // was unreachable before A1 (outputBaseline was never read); shrunk SUSTAIN makes it testable.
  await tmuxOut("send-keys", "-t", `s${oc5.slot}`, "while true; do echo oc5-tick; sleep 0.1; done", "Enter");
  await awaitMeasured(oc1.slot); await awaitMeasured(oc2.slot); await awaitMeasured(oc3.slot);
  await awaitMeasured(oc4.slot); await awaitMeasured(oc5.slot);
  await tmuxOut("send-keys", "-t", `s${oc5.slot}`, "C-c"); // stop the loop now that it has been measured

  check("outcome: a git delta since baseline records 'helped'", (await outcomeFor(oc1.slot)) === "helped");
  check("outcome: no git delta and no sustained output records 'no-effect'", (await outcomeFor(oc2.slot)) === "noEffect");
  check("outcome: transient output that did not sustain to window close stays 'no-effect' (conservative)", (await outcomeFor(oc3.slot)) === "noEffect");
  check("outcome: a dirty-count change with NO new commit is 'no-effect' (ahead-increase only, not dirty-delta)", (await outcomeFor(oc4.slot)) === "noEffect");
  check("outcome: output sustained to window close records 'helped' via the output signal", (await outcomeFor(oc5.slot)) === "helped");
  const tally1 = (await readOutcomes()).tally.continue_nudge ?? { helped: 0, noEffect: 0, harmed: 0 };
  check("outcome: two 'helped' outcomes (git delta + sustained output) increment tally.continue_nudge.helped", tally1.helped === tally0.helped + 2, `${tally0.helped}->${tally1.helped}`);
  check("outcome: three 'no-effect' outcomes (idle, blip, dirty-only) increment tally.continue_nudge.noEffect", tally1.noEffect === tally0.noEffect + 3, `${tally0.noEffect}->${tally1.noEffect}`);

  // P-1a: the digest's delta anchor is the last RUNDGANG record, not the last record of any kind.
  // Deterministic here: the five outcomes just measured are the journal's newest records, while
  // the newest rundgang is the post-rotation one from the anchor test above (healthy-running: 4).
  // Unfiltered (the pre-fix behaviour) `prior` would be an `outcome` record and the pulse would
  // diff against a foreign baseline. ?wait=0 → prior is recomputed fresh regardless of the cache.
  const anchorRecs = ((await (await stewGet("/api/steward/journal?tail=50")).json()) as { records: { kind?: string }[] }).records;
  const anchorJ = (await (await stewGet("/api/steward/digest?wait=0")).json()) as DigJ & { prior?: { counts?: Record<string, number> } | null };
  check("digest delta anchor is the last RUNDGANG record, not a foreign record written since (P-1a)",
    anchorRecs[anchorRecs.length - 1]?.kind === "outcome"
    && anchorJ.prior?.kind === "rundgang" && anchorJ.prior?.counts?.["healthy-running"] === 4,
    JSON.stringify({ lastRecord: anchorRecs[anchorRecs.length - 1]?.kind, prior: anchorJ.prior }).slice(0, 240));

  // harm-BLIND guard: continue_nudge now has helped≥N(=1) and harmed==0, but the owner harm
  // channel has never operated → NOT eligible (never promote on a record that can't show harm)
  check("promotion: helped≥N but a harm-BLIND record (channel never operated) is NOT eligible",
    (await readOutcomes()).eligibility.continue_nudge === false);
  // owner marks a DIFFERENT class harmful — the ONLY writer of `harmed`, never auto/LLM-judged
  const harmRes = await post("/api/steward/outcomes/harm", { class: "lifecycle_op", ref: "commit", slot: oc1.slot });
  const harmJ = (await harmRes.json()) as { ok?: boolean; tally?: { harmed: number }; eligible?: boolean };
  check("harm-label: an owner harm-label increments tally[class].harmed", harmRes.ok && harmJ.tally?.harmed === 1, JSON.stringify(harmJ));
  check("harm-label: the harmed class is not promotion-eligible", harmJ.eligible === false);
  const afterHarm = await readOutcomes();
  check("harm-label: harmed is recorded in state and blocks that class (helped==0, harmed==1)",
    afterHarm.tally.lifecycle_op?.harmed === 1 && afterHarm.eligibility.lifecycle_op === false, JSON.stringify(afterHarm.tally.lifecycle_op));
  check("promotion: once the harm channel has operated, a clean class (helped≥N, harmed==0) IS eligible",
    afterHarm.eligibility.continue_nudge === true && afterHarm.config.harmChannelActive === true);

  // owner token is out of scope for the steward outcomes GET (steward-scoped, like the journal)
  check("owner token on the steward outcomes route is out of scope (404)", (await get("/api/steward/outcomes")).status === 404);

  // the tally lives in STATE, never the rotatable journal (§3): rotating the journal file must
  // not touch the counts. Simulate the 2nd rotation that would discard the oldest outcome lines.
  const beforeRot = JSON.stringify((await readOutcomes()).tally);
  renameSync("steward-journal.jsonl", "steward-journal.jsonl.1"); // discards the prior .1, rotates current out
  const afterRot = await readOutcomes();
  check("tally survives a journal rotation (read from state, never a journal scan — §3)",
    JSON.stringify(afterRot.tally) === beforeRot
    && (afterRot.tally.continue_nudge?.helped ?? 0) >= 1 && afterRot.tally.lifecycle_op?.harmed === 1,
    JSON.stringify(afterRot.tally).slice(0, 200));

  // A1: the harm attest is a STALENESS-GATED timestamp, not a forever latch. A fresh attest makes a
  // clean class eligible; once it ages past FLEET_HARM_ATTEST_TTL_MS the SAME class reverts to
  // ineligible until re-attested. On the old boolean-latch code `harmChannelActive` stays true
  // forever, so the stale check below (expects NOT eligible) fails there.
  const attestTtlMs = Number(process.env.FLEET_HARM_ATTEST_TTL_MS ?? 4000);
  await post("/api/steward/outcomes/harm", { attest: true }); // fresh attest (no harm label)
  check("attest: a fresh harm attest makes a clean class (helped≥N, harmed==0) promotion-eligible",
    (await readOutcomes()).eligibility.continue_nudge === true);
  await Bun.sleep(attestTtlMs + 1500); // age the attest past its freshness window
  check("attest: once the attest ages past FLEET_HARM_ATTEST_TTL_MS the class is NOT eligible (no forever-latch)",
    (await readOutcomes()).eligibility.continue_nudge === false);
  await post("/api/steward/outcomes/harm", { attest: true }); // re-attest inside the window
  check("attest: re-attesting inside the window restores eligibility",
    (await readOutcomes()).eligibility.continue_nudge === true);

  // --- A2 null-calibration: `baselineRate` (F-C). The SAME helped classifier run over ACTIVE,
  // UN-nudged slots gives the background "helped-looking" rate — a working slot commits/emits
  // anyway — so a nudged-helped count is interpretable. It is ADVISORY: it must NEVER gate
  // promotion and NEVER write outcomeTally. The server samples the busiest un-nudged slots each
  // window; the shrunk FLEET_OUTCOME_WINDOW_MS turns control cohorts over in seconds. ---
  interface BaselineOutcomes {
    tally: Record<string, { helped: number; noEffect: number; harmed: number }>;
    baselineRate: { rate: number | null; samples: number; helped: number };
  }
  const readBaseline = async (): Promise<BaselineOutcomes> =>
    (await (await stewGet("/api/steward/outcomes")).json()) as BaselineOutcomes;

  // a busy, UN-nudged active slot (no steward send): keep it emitting so it is still-emitting at
  // window close → the control classifier scores it 'helped' via the OUTPUT signal, no nudge.
  const bl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const blBefore = await readBaseline();
  const tallyBefore = JSON.stringify(blBefore.tally);
  await tmuxOut("send-keys", "-t", `s${bl.slot}`, "while true; do echo baseline-tick; sleep 0.1; done", "Enter");
  let blBusy = blBefore; // poll ~44s (a control cohort turns over roughly every tickGit≈10s)
  for (let i = 0; i < 220; i++) {
    blBusy = await readBaseline();
    if (blBusy.baselineRate.helped > blBefore.baselineRate.helped) break;
    await Bun.sleep(200);
  }
  await tmuxOut("send-keys", "-t", `s${bl.slot}`, "C-c"); // stop the loop now that it's been sampled
  check("baselineRate: a busy un-nudged slot raises the control tally (samples & helped both rose)",
    blBusy.baselineRate.samples > blBefore.baselineRate.samples
    && blBusy.baselineRate.helped > blBefore.baselineRate.helped,
    `${blBefore.baselineRate.helped}/${blBefore.baselineRate.samples} -> ${blBusy.baselineRate.helped}/${blBusy.baselineRate.samples}`);
  check("baselineRate: rate == helped/samples (advisory ratio, not truthiness)",
    blBusy.baselineRate.rate !== null && blBusy.baselineRate.samples > 0
    && Math.abs((blBusy.baselineRate.rate ?? 0) - blBusy.baselineRate.helped / blBusy.baselineRate.samples) < 1e-9,
    JSON.stringify(blBusy.baselineRate));
  check("baselineRate: the control sampler NEVER writes outcomeTally (advisory only — never gates, never tallies)",
    JSON.stringify(blBusy.tally) === tallyBefore, `${tallyBefore} -> ${JSON.stringify(blBusy.tally)}`);

  // no-effect control: after the loop stops, drain any cohort that overlapped it, then a window
  // with NO un-nudged slot committing/emitting must record a NON-helped sample — samples rise,
  // helped stays flat (an idle un-nudged slot correctly looks un-helped).
  await Bun.sleep(1500 /* OUTCOME_WINDOW_MS */ + 12_000 /* one tickGit + margin, drains the loop-overlapping cohort */);
  const blIdleStart = await readBaseline();
  let blIdle = blIdleStart;
  for (let i = 0; i < 120; i++) {
    blIdle = await readBaseline();
    if (blIdle.baselineRate.samples > blIdleStart.baselineRate.samples) break;
    await Bun.sleep(200);
  }
  check("baselineRate: an idle window (no un-nudged slot committing/emitting) records a no-effect sample (samples rose, helped flat)",
    blIdle.baselineRate.samples > blIdleStart.baselineRate.samples
    && blIdle.baselineRate.helped === blIdleStart.baselineRate.helped,
    `${blIdleStart.baselineRate.helped}/${blIdleStart.baselineRate.samples} -> ${blIdle.baselineRate.helped}/${blIdle.baselineRate.samples}`);
  // NOTE: the control lane is released further down, with the other lane kills that precede the
  // dispatch block — it counts against FLEET_DISPATCH_MAX_LANES (default 3) and would otherwise
  // starve the dispatcher. It must NOT be killed here: the "inactive slot reads null" check below
  // takes the first cwd-less slot, and a just-killed slot keeps stale git/alive readings until the
  // next tickGit (≤10s) clears them (server.ts, the `if (!s.cwd)` cache-purge branch in tickGit).

  // --- Tier-1 signal surface (synergy-findings.md): the steward's READ routes expose the
  // deterministic facts the server already computes — cached claudeAlive, idleMs, gitOp, the
  // FULL mergeLast verdict, and the lane's founding Task. The FLEET_CMD=true suite can only
  // prove the cache PLUMBING (claudeAlive short-circuits true here); the dead-vs-live pane
  // readings and the cache-for-reads/fresh-for-gates safety proof live in the claude-gate
  // harness (fleet-e2e-claude-gate.ts), where a real claude process can die. ---
  interface SigSlot {
    id: number; cwd: string | null; lastOutput: number;
    alive: boolean | null; gitOp: boolean | null; idleMs: number | null;
    merge: { status: string; detail: string; conflicted: string[]; at: number } | null;
    task: { id: string; status: string; source: string; text: string } | null;
  }
  const sigSessions = async (): Promise<{ now: number; slots: SigSlot[] }> =>
    (await (await stewGet("/api/steward/sessions")).json()) as { now: number; slots: SigSlot[] };
  const sigFor = async (slot: number): Promise<SigSlot | undefined> =>
    (await sigSessions()).slots.find((x) => x.id === slot);

  // cached alive: tickGit (≤10s) must deliver a reading for a live pane
  let sigOc2: SigSlot | undefined;
  for (let i = 0; i < 80; i++) {
    sigOc2 = await sigFor(oc2.slot);
    if (sigOc2?.alive === true) break;
    await Bun.sleep(250);
  }
  check("steward sessions surfaces the cached claudeAlive reading for a live pane", sigOc2?.alive === true, JSON.stringify(sigOc2));
  check("gitOp reads false for an unwedged lane (control for the wedged assertion below)", sigOc2?.gitOp === false);
  check("no merge verdict yet → merge reads null (control for the verdict assertion below)", sigOc2?.merge === null);

  // idleMs is server-computed from the same `now` the payload carries — exact, not approximate
  const sigAll = await sigSessions();
  const sigIdle = sigAll.slots.find((x) => x.id === oc2.slot);
  check("steward sessions surfaces idleMs = now − lastOutput for an active slot",
    sigIdle?.idleMs === Math.max(0, sigAll.now - (sigIdle?.lastOutput ?? 0)), JSON.stringify({ now: sigAll.now, slot: sigIdle }));
  const sigFree = sigAll.slots.find((x) => !x.cwd);
  check("an inactive slot reads null across the signal surface (alive/gitOp/idleMs/merge/task)",
    !!sigFree && sigFree.alive === null && sigFree.gitOp === null && sigFree.idleMs === null
    && sigFree.merge === null && sigFree.task === null, JSON.stringify(sigFree));

  // FULL mergeLast verdict: run a conflicting merge with the fake agent in "blocked" mode —
  // the steward previously saw only `mergePending`; a failed/refused land was invisible.
  await Bun.write(`${oc2.cwd}/sig.txt`, "lane side\n");
  spawnSync("git", ["-C", oc2.cwd, "add", "sig.txt"]);
  spawnSync("git", ["-C", oc2.cwd, "commit", "-qm", "signal lane work"]);
  await Bun.write(`${REPO}/sig.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "sig.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "signal main work"]);
  await Bun.write(`${REPO.replace(/\/[^/]+$/, "")}/mergemode`, "blocked");
  for (let i = 0; i < 80; i++) { // settle past MERGE_IDLE_MS (3s) so the merge job actually starts
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === oc2.slot);
    if (sl && sx.now - sl.lastOutput >= 3000) break;
    await Bun.sleep(150);
  }
  const sigMgPost = await (await post(`/api/slots/${oc2.slot}/merge`, {})).json();
  let sigMgLast: unknown = null;
  for (let i = 0; i < 150; i++) { // wait for the async merge job to settle
    const mj = (await (await get(`/api/slots/${oc2.slot}/merge`)).json()) as { running?: boolean; last?: unknown };
    if (!mj.running) { sigMgLast = mj.last ?? null; break; }
    await Bun.sleep(100);
  }
  const sigMerge = await sigFor(oc2.slot);
  check("steward sessions surfaces the FULL mergeLast verdict of a refused land (status+detail+conflicted)",
    sigMerge?.merge?.status === "blocked" && sigMerge.merge.detail === "fake conflict" && Array.isArray(sigMerge.merge.conflicted)
    && typeof sigMerge.merge.at === "number",
    `merge=${JSON.stringify(sigMerge?.merge)} post=${JSON.stringify(sigMgPost)} last=${JSON.stringify(sigMgLast)}`);
  const sigBrief = (await (await stewGet(`/api/steward/slots/${oc2.slot}/brief`)).json()) as { merge?: { status?: string } | null };
  check("the steward brief carries the same merge verdict", sigBrief.merge?.status === "blocked", JSON.stringify(sigBrief.merge));

  // gitOp: wedge a real mid-rebase conflict in the lane → the cached flag flips true
  const sigMain = spawnSync("git", ["-C", REPO, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
  spawnSync("git", ["-C", oc2.cwd, "rebase", sigMain]); // stops on the sig.txt conflict
  let sigWedged: SigSlot | undefined;
  for (let i = 0; i < 80; i++) {
    sigWedged = await sigFor(oc2.slot);
    if (sigWedged?.gitOp === true) break;
    await Bun.sleep(250);
  }
  check("steward sessions surfaces a wedged merge/rebase (gitOp true)", sigWedged?.gitOp === true, JSON.stringify(sigWedged?.gitOp));
  spawnSync("git", ["-C", oc2.cwd, "rebase", "--abort"]);

  await post(`/api/slots/${oc1.slot}/kill`, {});
  await post(`/api/slots/${oc2.slot}/kill`, {});
  await post(`/api/slots/${oc3.slot}/kill`, {});
  await post(`/api/slots/${lnStew.slot}/kill`, {});
  await post(`/api/slots/${bl.slot}/kill`, {}); // A2 control lane — free its lane budget for the dispatch block

  // --- Task on the signal surface: dispatch a queued task and the holding lane's steward
  // view carries the founding intent (id/status/source/text) it was started for. ---
  {
    await post("/api/dispatch", { on: true });
    const sigTask = (await (await post("/api/tasks", { text: "steward-signal task probe", queue: false })).json()) as { task: { id: string } };
    const sigTid = sigTask.task.id;
    await post(`/api/tasks/${sigTid}/queue`, {});
    let sigLaneSlot = 0;
    for (let i = 0; i < 80; i++) { // dispatch tick (8s) + 4s boot re-gate → give it ~40s
      const found = (await sigSessions()).slots.find((x) => x.task?.id === sigTid && x.task.status === "sent");
      if (found) { sigLaneSlot = found.id; break; }
      await Bun.sleep(500);
    }
    const sigLane = sigLaneSlot ? await sigFor(sigLaneSlot) : undefined;
    check("steward sessions surfaces the dispatched lane's founding Task (id/status/source/text)",
      !!sigLane?.task && sigLane.task.id === sigTid && sigLane.task.status === "sent"
      && sigLane.task.source === "owner" && sigLane.task.text.startsWith("steward-signal task probe"),
      JSON.stringify(sigLane?.task ?? null));
    await post("/api/dispatch", { on: false });
    if (sigLaneSlot) await post(`/api/slots/${sigLaneSlot}/kill`, {});
    await post(`/api/tasks/${sigTid}/delete`, {});
  }
}

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

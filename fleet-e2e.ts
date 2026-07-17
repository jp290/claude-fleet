// e2e for claude-fleet: run from the repo root with the server already up.
//   bun fleet-e2e.ts
// Creates slots 1+2, kills them, and restarts the `srv` tmux session along the way.
const IP = process.env.FLEET_E2E_HOST ?? "127.0.0.1";
// match the server's env so the whole suite can target an isolated instance
// (own port + own tmux socket) instead of the live fleet — see e2e-isolated.sh
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
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

// --- file permissions ---
const { statSync } = await import("node:fs");
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
const cmdEnv = process.env.FLEET_CMD ? `FLEET_CMD='${process.env.FLEET_CMD.replaceAll("'", "'\\''")}' ` : "";
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
check("after restart: history persisted", h2b.history.length === 1 && h2b.history[0]?.text === "compose-box-to-slot-two", `${h2b.history.length} entries`);
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

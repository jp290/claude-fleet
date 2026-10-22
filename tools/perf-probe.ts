// tools/perf-probe.ts — isolated browser measurements of rebuilds, Long Tasks and the four Fleet journeys.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import type { RebuildCounts } from "../src/perfmarks";
import type { PerfRecord } from "../src/protocol";
import type { TaskInfo } from "../src/client";

export const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
export const CONVERSATION_LINES = Array.from({ length: 24 }, (_, i) => JSON.stringify({
  type: i % 2 ? "assistant" : "user", uuid: `turn-${i}`, timestamp: "2026-10-05T12:00:00.000Z",
  message: { role: i % 2 ? "assistant" : "user", ...(i % 2 ? { model: "claude-sonnet-4-6" } : {}),
    content: [{ type: "text", text: `Fixture turn ${i}: ${"fixed conversation text. ".repeat(5)}` }] },
}));
const sourceRoot = (): string => join(import.meta.dir, "..");
const run = async (argv: string[], cwd: string, env: Record<string, string>): Promise<string> => {
  const p = Bun.spawn(argv, { cwd, env, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code) throw new Error(`${argv[0]} exited ${code}: ${out}\n${err}`);
  return out;
};
export async function scratchInstance(): Promise<{
  dir: string; repo: string; base: string;
  get: (path: string) => Promise<Response>; stop: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), "fleet-perf-"));
  const repo = join(dir, "repo"), sock = `fleet-perf-${process.pid}-${dir.slice(-6)}`;
  const portProbe = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const port = portProbe.port!; await portProbe.stop(true);
  const token = crypto.randomUUID();
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: join(dir, "home"), TMPDIR: dir,
    LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8",
    FLEET_HOST: "127.0.0.1", FLEET_PORT: String(port), FLEET_SOCK: sock, FLEET_TOKEN: token,
    FLEET_INSTANCE: "performance-fixture", FLEET_CMD: "cat", FLEET_LANDS: "0",
    FLEET_LANE_AUTOCLOSE: "0", FLEET_STATE_SNAPSHOT_MS: "0",
    FLEET_CLAUDE_PROJECTS_DIR: join(dir, "projects"), FLEET_REPO_DIR: repo,
  };
  let server: ReturnType<typeof Bun.spawn> | undefined;
  const stop = async (): Promise<void> => {
    if (server) { server.kill(); await server.exited; server = undefined; }
    const socketPath = await run(["tmux", "-L", sock, "display-message", "-p", "#{socket_path}"], dir, env).then((s) => s.trim()).catch(() => "");
    await run(["tmux", "-L", sock, "kill-server"], dir, env).catch(() => undefined);
    if (socketPath && basename(socketPath) === sock) rmSync(socketPath, { force: true });
    rmSync(dir, { recursive: true, force: true });
  };
  try {
    mkdirSync(env.HOME!, { recursive: true }); mkdirSync(repo);
    const root = sourceRoot();
    const identity = await run(["git", "rev-parse", "HEAD", "HEAD^{tree}"], root, env);
    const [head, tree] = identity.trim().split("\n");
    const dirty = (await run(["git", "status", "--porcelain"], root, env)).trim() !== "";
    console.log("MEASURED SOURCE", JSON.stringify({ root, head, tree, dirty }));
    for (const file of readdirSync(root).filter((f) => f.endsWith(".ts"))) cpSync(join(root, file), join(dir, file));
    for (const file of ["src", "server", "public", "package.json", "fleet-sync.sh"]) cpSync(join(root, file), join(dir, file), { recursive: true });
    symlinkSync(join(root, "node_modules"), join(dir, "node_modules"));
    const built = await Bun.build({ entrypoints: [join(root, "src/client.ts")], target: "browser", minify: true });
    if (!built.success) throw new Error(built.logs.map(String).join("\n"));
    writeFileSync(join(dir, "public/app.js"), await built.outputs[0]!.text());
    await run(["git", "init", "-q", "-b", "main"], repo, env);
    await run(["git", "config", "user.name", "Fixture"], repo, env);
    await run(["git", "config", "user.email", "fixture@example.invalid"], repo, env);
    writeFileSync(join(repo, "code.txt"), "fixed fixture\n");
    await run(["git", "add", "code.txt"], repo, env);
    await run(["git", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"], repo, env);
    const projects = join(env.FLEET_CLAUDE_PROJECTS_DIR!, repo.replace(/[^a-zA-Z0-9]/g, "-"));
    mkdirSync(projects, { recursive: true });
    for (let i = 1; i <= 8; i++) {
      const id = CONVERSATION_ID.slice(0, -1) + i;
      writeFileSync(join(projects, `${id}.jsonl`), CONVERSATION_LINES.join("\n") + "\n");
    }
    const slots: Record<string, unknown> = {};
    for (let i = 1; i <= 8; i++) {
      await run(["tmux", "-L", sock, "new-session", "-d", "-s", `s${i}`, "-c", repo, "cat"], dir, env);
      slots[String(i)] = { cwd: repo, label: `Fixture ${i}`, openedAt: 1_791_201_600_000,
        sessionId: CONVERSATION_ID.slice(0, -1) + i };
    }
    writeFileSync(join(dir, "fleet.json"), JSON.stringify({ sock, token, slots, tasks: [], events: [] }));
    server = Bun.spawn(["bun", "server.ts"], { cwd: dir, env, stdout: Bun.file(join(dir, "server.log")), stderr: Bun.file(join(dir, "server.err")) });
    const base = `http://127.0.0.1:${port}`;
    const get = (path: string): Promise<Response> => fetch(base + path, { headers: { authorization: `Bearer ${token}` } });
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error(`scratch server exited: ${readFileSync(join(dir, "server.err"), "utf8")}`);
      const ready = await get("/api/sessions").then(async (r) => {
        if (!r.ok) return false;
        const body = await r.json() as { slots: { cwd: string | null; git: { branch: string } | null; workplace: { mainCheckout: boolean } | null }[] };
        return body.slots.length === 16 && body.slots.filter((s) => s.cwd).length === 8
          && body.slots.filter((s) => s.cwd).every((s) => s.git?.branch === "main" && s.workplace?.mainCheckout === true);
      }).catch(() => false);
      if (ready) return { dir, repo, base, get, stop };
      await Bun.sleep(50);
    }
    throw new Error("scratch server did not become ready in 30 s");
  } catch (err) { await stop(); throw err; }
}

async function browserProbe(fx: Awaited<ReturnType<typeof scratchInstance>>): Promise<void> {
  const entry = join(fx.dir, "lab.ts");
  const root = sourceRoot();
  writeFileSync(entry, `import {renderSlots,panes,focused,showSlot} from ${JSON.stringify(join(root, "src/client.ts"))};
import {renderBoard,renderSuiteMeter,setBoard} from ${JSON.stringify(join(root, "src/board.ts"))};
import {renderQueue,openQueue,invalidateQueueList} from ${JSON.stringify(join(root, "src/queue.ts"))};
import {perfRebuilds} from ${JSON.stringify(join(root, "src/perfmarks.ts"))};
globalThis.__fleetProbe={counts:perfRebuilds,renderSlots,renderBoard,renderQueue,renderSuiteMeter,setBoard,openQueue,invalidateQueueList,showSlot,get panes(){return panes},get current(){return panes[focused]}};`);
  const build = await Bun.build({ entrypoints: [entry], target: "browser", minify: true });
  if (!build.success) throw new Error(build.logs.map(String).join("\n"));
  writeFileSync(join(fx.dir, "public/app.js"), await build.outputs[0]!.text());
  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("google-chrome")
    ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = Bun.spawn([executable, "--headless", "--no-sandbox", "--disable-gpu", "--no-first-run",
    "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${fx.dir}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const endpoint = await Promise.race([
      (async () => { let log = ""; for await (const chunk of browser.stderr) {
        log += new TextDecoder().decode(chunk); const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
        if (match) return match[1]!;
      } throw new Error("Chrome exited before CDP became ready"); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Chrome startup timeout")), 30_000); }),
    ]).finally(() => clearTimeout(timer));
    socket = new WebSocket(endpoint);
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> => new Promise((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error(`CDP timeout: ${method}`)); }, 30_000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown> };
      if (msg.id === undefined) return;
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p?.bad(new Error(JSON.stringify(msg.error))); else p?.ok(msg.result ?? {});
    };
    const target = await send("Target.createTarget", { url: "about:blank" });
    sessionId = String((await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).sessionId);
    const evaluate = async <T>(expression: string): Promise<T> => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return (result.result as { value: T }).value;
    };
    const wait = async (expression: string): Promise<void> => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) { if (await evaluate<boolean>(expression)) return; await Bun.sleep(50); }
      throw new Error(`browser condition timed out: ${expression}`);
    };
    await send("Page.enable");
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__longTasks=[]; window.__journeys=[];
      new PerformanceObserver(l=>window.__longTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});
      const beacon=navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon=(url,body)=>{if(url==='/api/perf')body.text().then(t=>window.__journeys.push(...JSON.parse(t)));return beacon(url,body)};
      document.addEventListener('visibilitychange',()=>{});
    ` });
    const auth = await fx.get("/api/sessions");
    if (!auth.ok) throw new Error("scratch auth precondition failed");
    // Use the token gate through a cookie minted by the normal login route.
    const state = JSON.parse(readFileSync(join(fx.dir, "fleet.json"), "utf8")) as { token: string };
    await send("Page.navigate", { url: `${fx.base}/?token=${encodeURIComponent(state.token)}` });
    await wait("!!window.__fleetProbe && document.querySelectorAll('#slots .slot').length>=16 && !document.querySelector('#input').disabled");
    await evaluate("window.__fleetProbe.showSlot(1); window.__fleetProbe.setBoard(true)");
    await wait("window.__fleetProbe.current.perfSeedReady === true");
    await Bun.sleep(3000);
    const before = await evaluate<RebuildCounts>("window.__fleetProbe.counts()");
    await evaluate("window.__longTasks=[]");
    const firstSessions = await (await fx.get("/api/sessions")).json() as { slots: Record<string, unknown>[]; tasks: TaskInfo[] };
    const slotFacts = (slots: Record<string, unknown>[]): string => JSON.stringify(slots.map((slot) =>
      Object.fromEntries(["id", "cwd", "label", "openedAt", "lastOutput", "git", "worktree", "model", "ctx", "share", "mergePending"].map((k) => [k, slot[k]]))));
    const started = performance.now();
    console.log("IDLE started: 120 s, eight unchanged sessions, Info open, Queue closed");
    await Bun.sleep(120_000);
    const idle = await evaluate<{ counts: RebuildCounts; longTasks: number[] }>("({counts:window.__fleetProbe.counts(),longTasks:window.__longTasks})");
    const lastSessions = await (await fx.get("/api/sessions")).json() as { slots: Record<string, unknown>[]; tasks: TaskInfo[] };
    const delta = Object.fromEntries(Object.entries(idle.counts).map(([k, v]) => [k, v - before[k as keyof RebuildCounts]]));
    console.log(JSON.stringify({ idleMs: performance.now() - started, rebuilds: delta,
      longTaskSumMs: idle.longTasks.reduce((a, b) => a + b, 0), longTaskCount: idle.longTasks.length,
      unchangedTasks: JSON.stringify(firstSessions.tasks) === JSON.stringify(lastSessions.tasks),
      unchangedSlotFacts: slotFacts(firstSessions.slots) === slotFacts(lastSessions.slots),
      reference: { renderSlots: 4, renderBoard: 40 }, deviation: { renderSlots: Number(delta.renderSlots) - 4, renderBoard: Number(delta.renderBoard) - 40 } }));
    if (slotFacts(firstSessions.slots) !== slotFacts(lastSessions.slots)
      || JSON.stringify(firstSessions.tasks) !== JSON.stringify(lastSessions.tasks)) throw new Error("fixture data changed during idle");
    await evaluate("window.__fleetProbe.setBoard(false)");
    for (let i = 0; i < 10; i++) {
      await evaluate(`window.__fleetProbe.current.setView('term');window.__fleetProbe.showSlot(${i % 2 ? 1 : 2})`);
      await wait("window.__fleetProbe.current.perfSeedReady === true");
      await Bun.sleep(100);
      await evaluate("window.__fleetProbe.current.setView('chat')");
      await wait("!!document.querySelector('.pane.focused.chat .msg')");
      await evaluate("document.querySelector('#input').value='performance fixture send';document.querySelector('#input').dispatchEvent(new Event('input'));document.querySelector('#send').click()");
      await wait("!document.querySelector('#send').disabled");
      await Bun.sleep(100);
    }
    await evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");
    await Bun.sleep(100);
    const journeys = await evaluate<PerfRecord[]>("window.__journeys");
    for (const j of ["J1", "J2", "J3", "J4"]) {
      const rows = journeys.filter((r) => r.j === j);
      const values = rows.filter((r) => r.ok && r.ms !== null).map((r) => r.ms!).sort((a, b) => a - b);
      console.log(JSON.stringify({ journey: j, n: rows.length, ok: values.length, failed: rows.length - values.length,
        p75Ms: values.length ? values[Math.ceil(values.length * .75) - 1] : null, records: rows }));
      if (!values.length) throw new Error(`no successful ${j} measurement`);
    }
    await evaluate("window.__fleetProbe.setBoard(true)");
    await evaluate("window.__fleetProbe.showSlot(16);window.__fleetProbe.openQueue()");
    await Bun.sleep(1000);
    // An empty slot makes Board synchronous; all calls finish in the same task, before timers run.
    const doubled = await evaluate<Record<string, { single: number; double: number }>>(`(async()=>{const p=window.__fleetProbe;const result={};
      for(const name of ['renderSlots','renderBoard','renderQueue','renderSuiteMeter']){
        const render=()=>{if(name==='renderQueue')p.invalidateQueueList();return p[name]()};
        const a=p.counts()[name];await render();const b=p.counts()[name];
        await render();await render();const c=p.counts()[name];result[name]={single:b-a,double:c-b};
      }return result})()`);
    for (const [name, counts] of Object.entries(doubled)) {
      if (counts.single !== 1 || counts.double !== 2) throw new Error(`double rebuild proof failed for ${name}: ${JSON.stringify(counts)}`);
    }
    console.log("DOUBLE", JSON.stringify(doubled));
    console.log("PERF PROBE PASS");
  } finally { socket?.close(); browser.kill(); await browser.exited; }
}

if (import.meta.main) {
  const fx = await scratchInstance();
  try { await browserProbe(fx); } finally { await fx.stop(); }
}

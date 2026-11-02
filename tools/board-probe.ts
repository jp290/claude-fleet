// tools/board-probe.ts — how fast the board feels, measured in a real Chrome against a running Fleet
// (a test instance: `./testinstanz.sh up`). No dependency: Chrome's DevTools protocol over Bun's WebSocket.
//
//   bun tools/board-probe.ts --base http://127.0.0.1:<port> --token-file <instance>/.testinstanz.token
//        [--width 1440|390] [--runs 5] [--idle 30] [--info on|off] [--presses 6] [--shot <dir>]
//
// Per run a FRESH Chrome profile (cold cache), then:
//   open    navigation → the first sidebar row painted (the field's firstSlotMs, src/fieldperf.ts), FCP,
//           and the bytes the browser fetched until then
//   idle    --idle seconds without input: per /api route the requests, transferred bytes and the median
//           gap between two of them; the browser's work in that window (CDP Performance.getMetrics:
//           script, style, layout, layout count) divided by the number of /api/sessions polls
//   presses a real mouse press → the first DOM change after it → the paint after that (the field's click
//           measure, src/fieldperf.ts#initFieldPerf), for: switching the session in the sidebar, the info
//           toggle, the queue
// Every run prints one JSON line; the last line is the medians over the runs. `uptime` rides each run.
import { mkdtempSync, readFileSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const arg = (name: string, def?: string): string => {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  if (def === undefined) throw new Error(`--${name} is required`);
  return def;
};
const BASE = arg("base"), TOKEN = readFileSync(arg("token-file"), "utf8").trim();
const WIDTH = Number(arg("width", "1440")), RUNS = Number(arg("runs", "5")), IDLE = Number(arg("idle", "30"));
const INFO = arg("info", "on") === "on", PRESSES = Number(arg("presses", "6")), SHOT = arg("shot", "");
// --cpu 4: Chrome's CPU throttling (4 = a mid phone against this Mac); --net 4g: a mobile link
// (CDP Network.emulateNetworkConditions: 40 ms RTT, 9 Mbit/s down, 4.5 up) — the lab has neither by itself
const CPU = Number(arg("cpu", "1")), NET = arg("net", "none");
// --warm: open once and measure the SECOND open in the same profile — the bundle from the cache, as a reopen on the phone
const WARM = process.argv.includes("--warm");
const PHONE = WIDTH <= 600;
const HEIGHT = PHONE ? 844 : 900;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const median = (a: number[]): number | null => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const r1 = (n: number | null): number | null => n === null ? null : Math.round(n * 10) / 10;
const uptime = (): string => new TextDecoder().decode(Bun.spawnSync(["uptime"]).stdout).trim().replace(/.*load averages?:\s*/, "");

// the in-page half: the field's own two measures, so lab and field numbers mean the same thing
const INIT = `(() => {
  try { localStorage.setItem("fleet.board", ${INFO ? '"1"' : '"0"'}); } catch {}
  const P = window.__probe = { firstSlot: null, clicks: [], long: [] };
  const paint = (fn) => requestAnimationFrame(() => requestAnimationFrame(fn));
  const look = () => { if (document.querySelector("#slots .slot")) paint(() => { P.firstSlot = performance.now(); });
    else if (performance.now() < 60000) requestAnimationFrame(look); };
  requestAnimationFrame(look);
  document.addEventListener("click", (ev) => {
    const at = ev.timeStamp, rec = { ms: null, label: P.label || null };
    P.clicks.push(rec);
    const mo = new MutationObserver(() => { mo.disconnect(); clearTimeout(stop); paint(() => { rec.ms = performance.now() - at; }); });
    const stop = setTimeout(() => mo.disconnect(), 3000);
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  }, true);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push(e.duration); }).observe({ type: "longtask", buffered: true }); } catch {}
})();`;

class Cdp {
  private id = 0;
  private wait = new Map<number, (v: any) => void>();
  private subs: ((m: any) => void)[] = [];
  private constructor(private ws: WebSocket) {
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id && this.wait.has(m.id)) { this.wait.get(m.id)!(m); this.wait.delete(m.id); }
      else for (const s of this.subs) s(m);
    };
  }
  static open(url: string): Promise<Cdp> {
    return new Promise((ok, no) => { const ws = new WebSocket(url); ws.onopen = () => ok(new Cdp(ws)); ws.onerror = no; });
  }
  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, no) => this.wait.set(id, (m) => m.error ? no(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
  }
  on(fn: (m: any) => void): void { this.subs.push(fn); }
  close(): void { this.ws.close(); }
  async eval<T>(expression: string): Promise<T> {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`eval: ${r.exceptionDetails.text} ${expression.slice(0, 80)}`);
    return r.result.value as T;
  }
  async until(expression: string, ms = 30_000): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await this.eval<boolean>(expression).catch(() => false)) return; await Bun.sleep(25); }
    throw new Error(`timeout: ${expression}`);
  }
}

const routeOf = (url: string): string | null => {
  let p: string;
  try { p = new URL(url).pathname; } catch { return null; }
  if (!p.startsWith("/api/") && !p.startsWith("/ws/")) return null;
  return "/" + p.split("/").slice(1, 6).map((x) => /^\d+$/.test(x) ? ":n" : x).join("/");
};
const METRICS = ["ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "Nodes"];

async function oneRun(n: number): Promise<Record<string, unknown>> {
  const prof = mkdtempSync(join(tmpdir(), "board-probe-"));
  const chrome = Bun.spawn([CHROME, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${prof}`,
    "--no-first-run", "--no-default-browser-check", "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding", `--window-size=${WIDTH},${HEIGHT}`, "about:blank"], { stdout: "ignore", stderr: "ignore" });
  try {
    const portFile = join(prof, "DevToolsActivePort");
    // a loaded Mac starts Chrome slowly: wait for the file AND its port line, up to 30 s
    let port = "";
    for (let i = 0; i < 600 && !port; i++) {
      if (existsSync(portFile)) port = readFileSync(portFile, "utf8").split("\n")[0] ?? "";
      if (!port) await Bun.sleep(50);
    }
    if (!port) throw new Error("Chrome did not open its debugging port within 30 s");
    let page: { webSocketDebuggerUrl: string } | undefined;
    for (let i = 0; i < 100 && !page; i++) {
      page = ((await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as any[]).find((t) => t.type === "page");
      if (!page) await Bun.sleep(50);
    }
    const c = await Cdp.open(page!.webSocketDebuggerUrl);
    const reqs = new Map<string, { route: string | null; t: number; bytes: number; done: boolean; path: string }>();
    c.on((m) => {
      if (m.method === "Network.requestWillBeSent") reqs.set(m.params.requestId, { route: routeOf(m.params.request.url), t: m.params.timestamp, bytes: 0, done: false,
        path: (() => { try { return new URL(m.params.request.url).pathname; } catch { return "?"; } })() });
      if (m.method === "Network.loadingFinished") { const r = reqs.get(m.params.requestId); if (r) { r.bytes = m.params.encodedDataLength; r.done = true; } }
    });
    await Promise.all(["Page.enable", "Network.enable", "Runtime.enable", "Performance.enable"].map((x) => c.send(x)));
    await c.send("Network.setCacheDisabled", { cacheDisabled: false });
    await c.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: PHONE ? 3 : 2, mobile: PHONE });
    if (PHONE) await c.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await c.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    if (CPU > 1) await c.send("Emulation.setCPUThrottlingRate", { rate: CPU });
    if (NET === "4g") await c.send("Network.emulateNetworkConditions", { offline: false, latency: 40,
      downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (4.5 * 1024 * 1024) / 8 });
    // DevTools' "Slow 4G" preset: 1.6 Mbit/s down, 750 kbit/s up, 150 ms
    if (NET === "slow4g") await c.send("Network.emulateNetworkConditions", { offline: false, latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    const load = uptime();
    const nav0 = (await c.send("Runtime.evaluate", { expression: "Date.now()", returnByValue: true })).result.value as number;
    await c.send("Page.navigate", { url: `${BASE}/?token=${TOKEN}` });
    await c.until("!!window.__probe && window.__probe.firstSlot !== null");
    if (WARM) {
      await Bun.sleep(2000);
      reqs.clear();
      await c.send("Page.navigate", { url: `${BASE}/` });
      await c.until("!!window.__probe && window.__probe.firstSlot !== null && performance.now() < 30000");
    }
    const open = await c.eval<{ firstSlot: number; fcp: number | null; nodes: number }>(`({ firstSlot: window.__probe.firstSlot,
      fcp: (performance.getEntriesByName("first-contentful-paint")[0] || {}).startTime ?? null, nodes: document.getElementsByTagName("*").length })`);
    const openBytes = [...reqs.values()].filter((r) => r.done).reduce((s, r) => s + r.bytes, 0);
    // the open's biggest transfers by path, so a fat open names its own culprit
    const openTop = [...reqs.values()].filter((r) => r.done).sort((a, b) => b.bytes - a.bytes).slice(0, 4)
      .map((r) => `${r.path} ${Math.round(r.bytes / 1024)}KB`);
    void nav0;
    // let the boot's follow-up reads settle, then the idle window
    await Bun.sleep(4000);
    if (SHOT) {
      mkdirSync(SHOT, { recursive: true });
      const img = await c.send("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(SHOT, `w${WIDTH}-info${INFO ? 1 : 0}-run${n}.png`), Buffer.from(img.data, "base64"));
    }
    const metric = async (): Promise<Record<string, number>> =>
      Object.fromEntries(((await c.send("Performance.getMetrics")).metrics as { name: string; value: number }[]).filter((x) => METRICS.includes(x.name)).map((x) => [x.name, x.value]));
    const t0 = (await c.send("Runtime.evaluate", { expression: "0" }), Date.now());
    const m0 = await metric();
    const since = reqs.size;
    const mark = [...reqs.keys()];
    await c.eval("window.__probe.long = []");
    await Bun.sleep(IDLE * 1000);
    const m1 = await metric();
    const idleMs = Date.now() - t0;
    const longs = await c.eval<number[]>("window.__probe.long");
    const seen = new Set(mark);
    const win = [...reqs.entries()].filter(([k]) => !seen.has(k)).map(([, v]) => v);
    void since;
    const routes: Record<string, { n: number; kb: number; gapMs: number | null }> = {};
    for (const route of new Set(win.map((r) => r.route).filter((x): x is string => !!x))) {
      const rs = win.filter((r) => r.route === route).sort((a, b) => a.t - b.t);
      const gaps = rs.slice(1).map((r, i) => (r.t - rs[i]!.t) * 1000);
      routes[route] = { n: rs.length, kb: r1(rs.reduce((s, r) => s + r.bytes, 0) / 1024)!, gapMs: r1(median(gaps)) };
    }
    const polls = routes["/api/sessions"]?.n ?? 0;
    const per = (k: string, scale = 1000): number | null => polls ? r1(((m1[k]! - m0[k]!) * scale) / polls) : null;
    const idle = {
      seconds: Math.round(idleMs / 100) / 10, sessionsPolls: polls,
      kbPerMin: r1(win.reduce((s, r) => s + r.bytes, 0) / 1024 / (idleMs / 60_000)),
      perPoll: { scriptMs: per("ScriptDuration"), styleMs: per("RecalcStyleDuration"), layoutMs: per("LayoutDuration"),
        taskMs: per("TaskDuration"), layouts: per("LayoutCount", 1), styles: per("RecalcStyleCount", 1) },
      busyPctOfIdle: r1(((m1.TaskDuration! - m0.TaskDuration!) * 1000 / idleMs) * 100),
      longTasks: longs.length, longTaskMs: r1(longs.reduce((s, x) => s + x, 0)), nodes: m1.Nodes, routes,
    };
    // PRESSES. A real mouse press at an element's centre; the in-page listener times it.
    const press = async (label: string, selector: string): Promise<number | null> => {
      const box = await c.eval<{ x: number; y: number } | null>(`(() => { const e = ${selector}; if (!e) return null;
        e.scrollIntoView({ block: "nearest" }); const r = e.getBoundingClientRect(); if (!r.width) return null;
        const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
        // a press counts only where the control itself is under the pointer: a hidden or covered control
        // took the click on its neighbour, and the "answer" was the next unrelated poll repaint
        if (!hit || !e.contains(hit)) return null;
        window.__probe.label = ${JSON.stringify(label)}; return { x, y }; })()`);
      if (!box) { missed[label] = (missed[label] ?? 0) + 1; return null; }
      const before = await c.eval<number>("window.__probe.clicks.length");
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await c.send("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
      const end = Date.now() + 3500;
      while (Date.now() < end) {
        const ms = await c.eval<number | null | undefined>(`(window.__probe.clicks[${before}] || {}).ms`);
        if (typeof ms === "number") return ms;
        await Bun.sleep(20);
      }
      return null;
    };
    const presses: Record<string, number[]> = { session: [], island: [], fold: [], info: [], queue: [] };
    const missed: Record<string, number> = {};
    // the info column's control: its own ⓘ in its head while it is open, the focused pane's ⓘ while it is closed
    // (that one stays in the layout with visibility:hidden while the column is open)
    const TOGGLE = `document.body.classList.contains("board") ? document.getElementById("boardclose")
      : [...document.querySelectorAll(".pane.focused .boardtoggle")].find((b) => getComputedStyle(b).visibility === "visible")`;
    // two occupied rows that are not the focused one, alternately
    const ROW = (k: number) => `[...document.querySelectorAll("#slots .slot:not(.empty):not(.repohead):not(.current)")][${k}]`;
    const esc = async (): Promise<void> => {
      await c.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
      await c.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    };
    const FOLD = `document.querySelector('#boardbody .btab[data-tab="setup"] .btabbtn')`;
    for (let i = 0; PHONE && i < PRESSES; i++) {
      // the phone upright: the name pill opens the island, its Info opens the info window, and in it the same fold
      const isl = await press("island", `document.getElementById("mpill")`); if (isl !== null) presses.island!.push(isl);
      await Bun.sleep(700);
      const inf = await press("info", `document.getElementById("minfo")`); if (inf !== null) presses.info!.push(inf);
      await Bun.sleep(1200);
      for (let k = 0; k < 2; k++) {
        const f = await press("fold", FOLD); if (f !== null) presses.fold!.push(f);
        await Bun.sleep(700);
      }
      await esc(); await Bun.sleep(900);
    }
    for (let i = 0; !PHONE && i < PRESSES; i++) {
      {
        const ms = await press("session", ROW(i % 2)); if (ms !== null) presses.session!.push(ms);
        await Bun.sleep(700);
        // a fold inside the open info column ("More about this session" → Setup), opened and closed
        for (let k = 0; k < 2 && INFO; k++) {
          const f = await press("fold", FOLD);
          if (f !== null) presses.fold!.push(f);
          await Bun.sleep(700);
        }
      }
      const ms2 = await press("info", TOGGLE);
      if (ms2 !== null) presses.info!.push(ms2);
      await Bun.sleep(700);
      const ms3 = await press("info", TOGGLE);
      if (ms3 !== null) presses.info!.push(ms3);
      await Bun.sleep(700);
      const q = await press("queue", `document.getElementById("queuebtn")`);
      if (q !== null) presses.queue!.push(q);
      await Bun.sleep(500);
      await esc();
      await Bun.sleep(500);
    }
    c.close();
    return { run: n, width: WIDTH, info: INFO, cpu: CPU, net: NET, warm: WARM, load,
      open: { firstSlotMs: r1(open.firstSlot), fcpMs: r1(open.fcp), kb: r1(openBytes / 1024), nodes: open.nodes, top: openTop },
      idle, missed, presses: Object.fromEntries(Object.entries(presses).map(([k, v]) => [k, { n: v.length, medianMs: r1(median(v)), values: v.map((x) => Math.round(x)) }])) };
  } finally {
    chrome.kill(); await chrome.exited;
    rmSync(prof, { recursive: true, force: true });
  }
}

const runs: any[] = [];
for (let i = 1; i <= RUNS; i++) {
  const r = await oneRun(i);
  runs.push(r);
  console.log(JSON.stringify(r));
}
const med = (f: (r: any) => number | null | undefined): number | null => r1(median(runs.map(f).filter((x): x is number => typeof x === "number")));
const routeNames = [...new Set(runs.flatMap((r) => Object.keys(r.idle.routes)))];
console.log(JSON.stringify({ summary: true, width: WIDTH, info: INFO, cpu: CPU, net: NET, warm: WARM, runs: RUNS, idleSeconds: IDLE, loads: runs.map((r) => r.load),
  firstSlotMs: med((r) => r.open.firstSlotMs), fcpMs: med((r) => r.open.fcpMs), openKb: med((r) => r.open.kb),
  idleKbPerMin: med((r) => r.idle.kbPerMin), busyPctOfIdle: med((r) => r.idle.busyPctOfIdle), nodes: med((r) => r.idle.nodes),
  perPoll: Object.fromEntries(["scriptMs", "styleMs", "layoutMs", "taskMs", "layouts", "styles"].map((k) => [k, med((r) => r.idle.perPoll[k])])),
  longTasksPerMin: med((r) => r.idle.longTasks / (r.idle.seconds / 60)),
  routes: Object.fromEntries(routeNames.map((k) => [k, { perMin: med((r) => r.idle.routes[k] ? r.idle.routes[k].n / (r.idle.seconds / 60) : 0),
    kbPerMin: med((r) => r.idle.routes[k] ? r.idle.routes[k].kb / (r.idle.seconds / 60) : 0), gapMs: med((r) => r.idle.routes[k]?.gapMs) }])),
  presses: Object.fromEntries(["session", "island", "fold", "info", "queue"].map((k) => [k, { medianMs: r1(median(runs.flatMap((r) => r.presses[k].values))),
    p90Ms: (() => { const v = runs.flatMap((r) => r.presses[k].values).sort((a: number, b: number) => a - b); return v.length ? v[Math.min(v.length - 1, Math.ceil(0.9 * v.length) - 1)] : null; })(),
    n: runs.reduce((s, r) => s + r.presses[k].n, 0) }])) }));

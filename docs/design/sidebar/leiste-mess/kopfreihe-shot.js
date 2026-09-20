// Photograph the head row's three Fassungen — and PROVE the hash switch works without a reload.
//
// The predecessor's switch was a module-level const, so changing `#head=a` to `#head=c` on an
// open page changed nothing and three "different" pictures were the same one. This driver is
// therefore written the way the trap would be caught: it loads ONCE and then only sets
// `location.hash`, so a picture that differs is proof the listener fires. `--reload` repeats the
// same series with a full load per Fassung, as the control.
//
//   bun kopfreihe-shot.js <board-url> <out-base> [--reload]
//
// It brings its own Chrome (own user-data-dir, own port from $CDP_PORT, default 9222). If a
// Chrome already answers on that port it EXITS — cdp-shot.js's oldest trap is taking a foreign
// page target and reporting "done".
const [url, outBase, ...flags] = process.argv.slice(2);
const reload = flags.includes("--reload");
const port = Number(process.env.CDP_PORT ?? 9222);
const dbg = `http://127.0.0.1:${port}`;
if (await fetch(`${dbg}/json`).then(() => true).catch(() => false)) {
  console.error(`a Chrome already answers on ${port} — refusing to measure someone else's page`);
  process.exit(2);
}
const profile = `/tmp/fleet-kopfreihe-chrome-${process.pid}`;
const chrome = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--no-first-run", "about:blank"], { stdout: "ignore", stderr: "ignore" });

let targets = [];
for (let i = 0; i < 60 && !targets.some((t) => t.type === "page"); i++) {
  targets = await fetch(`${dbg}/json`).then((r) => r.json()).catch(() => []);
  if (!targets.some((t) => t.type === "page")) await Bun.sleep(500);
}
const page = targets.find((t) => t.type === "page");
if (!page) { console.error("no page target"); chrome.kill(); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
};
const send = (method, params = {}) =>
  new Promise((res) => { const n = ++id; pending.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }))?.result?.value;

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1000, height: 950, deviceScaleFactor: 2, mobile: false });
await send("Page.navigate", { url });
await Bun.sleep(5000);
// a browser that has never been told anything: the stacks come up at their product default
await evaluate(`localStorage.removeItem("fleet.stacks"); localStorage.removeItem("fleet.stacks.closed"); 1`);
await send("Page.reload");
await Bun.sleep(6000);

// What the row actually says, read out of the DOM — a picture alone cannot tell a wrapped row
// from a folded one, and it cannot tell an icon from an emoji at all.
const readRow = `(() => {
  const t = document.getElementById("sidetools");
  const btn = (b) => ({ id: b.id, hidden: getComputedStyle(b).display === "none",
    text: (b.textContent || "").trim(), svg: !!b.querySelector("svg"),
    word: b.querySelector(".trlabel")?.textContent ?? null, w: Math.round(b.getBoundingClientRect().width) });
  const panel = document.getElementById("morepanel");
  return JSON.stringify({ cls: t.className, rowH: Math.round(t.getBoundingClientRect().height),
    row: [...t.querySelectorAll("button")].map(btn),
    folded: [...panel.querySelectorAll("button.hmoved")].map(btn) });
})()`;

for (const v of ["a", "b", "c", "none"]) {
  const hash = v === "none" ? "#head=" : `#head=${v}`;
  if (reload) { await send("Page.navigate", { url: url + hash }); await Bun.sleep(5000); }
  else { await evaluate(`location.hash = ${JSON.stringify(hash)}; 1`); await Bun.sleep(800); }
  const state = JSON.parse(await evaluate(readRow));
  console.log(`${v}\t${JSON.stringify(state)}`);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await Bun.write(`${outBase}-head-${v}${reload ? "-reload" : ""}.png`, Buffer.from(shot.data, "base64"));
}
// the band switch had the same trap and the same fix — one picture per Fassung, no reload
for (const v of ["a", "b", "c"]) {
  await evaluate(`location.hash = "#band=${v}"; 1`);
  await Bun.sleep(800);
  // IN THE DOM IS NOT ON THE SCREEN: fassung B writes into `.r2`, and an unfocused lane has no
  // second line (Schnitt 6), so its reading exists and is invisible. Counted both ways on
  // purpose — the difference IS the finding.
  const drawn = await evaluate(`(() => {
    const seen = (sel) => [...document.querySelectorAll(sel)];
    const vis = (e) => e.offsetParent !== null;
    const onLane = (e) => !!e.closest(".slot.lane");
    const count = (sel) => ({ dom: seen(sel).length, visible: seen(sel).filter(vis).length,
      onLaneVisible: seen(sel).filter((e) => onLane(e) && vis(e)).length });
    return JSON.stringify({ succ: count(".succ"), band: count(".succband"), chip: count(".succhip") });
  })()`);
  console.log(`band=${v}\t${drawn}`);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await Bun.write(`${outBase}-band-${v}.png`, Buffer.from(shot.data, "base64"));
}
ws.close();
chrome.kill();

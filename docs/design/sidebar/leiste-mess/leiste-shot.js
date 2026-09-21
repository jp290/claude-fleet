// Photograph the bar of a RUNNING instance at 900 and 1200 px, once per hash — and write down, per
// row, what that row actually paints. Unlike instanz-shot.sh it stages nothing and takes no suite
// mutex: it is pointed at a standing instance (./testinstanz.sh), so a before/after pair is two
// instances with the SAME fixtures and two different clients.
//
//   bun leiste-shot.js <board-url> <out-base> [hash ...]      e.g.  "" "#band=a" "#band=b"
//
// Every picture is a FRESH load (navigate, not a hash change), so it cannot be the stale-Fassung
// trap of 2026-09-20. It brings its own Chrome on $CDP_PORT (default 9224) and refuses to run when
// something already answers there — cdp-shot.js's trap of photographing a foreign page.
const [url, outBase, ...hashes] = process.argv.slice(2);
const port = Number(process.env.CDP_PORT ?? 9224);
const dbg = `http://127.0.0.1:${port}`;
if (await fetch(`${dbg}/json`).then(() => true).catch(() => false)) {
  console.error(`a Chrome already answers on ${port} — refusing to measure someone else's page`);
  process.exit(2);
}
const chrome = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/fleet-leiste-shot-${process.pid}`,
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

// per row: the address, the label, and every VISIBLE element of the row other than those two —
// by class and text — plus the row's height. This is the "which row shows what" list, read off the
// page instead of written from memory.
const readRows = `JSON.stringify([...document.querySelectorAll("#slots .slot")].map((r) => {
  const vis = (e) => e.offsetParent !== null && getComputedStyle(e).visibility !== "hidden";
  const addr = r.querySelector(".n, .laneref");
  const shown = [...r.querySelectorAll(".r1 > *, .r2 > *, .succband > *")].filter(vis)
    .filter((e) => !e.matches(".n, .laneref, .lbl, .mark"))
    .map((e) => e.className + (e.textContent.trim() ? "=" + e.textContent.trim() : ""));
  return { slot: r.dataset.slot ?? null, addr: addr?.textContent ?? null,
    label: r.querySelector(".lbl")?.textContent ?? null, h: Math.round(r.getBoundingClientRect().height), shown };
}))`;

await send("Page.enable");
for (const hash of hashes.length ? hashes : [""]) {
  for (const w of [900, 1200]) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 2, mobile: false });
    await send("Page.navigate", { url: "about:blank" });
    await Bun.sleep(300);
    await send("Page.navigate", { url: url + hash });
    await Bun.sleep(6000);
    const tag = hash.replace(/^#/, "").replace(/[^a-z0-9=]/gi, "_").replace(/=/g, "-") || "plain";
    const shot = await send("Page.captureScreenshot", { format: "png" });
    await Bun.write(`${outBase}-${tag}-${w}.png`, Buffer.from(shot.data, "base64"));
    if (w === 900) await Bun.write(`${outBase}-${tag}-rows.json`, await evaluate(readRows));
    console.log(`wrote ${outBase}-${tag}-${w}.png`);
  }
}
ws.close();
chrome.kill();

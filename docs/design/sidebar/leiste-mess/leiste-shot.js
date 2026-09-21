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

// THE CODEX SENTENCE, measured: is any of it hidden — by its own box (scrollWidth past clientWidth,
// a clipped height) or by the hover strip's solid surface lying over it? Read once at rest and once
// with the pointer on that row, which is the state the owner's screenshot caught.
const readCut = `JSON.stringify([...document.querySelectorAll("#slots .slot .needline")].map((n) => {
  const row = n.closest(".slot"), act = row.querySelector(".slotact");
  const a = act && getComputedStyle(act).display !== "none" ? act.getBoundingClientRect() : null;
  const r = n.getBoundingClientRect();
  const covered = !!a && a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top;
  return { slot: row.dataset.slot, text: n.textContent, clipped: n.scrollWidth > n.clientWidth + 1
    || n.scrollHeight > n.clientHeight + 1, coveredByHoverStrip: covered, h: Math.round(r.height) };
}))`;
// A native tooltip is not painted into a headless screenshot, so what a hover SAYS is read from the
// title attributes: every chain mark (#band=d) and every succession reading of A–C.
const readTitles = `JSON.stringify([...document.querySelectorAll("#slots .slot")].flatMap((r) =>
  [...r.querySelectorAll(".sm, .succ, .succhip")].map((m) => ({ slot: r.dataset.slot, cls: m.className, title: m.title }))))`;
const hoverRow = async (slot) => {
  const box = await evaluate(`(() => { const r = document.querySelector('#slots .slot[data-slot="${slot}"]');
    if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + 12 }; })()`);
  if (!box) return false;
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
  await Bun.sleep(400);
  return true;
};
const HOVER_ROWS = (process.env.HOVER_ROWS ?? "9,5").split(",").filter(Boolean);

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
    const cut = { rest: JSON.parse(await evaluate(readCut)) };
    if (w === 900) await Bun.write(`${outBase}-${tag}-rows.json`, await evaluate(readRows));
    if (w === 900) await Bun.write(`${outBase}-${tag}-titles.json`, await evaluate(readTitles));
    console.log(`wrote ${outBase}-${tag}-${w}.png`);
    for (const slot of HOVER_ROWS) {
      if (!(await hoverRow(slot))) { console.log(`no row ${slot} — no hover shot`); continue; }
      const hs = await send("Page.captureScreenshot", { format: "png" });
      await Bun.write(`${outBase}-${tag}-hover${slot}-${w}.png`, Buffer.from(hs.data, "base64"));
      cut[`hover${slot}`] = JSON.parse(await evaluate(readCut));
      console.log(`wrote ${outBase}-${tag}-hover${slot}-${w}.png`);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: w - 5, y: 5 });
    await Bun.write(`${outBase}-${tag}-cut-${w}.json`, JSON.stringify(cut, null, 1));
  }
}
ws.close();
chrome.kill();

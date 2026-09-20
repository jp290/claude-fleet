// Drive headless Chrome over CDP: load the board, unfold every stack, screenshot at two widths.
// A plain --screenshot cannot do the middle step, and the lane rows are the thing under test.
const [url, repo, outBase] = process.argv.slice(2);
const dbg = "http://127.0.0.1:9222";
let targets = [];
for (let i = 0; i < 60 && !targets.some((t) => t.type === "page"); i++) {
  targets = await fetch(`${dbg}/json`).then((r) => r.json()).catch(() => []);
  if (!targets.some((t) => t.type === "page")) await Bun.sleep(500);
}
const page = targets.find((t) => t.type === "page");
if (!page) { console.error("no page target"); process.exit(1); }
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
const evaluate = (expression) => send("Runtime.evaluate", { expression, awaitPromise: true });

await send("Page.enable");
await send("Page.navigate", { url });
await Bun.sleep(4000);
// The stack used to be seeded open through localStorage here, because the store held the OPEN
// stacks and a fresh browser therefore hid every lane. Since the store holds the CLOSED ones
// (src/client.ts, "DEFAULT IS OPEN"), seeding would measure the seed instead of the product — so
// the store is CLEARED and the picture shows what a browser that has never been told anything
// shows. `repo` stays in the signature: it is what a caller would fold, if a shot ever needs to.
await evaluate(`localStorage.removeItem("fleet.stacks"); localStorage.removeItem("fleet.stacks.closed"); ${JSON.stringify(repo)}`);
await send("Page.reload");
await Bun.sleep(6000);
for (const w of [900, 1200]) {
  await send("Emulation.setDeviceMetricsOverride",
    { width: w, height: 900, deviceScaleFactor: 2, mobile: false });
  await Bun.sleep(1500);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  await Bun.write(`${outBase}-${w}.png`, Buffer.from(shot.data, "base64"));
  console.log(`wrote ${outBase}-${w}.png`);
}
ws.close();

// Nachweis, dass prefers-reduced-motion ALLES anhaelt: zweimal denselben Baum fahren, einmal
// normal, einmal mit --force-prefers-reduced-motion, und je zwei Bilder im Abstand von 2 s
// vergleichen. Normal MUSS sich etwas bewegen, reduziert DARF sich nichts bewegen.
const url = process.argv[2], reduce = process.argv[3] === "reduce";
const PORT = reduce ? 9401 : 9400;
const args = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1100,1400",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/red-${PORT}`];
if (reduce) args.push("--force-prefers-reduced-motion");
args.push(url);
const proc = Bun.spawn(args, { stdout: "ignore", stderr: "ignore" });
async function target() {
  for (let i = 0; i < 60; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = j.find((t: any) => t.type === "page" && t.url.includes("marken"));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await Bun.sleep(250);
  }
  throw new Error("kein Ziel");
}
const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const call = (method: string, params: any = {}) => new Promise<any>((res) => {
  const my = ++id;
  const on = (e: MessageEvent) => { const m = JSON.parse(String(e.data));
    if (m.id === my) { ws.removeEventListener("message", on); res(m.result); } };
  ws.addEventListener("message", on);
  ws.send(JSON.stringify({ id: my, method, params }));
});
const shot = async () => (await call("Page.captureScreenshot", { format: "png" })).data as string;
await Bun.sleep(2500);
const a = await shot(); await Bun.sleep(2000); const b = await shot();
await Bun.write(`${process.env.S}/shots/red-${reduce ? "on" : "off"}-1.png`, Buffer.from(a, "base64"));
await Bun.write(`${process.env.S}/shots/red-${reduce ? "on" : "off"}-2.png`, Buffer.from(b, "base64"));
console.log(`${reduce ? "reduziert" : "normal   "}: identische Bytes = ${a === b}`);
ws.close(); proc.kill();

// Wie viel BEWEGT sich ein System in einem Zustand? Zwei Bilder im Abstand von 1,5 s aus der
// laufenden Seite, je Spalte verglichen. Das ist die Zahl hinter "der Zustand moduliert das
// laufende System": ruhend muss 0 sein, arbeitend deutlich, schlafend wenig aber nicht 0.
const url = process.argv[2], PORT = 9500;
const proc = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1100,1400",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/bew-${PORT}`, url],
  { stdout: "ignore", stderr: "ignore" });
async function target() {
  for (let i = 0; i < 80; i++) {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const p = j.find((t: any) => t.type === "page" && t.url.includes("marken"));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await Bun.sleep(250);
  } throw new Error("kein Ziel");
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
const shot = async () => (await call("Page.captureScreenshot", { format: "png" })).data;
await Bun.sleep(2000);
for (const [knopf, name] of [["b16", "arbeitet"], ["bruhe", "ruht"], ["bschlaf", "schlaeft"], ["bfehler", "gestoert"]]) {
  await call("Runtime.evaluate", { expression: `document.getElementById('${knopf}').click()` });
  await Bun.sleep(1800);
  const a = await shot(); await Bun.sleep(1500); const b = await shot();
  await Bun.write(`${process.env.S}/shots/bew-${name}-1.png`, Buffer.from(a, "base64"));
  await Bun.write(`${process.env.S}/shots/bew-${name}-2.png`, Buffer.from(b, "base64"));
  console.log(name);
}
ws.close(); proc.kill();

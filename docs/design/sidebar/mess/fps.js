// Teil von docs/design/sidebar/mess/ — siehe README.md dort.
// Echte Bilder je Sekunde: Chrome mit Compositor starten, ueber das DevTools-Protokoll vier
// Sekunden WARTEN (echte Zeit, keine virtuelle) und dann den Zaehler der Seite auslesen.
// Headless ohne Compositor liefert 0 — das ist kein Messwert, sondern eine nicht gelaufene Schleife.
const PORT = 9333 + (Number(process.env.OFF ?? 0) | 0);
const url = process.argv[2];
const proc = Bun.spawn(["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1100,1400",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/fps-chrome-${PORT}`, url],
  { stdout: "ignore", stderr: "ignore" });

async function targets() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json`); const j = await r.json();
      const p = j.find((t) => t.type === "page" && t.url.includes("marken"));
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch {}
    await Bun.sleep(250);
  }
  throw new Error("kein Chrome-Ziel erreichbar");
}
const ws = new WebSocket(await targets());
await new Promise((r) => (ws.onopen = r));
let id = 0;
const evalIn = (expr) => new Promise((res) => {
  const my = ++id;
  const on = (e) => { const m = JSON.parse(String(e.data));
    if (m.id === my) { ws.removeEventListener("message", on); res(m.result?.result?.value); } };
  ws.addEventListener("message", on);
  ws.send(JSON.stringify({ id: my, method: "Runtime.evaluate",
    params: { expression: expr, awaitPromise: true, returnByValue: true } }));
});

await Bun.sleep(2500);                       // laufen lassen
console.log("--- echter Betrieb (9 laufende Marken je Spalte) ---");
console.log(await evalIn(`[...document.querySelectorAll('.messe')].map(e=>e.textContent).join(' | ')`));
console.log(await evalIn(`JSON.stringify(window.__bench())`));
await evalIn(`document.getElementById('b16').click()`);
await Bun.sleep(4000);                       // Messfall: alle 16 Plaetze arbeiten
console.log("--- Messfall: alle Plaetze arbeiten ---");
console.log(await evalIn(`[...document.querySelectorAll('.messe')].map(e=>e.textContent).join(' | ')`));
console.log(await evalIn(`JSON.stringify(window.__bench())`));
ws.close(); proc.kill();

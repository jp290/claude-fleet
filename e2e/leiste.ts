// THE LEFT BAR IN A REAL BROWSER (auftraege/leiste-aufraeumen.md; Owner 18.10. Z130, Mangel 126): the views square, the rows'
// size, the band under a real mouse and a real finger, 16 sessions without a scrollbar, and the highlight that follows the slot
// on screen. Owner words: „[Zitat entfernt]“, „[Zitat entfernt]“, „[Zitat entfernt]“
// , „[Zitat entfernt]“, „[Zitat entfernt]“
// .
// The real client bundle behind a fixture origin (as e2e/uebergabe.ts): 14 sessions and two lanes of slot 1, bands on slots 2
// and 3, or four sessions and twelve free places. The pointer goes through CDP Input (mouse and touch), never through
// dispatchEvent, so capture, buttons and pointer ids are the browser's own. Every claim has a MUTANT in LEISTE_MUTANTS that edits
// the bundle or the page and must turn exactly that claim red; a needle that left the source throws. Driven by e2e/dom.ts.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

export interface LeisteDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
export interface LeisteMutant { name: string; claim: string; file: "src/client.ts" | "src/board.ts" | "public/index.html";
  edits: readonly (readonly [string, string])[]; width?: Width }

export const LEISTE_CLAIM = {
  knoepfe: "the four views stand as two rows of two 23px squares, level with the two function rows; on the phone they are gone",
  zeilen: "a session row is at most 32px, a lane 28 and a free place 26, and the mark, the address, the name and the state sit whole inside it",
  zug: "one stroke goes one session: 200px with the mouse held, or a finger across two rows; after the release a move without a button moves nothing",
  passt: "16 sessions fit the bar without a scrollbar, and nothing runs over sideways",
  menue: "on a touch screen a row's actions wait behind ⋯ on line 1, as tall as the row: no ✕ on the rows, and ⋯ opens them, ✕ last, at the foot of the bar",
  markierung: "the highlight follows the slot on screen and in the composer through every door: a stroke and a second finger on a band, a click in the bar, a click and a tap on the other pane, Enter on a row, layout 1 and 2",
  fenster: "the bar and the info column keep one size on the screen at any browser zoom (1470 pt window at 100, 80 and 67 %): the bar 200–260 pt, Info 250–300 pt, and the conversation between them keeps its width",
  info: "with the info column open, Oberfläche 16 leaves the conversation's text column as wide as Oberfläche 11 does (branch/layout, 22.10.)",
  namen: "on a 1440 laptop the fullest row (a two-digit place, ⎇+ or „Frage“, a two-digit context) leaves the name 9.25em, as wide as „Import-Klassifizierer“ in the Mac's system font, and the bar keeps its width when the info column opens; in the phone's drawer the same row leaves the same (branch/layout, 22.10.)",
} as const;

type Width = 1440 | 1024 | 820 | 390;
const VIEWS: readonly { width: Width; height: number; touch: boolean; phone: boolean }[] = [
  { width: 1440, height: 900, touch: false, phone: false },
  { width: 1024, height: 768, touch: true, phone: false },
  { width: 820, height: 1180, touch: true, phone: false },
  { width: 390, height: 844, touch: true, phone: true },
];

export const LEISTE_MUTANTS: readonly LeisteMutant[] = [
  { name: "the views square lies in one row again", claim: LEISTE_CLAIM.knoepfe, file: "public/index.html",
    edits: [["  #sidetools #layouts.tabrow { padding: 0;", "  #sidetools #layouts.tabrow { display: flex; align-items: center; padding: 0;"]] },
  { name: "the views show in the phone drawer again", claim: LEISTE_CLAIM.knoepfe, file: "public/index.html", width: 390,
    edits: [["  #sidetools #layouts.tabrow { padding: 0;", "  #sidetools #layouts.tabrow { display: flex; align-items: center; padding: 0;"]] },
  { name: "a row gets its 6px of air back", claim: LEISTE_CLAIM.zeilen, file: "public/index.html",
    edits: [[`display: block; padding: 2px 8px 2px 6px;\n    border-radius: 12px;`, `display: block; padding: 6px 8px 6px 6px;\n    border-radius: 12px;`]] },
  { name: "line 1 is cut to 12px", claim: LEISTE_CLAIM.zeilen, file: "public/index.html",
    edits: [["  .slot .r1 { display: flex; align-items: center; gap: 4px; min-width: 0; min-height: 26px; }",
      "  .slot .r1 { display: flex; align-items: center; gap: 4px; min-width: 0; min-height: 0; height: 12px; overflow: hidden; }"]] },
  { name: "the mouse steps on while the button is down", claim: LEISTE_CLAIM.zug, file: "src/client.ts",
    edits: [["    if (!g || g.stepped) return;", "    if (!g) return;"]] },
  { name: "a release the band did not hear leaves the row on the mouse", claim: LEISTE_CLAIM.zug, file: "src/client.ts",
    edits: [["    if (g.mouse && e.buttons === 0) {", "    if (false) {"],
      ["    const was = g;\n    g = null;\n    if (!was.dir)", "    const was = g;\n    if (!was.dir)"]] },
  { name: "a finger counts whole rows again", claim: LEISTE_CLAIM.zug, file: "src/client.ts",
    edits: [["d > 0) ? 0 : W;", "d > 0) ? 0 : Infinity;"], ["? (d > 0 ? -1 : 1) : 0;", "? -Math.round(d / W) || (d > 0 ? -1 : 1) : 0;"]] },
  { name: "a row gets its air back (tablet)", claim: LEISTE_CLAIM.passt, file: "public/index.html", width: 1024,
    edits: [[`display: block; padding: 2px 8px 2px 6px;\n    border-radius: 12px;`, `display: block; padding: 14px 8px 14px 6px;\n    border-radius: 12px;`]] },
  { name: "a name no longer gives way", claim: LEISTE_CLAIM.passt, file: "public/index.html",
    edits: [["  .slot .lbl { flex: 1; min-width: 0;", "  .slot .lbl { flex: 1; min-width: 260px;"]] },
  { name: "the info column takes Oberfläche's whole ratio, whatever the conversation needs", claim: LEISTE_CLAIM.info, file: "src/board.ts", width: 1024,
    edits: [["Math.min(want, (base + room) / BOARD_W)", "want"]] },
  { name: "the bar is 250px again, as the owner's workhorse board drew it", claim: LEISTE_CLAIM.namen, file: "public/index.html",
    edits: [["#side { width: 288px; zoom: var(--rail-scale, 1);", "#side { width: 250px; zoom: var(--rail-scale, 1);"]] },
  { name: "the bar gives way when the info column opens", claim: LEISTE_CLAIM.namen, file: "public/index.html",
    edits: [["#side { width: 288px; zoom: var(--rail-scale, 1);", "body.board #side { width: 250px; } #side { width: 288px; zoom: var(--rail-scale, 1);"]] },
  { name: "the bar holds its px whatever the browser zoom does", claim: LEISTE_CLAIM.fenster, file: "public/index.html", width: 1440,
    edits: [["#side { width: 288px; zoom: var(--rail-scale, 1);", "#side { width: 288px;"]] },
  { name: "the info column holds its px whatever the browser zoom does", claim: LEISTE_CLAIM.fenster, file: "public/index.html", width: 1440,
    edits: [["width: calc(336px * var(--board-scale, var(--rail-scale, 1)));", "width: 336px;"]] },
  { name: "„Frage“ is mono again, 4px off its glyph", claim: LEISTE_CLAIM.namen, file: "public/index.html",
    edits: [["  .slot .frage { flex: none; font: 500 11px var(--chat-sans);", "  .slot .frage { flex: none; margin-right: 4px; font: 500 11px var(--chat-mono);"]] },
  { name: "⎇+ stays beside „Frage“", claim: LEISTE_CLAIM.namen, file: "public/index.html",
    edits: [["  .slot .r1:has(.frage) .quicklane { display: none; }", ""]] },
  { name: "the phone's drawer is 300px again", claim: LEISTE_CLAIM.namen, file: "public/index.html", width: 390,
    edits: [["      width: min(86vw, 330px); border-right: 1px solid var(--line);", "      width: min(80vw, 300px); border-right: 1px solid var(--line);"]] },
  { name: "the band counts a stroke in screen px, not in the bar's own", claim: LEISTE_CLAIM.zug, file: "src/client.ts", width: 1440,
    edits: [["const bx = (e: PointerEvent): number => e.clientX / Z;", "const bx = (e: PointerEvent): number => e.clientX;"]] },
  { name: "✕ stands on every touch row again", claim: LEISTE_CLAIM.menue, file: "public/index.html", width: 1024,
    edits: [["    .slotact .kill { display: none; }\n    .rowmore { display: flex; flex: none;", "    .rowmore { display: flex; flex: none;"]] },
  { name: "⋯ shrinks to its icon", claim: LEISTE_CLAIM.menue, file: "public/index.html", width: 1024,
    edits: [["background: none;\n      align-self: stretch; }", "background: none; }"]] },
  { name: "the touch row menu spans the whole screen", claim: LEISTE_CLAIM.menue, file: "public/index.html", width: 1024,
    edits: [["    #side { position: relative; }\n", ""]] },
  { name: "the hold is never given back", claim: LEISTE_CLAIM.markierung, file: "src/client.ts",
    edits: [['  view.addEventListener("lostpointercapture", (e) => {', '  view.addEventListener("lostpointercapture-gone", (e) => {']] },
  { name: "a click on the other pane no longer focuses it", claim: LEISTE_CLAIM.markierung, file: "src/client.ts",
    edits: [['    this.root.addEventListener("mousedown", () => focusPane(this.index));', '    this.root.addEventListener("mousedown-gone", () => focusPane(this.index));']] },
];

type State = "voll" | "frei";
const LABELS = ["Bauleitung Ausbau", "Einstellungen (K16)", "Funktions-Durchgang", "Nachfolge ohne Verlust", "Neue-Session-Ansicht (Entwurf)",
  "Prüfung Nachfolge kalt", "Rezeptsammlung", "Leiste aufräumen", "Orchestrator", "Shell", "Sol", "steward", "Gespräch morgen", "Messung Kontext"];
const SHORT = 10; // „Shell“: a name that has room must show whole
const ASKED = 12; // stands at Claude Code's permission question
// the name boxes of the two fullest rows, in ems of their own font: slot 13 (two digits, ⎇+, a two-digit context) and
// slot 12, which waits on Claude Code's permission question (two digits, a two-digit context, „Frage“, where ⎇+ yields)
const NAME_ROW = `const box = (n) => { const row = document.querySelector('#slots .slot[data-slot="' + n + '"] .r1'), l = row?.querySelector('.lbl');
    return { row, em: l ? Math.round(l.clientWidth / parseFloat(getComputedStyle(l).fontSize) * 100) / 100 : 0,
      two: /^\\d\\d%$/.test(row?.querySelector('.ctxfill')?.textContent ?? '') }; };
  const plain = box(13), asked = box(12);
  const em = Math.min(plain.em, asked.em);
  const ok = plain.two && asked.two && !!plain.row?.querySelector('.quicklane') && !!asked.row?.querySelector('.frage')
    && !asked.row?.querySelector('.quicklane')?.getClientRects().length;`;
const MIN = 60_000;

export async function runLeisteDom(sourceRoot: string, artifacts?: string,
  only: { widths?: readonly Width[]; mutate?: LeisteMutant } = {}): Promise<LeisteDomResult[]> {
  // ONE BROWSER PER KIND OF HAND: the hover and pointer media are the process's (the Linux helper's headless Chromium says
  // hover: none for every page, e2e/role-address.ts), so the desktop runs with a mouse's and the tablets and the phone with a
  // finger's, on every machine; the page checks it took
  const views = VIEWS.filter((x) => !only.widths || only.widths.includes(x.width));
  if (views.some((x) => x.touch) && views.some((x) => !x.touch)) {
    const out: LeisteDomResult[] = [];
    for (const touch of [false, true])
      out.push(...await runLeisteDom(sourceRoot, artifacts, { ...only, widths: views.filter((x) => x.touch === touch).map((x) => x.width) }));
    return out;
  }
  const finger = views[0]?.touch ?? false;
  const hand = finger ? "--blink-settings=primaryHoverType=1,availableHoverTypes=1,primaryPointerType=2,availablePointerTypes=2"
    : "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
  const scratch = resolve(tmpdir(), `fleet-leiste-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const mutant = only.mutate;
  const apply = (source: string): string => {
    let out = source;
    for (const [needle, by] of mutant?.edits ?? []) {
      if (!out.includes(needle)) throw new Error(`leiste mutant: needle not in ${mutant?.file}: ${needle.slice(0, 80)}`);
      out = out.replace(needle, by);
    }
    return out;
  };
  const clientPath = resolve(sourceRoot, "src/client.ts");
  const mutantPath = mutant && mutant.file !== "public/index.html" ? resolve(sourceRoot, mutant.file) : null;
  let built: Awaited<ReturnType<typeof Bun.build>>;
  let indexHtml: string;
  try {
    built = await Bun.build({ entrypoints: [clientPath], target: "browser",
      plugins: mutantPath ? [{ name: "leiste-mutant", setup(build) {
        build.onLoad({ filter: /\.ts$/ }, ({ path }) => path === mutantPath
          ? { contents: apply(readFileSync(path, "utf8")), loader: "ts" } : undefined);
      } }] : [] });
    if (!built.success) throw new Error(built.logs.join("\n"));
    indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
    if (mutant?.file === "public/index.html") indexHtml = apply(indexHtml);
  } catch (error) {
    rmSync(scratch, { recursive: true, force: true });
    throw error;
  }
  const appJs = await built.outputs[0]!.text();

  let now = Date.now();
  const fx = { st: "voll" as State };
  const SUCC: Record<number, number> = { 2: 4, 3: 2, 16: 2 };
  const slots = () => Array.from({ length: 16 }, (_, i) => {
    const id = i + 1;
    const lane = fx.st === "voll" && id >= 15;
    if (fx.st === "frei" && id > 4) return { id, cwd: null, label: null, lastOutput: 0 };
    const base = { id, label: lane ? `Lane ${id}` : LABELS[i], openedAt: 1000 + id, lastOutput: now - id * MIN,
      model: "claude-opus-5-5[1m]", ctx: { usedTokens: id * 20_000, windowTokens: 1_000_000, pct: id * 2 },
      ...(SUCC[id] ? { succession: { session: SUCC[id] } } : {}),
      ...(fx.st === "voll" && id === ASKED ? { rueckfrage: "Bash command · Do you want to proceed?" } : {}) };
    return lane
      ? { ...base, cwd: `/fixture/r1.worktrees/l${id}`, worktree: { repo: "/fixture/r1", branch: `lane/l${id}`, anchor: { slot: 1, openedAt: 1001 } },
        git: { branch: `lane/l${id}`, dirty: 0, ahead: 1, behind: 0 } }
      : { ...base, cwd: `/fixture/r${id}`, repo: `/fixture/r${id}`, git: { branch: "main", dirty: 0, ahead: 0, behind: 0 } };
  });
  const past = (id: number) => Array.from({ length: (SUCC[id] ?? 1) - 1 }, (_, k) => ({ session: k + 1,
    startedAt: now - (SUCC[id]! - k) * 60 * MIN, handedAt: now - (SUCC[id]! - k - 1) * 60 * MIN, report: null, ctx: null }));

  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("leiste DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--password-store=basic", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", hand, `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
  let socket: WebSocket | undefined;
  try {
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let startupLog = "";
    const endpoint = await Promise.race([
      (async () => { for await (const chunk of browser.stderr) { startupLog += new TextDecoder().decode(chunk); const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(startupLog); if (m) return m[1]; } throw new Error("browser exited before CDP endpoint: " + startupLog); })(),
      new Promise<never>((_, reject) => { startupTimer = setTimeout(() => reject(new Error("browser CDP startup timeout: " + startupLog)), 45000); }),
    ]).finally(() => clearTimeout(startupTimer));
    socket = new WebSocket(String(endpoint));
    await new Promise<void>((ok, bad) => { socket!.onopen = () => ok(); socket!.onerror = () => bad(new Error("CDP connection failed")); });
    let serial = 0, sessionId: string | undefined;
    let loaded: (() => void) | null = null;
    const pending = new Map<number, { ok: (v: Record<string, unknown>) => void; bad: (e: Error) => void }>();
    const send = (method: string, params: Record<string, unknown> = {}) => new Promise<Record<string, unknown>>((ok, bad) => {
      const id = ++serial;
      const timeout = setTimeout(() => { pending.delete(id); bad(new Error("CDP timeout: " + method)); }, 30000);
      pending.set(id, { ok: (v) => { clearTimeout(timeout); ok(v); }, bad: (e) => { clearTimeout(timeout); bad(e); } });
      socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const reply = (requestId: string, status: number, body: string, type = "application/json") =>
      send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: type }],
        body: Buffer.from(body).toString("base64") }).catch(() => undefined);
    const json = (requestId: string, value: unknown, status = 200) => reply(requestId, status, JSON.stringify(value));
    const errors: string[] = [];
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      if (msg.method === "Runtime.exceptionThrown") { errors.push(JSON.stringify(msg.params).slice(0, 300)); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string } };
      const p = new URL(request.url).pathname;
      if (request.method !== "GET") return void json(requestId, { ok: true });
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/api/sessions") return void json(requestId, { now: Date.now(), chips: [], tasks: [], slots: slots(), instance: { name: "mac" }, programs: [] });
      const succ = /^\/api\/slots\/(\d+)\/succession$/.exec(p);
      if (succ) return void json(requestId, { past: past(Number(succ[1])) });
      const old = /^\/api\/slots\/(\d+)\/succession\/(\d+)\/transcript$/.exec(p);
      if (old) return void json(requestId, { entries: [], total: 0, source: null, session: Number(old[2]), startedAt: null, handedAt: null,
        assigned: false, reason: "fixture: no transcript" });
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("leiste DOM probe: evaluate failed: " + expression.replace(/\s+/g, " ").slice(0, 120));
      return (r.result as { value: T }).value;
    };
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 3000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    // THE HAND: CDP Input, so the browser makes the pointer events, their ids, buttons and capture itself
    const mouse = (type: "mousePressed" | "mouseMoved" | "mouseReleased", x: number, y: number, down: boolean) =>
      send("Input.dispatchMouseEvent", { type, x, y, button: type === "mouseMoved" && !down ? "none" : "left",
        buttons: down ? 1 : 0, clickCount: type === "mouseMoved" ? 0 : 1, pointerType: "mouse" });
    const click = async (x: number, y: number) => { await mouse("mouseMoved", x, y, false); await mouse("mousePressed", x, y, true); await mouse("mouseReleased", x, y, false); };
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[]) =>
      send("Input.dispatchTouchEvent", { type, touchPoints: points });
    const tap = async (x: number, y: number) => { await touch("touchStart", [{ x, y, id: 1 }]); await Bun.sleep(50); await touch("touchEnd", []); };
    const key = async (k: string, code: number) => {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: code });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: code });
    };
    type Box = { x: number; y: number; w: number; h: number };
    const box = (sel: string) => evaluate<Box | null>(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null;
      const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
    // where a band rests: its cell, and how far off that cell the track stands right now
    const band = (slot: number) => evaluate<{ idx: number; off: number } | null>(`(() => {
      const r = document.querySelector('#slots .slot[data-slot="${slot}"]'); const v = r?.querySelector('.bandview'), t = r?.querySelector('.bandtrack');
      if (!v || !t) return null; const W = v.getBoundingClientRect().width / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-scale')) || 1), m = new DOMMatrix(getComputedStyle(t).transform).m41;
      const idx = Math.round(-m / W); return { idx, off: Math.round(m + idx * W) }; })()`);
    const marked = () => evaluate<{ current: string | null; target: string | null; focused: number }>(`({
      current: document.querySelector('#slots .slot.current')?.dataset.slot ?? null,
      target: document.getElementById('comptarget')?.dataset.slot ?? null,
      focused: [...document.querySelectorAll('#panes > .pane')].findIndex((p) => p.classList.contains('focused')) })`);
    const stroke = async (x: number, y: number, dx: number, steps: number, gapMs: number) => {
      await mouse("mouseMoved", x, y, false);
      await mouse("mousePressed", x, y, true);
      for (let i = 1; i <= steps; i++) { await mouse("mouseMoved", x + (dx * i) / steps, y, true); await Bun.sleep(gapMs); }
      return { x: x + dx, y };
    };

    // THE MEASURES of one page: the views square against the function rows, every row's height and what it holds, the fit
    // the bar is zoomed with the window (src/rails.ts): its rows are measured in its own px, as the stylesheet draws them
    const MEASURE = `(() => {
      const S = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-scale')) || 1;
      const R = (e) => { const r = e.getBoundingClientRect(); return { t: r.top / S, b: r.bottom / S, l: r.left / S, r: r.right / S, w: r.width / S, h: r.height / S }; };
      const L = document.getElementById('layouts'), t1 = document.getElementById('toolrow1'), t2 = document.getElementById('toolrow2');
      const views = [...L.querySelectorAll('button')].filter((b) => b.getClientRects().length > 0).map(R);
      const sl = document.getElementById('slots'), side = document.getElementById('side');
      // vertical only: a band's track is clipped sideways on purpose
      const inside = (e, row) => { const r = R(e); if (!r.h) return true;
        for (let a = e.parentElement; a && a !== row.parentElement; a = a.parentElement) {
          const s = getComputedStyle(a); if (a !== row && s.overflowY === 'visible' && s.overflow === 'visible') continue;
          const q = R(a); if (r.t < q.t - 0.5 || r.b > q.b + 0.5) return false; }
        return true; };
      const rows = [...sl.querySelectorAll(':scope > .slot')].map((row) => {
        const kind = row.classList.contains('empty') ? 'free' : row.classList.contains('lane') ? 'lane' : 'session';
        const line = row.querySelector('.bandtrack > .r1:last-child') ?? row.querySelector(':scope > .r1');
        const parts = [...(line?.querySelectorAll('.mark, .n, .laneref, .lbl, .act') ?? [])];
        const lbl = line?.querySelector('.lbl');
        return { slot: row.dataset.slot, kind, h: Math.round(row.getBoundingClientRect().height / S * 10) / 10,
          whole: parts.length > 0 && parts.every((e) => inside(e, row)), short: row.dataset.slot === '${SHORT}' && !!lbl && lbl.scrollWidth <= lbl.clientWidth };
      });
      return { views, t1: R(t1), t2: R(t2), layouts: getComputedStyle(L).display, rows,
        slots: { ch: sl.clientHeight, sh: sl.scrollHeight, cw: sl.clientWidth, sw: sl.scrollWidth, bar: sl.offsetWidth - sl.clientWidth },
        side: { cw: side.clientWidth, sw: side.scrollWidth }, page: { cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth } };
    })()`;
    type Measure = { views: { t: number; b: number; l: number; w: number; h: number }[]; t1: { t: number; b: number }; t2: { t: number; b: number };
      layouts: string; rows: { slot: string; kind: "free" | "lane" | "session"; h: number; whole: boolean; short: boolean }[];
      slots: { ch: number; sh: number; cw: number; sw: number; bar: number }; side: { cw: number; sw: number }; page: { cw: number; sw: number } };

    let targetId = "";
    const open = async (v: (typeof VIEWS)[number], st: State, view: { layout: number; panes: number[]; focused: number; chats?: boolean[] },
      prefs: Record<string, string> = {}) => {
      fx.st = st; now = Date.now();
      if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
      targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
      sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
      await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
      await send("Page.enable"); await send("Runtime.enable");
      await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
      await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.phone });
      if (v.touch) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await navigate("http://fleet.fixture/blank");
      await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', ${JSON.stringify(JSON.stringify(view))}); localStorage.setItem('fleet.board', '0');
        for (const [k, val] of Object.entries(${JSON.stringify(prefs)})) localStorage.setItem(k, val); })()`);
      await navigate("http://fleet.fixture/");
      if (!await wait(`document.querySelectorAll('#slots > .slot').length === 16 && document.querySelector('#slots .slot.pull, #slots .slot.empty')`, 15000))
        throw new Error(`leiste DOM probe ${v.width} ${st}: the bar did not render (` + await evaluate<string>("document.getElementById('slots')?.innerHTML.slice(0, 300) ?? 'no #slots'") + ")");
      const media = await evaluate<string>(`[matchMedia('(hover: none)').matches, matchMedia('(pointer: coarse)').matches].join()`);
      if (media !== (finger ? "true,true" : "false,false")) throw new Error(`leiste DOM probe ${v.width}: hover/pointer media did not take (${media})`);
      if (v.phone) { await evaluate("document.getElementById('menu').click()"); await Bun.sleep(400); }
      await Bun.sleep(250);
    };

    const results: LeisteDomResult[] = [];
    for (const v of views) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      await open(v, "voll", { layout: 1, panes: [1], focused: 0 });
      const full = await evaluate<Measure>(MEASURE);
      await shot(`leiste-voll-${v.width}`);
      facts.voll = { views: full.views, t1: full.t1, t2: full.t2, layouts: full.layouts, slots: full.slots, side: full.side, page: full.page,
        rows: full.rows.map((r) => `${r.slot}:${r.kind}:${r.h}${r.whole ? "" : ":cut"}`).join(" ") };
      // 1 · the views square
      if (v.phone) {
        claims[LEISTE_CLAIM.knoepfe] = full.layouts === "none" && full.views.length === 0;
        // the drawer (open() opened it): the fullest row's name as on the laptop
        const drawer = await evaluate<{ em: number; ok: boolean }>(`(() => { ${NAME_ROW} return { em, ok }; })()`);
        facts.namen = drawer;
        claims[LEISTE_CLAIM.namen] = drawer.ok && drawer.em >= 9.25;
      } else {
        const tops = [...new Set(full.views.map((b) => Math.round(b.t)))], lefts = [...new Set(full.views.map((b) => Math.round(b.l)))];
        claims[LEISTE_CLAIM.knoepfe] = full.views.length === 4 && full.views.every((b) => Math.abs(b.w - 23) < 0.5 && Math.abs(b.h - 23) < 0.5)
          && tops.length === 2 && lefts.length === 2 && full.views.filter((b) => Math.round(b.t) === tops[0]).length === 2
          && Math.abs(Math.min(...full.views.map((b) => b.t)) - full.t1.t) < 0.5 && Math.abs(Math.max(...full.views.map((b) => b.b)) - full.t2.b) < 0.5;
      }
      // 4 · the fit: 16 rows, no scrollbar, nothing wider than the bar (the phone's drawer keeps its 42px finger rows and
      // may scroll; its numbers stay in the facts)
      if (!v.phone) claims[LEISTE_CLAIM.passt] = full.rows.length === 16 && full.slots.sh <= full.slots.ch + 1 && full.slots.bar === 0
        && full.slots.sw <= full.slots.cw && full.side.sw <= full.side.cw && full.page.sw <= full.page.cw;
      // 2 · the rows' size (the phone keeps its 40px finger rows, G0.7)
      if (!v.phone) {
        await open(v, "frei", { layout: 1, panes: [1], focused: 0 });
        const free = await evaluate<Measure>(MEASURE);
        await shot(`leiste-frei-${v.width}`);
        facts.frei = free.rows.map((r) => `${r.slot}:${r.kind}:${r.h}${r.whole ? "" : ":cut"}`).join(" ");
        const rows = [...full.rows, ...free.rows];
        const cap = { session: 32, lane: 28, free: 26 } as const;
        claims[LEISTE_CLAIM.zeilen] = (["session", "lane", "free"] as const).every((k) => rows.some((r) => r.kind === k))
          && rows.every((r) => r.h <= cap[r.kind] + 1 && r.whole) && full.rows.some((r) => r.short);
      }
      if (v.width === 1024) {
        // the actions of a touch row: behind ⋯, opened at the foot of the bar
        await open(v, "voll", { layout: 1, panes: [1], focused: 0 });
        const more = await box('#slots .slot[data-slot="4"] .rowmore');
        const kills = await evaluate<number>(`[...document.querySelectorAll('#slots .slot .kill')].filter((k) => k.getClientRects().length > 0).length`);
        if (more) await tap(more.x + more.w / 2, more.y + more.h / 2);
        const opened = await wait(`document.querySelector('#side .rowmenu.open')`, 2000);
        const menu = await evaluate<{ items: string[]; inside: boolean; row: number } | null>(`(() => { const m = document.querySelector('#side .rowmenu.open');
          if (!m) return null; const r = m.getBoundingClientRect(), s = document.getElementById('side').getBoundingClientRect();
          return { items: [...m.querySelectorAll('.rowmenuitem')].map((b) => b.textContent.trim()),
            inside: r.left >= s.left - 0.5 && r.right <= s.right + 0.5 && r.bottom <= s.bottom + 0.5 && r.top >= s.top - 0.5,
            row: Math.round(document.querySelector('#slots .slot[data-slot="4"]').getBoundingClientRect().height / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-scale')) || 1)) }; })()`);
        const rail = await evaluate<number>(`parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail-scale')) || 1`);
        await shot(`leiste-menue-${v.width}`);
        facts.menue = { more, kills, opened, menu };
        claims[LEISTE_CLAIM.menue] = !!more && more.h / rail >= 28 && kills === 0 && opened && !!menu && menu.inside && menu.row <= 32
          && menu.items[menu.items.length - 1] === "Kill session";
        // the info column beside a conversation: "Oberfläche" may only grow it into room the text column does not use
        const column = async (ui: number) => {
          await open(v, "voll", { layout: 1, panes: [1], focused: 0, chats: [true] },
            { "fleet.board": "1", "fleet.chatsize": JSON.stringify({ text: 14, code: 12.5, ui, width: 780 }) });
          await wait(`document.querySelector('#panes > .pane.chat .panechat')?.clientWidth > 0 && document.getElementById('board').getBoundingClientRect().width > 0`, 3000);
          await Bun.sleep(300);
          return evaluate<{ text: number; board: number }>(`(() => { const c = document.querySelector('#panes > .pane.chat .panechat');
            const s = c ? getComputedStyle(c) : null;
            return { text: c && s ? Math.round(c.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)) : 0,
              board: Math.round(document.getElementById('board').getBoundingClientRect().width) }; })()`);
        };
        const at11 = await column(11), at16 = await column(16);
        await shot(`leiste-info-${v.width}`);
        facts.info = { at11, at16 };
        claims[LEISTE_CLAIM.info] = at11.text > 0 && at11.board >= 250 && at16.board >= 250 && at16.text >= at11.text;
      }
      if (v.width === 1440) {
        // the owner's names (22.10.: four of them ended in „[Zitat entfernt]“) on a laptop, in the two fullest rows (NAME_ROW), measured
        // with the info column shut and open; the bar may not move
        const named = async (board: "0" | "1") => {
          await open(v, "voll", { layout: 1, panes: [1], focused: 0, chats: [true] }, { "fleet.board": board });
          await wait(`document.querySelector('#panes > .pane.chat .panechat')?.clientWidth > 0`, 3000);
          await Bun.sleep(300);
          return evaluate<{ em: number; ok: boolean; side: number }>(`(() => {
            ${NAME_ROW}
            return { em, ok, side: Math.round(document.getElementById('side').getBoundingClientRect().width) }; })()`);
        };
        const shut = await named("0"), beside = await named("1");
        facts.namen = { shut, beside };
        claims[LEISTE_CLAIM.namen] = shut.ok && beside.ok && shut.em >= 9.25 && beside.em >= 9.25 && shut.side === beside.side;
        // 6 · the owner's window (a 1470 pt screen) at three browser zooms: a browser zooms each address on its own, and one board
        // read „[Zitat entfernt]“, the other „[Zitat entfernt]“ (25.10.). The window in CSS px grows as the zoom falls.
        await open(v, "voll", { layout: 1, panes: [1], focused: 0, chats: [true] }, { "fleet.board": "1", "fleet.chatsize": JSON.stringify({ text: 14, code: 12.5, ui: 11, width: 780 }) });
        const fenster: { zoom: number; bar: number; info: number; conversation: number }[] = [];
        for (const zoom of [1, 0.8, 2 / 3]) {
          await send("Emulation.setDeviceMetricsOverride", { width: Math.round(1470 / zoom), height: Math.round(837 / zoom), deviceScaleFactor: zoom, mobile: false });
          await Bun.sleep(500);
          const at = await evaluate<{ bar: number; info: number; conversation: number }>(`(() => { const w = (id) => document.getElementById(id).getBoundingClientRect().width * ${zoom};
            return { bar: Math.round(w('side')), info: Math.round(w('board')), conversation: Math.round(w('main')) }; })()`);
          fenster.push({ zoom: Math.round(zoom * 100) / 100, ...at });
          await shot(`leiste-fenster-${Math.round(zoom * 100)}`);
        }
        facts.fenster = fenster;
        claims[LEISTE_CLAIM.fenster] = fenster.every((f) => f.bar >= 200 && f.bar <= 260 && f.info >= 250 && f.info <= 300)
          && Math.max(...fenster.map((f) => f.bar)) - Math.min(...fenster.map((f) => f.bar)) <= 3
          && Math.max(...fenster.map((f) => f.info)) - Math.min(...fenster.map((f) => f.info)) <= 3;
        // 3 · one stroke, one session — and nothing without a button
        await open(v, "voll", { layout: 1, panes: [1], focused: 0 });
        const zug: Record<string, unknown> = {};
        const b2 = await box('#slots .slot[data-slot="2"] .bandview');
        const before = await band(2);
        if (!b2 || !before) throw new Error("leiste DOM probe: no band on slot 2");
        const y2 = b2.y + b2.h / 2;
        const end = await stroke(b2.x + 20, y2, 200, 40, 25);
        await Bun.sleep(450);
        zug.held = await band(2);
        await mouse("mouseReleased", end.x, end.y, false);
        await Bun.sleep(600);
        zug.released = await band(2);
        // a short stroke under the threshold, released; then the mouse wanders over the band with no button
        const b3 = await box('#slots .slot[data-slot="3"] .bandview');
        if (!b3) throw new Error("leiste DOM probe: no band on slot 3");
        const y3 = b3.y + b3.h / 2;
        const e3 = await stroke(b3.x + 40, y3, 20, 4, 20);
        await mouse("mouseReleased", e3.x, e3.y, false);
        await Bun.sleep(500);
        zug.short = await band(3);
        for (let i = 1; i <= 30; i++) { await mouse("mouseMoved", e3.x + i * 5, y3, false); await Bun.sleep(12); }
        await Bun.sleep(500);
        zug.hover = await band(3);
        // a finger across two rows: one session
        const f2 = await box('#slots .slot[data-slot="2"] .bandview');
        if (!f2) throw new Error("leiste DOM probe: band 2 left");
        const fb = await band(2);
        const fy = f2.y + f2.h / 2;
        await touch("touchStart", [{ x: f2.x + 10, y: fy, id: 1 }]);
        for (let i = 1; i <= 20; i++) { await touch("touchMove", [{ x: f2.x + 10 + i * (f2.w * 2.5) / 20, y: fy, id: 1 }]); await Bun.sleep(16); }
        await Bun.sleep(150);
        await touch("touchEnd", []);
        await Bun.sleep(600);
        zug.fingerFrom = fb; zug.finger = await band(2);
        // the bar is zoomed with the window, so a stroke counts in the band's own px: 36 screen px are 44 of them, past the 40 that
        // step the mouse's band (a pointer's px alone would stop short)
        const e4 = await stroke(b3.x + 20, y3, 36, 6, 20);
        await mouse("mouseReleased", e4.x, e4.y, false);
        await Bun.sleep(600);
        zug.lean = await band(3);
        facts.zug = { before, ...zug };
        const at = (x: unknown) => x as { idx: number; off: number } | null;
        claims[LEISTE_CLAIM.zug] = before.idx === 3 && at(zug.held)?.idx === 2 && at(zug.released)?.idx === 2 && at(zug.released)?.off === 0
          && at(zug.short)?.idx === 1 && at(zug.short)?.off === 0 && at(zug.hover)?.idx === 1 && at(zug.hover)?.off === 0
          && at(zug.lean)?.idx === 0 && at(zug.lean)?.off === 0
          && fb?.idx === 2 && at(zug.finger)?.idx === 1 && at(zug.finger)?.off === 0;

        // 5 · the highlight, door by door, in layout 2 with slots 1 and 5
        await open(v, "voll", { layout: 2, panes: [1, 5], focused: 0 });
        const doors: { door: string; want: string; current: string | null; target: string | null; ok: boolean }[] = [];
        const door = async (name: string, want: number) => {
          const ok = await wait(`document.querySelector('#slots .slot.current')?.dataset.slot === '${want}' && document.getElementById('comptarget')?.dataset.slot === '${want}'`, 2500);
          const m = await marked();
          doors.push({ door: name, want: String(want), current: m.current, target: m.target, ok });
        };
        await door("start", 1);
        const s2 = await box('#slots .slot[data-slot="2"] .bandview');
        if (!s2) throw new Error("leiste DOM probe: no band on slot 2 (layout 2)");
        const se = await stroke(s2.x + 20, s2.y + s2.h / 2, 60, 12, 16);
        await Bun.sleep(450);
        await mouse("mouseReleased", se.x, se.y, false);
        await door("a mouse stroke on the band of slot 2", 2);
        const s3 = await box('#slots .slot[data-slot="3"] .bandview');
        if (!s3) throw new Error("leiste DOM probe: no band on slot 3 (layout 2)");
        const ty = s3.y + s3.h / 2;
        await touch("touchStart", [{ x: s3.x + 60, y: ty, id: 1 }]);
        for (let i = 1; i <= 6; i++) { await touch("touchMove", [{ x: s3.x + 60 + i * 5, y: ty, id: 1 }]); await Bun.sleep(16); }
        await touch("touchStart", [{ x: s3.x + 90, y: ty, id: 1 }, { x: s3.x + 150, y: ty, id: 2 }]);
        await Bun.sleep(30);
        await touch("touchEnd", [{ x: s3.x + 150, y: ty, id: 2 }]);
        await Bun.sleep(30);
        await touch("touchEnd", []);
        await Bun.sleep(700);
        const r7 = await box('#slots .slot[data-slot="7"] .lbl');
        if (!r7) throw new Error("leiste DOM probe: no row 7");
        await click(r7.x + r7.w / 2, r7.y + r7.h / 2);
        await door("after a second finger on the band of slot 3: a click on row 7", 7);
        const p1 = await box("#panes > .pane:nth-child(2)"), p0 = await box("#panes > .pane:nth-child(1)");
        if (!p0 || !p1) throw new Error("leiste DOM probe: layout 2 has no two panes");
        await click(p1.x + p1.w / 2, p1.y + p1.h / 2);
        await door("a click on the other pane", 5);
        await tap(p0.x + p0.w / 2, p0.y + p0.h / 2);
        await door("a finger tap on the first pane", 7);
        await evaluate(`document.querySelector('#slots .slot[data-slot="3"] .bandview')?.focus()`);
        await key("Enter", 13);
        await door("Enter on the row of slot 3", 3);
        const l1 = await box('#layouts button[data-l="1"]');
        if (!l1) throw new Error("leiste DOM probe: no layout button 1");
        await click(l1.x + l1.w / 2, l1.y + l1.h / 2);
        await door("layout 1", 3);
        const l2 = await box('#layouts button[data-l="2"]');
        if (!l2) throw new Error("leiste DOM probe: no layout button 2");
        await click(l2.x + l2.w / 2, l2.y + l2.h / 2);
        await door("layout 2", 3);
        await shot(`leiste-markierung-${v.width}`);
        facts.markierung = doors;
        claims[LEISTE_CLAIM.markierung] = doors.length === 8 && doors.every((d) => d.ok);
      }
      if (errors.length) facts.errors = errors.slice(0, 3);
      results.push({ width: v.width, height: v.height, claims, facts });
    }
    return results;
  } finally {
    socket?.close();
    browser.kill();
    await browser.exited.catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}

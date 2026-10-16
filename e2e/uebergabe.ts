// THE „HANDOVER“ BLOCK IN A REAL BROWSER (K16, auftraege/uebergabe-b-englisch.md; src/handover-now.ts, src/handover.ts). Owner
// 16.10.: Fleet nudges the session to lead its own succession, a new session by force only at a cold cache (12:2x); see that and
// when it was nudged, a raised threshold told to the session (10:5x, Z50); the 5-point window stays (17:5x); „[Zitat entfernt]“
//  (18:2x). Runde C (auftraege/uebergabe-c-zwei-arten.md, 19:3x/21:1x): „[Zitat entfernt]“, once; nothing typed into a cold
// cache, where „New session from summary“ starts a fresh one with the agent, model and effort picked in the block. Done: one look answers what happens to this session next and when, and what can be changed — which line
// stands in which state, the writes behind the controls, and that it all fits at 1200×900 and 390×844.
// The real client bundle behind a fixture origin (as e2e/konstellation.ts): one session in slot 4 whose brief carries the
// succession facts of the state; PATCH …/handover, POST /send and the owner door recorded. Every claim has a MUTANT in
// UEB_MUTANTS that swaps one needle in the bundle or the page and must turn exactly that claim red; a needle that left the
// source throws. Driven by e2e/dom.ts.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { laterText, nowText } from "../src/handover-now";

export interface UebDomResult { width: number; height: number; claims: Record<string, boolean>; facts: Record<string, unknown> }
export interface UebMutant { name: string; claim: string; file: "src/handover.ts" | "src/handover-now.ts" | "src/board.ts" | "public/index.html";
  needle: string; with: string; width?: 1200 | 390 }

export const UEB_CLAIM = {
  unter: "below the threshold: „Succession at 40–45 %“ under the block title „Succession“ (Fleet's word, owner 16.10. 22:5x), Fleet nudges once at 40 and starts a new session at 45 — up to 45 only before the cache goes cold — and the cache in one line",
  setzen: "opened, each control stands at its line: 40 the Fleet value and on, Nudge on, Keep warm Off; 60 · Off · Nudge are one write each and the Context line follows",
  jetzt: "„Succeed now“ nudges this occupant and says when; no „New session from summary“ while the cache is warm",
  gebeten: "already nudged, cache kept warm: the nudge line says when and at what fill, the cache line names the next warm turn, values at or under the fill are no longer to pick",
  spaeter: "already nudged, 50 sets the threshold first and then tells the session, and says so",
  kalt: "above the threshold at a cold cache nothing is typed and Fleet's own act waits for the cap; „New session from summary“ stands instead of „Succeed now“",
  wahl: "„New session from summary“: agent, model and effort start as the session's own, a new agent starts from its defaults, and the owner door gets the pick once for this occupant",
  lane: "a lane: Fleet nudges once and nothing at the cap; no warm switch and no „New session from summary“, not even at a cold cache",
  aus: "the fleet's switch off: „Succession off“, Fleet runs no succession here, with the reason, no value to pick, „Succeed now“ stays",
  still: "Mangel 76b: the nudge off with nothing at the cap reads as off — on the Context line and in the block",
  erklaert: "each line's explanation stays on its hover until ⓘ shows them all",
  fit: "the block stays inside Info, the values on one line, nothing runs over sideways, the Context switch is not cut",
} as const;

export const UEB_MUTANTS: readonly UebMutant[] = [
  { name: "the 5 points leave the Context line", claim: UEB_CLAIM.unter, file: "src/board.ts",
    needle: "${at.cap !== null ? `–${at.cap}` : \"\"}", with: "" },
  { name: "the window's sentence is gone", claim: UEB_CLAIM.unter, file: "src/handover-now.ts",
    needle: "        : coolAt !== null && cache?.state === \"warm\" ? `Up to", with: "        : false ? `Up to" },
  { name: "„Off“ switches the nudge off instead of the threshold", claim: UEB_CLAIM.setzen, file: "src/handover-now.ts",
    needle: "p === \"off\" ? { thresholdPct: 0 }", with: "p === \"off\" ? { nudge: false }" },
  { name: "the switch says „Ask“ again", claim: UEB_CLAIM.setzen, file: "src/handover-now.ts",
    needle: "{ nudge: \"Nudge\", off: \"Off\" }", with: "{ nudge: \"Ask\", off: \"Off\" }" },
  { name: "„Succeed now“ types nothing the session can act on", claim: UEB_CLAIM.jetzt, file: "src/handover.ts",
    needle: "() => void tell(v, nowText(v.lane), ", with: "() => void tell(v, \"\", " },
  { name: "the fill the nudge was written at is dropped", claim: UEB_CLAIM.gebeten, file: "src/handover-now.ts",
    needle: "${sc.nudgedPct != null ? ` (${pctText(sc.nudgedPct)})` : \"\"}", with: "" },
  { name: "the cache line forgets the next warm turn", claim: UEB_CLAIM.gebeten, file: "src/handover-now.ts",
    needle: ": kc.dueAt != null && kc.dueAt > f.now ?", with: ": false ?" },
  { name: "values under the fill stay to pick", claim: UEB_CLAIM.gebeten, file: "src/handover.ts",
    needle: "d: later && fill !== null && pct <= fill,", with: "d: false," },
  { name: "a later threshold is not told to the session", claim: UEB_CLAIM.spaeter, file: "src/handover.ts",
    needle: "if (ok && later) void tell(", with: "if (false) void tell(" },
  { name: "a cold cache offers no new session", claim: UEB_CLAIM.kalt, file: "src/handover.ts",
    needle: "  if (cold && !v.lane) {", with: "  if (false) {" },
  { name: "a cold cache makes Fleet's act due again", claim: UEB_CLAIM.kalt, file: "src/handover-now.ts",
    needle: "(fill >= cap || (coolAt !== null", with: "(fill >= cap || cold || (coolAt !== null" },
  { name: "the nudge line no longer says it holds back at a cold cache", claim: UEB_CLAIM.kalt, file: "src/handover-now.ts",
    needle: "? \"not into a cold cache\"", with: "? \"due\"" },
  { name: "the picked agent is not sent", claim: UEB_CLAIM.wahl, file: "src/handover.ts",
    needle: "{ expectedOpenedAt: v.openedAt, harness: pick.harness,", with: "{ expectedOpenedAt: v.openedAt," },
  { name: "a new agent keeps the old session's model", claim: UEB_CLAIM.wahl, file: "src/handover.ts",
    needle: "(id) => set({ harness: id, model: \"\", effort: \"\" })", with: "(id) => set({ ...pick, harness: id })" },
  { name: "a lane is offered a new session at a cold cache", claim: UEB_CLAIM.lane, file: "src/handover.ts",
    needle: "  if (cold && !v.lane) {", with: "  if (cold) {" },
  { name: "a lane gets a line at the cap again", claim: UEB_CLAIM.lane, file: "src/handover-now.ts",
    needle: "    } else if (choice !== \"hint\") {", with: "    } else {" },
  { name: "the switched-off fleet still offers values", claim: UEB_CLAIM.aus, file: "src/handover.ts",
    needle: "    }), locked);\n    const plans", with: "    }), false);\n    const plans" },
  { name: "the nudge off with nothing at the cap shows a threshold again", claim: UEB_CLAIM.still, file: "src/handover.ts",
    needle: "  if (sc.thresholdPct === null || handoverDoesNothing(sc)) return null;", with: "  if (sc.thresholdPct === null) return null;" },
  { name: "the explanations stand under every line again", claim: UEB_CLAIM.erklaert, file: "public/index.html",
    needle: "  #board .bueb .st > .x { display: none; }\n", with: "" },
  { name: "the values grow past Info on the phone", claim: UEB_CLAIM.fit, file: "public/index.html", width: 390,
    needle: "    #board .seg.pcts button { min-width: 22px; padding: 0 1px; }", with: "    #board .seg.pcts button { min-width: 40px; padding: 0 1px; }" },
  { name: "the Context line says „Handover“ again", claim: UEB_CLAIM.unter, file: "src/board.ts",
    needle: "`Succession at ${at.pct}", with: "`Handover at ${at.pct}" },
  { name: "the block's title says „Handover“ again", claim: UEB_CLAIM.unter, file: "src/board.ts",
    needle: "el(\"span\", \"t\", \"Succession\")", with: "el(\"span\", \"t\", \"Handover\")" },
  { name: "the nudge line says „hand over“ again", claim: UEB_CLAIM.unter, file: "src/handover-now.ts",
    needle: "\"Fleet nudges the session once to succeed.\"", with: "\"Fleet nudges the session once to hand over.\"" },
  { name: "„Succeed now“ reads „Hand over now“ again", claim: UEB_CLAIM.jetzt, file: "src/handover.ts",
    needle: "button(\"Succeed now\"", with: "button(\"Hand over now\"" },
  { name: "the Context switch's words run long again", claim: UEB_CLAIM.fit, file: "src/board.ts", width: 390,
    needle: "`Succession at ${at.pct}", with: "`Succession from ${at.pct} % (the session may wait up to ${at.cap} while its cache is warm) at ${at.pct}" },
];

type State = "unter" | "gebeten" | "kalt" | "lane" | "aus" | "still";
const STATES: readonly State[] = ["unter", "gebeten", "kalt", "lane", "aus", "still"];
const SLOT = 4, OPENED = 4000;

export async function runUebergabeDom(sourceRoot: string, artifacts?: string,
  only: { widths?: readonly number[]; states?: readonly State[]; mutate?: UebMutant } = {}): Promise<UebDomResult[]> {
  const scratch = resolve(tmpdir(), `fleet-ueb-dom-${process.pid}-${crypto.randomUUID()}`);
  mkdirSync(scratch, { recursive: true });
  if (artifacts) mkdirSync(artifacts, { recursive: true });
  const mutant = only.mutate;
  const htmlMutant = mutant?.file === "public/index.html" ? mutant : null;
  const mutantPath = mutant && !htmlMutant ? resolve(sourceRoot, mutant.file) : null;
  let applied = !mutant;
  const built = await Bun.build({ entrypoints: [resolve(sourceRoot, "src/client.ts")], target: "browser",
    plugins: mutant && mutantPath ? [{ name: "ueb-mutant", setup(build) {
      build.onLoad({ filter: /\.ts$/ }, ({ path }) => {
        if (path !== mutantPath) return;
        const source = readFileSync(path, "utf8");
        applied = source.includes(mutant.needle);
        return { contents: source.replace(mutant.needle, mutant.with), loader: "ts" };
      });
    } }] : [] });
  if (!built.success) { rmSync(scratch, { recursive: true, force: true }); throw new Error(built.logs.join("\n")); }
  const appJs = await built.outputs[0]!.text();
  let indexHtml = readFileSync(resolve(sourceRoot, "public/index.html"), "utf8");
  if (htmlMutant) { applied = indexHtml.includes(htmlMutant.needle); indexHtml = indexHtml.replace(htmlMutant.needle, htmlMutant.with); }
  if (!applied) { rmSync(scratch, { recursive: true, force: true }); throw new Error(`uebergabe mutant: needle not in ${mutant?.file}: ${mutant?.needle.slice(0, 80)}`); }

  const MIN = 60_000;
  let now = Date.now();
  // the state's facts, as server.ts#successionFacts sends them; the setting follows each PATCH
  const fx = { st: "unter" as State, set: {} as { thresholdPct?: number | null; nudge?: boolean; atThreshold?: string | null; keepCache?: boolean | null },
    writes: [] as { method: string; path: string; body: unknown; at: number }[], briefs: 0 };
  const fill = (pct: number) => ({ usedTokens: pct * 10_000, windowTokens: 1_000_000, pct });
  const warm = () => ({ state: "warm", lastCallAt: now - 5 * MIN, ttlSec: 3600, coldAt: now + 55 * MIN });
  const cold = () => ({ state: "kalt", lastCallAt: now - 70 * MIN, ttlSec: 3600, coldAt: now - 10 * MIN });
  const succession = () => {
    const st = fx.st, lane = st === "lane";
    const fleetPct = lane ? 37 : 40;
    const own = fx.set.thresholdPct;
    const eff = own === undefined || own === null ? fleetPct : own;
    const off = st === "aus" ? "fleet" : eff === 0 ? "session" : null;
    const base = off ? null : eff;
    const keepOn = fx.set.keepCache ?? (st === "gebeten");
    const kept = keepOn && !lane;
    return { rail: lane ? "lane" : "handoff", kind: lane ? "lane" : "bau", thresholdPct: base, capPct: base === null ? null : base + 5,
      thresholdOff: off, thresholdFrom: own != null ? "session" : "fleet", defaultPct: fleetPct,
      pctFrom: own != null ? "session" : "fleet", sessionPct: own ?? null, nudgeOn: fx.set.nudge ?? st !== "still", maxNudges: 1, gaveUp: st === "gebeten",
      nudges: st === "gebeten" ? 1 : 0, nudgedAt: st === "gebeten" ? now - 3 * MIN : null, nudgedPct: st === "gebeten" ? 41 : null,
      fill: fill(st === "unter" ? 30 : st === "gebeten" ? 42 : st === "lane" ? 38 : st === "aus" ? 52 : st === "still" ? 38 : 41),
      cache: st === "kalt" || st === "lane" ? cold() : warm(),
      keepCache: { on: kept, from: fx.set.keepCache != null ? "session" : "fleet", fleetOn: st === "gebeten", exempt: lane ? "lane" : null,
        idleMin: 50, fleetIdleMin: 50, lifetimeMin: 60, hourCap: 2, warmTurns: kept ? 1 : 0, warmMax: 3,
        dueAt: kept ? now + 45 * MIN : null, reason: kept ? "before-duration" : "off" },
      compaction: null, autoCompact: false,
      atThreshold: fx.set.atThreshold ?? (lane || st === "still" ? "hint" : "succeed"), fleetChoice: lane ? "hint" : "succeed",
      choices: lane ? ["hint", "compact"] : ["hint", "compact", "succeed"], act: null, session: 2, taken: null, cap: null };
  };
  // in slot order: the client reads a slot as fleet[id - 1]
  const slots = () => [
    ...Array.from({ length: SLOT - 1 }, (_, i) => ({ id: i + 1, cwd: null, label: null, lastOutput: 0 })),
    { id: SLOT, cwd: fx.st === "lane" ? "/fixture/r.worktrees/l" : "/fixture/r", label: "Einstellungen", openedAt: OPENED, lastOutput: 0,
      model: "claude-opus-5-5[1m]", effort: "high", ctx: succession().fill,
      ...(fx.st === "lane" ? { worktree: { repo: "/fixture/r", branch: "lane/l" } } : {}) },
    ...Array.from({ length: 16 - SLOT }, (_, i) => ({ id: SLOT + 1 + i, cwd: null, label: null, lastOutput: 0 })),
  ];
  const PREVIEW = "The successor gets the standing handover from 1 min ago.";
  // the harness catalogue as GET /api/harnesses sends it, two agents (server.ts#harnessCatalogue)
  const HARNESSES = { harnesses: [
    { id: "claude", role: "agent", default: true, note: null, effortLevels: ["low", "medium", "high", "xhigh", "max"],
      models: ["claude-opus-5-5[1m]", "claude-sonnet-5-5[1m]"],
      supports: { resume: true, transcript: true, model: true, effort: true, selfSchedule: true, container: false } },
    { id: "codex", role: "agent", default: false, note: null, effortLevels: ["low", "medium", "high"], models: ["gpt-6.1-sol"],
      supports: { resume: true, transcript: false, model: true, effort: true, selfSchedule: false, container: false } },
  ] };

  const executable = process.env.FLEET_E2E_BROWSER ?? Bun.which("chromium") ?? Bun.which("chromium-browser") ?? Bun.which("google-chrome") ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!Bun.file(executable).size) { rmSync(scratch, { recursive: true, force: true }); throw new Error("uebergabe DOM probe needs Chromium (FLEET_E2E_BROWSER): " + executable); }
  const browser = Bun.spawn([executable, "--headless", "--password-store=basic", "--no-sandbox", "--disable-gpu", "--no-first-run", "--disable-background-networking", "--remote-debugging-port=0", `--user-data-dir=${scratch}/profile`, "about:blank"], { stdout: "ignore", stderr: "pipe" });
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
    const missed = new Set<string>();
    socket.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as { id?: number; error?: unknown; result?: Record<string, unknown>; method?: string; params?: Record<string, unknown> };
      if (msg.id !== undefined) {
        const waiting = pending.get(msg.id); if (!waiting) return;
        pending.delete(msg.id);
        if (msg.error) waiting.bad(new Error(JSON.stringify(msg.error))); else waiting.ok(msg.result ?? {});
        return;
      }
      if (msg.method === "Page.loadEventFired") { const fire = loaded; loaded = null; fire?.(); return; }
      if (msg.method === "Page.javascriptDialogOpening") { void send("Page.handleJavaScriptDialog", { accept: false }).catch(() => undefined); return; }
      if (msg.method !== "Fetch.requestPaused" || !msg.params) return;
      const { requestId, request } = msg.params as { requestId: string; request: { url: string; method: string; postData?: string } };
      const p = new URL(request.url).pathname;
      if (request.method !== "GET") {
        let body: unknown = null;
        try { body = request.postData ? JSON.parse(request.postData) : null; } catch { body = request.postData ?? null; }
        // the block's own writes; the terminal's /resize and the like are no part of it
        if (p === "/send" || p.startsWith(`/api/slots/${SLOT}/handover`) || p.startsWith(`/api/slots/${SLOT}/succeed`))
          fx.writes.push({ method: request.method, path: p, body, at: Date.now() });
        if (p === `/api/slots/${SLOT}/handover` && request.method === "PATCH") {
          const b = body as { expectedOpenedAt?: number } & typeof fx.set;
          if (b?.expectedOpenedAt !== OPENED) return void json(requestId, { refusal: "occupant-changed", error: "fixture: wrong occupant" }, 409);
          const { expectedOpenedAt: _, ...rest } = b;
          fx.set = { ...fx.set, ...rest };
          return void json(requestId, { slot: SLOT, openedAt: OPENED, succession: succession() });
        }
        if (p === "/send") return void json(requestId, { ok: true, delivery: "typed" });
        if (p === `/api/slots/${SLOT}/succeed`) return void json(requestId, { ok: true, slot: SLOT });
        return void json(requestId, { ok: true });
      }
      if (p === "/" || p === "/blank") return void reply(requestId, 200, p === "/" ? indexHtml : "<!doctype html><title>blank</title>", "text/html");
      if (p === "/app.js") return void reply(requestId, 200, appJs, "text/javascript");
      if (p === "/api/sessions") return void json(requestId, { now: Date.now(), chips: [], tasks: [], slots: slots(), instance: { name: "mac" }, programs: [] });
      if (p === `/api/slots/${SLOT}/brief`) { fx.briefs++; return void json(requestId, { error: "not a git repo", git: "none", succession: succession() }, 400); }
      if (p === `/api/slots/${SLOT}/succeed`) return void json(requestId, { slot: SLOT, ready: true, refusal: null, says: PREVIEW, source: "handover" });
      if (p === "/api/harnesses") return void json(requestId, HARNESSES);
      missed.add(p);
      return void json(requestId, { error: "fixture: not served" }, 404);
    };
    const evaluate = async <T>(expression: string): Promise<T> => {
      const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error("uebergabe DOM probe: evaluate failed: " + expression.replace(/\s+/g, " ").slice(0, 120));
      return (r.result as { value: T }).value;
    };
    const settle = (ms = 60) => evaluate(`new Promise(r => setTimeout(r, ${ms}))`);
    const navigate = async (to: string) => {
      const done = new Promise<void>((ok) => { loaded = ok; });
      await send("Page.navigate", { url: to });
      await Promise.race([done, Bun.sleep(15000)]);
    };
    const wait = async (condition: string, ms = 8000) => evaluate<boolean>(`new Promise((ok) => { const until = Date.now() + ${ms};
      const tick = () => { let v = false; try { v = !!(${condition}); } catch {} if (v) return ok(true); if (Date.now() > until) return ok(false); setTimeout(tick, 20); }; tick(); })`);
    const shot = async (name: string) => {
      if (!artifacts) return;
      const png = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      writeFileSync(resolve(artifacts, `${name}.png`), Buffer.from(String(png.data), "base64"));
    };
    // the clock as the page writes it
    // a time of today as 14:05, another day's with its day („17 Oct 00:02“): a run near midnight puts the fixture's times
    // on tomorrow (ueb-c2-domwatch, 16.10. 23:17)
    const T = (ms: number) => evaluate<string>(`(() => { const d = new Date(${ms}), n = new Date();
      const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return d.toDateString() === n.toDateString() ? hm : d.getDate() + " " + d.toLocaleString("en-GB", { month: "short" }) + " " + hm; })()`);
    const UEB = `document.querySelector('#boardbody .bueb')`;
    const READ = `(() => { const b = ${UEB}; const row = document.querySelector('#boardbody .bhead .bkv.ctx');
      const txt = (e) => e ? e.innerText.replace(/\\s+/g, ' ').trim() : null;
      const segOf = (sel) => b ? [...b.querySelectorAll(sel + ' button')].map((x) => ({ t: x.textContent.trim(), on: x.classList.contains('on'), dflt: x.classList.contains('dflt'), d: x.disabled })) : [];
      const sw = row?.querySelector('.optsw'), v = row?.querySelector(':scope > .v');
      const cut = (() => { const words = sw && [...sw.childNodes].find((x) => x.nodeType === 3), chev = sw?.querySelector('.ico');
        if (!v || !words || !chev) return null; const r = document.createRange(); r.selectNodeContents(words);
        const c = chev.getBoundingClientRect(), box = sw.getBoundingClientRect();
        return Math.max(r.getBoundingClientRect().right - c.left, c.right - box.right, box.right - v.getBoundingClientRect().right); })();
      const info = document.querySelector('#board')?.getBoundingClientRect(), br = b?.getBoundingClientRect();
      const pcts = b?.querySelector('.seg.pcts');
      // a word cut off anywhere in the Context line (an ellipsis or a box narrower than its text)
      const trunc = !!v && [v, ...v.querySelectorAll('*')].some((x) => x.clientWidth > 0 && x.scrollWidth > x.clientWidth + 1);
      return { line: txt(v), sw: sw?.title ?? null, cut, trunc, block: b ? {
        open: b.classList.contains('open'), head: txt(b.querySelector(':scope > .buebh > .t')),
        lines: [...b.querySelectorAll('.st')].map((r) => { const pv = r.querySelector(':scope > .pv'), x = r.querySelector(':scope > .x');
          return { id: r.dataset.st ?? null, k: txt(r.querySelector(':scope > .k')), v: pv ? [...pv.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim() : null,
            stat: txt(r.querySelector('.stat')), why: txt(r.querySelector(':scope > .why')), grey: r.classList.contains('grey'), x: !!x && x.getClientRects().length > 0 }; }),
        pcts: segOf('.seg.pcts'), plans: segOf('.seg.plans'), warm: segOf('.seg.warm'), mins: segOf('.seg.mins'),
        now: [...b.querySelectorAll('.st[data-st="now"] button')].map((x) => ({ uk: x.dataset.uk, t: x.textContent.trim(), d: x.disabled })),
        picks: [...b.querySelectorAll('.st[data-st="now"] select')].map((x) => ({ uk: x.dataset.uk, v: x.value, opts: [...x.options].map((o) => o.value) })),
        note: txt(b.querySelector('.pnote, .perr')),
        tops: pcts ? new Set([...pcts.querySelectorAll('button')].map((x) => Math.round(x.getBoundingClientRect().top))).size : null,
        fits: !!br && br.left >= -0.5 && br.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth
          && (!info || (br.left >= info.left - 0.5 && br.right <= info.right + 0.5))
          && [...b.querySelectorAll('*')].every((x) => x.getBoundingClientRect().right <= br.right + 0.5),
      } : null }; })()`;
    type Btn = { t: string; on: boolean; dflt: boolean; d: boolean };
    type Line = { id: string | null; k: string | null; v: string | null; stat: string | null; why: string | null; grey: boolean; x: boolean };
    type Read = { line: string | null; sw: string | null; cut: number | null; trunc: boolean; block: null | { open: boolean; head: string | null; lines: Line[]; pcts: Btn[]; plans: Btn[]; warm: Btn[];
      mins: Btn[]; now: { uk: string; t: string; d: boolean }[]; picks: { uk: string; v: string; opts: string[] }[]; note: string | null;
      tops: number | null; fits: boolean } };
    const read = () => evaluate<Read>(READ);
    const said = (r: Read) => r.block?.lines.filter((x) => x.id !== "now").map((x) => `${x.k} · ${x.v}`) ?? [];
    const lineOf = (r: Read, id: string) => r.block?.lines.find((x) => x.id === id);
    const toggle = async (open: boolean) => {
      await evaluate(`document.querySelector('#boardbody .bhead .bkv.ctx .optsw')?.click()`);
      return wait(open ? `${UEB}?.classList.contains('open') && ${UEB}.querySelector('.st[data-st="now"]')` : `!${UEB}?.classList.contains('open')`, 4000);
    };
    // a click writes only once the write before it has its answer (src/handover.ts#write): press, then wait for the fixture
    const press = async (uk: string, writes = 1) => {
      const before = fx.writes.length;
      await evaluate(`${UEB}?.querySelector('button[data-uk="${uk}"]')?.click()`);
      for (let i = 0; i < 100 && fx.writes.length < before + writes; i++) await Bun.sleep(20);
      await settle(200);
    };
    const bodies = () => fx.writes.map((w) => [w.method, w.path, w.body]);
    // a picker set as a hand sets it: the value, then its change event
    const pickIn = async (uk: string, value: string) => {
      await evaluate(`(() => { const x = ${UEB}?.querySelector('select[data-uk="${uk}"]'); if (x) { x.value = ${JSON.stringify(value)}; x.dispatchEvent(new Event('change')); } })()`);
      await settle(150);
    };
    const P = `/api/slots/${SLOT}/handover`;

    const results: UebDomResult[] = [];
    let targetId = "";
    for (const [width, height, phone] of ([[1200, 900, false], [390, 844, true]] as const).filter(([w]) => !only.widths || only.widths.includes(w))) {
      const claims: Record<string, boolean> = {};
      const facts: Record<string, unknown> = {};
      const fits: boolean[] = [];
      for (const st of STATES.filter((s) => !only.states || only.states.includes(s))) {
        fx.st = st; fx.set = {}; fx.writes = []; fx.briefs = 0; now = Date.now();
        if (targetId) { const old = targetId; sessionId = undefined; await send("Target.closeTarget", { targetId: old }).catch(() => undefined); }
        targetId = String((await send("Target.createTarget", { url: "about:blank" })).targetId);
        sessionId = String((await send("Target.attachToTarget", { targetId, flatten: true })).sessionId);
        await send("Fetch.enable", { patterns: [{ urlPattern: "http://fleet.fixture/*" }] });
        await send("Page.enable"); await send("Runtime.enable");
        await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.WebSocket = class { constructor() { this.readyState = 0; } send() {} close() {} };` });
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: phone });
        if (phone) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
        await navigate("http://fleet.fixture/blank");
        await evaluate(`(() => { localStorage.clear(); localStorage.setItem('fleet.view', JSON.stringify({ layout: 1, panes: [${SLOT}], focused: 0 })); localStorage.setItem('fleet.board', '${phone ? "0" : "1"}'); })()`);
        await navigate("http://fleet.fixture/");
        if (phone) {
          await wait("document.querySelector('#mpill')", 8000);
          await settle(400);
          await evaluate("document.querySelector('#mpill')?.click()");
          await wait("document.body.classList.contains('mopen')", 2000);
          await settle(200);
          await evaluate("document.querySelector('#minfo')?.click()");
        }
        if (!await wait(`${UEB}?.querySelector('.st')`, 15000))
          throw new Error(`uebergabe DOM probe ${width} ${st}: no Handover block (not served: ${[...missed].join(" ")}): ` + await evaluate<string>("(document.querySelector('#board')?.outerHTML ?? 'no #board').slice(0, 600)"));
        await settle(200);
        const closed = await read();
        await shot(`uebergabe-${st}-${width}`);
        const briefs0 = fx.briefs, t0 = Date.now();
        const opened = await toggle(true);
        await wait(`${UEB}?.querySelector('.st[data-st="now"] button')`, 3000);
        await settle(st === "kalt" ? 600 : 150);
        const r = await read();
        const openFacts = { opened, briefs: fx.briefs - briefs0, ms: Date.now() - t0 };
        facts[st] = { closed, open: r, openFacts };
        if (r.block) fits.push(r.block.fits && (r.block.tops ?? 1) === 1);
        if (closed.cut !== null) fits.push(closed.cut <= 0.5);
        fits.push(!closed.trunc && !r.trunc);
        await shot(`uebergabe-${st}-offen-${width}`);
        const b = r.block, c = closed.block;

        if (st === "unter") {
          const cool = await T(now + 45 * MIN), coldAt = await T(now + 55 * MIN);
          claims[UEB_CLAIM.unter] = closed.line === "30 % · Succession at 40–45 %" && !!c && !c.open && c.head === "Succession"
            && JSON.stringify(said(closed)) === JSON.stringify(["40 % · Fleet nudges the session once to succeed.",
              "45 % · Fleet starts a new session if it hasn't succeeded yet.", `Cache · Warm until ${coldAt} · not kept warm · auto-compact off.`])
            && lineOf(closed, "nudge")?.stat === "10 % to go" && lineOf(closed, "act")?.why === `Up to 45 % only until ${cool}, before the cache goes cold.`
            && closed.sw === "Fleet nudges the session once to succeed at 40 %; it has until 45 % while the cache is warm";
          // the controls at their lines, then 60 · Off · Nudge, each one write for this occupant and no /brief
          const pre = { pcts: b?.pcts, plans: b?.plans, warm: b?.warm };
          fx.writes = [];
          const b1 = fx.briefs;
          await press("pct-60");
          const at60 = await read();
          await press("plan-off");
          const off = await read();
          await press("plan-nudge");
          const back = await read();
          facts.setzen = { pre, writes: bodies(), at60: at60.line, off: [off.line, said(off)], back: [back.line, said(back)], briefs: fx.briefs - b1 };
          claims[UEB_CLAIM.setzen] = openFacts.opened && openFacts.briefs === 0
            && JSON.stringify(pre.pcts?.map((x) => x.t)) === JSON.stringify(["25", "30", "35", "40", "45", "50", "55", "60", "65", "70"])
            && pre.pcts?.find((x) => x.on)?.t === "40" && pre.pcts.find((x) => x.dflt)?.t === "40" && pre.pcts.every((x) => !x.d)
            && JSON.stringify(pre.plans?.map((x) => [x.t, x.on])) === JSON.stringify([["Nudge", true], ["Off", false]])
            && JSON.stringify(pre.warm?.map((x) => [x.t, x.on])) === JSON.stringify([["On", false], ["Off", true]])
            && JSON.stringify(bodies()) === JSON.stringify([["PATCH", P, { expectedOpenedAt: OPENED, thresholdPct: 60 }],
              ["PATCH", P, { expectedOpenedAt: OPENED, thresholdPct: 0 }], ["PATCH", P, { expectedOpenedAt: OPENED, thresholdPct: null, nudge: true, atThreshold: null }]])
            && at60.line === "30 % · Succession at 60–65 %" && off.line === "30 % · Succession off" && said(off)[0] === "Off · Fleet won't nudge or step in."
            && back.line === "30 % · Succession at 40–45 %" && said(back)[0] === "40 % · Fleet nudges the session once to succeed.";
          // „Succeed now“
          fx.writes = [];
          await press("now");
          const after = await read();
          const sent = fx.writes[0];
          facts.jetzt = { writes: bodies(), note: after.block?.note, now: b?.now };
          claims[UEB_CLAIM.jetzt] = JSON.stringify(b?.now.map((x) => [x.uk, x.t, x.d])) === JSON.stringify([["now", "Succeed now", false]])
            && fx.writes.length === 1 && sent?.path === "/send"
            && JSON.stringify(sent.body) === JSON.stringify({ slot: SLOT, text: nowText(false), whenFree: true, openedAt: OPENED })
            && after.block?.note === `Nudged to succeed at ${await T(sent.at)}.` && (b?.picks.length ?? 0) === 0;
          // ⓘ shows every line's explanation, hover alone before
          const hidden = (c?.lines ?? []).every((x) => !x.x);
          await evaluate(`${UEB}?.querySelector('button[data-uk="ueb-i"]')?.click()`);
          await wait(`${UEB}?.classList.contains('explain')`, 2000);
          const shown = (await read()).block?.lines.filter((x) => x.id !== "now").every((x) => x.x) ?? false;
          await shot(`uebergabe-erklaert-${width}`);
          claims[UEB_CLAIM.erklaert] = hidden && shown;
        }
        if (st === "gebeten") {
          const at = await T(now - 3 * MIN);
          claims[UEB_CLAIM.gebeten] = closed.line === "42 % · Succession at 40–45 %" && !!c
            && JSON.stringify(said(closed)) === JSON.stringify(["40 % · Fleet nudges the session once to succeed.",
              "45 % · Fleet starts a new session if it hasn't succeeded yet.",
              `Cache · Warm until ${await T(now + 55 * MIN)} · Fleet keeps it warm, next turn ${await T(now + 45 * MIN)} · auto-compact off.`])
            && lineOf(closed, "nudge")?.stat === `nudged ${at} (41 %)` && lineOf(closed, "act")?.why === "Fleet keeps the cache warm, so the session has until 45 %."
            && JSON.stringify(b?.pcts.filter((x) => !x.d).map((x) => x.t)) === JSON.stringify(["45", "50", "55", "60", "65", "70"])
            && b?.pcts.find((x) => x.on)?.t === "40"
            && JSON.stringify(b?.warm.map((x) => [x.t, x.on])) === JSON.stringify([["On", true], ["Off", false]]) && b?.mins.find((x) => x.on)?.t === "50";
          fx.writes = [];
          await press("pct-50", 2);
          const after = await read();
          const [w1, w2] = fx.writes;
          facts.spaeter = { writes: bodies(), line: after.line, note: after.block?.note };
          claims[UEB_CLAIM.spaeter] = fx.writes.length === 2 && w1?.method === "PATCH" && JSON.stringify(w1.body) === JSON.stringify({ expectedOpenedAt: OPENED, thresholdPct: 50 })
            && w2?.path === "/send" && JSON.stringify(w2.body) === JSON.stringify({ slot: SLOT, text: laterText(50, "succeed", false), whenFree: true, openedAt: OPENED })
            && w2.at >= w1.at && after.line === "42 % · Succession at 50–55 %" && after.block?.note === `Told the session: 50 %, at ${await T(w2.at)}.`;
          await shot(`uebergabe-spaeter-${width}`);
        }
        if (st === "kalt") {
          await wait(`${UEB}?.querySelector('button[data-uk="new"]:not(:disabled)') && ${UEB}.querySelector('select[data-uk="new-agent"] option[value="codex"]')`, 3000);
          const ready = await read();
          claims[UEB_CLAIM.kalt] = !!c && lineOf(closed, "act")?.k === "45 %" && lineOf(closed, "act")?.stat === null
            && lineOf(closed, "act")?.why === "The cache is cold: start a new session from a summary below, or Fleet does it at the cap."
            && lineOf(closed, "nudge")?.stat === "not into a cold cache"
            && lineOf(closed, "cache")?.v === `Cold since ${await T(now - 10 * MIN)} · not kept warm · auto-compact off.`
            && JSON.stringify(ready.block?.now.map((x) => [x.uk, x.t, x.d])) === JSON.stringify([["new", "New session from summary", false]]);
          // the pick: the session's own first, a new agent from its defaults, then posted once
          const own = ready.block?.picks.map((x) => [x.uk, x.v]);
          await pickIn("new-agent", "codex");
          const switched = (await read()).block?.picks;
          await pickIn("new-model", "gpt-6.1-sol");
          fx.writes = [];
          await press("new");
          facts.wahl = { own, switched, writes: bodies() };
          await shot(`uebergabe-wahl-${width}`);
          claims[UEB_CLAIM.wahl] = JSON.stringify(own) === JSON.stringify([["new-agent", "claude"], ["new-model", "claude-opus-5-5[1m]"], ["new-effort", "high"]])
            && JSON.stringify(switched?.map((x) => [x.uk, x.v, x.opts])) === JSON.stringify([["new-agent", "codex", ["claude", "codex"]],
              ["new-model", "", ["", "gpt-6.1-sol"]], ["new-effort", "", ["", "low", "medium", "high"]]])
            && JSON.stringify(bodies()) === JSON.stringify([["POST", `/api/slots/${SLOT}/succeed`,
              { expectedOpenedAt: OPENED, harness: "codex", model: "gpt-6.1-sol", effort: null }]]);
        }
        if (st === "lane") {
          claims[UEB_CLAIM.lane] = closed.line === "38 % · Succession at 37 %" && !!b
            && JSON.stringify(said(closed)) === JSON.stringify(["37 % · Fleet nudges the session once to succeed.",
              `Cache · Cold since ${await T(now - 10 * MIN)} · auto-compact off.`])
            && b.warm.length === 0 && JSON.stringify(b.now.map((x) => x.uk)) === JSON.stringify(["now"]) && b.picks.length === 0
            && b.pcts.find((x) => x.on && x.dflt)?.t === "37";
        }
        if (st === "aus") {
          claims[UEB_CLAIM.aus] = closed.line === "52 % · Succession off" && !!b
            && lineOf(closed, "off")?.v === "Fleet runs no succession here." && lineOf(closed, "off")?.why === "not switched on in this Fleet"
            && lineOf(closed, "off")?.grey === true && b.pcts.length > 0 && b.pcts.every((x) => x.d) && b.plans.every((x) => x.d)
            && JSON.stringify(b.now.map((x) => x.uk)) === JSON.stringify(["now"]);
        }
        if (st === "still") {
          claims[UEB_CLAIM.still] = closed.line === "38 % · Succession off" && said(closed)[0] === "Off · Fleet won't nudge or step in."
            && b?.plans.find((x) => x.on)?.t === "Off";
        }
      }
      claims[UEB_CLAIM.fit] = fits.length > 0 && fits.every(Boolean);
      results.push({ width, height, claims, facts });
    }
    return results;
  } finally {
    socket?.close();
    browser.kill();
    await browser.exited.catch(() => undefined);
    rmSync(scratch, { recursive: true, force: true });
  }
}

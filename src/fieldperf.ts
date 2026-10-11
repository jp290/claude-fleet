// THE BOARD MEASURES ITSELF ON THE OWNER'S DEVICE (UI-MAIN 11.10., before the Snappiness charge): the
// first painted row of the left bar after a reload, each click in the left bar, the right tab or the
// queue until the paint after the DOM answered, the /api requests of each minute by route shape with
// their bytes, the device class and the build — one row per page and minute to POST /api/perf/field
// (src/protocol.ts#FieldRow), numbers only. INVISIBLE in the product: nothing to see, nothing to switch.
// What it costs itself stands in every row as `selfMs` (the time spent inside its own handlers).
import { FIELD_CLICKS_MAX, FIELD_ROUTES_MAX, type FieldArea, type FieldRow } from "./protocol";

let selfMs = 0;
const timed = <T>(fn: () => T): T => {
  const t = performance.now();
  try { return fn(); } finally { selfMs += performance.now() - t; }
};
const paint = (fn: () => void): void => { requestAnimationFrame(() => requestAnimationFrame(fn)); };

function uaClass(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : /Mac OS X|Macintosh/.test(ua) ? "mac"
    : /Windows/.test(ua) ? "win" : /Linux/.test(ua) ? "linux" : "other";
  const br = /Edg\//.test(ua) ? "edge" : /Firefox\/|FxiOS/.test(ua) ? "firefox" : /Chrome\/|CriOS/.test(ua) ? "chrome"
    : /Safari\//.test(ua) ? "safari" : "other";
  return `${br}-${os}`;
}
// a route by its shape: numbers and hex ids become :n / :id, the query is dropped — never a name or a path
function routeOf(url: string): string | null {
  let p: string;
  try { p = new URL(url, location.href).pathname; } catch { return null; }
  if (!p.startsWith("/api/") || p.startsWith("/api/perf")) return null;
  const parts = p.split("/").slice(1, 7).map((x) => /^\d+$/.test(x) ? ":n" : /^[0-9a-f]{6,}$/i.test(x) ? ":id"
    : /^[a-z0-9_-]{1,40}$/i.test(x) ? x.toLowerCase() : ":x");
  return `/${parts.join("/")}`;
}
function areaOf(t: EventTarget | null): FieldArea | null {
  const e = t instanceof Element ? t : null;
  // the Queue button opens the queue: its click is the queue's, though it stands in the left bar
  return !e ? null : e.closest("#shell-queue, #queuebtn") ? "queue" : e.closest("#board") ? "board" : e.closest("#side") ? "side" : null;
}

export function initFieldPerf(src: { v: () => number; sha: () => string | null }): void {
  const sent = { at: performance.now() };
  let firstSlotMs: number | null = null, firstSent = false;
  let clicks: FieldRow["clicks"] = [];
  let routes: FieldRow["routes"] = {};
  // the first painted row of the left bar, once per page: one look per frame until it stands (an observer
  // on the whole document cost ~30 ms of a 9 s boot in its own handlers, measured at 1200 in the test instance)
  const lookFirst = (): void => {
    if (timed(() => !!document.querySelector("#slots .slot"))) paint(() => { firstSlotMs = performance.now(); });
    else if (performance.now() < 60_000) requestAnimationFrame(lookFirst);
  };
  requestAnimationFrame(lookFirst);
  // a click → the first change the DOM makes after it → the paint after that; nothing changed in 3 s,
  // nothing recorded. One observer per pending click, gone with its answer
  document.addEventListener("click", (ev) => timed(() => {
    const a = areaOf(ev.target);
    if (!a || clicks.length >= FIELD_CLICKS_MAX) return;
    const at = ev.timeStamp;
    const mo = new MutationObserver(() => timed(() => {
      mo.disconnect(); clearTimeout(stop);
      paint(() => { if (clicks.length < FIELD_CLICKS_MAX) clicks.push({ a, ms: Math.round(Math.max(0, performance.now() - at)) }); });
    }));
    const stop = setTimeout(() => mo.disconnect(), 3000);
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true });
  }), true);
  // the /api requests of the minute, by route shape: count and bytes as the browser fetched them
  if (typeof PerformanceObserver !== "undefined") new PerformanceObserver((list) => timed(() => {
    for (const e of list.getEntries() as PerformanceResourceTiming[]) {
      const r = routeOf(e.name);
      if (!r || (!(r in routes) && Object.keys(routes).length >= FIELD_ROUTES_MAX)) continue;
      const x = routes[r] ??= { n: 0, bytes: 0 };
      x.n++;
      x.bytes += e.transferSize || e.encodedBodySize || 0;
    }
  })).observe({ type: "resource", buffered: true });
  const flush = (): void => {
    const now = performance.now();
    if (!clicks.length && !Object.keys(routes).length && firstSent) { sent.at = now; return; }
    const row: FieldRow = {
      v: src.v(), sha: (() => { const s = src.sha(); return s && /^[0-9a-f]{7,40}$/.test(s) ? s : null; })(),
      dev: { w: Math.min(20_000, innerWidth), h: Math.min(20_000, innerHeight),
        touch: matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0, ua: uaClass() },
      pageMs: Math.round(now), windowMs: Math.round(now - sent.at),
      firstSlotMs: firstSent || firstSlotMs === null ? null : Math.round(firstSlotMs),
      clicks, routes, selfMs: Math.round(selfMs * 100) / 100,
    };
    if (!navigator.sendBeacon("/api/perf/field", new Blob([JSON.stringify(row)], { type: "application/json" }))) return;
    if (firstSlotMs !== null) firstSent = true;
    clicks = []; routes = {}; selfMs = 0; sent.at = now;
  };
  setInterval(flush, 60_000);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
}

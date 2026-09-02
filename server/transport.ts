import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./types";

// this module sits one level below the repo root, so every asset path is anchored explicitly
// rather than on import.meta.dir — the paths below are the same absolute strings as before.
const PUB = resolve(import.meta.dir, "..");

export const STATIC: Record<string, { path: string; type: string }> = {
  "/": { path: `${PUB}/public/index.html`, type: "text/html; charset=utf-8" },
  "/app.js": { path: `${PUB}/public/app.js`, type: "text/javascript" },
  "/share.js": { path: `${PUB}/public/share.js`, type: "text/javascript" },
  "/helper.js": { path: `${PUB}/public/helper.js`, type: "text/javascript" },
  "/xterm.css": { path: `${PUB}/node_modules/@xterm/xterm/css/xterm.css`, type: "text/css" },
  "/manifest.webmanifest": { path: `${PUB}/public/manifest.webmanifest`, type: "application/manifest+json" },
  "/icon.svg": { path: `${PUB}/public/icon.svg`, type: "image/svg+xml" },
  "/icon-180.png": { path: `${PUB}/public/icon-180.png`, type: "image/png" },
};

export function bundleV(): number {
  try {
    return Math.trunc(statSync(`${PUB}/public/app.js`).mtimeMs);
  } catch {
    return 0;
  }
}

// --- TRANSPORT: compression and the byte ledger. ---------------------------------------------
// Both live here because both wrap the SAME three places that actually put bytes on the wire —
// every JSON answer, the static assets, and ws.send. Split apart they would touch each of those
// three paths twice, for one effect each.
//
// The ledger answers exactly one question: since boot, which peer received how many bytes over
// which path. It attributes nothing and explains nothing — a row is what was sent, never why.
// Read it through GET /api/transport, deliberately its own route (see there).
interface TransportPeer {
  addr: string;
  httpBytes: number;      // response bodies as actually written, i.e. gzipped size where gzipped
  httpRequests: number;
  gzipSaved: number;      // identity size minus wire size, on the responses that were gzipped
  // ws.send payload bytes BEFORE per-message deflate. The wire figure is smaller by whatever
  // deflate achieved on that socket, and Bun does not report that back — so this number is a
  // ceiling for WS traffic, never "bytes on the wire".
  wsBytes: number;
  wsMessages: number;
  wsConnections: number;
  first: number;
  last: number;
}
const MAX_TRANSPORT_PEERS = 64;  // bounded: a peer map is keyed by remote address, i.e. by input
const MAX_TRANSPORT_PATHS = 120; // bounded the same way — anything past the cap lands in "other"
export const transportSince = Date.now();
export const transportPeers = new Map<string, TransportPeer>();
export const transportPaths = new Map<string, { requests: number; bytes: number }>();

function transportPeer(addr: string): TransportPeer {
  const key = addr || "unknown";
  const hit = transportPeers.get(key);
  if (hit) return hit;
  if (transportPeers.size >= MAX_TRANSPORT_PEERS) {
    // evict the least recently seen — a live socket's closure keeps counting into the dropped
    // row, so its bytes simply stop showing up. Bounded memory beats a complete ledger here.
    let oldest: TransportPeer | null = null;
    for (const p of transportPeers.values()) if (!oldest || p.last < oldest.last) oldest = p;
    if (oldest) transportPeers.delete(oldest.addr);
  }
  const now = Date.now();
  const fresh: TransportPeer = {
    addr: key, httpBytes: 0, httpRequests: 0, gzipSaved: 0,
    wsBytes: 0, wsMessages: 0, wsConnections: 0, first: now, last: now,
  };
  transportPeers.set(key, fresh);
  return fresh;
}

// slot ids, share ids and worktree names would make the path map unbounded — bucket them
const transportPathKey = (p: string): string =>
  p.replace(/\/\d+(?=\/|$)/g, "/:n").replace(/\/(s|ws-share)\/[a-z0-9]+/g, "/$1/:id").slice(0, 80);

function countHttp(addr: string, path: string, bytes: number, saved: number): void {
  const p = transportPeer(addr);
  p.httpRequests++;
  p.httpBytes += bytes;
  p.gzipSaved += saved;
  p.last = Date.now();
  const seen = transportPathKey(path);
  const key = transportPaths.has(seen) || transportPaths.size < MAX_TRANSPORT_PATHS ? seen : "other";
  const row = transportPaths.get(key) ?? { requests: 0, bytes: 0 };
  row.requests++;
  row.bytes += bytes;
  transportPaths.set(key, row);
}

// Wrapping send per socket is the only place that sees BOTH halves of what a client gets: the
// reconnect seed (up to REPLAY_TAIL bytes, sent from the open handler) and the live broadcast.
// It is also where per-message deflate is actually switched ON: `perMessageDeflate: true` in the
// websocket config only NEGOTIATES the extension — Bun's send() defaults `compress` to false, so
// without this the handshake advertises deflate and every frame still goes out raw: the same
// 27 314 payload bytes measured 27 656 wire bytes before this line and 1 546 after.
// No size threshold: frames here are never keystroke-sized, because poll() batches a pane's
// output per tick. The smallest real traffic measured (5 frames, 287 B total, one `printf x` per
// second) still went 299 → 114 wire bytes compressed, so a floor would only forfeit that win.
export function transportWs(ws: ServerWebSocket<WSData>): void {
  const p = transportPeer(ws.remoteAddress);
  p.wsConnections++;
  p.last = Date.now();
  const send = ws.send.bind(ws);
  ws.send = ((data: string | ArrayBufferView | ArrayBuffer, compress?: boolean) => {
    const n = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
    p.wsBytes += n;
    p.wsMessages++;
    p.last = Date.now();
    return send(data as Parameters<typeof send>[0], compress ?? true);
  }) as ServerWebSocket<WSData>["send"];
}

const COMPRESSIBLE = /^(?:text\/|application\/(?:json|javascript|manifest\+json)|image\/svg\+xml)/;
// below this the saving is a few dozen bytes — not worth compressing on every small answer
const GZIP_MIN_BYTES = 1024;

function wantsGzip(req: Request): boolean {
  for (const part of (req.headers.get("accept-encoding") ?? "").split(",")) {
    const [tok, ...params] = part.trim().toLowerCase().split(";");
    if (tok !== "gzip" && tok !== "*") continue;
    return !params.some((q) => q.replaceAll(" ", "") === "q=0");
  }
  return false;
}

// The single exit every HTTP response passes through (see the fetch handler): it compresses what
// is worth compressing and records what went out. It never sees a WebSocket upgrade — that path
// returns undefined and is handed straight back.
export async function finishHttp(req: Request, addr: string, res: Response | undefined): Promise<Response | undefined> {
  if (!res) return res;
  const path = new URL(req.url).pathname;
  // Two kinds of response are already settled: one that carries its own encoding or its own
  // content-length has been accounted for by the handler that built it (the bundle path below
  // serves a pre-gzipped, pre-measured buffer), and one without a body has nothing to count.
  const declared = res.headers.get("content-length");
  if (res.headers.get("content-encoding") || declared !== null || !res.body) {
    countHttp(addr, path, Number(declared ?? 0), 0);
    return res;
  }
  const type = res.headers.get("content-type") ?? "";
  const raw: Uint8Array<ArrayBuffer> = new Uint8Array(await res.arrayBuffer());
  const headers = new Headers(res.headers);
  if (!COMPRESSIBLE.test(type)) {
    countHttp(addr, path, raw.byteLength, 0);
    return new Response(raw, { status: res.status, statusText: res.statusText, headers });
  }
  headers.set("vary", "accept-encoding"); // set whether or not we compress: a cache must not
                                          // hand one client's variant to the other kind
  if (raw.byteLength < GZIP_MIN_BYTES || !wantsGzip(req)) {
    countHttp(addr, path, raw.byteLength, 0);
    return new Response(raw, { status: res.status, statusText: res.statusText, headers });
  }
  const gz = Bun.gzipSync(raw);
  headers.set("content-encoding", "gzip");
  countHttp(addr, path, gz.byteLength, raw.byteLength - gz.byteLength);
  return new Response(gz, { status: res.status, statusText: res.statusText, headers });
}

// app.js is ~590 KB and was served `no-store`, i.e. paid in full on every single page load. It
// can be cached forever instead — but only because a new bundle is GUARANTEED to be fetched:
// index.html stays `no-store`, and the <script src> it hands out carries ?v=<the bundle's mtime>,
// the same number /api/sessions reports as `v` and the client already reloads itself on. New
// bundle → new mtime → new URL → cache miss. A request whose ?v does not match the bundle on disk
// gets the current bytes with `no-store`, so a stale URL can never pin a client to a stale bundle.
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
interface BundleBytes { mtime: number; raw: Uint8Array<ArrayBuffer>; gz: Uint8Array<ArrayBuffer> }
const bundleCache = new Map<string, BundleBytes>();

async function bundleBytes(path: string): Promise<BundleBytes | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let mtime: number;
    try {
      mtime = Math.trunc(statSync(path).mtimeMs);
    } catch {
      return null; // never built
    }
    const hit = bundleCache.get(path);
    if (hit && hit.mtime === mtime) return hit;
    const raw = new Uint8Array(await Bun.file(path).arrayBuffer());
    // a build writing this file WHILE we read it would otherwise get a truncated bundle cached
    // until the next build — the one failure mode that is worse than the traffic being saved
    if (Math.trunc(statSync(path).mtimeMs) !== mtime) continue;
    const entry: BundleBytes = { mtime, raw, gz: Bun.gzipSync(raw) };
    bundleCache.set(path, entry);
    return entry;
  }
  return null;
}

export async function staticResponse(req: Request, url: URL, st: { path: string; type: string }): Promise<Response> {
  if (url.pathname === "/") {
    const html = (await Bun.file(st.path).text()).replace('src="/app.js"', `src="/app.js?v=${bundleV()}"`);
    return new Response(html, { headers: { "content-type": st.type, "cache-control": "no-store" } });
  }
  if (url.pathname === "/app.js" || url.pathname === "/share.js" || url.pathname === "/helper.js") {
    const b = await bundleBytes(st.path);
    if (!b) return new Response("bundle not built", { status: 404 });
    // only app.js gets the immutable cache: index.html is the only page whose script URL we
    // version. share.html is the public surface and helper.html is opened by hand on another
    // machine — both keep the unchanged no-store behaviour, so a redeploy is never one stale
    // bundle away from a portal that cannot claim
    const versioned = url.pathname === "/app.js" && url.searchParams.get("v") === String(b.mtime);
    const gz = wantsGzip(req);
    const body = gz ? b.gz : b.raw;
    return new Response(body, {
      headers: {
        "content-type": st.type,
        "cache-control": versioned ? IMMUTABLE_CACHE : "no-store",
        "content-length": String(body.byteLength),
        vary: "accept-encoding",
        ...(gz ? { "content-encoding": "gzip" } : {}),
      },
    });
  }
  return new Response(Bun.file(st.path), { headers: { "content-type": st.type, "cache-control": "no-store" } });
}

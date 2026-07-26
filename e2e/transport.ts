// The three send paths (JSON answers, static assets, ws.send): gzip, the app.js cache-buster
// chain, and the byte ledger behind GET /api/transport. See server.ts, the TRANSPORT region.
//
// public/app.js is a gitignored BUILD artifact, so this module never assumes one is present or
// that it holds any particular bytes: it writes its own bundle fixture into the throwaway copy
// of the tree this suite runs from ($DIR, see e2e-isolated.sh) and restores whatever was there
// when it is done. That also makes the "a new bundle reaches the client" check a real swap
// rather than a claim about a file nobody touched.
import { writeFileSync, readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { BASE, IP, ROOT, TOKEN, check, get, wsUrl } from "./harness";

interface Ledger {
  totals: { httpBytes: number; httpRequests: number; gzipSaved: number; wsBytes: number; wsMessages: number; wsConnections: number; wsOpen: number };
  byPeer: { addr: string; httpBytes: number; wsBytes: number }[];
  byPath: { path: string; requests: number; bytes: number }[];
}
const ledger = async (): Promise<Ledger> => (await (await get("/api/transport")).json()) as Ledger;

// a bundle fixture that is (a) far past the gzip floor and (b) genuinely compressible
const fixture = (tag: string): string =>
  `// fleet e2e bundle fixture ${tag}\n` + `console.log(${JSON.stringify(tag)});\n`.repeat(400);

const scriptSrc = (html: string): string => /<script src="([^"]+)"><\/script>/.exec(html)?.[1] ?? "";
const bytes = async (r: Response): Promise<Buffer> => Buffer.from(new Uint8Array(await r.arrayBuffer()));

export async function run(): Promise<void> {
  const appJs = `${ROOT}/public/app.js`;
  const original = existsSync(appJs) ? readFileSync(appJs) : null;
  try {
    writeFileSync(appJs, fixture("v1"));
    const onDisk = (): Buffer => readFileSync(appJs);

    // --- static assets: gzip on demand, identical bytes either way ---
    const src = scriptSrc(await (await fetch(BASE + "/")).text());
    check("index.html hands out a versioned app.js URL (the cache-buster)",
      src === `/app.js?v=${Math.trunc(statSync(appJs).mtimeMs)}`, src);

    const gz = await fetch(BASE + src, { headers: { "accept-encoding": "gzip" } });
    const gzLen = Number(gz.headers.get("content-length"));
    // Bun's fetch inflates transparently, so this body is the DECODED one — it must equal the file
    const gzBody = await bytes(gz);
    check("app.js is served gzipped when the client accepts it",
      gz.headers.get("content-encoding") === "gzip" && gz.headers.get("vary") === "accept-encoding",
      `${gz.headers.get("content-encoding")} / ${gz.headers.get("vary")}`);
    check("the gzipped bundle decodes to exactly the bytes on disk",
      gzBody.equals(onDisk()), `${gzBody.byteLength} vs ${statSync(appJs).size}`);
    check("gzip actually shrinks the bundle on the wire",
      gzLen > 0 && gzLen < statSync(appJs).size / 2, `${gzLen} of ${statSync(appJs).size} B`);

    const id = await fetch(BASE + src, { headers: { "accept-encoding": "identity" } });
    const idBody = await bytes(id);
    check("without accept-encoding: gzip the bundle still arrives uncompressed and correct",
      id.headers.get("content-encoding") === null && idBody.equals(onDisk()),
      `${id.headers.get("content-encoding")} / ${idBody.byteLength} B`);
    check("a versioned app.js URL may be cached forever",
      (id.headers.get("cache-control") ?? "").includes("immutable"), id.headers.get("cache-control") ?? "");
    // the whole immutable claim rests on this: a WRONG version must never be cacheable, and it
    // must still answer with the CURRENT bundle rather than a stale one
    const wrongV = await fetch(BASE + "/app.js?v=1");
    check("an app.js URL with a stale ?v is served no-store, with the current bytes",
      wrongV.headers.get("cache-control") === "no-store" && (await bytes(wrongV)).equals(onDisk()),
      wrongV.headers.get("cache-control") ?? "");
    check("index.html itself is never cached — it is what hands out the version",
      (await fetch(BASE + "/")).headers.get("cache-control") === "no-store");

    // --- a NEW bundle reaches a client: swap the file, the version moves, the URL moves ---
    await Bun.sleep(1100); // mtime resolution: a rewrite in the same second must still be a new v
    writeFileSync(appJs, fixture("v2"));
    const src2 = scriptSrc(await (await fetch(BASE + "/")).text());
    check("a rebuilt bundle changes the URL index.html hands out",
      src2 !== src && /^\/app\.js\?v=\d+$/.test(src2), `${src} → ${src2}`);
    const swapped = (await bytes(await fetch(BASE + src2, { headers: { "accept-encoding": "gzip" } }))).toString();
    check("the new URL serves the NEW bundle (no cache entry survives the swap)",
      swapped.includes("fixture v2") && !swapped.includes("fixture v1"), swapped.slice(0, 40));
    const vSeen = ((await (await get("/api/sessions")).json()) as { v: number }).v;
    check("the version the client polls for (/api/sessions .v) is the one in the script URL",
      src2 === `/app.js?v=${vSeen}`, `${src2} vs v=${vSeen}`);

    // --- JSON answers ---
    // the rule, not one endpoint's size: over the floor it is compressed, under it it is not
    const sessId = await fetch(BASE + "/api/sessions", { headers: { authorization: `Bearer ${TOKEN}`, "accept-encoding": "identity" } });
    const sessLen = (await bytes(sessId)).byteLength;
    const sessGz = await fetch(BASE + "/api/sessions", { headers: { authorization: `Bearer ${TOKEN}`, "accept-encoding": "gzip" } });
    const sessBody = (await sessGz.json()) as { slots: unknown[] };
    check("a JSON answer over the gzip floor is compressed, and still parses",
      (sessGz.headers.get("content-encoding") === "gzip") === sessLen >= 1024 && Array.isArray(sessBody.slots),
      `${sessLen} B identity → ${sessGz.headers.get("content-encoding") ?? "identity"}`);
    check("a JSON answer under the floor is left alone (header overhead would exceed the win)",
      (await get("/api/slots/99/history")).headers.get("content-encoding") === null);
    check("a client that does not accept gzip gets plain JSON", sessId.headers.get("content-encoding") === null);
    check("gzip is refused when the client explicitly weights it out (gzip;q=0)",
      (await fetch(BASE + "/api/sessions", { headers: { authorization: `Bearer ${TOKEN}`, "accept-encoding": "gzip;q=0" } }))
        .headers.get("content-encoding") === null);

    // --- the byte ledger: it must count what actually went out, not an estimate ---
    const before = await ledger();
    const plain = await fetch(BASE + "/app.js", { headers: { "accept-encoding": "identity" } });
    const plainLen = (await bytes(plain)).byteLength;
    const after = await ledger();
    check("the ledger counts a known-size HTTP response exactly",
      after.totals.httpBytes - before.totals.httpBytes >= plainLen && plainLen === statSync(appJs).size,
      `Δ${after.totals.httpBytes - before.totals.httpBytes} for a ${plainLen} B body`);
    check("the ledger attributes bytes per path",
      (after.byPath.find((p) => p.path === "/app.js")?.bytes ?? 0) >= plainLen);
    check("the ledger attributes bytes per peer",
      after.byPeer.some((p) => p.addr === IP && p.httpBytes >= plainLen));
    check("the ledger reports the compression it achieved", after.totals.gzipSaved > 0);
    check("the ledger lives on its OWN route, never inside /api/sessions",
      !Object.keys((await (await get("/api/sessions")).json()) as object).some((k) => /transport|bytes/i.test(k)));
    check("the ledger is owner-only", (await fetch(BASE + "/api/transport")).status === 401);

    // --- ws.send: what a real socket receives must equal what the ledger says was sent ---
    const wsBefore = await ledger();
    const seed = await new Promise<number>((resolve) => {
      const w = new WebSocket(wsUrl(1));
      let got = 0;
      w.onmessage = (e) => { got += (e.data as ArrayBuffer).byteLength; };
      setTimeout(() => { w.close(); resolve(got); }, 2500);
    });
    await Bun.sleep(300); // let a late frame land before the ledger is read
    const wsAfter = await ledger();
    const counted = wsAfter.totals.wsBytes - wsBefore.totals.wsBytes;
    // equality is also the deflate check: a mangled frame would fail the client's inflate and
    // never reach onmessage, so the two numbers could not agree
    check("the ledger counts exactly the bytes a real socket received, deflate and all",
      seed > 0 && counted === seed, `ledger ${counted} vs received ${seed}`);
    check("the ledger counts the connection",
      wsAfter.totals.wsConnections - wsBefore.totals.wsConnections >= 1);
  } finally {
    // hand the tree back exactly as found — the suite's later checks (and a human poking at the
    // instance kept after a failure) must not inherit a fixture bundle
    if (original) writeFileSync(appJs, original);
    else if (existsSync(appJs)) unlinkSync(appJs);
  }
}

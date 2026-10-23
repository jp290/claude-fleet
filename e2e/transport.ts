import { PERF_ROTATE_BYTES, type FieldRow, type PerfRecord } from "../src/protocol";
// The three send paths (JSON answers, static assets, ws.send): gzip, the app.js cache-buster
// chain, and the byte ledger behind GET /api/transport. See server/transport.ts.
//
// public/app.js is a gitignored BUILD artifact, so this module never assumes one is present or
// that it holds any particular bytes: it writes its own bundle fixture into the throwaway copy
// of the tree this suite runs from ($DIR, see e2e-isolated.sh) and restores whatever was there
// when it is done. That also makes the "a new bundle reaches the client" check a real swap
// rather than a claim about a file nobody touched.
import { writeFileSync, readFileSync, existsSync, unlinkSync, statSync } from "node:fs";
import { BASE, IP, ROOT, TOKEN, REPO, check, get, paneEnv, post, wsUrl, ownerWs } from "./harness";

interface Ledger {
  totals: { httpBytes: number; httpRequests: number; gzipSaved: number; wsBytes: number; wsMessages: number; wsConnections: number; wsOpen: number };
  byPeer: { addr: string; httpBytes: number; wsBytes: number }[];
  byPath: { path: string; requests: number; bytes: number }[];
}
const ledger = async (): Promise<Ledger> => (await (await get("/api/transport")).json()) as Ledger;

// a bundle fixture that is (a) far past the gzip floor and (b) genuinely compressible
const fixture = (tag: string): string =>
  `// fleet e2e bundle fixture ${tag}\n` + `console.log(${JSON.stringify(tag)});\n`.repeat(400);

const scriptSrc = (html: string): string => /<script(?: type="module")? src="([^"]+)"><\/script>/.exec(html)?.[1] ?? "";
const bytes = async (r: Response): Promise<Buffer> => Buffer.from(new Uint8Array(await r.arrayBuffer()));

export async function run(): Promise<void> {
  await runPerfTransport();
  const appJs = `${ROOT}/public/app.js`;
  let original: Buffer | null | undefined;
  let originalError = "";
  try { original = existsSync(appJs) ? readFileSync(appJs) : null; }
  catch (e) { originalError = e instanceof Error ? e.message : String(e); }
  check("precondition: an existing app.js is readable before the transport fixture replaces it",
    original !== undefined, originalError);
  if (original === undefined) return;
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
      const w = ownerWs(wsUrl(1));
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


interface PerfReport {
  n: number;
  hidden: number;
  records: (PerfRecord & { at: number })[];
  groups: { j: string; dev: string; v: number; n: number; failed: number; hidden: number; p50: number | null; p75: number | null; p95: number | null }[];
}
export async function runPerfTransport(): Promise<void> {
  const headers = { cookie: `fleet=${TOKEN}`, "content-type": "application/json" };
  const perfPost = (body: unknown, h: HeadersInit = headers): Promise<Response> => fetch(BASE + "/api/perf", { method: "POST", headers: h, body: JSON.stringify(body) });
  const perfRead = async (q = ""): Promise<PerfReport> => (await (await fetch(BASE + "/api/perf" + q, { headers })).json()) as PerfReport;
  const row = (ms: number): PerfRecord => ({ j: "J1", ms, clientMs: ms, serverMs: 0, netMs: 0,
    dev: "desktop", saver: false, v: 424242, slots: 16, ok: true });
  const files = [`${ROOT}/perf.jsonl`, `${ROOT}/perf.jsonl.1`];
  const before = files.map((f) => existsSync(f) ? readFileSync(f) : null);
  try {
    for (const f of files) if (existsSync(f)) unlinkSync(f);
    const empty = await perfRead();
    check("perf: an empty ledger has n=0 and no manufactured zero latency", empty.n === 0 && empty.groups.length === 0 && empty.records.length === 0, JSON.stringify(empty));
    const noCookie = await perfPost([row(1)], { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" });
    check("perf: Owner bearer without Owner cookie cannot submit telemetry", noCookie.status === 403, `${noCookie.status}`);
    check("perf: Owner bearer without Owner cookie cannot read telemetry",
      (await fetch(BASE + "/api/perf", { headers: { authorization: `Bearer ${TOKEN}` } })).status === 403);
    check("perf: anonymous telemetry is refused", (await fetch(BASE + "/api/perf", { method: "POST", body: "[]" })).status === 401);
    check("perf: a foreign Origin with an Owner cookie is refused",
      !(await perfPost([row(1)], { ...headers, origin: "https://example.invalid" })).ok);
    const bad = await perfPost([row(1), { ...row(2), token: "must-never-be-stored" }]);
    check("perf: unknown content fields reject the whole batch", bad.status === 400 && (await perfRead()).n === 0, `${bad.status}`);
    check("perf: failed rows with fabricated zero latency are refused", (await perfPost([{ ...row(0), ok: false }])).status === 400);
    check("perf: non-enum journey values are refused", (await perfPost([{ ...row(1), j: ["J1"] }])).status === 400);
    check("perf: a client-chosen timestamp is refused", (await perfPost([{ ...row(1), at: 1 }])).status === 400);
    check("perf: a non-boolean background marker is refused", (await perfPost([{ ...row(1), attrs: { hidden: "yes" } }])).status === 400);
    check("perf: free-form failure reasons are refused", (await perfPost([{ ...row(1), attrs: { reason: "/private/path" } }])).status === 400);
    check("perf: more than fifty records are refused", (await perfPost(Array.from({ length: 51 }, () => row(1)))).status === 400);
    check("perf: a body above the byte cap is refused", (await fetch(BASE + "/api/perf", { method: "POST", headers, body: " ".repeat(64001) })).status === 413);
    const synthetic = Array.from({ length: 20 }, (_, i) => row(20 - i));
    check("perf: an Owner cookie appends twenty records", (await perfPost(synthetic)).ok);
    const report = await perfRead();
    const g = report.groups[0];
    check("perf: twenty values 1..20 have nearest-rank p50=10,p75=15,p95=19", report.n === 20 && g?.n === 20 && g.p50 === 10 && g.p75 === 15 && g.p95 === 19, JSON.stringify(g));
    check("perf: ledger timestamps are server-owned", report.records.every((r) => Number.isFinite(r.at) && r.at > 0));
    await perfPost([{ ...row(9999), attrs: { hidden: true } }]);
    const background = await perfRead();
    const bg = background.groups[0];
    check("perf: background rows remain visible but cannot inflate default percentiles", background.n === 21 && background.hidden === 1 && background.records.at(-1)?.attrs?.hidden === true && bg?.hidden === 1 && bg.n === 20 && bg.p50 === 10 && bg.p75 === 15 && bg.p95 === 19, JSON.stringify(bg));
    const fail: PerfRecord = { ...row(0), j: "J2", ok: false, ms: null, clientMs: null, serverMs: null, netMs: null };
    await perfPost([fail, { ...row(31), dev: "mobile" }, { ...row(41), v: 424243 }]);
    const grouped = await perfRead();
    check("perf: journey, device and build each partition the distribution", grouped.groups.length === 4 && grouped.groups.find((x) => x.dev === "mobile")?.p75 === 31 && grouped.groups.find((x) => x.v === 424243)?.p75 === 41, JSON.stringify(grouped.groups));
    const fg = grouped.groups.find((x) => x.j === "J2");
    check("perf: failures count separately with null percentiles", fg?.n === 0 && fg.failed === 1 && fg.p50 === null && fg.p75 === null && fg.p95 === null, JSON.stringify(fg));
    const future = await perfRead(`?since=${Date.now() + 60000}&until=${Date.now() + 120000}`);
    check("perf: an empty time window has n=0", future.n === 0 && future.groups.length === 0 && future.records.length === 0);
    check("perf: an invalid time window is refused", (await fetch(BASE + "/api/perf?since=2&until=1", { headers })).status === 400);
    writeFileSync(files[0], "\n".repeat(PERF_ROTATE_BYTES));
    await perfPost([row(91)]);
    check("perf: rotation caps the active file and its one retained generation", statSync(files[0]).size < PERF_ROTATE_BYTES && statSync(files[1]).size === PERF_ROTATE_BYTES, JSON.stringify(files.map((f) => statSync(f).size)));
    writeFileSync(files[0], "\n".repeat(PERF_ROTATE_BYTES));
    await perfPost([row(92)]);
    const rotated = await perfRead();
    check("perf: the next rotation replaces the old generation without an archive", rotated.n === 1 && rotated.records[0]?.ms === 92 && !existsSync(`${files[0]}.archive`), JSON.stringify(rotated.groups));
    check("perf: active ledger permissions are private", (statSync(files[0]).mode & 0o777) === 0o600);
  } finally {
    for (const [i, f] of files.entries()) { if (before[i]) writeFileSync(f, before[i]!); else if (existsSync(f)) unlinkSync(f); }
  }
  const sessions = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] };
  const id = sessions.slots.find((s) => !s.cwd)?.id;
  check("perf timing: an unused scratch slot is available", id !== undefined);
  if (id === undefined) return;
  await post(`/api/slots/${id}/open`, { cwd: REPO });
  try {
    // THE BOARD'S FIELD ROWS (src/fieldperf.ts): the owner's page writes them with its cookie and only the
    // owner reads them back — numbers only, the server's own time; a self-token has no door to them
    const fieldFiles = [`${ROOT}/field-perf.jsonl`, `${ROOT}/field-perf.jsonl.1`];
    const fieldBefore = fieldFiles.map((f) => existsSync(f) ? readFileSync(f) : null);
    try {
      for (const f of fieldFiles) if (existsSync(f)) unlinkSync(f);
      const field: FieldRow = { v: 424242, sha: "0123abc", dev: { w: 390, h: 844, touch: true, ua: "safari-ios" }, pageMs: 61_000,
        windowMs: 60_000, firstSlotMs: 412, clicks: [{ a: "side", ms: 38 }, { a: "board", ms: 120 }, { a: "queue", ms: 64 }],
        routes: { "/api/sessions": { n: 30, bytes: 2_445_000 }, "/api/slots/:n/brief": { n: 20, bytes: 61_000 } }, selfMs: 0.8 };
      const fieldPost = (body: unknown, h: HeadersInit = headers): Promise<Response> => fetch(BASE + "/api/perf/field", { method: "POST", headers: h, body: JSON.stringify(body) });
      const selfTok = await paneEnv(`s${id}`, "FLEET_SELF_TOKEN") ?? "";
      const fieldRead = (h: HeadersInit = headers): Promise<Response> => fetch(BASE + "/api/perf/field?limit=5", { headers: h });
      check("field: the scratch session carries a self-token to try the read with", selfTok.length > 0);
      check("field: anonymous rows are refused", (await fetch(BASE + "/api/perf/field", { method: "POST", body: "{}" })).status === 401);
      check("field: an owner bearer without the owner cookie cannot write a row",
        (await fieldPost(field, { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" })).status === 403);
      check("field: a row with a field beyond the numbers is refused and nothing is kept",
        (await fieldPost({ ...field, token: "must-never-be-stored" })).status === 400 && !existsSync(fieldFiles[0]));
      check("field: a route that is not a route shape is refused",
        (await fieldPost({ ...field, routes: { "/api/files/Users/Owner/notes.md": { n: 1, bytes: 1 } } })).status === 400);
      check("field: a click outside the three areas is refused", (await fieldPost({ ...field, clicks: [{ a: "terminal", ms: 5 }] })).status === 400);
      check("field: the owner cookie appends a valid row", (await fieldPost(field)).ok);
      const read = await fieldRead();
      const got = read.ok ? (await read.json()) as { n: number; rows: (FieldRow & { at: number })[] } : null;
      const { at, ...rest } = got?.rows.at(-1) ?? { at: NaN };
      check("field: the owner reads the row back as written, with the server's time",
        got?.n === 1 && JSON.stringify(rest) === JSON.stringify(field) && Number.isFinite(at) && at > 0, JSON.stringify(got));
      check("field: a session's self-token cannot read the rows (no self route, the owner gate answers)",
        (await fieldRead({ "x-fleet-self-token": selfTok })).status === 401);
      check("field: the old self route is gone (the owner gate answers it like any unknown path)",
        (await fetch(BASE + "/api/self/field", { headers: { "x-fleet-self-token": selfTok } })).status === 401);
      check("field: the ledger is private", (statSync(fieldFiles[0]).mode & 0o777) === 0o600);
    } finally {
      for (const [i, f] of fieldFiles.entries()) { if (fieldBefore[i]) writeFileSync(f, fieldBefore[i]!); else if (existsSync(f)) unlinkSync(f); }
    }
    const responses: [string, Response][] = [
      ["sessions", await get("/api/sessions")],
      ["transcript", await get(`/api/slots/${id}/transcript?after=0`)],
      ["brief", await get(`/api/slots/${id}/brief`)],
      ["send", await post("/send", { slot: id, text: "perf timing fixture", submit: true })],
    ];
    for (const [name, res] of responses) {
      const timing = res.headers.get("server-timing") ?? "";
      const pieces = timing.split(/,\s*/);
      check(`perf timing: ${name} has only parseable, numeric timing metrics`, res.ok && pieces.every((p) => /^(total|queue|ready|paste|settle|arrival|submit|accept|cleanup);dur=\d+\.\d{3}$/.test(p)) && /^total;dur=/.test(timing), `${res.status} ${timing}`);
      if (name === "send") {
        const values = pieces.map((p) => Number(p.split("=")[1]));
        check("perf timing: send phase sum does not exceed total", values.length >= 7 && values.slice(1).reduce((a, b) => a + b, 0) <= values[0], timing);
      }
    }
    const refused = await post("/send", { slot: 99, text: "invalid target" });
    check("perf timing: a refused send retains its error status and carries total", refused.status === 400 && /^total;dur=\d+\.\d{3}$/.test(refused.headers.get("server-timing") ?? ""));
  } finally { await post(`/api/slots/${id}/kill`, {}); }
}

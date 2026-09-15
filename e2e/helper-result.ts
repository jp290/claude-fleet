import { loadConfig, report } from "../helper-daemon/daemon";
import { retryResult } from "../helper-daemon/result-retry";

export async function run(check: (name: string, ok: boolean, detail?: string) => void): Promise<void> {
  const requests: { path: string; token: string | null; body: string }[] = [];
  const accepted: string[] = [];
  let status = 503;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(req) {
    const body = await req.text();
    requests.push({ path: new URL(req.url).pathname, token: req.headers.get("x-fleet-helper-token"), body });
    if (status === 503 && requests.length === 1) return new Response("restarting", { status: 503 });
    if (status >= 400 && status !== 503) return Response.json({ error: "refused" }, { status });
    accepted.push(body);
    return Response.json({ result: "pass" });
  } });
  const cfg = loadConfig("fixture", { fleetUrl: server.url.toString(), token: "fixture-token",
    deviceId: "retrybox0001", name: "retry fixture", workDir: "/unused" }, 0o600);
  const job = { id: "abcdef123456", kind: "audit", repo: "fixture", mainSha: "abc", shard: "1/2" };
  try {
    await report(cfg, job, 0, "ALL PASS");
    check("(HD result) 503 then success makes exactly two requests", requests.length === 2, `requests=${requests.length}`);
    check("(HD result) the recovering server accepts exactly one result", accepted.length === 1, `accepted=${accepted.length}`);
    check("(HD result) retry preserves the exact payload", requests.length === 2 && requests[0].body === requests[1].body);
    check("(HD result) result payload and token header reach the result route",
      accepted[0] === JSON.stringify({ jobId: job.id, exitCode: 0, tail: "ALL PASS", fails: [] })
      && requests.every((r) => r.path === "/api/helper/result" && r.token === "fixture-token"));
    for (const code of [400, 409, 401]) {
      status = code;
      requests.length = 0;
      let rejected = false;
      try { await report(cfg, job, null, ""); } catch { rejected = true; }
      check(`(HD result) HTTP ${code} is never retried`, requests.length === 1, `requests=${requests.length}`);
      check(`(HD result) HTTP ${code} preserves auth-fault semantics`, rejected === (code === 401));
    }
    status = 200;
    requests.length = 0;
    await report(cfg, job, null, "");
    check("(HD result) first-attempt success needs one request", requests.length === 1, `requests=${requests.length}`);
  } finally { await server.stop(true); }

  // Clock is synthetic; the request boundary fails independently of the retry policy.
  // t (ms) | request | outcome: 0 fail, 5000 fail, 15000 fail, 35000 fail, 60000 fail.
  for (const kind of ["network", "5xx"] as const) {
    const delays: number[] = [], logs: string[] = [];
    let calls = 0, threw = false, finalStatus: number | undefined;
    try {
      finalStatus = (await retryResult(async () => {
        calls++;
        if (kind === "network") throw new TypeError("connection reset");
        return new Response(null, { status: 503 });
      }, (s) => logs.push(s), async (ms) => { delays.push(ms); })).status;
    } catch { threw = true; }
    check(`(HD result) persistent ${kind} stops after five attempts`, calls === 5, `calls=${calls}`);
    check(`(HD result) ${kind} backoff is bounded to 60 seconds`,
      JSON.stringify(delays) === "[5000,10000,20000,25000]", JSON.stringify(delays));
    check(`(HD result) every ${kind} failure is logged`, logs.length === 5
      && logs.every((s, i) => s.includes(`attempt ${i + 1}/5 failed:`)
        && s.includes(kind === "network" ? "connection reset" : "HTTP 503")), logs.join(" | "));
    check(`(HD result) exhausted ${kind} stays a failure`,
      kind === "network" ? threw : !threw && finalStatus === 503);
  }
  let calls = 0;
  const delays: number[] = [], logs: string[] = [];
  const recovered = await retryResult(async () => {
    if (++calls === 1) throw new TypeError("connection reset");
    return new Response(null, { status: 204 });
  }, (s) => logs.push(s), async (ms) => { delays.push(ms); });
  check("(HD result) transient network failure recovers", recovered.status === 204 && calls === 2, `calls=${calls}`);
  check("(HD result) network recovery waits once and logs its failure",
    JSON.stringify(delays) === "[5000]" && logs.length === 1 && logs[0].includes("connection reset"));
}

if (import.meta.main) {
  let failed = 0;
  await run((name, ok, detail = "") => {
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
  });
  console.log(failed ? `${failed} FAILURES` : "ALL PASS");
  process.exitCode = failed ? 1 : 0;
}

// The verify GATE made visible (briefs/verify-queue-2026-08-04.md): the machine-wide suite mutex
// projected onto /api/sessions, and the phase reports lanes volunteer through
// POST /api/self/verify-intent.
//
// Two halves, tested as two different KINDS of claim:
//
//  · The LOCK is a measurement. §1 checks it against the mutex this very suite is holding — the
//    wrapper's own /tmp/fleet-e2e.lock, read independently by this harness, so the assertion is
//    "server and filesystem agree", not "the server said something plausible". §2 then points the
//    server at a PRIVATE lock directory (FLEET_SUITE_LOCK, one srv restart) to drive the three
//    states the real lock cannot be made to have on demand without breaking serialization for
//    every other suite on this box: a dead holder, a hand-parked dir, and no lock at all. Touching
//    the real lock to test them would be the one thing this feature must never do.
//  · The REPORTS are hearsay, and the checks say so: what is asserted is that the server binds a
//    report to the TOKEN'S slot (never a `slot` field in the body), that a phase CHANGE reaches
//    audit.jsonl while an identical re-post does not, and that a report dies with its lane.
//
// Nothing here asserts that a suite ran. Nothing in the feature runs one.
import { mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, TOKEN, check, get, post, readText, restartSrv } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";
const REAL_LOCK = process.env.FLEET_SUITE_LOCK ?? "/tmp/fleet-e2e.lock"; // what e2e-stage.sh took
const OWN_LOCK = `${TMP}/fleet-e2e-gatelock-${process.pid}`; // never the real one — see the header

interface GateLock { pid: number | null; alive: boolean | null; heldMs: number; state: string }
interface GateReport { slot: number; label: string | null; phase: string; suite: string; exitCode: number | null; at: number }
interface Gate { lock: GateLock | null; reports: GateReport[] }

const gateOf = async (): Promise<Gate | null | undefined> =>
  ((await (await get("/api/sessions")).json()) as { gate?: Gate | null }).gate;

// audit.jsonl, both rotation generations, torn lines dropped rather than thrown on (a mid-append
// row would otherwise fail an unrelated check with a JSON parse error)
const auditRows = async (): Promise<{ event?: string; slot?: number; detail?: string }[]> =>
  ((await readText(`${ROOT}/audit.jsonl.1`)) + (await readText(`${ROOT}/audit.jsonl`)))
    .split("\n").filter(Boolean)
    .flatMap((l) => { try { return [JSON.parse(l) as { event?: string }]; } catch { return []; } });
const intentRows = async (slot: number): Promise<string[]> =>
  (await auditRows()).filter((r) => r.event === "verify_intent" && r.slot === slot).map((r) => r.detail ?? "");
// the audit write is fire-and-forget through the server's serializing chain, so the route can
// answer before the line is on disk. Poll for the count we expect; a timeout returns what it last
// saw, so a genuinely missing line fails its own check instead of hiding behind the retry.
async function intentRowsAtLeast(slot: number, n: number): Promise<string[]> {
  let rows = await intentRows(slot);
  for (let i = 0; i < 60 && rows.length < n; i++) {
    await Bun.sleep(50);
    rows = await intentRows(slot);
  }
  return rows;
}

const selfPost = (token: string | undefined, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/verify-intent`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token !== undefined ? { "x-fleet-self-token": token } : {}) },
    body: JSON.stringify(body),
  });

// same race as security.ts's selfTokenOf: openSlot mints the credential and queues saveState
// BEFORE it awaits the pane spawn, so the route can answer a hair before the file carries it
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string }> };
    seen = st.slots?.[String(slot)]?.selfToken ?? "";
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

export async function run(): Promise<void> {
  // ===== §1 the REAL mutex: does the projection agree with the disk? =====
  // This suite is holding it right now — e2e-stage.sh takes the lock when a wrapper sources it,
  // and records the wrapper's pid. The wrapper is this process's parent (the harness is launched
  // from it with `eval`, which does not fork), so the holder's identity is independently known
  // here and does not have to be taken from the answer under test.
  {
    const g = await gateOf();
    const diskPid = ((): number | null => {
      try {
        const raw = readFileSync(`${REAL_LOCK}/pid`, "utf8").trim();
        return /^\d+$/.test(raw) ? Number(raw) : null;
      } catch { return null; }
    })();
    check("§1 /api/sessions names the same suite-mutex holder the filesystem does",
      !!g && !!g.lock && g.lock.pid === diskPid && diskPid !== null,
      `server=${JSON.stringify(g?.lock)} disk=${diskPid}`);
    check("§1 that holder is this run's own wrapper, and it is reported alive",
      g?.lock?.pid === process.ppid && g.lock.alive === true,
      `lock=${JSON.stringify(g?.lock)} ppid=${process.ppid}`);
    check("§1 the hold duration is a real elapsed time, not a placeholder",
      (g?.lock?.heldMs ?? -1) > 0, String(g?.lock?.heldMs));
    check("§1 no lane has reported a phase yet, so the gate carries an empty report list",
      Array.isArray(g?.reports) && g.reports.length === 0, JSON.stringify(g?.reports));
  }

  // ===== §2 the lock states, against a PRIVATE lock dir =====
  rmSync(OWN_LOCK, { recursive: true, force: true });
  await restartSrv({ FLEET_SUITE_LOCK: OWN_LOCK });
  {
    check("§2 no lock dir at all → the gate is absent entirely (no shape on the 2s poll)",
      (await gateOf()) == null, JSON.stringify(await gateOf()));

    // a holder that is unquestionably alive: this harness
    mkdirSync(OWN_LOCK, { recursive: true });
    writeFileSync(`${OWN_LOCK}/pid`, `${process.pid}\n`);
    await Bun.sleep(1100); // so the held-duration assertion below measures something real
    const live = (await gateOf())?.lock;
    check("§2 a live holder is named and reported alive",
      live?.pid === process.pid && live.alive === true, JSON.stringify(live));
    check("§2 the hold duration is measured from the claim, not from the request",
      (live?.heldMs ?? 0) >= 1000, String(live?.heldMs));
    check("§2 a live holder inside the normal window is `held` — a suite is running",
      live?.state === "held", JSON.stringify(live));

    // OVERDUE: the same live holder, backdated past SUITE_HOLD_OVERDUE_MS. The server reads the
    // claim time off the pid file's mtime, so moving that mtime IS the passage of time here — no
    // sleep, and no threshold constant duplicated into the test. 25 min is past the 20 min cap.
    const backdated = new Date(Date.now() - 25 * 60_000);
    utimesSync(`${OWN_LOCK}/pid`, backdated, backdated);
    const over = (await gateOf())?.lock;
    check("§2 a live holder past the overdue cap is `overdue` — still alive, no longer normal",
      over?.state === "overdue" && over.alive === true && over.pid === process.pid, JSON.stringify(over));
    check("§2 overdue is the ONLY warning state: it is reached by TIME, on a holder that is alive",
      over?.heldMs !== undefined && over.heldMs > 20 * 60_000, String(over?.heldMs));
    // and back, so the checks below start from an unaged claim
    const nowStamp = new Date();
    utimesSync(`${OWN_LOCK}/pid`, nowStamp, nowStamp);

    // a holder that is gone. spawnSync has already reaped this child, so the pid is dead by the
    // time it is written — asserted here rather than assumed, because a recycled pid would turn
    // this into a check about a live process without saying so.
    const gone = spawnSync("/bin/sh", ["-c", "exit 0"]).pid ?? 0;
    let goneIsDead = false;
    try { process.kill(gone, 0); } catch { goneIsDead = true; }
    check("§2 fixture: a pid that is genuinely no longer running", goneIsDead && gone > 0, String(gone));
    writeFileSync(`${OWN_LOCK}/pid`, `${gone}\n`);
    const dead = (await gateOf())?.lock;
    check("§2 a dead holder is named AND flagged dead — the next suite reaps this dir",
      dead?.pid === gone && dead.alive === false, JSON.stringify(dead));
    // THE RESTING STATE OF AN IDLE MACHINE, and the reason this state exists: release is implicit
    // (e2e-stage.sh:38), so every finished suite leaves this behind. Measured 2026-08-04: 18 min
    // of it on a quiet machine. It must never be the same class as `overdue`, which is a fault.
    check("§2 a dead holder is `stale`, NOT a warning — nothing is running and nothing is wrong",
      dead?.state === "stale", JSON.stringify(dead));

    // pid 0 addresses the caller's own process group, so a naive liveness probe answers "alive"
    // about the server itself and reports a lock nobody holds as held
    writeFileSync(`${OWN_LOCK}/pid`, "0\n");
    const zero = (await gateOf())?.lock;
    check("§2 a pid file containing 0 is unreadable content, never a live holder",
      zero?.pid === null && zero.alive === false, JSON.stringify(zero));
    writeFileSync(`${OWN_LOCK}/pid`, "not-a-pid\n");
    const junk = (await gateOf())?.lock;
    check("§2 a garbage pid file reads as a lost holder, not as a hand-parked lock",
      junk?.pid === null && junk.alive === false, JSON.stringify(junk));
    check("§2 an unreadable pid file is `stale` too — same meaning, and never a park",
      zero?.state === "stale" && junk?.state === "stale",
      `zero=${JSON.stringify(zero)} junk=${JSON.stringify(junk)}`);

    // a pid-LESS dir is a human parking the machine, and e2e-stage.sh never reaps one — it must
    // therefore never be reported with the same `alive: false` that means "reapable"
    rmSync(`${OWN_LOCK}/pid`, { force: true });
    const parked = (await gateOf())?.lock;
    check("§2 a pid-less lock dir is a manual park: no pid, and liveness is UNKNOWN, not false",
      parked?.pid === null && parked.alive === null, JSON.stringify(parked));
    check("§2 a hand-parked lock is `parked`, told apart from `stale` — nothing ever reaps it",
      parked?.state === "parked", JSON.stringify(parked));

    // the server only ever READS the lock — the reaping contract lives in the wrappers, and a
    // second reaper would race the one place that re-checks the pid value before removing it
    check("§2 the server never removed the lock it was reporting on",
      ((): boolean => { try { return statSync(OWN_LOCK).isDirectory(); } catch { return false; } })());

    rmSync(OWN_LOCK, { recursive: true, force: true });
    check("§2 the lock going away is visible on the next poll",
      (await gateOf()) == null, JSON.stringify(await gateOf()));
  }
  // back to the real lock for everything below — and back to the env every later module expects
  await restartSrv();
  check("§2 the default lock path is restored: the real mutex is visible again",
    (await gateOf())?.lock?.pid === process.ppid, JSON.stringify((await gateOf())?.lock));

  // ===== §3 POST /api/self/verify-intent: who may report =====
  if (!REPO) {
    check("§3 SKIPPED: no FLEET_E2E_REPO, so no lane exists to report from", false, "run via ./e2e-isolated.sh");
    return;
  }
  const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
  const laneTok = await selfTokenOf(lane.slot);
  check("§3 fixture: a lane with a readable self token", /^[0-9a-f]{32}$/.test(laneTok), `slot ${lane.slot}`);

  check("§3 a missing self-token header is rejected",
    (await selfPost(undefined, { phase: "running", suite: "isolated" })).status === 401);
  check("§3 an unknown self token is rejected",
    (await selfPost("0".repeat(32), { phase: "running", suite: "isolated" })).status === 401);
  check("§3 the owner token does not substitute for a self token on this route",
    (await selfPost(TOKEN, { phase: "running", suite: "isolated" })).status === 401);

  // a plain session's credential is a valid credential with the wrong scope — the same 409 the
  // drift route draws, and for the same reason: this family answers FOR A LANE
  const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => !s.cwd)?.id ?? 0;
  check("§3 fixture: an idle slot is available to open a non-lane session in", free > 0, String(free));
  await post(`/api/slots/${free}/open`, { cwd: "~" });
  const plainTok = await selfTokenOf(free);
  const plain = await selfPost(plainTok, { phase: "running", suite: "isolated" });
  check("§3 a non-lane session's self token is recognized but out of scope (409, not a generic 401)",
    plain.status === 409, `${plain.status} ${await plain.text()}`);

  // ===== §4 what a report must look like =====
  for (const [why, body] of [
    ["an unknown phase", { phase: "nearly-done", suite: "isolated" }],
    ["a missing phase", { suite: "isolated" }],
    ["a missing suite", { phase: "running" }],
    ["an empty suite label", { phase: "running", suite: "   " }],
    ["a suite label with a newline in it", { phase: "running", suite: "isolated\nrm -rf" }],
    ["a suite label past the length cap", { phase: "running", suite: "s".repeat(61) }],
  ] as [string, unknown][])
    check(`§4 ${why} is rejected at the boundary (400)`, (await selfPost(laneTok, body)).status === 400, why);

  // ===== §5 the report reaches the board, bound to the TOKEN's slot =====
  const r1 = await selfPost(laneTok, { phase: "waiting", suite: "isolated", slot: free });
  const j1 = (await r1.json()) as { ok?: boolean; logged?: boolean };
  check("§5 a well-formed report is accepted and logged as a change", r1.ok && j1.logged === true, JSON.stringify(j1));
  {
    const g = await gateOf();
    const row = g?.reports.find((x) => x.slot === lane.slot);
    check("§5 the report is projected on /api/sessions for the token's own slot",
      row?.phase === "waiting" && row.suite === "isolated", JSON.stringify(g?.reports));
    check("§5 a spoofed `slot` field in the body is ignored — no report lands on the named slot",
      !g?.reports.some((x) => x.slot === free), JSON.stringify(g?.reports));
    check("§5 the phase change is on audit.jsonl, naming the suite and the phase",
      (await intentRowsAtLeast(lane.slot, 1)).includes("isolated:waiting"),
      JSON.stringify(await intentRows(lane.slot)));
  }

  // an identical re-post is a heartbeat, not an event: it must not push real events out of the
  // log's rotation window
  const rDup = await selfPost(laneTok, { phase: "waiting", suite: "isolated" });
  check("§5 an identical re-post is accepted but writes NO second audit line",
    ((await rDup.json()) as { logged?: boolean }).logged === false
      && (await intentRows(lane.slot)).filter((d) => d === "isolated:waiting").length === 1,
    JSON.stringify(await intentRows(lane.slot)));

  const rRun = await selfPost(laneTok, { phase: "running", suite: "isolated" });
  check("§5 a phase change is logged again", ((await rRun.json()) as { logged?: boolean }).logged === true);
  await selfPost(laneTok, { phase: "failed", suite: "isolated", exitCode: 144 });
  {
    const row = (await gateOf())?.reports.find((x) => x.slot === lane.slot);
    check("§5 the newest phase wins, and a failure carries its exit code",
      row?.phase === "failed" && row.exitCode === 144, JSON.stringify(row));
    const rows = await intentRowsAtLeast(lane.slot, 3);
    check("§5 the audit log holds the whole phase trail, in order — the context an exit 144 lacked",
      rows.join(" | ") === "isolated:waiting | isolated:running | isolated:failed exit 144", rows.join(" | "));
  }

  // ===== §6 a report never outlives its reporter =====
  await post(`/api/slots/${lane.slot}/kill`, {});
  check("§6 killing the lane drops its report — a dead session's `failed` is not a live fact",
    !(await gateOf())?.reports.some((x) => x.slot === lane.slot), JSON.stringify((await gateOf())?.reports));
  await post(`/api/slots/${free}/kill`, {}); // leave the slot inventory as this module found it
}

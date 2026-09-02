// e2e for THE HELPER DAEMON (helper-daemon/daemon.ts) — the other machine's half of the portal,
// driven as a real process against this scratch fleet.
//
// WHY IT LIVES HERE, beside e2e/helper-portal.ts and not in the main runner: the deliverable is a
// LEDGER ROW that carries `remote` and the device's name, and a ledger row only exists for an
// AUDIT job — which is the tier-2 queue, unreachable without FLEET_POSTLAND_AUDIT_CMD. The main
// suite boots without it on purpose and would have nothing for the daemon to claim.
//
// WHAT MAKES THE MODE HALF MEASURABLE is the COUNTING PROXY below. "off means not one request" is
// a claim about requests that were never made, and an empty server log is also what a crashed
// daemon produces. So the daemon is pointed at a local proxy that records every request and
// forwards it to the fleet: the same end-to-end path, with a number attached. Every negative check
// here first asserts its own precondition — that the counter was moving, that the daemon was alive
// and had read the wish — so a probe that could not measure fails as ITSELF rather than as the
// property it was aiming at.
import { chmodSync, copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, rmSync,
  statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { BASE, ROOT, check, get, post } from "./harness";
import { driveMerge, openLane, seedRepo, type Lane } from "./lane-helpers";
// The import is not only for the four pure checks below: it is the edge that makes e2e-stage.sh
// STAGE helper-daemon/ into the throwaway instance. The copy list is derived from the entry files'
// transitive relative imports, so a daemon reached by an import rides along with no wrapper edit
// and no hand-kept list — the failure mode that killed two harnesses in this repo.
import { failNamesOf, inQuietHours, localMode, stricter, tailOf, trailIdOf, EXIT_CONFIG, EXIT_UPDATED,
  type HelperConfig } from "../helper-daemon/daemon";

interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; fails?: string[];
  checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string; clonedSha?: string };
}
interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface LiveView { postLandAuditLive: { running: { repo: string | null; phase: string } | null } | null }
// the OWNER's projection of a device (server.ts#helperDevicesView), the two fields the update rail
// adds: what the daemon says it RUNS, and the standing update wish with its outcome
interface OwnerDevice {
  id: string; daemonSha?: string;
  update: { id: string; state: string; main: string; mainSha?: string;
    result?: { ok: boolean; exitCode: number | null; mainSha: string; note: string } } | null;
}

const DEVICE = "daemonbox0001";           // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "linux work-horse (e2e)";
const TRAIL = "isolated-20260828T2200Z-7777";

export async function run(h: {
  REPO: string;
  setAuditMode: (m: string) => Promise<number>;
  killSrv: () => Promise<void>;
  startSrv: (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }) => Promise<boolean>;
  auditRows: () => Promise<Row[]>;
  headOf: (ref?: string) => string;
}): Promise<void> {
  const { REPO, setAuditMode, killSrv, startSrv, auditRows, headOf } = h;

  // ===== (HD.1) THE MODE ARITHMETIC, as pure functions ==========================================
  // These are the only checks in this module that need no server, and they are here rather than
  // nowhere because the whole availability policy lives in three lines of arithmetic: a wrong
  // comparison would show up on the other machine as "it never works" or, far worse, as "it runs
  // at 3 a.m." — neither of which any process-level check below would separate from a network fault.
  check("(HD) the QUIETER mode wins: an owner's off stops an active machine",
    stricter("active", "off") === "off" && stricter("off", "active") === "off"
      && stricter("active", "quiet") === "quiet",
    `${stricter("active", "off")} ${stricter("off", "active")} ${stricter("active", "quiet")}`);
  check("(HD) …and a wish of 'active' never lifts a local quiet — the person who set it is standing there",
    stricter("quiet", "active") === "quiet" && stricter("off", "active") === "off",
    `${stricter("quiet", "active")} ${stricter("off", "active")}`);
  const at = (hhmm: string): Date => new Date(2026, 7, 28, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)));
  check("(HD) quiet hours that WRAP MIDNIGHT are the normal case, not the edge case",
    inQuietHours("23:00", "07:00", at("02:00")) && inQuietHours("23:00", "07:00", at("23:30"))
      && !inQuietHours("23:00", "07:00", at("12:00")) && !inQuietHours("23:00", "07:00", at("07:00")),
    `02:00=${inQuietHours("23:00", "07:00", at("02:00"))} 12:00=${inQuietHours("23:00", "07:00", at("12:00"))}`);
  check("(HD) …a same-day window is one interval, and from===to is EMPTY rather than a whole day",
    inQuietHours("09:00", "17:00", at("12:00")) && !inQuietHours("09:00", "17:00", at("02:00"))
      && !inQuietHours("08:00", "08:00", at("08:00")),
    `${inQuietHours("09:00", "17:00", at("12:00"))} ${inQuietHours("08:00", "08:00", at("08:00"))}`);
  const baseCfg = { enabled: true, quietHours: null, maxLoad1: 2 } as unknown as HelperConfig;
  check("(HD) the load threshold answers QUIET (up, reachable, nothing spare) — never off",
    localMode(baseCfg, at("12:00"), 9).mode === "quiet" && localMode(baseCfg, at("12:00"), 0.5).mode === "active"
      && localMode({ ...baseCfg, enabled: false }, at("12:00"), 0.1).mode === "off",
    JSON.stringify([localMode(baseCfg, at("12:00"), 9), localMode(baseCfg, at("12:00"), 0.5)]));
  check("(HD) the tail and the trail id are taken exactly the way the portal asks a human to take them",
    tailOf("a\nb\nc\nd", 2) === "c\nd" && trailIdOf(`noise ${TRAIL} more`) === TRAIL
      && trailIdOf("no trail here") === undefined,
    `${JSON.stringify(tailOf("a\nb\nc\nd", 2))} ${trailIdOf(`x ${TRAIL}`)}`);

  const failFixture = `${ROOT}/daemon-fail-fixture`;
  const failLog = `${failFixture}/suite.log`;
  rmSync(failFixture, { recursive: true, force: true });
  mkdirSync(`${failFixture}/tree/e2e-trail`, { recursive: true });
  await Bun.write(failLog, "FAIL  log decoy\n2 FAILURES\n");
  await Bun.write(`${failFixture}/tree/e2e-trail/${TRAIL}.jsonl`, [
    JSON.stringify({ ok: true, check: "passing decoy" }),
    JSON.stringify({ ok: false, check: "trail failure alpha" }),
    JSON.stringify({ ok: false, check: "trail failure beta" }),
  ].join("\n") + "\n");
  const trailFails = await failNamesOf(failLog, TRAIL);
  check("(HD) a synthetic run with log+trail reports the exact ok:false check names from the trail",
    JSON.stringify(trailFails) === '["trail failure alpha","trail failure beta"]',
    JSON.stringify(trailFails));
  await Bun.write(failLog, "FAIL  fallback failure alpha  (detail)\nPASS  decoy\nFAIL  fallback failure beta\n2 FAILURES\n");
  const fallbackFails = await failNamesOf(failLog, undefined);
  check("(HD) a synthetic run WITHOUT a trail falls back to the log's ^FAIL lines",
    JSON.stringify(fallbackFails) === '["fallback failure alpha","fallback failure beta"]',
    JSON.stringify(fallbackFails));
  rmSync(failFixture, { recursive: true, force: true });

  // ===== (HD.2) THE SCRATCH FLEET, THE COUNTING PROXY, AND THE STAND-IN SUITE ====================
  // e2e/helper-portal.ts leaves the server on a seconds-long claim timeout — right for a lapse
  // check, fatal for a daemon that clones, installs and runs before it reports. Restarted here.
  const DAEMON = resolve(import.meta.dir, "../helper-daemon/daemon.ts");
  // THE SOURCE OF THE SELF-UPDATE in (HD.8): a repository whose `helper-daemon/daemon.ts` is THIS
  // daemon, byte for byte, so that the tree the daemon clones, checks and restarts from is the real
  // program at a real commit — its heartbeat after the restart is then a `git rev-parse` of a tree
  // this suite can name. The server is pointed at it through FLEET_HELPER_UPDATE_REPO (the staged
  // instance runs from no checkout of its own, so the default source would be a 503).
  const UPD = `${ROOT}/daemonupdaterepo`;
  rmSync(UPD, { recursive: true, force: true });
  mkdirSync(`${UPD}/helper-daemon`, { recursive: true });
  copyFileSync(DAEMON, `${UPD}/helper-daemon/daemon.ts`);
  for (const args of [["init", "-q", "-b", "main"], ["add", "-A"],
    ["-c", "user.name=e2e", "-c", "user.email=e2e@example.invalid", "commit", "-qm", "the daemon, as shipped"]])
    spawnSync("git", ["-C", UPD, ...args]);
  await killSrv();
  check("(HD) setup: the server restarts with a claim timeout a real run fits inside",
    await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000",
      FLEET_HELPER_UPDATE_REPO: UPD } }));
  await Bun.sleep(750);

  check("(HD) setup: e2e-stage.sh staged helper-daemon/ into this instance (derived, not hand-listed)",
    existsSync(DAEMON), DAEMON);

  const helperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
  const hpost = (path: string, body: unknown): Promise<Response> =>
    post(path, body, { ...HH, "content-type": "application/json" });
  const jobsOf = async (): Promise<HelperJob[]> =>
    ((await (await hget(`/api/helper/jobs?deviceId=${DEVICE}`)).json()) as { jobs: HelperJob[] }).jobs;
  const jobFor = async (repo: string): Promise<HelperJob | undefined> =>
    (await jobsOf()).find((j) => j.repo === repo.split("/").pop());
  const liveRepo = async (): Promise<string | null> =>
    (((await (await get("/api/sessions")).json()) as LiveView).postLandAuditLive?.running?.repo) ?? null;
  const waitLocalRun = async (repo: string, timeoutMs = 60_000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await liveRepo()) === repo.split("/").pop()) return true;
      await Bun.sleep(150);
    }
    return false;
  };
  const base = (p: string): string => p.split("/").pop() ?? p;
  const rowsFor = async (repo: string): Promise<Row[]> =>
    (await auditRows()).filter((r) => base(r.repo) === base(repo));
  const authFails = (): number => {
    try {
      return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
        .filter((l) => l.includes('"event":"helper_auth_fail"')).length;
    } catch { return 0; }
  };

  // EVERY REQUEST THE DAEMON MAKES PASSES THROUGH HERE and is recorded with its full URL, which is
  // also how the "never in the URL" half of the token rule is measured rather than asserted. Port 0
  // so the OS picks a free one — the harness's own port bands say nothing about a proxy.
  const seen: string[] = [];
  const reportedBodies: Record<string, unknown>[] = [];
  const proxy = Bun.serve({
    port: 0, hostname: "127.0.0.1",
    fetch: async (req: Request): Promise<Response> => {
      const u = new URL(req.url);
      seen.push(`${req.method} ${u.pathname}${u.search}`);
      const headers = new Headers(req.headers);
      headers.delete("host");
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
      if (u.pathname === "/api/helper/result" && body) {
        try { reportedBodies.push(JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>); }
        catch { /* the server remains the authority on malformed JSON */ }
      }
      const res = await fetch(BASE + u.pathname + u.search, { method: req.method, headers, body });
      const out = new Headers();
      const ct = res.headers.get("content-type");
      if (ct) out.set("content-type", ct);
      // the body is re-read rather than streamed: content-encoding was already decoded by the fetch
      // above, so forwarding the original headers would describe bytes that no longer exist
      return new Response(await res.arrayBuffer(), { status: res.status, headers: out });
    },
  });
  const PROXY = `http://127.0.0.1:${proxy.port}`;

  // The stand-in for ./e2e-isolated.sh — same currency (exit code, tail, trail id) in milliseconds.
  // It prints its cwd, the files around it and the FLEET_* it inherited, then places two failures
  // before enough filler to push both FAIL lines out of the daemon's 40-line tail. The matching
  // trail remains beside the clone, so the report can still carry their exact names.
  const SUITE = `${ROOT}/fakedaemonsuite`;
  await Bun.write(SUITE, [
    "#!/bin/sh",
    `echo "run pwd=$(pwd) files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] token=[\${FLEET_TOKEN:-}]"`,
    `echo "${TRAIL} stand-in trail marker"`,
    'mkdir -p "$PWD/e2e-trail"',
    `printf '%s\\n' '${JSON.stringify({ ok: false, check: "remote trail failure alpha" })}' '${JSON.stringify({ ok: false, check: "remote trail failure beta" })}' > "$PWD/e2e-trail/${TRAIL}.jsonl"`,
    'echo "FAIL  remote trail failure alpha"',
    'echo "FAIL  remote trail failure beta"',
    'i=0; while [ "$i" -lt 60 ]; do echo "trailing filler $i"; i=$((i + 1)); done',
    `echo "run pwd=$(pwd) files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] token=[\${FLEET_TOKEN:-}]"`,
    'echo "2 FAILURES"',
    "exit 1",
  ].join("\n"));
  chmodSync(SUITE, 0o755);

  const WORK = `${ROOT}/daemonwork`;
  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  const CFG = `${ROOT}/daemon-config.json`;
  const writeConfig = async (over: Record<string, unknown> = {}, mode = 0o600): Promise<void> => {
    await Bun.write(CFG, `${JSON.stringify({
      fleetUrl: PROXY, token: helperToken, deviceId: DEVICE, name: DEVICE_NAME, workDir: WORK,
      pollSec: 2, offRecheckSec: 3600, quietHours: null, maxLoad1: null,
      capabilities: ["bun", "git"], suiteCmd: SUITE, suiteTimeoutSec: 120, keepRuns: 3, enabled: true,
      ...over,
    }, null, 2)}\n`);
    chmodSync(CFG, mode);
  };
  const DLOG = `${ROOT}/daemon.log`;
  let logSeq = 0;
  // THE DAEMON RUNS UNDER `init.defaultBranch=master`, and that is the point of this constant. A
  // helper bundle carries its refs and NO HEAD, so a clone that does not name a ref only checks
  // anything out when git can GUESS one — and it guesses with `init.defaultBranch`. This box has it
  // on `main`, which is exactly the setting under which the bug of 2026-08-29 (an audit job cloned
  // without `-b`, empty tree, `install failed`, ledger row `unknown`) is INVISIBLE. Debian's
  // default is `master`, and so is an unset one.
  // GIT_CONFIG_* is the way in that touches the DAEMON's environment only: `~/.gitconfig` on this
  // machine is shared reality outside this repo and is never written by a suite.
  const MASTER_DEFAULT: Record<string, string> = {
    GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "init.defaultBranch", GIT_CONFIG_VALUE_0: "master",
  };
  // `entry` is the daemon FILE to run — the staged copy by default, and in (HD.8) the one behind
  // the symlink the update just moved, which is what the unit's ExecStart runs on the real machine
  const startDaemon = (entry = DAEMON): { proc: ReturnType<typeof Bun.spawn>; log: string } => {
    const log = `${DLOG}.${++logSeq}`;
    rmSync(log, { force: true });
    // ONE fd for both streams, opened here and closed by the OS when this process ends: passing a
    // BunFile twice gives the two streams independent write positions and they overwrite each other.
    const fd = openSync(log, "a");
    return {
      proc: Bun.spawn(["bun", entry, CFG],
        { cwd: ROOT, stdin: "ignore", stdout: fd, stderr: fd, env: { ...process.env, ...MASTER_DEFAULT } }),
      log,
    };
  };
  const logText = (p: string): string => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
  const waitLog = async (p: string, needle: string, timeoutMs = 20_000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (logText(p).includes(needle)) return true;
      await Bun.sleep(100);
    }
    return false;
  };
  const selfTokenOf = async (slot: number): Promise<string> => {
    let token = "";
    for (let i = 0; i < 60; i++) {
      try {
        token = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
      } catch { /* state file mid-write */ }
      if (/^[0-9a-f]{32}$/.test(token)) return token;
      await Bun.sleep(50);
    }
    return token;
  };
  const previewReport = async (name: string, result: Record<string, unknown>): Promise<{
    status: number; body: { offer?: { state?: string; result?: { checks?: { ran: number; failed: number } | null } } };
  }> => {
    const lane = await openLane(REPO, name);
    const token = await selfTokenOf(lane.slot);
    const headers = { "x-fleet-self-token": token, "content-type": "application/json" };
    const offerRes = await fetch(BASE + "/api/self/suite-offer",
      { method: "POST", headers, body: "{}" });
    const offer = (await offerRes.json()) as { offer?: { id?: string } };
    const jobId = offer.offer?.id ?? "";
    await hpost("/api/helper/claim", { jobId, deviceId: DEVICE });
    const resultRes = await hpost("/api/helper/result", { jobId, ...result });
    const read = await fetch(BASE + "/api/self/suite-offer", { headers: { "x-fleet-self-token": token } });
    const body = await read.json() as { offer?: { state?: string; result?: { checks?: { ran: number; failed: number } | null } } };
    await post(`/api/slots/${lane.slot}/kill`, {});
    return { status: resultRes.status, body };
  };

  // ===== (HD.3) THE TWO CONFIG REFUSALS — a wrong credential costs ONE request, ever =============
  // The daemon's answer to both is to STOP, and the unit template pairs that exit code with
  // systemd's RestartPreventExitStatus. That pairing IS the no-retry-storm property: retrying a
  // rejected credential can only ever fill the fleet's audit trail with helper_auth_fail rows.
  await writeConfig({}, 0o644);
  const loose = startDaemon();
  const looseCode = await loose.proc.exited;
  check("(HD) should-reject: a config file readable by anyone but its owner is refused, with no request made",
    looseCode === EXIT_CONFIG && seen.length === 0 && logText(loose.log).includes("must be 0600"),
    `exit=${looseCode} requests=${seen.length} ${logText(loose.log).trim().slice(0, 160)}`);

  const failsBefore = authFails();
  await writeConfig({ token: "0".repeat(32) });
  const bad = startDaemon();
  const badCode = await bad.proc.exited;
  await Bun.sleep(1500); // a storm would show itself here — well past two 2s poll intervals
  check("(HD) A REJECTED TOKEN COSTS EXACTLY ONE REQUEST: the daemon stops instead of retrying",
    badCode === EXIT_CONFIG && seen.length === 1 && seen[0]?.startsWith("POST /api/helper/device") === true
      && authFails() === failsBefore + 1,
    `exit=${badCode} requests=${JSON.stringify(seen)} authFails ${failsBefore}→${authFails()}`);
  seen.length = 0;

  // ===== (HD.4) THE WHOLE RITUAL, RUN BY A PROCESS ==============================================
  // The decoy occupies the local drain (25s), so the land that follows queues a job nothing here is
  // running — the same fixture e2e/helper-portal.ts needs and for the same reason: a claimable job
  // does not otherwise exist, because the drain starts on the land that queued it.
  const DECOY = `${REPO}-daemondecoy`;
  await seedRepo(DECOY);
  const rowsAtStart = (await rowsFor(REPO)).length;
  await setAuditMode("crash");
  const decoy = await openLane(DECOY, "daemondecoy");
  await driveMerge(decoy, decoy.branch);
  check("(HD) setup: the decoy's land took the local drain", await waitLocalRun(DECOY), `live=${await liveRepo()}`);
  await setAuditMode("green");

  // the lane whose landed tree the daemon will be handed. It carries a package.json so that
  // `bun install --frozen-lockfile` — the step the daemon runs verbatim, not a stand-in — has
  // something real to answer.
  const job: Lane = await openLane(REPO, "daemonjob");
  await Bun.write(`${job.cwd}/package.json`, '{"name":"daemon-e2e-fixture","private":true}\n');
  spawnSync("git", ["-C", job.cwd, "add", "package.json"]);
  spawnSync("git", ["-C", job.cwd, "commit", "-qm", "daemon fixture package.json"]);
  const landed = await driveMerge(job, job.branch);
  const jobSha = headOf();
  const queued = await jobFor(REPO);
  check("(HD) setup: the land queued an OPEN audit job for the daemon to find",
    landed.gone && queued?.claim === null && queued.localRunning === false,
    `${landed.gone} ${JSON.stringify(queued)}`);

  // THE FIXTURE MUST BE ABLE TO SEE THE BUG BEFORE IT CLAIMS THE FIX. `MASTER_DEFAULT` is only a
  // pair of environment variables until something shows what they do, so the two clones below are
  // driven by hand under exactly the environment the daemon is about to get: a plain clone of a
  // HEAD-less bundle must come back EMPTY, and the same clone with `-b main` must come back full.
  // Without this pair, the green ledger row further down would be a statement about this machine's
  // ~/.gitconfig rather than about the daemon.
  const BUNDLE = `${ROOT}/headless.bundle`;
  rmSync(BUNDLE, { force: true });
  const bundled = spawnSync("git", ["-C", REPO, "bundle", "create", BUNDLE, "main"]);
  const cloneFiles = (name: string, extra: string[]): number => {
    const dir = `${ROOT}/${name}`;
    rmSync(dir, { recursive: true, force: true });
    spawnSync("git", ["clone", "-q", ...extra, BUNDLE, dir], { env: { ...process.env, ...MASTER_DEFAULT } });
    try { return readdirSync(dir).filter((n) => n !== ".git").length; } catch { return -1; }
  };
  const plainClone = cloneFiles("headlessplain", []);
  const refClone = cloneFiles("headlessref", ["-b", "main"]);
  rmSync(`${ROOT}/headlessplain`, { recursive: true, force: true });
  rmSync(`${ROOT}/headlessref`, { recursive: true, force: true });
  rmSync(BUNDLE, { force: true });
  check("(HD) precondition: under init.defaultBranch=master a PLAIN clone of a HEAD-less bundle really is EMPTY — this fixture can see the bug",
    bundled.status === 0 && plainClone === 0 && refClone > 0,
    `bundle=${bundled.status} plain=${plainClone} file(s), -b main=${refClone} file(s)`);

  await writeConfig();
  const daemon = startDaemon();
  check("(HD) the daemon starts and reads its config", await waitLog(daemon.log, "helper-daemon up"),
    logText(daemon.log).slice(0, 200));
  const claimedByDaemon = await (async (): Promise<HelperJob | undefined> => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const j = await jobFor(REPO);
      if (j?.claim) return j;
      await Bun.sleep(200);
    }
    return await jobFor(REPO);
  })();
  check("(HD) THE DAEMON CLAIMED THE JOB — no human clicked anything",
    claimedByDaemon?.claim?.name === DEVICE_NAME, JSON.stringify(claimedByDaemon));

  const remoteRow = await (async (): Promise<Row | undefined> => {
    const deadline = Date.now() + 180_000;
    for (;;) {
      const rows = await rowsFor(REPO);
      const fresh = rows.slice(0, Math.max(0, rows.length - rowsAtStart));
      if (fresh.length || Date.now() >= deadline) return fresh[0];
      await Bun.sleep(300);
    }
  })();
  check("(HD) THE LEDGER ROW CAME BACK red, against the exact tree that was handed over",
    remoteRow?.result === "red" && remoteRow.mainSha === jobSha && remoteRow.exitCode === 1
      && remoteRow.covers.some((c) => c.branch === job.branch),
    JSON.stringify(remoteRow).slice(0, 280));
  // THE DONE-CRITERION OF THE 2026-08-29 FIX, stated as its own check so a regression reads as what
  // it is: the whole empty-clone class ends as `unknown` with a reason, never as a red — honest,
  // and worth nothing, because nothing was measured.
  check("(HD) …and it is a MEASURED red under init.defaultBranch=master — not the `unknown` an empty clone produces",
    remoteRow?.result !== "unknown" && (remoteRow?.checks?.ran ?? 0) > 0,
    `result=${remoteRow?.result} reason=${remoteRow?.reason ?? "-"} checks=${JSON.stringify(remoteRow?.checks)}`);
  check("(HD) …and it is MARKED REMOTE with this machine's name and the trail id the daemon read out of the log",
    remoteRow?.remote?.name === DEVICE_NAME && remoteRow.remote.trail === TRAIL
      && remoteRow.remote.reportedAt >= remoteRow.remote.claimedAt,
    JSON.stringify(remoteRow?.remote));
  // THE PROOF OF THE 2026-08-29 CLASS-FIX, and the only check in this file that can carry it: the
  // daemon really runs here, so `remote.clonedSha` is a `git rev-parse HEAD` performed in the clone
  // rather than anything this suite arranged. Two statements, both needed — it is PRESENT (a daemon
  // that stopped sending it would leave the field absent, which the server stores as absence and a
  // reader cannot distinguish from an old row), and it EQUALS the sha the server bundled. While the
  // field did not exist, a remote red over a repo under parallel edit was unfalsifiable: "the helper
  // measured another tree" could be neither shown nor ruled out
  // (docs/messungen/2026-08-29-adjudikation-second-host-401.md).
  check("(HD) …and the row carries the sha the DAEMON checked out, measured in its own clone, equal to the one handed over",
    !!remoteRow?.remote?.clonedSha && remoteRow.remote.clonedSha === jobSha
      && remoteRow.mainSha === jobSha,
    `cloned=${remoteRow?.remote?.clonedSha ?? "ABSENT"} mainSha=${remoteRow?.mainSha} handedOver=${jobSha}`);
  const reported = reportedBodies.find((b) => b.jobId === claimedByDaemon?.id);
  check("(HD) the daemon's real result POST carries the exact fail names from its synthetic trail",
    JSON.stringify(reported?.fails) === '["remote trail failure alpha","remote trail failure beta"]',
    JSON.stringify(reported));
  check("(HD) the row stores those bounded names and corroborates a summary whose FAIL lines fell outside the tail",
    JSON.stringify(remoteRow?.fails) === '["remote trail failure alpha","remote trail failure beta"]'
      && remoteRow?.checks?.ran === 2 && remoteRow.checks.failed === 2
      && remoteRow.cmd.includes("remote helper") && remoteRow.cmd.includes(DEVICE_NAME),
    `${JSON.stringify(remoteRow?.fails)} ${JSON.stringify(remoteRow?.checks)} ${remoteRow?.cmd}`);
  const dossier = await (await get(`/api/lane?branch=${encodeURIComponent(job.branch)}`)).json() as {
    audits?: { state?: string; value?: { rows?: { fails?: string[] }[] } };
  };
  check("(HD) the lane's Audit/Ledger projection carries the same bounded fail names to its reader",
    dossier.audits?.state === "read"
      && JSON.stringify(dossier.audits.value?.rows?.[0]?.fails) === '["remote trail failure alpha","remote trail failure beta"]',
    JSON.stringify(dossier.audits));
  // THE CLONE IS REAL, and the tail proves it three ways at once: the suite ran in a scratch
  // directory (never the fleet's own tree), that directory carried the landed lane's file AND the
  // node_modules `bun install --frozen-lockfile` just produced, and it inherited NO FLEET_* — the
  // recursion server.ts strips for its own audit child, stripped here for the same reason.
  const out = remoteRow?.out ?? "";
  // the cwd is matched by SHAPE, not against `${WORK}`: this box answers /var out of /private/var,
  // so the path the suite reports and the path this module holds are the same directory spelled two
  // ways — a string compare would fail on a correct daemon.
  const ranIn = /pwd=(\S+)/.exec(out)?.[1] ?? "";
  check("(HD) the daemon cloned, installed and ran IN THE CLONE — the landed file and node_modules are there",
    /\/daemonwork\/run-[a-f0-9]{12}-\d+\/tree$/.test(ranIn)
      && out.includes("daemonjob.txt") && out.includes("node_modules") && out.includes("package.json"),
    `pwd=${ranIn} | ${out.split("\n")[0]?.slice(0, 200) ?? "(no tail)"}`);
  check("(HD) …and the suite inherited no FLEET_* — a nested fleet must not audit its own lands",
    out.includes("recur=[]") && out.includes("token=[]"),
    out.split("\n")[0]?.slice(0, 240) ?? "(no tail)");

  // ===== (HD.5) `off` MEANS NOT ONE REQUEST =====================================================
  // The precondition first, because "no requests" is also what a dead process produces: the counter
  // must be demonstrably MOVING before the wish is set, or this check has measured nothing.
  const movingFrom = seen.length;
  await Bun.sleep(5000); // ≥ two 2s poll intervals
  const moving = seen.length - movingFrom;
  check("(HD) precondition: while the wish is 'active' the daemon really is polling",
    moving > 0, `${moving} request(s) in 5s`);
  const wish = await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "off" });
  check("(HD) setup: the OWNER sets this device's wish-mode to off", wish.ok, `${wish.status}`);
  const learned = await waitLog(daemon.log, "owner wish is off");
  check("(HD) the daemon PULLS the wish on its own next heartbeat — nothing was pushed to it",
    learned, logText(daemon.log).split("\n").slice(-3).join(" | ").slice(0, 200));
  const quietFrom = seen.length;
  await Bun.sleep(9000); // four poll intervals; an active daemon would make ~8 requests here
  const during = seen.length - quietFrom;
  // `exitCode === null` is the ONLY aliveness signal here: Bun sets `killed` to true on any exit,
  // including a clean one, so a check written on it would call a dead daemon alive.
  const alive = daemon.proc.exitCode === null;
  check("(HD) OFF MEANS NOT ONE REQUEST — and the daemon is still alive, so silence is a choice",
    learned && alive && during === 0,
    `alive=${alive} requests=${during} ${JSON.stringify(seen.slice(quietFrom).slice(0, 4))}`);

  // ===== (HD.6) THE RESULT BODY'S NETWORK BOUNDARY ===============================================
  // Preview jobs make the validator observable without writing synthetic audit rows: they traverse
  // the same /api/helper/result fork, then expose the derived checks back to their own lane.
  const legacy = await previewReport("daemonlegacy", {
    exitCode: 1, tail: "FAIL  legacy visible failure\n1 FAILURES",
  });
  check("(HD) an OLD result body without fails is still accepted with exactly the prior check count",
    legacy.status === 200 && legacy.body.offer?.state === "reported"
      && legacy.body.offer.result?.checks?.ran === 1 && legacy.body.offer.result.checks.failed === 1,
    JSON.stringify(legacy));

  const fiftyOne = Array.from({ length: 51 }, (_, i) => `bounded failure ${i + 1}`);
  const capped = await previewReport("daemoncap", {
    exitCode: 1, tail: "50 FAILURES", fails: fiftyOne,
  });
  check("(HD) mutation guard: a 51-name network array is capped to 50 before corroboration",
    capped.status === 200 && capped.body.offer?.result?.checks?.ran === 50
      && capped.body.offer.result.checks.failed === 50,
    JSON.stringify(capped));

  const rejected = await previewReport("daemonbadfails", {
    exitCode: 1, tail: "1 FAILURES", fails: ["plausible name", 7],
  });
  check("(HD) mutation guard: one non-string rejects the whole fails field instead of corroborating it",
    rejected.status === 200 && rejected.body.offer?.state === "reported"
      && rejected.body.offer.result?.checks === null,
    JSON.stringify(rejected));

  // ===== (HD.7) THE TOKEN NEVER LEFT ITS HEADER =================================================
  // Measured on both surfaces the portal's own page uses the other way round: the browser bootstrap
  // passes `?token=`, which is fine for a URL bar and wrong for a machine whose shell history,
  // process list and journal outlive it.
  const inUrl = seen.filter((s) => s.includes("token="));
  check("(HD) NO request the daemon made carried a token in its URL",
    inUrl.length === 0 && seen.length > 0, `${inUrl.length} of ${seen.length}: ${JSON.stringify(inUrl.slice(0, 3))}`);
  const logs = logText(daemon.log);
  check("(HD) …and the daemon's own log never printed it either",
    logs.length > 0 && !logs.includes(helperToken), `bytes=${logs.length}`);
  check("(HD) the config file it reads is 0600 and is the ONLY place the credential lives",
    (statSync(CFG).mode & 0o077) === 0 && readFileSync(CFG, "utf8").includes(helperToken),
    `mode=${(statSync(CFG).mode & 0o777).toString(8)}`);

  daemon.proc.kill();          // by handle, never by name — a pattern kill on this box hits the server's own audit
  await daemon.proc.exited;

  // ===== (HD.8) THE DAEMON UPDATES ITSELF: clone → check → symlink-swap → exit 75 ================
  // The daemon above read an owner `off` and would not poll again for an hour, so this section
  // runs a fresh one. What it proves, in order: the owner's door queues a ROW (nothing is pushed);
  // the row is offered to its device alone; the daemon performs the four steps in exactly that
  // order and ends in exit 75 with the link on the new tree; started again from the link — the
  // part systemd plays on the real machine — it boots the NEW tree and its heartbeat names the
  // bundled sha; and a tree that does not parse is refused BEFORE the link moves, with the daemon
  // still running afterwards.
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const CUR = `${WORK}/current`;
  const shaOf = (dir: string): string => spawnSync("git", ["-C", dir, "rev-parse", "HEAD"]).stdout.toString().trim();
  const goodSha = shaOf(UPD);
  const goodTree = `${WORK}/tree-${goodSha.slice(0, 12)}`;
  const ownerDevice = async (): Promise<OwnerDevice | undefined> =>
    (((await (await get("/api/sessions")).json()) as { helperDevices?: OwnerDevice[] }).helperDevices ?? [])
      .find((d) => d.id === DEVICE);
  const waitDevice = async (pred: (d: OwnerDevice | undefined) => boolean, timeoutMs = 30_000): Promise<OwnerDevice | undefined> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const d = await ownerDevice();
      if (pred(d) || Date.now() >= deadline) return d;
      await Bun.sleep(250);
    }
  };
  const noDev = await post("/api/helper/devices/e2enosuchdev/update", {});
  const viaHelper = await hpost(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) should-reject: an update for a device nobody has seen is 404, and the HELPER principal cannot queue one (401 — its header is one the owner gate never reads)",
    noDev.status === 404 && viaHelper.status === 401, `${noDev.status} ${viaHelper.status}`);
  const updQueued = await post(`/api/helper/devices/${DEVICE}/update`, {});
  const queuedBody = (await updQueued.json()) as { update?: { id?: string; state?: string; main?: string }; error?: string };
  check("(HD) THE OWNER QUEUES A daemon-update — a row on the board, nothing pushed to the machine",
    updQueued.status === 200 && queuedBody.update?.state === "open" && queuedBody.update.main === "main"
      && /^[0-9a-f]{12}$/.test(queuedBody.update.id ?? ""),
    `${updQueued.status} ${JSON.stringify(queuedBody)}`);
  const twice = await post(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) should-reject: a second update while one is updQueued is 409",
    twice.status === 409, `${twice.status}`);
  const offered = (await jobsOf()).find((j) => j.kind === "daemon-update");
  const strangerJobs = ((await (await hget("/api/helper/jobs?deviceId=e2eotherbox001")).json()) as { jobs: HelperJob[] }).jobs;
  check("(HD) the update is OFFERED TO ITS DEVICE ALONE, as kind daemon-update on main — another deviceId's list has no such job",
    offered?.id === queuedBody.update?.id && offered?.main === "main" && offered.claim === null && offered.covers === 0
      && !strangerJobs.some((j) => j.kind === "daemon-update"),
    `${JSON.stringify(offered)} stranger=${strangerJobs.length}`);

  const up1 = startDaemon();
  const exit1 = await Promise.race([up1.proc.exited, Bun.sleep(90_000).then(() => -1)]);
  const l1 = logText(up1.log);
  const seq = [": clone main", "bun build --target=bun helper-daemon/daemon.ts", ": symlink-swap ", `: exit ${EXIT_UPDATED}`]
    .map((s) => l1.indexOf(s));
  check("(HD) THE DAEMON UPDATED ITSELF — clone → check → symlink-swap → exit 75, in exactly that order",
    exit1 === EXIT_UPDATED && seq.every((i) => i >= 0) && seq[0]! < seq[1]! && seq[1]! < seq[2]! && seq[2]! < seq[3]!,
    `exit=${exit1} seq=${JSON.stringify(seq)} | ${l1.split("\n").filter((l) => l.includes("update ")).join(" | ").slice(0, 400)}`);
  const link1 = ((): string => { try { return readlinkSync(CUR); } catch { return "(no link)"; } })();
  check("(HD) …the link points at the new tree, which is at the exact sha the fleet bundled; bundle and check scratch are gone",
    link1 === goodTree && shaOf(CUR) === goodSha && !existsSync(`${goodTree}.check`)
      && !readdirSync(WORK).some((n) => n.endsWith(".bundle")),
    `link=${link1} sha=${shaOf(CUR)} handedOver=${goodSha} work=${readdirSync(WORK).join(",")}`);
  const swapReport = reportedBodies.find((b) => b.jobId === queuedBody.update?.id);
  const dev1 = await waitDevice((d) => d?.update?.state === "reported");
  check("(HD) …the result POST said exit 0 with the cloned sha, and the board's row reads reported/swapped — while NO daemon has yet reported running it",
    swapReport?.exitCode === 0 && swapReport.clonedSha === goodSha
      && dev1?.update?.state === "reported" && dev1.update.result?.ok === true && dev1.update.result.mainSha === goodSha
      && dev1.daemonSha !== goodSha,
    `report=${JSON.stringify(swapReport)} board=${JSON.stringify(dev1?.update)} daemonSha=${dev1?.daemonSha ?? "ABSENT"}`);

  // systemd's part, played here: RestartForceExitStatus=75 starts the unit again, and its ExecStart
  // runs THROUGH THE LINK — so this is the daemon.ts inside the tree the update just checked in.
  const up2 = startDaemon(`${CUR}/helper-daemon/daemon.ts`);
  check("(HD) restarted from the link, the daemon boots the NEW tree and says which sha it runs",
    await waitLog(up2.log, `running ${goodSha.slice(0, 8)} from`),
    logText(up2.log).split("\n")[0]?.slice(0, 240) ?? "(no log)");
  const dev2 = await waitDevice((d) => d?.daemonSha === goodSha);
  check("(HD) THE HEARTBEAT CARRIES daemonSha = the bundled sha, and the board shows it — the update provably took",
    dev2?.daemonSha === goodSha && dev2.update?.result?.mainSha === goodSha,
    `daemonSha=${dev2?.daemonSha ?? "ABSENT"} bundled=${goodSha}`);

  // THE NEGATIVE HALF, and the one the whole ordering exists for: a tree whose daemon.ts does not
  // parse must never become the link's target. The daemon that refuses it is the one running from
  // the good tree — and it is still running afterwards.
  await Bun.write(`${UPD}/helper-daemon/daemon.ts`, "const broken = ;\nexport {};\n");
  spawnSync("git", ["-C", UPD, "-c", "user.name=e2e", "-c", "user.email=e2e@example.invalid", "commit", "-qam", "a daemon that does not parse"]);
  const badSha = shaOf(UPD);
  const requeued = await post(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) setup: a reported update can be followed by a new one — the row is re-queued open",
    requeued.status === 200 && badSha !== goodSha, `${requeued.status} bad=${badSha.slice(0, 8)}`);
  const refused = await waitLog(up2.log, "check-failed", 90_000);
  const l2 = logText(up2.log);
  const link2 = ((): string => { try { return readlinkSync(CUR); } catch { return "(no link)"; } })();
  check("(HD) A TREE THAT DOES NOT PARSE IS REFUSED: check-failed, NO symlink-swap, exit code none — the daemon keeps running from the good tree",
    refused && !l2.includes("symlink-swap") && link2 === goodTree && up2.proc.exitCode === null,
    `refused=${refused} swapped=${l2.includes("symlink-swap")} link=${link2} alive=${up2.proc.exitCode === null}`);
  const dev3 = await waitDevice((d) => d?.update?.state === "reported" && d.update.result?.mainSha === badSha);
  check("(HD) …the board says failed with the bad sha, and daemonSha still names the good tree",
    dev3?.update?.result?.ok === false && dev3.update.result.mainSha === badSha
      && dev3.update.result.note.includes("check-failed") && dev3.daemonSha === goodSha,
    `${JSON.stringify(dev3?.update)} daemonSha=${dev3?.daemonSha}`);
  check("(HD) …and both trees are on disk: the refused one for inspection, the good one as the way back",
    existsSync(`${WORK}/tree-${badSha.slice(0, 12)}`) && existsSync(goodTree),
    readdirSync(WORK).filter((n) => n.startsWith("tree-")).join(","));
  const badBeat = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, daemonSha: "not-a-sha" });
  check("(HD) should-reject: a heartbeat whose daemonSha is not 40 hex is 400, and the stored sha is untouched",
    badBeat.status === 400 && (await ownerDevice())?.daemonSha === goodSha, `${badBeat.status}`);

  // ===== (HD.9) THE COMMAND JOB — work sent from here, run there, receipted with artefacts ======
  // Placed HERE and not earlier for one measured reason: a command job is offered ONLY to a device
  // whose heartbeat carried `daemonSha`, and `up2` is the first daemon in this file that HAS one —
  // it runs from the checked-out tree the update above swapped in, so its own `git rev-parse` has an
  // answer. Running this section against the staged copy (no git checkout around it) would measure
  // the handshake refusing, not the feature working.
  {
    const lane = await openLane(REPO, "cmdjob");
    const laneToken = await selfTokenOf(lane.slot);
    const selfH = { "x-fleet-self-token": laneToken, "content-type": "application/json" };
    // package.json + probe are COMMITTED, then the probe is CHANGED and left uncommitted. That is
    // the whole point of `git stash create`: the artefact's digest below can only match the dirty
    // bytes if the tree that ran on the other machine was the tree this lane actually HAS.
    await Bun.write(`${lane.cwd}/package.json`,
      JSON.stringify({ name: "cmdprobe", private: true,
        scripts: { build: "mkdir -p dist && cp probe.txt dist/out.txt" } }, null, 2) + "\n");
    await Bun.write(`${lane.cwd}/probe.txt`, "committed payload\n");
    spawnSync("git", ["-C", lane.cwd, "add", "package.json", "probe.txt"]);
    spawnSync("git", ["-C", lane.cwd, "commit", "-qm", "cmdjob build fixture"]);
    const DIRTY = "UNCOMMITTED payload the helper must see\n";
    await Bun.write(`${lane.cwd}/probe.txt`, DIRTY);
    const shaOfFile = (path: string): string =>
      spawnSync("shasum", ["-a", "256", path]).stdout.toString().trim().split(/\s+/)[0] ?? "";
    const wantSha = shaOfFile(`${lane.cwd}/probe.txt`);
    check("(HD) setup: the lane's dirty probe hashes to something this suite can compare against",
      /^[0-9a-f]{64}$/.test(wantSha), wantSha);

    // THE REFUSAL FIRST, and its second half is the one that matters: no row is created, so there is
    // nothing for any helper to claim. A 400 that still queued the job would be the same bug wearing
    // a status code.
    const before = (await jobsOf()).filter((j) => j.kind === "command").length;
    const refusedCmd = await fetch(BASE + "/api/self/jobs",
      { method: "POST", headers: selfH, body: JSON.stringify({ cmd: "claude -p x" }) });
    const refusedBody = (await refusedCmd.json()) as { error?: string; jobId?: string };
    const afterRefusal = (await jobsOf()).filter((j) => j.kind === "command").length;
    check("(HD) should-reject: a cmd naming an agent harness is 400 AND creates no claimable row",
      refusedCmd.status === 400 && refusedBody.jobId === undefined && afterRefusal === before
        && (refusedBody.error ?? "").includes("claude"),
      `${refusedCmd.status} jobs ${before}→${afterRefusal} ${JSON.stringify(refusedBody.error ?? "")}`);
    const offList = await fetch(BASE + "/api/self/jobs",
      { method: "POST", headers: selfH, body: JSON.stringify({ cmd: "make -j8" }) });
    check("(HD) should-reject: a cmd that is merely not on the allowlist is 400 too, and says so",
      offList.status === 400 && ((await offList.json()) as { error?: string }).error?.includes("allowlist") === true,
      `${offList.status}`);

    const madeRes = await fetch(BASE + "/api/self/jobs", { method: "POST", headers: selfH,
      body: JSON.stringify({ cmd: "bun run build", timeoutMs: 120_000, artifacts: ["dist/*.txt"] }) });
    const made = (await madeRes.json()) as { jobId?: string; job?: { cmd?: string; argv?: string[] } };
    const jobId = made.jobId ?? "";
    check("(HD) THE SESSION POSTS A COMMAND JOB and gets an id back, with the argv the allowlist split",
      madeRes.status === 200 && /^[0-9a-f]{12}$/.test(jobId) && made.job?.cmd === "bun run build"
        && JSON.stringify(made.job?.argv) === '["bun","run","build"]',
      `${madeRes.status} ${JSON.stringify(made)}`);

    // THE HANDSHAKE, measured from the OTHER side: a device that never named a daemonSha does not
    // see this job at all. `e2eotherbox001` has only ever been used as a jobs-list reader above.
    const strangerCmd = ((await (await hget("/api/helper/jobs?deviceId=e2eotherbox001")).json()) as
      { jobs: HelperJob[] }).jobs.filter((j) => j.kind === "command");
    const mineCmd = (await jobsOf()).find((j) => j.kind === "command" && j.id === jobId);
    check("(HD) a command job is INVISIBLE to a device whose heartbeat named no daemonSha, and visible to the one that did",
      strangerCmd.length === 0 && !!mineCmd,
      `stranger=${strangerCmd.length} mine=${JSON.stringify(mineCmd)}`);

    const readJob = async (): Promise<{ state?: string; treeSha?: string | null; result?: {
      exitCode?: number | null; result?: string; reason?: string;
      artifacts?: { path: string; sha256: string; bytes: number }[];
      remote?: { name?: string; clonedSha?: string } } }> => {
      const r = await fetch(BASE + `/api/self/jobs/${jobId}`, { headers: { "x-fleet-self-token": laneToken } });
      return ((await r.json()) as { job?: Record<string, unknown> }).job ?? {};
    };
    const deadline = Date.now() + 180_000;
    let settled = await readJob();
    while (Date.now() < deadline && settled.state !== "reported") {
      await Bun.sleep(500);
      settled = await readJob();
    }
    const arts = settled.result?.artifacts ?? [];
    const out = arts.find((a) => a.path === "dist/out.txt");
    check("(HD) THE RECEIPT: the remote run of `bun run build` came back exit 0 / green, named by the device that ran it",
      settled.state === "reported" && settled.result?.exitCode === 0 && settled.result.result === "green"
        && settled.result.remote?.name === DEVICE_NAME,
      `state=${settled.state} exit=${settled.result?.exitCode} result=${settled.result?.result}`
      + ` reason=${settled.result?.reason ?? "-"} remote=${settled.result?.remote?.name ?? "-"}`);
    check("(HD) …and it carries the artefact the globs asked for, hashed IN THE CLONE — the digest is the lane's UNCOMMITTED bytes, so `git stash create` provably carried them",
      arts.length >= 1 && out?.sha256 === wantSha && out.bytes === Buffer.byteLength(DIRTY),
      `${arts.length} artefact(s) ${JSON.stringify(arts.slice(0, 3))} want=${wantSha} wantBytes=${Buffer.byteLength(DIRTY)}`);

    // THE WATCH, through the OWNER route. This slice added a job KIND, not a principal: the
    // self-watch door still answers a lane 409 ("lane-waits-on-lane"), and widening that is an
    // owner promotion, not a lane's to make. Both halves are checked, so the boundary is measured
    // rather than assumed. The watch's own mechanics (fires once, level-triggered) live in
    // e2e/watch.ts on a non-lane session, which is the principal that can hold one.
    const laneSelfWatch = await fetch(BASE + "/api/self/watch", { method: "POST", headers: selfH,
      body: JSON.stringify({ kind: "job", target: jobId, idleSec: 0 }) });
    check("(HD) a LANE is still refused 409 on /api/self/watch, job kind included — a kind was added, not a principal",
      laneSelfWatch.status === 409 && (await laneSelfWatch.text()).includes("a lane may not subscribe"),
      `${laneSelfWatch.status}`);
    const watchRes = await post(`/api/slots/${lane.slot}/watch`, { kind: "job", target: jobId, idleSec: 0 });
    const watchBody = (await watchRes.json()) as { watch?: { id?: string; kind?: string; jobId?: string; armed?: boolean } };
    check("(HD) the owner may point a job watch at this lane, and subscribing AFTER the verdict fires in the subscribe call",
      watchRes.status === 200 && watchBody.watch?.kind === "job" && watchBody.watch.jobId === jobId
        && watchBody.watch.armed === false,
      `${watchRes.status} ${JSON.stringify(watchBody)}`);
    const badWatch = await post(`/api/slots/${lane.slot}/watch`, { kind: "job", target: "ffffffffffff" });
    check("(HD) should-reject: a job watch on an id this fleet never offered is 409 — a watch that could never fire is refused at create",
      badWatch.status === 409, `${badWatch.status}`);
    await post(`/api/slots/${lane.slot}/kill`, {});
  }

  up2.proc.kill();
  await up2.proc.exited;
  proxy.stop(true);
  rmSync(WORK, { recursive: true, force: true });
  rmSync(UPD, { recursive: true, force: true });
}

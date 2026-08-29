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
import { chmodSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { BASE, ROOT, check, get, post } from "./harness";
import { driveMerge, openLane, seedRepo, type Lane } from "./lane-helpers";
// The import is not only for the four pure checks below: it is the edge that makes e2e-stage.sh
// STAGE helper-daemon/ into the throwaway instance. The copy list is derived from the entry files'
// transitive relative imports, so a daemon reached by an import rides along with no wrapper edit
// and no hand-kept list — the failure mode that killed two harnesses in this repo.
import { inQuietHours, localMode, stricter, tailOf, trailIdOf, EXIT_CONFIG,
  type HelperConfig } from "../helper-daemon/daemon";

interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string };
}
interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface LiveView { postLandAuditLive: { running: { repo: string | null; phase: string } | null } | null }

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

  // ===== (HD.2) THE SCRATCH FLEET, THE COUNTING PROXY, AND THE STAND-IN SUITE ====================
  // e2e/helper-portal.ts leaves the server on a seconds-long claim timeout — right for a lapse
  // check, fatal for a daemon that clones, installs and runs before it reports. Restarted here.
  await killSrv();
  check("(HD) setup: the server restarts with a claim timeout a real run fits inside",
    await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000" } }));
  await Bun.sleep(750);

  const DAEMON = resolve(import.meta.dir, "../helper-daemon/daemon.ts");
  check("(HD) setup: e2e-stage.sh staged helper-daemon/ into this instance (derived, not hand-listed)",
    existsSync(DAEMON), DAEMON);

  const helperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
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
  const proxy = Bun.serve({
    port: 0, hostname: "127.0.0.1",
    fetch: async (req: Request): Promise<Response> => {
      const u = new URL(req.url);
      seen.push(`${req.method} ${u.pathname}${u.search}`);
      const headers = new Headers(req.headers);
      headers.delete("host");
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
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
  // It prints its cwd, the files around it and the FLEET_* it inherited, so three facts the daemon
  // is responsible for become assertions on the ledger row instead of hopes.
  const SUITE = `${ROOT}/fakedaemonsuite`;
  await Bun.write(SUITE, [
    "#!/bin/sh",
    `echo "run pwd=$(pwd) files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] token=[\${FLEET_TOKEN:-}]"`,
    `echo "${TRAIL} stand-in trail marker"`,
    'echo "PASS  remote stand-in check one"',
    'echo "PASS  remote stand-in check two"',
    'echo "ALL PASS"',
    "exit 0",
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
  const startDaemon = (): { proc: ReturnType<typeof Bun.spawn>; log: string } => {
    const log = `${DLOG}.${++logSeq}`;
    rmSync(log, { force: true });
    // ONE fd for both streams, opened here and closed by the OS when this process ends: passing a
    // BunFile twice gives the two streams independent write positions and they overwrite each other.
    const fd = openSync(log, "a");
    return {
      proc: Bun.spawn(["bun", DAEMON, CFG],
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
  check("(HD) THE LEDGER ROW CAME BACK, green, against the exact tree that was handed over",
    remoteRow?.result === "green" && remoteRow.mainSha === jobSha && remoteRow.exitCode === 0
      && remoteRow.covers.some((c) => c.branch === job.branch),
    JSON.stringify(remoteRow).slice(0, 280));
  // THE DONE-CRITERION OF THE 2026-08-29 FIX, stated as its own check so a regression reads as what
  // it is: the whole empty-clone class ends as `unknown` with a reason, never as a red — honest,
  // and worth nothing, because nothing was measured.
  check("(HD) …and it is a MEASURED row under init.defaultBranch=master — not the `unknown` an empty clone produces",
    remoteRow?.result !== "unknown" && (remoteRow?.checks?.ran ?? 0) > 0,
    `result=${remoteRow?.result} reason=${remoteRow?.reason ?? "-"} checks=${JSON.stringify(remoteRow?.checks)}`);
  check("(HD) …and it is MARKED REMOTE with this machine's name and the trail id the daemon read out of the log",
    remoteRow?.remote?.name === DEVICE_NAME && remoteRow.remote.trail === TRAIL
      && remoteRow.remote.reportedAt >= remoteRow.remote.claimedAt,
    JSON.stringify(remoteRow?.remote));
  check("(HD) the row's checks are counted from the tail the DAEMON sent, and name the remote command",
    remoteRow?.checks?.ran === 2 && remoteRow.checks.failed === 0
      && remoteRow.cmd.includes("remote helper") && remoteRow.cmd.includes(DEVICE_NAME),
    `${JSON.stringify(remoteRow?.checks)} ${remoteRow?.cmd}`);
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

  // ===== (HD.6) THE TOKEN NEVER LEFT ITS HEADER =================================================
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
  proxy.stop(true);
  rmSync(WORK, { recursive: true, force: true });
}

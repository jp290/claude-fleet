// HOST hygiene: the fleet shuts an idle iOS Simulator down, and never one somebody holds a lease on.
//
// Two halves. The DECISION TABLE is pure and lives in e2e/host-hygiene-table.ts (it must be
// runnable without the harness — see §MUTATION at the foot). This file is the other half: a real
// server, armed with FLEET_SIM_REAP, driving STAND-INS for every host command.
//
// NOTHING HERE TOUCHES A REAL SIMULATOR, and that is a hard rule, not a preference: `xcrun simctl
// shutdown all` on the operator's box would shut down whatever they were working with, and a probe
// that read the real `ps` would make this family's verdict a property of the desktop it ran on
// (Simulator.app was up for 13 days on this machine — the very fact that started this work). All
// three commands are therefore injected: FLEET_SIMCTL_CMD, FLEET_SIM_QUIT_CMD, FLEET_SIM_PS_CMD
// point at three shell stubs written into a fixture directory, which record every call and share
// one marker file so that "the simulator is down now" is a state the stubs can actually enter.
// The lease glob points into the same fixture — never at $TMPDIR, where Fremdprojekt's real lock is.
//
// TWO HOSTS, TWO DIFFERENT TRUTHS, and §c asks each host for the one it can answer. The feature is
// darwin-only (simulator-hygiene.ts#simReapArming refuses on any other platform), and the suite runs
// on both: locally on this Mac, and on the LINUX helper when a lane offers its preview. A §c that
// asserted the reap everywhere is exactly what this family's first preview cost — 5 red rows on
// workhorse, 2026-09-16, for a host that has no simulator to shut down. So on darwin §c measures the
// ACT, and elsewhere it measures the REFUSAL: armed, with a reapable host in front of it, and not one
// stand-in call. Both halves are falsifiable — drop the platform clause from the arming and the
// non-darwin half goes red — and neither is a skip.
//
// ONE MEASURED PROPERTY OF THIS FAMILY, so the next reader does not adjudicate it twice: it drives
// tmux ONLY through restartSrv, which books its time under `boot`, never under `tmux`. Run ALONE in
// a hand-typed fine-grained shard it therefore books zero tmux ms and reds e2e/trail.ts's
// "phases is not vacuous" — measured 2026-09-16 on `FLEET_E2E_SHARD=10/16`, with `8/16`
// (deploy-facts alone, also restart-driven but tmux-touching) green as the control. Not reachable
// from the server: AUDIT_SHARDS_MAX caps a sharded run at 8, and at every n in 1..8 this unit
// shares its shard with units that drive tmux directly.
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { check, get, restartSrv, ROOT } from "./harness";
import { decisionChecks } from "./host-hygiene-table";
import { scratchReapChecks } from "./scratch-reap-checks";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-simhyg-${process.pid}`;
const CALLS = `${FIX}/calls.log`;
const DOWN = `${FIX}/down`; // the stubs' shared state: once it exists, the simulator is down
const LEASES = `${FIX}/leases`;
const LOCK = `${LEASES}/Fremdprojekt-simulator.lock`; // the name Fremdprojekt's own lock carries
const TICK_MS = 1000; // the config floor; every wait below is stated in ticks of this
// the feature exists on darwin only, so §c splits here and nowhere else (see the header)
const DARWIN = process.platform === "darwin";
const SIM_ENV: Record<string, string> = {
  FLEET_SIMCTL_CMD: `${FIX}/simctl`,
  FLEET_SIM_QUIT_CMD: `${FIX}/quit`,
  FLEET_SIM_PS_CMD: `${FIX}/ps`,
  FLEET_SIM_LEASE_GLOB: `${LEASES}/*simulator.lock`,
  FLEET_SIM_IDLE_MS: "0", // the grace is proven in the pure table; here the tick itself is the subject
  FLEET_SIM_TICK_MS: String(TICK_MS),
};

const script = (name: string, body: string): void => {
  writeFileSync(`${FIX}/${name}`, `#!/bin/sh\n${body}`);
  chmodSync(`${FIX}/${name}`, 0o755);
};

const calls = (): string[] => {
  try { return readFileSync(CALLS, "utf8").split("\n").filter(Boolean); } catch { return []; }
};
const count = (prefix: string): number => calls().filter((l) => l.startsWith(prefix)).length;

// poll for the expected shape rather than sleeping a guessed multiple of the tick: a positive
// control should not pay for the worst case, and the last reading is what a failure has to report
async function until(want: () => boolean, ms: number): Promise<boolean> {
  const stop = Date.now() + ms;
  for (;;) {
    if (want()) return true;
    if (Date.now() > stop) return false;
    await Bun.sleep(100);
  }
}
const ticks = (n: number): Promise<void> => Bun.sleep(n * TICK_MS + 500);

interface AuditRow { event?: string; detail?: string; devices?: number; app?: boolean; idleMs?: number }
const lastReapRow = (): AuditRow | null => {
  let rows: AuditRow[] = [];
  try {
    rows = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as AuditRow; } catch { return {}; } })
      .filter((r) => r.event === "simulator_reap");
  } catch { return null; }
  return rows.at(-1) ?? null;
};

const serverLog = (): string => {
  try { return readFileSync(`${ROOT}/server.log`, "utf8"); } catch { return ""; }
};

// ===== §e THE SCRATCH REAP: what scratch-reap.sh removes, and what it must never remove =====
//
// Needs no server, so it runs first and costs nothing. It drives THE REAL SCRIPT — the same file
// e2e-isolated.sh calls at startup — against a FIXTURE root, never $TMPDIR. That is the hard rule
// this family already lives by: a probe that swept the operator's real scratch would delete the
// post-mortem of whatever red run somebody is adjudicating, which is the exact loss the script's
// evidence window exists to prevent.
//
// Both halves of the gate and both sides of the window are asserted, so neither can pass by
// accident: drop the liveness test and §e1 goes red, drop the socket test and §e2, drop the
// window comparison and §e3, drop the no-server.log clause and §e5 — see §MUTATION at the foot.
// The family itself lives in e2e/scratch-reap-checks.ts, runnable WITHOUT this file's harness
// import, exactly like the decision table — same reason, same parameter pattern.
export async function run(): Promise<void> {
  const hostView = await (await get("/api/operational-view")).json() as { diskSpace?: {
    minimumFreeBytes: number; writerReserveBytes: number } };
  check("host-disk suite instance explicitly uses small disk reserves for stand-in writers",
    hostView.diskSpace?.minimumFreeBytes === 0.001 * 1024 ** 3
      && hostView.diskSpace.writerReserveBytes === 0.001 * 1024 ** 3, JSON.stringify(hostView.diskSpace));
  await diskSpaceChecks(check);
  decisionChecks(check);
  await scratchReapChecks(check);

  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(LEASES, { recursive: true });
  // the simctl stand-in: records its argv, answers `list` in simctl's own JSON shape, and lets
  // `shutdown` put the pair into the down state so a second reap has nothing left to find
  script("simctl", `printf 'simctl %s\\n' "$*" >> '${CALLS}'
case "$1" in
  list) if [ -e '${DOWN}' ]; then printf '{"devices":{"iOS-18-0":[]}}\\n'
        else printf '{"devices":{"iOS-18-0":[{"state":"Booted","udid":"E2E"}]}}\\n'; fi ;;
  shutdown) : > '${DOWN}' ;;
esac
exit 0
`);
  script("quit", `printf 'quit\\n' >> '${CALLS}'
: > '${DOWN}'
exit 0
`);
  // `ps -eo comm=` renders paths, never command lines (simulator-hygiene.ts's header on why), so
  // the stand-in renders one path — and nothing once the app is down
  script("ps", `printf 'ps\\n' >> '${CALLS}'
[ -e '${DOWN}' ] || printf '/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/Contents/MacOS/Simulator\\n'
exit 0
`);

  // ===== §c1 ARMED, BUT A LEASE IS HELD: the tick runs and shuts nothing down =====
  // The negative control has to prove the tick RAN — otherwise "no shutdown" is satisfied by a
  // server that never registered the timer, which is the vacuum-green shape this suite exists for.
  // The lease's owner pid is this suite's own process: alive by construction, for as long as the
  // assertion takes. (On a non-darwin host the lease is never read — the branch below says why.)
  mkdirSync(LOCK, { recursive: true });
  writeFileSync(`${LOCK}/pid`, `${process.pid}\n`);
  await restartSrv({ ...SIM_ENV, FLEET_SIM_REAP: "1" });

  if (!DARWIN) {
    // THE REFUSAL, measured where it is the truth. Everything a reap needs is in front of this
    // server — the flag is armed, the stand-ins report a booted device and a running app — and the
    // only thing standing between it and a shutdown is the platform clause. Zero calls is therefore
    // a claim about that clause and about nothing else.
    await ticks(4);
    check(`host-hygiene §c ARMED on ${process.platform}, not darwin: no tick is registered — not one stand-in call`,
      calls().length === 0, `calls=${calls().slice(0, 4).join(" · ")}`);
    check("host-hygiene §c …and the boot line names the platform it declined on",
      serverLog().includes(`FLEET_SIM_REAP is armed but this host is ${process.platform}, not darwin`),
      serverLog().split("\n").filter((l) => l.includes("FLEET_SIM_REAP")).slice(-2).join(" · "));
  } else {
    const probed = await until(() => count("simctl list") >= 3, 20_000);
    check("host-hygiene §c the armed tick probes the host on its own cadence",
      probed, `list=${count("simctl list")} ps=${count("ps")}`);
    await ticks(3);
    check("host-hygiene §c a HELD lease (live owner pid) survives an armed tick — no shutdown, no quit",
      count("simctl shutdown") === 0 && count("quit") === 0,
      `shutdown=${count("simctl shutdown")} quit=${count("quit")} list=${count("simctl list")}`);

    // ===== §c2 THE LEASE GOES AWAY: exactly one shutdown and exactly one quit =====
    // No restart: the lease is re-probed every pass, so removing it is the whole stimulus.
    rmSync(LEASES, { recursive: true, force: true });
    mkdirSync(LEASES, { recursive: true });
    writeFileSync(CALLS, "");
    const reaped = await until(() => count("simctl shutdown") >= 1 && count("quit") >= 1, 20_000);
    check("host-hygiene §c with no lease held, the idle simulator is shut down and the app quit",
      reaped, `shutdown=${count("simctl shutdown")} quit=${count("quit")} calls=${calls().length}`);
    check("host-hygiene §c the shutdown comes BEFORE the quit — a quit first would strand booted devices",
      calls().findIndex((l) => l.startsWith("simctl shutdown")) >= 0
        && calls().findIndex((l) => l.startsWith("simctl shutdown")) < calls().findIndex((l) => l.startsWith("quit")),
      calls().filter((l) => !l.startsWith("ps") && !l.startsWith("simctl list")).join(" · "));
    await ticks(4);
    check("host-hygiene §c EXACTLY one shutdown and one quit — four further ticks over a down host add none",
      count("simctl shutdown") === 1 && count("quit") === 1,
      `shutdown=${count("simctl shutdown")} quit=${count("quit")} after ${count("simctl list")} probes`);
    const row = lastReapRow();
    check("host-hygiene §c the act leaves ONE audit row carrying device count, app yes/no and duration",
      row !== null && row.devices === 1 && row.app === true && typeof row.idleMs === "number"
        && /booted device/.test(row.detail ?? ""),
      JSON.stringify(row));
  }

  // ===== §c3 AN UNRECOGNISED VALUE IS OFF, AND SAYS SO =====
  writeFileSync(CALLS, "");
  await restartSrv({ ...SIM_ENV, FLEET_SIM_REAP: "maybe" });
  await ticks(4);
  check("host-hygiene §c FLEET_SIM_REAP=maybe registers no tick — not one stand-in call",
    calls().length === 0, `calls=${calls().slice(0, 4).join(" · ")}`);
  check("host-hygiene §c …and the server says out loud that the typo turned it OFF",
    serverLog().includes('FLEET_SIM_REAP="maybe" is not a recognised value'),
    serverLog().split("\n").filter((l) => l.includes("FLEET_SIM_REAP")).slice(-2).join(" · "));

  // ===== §d UNSET: the feature does not exist rather than existing and declining =====
  writeFileSync(CALLS, "");
  await restartSrv(SIM_ENV);
  await ticks(4);
  check("host-hygiene §d without FLEET_SIM_REAP nothing probes the host — zero stand-in calls",
    calls().length === 0, `calls=${calls().slice(0, 4).join(" · ")}`);
  check("host-hygiene §d …and the boot line names the unset flag",
    serverLog().includes("simulator hygiene off (FLEET_SIM_REAP unset) — no tick registered"),
    serverLog().split("\n").filter((l) => l.includes("simulator hygiene")).slice(-2).join(" · "));

  // back to the wrapper's own env, exactly as this family found the server
  await restartSrv();
  if (existsSync(FIX)) rmSync(FIX, { recursive: true, force: true });
}

export async function diskSpaceChecks(assert: (name: string, ok: boolean, detail?: string) => void,
  source = readFileSync(`${ROOT}/server.ts`, "utf8")): Promise<void> {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const fn = (name: string): string => {
    const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
    const end = source.indexOf("\n}\n", start);
    if (start < 0 || end < start) throw Error(`disk fixture missing ${name}`);
    return source.slice(start, end + 3);
  };
  const diskStart = source.indexOf("const DISK_GIB =");
  const diskEnd = source.indexOf("// --- end host disk admission ---", diskStart);
  const actual = source.slice(diskStart, diskEnd) + fn("tickDispatch") + fn("drainPostLandAudits")
    + fn("kickAuditDrain") + fn("makeOperationalView");
  type Space = { state: string; reason: string | null; freeBytes: number | null; minimumFreeBytes: number;
    writerReserveBytes: number; runningWriters: number; reservedBytes: number; availableBytes: number | null;
    path: string; measuredAt: number };
  type View = { diskSpace: Space; data: { startable: { id: string }[] } | null };
  type Fixture = { clock: { free: number; unreadable: boolean }; queue: Map<string, { covers: { mainAfter: string }[] }>;
    tasks: { status: string; note?: string }[]; override(value: string | undefined, fallback: number): number; counts: { audits: number; lanes: number; ticks: number; measurements: number };
    measure(): Space; timer(): ReturnType<typeof setInterval>; view: { read(): View }; flush(): Promise<void>;
    occupancy(n: number, audit?: boolean, pending?: boolean): void };
  const setup = `
    const clock = {free: 4 * 1024 ** 3, unreadable: false};
    const counts = {audits: 0, lanes: 0, ticks: 0, measurements: 0};
    const process = {env: {}};
    const tmpdir = () => '/fixture/tmp';
    const statfsSync = (path) => {counts.measurements++; if (clock.unreadable) throw Error('no reading');
      if (path !== '/fixture/tmp') throw Error('wrong measurement path'); return {bavail: clock.free, bsize: 1};};
    const slots = [], serverRuns = new Map();
    let auditRunningRepo = null, runningPostLandAudit = null, auditDraining = false;
    const auditQueue = new Map([['/fixture/repo', {main: 'main', covers: [{mainAfter: 'kept-tip', at: 1}]}]]);
    const auditShardRuns = new Map(), auditClaimableSince = new Map();
    const AUDIT_HELPER_GRACE_MS = 0, AUDIT_SHARDS = 1, HELPER_FRESH_MS = 1000, DEVICE_ONLINE_MS = 1000;
    const helperClaimOf = () => null, helperClaimBar = () => null;
    const auditConfiguredAnywhere = () => true;
    const basename = (s) => s, markAuditClaimable = () => {}, savePostLandAuditQueue = () => {};
    const settleAuditEntry = (repo) => {if (!auditQueue.get(repo).covers.length) auditQueue.delete(repo);};
    const entryRunsShortChain = () => false;
    const reportServerRun = async (key, rec, run) => run();
    const runPostLandAudit = async (repo, main, covers) => {counts.audits++; return [];};
    const enqueueAuditCover = () => {throw Error('unexpected refused cover');};
    let dispatchBusy = false;
    const DISPATCH_REPO = '/fixture/repo', DISPATCH_TICK_MS = 25, dispatchOn = true;
    const tasks = [{id: 'released', kind: 'auftrag', status: 'queued'}];
    const dispatchingTasks = new Set();
    const tickStallSensor = () => {};
    const tickOwnsRow = (t) => t.status === 'queued';
    const startPlanWaves = () => [{plan: {ids: ['released'], rows: [{id: 'released', release: {released: true}}], next: 'now'}, land: {}}];
    const programDispatchOn = () => false, programDispatchStopped = () => false;
    const taskSpawnOf = () => ({harness: 'stand-in'}), harnessOf = () => ({id: 'stand-in'});
    const harnessAutomatableFor = () => true, harnessLimitFor = () => null;
    const inRepo = () => false, repoLaneCap = () => ({max: 10, source: 'repo'});
    const variantReserveHolds = () => null, freeSessionSlot = () => ({id: 1});
    const canDeliver = async () => ({ok: true}), releaseVerdictNow = () => ({released: true, by: 'owner'});
    const saveState = () => {}, audit = () => {};
    const dispatchTask = async (next) => {counts.lanes++; next.status = 'sent'; return {ok: true, slot: 1, tail: Promise.resolve()};};
    const console = {log: () => {}};
  `;
  const finish = `
    const source = () => Object.fromEntries(['queue', 'bindings', 'addresses', 'git', 'gateAudit'].map((name) =>
      [name, {revision: 'same', observedAt: Date.now(), cadenceMs: 60000, basis: 'fixture boundary'}]));
    const scheduled = [];
    const view = makeOperationalView({bootEpoch: 1, now: Date.now, schedule: (run) => scheduled.push(run),
      observe: source, produce: async () => ({startable: [{id: 'released'}]}), diskSpace: () => hostDiskSpace});
    const flush = async () => {view.observe(); for (let i = 0; i < 5; i++) {while (scheduled.length) scheduled.shift()(); await Promise.resolve();}};
    return {clock, counts, queue: auditQueue, tasks, view, flush, measure: measureHostDiskSpace, override: diskGiBOverride,
      occupancy(n, audit = false, pending = false) {slots.length = 0; for (let i = 0; i < n; i++) slots.push({id: i, cwd: '/lane', worktree: {}});
        auditRunningRepo = audit ? '/fixture/repo' : null; diskLaneStarts.clear(); if (pending) diskLaneStarts.add(100);},
      timer() {kickAuditDrain(); return setInterval(() => {counts.ticks++; tickHostDiskSpace(); void tickDispatch();}, DISPATCH_TICK_MS);}};
  `;
  const build = (mutation: "audit" | "lane" | null): Fixture => {
    let code = actual;
    if (mutation === "audit") code = code.replace('if (measureHostDiskSpace().state === "disk-space-held") break;', 'if (false) break;');
    if (mutation === "lane") code = code.replace('if (space.state === "disk-space-held") { waiting(diskSpaceWaitNote(space)); continue; }', 'if (false) { waiting(diskSpaceWaitNote(space)); continue; }');
    if (mutation && code === actual) throw Error(`missing ${mutation} admission mutation`);
    return new Function(new Bun.Transpiler({loader: "ts"}).transformSync(setup + code + finish))() as Fixture;
  };
  const held = async (f: Fixture): Promise<boolean> => {
    const timer = f.timer();
    try {
      const until = Date.now() + 2000;
      while (f.counts.ticks < 4 && Date.now() < until) await Bun.sleep(10);
      return f.counts.ticks >= 4 && f.counts.audits === 0 && f.counts.lanes === 0;
    } finally { clearInterval(timer); }
  };
  const f = build(null);
  assert("host-disk low space holds due audit and released lane through four scheduler ticks", await held(f), JSON.stringify(f.counts));
  assert("host-disk held audit keeps its exact cover; released lane remains queued with named hold",
    f.queue.get('/fixture/repo')?.covers[0]?.mainAfter === 'kept-tip' && f.tasks[0].status === 'queued'
      && f.tasks[0].note?.includes('disk-space-held') === true, JSON.stringify(f.tasks));
  await f.flush();
  const routeStart = source.indexOf('    if (url.pathname === "/api/operational-view" && req.method === "GET")');
  const routeEnd = source.indexOf(';', routeStart) + 1;
  if (routeStart < 0 || routeEnd <= routeStart) throw Error('missing operational GET route');
  const handler = new Function('operationalView', 'json', 'return (req) => {const url = new URL(req.url);'
    + source.slice(routeStart, routeEnd) + ' return new Response(null, {status: 404});}')(f.view, Response.json) as (req: Request) => Response;
  const srv = Bun.serve({hostname: '127.0.0.1', port: 0, fetch: handler});
  const fix = mkdtempSync(`${tmpdir()}/fleet-e2e-disk-view-`);
  try {
    const v = await (await fetch(`http://127.0.0.1:${srv.port}/api/operational-view`)).json() as View;
    assert("host-disk operational GET shows measured free bytes, strict threshold, reserve and TMPDIR location",
      v.diskSpace.state === 'disk-space-held' && v.diskSpace.freeBytes === 4 * 1024 ** 3
      && v.diskSpace.minimumFreeBytes === 4 * 1024 ** 3 && v.diskSpace.writerReserveBytes === 3.6 * 1024 ** 3
      && v.diskSpace.path === '/fixture/tmp' && v.diskSpace.measuredAt > 0 && v.data?.startable.length === 0, JSON.stringify(v.diskSpace));
    writeFileSync(`${fix}/view.json`, JSON.stringify(v));
    const stateHome = existsSync(`${ROOT}/state.sh`) ? ROOT
      : dirname(resolve(ROOT, readlinkSync(`${ROOT}/node_modules`)));
    writeFileSync(`${fix}/state.sh`, readFileSync(`${stateHome}/state.sh`, 'utf8'));
    writeFileSync(`${fix}/ctl.sh`, '#!/bin/sh\ncat "$(dirname "$0")/view.json"\n');
    chmodSync(`${fix}/ctl.sh`, 0o755);
    const brief = spawnSync('sh', [`${fix}/state.sh`, '--brief'], {encoding: 'utf8', env: {...process.env, FLEET_SELF_TOKEN: ''}});
    assert("host-disk state.sh --brief renders the held measurement, threshold and location from operational GET",
      brief.status === 0 && brief.stdout.includes('host-disk disk-space-held freeBytes=4294967296 minimumFreeBytes=4294967296')
        && brief.stdout.includes('path=/fixture/tmp'), brief.stdout.split('\n').filter((l) => l.includes('host-disk')).join(' '));
  } finally { srv.stop(true); rmSync(fix, {recursive: true, force: true}); }
  f.clock.free = 12 * 1024 ** 3;
  f.occupancy(0);
  assert("host-disk 12 GiB permits first start", f.measure().state === 'ready');
  f.occupancy(1);
  assert("host-disk 12 GiB permits second beside one writer", f.measure().state === 'ready');
  f.occupancy(2);
  assert("host-disk literal existing-writer rule permits third at 12 GiB (4.8 GiB remains)", f.measure().state === 'ready');
  f.occupancy(3);
  assert("host-disk existing-writer rule holds fourth at 12 GiB", f.measure().state === 'disk-space-held');
  assert("host-disk positive GiB override takes effect; invalid, zero and negative keep defaults",
    f.override('5', 4) === 5 * 1024 ** 3 && ['bad', '0', '-1', 'Infinity', '1e308', ''].every((v) => f.override(v, 4) === 4 * 1024 ** 3));
  f.occupancy(0, true, true);
  assert("host-disk counts local audit and pending lane before it has a worktree", f.measure().runningWriters === 2 && f.measure().reservedBytes === 7.2 * 1024 ** 3);
  f.occupancy(0);
  f.clock.unreadable = true;
  assert("host-disk unreadable filesystem holds starts with explicit failed measurement",
    f.measure().reason === 'measurement-failed' && f.measure().freeBytes === null);
  f.clock.unreadable = false;
  const timer = f.timer();
  try {
    const until = Date.now() + 2000;
    while ((f.counts.audits !== 1 || f.counts.lanes !== 1) && Date.now() < until) await Bun.sleep(10);
    assert("host-disk recovery automatically runs retained audit and released lane exactly once",
      f.counts.audits === 1 && f.counts.lanes === 1 && f.queue.size === 0 && f.tasks[0].status === 'sent', JSON.stringify(f.counts));
    await Bun.sleep(100);
    assert("host-disk further ticks duplicate neither audit nor lane", f.counts.audits === 1 && f.counts.lanes === 1, JSON.stringify(f.counts));
    await f.flush();
    assert("host-disk recovery clears operational hold", f.view.read().diskSpace.state === 'ready');
  } finally { clearInterval(timer); }
  for (const mutation of ['audit', 'lane'] as const) {
    const mutant = build(mutation);
    assert(`host-disk removing ${mutation} hold makes the same negative probe red`, !(await held(mutant)), JSON.stringify(mutant.counts));
  }
}

// §MUTATION — the proof that §b can fail, and the cheapest one available.
//
//   1. in simulator-hygiene.ts#decideSimulatorReap, delete the two lease clauses (the `unknown`
//      find and the `held` find, six lines).
//   2. run the table alone from the repo root — no server, no suite mutex, seconds. (The module
//      path is spelled in SINGLE quotes on purpose: e2e-stage.sh scans every staged file for a
//      double-quoted relative specifier after `from`/`import` and refuses, fatally, to boot an
//      instance where one resolves to nothing — and in a comment none of them resolves.)
//        bun -e "const m = await import('./e2e/host-hygiene-table');
//          let f = 0; m.decisionChecks((n, ok, d) => { if (!ok) { f++; console.log('FAIL', n, d); } });
//          console.log(f ? f + ' FAILURES' : 'ALL PASS')"
//   3. red, and specifically: both §b lease refusals, both §b ordering rows and §b's
//      no-two-refusals-share-a-reason row — five rows, because a simulator somebody is holding
//      would now be shut down under them.
//   4. restore.
//
// §MUTATION for §e — four edits to scratch-reap.sh, each of which must turn exactly ONE row red
// and no other. Run against a fixture root, so none of it needs the suite or the mutex; the four
// were measured on 2026-09-17 and each behaved as stated. The family is driven from its own
// module, so it runs alone like the table:
//   bun -e "const m = await import('./e2e/scratch-reap-checks');
//     let f = 0; await m.scratchReapChecks((n, ok, d) => { if (!ok) { f++; console.log('FAIL', n, d); } });
//     console.log(f ? f + ' FAILURES' : 'ALL PASS')"
//
//   1. delete the `kill -0` gate          → §e1 alone (the live run's instance is swept)
//   2. delete the `fleettest<pid>` gate   → §e2 alone
//   3. make the window test `if true`     → §e3 alone (a red run inside the window is swept)
//   4. make the no-server.log test `if false` → §e5 alone (litter survives)
//
// Each also moves §e's tally row, which is the point of asserting the tally: a mutation that
// changed the counts without changing a survivor would otherwise pass unnoticed.

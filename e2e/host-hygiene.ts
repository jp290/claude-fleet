// HOST hygiene: the disk-space admission and host brake (diskSpaceChecks) and the scratch reap (§e).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { check, get, ROOT } from "./harness";
import { scratchReapChecks } from "./scratch-reap-checks";

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
// import.
export async function run(): Promise<void> {
  const hostView = await (await get("/api/operational-view")).json() as { diskSpace?: {
    minimumFreeBytes: number; writerReserveBytes: number } };
  check("host-disk suite instance explicitly uses small disk reserves for stand-in writers",
    hostView.diskSpace?.minimumFreeBytes === 0.001 * 1024 ** 3
      && hostView.diskSpace.writerReserveBytes === 0.001 * 1024 ** 3, JSON.stringify(hostView.diskSpace));
  await diskSpaceChecks(check);
  await scratchReapChecks(check);
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
  type Fixture = { clock: { free: number; unreadable: boolean; load5: number; swapUsed: number }; queue: Map<string, { covers: { mainAfter: string }[] }>;
    tasks: { status: string; note?: string }[]; override(value: string | undefined, fallback: number): number; counts: { audits: number; lanes: number; ticks: number; measurements: number };
    measure(): Space; timer(): ReturnType<typeof setInterval>; view: { read(): View }; flush(): Promise<void>;
    occupancy(n: number, gates?: number, audit?: boolean, holder?: "foreign" | "own" | "child" | "dead" | "missing" | "invalid" | "denied"): void };
  const setup = `
    const clock = {free: 3 * 1024 ** 3, unreadable: false, load5: 1, swapUsed: 100};
    const counts = {audits: 0, lanes: 0, ticks: 0, measurements: 0};
    let holder = 'missing';
    const SUITE_LOCK = '/fixture/suite-lock';
    const process = {env: FIXTURE_ENV, platform: 'darwin', pid: 10, kill(pid, signal) {
      if (signal !== 0) throw Error('sensor must not signal a process');
      if (holder === 'dead') throw Object.assign(Error('gone'), {code: 'ESRCH'});
      if (holder === 'denied') throw Object.assign(Error('permission'), {code: 'EPERM'});
    }};
    const readFileSync = (path) => {if (path !== SUITE_LOCK + '/pid') throw Error('wrong lock path');
      if (holder === 'missing') throw Error('absent');
      return holder === 'invalid' ? '0' : holder === 'own' ? '10' : '20';};
    // the host brake's two reads: 5-min load, and swap as sysctl prints it, of 1000 M
    const loadavg = () => [0, clock.load5, 0];
    const Bun = {spawnSync(args) {if (args.join(' ') === '/usr/sbin/sysctl -n vm.swapusage')
      return {exitCode: 0, stdout: new TextEncoder().encode('total = 1000.00M  used = ' + clock.swapUsed + '.00M  free = 0.00M  (encrypted)')};
      if (args.join(' ') !== 'ps -o ppid= -p 20') throw Error('unexpected ancestry command');
      return {exitCode: 0, stdout: new TextEncoder().encode(holder === 'child' ? '10' : '1')};}};
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
    const harnessAutomatableFor = () => true, harnessLimitFor = () => null, harnessPausedError = () => null;
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
      occupancy(n, gates = 0, audit = false, lock = 'missing') {slots.length = 0; for (let i = 0; i < n; i++) slots.push({id: i, cwd: '/lane', worktree: {}});
        auditRunningRepo = audit ? '/fixture/repo' : null; holder = lock; serverRuns.clear();
        for (let i = 0; i < gates; i++) serverRuns.set('land:' + i, {});
        if (audit) serverRuns.set('audit', {});},
      timer() {kickAuditDrain(); return setInterval(() => {counts.ticks++; tickHostDiskSpace(); void tickDispatch();}, DISPATCH_TICK_MS);}};
  `;
  const build = (mutation: "audit" | "lane" | "lanes-count" | "suite-reserve" | "brake-default" | null,
    env: Record<string, string> = {}): Fixture => {
    let code = actual;
    if (mutation === "audit") code = code.replace('if (measureHostDiskSpace().state === "disk-space-held") break;', 'if (false) break;');
    if (mutation === "lane") code = code.replace('if (space.state === "disk-space-held") { waiting(diskSpaceWaitNote(space)); continue; }', 'if (false) { waiting(diskSpaceWaitNote(space)); continue; }');
    if (mutation === "lanes-count") code = code.replace('const runningWriters = gates +', 'const runningWriters = slots.length + gates +');
    if (mutation === "suite-reserve") code = code.replace('const runningWriters = gates + (auditRunningRepo ? 1 : 0) + foreignDiskSuiteCount();', 'const runningWriters = 0;');
    if (mutation === "brake-default") code = code.replace('if (value === undefined) return fallback;', 'if (value === undefined) return null;');
    if (mutation && code === actual) throw Error(`missing ${mutation} admission mutation`);
    return new Function("FIXTURE_ENV", new Bun.Transpiler({loader: "ts"}).transformSync(setup + code + finish))(env) as Fixture;
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
    assert("host-disk operational GET shows measured free bytes, threshold, reserve and TMPDIR location",
      v.diskSpace.state === 'disk-space-held' && v.diskSpace.freeBytes === 3 * 1024 ** 3
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
      brief.status === 0 && brief.stdout.includes('host-disk disk-space-held freeBytes=3221225472 minimumFreeBytes=4294967296')
        && brief.stdout.includes('path=/fixture/tmp'), brief.stdout.split('\n').filter((l) => l.includes('host-disk')).join(' '));
  } finally { srv.stop(true); rmSync(fix, {recursive: true, force: true}); }
  f.clock.free = 12 * 1024 ** 3;
  const suitesOnly = (probe: Fixture): boolean => {
    probe.clock.free = 12 * 1024 ** 3;
    probe.occupancy(10);
    const idle = probe.measure();
    probe.occupancy(10, 1, true, 'foreign');
    const busy = probe.measure();
    return idle.state === 'ready' && idle.runningWriters === 0 && idle.reservedBytes === 0
      && busy.state === 'disk-space-held' && busy.runningWriters === 3 && busy.reservedBytes === 10.8 * 1024 ** 3;
  };
  assert("host-disk 12 GiB and ten open lanes are ready without suites, held with three local suites", suitesOnly(f));
  for (const mutation of ['lanes-count', 'suite-reserve'] as const)
    assert(`host-disk ${mutation} mutation makes the same suites-only admission claim red`, !suitesOnly(build(mutation)));
  f.occupancy(10, 2);
  assert("host-disk two local suites leave 4.8 GiB at 12 GiB and permit a lane start", f.measure().state === 'ready');
  for (const holder of ['own', 'child', 'dead', 'missing', 'invalid'] as const) {
    f.occupancy(10, 0, true, holder);
    assert(`host-disk ${holder} mutex adds no suite; local audit is counted once`, f.measure().runningWriters === 1);
  }
  f.occupancy(10, 0, false, 'denied');
  assert("host-disk signal-zero EPERM counts a live foreign suite", f.measure().runningWriters === 1);
  assert("host-disk positive GiB override takes effect; invalid, zero and negative keep defaults",
    f.override('5', 4) === 5 * 1024 ** 3 && ['bad', '0', '-1', 'Infinity', '1e308', ''].every((v) => f.override(v, 4) === 4 * 1024 ** 3));
  f.occupancy(10);
  f.clock.free = 4 * 1024 ** 3;
  assert("host-disk corrected floor permits exactly 4 GiB with zero local suites", f.measure().state === 'ready');
  f.clock.free = 12 * 1024 ** 3;
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

  // THE HOST BRAKE UNSET IS ARMED (server.ts#hostBrakeMax): 5-min load above 25 or swap above 70 %
  // holds an unattended lane start, at or below lets it go, `off` disarms. Same slice, 12 GiB free so
  // the disk holds nothing; the readings go through the sensor's own loadavg and sysctl parse.
  const brakeRun = async (env: Record<string, string>, load5: number, swapUsed: number,
    mutation: "brake-default" | null = null) => {
    const b = build(mutation, env);
    Object.assign(b.clock, { free: 12 * 1024 ** 3, load5, swapUsed });
    const timer = b.timer();
    try {
      const until = Date.now() + 2000;
      while (b.counts.ticks < 4 && b.counts.lanes === 0 && Date.now() < until) await Bun.sleep(10);
    } finally { clearInterval(timer); }
    return { ticks: b.counts.ticks, lanes: b.counts.lanes, status: b.tasks[0].status, note: b.tasks[0].note ?? "" };
  };
  const loadHigh = await brakeRun({}, 26, 100);
  assert("host-brake unset: load5 26 over the default 25 holds the released lane four ticks, the note names reading and threshold",
    loadHigh.ticks >= 4 && loadHigh.lanes === 0 && loadHigh.status === "queued"
      && loadHigh.note.startsWith("waiting: host-brake load5=26 (max 25) swapPct=10 (max 70)"), JSON.stringify(loadHigh));
  const swapHigh = await brakeRun({}, 1, 710);
  assert("host-brake unset: swap 71 % over the default 70 holds the released lane four ticks, the note names reading and threshold",
    swapHigh.ticks >= 4 && swapHigh.lanes === 0 && swapHigh.status === "queued"
      && swapHigh.note.startsWith("waiting: host-brake load5=1 (max 25) swapPct=71 (max 70)"), JSON.stringify(swapHigh));
  const atLimits = await brakeRun({}, 25, 700);
  assert("host-brake unset: at exactly load5 25 and swap 70 % the released lane starts — only above holds",
    atLimits.lanes === 1 && atLimits.status === "sent" && !atLimits.note.includes("host-brake"), JSON.stringify(atLimits));
  const off = await brakeRun({ FLEET_HOST_LOAD_MAX: "off", FLEET_HOST_SWAP_MAX_PCT: "off" }, 40, 900);
  assert("host-brake `off` disarms both halves: at load5 40 and swap 90 % the released lane starts",
    off.lanes === 1 && off.status === "sent", JSON.stringify(off));
  const noDefault = await brakeRun({}, 26, 100, "brake-default");
  assert("host-brake removing the unset default makes the load-26 hold red", noDefault.lanes === 1, JSON.stringify(noDefault));
}

// §MUTATION for §e — four edits to scratch-reap.sh, each of which must turn exactly ONE row red
// and no other. Run against a fixture root, so none of it needs the suite or the mutex; the four
// were measured on 2026-09-17 and each behaved as stated. The family is driven from its own
// module, so it runs alone:
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

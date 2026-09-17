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
// The lease glob points into the same fixture — never at $TMPDIR, where private-repo-p's real lock is.
//
// TWO HOSTS, TWO DIFFERENT TRUTHS, and §c asks each host for the one it can answer. The feature is
// darwin-only (simulator-hygiene.ts#simReapArming refuses on any other platform), and the suite runs
// on both: locally on this Mac, and on the LINUX helper when a lane offers its preview. A §c that
// asserted the reap everywhere is exactly what this family's first preview cost — 5 red rows on
// second-host, 2026-09-16, for a host that has no simulator to shut down. So on darwin §c measures the
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
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { check, restartSrv, ROOT } from "./harness";
import { decisionChecks } from "./host-hygiene-table";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-simhyg-${process.pid}`;
const CALLS = `${FIX}/calls.log`;
const DOWN = `${FIX}/down`; // the stubs' shared state: once it exists, the simulator is down
const LEASES = `${FIX}/leases`;
const LOCK = `${LEASES}/private-repo-p-simulator.lock`; // the name private-repo-p's own lock carries
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
function scratchReapChecks(): void {
  const FIXROOT = `${TMP}/fleet-e2e-reapfix-${process.pid}`;
  const SOCKS = `${FIXROOT}/tmux-${process.getuid?.() ?? 0}`;
  const DEAD = 999_999; // the same unreachable-pid idiom the lease table uses
  const HOURS = 3_600_000;
  const reaper = `${ROOT}/scratch-reap.sh`;

  // a probe that could not run must fail AS ITSELF, never as a green row about the subject
  if (!existsSync(reaper)) {
    check("host-hygiene §e scratch-reap.sh is staged into the instance", false,
      `absent at ${reaper} — add it to STAGE_EXTRA in e2e-isolated.sh`);
    return;
  }

  rmSync(FIXROOT, { recursive: true, force: true });
  mkdirSync(SOCKS, { recursive: true });
  interface Fixture { pid: number; hasLog: boolean; ageH: number; dir: string }
  const mk = (pid: number, hasLog: boolean, ageH: number): Fixture =>
    ({ pid, hasLog, ageH, dir: `${FIXROOT}/fleet-e2e-instance-${pid}` });
  const live = mk(process.pid, true, 72);  // §e1 pid alive — a RUNNING suite's instance
  const socketed = mk(DEAD, true, 72);     // §e2 pid dead but its fleettest socket is still there
  const redFresh = mk(DEAD + 1, true, 1);  // §e3 a red run's evidence, inside the window
  const redOld = mk(DEAD + 2, true, 72);   // §e4 the same, aged out
  const nolog = mk(DEAD + 3, false, 0);    // §e5 never booted: no server.log, no verdict, no doubt
  for (const f of [live, socketed, redFresh, redOld, nolog]) {
    mkdirSync(f.dir, { recursive: true });
    writeFileSync(`${f.dir}/fixture`, String(f.pid));
    if (f.hasLog) writeFileSync(`${f.dir}/server.log`, "listening\n");
    const t = new Date(Date.now() - f.ageH * HOURS);
    utimesSync(f.dir, t, t);
  }
  writeFileSync(`${SOCKS}/fleettest${DEAD}`, ""); // stands in for the live run's socket

  const r = spawnSync(reaper, [FIXROOT], {
    encoding: "utf8",
    env: { ...process.env, TMUX_TMPDIR: FIXROOT, FLEET_E2E_SCRATCH_RETENTION_H: "48" },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n").slice(-1)[0] ?? "";

  check("host-hygiene §e1 a dir whose pid is ALIVE survives, however old — a running suite is not litter",
    existsSync(live.dir), `${live.dir} · ${out}`);
  check("host-hygiene §e2 a dead pid whose fleettest socket still exists survives — both gate halves count",
    existsSync(socketed.dir), `${socketed.dir} · ${out}`);
  check("host-hygiene §e3 a red run's instance INSIDE the 48h window survives — the evidence the seam kept",
    existsSync(redFresh.dir), `${redFresh.dir} · ${out}`);
  check("host-hygiene §e4 …and the same instance past the window is reaped, so the window is a window",
    !existsSync(redOld.dir), `${redOld.dir} · ${out}`);
  check("host-hygiene §e5 an instance with no server.log is reaped at once — it booted nothing and holds no verdict",
    !existsSync(nolog.dir), `${nolog.dir} · ${out}`);
  check("host-hygiene §e the sweep reports what it did and exits clean",
    r.status === 0 && /2 reaped · 1 within the 48h window · 2 held by a live run/.test(out),
    `status=${r.status} tail=${out}`);

  rmSync(FIXROOT, { recursive: true, force: true });
}

export async function run(): Promise<void> {
  decisionChecks(check);
  scratchReapChecks();

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
// were measured on 2026-09-17 and each behaved as stated.
//
//   1. delete the `kill -0` gate          → §e1 alone (the live run's instance is swept)
//   2. delete the `fleettest<pid>` gate   → §e2 alone
//   3. make the window test `if true`     → §e3 alone (a red run inside the window is swept)
//   4. make the no-server.log test `if false` → §e5 alone (litter survives)
//
// Each also moves §e's tally row, which is the point of asserting the tally: a mutation that
// changed the counts without changing a survivor would otherwise pass unnoticed.

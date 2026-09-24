// The scratch-reap check family — §e of e2e/host-hygiene.ts, in a module of its own for the same
// reason its decision table lives in one: it must be runnable WITHOUT e2e/harness.ts (the harness
// refuses to import outside a wrapper — no fleet.json, live-port refusal). The recorder is a
// PARAMETER, not an import: the suite passes harness.ts#check so every row lands in the results
// and the trail, and the §MUTATION proof passes a two-line counter of its own.
//
// What it drives: THE REAL scratch-reap.sh — the same file e2e-isolated.sh calls at startup —
// against a FIXTURE root passed as the script's argument, never $TMPDIR. That is the hard rule
// this family already lives by: a probe that swept the operator's real scratch would delete the
// post-mortem of whatever red run somebody is adjudicating, which is the exact loss the script's
// evidence window exists to prevent. Since 2026-09-24 the sweep follows its argument for BOTH
// families it owns, so this fixture root is also where the testinstanz fixtures go.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckFn } from "./host-hygiene-table";

const TMP = process.env.TMPDIR ?? "/tmp";
const ROOT = resolve(import.meta.dir, "..");

export async function scratchReapChecks(check: CheckFn): Promise<void> {
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

  // THE TESTINSTANZ FAMILY (report 5bf7a230, rejected 2026-09-24): expiry gives authority over
  // the INSTANCE, never over a PID NUMBER. A recycled pid belongs to a stranger, so the sweep
  // signals the noted pid only when it still HOLDS the port its own state file records. A live
  // foreign `sleep` stands in for the stranger (alive, bound to nothing); a real listener stands
  // in for the instance. Both are expired by their state files; one reap run decides both.
  const TI_FOREIGN = `${FIXROOT}/fleet-testinstanz-e2efix-foreign`;
  const TI_OURS = `${FIXROOT}/fleet-testinstanz-e2efix-ours`;
  const TI_PORT_FREE = 8943; // bound by nobody — the sleep's port on paper only
  const TI_PORT_OURS = 8944; // bound by the stand-in below
  const tiState = (dir: string, pid: string, port: number): string =>
    `src=${dir}\nport=${port}\nsock=fleettie2efix\ndir=${dir}\npid=${pid}\nstarted=1\n` +
    `ttlMin=1\nexpiresAt=${Math.floor(Date.now() / 1000) - 3600}\n`;
  const sleepChild = spawn("sleep", ["120"]);
  const holdChild = spawn("python3", ["-c",
    "import socket,time,sys; s=socket.socket(); s.bind(('127.0.0.1', int(sys.argv[1]))); s.listen(1); time.sleep(120)",
    String(TI_PORT_OURS)]);
  mkdirSync(TI_FOREIGN, { recursive: true });
  mkdirSync(TI_OURS, { recursive: true });
  writeFileSync(`${TI_FOREIGN}/testinstanz.state`, tiState(TI_FOREIGN, String(sleepChild.pid), TI_PORT_FREE));
  writeFileSync(`${TI_OURS}/testinstanz.state`, tiState(TI_OURS, String(holdChild.pid ?? -1), TI_PORT_OURS));

  const hasLsof = spawnSync("lsof", ["-v"]).status !== null;
  // the §e7 precondition: the stand-in really LISTENS before the reap runs — a probe that could
  // not come up must fail AS ITSELF, never as a green row about the gate
  let holderReady = false;
  if (hasLsof && holdChild.pid) {
    holderReady = spawnSync("sh", ["-c",
      `for i in 1 2 3 4 5 6 7 8 9 10; do [ "$(lsof -nP -iTCP:${TI_PORT_OURS} -sTCP:LISTEN -t 2>/dev/null)" = "${holdChild.pid}" ] && exit 0; sleep 0.2; done; exit 1`],
      { encoding: "utf8" }).status === 0;
  }
  check("host-hygiene §e7 probe could come up: the stand-in holds its port before the reap",
    !hasLsof || holderReady, `lsof=${hasLsof} holder pid=${holdChild.pid} port=${TI_PORT_OURS}`);

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

  // the testinstanz verdicts, read off the SAME single reap run. FIRST turn the event loop:
  // the reaper's SIGTERM landed while this process was sync-blocked in the spawnSync above, so
  // a killed holder is a ZOMBIE until the parent waits — and `kill -0` answers "alive" for a
  // zombie (measured: the gate killed it, the check still read it as alive). The exit event is
  // the truth; `kill -0` stays as the fallback for a pid already gone. The race is bounded so a
  // gate that wrongly SPARED the holder costs two seconds, not the stand-in's 120.
  await Promise.race([
    new Promise<void>((res) => {
      if (holdChild.exitCode !== null || holdChild.signalCode) res();
      else holdChild.once("exit", () => res());
    }),
    new Promise<void>((res) => setTimeout(res, 2000)),
  ]);
  const fullOut = `${r.stdout ?? ""}`;
  check("host-hygiene §e6 an expired instance whose noted pid is alive but holds NO port is spared — a recycled pid is a stranger",
    sleepChild.pid !== undefined && spawnSync("kill", ["-0", String(sleepChild.pid)]).status === 0
      && !existsSync(TI_FOREIGN),
    `sleep pid=${sleepChild.pid} dirRemoved=${!existsSync(TI_FOREIGN)}`);
  const holdKilled = holdChild.pid !== undefined
    && (holdChild.signalCode !== null || holdChild.exitCode !== null
        || spawnSync("kill", ["-0", String(holdChild.pid)]).status !== 0);
  if (hasLsof) {
    check("host-hygiene §e7 an expired instance whose noted pid HOLDS the state file's port is killed — identity is the port, not the number",
      holderReady && holdKilled && !existsSync(TI_OURS),
      `holder pid=${holdChild.pid} killed=${holdKilled} dirRemoved=${!existsSync(TI_OURS)}`);
  } else {
    check("host-hygiene §e7 without lsof the gate cannot prove identity and spares the holder — the safe direction, stated",
      !holdKilled && !existsSync(TI_OURS),
      `holder pid=${holdChild.pid} killed=${holdKilled} dirRemoved=${!existsSync(TI_OURS)}`);
  }
  check("host-hygiene §e the testinstanz sweep counts both fixtures reaped",
    fullOut.includes("[testinstanz-reap] 2 expired reaped"),
    fullOut.split("\n").filter((l) => l.startsWith("[testinstanz-reap]")).join(" | "));
  sleepChild.kill();
  holdChild.kill();

  rmSync(FIXROOT, { recursive: true, force: true });
}

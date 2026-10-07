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
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CheckFn } from "./host-hygiene-table";

const TMP = process.env.TMPDIR ?? "/tmp";
const ROOT = resolve(import.meta.dir, "..");

export function snapshotHasWorktreeBinding(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(snapshotHasWorktreeBinding);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, v]) => (key === "worktree" && v !== null && v !== undefined)
    || snapshotHasWorktreeBinding(v));
}

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
  const tiState = (dir: string, pid: string, port: number): string =>
    `src=${dir}\nport=${port}\nsock=fleettie2efix\ndir=${dir}\npid=${pid}\nstarted=1\n` +
    `ttlMin=1\nexpiresAt=${Math.floor(Date.now() / 1000) - 3600}\n`;
  const sleepChild = spawn("sleep", ["120"]);
  const holdChild = spawn("python3", ["-u", "-c", `import socket,time
def allocate():
    for _ in range(100):
        s = socket.socket()
        s.bind(('127.0.0.1', 0))
        if not 8900 <= s.getsockname()[1] <= 8999:
            return s
        s.close()
    raise RuntimeError('no ephemeral port outside testinstanz range')
held = allocate()
held.listen(1)
free = allocate()
free_port = free.getsockname()[1]
free.close()
print(held.getsockname()[1], free_port, flush=True)
time.sleep(120)
`]);
  const portLine = await new Promise<string>((res) => {
    let output = "";
    const finish = (line: string) => {
      clearTimeout(timer);
      holdChild.stdout?.off("data", onData);
      res(line);
    };
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("\n")) finish(output.split("\n")[0]);
    };
    const timer = setTimeout(() => finish(""), 2000);
    holdChild.stdout?.on("data", onData);
    holdChild.once("error", () => finish(""));
    holdChild.once("exit", () => finish(""));
  });
  const ports = portLine.match(/^(\d+) (\d+)$/);
  const TI_PORT_OURS = Number(ports?.[1] ?? -1);
  const TI_PORT_FREE = Number(ports?.[2] ?? -1);
  const validPort = (port: number) => port > 0 && port <= 65535 && (port < 8900 || port > 8999);
  const portsReady = validPort(TI_PORT_OURS) && validPort(TI_PORT_FREE) && TI_PORT_OURS !== TI_PORT_FREE;
  mkdirSync(TI_FOREIGN, { recursive: true });
  mkdirSync(TI_OURS, { recursive: true });
  writeFileSync(`${TI_FOREIGN}/testinstanz.state`, tiState(TI_FOREIGN, String(sleepChild.pid), TI_PORT_FREE));
  writeFileSync(`${TI_OURS}/testinstanz.state`, tiState(TI_OURS, String(holdChild.pid ?? -1), TI_PORT_OURS));

  const hasLsof = spawnSync("lsof", ["-v"]).status !== null;
  // the §e7 precondition: the stand-in really LISTENS before the reap runs — a probe that could
  // not come up must fail AS ITSELF, never as a green row about the gate
  let holderReady = false;
  if (hasLsof && holdChild.pid && portsReady) {
    holderReady = spawnSync("sh", ["-c",
      `for i in 1 2 3 4 5 6 7 8 9 10; do [ "$(lsof -nP -iTCP:${TI_PORT_OURS} -sTCP:LISTEN -t 2>/dev/null)" = "${holdChild.pid}" ] && exit 0; sleep 0.2; done; exit 1`],
      { encoding: "utf8" }).status === 0;
  }
  const freePortReady = portsReady && (!hasLsof
    || spawnSync("lsof", ["-nP", `-iTCP:${TI_PORT_FREE}`, "-sTCP:LISTEN", "-t"]).status === 1);
  check("host-hygiene §e7 probe could come up: the stand-in holds its port before the reap",
    freePortReady && (!hasLsof || holderReady),
    `lsof=${hasLsof} holder pid=${holdChild.pid} port=${TI_PORT_OURS} freePort=${TI_PORT_FREE} unbound=${freePortReady}`);

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

  const modulesReady = existsSync(`${ROOT}/node_modules`);
  const source = modulesReady ? resolve(realpathSync(`${ROOT}/node_modules`), "..") : ROOT;
  const tiScript = `${source}/testinstanz.sh`;
  const tiHome = `${FIXROOT}/ti-port`;
  const canonicalRoot = realpathSync(FIXROOT);
  const hashPort = (path: string): number => {
    const sum = spawnSync("cksum", { input: path, encoding: "utf8" });
    return 8900 + Number(sum.stdout?.split(" ")[0]) % 100;
  };
  let tiSource = "";
  let tiPort = 0;
  for (let i = 0; i < 100; i++) {
    const candidate = `${canonicalRoot}/ti-source-${i}`;
    const port = hashPort(candidate);
    if (port !== 8790 && spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]).status === 1) {
      tiSource = candidate;
      tiPort = port;
      break;
    }
  }
  const ready = modulesReady && existsSync(tiScript) && tiSource !== "";
  check("host-hygiene §e8 probe can stage a testinstanz source with a free hash port",
    ready, `modules=${modulesReady} script=${existsSync(tiScript)} hashPort=${tiPort}`);
  if (ready) {
    mkdirSync(tiSource, { recursive: true });
    const copyScript = `${FIXROOT}/ti-copy.cjs`;
    writeFileSync(copyScript, `const { cpSync } = require("node:fs");
const { relative, sep } = require("node:path");
const src = process.argv.at(-2).replace(/\\/+$/, "");
const dst = process.argv.at(-1);
cpSync(src, dst, { recursive: true, filter: (path) => {
  const parts = relative(src, path).split(sep);
  return !parts.some((part) => part === ".git" || part === "node_modules" || part.startsWith(".env") || part === "fleet.pid"
    || part.startsWith("fleet.json") || part.endsWith(".jsonl"));
} });
`);
    const shimDir = `${FIXROOT}/bin`;
    mkdirSync(shimDir);
    writeFileSync(`${shimDir}/rsync`, `#!/bin/sh\nexec bun "${copyScript}" "$@"\n`, { mode: 0o755 });
    const copied = spawnSync("bun", [copyScript, source, tiSource],
      { encoding: "utf8", timeout: 30_000 });
    if (copied.status === 0) {
      const linked = spawnSync("ln", ["-s", `${source}/node_modules`, `${tiSource}/node_modules`]);
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${shimDir}:${process.env.PATH ?? ""}`,
        FLEET_TI_ROOT: tiHome, FLEET_TI_SOCK: `fleettiprobe${process.pid}`, FLEET_CMD: "true" };
      delete env.FLEET_TI_PORT;
      delete env.FLEET_TI_DIR;
      delete env.FLEET_TI_TOKEN;
      const run = (verb: string, ...args: string[]) => spawnSync(`${tiSource}/testinstanz.sh`, [verb, ...args],
        { env, encoding: "utf8", timeout: 120_000 });
      const sourceGit = (...args: string[]) => spawnSync("git", ["-C", tiSource, ...args], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
      sourceGit("init", "-q"); sourceGit("add", "testinstanz.sh");
      sourceGit("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "isolated source");
      writeFileSync(`${tiSource}/.env.bak-fixture`, "SYNTHETIC_ENV_BACKUP_SECRET\n");
      writeFileSync(`${tiSource}/fleet.pid`, "SYNTHETIC_FOREIGN_PID\n");
      const sourceHead = sourceGit("rev-parse", "HEAD").stdout;
      const sourceRefs = sourceGit("for-each-ref", "--format=%(refname) %(objectname)").stdout;
      const invalidMode = run("up", "unavailable");
      const invalidTTL = run("up", "mixed", "--ttl", "1441");
      check("testinstanz script rejects unavailable mode and invalidTTL before starting", invalidMode.status === 2 && invalidTTL.status === 2);
      try {
        if (linked.status === 0) {
          const up = run("up");
          const stateDir = `${tiHome}/fleet-testinstanz-${spawnSync("cksum", { input: tiSource,
            encoding: "utf8" }).stdout?.split(" ")[0]}`;
          const state = existsSync(`${stateDir}/testinstanz.state`)
            ? readFileSync(`${stateDir}/testinstanz.state`, "utf8") : "";
          check("host-hygiene §e8 testinstanz starts on its free hash port",
            up.status === 0 && state.includes(`\nport=${tiPort}\n`),
            `exit=${up.status} savedPort=${state.match(/^port=(.*)$/m)?.[1] ?? "missing"} tail=${up.stderr?.trim().split("\n").slice(-1)[0] ?? ""}`);
          if (up.status === 0) {
            check("testinstanz main copy excludes fleet.pid and every .env backup", !existsSync(`${stateDir}/fleet.pid`) || readFileSync(`${stateDir}/fleet.pid`, "utf8") !== "SYNTHETIC_FOREIGN_PID\n");
            check("testinstanz copy has no source environment backup", !existsSync(`${stateDir}/.env.bak-fixture`));
            const observation = run("status", "--json");
            const fact = JSON.parse(observation.stdout) as { recordedSource?: { path?: string; before?: { head?: string; dirty?: number; measuredAt?: number } };
              mode?: string; copyHead?: unknown; copyStartedAt?: number; copyFinishedAt?: number; builtAt?: number; startedAt?: number;
              procStatus?: string; httpStatus?: string; expiresAt?: number; state?: string; identity?: string };
            check("testinstanz script records source freshness separately from copy/build/start", observation.status === 0 && fact.recordedSource?.path === tiSource
              && fact.recordedSource.before?.head === sourceHead.trim() && (fact.recordedSource.before.dirty ?? 0) > 0
              && (fact.recordedSource.before.measuredAt ?? 0) > 0 && fact.mode === "mixed" && fact.copyHead === null
              && (fact.copyStartedAt ?? 0) <= (fact.copyFinishedAt ?? 0) && (fact.copyFinishedAt ?? 0) <= (fact.builtAt ?? 0)
              && (fact.builtAt ?? 0) <= (fact.startedAt ?? 0) && fact.procStatus === "alive" && fact.httpStatus === "healthy", `state=${fact.state}; proc=${fact.procStatus}; http=${fact.httpStatus}; identity=${fact.identity}; sourcePath=${fact.recordedSource?.path === tiSource}; sourceHead=${fact.recordedSource?.before?.head === sourceHead.trim()}; dirty=${fact.recordedSource?.before?.dirty}; copyTimes=${(fact.copyStartedAt ?? 0) <= (fact.copyFinishedAt ?? 0) && (fact.copyFinishedAt ?? 0) <= (fact.builtAt ?? 0) && (fact.builtAt ?? 0) <= (fact.startedAt ?? 0)}; lsofMatches=${spawnSync("lsof", ["-nP", "-a", "-p", state.match(/^pid=(.*)$/m)?.[1] ?? "0", `-iTCP:${tiPort}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).stdout.trim() === state.match(/^pid=(.*)$/m)?.[1]}`);
            const beforeState = readFileSync(`${stateDir}/testinstanz.state`, "utf8");
            const token = readFileSync(`${stateDir}/.testinstanz.token`, "utf8").trim();
            const againRead = run("status", "--json");
            check("testinstanz script Read preserves state TTL, source refs and HEAD and hides token", againRead.status === 0 && !againRead.stdout.includes(token)
              && readFileSync(`${stateDir}/testinstanz.state`, "utf8") === beforeState && sourceGit("rev-parse", "HEAD").stdout === sourceHead
              && sourceGit("for-each-ref", "--format=%(refname) %(objectname)").stdout === sourceRefs);
            writeFileSync(`${stateDir}/testinstanz.state`, beforeState.replace(/^expiresAt=.*$/m, "expiresAt=1"));
            const expired = run("status", "--json");
            const expiredFact = JSON.parse(expired.stdout) as { state?: string; remainingTTL?: number; procStatus?: string };
            check("testinstanz script reads expired TTL without cleanup", expired.status === 0 && expiredFact.state === "expired" && expiredFact.remainingTTL === 0
              && expiredFact.procStatus === "alive" && existsSync(stateDir));
            writeFileSync(`${stateDir}/testinstanz.state`, beforeState);
            const status = run("status");
            check("host-hygiene §e8 status names the saved port, not the next free port",
              new RegExp(`http://[^/]+:${tiPort}/`).test(status.stdout),
              `exit=${status.status} line=${status.stdout?.split("\n")[0]?.replace(/\?token=.*/, "?token=[redacted]") ?? ""}`);
            const again = run("up");
            check("host-hygiene §e8 up on the running instance keeps its saved port",
              again.status === 0 && again.stdout.includes("already up")
                && existsSync(`${stateDir}/testinstanz.state`)
                && readFileSync(`${stateDir}/testinstanz.state`, "utf8").includes(`\nport=${tiPort}\n`),
              `exit=${again.status} line=${again.stdout?.trim().split("\n")[0] ?? ""}`);
          }
        } else {
          check("host-hygiene §e8 probe can link its node_modules", false, `exit=${linked.status}`);
        }
      } finally {
        const down = run("down");
        check("host-hygiene §e8 down names and frees the saved port",
          down.status === 0 && down.stdout.includes(`port ${tiPort} free`)
            && spawnSync("lsof", ["-nP", `-iTCP:${tiPort}`, "-sTCP:LISTEN"]).status === 1,
          `exit=${down.status} line=${down.stdout?.trim().split("\n").slice(-1)[0] ?? ""}`);
      }
      const stateDir = `${tiHome}/fleet-testinstanz-${spawnSync("cksum", { input: tiSource, encoding: "utf8" }).stdout?.split(" ")[0]}`;
      const ownHost = spawnSync("sh", ["-c", `for t in /usr/local/bin/tailscale /Applications/Tailscale.app/Contents/MacOS/Tailscale tailscale; do a=$("$t" ip -4 2>/dev/null | head -1) && [ -n "$a" ] && { echo "$a"; exit; }; done; echo 127.0.0.1`], { encoding: "utf8" }).stdout.trim();
      const healthMode = `${FIXROOT}/http-mode`, healthReady = `${FIXROOT}/http-ready`;
      writeFileSync(healthMode, "failed");
      const httpChild = spawn("python3", ["-u", "-c", `import socket,time,pathlib
s=socket.socket();s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);s.bind(('0.0.0.0',${tiPort}));s.listen(4)
pathlib.Path(${JSON.stringify(healthReady)}).write_text('ready')
while True:
    c,_=s.accept();c.recv(4096)
    mode=pathlib.Path(${JSON.stringify(healthMode)}).read_text()
    if mode=='timeout': time.sleep(2)
    elif mode=='redirect': c.sendall(b'HTTP/1.1 302 Found\\r\\nLocation: http://example.invalid/forbidden\\r\\nContent-Length: 0\\r\\n\\r\\n')
    else: c.sendall(b'HTTP/1.1 503 Unavailable\\r\\nContent-Length: 0\\r\\n\\r\\n')
    c.close()
`]);
      try {
        const deadline = Date.now() + 5000;
        while (!existsSync(healthReady) && Date.now() < deadline && httpChild.exitCode === null) await Bun.sleep(20);
        const bound = httpChild.pid !== undefined && existsSync(healthReady);
        check("testinstanz real HTTP probe owns its listener", bound);
        if (bound) {
          mkdirSync(stateDir, { recursive: true });
          const birth = spawnSync("ps", ["-p", String(httpChild.pid), "-o", "lstart="], { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout.trim();
          writeFileSync(`${stateDir}/.testinstanz.pid`, String(httpChild.pid));
          writeFileSync(`${stateDir}/.testinstanz.token`, "SYNTHETIC_HTTP_TOKEN");
          const saved = `src=${tiSource}\nport=${tiPort}\nsock=${env.FLEET_TI_SOCK}\ndir=${stateDir}\npid=${httpChild.pid}\nbirth=${birth}\nhost=${ownHost}\nexpiresAt=2000000000\n`;
          writeFileSync(`${stateDir}/testinstanz.state`, saved);
          for (const [mode, expected] of [["failed", "http-failed"], ["redirect", "http-failed"], ["timeout", "http-timeout"]] as const) {
            writeFileSync(healthMode, mode);
            const status = run("status", "--json");
            const data = JSON.parse(status.stdout) as { state?: string; procStatus?: string; httpStatus?: string; identity?: string };
            check(`testinstanz real procAlive+HTTP ${mode} is distinct and bounded`, status.status === 0 && data.state === expected
              && data.procStatus === "alive" && data.identity === "matched" && data.httpStatus === (mode === "timeout" ? "timeout" : "failed")
              && !status.stdout.includes("SYNTHETIC_HTTP_TOKEN") && readFileSync(`${stateDir}/testinstanz.state`, "utf8") === saved,
              `state=${data.state}; proc=${data.procStatus}; http=${data.httpStatus}`);
          }
          const foreign = spawn("sleep", ["60"]);
          try {
            writeFileSync(`${stateDir}/.testinstanz.pid`, String(foreign.pid));
            const foreignBirth = spawnSync("ps", ["-p", String(foreign.pid), "-o", "lstart="], { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout.trim();
            writeFileSync(`${stateDir}/testinstanz.state`, saved.replace(/^pid=.*$/m, `pid=${foreign.pid}`).replace(/^birth=.*$/m, `birth=${foreignBirth}`));
            const down = run("down");
            check("testinstanz script refuses a foreign PID even with matching birth and keeps instance state", down.status === 2
              && foreign.pid !== undefined && spawnSync("kill", ["-0", String(foreign.pid)]).status === 0 && existsSync(`${stateDir}/testinstanz.state`));
          } finally { foreign.kill(); }
        }
      } finally { httpChild.kill(); rmSync(stateDir, { recursive: true, force: true }); }
    } else {
      check("host-hygiene §e8 probe can copy its isolated source", false,
        `exit=${copied.status} tail=${copied.stderr?.trim().split("\n").slice(-1)[0] ?? ""}`);
    }
  }

  const snapSource = `${FIXROOT}/snapshot-source`;
  const snapDir = `${FIXROOT}/snapshot-instance`;
  mkdirSync(snapSource);
  mkdirSync(snapDir);
  const marker = (name: string) => `SYNTHETIC_SECRET_${name}_${process.pid}`;
  const markers = ["owner", "steward", "helper", "device", "share", "slot", "env"].map(marker);
  writeFileSync(`${snapSource}/fleet.json`, JSON.stringify({
    token: markers[0], stewardToken: markers[1], helperToken: markers[2],
    helperDevices: [{ token: markers[3] }], shares: [{ token: markers[4] }],
    slots: { 1: { cwd: `${snapSource}/real-worktree`, selfToken: markers[5], label: "snapshot row", openedAt: Date.now() } },
    tasks: [{ id: "snapshot-task", text: `Snapshot prompt ${markers[0]} ${markers[5]}`, sessionId: "SYNTHETIC_REAL_SESSION", worktree: { repo: snapSource }, source: "owner", status: "pending", repo: snapSource }],
    programs: [], fleetReports: [], attentionRequests: [], dispatch: true, autosOn: true,
  }));
  writeFileSync(`${snapSource}/.env`, `SYNTHETIC_ENV=${markers[6]}\n`);
  for (const name of ["lane-outcomes.jsonl", "post-land-audits.jsonl", "audit.jsonl"])
    writeFileSync(`${snapSource}/${name}`, JSON.stringify({ ts: Date.now(), at: Date.now(), text: "snapshot ledger row" }) + "\n");
  const ref = () => spawnSync("git", ["-C", snapSource, "for-each-ref", "--format=%(refname) %(objectname)"], { encoding: "utf8" }).stdout;
  const head = () => spawnSync("git", ["-C", snapSource, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout;
  spawnSync("git", ["-C", snapSource, "init", "-q"]);
  spawnSync("git", ["-C", snapSource, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "fixture"]);
  const beforeRefs = ref(), beforeHead = head();
  const snapToken = marker("instance");
  const planted = spawnSync("bun", [`${source}/testinstanz-snapshot.js`], {
    env: { ...process.env, FLEET_TI_SRC: source, FLEET_TI_SNAPSHOT_SRC: snapSource,
      FLEET_TI_DIR: snapDir, FLEET_TI_SOCK: `fleettisnap${process.pid}`, FLEET_TI_TOKEN: snapToken },
    encoding: "utf8", timeout: 30_000,
  });
  check("host-hygiene §e9 snapshot probe plants a synthetic source", planted.status === 0,
    `exit=${planted.status} tail=${planted.stderr?.trim().split("\n").slice(-1)[0] ?? ""}`);
  if (planted.status === 0) {
    const markerFile = `${FIXROOT}/snapshot-markers`;
    writeFileSync(markerFile, markers.join("\n") + "\n");
    const grep = spawnSync("grep", ["-r", "-F", "-f", markerFile, snapDir], { encoding: "utf8" });
    check("host-hygiene §e9 grep -r finds no token, stewardToken, helperToken, helperDevices, shares, slot selfToken or .env marker",
      grep.status === 1, `grep exit=${grep.status}`);
    const plantedState = JSON.parse(readFileSync(`${snapDir}/fleet.json`, "utf8"));
    check("host-hygiene §e9 snapshot master stop and paths refuse a real worktree",
      plantedState.dispatch === false && plantedState.autosOn === false
        && Object.values(plantedState.slots as Record<string, unknown>).every((value) => {
          const s = value as { cwd?: unknown; worktree?: unknown };
          return s.cwd === snapDir && !s.worktree;
        })
        && plantedState.tasks[0]?.repo === snapDir,
      `dispatch=${plantedState.dispatch} autosOn=${plantedState.autosOn} cwd=${plantedState.slots[1]?.cwd}`);
    check("host-hygiene §e9 source refs and HEAD remain byte-identical after snapshot",
      ref() === beforeRefs && head() === beforeHead, "git for-each-ref and HEAD before/after");
  }

  if (ready && planted.status === 0) {
    // the same rsync shim §e8 stages: a helper host (Linux, no rsync) otherwise dies at the staging
    // copy with exit 127 before the snapshot is ever read (helper job bb9cc4f9a026, 2026-09-29)
    const env = { ...process.env, PATH: `${FIXROOT}/bin:${process.env.PATH ?? ""}`,
      FLEET_TI_DIR: snapDir, FLEET_TI_PORT: String(tiPort),
      FLEET_TI_SOCK: `fleettisnap${process.pid}`, FLEET_TI_SNAPSHOT_SRC: snapSource,
      FLEET_TI_TOKEN: snapToken };
    const up = spawnSync(tiScript, ["up", "snapshot", "--ttl", "5"],
      { env, encoding: "utf8", timeout: 120_000 });
    const address = up.stdout?.match(/TESTINSTANZ SNAPSHOT UP\s+(http:\/\/[^/]+)\//)?.[1];
    check("host-hygiene §e9 synthetic snapshot instance starts", up.status === 0 && !!address,
      `exit=${up.status} tail=${up.stderr?.trim().split("\n").slice(-1)[0] ?? ""}`);
    try {
      if (up.status === 0 && address) {
        const grep = spawnSync("grep", ["-r", "-F", "-f", `${FIXROOT}/snapshot-markers`, snapDir],
          { encoding: "utf8" });
        check("host-hygiene §e9 grep -r finds no source marker after the snapshot server boots",
          grep.status === 1, `grep exit=${grep.status}`);
        const state = JSON.parse(readFileSync(`${snapDir}/fleet.json`, "utf8"));
        const envNames = readFileSync(`${snapDir}/env-names`, "utf8");
        const localSlots = Object.values(state.slots as Record<string, unknown>).every((value) => {
          const s = value as { cwd?: unknown; worktree?: unknown };
          return s.cwd === snapDir && !s.worktree;
        });
        const noBinding = !snapshotHasWorktreeBinding(state);
        const noSourceSession = !JSON.stringify(state).includes("SYNTHETIC_REAL_SESSION");
        const noCouplingEnv = !/FLEET_(HUB_|HELPER_|SHARE_)/.test(envNames);
        check("host-hygiene §e9 serving snapshot keeps master stop, local paths and no live-coupling env names",
          state.dispatch === false && state.autosOn === false && localSlots && noBinding && noSourceSession && noCouplingEnv,
          `dispatch=${state.dispatch} autosOn=${state.autosOn} localSlots=${localSlots} noBinding=${noBinding} noSourceSession=${noSourceSession} noCouplingEnv=${noCouplingEnv}`);
        check("host-hygiene §e9 binding probe accepts a serialized null and rejects a real nested worktree",
          !snapshotHasWorktreeBinding({ slots: { 1: { cwd: snapDir, worktree: null } } })
            && snapshotHasWorktreeBinding({ tasks: [{ worktree: { repo: snapSource } }] })
            && snapshotHasWorktreeBinding({ programs: [{ nested: { worktree: snapSource } }] }),
          "null is no binding; object and string source bindings are both rejected");
        const routes = [
          ["/api/slots/1/merge", {}], ["/api/tasks/snapshot-task/land", {}],
          ["/api/deploy", {}], ["/api/repos/undo-land", { repo: snapDir }],
        ] as const;
        for (const [route, body] of routes) {
          let status = 0;
          try {
            const response = await fetch(`${address}${route}`, {
              method: "POST", headers: { authorization: `Bearer ${snapToken}`, "content-type": "application/json" },
              body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
            });
            status = response.status;
          } catch { /* failed request is a failed probe */ }
          check(`host-hygiene §e9 POST ${route} is refused by planted state`, status >= 400,
            `HTTP ${status}`);
        }
      }
    } finally {
      const down = spawnSync(tiScript, ["down"],
        { env, encoding: "utf8", timeout: 30_000 });
      check("host-hygiene §e9 synthetic snapshot down frees its instance", down.status === 0,
        `exit=${down.status} tail=${down.stderr?.trim().split("\n").slice(-1)[0] ?? ""}`);
      check("host-hygiene §e9 source refs and HEAD remain byte-identical after the mutation probes",
        ref() === beforeRefs && head() === beforeHead, "git for-each-ref and HEAD before/after");
    }
  }

  rmSync(FIXROOT, { recursive: true, force: true });
}

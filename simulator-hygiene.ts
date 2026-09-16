// simulator-hygiene.ts — may an idle iOS Simulator be shut down? The pure decision, and the probe it reads.
//
// WHY THIS EXISTS. Measured 2026-09-15 17:5x on this machine: Simulator.app had been running for
// 13 days 13 h with ZERO booted devices and ZERO xcodebuild/simctl processes, and it was costing
// the dev box real performance. Nothing ever closed it — `private-repo-p/scripts/review.sh` opens it
// (`open -a Simulator`) and that repo's cleanup only removes its lock directory; it shuts no device
// down. Fleet knew nothing about the simulator at all. The private-repo-p side is a separate question
// and is deliberately NOT touched from here.
//
// THE SHAPE, and why it is this one:
//   · the DECISION is pure and takes facts, not a host. Everything that could make a reap wrong —
//     a held lease, a running build, a clock that has not run long enough, a probe that failed — is
//     a NAMED refusal over an input, so the table can be read (and tested) without a simulator,
//     without xcrun, and without darwin.
//   · every host command is INJECTABLE (FLEET_SIMCTL_CMD · FLEET_SIM_QUIT_CMD · FLEET_SIM_PS_CMD).
//     The suites drive stand-ins that record their calls; they must never reach a real simulator,
//     and a check that did would be measuring the operator's desktop, not this code.
//   · an UNKNOWN never reaps. A probe that could not read the host, and a lease directory whose pid
//     cannot be read, both refuse — the act is irreversible for whoever is using that simulator,
//     and "I could not tell" is not permission. This is lane-signals.ts's rule, for the same reason.
//
// PROCESS PROBE, ON `comm` AND NEVER ON `command` (CLAUDE.md §Self-scheduling, token hygiene):
// ensureSlot bakes each pane's self-credential into its zsh line, so anything that renders a
// process COMMAND renders foreign slots' tokens into whatever reads it. `ps -eo comm=` prints the
// executable path and nothing else, which is all this probe needs: the basename says Simulator,
// xcodebuild, simctl or xctest. The probe therefore cannot leak a token even if its output is
// logged.
//
// ORDER IS LOAD-BEARING: the ps snapshot is taken BEFORE simctl runs. `xcrun simctl list` is itself
// a process named `simctl`, so a probe that asked simctl first and ps second would see its own
// child and refuse forever with "a tool is running".

import { readdirSync, readFileSync, statSync } from "node:fs";

export const SIM_IDLE_MS_DEFAULT = 1_800_000; // 30 min of uninterrupted idle before anything is shut down
export const SIM_TICK_MS_DEFAULT = 60_000;
export const SIM_LEASE_GLOB_DEFAULT = "$TMPDIR/*simulator.lock";
export const SIM_SIMCTL_CMD_DEFAULT = "xcrun simctl";
export const SIM_QUIT_CMD_DEFAULT = "osascript -e 'quit app \"Simulator\"'";
export const SIM_PS_CMD_DEFAULT = "ps -eo comm=";
export const SIM_CMD_TIMEOUT_MS = 20_000;

// the three process names that mean "somebody is working with the simulator right now". Basenames,
// matched against `ps -eo comm=` output — not command lines (see the header).
export const SIM_TOOL_NAMES: readonly string[] = ["xcodebuild", "simctl", "xctest"];
export const SIM_APP_NAME = "Simulator";

export type SimLeaseState = "held" | "stale" | "unknown";
// One match of the lease glob. `held` = a directory with a readable, LIVING owner pid. `stale` = a
// directory whose owner pid is readable and dead (private-repo-p crashed and left its lock). `unknown`
// = the glob matched something whose owner cannot be read at all — a directory with no pid file, an
// unreadable one, or a plain file. Unknown is the value that refuses.
export interface SimLease { readonly path: string; readonly state: SimLeaseState; readonly pid: number | null }

// Every field is nullable because every field comes from a command that can fail, and a failed
// probe must be distinguishable from a quiet host. `booted` is the number of booted devices.
export interface SimulatorProbe {
  readonly booted: number | null;
  readonly appRunning: boolean | null;
  readonly toolRunning: boolean | null;
  readonly leases: readonly SimLease[];
}

export interface SimReapInput extends SimulatorProbe {
  // wall clock at which the CURRENT uninterrupted idle run was first observed; null before the
  // first observation. The caller owns this value and resets it whenever the run breaks.
  readonly firstSeenAt: number | null;
  readonly now: number;
  readonly graceMs: number;
}

export type SimReapAction = "reap" | "wait" | "none";
export interface SimReapDecision { readonly action: SimReapAction; readonly reason: string }

// --- THE DECISION. Pure, total, and ordered so that each refusal names ITS OWN fact ---------------
//
// `none` means the idle run is broken or unknowable — the caller drops its clock. `wait` means this
// is a genuine idle candidate whose grace has not elapsed — the clock keeps running. `reap` is
// reachable exactly once, through every clause above it.
export function decideSimulatorReap(i: SimReapInput): SimReapDecision {
  if (i.booted === null || i.appRunning === null || i.toolRunning === null)
    return { action: "none", reason: "the host probe failed — an unknown host is never reaped" };
  if (i.booted === 0 && !i.appRunning)
    return { action: "none", reason: "no booted device and no Simulator.app — there is nothing to reap" };
  const unknown = i.leases.find((l) => l.state === "unknown");
  if (unknown)
    return { action: "none", reason: `a lease at ${unknown.path} has no readable owner pid — an unknown lease is never reaped` };
  const held = i.leases.find((l) => l.state === "held");
  if (held)
    return { action: "none", reason: `a lease at ${held.path} is held by live pid ${held.pid}` };
  if (i.toolRunning)
    return { action: "none", reason: `a simulator tool is running (${SIM_TOOL_NAMES.join("/")}) — the simulator is in use` };
  if (i.firstSeenAt === null)
    return { action: "wait", reason: "first observation of this idle state — the grace clock starts now" };
  const idleMs = i.now - i.firstSeenAt;
  if (idleMs < i.graceMs)
    return { action: "wait", reason: `idle for ${idleMs} ms of the ${i.graceMs} ms grace` };
  return { action: "reap", reason: `idle for ${idleMs} ms ≥ ${i.graceMs} ms, no lease held, no tool running` };
}

// --- ARMING. Off by default, in FLEET_LANE_AUTOCLOSE's shape --------------------------------------
//
// An unrecognised value is OFF and SAYS SO: a typo that passed for a decision is what cost
// FLEET_CLEAN_REVIEW a red land gate on 2026-07-28. The platform clause is here rather than inside
// the tick for the same reason the autoclose tick is never registered when unarmed — a timer that
// can only ever decline should not exist. Pure over (raw, platform) so the table is testable off
// darwin.
const SIM_ON_RE = /^(1|true|on|yes)$/i;
const SIM_OFF_RE = /^(0|off|false|no)$/i;
export function simReapArming(raw: string | undefined, platform: string): { on: boolean; log: string } {
  const v = (raw ?? "").trim();
  if (!v) return { on: false, log: "[fleet] simulator hygiene off (FLEET_SIM_REAP unset) — no tick registered" };
  if (SIM_OFF_RE.test(v)) return { on: false, log: `[fleet] simulator hygiene off (FLEET_SIM_REAP=${JSON.stringify(v)}) — no tick registered` };
  if (!SIM_ON_RE.test(v))
    return { on: false, log: `[fleet] FLEET_SIM_REAP=${JSON.stringify(v)} is not a recognised value — the simulator reap is OFF. Recognised: 1/true/on/yes · 0/off/false/no.` };
  if (platform !== "darwin")
    return { on: false, log: `[fleet] FLEET_SIM_REAP is armed but this host is ${platform}, not darwin — no tick registered` };
  return { on: true, log: "[fleet] simulator hygiene armed: an idle simulator with no held lease is shut down" };
}

export interface SimulatorConfig {
  readonly simctlCmd: string;
  readonly quitCmd: string;
  readonly psCmd: string;
  readonly leaseGlob: string;
  readonly idleMs: number;
  readonly tickMs: number;
}

export function simulatorConfig(env: Record<string, string | undefined> = process.env): SimulatorConfig {
  const num = (raw: string | undefined, fallback: number, min: number): number => {
    const n = Number(raw);
    return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
  };
  return {
    simctlCmd: env.FLEET_SIMCTL_CMD?.trim() || SIM_SIMCTL_CMD_DEFAULT,
    quitCmd: env.FLEET_SIM_QUIT_CMD?.trim() || SIM_QUIT_CMD_DEFAULT,
    psCmd: env.FLEET_SIM_PS_CMD?.trim() || SIM_PS_CMD_DEFAULT,
    leaseGlob: env.FLEET_SIM_LEASE_GLOB?.trim() || SIM_LEASE_GLOB_DEFAULT,
    idleMs: num(env.FLEET_SIM_IDLE_MS, SIM_IDLE_MS_DEFAULT, 0),
    tickMs: num(env.FLEET_SIM_TICK_MS, SIM_TICK_MS_DEFAULT, 1000),
  };
}

// --- THE PROBE -----------------------------------------------------------------------------------

interface RunResult { readonly code: number; readonly out: string }

async function run(cmd: string): Promise<RunResult> {
  try {
    const p = Bun.spawn(["sh", "-c", cmd],
      { stdin: "ignore", stdout: "pipe", stderr: "ignore", timeout: SIM_CMD_TIMEOUT_MS });
    const out = await new Response(p.stdout).text();
    return { code: await p.exited, out };
  } catch {
    return { code: -1, out: "" }; // spawn itself failed: no shell, no such binary — an unknown, not a quiet host
  }
}

const basename = (s: string): string => s.slice(s.lastIndexOf("/") + 1).trim();

// `$TMPDIR`/`${TMPDIR}` is the only expansion, because the default pattern is the only reason this
// function exists. Wildcards are honoured in the LAST segment only — a lock is a name in a
// directory, and a pattern that walked the tree would be a different (and much more dangerous)
// feature than the one asked for.
export function leaseMatches(pattern: string, env: Record<string, string | undefined> = process.env): string[] {
  const tmp = (env.TMPDIR ?? "/tmp").replace(/\/+$/, "");
  const expanded = pattern.replaceAll("${TMPDIR}", tmp).replaceAll("$TMPDIR", tmp);
  const cut = expanded.lastIndexOf("/");
  if (cut < 0) return [];
  const dir = expanded.slice(0, cut) || "/";
  const base = expanded.slice(cut + 1);
  if (!base.includes("*")) return [`${dir}/${base}`];
  const re = new RegExp(`^${base.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")}$`);
  try {
    return readdirSync(dir).filter((n) => re.test(n)).sort().map((n) => `${dir}/${n}`);
  } catch {
    return []; // no such directory — no lease, which is a KNOWN answer: a missing $TMPDIR holds no lock
  }
}

const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};

// A lease is a lock DIRECTORY with an owner file inside — the shape fleet's own /tmp/fleet-e2e.lock
// uses and the shape private-repo-p's $TMPDIR/private-repo-p-simulator.lock uses. `pid` is read first,
// `owner` second; anything else the glob matched is unreadable ownership and therefore unknown.
export function readLease(path: string): SimLease {
  let isDir = false;
  try { isDir = statSync(path).isDirectory(); } catch { return { path, state: "unknown", pid: null }; }
  if (!isDir) return { path, state: "unknown", pid: null };
  for (const f of ["pid", "owner"]) {
    let raw: string;
    try { raw = readFileSync(`${path}/${f}`, "utf8"); } catch { continue; }
    const pid = Number.parseInt(raw.trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    return { path, state: alive(pid) ? "held" : "stale", pid };
  }
  return { path, state: "unknown", pid: null };
}

export async function probeSimulator(cfg: SimulatorConfig,
  env: Record<string, string | undefined> = process.env): Promise<SimulatorProbe> {
  // ps FIRST — see the header on why the order is load-bearing
  const ps = await run(cfg.psCmd);
  const names = ps.code === 0 ? ps.out.split("\n").map(basename).filter(Boolean) : null;
  const devices = await run(`${cfg.simctlCmd} list devices booted -j`);
  let booted: number | null = null;
  if (devices.code === 0) {
    try {
      const j = JSON.parse(devices.out) as { devices?: Record<string, { state?: string }[]> };
      booted = Object.values(j.devices ?? {}).flat()
        .filter((d) => typeof d?.state === "string" && d.state === "Booted").length;
    } catch { booted = null; } // unparseable output is an unknown host, never "zero devices"
  }
  return {
    booted,
    appRunning: names === null ? null : names.includes(SIM_APP_NAME),
    toolRunning: names === null ? null : names.some((n) => SIM_TOOL_NAMES.includes(n)),
    leases: leaseMatches(cfg.leaseGlob, env).map(readLease),
  };
}

// The act: shut every booted device down, then quit the app. In that order — quitting the app first
// leaves booted devices behind with no window, which is a worse state than the one we started in.
export async function reapSimulator(cfg: SimulatorConfig): Promise<{ shutdown: RunResult; quit: RunResult }> {
  const shutdown = await run(`${cfg.simctlCmd} shutdown all`);
  const quit = await run(cfg.quitCmd);
  return { shutdown, quit };
}

// --- THE TICK ------------------------------------------------------------------------------------

export interface SimulatorHygieneDeps {
  // one audit row per reap, never per pass: `simulator_reap` with device count, app yes/no, duration
  readonly audit: (detail: string, fields: Record<string, string | number | boolean>) => void;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => number;
}

export interface SimulatorHygiene {
  readonly config: SimulatorConfig;
  tick(): Promise<SimReapDecision>;
}

export function makeSimulatorHygiene(deps: SimulatorHygieneDeps): SimulatorHygiene {
  const env = deps.env ?? process.env;
  const clock = deps.now ?? Date.now;
  const config = simulatorConfig(env);
  // the idle run's own clock. Held here and not in the decision, so the decision stays pure and the
  // reset rule ("a `none` breaks the run") is stated once, where the state lives.
  let firstSeenAt: number | null = null;
  let busy = false;
  return {
    config,
    async tick(): Promise<SimReapDecision> {
      if (busy) return { action: "none", reason: "a pass is already running" };
      busy = true;
      try {
        const probe = await probeSimulator(config, env);
        const now = clock();
        const decision = decideSimulatorReap({ ...probe, firstSeenAt, now, graceMs: config.idleMs });
        if (decision.action === "none") { firstSeenAt = null; return decision; }
        if (decision.action === "wait") { firstSeenAt ??= now; return decision; }
        const idleMs = now - (firstSeenAt ?? now);
        const acted = await reapSimulator(config);
        const after = await probeSimulator(config, env);
        firstSeenAt = null; // whatever the host looks like now, this run is spent
        deps.audit(
          `idle simulator shut down: ${probe.booted} booted device(s), app ${probe.appRunning ? "running" : "not running"}, idle ${idleMs} ms`,
          {
            devices: probe.booted ?? -1, app: probe.appRunning === true, idleMs,
            shutdownCode: acted.shutdown.code, quitCode: acted.quit.code,
            devicesAfter: after.booted ?? -1, appAfter: after.appRunning === true,
          });
        return decision;
      } finally {
        busy = false;
      }
    },
  };
}

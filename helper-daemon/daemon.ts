#!/usr/bin/env bun
// helper-daemon/daemon.ts — the OTHER MACHINE's half of THE REMOTE HELPER PORTAL (server.ts, grep
// `handleHelperRoute`). It automates, unchanged, the ritual src/helper.ts#bootstrapText spells out
// for a human: claim a job · download its bundle · clone it · `bun install --frozen-lockfile` ·
// run the suite · POST the exit code, the log tail, failed check names and the trail id back.
//
// WHAT IT DOES NOT CHANGE, and this is the whole safety model: the fleet never opens a connection
// towards this machine. Every line below is a PULL. The three Stage-1 non-goals the owner set stay
// in force and are not negotiable here — no server-side auto-dispatch, no ssh runner, no push. The
// ONE revised sentence is "a human on the other machine clicks claim" (owner promotion G0,
// 2026-08-28): this process is that human's hands, and nothing more.
//
// THE TOKEN LIVES IN EXACTLY ONE PLACE: the `x-fleet-helper-token` request header, read out of a
// 0600 config file. Never a URL (`?token=` is the browser bootstrap's affordance and is refused
// here), never argv, never an `Environment=` line of the unit (that is world-readable through
// `systemctl show` and /proc/<pid>/environ), never a log line — `log()` redacts it as a last
// resort, and nothing above it ever formats it in the first place.
//
// MODES. Two sources, and they run in opposite directions:
//   · the OWNER's wish (`desiredMode`), pulled in the reply to this machine's own heartbeat;
//   · this machine's own reading — the config switch, quiet hours, and the 1-minute load average.
// THE QUIETER OF THE TWO WINS. That is a deliberate reading of "the server's wish has priority":
// the wish always wins DOWNWARDS (an owner who says `off` stops this machine even when it feels
// active), but it can never override a local physical constraint upwards — a machine inside its
// quiet hours stays silent even if the board says `active`, because the person who set those hours
// is standing next to it. The two rules only differ in that one quadrant, and the failure
// direction is chosen: too little remote work, never a machine that whirrs at 3 a.m.
//
// `off` MEANS NOT ONE REQUEST. Not a heartbeat, not a job poll. A machine that does not poll claims
// nothing, and the portal's own design is what makes that safe: a job nobody claimed, or whose claim
// expired, is simply open again. On a deployment that hands its audits to a helper (server.ts
// AUDIT_HELPER_ONLY, live since 2026-10-08) an audit then WAITS for a helper — there is no local
// drain to fall back onto — and a lane preview goes back to its lane; only a fleet without a helper
// runs its audits on its own drain. So silence costs a wait, never a lost or doubled run, and is a
// complete and correct way to be unavailable. Once the owner's `off` has been read, it is honoured
// for `offRecheckSec` before a single heartbeat asks again.
//
// SELF-UPDATE (`daemon-update`, 2026-09-02). The owner queues one update per device on the board;
// this daemon claims it like any job, clones the fleet's main out of the bundle into
// `<workDir>/tree-<sha>`, PARSES the new daemon there, and only then moves the `checkoutLink`
// symlink onto the new tree and exits 75 (EX_TEMPFAIL) — the unit template pairs that code with
// `RestartForceExitStatus=75`, so systemd starts the next daemon from the link. The old tree is
// left in place: pointing the link back at it by hand is the whole rollback. A tree that fails the
// parse never becomes the link's target — check first, swap second, and the daemon keeps running.
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync,
  statSync, symlinkSync } from "node:fs";
import { homedir, loadavg } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { retryResult } from "./result-retry";
import { HELPER_REPOS_MAX, HELPER_REPO_REMOTES_MAX, HELPER_REPO_REFS_MAX, HELPER_REPO_COMMITS_MAX,
  HELPER_REPOS_CACHE_MS, HELPER_REPOS_BUDGET_MS, HELPER_REPO_NAME_RE, helperArtifactPathOk, helperGitLabel,
  type HelperRepoReading, type HelperReposReading } from "../src/protocol";


// --- config ------------------------------------------------------------------------------------
export interface HelperConfig {
  fleetUrl: string;
  token: string;
  deviceId: string;      // /^[a-z0-9]{8,32}$/ — the shape the portal's routes validate
  name: string;          // what the ledger row will say produced the verdict
  workDir: string;
  instanceDir?: string;
  repos?: { name: string; path: string }[];
  checkoutLink: string;  // the symlink the unit's ExecStart runs through; a daemon-update moves it
  pollSec: number;
  offRecheckSec: number;
  quietHours: { from: string; to: string } | null;
  maxLoad1: number | null;
  // HOW MANY JOBS MAY RUN HERE AT ONCE — a COUNT, and the reason it is not derived from `maxLoad1`
  // is measured. The 1-minute load average is a LAGGING figure: on the linux work-horse a single
  // ./e2e-isolated.sh sits at load1 0.21 mean / 0.94 peak, so a suite that started twenty seconds
  // ago has barely moved it. A daemon that only measures load therefore claims a second and a third
  // job inside its own blind spot — which is exactly what happened on 2026-09-06 (three audits at
  // once under maxLoad1 2; docs/messungen/2026-09-06-workhorse-parallel-suiten.md). Counting cannot
  // be fooled that way. The load cap keeps its own job and is the SECOND condition, never the
  // replacement: it is what says "this machine is busy with something else entirely".
  maxParallelSuites: number;
  // SLOTS A MERGE CHECK HOLDS (docs/neuaufbau/plan.md K2, mergeCheckHeld). Default 0: none.
  mergeCheckSlots: number;
  mergeCheckPidFile: string;
  capabilities: string[];
  installCmd: string;
  suiteCmd: string;
  suiteTimeoutSec: number;
  keepRuns: number;
  enabled: boolean;
}

// A config fault is not a transient error: retrying it produces the same answer forever. Both
// faults below therefore END the process with EXIT_CONFIG, and the unit template pairs that code
// with `RestartPreventExitStatus=78` so systemd stops instead of restarting into the same wall.
// That pairing IS the "no retry storm" property — a wrong token costs exactly one request, ever.
export const EXIT_CONFIG = 78; // sysexits EX_CONFIG
// The exit a SUCCESSFUL self-update ends in. Deliberately not 0 (Restart=on-failure would leave the
// unit stopped) and not 78 (that one is pinned to "do not restart"): EX_TEMPFAIL says exactly what
// happened — try again, and the retry is the new tree.
export const EXIT_UPDATED = 75; // sysexits EX_TEMPFAIL
class ConfigFault extends Error {}
class AuthFault extends Error {}

let secret = ""; // set once at load; only `log()` reads it, and only to refuse to print it
function log(msg: string): void {
  const safe = secret && msg.includes(secret) ? msg.replaceAll(secret, "<token>") : msg;
  console.log(`${new Date().toISOString()} ${safe}`);
}

const str = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !v) throw new ConfigFault(`${field} must be a non-empty string`);
  return v;
};
const num = (v: unknown, field: string, fallback: number): number => {
  if (v === undefined || v === null) return fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new ConfigFault(`${field} must be a finite number`);
  return v;
};

// The permission check is a REFUSAL, not a warning. A config file readable by anyone but its owner
// has already handed the fleet's helper credential to every account on this box, and a daemon that
// starts anyway would make that fact invisible for as long as it runs.
export function loadConfig(path: string, raw: unknown, mode: number): HelperConfig {
  if (mode & 0o077) throw new ConfigFault(
    `${path} is mode ${(mode & 0o777).toString(8)} — it carries the helper token and must be 0600 (chmod 600 it)`);
  const c = raw as Record<string, unknown>;
  if (!c || typeof c !== "object") throw new ConfigFault(`${path} does not contain a JSON object`);
  const fleetUrl = str(c.fleetUrl, "fleetUrl");
  if (/[?&]token=/.test(fleetUrl)) throw new ConfigFault(
    "fleetUrl carries a token in its query string — the token belongs in the `token` field and travels as a header");
  const deviceId = str(c.deviceId, "deviceId");
  if (!/^[a-z0-9]{8,32}$/.test(deviceId)) throw new ConfigFault("deviceId must match /^[a-z0-9]{8,32}$/");
  const caps = Array.isArray(c.capabilities) ? c.capabilities.filter((x): x is string => typeof x === "string") : [];
  const quiet = c.quietHours == null ? null : (() => {
    const q = c.quietHours as Record<string, unknown>;
    const from = str(q.from, "quietHours.from"), to = str(q.to, "quietHours.to");
    for (const [k, v] of [["from", from], ["to", to]] as const)
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ConfigFault(`quietHours.${k} must be HH:MM`);
    return { from, to };
  })();
  const workDir = str(c.workDir, "workDir");
  if (c.instanceDir !== undefined && (typeof c.instanceDir !== "string" || !isAbsolute(c.instanceDir)))
    throw new ConfigFault("instanceDir must be an absolute path");
  let repos: HelperConfig["repos"];
  if (c.repos !== undefined) {
    if (!Array.isArray(c.repos) || c.repos.length > HELPER_REPOS_MAX)
      throw new ConfigFault("repos must be an array of at most 8 named repositories");
    repos = c.repos.map((v: unknown) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new ConfigFault("invalid repos entry");
      const r = v as Record<string, unknown>;
      if (typeof r.name !== "string" || !HELPER_REPO_NAME_RE.test(r.name)
        || typeof r.path !== "string" || !(isAbsolute(r.path) || r.path.startsWith("~/")))
        throw new ConfigFault("repos entries require a safe name and a local path");
      return { name: r.name, path: r.path.startsWith("~/") ? join(homedir(), r.path.slice(2)) : r.path };
    });
    if (new Set(repos.map((r) => r.name)).size !== repos.length) throw new ConfigFault("repos names must be unique");
  }
  return {
    fleetUrl, token: str(c.token, "token"), deviceId, name: str(c.name, "name"),
    workDir,
    ...(repos === undefined ? {} : { repos }),
    ...(typeof c.instanceDir === "string" ? { instanceDir: c.instanceDir } : {}),
    checkoutLink: typeof c.checkoutLink === "string" && c.checkoutLink ? c.checkoutLink : `${workDir}/current`,
    // the floors are TYPO GUARDS (a 0 or a NaN would spin this loop), not policy — the same
    // reading server.ts gives its own HELPER_CLAIM_TIMEOUT_MS floor. The e2e drives 2 s polls.
    pollSec: Math.max(1, num(c.pollSec, "pollSec", 15)),
    offRecheckSec: Math.max(60, num(c.offRecheckSec, "offRecheckSec", 900)),
    quietHours: quiet,
    maxLoad1: c.maxLoad1 == null ? null : num(c.maxLoad1, "maxLoad1", 0),
    // DEFAULT 1 — every machine that does not say otherwise keeps exactly today's behaviour, one
    // job at a time. The floor is the same typo guard the others carry (a 0 or a NaN would make
    // this machine claim nothing, forever and silently); the floor of the whole VALUE is an
    // integer, because "1.5 slots" is a number this rail has no reading for.
    maxParallelSuites: Math.max(1, Math.floor(num(c.maxParallelSuites, "maxParallelSuites", 1))),
    mergeCheckSlots: Math.max(0, Math.floor(num(c.mergeCheckSlots, "mergeCheckSlots", 0))),
    mergeCheckPidFile: typeof c.mergeCheckPidFile === "string" && isAbsolute(c.mergeCheckPidFile)
      ? c.mergeCheckPidFile : join(homedir(), "ci", "active"),
    capabilities: caps.slice(0, 8),
    installCmd: typeof c.installCmd === "string" ? c.installCmd : "bun install --frozen-lockfile",
    suiteCmd: typeof c.suiteCmd === "string" ? c.suiteCmd : "./e2e-isolated.sh",
    suiteTimeoutSec: Math.max(60, num(c.suiteTimeoutSec, "suiteTimeoutSec", 3600)),
    keepRuns: Math.max(1, num(c.keepRuns, "keepRuns", 10)),
    enabled: c.enabled === undefined ? true : c.enabled === true,
  };
}

// --- modes -------------------------------------------------------------------------------------
export type Mode = "active" | "quiet" | "off";
const RANK: Record<Mode, number> = { off: 0, quiet: 1, active: 2 };
export const stricter = (a: Mode, b: Mode): Mode => (RANK[a] <= RANK[b] ? a : b);

const minutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
// Windows that WRAP MIDNIGHT are the normal case for a machine in a bedroom (23:00 → 07:00), so
// they are the branch, not the edge: `from < to` is one interval, otherwise it is the complement.
// `from === to` is an EMPTY window rather than a full day — "quiet from 08:00 to 08:00" as a way to
// silence a machine forever would be an unreadable way to say `enabled: false`.
export function inQuietHours(from: string, to: string, at: Date): boolean {
  const f = minutes(from), t = minutes(to), n = at.getHours() * 60 + at.getMinutes();
  if (f === t) return false;
  return f < t ? n >= f && n < t : n >= f || n < t;
}

// What THIS machine says about itself, before the owner's wish is folded in. Quiet hours and the
// config switch answer `off` (the machine is unavailable, and silence is how it says so); the load
// threshold answers `quiet` (it is up and reachable, it just has nothing spare to give).
export function localMode(cfg: HelperConfig, at: Date, load1: number): { mode: Mode; why: string } {
  if (!cfg.enabled) return { mode: "off", why: "the config switch is off" };
  if (cfg.quietHours && inQuietHours(cfg.quietHours.from, cfg.quietHours.to, at))
    return { mode: "off", why: `quiet hours ${cfg.quietHours.from}–${cfg.quietHours.to}` };
  if (cfg.maxLoad1 !== null && load1 > cfg.maxLoad1)
    return { mode: "quiet", why: `load ${load1.toFixed(2)} is over maxLoad1 ${cfg.maxLoad1}` };
  return { mode: "active", why: `load ${load1.toFixed(2)}` };
}

// --- the wire ----------------------------------------------------------------------------------
export interface JobView {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  claim: { name: string; claimedAt?: number } | null; localRunning: boolean;
  shard?: string;
  modules?: string[];
  // an audit past the cadence's ceiling (server.ts#auditPastMaxWait) — read by jobsToStart only.
  // Absent from an older server, and then nothing changes.
  overdue?: boolean;
}
// WHAT THIS DAEMON'S CODE CAN RUN, sent on every heartbeat. Not a config field on purpose: the fleet
// offers a sharded audit (`shard: "k/n"`) only to a device that declares `audit-shard`, because a
// daemon without the `shardEnv` fork below would run the whole suite and file it under one shard.
// `lane-suite-modules` is the same contract for a NARROWED lane preview (`modules: [...]`): without
// the `modulesEnv` fork a daemon would run the full suite and file it as the narrowed answer.
// `audit-skip-units` is the same contract for an audit's SCOPE (`skipUnits: [...]`, `domMutants: true`):
// without the `auditScopeEnv` fork a daemon would run the browser unit a `quiet`/`deploy` audit leaves
// out, or the `nightly` one without its mutants, and file either as the run that was asked for.
// A tree that predates this list sends none, and the fleet stops offering on that beat.
export const DAEMON_FEATURES: readonly string[] = ["audit-shard", "lane-suite-modules", "audit-skip-units"];
// THE SHARD FORK, pure and exported (e2e/helper-daemon.ts HD.1): the env a shard job's suite gets.
// `{}` for a job with no shard; `null` for a shard string this daemon cannot read — that job is
// reported unrunnable (127 → unknown), never run whole in its place. The shape is the runner's own
// (fleet-e2e.ts#parseShard): k/n, 1 ≤ k ≤ n.
export function shardEnv(shard: string | undefined): Record<string, string> | null {
  if (shard === undefined) return {};
  const m = /^(\d+)\/(\d+)$/.exec(shard);
  if (!m) return null;
  const k = Number(m[1]); const n = Number(m[2]);
  return n >= 1 && k >= 1 && k <= n ? { FLEET_E2E_SHARD: `${k}/${n}` } : null;
}
// THE MODULES FORK, pure and exported (e2e/lane-suite.ts LS.mod): the env a NARROWED lane preview's
// suite gets — FLEET_E2E_MODULES and nothing else, the variable `./e2e-isolated.sh` hands its runner
// (fleet-e2e.ts reads it; suite-modules.ts#selectModules resolves it). `{}` for a job with no modules;
// `null` for a list this daemon will not turn into an env value — that job is reported unrunnable
// (127 → unknown), never run whole in its place. Three refusals, each a case where running would
// answer a different question than the one asked:
//   · modules on any kind but `lane-suite` — an audit is never filtered (the land gate and the
//     post-land audit carry no FLEET_E2E_MODULES by rule, e2e/pins.ts), and a command job runs argv;
//   · anything but a non-empty array of strings;
//   · a name outside the charset module names have (`e2e/<name>.ts`), so a comma, a space, an `=` or
//     a newline can never make one list entry into two words. WHICH names exist is not this
//     process's to know — the fleet validated them against the table, and the runner refuses an
//     unknown one out loud.
export function modulesEnv(kind: string | undefined, modules: unknown): Record<string, string> | null {
  if (modules === undefined) return {};
  if (kind !== "lane-suite") return null;
  if (!Array.isArray(modules) || modules.length === 0
    || !modules.every((m) => typeof m === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(m))) return null;
  return { FLEET_E2E_MODULES: (modules as string[]).join(",") };
}
// THE AUDIT SCOPE FORK, pure and exported (e2e/helper-daemon.ts HD.scope): the env an AUDIT's suite
// gets for the two scope fields of its claim — `skipUnits` → FLEET_E2E_SKIP_UNITS (the runner leaves
// those units out of its table, e2e/ctx.ts#selectSkipUnits) and `domMutants: true` →
// FLEET_E2E_DOM_MUTANTS=1 (e2e/dom.ts runs its mutants). `{}` for a claim with neither; `null` for a
// pair this daemon will not turn into env values — that job is reported unrunnable (127 → unknown),
// never run whole in its place. The refusals, each a case where running would answer a different
// question than the one asked:
//   · either field on any kind but an audit (`audit`, or no kind — the older audit claim's shape):
//     a lane preview's scope is `modules`, and a command job runs argv;
//   · `skipUnits` that is not a non-empty array of names in the charset unit names have, so a comma,
//     a space, an `=` or a newline can never make one entry into two words. WHICH units exist is the
//     runner's to know, and it refuses an unknown one out loud;
//   · `domMutants` that is anything but absent or exactly `true`.
export function auditScopeEnv(kind: string | undefined, skipUnits: unknown, domMutants: unknown): Record<string, string> | null {
  if (skipUnits === undefined && domMutants === undefined) return {};
  if (kind !== undefined && kind !== "audit") return null;
  if (skipUnits !== undefined && (!Array.isArray(skipUnits) || skipUnits.length === 0
    || !skipUnits.every((u) => typeof u === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(u)))) return null;
  if (domMutants !== undefined && domMutants !== true) return null;
  return {
    ...(skipUnits === undefined ? {} : { FLEET_E2E_SKIP_UNITS: (skipUnits as string[]).join(",") }),
    ...(domMutants === true ? { FLEET_E2E_DOM_MUTANTS: "1" } : {}),
  };
}
// THE PORT BAND FORK, pure and exported (e2e/helper-daemon.ts#bandChecks): which port band a run
// gets. Measured 2026-10-10 06:59 (post-land audit e900ed30, work-horse): two runs side by side each
// took PORT=$((8800 + $$ % 2000)) in ./e2e-isolated.sh, their pids landed within the suite's own
// port offsets of each other, and one fixture died on `EADDRINUSE` at 9857 — the squatter was the
// other run, not a service. A pid cannot be made distinct mod 2000; a slot index can. So every run
// holds the SMALLEST index no other run of this process holds, from its claim to its `finally`, and
// the wrapper turns it into a sub-band of its own band (e2e-isolated.sh, grep FLEET_E2E_BAND). The
// index means "which of my parallel runs", never "which wrapper": each wrapper's band is already
// disjoint from the others', so one index per run serves all of them. PORT_BANDS is the wrapper's
// count — ten sub-bands of 200 in its 2000 — and `null` (all held) is a job this daemon cannot run
// apart, reported as such (127 → unknown), never run on a pid-derived port in its place.
export const PORT_BANDS = 10;
export function portBand(held: ReadonlySet<number>): number | null {
  for (let i = 0; i < PORT_BANDS; i++) if (!held.has(i)) return i;
  return null;
}
export function bandEnv(band: number): Record<string, string> {
  return { FLEET_E2E_BAND: String(band) };
}
// The claim answer as it comes off the wire — unvalidated by us, so the two ref fields are typed
// the way the server actually serves them: a lane-suite claim carries `branch`, an audit claim
// carries `main`, and neither kind ever carries both (server.ts#helperClaim, #claimLaneSuite).
export interface ClaimedJob {
  id: string; kind?: string; repo: string; main?: string; mainSha: string; claimedAt?: number;
  branch?: string; treeSha?: string; untracked?: number;
  // THE COMMAND KIND's three fields. `argv` is what this process execs — the fleet split the
  // allowlisted command line at its own perimeter, so there is no parser and no shell here. `cmd` is
  // carried beside it for the log line only. A `command` claim that arrives WITHOUT `argv` is
  // unrunnable and is reported as such (127 → unknown), never approximated from `cmd`.
  cmd?: string; argv?: string[]; timeoutMs?: number; artifacts?: string[];
  // A NARROWED LANE PREVIEW's check modules — joined into FLEET_E2E_MODULES by `modulesEnv` and used
  // for nothing else. Absent on every other job and on a full preview.
  modules?: string[];
  shard?: string; // `k/n` on a sharded audit claim — see shardEnv
  // AN AUDIT'S SCOPE — FLEET_E2E_SKIP_UNITS and FLEET_E2E_DOM_MUTANTS by `auditScopeEnv`, offered only
  // to a daemon that declares `audit-skip-units`. Absent on every other job and on a plain audit.
  skipUnits?: string[]; domMutants?: boolean;
}

// THE ONLY PLACE A REQUEST IS MADE, so that "the token is a header" and "every request is logged as
// method+path" are properties of the file rather than of each call site. A 401 is raised as an
// AuthFault by this function and by nothing else, which is what makes the single-request guarantee
// above checkable: there is one door, and it closes the process.
// `body` widened from `string` to BodyInit and `headers` added for ONE caller: the suite.log
// upload sends bytes as text/plain. JSON stays the default for every other call, so no existing
// request's headers move — the override is opt-in and the token header is always this file's.
async function api(cfg: HelperConfig, path: string,
  init?: { method: string; body: BodyInit; headers?: Record<string, string> }): Promise<Response> {
  const headers: Record<string, string> = { "x-fleet-helper-token": cfg.token };
  if (init) headers["content-type"] = "application/json";
  Object.assign(headers, init?.headers ?? {});
  const isResult = path === "/api/helper/result" && init?.method === "POST";
  const request = () => {
    log(`req ${init?.method ?? "GET"} ${path}`);
    return fetch(new URL(path, cfg.fleetUrl).toString(), { ...init, headers,
      ...(isResult ? { signal: AbortSignal.timeout(10_000) } : {}) });
  };
  const res = isResult ? await retryResult(request, log) : await request();
  if (res.status === 401) throw new AuthFault(`the fleet refused this machine's helper token (401 on ${path})`);
  return res;
}

const BUNDLE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000] as const;
export async function downloadBundle(cfg: HelperConfig, j: ClaimedJob,
  sleep: (ms: number) => Promise<unknown> = Bun.sleep): Promise<ArrayBuffer | null> {
  const path = `/api/helper/bundle/${j.id}`;
  for (let attempt = 0; ; attempt++) {
    let failure = "";
    try {
      const res = await api(cfg, path);
      if (res.ok) return await res.arrayBuffer();
      if (res.status < 500 || res.status >= 600) {
        await report(cfg, j, 127, `the bundle download answered HTTP ${res.status}`);
        return null;
      }
      await res.body?.cancel();
      failure = `HTTP ${res.status}`;
    } catch (error) {
      if (error instanceof AuthFault) throw error;
      failure = error instanceof Error ? error.message : String(error);
    }
    log(`bundle attempt ${attempt + 1}/5 failed: ${failure}`);
    if (attempt === BUNDLE_RETRY_DELAYS_MS.length) {
      await report(cfg, j, 127, `bundle-download-failed after 5 attempts: ${failure}`);
      return null;
    }
    await sleep(BUNDLE_RETRY_DELAYS_MS[attempt]);
  }
}
const bodyOf = async <T>(res: Response): Promise<T & { error?: string }> => {
  const text = await res.text();
  try { return JSON.parse(text) as T & { error?: string }; }
  catch { return { error: `non-JSON answer (HTTP ${res.status}): ${text.slice(0, 160)}` } as T & { error?: string }; }
};

// --- the run -----------------------------------------------------------------------------------
const sh = (s: string): string => `'${s.replaceAll("'", "'\\''")}'`;
// FLEET_* IS STRIPPED FROM EVERY CHILD, the same rule and for the same reason server.ts applies to
// its own audit child: the suite in the clone boots a fleet of its own, and inheriting
// FLEET_POSTLAND_AUDIT_CMD would make it audit its own lands forever. FLEET_TOKEN and
// FLEET_CLEAN_REVIEW are the other two that must never travel.
// PWD/OLDPWD go with them, for a smaller but sharper reason: this daemon runs every child in a
// directory that is not its own, and a shell that trusts an inherited PWD would report — and, in a
// script, ACT ON — a directory the child is not in.
function childEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && !k.startsWith("FLEET_") && k !== "PWD" && k !== "OLDPWD") out[k] = v;
  return out;
}
// The log is opened as a FILE DESCRIPTOR rather than through a `>> log` in the command string, and
// that is not cosmetic: `sh -c '<one command>'` execs the command in place, so the pid this holds
// is the suite itself and the timeout below can actually kill it. With a redirection in the string
// sh must stay alive to own the pipe, and the kill would land on sh while the suite ran on.
async function runCmd(cmd: string, cwd: string, logPath: string, timeoutMs: number,
  extraEnv: Record<string, string> = {}, signal?: AbortSignal, scope: RunScope = {}): Promise<{ code: number | null; timedOut: boolean }> {
  return await runArgv(["sh", "-c", cmd], cwd, logPath, timeoutMs, extraEnv, signal, scope);
}
// THE RUN'S PROCESSES, not only its head's tree (2026-10-10 02:2x, work-horse: three runs still had
// 4–11 processes each, hours after they ended, one with its cwd already deleted). The earlier
// killTree listed the head's descendants once, at the abort, and so missed exactly the two that
// matter: a bun runner already reparented to init when its wrapper died, and a tmux server, which
// detaches itself with setsid. A timeout signalled the head alone, and after a normal end nobody
// looked at all. So every step now runs in a process group of its own, and every ending — abort,
// timeout, normal exit — goes through ONE reap that asks who belongs to this run and signals those:
// TERM first, so a wrapper's EXIT trap can tear its tmux socket down, KILL after the grace.
// MEMBERSHIP IS PROVEN, never guessed from a name (AGENTS.md §Verify): the head's own group, a
// TMPDIR at or under this run's scratch, or a cwd at or under this run's clone or scratch (a staged
// suite instance lives in the scratch). The daemon itself matches none of them — its group is not
// the head's, and it neither sets nor stands in either directory.
export const ABORT_KILL_GRACE_MS = 5_000;
// the named slack past the grace by which the last KILL round has run: the scans themselves
// (/proc on linux, ps + lsof elsewhere) and the KILL rounds that follow them
export const RUN_REAP_MARGIN_MS = 5_000;
// `tree` is the clone a suite runs in, `tmp` the TMPDIR it was handed; a step without them (the
// self-update's clone and parse) is reaped by its process group alone
export interface RunScope { tree?: string; tmp?: string }
interface ProcRow { pid: number; pgid: number; cwd?: string; tmpdirs: string[] }
const under = (path: string | undefined, dir: string | undefined): boolean =>
  !!path && !!dir && (path === dir || path.startsWith(`${dir}/`));
// the clone's resolved path, because lsof and /proc report resolved paths (/tmp is /private/tmp on
// macOS); the clone may not exist yet while it is being cloned, so its parent resolves instead
const resolved = (p: string): string => {
  try { return realpathSync(p); } catch { /* not there yet */ }
  try { return join(realpathSync(dirname(p)), p.slice(dirname(p).length + 1)); } catch { return p; }
};
async function readOut(argv: string[]): Promise<string> {
  try {
    const p = Bun.spawn(argv, { stdout: "pipe", stderr: "ignore", stdin: "ignore" });
    const out = await new Response(p.stdout).text();
    await p.exited;
    return out;
  } catch { return ""; }
}
// THE PROCESS TABLE, read for these three facts and nothing else. Nothing here is printed: the
// environment of a process in this fleet carries credentials, and only TMPDIR is kept from it.
async function processTable(): Promise<ProcRow[]> {
  const rows: ProcRow[] = [];
  if (process.platform === "linux") {
    let pids: string[] = [];
    try { pids = readdirSync("/proc").filter((n) => /^\d+$/.test(n)); } catch { return rows; }
    for (const name of pids) {
      try {
        const stat = readFileSync(`/proc/${name}/stat`, "utf8");
        const pgid = Number(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[2]);
        const row: ProcRow = { pid: Number(name), pgid, tmpdirs: [] };
        // another user's process answers EACCES here, and is no member of this run
        try { row.cwd = readlinkSync(`/proc/${name}/cwd`).replace(/ \(deleted\)$/, ""); } catch { /* idem */ }
        try {
          const env = readFileSync(`/proc/${name}/environ`, "utf8").split("\0").find((e) => e.startsWith("TMPDIR="));
          if (env) row.tmpdirs.push(env.slice(7));
        } catch { /* idem */ }
        rows.push(row);
      } catch { /* gone between the listing and the read */ }
    }
    return rows;
  }
  const uid = String(process.getuid?.() ?? "");
  const byPid = new Map<number, ProcRow>();
  for (const line of (await readOut(["ps", "-E", "-ww", "-o", "pid=,pgid=,command=", "-U", uid])).split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s(.*)$/.exec(line);
    if (!m) continue;
    // ps prints the environment after the arguments, so an argument can read like it: every
    // occurrence is kept, and a false one can only ever name a directory, never widen past one
    const tmpdirs = [...m[3]!.matchAll(/ TMPDIR=(\S+)/g)].map((t) => t[1]!);
    byPid.set(Number(m[1]), { pid: Number(m[1]), pgid: Number(m[2]), tmpdirs });
  }
  let pid = 0;
  for (const line of (await readOut(["lsof", "-a", "-d", "cwd", "-u", uid, "-Fpn"])).split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && byPid.has(pid)) byPid.get(pid)!.cwd = line.slice(1);
  }
  rows.push(...byPid.values());
  return rows;
}
export async function runMembers(head: number, scope: RunScope): Promise<number[]> {
  const dirs = [scope.tree, scope.tmp].filter((d): d is string => !!d);
  const cwds = [...dirs, ...dirs.map(resolved)];
  return (await processTable()).filter((r) => r.pid !== process.pid && (r.pgid === head
    || r.tmpdirs.some((t) => under(t, scope.tmp)) || cwds.some((d) => under(r.cwd, d)))).map((r) => r.pid);
}
async function reapRun(head: { pid: number; kill(sig?: number): void }, scope: RunScope): Promise<void> {
  const pass = async (sig: number): Promise<number> => {
    const members = await runMembers(head.pid, scope);
    try { head.kill(sig); } catch { /* already gone */ }
    for (const pid of members) { try { process.kill(pid, sig); } catch { /* already gone */ } }
    return members.length;
  };
  if (await pass(15) === 0) return;
  const killAt = Date.now() + ABORT_KILL_GRACE_MS;
  while (Date.now() < killAt) {
    await Bun.sleep(Math.min(500, Math.max(0, killAt - Date.now())));
    if ((await runMembers(head.pid, scope)).length === 0) return;
  }
  // more than one round: a member may fork between a scan and its signal
  for (let round = 0; round < 3; round++) {
    if (await pass(9) === 0) return;
    await Bun.sleep(100);
  }
}
// the groups of the runs alive right now, for the one ending no reap sees: this daemon's own death
// by a signal. Its children no longer share its group, so a Ctrl-C would not reach them otherwise.
const liveGroups = new Set<number>();
// THE SAME RUNNER WITHOUT A SHELL, and it is the whole of "no shell interpolation" on this machine.
// `runCmd` above keeps `sh -c` because its command comes out of THIS machine's own config file
// (`installCmd`, `suiteCmd`) — a string an owner wrote here, where a shell is the point. A command
// JOB's line came over the wire, so it arrives pre-split as argv and is exec'd directly: no quoting,
// no glob, no `&&`, no substitution, and nothing for a crafted string to escape out of.
// `extraEnv` is the ONE way anything FLEET_-prefixed gets back into a child, and it exists for these
// values: this run's own suite lock, its scratch TMPDIR, its port band FLEET_E2E_BAND, a shard job's
// FLEET_E2E_SHARD, a narrowed preview's FLEET_E2E_MODULES and an audit's FLEET_E2E_SKIP_UNITS /
// FLEET_E2E_DOM_MUTANTS (see `suiteEnv` in `work`). It is applied AFTER
// `childEnv()`, so it can only add what this process deliberately puts there — never re-admit
// something the strip above removed by accident.
export async function runArgv(argv: string[], cwd: string, logPath: string, timeoutMs: number,
  extraEnv: Record<string, string> = {}, signal?: AbortSignal, scope: RunScope = {}): Promise<{ code: number | null; timedOut: boolean }> {
  if (signal?.aborted) return { code: null, timedOut: false };
  const fd = openSync(logPath, "a");
  try {
    // `detached` is setsid: the head leads a group of its own, and whatever it forks without a
    // setsid of its own stays in that group after it reparents to init
    const proc = Bun.spawn(argv, {
      cwd, env: { ...childEnv(), ...extraEnv }, stdin: "ignore", stdout: fd, stderr: fd, detached: true,
    });
    liveGroups.add(proc.pid);
    let timedOut = false;
    let reaping: Promise<void> | undefined;
    const reap = (): Promise<void> => (reaping ??= reapRun(proc, scope));
    const t = setTimeout(() => { timedOut = true; void reap(); }, timeoutMs);
    const onAbort = (): void => { void reap(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const code = await proc.exited;
    clearTimeout(t);
    signal?.removeEventListener("abort", onAbort);
    // the NORMAL end goes through the same reap: an exit code says the head is done, not its run
    await reap().finally(() => liveGroups.delete(proc.pid));
    return { code: timedOut || signal?.aborted ? null : code, timedOut };
  } finally { closeSync(fd); }
}

// THE ONE FACT ONLY THIS MACHINE CAN SUPPLY: the sha this daemon actually checked out. It needs
// its own spawn because runCmd sends stdout INTO the suite log by design, and this value has to be
// read rather than logged. The claim's `mainSha` is the server's reading of the bundle header it
// built — it says what was HANDED OVER, never what was RUN here, and the two are only the same
// commit if the clone did what it was told. Without this line a remote red over a repo somebody is
// editing in parallel cannot be adjudicated at all: "the helper measured a different tree" can be
// neither shown nor ruled out (2026-08-29, 748ec97 — docs/messungen/2026-08-29-adjudikation-workhorse-401.md).
// MEASURED OR ABSENT, never guessed: a rev-parse that fails hands back undefined, and the server
// stores nothing rather than a value the ledger would read as a measurement.
async function clonedHeadOf(dir: string): Promise<string | undefined> {
  try {
    const p = Bun.spawn(["git", "-C", dir, "rev-parse", "HEAD"],
      { stdout: "pipe", stderr: "ignore", stdin: "ignore", env: childEnv() });
    const out = (await new Response(p.stdout).text()).trim();
    return (await p.exited) === 0 && /^[0-9a-f]{40}$/.test(out) ? out : undefined;
  } catch { return undefined; }
}
// THE SAME MEASUREMENT TURNED ON THIS PROCESS: the commit the tree this daemon is RUNNING FROM is
// at, read once at boot with the rev-parse above and sent on every heartbeat as `daemonSha`. It is
// what makes "did the update take?" answerable from the board rather than from a journal on the
// other machine — and, like `clonedSha`, it is measured or absent: a daemon started from a plain
// copy outside any git checkout sends no field rather than a guess.
let daemonSha: string | undefined;

const repoCache = new WeakMap<NonNullable<HelperConfig["repos"]>, { reading: HelperReposReading; pending?: Promise<HelperReposReading> }>();
export async function reposOf(repos: NonNullable<HelperConfig["repos"]>): Promise<HelperReposReading> {
  const cached = repoCache.get(repos);
  if (cached?.pending) return cached.pending;
  if (cached && Date.now() - cached.reading.at < HELPER_REPOS_CACHE_MS) return cached.reading;
  const at = Date.now();
  const deadline = at + HELPER_REPOS_BUDGET_MS;
  const git = async (dir: string, ...args: string[]): Promise<string | undefined> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return undefined;
    try {
      const p = Bun.spawn(["git", "--no-optional-locks", "-C", dir, ...args],
        { stdout: "pipe", stderr: "ignore", stdin: "ignore", env: childEnv() });
      const timer = setTimeout(() => p.kill(), Math.min(750, remaining));
      try {
        const reader = p.stdout.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          bytes += next.value.byteLength;
          if (bytes > 32768) { p.kill(); await reader.cancel(); await p.exited; return undefined; }
          chunks.push(next.value);
        }
        return await p.exited === 0 ? Buffer.concat(chunks).toString("utf8").trim() : undefined;
      } finally { clearTimeout(timer); }
    } catch { return undefined; }
  };
  const measure = async (): Promise<HelperReposReading> => {
    const readings: HelperRepoReading[] = [];
    for (const repo of repos) {
      const r: HelperRepoReading = { name: repo.name, at: Date.now(), head: null, branch: null,
        remote: null, remotes: null, refs: [], coverage: "incomplete", reason: "unreadable" };
      readings.push(r);
      const root = await git(repo.path, "rev-parse", "--show-toplevel");
      if (!root) {
        if (Date.now() >= deadline) r.reason = "budget";
        continue;
      }
      try {
        if (realpathSync(repo.path) !== realpathSync(root)) { r.reason = "not-repo-root"; continue; }
      } catch { continue; }
      const head = await git(repo.path, "rev-parse", "HEAD");
      if (!head || !/^[0-9a-f]{40}$/.test(head)) {
        if (Date.now() >= deadline) r.reason = "budget";
        continue;
      }
      r.head = head;
      const branch = await git(repo.path, "branch", "--show-current");
      if (branch === undefined) { r.reason = "budget"; continue; }
      if (branch && !helperGitLabel(branch)) { r.reason = "unsafe-label"; continue; }
      r.branch = branch || null;
      const remotes = await git(repo.path, "remote");
      if (remotes === undefined) { r.reason = "budget"; continue; }
      const names = remotes ? remotes.split("\n") : [];
      if (names.some((n) => !HELPER_REPO_NAME_RE.test(n))) { r.reason = "unsafe-label"; continue; }
      r.remote = names.length ? "present" : "none";
      r.remotes = names.slice(0, HELPER_REPO_REMOTES_MAX);
      r.coverage = names.length > HELPER_REPO_REMOTES_MAX ? "incomplete" : "complete";
      r.reason = names.length > HELPER_REPO_REMOTES_MAX ? "remote-cap" : null;
      const refs = names.length ? await git(repo.path, "for-each-ref", `--count=${HELPER_REPO_REFS_MAX + 1}`,
        "--format=%(refname) %(objectname) %(symref)", ...r.remotes.map((n) => `refs/remotes/${n}/`)) : "";
      if (refs === undefined) { r.coverage = "incomplete"; r.reason = "budget"; continue; }
      const allRows = refs ? refs.split("\n") : [];
      const rows = allRows;
      if (allRows.length > HELPER_REPO_REFS_MAX) { r.coverage = "incomplete"; r.reason = "ref-cap"; }
      for (const line of rows.slice(0, HELPER_REPO_REFS_MAX)) {
        const [fullRef, sha] = line.trim().split(" ");
        if (!fullRef?.startsWith("refs/remotes/")) { r.coverage = "incomplete"; r.reason = "unsafe-label"; continue; }
        const ref = fullRef.slice("refs/remotes/".length);
        if (!helperGitLabel(ref) || !sha || !/^[0-9a-f]{40}$/.test(sha)) {
          r.coverage = "incomplete"; r.reason = "unsafe-label"; continue;
        }
        const updated = await git(repo.path, "reflog", "show", "-1", "--format=%gD", "--date=unix", fullRef);
        const stamp = updated?.match(/@\{(\d+)\}/)?.[1];
        const row: HelperRepoReading["refs"][number] = { ref, head: sha,
          updatedAt: stamp ? Number(stamp) * 1000 : null, mergeBase: null, ahead: null, behind: null, reason: null };
        r.refs.push(row);
        const range = await git(repo.path, "rev-list", "--left-right",
          `--max-count=${HELPER_REPO_COMMITS_MAX + 1}`, `${head}...${sha}`, "--");
        const commits = range ? range.split("\n") : [];
        if (range === undefined) row.reason = "budget";
        else if (commits.length > HELPER_REPO_COMMITS_MAX) row.reason = "commit-cap";
        else if (commits.some((c) => !/^[<>][0-9a-f]{40}$/.test(c))) row.reason = "unreadable";
        else {
          const base = await git(repo.path, "merge-base", "--all", head, sha);
          if (!base || !/^[0-9a-f]{40}$/.test(base)) row.reason = Date.now() >= deadline ? "budget" : "no-merge-base";
          else { row.mergeBase = base; row.ahead = commits.filter((c) => c[0] === "<").length;
            row.behind = commits.filter((c) => c[0] === ">").length; }
        }
        if (row.reason) { r.coverage = "incomplete"; r.reason ??= row.reason; }
      }
    }
    return { at, repos: readings };
  };
  const pending = measure();
  repoCache.set(repos, { reading: cached?.reading ?? { at: 0, repos: [] }, pending });
  const reading = await pending;
  repoCache.set(repos, { reading });
  return reading;
}

export interface InstanceReading {
  head: string; bundleStale: boolean; behindCount: number; syncExit: number; at: number;
}
function newestSourceMtime(dir: string): number | undefined {
  let newest: number | undefined;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const mtime = entry.isDirectory() ? newestSourceMtime(path) : statSync(path).mtimeMs;
      if (mtime === undefined) return undefined;
      newest = Math.max(newest ?? mtime, mtime);
    }
  } catch { return undefined; }
  return newest;
}
async function gitReading(dir: string, ...args: string[]): Promise<string | undefined> {
  try {
    const p = Bun.spawn(["git", "-C", dir, ...args],
      { stdout: "pipe", stderr: "ignore", stdin: "ignore", env: childEnv() });
    const out = (await new Response(p.stdout).text()).trim();
    return (await p.exited) === 0 ? out : undefined;
  } catch { return undefined; }
}
export async function instanceOf(dir: string): Promise<InstanceReading | undefined> {
  const head = await gitReading(dir, "rev-parse", "HEAD");
  if (!head || !/^[0-9a-f]{40}$/.test(head)) return undefined;
  const remote = process.env.FLEET_SYNC_REMOTE || "canonical";
  const count = await gitReading(dir, "rev-list", "--count", `${head}..${remote}/main`);
  const behindCount = count === undefined ? NaN : Number(count);
  if (!Number.isSafeInteger(behindCount) || behindCount < 0) return undefined;
  let syncExit: number;
  try {
    const status = JSON.parse(readFileSync(join(dir, ".fleet-sync-status.json"), "utf8")) as { exit?: unknown };
    syncExit = status.exit as number;
    if (!Number.isInteger(syncExit) || syncExit < 0 || syncExit > 7) return undefined;
  } catch { return undefined; }
  const sourceMtime = newestSourceMtime(join(dir, "src"));
  if (sourceMtime === undefined) return undefined;
  let bundleStale = false;
  for (const file of ["app.js", "share.js", "helper.js", "hub.js"]) {
    try { if (statSync(join(dir, "public", file)).mtimeMs < sourceMtime) bundleStale = true; }
    catch { return undefined; }
  }
  return { head, bundleStale, behindCount, syncExit, at: Date.now() };
}

// the last N lines, read out of the tail of the file rather than the whole of it: a real
// ./e2e-isolated.sh log is hundreds of kilobytes and only its end is ever sent.
export function tailOf(text: string, lines = 40): string {
  return text.split("\n").filter((l) => l.length).slice(-lines).join("\n");
}
// the same string the portal asks a human to paste, derived the same way its own bootstrap line
// derives it (`grep -ao 'isolated-[0-9TZ]*-[0-9]*' log | sort -u | head -1`).
export function trailIdOf(text: string): string | undefined {
  return /isolated-[0-9TZ]+-[0-9]+/.exec(text)?.[0];
}
const FAILS_KEEP = 50;
const FAIL_NAME_MAX = 300;
const failName = (raw: string): string =>
  [...raw.trim()].filter((ch) => ch >= " " && ch !== "\u007f").slice(0, FAIL_NAME_MAX).join("").trim();
const boundedFailNames = (names: string[]): string[] =>
  names.map(failName).filter(Boolean).slice(0, FAILS_KEEP);

export async function failNamesOf(logPath: string, trail: string | undefined): Promise<string[]> {
  if (trail) {
    const trailPath = join(dirname(logPath), "tree", "e2e-trail", `${trail}.jsonl`);
    try {
      const names: string[] = [];
      for (const line of (await Bun.file(trailPath).text()).split("\n")) {
        if (!line) continue;
        try {
          const row = JSON.parse(line) as { ok?: unknown; check?: unknown; quarantined?: unknown };
          // a row marked `quarantined` stays ok:false for the flake statistics (e2e/trail-emit.ts),
          // but the suite printed it as QUAR and did not count it: never a fail of this run
          if (row.ok === false && row.quarantined !== true && typeof row.check === "string") names.push(row.check);
        } catch { /* a torn row does not erase intact observations before it */ }
      }
      if (names.length) return boundedFailNames(names);
    } catch { /* a missing/unreadable trail falls through to the log */ }
  }
  try {
    const p = Bun.spawn(["grep", "^FAIL ", logPath],
      { stdout: "pipe", stderr: "ignore", stdin: "ignore", env: childEnv() });
    const text = await new Response(p.stdout).text();
    const code = await p.exited;
    if (code !== 0 && code !== 1) return [];
    return boundedFailNames(text.split("\n").filter(Boolean)
      .map((line) => line.replace(/^FAIL\s+/, "").replace(/\s{2}\(.*$/, "")));
  } catch { return []; }
}
// THE ARTEFACT DIGEST, computed IN THE CLONE and nowhere else. Three facts per file and no
// content: `path` relative to the clone, `sha256` of its bytes, `bytes` as a number. Nothing is
// uploaded in this slice — the receipt NAMES what the run produced so the asking session can decide
// whether it wants it, which is a different question from whether the run went green.
//
// BOUNDED THREE WAYS, because a glob is written by the asking session and evaluated here: at most
// ARTIFACT_KEEP rows in total, at most ARTIFACT_HASH_MAX bytes hashed per file, and only files
// (never directories, never symlinks followed out of the tree — Bun.Glob's scan yields paths, and
// a path that leaves the clone is refused by the server's own validator on arrival).
const ARTIFACT_KEEP = 50;
const ARTIFACT_HASH_MAX = 256 * 1024 * 1024;
export interface ArtifactRow { path: string; sha256: string; bytes: number }
export async function artifactsOf(clone: string, globs: string[]): Promise<ArtifactRow[]> {
  const seen = new Set<string>();
  const out: ArtifactRow[] = [];
  for (const pattern of globs) {
    if (out.length >= ARTIFACT_KEEP) break;
    let matches: string[] = [];
    try {
      matches = [];
      for await (const rel of new Bun.Glob(pattern).scan({ cwd: clone, onlyFiles: true, dot: false }))
        matches.push(rel);
    } catch { continue; } // a malformed glob names no file; it is not a reason to lose the run
    for (const rel of matches.sort()) {
      if (out.length >= ARTIFACT_KEEP) break;
      // THE SERVER'S OWN RULE, imported (src/protocol.ts#helperArtifactPathOk): the server refuses
      // the WHOLE report when one row fails it, so a scanned path it would refuse — over 300
      // characters, a control byte, a backslash — is dropped HERE and logged, and the verdict
      // still arrives with the rows that pass.
      if (seen.has(rel)) continue;
      seen.add(rel);
      if (!helperArtifactPathOk(rel)) {
        log(`artifact ${JSON.stringify(rel.slice(0, 80))}${rel.length > 80 ? "…" : ""} (${rel.length} chars) fails the fleet's path rule — left out of the receipt`);
        continue;
      }
      try {
        const file = Bun.file(`${clone}/${rel}`);
        const bytes = file.size;
        if (bytes > ARTIFACT_HASH_MAX) continue;
        const hasher = new Bun.CryptoHasher("sha256");
        hasher.update(new Uint8Array(await file.arrayBuffer()));
        out.push({ path: rel, sha256: hasher.digest("hex"), bytes });
      } catch { /* a file that vanished between scan and read is not in the receipt */ }
    }
  }
  return out;
}
const readSlice = async (path: string, from: number, to: number): Promise<string> => {
  try { return await Bun.file(path).slice(from, to).text(); } catch { return ""; }
};

// THE LOCAL SUITE COUNTER — what used to be a boolean, and the day the comment above it warned
// about ("a second caller is added") is this one: `start` below launches `work` WITHOUT awaiting it,
// so more than one can be in flight. The count is the whole mutex now, and `freeSuiteSlots` is the
// only place that reads it against the cap.
//
// The MACHINE-wide mutex is still deliberately NOT duplicated here: ./e2e-isolated.sh takes its
// lock through e2e-stage.sh inside the clone. What changed is WHICH lock — see `suiteEnv` in
// `work`: at cap 1 the runs share the default one (so a hand-started suite on this machine still
// serializes against this daemon's), and above 1 each run gets its own, or the second slot would
// only ever be a place in the waiting line.
let runningJobs = 0;
// Exported because it is the whole policy in one expression, and a policy nothing can call is a
// policy nothing can test: e2e/helper-daemon.ts drives it directly at cap 1 and cap 2.
export function freeSuiteSlots(cfg: HelperConfig, running: number): number {
  return Math.max(0, cfg.maxParallelSuites - running);
}
// A MERGE CHECK RUNS BESIDE THIS DAEMON, not through it (ci/merge-check-run.sh writes its pid to
// `mergeCheckPidFile` while it runs). It stands in front of a merge and answers within 5 min; an
// audit shard gates nothing. So while that pid lives, `mergeCheckSlots` of this machine's slots start
// nothing new — runs already going keep going. A file older than MERGE_CHECK_STALE_MS is a run that
// died without its cleanup, and its pid may belong to someone else by now: no hold.
const MERGE_CHECK_STALE_MS = 30 * 60_000;
export function mergeCheckHeld(cfg: HelperConfig, now = Date.now()): number {
  if (cfg.mergeCheckSlots <= 0) return 0;
  try {
    if (now - statSync(cfg.mergeCheckPidFile).mtimeMs > MERGE_CHECK_STALE_MS) return 0;
    const pid = Number(readFileSync(cfg.mergeCheckPidFile, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 1) return 0;
    process.kill(pid, 0);
    return cfg.mergeCheckSlots;
  } catch {
    return 0; // no file, or no such process: nothing holds a slot
  }
}
// LAUNCHED, NOT AWAITED — that is the whole of "two at once", and the reservation is what makes it
// safe: `runningJobs` is incremented SYNCHRONOUSLY here, before the first await inside `work`, so
// the rest of this tick and every tick after it already sees the slot as taken. Reserving around
// the WHOLE call and not (as the old flag did) around the part after the claim is deliberate: two
// claim POSTs in flight for the same machine is the race this counter exists to refuse.
// THE RUNS THIS PROCESS HOLDS A CLAIM FOR, and the switch that ends each one. Measured 2026-09-12
// (7e601e57): a lane landed and its preview offer was reaped on the fleet within the minute, while
// this daemon ran the preview on for 37 more minutes and was told `409 no live claim` at the end.
// Nothing here had asked the one question that would have ended it sooner: is my job still on
// the list? `claimedAt` is what the claim answered; `since` is when this process learned it, so a
// job list that was ALREADY on its way before the claim came back can never read as a withdrawal.
interface InFlight { claimedAt: number | undefined; since: number; abort: AbortController }
const inFlight = new Map<string, InFlight>();
// WHICH OF MY RUNS HAS THE FLEET TAKEN BACK — pure, exported, and checked in e2e/helper-daemon.ts
// (HD.1) for the same reason freeSuiteSlots is. A run is withdrawn when a job list asked for AFTER
// its claim came back no longer carries the job, or carries it under a DIFFERENT claim (it lapsed
// and was offered again — the fleet would refuse this verdict with the same 409). Nothing else
// counts: a list that could not be read is no evidence, and aborting on it would throw away a
// healthy run over a network blip.
export function withdrawnRuns(running: ReadonlyMap<string, { claimedAt: number | undefined; since: number }>,
  jobs: readonly JobView[], askedAt: number): string[] {
  const out: string[] = [];
  for (const [id, r] of running) {
    if (r.since > askedAt) continue;
    const listed = jobs.find((j) => j.id === id);
    if (!listed || !listed.claim
      || (r.claimedAt !== undefined && listed.claim.claimedAt !== undefined && listed.claim.claimedAt !== r.claimedAt))
      out.push(id);
  }
  return out;
}
// WHAT THIS TICK MAY START — pure, exported, checked in e2e/helper-daemon.ts (HD.1) and pinned in
// e2e/pins.ts. A `daemon-update` ends this process with exit 75, and every claim the process holds
// at that moment is left on the fleet with nobody running it until it EXPIRES. Measured 2026-09-14
// 09:24 on helper-device-1: one poll saw an idle machine, an open audit and the update, claimed
// BOTH, the update swapped and exited, and the audit's claim sat on the fleet for ~45 min with no
// run behind it (and the deploy behind the audit with it). Hence two rules, and only these:
//   · while an update is listed for this machine, NOTHING ELSE is started — not beside it, and not
//     while it waits for the running jobs to drain (otherwise a busy queue starves it forever);
//   · the update itself starts only when `running` is 0 — this process holds no other claim.
// One exception keeps a dead predecessor from parking the machine: an update listed as CLAIMED
// while nothing runs here is not this process's (its own claim is always counted in `running`, from
// `start` to the `finally`), so ordinary jobs go on until that stale claim lapses or is reported.
// …AND A JOB THIS PROCESS IS ALREADY STARTING IS NOT OPEN, whatever the list says. Measured
// 2026-09-29 11:17Z and 11:23Z on workhorse (journalctl -u fleet-helper): a claim took ~80 s because
// the server built the bundle on a loaded Mac, the job stayed unclaimed on the list that long, and
// the next 15 s tick started it AGAIN — d75ab95a5a56, b8bc95b68006 and be393e0c3e84 each claimed
// twice, the second one refused 409, and `running` stood at 8 of 8 with 5 real runs, so the machine
// took nothing more. `busy` is the ids `start` has launched and not yet finished (plus every run in
// `inFlight`); it is a parameter so this function stays pure and HD can drive it.
// …AND A LANE'S JOB GOES BEFORE AN AUDIT SHARD. Measured 2026-10-08 14:4x–15:0x: the list came in
// FIFO, three shards of one post-land audit took every slot of the work-horse, and lanes 10A and 4B
// ran e2e-security.sh and e2e-claude-gate.sh on the Mac behind its mutex instead. A `command` job (a
// gate suite) and a `lane-suite` (a lane's preview) are minutes long and stand in front of a land;
// a shard is 11–22 min and gates nothing. So the open jobs are taken by rank — command, then
// lane-suite, then everything else — in list order within a rank, and while a lane job is open the
// last free slot is its own. NOT a slot held empty for a lane job that is not listed yet: the fleet
// reads a machine with a free slot as unsaturated (server.ts#helperSaturation), and a shard left
// unclaimed beside it goes local on the Mac after its grace.
// …SAVE AN AUDIT THE FLEET MARKS OVERDUE, which goes right behind the commands. Measured 2026-10-10
// (Orchestratorin note 12dba626): one audit entry for six lands waited from 06:40, and at 08:21 this
// daemon took five lane jobs straight after a swap — four lanes with three shards each plus their
// gate suites kept every slot, so the rank above starved the audit, no green audit stamped the tip,
// and no deploy could go. The fleet marks an audit `overdue` once its oldest land is past the
// cadence's ceiling; that one then takes the next free slot before any lane-suite job. Still nothing
// held empty: an overdue audit is a listed job, and a slot nobody's job can use is taken as before.
export function jobsToStart(jobs: readonly JobView[], free: number, running: number,
  busy: ReadonlySet<string>): JobView[] {
  const update = jobs.find((j) => j.kind === "daemon-update");
  if (update && (running > 0 || !update.claim)) return running === 0 ? [update] : [];
  const rank = (j: JobView): number =>
    j.kind === "command" ? 0 : j.kind === "audit" && j.overdue === true ? 1 : j.kind === "lane-suite" ? 2 : 3;
  return jobs.filter((j) => j.kind !== "daemon-update" && !j.claim && !j.localRunning && !busy.has(j.id))
    .map((j, i) => ({ j, i })).sort((a, b) => rank(a.j) - rank(b.j) || a.i - b.i).map(({ j }) => j)
    .slice(0, Math.max(0, free));
}
// THE IDS `start` HAS LAUNCHED — filled SYNCHRONOUSLY beside `runningJobs++`, before the claim's
// first await, and emptied in the same `finally`, so the claim window (where the fleet still lists
// the job open) is covered from its first instant to its last.
const startingJobs = new Set<string>();
// THE PORT BANDS this process's runs hold (portBand): taken in `work` in the same synchronous step
// that picks it, given back in its `finally`.
const heldBands = new Set<number>();
function start(cfg: HelperConfig, job: JobView): void {
  runningJobs++;
  startingJobs.add(job.id);
  void work(cfg, job)
    .catch((e) => onFault(e, `job ${job.id}`))
    .finally(() => { runningJobs--; startingJobs.delete(job.id); });
}

async function work(cfg: HelperConfig, job: JobView): Promise<void> {
  const claimRes = await api(cfg, "/api/helper/claim",
    { method: "POST", body: JSON.stringify({ jobId: job.id, deviceId: cfg.deviceId }) });
  const claimed = await bodyOf<{ job?: ClaimedJob }>(claimRes);
  if (!claimRes.ok || !claimed.job) {
    // 404/409 is the portal REFUSING TO DUPLICATE WORK — another machine or the local drain got
    // there first. That is the rail working, not a fault, so it is a log line and not a backoff.
    log(`claim ${job.id} refused (${claimRes.status}): ${claimed.error ?? "no job in the answer"}`);
    return;
  }
  const j = claimed.job;
  // THE ONE KIND THAT IS ABOUT THIS PROCESS rather than about a tree to measure. It parts here,
  // before a run directory exists: an update leaves a TREE behind on purpose (it is the thing the
  // link will point at), and the run-dir belt below is built to throw its clone away.
  if (j.kind === "daemon-update") { await selfUpdate(cfg, j); return; }
  const runDir = `${cfg.workDir}/run-${j.id}-${Date.now()}`;
  const clone = `${runDir}/tree`;
  const logPath = `${runDir}/suite.log`;
  mkdirSync(runDir, { recursive: true });
  log(`claimed ${j.kind ?? "audit"} ${j.repo} ${j.main}@${j.mainSha.slice(0, 8)}${j.shard ? ` shard ${j.shard}` : ""}`
    + `${Array.isArray(j.modules) ? ` modules ${j.modules.length}` : ""}`
    + `${Array.isArray(j.skipUnits) ? ` skip ${j.skipUnits.join(",").slice(0, 80)}` : ""}${j.domMutants === true ? " dom-mutants" : ""} → ${runDir}`
    + ` (slot ${runningJobs} of ${cfg.maxParallelSuites})`);
  // A shard string this daemon cannot read fails as ITSELF, before a byte is downloaded: running the
  // whole suite in its place would file a full run under one shard of the fleet's merge.
  const shardVars = j.kind === "command" ? {} : shardEnv(j.shard);
  if (shardVars === null) {
    await report(cfg, j, 127, `the claim named shard ${JSON.stringify(j.shard)}, which is not k/n — this daemon cannot run that job`);
    return;
  }
  // …and a module list the same way: the full suite in its place would be filed as the narrowed answer.
  const modulesVars = modulesEnv(j.kind, j.modules);
  if (modulesVars === null) {
    await report(cfg, j, 127, `the claim named modules on a ${j.kind ?? "audit"} job this daemon will not narrow`
      + " (only a lane-suite takes them, as a non-empty list of module names) — this daemon cannot run that job");
    return;
  }
  // …and an audit's scope the same way: the full suite in its place would be filed as the scoped run,
  // and a scope on another kind would quietly change what that kind measures.
  const scopeVars = auditScopeEnv(j.kind, j.skipUnits, j.domMutants);
  if (scopeVars === null) {
    await report(cfg, j, 127, `the claim named skipUnits/domMutants on a ${j.kind ?? "audit"} job this daemon will not scope`
      + " (only an audit takes them: skipUnits as a non-empty list of unit names, domMutants as true) — this daemon cannot run that job");
    return;
  }

  // EACH PARALLEL RUN NEEDS ITS OWN MUTEX FILE, or `maxParallelSuites` buys nothing at all:
  // ./e2e-isolated.sh takes /tmp/fleet-e2e.lock through e2e-stage.sh INSIDE the clone, so two runs
  // pointed at the default lock queue behind each other and the second slot is only a place in the
  // waiting line — the field would be wired end to end and change no wall-clock. The ticket queue
  // e2e-stage.sh keeps is derived (`$FLEET_SUITE_LOCK.q`), so it moves with the lock by itself.
  //
  // AT CAP 1 THE DEFAULT LOCK IS LEFT ALONE, and that is a decision rather than an omission: it is
  // the setting under which a hand-started suite on this machine and this daemon's run serialize
  // against each other through the suite's own lock, and moving the daemon off it would end that
  // silently for every operator who never touched the new field. Above 1 the operator has said
  // this machine takes N suites at once, and a hand-started one is then the N+1st.
  //
  // THE SCRATCH MOVES AT EVERY CAP, and unlike the lock that is no change of meaning: every wrapper
  // puts its instance at `${TMPDIR:-/tmp}/fleet-e2e-*-$$` and KEEPS it on a red, and nothing but
  // this directory's prune ever reaches a run dir. Measured on the work-horse 2026-09-13
  // (docs/messungen/2026-09-14-ram-optimierung-astra.md §F7): /tmp is a 3 930 MB tmpfs, 98 % full,
  // 68 kept instances, and its non-resident pages were ~1.8 GB of that machine's 2.3 GB swap. The
  // lock is a literal /tmp path in e2e-stage.sh, not derived from TMPDIR, so cap-1 serialization
  // is untouched; tmux sockets follow TMUX_TMPDIR, which is not set here either.
  const scratch = `${runDir}/tmp`;
  mkdirSync(scratch, { recursive: true });
  const lockEnv: Record<string, string> = cfg.maxParallelSuites > 1
    ? { FLEET_SUITE_LOCK: `${runDir}/e2e.lock` } : {};
  // …and the shard, a further FLEET_ key a child may receive: ./e2e-isolated.sh passes it to its
  // runner, which runs only the units e2e/ctx.ts#shardPlan assigns to k. Absent on an unsharded job.
  // …and FLEET_E2E_MODULES, the other one, for a narrowed lane preview (modulesEnv): the runner runs
  // that selection's fixture closure. Absent on every other job. The fleet never sends both cuts on
  // one job, and the runner refuses them together by name.
  // …and an audit's scope (auditScopeEnv): FLEET_E2E_SKIP_UNITS, which the runner takes out of its
  // shard table, and FLEET_E2E_DOM_MUTANTS. Absent on every other job and on a plain audit.
  // …and FLEET_E2E_BAND, at every cap and for every kind: a command job may be ./e2e-isolated.sh
  // itself, and a wrapper that does not read it is untouched by it. No await between the pick and the
  // add, so two runs of this process can never be handed the same index.
  const band = portBand(heldBands);
  if (band === null) {
    await report(cfg, j, 127, `all ${PORT_BANDS} port bands are held by this daemon's runs — this daemon cannot run that job apart from them`);
    return;
  }
  heldBands.add(band);
  const suiteEnv: Record<string, string> = { TMPDIR: scratch, ...lockEnv, ...bandEnv(band), ...shardVars, ...modulesVars, ...scopeVars };
  // what proves a process belongs to THIS run when its reap comes (reapRun)
  const scope: RunScope = { tree: clone, tmp: scratch };
  // registered from here to the `finally`; `tick` pulls the switch (see withdrawnRuns). A withdrawn
  // run REPORTS NOTHING: the fleet has already refused the verdict, and every step below that would
  // report a failure caused by the kill itself returns on `withdrawn` first.
  const ctl = new AbortController();
  inFlight.set(j.id, { claimedAt: j.claimedAt, since: Date.now(), abort: ctl });
  activeRunDirs.add(runDir);
  const withdrawn = (): boolean => ctl.signal.aborted;

  try {
    const bundlePath = `${runDir}/job.bundle`;
    const bundle = await downloadBundle(cfg, j);
    if (withdrawn() || bundle === null) return;
    await Bun.write(bundlePath, bundle);

    // THE `-b` IS REQUIRED FOR BOTH KINDS, and the ref it names is the only thing that differs
    // between them. A bundle carries exactly the refs it was built from and NO HEAD, so a plain
    // clone only checks anything out when git can GUESS the single ref as HEAD — and it guesses
    // with `init.defaultBranch`. On a machine where that is `master` (the Debian default, and the
    // value of an unset one) the guess misses: the clone still exits 0, prints
    // `warning: remote HEAD refers to nonexistent ref, unable to checkout` and leaves an EMPTY
    // tree. Measured live on the linux work-horse, 2026-08-29. ONE expression picks the ref for
    // both kinds — a lane-suite claim names it `branch`, an audit claim names it `main`.
    const ref = j.branch ?? j.main;
    // A claim with NEITHER is a job this daemon cannot run. It is reported in the currency the rail
    // already has for "nothing was measured" (no exit code / 127 → unknown), never as a red and
    // never as a silent clone that might come back empty.
    if (!ref) {
      await report(cfg, j, 127, "the claim named no ref to clone (neither `branch` nor `main`) — this daemon cannot run that job");
      return;
    }
    const cloneCmd = `git clone -q -b ${sh(ref)} ${sh(bundlePath)} ${sh(clone)}`;
    const cloned = await runCmd(cloneCmd, runDir, logPath, 300_000, {}, ctl.signal, scope);
    if (withdrawn()) return;
    if (cloned.code !== 0) { await report(cfg, j, 127, `the clone failed (exit ${cloned.code})`, logPath); return; }
    // Measured HERE — before the belt below and before anything is installed or run — so that every
    // report from this point on carries the tree it is talking about, including the two that say
    // nothing was measured. Those are the reports where the question "which tree?" is hardest to
    // answer afterwards.
    const clonedSha = await clonedHeadOf(clone);

    // THE BELT AGAINST THE WHOLE CLASS, not just against the ref name above. `installCmd` needs a
    // populated tree; when that precondition broke, the first thing to notice was
    // `bun install --frozen-lockfile` finding no package.json — so the ledger said "install failed"
    // about a clone that had checked nothing out. That is the wrong error at the wrong place, and
    // an empty clone must fail as ITSELF.
    const populated = ((): boolean => {
      try { return readdirSync(clone).some((n) => n !== ".git"); } catch { return false; }
    })();
    if (!populated) {
      await report(cfg, j, 127, `the clone of ${ref} left an EMPTY working tree — nothing to install or run`, logPath, clonedSha);
      return;
    }

    const installed = await runCmd(cfg.installCmd, clone, logPath, 900_000, {}, ctl.signal, scope);
    if (withdrawn()) return;
    // A TREE THAT COULD NOT BE PREPARED MEASURED NOTHING, and `unknown` is the only honest verdict
    // for it. Exit 127 is the code the server's shared classifier reads as "could not be started"
    // (server.ts#remoteVerdictOf) — reporting 1 here would put a RED on the ledger for a suite that
    // never ran, which is the one lie this rail must not tell.
    if (installed.code !== 0) { await report(cfg, j, 127, `${cfg.installCmd} failed (exit ${installed.code})`, logPath, clonedSha); return; }

    // THE FORK BY KIND, and it is the ONE behavioural difference this feature introduces on this
    // machine. `cfg.suiteCmd` stays the DEFAULT and remains the whole of what an `audit` and a
    // `lane-suite` run — a daemon reading a job kind it does not know still runs the owner's own
    // configured command, byte for byte as before. A `command` job runs the ARGV the claim carried,
    // for its OWN timeout, and hashes the artefacts it was asked for.
    const isCommand = j.kind === "command";
    if (isCommand && (!Array.isArray(j.argv) || j.argv.length === 0)) {
      // an unrunnable claim fails as ITSELF: 127 is the code the server's shared classifier reads as
      // "could not be started" (server.ts#remoteVerdictOf), never a red about a command never run.
      await report(cfg, j, 127, "the claim named no argv — this daemon does not turn a command string into one", logPath, clonedSha);
      return;
    }
    const timeoutMs = isCommand && typeof j.timeoutMs === "number" && j.timeoutMs > 0
      ? j.timeoutMs : cfg.suiteTimeoutSec * 1000;
    const started = Date.now();
    const ran = isCommand
      ? await runArgv(j.argv!, clone, logPath, timeoutMs, suiteEnv, ctl.signal, scope)
      : await runCmd(cfg.suiteCmd, clone, logPath, timeoutMs, suiteEnv, ctl.signal, scope);
    if (withdrawn()) {
      log(`${isCommand ? "command" : "suite"} for ${j.id} ended by withdrawal after ${Math.round((Date.now() - started) / 1000)}s — nothing reported`);
      return;
    }
    log(`${isCommand ? `command ${j.cmd ?? j.argv!.join(" ")}` : "suite"} finished exit=${ran.code}`
      + ` timedOut=${ran.timedOut} in ${Math.round((Date.now() - started) / 1000)}s`);
    // HASHED BEFORE THE REPORT AND BEFORE THE `finally` BELOW REMOVES THE CLONE — and hashed even on
    // a red: a failing build that still produced a log is exactly the run whose artefacts are worth
    // naming. A timeout is the one case with no artefacts, because nothing here can say the files it
    // would find are finished ones.
    const artifacts = isCommand && !ran.timedOut
      ? await artifactsOf(clone, Array.isArray(j.artifacts) ? j.artifacts : [])
      : [];
    // A TIMEOUT REPORTS NO EXIT CODE AT ALL. The server reads a missing code as `unknown` with a
    // reason, which is what a killed run is — never a red, and never a silent green.
    // …and the BUDGET travels with it as a field, not only inside the note. `exitCode: null` reaches
    // the server identically whether a run was killed here or simply produced no code, and the
    // server cannot tell them apart — only this process can. Without the field the board's only
    // honest word is "unknown", which is true and says nothing about what to do next.
    await report(cfg, j, ran.timedOut ? null : ran.code,
      ran.timedOut ? `the ${isCommand ? "command" : "suite"} passed ${Math.round(timeoutMs / 1000)}s and was killed here` : "",
      logPath, clonedSha, artifacts, ran.timedOut ? timeoutMs : undefined);
  } finally {
    inFlight.delete(j.id);
    activeRunDirs.delete(runDir);
    heldBands.delete(band);
    // the clone goes, `tmp/` stays: a red's kept instance is the evidence, and `pruneRuns` bounds it
    try { rmSync(clone, { recursive: true, force: true }); } catch { /* the verdict is already sent */ }
    try { rmSync(`${runDir}/job.bundle`, { force: true }); } catch { /* idem */ }
    pruneRuns(cfg.workDir, cfg.keepRuns, activeRunDirs);
  }
}

// `timedOutMs` is the ONE fact about a non-measurement that only this machine holds: the budget the
// run was killed at. Present ⇒ `reason: "timeout"` on the wire. The OTHER non-measurement,
// "could not be started", is deliberately NOT sent — 126/127 is already read by the server's shared
// classifier (server.ts#remoteVerdictOf), and one function deciding what an exit code means is
// worth more than a second opinion travelling beside it.
export async function report(cfg: HelperConfig, j: ClaimedJob, exitCode: number | null, note: string,
  logPath?: string, clonedSha?: string, artifacts: ArtifactRow[] = [],
  timedOutMs?: number): Promise<void> {
  const size = logPath && existsSync(logPath) ? statSync(logPath).size : 0;
  const head = logPath ? await readSlice(logPath, 0, Math.min(size, 65_536)) : "";
  const end = logPath ? await readSlice(logPath, Math.max(0, size - 65_536), size) : "";
  const tail = [note, tailOf(end)].filter(Boolean).join("\n");
  const trail = trailIdOf(head);
  const fails = logPath ? await failNamesOf(logPath, trail) : [];
  const res = await api(cfg, "/api/helper/result", {
    method: "POST",
    // `clonedSha` is SPREAD, so a report from before the clone (or after a rev-parse that failed)
    // carries no such key at all. An absent field is the honest shape for "not measured"; a null
    // one would be a claim this daemon is not in a position to make.
    // `artifacts` is SPREAD like `clonedSha`: a report from a kind that has none carries no such key
    // at all, so the two older job kinds' bodies are byte-identical to what they were.
    // `reason`/`timeoutMs` are SPREAD like `clonedSha` and `artifacts`: a report that did not time
    // out carries no such keys, so every body this daemon sent before is byte-identical.
    body: JSON.stringify({ jobId: j.id, exitCode, tail, fails, ...(trail ? { trail } : {}),
      ...(clonedSha ? { clonedSha } : {}), ...(artifacts.length ? { artifacts } : {}),
      ...(timedOutMs ? { reason: "timeout", timeoutMs: timedOutMs } : {}) }),
  });
  const body = await bodyOf<{ result?: string; auditAt?: number; artifactAt?: number }>(res);
  log(`reported ${j.id} exit=${exitCode} artifacts=${artifacts.length} → ${res.status} ${body.result ?? body.error ?? ""}`);
  // AND ONLY NOW THE LOG. Strictly after the verdict is in, and never a condition of it: the whole
  // point of this rail is that a red run can be read afterwards, which is worth nothing if the
  // transfer can hold the verdict up. Hence the shape below — no retry, no backoff, no throw, and
  // no effect on anything this function already did.
  //
  // `artifactAt ?? auditAt`, and the ORDER is the whole loosening: the uploader used to hang on
  // `auditAt`, which only the AUDIT receipt carries — so a lane-suite preview, the one kind whose
  // red a human is waiting on live, uploaded nothing and its log died in the `finally` below.
  // `artifactAt` is the key every kind now answers with; `auditAt` stays as the fallback so this
  // daemon keeps working, unchanged, against a server from before that field.
  if (logPath) await uploadSuiteLog(cfg, j, body.artifactAt ?? body.auditAt, logPath);
}

// The suite.log upload. Three refusals to send at all, each of them a fact the server would
// otherwise have to guess at:
//   · no row key in the receipt — that server filed this verdict against nothing it can name (a
//     command job's, and every kind's on a server from before `artifactAt`), so there is nothing
//     to file a log against. Silence, not an error.
//   · nothing on disk, or an empty file: an upload of zero bytes would put a rail row on a red
//     saying "here is the log" and hand back nothing.
//   · over the cap this daemon knows about — the server refuses the same size with a 413, and
//     spending the upload to be told so is the one cost that is avoidable here.
// Everything else is the server's to judge, and its answer is LOGGED and dropped.
const SUITE_LOG_MAX = 8 * 1024 * 1024; // mirrors FLEET_HELPER_ARTIFACT_MAX's default, deliberately
async function uploadSuiteLog(cfg: HelperConfig, j: ClaimedJob, rowAt: number | undefined,
  logPath: string): Promise<void> {
  if (typeof rowAt !== "number" || !Number.isFinite(rowAt)) return;
  let size = 0;
  try { size = existsSync(logPath) ? statSync(logPath).size : 0; } catch { return; }
  if (size === 0) { log(`no suite.log to upload for ${j.id}`); return; }
  if (size > SUITE_LOG_MAX) {
    log(`suite.log for ${j.id} is ${size}b, over the ${SUITE_LOG_MAX}b cap — not uploaded`);
    return;
  }
  try {
    const res = await api(cfg, `/api/helper/artifact/${j.id}?at=${rowAt}`, {
      method: "POST",
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: await Bun.file(logPath).arrayBuffer(),
    });
    const body = await bodyOf<{ artifact?: { bytes?: number } }>(res);
    log(`uploaded suite.log for ${j.id} (${size}b) → ${res.status} ${body.artifact?.bytes ?? body.error ?? ""}`);
  } catch (e) {
    // A LOG LINE AND NOTHING ELSE. The verdict is already on the ledger; a failed transfer must not
    // become a retry loop against a box that may simply be down.
    log(`suite.log upload for ${j.id} failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// --- the self-update ---------------------------------------------------------------------------
// FOUR STEPS, IN THIS ORDER AND NO OTHER: clone → check → symlink-swap → exit 75. Every step that
// can fail reports and RETURNS — the daemon that could not update is still a working daemon, and
// the link it runs through still points at a tree that was checked when IT was swapped in. The
// only path that ends the process is the one where the link already moved.
//
// THE CHECK IS `bun build --target=bun`, not `bun --check`: measured on Bun 1.3.9, `bun --check
// <file>` is not a flag at all — it RUNS the file (the daemon printed its usage line and exited
// 78). `bun build` parses the entry and resolves every import without executing anything, and a
// syntax error or a missing module is exit 1. Its output goes to a scratch directory that is
// deleted right after; the artefact is not the point, the exit code is.
async function selfUpdate(cfg: HelperConfig, j: ClaimedJob): Promise<void> {
  const sha = j.mainSha;
  const short = sha.slice(0, 8);
  const ref = j.branch ?? j.main;
  if (!ref || !/^[0-9a-f]{40}$/.test(sha)) {
    await report(cfg, j, 127, "the update claim named no ref or no 40-hex sha — this daemon cannot apply it");
    return;
  }
  // ALREADY THERE: the same sha this process runs from is not an update, and swapping onto it
  // would exit 75 into a restart that changes nothing — the shape of a loop, if a result POST is
  // ever lost and the claim re-offers. Reported as done, nothing moved.
  if (daemonSha === sha) {
    log(`update ${short}: this daemon already runs ${short} — nothing to do`);
    await report(cfg, j, 0, `already running ${sha} — no clone, no swap`, undefined, daemonSha);
    return;
  }
  const tree = `${cfg.workDir}/tree-${sha.slice(0, 12)}`;
  // THE LINK ALREADY POINTS AT THIS SHA'S TREE: an earlier claim of it swapped, and this process
  // never exited (it is the only way to be here with daemonSha !== sha). That tree is checked — the
  // link only ever moves onto one — and it is what systemd will start next, so it is NEVER removed
  // and re-cloned below. The swap is reported again and the exit that went missing is made now.
  if (pointsAt(cfg.checkoutLink, tree)) {
    log(`update ${short}: ${cfg.checkoutLink} already points at ${tree} — no clone, finishing the earlier swap`);
    await endAfterSwap(() => report(cfg, j, 0, `already swapped ${cfg.checkoutLink} → ${tree}`, undefined, sha),
      () => pruneTrees(cfg), short);
    return;
  }
  const logPath = `${cfg.workDir}/update-${sha.slice(0, 12)}.log`;
  const bundlePath = `${cfg.workDir}/update-${sha.slice(0, 12)}.bundle`;
  const checkOut = `${tree}.check`;
  // NO RESERVATION HERE ANY MORE: `start` holds the slot around the whole of `work`, and this
  // function is only ever reached from inside it. The pair that used to live here would now be a
  // second bookkeeper for one fact.
  try {
    log(`update ${short}: clone ${ref} → ${tree}`);
    const bundle = await downloadBundle(cfg, j);
    if (bundle === null) return;
    await Bun.write(bundlePath, bundle);
    // a half-cloned tree from an earlier attempt at this same sha must not be the thing we check
    try { rmSync(tree, { recursive: true, force: true }); } catch { /* not there */ }
    const cloned = await runCmd(`git clone -q -b ${sh(ref)} ${sh(bundlePath)} ${sh(tree)}`, cfg.workDir, logPath, 300_000);
    if (cloned.code !== 0) {
      log(`update ${short}: clone-failed (exit ${cloned.code}) — nothing was swapped`);
      await report(cfg, j, 127, `the clone failed (exit ${cloned.code})`, logPath);
      return;
    }
    const clonedSha = await clonedHeadOf(tree);
    if (clonedSha !== sha) {
      // the tree on disk is not the one the fleet says it handed over — that is a fact about the
      // bundle, not a tree to run a daemon from
      log(`update ${short}: clone-mismatch (${clonedSha ?? "no sha"}) — nothing was swapped`);
      await report(cfg, j, 127, `the clone is at ${clonedSha ?? "no readable sha"}, not the ${sha} handed over`, logPath, clonedSha);
      return;
    }
    log(`update ${short}: bun build --target=bun helper-daemon/daemon.ts (parse + resolve, no execution)`);
    try { rmSync(checkOut, { recursive: true, force: true }); } catch { /* not there */ }
    const checked = await runCmd(
      `${sh(process.execPath)} build --target=bun --outdir=${sh(checkOut)} helper-daemon/daemon.ts`, tree, logPath, 120_000);
    try { rmSync(checkOut, { recursive: true, force: true }); } catch { /* the exit code is what mattered */ }
    if (checked.code !== 0) {
      log(`update ${short}: check-failed (exit ${checked.code}) — the link was NOT moved, this daemon keeps running`);
      await report(cfg, j, 1, `check-failed: the new daemon.ts does not parse (exit ${checked.code}) — no swap`, logPath, clonedSha);
      return;
    }
    log(`update ${short}: symlink-swap ${cfg.checkoutLink} → ${tree}`);
    const swapped = swapLink(cfg.checkoutLink, tree);
    if (swapped !== null) {
      log(`update ${short}: swap-failed (${swapped}) — this daemon keeps running`);
      await report(cfg, j, 1, `the symlink swap failed: ${swapped}`, logPath, clonedSha);
      return;
    }
    await endAfterSwap(() => report(cfg, j, 0, `swapped ${cfg.checkoutLink} → ${tree}`, logPath, clonedSha), () => {
      pruneTrees(cfg);
      // the `finally` below never runs past an exit — the bundle goes here, on the one path that ends
      rmSync(bundlePath, { force: true });
    }, short);
  } finally {
    try { rmSync(bundlePath, { force: true }); } catch { /* idem */ }
  }
}
// ONCE THE LINK HAS MOVED, THIS PROCESS ENDS — whatever the report and the cleanup do. Before
// 2026-10-09 the exit sat behind `await report(…)`, and the result POST throws after five network
// failures (result-retry.ts): the daemon then kept running the OLD code with `current` already on
// the new tree, systemd never restarted it, and a second claim of the same sha removed the tree the
// link pointed at (D-4, docs/messungen/2026-10-09-codebase-review.md). A lost report is the board's
// problem, and the next daemon's heartbeat names the sha it runs; a daemon that never exits is not.
// `exit` is a parameter for (HD)'s pure check only.
export async function endAfterSwap(reportSwap: () => Promise<void>, cleanup: () => void, short: string,
  exit: (code: number) => void = process.exit): Promise<void> {
  try {
    await reportSwap();
  } catch (e) {
    log(`update ${short}: the swap report failed (${e instanceof Error ? e.message : String(e)}) — exiting anyway, the link already moved`);
  } finally {
    try { cleanup(); } catch { /* the tree is what mattered */ }
    log(`update ${short}: exit ${EXIT_UPDATED} — the unit restarts this daemon from the link`);
    exit(EXIT_UPDATED);
  }
}
// Whether `link` resolves to `dir`, compared as REAL paths: the link may be relative, and workDir
// may itself sit behind a symlink, so a string comparison of readlink's answer would call the
// running tree a stranger. Anything unreadable is "no" — absent link, absent dir.
export function pointsAt(link: string, dir: string): boolean {
  try { return realpathSync(link) === realpathSync(dir); } catch { return false; }
}
// ATOMIC on POSIX: the new link is created beside the old one and RENAMED over it, so at no
// instant is there no link, and no instant where it points at a tree that was not checked. A path
// that is a real directory rather than a symlink is refused, not replaced — that is somebody's
// checkout, and moving it aside is an owner act.
function swapLink(link: string, target: string): string | null {
  try {
    try { if (!lstatSync(link).isSymbolicLink()) return `${link} exists and is not a symlink`; }
    catch { /* absent — the first swap creates it */ }
    mkdirSync(dirname(link), { recursive: true });
    const fresh = `${link}.new`;
    try { rmSync(fresh, { force: true }); } catch { /* not there */ }
    symlinkSync(target, fresh);
    renameSync(fresh, link);
    return null;
  } catch (e) { return e instanceof Error ? e.message : String(e); }
}
// The trees are the rollback, so they are kept — but not forever: the link's target and the two
// newest others survive. Two, because one of them is the tree THIS process is still running from
// while the exit below is on its way.
export function pruneTrees(cfg: Pick<HelperConfig, "workDir" | "checkoutLink">): void {
  try {
    const trees = readdirSync(cfg.workDir).filter((d) => /^tree-[a-f0-9]{12}$/.test(d))
      .map((d) => `${cfg.workDir}/${d}`).filter((p) => !pointsAt(cfg.checkoutLink, p))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const p of trees.slice(2)) rmSync(p, { recursive: true, force: true });
  } catch { /* an unlistable workDir is reported by the next mkdir, not here */ }
}

// keep the last N FINISHED run directories: a daemon that never prunes fills the disk of a machine
// nobody logs into, which is the failure mode of every long-lived helper.
// A RUN STILL IN FLIGHT IS NEVER A CANDIDATE, and it does not count against `keepRuns` either. Above
// cap 1 a long run is routinely the OLDEST directory while shorter ones finish past it, and the old
// sort-and-slice removed it mid-run — its clone, and since the scratch moved here, the instance
// its suite was writing into. Not counting it keeps the promise to reds: the `keepRuns` newest
// finished runs survive however many are running beside them (on disk: keepRuns + the cap).
const activeRunDirs = new Set<string>();
export function pruneRuns(workDir: string, keepRuns: number, active: ReadonlySet<string>): void {
  try {
    // sorted by the MILLISECOND SUFFIX, not lexically: a run directory is `run-<jobid>-<ms>` and a
    // plain string sort orders by job id first, which would prune whichever job happens to sort low
    // rather than whichever run is oldest.
    const done = readdirSync(workDir).filter((d) => /^run-[a-f0-9]+-\d+$/.test(d))
      .filter((d) => !active.has(`${workDir}/${d}`))
      .sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));
    for (const d of done.slice(0, Math.max(0, done.length - keepRuns)))
      rmSync(`${workDir}/${d}`, { recursive: true, force: true });
  } catch { /* a workDir that cannot be listed is reported by the next mkdir, not here */ }
}

// --- the loop ----------------------------------------------------------------------------------
interface LoopState { offUntil: number; lastMode: string }

export async function tick(cfg: HelperConfig, st: LoopState): Promise<void> {
  const load1 = loadavg()[0] ?? 0;
  // THE `off` PATH RETURNS BEFORE `api()` IS EVER REACHED. Everything that could make this machine
  // unavailable is decided here, from local facts, precisely so that being off costs no request at
  // all — the property the whole mode design is for.
  if (Date.now() < st.offUntil) return;
  const local = localMode(cfg, new Date(), load1);
  if (local.mode === "off") {
    if (st.lastMode !== `off:${local.why}`) log(`off — ${local.why}; not polling`);
    st.lastMode = `off:${local.why}`;
    return;
  }
  const beat = await api(cfg, "/api/helper/device", {
    method: "POST",
    body: JSON.stringify({
      deviceId: cfg.deviceId, name: cfg.name, mode: local.mode,
      load: Math.round(load1 * 100) / 100, capabilities: cfg.capabilities,
      // THE TWO NUMBERS THE BOARD COULD NOT OTHERWISE KNOW. `load` is a reading of the machine and
      // says nothing about how many of the runs on it are the fleet's; these two say exactly that.
      // Sent from the TOP of the tick, before anything below is claimed, so `running` is always the
      // count the claim that follows was decided against and never a figure from mid-decision.
      running: runningJobs, maxParallelSuites: cfg.maxParallelSuites,
      ...(daemonSha ? { daemonSha } : {}),
      ...(cfg.instanceDir ? { instance: await instanceOf(cfg.instanceDir) } : {}),
      ...(cfg.repos === undefined ? {} : { repos: await reposOf(cfg.repos) }),
      features: DAEMON_FEATURES,
    }),
  });
  // A HEARTBEAT THE FLEET DID NOT TAKE IS NOT A WISH. A 4xx body carries no `desiredMode`, and the
  // fallback below used to read that absence as `active` — so a daemon whose beat the server
  // rejected (a field a newer or older server will not take) claimed jobs under an owner's `off` it
  // never got to read (D-10). No claim and no job list until a beat is answered 2xx; the line is
  // logged once per status, not once per poll.
  if (!beat.ok) {
    const why = (await bodyOf<{ error?: string }>(beat)).error ?? "";
    if (st.lastMode !== `beat:${beat.status}`)
      log(`heartbeat answered HTTP ${beat.status}${why ? ` (${why})` : ""} — no job poll, no claim until the fleet takes a beat`);
    st.lastMode = `beat:${beat.status}`;
    return;
  }
  const wish = (await bodyOf<{ desiredMode?: string }>(beat)).desiredMode;
  const desired: Mode = wish === "off" || wish === "quiet" || wish === "active" ? wish : "active";
  const mode = stricter(local.mode, desired);
  if (st.lastMode !== `${mode}:${local.why}:${desired}`)
    log(`mode ${mode} (local ${local.mode} — ${local.why}; owner wishes ${desired})`);
  st.lastMode = `${mode}:${local.why}:${desired}`;
  if (mode === "off") {
    st.offUntil = Date.now() + cfg.offRecheckSec * 1000;
    log(`owner wish is off — silent for ${cfg.offRecheckSec}s, no requests at all`);
    return;
  }
  // THE COUNT DECIDES WHAT MAY START, and a machine with no free slot and nothing running has nothing
  // to learn from the job list — asking anyway would be the request the mode design spends so much
  // care avoiding. `free` is what the machine may START, so a job already running here is subtracted
  // whatever the load average happens to say about it.
  // …BUT A MACHINE THAT IS RUNNING SOMETHING ASKS ANYWAY, full or quiet: the list is the only place
  // it can learn that the fleet took a job back (withdrawnRuns). Before 2026-09-13 a full machine
  // returned here without asking, which is exactly the state — both slots busy — in which a lane's
  // land left a preview running for 37 minutes nobody could read.
  // …and a running merge check holds its slots (mergeCheckHeld).
  const free = mode === "quiet" ? 0 : Math.max(0, freeSuiteSlots(cfg, runningJobs) - mergeCheckHeld(cfg));
  if (free <= 0 && inFlight.size === 0) return;
  const askedAt = Date.now();
  const listRes = await api(cfg, `/api/helper/jobs?deviceId=${cfg.deviceId}`);
  const list = await bodyOf<{ jobs?: JobView[] }>(listRes);
  if (listRes.ok && Array.isArray(list.jobs)) {
    for (const id of withdrawnRuns(inFlight, list.jobs, askedAt)) {
      const r = inFlight.get(id);
      if (!r || r.abort.signal.aborted) continue;
      log(`job ${id} is no longer this machine's on the fleet (withdrawn, reaped or lapsed) — aborting its run`);
      r.abort.abort();
    }
  }
  if (free <= 0) return;
  // Sliced to `free`, so a tick that arrives at an empty machine with three open jobs fills every
  // slot at once rather than one per poll — and one that arrives with one slot left takes one job.
  // A listed daemon-update overrides the slice: alone, and only on an empty machine (jobsToStart).
  const open = jobsToStart(list.jobs ?? [], free, runningJobs, new Set([...startingJobs, ...inFlight.keys()]));
  for (const j of open) start(cfg, j);
}

// ONE DOOR FOR A FAULT, and it is shared for a reason this slice created: a DETACHED job can now
// raise the same AuthFault a tick can, and that one must END this process wherever it is thrown.
// Logging it from a job instead would turn "a rejected credential costs exactly one request" into
// the retry storm the unit's RestartPreventExitStatus=78 exists to make impossible.
function onFault(e: unknown, what: string): void {
  if (e instanceof AuthFault) {
    // ONE request, then stop. Retrying a rejected credential is a storm that fills the fleet's
    // audit trail with helper_auth_fail rows and never succeeds.
    console.error(`helper-daemon: ${e.message} — stopping (fix the token in the config, then start the unit again)`);
    process.exit(EXIT_CONFIG);
  }
  // everything else is the ordinary weather of a machine that talks to another one over Tailscale:
  // the fleet is down, asleep, or the link dropped. Say so and poll again.
  log(`${what} failed: ${e instanceof Error ? e.message : String(e)}`);
}

async function main(): Promise<never> {
  const path = process.argv[2];
  if (!path) { console.error("usage: bun helper-daemon/daemon.ts <config.json>"); process.exit(EXIT_CONFIG); }
  let cfg: HelperConfig;
  try {
    cfg = loadConfig(path, await Bun.file(path).json(), statSync(path).mode);
  } catch (e) {
    console.error(`helper-daemon: bad config: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(EXIT_CONFIG);
  }
  secret = cfg.token;
  mkdirSync(cfg.workDir, { recursive: true });
  daemonSha = await clonedHeadOf(import.meta.dir);
  log(`helper-daemon up: ${cfg.name} (${cfg.deviceId}) → ${cfg.fleetUrl}, poll ${cfg.pollSec}s, work ${cfg.workDir}`
    + `, running ${daemonSha ? daemonSha.slice(0, 8) : "an unversioned copy (no git checkout around this file)"} from ${import.meta.dir}`);
  // dying by a signal, the daemon passes it on to its runs' groups first, then dies by it itself, so
  // the unit's restart policy reads the same ending as before the groups existed
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      for (const g of liveGroups) { try { process.kill(-g, sig); } catch { /* group gone */ } }
      process.removeAllListeners(sig);
      process.kill(process.pid, sig);
    });
  }
  const st: LoopState = { offUntil: 0, lastMode: "" };
  for (;;) {
    try {
      await tick(cfg, st);
    } catch (e) {
      onFault(e, "tick"); // the unit's RestartPreventExitStatus=78 makes an AuthFault's stop stick
    }
    await Bun.sleep(cfg.pollSec * 1000);
  }
}

if (import.meta.main) await main();

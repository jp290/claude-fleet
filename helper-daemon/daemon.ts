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
// nothing, and the portal's own design (a claim that expires falls back to the local drain) is what
// makes that safe — so silence is a complete and correct way to be unavailable. Once the owner's
// `off` has been read, it is honoured for `offRecheckSec` before a single heartbeat asks again.
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, rmSync, statSync } from "node:fs";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";

// --- config ------------------------------------------------------------------------------------
export interface HelperConfig {
  fleetUrl: string;
  token: string;
  deviceId: string;      // /^[a-z0-9]{8,32}$/ — the shape the portal's routes validate
  name: string;          // what the ledger row will say produced the verdict
  workDir: string;
  pollSec: number;
  offRecheckSec: number;
  quietHours: { from: string; to: string } | null;
  maxLoad1: number | null;
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
  return {
    fleetUrl, token: str(c.token, "token"), deviceId, name: str(c.name, "name"),
    workDir: str(c.workDir, "workDir"),
    // the floors are TYPO GUARDS (a 0 or a NaN would spin this loop), not policy — the same
    // reading server.ts gives its own HELPER_CLAIM_TIMEOUT_MS floor. The e2e drives 2 s polls.
    pollSec: Math.max(1, num(c.pollSec, "pollSec", 15)),
    offRecheckSec: Math.max(60, num(c.offRecheckSec, "offRecheckSec", 900)),
    quietHours: quiet,
    maxLoad1: c.maxLoad1 == null ? null : num(c.maxLoad1, "maxLoad1", 0),
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
interface JobView {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  claim: { name: string } | null; localRunning: boolean;
}
// The claim answer as it comes off the wire — unvalidated by us, so the two ref fields are typed
// the way the server actually serves them: a lane-suite claim carries `branch`, an audit claim
// carries `main`, and neither kind ever carries both (server.ts#helperClaim, #claimLaneSuite).
interface ClaimedJob {
  id: string; kind?: string; repo: string; main?: string; mainSha: string;
  branch?: string; treeSha?: string; untracked?: number;
}

// THE ONLY PLACE A REQUEST IS MADE, so that "the token is a header" and "every request is logged as
// method+path" are properties of the file rather than of each call site. A 401 is raised as an
// AuthFault by this function and by nothing else, which is what makes the single-request guarantee
// above checkable: there is one door, and it closes the process.
async function api(cfg: HelperConfig, path: string, init?: { method: string; body: string }): Promise<Response> {
  const headers: Record<string, string> = { "x-fleet-helper-token": cfg.token };
  if (init) headers["content-type"] = "application/json";
  log(`req ${init?.method ?? "GET"} ${path}`);
  const res = await fetch(new URL(path, cfg.fleetUrl).toString(), { ...init, headers });
  if (res.status === 401) throw new AuthFault(`the fleet refused this machine's helper token (401 on ${path})`);
  return res;
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
async function runCmd(cmd: string, cwd: string, logPath: string, timeoutMs: number)
  : Promise<{ code: number | null; timedOut: boolean }> {
  const fd = openSync(logPath, "a");
  try {
    const proc = Bun.spawn(["sh", "-c", cmd], {
      cwd, env: childEnv(), stdin: "ignore", stdout: fd, stderr: fd,
    });
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; proc.kill("SIGKILL"); }, timeoutMs);
    const code = await proc.exited;
    clearTimeout(t);
    return { code: timedOut ? null : code, timedOut };
  } finally { closeSync(fd); }
}

// THE ONE FACT ONLY THIS MACHINE CAN SUPPLY: the sha this daemon actually checked out. It needs
// its own spawn because runCmd sends stdout INTO the suite log by design, and this value has to be
// read rather than logged. The claim's `mainSha` is the server's reading of the bundle header it
// built — it says what was HANDED OVER, never what was RUN here, and the two are only the same
// commit if the clone did what it was told. Without this line a remote red over a repo somebody is
// editing in parallel cannot be adjudicated at all: "the helper measured a different tree" can be
// neither shown nor ruled out (2026-08-29, 748ec97 — docs/messungen/2026-08-29-adjudikation-second-host-401.md).
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
          const row = JSON.parse(line) as { ok?: unknown; check?: unknown };
          if (row.ok === false && typeof row.check === "string") names.push(row.check);
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
const readSlice = async (path: string, from: number, to: number): Promise<string> => {
  try { return await Bun.file(path).slice(from, to).text(); } catch { return ""; }
};

// THE LOCAL SUITE MUTEX. The loop below is sequential, so this flag can only be false when it is
// read — it exists so the invariant survives the day a second caller (a timer, a signal handler) is
// added, which is the shape every "it cannot happen today" comment in this repo eventually meets.
// The MACHINE-wide mutex is deliberately NOT duplicated here: ./e2e-isolated.sh takes
// /tmp/fleet-e2e.lock through e2e-stage.sh inside the clone, so a hand-started suite and this one
// already serialize against each other through the suite's own lock, and a second lock in front of
// it would only be able to disagree with it.
let suiteBusy = false;

async function work(cfg: HelperConfig, job: JobView): Promise<void> {
  if (suiteBusy) { log(`skip ${job.id}: a suite is already running here`); return; }
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
  const runDir = `${cfg.workDir}/run-${j.id}-${Date.now()}`;
  const clone = `${runDir}/tree`;
  const logPath = `${runDir}/suite.log`;
  mkdirSync(runDir, { recursive: true });
  log(`claimed ${j.kind ?? "audit"} ${j.repo} ${j.main}@${j.mainSha.slice(0, 8)} → ${runDir}`);

  suiteBusy = true;
  try {
    const bundlePath = `${runDir}/job.bundle`;
    const bundleRes = await api(cfg, `/api/helper/bundle/${j.id}`);
    if (!bundleRes.ok) { await report(cfg, j, 127, `the bundle download answered HTTP ${bundleRes.status}`); return; }
    await Bun.write(bundlePath, await bundleRes.arrayBuffer());

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
    const cloned = await runCmd(cloneCmd, runDir, logPath, 300_000);
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

    const installed = await runCmd(cfg.installCmd, clone, logPath, 900_000);
    // A TREE THAT COULD NOT BE PREPARED MEASURED NOTHING, and `unknown` is the only honest verdict
    // for it. Exit 127 is the code the server's shared classifier reads as "could not be started"
    // (server.ts#remoteVerdictOf) — reporting 1 here would put a RED on the ledger for a suite that
    // never ran, which is the one lie this rail must not tell.
    if (installed.code !== 0) { await report(cfg, j, 127, `${cfg.installCmd} failed (exit ${installed.code})`, logPath, clonedSha); return; }

    const started = Date.now();
    const ran = await runCmd(cfg.suiteCmd, clone, logPath, cfg.suiteTimeoutSec * 1000);
    log(`suite finished exit=${ran.code} timedOut=${ran.timedOut} in ${Math.round((Date.now() - started) / 1000)}s`);
    // A TIMEOUT REPORTS NO EXIT CODE AT ALL. The server reads a missing code as `unknown` with a
    // reason, which is what a killed run is — never a red, and never a silent green.
    await report(cfg, j, ran.timedOut ? null : ran.code,
      ran.timedOut ? `the suite passed ${cfg.suiteTimeoutSec}s and was killed here` : "", logPath, clonedSha);
  } finally {
    suiteBusy = false;
    try { rmSync(clone, { recursive: true, force: true }); } catch { /* the verdict is already sent */ }
    try { rmSync(`${runDir}/job.bundle`, { force: true }); } catch { /* idem */ }
    pruneRuns(cfg);
  }
}

async function report(cfg: HelperConfig, j: ClaimedJob, exitCode: number | null, note: string,
  logPath?: string, clonedSha?: string): Promise<void> {
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
    body: JSON.stringify({ jobId: j.id, exitCode, tail, fails, ...(trail ? { trail } : {}),
      ...(clonedSha ? { clonedSha } : {}) }),
  });
  const body = await bodyOf<{ result?: string }>(res);
  log(`reported ${j.id} exit=${exitCode} → ${res.status} ${body.result ?? body.error ?? ""}`);
}

// keep the last N run directories: a daemon that never prunes fills the disk of a machine nobody
// logs into, which is the failure mode of every long-lived helper.
function pruneRuns(cfg: HelperConfig): void {
  try {
    // sorted by the MILLISECOND SUFFIX, not lexically: a run directory is `run-<jobid>-<ms>` and a
    // plain string sort orders by job id first, which would prune whichever job happens to sort low
    // rather than whichever run is oldest.
    const runs = readdirSync(cfg.workDir).filter((d) => /^run-[a-f0-9]+-\d+$/.test(d))
      .sort((a, b) => Number(a.split("-").pop()) - Number(b.split("-").pop()));
    for (const d of runs.slice(0, Math.max(0, runs.length - cfg.keepRuns)))
      rmSync(`${cfg.workDir}/${d}`, { recursive: true, force: true });
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
    }),
  });
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
  if (mode === "quiet") return; // reachable, taking no work
  const list = await bodyOf<{ jobs?: JobView[] }>(await api(cfg, `/api/helper/jobs?deviceId=${cfg.deviceId}`));
  const open = (list.jobs ?? []).find((j) => !j.claim && !j.localRunning);
  if (open) await work(cfg, open);
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
  log(`helper-daemon up: ${cfg.name} (${cfg.deviceId}) → ${cfg.fleetUrl}, poll ${cfg.pollSec}s, work ${cfg.workDir}`);
  const st: LoopState = { offUntil: 0, lastMode: "" };
  for (;;) {
    try {
      await tick(cfg, st);
    } catch (e) {
      if (e instanceof AuthFault) {
        // ONE request, then stop. Retrying a rejected credential is a storm that fills the fleet's
        // audit trail with helper_auth_fail rows and never succeeds; the unit's
        // RestartPreventExitStatus=78 makes the stop stick.
        console.error(`helper-daemon: ${e.message} — stopping (fix the token in the config, then start the unit again)`);
        process.exit(EXIT_CONFIG);
      }
      // everything else is the ordinary weather of a machine that talks to another one over
      // Tailscale: the fleet is down, asleep, or the link dropped. Say so and poll again.
      log(`tick failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    await Bun.sleep(cfg.pollSec * 1000);
  }
}

if (import.meta.main) await main();

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
//
// SELF-UPDATE (`daemon-update`, 2026-09-02). The owner queues one update per device on the board;
// this daemon claims it like any job, clones the fleet's main out of the bundle into
// `<workDir>/tree-<sha>`, PARSES the new daemon there, and only then moves the `checkoutLink`
// symlink onto the new tree and exits 75 (EX_TEMPFAIL) — the unit template pairs that code with
// `RestartForceExitStatus=75`, so systemd starts the next daemon from the link. The old tree is
// left in place: pointing the link back at it by hand is the whole rollback. A tree that fails the
// parse never becomes the link's target — check first, swap second, and the daemon keeps running.
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, readlinkSync, renameSync, rmSync,
  statSync, symlinkSync } from "node:fs";
import { loadavg } from "node:os";
import { dirname, join } from "node:path";

// --- config ------------------------------------------------------------------------------------
export interface HelperConfig {
  fleetUrl: string;
  token: string;
  deviceId: string;      // /^[a-z0-9]{8,32}$/ — the shape the portal's routes validate
  name: string;          // what the ledger row will say produced the verdict
  workDir: string;
  checkoutLink: string;  // the symlink the unit's ExecStart runs through; a daemon-update moves it
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
  return {
    fleetUrl, token: str(c.token, "token"), deviceId, name: str(c.name, "name"),
    workDir,
    checkoutLink: typeof c.checkoutLink === "string" && c.checkoutLink ? c.checkoutLink : `${workDir}/current`,
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
  // THE COMMAND KIND's three fields. `argv` is what this process execs — the fleet split the
  // allowlisted command line at its own perimeter, so there is no parser and no shell here. `cmd` is
  // carried beside it for the log line only. A `command` claim that arrives WITHOUT `argv` is
  // unrunnable and is reported as such (127 → unknown), never approximated from `cmd`.
  cmd?: string; argv?: string[]; timeoutMs?: number; artifacts?: string[];
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
  return await runArgv(["sh", "-c", cmd], cwd, logPath, timeoutMs);
}
// THE SAME RUNNER WITHOUT A SHELL, and it is the whole of "no shell interpolation" on this machine.
// `runCmd` above keeps `sh -c` because its command comes out of THIS machine's own config file
// (`installCmd`, `suiteCmd`) — a string an owner wrote here, where a shell is the point. A command
// JOB's line came over the wire, so it arrives pre-split as argv and is exec'd directly: no quoting,
// no glob, no `&&`, no substitution, and nothing for a crafted string to escape out of.
async function runArgv(argv: string[], cwd: string, logPath: string, timeoutMs: number)
  : Promise<{ code: number | null; timedOut: boolean }> {
  const fd = openSync(logPath, "a");
  try {
    const proc = Bun.spawn(argv, {
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
// THE SAME MEASUREMENT TURNED ON THIS PROCESS: the commit the tree this daemon is RUNNING FROM is
// at, read once at boot with the rev-parse above and sent on every heartbeat as `daemonSha`. It is
// what makes "did the update take?" answerable from the board rather than from a journal on the
// other machine — and, like `clonedSha`, it is measured or absent: a daemon started from a plain
// copy outside any git checkout sends no field rather than a guess.
let daemonSha: string | undefined;

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
      // `..` cannot come out of a scan rooted at the clone, but the row is a claim about a path and
      // is checked as one here too — the server refuses the same shape, and the two agreeing is the
      // point (a receipt this daemon would not have written is a receipt the fleet will not store).
      if (seen.has(rel) || rel.startsWith("/") || rel.split("/").includes("..")) continue;
      seen.add(rel);
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
  // THE ONE KIND THAT IS ABOUT THIS PROCESS rather than about a tree to measure. It parts here,
  // before a run directory exists: an update leaves a TREE behind on purpose (it is the thing the
  // link will point at), and the run-dir belt below is built to throw its clone away.
  if (j.kind === "daemon-update") { await selfUpdate(cfg, j); return; }
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
      ? await runArgv(j.argv!, clone, logPath, timeoutMs)
      : await runCmd(cfg.suiteCmd, clone, logPath, timeoutMs);
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
    await report(cfg, j, ran.timedOut ? null : ran.code,
      ran.timedOut ? `the ${isCommand ? "command" : "suite"} passed ${Math.round(timeoutMs / 1000)}s and was killed here` : "",
      logPath, clonedSha, artifacts);
  } finally {
    suiteBusy = false;
    try { rmSync(clone, { recursive: true, force: true }); } catch { /* the verdict is already sent */ }
    try { rmSync(`${runDir}/job.bundle`, { force: true }); } catch { /* idem */ }
    pruneRuns(cfg);
  }
}

async function report(cfg: HelperConfig, j: ClaimedJob, exitCode: number | null, note: string,
  logPath?: string, clonedSha?: string, artifacts: ArtifactRow[] = []): Promise<void> {
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
    body: JSON.stringify({ jobId: j.id, exitCode, tail, fails, ...(trail ? { trail } : {}),
      ...(clonedSha ? { clonedSha } : {}), ...(artifacts.length ? { artifacts } : {}) }),
  });
  const body = await bodyOf<{ result?: string }>(res);
  log(`reported ${j.id} exit=${exitCode} artifacts=${artifacts.length} → ${res.status} ${body.result ?? body.error ?? ""}`);
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
  const logPath = `${cfg.workDir}/update-${sha.slice(0, 12)}.log`;
  const bundlePath = `${cfg.workDir}/update-${sha.slice(0, 12)}.bundle`;
  const checkOut = `${tree}.check`;
  suiteBusy = true;
  try {
    log(`update ${short}: clone ${ref} → ${tree}`);
    const bundleRes = await api(cfg, `/api/helper/bundle/${j.id}`);
    if (!bundleRes.ok) { await report(cfg, j, 127, `the bundle download answered HTTP ${bundleRes.status}`); return; }
    await Bun.write(bundlePath, await bundleRes.arrayBuffer());
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
    await report(cfg, j, 0, `swapped ${cfg.checkoutLink} → ${tree}`, logPath, clonedSha);
    pruneTrees(cfg);
    // the `finally` below never runs past an exit — the bundle goes here, on the one path that ends
    try { rmSync(bundlePath, { force: true }); } catch { /* the tree is what mattered */ }
    log(`update ${short}: exit ${EXIT_UPDATED} — the unit restarts this daemon from ${cfg.checkoutLink}`);
    process.exit(EXIT_UPDATED);
  } finally {
    suiteBusy = false;
    try { rmSync(bundlePath, { force: true }); } catch { /* idem */ }
  }
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
function pruneTrees(cfg: HelperConfig): void {
  try {
    let current = "";
    try { current = readlinkSync(cfg.checkoutLink); } catch { /* no link yet */ }
    const trees = readdirSync(cfg.workDir).filter((d) => /^tree-[a-f0-9]{12}$/.test(d))
      .map((d) => `${cfg.workDir}/${d}`).filter((p) => p !== current)
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    for (const p of trees.slice(2)) rmSync(p, { recursive: true, force: true });
  } catch { /* an unlistable workDir is reported by the next mkdir, not here */ }
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
      ...(daemonSha ? { daemonSha } : {}),
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
  daemonSha = await clonedHeadOf(import.meta.dir);
  log(`helper-daemon up: ${cfg.name} (${cfg.deviceId}) → ${cfg.fleetUrl}, poll ${cfg.pollSec}s, work ${cfg.workDir}`
    + `, running ${daemonSha ? daemonSha.slice(0, 8) : "an unversioned copy (no git checkout around this file)"} from ${import.meta.dir}`);
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

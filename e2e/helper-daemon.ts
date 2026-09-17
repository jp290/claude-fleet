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
import { chmodSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync,
  statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { BASE, ROOT, check, get, post } from "./harness";
import { driveMerge, openLane, seedRepo, type Lane } from "./lane-helpers";
import { run as checkResultRetry } from "./helper-result";
// The import is not only for the four pure checks below: it is the edge that makes e2e-stage.sh
// STAGE helper-daemon/ into the throwaway instance. The copy list is derived from the entry files'
// transitive relative imports, so a daemon reached by an import rides along with no wrapper edit
// and no hand-kept list — the failure mode that killed two harnesses in this repo.
import { failNamesOf, freeSuiteSlots, inQuietHours, jobsToStart, loadConfig, localMode, pruneRuns, shardEnv, stricter, tailOf,
  trailIdOf, withdrawnRuns, DAEMON_FEATURES, EXIT_CONFIG, EXIT_UPDATED, type HelperConfig, type JobView } from "../helper-daemon/daemon";

interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; fails?: string[];
  checks?: CheckCount | null;
  covers: { branch: string; mainAfter: string }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string; clonedSha?: string };
  // the ping rail the audit route JOINS onto the row it serves — (HD.11) reads it
  ping?: { status?: string; lastResult?: string; slot?: number };
}
interface CheckCount { ran: number; failed: number; ranIsLowerBound?: true }
interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface LiveView { postLandAuditLive: { running: { repo: string | null; phase: string } | null } | null }
// the OWNER's projection of a device (server.ts#helperDevicesView), the two fields the update rail
// adds: what the daemon says it RUNS, and the standing update wish with its outcome
interface OwnerDevice {
  id: string; daemonSha?: string;
  update: { id: string; state: string; main: string; mainSha?: string;
    result?: { ok: boolean; exitCode: number | null; mainSha: string; note: string } } | null;
  // …and the two (HD.10) reads: which jobs that device is holding right now, and its own count of
  // its own slots. Optional, because a device that never reported the pair is the ordinary case.
  claims?: { kind: string; repo: string; ref: string; expiresAt: number }[];
  running?: number; maxParallelSuites?: number;
}

const DEVICE = "daemonbox0001";           // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "linux work-horse (e2e)";
const TRAIL = "isolated-20260828T2200Z-7777";
const REMOTE_PRE_TRAIL_CHECKS = 3476;
const REMOTE_TOTAL_CHECKS = REMOTE_PRE_TRAIL_CHECKS + 9;

export async function run(h: {
  REPO: string;
  setAuditMode: (m: string) => Promise<number>;
  killSrv: () => Promise<void>;
  startSrv: (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }) => Promise<boolean>;
  auditRows: () => Promise<Row[]>;
  headOf: (ref?: string) => string;
}): Promise<void> {
  const { REPO, setAuditMode, killSrv, startSrv, auditRows, headOf } = h;
  await checkResultRetry(check);

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
  // THE COUNT, AND THAT IT IS A COUNT. `localMode` above turns the load average into a mode, and
  // that reading is LAGGING: on the work-horse one ./e2e-isolated.sh sits at load1 0.21 mean, so a
  // job started twenty seconds ago has barely moved it — which is how three audits ran at once
  // under maxLoad1 2 on 2026-09-06. `freeSuiteSlots` cannot be fooled that way, and the second half
  // of each line below is the part that matters: the SAME cfg with NO load cap at all, asked at a
  // load of 99, still answers zero free slots when the slots are taken. The two conditions are
  // independent, and the counting one is the one that decides how many jobs run here.
  const cap = (n: number): HelperConfig =>
    ({ enabled: true, quietHours: null, maxLoad1: null, maxParallelSuites: n } as unknown as HelperConfig);
  check("(HD) DEFAULT 1: one job at a time — a second is refused while the first runs, whatever the load average says",
    freeSuiteSlots(cap(1), 0) === 1 && freeSuiteSlots(cap(1), 1) === 0
      && localMode(cap(1), at("12:00"), 99).mode === "active",
    `free@0=${freeSuiteSlots(cap(1), 0)} free@1=${freeSuiteSlots(cap(1), 1)}`
    + ` modeAtLoad99=${localMode(cap(1), at("12:00"), 99).mode}`);
  check("(HD) AT 2: two jobs run and the THIRD waits — the cap counts jobs, it does not measure the machine",
    freeSuiteSlots(cap(2), 0) === 2 && freeSuiteSlots(cap(2), 1) === 1 && freeSuiteSlots(cap(2), 2) === 0
      && freeSuiteSlots(cap(2), 3) === 0,
    `free@0..3=${[0, 1, 2, 3].map((n) => freeSuiteSlots(cap(2), n)).join(",")}`);
  // THE WITHDRAWAL READING (7e601e57). A run ends when a job list asked for AFTER its claim no
  // longer carries it under THAT claim — and on nothing weaker. The four negatives are the half that
  // keeps a healthy run alive: a job still held by me, an unreadable claim time on either side, and
  // a list that was already on its way before my claim came back.
  const jv = (id: string, claim: { name: string; claimedAt?: number } | null): JobView =>
    ({ id, repo: "r", main: "main", branches: [], covers: 0, claim, localRunning: false });
  const mine = new Map([
    ["aaaaaaaaaaaa", { claimedAt: 100, since: 1000 }],   // still mine
    ["bbbbbbbbbbbb", { claimedAt: 100, since: 1000 }],   // gone from the list (reaped)
    ["cccccccccccc", { claimedAt: 100, since: 1000 }],   // listed again OPEN (lapsed, re-offered)
    ["dddddddddddd", { claimedAt: 100, since: 1000 }],   // listed under ANOTHER claim
    ["eeeeeeeeeeee", { claimedAt: 100, since: 5000 }],   // claimed after this list was asked for
    ["ffffffffffff", { claimedAt: undefined, since: 1000 }], // claim time never came back
  ]);
  const listNow = [jv("aaaaaaaaaaaa", { name: "me", claimedAt: 100 }), jv("cccccccccccc", null),
    jv("dddddddddddd", { name: "other", claimedAt: 200 }), jv("ffffffffffff", { name: "me", claimedAt: 300 })];
  const gone = withdrawnRuns(mine, listNow, 2000).sort();
  check("(HD) withdrawnRuns aborts exactly the runs the fleet took back — reaped, re-offered, re-claimed — and never one it still holds for me",
    JSON.stringify(gone) === JSON.stringify(["bbbbbbbbbbbb", "cccccccccccc", "dddddddddddd"]),
    JSON.stringify(gone));
  // THE UPDATE STARTS ALONE (2026-09-14 09:24, secondhostlinux1): one poll claimed an audit AND the
  // daemon-update, the update exited 75, and the audit's claim sat on the fleet ~45 min with no run
  // behind it. MUTATION: drop the update branch in daemon.ts#jobsToStart ⇒ the idle list starts both
  // ⇒ red; drop `running === 0` ⇒ the busy machine starts the update beside its run ⇒ red; drop the
  // claimed-and-idle fall-through ⇒ a dead predecessor's update claim parks the machine ⇒ red.
  const kindJob = (id: string, kind: string, claim: { name: string; claimedAt?: number } | null = null): JobView =>
    ({ ...jv(id, claim), kind });
  const ids = (js: JobView[]): string => js.map((j) => j.id).join(",");
  const audit = kindJob("a00000000001", "audit"), preview = kindJob("b00000000002", "lane-suite");
  const update = kindJob("u00000000009", "daemon-update");
  const idleWithUpdate = jobsToStart([audit, update, preview], 2, 0);
  const busyWithUpdate = jobsToStart([audit, update], 1, 1);
  const busyUpdateMine = jobsToStart([audit, kindJob("u00000000009", "daemon-update", { name: "me", claimedAt: 1 })], 1, 1);
  const idleStaleUpdate = jobsToStart([audit, kindJob("u00000000009", "daemon-update", { name: "me", claimedAt: 1 })], 2, 0);
  const noUpdate = jobsToStart([audit, preview, kindJob("c00000000003", "audit")], 2, 0);
  check("(HD) a listed daemon-update starts ALONE and only on an empty machine — nothing is claimed beside it, before it, or while it runs",
    ids(idleWithUpdate) === "u00000000009" && ids(busyWithUpdate) === "" && ids(busyUpdateMine) === ""
      && ids(idleStaleUpdate) === "a00000000001" && ids(noUpdate) === "a00000000001,b00000000002",
    `idle=[${ids(idleWithUpdate)}] busy=[${ids(busyWithUpdate)}] inFlight=[${ids(busyUpdateMine)}]`
    + ` staleClaim=[${ids(idleStaleUpdate)}] noUpdate=[${ids(noUpdate)}]`);
  // THE PRUNE AND THE RUN IN FLIGHT (C1, 2026-09-13). The oldest dir is a run still going — above cap
  // 1 the normal shape of a long suite beside short ones — and each finished run keeps a red
  // instance in its `tmp/`. keepRuns 2 must leave the running one AND the two newest finished.
  // MUTATION: drop the `active` filter in daemon.ts#pruneRuns ⇒ run-…-1 is removed ⇒ red; count the
  // active one against keepRuns instead ⇒ run-…-4's kept instance is removed ⇒ red.
  const pruneFix = `${ROOT}/daemon-prune-fixture`;
  rmSync(pruneFix, { recursive: true, force: true });
  const pruneDirs = ["run-aaaaaaaaaaaa-1", "run-bbbbbbbbbbbb-2", "run-cccccccccccc-3", "run-dddddddddddd-4", "run-eeeeeeeeeeee-5"];
  for (const d of pruneDirs) {
    mkdirSync(`${pruneFix}/${d}/tmp/fleet-e2e-instance-4242`, { recursive: true });
    writeFileSync(`${pruneFix}/${d}/tmp/fleet-e2e-instance-4242/server.log`, "red evidence\n");
  }
  mkdirSync(`${pruneFix}/tree-0123456789ab`, { recursive: true });
  pruneRuns(pruneFix, 2, new Set([`${pruneFix}/run-aaaaaaaaaaaa-1`]));
  const pruneLeft = readdirSync(pruneFix).sort();
  const keptRed = ["run-dddddddddddd-4", "run-eeeeeeeeeeee-5"]
    .every((d) => existsSync(`${pruneFix}/${d}/tmp/fleet-e2e-instance-4242/server.log`));
  check("(HD) pruneRuns never removes a run in flight, and keeps the keepRuns newest FINISHED runs with their kept red instance",
    JSON.stringify(pruneLeft) === JSON.stringify(["run-aaaaaaaaaaaa-1", "run-dddddddddddd-4", "run-eeeeeeeeeeee-5", "tree-0123456789ab"])
      && keptRed,
    `left=${JSON.stringify(pruneLeft)} keptRed=${keptRed}`);
  rmSync(pruneFix, { recursive: true, force: true });
  // …and the config door: a value this rail has no reading for must not reach the arithmetic above.
  // A 0 would make a machine claim nothing forever and silently, which is the failure mode every
  // other floor in loadConfig exists to refuse.
  const cfgWith = (v: unknown): number => loadConfig("/x", {
    fleetUrl: "http://h", token: "t", deviceId: "abcdefgh", name: "n", workDir: "/w",
    ...(v === undefined ? {} : { maxParallelSuites: v }),
  }, 0o600).maxParallelSuites;
  check("(HD) the cap defaults to 1, floors at 1 and takes whole slots — 0, a negative and a fraction cannot describe this machine",
    cfgWith(undefined) === 1 && cfgWith(0) === 1 && cfgWith(-3) === 1 && cfgWith(2.9) === 2 && cfgWith(2) === 2,
    `default=${cfgWith(undefined)} zero=${cfgWith(0)} neg=${cfgWith(-3)} frac=${cfgWith(2.9)}`);

  // THE SHARD FORK (the sharded audit). The suite env a shard job gets is exactly FLEET_E2E_SHARD=k/n,
  // an unsharded job gets nothing, and a shard string the runner would refuse is refused HERE — as null,
  // which `work` reports as unrunnable instead of running the whole suite under one shard's name.
  // MUTATION: make the malformed arm return `{}` ⇒ "0/3", "4/3" and "x" read as an unsharded job ⇒ red.
  check("(HD) a shard job's suite gets FLEET_E2E_SHARD=k/n, an unsharded one nothing, and a malformed shard is refused — never run whole",
    JSON.stringify(shardEnv(undefined)) === "{}" && JSON.stringify(shardEnv("2/3")) === '{"FLEET_E2E_SHARD":"2/3"}'
      && JSON.stringify(shardEnv("1/1")) === '{"FLEET_E2E_SHARD":"1/1"}'
      && shardEnv("0/3") === null && shardEnv("4/3") === null && shardEnv("x") === null && shardEnv("") === null
      && shardEnv("2/3; rm -rf /") === null,
    `2/3=${JSON.stringify(shardEnv("2/3"))} 0/3=${JSON.stringify(shardEnv("0/3"))} x=${JSON.stringify(shardEnv("x"))}`);
  check("(HD) the daemon declares audit-shard — the word the fleet offers shard jobs on",
    DAEMON_FEATURES.includes("audit-shard"), JSON.stringify(DAEMON_FEATURES));

  check("(HD) the tail and the trail id are taken exactly the way the portal asks a human to take them",
    tailOf("a\nb\nc\nd", 2) === "c\nd" && trailIdOf(`noise ${TRAIL} more`) === TRAIL
      && trailIdOf("no trail here") === undefined,
    `${JSON.stringify(tailOf("a\nb\nc\nd", 2))} ${trailIdOf(`x ${TRAIL}`)}`);

  const failFixture = `${ROOT}/daemon-fail-fixture`;
  const failLog = `${failFixture}/suite.log`;
  rmSync(failFixture, { recursive: true, force: true });
  mkdirSync(`${failFixture}/tree/e2e-trail`, { recursive: true });
  await Bun.write(failLog, "FAIL  log decoy\n2 FAILURES\n");
  await Bun.write(`${failFixture}/tree/e2e-trail/${TRAIL}.jsonl`, [
    JSON.stringify({ ok: true, check: "passing decoy" }),
    JSON.stringify({ ok: false, check: "trail failure alpha" }),
    JSON.stringify({ ok: false, check: "trail failure beta" }),
  ].join("\n") + "\n");
  const trailFails = await failNamesOf(failLog, TRAIL);
  check("(HD) a synthetic run with log+trail reports the exact ok:false check names from the trail",
    JSON.stringify(trailFails) === '["trail failure alpha","trail failure beta"]',
    JSON.stringify(trailFails));
  await Bun.write(failLog, "FAIL  fallback failure alpha  (detail)\nPASS  decoy\nFAIL  fallback failure beta\n2 FAILURES\n");
  const fallbackFails = await failNamesOf(failLog, undefined);
  check("(HD) a synthetic run WITHOUT a trail falls back to the log's ^FAIL lines",
    JSON.stringify(fallbackFails) === '["fallback failure alpha","fallback failure beta"]',
    JSON.stringify(fallbackFails));
  rmSync(failFixture, { recursive: true, force: true });

  // ===== (HD.2) THE SCRATCH FLEET, THE COUNTING PROXY, AND THE STAND-IN SUITE ====================
  // e2e/helper-portal.ts leaves the server on a seconds-long claim timeout — right for a lapse
  // check, fatal for a daemon that clones, installs and runs before it reports. Restarted here.
  const DAEMON = resolve(import.meta.dir, "../helper-daemon/daemon.ts");
  // THE SOURCE OF THE SELF-UPDATE in (HD.8): a repository whose `helper-daemon/daemon.ts` is THIS
  // daemon, byte for byte, so that the tree the daemon clones, checks and restarts from is the real
  // program at a real commit — its heartbeat after the restart is then a `git rev-parse` of a tree
  // this suite can name. The server is pointed at it through FLEET_HELPER_UPDATE_REPO (the staged
  // instance runs from no checkout of its own, so the default source would be a 503).
  const UPD = `${ROOT}/daemonupdaterepo`;
  rmSync(UPD, { recursive: true, force: true });
  mkdirSync(`${UPD}/helper-daemon`, { recursive: true });
  // THE WHOLE STAGED DIRECTORY, not `daemon.ts` alone — derived, like everything else this suite
  // clones. The single-file copy this replaced was a hand-written list of one, and it broke the
  // moment daemon.ts grew a sibling: `8fbd46a9` (2026-09-15) added `helper-daemon/result-retry.ts`
  // and the import of it, so the clone could no longer RESOLVE, `bun build --target=bun` exited 1,
  // and (HD.8) read that as "a tree that does not parse". The daemon then never swapped its symlink
  // and stayed dead for the rest of the module — one root, TWENTY red lines, through (HD.9b) and all
  // of (HD.10). No gate runs this suite (docs/verify-tiering.md §6.1), so it sat red from 09-15 until
  // the next run of it, 2026-09-17. What is copied here is exactly what e2e-stage.sh derived into
  // this instance, which is the same rule the check below asserts.
  cpSync(dirname(DAEMON), `${UPD}/helper-daemon`, { recursive: true });
  for (const args of [["init", "-q", "-b", "main"], ["add", "-A"],
    ["-c", "user.name=e2e", "-c", "user.email=e2e@example.invalid", "commit", "-qm", "the daemon, as shipped"]])
    spawnSync("git", ["-C", UPD, ...args]);
  // A VINTAGE OF ITS OWN, for the guard in (HD.9b). The server refuses a command-job claim whose
  // device names a `daemonSha` that does not have the command-kind commit as an ancestor, measured
  // in FLEET_HELPER_UPDATE_REPO. The real floor (`1748417`) is a commit of the SOURCE repo, which
  // this fixture has never heard of — so the fixture gets two commits and the server is pointed at
  // the second: everything below the floor is then a sha this suite can name, and so is everything
  // at or above it. The daemon's own updates in (HD.8) land on top, which is why they keep passing.
  const shaOfUpd = (): string => spawnSync("git", ["-C", UPD, "rev-parse", "HEAD"]).stdout.toString().trim();
  const PRE_FLOOR = shaOfUpd();
  await Bun.write(`${UPD}/helper-daemon/COMMAND-KIND`, "the generation that branches on job kind\n");
  for (const args of [["add", "-A"],
    ["-c", "user.name=e2e", "-c", "user.email=e2e@example.invalid", "commit", "-qm", "the command kind"]])
    spawnSync("git", ["-C", UPD, ...args]);
  const CMD_FLOOR = shaOfUpd();
  await killSrv();
  check("(HD) setup: the server restarts with a claim timeout a real run fits inside, and a daemon-vintage floor this fixture can name",
    await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000",
      FLEET_HELPER_UPDATE_REPO: UPD, FLEET_HELPER_CMD_FLOOR_SHA: CMD_FLOOR } })
      && /^[0-9a-f]{40}$/.test(PRE_FLOOR) && /^[0-9a-f]{40}$/.test(CMD_FLOOR) && PRE_FLOOR !== CMD_FLOOR,
    `preFloor=${PRE_FLOOR.slice(0, 8)} floor=${CMD_FLOOR.slice(0, 8)}`);
  await Bun.sleep(750);

  check("(HD) setup: e2e-stage.sh staged helper-daemon/ into this instance (derived, not hand-listed)",
    existsSync(DAEMON), DAEMON);

  const helperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
  const hpost = (path: string, body: unknown): Promise<Response> =>
    post(path, body, { ...HH, "content-type": "application/json" });
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
  const reportedBodies: Record<string, unknown>[] = [];
  const proxy = Bun.serve({
    port: 0, hostname: "127.0.0.1",
    fetch: async (req: Request): Promise<Response> => {
      const u = new URL(req.url);
      seen.push(`${req.method} ${u.pathname}${u.search}`);
      const headers = new Headers(req.headers);
      headers.delete("host");
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
      if (u.pathname === "/api/helper/result" && body) {
        try { reportedBodies.push(JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>); }
        catch { /* the server remains the authority on malformed JSON */ }
      }
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
  // It prints its cwd, the files around it and the FLEET_* it inherited, then places two failures
  // before enough filler to push both FAIL lines out of the daemon's 40-line tail. The matching
  // trail remains beside the clone, so the report can still carry their exact names.
  const SUITE = `${ROOT}/fakedaemonsuite`;
  await Bun.write(SUITE, [
    "#!/bin/sh",
    `echo "run pwd=$(pwd) files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] token=[\${FLEET_TOKEN:-}] tmp=[\${TMPDIR:-}]"`,
    `echo "${TRAIL} stand-in trail marker"`,
    // the wrapper's own instance line, verbatim in shape — a red keeps it, which is what C1 is about
    'mkdir -p "${TMPDIR:-/tmp}/fleet-e2e-instance-$$" && echo "kept red" > "${TMPDIR:-/tmp}/fleet-e2e-instance-$$/server.log"',
    'mkdir -p "$PWD/e2e-trail"',
    `printf '%s\\n' '${JSON.stringify({ ok: false, check: "remote trail failure alpha" })}' '${JSON.stringify({ ok: false, check: "remote trail failure beta" })}' > "$PWD/e2e-trail/${TRAIL}.jsonl"`,
    'echo "FAIL  remote trail failure alpha"',
    'echo "FAIL  remote trail failure beta"',
    'i=0; while [ "$i" -lt 60 ]; do echo "trailing filler $i"; i=$((i + 1)); done',
    `echo "run pwd=$(pwd) files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] token=[\${FLEET_TOKEN:-}] tmp=[\${TMPDIR:-}]"`,
    `echo "PASS  trail: the run wrote a durable per-check trail  (file=$PWD/e2e-trail/${TRAIL}.jsonl rows=${REMOTE_PRE_TRAIL_CHECKS})"`,
    `echo "PASS  trail: one row per check() call — trail rows match the suite's result count  (rows=${REMOTE_PRE_TRAIL_CHECKS} results=${REMOTE_PRE_TRAIL_CHECKS})"`,
    'echo "PASS  trail: the trail is outside the instance dir"',
    'echo "PASS  trail: a node_modules symlink whose target is not a work tree never falls back to the staged wrapper"',
    'echo "PASS  trail: sentinel check — its own row is asserted below"',
    'echo "PASS  trail: a known check row carries the full shape"',
    'echo "PASS  trail: rows name the tree under test"',
    'echo "PASS  trail: a failing check row keeps its detail"',
    'echo "PASS  trail: a passing check row carries no detail"',
    'echo "2 FAILURES"',
    "exit 1",
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
  // `entry` is the daemon FILE to run — the staged copy by default, and in (HD.8) the one behind
  // the symlink the update just moved, which is what the unit's ExecStart runs on the real machine
  const startDaemon = (entry = DAEMON): { proc: ReturnType<typeof Bun.spawn>; log: string } => {
    const log = `${DLOG}.${++logSeq}`;
    rmSync(log, { force: true });
    // ONE fd for both streams, opened here and closed by the OS when this process ends: passing a
    // BunFile twice gives the two streams independent write positions and they overwrite each other.
    const fd = openSync(log, "a");
    return {
      proc: Bun.spawn(["bun", entry, CFG],
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
  const selfTokenOf = async (slot: number): Promise<string> => {
    let token = "";
    for (let i = 0; i < 60; i++) {
      try {
        token = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
      } catch { /* state file mid-write */ }
      if (/^[0-9a-f]{32}$/.test(token)) return token;
      await Bun.sleep(50);
    }
    return token;
  };
  const previewReport = async (name: string, result: Record<string, unknown>): Promise<{
    status: number; body: { offer?: { state?: string; result?: { checks?: CheckCount | null } } };
  }> => {
    const lane = await openLane(REPO, name);
    const token = await selfTokenOf(lane.slot);
    const headers = { "x-fleet-self-token": token, "content-type": "application/json" };
    // The offer door refuses to MINT while no device is inside the online window
    // (server.ts#helperPresence). This section runs with the daemon deliberately wished OFF and
    // therefore silent, so the last real heartbeat is minutes of test time away by now — the beat
    // below states the precondition instead of leaning on how long the section above happened to
    // take. It touches lastSeen only; the owner's `off` wish and the daemon's silence are untouched,
    // and it goes straight to the fleet rather than through the recording proxy, so `seen` is not
    // moved by it either.
    await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });
    const offerRes = await fetch(BASE + "/api/self/suite-offer",
      { method: "POST", headers, body: "{}" });
    const offer = (await offerRes.json()) as { offer?: { id?: string } };
    const jobId = offer.offer?.id ?? "";
    await hpost("/api/helper/claim", { jobId, deviceId: DEVICE });
    const resultRes = await hpost("/api/helper/result", { jobId, ...result });
    const read = await fetch(BASE + "/api/self/suite-offer", { headers: { "x-fleet-self-token": token } });
    const body = await read.json() as { offer?: { state?: string; result?: { checks?: CheckCount | null } } };
    await post(`/api/slots/${lane.slot}/kill`, {});
    return { status: resultRes.status, body };
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
  check("(HD) THE LEDGER ROW CAME BACK red, against the exact tree that was handed over",
    remoteRow?.result === "red" && remoteRow.mainSha === jobSha && remoteRow.exitCode === 1
      && remoteRow.covers.some((c) => c.branch === job.branch),
    JSON.stringify(remoteRow).slice(0, 280));
  // THE DONE-CRITERION OF THE 2026-08-29 FIX, stated as its own check so a regression reads as what
  // it is: the whole empty-clone class ends as `unknown` with a reason, never as a red — honest,
  // and worth nothing, because nothing was measured.
  check("(HD) …and it is a MEASURED red under init.defaultBranch=master — not the `unknown` an empty clone produces",
    remoteRow?.result !== "unknown" && (remoteRow?.checks?.ran ?? 0) > 0,
    `result=${remoteRow?.result} reason=${remoteRow?.reason ?? "-"} checks=${JSON.stringify(remoteRow?.checks)}`);
  check("(HD) …and it is MARKED REMOTE with this machine's name and the trail id the daemon read out of the log",
    remoteRow?.remote?.name === DEVICE_NAME && remoteRow.remote.trail === TRAIL
      && remoteRow.remote.reportedAt >= remoteRow.remote.claimedAt,
    JSON.stringify(remoteRow?.remote));
  // THE PROOF OF THE 2026-08-29 CLASS-FIX, and the only check in this file that can carry it: the
  // daemon really runs here, so `remote.clonedSha` is a `git rev-parse HEAD` performed in the clone
  // rather than anything this suite arranged. Two statements, both needed — it is PRESENT (a daemon
  // that stopped sending it would leave the field absent, which the server stores as absence and a
  // reader cannot distinguish from an old row), and it EQUALS the sha the server bundled. While the
  // field did not exist, a remote red over a repo under parallel edit was unfalsifiable: "the helper
  // measured another tree" could be neither shown nor ruled out
  // (docs/messungen/2026-08-29-adjudikation-second-host-401.md).
  check("(HD) …and the row carries the sha the DAEMON checked out, measured in its own clone, equal to the one handed over",
    !!remoteRow?.remote?.clonedSha && remoteRow.remote.clonedSha === jobSha
      && remoteRow.mainSha === jobSha,
    `cloned=${remoteRow?.remote?.clonedSha ?? "ABSENT"} mainSha=${remoteRow?.mainSha} handedOver=${jobSha}`);
  const reported = reportedBodies.find((b) => b.jobId === claimedByDaemon?.id);
  check("(HD) the daemon's real result POST carries the exact fail names from its synthetic trail",
    JSON.stringify(reported?.fails) === '["remote trail failure alpha","remote trail failure beta"]',
    JSON.stringify(reported));
  check("(HD) the row stores those bounded names and corroborates a summary whose FAIL lines fell outside the tail",
    JSON.stringify(remoteRow?.fails) === '["remote trail failure alpha","remote trail failure beta"]'
      && remoteRow?.checks?.failed === 2
      && remoteRow.cmd.includes("remote helper") && remoteRow.cmd.includes(DEVICE_NAME),
    `${JSON.stringify(remoteRow?.fails)} ${JSON.stringify(remoteRow?.checks)} ${remoteRow?.cmd}`);
  check("(HD) remote checks.ran uses the retained trail self-count as the complete run total",
    remoteRow?.checks?.ran === REMOTE_TOTAL_CHECKS
      && remoteRow.checks.ranIsLowerBound === undefined,
    `${JSON.stringify(remoteRow?.checks)} expected=${REMOTE_TOTAL_CHECKS}`);
  const dossier = await (await get(`/api/lane?branch=${encodeURIComponent(job.branch)}`)).json() as {
    audits?: { state?: string; value?: { rows?: { fails?: string[] }[] } };
  };
  check("(HD) the lane's Audit/Ledger projection carries the same bounded fail names to its reader",
    dossier.audits?.state === "read"
      && JSON.stringify(dossier.audits.value?.rows?.[0]?.fails) === '["remote trail failure alpha","remote trail failure beta"]',
    JSON.stringify(dossier.audits));
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
  // C1 (2026-09-13): the suite's TMPDIR is its own run dir's `tmp/`, BESIDE the tree — never /tmp,
  // which on the work-horse is a tmpfs that kept reds filled to 98 %. The clone is thrown away after
  // the report; the red instance must still be there, because pruneRuns is what bounds it now.
  // MUTATION: drop TMPDIR from daemon.ts#work's suiteEnv ⇒ tmp=[] or the harness's own ⇒ red.
  const ranTmp = /tmp=\[([^\]]*)\]/.exec(out)?.[1] ?? "";
  const cloneGone = await (async (): Promise<boolean> => {
    const deadline = Date.now() + 15_000;
    while (existsSync(ranIn) && Date.now() < deadline) await Bun.sleep(200);
    return ranIn !== "" && !existsSync(ranIn);
  })();
  const keptInstance = ((): string[] => {
    try { return readdirSync(ranTmp).filter((d) => d.startsWith("fleet-e2e-instance-")); } catch { return []; }
  })();
  check("(HD) THE SUITE'S SCRATCH IS <run dir>/tmp BESIDE tree — and the red instance it kept outlives the clone",
    // the run dir is compared by NAME: TMPDIR is the daemon's spelling of WORK, pwd the physical one
    /\/daemonwork\/run-[a-f0-9]{12}-\d+\/tmp$/.test(ranTmp)
      && /(run-[a-f0-9]{12}-\d+)\/tmp$/.exec(ranTmp)?.[1] === /(run-[a-f0-9]{12}-\d+)\/tree$/.exec(ranIn)?.[1]
      && cloneGone && keptInstance.length === 1
      && readFileSync(`${ranTmp}/${keptInstance[0]}/server.log`, "utf8") === "kept red\n",
    `tmp=${ranTmp} pwd=${ranIn} cloneGone=${cloneGone} kept=${JSON.stringify(keptInstance)}`);

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

  // ===== (HD.6) THE RESULT BODY'S NETWORK BOUNDARY ===============================================
  // Preview jobs make the validator observable without writing synthetic audit rows: they traverse
  // the same /api/helper/result fork, then expose the derived checks back to their own lane.
  const legacy = await previewReport("daemonlegacy", {
    exitCode: 1, tail: "FAIL  legacy visible failure\n1 FAILURES",
  });
  check("(HD) an OLD result body without fails is still accepted, with its tail count marked as a lower bound",
    legacy.status === 200 && legacy.body.offer?.state === "reported"
      && legacy.body.offer.result?.checks?.ran === 1 && legacy.body.offer.result.checks.failed === 1
      && legacy.body.offer.result.checks.ranIsLowerBound === true,
    JSON.stringify(legacy));

  const fiftyOne = Array.from({ length: 51 }, (_, i) => `bounded failure ${i + 1}`);
  const capped = await previewReport("daemoncap", {
    exitCode: 1, tail: "50 FAILURES", fails: fiftyOne,
  });
  check("(HD) mutation guard: a 51-name network array is capped to 50 before corroboration",
    capped.status === 200 && capped.body.offer?.result?.checks?.ran === 50
      && capped.body.offer.result.checks.failed === 50,
    JSON.stringify(capped));

  const rejected = await previewReport("daemonbadfails", {
    exitCode: 1, tail: "1 FAILURES", fails: ["plausible name", 7],
  });
  check("(HD) mutation guard: one non-string rejects the whole fails field instead of corroborating it",
    rejected.status === 200 && rejected.body.offer?.state === "reported"
      && rejected.body.offer.result?.checks === null,
    JSON.stringify(rejected));

  // ===== (HD.7) THE TOKEN NEVER LEFT ITS HEADER =================================================
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

  // ===== (HD.8) THE DAEMON UPDATES ITSELF: clone → check → symlink-swap → exit 75 ================
  // The daemon above read an owner `off` and would not poll again for an hour, so this section
  // runs a fresh one. What it proves, in order: the owner's door queues a ROW (nothing is pushed);
  // the row is offered to its device alone; the daemon performs the four steps in exactly that
  // order and ends in exit 75 with the link on the new tree; started again from the link — the
  // part systemd plays on the real machine — it boots the NEW tree and its heartbeat names the
  // bundled sha; and a tree that does not parse is refused BEFORE the link moves, with the daemon
  // still running afterwards.
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const CUR = `${WORK}/current`;
  const shaOf = (dir: string): string => spawnSync("git", ["-C", dir, "rev-parse", "HEAD"]).stdout.toString().trim();
  const goodSha = shaOf(UPD);
  const goodTree = `${WORK}/tree-${goodSha.slice(0, 12)}`;
  const ownerDevice = async (): Promise<OwnerDevice | undefined> =>
    (((await (await get("/api/sessions")).json()) as { helperDevices?: OwnerDevice[] }).helperDevices ?? [])
      .find((d) => d.id === DEVICE);
  const waitDevice = async (pred: (d: OwnerDevice | undefined) => boolean, timeoutMs = 30_000): Promise<OwnerDevice | undefined> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const d = await ownerDevice();
      if (pred(d) || Date.now() >= deadline) return d;
      await Bun.sleep(250);
    }
  };
  const noDev = await post("/api/helper/devices/e2enosuchdev/update", {});
  const viaHelper = await hpost(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) should-reject: an update for a device nobody has seen is 404, and the HELPER principal cannot queue one (401 — its header is one the owner gate never reads)",
    noDev.status === 404 && viaHelper.status === 401, `${noDev.status} ${viaHelper.status}`);
  const updQueued = await post(`/api/helper/devices/${DEVICE}/update`, {});
  const queuedBody = (await updQueued.json()) as { update?: { id?: string; state?: string; main?: string }; error?: string };
  check("(HD) THE OWNER QUEUES A daemon-update — a row on the board, nothing pushed to the machine",
    updQueued.status === 200 && queuedBody.update?.state === "open" && queuedBody.update.main === "main"
      && /^[0-9a-f]{12}$/.test(queuedBody.update.id ?? ""),
    `${updQueued.status} ${JSON.stringify(queuedBody)}`);
  const twice = await post(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) should-reject: a second update while one is updQueued is 409",
    twice.status === 409, `${twice.status}`);
  const offered = (await jobsOf()).find((j) => j.kind === "daemon-update");
  const strangerJobs = ((await (await hget("/api/helper/jobs?deviceId=e2eotherbox001")).json()) as { jobs: HelperJob[] }).jobs;
  check("(HD) the update is OFFERED TO ITS DEVICE ALONE, as kind daemon-update on main — another deviceId's list has no such job",
    offered?.id === queuedBody.update?.id && offered?.main === "main" && offered.claim === null && offered.covers === 0
      && !strangerJobs.some((j) => j.kind === "daemon-update"),
    `${JSON.stringify(offered)} stranger=${strangerJobs.length}`);

  const up1 = startDaemon();
  const exit1 = await Promise.race([up1.proc.exited, Bun.sleep(90_000).then(() => -1)]);
  const l1 = logText(up1.log);
  const seq = [": clone main", "bun build --target=bun helper-daemon/daemon.ts", ": symlink-swap ", `: exit ${EXIT_UPDATED}`]
    .map((s) => l1.indexOf(s));
  check("(HD) THE DAEMON UPDATED ITSELF — clone → check → symlink-swap → exit 75, in exactly that order",
    exit1 === EXIT_UPDATED && seq.every((i) => i >= 0) && seq[0]! < seq[1]! && seq[1]! < seq[2]! && seq[2]! < seq[3]!,
    `exit=${exit1} seq=${JSON.stringify(seq)} | ${l1.split("\n").filter((l) => l.includes("update ")).join(" | ").slice(0, 400)}`);
  const link1 = ((): string => { try { return readlinkSync(CUR); } catch { return "(no link)"; } })();
  check("(HD) …the link points at the new tree, which is at the exact sha the fleet bundled; bundle and check scratch are gone",
    link1 === goodTree && shaOf(CUR) === goodSha && !existsSync(`${goodTree}.check`)
      && !readdirSync(WORK).some((n) => n.endsWith(".bundle")),
    `link=${link1} sha=${shaOf(CUR)} handedOver=${goodSha} work=${readdirSync(WORK).join(",")}`);
  const swapReport = reportedBodies.find((b) => b.jobId === queuedBody.update?.id);
  const dev1 = await waitDevice((d) => d?.update?.state === "reported");
  check("(HD) …the result POST said exit 0 with the cloned sha, and the board's row reads reported/swapped — while NO daemon has yet reported running it",
    swapReport?.exitCode === 0 && swapReport.clonedSha === goodSha
      && dev1?.update?.state === "reported" && dev1.update.result?.ok === true && dev1.update.result.mainSha === goodSha
      && dev1.daemonSha !== goodSha,
    `report=${JSON.stringify(swapReport)} board=${JSON.stringify(dev1?.update)} daemonSha=${dev1?.daemonSha ?? "ABSENT"}`);

  // systemd's part, played here: RestartForceExitStatus=75 starts the unit again, and its ExecStart
  // runs THROUGH THE LINK — so this is the daemon.ts inside the tree the update just checked in.
  const up2 = startDaemon(`${CUR}/helper-daemon/daemon.ts`);
  check("(HD) restarted from the link, the daemon boots the NEW tree and says which sha it runs",
    await waitLog(up2.log, `running ${goodSha.slice(0, 8)} from`),
    logText(up2.log).split("\n")[0]?.slice(0, 240) ?? "(no log)");
  const dev2 = await waitDevice((d) => d?.daemonSha === goodSha);
  check("(HD) THE HEARTBEAT CARRIES daemonSha = the bundled sha, and the board shows it — the update provably took",
    dev2?.daemonSha === goodSha && dev2.update?.result?.mainSha === goodSha,
    `daemonSha=${dev2?.daemonSha ?? "ABSENT"} bundled=${goodSha}`);

  // THE NEGATIVE HALF, and the one the whole ordering exists for: a tree whose daemon.ts does not
  // parse must never become the link's target. The daemon that refuses it is the one running from
  // the good tree — and it is still running afterwards.
  await Bun.write(`${UPD}/helper-daemon/daemon.ts`, "const broken = ;\nexport {};\n");
  spawnSync("git", ["-C", UPD, "-c", "user.name=e2e", "-c", "user.email=e2e@example.invalid", "commit", "-qam", "a daemon that does not parse"]);
  const badSha = shaOf(UPD);
  const requeued = await post(`/api/helper/devices/${DEVICE}/update`, {});
  check("(HD) setup: a reported update can be followed by a new one — the row is re-queued open",
    requeued.status === 200 && badSha !== goodSha, `${requeued.status} bad=${badSha.slice(0, 8)}`);
  const refused = await waitLog(up2.log, "check-failed", 90_000);
  const l2 = logText(up2.log);
  const link2 = ((): string => { try { return readlinkSync(CUR); } catch { return "(no link)"; } })();
  check("(HD) A TREE THAT DOES NOT PARSE IS REFUSED: check-failed, NO symlink-swap, exit code none — the daemon keeps running from the good tree",
    refused && !l2.includes("symlink-swap") && link2 === goodTree && up2.proc.exitCode === null,
    `refused=${refused} swapped=${l2.includes("symlink-swap")} link=${link2} alive=${up2.proc.exitCode === null}`);
  const dev3 = await waitDevice((d) => d?.update?.state === "reported" && d.update.result?.mainSha === badSha);
  check("(HD) …the board says failed with the bad sha, and daemonSha still names the good tree",
    dev3?.update?.result?.ok === false && dev3.update.result.mainSha === badSha
      && dev3.update.result.note.includes("check-failed") && dev3.daemonSha === goodSha,
    `${JSON.stringify(dev3?.update)} daemonSha=${dev3?.daemonSha}`);
  check("(HD) …and both trees are on disk: the refused one for inspection, the good one as the way back",
    existsSync(`${WORK}/tree-${badSha.slice(0, 12)}`) && existsSync(goodTree),
    readdirSync(WORK).filter((n) => n.startsWith("tree-")).join(","));
  const badBeat = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, daemonSha: "not-a-sha" });
  check("(HD) should-reject: a heartbeat whose daemonSha is not 40 hex is 400, and the stored sha is untouched",
    badBeat.status === 400 && (await ownerDevice())?.daemonSha === goodSha, `${badBeat.status}`);

  // ===== (HD.9) THE COMMAND JOB — work sent from here, run there, receipted with artefacts ======
  // Placed HERE and not earlier for one measured reason: a command job is offered ONLY to a device
  // whose heartbeat carried `daemonSha`, and `up2` is the first daemon in this file that HAS one —
  // it runs from the checked-out tree the update above swapped in, so its own `git rev-parse` has an
  // answer. Running this section against the staged copy (no git checkout around it) would measure
  // the handshake refusing, not the feature working.
  {
    const lane = await openLane(REPO, "cmdjob");
    const laneToken = await selfTokenOf(lane.slot);
    const selfH = { "x-fleet-self-token": laneToken, "content-type": "application/json" };
    // package.json + probe are COMMITTED, then the probe is CHANGED and left uncommitted. That is
    // the whole point of `git stash create`: the artefact's digest below can only match the dirty
    // bytes if the tree that ran on the other machine was the tree this lane actually HAS.
    await Bun.write(`${lane.cwd}/package.json`,
      JSON.stringify({ name: "cmdprobe", private: true,
        scripts: { build: "mkdir -p dist && cp probe.txt dist/out.txt" } }, null, 2) + "\n");
    await Bun.write(`${lane.cwd}/probe.txt`, "committed payload\n");
    spawnSync("git", ["-C", lane.cwd, "add", "package.json", "probe.txt"]);
    spawnSync("git", ["-C", lane.cwd, "commit", "-qm", "cmdjob build fixture"]);
    const DIRTY = "UNCOMMITTED payload the helper must see\n";
    await Bun.write(`${lane.cwd}/probe.txt`, DIRTY);
    const shaOfFile = (path: string): string =>
      spawnSync("shasum", ["-a", "256", path]).stdout.toString().trim().split(/\s+/)[0] ?? "";
    const wantSha = shaOfFile(`${lane.cwd}/probe.txt`);
    check("(HD) setup: the lane's dirty probe hashes to something this suite can compare against",
      /^[0-9a-f]{64}$/.test(wantSha), wantSha);

    // THE REFUSAL FIRST, and its second half is the one that matters: no row is created, so there is
    // nothing for any helper to claim. A 400 that still queued the job would be the same bug wearing
    // a status code.
    const before = (await jobsOf()).filter((j) => j.kind === "command").length;
    const refusedCmd = await fetch(BASE + "/api/self/jobs",
      { method: "POST", headers: selfH, body: JSON.stringify({ cmd: "claude -p x" }) });
    const refusedBody = (await refusedCmd.json()) as { error?: string; jobId?: string };
    const afterRefusal = (await jobsOf()).filter((j) => j.kind === "command").length;
    check("(HD) should-reject: a cmd naming an agent harness is 400 AND creates no claimable row",
      refusedCmd.status === 400 && refusedBody.jobId === undefined && afterRefusal === before
        && (refusedBody.error ?? "").includes("claude"),
      `${refusedCmd.status} jobs ${before}→${afterRefusal} ${JSON.stringify(refusedBody.error ?? "")}`);
    const offList = await fetch(BASE + "/api/self/jobs",
      { method: "POST", headers: selfH, body: JSON.stringify({ cmd: "make -j8" }) });
    check("(HD) should-reject: a cmd that is merely not on the allowlist is 400 too, and says so",
      offList.status === 400 && ((await offList.json()) as { error?: string }).error?.includes("allowlist") === true,
      `${offList.status}`);

    const madeRes = await fetch(BASE + "/api/self/jobs", { method: "POST", headers: selfH,
      body: JSON.stringify({ cmd: "bun run build", timeoutMs: 120_000, artifacts: ["dist/*.txt"] }) });
    const made = (await madeRes.json()) as { jobId?: string; job?: { cmd?: string; argv?: string[] } };
    const jobId = made.jobId ?? "";
    check("(HD) THE SESSION POSTS A COMMAND JOB and gets an id back, with the argv the allowlist split",
      madeRes.status === 200 && /^[0-9a-f]{12}$/.test(jobId) && made.job?.cmd === "bun run build"
        && JSON.stringify(made.job?.argv) === '["bun","run","build"]',
      `${madeRes.status} ${JSON.stringify(made)}`);

    // THE HANDSHAKE, measured from the OTHER side: a device that never named a daemonSha does not
    // see this job at all. `e2eotherbox001` has only ever been used as a jobs-list reader above.
    const strangerCmd = ((await (await hget("/api/helper/jobs?deviceId=e2eotherbox001")).json()) as
      { jobs: HelperJob[] }).jobs.filter((j) => j.kind === "command");
    const mineCmd = (await jobsOf()).find((j) => j.kind === "command" && j.id === jobId);
    check("(HD) a command job is INVISIBLE to a device whose heartbeat named no daemonSha, and visible to the one that did",
      strangerCmd.length === 0 && !!mineCmd,
      `stranger=${strangerCmd.length} mine=${JSON.stringify(mineCmd)}`);

    const readJob = async (): Promise<{ state?: string; treeSha?: string | null; result?: {
      exitCode?: number | null; result?: string; reason?: string;
      artifacts?: { path: string; sha256: string; bytes: number }[];
      remote?: { name?: string; clonedSha?: string } } }> => {
      const r = await fetch(BASE + `/api/self/jobs/${jobId}`, { headers: { "x-fleet-self-token": laneToken } });
      return ((await r.json()) as { job?: Record<string, unknown> }).job ?? {};
    };
    const deadline = Date.now() + 180_000;
    let settled = await readJob();
    while (Date.now() < deadline && settled.state !== "reported") {
      await Bun.sleep(500);
      settled = await readJob();
    }
    const arts = settled.result?.artifacts ?? [];
    const out = arts.find((a) => a.path === "dist/out.txt");
    check("(HD) THE RECEIPT: the remote run of `bun run build` came back exit 0 / green, named by the device that ran it",
      settled.state === "reported" && settled.result?.exitCode === 0 && settled.result.result === "green"
        && settled.result.remote?.name === DEVICE_NAME,
      `state=${settled.state} exit=${settled.result?.exitCode} result=${settled.result?.result}`
      + ` reason=${settled.result?.reason ?? "-"} remote=${settled.result?.remote?.name ?? "-"}`);
    check("(HD) …and it carries the artefact the globs asked for, hashed IN THE CLONE — the digest is the lane's UNCOMMITTED bytes, so `git stash create` provably carried them",
      arts.length >= 1 && out?.sha256 === wantSha && out.bytes === Buffer.byteLength(DIRTY),
      `${arts.length} artefact(s) ${JSON.stringify(arts.slice(0, 3))} want=${wantSha} wantBytes=${Buffer.byteLength(DIRTY)}`);

    // THE WATCH, through the OWNER route. This slice added a job KIND, not a principal: the
    // self-watch door still answers a lane 409 ("lane-waits-on-lane"), and widening that is an
    // owner promotion, not a lane's to make. Both halves are checked, so the boundary is measured
    // rather than assumed. The watch's own mechanics (fires once, level-triggered) live in
    // e2e/watch.ts on a non-lane session, which is the principal that can hold one.
    const laneSelfWatch = await fetch(BASE + "/api/self/watch", { method: "POST", headers: selfH,
      body: JSON.stringify({ kind: "job", target: jobId, idleSec: 0 }) });
    check("(HD) a LANE is still refused 409 on /api/self/watch, job kind included — a kind was added, not a principal",
      laneSelfWatch.status === 409 && (await laneSelfWatch.text()).includes("a lane may not subscribe"),
      `${laneSelfWatch.status}`);
    const watchRes = await post(`/api/slots/${lane.slot}/watch`, { kind: "job", target: jobId, idleSec: 0 });
    const watchBody = (await watchRes.json()) as { watch?: { id?: string; kind?: string; jobId?: string; armed?: boolean } };
    check("(HD) the owner may point a job watch at this lane, and subscribing AFTER the verdict fires in the subscribe call",
      watchRes.status === 200 && watchBody.watch?.kind === "job" && watchBody.watch.jobId === jobId
        && watchBody.watch.armed === false,
      `${watchRes.status} ${JSON.stringify(watchBody)}`);
    const badWatch = await post(`/api/slots/${lane.slot}/watch`, { kind: "job", target: "ffffffffffff" });
    check("(HD) should-reject: a job watch on an id this fleet never offered is 409 — a watch that could never fire is refused at create",
      badWatch.status === 409, `${badWatch.status}`);

    // ===== (HD.9b) THE VINTAGE GUARD: A daemonSha IS READ, NOT COUNTED ==========================
    // The handshake above proves a daemon that named NO sha is turned away. This proves the half
    // that a presence check cannot reach: a daemon that names one whose tree predates the command
    // kind is turned away too. It is the difference between a claim refused and the receipt of a
    // `cfg.suiteCmd` run handed back as the verdict of a command nobody ran.
    //
    // THE DAEMON IS STOPPED FIRST, and that is the check's design and not tidying: an open command
    // job is claimable by the live daemon within a poll, so a refusal measured against it could be
    // answered by "already claimed by …" — the same 409 for a different reason, which is the exact
    // vacuum-green this file has already paid for once (d4bb687, 2026-09-02). With no rival poller
    // the jobs below stay open until this suite touches them.
    up2.proc.kill();
    await up2.proc.exited;
    const OLDBOX = "e2eoldvintagebox";
    const NEWBOX = "e2enewvintagebox";
    const beatOld = await hpost("/api/helper/device", { deviceId: OLDBOX, name: "old daemon (e2e)", daemonSha: PRE_FLOOR });
    const beatNew = await hpost("/api/helper/device", { deviceId: NEWBOX, name: "current daemon (e2e)", daemonSha: CMD_FLOOR });
    check("(HD.9b) setup: two devices enroll, one naming a PRE-FLOOR daemon sha and one naming the floor itself",
      beatOld.ok && beatNew.ok, `old=${beatOld.status} new=${beatNew.status}`);
    const newJob = async (cmd: string): Promise<string> => {
      const r = await fetch(BASE + "/api/self/jobs", { method: "POST", headers: selfH, body: JSON.stringify({ cmd }) });
      return ((await r.json()) as { jobId?: string }).jobId ?? "";
    };
    const jobOld = await newJob("bun test");
    const jobNew = await newJob("bun run verify");
    const oldClaim = await hpost("/api/helper/claim", { jobId: jobOld, deviceId: OLDBOX });
    const oldText = await oldClaim.text();
    check("(HD.9b) A DAEMON WHOSE TREE PREDATES THE COMMAND KIND IS REFUSED THE CLAIM — 409 naming its own sha and the floor it lacks",
      oldClaim.status === 409 && oldText.includes(PRE_FLOOR.slice(0, 8)) && oldText.includes(CMD_FLOOR.slice(0, 8))
        && !oldText.includes("already claimed"),
      `${oldClaim.status} ${oldText.slice(0, 300)}`);
    const newClaim = await hpost("/api/helper/claim", { jobId: jobNew, deviceId: NEWBOX });
    const newBody = (await newClaim.json()) as { job?: { kind?: string; argv?: string[] }; error?: string };
    check("(HD.9b) …and a daemon AT the floor commit claims the same kind of job — the guard reads the sha, it does not merely have one",
      newClaim.status === 200 && newBody.job?.kind === "command"
        && JSON.stringify(newBody.job.argv) === '["bun","run","verify"]',
      `${newClaim.status} ${JSON.stringify(newBody).slice(0, 300)}`);

    // THE CACHE, measured rather than asserted: the answer is remembered PER SHA, so with the
    // source repo moved out from under the server both verdicts must still come back — and come
    // back DIFFERENT. A guard that re-measured would find no repo and refuse the good sha too (an
    // unmeasurable vintage is refused by design); a cache keyed by anything but the sha would hand
    // one device the other's answer.
    await hpost("/api/helper/result", { jobId: jobNew, exitCode: 0, tail: "verified", clonedSha: "e".repeat(40) });
    const jobCached = await newJob("bun run build");
    renameSync(UPD, `${UPD}.away`);
    const cachedGood = await hpost("/api/helper/claim", { jobId: jobCached, deviceId: NEWBOX });
    const cachedOld = await hpost("/api/helper/claim", { jobId: jobOld, deviceId: OLDBOX });
    const cachedOldText = await cachedOld.text();
    renameSync(`${UPD}.away`, UPD);
    check("(HD.9b) THE VINTAGE IS CACHED PER SHA: with the source repo moved away the good sha still claims and the old sha is still refused on the vintage ground — two answers, neither re-measured and neither leaked into the other",
      cachedGood.status === 200 && cachedOld.status === 409
        && cachedOldText.includes(PRE_FLOOR.slice(0, 8)) && !cachedOldText.includes("already claimed"),
      `good=${cachedGood.status} old=${cachedOld.status} ${cachedOldText.slice(0, 200)}`);

    await post(`/api/slots/${lane.slot}/kill`, {});
  }

  // ===== (HD.10) TWO AT ONCE — THE CAP THAT COUNTS, DRIVEN AS REAL PROCESSES ====================
  // The arithmetic is checked in (HD.1). This is the half arithmetic cannot reach: that the daemon
  // actually STOPS at its cap and actually STARTS a second job below it, and that each parallel run
  // gets its own suite lock — without which the field would be wired end to end and buy nothing,
  // because ./e2e-isolated.sh takes /tmp/fleet-e2e.lock inside the clone and the second slot would
  // only ever be a place in the waiting line.
  //
  // WHY LANE PREVIEW OFFERS AND NOT AUDITS: an audit job is keyed by REPO, one per tree, so more
  // than one claimable audit needs more than one repo. Four lanes offering their own previews is
  // the cheapest list with four open jobs on it.
  //
  // THE STAND-IN SUITE IS A LATCH, NOT A SLEEP. It spins until a release file appears, so this
  // section decides when the runs end instead of waiting out a timeout — and a daemon killed
  // mid-run cannot leave a minute-long orphan behind in the scratch tree.
  {
    const CAP1BOX = "e2ecapone00001";
    const CAP2BOX = "e2ecaptwo00001";
    const REL = `${ROOT}/slowsuite.release`;
    rmSync(REL, { force: true });
    const SLOW = `${ROOT}/fakeslowsuite`;
    await Bun.write(SLOW, [
      "#!/bin/sh",
      `echo "slow suite start pwd=$(pwd) lock=[${"$"}{FLEET_SUITE_LOCK:-}] tmp=[${"$"}{TMPDIR:-}]"`,
      `i=0; while [ ! -f ${JSON.stringify(REL)} ] && [ "$i" -lt 400 ]; do sleep 0.2; i=$((i + 1)); done`,
      'echo "PASS  the slow stand-in was released"',
      "exit 0",
    ].join("\n"));
    chmodSync(SLOW, 0o755);

    // the offer door refuses to mint while no helper is inside the online window, so a stand-in
    // beats first — no daemon is running at this point, and nothing may claim these before they
    // all exist
    await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.1 });
    const capLanes: Lane[] = [];
    const capJobs: string[] = [];
    for (const n of ["capa", "capb", "capc", "capd"]) {
      const ln = await openLane(REPO, n);
      capLanes.push(ln);
      const tok = await selfTokenOf(ln.slot);
      const r = await fetch(BASE + "/api/self/suite-offer", { method: "POST",
        headers: { "x-fleet-self-token": tok, "content-type": "application/json" }, body: "{}" });
      capJobs.push(((await r.json()) as { offer?: { id?: string } | null }).offer?.id ?? "");
    }
    check("(HD.10) setup: four lanes offer their preview suites — four open jobs, none claimed by anything yet",
      capJobs.every((id) => /^[0-9a-f]{12}$/.test(id)) && new Set(capJobs).size === 4
        && (await jobsOf()).filter((j) => j.kind === "lane-suite" && !j.claim).length === 4,
      `ids=${JSON.stringify(capJobs)}`);

    const devRow = async (deviceId: string): Promise<OwnerDevice | undefined> =>
      (((await (await get("/api/sessions")).json()) as { helperDevices?: OwnerDevice[] }).helperDevices ?? [])
        .find((d) => d.id === deviceId);
    const claimsOf = async (deviceId: string): Promise<number> =>
      (await devRow(deviceId))?.claims?.length ?? 0;
    const waitClaims = async (deviceId: string, n: number, timeoutMs = 30_000): Promise<number> => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const held = await claimsOf(deviceId);
        if (held >= n || Date.now() >= deadline) return held;
        await Bun.sleep(200);
      }
    };
    const openJobs = async (): Promise<number> =>
      (await jobsOf()).filter((j) => j.kind === "lane-suite" && !j.claim).length;
    // the FLEET_SUITE_LOCK each run's child actually got, read out of the run's own suite.log — the
    // one place the child's environment is legible from here. UNORDERED on purpose: a run dir is
    // `run-<random hex job id>-<ts>`, so sorting these names orders them by a random id and not by
    // time. Every assertion below is therefore a statement about the SET, never about position.
    const envOf = (re: RegExp): string[] => {
      let dirs: string[] = [];
      try { dirs = readdirSync(WORK).filter((d) => d.startsWith("run-")); } catch { return []; }
      return dirs.map((d) => {
        let text = "";
        try { text = readFileSync(`${WORK}/${d}/suite.log`, "utf8"); } catch { return null; }
        return re.exec(text)?.[1] ?? null;
      }).filter((x): x is string => x !== null);
    };
    const locks = (): string[] => envOf(/lock=\[([^\]]*)\] tmp=/);
    // …and the TMPDIR each got (C1), paired with the run dir whose log printed it: a scratch is only
    // "its own" when it names THAT run's `tmp/`, not merely some run's
    const tmpsOwn = (): { dir: string; tmp: string }[] => {
      let dirs: string[] = [];
      try { dirs = readdirSync(WORK).filter((d) => d.startsWith("run-")); } catch { return []; }
      return dirs.flatMap((d) => {
        let text = "";
        try { text = readFileSync(`${WORK}/${d}/suite.log`, "utf8"); } catch { return []; }
        const tmp = /slow suite start .* tmp=\[([^\]]*)\]/.exec(text)?.[1];
        return tmp === undefined ? [] : [{ dir: d, tmp }];
      });
    };

    // --- CAP 1 (the default): one job, and the machine stops there -------------------------------
    // `installCmd` is a no-op here on purpose: this section measures slot counting, and a real
    // install would put a minute of unrelated failure surface between the claim and the run.
    await writeConfig({ deviceId: CAP1BOX, name: "cap-1 box (e2e)", suiteCmd: SLOW,
      installCmd: "true", pollSec: 1, maxLoad1: null });
    const one = startDaemon();
    check("(HD.10) setup: the cap-1 daemon starts and claims its first job",
      await waitLog(one.log, "helper-daemon up") && (await waitClaims(CAP1BOX, 1)) === 1,
      `claims=${await claimsOf(CAP1BOX)}`);
    await Bun.sleep(4000); // ~4 polls at pollSec 1, with three jobs sitting open in front of it
    const oneHeld = await claimsOf(CAP1BOX);
    const oneOpen = await openJobs();
    const oneRow = await devRow(CAP1BOX);
    const oneLocks = locks();  // only the slow stand-in prints a `lock=[…]` line, so this set is HD.10's own
    const oneTmps = tmpsOwn();
    check("(HD.10) AT THE DEFAULT CAP OF 1 A SECOND JOB IS NOT CLAIMED: four polls pass with three jobs open in front of a daemon that already runs one",
      oneHeld === 1 && oneOpen === 3, `held=${oneHeld} stillOpen=${oneOpen}`);
    check("(HD.10) …and the machine SAYS so on its own heartbeat — 1 of 1, the pair no load figure could give",
      oneRow?.running === 1 && oneRow.maxParallelSuites === 1,
      `${JSON.stringify({ running: oneRow?.running, max: oneRow?.maxParallelSuites })}`);
    check("(HD.10) …and at cap 1 the run keeps the DEFAULT suite lock: a hand-started suite over there still serializes against this one",
      oneLocks.length === 1 && oneLocks[0] === "", `locks=${JSON.stringify(oneLocks)}`);
    // MUTATION: give TMPDIR only above cap 1 (next to FLEET_SUITE_LOCK) ⇒ tmp=[] or the harness's ⇒ red
    check("(HD.10) …but its SCRATCH still leaves /tmp: even at cap 1 TMPDIR is that run's own <run dir>/tmp, and it exists",
      oneTmps.length === 1 && oneTmps[0]!.tmp === `${WORK}/${oneTmps[0]!.dir}/tmp` && existsSync(oneTmps[0]!.tmp),
      `tmps=${JSON.stringify(oneTmps)}`);
    one.proc.kill();
    await one.proc.exited;

    // --- CAP 2: two run, and the third still waits -----------------------------------------------
    await writeConfig({ deviceId: CAP2BOX, name: "cap-2 box (e2e)", suiteCmd: SLOW,
      installCmd: "true", pollSec: 1, maxLoad1: null, maxParallelSuites: 2 });
    const two = startDaemon();
    check("(HD.10) setup: the cap-2 daemon starts on the same list, three jobs still open",
      await waitLog(two.log, "helper-daemon up") && (await waitClaims(CAP2BOX, 2)) === 2,
      `claims=${await claimsOf(CAP2BOX)} open=${await openJobs()}`);
    await Bun.sleep(4000);
    const twoHeld = await claimsOf(CAP2BOX);
    const twoOpen = await openJobs();
    const twoRow = await devRow(CAP2BOX);
    check("(HD.10) AT CAP 2 TWO JOBS RUN AND THE THIRD WAITS — the cap counts jobs, and four further polls do not move it",
      twoHeld === 2 && twoOpen === 1, `held=${twoHeld} stillOpen=${twoOpen}`);
    check("(HD.10) …and the board reads 2 of 2 off that machine's own heartbeat",
      twoRow?.running === 2 && twoRow.maxParallelSuites === 2,
      `${JSON.stringify({ running: twoRow?.running, max: twoRow?.maxParallelSuites })}`);
    // THE HALF THAT MAKES THE OTHER TWO WORTH ANYTHING. Two runs sharing /tmp/fleet-e2e.lock queue
    // behind each other INSIDE the clone: two claims, two processes, one suite at a time and no
    // wall-clock bought. The locks must be present, DIFFERENT from each other, and each under its
    // own run directory.
    // Read as a SET, and the empty one from the cap-1 phase is deliberately not counted here: this
    // daemon prunes its own run dirs to `keepRuns`, so whether that older run is still on disk is
    // not a fact this check is entitled to assert.
    const parallelLocks = locks().filter((l) => l !== "");
    check("(HD.10) …AND EACH PARALLEL RUN GOT ITS OWN SUITE LOCK — two runs on one default lock would serialize inside the clone and buy nothing",
      parallelLocks.length === 2 && new Set(parallelLocks).size === 2
        && parallelLocks.every((l) => l.startsWith(`${WORK}/run-`) && l.endsWith("/e2e.lock")),
      `locks=${JSON.stringify(parallelLocks)}`);
    // the cap-1 run above may or may not survive the prune, so this too is read as a set: every run
    // that printed a scratch names its OWN dir, and the two live runs' scratches differ
    const twoTmps = tmpsOwn();
    const liveTmps = twoTmps.filter((t) => parallelLocks.includes(`${WORK}/${t.dir}/e2e.lock`));
    check("(HD.10) …AND EACH PARALLEL RUN GOT ITS OWN SCRATCH — TMPDIR is that run's <run dir>/tmp, two runs never share one",
      liveTmps.length === 2 && new Set(liveTmps.map((t) => t.tmp)).size === 2
        && twoTmps.every((t) => t.tmp === `${WORK}/${t.dir}/tmp` && existsSync(t.tmp)),
      `tmps=${JSON.stringify(twoTmps)}`);

    // --- A FULL MACHINE STILL HEARS THAT A JOB WAS TAKEN BACK (7e601e57) --------------------------
    // Measured 2026-09-12: a lane landed, the fleet reaped its preview within the minute, and the
    // second-host — both slots busy — ran that preview on for 37 more minutes, to a `409 no live claim`.
    // A full daemon used to return before asking for the job list at all, so it could not learn it.
    // Here the machine is exactly that full (2 of 2, latched runs), one of its lanes is killed, and
    // the daemon must end THAT run without reporting it, keep the other, and use the freed slot.
    // MUTATION: restore `if (free <= 0) return;` in front of the list request in daemon.ts#tick (or
    // drop the withdrawnRuns loop) ⇒ no abort line, the victim's run stays latched ⇒ red.
    const heldRefs = ((await devRow(CAP2BOX))?.claims ?? []).map((c) => c.ref);
    const victimIdx = capLanes.findIndex((ln) => ln.branch === heldRefs[0]);
    const victimJob = capJobs[victimIdx] ?? "";
    const keptIdx = capLanes.findIndex((ln) => ln.branch === heldRefs[1]);
    const bodiesBefore = reportedBodies.length;
    check("(HD.10) setup: the victim is one of the two runs this full machine holds",
      victimIdx >= 0 && keptIdx >= 0 && victimIdx !== keptIdx && /^[0-9a-f]{12}$/.test(victimJob),
      `held=${JSON.stringify(heldRefs)} victim=${victimIdx} kept=${keptIdx}`);
    await post(`/api/slots/${capLanes[victimIdx]!.slot}/kill`, {});
    const aborted = await waitLog(two.log, `job ${victimJob} is no longer this machine's`, 15_000);
    const ended = await waitLog(two.log, `for ${victimJob} ended by withdrawal`, 15_000);
    check("(HD.10) A FULL DAEMON ABORTS THE RUN WHOSE LANE IS GONE — within a few polls, and reports nothing for it",
      aborted && ended && !reportedBodies.slice(bodiesBefore).some((b) => b.jobId === victimJob)
        && !logText(two.log).includes(`reported ${victimJob}`),
      `aborted=${aborted} ended=${ended} reports=${JSON.stringify(reportedBodies.slice(bodiesBefore).map((b) => b.jobId))}`);
    const refill = await (async (): Promise<string[]> => {
      const deadline = Date.now() + 15_000;
      for (;;) {
        const refs = ((await devRow(CAP2BOX))?.claims ?? []).map((c) => c.ref);
        if ((refs.length === 2 && !refs.includes(heldRefs[0]!)) || Date.now() >= deadline) return refs;
        await Bun.sleep(200);
      }
    })();
    check("(HD.10) …the other run is untouched, and the freed slot takes the job that was waiting",
      refill.length === 2 && refill.includes(heldRefs[1]!) && !refill.includes(heldRefs[0]!)
        && (await openJobs()) === 0,
      `claims=${JSON.stringify(refill)} open=${await openJobs()}`);
    await Bun.write(REL, "go\n");
    two.proc.kill();
    await two.proc.exited;
    rmSync(REL, { force: true });
    for (const ln of capLanes) await post(`/api/slots/${ln.slot}/kill`, {});
  }

  up2.proc.kill();
  await up2.proc.exited;

  // ===== (HD.11) THE REMOTE HALF OF THE AUDIT-RED RAIL ==========================================
  // A red measured on the other machine is the SAME fact about the SAME tree as a red measured
  // here, so it must reach the Program whose land it covers through the same pointer. The two sinks
  // are different functions (runPostLandAudit / helperResult), and a rail wired into only one is
  // silently half a rail — the half no local test run would ever notice was missing. e2e/pins.ts
  // holds the call site textually (I8); this holds the BEHAVIOUR, end to end through a real claim.
  {
    const RPROG = "b2".repeat(12);
    const statePath = `${ROOT}/fleet.json`;
    interface RemotePlant {
      slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null; programId?: string | null }>;
      programs?: Record<string, unknown>[];
    }
    const remoteState = (): RemotePlant => JSON.parse(readFileSync(statePath, "utf8")) as RemotePlant;
    interface RemoteInbox { program?: string;
      entries?: { id: string; kind: string; ref: string; subject: Record<string, unknown> | null }[] }
    const remoteInbox = async (token: string): Promise<RemoteInbox> =>
      (await (await fetch(`${BASE}/api/self/inbox`, { headers: { "x-fleet-self-token": token } })).json()) as RemoteInbox;

    for (const s of ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots)
      if (s.cwd) await post(`/api/slots/${s.id}/kill`, {});
    await Bun.sleep(300);
    const rMain = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.find((s) => !s.cwd)?.id ?? 0;
    const rMainOpen = rMain ? await post(`/api/slots/${rMain}/open`, { cwd: REPO }) : null;
    const rLane = await openLane(REPO, "hd-remote-prog");
    await killSrv();
    const rPlant = remoteState();
    const rMainRow = rPlant.slots?.[String(rMain)] ?? {};
    const rBoundAt = Date.now() - 1000;
    rPlant.programs = [...(rPlant.programs ?? []), {
      id: RPROG, title: "Remote audit-red fixture", intent: "Receive the remote audit of its own land",
      successCriterion: "A helper-reported red reaches this program's inbox",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: rBoundAt - 300, proposedBy: { kind: "owner" },
      confirmedAt: rBoundAt - 200, activatedAt: rBoundAt - 100,
      main: { slot: rMain, openedAt: rMainRow.openedAt, sessionId: rMainRow.sessionId ?? null, boundAt: rBoundAt },
      lineage: { v: 1, entries: [{ slot: rMain, openedAt: rMainRow.openedAt, sessionId: rMainRow.sessionId ?? null,
        boundAt: rBoundAt, via: "bootstrap", endedAt: null, endedBy: null }], dropped: 0 },
    }];
    if (rPlant.slots?.[String(rLane.slot)]) rPlant.slots[String(rLane.slot)]!.programId = RPROG;
    writeFileSync(statePath, JSON.stringify(rPlant, null, 2), { mode: 0o600 });
    // FLEET_AUDIT_HELPER_GRACE_MS gives the portal first refusal on this repo's audit for 20 s, so
    // the job below is claimable without racing the local drain — the same knob e2e/helper-portal.ts
    // uses for the same fixture. The grace only arms while a device is inside the online window, so
    // the heartbeat below is a precondition of the fixture and not decoration.
    const rUp = await startSrv({ audit: true, auditPing: true,
      extra: { FLEET_AUDIT_HELPER_GRACE_MS: "20000" } });
    check("(HD.11) fixture: a Program bound to a plain session, one lane of it, the ping armed",
      rMainOpen?.ok === true && rUp, `open=${rMainOpen?.status} up=${rUp}`);
    const rToken = remoteState().slots?.[String(rMain)]?.selfToken ?? "";

    // Every red already open would compete for the one ping a tick delivers. Adjudication never
    // greens a row — it only takes it out of the candidate set, which is what this fixture needs.
    const settleReds = async (note: string): Promise<void> => {
      for (const prior of await auditRows())
        if (prior.result === "red")
          await post("/api/post-land-audits/adjudicate", { at: prior.at, verdict: "unknowable", note });
    };
    await settleReds("(HD.11) fixture: not this stage's subject");

    const rBeat = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });
    check("(HD.11) fixture: a device is inside the online window, so the portal's grace actually arms",
      rBeat.ok, `${rBeat.status}`);
    const rSince = Date.now();
    await driveMerge(rLane, rLane.branch);
    const rJob = await (async (): Promise<HelperJob | undefined> => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const j = await jobFor(REPO);
        if (j && !j.localRunning && !j.claim) return j;
        await Bun.sleep(200);
      }
      return await jobFor(REPO);
    })();
    const rClaim = rJob ? await hpost("/api/helper/claim", { jobId: rJob.id, deviceId: DEVICE }) : null;
    check("(HD.11) fixture: the Program's land is offered and claimed by a helper before the local drain takes it",
      rJob !== undefined && rClaim?.status === 200, `job=${JSON.stringify(rJob)} claim=${rClaim?.status}`);
    const rResult = rJob ? await hpost("/api/helper/result", { jobId: rJob.id, exitCode: 1,
      tail: "FAIL  remote program check\n1 FAILURES", fails: ["remote program check"] }) : null;
    // found by its REMOTE key, never by position: a row written by the local drain in the same
    // window would answer a positional read, and this check is about the helper's row alone.
    const rRow = (await auditRows()).find((x) => x.at >= rSince && x.remote !== undefined);
    const rEntries = ((await remoteInbox(rToken)).entries ?? []).filter((e) => e.kind === "audit-red");
    const rSubject = rEntries[0]?.subject as Record<string, unknown> | undefined;
    // BREAKS IF: writeAuditInboxEntries is called only from runPostLandAudit — the local path would
    // stay green and every remote red would silently go back to the quietest pane.
    check("(HD.11) A HELPER-REPORTED RED REACHES THE SAME INBOX: one audit-red pointer, the helper's own fail names in its subject",
      rResult?.status === 200 && rRow?.result === "red" && rRow.remote !== undefined
        && rEntries.length === 1 && rEntries[0]?.ref === String(rRow.at)
        && JSON.stringify(rSubject?.fails) === JSON.stringify(["remote program check"])
        && rSubject?.remote === true,
      JSON.stringify({ result: rRow?.result, entries: rEntries.length, subject: rSubject }).slice(0, 500));
    await Bun.sleep(1200); // several ping ticks
    const rPane = (await (await get(`/api/slots/${rMain}/history`)).json()) as { history?: { text: string }[] };
    const rPinged = (await auditRows()).find((x) => x.at === rRow?.at);
    check("(HD.11) …and the remote red types into no pane either: program-inbox, and the bound MAIN's history carries no audit ping",
      rPinged?.ping?.status === "program-inbox"
        && (rPinged.ping.lastResult ?? "").includes(RPROG)
        && !(rPane.history ?? []).some((e) => e.text.includes(`at=${rRow?.at}`)),
      JSON.stringify({ ping: rPinged?.ping, history: (rPane.history ?? []).length }));

    await settleReds("(HD.11) teardown");
    if (rMain) await post(`/api/slots/${rMain}/kill`, {});
    await killSrv();
    const rClean = remoteState();
    rClean.programs = (rClean.programs ?? []).filter((p) => (p as { id?: string }).id !== RPROG);
    writeFileSync(statePath, JSON.stringify(rClean, null, 2), { mode: 0o600 });
    check("(HD.11) teardown: the server is back on the wrapper's default ping configuration",
      await startSrv({ audit: true }));
  }

  proxy.stop(true);
  rmSync(WORK, { recursive: true, force: true });
  rmSync(UPD, { recursive: true, force: true });
}

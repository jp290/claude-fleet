// e2e for THE REMOTE HELPER PORTAL (server.ts, grep `handleHelperRoute`) — stage 1: a second
// machine takes a queued post-land audit off this one.
//
// WHY IT LIVES HERE and not in the main runner's e2e/ family list: every check below needs a server
// booted with FLEET_POSTLAND_AUDIT_CMD, because the portal's job list IS the tier-2 queue and that
// queue is unreachable without it (`schedulePostLandAudit` returns on an unset command). The main
// suite proves the DEFAULT-OFF behaviour and would have nothing to claim. So this module is a
// sibling of the postland harness's own sections, imported by it and staged with it — the stage
// rule derives the copy list from the imports, so no wrapper edit is involved.
//
// THE ONE INVARIANT UNDER TEST, in the owner's words: "es muss nur so aufgebaut sein dass wir am
// Ende wirklich Arbeit abnehmen, nicht dass irgendwas doppelt läuft". Every check is one half of it:
// the job LEAVES this machine (auth, claim, a bundle that really clones), it is NOT ALSO run here
// (the drain skip, the 409s, the restart), and it can never be LOST (the lapse and the fallback).
//
// THE FIXTURE THAT MAKES IT ALL POSSIBLE is the decoy repo. A queued job with an idle drain does
// not exist — the drain starts on the land that queued it — so a claimable job requires the drain
// to be busy ELSEWHERE. That is a second repo whose audit is in flight, and it is the reason this
// section seeds one instead of reusing the harness's.
import { spawnSync } from "node:child_process";
import { BASE, check, get, post } from "./harness";
import { driveMerge, openLane, seedRepo, type Lane } from "./lane-helpers";

interface HelperJob {
  id: string; repo: string; main: string; branches: string[]; covers: number; oldestAt: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface HelperJobs {
  claimTimeoutMs: number; configured: boolean; jobs: HelperJob[];
  lapsed: { id: string; repo: string; name: string; claimedAt: number; expiredAt: number; covers: number }[];
  device: { id: string; name: string } | null;
}
// The row shape this module asserts on. Deliberately its own copy rather than an import from the
// harness: what is being proven is that a REMOTE row carries `remote`, and a type that made the
// field mandatory would hide a server that never wrote it.
interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string };
}
interface LiveView {
  postLandAuditLive: { running: { repo: string | null; phase: string } | null } | null;
}

const DEVICE = "e2e0device01";        // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "e2e helper box";

export async function run(h: {
  REPO: string;
  setAuditMode: (m: string) => Promise<number>;
  killSrv: () => Promise<void>;
  startSrv: (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }) => Promise<boolean>;
  auditRows: () => Promise<Row[]>;
  headOf: (ref?: string) => string;
}): Promise<void> {
  const { REPO, setAuditMode, killSrv, startSrv, auditRows, headOf } = h;
  // the decoy: a second repo whose audit occupies the drain while the checks work on REPO's job
  const DECOY = `${REPO}-helperdecoy`;
  await seedRepo(DECOY);
  // Rows are matched by BASENAME, not by the path this module holds: the server records the git
  // TOPLEVEL as git resolves it, and on this box a scratch dir under /tmp answers /private/tmp — a
  // string compare would filter everything away and read as "no row", which is the same shape as
  // the failure these checks are looking for. Basenames are unique among the two repos here.
  const base = (p: string): string => p.split("/").pop() ?? p;
  const rowsFor = async (repo: string): Promise<Row[]> =>
    (await auditRows()).filter((r) => base(r.repo) === base(repo));
  // …and REPO already carries ~15 rows from the sections above, so every count here is RELATIVE to
  // what was on the trail when this section started. `auditRows` is newest-first, so the new rows
  // are the head of the list. Getting this wrong would not have failed loudly: `length === 0` would
  // simply never be true, and a wait for "one row" would have returned somebody else's instantly.
  const repoRowsAtStart = (await rowsFor(REPO)).length;
  const newRepoRows = async (): Promise<Row[]> => {
    const all = await rowsFor(REPO);
    return all.slice(0, Math.max(0, all.length - repoRowsAtStart));
  };
  const waitNewRepoRows = async (n: number, timeoutMs = 120_000): Promise<Row[]> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const rows = await newRepoRows();
      if (rows.length >= n || Date.now() >= deadline) return rows;
      await Bun.sleep(200);
    }
  };

  // token-carrying requests. The portal's own credential is read once through the OWNER route, the
  // same way the steward's is — that route is the only place it is ever handed out.
  const tokenRes = await get("/api/helper/token");
  const helperToken = ((await tokenRes.json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
  const hpost = (path: string, body: unknown): Promise<Response> =>
    post(path, body, { ...HH, "content-type": "application/json" });
  const jobs = async (): Promise<HelperJobs> => (await (await hget(`/api/helper/jobs?deviceId=${DEVICE}`)).json()) as HelperJobs;
  const jobFor = async (repo: string): Promise<HelperJob | undefined> =>
    (await jobs()).jobs.find((j) => j.repo === repo.split("/").pop());
  const liveRepo = async (): Promise<string | null> =>
    (((await (await get("/api/sessions")).json()) as LiveView).postLandAuditLive?.running?.repo) ?? null;
  // poll until the drain is demonstrably inside the decoy's run — never a sleep-then-look, which is
  // the shape of the pane flake this suite removed elsewhere
  const waitLocalRun = async (repo: string, timeoutMs = 60_000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await liveRepo()) === repo.split("/").pop()) return true;
      await Bun.sleep(150);
    }
    return false;
  };
  const waitNoLocalRun = async (timeoutMs = 90_000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await liveRepo()) === null) return true;
      await Bun.sleep(200);
    }
    return false;
  };
  const waitRowsFor = async (repo: string, n: number, timeoutMs = 90_000): Promise<Row[]> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const rows = await rowsFor(repo);
      if (rows.length >= n || Date.now() >= deadline) return rows;
      await Bun.sleep(200);
    }
  };

  // ===== (K.1) THE DOOR ==========================================================================
  // 401 for a caller with no credential and for one with the wrong credential — the same answer, on
  // purpose: telling those apart is the only thing a guesser learns from a distinct code, and the
  // owner gate above makes exactly the same choice for the same reason.
  check("(K) the portal has its own server-minted token, and it is NOT the owner token",
    /^[0-9a-f]{32}$/.test(helperToken) && tokenRes.ok, `${tokenRes.status} len=${helperToken.length}`);
  const noTok = await fetch(`${BASE}/helper`);
  const badTok = await fetch(`${BASE}/helper?token=${"0".repeat(32)}`);
  const badApi = await fetch(`${BASE}/api/helper/jobs`);
  check("(K) GET /helper without a token is refused",
    noTok.status === 401, `${noTok.status}`);
  check("(K) GET /helper with a WRONG token is refused",
    badTok.status === 401, `${badTok.status}`);
  check("(K) the job list is refused to an unauthenticated caller too — not just the page",
    badApi.status === 401, `${badApi.status}`);
  const page = await hget(`/helper`);
  const pageText = await page.text();
  check("(K) GET /helper with the helper token serves the self-contained portal page",
    page.ok && pageText.includes("Audit helper") && pageText.includes("/api/helper/claim")
      && !pageText.includes("<script src="),
    `${page.status} bytes=${pageText.length}`);
  const listRes = await hget(`/api/helper/jobs?deviceId=${DEVICE}`);
  const list0 = (await listRes.json()) as HelperJobs;
  check("(K) …and the same token lists the audit jobs",
    listRes.ok && Array.isArray(list0.jobs) && list0.configured === true, JSON.stringify(list0).slice(0, 200));
  // the token opens ONLY this handler. It is not a scope 403 but a plain 401, and that is the exact
  // mechanism: the portal's credential travels in its own header, which the owner gate's tokenFrom
  // does not read at all — so on an owner route it is not a wrong-scope credential, it is no
  // credential. Nothing the helper holds can be spent anywhere but the routes above.
  const outOfScope = await fetch(`${BASE}/api/sessions`, { headers: HH });
  check("(K) the helper token cannot reach an owner route",
    outOfScope.status === 401, `${outOfScope.status}`);

  // ===== (K.2) A CLAIMABLE JOB, AND THE 409s THAT REFUSE TO DUPLICATE WORK ========================
  // The decoy occupies the drain (25s), so the land that follows queues a job nothing is running.
  await setAuditMode("crash");
  const decoy1 = await openLane(DECOY, "decoyone");
  const decoy1Landed = await driveMerge(decoy1, decoy1.branch);
  check("(K) setup: the decoy repo's land reached its main and took the drain",
    decoy1Landed.gone && await waitLocalRun(DECOY),
    `${decoy1Landed.gone} live=${await liveRepo()}`);
  await setAuditMode("green"); // the RUNNING stand-in already read its mode; every later run is fast
  const takeMe: Lane = await openLane(REPO, "takeme");
  const takeMeLanded = await driveMerge(takeMe, takeMe.branch);
  const takeMeSha = headOf();
  const queued = await jobFor(REPO);
  check("(K) a land queued while the drain is busy elsewhere shows up as an OPEN portal job",
    takeMeLanded.gone && !!queued && queued.claim === null && queued.localRunning === false
      && queued.branches.includes(takeMe.branch),
    JSON.stringify(queued));
  const decoyJob = await jobFor(DECOY);
  check("(K) the job the local drain is running says so, and refuses the claim",
    decoyJob?.localRunning === true, JSON.stringify(decoyJob));
  const claimBusy = decoyJob ? await hpost("/api/helper/claim", { jobId: decoyJob.id, deviceId: DEVICE }) : null;
  check("(K) claiming a tree the local drain is auditing is a 409, not a second run",
    claimBusy?.status === 409, `${claimBusy?.status} ${JSON.stringify(await claimBusy?.json())}`);

  // the device names itself, and the fleet keeps the name
  const named = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });
  check("(K) a device sets its own name and the SERVER stores it",
    named.ok && ((await named.json()) as { device: { name: string } }).device.name === DEVICE_NAME
      && (await jobs()).device?.name === DEVICE_NAME, `${named.status}`);

  const claimRes = await hpost("/api/helper/claim", { jobId: queued?.id ?? "", deviceId: DEVICE });
  const claim = (await claimRes.json()) as {
    job?: { id: string; mainSha: string; covers: number; name: string; claimedAt: number; expiresAt: number };
    error?: string };
  check("(K) the claim is granted, names the exact tree it hands over, and carries the device name",
    claimRes.ok && claim.job?.mainSha === takeMeSha && claim.job.covers === 1 && claim.job.name === DEVICE_NAME,
    `${claimRes.status} ${JSON.stringify(claim)}`);
  const claimAgain = await hpost("/api/helper/claim", { jobId: queued?.id ?? "", deviceId: DEVICE });
  check("(K) claiming an already-claimed job is a 409 — even for the device that holds it",
    claimAgain.status === 409, `${claimAgain.status} ${JSON.stringify(await claimAgain.json())}`);

  // ===== (K.3) THE TRANSPORT IS REAL ============================================================
  // A 200 with bytes proves nothing about whether the other machine can WORK. The bundle is written
  // out and cloned, and the clone's HEAD is compared with the sha the claim named: that is the whole
  // promise of the download in one assertion.
  const bundleRes = await hget(`/api/helper/bundle/${queued?.id ?? ""}`);
  const bytes = new Uint8Array(await bundleRes.arrayBuffer());
  const bundlePath = `${DECOY}-downloaded.bundle`;
  const clonePath = `${DECOY}-clone`;
  await Bun.write(bundlePath, bytes);
  spawnSync("rm", ["-rf", clonePath]);
  const cloned = spawnSync("git", ["clone", "-q", bundlePath, clonePath]);
  const cloneHead = spawnSync("git", ["-C", clonePath, "rev-parse", "HEAD"]).stdout.toString().trim();
  check("(K) the bundle downloads and clones into exactly the tree the claim named",
    bundleRes.ok && bytes.length > 0 && cloned.status === 0 && cloneHead === takeMeSha,
    `status=${bundleRes.status} bytes=${bytes.length} clone=${cloned.status} head=${cloneHead} want=${takeMeSha}`);
  check("(K) the cloned tree really carries the landed lane's work",
    spawnSync("git", ["-C", clonePath, "log", "--oneline"]).stdout.toString().includes("takeme lane work"),
    spawnSync("git", ["-C", clonePath, "log", "--oneline", "-3"]).stdout.toString().trim());

  // ===== (K.4) THE LOCAL DRAIN SKIPS IT — the invariant, measured ================================
  // The decoy finishes, the drain looks for its next entry, and the claimed one must not be it. The
  // assertion is the ABSENCE of a row for REPO after the drain has demonstrably gone idle, which is
  // the only way "it was skipped" is distinguishable from "it has not got there yet".
  const decoyRows = await waitRowsFor(DECOY, 1);
  check("(K) setup: the decoy's own audit finished (so the drain moved on)",
    decoyRows.length === 1, JSON.stringify(decoyRows.map((r) => r.result)));
  check("(K) the drain goes idle instead of picking up the claimed job", await waitNoLocalRun());
  await Bun.sleep(2000); // give a (wrong) local run time to appear before asserting there is none
  check("(K) THE CLAIMED AUDIT IS NOT ALSO RUN HERE — no local row for the claimed tree",
    (await newRepoRows()).length === 0 && (await liveRepo()) === null,
    JSON.stringify((await newRepoRows()).map((r) => `${r.result}@${r.mainSha.slice(0, 8)}`)));
  const stillClaimed = await jobFor(REPO);
  check("(K) …and the job is still visibly held, not quietly gone",
    stillClaimed?.claim?.name === DEVICE_NAME, JSON.stringify(stillClaimed));

  // A CLAIM MUST SURVIVE A RESTART. This is the deploy ritual on this box (land, then
  // `kill-session -t srv`, ~10× a day): a claim that lived only in memory would be erased by the
  // most routine thing the machine does, the boot-time drain would take the tree, and the helper —
  // still running the suite — would report into a fleet that had already audited it. That is the
  // duplicate run, arriving through the back door.
  await killSrv();
  check("(K) the server restarts over the live claim", await startSrv({ audit: true, auditPing: true }));
  await Bun.sleep(2500);
  const afterRestart = await jobFor(REPO);
  check("(K) the claim survives the restart, with its device name and its deadline",
    afterRestart?.claim?.name === DEVICE_NAME && (afterRestart?.claim?.expiresAt ?? 0) === (claim.job?.expiresAt ?? -1),
    JSON.stringify(afterRestart));
  check("(K) …and the boot-time drain does not audit it either",
    (await newRepoRows()).length === 0, JSON.stringify((await newRepoRows()).map((r) => r.result)));

  // ===== (K.5) THE RESULT COMES BACK ============================================================
  const TRAIL = "isolated-20260826T0700Z-4242";
  const resultRes = await hpost("/api/helper/result", {
    jobId: queued?.id ?? "", exitCode: 0, trail: TRAIL,
    tail: "PASS  a remote check\nPASS  another remote check\nALL PASS",
  });
  check("(K) the result POST is accepted and reports the verdict it wrote",
    resultRes.ok && ((await resultRes.json()) as { result: string }).result === "green", `${resultRes.status}`);
  const remoteRows = await waitNewRepoRows(1);
  const remote = remoteRows[0];
  check("(K) the ledger row lands on the SAME trail, green, against the tree that was handed over",
    remoteRows.length === 1 && remote?.result === "green" && remote.mainSha === takeMeSha
      && remote.exitCode === 0 && remote.covers.some((c) => c.branch === takeMe.branch),
    JSON.stringify(remote).slice(0, 300));
  const mark = remote?.remote;
  check("(K) …and it is MARKED remote: the device name, both timestamps and the trail id",
    mark?.name === DEVICE_NAME && mark.claimedAt === claim.job?.claimedAt
      && mark.reportedAt >= mark.claimedAt && mark.trail === TRAIL,
    JSON.stringify(mark));
  check("(K) the row's checks are counted from the tail the helper actually sent",
    remote?.checks?.ran === 2 && remote.checks.failed === 0, JSON.stringify(remote?.checks));
  check("(K) the row NAMES the remote command rather than quoting this machine's audit command",
    remote?.cmd.includes("remote helper") === true && remote.cmd.includes(DEVICE_NAME), remote?.cmd);
  check("(K) reporting released the claim and emptied the job from the portal",
    !(await jobFor(REPO)), JSON.stringify((await jobs()).jobs));
  const lateReport = await hpost("/api/helper/result", { jobId: queued?.id ?? "", exitCode: 0, tail: "ALL PASS" });
  check("(K) a second result for the same job is refused — one job, one row",
    lateReport.status === 409, `${lateReport.status}`);

  // ===== (K.6) THE MACHINE DISAPPEARS ==========================================================
  // Same fixture, a claim timeout of seconds, and nothing reported. The job must come back to the
  // local drain and the lapse must be BOOKED — "nie stilles Grün, nie unknown durch bloßes Warten".
  await killSrv();
  check("(K) the server restarts with a seconds-long claim timeout",
    await startSrv({ audit: true, auditPing: true,
      extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "6000", FLEET_HELPER_SWEEP_MS: "1000" } }));
  await Bun.sleep(1500);
  await setAuditMode("crash");
  const decoy2 = await openLane(DECOY, "decoytwo");
  await driveMerge(decoy2, decoy2.branch);
  check("(K) setup: the decoy takes the drain a second time", await waitLocalRun(DECOY));
  await setAuditMode("green");
  const lapseMe = await openLane(REPO, "lapseme");
  await driveMerge(lapseMe, lapseMe.branch);
  const lapseJob = await jobFor(REPO);
  const lapseClaim = lapseJob ? await hpost("/api/helper/claim", { jobId: lapseJob.id, deviceId: DEVICE }) : null;
  check("(K) setup: the second job is claimed under the short timeout",
    lapseClaim?.ok === true && (await jobFor(REPO))?.claim?.name === DEVICE_NAME,
    `${lapseClaim?.status}`);
  // …and now the helper simply never comes back.
  await Bun.sleep(9000); // past the 6s deadline, past two 1s sweeps
  const afterLapse = await jobs();
  check("(K) the lapse is BOOKED — the claim is recorded as expired, with its device and its size",
    afterLapse.lapsed.some((l) => l.id === lapseJob?.id && l.name === DEVICE_NAME && l.covers === 1
      && l.expiredAt >= l.claimedAt),
    JSON.stringify(afterLapse.lapsed).slice(0, 300));
  // open again, or already consumed by the drain that took it back — both are the same fact, and
  // which one is observed depends only on how fast the decoy's 25s run ended
  const reopened = await jobFor(REPO);
  check("(K) …and the job is open again rather than held by a machine that is gone",
    !reopened || reopened.claim === null, JSON.stringify(reopened));
  const lapsedReport = await hpost("/api/helper/result", { jobId: lapseJob?.id ?? "", exitCode: 0, tail: "ALL PASS" });
  check("(K) a verdict arriving after the claim lapsed is refused — the job is the drain's again",
    lapsedReport.status === 409, `${lapsedReport.status} ${JSON.stringify(await lapsedReport.json())}`);
  // THE FALLBACK ITSELF: a LOCAL row, with no `remote` field on it.
  const fellBack = await waitNewRepoRows(2);
  const local = fellBack.find((r) => !r.remote);
  check("(K) THE ABANDONED JOB IS AUDITED HERE AFTER ALL — a local row, unmarked, for the same tree",
    fellBack.length === 2 && !!local && local.result === "green"
      && local.covers.some((c) => c.branch === lapseMe.branch),
    JSON.stringify(fellBack.map((r) => `${r.result}${r.remote ? `/remote:${r.remote.name}` : "/local"}`)));
  check("(K) the queue is empty again — nothing was left holding a job nobody runs",
    (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
}

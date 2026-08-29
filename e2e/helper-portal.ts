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
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  oldestAt: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
}
interface HelperJobs {
  claimTimeoutMs: number; configured: boolean; jobs: HelperJob[];
  lapsed: { id: string; repo: string; name: string; claimedAt: number; expiredAt: number; covers: number }[];
  device: DeviceView | null;
}
// The register row as the wire carries it (stage A). Every field past `lastSeen` is optional here
// for the same reason it is optional on the server: an old row and a device that reports nothing
// are both ordinary.
interface DeviceView {
  id: string; name: string; lastSeen: number;
  mode?: string; load?: number; capabilities?: string[]; desiredMode?: string;
}
// The OWNER's projection of the same register (server.ts#helperDevicesView), carried on the 2 s
// poll and shaped differently on purpose: it holds the two JOINS the helper's own view has no
// business seeing — which claims that device holds RIGHT NOW and how often it has dropped one —
// and a desiredMode that is RESOLVED (the string the daemon pulls), with `desiredSet` saying
// whether an owner ever decided it. Non-optional here where the server always sends it: this type
// is the contract under test, so a field the server stopped sending must fail a check, not degrade.
interface OwnerDeviceView {
  id: string; name: string; lastSeen: number;
  mode?: string; load?: number; capabilities?: string[];
  desiredMode: string; desiredSet: boolean;
  claims: { kind: string; repo: string; ref: string; expiresAt: number }[];
  lapses: number;
}
// The row shape this module asserts on. Deliberately its own copy rather than an import from the
// harness: what is being proven is that a REMOTE row carries `remote`, and a type that made the
// field mandatory would hide a server that never wrote it.
interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string; clonedSha?: string };
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
  // the OWNER's poll — the board's only source for the device panel. `undefined` is a fact, not a
  // read failure: the server omits the field entirely while no device has ever registered.
  const ownerDevices = async (): Promise<OwnerDeviceView[] | undefined> =>
    ((await (await get("/api/sessions")).json()) as { helperDevices?: OwnerDeviceView[] }).helperDevices;
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
  // …and it is the repo's page shape, not a self-contained one: markup here, every line of client
  // code in src/ behind a bundle reference. fleet-e2e-security.ts §7 asserts that as a property of
  // the whole public/ directory ("no HTML sink, no inline script"), because the XSS rule it
  // protects is checked by scanning src/ — a page carrying its own script would be code that scan
  // never sees. This check is the same statement from the serving side.
  check("(K) GET /helper with the helper token serves the portal page, script bundled not inline",
    page.ok && pageText.includes("Fleet helper") && pageText.includes(`<script src="/helper.js">`)
      && !/<script(?![^>]*\bsrc=)/.test(pageText),
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
  // …and the owner's own poll, before any device exists: the register field is ABSENT, not an empty
  // array. This is the byte rule /api/sessions is held to (docs/data-saver.md §1) and it is also
  // the client's contract — the board draws no device panel at all in this state.
  check("(K) with no device ever registered, the owner poll carries no device field at all",
    (await ownerDevices()) === undefined, JSON.stringify(await ownerDevices()));

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
  // …and it is marked as the kind it is. The portal grew a SECOND source (a lane offering its own
  // preview suite — e2e/lane-suite.ts, which cannot create an audit job and so cannot assert this
  // half). `kind` is what keeps the two apart on one list, and an audit job losing its label would
  // send a helper a bootstrap that clones the wrong way.
  check("(K) an audit job is labelled kind:'audit' — the field that keeps two sources on one list",
    queued?.kind === "audit", JSON.stringify({ kind: queued?.kind, covers: queued?.covers }));
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

  // ===== (K.2b) THE DEVICE REGISTER, STAGE A: reported mode in, owner's WISH out =================
  // One route, two directions, and the asymmetry is the whole design. The device reports what it is
  // doing; the reply tells it what the owner wants of it. Nothing here is a dispatch — this fleet
  // never opens a connection towards the other machine, so a wish can only ever travel as the reply
  // to a heartbeat the device itself sent. A device that stops polling therefore stops learning,
  // and degrades exactly the way a dead daemon degrades today: its claim lapses.
  const beat1 = await hpost("/api/helper/device",
    { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 1.25, capabilities: ["bun", "tmux"] });
  const beat1Body = (await beat1.json()) as { device?: DeviceView; desiredMode?: string };
  check("(K) a heartbeat's mode/load/capabilities are stored, and the reply carries the wish-mode",
    beat1.ok && beat1Body.device?.mode === "active" && beat1Body.device.load === 1.25
      && JSON.stringify(beat1Body.device.capabilities) === '["bun","tmux"]'
      && beat1Body.desiredMode === "active" && beat1Body.device.desiredMode === undefined,
    `${beat1.status} ${JSON.stringify(beat1Body)}`);
  // …and the two refusals. A mode outside the closed set is a version skew on one side or the
  // other, and storing the string would leave the board showing a mode nothing can act on.
  const beatBad = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "turbo" });
  check("(K) should-reject: a device reporting a mode outside the closed set is a 400, not a stored string",
    beatBad.status === 400 && (await jobs()).device?.mode === "active",
    `${beatBad.status} ${JSON.stringify((await jobs()).device)}`);
  const wishBad = await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "sleepy" });
  check("(K) should-reject: the owner cannot set a wish-mode outside the closed set either",
    wishBad.status === 400, `${wishBad.status} ${JSON.stringify(await wishBad.json())}`);
  const wishNobody = await post("/api/helper/devices/e2enosuchdev/mode", { mode: "off" });
  check("(K) should-reject: a wish for a device that has never reported is a 404, not a row invented here",
    wishNobody.status === 404, `${wishNobody.status}`);
  // THE SCOPE LINE. The wish is the OWNER's field: the helper principal reads it and can never
  // write it. The route sits below the owner gate beside /api/helper/token, so handleHelperRoute's
  // exact-match perimeter does not name it — and the portal's credential travels in a header the
  // owner gate does not read at all, which is why this is a plain 401 and not a scope 403.
  const helperWish = await hpost(`/api/helper/devices/${DEVICE}/mode`, { mode: "off" });
  check("(K) the helper principal cannot set the wish-mode — that route is not in its scope",
    helperWish.status === 401 && (await jobs()).device?.desiredMode === undefined,
    `${helperWish.status} ${JSON.stringify((await jobs()).device)}`);
  const wish = await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "quiet" });
  check("(K) the OWNER sets the wish-mode and the value is only STORED — no dispatch, no claim touched",
    wish.ok && ((await wish.json()) as { device: DeviceView }).device.desiredMode === "quiet"
      && (await jobFor(REPO))?.claim === null,
    `${wish.status}`);
  // …and only now, on the device's own next heartbeat, does it find out.
  const beat2 = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "quiet" });
  const beat2Body = (await beat2.json()) as { device?: DeviceView; desiredMode?: string };
  check("(K) …and the device PULLS the owner's wish on its next heartbeat",
    beat2.ok && beat2Body.desiredMode === "quiet" && beat2Body.device?.desiredMode === "quiet",
    `${beat2.status} ${JSON.stringify(beat2Body)}`);
  // THE COMPATIBILITY HALF. A daemon built before stage A sends deviceId+name and nothing else. It
  // must keep working, keep its old reply shape — and it must not ERASE the register, which is the
  // failure a rebuilt-from-scratch row would produce.
  const legacy = await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });
  const legacyBody = (await legacy.json()) as { device?: DeviceView; desiredMode?: string };
  check("(K) a pre-stage-A device POST still works, keeps its old reply shape, and erases nothing",
    legacy.ok && legacyBody.device?.id === DEVICE && legacyBody.device.name === DEVICE_NAME
      && typeof legacyBody.device.lastSeen === "number"
      && legacyBody.device.mode === "quiet" && legacyBody.device.desiredMode === "quiet"
      && legacyBody.device.load === 1.25,
    `${legacy.status} ${JSON.stringify(legacyBody)}`);

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
  // A claim TOUCHES lastSeen through the same writer the heartbeat uses. Before stage A that writer
  // rebuilt the row from scratch, which would now drop the owner's wish every time a device took a
  // job — the register would be correct until the first moment it mattered.
  const afterClaim = (await jobs()).device;
  check("(K) …and a claim's lastSeen touch does not erase the register's mode fields",
    afterClaim?.desiredMode === "quiet" && afterClaim.mode === "quiet" && afterClaim.load === 1.25,
    JSON.stringify(afterClaim));

  // ===== (K.2c) THE SAME REGISTER, AS THE OWNER'S BOARD SEES IT =================================
  // The device panel reads the 2 s poll and nothing else, so what the poll carries IS the panel's
  // contract. Two of these fields exist nowhere on a HelperDevice row — the held claim and the
  // lapse count are joins over helperClaims/laneSuiteJobs and the lapse ledger — and asserting
  // them here is what keeps that join out of the client, where it would be a second implementation
  // of fleet semantics against a payload it cannot verify.
  const owned = (await ownerDevices()) ?? [];
  const mine = owned.find((d) => d.id === DEVICE);
  check("(K) the owner poll carries the register: name, beat, reported mode and the owner's wish",
    owned.length === 1 && mine?.name === DEVICE_NAME && typeof mine.lastSeen === "number"
      && mine.lastSeen > 0 && mine.mode === "quiet" && mine.load === 1.25
      && JSON.stringify(mine.capabilities) === '["bun","tmux"]'
      && mine.desiredMode === "quiet" && mine.desiredSet === true,
    JSON.stringify(owned));
  // THE JOIN, and the reason it is server-side: the panel says "holds an audit of <repo> <branch>,
  // Nm left" while the helper's own view says only that the JOB is claimed. The expiry is the same
  // number the claim named — read through helperClaimOf, so an expired claim would be absent here
  // without waiting for the sweep.
  check("(K) …and the claim this device is holding right now, with the job's own deadline",
    mine?.claims.length === 1 && mine.claims[0]?.kind === "audit"
      && mine.claims[0]?.repo === "testrepo" && mine.claims[0]?.expiresAt === claim.job?.expiresAt,
    JSON.stringify(mine?.claims));
  check("(K) …and a device that has never dropped a job counts ZERO lapses, not an absent field",
    mine?.lapses === 0, JSON.stringify({ lapses: mine?.lapses }));

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
  const afterBoot = (await jobs()).device;
  check("(K) …and so does the device register: an owner's wish and a reported mode survive the boot",
    afterBoot?.desiredMode === "quiet" && afterBoot.mode === "quiet"
      && JSON.stringify(afterBoot.capabilities) === '["bun","tmux"]',
    JSON.stringify(afterBoot));
  check("(K) …and the boot-time drain does not audit it either",
    (await newRepoRows()).length === 0, JSON.stringify((await newRepoRows()).map((r) => r.result)));

  // ===== (K.5) THE RESULT COMES BACK ============================================================
  const TRAIL = "isolated-20260826T0700Z-4242";
  const resultRes = await hpost("/api/helper/result", {
    jobId: queued?.id ?? "", exitCode: 0, trail: TRAIL,
    tail: "PASS  a remote check\nPASS  another remote check\nALL PASS",
    // the sha this suite really checked the bundle out to, up at (K)'s clone probe — the field a
    // daemon fills with its own `git rev-parse HEAD`
    clonedSha: cloneHead,
  });
  check("(K) the result POST is accepted and reports the verdict it wrote",
    resultRes.ok && ((await resultRes.json()) as { result: string }).result === "green", `${resultRes.status}`);
  const remoteRows = await waitNewRepoRows(1);
  const remote = remoteRows[0];
  // THE POSITIVE CONTROL for the split e2e/lane-suite.ts asserts from the other side: an AUDIT
  // report adds exactly one row to post-land-audits.jsonl. Its twin over there asserts a preview
  // report adds NONE. Neither statement means anything without the other — "the ledger did not
  // move" is also what a helperResult that silently wrote nowhere would produce.
  check("(K) …and the audit report added EXACTLY ONE ledger row (the control for the preview's zero)",
    remoteRows.length === 1, `${remoteRows.length} new row(s) for this repo`);
  check("(K) the ledger row lands on the SAME trail, green, against the tree that was handed over",
    remoteRows.length === 1 && remote?.result === "green" && remote.mainSha === takeMeSha
      && remote.exitCode === 0 && remote.covers.some((c) => c.branch === takeMe.branch),
    JSON.stringify(remote).slice(0, 300));
  const mark = remote?.remote;
  check("(K) …and it is MARKED remote: the device name, both timestamps and the trail id",
    mark?.name === DEVICE_NAME && mark.claimedAt === claim.job?.claimedAt
      && mark.reportedAt >= mark.claimedAt && mark.trail === TRAIL,
    JSON.stringify(mark));
  // The server side of the 2026-08-29 class-fix: what the helper says it RAN is kept apart from
  // what this machine says it HANDED OVER, and both are on the row. Only their coexistence makes a
  // remote red adjudicable; `mainSha` alone never could, because it is this server's own reading of
  // a bundle header and says nothing about what the other machine did with it.
  check("(K) …and the row keeps the helper's own clone sha BESIDE the sha this machine handed over",
    mark?.clonedSha === cloneHead && cloneHead === takeMeSha && remote?.mainSha === takeMeSha,
    `cloned=${mark?.clonedSha ?? "ABSENT"} mainSha=${remote?.mainSha} cloneHead=${cloneHead}`);
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
  // …and the owner's board learns the same thing through its own poll: the counter is what makes a
  // helper that repeatedly takes work and vanishes visible as a PATTERN, and the claim it was
  // holding is gone from the row the moment it expired.
  const afterLapseOwner = (await ownerDevices())?.find((d) => d.id === DEVICE);
  check("(K) …and the owner poll counts the lapse against THAT device and drops its claim",
    (afterLapseOwner?.lapses ?? 0) >= 1 && afterLapseOwner?.claims.length === 0,
    JSON.stringify(afterLapseOwner));
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
  await waitNoLocalRun();
  await Bun.sleep(2500); // a THIRD row would arrive after the second — wait for it before counting
  const settled = await newRepoRows();
  const local = settled.find((r) => !r.remote && r.covers.some((c) => c.branch === lapseMe.branch));
  check("(K) THE ABANDONED JOB IS AUDITED HERE AFTER ALL — a local row, unmarked, for the same tree",
    fellBack.length === 2 && !!local && local.result === "green",
    JSON.stringify(settled.map((r) => `${r.result}${r.remote ? `/remote:${r.remote.name}` : "/local"}`)));
  // …and the whole section in one line. Two trees were handed to two different auditors; each must
  // have been measured EXACTLY ONCE. A tip appearing twice is the duplicate run, whichever way it
  // got there — and this states it as a property of the ledger rather than of any one code path.
  const shas = settled.map((r) => r.mainSha);
  check("(K) NOTHING RAN TWICE — every tip audited in this section carries exactly one row",
    settled.length === 2 && new Set(shas).size === shas.length,
    JSON.stringify(settled.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`)));
  check("(K) the queue is empty again — nothing was left holding a job nobody runs",
    (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));

  // ===== (K.7) THE PORTAL'S RIGHT OF FIRST REFUSAL — FLEET_AUDIT_HELPER_GRACE_MS ================
  // Everything above needed the DECOY to exist at all: a land kicks the drain synchronously, so an
  // audit job is this box's before the other machine's 15 s poll has ever seen it. Measured
  // 2026-08-29 (docs/messungen/second-host-baseline-2026-08-29.md) — a helper could not take one
  // fleet audit in live operation. The grace is the owner's answer: for that long the drain leaves
  // a fresh entry alone, IF a machine that could actually claim it is standing there.
  //
  // Four checks, and they are one statement split four ways: the grace HOLDS (1), the grace never
  // STARVES (2), the default is untouched (3), and it never holds for a machine that cannot take
  // the work (4). Each of the last three changes exactly ONE variable against the first.
  const GRACE_MS = 8000;
  await killSrv();
  check("(K7) setup: the server restarts with a grace, and a claim timeout a claim fits inside",
    await startSrv({ audit: true, extra: { FLEET_AUDIT_HELPER_GRACE_MS: String(GRACE_MS),
      FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000" } }));
  await Bun.sleep(750);
  await setAuditMode("green");
  // THE PRECONDITION, set rather than assumed: the register came back from disk carrying (K.2b)'s
  // quiet on both halves, and a grace that never engages would make every check below pass for the
  // wrong reason — "the drain took it" is also what a correct grace does when nobody can claim.
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const beatOn = await hpost("/api/helper/device",
    { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
  check("(K7) setup: a live device that says active, under an owner's wish of active",
    beatOn.ok && ((await beatOn.json()) as { desiredMode?: string }).desiredMode === "active"
      && (await jobs()).device?.mode === "active",
    `${beatOn.status} ${JSON.stringify((await jobs()).device)}`);

  // (1) THE GRACE HOLDS. No decoy anywhere — this is the case that was unreachable before.
  const rowsBeforeGrace = (await newRepoRows()).length;
  const graceLane = await openLane(REPO, "graceme");
  const graceLanded = await driveMerge(graceLane, graceLane.branch);
  const graceSha = headOf();
  await Bun.sleep(2500); // a (wrong) local run has had 2.5s of an 8s grace in which to appear
  const graceJob = await jobFor(REPO);
  check("(K7) WITH A LIVE HELPER, THE DRAIN LEAVES A FRESH JOB ALONE — no decoy, nothing running",
    graceLanded.gone && !!graceJob && graceJob.claim === null && graceJob.localRunning === false
      && (await liveRepo()) === null && (await newRepoRows()).length === rowsBeforeGrace,
    `${JSON.stringify(graceJob)} live=${await liveRepo()} rows=${(await newRepoRows()).length}/${rowsBeforeGrace}`);
  const graceClaim = graceJob ? await hpost("/api/helper/claim", { jobId: graceJob.id, deviceId: DEVICE }) : null;
  const graceBody = (await graceClaim?.json()) as { job?: { mainSha: string } } | undefined;
  check("(K7) …and the helper CLAIMS it inside the grace, on the tree that just landed",
    graceClaim?.ok === true && graceBody?.job?.mainSha === graceSha,
    `${graceClaim?.status} ${JSON.stringify(graceBody)} want=${graceSha}`);
  const graceReport = await hpost("/api/helper/result",
    { jobId: graceJob?.id ?? "", exitCode: 0, tail: "PASS  remote under grace\nALL PASS" });
  const graceRows = await waitNewRepoRows(rowsBeforeGrace + 1);
  check("(K7) …and the whole loop closes: one REMOTE row for that tree, and no local twin",
    graceReport.ok && graceRows.filter((r) => r.mainSha === graceSha).length === 1
      && graceRows.find((r) => r.mainSha === graceSha)?.remote?.name === DEVICE_NAME,
    `${graceReport.status} ${JSON.stringify(graceRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

  // (2) THE GRACE NEVER STARVES. Nobody claims this one, and NOTHING ELSE would ever wake the
  // drain: the land's own kick already happened, and the only other kicks in the server are a claim
  // lapsing and a helper reporting — neither of which occurs here. So the row below can only exist
  // because the skip armed its own return (armAuditGraceKick). That is what this check measures.
  const rowsBeforeFall = (await newRepoRows()).length;
  const fallLane = await openLane(REPO, "gracefall");
  await driveMerge(fallLane, fallLane.branch);
  const fallSha = headOf();
  const landedAt = Date.now();
  await Bun.sleep(2500);
  const stillOpen = await jobFor(REPO);
  check("(K7) setup: 2.5s in, the unclaimed job is still open and still un-audited here",
    !!stillOpen && stillOpen.claim === null && stillOpen.localRunning === false
      && (await newRepoRows()).length === rowsBeforeFall,
    JSON.stringify(stillOpen));
  const fallRows = await waitNewRepoRows(rowsBeforeFall + 1, 60_000);
  const fellBackRow = fallRows.find((r) => r.mainSha === fallSha);
  check("(K7) NOTHING STARVES: the grace lapses and the LOCAL drain takes the job after all",
    !!fellBackRow && !fellBackRow.remote && fellBackRow.result === "green"
      && fellBackRow.covers.some((c) => c.branch === fallLane.branch),
    `after ${Date.now() - landedAt}ms ${JSON.stringify(fellBackRow).slice(0, 220)}`);
  await waitNoLocalRun();

  // (4) NO CLAIM-CAPABLE DEVICE, SAME GRACE. One variable changed against (1): the owner's wish.
  // A grace held for a machine that would refuse the job is pure delay on this box's own work.
  const wishOff = await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "off" });
  check("(K7) setup: the only device is wished OFF — nothing here could claim now",
    wishOff.ok && ((await wishOff.json()) as { device: DeviceView }).device.desiredMode === "off",
    `${wishOff.status}`);
  const rowsBeforeOff = (await newRepoRows()).length;
  const offLane = await openLane(REPO, "nohelper");
  await driveMerge(offLane, offLane.branch);
  const offSha = headOf();
  const offLandedAt = Date.now();
  const offRows = await waitNewRepoRows(rowsBeforeOff + 1, 60_000);
  const offElapsed = Date.now() - offLandedAt;
  check("(K7) with NO claim-capable device the grace does not apply — the drain takes it at once",
    offRows.some((r) => r.mainSha === offSha && !r.remote) && offElapsed < GRACE_MS,
    `row after ${offElapsed}ms, grace ${GRACE_MS}ms`);

  // (3) THE DEFAULT. Grace unset, and the live helper from (1) put back exactly as it was — the one
  // variable that differs is the env key itself. This is the "byte for byte" half of the contract.
  await killSrv();
  check("(K7) setup: the server restarts WITHOUT the grace key",
    await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000",
      FLEET_HELPER_SWEEP_MS: "15000" } }));
  await Bun.sleep(750);
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const beatBack = await hpost("/api/helper/device",
    { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
  check("(K7) setup: the same live, claim-capable device is back",
    beatBack.ok && ((await beatBack.json()) as { desiredMode?: string }).desiredMode === "active",
    `${beatBack.status}`);
  await setAuditMode("slow"); // 6s — the default takes the tree instantly, so give it a visible run
  const nowLane = await openLane(REPO, "defaultnow");
  await driveMerge(nowLane, nowLane.branch);
  check("(K7) GRACE UNSET IS TODAY'S BEHAVIOUR: the drain takes the tree at once, helper or not",
    await waitLocalRun(REPO, 5000), `live=${await liveRepo()}`);
  const nowJob = await jobFor(REPO);
  const nowClaim = nowJob ? await hpost("/api/helper/claim", { jobId: nowJob.id, deviceId: DEVICE }) : null;
  check("(K7) …and the claim is refused with the 409 it has always been refused with",
    nowJob?.localRunning === true && nowClaim?.status === 409,
    `${JSON.stringify(nowJob)} ${nowClaim?.status} ${JSON.stringify(await nowClaim?.json())}`);
  await setAuditMode("green");
  check("(K7) …and that run finished, leaving the queue empty for whatever follows",
    await waitNoLocalRun() && (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
}

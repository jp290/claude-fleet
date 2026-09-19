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
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { BASE, ROOT, check, get, post } from "./harness";
import { driveMerge, openLane, seedRepo, type Lane } from "./lane-helpers";
import { laneSuiteWatchMessage } from "../lane-signals";

interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  oldestAt: number;
  claim: { name: string; claimedAt: number; expiresAt: number } | null; localRunning: boolean;
  shard?: string; // `k/n` on a sharded audit job (K11) and on nothing else
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
  // the wake rail. `wakeConfigured` is mandatory here for the same reason `desiredSet` is: the
  // server always sends it, so a server that stopped must fail a check rather than degrade into
  // "the board draws no button". `lastWakeAt` is optional because "never woken" is a real state.
  wakeConfigured: boolean;
  lastWakeAt?: number;
  // the capacity pair, and OPTIONAL here where the two above are not: the server ships it only for
  // a device that reported it, and "this machine never said" is the state a browser on the portal
  // page is permanently in
  maxParallelSuites?: number;
  running?: number;
}
// the lane's own scoped credential, read out of the persisted state — the same poll-for-the-shape
// helper e2e/lane-suite.ts keeps, and for the same reason: openSlot queues the save before it
// awaits the pane spawn, so the file can carry the token a hair after the route would answer.
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}
// The row shape this module asserts on. Deliberately its own copy rather than an import from the
// harness: what is being proven is that a REMOTE row carries `remote`, and a type that made the
// field mandatory would hide a server that never wrote it.
interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; exitCode: number | null; out: string; checks?: { ran: number; failed: number } | null;
  // WHEN THE RUN STARTED, and the cover's own `at` beside it — the pair (K7d) subtracts. Both are
  // written on every row, so both are mandatory here: a server that stopped writing one must fail
  // that named check rather than have this module read `undefined` as a zero-length wait.
  startedAt: number;
  // which command measured the tree, in the audit's own vocabulary — `proportional` is the short
  // chain the server chose for itself, and it is the arm (K7d) needs to name. Optional because a
  // row that is not proportional carries neither field.
  cmdSource?: string; proportional?: boolean;
  covers: { branch: string; mainAfter: string; at: number }[];
  remote?: { name: string; claimedAt: number; reportedAt: number; trail?: string; clonedSha?: string;
    // the other machine's own account of a NON-measurement. Optional and typed as a plain string
    // for the same reason every other remote field here is: what is under test is that the server
    // writes it, and a mandatory field would let a server that stopped writing it take this module
    // down with a TypeError instead of failing the named check.
    reason?: string; timeoutMs?: number;
    // the job the row came out of (the cross-check an upload is measured against) and the artefact
    // rail JOINED in by the read surface. Both optional for the same reason as every field above:
    // what is under test is that the server writes them, and a mandatory field would let a server
    // that stopped writing one take this module down with a TypeError instead of failing a check.
    jobId?: string; artifact?: { bytes: number; sha256: string; url: string } };
  // the sharded audit's per-shard account (K11). Optional for the reason every remote field is.
  // `coResident` is the one field whose ABSENCE is a third answer rather than an old server
  // (server.ts#shardCoResidence): a shard that never held a window carries no key at all, and this
  // type has to allow that or (K11d) could not tell it apart from a measured `with: []`.
  shards?: { k: number; jobId: string; result: string; ms: number | null; ran: number | null;
    failed: number | null; exitCode: number | null; name?: string; trail?: string;
    coResident?: { with: number[]; ms: number; unknownWindows: number } }[];
  fails?: string[];
}
interface LiveView {
  postLandAuditLive: { running: { repo: string | null; phase: string } | null } | null;
}

const DEVICE = "e2e0device01";        // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "e2e helper box";

export async function run(h: {
  REPO: string;
  // the harness's proportional fixture (a repo carrying `fleet-e2e.ts` and a runnable `e2e/pins.ts`,
  // so its docs-only lands really run the short chain). Passed in rather than seeded here: building
  // it a second time would be a second manifest for `bun install --frozen-lockfile` to disagree
  // with, which is the exact breakage that gave it its own repo in the first place.
  shortChainRepo: string;
  setAuditMode: (m: string) => Promise<number>;
  killSrv: () => Promise<void>;
  startSrv: (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }) => Promise<boolean>;
  auditRows: () => Promise<Row[]>;
  headOf: (ref?: string) => string;
}): Promise<void> {
  const { REPO, shortChainRepo, setAuditMode, killSrv, startSrv, auditRows, headOf } = h;
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
  // the artefact upload's poster: BYTES, not JSON. Separate from hpost on purpose — hpost sets a
  // JSON content-type, and a suite.log that arrived labelled application/json would be a fixture
  // proving something other than what the daemon does.
  const hpostRaw = (path: string, body: string, headers: Record<string, string> = {}): Promise<Response> =>
    fetch(BASE + path, { method: "POST",
      headers: { ...HH, "content-type": "text/plain; charset=utf-8", ...headers }, body });
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
  // THE n=1 HALF OF THE SHARDED AUDIT, on the row this section just wrote with FLEET_AUDIT_SHARDS unset:
  // exactly the keys, in exactly the order, an unsharded remote row has always had — no `shards`, and the
  // job it came out of carried no `shard` (the list above is compared as a whole). The read surface joins
  // `adjudication`/`ping` on at the END, so those two are cut before comparing.
  const n1Keys = Object.keys(remote ?? {}).filter((k) => k !== "adjudication" && k !== "ping").join(",");
  check("(K) with FLEET_AUDIT_SHARDS unset the remote row has exactly the unsharded keys, in order — no `shards`, and the job carried no `shard`",
    n1Keys === "at,startedAt,ms,repo,main,mainSha,result,cmd,exitCode,out,checks,covers,remote"
      && queued?.shard === undefined && remote?.cmd === `remote helper (${DEVICE_NAME}): ./e2e-isolated.sh`,
    `keys=${n1Keys} shard=${queued?.shard} cmd=${remote?.cmd}`);
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

  // ===== (K7a2) THE GRACE'S CLOCK IS CLAIMABILITY, NOT THE LAND =================================
  // The repair of 2026-09-07 (server.ts, grep `auditClaimableSince`). The grace above measures from
  // `cover.at`; a claim locks PER REPO, so a land that arrives BEHIND a live claim spends its whole
  // grace unofferable and reaches the drain with it already spent. Measured three times in five
  // local runs: the drain started 7 / 5 / 14 ms after the `helper_result` of the same repo — the
  // one instant the helper was provably free. The offset now runs from the moment the entry became
  // CLAIMABLE, so the seconds it stood behind the claim are not counted as an offer it had.
  //
  // FIVE checks: two setups that build the state, then three that measure it. The third — "THE
  // GRACE RESTARTS" — is the whole regression: WITHOUT the fix the second land is taken by the
  // local drain within a second of the result below, because its cover is 9.5 s old against an
  // 8 s grace. The last two keep it from passing for a cheap reason — "nothing ran locally" is
  // also what a parked or dropped entry looks like, so the helper must still be able to take that
  // exact tree and close it remote. Measured against the mutation: reverting the one line in the
  // drain fails exactly those three and neither setup.
  const rowsBeforeQ = (await newRepoRows()).length;
  const qLane1 = await openLane(REPO, "clockahead");
  await driveMerge(qLane1, qLane1.branch);
  await Bun.sleep(2500);                        // inside the grace, so the job is the helper's
  const qJob1 = await jobFor(REPO);
  const qClaim1 = qJob1 ? await hpost("/api/helper/claim", { jobId: qJob1.id, deviceId: DEVICE }) : null;
  check("(K7a2) setup: a helper holds this repo's audit",
    qClaim1?.ok === true, `${JSON.stringify(qJob1)} claim=${qClaim1?.status}`);
  // …and a SECOND land arrives BEHIND that claim and waits the grace out while nobody could take it
  const qLane2 = await openLane(REPO, "clockbehind");
  const qLanded2 = await driveMerge(qLane2, qLane2.branch);
  const qSha2 = headOf();
  await Bun.sleep(GRACE_MS + 1500);
  const qBlocked = await jobFor(REPO);
  check("(K7a2) setup: the second land is queued behind the live claim, its cover older than the grace",
    qLanded2.gone && !!qBlocked && qBlocked.claim?.name === DEVICE_NAME
      && (await liveRepo()) === null && (await newRepoRows()).length === rowsBeforeQ,
    `${JSON.stringify(qBlocked)} live=${await liveRepo()} rows=${(await newRepoRows()).length}/${rowsBeforeQ}`);
  const qReport1 = await hpost("/api/helper/result",
    { jobId: qJob1?.id ?? "", exitCode: 0, tail: "PASS  the claim ahead\nALL PASS" });
  await waitNewRepoRows(rowsBeforeQ + 1);       // the first land's remote row — the claim is now gone
  const rowsAfterFirst = (await newRepoRows()).length;
  await Bun.sleep(2500);                        // a (wrong) local run has had 2.5 s to appear
  const qFreed = await jobFor(REPO);
  check("(K7a2) THE GRACE RESTARTS WHEN THE CLAIM ENDS — the drain does not pounce on the queued land",
    qReport1.ok && !!qFreed && qFreed.claim === null && qFreed.localRunning === false
      && (await liveRepo()) === null && (await newRepoRows()).length === rowsAfterFirst,
    `${qReport1.status} ${JSON.stringify(qFreed)} live=${await liveRepo()}`
    + ` rows=${(await newRepoRows()).length}/${rowsAfterFirst}`);
  const qClaim2 = qFreed ? await hpost("/api/helper/claim", { jobId: qFreed.id, deviceId: DEVICE }) : null;
  const qBody2 = (await qClaim2?.json()) as { job?: { mainSha: string } } | undefined;
  check("(K7a2) …and the tree it held back is really the helper's to take, on the sha that landed",
    qClaim2?.ok === true && qBody2?.job?.mainSha === qSha2,
    `${qClaim2?.status} ${JSON.stringify(qBody2)} want=${qSha2}`);
  const qReport2 = await hpost("/api/helper/result",
    { jobId: qFreed?.id ?? "", exitCode: 0, tail: "PASS  the land behind it\nALL PASS" });
  const qRows = await waitNewRepoRows(rowsAfterFirst + 1);
  check("(K7a2) …and it closes REMOTE, with no local twin for that tree",
    qReport2.ok && qRows.filter((r) => r.mainSha === qSha2).length === 1
      && qRows.find((r) => r.mainSha === qSha2)?.remote?.name === DEVICE_NAME,
    `${qReport2.status} ${JSON.stringify(qRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

  // ===== (K7b) A NON-MEASUREMENT SAYS WHICH ONE IT WAS ==========================================
  // `exitCode: null` reaches this server identically whether the run was KILLED at its budget or
  // simply produced no code, and the shared classifier turns both into the same `unknown` with the
  // same prose. That word is true and unactionable: "raise the budget" and "find out why nothing
  // started" are different next steps. Only the machine that killed the run knows which, so it now
  // says so — and the verdict's own semantics are UNCHANGED, which is the half this block pins
  // hardest: still `unknown`, still `checks: null`, still never a red.
  const rowsBeforeTo = (await newRepoRows()).length;
  const toLane = await openLane(REPO, "timedout");
  await driveMerge(toLane, toLane.branch);
  const toSha = headOf();
  await Bun.sleep(2500); // inside the grace, so the job is the helper's to claim
  const toJob = await jobFor(REPO);
  const toClaim = toJob ? await hpost("/api/helper/claim", { jobId: toJob.id, deviceId: DEVICE }) : null;
  check("(K7b) setup: the helper claims the job it is about to time out on",
    toClaim?.ok === true, `${toClaim?.status} ${JSON.stringify(toJob)}`);
  const TO_MS = 900_000;
  const toReport = await hpost("/api/helper/result",
    { jobId: toJob?.id ?? "", exitCode: null, reason: "timeout", timeoutMs: TO_MS,
      tail: "the suite passed 900s and was killed here" });
  const toRows = await waitNewRepoRows(rowsBeforeTo + 1);
  const toRow = toRows.find((r) => r.mainSha === toSha);
  check("(K7b) A TIMED-OUT RUN IS STILL `unknown` WITH `checks: null` — the verdict did not move",
    toReport.ok && !!toRow && toRow.result === "unknown" && toRow.checks === null && toRow.exitCode === null,
    `${toReport.status} ${JSON.stringify(toRow).slice(0, 240)}`);
  check("(K7b) …and the row now NAMES the timeout and the budget it was killed at",
    toRow?.remote?.reason === "timeout" && toRow.remote.timeoutMs === TO_MS,
    JSON.stringify(toRow?.remote));

  // …and the OTHER non-measurement, which is derived HERE rather than taken off the wire: 126/127
  // is already what the shared classifier calls "could not be started", and one function deciding
  // what an exit code means beats a second opinion travelling beside it. The bogus `reason` in the
  // same body is the second half of the check: a code this server cannot read is DROPPED, never a
  // 400 — refusing would make a newer daemon's whole verdict hostage to an annotation.
  const rowsBeforeCns = (await newRepoRows()).length;
  const cnsLane = await openLane(REPO, "nostart");
  await driveMerge(cnsLane, cnsLane.branch);
  const cnsSha = headOf();
  await Bun.sleep(2500);
  const cnsJob = await jobFor(REPO);
  const cnsClaim = cnsJob ? await hpost("/api/helper/claim", { jobId: cnsJob.id, deviceId: DEVICE }) : null;
  check("(K7b) setup: the helper claims the job whose command never started",
    cnsClaim?.ok === true, `${cnsClaim?.status} ${JSON.stringify(cnsJob)}`);
  const cnsReport = await hpost("/api/helper/result",
    { jobId: cnsJob?.id ?? "", exitCode: 127, reason: "flurb", timeoutMs: 5,
      tail: "bun install --frozen-lockfile failed (exit 127)" });
  const cnsRows = await waitNewRepoRows(rowsBeforeCns + 1);
  const cnsRow = cnsRows.find((r) => r.mainSha === cnsSha);
  check("(K7b) exit 127 is classified `could-not-start` BY THIS SERVER, and an unreadable reason is dropped",
    cnsReport.ok && cnsRow?.result === "unknown" && cnsRow.remote?.reason === "could-not-start"
      && cnsRow.remote.timeoutMs === undefined,
    `${cnsReport.status} ${JSON.stringify(cnsRow?.remote)} result=${cnsRow?.result}`);

  // ===== (K7c) THE SUITE.LOG THAT ARRIVES AFTER ITS OWN ROW =====================================
  // A remote red is a 4 KB tail, and the whole log lived only in a run directory the daemon deletes
  // in its own `finally`. The artefact rail is the missing half — and its ORDER is the property:
  // the verdict goes first, the bytes follow, and nothing about the second can move the first.
  // Everything below is written against a SIDE rail joined at the read surface, which is what
  // "die Ledger-Zeile traegt remote.artifact" means once the row itself is append-only.
  const rowsBeforeArt = (await newRepoRows()).length;
  const artLane = await openLane(REPO, "suitelog");
  await driveMerge(artLane, artLane.branch);
  const artSha = headOf();
  await Bun.sleep(2500);                       // inside the grace, so the job is the helper's
  const artJob = await jobFor(REPO);
  const artClaim = artJob ? await hpost("/api/helper/claim", { jobId: artJob.id, deviceId: DEVICE }) : null;
  check("(K7c) setup: the helper claims the job whose log it will hand over",
    artClaim?.ok === true, `${artClaim?.status} ${JSON.stringify(artJob)}`);
  const artReportRes = await hpost("/api/helper/result",
    { jobId: artJob?.id ?? "", exitCode: 1, tail: "FAIL  something remote\n1 FAILURES" });
  const artReport = (await artReportRes.json()) as
    { result?: string; auditAt?: number; artifactAt?: number };
  // THE KEY TRAVELS IN THE RECEIPT. Without it an upload could only name the JOB — and an audit
  // job's id is sha256(repo), the same string for every audit of that repo, so "newest job with
  // this id" would file a log onto whichever row happened to be newest. This is the whole reason
  // the rail needs no semantic key.
  check("(K7c) the result receipt hands back the ROW KEY the upload must name",
    artReportRes.ok && artReport.result === "red" && typeof artReport.auditAt === "number",
    `${artReportRes.status} ${JSON.stringify(artReport)}`);
  // …UNDER BOTH NAMES, and that is what makes ONE uploader serve every kind of job. `artifactAt` is
  // the key a lane-suite receipt also carries (e2e/lane-suite.ts LS.4b asserts the other half);
  // `auditAt` stays beside it forever, because a daemon from before the rename is still a daemon
  // whose logs this box wants and dropping the old key would silence it with no error anywhere.
  check("(K7c) …under BOTH names, the same number: one uploader, every kind of job",
    artReport.artifactAt === artReport.auditAt && typeof artReport.artifactAt === "number",
    `auditAt=${artReport.auditAt} artifactAt=${artReport.artifactAt}`);
  const auditAt = artReport.auditAt ?? 0;
  const artRows = await waitNewRepoRows(rowsBeforeArt + 1);
  const artRow = artRows.find((r) => r.mainSha === artSha);
  check("(K7c) …and the row it names carries the job id an upload will be checked against",
    artRow?.at === auditAt && artRow.remote?.jobId === artJob?.id,
    `at=${artRow?.at} want=${auditAt} jobId=${artRow?.remote?.jobId} want=${artJob?.id}`);
  check("(K7c) …and before any upload the row carries NO artefact — absent is 'none arrived'",
    artRow?.remote?.artifact === undefined, JSON.stringify(artRow?.remote));

  const artUrl = `/api/helper/artifact/${artJob?.id ?? ""}?at=${auditAt}`;
  // THE PERIMETER, four refusals. Each one is a fact the rail would otherwise have to guess at.
  const artNoTok = await fetch(BASE + artUrl, { method: "POST",
    headers: { "content-type": "text/plain" }, body: "x" });
  check("(K7c) the upload needs the helper credential — 401 without it",
    artNoTok.status === 401, `${artNoTok.status}`);
  const noAt = await hpostRaw(`/api/helper/artifact/${artJob?.id ?? ""}`, "x");
  check("(K7c) …and it must NAME the row: no ?at is a 400, never a guess at the newest",
    noAt.status === 400 && (await noAt.text()).includes("artifactAt"), `${noAt.status}`);
  const foreign = await hpostRaw(`/api/helper/artifact/${"f".repeat(12)}?at=${auditAt}`, "x");
  check("(K7c) …a log for ANOTHER job is refused 404 — the row's own jobId is the cross-check",
    foreign.status === 404 && (await foreign.text()).includes("another job"), `${foreign.status}`);
  const noRow = await hpostRaw(`/api/helper/artifact/${artJob?.id ?? ""}?at=1234567890123`, "x");
  check("(K7c) …and a row key that names nothing is a 404, not an orphan file",
    noRow.status === 404, `${noRow.status}`);

  // THE CAP, and the half that matters is what it LEAVES BEHIND. A refused upload that had already
  // written its bytes would be a file no rail row points at — the exact orphan the size check
  // exists to prevent — so the directory is asserted, not just the status.
  const artDir = `${ROOT}/streams/helper-artifacts/${artJob?.id ?? "none"}`;
  const over = await hpostRaw(artUrl, "z".repeat(9 * 1024 * 1024));
  check("(K7c) a 9 MB suite.log is refused 413 and leaves NO file behind",
    over.status === 413 && !existsSync(`${artDir}/${auditAt}/suite.log`),
    `${over.status} dirExists=${existsSync(artDir)}`);

  // …and the accepted one. 1 MB, and the digest is compared against the sha256 of what was SENT:
  // the server hashes the bytes it wrote, so an equal digest is the round trip, not an echo.
  // exactly 1 MiB of ASCII, so `bytes` on the row is a number the reader can check by eye rather
  // than a length that happens to agree with itself
  const LOG = "PASS  remote check\n".repeat(56_000).slice(0, 1024 * 1024);
  const wantSha = createHash("sha256").update(Buffer.from(LOG, "utf8")).digest("hex");
  const up = await hpostRaw(artUrl, LOG);
  const upBody = (await up.json()) as { artifact?: { bytes?: number; sha256?: string }; result?: string };
  check("(K7c) THE UPLOAD LANDS — and the receipt echoes the verdict back UNCHANGED",
    up.ok && upBody.artifact?.sha256 === wantSha && upBody.artifact.bytes === Buffer.byteLength(LOG, "utf8")
      && upBody.result === "red",
    `${up.status} ${JSON.stringify(upBody.artifact)} result=${upBody.result}`);
  const joined = (await newRepoRows()).find((r) => r.at === auditAt);
  check("(K7c) THE READ SURFACE SERVES IT ON THE ROW — remote.artifact.sha256 is the sent bytes'",
    joined?.remote?.artifact?.sha256 === wantSha
      && joined.remote.artifact.bytes === Buffer.byteLength(LOG, "utf8"),
    JSON.stringify(joined?.remote?.artifact));
  check("(K7c) …and the VERDICT DID NOT MOVE: the rail cannot reach the audit trail at all",
    joined?.result === "red" && joined.exitCode === 1,
    `result=${joined?.result} exit=${joined?.exitCode}`);
  // the bytes themselves, through the OWNER route the row's `url` names — a link that 404s would
  // be worse than no link, and this is the only check that proves the two halves agree on a path
  const served = await get(joined?.remote?.artifact?.url ?? "/api/post-land-audits/artifact?at=0");
  const servedText = await served.text();
  check("(K7c) …and the url on the row serves exactly those bytes back",
    served.ok && createHash("sha256").update(Buffer.from(servedText, "utf8")).digest("hex") === wantSha,
    `${served.status} ${servedText.length}b`);
  check("(K7c) …stored under STREAM_DIR, which is gitignored — an artefact can never block a land",
    existsSync(`${artDir}/${auditAt}/suite.log`),
    `${artDir} => ${existsSync(artDir) ? readdirSync(artDir).join(",") : "absent"}`);

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

  // ===== (K7d) AN ENTRY NO HELPER COULD EVER TAKE DOES NOT WAIT FOR ONE =========================
  // The grace above is a promise made to another MACHINE: for AUDIT_HELPER_GRACE_MS this box leaves
  // a fresh entry alone so the portal gets first refusal. Three kinds of entry are never offered at
  // all (server.ts#helperClaimBar) — a repo whose audit is its own repo-worker executable, an entry
  // whose every land passed the docs-only gate, and a parked one with no command — and holding one
  // of those is a promise made to nobody: pure latency on this box's own work.
  //
  // WHY IT IS ONE PREDICATE AND NOT THREE SKIPS, which is what this section really pins: the same
  // list was hand-copied at four sites and had ALREADY drifted in both directions. The drain knew
  // the short-chain arm and not the repo-worker one (so a repo-worker entry waited out the full
  // grace for an offer that structurally never comes — the defect measured here), and the wake rail
  // knew the repo-worker arm and not the short-chain one (a magic packet for a job the woken
  // machine is then refused at the door). Both are now the one call.
  //
  // THE MEASUREMENT IS A DIFFERENCE ON THE ROW ITSELF — `startedAt - covers[0].at`, the very clock
  // the grace is computed from (`readyAt = max(youngest cover, claimable-since) + GRACE`). No
  // harness stopwatch is in it, so a slow box makes the run late, never the verdict wrong.
  //
  // AND THE CONTROL IS THE OTHER HALF, taken at the SAME instant: without it "nothing waited" is
  // equally what a dead grace, a dropped entry or an offline device looks like. So an ordinary,
  // offerable entry of the SAME AGE must still be sitting there, unrun and offered, at the moment
  // the un-offerable one has already been measured.
  //
  // THE PARKED ARM IS NOT HERE, and that is a statement rather than an omission: `auditCmdFor`
  // falls back to the env default, so on a server booted WITH FLEET_POSTLAND_AUDIT_CMD no repo can
  // be parked at all. Its two doors are measured where a parked entry actually exists — the list
  // and the claim in e2e/repo-worker-audit.ts (RW.8) — and it has no grace question of its own: a
  // parked entry is never drained locally either, with or without a helper.
  const RWG = `${REPO}-rwgrace`;
  await seedRepo(RWG);
  // the repo's OWN audit command: one absolute executable, the only shape /api/repo-worker stores.
  // Fast on purpose — what is under test is WHEN it started, not how long it ran.
  const RWG_CMD = `${REPO}-rwgrace-audit`;
  await Bun.write(RWG_CMD, "#!/bin/sh\necho \"PASS  rwgrace repo-worker audit\"\necho \"ALL PASS\"\nexit 0\n");
  chmodSync(RWG_CMD, 0o755);
  const rwgSet = await post("/api/repo-worker", { repo: RWG, worker: "audit", cmd: RWG_CMD });
  check("(K7d) setup: the second repo audits with its OWN repo-worker command",
    rwgSet.ok && ((await rwgSet.json()) as { cmd?: string }).cmd === RWG_CMD,
    `${rwgSet.status} ${RWG_CMD}`);
  // A LONGER GRACE THAN (K7)'s 8 s, and that is the fixture, not a convenience. This section drives
  // three lands, and the control has to be observably UNRUN while the other two are measured — with
  // an 8 s grace the control's own timer fires during the second land's merge and the drain takes it
  // legitimately, which would read as the defect. A long grace also makes each measurement sharper:
  // "started 0.2 s after its cover" against a 120 s promise says the promise was never consulted.
  const K7D_GRACE_MS = 120_000;
  // …AND A FRESHNESS WINDOW WIDER THAN THE GRACE, which is the half a mutation run taught us
  // (2026-09-08). `graceOn` is `AUDIT_HELPER_GRACE_MS > 0 && helperClaimCandidateExists()`, and that
  // second half goes false once the device's heartbeat ages past HELPER_FRESH_MS (3 × the sweep).
  // With (K7)'s 15 s sweep that is 45 s — so under the mutation the short-chain entry did NOT run at
  // once, it ran after 51 995 ms, when the grace simply switched itself off, and a check bounded by
  // the 120 s grace passed for that wrong reason. A sweep of 120 s makes the window 360 s, wider than
  // anything this section holds, so "it started at once" can only mean the drain never consulted the
  // grace. The claim timeout is longer still: nothing here tests a lapse.
  const K7D_SWEEP_MS = 120_000;
  const K7D_FRESH_MS = 3 * K7D_SWEEP_MS;
  await killSrv();
  check("(K7d) setup: the server restarts with a grace long enough to observe one entry waiting inside it",
    await startSrv({ audit: true, extra: { FLEET_AUDIT_HELPER_GRACE_MS: String(K7D_GRACE_MS),
      FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: String(K7D_SWEEP_MS) } }));
  await Bun.sleep(750);
  // the device must be a live claim CANDIDATE right now, or `graceOn` is false and every check
  // below passes for the wrong reason — "the drain took it" is also what a correct grace does when
  // nobody can claim. A fresh beat, not a formality: the register came back from disk.
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const k7dBeat = async (): Promise<Response> => hpost("/api/helper/device",
    { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
  // WHEN THE DEVICE LAST SPOKE — so each measurement below can say the grace was ARMED at the moment
  // the drain decided, rather than leaving "it started at once" and "nobody was there to hold it for"
  // indistinguishable. A probe that could not measure must fail as ITSELF.
  const k7dLastSeen = async (): Promise<number> => (await jobs()).device?.lastSeen ?? 0;
  const k7dFirstBeat = await k7dBeat();
  check("(K7d) setup: the helper is beating and active, so the grace has somebody to hold work for",
    k7dFirstBeat.ok && (await jobs()).device?.mode === "active"
      && await waitNoLocalRun(30_000) && (await jobs()).jobs.length === 0,
    `${k7dFirstBeat.status} device=${JSON.stringify((await jobs()).device)} jobs=${JSON.stringify((await jobs()).jobs)}`);

  // THE CONTROL LANDS FIRST, so its cover is the OLDER one: if the drain ran on age it would take
  // this one, and the check below would fail in the direction that matters.
  const k7dCtlRows = (await newRepoRows()).length;
  await k7dBeat();
  const k7dCtl = await openLane(REPO, "gracecontrol");
  const k7dCtlLanded = await driveMerge(k7dCtl, k7dCtl.branch);
  const k7dRwLane = await openLane(RWG, "rwgracework");
  const k7dRwLanded = await driveMerge(k7dRwLane, k7dRwLane.branch);
  const k7dRwRow = (await waitRowsFor(RWG, 1, 60_000))[0];
  const k7dRwCover = k7dRwRow?.covers[0]?.at ?? 0;
  const k7dRwSeen = await k7dLastSeen();
  check("(K7d) A REPO-WORKER ENTRY IS AUDITED AT ONCE — the grace never holds it for a portal that would refuse it",
    k7dRwLanded.gone && !!k7dRwRow && k7dRwRow.result === "green"
      && k7dRwRow.cmd === RWG_CMD && k7dRwRow.covers[0]?.branch === k7dRwLane.branch
      && k7dRwCover > 0 && k7dRwRow.startedAt - k7dRwCover < K7D_GRACE_MS
      // …and the grace was ARMED when the drain decided: a stale device makes `graceOn` false, and
      // then "it ran at once" says nothing about this line at all
      && k7dRwRow.startedAt - k7dRwSeen < K7D_FRESH_MS,
    `waited=${k7dRwRow ? k7dRwRow.startedAt - k7dRwCover : "no row"}ms grace=${K7D_GRACE_MS}`
    + ` deviceAge=${k7dRwRow ? k7dRwRow.startedAt - k7dRwSeen : "?"}ms fresh=${K7D_FRESH_MS}`
    + ` cmd=${k7dRwRow?.cmd} result=${k7dRwRow?.result}`);
  // …and the same instant from the other side. Read AFTER the row above so there is no doubt about
  // the order: by the time the un-offerable entry had been measured, the offerable one had not.
  const k7dCtlJob = await jobFor(REPO);
  // NO ABSOLUTE BOUND HERE, deliberately: a loaded box makes any millisecond threshold a flake. The
  // comparison is between the two entries — the offerable one has ALREADY been queued longer than
  // the un-offerable one ever waited, and is still sitting there.
  const k7dCtlWaited = k7dCtlJob ? Date.now() - k7dCtlJob.oldestAt : 0;
  const k7dRwWaited = k7dRwRow ? k7dRwRow.startedAt - k7dRwCover : Number.POSITIVE_INFINITY;
  check("(K7d) …while an OFFERABLE entry landed BEFORE it is still waiting, unrun and on the portal",
    k7dCtlLanded.gone && !!k7dCtlJob && k7dCtlJob.claim === null && k7dCtlJob.localRunning === false
      && k7dCtlJob.oldestAt <= k7dRwCover
      && k7dCtlWaited > k7dRwWaited
      && (await liveRepo()) === null && (await newRepoRows()).length === k7dCtlRows,
    `${JSON.stringify(k7dCtlJob)} ctlWaited=${k7dCtlWaited}ms`
    + ` rwWaited=${k7dRwRow ? k7dRwWaited : "no row"}ms`
    + ` live=${await liveRepo()} rows=${(await newRepoRows()).length}/${k7dCtlRows}`);
  // and it really was the helper's: claimed and closed remote, so "nobody ran it here" cannot be
  // read out of an entry that was quietly dropped
  const k7dCtlClaim = k7dCtlJob ? await hpost("/api/helper/claim", { jobId: k7dCtlJob.id, deviceId: DEVICE }) : null;
  const k7dCtlReport = await hpost("/api/helper/result",
    { jobId: k7dCtlJob?.id ?? "", exitCode: 0, tail: "PASS  the control, taken remote\nALL PASS" });
  const k7dCtlAfter = await waitNewRepoRows(k7dCtlRows + 1);
  check("(K7d) …and that waiting entry was really claimable: the helper took it and closed it REMOTE",
    k7dCtlClaim?.ok === true && k7dCtlReport.ok
      && k7dCtlAfter.filter((r) => r.covers.some((c) => c.branch === k7dCtl.branch)).length === 1
      && k7dCtlAfter.find((r) => r.covers.some((c) => c.branch === k7dCtl.branch))?.remote?.name === DEVICE_NAME,
    `claim=${k7dCtlClaim?.status} report=${k7dCtlReport.status}`
    + ` rows=${JSON.stringify(k7dCtlAfter.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

  // THE SHORT-CHAIN ARM, in the repo that carries the `fleet-e2e.ts` sentinel the short chain is
  // guarded by (the harness's proportional fixture — a second repo exists for exactly this reason).
  // Its land gate runs install+pins, which is what stamps the cover `proportional`, which is what
  // makes the entry un-offerable. Same difference, same grace, and the arm the drain already knew:
  // this pins it against the unification, which routed it through a predicate it did not use before.
  check("(K7d) setup: the machine is idle again before the short-chain arm, with the helper still beating",
    await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0
      && (await k7dBeat()).ok && (await jobs()).device?.mode === "active",
    `jobs=${JSON.stringify((await jobs()).jobs)} device=${JSON.stringify((await jobs()).device)}`);
  const k7dDocsBefore = (await rowsFor(shortChainRepo)).length;
  const k7dDocs = (await (await post("/api/lanes", { repo: shortChainRepo })).json()) as Lane;
  mkdirSync(`${k7dDocs.cwd}/docs`, { recursive: true });
  await Bun.write(`${k7dDocs.cwd}/docs/gracedocs.md`, "grace measurement note\n");
  spawnSync("git", ["-C", k7dDocs.cwd, "add", "-A"]);
  for (let i = 0; i < 12; i++) {   // the index-lock retry openLane pays, for a lane it does not build
    spawnSync("git", ["-C", k7dDocs.cwd, "commit", "-qm", "gracedocs docs-only lane work"]);
    if (spawnSync("git", ["-C", k7dDocs.cwd, "log", "--oneline", "-1"]).stdout.toString()
      .includes("gracedocs docs-only lane work")) break;
    await Bun.sleep(300);
  }
  const k7dDocsLanded = await driveMerge(k7dDocs, k7dDocs.branch);
  const k7dDocsRow = (await waitRowsFor(shortChainRepo, k7dDocsBefore + 1, K7D_GRACE_MS))[0];
  const k7dDocsCover = k7dDocsRow?.covers[0]?.at ?? 0;
  const k7dDocsSeen = await k7dLastSeen();
  check("(K7d) A SHORT-CHAIN ENTRY IS AUDITED AT ONCE TOO — install+pins is never held for a portal either",
    k7dDocsLanded.gone && !!k7dDocsRow && k7dDocsRow.proportional === true
      && k7dDocsRow.cmdSource === "proportional" && k7dDocsRow.covers[0]?.branch === k7dDocs.branch
      && k7dDocsCover > 0 && k7dDocsRow.startedAt - k7dDocsCover < K7D_GRACE_MS
      && k7dDocsRow.startedAt - k7dDocsSeen < K7D_FRESH_MS,   // …the grace was armed here too
    `waited=${k7dDocsRow ? k7dDocsRow.startedAt - k7dDocsCover : "no row"}ms grace=${K7D_GRACE_MS}`
    + ` deviceAge=${k7dDocsRow ? k7dDocsRow.startedAt - k7dDocsSeen : "?"}ms fresh=${K7D_FRESH_MS}`
    + ` proportional=${k7dDocsRow?.proportional} source=${k7dDocsRow?.cmdSource}`);
  await post("/api/repo-worker", { repo: RWG, worker: "audit", cmd: "" }); // leave the register as found
  check("(K7d) …and the machine is left idle with an empty queue for what follows",
    await waitNoLocalRun(120_000) && (await jobs()).jobs.length === 0,
    JSON.stringify((await jobs()).jobs));

  // ===== (K7e) A HELPER BETWEEN TWO HEARTBEATS IS STILL THERE ===================================
  // THE GAP BETWEEN TWO WINDOWS, and it was throwing the grace away. A heartbeat counts as FRESH
  // for HELPER_FRESH_MS (3 × the sweep, 45 s on this box's default) and the register — and every
  // board that draws it, and /api/self/gate's `helper.online` — calls the machine ONLINE for
  // DEVICE_ONLINE_MS (90 s). The drain asked only the first: `graceOn` false meant `return true`,
  // and a drain that happened to look between two beats of a machine that was plainly there took a
  // ~30-minute audit onto this box's ONE suite mutex. That decision is made once and for the whole
  // run (`auditRunningRepo`), so the next beat, 3 s later, changes nothing.
  //
  // THE CLOCK IS SET, not waited out: the sweep is turned down so the freshness window is 3 s while
  // the online window stays a minute, which is the same shape as production (fresh ≪ online) at a
  // size a suite can observe. Three checks, one per arm, and each changes ONE variable against the
  // others: the beat is stale-but-online (1), it is stale-but-online and NOBODY comes back (2), and
  // there is no beat inside the online window at all (3) — the arm that must still run at once.
  const K7E_GRACE_MS = 8000;
  const K7E_SWEEP_MS = 1000;
  const K7E_FRESH_MS = 3 * K7E_SWEEP_MS;   // server.ts: HELPER_FRESH_MS = 3 × HELPER_SWEEP_MS
  const K7E_ONLINE_MS = 60_000;
  const k7eEnv = (onlineMs: number): Record<string, string> => ({
    FLEET_AUDIT_HELPER_GRACE_MS: String(K7E_GRACE_MS), FLEET_HELPER_SWEEP_MS: String(K7E_SWEEP_MS),
    FLEET_DEVICE_ONLINE_MS: String(onlineMs), FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000",
  });
  // the youngest cover of a row — the very number the grace is computed from (`readyAt = max(
  // youngest cover, claimable-since) + GRACE`), so the measurements below carry no harness stopwatch
  const youngestCover = (r: Row | undefined): number => r?.covers.reduce((m, c) => Math.max(m, c.at), 0) ?? 0;
  await killSrv();
  check("(K7e) setup: the server restarts with a 3 s freshness window inside a 60 s online window",
    await startSrv({ audit: true, extra: k7eEnv(K7E_ONLINE_MS) }));
  await Bun.sleep(750);
  await setAuditMode("green");
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  const k7eBeat = async (): Promise<Response> => hpost("/api/helper/device",
    { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
  const k7eSeen = async (): Promise<number> => (await jobs()).device?.lastSeen ?? 0;
  const k7eFirst = await k7eBeat();
  check("(K7e) setup: the helper beats once, the queue is empty and nothing is running here",
    k7eFirst.ok && (await jobs()).device?.mode === "active"
      && await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0,
    `${k7eFirst.status} device=${JSON.stringify((await jobs()).device)} jobs=${JSON.stringify((await jobs()).jobs)}`);

  // (1) STALE BUT ONLINE — and then the helper comes back and really takes the tree. Without the
  // second half "nothing ran here" would equally describe a parked or dropped entry.
  const staleSeen = await k7eSeen();
  await Bun.sleep(K7E_FRESH_MS + 800);     // the beat ages OUT of the freshness window and no further
  const staleBefore = (await newRepoRows()).length;
  const staleLane = await openLane(REPO, "stalebeat");
  const staleLanded = await driveMerge(staleLane, staleLane.branch);
  const staleSha = headOf();
  await Bun.sleep(2500);                   // a (wrong) local run has had 2.5 s of an 8 s grace to appear
  const staleJob = await jobFor(REPO);
  const staleAge = Date.now() - staleSeen;
  check("(K7e) A BEAT THAT WENT STALE BUT IS STILL ONLINE HOLDS THE JOB — the drain does not pounce between two heartbeats",
    staleLanded.gone && !!staleJob && staleJob.claim === null && staleJob.localRunning === false
      && (await liveRepo()) === null && (await newRepoRows()).length === staleBefore
      // …and the probe fails as ITSELF: the beat really was past the freshness window and really
      // was inside the online one at the moment the drain decided. A device that stayed fresh, or
      // one that aged out of both, would make this check pass for a reason it does not name.
      && staleAge > K7E_FRESH_MS && staleAge < K7E_ONLINE_MS,
    `${JSON.stringify(staleJob)} beatAge=${staleAge}ms fresh=${K7E_FRESH_MS} online=${K7E_ONLINE_MS}`
    + ` live=${await liveRepo()} rows=${(await newRepoRows()).length}/${staleBefore}`);
  const staleBack = await k7eBeat();
  const staleClaim = staleJob ? await hpost("/api/helper/claim", { jobId: staleJob.id, deviceId: DEVICE }) : null;
  const staleBody = (await staleClaim?.json()) as { job?: { mainSha: string } } | undefined;
  check("(K7e) …and the helper that beats again inside that grace takes exactly the tree that landed",
    staleBack.ok && staleClaim?.ok === true && staleBody?.job?.mainSha === staleSha,
    `beat=${staleBack.status} claim=${staleClaim?.status} ${JSON.stringify(staleBody)} want=${staleSha}`);
  const staleReport = await hpost("/api/helper/result",
    { jobId: staleJob?.id ?? "", exitCode: 0, tail: "PASS  remote after a stale beat\nALL PASS" });
  const staleRows = await waitNewRepoRows(staleBefore + 1);
  check("(K7e) …and it closes REMOTE, with no local twin for that tree",
    staleReport.ok && staleRows.filter((r) => r.mainSha === staleSha).length === 1
      && staleRows.find((r) => r.mainSha === staleSha)?.remote?.name === DEVICE_NAME,
    `${staleReport.status} ${JSON.stringify(staleRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

  // (2) THE SAME ARM, AND NOBODY COMES BACK. The widened grace must not invent a wait that never
  // ends: the entry falls back to this box when the grace runs out, and the measurement is the one
  // the row carries itself — `startedAt − youngest cover` against the promise.
  check("(K7e) setup: idle again before the arm nobody returns to", await waitNoLocalRun(60_000));
  const outSeen0 = await k7eBeat();
  const outSeen = await k7eSeen();
  await Bun.sleep(K7E_FRESH_MS + 800);
  const outBefore = (await newRepoRows()).length;
  const outLane = await openLane(REPO, "graceout");
  const outLanded = await driveMerge(outLane, outLane.branch);
  const outRows = await waitNewRepoRows(outBefore + 1, 90_000);
  const outRow = outRows.find((r) => r.covers.some((c) => c.branch === outLane.branch));
  const outWaited = outRow ? outRow.startedAt - youngestCover(outRow) : -1;
  check("(K7e) THE LINGERING GRACE NEVER STARVES: nobody claimed, and the drain took it AFTER the grace rather than at once",
    outSeen0.ok && outLanded.gone && !!outRow && !outRow.remote && outRow.result === "green"
      && outWaited >= K7E_GRACE_MS - 250          // the armed timer's own moment, ±the setTimeout floor
      && outRow.startedAt - outSeen > K7E_FRESH_MS && outRow.startedAt - outSeen < K7E_ONLINE_MS,
    `waited=${outWaited}ms grace=${K7E_GRACE_MS} beatAge=${outRow ? outRow.startedAt - outSeen : "no row"}ms`
    + ` remote=${!!outRow?.remote} result=${outRow?.result}`);

  // (3) NO BEAT INSIDE THE ONLINE WINDOW AT ALL — the arm that must keep today's behaviour byte for
  // byte. One variable against (2): the online window is now shorter than the silence this device
  // is already in, so there is no machine to hold anything for and the drain takes the tree at once.
  check("(K7e) setup: idle again, with an empty queue", await waitNoLocalRun(90_000));
  await killSrv();
  const K7E_TIGHT_MS = 4000;
  check("(K7e) setup: the server restarts with an online window shorter than the silence already running",
    await startSrv({ audit: true, extra: k7eEnv(K7E_TIGHT_MS) }));
  await Bun.sleep(750);
  await setAuditMode("green");
  const goneSeen = await k7eSeen();         // the register came back from disk — no beat is sent here
  while (Date.now() - goneSeen <= K7E_TIGHT_MS + 500) await Bun.sleep(200);
  const goneBefore = (await newRepoRows()).length;
  const goneLane = await openLane(REPO, "helpergone");
  const goneLanded = await driveMerge(goneLane, goneLane.branch);
  const goneRows = await waitNewRepoRows(goneBefore + 1, 90_000);
  const goneRow = goneRows.find((r) => r.covers.some((c) => c.branch === goneLane.branch));
  const goneWaited = goneRow ? goneRow.startedAt - youngestCover(goneRow) : -1;
  check("(K7e) WITH NO BEAT INSIDE THE ONLINE WINDOW THE DRAIN STILL TAKES THE TREE AT ONCE",
    goneLanded.gone && !!goneRow && !goneRow.remote && goneWaited >= 0 && goneWaited < K7E_GRACE_MS
      && goneRow.startedAt - goneSeen > K7E_TIGHT_MS,   // …and the silence really was past the window
    `waited=${goneWaited}ms grace=${K7E_GRACE_MS} beatAge=${goneRow ? goneRow.startedAt - goneSeen : "no row"}ms`
    + ` online=${K7E_TIGHT_MS} remote=${!!goneRow?.remote}`);
  check("(K7e) …and the machine is left idle with an empty queue for what follows",
    await waitNoLocalRun(120_000) && (await jobs()).jobs.length === 0,
    JSON.stringify((await jobs()).jobs));

  // ===== (W) WAKE-ON-LAN — THE ONE NAMED EXCEPTION TO "NO PUSH" ===================================
  // Everything else in this portal is a pull: the Fleet answers, the other machine asks. A magic
  // packet is the single case where this box emits something towards a helper, and the reason it is
  // allowed to be that case is exactly what these checks measure — one connectionless UDP frame, no
  // credential in it, nothing that can answer it, and no effect beyond a switched-off box switching
  // on and then polling as before.
  //
  // THE FIXTURE IS A REAL SOCKET, not a spy on the server's internals: a listener in THIS process,
  // and the server configured to send at it. That is what makes "the frame left the box" a measured
  // fact rather than a code reading — and it is why the address is configuration here (see below).
  //
  // WHY THE ADDRESS IS CONFIGURED AND HAS NO DEFAULT — measured on the fleet host 2026-09-03:
  // `255.255.255.255` fails EHOSTUNREACH from a 0.0.0.0-bound socket on macOS EVEN WITH SO_BROADCAST
  // set, while the subnet-directed address goes out at once. A default would have made this section
  // green over a route production can never take.
  const wakePkts: Uint8Array[] = [];
  const wakeRx = await Bun.udpSocket({
    hostname: "127.0.0.1", port: 0,
    socket: { data(_sock, buf): void { wakePkts.push(new Uint8Array(buf)); } },
  });
  const WAKE_PORT = String(wakeRx.port);
  // built from bytes rather than written as a literal, for two reasons: `e2e/pins.ts` forbids a
  // MAC-shaped literal in the shipped universes and a fixture that looks like a real card's address
  // is the kind of thing that gets copied out of a test, and it exercises the server's own parser
  // on the ordinary colon form.
  const MAC_BYTES = [0x02, 0x00, 0x5e, 0x10, 0x00, 0x99];
  const macEnv = (bytes: readonly number[]): string =>
    bytes.map((b) => b.toString(16).padStart(2, "0")).join(":");
  const MAC_ENV = macEnv(MAC_BYTES);
  const DEVICE_NOMAC = "e2e0device02";     // registered, never given a MAC — the 409 case
  const DEVICE_BADMAC = "e2e0device03";    // given an unparseable one — the SAME 409, deliberately
  // THE AUTO-WAKE GETS ITS OWN DEVICE AND ITS OWN MAC, and both halves matter. Its own device
  // because `lastWakeAt` is the backoff's clock and (W2) below presses the button on DEVICE — a
  // tick measured on that same row would be suppressed by the button's stamp, and the negative
  // check that follows would pass for the wrong reason (vacuum-green: no packet because of a
  // backoff, read as "no packet because no work"). Its own MAC because the packet on the wire is
  // then evidence of WHICH device the tick chose, not merely that a tick fired.
  const DEVICE_AUTO = "e2e0device04";
  const MAC_AUTO = [0x02, 0x00, 0x5e, 0x10, 0x00, 0x9a];
  const isMagicOf = (p: Uint8Array, mac: readonly number[]): boolean =>
    p.length === 102
    && [...p.slice(0, 6)].every((b) => b === 0xff)
    && [...Array(16).keys()].every((i) => mac.every((b, k) => p[6 + i * 6 + k] === b));
  const isMagic = (p: Uint8Array): boolean => isMagicOf(p, MAC_BYTES);
  const waitPkts = async (n: number, timeoutMs: number): Promise<number> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && wakePkts.length < n) await Bun.sleep(50);
    return wakePkts.length;
  };
  const WAKE_ENV = {
    FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000",
    FLEET_HELPER_WAKE_ADDR: "127.0.0.1", FLEET_HELPER_WAKE_PORT: WAKE_PORT,
    [`FLEET_HELPER_MAC_${DEVICE.toUpperCase()}`]: MAC_ENV,
    [`FLEET_HELPER_MAC_${DEVICE_BADMAC.toUpperCase()}`]: "definitely-not-a-mac",
    [`FLEET_HELPER_MAC_${DEVICE_AUTO.toUpperCase()}`]: macEnv(MAC_AUTO),
  };
  const devOf = async (id: string): Promise<OwnerDeviceView | undefined> =>
    (await ownerDevices())?.find((d) => d.id === id);

  await killSrv();
  check("(W) setup: the server restarts with a wake address, a wake port and one device's MAC",
    await startSrv({ audit: true, extra: WAKE_ENV }));
  await Bun.sleep(750);
  for (const [id, name] of [[DEVICE, DEVICE_NAME], [DEVICE_NOMAC, "e2e box without a MAC"],
    [DEVICE_BADMAC, "e2e box with a bad MAC"]] as const)
    await hpost("/api/helper/device", { deviceId: id, name, mode: "active", load: 0.1 });

  // (W1) THE BOARD LEARNS WHETHER THE BUTTON WOULD DO ANYTHING — and nothing else. `wakeConfigured`
  // is the WHOLE of what the owner's poll is allowed to know about the MAC and the address: a
  // board that could read either would have put both on every phone that ever opened this fleet.
  const wakeCfg = await devOf(DEVICE);
  const noMacCfg = await devOf(DEVICE_NOMAC);
  const badMacCfg = await devOf(DEVICE_BADMAC);
  check("(W1) the owner's poll says wakeConfigured per device — true with a MAC, false without one",
    wakeCfg?.wakeConfigured === true && noMacCfg?.wakeConfigured === false
      && wakeCfg.lastWakeAt === undefined,
    `${wakeCfg?.wakeConfigured}/${noMacCfg?.wakeConfigured} lastWakeAt=${wakeCfg?.lastWakeAt}`);
  // an UNPARSEABLE MAC is not "configured with a problem", it is not configured. Anything else
  // would draw a live button over a value that can only ever fail at send time.
  check("(W1) an unparseable MAC reads as NOT configured, exactly like an absent one",
    badMacCfg?.wakeConfigured === false, `${badMacCfg?.wakeConfigured}`);
  // …and the payload itself. The MAC is checked in all three spellings it could be written in;
  // the ADDRESS cannot be checked this way here and this comment says so rather than pretending:
  // the harness binds the server on 127.0.0.1, so that string is in the payload for reasons that
  // have nothing to do with the wake rail. What covers the address instead is the key-set check
  // below (a leak would need a field) and the pins' declaration-line rule.
  const sessText = await (await get("/api/sessions")).text();
  const macForms = [MAC_ENV, MAC_ENV.replaceAll(":", "-"), MAC_ENV.replaceAll(":", "")];
  check("(W1) the MAC appears in NO form anywhere in the owner's poll",
    macForms.every((f) => !sessText.toLowerCase().includes(f.toLowerCase())), macForms.join(" "));
  const KNOWN_DEV_KEYS = ["id", "name", "lastSeen", "mode", "load", "capabilities", "desiredMode",
    "desiredSet", "claims", "lapses", "daemonSha", "update", "lastWakeAt", "wakeConfigured"];
  const strayKeys = Object.keys(wakeCfg ?? {}).filter((k) => !KNOWN_DEV_KEYS.includes(k));
  check("(W1) the device row carries no field beyond the known set — a leaked address would need one",
    !!wakeCfg && strayKeys.length === 0, `stray=[${strayKeys}]`);

  // (W2) THE OWNER'S BUTTON. One POST, one frame, 102 bytes, 6×FF then the MAC sixteen times.
  const wakeRes = await post(`/api/helper/devices/${DEVICE}/wake`, {});
  const wakeBody = (await wakeRes.json()) as { sent?: boolean; at?: number; deviceId?: string; error?: string };
  const got = await waitPkts(1, 5000);
  check("(W2) POST /wake answers sent:true with a timestamp and the device id",
    wakeRes.ok && wakeBody.sent === true && typeof wakeBody.at === "number"
      && wakeBody.deviceId === DEVICE && wakeBody.error === undefined,
    `${wakeRes.status} ${JSON.stringify(wakeBody)}`);
  check("(W2) EXACTLY ONE magic packet arrives: 102 bytes, 6×FF, the MAC sixteen times",
    got === 1 && wakePkts.length === 1 && isMagic(wakePkts[0]!),
    `${wakePkts.length} packet(s), first ${wakePkts[0]?.length ?? 0} bytes, magic=${wakePkts[0] ? isMagic(wakePkts[0]) : false}`);
  const stamped = await devOf(DEVICE);
  check("(W2) …and the board now carries the stamp of that frame, not a claim about the machine",
    typeof stamped?.lastWakeAt === "number" && stamped.lastWakeAt >= (wakeBody.at ?? 0),
    `${stamped?.lastWakeAt} vs ${wakeBody.at}`);

  // (W3) THE TWO REFUSALS, and both are 409 with NO packet. An unconfigured MAC is a fact about
  // THIS host, so the honest answer is "there is nothing to send" — never a thrown send, never a
  // 500, and never a silent 200 over a frame that never existed.
  const noMacRes = await post(`/api/helper/devices/${DEVICE_NOMAC}/wake`, {});
  const noMacErr = (await noMacRes.json()) as { error?: string };
  const badMacRes = await post(`/api/helper/devices/${DEVICE_BADMAC}/wake`, {});
  const unknownRes = await post("/api/helper/devices/e2enosuchdevi/wake", {});
  await Bun.sleep(600);
  check("(W3) no MAC configured → 409 naming the device, and no packet",
    noMacRes.status === 409 && (noMacErr.error ?? "").includes(DEVICE_NOMAC) && wakePkts.length === 1,
    `${noMacRes.status} ${JSON.stringify(noMacErr)} pkts=${wakePkts.length}`);
  check("(W3) an unparseable MAC → the same 409, and no packet",
    badMacRes.status === 409 && wakePkts.length === 1, `${badMacRes.status} pkts=${wakePkts.length}`);
  check("(W3) a device nobody has ever seen → 404 'no such device', and no packet",
    unknownRes.status === 404
      && ((await unknownRes.json()) as { error?: string }).error === "no such device"
      && wakePkts.length === 1, `${unknownRes.status} pkts=${wakePkts.length}`);
  // a HELPER may not press it: the wake door sits below the owner gate beside /mode and /update,
  // so the helper principal's exact-match scope cannot reach it and the perimeter does not grow.
  const helperTry = await hpost(`/api/helper/devices/${DEVICE}/wake`, {});
  await Bun.sleep(300);
  check("(W3) the HELPER token cannot press the wake button (owner-gated, like /mode and /update)",
    helperTry.status === 401 && wakePkts.length === 1, `${helperTry.status} pkts=${wakePkts.length}`);

  // (W4) THE AUTO-WAKE, and its FIRST check is the negative one. Device wished active, silent
  // longer than the configured window, MAC and address in place — and NO packet, because nothing
  // is waiting to be claimed. Delete that condition from the server and this is the check that
  // fails; without it the two below would pass over a tick that simply packets on a timer.
  await killSrv();
  check("(W4) setup: the server restarts with a fast wake tick, a 1 ms silence window and a grace",
    await startSrv({ audit: true, extra: { ...WAKE_ENV,
      FLEET_AUDIT_HELPER_GRACE_MS: "20000",
      FLEET_HELPER_WAKE_AFTER_MS: "1", FLEET_HELPER_WAKE_BACKOFF_MS: "600000",
      FLEET_HELPER_WAKE_TICK_MS: "250" } }));
  await Bun.sleep(750);
  // the two clocks are INDEPENDENT on purpose and this fixture leans on it: the device beats (so
  // the grace has a claim candidate to hold work for) while the wake window is 1 ms (so it is also
  // "silent long enough"). In production those are minutes apart; here they must both hold at once,
  // because what is under test is the JOB condition, not the clock.
  await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
  await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.1 });
  // registered HERE and nowhere above: this row has never been woken, so its backoff is genuinely
  // open and the silence below can only be the job condition's doing. Its desiredMode is never set
  // — DEVICE_MODE_DEFAULT resolves an absent wish to `active`, which is the state a real machine
  // nobody has decided about is in.
  await hpost("/api/helper/device", { deviceId: DEVICE_AUTO, name: "e2e box that is asleep", mode: "active", load: 0.1 });
  const autoCfg = await devOf(DEVICE_AUTO);
  check("(W4) setup: the auto-wake's own device is registered, configured and never yet woken",
    autoCfg?.wakeConfigured === true && autoCfg.lastWakeAt === undefined
      && autoCfg.desiredMode === "active" && autoCfg.desiredSet === false,
    JSON.stringify(autoCfg));
  const beforeIdle = wakePkts.length;
  await Bun.sleep(2000);   // ~8 ticks
  check("(W4) NO WORK, NO PACKET: eight ticks pass over an active, long-silent device in silence",
    wakePkts.length === beforeIdle, `${wakePkts.length - beforeIdle} packet(s) in 2s`);

  // …and now work that nobody has taken. The grace is what keeps it unclaimed for a while: the
  // local drain leaves a fresh entry alone while a claim-capable device is registered, which is
  // precisely the situation a wake exists for — a job waiting for a machine that is not there.
  const rowsBeforeWake = (await newRepoRows()).length;
  const wakeLane = await openLane(REPO, "wakework");
  await driveMerge(wakeLane, wakeLane.branch);
  const wakeSha = headOf();
  const afterOne = await waitPkts(beforeIdle + 1, 15_000);
  check("(W4) WORK WAITING + ACTIVE + SILENT: the tick sends exactly one packet, for THAT device's MAC",
    afterOne === beforeIdle + 1 && isMagicOf(wakePkts[beforeIdle]!, MAC_AUTO),
    `${afterOne - beforeIdle} packet(s), matchesAutoMac=${wakePkts[beforeIdle] ? isMagicOf(wakePkts[beforeIdle]!, MAC_AUTO) : false}`);
  check("(W4) …and the device whose button was pressed in (W2) is NOT packeted again — its backoff holds",
    !wakePkts.slice(beforeIdle).some((p) => isMagic(p)), `${wakePkts.length - beforeIdle} packet(s) since`);
  // THE BACKOFF. Same three conditions still true, ~12 more ticks — and nothing. A box that cannot
  // boot must not be packeted every tick until somebody notices.
  await Bun.sleep(3000);
  check("(W4) THE BACKOFF HOLDS: twelve further ticks under the same three conditions send nothing",
    wakePkts.length === beforeIdle + 1, `${wakePkts.length - beforeIdle} packet(s) total`);
  const autoStamped = await devOf(DEVICE_AUTO);
  check("(W4) …and the auto-wake stamped the same field the button does, on its own row",
    typeof autoStamped?.lastWakeAt === "number" && autoStamped.lastWakeAt > (wakeBody.at ?? 0),
    `${autoStamped?.lastWakeAt} vs button ${wakeBody.at}`);
  // nothing is lost by any of this: the grace lapses and the local drain takes the job, exactly as
  // it does when no wake rail exists at all.
  const wakeRows = await waitNewRepoRows(rowsBeforeWake + 1, 90_000);
  check("(W4) the wake changed nothing about the work itself — the local drain still takes it",
    wakeRows.some((r) => r.mainSha === wakeSha && !r.remote), 
    JSON.stringify(wakeRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`)));
  await waitNoLocalRun();

  // (W5) UNCONFIGURED IS THE DEFAULT, and it is a REFUSAL, not a throw. The message matters as much
  // as the status: with no address on the host the answer must be the HOST-LEVEL one, not
  // `no MAC configured for <id>` — that sentence says "the rail works, this device is not set up"
  // and would send the owner after the wrong knob. This check caught exactly that ordering on its
  // first run. This restart also puts the server back as the section above it left it, for
  // whatever runs next.
  await killSrv();
  check("(W5) setup: the server restarts with NO wake address at all",
    await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000",
      FLEET_HELPER_SWEEP_MS: "15000" } }));
  await Bun.sleep(750);
  await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
  const beforeOff = wakePkts.length;
  const offRes = await post(`/api/helper/devices/${DEVICE}/wake`, {});
  const offErr = (await offRes.json()) as { error?: string };
  await Bun.sleep(600);
  check("(W5) no wake address configured → 409 'no wake address configured', and no packet",
    offRes.status === 409 && offErr.error === "no wake address configured"
      && wakePkts.length === beforeOff, `${offRes.status} ${JSON.stringify(offErr)}`);
  check("(W5) …and the board draws no button: wakeConfigured is false for every device",
    ((await ownerDevices()) ?? []).every((d) => d.wakeConfigured === false),
    JSON.stringify(((await ownerDevices()) ?? []).map((d) => `${d.id}:${d.wakeConfigured}`)));
  wakeRx.close();

  // ===== (K8) THE CAPACITY PAIR — A DEVICE'S OWN COUNT OF ITS OWN SLOTS =========================
  // The daemon may now run more than one job at a time (helper-daemon/daemon.ts#freeSuiteSlots),
  // and that is a decision taken ENTIRELY on the other machine. This section measures the two
  // things this side of the wire owes it, and they pull in opposite directions:
  //
  //   · THE PORTAL MUST NOT STAND IN THE WAY. There has never been a "one claim per device" rule
  //     here — every refusal in `helperClaim` is per-JOB or per-REPO ("nothing may be worked on
  //     twice") — and the first checks below fasten that absence down, because it is the property
  //     the whole feature rests on and nothing was previously asserting it. A future `already
  //     claimed by this device` would pass every type check and silently cap the work-horse at one.
  //
  //   · …AND IT MUST REFUSE A MACHINE THAT SAYS IT IS FULL, using nothing but that machine's own
  //     words. The refusal is not this server's capacity policy: it reads `running` and
  //     `maxParallelSuites` off the device's last heartbeat and compares them to each other. A
  //     device that reports NEITHER (a browser on the portal page, every daemon older than this
  //     slice) is uncapped, exactly as before.
  //
  // The bogus job id is the instrument: it answers 404 through the ordinary door, so a 409 in its
  // place proves the capacity guard ran BEFORE the job was even looked up — and a 404 proves it did
  // not fire. Same request, two devices, two answers: the difference is the heartbeat, nothing else.
  {
    const CAPBOX = "e2ecapacitybox1";
    const NOJOB = "f".repeat(12);
    const beatCap = (deviceId: string, extra: Record<string, unknown>): Promise<Response> =>
      hpost("/api/helper/device", { deviceId, name: `capacity box (e2e)`, mode: "active", ...extra });
    const claimNoJob = async (deviceId: string): Promise<{ status: number; error: string }> => {
      const r = await hpost("/api/helper/claim", { jobId: NOJOB, deviceId });
      return { status: r.status, error: ((await r.json()) as { error?: string }).error ?? "" };
    };

    // --- two open jobs on one list, from two lanes' preview offers. The cheapest source of more
    // than one claimable job: an audit job is keyed by REPO (one per tree), so proving "a second
    // claim" with audits alone would need a third repo and a busy drain.
    await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.2 });
    const capA = await openLane(REPO, "capone");
    const capB = await openLane(REPO, "captwo");
    const offer = async (slot: number): Promise<string> => {
      const tok = await selfTokenOf(slot);
      const r = await fetch(`${BASE}/api/self/suite-offer`, { method: "POST",
        headers: { "x-fleet-self-token": tok, "content-type": "application/json" }, body: "{}" });
      return ((await r.json()) as { offer?: { id?: string } | null }).offer?.id ?? "";
    };
    const jobA = await offer(capA.slot);
    const jobB = await offer(capB.slot);
    check("(K8) setup: two lanes offer their preview suites — two open jobs on one list",
      /^[0-9a-f]{12}$/.test(jobA) && /^[0-9a-f]{12}$/.test(jobB) && jobA !== jobB,
      `a=${jobA} b=${jobB}`);

    // --- THE ABSENCE, ASSERTED. `DEVICE` has reported no capacity fields in this whole file, so it
    // is the uncapped case, and it takes BOTH jobs. This is the check that fails the day somebody
    // adds a per-device claim cap to the portal.
    const twoA = await hpost("/api/helper/claim", { jobId: jobA, deviceId: DEVICE });
    const twoB = await hpost("/api/helper/claim", { jobId: jobB, deviceId: DEVICE });
    const heldBoth = ((await ownerDevices()) ?? []).find((d) => d.id === DEVICE)?.claims ?? [];
    check("(K8) A DEVICE THAT REPORTS NO CAPACITY IS UNCAPPED: it claims a SECOND job while holding the first, and the board shows both",
      twoA.status === 200 && twoB.status === 200 && heldBoth.length === 2,
      `a=${twoA.status} b=${twoB.status} held=${JSON.stringify(heldBoth.map((c) => `${c.kind}:${c.ref}`))}`);

    // --- the pair on the wire: stored from the heartbeat, and carried to the owner's board
    const beat2 = await beatCap(CAPBOX, { running: 0, maxParallelSuites: 2, load: 0.1 });
    const capView = ((await ownerDevices()) ?? []).find((d) => d.id === CAPBOX);
    check("(K8) the heartbeat's capacity pair is stored and reaches the board — the one thing `load` can never say",
      beat2.ok && capView?.maxParallelSuites === 2 && capView.running === 0,
      `${beat2.status} ${JSON.stringify({ max: capView?.maxParallelSuites, running: capView?.running })}`);
    const freeAnswer = await claimNoJob(CAPBOX);
    check("(K8) precondition: with a free slot the claim door is OPEN — the bogus id falls through to the ordinary 404",
      freeAnswer.status === 404, `${freeAnswer.status} ${JSON.stringify(freeAnswer.error).slice(0, 160)}`);

    // --- …and now the same machine says it is full
    await beatCap(CAPBOX, { running: 2, maxParallelSuites: 2, load: 0.1 });
    const fullAnswer = await claimNoJob(CAPBOX);
    const controlAnswer = await claimNoJob(DEVICE);
    check("(K8) A DEVICE THAT REPORTED ITSELF FULL IS REFUSED 409 BEFORE THE JOB IS EVEN LOOKED UP — and the refusal quotes its own numbers",
      fullAnswer.status === 409 && fullAnswer.error.includes("2 of 2")
        && fullAnswer.error.includes("it said so itself"),
      `${fullAnswer.status} ${JSON.stringify(fullAnswer.error).slice(0, 200)}`);
    check("(K8) …and it is THAT DEVICE'S OWN WORDS doing the refusing: the identical request from the device that reported nothing is still a plain 404",
      controlAnswer.status === 404, `${controlAnswer.status} ${JSON.stringify(controlAnswer.error).slice(0, 120)}`);
    await beatCap(CAPBOX, { running: 1, maxParallelSuites: 2, load: 0.1 });
    const freedAnswer = await claimNoJob(CAPBOX);
    check("(K8) …and ONE heartbeat with a free slot reopens the door — the refusal is a live reading, never a latch",
      freedAnswer.status === 404, `${freedAnswer.status} ${JSON.stringify(freedAnswer.error).slice(0, 120)}`);

    // --- should-reject: the two numbers are compared against each other, so a value that is not a
    // count would make that comparison say something nobody meant
    const badFrac = await beatCap(CAPBOX, { maxParallelSuites: 1.5 });
    const badNeg = await beatCap(CAPBOX, { running: -1 });
    const badHuge = await beatCap(CAPBOX, { maxParallelSuites: 65 });
    const afterBad = ((await ownerDevices()) ?? []).find((d) => d.id === CAPBOX);
    check("(K8) should-reject: a fraction, a negative and an over-cap count are each 400 — and none of them overwrote the stored pair",
      badFrac.status === 400 && badNeg.status === 400 && badHuge.status === 400
        && afterBad?.maxParallelSuites === 2 && afterBad.running === 1,
      `frac=${badFrac.status} neg=${badNeg.status} huge=${badHuge.status}`
      + ` stored=${JSON.stringify({ max: afterBad?.maxParallelSuites, running: afterBad?.running })}`);

    // --- THE ASYMMETRY ACROSS A RESTART, and it is the whole reason `running` is not persisted.
    // The CAP is that machine's configuration and should survive a deploy; the COUNT is a live fact
    // about another machine's processes, and restoring one would be this server asserting something
    // it cannot know — in the direction that refuses a HEALTHY helper for as long as it takes the
    // next heartbeat to arrive. So the door must fall OPEN over a restart, not shut.
    await beatCap(CAPBOX, { running: 2, maxParallelSuites: 2, load: 0.1 });
    const fullBefore = await claimNoJob(CAPBOX);
    await killSrv();
    check("(K8) setup: the server restarts over a device that had just reported itself full",
      await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000",
        FLEET_HELPER_SWEEP_MS: "15000" } }) && fullBefore.status === 409,
      `beforeRestart=${fullBefore.status}`);
    await Bun.sleep(750);
    const rebooted = ((await ownerDevices()) ?? []).find((d) => d.id === CAPBOX);
    const afterRestart = await claimNoJob(CAPBOX);
    check("(K8) THE CAP SURVIVES THE RESTART AND THE COUNT DOES NOT: the board still knows the machine's size, and the claim door is open again rather than latched shut on a number nothing measured",
      rebooted?.maxParallelSuites === 2 && rebooted.running === 0 && afterRestart.status === 404,
      `stored=${JSON.stringify({ max: rebooted?.maxParallelSuites, running: rebooted?.running })}`
      + ` claim=${afterRestart.status}`);

    // ===== (K9a) A CLAIMED OFFER DOES NOT OUTLIVE ITS LANE ==========================================
    // Measured 2026-09-12 (7e601e57): a lane landed while the second-host ran its preview; the helper
    // worked on for 37 minutes and was told `409 no live claim` at the end. The fleet half of the
    // fix is that the job LEAVES THE LIST the moment the lane is gone — the list is the only thing
    // the daemon reads, so it is the only place it can learn to stop (helper-daemon/daemon.ts
    // #withdrawnRuns, driven live in e2e/helper-daemon.ts HD.10). Both of K8's offers are still
    // held by DEVICE here, so one lane is killed and the other is the control.
    // MUTATION: delete `reapLaneSuiteOffersFor(s.id)` from teardownSlotOccupant AND the `!live` arm
    // of expireHelperClaims (the list route sweeps first, so either alone still reaps) ⇒ job A stays
    // listed as claimed ⇒ red.
    const listedBeforeKill = (await jobs()).jobs.filter((j) => j.id === jobA || j.id === jobB);
    await post(`/api/slots/${capA.slot}/kill`, {});
    const listedAfterKill = (await jobs()).jobs;
    const lateA = await hpost("/api/helper/result", { jobId: jobA, exitCode: 0, tail: "ALL PASS" });
    check("(K9a) A CLAIMED PREVIEW WHOSE LANE IS KILLED LEAVES THE HELPER'S JOB LIST AT ONCE — the other claim stays",
      listedBeforeKill.length === 2 && listedBeforeKill.every((j) => j.claim !== null)
        && !listedAfterKill.some((j) => j.id === jobA)
        && listedAfterKill.some((j) => j.id === jobB && j.claim?.name === DEVICE_NAME),
      `before=${JSON.stringify(listedBeforeKill.map((j) => `${j.id}:${j.claim?.name ?? "open"}`))}`
      + ` after=${JSON.stringify(listedAfterKill.map((j) => `${j.id}:${j.claim?.name ?? "open"}`))}`);
    check("(K9a) …and a verdict for it is refused, which is exactly why a helper should stop rather than finish",
      lateA.status === 409, `${lateA.status} ${JSON.stringify(await lateA.json())}`);
    await post(`/api/slots/${capB.slot}/kill`, {});
  }

  // ===== (K9) A FULL HELPER IS WAITED FOR, NOT GIVEN UP ON AFTER 180 s ============================
  // Measured 2026-09-12 13:49–14:27 (7e601e57): both second-host slots were held; a lane offered its
  // preview, waited SUITE_OFFER_WAIT_FREE_MS for a claim that could not come and ran the suite on
  // this box, and the audit behind it went local after its 60 s grace the same way. At 14:37 this box
  // had four suite wrappers queued and the other machine none. server.ts#helperSaturation is the
  // reading both waits were missing: every claim-capable helper full, and the earliest end of its
  // claims known.
  //
  // THE FIXTURE is K8's capacity box, its cap 2 filled by two REAL claims this section makes, and
  // beating the whole time — the freshness window is a few seconds here, so a probe that stopped
  // beating would read "no candidate" and pass the negative check below for the wrong reason.
  // DEVICE is wished off first: it never reported a cap, so it would be an uncapped candidate and
  // the helper would never read as saturated at all.
  {
    const SATBOX = "e2ecapacitybox1";
    const SAT_GRACE_MS = 8000;
    await killSrv();
    check("(K9) setup: the server restarts with an 8 s grace and a 6 s freshness window",
      await startSrv({ audit: true, extra: { FLEET_AUDIT_HELPER_GRACE_MS: String(SAT_GRACE_MS),
        FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "2000" } }));
    await Bun.sleep(750);
    await setAuditMode("green");
    await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "off" });
    let satRunning = 0;
    const beatSat = (): Promise<Response> => hpost("/api/helper/device",
      { deviceId: SATBOX, name: "capacity box (e2e)", mode: "active", load: 0.1, running: satRunning, maxParallelSuites: 2 });
    await beatSat();
    const beater = setInterval(() => { void beatSat().catch(() => {}); }, 1000);
    interface OfferAnswer {
      offer?: { id?: string; offeredAt?: number } | null;
      waitPolicy?: { freeMs?: number; heldMs?: number; unclaimedMs?: number; saturatedUntil?: number | null; reason?: string | null };
    }
    const offerAs = async (slot: number, method: "GET" | "POST"): Promise<OfferAnswer> => {
      const tok = await selfTokenOf(slot);
      const r = await fetch(`${BASE}/api/self/suite-offer`, { method,
        headers: { "x-fleet-self-token": tok, "content-type": "application/json" },
        ...(method === "POST" ? { body: "{}" } : {}) });
      return (await r.json()) as OfferAnswer;
    };
    const satRow = async (): Promise<OwnerDeviceView | undefined> =>
      ((await ownerDevices()) ?? []).find((d) => d.id === SATBOX);
    try {
      const s1 = await openLane(REPO, "satone");
      const s2 = await openLane(REPO, "sattwo");
      const s3 = await openLane(REPO, "satthree");
      const o1 = await offerAs(s1.slot, "POST");
      const o2 = await offerAs(s2.slot, "POST");
      const c1 = await hpost("/api/helper/claim", { jobId: o1.offer?.id ?? "", deviceId: SATBOX });
      const c2 = await hpost("/api/helper/claim", { jobId: o2.offer?.id ?? "", deviceId: SATBOX });
      satRunning = 2;
      await beatSat();
      const full = await satRow();
      const earliest = Math.min(...(full?.claims ?? []).map((c) => c.expiresAt));
      check("(K9) setup: the capped helper holds both its slots — two live claims, and its own beat says 2 of 2",
        c1.status === 200 && c2.status === 200 && full?.claims.length === 2
          && full.running === 2 && full.maxParallelSuites === 2 && Number.isFinite(earliest),
        `claims=${c1.status}/${c2.status} row=${JSON.stringify({ claims: full?.claims.length, running: full?.running })}`);

      // (b) THE LANE'S WAIT. MUTATION: make suiteOfferWait return `unclaimedMs: SUITE_OFFER_WAIT_FREE_MS`
      // whatever helperSaturation says ⇒ unclaimedMs === 180000 and no reason ⇒ red.
      const o3 = await offerAs(s3.slot, "POST");
      const w3 = o3.waitPolicy;
      const offeredAt = o3.offer?.offeredAt ?? 0;
      check("(K9) A SATURATED HELPER STRETCHES THE LANE'S WAIT: the offer answer names the claim end and waits past 180 s for it",
        !!o3.offer?.id && w3?.freeMs === 180000 && w3.heldMs === 800000 && w3.saturatedUntil === earliest
          && (w3.unclaimedMs ?? 0) > 180000 && (w3.unclaimedMs ?? 0) >= earliest - offeredAt
          && (w3.unclaimedMs ?? Infinity) <= 900000 && /^helper saturated until ~\d\d:\d\d/.test(w3.reason ?? ""),
        `${JSON.stringify(w3)} earliest-offeredAt=${earliest - offeredAt}`);
      const g3 = await offerAs(s3.slot, "GET");
      check("(K9) …and the lane's own GET reads the same wait for the same offer",
        g3.waitPolicy?.unclaimedMs === w3?.unclaimedMs && g3.waitPolicy?.saturatedUntil === earliest,
        `get=${JSON.stringify(g3.waitPolicy)} post=${JSON.stringify(w3)}`);

      // (b') THE AUDIT'S GRACE, same reading. MUTATION: drop the `saturation ?` arm of the drain's
      // readyAt ⇒ the drain takes the land at ~8 s ⇒ a local row appears ⇒ red.
      const rowsBeforeSat = (await newRepoRows()).length;
      const satLand = await openLane(REPO, "satland");
      const satLanded = await driveMerge(satLand, satLand.branch);
      const satSha = headOf();
      await Bun.sleep(SAT_GRACE_MS + 4000);
      const heldAudit = await jobFor(REPO);
      const stillFull = await satRow();
      check("(K9) A SATURATED HELPER STRETCHES THE AUDIT GRACE: 12 s after the land, past the 8 s grace, the job is still offered and unrun here",
        satLanded.gone && !!heldAudit && heldAudit.claim === null && heldAudit.localRunning === false
          && (await liveRepo()) === null && (await newRepoRows()).length === rowsBeforeSat
          && stillFull?.claims.length === 2 && Date.now() - (stillFull?.lastSeen ?? 0) < 6000,
        `${JSON.stringify(heldAudit)} live=${await liveRepo()} rows=${(await newRepoRows()).length}/${rowsBeforeSat}`
        + ` claims=${stillFull?.claims.length} beatAge=${Date.now() - (stillFull?.lastSeen ?? 0)}ms`);
      // …and it was held FOR that machine: a slot frees (its lane goes), the machine says so, and it
      // takes exactly that tree.
      await post(`/api/slots/${s1.slot}/kill`, {});
      satRunning = 1;
      await beatSat();
      const satClaim = heldAudit ? await hpost("/api/helper/claim", { jobId: heldAudit.id, deviceId: SATBOX }) : null;
      const satClaimBody = (await satClaim?.json()) as { job?: { mainSha?: string } } | undefined;
      const satReport = await hpost("/api/helper/result",
        { jobId: heldAudit?.id ?? "", exitCode: 0, tail: "PASS  held for the saturated helper\nALL PASS" });
      const satRows = await waitNewRepoRows(rowsBeforeSat + 1);
      check("(K9) …and the moment a slot frees, that machine claims the held tree and closes it REMOTE — no local twin",
        satClaim?.status === 200 && satClaimBody?.job?.mainSha === satSha && satReport.ok
          && satRows.filter((r) => r.mainSha === satSha).length === 1
          && !!satRows.find((r) => r.mainSha === satSha)?.remote,
        `claim=${satClaim?.status} report=${satReport.status}`
        + ` rows=${JSON.stringify(satRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

      // (c) THE GEGENPROBE: no claim-capable helper, the same open offer ⇒ today's 180 s. MUTATION:
      // extend whenever any claim exists, candidate or not ⇒ unclaimedMs stays stretched ⇒ red.
      await post(`/api/helper/devices/${SATBOX}/mode`, { mode: "off" });
      const g3off = await offerAs(s3.slot, "GET");
      check("(K9) with NO claim-capable helper the wait is today's 180 s — no machine, nothing to wait for",
        g3off.waitPolicy?.unclaimedMs === 180000 && g3off.waitPolicy.saturatedUntil === null
          && g3off.waitPolicy.reason === null && !!g3off.offer?.id,
        JSON.stringify(g3off.waitPolicy));
      await post(`/api/slots/${s2.slot}/kill`, {});
      await post(`/api/slots/${s3.slot}/kill`, {});
    } finally {
      clearInterval(beater);
    }
    // leave the register as the sections after this one expect it
    await post(`/api/helper/devices/${SATBOX}/mode`, { mode: "active" });
    await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
    check("(K9) teardown: the machine is idle with an empty queue",
      await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
  }

  // ===== (K10) A TREE THE AUDIT COMMAND'S OWN GUARD WOULD DECLINE IS NEVER HANDED OVER ============
  // Measured 2026-09-02 (post-land-audits.jsonl, 02131402): private-repo-p — no package.json, no
  // fleet-e2e.ts — was bundled, sent to the second-host and cloned there twice, to come back
  // `unknown exit 127` after 92 and 152 ms, while the SAME entry run locally was a 223 ms
  // `unknown exit 42` from the command's own `[ -f fleet-e2e.ts ]` guard. The fix is one more arm of
  // server.ts#helperClaimBar, read off that guard: not listed, not claimable, no bundle, and the
  // drain runs it here at once.
  //
  // THE FIXTURE: the server runs a GUARDED audit command (the live shape, with the harness stand-in
  // behind the guard). Three trees land while the drain is held by a fourth: a foreign one (DECOY —
  // neither file), a half one (the sentinel but no package.json, which the helper's install needs)
  // and a fleet-shaped control with both. The drain is held by a REPO-WORKER latch rather than a
  // timed stand-in: a repo-worker entry is never offered and never graced, so it takes the drain at
  // once and holds it exactly until this section lets go. The control is held for the helper by a
  // long grace, so "not offered" below can never be read off an entry the drain simply got to first.
  {
    const stand = process.env.FLEET_POSTLAND_AUDIT_CMD ?? "";
    const GUARDED = `[ -f fleet-e2e.ts ] || { echo "audit skipped: not the fleet repo"; exit 42; }; '${stand}'`;
    const idOf = (dir: string): string => createHash("sha256").update(realpathSync(dir)).digest("hex").slice(0, 12);
    const fleetShaped = async (dir: string, files: string[]): Promise<void> => {
      await seedRepo(dir);
      for (const f of files) await Bun.write(`${dir}/${f}`, f === "package.json" ? "{}\n" : "// the fleet sentinel\n");
      spawnSync("git", ["-C", dir, "add", "-A"]);
      spawnSync("git", ["-C", dir, "commit", "-qm", "fleet-shaped tree"]);
    };
    const HALF = `${REPO}-guardhalf`;
    const FLO = `${REPO}-guardfleet`;
    const BLK = `${REPO}-guardblock`;
    await fleetShaped(HALF, ["fleet-e2e.ts"]);
    await fleetShaped(FLO, ["fleet-e2e.ts", "package.json"]);
    await seedRepo(BLK);
    const REL = `${REPO}-guardblock.release`;
    const LATCH = `${REPO}-guardblock-audit`;
    await Bun.write(LATCH, ["#!/bin/sh",
      `i=0; while [ ! -f ${JSON.stringify(REL)} ] && [ "$i" -lt 400 ]; do sleep 0.2; i=$((i + 1)); done`,
      'echo "PASS  guard section blocker released"', 'echo "ALL PASS"', "exit 0"].join("\n"));
    chmodSync(LATCH, 0o755);

    await killSrv();
    check("(K10) setup: the server restarts with a GUARDED audit command, a long grace, and a work budget the latch fits in",
      stand.startsWith("/") && await startSrv({ audit: true, extra: { FLEET_POSTLAND_AUDIT_CMD: GUARDED,
        FLEET_POSTLAND_AUDIT_TIMEOUT_MS: "120000", FLEET_AUDIT_HELPER_GRACE_MS: "120000",
        FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "120000" } }),
      `stand-in=${stand}`);
    await Bun.sleep(750);
    await setAuditMode("green");
    await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
    await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.1 });
    const blkSet = await post("/api/repo-worker", { repo: BLK, worker: "audit", cmd: LATCH });
    const blkLane = await openLane(BLK, "guardblock");
    const blkLanded = await driveMerge(blkLane, blkLane.branch);
    check("(K10) setup: a repo-worker latch holds the drain",
      blkSet.ok && blkLanded.gone && await waitLocalRun(BLK), `set=${blkSet.status} live=${await liveRepo()}`);

    const foreignBefore = (await rowsFor(DECOY)).length;
    const halfBefore = (await rowsFor(HALF)).length;
    const floBefore = (await rowsFor(FLO)).length;
    for (const [dir, name] of [[DECOY, "guardforeign"], [HALF, "guardhalf"], [FLO, "guardfleet"]] as const) {
      const ln = await openLane(dir, name);
      await driveMerge(ln, ln.branch);
    }
    const floSha = spawnSync("git", ["-C", FLO, "rev-parse", "main"]).stdout.toString().trim();
    const listed = (await jobs()).jobs;
    const floJob = listed.find((j) => j.repo === base(FLO));
    check("(K10) setup: the fleet-shaped control is queued and offered, and its id is the sha256 of its realpath",
      !!floJob && floJob.kind === "audit" && floJob.id === idOf(FLO) && floJob.claim === null
        && (await liveRepo()) === base(BLK),
      `${JSON.stringify(listed.map((j) => `${j.repo}:${j.kind}:${j.id}`))} want=${idOf(FLO)} live=${await liveRepo()}`);

    // MUTATION: delete the `foreign-tree` arm from helperClaimBar ⇒ DECOY and HALF are listed and
    // their claims answer 200 with a bundle on disk ⇒ both checks below go red.
    const bundleDir = `${tmpdir()}/fleet-helper-bundles`;
    const bundlesFor = (id: string): string[] => {
      try { return readdirSync(bundleDir).filter((f) => f.startsWith(`${id}-`)); } catch { return []; }
    };
    const foreignClaim = await hpost("/api/helper/claim", { jobId: idOf(DECOY), deviceId: DEVICE });
    const foreignErr = ((await foreignClaim.json()) as { error?: string; job?: unknown });
    const halfClaim = await hpost("/api/helper/claim", { jobId: idOf(HALF), deviceId: DEVICE });
    const halfErr = ((await halfClaim.json()) as { error?: string; job?: unknown });
    check("(K10) A FOREIGN TREE IS NOT HANDED OVER: off the list, its claim is a 409 naming the guard, no job object, no bundle built",
      !listed.some((j) => j.repo === base(DECOY)) && foreignClaim.status === 409
        && (foreignErr.error ?? "").includes("guard") && foreignErr.job === undefined
        && bundlesFor(idOf(DECOY)).length === 0,
      `listed=${listed.some((j) => j.repo === base(DECOY))} ${foreignClaim.status} ${JSON.stringify(foreignErr)} bundles=${bundlesFor(idOf(DECOY))}`);
    check("(K10) …and neither is a tree with the sentinel but no package.json — the helper installs before it runs anything",
      !listed.some((j) => j.repo === base(HALF)) && halfClaim.status === 409
        && (halfErr.error ?? "").includes("package.json") && bundlesFor(idOf(HALF)).length === 0,
      `listed=${listed.some((j) => j.repo === base(HALF))} ${halfClaim.status} ${JSON.stringify(halfErr)}`);

    const floClaim = await hpost("/api/helper/claim", { jobId: floJob?.id ?? "", deviceId: DEVICE });
    const floBody = (await floClaim.json()) as { job?: { mainSha?: string } };
    const floBundles = bundlesFor(idOf(FLO));
    check("(K10) THE FLEET-SHAPED CONTROL IS HANDED OVER UNCHANGED — claimed on its landed sha, and its bundle IS in the directory the probe above reads",
      floClaim.status === 200 && floBody.job?.mainSha === floSha && floBundles.length === 1,
      `${floClaim.status} ${JSON.stringify(floBody)} want=${floSha} bundles=${JSON.stringify(floBundles)} dir=${bundleDir}`);
    const floReport = await hpost("/api/helper/result",
      { jobId: floJob?.id ?? "", exitCode: 0, tail: "PASS  the fleet-shaped control, remote\nALL PASS" });

    await Bun.write(REL, "go\n");
    const foreignRows = await waitRowsFor(DECOY, foreignBefore + 1, 120_000);
    const halfRows = await waitRowsFor(HALF, halfBefore + 1, 60_000);
    const floRows = await waitRowsFor(FLO, floBefore + 1, 30_000);
    const foreignRow = foreignRows[0];
    check("(K10) …AND THE FOREIGN ENTRY IS ANSWERED HERE, as the guard's own non-measurement: local, unknown, exit 42",
      foreignRows.length === foreignBefore + 1 && !!foreignRow && !foreignRow.remote
        && foreignRow.result === "unknown" && foreignRow.exitCode === 42
        && foreignRow.out.includes("audit skipped: not the fleet repo"),
      JSON.stringify(foreignRow).slice(0, 300));
    check("(K10) …the half tree is run here too (its guard passes locally), and the control's only row is the remote one",
      halfRows.length === halfBefore + 1 && !halfRows[0]?.remote
        && floReport.ok && floRows.length === floBefore + 1 && floRows[0]?.remote?.name === DEVICE_NAME
        && floRows[0]?.mainSha === floSha,
      `half=${JSON.stringify(halfRows[0]).slice(0, 160)} flo=${JSON.stringify(floRows.map((r) => `${r.mainSha.slice(0, 8)}:${r.remote ? "remote" : "local"}`))}`);

    await post("/api/repo-worker", { repo: BLK, worker: "audit", cmd: "" }); // leave the register as found
    check("(K10) teardown: the machine is idle with an empty queue",
      await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
  }

  // ===== (K11) THE SHARDED AUDIT — FLEET_AUDIT_SHARDS: one entry, n helper jobs, ONE ledger row ====
  // server.ts#AuditShardRun. Measured before it (2026-09-14): every second-host audit one serial run of
  // 1 830–2 010 s, land→verdict 75–100 min. The runner already splits (`--shard k/n`); what is proven
  // here is the server's half: the fan-out, the capability guard, the merge (green only with all n
  // green, a red is red, a lapse is unknown), the local fallback staying unsharded, and an unreadable
  // value staying 1.
  //
  // THE FIXTURE: shards 3, a long grace (so the drain leaves a fresh entry for the helper), a 20 s claim
  // window (so the lapse is reachable) and a 1 s sweep — which makes the freshness window 3 s, hence the
  // beater. SHARDBOX declares `audit-shard`; DEVICE beats beside it WITHOUT the feature, the old daemon.
  {
    const SHARDBOX = "e2eshardbox01";
    const SHARD_NAME = "shard box (e2e)";
    const sha12 = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 12);
    const wholeIdOf = (dir: string): string => sha12(realpathSync(dir));
    const shardIdsOf = (dir: string, n: number): string[] =>
      Array.from({ length: n }, (_, i) => sha12(`${realpathSync(dir)}\u0000shard:${i + 1}/${n}`));
    let beatBox = true;
    const beat = async (): Promise<void> => {
      if (beatBox) await hpost("/api/helper/device", { deviceId: SHARDBOX, name: SHARD_NAME, mode: "active", load: 0.1,
        running: 0, maxParallelSuites: 3, features: ["audit-shard"] });
      await hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME, mode: "active", load: 0.1 });
    };
    const boxJobs = async (): Promise<HelperJobs> =>
      (await (await hget(`/api/helper/jobs?deviceId=${SHARDBOX}`)).json()) as HelperJobs;
    const repoJobs = (list: HelperJobs): HelperJob[] => list.jobs.filter((j) => j.repo === base(REPO));
    interface ClaimBody { job?: { id: string; mainSha: string; shard?: string; claimedAt: number }; error?: string }
    const claimAll = async (ids: string[]): Promise<{ statuses: number[]; bodies: ClaimBody[] }> => {
      const res = await Promise.all(ids.map((id) => hpost("/api/helper/claim", { jobId: id, deviceId: SHARDBOX })));
      return { statuses: res.map((r) => r.status), bodies: await Promise.all(res.map(async (r) => (await r.json()) as ClaimBody)) };
    };
    const report = (id: string, body: Record<string, unknown>): Promise<Response> =>
      hpost("/api/helper/result", { jobId: id, ...body });
    const shardLine = (r: Row | undefined): string =>
      (r?.shards ?? []).map((s) => `${s.k}:${s.result}:${s.ran}:${s.failed}:${s.exitCode}`).join(",");

    await killSrv();
    check("(K11) setup: the server restarts with FLEET_AUDIT_SHARDS=3, a long grace, a 20 s claim window and a 1 s sweep",
      await startSrv({ audit: true, extra: { FLEET_AUDIT_SHARDS: "3", FLEET_AUDIT_HELPER_GRACE_MS: "120000",
        FLEET_HELPER_CLAIM_TIMEOUT_MS: "20000", FLEET_HELPER_SWEEP_MS: "1000" } }));
    await Bun.sleep(750);
    await setAuditMode("green");
    await post(`/api/helper/devices/${DEVICE}/mode`, { mode: "active" });
    await beat();
    const beater = setInterval(() => { void beat().catch(() => {}); }, 700);
    try {
      // (1) FAN-OUT, and the guard on both doors. MUTATION: drop `if (shardCapable)` in helperJobsView ⇒
      // DEVICE is listed three shard jobs ⇒ the guard check goes red; drop the feature test in
      // claimAuditShard ⇒ DEVICE's claim answers 200 ⇒ red.
      const ids = shardIdsOf(REPO, 3);
      const rowsBefore = (await newRepoRows()).length;
      const g = await openLane(REPO, "shardgreen");
      const gLanded = await driveMerge(g, g.branch);
      const gSha = headOf();
      await Bun.sleep(1500);
      const fan = repoJobs(await boxJobs());
      check("(K11) FAN-OUT: one land under FLEET_AUDIT_SHARDS=3 is offered as THREE audit jobs 1/3..3/3, unclaimed, not run here",
        gLanded.gone && fan.length === 3 && fan.map((j) => j.shard).join(",") === "1/3,2/3,3/3"
          && fan.every((j) => j.kind === "audit" && j.claim === null && j.covers === 1 && j.branches.includes(g.branch))
          && fan.map((j) => j.id).join(",") === ids.join(",") && (await liveRepo()) === null
          && (await newRepoRows()).length === rowsBefore,
        `${JSON.stringify(fan.map((j) => `${j.shard}:${j.id}:${j.claim ? "claimed" : "open"}`))} want=${ids} live=${await liveRepo()}`);
      const plainList = repoJobs(await jobs());
      const plainClaim = await hpost("/api/helper/claim", { jobId: ids[0], deviceId: DEVICE });
      const plainErr = (await plainClaim.json()) as { error?: string; job?: unknown };
      check("(K11) THE CAPABILITY GUARD: a daemon that never declared audit-shard is listed NO shard job, and its claim of one is a 409",
        plainList.length === 0 && plainClaim.status === 409 && (plainErr.error ?? "").includes("audit-shard")
          && plainErr.job === undefined,
        `listed=${JSON.stringify(plainList.map((j) => j.shard ?? "whole"))} ${plainClaim.status} ${JSON.stringify(plainErr)}`);
      const wholeClaim = await hpost("/api/helper/claim", { jobId: wholeIdOf(REPO), deviceId: SHARDBOX });
      const wholeErr = (await wholeClaim.json()) as { error?: string };
      check("(K11) should-reject: the WHOLE-suite job id is refused while the same audit is offered as shards",
        wholeClaim.status === 409 && (wholeErr.error ?? "").includes("3 shards"), `${wholeClaim.status} ${JSON.stringify(wholeErr)}`);

      // (2) THREE CONCURRENT CLAIMS, ONE TREE. They race the bundle build on purpose (a daemon with three
      // free slots POSTs all three in one tick). MUTATION: build a bundle per claim without the shared
      // opening ⇒ two of three answer 409 "try again" ⇒ red.
      const g3 = await claimAll(ids);
      const minClaimedAt = Math.min(...g3.bodies.map((b) => b.job?.claimedAt ?? Infinity));
      check("(K11) three CONCURRENT shard claims are all granted, each naming its shard, all on the one landed tree",
        g3.statuses.every((st) => st === 200) && g3.bodies.every((b) => b.job?.mainSha === gSha)
          && g3.bodies.map((b) => b.job?.shard).join(",") === "1/3,2/3,3/3",
        `${g3.statuses} ${JSON.stringify(g3.bodies.map((b) => b.job ? `${b.job.shard}@${b.job.mainSha.slice(0, 8)}` : b.error))} want=${gSha.slice(0, 8)}`);
      const bundles = await Promise.all(ids.map(async (id) => {
        const r = await hget(`/api/helper/bundle/${id}`);
        return { status: r.status, sha: createHash("sha256").update(new Uint8Array(await r.arrayBuffer())).digest("hex") };
      }));
      check("(K11) …and every shard downloads the SAME bundle — one tree, by construction",
        bundles.every((b) => b.status === 200) && new Set(bundles.map((b) => b.sha)).size === 1,
        JSON.stringify(bundles.map((b) => `${b.status}:${b.sha.slice(0, 8)}`)));
      const boxRow = ((await ownerDevices()) ?? []).find((d) => d.id === SHARDBOX);
      check("(K11) EACH SHARD HOLDS ONE SLOT: the owner's board shows three audit claims on that one machine",
        boxRow?.claims.length === 3 && boxRow.claims.every((c) => c.kind === "audit" && c.repo === base(REPO)),
        JSON.stringify(boxRow?.claims));

      // (3) ALL GREEN. MUTATION: write the row on the FIRST report ⇒ a row exists after two ⇒ red.
      const r1 = await report(ids[0]!, { exitCode: 0, fails: [], trail: "isolated-20260914T1200Z-1111",
        tail: "PASS  shard one a\nPASS  shard one b\nALL PASS" });
      const r2 = await report(ids[1]!, { exitCode: 0, fails: [], trail: "isolated-20260914T1200Z-2222",
        tail: "PASS  shard two a\nPASS  shard two b\nALL PASS" });
      await Bun.sleep(1200);
      const midList = repoJobs(await boxJobs());
      check("(K11) NO ROW WHILE A SHARD IS OUT: two green reports write nothing, and only shard 3/3 stays listed, claimed",
        r1.ok && r2.ok && (await newRepoRows()).length === rowsBefore
          && midList.length === 1 && midList[0]?.shard === "3/3" && midList[0].claim?.name === SHARD_NAME,
        `${r1.status}/${r2.status} rows=${(await newRepoRows()).length}/${rowsBefore} list=${JSON.stringify(midList.map((j) => j.shard))}`);
      const r3 = await report(ids[2]!, { exitCode: 0, fails: [], trail: "isolated-20260914T1200Z-3333",
        tail: "PASS  shard three a\nALL PASS" });
      const r3Body = (await r3.json()) as { result?: string; auditResult?: string; artifactAt?: number };
      const gRows = await waitNewRepoRows(rowsBefore + 1, 20_000);
      const gRow = gRows.find((r) => r.mainSha === gSha);
      check("(K11) ALL THREE GREEN ⇒ ONE green row: checks.ran is the SUM (2+2+1), and `shards` carries each shard's own count",
        r3.ok && gRows.length === rowsBefore + 1 && gRow?.result === "green" && gRow.exitCode === 0
          && gRow.checks?.ran === 5 && gRow.checks.failed === 0
          && shardLine(gRow) === "1:green:2:0:0,2:green:2:0:0,3:green:1:0:0"
          && (gRow.shards ?? []).map((s) => s.jobId).join(",") === ids.join(",")
          && gRow.covers.some((c) => c.branch === g.branch) && gRow.remote?.name === SHARD_NAME,
        `rows=${gRows.length - rowsBefore} ${JSON.stringify(gRow).slice(0, 400)}`);
      check("(K11) …ms runs from the FIRST claim to the LAST result, and the answer that wrote the row hands back its key",
        !!gRow && gRow.startedAt === minClaimedAt && gRow.remote?.claimedAt === minClaimedAt
          && gRow.ms === (gRow.remote?.reportedAt ?? 0) - minClaimedAt && gRow.ms >= 0
          && r3Body.auditResult === "green" && r3Body.artifactAt === gRow.at,
        `startedAt=${gRow?.startedAt} firstClaim=${minClaimedAt} ms=${gRow?.ms} reportedAt=${gRow?.remote?.reportedAt} answer=${JSON.stringify(r3Body)}`);
      const lateShard = await report(ids[0]!, { exitCode: 0, tail: "ALL PASS" });
      check("(K11) should-reject: a second report for a shard of a finished run is a 409 — one run, one row",
        lateShard.status === 409, `${lateShard.status}`);

      // (4) ONE RED. The red is shard 2 and shard 3 reports AFTER it, green, so a merge that kept only the
      // last report's fails (or verdict) goes red here. MUTATION: drop the `reds.length ? "red"` arm ⇒ unknown ⇒ red.
      const rowsBeforeRed = (await newRepoRows()).length;
      const red = await openLane(REPO, "shardred");
      await driveMerge(red, red.branch);
      const redSha = headOf();
      await Bun.sleep(1500);
      const redClaims = await claimAll(ids);
      await report(ids[0]!, { exitCode: 0, fails: [], tail: "PASS  one ok\nALL PASS" });
      await report(ids[1]!, { exitCode: 1, fails: ["alpha check", "beta check"],
        tail: "PASS  two ok\nFAIL  alpha check\nFAIL  beta check\n2 FAILURES" });
      await report(ids[2]!, { exitCode: 0, fails: [], tail: "PASS  three ok\nALL PASS" });
      const redRows = await waitNewRepoRows(rowsBeforeRed + 1, 20_000);
      const redRow = redRows.find((r) => r.mainSha === redSha);
      check("(K11) ONE RED SHARD ⇒ the row is RED, with that shard's fails, its exit code, and the sums across all three",
        redClaims.statuses.every((st) => st === 200) && redRow?.result === "red" && redRow.exitCode === 1
          && JSON.stringify(redRow.fails) === '["alpha check","beta check"]'
          && redRow.checks?.ran === 5 && redRow.checks.failed === 2
          && shardLine(redRow) === "1:green:1:0:0,2:red:3:2:1,3:green:1:0:0"
          && redRow.out.includes("FAIL  alpha check") && redRow.reason === undefined,
        `${redClaims.statuses} ${JSON.stringify(redRow).slice(0, 500)}`);

      // (5) ONE LAPSED ⇒ UNKNOWN, NEVER GREEN. Two green reports and a third claim that never comes back.
      // MUTATION: drop `reported.length === n` from the merge ⇒ a green row ⇒ red.
      const rowsBeforeLapse = (await newRepoRows()).length;
      const lapse = await openLane(REPO, "shardlapse");
      await driveMerge(lapse, lapse.branch);
      const lapseSha = headOf();
      await Bun.sleep(1500);
      const lapseClaims = await claimAll(ids);
      await report(ids[0]!, { exitCode: 0, fails: [], tail: "PASS  one ok\nALL PASS" });
      await report(ids[1]!, { exitCode: 0, fails: [], tail: "PASS  two ok\nALL PASS" });
      const lapseRows = await waitNewRepoRows(rowsBeforeLapse + 1, 45_000);
      const lapseRow = lapseRows.find((r) => r.mainSha === lapseSha);
      check("(K11) ONE SHARD LAPSED ⇒ the row is UNKNOWN, never green: no exit code, no counts, and the reason names the lapsed shard",
        lapseClaims.statuses.every((st) => st === 200) && lapseRow?.result === "unknown" && lapseRow.exitCode === null
          && lapseRow.checks === null && (lapseRow.reason ?? "").includes("shard 3/3 lapsed")
          && shardLine(lapseRow) === "1:green:1:0:0,2:green:1:0:0,3:unknown:null:null:null"
          && lapseRow.shards?.[2]?.ms === null && !!lapseRow.remote,
        `${lapseClaims.statuses} ${JSON.stringify(lapseRow).slice(0, 500)}`);
      const lateLapsed = await report(ids[2]!, { exitCode: 0, tail: "ALL PASS" });
      const afterLapse = await boxJobs();
      await Bun.sleep(2500); // a (wrong) local twin would start within a sweep of the row
      check("(K11) …the lapse is BOOKED against the shard's own job, its late verdict is a 409, and the tree is NOT re-audited here",
        lateLapsed.status === 409 && afterLapse.lapsed.some((l) => l.id === ids[2] && l.name === SHARD_NAME)
          && (await newRepoRows()).filter((r) => r.mainSha === lapseSha).length === 1 && (await liveRepo()) === null,
        `${lateLapsed.status} lapsed=${JSON.stringify(afterLapse.lapsed.map((l) => l.id))} rows=${(await newRepoRows()).filter((r) => r.mainSha === lapseSha).length}`);

      // (K11b/c/d) CO-RESIDENCE — did a SIBLING shard of this same audit hold an overlapping window on
      // the SAME machine (server.ts#shardCoResidence)? Derived from the two instants the run already
      // has; the row could never answer it, because it keeps each shard's DURATION and the run's outer
      // span and nothing pairwise.
      // WHY IT IS ON THE ROW AT ALL: co-residence is the NORM on this fleet — 41 of 43 measurable
      // sharded rows in `post-land-audits.jsonl` must have overlapped (2026-09-17, inferred as
      // `sum(shard.ms) > row.ms`, which was the only reading the row allowed) — so a red row cannot be
      // ATTRIBUTED to load without this mark, and must not be attributed TO it either. The contract for
      // reading it is docs/verify-tiering.md §11.2y.
      // THE 40 ms SLEEPS ARE LOAD-BEARING, not politeness: a claim and a report inside ONE millisecond
      // is a ZERO-LENGTH window, and a zero-length window overlaps nothing — by the same strictness
      // that makes (K11c) provable (`[a,b]` and `[b,c]` are disjoint). Forcing the window open is what
      // makes both directions deterministic instead of dependent on how fast this machine answers.
      const BOX2 = "e2eshardbox02";
      const BOX2_NAME = "second shard box (e2e)";
      await hpost("/api/helper/device", { deviceId: BOX2, name: BOX2_NAME, mode: "active", load: 0.1,
        running: 0, maxParallelSuites: 3, features: ["audit-shard"] });
      const coLine = (r: Row | undefined): string => (r?.shards ?? [])
        .map((x) => `${x.k}:${x.coResident ? `[${x.coResident.with}]/${x.coResident.unknownWindows}` : "ABSENT"}`).join(",");
      const claimAs = (id: string, deviceId: string): Promise<Response> =>
        hpost("/api/helper/claim", { jobId: id, deviceId });

      // (K11b) OVERLAPPING, and the HOST half is what keeps the mark from being a bare clock comparison:
      // shards 1+2 run on one box, shard 3 on ANOTHER at the very same time. MUTATION: drop the
      // sameShardHost test ⇒ shard 3 is listed as a co-resident of 1 and 2 ⇒ red.
      const rowsBeforeCo = (await newRepoRows()).length;
      const co = await openLane(REPO, "shardcores");
      await driveMerge(co, co.branch);
      const coSha = headOf();
      await Bun.sleep(1500);
      const coClaims = await Promise.all([claimAs(ids[0]!, SHARDBOX), claimAs(ids[1]!, SHARDBOX), claimAs(ids[2]!, BOX2)]);
      await Bun.sleep(40);
      for (const id of ids) await report(id, { exitCode: 0, fails: [], tail: "PASS  co-resident\nALL PASS" });
      const coRows = await waitNewRepoRows(rowsBeforeCo + 1, 20_000);
      const coRow = coRows.find((r) => r.mainSha === coSha);
      const coS = (k: number): { with: number[]; ms: number; unknownWindows: number } | undefined =>
        coRow?.shards?.[k - 1]?.coResident;
      check("(K11b) CO-RESIDENCE: two shards on ONE host with overlapping windows name each other, and the third — another host, same moment — names nobody",
        coClaims.every((r) => r.status === 200) && coRow?.result === "green"
          && coLine(coRow) === "1:[2]/0,2:[1]/0,3:[]/0"
          && (coS(1)?.ms ?? 0) >= 40 && coS(3)?.ms === 0 && (coS(1)?.ms ?? 0) === (coS(2)?.ms ?? -1),
        `${coClaims.map((r) => r.status)} ${coLine(coRow)} ms=${coS(1)?.ms}/${coS(2)?.ms}/${coS(3)?.ms}`);

      // (K11c) THE OTHER DIRECTION, same host, same three jobs: claimed and reported STRICTLY ONE AFTER
      // ANOTHER. An empty `with` STAYS on the row — that is the measured "disjoint", and losing it is how
      // "unknown" starts reading as "no". MUTATION: collapse the empty `with` into an absent key
      // (`...(list.length ? { coResident } : {})`) ⇒ three ABSENTs here ⇒ red.
      const rowsBeforeSer = (await newRepoRows()).length;
      const ser = await openLane(REPO, "shardserial");
      await driveMerge(ser, ser.branch);
      const serSha = headOf();
      await Bun.sleep(1500);
      const serStatuses: number[] = [];
      for (const id of ids) {
        serStatuses.push((await claimAs(id, SHARDBOX)).status);
        await Bun.sleep(40);
        await report(id, { exitCode: 0, fails: [], tail: "PASS  serial\nALL PASS" });
      }
      const serRows = await waitNewRepoRows(rowsBeforeSer + 1, 20_000);
      const serRow = serRows.find((r) => r.mainSha === serSha);
      check("(K11c) …and the SAME host claimed SERIALLY is marked DISJOINT: an empty `with`, zero overlap, on every shard",
        serStatuses.every((st) => st === 200) && serRow?.result === "green"
          && coLine(serRow) === "1:[]/0,2:[]/0,3:[]/0"
          && (serRow.shards ?? []).length === 3 && (serRow.shards ?? []).every((x) => x.coResident?.ms === 0),
        `${serStatuses} ${coLine(serRow)}`);

      // (K11d) THE THIRD STATE, and the reason the two above are not enough on their own: a shard that
      // NEVER HELD A WINDOW carries NO KEY. Shard 3 is sibling-closed by the red on shard 2 without ever
      // being claimed, so there is nothing to derive about it — and its two siblings say so, each
      // counting it as one unknown window beside their own measured overlap. MUTATION: give an unclaimed
      // shard `{ with: [], ms: 0, unknownWindows: 0 }` ⇒ "3:[]/0" and "1:[2]/0" here ⇒ red.
      const rowsBeforeUnk = (await newRepoRows()).length;
      const unk = await openLane(REPO, "shardnowindow");
      await driveMerge(unk, unk.branch);
      const unkSha = headOf();
      await Bun.sleep(1500);
      const unkStatuses = (await Promise.all([claimAs(ids[0]!, SHARDBOX), claimAs(ids[1]!, SHARDBOX)])).map((r) => r.status);
      await Bun.sleep(40);
      await report(ids[0]!, { exitCode: 0, fails: [], tail: "PASS  one ok\nALL PASS" });
      await report(ids[1]!, { exitCode: 1, fails: ["gamma check"], tail: "FAIL  gamma check\n1 FAILURES" });
      const unkRows = await waitNewRepoRows(rowsBeforeUnk + 1, 20_000);
      const unkRow = unkRows.find((r) => r.mainSha === unkSha);
      check("(K11d) AN UNCLAIMED SHARD HAS NO WINDOW: no `coResident` key at all, while its two siblings carry their overlap AND count it as one unknown window",
        unkStatuses.every((st) => st === 200) && unkRow?.result === "red"
          && coLine(unkRow) === "1:[2]/1,2:[1]/1,3:ABSENT"
          && (unkRow.shards?.[0]?.coResident?.ms ?? 0) >= 40 && unkRow.shards?.[2]?.ms === null,
        `${unkStatuses} ${coLine(unkRow)} result=${unkRow?.result}`);
      // leave the register as (6) needs it: the second box must be no candidate for the drain's grace
      await post(`/api/helper/devices/${BOX2}/mode`, { mode: "off" });

      // (6) NO SHARD-CAPABLE HELPER ⇒ LOCAL, UNSHARDED, AT ONCE. DEVICE keeps beating active without the
      // feature. MUTATION: drop the feature from the drain's grace candidate ⇒ the entry is held the whole
      // 120 s grace for a machine that is never offered its shards ⇒ no row inside 30 s ⇒ red.
      beatBox = false;
      await post(`/api/helper/devices/${SHARDBOX}/mode`, { mode: "off" });
      const rowsBeforeLocal = (await newRepoRows()).length;
      const loc = await openLane(REPO, "shardlocal");
      await driveMerge(loc, loc.branch);
      const locSha = headOf();
      const locRows = await waitNewRepoRows(rowsBeforeLocal + 1, 30_000);
      const locRow = locRows.find((r) => r.mainSha === locSha);
      check("(K11) with NO shard-capable helper the drain runs it HERE at once — a local row, unsharded, no remote",
        !!locRow && locRow.result === "green" && !locRow.remote && locRow.shards === undefined,
        `rows=${locRows.length - rowsBeforeLocal} ${JSON.stringify(locRow).slice(0, 300)}`);
    } finally {
      clearInterval(beater);
    }
    await waitNoLocalRun(60_000);

    // (7) AN UNREADABLE VALUE STAYS 1, AND SAYS SO. MUTATION: parse "three" as anything but 1 ⇒ no log line
    // and/or no whole job ⇒ red.
    await killSrv();
    const logBefore = existsSync(`${ROOT}/server.log`) ? readFileSync(`${ROOT}/server.log`, "utf8").length : 0;
    check("(K11) setup: the server restarts with FLEET_AUDIT_SHARDS=three",
      await startSrv({ audit: true, extra: { FLEET_AUDIT_SHARDS: "three", FLEET_AUDIT_HELPER_GRACE_MS: "120000",
        FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000", FLEET_HELPER_SWEEP_MS: "15000" } }));
    await Bun.sleep(750);
    await post(`/api/helper/devices/${SHARDBOX}/mode`, { mode: "active" });
    await hpost("/api/helper/device", { deviceId: SHARDBOX, name: SHARD_NAME, mode: "active", load: 0.1,
      running: 0, maxParallelSuites: 3, features: ["audit-shard"] });
    const bootLog = readFileSync(`${ROOT}/server.log`, "utf8").slice(logBefore);
    const rowsBeforeBad = (await newRepoRows()).length;
    const bad = await openLane(REPO, "shardbadvalue");
    await driveMerge(bad, bad.branch);
    const badSha = headOf();
    await Bun.sleep(1500);
    const badList = repoJobs(await boxJobs());
    const badClaim = await hpost("/api/helper/claim", { jobId: badList[0]?.id ?? "", deviceId: SHARDBOX });
    const badReport = await report(badList[0]?.id ?? "", { exitCode: 0, tail: "PASS  whole again\nALL PASS" });
    const badRows = await waitNewRepoRows(rowsBeforeBad + 1, 20_000);
    const badRow = badRows.find((r) => r.mainSha === badSha);
    const badKeys = Object.keys(badRow ?? {}).filter((k) => k !== "adjudication" && k !== "ping").join(",");
    check("(K11) an UNREADABLE FLEET_AUDIT_SHARDS logs one line and stays 1: one whole job, and a row with exactly the unsharded keys",
      bootLog.includes('FLEET_AUDIT_SHARDS="three" is not a shard count') && badList.length === 1
        && badList[0]?.shard === undefined && badList[0]?.id === wholeIdOf(REPO)
        && badClaim.status === 200 && badReport.ok && badRow?.result === "green" && badRow.shards === undefined
        && badKeys === "at,startedAt,ms,repo,main,mainSha,result,cmd,exitCode,out,checks,covers,remote",
      `log=${bootLog.includes("FLEET_AUDIT_SHARDS")} list=${JSON.stringify(badList.map((j) => j.shard ?? j.id))} claim=${badClaim.status} keys=${badKeys}`);
    // leave the register as the harness after this one expects it: the shard box is no candidate
    await post(`/api/helper/devices/${SHARDBOX}/mode`, { mode: "off" });
    check("(K11) teardown: the machine is idle with an empty queue",
      await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
  }

  // ===== (K12) A RUNNER THAT DIES WITHOUT A RESULT STILL DELIVERS A VERDICT =======================
  // Measured 2026-09-18 (job f5f181f6433f, second-host journal): a lane succession reaped the RUNNING
  // preview three minutes into its claim — the daemon read its own job list and withdrew
  // ("ended by withdrawal after 168s — nothing reported", by design), the successor read
  // `offer: null` while the job was still live, and the lane waited 1 h 38 min for a verdict that
  // no longer had a runner. Two halves, one causal chain, both driven here with a STAND-IN RUNNER
  // that claims and then never reports:
  //   (a) the baton: an open/claimed offer keeps its identity (slot + openedAt) across
  //       POST /api/self/succeed — the successor sees it on GET and receives the verdict;
  //   (b) the deadline: a claim that expires WITHOUT a report settles the job `lapsed` WITH a
  //       verdict — `unknown`, `remote.reason: "timeout"`, the budget it died at — and a pane
  //       event to the offering lane. Never green, never silent, and nothing re-runs by itself:
  //       the lane decides what happens to its tree.
  // MUTATIONS: drop the transfer loop in succeedLane ⇒ (a)'s GET reads `offer: null` and the
  // sweep reaps the job before the report ⇒ red. Drop the sweep's laneSuiteLapseResult + queue
  // push ⇒ (b) has `result: null` and no event ⇒ red. Let laneSuiteWatchMessage fall through to
  // `no failures` on `result: "unknown"` ⇒ (b2) ⇒ red.
  {
    interface K12EventRow {
      id?: string; kind?: string; delivery?: string; status?: string;
      receiverSlot?: number | null; receiverOpenedAt?: number | null;
      subjectJobId?: string;
      payload?: { result?: string; exitCode?: number | null; failCount?: number; reason?: string };
    }
    interface K12Offer {
      id?: string; state?: string; branch?: string;
      claim?: { name: string; claimedAt: number; expiresAt: number } | null;
      result?: { result?: string; exitCode?: number | null;
        remote?: { name?: string; reason?: string; timeoutMs?: number } } | null;
    }
    const RELAY = "e2ek12relaybox01";
    const RELAY_NAME = "k12 relay box (e2e)";
    const beatRelay = (): Promise<Response> => hpost("/api/helper/device",
      { deviceId: RELAY, name: RELAY_NAME, mode: "active", load: 0.1 });
    const k12Events = async (): Promise<K12EventRow[]> =>
      ((await (await get("/api/events")).json()) as { events?: K12EventRow[] }).events ?? [];
    const eventsFor = async (job: string): Promise<K12EventRow[]> =>
      (await k12Events()).filter((e) => e.kind === "lane-suite" && e.subjectJobId === job);
    const waitForEvent = async (job: string): Promise<K12EventRow[]> => {
      const deadline = Date.now() + 15_000;
      for (;;) {
        const rows = await eventsFor(job);
        if (rows.length || Date.now() >= deadline) return rows;
        await Bun.sleep(200);
      }
    };
    // the lane's own reads and writes, by credential — the same shapes every suite-offer section above uses
    const offerPost = async (tok: string): Promise<K12Offer | null | undefined> =>
      ((await (await fetch(`${BASE}/api/self/suite-offer`, { method: "POST",
        headers: { "x-fleet-self-token": tok, "content-type": "application/json" }, body: "{}" })).json()) as
        { offer?: K12Offer | null }).offer;
    const offerGet = async (tok: string): Promise<K12Offer | null | undefined> =>
      ((await (await fetch(`${BASE}/api/self/suite-offer`,
        { headers: { "x-fleet-self-token": tok } })).json()) as { offer?: K12Offer | null }).offer;
    // the persisted slot row — credential and openedAt together, so a succession can be proved by
    // the ROTATION and not by a slot number that never changes. `succeed` answers only after its
    // saveStateNow, so the row is on disk when this reads it; the poll is for the mid-write case
    // selfTokenOf above already tolerates.
    const slotRow = async (slot: number, differsFrom?: string):
      Promise<{ selfToken: string; openedAt: number } | undefined> => {
      for (let i = 0; i < 60; i++) {
        try {
          const row = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
            { slots?: Record<string, { selfToken?: string; openedAt?: number }> }).slots?.[String(slot)];
          if (row?.selfToken && row.openedAt && row.selfToken !== differsFrom)
            return { selfToken: row.selfToken, openedAt: row.openedAt };
        } catch { /* mid-write */ }
        await Bun.sleep(50);
      }
      return undefined;
    };
    const selfPost = async (tok: string, path: string, body: unknown): Promise<Response> =>
      fetch(`${BASE}${path}`, { method: "POST",
        headers: { "x-fleet-self-token": tok, "content-type": "application/json" }, body: JSON.stringify(body) });

    // --- (a) THE BATON: a claimed offer crosses a succession ------------------------------
    await killSrv();
    check("(K12) setup: the server restarts with a claim budget long enough to cross a succession",
      await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "600000",
        FLEET_HELPER_SWEEP_MS: "2000" } }));
    await Bun.sleep(750);
    await beatRelay();
    const relay = await openLane(REPO, "relayone");
    const relayBefore = await slotRow(relay.slot);
    const relayTok = relayBefore?.selfToken ?? "";
    const relayJob = (await offerPost(relayTok))?.id ?? "";
    const relayClaim = await hpost("/api/helper/claim", { jobId: relayJob, deviceId: RELAY });
    check("(K12) setup: the relay lane's preview is claimed and stays live — what follows is a baton pass, not a lapse",
      /^[0-9a-f]{12}$/.test(relayJob) && relayClaim.status === 200,
      `job=${relayJob} claim=${relayClaim.status}`);
    const relayHandoff = await selfPost(relayTok, "/api/self/fleet-report",
      { status: "handoff", text: "K12 relay: preview claimed, the runner holds the tree, verdict pending" });
    const relaySucceed = await selfPost(relayTok, "/api/self/succeed", {});
    const relaySucceedBody = (await relaySucceed.json()) as { ok?: boolean; delivered?: boolean; error?: string };
    const relayAfter = await slotRow(relay.slot, relayTok);
    check("(K12) setup: the lane succeeds — SAME slot, new occupation (the rotation is the fact under test)",
      relayHandoff.ok && relaySucceed.ok && relaySucceedBody.delivered === true
        && relayAfter !== undefined && relayAfter.openedAt !== relayBefore?.openedAt,
      `handoff=${relayHandoff.status} succeed=${relaySucceed.status}`
      + ` ${JSON.stringify(relaySucceedBody).slice(0, 160)}`
      + ` openedAt ${relayBefore?.openedAt} -> ${relayAfter?.openedAt}`);
    const relayView = await offerGet(relayAfter?.selfToken ?? "");
    check("(K12) (a) THE OFFER RIDES THE BATON: the successor's own GET names the SAME job, still claimed — not `offer: null`",
      relayView?.id === relayJob && relayView?.state === "claimed",
      JSON.stringify(relayView));
    const relayReport = await hpost("/api/helper/result",
      { jobId: relayJob, exitCode: 0, tail: "PASS  relay\nALL PASS" });
    const relayRows = await waitForEvent(relayJob);
    const relayViewAfter = await offerGet(relayAfter?.selfToken ?? "");
    check("(K12) (a) …AND THE VERDICT REACHES THE SUCCESSOR: the report is accepted, one pane row names the successor occupation, and its own GET carries the green",
      relayReport.status === 200 && relayRows.length === 1 && relayRows[0]?.delivery === "pane"
        && relayRows[0]?.receiverSlot === relay.slot && relayRows[0]?.receiverOpenedAt === relayAfter?.openedAt
        && relayRows[0]?.payload?.result === "green"
        && relayViewAfter?.state === "reported" && relayViewAfter?.result?.result === "green",
      `report=${relayReport.status} rows=${JSON.stringify(relayRows)}`
      + ` view=${JSON.stringify({ state: relayViewAfter?.state, r: relayViewAfter?.result?.result })}`);

    // --- (b) THE DEADLINE: the stand-in runner dies without reporting ---------------------
    await killSrv();
    check("(K12) setup: the server restarts with a 4 s claim budget and a 1 s sweep — the named deadline the claim itself carries",
      await startSrv({ audit: true, extra: { FLEET_HELPER_CLAIM_TIMEOUT_MS: "4000",
        FLEET_HELPER_SWEEP_MS: "1000" } }));
    await Bun.sleep(750);
    await beatRelay();
    const mute = await openLane(REPO, "relaymute");
    const muteTok = (await slotRow(mute.slot))?.selfToken ?? "";
    const muteJob = (await offerPost(muteTok))?.id ?? "";
    const muteClaimBody = (await (await hpost("/api/helper/claim", { jobId: muteJob, deviceId: RELAY })).json()) as
      { job?: { expiresAt?: number; claimedAt?: number } };
    const muteBudget = (muteClaimBody.job?.expiresAt ?? 0) - (muteClaimBody.job?.claimedAt ?? 0);
    check("(K12) (b) setup: the stand-in runner claims and then DIES — no report will ever come, and the claim named its own deadline",
      /^[0-9a-f]{12}$/.test(muteJob) && muteBudget === 4000,
      `job=${muteJob} budget=${muteBudget}ms`);
    // the runner is dead from here on: nothing will report. Wait out deadline + sweep + mint.
    const muteWaitDeadline = Date.now() + 20_000;
    let muteView: K12Offer | null | undefined;
    for (;;) {
      muteView = await offerGet(muteTok);
      if (muteView?.result || Date.now() >= muteWaitDeadline) break;
      await Bun.sleep(250);
    }
    check("(K12) (b) A RUNNER THAT DIES PAST ITS NAMED DEADLINE SETTLES TERMINAL: `lapsed` WITH a verdict — unknown, no exit code, the helper named, the budget named, never green",
      muteView?.state === "lapsed" && muteView.result?.result === "unknown"
        && muteView.result.exitCode === null && muteView.result.remote?.reason === "timeout"
        && muteView.result.remote?.name === RELAY_NAME && (muteView.result.remote?.timeoutMs ?? 0) === 4000
        && muteView.claim === null,
      JSON.stringify(muteView));
    const muteRows = await waitForEvent(muteJob);
    check("(K12) (b) …AND THE LANE IS TOLD IN ITS PANE: one pane row to the offering lane, result `unknown`, the reason travelling with it — never silent",
      muteRows.length === 1 && muteRows[0]?.delivery === "pane" && muteRows[0]?.receiverSlot === mute.slot
        && muteRows[0]?.receiverOpenedAt === (await slotRow(mute.slot))?.openedAt
        && muteRows[0]?.payload?.result === "unknown"
        && (muteRows[0]?.payload?.reason ?? "").includes("deadline"),
      `rows=${JSON.stringify(muteRows)}`);
    const lateMute = await hpost("/api/helper/result", { jobId: muteJob, exitCode: 0, tail: "ALL PASS" });
    check("(K12) should-reject: the dead runner's LATE verdict is refused — the settled unknown stays the one truth, no second answer about the tree",
      lateMute.status === 409, `${lateMute.status} ${JSON.stringify(await lateMute.json())}`);
    check("(K12) …and NOTHING RE-RUNS BY ITSELF: no owner-inbox row for a lost preview, and the job left the portal list — the lane decides what happens to its tree",
      !(await eventsFor(muteJob)).some((e) => e.delivery === "inbox")
        && !(await jobs()).jobs.some((j) => j.id === muteJob),
      `list=${JSON.stringify((await jobs()).jobs.map((j) => j.id))}`);
    // (b2) THE HINT CANNOT READ GREEN. Rendered, not source-scanned: this is the sentence a pane
    // would actually receive about a job whose runner never spoke.
    const hintLost = laneSuiteWatchMessage(muteJob, { id: "e", kind: "lane-suite",
      payload: { result: "unknown", branch: mute.branch, exitCode: null, fails: [], failCount: 0,
        tail: "", reason: muteView?.result?.remote?.name } });
    check("(K12) (b2) the pane hint says NO VERDICT, never `no failures`, about a lost run",
      hintLost.includes("NO VERDICT") && !hintLost.includes("no failures"),
      JSON.stringify(hintLost.slice(0, 220)));
    await post(`/api/slots/${mute.slot}/kill`, {});
    await post(`/api/slots/${relay.slot}/kill`, {});
    await post(`/api/helper/devices/${RELAY}/mode`, { mode: "off" });
    check("(K12) teardown: the machine is idle with an empty queue",
      await waitNoLocalRun(60_000) && (await jobs()).jobs.length === 0, JSON.stringify((await jobs()).jobs));
  }
}

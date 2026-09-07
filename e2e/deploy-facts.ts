// The two deploy facts on the OWNER's poll: is the running server the committed code, and is the
// built bundle the committed client. Both existed before this family — but only on /api/steward/*,
// so the one principal who can act on them could not see them.
//
// Everything here is driven through FLEET_REPO_DIR, which is what deployGap() and bundleStale()
// both read. A fixture repo therefore lets the facts be MADE true rather than waited for: the
// checks below commit into it and re-time its files, instead of asserting whatever the real
// checkout happens to look like while the suite runs.
//
// The facts are cached on the 10 s git tick (see refreshDeployFacts), so every assertion polls for
// the value it expects rather than reading once and hoping the tick already fired.
import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { BASE, check, get, paneEnv, post, restartSrv, ROOT } from "./harness";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-deploy-${process.pid}`;

interface Gap {
  bootHead: string | null; head: string | null; behindCount: number | null;
  codeBehind: boolean | null; codeBehindUnknown: string[] | null;
}
interface Bundle {
  appJsMtime: number | null; shareJsMtime: number | null; helperJsMtime: number | null;
  srcNewestMtime: number | null; stale: boolean | null;
}
interface Facts { deployGap?: Gap | null; bundleStale?: Bundle | null }
interface DeployWatchRow { id: string; kind: "deploy"; deployId: string; armed: boolean }
interface DeployEventRow {
  id: string; watchId: string; kind: "deploy-terminal"; subjectDeployId: string;
  payload: { ok: boolean | null; stage: string; hitTarget: boolean | null; bundleStale: boolean | null };
  status: string;
}

const facts = async (): Promise<Facts> => (await (await get("/api/sessions")).json()) as Facts;
const selfDeployWatch = (token: string, deployId: string): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": token },
    body: JSON.stringify({ kind: "deploy", deployId, idleSec: 0 }),
  });
const deployEvents = async (): Promise<DeployEventRow[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as DeployEventRow[])
    .filter((e) => e.kind === "deploy-terminal");

// the tick is 10 s wide, so "not yet" and "wrong" are different answers. Poll for the expected
// shape and report the LAST reading on failure — a bare false would say nothing about which.
async function settle(want: (f: Facts) => boolean, ms = 14_000): Promise<Facts> {
  const until = Date.now() + ms;
  let last: Facts = {};
  for (;;) {
    last = await facts().catch(() => ({}) as Facts);
    if (want(last) || Date.now() > until) return last;
    await Bun.sleep(400);
  }
}

const git = (...args: string[]): void => {
  spawnSync("git", ["-C", FIX, ...args], { encoding: "utf8" });
};
const commit = (file: string, body: string): void => {
  writeFileSync(`${FIX}/${file}`, body);
  git("add", "-A");
  git("-c", "user.email=e2e@local", "-c", "user.name=e2e", "commit", "-m", `touch ${file}`);
};

export async function run(): Promise<void> {
  rmSync(FIX, { recursive: true, force: true });
  mkdirSync(`${FIX}/public`, { recursive: true });
  mkdirSync(`${FIX}/src`, { recursive: true });
  mkdirSync(`${FIX}/e2e`, { recursive: true });
  writeFileSync(`${FIX}/public/app.js`, "// bundle");
  writeFileSync(`${FIX}/public/share.js`, "// bundle");
  writeFileSync(`${FIX}/public/helper.js`, "// bundle");
  // The fixture carries a real IMPORT GRAPH, not just file names, because that is what the roles
  // are read off since 2026-09-07 (server/deploy-classify.ts). package.json#scripts.build names the
  // bundle entries — the same derivation the real repo uses, so a check here fails for the reason
  // the production classifier would fail. src/helper.ts and task-land-waves.ts do not exist yet;
  // they are committed further down, and the graph picks them up when they do.
  writeFileSync(`${FIX}/package.json`, JSON.stringify({
    scripts: { build: "bun build src/client.ts --outfile public/app.js && bun build src/helper.ts --outfile public/helper.js" },
  }));
  // The fixture's own import lines are ASSEMBLED from these, never spelled out below: e2e-stage.sh
  // scans every staged file for a relative specifier and refuses, fatally, to boot an instance
  // where one resolves to nothing. These specifiers are about ANOTHER repo, so they must not look
  // like this file's — and the scanner would be right to say so if they did.
  const WAVES_SPEC = "../task-land-waves";
  const MERGE_SPEC = "./merge-prompt";
  const sideEffect = (spec: string): string => `import ${JSON.stringify(spec)};`;
  writeFileSync(`${FIX}/src/client.ts`, `${sideEffect(WAVES_SPEC)}\n// source`);
  git("init", "-q");
  commit("server.ts", "// v1");

  // ===== §1 the facts reach the owner's own poll at all — the whole point of this family =====
  await restartSrv({ FLEET_REPO_DIR: FIX });
  {
    const f = await settle((x) => x.deployGap != null);
    check("§1 /api/sessions carries deployGap — not steward-only any more",
      f.deployGap != null, JSON.stringify(f.deployGap));
    check("§1 /api/sessions carries bundleStale — its twin, same reason",
      f.bundleStale != null, JSON.stringify(f.bundleStale));
    check("§1 a server booted from HEAD reports no gap, and says so as false, not as null",
      f.deployGap?.behindCount === 0 && f.deployGap.codeBehind === false, JSON.stringify(f.deployGap));
  }

  // ===== §2 a commit the server has not booted =====
  // DOC-ONLY FIRST, on purpose: once a server-code commit is in the range it stays in it, so the
  // "a doc commit is not a deploy" claim can only be made while the range holds nothing else.
  commit("notes.md", "# just docs");
  {
    const f = await settle((x) => x.deployGap?.behindCount === 1);
    check("§2 a commit after boot is counted",
      f.deployGap?.behindCount === 1, JSON.stringify(f.deployGap));
    check("§2 a docs-only commit is NOT a deploy — restarting srv would change nothing",
      f.deployGap?.codeBehind === false, JSON.stringify(f.deployGap));
  }
  // the import is what makes merge-prompt.ts server code in §2b below; it resolves to nothing yet
  commit("server.ts", `${sideEffect(MERGE_SPEC)}\n// v2`);
  {
    const f = await settle((x) => x.deployGap?.codeBehind === true);
    check("§2 a server-code commit IS a deploy — this is the line the owner never saw",
      f.deployGap?.codeBehind === true && f.deployGap.behindCount === 2, JSON.stringify(f.deployGap));
    check("§2 the boot commit is still named, so the gap is attributable and not just a count",
      /^[0-9a-f]{40}$/.test(f.deployGap?.bootHead ?? ""), JSON.stringify(f.deployGap?.bootHead));
  }

  // ===== §2b the suites' own code is not the server's =====
  // On a FRESH boot, because the §2 range now holds server.ts and can never read false again — a
  // claim about what does NOT count can only be made in a range that holds nothing else. What this
  // pins was measured live 2026-08-04: codeBehind:true over a range of HANDOFF.md +
  // e2e/verify-queue.ts, i.e. the deploy line warning about the suite files edited to check it.
  await restartSrv({ FLEET_REPO_DIR: FIX });
  {
    writeFileSync(`${FIX}/e2e/harness.ts`, "// checks");
    commit("fleet-e2e.ts", "// runner");
    const f = await settle((x) => x.deployGap?.behindCount === 1);
    check("§2b an e2e-only commit is NOT a deploy — the wrappers load the harness, srv never does",
      f.deployGap?.behindCount === 1 && f.deployGap.codeBehind === false, JSON.stringify(f.deployGap));
    // THE COUNTER-PROOF, and the near miss it guards: merge-prompt.ts is a top-level module sitting
    // right next to the runners, and server.ts imports it (planted in §2 above). Any rule of the
    // shape "a top-level .ts is harness" would pass the check above and silence a real gap here.
    commit("merge-prompt.ts", "// v2");
    const g = await settle((x) => x.deployGap?.codeBehind === true);
    check("§2b a top-level module the server imports is still a deploy, harness neighbours or not",
      g.deployGap?.codeBehind === true && g.deployGap.behindCount === 2, JSON.stringify(g.deployGap));
    // and it is a deploy because the graph PROVED it, not because nothing could be said about it:
    // an unknown path would set the same codeBehind, so the counter-proof is only worth something
    // while the unknown list is empty.
    check("§2b ...and it is PROVEN server code, not merely unclassifiable — the unknown list is empty",
      Array.isArray(g.deployGap?.codeBehindUnknown) && g.deployGap.codeBehindUnknown.length === 0,
      JSON.stringify(g.deployGap?.codeBehindUnknown));
  }

  // ===== §2c the roles are DERIVED from the import graph, and what cannot be derived says so =====
  // The maintenance form this replaced (two hand-kept allowlists) went unmaintained four times in
  // five weeks: src/helper.ts and src/backoff.ts until 2026-09-01, then task-land-waves.ts, then
  // fleet-e2e-harness.ts — every one a land whose whole diff was one file, reading codeBehind:true
  // for work that never touched the process. Fresh boot, then ONE cumulative range: the three
  // derivable paths must all leave it false, and only the underivable one may flip it.
  await restartSrv({ FLEET_REPO_DIR: FIX });
  {
    // (1) the file the finding was filed about: no line of server.ts mentions it, src/client.ts
    // imports it. Nobody wrote its name down anywhere — the graph is the whole reason it is known.
    commit("task-land-waves.ts", "// waves");
    const a = await settle((x) => x.deployGap?.behindCount === 1);
    check("§2c a module only the client bundle imports is NOT a deploy — derived, not listed",
      a.deployGap?.behindCount === 1 && a.deployGap.codeBehind === false, JSON.stringify(a.deployGap));
    // (2) regression on the two shapes the old lists DID carry: a bundle entry named by
    // package.json#scripts.build, and a single-file runner — here the SIXTH one, the name the
    // five-name list never grew to hold.
    commit("src/helper.ts", "// bundle entry");
    commit("fleet-e2e-harness.ts", "// the sixth runner");
    const b = await settle((x) => x.deployGap?.behindCount === 3);
    check("§2c a bundle entry and a sixth single-file runner are still NOT a deploy",
      b.deployGap?.behindCount === 3 && b.deployGap.codeBehind === false, JSON.stringify(b.deployGap));
    // (3) the third value. An orphan module is reachable from nothing nameable, and the honest
    // answer is neither "server" nor "fresh": it counts toward codeBehind exactly as the old
    // default-deny counted it, AND it is named, so the warning can be read as unproven.
    commit("orphan-tool.ts", "// imported by nobody");
    const c = await settle((x) => x.deployGap?.codeBehind === true);
    check("§2c an unreachable new module is never silently fresh — it still counts as a gap",
      c.deployGap?.codeBehind === true && c.deployGap.behindCount === 4, JSON.stringify(c.deployGap));
    check("§2c ...and it is named as UNKNOWN, not asserted to be server code — and it alone is",
      JSON.stringify(c.deployGap?.codeBehindUnknown) === JSON.stringify(["orphan-tool.ts"]),
      JSON.stringify(c.deployGap?.codeBehindUnknown));
  }

  // ===== §3 the bundle half: mtimes, not commits =====
  // Re-timed rather than rewritten: the fact is a comparison of mtimes, so driving the mtimes IS
  // driving the fact, and it needs no sleep to make one side older than the other.
  {
    const stamp = (when: Date, ...files: string[]): void => {
      for (const file of files) utimesSync(`${FIX}/public/${file}`, when, when);
    };
    const old = new Date(Date.now() - 60 * 60_000);
    stamp(old, "app.js", "share.js", "helper.js");
    const f = await settle((x) => x.bundleStale?.stale === true);
    check("§3 a bundle older than src/ is stale — landed client code invisible in the browser",
      f.bundleStale?.stale === true, JSON.stringify(f.bundleStale));
    const now = new Date();
    stamp(now, "app.js", "share.js", "helper.js");
    const g = await settle((x) => x.bundleStale?.stale === false);
    check("§3 rebuilding clears it — the fact follows the filesystem, it is not sticky",
      g.bundleStale?.stale === false, JSON.stringify(g.bundleStale));
    // helper.js is the THIRD bundle `bun run build` produces, and it was absent from BUNDLES until
    // 2026-09-01. Aged ALONE on purpose — app.js and share.js stay fresh, so a fact that does not
    // stat helper.js has nothing to answer true with, and this reads false: the FALSE FRESH the
    // BUNDLES comment names as the expensive direction.
    stamp(old, "helper.js");
    const h = await settle((x) => x.bundleStale?.stale === true);
    const hb = h.bundleStale;
    check("§3 helper.js alone, older than src/, is stale too — the portal bundle is not exempt",
      hb?.stale === true && hb.helperJsMtime !== null && hb.appJsMtime !== null
      && hb.helperJsMtime < hb.appJsMtime, JSON.stringify(hb));
    stamp(now, "helper.js");
  }

  // ===== §4 what it does NOT know is null, never false =====
  // The honesty rule both facts are built on: an unmeasurable answer must not read as "all clear",
  // which is exactly what a `false` would read as on the owner's board.
  {
    const bare = `${FIX}-notarepo`;
    rmSync(bare, { recursive: true, force: true });
    mkdirSync(bare, { recursive: true });
    await restartSrv({ FLEET_REPO_DIR: bare });
    const f = await settle((x) => x.deployGap != null && x.deployGap.bootHead === null);
    check("§4 no git repo → the gap is UNKNOWN (null), never a reassuring false",
      f.deployGap?.bootHead === null && f.deployGap.codeBehind === null && f.deployGap.behindCount === null
        // an unmeasured range names no unknown paths either: an EMPTY list would read as "we looked
        // and everything classified", which is the same reassuring lie one level down
        && f.deployGap.codeBehindUnknown === null,
      JSON.stringify(f.deployGap));
    check("§4 no bundle on disk → staleness is UNKNOWN too, and the mtimes say why",
      f.bundleStale?.stale === null && f.bundleStale.appJsMtime === null, JSON.stringify(f.bundleStale));
    rmSync(bare, { recursive: true, force: true });
  }

  // ===== §5 VERB 2: the verb that ACTS on the two facts above — and kills its own verifier ======
  // Everything above measures the facts. This section drives the deploy that closes them, and the
  // whole difficulty is that `tmux kill-session -t srv` ends the process serving the route: the
  // answer "did it work?" is structurally unavailable to the request that asked for it. So the
  // contract has three halves and each is checked as its own claim: the build is judged by the
  // living process, the response is `ok:null` and never a pass, and the NEXT BOOT writes the verdict.
  //
  // A REAL CYCLE, not a re-telling: the build stand-in really runs (and its effect on
  // bundleStale is what the verdict reads), the default restart command really kills this
  // instance's srv, and this suite plays the watchdog that brings it back. Every precondition —
  // a gap that is actually open, a bundle that is actually stale, a server that actually died —
  // is asserted as ITS OWN check, because a deploy against a closed gap would be vacuum-green.
  {
    const marker = `${ROOT}/deploy-inflight.json`;
    const receiverId = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null }[] }).slots.find((s) => s.cwd === null)?.id ?? 0;
    const receiverOpen = receiverId ? await post(`/api/slots/${receiverId}/open`, { cwd: FIX }) : null;
    const receiverToken = receiverId ? await paneEnv(`s${receiverId}`, "FLEET_SELF_TOKEN") ?? "" : "";
    check("§5 deploy restart watch setup: a non-lane receiver has its scoped token before the kill",
      receiverOpen?.ok === true && /^[0-9a-f]{32}$/.test(receiverToken),
      JSON.stringify({ receiverId, open: receiverOpen?.status, tokenLength: receiverToken.length }));
    const buildRuns = (): number => {
      try { return readFileSync(`${FIX}/buildruns`, "utf8").split("\n").filter(Boolean).length; } catch { return 0; }
    };
    // the stand-in build: relative paths on purpose — it only works if the verb runs it in
    // REPO_DIR, and touching the bundles is exactly what a real `bun run build` does to the fact.
    const BUILD_OK = "printf 'run\\n' >> buildruns; touch public/app.js public/share.js public/helper.js";
    // Planted in THIS process's env so every restartSrv below carries them (the harness whitelist
    // is "every FLEET_* we did not compute ourselves" — a server-only variable would be dropped).
    // RESTORED, never deleted, at the end of the section: an earlier module (restart.ts) plants
    // FLEET_REPO_DIR here for exactly the same reason, and deleting it took the real checkout away
    // from every module after this one — 14 red checks, all of them saying `bootHead: null`.
    const priorRepoDir = process.env.FLEET_REPO_DIR;
    const priorBuildCmd = process.env.FLEET_DEPLOY_BUILD_CMD;
    process.env.FLEET_REPO_DIR = FIX;
    process.env.FLEET_DEPLOY_BUILD_CMD = BUILD_OK;
    const staleBundles = (): void => {
      const old = new Date(Date.now() - 60 * 60_000);
      utimesSync(`${FIX}/public/app.js`, old, old);
      utimesSync(`${FIX}/public/share.js`, old, old);
      utimesSync(`${FIX}/public/helper.js`, old, old);
    };
    // open a gap the deploy has to close, and assert it is really open before asking for a deploy
    const openGap = async (body: string, label: string): Promise<boolean> => {
      commit("server.ts", body);
      staleBundles();
      const f = await settle((x) => x.deployGap?.bootHead !== x.deployGap?.head && x.bundleStale?.stale === true);
      const open = f.deployGap?.bootHead != null && f.deployGap.head != null
        && f.deployGap.bootHead !== f.deployGap.head && f.bundleStale?.stale === true;
      check(`§5 precondition (${label}): a gap IS open and the bundle IS stale before the deploy`,
        open, JSON.stringify({ gap: f.deployGap, bundle: f.bundleStale }));
      return open;
    };
    interface Row { at: number; id: string; stage: string; ok: boolean | null; target: string | null;
      bootHead: string | null; head: string | null; hitTarget: boolean | null; bundleStale: boolean | null;
      reason?: string; exitCode?: number | null }
    interface Deploys { deploys: Row[]; inFlight: { id: string } | null; blocked: string | null }
    const deploys = async (): Promise<Deploys> => (await (await get("/api/deploys")).json()) as Deploys;

    // --- §5a A FAILING BUILD NEVER TOUCHES THE SERVER ------------------------------------------
    // The one phase the living process can judge, so it is judged before anything is killed: an
    // unbuildable tree must leave the running server exactly where it was.
    await restartSrv({ FLEET_REPO_DIR: FIX, FLEET_DEPLOY_BUILD_CMD: "echo nope >&2; exit 3" });
    if (await openGap("// v3", "failing build")) {
      const before = buildRuns();
      const r = await post("/api/deploy", {});
      const b = (await r.json()) as { ok: unknown; stage?: string; exitCode?: number | null; reason?: string };
      check("§5a a failing build is reported as FAILED with its exit code, not swallowed",
        r.status === 500 && b.ok === false && b.stage === "build" && b.exitCode === 3,
        `${r.status} ${JSON.stringify(b).slice(0, 200)}`);
      check("§5a ...and the server is still alive — a failed build never reaches the kill",
        (await get("/api/sessions")).ok);
      const f = await settle((x) => x.deployGap?.bootHead !== x.deployGap?.head);
      check("§5a ...and the gap is untouched: nothing was deployed",
        f.deployGap?.bootHead !== f.deployGap?.head, JSON.stringify(f.deployGap));
      const d = await deploys();
      check("§5a the failure is on the ledger as stage=build, and NOTHING is in flight",
        d.deploys[0]?.stage === "build" && d.deploys[0]?.ok === false && d.inFlight === null
          && !existsSync(marker), JSON.stringify(d.deploys[0]).slice(0, 240));
      // this instance's build command is the FAILING one, which writes no run line: the stand-in
      // counter must therefore be unmoved — nothing was built and nothing pretended to be
      check("§5a nothing was built: the run counter is unmoved",
        buildRuns() === before, `${before} → ${buildRuns()}`);
    }

    // --- §5b THE RED PATH: a deploy that leaves bootHead != HEAD reports itself GESCHEITERT -----
    // The restart command fails, so the process that answered the request is STILL RUNNING the old
    // code — the exact shape of the threshold in docs/autonomy-verbs-2026-08-06.md §Verb 2, and the
    // one failure the verb must never end silently on. Without this check the verb is proven on the
    // happy path only.
    await restartSrv({ FLEET_REPO_DIR: FIX, FLEET_DEPLOY_RESTART_CMD: "echo no such session >&2; exit 7" });
    if (await openGap("// v4", "failing restart")) {
      const r = await post("/api/deploy", {});
      const b = (await r.json()) as { ok: unknown; stage?: string; id?: string };
      check("§5b the verb answers ok:null while it is still unverified — never a pass on the way out",
        r.status === 202 && b.ok === null && b.stage === "restarting" && typeof b.id === "string",
        `${r.status} ${JSON.stringify(b).slice(0, 200)}`);
      // the restart is fired after the response, so the verdict lands a moment later
      let row: Row | undefined;
      for (let i = 0; i < 60 && !row; i++) {
        row = (await deploys()).deploys.find((x) => x.id === b.id && x.stage === "restart");
        if (!row) await Bun.sleep(250);
      }
      check("§5b a deploy whose restart did not take is recorded FAILED — it does not end silently",
        row?.ok === false && /restart command failed/.test(row?.reason ?? ""),
        JSON.stringify(row).slice(0, 300));
      check("§5b ...and the row NAMES the residual gap: bootHead is still not HEAD",
        row?.bootHead != null && row.head != null && row.bootHead !== row.head,
        `${row?.bootHead} vs ${row?.head}`);
      check("§5b ...and the marker is cleared, so one failed restart cannot wedge the verb",
        !existsSync(marker) && (await deploys()).inFlight === null);
      const again = await post("/api/deploy", {});
      check("§5b the verb is usable again immediately after the failure (202, not a stuck 409)",
        again.status === 202, String(again.status));
      // it fails the same way (this instance's restart command is still the broken one) — let its
      // row land, then boot a normal instance for the section below
      await Bun.sleep(1500);
      await restartSrv({ FLEET_REPO_DIR: FIX });
    }

    // --- §5c THE FULL GREEN CYCLE, verified by the process that came after ----------------------
    if (await openGap("// v5", "green cycle")) {
      const before = buildRuns();
      const r = await post("/api/deploy", {});
      const b = (await r.json()) as { ok: unknown; id?: string; target?: string };
      // The deploy's own timer kills srv 250 ms after this response. Subscribe before doing even
      // local check bookkeeping so this measures the marker-admission window rather than timing luck.
      const restartSubR = b.id ? await selfDeployWatch(receiverToken, b.id) : new Response(null, { status: 599 });
      const restartSub = await restartSubR.json().catch(() => ({})) as { watch?: DeployWatchRow; error?: string };
      check("§5c the verb accepts and names its target, still without claiming success",
        r.status === 202 && b.ok === null && /^[0-9a-f]{40}$/.test(b.target ?? ""),
        `${r.status} ${JSON.stringify(b).slice(0, 200)}`);
      check("§5c the build ran BEFORE the kill — one more run, in the deployed repo",
        buildRuns() === before + 1, `${before} → ${buildRuns()}`);
      check("§5c deploy watch subscribes while the durable marker is in flight, before srv dies",
        restartSubR.ok && restartSub.watch?.armed === true && restartSub.watch.deployId === b.id,
        `${restartSubR.status} ${JSON.stringify(restartSub)}`);
      // THE PRECONDITION OF EVERYTHING BELOW: the process really died. If it did not, the boot-side
      // verdict was never exercised and every check after this would be measuring nothing.
      let dead = false;
      for (let i = 0; i < 80 && !dead; i++) {
        dead = !(await get("/api/sessions").then((x) => x.ok).catch(() => false));
        if (!dead) await Bun.sleep(250);
      }
      check("§5c precondition: the restart command really killed the server serving the route",
        dead, "srv still answering — the boot-side verdict below would prove nothing");
      check("§5c the ONLY thing that crosses the restart is the durable marker on disk",
        existsSync(marker), marker);
      await restartSrv({ FLEET_REPO_DIR: FIX }); // this suite plays the watchdog
      const d = await deploys();
      const row = d.deploys.find((x) => x.id === b.id);
      check("§5c the NEXT BOOT wrote the verdict the dead process could not: ok, and green",
        row?.stage === "boot" && row.ok === true, JSON.stringify(row).slice(0, 300));
      check("§5c the verdict is the DONE criterion itself: bootHead == HEAD, target hit, bundle fresh",
        row?.bootHead != null && row.bootHead === row.head && row.hitTarget === true
          && row.bundleStale === false, JSON.stringify(row).slice(0, 300));
      check("§5c ...and the marker is consumed, so the next boot does not judge it a second time",
        !existsSync(marker) && d.inFlight === null, JSON.stringify(d.inFlight));
      let restartEvent: DeployEventRow | undefined;
      for (let i = 0; i < 120 && restartEvent?.status !== "delivered"; i++) {
        restartEvent = (await deployEvents()).find((e) => e.watchId === restartSub.watch?.id);
        if (restartEvent?.status !== "delivered") await Bun.sleep(100);
      }
      check("§5c deploy watch survives srv restart, then boot row level-mints and delivers exactly one event",
        restartEvent !== undefined && restartEvent.subjectDeployId === b.id && restartEvent.payload.ok === true
          && restartEvent.payload.stage === "boot" && restartEvent.payload.hitTarget === true
          && (await deployEvents()).filter((e) => e.watchId === restartSub.watch?.id).length === 1,
        JSON.stringify(restartEvent));
      const f = await settle((x) => x.deployGap?.behindCount === 0);
      check("§5c the fact the verb exists for now reads clear on the owner's own poll",
        f.deployGap?.behindCount === 0 && f.bundleStale?.stale === false,
        JSON.stringify({ gap: f.deployGap, bundle: f.bundleStale }));
    }

    // --- §5d THE BOOT-SIDE VERIFIER CAN SAY NO ---------------------------------------------------
    // A build command that exits 0 and produces no bundle: the restart takes, the gap closes, and
    // the deploy is STILL failed, because half the DONE is `bundleStale:false`. Proves the boot-side
    // verdict is a measurement and not a rubber stamp on "the process came back".
    await restartSrv({ FLEET_REPO_DIR: FIX, FLEET_DEPLOY_BUILD_CMD: "true" });
    if (await openGap("// v6", "build that builds nothing")) {
      const r = await post("/api/deploy", {});
      const b = (await r.json()) as { ok: unknown; id?: string };
      check("§5d a build that exits 0 is accepted — the verb cannot know yet that it built nothing",
        r.status === 202 && b.ok === null, `${r.status} ${JSON.stringify(b).slice(0, 160)}`);
      for (let i = 0; i < 80; i++) {
        if (!(await get("/api/sessions").then((x) => x.ok).catch(() => false))) break;
        await Bun.sleep(250);
      }
      await restartSrv({ FLEET_REPO_DIR: FIX });
      const row = (await deploys()).deploys.find((x) => x.id === b.id);
      check("§5d the boot verdict is FAILED even though the restart took and the gap closed",
        row?.stage === "boot" && row.ok === false && row.bootHead === row.head,
        JSON.stringify(row).slice(0, 300));
      check("§5d ...and it says which half failed: the bundle never reached public/",
        row?.bundleStale === true && /bundle is older than src/.test(row.reason ?? ""),
        JSON.stringify(row?.reason));
    }

    if (priorRepoDir === undefined) delete process.env.FLEET_REPO_DIR;
    else process.env.FLEET_REPO_DIR = priorRepoDir;
    if (priorBuildCmd === undefined) delete process.env.FLEET_DEPLOY_BUILD_CMD;
    else process.env.FLEET_DEPLOY_BUILD_CMD = priorBuildCmd;
    if (receiverId) await post(`/api/slots/${receiverId}/kill`, {});
  }

  // back to the wrapper's own env for every module after this one
  await restartSrv();
  rmSync(FIX, { recursive: true, force: true });
  check("§4 the real checkout is measurable again after the fixture is gone",
    (await settle((x) => x.deployGap?.bootHead != null)).deployGap?.bootHead != null);
}

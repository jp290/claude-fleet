import type { Workplaces, WorkplaceRepo } from "../src/protocol";
// Lane lifecycle: risk vs the configured integration branch, shelve → resume, the lane-scoped
// brief, the 💾 commit endpoint (lane vs main-session staging, detached HEAD, wedged rebase), and
// the CLONE lane form — same lifecycle, a working copy that is its own repository.
import { spawnSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { laneDoneLooking, laneHostCommitLooking, type LaneSignalView } from "../lane-signals";
import { BASE, PORT, REPO, ROOT, SOCK, TOKEN, UntilTimeout, check, get, lastReviewPromptFor, plantScreen, plogRead, post, restartSrv,
  reviewRunsFor, stopSrv, tmuxOut, until } from "./harness";
import type { LaneCtx } from "./ctx";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

async function testinstanzWorktreeChecks(slot: number): Promise<void> {
  const repo = realpathSync(REPO), dir = mkdtempSync(`${ROOT}/ti-api-`);
  const a = `${dir}/a`, b = `${dir}/b`, trace = `${dir}/actions`, hold = `${dir}/hold`, started = `${dir}/started`;
  const mainScript = `${repo}/testinstanz.sh`;
  const original = exists(mainScript) ? { bytes: readFileSync(mainScript), mode: lstatSync(mainScript).mode & 0o777 } : null;
  const cmd = (...args: string[]) => spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  const suffix = String(Date.now()), branchA = `ti-a-${suffix}`, branchB = `ti-b-${suffix}`;
  const route = (path: string) => `/api/worktrees/testinstanz?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`;
  const states = new Map<string, string>();
  const script = (path: string, index: number) => {
    const state = `${dir}/state-${index}`; states.set(path, state);
    const data = JSON.stringify({ state: "up", port: 8912 + index, expiresAt: 2_000_000_000_000,
      procStatus: "alive", httpStatus: "healthy", identity: "matched", mode: "mixed", startedAt: 1000,
      copyStartedAt: 2000, copyFinishedAt: 3000, builtAt: 4000, copyHead: "a".repeat(40),
      recordedSource: { path, before: { head: "a".repeat(40), branch: "old", dirty: 1, measuredAt: 1 }, after: null } });
    writeFileSync(`${path}/testinstanz.sh`, `#!/bin/sh
case "$1" in
up)
  printf 'up\n' >> '${trace}'
  if [ -f '${hold}' ]; then : > '${started}'; while [ -f '${hold}' ]; do sleep 0.05; done; fi
  printf '%s' '${data}' > '${state}' ;;
down) printf 'down\n' >> '${trace}'; rm -f '${state}' ;;
status)
  if [ "$2" = --json ]; then
    if [ -f '${state}' ]; then cat '${state}'; else echo '{"state":"not-running","procStatus":"dead"}'; fi
  else echo 'up pid 123 http://127.0.0.1:${8912 + index}/?token=SYNTHETIC_TI_SECRET'; echo 'ttl: 45 min left (expiresAt=2000000000)'; fi ;;
esac
`); chmodSync(`${path}/testinstanz.sh`, 0o700);
  };
  const read = async (path: string, refresh = false) => {
    const r = refresh ? await post(route(path), { action: "refresh" }) : await get(route(path));
    return { status: r.status, body: await r.json() as { state?: string; url?: string; mainCheckout?: boolean;
      source?: { head?: string; dirty?: number; measuredAt?: number; fork?: unknown; freshness?: string };
      instance?: { copyHead?: string | null; httpStatus?: string; procStatus?: string; recordedSource?: unknown }; refusal?: string; nullSpawn?: boolean } };
  };
  try {
    const createdA = cmd("worktree", "add", "-q", "-b", branchA, a, "HEAD");
    const createdB = cmd("worktree", "add", "-q", "-b", branchB, b, "HEAD");
    const commitB = spawnSync("git", ["-C", b, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "distinct copy source"], { encoding: "utf8" });
    check("testinstanz known main and two slotless worktree fixtures exist", createdA.status === 0 && createdB.status === 0 && commitB.status === 0);
    if (createdA.status !== 0 || createdB.status !== 0 || commitB.status !== 0) return;
    script(repo, 0); script(a, 1); script(b, 2);
    writeFileSync(`${b}/dirty`, "uncommitted fixture\n");
    const sourceRefs = () => cmd("for-each-ref", "--format=%(refname) %(objectname)").stdout;
    const beforeRefs = sourceRefs();
    const missingAuth = await fetch(BASE + route(a));
    check("testinstanz slotless read refuses absent auth", missingAuth.status === 401);
    const laneToken = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots?: Record<string, { selfToken?: string }> }).slots?.[slot]?.selfToken;
    const laneRead = await fetch(BASE + route(a), { headers: { "x-fleet-self-token": laneToken ?? "missing" } });
    check("testinstanz slotless read refuses lane auth", !!laneToken && laneRead.status === 401);
    const share = await post(`/api/slots/${slot}/share`, { mode: "view", password: "ti-fixture-password" });
    const shareBody = await share.json() as { id?: string };
    const shareAuth = await post(`/s/${shareBody.id}/auth`, { password: "ti-fixture-password" });
    const shareCookie = (shareAuth.headers.get("set-cookie") ?? "").split(";")[0];
    const shareRead = await fetch(BASE + route(a), { headers: { cookie: shareCookie } });
    check("testinstanz Read refuses a real authenticated Share", share.status === 200 && shareAuth.status === 200 && shareCookie.startsWith("share_") && shareRead.status === 401);
    const unknown = await post(route(dir), { action: "up" });
    check("testinstanz refuses a foreign path without spawn", unknown.status === 409 && !exists(trace));
    const badTTL = await post(route(a), { action: "up", ttlMin: 1441 });
    const badMode = await post(route(a), { action: "up", mode: "full" });
    const injection = await post(route(a), { action: "up", command: "touch foreign" });
    check("testinstanz rejects TTL, unavailable mode and arbitrary command before spawn", badTTL.status === 400 && badMode.status === 400 && injection.status === 400 && !exists(trace));
    const none = await read(a);
    check("testinstanz absent copy reads not-running and unmeasured fork is null", none.status === 200 && none.body.state === "not-running" && none.body.source?.fork === null && !exists(trace));
    const main = await post(route(repo), { action: "up" });
    const upA = await post(route(a), { action: "up", ttlMin: 12 });
    const upB = await post(route(b), { action: "up", mode: "snapshot" });
    check("testinstanz starts known main and two slotless targets separately", main.status === 200 && upA.status === 200 && upB.status === 200
      && [...states.values()].every(exists), `HTTP ${main.status}/${upA.status}/${upB.status}`);
    const mainRead = await read(repo), readA = await read(a), readB = await read(b);
    check("testinstanz reports measured main/worktree identity and distinct HEAD/dirty", mainRead.body.mainCheckout === true && readA.body.mainCheckout === false
      && readB.body.mainCheckout === false && readA.body.source?.head !== readB.body.source?.head
      && readA.body.source?.dirty === 1 && readB.body.source?.dirty === 2);
    check("testinstanz never promotes recorded source HEAD to an exact copy version", readA.body.instance?.copyHead === null);
    const actionBefore = readFileSync(trace, "utf8"), stateBefore = readFileSync(states.get(a)!, "utf8");
    const dirtyBefore = spawnSync("git", ["-C", a, "status", "--porcelain"], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }).stdout;
    const metadata = await read(a), refresh = await read(a, true);
    check("testinstanz readspy observes exactly zero up/open/down/suite/model/serverstart", readFileSync(trace, "utf8") === actionBefore
      && readFileSync(states.get(a)!, "utf8") === stateBefore && sourceRefs() === beforeRefs
      && spawnSync("git", ["-C", a, "status", "--porcelain"], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }).stdout === dirtyBefore
      && !JSON.stringify(metadata.body).includes("SYNTHETIC_TI_SECRET") && !JSON.stringify(refresh.body).includes("SYNTHETIC_TI_SECRET"));
    const updated = spawnSync("git", ["-C", a, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "--allow-empty", "-qm", "updated source"], { encoding: "utf8" });
    writeFileSync(`${a}/dirty`, "new dirty fixture\n");
    const cached = await read(a), fresh = await read(a, true);
    check("testinstanz explicit Refresh advances measuredAt, HEAD and dirty; GET keeps cached source", updated.status === 0
      && cached.body.source?.head === refresh.body.source?.head && fresh.body.source?.head !== cached.body.source?.head
      && fresh.body.source?.dirty === 2 && (fresh.body.source?.measuredAt ?? 0) > (cached.body.source?.measuredAt ?? 0));
    // t | event | owner: 0 Refresh cache | server; +30010ms Read | test. Freshness uses server Date.now and its 30000ms cache limit.
    await Bun.sleep(30_010);
    const stale = await read(a);
    check("testinstanz cached source honestly becomes stale without renewing measuredAt", stale.body.source?.freshness === "stale"
      && stale.body.source.measuredAt === fresh.body.source?.measuredAt);
    for (const [http, state] of [["failed", "http-failed"], ["timeout", "http-timeout"]] as const) {
      writeFileSync(states.get(a)!, JSON.stringify({ state, procStatus: "alive", httpStatus: http }));
      const observation = await read(a);
      check(`testinstanz procAlive plus HTTP ${http} stays separate`, observation.body.state === state
        && observation.body.instance?.procStatus === "alive" && observation.body.instance.httpStatus === http);
    }
    writeFileSync(states.get(a)!, JSON.stringify({ state: "unknown" }));
    const old = await read(a);
    check("testinstanz old state has unknown provenance, copy and HTTP", old.body.state === "unknown" && old.body.instance?.recordedSource === null
      && old.body.instance.copyHead === null && old.body.instance.httpStatus === "unknown");
    const downA = await post(route(a), { action: "down" });
    check("testinstanz stop targets only its own instance", downA.status === 200 && !exists(states.get(a)!) && exists(states.get(b)!) && exists(states.get(repo)!));
    writeFileSync(hold, "hold"); rmSync(started, { force: true });
    const delayed = post(route(a), { action: "up" });
    await until(() => exists(started), { timeoutMs: 5000, what: "testinstanz delayed script accepted work" });
    const busy = await post(route(a), { action: "down" });
    const independent = await post(route(b), { action: "down" });
    check("testinstanz busy is per known worktree, slotless neighbours remain independent", busy.status === 409 && independent.status === 200);
    const moved = `${a}-moved`;
    const move = cmd("worktree", "move", a, moved);
    rmSync(hold, { force: true });
    const late = await delayed;
    const lateBody = await late.json() as { refusal?: string; nullSpawn?: boolean; state?: string };
    check("testinstanz late result cannot attach to a moved target", move.status === 0 && late.status === 409 && lateBody.refusal === "target-changed" && lateBody.state === "unknown" && lateBody.nullSpawn === true);
    cmd("worktree", "move", moved, a);
    rmSync(`${a}/testinstanz.sh`);
    const missing = await post(route(a), { action: "up" });
    check("testinstanz missingScript refuses before spawn", missing.status === 409 && (await missing.json() as { error?: string }).error?.startsWith("missingScript") === true);
    writeFileSync(`${a}/testinstanz.sh`, "#!/bin/sh\necho 'SYNTHETIC_RAW_ERROR_TOKEN' >&2\necho 'http://127.0.0.1:8912/?token=SYNTHETIC_RAW_ERROR_TOKEN'\nexit 2\n");
    chmodSync(`${a}/testinstanz.sh`, 0o700);
    const failure = await get(route(a));
    const errorText = await failure.text();
    check("testinstanz raw script errors and status URLs never escape Metadata", failure.status === 409 && !errorText.includes("SYNTHETIC_RAW_ERROR_TOKEN") && errorText.includes("script-failed"));
    cmd("worktree", "remove", "--force", a);
    const removed = await post(route(a), { action: "up" });
    check("testinstanz removedWorktree refuses without fallback", removed.status === 409 && (await removed.json() as { nullSpawn?: boolean }).nullSpawn === true);
  } finally {
    rmSync(hold, { force: true });
    if (original) { writeFileSync(mainScript, original.bytes); chmodSync(mainScript, original.mode); } else rmSync(mainScript, { force: true });
    for (const path of [a, `${a}-moved`, b]) cmd("worktree", "remove", "--force", path);
    for (const branch of [branchA, branchB]) cmd("branch", "-D", branch);
    rmSync(dir, { recursive: true, force: true });
  }
}

async function workplacesChecks(): Promise<void> {
  const dir = mkdtempSync(`${ROOT}/workplaces-`), a = `${dir}/a`, b = `${dir}/b`, orphan = `${dir}/orphan`;
  const git = (repo: string, ...args: string[]) => spawnSync("git", ["-C", repo, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { encoding: "utf8" });
  const commit = (repo: string) => { git(repo, "commit", "--allow-empty", "-qm", "fixture"); return git(repo, "rev-parse", "HEAD").stdout.trim(); };
  const opened: Array<{ slot: number; cwd: string }> = [];
  try {
    for (const repo of [a, b]) { mkdirSync(repo); git(repo, "init", "-qb", "main"); commit(repo); }
    const aMain = git(a, "rev-parse", "HEAD").stdout.trim();
    git(a, "worktree", "add", "-qb", "overhaul", orphan, "main");
    const aOverhaul = commit(orphan);
    const bOverhaul = git(b, "rev-parse", "HEAD").stdout.trim();
    git(b, "branch", "overhaul"); const bMain = commit(b);
    for (const repo of [a, b]) {
      const response = await post("/api/lanes", { repo });
      const lane = await response.json() as { slot: number; cwd: string };
      check("workplaces fixture repo is represented by its own occupied lane", response.status === 200 && !!lane.slot);
      if (lane.slot) opened.push(lane);
    }
    if (opened.length !== 2) return;
    const state = { state: "expired", expiresAt: 1000, procStatus: "alive", httpStatus: "healthy", identity: "matched",
      recordedSource: { path: realpathSync(orphan), before: { head: aMain, branch: "overhaul", dirty: 1, measuredAt: 100 }, after: null },
      token: "SYNTHETIC_WORKPLACES_SECRET", url: "http://fixture.invalid/" };
    const trace = `${dir}/trace`;
    writeFileSync(`${orphan}/testinstanz.sh`, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${trace}'\nprintf '%s' '${JSON.stringify(state)}'\n`);
    chmodSync(`${orphan}/testinstanz.sh`, 0o700);
    const anonymous = await fetch(BASE + "/api/worktrees");
    check("workplaces owner reader refuses anonymous callers", anonymous.status === 401);
    const laneToken = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots?: Record<string, { selfToken?: string }> }).slots?.[opened[0].slot]?.selfToken;
    const laneRead = await fetch(BASE + "/api/worktrees", { headers: { "x-fleet-self-token": laneToken ?? "" } });
    check("workplaces owner reader refuses a self principal", !!laneToken && laneRead.status === 401);
    const selector = await get("/api/worktrees?repo=/arbitrary/path");
    check("workplaces refuses request paths rather than selecting arbitrary repositories", selector.status === 400);
    const response = await get("/api/worktrees");
    const text = await response.text(), value = JSON.parse(text) as Workplaces;
    const first = value.repos.find((r) => r.repo === realpathSync(a)), second = value.repos.find((r) => r.repo === realpathSync(b));
    check("workplaces covers two known repos with their actual main tips", response.status === 200
      && first?.branches?.find((r) => r.branch === "main")?.head === aMain
      && second?.branches?.find((r) => r.branch === "main")?.head === bMain, text.slice(0, 1000));
    const up = first?.branches?.find((r) => r.branch === "overhaul"), down = second?.branches?.find((r) => r.branch === "overhaul");
    check("workplaces overhaul ahead is exclusive reachability against main", up?.head === aOverhaul && up.distance?.ahead === 1 && up.distance.behind === 0, JSON.stringify(up));
    check("workplaces overhaul behind is exclusive reachability against main", down?.head === bOverhaul && down.distance?.ahead === 0 && down.distance.behind === 1, JSON.stringify(down));
    const row = first?.worktrees?.find((w) => w.path === realpathSync(orphan));
    check("workplaces slotless row includes its actual HEAD and measured main basis", row?.session === null && row.head === aOverhaul
      && row.branch === "overhaul" && row.base?.head === aMain && row.distance?.ahead === 1 && row.distance.behind === 0, JSON.stringify(row));
    const sessions = await (await get("/api/sessions")).json() as { slots: Array<{ id: number; openedAt: number }> };
    const occupied = first?.worktrees?.find((w) => w.path === realpathSync(opened[0].cwd));
    check("workplaces occupant joins slot plus exact openedAt", occupied?.session?.slot === opened[0].slot
      && occupied.session.openedAt === sessions.slots.find((s) => s.id === opened[0].slot)?.openedAt, JSON.stringify(occupied?.session));
    check("workplaces summary retains expired and recorded source without substituting current HEAD", row?.template === "present"
      && row.testinstanz?.state === "expired" && row.testinstanz.instance.copyHead === null
      && (row.testinstanz.instance.recordedSource as { before?: { head?: string } } | null)?.before?.head === aMain, JSON.stringify(row));
    const foreign = second?.worktrees?.find((w) => w.primary);
    check("workplaces foreign missing template is typed and instance unknown has a named reason", foreign?.template === "missing" && foreign.testinstanz === null
      && foreign.reasons.some((r) => r.field === "testinstanz" && r.reason === "missingScript"), JSON.stringify(foreign));
    check("workplaces summary emits no raw token, URL or host", !text.includes("SYNTHETIC_WORKPLACES_SECRET") && !text.includes("fixture.invalid") && !text.includes('"url"'));
    const again = await (await get("/api/worktrees")).json() as Workplaces;
    check("workplaces short cache avoids repeated status and carries measurement time", again.measuredAt === value.measuredAt
      && again.cacheMs === 3000 && readFileSync(trace, "utf8") === "status --json\n");
    const source = readFileSync(`${ROOT}/server.ts`, "utf8");
    const blocks = [
      ["function knownRepos()", "async function slotCommits("],
      ["function testinstanzPathIdentity(", "async function testinstanzTarget("],
      ["function testinstanzFact(", "async function testinstanzReadSource("],
      ["interface WtEntry {", "// the real risk behind a destructive action"],
    ];
    const functions = "const testinstanzBusy = new Set<string>();\n" + blocks.map(([from, to]) => {
      const first = source.indexOf(from), last = source.indexOf(to, first);
      if (first < 0 || last <= first) throw new Error(`workplaces source fixture cannot resolve ${from}`);
      return source.slice(first, last);
    }).join("\n");
    type FixtureOccupant = { id: number; openedAt: number; cwd: string; worktree: { repo: string; base: string; baseSha: string } };
    const holderFixture = (): FixtureOccupant => ({ id: 42, openedAt: 100, cwd: realpathSync(b),
      worktree: { repo: realpathSync(b), base: "overhaul", baseSha: bOverhaul } });
    const compile = (code: string, occupants: FixtureOccupant[], graphFails = false, statusAwait?: () => Promise<void>, notesFail = false, gitCalls?: string[]) => {
      const js = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
      return new Function("slots", "DISPATCH_REPO", "gitRead", "testinstanzCommand", "existsSync", "realpathSync", "statSync", "lstatSync", "HOST",
        `${js}\nreturn { repo: workplaceRepo, read: workplaces };`)(occupants, realpathSync(b),
        async (repo: string, ...args: string[]) => {
          gitCalls?.push(args[0]);
          if (notesFail && args[0] === "log") return { code: 128, out: "" };
          if (graphFails && args[0] === "rev-list") return { code: 128, out: "" };
          const r = git(repo, ...args); return { code: r.status, out: r.stdout.trim() };
        }, async (path: string, args: string[]) => {
          await statusAwait?.();
          const r = spawnSync(`${path}/testinstanz.sh`, args, { cwd: path, encoding: "utf8" });
          return { code: r.status, out: r.stdout };
        }, existsSync, realpathSync, statSync, lstatSync, "") as { repo: (repo: string) => Promise<WorkplaceRepo>; read: () => Promise<Workplaces> };
    };
    const distanceMutant = functions.replace("return { ahead, behind };", "return { ahead: behind, behind: ahead };");
    const claim = (r: WorkplaceRepo) => { const d = r.branches?.find((x) => x.branch === "overhaul")?.distance; return d?.ahead === 0 && d.behind === 1; };
    const baseline = await compile(functions, []).repo(b), mutated = await compile(distanceMutant, []).repo(b);
    check("workplaces mutation probe catches swapped ahead/behind on the fixture graph", functions !== distanceMutant && claim(baseline) && !claim(mutated), JSON.stringify({ baseline: baseline.branches, mutated: mutated.branches }));
    const retainsBasis = (repo: WorkplaceRepo, head: string) => {
      const row = repo.worktrees?.find((w) => w.primary);
      return row?.base?.head === head && row.distance === null
        && row.reasons.some((r) => r.field === "distance" && r.reason === "commit-graph-unreadable")
        && !row.reasons.some((r) => r.field === "base");
    };
    const graphFailed = await compile(functions, [holderFixture()], true).repo(b);
    const refGraphFailed = await compile(functions, [], true).repo(b);
    check("workplaces failed graph preserves the readable stored basis, only distance becomes unknown", retainsBasis(graphFailed, bOverhaul), JSON.stringify(graphFailed.worktrees));
    check("workplaces failed graph preserves the readable main ref basis", retainsBasis(refGraphFailed, bMain), JSON.stringify(refGraphFailed.worktrees));
    const baseMutant = functions.replace("const base = baseHead ?", "const base = baseHead && ancestors(baseHead) ?");
    const lostBasis = await compile(baseMutant, [holderFixture()], true).repo(b);
    check("workplaces basis mutation probe rejects hiding a readable base on graph failure", baseMutant !== functions && !retainsBasis(lostBasis, bOverhaul), JSON.stringify(lostBasis.worktrees));
    const instanceScript = `${b}/testinstanz.sh`;
    writeFileSync(instanceScript, "#!/bin/sh\nprintf '%s' '{\"state\":\"not-running\",\"procStatus\":\"dead\"}'\n"); chmodSync(instanceScript, 0o700);
    try {
      const steady = await compile(functions, [holderFixture()]).read();
      const steadyRow = steady.repos[0]?.worktrees?.find((w) => w.primary);
      check("workplaces captures an unchanged occupant together with its stored basis", steadyRow?.session?.slot === 42
        && steadyRow.session.openedAt === 100 && steadyRow.base?.head === bOverhaul, JSON.stringify(steadyRow));
      const race = async (code: string, changedSlot: boolean): Promise<Workplaces> => {
        const occupants = [holderFixture()];
        let accepted = false, release = () => {};
        const held = new Promise<void>((resolve) => { release = resolve; });
        // t | event | exclusive owner
        // 0 | identity and basis captured | read
        // 1 | status accepted and held | script boundary
        // 2 | occupant identity and basis replaced | test
        // 3 | status released, response joins identity | read
        const pending = compile(code, occupants, false, async () => { accepted = true; await held; }).read();
        try {
          await until(() => accepted, { timeoutMs: 5000, what: "workplaces status boundary accepted the cached read" });
          if (changedSlot) occupants[0] = { ...occupants[0], id: 43, worktree: { repo: realpathSync(b), base: "main", baseSha: bMain } };
          else { occupants[0].openedAt = 200; occupants[0].worktree = { repo: realpathSync(b), base: "main", baseSha: bMain }; }
        } finally { release(); }
        return pending;
      };
      const refusesPairing = (value: Workplaces) => {
        const row = value.repos[0]?.worktrees?.find((w) => w.primary);
        return row?.session === null && row.base?.head === bOverhaul
          && row.reasons.some((r) => r.field === "session" && r.reason === "session-changed-since-measurement");
      };
      const identityGuard = "const sessionMatches = w.session?.slot === holder?.id && w.session?.openedAt === holder?.openedAt;";
      const occupantMutant = functions.replace(identityGuard, "const sessionMatches = true;");
      for (const changedSlot of [false, true]) {
        const raced = await race(functions, changedSlot), wronglyPaired = await race(occupantMutant, changedSlot);
        check(`workplaces ${changedSlot ? "slot" : "openedAt"} change during status cannot pair the new occupant with the old basis`, refusesPairing(raced), JSON.stringify(raced.repos[0]?.worktrees));
        check(`workplaces ${changedSlot ? "slot" : "openedAt"} mutation probe rejects dropping the occupant guard`, occupantMutant !== functions && !refusesPairing(wronglyPaired), JSON.stringify(wronglyPaired.repos[0]?.worktrees));
      }
    } finally { rmSync(instanceScript, { force: true }); }

    const targetPaths = ["wp-landed", "wp-unlanded", "wp-empty"].map((branch) => ({ branch, path: `${dir}/${branch}` }));
    for (const [i, fixture] of targetPaths.entries()) {
      git(b, "worktree", "add", "-qb", fixture.branch, fixture.path, bOverhaul);
      if (i < 2) git(fixture.path, "commit", "--allow-empty", "-qm", fixture.branch);
    }
    git(b, "update-ref", "refs/heads/overhaul", bMain);
    git(b, "notes", "--ref=fleet/land", "add", "-m", JSON.stringify({ branch: "wp-landed", task: "aabbccdd", at: 1000 }), bMain);
    git(b, "notes", "--ref=fleet/land", "add", "-m", JSON.stringify({ branch: "wp-unlanded", task: "eeff0011", at: 2000 }), git(targetPaths[0].path, "rev-parse", "HEAD").stdout.trim());
    git(b, "branch", "side-target", git(targetPaths[0].path, "rev-parse", "HEAD").stdout.trim());
    const targetHolders = targetPaths.map((fixture, i): FixtureOccupant => ({ id: 50 + i, openedAt: 100,
      cwd: realpathSync(fixture.path), worktree: { repo: realpathSync(b), base: "overhaul", baseSha: bOverhaul } }));
    targetHolders.push({ id: 53, openedAt: 100, cwd: realpathSync(b), worktree: { repo: realpathSync(b), base: "side-target", baseSha: bOverhaul } });
    const gitCalls: string[] = [];
    const targetRepo = await compile(functions, targetHolders, false, undefined, false, gitCalls).repo(b);
    check("workplaces notes are read once per repo within the five Git call budget", gitCalls.length === 5
      && gitCalls.filter((cmd) => cmd === "log").length === 1 && (targetRepo.worktrees?.length ?? 0) > 3, JSON.stringify(gitCalls));
    const targetRow = (repo: WorkplaceRepo, i: number) => repo.worktrees?.find((row) => row.path === realpathSync(targetPaths[i].path));
    const yes = (repo: WorkplaceRepo) => { const row = targetRow(repo, 0); return row?.target.branch === "overhaul" && row.target.head === bMain
      && row.target.behind === 1 && row.target.landed === "yes" && row.target.landedAs === bMain && row.target.basis === "land-note"; };
    const no = (repo: WorkplaceRepo) => { const row = targetRow(repo, 1); return row?.distance?.ahead === 1 && row.target.landed === "no"
      && row.target.landedAs === null && row.reasons.some((r) => r.field === "target.landedAs" && r.reason === "no-matching-land-note"); };
    const empty = (repo: WorkplaceRepo) => { const row = targetRow(repo, 2); return row?.distance?.ahead === 0 && row.target.landed === null
      && row.reasons.some((r) => r.field === "target.landed" && r.reason === "nothing-to-land"); };
    check("workplaces target yes names the overhaul tip and its exact land-note SHA", yes(targetRepo), JSON.stringify(targetRow(targetRepo, 0)));
    check("workplaces target no excludes matching notes on another branch of history", no(targetRepo), JSON.stringify(targetRow(targetRepo, 1)));
    check("workplaces target with no own commits is unknown with nothing-to-land reason", empty(targetRepo), JSON.stringify(targetRow(targetRepo, 2)));
    const targetMutants = [
      ["land-note branch", functions.replace("note.branch === branch && onTarget(note.sha)", "onTarget(note.sha)"), no],
      ["land-note lineage", functions.replace("note.branch === branch && onTarget(note.sha)", "note.branch === branch"), no],
      ["nothing to land", functions.replace('else if (d.ahead === 0) landedReason = "nothing-to-land";', ''), empty],
      ["target advancement", functions.replace("distance(targetHead, baseHead)?.ahead ?? null", "0"), yes],
    ] as const;
    for (const [name, code, predicate] of targetMutants) {
      const mutantRepo = await compile(code, targetHolders).repo(b);
      check(`workplaces target mutation rejects dropping ${name}`, code !== functions && !predicate(mutantRepo), JSON.stringify(mutantRepo.worktrees));
    }
    const failedTarget = await compile(functions, targetHolders, true).repo(b);
    check("workplaces target graph failure retains its readable target tip and nulls only unprovable facts", targetRow(failedTarget, 1)?.target.head === bMain
      && targetRow(failedTarget, 1)?.target.behind === null && targetRow(failedTarget, 1)?.target.landed === null
      && targetRow(failedTarget, 1)?.reasons.some((r) => r.field === "target.behind" && r.reason === "commit-graph-unreadable") === true, JSON.stringify(targetRow(failedTarget, 1)));
    const unreadNotes = await compile(functions, targetHolders, false, undefined, true).repo(b);
    check("workplaces unreadable target notes cannot claim an unlanded branch", targetRow(unreadNotes, 1)?.target.landed === null
      && targetRow(unreadNotes, 1)?.reasons.some((r) => r.field === "target.landed" && r.reason === "land-notes-unreadable") === true, JSON.stringify(targetRow(unreadNotes, 1)));
    const cappedNotes = functions.replace("return { rows, truncated };", "return { rows, truncated: true };");
    const limited = await compile(cappedNotes, targetHolders).repo(b);
    check("workplaces truncated target notes keep positive evidence but refuse negative claims", limited.landNotes.truncated === true
      && targetRow(limited, 0)?.target.landed === "yes" && targetRow(limited, 1)?.target.landed === null
      && targetRow(limited, 1)?.reasons.some((r) => r.field === "target.landed" && r.reason === "land-notes-truncated") === true, JSON.stringify(limited.worktrees));
    const scanCapped = await compile(functions.replace("const LAND_NOTES_SCAN_CAP = 200;", "const LAND_NOTES_SCAN_CAP = 1;"), targetHolders).repo(b);
    check("workplaces note scan cap exposes truncation and never claims no from a partial scan", scanCapped.landNotes.truncated === true
      && targetRow(scanCapped, 1)?.target.landed === null, JSON.stringify(scanCapped.worktrees));
    await Bun.sleep(3100);
    const targetWire = await (await get("/api/worktrees")).json() as Workplaces;
    const wireRepo = targetWire.repos.find((repo) => repo.repo === realpathSync(b));
    check("workplaces owner wire carries yes no and nothing-to-land from one repo note scan", !!wireRepo
      && targetRow(wireRepo, 0)?.target.landed === "yes" && no(wireRepo) && empty(wireRepo)
      && wireRepo.landNotes.truncated === false, JSON.stringify(wireRepo));

    renameSync(`${b}/.git`, `${b}/.git-hidden`);
    try {
      const escaped = git(b, "rev-parse", "--show-toplevel");
      check("workplaces unreadable fixture proves Git would discover the enclosing repo", escaped.status === 0
        && realpathSync(escaped.stdout.trim()) === realpathSync(ROOT), escaped.stdout.trim());
      const withoutBoundary = functions.replace('if (strict && !existsSync(`${root}/.git`)) throw new Error("worktree-list-unreadable");', '')
        .replace('if (top.code !== 0 || realpathSync(top.out) !== realpathSync(repo)) throw new Error("repo-toplevel-mismatch");', '');
      const guarded = await compile(functions, []).repo(b), escapedRepo = await compile(withoutBoundary, []).repo(b);
      check("workplaces pre-fix red/post-fix green rejects reading an enclosing repo when its own Git boundary disappears", withoutBoundary !== functions
        && guarded.worktrees === null && guarded.reasons.some((r) => r.reason === "worktree-list-unreadable")
        && escapedRepo.worktrees !== null, JSON.stringify({ guarded, escapedRepo: escapedRepo.repo }));
      await Bun.sleep(3100);
      const unreadable = await (await get("/api/worktrees")).json() as Workplaces;
      const broken = unreadable.repos.find((r) => r.repo === realpathSync(b));
      check("workplaces unreadable repo is null with its reason, never an empty worktree list", broken?.worktrees === null && broken.branches === null
        && broken.reasons.some((r) => r.reason === "worktree-list-unreadable"), JSON.stringify(broken));
      const other = `${dir}/other`;
      mkdirSync(other); git(other, "init", "-qb", "main"); commit(other);
      git(other, "config", "core.worktree", realpathSync(other));
      writeFileSync(`${b}/.git`, `gitdir: ${realpathSync(other)}/.git\n`);
      try {
        const topMutant = functions.replace('if (top.code !== 0 || realpathSync(top.out) !== realpathSync(repo)) throw new Error("repo-toplevel-mismatch");', '');
        const mismatch = await compile(functions, []).repo(b), wrongRepo = await compile(topMutant, []).repo(b);
        check("workplaces rejects an existing Git pointer whose explicit toplevel is another repo", mismatch.worktrees === null
          && mismatch.reasons.some((r) => r.reason === "worktree-list-unreadable"), JSON.stringify(mismatch));
        check("workplaces toplevel mutation probe rejects substituting another repo", topMutant !== functions && wrongRepo.worktrees !== null, JSON.stringify(wrongRepo.repo));
      } finally { rmSync(`${b}/.git`, { force: true }); }
    } finally { renameSync(`${b}/.git-hidden`, `${b}/.git`); }

  } finally {
    for (const lane of opened) await post(`/api/slots/${lane.slot}/kill`, {});
    git(a, "worktree", "remove", "--force", orphan);
    for (const lane of opened) git(lane.cwd.startsWith(a) ? a : b, "worktree", "remove", "--force", lane.cwd);
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function run(lc: LaneCtx): Promise<void> {
  await workplacesChecks();
  // Mutation: removing the fork-point guard or deleting every merged branch makes these
  // assertions fail on real teardown paths.
  {
    const listScript = `${ROOT}/testinstanz.sh`;
    const original = exists(listScript) ? { bytes: readFileSync(listScript), mode: lstatSync(listScript).mode & 0o777 } : null;
    const stateDir = mkdtempSync("/tmp/fleet-testinstanz-e2e-");
    const worktree = `${stateDir}/fixture worktree`;
    try {
      writeFileSync(`${stateDir}/testinstanz.state`, `src=${worktree}\nport=8912\nexpiresAt=2000000000\n`);
      writeFileSync(listScript, `#!/bin/sh\n[ "$1" = list ] && echo 'up  port 8912  rest 45 min  ${worktree}  http://100.64.0.1:8912/'\n`);
      chmodSync(listScript, 0o700);
      const anonymous = await fetch(BASE + "/api/testinstanzen");
      check("testinstanz list requires the owner token", anonymous.status === 401);
      const listed = await get("/api/testinstanzen");
      const body = (await listed.json().catch(() => ({}))) as { testinstanzen?: Array<Record<string, unknown>> };
      const instance = body.testinstanzen?.[0];
      check("testinstanz list serves script rows as JSON with worktree, port, URL and exact expiry",
        listed.status === 200 && body.testinstanzen?.length === 1 && instance?.worktree === worktree
        && instance.port === 8912 && instance.url === "http://100.64.0.1:8912/"
        && instance.expiresAt === 2_000_000_000_000 && instance.state === "up", JSON.stringify(body));
    } finally {
      if (original) { writeFileSync(listScript, original.bytes); chmodSync(listScript, original.mode); }
      else rmSync(listScript, { force: true });
      rmSync(stateDir, { recursive: true, force: true });
    }
  }
  const emptyBranch = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  {
    const route = `/api/slots/${emptyBranch.slot}/testinstanz`;
    const script = `${emptyBranch.cwd}/testinstanz.sh`;
    const missing = await post(route, { action: "up" });
    check("testinstanz refuses a missing worktree script with a named 409", missing.status === 409
      && ((await missing.json()) as { error?: string }).error?.includes("missing") === true);
    writeFileSync(script, "#!/bin/sh\nexit 0\n");
    chmodSync(script, 0o600);
    const notExecutable = await post(route, { action: "up" });
    check("testinstanz refuses a non-executable worktree script", notExecutable.status === 409
      && ((await notExecutable.json()) as { error?: string }).error?.includes("not executable") === true);
    writeFileSync(script, [
      "#!/bin/sh",
      "case $1 in",
      "  up) pwd > ti-cwd; printf '%s' \"$*\" > ti-args ;;",
      "  down) rm -f ti-cwd ti-args ;;",
      "  status) if [ -f ti-cwd ]; then echo 'up pid 123 http://127.0.0.1:8912/?token=fixture'; echo 'ttl: 45 min left (expiresAt=2000000000)'; else echo 'down (fixture)'; fi; exit 1 ;;",
      "esac",
      "",
    ].join("\n"));
    chmodSync(script, 0o700);
    const anonymous = await fetch(BASE + route, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "up" }) });
    check("testinstanz start requires the owner token", anonymous.status === 401);
    const badTtl = await post(route, { action: "up", ttlMin: 0 });
    check("testinstanz rejects an invalid TTL before running the script", badTtl.status === 400 && !exists(`${emptyBranch.cwd}/ti-cwd`));
    const up = await post(route, { action: "up", ttlMin: 45 });
    const upBody = (await up.json().catch(() => ({}))) as { url?: string; port?: number; expiresAt?: number };
    check("testinstanz up runs the slot worktree script in its own cwd and returns credential-free metadata",
      up.ok && exists(`${emptyBranch.cwd}/ti-cwd`) && exists(`${emptyBranch.cwd}/ti-args`)
      && readFileSync(`${emptyBranch.cwd}/ti-cwd`, "utf8").trim() === emptyBranch.cwd
      && readFileSync(`${emptyBranch.cwd}/ti-args`, "utf8") === "up mixed --ttl 45"
      && upBody.url === undefined && upBody.port === 8912
      && upBody.expiresAt === 2_000_000_000_000, `HTTP ${up.status}; metadata credential-free=${!upBody.url}`);
    const opened = await post(route, { action: "open" });
    const openedBody = await opened.json() as { url?: string };
    check("testinstanz opening needs its own explicit owner gesture", opened.status === 200
      && openedBody.url === "http://127.0.0.1:8912/?token=fixture", `HTTP ${opened.status}`);
    const status = (await (await get(route)).json().catch(() => ({}))) as { state?: string; port?: number };
    check("testinstanz status serves the running state for a second device", status.state === "up" && status.port === 8912);
    const down = await post(route, { action: "down" });
    check("testinstanz down invokes the same worktree script and removes the running fixture",
      down.ok && !exists(`${emptyBranch.cwd}/ti-cwd`)
      && ((await down.json().catch(() => ({}))) as { ok?: boolean }).ok === true);
    const downStatus = await get(route);
    check("testinstanz status keeps the script's down fact when its final lock diagnostic exits 1",
      downStatus.status === 200
      && ((await downStatus.json()) as { state?: string }).state === "not-running");
    writeFileSync(script, "#!/bin/sh\necho 'up pid 123 http://127.0.0.1:8912/?token=fixture'\necho 'ttl: EXPIRED 2 min ago'\n");
    const expired = await get(route);
    const expiredBody = await expired.json() as { state?: string; expiresAt?: unknown; url?: unknown; mainCheckout?: boolean; worktree?: string };
    check("testinstanz EXPIRED without expiresAt remains an expired worktree fact", expired.status === 200
      && expiredBody.state === "expired" && expiredBody.expiresAt === null && expiredBody.url === undefined
      && expiredBody.mainCheckout === false && expiredBody.worktree === realpathSync(emptyBranch.cwd), `HTTP ${expired.status}; state=${expiredBody.state}`);
    await testinstanzWorktreeChecks(emptyBranch.slot);
    const race = await (await post("/api/lanes", { repo: REPO })).json() as { slot: number; cwd: string; branch: string };
    const raceSpy = `${ROOT}/ti-occupant-spy-${race.slot}`;
    writeFileSync(`${race.cwd}/testinstanz.sh`, `#!/bin/sh\n[ "$1" = up ] && echo spawned > '${raceSpy}'\necho 'down (fixture)'\n`);
    chmodSync(`${race.cwd}/testinstanz.sh`, 0o700);
    const requestBody = JSON.stringify({ action: "up" });
    let finishBody: (() => void) | undefined;
    const delayedBody = new Promise<{ code: number; body: { refusal?: string; nullSpawn?: boolean } }>((resolveResult, reject) => {
      const req = httpRequest(BASE + `/api/slots/${race.slot}/testinstanz`, { method: "POST", headers: {
        authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "content-length": Buffer.byteLength(requestBody),
      } }, (response) => { let text = ""; response.on("data", (part) => text += part.toString());
        response.on("end", () => { try { resolveResult({ code: response.statusCode ?? 0, body: JSON.parse(text) }); } catch (error) { reject(error); } }); });
      req.on("error", reject); req.write(requestBody.slice(0, 1)); finishBody = () => req.end(requestBody.slice(1));
    });
    // t | event | owner: headers+one byte | request; kill+new open | test; remaining body | request. No up may cross this replacement.
    await Bun.sleep(250);
    const kill = await post(`/api/slots/${race.slot}/kill`, {});
    const replacement = await post(`/api/slots/${race.slot}/open`, { cwd: REPO, label: "testinstanz-replacement" });
    finishBody?.();
    const delayedResult = await delayedBody;
    check("testinstanz delayedBody reproves exact Slot occupant and has nullSpawn", kill.status === 200 && replacement.status === 200
      && delayedResult.code === 409 && delayedResult.body.refusal === "target-changed" && delayedResult.body.nullSpawn === true && !exists(raceSpy));
    const projection = await (await get("/api/sessions")).json() as { slots?: Array<{ id: number; workplace?: { path?: string; mainCheckout?: boolean } | null }> };
    const projectionScript = `${REPO}/testinstanz.sh`;
    const projectionOriginal = exists(projectionScript) ? { bytes: readFileSync(projectionScript), mode: lstatSync(projectionScript).mode & 0o777 } : null;
    writeFileSync(projectionScript, "#!/bin/sh\necho 'down (fixture)'\n"); chmodSync(projectionScript, 0o700);
    await get(`/api/slots/${race.slot}/testinstanz`);
    if (projectionOriginal) { writeFileSync(projectionScript, projectionOriginal.bytes); chmodSync(projectionScript, projectionOriginal.mode); }
    else rmSync(projectionScript, { force: true });
    const measuredProjection = await (await get("/api/sessions")).json() as typeof projection;
    const place = measuredProjection.slots?.find((row) => row.id === race.slot)?.workplace;
    check("testinstanz Slot projection measures main checkout identity", place?.path === realpathSync(REPO) && place.mainCheckout === true);
    await post(`/api/slots/${race.slot}/kill`, {});
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", race.cwd]);
    spawnSync("git", ["-C", REPO, "branch", "-D", race.branch]);
    rmSync(raceSpy, { force: true });
    const lateSlot = await (await post("/api/lanes", { repo: REPO })).json() as { slot: number; cwd: string; branch: string };
    const lateHold = `${ROOT}/ti-slot-hold`, lateReady = `${ROOT}/ti-slot-ready`;
    writeFileSync(lateHold, "hold");
    writeFileSync(`${lateSlot.cwd}/testinstanz.sh`, `#!/bin/sh\necho ready > '${lateReady}'\nwhile [ -f '${lateHold}' ]; do sleep 0.05; done\necho 'up pid 123 http://127.0.0.1:8912/?token=SYNTHETIC_OLD_SLOT_TOKEN'\necho 'ttl: 5 min left (expiresAt=2000000000)'\n`);
    chmodSync(`${lateSlot.cwd}/testinstanz.sh`, 0o700);
    const lateRead = get(`/api/slots/${lateSlot.slot}/testinstanz`);
    await until(() => exists(lateReady), { timeoutMs: 5000, what: "testinstanz old Slot status entered script" });
    const lateKill = await post(`/api/slots/${lateSlot.slot}/kill`, {});
    const lateReplacement = await post(`/api/slots/${lateSlot.slot}/open`, { cwd: REPO, label: "testinstanz-late-result" });
    rmSync(lateHold, { force: true });
    const lateResponse = await lateRead, lateText = await lateResponse.text();
    check("testinstanz late status result never reaches a new Slot occupant", lateKill.status === 200 && lateReplacement.status === 200
      && lateResponse.status === 409 && lateText.includes("target-changed") && !lateText.includes("SYNTHETIC_OLD_SLOT_TOKEN"));
    await post(`/api/slots/${lateSlot.slot}/kill`, {});
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", lateSlot.cwd]);
    spawnSync("git", ["-C", REPO, "branch", "-D", lateSlot.branch]);
    rmSync(lateReady, { force: true });
    rmSync(script);
  }
  const emptyRemove = await post(`/api/slots/${emptyBranch.slot}/land`, {});
  check("teardown branch mutation: zero commits ahead removes both the worktree and its branch",
    emptyRemove.ok && !exists(emptyBranch.cwd)
      && spawnSync("git", ["-C", REPO, "branch", "--list", emptyBranch.branch]).stdout.toString().trim() === "",
    `${emptyRemove.status} ${emptyBranch.branch}`);
  const noWorktree = await post(`/api/slots/${emptyBranch.slot}/testinstanz`, { action: "up" });
  check("testinstanz needs an occupied lane worktree", noWorktree.status === 409
    && ((await noWorktree.json()) as { error?: string }).error === `slot ${emptyBranch.slot} has no lane worktree`);
  const keptBranch = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  const preserve = `${ROOT}/branch-preserve.git`;
  spawnSync("git", ["init", "--bare", "-q", preserve]);
  await Bun.write(`${keptBranch.cwd}/branch-preserve.txt`, "committed lane work\n");
  spawnSync("git", ["-C", keptBranch.cwd, "add", "branch-preserve.txt"]);
  const keepCommit = spawnSync("git", ["-C", keptBranch.cwd, "commit", "-qm", "branch preservation probe"]);
  spawnSync("git", ["-C", keptBranch.cwd, "remote", "add", "branch-preserve", preserve]);
  const keepPush = spawnSync("git", ["-C", keptBranch.cwd, "push", "-qu", "branch-preserve", "HEAD"]);
  await post(`/api/slots/${keptBranch.slot}/kill`, {});
  const keptRemove = await post("/api/worktrees/remove", { repo: REPO, path: keptBranch.cwd });
  check("teardown branch mutation: one preserved commit ahead keeps the branch after worktree removal",
    keepCommit.status === 0 && keepPush.status === 0 && keptRemove.ok && !exists(keptBranch.cwd)
      && spawnSync("git", ["-C", REPO, "branch", "--list", keptBranch.branch]).stdout.toString().trim() !== "",
    `${keepCommit.status}/${keepPush.status}/${keptRemove.status} ${keptBranch.branch}`);
  const landedBranch = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  await Bun.write(`${landedBranch.cwd}/branch-landed.txt`, "landed lane work\n");
  spawnSync("git", ["-C", landedBranch.cwd, "add", "branch-landed.txt"]);
  const landedCommit = spawnSync("git", ["-C", landedBranch.cwd, "commit", "-qm", "branch preservation after land"]);
  await settleForMerge(landedBranch.slot);
  const landedStart = await post(`/api/slots/${landedBranch.slot}/merge`, {});
  const landedDone = await waitMerge(landedBranch.slot);
  check("teardown branch mutation: a branch with work since fork survives its successful land for undo-land",
    landedCommit.status === 0 && landedStart.ok && landedDone.gone
      && spawnSync("git", ["-C", REPO, "branch", "--list", landedBranch.branch]).stdout.toString().trim() !== "",
    `${landedCommit.status}/${landedStart.status} ${JSON.stringify(landedDone)}`);
  // --- the second completion FACT is served beside doneLooking, with the same lane-only scope.
  // The isolated server keeps foreign-harness automation OFF, so its policy-reduced `alive` fact
  // cannot honestly manufacture the positive Pi case here; prompts.ts owns that positive matrix.
  // This integration half proves the served field is present and remains false for the identical
  // dirty+zero-ahead shape on Claude — paired with positive git/adapter reads, never a null reader.
  {
    const hostShape: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 1, ahead: 0 },
      gitOp: false, merge: null, observed: true, awaiting: null, hostCommits: true };
    check("hostCommitLooking accepts fenced dirty+zero-ahead work, but not identical Claude dirt or awaiting-owner",
      laneHostCommitLooking(hostShape, 1500) === true
      && laneHostCommitLooking({ ...hostShape, hostCommits: false }, 1500) === false
      && laneHostCommitLooking({ ...hostShape, awaiting: "owner" }, 1500) === false);
    check("hostCommitLooking and doneLooking are disjoint on both completion shapes",
      laneDoneLooking(hostShape, 1500) === false
      && laneHostCommitLooking({ ...hostShape, git: { dirty: 0, ahead: 1 } }, 1500) === false
      && laneDoneLooking({ ...hostShape, git: { dirty: 0, ahead: 1 } }, 1500) === true);

    type SignalSlot = { id: number; git: { dirty: number; ahead: number } | null;
      hostCommits: boolean; hostCommitLooking: boolean; doneLooking: boolean };
    const svTok = ((await (await get("/api/steward/token")).json()) as { token: string }).token;
    const signal = async (slot: number): Promise<SignalSlot | undefined> =>
      ((await (await fetch(BASE + "/api/steward/sessions",
        { headers: { authorization: `Bearer ${svTok}` } })).json()) as { slots: SignalSlot[] })
        .slots.find((s) => s.id === slot);

    const clRes = await post("/api/lanes", { repo: REPO });
    const cl = (await clRes.json()) as { ok?: boolean; slot?: number; cwd?: string; error?: string };
    check("host-commit fact probe setup: a Claude lane was created",
      clRes.ok && cl.ok === true && typeof cl.slot === "number" && typeof cl.cwd === "string",
      `${clRes.status} ${JSON.stringify(cl)}`);
    if (clRes.ok && cl.ok && cl.slot && cl.cwd) {
      await Bun.write(`${cl.cwd}/host-commit-fact.txt`, "dirty tree on self-committing harness\n");
      let clV: SignalSlot | undefined;
      for (let i = 0; i < 60; i++) {
        clV = await signal(cl.slot);
        if (clV?.git?.dirty === 1 && clV.git.ahead === 0 && clV.hostCommits === false) break;
        await Bun.sleep(500);
      }
      const readerReady = clV?.git?.dirty === 1 && clV.git.ahead === 0 && clV.hostCommits === false;
      check("host-commit fact probe prerequisite: steward reads the dirty+zero-ahead tree and adapter fact",
        readerReady, JSON.stringify(clV));
      if (readerReady) {
        check("hostCommitLooking is served false for Claude dirt (that state stays stalled-dirty)",
          clV?.hostCommitLooking === false && clV.doneLooking === false, JSON.stringify(clV));
      }
      // --- the workbench's lane ↔ task join (src/client.ts qLaneJoins) over this same lane, from the
      // OWNER poll it actually reads. Two facts, both about a lane no task row ever named: it hangs
      // on no row however same-repo it is (the join is the dispatcher's pointer, never a repo
      // guess), and its state line carries the dirty count the steward view just confirmed, with
      // running/idle said only where output was observed and UNKNOWN where it was not.
      {
        type PollSlot = { id: number; cwd: string | null; openedAt?: number; lastOutput: number;
          git?: { dirty: number; ahead: number } | null; worktree?: { repo: string; branch: string } | null };
        type PollTask = { id: string; status: string; created: number; slot?: number; repo?: string };
        type Join = { kind: "lane"; lane: { slot: number; state: string; dirty: number | null; quietMs: number | null } }
          | { kind: "none" } | { kind: "refused"; slot: number; why: string };
        type JoinFns = { qLaneJoins: (t: PollTask[], s: PollSlot[], repo: string, now: number) => Map<string, Join>;
          qLaneState: (s: PollSlot, now: number) => { state: string; dirty: number | null; quietMs: number | null } };
        let joinFns: JoinFns | null = null;
        let joinErr = "";
        try {
          const src = readFileSync(`${resolve(realpathSync(`${ROOT}/node_modules`), "..")}/src/queue.ts`, "utf8")
            .replace(/^export /gm, "");
          const a = src.indexOf("type QGroup =");
          const b = src.indexOf("function qWaveProjection", a);
          joinFns = new Function(new Bun.Transpiler({ loader: "ts" }).transformSync(src.slice(a, b))
            + "\nreturn { qLaneJoins, qLaneState };")() as JoinFns;
        } catch (e) { joinErr = e instanceof Error ? e.message : String(e); }
        check("lane join precondition: the workbench join block is cut out of the real client source",
          joinFns !== null && typeof joinFns.qLaneJoins === "function", joinErr);
        const live = (await (await get("/api/sessions")).json()) as
          { now: number; dispatch: { repo: string }; slots: PollSlot[]; tasks: PollTask[] };
        const mine = live.slots.find((x) => x.id === cl.slot);
        const joins = joinFns?.qLaneJoins(live.tasks, live.slots, live.dispatch.repo, live.now) ?? new Map<string, Join>();
        const hung = [...joins.values()].filter((x) => x.kind === "lane" && x.lane.slot === cl.slot);
        check("lane join: a hand-opened lane with no task pointer hangs on no task row, same repo or not",
          !!joinFns && !!mine?.worktree && hung.length === 0,
          JSON.stringify({ slot: cl.slot, worktree: mine?.worktree ?? null, hung, rows: live.tasks.length }));
        const st = mine && joinFns ? joinFns.qLaneState(mine, live.now) : null;
        const observed = (mine?.lastOutput ?? 0) > 0;
        check("lane join: the state line carries the dirty count the poll serves, and says running/idle only for an observed pane",
          !!st && st.dirty === 1
            && (observed ? (st.state === "running" || st.state === "idle") && st.quietMs !== null
              : st.state === "unknown" && st.quietMs === null),
          JSON.stringify({ st, observed, lastOutput: mine?.lastOutput, git: mine?.git ?? null }));
      }
    }
    if (cl.slot) await post(`/api/slots/${cl.slot}/kill`, {});
    if (cl.cwd) spawnSync("git", ["worktree", "remove", "--force", cl.cwd], { cwd: REPO });
  }

  // --- OWNER.md rides into a lane like CLAUDE.md does. It is the owner model the steward ritual
  // names as a load duty, and until this landed neither a lane nor the steward worktree ever saw
  // it. Two halves, and the second is the one that could break the fleet: its ABSENCE in the
  // primary must not break a spawn (the copy loop skips a missing file), so the no-file case is
  // asserted FIRST, on a tree where the file genuinely does not exist yet. ---
  {
    const ownerSrc = `${REPO}/OWNER.md`;
    rmSync(ownerSrc, { force: true }); // start from provable absence
    const noFile = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; error?: string };
    check("a lane still spawns when the primary has no OWNER.md", typeof noFile.slot === "number" && exists(noFile.cwd),
      JSON.stringify(noFile));
    check("…and no OWNER.md is invented in the lane", !exists(`${noFile.cwd}/OWNER.md`));
    await post(`/api/slots/${noFile.slot}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", noFile.cwd], { cwd: REPO });

    writeFileSync(ownerSrc, "# the owner model\nnever push from this machine\n", { mode: 0o644 });
    const withFile = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const copied = `${withFile.cwd}/OWNER.md`;
    check("OWNER.md arrives in a freshly spawned lane",
      exists(copied) && readFileSync(copied, "utf8").includes("never push from this machine"), copied);
    // same 0600 floor as .env/CLAUDE.md: the source is 0644 here on purpose, so a mode-preserving
    // copy would fail this — the floor is asserted, not the source's accident.
    const mode = ((): number => { try { return statSync(copied).mode & 0o777; } catch { return -1; } })();
    check("the copied OWNER.md is owner-only (0600)", mode === 0o600, mode === -1 ? "missing" : mode.toString(8));
    // and it must not dirty the lane — a copied UNIGNORED file shows as untracked and blocks land
    const lDiff = (await (await get(`/api/slots/${withFile.slot}/diff`)).json()) as { status: string[] };
    check("the OWNER.md copy leaves the lane clean (gitignored, so land stays possible)",
      lDiff.status.length === 0, JSON.stringify(lDiff.status));
    await post(`/api/slots/${withFile.slot}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", withFile.cwd], { cwd: REPO });
    rmSync(ownerSrc, { force: true });
  }

  // --- issue 2: risk/merged checks measure against the integration branch, not the primary's
  // HEAD. A lane merged into a CONFIGURED integration branch (distinct from main) must read as
  // safe-to-remove — otherwise landLane's own removeWorktreeSafe would wedge after a
  // ref-advance land (lane merged into main, but primary HEAD parked elsewhere). ---
  {
    const l2 = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${l2.cwd}/issue2.txt`, "work\n");
    spawnSync("git", ["-C", l2.cwd, "add", "issue2.txt"]);
    spawnSync("git", ["-C", l2.cwd, "commit", "-qm", "issue2 lane work"]);
    // an integration branch that already CONTAINS the lane (points at its tip), unlike main
    spawnSync("git", ["-C", REPO, "branch", "intb", l2.branch]);
    // baseline (unconfigured → integration branch = main): the lane's commit is unmerged
    const riskBefore = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane reads as unpushed vs main before config", riskBefore.unpushedCommits.length === 1 && riskBefore.empty === false,
      JSON.stringify(riskBefore));
    // configure integration branch = intb (which contains the lane) → lane now reads merged/safe
    await post("/api/repo-base", { repo: REPO, branch: "intb" });
    const riskAfter = (await (await get(`/api/slots/${l2.slot}/risk`)).json()) as { unpushedCommits: unknown[]; empty: boolean };
    check("issue2: lane merged into the configured integration branch reads as safe (no unpushed)",
      riskAfter.unpushedCommits.length === 0 && riskAfter.empty === true, JSON.stringify(riskAfter));
    await post("/api/repo-base", { repo: REPO, branch: "" }); // clear config
    spawnSync("git", ["-C", REPO, "branch", "-D", "intb"]);
    await post(`/api/slots/${l2.slot}/kill`, {});
  }

  // --- shelve → resume round-trip: a lane set aside with a note keeps its worktree AND its
  // uncommitted work; the worktrees map surfaces the note on the now-orphan lane; reopening
  // (attach) re-seats it in a slot and clears the note. (A bare kill leaves a note-less orphan.) ---
  {
    const sh = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${sh.cwd}/shelve-work.txt`, "half done\n"); // uncommitted work that must NOT be lost
    const shRes = await post(`/api/slots/${sh.slot}/shelve`, { note: "finish the parser, then add a test" });
    check("shelve returns ok", shRes.ok, await shRes.text());
    check("shelved slot is now inactive (killed)",
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
        .slots.find((x) => x.id === sh.slot)?.cwd === null);
    check("shelved worktree kept on disk (not destroyed)", exists(sh.cwd));
    check("uncommitted work survives the shelve", exists(`${sh.cwd}/shelve-work.txt`));
    // the board route is a DISPLAY cache (server.ts, THE SWITCH CONTRACT): an entry older than
    // GIT_TICK_MS is served as-is while it recomputes, so a lane opened seconds ago may not be in the
    // list yet — a fast module-only run read it on the stale answer and failed at HEAD 8498717c too.
    // The row is awaited; its FIELDS are then asserted on the answer that carries it.
    type ShRow = { path: string; slot: number | null; note: string | null };
    let orphan: ShRow | undefined;
    try {
      orphan = await until(async () => ((await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as
        { worktrees: ShRow[] }).worktrees.find((w) => w.path === sh.cwd), { timeoutMs: 10_000, what: "the shelved lane on the board" });
    } catch (e) { if (!(e instanceof UntilTimeout)) throw e; }
    check("shelved lane is an orphan (no holding slot)", orphan != null && orphan.slot === null, JSON.stringify(orphan));
    check("shelve note surfaced on the orphan", orphan?.note === "finish the parser, then add a test", JSON.stringify(orphan));
    const reopen = (await (await post("/api/lanes", { repo: REPO, attach: sh.cwd })).json()) as { ok?: boolean; slot?: number; error?: string };
    check("resume (attach) re-seats the shelved lane in a slot", reopen.ok === true && typeof reopen.slot === "number", JSON.stringify(reopen));
    const wmap2 = (await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as { worktrees: { path: string; note: string | null }[] };
    check("resuming clears the shelve note", wmap2.worktrees.find((w) => w.path === sh.cwd)?.note == null,
      JSON.stringify(wmap2.worktrees.find((w) => w.path === sh.cwd)));
    check("shelve rejects a non-worktree slot", (await post("/api/slots/2/shelve", { note: "x" })).status === 400);
    await post(`/api/slots/${reopen.slot ?? 0}/kill`, {}); // free the slot for later tests
  }

  // --- THE CLICKED PLACE and the repo card (Gruendungsfenster B3): attach takes the slot the owner
  // clicked — exactly that one, or a 409 naming who sits there — and dirinfo carries the repo's
  // orphans (worktrees no slot holds) and its declared pack ids at HEAD. Attach WITHOUT `slot` is
  // the shelve → resume round-trip above, unchanged. ---
  {
    type Sl = { id: number; cwd: string | null; label: string | null };
    const slotsNow = async (): Promise<Sl[]> => ((await (await get("/api/sessions")).json()) as { slots: Sl[] }).slots;
    type Info = { git?: boolean; packs?: string[] | { error: string }; orphans?: { path: string; branch: string }[] };
    const info = async (p: string): Promise<Info> =>
      (await (await get(`/api/dirinfo?path=${encodeURIComponent(p)}`)).json()) as Info;
    const isOrphan = (i: Info, p: string): boolean | undefined => i.orphans?.some((o) => o.path === p);

    const ob = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    check("clicked-place probe setup: a lane opened", typeof ob.slot === "number" && exists(ob.cwd), JSON.stringify(ob));
    await post(`/api/slots/${ob.slot}/kill`, {});
    const listed = spawnSync("git", ["-C", REPO, "worktree", "list", "--porcelain"], { encoding: "utf8" }).stdout
      .split("\n").filter((l) => l.startsWith("worktree ")).map((l) => l.slice(9));
    check("clicked-place probe setup: git lists the primary, the held lane and the killed lane as worktrees",
      listed.length >= 3 && listed.includes(lc.lnPath) && listed.includes(ob.cwd), JSON.stringify(listed));
    const before = await info(REPO);
    check("dirinfo lists a killed lane's worktree as an orphan, with its branch",
      before.orphans?.some((o) => o.path === ob.cwd && o.branch === ob.branch) === true, JSON.stringify(before.orphans));
    check("…and neither a worktree a slot holds nor the primary checkout",
      isOrphan(before, lc.lnPath) === false && isOrphan(before, listed[0]) === false, JSON.stringify(before.orphans));

    const held = (await slotsNow()).find((x) => x.id === lc.lnSlot);
    const heldName = held?.label || basename(held?.cwd ?? "");
    const busy = await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: lc.lnSlot });
    const busyJ = (await busy.json()) as { error?: string; occupant?: { slot: number; name: string } };
    check("attach onto an occupied clicked slot is refused 409 and names who sits there",
      heldName !== "" && busy.status === 409 && busyJ.occupant?.slot === lc.lnSlot && busyJ.occupant.name === heldName
        && (busyJ.error ?? "").includes(heldName), `${busy.status} ${JSON.stringify(busyJ)} expected ${heldName}`);
    check("…and the refused attach seated nothing: the tree is still an orphan, the slot still its holder's",
      isOrphan(await info(REPO), ob.cwd) === true && (await slotsNow()).find((x) => x.id === lc.lnSlot)?.cwd === lc.lnPath);
    check("slot without attach is refused 400 — a new lane on a clicked place is open-worktree",
      (await post("/api/lanes", { repo: REPO, slot: lc.lnSlot })).status === 400);
    check("a slot that is not an integer place is refused 400",
      (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: "3" })).status === 400
        && (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: 0 })).status === 400);

    // the LAST free place, so a server that ignored `slot` and took its own first-free pick is caught
    const freeIds = (await slotsNow()).filter((x) => !x.cwd).map((x) => x.id);
    const target = freeIds[freeIds.length - 1];
    check("clicked-place probe setup: two free places, so the clicked one is not the server's own pick",
      freeIds.length >= 2, JSON.stringify(freeIds));
    const seated = (await (await post("/api/lanes", { repo: REPO, attach: ob.cwd, slot: target })).json()) as
      { ok?: boolean; slot?: number; error?: string };
    check("attach with a free clicked slot seats the orphan exactly there, not in the first free place",
      seated.ok === true && seated.slot === target && target !== freeIds[0], JSON.stringify({ seated, freeIds }));
    check("…the clicked slot now holds the orphan's tree, and dirinfo no longer calls it an orphan",
      (await slotsNow()).find((x) => x.id === target)?.cwd === ob.cwd && isOrphan(await info(REPO), ob.cwd) === false);
    await post(`/api/slots/${target}/kill`, {});
    spawnSync("git", ["worktree", "remove", "--force", ob.cwd], { cwd: REPO });

    // packs are read at HEAD from a fixture repo of their own, so REPO's history stays as the
    // merge sections expect it
    const pk = `${REPO}.dirinfo-packs-fixture`;
    rmSync(pk, { recursive: true, force: true });
    mkdirSync(pk, { recursive: true });
    const g = (...a: string[]): number | null =>
      spawnSync("git", ["-C", pk, "-c", "user.email=e2e@test", "-c", "user.name=e2e", ...a]).status;
    writeFileSync(`${pk}/README.md`, "fixture\n");
    check("packs probe setup: a fixture repo with one commit and no manifest",
      g("init", "-q", "-b", "main") === 0 && g("add", "README.md") === 0 && g("commit", "-qm", "no manifest") === 0);
    const none = await info(pk);
    check("dirinfo on a repo without .fleet/context-packs.json: packs is [] (measured absent)",
      none.git === true && Array.isArray(none.packs) && none.packs.length === 0, JSON.stringify(none.packs));
    check("…and a repo without other worktrees has orphans []",
      Array.isArray(none.orphans) && none.orphans.length === 0, JSON.stringify(none.orphans));
    mkdirSync(`${pk}/.fleet`);
    writeFileSync(`${pk}/.fleet/context-packs.json`, JSON.stringify([{ id: "alpha" }, { id: "beta" }]));
    const unborn = await info(pk);
    check("packs are read at HEAD: a manifest on disk but not committed is not there yet",
      Array.isArray(unborn.packs) && unborn.packs.length === 0, JSON.stringify(unborn.packs));
    g("add", ".fleet/context-packs.json");
    g("commit", "-qm", "manifest");
    const two = await info(pk);
    check("dirinfo carries the manifest's pack ids at HEAD, in file order",
      JSON.stringify(two.packs) === JSON.stringify(["alpha", "beta"]), JSON.stringify(two.packs));
    writeFileSync(`${pk}/.fleet/context-packs.json`, "[{ not json");
    g("commit", "-qam", "broken manifest");
    const broken = await info(pk);
    check("an unparseable manifest is the packs field WITH a reason, never a silent []",
      broken.packs !== undefined && !Array.isArray(broken.packs) && typeof broken.packs.error === "string"
        && broken.packs.error.length > 0, JSON.stringify(broken.packs));
    writeFileSync(`${pk}/.fleet/context-packs.json`, JSON.stringify([{ id: "alpha" }, { useWhen: "no id" }]));
    g("commit", "-qam", "pack without id");
    const noId = await info(pk);
    check("a pack without an id is an error naming its index, not a shortened list",
      noId.packs !== undefined && !Array.isArray(noId.packs) && noId.packs.error.includes("pack 1"), JSON.stringify(noId.packs));
    rmSync(pk, { recursive: true, force: true });
  }

  // --- the OTHER teardown, and the one that had none: a dispatch that requeues after the lane is
  // already spawned. briefAndSend's post-spawn gate is retry-shaped — the row goes back to `queued`
  // — and until this landed the worktree and the slot it had just created stayed standing, owned by
  // nobody. Same edge as shelve above, opposite answer: shelve KEEPS a tree because the owner said
  // so, a requeue keeps one only when it holds work, and must say so on the row.
  //
  // The gate is made genuinely red (master stop, flipped inside briefAndSend's 4 s boot sleep), not
  // simulated: the requeue has to actually run for "no worktree left" to mean anything. Every
  // precondition the probe depends on is asserted as ITS OWN check — a lane that never spawned, or
  // a queue that never moved, must fail as a broken probe and never as a clean teardown.
  {
    type Sess = { slots: { id: number; cwd: string | null; worktree: { repo: string } | null }[];
      tasks: { id: string; status: string; slot?: number; note?: string }[];
      dispatch: { on: boolean; maxLanes: number; repo: string } };
    const sess = async (): Promise<Sess> => (await (await get("/api/sessions")).json()) as Sess;
    const rowOf = (s: Sess, id: string): Sess["tasks"][number] | undefined => s.tasks.find((t) => t.id === id);
    // poll rather than sleep: the dispatch tick is 250 ms here and the boot sleep is 4 s, so the
    // flip we are waiting for has to be caught, not timed
    const until = async (id: string, status: string): Promise<Sess> => {
      const t0 = Date.now();
      let last = await sess();
      while (Date.now() - t0 < 15000) {
        if (rowOf(last, id)?.status === status) return last;
        await Bun.sleep(50);
        last = await sess();
      }
      return last;
    };
    const queue = async (text: string): Promise<string> =>
      ((await (await post("/api/tasks", { text, queue: true })).json()) as { task: { id: string } }).task.id;

    await post("/api/autos/switch", { on: true });
    await post("/api/dispatch", { on: true });
    const pre = await sess();
    // the cap the DISPATCHER applies, measured the way it measures: lanes in the dispatch repo,
    // not occupied slots. Paths are compared through realpath because a lane stores the git
    // toplevel (/var → /private/var) while the env keeps whatever the operator typed.
    const canon = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
    const lanesNow = pre.slots.filter((s) => s.worktree && canon(s.worktree.repo) === canon(pre.dispatch.repo)).length;
    check("requeue probe precondition: dispatcher on, a free slot, dispatch-repo lanes under the cap",
      pre.dispatch.on === true && pre.slots.some((s) => !s.cwd) && lanesNow < pre.dispatch.maxLanes,
      `on=${pre.dispatch.on} free=${pre.slots.filter((s) => !s.cwd).length} lanes=${lanesNow}/${pre.dispatch.maxLanes}`);

    // (a) EMPTY lane → the requeue takes the whole lane with it
    const emptyId = await queue("requeue-teardown-empty");
    const sentE = await until(emptyId, "sent");
    const slotE = rowOf(sentE, emptyId)?.slot;
    const cwdE = sentE.slots.find((s) => s.id === slotE)?.cwd ?? "";
    check("requeue probe (empty): the lane really spawned — worktree on disk, slot held",
      typeof slotE === "number" && cwdE !== "" && exists(cwdE), `slot=${slotE} cwd=${cwdE}`);
    await post("/api/autos/switch", { on: false }); // master stop → the post-spawn gate fails for real
    const backE = await until(emptyId, "queued");
    const noteE = rowOf(backE, emptyId)?.note ?? "";
    check("requeue probe (empty): the row went back to queued through the GATE, not some other path",
      rowOf(backE, emptyId)?.status === "queued" && noteE.includes("kill-switch"), `note=${noteE}`);
    check("an empty lane is torn down by its own requeue — no worktree left behind", !exists(cwdE), cwdE);
    check("…and no slot left held by it either",
      backE.slots.find((s) => s.id === slotE)?.cwd === null && rowOf(backE, emptyId)?.slot === undefined,
      `cwd=${backE.slots.find((s) => s.id === slotE)?.cwd} slot=${rowOf(backE, emptyId)?.slot}`);
    await post(`/api/tasks/${emptyId}/delete`, {});

    // (b) DIRTY lane → kept, and the row says why. A silently kept worktree is the same defect.
    await post("/api/autos/switch", { on: true });
    const dirtyId = await queue("requeue-teardown-dirty");
    const sentD = await until(dirtyId, "sent");
    const slotD = rowOf(sentD, dirtyId)?.slot;
    const cwdD = sentD.slots.find((s) => s.id === slotD)?.cwd ?? "";
    check("requeue probe (dirty): the lane really spawned — worktree on disk, slot held",
      typeof slotD === "number" && cwdD !== "" && exists(cwdD), `slot=${slotD} cwd=${cwdD}`);
    if (cwdD) await Bun.write(`${cwdD}/half-written.txt`, "the pane got here first\n");
    check("requeue probe (dirty): the tree is genuinely dirty before the gate fires",
      spawnSync("git", ["-C", cwdD || REPO, "status", "--porcelain"]).stdout.toString().includes("half-written.txt"));
    await post("/api/autos/switch", { on: false });
    const backD = await until(dirtyId, "queued");
    const noteD = rowOf(backD, dirtyId)?.note ?? "";
    check("requeue probe (dirty): the row went back to queued through the GATE",
      rowOf(backD, dirtyId)?.status === "queued" && noteD.includes("kill-switch"), `note=${noteD}`);
    check("a requeue never eats work: a dirty lane is KEPT and the row names the reason",
      exists(cwdD) && exists(`${cwdD}/half-written.txt`) && noteD.includes("lane kept")
        && noteD.includes("uncommitted"), `note=${noteD} tree=${exists(cwdD)}`);
    await post(`/api/tasks/${dirtyId}/delete`, {});
    await post("/api/dispatch", { on: false });
    if (typeof slotD === "number") await post(`/api/slots/${slotD}/kill`, {});
    if (cwdD) spawnSync("git", ["worktree", "remove", "--force", cwdD], { cwd: REPO });
    await post("/api/autos/switch", { on: true });

    // (c) A LANDED ROW IS NOT THE TAIL'S TO REQUEUE. The founding brief is delivered by a DETACHED
    // tail (briefAndSend), and a lane can land inside that window: landLane marks the row `done`
    // and kills the slot, the pending send then throws "slot changed …", and the requeue used to
    // write the landed row back to `queued` (e2e trail 2026-09-12, the self-land progress guard's
    // "REPAIRED candidate" check, twice with note `dispatch failed: slot changed before submit;
    // lane kept (git status failed — worktree gone?)`). The interleaving is FORCED, not timed:
    // the send-before-paste latch parks the tail at a known line, the land runs to completion
    // while it is parked, and only then is the tail released.
    // Mutation caught: dropping the ownership read at the top of briefAndSend#requeue.
    const latch = `${ROOT}/requeue-landed-latch`;
    for (const f of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(f, { force: true });
    const marker = `requeue-landed-probe-${Date.now()}`;
    writeFileSync(latch, marker, { mode: 0o600 });
    await restartSrv({ FLEET_TEST_SEND_BEFORE_PASTE_LATCH: latch });
    await post("/api/dispatch", { on: false }); // a requeued row must not be re-dispatched under the check
    const rlId = ((await (await post("/api/tasks", { text: marker })).json()) as { task: { id: string } }).task.id;
    const rlStart = await post(`/api/tasks/${rlId}/dispatch`, {});
    const rlSlot = ((await rlStart.json()) as { slot?: number }).slot;
    let rlReached = false;
    for (let i = 0; i < 300 && !rlReached; i++) { rlReached = exists(`${latch}.reached`); if (!rlReached) await Bun.sleep(50); }
    check("landed-requeue probe setup: the founding send is PARKED at the pre-paste latch",
      rlStart.ok && typeof rlSlot === "number" && rlReached, `${rlStart.status} slot=${rlSlot} reached=${rlReached}`);
    const rlCwd = (await sess()).slots.find((s) => s.id === rlSlot)?.cwd ?? "";
    let rlLanded = false;
    let rlAtLand: Sess["tasks"][number] | undefined;
    if (rlReached && typeof rlSlot === "number" && rlCwd) {
      writeFileSync(`${rlCwd}/requeue-landed.txt`, "landed while the brief was parked\n");
      spawnSync("git", ["-C", rlCwd, "add", "requeue-landed.txt"]);
      spawnSync("git", ["-C", rlCwd, "commit", "-qm", "requeue landed probe"]);
      await settleForMerge(rlSlot);
      await post(`/api/slots/${rlSlot}/merge`, {});
      rlLanded = (await waitMerge(rlSlot)).gone;
      rlAtLand = rowOf(await sess(), rlId);
    }
    check("landed-requeue probe setup: the lane LANDED while the tail was parked, and the land retired the row",
      rlLanded && rlAtLand?.status === "done" && !exists(`${latch}.release`),
      JSON.stringify({ landed: rlLanded, row: rlAtLand }));
    writeFileSync(`${latch}.release`, "release\n", { mode: 0o600 });
    // the tail's terminal is either the row moving or its skip line on the trail — polled, never slept
    const rlSkipped = (): boolean => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
      .some((l) => l.includes('"dispatch_requeue_skipped"') && l.includes(rlId));
    let rlAfter = rowOf(await sess(), rlId);
    for (let i = 0; i < 200 && rlAfter?.status === "done" && !rlSkipped(); i++) {
      await Bun.sleep(50);
      rlAfter = rowOf(await sess(), rlId);
    }
    check("a row landed under a parked founding brief STAYS done — the released tail requeues nothing it no longer owns",
      rlLanded && rlAfter?.status === "done" && (rlAfter.note ?? "").startsWith("landed") && rlSkipped(),
      JSON.stringify({ row: rlAfter, skipped: rlSkipped() }));
    await post(`/api/tasks/${rlId}/delete`, {});
    for (const f of [latch, `${latch}.reached`, `${latch}.release`]) rmSync(f, { force: true });
    await restartSrv();
  }

  // --- ↻ restart: the one slot verb that is NOT a teardown. Every other exit (kill, shelve, the
  // recycle inside openSlot) funnels through killSlot, which clears sessionId/worktree/label/model/
  // mission, drops the slot's shares and autos, detaches its tasks and — for a lane — emits a lane
  // outcome. Restart must do NONE of that: it kills the pane so ensureSlot can respawn it against
  // the still-pinned conversation. Measured as a before/after on the persisted slot record plus the
  // two ledgers, because that boundary is the whole verb and a future edit that routes it through
  // killSlot "to reuse the teardown" would look perfectly reasonable in a diff.
  //
  // WHAT THIS SUITE CANNOT PROVE: the `--resume <id>` string itself. e2e-isolated.sh runs
  // FLEET_CMD=true, and slotCmd only pins/resumes a session when BASE_CMD starts with `claude` —
  // so sessionId is null on both sides here and asserting the resume string would assert something
  // this harness never produces. That half lives in fleet-e2e-claude-gate.ts, which runs a real
  // `claude` stand-in and therefore has a pin to preserve. ---
  {
    const rs = (await (await post("/api/lanes", { repo: REPO, model: "restart-probe-model-5" })).json()) as
      { slot: number; cwd: string; branch: string };
    await post(`/api/slots/${rs.slot}/mission`, { mission: "the restart must not eat this" });
    const shJ = (await (await post(`/api/slots/${rs.slot}/share`, { mode: "view" })).json()) as { id?: string };
    const auJ = (await (await post(`/api/slots/${rs.slot}/autos`, { text: "survive the restart", inSec: 3600 })).json()) as
      { auto?: { id: string } };
    await Bun.write(`${rs.cwd}/restart-uncommitted.txt`, "half done\n"); // the worktree must be untouched too

    // fleet.json's per-slot record IS the state under test — cwd, label, mission, awaiting,
    // sessionId, worktree, model and selfToken in one object (server.ts saveState). Comparing the
    // WHOLE record rather than a hand-picked field list means a field added to a slot later is
    // covered by this check without anyone remembering to extend it.
    const slotRecord = async (): Promise<string> => JSON.stringify(
      ((await Bun.file(`${ROOT}/fleet.json`).json()) as { slots: Record<string, unknown> }).slots[String(rs.slot)] ?? null);
    const liveState = async () => {
      const j = (await (await get("/api/sessions")).json()) as
        { slots: { id: number; cwd: string | null; share?: { id: string } | null }[]; autos: { id: string; slot: number }[] };
      return { slot: j.slots.find((x) => x.id === rs.slot), autos: j.autos };
    };
    const outcomes = async (): Promise<{ branch?: string }[]> =>
      ((await (await get("/api/lane-outcomes?limit=1000")).json()) as { outcomes: { branch?: string }[] }).outcomes;
    // DELTA off a baseline, never an absolute count: opening this lane already wrote a
    // self_heal_recreate row of its own (ensureSlot audits its FIRST spawn too), and slot ids are
    // recycled across the suite, so this id legitimately carries older rows.
    let slotAuditError = "";
    const slotAudit = (): string[] => {
      try {
        return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
          .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number }; } catch { return null; } })
          .filter((r): r is { event?: string; slot?: number } => !!r && r.slot === rs.slot)
          .map((r) => String(r.event ?? ""));
      } catch (e) {
        slotAuditError = e instanceof Error ? e.message : String(e);
        return [];
      }
    };

    await Bun.sleep(300); // saveState/audit writes are chained and fire-and-forget — let the setup land before baselining
    const recBefore = await slotRecord();
    const outBefore = (await outcomes()).length;
    const auditBefore = slotAudit().length;
    check("restart fixture precondition: audit.jsonl is readable before the delta baseline",
      slotAuditError === "", slotAuditError);
    const paneBefore = (await tmuxOut("display-message", "-p", "-t", `s${rs.slot}`, "#{pane_pid}")).out.trim();

    const rsRes = await post(`/api/slots/${rs.slot}/restart`, {});
    const rsJ = (await rsRes.json()) as { ok?: boolean; resumed?: boolean; error?: string };
    check("↻ restart answers ok, and says whether the pinned conversation came back",
      rsRes.ok && rsJ.ok === true && typeof rsJ.resumed === "boolean", `${rsRes.status} ${JSON.stringify(rsJ)}`);
    // FLEET_CMD=true pins nothing, so `false` is the TRUTH here, not a defect — the route must
    // report it rather than claim a resume it did not perform (the claude-gate suite owns the
    // other branch of this same field).
    check("↻ restart under an unpinned FLEET_CMD reports resumed:false, never a claimed resume",
      rsJ.resumed === false, JSON.stringify(rsJ));

    const paneAfter = (await tmuxOut("display-message", "-p", "-t", `s${rs.slot}`, "#{pane_pid}")).out.trim();
    check("↻ restart leaves a LIVE pane behind — rebuilt inline, not left to the 2s self-heal tick",
      paneAfter !== "" && paneAfter !== paneBefore, `before=${paneBefore} after=${paneAfter}`);

    check("↻ restart changes NOTHING in the slot's persisted record (sessionId, worktree, label, model, mission, selfToken)",
      (await slotRecord()) === recBefore, `before=${recBefore} after=${await slotRecord()}`);

    const live = await liveState();
    check("↻ restart keeps the slot's share — a restart is not a session ending",
      !!shJ.id && live.slot?.share?.id === shJ.id, `${shJ.id} → ${live.slot?.share?.id}`); // id only — the detail must not echo the share secret
    check("↻ restart keeps the slot's scheduled prompts",
      !!auJ.auto?.id && live.autos.some((a) => a.id === auJ.auto?.id && a.slot === rs.slot),
      `${auJ.auto?.id} → ${JSON.stringify(live.autos.filter((a) => a.slot === rs.slot))}`);
    const outAfter = await outcomes();
    check("↻ restart writes NO lane outcome — the lane did not end, so the ledger must stay silent",
      outAfter.length === outBefore && !outAfter.some((o) => o.branch === rs.branch),
      `before=${outBefore} after=${outAfter.length} thisBranch=${outAfter.filter((o) => o.branch === rs.branch).length}`);
    check("↻ restart leaves the worktree and its uncommitted work alone", exists(`${rs.cwd}/restart-uncommitted.txt`));

    // the trail must say WHO rebuilt the pane. Booking an owner-triggered restart as
    // self_heal_recreate would feed slotstats' resumed/heals a rebuild that resumes by
    // construction — inflating the exact durability rate it is no evidence for.
    let auditNew: string[] = [];
    for (let i = 0; i < 50; i++) { // the audit write is chained and fire-and-forget — poll, never sleep-and-hope
      auditNew = slotAudit().slice(auditBefore);
      if (auditNew.length > 0) break;
      await Bun.sleep(100);
    }
    check("↻ restart is trailed as slot_restart, never as a self-heal (slotstats must not read it as a heal)",
      auditNew.length === 1 && auditNew[0] === "slot_restart", JSON.stringify(auditNew));

    await post(`/api/slots/${rs.slot}/kill`, {});
    check("↻ restart refuses an inactive slot", (await post(`/api/slots/${rs.slot}/restart`, {})).status === 400);
  }

  // --- lane brief must be LANE-SCOPED and match git exactly (regression: it used to show
  // the base branch's whole history for lanes, and truncated the first uncommitted file) ---
  {
    const bl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    // two lane commits on top of the base
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-a.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit one"]);
    await Bun.write(`${bl.cwd}/lane-b.txt`, "b\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-b.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit two"]);
    // main diverges on a file the lane never touched (regression bait for two-dot footprint)
    await Bun.write(`${REPO}/divergent.txt`, "main only\n");
    spawnSync("git", ["-C", REPO, "add", "divergent.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "main divergence"]);
    // mixed uncommitted work: unstaged modify (leading-space porcelain), staged add, untracked
    await Bun.write(`${bl.cwd}/lane-a.txt`, "a changed\n");
    await Bun.write(`${bl.cwd}/lane-staged.txt`, "s\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-staged.txt"]);
    await Bun.write(`${bl.cwd}/lane-untracked.txt`, "u\n");

    const blb = (await (await get(`/api/slots/${bl.slot}/brief`)).json()) as
      { laneScoped: boolean; laneBase: string; ahead: number; behind: number; head: string | null;
        commits: { subject: string }[]; repoCommits: { subject: string }[];
        files: string[]; uncommittedFiles: string[] };
    // git truth for comparison
    const gitCommits = spawnSync("git", ["-C", bl.cwd, "log", "--format=%s", `${blb.laneBase}..HEAD`]).stdout.toString().split("\n").filter(Boolean);
    const gitStatus = spawnSync("git", ["-C", bl.cwd, "status", "--porcelain"]).stdout.toString().split("\n").filter(Boolean);
    const gitFootprint = spawnSync("git", ["-C", bl.cwd, "diff", "--name-only", `${blb.laneBase}...HEAD`]).stdout.toString().split("\n").filter(Boolean);

    check("lane brief is laneScoped with the base branch", blb.laneScoped === true && (blb.laneBase === "main" || blb.laneBase === "master"));
    check("lane commits = git main..HEAD exactly (no base history)",
      blb.commits.map((c) => c.subject).join("|") === gitCommits.join("|")
      && blb.commits.length === 2 && !blb.commits.some((c) => c.subject.startsWith("main:")),
      `brief=${JSON.stringify(blb.commits.map((c) => c.subject))} git=${JSON.stringify(gitCommits)}`);
    check("lane ahead/behind vs base match git (ahead 2, behind 1)", blb.ahead === 2 && blb.behind === 1,
      `ahead=${blb.ahead} behind=${blb.behind}`);
    check("lane footprint is three-dot (only lane's own files, not main's divergence)",
      blb.files.map((f) => f.slice(3)).sort().join(",") === gitFootprint.sort().join(",")
      && !blb.files.some((f) => f.includes("divergent.txt")),
      `brief=${JSON.stringify(blb.files)} git=${JSON.stringify(gitFootprint)}`);
    check("lane uncommittedFiles match git status byte-for-byte (columns preserved)",
      blb.uncommittedFiles.join("\n") === gitStatus.join("\n"),
      `brief=${JSON.stringify(blb.uncommittedFiles)} git=${JSON.stringify(gitStatus)}`);
    check("first uncommitted entry keeps its leading status column (not truncated)",
      blb.uncommittedFiles.some((f) => f === " M lane-a.txt"), JSON.stringify(blb.uncommittedFiles));
    // --- the board's identity line (§F4): the commit the tree actually sits on. A branch name
    // says WHICH lane, never WHERE it is — two lanes off the same base read identically until
    // one of them commits, and this is the field that tells them apart.
    const gitHead = spawnSync("git", ["-C", bl.cwd, "rev-parse", "--short", "HEAD"]).stdout.toString().trim();
    check("lane brief carries the short HEAD sha, and it is git's", blb.head === gitHead && /^[0-9a-f]{7,}$/.test(blb.head ?? ""),
      `brief=${blb.head} git=${gitHead}`);
    // --- repoCommits is the COMPLEMENT of `commits`, not a second copy of it: for a lane that is
    // the base branch's own recent history ("what the project got while I was working"). The lane's
    // commits appearing here would make the board's two subheads say the same thing twice.
    const repoSubjects = (blb.repoCommits ?? []).map((c) => c.subject);
    check("lane repoCommits = the BASE branch's history (has main's divergence, not the lane's own commits)",
      repoSubjects.includes("main divergence") && !repoSubjects.some((s) => s.startsWith("lane commit")),
      JSON.stringify(repoSubjects));
    // HEAD is a fact about the tree, not a cached label — one more commit must move it
    await Bun.write(`${bl.cwd}/lane-c.txt`, "c\n");
    spawnSync("git", ["-C", bl.cwd, "add", "lane-c.txt"]);
    spawnSync("git", ["-C", bl.cwd, "commit", "-qm", "lane commit three"]);
    const blb2 = (await (await get(`/api/slots/${bl.slot}/brief`)).json()) as { head: string | null };
    check("lane brief HEAD follows a new commit", blb2.head !== null && blb2.head !== blb.head
      && blb2.head === spawnSync("git", ["-C", bl.cwd, "rev-parse", "--short", "HEAD"]).stdout.toString().trim(),
      `before=${blb.head} after=${blb2.head}`);
    await post(`/api/slots/${bl.slot}/kill`, {}); // free the slot; worktree orphaned in the throwaway repo
  }

  // --- 💾 commit endpoint: a LANE stages untracked too (add -A), a MAIN (non-lane) session
  // stages tracked only (add -u) so scratch/secrets never sweep into a shipped branch, and a
  // detached HEAD is refused. All on throwaway repos — never the real checkout. ---
  {
    // (a) lane commit includes untracked → clean tree afterwards
    const cl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    await Bun.write(`${cl.cwd}/tracked.txt`, "x\n");
    spawnSync("git", ["-C", cl.cwd, "add", "tracked.txt"]);
    spawnSync("git", ["-C", cl.cwd, "commit", "-qm", "seed"]);
    await Bun.write(`${cl.cwd}/tracked.txt`, "x changed\n");    // tracked modify
    await Bun.write(`${cl.cwd}/fresh-untracked.txt`, "u\n");    // untracked
    const clRes = (await (await post(`/api/slots/${cl.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean };
    const clStatus = spawnSync("git", ["-C", cl.cwd, "status", "--porcelain"]).stdout.toString().trim();
    check("lane commit stages untracked too (add -A) → clean tree", clRes.committed === true && clStatus === "",
      `committed=${clRes.committed} status=${JSON.stringify(clStatus)}`);
    await post(`/api/slots/${cl.slot}/kill`, {});

    // (b) main-session commit stages tracked only (add -u), leaves untracked alone
    const mainRepo = `${REPO}.commit-main`;
    spawnSync("git", ["init", "-q", "-b", "main", mainRepo]); // fakemerge hardcodes `git rebase main`
    spawnSync("git", ["-C", mainRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", mainRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${mainRepo}/f.txt`, "1\n");
    spawnSync("git", ["-C", mainRepo, "add", "f.txt"]);
    spawnSync("git", ["-C", mainRepo, "commit", "-qm", "init"]);
    await post("/api/slots/9/kill", {}); // ensure the slot is free before opening
    const mOpen = await post("/api/slots/9/open", { cwd: mainRepo });
    check("open a main (non-lane) session for commit test", mOpen.ok, JSON.stringify(await mOpen.json().catch(() => ({}))));
    await Bun.write(`${mainRepo}/f.txt`, "2\n");                 // tracked modify
    await Bun.write(`${mainRepo}/scratch.txt`, "secret\n");     // untracked — must NOT be committed
    const mRes = (await (await post("/api/slots/9/commit", { mode: "quick", confirm: true })).json()) as { committed?: boolean };
    const mStatus = spawnSync("git", ["-C", mainRepo, "status", "--porcelain"]).stdout.toString();
    check("main-session commit stages tracked (add -u), leaves untracked untracked",
      mRes.committed === true && /\?\? scratch\.txt/.test(mStatus) && !/f\.txt/.test(mStatus),
      `committed=${mRes.committed} status=${JSON.stringify(mStatus)}`);

    // (c) a detached HEAD is refused (would otherwise be a dangling commit)
    spawnSync("git", ["-C", mainRepo, "checkout", "-q", "--detach"]);
    await Bun.write(`${mainRepo}/f.txt`, "3\n");
    const dRes = (await (await post("/api/slots/9/commit", { mode: "quick", confirm: true })).json()) as { committed?: boolean; reason?: string };
    check("commit refuses a detached HEAD", dRes.committed === false && (dRes.reason ?? "").includes("detached"), JSON.stringify(dRes));
    await post("/api/slots/9/kill", {});

    // (d) an interrupted rebase is surfaced (brief.gitOp) and blocks commit — restart-recovery
    // detection. Isolated repo so the induced conflict never touches the shared test repo.
    const gopRepo = `${REPO}.gitop`;
    spawnSync("git", ["init", "-q", "-b", "main", gopRepo]); // fakemerge hardcodes `git rebase main`
    spawnSync("git", ["-C", gopRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", gopRepo, "config", "user.name", "e2e"]);
    await Bun.write(`${gopRepo}/c.txt`, "base\n");
    spawnSync("git", ["-C", gopRepo, "add", "c.txt"]);
    spawnSync("git", ["-C", gopRepo, "commit", "-qm", "base"]);
    const gl = (await (await post("/api/lanes", { repo: gopRepo })).json()) as { slot: number; cwd: string };
    await Bun.write(`${gl.cwd}/c.txt`, "lane side\n");            // lane edit
    spawnSync("git", ["-C", gl.cwd, "commit", "-aqm", "lane edit"]);
    const gopMain = spawnSync("git", ["-C", gopRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.toString().trim();
    await Bun.write(`${gopRepo}/c.txt`, "main side\n");           // main edits the SAME line → conflict
    spawnSync("git", ["-C", gopRepo, "commit", "-aqm", "main edit"]);
    spawnSync("git", ["-C", gl.cwd, "rebase", gopMain]);          // stops mid-rebase on the conflict
    const glBrief = (await (await get(`/api/slots/${gl.slot}/brief`)).json()) as { gitOp?: boolean };
    check("brief flags an interrupted rebase (gitOp)", glBrief.gitOp === true, JSON.stringify(glBrief.gitOp));
    const glCommit = (await (await post(`/api/slots/${gl.slot}/commit`, { mode: "quick", confirm: true })).json()) as { committed?: boolean; reason?: string };
    check("commit is blocked during an interrupted rebase", glCommit.committed === false && (glCommit.reason ?? "").includes("in progress"), JSON.stringify(glCommit));
    spawnSync("git", ["-C", gl.cwd, "rebase", "--abort"]);
    await post(`/api/slots/${gl.slot}/kill`, {});
  }

  // --- THE LANE FORM: a working copy that is its own repository. A worktree's `.git` is a FILE
  // pointing into the primary's common dir, so a worktree is not self-contained: handed alone to a
  // sandbox it is a directory git cannot work in, and handed WITH its common dir it carries
  // `.git/hooks`, whose contents run on the HOST on the owner's next commit. A clone lane has its
  // own object database, hooks and config. Everything below exists to prove that the boundary is
  // real AND that the lane is still a lane: same board numbers, same land, same ledgers.
  {
    const g = (repo: string, ...a: string[]): string =>
      spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" }).stdout.toString().trim();
    const cRepo = `${REPO}.cloneform`;
    rmSync(cRepo, { recursive: true, force: true });
    spawnSync("git", ["init", "-q", "-b", "main", cRepo]);
    spawnSync("git", ["-C", cRepo, "config", "user.email", "e2e@test"]);
    spawnSync("git", ["-C", cRepo, "config", "user.name", "e2e"]);
    writeFileSync(`${cRepo}/base.txt`, "base\n");
    spawnSync("git", ["-C", cRepo, "add", "base.txt"]);
    spawnSync("git", ["-C", cRepo, "commit", "-qm", "base"]);

    const cl = (await (await post("/api/lanes", { repo: cRepo, form: "clone" })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; branch?: string; form?: string; error?: string };
    check("a lane opens with form=clone", cl.ok === true && cl.form === "clone" && typeof cl.cwd === "string",
      JSON.stringify(cl));
    check("an unknown lane form is refused rather than silently defaulted",
      (await post("/api/lanes", { repo: cRepo, form: "shallow" })).status === 400);
    const cCwd = cl.cwd ?? "";
    const cSlot = cl.slot ?? -1;
    const cBranch = cl.branch ?? "";

    // THE BOUNDARY, as a measurement and not a claim. `--git-common-dir` is the directory git
    // would read hooks and config from: for a worktree it is the PRIMARY's, for a clone it must be
    // the clone's own. The pair is asserted together, because "the clone is isolated" and "the
    // worktree still is not" are the two halves of one fact — and the second is what makes the
    // first worth having.
    const commonDir = (dir: string): string =>
      g(dir, "rev-parse", "--path-format=absolute", "--git-common-dir");
    const cCommon = commonDir(cCwd);
    check("a clone lane's git common dir is its OWN .git, not the repo's",
      cCommon !== "" && realpathSync(cCommon) === realpathSync(`${cCwd}/.git`)
      && realpathSync(cCommon) !== realpathSync(`${cRepo}/.git`),
      `${cCommon} vs ${cRepo}/.git`);
    check("the repo's hooks directory is not reachable from inside a clone lane",
      !exists(`${cCommon}/../../.git/hooks`) || realpathSync(`${cCommon}/hooks`) !== realpathSync(`${cRepo}/.git/hooks`),
      `${cCommon}/hooks`);
    check("a clone lane's .git is a directory (a worktree lane's is a gitdir FILE)",
      exists(`${cCwd}/.git`) && lstatSync(`${cCwd}/.git`).isDirectory()
      && exists(`${lc.lnPath}/.git`) && lstatSync(`${lc.lnPath}/.git`).isFile(),
      `clone=${exists(`${cCwd}/.git`) ? lstatSync(`${cCwd}/.git`).isDirectory() : "missing"}`);
    // --no-hardlinks is the whole point of the form: an `alternates` file or shared object inodes
    // would leave the two repos reading the same bytes, which is the separation this is for.
    check("a clone lane borrows no objects from the repo (no alternates file)",
      !exists(`${cCwd}/.git/objects/info/alternates`));
    check("a clone lane is invisible to `git worktree list` — it is not a worktree of the repo",
      !g(cRepo, "worktree", "list", "--porcelain").includes(cCwd), cCwd);
    // ...which is exactly why the lane map has to add it back: that surface answers "every lane
    // open on this repo", and an omission there would read as "no such lane".
    const cMap = (await (await get(`/api/slots/${cSlot}/worktrees`)).json()) as
      { repo?: string; worktrees?: { path: string; branch: string; slot: number | null }[] };
    check("the lane map lists a clone lane, anchored on the REPO and not on the clone itself",
      realpathSync(cMap.repo ?? "/") === realpathSync(cRepo)
      && (cMap.worktrees ?? []).some((w) => w.path === cCwd && w.branch === cBranch && w.slot === cSlot),
      JSON.stringify(cMap).slice(0, 300));

    // THE MIRROR. Everything Fleet knows about a lane is read either root-side by branch name
    // (drift, risk, `branch --merged`, the ff-merge) or tree-side against the base branch (the git
    // tick's ahead/behind, the rebase). A clone satisfies neither until both refs are mirrored.
    check("a fresh clone lane's branch is mirrored into the repo at spawn, not at the first tick",
      g(cRepo, "rev-parse", "--verify", `refs/heads/${cBranch}`) === g(cCwd, "rev-parse", "HEAD"),
      `${g(cRepo, "rev-parse", "--verify", `refs/heads/${cBranch}`)} vs ${g(cCwd, "rev-parse", "HEAD")}`);

    writeFileSync(`${cCwd}/lane.txt`, "clone lane work\n");
    spawnSync("git", ["-C", cCwd, "add", "lane.txt"]);
    spawnSync("git", ["-C", cCwd, "commit", "-qm", "clone lane work"]);
    writeFileSync(`${cRepo}/main.txt`, "main side\n"); // different file → no conflict
    spawnSync("git", ["-C", cRepo, "add", "main.txt"]);
    spawnSync("git", ["-C", cRepo, "commit", "-qm", "clone-form main work"]);

    // The board's numbers, from the clone. `behind` is the one that can only be right if the tick
    // mirrors the base branch DOWN into the clone — without it the clone measures against main as
    // it stood at clone time and reports 0 forever, which is a confident wrong answer rather than
    // a missing one. Polled past one full tick because that tick IS the mechanism under test.
    type Sess = { slots: { id: number; git: { branch: string; ahead: number; behind: number; dirty: number } | null }[] };
    let cGit: Sess["slots"][number]["git"] = null;
    for (let i = 0; i < 160; i++) {
      cGit = ((await (await get("/api/sessions")).json()) as Sess).slots.find((x) => x.id === cSlot)?.git ?? null;
      if (cGit && cGit.ahead === 1 && cGit.behind === 1) break;
      await Bun.sleep(150);
    }
    check("the board reads branch/ahead/behind/dirty for a clone lane out of the clone",
      cGit?.branch === cBranch && cGit.ahead === 1 && cGit.behind === 1 && cGit.dirty === 0,
      JSON.stringify(cGit));
    check("the tick mirrors the lane's new commit back into the repo",
      g(cRepo, "rev-parse", `refs/heads/${cBranch}`) === g(cCwd, "rev-parse", "HEAD"));

    // STALENESS, said out loud. Every root-side number about a clone lane is read off the mirror,
    // so it can be a moment old — and a stale-but-confident number is precisely the failure this
    // form must not introduce. A worktree lane has no copy and is never stale.
    // Its own lane in its own repo: the probe has to WEDGE a rebase to hold the mirror still, and
    // a wedged lane is the last thing to leave lying next to the one about to be landed.
    const driftOf = async (slot: number): Promise<{ stale?: boolean | null; behind?: number; error?: string }> => {
      let tok = "";
      try {
        tok = ((JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken) ?? "";
      } catch { /* state file mid-write — an empty token fails as unauthorized, which is honest */ }
      return (await (await fetch(`${BASE}/api/self/drift`, { headers: { "x-fleet-self-token": tok } })).json()) as
        { stale?: boolean | null; behind?: number; error?: string };
    };
    check("drift on a synced clone lane reports itself fresh", (await driftOf(cSlot)).stale === false,
      JSON.stringify(await driftOf(cSlot)));
    check("drift on a worktree lane is never stale — there is no copy to be stale",
      (await driftOf(lc.lnSlot)).stale === false, JSON.stringify(await driftOf(lc.lnSlot)));
    {
      const sRepo = `${REPO}.clonestale`;
      rmSync(sRepo, { recursive: true, force: true });
      spawnSync("git", ["init", "-q", "-b", "main", sRepo]);
      spawnSync("git", ["-C", sRepo, "config", "user.email", "e2e@test"]);
      spawnSync("git", ["-C", sRepo, "config", "user.name", "e2e"]);
      writeFileSync(`${sRepo}/f.txt`, "base\n");
      spawnSync("git", ["-C", sRepo, "add", "f.txt"]);
      spawnSync("git", ["-C", sRepo, "commit", "-qm", "base"]);
      const sl = (await (await post("/api/lanes", { repo: sRepo, form: "clone" })).json()) as
        { ok?: boolean; slot?: number; cwd?: string };
      const sSlot = sl.slot ?? -1;
      const sCwd = sl.cwd ?? "";
      check("stale probe precondition: a second clone lane opened", sl.ok === true && sCwd !== "", JSON.stringify(sl));
      // Deterministic, not a race against the 10 s tick: the tick deliberately does not write refs
      // into a lane whose git is mid-operation, so a wedged rebase pins the mirror where it is for
      // as long as the probe needs. That is also the real scenario worth pinning — while a lane is
      // being rewritten, Fleet must not report its root-side numbers as current.
      writeFileSync(`${sCwd}/f.txt`, "lane side\n");
      spawnSync("git", ["-C", sCwd, "commit", "-aqm", "stale-probe lane edit"]);
      writeFileSync(`${sRepo}/f.txt`, "main side\n");
      spawnSync("git", ["-C", sRepo, "commit", "-aqm", "stale-probe main edit"]);
      spawnSync("git", ["-C", sCwd, "fetch", "-q", sRepo, "+refs/heads/main:refs/heads/main"]);
      spawnSync("git", ["-C", sCwd, "rebase", "main"]); // halts on the conflict, mid-rebase
      check("stale probe precondition: the clone lane is genuinely wedged mid-rebase",
        exists(`${sCwd}/.git/rebase-merge`) || exists(`${sCwd}/.git/rebase-apply`));
      let staleSeen: boolean | null | undefined;
      for (let i = 0; i < 120; i++) {
        staleSeen = (await driftOf(sSlot)).stale;
        if (staleSeen === true) break;
        await Bun.sleep(150);
      }
      check("drift SAYS SO when the repo's mirror no longer matches the clone", staleSeen === true,
        JSON.stringify(await driftOf(sSlot)));
      spawnSync("git", ["-C", sCwd, "rebase", "--abort"]);
      let backFresh: boolean | null | undefined;
      for (let i = 0; i < 160; i++) {
        backFresh = (await driftOf(sSlot)).stale;
        if (backFresh === false) break;
        await Bun.sleep(150);
      }
      check("...and once the lane's git is free again the tick clears the staleness by itself",
        backFresh === false, JSON.stringify(await driftOf(sSlot)));
      await post(`/api/slots/${sSlot}/kill`, {});
      rmSync(sCwd, { recursive: true, force: true }); // kill keeps the tree; nothing else will collect a clone
    }

    // THE LAND. Same verbs, same ledgers: the branch reaches the repo by fetch instead of by
    // shared refs, and everything downstream of that is the path a worktree lane takes.
    const cMainBefore = g(cRepo, "rev-parse", "main");
    await setMergeMode("blocked"); // the agent, if wrongly consulted, would block — it must not be
    await settleForMerge(cSlot);
    await post(`/api/slots/${cSlot}/merge`, {});
    const cV = await waitMerge(cSlot);
    check("a clone lane lands through the ordinary script path, agent never consulted", cV.gone,
      JSON.stringify(cV));
    check("the clone lane's commit reached the repo's main",
      g(cRepo, "log", "--oneline", "-8").includes("clone lane work"), g(cRepo, "log", "--oneline", "-3"));
    check("landing a clone lane removes the clone from disk", !exists(cCwd), cCwd);
    const cMainAfter = g(cRepo, "rev-parse", "main");
    const cNote = spawnSync("git", ["-C", cRepo, "notes", "--ref=fleet/land", "show", cMainAfter], { encoding: "utf8" });
    check("a clone land is recorded like any other: git-note provenance on the landed tip",
      cNote.status === 0 && cMainAfter !== cMainBefore
      && (JSON.parse(cNote.stdout.toString().trim()) as { branch?: string }).branch === cBranch,
      `${cNote.status} ${cNote.stdout.toString().slice(0, 160)}`);
    const cOut = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string; disposition: string; verified: boolean | null }[] }).outcomes;
    const cRow = cOut.find((o) => o.branch === cBranch);
    check("a clone land emits its LaneOutcome unchanged",
      cRow?.disposition === "landed" && cRow.verified === true,
      JSON.stringify(cRow).slice(0, 200));

    // THE DEFAULT, unchanged: a lane asked for without a form is still a worktree, sharing the
    // repo's git. Asserted here rather than assumed, because the whole cut of this change is
    // "clones ALONGSIDE worktrees" — if the default moved, that cut did not hold.
    const dflt = (await (await post("/api/lanes", { repo: cRepo })).json()) as
      { ok?: boolean; slot?: number; cwd?: string; form?: string };
    check("a lane requested with no form is still a worktree sharing the repo's git",
      dflt.ok === true && dflt.form === "worktree"
      && lstatSync(`${dflt.cwd}/.git`).isFile()
      && realpathSync(commonDir(dflt.cwd ?? "")) === realpathSync(`${cRepo}/.git`),
      `form=${dflt.form} common=${commonDir(dflt.cwd ?? "")}`);
    const dfltSess = (await (await get("/api/sessions")).json()) as
      { slots: { id: number; worktree: { form?: string } | null }[] };
    check("...and it persists with no form field at all — today's shape, byte for byte",
      dfltSess.slots.find((x) => x.id === dflt.slot)?.worktree?.form === undefined,
      JSON.stringify(dfltSess.slots.find((x) => x.id === dflt.slot)?.worktree));
    await post(`/api/slots/${dflt.slot ?? 0}/kill`, {});
    spawnSync("git", ["-C", cRepo, "worktree", "remove", "--force", dflt.cwd ?? ""]);
    await setMergeMode("blocked");
  }
  // === THE LANE'S BATON: a lane whose context filled hands over on the SAME worktree ============
  // Until 2026-09-12 POST /api/self/succeed answered a lane 409 "a lane lands — it does not
  // migrate". Measured that day: Slot 7 ended a two-row wave at 48.7 % of a 1M window, its pane
  // stream carrying 111 suite-wrapper lines and 49 FAIL lines. A lane that full is in the worst
  // position to do the one thing that refusal told it to do. So it now hands the baton to a fresh
  // session on the same worktree, branch, slot and queue rows — and what this block proves is that
  // NOTHING ELSE moves: no land, no second worktree, no row status, and nothing at all when the
  // tree is dirty.
  {
    type BatonState = {
      slots?: Record<string, { selfToken?: string; openedAt?: number; taskId?: string | null;
        programId?: string | null; laneSuccessions?: number; worktree?: { branch?: string } | null }>;
      tasks?: { id: string; status: string; slot: number | null; programId?: string | null }[];
      programs?: Record<string, unknown>[];
    };
    const batonState = (): BatonState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as BatonState;
    const batonSlot = (id: number) => batonState().slots?.[String(id)];
    const selfGet = (token: string, path = "/api/self"): Promise<Response> =>
      fetch(BASE + path, { headers: { "x-fleet-self-token": token } });
    const selfPost = (token: string, path: string, body: unknown): Promise<Response> =>
      fetch(BASE + path, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": token },
        body: JSON.stringify(body) });

    const BATON_TASK_TEXT = "BATON FIXTURE: cut one of three — the relay's founding row, quoted back to the successor verbatim";
    const BATON_HANDOFF = "BATON HANDOFF: cut one committed and green; cut two is the parser; open number is the 3.4 s wrapper wait.";
    const lnRes = await post("/api/lanes", { repo: REPO });
    const ln = (await lnRes.json()) as { ok?: boolean; slot?: number; cwd?: string; branch?: string };
    const batonCwd = ln.cwd ?? "";
    const batonBranch = ln.branch ?? "";
    const batonSlotId = ln.slot ?? 0;
    check("baton setup: a lane for the succession fixture exists on disk",
      ln.ok === true && batonSlotId > 0 && batonBranch !== "" && exists(batonCwd), JSON.stringify(ln));
    const taskRes = await post("/api/tasks", { text: BATON_TASK_TEXT, queue: false });
    const batonTaskId = ((await taskRes.json()) as { task?: { id: string } }).task?.id ?? "";
    check("baton setup: the founding queue row exists", batonTaskId !== "", batonTaskId);

    // committed lane work — the successor inherits the BRANCH, so this is the state it must be shown
    writeFileSync(`${batonCwd}/baton.txt`, "cut one\n");
    spawnSync("git", ["-C", batonCwd, "add", "baton.txt"]);
    spawnSync("git", ["-C", batonCwd, "commit", "-qm", "baton: cut one of the relay"]);

    // …and what only the dispatcher writes: the row this lane holds and the Program it belongs to.
    // Planted through the state file exactly as the migration and acceptance-door fixtures do,
    // because no owner route binds an EXISTING lane to a row, and the subject of this block is the
    // handover, not the dispatch that would otherwise have to precede it.
    await stopSrv();
    const batonProgramId = "ba7017".padEnd(24, "0");
    const plant = batonState();
    const plantedAt = Date.now();
    plant.programs = [...(plant.programs ?? []), {
      id: batonProgramId, title: "Baton relay fixture", intent: "Prove a lane hands over on its own worktree",
      successCriterion: "A successor session continues the same branch", nonGoals: [],
      decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: plantedAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: plantedAt - 900, activatedAt: plantedAt - 800,
    }];
    const plantedSlot = plant.slots?.[String(batonSlotId)];
    if (plantedSlot) { plantedSlot.taskId = batonTaskId; plantedSlot.programId = batonProgramId; }
    const plantedRow = plant.tasks?.find((t) => t.id === batonTaskId);
    if (plantedRow) { plantedRow.status = "sent"; plantedRow.slot = batonSlotId; plantedRow.programId = batonProgramId; }
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(plant, null, 2), { mode: 0o600 });
    await restartSrv();
    const batonTok = batonSlot(batonSlotId)?.selfToken ?? "";
    const batonOpenedAt = batonSlot(batonSlotId)?.openedAt ?? 0;
    check("baton setup: the lane carries its row and its Program, and its credential is readable",
      /^[0-9a-f]{32}$/.test(batonTok) && batonSlot(batonSlotId)?.taskId === batonTaskId
        && batonSlot(batonSlotId)?.programId === batonProgramId
        && batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent",
      JSON.stringify({ task: batonSlot(batonSlotId)?.taskId, program: batonSlot(batonSlotId)?.programId,
        row: batonState().tasks?.find((t) => t.id === batonTaskId)?.status }));

    // A DIRTY TREE REFUSES, AND SPAWNS NOTHING. The successor inherits the branch and nothing else,
    // so an uncommitted line is not "unfinished work carried over" — it is work destroyed by a
    // handover that looked like it worked.
    writeFileSync(`${batonCwd}/baton-uncommitted.txt`, "this line would be lost\n");
    const dirtyRes = await selfPost(batonTok, "/api/self/succeed", {});
    const dirtyBody = (await dirtyRes.json()) as { error?: string; status?: string[] };
    check("(baton) a lane with an unclean tree is refused 409, and the porcelain lines come back with it",
      dirtyRes.status === 409 && (dirtyBody.error ?? "").includes("not clean")
        && (dirtyBody.status ?? []).some((l) => l.includes("baton-uncommitted.txt")),
      `${dirtyRes.status} ${JSON.stringify(dirtyBody).slice(0, 240)}`);
    check("(baton) …and that refusal spawned nothing: same occupant, same credential, no baton counted",
      batonSlot(batonSlotId)?.openedAt === batonOpenedAt
        && batonSlot(batonSlotId)?.selfToken === batonTok
        && (batonSlot(batonSlotId)?.laneSuccessions ?? 0) === 0,
      JSON.stringify(batonSlot(batonSlotId)).slice(0, 200));
    rmSync(`${batonCwd}/baton-uncommitted.txt`, { force: true });

    // THE HANDOVER DOCUMENT. `handoff` is the fourth report status and the only one that is not a
    // verdict: it moves no row, needs no HANDOFF.md commit, and lands in the Program's inbox beside
    // every other result of this lane.
    const handoffRes = await selfPost(batonTok, "/api/self/fleet-report",
      { status: "handoff", text: BATON_HANDOFF });
    const handoffBody = (await handoffRes.json()) as
      { ok?: boolean; report?: { id: string; status: string; basis: string }; inbox?: string };
    const programInbox = ((await (await get("/api/programs")).json()) as
      { programs: { id: string; inbox?: { entries: { id: string; kind: string; ref: string }[] } }[] })
      .programs.find((p) => p.id === batonProgramId)?.inbox;
    check("(baton) status `handoff` is accepted and filed into the Program inbox like any other result",
      handoffRes.ok && handoffBody.report?.status === "handoff" && handoffBody.report?.basis === "program"
        && (programInbox?.entries ?? []).some((e) => e.kind === "fleet-report" && e.ref === handoffBody.report?.id),
      `${handoffRes.status} ${JSON.stringify(handoffBody).slice(0, 200)} inbox=${JSON.stringify(programInbox?.entries ?? []).slice(0, 200)}`);
    check("(baton) the row the lane holds is untouched by the report — a report is a MESSAGE",
      batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent",
      JSON.stringify(batonState().tasks?.find((t) => t.id === batonTaskId) ?? {}).slice(0, 160));

    // …and `carry` is refused rather than ignored: two handover channels can disagree, and nobody
    // could then say which one the successor obeyed.
    const carryRes = await selfPost(batonTok, "/api/self/succeed", { carry: "a second channel" });
    const carryText = await carryRes.text();
    check("(baton) a lane succession takes no carry — the handoff report is the one handover channel",
      carryRes.status === 409 && carryText.includes("takes no carry"),
      `${carryRes.status} ${carryText.slice(0, 200)}`);

    // THE HANDOVER ITSELF.
    const promptsBefore = (await plogRead()).filter((e) => e.slot === batonSlotId).length;
    const succeedRes = await selfPost(batonTok, "/api/self/succeed", {});
    const succeedBody = (await succeedRes.json()) as { ok?: boolean; slot?: number; branch?: string;
      successions?: number; session?: number; delivered?: boolean; error?: string };
    check("(baton) a clean lane succeeds into its OWN slot, on its own branch, counting the baton",
      succeedRes.ok && succeedBody.slot === batonSlotId && succeedBody.branch === batonBranch
        && succeedBody.successions === 1 && succeedBody.session === 2 && succeedBody.delivered === true,
      `${succeedRes.status} ${JSON.stringify(succeedBody)}`);
    const after = batonSlot(batonSlotId);
    check("(baton) the successor is a NEW session on the SAME lane: worktree, row and Program held, credential and occupant rotated",
      after?.worktree?.branch === batonBranch && after?.taskId === batonTaskId
        && after?.programId === batonProgramId && after?.laneSuccessions === 1
        && after?.openedAt !== batonOpenedAt && after?.selfToken !== batonTok
        && exists(batonCwd),
      JSON.stringify(after).slice(0, 240));
    // THE LINE, SESSION BY SESSION (the bar's #band=d hover): session 1 is the predecessor — it
    // began at the occupant's openedAt and its handoff report is the one filed just above.
    const chainRes = await get(`/api/slots/${batonSlotId}/succession`);
    const chain = (await chainRes.json()) as { session?: number;
      past?: { session: number; startedAt: number | null; handedAt: number | null; report: string | null }[] };
    check("(baton) GET /api/slots/:id/succession names the predecessor: its begin, its handover, its handoff report",
      chainRes.ok && chain.session === 2 && chain.past?.length === 1 && chain.past[0]?.session === 1
        && chain.past[0]?.startedAt === batonOpenedAt && chain.past[0]?.report === handoffBody.report?.id
        && typeof chain.past[0]?.handedAt === "number" && chain.past[0].handedAt >= batonOpenedAt,
      `${chainRes.status} ${JSON.stringify(chain).slice(0, 240)}`);
    const noChain = await get("/api/slots/0/succession");
    check("(baton) GET /api/slots/:id/succession refuses a slot that is not one (400), never an empty line",
      noChain.status === 400, String(noChain.status));

    // THE BAND'S READ OF A PAST SESSION — GET /api/slots/:id/succession/:n/transcript. The identity
    // is the handoff report's worker.sessionId + cwd and NOTHING ELSE: a past session whose report
    // names no session is "nicht zugeordnet", never the newest file of its cwd. Each check below
    // turns red on the one violation it names: a route that guessed by cwd would hand back entries
    // in (1) and on the main in (4); a route keyed on something other than the report's sessionId
    // would miss the planted file in (3); a route that served the RUNNING session as a past one
    // would answer n=2 in (2).
    {
      type PastBody = { assigned?: boolean; reason?: string; entries?: { role: string }[]; source?: string | null;
        session?: number; report?: string | null; ctx?: { usedTokens: number; windowTokens: number; pct: number } | null;
        error?: string };
      const pastOf = async (id: number, n: number): Promise<{ status: number; body: PastBody }> => {
        const r = await get(`/api/slots/${id}/succession/${n}/transcript`);
        return { status: r.status, body: (await r.json()) as PastBody };
      };
      type ReportRow = { id: string; worker: { sessionId: string | null; cwd: string } };
      const reportRow = (): ReportRow | undefined => (batonState() as { fleetReports?: ReportRow[] }).fleetReports
        ?.find((r) => r.id === handoffBody.report?.id);
      // (1) FLEET_CMD=true pins no session, so the report names none — the premise is asserted too
      const bare = await pastOf(batonSlotId, 1);
      check("(band) a past session whose handoff report names no session is 'nicht zugeordnet' — no file is guessed from its cwd",
        reportRow()?.worker.sessionId === null && bare.status === 200 && bare.body.assigned === false
          && (bare.body.reason ?? "").includes("nicht zugeordnet") && (bare.body.entries ?? []).length === 0
          && bare.body.report === handoffBody.report?.id,
        `${bare.status} ${JSON.stringify(bare.body).slice(0, 240)} sid=${reportRow()?.worker.sessionId}`);
      // (2) only a PAST session of the line: 0, the running session (2) and beyond are 404
      const outOfLine = await Promise.all([0, 2, 9].map(async (n) => (await get(`/api/slots/${batonSlotId}/succession/${n}/transcript`)).status));
      check("(band) n that is not a past session of the line — 0, the running one, beyond — answers 404",
        outOfLine.every((c) => c === 404), JSON.stringify(outOfLine));

      // (3) + (4): plant a session on the report and its transcript on disk, and a one-record line on
      // a MAIN — through the state file, with the server stopped, as the fixtures above do
      await stopSrv();
      const sid = crypto.randomUUID();
      const USED = 123_456;
      const proj = `${process.env.HOME}/.claude/projects/${batonCwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
      mkdirSync(proj, { recursive: true });
      writeFileSync(`${proj}/${sid}.jsonl`, [
        { type: "user", timestamp: new Date().toISOString(), message: { content: "BAND PROBE: what did the predecessor say?" } },
        { type: "assistant", timestamp: new Date().toISOString(), message: { content: [{ type: "text", text: "BAND PROBE: the answer" }],
          usage: { input_tokens: USED, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } } },
      ].map((l) => JSON.stringify(l)).join("\n") + "\n");
      const lineageId = "ba4d".padEnd(24, "0");
      const bandPlant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { fleetReports?: ReportRow[];
        slots?: Record<string, { cwd?: string | null; worktree?: unknown; openedAt?: number; lineageId?: string | null }>;
        lineageHandovers?: { lineageId: string }[] };
      const pr = bandPlant.fleetReports?.find((r) => r.id === handoffBody.report?.id);
      if (pr) pr.worker.sessionId = sid;
      // a main with no line of its own: the planted record must be the only one it has
      const mainEntry = Object.entries(bandPlant.slots ?? {}).find(([, x]) => x.cwd && !x.worktree && x.openedAt && !x.lineageId);
      const mainId = mainEntry ? Number(mainEntry[0]) : 0;
      const mainOpened = mainEntry?.[1].openedAt ?? 0;
      if (mainEntry) {
        mainEntry[1].lineageId = lineageId;
        bandPlant.lineageHandovers = [...(bandPlant.lineageHandovers ?? []), { v: 1, lineageId, role: "generic",
          at: mainOpened, from: { slot: mainId, openedAt: mainOpened - 3_600_000 }, to: { slot: mainId, openedAt: mainOpened },
          obligations: [], intent: "band probe", pointer: null, supersededBy: null } as { lineageId: string }];
      }
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(bandPlant, null, 2), { mode: 0o600 });
      await restartSrv();
      const named = await pastOf(batonSlotId, 1);
      const ctx = named.body.ctx ?? null;
      check("(band) a lane's past session is read through the session its handoff report names — its entries and its ctx at the handover",
        named.status === 200 && named.body.assigned === true && named.body.source === `${sid}.jsonl`
          && (named.body.entries ?? []).map((e) => e.role).join(",") === "user,assistant"
          && ctx !== null && ctx.usedTokens === USED && ctx.windowTokens > 0
          && ctx.pct === Math.round((USED / ctx.windowTokens) * 1000) / 10,
        `${named.status} ${JSON.stringify({ ...named.body, entries: named.body.entries?.length }).slice(0, 300)}`);
      const chainNow = (await (await get(`/api/slots/${batonSlotId}/succession`)).json()) as { past?: { ctx: unknown }[] };
      check("(band) the line itself carries that ctx per past session, for the band's cells",
        JSON.stringify(chainNow.past?.[0]?.ctx) === JSON.stringify(ctx), JSON.stringify(chainNow).slice(0, 240));
      const mainPast = mainId ? await pastOf(mainId, 1) : { status: 0, body: {} as PastBody };
      check("(band) a MAIN's past session on an OLD lineage record (slot + openedAt only, written before `from` named a session) stays the honest empty state — no backfill",
        mainId > 0 && mainPast.status === 200 && mainPast.body.assigned === false
          && (mainPast.body.reason ?? "").includes("nicht zugeordnet") && (mainPast.body.entries ?? []).length === 0,
        `main=${mainId} ${mainPast.status} ${JSON.stringify(mainPast.body).slice(0, 240)}`);

      // (5) THE SEAT: the succession wrote the leaving occupant onto the slot itself (Slot.laneSeats),
      // because the report is pruned and the seat is not. FLEET_CMD=true had no session to give, so the
      // seat says null; with the pair moved from the report onto the seat, the band must still find the
      // file — a route that read only the report would answer "nicht zugeordnet" here.
      type SeatRow = { openedAt: number; handedAt: number; sessionId: string | null; cwd: string };
      await stopSrv();
      const seatPlant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as typeof bandPlant
        & { slots?: Record<string, { laneSeats?: SeatRow[] }> };
      const seats = seatPlant.slots?.[String(batonSlotId)]?.laneSeats ?? [];
      check("(band) a lane succession leaves the leaving occupant's seat on the slot: its begin, the handover, its cwd, and null for no session",
        seats.length === 1 && seats[0]?.openedAt === batonOpenedAt && seats[0].sessionId === null && seats[0].cwd === batonCwd
          && seats[0].handedAt >= batonOpenedAt,
        JSON.stringify(seats));
      const seatReport = seatPlant.fleetReports?.find((r) => r.id === handoffBody.report?.id);
      if (seatReport) seatReport.worker.sessionId = null;
      if (seats[0]) seats[0].sessionId = sid;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(seatPlant, null, 2), { mode: 0o600 });
      await restartSrv();
      const bySeat = await pastOf(batonSlotId, 1);
      check("(band) the seat's pair outlives the report's: with the report naming no session, the band still reads the predecessor's file",
        bySeat.status === 200 && bySeat.body.assigned === true && bySeat.body.source === `${sid}.jsonl`
          && bySeat.body.report === handoffBody.report?.id,
        `${bySeat.status} ${JSON.stringify({ ...bySeat.body, entries: bySeat.body.entries?.length }).slice(0, 240)}`);

      // un-plant: the line on the main, the seat's session and the file; the report goes with the block's own cleanup below
      await stopSrv();
      const bandUnplant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as typeof seatPlant;
      for (const seat of bandUnplant.slots?.[String(batonSlotId)]?.laneSeats ?? []) seat.sessionId = null;
      bandUnplant.lineageHandovers = (bandUnplant.lineageHandovers ?? []).filter((r) => r.lineageId !== lineageId);
      if (mainId && bandUnplant.slots?.[String(mainId)]) delete bandUnplant.slots[String(mainId)]!.lineageId;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(bandUnplant, null, 2), { mode: 0o600 });
      rmSync(`${proj}/${sid}.jsonl`, { force: true });
      await restartSrv();
    }
    const oldTokenNow = (await selfGet(batonTok)).status;
    check("(baton) the predecessor's credential went with its session — the old token authenticates nothing",
      oldTokenNow === 401, String(oldTokenNow));
    const heirTok = after?.selfToken ?? "";
    const heirSelf = (await (await selfGet(heirTok)).json()) as
      { slot?: number; lane?: { repo: string; branch: string } | null };
    check("(baton) GET /api/self of the successor names the SAME lane it inherited",
      heirSelf.slot === batonSlotId && heirSelf.lane?.branch === batonBranch
        && typeof heirSelf.lane?.repo === "string",
      JSON.stringify(heirSelf).slice(0, 200));
    check("(baton) the queue row never left the lane — still `sent`, still pointing at this slot",
      batonState().tasks?.find((t) => t.id === batonTaskId)?.status === "sent"
        && batonState().tasks?.find((t) => t.id === batonTaskId)?.slot === batonSlotId,
      JSON.stringify(batonState().tasks?.find((t) => t.id === batonTaskId) ?? {}).slice(0, 160));

    const heirPrompts = (await plogRead()).filter((e) => e.slot === batonSlotId);
    const heirBrief = heirPrompts.length > promptsBefore ? heirPrompts[heirPrompts.length - 1]!.text : "";
    check("(baton) the successor's FIRST prompt carries the brief, its own git log, the clean-tree proof, the handoff text and the exit footer",
      heirBrief.includes(BATON_TASK_TEXT) && heirBrief.includes("baton: cut one of the relay")
        && heirBrief.includes("git status --porcelain") && heirBrief.includes(BATON_HANDOFF)
        && heirBrief.includes("HOW THIS LANE ENDS") && heirBrief.includes(batonBranch),
      JSON.stringify(heirBrief).slice(0, 400));

    // …and /retire is untouched by all of this: retiring would end the session and leave the
    // committed work as an orphan worktree, so a lane still has exactly one exit there.
    const laneRetire = await selfPost(heirTok, "/api/self/retire", {});
    const laneRetireText = await laneRetire.text();
    check("(baton) /api/self/retire still answers a lane 409 — it lands, it does not migrate",
      laneRetire.status === 409 && laneRetireText.includes("a lane lands"),
      `${laneRetire.status} ${laneRetireText.slice(0, 160)}`);

    // === THE OWNER'S HARNESS SWITCH on this same lane (owner 2026-09-25: „[Zitat entfernt]“
    // ; card 7dacd84a + 6633fc41). The heir holds a row, a
    // Program and a counted baton — exactly what the switch must carry across untouched — and gets
    // an UNCOMMITTED edit and an untracked file first, because the switch (unlike the baton) is for
    // an executor that stopped mid-work. Every refusal below is asserted to have spawned nothing.
    {
      type LhSlot = { selfToken?: string; openedAt?: number; taskId?: string | null; programId?: string | null;
        harness?: string | null; model?: string | null; effort?: string | null; laneSuccessions?: number;
        worktree?: { branch?: string } | null };
      const lhSlot = (): LhSlot | undefined => batonSlot(batonSlotId) as LhSlot | undefined;
      const lhPath = `/api/slots/${batonSlotId}/lane-harness`;
      const lhBefore = lhSlot();
      const untouched = (): boolean => lhSlot()?.openedAt === lhBefore?.openedAt && lhSlot()?.selfToken === lhBefore?.selfToken;
      const lhText = async (r: Response): Promise<string> => `${r.status} ${await r.text()}`;

      const asSelf = await fetch(BASE + lhPath, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": heirTok },
        body: JSON.stringify({ harness: "codex" }) });
      check("(lane-harness) the lane's own self-token is refused 401 — choosing the executor is the owner's",
        asSelf.status === 401 && untouched(), String(asSelf.status));
      const asSelfDoor = await selfPost(heirTok, "/api/self/succeed", { harness: "codex", model: "gpt-6.1-sol" });
      check("(lane-harness) …and the lane's baton door stays harness-true: a codex model on this claude lane is 400, nothing spawned",
        asSelfDoor.status === 400 && untouched(), await lhText(asSelfDoor));

      const sess = (await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null; worktree: unknown }[] };
      const plainSlot = sess.slots.find((x) => x.cwd && !x.worktree)?.id ?? 0;
      const notLane = await post(`/api/slots/${plainSlot}/lane-harness`, { harness: "codex" });
      const notLaneText = await lhText(notLane);
      check("(lane-harness) a slot that holds no worktree is refused 409 'not a lane'",
        plainSlot > 0 && notLane.status === 409 && notLaneText.includes("not a lane"), `slot ${plainSlot}: ${notLaneText}`);

      const refusals: [string, Record<string, unknown>, (t: string) => boolean][] = [
        ["no harness named", {}, (x) => x.startsWith("400 ") && x.includes("expected { harness")],
        ["an unknown harness", { harness: "warp-drive" }, (x) => x.startsWith("400 ") && x.includes("unknown harness")],
        ["a main-session-only harness", { harness: "pi-unfenced" }, (x) => x.startsWith("400 ") && x.includes("main-session only")],
        ["a claude model on codex", { harness: "codex", model: "claude-opus-5-5[1m]" },
          (x) => x.startsWith("400 ") && x.includes("bad model") && x.includes("not for harness codex")],
        ["a codex model on claude", { harness: "claude", model: "gpt-6.1-sol" },
          (x) => x.startsWith("400 ") && x.includes("not for harness claude")],
        ["an effort the harness lacks", { harness: "codex", model: "gpt-6.1-sol", effort: "warp" },
          (x) => x.startsWith("400 ") && x.includes("bad effort")],
      ];
      for (const [what, body, ok] of refusals) {
        const r = await lhText(await post(lhPath, body));
        check(`(lane-harness) ${what} is refused, and the lane's session is untouched`, ok(r) && untouched(), r.slice(0, 240));
      }

      // THE SWITCH. One tracked edit and one untracked file, read back as BYTES afterwards.
      const dirtyTracked = "cut one\nhalf of cut two, not committed\n";
      const dirtyNew = "UNTRACKED: the stopped executor's scratch it meant to keep\n";
      writeFileSync(`${batonCwd}/baton.txt`, dirtyTracked);
      writeFileSync(`${batonCwd}/baton-lh-untracked.txt`, dirtyNew);
      const headBefore = spawnSync("git", ["-C", batonCwd, "rev-parse", "HEAD"]).stdout.toString().trim();
      const lhPromptsBefore = (await plogRead()).filter((e) => e.slot === batonSlotId).length;
      const lhPending = post(lhPath, { harness: "codex", model: "gpt-6.1-sol", effort: "high" });
      let lhSeen = false;
      for (let i = 0; i < 60 && !lhSeen; i++) {
        await Bun.sleep(150);
        const at = lhSlot()?.openedAt ?? 0;
        if (at > 0 && at !== lhBefore?.openedAt) lhSeen = true;
      }
      // the spawn line BEFORE the screen is planted — plantScreen respawns the pane with its stand-in
      let lhCmd = "";
      for (let i = 0; i < 40 && lhSeen && !lhCmd.includes("codex"); i++) {
        await Bun.sleep(50);
        lhCmd = (await tmuxOut("display-message", "-p", "-t", `s${batonSlotId}`, "#{pane_start_command}")).out.replaceAll("\\", "");
      }
      if (lhSeen) await plantScreen(batonSlotId, ">_ OpenAI Codex (v0.147.0)", "lane-harness fixture");
      const lhRes = await lhPending;
      const lhBody = (await lhRes.json().catch(() => ({}))) as { ok?: boolean; slot?: number; branch?: string;
        harness?: string; model?: string | null; effort?: string | null; successions?: number; delivered?: boolean };
      check("(lane-harness) the owner's switch answers 200 on the SAME slot and branch, delivered, and is no baton",
        lhRes.ok && lhBody.slot === batonSlotId && lhBody.branch === batonBranch && lhBody.harness === "codex"
          && lhBody.model === "gpt-6.1-sol" && lhBody.effort === "high" && lhBody.successions === 1 && lhBody.delivered === true,
        `${lhRes.status} ${JSON.stringify(lhBody)}`);
      const lhAfter = lhSlot();
      check("(lane-harness) the slot runs a NEW session on codex, with worktree, row, Program and baton count held",
        lhAfter?.harness === "codex" && lhAfter.model === "gpt-6.1-sol" && lhAfter.effort === "high"
          && lhAfter.worktree?.branch === batonBranch && lhAfter.taskId === batonTaskId && lhAfter.programId === batonProgramId
          && lhAfter.laneSuccessions === 1 && lhAfter.openedAt !== lhBefore?.openedAt && lhAfter.selfToken !== heirTok,
        JSON.stringify(lhAfter).slice(0, 300));
      const lhCodexDefault = (cmd: string): boolean =>
        /(^|\s|;)codex --no-daemon --sandbox danger-full-access --ask-for-approval never(?:\s|$)/.test(cmd)
          && cmd.includes("--model 'gpt-6.1-sol'") && !cmd.includes("--dangerously-bypass-approvals-and-sandbox");
      check("(lane-harness) the pane was spawned as codex with the explicit full-access default and chosen model, without bypass",
        lhCodexDefault(lhCmd), lhCmd.slice(-220));
      check("(lane-harness) the start-form claim rejects a bypass added to the actual command",
        lhCodexDefault(lhCmd) && !lhCodexDefault(`${lhCmd} --dangerously-bypass-approvals-and-sandbox`));
      const statusAfter = spawnSync("git", ["-C", batonCwd, "status", "--porcelain"]).stdout.toString();
      check("(lane-harness) the uncommitted edit and the untracked file survive BYTE for byte, on the same HEAD",
        readFileSync(`${batonCwd}/baton.txt`, "utf8") === dirtyTracked
          && readFileSync(`${batonCwd}/baton-lh-untracked.txt`, "utf8") === dirtyNew
          && spawnSync("git", ["-C", batonCwd, "rev-parse", "HEAD"]).stdout.toString().trim() === headBefore
          && statusAfter.includes(" M baton.txt") && statusAfter.includes("?? baton-lh-untracked.txt"),
        JSON.stringify(statusAfter));
      check("(lane-harness) the queue row never left the lane — still `sent`, still this slot",
        batonState().tasks?.find((x) => x.id === batonTaskId)?.status === "sent"
          && batonState().tasks?.find((x) => x.id === batonTaskId)?.slot === batonSlotId,
        JSON.stringify(batonState().tasks?.find((x) => x.id === batonTaskId) ?? {}).slice(0, 160));
      const lhPrompts = (await plogRead()).filter((e) => e.slot === batonSlotId);
      const lhBrief = lhPrompts.length > lhPromptsBefore ? lhPrompts[lhPrompts.length - 1]!.text : "";
      check("(lane-harness) the continuation brief names the task id, the HEAD, the switch, the dirty paths and the lane exit",
        lhBrief.includes(`Task-Id: ${batonTaskId}`) && lhBrief.includes(`HEAD: ${headBefore}`)
          && lhBrief.includes("codex/gpt-6.1-sol/high") && lhBrief.includes("baton-lh-untracked.txt")
          && lhBrief.includes("baton.txt") && lhBrief.includes(BATON_TASK_TEXT) && lhBrief.includes("HOW THIS LANE ENDS"),
        JSON.stringify(lhBrief).slice(0, 400));
      let lhAudit: { event?: string; slot?: number; detail?: string }[] = [];
      for (let i = 0; i < 40 && !lhAudit.length; i++) { // appendEvent is fire-and-forget — poll the trail
        lhAudit = (await Bun.file(`${ROOT}/audit.jsonl`).text()).split("\n").filter(Boolean)
          .map((l) => { try { return JSON.parse(l) as { event?: string; slot?: number; detail?: string }; } catch { return null; } })
          .filter((r): r is { event?: string; slot?: number; detail?: string } => r?.event === "lane_harness" && r.slot === batonSlotId);
        if (!lhAudit.length) await Bun.sleep(50);
      }
      check("(lane-harness) exactly ONE audit row names branch, from -> to, the task and the uncommitted count",
        lhAudit.length === 1 && (lhAudit[0]?.detail ?? "").includes(batonBranch)
          && (lhAudit[0]?.detail ?? "").includes("-> codex/gpt-6.1-sol/high")
          && (lhAudit[0]?.detail ?? "").includes(`task=${batonTaskId}`) && (lhAudit[0]?.detail ?? "").includes("uncommitted=2"),
        JSON.stringify(lhAudit));
    }

    // …and what the LEDGER says about a lane that took two sessions. The kill is the teardown this
    // fixture needs anyway, and it is the cheapest disposition that writes a row: `successions` is
    // the only field on it that can say the lane spanned more than one conversation, because
    // sessionMs measures the LAST session alone — which is exactly why it must be on the row and
    // not inferred from the count of prompts in a pane nobody keeps.
    await post(`/api/slots/${batonSlotId}/kill`, {});
    const batonOutcome = ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
      { outcomes: { branch: string; disposition: string; successions?: number; commitCount: number }[] })
      .outcomes.find((o) => o.branch === batonBranch);
    check("(baton) the outcome row counts the batons — one lane, two sessions, one commit",
      batonOutcome?.successions === 1 && batonOutcome.commitCount === 1
        && batonOutcome.disposition === "killed-dirty",
      JSON.stringify(batonOutcome ?? null).slice(0, 240));
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", batonCwd]);
    await post(`/api/tasks/${batonTaskId}/delete`, {});
    // …AND THE PLANTED RECORDS GO BACK OUT THE WAY THEY CAME IN. This is not tidiness: an active
    // Program rides the 2 s /api/sessions poll as a digest FOREVER, and that payload is measured
    // against a 14 KiB budget by e2e/tasks.ts — which runs after this file. Measured on the run
    // that first left them standing (2026-09-12): 14 631 B against 14 336 B. A fixture that makes
    // a later section's budget check fail is a fixture that has to be un-planted, not a budget
    // that has to be raised. The report row goes with it for the same reason it exists here: it is
    // the planted Program's, it counts into `reportsAwaitingOwner` once that Program has no live
    // MAIN, and nothing outside this block ever reads it.
    await stopSrv();
    const unplant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { programs?: { id: string }[]; fleetReports?: { id: string }[] };
    unplant.programs = (unplant.programs ?? []).filter((p) => p.id !== batonProgramId);
    unplant.fleetReports = (unplant.fleetReports ?? []).filter((r) => r.id !== (handoffBody.report?.id ?? ""));
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(unplant, null, 2), { mode: 0o600 });
    await restartSrv();
    const remaining = ((await (await get("/api/programs")).json()) as
      { programs: { id: string }[] }).programs;
    check("(baton) fixture cleanup: the planted Program is gone — the 2 s poll must not carry a fixture for the rest of the suite",
      !remaining.some((p) => p.id === batonProgramId), `${remaining.length} program(s) left`);
  }

  // === THE HARNESS SWITCH WAITS FOR A RUNNING MERGE: a merge/land owns the tree and the slot, and a
  // recycle underneath it would leave the job talking to a session that no longer exists — the same
  // reservation the baton honours. The F5 shape from e2e/merge.ts: a real conflict, so the fake agent
  // runs in `hang` and holds mergeInflight for its whole sleep.
  {
    const mh = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot?: number; cwd?: string; branch?: string };
    const mhSlot = mh.slot ?? 0;
    writeFileSync(`${mh.cwd}/lane-harness-merge.txt`, "lane side\n");
    spawnSync("git", ["-C", mh.cwd ?? "", "add", "lane-harness-merge.txt"]);
    spawnSync("git", ["-C", mh.cwd ?? "", "commit", "-qm", "lane-harness: lane side"]);
    writeFileSync(`${REPO}/lane-harness-merge.txt`, "main side\n"); // add/add → conflict → the agent (hang) runs
    spawnSync("git", ["-C", REPO, "add", "lane-harness-merge.txt"]);
    spawnSync("git", ["-C", REPO, "commit", "-qm", "lane-harness: main side"]);
    await setMergeMode("hang");
    await settleForMerge(mhSlot);
    const mhStart = (await (await post(`/api/slots/${mhSlot}/merge`, {})).json()) as { running?: boolean };
    const mhOpened = (): number | undefined => (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { openedAt?: number }> }).slots?.[String(mhSlot)]?.openedAt;
    const mhOpenedAt = mhOpened();
    const during = await post(`/api/slots/${mhSlot}/lane-harness`, { harness: "codex", model: "gpt-6.1-sol" });
    const duringText = await during.text();
    check("(lane-harness) a running merge on the lane refuses the switch 409, and the session stays",
      mhStart.running === true && during.status === 409 && duringText.includes("merge is running")
        && typeof mhOpenedAt === "number" && mhOpened() === mhOpenedAt,
      `running=${mhStart.running} ${during.status} ${duringText.slice(0, 200)}`);
    await waitMerge(mhSlot);
    await setMergeMode("blocked");
    await post(`/api/slots/${mhSlot}/kill`, {});
    if (mh.cwd) spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", mh.cwd]);
    if (mh.branch) spawnSync("git", ["-C", REPO, "branch", "-qD", mh.branch]);
  }

  // === THE REVIEW PARK: a finished lane set aside for a LATER owner review, slot freed, identity kept ==
  // (docs/messungen/2026-09-23-worktree-lebenszyklus.md §3, corrected: a park that frees the slot, not
  // a halt that holds it). What each check below turns red on: a park that admits an unaccepted or
  // dirty lane; rows that go back to pending/queued (the old detach) or come back after a restart
  // (the boot requeue); a board without the identity; a resume that forgets the rows, keeps the old
  // verify as current, or seats the tree twice; and a plain shelve that changed on the way.
  {
    type RpRow = { id: string; status: string; slot: number | null; note?: string | null; programId?: string | null };
    type RpCandidate = { id: string; parkedAt: number; expiresAt: number; expired?: boolean; branch: string; head: string;
      base: string | null; baseSha: string | null; taskIds: string[]; taskId: string | null; programId: string | null; reportId: string };
    type RpState = {
      slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null; taskId?: string | null;
        programId?: string | null; worktree?: { branch?: string; resumedFrom?: Record<string, unknown> } | null }>;
      tasks?: RpRow[]; programs?: Record<string, unknown>[];
      fleetReports?: { id: string; worker: { sessionId: string | null }; decision?: unknown }[];
      shelved?: Record<string, { note: string; at?: number; review?: RpCandidate }>;
      worktreeNotes?: Record<string, string>;
    };
    type RpBoard = { path: string; slot: number | null; note: string | null; notepad?: string | null;
      review?: RpCandidate | null };
    const rpState = (): RpState => JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as RpState;
    // the rows through the API, not the state file: a queued save may still be in flight after a response
    const rpRows = async (ids: string[]): Promise<(RpRow | undefined)[]> => {
      const all = ((await (await get("/api/tasks")).json()) as { tasks: RpRow[] }).tasks;
      return ids.map((id) => all.find((t) => t.id === id));
    };
    const rpSelfPost = (token: string, path: string, body: unknown): Promise<Response> =>
      fetch(BASE + path, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": token }, body: JSON.stringify(body) });
    const rpSessions = async () => ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null; worktree?: { branch: string; resumedFrom?: Record<string, unknown> } | null }[] }).slots;
    const rpLane = (await (await post("/api/lanes", { repo: REPO })).json()) as { ok?: boolean; slot?: number; cwd?: string; branch?: string };
    const rpSlot = rpLane.slot ?? 0;
    const rpCwd = rpLane.cwd ?? "";
    const rpBoard = async (): Promise<RpBoard | undefined> =>
      ((await (await get(`/api/slots/${lc.lnSlot}/worktrees`)).json()) as { worktrees: RpBoard[] }).worktrees.find((w) => w.path === rpCwd);
    const rpIds: string[] = [];
    for (const text of ["REVIEW PARK FIXTURE: the founding row", "REVIEW PARK FIXTURE: the wave follower"])
      rpIds.push(((await (await post("/api/tasks", { text, queue: false })).json()) as { task?: { id: string } }).task?.id ?? "");
    const rpForeignId = ((await (await post("/api/tasks", { text: "REVIEW PARK FIXTURE: foreign program refusal", queue: false })).json()) as
      { task?: { id: string } }).task?.id ?? "";
    writeFileSync(`${rpCwd}/review-park.txt`, "finished work\n");
    spawnSync("git", ["-C", rpCwd, "add", "review-park.txt"]);
    spawnSync("git", ["-C", rpCwd, "commit", "-qm", "review park: the finished cut"]);
    const rpHead = spawnSync("git", ["-C", rpCwd, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const rpMainSlot = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots
      .find((x) => x.cwd === null && x.id !== lc.lnSlot)?.id ?? 0;
    const rpMainOpen = await post(`/api/slots/${rpMainSlot}/open`, { cwd: REPO, label: "review-park-main" });
    await stopSrv();
    const rpProgramId = "7e71e0".padEnd(24, "0");
    const rpPlant = rpState();
    const rpAt = Date.now();
    const rpMain = rpPlant.slots?.[String(rpMainSlot)];
    rpPlant.programs = [...(rpPlant.programs ?? []), {
      id: rpProgramId, title: "Review park fixture", intent: "Prove a finished lane parks for review",
      successCriterion: "The parked lane resumes with its rows", nonGoals: [], decisions: [], evidence: [],
      openQuestions: [], status: "active", createdAt: rpAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: rpAt - 900, activatedAt: rpAt - 800,
      main: { slot: rpMainSlot, openedAt: rpMain?.openedAt ?? 0, sessionId: rpMain?.sessionId ?? null, boundAt: rpAt - 700 },
    }];
    const rpSl = rpPlant.slots?.[String(rpSlot)];
    if (rpSl) { rpSl.taskId = rpIds[0]; rpSl.programId = rpProgramId; }
    for (const row of rpPlant.tasks ?? [])
      if (rpIds.includes(row.id)) { row.status = "sent"; row.slot = rpSlot; row.programId = rpProgramId; }
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpPlant, null, 2), { mode: 0o600 });
    await restartSrv();
    const rpTok = rpState().slots?.[String(rpSlot)]?.selfToken ?? "";
    const rpMainTok = rpState().slots?.[String(rpMainSlot)]?.selfToken ?? "";
    check("review park setup: a committed lane carries two sent rows and a Program",
      rpLane.ok === true && rpMainOpen.ok && rpSlot > 0 && rpMainSlot > 0 && exists(rpCwd)
        && /^[0-9a-f]{40}$/.test(rpHead) && /^[0-9a-f]{32}$/.test(rpTok) && /^[0-9a-f]{32}$/.test(rpMainTok)
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot),
      JSON.stringify({ lane: rpLane, rows: (await rpRows(rpIds)) }));

    const park = (body: Record<string, unknown>) => post(`/api/slots/${rpSlot}/shelve`, { note: "review me", review: true, ...body });
    const selfPark = (token: string, id: string, body: Record<string, unknown>) =>
      rpSelfPost(token, `/api/self/tasks/${id}/park`, { note: "review me", ...body });
    const laneDenied = await selfPark(rpTok, rpIds[0] ?? "", {});
    const foreignDenied = await selfPark(rpMainTok, rpForeignId, {});
    check("(review park self) lane tokens and rows outside the bound MAIN's Program are 409",
      laneDenied.status === 409 && foreignDenied.status === 409
        && (await laneDenied.text()).includes("lane may not park itself")
        && (await foreignDenied.text()).includes("parks only rows of program"),
      `${laneDenied.status} ${foreignDenied.status}`);
    const noReport = await park({});
    const selfNoReport = await selfPark(rpMainTok, rpIds[0] ?? "", {});
    check("(review park) refused without a report — nothing parked, the slot still holds the lane",
      noReport.status === 409 && selfNoReport.status === 409 && (await noReport.text()).includes("filed no report")
        && (await selfNoReport.text()).includes("filed no report")
        && (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === rpCwd, String(noReport.status));
    const repRes = await rpSelfPost(rpTok, "/api/self/fleet-report", { status: "complete", text: "REVIEW PARK FIXTURE: done and verified." });
    const rpReportId = ((await repRes.json()) as { report?: { id: string } }).report?.id ?? "";
    const undecided = await park({});
    check("(review park) refused while the MAIN has not accepted the report",
      repRes.ok && undecided.status === 409 && (await undecided.text()).includes("undecided"), `${repRes.status} ${undecided.status}`);
    // the acceptance planted as the program MAIN's verdict: the subject here is the park, not the decision door
    await stopSrv();
    const rpDecide = rpState();
    const rpRep = rpDecide.fleetReports?.find((r) => r.id === rpReportId);
    if (rpRep) rpRep.decision = { disposition: "accepted", at: Date.now(), by: { slot: rpMainSlot,
      openedAt: rpMain?.openedAt ?? 0, sessionId: rpMain?.sessionId ?? null },
      reason: null, fulfilled: null };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpDecide, null, 2), { mode: 0o600 });
    await restartSrv();
    writeFileSync(`${rpCwd}/review-park-dirty.txt`, "uncommitted\n");
    const dirty = await park({});
    const dirtyText = await dirty.text();
    rmSync(`${rpCwd}/review-park-dirty.txt`, { force: true });
    check("(review park) refused on an unclean tree, naming the file",
      dirty.status === 409 && dirtyText.includes("not clean") && dirtyText.includes("review-park-dirty.txt"), `${dirty.status} ${dirtyText.slice(0, 160)}`);
    check("(review park) a malformed deadline is a 400, not a default",
      (await park({ hours: 0 })).status === 400 && (await park({ hours: "2" })).status === 400);
    check("(review park) every refusal left the lane and its rows exactly as they were",
      (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === rpCwd
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot) && !rpState().shelved?.[rpCwd],
      JSON.stringify((await rpRows(rpIds))));

    // === THE OWNER'S NOTEPAD on this worktree (owner 2026-09-23/24): one free text per PATH that
    // rides review park, resume and restart, capped with a named refusal, the owner's alone. What
    // each check turns red on: a save the board cannot read back; a cap the server evicts or
    // truncates instead of refusing; a text a lane's self token can read or write; a park, a
    // restart or a resume that loses it; a discarded tree whose note stays behind as an orphan.
    const noteText = "NOTEPAD FIXTURE: langfristig arbeiten — bleibt über Park und Neustart";
    const notePost = (text: string): Promise<Response> =>
      post("/api/worktrees/note", { repo: REPO, path: rpCwd, text });
    const noteSave = await notePost(noteText);
    const noteSavedBoard = await rpBoard();
    check("(notepad) the owner saves a note on the live lane's worktree and the board row carries it back",
      noteSave.ok && noteSavedBoard?.notepad === noteText, `${noteSave.status} ${JSON.stringify(noteSavedBoard)}`);
    const overRes = await notePost("x".repeat(20_001));
    const overBody = await overRes.text();
    check("(notepad) a note above the 20000-character cap is refused by name and the stored note survives whole",
      overRes.status === 400 && overBody.includes("20000") && (await rpBoard())?.notepad === noteText,
      `${overRes.status} ${overBody.slice(0, 120)}`);
    const atCapRes = await notePost("y".repeat(20_000));
    check("(notepad) exactly 20000 characters are accepted", atCapRes.ok && (await rpBoard())?.notepad?.length === 20_000,
      String(atCapRes.status));
    await notePost(noteText); // the small survival note rides the park/resume/restart checks below
    const selfWriteHdr = await fetch(BASE + "/api/worktrees/note", { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": rpTok },
      body: JSON.stringify({ repo: REPO, path: rpCwd, text: "the lane wrote this" }) });
    const selfWriteBearer = await fetch(BASE + "/api/worktrees/note", { method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${rpTok}` },
      body: JSON.stringify({ repo: REPO, path: rpCwd, text: "the lane wrote this" }) });
    const selfRead = await fetch(BASE + `/api/slots/${lc.lnSlot}/worktrees`, { headers: { authorization: `Bearer ${rpTok}` } });
    check("(notepad) a lane's self token can neither write (header or bearer) nor read the note — 401 every way, text unchanged",
      selfWriteHdr.status === 401 && selfWriteBearer.status === 401 && selfRead.status === 401
        && (await rpBoard())?.notepad === noteText,
      `${selfWriteHdr.status}/${selfWriteBearer.status}/${selfRead.status}`);

    // THE PARK
    const parkRes = await selfPark(rpMainTok, rpIds[0] ?? "", { hours: 2 });
    const parked = ((await parkRes.json()) as { ok?: boolean; candidate?: RpCandidate }).candidate;
    check("(review park) an accepted, clean lane parks as ONE candidate with rows, branch, head, base, report and deadline",
      parkRes.ok && !!parked && /^[0-9a-f]{12}$/.test(parked.id) && parked.branch === rpLane.branch && parked.head === rpHead
        && typeof parked.base === "string" && parked.base !== "" && /^[0-9a-f]{40}$/.test(parked.baseSha ?? "")
        && JSON.stringify([...parked.taskIds].sort()) === JSON.stringify([...rpIds].sort()) && parked.taskId === rpIds[0]
        && parked.reportId === rpReportId && parked.expiresAt - parked.parkedAt === 2 * 3_600_000,
      JSON.stringify(parked));
    check("(review park) the slot is free and the worktree with its commit stays on disk",
      (await rpSessions()).find((x) => x.id === rpSlot)?.cwd === null && exists(`${rpCwd}/review-park.txt`));
    check("(review park) the rows stay SENT with no slot — not handed back to pending or queued",
      (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null && (t.note ?? "").includes(parked?.id ?? "-")),
      JSON.stringify((await rpRows(rpIds))));
    const projected = (await (await fetch(BASE + "/api/self/program-execution",
      { headers: { "x-fleet-self-token": rpMainTok } })).json()) as { programs?: { program: { id: string };
        tasks: { rows: { id: string; phase: string; phaseBasis: string[]; nextAction: string | null }[] };
        unknown: string[] }[] };
    const projectedProgram = projected.programs?.find((p) => p.program.id === rpProgramId);
    const parkedProjection = projectedProgram?.tasks.rows.find((t) => t.id === rpIds[0]);
    check("(review park projection) the candidate is REVIEW_PARKED with identity, deadline and resume door",
      parkedProjection?.phase === "REVIEW_PARKED"
        && parkedProjection.phaseBasis.some((line) => line.startsWith("R6p:") && line.includes(parked?.id ?? "-")
          && line.includes(`expiresAt=${parked?.expiresAt}`))
        && parkedProjection.nextAction?.includes("POST /api/lanes") === true
        && parkedProjection.nextAction.includes(rpCwd),
      JSON.stringify({ parked: parkedProjection, unknown: projectedProgram?.unknown }));
    const rpDispatch = await post(`/api/tasks/${rpIds[0]}/dispatch`, {});
    const rpQueue = await post(`/api/tasks/${rpIds[1]}/queue`, {});
    const rpUnqueue = await post(`/api/tasks/${rpIds[0]}/unqueue`, {});
    check("(review park) no door can start a parked row again: dispatch, queue and unqueue all refuse",
      rpDispatch.status === 409 && rpQueue.status === 409 && rpUnqueue.status === 409
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null),
      `${rpDispatch.status} ${rpQueue.status} ${rpUnqueue.status} ${JSON.stringify((await rpRows(rpIds)))}`);
    const board1 = await rpBoard();
    check("(review park) the board shows the candidate's identity on the orphan",
      board1?.slot === null && board1.note === "review me" && board1.review?.id === parked?.id
        && board1.review?.head === rpHead && board1.review?.reportId === rpReportId && board1.review?.expired === false
        && board1.review?.taskIds.length === 2, JSON.stringify(board1));
    check("(notepad) the note rides the review park — the parked row still carries it",
      board1?.notepad === noteText, (board1?.notepad ?? "null").slice(0, 60));

    {
      const notePath = `${rpCwd}-notepad`;
      const noteBranch = `fleet/notepad-${Date.now()}`;
      const added = spawnSync("git", ["-C", REPO, "worktree", "add", "-q", "-b", noteBranch, notePath, rpHead]);
      check("(notepad) setup: a second worktree exists for the discard probe", added.status === 0 && exists(notePath), String(added.status));
      const saved = await post("/api/worktrees/note", { repo: REPO, path: notePath, text: "discard notepad fixture" });
      check("(notepad) the second worktree carries its own note", saved.ok && rpState().worktreeNotes?.[notePath] === "discard notepad fixture", String(saved.status));
      const discarded = await post("/api/worktrees/discard", { repo: REPO, path: notePath, branch: noteBranch });
      check("(notepad) discarding removes the second worktree", discarded.ok && !exists(notePath), String(discarded.status));
      check("(notepad) discarding removes only that note and preserves the parked worktree's note",
        rpState().worktreeNotes?.[notePath] === undefined && rpState().worktreeNotes?.[rpCwd] === noteText, String(discarded.status));
    }

    await stopSrv();
    const rpAge = rpState();
    const rpShelf = rpAge.shelved?.[rpCwd]?.review;
    if (rpShelf) rpShelf.expiresAt = Date.now() - 1000;
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpAge, null, 2), { mode: 0o600 });
    await restartSrv();
    check("(review park) across a restart the rows stay parked — no boot requeue, no second dispatch",
      (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === null), JSON.stringify((await rpRows(rpIds))));
    const board2 = await rpBoard();
    check("(review park) a passed deadline marks the candidate expired and keeps its worktree",
      board2?.review?.id === parked?.id && board2?.review?.expired === true && exists(`${rpCwd}/review-park.txt`),
      JSON.stringify(board2));
    check("(notepad) the note survives the restart beside the expired candidate",
      board2?.notepad === noteText, (board2?.notepad ?? "null").slice(0, 60));

    // RESUME
    const resumeRes = await post("/api/lanes", { repo: REPO, attach: rpCwd });
    const resumed = (await resumeRes.json()) as { ok?: boolean; slot?: number;
      resumed?: { candidate: string; head: string; reportId: string; taskIds: string[]; verify: string } };
    const rpSlot2 = resumed.slot ?? 0;
    check("(review park) reopening the worktree resumes the candidate and binds both rows back",
      resumeRes.ok && rpSlot2 > 0 && resumed.resumed?.candidate === parked?.id && resumed.resumed?.verify === "stale"
        && JSON.stringify([...(resumed.resumed?.taskIds ?? [])].sort()) === JSON.stringify([...rpIds].sort())
        && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot2),
      `${resumeRes.status} ${JSON.stringify(resumed)} ${JSON.stringify((await rpRows(rpIds)))}`);
    const rpSeat = rpState().slots?.[String(rpSlot2)];
    const rpFrom = (await rpSessions()).find((x) => x.id === rpSlot2)?.worktree?.resumedFrom;
    check("(review park) the resumed lane carries its founding row and Program, and marks the pre-park verify stale",
      rpSeat?.taskId === rpIds[0] && rpSeat.programId === rpProgramId && rpFrom?.candidate === parked?.id
        && rpFrom?.verify === "stale" && rpFrom?.head === rpHead && rpFrom?.reportId === rpReportId
        && rpSeat.worktree?.resumedFrom?.candidate === parked?.id,
      JSON.stringify({ seat: rpSeat, from: rpFrom }));
    const board3 = await rpBoard();
    check("(review park) the resume consumed the candidate: the board shows no candidate and no note",
      board3?.slot === rpSlot2 && board3.review == null && board3.note == null, JSON.stringify(board3));
    check("(notepad) the note survives the resume — the live lane's row carries it again",
      board3?.notepad === noteText && board3?.slot === rpSlot2, (board3?.notepad ?? "null").slice(0, 60));
    const second = await post("/api/lanes", { repo: REPO, attach: rpCwd });
    check("(review park) a second attach of the same worktree is refused and moves no row",
      second.status === 409 && (await rpRows(rpIds)).every((t) => t?.status === "sent" && t.slot === rpSlot2), String(second.status));

    // THE PLAIN SHELVE, unchanged: no candidate, and its rows go back to owner review as before
    const plain = await post(`/api/slots/${rpSlot2}/shelve`, { note: "plain" });
    const plainBody = (await plain.json()) as { ok?: boolean; candidate?: unknown };
    const board4 = await rpBoard();
    check("(review park) a shelve without review:true is the old shelve — no candidate, rows back to pending",
      plain.ok && plainBody.ok === true && plainBody.candidate === undefined && board4?.note === "plain" && board4.review == null
        && (await rpRows(rpIds)).every((t) => t?.status === "pending" && t.slot === null),
      `${JSON.stringify(plainBody)} ${JSON.stringify(board4)} ${JSON.stringify((await rpRows(rpIds)))}`);

    // the planted records leave the way they came (the 2 s poll's budget, see the baton cleanup)
    spawnSync("git", ["-C", REPO, "worktree", "remove", "--force", rpCwd]);
    for (const id of [...rpIds, rpForeignId]) await post(`/api/tasks/${id}/delete`, {});
    await stopSrv();
    const rpUnplant = rpState();
    rpUnplant.programs = (rpUnplant.programs ?? []).filter((p) => p.id !== rpProgramId);
    rpUnplant.fleetReports = (rpUnplant.fleetReports ?? []).filter((r) => r.id !== rpReportId);
    if (rpUnplant.shelved) delete rpUnplant.shelved[rpCwd];
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(rpUnplant, null, 2), { mode: 0o600 });
    await restartSrv();
    await post(`/api/slots/${rpMainSlot}/kill`, {});
    check("(review park) fixture cleanup: Program, report and rows are gone",
      !(rpState().programs ?? []).some((p) => p.id === rpProgramId)
        && ![...rpIds, rpForeignId].some((id) => rpState().tasks?.some((t) => t.id === id)));
    check("(notepad) fixture cleanup: the removed worktree's note was swept at boot — no orphan entry",
      rpState().worktreeNotes?.[rpCwd] === undefined, JSON.stringify(rpState().worktreeNotes ?? null));
  }
}

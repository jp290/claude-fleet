import { loadConfig, reposOf } from "../helper-daemon/daemon";
import { helperReposFrom } from "../server/types";
import { HELPER_REPO_COMMITS_MAX, type HelperReposReading, instanceNameFrom, instanceSourceFrom, instanceBandText, type WorkplaceStand, type WorkplaceChecks, type Workplaces, type WorkplaceRepo } from "../src/protocol";
// Lane lifecycle: risk vs the configured integration branch, shelve → resume, the lane-scoped
// brief, the 💾 commit endpoint (lane vs main-session staging, detached HEAD, wedged rebase), and
// the CLONE lane form — same lifecycle, a working copy that is its own repository.
import type { WorkplaceCheckObservation } from "../server/types";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { laneDoneLooking, laneHostCommitLooking, type LaneSignalView } from "../lane-signals";
import { BASE, PORT, REPO, ROOT, SOCK, TOKEN, UntilTimeout, check, get, lastReviewPromptFor, plantScreen, plogRead, post, restartSrv,
  reviewRunsFor, stopSrv, tmuxOut, until } from "./harness";
import type { LaneCtx } from "./ctx";
import { repoGraph, roleOf } from "../server/deploy-classify";
import { exists, setMergeMode, settleForMerge, waitMerge } from "./lane-helpers";

// THE TESTINSTANZ BAND (ranke-notiz R11): a test instance says which branch and stand it shows and
// what of it is not on its target yet; the live fleet says nothing. One claim per statement, each
// with the mutation that must turn it red, stated next to it and RUN:
//   words   — the three DONE sentences come out of src/protocol.ts#instanceBandText; mutation: a
//             missing count reads "alles schon" → the "never guessed" row is red; a process word
//             planted in a text → the vocabulary row is red.
//   measure — testinstanz.sh `source` (the very function `up` records as sourceBefore) against a
//             real git fixture; mutation: the change of one lane commit put on the target by
//             cherry-pick must leave the count (a plain rev-list would not drop it).
//   order   — `up` measures BEFORE rsync and hands that record to the instance; mutation: the same
//             predicate over a copy with the two lines swapped / the env name removed is false.
//   wire    — the suite server (no FLEET_INSTANCE_SOURCE, like the live fleet) carries no
//             `instance.source`; restarted WITH it, it does — and the "no band" predicate, run
//             over that answer, is false (the mutation is the real server with the variable set).
//   client  — the band paints only from `instance.source`, hidden otherwise; mutation: the same
//             anchors over a copy without the hidden line are false.
async function instanceBandChecks(): Promise<void> {
  const clock = () => "12:00";
  const H = "a".repeat(40), T = "b".repeat(40);
  const words = (o: unknown) => { const src = instanceSourceFrom(JSON.stringify(o)); return src ? instanceBandText(src, clock) : null; };
  const lane = (ahead: number | null, dirty: number | null) =>
    ({ head: H, branch: "fleet/r11-fixture", dirty, measuredAt: 1, target: { branch: "overhaul", head: T, ahead } });
  const three = words(lane(3, 0)), all = words(lane(0, 0)), none = words({});
  check("band words: branch, stand at start and '3 Commits noch nicht auf overhaul'",
    three?.text === "Zweig fleet/r11-fixture · Stand beim Start aaaaaaa · 3 Commits noch nicht auf overhaul", three?.text);
  check("band words: both counts measured zero read 'alles schon auf overhaul'",
    all?.text === "Zweig fleet/r11-fixture · Stand beim Start aaaaaaa · alles schon auf overhaul", all?.text);
  check("band words: an instance without a readable record reads 'Stand unbekannt', set-but-garbage likewise",
    none?.text === "Zweig unbekannt · Stand unbekannt"
      && instanceBandText(instanceSourceFrom("not json")!, clock).text === "Zweig unbekannt · Stand unbekannt", none?.text);
  const guessed = [words(lane(null, 0)), words(lane(0, null)), words({ ...lane(0, 0), target: null })];
  const neverGuessed = (b: ReturnType<typeof words>) => !!b && !b.text.includes("alles schon") && b.text.includes("unbekannt");
  check("band words: a missing count or target is 'unbekannt', never 'alles schon'",
    guessed.every(neverGuessed), JSON.stringify(guessed.map((b) => b?.text)));
  check("band words MUTATION: the never-guessed predicate is red on a text that claims 'alles schon' without a count",
    !neverGuessed({ segments: [], title: "", text: "Zweig x · Stand beim Start aaaaaaa · alles schon auf overhaul" }));
  const PROCESS = /\b(baton|audit|gate|suite|deploy)\b/i;
  const every = [three, all, none, ...guessed, words(lane(1, 2)), words(lane(0, 1))];
  check("band words: no process word in any band text or tooltip (G0.5)",
    every.every((b) => !!b && !PROCESS.test(b.text) && !PROCESS.test(b.title)), JSON.stringify(every.map((b) => b?.text)));
  check("band words MUTATION: the vocabulary predicate is red on a planted process word", PROCESS.test(`${three?.text} · gate`));
  check("band words: the source is folded to null when unset or empty — no band on an instance without the variable",
    instanceSourceFrom(undefined) === null && instanceSourceFrom("") === null);

  // measure — a real repository: overhaul + a lane branch three commits ahead
  const src = dirname(realpathSync(`${ROOT}/node_modules`));
  const fx = mkdtempSync(`${ROOT}/ti-band-`);
  const git = (...a: string[]) => spawnSync("git", ["-C", fx, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...a], { encoding: "utf8" });
  const measure = (target?: string) => {
    const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", TMPDIR: process.env.TMPDIR ?? "/tmp" };
    if (target !== undefined) env.FLEET_TI_TARGET = target;
    const r = spawnSync("sh", [`${fx}/testinstanz.sh`, "source"], { env, encoding: "utf8" });
    try { return { code: r.status, json: JSON.parse(r.stdout) as Record<string, unknown> & { target?: { branch?: string; head?: string | null; ahead?: number | null } | null }, raw: r.stdout }; }
    catch { return { code: r.status, json: null, raw: r.stdout + r.stderr }; }
  };
  try {
    writeFileSync(`${fx}/testinstanz.sh`, readFileSync(`${src}/testinstanz.sh`));
    chmodSync(`${fx}/testinstanz.sh`, 0o700);
    const setup = [git("init", "-q", "-b", "overhaul"), git("add", "-A"), git("commit", "-qm", "base"), git("checkout", "-qb", "fleet/r11-fixture")];
    for (const f of ["one", "two", "three"]) { writeFileSync(`${fx}/${f}.txt`, `${f}\n`); setup.push(git("add", "-A"), git("commit", "-qm", f)); }
    check("band measure SETUP: fixture repository with overhaul and a lane three commits ahead", setup.every((r) => r.status === 0),
      setup.map((r) => r.stderr).join("").slice(0, 200));
    const head = git("rev-parse", "HEAD").stdout.trim(), overhaul = git("rev-parse", "overhaul").stdout.trim();
    const m3 = measure("overhaul");
    check("band measure: source reports head, branch, clean tree and 3 commits not on overhaul",
      m3.code === 0 && m3.json?.head === head && m3.json.branch === "fleet/r11-fixture" && m3.json.dirty === 0
        && m3.json.target?.branch === "overhaul" && m3.json.target.head === overhaul && m3.json.target.ahead === 3
        && instanceBandText(instanceSourceFrom(m3.raw.trim())!, clock).text.endsWith("3 Commits noch nicht auf overhaul"), m3.raw);
    const first = git("rev-list", "--reverse", "overhaul..HEAD").stdout.split("\n")[0];
    const picked = [git("checkout", "-q", "overhaul"), git("cherry-pick", first), git("checkout", "-q", "fleet/r11-fixture")];
    writeFileSync(`${fx}/scratch.txt`, "uncommitted\n");
    const m2 = measure("overhaul");
    check("band measure MUTATION: a lane change already on the target (cherry-picked) leaves the count, an uncommitted file joins it",
      picked.every((r) => r.status === 0) && m2.json?.target?.ahead === 2 && m2.json.dirty === 1
        && instanceBandText(instanceSourceFrom(m2.raw.trim())!, clock).text.endsWith("2 Commits und 1 Datei ohne Commit noch nicht auf overhaul"), m2.raw);
    rmSync(`${fx}/scratch.txt`);
    const ff = git("branch", "-f", "overhaul", "fleet/r11-fixture"), m0 = measure("overhaul");
    check("band measure: a lane fully on overhaul with a clean tree reads 'alles schon auf overhaul'",
      ff.status === 0 && m0.json?.target?.ahead === 0 && m0.json.dirty === 0
        && instanceBandText(instanceSourceFrom(m0.raw.trim())!, clock).text.endsWith("alles schon auf overhaul"), m0.raw);
    const unset = measure(), bogus = measure("no-such-branch");
    check("band measure: no target given is target null (never a guessed branch), an unknown branch has no count",
      unset.code === 0 && unset.json?.target === null && bogus.json?.target?.branch === "no-such-branch"
        && bogus.json.target.head === null && bogus.json.target.ahead === null, `${unset.raw} | ${bogus.raw}`);
  } finally { rmSync(fx, { recursive: true, force: true }); }

  // order — measured before the copy, handed to the instance (comment lines stripped first)
  const code = (text: string) => text.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  const ordered = (script: string) => {
    const c = code(script), measured = c.indexOf("TI_SOURCE_BEFORE=$(ti_measure)"), copied = c.indexOf("rsync -a ");
    return measured >= 0 && copied > measured && /FLEET_INSTANCE_SOURCE="\$TI_SHOWN"/.test(c)
      && /TI_SHOWN=\$\(sed -n 's\/\^sourceBefore=\/\/p' "\$STATE"/.test(c) && /\bFLEET_INSTANCE_SOURCE FLEET_LANE_SUCCEED_MAX\b/.test(c);
  };
  const tiScript = readFileSync(`${src}/testinstanz.sh`, "utf8");
  check("band order: up measures the source before rsync and launches the instance with that record (env name listed)", ordered(tiScript));
  const measuredAfterCopy = tiScript.replace("  TI_SOURCE_BEFORE=$(ti_measure)\n", "")
    .replace(/(  rsync -a [^\n]*\n)/, "$1  TI_SOURCE_BEFORE=$(ti_measure)\n");
  check("band order MUTATION: measuring after the copy, or launching without the variable, is red",
    !ordered(measuredAfterCopy) && !ordered(tiScript.replace('FLEET_INSTANCE_SOURCE="$TI_SHOWN" ', "")));

  // wire — the suite server runs like the live fleet: no FLEET_INSTANCE_SOURCE
  type SessionsInstance = { instance?: { name?: string | null; source?: unknown } };
  const sessions = async () => await (await get("/api/sessions")).json() as SessionsInstance;
  const noBand = (b: SessionsInstance) => !!b.instance && !("source" in b.instance);
  const plain = await sessions();
  check("band wire: a server without FLEET_INSTANCE_SOURCE (the live fleet) sends no instance.source", noBand(plain), JSON.stringify(plain.instance));
  const sample = lane(3, 0);
  try {
    await restartSrv({ FLEET_INSTANCE_SOURCE: JSON.stringify(sample) });
    const shown = await sessions();
    check("band wire: a test instance carries its recorded stand as instance.source, folded by the shared parser",
      JSON.stringify(shown.instance?.source) === JSON.stringify(instanceSourceFrom(JSON.stringify(sample))), JSON.stringify(shown.instance));
    check("band wire MUTATION: the no-band predicate is red on the answer of a server started WITH the variable", !noBand(shown));
    await restartSrv({ FLEET_INSTANCE_SOURCE: "{not json" });
    const garbled = await sessions();
    const garbledText = garbled.instance?.source ? instanceBandText(instanceSourceFrom(JSON.stringify(garbled.instance.source))!, clock).text : null;
    check("band wire: an unreadable record still marks the test instance and reads 'Stand unbekannt'",
      garbledText === "Zweig unbekannt · Stand unbekannt", JSON.stringify(garbled.instance));
  } finally { await restartSrv(); }
  check("band wire: back on the plain server, no instance.source again", noBand(await sessions()));

  // client — painted only from instance.source
  const client = readFileSync(`${src}/src/client.ts`, "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  const html = readFileSync(`${src}/public/index.html`, "utf8");
  const wired = (c: string, h: string) => c.includes("renderInstanceBand(data.instance?.source === undefined ? null : instanceSourceFrom(JSON.stringify(data.instance.source)));")
    && c.includes('document.documentElement.classList.toggle("tiband", !!source);') && c.includes("tiBand.hidden = !source;")
    && c.includes("instanceBandText(source,") && h.includes('<div id="tiband" hidden></div>') && h.includes("#tiband[hidden] { display: none; }");
  check("band client: the band paints only from instance.source and is hidden (no html.tiband) without it", wired(client, html));
  check("band client MUTATION: the wiring predicate is red without the hidden toggle",
    !wired(client.replace("tiBand.hidden = !source;", ""), html) && !wired(client, html.replace('<div id="tiband" hidden></div>', '<div id="tiband"></div>')));
}

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
  printf '%s' "\${FLEET_TI_TARGET-unset}" > '${state}.target'
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
    const handed = [a, b].map((p) => { const f = `${states.get(p)}.target`; return exists(f) ? readFileSync(f, "utf8") : "missing"; });
    check("testinstanz up of a worktree without a session hands no target — the band says 'Ziel unbekannt' instead of a guess",
      handed.every((t) => t === "unset"), handed.join(","));
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

export async function helperRepoChecks(): Promise<void> {
  const dir = mkdtempSync("/tmp/fleet-helper-repos-");
  const current = `${dir}/current`, local = `${dir}/local`, missing = `${dir}/missing`;
  const git = (repo: string, ...args: string[]) => spawnSync("git", ["-C", repo, "-c", "user.name=Fixture",
    "-c", "user.email=fixture@example.invalid", ...args], { encoding: "utf8" });
  try {
    for (const repo of [current, local]) {
      mkdirSync(repo); git(repo, "init", "-qb", "main"); git(repo, "commit", "--allow-empty", "-qm", "fixture");
    }
    const subdir = `${current}/subdir`, alias = `${dir}/alias`;
    mkdirSync(subdir); symlinkSync(current, alias);
    const head = git(current, "rev-parse", "HEAD").stdout.trim();
    git(current, "remote", "add", "origin", "http://fixture.invalid/?token=SYNTHETIC_REPO_SECRET");
    git(current, "update-ref", "--create-reflog", "refs/remotes/origin/main", head);
    git(current, "branch", "origin/main", head);
    const cfgBase = { fleetUrl: "http://fixture.invalid", token: "SYNTHETIC_REPO_SECRET", deviceId: "fixturedevice",
      name: "workhorse", workDir: dir };
    const config = loadConfig("fixture", { ...cfgBase, repos: [
      { name: "current", path: current }, { name: "example-repo", path: local }, { name: "missing", path: missing },
      { name: "subdir", path: subdir }, { name: "alias", path: alias },
    ] }, 0o600);
    check("helper repos absent config preserves the serialized legacy config", JSON.stringify(loadConfig("fixture", cfgBase, 0o600))
      === JSON.stringify(loadConfig("fixture", { ...cfgBase, repos: undefined }, 0o600))
      && !Object.hasOwn(loadConfig("fixture", cfgBase, 0o600), "repos"));
    for (const repos of [[{ name: "bad/path", path: local }], Array(9).fill({ name: "cap", path: local }),
      [{ name: "duplicate", path: local }, { name: "duplicate", path: local }]]) {
      let refused = false;
      try { loadConfig("fixture", { ...cfgBase, repos }, 0o600); } catch { refused = true; }
      check("helper repos rejects unsafe, over-cap or duplicate configuration", refused);
    }
    const report = await reposOf(config.repos!);
    const [now, noRemote, unreadable, notRoot, symlinkRoot] = report.repos;
    check("helper configured subdirectory never reports its parent repo HEAD", notRoot.head === null
      && notRoot.branch === null && notRoot.remote === null && notRoot.refs.length === 0
      && notRoot.coverage === "incomplete" && notRoot.reason === "not-repo-root"
      && helperReposFrom(report)?.repos[3].reason === "not-repo-root");
    check("helper configured symlink to repo root measures the actual repo", symlinkRoot.head === head
      && symlinkRoot.coverage === "complete" && symlinkRoot.reason === null);
    check("helper repo full ref remains exact despite same-named local branch", now.refs[0]?.ref === "origin/main"
      && git(current, "for-each-ref", "--format=%(refname:short)", "refs/remotes/origin/main").stdout.trim() === "remotes/origin/main");
    check("helper repo current reading names exact HEAD branch merge-base and zero distance", now.head === head
      && now.branch === "main" && now.remote === "present" && now.remotes?.join() === "origin"
      && now.refs[0]?.head === head && now.refs[0]?.mergeBase === head && now.refs[0]?.ahead === 0
      && now.refs[0]?.behind === 0 && now.coverage === "complete" && now.refs[0]?.updatedAt !== null);
    check("helper repo without remotes is explicitly none", noRemote.head === git(local, "rev-parse", "HEAD").stdout.trim()
      && noRemote.remote === "none" && noRemote.remotes?.length === 0 && noRemote.refs.length === 0 && noRemote.coverage === "complete");
    check("helper unreadable repo retains null with fixed reason", unreadable.head === null && unreadable.branch === null
      && unreadable.remote === null && unreadable.coverage === "incomplete" && unreadable.reason === "unreadable");
    check("helper repo reports are validated and contain no path address URL or token", helperReposFrom(report) !== null
      && !JSON.stringify(report).includes(dir) && !JSON.stringify(report).includes("fixture.invalid")
      && !JSON.stringify(report).includes("SYNTHETIC_REPO_SECRET"));
    git(current, "commit", "--allow-empty", "-qm", "changed");
    check("helper repo repeated heartbeat reuses its bounded measurement cache", await reposOf(config.repos!) === report);
    const advanced = await reposOf([{ name: "current", path: current }]);
    check("helper repo distance direction is HEAD ahead of local remote", advanced.repos[0].refs[0].ahead === 1
      && advanced.repos[0].refs[0].behind === 0 && advanced.repos[0].refs[0].mergeBase === head);
    const advancedHead = advanced.repos[0].head!;
    git(current, "update-ref", "refs/remotes/origin/main", advancedHead);
    git(current, "reset", "--soft", head);
    const behind = await reposOf([{ name: "current", path: current }]);
    check("helper repo distance direction is remote ahead of HEAD", behind.repos[0].refs[0].ahead === 0
      && behind.repos[0].refs[0].behind === 1 && behind.repos[0].refs[0].mergeBase === head);
    git(current, "update-ref", "refs/remotes/origin/main", head);
    check("helper repo invalid envelope is identified without copying unknown fields", helperReposFrom({ ...report, absolutePath: dir }) === null);
    for (const mutation of [{ ...now, name: "bad/path" }, { ...now, refs: [{ ...now.refs[0], ahead: -1 }] },
      { ...now, refs: Array(9).fill(now.refs[0]) }, { ...noRemote, remotes: ["origin"] },
      { ...unreadable, coverage: "complete", reason: null }]) {
      const sanitized = helperReposFrom({ ...report, repos: [mutation, { ...noRemote, name: "healthy" }] });
      check("helper repo wire isolates invalid row while preserving healthy neighbours", sanitized?.repos[0].coverage === "incomplete"
        && sanitized.repos[0].reason === "invalid-report" && sanitized.repos[1].head === noRemote.head
        && !JSON.stringify(sanitized).includes("bad/path"));
    }
    const server = readFileSync(`${ROOT}/server.ts`, "utf8");
    const block = (from: string, to: string) => {
      const start = server.indexOf(from), end = server.indexOf(to, start);
      if (start < 0 || end <= start) throw new Error(`helper repos source anchor missing: ${from}`);
      return server.slice(start, end);
    };
    const functions = block("async function workplaceStandSources(", "function workplaceDaemonGraph(")
      + block("async function workplaceStands(", "async function workplaces(");
    const project = (code: string, reading: HelperReposReading | undefined): Promise<WorkplaceStand[]> => {
      const js = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
      return new Function("context", `const { helperDevices, realpathSync } = context;
        const helperUpdates = new Map(), slots = [], INSTANCE_LINKS = [], repoBases = {},
          REPO_DIR = "fixture-fleet", INSTANCE_NAME = "fixture", HELPER_UPDATE_REPO = null,
          BOOT_HEAD = null, bootHeadReady = Promise.resolve();
        async function workplaceStandReader() { return async (s) => ({...s, target:null,remote:null,reasons:[]}); }
        ${js}; return workplaceStands([], Date.now());`)(
        { helperDevices: new Map([["fixturedevice", { id: "fixturedevice", name: "workhorse", lastSeen: Date.now(), repos: reading }]]),
          realpathSync: (p: string) => { if (p !== "fixture-fleet") throw new Error("foreign repo touched locally"); return p; } });
    };
    const wire = await project(functions, report);
    const carrier = wire.find((r) => r.kind === "helper-repo" && r.repo === "current");
    const remote = Array.isArray(carrier?.remote) ? carrier.remote[0] : null;
    check("helper repo stand belongs to Fleet machine with exact timestamp and coverage", carrier?.name === "workhorse"
      && carrier.path === null && carrier.head === head && carrier.observedAt === now.at
      && carrier.coverage?.state === "complete" && carrier.reportedBranch === "main"
      && remote?.mergeBase === head && remote.distance?.ahead === 0 && remote.distance.behind === 0);
    check("helper remote ref age names the local reflog clock", remote?.refUpdatedAt === now.refs[0].updatedAt
      && typeof remote.refAgeMs === "number" && remote.refAgeMs >= 0);
    check("helper repo stands preserve none and unreadable measurements", wire.some((r) => r.kind === "helper-repo"
      && r.repo === "example-repo" && r.remote === "none") && wire.some((r) => r.kind === "helper-repo"
      && r.repo === "missing" && r.head === null && r.coverage?.reason === "unreadable"));
    check("helper subdirectory stand retains null and not-repo-root reason", wire.some((r) => r.kind === "helper-repo"
      && r.repo === "subdir" && r.head === null && r.remote === null && r.coverage?.reason === "not-repo-root"));
    const absent = await project(functions, undefined);
    check("helper heartbeat without repos is unreported rather than empty", absent.some((r) => r.kind === "helper-repo"
      && r.repo === null && r.head === null && r.remote === null && r.observedAt === null
      && r.coverage?.state === "unreported" && r.reasons.some((x) => x.reason === "repos-unreported")));
    const begin = functions.indexOf('    if (d.repos === undefined) source(');
    const end = functions.indexOf('    else for (const r of d.repos.repos)', begin);
    const mutation = functions.slice(0, begin) + '    if (d.repos === undefined) {}\n' + functions.slice(end);
    if (mutation === functions) throw new Error("helper repos mutation anchor missing");
    const mutated = await project(mutation, undefined);
    check("helper repos mutation proves omitted measurement is detected", !mutated.some((r) => r.kind === "helper-repo")
      && absent.some((r) => r.coverage?.state === "unreported"));
    const setter = new Bun.Transpiler({ loader: "ts" }).transformSync(block("function setHelperDevice(", "// Build the bundle"));
    const devices = new Map();
    const set = new Function("helperDevices", `const HELPER_DEVICE_KEEP=24, helperClaims=new Map(),auditShardRuns=new Map();
      ${setter}; return setHelperDevice;`)(devices) as (id: string, name: string, report?: Record<string, unknown>) => { repos?: HelperReposReading; daemonSha?: string };
    set("fixturedevice", "workhorse", { repos: report });
    check("helper claim touch retains the last repo measurement", set("fixturedevice", "workhorse").repos === report);
    const heartbeat = block('    if (body && Object.prototype.hasOwnProperty.call(body, "repos"))',
      '    if (body && Object.prototype.hasOwnProperty.call(body, "instance"))');
    const ingest = new Function("body", "reported", "helperReposFrom", "HELPER_REPOS_BYTES_MAX", "json",
      new Bun.Transpiler({ loader: "ts" }).transformSync(heartbeat)) as (...args: unknown[]) => unknown;
    const legacy: Record<string, unknown> = {};
    ingest({}, legacy, helperReposFrom, 32768, (v: unknown) => v);
    check("legacy heartbeat clears previously reported repos instead of claiming fresh data", Object.hasOwn(legacy, "repos")
      && set("fixturedevice", "workhorse", legacy).repos === undefined);
    const envelopeFallback: Record<string, unknown> = { daemonSha: head };
    const envelopeResponse = ingest({ repos: { ...report, path: dir } }, envelopeFallback, helperReposFrom, 32768, (v: unknown) => v);
    const fallback = set("fixturedevice", "workhorse", envelopeFallback);
    check("helper heartbeat malformed envelope preserves daemonSha with typed unknown repo", envelopeResponse === undefined
      && fallback.daemonSha === head && fallback.repos?.repos[0].head === null && fallback.repos.repos[0].reason === "invalid-report");
    const mixed: Record<string, unknown> = { daemonSha: head };
    const response = ingest({ repos: { ...report, repos: [{ ...now, refs: [now.refs[0],
      { ...now.refs[0], ref: "origin/broken", head: "broken", path: dir }] }, noRemote,
      { ...unreadable, name: "bad/path" }] } }, mixed, helperReposFrom, 32768, (v: unknown) => v);
    const received = set("fixturedevice", "workhorse", mixed);
    check("helper heartbeat bad ref and repo retain healthy rows and daemonSha", response === undefined
      && received.daemonSha === head && received.repos?.repos[0].head === head
      && received.repos.repos[0].refs[0].mergeBase === head && received.repos.repos[0].refs[1].head === null
      && received.repos.repos[0].refs[1].reason === "invalid-report" && received.repos.repos[1].head === noRemote.head
      && received.repos.repos[2].name === null && received.repos.repos[2].reason === "invalid-report"
      && !JSON.stringify(received).includes(dir) && !JSON.stringify(received).includes("bad/path"));
    const partialWire = await project(functions, received.repos);
    const partial = partialWire.find((r) => r.kind === "helper-repo" && r.repo === "current");
    check("helper stand isolates broken ref as null with reason", Array.isArray(partial?.remote)
      && partial.remote[0].mergeBase === head && partial.remote[1].head === null && partial.remote[1].distance === null
      && partial.remote[1].reasons.some((r) => r.field === "head" && r.reason === "invalid-report")
      && partialWire.some((r) => r.kind === "helper-repo" && r.repo === null && r.observedAt === null
        && r.coverage?.reason === "invalid-report" && r.reasons.some((x) => x.field === "observedAt" && x.reason === "invalid-report")));
    check("sanitized helper partial readings survive persistence unchanged", JSON.stringify(helperReposFrom(received.repos)) === JSON.stringify(received.repos));
    const oversized = ingest({ repos: report, junk: "x".repeat(37000) }, {}, helperReposFrom, 32768, (v: unknown) => v);
    check("helper repo heartbeat enforces the total size cap", !!oversized && typeof oversized === "object" && "error" in oversized);
    git(current, "-c", "core.logAllRefUpdates=false", "update-ref", "refs/remotes/origin/no-reflog", head);
    const noAge = await reposOf([{ name: "current", path: current }]);
    check("helper ref without reflog has unknown age", noAge.repos[0].refs.find((r) => r.ref?.endsWith("no-reflog"))?.updatedAt === null);
    git(current, "reset", "--soft", head);
    git(current, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
    const symbolic = await reposOf([{ name: "current", path: current }]);
    const symbolicRef = symbolic.repos[0].refs.find((r) => r.ref === "origin/HEAD");
    check("helper repo coverage includes symbolic remote refs with exact SHA and distance", symbolic.repos[0].coverage === "complete"
      && symbolicRef?.head === head && symbolicRef.mergeBase === head && symbolicRef.ahead === 0 && symbolicRef.behind === 0);
    const bulk = Array.from({ length: HELPER_REPO_COMMITS_MAX + 1 }, (_, i) => `commit refs/heads/main\ncommitter Fixture <fixture@example.invalid> 1700000000 +0000\ndata 7\nfixture\n${i === 0 ? `from ${head}\n` : ""}\n`).join("");
    const many = spawnSync("git", ["-C", current, "fast-import", "--quiet"], { input: bulk, encoding: "utf8" });
    const capped = await reposOf([{ name: "current", path: current }]);
    check("helper commit cap keeps measured HEAD with unknown distance and reason", many.status === 0
      && capped.repos[0].refs[0].ahead === null && capped.repos[0].refs[0].reason === "commit-cap"
      && capped.repos[0].coverage === "incomplete");
  } finally { rmSync(dir, { recursive: true, force: true }); }
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
    check("workplaces wire carries all four missing check stages with reasons", !!row && ["local", "preview", "gate", "audit"].every((stage) =>
      stage in row.checks && row.checks[stage as keyof WorkplaceChecks] === null && row.reasons.some((r) => r.field === `checks.${stage}`)));
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
    type FixtureOccupant = { id: number; openedAt: number; cwd: string; worktree: { repo: string; base: string; baseSha: string; branch?: string } };
    const holderFixture = (): FixtureOccupant => ({ id: 42, openedAt: 100, cwd: realpathSync(b),
      worktree: { repo: realpathSync(b), base: "overhaul", baseSha: bOverhaul } });
    const compile = (code: string, occupants: FixtureOccupant[], graphFails = false, statusAwait?: () => Promise<void>, notesFail = false, gitCalls?: string[], sources: Record<string, unknown> = {}) => {
      const js = new Bun.Transpiler({ loader: "ts" }).transformSync(code);
      return new Function("slots", "DISPATCH_REPO", "gitRead", "testinstanzCommand", "existsSync", "realpathSync", "statSync", "lstatSync", "HOST", "commandJobs", "laneSuiteJobs", "mergeLast", "mergeParked", "serverRuns",
        "runningPostLandAudit", "auditQueue", "auditQueueGroups", "auditCmdFor", "repoCanon", "localFailNames", "POSTLAND_AUDIT_FILE", "validAuditRow", "helperClaims", "auditShardRuns", "coverKey", "auditClaimableSince", "standContext",
        `const { REPO_DIR, HELPER_UPDATE_REPO, BOOT_HEAD, bootHeadReady, INSTANCE_NAME, INSTANCE_LINKS, helperDevices, helperUpdates, repoBases, instanceNameFrom, repoGraph, roleOf, readFileSync, resolve, dirname } = standContext;\n${js}\nreturn { repo: workplaceRepo, read: workplaces, observations: workplaceCheckObservations, checks: workplaceChecks, audits: workplaceAuditReading };`)(occupants, realpathSync(b),
        async (repo: string, ...args: string[]) => {
          gitCalls?.push(args[0]);
          if (notesFail && args[0] === "log") return { code: 128, out: "" };
          if (graphFails && args[0] === "rev-list") return { code: 128, out: "" };
          const r = git(repo, ...args); return { code: r.status, out: r.stdout.trim() };
        }, async (path: string, args: string[]) => {
          await statusAwait?.();
          const r = spawnSync(`${path}/testinstanz.sh`, args, { cwd: path, encoding: "utf8" });
          return { code: r.status, out: r.stdout };
        }, existsSync, realpathSync, statSync, lstatSync, "", sources.jobs ?? new Map(), sources.previews ?? new Map(), sources.merges ?? new Map(), sources.parked ?? new Map(),
        sources.runs ?? new Map(), sources.running ?? null, sources.queue ?? new Map(),
        (q: unknown) => [q], () => sources.configured !== false, (r: string) => r,
        (text: string) => text.split("\n").filter((l) => l.startsWith("FAIL  ")).map((l) => l.slice(6).split("  (")[0]),
        sources.auditFile ?? `${dir}/absent-audits`, (row: unknown) => {
          if (!row || typeof row !== "object" || !("covers" in row) || !Array.isArray(row.covers)) return null;
          return row;
        }, sources.claims ?? new Map(), sources.auditShards ?? new Map(),
        (c: { branch: string; mainAfter: string; at: number }) => JSON.stringify([c.branch, c.mainAfter, c.at]), sources.claimableSince ?? new Map(), { REPO_DIR: realpathSync(b), HELPER_UPDATE_REPO: realpathSync(b), BOOT_HEAD: bOverhaul, bootHeadReady: Promise.resolve(),
          INSTANCE_NAME: "fixture", INSTANCE_LINKS: [{ name: "other", url: "http://fixture.invalid/" }], helperDevices: new Map(), helperUpdates: new Map(), repoBases: {}, instanceNameFrom, repoGraph, roleOf, readFileSync, resolve, dirname, ...sources.stands as object }) as { observations: (repo: string, notes: { rows: unknown[] }, audits: { rows: unknown[]; reason: string }) => WorkplaceCheckObservation[];
          checks: (repo: string, branch: string | null, head: string | null, observations: WorkplaceCheckObservation[], auditReason: string,
            reasons: Array<{ field: string; reason: string }>) => WorkplaceChecks;
          audits: () => Promise<{ rows: unknown[]; reason: string }>;
          repo: (repo: string) => Promise<WorkplaceRepo>; read: () => Promise<Workplaces> };
    };
    const versionRepo = `${dir}/versions`, versionWorktree = `${dir}/version-worktree`;
    mkdirSync(versionRepo); git(versionRepo, "init", "-qb", "main");
    mkdirSync(`${versionRepo}/helper-daemon`); mkdirSync(`${versionRepo}/src`);
    writeFileSync(`${versionRepo}/server.ts`, "export const value = 1;\n");
    writeFileSync(`${versionRepo}/helper-daemon/daemon.ts`, "export const daemon = 1;\n");
    writeFileSync(`${versionRepo}/src/client.ts`, "export const client = 1;\n");
    writeFileSync(`${versionRepo}/package.json`, JSON.stringify({ scripts: { build: "bun build src/client.ts" } }));
    git(versionRepo, "add", "."); const versionBase = commit(versionRepo);
    writeFileSync(`${versionRepo}/README.md`, "documentation\n");
    git(versionRepo, "add", "."); const docsHead = commit(versionRepo);
    git(versionRepo, "worktree", "add", "-qb", "old-docs", versionWorktree, versionBase);
    writeFileSync(`${versionRepo}/server.ts`, "export const value = 2;\n");
    git(versionRepo, "add", "."); const serverHead = commit(versionRepo);
    writeFileSync(`${versionRepo}/helper-daemon/daemon.ts`, "export const daemon = 2;\n");
    git(versionRepo, "add", "."); const daemonHead = commit(versionRepo);
    git(versionRepo, "remote", "add", "origin", "http://fixture.invalid/?token=SYNTHETIC_REMOTE_SECRET");
    git(versionRepo, "update-ref", "--create-reflog", "refs/remotes/origin/main", serverHead);
    const standSources = { REPO_DIR: versionRepo, HELPER_UPDATE_REPO: versionRepo, BOOT_HEAD: docsHead,
      helperDevices: new Map([
        ["current", { id: "current", name: "current", lastSeen: 1000, daemonSha: daemonHead, instance: { head: serverHead, at: 900 } }],
        ["old", { id: "old", name: "old", lastSeen: 1000, daemonSha: serverHead }],
        ["missing", { id: "missing", name: "missing", lastSeen: 1000 }],
      ]), helperUpdates: new Map([["missing", { state: "reported", main: "main", result: { mainSha: daemonHead } }]]) };
    const standCalls: string[] = [];
    const versions = await compile(functions, [], false, undefined, false, standCalls, { stands: standSources }).read();
    const stand = (wire: Workplaces, kind: WorkplaceStand["kind"], name?: string) => wire.stands.find((s) => s.repo === realpathSync(versionRepo) && s.kind === kind && (name === undefined || s.name === name));
    const live = stand(versions, "live-server"), current = stand(versions, "helper-daemon", "current"), old = stand(versions, "helper-daemon", "old");
    check("workplace versions current daemon has exact zero distance and merge-base", current?.head === daemonHead
      && current.target?.head === daemonHead && current.target.mergeBase === daemonHead
      && current.target.distance?.ahead === 0 && current.target.distance.behind === 0 && current.target.codeBehind === false, JSON.stringify(current));
    check("workplace versions behind live code uses boot SHA and target merge-base", live?.head === docsHead
      && live.target?.mergeBase === docsHead && live.target.distance?.ahead === 0 && live.target.distance.behind === 2
      && live.target.codeBehind === true, JSON.stringify(live));
    check("workplace versions helper owns daemon code and has an independent server-instance stand", old?.target?.distance?.behind === 1
      && old.target.codeBehind === true && stand(versions, "helper-instance", "current")?.head === null
      && stand(versions, "helper-instance", "current")?.reportedCheckout?.head === serverHead
      && stand(versions, "helper-instance", "current")?.reasons.some((r) => r.field === "head" && r.reason === "helper-instance-running-sha-unreported") === true, JSON.stringify(old));
    const withoutOwnCode = await compile(functions, [], false, undefined, false, undefined,
      { stands: { ...standSources, BOOT_HEAD: serverHead } }).read();
    const serverOnly = stand(withoutOwnCode, "live-server");
    check("workplace versions behind without own code keeps behind count and false codeBehind", serverOnly?.target?.distance?.behind === 1
      && serverOnly.target.codeBehind === false, JSON.stringify(serverOnly));
    const missing = stand(versions, "helper-daemon", "missing");
    check("workplace versions missing daemon SHA stays null despite successful update", missing?.head === null
      && missing.target?.mergeBase === null && missing.target.distance === null && missing.target.codeBehind === null
      && missing.update?.mainSha === daemonHead && missing.reasons.some((r) => r.field === "head" && r.reason === "daemon-sha-unreported"), JSON.stringify(missing));
    const noRemote = versions.stands.find((s) => s.repo === realpathSync(b) && s.kind === "worktree");
    check("workplace versions repo without remote has typed none rather than null or error", noRemote?.remote === "none"
      && !noRemote.reasons.some((r) => r.field === "remote"), JSON.stringify(noRemote));
    const withDaemonUpdate = { ...standSources, helperUpdates: new Map([["current", {
      state: "open", main: "update-bundle", claim: { mainSha: serverHead },
    }]]) };
    const defaultUpdated = await compile(functions, [], false, undefined, false, undefined, { stands: withDaemonUpdate }).read();
    const defaultDaemon = stand(defaultUpdated, "helper-daemon", "current");
    check("workplace versions daemon default target is independent of update job", current?.target?.ref === "refs/heads/main"
      && JSON.stringify(defaultDaemon?.target) === JSON.stringify(current.target)
      && defaultDaemon?.update?.main === "update-bundle", JSON.stringify(defaultDaemon));
    git(versionRepo, "branch", "integration", serverHead);
    const configuredSources = { ...standSources, repoBases: { [versionRepo]: "integration" } };
    const configuredWithoutJob = await compile(functions, [], false, undefined, false, undefined, { stands: configuredSources }).read();
    const configuredWithJob = await compile(functions, [], false, undefined, false, undefined,
      { stands: { ...withDaemonUpdate, repoBases: configuredSources.repoBases } }).read();
    const configuredDaemon = stand(configuredWithoutJob, "helper-daemon", "current");
    const updatedDaemon = stand(configuredWithJob, "helper-daemon", "current");
    const sameConfiguredTarget = (left: Workplaces, right: Workplaces) => {
      const target = stand(left, "helper-daemon", "current")?.target;
      return target?.ref === "refs/heads/integration" && target.head === serverHead
        && JSON.stringify(target) === JSON.stringify(stand(right, "helper-daemon", "current")?.target);
    };
    check("workplace versions daemon configured repo target is identical with and without job", sameConfiguredTarget(configuredWithoutJob, configuredWithJob)
      && updatedDaemon?.update?.main === "update-bundle" && updatedDaemon.update.mainSha === serverHead, JSON.stringify(configuredDaemon));
    const jobTargetLie = functions.replace('branch: HELPER_UPDATE_REPO ? repoBases[HELPER_UPDATE_REPO] ?? null : null, headReason: "daemon-sha-unreported"',
      'branch: update?.main ?? null, headReason: "daemon-sha-unreported"');
    const jobTargetLieWire = await compile(jobTargetLie, [], false, undefined, false, undefined,
      { stands: { ...withDaemonUpdate, repoBases: configuredSources.repoBases } }).read();
    check("workplace versions mutation rejects daemon target borrowed from update bundle", jobTargetLie !== functions
      && !sameConfiguredTarget(configuredWithoutJob, jobTargetLieWire)
      && stand(jobTargetLieWire, "helper-daemon", "current")?.target?.ref === "refs/heads/update-bundle");
    const remote = Array.isArray(live?.remote) ? live.remote[0] : null;
    check("workplace versions remote names local ref tip merge-base distance and logged age", remote?.name === "origin"
      && remote.ref === "refs/remotes/origin/main" && remote.head === serverHead && remote.mergeBase === docsHead
      && remote.distance?.ahead === 0 && remote.distance.behind === 1 && remote.codeBehind === true
      && remote.refUpdatedAt !== null && remote.refAgeMs !== null, JSON.stringify(remote));
    const future = stand(versions, "helper-daemon", "current"), futureRemote = Array.isArray(future?.remote) ? future.remote[0] : null;
    check("workplace versions remote ahead and behind directions stay independent", futureRemote?.distance?.ahead === 1
      && futureRemote.distance.behind === 0 && futureRemote.mergeBase === serverHead, JSON.stringify(futureRemote));
    check("workplace versions links and test instances name unobserved running SHA", versions.stands.some((s) => s.kind === "linked-instance"
      && s.name === "other" && s.repo === null && s.head === null && s.reasons.some((r) => r.field === "head"))
      && value.stands.some((s) => s.kind === "test-instance" && s.path === realpathSync(orphan) && s.head === null && s.reasons.some((r) => r.field === "head")));
    const versionWire = JSON.stringify(versions);
    check("workplace versions never reads network or emits remote endpoints or credentials", !standCalls.some((c) => c === "fetch" || c === "push" || c === "ls-remote")
      && !versionWire.includes("fixture.invalid") && !versionWire.includes("SYNTHETIC_REMOTE_SECRET"));
    const lie = functions.replace('result.codeBehind = roles.includes(true) ? true : roles.includes(null) ? null : false;', 'result.codeBehind = false;');
    const lied = await compile(lie, [], false, undefined, false, undefined, { stands: standSources }).read();
    check("workplace versions mutation rejects suppressed own-code backlog", lie !== functions && stand(lied, "live-server")?.target?.codeBehind !== true);
    const reversed = functions.replace('ahead: lines.filter((l) => l[0] === "<").length, behind: lines.filter((l) => l[0] === ">").length',
      'behind: lines.filter((l) => l[0] === "<").length, ahead: lines.filter((l) => l[0] === ">").length');
    const reversedWire = await compile(reversed, [], false, undefined, false, undefined, { stands: standSources }).read();
    check("workplace versions mutation rejects reversed commit distance", reversed !== functions && stand(reversedWire, "live-server")?.target?.distance?.behind !== 2);
    git(versionRepo, "remote", "add", "unseen", "http://fixture.invalid/");
    const noRefWire = await compile(functions, [], false, undefined, false, undefined, { stands: standSources }).read();
    const noRef = stand(noRefWire, "live-server")?.remote;
    check("workplace versions configured remote with missing ref is unknown with reason", Array.isArray(noRef)
      && noRef.find((r) => r.name === "unseen")?.head === null
      && noRef.find((r) => r.name === "unseen")?.reasons.some((r) => r.field === "head" && r.reason === "local-ref-missing") === true);
    git(versionRepo, "update-ref", "--create-reflog", "refs/remotes/origin/upstream-target", versionBase);
    git(versionRepo, "config", "branch.main.remote", "origin");
    git(versionRepo, "config", "branch.main.merge", "refs/heads/upstream-target");
    const upstreamWire = await compile(functions, [], false, undefined, false, undefined, { stands: standSources }).read();
    const upstream = stand(upstreamWire, "live-server")?.remote;
    check("workplace versions configured upstream selects its remote branch rather than assuming main", Array.isArray(upstream)
      && upstream.find((r) => r.name === "origin")?.ref === "refs/remotes/origin/upstream-target"
      && upstream.find((r) => r.name === "origin")?.head === versionBase);
    const checkoutLie = functions.replace('head: null, basis: "checkout-unproven"', 'head: d.instance.head, basis: "checkout-unproven"');
    const checkoutLieWire = await compile(checkoutLie, [], false, undefined, false, undefined, { stands: standSources }).read();
    check("workplace versions mutation rejects checkout SHA claimed as running helper instance", checkoutLie !== functions
      && stand(checkoutLieWire, "helper-instance", "current")?.head !== null);
    git(versionRepo, "checkout", "-qb", "merge-docs", daemonHead);
    writeFileSync(`${versionRepo}/branch.md`, "branch docs\n"); git(versionRepo, "add", "."); const mergeDocsHead = commit(versionRepo);
    git(versionRepo, "checkout", "-q", "main");
    writeFileSync(`${versionRepo}/main.md`, "main docs\n"); git(versionRepo, "add", "."); const mergeMainHead = commit(versionRepo);
    const mergeStarted = git(versionRepo, "merge", "--no-ff", "--no-commit", "merge-docs");
    writeFileSync(`${versionRepo}/server.ts`, "export const value = 3;\n"); git(versionRepo, "add", "."); const mergeHead = commit(versionRepo);
    const mergeParents = git(versionRepo, "rev-list", "--parents", "-1", mergeHead).stdout.trim().split(" ");
    const mergeHasNoLoggedServer = !git(versionRepo, "log", "--format=", "--name-only", `${daemonHead}..${mergeHead}`, "--").stdout.split("\n").includes("server.ts");
    check("workplace versions merge fixture changes server only in merge resolution", mergeStarted.status === 0
      && mergeParents.join(" ") === [mergeHead, mergeMainHead, mergeDocsHead].join(" ") && mergeHasNoLoggedServer);
    const mergeSources = { ...standSources, BOOT_HEAD: daemonHead };
    const mergedWire = await compile(functions, [], false, undefined, false, undefined, { stands: mergeSources }).read();
    const mergeStand = stand(mergedWire, "live-server");
    const seesMergeCode = (wire: Workplaces) => {
      const target = stand(wire, "live-server")?.target;
      return target?.mergeBase === daemonHead && target.head === mergeHead && target.distance?.ahead === 0
        && target.distance.behind === 3 && target.codeBehind === true;
    };
    check("workplace versions merge resolution reports true own-code backlog", seesMergeCode(mergedWire), JSON.stringify(mergeStand));
    const mergeBlind = functions.replace('gitRead(repo, "diff", "--name-only", "-z", "--no-renames", result.mergeBase, target, "--")',
      'gitRead(repo, "log", "--format=", "--name-only", "-z", "--no-renames", pathKey, "--")');
    const mergeBlindWire = await compile(mergeBlind, [], false, undefined, false, undefined, { stands: mergeSources }).read();
    check("workplace versions mutation rejects log missing merge-resolution paths", mergeBlind !== functions
      && !seesMergeCode(mergeBlindWire) && stand(mergeBlindWire, "live-server")?.target?.codeBehind === false);
    writeFileSync(`${versionRepo}/server.ts`, "export const value = 2;\n"); git(versionRepo, "add", "."); const revertedHead = commit(versionRepo);
    const revertedWire = await compile(functions, [], false, undefined, false, undefined, { stands: mergeSources }).read();
    const revertedTarget = stand(revertedWire, "live-server")?.target;
    check("workplace versions reverted server edits leave no net own-code backlog", revertedTarget?.head === revertedHead
      && revertedTarget.distance?.behind === 4 && revertedTarget.codeBehind === false, JSON.stringify(revertedTarget));
    const checkHead = "a".repeat(40), oldHead = "b".repeat(40), checkBranch = "fixture-lane", checkRepo = realpathSync(b);
    const checkHolder = { ...holderFixture(), worktree: { ...holderFixture().worktree, branch: checkBranch } };
    const fixtureSources = (stage: keyof WorkplaceChecks, state: "green" | "red" | "running" | "waiting" | "skipped", sha = checkHead): Record<string, unknown> => {
      const result = state === "green" || state === "red" ? { result: state, fails: state === "red" ? ["fixture rejection"] : [], remote: { reportedAt: 300 } } : null;
      const j = { repo: checkRepo, branch: checkBranch, slot: 99, slotOpenedAt: 1, cmd: "bun run build", commitSha: sha,
        offeredAt: 100, state: result ? "reported" : state === "running" ? "claimed" : "open",
        claim: state === "running" ? { claimedAt: 200, expiresAt: Number.MAX_SAFE_INTEGER } : null, result };
      if (stage === "local") return { jobs: new Map([["fixture", j]]) };
      if (stage === "preview") return { previews: new Map([["fixture", j]]) };
      if (stage === "gate") return state === "running" ? { runs: new Map([["land:42", { repo: checkRepo, branch: checkBranch, suite: "land gate", at: 200 }]]) }
        : { merges: new Map([[42, { branch: checkBranch, candidateSha: sha, at: 300,
          verify: { ok: state === "green", out: state === "red" ? "FAIL  fixture rejection" : "" } }]]) };
      const covers = [{ branch: checkBranch, mainAfter: sha, at: 100 }];
      return state === "running" ? { running: { repo: checkRepo, mainSha: sha, startedAt: 200, covers } }
        : state === "waiting" || state === "skipped" ? { queue: new Map([[checkRepo, { covers }]]), configured: state !== "skipped" }
        : {};
    };
    const observe = (stage: keyof WorkplaceChecks, state: "green" | "red" | "running" | "waiting" | "skipped", sha = checkHead,
      override: Record<string, unknown> = {}, code = functions) => {
      const fixture = compile(code, [checkHolder], false, undefined, false, undefined, { ...fixtureSources(stage, state, sha), ...override });
      const auditRows = stage === "audit" && (state === "green" || state === "red") ? [{ repo: checkRepo, mainSha: sha, at: 300, result: state,
        covers: [{ branch: checkBranch, mainAfter: sha, at: 100 }], fails: state === "red" ? ["fixture rejection"] : [] }] : [];
      const observations = fixture.observations(checkRepo, { rows: [] }, { rows: auditRows, reason: "audit-not-retained" });
      const reasons: Array<{ field: string; reason: string }> = [];
      return { checks: fixture.checks(checkRepo, checkBranch, checkHead, observations, "audit-not-retained", reasons), reasons, observations };
    };
    for (const stage of ["local", "preview", "gate", "audit"] as const) {
      const green = observe(stage, "green"), red = observe(stage, "red"), running = observe(stage, "running"), stale = observe(stage, "green", oldHead);
      check(`workplaces checks ${stage} green retains measured SHA and time`, green.checks[stage]?.state === "green"
        && green.checks[stage]?.head === checkHead && green.checks[stage]?.at === 300 && green.checks[stage]?.stale === false);
      check(`workplaces checks ${stage} red names the failed fixture`, red.checks[stage]?.state === "red" && red.checks[stage]?.fails[0] === "fixture rejection");
      check(`workplaces checks ${stage} running is distinct from a prior result`, running.checks[stage]?.state === "running" && running.checks[stage]?.at === 200);
      check(`workplaces checks ${stage} stale compares the recorded SHA to worktree HEAD`, stale.checks[stage]?.stale === true && stale.checks[stage]?.head === oldHead);
      const missing = compile(functions, []).checks(checkRepo, checkBranch, checkHead, [], "audit-not-retained", []);
      const why: Array<{ field: string; reason: string }> = [];
      compile(functions, []).checks(checkRepo, checkBranch, checkHead, [], "audit-not-retained", why);
      check(`workplaces checks ${stage} missing stays null with a named reason`, missing[stage] === null && why.some((r) => r.field === `checks.${stage}` && r.reason === `${stage}-not-retained`));
      const staleMutant = functions.replace("sha !== head", "false");
      check(`workplaces checks ${stage} mutation rejects masking stale evidence`, staleMutant !== functions && observe(stage, "green", oldHead, {}, staleMutant).checks[stage]?.stale !== true);
      const branchMutant = functions.replace("o.branch === branch &&", "");
      const other = { ...green.observations[0], branch: "another-branch" };
      const rejectsOther = (code: string) => compile(code, []).checks(checkRepo, checkBranch, checkHead, [other], "audit-not-retained", [])[stage] === null;
      check(`workplaces checks ${stage} branch mutation rejects another lane's evidence`, rejectsOther(functions) && !rejectsOther(branchMutant));
    }
    for (const stage of ["local", "preview", "audit"] as const)
      check(`workplaces checks ${stage} waiting names queued work`, observe(stage, "waiting").checks[stage]?.state === "waiting");
    check("workplaces checks parked audit is skipped rather than waiting", observe("audit", "skipped").checks.audit?.state === "skipped");
    const recycled = observe("gate", "green", checkHead, { merges: new Map([[42, { branch: "previous-lane", candidateSha: checkHead, at: 300, verify: { ok: true, out: "" } }]]) });
    check("workplaces checks recycled slot never lends its old gate to the current branch", recycled.checks.gate === null);
    const remoteCovers = [{ branch: checkBranch, mainAfter: checkHead, at: 100 }];
    const remoteClaim = { repo: checkRepo, mainSha: checkHead, claimedAt: 200, expiresAt: Number.MAX_SAFE_INTEGER, covers: remoteCovers };
    const remoteAudit = observe("audit", "waiting", checkHead, { claims: new Map([[checkRepo, remoteClaim]]) });
    check("workplaces checks remote audit claim masks its queued cover by value", remoteAudit.checks.audit?.state === "running" && remoteAudit.checks.audit.at === 200);
    const remoteShard = { repo: checkRepo, mainSha: checkHead, firstClaimAt: 200, openUntil: Number.MAX_SAFE_INTEGER,
      covers: remoteCovers, shards: [{ claim: { expiresAt: Number.MAX_SAFE_INTEGER } }] };
    const shardedAudit = observe("audit", "waiting", checkHead, { auditShards: new Map([[checkRepo, remoteShard]]) });
    check("workplaces checks sharded remote audit running masks its queued cover", shardedAudit.checks.audit?.state === "running");
    const expiredAudit = observe("audit", "waiting", checkHead, { claims: new Map([[checkRepo, { ...remoteClaim, expiresAt: 1 }]]) });
    check("workplaces checks expired remote audit cannot claim running or queued measurement", expiredAudit.checks.audit === null);
    const missingSha = observe("gate", "running");
    check("workplaces checks live gate never invents a candidate SHA", missingSha.checks.gate?.head === null && missingSha.checks.gate?.stale === null
      && missingSha.reasons.some((r) => r.field === "checks.gate.head" && r.reason === "checked-head-unrecorded"));
    const noteFixture = compile(functions, []);
    const noteObservations = noteFixture.observations(checkRepo, { rows: [{ branch: checkBranch, sha: checkHead, at: 300, verify: { ok: true, out: "" } }] }, { rows: [], reason: "audit-not-retained" });
    check("workplaces checks land-note gate survives a slotless lane", noteFixture.checks(checkRepo, checkBranch, checkHead, noteObservations, "audit-not-retained", []).gate?.state === "green");
    const unownedMerge = compile(functions, [{ ...checkHolder, worktree: { ...checkHolder.worktree, repo: a } }], false, undefined, false, undefined, fixtureSources("gate", "green"));
    const mismatchedMerge = unownedMerge.observations(checkRepo, { rows: [] }, { rows: [], reason: "audit-not-retained" });
    check("workplaces checks merge slot with matching branch in another repo cannot join", unownedMerge.checks(checkRepo, checkBranch, checkHead, mismatchedMerge, "audit-not-retained", []).gate === null);
    const mergeWithRepo = { branch: checkBranch, candidateSha: checkHead, at: 300, repo: checkRepo, verify: { ok: true, out: "" } };
    const recordedRepoClaim = (code: string) => {
      const f = compile(code, [{ ...checkHolder, worktree: { ...checkHolder.worktree, repo: a } }], false, undefined, false, undefined,
        { merges: new Map([[42, mergeWithRepo]]) });
      return f.checks(checkRepo, checkBranch, checkHead, f.observations(checkRepo, { rows: [] }, { rows: [], reason: "audit-not-retained" }), "audit-not-retained", []).gate?.state === "green";
    };
    check("workplaces checks recorded merge repo survives occupant repo changes", recordedRepoClaim(functions));
    const repoMutant = functions.replace('"repo" in m && typeof m.repo === "string" && m.repo ? m.repo : null', 'null');
    check("workplaces checks merge repo mutation cannot substitute the current occupant", repoMutant !== functions && !recordedRepoClaim(repoMutant));
    const recordedOtherRepo = observe("gate", "green", checkHead, { merges: new Map([[42, { ...mergeWithRepo, repo: a }]]) });
    check("workplaces checks recorded other merge repo overrides a matching current holder", recordedOtherRepo.checks.gate === null);
    const lateAuditClaim = (code: string, state: "waiting" | "running") => {
      const newer = { branch: checkBranch, mainAfter: checkHead, at: 400 };
      const f = compile(code, [], false, undefined, false, undefined, state === "waiting"
        ? { queue: new Map([[checkRepo, { covers: [newer] }]]) }
        : { running: { repo: checkRepo, mainSha: checkHead, startedAt: 450, covers: [newer] } });
      const observations = f.observations(checkRepo, { rows: [] }, { rows: [{ repo: checkRepo, mainSha: oldHead,
        at: 500, result: "green", covers: [{ branch: checkBranch, mainAfter: oldHead, at: 100 }] }], reason: "audit-not-retained" });
      const value = f.checks(checkRepo, checkBranch, checkHead, observations, "audit-not-retained", []).audit;
      return value?.state === state && value.head === checkHead && value.at === (state === "waiting" ? 400 : 450);
    };
    const auditOrderMutant = functions.replace('order: cover.at', 'order: at');
    for (const state of ["waiting", "running"] as const) {
      check(`workplaces checks old audit finishing late cannot hide newer ${state} cover`, lateAuditClaim(functions, state));
      check(`workplaces checks completion-order mutation hides newer ${state} cover`, auditOrderMutant !== functions && !lateAuditClaim(auditOrderMutant, state));
    }
    const retryAuditClaim = (code: string, state: "waiting" | "running") => {
      const cover = { branch: checkBranch, mainAfter: checkHead, at: 100 };
      const f = compile(code, [], false, undefined, false, undefined, state === "waiting"
        ? { queue: new Map([[checkRepo, { covers: [cover] }]]), claimableSince: new Map([[checkRepo, 400]]) }
        : { running: { repo: checkRepo, mainSha: checkHead, startedAt: 400, covers: [cover] } });
      const observations = f.observations(checkRepo, { rows: [] }, { rows: [{ repo: checkRepo, mainSha: checkHead,
        at: 300, result: "red", fails: ["previous attempt"], covers: [cover] }], reason: "audit-not-retained" });
      const value = f.checks(checkRepo, checkBranch, checkHead, observations, "audit-not-retained", []).audit;
      return value?.state === state && value.head === checkHead && value.at === 400 && value.fails.length === 0;
    };
    const auditRetryMutant = functions.replace(" || b.at - a.at", "");
    for (const state of ["waiting", "running"] as const) {
      check(`workplaces checks red audit yields to newer ${state} retry of the same cover`, retryAuditClaim(functions, state));
      check(`workplaces checks observation-time mutation hides ${state} retry behind old red`, auditRetryMutant !== functions && !retryAuditClaim(auditRetryMutant, state));
    }
    const skipGate = observe("gate", "green", checkHead, { merges: new Map([[42, { branch: checkBranch, candidateSha: checkHead, at: 300, verify: { ok: null, out: "" } }]]) });
    check("workplaces checks explicit gate skip is skipped", skipGate.checks.gate?.state === "skipped");
    for (const flag of ["timedOut", "waitedOut", "serverDown"] as const) {
      const unmeasured = observe("gate", "green", checkHead, { merges: new Map([[42, { branch: checkBranch, candidateSha: checkHead, at: 300,
        verify: { ok: null, out: "", [flag]: true } }]]) });
      check(`workplaces checks gate ${flag} is null with a reason`, unmeasured.checks.gate === null && unmeasured.reasons.some((r) => r.field === "checks.gate"));
    }
    const projection = compile(functions, []);
    const localBase = observe("local", "green").observations[0];
    const aggregated = projection.checks(checkRepo, checkBranch, checkHead, [localBase, { ...localBase, command: "bun test", state: "red", fails: ["reject case"], at: 299 }], "audit-not-retained", []);
    check("workplaces checks local aggregates latest distinct command proofs at one SHA", aggregated.local?.state === "red" && aggregated.local.fails[0] === "reject case");
    const replacement = projection.checks(checkRepo, checkBranch, checkHead, [localBase, { ...localBase, state: "green", head: oldHead, at: 310, order: 50 },
      { ...localBase, state: "waiting", head: null, at: 250, order: 250 }], "audit-not-retained", []);
    check("workplaces checks newest offer supersedes older late-arriving verdict", replacement.local?.state === "waiting" && replacement.local.head === null);
    const fixture = compile(functions, []), reasons: Array<{ field: string; reason: string }> = [];
    const leakNames = Array.from({ length: 30 }, (_, i) => `fixture ${i} ` + "x".repeat(200));
    const capped = fixture.checks(checkRepo, checkBranch, checkHead, [{ repo: checkRepo, branch: checkBranch, stage: "preview", head: checkHead,
      state: "red", at: 300, fails: leakNames }], "audit-not-retained", reasons);
    check("workplaces checks failure names have both count and character caps", capped.preview?.fails.length === 20 && capped.preview.fails.every((n) => n.length === 160));
    const otherRepo = observe("local", "green").observations.map((o) => ({ ...o, repo: a }));
    check("workplaces checks equal branch and SHA in another repo cannot join", fixture.checks(checkRepo, checkBranch, checkHead, otherRepo, "audit-not-retained", []).local === null);
    const protectedNames = fixture.checks(checkRepo, checkBranch, checkHead, [{ repo: checkRepo, branch: checkBranch, stage: "preview", head: checkHead,
      state: "red", at: 300, fails: ["fixture https://fixture.invalid/ 192.0.2.1 token=SYNTHETIC_CHECK_SECRET"] }], "audit-not-retained", []);
    check("workplaces checks redacts network addresses and credential-shaped fail details", protectedNames.preview?.fails[0] === "fixture [redacted] [redacted] [redacted]");
    const credentialForms = [
      ["authorization scheme", "authorization: Bearer SYNTHETIC_CREDENTIAL_VALUE", "[redacted]"],
      ["self header", "x-fleet-self-token: SYNTHETIC_CREDENTIAL_VALUE", "[redacted]"],
      ["bare bearer", "Bearer SYNTHETIC_CREDENTIAL_VALUE", "[redacted]"],
      ["schemaless query", "/fixture/path?token=SYNTHETIC_CREDENTIAL_VALUE&next=okay", "/fixture/path?[redacted]&next=okay"],
      ["compressed IPv6", "fixture 2001:db8::1", "fixture [redacted]"],
      ["expanded IPv6", "fixture 2001:db8:0:0:0:0:0:1", "fixture [redacted]"],
      ["bracketed IPv6 URL", "[2001:db8::1]:8790/fixture", "[redacted]/fixture"],
      ["HTTP bracketed IPv6 URL", "http://[2001:db8::1]:8790/fixture", "[redacted]"],
      ["IPv4-mapped IPv6", "fixture ::ffff:192.0.2.1", "fixture [redacted]"],
    ] as const;
    const credentialScrub = functions.match(/name\.replace\([^\n]+/u)?.[0];
    if (!credentialScrub) throw new Error("workplaces credential mutation cannot resolve scrub expression");
    const ipv6Scrub = functions.split("\n").find((line) => line.includes(".replace(/") && line.includes("(?<!"))?.trim();
    const addressScrub = functions.split("\n").find((line) => line.trim().startsWith(".replace(/https?:"))?.trim();
    if (!ipv6Scrub || !addressScrub) throw new Error("workplaces redaction mutation cannot resolve address scrubs");
    const credentialMutant = functions.replace(credentialScrub, "name").replace(ipv6Scrub, "").replace(addressScrub, "");
    const protectsCredential = (code: string, input: string, expected: string) => {
      const f = compile(code, []);
      const value = f.checks(checkRepo, checkBranch, checkHead, [{ repo: checkRepo, branch: checkBranch, stage: "preview", head: checkHead,
        state: "red", at: 300, fails: [input] }], "audit-not-retained", []).preview?.fails[0];
      return value === expected && !value.includes("SYNTHETIC_CREDENTIAL_VALUE");
    };
    for (const [form, input, expected] of credentialForms) {
      check(`workplaces checks sensitive redaction removes value in ${form}`, protectsCredential(functions, input, expected));
      check(`workplaces checks redaction mutation exposes value in ${form}`, credentialMutant !== functions && !protectsCredential(credentialMutant, input, expected));
    }
    const unknownReason: Array<{ field: string; reason: string }> = [];
    const unknown = fixture.checks(checkRepo, checkBranch, checkHead, [{ ...localBase, state: null, reason: "job-unmeasured" }], "audit-not-retained", unknownReason);
    check("workplaces checks unknown result never becomes red or green", unknown.local === null && unknownReason.some((r) => r.reason === "job-unmeasured"));
    const auditFile = `${dir}/audit-fixture`;
    const auditRow = { repo: checkRepo, mainSha: checkHead, result: "green", at: 300, covers: [{ branch: checkBranch, mainAfter: checkHead, at: 100 }] };
    writeFileSync(auditFile, JSON.stringify(auditRow) + "\n");
    const readAudit = await compile(functions, [], false, undefined, false, undefined, { auditFile }).audits();
    check("workplaces checks reads retained audit fixture from its existing ledger", readAudit.rows.length === 1);
    writeFileSync(auditFile, "x".repeat(270_000) + "\n" + JSON.stringify(auditRow) + "\n");
    const boundedAudit = await compile(functions, [], false, undefined, false, undefined, { auditFile }).audits();
    check("workplaces checks audit byte cap keeps complete latest rows and names the history limit", boundedAudit.rows.length === 1 && boundedAudit.reason === "audit-history-capped");
    writeFileSync(auditFile, Array.from({ length: 210 }, () => JSON.stringify(auditRow)).join("\n") + "\n");
    const boundedRows = await compile(functions, [], false, undefined, false, undefined, { auditFile }).audits();
    check("workplaces checks audit row cap is observable", boundedRows.rows.length === 200 && boundedRows.reason === "audit-history-capped");
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
  await helperRepoChecks();
  await workplacesChecks();
  await instanceBandChecks();
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
  {
    const lane = await (await post("/api/lanes", { repo: REPO })).json() as { slot: number; cwd: string };
    const pointer = `${lane.cwd}/.git`, original = readFileSync(pointer);
    await stopSrv();
    await tmuxOut("kill-session", "-t", `=s${lane.slot}`);
    rmSync(`${lane.cwd}/AGENTS.override.md`);
    rmSync(`${lane.cwd}/CLAUDE.local.md`);
    writeFileSync(pointer, `gitdir: ${ROOT}/native-missing-git\n`);
    const before = readFileSync(`${ROOT}/server.log`).length;
    try {
      const unreadable = spawnSync("git", ["-C", lane.cwd, "rev-parse", "HEAD"], { encoding: "utf8" });
      check("native rules restart fixture has an unreadable lane HEAD", unreadable.status !== 0, unreadable.stderr.trim());
      await restartSrv();
      const api = await get("/api/sessions"), pane = await tmuxOut("has-session", "-t", `=s${lane.slot}`);
      const log = readFileSync(`${ROOT}/server.log`).subarray(before).toString("utf8");
      check("native rules restart keeps the server available and names the failed slot", api.ok
        && log.includes(`slot ${lane.slot}: session rules unavailable`)
        && log.includes("could not read lane HEAD for session rules"), `HTTP ${api.status}; named failure=${log.includes(`slot ${lane.slot}: session rules unavailable`)}`);
      check("native rules restart refuses a lane spawn without its rules", pane.code !== 0
        && !existsSync(`${lane.cwd}/AGENTS.override.md`) && !existsSync(`${lane.cwd}/CLAUDE.local.md`), `pane=${pane.code}`);
    } finally {
      writeFileSync(pointer, original);
      await post(`/api/slots/${lane.slot}/kill`, {}).catch(() => undefined);
    }
  }
  const emptyBranch = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
  for (const harness of ["claude", "codex", "pi", "pi-zai"] as const) {
    const lane = harness === "claude" ? emptyBranch
      : await (await post("/api/lanes", { repo: REPO, harness })).json() as { slot: number; cwd: string; branch: string };
    const agents = lane.cwd && existsSync(`${lane.cwd}/AGENTS.override.md`) ? readFileSync(`${lane.cwd}/AGENTS.override.md`, "utf8") : "";
    const local = lane.cwd && existsSync(`${lane.cwd}/CLAUDE.local.md`) ? readFileSync(`${lane.cwd}/CLAUDE.local.md`, "utf8") : "";
    const status = spawnSync("git", ["-C", lane.cwd ?? REPO, "status", "--porcelain"], { encoding: "utf8" });
    const ignored = spawnSync("git", ["-C", lane.cwd ?? REPO, "check-ignore", "AGENTS.override.md", "CLAUDE.local.md"], { encoding: "utf8" });
    check(`native lane start: ${harness} has its role file and exact Claude import`, agents.startsWith("## Rolle\n\n--- ROLLE --- Lane:")
      && agents.includes("/api/self/fleet-report") && local === "@AGENTS.override.md\n");
    check(`native lane start: ${harness} ignores both files and keeps git clean`, ignored.status === 0
      && ignored.stdout.trim() === "AGENTS.override.md\nCLAUDE.local.md" && status.status === 0 && status.stdout === "");
    if (harness !== "claude" && lane.slot) await post(`/api/slots/${lane.slot}/kill`, {});
  }

  for (const harness of ["claude", "codex", "pi", "pi-zai"] as const) {
    const marker = `native-lane-receipt-${harness}-${Date.now()}`;
    const task = await (await post("/api/tasks", { text: marker, queue: false, repo: ROOT })).json() as { task: { id: string } };
    const opened = await (await post(`/api/tasks/${task.task.id}/dispatch`, { harness })).json() as
      { ok?: boolean; slot?: number; error?: string };
    check(`native dispatch ${harness}: stand-in lane starts`, opened.ok === true && typeof opened.slot === "number", JSON.stringify(opened));
    if (typeof opened.slot !== "number") continue;
    if (harness === "claude" || harness === "codex") {
      await plantScreen(opened.slot, harness === "codex" ? ">_ OpenAI Codex (v0.159.0)\n› " : "❯", "native lane receipt");
    } else {
      await until(async () => {
        const frame = await tmuxOut("capture-pane", "-t", `s${opened.slot}`, "-p", "-J");
        return frame.code === 0 && frame.out.includes("────────")
          && (harness === "pi" || frame.out.includes("0.0%/1.0M"));
      }, { timeoutMs: 15000, what: `native ${harness} stand-in composer` });
    }
    type Part = { id: string; path: string | null; anchor: string | null; sha256: string | null; bytes: number | null; ort: string };
    type Receipt = { taskId?: string; branch?: string; sessionAgents?: { path: string; sha256: string; bytes: number; parts: Part[] } };
    let receipt: Receipt | undefined, prompt = "";
    await until(async () => {
      const rows = existsSync(`${ROOT}/context-receipts.jsonl`) ? readFileSync(`${ROOT}/context-receipts.jsonl`, "utf8")
        .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Receipt) : [];
      receipt = rows.findLast((row) => row.taskId === task.task.id);
      const prompts = await (await get("/api/prompts?limit=100")).json() as { prompts: { slot: number; text: string }[] };
      prompt = prompts.prompts.find((row) => row.slot === opened.slot && row.text.startsWith(marker))?.text ?? "";
      return !!receipt && !!prompt;
    }, { timeoutMs: 15000, what: `native ${harness} delivery receipt` });
    const sessions = await (await get("/api/sessions")).json() as { slots: { id: number; cwd: string | null }[] };
    const cwd = sessions.slots.find((row) => row.id === opened.slot)?.cwd;
    const agents = cwd ? readFileSync(`${cwd}/AGENTS.override.md`, "utf8") : "";
    const roleStart = agents.indexOf("## Rolle\n\n") + "## Rolle\n\n".length;
    const roleEnd = agents.indexOf("\n\n## Anleitung", roleStart);
    const role = agents.slice(roleStart, roleEnd);
    const meta = receipt?.sessionAgents, part = meta?.parts.find((row) => row.id === "role");
    check(`native dispatch ${harness}: first message carries the order and pointer without role, anchors or exit`,
      prompt.startsWith(`${marker}\n\nSession-Regeln: ./AGENTS.override.md`)
        && !prompt.includes("--- ROLLE ---") && !prompt.includes("ContextPlan v2 anchors") && !prompt.includes("HOW THIS LANE ENDS"));
    check(`native dispatch ${harness}: receipt measures the actual file and role part`, meta?.path === "AGENTS.override.md"
      && meta.bytes === Buffer.byteLength(agents) && meta.sha256 === createHash("sha256").update(agents).digest("hex")
      && part?.path === "server.ts" && part.anchor === "LANE_ROLE_CARD" && part.bytes === Buffer.byteLength(role)
      && part.sha256 === createHash("sha256").update(role).digest("hex") && part.ort === "box"
      && meta.parts.some((row) => row.id === "footer" && typeof row.bytes === "number" && row.bytes > 0));
    await post(`/api/slots/${opened.slot}/kill`, {});
    await post(`/api/tasks/${task.task.id}/delete`, {});
  }
  {
    const repo = mkdtempSync(`${ROOT}/native-detached-`);
    const git = (...args: string[]) => spawnSync("git", ["-C", repo, "-c", "user.name=e2e", "-c", "user.email=e2e@x", ...args], { encoding: "utf8" });
    const setup = [git("init", "-q"), git("commit", "-q", "--allow-empty", "-m", "native detached source"), git("checkout", "-q", "--detach")];
    const head = git("rev-parse", "HEAD").stdout.trim();
    const marker = "native-detached-lane-receipt";
    const task = await (await post("/api/tasks", { text: marker, queue: false, repo })).json() as { task: { id: string } };
    const started = await post(`/api/tasks/${task.task.id}/dispatch`, {});
    const opened = await started.json() as { ok?: boolean; slot?: number; error?: string };
    check("native detached source dispatches without inventing an integration base", setup.every((row) => row.status === 0)
      && started.ok && opened.ok === true && typeof opened.slot === "number", `${started.status} ${JSON.stringify(opened)}`);
    if (typeof opened.slot === "number") {
      await plantScreen(opened.slot, "❯", "native detached receipt");
      let receipt: { taskId?: string; head?: string } | undefined;
      await until(async () => {
        const rows = existsSync(`${ROOT}/context-receipts.jsonl`) ? readFileSync(`${ROOT}/context-receipts.jsonl`, "utf8")
          .trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as { taskId?: string; head?: string }) : [];
        receipt = rows.findLast((row) => row.taskId === task.task.id);
        return !!receipt;
      }, { timeoutMs: 15000, what: "native detached lane receipt" });
      const sessions = await (await get("/api/sessions")).json() as { slots: { id: number; cwd: string | null; worktree?: Record<string, unknown> | null }[] };
      const lane = sessions.slots.find((row) => row.id === opened.slot);
      const agents = lane?.cwd ? readFileSync(`${lane.cwd}/AGENTS.override.md`, "utf8") : "";
      const local = lane?.cwd ? readFileSync(`${lane.cwd}/CLAUDE.local.md`, "utf8") : "";
      const status = spawnSync("git", ["-C", lane?.cwd ?? repo, "status", "--porcelain"], { encoding: "utf8" });
      check("native detached receipt names the actual commit and keeps both native files clean", receipt?.head === head
        && !!lane?.worktree && !("base" in lane.worktree) && !("baseSha" in lane.worktree)
        && agents.includes("--- ROLLE --- Lane:") && agents.includes("HOW THIS LANE ENDS")
        && local === "@AGENTS.override.md\n" && status.status === 0 && status.stdout === "");
      await post(`/api/slots/${opened.slot}/kill`, {});
    }
    await post(`/api/tasks/${task.task.id}/delete`, {});
  }
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
      "  up) pwd > ti-cwd; printf '%s' \"$*\" > ti-args; printf '%s' \"${FLEET_TI_TARGET-unset}\" > ti-target ;;",
      "  down) rm -f ti-cwd ti-args ti-target ;;",
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
    // the band's target (ranke-notiz R11): the lane's RECORDED base reaches the script, and the lane
    // reads the same value as its own `lane.base` — the fallback testinstanz.sh#ti_measure uses by hand
    const recordedBase = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { worktree?: { base?: string }; selfToken?: string }> }).slots?.[String(emptyBranch.slot)];
    const laneSelf = await (await fetch(BASE + "/api/self", { headers: { "x-fleet-self-token": recordedBase?.selfToken ?? "" } }))
      .json().catch(() => ({})) as { lane?: { base?: string | null } | null };
    check("testinstanz up hands the lane's recorded base to the script as FLEET_TI_TARGET, and /api/self names it as lane.base",
      !!recordedBase?.worktree?.base && exists(`${emptyBranch.cwd}/ti-target`)
        && readFileSync(`${emptyBranch.cwd}/ti-target`, "utf8") === recordedBase.worktree.base
        && laneSelf.lane?.base === recordedBase.worktree.base,
      `recorded=${recordedBase?.worktree?.base} handed=${exists(`${emptyBranch.cwd}/ti-target`) ? readFileSync(`${emptyBranch.cwd}/ti-target`, "utf8") : "-"} self=${laneSelf.lane?.base}`);
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
  check("native lane rules remain present before a real script land", existsSync(`${landedBranch.cwd}/AGENTS.override.md`)
    && existsSync(`${landedBranch.cwd}/CLAUDE.local.md`));
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
    await restartSrv({ FLEET_AUTO_REVIEW_MS: "0" });
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
    await restartSrv({ FLEET_AUTO_REVIEW_MS: "0" });
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
    const parkBody = (await parkRes.json()) as { ok?: boolean; candidate?: RpCandidate; error?: string };
    const parked = parkBody.candidate;
    check("(review park) an accepted, clean lane parks as ONE candidate with rows, branch, head, base, report and deadline",
      parkRes.ok && !!parked && /^[0-9a-f]{12}$/.test(parked.id) && parked.branch === rpLane.branch && parked.head === rpHead
        && typeof parked.base === "string" && parked.base !== "" && /^[0-9a-f]{40}$/.test(parked.baseSha ?? "")
        && JSON.stringify([...parked.taskIds].sort()) === JSON.stringify([...rpIds].sort()) && parked.taskId === rpIds[0]
        && parked.reportId === rpReportId && parked.expiresAt - parked.parkedAt === 2 * 3_600_000,
      `${parkRes.status} ${parkBody.error ?? ""} ${JSON.stringify(parked)}`);
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
    await restartSrv({ FLEET_AUTO_REVIEW_MS: "0" });
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

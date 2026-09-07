// ctl.sh — the controller's mechanical verbs, measured against a live isolated instance.
//
// WHAT THIS MODULE IS FOR. ctl.sh adds no capability: every verb rides a route that already exists.
// What it does add is a LAYER THAT CAN BE WRONG about a route it did not change — a body field named
// `slot` where the route reads `target`, a short sha where the route wants a full object id, a
// rejection paraphrased into something that reads like success. Those are exactly the mistakes the
// script was written to stop a session from making, so they are what is asserted here: every check
// compares the script's own `--json` against the API or the state file it claims to be reporting,
// and every WRITE verb also has a check that its refusal is a refusal (non-zero exit AND the reason).
//
// The script under test is the one in the SOURCE tree, not in the staged instance: e2e-stage.sh
// copies the import closure of the entry files plus a fixed asset list, and ctl.sh is neither — it
// is reached through the same pointer home (`node_modules` → SRC) that the trail uses, and pointed
// at this instance through FLEET_CTL_URL / FLEET_CTL_TOKEN / FLEET_CTL_HOME. Those three env
// overrides exist for exactly this, and their absence is what a real controller runs with.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { BASE, REPO, ROOT, TOKEN, check, get, post } from "./harness";
import { openLane, setMergeMode, settleForMerge } from "./lane-helpers";
import { resolveSourceTree } from "./trail-emit";

interface CtlRun { code: number; out: string; err: string; json: unknown }

const gitOut = (dir: string, ...a: string[]): string =>
  (spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" }).stdout ?? "").trim();

const sourceTree = (): string | null => {
  let linked: string | null = null;
  try { linked = readlinkSync(`${ROOT}/node_modules`); } catch { /* direct checkout */ }
  return resolveSourceTree(ROOT, linked,
    (c) => gitOut(c, "rev-parse", "--is-inside-work-tree") === "true");
};

const stateFile = (): Record<string, unknown> =>
  JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as Record<string, unknown>;

// a slot's own scoped credential, out of the persisted state — polled for the shape, because
// openSlot queues the save before it awaits the pane spawn (the idiom land-durability.ts states).
const selfTokenOf = async (slot: number): Promise<string> => {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (stateFile().slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
};

export async function run(): Promise<void> {
  const SRC = sourceTree();
  const CTL = SRC ? `${SRC}/ctl.sh` : "";
  // THE PROBE FAILS AS ITSELF. A missing script must not be reported as a broken verb — every check
  // below would then accuse ctl.sh of behaviour nobody measured (CLAUDE.md, "eine Sonde, die nicht
  // laufen konnte, muss als SIE SELBST scheitern").
  const reachable = !!CTL && existsSync(CTL);
  check("ctl setup: the source tree resolves and carries an executable ctl.sh",
    reachable, `src=${SRC ?? "unresolved"} ctl=${CTL || "-"}`);
  if (!reachable) return;

  // the receiver: an ordinary non-lane session, which is what a controller IS. It owns the self
  // token every self verb below runs with.
  const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => s.cwd === null)?.id ?? 0;
  const opened = free ? await post(`/api/slots/${free}/open`, { cwd: REPO }) : null;
  check("ctl setup: a non-lane receiver session is open", !!opened?.ok, `slot ${free} ${opened?.status}`);
  if (!free || !opened?.ok) return;
  const selfTok = await selfTokenOf(free);
  check("ctl setup: the receiver's self token is persisted", /^[0-9a-f]{32}$/.test(selfTok),
    `${selfTok.length} chars`);
  if (!/^[0-9a-f]{32}$/.test(selfTok)) return;

  const LOCK = `${ROOT}/ctl-lock-probe`;   // NEVER /tmp/fleet-e2e.lock — a probe owns its own lock
  const env = {
    FLEET_CTL_URL: BASE,
    FLEET_CTL_TOKEN: TOKEN,
    FLEET_CTL_HOME: ROOT,
    FLEET_SELF_TOKEN: selfTok,
    FLEET_SELF_SLOT: String(free),
    FLEET_CTL_POLL_SEC: "1",
    FLEET_CTL_WAIT_MAX_SEC: "120",
    FLEET_SUITE_LOCK: LOCK,
  };
  const ctl = async (args: string[], extra: Record<string, string> = {}): Promise<CtlRun> => {
    const p = Bun.spawn([CTL, ...args], {
      cwd: SRC!, stdout: "pipe", stderr: "pipe",
      env: { ...process.env, ...env, ...extra } as Record<string, string>,
    });
    const out = await new Response(p.stdout).text();
    const err = await new Response(p.stderr).text();
    const code = await p.exited;
    let json: unknown = null;
    if (args.includes("--json")) { try { json = JSON.parse(out); } catch { json = null; } }
    return { code, out, err, json };
  };

  // === usage ====================================================================================
  // The verb list is what e2e/pins.ts holds against docs/controller.md, so the usage block has to
  // actually carry it — a pin over a list nothing prints would guard a doc against nothing.
  const usage = await ctl([]);
  const VERBS = ["merges", "lock", "ctx", "report", "watch", "events", "land", "dispatch",
    "wait merge", "wait change"];
  const missing = VERBS.filter((v) => !usage.out.includes(`  ${v}`));
  check("ctl usage: a bare ./ctl.sh prints all ten verbs and exits 0",
    usage.code === 0 && missing.length === 0, `exit ${usage.code} missing=[${missing.join(", ")}]`);
  const bogus = await ctl(["nosuchverb"]);
  check("ctl usage: an unknown verb exits 2 and names itself",
    bogus.code === 2 && bogus.err.includes('unknown verb "nosuchverb"'), `exit ${bogus.code}`);

  // === merges (before any land of ours) =========================================================
  const mergesBefore = await ctl(["merges", "--json"]);
  const stBefore = stateFile().merges as Record<string, { status: string; landed: boolean; verify?: unknown }> ?? {};
  const rowsBefore = (mergesBefore.json as { rows?: { slot: number; status: string; hasVerify: boolean }[] })?.rows ?? [];
  const agreeBefore = rowsBefore.length === Object.keys(stBefore).length
    && rowsBefore.every((r) => stBefore[String(r.slot)]?.status === r.status
      && (!!stBefore[String(r.slot)]?.verify) === r.hasVerify);
  check("ctl merges: every row it prints is the fleet.json row for that slot, status and hasVerify",
    agreeBefore, `ctl=${rowsBefore.length} state=${Object.keys(stBefore).length} exit=${mergesBefore.code}`);
  check("ctl merges: the live half is asked, not inferred (liveKnown with an owner token)",
    (mergesBefore.json as { liveKnown?: boolean })?.liveKnown === true
      && rowsBefore.every((r) => (r as { running?: boolean | null }).running !== null),
    JSON.stringify((mergesBefore.json as { liveKnown?: boolean })?.liveKnown));

  // === ctx ======================================================================================
  // `null` is an ANSWER ("Fleet cannot tell"), never 0 — so the assertion is AGREEMENT with the
  // route, in whichever of the two states this instance's harness leaves the slot.
  const ctxRun = await ctl(["ctx", String(free), "--json"]);
  const apiCtx = ((await (await get("/api/sessions")).json()) as
    { slots: { id: number; ctx: { pct: number; usedTokens: number; windowTokens: number } | null }[] })
    .slots.find((s) => s.id === free)?.ctx ?? null;
  const ctlCtx = (ctxRun.json as { ctx?: unknown })?.ctx ?? null;
  check("ctl ctx: the fill it reports is the fill /api/sessions serves for that slot",
    JSON.stringify(ctlCtx) === JSON.stringify(apiCtx),
    `ctl=${JSON.stringify(ctlCtx)} api=${JSON.stringify(apiCtx)}`);
  check("ctl ctx: an unmeasurable fill exits 1 and a measured one exits 0 — never a silent 0%",
    ctxRun.code === (apiCtx === null ? 1 : 0), `exit ${ctxRun.code} ctx=${JSON.stringify(apiCtx)}`);
  const ctxGone = await ctl(["ctx", "999", "--json"]);
  check("ctl ctx: a slot this fleet does not have is refused, not answered",
    ctxGone.code === 1 && ctxGone.err.includes("no slot 999"), `exit ${ctxGone.code}`);

  // === land --wait ==============================================================================
  // A clean lane (its own file) never consults the merge agent, so this is the ordinary green land.
  // The idle gate can still refuse the FIRST attempt on a freshly-spawned pane (`status: "blocked"`
  // — the pane's own shell prompt is output), which is a FIXTURE fact, not a ctl.sh fact: retry the
  // way lane-helpers#driveMerge does, so a refused first try never reads as a broken verb.
  const landRetry = async (slot: number, args: string[]): Promise<CtlRun> => {
    let r = await ctl(["land", String(slot), ...args]);
    // only the IDLE-GATE refusal is retried; a conflict verdict is a result, not a flaky start
    for (let i = 0; i < 8 && r.code !== 0 && r.out.includes("actively working right now"); i++) {
      await settleForMerge(slot);
      await Bun.sleep(800);
      r = await ctl(["land", String(slot), ...args]);
    }
    return r;
  };
  const la = await openLane(REPO, "ctlland");
  await settleForMerge(la.slot);
  const mainBefore = gitOut(REPO, "rev-parse", "main");
  const landed = await landRetry(la.slot, ["--wait", "--json"]);
  const lj = landed.json as {
    gone?: boolean; last?: { status: string; landed: boolean; verify?: { ok: boolean | null; ms?: number } } | null;
    mainAfter?: string | null; mainAfterFrom?: string | null;
    auditWatch?: { id?: string; error?: string | null } | null;
  } | null;
  const mainAfter = gitOut(REPO, "rev-parse", "main");
  check("ctl land --wait: it lands the lane and main actually moved",
    landed.code === 0 && mainAfter !== mainBefore && mainAfter.length === 40,
    `exit ${landed.code} ${mainBefore.slice(0, 8)} -> ${mainAfter.slice(0, 8)}`);
  check("ctl land --wait: the mainAfter it reports is the sha main now carries, and it names its source",
    lj?.mainAfter === mainAfter && typeof lj?.mainAfterFrom === "string",
    `ctl=${lj?.mainAfter?.slice(0, 12) ?? "null"} git=${mainAfter.slice(0, 12)} from=${lj?.mainAfterFrom ?? "-"}`);
  // …and a GREEN land leaves NO row behind: server.ts deletes mergeLast[slot] with the lane it
  // landed. So the honest assertion is that ctl reported the terminal fact AND that the state file
  // now has nothing for that slot — the pair is what makes `merges` a register of UNFINISHED lands
  // rather than a land history somebody could read an empty map as contradicting.
  const persistedAfter = (stateFile().merges as Record<string, unknown>)?.[String(la.slot)];
  check("ctl land --wait: it names the terminal fact, and the landed slot leaves no verdict row behind",
    (lj?.gone === true || lj?.last?.landed === true) && persistedAfter === undefined,
    `gone=${lj?.gone} landed=${lj?.last?.landed} row=${JSON.stringify(persistedAfter ?? null)}`);
  // TIER 2 IS OFF IN THIS INSTANCE (FLEET_POSTLAND_AUDIT_CMD unset — server.ts, "DEFAULT OFF"), so
  // the audit watch CANNOT be armed. What is asserted is that the script says so instead of
  // reporting a watch it does not hold: a claimed-but-absent return path is the failure mode.
  check("ctl land --wait: with tier 2 off it reports the audit watch as REFUSED, never as armed",
    !!lj?.auditWatch && typeof lj.auditWatch.error === "string"
      && lj.auditWatch.error.includes("no persisted, queued, or running audit exists")
      && lj.auditWatch.id === undefined,
    JSON.stringify(lj?.auditWatch ?? null).slice(0, 200));

  // === merges, over a land that did NOT finish ==================================================
  // The sensor is only worth anything on an UNFINISHED land, so one is produced deliberately: a
  // lane whose rebase conflicts reaches the fake merge agent, whose default mode answers `blocked`
  // (e2e-isolated.sh). That verdict IS persisted and the lane stays alive — the exact shape a
  // controller must see before starting another land.
  await setMergeMode("blocked");
  // ORDER IS THE FIXTURE. The lane must branch FIRST and main must move AFTERWARDS, or the rebase
  // is a fast-forward and no agent is ever consulted — openLane already commits `ctlconflict.txt`
  // on the lane side, so main adding the same path with different content is the conflict.
  const lc = await openLane(REPO, "ctlconflict");
  await Bun.write(`${REPO}/ctlconflict.txt`, "main side\n");
  spawnSync("git", ["-C", REPO, "add", "ctlconflict.txt"]);
  spawnSync("git", ["-C", REPO, "commit", "-qm", "ctl conflict seed on main"]);
  check("ctl setup: the lane and main both carry a conflicting ctlconflict.txt",
    gitOut(REPO, "log", "--oneline", "-1").includes("ctl conflict seed on main")
      && gitOut(lc.cwd, "log", "--oneline", "-1").includes("ctlconflict lane work"),
    `main=${gitOut(REPO, "log", "--oneline", "-1")} lane=${gitOut(lc.cwd, "log", "--oneline", "-1")}`);
  await settleForMerge(lc.slot);
  const blockedLand = await landRetry(lc.slot, ["--wait", "--json"]);
  const bj = blockedLand.json as { last?: { status: string; landed: boolean } | null } | null;
  check("ctl setup: the conflicting lane produced a persisted, NOT-landed verdict",
    bj?.last?.landed === false && typeof bj.last.status === "string",
    `exit ${blockedLand.code} ${JSON.stringify(bj?.last ?? null).slice(0, 200)}`);
  const mergesAfter = await ctl(["merges", "--json"]);
  const rowsAfter = (mergesAfter.json as
    { rows?: { slot: number; status: string; landed: boolean; hasVerify: boolean; verify: string; running: boolean | null }[] })?.rows ?? [];
  const stAfter = stateFile().merges as Record<string, { status: string; landed: boolean; verify?: unknown }> ?? {};
  const stuck = rowsAfter.find((r) => r.slot === lc.slot);
  check("ctl merges: the unfinished land is a row, with the state file's own status and landed=no",
    !!stuck && stuck.status === stAfter[String(lc.slot)]?.status && stuck.landed === false
      && stuck.hasVerify === !!stAfter[String(lc.slot)]?.verify
      && ["ok", "FAILED", "skipped", "timedOut", "waitedOut", "none"].includes(stuck.verify),
    `ctl=${JSON.stringify(stuck ?? null)} state=${JSON.stringify(stAfter[String(lc.slot)] ?? null).slice(0, 160)}`);
  check("ctl merges: a settled-but-unlanded verdict is NOT counted as in flight — exit 0, running=no",
    mergesAfter.code === 0 && stuck?.running === false,
    `exit ${mergesAfter.code} running=${stuck?.running}`);
  await post(`/api/slots/${lc.slot}/kill`, {});

  // === watch merge + wait merge =================================================================
  const lb = await openLane(REPO, "ctlwatch");
  await settleForMerge(lb.slot);
  const started = await landRetry(lb.slot, ["--json"]);
  check("ctl land (no --wait): the POST is made and reported without blocking",
    started.code === 0, `exit ${started.code} ${started.out.slice(0, 200)}`);
  const wMerge = await ctl(["watch", "merge", String(lb.slot), "--json"]);
  const wj = wMerge.json as { ok?: boolean; watch?: { id: string; kind?: string; idleSec: number; armed: boolean } } | null;
  const mine = ((await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
    { watches: { id: string; target?: number; idleSec: number }[] }).watches;
  check("ctl watch merge: the watch it reports exists on the receiver, on the SUBJECT SLOT (`target`, not `slot`)",
    wMerge.code === 0 && !!wj?.watch?.id && mine.some((w) => w.id === wj.watch!.id && w.target === lb.slot),
    `${wMerge.code} ${JSON.stringify(wj?.watch ?? null)} mine=${JSON.stringify(mine.map((w) => [w.id, w.target]))}`);
  check("ctl watch: idleSec defaults to 0 — the value that actually delivers to a working session",
    wj?.watch?.idleSec === 0 && mine.find((w) => w.id === wj?.watch?.id)?.idleSec === 0,
    `ctl=${wj?.watch?.idleSec} server=${mine.find((w) => w.id === wj?.watch?.id)?.idleSec}`);
  const waited = await ctl(["wait", "merge", String(lb.slot), "--json"]);
  const waitJson = waited.json as { gone?: boolean; last?: { landed: boolean } | null } | null;
  check("ctl wait merge: it returns only on the terminal fact, and names it",
    waited.code === 0 && (waitJson?.gone === true || typeof waitJson?.last?.landed === "boolean"),
    `exit ${waited.code} ${JSON.stringify(waitJson).slice(0, 200)}`);

  // === watch audit — both refusals ==============================================================
  const badSha = await ctl(["watch", "audit", "deadbeefdeadbeef", "--repo", REPO, "--json"]);
  check("ctl watch audit: a sha that names no commit is stopped HERE, before a request is built",
    badSha.code === 2 && badSha.err.includes("names no commit in"), `exit ${badSha.code} ${badSha.err.slice(0, 160)}`);
  const realSha = gitOut(REPO, "rev-parse", "main");
  const noAudit = await ctl(["watch", "audit", realSha, "--repo", REPO, "--json"]);
  check("ctl watch audit: the route's own refusal is passed through VERBATIM, and exits non-zero",
    noAudit.code === 1 && noAudit.err.includes("no persisted, queued, or running audit exists for that concrete land"),
    `exit ${noAudit.code} ${noAudit.err.slice(0, 200)}`);

  // === dispatch + report + events ===============================================================
  // PENDING, not queued, and that is the point of the verb: the unattended tick only ever takes a
  // QUEUED row, so a pending one can be started through this door alone — and no tick can race the
  // check by starting the fixture out from under it.
  const mkTask = async (text: string): Promise<string> => {
    const r = await post("/api/tasks", { text, kind: "auftrag", repo: REPO });
    return ((await r.json()) as { task?: { id: string } }).task?.id ?? "";
  };
  const taskId = await mkTask("ctl.sh probe row — dispatched by hand");
  const capRow = await mkTask("ctl.sh probe row — never started, only refused");
  check("ctl setup: two pending auftrag rows exist (one to start, one to be refused)",
    !!taskId && !!capRow, `${taskId} ${capRow}`);
  if (taskId && capRow) {
    const disp = await ctl(["dispatch", taskId, "--json"]);
    const dj = disp.json as { ok?: boolean; response?: { slot?: number }; openLanes?: number; cap?: number } | null;
    check("ctl dispatch: the row is started and the response carries the slot it opened",
      disp.code === 0 && dj?.ok === true && typeof dj.response?.slot === "number",
      `exit ${disp.code} ${JSON.stringify(dj).slice(0, 220)}`);
    const laneSlot = dj?.response?.slot ?? 0;

    // …and now one row IS `sent`, so a cap of 1 must stop the second row before any POST is made.
    const overCap = await ctl(["dispatch", capRow, "--json"], { FLEET_DISPATCH_MAX_LANES: "1" });
    const oj = overCap.json as { ok?: boolean; refused?: string; openLanes?: number; cap?: number } | null;
    check("ctl dispatch: over FLEET_DISPATCH_MAX_LANES it refuses before the POST, with the count and the cap",
      overCap.code === 1 && oj?.refused === "lane cap" && oj.cap === 1 && (oj.openLanes ?? 0) >= 1
        && overCap.out.includes("--force"),
      `exit ${overCap.code} ${JSON.stringify(oj).slice(0, 220)}`);

    if (laneSlot) {
      // receiver evidence for the report: a watch on that exact lane occupant (server.ts,
      // clarificationReceiverFor — a program-less lane's only evidence is a lane watch).
      const wLane = await ctl(["watch", "lane", String(laneSlot), "--json"]);
      check("ctl watch lane: the subscription that makes this receiver the lane's coordinator is armed",
        wLane.code === 0 && (wLane.json as { watch?: { armed: boolean } })?.watch?.armed === true,
        `exit ${wLane.code} ${wLane.err.slice(0, 200)}`);
      const laneTok = await selfTokenOf(laneSlot);
      const filed = await fetch(`${BASE}/api/self/fleet-report`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": laneTok },
        body: JSON.stringify({ status: "complete", text: "ctl.sh probe report\nline two\n" }),
      });
      const fj = (await filed.json()) as { ok?: boolean; report?: { id: string; status: string } };
      check("ctl setup: the task lane files a fleet-report to this receiver",
        filed.ok && !!fj.report?.id, `${filed.status} ${JSON.stringify(fj).slice(0, 200)}`);

      if (fj.report?.id) {
        const rep = await ctl(["report", taskId, "--json"]);
        const rj = rep.json as { report?: { id: string; status: string; provenance: { taskId: string }; worker: { slot: number } } } | null;
        check("ctl report: it finds the newest report for THAT task and reports its id, status and worker",
          rep.code === 0 && rj?.report?.id === fj.report.id && rj.report.status === "complete"
            && rj.report.provenance.taskId === taskId && rj.report.worker.slot === laneSlot,
          `exit ${rep.code} ${JSON.stringify(rj?.report ?? null).slice(0, 220)}`);
        const repText = await ctl(["report", taskId]);
        check("ctl report: the plain rendering names the undecided verdict rather than omitting it",
          repText.code === 0 && repText.out.includes("decision UNDECIDED") && repText.out.includes("ctl.sh probe report"),
          repText.out.slice(0, 240));
        const repMissing = await ctl(["report", "0000000000000000"]);
        check("ctl report: a task with no visible report exits 1 and says how many it did see",
          repMissing.code === 1 && repMissing.err.includes("report(s) in total"),
          `exit ${repMissing.code} ${repMissing.err.slice(0, 160)}`);

        // === events ============================================================================
        const ev = await ctl(["events", "--json"]);
        const evJson = ev.json as { events?: { id: string; kind: string; status: string }[] } | null;
        const apiSelf = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
          { events: { id: string; kind: string; status: string }[] };
        // ids and kinds, NOT status: a status moves on the server's own tick (pending → delivered)
        // and comparing it across two reads would be a race dressed as an assertion. The status is
        // checked as a VALUE instead — it must be one the state machine actually has.
        const STATUSES = ["pending", "send-uncertain", "delivered", "acknowledged", "receiver-gone",
          "subject-gone", "inbox", "blocked"];
        check("ctl events: the list is exactly the receiver's own events, by id and kind",
          ev.code === 0
            && JSON.stringify((evJson?.events ?? []).map((e) => [e.id, e.kind]))
              === JSON.stringify(apiSelf.events.map((e) => [e.id, e.kind]))
            && (evJson?.events ?? []).length > 0
            && (evJson?.events ?? []).every((e) => STATUSES.includes(e.status)),
          `ctl=${JSON.stringify((evJson?.events ?? []).map((e) => [e.id, e.kind, e.status]))} api=${JSON.stringify(apiSelf.events.map((e) => [e.id, e.kind]))}`);

        // Ack is only accepted on `delivered` / `send-uncertain`; a pending row was never offered.
        // So the precondition is polled and checked AS ITS OWN ROW — an ack check that ran with
        // nothing ackable would be green over nothing.
        let ackable = 0;
        for (let i = 0; i < 120; i++) {
          const s = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
            { events: { status: string }[] };
          ackable = s.events.filter((e) => e.status === "delivered" || e.status === "send-uncertain").length;
          if (ackable > 0) break;
          await Bun.sleep(250);
        }
        check("ctl events setup: at least one event reached an acknowledgeable state",
          ackable > 0, `${ackable} ackable`);
        if (ackable > 0) {
          const acked = await ctl(["events", "--ack", "--json"]);
          const aj = acked.json as { acked?: { id: string; ok: boolean }[] } | null;
          const after = (await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": selfTok } })).json()) as
            { events: { id: string; status: string }[] };
          const leftOpen = after.events.filter((e) => e.status === "delivered" || e.status === "send-uncertain");
          // the INVARIANT, not the count: whatever was ackable when the verb ran is closed, every
          // ack succeeded, and nothing acknowledgeable is left holding delivery budget. A `===
          // ackable` comparison would race the tick that can make one more event ackable meanwhile.
          check("ctl events --ack: every acknowledgeable event is closed, and none is left holding budget",
            acked.code === 0 && (aj?.acked ?? []).length >= 1
              && (aj?.acked ?? []).every((a) => a.ok) && leftOpen.length === 0,
            `acked=${JSON.stringify(aj?.acked ?? [])} left=${leftOpen.length}`);
        }
      }
      await post(`/api/slots/${laneSlot}/kill`, {});
    }
  }

  // === lock =====================================================================================
  // A PRIVATE lock path, never the machine-wide one: this suite is itself holding /tmp/fleet-e2e.lock
  // through e2e-stage.sh, and a probe that reaped its own harness's mutex would be the worst
  // possible test. Three states are exercised, and the reap is refused in two of them.
  const dead = Bun.spawn(["true"]);
  const deadPid = dead.pid;
  await dead.exited;
  const writeLock = (pid: string | null, birth: string | null): void => {
    rmSync(LOCK, { recursive: true, force: true });
    mkdirSync(LOCK, { recursive: true });
    if (pid !== null) writeFileSync(`${LOCK}/pid`, `${pid}\n`);
    if (birth !== null) writeFileSync(`${LOCK}/birth`, `${birth}\n`);
  };

  rmSync(LOCK, { recursive: true, force: true });
  const lFree = await ctl(["lock", "--json"]);
  check("ctl lock: no directory is FREE and exits 0",
    lFree.code === 0 && (lFree.json as { state?: string })?.state === "free",
    `exit ${lFree.code} ${JSON.stringify(lFree.json).slice(0, 160)}`);

  writeLock(null, null);
  const lParked = await ctl(["lock", "--reap", "--json"]);
  const pj = lParked.json as { state?: string; reaped?: boolean; reapRefused?: string | null } | null;
  check("ctl lock --reap: a pid-LESS dir is PARKED and is never reaped, however long it sits",
    lParked.code === 1 && pj?.state === "parked" && pj.reaped === false
      && (pj.reapRefused ?? "").includes("not stale") && existsSync(LOCK),
    JSON.stringify(pj).slice(0, 220));

  const myBirth = (spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)],
    { encoding: "utf8", env: { ...process.env, LC_ALL: "C" } }).stdout ?? "").trim().replace(/\s+/g, " ");
  writeLock(String(process.pid), myBirth);
  const lHeld = await ctl(["lock", "--reap", "--json"]);
  const hj = lHeld.json as { state?: string; reaped?: boolean; birthState?: string } | null;
  check("ctl lock --reap: a live holder whose birth fingerprint MATCHES is HELD and survives the reap",
    lHeld.code === 1 && hj?.state === "held" && hj.birthState === "matched" && hj.reaped === false
      && existsSync(LOCK),
    `${JSON.stringify(hj).slice(0, 200)} birth=${myBirth ? "measured" : "UNMEASURABLE"}`);

  writeLock(String(deadPid), myBirth);
  const lStale = await ctl(["lock", "--json"]);
  check("ctl lock: a recorded pid that is gone reads STALE, and says nothing is running",
    (lStale.json as { state?: string })?.state === "stale"
      && (lStale.json as { holderAlive?: boolean })?.holderAlive === false,
    JSON.stringify(lStale.json).slice(0, 200));
  const lReap = await ctl(["lock", "--reap", "--json"]);
  const rj2 = lReap.json as { reaped?: boolean } | null;
  check("ctl lock --reap: the stale lock is removed and the verb then reports the machine as free",
    lReap.code === 0 && rj2?.reaped === true && !existsSync(LOCK),
    `exit ${lReap.code} ${JSON.stringify(rj2)} exists=${existsSync(LOCK)}`);
  rmSync(LOCK, { recursive: true, force: true });

  // === credentials ==============================================================================
  // Every verb must name the credential it is missing rather than failing as the route.
  const noToken = await ctl(["ctx", String(free)], { FLEET_CTL_TOKEN: "", FLEET_TOKEN: "", FLEET_CTL_HOME: "/nonexistent-ctl-home" });
  check("ctl credentials: a verb with no owner token exits 2 and names FLEET_CTL_TOKEN",
    noToken.code === 2 && noToken.err.includes("FLEET_CTL_TOKEN"), `exit ${noToken.code} ${noToken.err.slice(0, 160)}`);
  const noSelf = await ctl(["events"], { FLEET_SELF_TOKEN: "" });
  check("ctl credentials: a self verb with no self token exits 2 and names FLEET_SELF_TOKEN",
    noSelf.code === 2 && noSelf.err.includes("FLEET_SELF_TOKEN"), `exit ${noSelf.code} ${noSelf.err.slice(0, 160)}`);

  await post(`/api/slots/${free}/kill`, {});
}

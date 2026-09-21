// e2e for the PER-REPO AUDIT COMMAND (server.ts, grep `auditCmdFor`) — the repo-worker `audit`.
//
// WHY IT EXISTS (measured 2026-09-02): FLEET_POSTLAND_AUDIT_CMD is one command for the whole
// deployment, and it is fleet's own suite. Its watchdog guard exits 42 outside claude-fleet, so
// every land in any other repo produced `unknown: the audit command declined to run (exit 42)` —
// tier 2 was blind everywhere but here, even for a repo with a verify of its own. The repo-worker
// key `audit` stores that repo's executable next to `commitMsg`, through the same owner-only door
// and the same validation, and `auditCmdFor` resolves it at every decision site of tier 2.
//
// Sibling of e2e/helper-portal.ts by construction: it needs a server booted WITH a tier-2 command
// (and, for two sections, one booted WITHOUT), so it lives in the postland harness and runs after
// its absolute-count sections. Every count here is RELATIVE, per repo, by basename.
import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BASE, check, get, paneEnv, post, restartSrv, tmuxOut } from "./harness";
import { driveMerge, openLane, seedRepo, settleForMerge, type Lane } from "./lane-helpers";

interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; cmdSource?: string; exitCode: number | null; out: string;
  fails?: string[];
  checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
  // the two rails the audit route JOINS onto the row it serves — (RW.10) reads both
  ping?: { status?: string; lastResult?: string; slot?: number };
  adjudication?: { verdict?: string };
}
interface Workers { keys?: string[]; workers?: Record<string, Record<string, string>> }
interface LiveView {
  postLandAuditLive?: {
    running: { repo: string | null; covers: string[] } | null;
    waiting: { repo: string; branch: string }[];
  } | null;
}
interface HelperJobs { configured: boolean; jobs: { id: string; repo: string; localRunning: boolean }[] }

export async function run(h: {
  REPO: string;
  DIR: string;
  setAuditMode: (m: string) => Promise<number>;
  killSrv: () => Promise<void>;
  startSrv: (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }) => Promise<boolean>;
  auditRows: () => Promise<Row[]>;
}): Promise<void> {
  const { REPO, DIR, setAuditMode, killSrv, startSrv, auditRows } = h;
  const base = (p: string): string => p.split("/").pop() ?? p;
  const headOf = (repo: string): string => spawnSync("git", ["-C", repo, "rev-parse", "main"]).stdout.toString().trim();

  // THE FOREIGN REPO and ITS OWN VERIFY. The stand-in answers in the audit's currency (exit code +
  // PASS lines) and leaves one evidence line per run in its own log — TWO PASS lines, so a row it
  // produced is distinguishable from the env stand-in's (one) by `checks.ran` alone.
  const RW = `${REPO}-rwaudit`;
  await seedRepo(RW);
  const RW_CMD = `${DIR}/fakeaudit-rw`;
  const RW_MODE = `${DIR}/auditmode-rw`;
  const RW_LOG = `${DIR}/auditruns-rw`;
  await Bun.write(RW_CMD, `#!/bin/sh
d="$(dirname "$0")"
mode="$(cat "$d/auditmode-rw" 2>/dev/null || echo green)"
echo "run pwd=$PWD files=$(ls | tr '\\n' ',') recur=[\${FLEET_POSTLAND_AUDIT_CMD:-}] mode=$mode" >> "$d/auditruns-rw"
case "$mode" in
  decline) echo "verify skipped: this repo-worker declines that tree"; exit 42 ;;
  red)
    echo "PASS  repo-worker verify: tree builds"
    echo "FAIL  repo-worker verify: unit tests  (2 of 9 assertions)"
    echo "FAIL  repo-worker verify: (parenthesised) name  (detail with  (nested) parens)"
    echo "2 FAILURES"
    exit 1
    ;;
  redmany)
    i=1
    while [ "$i" -le 60 ]; do echo "FAIL  many $i"; i=$((i + 1)); done
    echo "60 FAILURES"
    exit 1
    ;;
  slow) sleep 6 ;;
esac
echo "PASS  repo-worker verify: tree builds"
echo "PASS  repo-worker verify: unit tests"
echo "ALL PASS"
exit 0
`);
  chmodSync(RW_CMD, 0o755);
  const setRwMode = (m: string): Promise<number> => Bun.write(RW_MODE, m);
  const rwLog = (): string[] => {
    try { return readFileSync(RW_LOG, "utf8").split("\n").filter(Boolean); } catch { return []; }
  };
  const ENV_CMD = process.env.FLEET_POSTLAND_AUDIT_CMD ?? "";

  const rowsFor = async (repo: string): Promise<Row[]> => (await auditRows()).filter((r) => base(r.repo) === base(repo));
  // newest-first; wait until `repo` has more rows than `had`, return the newest
  const waitNewRow = async (repo: string, had: number, timeoutMs = 60_000): Promise<Row | null> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const rows = await rowsFor(repo);
      if (rows.length > had) return rows[0] ?? null;
      if (Date.now() >= deadline) return null;
      await Bun.sleep(200);
    }
  };
  const workers = async (): Promise<Workers> => (await (await get("/api/repo-workers")).json()) as Workers;
  const setWorker = (repo: string, cmd: string, headers?: Record<string, string>): Promise<Response> =>
    post("/api/repo-worker", { repo, worker: "audit", cmd }, headers);
  const live = async (): Promise<LiveView> => (await (await get("/api/sessions")).json()) as LiveView;
  const waitLive = async (want: (l: LiveView) => boolean, timeoutMs = 30_000): Promise<LiveView> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const l = await live();
      if (want(l) || Date.now() >= deadline) return l;
      await Bun.sleep(150);
    }
  };
  const QUEUE_FILE = `${DIR}/post-land-audit-queue.json`;
  const queueFile = (): Record<string, { covers: { branch: string }[] }> | null => {
    try { return JSON.parse(readFileSync(QUEUE_FILE, "utf8")) as Record<string, { covers: { branch: string }[] }>; }
    catch { return null; }
  };
  const queueHas = (repo: string, branch: string): boolean =>
    Object.entries(queueFile() ?? {}).some(([r, q]) => base(r) === base(repo) && q.covers.some((c) => c.branch === branch));
  const land = (ln: Lane): Promise<{ gone: boolean }> => driveMerge(ln, ln.branch);

  // ===== (RW.0) a clean tier-2 server: env command set, no ping, no helper grace ===================
  await killSrv();
  check("(RW) setup: the server is up with the env audit command and nothing else", await startSrv({ audit: true }));
  await setAuditMode("green");
  await setRwMode("green");

  // ===== (RW.1) THE KEY EXISTS, THE VALUE IS STORED, THE DOOR IS THE SAME ==========================
  check("(RW) `audit` is a configurable repo-worker key — 'no override' is distinguishable from 'never wired up'",
    ((await workers()).keys ?? []).includes("audit"), JSON.stringify((await workers()).keys));
  const setRes = await setWorker(RW, RW_CMD);
  const setJ = (await setRes.json()) as { ok?: boolean; repo?: string; cmd?: string | null };
  check("(RW) the owner stores a repo's own audit executable", setRes.ok && setJ.ok === true && setJ.cmd === RW_CMD,
    `${setRes.status} ${JSON.stringify(setJ)}`);
  const canon = setJ.repo ?? "";
  check("(RW) …under the canonical repo path, readable back",
    !!canon && (await workers()).workers?.[canon]?.audit === RW_CMD, JSON.stringify((await workers()).workers));
  for (const [cmd, why] of [
    [`${RW_CMD} --fast`, "a command line with arguments"],
    ["e2e/fakeaudit-rw", "a relative path"],
    [`${DIR}/no-such-audit`, "a path that does not exist"],
    [`${DIR}/../fakeaudit-rw`, "a traversing path"],
  ] as const) {
    const r = await setWorker(RW, cmd);
    check(`(RW) validated like commitMsg — rejects ${why}`, r.status === 400, `${r.status} ${(await r.text()).slice(0, 120)}`);
  }
  check("(RW) …and every rejection left the stored value UNCHANGED",
    (await workers()).workers?.[canon]?.audit === RW_CMD, JSON.stringify((await workers()).workers?.[canon]));

  // OWNER-ONLY BY POSITION. The value decides what gets EXECUTED over the repo's contents, so a
  // lane's own credential, the steward's and no credential at all must all bounce off tokenGate.
  const rwA = await openLane(RW, "rw-alpha");
  const selfTok = (await paneEnv(`s${rwA.slot}`, "FLEET_SELF_TOKEN")) ?? "";
  check("(RW) precondition: the lane's self token was read from its pane (no token, no measurement)",
    selfTok.length > 8, `len=${selfTok.length}`);
  const bySelf = await setWorker(RW, `${DIR}/fakeaudit`, { "content-type": "application/json", "x-fleet-self-token": selfTok });
  check("(RW) a self token cannot set a repo's audit command (owner-only, as commitMsg)",
    bySelf.status === 401 || bySelf.status === 403, String(bySelf.status));
  const stewardTok = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
  const bySteward = await setWorker(RW, `${DIR}/fakeaudit`,
    { "content-type": "application/json", authorization: `Bearer ${stewardTok}` });
  check("(RW) the steward token cannot either", stewardTok.length > 8 && (bySteward.status === 401 || bySteward.status === 403),
    `steward=${stewardTok.length} status=${bySteward.status}`);
  const byNobody = await fetch(`${BASE}/api/repo-worker`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo: RW, worker: "audit", cmd: `${DIR}/fakeaudit` }) });
  check("(RW) …nor no credential at all", byNobody.status === 401 || byNobody.status === 403, String(byNobody.status));
  check("(RW) none of the three refused writes changed the stored value",
    (await workers()).workers?.[canon]?.audit === RW_CMD, JSON.stringify((await workers()).workers?.[canon]));

  // ===== (RW.2) A LAND IN THAT REPO IS AUDITED BY ITS OWN COMMAND — green, counted, attributed ==
  const rwHad = (await rowsFor(RW)).length;
  const rwLogHad = rwLog().length;
  const aLanded = await land(rwA);
  const a = await waitNewRow(RW, rwHad);
  check("(RW) the foreign repo's land produces a GREEN row with a measured check count — not unknown/exit 42",
    aLanded.gone && a?.result === "green" && a.exitCode === 0 && a.checks?.ran === 2 && a.checks.failed === 0,
    JSON.stringify(a).slice(0, 320));
  check("(RW) the row names the repo-worker command and says where it came from",
    a?.cmd === RW_CMD && a.cmdSource === "repo-worker", `cmd=${a?.cmd} source=${a?.cmdSource}`);
  check("(RW) the row joins to the land — the foreign repo's tip and branch, not the harness repo's",
    a?.mainSha === headOf(RW) && a.covers[0]?.branch === rwA.branch && base(a.repo) === base(RW),
    `${a?.mainSha} head=${headOf(RW)} ${JSON.stringify(a?.covers)}`);
  const aRun = rwLog()[rwLogHad] ?? "";
  const aPwd = /pwd=(\S+)/.exec(aRun)?.[1] ?? "";
  check("(RW) the repo-worker ran ONCE, in a scratch snapshot of the landed tree, outside the repo and its worktrees",
    rwLog().length === rwLogHad + 1 && aRun.includes("rw-alpha.txt") && aRun.includes("seed.txt")
      && aPwd !== "" && !aPwd.startsWith(RW) && !aPwd.startsWith(`${RW}.worktrees`) && !existsSync(aPwd),
    aRun.slice(0, 300));
  check("(RW) the repo-worker child inherits no FLEET_* knob either — same env strip as the env command",
    aRun.includes("recur=[]"), aRun.slice(0, 300));

  // ===== (RW.3) CONTROL: a repo WITHOUT an override behaves exactly as today ======================
  const ctlHad = (await rowsFor(REPO)).length;
  const ctl = await openLane(REPO, "rw-control");
  await land(ctl);
  const c = await waitNewRow(REPO, ctlHad);
  check("(RW) control: a repo with no override is audited by the env command, attributed `env`",
    c?.result === "green" && c.cmd === ENV_CMD && c.cmdSource === "env" && c.checks?.ran === 1
      && c.covers[0]?.branch === ctl.branch, JSON.stringify(c).slice(0, 300));
  check("(RW) control: the repo-worker stand-in was NOT run for it", rwLog().length === rwLogHad + 1, String(rwLog().length));

  // ===== (RW.4) EXIT 42 FROM A REPO-WORKER IS STILL `unknown` — unconfigured ≠ skipped ≠ green ====
  await setRwMode("decline");
  const rwB = await openLane(RW, "rw-bravo");
  const bHad = (await rowsFor(RW)).length;
  await land(rwB);
  const b = await waitNewRow(RW, bHad);
  check("(RW) a repo-worker that declines (exit 42) records unknown, never green — with the reason and no invented count",
    b?.result === "unknown" && b.exitCode === 42 && (b.reason ?? "").includes("declined") && b.checks === null
      && b.cmdSource === "repo-worker" && b.covers[0]?.branch === rwB.branch, JSON.stringify(b).slice(0, 300));
  await setRwMode("green");

  // ===== (RW.9) LOCAL RED ROWS CARRY THE EXACT FAIL NAMES ========================================
  await setRwMode("red");
  const rwRed = await openLane(RW, "rw-red");
  const redHad = (await rowsFor(RW)).length;
  await land(rwRed);
  const red = await waitNewRow(RW, redHad);
  // BREAKS IF: the local fails assignment is absent, or its parser keeps the harness detail suffix.
  check("(RW) a local red row carries fails: exactly the FAIL names of the complete output, detail suffix cut, in order",
    red?.result === "red" && red.checks?.failed === 2
      && JSON.stringify(red.fails) === JSON.stringify([
        "repo-worker verify: unit tests",
        "repo-worker verify: (parenthesised) name",
      ]), JSON.stringify(red).slice(0, 500));

  await setRwMode("redmany");
  const rwRedMany = await openLane(RW, "rw-redmany");
  const redManyHad = (await rowsFor(RW)).length;
  await land(rwRedMany);
  const redMany = await waitNewRow(RW, redManyHad);
  // BREAKS IF: the local path bypasses helperFailNames and therefore its HELPER_FAILS_KEEP cap.
  check("(RW) local fails are capped at HELPER_FAILS_KEEP through helperFailNames",
    redMany?.result === "red" && redMany.checks?.failed === 60 && redMany.fails?.length === 50,
    JSON.stringify(redMany).slice(0, 500));

  // BREAKS IF: fails is computed before classification and writes an empty measured list on green or unknown rows.
  check("(RW) control: a green local row and an unknown (exit 42) row carry no fails key",
    a !== null && b !== null && !("fails" in a) && !("fails" in b),
    JSON.stringify({ green: a, unknown: b }).slice(0, 500));

  for (const prior of await auditRows()) {
    if (prior.result === "red" && prior.at !== red?.at)
      await post("/api/post-land-audits/adjudicate",
        { at: prior.at, verdict: "unknowable", note: "e2e setup: the local named red is the ping subject" });
  }
  const occupied = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots;
  for (const s of occupied) if (s.cwd) await post(`/api/slots/${s.id}/kill`, {});
  await restartSrv({ FLEET_AUDIT_PING_MS: "1000", FLEET_BACKLOG_NUDGE_IDLE_MS: "100" });
  const pingSlot = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((s) => !s.cwd)?.id ?? 0;
  const pingOpen = pingSlot ? await post(`/api/slots/${pingSlot}/open`, { cwd: RW }) : null;
  await Bun.sleep(1700);
  const pingProbe = pingSlot ? await paneEnv(`s${pingSlot}`, "FLEET_SELF_SLOT") : null;
  let pingPane = "";
  const pingDeadline = Date.now() + 10_000;
  while (Date.now() < pingDeadline) {
    pingPane = pingSlot ? (await tmuxOut("capture-pane", "-t", `s${pingSlot}`, "-p", "-J", "-S", "-")).out : "";
    if (pingPane.includes("Fehlgeschlagene Checks (aus der vollstaendigen Ausgabe gelesen):")) break;
    await Bun.sleep(200);
  }
  // BREAKS IF: auditPingMessage keeps attributing local names to the remote helper.
  check("(RW) the audit ping names local fails as read from the output, not as helper-reported",
    pingOpen?.ok === true && pingProbe === String(pingSlot)
      && pingPane.includes(`at=${red?.at}`)
      && pingPane.includes("Fehlgeschlagene Checks (aus der vollstaendigen Ausgabe gelesen):"),
    `slot=${pingSlot} probe=${pingProbe} pane=${pingPane.slice(-700)}`);
  if (pingSlot) await post(`/api/slots/${pingSlot}/kill`, {});
  await restartSrv();
  await setRwMode("green");

  // ===== (RW.12) THE RED-AUDIT PING NEVER CROSSES A REPO BORDER ====================================
  // The ping used to pick "the quietest non-lane session" with NO look at the repo, and a red
  // audit belongs to ONE repo — measured 2026-09-21 on the live prompts.jsonl: 27 of 111 pings
  // landed in a checkout of another repository. The receiver selector is repo-scoped now, and
  // this probe is its SPEC: a red row for REPO must reach the session checked out IN REPO and
  // never the one sitting in another repo — even when the foreign session is the LONGEST-IDLE
  // pane the old selector would have picked first (mutation: ignore the repo argument -> red).
  {
    for (const prior of await auditRows())
      if (prior.result === "red")
        await post("/api/post-land-audits/adjudicate",
          { at: prior.at, verdict: "unknowable", note: "(RW.12) fixture: this repo's red is the subject" });
    const y = `${REPO}-rwaudit-y`;
    await seedRepo(y);
    const free = ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
      .slots.filter((s) => !s.cwd).map((s) => s.id);
    check("(RW.12) fixture: two free slots exist for the in-repo and the foreign receiver",
      free.length >= 2, `free=[${free.join(",")}]`);
    if (free.length >= 2) {
      // The ping tick is opt-in and the block above disarmed it on its way out — arm it here, the
      // same knobs the delivery test above this one uses, and disarm on the way out below.
      await restartSrv({ FLEET_AUDIT_PING_MS: "1000", FLEET_BACKLOG_NUDGE_IDLE_MS: "100" });
      const [foreignSlot, repoSlot] = free;
      // Open order IS the idle order: the foreign pane boots first and settles, the in-repo pane
      // boots younger BY CONSTRUCTION — exactly the ranking the repo-blind selector sorted on.
      await post(`/api/slots/${foreignSlot}/open`, { cwd: y });
      await Bun.sleep(1_600);
      await post(`/api/slots/${repoSlot}/open`, { cwd: REPO });
      const probeForeign = await paneEnv(`s${foreignSlot}`, "FLEET_SELF_SLOT");
      const probeRepo = await paneEnv(`s${repoSlot}`, "FLEET_SELF_SLOT");
      check("(RW.12) fixture: both receiver panes answer the paneEnv probe (a dead pane proves nothing)",
        probeForeign === String(foreignSlot) && probeRepo === String(repoSlot),
        `foreign=${probeForeign} repo=${probeRepo}`);
      await setAuditMode("red");
      const xLane = await openLane(REPO, "rw-pingrepo");
      const xHad = (await rowsFor(REPO)).length;
      await land(xLane);
      const xRed = await waitNewRow(REPO, xHad);
      check("(RW.12) fixture: the landed REPO lane produced a red row for REPO",
        xRed?.result === "red" && base(xRed?.repo ?? "?") === base(REPO), JSON.stringify(xRed).slice(0, 300));
      let repoPane = "";
      const deadline = Date.now() + 12_000;
      while (Date.now() < deadline) {
        repoPane = (await tmuxOut("capture-pane", "-t", `s${repoSlot}`, "-p", "-J", "-S", "-")).out;
        if (xRed !== null && repoPane.includes(`at=${xRed.at}`)) break;
        await Bun.sleep(200);
      }
      const foreignPane = (await tmuxOut("capture-pane", "-t", `s${foreignSlot}`, "-p", "-J", "-S", "-")).out;
      // BREAKS IF: receiversInRepo ignores its repo argument — the foreign session is the older
      // pane, so the repo-blind selector would hand THIS ping to it and the in-repo pane to none.
      check("(RW.12) a red audit for REPO reaches the session IN REPO and never the foreign-repo session",
        xRed !== null && xRed.result === "red" && repoPane.includes(`at=${xRed.at}`)
          && !foreignPane.includes("[fleet post-land audit]"),
        `repo(s${repoSlot})=${JSON.stringify(repoPane.slice(-400))} foreign(s${foreignSlot})=`
          + `${JSON.stringify(foreignPane.slice(-400))}`);
      await post(`/api/slots/${foreignSlot}/kill`, {});
      await post(`/api/slots/${repoSlot}/kill`, {});
    }
    await setAuditMode("green");
    await restartSrv();
  }

  // ===== (RW.5) THE HELPER PORTAL NEVER OFFERS IT ==================================================
  // The daemon runs exactly one command, cfg.suiteCmd (fleet's suite), against whatever it clones —
  // a repo-worker audit handed over would be measured by the wrong suite and recorded under the
  // right repo. So the job is local-only: not listed, not claimable, and still drained here.
  // Fixture: the env repo's audit is SLOW (6 s) and in flight, so the already-settled foreign
  // repo's land queues behind it and is observable rather than consumed at once. It must stay
  // below this harness's 10 s audit timeout or the fixture manufactures an unknown verdict.
  const helperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken, "content-type": "application/json" };
  const DEVICE = "rwauditdevice1";
  const jobs = async (): Promise<HelperJobs> =>
    (await (await fetch(`${BASE}/api/helper/jobs?deviceId=${DEVICE}`, { headers: HH })).json()) as HelperJobs;
  await setAuditMode("slow");
  const slowLane = await openLane(REPO, "rw-slow");
  const rwC = await openLane(RW, "rw-charlie");
  await settleForMerge(slowLane.slot);
  await settleForMerge(rwC.slot);
  const slowHad = (await rowsFor(REPO)).length;
  await land(slowLane);
  const slowRunning = await waitLive((l) => l.postLandAuditLive?.running?.repo === base(REPO));
  check("(RW) fixture: the env repo's slow audit is in flight",
    slowRunning.postLandAuditLive?.running?.repo === base(REPO), JSON.stringify(slowRunning.postLandAuditLive));
  const cHad = (await rowsFor(RW)).length;
  await land(rwC);
  const queuedView = await waitLive((l) => (l.postLandAuditLive?.waiting ?? []).some((w) => w.branch === rwC.branch));
  check("(RW) fixture: the foreign repo's land is WAITING behind the run in flight (it is a real queue entry)",
    (queuedView.postLandAuditLive?.waiting ?? []).some((w) => w.branch === rwC.branch && w.repo === base(RW)),
    JSON.stringify(queuedView.postLandAuditLive?.waiting));
  const offered = await jobs();
  check("(RW) the portal lists the env repo's job and NOT the repo-worker repo's — a job the daemon cannot run is never offered",
    helperToken.length > 8 && offered.jobs.some((j) => j.repo === base(REPO) && j.localRunning)
      && !offered.jobs.some((j) => j.repo === base(RW)),
    JSON.stringify(offered.jobs));
  // the id shape is public (sha256 of the canonical path), so the DOOR must refuse, not just the list
  const guessedId = createHash("sha256").update(canon).digest("hex").slice(0, 12);
  const claim = await fetch(`${BASE}/api/helper/claim`, { method: "POST", headers: HH,
    body: JSON.stringify({ jobId: guessedId, deviceId: DEVICE }) });
  const claimText = await claim.text();
  check("(RW) …and a claim on its id is refused (409) naming the reason", claim.status === 409 && claimText.includes("repo-worker"),
    `${claim.status} ${claimText.slice(0, 160)}`);
  const cRow = await waitNewRow(RW, cHad, 90_000);
  check("(RW) the unoffered job was still drained LOCALLY by its own command once the machine was free",
    cRow?.result === "green" && cRow.cmdSource === "repo-worker" && cRow.covers[0]?.branch === rwC.branch,
    JSON.stringify(cRow).slice(0, 300));
  const slowRow = await waitNewRow(REPO, slowHad, 30_000);
  check("(RW) …after the env repo's run, which finished green on its own command",
    slowRow?.result === "green" && slowRow.cmdSource === "env", JSON.stringify(slowRow).slice(0, 200));
  await setAuditMode("green");

  // ===== (RW.6) AN EMPTY cmd CLEARS — the repo falls back to the env default =======================
  const clr = await setWorker(RW, "");
  const clrJ = (await clr.json()) as { ok?: boolean; cmd?: string | null };
  check("(RW) an empty cmd clears the override", clr.ok && clrJ.ok === true && clrJ.cmd === null
    && (await workers()).workers?.[canon]?.audit === undefined, `${clr.status} ${JSON.stringify(clrJ)}`);
  const rwD = await openLane(RW, "rw-delta");
  const dHad = (await rowsFor(RW)).length;
  await land(rwD);
  const d = await waitNewRow(RW, dHad);
  check("(RW) after the clear the same repo is audited by the env command again, attributed `env`",
    d?.result === "green" && d.cmd === ENV_CMD && d.cmdSource === "env" && d.checks?.ran === 1
      && d.covers[0]?.branch === rwD.branch, JSON.stringify(d).slice(0, 300));

  // ===== (RW.7) NO ENV COMMAND, A REPO-WORKER ALONE ARMS TIER 2 — for its repo only ===============
  check("(RW) setup: the override is stored again", (await (await setWorker(RW, RW_CMD)).json() as { cmd?: string }).cmd === RW_CMD);
  await killSrv();
  check("(RW) the server is up WITHOUT FLEET_POSTLAND_AUDIT_CMD", await startSrv({ audit: false }));
  const ledger = (await (await get("/api/post-land-audits?limit=1")).json()) as { configured?: boolean };
  check("(RW) the ledger says tier 2 is CONFIGURED — a repo-worker arms it, so 'no row' still means something",
    ledger.configured === true, JSON.stringify(ledger.configured));
  const rwE = await openLane(RW, "rw-echo");
  const eHad = (await rowsFor(RW)).length;
  await land(rwE);
  const e = await waitNewRow(RW, eHad);
  check("(RW) with no env command a land in the repo-worker repo is STILL enqueued and audited, by its own command",
    e?.result === "green" && e.cmdSource === "repo-worker" && e.cmd === RW_CMD && e.covers[0]?.branch === rwE.branch,
    JSON.stringify(e).slice(0, 300));
  const ctl2 = await openLane(REPO, "rw-control-unconf");
  const ctl2Had = (await rowsFor(REPO)).length;
  const ctl2Landed = await land(ctl2);
  await Bun.sleep(3000);
  check("(RW) …while a land in a repo with neither is neither audited nor queued — today's unconfigured behaviour",
    ctl2Landed.gone && (await rowsFor(REPO)).length === ctl2Had && !queueHas(REPO, ctl2.branch)
      && (await live()).postLandAuditLive === null,
    `rows=${(await rowsFor(REPO)).length} was=${ctl2Had} queue=${JSON.stringify(queueFile())}`);

  // ===== (RW.8) A PARKED ENTRY SURVIVES OTHER REPOS' SAVES ========================================
  // The queue file is rewritten whole on every save. A pending entry for a repo that has no command
  // on THIS boot must therefore be loaded (parked) rather than left out, or the next land elsewhere
  // would silently drop it — and it must not read as "waiting", because nothing will run it.
  await killSrv();
  check("(RW) setup: env command back on", await startSrv({ audit: true }));
  await setAuditMode("crash"); // 25 s — long enough to kill srv with the run demonstrably in flight
  const ctl3 = await openLane(REPO, "rw-parked");
  const ctl3Had = (await rowsFor(REPO)).length;
  await land(ctl3);
  const crashing = await waitLive((l) => l.postLandAuditLive?.running?.covers.includes(ctl3.branch) === true);
  check("(RW) fixture: the env repo's audit is in flight and its land is on the durable queue",
    crashing.postLandAuditLive?.running?.covers.includes(ctl3.branch) === true && queueHas(REPO, ctl3.branch),
    JSON.stringify({ live: crashing.postLandAuditLive, queue: queueFile() }));
  await killSrv();
  await setAuditMode("green");
  check("(RW) the server is up WITHOUT the env command, over that pending entry", await startSrv({ audit: false }));
  await Bun.sleep(1500);
  check("(RW) the entry is PARKED: still on disk, not audited, and not shown as waiting",
    queueHas(REPO, ctl3.branch) && (await rowsFor(REPO)).length === ctl3Had && (await live()).postLandAuditLive === null,
    `queue=${queueHas(REPO, ctl3.branch)} rows=${(await rowsFor(REPO)).length} live=${JSON.stringify((await live()).postLandAuditLive)}`);
  check("(RW) …and the portal does not offer it either (nobody's work until something is configured)",
    !(await jobs()).jobs.some((j) => j.repo === base(REPO)), JSON.stringify((await jobs()).jobs));
  // …and the DOOR, not only the list — the same pairing (RW.5) makes for the repo-worker arm. The
  // job id is a public shape (sha256 of the canonical path), so a client that guesses it must be
  // refused with the reason, and this is the only place in the suite where a PARKED entry exists at
  // all: on a server booted WITH the env default, `auditCmdFor` never falls through. Both arms of
  // server.ts#helperClaimBar are therefore measured at the door, which is what lets the predicate be
  // one function instead of one hand-copied list per site.
  const parkedKey = Object.keys(queueFile() ?? {}).find((k) => base(k) === base(REPO)) ?? "";
  const parkedId = createHash("sha256").update(parkedKey).digest("hex").slice(0, 12);
  const parkedClaim = parkedKey === "" ? null
    : await fetch(`${BASE}/api/helper/claim`, { method: "POST", headers: HH,
      body: JSON.stringify({ jobId: parkedId, deviceId: DEVICE }) });
  const parkedText = parkedClaim ? await parkedClaim.text() : "";
  check("(RW) …and a claim on the parked entry's id is refused (409) naming it parked, not offered",
    parkedClaim?.status === 409 && parkedText.includes("parked"),
    `key=${parkedKey} ${parkedClaim?.status} ${parkedText.slice(0, 160)}`);
  const rwF = await openLane(RW, "rw-foxtrot");
  const fHad = (await rowsFor(RW)).length;
  await land(rwF);
  const f = await waitNewRow(RW, fHad);
  check("(RW) another repo's land is audited meanwhile (its own command) — and its save did NOT drop the parked entry",
    f?.result === "green" && f.cmdSource === "repo-worker" && queueHas(REPO, ctl3.branch),
    `row=${JSON.stringify(f).slice(0, 160)} parkedStill=${queueHas(REPO, ctl3.branch)}`);
  await killSrv();
  check("(RW) the server is up WITH the env command again", await startSrv({ audit: true }));
  const resumed = await waitNewRow(REPO, ctl3Had);
  check("(RW) the parked entry is drained by the boot that can run it — exactly the land it named",
    resumed?.result === "green" && resumed.cmdSource === "env" && resumed.covers.some((x) => x.branch === ctl3.branch),
    JSON.stringify(resumed).slice(0, 300));
  check("(RW) …and the queue file is gone once every entry has its row", queueFile() === null, JSON.stringify(queueFile()));

  // ===== (RW.10) A RED AUDIT ADDRESSES THE PROGRAM WHOSE LAND IT COVERS ===========================
  // Tier 2's alarm used to go to whichever non-lane session had been quiet longest — a receiver
  // chosen by IDLENESS, with no relation to the land that produced the red. The join that fixes it
  // exists on the OUTCOME ledger (repo + branch + mainAfter -> programId), so a red now lands in the
  // inbox of the Program whose lane landed, and the generic ping keeps exactly the covers no active
  // Program owns. Everything below is that one sentence, measured in both directions.
  const statePath = `${DIR}/fleet.json`;
  interface PlantState {
    slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null; programId?: string | null }>;
    programs?: Record<string, unknown>[];
  }
  const plantState = (): PlantState => JSON.parse(readFileSync(statePath, "utf8")) as PlantState;
  const slotToken = (slot: number): string => plantState().slots?.[String(slot)]?.selfToken ?? "";
  interface InboxEntryView { id: string; kind: string; ref: string; readBy: number | null;
    subject: Record<string, unknown> | null }
  interface InboxView { program?: string; unread?: number; entries?: InboxEntryView[]; unknown?: string[]; error?: string }
  const selfInbox = async (token: string): Promise<InboxView> =>
    (await (await fetch(`${BASE}/api/self/inbox`, { headers: { "x-fleet-self-token": token } })).json()) as InboxView;
  const auditRedEntries = async (token: string): Promise<InboxEntryView[]> =>
    ((await selfInbox(token)).entries ?? []).filter((e) => e.kind === "audit-red");
  const sessions = async (): Promise<{ id: number; cwd: string | null }[]> =>
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots;
  const pane = async (slot: number): Promise<string> =>
    (await tmuxOut("capture-pane", "-t", `s${slot}`, "-p", "-J", "-S", "-")).out;
  // Every red that is already open would compete for the one ping this tick delivers, so each stage
  // starts from "exactly the red I just produced is open". Adjudication never greens a row — it only
  // takes it out of the ping's candidate set, which is precisely what a fixture needs.
  const settleOpenReds = async (except: number | null = null): Promise<void> => {
    for (const prior of await auditRows())
      if (prior.result === "red" && prior.at !== except)
        await post("/api/post-land-audits/adjudicate",
          { at: prior.at, verdict: "unknowable", note: "(RW.10) fixture: not this stage's subject" });
  };
  const waitPing = async (at: number, want: (p: { status?: string; lastResult?: string }) => boolean,
    timeoutMs = 12_000): Promise<Row | undefined> => {
    const deadline = Date.now() + timeoutMs;
    let seen: Row | undefined;
    while (Date.now() < deadline) {
      seen = (await auditRows()).find((r) => r.at === at);
      if (seen?.ping && want(seen.ping)) return seen;
      await Bun.sleep(150);
    }
    return seen;
  };

  await settleOpenReds();
  for (const s of await sessions()) if (s.cwd) await post(`/api/slots/${s.id}/kill`, {});
  await Bun.sleep(300);
  const progMain = (await sessions()).find((s) => !s.cwd)?.id ?? 0;
  const progMainOpen = progMain ? await post(`/api/slots/${progMain}/open`, { cwd: RW }) : null;
  check("(RW.10) fixture: a plain (non-lane) session is open — the ping's only eligible receiver",
    progMainOpen?.ok === true, `${progMain} ${progMainOpen?.status}`);
  const PROG = "a1".repeat(12);
  const laneP1 = await openLane(RW, "rw-prog-one");
  const laneP2 = await openLane(RW, "rw-prog-two");
  const lanePlain = await openLane(RW, "rw-programless");

  // THE BINDING, planted with srv down — a Program bound to that session and two lanes carrying its
  // id, which is what the dispatch path stamps and what the outcome row copies at land time.
  await killSrv();
  const plant = plantState();
  const mainRow = plant.slots?.[String(progMain)] ?? {};
  const boundAt = Date.now() - 1000;
  plant.programs = [...(plant.programs ?? []), {
    id: PROG, title: "Audit-red addressing fixture", intent: "Receive the audit of its own lands",
    successCriterion: "A red audit of this program's land reaches this program's inbox",
    nonGoals: [], decisions: [], evidence: [], openQuestions: [], status: "active",
    createdAt: boundAt - 300, proposedBy: { kind: "owner" },
    confirmedAt: boundAt - 200, activatedAt: boundAt - 100,
    main: { slot: progMain, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId ?? null, boundAt },
    lineage: { v: 1, entries: [{ slot: progMain, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId ?? null,
      boundAt, via: "bootstrap", endedAt: null, endedBy: null }], dropped: 0 },
  }];
  for (const ln of [laneP1, laneP2]) if (plant.slots?.[String(ln.slot)]) plant.slots[String(ln.slot)]!.programId = PROG;
  writeFileSync(statePath, JSON.stringify(plant, null, 2), { mode: 0o600 });
  // FLEET_INBOX_NUDGE_MS is shrunk on purpose: "audit-red never types into a pane" is only a
  // measured statement if the nudge tick actually ran many times over an unread audit-red entry.
  check("(RW.10) fixture: the server is up with the ping and a 250 ms inbox nudge",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  const progMainToken = slotToken(progMain);
  await Bun.sleep(1700); // past openSlot's repaint quiet window, as (J) does
  const progMainProbe = await paneEnv(`s${progMain}`, "FLEET_SELF_SLOT");
  check("(RW.10) fixture: the bound MAIN is OBSERVED and readable — an unobserved pane would make every negative below vacuous",
    progMainProbe === String(progMain) && progMainToken.length > 8
      && (await selfInbox(progMainToken)).program === PROG,
    `probe=${progMainProbe} token=${progMainToken.length}B inbox=${JSON.stringify((await selfInbox(progMainToken)).program ?? null)}`);

  // --- THE POSITIVE CONTROL FIRST. A programless red on this very server, into this very pane: it
  //     is what makes "no pane was typed into" below a measurement instead of an absence.
  await setRwMode("red");
  const plainHad = (await rowsFor(RW)).length;
  await land(lanePlain);
  const plainRow = await waitNewRow(RW, plainHad);
  const plainPinged = plainRow ? await waitPing(plainRow.at, (p) => p.status === "delivered") : undefined;
  const plainPane = await pane(progMain);
  check("(RW.10) control: a red after a PROGRAMLESS land is pinged into the pane exactly as before, and writes no inbox entry",
    plainRow?.result === "red" && plainPinged?.ping?.status === "delivered" && plainPinged.ping.slot === progMain
      && plainPane.includes(`at=${plainRow.at}`) && (await auditRedEntries(progMainToken)).length === 0,
    JSON.stringify({ row: plainRow?.at, ping: plainPinged?.ping, entries: (await auditRedEntries(progMainToken)).length }));
  await settleOpenReds();

  // --- THE SUBJECT. Two lands of the SAME Program coalesced onto ONE audit row: it proves the
  //     per-Program dedupe (two covers, one pointer) and the complete hand-off in one fixture.
  await setAuditMode("slow");
  const holdLane = await openLane(REPO, "rw-prog-hold");
  await settleForMerge(holdLane.slot);
  await settleForMerge(laneP1.slot);
  await settleForMerge(laneP2.slot);
  await land(holdLane);
  await waitLive((l) => l.postLandAuditLive?.running?.repo === base(REPO));
  const progHad = (await rowsFor(RW)).length;
  await land(laneP1);
  await land(laneP2);
  const progRow = await waitNewRow(RW, progHad, 90_000);
  check("(RW.10) fixture: both of the Program's lands are on ONE red audit row (coalesced behind the env repo's slow run)",
    progRow?.result === "red" && progRow.covers.length === 2
      && [laneP1.branch, laneP2.branch].every((b) => progRow.covers.some((c) => c.branch === b)),
    JSON.stringify({ result: progRow?.result, covers: progRow?.covers }));
  await setAuditMode("green");

  const progEntries = await auditRedEntries(progMainToken);
  const progSubject = progEntries[0]?.subject as Record<string, unknown> | undefined;
  const progCovers = (progSubject?.covers ?? []) as string[];
  // BREAKS IF: the writer appends per COVER instead of per Program (two pointers for one row), or the
  // dedupe reads anything but (kind audit-red, ref = this row's `at`).
  check("(RW.10) a red audit after a Program's lands lands in THAT Program's inbox — exactly ONE pointer for the row, both covers named in its subject",
    progEntries.length === 1 && progEntries[0]?.ref === String(progRow?.at)
      && progCovers.length === 2
      && [laneP1.branch, laneP2.branch].every((b) => progCovers.some((c) => c.startsWith(`${b} @ `))),
    JSON.stringify({ entries: progEntries.length, ref: progEntries[0]?.ref, covers: progCovers }));
  // BREAKS IF: the subject is a copy of the pointer rather than a join onto the ledger row — the
  // fail names and the tail exist only on that row.
  check("(RW.10) …and its subject carries the judgement facts: result, fail NAMES, the 15-line tail and the owner-only door",
    progSubject?.result === "red" && progSubject.exitCode === "1"
      && JSON.stringify(progSubject.fails) === JSON.stringify([
        "repo-worker verify: unit tests", "repo-worker verify: (parenthesised) name"])
      && String(progSubject.tail ?? "").includes("2 FAILURES")
      && progSubject.adjudicated === null
      && String(progSubject.door ?? "").includes("POST /api/post-land-audits/adjudicate"),
    JSON.stringify(progSubject).slice(0, 600));
  // BREAKS IF: the ping tick does not know `program-inbox` (it would ping anyway), or the writer
  // reports the hand-off as `delivered` — a paste that never happened.
  await Bun.sleep(1500); // several ping ticks and several inbox-nudge ticks
  const progPane = await pane(progMain);
  const progPinged = (await auditRows()).find((r) => r.at === progRow?.at);
  check("(RW.10) …and NO pane is typed into: the ping is program-inbox (never delivered), and audit-red never arms the inbox nudge either",
    progPinged?.ping?.status === "program-inbox"
      && (progPinged.ping.lastResult ?? "").includes(PROG)
      && !progPane.includes(`at=${progRow?.at}`)
      && !progPane.includes("[fleet inbox]"),
    JSON.stringify({ ping: progPinged?.ping, pingLine: progPane.includes(`at=${progRow?.at}`),
      nudge: progPane.includes("[fleet inbox]") }));

  // BREAKS IF: the read receipt is treated as a judgement — the one thing a MAIN may NOT do here.
  const progRead = await fetch(`${BASE}/api/self/inbox/${progEntries[0]?.id ?? "x"}/read`,
    { method: "POST", headers: { "x-fleet-self-token": progMainToken, "content-type": "application/json" }, body: "{}" });
  const afterRead = (await auditRows()).find((r) => r.at === progRow?.at);
  check("(RW.10) reading the pointer is a RECEIPT, never an adjudication: the row stays red, unjudged, and program-inbox",
    progRead.ok && afterRead?.result === "red" && afterRead.adjudication === undefined
      && afterRead.ping?.status === "program-inbox",
    JSON.stringify({ read: progRead.status, result: afterRead?.result,
      adjudication: afterRead?.adjudication ?? null, ping: afterRead?.ping?.status }));

  // BREAKS IF: the loader drops the fourth status — every restart would then re-open the row for the
  // ping tick and paste the red the Program has already been handed.
  await killSrv();
  check("(RW.10) the server restarts over the program-inbox marker",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  await Bun.sleep(1500);
  const afterRestart = (await auditRows()).find((r) => r.at === progRow?.at);
  const restartPane = await pane(progMain);
  check("(RW.10) …and program-inbox survives it: no second pointer, no late paste",
    afterRestart?.ping?.status === "program-inbox"
      && (await auditRedEntries(progMainToken)).length === 1
      && !restartPane.includes(`at=${progRow?.at}`),
    JSON.stringify({ ping: afterRestart?.ping?.status, entries: (await auditRedEntries(progMainToken)).length }));

  // --- MIXED COVERS: one Program land and one programless land on ONE row. The hand-off is partial,
  //     so the entry is written AND the ping still fires — naming the half that already has a reader.
  await setAuditMode("slow");
  const holdLane2 = await openLane(REPO, "rw-mixed-hold");
  const laneP3 = await openLane(RW, "rw-prog-three");
  const lanePlain2 = await openLane(RW, "rw-programless-two");
  await killSrv();
  const mixPlant = plantState();
  if (mixPlant.slots?.[String(laneP3.slot)]) mixPlant.slots[String(laneP3.slot)]!.programId = PROG;
  writeFileSync(statePath, JSON.stringify(mixPlant, null, 2), { mode: 0o600 });
  check("(RW.10) fixture: the server is up over the mixed-cover plant",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  await Bun.sleep(1700);
  await paneEnv(`s${progMain}`, "FLEET_SELF_SLOT");
  await settleForMerge(holdLane2.slot);
  await settleForMerge(laneP3.slot);
  await settleForMerge(lanePlain2.slot);
  await land(holdLane2);
  await waitLive((l) => l.postLandAuditLive?.running?.repo === base(REPO));
  const mixHad = (await rowsFor(RW)).length;
  await land(laneP3);
  await land(lanePlain2);
  const mixRow = await waitNewRow(RW, mixHad, 90_000);
  check("(RW.10) fixture: one Program land and one programless land share ONE red audit row",
    mixRow?.result === "red" && mixRow.covers.length === 2
      && [laneP3.branch, lanePlain2.branch].every((b) => mixRow.covers.some((c) => c.branch === b)),
    JSON.stringify({ result: mixRow?.result, covers: mixRow?.covers }));
  await setAuditMode("green");
  const mixPinged = mixRow ? await waitPing(mixRow.at, (p) => p.status === "delivered") : undefined;
  const mixPane = await pane(progMain);
  const mixEntries = await auditRedEntries(progMainToken);
  // BREAKS IF: `all` is computed as `addressed > 0` — the programless half of a mixed land would then
  // be silenced along with the addressed half and nobody would ever see it.
  check("(RW.10) mixed covers: the entry IS written AND the ping still fires, naming the half that already has a reader",
    mixEntries.length === 2 && mixEntries.some((e) => e.ref === String(mixRow?.at))
      && mixPinged?.ping?.status === "delivered"
      && mixPane.includes(`at=${mixRow?.at}`)
      && mixPane.includes(`bereits in einer Program-Inbox: ${PROG}`)
      && mixPane.includes(laneP3.branch),
    JSON.stringify({ entries: mixEntries.length, ping: mixPinged?.ping,
      addressedLine: mixPane.includes(`bereits in einer Program-Inbox: ${PROG}`) }));
  await settleOpenReds();

  // --- A POINTER WHOSE ROW IS NOT THERE SAYS SO, and says WHICH of the three things went wrong.
  //     The audit trail is a rotating append-only file, so "the row aged out from under the pointer"
  //     is an expected state and not a defect — but it is a different fact from "the line is there
  //     and this server cannot read it as an audit row", and both differ from a ref that was never a
  //     row key. Planted rather than aged: retention takes a ledger this suite has no reason to build.
  const MALFORMED_AT = 1700000000001;
  // parses as JSON, is NOT an audit row (validAuditRow wants a `mainSha`). It is appended LAST on
  // purpose: the boot rehydration reads exactly the last line, so this line is also the counterprobe
  // for that reader — before the fix in the same commit it became `lastPostLandAudit` and every
  // `/api/sessions` poll 500'd on `r.covers.map` for the rest of the run.
  appendFileSync(`${DIR}/post-land-audits.jsonl`,
    `${JSON.stringify({ at: MALFORMED_AT, result: "red", repo: canon, covers: [] })}\n`);
  await killSrv();
  const unknownPlant = plantState();
  const unknownProgram = (unknownPlant.programs ?? []).find((p) => (p as { id?: string }).id === PROG) as
    { inbox?: { v: 1; entries: Record<string, unknown>[]; dropped: number } } | undefined;
  const plantedRefs = { bad: "not-a-row-key", gone: "1700000000002", malformed: String(MALFORMED_AT) };
  const plantedIds = { bad: "d1".repeat(12), gone: "d2".repeat(12), malformed: "d3".repeat(12) };
  if (unknownProgram) unknownProgram.inbox = { v: 1, dropped: 0, entries: [
    ...(unknownProgram.inbox?.entries ?? []),
    ...(["bad", "gone", "malformed"] as const).map((k, i) => ({ id: plantedIds[k], kind: "audit-red",
      at: Date.now() - 3000 + i, ref: plantedRefs[k], readBy: null, readAt: null })),
  ] };
  writeFileSync(statePath, JSON.stringify(unknownPlant, null, 2), { mode: 0o600 });
  check("(RW.10) fixture: the server is up over three unresolvable audit-red pointers",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  // The planted line is a RED the ping tick would otherwise chase — and its `at` is older than every
  // real row here, so it would be the candidate for the rest of this section. Judged out of the
  // candidate set at once; the row itself stays on the trail, which is what the pointers point at.
  await post("/api/post-land-audits/adjudicate",
    { at: MALFORMED_AT, verdict: "unknowable", note: "(RW.10) fixture: an unreadable planted line, not a measurement" });
  // BREAKS IF: the boot rehydration casts the last trail line instead of validating it — the board's
  // own poll route is then dead for the rest of this server's life, and every check below would fail
  // as a JSON parse error rather than as itself.
  const boardAfterMalformed = await get("/api/sessions");
  const boardBody = await boardAfterMalformed.clone().json().then(
    (j) => j as { postLandAudit?: { at?: number } | null }).catch(() => null);
  check("(RW.10) a trail whose LAST line is not an audit row does not take the board's poll down with it",
    boardAfterMalformed.ok && boardBody !== null && boardBody.postLandAudit?.at !== MALFORMED_AT,
    `${boardAfterMalformed.status} lastAudit=${JSON.stringify(boardBody?.postLandAudit ?? null).slice(0, 200)}`);
  const unknownView = await selfInbox(slotToken(progMain));
  const unknownLines = unknownView.unknown ?? [];
  // BREAKS IF: the join reports an absent row and an unreadable one with the same sentence, or
  // answers a broken pointer with an empty `subject` and no line at all — the shape that made
  // "nothing arrived" and "the pointer lost its row" indistinguishable for every other kind.
  check("(RW.10) an audit-red pointer that does not resolve is subject:null PLUS a NAMED line — three different failures, three different sentences",
    unknownLines.some((l) => l.includes(plantedIds.bad) && l.includes("is not a row key"))
      && unknownLines.some((l) => l.includes(plantedIds.gone) && l.includes("no longer on the trail (retention)"))
      && unknownLines.some((l) => l.includes(plantedIds.malformed) && l.includes("not readable as an audit row"))
      && (unknownView.entries ?? []).filter((e) => Object.values(plantedIds).includes(e.id))
        .every((e) => e.subject === null),
    JSON.stringify(unknownLines).slice(0, 700));
  // BREAKS IF: the nudge counts audit-red — three unread pointers would paste into the bound MAIN,
  // which is the exact thing this kind exists to stop.
  await Bun.sleep(1500); // several 250 ms inbox-nudge ticks over three unread audit-red entries
  check("(RW.10) …and three unread audit-red pointers still arm NO inbox nudge",
    !(await pane(progMain)).includes("[fleet inbox]"), (await pane(progMain)).slice(-400));

  // --- GREEN: the writer's first line. A green audit of the same Program's land writes nothing.
  await setRwMode("green");
  const greenLane = await openLane(RW, "rw-prog-green");
  await killSrv();
  const greenPlant = plantState();
  if (greenPlant.slots?.[String(greenLane.slot)]) greenPlant.slots[String(greenLane.slot)]!.programId = PROG;
  writeFileSync(statePath, JSON.stringify(greenPlant, null, 2), { mode: 0o600 });
  check("(RW.10) fixture: the server is up over the green plant",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  const greenEntriesBefore = (await auditRedEntries(slotToken(progMain))).length;
  const greenHad = (await rowsFor(RW)).length;
  await land(greenLane);
  const greenRow = await waitNewRow(RW, greenHad);
  check("(RW.10) control: a GREEN audit of the same Program's land writes no pointer at all",
    greenRow?.result === "green"
      && (await auditRedEntries(slotToken(progMain))).length === greenEntriesBefore,
    JSON.stringify({ result: greenRow?.result, before: greenEntriesBefore,
      after: (await auditRedEntries(slotToken(progMain))).length }));

  // --- THE TIP HALF OF THE JOIN. A landed outcome row carrying this Program's id, this lane's
  //     branch and a DIFFERENT land sha must not match — a branch name is reused, a tip is not. The
  //     malformed line beside it proves the reader skips a bad line instead of failing the join.
  await setRwMode("red");
  const tipLane = await openLane(RW, "rw-tip-counterprobe");
  appendFileSync(`${DIR}/lane-outcomes.jsonl`, `${JSON.stringify({
    ts: Date.now() - 5000, branch: tipLane.branch, disposition: "landed", repo: canon,
    mainAfter: "0".repeat(40), programId: PROG, base: "0".repeat(40), headSha: "0".repeat(40),
  })}\n{ this is not json\n`);
  const tipEntriesBefore = (await auditRedEntries(slotToken(progMain))).length;
  const tipHad = (await rowsFor(RW)).length;
  await land(tipLane);
  const tipRow = await waitNewRow(RW, tipHad);
  const tipPinged = tipRow ? await waitPing(tipRow.at, (p) => p.status === "delivered") : undefined;
  check("(RW.10) counterprobe: the same branch at a DIFFERENT land sha does not match — no pointer, and the red is pinged as unowned",
    tipRow?.result === "red" && tipRow.covers[0]?.branch === tipLane.branch
      && tipRow.covers[0]?.mainAfter !== "0".repeat(40)
      && (await auditRedEntries(slotToken(progMain))).length === tipEntriesBefore
      && tipPinged?.ping?.status === "delivered",
    JSON.stringify({ cover: tipRow?.covers[0], before: tipEntriesBefore,
      after: (await auditRedEntries(slotToken(progMain))).length, ping: tipPinged?.ping?.status }));
  await settleOpenReds();

  // --- A PROGRAM THAT IS NO LONGER ACTIVE IS NO LONGER A READER. Its covers stay UNADDRESSED and
  //     keep the ping alive: "the program that owned this land is gone" is exactly the case a human
  //     still has to see, and silently dropping it would be the worst outcome of the whole rail.
  const goneLane = await openLane(RW, "rw-prog-gone");
  await killSrv();
  const gonePlant = plantState();
  if (gonePlant.slots?.[String(goneLane.slot)]) gonePlant.slots[String(goneLane.slot)]!.programId = PROG;
  const goneProgram = (gonePlant.programs ?? []).find((p) => (p as { id?: string }).id === PROG);
  if (goneProgram) (goneProgram as { status?: string }).status = "complete";
  writeFileSync(statePath, JSON.stringify(gonePlant, null, 2), { mode: 0o600 });
  check("(RW.10) fixture: the server is up with that Program no longer active",
    await startSrv({ audit: true, auditPing: true, extra: { FLEET_INBOX_NUDGE_MS: "250" } }));
  const goneHad = (await rowsFor(RW)).length;
  await land(goneLane);
  const goneRow = await waitNewRow(RW, goneHad);
  const gonePinged = goneRow ? await waitPing(goneRow.at, (p) => p.status === "delivered") : undefined;
  check("(RW.10) a land whose Program is no longer active stays UNADDRESSED and is pinged — never silently dropped",
    goneRow?.result === "red" && gonePinged?.ping?.status === "delivered"
      && (await pane(progMain)).includes(`at=${goneRow?.at}`),
    JSON.stringify({ result: goneRow?.result, ping: gonePinged?.ping }));

  await settleOpenReds();
  for (const s of await sessions()) if (s.cwd) await post(`/api/slots/${s.id}/kill`, {});
  await killSrv();
  const cleanState = plantState();
  cleanState.programs = (cleanState.programs ?? []).filter((p) => (p as { id?: string }).id !== PROG);
  writeFileSync(statePath, JSON.stringify(cleanState, null, 2), { mode: 0o600 });
  check("(RW.10) teardown: the server is back on the wrapper's default ping configuration",
    await startSrv({ audit: true }));
  await setRwMode("green");

  await setWorker(RW, "");
}

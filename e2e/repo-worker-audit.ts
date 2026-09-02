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
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BASE, check, get, paneEnv, post } from "./harness";
import { driveMerge, openLane, seedRepo, settleForMerge, type Lane } from "./lane-helpers";

interface Row {
  at: number; ms: number; repo: string; main: string; mainSha: string; result: string; reason?: string;
  cmd: string; cmdSource?: string; exitCode: number | null; out: string;
  checks?: { ran: number; failed: number } | null;
  covers: { branch: string; mainAfter: string }[];
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

  // ===== (RW.5) THE HELPER PORTAL NEVER OFFERS IT ==================================================
  // The daemon runs exactly one command, cfg.suiteCmd (fleet's suite), against whatever it clones —
  // a repo-worker audit handed over would be measured by the wrong suite and recorded under the
  // right repo. So the job is local-only: not listed, not claimable, and still drained here.
  // Fixture: the env repo's audit is LONG (12 s — a whole second land has to fit inside it, the
  // same sizing as (I.1)) and in flight, so the foreign repo's land queues behind it and is
  // observable as a queue entry rather than consumed at once.
  const helperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken, "content-type": "application/json" };
  const DEVICE = "rwauditdevice1";
  const jobs = async (): Promise<HelperJobs> =>
    (await (await fetch(`${BASE}/api/helper/jobs?deviceId=${DEVICE}`, { headers: HH })).json()) as HelperJobs;
  await setAuditMode("long");
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
  await setWorker(RW, "");
}

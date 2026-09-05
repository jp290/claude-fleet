// e2e for VERIFICATION TIER 2 — the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD). The MAIN
// suite runs with FLEET_POSTLAND_AUDIT_CMD unset (default OFF) and proves the land path is untouched;
// THIS harness boots with the flag pointed at a stand-in suite and proves the ON behaviour: a land
// triggers an audit against the LANDED tree without blocking the land, its result is recorded durably
// and joinably, a red is surfaced, an audit that cannot produce a verdict records UNKNOWN (never
// green), a burst of lands never spawns two concurrent suites, and — sections E–G, which restart the
// server and therefore run last — a pending audit survives the death of the process that owed it.
// Run via ./e2e-postland-audit.sh — never against a live fleet.
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
// Plumbing — IP/PORT/SOCK/BASE, the owner token read out of the instance's fleet.json, get/check,
// and the live-fleet refusal this file used to carry as its own copied line — is e2e/harness.ts;
// the refusal now fires on import and covers the live PORT as well as the live socket. The lane
// spine (seedRepo / openLane / driveMerge and the waits underneath) is e2e/lane-helpers.ts, shared
// with fleet-e2e-clean-review.ts, which drove lanes exactly this way from its own copy.
// check() in harness.ts is the per-check trail's single emit site, so this suite's checks now leave
// durable rows (docs/e2e-trail.md), stamped FLEET_E2E_SUITE=postland-audit by the wrapper.
// NOT folded, deliberately: srv restart. harness.ts's restartSrv carries EVERY FLEET_* key of the
// harness process forward, which is the wrong shape twice here — sections E–G need a boot that
// DROPS FLEET_POSTLAND_AUDIT_CMD (an unconfigured server, not one pointed at a declining stand-in),
// and this wrapper does not strip the lane pane's FLEET_SELF_* credentials the way e2e-isolated.sh
// does, so a whitelist is the safe direction. e2e/restart.ts builds its own line for its own
// reasons too.
import { BASE, check, failures, get, IP, paneEnv, plogRead, PORT, post, results, SOCK } from "./e2e/harness";
import { driveMerge, openLane, seedRepo, settleForMerge, type Lane, type MergeVerdict } from "./e2e/lane-helpers";
import * as helperPortal from "./e2e/helper-portal";
import * as helperDaemon from "./e2e/helper-daemon";
import * as repoWorkerAudit from "./e2e/repo-worker-audit";

// the stand-in suite's control + evidence files (both live next to this script, = the server's dir)
const setAuditMode = (m: string): Promise<number> => Bun.write(`${import.meta.dir}/auditmode`, m);
const runLog = async (): Promise<string[]> => {
  try {
    return (await Bun.file(`${import.meta.dir}/auditruns`).text()).split("\n").filter(Boolean);
  } catch { return []; }
};

type AuditRow = {
  at: number; startedAt: number; ms: number; repo: string; main: string; mainSha: string;
  // deliberately `string`, not the server's union: a server WITHOUT tier 2 must make every
  // assertion below fail individually, and the no-row sentinel needs a value no check can match
  result: string; reason?: string; cmd: string; cmdSource?: string; exitCode: number | null;
  out: string; fails?: string[]; trail?: string;
  // the short-chain stamp (section P). Optional here for the same reason `result` is a bare string:
  // a server without the proportional audit must fail each assertion on its own rather than throw.
  proportional?: boolean; steps?: string[];
  checks?: { ran: number; failed: number; ranIsLowerBound?: true } | null;
  ping?: { at: number; status: string; updatedAt: number; lastResult: string; deliveredAt?: number; slot?: number };
  covers: { branch: string; mainAfter: string; at: number }[];
};
const NO_ROW: AuditRow = { at: 0, startedAt: 0, ms: -1, repo: "", main: "", mainSha: "",
  result: "(no row)", cmd: "", exitCode: null, out: "", covers: [] };
const auditRows = async (): Promise<AuditRow[]> => {
  const r = await get("/api/post-land-audits?limit=100");
  try {
    // a server without tier 2 answers 404/HTML here — degrade to "no rows" so every case below
    // reports its own FAIL, instead of one parse error hiding the whole case list
    return ((await r.json()) as { audits?: AuditRow[] }).audits ?? [];
  } catch { return []; }
};
// poll until the trail holds at least `n` rows. The whole point of this tier is that nothing waits
// for it, so every assertion about a result has to wait for it HERE. A timeout is recorded as its
// own failed check and yields what it has — the following checks then say WHICH property is missing.
const waitRows = async (n: number, timeoutMs = 60_000): Promise<AuditRow[]> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await auditRows();
    if (rows.length >= n) return rows;
    if (Date.now() >= deadline) {
      check(`the post-land audit trail reached ${n} rows`, false, `have ${rows.length} after ${timeoutMs}ms`);
      return rows;
    }
    await Bun.sleep(150);
  }
};
const newest = (rows: AuditRow[], i = 0): AuditRow => rows[i] ?? NO_ROW;
type AuditFleetEvent = {
  id: string; watchId: string; receiverSlot: number; subjectRepo: string; subjectMainAfter: string;
  kind: "post-land-audit"; status: "pending" | "delivered" | "acknowledged" | "receiver-gone";
  payload: { result: "green" | "red" | "unknown"; mainSha: string;
    covers: { branch: string; mainAfter: string }[]; checks: { ran: number; failed: number } | null; reason?: string };
};
const auditEvents = async (): Promise<AuditFleetEvent[]> =>
  (((await (await get("/api/sessions")).json()) as { events: unknown[] }).events as AuditFleetEvent[])
    .filter((e) => e.kind === "post-land-audit");
const waitAuditEvent = async (watchId: string): Promise<AuditFleetEvent | undefined> => {
  let event: AuditFleetEvent | undefined;
  for (let i = 0; i < 200; i++) {
    event = (await auditEvents()).find((e) => e.watchId === watchId);
    if (event?.status === "delivered" || event?.status === "acknowledged") return event;
    await Bun.sleep(100);
  }
  return event;
};
// the trail read straight off disk — the durability section asserts things about moments when
// there is no server to ask
const trailRows = (): AuditRow[] => {
  try {
    return readFileSync(`${import.meta.dir}/post-land-audits.jsonl`, "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditRow);
  } catch { return []; }
};
// poll the stand-in's evidence log until `n` runs of a given mode have STARTED (it writes its line
// before doing anything else). Returns the count it saw, so a timeout fails the caller's own check.
const waitRunMode = async (mode: string, n: number, timeoutMs = 30_000): Promise<number> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const c = (await runLog()).filter((l) => l.includes(`mode=${mode}`)).length;
    if (c >= n || Date.now() >= deadline) return c;
    await Bun.sleep(100);
  }
};
// THE RUN IN FLIGHT, as the board's poll sees it (server: postLandAuditLiveView). Typed loosely on
// purpose, exactly like AuditRow above: a server WITHOUT this projection must make every assertion
// below fail on its own rather than throw once and hide the rest.
type LiveInfo = {
  running: { phase: string; repo: string | null; main: string | null; mainSha: string | null;
    startedAt: number | null; covers: string[] } | null;
  waiting: { repo: string; main: string; branch: string; mainAfter: string; at: number }[];
  stats: { n: number; p50: number; p90: number } | null;
} | null;
const live = async (): Promise<LiveInfo> => {
  const r = await get("/api/sessions");
  try { return ((await r.json()) as { postLandAuditLive?: LiveInfo }).postLandAuditLive ?? null; }
  catch { return null; }
};
// poll the poll. Nothing in the fleet waits for tier 2, so every assertion ABOUT a moment of it has
// to catch that moment here. Returns whatever it last saw on timeout, so the caller's own check
// reports which property was missing rather than a bare "timed out".
const waitLive = async (want: (l: LiveInfo) => boolean, timeoutMs = 30_000): Promise<LiveInfo> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const l = await live();
    if (want(l) || Date.now() >= deadline) return l;
    await Bun.sleep(100);
  }
};

// the PENDING queue's durable mirror. Absent file = nothing pending, which is the assertion in
// several checks below, so "missing" must be a distinguishable value rather than an exception.
type QueueEntry = { main: string; covers: { branch: string; mainAfter: string; at: number }[] };
const QUEUE_FILE = `${import.meta.dir}/post-land-audit-queue.json`;
const readQueueRaw = async (): Promise<string> => {
  try { return await Bun.file(QUEUE_FILE).text(); } catch { return ""; }
};
const readQueueFile = async (): Promise<Record<string, QueueEntry> | null> => {
  const raw = await readQueueRaw();
  if (!raw.trim()) return null;
  try { return JSON.parse(raw) as Record<string, QueueEntry>; } catch { return null; }
};

// --- srv restart, rebuilt from the env the harness script exported (same pattern as e2e/restart.ts,
// so the restarted server is the same instance under test rather than a differently-configured one).
// `audit:false` boots WITHOUT FLEET_POSTLAND_AUDIT_CMD — the unconfigured case, which has to be a
// genuinely unconfigured server, not a server pointed at a stand-in that declines.
const envArg = (k: string, v: string | undefined): string =>
  v === undefined ? "" : `${k}='${v.replaceAll("'", "'\\''")}' `;
const killSrv = async (): Promise<void> => {
  await Bun.spawn(["tmux", "-L", SOCK, "kill-session", "-t", "srv"]).exited;
  await Bun.sleep(500);
};
// `extra` is appended LAST and therefore wins over the inherited value — the same shape
// e2e/harness.ts's restartSrv uses, and the way the helper-portal section boots one server with a
// 10-minute claim timeout and the next with a few seconds without touching the wrapper.
const startSrv = async (opts: { audit: boolean; auditPing?: boolean; extra?: Record<string, string> }): Promise<boolean> => {
  const env = ["FLEET_CMD", "FLEET_AUTO_REVIEW_MS", "FLEET_VERIFY_CMD", "FLEET_MERGE_CMD",
    "FLEET_CLEAN_REVIEW", "FLEET_CLEAN_REVIEW_CMD", "FLEET_POSTLAND_AUDIT_TIMEOUT_MS",
    ...(opts.audit ? ["FLEET_POSTLAND_AUDIT_CMD"] : [])]
    .map((k) => envArg(k, process.env[k])).join("")
    + (opts.audit ? "" : "FLEET_POSTLAND_AUDIT_CMD='' ")
    + Object.entries(opts.extra ?? {}).map(([k, v]) => envArg(k, v)).join("");
  const pingEnv = opts.auditPing
    ? "FLEET_AUDIT_PING_MS=250 FLEET_BACKLOG_NUDGE_IDLE_MS=100 "
    : "FLEET_AUDIT_PING_MS=0 ";
  await Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${import.meta.dir}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${env}${pingEnv}exec bun server.ts >> server.log 2>&1`]).exited;
  for (let i = 0; i < 120; i++) {
    try { if ((await get("/api/sessions")).ok) return true; } catch { /* not bound yet */ }
    await Bun.sleep(250);
  }
  return false;
};

// throwaway repo the lanes fork from
const REPO = `${import.meta.dir}/testrepo`;
await seedRepo(REPO);
const headOf = (ref = "main"): string => spawnSync("git", ["-C", REPO, "rev-parse", ref]).stdout.toString().trim();
const noteAt = (sha: string): boolean => spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", sha]).status === 0;
const opReceiver = ((await (await get("/api/sessions")).json()) as
  { slots: { id: number; cwd: string | null }[] }).slots.find((s) => s.cwd === null)?.id ?? 0;
const opReceiverOpen = opReceiver ? await post(`/api/slots/${opReceiver}/open`, { cwd: REPO }) : null;
check("audit-event setup: a non-lane receiver is open",
  !!opReceiverOpen?.ok, `${opReceiver} ${opReceiverOpen?.status}`);
const subscribeAudit = async (mainAfter: string): Promise<{ response: Response;
  body: { watch?: { id: string; armed: boolean }; existing?: boolean; error?: string } }> => {
  const response = await post(`/api/slots/${opReceiver}/watch`, { kind: "audit", repo: REPO, mainAfter, idleSec: 0 });
  return { response, body: await response.json() as
    { watch?: { id: string; armed: boolean }; existing?: boolean; error?: string } };
};

// a lane whose rebase is CLEAN (its own file → no conflict, the merge agent is never consulted) with
// its work committed: exactly the clean+green auto-land path tier 2 hangs off. Both are one-line
// bindings of the shared spine to this harness's repo and its local vocabulary.
const makeLane = (name: string): Promise<Lane> => openLane(REPO, name);
const landLane = (ln: Lane): Promise<{ gone: boolean; last: MergeVerdict | null }> => driveMerge(ln, ln.branch);

// ===== (D) CONCURRENCY + COALESCING, and the "does not block the land" property =================
// Runs FIRST, while the trail is empty, so the row counts below are unambiguous. The stand-in sleeps
// 6s per run and flags OVERLAP if a second run starts while it is in flight.
await setAuditMode("slow");
const burst = [await makeLane("alpha"), await makeLane("bravo"), await makeLane("charlie")];
for (const ln of burst) await settleForMerge(ln.slot); // pay the idle gate once, up front

const aLanded = await landLane(burst[0]);
const aLandedAt = Date.now();
// no row yet at the moment the land returned — asserted here, judged below once the row exists
const rowsRightAfter = await auditRows();
const bLanded = await landLane(burst[1]);
const cLanded = await landLane(burst[2]);
check("setup: all three lands of the burst reached main",
  aLanded.gone && bLanded.gone && cLanded.gone,
  spawnSync("git", ["-C", REPO, "log", "--oneline", "-5"]).stdout.toString().trim());

// two runs, not three: the run in flight is never interrupted, and everything that landed while it
// ran is folded into exactly ONE follow-up against the then-current tip
const burstRows = await waitRows(2);
await Bun.sleep(2000); // give a (wrong) third run time to appear before asserting there is none
const afterBurst = await auditRows();
check("a burst of three lands produces exactly TWO audit runs (coalesced, never one per land)",
  afterBurst.length === 2, `rows=${afterBurst.length} ${JSON.stringify(afterBurst.map((r) => r.covers.map((c) => c.branch)))}`);
check("no two audits ever ran at the same time (the stand-in would have flagged OVERLAP)",
  !(await runLog()).some((l) => l.includes("OVERLAP")), (await runLog()).join(" | ").slice(0, 300));
const first = newest(afterBurst, afterBurst.length - 1);
const second = newest(afterBurst);
// "no row yet" alone is trivially true of a server without tier 2, so the ORDERING is what proves
// the property: this audit ran for ~6s and FINISHED after the land had already returned. A land that
// waited on its audit could not have returned first.
check("the land does not block on the audit — it returned before its own 6s audit finished",
  aLanded.gone && rowsRightAfter.length === 0 && first.ms >= 5500 && first.at > aLandedAt,
  `landed=${aLanded.gone} rowsAtLandTime=${rowsRightAfter.length} auditMs=${first.ms} finishedAfterLand=${first.at > aLandedAt}`);
check("the first run covers the land that triggered it",
  first.covers.length === 1 && first.covers[0].branch === burst[0].branch, JSON.stringify(first.covers));
check("the coalesced follow-up NAMES both lands that arrived while the first run was in flight",
  second.covers.length === 2 && second.covers[0].branch === burst[1].branch
    && second.covers[1].branch === burst[2].branch, JSON.stringify(second.covers));
check("the coalesced run audited the tip that includes both of them, and says so",
  second.mainSha === headOf() && second.mainSha === second.covers[1].mainAfter,
  `audited=${second.mainSha} head=${headOf()}`);
check("setup: the burst runs are green (the stand-in passed)",
  burstRows.every((r) => r.result === "green"), JSON.stringify(burstRows.map((r) => r.result)));

// ===== (A) A LAND TRIGGERS AN AUDIT, AND THE RESULT IS JOINABLE TO THAT LAND =====================
await setAuditMode("green");
const dirtyBefore = spawnSync("git", ["-C", REPO, "status", "--porcelain"]).stdout.toString();
const delta = await makeLane("delta");
const dLanded = await landLane(delta);
const deltaMainAfter = headOf();
const dSub = await subscribeAudit(deltaMainAfter);
const dRows = await waitRows(3);
const d = newest(dRows);
const dEvent = dSub.body.watch ? await waitAuditEvent(dSub.body.watch.id) : undefined;
check("a land triggers an audit whose row records a green result", dLanded.gone && d.result === "green", JSON.stringify(d));
check("audit event: GREEN terminal row is delivered with the exact land join and measured tip",
  dSub.response.ok && dEvent?.payload.result === "green" && dEvent.subjectMainAfter === deltaMainAfter
    && dEvent.payload.mainSha === d.mainSha
    && dEvent.payload.covers.some((c) => c.branch === delta.branch && c.mainAfter === deltaMainAfter),
  JSON.stringify({ subscription: dSub.body, event: dEvent }));
const dDup = await subscribeAudit(deltaMainAfter);
check("audit event: duplicate concrete-land subscription reuses the same row and event",
  dDup.response.ok && dDup.body.existing === true && dDup.body.watch?.id === dSub.body.watch?.id
    && (await auditEvents()).filter((e) => e.watchId === dSub.body.watch?.id).length === 1,
  JSON.stringify(dDup.body));
check("the row JOINS to the land it followed — branch + the exact main it advanced to",
  d.covers.length === 1 && d.covers[0].branch === delta.branch && d.covers[0].mainAfter === headOf()
    && d.mainSha === headOf(), `${JSON.stringify(d.covers)} head=${headOf()}`);
check("the same key joins on to the land's own provenance note (one sha, both records)",
  noteAt(d.mainSha), d.mainSha);
// the evidence that it audited the LANDED tree, not the primary checkout's working copy
const dRun = (await runLog()).filter((l) => l.includes("mode=green")).pop() ?? "";
const dPwd = /pwd=(\S+)/.exec(dRun)?.[1] ?? "";
check("the audit ran against the landed tree — the lane's committed file is in the audited snapshot",
  dRun.includes("delta.txt") && dRun.includes("seed.txt"), dRun.slice(0, 300));
check("a passing audit records its measured check count (zero is not an absence sentinel)",
  d.checks?.ran === 1 && d.checks.failed === 0, JSON.stringify(d.checks));
check("the audit ran OUTSIDE the repo and outside every worktree of it (own scratch dir)",
  dPwd !== "" && !dPwd.startsWith(REPO) && !dPwd.startsWith(`${REPO}.worktrees`), `pwd=${dPwd}`);
check("the scratch dir is cleaned up after the run", dPwd !== "" && !existsSync(dPwd), dPwd);
check("the primary checkout's working tree was never touched",
  spawnSync("git", ["-C", REPO, "status", "--porcelain"]).stdout.toString() === dirtyBefore,
  spawnSync("git", ["-C", REPO, "status", "--porcelain"]).stdout.toString().slice(0, 200));
// the recursion guard: the audit's payload boots a server, and an inherited knob would make that
// server audit its own lands, forever
check("the audit child does NOT inherit FLEET_POSTLAND_AUDIT_CMD (one level, no recursion)",
  dRun.includes("recur=[]"), dRun.slice(0, 300));
check("the audit child does NOT inherit the owner token", dRun.includes("token=[]"), dRun.slice(0, 300));
// this server booted with FLEET_CLEAN_REVIEW=shadow, exactly as the live srv does. Inherited, a
// nested suite would run the shadow reviewer with no stand-in configured — i.e. spawn REAL model
// sessions inside an audit. The strip is FLEET_* wholesale, so the suite's own knobs win.
check("the audit child inherits NO FLEET_* knob — not even the production FLEET_CLEAN_REVIEW",
  dRun.includes("cr=[]"), dRun.slice(0, 300));
check("non-FLEET environment is kept (an audit with no PATH could not run bun at all)",
  dRun.includes("path=[set]"), dRun.slice(0, 300));

// ===== (B) A RED AUDIT IS RECORDED AS RED AND IS SURFACED ========================================
await setAuditMode("red");
const echoLane = await makeLane("echo");
const eLanded = await landLane(echoLane);
const echoMainAfter = headOf();
const eSub = await subscribeAudit(echoMainAfter);
const eRows = await waitRows(4);
const e = newest(eRows);
const eEvent = eSub.body.watch ? await waitAuditEvent(eSub.body.watch.id) : undefined;
check("a failing audit is recorded RED (never rounded to green), with the suite's tail",
  eLanded.gone && e.result === "red" && e.exitCode === 1 && e.out.includes("3 FAILURES"), JSON.stringify(e).slice(0, 300));
check("audit event: RED is delivered verbatim and binds only to its matching cover/mainSha",
  eSub.response.ok && eEvent?.payload.result === "red" && eEvent.subjectMainAfter === echoMainAfter
    && eEvent.payload.mainSha === e.mainSha
    && eEvent.payload.covers.some((c) => c.branch === echoLane.branch && c.mainAfter === echoMainAfter)
    && !eEvent.payload.covers.some((c) => c.mainAfter === deltaMainAfter),
  JSON.stringify(eEvent));
const eEventText = (await plogRead()).find((p) => p.slot === opReceiver
  && p.text.includes(`[event ${eEvent?.id}]`))?.text ?? "";
check("audit event: rendered text names RED, the audited tip, and its event-specific Ack",
  eEventText.includes("result=red") && eEventText.includes(e.mainSha)
    && eEventText.includes(`POST /api/self/events/${eEvent?.id}/ack`), eEventText);
check("the audit row counts every PASS/FAIL line and every failed check from complete output",
  e.checks?.ran === 4 && e.checks.failed === 3 && e.checks.ranIsLowerBound === undefined, JSON.stringify(e.checks));
check("a local audit row records the filename of the check trail named by its complete output",
  e.trail === "local-audit-trail.jsonl", `trail=${e.trail ?? "ABSENT"}`);
check("the red row NAMES the land it followed", e.covers.length === 1 && e.covers[0].branch === echoLane.branch,
  JSON.stringify(e.covers));
const sess = (await (await get("/api/sessions")).json()) as { postLandAudit: { result?: string; covers?: string[]; mainSha?: string } | null };
check("the red result is surfaced on the board's poll payload, naming the land",
  sess.postLandAudit?.result === "red" && (sess.postLandAudit.covers ?? []).includes(echoLane.branch),
  JSON.stringify(sess.postLandAudit));
const auditTrail = (await (await get("/api/audit?limit=200")).json()) as { events: { event?: string; detail?: string }[] };
check("the red result is on the audit trail too, naming result + branch",
  auditTrail.events.some((x) => x.event === "postland_audit" && (x.detail ?? "").startsWith("red")
    && (x.detail ?? "").includes(echoLane.branch)),
  JSON.stringify(auditTrail.events.filter((x) => x.event === "postland_audit").slice(0, 3)));
check("a red audit does NOT undo the land — rollback stays the owner's ↩ undo-land",
  spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().includes("echo lane work"),
  spawnSync("git", ["-C", REPO, "log", "--oneline", "-3"]).stdout.toString().trim());

// ===== (C) AN AUDIT THAT CANNOT PRODUCE A VERDICT RECORDS UNKNOWN — NEVER GREEN =================
// Three distinct ways to have no measurement, all of which used to be indistinguishable from a pass
// if `result` were a boolean (A4: unknown ≠ zero).
await setAuditMode("decline");
const fox = await makeLane("foxtrot");
await landLane(fox);
const foxMainAfter = headOf();
const fSub = await subscribeAudit(foxMainAfter);
const f = newest(await waitRows(5));
const fEvent = fSub.body.watch ? await waitAuditEvent(fSub.body.watch.id) : undefined;
check("an audit command that DECLINES to run records unknown, never green",
  f.result === "unknown" && f.exitCode === 42 && (f.reason ?? "").includes("declined"), JSON.stringify(f).slice(0, 300));
check("audit event: UNKNOWN is delivered verbatim with capped reason and no invented check count",
  fSub.response.ok && fEvent?.payload.result === "unknown" && fEvent.payload.checks === null
    && (fEvent.payload.reason ?? "").includes("declined") && fEvent.subjectMainAfter === foxMainAfter,
  JSON.stringify(fEvent));
if (opReceiver) await post(`/api/slots/${opReceiver}/kill`, {});

await setAuditMode("notrunnable");
const golf = await makeLane("golf");
await landLane(golf);
const g = newest(await waitRows(6));
// 126 vs 127 is the shell's business (macOS /bin/sh answers 126 for a failed exec, 127 for
// not-found) — what this asserts is that neither is mistaken for a suite that ran and failed
check("an audit command that cannot be STARTED records unknown, never green",
  g.result === "unknown" && (g.exitCode === 126 || g.exitCode === 127)
    && (g.reason ?? "").includes("could not be started"), JSON.stringify(g).slice(0, 300));

// the stand-in sleeps 30s against a 10s ceiling AND is a shell blocked in `wait`, so it does not
// die on the SIGTERM — i.e. exactly the wedged-process-tree shape. The row must still appear
// promptly: the server races the deadline instead of awaiting the child's pipes, because a hang
// that stalled the drain loop would silently disable tier 2 for every later land.
await setAuditMode("hang");
const hotel = await makeLane("hotel");
await landLane(hotel);
const hStart = Date.now();
const h = newest(await waitRows(7, 90_000));
check("an audit that TIMES OUT records unknown, never green",
  h.result === "unknown" && (h.reason ?? "").includes("timed out"), JSON.stringify(h).slice(0, 300));
check("the timeout is BOUNDED — a child that ignores SIGTERM does not hold the row (or the queue)",
  Date.now() - hStart < 20_000 && h.ms < 20_000, `waited=${Date.now() - hStart}ms row.ms=${h.ms}`);
// ...and neither does the IN-FLIGHT view. The run is cleared in the same turn its row is written,
// so a row that is readable proves the field was already released — a wedged child cannot leave a
// clock ticking on the board forever. Read directly rather than polled, because that ordering makes
// a poll meaningless: if it were not already null here, no amount of waiting is the fix.
check("a KILLED run leaves no forever-running field — the in-flight view is clear once the row exists",
  (await live()) === null, JSON.stringify(await live()));
check("every non-measurement still names the land it followed (an unknown is attributable)",
  f.covers[0]?.branch === fox.branch && g.covers[0]?.branch === golf.branch && h.covers[0]?.branch === hotel.branch,
  `${f.covers[0]?.branch} ${g.covers[0]?.branch} ${h.covers[0]?.branch}`);
check("no audit row anywhere in this run is green-by-accident (7 rows, 3 green + 1 red + 3 unknown)",
  (await auditRows()).filter((r) => r.result === "green").length === 3
    && (await auditRows()).filter((r) => r.result === "unknown").length === 3,
  JSON.stringify((await auditRows()).map((r) => r.result)));

// the two questions the trail exists to answer, asked the way a later step would ask them
const all = await auditRows(); // newest first
const lastGreen = all.find((r) => r.result === "green");
const firstRedIdx = all.findIndex((r) => r.result === "red");
check("the trail answers 'which land was the last green audit'",
  !!lastGreen && lastGreen.covers.map((c) => c.branch).includes(delta.branch), JSON.stringify(lastGreen?.covers));
check("the trail answers 'which lands came after a red one'",
  firstRedIdx >= 0 && all.slice(0, firstRedIdx + 1).flatMap((r) => r.covers.map((c) => c.branch)).join(",")
    === [hotel.branch, golf.branch, fox.branch, echoLane.branch].join(","),
  JSON.stringify(all.slice(0, firstRedIdx + 1).flatMap((r) => r.covers.map((c) => c.branch))));

// ===== (I) THE RUN IN FLIGHT IS VISIBLE, AND SO ARE THE LANDS STILL WAITING FOR ONE =============
// Everything above measures FINISHED audits. Until this projection existed there was no way to see
// a running one at all: `auditQueue` carries its entry through the run and `auditDraining` holds the
// lock, but neither reached a surface, so watching an audit meant polling `ps`. Two states had to
// become distinguishable, and both are asserted here:
//   · RUNNING — one run, its tree, its lands, and the clock's origin.
//   · WAITING — a land that arrived DURING a run is folded into the NEXT one (the coalescing
//     contract asserted in (D)). Those lands had no audit and no row, which on every surface looked
//     exactly like "no audit was ever planned" — one of the three signatures the steward's Rundgang
//     is asked to spot.
// Placed after (C) on purpose: the sections above assert exact row counts, the ones below take
// relative snapshots, so new rows belong here rather than earlier.

// (I.0) first the row the DISTRIBUTION must refuse. `exit143` is the shape of a run somebody killed
// — a red by exit code, a non-measurement in fact — and it is asserted as a red so that the check
// below is about the STATISTIC's filter and not about the verdict, which must not change.
await setAuditMode("exit143");
const mike = await makeLane("mike");
await landLane(mike);
const rowsWithKilled = await waitRows(8);
const killedRow = newest(rowsWithKilled);
check("(I) a run that was KILLED is still recorded red — the exit code decides the verdict, as before",
  killedRow.result === "red" && killedRow.exitCode === 143
    && killedRow.covers[0]?.branch === mike.branch, JSON.stringify(killedRow).slice(0, 300));

// (I.0b) THE PROCESS TREE, not just the process. The timeout path used to signal ONLY the child this
// server spawned — and that child is `sh -c`, which on Linux/dash FORKS the audit chain instead of
// exec'ing it, so the suite underneath survived both signals: it kept the suite mutex and its own
// scratch tmux socket while fleet had already written the row and was free to start the next audit
// against the same machine. runVerify was repaired for exactly this in 9e347f5 (descendantPids +
// killProcessTree, pid list taken BEFORE the first signal); this is the second path, which that
// lane's report left open.
//
// `hang` above cannot measure it. Its `sleep` dies of the SIGTERM its parent shell passes on, so a
// server with no tree staffel at all still looks tidy from the outside. `nokill` removes that
// accident: the stand-in shell AND its child ignore the term (the shape a real chain has while
// blocked in `wait`), and the stand-in publishes both pids. The question then has one answer and no
// inference in it — are those two processes still alive? Placed HERE, in the relative-snapshot half
// of the file, because it adds a row and every section above counts rows by absolute number.
await setAuditMode("nokill");
const nkPidFile = `${import.meta.dir}/auditpids`;
try { unlinkSync(nkPidFile); } catch { /* first run in this instance */ }
const november = await makeLane("november");
const rowsBeforeNokill = (await auditRows()).length;
await landLane(november);
const nkRow = newest(await waitRows(rowsBeforeNokill + 1, 90_000));
check("(I.0b) an audit whose whole tree ignores the term is still recorded unknown/timed-out — never a fabricated red or green",
  nkRow.result === "unknown" && (nkRow.reason ?? "").includes("timed out") && nkRow.exitCode === null
    && nkRow.checks === null && nkRow.covers[0]?.branch === november.branch,
  JSON.stringify(nkRow).slice(0, 300));
const nkPids = (() => {
  try { return readFileSync(nkPidFile, "utf8").split("\n").map(Number).filter((n) => n > 0); }
  catch { return []; }
})();
// this block's own precondition, failing as ITSELF rather than as the thing it measures: with no
// pids on file nothing below was measured, and a silent zero would read as "the tree is gone"
check("(I.0b) setup: the stand-in published its own pid and its term-ignoring child's (precondition — no pids, no measurement)",
  nkPids.length === 2 && nkPids[0] !== nkPids[1], JSON.stringify(nkPids));
const nkAlive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
// THE MEASUREMENT, and the separation IS it: the row is written ~1s after the 10s deadline, the
// SIGKILL stage lands 5s (POSTLAND_AUDIT_KILL_GRACE_MS) after the term that preceded it, and the
// stand-in's own exit is ~19s past the row. A 12s window therefore cannot be satisfied by a tree
// that merely finished — only by one that was killed. Polled rather than slept so a passing run
// costs the ~4s it takes, not the whole window.
const nkDeadline = (nkRow.at || Date.now()) + 12_000;
let nkLeft = nkPids;
while (nkPids.length > 0 && Date.now() < nkDeadline && (nkLeft = nkPids.filter(nkAlive)).length > 0)
  await Bun.sleep(150);
check("(I.0b) the WHOLE frozen tree is gone near timeout+grace — the shell that ignored the term and the child under it",
  nkPids.length === 2 && nkLeft.length === 0,
  JSON.stringify({ pids: nkPids, stillAlive: nkLeft, waitedMs: Date.now() - (nkRow.at || Date.now()), standInExitsAt: "~row+19s" }));
// …and the next audit measures its own tree rather than colliding with the last one's leftovers.
// The ordering is the claim: the check above ran BEFORE this land, so the old tree was already gone
// when this run started. A row that says green with real check lines is what proves the machine
// underneath it was free.
await setAuditMode("green");
const oscar = await makeLane("oscar");
const rowsBeforeOscar = (await auditRows()).length;
await landLane(oscar);
const oscarRow = newest(await waitRows(rowsBeforeOscar + 1, 60_000));
check("(I.0b) the audit AFTER a killed one runs clean — no overlap with the old child tree",
  oscarRow.result === "green" && oscarRow.exitCode === 0 && (oscarRow.checks?.ran ?? 0) > 0
    && oscarRow.checks?.failed === 0 && oscarRow.covers[0]?.branch === oscar.branch,
  JSON.stringify(oscarRow).slice(0, 300));

// (I.1) the in-flight view itself. `long` (12s) is roomy enough that a whole second land fits inside
// the window — settle is paid up front for both lanes, as in (D).
await setAuditMode("long");
const kilo = await makeLane("kilo");
const limaLane = await makeLane("lima");
await settleForMerge(kilo.slot);
await settleForMerge(limaLane.slot);
const rowsBeforeInflight = (await auditRows()).length;
const kLandStart = Date.now();
const kLanded = await landLane(kilo);
const inflight = await waitLive((l) => l?.running?.phase === "running");
const run = inflight?.running ?? null;
check("(I) a running audit is VISIBLE while it runs — the field the board polls is set, not null",
  kLanded.gone && run !== null && run.phase === "running", JSON.stringify(inflight).slice(0, 300));
check("(I) it names the tree it is measuring — repo, integration branch, and the tip once resolved",
  run?.repo === "testrepo" && run?.main === "main" && (run?.mainSha ?? "").length === 40,
  `${run?.repo} ${run?.main} ${run?.mainSha}`);
check("(I) it names the land it stands for", JSON.stringify(run?.covers) === JSON.stringify([kilo.branch]),
  JSON.stringify(run?.covers));
// the clock's ORIGIN, which is the whole point of the field: the client derives the elapsed time
// from it. It must sit between the land that triggered the run and now — an origin outside that
// window would render a runtime that is simply wrong.
check("(I) it carries startedAt, and it is the real start (after the land, not after now)",
  typeof run?.startedAt === "number" && run.startedAt > kLandStart && run.startedAt <= Date.now(),
  `startedAt=${run?.startedAt} landStarted=${kLandStart} now=${Date.now()}`);
// (I.1b) VERB 2's PRECONDITION, and this is the only harness where it can be reached at all: the
// main suite runs with tier 2 unconfigured, so `runningPostLandAudit` is null there by construction.
// The deploy verb kills srv; the audit QUEUE survives that (section (E) below), the RUNNER does not
// — and an audit killed mid-run lands in the register as a RED that measured nothing (measured
// 2026-08-06: exit 143 after 15.6 s, zero checks run, adjudicated `unknowable`). So the verb refuses
// while a run is in flight, and it refuses ITSELF rather than trusting its caller to check.
const depRefused = await post("/api/deploy", {});
const depBody = (await depRefused.json()) as { ok: unknown; stage?: string; reason?: string };
check("(I) the deploy verb REFUSES while a post-land audit runs — a killed audit is a red that measured nothing",
  depRefused.status === 409 && depBody.ok === false && depBody.stage === "preflight"
    && /post-land audit/.test(depBody.reason ?? ""), `${depRefused.status} ${JSON.stringify(depBody)}`);
// the refusal is a NO-OP, not a partial deploy: it rejects before the build and before the kill.
const stillRunning = await waitLive((l) => l?.running?.phase === "running");
check("(I) ...and the refusal costs nothing — the audit still runs and srv was never killed",
  JSON.stringify(stillRunning?.running?.covers) === JSON.stringify([kilo.branch])
    && (await get("/api/sessions")).ok, JSON.stringify(stillRunning?.running));

// (I.2) the distribution that makes the elapsed number answerable. The filter is the assertion: the
// trail at this moment holds 4 green + 2 red + 4 unknown, and exactly ONE of those reds is the
// killed run from (I.0). So the sample must be 5 — not 10 (everything), not 6 (unknowns excluded but
// the killed run kept). Anything else and the numbers are being drawn from non-measurements.
const trailNow = await auditRows();
const verdicts = trailNow.filter((r) => r.result === "green" || r.result === "red").length;
check("(I) p50/p90 are computed only from runs that MEASURED something — unknowns and the killed run are out",
  inflight?.stats?.n === verdicts - 1 && verdicts - 1 > 0,
  `n=${inflight?.stats?.n} verdicts=${verdicts} rows=${trailNow.length}`);
check("(I) ...and the percentiles are real durations, ordered",
  (inflight?.stats?.p50 ?? 0) > 0 && (inflight?.stats?.p90 ?? 0) >= (inflight?.stats?.p50 ?? 0),
  JSON.stringify(inflight?.stats));

// (I.3) a second land WHILE that run is in flight. It must appear as waiting — never as a second
// running audit, which the coalescing contract makes impossible and this view must not imply.
const lLanded = await landLane(limaLane);
const both = await waitLive((l) => l?.waiting.some((w) => w.branch === limaLane.branch) === true);
const waitingLima = both?.waiting.find((w) => w.branch === limaLane.branch) ?? null;
check("(I) a land that arrives DURING a run shows up as WAITING, with the moment it landed",
  lLanded.gone && waitingLima !== null && waitingLima.repo === "testrepo"
    && waitingLima.main === "main" && waitingLima.mainAfter === headOf()
    // the sharp claim: this land queued AFTER the run in flight had already started
    && waitingLima.at > (run?.startedAt ?? 0) && waitingLima.at <= Date.now(), JSON.stringify(both?.waiting));
check("(I) ...and it does NOT become a second running audit — one run, still the first one's lands",
  both?.running?.phase === "running"
    && JSON.stringify(both.running.covers) === JSON.stringify([kilo.branch]),
  JSON.stringify(both?.running));
// "waiting" and "no audit planned" are the two states this section exists to separate: the waiting
// land has no row of its own yet, and that is exactly what used to make the two look alike.
check("(I) the waiting land has no audit ROW yet — waiting is a state, not a missing audit",
  !(await auditRows()).some((r) => r.covers.some((c) => c.branch === limaLane.branch)),
  JSON.stringify((await auditRows()).map((r) => r.covers.map((c) => c.branch))));

// (I.4) and it all goes away. `green` so the coalesced follow-up finishes at once rather than
// costing another 12s.
await setAuditMode("green");
const inflightRows = await waitRows(rowsBeforeInflight + 2, 60_000);
const settled = await waitLive((l) => l === null);
check("(I) once every run has finished the view is null again — null means idle, never 'unknown'",
  settled === null, JSON.stringify(settled));
check("(I) both lands ended up on the ledger — the view is a window on the queue, it consumes nothing",
  inflightRows.some((r) => r.covers.some((c) => c.branch === kilo.branch))
    && inflightRows.some((r) => r.covers.some((c) => c.branch === limaLane.branch)),
  JSON.stringify(inflightRows.slice(0, 2).map((r) => r.covers.map((c) => c.branch))));

// ===== (E) THE PENDING QUEUE SURVIVES THE SERVER — the deploy ritual raced the audit ============
// Measured incident (docs/attic/mining-2026-07-26.md finding 1): four lands, then a srv restart seconds
// later, then nothing — no rows, no unknowns, indistinguishable from "nothing landed". The queue
// was in memory only, and land-then-deploy is the COMMON case for server-touching lanes. Everything
// below runs LAST on purpose: it restarts the server, and the sections above assert exact row counts.
await setAuditMode("crash"); // 25s — long enough to kill srv with the audit demonstrably in flight
const rowsBeforeCrash = (await auditRows()).length;
const india = await makeLane("india");
const iLanded = await landLane(india);
// wait for the suite to actually START before killing the server: the point of this case is a
// death MID-RUN, and the drain spends a moment on rev-parse + git archive before spawning
const crashRun = await waitRunMode("crash", 1);
// free, and the pairing is the point: the durable queue file and the live view describe the SAME
// run from two sides — one for the process that dies, one for the owner watching it not finish.
const liveBeforeDeath = await waitLive((l) => l?.running?.covers.includes(india.branch) === true, 10_000);
check("(I) the in-flight view names the run that is about to be lost to the restart",
  liveBeforeDeath?.running?.phase === "running"
    && liveBeforeDeath.running.covers.includes(india.branch), JSON.stringify(liveBeforeDeath).slice(0, 300));
const queuedOnDisk = await readQueueFile();
check("a land's pending audit is written to the durable queue file, naming the land and its repo",
  iLanded.gone && queuedOnDisk !== null
    && Object.values(queuedOnDisk).some((q) => q.covers.some((c) => c.branch === india.branch)),
  JSON.stringify(queuedOnDisk));
await killSrv();
const rowsAtDeath = trailRows(); // read from the file — there is no server to ask
check("setup: the audit was still in flight when the server died (no row was written)",
  crashRun === 1 && rowsAtDeath.length === rowsBeforeCrash,
  `runsStarted=${crashRun} rowsBefore=${rowsBeforeCrash} rowsAtDeath=${rowsAtDeath.length}`);
// the entry OUTLIVES its own run: an in-flight-at-death audit is still pending on disk, which is
// the ordering fix (the drain used to consume the entry before running the suite)
const queuedAfterDeath = await readQueueFile();
check("an audit that died MID-RUN is still pending on disk — the entry outlives its run, not vice versa",
  queuedAfterDeath !== null
    && Object.values(queuedAfterDeath).some((q) => q.covers.some((c) => c.branch === india.branch)),
  JSON.stringify(queuedAfterDeath));

await setAuditMode("green");
check("the restarted server came back up", await startSrv({ audit: true }));
const iRows = await waitRows(rowsBeforeCrash + 1, 60_000);
const i = newest(iRows);
check("the restarted server RESUMES the lost audit — a row appears for the land it never audited",
  i.result === "green" && i.covers.some((c) => c.branch === india.branch),
  JSON.stringify(i).slice(0, 300));
check("the resumed audit ran against the CURRENT integration tip (the fold-up rule, across a restart)",
  i.mainSha === headOf(), `audited=${i.mainSha} head=${headOf()}`);
check("the queue file is emptied once the row exists (absent = nothing pending)",
  (await readQueueFile()) === null, JSON.stringify(await readQueueFile()));

// ===== (F) A CLEAN RESTART AUDITS NOTHING — exactly one row per land, no double-audit ===========
const rowsBeforeCleanRestart = (await auditRows()).length;
await killSrv();
check("the server came back up from a clean (empty-queue) shutdown", await startSrv({ audit: true }));
await Bun.sleep(3000); // give a (wrong) resumed run time to appear before asserting there is none
const afterClean = await auditRows();
check("a restart with nothing pending starts NO audit (the queue is a work list, not a trigger)",
  afterClean.length === rowsBeforeCleanRestart, `before=${rowsBeforeCleanRestart} after=${afterClean.length}`);
check("the resumed land was audited exactly ONCE across the whole run — no double-audit",
  afterClean.filter((r) => r.covers.some((c) => c.branch === india.branch)).length === 1,
  JSON.stringify(afterClean.filter((r) => r.covers.some((c) => c.branch === india.branch)).map((r) => r.covers)));

// ===== (G) UNCONFIGURED ≠ SKIPPED — a boot without a tier-2 command leaves the queue alone =======
// Same three-valued stance as the verify gate: a server that cannot measure has not decided the
// lands are fine. It must not quietly drop them, and it must not fabricate a row either.
await setAuditMode("crash");
const rowsBeforeUnconf = (await auditRows()).length;
const juliett = await makeLane("juliett");
await landLane(juliett);
await waitRunMode("crash", 2);
await killSrv();
const queueBytesAtDeath = await readQueueRaw();
check("setup: the second crash left the juliett land pending on disk",
  queueBytesAtDeath.includes(juliett.branch), queueBytesAtDeath.slice(0, 200));
check("the server came back up WITHOUT a tier-2 command", await startSrv({ audit: false }));
await Bun.sleep(3000);
check("a boot with FLEET_POSTLAND_AUDIT_CMD unset leaves the queue file BYTE-FOR-BYTE untouched",
  (await readQueueRaw()) === queueBytesAtDeath, (await readQueueRaw()).slice(0, 200));
check("...and fabricates no row for it (unconfigured is not a verdict)",
  (await auditRows()).length === rowsBeforeUnconf, `before=${rowsBeforeUnconf} after=${(await auditRows()).length}`);
await setAuditMode("green");
await killSrv();
check("the server came back up with tier 2 configured again", await startSrv({ audit: true }));
const jRows = await waitRows(rowsBeforeUnconf + 1, 60_000);
const j = newest(jRows);
check("configuring the command and restarting DRAINS what the unconfigured boot preserved",
  j.result === "green" && j.covers.some((c) => c.branch === juliett.branch), JSON.stringify(j).slice(0, 300));
check("the queue file is gone once that row exists too", (await readQueueFile()) === null,
  JSON.stringify(await readQueueFile()));

// ===== (H) A RED CAN BE ADJUDICATED — and adjudicating it never launders it into a pass =========
// The gap this closes (measured 2026-08-05 on the live trail: 36 runs, 13 red, 0 judgements): a row
// had no field a verdict fits in, so every red stayed permanently ambiguous between "nobody looked"
// and "looked, it was noise" — and that ambiguity is what trains the reflex of scrolling past red.
// Everything here runs LAST, after the restart sections, for the same reason they do: it appends to
// the trail and would otherwise disturb the exact row counts asserted above.
type Adj = { verdict: string; at: number; by: string; note?: string };
type AdjRow = AuditRow & { adjudication?: Adj };
const adjRows = async (): Promise<AdjRow[]> => (await auditRows()) as AdjRow[];
const rowAt = async (at: number): Promise<AdjRow | undefined> => (await adjRows()).find((r) => r.at === at);
const RAIL_FILE = `${import.meta.dir}/audit-adjudications.jsonl`;
const railRows = (): { auditAt?: number; verdict?: string; by?: string }[] => {
  try {
    return readFileSync(RAIL_FILE, "utf8").split("\n").filter(Boolean)
      .map((l) => JSON.parse(l) as { auditAt?: number; verdict?: string; by?: string });
  } catch { return []; }
};

const allH = await adjRows();
const theRed = allH.find((r) => r.result === "red") ?? NO_ROW as AdjRow;
const aGreen = allH.find((r) => r.result === "green") ?? NO_ROW as AdjRow;
check("(H) fixture: the run's real red row and a green neighbour are both on the trail, both unjudged",
  theRed.result === "red" && aGreen.result === "green"
    && theRed.adjudication === undefined && aGreen.adjudication === undefined,
  `red@${theRed.at} green@${aGreen.at} adj=${JSON.stringify(theRed.adjudication)}`);

// the credential. The full six-principal matrix lives in e2e/security.ts; what belongs HERE is that
// the route is not open at all — a judgement is evidence, and evidence anyone can write is not.
const anon = await fetch(`${BASE}/api/post-land-audits/adjudicate`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ at: theRed.at, verdict: "flake" }),
});
check("(H) adjudicating requires the owner token — an unauthenticated write is refused",
  anon.status === 401 || anon.status === 403, String(anon.status));
check("(H) ...and it wrote nothing: the row is still unjudged",
  (await rowAt(theRed.at))?.adjudication === undefined,
  JSON.stringify((await rowAt(theRed.at))?.adjudication));

// a key that names nothing is a typo, not a judgement — accepting it would put a verdict on the
// rail that no reader could ever join back to anything
const ghost = await post("/api/post-land-audits/adjudicate", { at: 1, verdict: "real" });
check("(H) an unknown audit key is 404, never a dangling judgement", ghost.status === 404, String(ghost.status));
const badVerdict = await post("/api/post-land-audits/adjudicate", { at: theRed.at, verdict: "probably-fine" });
check("(H) the verdict vocabulary is a CLOSED set — a free-text verdict is refused",
  badVerdict.status === 400, String(badVerdict.status));
const longNote = "x".repeat(301);
const capped = await post("/api/post-land-audits/adjudicate", { at: theRed.at, verdict: "flake", note: longNote });
check("(H) the note cap is enforced SERVER-SIDE (301 chars → 400), not trusted to the client",
  capped.status === 400, `${capped.status} ${(await capped.text()).slice(0, 120)}`);
check("(H) ...and none of the three rejected calls left a judgement behind",
  (await rowAt(theRed.at))?.adjudication === undefined && railRows().length === 0,
  `adj=${JSON.stringify((await rowAt(theRed.at))?.adjudication)} rail=${railRows().length}`);

// the write itself, and THE property: `result` survives it untouched.
const before = await rowAt(theRed.at);
const okRes = await post("/api/post-land-audits/adjudicate",
  { at: theRed.at, verdict: "flake", note: "known reseed race, reran the same tree green" });
const okJ = (await okRes.json()) as { ok?: boolean; adjudication?: Adj; result?: string };
check("(H) the owner's judgement is accepted and echoes the row's result back UNCHANGED",
  okRes.ok && okJ.ok === true && okJ.result === "red" && okJ.adjudication?.verdict === "flake",
  JSON.stringify(okJ).slice(0, 240));
const after = await rowAt(theRed.at);
check("(H) an adjudicated red IS STILL RED — every field of the audit row is byte-identical",
  !!after && after.result === "red"
    && JSON.stringify({ ...after, adjudication: undefined }) === JSON.stringify({ ...before, adjudication: undefined }),
  `${JSON.stringify(before).slice(0, 160)} → ${JSON.stringify(after).slice(0, 160)}`);
check("(H) the judgement rides ON the row: verdict, when, by whom, and one line of why",
  after?.adjudication?.verdict === "flake" && after.adjudication.by === "owner"
    && typeof after.adjudication.at === "number" && after.adjudication.at > 0
    && (after.adjudication.note ?? "").includes("reseed race"),
  JSON.stringify(after?.adjudication));
check("(H) `by` is stamped server-side — a body cannot claim someone else made the call",
  (await (await post("/api/post-land-audits/adjudicate",
    { at: theRed.at, verdict: "flake", by: "the-machine", note: "spoof attempt" })).json() as { adjudication?: Adj })
    .adjudication?.by === "owner");
// the join is KEYED, not blanket — judging one row must not quiet its neighbours
check("(H) a red WITHOUT a judgement is distinguishable from one WITH: the green neighbour stays unjudged",
  (await rowAt(aGreen.at))?.adjudication === undefined && (await rowAt(theRed.at))?.adjudication !== undefined,
  `green=${JSON.stringify((await rowAt(aGreen.at))?.adjudication)}`);

// a mis-judgement is corrected by judging again: newest wins, and the rail keeps the whole history
await post("/api/post-land-audits/adjudicate", { at: theRed.at, verdict: "real", note: "reran it — it reproduces" });
const revised = await rowAt(theRed.at);
check("(H) re-adjudicating supersedes: the row reads the newest verdict, the rail keeps every one",
  revised?.adjudication?.verdict === "real" && (revised.adjudication.note ?? "").includes("reproduces")
    && railRows().filter((r) => r.auditAt === theRed.at).length === 3,
  `${JSON.stringify(revised?.adjudication)} rail=${JSON.stringify(railRows())}`);

// ===== (H2) THE BACKFILL — reds that PREDATE signal-first retention are unanswerable, not open ===
// Eight of the live trail's thirteen reds were produced before the retention fix (70cd443): their
// retained output is a blind char-tail that cannot name what failed, so they are not open questions.
// Two synthetic rows bracket the cutoff — the modern one is the control that keeps this from passing
// against a backfill that simply judges every red it can find.
const OLD_AT = 1_700_000_000_000; // comfortably before SIGNAL_FIRST_RETENTION_AT
const NEW_AT = Date.now();
const synth = (at: number, sha: string): string => `${JSON.stringify({ at, startedAt: at, ms: 1, repo: REPO,
  main: "main", mainSha: sha, result: "red", cmd: "x", exitCode: 1, out: "6 FAILURES", covers: [] })}\n`;
appendFileSync(`${import.meta.dir}/post-land-audits.jsonl`, synth(OLD_AT, "oldredsha") + synth(NEW_AT, "newredsha"));
await killSrv();
check("(H2) the server came back up over a trail carrying a pre-retention red", await startSrv({ audit: true }));
const oldRow = await rowAt(OLD_AT);
const newRow = await rowAt(NEW_AT);
check("(H2) a red predating signal-first retention is backfilled `unknowable`, stamped as a backfill",
  oldRow?.result === "red" && oldRow.adjudication?.verdict === "unknowable"
    && oldRow.adjudication.by === "backfill" && (oldRow.adjudication.note ?? "").includes("predates"),
  JSON.stringify(oldRow?.adjudication));
check("(H2) control: a red from AFTER the cutoff is left alone — the backfill judges no live question",
  newRow?.result === "red" && newRow.adjudication === undefined, JSON.stringify(newRow?.adjudication));
check("(H2) the owner's own judgements survived the restart (the rail is durable, like every trail)",
  (await rowAt(theRed.at))?.adjudication?.verdict === "real", JSON.stringify((await rowAt(theRed.at))?.adjudication));
const railAfter = railRows().length;
await killSrv();
check("(H2) the server came back up a second time", await startSrv({ audit: true }));
await Bun.sleep(500);
check("(H2) the backfill is IDEMPOTENT — a second boot adds no second judgement",
  railRows().length === railAfter && (await rowAt(OLD_AT))?.adjudication?.by === "backfill",
  `rail=${railRows().length} was=${railAfter}`);
check("(H2) old ledger rows tolerate an absent checks field without manufacturing zero",
  (await rowAt(OLD_AT))?.checks === undefined && (await rowAt(NEW_AT))?.checks === undefined,
  `old=${JSON.stringify((await rowAt(OLD_AT))?.checks)} new=${JSON.stringify((await rowAt(NEW_AT))?.checks)}`);

// ===== (J) CHECK COUNTS + THE ONE-SHOT RED-AUDIT EVENT =========================================
// Runs last: it deliberately enables the new scheduler, opens negative receiver fixtures, and
// restarts over both pending and delivered markers. Every earlier section therefore continues to
// prove the old default-off audit path without a background prompt racing its exact row counts.

// Close every historical red first. The ping below must have exactly ONE event in its population;
// otherwise a successful prompt could name an older row and make all receiver checks vacuous.
for (const r of await adjRows()) {
  if (r.result === "red" && r.adjudication === undefined)
    await post("/api/post-land-audits/adjudicate",
      { at: r.at, verdict: "unknowable", note: "e2e setup: historical red is not the ping subject" });
}
for (let i = 0; i < 40; i++) {
  const openReds = (await adjRows()).filter((r) => r.result === "red" && r.adjudication === undefined);
  if (!openReds.length) break;
  await Bun.sleep(100);
}
check("(J) ping fixture starts with no historical unadjudicated red",
  (await adjRows()).every((r) => r.result !== "red" || r.adjudication !== undefined),
  JSON.stringify((await adjRows()).filter((r) => r.result === "red" && !r.adjudication).map((r) => r.at)));

// Contradictory output is not a licence to turn uncertainty into zero. The process did run and
// printed one FAIL line, but its terminal count says two; null is the only honest derived value.
await setAuditMode("garbled");
const rowsBeforeGarbled = (await auditRows()).length;
const garbledLane = await makeLane("november-garbled");
await landLane(garbledLane);
const garbled = newest(await waitRows(rowsBeforeGarbled + 1));
check("(J) an internally inconsistent suite output records checks:null — never {0,0}",
  garbled.result === "red" && garbled.checks === null && garbled.covers[0]?.branch === garbledLane.branch,
  JSON.stringify(garbled).slice(0, 320));
const garbledAdj = await post("/api/post-land-audits/adjudicate",
  { at: garbled.at, verdict: "unknowable", note: "contradictory check summary" });
check("(J) the unparseable red is adjudicated before the ping is enabled", garbledAdj.ok, String(garbledAdj.status));

// Exact incident shape from the brief: the command starts and exits 1 on a stack-shaped ENOENT,
// before the first check() result line. Complete output with zero PASS/FAIL lines means measured
// ran:0; it is categorically different from the contradictory output above.
await setAuditMode("precheck");
const rowsBeforePrecheck = (await auditRows()).length;
const precheckLane = await makeLane("oscar-precheck");
await landLane(precheckLane);
const precheck = newest(await waitRows(rowsBeforePrecheck + 1));
check("(J) a suite that dies before its first check records ran:0/failed:0",
  precheck.result === "red" && precheck.exitCode === 1
    && precheck.checks?.ran === 0 && precheck.checks.failed === 0
    && precheck.out.includes("ENOENT"), JSON.stringify(precheck).slice(0, 360));

const PING_PREFIX = "[fleet post-land audit]";
const pingPrompts = async () => {
  try { return (await plogRead()).filter((p) => p.source === "auto" && p.text.startsWith(PING_PREFIX)); }
  catch { return []; } // no composed prompt yet = the expected default-off state
};
await Bun.sleep(750);
check("(J) FLEET_AUDIT_PING_MS=0 leaves the red event entirely uncalled",
  (await pingPrompts()).length === 0 && (await rowAt(precheck.at))?.ping === undefined,
  JSON.stringify((await pingPrompts()).map((p) => p.slot)));

// No inherited receiver may accidentally satisfy the first pending-state check.
// `awaiting` is deliberately NOT on this type: the owner poll does not carry it (it lives on the
// steward's laneSignalView). A cast that claimed it would make `s.awaiting === "owner"` compile and
// then be false forever — a probe that cannot measure, failing as if the filter were broken.
type PingSlot = { id: number; cwd: string | null; label: string | null;
  worktree: unknown | null; lastOutput: number };
const pingSlots = async (): Promise<PingSlot[]> =>
  ((await (await get("/api/sessions")).json()) as { slots: PingSlot[] }).slots;
for (const s of await pingSlots()) if (s.cwd) await post(`/api/slots/${s.id}/kill`, {});
await Bun.sleep(300);
await killSrv();
check("(J) the server comes up with the audit ping explicitly enabled", await startSrv({ audit: true, auditPing: true }));

const waitPing = async (at: number, want: (p: NonNullable<AuditRow["ping"]>) => boolean,
  timeoutMs = 10_000): Promise<AuditRow | undefined> => {
  const deadline = Date.now() + timeoutMs;
  let seen: AuditRow | undefined;
  while (Date.now() < deadline) {
    seen = await rowAt(at);
    if (seen?.ping && want(seen.ping)) return seen;
    await Bun.sleep(100);
  }
  return seen;
};
const noReceiver = await waitPing(precheck.at, (p) => p.status === "pending" && p.lastResult.includes("no eligible"));
check("(J) with no session the EVENT stays pending and says why on its audit row",
  noReceiver?.ping?.status === "pending" && noReceiver.ping.lastResult.includes("no eligible main session"),
  JSON.stringify(noReceiver?.ping));
const persistedPending = JSON.parse(readFileSync(`${import.meta.dir}/fleet.json`, "utf8")) as
  { auditPings?: Record<string, { status?: string; lastResult?: string }> };
check("(J) the no-receiver state is durable, not a process-only excuse",
  persistedPending.auditPings?.[String(precheck.at)]?.status === "pending"
    && (persistedPending.auditPings[String(precheck.at)]?.lastResult ?? "").includes("no eligible"),
  JSON.stringify(persistedPending.auditPings?.[String(precheck.at)]));

// Arm quiet hours before opening the filter fixtures: the awaiting fixture is a plain session for
// one short setup window, and must not receive the event before its persisted flag is installed.
const hour = new Date().getHours();
await post("/api/autos/quiet", { start: hour, end: (hour + 1) % 24 });
const negativeLane = await makeLane("papa-ping-negative-lane");
let free = (await pingSlots()).filter((s) => !s.cwd).map((s) => s.id);
check("(J) filter fixture has room for steward, awaiting-owner and receiver", free.length >= 3, `free=[${free}]`);
const stewardId = free[0] ?? 0;
const awaitingId = free[1] ?? 0;
const negativeOpens = stewardId && awaitingId ? await Promise.all([
  post(`/api/slots/${stewardId}/open`, { cwd: REPO, label: "⚙ steward" }),
  post(`/api/slots/${awaitingId}/open`, { cwd: REPO }),
]) : [];
check("(J) steward and plain-awaiting fixtures open", negativeOpens.length === 2 && negativeOpens.every((r) => r.ok),
  negativeOpens.map((r) => r.status).join(","));
await Bun.sleep(300);
await killSrv();
const stateWithAwaiting = JSON.parse(readFileSync(`${import.meta.dir}/fleet.json`, "utf8")) as
  { slots?: Record<string, { awaiting?: "owner" }> };
if (stateWithAwaiting.slots?.[String(awaitingId)]) stateWithAwaiting.slots[String(awaitingId)]!.awaiting = "owner";
await Bun.write(`${import.meta.dir}/fleet.json`, `${JSON.stringify(stateWithAwaiting)}\n`);
check("(J) restart with a pending marker and filtered sessions succeeds",
  await startSrv({ audit: true, auditPing: true }));
const afterPendingRestart = await waitPing(precheck.at, (p) => p.status === "pending");
const loadedNegatives = await pingSlots();
// The awaiting-owner half is read from the state file the server just loaded, not from the poll —
// see PingSlot above. Own check, so "the flag did not survive the restart" can never arrive dressed
// as "the filter is broken".
const reloadedAwaiting = (JSON.parse(readFileSync(`${import.meta.dir}/fleet.json`, "utf8")) as
  { slots?: Record<string, { awaiting?: string }> }).slots?.[String(awaitingId)]?.awaiting ?? null;
check("(J) the awaiting-owner flag survived the restart (the fixture the filter is about)",
  reloadedAwaiting === "owner", `awaiting=${reloadedAwaiting}`);
check("(J) pending survives restart; lane, ⚙ steward and awaiting-owner remain ineligible",
  afterPendingRestart?.ping?.status === "pending"
    && loadedNegatives.find((s) => s.id === negativeLane.slot)?.worktree !== null
    && loadedNegatives.find((s) => s.id === stewardId)?.label === "⚙ steward"
    && reloadedAwaiting === "owner",
  JSON.stringify({ ping: afterPendingRestart?.ping, awaiting: reloadedAwaiting,
    slots: loadedNegatives.filter((s) => [negativeLane.slot, stewardId, awaitingId].includes(s.id)) }));

free = loadedNegatives.filter((s) => !s.cwd).map((s) => s.id);
const receiver = free[0] ?? 0;
const receiverOpen = receiver ? await post(`/api/slots/${receiver}/open`, { cwd: REPO }) : null;
const freshReceiver = (await pingSlots()).find((s) => s.id === receiver);
check("(J) the only eligible main opens UNOBSERVED (lastOutput=0)",
  receiverOpen?.ok === true && freshReceiver?.worktree === null && freshReceiver.lastOutput === 0,
  JSON.stringify(freshReceiver));
const unobserved = await waitPing(precheck.at,
  (p) => p.status === "pending" && p.lastResult.includes("unobserved"), 5000);
check("(J) an unobserved pane is UNKNOWN, never idle permission, and no negative recipient fires",
  unobserved?.ping?.status === "pending" && unobserved.ping.lastResult.includes("unobserved")
    && (await pingPrompts()).length === 0, JSON.stringify(unobserved?.ping));

// Let openSlot's repaint quiet window pass, then make observation deterministic through paneEnv.
// Quiet hours still hold, so a now-observed and idle receiver must remain pending for THAT reason.
await Bun.sleep(1700);
const receiverProbe = await paneEnv(`s${receiver}`, "FLEET_SELF_SLOT");
await Bun.sleep(400);
const quietHeld = await waitPing(precheck.at,
  (p) => p.status === "pending" && p.lastResult.includes("quiet-hours"), 5000);
check("(J) quiet hours are honored even after a receiver is observed and idle",
  receiverProbe === String(receiver) && quietHeld?.ping?.status === "pending"
    && quietHeld.ping.lastResult.includes("quiet-hours") && (await pingPrompts()).length === 0,
  `probe=${receiverProbe} ping=${JSON.stringify(quietHeld?.ping)}`);

await post("/api/autos/quiet", { start: null });
const delivered = await waitPing(precheck.at, (p) => p.status === "delivered", 10_000);
const deliveredPrompts = await pingPrompts();
check("(J) clearing quiet hours delivers the red event to exactly ONE eligible main session",
  delivered?.ping?.status === "delivered" && delivered.ping.slot === receiver
    && deliveredPrompts.length === 1 && deliveredPrompts[0]?.slot === receiver
    && ![negativeLane.slot, stewardId, awaitingId].includes(deliveredPrompts[0]?.slot ?? 0),
  JSON.stringify({ ping: delivered?.ping, prompts: deliveredPrompts.map((p) => p.slot) }));
const pingText = deliveredPrompts[0]?.text ?? "";
check("(J) the ping carries the facts needed to judge the zero-check red",
  pingText.includes(`at=${precheck.at}`) && pingText.includes(precheck.mainSha)
    && pingText.includes(precheckLane.branch) && pingText.includes("result: red · exitCode: 1")
    && pingText.includes("checks.ran: 0 · checks.failed: 0")
    && pingText.includes("NICHTS wurde gemessen; dieses Rot ist keine Aussage über den Baum")
    && pingText.includes("ENOENT") && pingText.includes("Letzte bis zu 15 Zeilen"),
  pingText.slice(0, 700));
check("(J) the ping names the adjudication API/vocabulary and says adjudication cannot green the red",
  pingText.includes("POST /api/post-land-audits/adjudicate {at, verdict, note}")
    && ["real", "flake", "stale-test", "unknowable"].every((v) => pingText.includes(v))
    && pingText.includes("bleibt dabei rot"), pingText.slice(-500));

await Bun.sleep(1000);
check("(J) repeated ticks do not repeat a delivered EVENT",
  (await pingPrompts()).length === 1, JSON.stringify((await pingPrompts()).map((p) => p.slot)));
// A new session is not a new event identity. Observe it so every delivery gate is genuinely open;
// the persisted at-marker, not an incidental busy/unobserved hold, must be what prevents a repeat.
const laterFree = (await pingSlots()).find((s) => !s.cwd)?.id ?? 0;
const laterOpen = laterFree ? await post(`/api/slots/${laterFree}/open`, { cwd: REPO }) : null;
await Bun.sleep(1700);
const laterProbe = laterFree ? await paneEnv(`s${laterFree}`, "FLEET_SELF_SLOT") : null;
await Bun.sleep(500);
check("(J) a new eligible session never receives an event already delivered by audit-at identity",
  laterOpen?.ok === true && laterProbe === String(laterFree) && (await pingPrompts()).length === 1,
  `later=${laterFree} probe=${laterProbe} prompts=${JSON.stringify((await pingPrompts()).map((p) => p.slot))}`);

await killSrv();
check("(J) the server restarts over the delivered marker", await startSrv({ audit: true, auditPing: true }));
await Bun.sleep(750);
const afterDeliveredRestart = await rowAt(precheck.at);
check("(J) delivered stays delivered across restart and is still exactly once",
  afterDeliveredRestart?.ping?.status === "delivered" && afterDeliveredRestart.ping.slot === receiver
    && (await pingPrompts()).length === 1,
  JSON.stringify({ ping: afterDeliveredRestart?.ping, prompts: (await pingPrompts()).map((p) => p.slot) }));
check("(J) an already-adjudicated red is never pinged",
  !(await pingPrompts()).some((p) => p.text.includes(`at=${garbled.at}`) || p.text.includes(garbledLane.branch)),
  JSON.stringify((await pingPrompts()).map((p) => p.text.slice(0, 100))));

// A remote red already carries exact failed-check names on its ledger row. Add that persisted row
// directly: this section is about the reader's message, not another helper transport round-trip.
const namedAt = Date.now();
const namedFails = ["remote failure alpha", "remote failure beta"];
appendFileSync(`${import.meta.dir}/post-land-audits.jsonl`, `${JSON.stringify({
  at: namedAt, startedAt: namedAt - 10, ms: 10, repo: REPO, main: "main", mainSha: precheck.mainSha,
  result: "red", cmd: "remote helper (fixture): ./e2e-isolated.sh", exitCode: 1,
  out: "2 FAILURES", fails: namedFails, checks: { ran: 2, failed: 2, ranIsLowerBound: true },
  covers: [{ branch: "fleet/named-red-fixture", mainAfter: precheck.mainSha, at: namedAt - 10 }],
  remote: { name: "fixture helper", claimedAt: namedAt - 10, reportedAt: namedAt },
})}\n`);
const namedDelivered = await waitPing(namedAt, (p) => p.status === "delivered", 10_000);
const namedPingText = (await pingPrompts()).find((p) => p.text.includes(`at=${namedAt}`))?.text ?? "";
check("(J) a red audit ping lists every persisted remote fail name instead of discarding them",
  namedDelivered?.ping?.status === "delivered"
    && namedFails.every((name) => namedPingText.includes(`FAIL  ${name}`))
    && namedPingText.includes("checks.ran (Untergrenze): 2"),
  namedPingText.slice(0, 900));

// ===== (P) A DOCS-ONLY LAND IS AUDITED BY THE SHORT CHAIN, AND IS NEVER OFFERED AWAY =============
// Owner decision 2026-09-04: a docs-only land gets the same proportional chain in tier 2 that its
// land gate already ran (install+pins), instead of the full suite. The measurement behind it, read
// off the ledger: 76f3376 and 10ba7af, one docs file each, drew a full suite apiece — 1562 s and
// 1530 s, both red, both flake — for no statement about anything.
//
// THE DECISION IS THE ENTRY'S, NOT THE LAND'S, because an audit measures a TREE: an entry is
// coalesced, so one code land folded into it puts the whole tip back on the full suite. Both halves
// are checked here, and each is written so a regression in the OTHER direction fails too — a server
// that always ran short would fail the mixed case, one that always ran full would fail the first.
//
// Placed immediately before (K) for exactly (K)'s reason: it seeds a second repo and adds rows, so
// every count it makes is RELATIVE and nothing above it moves.
// ITS OWN REPO, and that is not tidiness. The short chain is a property of the REPO
// (`[ -f fleet-e2e.ts ]`), so this section needs a repo carrying that sentinel, a runnable
// `e2e/pins.ts`, and a package.json + bun.lock for `bun install --frozen-lockfile`. Seeding those
// into the harness's shared REPO is what the first run of this section actually did, and it broke
// eleven (HD) checks: e2e/helper-daemon.ts LANDS its own root package.json into REPO so the
// daemon's verbatim install has something to answer, which overwrote this fixture's manifest while
// its bun.lock stayed — and `--frozen-lockfile` refuses exactly that mismatch (exit 1 → the whole
// daemon run reported `unknown`). A second repo keeps both fixtures true and leaves every other
// section's tree byte-identical to what it was before this slice.
const PREPO = `${import.meta.dir}/testrepo-proportional`;
await seedRepo(PREPO);
{
  //   · fleet-e2e.ts  — the sentinel both the gate's and the audit's guard test for
  //   · e2e/pins.ts   — what the short chain really runs. It prints suite-shaped PASS lines so the
  //     row's `checks` is a real count, and it NAMES the FLEET_* keys it was handed, so the
  //     `proportional:true` stamp is a claim about an environment a reader can reproduce.
  //     ITS THIRD PIN IS THE GIT SEAM (2026-09-05). The real e2e/pins.ts has six pins that ask git
  //     what this tree tracks, and a `git archive` snapshot carries no `.git`: for one deploy day
  //     every docs-only land was red with `fatal: not a git repository`, because the proportional
  //     chain runs NAKED here — no wrapper, none of the staging `./e2e-isolated.sh` does. Those six
  //     pins behaved correctly (each failed as ITSELF, "the derivation ran", "PROBE: git named …"),
  //     which is exactly why nothing above them could see it. So this fixture asks the same
  //     question in miniature, and asks it TWICE OVER: it fails as itself when git cannot answer,
  //     and it prints the COUNT, which the check below compares to the landed tree. The count is
  //     the half that catches the subtler regression — building the index after the node_modules
  //     symlink instead of before puts the link into it, and the audit then measures 629 paths of
  //     a 628-path tree with every pin still green.
  //   · package.json + a file: dep + bun.lock — `bun install --frozen-lockfile` refuses without them
  //   · .gitignore for node_modules/ — the short chain INSTALLS in the lane worktree, and an
  //     untracked node_modules there would make the lane dirty and block its own land
  mkdirSync(`${PREPO}/e2e`, { recursive: true });
  mkdirSync(`${PREPO}/vendor/fixture-dep`, { recursive: true });
  await Bun.write(`${PREPO}/fleet-e2e.ts`, "// proportional audit fixture sentinel\n");
  await Bun.write(`${PREPO}/e2e/pins.ts`,
    'const fleetEnv = Object.keys(process.env).filter((k) => k.startsWith("FLEET_")).sort();\n'
    + 'console.log("PASS  proportional fixture pin one");\n'
    + 'console.log(`PASS  proportional fixture pin two  (fleetenv=[${fleetEnv.join(",")}])`);\n'
    + 'const ls = Bun.spawnSync(["git", "ls-files", "-z"]);\n'
    + 'const tracked = ls.exitCode === 0 ? ls.stdout.toString().split("\\0").filter(Boolean) : null;\n'
    + 'if (tracked === null) {\n'
    + '  console.log(`FAIL  proportional fixture pin three — git named this tree  '
    + '(${ls.stderr.toString().trim().slice(0, 120)})`);\n'
    + '  console.log("1 FAILURES");\n'
    + '  process.exit(1);\n'
    + '}\n'
    + 'console.log(`PASS  proportional fixture pin three — git named this tree  (tracked=${tracked.length})`);\n'
    + 'console.log("ALL PASS");\n');
  await Bun.write(`${PREPO}/vendor/fixture-dep/package.json`, '{"name":"fixture-dep","version":"1.0.0"}\n');
  await Bun.write(`${PREPO}/package.json`,
    '{"name":"proportional-audit-fixture","private":true,'
    + '"dependencies":{"fixture-dep":"file:vendor/fixture-dep"}}\n');
  await Bun.write(`${PREPO}/.gitignore`, "node_modules/\n");
  spawnSync("bun", ["install"], { cwd: PREPO });
  spawnSync("git", ["-C", PREPO, "add", "-A"]);
  spawnSync("git", ["-C", PREPO, "commit", "-qm", "short-chain fixture"]);
}
const pHeadOf = (): string =>
  spawnSync("git", ["-C", PREPO, "rev-parse", "main"]).stdout.toString().trim();
const pBase = (path: string): string => path.split("/").pop() ?? path;
// the drain's own view of what it is running — the only non-guessing way to know the machine is
// busy elsewhere, and the same probe (K) uses rather than a sleep
const pLiveRepo = async (): Promise<string | null> => (await live())?.running?.repo ?? null;
const pWaitLocalRun = async (repo: string, timeoutMs = 60_000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await pLiveRepo()) === pBase(repo)) return true;
    await Bun.sleep(100);
  }
  return false;
};
const pWaitRowFor = async (branch: string, timeoutMs = 90_000): Promise<AuditRow> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const hit = (await auditRows()).find((r) => r.covers.some((c) => c.branch === branch));
    if (hit) return hit;
    if (Date.now() >= deadline) {
      check(`(P) an audit row appeared for ${branch}`, false, `none after ${timeoutMs}ms`);
      return NO_ROW;
    }
    await Bun.sleep(200);
  }
};
// a lane whose ONLY changed path is docs-or-prose — openLane commits a root `.txt`, which
// verify-proportion.ts classifies conservative-default, so this harness needs its own shape
const makeDocsLane = async (name: string): Promise<Lane> => {
  const ln = (await (await post("/api/lanes", { repo: PREPO })).json()) as Lane;
  mkdirSync(`${ln.cwd}/docs`, { recursive: true });
  await Bun.write(`${ln.cwd}/docs/${name}.md`, `${name} measurement note\n`);
  spawnSync("git", ["-C", ln.cwd, "add", "-A"]);
  // same index-lock retry openLane pays: a fresh worktree can hold one while tickGit polls
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} docs-only lane work`]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString()
      .includes(`${name} docs-only lane work`)) break;
    await Bun.sleep(300);
  }
  return ln;
};
const pNote = (sha: string): Record<string, unknown> | null => {
  const r = spawnSync("git", ["-C", PREPO, "notes", "--ref=fleet/land", "show", sha]);
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout.toString().trim()) as Record<string, unknown>; } catch { return null; }
};

// The decoy occupies the drain so a docs-only entry can be caught QUEUED — a job with an idle drain
// does not exist, the drain starts on the land that queued it. Its own lands are `.txt`, so its
// audit is the full stand-in and the two repos never share a chain.
const PDECOY = `${PREPO}-decoy`;
await seedRepo(PDECOY);
const pHelperToken = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
const pJobs = async (): Promise<{ jobs: { id: string; repo: string; covers: number }[] }> =>
  (await (await fetch(`${BASE}/api/helper/jobs`,
    { headers: { "x-fleet-helper-token": pHelperToken } })).json()) as
    { jobs: { id: string; repo: string; covers: number }[] };
// The job id is sha256 of the repo path AS THE SERVER RECORDS IT — git's toplevel, which on this
// box answers /private/tmp for a /tmp scratch dir. Taking the key out of the durable queue mirror
// rather than hashing our own spelling is what keeps this probe from failing as a 404 that reads
// like the refusal it is meant to prove.
const pQueueKeyFor = async (repo: string): Promise<string> =>
  Object.keys((await readQueueFile()) ?? {}).find((k) => pBase(k) === pBase(repo)) ?? "";
const pJobIdOf = (repoKey: string): string =>
  createHash("sha256").update(repoKey).digest("hex").slice(0, 12);

// --- (P.1) ONE DOCS-ONLY LAND: the short chain, and no offer -------------------------------------
const pDocs = await makeDocsLane("propshort");
await settleForMerge(pDocs.slot); // pay the idle gate BEFORE the decoy's window opens
await setAuditMode("slow");       // 6 s of drain-busy, so the queued entry is observed rather than raced
// (not `long`: 12 s would overrun this harness's FLEET_POSTLAND_AUDIT_TIMEOUT_MS=10000 and leave an
// `unknown` decoy row behind — a non-green this section has no business minting)
const pDecoyLane = await openLane(PDECOY, "propdecoy");
const pDecoyLanded = await driveMerge(pDecoyLane, pDecoyLane.branch);
const pDrainBusy = await pWaitLocalRun(PDECOY);
check("(P) setup: the decoy repo's land took the drain, so the next entry stays queued",
  pDecoyLanded.gone && pDrainBusy, `landed=${pDecoyLanded.gone} live=${await pLiveRepo()}`);
// AFTER the decoy's own stand-in line is on the evidence log, so the count below measures only
// what the docs land did (or did not) run
const pRunsBefore = (await runLog()).length;
const pDocsLanded = await driveMerge(pDocs, pDocs.branch);
const pDocsSha = pHeadOf();
check("(P) setup: the docs-only lane landed while the drain was busy elsewhere",
  pDocsLanded.gone && pDocsSha !== "", `landed=${pDocsLanded.gone} head=${pDocsSha}`);
const pDocsNote = pNote(pDocsSha);
const pDocsVerify = pDocsNote?.verify as { proportional?: boolean; steps?: string[] } | undefined;
check("(P) setup: the LAND GATE itself ran short on this candidate — the fact tier 2 inherits",
  pDocsVerify?.proportional === true
    && JSON.stringify(pDocsVerify.steps) === JSON.stringify(["install", "pins"]),
  JSON.stringify(pDocsVerify));

const pQueueKey = await pQueueKeyFor(PREPO);
const pOffered = await pJobs();
check("(P) a queued docs-only entry is NEVER offered to the portal (the decoy's still is)",
  pQueueKey !== ""
    && pOffered.jobs.some((j) => j.repo === pBase(PDECOY))
    && !pOffered.jobs.some((j) => j.repo === pBase(PREPO)),
  `key=${pQueueKey} jobs=${JSON.stringify(pOffered.jobs.map((j) => `${j.repo}:${j.covers}`))}`);
const pClaim = pQueueKey === "" ? null
  : await post("/api/helper/claim", { jobId: pJobIdOf(pQueueKey), deviceId: "propshortdev1" },
    { "x-fleet-helper-token": pHelperToken, "content-type": "application/json" });
const pClaimBody = pClaim ? await pClaim.text() : "";
check("(P) …and the claim DOOR refuses it too, naming the short chain — not only the list",
  pClaim?.status === 409 && pClaimBody.includes("short chain"), `${pClaim?.status} ${pClaimBody.slice(0, 200)}`);

const pShortRow = await pWaitRowFor(pDocs.branch);
check("(P) the docs-only entry is audited by the SHORT CHAIN, stamped as such with its exact steps",
  pShortRow.proportional === true
    && JSON.stringify(pShortRow.steps) === JSON.stringify(["install", "pins"])
    && pShortRow.cmdSource === "proportional",
  JSON.stringify({ proportional: pShortRow.proportional, steps: pShortRow.steps,
    cmdSource: pShortRow.cmdSource, cmd: pShortRow.cmd }));
check("(P) the command it ran is install+pins behind the repo guard, NOT the configured suite",
  pShortRow.cmd.startsWith('[ -f fleet-e2e.ts ] || { echo "verify skipped: not the fleet repo"; exit 42; }; ')
    && pShortRow.cmd.endsWith("bun e2e/pins.ts")
    && pShortRow.cmd !== process.env.FLEET_POSTLAND_AUDIT_CMD,
  JSON.stringify(pShortRow.cmd));
check("(P) it MEASURED the landed tree — green, exit 0, with this repo's own pins output and count",
  pShortRow.result === "green" && pShortRow.exitCode === 0
    && pShortRow.out.includes("proportional fixture pin one")
    && pShortRow.checks?.ran === 3 && pShortRow.checks.failed === 0,
  JSON.stringify({ result: pShortRow.result, exit: pShortRow.exitCode, checks: pShortRow.checks,
    out: pShortRow.out.slice(0, 200) }));
// THE GIT SEAM, and the reason it is a check of its own rather than a clause above: the six real
// pins that died here on 2026-09-05 all failed as THEMSELVES, so a row that only says "red" names
// nothing a reader can act on. This says which property broke. `snapshotIntegrationTree` gives the
// extracted tree an index of its own — no commit, so history questions still fail as themselves —
// and the count is the proof that the index describes THE SNAPSHOT: the expected number is read
// from the landed sha's tree, and the node_modules symlink the same function adds afterwards is
// not in it. An index built one line later would read one path too many and pass every other check.
// Read at the row's OWN mainSha, not at pDocsSha: the audit resolves the tip when it starts, and a
// probe that names a different tree than the run it is judging would be a wrong number in a green box.
const pTipPaths = spawnSync("git", ["-C", PREPO, "ls-tree", "-r", "--name-only", pShortRow.mainSha || "HEAD"],
  { encoding: "utf8" }).stdout.split("\n").filter(Boolean).length;
const pTrackedSeen = Number(/proportional fixture pin three[^(]*\(tracked=(\d+)\)/.exec(pShortRow.out)?.[1] ?? NaN);
check("(P) the short chain can ask git about the tree it stands in, and git answers with THAT tree",
  pTipPaths > 0 && pTrackedSeen === pTipPaths
    && !pShortRow.out.includes("not a git repository"),
  `tracked=${String(pTrackedSeen)} tipPaths=${pTipPaths} sha=${(pShortRow.mainSha || "?").slice(0, 8)}`);
check("(P) the configured full-suite stand-in was never invoked for it",
  (await runLog()).length === pRunsBefore,
  `before=${pRunsBefore} after=${(await runLog()).length}`);
// THE ENVIRONMENT THE STAMP IS A CLAIM ABOUT. `auditChildEnv` strips every FLEET_* key from an
// audit child — that rule predates this slice and the short chain inherits it rather than opting
// out — so a proportional run sees NONE, and the row's own output says so instead of leaving the
// reader to trust the rule.
//
// THE GATE HALF WAS REWRITTEN ON 2026-09-05, and the reason is worth keeping. It used to assert the
// opposite for the land gate — "`runVerify` spawns with the server's env, so the note names the
// knobs the server was booted with" — and that was true when this section was written (`036ff7c`,
// 00:23). `d37f835` (08:32, the SAME day) gave the gate child the same FLEET_* rule the audit child
// always had, and recorded the measurement in its own body: `nachher childFleet = []`. The check
// kept asserting the pre-fix world and went red — silently, because no gate runs this harness; it
// was caught the next time someone ran it by hand. What both halves now say is the surviving
// property: NEITHER child may carry a behaviour knob, and the gate's only permitted FLEET_* names
// are the suite-mutex ones `VERIFY_CHILD_KEEPS` exists for. The `fleetenv` LINE must be present in
// both, so "measured and empty" can never be read out of "never measured".
const pFleetEnvKeep = ["FLEET_SUITE_LOCK", "FLEET_SUITE_POLL_SEC", "FLEET_SUITE_LOCK_HELD_BY"];
const pAuditFleetEnv = /fleetenv=\[([^\]]*)\]/.exec(pShortRow.out)?.[1];
const pGateFleetEnv = /fleetenv=\[([^\]]*)\]/.exec(
  (pDocsNote?.verify as { out?: string } | undefined)?.out ?? "")?.[1];
check("(P) the proportional AUDIT child inherits NO FLEET_* knob, and its own output proves it",
  pAuditFleetEnv === "", `audit=[${pAuditFleetEnv ?? "no fleetenv line"}]`);
check("(P) …and the proportional LAND GATE child carries no behaviour knob either — at most the suite-mutex keys",
  pGateFleetEnv !== undefined
    && pGateFleetEnv.split(",").filter(Boolean).every((k) => pFleetEnvKeep.includes(k)),
  `gate=[${pGateFleetEnv ?? "no fleetenv line"}] allowed=[${pFleetEnvKeep.join(",")}]`);
check("(P) the row joins to the land it followed, and to that land's own note",
  pShortRow.covers.length === 1 && pShortRow.covers[0].branch === pDocs.branch
    && pShortRow.covers[0].mainAfter === pDocsSha && pShortRow.mainSha === pDocsSha,
  `${JSON.stringify(pShortRow.covers)} sha=${pShortRow.mainSha}`);

// --- (P.2) ONE CODE LAND IN THE ENTRY PUTS THE WHOLE TIP BACK ON THE FULL SUITE ------------------
await setAuditMode("slow");
const pMixA = await openLane(PREPO, "propmixa");
const pMixDocs = await makeDocsLane("propmixdocs");
const pMixB = await openLane(PREPO, "propmixb");
for (const ln of [pMixA, pMixDocs, pMixB]) await settleForMerge(ln.slot);
const pMixALanded = await driveMerge(pMixA, pMixA.branch);
const pMixBusy = await pWaitLocalRun(PREPO);
check("(P) setup: a code land holds the drain, so the next two lands coalesce behind it",
  pMixALanded.gone && pMixBusy, `landed=${pMixALanded.gone} live=${await pLiveRepo()}`);
const pMixRunsBefore = (await runLog()).length;
const pMixDocsLanded = await driveMerge(pMixDocs, pMixDocs.branch);
const pMixBLanded = await driveMerge(pMixB, pMixB.branch);
check("(P) setup: both coalescing lands reached main",
  pMixDocsLanded.gone && pMixBLanded.gone,
  spawnSync("git", ["-C", PREPO, "log", "--oneline", "-4"]).stdout.toString().trim());
await setAuditMode("green"); // the holding run already read its mode; the follow-up may be fast
const pMixRow = await pWaitRowFor(pMixDocs.branch);
check("(P) a coalesced entry holding ONE non-docs land runs the FULL configured suite",
  pMixRow.covers.length === 2
    && pMixRow.covers.some((c) => c.branch === pMixDocs.branch)
    && pMixRow.covers.some((c) => c.branch === pMixB.branch)
    && pMixRow.proportional === undefined && pMixRow.steps === undefined
    && pMixRow.cmd === process.env.FLEET_POSTLAND_AUDIT_CMD && pMixRow.cmdSource === "env",
  JSON.stringify({ covers: pMixRow.covers.map((c) => c.branch), proportional: pMixRow.proportional,
    steps: pMixRow.steps, cmdSource: pMixRow.cmdSource, cmd: pMixRow.cmd }));
check("(P) …and it really executed that suite — the stand-in logged a run for it",
  (await runLog()).length === pMixRunsBefore + 1 && pMixRow.result === "green",
  `before=${pMixRunsBefore} after=${(await runLog()).length} result=${pMixRow.result}`);

// ===== (K) THE REMOTE HELPER PORTAL =============================================================
// Runs LAST, and that placement is load-bearing rather than tidy: this section seeds a second repo
// and adds audit rows for it, and every section above counts rows by absolute number (waitRows(3),
// waitRows(8), …). Anywhere earlier it would shift all of them. It leaves the server booted with a
// server booted with a generous claim timeout and NO grace key (its (K.7) section ends on the
// default), which is why only (HD) may follow it — that section restarts the server with its own
// env as its first act, and every row count it makes is relative.
await helperPortal.run({ REPO, setAuditMode, killSrv, startSrv, auditRows, headOf });

// ===== (HD) THE HELPER DAEMON — the other machine's half, as a real process ======================
// Same fixture, one step further: instead of a human reading a bootstrap and pasting an exit code,
// helper-daemon/daemon.ts claims, clones, installs, runs and reports on its own.
await helperDaemon.run({ REPO, setAuditMode, killSrv, startSrv, auditRows, headOf });

// ===== (RW) THE PER-REPO AUDIT COMMAND — a foreign repo audited by its own verify =================
// Runs after (HD) and restarts the server as its own first act; every count it makes is relative and
// per repo, and it seeds a third repo of its own.
await repoWorkerAudit.run({ REPO, DIR: import.meta.dir, setAuditMode, killSrv, startSrv, auditRows });

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

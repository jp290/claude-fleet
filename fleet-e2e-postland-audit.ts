// e2e for VERIFICATION TIER 2 — the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD). The MAIN
// suite runs with FLEET_POSTLAND_AUDIT_CMD unset (default OFF) and proves the land path is untouched;
// THIS harness boots with the flag pointed at a stand-in suite and proves the ON behaviour: a land
// triggers an audit against the LANDED tree without blocking the land, its result is recorded durably
// and joinably, a red is surfaced, an audit that cannot produce a verdict records UNKNOWN (never
// green), a burst of lands never spawns two concurrent suites, and — sections E–G, which restart the
// server and therefore run last — a pending audit survives the death of the process that owed it.
// Run via ./e2e-postland-audit.sh — never against a live fleet.
import { existsSync, readFileSync } from "node:fs";
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
import { check, failures, get, IP, PORT, results, SOCK } from "./e2e/harness";
import { driveMerge, openLane, seedRepo, settleForMerge, type Lane, type MergeVerdict } from "./e2e/lane-helpers";

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
  result: string; reason?: string; cmd: string; exitCode: number | null;
  out: string; covers: { branch: string; mainAfter: string; at: number }[];
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
const startSrv = async (opts: { audit: boolean }): Promise<boolean> => {
  const env = ["FLEET_CMD", "FLEET_AUTO_REVIEW_MS", "FLEET_VERIFY_CMD", "FLEET_MERGE_CMD",
    "FLEET_CLEAN_REVIEW", "FLEET_CLEAN_REVIEW_CMD", "FLEET_POSTLAND_AUDIT_TIMEOUT_MS",
    ...(opts.audit ? ["FLEET_POSTLAND_AUDIT_CMD"] : [])]
    .map((k) => envArg(k, process.env[k])).join("");
  await Bun.spawn(["tmux", "-L", SOCK, "new-session", "-d", "-s", "srv",
    `cd '${import.meta.dir}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${env}exec bun server.ts >> server.log 2>&1`]).exited;
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
const dRows = await waitRows(3);
const d = newest(dRows);
check("a land triggers an audit whose row records a green result", dLanded.gone && d.result === "green", JSON.stringify(d));
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
const eRows = await waitRows(4);
const e = newest(eRows);
check("a failing audit is recorded RED (never rounded to green), with the suite's tail",
  eLanded.gone && e.result === "red" && e.exitCode === 1 && e.out.includes("3 FAILURES"), JSON.stringify(e).slice(0, 300));
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
const f = newest(await waitRows(5));
check("an audit command that DECLINES to run records unknown, never green",
  f.result === "unknown" && f.exitCode === 42 && (f.reason ?? "").includes("declined"), JSON.stringify(f).slice(0, 300));

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

// ===== (E) THE PENDING QUEUE SURVIVES THE SERVER — the deploy ritual raced the audit ============
// Measured incident (docs/mining-2026-07-26.md finding 1): four lands, then a srv restart seconds
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

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

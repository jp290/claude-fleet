// e2e for VERIFICATION TIER 2 — the post-land audit (server.ts, grep POSTLAND_AUDIT_CMD). The MAIN
// suite runs with FLEET_POSTLAND_AUDIT_CMD unset (default OFF) and proves the land path is untouched;
// THIS harness boots with the flag pointed at a stand-in suite and proves the ON behaviour: a land
// triggers an audit against the LANDED tree without blocking the land, its result is recorded durably
// and joinably, a red is surfaced, an audit that cannot produce a verdict records UNKNOWN (never
// green), and a burst of lands never spawns two concurrent suites.
// Run via ./e2e-postland-audit.sh — never against a live fleet.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8790);
const SOCK = process.env.FLEET_SOCK ?? "fleetplatest";
if (SOCK === "claudefleet") throw new Error("refusing to run against the live socket");
const BASE = `http://${IP}:${PORT}`;
const results: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

const stateFile = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const TOKEN = stateFile.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown): Promise<Response> =>
  fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (path: string): Promise<Response> => fetch(BASE + path, { headers: H });

type MergeVerdict = { status: string; detail: string; landed: boolean };
const WAIT_MS = 60_000;
const STEP = 100;
const waitMerge = async (slot: number): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  for (let i = 0; i < Math.ceil(WAIT_MS / STEP); i++) {
    const r = await get(`/api/slots/${slot}/merge`);
    if (r.status === 400) return { gone: true, last: null }; // slot torn down = the lane LANDED
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (!j.running && j.last !== null) return { gone: false, last: j.last };
    await Bun.sleep(STEP);
  }
  throw new Error(`waitMerge timed out for slot ${slot} — merge job never settled`);
};
const settleForMerge = async (slot: number): Promise<void> => {
  for (let i = 0; i < 80; i++) {
    const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
    const sl = sx.slots.find((x) => x.id === slot);
    if (sl && sx.now - sl.lastOutput >= 3000) return;
    await Bun.sleep(150);
  }
};

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

// throwaway repo the lanes fork from
const REPO = `${import.meta.dir}/testrepo`;
spawnSync("git", ["init", "-q", "-b", "main", REPO]);
spawnSync("git", ["-C", REPO, "config", "user.email", "t@t"]);
spawnSync("git", ["-C", REPO, "config", "user.name", "t"]);
spawnSync("git", ["-C", REPO, "config", "commit.gpgsign", "false"]);
await Bun.write(`${REPO}/seed.txt`, "seed\n");
spawnSync("git", ["-C", REPO, "add", "seed.txt"]);
spawnSync("git", ["-C", REPO, "commit", "-qm", "seed"]);
const headOf = (ref = "main"): string => spawnSync("git", ["-C", REPO, "rev-parse", ref]).stdout.toString().trim();
const noteAt = (sha: string): boolean => spawnSync("git", ["-C", REPO, "notes", "--ref=fleet/land", "show", sha]).status === 0;

type Lane = { slot: number; cwd: string; branch: string };
// a lane whose rebase is CLEAN (its own file → no conflict, the merge agent is never consulted) with
// its work committed: exactly the clean+green auto-land path tier 2 hangs off.
const makeLane = async (name: string): Promise<Lane> => {
  const ln = (await (await post("/api/lanes", { repo: REPO })).json()) as Lane;
  await Bun.write(`${ln.cwd}/${name}.txt`, `${name} work\n`);
  spawnSync("git", ["-C", ln.cwd, "add", `${name}.txt`]);
  // a freshly-created lane worktree can briefly hold a git index lock — retry until the commit is
  // actually in the log, or the lane has nothing to land
  for (let i = 0; i < 12; i++) {
    spawnSync("git", ["-C", ln.cwd, "commit", "-qm", `${name} lane work`]);
    if (spawnSync("git", ["-C", ln.cwd, "log", "--oneline", "-1"]).stdout.toString().includes(`${name} lane work`)) break;
    await Bun.sleep(300);
  }
  return ln;
};
const landLane = async (ln: Lane): Promise<{ gone: boolean; last: MergeVerdict | null }> => {
  for (let attempt = 0; attempt < 8; attempt++) {
    await settleForMerge(ln.slot);
    await post(`/api/slots/${ln.slot}/merge`, {});
    const r = await get(`/api/slots/${ln.slot}/merge`);
    if (r.status === 400) break; // already landed
    const j = (await r.json()) as { running: boolean; last: MergeVerdict | null };
    if (j.running || j.last !== null) break;
    await Bun.sleep(800);
  }
  return waitMerge(ln.slot);
};

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

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

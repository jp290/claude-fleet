// THE TRACE (trace-index.ts, GET /api/trace?task=): one task's life projected from the ledgers.
//
// ITS OWN SCRATCH INSTANCE, not the suite's srv — the pattern of e2e/state-snapshot.ts. The trace
// reads audit.jsonl in all three generations, and the only way to own a `.archive` and a `.1` is to
// write them before the server boots; on the suite's srv every other family appends to the same
// files. So this family stages a fixture directory whose ledgers it writes itself (four ledgers, all
// three audit generations, the task archive) plus a throwaway git repo with a landed lane and its
// fleet/land note, boots it on its own port and socket, and reaps both after.
//
// What each check can turn red, stated as the mutation:
//   order     — sort the events by anything but `at`, or drop a source (outcomes, audits, audit.jsonl).
//   horizon   — read two generations instead of three (drop ".archive" from TRACE_GENERATIONS): the
//               oldest row, the archived release and the audit coverage all live in `.archive`. This is
//               the mutation probe of the brief, and the ONLY check that depends on the archive.
//   reports   — fold the decision into the open row, or give the edge the credential as its actor.
//   git       — skip the note or the log; name files from anything but the commit.
//   recycle   — let a slot window run past the next slot_open of the same slot.
//   no-raw    — copy a report text, a note's verify.out, an audit's out or a task text into an event.
//   old task  — answer a task older than every horizon with `read`, zero events, or a 404.
//   malformed — drop a torn line instead of counting it.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { check, IP, PORT, ROOT, SOCK } from "./harness";
import { TRACE_FAMILIES, type SourceCoverage, type SourceHorizon, type TraceEvent } from "../trace-index";

const TMP = process.env.TMPDIR ?? "/tmp";
const FIX = `${TMP}/fleet-e2e-trace-${process.pid}`;
const TOKEN = `trace-${randomBytes(8).toString("hex")}`;
const OFF = 27; // PORT offsets 1, 23-26 are taken (restart.ts, state-snapshot.ts, self-token.ts)
// the state a staged tree carries next to its code; the fixture instance boots with only what this writes
const SKIP = /^(\.git|node_modules|streams|e2e|e2e-trail|drops|fleet\.json.*|fleet\.pid|.*\.jsonl(\.\d+|\.archive)?|.*\.log|post-land-audit-queue\.json.*|deploy-inflight\.json.*)$/;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const NOW = Date.now();
// the landed task's life, oldest first; every ledger's own oldest row predates CREATED, so all four
// cover it — and the OLD task predates every ledger, so none does
const OLD_CREATED = NOW - 40 * DAY;
const ARCH0 = NOW - 20 * DAY;          // audit.jsonl.archive's first row: the horizon the mutation probe moves
const LEDGER0 = NOW - 15 * DAY;        // the other ledgers' first rows
const CREATED = NOW - 9 * DAY;
const RELEASED = CREATED + MIN;        // written into `.archive`
const ONE0 = CREATED + 2 * MIN;        // audit.jsonl.1's first row
const DISPATCHED = CREATED + 3 * MIN;  // slot_open of the lane's worktree
const COMMITTED = CREATED + 50 * MIN;
const REPORTED = CREATED + 60 * MIN;
const LANDED = CREATED + 70 * MIN;
const DECIDED = CREATED + 71 * MIN;
const AUDITED = CREATED + 90 * MIN;
const RECYCLED = CREATED + 120 * MIN;  // another lane opens the same slot
const secs = (ms: number): string => `${Math.floor(ms / 1000)} +0000`;

const TASK = "a1b2c3d4";
const OLD = "0ld0ta5k";
const BRANCH = "fleet/260101000000-trce";
const SLOT = 4;
const PROGRAM = "feedc0de";
const REPORT = "r3p0rt000000000000000001";
// markers for the raw contents that must never reach an event
const RAW = { report: "RAW-REPORT-TEXT", reason: "RAW-DECISION-REASON", verify: "RAW-VERIFY-OUT",
  audit: "RAW-AUDIT-OUT", task: "RAW-TASK-TEXT" };

interface Trace { result: string; events: TraceEvent[]; horizon: SourceHorizon[]; coverage: SourceCoverage[]; searched?: string[] }

const jsonl = (rows: unknown[]): string => rows.map((r) => `${typeof r === "string" ? r : JSON.stringify(r)}\n`).join("");
const git = (repo: string, at: number, ...args: string[]): string => {
  const r = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8", env: { ...process.env,
    GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@x", GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@x",
    GIT_AUTHOR_DATE: secs(at), GIT_COMMITTER_DATE: secs(at) } });
  if (r.status !== 0) throw new Error(`fixture git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

// the lane: a fork, one commit on its branch, a fast-forward land and the note writeLandNote writes
function fixtureRepo(repo: string): { forkSha: string; landedSha: string } {
  mkdirSync(repo, { recursive: true });
  git(repo, LEDGER0, "init", "-q", "-b", "main");
  writeFileSync(`${repo}/a.txt`, "a\n");
  git(repo, LEDGER0, "add", "a.txt");
  git(repo, LEDGER0, "commit", "-qm", "init");
  const forkSha = git(repo, LEDGER0, "rev-parse", "HEAD");
  git(repo, COMMITTED, "checkout", "-qb", BRANCH);
  writeFileSync(`${repo}/feature.txt`, "f\n");
  git(repo, COMMITTED, "add", "feature.txt");
  git(repo, COMMITTED, "commit", "-qm", "feature");
  const landedSha = git(repo, COMMITTED, "rev-parse", "HEAD");
  git(repo, LANDED, "checkout", "-q", "main");
  git(repo, LANDED, "merge", "-q", "--ff-only", BRANCH);
  const note = { branch: BRANCH, mainBefore: forkSha, mainAfter: landedSha, confirmedByHuman: false,
    verify: { ok: true, out: RAW.verify }, actor: { kind: "main", slot: 3, program: PROGRAM, task: TASK }, at: LANDED };
  git(repo, LANDED, "notes", "--ref=fleet/land", "add", "-f", "-m", JSON.stringify(note), landedSha);
  return { forkSha, landedSha };
}

function fixtureLedgers(dir: string, repo: string, forkSha: string, landedSha: string): void {
  // server.ts#worktreePathFor — the join key slot_open's detail carries, spelled out as the spec
  const worktree = `${repo}.worktrees/${BRANCH.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  writeFileSync(`${dir}/audit.jsonl.archive`, jsonl([
    { ts: ARCH0, event: "slot_open", slot: 9, detail: "/elsewhere" },
    { ts: RELEASED, event: "task_release", detail: `${TASK} program=${PROGRAM} by=policy card-valid` },
  ]));
  writeFileSync(`${dir}/audit.jsonl.1`, jsonl([
    { ts: ONE0, event: "slot_open", slot: 7, detail: "/elsewhere/too" },
    { ts: DISPATCHED, event: "slot_open", slot: SLOT, detail: worktree },
    { ts: DISPATCHED + 2000, event: "send", slot: SLOT, detail: "brief 5839B accepted", path: "brief", bytes: 5839, acceptance: "accepted" },
  ]));
  writeFileSync(`${dir}/audit.jsonl`, jsonl([
    { ts: LANDED, event: "land_actor", detail: `repo ${BRANCH} ${landedSha.slice(0, 8)} main slot=3 program=${PROGRAM} task=${TASK}` },
    { ts: LANDED + 2000, event: "slot_kill", slot: SLOT, detail: "land" },
    { ts: RECYCLED, event: "slot_open", slot: SLOT, detail: "/some/other/lane" },
    { ts: RECYCLED + 1000, event: "send", slot: SLOT, detail: "RECYCLED-SLOT-ROW", path: "owner", bytes: 1, acceptance: "accepted" },
  ]));
  writeFileSync(`${dir}/lane-outcomes.jsonl`, jsonl([
    { ts: LEDGER0, branch: "fleet/251230000000-othr", disposition: "killed-empty", repo },
    '{"ts": 1, "branch": "torn-mid-app', // a torn line: counted as malformed, never dropped silently
    { ts: LANDED + 1000, branch: BRANCH, base: forkSha, headSha: landedSha, disposition: "landed", taskId: TASK,
      programId: PROGRAM, repo, mainAfter: landedSha, filesTouched: ["feature.txt"] },
  ]));
  writeFileSync(`${dir}/post-land-audits.jsonl`, jsonl([
    { at: LEDGER0, mainSha: forkSha, result: "green", repo, covers: [{ branch: "fleet/251230000000-othr" }], out: "x" },
    { at: AUDITED, mainSha: landedSha, result: "green", repo, out: RAW.audit, covers: [{ branch: BRANCH, mainAfter: landedSha, at: LANDED }] },
  ]));
  writeFileSync(`${dir}/fleet-reports.jsonl`, jsonl([
    { kind: "open", id: "r3p0rt000000000000000000", taskId: "someother", slot: 2, branch: "x", status: "complete", basis: "program", text: "x", at: LEDGER0 },
    { kind: "open", id: REPORT, taskId: TASK, programId: PROGRAM, slot: SLOT, branch: BRANCH, status: "complete", basis: "program", text: RAW.report, at: REPORTED },
    { kind: "decision", id: REPORT, disposition: "accepted", by: { slot: 3, openedAt: CREATED - DAY, sessionId: "main-session" },
      reason: RAW.reason, fulfilled: "ja", mainAfter: null, at: DECIDED },
  ]));
  writeFileSync(`${dir}/tasks-archive.jsonl`, jsonl([
    { ts: OLD_CREATED + DAY, event: "evicted", task: { id: OLD, text: RAW.task, source: "owner", kind: "auftrag", status: "done", created: OLD_CREATED } },
    { ts: AUDITED, event: "terminal", task: { id: TASK, text: RAW.task, source: "main", kind: "auftrag", status: "done", created: CREATED, programId: PROGRAM } },
  ]));
}

function stage(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const e of readdirSync(ROOT)) if (!SKIP.test(e)) cpSync(`${ROOT}/${e}`, `${dir}/${e}`, { recursive: true });
  symlinkSync(`${ROOT}/node_modules`, `${dir}/node_modules`);
}

export async function run(): Promise<void> {
  rmSync(FIX, { recursive: true, force: true });
  const dir = `${FIX}/instance`;
  const repo = `${FIX}/repo`;
  const { forkSha, landedSha } = fixtureRepo(repo);
  stage(dir);
  fixtureLedgers(dir, repo, forkSha, landedSha);

  const port = PORT + OFF;
  const sock = `${SOCK}trace${OFF}`;
  const base = `http://${IP}:${port}`;
  let out = "";
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: String(port), FLEET_SOCK: sock, FLEET_TOKEN: TOKEN,
      FLEET_CMD: "true", FLEET_AUTO_REVIEW_MS: "0", FLEET_STATE_SNAPSHOT_MS: "0" },
  });
  const drain = async (s: ReadableStream<Uint8Array>) => { for await (const c of s) out += new TextDecoder().decode(c); };
  void drain(proc.stdout as ReadableStream<Uint8Array>);
  void drain(proc.stderr as ReadableStream<Uint8Array>);
  const H = { authorization: `Bearer ${TOKEN}` };
  try {
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      up = await fetch(`${base}/api/sessions`, { headers: H }).then((r) => r.ok, () => false);
      if (!up) await Bun.sleep(100);
    }
    check("trace: the fixture instance boots on its own port", up, out.slice(-400));
    const get = async (task: string): Promise<{ status: number; body: Trace }> => {
      const r = await fetch(`${base}/api/trace?task=${encodeURIComponent(task)}`, { headers: H });
      return { status: r.status, body: (await r.json().catch(() => ({}))) as Trace };
    };

    const { status, body } = await get(TASK);
    const ev = body.events ?? [];
    const first = (pred: (e: TraceEvent) => boolean): number => ev.findIndex(pred);
    const kinds = ev.map((e) => e.kind);
    const iDispatch = first((e) => e.kind === "lane.opened" && e.refs.slot === SLOT);
    const iLand = first((e) => e.kind === "lane.landed");
    const iAudit = first((e) => e.kind === "audit.green");
    check("trace: a landed task shows dispatch, land and audit events in time order",
      status === 200 && body.result === "trace" && iDispatch >= 0 && iDispatch < iLand && iLand < iAudit
        && ev.every((e, i) => i === 0 || ev[i - 1]!.at <= e.at)
        && ev[iDispatch]!.at === DISPATCHED && ev[iLand]!.at === LANDED + 1000 && ev[iAudit]!.at === AUDITED,
      `${status} ${body.result} dispatch@${iDispatch} land@${iLand} audit@${iAudit} kinds=[${kinds.join(" ")}]`);

    // THE MUTATION TARGET: everything the archive alone holds, in one check
    const hAudit = body.horizon?.find((h) => h.source === "audit.jsonl");
    const release = ev.find((e) => e.kind === "task.released");
    const cAudit = body.coverage?.find((c) => c.source === "audit.jsonl");
    check("trace: audit.jsonl's horizon reaches its rotated .archive — oldest row, archived release, full coverage",
      hAudit?.state === "read" && hAudit.oldestAt === ARCH0
        && (hAudit.generations ?? []).some((g) => g.gen === "audit.jsonl.archive" && g.rows === 2)
        && release?.at === RELEASED && release.detailRef?.locator.startsWith("audit.jsonl.archive@") === true
        && cAudit?.state === "read",
      `horizon=${JSON.stringify(hAudit)} release=${JSON.stringify(release?.detailRef)} coverage=${JSON.stringify(cAudit)}`);

    const filed = ev.find((e) => e.kind === "report.filed.complete");
    const decided = ev.find((e) => e.kind === "report.decided.accepted");
    check("trace: a fleet report is one event with its kind, its decision a second one, each an actor edge",
      filed?.at === REPORTED && filed.edge?.channel === "fleet-report" && filed.edge.from.kind === "lane"
        && filed.edge.from.slot === SLOT && filed.edge.to.kind === "main" && filed.edge.to.program === PROGRAM
        && decided?.at === DECIDED && decided.edge?.from.kind === "occupant" && decided.edge.from.slot === 3
        && decided.edge.from.session === "main-session" && decided.edge.to.branch === BRANCH,
      `filed=${JSON.stringify(filed)} decided=${JSON.stringify(decided)}`);

    const note = ev.find((e) => e.kind === "land.gate.green");
    const commit = ev.find((e) => e.kind === "commit.lane");
    check("trace: git projects the land note and the lane's commit with its files",
      note?.at === LANDED && note.refs.sha === landedSha && note.refs.slot === 3 && note.detailRef?.locator === `${repo}@${landedSha}`
        && commit?.refs.sha === landedSha && commit.at === Math.floor(COMMITTED / 1000) * 1000
        && JSON.stringify(commit.files) === '["feature.txt"]',
      `note=${JSON.stringify(note)} commit=${JSON.stringify(commit)}`);

    const sends = ev.filter((e) => e.kind.startsWith("send."));
    check("trace: a recycled slot's later rows are not this lane's, its own send is — as an edge to the lane",
      sends.length === 1 && sends[0]!.at === DISPATCHED + 2000 && sends[0]!.edge?.to.kind === "lane"
        && sends[0]!.edge.from.kind === "unknown" && !ev.some((e) => e.at >= RECYCLED),
      `sends=${JSON.stringify(sends)} late=${ev.filter((e) => e.at >= RECYCLED).map((e) => e.kind).join(",")}`);

    const text = JSON.stringify(body);
    const leaked = Object.values(RAW).filter((m) => text.includes(m));
    const noRef = ev.filter((e) => !e.detailRef?.locator || (e.source.endsWith(".jsonl") && !/^[0-9a-f]{16}$/.test(e.detailRef.fp ?? "")));
    check("trace: no raw content reaches an event — each points at its line by locator and fingerprint",
      leaked.length === 0 && noRef.length === 0, `leaked=[${leaked.join(",")}] unaddressed=[${noRef.map((e) => e.kind).join(",")}]`);

    const families = new Set<string>(TRACE_FAMILIES);
    const stray = kinds.filter((k) => !families.has(k.split(".")[0] ?? ""));
    check("trace: every event kind belongs to a declared family", ev.length > 0 && stray.length === 0, `stray=[${stray.join(",")}]`);

    const covered = ["lane-outcomes.jsonl", "post-land-audits.jsonl", "fleet-reports.jsonl"]
      .map((s) => body.coverage?.find((c) => c.source === s));
    check("trace: the three ledgers that predate the task cover it as read, each with its events",
      covered.every((c) => c?.state === "read" && c.events > 0), JSON.stringify(covered));

    const hOut = body.horizon?.find((h) => h.source === "lane-outcomes.jsonl");
    check("trace: a torn ledger line is counted in its source's horizon, never dropped silently",
      hOut?.state === "read" && hOut.malformed === 1 && hOut.rows === 2, JSON.stringify(hOut));

    const old = await get(OLD);
    const ledgers = ["audit.jsonl", "lane-outcomes.jsonl", "post-land-audits.jsonl", "fleet-reports.jsonl"];
    const oldCov = ledgers.map((s) => old.body.coverage?.find((c) => c.source === s));
    check("trace: a task older than its horizon answers unmeasured per named source, never an empty trace",
      old.status === 200 && old.body.result === "trace" && (old.body.events ?? []).some((e) => e.kind === "task.created" && e.at === OLD_CREATED)
        && oldCov.every((c, i) => c?.state === "unmeasured" && c.reason.includes(ledgers[i]!)),
      `${old.status} ${JSON.stringify(old.body).slice(0, 600)}`);

    const unknown = await get("feedbeef");
    check("trace: an unknown task is 404 naming the sources it searched and their horizon",
      unknown.status === 404 && unknown.body.result === "unknown-task" && (unknown.body.searched ?? []).includes("audit.jsonl")
        && (unknown.body.horizon ?? []).some((h) => h.source === "audit.jsonl" && h.state === "read"),
      `${unknown.status} ${JSON.stringify(unknown.body).slice(0, 300)}`);

    const bad = await fetch(`${base}/api/trace?task=..%2Fx`, { headers: H });
    const anon = await fetch(`${base}/api/trace?task=${TASK}`);
    check("trace: a malformed id is refused 400 and a request without the owner token 401",
      bad.status === 400 && anon.status === 401, `malformed=${bad.status} anonymous=${anon.status}`);
  } finally {
    proc.kill("SIGTERM");
    await Promise.race([proc.exited, Bun.sleep(5000)]);
    proc.kill("SIGKILL");
    spawnSync("tmux", ["-L", sock, "kill-server"]);
    rmSync(FIX, { recursive: true, force: true });
  }
}

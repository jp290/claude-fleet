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
import { NATIVE_CANARY, NATIVE_FIXTURES, runNativeProbes } from "./trace-native-fixtures";
import { TimelineIndex, TIMELINE_BUDGET, TIMELINE_RETIRED_REFS, type TimelineDetail, type TimelinePage,
  type TimelineReceipt } from "../trace-timeline";
import { normalizeNative } from "../trace-native";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
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

async function timelineProbes(): Promise<void> {
  const dir = `${FIX}/index`; mkdirSync(dir, { recursive: true });
  const f = NATIVE_FIXTURES[1]!;
  const firstBytes = new TextEncoder().encode(jsonl(f.rows.slice(0, 2)));
  const nativeFirst = await normalizeNative({ ...f.input, bytes: firstBytes });
  const nativeDelta = await normalizeNative({ ...f.input, bytes: f.input.bytes.slice(firstBytes.length),
    byteOffset: firstBytes.length, observedAt: f.input.observedAt + 1000 }, nativeFirst);
  const nativeReplay = await normalizeNative({ ...f.input, observedAt: f.input.observedAt + 2000 }, nativeDelta);
  const nativeRewrite = await normalizeNative({ ...f.input, bytes: new TextEncoder().encode(
    new TextDecoder().decode(f.input.bytes).replaceAll("exec-1", "exec-2")) }, nativeReplay);
  check("timeline native full delta full verifies the whole retained prefix without false invalidation",
    nativeDelta.events.length === 4 && nativeReplay.events.length === 4
      && nativeReplay.invalidated.length === 0 && nativeReplay.gaps.length === 0
      && nativeReplay.added.length === 0 && nativeReplay.updated.length === 0
      && JSON.stringify(nativeReplay.events) === JSON.stringify(nativeDelta.events)
      && nativeRewrite.invalidated.length === 4 && nativeRewrite.gaps.some((g) => g.code === "source-rewritten"),
    JSON.stringify({ replay: nativeReplay.gaps, invalidated: nativeReplay.invalidated.length }));
  const receipt: TimelineReceipt = { session: f.input.binding!.sessionId, cwd: f.input.binding!.cwd, slot: 2,
    openedAt: CREATED, harness: "codex", project: "project-1", program: PROGRAM, task: TASK, branch: BRANCH,
    at: CREATED, proof: "a".repeat(64) };
  const file = `${dir}/native.jsonl`; writeFileSync(file, f.input.bytes);
  let current = [receipt], resolutions = 0;
  const index = new TimelineIndex({ host: "test-host", carriers: [], live: () => current, tasks: () => [],
    resolve: (r) => { resolutions++; return { file, harness: "codex", format: f.input.format, cwd: r.cwd }; },
    worktreeOf: () => receipt.cwd, projectOf: () => "project-1", redactions: () => [NATIVE_CANARY],
    traceVersion: () => "fixed", trace: async () => ({ result: "trace", task: TASK, row: null, anchorAt: CREATED,
      events: [{ source: "fleet-reports.jsonl", kind: "report.filed.complete", at: CREATED,
        refs: { task: TASK }, files: [], detailRef: { source: "fleet-reports.jsonl", locator: "fleet-reports.jsonl@0+1" } }],
      coverage: [], horizon: [] }) });
  const url = new URL("http://fixture/api/timeline?from=0&to=9999999999999");
  const read = async (u = url): Promise<TimelinePage> => (await index.page(u)).body as TimelinePage;
  const first = await read(), second = await read();
  check("timeline unchanged poll reads zero source bytes and resolves nothing again",
    first.work.sourceReads === 1 && second.work.sourceReads === 0 && second.work.readBytes === 0
      && resolutions === 1 && second.revision === first.revision,
    JSON.stringify({ first: first.work, second: second.work, resolutions, revisions: [first.revision, second.revision] }));
  const paged = new URL(url); paged.searchParams.set("limit", "2");
  const page1 = await read(paged); paged.searchParams.set("cursor", page1.nextCursor!);
  const page2 = await read(paged);
  check("timeline stable pagination neither duplicates nor drops calls at equal timestamps",
    page1.nextCursor !== null && page2.schema === "fleet.timeline/v1"
      && new Set([...page1.entries, ...page2.entries].map((e) => e.id)).size === 4
      && page1.entries.every((e) => !page2.entries.some((p) => p.id === e.id)), JSON.stringify([page1.entries, page2.entries]));
  paged.searchParams.set("program", "different");
  check("timeline cursor cannot cross filters", (await index.page(paged)).status === 409);
  const recycled = { ...receipt, openedAt: receipt.openedAt + 1, proof: "b".repeat(64) };
  current = [receipt, recycled];
  const two = await read();
  check("timeline recycle preserves both occupations and emits shared source calls once with unknown attribution",
    two.sessions.length === 2 && new Set(two.sessions.map((s) => s.key)).size === 2
      && two.entries.filter((e) => e.event?.kind === "tool.call").length === 2
      && two.sessions.every((s) => s.gaps.some((g) => g.code === "occupation-source-ambiguous"))
      && two.entries.filter((e) => e.event?.kind === "tool.call").every((e) => e.sessionKey === null && e.event?.refs.slot === undefined), JSON.stringify(two.sessions));
  writeFileSync(file, new TextDecoder().decode(f.input.bytes).replace("exec-1", "exec-2"));
  const rewritten = await read();
  check("timeline rewrite changes generation and invalidates the old cursor",
    rewritten.sessions.every((s) => s.source.version === "generation-2" && s.gaps.some((g) => g.code === "source-rewritten"))
      && (await index.page(new URL(url + "&limit=2&cursor=" + page1.nextCursor))).status === 409);
  const prefix = new TextEncoder().encode(f.rows.slice(0, 2).map((r) => JSON.stringify(r) + "\n").join(""));
  const result = JSON.stringify(f.rows[2]) + "\n";
  writeFileSync(file, prefix); appendFileSync(file, result.slice(0, 40));
  const partial = await read();
  check("timeline partial line keeps pending calls and explicit missing-result gaps",
    partial.sessions.every((s) => s.gaps.some((g) => g.code === "partial-record") && s.gaps.some((g) => g.code === "missing-result"))
      && partial.entries.filter((e) => e.event?.kind === "tool.call").length === 1
      && !partial.entries.some((e) => e.event?.kind === "tool.result"));
  appendFileSync(file, result.slice(40));
  const late = await read();
  check("timeline appended late result appears once per retained source and preserves the call identity",
    late.entries.filter((e) => e.event?.kind === "tool.result").length === 1
      && late.entries.filter((e) => e.event?.kind === "tool.call").every((e) =>
        partial.entries.some((p) => p.id === e.id) && "status" in e.event! && e.event.status === "late")
      && late.sessions.every((s) => !s.gaps.some((g) => g.code === "missing-result" || g.code === "partial-record")));
  writeFileSync(file, new TextDecoder().decode(f.input.bytes).replaceAll("exec-1", "exec-3") + "{\"type\":\"notice\"}\n");
  const grownRewrite = await read();
  check("timeline growing rewrite cannot reuse an unchecked native prefix",
    grownRewrite.sessions.every((s) => s.gaps.some((g) => g.code === "source-rewritten"))
      && !grownRewrite.entries.some((e) => e.event?.refs.call === "exec-1")
      && grownRewrite.entries.filter((e) => e.event?.kind === "tool.call").length === 2);
  current = [{ ...receipt, session: "30000000-0000-4000-8000-000000000099" }];
  const foreignUuid = await read();
  check("timeline native UUID fence yields an explicit gap and zero foreign events",
    foreignUuid.sessions.length === 1 && foreignUuid.sessions[0]!.gaps.some((g) => g.code === "session-id-mismatch")
      && !foreignUuid.entries.some((e) => e.event?.kind.startsWith("tool.")));
  current = [{ ...receipt, cwd: "/foreign/checkout" }];
  const foreignCwd = await read();
  check("timeline native cwd fence yields an explicit gap and zero foreign events",
    foreignCwd.sessions.length === 1 && foreignCwd.sessions[0]!.gaps.some((g) => g.code === "cwd-mismatch")
      && !foreignCwd.entries.some((e) => e.event?.kind.startsWith("tool.")));
  current = [{ ...receipt, harness: "future-harness" }];
  const unsupported = new TimelineIndex({ host: "test-host", carriers: [], live: () => current, tasks: () => [],
    resolve: () => null, worktreeOf: () => receipt.cwd, projectOf: () => "project-1", redactions: () => [],
    traceVersion: () => "fixed", trace: async () => ({ result: "unknown-task", task: TASK, searched: [], horizon: [] }) });
  const unsupportedPage = (await unsupported.page(url)).body as TimelinePage;
  check("timeline unsupported harness remains a session with a named unsupported source",
    unsupportedPage.sessions.length === 1 && unsupportedPage.sessions[0]!.gaps.some((g) => g.code === "unsupported-source")
      && !unsupportedPage.entries.some((e) => e.event));
  current = [receipt, recycled];
  writeFileSync(file, f.input.bytes);
  const beforeDeletion = await read();
  rmSync(file);
  const missing = await read();
  check("timeline deleted source keeps both occupations as explicit gaps and removes stale calls",
    beforeDeletion.entries.filter((e) => e.event?.kind === "tool.call").length === 2
      && missing.sessions.length === 2 && missing.sessions.every((s) => s.gaps.some((g) => g.code === "source-missing"))
      && !missing.entries.some((e) => e.event?.kind === "tool.call"));
  check("timeline refuses caller paths and invalid windows",
    (await index.page(new URL(url + "&path=/etc/passwd"))).status === 400
      && (await index.page(new URL("http://fixture/api/timeline?from=20&to=10"))).status === 400);
}

// THE DETAIL DOOR (TimelineIndex#detail). What each check turns red under, stated as the mutation:
//   opens     — read the range of the event's own record only (drop the pair lookup) or report a
//               stored timestamp instead of the record's: the result text, the second time or the
//               byte range of the result goes missing.
//   redaction — use only normalizeNative's markers in redactText (drop SECRET_SPANS' assignment rule
//               and redactDetail's SECRET_KEY rule): the two unmarked secrets come back verbatim.
//   refusal   — let an id outside this.native fall through to the tombstone answer: 404 becomes 200.
//   gaps      — skip retire() on a rewrite or a vanished file: the old id becomes a 404, not a gap.
//   cap       — drop the eviction loop in retire(): the map outgrows TIMELINE_RETIRED_REFS.
export const DETAIL_SECRETS = { assigned: `pw-${randomBytes(8).toString("hex")}`, keyed: `k-${randomBytes(8).toString("hex")}`,
  bearer: `bearer${randomBytes(8).toString("hex")}` };
// a value missing from an answer must fail the check that reads it, never throw out of the module
const shows = (v: unknown, s: string): boolean => (JSON.stringify(v) ?? "").includes(s);
async function timelineDetailProbes(): Promise<void> {
  const dir = `${FIX}/detail`; mkdirSync(dir, { recursive: true });
  const sid = "50000000-0000-4000-8000-000000000001", cwd = "/synthetic/detail";
  const at = (ms: number): string => new Date(CREATED + ms).toISOString();
  const row = (uuid: string, parent: string | null, ms: number, type: string, block: unknown) => ({ type, sessionId: sid, cwd,
    uuid, parentUuid: parent, timestamp: at(ms), message: { content: [{ type: "text", text: "lead" }, block] } });
  const rows = [
    row("d-call", null, 1000, "assistant", { type: "tool_use", id: "bash-1", name: "Bash",
      input: { command: `DB_PASSWORD=${DETAIL_SECRETS.assigned} ./run ${NATIVE_CANARY}`, headers: { api_key: DETAIL_SECRETS.keyed } } }),
    row("d-result", "d-call", 2500, "user", { type: "tool_result", tool_use_id: "bash-1",
      content: `ran ok, Authorization: Bearer ${DETAIL_SECRETS.bearer}`, is_error: false }),
    row("d-edit", "d-result", 3000, "assistant", { type: "tool_use", id: "edit-2", name: "Edit", input: { file_path: "src/a.ts" } }),
    row("d-fail", "d-edit", 3200, "user", { type: "tool_result", tool_use_id: "edit-2", content: "old_string not found", is_error: true }),
    row("d-wait", "d-fail", 4000, "assistant", { type: "tool_use", id: "read-3", name: "Read", input: { file_path: "src/b.ts" } }),
  ];
  const file = `${dir}/detail-source.jsonl`; writeFileSync(file, jsonl(rows));
  const receipt: TimelineReceipt = { session: sid, cwd, slot: 3, openedAt: CREATED, harness: "claude", project: "project-1",
    program: PROGRAM, task: TASK, branch: BRANCH, at: CREATED, proof: "c".repeat(64) };
  const index = new TimelineIndex({ host: "test-host", carriers: [], live: () => [receipt], tasks: () => [],
    resolve: (r) => ({ file, harness: "claude", format: "claude-jsonl", cwd: r.cwd }),
    worktreeOf: () => cwd, projectOf: () => "project-1", redactions: () => [NATIVE_CANARY], traceVersion: () => "fixed",
    trace: async () => ({ result: "unknown-task", task: TASK, searched: [], horizon: [] }) });
  const url = new URL("http://fixture/api/timeline?from=0&to=9999999999999");
  const page = (await index.page(url)).body as TimelinePage;
  const entry = (call: string, kind: string) => page.entries.find((e) => e.event?.refs.call === call && e.event.kind === kind)!;
  const open = async (ref: string, extra = "") => {
    const r = await index.detail(new URL(`http://fixture/api/timeline/detail?ref=${ref}${extra}`));
    return { status: r.status, body: r.body as TimelineDetail };
  };
  const fp = (offset: number, bytes: number): string => createHash("sha256")
    .update(new TextEncoder().encode(jsonl(rows)).subarray(offset, offset + bytes)).digest("hex").slice(0, 16);
  const callEntry = entry("bash-1", "tool.call"), resultEntry = entry("bash-1", "tool.result");
  const viaCall = await open(callEntry.id), viaResult = await open(resultEntry.id);
  const d = viaCall.body, args = d.arguments?.value as { command?: string } | undefined;
  check("timeline detail opens exactly one call with arguments, result, both record times and the original byte ranges",
    viaCall.status === 200 && d.state === "read" && d.gaps.length === 0 && d.call?.call === "bash-1"
      && !!args?.command?.includes("./run") && shows(d.resultText?.value, "ran ok") && d.error === null
      && d.call.occurredAt === CREATED + 1000 && d.result?.occurredAt === CREATED + 2500
      && d.separation?.ms === 1500 && d.duration === null && d.clockUncertainty === "unknown"
      && d.source?.name === "detail-source.jsonl" && d.source.harness === "claude"
      && d.call.range.offset === 0 && d.call.range.block === 1 && d.call.range.fp === fp(d.call.range.offset, d.call.range.bytes)
      && d.result.range.offset === d.call.range.bytes + 1 && d.result.range.fp === fp(d.result.range.offset, d.result.range.bytes)
      && viaResult.status === 200 && JSON.stringify({ ...viaResult.body, ref: "", revision: "" }) === JSON.stringify({ ...d, ref: "", revision: "" })
      && d.work.sourceReads === 2, JSON.stringify(viaCall));
  const failed = (await open(entry("edit-2", "tool.call").id)).body;
  check("timeline detail carries a failed result as its error, not as a result",
    failed.state === "read" && failed.outcome === "error" && failed.resultText === null
      && shows(failed.error?.value, "old_string not found"), JSON.stringify(failed));
  const waiting = (await open(entry("read-3", "tool.call").id)).body;
  check("timeline detail of a pending call names its missing result instead of inventing one",
    waiting.state === "read" && waiting.status === "pending" && waiting.result === null && waiting.resultText === null
      && waiting.gaps.some((g) => g.code === "missing-result") && !!waiting.arguments, JSON.stringify(waiting));
  const wire = JSON.stringify([viaCall.body, viaResult.body]);
  check("timeline detail redacts normalizeNative's own markers: the canary and a bearer value",
    !wire.includes(NATIVE_CANARY) && !wire.includes(DETAIL_SECRETS.bearer) && wire.includes("[redacted]"));
  check("timeline detail redacts secrets the markers never knew: an assigned password and a secret-named key",
    !wire.includes(DETAIL_SECRETS.assigned) && !wire.includes(DETAIL_SECRETS.keyed), wire);
  const forged = await open(createHash("sha256").update("never issued").digest("hex"));
  const locator = callEntry.event!.detailRef!.locator;
  const refused = [await open(encodeURIComponent(locator)), await open(callEntry.id, "&path=/etc/passwd"),
    await open(callEntry.id, `&ref=${resultEntry.id}`), await open("..%2F..%2Fetc%2Fpasswd")];
  check("timeline detail refuses an id the index never issued without reading, and any path, locator or second ref",
    forged.status === 404 && forged.body.work.sourceReads === 0 && !("arguments" in forged.body)
      && refused.every((r) => r.status === 400 && r.body.work.sourceReads === 0), JSON.stringify([forged, ...refused.map((r) => r.status)]));
  writeFileSync(file, jsonl(rows).replace("ran ok", "ran OK"));
  const rewritten = await open(callEntry.id);
  check("timeline detail of a rewritten source answers a named gap without old bytes",
    rewritten.status === 200 && rewritten.body.state === "gap" && rewritten.body.gaps.some((g) => g.code === "source-rewritten")
      && rewritten.body.arguments === null && rewritten.body.resultText === null, JSON.stringify(rewritten));
  const fresh = (await index.page(url)).body as TimelinePage;
  const freshCall = fresh.entries.find((e) => e.event?.refs.call === "bash-1" && e.event.kind === "tool.call")!;
  rmSync(file);
  const vanished = await open(freshCall.id);
  check("timeline detail of a deleted source answers a named gap, never an empty success",
    freshCall.id !== callEntry.id && vanished.status === 200 && vanished.body.state === "gap"
      && vanished.body.gaps.some((g) => g.code === "source-missing") && vanished.body.arguments === null, JSON.stringify(vanished));
  const many = Array.from({ length: TIMELINE_RETIRED_REFS + 1 }, (_, i) => ({ id: createHash("sha256").update(`cap-${i}`).digest("hex") }));
  index["retire"]({ snapshot: { events: many } }, "source-rewritten");
  const [evicted, kept] = [await open(many[0]!.id), await open(many[1]!.id)];
  check("timeline detail tombstones are capped at TIMELINE_RETIRED_REFS and evict the oldest first",
    index["retired"].size === TIMELINE_RETIRED_REFS && evicted.status === 404 && kept.status === 200 && kept.body.state === "gap",
    `size=${index["retired"].size} evicted=${evicted.status} kept=${kept.status}`);
}

const TIMELINE_SIDS = NATIVE_FIXTURES.map((_, i) => `40000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
function timelineFixtures(dir: string): void {
  const proposedCwd = `${FIX}/native-repo`; mkdirSync(proposedCwd, { recursive: true });
  const cwd = realpathSync(proposedCwd);
  mkdirSync(`${dir}/streams`, { recursive: true });
  const prompts: unknown[] = [], lanes: unknown[] = [];
  for (const [i, f] of NATIVE_FIXTURES.entries()) {
    const sid = TIMELINE_SIDS[i]!;
    const text = new TextDecoder().decode(f.input.bytes).replaceAll(f.input.binding!.sessionId, sid)
      .replaceAll(f.input.binding!.cwd, cwd).replace(/2026-01-01T00:00:[0-9:.]+Z/g,
        (at: string) => new Date(DISPATCHED + Date.parse(at) - Date.parse("2026-01-01T00:00:00.000Z")).toISOString());
    // the owner credential inside a codex payload: the detail route must strip what this instance knows as secret
    const payload = f.name === "codex" ? text.replaceAll(NATIVE_CANARY, `${NATIVE_CANARY} ${TOKEN}`) : text;
    let file: string;
    if (f.name === "claude") file = `${dir}/native-claude/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}/${sid}.jsonl`;
    else if (f.name === "codex") file = `${dir}/native-codex/2026/01/01/rollout-test-${sid}.jsonl`;
    else {
      const root = f.name === "pi" ? `${dir}/home/.pi/agent` : `${dir}/native-pi-zai`;
      const real = realpathSync(cwd);
      file = `${root}/sessions/--${real.replace(/^\/+/, "").replaceAll("/", "-")}--/test_${sid}.jsonl`;
    }
    mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true }); writeFileSync(file, payload);
    prompts.push({ ts: DISPATCHED, slot: 20 + i, openedAt: DISPATCHED, sessionId: sid, cwd, text: NATIVE_CANARY });
    lanes.push({ s: 20 + i, openedAt: DISPATCHED, sessionId: sid, taskId: TASK, programId: PROGRAM,
      branch: BRANCH, projectKey: "project-fixture" });
  }
  const sid = "40000000-0000-4000-8000-000000000099";
  prompts.push({ ts: DISPATCHED, slot: 29, openedAt: DISPATCHED, sessionId: sid, cwd, text: NATIVE_CANARY });
  lanes.push({ s: 29, openedAt: DISPATCHED, sessionId: sid, taskId: TASK, programId: PROGRAM,
    branch: BRANCH, projectKey: "project-fixture" });
  writeFileSync(`${dir}/streams/prompts.jsonl`, jsonl(prompts));
  writeFileSync(`${dir}/state-snapshots.jsonl`, jsonl([{ ts: DISPATCHED + 3000, lanes }]));
}

async function timelineRouteProbes(base: string, headers: Record<string, string>): Promise<void> {
  const query = `from=${DISPATCHED}&to=${AUDITED}&program=${PROGRAM}&project=project-fixture`;
  const get = async (extra = "") => {
    const r = await fetch(`${base}/api/timeline?${query}${extra}`, { headers });
    return { status: r.status, body: await r.json() as TimelinePage };
  };
  let result = await get();
  for (let i = 0; i < 20 && result.body.pending; i++) { await Bun.sleep(100); result = await get(); }
  const body = result.body;
  const tool = body.entries.filter((e) => e.event?.kind.startsWith("tool."));
  check("timeline owner route shows every native harness with every retained call and result exactly once",
    result.status === 200 && body.schema === "fleet.timeline/v1" && tool.length === 4 * NATIVE_FIXTURES.length
      && new Set(tool.map((e) => e.id)).size === 4 * NATIVE_FIXTURES.length
      && NATIVE_FIXTURES.every((f) => body.sessions.some((s) => s.harness === f.name))
      && tool.every((e) => e.event?.detailRef?.locator.startsWith("native:")),
    `${result.status} tools=${tool.length} harnesses=${body.sessions.map((s) => s.harness).join(",")}`);
  check("timeline window retains parallel sessions and a missing-source session without smoothing clocks or edges",
    body.sessions.length === NATIVE_FIXTURES.length + 1 && body.sessions.some((s) => s.gaps.some((g) => g.code === "source-missing"))
      && body.sessions.every((s) => s.host === body.host && s.occupation.openedAt === DISPATCHED && s.clockUncertainty === "unknown")
      && body.entries.some((e) => e.event?.kind === "report.filed.complete" && e.sessionKey === null)
      && body.entries.some((e) => e.event?.kind === "audit.green"), JSON.stringify(body.sessions));
  const codex = await get("&harness=codex&session=" + TIMELINE_SIDS[1]);
  check("timeline native filters preserve exactly one session and its four events",
    codex.body.sessions.length === 1 && codex.body.sessions[0]?.harness === "codex"
      && codex.body.entries.filter((e) => e.event?.kind.startsWith("tool.")).length === 4);
  const unchanged = await get();
  check("timeline route second unchanged poll reads no source and fits the measured page budget",
    unchanged.body.work.sourceReads === 0 && unchanged.body.work.readBytes === 0
      && Buffer.byteLength(JSON.stringify(unchanged.body)) <= TIMELINE_BUDGET.pageBytes
      && !JSON.stringify(unchanged.body).includes(NATIVE_CANARY)
      && !JSON.stringify(unchanged.body).includes("RAW-REPORT-TEXT"));
  const pages: TimelinePage[] = []; let cursor: string | null = null;
  do { const r = await get("&limit=3" + (cursor ? "&cursor=" + cursor : "")); pages.push(r.body); cursor = r.body.nextCursor; }
  while (cursor && pages.length < 50);
  const all = pages.flatMap((p) => p.entries);
  check("timeline route pagination preserves every entry once across equal times",
    pages.length > 1 && !cursor && all.length === body.entries.length && new Set(all.map((e) => e.id)).size === all.length);
  const bad = await fetch(`${base}/api/timeline?${query}&file=/etc/passwd`, { headers });
  const anon = await fetch(`${base}/api/timeline?${query}`);
  check("timeline route is owner-only and has no caller-selected file door", bad.status === 400 && anon.status === 401);
  const codexCall = tool.find((e) => e.event?.kind === "tool.call" && e.event.refs.call === "exec-1")!;
  const detail = async (q: string, h: Record<string, string> = headers) => {
    const r = await fetch(`${base}/api/timeline/detail?${q}`, { headers: h });
    return { status: r.status, text: await r.text() };
  };
  const opened = await detail(`ref=${codexCall.id}`);
  const openedBody = JSON.parse(opened.text) as TimelineDetail;
  check("timeline detail route opens a listed native call with its source range, redacted on the wire",
    opened.status === 200 && openedBody.state === "read" && openedBody.call?.call === "exec-1"
      && shows(openedBody.arguments?.value, "tools.first") && openedBody.resultText !== null
      && openedBody.call.range.locator === codexCall.event!.detailRef!.locator && openedBody.source?.harness === "codex"
      && !opened.text.includes(TOKEN) && opened.text.includes("[redacted]"), opened.text.slice(0, 600));
  const [forged, pathed, anonDetail] = [await detail(`ref=${"0".repeat(64)}`), await detail(`ref=${codexCall.id}&file=/etc/passwd`),
    await detail(`ref=${codexCall.id}`, {})];
  check("timeline detail route refuses a never-issued ref, a caller path and a missing owner credential",
    forged.status === 404 && pathed.status === 400 && anonDetail.status === 401 && !forged.text.includes("arguments"),
    `${forged.status} ${pathed.status} ${anonDetail.status}`);
}

export async function run(): Promise<void> {
  await runNativeProbes(check);
  rmSync(FIX, { recursive: true, force: true });
  const dir = `${FIX}/instance`;
  const repo = `${FIX}/repo`;
  const { forkSha, landedSha } = fixtureRepo(repo);
  stage(dir);
  fixtureLedgers(dir, repo, forkSha, landedSha);

  timelineFixtures(dir);
  await timelineProbes();
  await timelineDetailProbes();
  const port = PORT + OFF;
  const sock = `${SOCK}trace${OFF}`;
  const base = `http://${IP}:${port}`;
  let out = "";
  const proc = Bun.spawn(["bun", "server.ts"], {
    cwd: dir, stdout: "pipe", stderr: "pipe",
    env: { ...process.env, FLEET_HOST: IP, FLEET_PORT: String(port), FLEET_SOCK: sock, FLEET_TOKEN: TOKEN,
      HOME: `${dir}/home`, FLEET_CLAUDE_PROJECTS_DIR: `${dir}/native-claude`, FLEET_CODEX_SESSIONS_DIR: `${dir}/native-codex`,
      FLEET_PI_ZAI_AGENT_DIR: `${dir}/native-pi-zai`,
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
    // a fixture that never came up fails as itself: every probe below reads a body it cannot have,
    // and the first one to throw would take the rest of the shard with it (audit-red 8afd11ed)
    if (!up) return;
    const get = async (task: string): Promise<{ status: number; body: Trace }> => {
      const r = await fetch(`${base}/api/trace?task=${encodeURIComponent(task)}`, { headers: H });
      return { status: r.status, body: (await r.json().catch(() => ({}))) as Trace };
    };

    await timelineRouteProbes(base, H);
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

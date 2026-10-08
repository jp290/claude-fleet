import { normalizeNative, type NativeInput, type NativeSnapshot } from "../trace-native";

export const NATIVE_CANARY = "CREDENTIAL-CANARY-DO-NOT-SHIP";
const T = Date.parse("2026-01-01T00:00:00.000Z");
const SID = "30000000-0000-4000-8000-000000000001";
const CHILD = "30000000-0000-4000-8000-000000000002";
const OTHER = "30000000-0000-4000-8000-000000000003";
const CWD = "/synthetic/repo";
const iso = (ms: number): string => new Date(T + ms).toISOString();
const encode = (rows: readonly unknown[]): Uint8Array => new TextEncoder().encode(rows.map((r) => JSON.stringify(r) + "\n").join(""));
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
// t(ms) | event                  | exclusive source owner
// 0     | Codex/Pi header        | bound fixture session
// 1000  | outer call(s)          | bound fixture session
// 1200  | sibling Pi branch call | same session, different parent path
// 2000  | result(s)              | matching call on that source generation/path
// 3000  | observer snapshot      | fixture observer (separate clock)
// 4000  | appended observation   | fixture observer (late means pending was observed)
const claudeRows = [
  { type: "assistant", sessionId: SID, cwd: CWD, uuid: "c-call", parentUuid: null, timestamp: iso(1000),
    message: { content: [{ type: "tool_use", id: "edit-1", name: "Edit", input: { file_path: "src/a.ts", old_string: NATIVE_CANARY } }] } },
  { type: "user", sessionId: SID, cwd: CWD, uuid: "c-result", parentUuid: "c-call", timestamp: iso(2000),
    message: { content: [{ type: "tool_result", tool_use_id: "edit-1", content: NATIVE_CANARY, is_error: false }] } },
  { type: "assistant", sessionId: SID, cwd: CWD, uuid: "c-side", parentUuid: "c-call", isSidechain: true, timestamp: iso(2000),
    message: { content: [{ type: "tool_use", id: "side-1", name: "Bash", input: { command: `echo ${NATIVE_CANARY}` } }] } },
  { type: "user", sessionId: SID, cwd: CWD, uuid: "c-side-result", parentUuid: "c-side", isSidechain: true, timestamp: iso(2000),
    message: { content: [{ type: "tool_result", tool_use_id: "side-1", content: NATIVE_CANARY, is_error: true }] } },
];
const codexRows = [
  { type: "session_meta", timestamp: iso(0), payload: { id: SID, cwd: CWD, timestamp: iso(0), thread_source: "user" } },
  { type: "response_item", timestamp: iso(1000), payload: { type: "function_call", call_id: "exec-1", namespace: "functions", name: "exec",
    arguments: `await tools.first(); await tools.second(); /* ${NATIVE_CANARY} */` } },
  { type: "response_item", timestamp: iso(2000), payload: { type: "function_call_output", call_id: "exec-1", output: NATIVE_CANARY } },
  { type: "response_item", timestamp: iso(2000), payload: { type: "custom_tool_call", call_id: "patch-1", name: "apply_patch", input: NATIVE_CANARY } },
  { type: "response_item", timestamp: iso(2000), payload: { type: "custom_tool_call_output", call_id: "patch-1", output: NATIVE_CANARY } },
];
const piRows = [
  { type: "session", version: 3, id: SID, cwd: CWD, timestamp: iso(0) },
  { type: "message", id: "p-root", parentId: null, timestamp: iso(0), message: { role: "user", content: [{ type: "text", text: NATIVE_CANARY }] } },
  { type: "message", id: "p-a", parentId: "p-root", timestamp: iso(1000), message: { role: "assistant", timestamp: T + 500,
    content: [{ type: "toolCall", id: "pi-edit", name: "edit", arguments: { path: "src/pi.ts", edits: NATIVE_CANARY } }] } },
  { type: "message", id: "p-b", parentId: "p-root", timestamp: iso(1200), message: { role: "assistant",
    content: [{ type: "toolCall", id: "pi-edit", name: "edit", arguments: { path: "src/branch.ts", edits: NATIVE_CANARY } }] } },
  { type: "message", id: "p-ra", parentId: "p-a", timestamp: iso(2000), message: { role: "toolResult", toolCallId: "pi-edit", toolName: "edit",
    content: [{ type: "text", text: NATIVE_CANARY }], isError: false, details: { executionTime: 999, fullOutputPath: "/private/not-read" } } },
  { type: "message", id: "p-rb", parentId: "p-b", timestamp: iso(2000), message: { role: "toolResult", toolCallId: "pi-edit", toolName: "edit",
    content: [{ type: "text", text: NATIVE_CANARY }], isError: true } },
];
export interface NativeFixture {
  name: string; rows: readonly unknown[]; input: NativeInput;
  expected: { calls: string[]; results: string[]; statuses: NativeSnapshot["events"][number]["status"][] };
}
function fixture(name: string, harness: string, format: string, rows: readonly unknown[], calls: string[], results: string[],
  statuses: NativeFixture["expected"]["statuses"]): NativeFixture {
  return { name, rows, input: { sourceHost: "synthetic-host", sourceId: name, harness, format, version: "generation-1",
    bytes: encode(rows), byteOffset: 0, observedAt: T + 3000, binding: { sessionId: SID, cwd: CWD }, redactions: [NATIVE_CANARY] },
    expected: { calls, results, statuses } };
}
export const NATIVE_FIXTURES: readonly NativeFixture[] = [
  fixture("claude", "claude", "claude-jsonl", claudeRows, ["edit-1", "side-1"], ["edit-1", "side-1"], ["ok", "ok", "error", "error"]),
  fixture("codex", "codex", "codex-rollout-jsonl", codexRows, ["exec-1", "patch-1"], ["exec-1", "patch-1"], ["unknown", "unknown", "unknown", "unknown"]),
  fixture("pi", "pi", "pi-session-jsonl", piRows, ["pi-edit", "pi-edit"], ["pi-edit", "pi-edit"], ["ok", "error", "ok", "error"]),
  fixture("pi-zai", "pi-zai", "pi-session-jsonl", piRows, ["pi-edit", "pi-edit"], ["pi-edit", "pi-edit"], ["ok", "error", "ok", "error"]),
  fixture("pi-ox", "pi-ox", "pi-session-jsonl", piRows, ["pi-edit", "pi-edit"], ["pi-edit", "pi-edit"], ["ok", "error", "ok", "error"]),
];
export interface SyntheticDetail { locator: string; redacted: true; text: string }
export interface NativeUiFixture { name: string; snapshot: NativeSnapshot; details: SyntheticDetail[];
  measure: { inputBytes: number; metadataBytes: number; detailBytes: number; events: number } }
export async function loadNativeUiFixtures(): Promise<NativeUiFixture[]> {
  return Promise.all(NATIVE_FIXTURES.map(async (f) => {
    const snapshot = await normalizeNative(f.input);
    const details = snapshot.events.map((e) => ({ locator: e.detailRef!.locator, redacted: true as const,
      text: `Synthetic ${e.kind} ${e.refs.call}: [redacted]` }));
    return { name: f.name, snapshot, details, measure: { inputBytes: f.input.bytes.length,
      metadataBytes: new TextEncoder().encode(JSON.stringify(snapshot)).length,
      detailBytes: new TextEncoder().encode(JSON.stringify(details)).length, events: snapshot.events.length } };
  }));
}
type Check = (name: string, ok: boolean, detail?: string) => void;
const equal = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const hasGap = (s: NativeSnapshot, code: string): boolean => s.gaps.some((g) => g.code === code);
const changeRows = (f: NativeFixture, change: (rows: Record<string, unknown>[]) => void): NativeInput => {
  const rows = JSON.parse(JSON.stringify(f.rows)) as Record<string, unknown>[];
  change(rows); return { ...f.input, bytes: encode(rows) };
};

export async function runNativeProbes(check: Check): Promise<void> {
  for (const f of NATIVE_FIXTURES) {
    const cut = Math.floor(f.input.bytes.length / 2);
    const prefix = await normalizeNative({ ...f.input, bytes: f.input.bytes.slice(0, cut) });
    const complete = await normalizeNative({ ...f.input, bytes: f.input.bytes.slice(cut), byteOffset: cut,
      observedAt: f.input.observedAt + 1000 }, prefix);
    check(`native streamed delta ${f.name} retains every call and exact original byte locators`,
      complete.events.length === 4 && new Set(complete.events.map((e) => e.id)).size === 4
        && complete.events.filter((e) => e.kind === "tool.call").length === 2
        && !hasGap(complete, "partial-record") && complete.completeBytes === f.input.bytes.length
        && complete.events.every((e) => e.detailRef?.fp && e.record.offset + e.record.bytes <= complete.completeBytes),
      JSON.stringify(complete.gaps));
  }
  const boundDelta = NATIVE_FIXTURES[1]!;
  const deltaCut = Math.floor(boundDelta.input.bytes.length / 2);
  const deltaPrefix = await normalizeNative({ ...boundDelta.input, bytes: boundDelta.input.bytes.slice(0, deltaCut) });
  for (const field of ["sourceHost", "sourceId", "version"] as const) {
    const foreign = await normalizeNative({ ...boundDelta.input, [field]: "foreign-generation",
      bytes: boundDelta.input.bytes.slice(deltaCut), byteOffset: deltaCut }, deltaPrefix);
    check(`native streamed ${field} change cannot inherit another source prefix`,
      foreign.state === "rejected" && foreign.events.length === 0 && hasGap(foreign, "invalid-source-metadata"));
  }
  const piped = NATIVE_FIXTURES[2]!;
  const compound = await normalizeNative({ ...piped.input, bytes: new TextEncoder().encode(
    decode(piped.input.bytes).replaceAll("pi-edit", "call_abc|fc_123")) });
  check("native Pi compound provider call IDs pair on their exact retained identifier",
    compound.events.length === 4 && compound.events.every((e) => e.refs.call === "call_abc|fc_123" && e.pair !== null));
  const ui = await loadNativeUiFixtures();
  for (const [i, f] of NATIVE_FIXTURES.entries()) {
    const s = ui[i]!.snapshot;
    check(`native ${f.name}: original call IDs exactly once`, s.state === "read"
      && equal(s.events.filter((e) => e.kind === "tool.call").map((e) => e.refs.call), f.expected.calls), `calls=${s.events.filter((e) => e.kind === "tool.call").length}`);
    check(`native ${f.name}: original result IDs exactly once`, equal(s.events.filter((e) => e.kind === "tool.result").map((e) => e.refs.call), f.expected.results));
    check(`native ${f.name}: exact outcome statuses`, equal(s.events.map((e) => e.status), f.expected.statuses));
    check(`native ${f.name}: reciprocal ID pairs`, s.events.length === 4 && s.events.every((e) => s.events.some((p) => p.id === e.pair
      && p.pair === e.id && p.refs.call === e.refs.call && p.kind !== e.kind)));
    check(`native ${f.name}: source version and stable identity`, s.events.length === 4 && s.events.every((e) => e.sourceHost === "synthetic-host"
      && e.sourceVersion === "generation-1" && e.refs.session === SID && e.sessionKey === s.identityKey));
    const badId = changeRows(f, (rows) => {
      if (f.input.harness === "claude") rows[0]!.sessionId = OTHER;
      else if (f.input.harness === "codex") (rows[0]!.payload as Record<string, unknown>).id = OTHER;
      else rows[0]!.id = OTHER;
    });
    const wrongId = await normalizeNative(badId);
    check(`native UUID fence ${f.name}`, wrongId.state === "rejected" && wrongId.events.length === 0 && hasGap(wrongId, "session-id-mismatch"));
    const badCwd = changeRows(f, (rows) => {
      if (f.input.harness === "codex") (rows[0]!.payload as Record<string, unknown>).cwd = "/synthetic/repo-other";
      else rows[0]!.cwd = "/synthetic/repo-other";
    });
    const wrongCwd = await normalizeNative(badCwd);
    check(`native cwd fence ${f.name}`, wrongCwd.state === "rejected" && wrongCwd.events.length === 0 && hasGap(wrongCwd, "cwd-mismatch"));
    const unbound = await normalizeNative({ ...f.input, binding: null });
    check(`native ${f.name}: missing binding refuses foreign events`, unbound.state === "rejected" && unbound.events.length === 0 && hasGap(unbound, "missing-binding"));
    const replay = await normalizeNative(f.input, s);
    check(`native ${f.name}: snapshot replay emits no additions or updates`, replay.events.length === 4 && replay.added.length === 0 && replay.updated.length === 0);
    const appendedReplay = await normalizeNative({ ...f.input, bytes: encode([...f.rows, ...f.rows.slice(f.name === "claude" ? 0 : 1)]) }, s);
    check(`native ${f.name}: appended native replay stays exactly once`, appendedReplay.events.length === 4 && appendedReplay.added.length === 0 && appendedReplay.updated.length === 0);
  }
  const claude = NATIVE_FIXTURES[0]!, codex = NATIVE_FIXTURES[1]!, pi = NATIVE_FIXTURES[2]!;
  const c = ui[0]!.snapshot, x = ui[1]!.snapshot, p = ui[2]!.snapshot;
  check("native Claude: sidechains retain both original record edges", equal(c.events.filter((e) => e.record.sidechain).map((e) => [e.record.id, e.refs.parent]),
    [["c-side", "c-call"], ["c-side-result", "c-side"]]));
  check("native Codex: outer exec carries namespace and never fabricates inner calls", x.events.filter((e) => e.kind === "tool.call").length === 2
    && x.events[0]!.tool.name === "exec" && x.events[0]!.tool.namespace === "functions" && x.events[0]!.tool.innerCalls === "unsupported"
    && x.events.every((e) => e.files.length === 0));
  check("native Codex: function/custom outputs pair only with their original family", equal(x.events.map((e) => e.tool.family),
    ["function_call", "function_call", "custom_tool_call", "custom_tool_call"]));
  check("native Pi: sibling branches keep exact parent pairs", equal(p.events.filter((e) => e.kind === "tool.result").map((e) =>
    [e.record.id, p.events.find((c) => c.id === e.pair)?.record.id]), [["p-ra", "p-a"], ["p-rb", "p-b"]]));
  const crossBranch = await normalizeNative(changeRows(pi, (rows) => { rows[4]!.parentId = "p-root"; }));
  check("native Pi: sibling output cannot cross a branch", crossBranch.events.length === 4
    && crossBranch.events.find((e) => e.record.id === "p-ra")?.pair === null && hasGap(crossBranch, "orphan-result"));
  check("native Pi families: zai/ox have independent source identities", ui[2]!.snapshot.identityKey !== ui[3]!.snapshot.identityKey
    && ui[3]!.snapshot.identityKey !== ui[4]!.snapshot.identityKey && equal(ui[3]!.snapshot.events.map((e) => e.refs.call), ["pi-edit", "pi-edit", "pi-edit", "pi-edit"]));
  const sub = await normalizeNative({ ...changeRows(codex, (rows) => {
    const h = rows[0]!.payload as Record<string, unknown>; h.id = CHILD; h.thread_source = "subagent";
    h.source = { subagent: { thread_spawn: { parent_thread_id: SID } } };
  }), binding: { sessionId: CHILD, cwd: CWD } });
  check("native subagent: only recorded parent_session creates an edge", sub.events.length === 4
    && sub.events.every((e) => e.edge?.from.session === SID && e.edge.to.session === CHILD && e.refs.session === CHILD));
  check("native same cwd alone creates no subagent edge", x.events.length === 4 && x.events.every((e) => !e.edge));
  const unknownOccupation = c.events.every((e) => e.refs.slot === undefined && e.refs.openedAt === undefined);
  check("native occupation: absence remains unknown", c.events.length === 4 && unknownOccupation && c.identity?.occupation === "unknown");
  const bound = { ...codex.input, binding: { sessionId: SID, cwd: CWD,
    occupation: { sourceHost: "synthetic-host", sessionId: SID, cwd: CWD, slot: 7, openedAt: T - 1000, proofHash: "a".repeat(64) } } };
  const first = await normalizeNative(bound);
  check("native occupation: explicit matching receipt supplies exact pair", first.events.length === 4
    && first.events.every((e) => e.refs.slot === 7 && e.refs.openedAt === T - 1000));
  const recycled = await normalizeNative({ ...bound, binding: { ...bound.binding,
    occupation: { ...bound.binding.occupation, openedAt: T + 5000 } } }, first);
  check("native recycle: same slot has separate identities and invalidates former refs", recycled.events.length === 4
    && recycled.identityKey !== first.identityKey && recycled.invalidated.length === 4 && recycled.added.length === 4);
  const badReceipt = await normalizeNative({ ...bound, binding: { ...bound.binding,
    occupation: { ...bound.binding.occupation, sessionId: OTHER } } });
  check("native occupation: foreign receipt is rejected", badReceipt.events.length === 0 && hasGap(badReceipt, "occupation-mismatch"));
  const foreignHost = await normalizeNative({ ...codex.input, sourceHost: "another-host" }, x);
  check("native host: identical IDs on another host never join", foreignHost.events.length === 4 && foreignHost.invalidated.length === 4
    && foreignHost.identityKey !== x.identityKey);
  const pendingInput = { ...codex.input, bytes: encode(codex.rows.slice(0, 2)) };
  const pending = await normalizeNative(pendingInput);
  check("native missing result: exact original call stays pending", pending.events.length === 1 && pending.events[0]!.refs.call === "exec-1"
    && pending.events[0]!.status === "pending" && pending.events[0]!.duration === null && hasGap(pending, "missing-result"));
  const late = await normalizeNative({ ...codex.input, observedAt: T + 4000 }, pending);
  check("native late result: observed pending call updates once, one output arrives", late.events.length === 4
    && late.events[0]!.status === "late" && late.events[1]!.status === "late" && late.updated.length === 1 && late.added.length === 3
    && late.events[0]!.observedAt === T + 3000 && late.events[1]!.observedAt === T + 4000);
  const lateReplay = await normalizeNative({ ...codex.input, observedAt: T + 5000 }, late);
  check("native late replay: status and observation are stable", lateReplay.events.length === 4 && lateReplay.added.length === 0 && lateReplay.updated.length === 0);
  const orphan = await normalizeNative({ ...codex.input, bytes: encode([codex.rows[0], codex.rows[2]]) });
  check("native orphan result: retained once without fabricated call", orphan.events.length === 1 && orphan.events[0]!.refs.call === "exec-1"
    && orphan.events[0]!.pair === null && hasGap(orphan, "orphan-result"));
  const wrongFamily = await normalizeNative(changeRows(codex, (rows) => { (rows[2]!.payload as Record<string, unknown>).type = "custom_tool_call_output"; }));
  check("native wrong output family: same call_id does not pair", wrongFamily.events.length === 4 && wrongFamily.events[0]!.status === "pending" && hasGap(wrongFamily, "orphan-result"));
  const full = encode(codex.rows.slice(0, 3)), cut = full.length - 9;
  const partial = await normalizeNative({ ...codex.input, bytes: full.slice(0, cut) });
  const partialGap = partial.gaps.find((g) => g.code === "partial-record");
  check("native partial line: exact byte gap is pending, not a result", partial.events.length === 1 && partialGap?.offset === pendingInput.bytes.length
    && partialGap.bytes === cut - pendingInput.bytes.length && partial.completeBytes === pendingInput.bytes.length);
  const completed = await normalizeNative({ ...codex.input, bytes: full }, partial);
  check("native partial completion: exact output appears once", completed.events.length === 2 && completed.added.length === 1
    && completed.updated.length === 1 && completed.events[1]!.refs.call === "exec-1");
  const shrink = await normalizeNative(pendingInput, x);
  check("native shrink: every old reference invalidates", shrink.events.length === 1 && shrink.invalidated.length === 4 && hasGap(shrink, "source-rewritten"));
  const rewrite = await normalizeNative(changeRows(codex, (rows) => { (rows[1]!.payload as Record<string, unknown>).call_id = "exec-2"; }), x);
  check("native same-size rewrite: original reference cannot serve new bytes", rewrite.events.length === 4 && rewrite.invalidated.length === 4
    && rewrite.events[0]!.refs.call === "exec-2" && rewrite.events[0]!.detailRef?.fp !== x.events[0]!.detailRef?.fp);
  const version = await normalizeNative({ ...codex.input, version: "generation-2" }, x);
  check("native version change: equal content still gets new locators", version.events.length === 4 && version.invalidated.length === 4
    && version.events[0]!.detailRef?.locator !== x.events[0]!.detailRef?.locator);
  const invalid = await normalizeNative({ ...codex.input, bytes: new TextEncoder().encode(decode(pendingInput.bytes) + '{invalid}\n') });
  check("native malformed complete record: byte range is explicit", invalid.events.length === 1 && hasGap(invalid, "malformed-record"));
  const unsupported = await normalizeNative({ ...codex.input, format: "codex-unknown-v9" });
  check("native unsupported format: concrete format without foreign events", unsupported.state === "unsupported"
    && unsupported.format === "codex-unknown-v9" && unsupported.events.length === 0);
  const harness = await normalizeNative({ ...codex.input, harness: "unknown-harness" });
  check("native unsupported harness: no fallback to another family", harness.state === "unsupported" && harness.events.length === 0);
  const piVersion = await normalizeNative(changeRows(pi, (rows) => { rows[0]!.version = 99; }));
  check("native unsupported Pi revision: v99 is not silently v3", piVersion.state === "unsupported" && piVersion.events.length === 0 && hasGap(piVersion, "unsupported-pi-version"));
  const laterId = await normalizeNative(changeRows(claude, (rows) => { rows[3]!.sessionId = OTHER; }));
  check("native later UUID: whole generation refuses mixed identity", laterId.events.length === 0 && hasGap(laterId, "session-id-mismatch"));
  const contextCwd = await normalizeNative({ ...codex.input, bytes: encode([...codex.rows,
    { type: "turn_context", timestamp: iso(2000), payload: { cwd: "/synthetic/foreign" } }]) });
  check("native later cwd: turn_context cannot switch binding", contextCwd.events.length === 0 && hasGap(contextCwd, "cwd-mismatch"));
  const conflictRows = JSON.parse(JSON.stringify(codex.rows)) as Record<string, unknown>[];
  (conflictRows[1]!.payload as Record<string, unknown>).arguments = "different arguments";
  const conflicting = await normalizeNative({ ...codex.input, bytes: encode([...codex.rows, conflictRows[1]]) });
  check("native conflicting replay: reused call_id fails closed", conflicting.state === "rejected" && conflicting.events.length === 0
    && hasGap(conflicting, "ambiguous-call-identity"));
  const duplicateSource = await normalizeNative({ ...codex.input, sourceId: "codex-independent-source" }, x);
  check("native duplicate source: same session requires explicit independent source identity", duplicateSource.events.length === 4
    && duplicateSource.identityKey !== x.identityKey && duplicateSource.invalidated.length === 4);
  const headerOnly = await normalizeNative({ ...codex.input, bytes: codex.input.bytes.slice(0, 30) });
  check("native partial header: identity remains pending", headerOnly.state === "pending" && headerOnly.events.length === 0);
  const forgedPrevious: NativeSnapshot = { ...x, events: x.events.map((e) => ({ ...e,
    detailRef: { source: NATIVE_CANARY, locator: `/private/${NATIVE_CANARY}`, fp: "0".repeat(16) } })) };
  const forgedLocator = await normalizeNative({ ...codex.input, version: "generation-2" }, forgedPrevious);
  check("native prior locator: arbitrary private path cannot become delivered invalidation", forgedLocator.events.length === 4
    && forgedLocator.invalidated.length === 0 && !JSON.stringify(forgedLocator).includes(NATIVE_CANARY)
    && !JSON.stringify(forgedLocator).includes("/private/"));
  const badOffset = await normalizeNative({ ...codex.input, byteOffset: 12 });
  check("native unsupported window: headerless offset cannot assert identity", badOffset.events.length === 0 && hasGap(badOffset, "invalid-source-metadata"));
  check("native files: only direct structured relative input survives", equal(c.events.map((e) => e.files), [["src/a.ts"], [], [], []])
    && equal(p.events.filter((e) => e.kind === "tool.call").map((e) => e.files), [["src/pi.ts"], ["src/branch.ts"]]));
  const absolute = await normalizeNative(changeRows(claude, (rows) => {
    ((rows[0]!.message as { content: { input: { file_path: string } }[] }).content[0]!.input).file_path = "/private/absolute.ts";
  }));
  check("native files: absolute path is never overview metadata", absolute.events.length === 4 && absolute.events[0]!.files.length === 0);
  check("native timing: named record clock differs from observer and Pi message clock", p.events[0]!.at === T + 1000
    && p.events[0]!.occurredAt === T + 1000 && p.events[0]!.observedAt === T + 3000 && p.events[0]!.atClock === "pi-session-jsonl record.timestamp wallclock");
  check("native timing: equal timestamps retain ties without causal rank", c.events.filter((e) => e.at === T + 2000).length === 3
    && c.events.every((e) => !("causalRank" in e)));
  check("native timing: record separation is not runtime, details.executionTime is unused", p.events[0]!.separation?.ms === 1000
    && p.events[1]!.separation?.ms === 800 && p.events.every((e) => e.duration === null));
  const missingClock = await normalizeNative(changeRows(codex, (rows) => { delete rows[1]!.timestamp; }));
  const unclocked = missingClock.events.find((e) => e.kind === "tool.call" && e.refs.call === "exec-1");
  check("native missing clock: observed fallback is named, duration unknown", missingClock.events.length === 4 && unclocked?.occurredAt === null
    && unclocked.atClock === "observer wallclock" && unclocked.separation === null);
  const unclockedReplay = await normalizeNative({ ...changeRows(codex, (rows) => { delete rows[1]!.timestamp; }), observedAt: T + 5000 }, missingClock);
  check("native unclocked replay: chosen observer timestamp stays stable", unclockedReplay.events.length === 4
    && unclockedReplay.added.length === 0 && unclockedReplay.updated.length === 0);
  const poisoned = await normalizeNative(changeRows(codex, (rows) => { (rows[1]!.payload as Record<string, unknown>).call_id = NATIVE_CANARY; }));
  check("native redaction: metadata canary is refused without echoed diagnosis", poisoned.events.length === 3 && !JSON.stringify(poisoned).includes(NATIVE_CANARY)
    && hasGap(poisoned, "invalid-tool-metadata"));
  check("native delivered fixture overview/details contain no canary, raw body or absolute source path", !JSON.stringify(ui).includes(NATIVE_CANARY)
    && !JSON.stringify(ui).includes(CWD) && !JSON.stringify(ui).includes("/private/") && ui.every((f) => f.snapshot.events.length === 4));
  check("native locators: source-controlled hashed generation plus exact byte/block range", x.events.length === 4
    && x.events.every((e) => /^native:[a-f0-9]{64}@\d+\+\d+#\d+$/.test(e.detailRef!.locator) && /^[a-f0-9]{16}$/.test(e.detailRef!.fp!)));
  check("native bytes: exact measured UTF-8 table for five fixtures", equal(ui.map((f) => ({ name: f.name, ...f.measure })), [
    { name: "claude", inputBytes: 1261, metadataBytes: 5528, detailBytes: 643, events: 4 },
    { name: "codex", inputBytes: 973, metadataBytes: 5567, detailBytes: 647, events: 4 },
    { name: "pi", inputBytes: 1411, metadataBytes: 5539, detailBytes: 650, events: 4 },
    { name: "pi-zai", inputBytes: 1411, metadataBytes: 5583, detailBytes: 650, events: 4 },
    { name: "pi-ox", inputBytes: 1411, metadataBytes: 5572, detailBytes: 650, events: 4 },
  ]));
}

if (import.meta.main) {
  let failures = 0, checks = 0;
  await runNativeProbes((name, ok) => { checks++; if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); });
  console.log(JSON.stringify((await loadNativeUiFixtures()).map((f) => ({ name: f.name, ...f.measure }))));
  console.log(failures ? `${failures}/${checks} FAIL` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
}

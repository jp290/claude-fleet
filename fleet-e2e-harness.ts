// e2e for a NON-claude harness in a slot — phase 2 of ./e2e-claude-gate.sh.
//
// Phase 1 (fleet-e2e-claude-gate.ts) proves the agent-liveness gate against a stand-in binary
// literally named `claude`. This phase asks the same questions of a harness that is NOT claude,
// because that is where all three of them used to have no answer at all:
//
//   1. claudeAlive() returned a blind `true` for every non-claude FLEET_CMD, so canDeliver's
//      not-alive gate was a NO-OP for a foreign harness — a pane whose agent had died still
//      accepted scheduled prompts, into a bare shell, where prose EXECUTES as commands.
//   2. MODEL_RE admitted neither `/` nor `:` nor globs, so a foreign model pattern could not be
//      set at all — and widening the shared regex would have let those characters reach a CLAUDE
//      pane line too (phase 1 holds that counter-proof; the two must be read as a pair).
//   3. "the pane lives, the agent is gone" had no name on any surface, for ANY harness. It is what
//      an unresolvable model leaves behind: the harness prints its error, exits, and slotCmd's
//      `; exec $SHELL` catches the pane — pane_dead=0, keystrokes accepted, nothing behind them.
//
// The steady-state stand-in is a compiled binary named `harn` (a shebang script would not do: ps
// reports the interpreter's comm). The boot fixtures use that distinction deliberately: an
// unrecognised script wrapper exists first and only later execs a compiled `harn-*` agent. The
// server is told about the agent ONLY through env: FLEET_CMD=harn, FLEET_HARNESS_COMMS=harn,
// FLEET_HARNESS_MODEL_FLAG=--model. Nothing about any specific harness is compiled into server.ts,
// and this suite is the proof of that: it names a harness that does not exist outside this file.
//
// Run via ./e2e-claude-gate.sh. Do not run directly against a live fleet — e2e/harness.ts refuses
// the live socket and the live port on import, before anything here can act.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { codexModelSupport, type CodexModelSupport } from "./model-register";
import { readCodexFirstTurn, readCodexFirstTurnEvidence, readCodexRollout } from "./server/conversation-read";
import type { Slot } from "./server/types";
import type { SlotInfo } from "./src/client";
import { AUTOS_TICK_MS, ROOT, afterTick, check, failures, get, paneEnv, post, results, tmuxOut } from "./e2e/harness";

export async function checkPaneAgentAtFixtures(source: string, checkFixture: (name: string, ok: boolean, detail: string) => void): Promise<void> {
  const start = source.indexOf("async function paneAgentAt(");
  const end = source.indexOf("\n}\n", start);
  if (start < 0 || end < 0) {
    checkFixture("paneAgentAt fixture precondition: original function is bounded", false, "source function absent");
    return;
  }
  const code = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(start, end + 3));
  type ProbeState = "alive" | "no-agent" | "no-pane" | "unprobed";
  type ProcessFixture = { comm: string; exe?: string; exeError?: "ENOENT" | "EACCES"; code?: number };
  type Fixture = {
    name: string; platform: "linux" | "darwin"; processes: Record<string, ProcessFixture>;
    children?: string[]; panePid?: string; target?: string; comms?: string[];
    want: ProbeState; exePids: string[]; commPids: string[];
  };
  const shell = { comm: "sh", exe: "/bin/sh" };
  const fixtures: Fixture[] = [
    { name: "Linux node-MainThread wrapper above native codex", platform: "linux",
      processes: { "100": shell, "101": { comm: "MainThread", exe: "/test/bin/node" },
        "102": { comm: "codex", exe: "/test/bin/codex" } }, children: ["101"],
      want: "alive", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux node-MainThread as pane process", platform: "linux",
      processes: { "100": { comm: "MainThread", exe: "/test/bin/node" } }, target: "%17",
      want: "alive", exePids: ["100"], commPids: ["100"] },
    { name: "Linux direct codex", platform: "linux",
      processes: { "100": { comm: "codex", exe: "/test/bin/codex" } },
      want: "alive", exePids: ["100"], commPids: ["100"] },
    { name: "Linux renamed native codex child", platform: "linux",
      processes: { "100": shell, "101": { comm: "MainThread", exe: "/test/bin/codex" } }, children: ["101"],
      want: "alive", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux foreign MainThread executable", platform: "linux",
      processes: { "100": shell, "101": { comm: "MainThread", exe: "/test/bin/foreign" } }, children: ["101"],
      want: "no-agent", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux codex grandchild behind foreign MainThread stays out of scope", platform: "linux",
      processes: { "100": shell, "101": { comm: "MainThread", exe: "/test/bin/foreign" },
        "102": { comm: "codex", exe: "/test/bin/codex" } }, children: ["101"],
      want: "no-agent", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux PID vanishes between ps and exe despite matching comm", platform: "linux",
      processes: { "100": shell, "101": { comm: "codex", exeError: "ENOENT" } }, children: ["101"],
      want: "no-agent", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux unreadable MainThread executable", platform: "linux",
      processes: { "100": shell, "101": { comm: "MainThread", exeError: "EACCES" } }, children: ["101"],
      want: "no-agent", exePids: ["100", "101"], commPids: ["100", "101"] },
    { name: "Linux unreadable executable despite matching node comm", platform: "linux",
      processes: { "100": { comm: "node", exeError: "EACCES" } },
      want: "no-agent", exePids: ["100"], commPids: ["100"] },
    { name: "Linux PID gone before ps", platform: "linux", processes: { "100": shell }, children: ["101"],
      want: "no-agent", exePids: ["100"], commPids: ["100", "101"] },
    { name: "Linux failed ps with stale matching output", platform: "linux",
      processes: { "100": { comm: "codex", exe: "/test/bin/codex", code: 1 } },
      want: "no-agent", exePids: [], commPids: ["100"] },
    { name: "macOS node wrapper path", platform: "darwin",
      processes: { "100": { comm: "/bin/zsh" }, "101": { comm: "/test/bin/node" } }, children: ["101"],
      want: "alive", exePids: [], commPids: ["100", "101"] },
    { name: "macOS direct native codex path", platform: "darwin",
      processes: { "100": { comm: "/test/native/bin/codex" } },
      want: "alive", exePids: [], commPids: ["100"] },
    { name: "macOS foreign MainThread", platform: "darwin", processes: { "100": { comm: "MainThread" } },
      want: "no-agent", exePids: [], commPids: ["100"] },
    { name: "absent pane", platform: "linux", processes: {}, panePid: "",
      want: "no-pane", exePids: [], commPids: [] },
    { name: "undeclared harness", platform: "linux", processes: {}, comms: [],
      want: "unprobed", exePids: [], commPids: [] },
  ];
  for (const fixture of fixtures) {
    const commPids: string[] = [];
    const exePids: string[] = [];
    const tmuxCalls: string[][] = [];
    const parentPids: string[] = [];
    const spawn = (argv: string[]) => {
      let out: string;
      let status: number;
      if (argv[0] === "ps" && argv.length === 5 && argv[1] === "-o" && argv[2] === "comm=" && argv[3] === "-p") {
        const pid = argv[4]!;
        commPids.push(pid);
        const proc = fixture.processes[pid];
        out = proc?.comm ?? "";
        status = proc?.code ?? (proc ? 0 : 1);
      } else if (argv[0] === "pgrep" && argv.length === 3 && argv[1] === "-P" && argv[2] === "100") {
        parentPids.push(argv[2]);
        out = (fixture.children ?? []).join("\n");
        status = out ? 0 : 1;
      } else throw new Error("probe issued an unexpected process command");
      return { stdout: new Response(out).body, exited: Promise.resolve(status) };
    };
    const readlink = async (path: string): Promise<string> => {
      const pid = /^\/proc\/(\d+)\/exe$/.exec(path)?.[1];
      if (!pid) throw new Error("probe requested a non-executable path");
      exePids.push(pid);
      const proc = fixture.processes[pid];
      if (!proc?.exe || proc.exeError) throw Object.assign(new Error("executable measurement failed"), { code: proc?.exeError ?? "ENOENT" });
      return proc.exe;
    };
    const tmux = async (...args: string[]) => {
      tmuxCalls.push(args);
      return { out: fixture.panePid ?? "100", code: 0 };
    };
    try {
      const probe = new Function("Bun", "process", "readlink", "basename", "tmux", "paneTarget", "Response",
        code + "\nreturn paneAgentAt;")({ spawn }, { platform: fixture.platform }, readlink, basename, tmux,
          (target: string) => `=${target}:`, Response) as (target: string, comms: string[]) => Promise<ProbeState>;
      const got = await probe(fixture.target ?? "s1", fixture.comms ?? ["codex", "node"]);
      checkFixture(`paneAgentAt: ${fixture.name}`, got === fixture.want, `expected=${fixture.want} actual=${got}`);
      const expectedTmux = fixture.comms?.length === 0 ? []
        : [["display-message", "-p", "-t", fixture.target ?? "=s1:", "#{pane_pid}"]];
      checkFixture(`paneAgentAt scope: ${fixture.name}`,
        JSON.stringify(commPids) === JSON.stringify(fixture.commPids)
        && JSON.stringify(exePids) === JSON.stringify(fixture.exePids)
        && JSON.stringify(tmuxCalls) === JSON.stringify(expectedTmux) && parentPids.length <= 1,
        `commPids=${commPids} exePids=${exePids} parentPids=${parentPids}`);
    } catch (error) {
      checkFixture(`paneAgentAt fixture execution: ${fixture.name}`, false, error instanceof Error ? error.message : "unknown error");
    }
  }
}

await checkPaneAgentAtFixtures(readFileSync(`${ROOT}/server.ts`, "utf8"), check);

export async function checkCodexFirstTurnFixtures(source: string, client: string,
  checkFixture: (name: string, ok: boolean, detail: string) => void): Promise<void> {
  // Synthetic timeline (ms relative to epoch):
  // t | event                         | exclusive owner
  // 1 | historical success            | predecessor
  // 20| open A / B                    | A / B
  // 21| task_started                  | A / B
  // 22| commentary, still alive       | A / B
  // 23| model-400 / terminal success  | A / B
  // 30| recycle A                     | replacement C
  const epoch = 1_790_000_000_000;
  const event = (t: number, payload: Record<string, unknown>) => JSON.stringify({
    type: "event_msg", timestamp: new Date(epoch + t).toISOString(), payload });
  const start = (t: number, id: string) => event(t, { type: "task_started", turn_id: id });
  const success = (t: number, id: string) => event(t, { type: "task_complete", turn_id: id, last_agent_message: "done" });
  const failure = event(23, { type: "task_complete", turn_id: "A", last_agent_message: null,
    error: { message: "HTTP 400: model fixture unsupported", codex_error_info: "bad_request" } });
  const files = new Map<string, Buffer>();
  const identities = new Map<string, { dev: number; ino: number }>();
  const reads: string[] = [];
  const put = (id: string, lines: string[]) => files.set(`/fixture/${id}`, Buffer.from(lines.join("\n") + "\n"));
  const section = (text: string, from: string, to: string) => {
    const a = text.indexOf(from), b = text.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error(`missing original ${from}`);
    return new Bun.Transpiler({ loader: "ts" }).transformSync(text.slice(a, b));
  };
  try {
    const scanner = section(source, "const codexFirstTurnCursors =", "async function tickGit()");
    const makeScanner = () => new Function("harnessOf", "codexContextFile", "openSync", "fstatSync", "Buffer",
      "readSync", "closeSync", "readCodexFirstTurnEvidence", "exportRedactor", scanner + "\nreturn {tickCodexFirstTurn,codexFirstTurnView};")(
        (id: string) => ({ id }), ({ sessionId }: { sessionId: string }) => files.has(`/fixture/${sessionId}`) ? `/fixture/${sessionId}` : null,
        (file: string) => { reads.push(file); return file; },
        (file: string) => ({ size: files.get(file)!.length, ...(identities.get(file) ?? { dev: 1, ino: 1 }) }), Buffer,
        (file: string, buffer: Buffer, offset: number, length: number, position: number) => files.get(file)!.copy(buffer, offset, position, position + length),
        () => {}, readCodexFirstTurnEvidence, () => ({ clean: (s: string) => s.replace("fixture-secret", "[redacted]") })) as {
          tickCodexFirstTurn: (s: Slot) => void; codexFirstTurnView: (s: Slot) => Slot["codexFirstTurn"] };
    const scan = makeScanner();
    const a = { id: 17, cwd: "/repo", harness: "codex", openedAt: epoch + 20, selfToken: "token-A", sessionId: "session-A" } as Slot;
    const b = { ...a, id: 18, selfToken: "token-B", sessionId: "session-B" } as Slot;
    put("foreign", [start(21, "foreign"), success(23, "foreign")]);
    put("session-A", [start(0, "old"), success(1, "old"), start(21, "A")]);
    scan.tickCodexFirstTurn(a);
    checkFixture("first model turn: accepted is running, not successful", a.codexFirstTurn?.turn.state === "running"
      && a.codexFirstTurn.turn.acceptedAt === epoch + 21, JSON.stringify(a.codexFirstTurn));
    const commentary = JSON.stringify({ type: "response_item", timestamp: new Date(epoch + 22).toISOString(),
      payload: { type: "message", role: "assistant", phase: "commentary", content: [{ text: "HTTP 400 in quoted user data" }] } });
    put("session-A", [start(0, "old"), success(1, "old"), start(21, "A"), commentary]);
    scan.tickCodexFirstTurn(a);
    checkFixture("first model turn: commentary and a quoted error prove neither failure nor success",
      a.codexFirstTurn?.turn.state === "running", JSON.stringify(a.codexFirstTurn));
    put("session-A", [start(0, "old"), success(1, "old"), start(21, "A"), commentary, failure, start(24, "later"), success(25, "later")]);
    scan.tickCodexFirstTurn(a);
    const observed = scan.codexFirstTurnView(a);
    checkFixture("first model turn: model-400 has source, event time and observer time on A",
      observed?.source === "codex-rollout" && observed.openedAt === epoch + 20 && observed.sessionId === "session-A"
      && observed.observedAt >= epoch && observed.turn.state === "failed" && observed.turn.completedAt === epoch + 23
      && observed.turn.error?.code === "bad_request" && observed.turn.error.message === "HTTP 400: model fixture unsupported",
      JSON.stringify(observed));
    const rd = section(source, "async function paneReadiness(", "\n// Fresh founding prompts");
    const ready = new Function("harnessOf", "tmux", "paneTarget", "sess", rd + "\nreturn paneReadiness;")(
      () => ({ readiness: { accept: />_ OpenAI Codex \(v/, blocks: [] } }),
      async () => ({ code: 0, out: ">_ OpenAI Codex (v0.160.0)\nHTTP 400: model fixture unsupported\n›" }),
      (s: string) => s, (id: number) => `s${id}`) as (s: Slot) => Promise<{ state: string }>;
    checkFixture("first model turn: a living ready TUI retains readiness, failure is separate",
      (await ready(a)).state === "ready" && observed?.turn.state === "failed", JSON.stringify(observed));
    put("session-B", [start(21, "B"), success(23, "B")]);
    scan.tickCodexFirstTurn(b);
    checkFixture("first model turn: successful B cannot overwrite failed A", b.codexFirstTurn?.turn.state === "succeeded"
      && a.codexFirstTurn?.turn.state === "failed" && !reads.includes("/fixture/foreign"), JSON.stringify(b.codexFirstTurn));
    const ui = section(client, "function codexTurnOf(", "\n// THE FIFTH READING:");
    type TurnSlot = Pick<SlotInfo, "agent" | "openedAt" | "lastOutput" | "codexRecovery" | "codexFirstTurn">;
    const display = new Function("RECENT_MS", "SLEEP_MS", ui + "\nreturn {outputState,codexTurnLine};")(5000, 1_800_000) as {
      outputState: (s: TurnSlot, now: number, awake: boolean) => string; codexTurnLine: (s: TurnSlot) => string };
    const uiA = { ...a, agent: "alive" as const, lastOutput: epoch + 23,
      codexRecovery: { state: "bound" as const, sessionId: a.sessionId, disconnectSeenAt: null } };
    checkFixture("first model turn: client shows alive model-400 as broken with provenance",
      display.outputState(uiA, epoch + 24, true) === "bad" && display.codexTurnLine(uiA).includes("bad_request")
      && display.codexTurnLine(uiA).includes("Quelle: codex-rollout"), display.codexTurnLine(uiA));
    checkFixture("first model turn: sessions wire projects the occupant-bound observation",
      source.includes("}, codexFirstTurn: codexFirstTurnView(s) } : {})"), "GET /api/sessions source projection");
    a.openedAt = epoch + 30; a.selfToken = "token-C";
    checkFixture("first model turn: recycled occupation hides A before the next tick",
      scan.codexFirstTurnView(a) === null
      && display.outputState({ ...uiA, openedAt: a.openedAt }, epoch + 31, true) === "work", "same slot and rollout, new openedAt");
    scan.tickCodexFirstTurn(a);
    checkFixture("first model turn: recycled C does not inherit old success or failure", a.codexFirstTurn === null, JSON.stringify(a.codexFirstTurn));
    put("session-A", [start(0, "old"), success(1, "old"), start(21, "A"), commentary, failure, start(24, "later"), success(25, "later"), start(31, "C"), success(32, "C")]);
    scan.tickCodexFirstTurn(a);
    checkFixture("first model turn: recycled C can prove its own successful turn", scan.codexFirstTurnView(a)?.turn.turnId === "C"
      && a.codexFirstTurn?.turn.state === "succeeded", JSON.stringify(a.codexFirstTurn));
    const reboot = makeScanner(); reboot.tickCodexFirstTurn(b);
    checkFixture("first model turn: restart re-reads exact B instead of persisting a cached claim",
      reboot.codexFirstTurnView(b)?.turn.state === "succeeded" && b.codexFirstTurn?.sessionId === "session-B", JSON.stringify(b.codexFirstTurn));
    const replaced = { ...b, id: 42, selfToken: "replaced", sessionId: "replaced", codexFirstTurn: null } as Slot;
    put("replaced", [start(21, "original"), success(23, "original")]); scan.tickCodexFirstTurn(replaced);
    checkFixture("first model turn: file replacement probe begins with a proved success",
      replaced.codexFirstTurn?.turn.state === "succeeded" && replaced.codexFirstTurn.turn.turnId === "original", JSON.stringify(replaced.codexFirstTurn));
    const originalSize = files.get("/fixture/replaced")!.length;
    put("replaced", [start(21, "replacement"), JSON.stringify({ type: "padding", payload: { text: "x".repeat(500) } })]);
    identities.set("/fixture/replaced", { dev: 1, ino: 2 }); scan.tickCodexFirstTurn(replaced);
    checkFixture("first model turn: a new inode at the same path cannot retain old success",
      files.get("/fixture/replaced")!.length >= originalSize && replaced.codexFirstTurn?.turn.state === "running"
      && replaced.codexFirstTurn.turn.turnId === "replacement", JSON.stringify(replaced.codexFirstTurn));
    put("replaced", [start(21, "other-device"), success(23, "other-device"), JSON.stringify({ type: "padding", payload: { text: "x".repeat(600) } })]);
    identities.set("/fixture/replaced", { dev: 2, ino: 2 }); scan.tickCodexFirstTurn(replaced);
    checkFixture("first model turn: a new device resets the cursor even with the same inode",
      replaced.codexFirstTurn?.turn.state === "succeeded" && replaced.codexFirstTurn.turn.turnId === "other-device", JSON.stringify(replaced.codexFirstTurn));
    for (const terminal of ["task_complete", "turn_complete"] as const) {
      const oldStart = event(1, { type: terminal === "task_complete" ? "task_started" : "turn_started", turn_id: "predecessor" });
      const oldFailure = event(21, { type: terminal, turn_id: "predecessor",
        error: { message: "predecessor model failed", codex_error_info: "bad_request" } });
      const turn = readCodexFirstTurn([oldStart, oldFailure], epoch + 20);
      checkFixture(`first model turn: ${terminal} failure whose start precedes openedAt is excluded`, turn === null, JSON.stringify(turn));
      const lane = { ...b, id: 44, selfToken: terminal, sessionId: `predecessor-${terminal}`, codexFirstTurn: null } as Slot;
      put(lane.sessionId!, [oldStart]); scan.tickCodexFirstTurn(lane);
      put(lane.sessionId!, [oldStart, oldFailure]); scan.tickCodexFirstTurn(lane);
      checkFixture(`first model turn: ${terminal} predecessor identity survives a tick boundary`,
        scan.codexFirstTurnView(lane) === null && lane.codexFirstTurn === null, JSON.stringify(lane.codexFirstTurn));
      put(lane.sessionId!, [oldStart, oldFailure, start(24, "current"), success(25, "current")]); scan.tickCodexFirstTurn(lane);
      checkFixture(`first model turn: ${terminal} predecessor failure cannot block the current occupant's own success`,
        lane.codexFirstTurn?.turn.state === "succeeded" && lane.codexFirstTurn.turn.turnId === "current", JSON.stringify(lane.codexFirstTurn));
    }
    const historicalReset = { ...b, id: 45, selfToken: "historical-reset", sessionId: "historical-reset", codexFirstTurn: null } as Slot;
    put("historical-reset", [start(1, "reused-id")]); scan.tickCodexFirstTurn(historicalReset);
    put("historical-reset", [start(21, "reused-id"), success(23, "reused-id")]);
    identities.set("/fixture/historical-reset", { dev: 1, ino: 2 }); scan.tickCodexFirstTurn(historicalReset);
    checkFixture("first model turn: file replacement clears remembered predecessor IDs",
      historicalReset.codexFirstTurn?.turn.state === "succeeded" && historicalReset.codexFirstTurn.turn.turnId === "reused-id",
      JSON.stringify(historicalReset.codexFirstTurn));
    for (const [name, lines] of [
      ["no-start", [success(23, "B")]], ["torn-terminal", [start(21, "B"), success(23, "B").slice(0, -1)]],
      ["wrong-turn", [start(21, "B"), success(23, "other")]],
      ["no-model-output", [start(21, "B"), event(23, { type: "task_complete", turn_id: "B", last_agent_message: null })]],
      ["no-time", [JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "B" } }), success(23, "B")]],
    ] as const) {
      const turn = readCodexFirstTurn([...lines], epoch + 20);
      checkFixture(`first model turn unknown: ${name}`, !turn || turn.state === "running" || turn.state === "unknown", JSON.stringify(turn));
    }
    const parsed = readCodexRollout([start(21, "A"), failure]);
    checkFixture("first model turn: conversation reader retains structured terminal error", parsed.firstTurn?.state === "failed"
      && parsed.firstTurn.error?.code === "bad_request", JSON.stringify(parsed.firstTurn));
    const user = JSON.stringify({ type: "response_item", timestamp: new Date(epoch + 21).toISOString(),
      payload: { type: "message", role: "user", content: [{ text: "first request whose start is missing" }] } });
    for (const [name, gap, reason] of [
      ["user-input", user, "user-before-start"],
      ["user-event", event(21, { type: "user_message", message: "first request" }), "user-before-start"],
      ["unreadable-row", "{broken JSON", "unreadable-row"],
      ["orphan-event", event(21, { type: "task_complete", turn_id: "missing-first" }), "turn-before-start"],
      ["timeless-start", JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "missing-first" } }), "event-without-time"],
      ["invalid-time", JSON.stringify({ type: "event_msg", timestamp: "not-a-time", payload: { type: "task_started", turn_id: "missing-first" } }), "event-without-time"],
      ["timeless-user", JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ text: "first request" }] } }), "user-before-start"],
    ] as const) {
      const lines = [gap, start(24, "later"), success(25, "later")];
      const turn = readCodexFirstTurn(lines, epoch + 20);
      checkFixture(`first model turn: ${name} before a later start forbids success`, turn?.state === "unknown"
        && turn.unknownReason === reason, JSON.stringify(turn));
      const lane = { ...b, id: 40, selfToken: name, sessionId: `gap-${name}`, codexFirstTurn: null } as Slot;
      put(lane.sessionId!, [gap]); scan.tickCodexFirstTurn(lane);
      put(lane.sessionId!, lines); scan.tickCodexFirstTurn(lane);
      checkFixture(`first model turn: ${name} gap survives a tick without a start`, lane.codexFirstTurn?.turn.state === "unknown"
        && lane.codexFirstTurn.turn.unknownReason === reason, JSON.stringify(lane.codexFirstTurn));
    }
    const noGap = readCodexFirstTurn([user.replace(new Date(epoch + 21).toISOString(), new Date(epoch + 1).toISOString()),
      start(21, "A"), failure, user, start(24, "later"), success(25, "later")], epoch + 20);
    checkFixture("first model turn: known first failure remains failed despite later input and success",
      noGap?.state === "failed" && noGap.turnId === "A" && noGap.error?.code === "bad_request", JSON.stringify(noGap));
    const timelessAfterStart = readCodexFirstTurn([start(21, "A"),
      JSON.stringify({ type: "event_msg", payload: { type: "task_started", turn_id: "other" } }), success(23, "A")], epoch + 20);
    checkFixture("first model turn: a timeless event after the observed start remains ignored",
      timelessAfterStart?.state === "succeeded" && timelessAfterStart.turnId === "A" && !timelessAfterStart.unknownReason,
      JSON.stringify(timelessAfterStart));
    for (const terminal of ["task_complete", "turn_complete"] as const) {
      const orphanFailure = event(23, { type: terminal, turn_id: "orphan", last_agent_message: null,
        error: { message: "HTTP 400: model fixture unsupported", codex_error_info: "bad_request" } });
      const turn = readCodexFirstTurn([orphanFailure, start(24, "later"), success(25, "later")], epoch + 20);
      checkFixture(`first model turn: ${terminal} error without start is failed with unobserved acceptance`,
        turn?.state === "failed" && turn.acceptedAt === null && turn.completedAt === epoch + 23
        && turn.turnId === "orphan" && turn.error?.code === "bad_request", JSON.stringify(turn));
      const lane = { ...b, id: 41, selfToken: terminal, sessionId: `orphan-${terminal}`, codexFirstTurn: null } as Slot;
      put(lane.sessionId!, [orphanFailure]); scan.tickCodexFirstTurn(lane);
      const hit = scan.codexFirstTurnView(lane);
      checkFixture(`first model turn: ${terminal} orphan error has source and event time at its own slot`,
        hit?.source === "codex-rollout" && hit.sessionId === lane.sessionId && hit.openedAt === lane.openedAt
        && hit.turn.state === "failed" && hit.turn.acceptedAt === null && hit.turn.completedAt === epoch + 23,
        JSON.stringify(hit));
      const uiOrphan = { ...uiA, codexFirstTurn: lane.codexFirstTurn,
        codexRecovery: { ...uiA.codexRecovery, sessionId: lane.sessionId } };
      checkFixture(`first model turn: ${terminal} orphan error remains visible despite alive`,
        display.outputState(uiOrphan, epoch + 24, true) === "bad" && display.codexTurnLine(uiOrphan).includes("bad_request")
        && display.codexTurnLine(uiOrphan).includes("Quelle: codex-rollout"), display.codexTurnLine(uiOrphan));
    }
    const orphanSuccess = readCodexFirstTurn([success(23, "orphan"), start(24, "later"), success(25, "later")], epoch + 20);
    checkFixture("first model turn: success without start cannot become a later first success",
      orphanSuccess?.state === "unknown" && orphanSuccess.unknownReason === "turn-before-start", JSON.stringify(orphanSuccess));
    const long = { ...b, id: 19, selfToken: "token-long", sessionId: "session-long", codexFirstTurn: null } as Slot;
    const oversized = JSON.stringify({ type: "response_item", payload: {
      type: "message", role: "user", content: [{ text: "x".repeat(2_097_152) + success(22, "A") }] } });
    put("session-long", [start(21, "A"), oversized, failure]);
    for (let tick = 0; tick < 3; tick++) scan.tickCodexFirstTurn(long);
    checkFixture("first model turn: oversized row itself stays unknown, never a guessed success",
      long.codexFirstTurn?.turn.state === "unknown" && long.codexFirstTurn.turn.unknownReason === "oversized-row-skipped",
      JSON.stringify(long.codexFirstTurn));
    for (let tick = 0; tick < 3; tick++) scan.tickCodexFirstTurn(long);
    checkFixture("first model turn: model-400 after a >1-MiB row is still detected",
      scan.codexFirstTurnView(long)?.turn.state === "unknown" && long.codexFirstTurn?.turn.error?.code === "bad_request",
      JSON.stringify(long.codexFirstTurn));
    const longSuccess = { ...long, id: 21, selfToken: "token-long-success", sessionId: "session-long-success", codexFirstTurn: null } as Slot;
    put("session-long-success", [start(21, "A"), oversized, success(23, "A")]);
    for (let tick = 0; tick < 6; tick++) scan.tickCodexFirstTurn(longSuccess);
    checkFixture("first model turn: success after a skipped row stays permanently unknown",
      longSuccess.codexFirstTurn?.turn.state === "unknown"
      && longSuccess.codexFirstTurn.turn.unknownReason === "oversized-row-skipped" && longSuccess.codexFirstTurn.turn.error === null,
      JSON.stringify(longSuccess.codexFirstTurn));
    const swappedGap = { ...longSuccess, id: 43, selfToken: "swapped-gap", sessionId: "swapped-gap", codexFirstTurn: null } as Slot;
    put("swapped-gap", [start(21, "A"), oversized, success(23, "A")]);
    for (let tick = 0; tick < 6; tick++) scan.tickCodexFirstTurn(swappedGap);
    const gapSize = files.get("/fixture/swapped-gap")!.length;
    put("swapped-gap", [start(21, "clean-replacement"), success(23, "clean-replacement"),
      JSON.stringify({ type: "padding", payload: { text: "x".repeat(2_100_000) } })]);
    identities.set("/fixture/swapped-gap", { dev: 1, ino: 2 }); scan.tickCodexFirstTurn(swappedGap);
    checkFixture("first model turn: file replacement clears the gap as well as the completed turn and offset",
      files.get("/fixture/swapped-gap")!.length >= gapSize && swappedGap.codexFirstTurn?.turn.state === "succeeded"
      && swappedGap.codexFirstTurn.turn.turnId === "clean-replacement" && !swappedGap.codexFirstTurn.turn.unknownReason,
      JSON.stringify(swappedGap.codexFirstTurn));
    const skippedBeforeStart = { ...longSuccess, id: 22, selfToken: "skip-before-start", sessionId: "skip-before-start", codexFirstTurn: null } as Slot;
    put(skippedBeforeStart.sessionId!, [oversized, start(24, "later"), success(25, "later")]);
    for (let tick = 0; tick < 6; tick++) scan.tickCodexFirstTurn(skippedBeforeStart);
    checkFixture("first model turn: skipped row before any observed start forbids later success",
      skippedBeforeStart.codexFirstTurn?.turn.state === "unknown"
      && skippedBeforeStart.codexFirstTurn.turn.unknownReason === "oversized-row-skipped", JSON.stringify(skippedBeforeStart.codexFirstTurn));
    put("session-long-success", [start(21, "replacement-file"), success(23, "replacement-file")]);
    scan.tickCodexFirstTurn(longSuccess);
    checkFixture("first model turn: truncation resets the gap as well as offset and turn",
      longSuccess.codexFirstTurn?.turn.state === "succeeded" && longSuccess.codexFirstTurn.turn.turnId === "replacement-file"
      && !longSuccess.codexFirstTurn.turn.unknownReason, JSON.stringify(longSuccess.codexFirstTurn));
    const uiLong = { ...uiA, openedAt: long.openedAt, codexFirstTurn: long.codexFirstTurn,
      codexRecovery: { ...uiA.codexRecovery, sessionId: long.sessionId } };
    checkFixture("first model turn: client shows observed failure despite unknown outcome after skip",
      display.outputState(uiLong, epoch + 24, true) === "bad" && display.codexTurnLine(uiLong).includes("oversized-row-skipped")
      && display.codexTurnLine(uiLong).includes("bad_request"), display.codexTurnLine(uiLong));
    const torn = { ...long, id: 20, selfToken: "token-torn", sessionId: "session-torn", codexFirstTurn: null } as Slot;
    files.set("/fixture/session-torn", Buffer.from(start(21, "A").slice(0, -2)));
    scan.tickCodexFirstTurn(torn); scan.tickCodexFirstTurn(torn);
    checkFixture("first model turn: a non-full torn row remains unknown", torn.codexFirstTurn === null, JSON.stringify(torn.codexFirstTurn));
    put("session-torn", [start(21, "A"), failure]); scan.tickCodexFirstTurn(torn);
    checkFixture("first model turn: a non-full torn row is retried after append",
      scan.codexFirstTurnView(torn)?.turn.state === "failed", JSON.stringify(torn.codexFirstTurn));
    a.sessionId = "missing";
    scan.tickCodexFirstTurn(a);
    checkFixture("first model turn: rebind to an absent exact rollout is unknown", scan.codexFirstTurnView(a) === null, "no newest-file fallback");
    const recovery = section(source, "async function tickCodexRecovery(", "\n// nudge or a bare-shell dispatch");
    for (const seam of ["capture", "candidates"] as const) {
      const lane = { ...b, sessionId: null, codexRecoveryState: "pending", codexPaneSpawnedAt: epoch + 20,
        codexDisconnectSeenAt: null, codexFirstTurn: null } as Slot;
      let writes = 0;
      const replace = () => { lane.openedAt = epoch + 40; lane.selfToken = "replacement"; lane.codexDisconnectSeenAt = null; };
      const tick = new Function("harnessOf", "tmux", "paneTarget", "sess", "slotTeardownInflight", "codexCandidates",
        "CODEX_BIND_SLACK_MS", "noteSessionIdLearned", "audit", "backfillProgramMainSessionId", "saveState",
        recovery + "\nreturn tickCodexRecovery;")(
          () => ({ id: "codex" }), async () => { if (seam === "capture") replace(); return { code: 0, out: "stream disconnected before completion" }; },
          (s: string) => s, (id: number) => `s${id}`, new Map(), async () => { replace(); return [{ id: "old-candidate" }]; }, 0,
          () => writes++, () => writes++, () => writes++, () => writes++) as (s: Slot) => Promise<void>;
      await tick(lane);
      checkFixture(`first model turn recycle fence: recovery ${seam} await`, lane.sessionId === null
        && lane.codexDisconnectSeenAt === null && lane.codexFirstTurn === null && writes === 0, `writes=${writes}`);
    }
  } catch (error) {
    checkFixture("first model turn fixture execution", false, error instanceof Error ? error.message : "unknown error");
  }
}
try {
  await checkCodexFirstTurnFixtures(readFileSync(`${ROOT}/server.ts`, "utf8"), readFileSync(`${ROOT}/src/client.ts`, "utf8"), check);
} catch (error) {
  check("first model turn fixture source precondition", false, error instanceof Error ? error.message : "unknown source error");
}

export async function checkCodexSpawnFixtures(source: string,
  checkFixture: (name: string, ok: boolean, detail: string) => void): Promise<void> {
  const start = source.indexOf("async function openSlot(");
  const end = source.indexOf("\n}\n", start);
  if (start < 0 || end < 0) {
    checkFixture("Codex spawn fixture precondition", false, "original openSlot absent");
    return;
  }
  const code = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(start, end + 3));
  const sameAt = source.indexOf("const sameSlotStreamOccupant =");
  const sameCode = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(sameAt, source.indexOf(";\n", sameAt) + 2));
  const now = 1_000_000;
  const cli = { binary: "fixture-binary", version: "0.153.4", observedAt: now, reason: null };
  const cache = { fetched_at: new Date(now - 10).toISOString(), client_version: cli.version,
    models: [{ slug: "fixture-present" }] };
  const available = codexModelSupport(cache, "fixture-present", cli, true, now, "/new");
  const unavailable = codexModelSupport(cache, "fixture-absent", cli, true, now, "/new");
  const unknown = codexModelSupport(cache, "fixture-absent", cli, false, now, "/new");
  type FixtureOpenResult = { superseded: boolean; modelSupport: CodexModelSupport | null;
    occupant: { cwd: string | null; openedAt: number; selfToken: string } };
  type FixtureCandidate = { slot: number; openedAt: number; selfToken: string };
  const openEvidence = (result: FixtureOpenResult | CodexModelSupport | null): CodexModelSupport | null =>
    result && "modelSupport" in result ? result.modelSupport : result;
  type Fixture = { name: string; support: CodexModelSupport; race?: string; throwAt?: string; replaceOnLost?: boolean; sameCandidateTime?: boolean;
    lane?: boolean; programClosure?: boolean; postOpenRace?: boolean; joined?: boolean; empty?: boolean; founding?: boolean; succession?: boolean; mismatch?: "model" | "cwd" };
  const fixtures: Fixture[] = [
    { name: "available", support: available },
    { name: "unavailable", support: unavailable },
    { name: "unknown-provider", support: unknown },
    { name: "unknown-version", support: codexModelSupport({ ...cache, client_version: "0.1.0" }, "fixture-absent", cli, true, now) },
    { name: "unknown-expired", support: codexModelSupport(cache, "fixture-absent", cli, true, now + 300_001) },
    { name: "joined-own-teardown", support: available, joined: true },
    { name: "succession-flips-after-kill", support: available, succession: true },
    { name: "program-succession-flips-after-kill", support: available, succession: true, programClosure: true },
    { name: "succession-replaced-during-open", support: available, succession: true, race: "ensure" },
    { name: "succession-replaced-after-open-result", support: available, succession: true, postOpenRace: true },
    { name: "succession-open-fails-foreign", support: available, succession: true, race: "history", throwAt: "history" },
    { name: "succession-open-fails-same-time-foreign", support: available, succession: true, race: "history", throwAt: "history", sameCandidateTime: true },
    { name: "succession-open-fails-unproven", support: available, succession: true, race: "observe", throwAt: "observe" },
    { name: "succession-open-fails-owned", support: available, succession: true, throwAt: "history" },
    { name: "succession-open-fails-then-foreign-on-lost", support: available, succession: true, throwAt: "history", replaceOnLost: true },
    { name: "lane-open-superseded", support: available, lane: true, race: "ensure" },
    { name: "preobserved-model-mismatch", support: available, mismatch: "model" },
    { name: "preobserved-cwd-mismatch", support: available, mismatch: "cwd" },
    ...["teardown", "spawn", "support", "kill", "observe", "latch", "history", "persist", "ensure"].map((race): Fixture =>
      ({ name: `replaced-at-${race}`, support: available, race, empty: race === "observe", founding: race === "persist" })),
  ];
  for (const fixture of fixtures) {
    let foreignInstalled = false;
    const writesAfterReplacement: string[] = [];
    const slot: Record<string, unknown> = new Proxy({ id: 17, cwd: fixture.empty ? null : "/old", openedAt: fixture.empty ? 0 : 10,
      selfToken: "old-fixture-token", clients: new Set(), history: [] }, {
      set: (target, key, value) => {
        if (foreignInstalled) writesAfterReplacement.push(String(key));
        return Reflect.set(target, key, value);
      },
    });
    const effects: string[] = [];
    let effectsAtReplacement = 0;
    let supportCalls = 0;
    let killed = false;
    const oldToken = slot.selfToken;
    const foreign = { cwd: "/foreign", openedAt: 999, selfToken: "foreign-fixture-token", label: "foreign-fixture-label" };
    const barrier = async (name: string): Promise<void> => {
      if (fixture.race === name) {
        Object.assign(slot, foreign);
        foreignInstalled = true;
        effectsAtReplacement = effects.length;
      }
      if (fixture.throwAt === name) throw new Error("fixture open failed");
    };
    const maps = ["mergeVerdict", "laneReviewParked", "mergeInflight", "mergeStart", "aliveInfo", "paneModelInfo",
      "gitOpInfo", "laneHunkInfo", "gitInfo", "repoInfo", "inboxNudgeTried", "postfachAttempted", "postfachQueued",
      "harvest", "startCache", "mergeParked", "mergeLast"];
    const scope: Record<string, unknown> = Object.fromEntries(maps.map((name) => [name, new Map()]));
    const lease = fixture.founding ? { founding: { target: { openedAt: 20, selfTokenHash: "hash" } } } : null;
    class Refusal extends Error { constructor(readonly modelSupport: CodexModelSupport) { super("catalog-excluded"); } }
    Object.assign(scope, {
      resolve: (p: string) => p, expandCwd: (p: string) => p, existsSync: () => true,
      statSync: () => ({ isDirectory: () => true }),
      slotTeardownInflight: new Map(fixture.joined ? [[17, { occupant: { slot: 17, openedAt: 10, selfToken: oldToken } }]] : []),
      slotSpawnInflight: new Map(), laneSpawn: new Set([17]),
      waitForSlotTeardown: async () => { if (fixture.joined) Object.assign(slot, { cwd: null, openedAt: 0 }); await barrier("teardown"); },
      waitForSlotSpawn: () => barrier("spawn"), assertProgramFoundingTargetOpen: () => {},
      repoCanon: (p: string) => p, assertGameMakerTreeOpen: () => {}, openSlotIntents: new Set(),
      harnessOf: () => ({ id: "codex", allowsLanes: true, singleton: false }),
      permissionsOf: () => ({ ok: true, permissions: { sandbox: "danger-full-access", approval: "never" } }),
      slotOpeningGuard: (target: Record<string, unknown>) => {
        const expected = JSON.stringify([target.cwd, target.openedAt, target.selfToken, target.permissions]);
        return () => { if (JSON.stringify([target.cwd, target.openedAt, target.selfToken, target.permissions]) !== expected) throw new Error("slot occupant changed before opening"); };
      },
      slotSpawnOccupant: (target: Record<string, unknown>) => ({ ...target, permissions: { ...(target.permissions as Record<string, unknown>) } }),
      sameSlotSpawnOccupant: (target: Record<string, unknown>, expected: Record<string, unknown>) => target.cwd === expected.cwd
        && target.openedAt === expected.openedAt && target.selfToken === expected.selfToken
        && JSON.stringify(target.permissions) === JSON.stringify(expected.permissions),
      modelOf: () => ({ ok: true }), modelsForHarness: () => [], codexSpawnSupport: async () => {
        supportCalls++;
        await barrier("support");
        return fixture.succession && killed ? unavailable : fixture.support;
      },
      CodexModelUnavailable: Refusal, SEPARATE_LANE_SLOTS: false, slots: [],
      detachSlotTasks: () => effects.push("detach"), shares: [{ slot: 17, id: "fixture-share" }], closeShareClients: () => effects.push("share"),
      slotStreamOccupant: () => slot.cwd ? { openedAt: slot.openedAt, selfToken: slot.selfToken } : null,
      killSlot: async () => { effects.push("kill"); killed = true; Object.assign(slot, { cwd: null, openedAt: 0 }); await barrier("kill"); },
      observeTmuxSlots: async () => { await barrier("observe"); return {}; },
      tmuxSlotObservation: () => ({ presence: "absent" }), waitForGameMakerOpenTestLatch: () => barrier("latch"),
      hashSelfToken: () => "hash", randomBytes: () => ({ toString: () => "new-fixture-token" }),
      autos: [], dropWatchesFor: () => {}, reapLaneSuiteOffersFor: () => {},
      rm: () => barrier("history"), historyPath: () => "/fixture-history", recents: [], MAX_RECENTS: 10,
      parkMergeVerdict: () => {}, audit: () => { effects.push("audit"); }, saveState: () => { effects.push("save"); },
      saveStateNow: async () => { effects.push("persist"); await barrier("persist"); },
      ensureSlot: async () => { effects.push("ensure"); await barrier("ensure"); },
      NO_BOX: { container: null, containerContext: null }, singletonSpawn: new Set(), merkeStart: async () => {}, STATE_DIR: "/fixture-state",
      REAL_SEAT_GATE: null,
      slotOpenHold: new Map(), fassungTestHaken: {}, halteStart: async () => null, vergissFassung: () => {}, FassungBewegt: class extends Error {},
    });
    try {
      const open = new Function("scope", `with (scope) { ${code}; return openSlot; }`)(scope) as
        (s: Record<string, unknown>, cwd: string, ...args: unknown[]) => Promise<FixtureOpenResult | CodexModelSupport | null>;
      if (fixture.lane) {
        const at = source.indexOf("async function openLaneInSlot(");
        const laneCode = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(at, source.indexOf("\n}\n", at) + 3));
        Object.assign(scope, {
          openSlot: open, repoRootOf: async () => "/repo", decideLaneAnchor: async () => null,
          createWorktree: async () => ({ repo: "/repo", branch: "fleet/fixture", path: "/new" }),
          integrationBranch: async () => "main", laneForkSha: async () => "fixture-base",
          reserveLaneLetter: () => ({ band: 0, letter: "A" }), releaseLaneLetter: () => { effects.push("release"); },
          syncLaneRefs: async () => {}, basename: () => "fixture-repo", MAX_LABEL: 40,
          tickGit: async () => { effects.push("git"); },
          json: (value: unknown, status: number) => new Response(JSON.stringify(value), { status }),
          GameMakerTreeConflict: class extends Error {},
        });
        const laneOpen = new Function("scope", `with (scope) { ${laneCode}; return openLaneInSlot; }`)(scope) as
          (s: unknown, repo: string, branch: string, model: string, harness: string) => Promise<unknown>;
        const responseAt = source.indexOf('return json({ error: e instanceof Error ? e.message : "lane failed"');
        const catchAt = source.lastIndexOf("} catch (e) {", responseAt);
        const catchCode = source.slice(catchAt, source.indexOf("} finally {", responseAt)) + "}";
        const callerCode = new Bun.Transpiler({ loader: "ts" }).transformSync(`async function respond() {
          try { await act(); return json({ok:true},200); ${catchCode} }`);
        const call = new Function("scope", "act", `with (scope) { ${callerCode}; return respond; }`)(scope,
          () => laneOpen(slot, "/repo", "fleet/fixture", available.model!, "codex")) as () => Promise<Response>;
        const response = await call();
        const body: unknown = await response.json();
        checkFixture("Codex superseded lane open refuses before label, persistence and git effects", response.status === 400
          && !!body && typeof body === "object" && "error" in body && body.error === "slot occupant changed during lane open"
          && slot.label === foreign.label && slot.cwd === foreign.cwd && slot.selfToken === foreign.selfToken
          && writesAfterReplacement.length === 0 && effects.slice(effectsAtReplacement).join(",") === "release",
        `status=${response.status}; label preserved=${slot.label === foreign.label}; writes=${writesAfterReplacement}; late effects=${effects.slice(effectsAtReplacement)}`);
        continue;
      }
      if (fixture.mismatch) {
        const model = fixture.mismatch === "model" ? "fixture-other" : available.model;
        const cwd = fixture.mismatch === "cwd" ? "/other" : "/new";
        const result = openEvidence(await open(slot, cwd, null, model, null, "codex", null,
          { container: null, containerContext: null }, null, false, null, false, null, false, available));
        checkFixture(`Codex preobserved target mismatch: ${fixture.mismatch}`, supportCalls === 0
          && result?.availability === "unknown" && result.reason === "observation-target-mismatch"
          && result.model === model && result.cwd === cwd && slot.cwd === cwd && effects.includes("ensure"),
        `probes=${supportCalls}; availability=${result?.availability}; reason=${result?.reason}; opened=${slot.cwd === cwd}`);
        continue;
      }
      if (fixture.succession) {
        const anchor = { slot: 17, openedAt: 10 };
        const lane = { id: 18, worktree: { anchor } };
        const auditMessages: string[] = [];
        let debtRetained = false;
        const stranded = { brief: "fixture brief", draft: null };
        Object.assign(scope, {
          sameSuccessionOccupant: () => slot.openedAt === 10 && slot.selfToken === oldToken,
          json: (body: unknown, status: number) => new Response(JSON.stringify(body), { status }),
          restarting: new Set(), SUCCESSION_RESPAWN_FAIL_LATCH: null,
          SUCCESSION_AFTER_KILL_OCCUPANT_LATCH: null,
          TmuxNewSessionUnavailable: class extends Error {}, GameMakerTreeConflict: class extends Error {},
          slots: [lane], logError: () => {},
          audit: (_event: string, _slot: number, message: string) => { auditMessages.push(message); },
          recordSuccessionDebt: (_s: unknown, _rail: unknown, _pred: unknown, _successor: unknown, _reason: unknown, debt: unknown) => {
            debtRetained = debt === stranded; return { id: "fixture-debt", at: now };
          },
          openSlot: open, s: slot, predecessor: { cwd: "/new" }, openRoot: "/new",
          spawn: { model: available.model, effort: null, permissions: null }, label: null, harness: "codex",
          box: { container: null, containerContext: null }, treeLease: null,
          // the closures' MCP hand-over (card a8bc6c54): the generic rail carries the predecessor's
          // selection, the Program rail its plan's — none here, a codex fixture spawns without one
          carriedMcp: [], plan: { selected: [] }, planMcpServers: () => [],
          // ...and its rights (server/rechte.ts), claude only — a codex fixture carries none
          carriedRechte: null, carriedAgentMd: null,
          // ...and what an imported seat reads (server/sitz-reise.ts), claude only — a codex fixture carries none
          carriedSitz: null,
          // ...and its delivery choice (server/zustellung.ts); these slots carry none
          carriedZustellung: null,
          // ...and its choice of Fleet's library (server.ts#seatLibraryOn), claude only — a codex fixture carries none
          carriedBibliothek: null,
          // ...and the door's choices of the own setup (server/eigenes-setup.ts, server/weglassen.ts), claude only — a codex fixture carries none
          carriedNotizbuch: null, carriedPermissionMode: null, carriedWeglassen: null, carriedUmgebung: null, carriedTools: null,
          // ...and the agent it was opened from (server/agenten.ts) — a codex fixture opens from none
          carriedAgent: null,
          // the owner's setting rides on in respawnInPlace (server/succession.ts); these slots carry none
          ownSetting: () => null,
        });
        const at = source.indexOf("async function respawnInPlace(");
        const end = source.indexOf("\n}\n", at);
        const respawnCode = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(at, end + 3));
        const extract = (name: string): string => {
          const at = source.indexOf(name);
          return new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(at, source.indexOf("\n}\n", at) + 3));
        };
        const respawn = new Function("scope", `with (scope) { ${sameCode}; ${extract("async function respawnLost(")}
          ${extract("function rebindLaneAnchors(")}; ${respawnCode}; return respawnInPlace; }`)(scope) as
          (s: unknown, predecessor: unknown, rail: string, stranded: unknown, target: unknown,
            open: (support: CodexModelSupport | null, onCandidate: (candidate: FixtureCandidate) => void) => Promise<unknown>, onLost: () => Promise<void>) =>
            Promise<{ ok: true; modelSupport?: CodexModelSupport } | { ok: false; response: Response }>;
        const closureAt = source.indexOf(fixture.programClosure ? " => openSlot(s, openRoot" : " => openSlot(s, predecessor.cwd");
        const closureStart = source.lastIndexOf("(", closureAt);
        const closureCode = new Bun.Transpiler({ loader: "ts" }).transformSync(`const invoke = ${source.slice(closureStart, source.indexOf("),\n", closureAt) + 1)};`);
        const invoke = new Function("scope", `with (scope) { ${closureCode}; return invoke; }`)(scope) as
          (support: CodexModelSupport | null, onCandidate: (candidate: FixtureCandidate) => void) => Promise<FixtureOpenResult | CodexModelSupport | null>;
        let observed: CodexModelSupport | null = null;
        const result = await respawn(slot, { slot: 17, cwd: "/old", openedAt: 10, selfToken: oldToken }, "fixture", stranded, { cwd: "/new", model: available.model, harness: "codex" },
          async (support, onCandidate) => { const opened = await invoke(support, (candidate: FixtureCandidate) => {
              if (fixture.sameCandidateTime) foreign.openedAt = candidate.openedAt;
              onCandidate?.(candidate);
            });
          if (fixture.postOpenRace) { Object.assign(slot, foreign); foreignInstalled = true; }
          observed = openEvidence(opened); return opened; }, async () => {
            effects.push("lost");
            if (fixture.replaceOnLost) { Object.assign(slot, foreign); foreignInstalled = true; }
          });
        if (fixture.throwAt) {
          const owned = fixture.name === "succession-open-fails-owned";
          const body: unknown = result.ok ? null : await result.response.json();
          const cleanup = fixture.name === "succession-open-fails-unproven" ? "candidate identity unknown"
            : "foreign occupant preserved";
          checkFixture(`Codex failed succession cleans up only its exact candidate: ${fixture.name}`, !result.ok && result.response.status === 500
            && effects.filter((e) => e === "kill").length === (owned ? 2 : 1) && debtRetained
            && (owned ? slot.cwd === null : slot.cwd === foreign.cwd && slot.selfToken === foreign.selfToken
              && slot.label === foreign.label && writesAfterReplacement.length === 0)
            && lane.worktree.anchor === anchor && (owned || auditMessages.some((m) => m.includes(cleanup))
              && !!body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.includes(cleanup)),
          `status=${result.ok ? 200 : result.response.status}; kills=${effects.filter((e) => e === "kill").length}; foreign preserved=${owned || slot.cwd === foreign.cwd}; debt retained=${debtRetained}`);
          continue;
        }
        if (fixture.race || fixture.postOpenRace) {
          checkFixture(`Codex superseded succession preserves foreign occupant and predecessor anchors: ${fixture.name}`,
            !result.ok && result.response.status === 409 && supportCalls === 1 && effects.filter((e) => e === "kill").length === 1
              && slot.cwd === foreign.cwd && slot.openedAt === foreign.openedAt && slot.selfToken === foreign.selfToken
              && writesAfterReplacement.length === 0 && lane.worktree.anchor === anchor
              && !auditMessages.some((m) => m.includes("respawned in place")) && debtRetained,
            `status=${result.ok ? 200 : result.response.status}; probes=${supportCalls}; kills=${effects.filter((e) => e === "kill").length}; predecessor anchor=${lane.worktree.anchor === anchor}; foreign untouched=${writesAfterReplacement.length === 0}; debt retained=${debtRetained}`);
          continue;
        }
        checkFixture(`Codex succession freezes one pre-teardown decision when support flips after kill: ${fixture.name}`,
          result.ok && supportCalls === 1 && observed === available && result.modelSupport === available
            && slot.cwd === "/new" && effects.includes("ensure") && !effects.includes("lost"),
          `probes=${supportCalls}; opened=${slot.cwd === "/new"}; respawnLost=${effects.includes("lost")}; status=${result.ok ? 200 : result.response.status}`);
        continue;
      }
      let result: CodexModelSupport | null = null;
      let error: unknown = null;
      try { result = openEvidence(await open(slot, "/new", null, fixture.support.model!, null, "codex", null,
        { container: null, containerContext: null }, lease)); } catch (caught) { error = caught; }
      if (fixture.race === "ensure") {
        checkFixture("Codex superseded open completes without a late effect or support claim", error === null
          && result?.availability === "unknown" && result.reason === "observation-target-mismatch"
          && slot.cwd === foreign.cwd && slot.openedAt === foreign.openedAt && slot.selfToken === foreign.selfToken
          && writesAfterReplacement.length === 0 && effects.length === effectsAtReplacement,
        `completed=${error === null}; availability=${result?.availability}; writes=${writesAfterReplacement}; late effects=${effects.length - effectsAtReplacement}`);
      } else if (fixture.race) {
        checkFixture(`Codex open occupant: ${fixture.name}`, error instanceof Error
          && error.message === "slot occupant changed during open" && slot.cwd === foreign.cwd
          && slot.openedAt === foreign.openedAt && slot.selfToken === foreign.selfToken,
        `refused=${error instanceof Error ? error.message : "no"}; foreign occupant preserved=${slot.cwd === foreign.cwd}`);
        if (["teardown", "spawn", "support"].includes(fixture.race))
          checkFixture(`Codex open before teardown: ${fixture.name}`, effects.length === 0, `effects=${effects}`);
      } else if (fixture.support.availability === "unavailable") {
        checkFixture("Codex unavailable refuses before every teardown effect", error instanceof Refusal && effects.length === 0
          && slot.cwd === "/old" && slot.openedAt === 10 && slot.selfToken === oldToken
          && error.modelSupport.availability === "unavailable", `effects=${effects}`);
      } else {
        checkFixture(`Codex spawn: ${fixture.name}`, error === null && result?.availability === fixture.support.availability
          && slot.cwd === "/new" && effects.includes("ensure"),
        `availability=${result?.availability}; error=${error instanceof Error ? error.message : "none"}`);
      }
    } catch (error) {
      checkFixture(`Codex spawn fixture execution: ${fixture.name}`, false, error instanceof Error ? error.message : "unknown");
    }
  }
  const respawnAt = source.indexOf("async function respawnInPlace(");
  const respawnEnd = source.indexOf("\n}\n", respawnAt);
  const respawnCode = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(respawnAt, respawnEnd + 3));
  for (const fixture of [{ name: "available", support: available }, { name: "unknown", support: unknown },
    { name: "unavailable", support: unavailable }, { name: "replaced-during-support", support: unavailable }]) {
    const slot = { id: 17, cwd: "/old" as string | null, openedAt: 10, selfToken: "old-fixture-token" };
    const effects: string[] = [];
    const scope = {
      sameSuccessionOccupant: () => slot.openedAt === 10 && slot.selfToken === "old-fixture-token",
      harnessOf: () => ({ id: "codex" }),
      codexSpawnSupport: async () => {
        if (fixture.name === "replaced-during-support") Object.assign(slot, { cwd: "/foreign", openedAt: 99, selfToken: "foreign" });
        return fixture.support;
      },
      CodexModelUnavailable: class extends Error { constructor() { super("catalog-excluded"); } },
      json: (value: unknown, status: number) => new Response(JSON.stringify(value), { status }),
      slotTeardownInflight: new Map(), slotSpawnInflight: new Map(), laneSpawn: new Set([17]), restarting: new Set(),
      killSlot: async () => { effects.push("kill"); Object.assign(slot, { cwd: null, openedAt: 0 }); },
      SUCCESSION_RESPAWN_FAIL_LATCH: null, SUCCESSION_AFTER_KILL_OCCUPANT_LATCH: null,
      audit: () => {}, rebindLaneAnchors: () => {}, ownSetting: () => null,
    };
    const respawn = new Function("scope", `with (scope) { ${respawnCode}; return respawnInPlace; }`)(scope) as
      (s: unknown, predecessor: unknown, rail: string, stranded: unknown, target: unknown,
        open: () => Promise<FixtureOpenResult>, onLost: () => Promise<void>) => Promise<{ ok: true } | { ok: false; response: Response }>;
    const result = await respawn(slot, { slot: 17, cwd: "/old", openedAt: 10, selfToken: "old-fixture-token" }, "fixture", {}, { cwd: "/new", model: fixture.support.model, harness: "codex" },
      async () => { effects.push("open"); Object.assign(slot, { cwd: "/new", openedAt: 20, selfToken: "new-fixture-token" });
        return { superseded: false, modelSupport: fixture.support, occupant: { ...slot } }; }, async () => {});
    if (fixture.name === "unavailable") {
      const body: unknown = !result.ok ? await result.response.json() : null;
      checkFixture("Codex succession refuses before teardown with typed model evidence", !result.ok && result.response.status === 400
        && effects.length === 0 && slot.cwd === "/old" && !!body && typeof body === "object" && "modelSupport" in body
        && JSON.stringify(body.modelSupport) === JSON.stringify(unavailable), `effects=${effects}`);
    } else if (fixture.name === "replaced-during-support") {
      checkFixture("Codex succession rechecks occupant after support await", !result.ok && result.response.status === 409
        && effects.length === 0 && slot.cwd === "/foreign" && slot.openedAt === 99, `effects=${effects}`);
    } else {
      checkFixture(`Codex succession proceeds on ${fixture.name}`, result.ok && effects.join(",") === "kill,open", `effects=${effects}`);
    }
  }

  const lostAt = source.indexOf("async function respawnLost(");
  const lostEnd = source.indexOf("\n}\n", lostAt);
  const lostCode = new Bun.Transpiler({ loader: "ts" }).transformSync(source.slice(lostAt, lostEnd + 3));
  for (const race of ["latch", "identity", "lane-spawn", "slot-spawn"]) {
    const slot = { id: 17, cwd: "/old" as string | null, openedAt: 10, selfToken: "old-fixture-token" };
    const predecessor = { slot: 17, cwd: "/old", openedAt: 10, selfToken: slot.selfToken };
    const stranded = { brief: "retained fixture brief", path: "succession", draft: null, label: "fixture" };
    const effects: string[] = [];
    const laneReservations = new Set<number>();
    const spawns = new Map<number, Promise<void>>();
    let endedState = "";
    let retained: unknown = null;
    const scope = {
      sameSuccessionOccupant: () => slot.cwd === predecessor.cwd && slot.openedAt === predecessor.openedAt
        && slot.selfToken === predecessor.selfToken,
      harnessOf: () => ({ id: "codex" }), codexSpawnSupport: async () => available,
      TmuxNewSessionUnavailable: class extends Error {}, GameMakerTreeConflict: class extends Error {},
      json: (value: unknown, status: number) => new Response(JSON.stringify(value), { status }),
      slotTeardownInflight: new Map(), restarting: new Set(), laneSpawn: laneReservations, slotSpawnInflight: spawns,
      SUCCESSION_RESPAWN_FAIL_LATCH: null,
      SUCCESSION_AFTER_KILL_OCCUPANT_LATCH: race === "latch" ? "/fixture-latch" : null,
      existsSync: () => true, Date: { now: () => 99 },
      killSlot: async (_slot: unknown, why: string) => {
        effects.push(`kill:${why}`);
        Object.assign(slot, { cwd: null, openedAt: 0 });
        if (race === "identity") slot.selfToken = "foreign-fixture-token";
        if (race === "lane-spawn") laneReservations.add(17);
        if (race === "slot-spawn") spawns.set(17, Promise.resolve());
        endedState = JSON.stringify(slot);
      },
      audit: () => {}, rebindLaneAnchors: () => {}, logError: () => {}, saveStateNow: async () => {}, ownSetting: () => null,
      recordSuccessionDebt: (_s: unknown, _rail: string, _pred: unknown, _successor: unknown, _reason: string, debt: unknown) => {
        retained = debt; return { id: "fixture-debt", at: 99 };
      },
    };
    const respawn = new Function("scope", `with (scope) { ${lostCode}; ${respawnCode}; return respawnInPlace; }`)(scope) as
      (s: unknown, predecessor: unknown, rail: string, stranded: unknown, target: unknown,
        open: () => Promise<FixtureOpenResult>, onLost: () => Promise<void>) => Promise<{ ok: true } | { ok: false; response: Response }>;
    const result = await respawn(slot, predecessor, "fixture", stranded,
      { cwd: "/new", model: available.model, harness: "codex" },
      async () => { effects.push("open"); return { superseded: false, modelSupport: available, occupant: { ...slot } }; }, async () => { effects.push("lost"); });
    const untouched = race === "latch" ? slot.cwd === "/fleet-test-succession-foreign" && slot.openedAt === 99
      && slot.selfToken === "fleet-test-succession-foreign" : JSON.stringify(slot) === endedState;
    const body: unknown = result.ok ? null : await result.response.json();
    checkFixture(`Codex succession preserves foreign act after teardown: ${race}`,
      !result.ok && result.response.status === 409 && effects.join(",") === "kill:handoff,lost"
        && untouched && retained === stranded && !!body && typeof body === "object" && "error" in body
        && typeof body.error === "string" && body.error.includes("slot was taken by another act after the predecessor ended — nothing reopened"),
      `status=${result.ok ? 200 : result.response.status}; opened=${effects.includes("open")}; foreign untouched=${untouched}; debt retained=${retained === stranded}; effects=${effects}`);
  }

}

await checkCodexSpawnFixtures(readFileSync(`${ROOT}/server.ts`, "utf8"), check);
import { codexPermissionsFrom } from "./server/types";

for (const [claim, pass] of Object.entries(await codexPermissionSpawnClaims(readFileSync(`${ROOT}/server.ts`, "utf8"))))
  check(claim, pass);

// server.ts's two send-boot constants, mirrored the way e2e/harness.ts mirrors AUTO_MIN_EVERY_SEC:
// neither is env-exposed, and every fixture below is a statement ABOUT them, so a fixture that
// restated the numbers inline would say nothing when one of them moves.
//   SEND_BOOT_FRESH_MS — outside this window sendText skips the readiness branch entirely, so a
//     fast send proves staleness rather than whatever the fixture meant to prove. Every fixture
//     here therefore carries it as its OWN named precondition.
//   SEND_BOOT_WAIT_MS  — the largest delay the readiness branch can add. It is what the no-delay
//     budgets below are sized against, and the only regression size a clock can honestly separate.
const SEND_BOOT_FRESH_MS = 15_000; // server.ts, const SEND_BOOT_FRESH_MS
const SEND_BOOT_WAIT_MS = 3000;    // server.ts, const SEND_BOOT_WAIT_MS
// Deliberately below SEND_BOOT_WAIT_MS with a full second of machine-load margin, and deliberately
// NOT below DEFAULT_BOOT_SETTLE_MS (250 ms): 250 ms is inside this machine's noise, so no clock can
// separate "no settle" from "settled" and pretending otherwise is what made the old `< 1000` budget
// a bet. The settle branch is excluded by the PRECONDITION instead — sendText only settles when its
// first probe found the agent absent, and these fixtures prove it present before they send.
const NO_DELAY_BUDGET_MS = 2000;

type AgentState = "alive" | "no-agent" | "no-pane" | "unprobed";
interface PollSlot { id: number; agent: AgentState | null; lastOutput: number }

const slotAgent = async (slot: number): Promise<AgentState | null | undefined> =>
  ((await (await get("/api/sessions")).json()) as { slots: PollSlot[] }).slots.find((x) => x.id === slot)?.agent;

// poll the cached reading rather than sleep a guessed interval: `agent` is written on the git tick,
// and a fixed sleep would either be flaky or slow. Returns the last reading either way, so a
// failing check reports what it actually saw instead of "undefined".
async function awaitAgent(slot: number, want: AgentState): Promise<AgentState | null | undefined> {
  let seen: AgentState | null | undefined;
  for (let i = 0; i < 80; i++) {
    seen = await slotAgent(slot);
    if (seen === want) return seen;
    await Bun.sleep(250);
  }
  return seen;
}

const slotLastOutput = async (slot: number): Promise<number | undefined> =>
  ((await (await get("/api/sessions")).json()) as { slots: PollSlot[] })
    .slots.find((x) => x.id === slot)?.lastOutput;

async function awaitObserved(slot: number): Promise<number | undefined> {
  let seen: number | undefined;
  for (let i = 0; i < 80; i++) {
    seen = await slotLastOutput(slot);
    if (seen !== undefined && seen > 0) return seen;
    await Bun.sleep(100);
  }
  return seen;
}

// Match paneAgentAt's process-tree depth so a fixture can fail under its OWN name when its wrapper
// accidentally presents a declared comm before the test begins. This is diagnostic only: the
// production readiness decision still comes from server.ts's fresh probe.
async function directPaneComms(target: string): Promise<string[]> {
  const pane = Number((await tmuxOut("display-message", "-p", "-t", target, "#{pane_pid}")).out);
  if (!pane) return [];
  const pg = Bun.spawn(["pgrep", "-P", String(pane)], { stdout: "pipe" });
  const children = (await new Response(pg.stdout).text()).split("\n").filter(Boolean);
  await pg.exited;
  const out: string[] = [];
  for (const pid of [String(pane), ...children]) {
    const ps = Bun.spawn(["ps", "-o", "comm=", "-p", pid], { stdout: "pipe" });
    const comm = (await new Response(ps.stdout).text()).trim().split("/").pop() ?? "";
    await ps.exited;
    if (comm) out.push(comm);
  }
  return out;
}

// The negative half of phase 1's argv probe: observe the resident foreign agent itself, not the
// shell text tmux was asked to start, so a claude-only flag cannot hitchhike into another harness.
async function directPaneArgv(target: string, prefix: string): Promise<string[]> {
  const pane = Number((await tmuxOut("display-message", "-p", "-t", target, "#{pane_pid}")).out);
  if (!pane) return [];
  const pg = Bun.spawn(["pgrep", "-P", String(pane)], { stdout: "pipe" });
  const children = (await new Response(pg.stdout).text()).split("\n").filter(Boolean);
  await pg.exited;
  const out: string[] = [];
  for (const pid of [String(pane), ...children]) {
    const comm = Bun.spawn(["ps", "-o", "comm=", "-p", pid], { stdout: "pipe" });
    const name = (await new Response(comm.stdout).text()).trim().split("/").pop() ?? "";
    await comm.exited;
    if (!name.startsWith(prefix)) continue;
    const ps = Bun.spawn(["ps", "-ww", "-o", "command=", "-p", pid], { stdout: "pipe" });
    const argv = (await new Response(ps.stdout).text()).trim();
    await ps.exited;
    if (argv) out.push(argv);
  }
  return out;
}

// ESTABLISH, don't assert: poll the pane's own process tree until the declared agent appears.
// Returns the last reading either way, so the caller's check reports what it really saw.
async function awaitPaneComm(target: string, prefix: string, budgetMs: number): Promise<string[]> {
  const until = Date.now() + budgetMs;
  let seen: string[] = [];
  for (;;) {
    seen = await directPaneComms(target);
    if (seen.some((c) => c.startsWith(prefix))) return seen;
    if (Date.now() >= until) return seen;
    await Bun.sleep(100);
  }
}

// The pane's rendered bytes, which is the only honest way to say "this pane has printed". lastOutput
// cannot say it: tmux stamps it on the pane's first REPAINT, which happens before the agent exists
// (94b1362 — the silent-alive stand-in prints nothing at all and still got a timestamp).
async function awaitPaneText(target: string, needle: string, budgetMs: number): Promise<boolean> {
  const until = Date.now() + budgetMs;
  for (;;) {
    if ((await tmuxOut("capture-pane", "-t", target, "-p", "-J")).out.includes(needle)) return true;
    if (Date.now() >= until) return false;
    await Bun.sleep(100);
  }
}

// The one PATH fact sendText leaves behind that a test can read: its timeout branch writes a
// send_boot_timeout audit row before it pastes. This is a second opinion on WHICH branch ran,
// next to the clock — and a safe one, because it can only ever produce a false PASS: a row still
// sitting in the event-log write chain reads as absent, and the elapsed budget catches that case.
// Duplicated in fleet-e2e-claude-gate.ts on purpose — the two phase harnesses are separate
// single-file programs and share nothing but e2e/harness.ts (CLAUDE.md, "fleet-e2e.ts is a runner
// only"). -1 means the trail itself could not be read, which is a failure of its own.
function sendBootTimeouts(slot: number, sinceTs: number): number {
  let raw = "";
  try { raw = readFileSync(`${ROOT}/audit.jsonl`, "utf8"); } catch { return -1; }
  let n = 0;
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let row: { ts?: number; event?: string; slot?: number };
    try { row = JSON.parse(line) as typeof row; } catch { continue; }
    if (row.event === "send_boot_timeout" && row.slot === slot && (row.ts ?? 0) >= sinceTs) n++;
  }
  return n;
}

// The empty-comms waiver is immutable server configuration, so the wrapper gives it a fresh
// phase-2 process and enters only this counter-proof.
if (process.env.FLEET_GATE_UNPROBED === "1") {
  const openedStarted = Date.now();
  const opened = await post("/api/slots/1/open", { cwd: "~" });
  check("unprobed fixture: the FLEET_CMD=true slot opened", opened.ok, String(opened.status));

  // Send FIRST, assert the preconditions AFTER. Both are facts that cannot change between the send
  // and the assertion — an empty comms declaration is a server BOOT fact, and a freshness window
  // only ever shrinks — so nothing is bought by paying for them before the clock starts, and every
  // millisecond spent beforehand is a millisecond of the window this fixture needs.
  // What is NOT among them any more: `lastOutput === 0`. sendText has not consulted lastOutput
  // since 94b1362, and tmux repaints a pane before its agent prints a byte, so that line asserted a
  // negative this fixture never controlled and a repaint could destroy at any moment.
  const marker = "unprobed-send-arrived";
  const started = Date.now();
  const sent = await post("/send", { slot: 1, text: `printf '${marker}\\n'` });
  const elapsed = Date.now() - started;

  const freshAtSend = started - openedStarted;
  const wasFresh = freshAtSend < SEND_BOOT_FRESH_MS;
  check("unprobed fixture precondition: the send fell inside the boot-freshness window",
    wasFresh, `${freshAtSend}ms of ${SEND_BOOT_FRESH_MS}ms`);
  // The server's own statement that it has no comms to probe with — which IS the waiver under test.
  const agentSeen = await awaitAgent(1, "unprobed");
  const wasUnprobed = agentSeen === "unprobed";
  check("unprobed fixture precondition: the server declares no comms for this slot",
    wasUnprobed, String(agentSeen));
  if (wasFresh && wasUnprobed) {
    // 1500 ms: the only delay reachable from a fresh pane is SEND_BOOT_WAIT_MS, so the budget has
    // to separate 1500 from 3000, not from a settle the waiver branch can never pay.
    check("an empty comms set is never readiness-delayed", sent.ok && elapsed < 1500,
      `${sent.status} ${elapsed}ms (budget 1500 of ${SEND_BOOT_WAIT_MS})`);
  }

  // This is the probe's OWN verdict. Only after it passes may marker absence mean /send was lost;
  // otherwise this branch would reproduce the boot race and mislabel a probe failure as success.
  const paneProbe = await paneEnv("s1", "FLEET_SELF_SLOT");
  check("unprobed fixture probe: paneEnv itself ran in the stand-in shell", paneProbe === "1",
    paneProbe ?? "probe did not run");
  const cap = await tmuxOut("capture-pane", "-t", "s1", "-p", "-J");
  check("the non-delayed unprobed send still arrives byte-for-byte",
    cap.out.includes(marker), cap.out.slice(-180));

  console.log(results.join("\n"));
  console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
  process.exit(failures() ? 1 : 0);
}

const FAKEBIN = process.env.FAKE_CLAUDE_DIR!;

interface AutoInfo { id: string; slot: number; lastResult: string | null }

// The boot fixtures race a sleep that lives in e2e-claude-gate.sh, not here. Read it out of the
// installed stand-in rather than restating the number: a copy would rot silently the day the
// wrapper changes, and this fixture's whole job is to send INSIDE that window.
function fixtureSleepMs(name: string): number {
  try {
    const m = readFileSync(`${FAKEBIN}/${name}`, "utf8").match(/^\s*sleep\s+([0-9]+)\s*$/m);
    return m ? Number(m[1]) * 1000 : 0;
  } catch { return 0; }
}

// the pane's spawn command, once tmux has actually created the session
async function startCmdOf(target: string): Promise<string> {
  for (let i = 0; i < 40; i++) {
    if ((await tmuxOut("has-session", "-t", target)).code === 0) {
      const c = (await tmuxOut("display-message", "-p", "-t", target, "#{pane_start_command}")).out;
      if (c.trim()) return c;
    }
    await Bun.sleep(250);
  }
  return "";
}

// a fresh inode per swap, never a mutation of the one a running pane still maps: overwriting an
// executable in place invalidates the code signature of every process mapping it (AMFI, Apple
// Silicon) and kills them at their next exec. Phase 1 learned this the expensive way.
async function installHarn(variant: "boot" | "observed" | "never" | "hang" | "exit"): Promise<void> {
  await Bun.$`rm -f ${FAKEBIN}/harn`.quiet();
  await Bun.write(`${FAKEBIN}/harn`, await Bun.file(`${FAKEBIN}/harn-${variant}`).arrayBuffer());
  await Bun.$`chmod +x ${FAKEBIN}/harn`.quiet();
}

// --- branch 0: the boot race itself. A script/interpreter with no declared comm waits two seconds;
// only then does it exec harn-agent. harn-agent flushes once before reading, so the old immediate
// paste is genuinely lost; the readiness wait plus adapter settle moves delivery past that flush.
await installHarn("boot");
const bootSleepMs = fixtureSleepMs("harn-boot");
check("boot-race fixture: the stand-in declares the pre-exec sleep this fixture races",
  bootSleepMs > 0, `${bootSleepMs}ms`);
const bootOpenStarted = Date.now();
const bootOpen = await post("/api/slots/9/open", { cwd: "~" });
check("boot-race fixture: the delayed foreign TUI opened", bootOpen.ok, String(bootOpen.status));
const bootWrapperComms = await directPaneComms("s9");
const bootUnexec = bootWrapperComms.length > 0 && bootWrapperComms.every((c) => !c.startsWith("harn"));
check("boot-race fixture probe: no declared harn process exists before /send",
  bootUnexec, bootWrapperComms.join(",") || "process probe did not run");
const bootMarker = "boot-send-model-marker";
const bootStarted = Date.now();
const bootSend = await post("/send", { slot: 9, text: bootMarker });
const bootElapsed = Date.now() - bootStarted;
// The fixture is only measuring a boot race if the send actually began while the stand-in was
// still sleeping. Said under its OWN name: a send that arrives late finds an already-alive agent
// and takes the no-delay path, and the product check below would then report a code regression
// that never happened. Nothing here is a negative anyone else can destroy — it is this process's
// own two timestamps against a window read out of the fixture.
const bootRaced = bootStarted - bootOpenStarted;
const bootInWindow = bootSleepMs > 0 && bootRaced < bootSleepMs;
check("boot-race fixture precondition: the send began before the stand-in exec'd its agent",
  bootInWindow, `${bootRaced}ms of ${bootSleepMs}ms`);
if (bootInWindow && bootUnexec) {
  check("immediate /send waits for the foreign TUI settle instead of feeding its boot flush",
    bootSend.ok && bootElapsed >= 1000, `${bootSend.status} ${bootElapsed}ms`);

  // Probe verdict first, payload verdict second. If paneEnv cannot run after the stand-in exits, the
  // marker assertion is not allowed to impersonate a boot-race measurement.
  const bootPaneProbe = await paneEnv("s9", "FLEET_SELF_SLOT");
  check("boot-race fixture probe: paneEnv itself ran after the delayed TUI",
    bootPaneProbe === "9", bootPaneProbe ?? "probe did not run");
  const bootCap = await tmuxOut("capture-pane", "-t", "s9", "-p", "-J");
  check("the delayed TUI's model received the immediate send byte-for-byte",
    bootCap.out.includes(`harn-received=[${bootMarker}]`), bootCap.out.slice(-220));
}

// A separate fixture prints AFTER ensureSlot's repaint quiet-window, then hangs as a real harn
// process. The precondition is now ESTABLISHED rather than asserted: the stand-in's own ready line
// is what proves both halves this fixture needs — the pane HAS printed, and the printer IS the
// declared agent, because harn-print emits that line only after harn-observed exec'd it.
await installHarn("observed");
const observedSleepMs = fixtureSleepMs("harn-observed");
check("observed-pane fixture: the stand-in declares its pre-print sleep",
  observedSleepMs > 0, `${observedSleepMs}ms`);
const observedOpenStarted = Date.now();
const observedOpen = await post("/api/slots/11/open", { cwd: "~" });
check("observed-pane fixture: the delayed-print foreign TUI opened",
  observedOpen.ok, String(observedOpen.status));
const observedPrinted = await awaitPaneText("s11", "harn-observed-ready", observedSleepMs + 10_000);
check("observed-pane fixture: the stand-in printed its ready line into the pane",
  observedPrinted, observedPrinted ? "harn-observed-ready" : "ready line never appeared");
const observedComms = await awaitPaneComm("s11", "harn", 5000);
const observedAlive = observedComms.some((c) => c.startsWith("harn"));
check("observed-pane fixture probe: the printing harn process is really alive",
  observedAlive, observedComms.join(",") || "process probe did not run");
const observedAt = await awaitObserved(11);
check("observed-pane fixture: Fleet recorded the pane's first output",
  observedAt !== undefined && observedAt > 0, String(observedAt));
// Establishing the two facts above costs the stand-in's sleep, so the window this send needs is the
// one thing the establishing could have spent. Its own named check, and the reason it is here at
// all: a send that fell OUT of the window would return fast for a reason that has nothing to do
// with the no-delay path, and would read as a green measurement of something never measured.
const observedFresh = Date.now() - observedOpenStarted;
const observedInWindow = observedFresh < SEND_BOOT_FRESH_MS;
check("observed-pane fixture precondition: the send still falls inside the boot-freshness window",
  observedInWindow, `${observedFresh}ms of ${SEND_BOOT_FRESH_MS}ms`);
if (observedPrinted && observedAlive && observedInWindow) {
  const observedMarker = "observed-send-arrived";
  const auditMark = Date.now();
  const observedSend = await post("/send", { slot: 11, text: observedMarker });
  const observedElapsed = Date.now() - auditMark;
  check("a pane that already printed takes the unchanged no-delay send path",
    observedSend.ok && observedElapsed < NO_DELAY_BUDGET_MS,
    `${observedSend.status} ${observedElapsed}ms (budget ${NO_DELAY_BUDGET_MS} of ${SEND_BOOT_WAIT_MS})`);
  // ...and the branch itself, not just its duration: the timeout branch is the one that leaves a row.
  const observedTimeouts = sendBootTimeouts(11, auditMark);
  check("the no-delay send took no readiness-timeout branch (no audit row)",
    observedTimeouts === 0, observedTimeouts < 0 ? "audit trail unreadable" : `${observedTimeouts} rows`);
  const observedCap = await tmuxOut("capture-pane", "-t", "s11", "-p", "-J");
  check("the observed-pane direct send preserves its bytes",
    observedCap.out.includes(observedMarker), observedCap.out.slice(-220));
}

// --- branch 1: the probe FINDS a foreign agent. The positive control, and it has to come first:
// without it, a probe that simply answered "no-agent" to everything would satisfy every negative
// check below and look like a working gate. ---
await installHarn("hang");
const o1 = await post("/api/slots/1/open", { cwd: "~" });
check("open slot 1 under a foreign harness", o1.ok, String(o1.status));
const ag1 = await awaitAgent(1, "alive");
check("the liveness probe recognises a NON-claude agent by its declared comm", ag1 === "alive", String(ag1));
const foreignArgv = await directPaneArgv("s1", "harn");
check("the live foreign stand-in receives no claude prompt-suggestions flag in its argv",
  foreignArgv.length > 0 && foreignArgv.every((argv) => !argv.includes("--prompt-suggestions")),
  foreignArgv.join(" | ") || "no harn argv observed");

// ...and the gate it feeds actually delivers, so "alive" is not a label the rest of the app ignores.
const marker1 = "harness-must-type-this";
const a1res = await post("/api/slots/1/autos", { text: marker1, inSec: 1, idleSec: 0 });
const a1 = (await a1res.json()) as { auto: AutoInfo };
check("create auto on the live foreign-harness slot", a1res.ok && !!a1.auto?.id);
await Bun.sleep(afterTick(1000, AUTOS_TICK_MS));
const cap1 = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("live foreign harness: the scheduled prompt reaches the pane", cap1.out.includes(marker1), cap1.out.slice(-160));

// --- branch 2: a foreign MODEL pattern — `/` and `:`, neither of which MODEL_RE admits — is
// accepted by this harness's charset AND reaches the pane line single-quoted. ---
const FOREIGN_MODEL = "anthropic/claude-sonnet-5:high";
const o2 = await post("/api/slots/2/open", { cwd: "~", model: FOREIGN_MODEL });
check("a foreign model pattern with / and : is accepted (200)", o2.ok, String(o2.status));
const cmd2 = await startCmdOf("s2");
check("the foreign model reaches the pane spawn command, shell-quoted",
  cmd2.includes(`--model '${FOREIGN_MODEL}'`), cmd2.slice(-200));

// ...and the foreign charset is a strict SUPERSET of the claude one, never a swap: a declared
// harness must not LOSE a name a claude fleet would have taken. The bracket suffix is the case that
// proves it, being the one shape MODEL_RE allows that a naive foreign charset drops.
const oSup = await post("/api/slots/7/open", { cwd: "~", model: "claude-opus-5[1m]" });
check("the foreign charset is a superset — a [1m] bracket name is still accepted",
  oSup.ok, String(oSup.status));

// --- branch 3: THE shell-safety proof, and the reason branch 2's quotes are not decoration.
// `*` is a zsh glob and this socket's default-shell IS zsh (set by the wrapper), which ABORTS the
// whole command line on an unmatched glob — `exec $SHELL` included, so the pane would not even
// survive as a bare shell. Asserting the quoted string is the cheap half; asserting that the agent
// is ALIVE afterwards is the half that would actually catch a lost quote. ---
const GLOB_MODEL = "*sonnet*";
const o3 = await post("/api/slots/3/open", { cwd: "~", model: GLOB_MODEL });
check("a foreign model pattern containing a glob is accepted (200)", o3.ok, String(o3.status));
const cmd3 = await startCmdOf("s3");
check("the glob model reaches the pane spawn command, shell-quoted",
  cmd3.includes(`--model '${GLOB_MODEL}'`), cmd3.slice(-200));
const ag3 = await awaitAgent(3, "alive");
check("the glob model did NOT abort the pane at spawn — the agent is running", ag3 === "alive", String(ag3));

// --- branch 4: the charset is an ALLOWLIST, not an opening. `'` is the one character that could
// end the single-quoted word every branch above depends on; a space or `;` would split the line.
// If any of these is ever accepted, every quoted interpolation in slotCmd becomes an injection. ---
for (const bad of ["a'b", "a b", "a;rm -rf /", "a$(id)", "a`id`", "a\\b", "a\nb"]) {
  const r = await post("/api/slots/4/open", { cwd: "~", model: bad });
  check(`the foreign charset still rejects ${JSON.stringify(bad)} (400)`, r.status === 400, String(r.status));
}

// --- branch 5: a foreign slot that pins NO model gets no --model flag at all. Deliberate: the
// fleet's DEFAULT_MODEL is a claude model id, and pinning it onto a foreign harness would name a
// model that harness has never heard of — which is branch 6's failure, manufactured by us. ---
const o5 = await post("/api/slots/5/open", { cwd: "~" });
check("open a foreign slot with no model", o5.ok, String(o5.status));
const cmd5 = await startCmdOf("s5");
check("a foreign slot with no model of its own passes no --model flag",
  cmd5.length > 0 && !cmd5.includes("--model"), cmd5.slice(-200));

// --- branch 5b: ▸ start carries Pi's effort choice into the lane's REAL pane command. This must
// live in phase 2: the main suite runs FLEET_CMD=true and cannot prove an adapter flag reached an
// agent command. The positive row is also the pane-line reader's control; only after it has read
// `--thinking high` is the absence row meaningful rather than a probe that always returns empty.
const DISPATCH_MODEL = "openai-codex/gpt-5.6-sol";
const dispatchProbe = async (text: string, body: Record<string, unknown>): Promise<void> => {
  const taskRes = await post("/api/tasks", { text, queue: false });
  const taskId = ((await taskRes.json()) as { task?: { id: string } }).task?.id ?? "";
  check(`dispatch-effort fixture: pending task exists (${text})`, taskRes.ok && !!taskId,
    `${taskRes.status} id=${taskId || "missing"}`);
  if (!taskId) return;

  const dispatchRes = await post(`/api/tasks/${taskId}/dispatch`, body);
  const dispatchJ = (await dispatchRes.json()) as { ok?: boolean; slot?: number; error?: string };
  const slot = typeof dispatchJ.slot === "number" ? dispatchJ.slot : null;
  check(`dispatch-effort fixture: ▸ start accepted the spawn (${text})`,
    dispatchRes.ok && dispatchJ.ok === true && slot !== null,
    `${dispatchRes.status} ${JSON.stringify(dispatchJ)}`);
  if (slot === null) { await post(`/api/tasks/${taskId}/delete`, {}); return; }

  const cmd = await startCmdOf(`s${slot}`);
  check(`dispatch-effort fixture: the Pi pane command is readable (${text})`,
    cmd.length > 0 && /(^|\s|;)pi --session-id/.test(cmd), cmd.slice(-220));
  if (body.effort === "high") {
    check("▸ start passes effort=high to Pi as --thinking high",
      cmd.includes("--thinking high"), cmd.slice(-220));
  } else {
    check("▸ start with no effort preserves null: the Pi pane command has no --thinking flag",
      !cmd.includes("--thinking"), cmd.slice(-220));
  }

  const killed = await post(`/api/slots/${slot}/kill`, {});
  check(`dispatch-effort fixture: the probe lane is released (${text})`, killed.ok, String(killed.status));
  await post(`/api/tasks/${taskId}/delete`, {});
};
await dispatchProbe("dispatch-effort-positive", { harness: "pi", model: DISPATCH_MODEL, effort: "high" });
await dispatchProbe("dispatch-effort-absent", { harness: "pi", model: DISPATCH_MODEL });

// --- branch 6: THE CORE. A DEAD foreign agent — the exit variant stands in for the harness that
// exited on an unresolvable model — must read as not-alive, and the delivery gate must refuse.
// Before this, claudeAlive() returned `true` here without looking, so the marker below would have
// been typed into a bare shell and executed. ---
await installHarn("never");

// The bounded failure side: this wrapper outlives the 3000 ms budget but NEVER execs a declared
// agent. It later exits to the shell only so paneEnv can independently prove the pane is readable.
// The owner /send waits only the short route budget, leaves a durable, text-free audit row, and then
// REFUSES (409) instead of typing into a pane no agent reads — the 2026-09-14 12:08 spawning-lane kill.
// Until then this fixture pinned the opposite (delivery after timeout); the owner still reaches a
// bare shell through the terminal itself, never through the compose route.
const timeoutOpenStarted = Date.now();
const timeoutOpen = await post("/api/slots/10/open", { cwd: "~" });
check("boot-timeout fixture: the dead foreign harness opened onto its shell",
  timeoutOpen.ok, String(timeoutOpen.status));
// What this fixture no longer asserts is `lastOutput === 0`. sendText has never read lastOutput —
// its boot branch turns on `openedAt` alone (server.ts, `mayStillBeBooting`) — and 94b1362 proved
// tmux stamps lastOutput on the pane's first REPAINT, before any agent prints a byte. That line was
// therefore a negative this fixture does not own and a repaint can destroy at any instant; it is
// replaced below by the window sendText actually reads, established from this process's own clock.
// The process probe stays where it is: unlike a repaint stamp, "no harn under this pane" is a
// property of the harn-never SOURCE (it sleeps and execs nothing), so nothing can take it away.
const timeoutWrapperComms = await directPaneComms("s10");
const timeoutUnexec = timeoutWrapperComms.length > 0
  && timeoutWrapperComms.every((c) => !c.startsWith("harn"));
check("boot-timeout fixture probe: no declared harn process exists before /send",
  timeoutUnexec, timeoutWrapperComms.join(",") || "process probe did not run");
const timeoutMarker = "boot-timeout-send-arrived";
const timeoutStarted = Date.now();
const timeoutSend = await post("/send", { slot: 10, text: `printf '${timeoutMarker}\\n'` });
const timeoutElapsed = Date.now() - timeoutStarted;
// The precondition under its OWN name. Outside the freshness window sendText skips the readiness
// branch entirely: the send would return at once and leave no audit row, and the four checks below
// would report a code regression that never happened instead of a fixture that arrived too late.
const timeoutFresh = timeoutStarted - timeoutOpenStarted;
const timeoutInWindow = timeoutFresh < SEND_BOOT_FRESH_MS;
check("boot-timeout fixture precondition: the send falls inside the boot-freshness window",
  timeoutInWindow, `${timeoutFresh}ms of ${SEND_BOOT_FRESH_MS}ms`);
if (timeoutInWindow && timeoutUnexec) {
  const timeoutBody = (await timeoutSend.clone().json().catch(() => null)) as
    { error?: unknown; agent?: unknown; receipt?: { delivery?: unknown } } | null;
  check("a readiness timeout is bounded and then REFUSED — 409 agent-not-alive, nothing typed",
    timeoutSend.status === 409 && timeoutElapsed >= 2800 && timeoutElapsed < 6000
    && timeoutBody?.receipt?.delivery === "refused" && typeof timeoutBody?.agent === "string"
    && timeoutBody.agent !== "alive" && String(timeoutBody?.error ?? "").includes("no agent alive"),
    `${timeoutSend.status} ${timeoutElapsed}ms ${JSON.stringify(timeoutBody).slice(0, 200)}`);
  // Probe verdict first: only a shell that demonstrably reads its tty makes the marker's ABSENCE
  // mean "never typed" — a typed `printf` would have run there once harn-never's sleep ended.
  const timeoutProbe = await paneEnv("s10", "FLEET_SELF_SLOT");
  check("boot-timeout fixture probe: paneEnv itself ran in the surviving shell",
    timeoutProbe === "10", timeoutProbe ?? "probe did not run");
  if (timeoutProbe === "10") {
    const timeoutCap = await tmuxOut("capture-pane", "-t", "s10", "-p", "-J");
    check("the refused owner send left nothing in the dead-agent pane",
      !timeoutCap.out.includes(timeoutMarker), timeoutCap.out.slice(-220));
    // the wrapper has exited to its shell now, so the pane is a bare shell for good: a second send
    // is refused too (which of sendText's two probe branches answers depends on the pane's age)
    const deadStarted = Date.now();
    const deadSend = await post("/send", { slot: 10, text: `printf '${timeoutMarker}-late\\n'` });
    check("a pane whose agent never came and whose wrapper exited to a shell refuses /send with 409",
      deadSend.status === 409 && String(((await deadSend.clone().json().catch(() => null)) as
        { error?: unknown } | null)?.error ?? "").includes("no agent alive"),
      `${deadSend.status} age=${deadStarted - timeoutOpenStarted}ms of ${SEND_BOOT_FRESH_MS}ms`);
  }
  let timeoutAudit: { event?: string; slot?: number; detail?: string } | undefined;
  for (let i = 0; i < 30 && !timeoutAudit; i++) {
    const rows = ((await (await get("/api/audit?limit=100")).json()) as
      { events: { event?: string; slot?: number; detail?: string }[] }).events;
    timeoutAudit = rows.find((e) => e.event === "send_boot_timeout" && e.slot === 10);
    if (!timeoutAudit) await Bun.sleep(100);
  }
  check("the readiness timeout is visible on the audit trail",
    !!timeoutAudit && timeoutAudit.detail === "harness=default budget=3000ms",
    JSON.stringify(timeoutAudit ?? null));
}

await installHarn("exit");
const o6 = await post("/api/slots/6/open", { cwd: "~" });
check("open slot 6 (dead foreign agent branch)", o6.ok, String(o6.status));
await Bun.sleep(1500); // let the stand-in exit and `exec $SHELL` take the pane

// (c): the state that had no name. NOT "no-pane" — the distinction is the whole point, because a
// pane that is gone is loud and a pane that is alive with nothing behind it is silent.
const ag6 = await awaitAgent(6, "no-agent");
check("a pane that outlived its agent reads agent=no-agent on the owner poll", ag6 === "no-agent", String(ag6));
check("...and that is distinct from no-pane, which is what makes it the silent failure",
  ag6 !== "no-pane", String(ag6));

// (a): the gate that was a no-op for a foreign harness
const marker6 = "harness-must-not-type-this";
const a6res = await post("/api/slots/6/autos", { text: marker6, inSec: 1, idleSec: 0 });
const a6 = (await a6res.json()) as { auto: AutoInfo };
check("create auto on the dead foreign-harness slot", a6res.ok && !!a6.auto?.id);
// a negative control: nothing may reach the pane, so it has to out-wait a full tickAutos
await Bun.sleep(afterTick(1000, AUTOS_TICK_MS));
const cap6 = await tmuxOut("capture-pane", "-t", "s6", "-p");
check("dead foreign agent: the scheduled prompt never reached the bare shell",
  !cap6.out.includes(marker6), cap6.out.slice(-160));
const sess6 = (await (await get("/api/sessions")).json()) as { autos: AutoInfo[] };
const a6after = sess6.autos.find((a) => a.id === a6.auto.id);
check("dead foreign agent: lastResult reports the skip",
  a6after?.lastResult === "skipped — no agent running in pane", a6after?.lastResult ?? "missing");

// --- branch 7: a CLAUDE-ROUTED WORKER under a harness that cannot host one. A different spawn from
// every branch above — summaryViaSession, not a slot. Review is deliberate: summary now has its
// own headless codex-exec route, while this counterprobe proves that migration did not leak into
// another worker and the existing session path still asks the configured worker harness.
//
// The wrapper points FLEET_WORKER_HARNESS at `container`, whose `worker` answers null. What has to
// be proven is not that it fails — a wrong implementation fails too — but HOW: the worker's answer
// is read from a host-side transcript, so a harness that writes none produces a file that never
// appears, and the naive shape spends a real agent run and then waits out SUMMARY_TIMEOUT_MS (180 s)
// before saying anything. Hence both halves below: the message NAMES the harness and the reason,
// and it arrives in seconds rather than after the readiness timeout.
const WORKER_REPO = process.env.WORKER_REPO!;
const o7 = await post("/api/slots/8/open", { cwd: WORKER_REPO });
check("open a slot on a real repo for the worker branch", o7.ok, String(o7.status));
await Bun.write(`${WORKER_REPO}/code.txt`, "root\nworker review fixture\n");
const t7 = Date.now();
const r7 = await post("/api/slots/8/review", {});
const b7 = (await r7.json()) as { error?: string };
const took = Date.now() - t7;
check("a non-summary worker on a transcript-less harness is REFUSED (500 with an error)",
  r7.status === 500 && !!b7.error, `${r7.status} ${b7.error ?? "(no error field)"}`);
check("...and the refusal names the harness and the reason, so the fix is not a guess",
  (b7.error ?? "").includes('harness "container"') && (b7.error ?? "").includes("transcript"),
  b7.error ?? "(no error field)");
// the timing half. Generous on purpose — this asserts "did not wait out a timeout", not a latency
// budget: the readiness loop alone is 30 s and SUMMARY_TIMEOUT_MS is 180 s, so anything under 10 s
// can only be the refusal, on any load this suite tolerates elsewhere.
check("...and it refuses BEFORE spawning, not after a timeout", took < 10_000, `${took}ms`);

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

export async function codexPermissionSpawnClaims(source: string): Promise<Record<string, boolean>> {
  const span = (start: string, end: string): string => { const a = source.indexOf(start); return source.slice(a, source.indexOf(end, a)); };
  const occupant = span("interface SlotSpawnOccupant", "const SLOT_POST_CAPTURE_LATCH");
  const validators = span("function permissionsOf(", "// The lane's browser profile");
  const ensure = span("async function ensureSlot(", "function expandCwd(");
  const open = span("async function openSlot(", "// a task\'s `sent` state");
  const adapterStart = source.indexOf("  spawnCmd: (o) => {", source.indexOf("const CODEX_HARNESS"));
  const adapter = source.slice(adapterStart + "  spawnCmd: (o) => {".length, source.indexOf("\n  },", adapterStart));
  const code = new Bun.Transpiler({ loader: "ts" }).transformSync(`
    return async (scenario) => {
      const profile = {sandbox:"read-only",approval:"on-request"};
      const s = { id:1,cwd:"/fixture",openedAt:100,selfToken:"old",sessionId: scenario === "resume" ? "10000000-0000-4000-8000-000000000001" : null,
        model:null,harness:"codex",effort:null,browser:false,remote:false,context:null,container:null,containerContext:null,
        permissions: scenario === "invalid" ? {state:"invalid"} : scenario.startsWith("open-recycle")
          ? {sandbox:"danger-full-access",approval:"never"} : {...profile},sleeping:null,codexRecoveryState:null,worktree:null };
      const commands = [], publications = [];
      const PATH_EXPORT="",CODEX_TEXT_LANE_MCP="",SHELL="/usr/bin/true";
      const realpathSync = (p) => p, shellSingleQuote = (v) => "'" + v.replaceAll("'", "'\\\\''") + "'";
      const h = {id:"codex",permissions:{default:{sandbox:"danger-full-access",approval:"never"}},supports:{resume:true},pinsSession:false,
        spawnCmd:(o)=>{${adapter}}};
      const harnessOf = () => h;
      const modelOf=()=>({ok:true}),modelsForHarness=()=>[],codexSpawnSupport=async()=>null;
      const fleetCheckoutForSpawn=()=>false;
      ${validators}
      ${occupant}
      const slotTeardownInflight = new Map(),slotSpawnInflight = new Map();
      const sess = () => "s1",sessTarget = (v) => v;
      let awaited = false;
      const tmux = async (...args) => {
        if(args[0] === "has-session") {
          // t | event | exclusive owner
          // 0 | snapshot captured | old@100
          // 1 | external has-session await completes; slot reused/profile changed | new@200 / old@100
          // 2 | continuation may spawn only after exact snapshot proof | current occupant
          await Promise.resolve();
          if(scenario === "replaced") Object.assign(s,{openedAt:200,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
          if(scenario === "changed-profile") s.permissions.sandbox="danger-full-access";
          awaited=true; return {code:1,out:""};
        }
        return {code:0,out:args[0] === "display-message" ? args.at(-1) === "#{pane_pipe}" ? "1" : "200 50" : ""};
      };
      const tmuxNewSession = async (...args) => {commands.push(args.at(-1)); return {code:0,out:"%1\\t@1",timedOut:false};};
      const parseTmuxTarget = () => ({paneId:"%1",windowId:"@1"}),codexRolloutForId=async()=>"/rollout";
      const CODEX_UUID_RE=/^[0-9a-f-]{36}$/, RULEBOOK_AB_RENDERS=null;
      const saveState=()=>publications.push(JSON.stringify(s.permissions)),audit=()=>{},noteSessionIdLearned=()=>{},backfillProgramMainSessionId=()=>{};
      const HOST="fixture",PORT=1,stewardToken=null,STEWARD_LABEL="steward",BASE_CMD="claude";
      const boxFor=()=>({container:"",containerContext:""});
      const existsSync=()=>true,statSync=()=>({mode:384,isDirectory:()=>true});
      const occupantStreamPath=()=>"/stream",occupantStreamStagePath=()=>"/stage",legacyStreamPath=()=>"/legacy";
      const console={log:()=>{}};
      ${ensure}
      const resolve=(v)=>v,expandCwd=(v)=>v,NO_BOX={};
      // t | event | exclusive owner
      // 0 | open captures A@100/old and the teardown latch already running | A (own latch) OR other@50 (foreign latch)
      // 1 | the awaited teardown ends | empty@0/old-token, OR replaced by new@200, OR empty@0/new-token
      // 2 | open may adopt the empty end-state only on its own captured latch | new request OR no spawn
      if(scenario.startsWith("open-teardown-")) slotTeardownInflight.set(1,{occupant: scenario === "open-teardown-foreign-latch"
        ? {slot:1,openedAt:50,selfToken:"other"} : {slot:1,openedAt:100,selfToken:"old"},promise:Promise.resolve()});
      const waitForSlotTeardown=async()=>{await Promise.resolve();awaited=true;
        if(scenario === "open-replaced") Object.assign(s,{openedAt:200,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
        else if(scenario === "open-teardown-replaced") Object.assign(s,{cwd:"/replacement",openedAt:200,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
        else if(scenario === "open-teardown-empty-foreign-token") Object.assign(s,{cwd:null,openedAt:0,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
        else if(scenario.startsWith("open-teardown-")) Object.assign(s,{cwd:null,openedAt:0,permissions:null});
        slotTeardownInflight.delete(1);};
      const observeTmuxSlots=async()=>({detail:"fixture"}),tmuxSlotObservation=()=>({presence:"absent"});
      const waitForSlotSpawn=async()=>{};
      const assertProgramFoundingTargetOpen=()=>{},repoCanon=(v)=>v,assertGameMakerTreeOpen=()=>{};
      const openSlotIntents=new Set(),SEPARATE_LANE_SLOTS=false,BAND_SLOTS=16,FLEET_MAX_SESSIONS=64;
      const slots=[s],laneSpawn=new Set(),singletonSpawn=new Set();
      const detachSlotTasks=()=>{},closeShareClients=()=>{};
      let shares=[],autos=[],recents=[];
      const slotStreamOccupant=()=>s.cwd ? {slot:s.id,openedAt:s.openedAt,selfToken:s.selfToken} : null;
      const killSlot=async()=>{
        await Promise.resolve();awaited=true;
        // t | event | exclusive owner
        // 0 | open snapshot and new restrictive request | old@100/full-access
        // 1 | own teardown finishes OR target is replaced during its await | empty@0/old-token OR new@200
        // 2 | open may publish only against its known teardown end-state | new request OR no spawn
        if(scenario === "open-recycle-replaced") Object.assign(s,{cwd:"/replacement",openedAt:200,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
        else if(scenario === "open-recycle-empty-replaced") Object.assign(s,{cwd:null,openedAt:0,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});
        else Object.assign(s,{cwd:null,openedAt:0,permissions:null});
      };
      const waitForGameMakerOpenTestLatch=async()=>{await Promise.resolve();if(scenario === "open-recycle-later-replaced")
        Object.assign(s,{cwd:"/replacement",openedAt:200,selfToken:"new",permissions:{sandbox:"workspace-write",approval:"never"}});};
      const randomBytes=()=>({toString:()=>"successor"}),historyPath=()=>"/history",rm=async()=>{};
      const harvest=new Map(),startCache=new Map(),mergeParked=new Map(),mergeLast=new Map(),mergeInflight=new Map(),mergeStart=new Map();
      const aliveInfo=new Map(),paneModelInfo=new Map(),gitOpInfo=new Map(),laneHunkInfo=new Map(),gitInfo=new Map(),repoInfo=new Map();
      const inboxNudgeTried=new Set(),postfachAttempted=new Map(),postfachQueued=new Map();
      const parkMergeVerdict=()=>{},dropWatchesFor=()=>{},reapLaneSuiteOffersFor=()=>{},MAX_RECENTS=10;
      const merkeStart=async()=>{},STATE_DIR="/fixture-state",REAL_SEAT_GATE=null;
      const slotOpenHold=new Map(),fassungTestHaken={},halteStart=async()=>null,vergissFassung=()=>{};class FassungBewegt extends Error{}
      ${open}
      let error=null; try {
        if(scenario.startsWith("open-")) await openSlot(s,"/fixture",null,null,null,"codex",null,{},null,false,null,false,
          scenario === "open-invalid" ? {sandbox:"read-only",approval:"untrusted"} : profile);
        else await ensureSlot(s,scenario === "invalid" ? "restart" : "heal");
      } catch(e) {error=String(e);}
      return {commands,publications,awaited,error,profile:s.permissions};
    };`);
  const exercise = new Function("codexPermissionsFrom", code)(codexPermissionsFrom) as
    (scenario: string) => Promise<{ commands: string[]; publications: string[]; awaited: boolean; error: string | null;
      profile: { sandbox?: string; approval?: string; state?: string } }>;
  const fresh = await exercise("fresh"), resume = await exercise("resume");
  const replaced = await exercise("replaced"), changed = await exercise("changed-profile"), invalid = await exercise("invalid");
  const openReplaced = await exercise("open-replaced"), openInvalid = await exercise("open-invalid");
  const recycle = await exercise("open-recycle"), recycleReplaced = await exercise("open-recycle-replaced");
  const recycleLaterReplaced = await exercise("open-recycle-later-replaced"), recycleEmptyReplaced = await exercise("open-recycle-empty-replaced");
  const waitingOwn = await exercise("open-teardown-own"), waitingForeignLatch = await exercise("open-teardown-foreign-latch");
  const waitingReplaced = await exercise("open-teardown-replaced"), waitingEmptyForeign = await exercise("open-teardown-empty-foreign-token");
  const promptPattern = source.match(/\{ re: (\/Would you like[^\n]+?\/), why: "codex permission prompt" \}/)?.[1];
  const promptBlock = promptPattern ? new Function(`return ${promptPattern}`)() as RegExp : null;
  const promptFrame = ">_ OpenAI Codex (v0.159.0)\nWould you like to run the following command?\nEnvironment: local\nReason: Allow the isolated fixture command?\n$ printf permission-probe\n1. Yes, proceed (y)\n3. No, and tell Codex what to do differently (esc)";
  return {
    "Codex on-request command approval frame is a named readiness block despite the ready header": promptBlock?.test(promptFrame) === true,
    "openSlot own teardown accepts exactly empty@0/old-token and spawns only the new restrictive profile": recycle.error === null
      && recycle.commands.length === 1 && recycle.commands[0].includes("--sandbox read-only --ask-for-approval on-request")
      && recycle.profile.sandbox === "read-only" && !recycle.commands[0].includes("bypass"),
    "openSlot replacement during own teardown cannot spawn or overwrite the replacement profile": recycleReplaced.error !== null
      && recycleReplaced.commands.length === 0 && recycleReplaced.publications.length === 0 && recycleReplaced.profile.sandbox === "workspace-write",
    "openSlot empty@0 still requires the exact predecessor token after teardown": recycleEmptyReplaced.error !== null
      && recycleEmptyReplaced.commands.length === 0 && recycleEmptyReplaced.publications.length === 0 && recycleEmptyReplaced.profile.sandbox === "workspace-write",
    "openSlot re-proves the known teardown end-state after its next external await": recycleLaterReplaced.error !== null
      && recycleLaterReplaced.commands.length === 0 && recycleLaterReplaced.publications.length === 0 && recycleLaterReplaced.profile.sandbox === "workspace-write",
    "openSlot waiting behind exactly its predecessor's running teardown adopts empty@0/old-token and spawns only the new profile": waitingOwn.error === null
      && waitingOwn.awaited && waitingOwn.commands.length === 1 && waitingOwn.commands[0].includes("--sandbox read-only --ask-for-approval on-request")
      && !waitingOwn.commands[0].includes("bypass") && waitingOwn.profile.sandbox === "read-only",
    "openSlot waiting behind a foreign occupant's teardown latch refuses the empty end-state without spawn": waitingForeignLatch.error !== null
      && waitingForeignLatch.commands.length === 0 && waitingForeignLatch.publications.length === 0 && waitingForeignLatch.profile === null,
    "openSlot waiting behind its own teardown refuses a new occupant published after it without spawn or profile overwrite": waitingReplaced.error !== null
      && waitingReplaced.commands.length === 0 && waitingReplaced.publications.length === 0 && waitingReplaced.profile.sandbox === "workspace-write",
    "openSlot waiting behind its own teardown refuses empty@0 under a foreign token without spawn or profile overwrite": waitingEmptyForeign.error !== null
      && waitingEmptyForeign.commands.length === 0 && waitingEmptyForeign.publications.length === 0 && waitingEmptyForeign.profile.sandbox === "workspace-write",
    "openSlot refuses a replaced target after teardown await without spawn or profile overwrite": openReplaced.error !== null
      && openReplaced.awaited && openReplaced.commands.length === 0 && openReplaced.profile.sandbox === "workspace-write",
    "openSlot invalid new profile refuses before teardown or occupant mutation": openInvalid.error?.includes("bad permissions") === true
      && !openInvalid.awaited && openInvalid.commands.length === 0 && openInvalid.profile.sandbox === "read-only",
    "ensureSlot fresh uses the captured restrictive profile without bypass": fresh.commands.length === 1
      && fresh.commands[0].includes("--sandbox read-only --ask-for-approval on-request") && !fresh.commands[0].includes("bypass"),
    "ensureSlot exact resume uses the same restrictive profile": resume.commands.length === 1
      && resume.commands[0].includes("codex resume '10000000-0000-4000-8000-000000000001'")
      && resume.commands[0].includes("--sandbox read-only --ask-for-approval on-request"),
    "ensureSlot external await with a replaced occupant spawns and publishes nothing": replaced.awaited
      && replaced.commands.length === 0 && replaced.publications.length === 0 && replaced.profile.sandbox === "workspace-write",
    "ensureSlot external await with changed permissions spawns and publishes nothing": changed.awaited
      && changed.commands.length === 0 && changed.publications.length === 0,
    "ensureSlot invalid persisted permissions refuses before any external await or spawn": invalid.error !== null
      && !invalid.awaited && invalid.commands.length === 0 && invalid.publications.length === 0 && invalid.profile.state === "invalid",
  };
}

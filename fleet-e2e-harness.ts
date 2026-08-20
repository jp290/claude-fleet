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
import { AUTOS_TICK_MS, ROOT, afterTick, check, failures, get, paneEnv, post, results, tmuxOut } from "./e2e/harness";

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
// agent. It later exits to the shell only so paneEnv can independently prove delivery happened.
// must still preserve the owner's ability to type into the surviving shell, but it must wait only
// the short route budget and leave a durable, text-free audit row instead of returning a silent OK.
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
  check("a readiness timeout is bounded and still sends — never 409/refusal",
    timeoutSend.ok && timeoutElapsed >= 2800 && timeoutElapsed < 6000,
    `${timeoutSend.status} ${timeoutElapsed}ms`);
  const timeoutProbe = await paneEnv("s10", "FLEET_SELF_SLOT");
  check("boot-timeout fixture probe: paneEnv itself ran in the surviving shell",
    timeoutProbe === "10", timeoutProbe ?? "probe did not run");
  const timeoutCap = await tmuxOut("capture-pane", "-t", "s10", "-p", "-J");
  check("the owner send is delivered after timeout, preserving the dead-agent pane capability",
    timeoutCap.out.includes(timeoutMarker), timeoutCap.out.slice(-220));
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

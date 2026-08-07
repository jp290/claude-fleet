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
// The stand-in is a compiled binary named `harn` (a shebang script would not do: ps reports the
// interpreter's comm, not the script's filename — same reason phase 1 compiles its `claude`), and
// the server is told about it ONLY through env: FLEET_CMD=harn, FLEET_HARNESS_COMMS=harn,
// FLEET_HARNESS_MODEL_FLAG=--model. Nothing about any specific harness is compiled into server.ts,
// and this suite is the proof of that: it names a harness that does not exist outside this file.
//
// Run via ./e2e-claude-gate.sh. Do not run directly against a live fleet — e2e/harness.ts refuses
// the live socket and the live port on import, before anything here can act.
import { AUTOS_TICK_MS, afterTick, check, failures, get, post, results, tmuxOut } from "./e2e/harness";

const FAKEBIN = process.env.FAKE_CLAUDE_DIR!;

interface AutoInfo { id: string; slot: number; lastResult: string | null }
type AgentState = "alive" | "no-agent" | "no-pane" | "unprobed";
interface PollSlot { id: number; agent: AgentState | null }

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
async function installHarn(variant: "hang" | "exit"): Promise<void> {
  await Bun.$`rm -f ${FAKEBIN}/harn`.quiet();
  await Bun.write(`${FAKEBIN}/harn`, await Bun.file(`${FAKEBIN}/harn-${variant}`).arrayBuffer());
  await Bun.$`chmod +x ${FAKEBIN}/harn`.quiet();
}

// --- branch 1: the probe FINDS a foreign agent. The positive control, and it has to come first:
// without it, a probe that simply answered "no-agent" to everything would satisfy every negative
// check below and look like a working gate. ---
await installHarn("hang");
const o1 = await post("/api/slots/1/open", { cwd: "~" });
check("open slot 1 under a foreign harness", o1.ok, String(o1.status));
const ag1 = await awaitAgent(1, "alive");
check("the liveness probe recognises a NON-claude agent by its declared comm", ag1 === "alive", String(ag1));

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

// --- branch 6: THE CORE. A DEAD foreign agent — the exit variant stands in for the harness that
// exited on an unresolvable model — must read as not-alive, and the delivery gate must refuse.
// Before this, claudeAlive() returned `true` here without looking, so the marker below would have
// been typed into a bare shell and executed. ---
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

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

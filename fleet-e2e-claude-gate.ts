// e2e for the claude-alive gate (server.ts's claudeAlive()) — the ONE path in the whole
// app that must never fire: typing a scheduled prompt into a bare shell, where it would
// EXECUTE as a command instead of landing in a claude conversation.
//
// The main suite (fleet-e2e.ts) can't exercise this: it runs with FLEET_CMD=true, an UNDECLARED
// command (no FLEET_HARNESS_COMMS), for which the probe returns "unprobed" and claudeAlive() waives
// the gate — correct, because a stand-in like `true` legitimately leaves no process behind, but it
// means the ps/pgrep detection logic itself has zero coverage under that setup. This harness runs a
// REAL claude-prefixed FLEET_CMD against a compiled stand-in binary literally named `claude` on
// PATH, so the exact same process-tree check the real feature relies on is what's under test.
//
// This file is PHASE 1. Phase 2 (fleet-e2e-harness.ts, same wrapper) asks the same questions of a
// harness that is not claude. The two are a pair and neither is complete alone: phase 2 proves a
// foreign model charset is accepted, and the counter-proof that a CLAUDE fleet still rejects those
// same shapes can only be made here — a widened shared MODEL_RE would pass phase 2 and be a
// regression, and this file is what notices.
//
// Run via ./e2e-claude-gate.sh (builds the fake binary, starts an isolated instance,
// invokes this file, tears down). Do not run directly against a live fleet.
// The plumbing below the checks — BASE, the owner token read out of the instance's fleet.json,
// post/get/check/tmuxOut, and the live-fleet refusal this harness used to carry as its own copied
// line — is e2e/harness.ts, the module the main suite's check modules already import. It refuses
// the live socket AND the live port on import, before anything here can act. check() there is also
// the per-check trail's single emit site, so this suite's checks now leave durable rows
// (docs/e2e-trail.md); ./e2e-claude-gate.sh stamps them with FLEET_E2E_SUITE=claude-gate.
import { readFileSync, rmdirSync, rmSync } from "node:fs";
import { AUTOS_TICK_MS, BASE, ROOT, afterTick, check, failures, get, post, results, tmuxOut } from "./e2e/harness";
import { FLEET_DEFAULT_MODEL } from "./src/protocol";
import { runFreshPinnedTranscriptIsolation } from "./e2e/history";
const FAKEBIN = process.env.FAKE_CLAUDE_DIR!;

interface AutoInfo { id: string; slot: number; lastResult: string | null }
// No lastOutput: this harness has no use for it any more, and a cast is a CLAIM about a foreign
// surface — a field kept "just in case" is a claim nothing verifies (docs/verify-tiering.md §12).
interface SendPollSlot { id: number; agent: "alive" | "no-agent" | "no-pane" | "unprobed" | null }

async function awaitAgent(slot: number, want: SendPollSlot["agent"]): Promise<SendPollSlot | undefined> {
  let seen: SendPollSlot | undefined;
  for (let i = 0; i < 80; i++) {
    seen = ((await (await get("/api/sessions")).json()) as { slots: SendPollSlot[] })
      .slots.find((s) => s.id === slot);
    if (seen?.agent === want) return seen;
    await Bun.sleep(250);
  }
  return seen;
}

// server.ts's send-boot constants, mirrored the way e2e/harness.ts mirrors AUTO_MIN_EVERY_SEC —
// none of them is env-exposed, and the fixtures below are statements ABOUT them.
const SEND_BOOT_FRESH_MS = 15_000;      // server.ts, const SEND_BOOT_FRESH_MS
const CLAUDE_BOOT_SETTLE_MS = 2500;     // server.ts, CLAUDE_HARNESS bootSettleMs
// Explicit and argued, where the old `< 1000` was an implicit bet against a shared machine: the
// smallest regression this check can detect is Claude's 2500 ms settle, so the budget has to sit
// below 2500 and as far above this machine's send cost (probe + two tmux calls + 150 ms) as that
// leaves room for. 2000 keeps a 500 ms detection margin and gives the machine 4x the headroom the
// old number did. Nothing wider would still separate the settle; nothing narrower is measured.
const NO_SETTLE_BUDGET_MS = 2000;

// paneAgentAt's own process-tree question, asked DIRECTLY by the fixture: does a process whose comm
// starts with `prefix` hang under this pane? Re-implemented here rather than imported because the
// phase harnesses are separate single-file programs sharing only e2e/harness.ts (CLAUDE.md,
// "fleet-e2e.ts is a runner only"); fleet-e2e-harness.ts carries the phase-2 twin.
async function paneComms(target: string): Promise<string[]> {
  const pane = Number((await tmuxOut("display-message", "-p", "-t", target, "#{pane_pid}")).out);
  if (!pane) return [];
  const pg = Bun.spawn(["pgrep", "-P", String(pane)], { stdout: "pipe" });
  const kids = (await new Response(pg.stdout).text()).split("\n").filter(Boolean);
  await pg.exited;
  const out: string[] = [];
  for (const pid of [String(pane), ...kids]) {
    const ps = Bun.spawn(["ps", "-o", "comm=", "-p", pid], { stdout: "pipe" });
    const comm = (await new Response(ps.stdout).text()).trim().split("/").pop() ?? "";
    await ps.exited;
    if (comm) out.push(comm);
  }
  return out;
}

// Read the resident process's argv from the OS. pane_start_command would only prove that Fleet
// rendered text into a shell line; this observes what the stand-in agent actually received.
async function paneArgv(target: string, prefix: string): Promise<string[]> {
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

// ESTABLISH, don't assert: poll until the declared agent appears, and return the last reading
// either way so a failing check reports what it really saw.
async function awaitPaneComm(target: string, prefix: string, budgetMs: number): Promise<string[]> {
  const until = Date.now() + budgetMs;
  for (;;) {
    const seen = await paneComms(target);
    if (seen.some((c) => c.startsWith(prefix)) || Date.now() >= until) return seen;
    await Bun.sleep(100);
  }
}

// The one PATH fact sendText leaves behind that a test can read: its timeout branch writes a
// send_boot_timeout audit row before it pastes. Absence can never produce a false FAIL — a row
// still in the event-log write chain reads as absent, and the elapsed budget catches that case.
// -1 means the trail itself could not be read, which is a failure of its own.
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

// --- branch 1: claude is NOT running (fake binary exits immediately, `exec $SHELL`
// takes over the pane) — the auto must be skipped, and NOTHING may reach the pane ---
const o1 = await post("/api/slots/1/open", { cwd: "~" });
check("open slot 1 (dead-claude branch)", o1.ok, JSON.stringify(await o1.clone().json().catch(() => null)));
await Bun.sleep(1500); // let the fake binary exit and `exec $SHELL` settle
const marker1 = "gate-must-not-type-this";
const a1res = await post("/api/slots/1/autos", { text: marker1, inSec: 1, idleSec: 0 });
const a1 = (await a1res.json()) as { auto: AutoInfo };
check("create auto on dead-claude slot", a1res.ok && !!a1.auto?.id);
// inSec:1 due + one tickAutos + margin, sized from the same env the srv spawn got. A negative
// control: nothing may reach the pane, so it has to out-wait the tick rather than poll.
await Bun.sleep(afterTick(1000, AUTOS_TICK_MS));
const cap1 = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("dead-claude gate: marker never reached the pane", !cap1.out.includes(marker1), cap1.out.slice(-120));
const sess1 = (await (await get("/api/sessions")).json()) as { autos: AutoInfo[] };
const a1after = sess1.autos.find((a) => a.id === a1.auto.id);
check("dead-claude gate: lastResult reports the skip", a1after?.lastResult === "skipped — no agent running in pane", a1after?.lastResult ?? "missing");

// --- branch 2: claude IS running (swap the fake binary for a hang variant, open a
// fresh slot so the new pane resolves the new file) — the auto must fire normally ---
// rm before write: an in-place overwrite of an executable another pane still maps invalidates
// its code-signature (AMFI, Apple Silicon) and kills that pane's process on its next exec —
// rm+write gives every swap a fresh inode instead of mutating the one currently mapped.
await Bun.$`rm -f ${FAKEBIN}/claude`.quiet();
await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-hang`).arrayBuffer());
await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
const o2 = await post("/api/slots/2/open", { cwd: "~" });
check("open slot 2 (alive-claude branch)", o2.ok);
await Bun.sleep(1500); // let the fake binary actually start and settle as a pane child

// Regression for the distinction lastOutput cannot make: this agent is positively alive but its
// hang stand-in never prints a byte (claude-hang.c is `for (;;) pause();` — the silence is a
// property of the FIXTURE's source, not something a test has to observe). It must not pay Claude's
// 2500 ms settle forever. Keep it on a separate slot so the existing alive-gate check below retains
// its original never-printed fixture.
//
// What this fixture no longer asserts is `lastOutput === 0`. sendText has consulted a PROCESS probe
// plus the openedAt freshness window since 94b1362, never lastOutput; and 94b1362's own proof was
// that tmux stamps lastOutput on a repaint before the agent prints — this very stand-in got a
// timestamp while printing nothing. Worse, the wait that established the OTHER precondition
// (`awaitAgent`, up to 20 s) was the thing most likely to destroy it. A precondition nobody
// controls is not a precondition.
const silentOpenStarted = Date.now();
const silentOpen = await post("/api/slots/9/open", { cwd: "~" });
check("silent-alive fixture: open a second live claude that never prints", silentOpen.ok,
  String(silentOpen.status));
// ESTABLISHED, and established DIRECTLY: the pane's own process tree, not the git-tick cache, which
// can be up to one tick (10 s) behind and would spend the freshness window this fixture needs.
const silentComms = await awaitPaneComm("s9", "claude", 10_000);
const silentAlive = silentComms.some((c) => c.startsWith("claude"));
check("silent-alive fixture: the claude stand-in is a live pane process before /send",
  silentAlive, silentComms.join(",") || "process probe did not run");
// The window itself, as its own named check. Outside it sendText skips the readiness branch
// entirely, so a fast send would prove staleness — a green row for a thing never measured.
const silentFresh = Date.now() - silentOpenStarted;
const silentInWindow = silentFresh < SEND_BOOT_FRESH_MS;
check("silent-alive fixture precondition: the send falls inside the boot-freshness window",
  silentInWindow, `${silentFresh}ms of ${SEND_BOOT_FRESH_MS}ms`);
if (silentAlive && silentInWindow) {
  const silentMarker = "alive-silent-must-not-settle";
  const silentStarted = Date.now();
  const silentSend = await post("/send", { slot: 9, text: silentMarker });
  const silentElapsed = Date.now() - silentStarted;
  check("an already-alive pane that never printed takes the no-settle send path",
    silentSend.ok && silentElapsed < NO_SETTLE_BUDGET_MS,
    `${silentSend.status} ${silentElapsed}ms (budget ${NO_SETTLE_BUDGET_MS} of ${CLAUDE_BOOT_SETTLE_MS})`);
  // ...and the BRANCH, not only its duration: the readiness-timeout branch is the one that leaves
  // a durable row behind, so its absence is a second, clock-free opinion on which path ran.
  const silentTimeouts = sendBootTimeouts(9, silentStarted);
  check("the no-settle send took no readiness-timeout branch (no audit row)",
    silentTimeouts === 0, silentTimeouts < 0 ? "audit trail unreadable" : `${silentTimeouts} rows`);
  // ACP-25: this stand-in is a claude by NAME only and renders no composer, so the acceptance
  // read can locate nothing — the receipt must say so ("unobservable") and must not carry the
  // old request-flag echo. A real claude answers "observed" here (measured by the real-TUI probe,
  // docs/messungen/acp25-*); a "not-applicable" would mean the claude adapter lost its composer.
  const silentReceipt = (await silentSend.clone().json().catch(() => null)) as
    { receipt?: { submitRequested?: unknown; acceptance?: unknown; submitted?: unknown } } | null;
  check("a claude stand-in that renders no composer answers acceptance:unobservable, never observed or `submitted`",
    silentReceipt?.receipt?.submitRequested === true && silentReceipt?.receipt?.acceptance === "unobservable"
    && !("submitted" in (silentReceipt?.receipt ?? {})), JSON.stringify(silentReceipt?.receipt));
  const silentCap = await tmuxOut("capture-pane", "-t", "s9", "-p");
  check("the no-settle send reaches the already-alive silent pane",
    silentCap.out.includes(silentMarker), silentCap.out.slice(-160));
}
// Corroboration, deliberately AFTER the send: Fleet's cached fact layer must agree with the pane
// this fixture probed directly. It is a stable reading (claude-hang does not exit), so nothing is
// racing here — and paying its tick latency before the send is what used to eat the window above.
const silentSeen = await awaitAgent(9, "alive");
check("silent-alive fixture: Fleet's own probe agrees the agent is alive",
  silentSeen?.agent === "alive", JSON.stringify(silentSeen));

const claudeArgv = await paneArgv("s9", "claude");
check("the live claude stand-in receives --prompt-suggestions false in its argv",
  claudeArgv.some((argv) => /(?:^|\s)--prompt-suggestions\s+false(?:\s|$)/.test(argv)),
  claudeArgv.join(" | ") || "no claude argv observed");

const marker2 = "gate-must-type-this";
const a2res = await post("/api/slots/2/autos", { text: marker2, inSec: 1, idleSec: 0 });
const a2 = (await a2res.json()) as { auto: AutoInfo };
check("create auto on alive-claude slot", a2res.ok && !!a2.auto?.id);
await Bun.sleep(afterTick(1000, AUTOS_TICK_MS)); // same budget as branch 1, so the pair is comparable
const cap2 = await tmuxOut("capture-pane", "-t", "s2", "-p");
check("alive-claude gate: marker reached the pane", cap2.out.includes(marker2), cap2.out.slice(-160));
const sess2 = (await (await get("/api/sessions")).json()) as { autos: AutoInfo[] };
const a2after = sess2.autos.find((a) => a.id === a2.auto.id);
check("alive-claude gate: lastResult reports sent", a2after?.lastResult === "sent", a2after?.lastResult ?? "missing");

// Transcript-family regression needing this harness's real session pin (history.ts explains why).
await runFreshPinnedTranscriptIsolation(8);

// steward-authenticated fetch helpers — reused by branch 4's fresh-for-gates test below.
const stewTok = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
const stewH = { "content-type": "application/json", authorization: `Bearer ${stewTok}` };
const stewPost = (path: string, body: unknown) => fetch(BASE + path, { method: "POST", headers: stewH, body: JSON.stringify(body) });
const stewGet = (path: string) => fetch(BASE + path, { headers: stewH });

// --- branch 4: Tier-1 signal surface under a REAL claude — the cached `alive` reading on the
// steward read routes, and THE safety invariant: cache-for-reads / fresh-for-gates. The main
// suite can't test either (FLEET_CMD=true short-circuits claudeAlive to a constant true). ---

interface SigSlot { id: number; alive: boolean | null }
const sigFor = async (slot: number): Promise<SigSlot | undefined> =>
  ((await (await stewGet("/api/steward/sessions")).json()) as { slots: SigSlot[] }).slots.find((x) => x.id === slot);

// slot 1 has been a bare shell since branch 1 — the cached reading must say so (≤ one tick)
let sigDead: SigSlot | undefined;
for (let i = 0; i < 60; i++) {
  sigDead = await sigFor(1);
  if (sigDead?.alive === false) break;
  await Bun.sleep(250);
}
check("steward sessions: a dead-claude pane reads alive=false from the cache", sigDead?.alive === false, JSON.stringify(sigDead));

// ...and the same pane on the OWNER poll, which is the surface that had nothing to say about this
// at all. `alive:false` above is the steward's reduced question ("may I deliver"); it cannot tell a
// pane that is GONE from a pane that is alive with no agent behind it, and only the second one is
// silent — it accepts keystrokes and executes them. That distinction is the fact this names, and it
// is claimed for every harness, so the CLAUDE path owes the proof as much as the foreign one does
// (fleet-e2e-harness.ts branch 6 makes the same assertion under FLEET_CMD=harn).
interface PollSlot { id: number; agent: string | null }
let ownerAgent: string | null | undefined;
for (let i = 0; i < 60; i++) {
  ownerAgent = ((await (await get("/api/sessions")).json()) as { slots: PollSlot[] })
    .slots.find((x) => x.id === 1)?.agent;
  if (ownerAgent === "no-agent") break;
  await Bun.sleep(250);
}
check("owner poll: a claude pane that outlived its agent reads agent=no-agent, not no-pane",
  ownerAgent === "no-agent", String(ownerAgent));

// cache-for-reads / fresh-for-gates: build a pane whose CACHED reading says alive but whose
// claude is actually dead, and prove the delivery gate refuses anyway — i.e. the gate ran a
// FRESH claudeAlive, never the ≤10s-stale tickGit cache (a stale-cache gate would type into
// the bare shell). The tickGit interval can race the kill→send window and flip the cache
// early; that only weakens the PROOF (not the gate), so retry the setup up to 3 times.
let gateRefused = false, freshProven = false, sigDetail = "";
for (let attempt = 0; attempt < 3 && !freshProven; attempt++) {
  // (re)establish a LIVE claude in slot 3. rm before write: slot 2's claude-hang (branch 2) is
  // still running and still mapping this exact inode — an in-place overwrite invalidates its
  // code-signature (AMFI, Apple Silicon) and kills ITS process on its next exec, which is exactly
  // the mechanism that made this branch fail 4/4 on a verified-quiet machine and pass 0/2 on
  // unmodified HEAD (where branch 3 used to run — and itself swap+kill — in between): a fresh
  // inode per swap, never a mutation of the one branch 2's pane still has mapped.
  await Bun.$`rm -f ${FAKEBIN}/claude`.quiet();
  await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-hang`).arrayBuffer());
  await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
  if (attempt === 0) {
    const o3 = await post("/api/slots/3/open", { cwd: "~" });
    check("open slot 3 (fresh-gate branch)", o3.ok);
  } else {
    await tmuxOut("kill-session", "-t", "s3"); // self-heal respawns with the hang binary
  }
  let aliveCached = false;
  for (let i = 0; i < 80; i++) { // respawn + one tickGit (≤10s) + margin
    if ((await sigFor(3))?.alive === true) { aliveCached = true; break; }
    await Bun.sleep(250);
  }
  if (!aliveCached) { sigDetail = `attempt ${attempt}: cache never read alive`; continue; }
  // kill claude NOW: exit-variant binary + pane kill → self-heal respawns straight to a bare
  // shell. No tick has run yet, so the cache still says alive — exactly the stale-cache race
  // the docs name ("a pane that died 9s ago"). rm before write — same inode-mapping mechanism
  // as above; slot 2's claude-hang is still running and still mapping this path.
  await Bun.$`rm -f ${FAKEBIN}/claude`.quiet();
  await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-exit`).arrayBuffer());
  await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
  await tmuxOut("kill-session", "-t", "s3");
  for (let i = 0; i < 40; i++) { // wait for the self-heal respawn so a real (bare-shell) pane exists
    if ((await tmuxOut("has-session", "-t", "s3")).code === 0) break;
    await Bun.sleep(100);
  }
  await Bun.sleep(800); // let the exit-variant claude die and the pane settle at the shell
  const cacheBefore = (await sigFor(3))?.alive;
  const r = await stewPost("/api/steward/send", { slot: 3, kind: "continue_nudge", ref: "continue" });
  const rj = (await r.json()) as { error?: string };
  const cacheAfter = (await sigFor(3))?.alive;
  gateRefused = r.status === 409 && (rj.error ?? "").includes("no agent running");
  sigDetail = `attempt ${attempt}: status=${r.status} error=${rj.error} cacheBefore=${cacheBefore} cacheAfter=${cacheAfter}`;
  if (!gateRefused) break; // a delivered send is a real gate failure — never retry past it
  // proof condition: the cache read alive on BOTH sides of the refusal, so the refusing
  // check cannot have come from the cache
  if (cacheBefore === true && cacheAfter === true) freshProven = true;
}
check("fresh-for-gates: a steward send into a cache-alive-but-actually-dead pane is refused (409 not-alive)", gateRefused, sigDetail);
check("the refusal fired WHILE the cache still read alive — the gate reads FRESH, never the cache", freshProven, sigDetail);
const cap3 = await tmuxOut("capture-pane", "-t", "s3", "-p");
check("nothing was typed into the bare shell despite the stale cache", !cap3.out.includes("[steward]"), cap3.out.slice(-120));

// --- Slot.model reaches the spawn string: FLEET_CMD here IS `claude` (the fake binary),
// so slotCmd must append `--model <m>` to the pane command — the main suite (FLEET_CMD=true)
// can never prove this, the append is claude-gated by design. ---
// the probe deliberately carries the 1M-variant bracket suffix: [ ] are glob metacharacters and
// tmux runs the pane command through default-shell (/bin/zsh on the live socket), which ABORTS on
// an unmatched glob — so this asserts the SHELL-QUOTED form, the thing that keeps a 1M-model pane
// from dying at spawn. An unquoted regression here is invisible to tsc and fatal in production.
const oM = await post("/api/slots/4/open", { cwd: process.cwd(), model: "gate-model-probe[1m]" });
check("open slot 4 with a per-slot model", oM.ok, String(oM.status));
let startCmd = "";
for (let i = 0; i < 40; i++) {
  if ((await tmuxOut("has-session", "-t", "s4")).code === 0) {
    startCmd = (await tmuxOut("display-message", "-p", "-t", "s4", "#{pane_start_command}")).out;
    if (startCmd.includes("claude")) break;
  }
  await Bun.sleep(250);
}
check("the pane spawn command carries the per-slot model, shell-quoted",
  startCmd.includes("--model 'gate-model-probe[1m]'"), startCmd.slice(-160));
await tmuxOut("kill-session", "-t", "s4");

// --- and with NO per-slot model, slotCmd must inject the fleet's DEFAULT_MODEL — so a session
// never silently inherits the owner's ambient /model default (the bug this closes). FLEET_MODEL
// is pinned EMPTY on every wrapper spawn line (the live srv exports the operator's .env value and a
// gate is its child — measured 2026-09-02, two FAILs here), so the default resolves to the hard-coded claude-opus-5[1m]. ---
const oDef = await post("/api/slots/4/open", { cwd: process.cwd() });
check("reopen slot 4 with no per-slot model", oDef.ok, String(oDef.status));
let startCmdDef = "";
for (let i = 0; i < 40; i++) {
  if ((await tmuxOut("has-session", "-t", "s4")).code === 0) {
    startCmdDef = (await tmuxOut("display-message", "-p", "-t", "s4", "#{pane_start_command}")).out;
    if (startCmdDef.includes("claude")) break;
  }
  await Bun.sleep(250);
}
// the model name is IMPORTED, not spelled again: this assertion is about the SHELL FORM (the
// single quotes zsh needs for the [1m] suffix, without which every spawn dies), and a private copy
// of the name would have kept passing after server.ts's default moved on.
check("the pane spawn command injects the default model when the slot pins none",
  startCmdDef.includes(`--model '${FLEET_DEFAULT_MODEL}'`), startCmdDef.slice(-160));
await tmuxOut("kill-session", "-t", "s4");

// --- Slot.effort reaches the spawn string too, and this is the ONLY place it can be proven: the
// append is claude-gated exactly like --model, so the main suite (FLEET_CMD=true) never sees it and
// the API-level rows in e2e/security.ts prove only that the request was accepted, never that the
// flag arrived. `claude --help` states the flag: `--effort <level>` over (low, medium, high, xhigh,
// max). The row that would otherwise rot is the NO-EFFORT one: a slot that pins no level must still
// spawn the command line it spawned before this adapter learned the flag, byte for byte. ---
async function claudePaneCmd(target: string): Promise<string> {
  let cmd = "";
  for (let i = 0; i < 40; i++) {
    if ((await tmuxOut("has-session", "-t", target)).code === 0) {
      cmd = (await tmuxOut("display-message", "-p", "-t", target, "#{pane_start_command}")).out;
      if (cmd.includes("claude")) break;
    }
    await Bun.sleep(250);
  }
  return cmd;
}
const oE = await post("/api/slots/4/open", { cwd: process.cwd(), effort: "high" });
const oEJ = oE.ok ? { error: "" } : ((await oE.json()) as { error?: string });
// the FOURTH done-statement, asserted as its own row rather than folded into the command-line one:
// this route answered `harness claude takes no effort` until 2026-08-21, and a regression there
// would read as "the pane has no --effort" — a wrong diagnosis of a right symptom.
check("open slot 4 with an effort level — the default adapter no longer answers 'takes no effort'",
  oE.ok && !/takes no effort/.test(oEJ.error ?? ""), `${oE.status} ${JSON.stringify(oEJ)}`);
const cmdE = await claudePaneCmd("s4");
// THE PROBE'S OWN PRECONDITION, failing as ITSELF: with no pane (or a pane that never carried the
// claude line) the assertion below would report "no --effort" while nothing was ever measured.
check("effort probe precondition: slot 4's pane exists and carries the claude line",
  cmdE.includes("claude"), cmdE.slice(-160) || "no pane command");
check("the pane spawn command carries the per-slot effort, shell-quoted",
  cmdE.includes("--effort 'high'"), cmdE.slice(-160));
await tmuxOut("kill-session", "-t", "s4");

// ...and with NO effort the line must carry no flag at all — the absence is the contract for every
// slot that pins none, and it is what "byte-identical to before" means here.
const oNE = await post("/api/slots/4/open", { cwd: process.cwd() });
check("reopen slot 4 with no effort", oNE.ok, String(oNE.status));
const cmdNE = await claudePaneCmd("s4");
check("effort probe precondition: the no-effort pane exists and carries the claude line",
  cmdNE.includes("claude"), cmdNE.slice(-160) || "no pane command");
check("a slot that pins no effort spawns a command line without --effort at all",
  !cmdNE.includes("--effort"), cmdNE.slice(-160));
await tmuxOut("kill-session", "-t", "s4");

// ...and a level outside the declared five never becomes a command line. The error TEXT is part of
// the assertion: a bare 400 could come from the cwd or capacity checks and would not prove effortOf
// judged it. `xhigh ` with a trailing space is a member-plus-one-byte — a `startsWith` or a regex
// where a set membership belongs would let it through, and it would land inside the quotes.
// The five are SPELLED OUT here rather than imported from the catalogue on purpose, and this is the
// opposite decision from the model rows above for a reason: there the assertion was about the shell
// FORM and a private copy of the name would have rotted. Here the set itself is the claim — it is
// `claude --help`'s own list — so a server-side edit to it must fail this row and be re-measured
// against the binary, not silently ratified by a test that reads its answer from the thing it tests.
for (const bad of ["ultra", "HIGH", "xhigh ", "high; id"]) {
  const r = await post("/api/slots/5/open", { cwd: process.cwd(), effort: bad });
  const rj = (await r.json()) as { error?: string };
  check(`the default adapter rejects the effort ${JSON.stringify(bad)} and names the five levels (400)`,
    r.status === 400 && rj.error === "bad effort (one of: low, medium, high, xhigh, max)",
    `${r.status} ${JSON.stringify(rj)}`);
}

// --- THE COUNTER-PROOF for the harness phase (phase 2, fleet-e2e-harness.ts): a claude fleet must
// keep REJECTING the foreign model shapes that phase accepts. This is the half that a widened
// shared MODEL_RE would silently break, and it can only be asserted where BASE_CMD is claude — i.e.
// here. Each of the three characters below is one the foreign charset admits: `/` (provider/id),
// `:` (thinking suffix) and `*` (a glob, which zsh would abort the pane on if it ever escaped a
// quote). A 200 on any of them means the two charsets have collapsed into one. ---
for (const bad of ["anthropic/claude-sonnet-5", "sonnet:high", "*sonnet*"]) {
  const r = await post("/api/slots/5/open", { cwd: process.cwd(), model: bad });
  check(`claude fleet rejects the foreign model shape ${bad} (400)`, r.status === 400, String(r.status));
}
// ...and the SAME counter-proof for ▸ start, which takes the same {harness, model, effort}
// choices the open/lane routes take. It is asserted separately rather than assumed from the rows
// above: the dispatch route reads the body at its own site, so a fourth spawn path that validated
// against one widened charset would pass every check up to here. The refusal must also be the
// MODEL's — a task with no repo would 400 for a different reason and read like a pass.
{
  const cT = await post("/api/tasks", { text: "dispatch-model-charset-counterproof", queue: false });
  const cId = ((await cT.json()) as { task?: { id: string } }).task?.id ?? "";
  check("queue a task for the dispatch-route charset counter-proof", !!cId, String(cT.status));
  for (const bad of ["anthropic/claude-sonnet-5", "sonnet:high", "*sonnet*"]) {
    const r = await post(`/api/tasks/${cId}/dispatch`, { model: bad });
    const rj = (await r.json()) as { error?: string };
    check(`claude fleet rejects the foreign model shape ${bad} at ▸ start too (400, bad model)`,
      r.status === 400 && /bad model/.test(rj.error ?? ""), `${r.status} ${JSON.stringify(rj)}`);
  }
  if (cId) await post(`/api/tasks/${cId}/delete`, {});
}

// --- branch 6: dispatcher POST-spawn re-check (server.ts tickDispatch, the fresh claudeAlive
// gate after the 4s boot sleep). This is the highest-blast branch: the dispatcher spawns a lane
// from FLEET_DISPATCH_REPO and, once claude is up, TYPES the (externally-sourced) task text into
// the pane. If claude failed to boot the pane is a bare shell, so that text would EXECUTE as
// commands — the post-spawn gate is the only thing that stops it. The main suite can never test
// this (FLEET_CMD=true short-circuits claudeAlive to a constant true). Here the fake `claude` is
// the immediate-exit variant, so every dispatched lane lands on a bare shell → the gate must
// requeue the task ("dispatch held (…) — requeued") and NOTHING may reach the pane. ---
// rm before write — same inode-mapping mechanism as above; slot 2's claude-hang (branch 2) is
// never killed in this suite and is still running, still mapping this path.
await Bun.$`rm -f ${FAKEBIN}/claude`.quiet();
await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-exit`).arrayBuffer());
await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
interface DispSlot { id: number; cwd: string | null; worktree: { branch: string } | null }
interface DispSess { slots: DispSlot[]; tasks: { id: string; status: string; note?: string | null }[] }
const dispSess = async (): Promise<DispSess> => (await (await get("/api/sessions")).json()) as DispSess;
const dispTask = async (id: string) => (await dispSess()).tasks.find((t) => t.id === id);
// slots with a worktree BEFORE we enable the dispatcher — anything new is a lane the dispatcher spawned
const lanesBefore = new Set((await dispSess()).slots.filter((s) => s.worktree).map((s) => s.id));

const dOn = await post("/api/dispatch", { on: true });
check("dispatcher enabled (FLEET_DISPATCH_REPO set in the gate harness)", dOn.ok, String(dOn.status));
const dispMarker = "dispatch-must-not-reach-the-bare-shell";
const dTaskRes = await post("/api/tasks", { text: dispMarker, queue: true });
const dTaskId = ((await dTaskRes.json()) as { task?: { id: string } }).task?.id ?? "";
check("queue a dispatch task", dTaskRes.ok && !!dTaskId);

// wait for one tick to spawn a lane (8s interval) + the 4s boot sleep + the post gate + margin
let dispHeld = false, laneSlot = -1, dNote = "";
for (let i = 0; i < 120; i++) { // ~36s ceiling
  const sess = await dispSess();
  const lane = sess.slots.find((s) => s.worktree && !lanesBefore.has(s.id));
  if (lane) laneSlot = lane.id;
  const t = sess.tasks.find((x) => x.id === dTaskId);
  dNote = t?.note ?? "";
  // the post-spawn gate requeues the task: status back to "queued" with the gate's note
  if (t?.status === "queued" && dNote.includes("dispatch held") && dNote.includes("requeued")) { dispHeld = true; break; }
  await Bun.sleep(300);
}
// stop the dispatcher immediately so it doesn't keep spawning lanes up to the cap while we assert
await post("/api/dispatch", { on: false });
check("dispatcher post-spawn gate requeues the task when the fresh claude died (dispatch held … requeued)",
  dispHeld, `note=${JSON.stringify(dNote)} laneSlot=${laneSlot}`);
check("the dispatcher actually spawned a lane (non-tautology: the gate fired AFTER spawn, not before)",
  laneSlot > 0, `laneSlot=${laneSlot}`);
// the whole point: the externally-sourced task text NEVER reached the bare-shell pane
const capDisp = laneSlot > 0 ? await tmuxOut("capture-pane", "-t", `s${laneSlot}`, "-p") : { out: "", code: 1 };
check("dispatch post-spawn gate: the task text never reached the bare shell",
  laneSlot > 0 && !capDisp.out.includes(dispMarker), capDisp.out.slice(-160));
// teardown: kill any lane the dispatcher spawned (worktrees stay on disk in $DIR, torn down by the wrapper)
for (const s of (await dispSess()).slots) if (s.worktree && !lanesBefore.has(s.id)) await tmuxOut("kill-session", "-t", `s${s.id}`);

// --- branch 6b: the MANUAL start route (POST /api/tasks/:id/dispatch) shares the same
// post-spawn gate. An attended owner click relaxes the AUTOMATION stops (master stop, quiet
// hours) — but NEVER the alive gate: the dead-claude lane must requeue the task and the text
// must never reach the bare shell, exactly like the tick's branch 6 above. The dispatcher is
// OFF here (posted off above), which is itself half the contract: the button is tick-independent. ---
{
  const mdMarker = `${dispMarker}-manual`;
  const mdT = (await (await post("/api/tasks", { text: mdMarker, queue: false })).json()) as { task?: { id: string } };
  const mdId = mdT.task?.id ?? "";
  const mdRes = await post(`/api/tasks/${mdId}/dispatch`, {});
  const mdJ = (await mdRes.json()) as { ok?: boolean; slot?: number };
  check("manual dispatch spawns a lane with the auto dispatcher OFF (the button is tick-independent)",
    mdRes.ok && mdJ.ok === true && typeof mdJ.slot === "number", `${mdRes.status} ${JSON.stringify(mdJ)}`);
  let mdHeld = false;
  let mdNote = "";
  for (let i = 0; i < 100; i++) { // 4s boot + gate + margin (~30s ceiling)
    const t = (await dispSess()).tasks.find((x) => x.id === mdId);
    mdNote = t?.note ?? "";
    if (t?.status === "queued" && mdNote.includes("dispatch held") && mdNote.includes("requeued")) { mdHeld = true; break; }
    await Bun.sleep(300);
  }
  check("manual dispatch post-spawn gate requeues when the fresh claude died — owner act relaxes automation stops, never aliveness",
    mdHeld, `note=${JSON.stringify(mdNote)}`);
  const mdCap = typeof mdJ.slot === "number" ? await tmuxOut("capture-pane", "-t", `s${mdJ.slot}`, "-p") : { out: "", code: 1 };
  check("manual dispatch: the task text never reached the bare shell",
    typeof mdJ.slot === "number" && !mdCap.out.includes(dispMarker), mdCap.out.slice(-160));
  if (typeof mdJ.slot === "number") await tmuxOut("kill-session", "-t", `s${mdJ.slot}`);
  await post(`/api/tasks/${mdId}/delete`, {});
}

// --- the heal REASON writer (server.ts ensureSlot → audit self_heal_recreate). Only this harness
// can tell the two causes apart: under FLEET_CMD=true (the main suite) s.sessionId is never pinned
// at all, so both branches would answer "no-session" and the check would pass for the wrong reason.
// Here FLEET_CMD is a real `claude`, so the pin IS written — and the same slot yields
//   first spawn  → nothing was ever pinned (openSlot sets sessionId=null, then ensureSlot) → no-session
//   after a kill → a pin exists, its transcript never did (the fake claude writes none) → no-transcript
// which is exactly the pair the classification collapsed when it read s.sessionId AFTER the spawn
// block reassigned it (b7d449a0). Regression-shaped on purpose: with that bug the FIRST check goes
// red, because the always-truthy candidate made no-session unreachable. ---
{
  const healDetails = (slot: number): string[] => {
    try {
      return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
        .map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
        .filter((r): r is Record<string, unknown> => !!r && r.event === "self_heal_recreate" && r.slot === slot)
        .map((r) => String(r.detail ?? ""));
    } catch { return []; }
  };
  // DELTA off a baseline, never an absolute count: the dispatcher branch above spawns lanes into
  // whatever slot is free and kills them again, so this id may legitimately carry earlier rows.
  const HEAL_SLOT = 6;
  const before = healDetails(HEAL_SLOT).length;
  const hOpen = await post(`/api/slots/${HEAL_SLOT}/open`, { cwd: "~" });
  check("heal-reason: open a fresh slot under a real claude", hOpen.ok,
    JSON.stringify(await hOpen.clone().json().catch(() => null)));
  await Bun.sleep(1500);
  const afterOpen = healDetails(HEAL_SLOT).slice(before);
  check("heal-reason: a first spawn was never pinned → created:no-session",
    afterOpen.length === 1 && afterOpen[0] === "created:no-session", JSON.stringify(afterOpen));
  // kill the pane: the self-heal loop rebuilds it, and NOW a sessionId is pinned while the fake
  // claude has written no transcript for it
  await tmuxOut("kill-session", "-t", `s${HEAL_SLOT}`);
  let afterHeal: string[] = [];
  for (let i = 0; i < 40; i++) { // the 2s self-heal tick, polled rather than slept-through
    afterHeal = healDetails(HEAL_SLOT).slice(before);
    if (afterHeal.length >= 2) break;
    await Bun.sleep(250);
  }
  check("heal-reason: a heal with a pin but no transcript → created:no-transcript",
    afterHeal.length === 2 && afterHeal[1] === "created:no-transcript", JSON.stringify(afterHeal));
  check("heal-reason: the two causes are distinguishable, not one collapsed bucket",
    new Set(afterHeal).size === 2, JSON.stringify(afterHeal));
  await tmuxOut("kill-session", "-t", `s${HEAL_SLOT}`);
}

// --- ↻ the owner-triggered pane restart (POST /api/slots/:id/restart). Only this harness can
// prove the half that carries the whole point: slotCmd pins a session id — and resumes one — ONLY
// when BASE_CMD starts with `claude`, so under the main suite's FLEET_CMD=true there is no pin to
// preserve and no `--resume` to look for (the main suite owns the other half, the boundary against
// killSlot's teardown, in e2e/lanes-lifecycle.ts). BOTH branches of the route's `resumed` field are
// checked here, because the negative one is the one that must never be dressed up as success: the
// owner reaches for this button exactly when the conversation already looks wrong. ---
{
  const RS_SLOT = 7;
  const pinOf = (): string | null => {
    try {
      const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { sessionId?: string | null }> };
      return st.slots?.[String(RS_SLOT)]?.sessionId ?? null;
    } catch { return null; }
  };
  // the pane's OWN command line, not our reconstruction of it — same source as the model-pin
  // checks above. Retried, because tmux can answer before the new session is fully mapped.
  const startCmdOf = async (): Promise<string> => {
    let cmd = "";
    for (let i = 0; i < 40; i++) {
      cmd = (await tmuxOut("display-message", "-p", "-t", `s${RS_SLOT}`, "#{pane_start_command}")).out;
      if (cmd.includes("claude")) break;
      await Bun.sleep(250);
    }
    return cmd;
  };

  // no pre-kill: openSlot recycles an occupied slot itself, so this is deterministic whichever
  // slot the dispatcher branch above happened to roam into.
  const rsOpen = await post(`/api/slots/${RS_SLOT}/open`, { cwd: process.cwd() });
  check("↻ restart: open a slot under a real claude", rsOpen.ok, String(rsOpen.status));
  let pin0: string | null = null;
  for (let i = 0; i < 40; i++) { pin0 = pinOf(); if (pin0) break; await Bun.sleep(250); }
  const cmd0 = await startCmdOf();
  check("↻ restart: a fresh slot is pinned with --session-id, not resumed",
    !!pin0 && cmd0.includes(`--session-id ${pin0}`), `pin=${pin0} cmd=${cmd0.slice(-160)}`);
  // a plain (non-lane) session keeps its ambient MCPs: the text-lane profile is a LANE property only
  check("a plain slot under a real claude spawns WITHOUT --strict-mcp-config (MAIN/plain sessions keep ambient MCPs)",
    cmd0.includes("claude") && !cmd0.includes("--strict-mcp-config"), cmd0.slice(-160));

  // (a) a pin whose transcript never existed — the fake claude writes none. The conversation is
  // genuinely gone, so the route must SAY so and the pane must start fresh.
  const rA = await post(`/api/slots/${RS_SLOT}/restart`, {});
  const rAJ = (await rA.json()) as { ok?: boolean; resumed?: boolean };
  const cmdA = await startCmdOf();
  check("↻ restart with no transcript reports resumed:false and respawns fresh — never a claimed resume",
    rA.ok && rAJ.resumed === false && !cmdA.includes("--resume") && cmdA.includes("--session-id"),
    `${JSON.stringify(rAJ)} ${cmdA.slice(-160)}`);
  const pinA = pinOf();
  check("↻ restart with no transcript mints a NEW pin — the old id names a conversation that is not there",
    !!pinA && pinA !== pin0, `${pin0} → ${pinA}`);

  // (b) the case the verb exists for. Claude Code can switch conversation IN-PROCESS: the pane's
  // argv goes on naming the pinned session while a different transcript is written, and Escape does
  // not undo it (measured 2026-08-06). Nothing outside the pane can put it back — only a respawn
  // against the pinned id. A transcript beside the pin is the one condition ensureSlot needs.
  // Same throwaway-project-dir pattern the main suite already uses (e2e/restart.ts): the slug is
  // derived from this instance's own temp cwd, and the file is removed below.
  const trDir = `${process.env.HOME}/.claude/projects/${process.cwd().replace(/[^a-zA-Z0-9]/g, "-")}`;
  const trFile = `${trDir}/${pinA}.jsonl`;
  await Bun.write(trFile, `${JSON.stringify({ type: "user", timestamp: "2026-08-06T09:00:00Z" })}\n`);
  const rB = await post(`/api/slots/${RS_SLOT}/restart`, {});
  const rBJ = (await rB.json()) as { ok?: boolean; resumed?: boolean };
  const cmdB = await startCmdOf();
  check("↻ restart resumes the pinned conversation — `--resume <id>` in the pane's own command line",
    rB.ok && rBJ.resumed === true && cmdB.includes(`--resume ${pinA}`) && !cmdB.includes("--session-id"),
    `${JSON.stringify(rBJ)} ${cmdB.slice(-160)}`);
  check("↻ restart keeps the pin it resumed — same conversation, same transcript",
    pinOf() === pinA, `${pinA} → ${pinOf()}`);
  // the model rides the respawn too, still shell-quoted: a resumed pane must be the same session
  // AND the same model, or the conversation comes back somewhere it was never held
  check("↻ restart respawns with the slot's model, still shell-quoted",
    cmdB.includes(`--model '${FLEET_DEFAULT_MODEL}'`), cmdB.slice(-160));

  // the restart is trailed under its own event, never as a self-heal — slotstats divides
  // resumed/heals to measure the durability promise, and an owner-triggered rebuild that resumes
  // by construction is no evidence for it (server/audit-log.ts, the slot_restart comment on AuditEvent).
  let rsRows: string[] = [];
  for (let i = 0; i < 40; i++) {
    rsRows = readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
      .map((l) => { try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; } })
      .filter((r): r is Record<string, unknown> => !!r && r.event === "slot_restart" && r.slot === RS_SLOT)
      .map((r) => String(r.detail ?? ""));
    if (rsRows.length >= 2) break;
    await Bun.sleep(250);
  }
  check("↻ restart trails BOTH outcomes under slot_restart, with the reason the heal path uses",
    rsRows.length === 2 && rsRows[0] === "created:no-transcript" && rsRows[1] === "resumed", JSON.stringify(rsRows));

  // (c) the record is what a restart spawns from — so rewriting it (POST /api/slots/:id/model)
  // must change the NEXT spawn line and nothing before it. This is the only suite that can see
  // it: both flags are claude-gated in agentCmd. The bracket suffix rides along so the rewritten
  // model is proven in its shell-quoted form, same reason as the model-pin checks above; the
  // pane is otherwise untouched (same pin, still `--resume`), because the route promises no respawn.
  const cmdBeforeRewrite = await startCmdOf();
  const rw = await post(`/api/slots/${RS_SLOT}/model`, { model: "gate-remodel[1m]", effort: "xhigh" });
  check("POST /api/slots/:id/model rewrites a live slot's record (200)", rw.ok, String(rw.status));
  check("...and touches no pane: the running command line is byte-identical after the rewrite",
    (await startCmdOf()) === cmdBeforeRewrite, cmdBeforeRewrite.slice(-160));
  const rC = await post(`/api/slots/${RS_SLOT}/restart`, {});
  const rCJ = (await rC.json()) as { ok?: boolean; resumed?: boolean };
  const cmdC = await startCmdOf();
  check("↻ restart after the rewrite spawns with the NEW model, shell-quoted, and the new --effort",
    rC.ok && cmdC.includes("--model 'gate-remodel[1m]'") && cmdC.includes("--effort 'xhigh'")
      && !cmdC.includes(`--model '${FLEET_DEFAULT_MODEL}'`), `${JSON.stringify(rCJ)} ${cmdC.slice(-160)}`);
  check("↻ restart after the rewrite still resumes the same pinned conversation — model changed, transcript did not",
    rCJ.resumed === true && cmdC.includes(`--resume ${pinA}`) && pinOf() === pinA, `${JSON.stringify(rCJ)} ${cmdC.slice(-160)}`);

  await post(`/api/slots/${RS_SLOT}/kill`, {});
  // clean up after ourselves in the one place this suite writes OUTSIDE its instance dir. rmdir,
  // never a recursive rm: it refuses a non-empty directory, so this can only ever remove the
  // throwaway project folder we caused and never anything that was already there.
  rmSync(trFile, { force: true });
  try { rmdirSync(trDir); } catch { /* not ours to empty — leave it */ }
}

// --- THE LANE MCP PROFILE (Slot.browser, 2026-09-14). A lane that does not ask for a browser starts
// claude with --strict-mcp-config (zero MCP servers, so no Playwright children — measured on the real
// binary: docs/harness-adapter.md); a lane that asks keeps the ambient set. Only this suite can see it:
// the flag is on agentCmd's claude branch. Every row reads the PANE's own command line, never the 200,
// and the profile must survive the respawn a lane actually meets — a ↻ restart that RESUMES. ---
{
  const laneRepo = `${process.cwd()}/dispatchrepo`;
  const paneCmd = async (slot: number): Promise<string> => {
    let cmd = "";
    for (let i = 0; i < 40; i++) {
      cmd = (await tmuxOut("display-message", "-p", "-t", `s${slot}`, "#{pane_start_command}")).out;
      if (cmd.includes("claude")) break;
      await Bun.sleep(250);
    }
    return cmd;
  };
  type StateRow = { sessionId?: string | null; browser?: unknown };
  const stateSlot = (slot: number): StateRow | null => {
    try {
      return (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { slots?: Record<string, StateRow> })
        .slots?.[String(slot)] ?? null;
    } catch { return null; }
  };
  const sessBrowser = async (slot: number): Promise<unknown> =>
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; browser?: unknown }[] })
      .slots.find((x) => x.id === slot)?.browser;

  // (1) the default: a text lane, and its ↻ restart that resumes
  const tRes = await post("/api/lanes", { repo: laneRepo });
  const tJ = (await tRes.json()) as { slot?: number; cwd?: string; error?: string };
  check("MCP profile: POST /api/lanes opens a default (text) lane under a real claude", tRes.ok && !!tJ.slot, JSON.stringify(tJ));
  if (tJ.slot && tJ.cwd) {
    const T = tJ.slot;
    const tCmd = await paneCmd(T);
    // the probe's own precondition, failing as ITSELF: no claude line means nothing was measured
    check("MCP profile precondition: the text lane's pane carries the claude line", tCmd.includes("claude"), tCmd.slice(-160) || "no pane command");
    check("a lane with no browser need spawns claude with --strict-mcp-config (no ambient MCP, no Playwright children)",
      tCmd.includes("--strict-mcp-config"), tCmd.slice(-200));
    const tView = await sessBrowser(T);
    check("the text lane's session row carries no browser field", tView === undefined, JSON.stringify(tView));
    let pinT: string | null = null;
    for (let i = 0; i < 40; i++) { pinT = stateSlot(T)?.sessionId ?? null; if (pinT) break; await Bun.sleep(250); }
    const tDir = `${process.env.HOME}/.claude/projects/${tJ.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const tFile = `${tDir}/${pinT}.jsonl`;
    if (pinT) await Bun.write(tFile, `${JSON.stringify({ type: "user", timestamp: "2026-09-14T09:00:00Z" })}\n`);
    const tR = await post(`/api/slots/${T}/restart`, {});
    const tRJ = (await tR.json()) as { resumed?: boolean };
    const tRCmd = await paneCmd(T);
    check("MCP profile precondition: the text lane's ↻ restart really resumed its pinned conversation",
      !!pinT && tR.ok && tRJ.resumed === true && tRCmd.includes(`--resume ${pinT}`), `${JSON.stringify(tRJ)} ${tRCmd.slice(-160)}`);
    check("a RESUMED text lane keeps its profile — --strict-mcp-config on the --resume line",
      tRCmd.includes("--strict-mcp-config"), tRCmd.slice(-200));
    await post(`/api/slots/${T}/kill`, {});
    rmSync(tFile, { force: true });
    try { rmdirSync(tDir); } catch { /* not ours to empty — leave it */ }
  }

  // (2) the explicit browser lane: ambient MCPs, the profile persisted and carried through a respawn
  const bRes = await post("/api/lanes", { repo: laneRepo, browser: true });
  const bJ = (await bRes.json()) as { slot?: number; error?: string };
  check("MCP profile: POST /api/lanes accepts browser:true for the claude adapter", bRes.ok && !!bJ.slot, JSON.stringify(bJ));
  if (bJ.slot) {
    const B = bJ.slot;
    const bCmd = await paneCmd(B);
    check("MCP profile precondition: the browser lane's pane carries the claude line", bCmd.includes("claude"), bCmd.slice(-160) || "no pane command");
    check("a lane that names browser:true spawns claude WITHOUT --strict-mcp-config (ambient MCPs, Playwright included)",
      !bCmd.includes("--strict-mcp-config"), bCmd.slice(-200));
    check("the browser lane's profile is persisted on the slot (fleet.json browser:true)", stateSlot(B)?.browser === true,
      JSON.stringify(stateSlot(B)?.browser));
    const bView = await sessBrowser(B);
    check("the browser lane's session row says browser:true", bView === true, JSON.stringify(bView));
    const bR = await post(`/api/slots/${B}/restart`, {});
    const bRCmd = await paneCmd(B);
    check("a ↻ restarted browser lane keeps its profile — still no --strict-mcp-config",
      bR.ok && bRCmd.includes("claude") && !bRCmd.includes("--strict-mcp-config"), bRCmd.slice(-200));
    await post(`/api/slots/${B}/kill`, {});
  }

  // (3) the task door: a row that stores browser:true starts its lane through ▸ start as a browser lane
  const qRes = await post("/api/tasks", { text: "mcp-profile-browser-row", queue: false, browser: true });
  const qJ = (await qRes.json()) as { task?: { id: string; spawn?: { browser?: unknown } } };
  check("POST /api/tasks persists browser:true on the row's spawn choice", qRes.ok && qJ.task?.spawn?.browser === true,
    JSON.stringify(qJ.task?.spawn));
  if (qJ.task) {
    const qd = await post(`/api/tasks/${qJ.task.id}/dispatch`, {});
    const qdJ = (await qd.json()) as { slot?: number; error?: string };
    const qCmd = typeof qdJ.slot === "number" ? await paneCmd(qdJ.slot) : "";
    check("▸ start of a browser row spawns a lane WITHOUT --strict-mcp-config (the row's choice reaches the pane)",
      qd.ok && qCmd.includes("claude") && !qCmd.includes("--strict-mcp-config"), `${qd.status} ${JSON.stringify(qdJ)} ${qCmd.slice(-160)}`);
    if (typeof qdJ.slot === "number") await post(`/api/slots/${qdJ.slot}/kill`, {});
    await post(`/api/tasks/${qJ.task.id}/delete`, {});
  }
  // ...and a body `false` wins per field over the row, exactly like harness/model/effort. A SECOND row,
  // not a re-start of the first: that one's post-spawn tail may still be running against its lane.
  const q2Res = await post("/api/tasks", { text: "mcp-profile-browser-row-overridden", queue: false, browser: true });
  const q2J = (await q2Res.json()) as { task?: { id: string } };
  check("queue a second browser row for the body-override counter-proof", q2Res.ok && !!q2J.task, String(q2Res.status));
  if (q2J.task) {
    const qd2 = await post(`/api/tasks/${q2J.task.id}/dispatch`, { browser: false });
    const qd2J = (await qd2.json()) as { slot?: number; error?: string };
    const q2Cmd = typeof qd2J.slot === "number" ? await paneCmd(qd2J.slot) : "";
    check("▸ start with body browser:false over a browser row spawns a TEXT lane (body wins per field)",
      qd2.ok && q2Cmd.includes("--strict-mcp-config"), `${qd2.status} ${JSON.stringify(qd2J)} ${q2Cmd.slice(-160)}`);
    if (typeof qd2J.slot === "number") await post(`/api/slots/${qd2J.slot}/kill`, {});
    await post(`/api/tasks/${q2J.task.id}/delete`, {});
  }
}

// --- 💤 SLEEP / WAKE under a real pin (server.ts#sleepSlot, #wakeSlot). Only this harness pins a
// session id at spawn (FLEET_CMD is a `claude`), so only here can "the SAME conversation comes back"
// be read off the pane's own argv instead of assumed; the main suite (e2e/slots.ts) owns the named
// refusals. In order: (e) a pin without a transcript is refused; (a) a slept pane stays gone across
// three self-heal ticks; (b) the owner wake resumes the pinned id against the same transcript file;
// (c) a scheduled delivery wakes a sleeper and arrives, and a wake whose agent never comes up is NOT
// booked as delivered. Mutation caught: ensureSlot without `if (s.sleeping) return;` fails (a). ---
{
  const MERGE_IDLE_MS = Math.max(500, Number(process.env.FLEET_MERGE_IDLE_MS ?? 3000) | 0); // server.ts twin
  type Row = { id: number; cwd: string | null; lastOutput: number; sleeping?: { sessionId: string } };
  const rowsNow = async (): Promise<Row[]> => ((await (await get("/api/sessions")).json()) as { slots: Row[] }).slots;
  const install = async (variant: "claude-hang" | "claude-exit"): Promise<void> => {
    await Bun.$`rm -f ${FAKEBIN}/claude`.quiet(); // fresh inode — see the fresh-gate branch for why
    await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/${variant}`).arrayBuffer());
    await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
  };
  await install("claude-hang");
  const SL = (await rowsNow()).filter((r) => !r.cwd).map((r) => r.id).reverse()[0] ?? 16;
  const pinOf = (): string | null => {
    try {
      return (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { sessionId?: string | null }> }).slots?.[String(SL)]?.sessionId ?? null;
    } catch { return null; }
  };
  const hasPane = async (): Promise<boolean> => (await tmuxOut("has-session", "-t", `=s${SL}`)).code === 0;
  const startCmd = async (): Promise<string> =>
    (await tmuxOut("display-message", "-p", "-t", `=s${SL}:`, "#{pane_start_command}")).out;
  const settleIdle = async (): Promise<void> => {
    for (let i = 0; i < 100; i++) {
      const row = (await rowsNow()).find((r) => r.id === SL);
      if (row && Date.now() - row.lastOutput > MERGE_IDLE_MS + 300) return;
      await Bun.sleep(100);
    }
  };
  const sleepNow = async (): Promise<{ status: number; body: { reason?: string; sleeping?: { sessionId?: string; transcript?: string } } }> => {
    await settleIdle();
    const r = await post(`/api/slots/${SL}/sleep`, {});
    return { status: r.status, body: (await r.json()) as never };
  };
  const autoResult = async (id: string, budgetMs: number): Promise<string | null> => {
    const until = Date.now() + budgetMs;
    for (;;) {
      const a = ((await (await get("/api/sessions")).json()) as { autos: AutoInfo[] }).autos.find((x) => x.id === id);
      if (a?.lastResult || Date.now() >= until) return a?.lastResult ?? null;
      await Bun.sleep(200);
    }
  };

  const slOpen = await post(`/api/slots/${SL}/open`, { cwd: process.cwd() });
  let pin: string | null = null;
  for (let i = 0; i < 40 && !pin; i++) { pin = pinOf(); if (!pin) await Bun.sleep(250); }
  const up = await awaitPaneComm(`=s${SL}:`, "claude", 8000);
  check("sleep fixture: a plain slot under a resident claude, pinned with --session-id",
    slOpen.ok && !!pin && up.some((c) => c.startsWith("claude")) && (await startCmd()).includes(`--session-id ${pin}`),
    `open=${slOpen.status} pin=${pin} comms=${up.join(",")}`);

  // (e) the fake claude writes no transcript: the pin names nothing on disk
  const e = await sleepNow();
  check("sleep refuses a pinned claude whose transcript is not on disk (no-transcript) and leaves it running",
    e.status === 409 && e.body.reason === "no-transcript" && await hasPane(), JSON.stringify(e));

  const trDir = `${process.env.HOME}/.claude/projects/${process.cwd().replace(/[^a-zA-Z0-9]/g, "-")}`;
  const trFile = `${trDir}/${pin}.jsonl`;
  await Bun.write(trFile, `${JSON.stringify({ type: "user", timestamp: "2026-09-19T12:00:00Z" })}\n`);

  // (a) asleep: gone, and kept gone by the heal loop
  const a = await sleepNow();
  check("sleep puts the pinned claude session down, naming its session id and transcript file",
    a.status === 200 && a.body.sleeping?.sessionId === pin && a.body.sleeping?.transcript === trFile, JSON.stringify(a));
  const goneAt = Date.now();
  let back = false;
  while (Date.now() - goneAt < 3 * 2000 + 700) {
    if (await hasPane()) { back = true; break; }
    await Bun.sleep(150);
  }
  check("(a) the sleeping session's tmux session is gone and the self-heal does NOT recreate it over three ticks",
    !back && pinOf() === pin, `reappeared=${back} pin=${pinOf()}`);

  // (b) owner wake: same id, same transcript, `--resume` in the pane's own argv
  const w = await post(`/api/slots/${SL}/wake`, {});
  const wJ = (await w.json()) as { ok?: boolean; resumed?: boolean | null; sessionId?: string };
  const wArgv = await paneArgv(`=s${SL}:`, "claude");
  check("(b) wake resumes the SAME conversation: resumed:true, the pin unchanged, `--resume <id>` in the resident claude's argv",
    w.ok && wJ.resumed === true && wJ.sessionId === pin && pinOf() === pin
      && wArgv.some((v) => v.includes(`--resume ${pin}`) && !v.includes("--session-id")),
    `${w.status} ${JSON.stringify(wJ)} argv=${wArgv.join(" | ").slice(-200)}`);
  check("(b) ...against the transcript file the sleep named — the file resume reads is the one that was checked",
    a.body.sleeping?.transcript === `${trDir}/${wJ.sessionId}.jsonl`, `${a.body.sleeping?.transcript} vs ${wJ.sessionId}`);

  // (c) a delivery wakes the sleeper and arrives
  const c1 = await sleepNow();
  const marker = "sleep-wake-delivery-marker";
  const auto1 = (await (await post(`/api/slots/${SL}/autos`, { text: marker, inSec: 1, idleSec: 60 })).json()) as { auto?: AutoInfo };
  const r1 = auto1.auto ? await autoResult(auto1.auto.id, 20_000) : null;
  const c1Argv = await paneArgv(`=s${SL}:`, "claude");
  const cap1 = (await tmuxOut("capture-pane", "-p", "-t", `=s${SL}:`)).out;
  check("(c) a scheduled prompt to a sleeping session wakes it, resumes the same id, and is delivered",
    c1.status === 200 && r1 === "sent" && c1Argv.some((v) => v.includes(`--resume ${pin}`)) && cap1.includes(marker),
    `sleep=${c1.status} result=${r1} argv=${c1Argv.join(" | ").slice(-160)} pane=${cap1.slice(-120)}`);

  // (c) counter-proof: the wake spawns a claude that exits at once — the prompt must NOT be booked
  const c2 = await sleepNow();
  await install("claude-exit");
  const marker2 = "sleep-wake-must-not-type-this";
  const auto2 = (await (await post(`/api/slots/${SL}/autos`, { text: marker2, inSec: 1, idleSec: 60 })).json()) as { auto?: AutoInfo };
  const r2 = auto2.auto ? await autoResult(auto2.auto.id, 40_000) : null;
  const cap2 = (await tmuxOut("capture-pane", "-p", "-t", `=s${SL}:`)).out;
  check("(c) a delivery whose wake finds no agent is NOT booked as sent, and nothing reaches the bare shell",
    c2.status === 200 && r2 !== null && r2 !== "sent" && r2.startsWith("skipped") && !cap2.includes(marker2),
    `sleep=${c2.status} result=${r2} pane=${cap2.slice(-120)}`);

  await post(`/api/slots/${SL}/kill`, {});
  rmSync(trFile, { force: true });
  try { rmdirSync(trDir); } catch { /* not ours to empty — leave it */ }
}

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

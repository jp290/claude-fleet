// e2e for the claude-alive gate (server.ts's claudeAlive()) — the ONE path in the whole
// app that must never fire: typing a scheduled prompt into a bare shell, where it would
// EXECUTE as a command instead of landing in a claude conversation.
//
// The main suite (fleet-e2e.ts) can't exercise this: it runs with FLEET_CMD=true, which
// makes claudeAlive() short-circuit `return true` unconditionally (server.ts's own
// `if (!/^claude(\s|$)/.test(BASE_CMD)) return true`) — the pgrep/ps detection logic
// itself has zero coverage under that setup. This harness runs a REAL claude-prefixed
// FLEET_CMD against a compiled stand-in binary literally named `claude` on PATH, so the
// exact same process-tree check the real feature relies on is what's under test.
//
// Run via ./e2e-claude-gate.sh (builds the fake binary, starts an isolated instance,
// invokes this file, tears down). Do not run directly against a live fleet.
// The plumbing below the checks — BASE, the owner token read out of the instance's fleet.json,
// post/get/check/tmuxOut, and the live-fleet refusal this harness used to carry as its own copied
// line — is e2e/harness.ts, the module the main suite's check modules already import. It refuses
// the live socket AND the live port on import, before anything here can act. check() there is also
// the per-check trail's single emit site, so this suite's checks now leave durable rows
// (docs/e2e-trail.md); ./e2e-claude-gate.sh stamps them with FLEET_E2E_SUITE=claude-gate.
import { BASE, check, failures, get, post, results, tmuxOut } from "./e2e/harness";
import { FLEET_DEFAULT_MODEL } from "./src/protocol";
const FAKEBIN = process.env.FAKE_CLAUDE_DIR!;

interface AutoInfo { id: string; slot: number; lastResult: string | null }

// --- branch 1: claude is NOT running (fake binary exits immediately, `exec $SHELL`
// takes over the pane) — the auto must be skipped, and NOTHING may reach the pane ---
const o1 = await post("/api/slots/1/open", { cwd: "~" });
check("open slot 1 (dead-claude branch)", o1.ok, JSON.stringify(await o1.clone().json().catch(() => null)));
await Bun.sleep(1500); // let the fake binary exit and `exec $SHELL` settle
const marker1 = "gate-must-not-type-this";
const a1res = await post("/api/slots/1/autos", { text: marker1, inSec: 1, idleSec: 0 });
const a1 = (await a1res.json()) as { auto: AutoInfo };
check("create auto on dead-claude slot", a1res.ok && !!a1.auto?.id);
await Bun.sleep(7000); // 1s due + one 5s tick + margin, same budget as the main suite's idle-gate check
const cap1 = await tmuxOut("capture-pane", "-t", "s1", "-p");
check("dead-claude gate: marker never reached the pane", !cap1.out.includes(marker1), cap1.out.slice(-120));
const sess1 = (await (await get("/api/sessions")).json()) as { autos: AutoInfo[] };
const a1after = sess1.autos.find((a) => a.id === a1.auto.id);
check("dead-claude gate: lastResult reports the skip", a1after?.lastResult === "skipped — claude not running in pane", a1after?.lastResult ?? "missing");

// --- branch 2: claude IS running (swap the fake binary for a hang variant, open a
// fresh slot so the new pane resolves the new file) — the auto must fire normally ---
await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-hang`).arrayBuffer());
await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
const o2 = await post("/api/slots/2/open", { cwd: "~" });
check("open slot 2 (alive-claude branch)", o2.ok);
await Bun.sleep(1500); // let the fake binary actually start and settle as a pane child
const marker2 = "gate-must-type-this";
const a2res = await post("/api/slots/2/autos", { text: marker2, inSec: 1, idleSec: 0 });
const a2 = (await a2res.json()) as { auto: AutoInfo };
check("create auto on alive-claude slot", a2res.ok && !!a2.auto?.id);
await Bun.sleep(7000);
const cap2 = await tmuxOut("capture-pane", "-t", "s2", "-p");
check("alive-claude gate: marker reached the pane", cap2.out.includes(marker2), cap2.out.slice(-160));
const sess2 = (await (await get("/api/sessions")).json()) as { autos: AutoInfo[] };
const a2after = sess2.autos.find((a) => a.id === a2.auto.id);
check("alive-claude gate: lastResult reports sent", a2after?.lastResult === "sent", a2after?.lastResult ?? "missing");

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

// cache-for-reads / fresh-for-gates: build a pane whose CACHED reading says alive but whose
// claude is actually dead, and prove the delivery gate refuses anyway — i.e. the gate ran a
// FRESH claudeAlive, never the ≤10s-stale tickGit cache (a stale-cache gate would type into
// the bare shell). The tickGit interval can race the kill→send window and flip the cache
// early; that only weakens the PROOF (not the gate), so retry the setup up to 3 times.
let gateRefused = false, freshProven = false, sigDetail = "";
for (let attempt = 0; attempt < 3 && !freshProven; attempt++) {
  // (re)establish a LIVE claude in slot 3
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
  // the docs name ("a pane that died 9s ago").
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
  gateRefused = r.status === 409 && (rj.error ?? "").includes("claude not running");
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
// is unset in this harness, so the default resolves to the hard-coded claude-opus-5[1m]. ---
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

// --- branch 6: dispatcher POST-spawn re-check (server.ts tickDispatch, the fresh claudeAlive
// gate after the 4s boot sleep). This is the highest-blast branch: the dispatcher spawns a lane
// from FLEET_DISPATCH_REPO and, once claude is up, TYPES the (externally-sourced) task text into
// the pane. If claude failed to boot the pane is a bare shell, so that text would EXECUTE as
// commands — the post-spawn gate is the only thing that stops it. The main suite can never test
// this (FLEET_CMD=true short-circuits claudeAlive to a constant true). Here the fake `claude` is
// the immediate-exit variant, so every dispatched lane lands on a bare shell → the gate must
// requeue the task ("dispatch held (…) — requeued") and NOTHING may reach the pane. ---
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

console.log(results.join("\n"));
console.log(failures() ? `\n${failures()} FAILURES` : "\nALL PASS");
process.exit(failures() ? 1 : 0);

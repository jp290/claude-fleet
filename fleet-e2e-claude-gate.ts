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
const IP = "127.0.0.1";
const PORT = Number(process.env.FLEET_PORT ?? 8792);
const SOCK = process.env.FLEET_SOCK ?? "fleetgatetest";
const BASE = `http://${IP}:${PORT}`;
const FAKEBIN = process.env.FAKE_CLAUDE_DIR!;
const results: string[] = [];
let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

async function tmuxOut(...args: string[]) {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const code = await p.exited;
  return { out, code };
}

const state = (await Bun.file(`${import.meta.dir}/fleet.json`).json()) as { token?: string };
const TOKEN = state.token ?? "";
const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
const post = (path: string, body: unknown) => fetch(BASE + path, { method: "POST", headers: H, body: JSON.stringify(body) });
const get = (path: string) => fetch(BASE + path, { headers: H });

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

// --- branch 3: intervention-outcome crash CANDIDATE (steward-intelligence.md §4/§6). A steward
// send parks a pending-outcome baseline while claude is alive; if claude dies inside the effect
// window, the window-close pass records a crash CANDIDATE for owner review — it must NEVER auto-set
// the `harmed` tally (attribution is ambiguous; the owner is the harm oracle). This needs a REAL
// claude that can transition alive→dead, so it lives here, not in the FLEET_CMD=true main suite
// (where claudeAlive short-circuits `return true`). Slot 2 still runs the alive claude-hang. ---
const stewTok = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
const stewH = { "content-type": "application/json", authorization: `Bearer ${stewTok}` };
const stewPost = (path: string, body: unknown) => fetch(BASE + path, { method: "POST", headers: stewH, body: JSON.stringify(body) });
const stewGet = (path: string) => fetch(BASE + path, { headers: stewH });

// let slot 2's last output age past the (shrunk) idle gate before the nudge
const MIN_IDLE = Number(process.env.FLEET_STEWARD_MIN_IDLE_MS ?? 60_000);
for (let i = 0; i < 200; i++) {
  const sx = (await (await get("/api/sessions")).json()) as { now: number; slots: { id: number; lastOutput: number }[] };
  const sl = sx.slots.find((x) => x.id === 2);
  if (sl && sx.now - sl.lastOutput >= MIN_IDLE) break;
  await Bun.sleep(150);
}
const crashSend = await stewPost("/api/steward/send", { slot: 2, kind: "continue_nudge", ref: "continue" });
check("crash-candidate: steward send succeeds while claude is alive", crashSend.ok, String(crashSend.status));
// make claude DIE inside the window: swap the binary back to the immediate-exit variant and kill
// the pane, so the respawn runs `claude` (exits at once) and falls through to a bare shell → dead
await Bun.write(`${FAKEBIN}/claude`, await Bun.file(`${FAKEBIN}/claude-exit`).arrayBuffer());
await Bun.$`chmod +x ${FAKEBIN}/claude`.quiet();
await tmuxOut("kill-session", "-t", "s2");
let crashSeen = false, harmedCount = -1, cleared = false;
for (let i = 0; i < 160; i++) { // ~32s: window (3s) + one measuring tickGit (≤10s) + margin
  const o = (await (await stewGet("/api/steward/outcomes")).json()) as {
    tally: Record<string, { harmed: number }>; candidates: { slot: number; class: string }[]; pending: { slot: number }[];
  };
  crashSeen = o.candidates.some((c) => c.slot === 2 && c.class === "continue_nudge");
  harmedCount = o.tally.continue_nudge?.harmed ?? 0;
  cleared = !o.pending.some((p) => p.slot === 2);
  if (crashSeen && cleared) break;
  await Bun.sleep(200);
}
check("crash-candidate: a claudeAlive true→false in the window is recorded as a candidate for owner review", crashSeen);
check("crash-candidate: it does NOT auto-set the harmed tally (owner is the harm oracle, §6)", harmedCount === 0, `harmed=${harmedCount}`);

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

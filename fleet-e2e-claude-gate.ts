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

console.log(results.join("\n"));
console.log(failed ? `\n${failed} FAILURES` : "\nALL PASS");
process.exit(failed ? 1 : 0);

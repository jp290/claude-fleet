// Shared plumbing for the split e2e suite (fleet-e2e.ts is the runner; every check module
// imports from here). Everything in this file is infrastructure — no checks live here.
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

export const IP = process.env.FLEET_E2E_HOST ?? "127.0.0.1";
// match the server's env so the whole suite can target an isolated instance
// (own port + own tmux socket) instead of the live fleet — see e2e-isolated.sh
export const PORT = Number(process.env.FLEET_PORT ?? 8790);
export const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
export const BASE = `http://${IP}:${PORT}`;
// the suite copy this runs from: the modules live in e2e/, every state file the server writes
// (fleet.json, streams/, audit.jsonl, …) sits next to server.ts one level up.
export const ROOT = resolve(import.meta.dir, "..");
// the throwaway git repo the worktree/dispatch checks spawn lanes from
export const REPO = process.env.FLEET_E2E_REPO ?? "";

export const results: string[] = [];
let failed = 0;
export const failures = (): number => failed;

export function check(name: string, ok: boolean, detail = ""): void {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
}

export async function tmuxOut(...args: string[]): Promise<{ out: string; code: number }> {
  const p = Bun.spawn(["tmux", "-L", SOCK, ...args], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  const code = await p.exited;
  return { out, code };
}

const state = (await Bun.file(`${ROOT}/fleet.json`).json()) as { token?: string };
export const TOKEN = process.env.FLEET_TOKEN ?? state.token ?? "";
export const H = { "content-type": "application/json", authorization: `Bearer ${TOKEN}` };
export const post = (path: string, body: unknown, headers: Record<string, string> = H): Promise<Response> =>
  fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
export const get = (path: string): Promise<Response> => fetch(BASE + path, { headers: H });

// Restart the srv session this suite is testing, carrying the server's env forward, and wait until
// it answers again. The wrapper exports every FLEET_* knob into THIS process too, so the whitelist
// is simply "every FLEET_* key we did not compute ourselves" — a new knob in e2e-isolated.sh rides
// along without a second list to keep in sync. `extra` wins over the inherited value (it is
// appended last), which is how a check turns a server-side fault-injection knob on for exactly one
// restart and off again for the next. Not used by restart.ts, which builds its own env line for
// reasons of its own (it deliberately DROPS FLEET_VERIFY_CMD) — see that file.
export async function restartSrv(extra: Record<string, string> = {}): Promise<void> {
  await tmuxOut("kill-session", "-t", "srv");
  await Bun.sleep(500);
  const own = new Set(["FLEET_HOST", "FLEET_PORT", "FLEET_SOCK", "FLEET_TOKEN"]);
  const env = Object.entries(process.env)
    .filter(([k, v]) => k.startsWith("FLEET_") && !k.startsWith("FLEET_E2E_") && !own.has(k) && !(k in extra) && v)
    .concat(Object.entries(extra))
    .map(([k, v]) => `${k}='${String(v).replaceAll("'", "'\\''")}' `).join("");
  await tmuxOut("new-session", "-d", "-s", "srv",
    `cd '${ROOT}' && FLEET_HOST=${IP} FLEET_PORT=${PORT} FLEET_SOCK=${SOCK} ${env}exec bun server.ts >> server.log 2>&1`);
  for (let i = 0; i < 160; i++) {
    const ok = await get("/api/sessions").then((r) => r.ok).catch(() => false);
    if (ok) return;
    await Bun.sleep(250);
  }
  throw new Error("srv never came back after restartSrv — the rest of this run would be meaningless");
}

export const wsUrl = (slot: number): string => `ws://${IP}:${PORT}/ws/${slot}?token=${TOKEN}`;
// Bun's WebSocket client accepts { headers } as a second arg — the DOM lib types don't
export const wsWithHeaders = (url: string, headers: Record<string, string>): WebSocket =>
  new (WebSocket as unknown as new (u: string, opts: { headers: Record<string, string> }) => WebSocket)(url, { headers });

// how many times the 🔍 review stand-in ran WITH THIS cwd — it appends its working directory
// (the reviewed lane's worktree) per spawn, so "the cache served it" / "auto-③ fired once" /
// "this slot was never reviewed" are all checked as facts, per lane, immune to what the auto
// path is doing on other lanes at the same moment.
export const reviewRunsFor = (cwd: string): number => {
  try {
    return readFileSync(`${ROOT}/reviewruns`, "utf8").split("\n").filter((l) => l === cwd).length;
  } catch { return 0; }
};

export interface PromptLogEntry {
  ts: number; slot: number; cwd: string | null; label: string | null; source: string; text: string;
}
export const plogPath = `${ROOT}/streams/prompts.jsonl`;
export const plogRead = async (): Promise<PromptLogEntry[]> =>
  (await Bun.file(plogPath).text()).trim().split("\n").filter(Boolean)
    .map((l) => JSON.parse(l) as PromptLogEntry);

export const readText = async (p: string): Promise<string> => {
  try {
    return await Bun.file(p).text();
  } catch {
    return "";
  }
};

// Read an env var out of a live pane, deterministically. A pane probe is a three-way race — the
// send-keys can land before the shell accepts input (silently dropped), the capture can land
// before the output has rendered, and a stale line from an earlier probe can be mistaken for
// this one's answer. So: a UNIQUE marker per call (never matches an earlier probe), a
// line-anchored match (never matches the command echo, which starts with `printf`), and
// send-keys RETRIED until the marked output line appears or the deadline passes. Returns the
// variable's value ("" when it is unset — the assertion its callers make) or null if the pane
// never answered, which is a harness failure, not an absent variable.
let probeSeq = 1;
export async function paneEnv(target: string, varName: string, timeoutMs = 20_000): Promise<string | null> {
  const marker = `envprobe-${varName.toLowerCase().replaceAll("_", "-")}-${probeSeq++}`;
  const line = new RegExp(`^${marker}=\\[([0-9a-zA-Z._/-]*)\\]$`, "m");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await tmuxOut("send-keys", "-t", target, `printf '${marker}=[%s]\\n' "$${varName}"`, "Enter");
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      const m = line.exec((await tmuxOut("capture-pane", "-t", target, "-p")).out);
      if (m) return m[1];
      await Bun.sleep(100);
    }
  }
  return null;
}

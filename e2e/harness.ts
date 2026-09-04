// Shared plumbing for the split e2e suite (fleet-e2e.ts is the runner; every check module
// imports from here). Everything in this file is infrastructure — no checks live here.
import { resolve } from "node:path";
import { mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { writeTrailRow } from "./trail-emit";

export const IP = process.env.FLEET_E2E_HOST ?? "127.0.0.1";
// match the server's env so the whole suite can target an isolated instance
// (own port + own tmux socket) instead of the live fleet — see e2e-isolated.sh
export const PORT = Number(process.env.FLEET_PORT ?? 8790);
export const SOCK = process.env.FLEET_SOCK ?? "claudefleet";
// The instance name the wrapper booted this server with (server.ts#INSTANCE_NAME). Read from the
// runner's own env rather than retyped in each check module: e2e-isolated.sh puts FLEET_INSTANCE on
// the runner line as well as the server line, so a changed value there can never leave a check
// asserting a name nothing serves. Empty when a harness boots no instance name — the probes that
// use it fail on that as their own stated precondition.
export const INSTANCE_NAME = process.env.FLEET_INSTANCE ?? "";
// THE LIVE-FLEET REFUSAL. Every e2e entry point — the runner and the four single-file harnesses —
// opens and kills slots, restarts srv, drives merges and lands. Against the live pair that is the
// owner's real panes. Each harness used to carry its own hand-copied version of this line, which
// is one forgotten line away from a fifth harness driving the fleet; it belongs in the module they
// all import, as the FIRST thing it does, so nothing can act before it.
// BOTH halves of the live pair are checked, because they are reached by different means and a
// wrapper can get one right and the other wrong: SOCK is what every tmux command hits, PORT is
// what every fetch() hits. A run with FLEET_SOCK set but FLEET_PORT forgotten would previously
// have talked HTTP to the live server on a test socket and looked fine doing it.
// The escape hatch is the one fleet-e2e.ts already documented (docs/verification.md:39); folding
// the refusal here extends it to the four harnesses, which had none — a deliberate loosening,
// and the price of having exactly one copy of the rule.
const LIVE_SOCK = "claudefleet";
const LIVE_PORT = 8790;
if ((SOCK === LIVE_SOCK || PORT === LIVE_PORT) && !process.env.FLEET_E2E_ALLOW_LIVE)
  throw new Error(`refusing to run against the live fleet (socket=${SOCK} port=${PORT}) — use one of the ./e2e-*.sh wrappers (or set FLEET_E2E_ALLOW_LIVE=1)`);
export const BASE = `http://${IP}:${PORT}`;
// the suite copy this runs from: the modules live in e2e/, every state file the server writes
// (fleet.json, streams/, audit.jsonl, …) sits next to server.ts one level up.
export const ROOT = resolve(import.meta.dir, "..");
// the throwaway git repo the worktree/dispatch checks spawn lanes from
export const REPO = process.env.FLEET_E2E_REPO ?? "";
// Two more, for the per-repo verify config only (P-7c). REPO2 has its own entry in the server's
// FLEET_VERIFY_CMD_REPOS, REPO3 deliberately has none — the pair is what makes "each land gets ITS
// command" separable from "everything gets the global". Empty when a wrapper does not build them,
// which is why the checks that use them assert their own precondition first.
export const REPO2 = process.env.FLEET_E2E_REPO2 ?? "";
export const REPO3 = process.env.FLEET_E2E_REPO3 ?? "";
// A foreign git repo containing Fleet-shaped filename decoys. Git identity, never these names,
// must keep Program-MAIN in its target-repo frame.
export const REPO4 = process.env.FLEET_E2E_REPO4 ?? "";

// The server's two scheduler ticks, READ FROM THE SAME ENV THE SERVER GOT (the wrappers put
// FLEET_*_TICK_MS on both the srv spawn line and this process's line). Every check that has to
// out-wait a tick sizes its window from these instead of hard-coding a number that silently
// stops matching the server the day a default moves. Defaults mirror server.ts's.
export const AUTOS_TICK_MS = Number(process.env.FLEET_AUTOS_TICK_MS ?? 5000) | 0;
export const DISPATCH_TICK_MS = Number(process.env.FLEET_DISPATCH_TICK_MS ?? 8000) | 0;
// A window wide enough that the tick MUST have fired inside it: the auto's own due delay (whole
// seconds — inSec is a seconds field) + one full tick + slack for a loaded machine. This is the
// only honest shape for a negative control; a positive one should poll instead.
export const afterTick = (dueMs: number, tickMs: number): number => dueMs + tickMs + 1500;
// mirrors server.ts's AUTO_MIN_EVERY_SEC — the smallest recurring interval the route accepts, and
// therefore a floor no tick setting can shrink. Named so the checks that hit it say so.
export const AUTO_MIN_EVERY_SEC_MS = 10_000;

export const results: string[] = [];
let failed = 0;
export const failures = (): number => failed;

// wall clock at the previous check's return — module init is suite start, so the first row
// measures from there (see trail-emit.ts on why this is msSincePrev and not a duration)
let prevCheck = Date.now();

export function check(name: string, ok: boolean, detail = ""): void {
  const ts = Date.now();
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failed++;
  // the choke point is also the trail's only emit site: every check, exactly one durable row,
  // no call site able to opt out (docs/e2e-trail.md). It never throws — see writeTrailRow.
  writeTrailRow(name, ok, detail, ts - prevCheck, ts);
  prevCheck = ts;
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
//
// THE TRAP THIS IMPLIES: a variable that was only ever put on the SERVER's spawn line, and never
// into this process's env, is dropped by every call here. restart.ts's FLEET_REPO_DIR was such a
// variable and cost 12 red checks in a later module (2026-08-03); it now plants itself in
// process.env for exactly this reason. Anything server-only added later must do the same.
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

// the last prompt the review stand-in received for THIS lane — cwd-keyed blocks, so concurrent
// auto-③ runs on other lanes can never be mistaken for ours. "" when no run was captured.
export const lastReviewPromptFor = (cwd: string): string => {
  try {
    const blocks = readFileSync(`${ROOT}/reviewprompts`, "utf8").split("===REVIEWPROMPT ")
      .filter((b) => b.startsWith(`${cwd}===\n`));
    const last = blocks[blocks.length - 1];
    return last ? (last.slice(cwd.length + 4).split("\n===ENDPROMPT===")[0] ?? "") : "";
  } catch { return ""; }
};

export interface PromptLogEntry {
  ts: number; slot: number; cwd: string | null; label: string | null; source: string; text: string;
  // occupant attribution (unconditional since the send-receipt cut) + the optional delivery
  // identity only a receipt-minting surface writes. Optional here because the journal is
  // append-only and older lines predate every one of them.
  openedAt?: number; sessionId?: string | null; sendId?: string; delivery?: string;
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
//
// FOURTH RACER, and it is not a race at all — the PANE'S WIDTH. capture-pane returns the pane's
// physical rows, so an answer longer than the pane is wide arrives as two lines and the anchored
// match never fires: the probe then times out and reports null, which reads as "the pane never
// answered". Measured 2026-08-07 on a 55-column pane (e2e/slots.ts resizes slot 2 to 55 for the
// reseed checks): `envprobe-fleet-self-token-N=[<32 hex>]` is 63 characters, wrapped, invisible —
// while the same probe for a 1-character value on the same pane answered instantly. The trap was
// dormant only because every value probed here used to be short or empty. `-J` joins wrapped
// lines back into one logical line, which is what the caller means by "the line the pane printed"
// (and it trims trailing whitespace, closing the same hole for a `$`-anchored match).
let probeSeq = 1;
export async function paneEnv(target: string, varName: string, timeoutMs = 20_000): Promise<string | null> {
  const marker = `envprobe-${varName.toLowerCase().replaceAll("_", "-")}-${probeSeq++}`;
  const line = new RegExp(`^${marker}=\\[([0-9a-zA-Z._/-]*)\\]$`, "m");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await tmuxOut("send-keys", "-t", target, `printf '${marker}=[%s]\\n' "$${varName}"`, "Enter");
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      const m = line.exec((await tmuxOut("capture-pane", "-t", target, "-p", "-J")).out);
      if (m) return m[1];
      await Bun.sleep(100);
    }
  }
  return null;
}

// The srv pane's OWN process environment, one named variable at a time, WITH A CONTROL — so that
// "this variable is not set" and "this process's environment could not be read at all" are
// different answers rather than the same silence. paneEnv() cannot serve here: the srv pane execs
// `bun server.ts` outright, so there is no shell in it to print anything.
//
// Readability is decided by a variable the spawn line ALWAYS carries (FLEET_PORT), never by
// whether the asked-for name turned up. Without that control an unreadable environment would
// report every variable as absent, and a probe would pass for the wrong reason — the exact shape
// CLAUDE.md's "a probe that could not run must fail as ITSELF" rule is about.
//
// Only the asked-for assignment is ever returned. A process line in this fleet carries the scoped
// self-credentials by construction (ensureSlot bakes them into the pane's shell string), so the
// raw line must never travel into a check detail, a log or a transcript.
export async function srvEnv(varName: string): Promise<{ readable: boolean; value: string | null }> {
  const { out: pidOut } = await tmuxOut("list-panes", "-t", "srv", "-F", "#{pane_pid}");
  const pid = (pidOut.trim().split("\n")[0] ?? "").trim();
  if (!/^\d+$/.test(pid)) return { readable: false, value: null };
  let tokens: string[] = [];
  try { // Linux: exact and NUL-delimited, so a value containing spaces survives
    tokens = readFileSync(`/proc/${pid}/environ`, "utf8").split("\0");
  } catch { // macOS: `ps eww` prints the environment after the command, space-separated
    const p = Bun.spawnSync(["ps", "eww", "-p", pid, "-o", "command="]);
    tokens = new TextDecoder().decode(p.stdout).split(/\s+/);
  }
  const hit = tokens.find((t) => t.startsWith(`${varName}=`));
  return { readable: tokens.some((t) => t.startsWith("FLEET_PORT=")),
    value: hit === undefined ? null : hit.slice(varName.length + 1) };
}

// --- the codex pane stand-in ------------------------------------------------------------------
// A live process in a pane that renders ONE measured screen and then stays there, so the screen
// families (Program-MAIN founding, the dispatch readiness tail) can drive a codex slot without a
// real TUI. It has to survive the PROCESS probe as well as the screen one: server.ts's codex
// adapter declares `comms: ["codex", "node"]`, and a pane whose process is not one of those reads
// `not-alive` at every delivery gate before any screen is ever captured.
//
// It used to be `node -e '<print>; setInterval(…)'`, which made that whole family depend on a
// runtime this repo declares nowhere. Measured 2026-08-30 on the Debian 13 second-host (no node
// installed): `respawn-pane` still exits 0 — it only hands the command to a shell — the command
// dies at once, the pane and its tmux session die with it, and every later gate answers
// `Program-MAIN delivery held (not-alive)`. The founding fixture reported SUCCESS while it had
// just destroyed the slot it was arranging; 80+ checks went red behind it and the run aborted in
// the game-maker family. Two failures in one: an undeclared dependency, and a probe that could
// not run reporting as the thing it was measuring.
//
// The stand-in is now `sleep` reached through a symlink NAMED codex — one path on both platforms,
// no branch, and no weakening: the pane holds a real live process, and the name the probe finds
// is the harness's own rather than node's borrowed one. `comm` is taken from the exec path on
// both (measured: Linux answers `codex`, macOS answers the full symlink path, which
// paneAgentAt's `split("/").pop()` reduces to the same word).
let standInPath: string | null = null;
export function standInBin(): string {
  if (standInPath) return standInPath;
  // outside ROOT on purpose: ROOT is a git repo the server reads head facts out of, and this is
  // not the suite's business to leave in it
  const dir = `${tmpdir()}/fleet-e2e-standin-${process.pid}`;
  mkdirSync(dir, { recursive: true });
  const bin = `${dir}/codex`;
  const target = Bun.which("sleep");
  if (!target) throw new Error("no `sleep` on PATH — the codex pane stand-in cannot be built");
  try { symlinkSync(target, bin); } catch { /* an earlier call in this run built it */ }
  standInPath = bin;
  return bin;
}

// Replace slot `slot`'s pane with the stand-in and PROVE it took. Two separate failures, both
// reported as THEMSELVES rather than as whatever the caller was about to measure:
//   · respawn-pane answers non-zero for a pane that does not exist yet — the slot is published
//     (cwd + label) before openSlot's ensureSlot has created it, so retry inside the boot grace
//     (docs/messungen/acp18-fleet-frame-rot-2026-08-21.md);
//   · respawn-pane answers ZERO for a command the shell then fails to run, which is how a missing
//     interpreter used to pass for a planted screen. So the screen is read back off the pane.
// Returns false when the fixture could not be arranged, having filed its own red row.
export async function plantScreen(slot: number, screen: string, family = "founding fixture"): Promise<boolean> {
  const cmd = `printf '%s\\n' '${screen.replaceAll("'", "'\\''")}'; exec '${standInBin()}' 100000`;
  let last: { out: string; code: number } = { out: "", code: -1 };
  for (let i = 0; i < 60; i++) {
    last = await tmuxOut("respawn-pane", "-k", "-t", `s${slot}`, cmd);
    if (last.code === 0) break;
    await Bun.sleep(50);
  }
  if (last.code !== 0) {
    check(`${family}: pane s${slot} accepted the harness screen`, false, `respawn-pane exited ${last.code}`);
    return false;
  }
  const firstLine = screen.split("\n")[0] ?? screen;
  for (let i = 0; i < 100; i++) {
    const cap = await tmuxOut("capture-pane", "-t", `s${slot}`, "-p", "-J");
    if (cap.code === 0 && cap.out.includes(firstLine)) return true;
    await Bun.sleep(50);
  }
  const alive = (await tmuxOut("has-session", "-t", `s${slot}`)).code === 0;
  check(`${family}: pane s${slot} rendered the harness screen`, false,
    alive ? "pane alive but the screen never rendered" : "the pane died with the command");
  return false;
}

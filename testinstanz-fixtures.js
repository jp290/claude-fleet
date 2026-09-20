// THE FIXTURES ARE THE CONTENT of the standing test instance, not its trimming: the states the bar
// has to tell apart are exactly the ones a fresh instance does not have. Driven over the instance's
// own HTTP API — nothing here knows about the live fleet. A sibling of cdp-shot.js and
// flaechenbudget.js and plain JS for the same reason they are: a new top-level .ts would have to
// enter watchdog.sh's tsc list AND AGENTS.md's copy of it (e2e/pins.ts pins the two against each
// other), and a test-instance driver does not belong in the portable contract.
//
// Called by testinstanz.sh with FLEET_TI_* in the env. Argument: `mixed` (default — free places
// stay in the axis) or `full` (all 16 taken).
//
// THE FOUR STATES AND HOW EACH IS PRODUCED (src/client.ts#slotState):
//   working  — pane painted within RECENT_MS (5 s): every fresh open, for five seconds
//   resting  — quiet between 5 s and 30 min: the same sessions, moments later
//   asleep   — quiet for SLEEP_MS (30 min) or more. NOT PLANTABLE, and the reason is structural:
//              the clock it reads is `lastOutput`, which the server keeps in MEMORY and never
//              writes to fleet.json (the persisted slot keys are cwd/label/harness/model/…, no
//              lastOutput, no quietUntil), so there is no file to age and no route to set it.
//              It arrives on its own once the instance has stood quiet for half an hour.
//   broken   — `stalled`, or an `agent` of no-agent/no-pane. Killing the tmux session does NOT
//              work: the server self-heals it within seconds (measured 2026-09-20, s6 was back
//              9 s later). What holds is `remain-on-exit on` plus killing the pane's own process:
//              tmux keeps the window, so nothing looks missing to heal, while `paneAgentAt` finds
//              a pane_pid with no live process behind it and answers `no-agent` — which is
//              literally what the state means ("a pane with no agent behind it").
// Whatever is not there is REPORTED as not there: an absence must not read like a zero.
//
// `states` as the argument plants NOTHING and only reads back what the bar paints right now — the
// way to watch `asleep` arrive on a standing instance without opening the tab.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const BASE = process.env.FLEET_TI_BASE ?? "";
const TOKEN = process.env.FLEET_TI_TOKEN ?? "";
const SRC = process.env.FLEET_TI_SRC ?? "";
const DIR = process.env.FLEET_TI_DIR ?? "";
const SOCK = process.env.FLEET_TI_SOCK ?? "";
const ARG = process.argv[2] ?? "mixed";
const READ_ONLY = ARG === "states";
const MODE = ARG === "full" ? "full" : "mixed";
if (!BASE || !TOKEN || !DIR || !SOCK) {
  console.error("FLEET_TI_BASE, FLEET_TI_TOKEN, FLEET_TI_DIR and FLEET_TI_SOCK are required");
  process.exit(2);
}

const H = { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" };
async function api(path, body) {
  const r = await fetch(`${BASE}${path}`, body === undefined
    ? { headers: H } : { method: "POST", headers: H, body: JSON.stringify(body) });
  let parsed = null;
  try { parsed = await r.json(); } catch { parsed = null; }
  return { status: r.status, body: parsed };
}
const sh = (cwd, ...argv) => spawnSync(argv[0], argv.slice(1), { cwd, stdio: "ignore" });

const notes = [];
const lanes = READ_ONLY ? null : await plant();

async function plant() {
// A REPO OF ITS OWN for the lanes. Pointing them at this checkout would create real worktrees and
// real branches in the owner's actual repository — a test instance must not reach outside its dir.
const repo = `${DIR}/fixture-repo`;
if (!existsSync(repo)) {
  mkdirSync(repo, { recursive: true });
  writeFileSync(`${repo}/README.md`, "fixture repo for the standing test instance\n");
  sh(repo, "git", "init", "-q");
  sh(repo, "git", "add", "-A");
  sh(repo, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture");
}

// Labels at the edge on purpose: the bar's job is to stay readable when a name does not fit. The
// server caps a label at 40 chars, so the longest here is exactly 40.
const SESSIONS = [
  { slot: 1, label: "Orchestrator", cwd: repo },
  { slot: 2, label: "Fleet-Betrieb", cwd: repo },
  { slot: 3, label: "Program-MAIN Leiste und Slot-System", cwd: repo },
  { slot: 4, label: "⚙ steward", cwd: SRC || repo, harness: "pi" },
  { slot: 5, label: "Astra", cwd: SRC || repo, harness: "codex" },
  { slot: 6, label: "GLM Sammelzeile", cwd: repo, harness: "pi-zai" },
  { slot: 7, label: "Shell", cwd: process.env.HOME ?? repo },
  { slot: 8, label: "Queue-Sichtung, dritte Runde in 24 h", cwd: repo },
];
// `full` means all sixteen places taken, and a LANE TAKES A PLACE — so the full stand is thirteen
// sessions plus three lanes, not sixteen sessions (sixteen sessions leave the lanes a 409 "no free
// slot", which is how this number was found).
const BROKEN_SLOT = 6;
const LANE_PARENT = 2;

// A FRESH CANVAS FIRST. Replanting on top of a standing instance re-opens slots that are already
// open, and the server refuses that — one refusal on 2026-09-20 even named a DIFFERENT slot ("could
// not prove tmux session s1 absent: tmux session s6 returned no absolute pane path"): the broken
// pane this script plants makes the absence proof for every other slot fail. Tearing down first
// avoids the question and makes both stands reproducible rather than cumulative.
for (let id = 1; id <= 16; id++) await api(`/api/slots/${id}/kill`, {});
// Wait for the teardown to be DONE, not for a guessed number of milliseconds: a fixed sleep here
// produced `503 tmux new-session unavailable (exited 1)` on a replant, because the new session was
// asked for while the old one was still going away.
for (let i = 0; i < 40; i++) {
  const now = (await api("/api/sessions")).body;
  if (!(Array.isArray(now?.slots) ? now.slots : []).some((x) => x.cwd)) break;
  await Bun.sleep(500);
}
const plan = MODE === "full"
  ? [...SESSIONS, ...[9, 10, 11, 12, 13].map((id) => ({ slot: id, label: `Platz ${id}`, cwd: repo }))]
  : SESSIONS;
for (const s of plan) {
  const open = () => api(`/api/slots/${s.slot}/open`,
    { cwd: s.cwd, label: s.label, ...(s.harness ? { harness: s.harness } : {}) });
  let r = await open();
  // ONE retry, and only for a 5xx: tmux answering "unavailable" is a transient the spawn seam
  // reports honestly (`availability: unknown`), not a refusal to argue with.
  if (r.status >= 500) { await Bun.sleep(2000); r = await open(); }
  if (r.status >= 300) notes.push(`slot ${s.slot} NOT opened (${r.status}): ${JSON.stringify(r.body).slice(0, 140)}`);
}
await Bun.sleep(3000);

// THREE lanes under ONE session, and `parent` is not decoration: without it the server picks an
// anchor per lane, several sessions of this repo qualify, and the bar ends up with TWO stacks. Two
// stacks make the fold key generation-qualified (`${key}\n${slot}:${openedAt}`, src/client.ts) —
// one stack keeps it the plain repo path, which is the key a reader can actually reason about.
const before = (await api("/api/sessions")).body;
const anchor = (Array.isArray(before?.slots) ? before.slots : []).find((x) => x.id === LANE_PARENT);
let made = 0;
if (!anchor?.openedAt) notes.push(`no lane anchor: slot ${LANE_PARENT} carries no openedAt`);
else for (let i = 0; i < 3; i++) {
  const r = await api("/api/lanes", { repo, parent: { slot: LANE_PARENT, openedAt: anchor.openedAt } });
  if (r.status < 300) made++;
  else notes.push(`lane ${i + 1} NOT created (${r.status}): ${JSON.stringify(r.body).slice(0, 180)}`);
}
await Bun.sleep(6000);

// BROKEN: the window stays (so the server sees nothing to heal), the process behind it does not.
// Both calls name the SESSION on this instance's own socket — never a name pattern, and never a
// socket this script did not create.
sh(DIR, "tmux", "-L", SOCK, "set-option", "-t", `s${BROKEN_SLOT}`, "remain-on-exit", "on");
const pp = spawnSync("tmux", ["-L", SOCK, "display-message", "-p", "-t", `s${BROKEN_SLOT}`, "#{pane_pid}"],
  { encoding: "utf8" }).stdout?.trim();
if (pp && /^\d+$/.test(pp)) sh(DIR, "kill", "-9", pp);
else notes.push(`broken slot ${BROKEN_SLOT}: no pane_pid to kill (tmux said ${JSON.stringify(pp)})`);
await Bun.sleep(9000);
return made;
}

// WHAT THE BAR WILL ACTUALLY PAINT — read back from the API, never assumed. This mirrors
// slotState() in src/client.ts; if that changes, this summary is wrong and the picture is still
// right, which is the correct way round.
const now = Date.now();
const sessions = (await api("/api/sessions")).body;
const rows = Array.isArray(sessions?.slots) ? sessions.slots : [];
const stateOf = (s) => {
  if (s.stalled || s.agent === "no-agent" || s.agent === "no-pane") return "broken";
  const last = Number(s.lastOutput ?? 0);
  if (now - last < 5000) return "working";
  return now - last >= 30 * 60_000 ? "asleep" : "resting";
};
const occupied = rows.filter((s) => s.cwd);
const seen = new Map();
for (const s of occupied) seen.set(stateOf(s), (seen.get(stateOf(s)) ?? 0) + 1);
console.log(READ_ONLY
  ? `bar now: ${occupied.length} occupied, ${rows.length - occupied.length} free`
  : `fixtures (${MODE}): ${occupied.length} occupied, ${rows.length - occupied.length} free, ${lanes} lanes`);
console.log(`  states on the bar: ${[...seen].map(([k, v]) => `${k}=${v}`).join(" ") || "none"}`);
for (const s of occupied) if (stateOf(s) !== "resting") console.log(`    slot ${s.id} ${stateOf(s)} — ${s.label ?? ""}`);
for (const want of ["working", "resting", "asleep", "broken"]) {
  if (seen.has(want) || READ_ONLY) continue;
  notes.push(
    want === "asleep"
      ? `"asleep" is NOT on the bar and cannot be planted: it reads lastOutput, which the server`
        + ` keeps in memory and never persists — it appears by itself after 30 minutes of quiet`
    : want === "working"
      ? `"working" is NOT on the bar right now: it lasts 5 s after a pane paints, and this readout`
        + ` is taken later — it comes back the moment anything is typed into a pane`
      : `"${want}" is NOT on the bar — absence, not zero`);
}
for (const n of notes) console.log(`  ! ${n}`);

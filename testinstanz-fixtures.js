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
//   working  — pane painted within RECENT_MS (5 s). testinstanz.sh#ti_paint keeps lane 10 printing
//              every 2 s, and the slot on screen always reads as working.
//   resting  — quiet between 5 s and 30 min. ti_paint has every other live row print once every
//              10 min, so resting holds for as long as the instance stands.
//   asleep   — quiet for SLEEP_MS (30 min) or more. NOT PLANTABLE, and the reason is structural:
//              the clock it reads is `lastOutput`, which the server keeps in MEMORY and never
//              writes to fleet.json, so there is no file to age and no route to set it. Slot 4 is
//              the row that gets no painter: it falls asleep 30 minutes after `up`, and only then.
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
const PATCH = ARG === "succession-patch";
const MODE = ARG === "full" ? "full" : "mixed";
if (!BASE || !TOKEN || !DIR || !SOCK) {
  console.error("FLEET_TI_BASE, FLEET_TI_TOKEN, FLEET_TI_DIR and FLEET_TI_SOCK are required");
  process.exit(2);
}

// SUCCESSION FACTS CANNOT BE ASKED FOR OVER HTTP — they are the record of handovers that really
// happened, and this instance has had none. They ARE persisted (`laneSuccessions` on the slot,
// `lineageHandovers` as a top-level list, `laneSucceedCounts` as a map), unlike `lastOutput`, so
// they can be planted in the state file. The server must be DOWN while this runs: it holds the
// state in memory and writes it back over anything edited underneath it. testinstanz.sh stops it,
// calls this, and starts it again on the same tmux socket, where the panes are still standing.
// THE DEMO LAYOUT (2026-09-21, owner: "am ende will ich all diese zsm mit dem band in einer guten
// demo testen und bewerten"). Every row property of the bar has at least one row that shows it, and
// the slot numbers are FIXED so the report can say "look at slot N" and mean it:
//   mains with 0 / 1 / 3 lanes ....... 1 · 3 (lane 12 = 3A) · 2 (lanes 9, 10, 11 = 2A 2B 2C)
//   working / resting / asleep / broken  1 (+ lane 10 painting) / most / 4 (after 30 min) / 6
//   ctx low / mid / near a handover .... 12 → 5 %, 1 → 12 %, 10 → 21 %, 3 → 45 %, lane 9 → 37 % (the
//                                         lane rail hands over at 40), main 2 → 78 %; the rest "ctx ?"
//   succession ......................... 2 main s4 · 9 lane s3 · 2/5 (capped) · 10 lane s2 (no cap)
//                                         · 12 lane s1 · 0/5 (a FIRST session — only a capped lane
//                                         has one to show: the server omits an uncapped s1)
//   codex .............................. 5 "pick conversation" (owner must act) · 8 healthy: nothing
const CTX_PCT = { 1: 12, 2: 78, 3: 45, 9: 37, 10: 21, 12: 5 };
// claude's default here is claude-opus-5[1m] (src/protocol.ts#FLEET_DEFAULT_MODEL): one percent of
// its window is 10 000 input tokens. The API is read back after the restart, never assumed.
const WINDOW = 1_000_000;

// SUCCESSION FACTS CANNOT BE ASKED FOR OVER HTTP — they are the record of handovers that really
// happened, and this instance has had none. They ARE persisted (`laneSuccessions` on the slot,
// `lineageHandovers` as a top-level list, `laneSucceedCounts` as a map), unlike `lastOutput`, so
// they can be planted in the state file. So can a Codex binding state (`codexRecoveryState`) and a
// session id — and a session id plus a transcript with a usage record is what the context fill is
// measured from. The server must be DOWN while this runs: it holds the state in memory and writes
// it back over anything edited underneath it. testinstanz.sh stops it, calls this, and starts it
// again on the same tmux socket, where the panes are still standing.
if (PATCH) {
  const file = `${DIR}/fleet.json`;
  const st = JSON.parse(await Bun.file(file).text());
  const slot = (id) => st.slots?.[String(id)] ?? null;
  const planted = [];
  const lane = (id, successions, originId, taken) => {
    const s = slot(id);
    if (!s?.worktree) { planted.push(`! slot ${id} is not a lane — nothing planted there`); return; }
    s.laneSuccessions = successions;
    if (originId) {
      // `taken` is counted per QUEUE ROW (originId), which a hand-made lane has none of — so the
      // row gets one, which is also what makes the cap apply at all (cap is null without one)
      s.originId = originId;
      st.laneSucceedCounts = { ...(st.laneSucceedCounts ?? {}), [originId]: taken };
    }
    planted.push(`slot ${id} (lane): session ${successions + 1}${originId ? `, ${taken} of the cap spent` : ", no cap"}`);
  };
  lane(9, 2, "fixture0", 2);
  lane(10, 1, null, 0);
  lane(12, 0, "fixture1", 0);
  // A main on its fourth session: three handover records addressed to this occupant's line.
  const m = slot(2);
  if (m) {
    // 24 hex, and ALL TEN FIELDS: the loader refuses a record that does not contain exactly
    // v, lineageId, role, at, from, to, obligations, intent, pointer, supersededBy, and it refuses
    // it into a SCAR rather than an error — the first fixture here lost three records that way and
    // the only trace was one line in the instance's server.log.
    const lineageId = "f1c70000000000000000cafe";
    m.lineageId = lineageId;
    // replaced, not appended: a second `succession` would otherwise make this session 7
    st.lineageHandovers = [...(st.lineageHandovers ?? []).filter((r) => r.lineageId !== lineageId), ...[0, 1, 2].map((i) => ({
      v: 1, lineageId, role: "generic", at: (m.openedAt ?? Date.now()) - (3 - i) * 3600_000,
      from: { slot: 2, openedAt: (m.openedAt ?? Date.now()) - (4 - i) * 3600_000 },
      to: { slot: 2, openedAt: (m.openedAt ?? Date.now()) - (3 - i) * 3600_000 },
      obligations: [], intent: "fixture handover", pointer: null, supersededBy: null }))];
    planted.push("slot 2 (main): session 4");
  }
  // THE HANDOFF REPORTS the past sessions filed — what #band=d's hover names per past mark
  // (server.ts#successionChain). A lane's past occupants ARE its handoff reports (slot + branch);
  // a main's are matched to its lineage records by slot + openedAt, so slot 2 gets two of its three
  // and the demo also shows a past session whose report was never filed. Ids start f1c7 so a
  // re-plant replaces them instead of stacking.
  const HOUR = 3600_000;
  // `id` is passed, not read off the row: a persisted slot is KEYED by its number and carries no
  // `id` field — reading s.id planted five reports with no worker slot, and the loader dropped all five
  const report = (i, id, s, openedAt, reportedAt, sessionId = null) => ({
    id: `f1c7${String(i).padStart(20, "0")}`, reportedAt, status: "handoff",
    text: `fixture handoff: session of slot ${id} laid the baton down`,
    worker: { slot: id, openedAt, sessionId, cwd: s.cwd, branch: s.worktree?.branch ?? "main" },
    provenance: { taskId: null, originId: null, programId: null }, receiver: null, basis: "owner-inbox",
    eventId: `e1c7${String(i).padStart(20, "0")}`,
    // JUDGED, so they sit in no inbox: an undecided owner-inbox row is an item the owner owes a
    // verdict on, and five fixture rows lit the head row's inbox badge with a "5" (2026-09-21)
    decision: { disposition: "accepted", by: "owner", at: reportedAt + 1, reason: null } });
  const reports = [];
  // THE BAND'S TRANSCRIPTS (GET /api/slots/:id/succession/:n/transcript): a lane's past session is
  // read through the sessionId its handoff report names. The OLDEST past session of each lane gets a
  // short conversation on disk (with a usage record, so its cell shows a ctx at handover); lane 9's
  // second one names a session whose file is not there — the "no longer on the disk" state; the
  // main's reports name no session at all — "Transkript nicht zugeordnet". Under $DIR/home only.
  const pastTranscript = (s, sid, id, k, pct) => {
    const proj = `${DIR}/home/.claude/projects/${s.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(proj, { recursive: true });
    const at = (m) => new Date(Date.now() - (5 - m) * 60_000).toISOString();
    const lines = [
      { type: "user", timestamp: at(0), message: { content: `Slot ${id}, Session ${k}: bitte den Kopf der Leiste messen` } },
      { type: "assistant", timestamp: at(1), message: { content: [{ type: "text", text: `Gemessen: der Kopf ist **48 px** hoch, die Knöpfe stehen in zwei Reihen.` }],
        usage: { input_tokens: Math.round((pct / 100) * WINDOW), cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } } },
      { type: "user", timestamp: at(2), message: { content: "Gut — dann übergib den Staffelstab." } },
      { type: "assistant", timestamp: at(3), message: { content: [{ type: "text", text: "Übergeben: fertig, offen, nächster Schritt stehen im Report." }] } },
    ];
    writeFileSync(`${proj}/${sid}.jsonl`, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  };
  const pastLane = (id, n) => {
    const s = slot(id);
    if (!s?.worktree) return;
    const now = s.openedAt ?? Date.now();
    for (let k = 0; k < n; k++) {
      const sid = crypto.randomUUID();
      if (k === 0) pastTranscript(s, sid, id, k + 1, 61 + id);
      reports.push(report(reports.length + 1, id, s, now - (n - k + 1) * HOUR, now - (n - k) * HOUR - 60_000, sid));
    }
  };
  pastLane(9, 2);
  pastLane(10, 1);
  if (m) {
    const now = m.openedAt ?? Date.now();
    for (const i of [0, 2]) reports.push(report(reports.length + 1, 2, m, now - (4 - i) * HOUR, now - (3 - i) * HOUR - 60_000));
  }
  st.fleetReports = [...(st.fleetReports ?? []).filter((r) => !String(r.id).startsWith("f1c7")), ...reports];
  planted.push(`handoff reports: ${reports.length} (lane 9: 2 · lane 10: 1 · main 2: sessions 1 and 3, session 2 has none)`
    + " · transcripts: lane 9 s1 + lane 10 s1 on disk, lane 9 s2 missing, main unassigned");
  // CONTEXT FILL: a session id on the slot and a transcript at the path the claude reader derives
  // from it — under THIS INSTANCE'S HOME (testinstanz.sh starts the server with HOME=$DIR/home),
  // so nothing is written into the real ~/.claude.
  for (const [id, pct] of Object.entries(CTX_PCT)) {
    const s = slot(id);
    if (!s?.cwd) { planted.push(`! slot ${id} has no cwd — no ctx`); continue; }
    const sid = crypto.randomUUID();
    s.sessionId = sid;
    const proj = `${DIR}/home/.claude/projects/${s.cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
    mkdirSync(proj, { recursive: true });
    const used = Math.round((pct / 100) * WINDOW);
    writeFileSync(`${proj}/${sid}.jsonl`, JSON.stringify({ type: "assistant",
      message: { usage: { input_tokens: used, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 1 } } }) + "\n");
  }
  planted.push(`ctx on ${Object.entries(CTX_PCT).map(([id, p]) => `${id}=${p}%`).join(" ")}`);
  // CODEX: slot 5 in the state Fleet will not guess its way out of, slot 8 bound and healthy.
  const cx = (id, state) => {
    const s = slot(id);
    if (!s) { planted.push(`! slot ${id} missing — no codex state`); return; }
    s.codexRecoveryState = state;
    if (state === "bound") s.sessionId = s.sessionId ?? crypto.randomUUID();
    planted.push(`slot ${id} (codex): ${state}`);
  };
  cx(5, "ambiguous");
  cx(8, "bound");
  await Bun.write(file, JSON.stringify(st));
  console.log(`planted in the state file: ${planted.join(" · ") || "nothing (no slots)"}`);
  process.exit(0);
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

// A SECOND PROJECT, also inside the instance's own directory. Slots 4 and 5 used to open in THIS
// checkout (`SRC`) to give the bar a second project hue — and with the harness CLIs real at the
// time, that put a live `codex --dangerously-bypass-approvals-and-sandbox` into the lane's own
// worktree. The hue only needs a second repo, not this one.
const other = `${DIR}/fixture-other`;
if (!existsSync(other)) {
  mkdirSync(other, { recursive: true });
  writeFileSync(`${other}/README.md`, "second fixture repo for the standing test instance\n");
  sh(other, "git", "init", "-q");
  sh(other, "git", "add", "-A");
  sh(other, "git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "fixture");
}

// Labels at the edge on purpose: the bar's job is to stay readable when a name does not fit. The
// server caps a label at 40 chars, so the longest here is exactly 40.
const SESSIONS = [
  { slot: 1, label: "Orchestrator", cwd: repo },
  { slot: 2, label: "Fleet-Betrieb", cwd: repo },
  { slot: 3, label: "Program-MAIN Leiste und Slot-System", cwd: repo },
  { slot: 4, label: "⚙ steward", cwd: other, harness: "pi" },
  { slot: 5, label: "Astra", cwd: other, harness: "codex" },
  { slot: 6, label: "GLM Sammelzeile", cwd: repo, harness: "pi-zai" },
  { slot: 7, label: "Shell", cwd: process.env.HOME ?? repo },
  { slot: 8, label: "Sol", cwd: repo, harness: "codex" },
];
// `full` means all sixteen places taken, and a LANE TAKES A PLACE — so the full stand is thirteen
// sessions plus three lanes, not sixteen sessions (sixteen sessions leave the lanes a 409 "no free
// slot", which is how this number was found).
const BROKEN_SLOT = 6;

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

// LANES UNDER TWO MAINS — three under slot 2, one under slot 3 — so the bar shows a main with
// many lanes, one with a single lane, and (slot 1) one with none. `parent` is not decoration:
// without it the server picks an anchor per lane and the lanes land under whichever session of this
// repo it likes. Created in this order, the lanes take the free places 9, 10, 11 and then 12, which
// is what the demo layout above and the report's "look at slot N" rely on (read back below).
const before = (await api("/api/sessions")).body;
const bySlot = (id) => (Array.isArray(before?.slots) ? before.slots : []).find((x) => x.id === id);
let made = 0;
for (const [parentSlot, count] of [[2, 3], [3, 1]]) {
  const anchor = bySlot(parentSlot);
  if (!anchor?.openedAt) { notes.push(`no lane anchor: slot ${parentSlot} carries no openedAt`); continue; }
  for (let i = 0; i < count; i++) {
    const r = await api("/api/lanes", { repo, parent: { slot: parentSlot, openedAt: anchor.openedAt } });
    if (r.status < 300) made++;
    else notes.push(`lane under ${parentSlot} NOT created (${r.status}): ${JSON.stringify(r.body).slice(0, 180)}`);
  }
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

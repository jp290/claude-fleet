// e2e for LANE SUITES IN THE REMOTE HELPER PORTAL (server.ts, grep `LaneSuiteJob`) — the second
// job kind: a lane hands its own `./e2e-isolated.sh` PREVIEW to another machine instead of holding
// this box's single suite mutex for it.
//
// WHY IT LIVES IN THE MAIN RUNNER and not beside e2e/helper-portal.ts in the postland harness.
// That module needs `FLEET_POSTLAND_AUDIT_CMD`, because an audit job IS the tier-2 queue and the
// queue is unreachable without it. A lane-suite job needs no such env at all — the LANE offers it —
// so the constraint that forced its sibling into a hand-started harness does not apply here, and
// the placement rule that does apply says put it where something actually runs it: the post-land
// audit fires `./e2e-isolated.sh` ~9 min after every land, while `./e2e-postland-audit.sh` runs
// only when a human starts it ("kein Gate faehrt sie, also rottet sie unbemerkt", once for months).
//
// THE ONE INVARIANT UNDER TEST is the owner's, unchanged from the audit half — work is taken over,
// never doubled, never lost — plus the one this cut adds and that no other check in this repo can
// see: THE TREE THAT LEAVES IS THE LANE'S WORKING TREE. A bundle of HEAD is the plausible wrong
// implementation, and it fails SILENTLY: the suite runs, it passes, and it answers a question about
// code the lane has not got. (LS.3) is that assertion.
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { BASE, REPO, ROOT, UntilTimeout, until, check, get, post, restartSrv, stopSrv } from "./harness";
import { laneSuiteWatchMessage } from "../lane-signals";
import { openLane, type Lane } from "./lane-helpers";
import { suiteMeter, laneTail, meterKind, meterLine, type MeterInput } from "../src/suitemeter";

interface HelperJob {
  id: string; kind?: string; repo: string; main: string; branches: string[]; covers: number;
  oldestAt: number; claim: { name: string; claimedAt: number; expiresAt: number } | null;
  localRunning: boolean; untracked?: number;
}
interface HelperJobs { claimTimeoutMs: number; configured: boolean; jobs: HelperJob[] }
interface ClaimedJob {
  id: string; kind?: string; repo: string; main: string; mainSha: string; treeSha?: string;
  branch?: string; untracked?: number; claimedAt: number; expiresAt: number; name: string;
}
interface OfferView {
  id: string; state: string; branch: string; offeredAt: number;
  commitSha: string | null; treeSha: string | null; untracked: number | null;
  claim: { name: string; claimedAt: number; expiresAt: number } | null;
  // `remote` and `treeSha` are OPTIONAL here on purpose, and it is the same rule
  // e2e/helper-portal.ts states about its own row type: what is under test is that the server
  // WRITES the provenance, and a type that made the field mandatory would let a server that never
  // wrote it take the module down with a TypeError instead of failing the named check. Measured:
  // stripping the remote block from laneSuiteView did exactly that until this line was written.
  result: {
    exitCode: number | null; result: string; reason?: string; tail?: string; trail?: string;
    checks?: { ran: number; failed: number } | null;
    // OPTIONAL for the same reason `remote` is, and it is the field (LS.4b) is about: a server that
    // stopped writing the names must fail the named check, not take the module down with a TypeError.
    fails?: string[];
    remote?: { name: string; claimedAt: number; reportedAt: number; clonedSha?: string;
      artifact?: { bytes: number; sha256: string; url: string } };
    treeSha?: string; ms?: number;
  } | null;
}
interface HelperPresenceView {
  online: boolean; name: string | null; mode: string | null; lastSeenAgeMs: number | null;
}
interface OfferPayload {
  offer: OfferView | null; existing?: boolean; mayRunLocally?: boolean; error?: string;
  reason?: string;
  waitPolicy?: { freeMs: number; heldMs: number };
  suiteLock?: unknown;
  // OPTIONAL for the same reason `remote` is above: what is under test is that the server SENDS the
  // presence reading, and a mandatory field would let a server that stopped sending it take the
  // module down with a TypeError instead of failing the named check.
  helper?: HelperPresenceView;
}
// The event rows as GET /api/events carries them (the full trail; the poll carries a projected cut). Every field past `id` is OPTIONAL for the reason
// this module states about `remote` above: what is under test is that the SERVER writes them, and a
// mandatory field would let a server that stopped writing one take the module down with a TypeError
// instead of failing the named check.
interface EventRow {
  id: string; kind?: string; delivery?: string; status?: string; watchId?: string | null;
  receiverSlot?: number | null; receiverOpenedAt?: number | null; receiverIdleSec?: number;
  receiverSessionId?: string | null;
  subjectJobId?: string;
  payload?: { result?: string; branch?: string; exitCode?: number | null; fails?: string[];
    failCount?: number; tail?: string; reason?: string };
}
interface RedPreviewRow {
  eventId?: string; jobId?: string; at?: number; status?: string; branch?: string; result?: string;
  exitCode?: number | null; fails?: string[]; failCount?: number; tail?: string; door?: string;
  job?: { slot?: number; state?: string; helper?: string | null; treeSha?: string | null } | null;
}
interface PersistedLaneSuiteJob {
  id: string; state: string; offeredAt: number; claim: unknown;
  claimWas?: { deviceId: string; name: string; claimedAt: number; expiresAt: number };
  endedAt?: number;
  // the VERDICT as it sits on disk — unknown, because (LS.6c) is about a row whose shape the
  // server does not vouch for: what is asserted there is that it comes back null, not its fields
  result?: unknown;
}

const DEVICE = "lanesuitedev01";     // matches the server's /^[a-z0-9]{8,32}$/
const DEVICE_NAME = "lane-suite box";
const OFFER_WIRE_KEYS = "id,state,branch,offeredAt,commitSha,treeSha,untracked,claim,result";
const keysOf = (value: unknown): string =>
  value && typeof value === "object" ? Object.keys(value).join(",") : "";
const persistedLaneSuiteJob = (id: string): PersistedLaneSuiteJob | undefined => {
  try {
    const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { laneSuiteJobs?: PersistedLaneSuiteJob[] };
    return state.laneSuiteJobs?.find((job) => job.id === id);
  } catch { return undefined; }
};

// A body reader that CANNOT take the run down. Every route below is expected to answer JSON, but a
// mutation under test can make one throw and answer a 500 with a non-JSON body — and a bare
// `.json()` then dies inside the module, which reads as "the suite crashed" rather than as the
// named check that was actually violated. A probe that could not run must fail as ITSELF.
const bodyOf = async <T>(res: Response): Promise<T & { error?: string }> => {
  const text = await res.text();
  try { return JSON.parse(text) as T & { error?: string }; }
  catch { return { error: `non-JSON answer (HTTP ${res.status}): ${text.slice(0, 160)}` } as T & { error?: string }; }
};

const git = (cwd: string, ...args: string[]): string =>
  spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" }).stdout?.toString().trim() ?? "";

// the lane's own scoped credential, read out of the persisted state. `openSlot` mints it and queues
// saveState BEFORE it awaits the pane spawn, so the route can answer a hair before the file carries
// it — poll for the shape, and a timeout still returns the last value read so a genuine absence
// fails its own check instead of hiding in a retry.
async function selfTokenOf(slot: number): Promise<string> {
  let seen = "";
  for (let i = 0; i < 60; i++) {
    try {
      seen = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { selfToken?: string }> }).slots?.[String(slot)]?.selfToken ?? "";
    } catch { /* mid-write */ }
    if (/^[0-9a-f]{32}$/.test(seen)) return seen;
    await Bun.sleep(50);
  }
  return seen;
}

export async function run(): Promise<void> {
  // ===== (LS.meter) THE SUITE METER'S STATION MODEL, RUN — no server, no DOM ====================
  // src/suitemeter.ts decides which station every suite row sits at on the board's thermometer and
  // how its lane is named. The rules are the owner's reading of the meter: one ball per wire row,
  // at the station its run is AT, the lane named so two lanes never read alike.
  {
    const base: MeterInput = { instance: "oldmac", gate: null, audit: null, offers: [], devices: [], slots: [] };
    const at = (m: ReturnType<typeof suiteMeter>) => m.balls.map((b) => `${b.station}:${b.name}:${b.tone}`).sort().join(" ");
    const none = suiteMeter(base);
    check("(LS.meter) a server that sends no gate yields NO balls and an UNKNOWN lock (null), never 'free'",
      none.balls.length === 0 && none.lock === null, JSON.stringify(none));
    const free = suiteMeter({ ...base, gate: { lock: null, reports: [] } });
    check("(LS.meter) a served gate with no lock dir is 'free' and draws nothing",
      free.balls.length === 0 && free.lock === "free", JSON.stringify(free));
    const rep = (slot: number, phase: string, exitCode: number | null = null) =>
      ({ slot, label: `L${slot}`, phase, suite: "e2e-isolated", exitCode, at: slot, origin: "lane", branch: null });
    const phases = suiteMeter({ ...base, gate: { lock: null,
      reports: [rep(1, "waiting"), rep(2, "running"), rep(3, "done", 0), rep(4, "failed", 1)] } });
    check("(LS.meter) a lane's own phases sit at wait / run / done, green and red told apart",
      at(phases) === "done:Slot 3 · L3:ok done:Slot 4 · L4:red run:Slot 2 · L2:plain wait:Slot 1 · L1:plain", at(phases));
    check("(LS.meter) a failed run says its exit code beside the suite",
      phases.balls.find((b) => b.slot === 4)?.what === "e2e-isolated · exit 1",
      JSON.stringify(phases.balls.find((b) => b.slot === 4)));
    const running = suiteMeter({ ...base, gate: { lock: null, reports: [rep(2, "running")] } });
    const done = suiteMeter({ ...base, gate: { lock: null, reports: [rep(2, "done", 0)] } });
    check("(LS.meter) one run keeps ONE key from running to done — the ball moves, it is not replaced",
      running.balls[0]?.key === done.balls[0]?.key && running.balls[0].station !== done.balls[0].station,
      `${running.balls[0]?.key} → ${done.balls[0]?.key}`);
    const offers = suiteMeter({ ...base,
      slots: [{ id: 5, label: null, branch: "fleet/260918203940-4198" }, { id: 6, label: "Queue", branch: "fleet/x-aaaa" }],
      offers: [
        { slot: 5, branch: "fleet/260918203940-4198", state: "open", device: null, at: 1, result: null },
        { slot: 6, branch: "fleet/x-aaaa", state: "claimed", device: "second-host", at: 2, result: null },
        { slot: 7, branch: "fleet/y-bbbb", state: "reported", device: "second-host", at: 3, result: "red" },
      ] });
    check("(LS.meter) offers: open waits, claimed runs on the helper, a red report lands red in done",
      at(offers) === "done:Slot 7 · bbbb:red helper:Slot 6 · Queue:plain wait:Slot 5 · 4198:plain", at(offers));
    const referenced = suiteMeter({ ...base, slots: [{ id: 17, label: "Build", branch: "fleet/x-aaaa", letter: "3A" }],
      gate: { lock: null, reports: [rep(17, "running")] } }).balls[0];
    check("(LS.meter) a lane uses its worktree letter, not a slot-number threshold or branch tail",
      referenced.name === "3A · L17" && phases.balls[0].name === "Slot 1 · L1", referenced.name);
    check("(LS.meter) each run kind has an owner word and a German explanation",
      meterKind("land check").label === "Landprüfung" && meterKind("land check").title.includes("bevor")
        && meterLine(referenced, 1000, true)[0] === "Vorschau"
        && meterKind("post-land check").label === "Nachprüfung", meterLine(referenced, 1000).join(" · "));
    let meterClient = "", meterClientError = "";
    try { meterClient = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8"); }
    catch (e) { meterClientError = e instanceof Error ? e.message : String(e); }
    check("(LS.meter) the right tab uses the German row words and explains them on hover",
      /meterLine\(b, serverClock\(\), true\)/.test(meterClient)
        && /meterKind\(b\.kind\)\.title/.test(meterClient), meterClientError || "suite meter renderer");
    check("(LS.meter) an unlabelled lane is named by its branch's four hex, the part lanes do NOT share",
      laneTail("fleet/260918203940-4198") === "4198" && laneTail("feature/login") === "feature/login",
      `${laneTail("fleet/260918203940-4198")} ${laneTail("feature/login")}`);
    const holder = suiteMeter({ ...base, gate: { lock: { pid: 4242, alive: true, state: "overdue" }, reports: [] } });
    check("(LS.meter) a HELD mutex nobody named still puts a ball in 'run' — an empty run station would say 'nothing runs'",
      holder.lock === "overdue" && at(holder) === "run:check run:warn"
        && holder.balls[0].what === "pid 4242", JSON.stringify(holder));
    const named = suiteMeter({ ...base, gate: { lock: { pid: 4242, alive: true }, reports: [rep(2, "running")] } });
    check("(LS.meter) …but not beside a run that IS named — no phantom second holder",
      named.lock === "held" && at(named) === "run:Slot 2 · L2:plain", at(named));
    const stale = suiteMeter({ ...base, gate: { lock: { pid: 4242, alive: false }, reports: [] } });
    check("(LS.meter) should NOT draw a holder for a STALE lock — a finished suite's leftover dir is an idle machine",
      stale.lock === "stale" && stale.balls.length === 0, JSON.stringify(stale));
    const live = { running: { phase: "running" as const, repo: "claude-fleet", main: "main", mainSha: "abcdef0123456789",
      startedAt: 10, covers: ["fleet/a-1111"] }, waiting: [{ repo: "r", main: "main", branch: "fleet/b-2222", mainAfter: "f00", at: 11 }],
      stats: null };
    const serverAuditRow = { slot: null, label: "claude-fleet", phase: "running", suite: "e2e-isolated", exitCode: null,
      at: 9, origin: "server", branch: null };
    const audit = suiteMeter({ ...base, audit: live, gate: { lock: { pid: 1, alive: true }, reports: [serverAuditRow] } });
    check("(LS.meter) the post-land audit is ONE ball in 'run' (its slotless lock row steps aside), its folded land waits",
      at(audit) === "run:post-land check:plain wait:post-land check:plain"
        && audit.balls.find((b) => b.station === "run")?.what === "main@abcdef01"
        && audit.balls.find((b) => b.station === "wait")?.what === "after 2222", JSON.stringify(audit.balls));
    const onHelper = suiteMeter({ ...base, audit: live,
      devices: [{ name: "second-host", claims: [{ kind: "audit", repo: "claude-fleet", ref: "main", expiresAt: 0 }] }] });
    check("(LS.meter) an audit a helper holds sits at 'helper' and names the device as its PLACE",
      onHelper.balls.find((b) => b.key === "audit:run")?.station === "helper"
        && onHelper.balls.find((b) => b.key === "audit:run")?.where === "second-host", JSON.stringify(onHelper.balls));

    // === WHERE EACH RUN IS (owner, 2026-09-20: the meter is fleet-wide, so every ball must say
    // which machine it is on). The station answered it only by implication, and the one row that
    // did name a device carried it in `what`, the field the column truncates first.
    check("(LS.meter) a run on this box is placed at THIS fleet's own instance name",
      suiteMeter({ ...base, gate: { lock: null, reports: [rep(2, "running")] } }).balls[0]?.where === "oldmac",
      JSON.stringify(suiteMeter({ ...base, gate: { lock: null, reports: [rep(2, "running")] } }).balls[0]));
    // an unnamed fleet says "this machine" rather than inventing a name two hosts could share —
    // the same rule FLEET_INSTANCE itself follows (src/protocol.ts#instanceNameFrom)
    check("(LS.meter) a fleet the operator never named places its runs at 'this machine', never at a made-up name",
      suiteMeter({ ...base, instance: null, gate: { lock: null, reports: [rep(2, "running")] } }).balls[0]?.where === "this machine",
      JSON.stringify(suiteMeter({ ...base, instance: null, gate: { lock: null, reports: [rep(2, "running")] } }).balls[0]));
    const placed = suiteMeter({ ...base, offers: [
      { slot: 5, branch: "fleet/x-aaaa", state: "open", device: null, at: 1, result: null },
      { slot: 6, branch: "fleet/y-bbbb", state: "claimed", device: "second-host", at: 2, result: null }] });
    check("(LS.meter) an offer nobody took is placed 'unclaimed' — never at this machine, where it is NOT running",
      placed.balls.find((b) => b.slot === 5)?.where === "unclaimed"
        && placed.balls.find((b) => b.slot === 6)?.where === "second-host",
      JSON.stringify(placed.balls.map((b) => [b.slot, b.where])));
    check("(LS.meter) every ball carries a place — none is served with an empty one",
      [...placed.balls, ...suiteMeter({ ...base, audit: live, gate: { lock: { pid: 1, alive: true },
        reports: [serverAuditRow] } }).balls].every((b) => b.where.length > 0), "a ball with where: ''");

    // === THE TICKET LINE AT THE MUTEX. e2e-stage.sh queues rather than races, and nothing on any
    // surface said how long that line was: a hand-started ./e2e-isolated.sh takes a ticket and files
    // no verify-intent, so a 20-minute hold used to be drawn with an empty waiting station behind it.
    const q = (n: number, pid: number, alive: boolean, position: number, sinceMs: number | null = 1000) =>
      ({ n, pid, alive, sinceMs, position });
    const queued = suiteMeter({ ...base, gate: { lock: { pid: 900, alive: true },
      reports: [], queue: [q(1, 901, true, 1), q(2, 902, true, 2)] } });
    check("(LS.meter) every live ticket at the mutex is one WAITING ball carrying its own position",
      queued.balls.filter((b) => b.station === "wait").length === 2
        && queued.balls.filter((b) => b.station === "wait").every((b) => meterKind(b.kind).label === "Wartender Prüflauf")
        && queued.balls.some((b) => b.what === "position 1 of 2")
        && queued.balls.some((b) => b.what === "position 2 of 2"),
      JSON.stringify(queued.balls.map((b) => [b.station, b.what])));
    // a ticket whose process is gone is the wrappers' to reap, not this reader's to hide: it is
    // still part of what the directory says, and a silently dropped one would make the line look
    // shorter than the next contender will find it
    const orphan = suiteMeter({ ...base, gate: { lock: null, reports: [], queue: [q(3, 903, false, 0)] } });
    check("(LS.meter) a ticket whose process is gone is SHOWN and said to be gone, never silently dropped",
      orphan.balls.length === 1 && orphan.balls[0].tone === "warn"
        && /its process is gone/.test(orphan.balls[0].what), JSON.stringify(orphan.balls));
    check("(LS.meter) a server that sends no queue draws no waiters — absent is 'not reported', not 'nobody waits'",
      suiteMeter({ ...base, gate: { lock: { pid: 900, alive: true }, reports: [rep(2, "running")] } })
        .balls.filter((b) => b.kind === "queued check run").length === 0, "a phantom waiter");
  }

  if (!REPO) return; // the runner only calls this inside its REPO block, but say so rather than throw

  // the portal's own credential, read once through the OWNER route — the only place it is handed out
  const helperToken = (await bodyOf<{ token?: string }>(await get("/api/helper/token"))).token ?? "";
  const HH = { "x-fleet-helper-token": helperToken };
  const hget = (path: string): Promise<Response> => fetch(BASE + path, { headers: HH });
  const hpost = (path: string, body: unknown): Promise<Response> =>
    post(path, body, { ...HH, "content-type": "application/json" });
  const jobs = async (): Promise<HelperJob[]> =>
    (await bodyOf<HelperJobs>(await hget(`/api/helper/jobs?deviceId=${DEVICE}`))).jobs ?? [];
  // the artefact rail is the one route on this perimeter that takes BYTES and not JSON
  const hpostRaw = (path: string, body: string): Promise<Response> =>
    fetch(BASE + path, { method: "POST", headers: { ...HH, "content-type": "text/plain; charset=utf-8" }, body });

  const selfPost = (path: string, token: string | undefined, body: unknown = {}): Promise<Response> =>
    fetch(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token !== undefined ? { "x-fleet-self-token": token } : {}) },
      body: JSON.stringify(body),
    });
  const selfGet = (path: string, token: string): Promise<Response> =>
    fetch(BASE + path, { headers: { "x-fleet-self-token": token } });
  const offerOf = async (token: string): Promise<OfferPayload> =>
    await bodyOf<OfferPayload>(await selfGet("/api/self/suite-offer", token));
  const gateOf = async (token: string): Promise<{ helper?: HelperPresenceView; error?: string }> =>
    await bodyOf<{ helper?: HelperPresenceView }>(await selfGet("/api/self/gate", token));
  // ONE heartbeat, sent immediately before an offer is MINTED. The offer door refuses to mint while
  // nothing is beating (LS.0), and the harness runs with a deliberately short online window
  // (FLEET_DEVICE_ONLINE_MS in e2e-isolated.sh) so that refusal is observable at all — which means
  // a beat from earlier in this module is not a standing permission and must not be treated as one.
  const beat = (): Promise<Response> => hpost("/api/helper/device", { deviceId: DEVICE, name: DEVICE_NAME });

  // THE RAIL'S TWO READ SURFACES. `events` is the owner poll's own array — the same rows the board
  // renders — and `reds` is the route this cut adds. Both are read fresh on every call: a snapshot
  // taken once and compared twice would turn a row that arrived late into a row that never came.
  const eventsOf = async (): Promise<EventRow[]> =>
    (await bodyOf<{ events?: EventRow[] }>(await get("/api/events"))).events ?? [];
  const suiteEventsFor = async (job: string): Promise<EventRow[]> =>
    (await eventsOf()).filter((e) => e.kind === "lane-suite" && e.subjectJobId === job);
  const redsOf = async (): Promise<RedPreviewRow[]> =>
    (await bodyOf<{ reds?: RedPreviewRow[] }>(await get("/api/lane-suite/reds"))).reds ?? [];

  // the audit ledger, counted in LINES. The main runner boots with no FLEET_POSTLAND_AUDIT_CMD, so
  // the file is typically absent — absent is 0 rows, which is exactly the quantity (LS.5) compares.
  const auditLines = (): number => {
    try { return readFileSync(`${ROOT}/post-land-audits.jsonl`, "utf8").split("\n").filter(Boolean).length; }
    catch { return 0; }
  };

  const ln: Lane = await openLane(REPO, "suiteoffer");
  const laneTok = await selfTokenOf(ln.slot);
  check("(LS) setup: the offering lane carries its own scoped credential",
    /^[0-9a-f]{32}$/.test(laneTok), `slot=${ln.slot} tok=${laneTok.slice(0, 8)}…`);
  // THE FIXTURE THE WHOLE MODULE TURNS ON: work the lane has NOT committed, plus an untracked file.
  // Nothing else in this suite hands a dirty tree to anything.
  const DIRTY = "the uncommitted line the helper must see";
  await Bun.write(`${ln.cwd}/suiteoffer.txt`, `suiteoffer work\n${DIRTY}\n`);
  await Bun.write(`${ln.cwd}/scratch-untracked.txt`, "never travels\n");
  check("(LS) setup: the lane's tree is dirty and carries one untracked file",
    git(ln.cwd, "status", "--porcelain").split("\n").filter(Boolean).length === 2,
    JSON.stringify(git(ln.cwd, "status", "--porcelain")));

  // ===== (LS.1) THE OFFER DOOR — the fifth lane-only route ======================================
  // The two scope rules of the /api/self family run in OPPOSITE directions, so which one a new
  // route joins is a decision, not a default. This one is lane-only: its answer is about a lane's
  // own working tree. A recognized non-lane credential must therefore get 409 and never 401 —
  // 401 would send a session hunting for a token it already holds.
  const sess = await bodyOf<{ slots: { id: number; cwd: string | null }[] }>(await get("/api/sessions"));
  const freeSlot = sess.slots.find((s) => !s.cwd)?.id ?? 0;
  check("(LS) setup: a free slot is available to stand in as a PLAIN (non-lane) session",
    freeSlot > 0, JSON.stringify(sess.slots.map((s) => s.id + (s.cwd ? "*" : ""))));
  await post(`/api/slots/${freeSlot}/open`, { cwd: "~" });
  const plainTok = await selfTokenOf(freeSlot);
  const plainOffer = await selfPost("/api/self/suite-offer", plainTok);
  const plainBody = await bodyOf<OfferPayload>(plainOffer);
  check("(LS) a PLAIN session's credential is refused 409 'not a lane' — never 401",
    plainOffer.status === 409 && (plainBody.error ?? "").includes("not a lane"),
    `${plainOffer.status} ${JSON.stringify(plainBody)}`);
  check("(LS) an unknown self token is refused 401, and a missing one too",
    (await selfPost("/api/self/suite-offer", "0".repeat(32))).status === 401
      && (await selfPost("/api/self/suite-offer", undefined)).status === 401);
  await post(`/api/slots/${freeSlot}/kill`, {});

  // ===== (LS.0) NO MACHINE, NO OFFER ============================================================
  // The rulebook tells a lane to hand its preview to the portal "if a helper device is online", and
  // until this cut a lane could not ask: the register is the OWNER's panel. So a lane in a fleet
  // where nothing was beating got an open job back and then waited out SUITE_OFFER_WAIT_FREE_MS
  // (180 s) for a claim that could not arrive. The rule is now answerable in one round trip.
  //
  // THE PRECONDITION IS MEASURED, NOT ASSUMED. Another module (e2e/watch.ts) enrols a device
  // earlier in this run, and the window is short but not zero — so this block first establishes
  // that nothing is inside it, and if something is, IT fails as itself rather than dressing a
  // timing accident up as a broken door.
  const gate0 = await gateOf(laneTok);
  check("(LS.0) precondition: no helper device is inside the online window at this point in the run",
    gate0.helper !== undefined && gate0.helper.online === false,
    `helper=${JSON.stringify(gate0.helper)}`);
  check("(LS.0) …and the gate carries the presence object itself — a lane can read it without the board",
    gate0.helper !== undefined && typeof gate0.helper.online === "boolean"
      && "name" in gate0.helper && "mode" in gate0.helper && "lastSeenAgeMs" in gate0.helper,
    JSON.stringify(gate0.helper));
  const t0 = Date.now();
  const dryRes = await selfPost("/api/self/suite-offer", laneTok);
  const dry = await bodyOf<OfferPayload>(dryRes);
  const dryMs = Date.now() - t0;
  check("(LS.0) THE OFFER IS REFUSED WITH A REASON, not with 180 s of silence — 200, offer:null",
    dryRes.status === 200 && dry.offer === null && dry.reason === "no helper online" && dryMs < 2000,
    `${dryRes.status} in ${dryMs}ms ${JSON.stringify(dry).slice(0, 200)}`);
  check("(LS.0) …and the refusal carries the same presence reading the gate served",
    dry.helper?.online === false, JSON.stringify(dry.helper));
  check("(LS.0) …and NOTHING was minted: a refused offer leaves no job on the portal",
    !(await jobs()).some((j) => j.kind === "lane-suite"),
    JSON.stringify((await jobs()).map((j) => `${j.kind}:${j.id}`)));

  // …and now a machine beats. The SAME call, the same lane, one heartbeat apart.
  check("(LS.0) setup: a stand-in device registers and is heard from",
    (await beat()).ok);
  const gate1 = await gateOf(laneTok);
  check("(LS.0) the gate flips to online and NAMES the machine that made it true",
    gate1.helper?.online === true && gate1.helper.name === DEVICE_NAME
      && (gate1.helper.lastSeenAgeMs ?? 1e9) < 5000,
    JSON.stringify(gate1.helper));

  const offer1Res = await selfPost("/api/self/suite-offer", laneTok);
  const offer1 = await bodyOf<OfferPayload>(offer1Res);
  check("(LS) the lane offers its preview suite and gets an open job back",
    offer1Res.ok && /^[0-9a-f]{12}$/.test(offer1.offer?.id ?? "") && offer1.offer?.state === "open"
      && offer1.offer.branch === ln.branch && offer1.existing === false,
    `${offer1Res.status} ${JSON.stringify(offer1.offer)}`);
  const jobId = offer1.offer?.id ?? "";
  // (LS.m) THE BOARD'S SUITE METER reads offers off the owner poll (server.ts#suiteOffersView): an
  // offer that never reached /api/sessions is a suite the owner cannot see waiting for a helper.
  const meterRow = async () => ((await (await get("/api/sessions")).json()) as
    { suiteOffers?: { slot: number; branch: string; state: string; device: string | null; result: string | null }[] })
    .suiteOffers?.find((r) => r.slot === ln.slot && r.branch === ln.branch);
  const mOpen = await meterRow();
  check("(LS.m) the owner poll carries the OPEN offer — no device, no result",
    mOpen?.state === "open" && mOpen.device === null && mOpen.result === null, JSON.stringify(mOpen));
  const offer2 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  check("(LS) a second offer returns the SAME job rather than minting a rival",
    offer2.existing === true && offer2.offer?.id === jobId, JSON.stringify(offer2).slice(0, 200));
  const read1 = await offerOf(laneTok);
  check("(LS) the lane reads its own offer back, with the waiting policy and the suite lock",
    read1.offer?.id === jobId && read1.waitPolicy?.freeMs === 180000 && read1.waitPolicy.heldMs === 800000
      && "suiteLock" in read1,
    JSON.stringify({ id: read1.offer?.id, wait: read1.waitPolicy }));

  // ===== (LS.2) ONE JOB LIST, TWO SOURCES =======================================================
  // The portal listed the audit queue and nothing else — `helperJobsView` had a single loop over
  // `auditQueue`, which is precisely why the owner's lane-suite run "tauchte nicht auf". The job
  // below reaches the same list through the second source, and `kind` is the whole difference the
  // other machine sees. (The audit side's `kind:"audit"` is asserted in e2e/helper-portal.ts, where
  // an audit job can exist at all.)
  const listed = (await jobs()).find((j) => j.id === jobId);
  check("(LS) THE OFFER IS IN THE PORTAL'S JOB LIST, marked kind:'lane-suite'",
    listed?.kind === "lane-suite" && listed.main === ln.branch && listed.claim === null,
    JSON.stringify(listed));
  check("(LS) …and it covers no land and claims no local run — a preview is neither",
    listed?.covers === 0 && listed.localRunning === false && listed.branches.join(",") === ln.branch,
    JSON.stringify({ covers: listed?.covers, localRunning: listed?.localRunning, branches: listed?.branches }));

  // ===== (LS.3) THE TREE THAT LEAVES IS THE WORKING TREE ========================================
  // Measured before it was built (design doc §3.1): `git stash create` writes a commit object and
  // LEAVES THE STASH STACK ALONE, which is the only reason it may be used here at all — CLAUDE.md
  // forbids bare `git stash`/`pop` because the stack is shared between the main checkout and every
  // worktree. All three halves are asserted: the uncommitted work travels, the stack is untouched,
  // and the transient ref the bundle needed is gone again.
  const stashBefore = git(ln.cwd, "stash", "list").split("\n").filter(Boolean).length;
  const claimRes = await hpost("/api/helper/claim", { jobId, deviceId: DEVICE });
  const claim = await bodyOf<{ job?: ClaimedJob }>(claimRes);
  check("(LS) the claim names the commit it took, its TREE, the clone branch and the untracked count",
    claimRes.ok && claim.job?.kind === "lane-suite" && /^[0-9a-f]{40}$/.test(claim.job.mainSha)
      && /^[0-9a-f]{40}$/.test(claim.job.treeSha ?? "") && claim.job.branch === `fleet-suite/${jobId}`
      && claim.job.untracked === 1 && claim.job.name === DEVICE_NAME,
    `${claimRes.status} ${JSON.stringify(claim).slice(0, 300)}`);
  const mClaimed = await meterRow();
  check("(LS.m) …then CLAIMED, naming the helper that runs it",
    mClaimed?.state === "claimed" && mClaimed.device === DEVICE_NAME, JSON.stringify(mClaimed));
  check("(LS) claiming an already-claimed preview is a 409 — even for the device that holds it",
    (await hpost("/api/helper/claim", { jobId, deviceId: DEVICE })).status === 409);
  const stashAfter = git(ln.cwd, "stash", "list").split("\n").filter(Boolean).length;
  check("(LS) THE STASH STACK IS UNTOUCHED — it is shared with the main checkout and every worktree",
    stashAfter === stashBefore, `before=${stashBefore} after=${stashAfter}`);
  check("(LS) the transient bundle ref is deleted again — no stray branch in the shared git dir",
    !git(ln.cwd, "show-ref").includes("fleet-suite"),
    git(ln.cwd, "show-ref").split("\n").filter((l) => l.includes("fleet-suite")).join(" | ") || "none");

  const bundleRes = await hget(`/api/helper/bundle/${jobId}`);
  const bytes = new Uint8Array(await bundleRes.arrayBuffer());
  const bundlePath = `${REPO}-lanesuite.bundle`;
  const clonePath = `${REPO}-lanesuite-clone`;
  await Bun.write(bundlePath, bytes);
  spawnSync("rm", ["-rf", clonePath]);
  // `-b` is not cosmetic: a bundle whose only ref is not HEAD clones WITHOUT A WORKING TREE and
  // says nothing about why (design doc M6). The branch name comes from the claim, never rebuilt here.
  const cloned = spawnSync("git", ["clone", "-q", "-b", claim.job?.branch ?? "", bundlePath, clonePath]);
  const clonedFile = ((): string => {
    try { return readFileSync(`${clonePath}/suiteoffer.txt`, "utf8"); } catch { return ""; }
  })();
  check("(LS) the bundle downloads and `git clone -b` produces a real working tree",
    bundleRes.ok && bytes.length > 0 && cloned.status === 0 && clonedFile !== "",
    `status=${bundleRes.status} bytes=${bytes.length} clone=${cloned.status} err=${cloned.stderr?.toString().trim().slice(0, 160)}`);
  check("(LS) THE UNCOMMITTED WORK TRAVELLED — the helper's tree carries what the lane never committed",
    clonedFile.includes(DIRTY),
    `file=${JSON.stringify(clonedFile.slice(0, 120))} head=${spawnSync("git", ["-C", clonePath, "log", "--oneline", "-1"]).stdout?.toString().trim()}`);
  check("(LS) …and the clone's tree is EXACTLY the tree the claim named (content-addressed, so it cannot drift)",
    git(clonePath, "rev-parse", "HEAD^{tree}") === claim.job?.treeSha,
    `clone=${git(clonePath, "rev-parse", "HEAD^{tree}")} claim=${claim.job?.treeSha}`);
  const untrackedInClone = existsSync(`${clonePath}/scratch-untracked.txt`);
  check("(LS) untracked files did NOT travel, and the job says how many stayed behind",
    !untrackedInClone && (await jobs()).find((j) => j.id === jobId)?.untracked === 1,
    `present=${untrackedInClone} untracked=${(await jobs()).find((j) => j.id === jobId)?.untracked}`);

  // ===== (LS.4) THE VERDICT NEVER TOUCHES THE AUDIT LEDGER ======================================
  // `post-land-audits.jsonl` answers joins over `mainSha`/`covers[].mainAfter`. A preview row has
  // neither — it would not FAIL those joins, it would answer them wrong. The positive control (an
  // audit report DOES add exactly one row) is in e2e/helper-portal.ts, where audit jobs exist.
  const ledgerBefore = auditLines();
  const TRAIL = "isolated-20260826T1200Z-9191";
  const resultRes = await hpost("/api/helper/result", {
    jobId, exitCode: 0, trail: TRAIL,
    tail: "PASS  a remote check\nPASS  another remote check\nALL PASS",
    // A MALFORMED clone sha, deliberately. The field arrives off the network, and the server's job
    // is to store a measurement or nothing at all — a rejected value that got stored anyway would
    // be worse than the absence it replaced, because the ledger reads the field as a measurement.
    clonedSha: "not-a-sha",
  });
  const resultBody = await bodyOf<{ kind?: string; result?: string }>(resultRes);
  check("(LS) the preview verdict is accepted and answers as its own kind",
    resultRes.ok && resultBody.kind === "lane-suite" && resultBody.result === "green",
    `${resultRes.status} ${JSON.stringify(resultBody)}`);
  check("(LS) THE AUDIT LEDGER DID NOT MOVE — a preview is not a post-land audit row",
    auditLines() === ledgerBefore, `before=${ledgerBefore} after=${auditLines()}`);
  const mDone = await meterRow();
  check("(LS.m) …then REPORTED green, still naming the helper after the claim is released",
    mDone?.state === "reported" && mDone.result === "green" && mDone.device === DEVICE_NAME, JSON.stringify(mDone));
  check("(LS) reporting released the job from the portal's list",
    !(await jobs()).some((j) => j.id === jobId), JSON.stringify((await jobs()).map((j) => `${j.kind}:${j.id}`)));

  // ===== (LS.5) THE RETURN PATH, WITH ITS PROVENANCE ============================================
  // The exit code and the tail were TYPED IN by a human on another machine (src/helper.ts#doReport
  // validates only /^-?\d+$/). A verdict served without the device name and the timestamps is the
  // one sentence a lane report may never write — "./e2e-isolated.sh green", full stop.
  const reported = await offerOf(laneTok);
  const verdict = reported.offer?.result;
  check("(LS) the lane reads its verdict back: state, exit code, checks and the trail id",
    reported.offer?.state === "reported" && verdict?.result === "green" && verdict.exitCode === 0
      && verdict.checks?.ran === 2 && verdict.checks.failed === 0 && verdict.trail === TRAIL,
    JSON.stringify({ state: reported.offer?.state, r: verdict?.result, e: verdict?.exitCode, c: verdict?.checks, t: verdict?.trail }));
  // …and a GREEN verdict names no failure. The field is PRESENT and EMPTY, which is the honest pair:
  // `result` says green, and an empty list is a measurement, not a missing one. (LS.4b) is the twin.
  check("(LS) a green preview carries an EMPTY fails[] — present, and never an invented name",
    Array.isArray(verdict?.fails) && verdict.fails.length === 0, JSON.stringify(verdict?.fails));
  // The negative half of the 2026-08-29 class-fix (its positive half is in e2e/helper-portal.ts and
  // e2e/helper-daemon.ts): a clone sha that is not one is DROPPED, and absence is what the reader
  // then sees — never the string that was sent.
  check("(LS) a malformed clone sha is refused into ABSENCE, not stored as if it were a measurement",
    verdict?.remote !== undefined && !("clonedSha" in verdict.remote),
    JSON.stringify(verdict?.remote));
  check("(LS) …MARKED REMOTE: the device name and both timestamps travel with the number",
    verdict?.remote?.name === DEVICE_NAME && verdict.remote.claimedAt === claim.job?.claimedAt
      && verdict.remote.reportedAt >= verdict.remote.claimedAt,
    JSON.stringify(verdict?.remote));
  // …and the question the tree sha exists to answer: has MY tree moved since I gave it away? The
  // commit sha wanders with the clock even on identical content (design doc M8); the tree sha does
  // not, so the lane recomputes it the same way the server took it.
  const freshCommit = git(ln.cwd, "stash", "create");
  const freshTree = git(ln.cwd, "rev-parse", `${freshCommit}^{tree}`);
  check("(LS) the verdict names the TREE it is about, and the lane can re-derive it from its own tree",
    verdict?.treeSha === claim.job?.treeSha && freshTree === verdict?.treeSha && /^[0-9a-f]{40}$/.test(freshTree),
    `verdict=${verdict?.treeSha?.slice(0, 8)} claim=${claim.job?.treeSha?.slice(0, 8)} fresh=${freshTree.slice(0, 8)} `
    + `(commit re-derived ${freshCommit.slice(0, 8)} vs claimed ${claim.job?.mainSha.slice(0, 8)} — the commit sha `
    + `carries a whole-second timestamp and may or may not differ; only the tree sha is asserted)`);

  // ===== (LS.4b) A RED PREVIEW MUST NAME WHAT FAILED ============================================
  // MEASURED 2026-09-05 on S2 (lane slot 5, job c893717a): a Second-host preview came back RED after
  // 27 minutes — 1 of 3717 checks — and WHICH one was not answerable from this box. `tail` is
  // HELPER_TAIL_CAP bytes and a real ./e2e-isolated.sh ENDS in its trail checks, so on a run that
  // size the FAIL lines sit hundreds of kilobytes above the retained window. The lane ran the whole
  // suite locally to find out, i.e. the offer cost exactly the run it exists to save.
  //
  // THE REPORT BELOW CARRIES NO `fails` KEY, deliberately — that is what a portal report typed by a
  // human sends (src/helper.ts#doReport) and what any daemon from before 3974883 sends. So this
  // section measures the SERVER's own parser (`localFailNames`, the one the local audit path uses)
  // and not a field passed through: delete that call in reportLaneSuite and these checks go red.
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const redOfferRes = await selfPost("/api/self/suite-offer", laneTok);
  const redOffer = await bodyOf<OfferPayload>(redOfferRes);
  const redJob = redOffer.offer?.id ?? "";
  check("(LS.4b) setup: the lane offers a tree whose preview will come back RED",
    redOfferRes.ok && /^[0-9a-f]{12}$/.test(redJob) && redJob !== jobId,
    `${redOfferRes.status} ${JSON.stringify(redOffer.offer).slice(0, 160)}`);
  check("(LS.4b) setup: the stand-in device claims it",
    (await hpost("/api/helper/claim", { jobId: redJob, deviceId: DEVICE })).ok, redJob);
  // two spaces after FAIL and the harness's `  (detail)` suffix on one of them — the exact shape
  // e2e/harness.ts prints, because a parser that only handles the tidy line is not the one needed
  const RED_TAIL = "PASS  a check that held\n"
    + "FAIL  the land gate refuses a dirty tree  (want=0 got=2)\n"
    + "FAIL  the drift probe answers UNKNOWN as UNKNOWN\n2 FAILURES";
  const redRes = await hpost("/api/helper/result", { jobId: redJob, exitCode: 1, tail: RED_TAIL });
  const redBody = await bodyOf<{ result?: string; artifactAt?: number }>(redRes);
  check("(LS.4b) the red verdict is accepted and hands back the ROW KEY an upload must name",
    redRes.ok && redBody.result === "red" && typeof redBody.artifactAt === "number",
    `${redRes.status} ${JSON.stringify(redBody)}`);
  const redVerdict = (await offerOf(laneTok)).offer?.result;
  check("(LS.4b) THE LANE READS THE NAMES: fails[] carries the check names, detail suffix cut",
    redVerdict?.result === "red" && redVerdict.fails?.length === 2
      && redVerdict.fails[0] === "the land gate refuses a dirty tree"
      && redVerdict.fails[1] === "the drift probe answers UNKNOWN as UNKNOWN",
    JSON.stringify({ r: redVerdict?.result, fails: redVerdict?.fails }));
  check("(LS.4b) …beside the count, not instead of it — a name and a number about the same run",
    redVerdict?.checks?.ran === 3 && redVerdict.checks.failed === 2 && redVerdict.exitCode === 1,
    JSON.stringify(redVerdict?.checks));

  // …AND THE WHOLE LOG BEHIND THEM. `fails[]` names the checks; the artefact rail is where the
  // output AROUND them lives. Until 2026-09-06 the daemon's uploader hung on `auditAt`, a key only
  // an AUDIT receipt carries, so a preview's suite.log died in that daemon's own `finally` on the
  // other machine. Same rail, same route, and still no ledger row — the two facts are independent.
  const REDLOG = `${RED_TAIL}\n`.repeat(64);
  const redSha = createHash("sha256").update(Buffer.from(REDLOG, "utf8")).digest("hex");
  const redUp = await hpostRaw(`/api/helper/artifact/${redJob}?at=${redBody.artifactAt ?? 0}`, REDLOG);
  const redUpBody = await bodyOf<{ artifact?: { bytes?: number; sha256?: string }; result?: string }>(redUp);
  check("(LS.4b) THE PREVIEW'S OWN suite.log UPLOADS, and the receipt echoes the verdict UNCHANGED",
    redUp.ok && redUpBody.artifact?.sha256 === redSha
      && redUpBody.artifact.bytes === Buffer.byteLength(REDLOG, "utf8") && redUpBody.result === "red",
    `${redUp.status} ${JSON.stringify(redUpBody)}`);
  const withArt = (await offerOf(laneTok)).offer?.result?.remote?.artifact;
  check("(LS.4b) …and the offer NAMES it — size, digest and the one route that serves the bytes",
    withArt?.sha256 === redSha && withArt.bytes === Buffer.byteLength(REDLOG, "utf8")
      && withArt.url === `/api/post-land-audits/artifact?at=${redBody.artifactAt ?? 0}`,
    JSON.stringify(withArt));
  check("(LS.4b) a log naming a verdict this preview never gave is 404, never filed onto the newest",
    (await hpostRaw(`/api/helper/artifact/${redJob}?at=1234567890123`, "x")).status === 404);
  check("(LS.4b) THE AUDIT LEDGER STILL DID NOT MOVE — the rail cannot reach it either",
    auditLines() === ledgerBefore, `before=${ledgerBefore} after=${auditLines()}`);

  // ===== (LS.8) THE VERDICT HAS A RAIL — a red preview no longer falls into an unread file ======
  // MEASURED TWICE on 2026-09-11 (jobs 968a80797a57 and 4b5599e7c78c). A reported RED landed in
  // `fleet.json#laneSuiteJobs` and then NOTHING happened: no board element reads that map, the
  // adjudication door is an AUDIT door and a preview is a job, and no watch can fire on it because
  // a lane may not subscribe (/api/self/watch answers a lane 409). The only channel left was the
  // lane writing the red into its own terminal report — so a red the lane did not mention, or did
  // not live to mention, was indistinguishable from a green. The first of the two lay two hours
  // unread; the second was seen only because that lane happened to be disciplined.
  //
  // The same gap has a LANE-facing half, measured 2026-09-12 at slot 4: unable to subscribe, a lane
  // polled GET /api/self/suite-offer turn after turn at the cost of its whole context per poll.
  //
  // THE TWO ROWS BELOW ARE THE FIX, and the asymmetry between them is the whole design. Both come
  // out of ONE mint (server.ts#mintLaneSuiteEvents) at the ONE place a preview verdict is ever
  // written (reportLaneSuite), which is why (LS.9) can prove the negative by construction.
  //
  // NOTHING HERE ASSERTS A DELIVERED PANE. This harness runs FLEET_CMD=true, so no pane is alive to
  // type into and the transport tick turns a pending row `receiver-gone` — which is the transport
  // working, not the rail failing. What is under test is that the ROW EXISTS, names the right
  // receiver, and carries the verdict; the status is printed, never asserted.
  const greenEvents = await suiteEventsFor(jobId);
  const greenLane = greenEvents.find((e) => e.receiverSlot === ln.slot);
  check("(LS.8) A GREEN PREVIEW REACHES THE OFFERING LANE — exactly one row, addressed to its pane",
    greenEvents.length === 1 && greenLane !== undefined && greenLane.delivery === "pane"
      && greenLane.receiverSlot === ln.slot,
    `${greenEvents.length} row(s): ${JSON.stringify(greenEvents.map((e) => ({ r: e.receiverSlot, d: e.delivery, s: e.status })))}`);
  // `idleSec: 0` is the measured half of it (2026-09-07, slot 10): a WORKING session never reaches
  // the 60 s default, so a row that waits for rest is a row that never arrives. And `watchId: null`
  // is the structural half — nobody subscribed, because a lane cannot.
  check("(LS.8) …and it waits for NO IDLE and holds NO watch: the two things a lane could not have",
    greenLane?.receiverIdleSec === 0 && greenLane.watchId === null,
    JSON.stringify({ idleSec: greenLane?.receiverIdleSec, watchId: greenLane?.watchId, status: greenLane?.status }));
  check("(LS.8) …carrying the verdict itself, not a pointer to it: result, exit code and the branch",
    greenLane?.payload?.result === "green" && greenLane.payload.exitCode === 0
      && greenLane.payload.branch === ln.branch && greenLane.payload.tail === "ALL PASS",
    JSON.stringify(greenLane?.payload));
  // THE COUNTER-DIRECTION of the same row, and the one that makes "no gate" checkable: a GREEN
  // preview files NOTHING for the owner. If it did, the rail would be noise within a day and the
  // reds route would stop being a list of things that need eyes.
  check("(LS.8) A GREEN PREVIEW FILES NOTHING FOR THE OWNER — no inbox row, and the reds list ignores it",
    !greenEvents.some((e) => e.receiverSlot === null)
      && !(await redsOf()).some((r) => r.jobId === jobId),
    JSON.stringify((await redsOf()).map((r) => `${r.jobId}:${r.result}`)));

  // …and the red one, which gets BOTH rows. The owner row is the one that does not depend on the
  // lane being well-behaved, or alive.
  const redEvents = await suiteEventsFor(redJob);
  const redLane = redEvents.find((e) => e.receiverSlot === ln.slot);
  const redOwner = redEvents.find((e) => e.receiverSlot === null);
  check("(LS.8) A RED PREVIEW REACHES THE LANE **AND** THE OWNER — two rows, one job, two receivers",
    redEvents.length === 2 && redLane?.delivery === "pane" && redOwner?.delivery === "inbox"
      && redOwner.receiverOpenedAt === null && redOwner.watchId === null,
    `${redEvents.length} row(s): ${JSON.stringify(redEvents.map((e) => ({ r: e.receiverSlot, d: e.delivery, s: e.status })))}`);
  // THE POINT OF THE OWNER ROW: `inbox` is not a pending state, so the transport tick never touches
  // it and no pane can turn it terminal. It is closed by a human reading it, and by nothing else.
  check("(LS.8) …and the owner's row is OUT OF THE TRANSPORT: status `inbox`, no receiver occupant to lose",
    redOwner?.status === "inbox" && redOwner.receiverSlot === null
      && (redOwner.receiverSessionId === undefined || redOwner.receiverSessionId === null),
    JSON.stringify({ status: redOwner?.status, slot: redOwner?.receiverSlot, sess: redOwner?.receiverSessionId }));
  check("(LS.8) …and both rows name WHAT failed, not merely that something did",
    redLane?.payload?.result === "red" && redLane.payload.exitCode === 1
      && redLane.payload.fails?.length === 2
      && redLane.payload.fails[0] === "the land gate refuses a dirty tree"
      && redOwner?.payload?.fails?.length === 2 && redOwner.payload.tail === "2 FAILURES",
    JSON.stringify({ lane: redLane?.payload, owner: redOwner?.payload }));
  // THE SAMPLE IS LABELLED AS ONE. `fails` is capped at LANE_SUITE_EVENT_FAILS_MAX because this row
  // rides the 2 s `/api/sessions` poll under a measured 14 KiB budget (e2e/tasks.ts), so on a real
  // 4000-check suite it is three names out of twelve — and `failCount` is what keeps that honest.
  // Here the two are equal (2 of 2), which is exactly why the check asserts the FIELD and not a
  // difference: a payload that dropped the count would still look right on this fixture.
  check("(LS.8) …and the TRUE failure count rides beside the sample, on both rows",
    redLane?.payload?.failCount === 2 && redOwner?.payload?.failCount === 2
      && greenLane?.payload?.failCount === 0,
    JSON.stringify({ lane: redLane?.payload?.failCount, owner: redOwner?.payload?.failCount,
      green: greenLane?.payload?.failCount }));
  // THE TWO ZEROES ARE DIFFERENT SENTENCES. `failCount === 0` on a GREEN means there were none; on
  // a RED it means the parser found no name in the retained tail — which is the exact state that
  // bought `fails[]` (2026-09-05, job c893717a: red 1 of 3717, and WHICH one was unanswerable from
  // this box). The hint is RENDERED here rather than source-scanned, because that is the only way
  // to see the sentence a pane would actually receive.
  const hintGreen = laneSuiteWatchMessage("j", { id: "e", kind: "lane-suite",
    payload: { result: "green", branch: "b", exitCode: 0, fails: [], failCount: 0, tail: "ALL PASS" } });
  const hintRedBlind = laneSuiteWatchMessage("j", { id: "e", kind: "lane-suite",
    payload: { result: "red", branch: "b", exitCode: 1, fails: [], failCount: 0, tail: "1 FAILURES" } });
  const hintRedCut = laneSuiteWatchMessage("j", { id: "e", kind: "lane-suite",
    payload: { result: "red", branch: "b", exitCode: 1, fails: ["a", "b", "c"], failCount: 12, tail: "12 FAILURES" } });
  check("(LS.8) the pane hint keeps a green's zero apart from a red whose names could not be read",
    hintGreen.includes("no failures") && !hintGreen.includes("could not be read")
      && hintRedBlind.includes("NO failing check name could be read"),
    `green=${JSON.stringify(hintGreen.slice(0, 130))} redBlind=${JSON.stringify(hintRedBlind.slice(0, 150))}`);
  check("(LS.8) …and a TRUNCATED list says so: the true count first, the sample named as a sample",
    hintRedCut.includes("12 failure(s), 3 named here") && hintRedCut.includes("the rest are on the job")
      && hintRedCut.length < 800,
    `${hintRedCut.length}B ${JSON.stringify(hintRedCut.slice(0, 180))}`);

  // ===== (LS.8b) THE STATE IS READABLE WITHOUT THE LANE ==========================================
  // The route reads the OWNER ROWS and joins the job, never the other way round: `laneSuiteJobs` is
  // bounded at LANE_SUITE_KEEP settled offers, so a busy fleet evicts a red out from under an owner
  // who has not looked yet. An open inbox row is never pruned (pruneFleetEvents drops terminal rows
  // only), which is what makes "still open" a durable fact rather than a lucky one.
  const reds = await redsOf();
  const mine = reds.find((r) => r.jobId === redJob);
  check("(LS.8b) THE OPEN RED PREVIEWS ARE A ROUTE: it names this job, its branch and its failures",
    mine !== undefined && mine.result === "red" && mine.branch === ln.branch
      && mine.eventId === redOwner?.id && mine.fails?.length === 2 && mine.failCount === 2
      && mine.status === "inbox",
    `${reds.length} red(s): ${JSON.stringify(reds.map((r) => `${r.jobId}:${r.result}:${r.status}`))}`);
  check("(LS.8b) …with the lane side JOINED, not assumed — which slot offered it and which machine ran it",
    mine?.job?.slot === ln.slot && mine.job.state === "reported" && mine.job.helper === DEVICE_NAME,
    JSON.stringify(mine?.job));
  // THE DOOR IS NAMED ON THE ROW, and it says what acknowledging does NOT do. A preview gates
  // nothing today, and a reader who mistook this list for an adjudication queue would be wrong in
  // the one direction this slice must not move.
  check("(LS.8b) …and the row names its own door and disclaims authority in the same sentence",
    (mine?.door ?? "").includes("/api/events/") && (mine?.door ?? "").includes("gates nothing"),
    JSON.stringify(mine?.door));
  // ACKNOWLEDGING IS WHAT CLOSES IT — the same door every other owner-inbox row uses, so there is
  // no second lifecycle to keep right. After the ack the row is terminal and leaves the list; the
  // fact that it HAPPENED stays on the event.
  const ackRes = await post(`/api/events/${redOwner?.id ?? ""}/ack`, {});
  const ackBody = await bodyOf<{ ok?: boolean; event?: { status?: string } }>(ackRes);
  check("(LS.8b) THE RED IS QUITTIERBAR: one ack closes the row through the ordinary owner door",
    ackRes.ok && ackBody.ok === true && ackBody.event?.status === "acknowledged",
    `${ackRes.status} ${JSON.stringify(ackBody).slice(0, 200)}`);
  check("(LS.8b) …and an acknowledged red leaves the OPEN list while the event itself remains",
    !(await redsOf()).some((r) => r.jobId === redJob)
      && (await suiteEventsFor(redJob)).some((e) => e.receiverSlot === null && e.status === "acknowledged"),
    JSON.stringify((await redsOf()).map((r) => r.jobId)));

  // ===== (LS.6) THE MUTEX: withdrawing is what gives the suite back ==============================
  // "I run it locally" must be a transition the server witnessed, not an intention in a pane —
  // otherwise nothing stops the tree being measured twice, which is the invariant the whole portal
  // exists for. So: withdraw returns 200 and that 200 is the permission; afterwards the job is
  // simply not there to claim.
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const offer3 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const job3 = offer3.offer?.id ?? "";
  check("(LS) a settled offer does not block a new one — the lane may offer the next tree",
    offer3.existing === false && job3 !== jobId, JSON.stringify(offer3.offer).slice(0, 160));
  const wireGet = await offerOf(laneTok);
  const wd = await selfPost("/api/self/suite-offer/withdraw", laneTok);
  const wdBody = await bodyOf<OfferPayload>(wd);
  check("(LS) withdrawing an OPEN offer succeeds, and that 200 is the permission to run locally",
    wd.ok && wdBody.mayRunLocally === true && wdBody.offer?.state === "withdrawn",
    `${wd.status} ${JSON.stringify(wdBody.offer)}`);
  // The POST carries `waitPolicy` since 2026-09-13 (the saturated wait, server.ts#suiteOfferWait):
  // the one key added deliberately, and named here so any OTHER drift still fails this check.
  check("(LS.6) the GET, POST and free-withdraw wire shapes stay byte-for-byte closed over their keys",
    keysOf(wireGet) === "offer,waitPolicy,suiteLock,helper" && keysOf(wireGet.offer) === OFFER_WIRE_KEYS
      && keysOf(offer3) === "offer,existing,helper,waitPolicy" && keysOf(offer3.offer) === OFFER_WIRE_KEYS
      && keysOf(wdBody) === "ok,offer,mayRunLocally" && keysOf(wdBody.offer) === OFFER_WIRE_KEYS,
    JSON.stringify({ get: keysOf(wireGet), getOffer: keysOf(wireGet.offer), post: keysOf(offer3),
      postOffer: keysOf(offer3.offer), withdraw: keysOf(wdBody), withdrawOffer: keysOf(wdBody.offer) }));
  const withdrawnOnDisk = persistedLaneSuiteJob(job3);
  check("(LS.6) a FREE withdrawal persists its end without inventing a former claim",
    withdrawnOnDisk?.state === "withdrawn" && withdrawnOnDisk.claim === null
      && !("claimWas" in withdrawnOnDisk) && typeof withdrawnOnDisk.endedAt === "number"
      && withdrawnOnDisk.endedAt >= withdrawnOnDisk.offeredAt,
    JSON.stringify(withdrawnOnDisk));
  const claimWithdrawn = await hpost("/api/helper/claim", { jobId: job3, deviceId: DEVICE });
  check("(LS) A WITHDRAWN OFFER CANNOT BE CLAIMED — 404, and it is off the list",
    claimWithdrawn.status === 404 && !(await jobs()).some((j) => j.id === job3),
    `${claimWithdrawn.status} ${JSON.stringify(await bodyOf(claimWithdrawn))}`);
  check("(LS) withdrawing when there is no open offer is a 404, not a silent ok",
    (await selfPost("/api/self/suite-offer/withdraw", laneTok)).status === 404);

  // …and the other direction: while a machine really is running it, withdrawing is REFUSED, because
  // a 200 there would authorize the second run. Abandoning is the deliberate override (design doc
  // §5.3): a lane must be able to stop waiting on a helper that took the job and went quiet.
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const offer4 = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const job4 = offer4.offer?.id ?? "";
  const claim4 = await hpost("/api/helper/claim", { jobId: job4, deviceId: DEVICE });
  const claim4Body = await bodyOf<{ job?: ClaimedJob }>(claim4);
  check("(LS) setup: the fourth offer is claimed", claim4.ok, `${claim4.status}`);
  const wdHeld = await selfPost("/api/self/suite-offer/withdraw", laneTok);
  const wdHeldBody = await bodyOf<OfferPayload>(wdHeld);
  check("(LS) withdrawing a CLAIMED offer is refused — a 200 here would authorize a second run",
    wdHeld.status === 409 && (wdHeldBody.error ?? "").includes(DEVICE_NAME),
    `${wdHeld.status} ${JSON.stringify(wdHeldBody).slice(0, 200)}`);
  const wdAbandon = await selfPost("/api/self/suite-offer/withdraw", laneTok, { abandon: true });
  const wdAbandonBody = await bodyOf<OfferPayload>(wdAbandon);
  check("(LS) …and abandoning it deliberately succeeds, so a silent helper cannot deadlock the lane",
    wdAbandon.ok && wdAbandonBody.offer?.state === "abandoned" && wdAbandonBody.mayRunLocally === true,
    `${wdAbandon.status} ${JSON.stringify(wdAbandonBody.offer)}`);
  check("(LS.6) the claimed-withdraw wire stays closed while the durable row keeps holder provenance",
    keysOf(wdAbandonBody) === "ok,offer,mayRunLocally" && keysOf(wdAbandonBody.offer) === OFFER_WIRE_KEYS
      && !("claimWas" in (wdAbandonBody.offer ?? {})) && !("endedAt" in (wdAbandonBody.offer ?? {})),
    JSON.stringify({ withdraw: keysOf(wdAbandonBody), offer: keysOf(wdAbandonBody.offer) }));
  const abandonedOnDisk = persistedLaneSuiteJob(job4);
  check("(LS.6) a CLAIMED abandonment persists the holder, claim lifetime and end while clearing the live claim",
    abandonedOnDisk?.state === "abandoned" && abandonedOnDisk.claim === null
      && abandonedOnDisk.claimWas?.deviceId === DEVICE && abandonedOnDisk.claimWas.name === DEVICE_NAME
      && abandonedOnDisk.claimWas.claimedAt === claim4Body.job?.claimedAt
      && abandonedOnDisk.claimWas.expiresAt === claim4Body.job?.expiresAt
      && keysOf(abandonedOnDisk.claimWas) === "deviceId,name,claimedAt,expiresAt"
      && typeof abandonedOnDisk.endedAt === "number" && abandonedOnDisk.endedAt >= abandonedOnDisk.offeredAt,
    JSON.stringify({ response: claim4Body.job, persisted: abandonedOnDisk }));
  const lateResult = await hpost("/api/helper/result", { jobId: job4, exitCode: 0, tail: "ALL PASS" });
  check("(LS) a verdict arriving after the lane abandoned the job is refused — the lane owns the tree again",
    lateResult.status === 409, `${lateResult.status} ${JSON.stringify(await bodyOf(lateResult))}`);

  await restartSrv();
  await beat();
  const hydrationSave = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const hydrationSaveId = hydrationSave.offer?.id ?? "";
  const hydrationWithdraw = await selfPost("/api/self/suite-offer/withdraw", laneTok);
  const withdrawnAfterRestart = persistedLaneSuiteJob(job3);
  const abandonedAfterRestart = persistedLaneSuiteJob(job4);
  check("(LS.6) BOTH terminal records hydrate across a server restart and survive the next full state write",
    /^[0-9a-f]{12}$/.test(hydrationSaveId) && hydrationWithdraw.ok
      && withdrawnAfterRestart?.state === "withdrawn" && withdrawnAfterRestart.claim === null
      && !("claimWas" in withdrawnAfterRestart) && typeof withdrawnAfterRestart.endedAt === "number"
      && abandonedAfterRestart?.state === "abandoned" && abandonedAfterRestart.claim === null
      && abandonedAfterRestart.claimWas?.deviceId === DEVICE
      && abandonedAfterRestart.claimWas.name === DEVICE_NAME
      && abandonedAfterRestart.claimWas.claimedAt === claim4Body.job?.claimedAt
      && abandonedAfterRestart.claimWas.expiresAt === claim4Body.job?.expiresAt
      && typeof abandonedAfterRestart.endedAt === "number",
    JSON.stringify({ save: hydrationSaveId, free: withdrawnAfterRestart, held: abandonedAfterRestart }));

  // ===== (LS.6c) A MALFORMED VERDICT ON DISK MUST NOT TAKE THE OWNER POLL DOWN ==================
  // Measured, not imagined: a helper preview on 2026-09-20 died with "TypeError: undefined is not
  // an object (evaluating 'j.result.remote.reportedAt')" in suiteOffersView, because loadState
  // restored any persisted job whose id/cwd/state were strings and the meter's view then
  // dereferenced its verdict on the 2 s poll. ONE unreadable row 500'd /api/sessions for every
  // client of the fleet — the widest blast radius a sight-only surface can have.
  {
    const bad = "ffffffffffff";
    const state = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { laneSuiteJobs?: Record<string, unknown>[] };
    const rows = state.laneSuiteJobs ?? [];
    rows.push({ id: bad, slot: 1, slotOpenedAt: Date.now(), repo: REPO, cwd: REPO, branch: "fleet/broken",
      offeredAt: Date.now(), state: "reported", commitSha: null, treeSha: null, untracked: null, claim: null,
      // the shape of an older generation: a verdict with NO remote block at all
      result: { exitCode: 0, result: "green", tail: "ALL PASS", checks: null, fails: [], ms: 1 } });
    state.laneSuiteJobs = rows;
    await Bun.write(`${ROOT}/fleet.json`, JSON.stringify(state));
    await restartSrv();
    const poll = await get("/api/sessions");
    check("(LS.6c) a persisted verdict without a remote block does not break the owner poll",
      poll.ok, `status=${poll.status}`);
    const back = persistedLaneSuiteJob(bad);
    check("(LS.6c) the row survives the restart, its unreadable verdict does not",
      back?.state === "reported" && back.result === null, JSON.stringify(back?.result));
    // …and it LEAVES no fixture behind: a reported job with no verdict reads as an owed run to
    // every later consumer of this state (the program execution view's land door among them), so
    // the row is removed and the server restarted before the next module sees the file.
    const cleaned = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { laneSuiteJobs?: Record<string, unknown>[] };
    cleaned.laneSuiteJobs = (cleaned.laneSuiteJobs ?? []).filter((j) => j.id !== bad);
    await Bun.write(`${ROOT}/fleet.json`, JSON.stringify(cleaned));
    await restartSrv();
    check("(LS.6c) the fixture row is gone again, so no later module inherits an owed preview",
      persistedLaneSuiteJob(bad) === undefined, JSON.stringify(persistedLaneSuiteJob(bad)));
  }

  // ===== (LS.7) THE LANE DISAPPEARS =============================================================
  // There is no drain behind a preview: its only interested party is one lane, and that lane can
  // land or be killed while the offer sits open. Identity is slot + openedAt, never the bare slot id.
  const gone: Lane = await openLane(REPO, "suitegone");
  const goneTok = await selfTokenOf(gone.slot);
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const goneOffer = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", goneTok));
  const goneId = goneOffer.offer?.id ?? "";
  check("(LS) setup: a second lane offers its preview too",
    /^[0-9a-f]{12}$/.test(goneId), JSON.stringify(goneOffer.offer).slice(0, 160));
  await post(`/api/slots/${gone.slot}/kill`, {});
  for (let i = 0; i < 60; i++) {
    const sx = await bodyOf<{ slots: { id: number; cwd: string | null }[] }>(await get("/api/sessions"));
    if (!sx.slots.find((x) => x.id === gone.slot)?.cwd) break;
    await Bun.sleep(100);
  }
  const claimGone = await hpost("/api/helper/claim", { jobId: goneId, deviceId: DEVICE });
  const goneErr = (await bodyOf(claimGone)).error ?? "";
  // TWO refusals are correct here and which one is observed is a race with the 15 s lapse sweep:
  // 404 if the sweep already reaped the offer, 409 if the claim got there first and the liveness
  // check refused it. What is NOT negotiable is the SENTENCE — an offer whose lane was killed must
  // not be described as one the lane withdrew, which is what a shared terminal state made it say
  // on this module's first run.
  check("(LS) an offer whose LANE IS GONE is refused and reaped — nobody spends 13 min on it",
    (claimGone.status === 404 || claimGone.status === 409) && goneErr.includes("is gone")
      && !(await jobs()).some((j) => j.id === goneId),
    `${claimGone.status} ${JSON.stringify(goneErr)}`);

  // ===== (LS.9) THE COUNTER-PROBES — the rail must stay SILENT for everything that is not a verdict
  // A rail that fires on a non-event is worse than no rail: within a week the list is noise and the
  // owner stops reading it, which puts the red back where it was. So the three non-verdict endings
  // a preview has are measured HERE rather than argued from the code — a withdrawal, an abandonment
  // and a lane that died holding an offer.
  //
  // The first two are the jobs (LS.6) already ended: job3 was withdrawn free, job4 was abandoned
  // while the stand-in device held it. Neither ever carried a result, and the mint is reachable
  // from exactly one caller (reportLaneSuite, the only writer of a LaneSuiteResult) — so the
  // absence below is structural rather than a filter somebody has to keep remembering. That is the
  // reason it is worth asserting: the day a second mint site appears, this is what fails.
  check("(LS.9) A WITHDRAWN OFFER RAISES NOTHING — no lane row, no owner row, nothing on the reds list",
    (await suiteEventsFor(job3)).length === 0 && !(await redsOf()).some((r) => r.jobId === job3),
    `events=${JSON.stringify(await suiteEventsFor(job3))} reds=${JSON.stringify((await redsOf()).map((r) => r.jobId))}`);
  check("(LS.9) …and neither does an ABANDONED one, though a machine really was running it",
    (await suiteEventsFor(job4)).length === 0 && !(await redsOf()).some((r) => r.jobId === job4),
    `events=${JSON.stringify(await suiteEventsFor(job4))} reds=${JSON.stringify((await redsOf()).map((r) => r.jobId))}`);
  check("(LS.9) …and an offer whose LANE WAS KILLED raises nothing either — it was reaped, never reported",
    (await suiteEventsFor(goneId)).length === 0,
    JSON.stringify(await suiteEventsFor(goneId)));
  // …AND THE RED ROW SURVIVED THE RESTART (LS.6) — the check that makes the new hydration branch
  // (server/types.ts#fleetEventFrom, `kind === "lane-suite"`) non-vacuous. A validator that
  // rejected the persisted shape would DROP the row at the next boot, and the drop is silent: the
  // reds list would simply be empty again, which is byte-for-byte the failure this slice removes.
  // The row asserted here was acknowledged in (LS.8b), so what is proven is that it hydrates WITH
  // its payload and its terminal state, not merely that something with the right id came back.
  const survived = (await suiteEventsFor(redJob)).find((e) => e.receiverSlot === null);
  check("(LS.9) THE OWNER'S RED ROW HYDRATES ACROSS THE RESTART, payload and terminal state intact",
    survived?.status === "acknowledged" && survived.delivery === "inbox"
      && survived.payload?.result === "red" && survived.payload.fails?.length === 2
      && survived.payload.failCount === 2
      && survived.payload.branch === ln.branch && survived.payload.tail === "2 FAILURES",
    JSON.stringify({ status: survived?.status, payload: survived?.payload }));

  // ===== (LS.9b) A VERDICT FOR A SLOT THAT IS NO LONGER THE OFFERER ==============================
  // Slot ids are recycled, so `openedAt` is the only thing separating the lane that made an offer
  // from whoever holds that number now, and a preview verdict typed into the WRONG session would be
  // worse than none: it is a green about a tree that session never handed over.
  //
  // The refusal that produces the non-delivery is the CLAIM's, one layer up: `expireHelperClaims`
  // runs at the top of every result POST and reaps an offer whose occupation is gone, which clears
  // the live claim — so the verdict never reaches the mint at all. That is the honest reading of
  // this check and it is stated rather than dressed up: what is proven is that the occupation is
  // gone, the verdict is refused BY NAME, and NOTHING was minted for that job.
  const recycled: Lane = await openLane(REPO, "suiterecycle");
  const recycledTok = await selfTokenOf(recycled.slot);
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const recycledOffer = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", recycledTok));
  const recycledJob = recycledOffer.offer?.id ?? "";
  const recycledClaim = await hpost("/api/helper/claim", { jobId: recycledJob, deviceId: DEVICE });
  check("(LS.9b) setup: a lane offers its preview and the stand-in device really claims it",
    /^[0-9a-f]{12}$/.test(recycledJob) && recycledClaim.ok,
    `job=${recycledJob} claim=${recycledClaim.status}`);
  await post(`/api/slots/${recycled.slot}/kill`, {});
  for (let i = 0; i < 60; i++) {
    const sx = await bodyOf<{ slots: { id: number; cwd: string | null }[] }>(await get("/api/sessions"));
    if (!sx.slots.find((x) => x.id === recycled.slot)?.cwd) break;
    await Bun.sleep(100);
  }
  const orphanRes = await hpost("/api/helper/result", { jobId: recycledJob, exitCode: 1, tail: "FAIL  something\n1 FAILURES" });
  const orphanErr = (await bodyOf(orphanRes)).error ?? "";
  check("(LS.9b) THE VERDICT IS REFUSED BY NAME, never typed into whoever holds that slot number now",
    orphanRes.status === 409 && orphanErr.includes("no live claim"),
    `${orphanRes.status} ${JSON.stringify(orphanErr)}`);
  check("(LS.9b) …and NOTHING was minted for it: not a pane row, and not an owner row either",
    (await suiteEventsFor(recycledJob)).length === 0
      && !(await redsOf()).some((r) => r.jobId === recycledJob),
    `events=${JSON.stringify(await suiteEventsFor(recycledJob))}`);

  // ===== (LS.9c) THE ONE SENTENCE THE BRIEF OWES A LANE ==========================================
  // The lane-facing half of this gap was a POLL: unable to subscribe, a lane read
  // GET /api/self/suite-offer turn after turn at the cost of its whole context per poll, and then
  // apologised for it. A delivery nobody is told about is only half a fix, so the founding brief
  // says it — and says it in the exit footer, which is the part of the brief every non-clarify lane
  // gets. Read out of the SERVER's own text rather than a copy, so a reworded footer fails here.
  const footerSrc = readFileSync(`${ROOT}/server.ts`, "utf8");
  const footer = footerSrc.slice(footerSrc.indexOf("function laneExitFooter("));
  const footerText = footer.slice(0, footer.indexOf("\n`;"));
  check("(LS.9c) the founding brief tells a lane the result COMES TO IT, and not to poll for it",
    footerText.includes("/api/self/suite-offer") && /[Dd]o not poll/.test(footerText)
      && footerText.includes("delivered into this pane"),
    JSON.stringify(footerText.slice(Math.max(0, footerText.indexOf("/api/self/suite-offer") - 120),
      footerText.indexOf("/api/self/suite-offer") + 160)));

  // ===== (LS.11) A RED GOES TO THE LANE'S LIVE PROGRAM MAIN, NOT TO THE OWNER ====================
  // The receiver fork of the mint (server.ts#mintLaneSuiteEvents) resolved widest-first: the
  // offering lane's Program. A lane that reports to a coordinator does not park its red on the
  // owner — the owner row is the fallback for a lane with NOWHERE else to go, and the measured
  // 2026-09-22 pile showed exactly what parking every red there costs. The binding is planted
  // rather than bootstrapped (the founding act is e2e/programs.ts's subject): what the fork reads
  // is programOccupancy — slot + openedAt of a living occupation — and a plain open session on a
  // free slot is exactly that. Addressing is asserted, never a pending status: the planted MAIN
  // has no agent, so the transport tick may terminate the pane row on its own schedule, which is
  // the transport working, not this rail failing.
  {
    const pileProgramRes = await post("/api/programs", {
      title: "Lane-suite MAIN routing probe",
      intent: "A program lane's red preview is its MAIN's to see first.",
      successCriterion: "The red row is addressed to the MAIN slot and no owner row exists.",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [] });
    const pileProgram = ((await pileProgramRes.json()) as { program?: { id: string } }).program?.id ?? "";
    await post(`/api/programs/${pileProgram}/confirm`, {});
    await post(`/api/programs/${pileProgram}/activate`, {});
    const freeSlot = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null }[] }).slots.find((s) => !s.cwd)?.id ?? 0;
    const mainOpen = await post(`/api/slots/${freeSlot}/open`, { cwd: REPO, label: "lanesuite-main" });
    let mainOpenedAt = 0;
    for (let i = 0; i < 50 && !mainOpenedAt; i++) {
      try {
        mainOpenedAt = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
          { slots?: Record<string, { openedAt?: number }> }).slots?.[String(freeSlot)]?.openedAt ?? 0;
      } catch { /* atomic state rename can race this read; retry */ }
      if (!mainOpenedAt) await Bun.sleep(100);
    }
    await stopSrv();
    const pileState = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { programs?: { id: string; main?: unknown }[] };
    for (const p of pileState.programs ?? []) if (p.id === pileProgram)
      p.main = { slot: freeSlot, openedAt: mainOpenedAt, sessionId: null, boundAt: Date.now() };
    writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(pileState, null, 2), { mode: 0o600 });
    await restartSrv();
    const pileTask = (await (await post("/api/tasks", { text: "lane-suite MAIN routing probe lane",
      repo: REPO, programId: pileProgram })).json()) as { task: { id: string } };
    const pileDispatch = await post(`/api/tasks/${pileTask.task.id}/dispatch`, {});
    const pileSlot = ((await pileDispatch.json()) as { slot?: number }).slot ?? 0;
    const pileTok = pileSlot ? await selfTokenOf(pileSlot) : "";
    check("(LS.11) setup: an activated program with a planted live MAIN, and a program-bound lane with a token",
      pileProgramRes.ok && !!pileProgram && mainOpen.ok && mainOpenedAt > 0 && pileSlot > 0 && !!pileTok,
      JSON.stringify({ program: pileProgram, main: [freeSlot, mainOpenedAt], lane: pileSlot, tok: !!pileTok }));
    await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
    const mainOffer = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", pileTok));
    const mainJob = mainOffer.offer?.id ?? "";
    const mainClaim = await hpost("/api/helper/claim", { jobId: mainJob, deviceId: DEVICE });
    const mainRed = await hpost("/api/helper/result", { jobId: mainJob, exitCode: 1,
      tail: "FAIL  something\\n1 FAILURES" });
    const mainRows = await suiteEventsFor(mainJob);
    check("(LS.11) A PROGRAM LANE'S RED IS ADDRESSED TO ITS LIVE MAIN — two pane rows, and NO owner row, on the reds list, nowhere",
      /^[0-9a-f]{12}$/.test(mainJob) && mainClaim.ok && mainRed.ok
        && mainRows.length === 2
        && mainRows.some((e) => e.receiverSlot === pileSlot && e.delivery === "pane")
        && mainRows.some((e) => e.receiverSlot === freeSlot && e.delivery === "pane")
        && !mainRows.some((e) => e.receiverSlot === null)
        && !(await redsOf()).some((r) => r.jobId === mainJob),
      `${mainRed.status} rows=${JSON.stringify(mainRows.map((e) => ({ r: e.receiverSlot, d: e.delivery, s: e.status })))}`);
    await post(`/api/slots/${pileSlot}/kill`, {});
    await post(`/api/slots/${freeSlot}/kill`, {});
    await post(`/api/tasks/${pileTask.task.id}/delete`, {});
    await post(`/api/programs/${pileProgram}/complete`, {});
  }

  // ===== (LS.10) THE OWNER ROW CLOSES ITSELF WHEN THE LANE IS GONE ===============================
  // MEASURED 2026-09-22: 16 open red previews sat in the owner inbox although every lane behind
  // them was long gone — the row's only lifecycle was a human ack. The sweep
  // (server.ts#markFleetEventsSubjectGone) now closes an inbox row whose subject occupation ended:
  // terminal subject-gone, the named "lane gone" reason in the trail, off the reds list. The row
  // below is minted while the lane is ALIVE — the measured shape: the verdict arrived, the lane
  // ended afterwards, and nobody was left to ack anything.
  await beat(); // the mint gate wants a machine that is beating NOW (LS.0)
  const pileOffer = await bodyOf<OfferPayload>(await selfPost("/api/self/suite-offer", laneTok));
  const pileJob = pileOffer.offer?.id ?? "";
  check("(LS.10) setup: the lane offers one more preview and the stand-in device claims and REDS it",
    /^[0-9a-f]{12}$/.test(pileJob)
      && (await hpost("/api/helper/claim", { jobId: pileJob, deviceId: DEVICE })).ok
      && (await hpost("/api/helper/result", { jobId: pileJob, exitCode: 1, tail: RED_TAIL })).ok,
    `job=${pileJob}`);
  const pileOwner = (await suiteEventsFor(pileJob)).find((e) => e.receiverSlot === null);
  check("(LS.10) …and while the lane lives, its red sits OPEN in the owner inbox, on the reds list",
    pileOwner?.status === "inbox" && (await redsOf()).some((r) => r.jobId === pileJob),
    JSON.stringify({ status: pileOwner?.status, reds: (await redsOf()).map((r) => r.jobId) }));
  await post(`/api/slots/${ln.slot}/kill`, {});
  const pileClosed = (await suiteEventsFor(pileJob)).find((e) => e.receiverSlot === null);
  // The sweep itself runs synchronously INSIDE the kill route — the row is terminal before the
  // route answers — but its trail line does not travel with it: audit() is deliberately
  // fire-and-forget (server/audit-log.ts, server/persist.ts#queueEventWrite — a wedged disk must
  // never block the request path), so the line lands on audit.jsonl an awaitable moment AFTER the
  // kill has returned. MEASURED 2026-09-22: a red run read {"status":"subject-gone","trail":
  // false,"reds":[]} — row already closed, file read ~137 ms after the kill still without the
  // line (docs/verify-tiering.md §11.2ae). The statement is unchanged: the read waits on the
  // FACT (harness until), it does not race the writer; a line that never appears is still red.
  let pileTrail = false;
  try {
    await until(() => readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n")
        .some((l) => l.includes(`"event":"fleet_event_subject_gone"`) && l.includes(pileOwner?.id ?? "never")
          && l.includes("lane gone")),
      { timeoutMs: 10_000, what: "the owner row's subject-gone trail line" });
    pileTrail = true;
  } catch (e) {
    if (!(e instanceof UntilTimeout)) throw e; // the check below reports the miss: trail:false
  }
  check("(LS.10) THE LANE DIES, THE ROW CLOSES ITSELF: subject-gone with the named lane-gone reason in the trail, never acknowledged, off the reds list",
    pileClosed?.status === "subject-gone"
      && !(await redsOf()).some((r) => r.jobId === pileJob) && pileTrail,
    JSON.stringify({ status: pileClosed?.status, trail: pileTrail,
      reds: (await redsOf()).map((r) => r.jobId) }));

  // cleanup: the scratch clone and bundle (the offering lane's slot is already killed above)
  spawnSync("rm", ["-rf", clonePath]);
  spawnSync("rm", ["-f", bundlePath]);
}

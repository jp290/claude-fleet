// THE OUTBOUND CHANNEL for the two completion predicates (server.ts, Watch + tickWatches): the
// original clean+ahead `doneLooking`, and the distinct dirty+zero-ahead `hostCommitLooking` for a
// fenced harness whose host owns the commit. A watch is a subscription — one slot asks to be told,
// ONCE, when another slot reaches either shape.
//
// What these checks are really guarding is the difference between a notification and a verdict.
// The message must carry the facts it fired on (branch, ahead/dirty) AND say that "looks done" is a
// predicate, not a report from the lane — CLAUDE.md's four look-alike states are indistinguishable
// to it. A message that read as "it is finished" would turn a wait-remover into a land-trigger.
//
// Timing: the harness shrinks the idle gate (FLEET_AUTO_REVIEW_IDLE_MS=1500) and the delivery tick
// (FLEET_AUTOS_TICK_MS), but the git facts the predicate reads refresh on the 10s tickGit, so the
// first fire cannot happen sooner than that. Every wait here is a POLL with a loud bound, never a
// fixed sleep.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { auditWatchMessage, laneHostCommitLooking, laneSpentLooking, laneStalled, laneWatchEventKind, laneWatchMessage, laneWatchPayload, laneWatchSignal,
  SPENT_RULES, STALLED_RULES,
  type AuditWatchEventPayload, type AuditWatchEventView, type ClarificationEventPayload, type LaneSignalView,
  type LaneWatchEventPayload } from "../lane-signals";
import { composerArrival, composerBuffer, composerHoldsExactly, composerResidue, composerRows,
  type ComposerArrival } from "../composer";
import { FLEET_REPORT_STATUSES, type FleetReportEventPayload, type FleetReportStatus } from "../src/protocol";
import { PANE_ACK_STALE_MS, opsOpen, opsUnacked, opsPollRow, opsPollVisible, opsSubject, opsSummary,
  type OpsPollSource } from "../src/opsevents";
// the terminal status words, taken from the one place that defines them rather than re-listed here:
// the retention check below counts exactly the rows pruneFleetEvents counts.
import { FLEET_EVENT_TERMINAL } from "../server/types";
import { AUTOS_TICK_MS, BASE, INSTANCE_NAME, REPO, ROOT, TOKEN, check, get, paneEnv, plogRead, post, restartSrv, stopSrv, srvEnv, tmuxOut } from "./harness";

interface WatchRow {
  id: string; slot: number; target: number; targetCwd: string; targetBranch: string;
  kind?: "lane" | "merge" | "audit" | "deploy" | "transition" | "job";
  slotOpenedAt?: number;
  created?: number;
  // absent = the legacy pane transport; the server never backfills it (see WatchBase)
  delivery?: "pane" | "inbox";
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
type FleetEventStatus = "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone"
  | "subject-gone" | "inbox";
interface FleetEventRow {
  id: string; watchId: string;
  receiverSlot: number; receiverOpenedAt: number; receiverSessionId: string | null; receiverIdleSec: number;
  subjectSlot: number; subjectBranch: string;
  kind: "lane-ready" | "host-commit-ready"; payload: LaneWatchEventPayload;
  createdAt: number; status: FleetEventStatus; attempts: number;
  deliveredAt: number | null; acknowledgedAt: number | null; delivery?: "pane" | "inbox";
}
const ACP26_AUDIT_FIXTURES: { repo: string; mainAfter: string; event: AuditWatchEventView }[] = [
  { repo: "/Users/owner/claude-fleet", mainAfter: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1",
    event: { id: "f426d94b8bb603d354c6e570", kind: "post-land-audit", payload: {
      result: "green", mainSha: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1",
      covers: [{ branch: "fleet/260822162835-53ca", mainAfter: "135ea83b91a27d2b348b40c6e65e9bd665f3cdf1" }],
      checks: { ran: 2847, failed: 0 },
    } } },
  { repo: "/Users/owner/claude-fleet", mainAfter: "d93ab4a19f72ba0e031290b25ba14591852cc541",
    event: { id: "df8ca5c5b526e30582e56249", kind: "post-land-audit", payload: {
      result: "green", mainSha: "d93ab4a19f72ba0e031290b25ba14591852cc541",
      covers: [{ branch: "fleet/260823182201-a33f", mainAfter: "d93ab4a19f72ba0e031290b25ba14591852cc541" }],
      checks: { ran: 2946, failed: 0 },
    } } },
];
interface DeployWatchRow {
  id: string; kind: "deploy"; slot: number; deployId: string;
  slotOpenedAt?: number; delivery?: "pane" | "inbox";
  armed: boolean; firedAt: number | null; lastResult: string | null;
}
interface DeployEventRow {
  id: string; watchId: string; receiverSlot: number; receiverOpenedAt: number;
  receiverSessionId: string | null; kind: "deploy-terminal"; subjectDeployId: string;
  payload: { ok: boolean | null; stage: "build" | "restart" | "boot"; target: string | null;
    bootHead: string | null; hitTarget: boolean | null; bundleStale: boolean | null; at: number; reason?: string };
  status: FleetEventStatus; attempts: number; acknowledgedAt: number | null;
  deliveredAt: number | null; delivery?: "pane" | "inbox";
}
interface ClarificationRow {
  id: string; askedAt: number; question: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  provenance: { taskId: string | null; originId: string | null; programId: string | null };
  receiver: { slot: number; openedAt: number; sessionId: string | null };
  basis: "program-main" | "lane-watch" | "program-main+lane-watch"; eventId: string;
  status: "open" | "send-uncertain" | "answered" | "refused";
  answer: { text: string; at: number; by: { slot: number; openedAt: number; sessionId: string | null } } | null;
  refusedReason: string | null; closedAt: number | null;
}
interface ClarificationEventRow {
  id: string; watchId: null; receiverSlot: number; receiverOpenedAt: number;
  receiverSessionId: string | null; receiverIdleSec: number; subjectSlot: number; subjectBranch: string;
  kind: "clarification-request"; payload: ClarificationEventPayload; createdAt: number;
  status: FleetEventStatus; attempts: number; deliveredAt: number | null; acknowledgedAt: number | null;
}
interface FleetReportRow {
  id: string; reportedAt: number; status: FleetReportStatus; text: string;
  worker: { slot: number; openedAt: number; sessionId: string | null; cwd: string; branch: string };
  // `instance` absent = a row persisted before the field existed (dual-host Schnitt 2)
  provenance: { taskId: string | null; originId: string | null; programId: string | null;
    instance?: string | null };
  // null exactly when basis is "owner-inbox" or "program" — neither principal is an occupant
  receiver: { slot: number; openedAt: number; sessionId: string | null } | null;
  basis: "program-main" | "lane-watch" | "program-main+lane-watch" | "owner-inbox" | "program";
  eventId: string | null;
  // absent or null = undecided; present = the receiving MAIN judged the work (D1) — or, when the
  // occupant it was filed to is gone, the OWNER through the door beside it (D3). "owner" is a
  // principal and carries no occupant triple, exactly as AttentionRequest.answer.by does not.
  decision?: { disposition: "accepted" | "rejected"; at: number;
    by: { slot: number; openedAt: number; sessionId: string | null } | "owner";
    reason: string | null } | null;
}
// `decision.by` is an OCCUPANT or the literal "owner" (D3). Every check that asserts an occupant
// verdict reads it through here, so an owner stamp landing where a MAIN's belongs fails as a
// missing occupant instead of quietly comparing against an absent field.
const decisionOccupant = (d: FleetReportRow["decision"]):
  { slot: number; openedAt: number; sessionId: string | null } | null =>
  !d || d.by === "owner" ? null : d.by;
interface FleetReportEventRow {
  id: string; watchId: null; receiverSlot: number | null; receiverOpenedAt: number | null;
  receiverSessionId: string | null; receiverIdleSec: number; subjectSlot: number; subjectBranch: string;
  kind: "fleet-report"; payload: FleetReportEventPayload; createdAt: number;
  status: FleetEventStatus; attempts: number; deliveredAt: number | null; acknowledgedAt: number | null;
  delivery?: "pane" | "inbox";
  recovery?: { state: "retryable" | "blocked" | "terminal"; reason: string; nextAction: string;
    effect: string; updatedAt: number };
}
const watchRows = async (): Promise<WatchRow[]> =>
  ((await (await get("/api/sessions")).json()) as { watches: WatchRow[] }).watches;
const watchRow = async (id: string): Promise<WatchRow | undefined> =>
  (await watchRows()).find((w) => w.id === id);
const eventRows = async (): Promise<FleetEventRow[]> =>
  ((await (await get("/api/events")).json()) as { events: FleetEventRow[] }).events;
const eventForWatch = async (watchId: string): Promise<FleetEventRow | undefined> =>
  (await eventRows()).find((e) => e.watchId === watchId);
const deployWatchRows = async (): Promise<DeployWatchRow[]> =>
  (((await (await get("/api/sessions")).json()) as { watches: unknown[] }).watches as DeployWatchRow[])
    .filter((w) => w.kind === "deploy");
const deployEventRows = async (): Promise<DeployEventRow[]> =>
  (((await (await get("/api/events")).json()) as { events: unknown[] }).events as DeployEventRow[])
    .filter((e) => e.kind === "deploy-terminal");
const waitDeployEvent = async (watchId: string): Promise<DeployEventRow | undefined> => {
  let found: DeployEventRow | undefined;
  for (let i = 0; i < 120; i++) {
    found = (await deployEventRows()).find((e) => e.watchId === watchId);
    if (found?.status === "delivered" || found?.status === "acknowledged") return found;
    await Bun.sleep(100);
  }
  return found;
};
const freeSlot = async (): Promise<number> =>
  ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] })
    .slots.find((x) => x.cwd === null)?.id ?? 0;
const persistedOpenedAt = (slot: number): number | undefined =>
  (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots?: Record<string, { openedAt?: number }> }).slots?.[String(slot)]?.openedAt;
const selfWatch = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/watch`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfGet = (tok: string): Promise<Response> =>
  fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": tok } });
const ackEvent = (tok: string | null, id: string): Promise<Response> =>
  fetch(`${BASE}/api/self/events/${id}/ack`, {
    method: "POST",
    headers: tok === null ? {} : { "x-fleet-self-token": tok },
  });
// the OWNER half of the report rail: the view that shows a row no session can judge, and the two
// acts that settle it. Both carry the owner token like every other owner route in this file.
const ownerReports = async (): Promise<(FleetReportRow & { liveness: string })[]> =>
  ((await (await get("/api/fleet-report")).json()) as
    { reports?: (FleetReportRow & { liveness: string })[] }).reports ?? [];
const ownerDecideReport = (id: string, verdict: "accept" | "reject",
  body?: unknown): Promise<Response> =>
  post(`/api/fleet-report/${id}/${verdict}`, body === undefined ? {} : body);
const decideReport = (tok: string | null, id: string, verdict: "accept" | "reject",
  body?: unknown, raw?: string): Promise<Response> =>
  fetch(`${BASE}/api/self/fleet-report/${id}/${verdict}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: raw ?? (body === undefined ? "" : JSON.stringify(body)),
  });
const selfClarify = (tok: string | null, body: unknown, raw?: string, contentType = "application/json"): Promise<Response> =>
  fetch(`${BASE}/api/self/clarifications`, {
    method: "POST",
    headers: { "content-type": contentType, ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: raw ?? JSON.stringify(body),
  });
const selfClarifications = async (tok: string): Promise<{ response: Response; requests: ClarificationRow[] }> => {
  const response = await fetch(`${BASE}/api/self/clarifications`, {
    headers: { "x-fleet-self-token": tok },
  });
  const body = await response.json() as { requests?: ClarificationRow[] };
  return { response, requests: body.requests ?? [] };
};
const replyClarification = (tok: string, id: string, text: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/clarifications/${id}/reply`, {
    method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": tok },
    body: JSON.stringify({ text }),
  });
const clarificationEventRows = async (): Promise<ClarificationEventRow[]> =>
  (((await (await get("/api/events")).json()) as { events: unknown[] }).events as ClarificationEventRow[])
    .filter((e) => e.kind === "clarification-request");
const selfFleetReport = (tok: string | null, body: unknown): Promise<Response> =>
  fetch(`${BASE}/api/self/fleet-report`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(tok === null ? {} : { "x-fleet-self-token": tok }) },
    body: JSON.stringify(body),
  });
const selfFleetReports = async (tok: string): Promise<{ response: Response; reports: FleetReportRow[] }> => {
  const response = await fetch(`${BASE}/api/self/fleet-report`, {
    headers: { "x-fleet-self-token": tok },
  });
  const body = await response.json() as { reports?: FleetReportRow[] };
  return { response, reports: body.reports ?? [] };
};
const fleetReportEventRows = async (): Promise<FleetReportEventRow[]> =>
  (((await (await get("/api/events")).json()) as { events: unknown[] }).events as FleetReportEventRow[])
    .filter((e) => e.kind === "fleet-report");
// V1b — the return-path projection, read off the ROUTE. It is derived per request and persisted
// nowhere, so a fleet.json read would answer `undefined` for every program and look like a missing
// field rather than a reader asking the wrong source.
interface ProgramBudgetRow {
  id: string;
  deliveryBudget?: { state?: string; deliveryDebts?: number; armedReservations?: number;
    cap?: number; free?: number; reason?: string };
  deliveryBudgetNote?: string;
}
const programBudget = async (id: string): Promise<ProgramBudgetRow | undefined> =>
  (((await (await get("/api/programs")).json()) as { programs: ProgramBudgetRow[] }).programs)
    .find((p) => p.id === id);
interface AuditRow { event?: string; slot?: number; detail?: string; ts?: number;
  // the machine-readable half `audit()` offers beside the prose detail. `fleet_event_held` uses it
  // for the hold backoff (server.ts#noteComposerHold): which phase this row is, how many refusals
  // this row/occupant pair has collected, the silence the server just promised itself, and how
  // long the pane has been holding. All four come from ONE clock read inside the writer, which is
  // why `heldMs` can be differenced exactly while two `ts` values cannot.
  phase?: string; holds?: number; nextProbeInMs?: number; heldMs?: number }
let auditReadError = "";
const auditRows = (): AuditRow[] => [
  { file: `${ROOT}/audit.jsonl.1`, required: false },
  { file: `${ROOT}/audit.jsonl`, required: true },
].flatMap(({ file, required }) => {
  try {
    return readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line) as AuditRow]; }
      catch (error) {
        auditReadError = `${file}: ${error instanceof Error ? error.message : String(error)}`;
        return [];
      }
    });
  } catch (error) {
    if (required) auditReadError = `${file}: ${error instanceof Error ? error.message : String(error)}`;
    return [];
  }
});

// === A SESSION ID LEARNED LATE (66df05b4) ========================================================
// Measured 2026-09-05 (D1, acceptance-probe.ts "codex chain"): a Codex receiver's event was minted
// with receiverSessionId null (watch_fire …297850), the SAME pane then learned its id (codex_bind
// …298601), the event was delivered (…298906) — and its own receiver's ACK came back 409 "event
// belongs to a replaced session". Nothing was replaced: slot and openedAt never moved, only the
// id went from unknown to known inside one occupation.
//
// The events are PLANTED with srv down, the file's binding-fixture technique, because what is under
// test is the identity boundary and not the transport. The learn itself is NEVER planted: it is the
// server's own codex_bind tick over a synthetic rollout, so the provenance the fix relies on is
// produced by the writer that produces it live. Every refusal the fix must keep sits beside the
// positive, each on its own row so a red names exactly one case.
async function runLearnedSessionAck(): Promise<void> {
  const codexRoot = process.env.FLEET_CODEX_SESSIONS_DIR ?? "";
  const codexCwd = REPO ? resolve(REPO) : "";
  const codexPath = `${ROOT}/codex-bin:${process.env.PATH ?? ""}`;
  check("learned-id fixture: a scratch Codex sessions root, the stand-in binary and an exact cwd exist",
    !!codexRoot && !!codexCwd && existsSync(`${ROOT}/codex-bin/codex`), `${codexRoot} / ${codexCwd}`);
  if (!codexRoot || !codexCwd) return;
  // the stand-in binary must be on the server's PATH or the pane dies and the heal loop keeps moving
  // codexPaneSpawnedAt, which is the discovery window the bind below depends on
  await restartSrv({ PATH: codexPath });
  const slot = await freeSlot();
  const opened = slot ? await post(`/api/slots/${slot}/open`, { cwd: codexCwd, harness: "codex" }) : null;
  const persisted = (): { slots?: Record<string, { openedAt?: number; selfToken?: string;
    sessionId?: string | null; sessionIdLearned?: unknown }> } =>
    JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8"));
  const row = persisted().slots?.[String(slot)];
  const openedAt = row?.openedAt ?? 0;
  const tok = row?.selfToken ?? "";
  // a foreign principal: any other live occupant's credential (fleet.json persists occupied slots only)
  const foreign = Object.entries(persisted().slots ?? {}).find(([id, r]) => id !== String(slot) && r.selfToken);
  const foreignTok = foreign?.[1].selfToken ?? "";
  check("learned-id fixture: a Codex receiver opens with an unknown session id, its own token and a foreign one",
    !!opened?.ok && openedAt > 0 && tok !== "" && foreignTok !== "" && row?.sessionId === null,
    JSON.stringify({ slot, status: opened?.status, openedAt, sessionId: row?.sessionId, foreign: !!foreignTok }));
  if (!opened?.ok || openedAt <= 0 || !tok) return;

  const now = Date.now();
  const deployRow = (id: string, over: Record<string, unknown>): Record<string, unknown> => ({
    id, watchId: `${id}w`, receiverSlot: slot, receiverOpenedAt: openedAt, receiverSessionId: null,
    receiverIdleSec: 0, kind: "deploy-terminal", subjectDeployId: "0c0dec0d",
    payload: { ok: true, stage: "boot", target: null, bootHead: null, hitTarget: null, bundleStale: null, at: now },
    createdAt: now - 2000, status: "delivered", attempts: 1, deliveredAt: now - 1500, acknowledgedAt: null,
    delivery: "pane", ...over,
  });
  const ids = {
    learned: "lsidlearned0000000000001", // null, delivered, minted before the learn: the D1 row
    second: "lsidlearned0000000000002",  // the same shape, for the foreign token and the restart
    pending: "lsidlearned0000000000003", // null, minted before the learn, never delivered
    stranger: "lsidlearned0000000000004", // minted for a DIFFERENT known session id on the same occupation
    after: "lsidlearned0000000000005",   // null, but minted AFTER the learn — no provenance covers it
    legacy: "lsidlearned0000000000006",  // null, on a slot whose persisted row carries no provenance
  };
  const STRANGER = "20000000-0000-4000-8000-00000000000b";
  await stopSrv();
  const plant = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { events?: Record<string, unknown>[] };
  plant.events = [...(plant.events ?? []),
    deployRow(ids.learned, {}), deployRow(ids.second, {}),
    // an idle gate of a day holds it pending on a live pane: only an identity verdict can end it
    deployRow(ids.pending, { status: "pending", attempts: 0, deliveredAt: null, receiverIdleSec: 86_400 }),
    deployRow(ids.stranger, { receiverSessionId: STRANGER }),
    deployRow(ids.after, { createdAt: now + 10 * 60_000 })];
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(plant, null, 2), { mode: 0o600 });
  await restartSrv({ PATH: codexPath });
  const evRow = async (id: string): Promise<{ id: string; status: string; acknowledgedAt: number | null;
    receiverSessionId: string | null } | undefined> =>
    ((await (await get("/api/events")).json()) as { events: { id: string; status: string;
      acknowledgedAt: number | null; receiverSessionId: string | null }[] }).events.find((e) => e.id === id);
  // the stranger row is turned receiver-gone by the EXISTING boot reconciliation (a known id that is
  // not this occupant's) — measured on the unfixed tree; its ACK below is judged on identity alone,
  // which acknowledgeFleetEvent asks before it asks about status
  check("learned-id fixture: the planted rows hydrate against the unknown-id occupant (the stranger already receiver-gone)",
    (await evRow(ids.learned))?.status === "delivered" && (await evRow(ids.pending))?.status === "pending"
      && (await evRow(ids.stranger))?.status === "receiver-gone" && (await evRow(ids.after))?.status === "delivered",
    JSON.stringify(await Promise.all(Object.values(ids).map(evRow))));

  // THE LEARN: exactly one user rollout for this cwd inside the pane's discovery window
  const LEARNED = "20000000-0000-4000-8000-00000000000a";
  const d = new Date();
  const dir = `${codexRoot}/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  mkdirSync(dir, { recursive: true });
  const rollout = `${dir}/rollout-${Date.now()}-${LEARNED}.jsonl`;
  writeFileSync(rollout, `${JSON.stringify({ type: "session_meta", payload: {
    id: LEARNED, cwd: codexCwd, timestamp: new Date().toISOString(), thread_source: "user", originator: "codex-tui" } })}\n`);
  let learnedId: string | null | undefined = null;
  for (let i = 0; i < 100 && learnedId !== LEARNED; i++) {
    await Bun.sleep(250);
    learnedId = persisted().slots?.[String(slot)]?.sessionId;
  }
  const bindLine = auditRows().filter((a) => a.event === "codex_bind" && a.slot === slot && a.detail === `session=${LEARNED}`);
  check("learned-id fixture: the server's own codex_bind tick taught the SAME occupation its id",
    learnedId === LEARNED && persisted().slots?.[String(slot)]?.openedAt === openedAt && bindLine.length === 1,
    JSON.stringify({ learnedId, openedAt: persisted().slots?.[String(slot)]?.openedAt, binds: bindLine.length }));

  // (1) THE D1 CASE — the receiver acknowledges exactly this event and the ACK is stored
  const ack = await ackEvent(tok, ids.learned);
  const ackText = await ack.text();
  const acked = await evRow(ids.learned);
  check("learned id: the same occupant acknowledges an event minted before it learned its session id, and the ACK is stored",
    ack.status === 200 && acked?.status === "acknowledged" && (acked.acknowledgedAt ?? 0) > 0
      && acked.receiverSessionId === null,
    `${ack.status} ${ackText} / ${JSON.stringify(acked)}`);
  // …the stored row keeps the null it was minted with: the fix matches, it does not rewrite history
  const reAck = await ackEvent(tok, ids.learned);
  const reAckBody = await reAck.json() as { existing?: boolean };
  check("learned id: a repeated ACK is idempotent (existing:true) and writes no second receipt",
    reAck.status === 200 && reAckBody.existing === true
      && auditRows().filter((a) => a.event === "fleet_event_ack" && (a.detail ?? "").includes(ids.learned)).length === 1,
    JSON.stringify(reAckBody));
  // (2) the session's own view shows the rows its occupation was minted, the pending one included
  const selfView = await (await selfGet(tok)).json() as { events?: { id: string }[] };
  check("learned id: GET /api/self lists the pre-learn rows to the occupant that learned its id",
    !!selfView.events?.some((e) => e.id === ids.second) && !!selfView.events?.some((e) => e.id === ids.pending)
      && !selfView.events?.some((e) => e.id === ids.stranger),
    JSON.stringify(selfView.events?.map((e) => e.id)));
  // (3) a not-yet-delivered row stays pending through transport ticks — never receiver-gone for
  // identity — and is refused as NOT ACKNOWLEDGEABLE, the pending rule, not as a replaced session
  await Bun.sleep(AUTOS_TICK_MS * 6 + 500);
  const pendingAck = await ackEvent(tok, ids.pending);
  const pendingAckText = await pendingAck.text();
  check("learned id: an undelivered pre-learn row stays pending and is refused only as not acknowledgeable",
    (await evRow(ids.pending))?.status === "pending" && pendingAck.status === 409
      && pendingAckText.includes("event is not acknowledgeable")
      && !auditRows().some((a) => a.event === "fleet_event_receiver_gone" && (a.detail ?? "").startsWith(ids.pending)),
    `${pendingAck.status} ${pendingAckText} / ${JSON.stringify(await evRow(ids.pending))}`);
  // (4) a row minted for another KNOWN session id is still a replaced session's row
  const strangerAck = await ackEvent(tok, ids.stranger);
  const strangerText = await strangerAck.text();
  check("learned id: a row minted for a different known session id is still refused as a replaced session",
    strangerAck.status === 409 && strangerText.includes("event belongs to a replaced session")
      && (await evRow(ids.stranger))?.acknowledgedAt === null,
    `${strangerAck.status} ${strangerText}`);
  // (5) null is not a wildcard: a null row minted after the learn has no provenance behind it
  const afterAck = await ackEvent(tok, ids.after);
  const afterText = await afterAck.text();
  check("learned id: a null row minted AFTER the learn is refused — unknown is never matched by guess",
    afterAck.status === 409 && afterText.includes("event belongs to a replaced session")
      && (await evRow(ids.after))?.status === "delivered",
    `${afterAck.status} ${afterText}`);
  // (6) a foreign self-token and a missing one never reach the identity question
  const foreignAck = await ackEvent(foreignTok, ids.second);
  const foreignText = await foreignAck.text();
  const noTokAck = await ackEvent(null, ids.second);
  check("learned id: a foreign slot's token is refused as another slot and no token is 401; the row stays delivered",
    foreignAck.status === 409 && foreignText.includes("event belongs to another slot") && noTokAck.status === 401
      && (await evRow(ids.second))?.status === "delivered",
    `${foreignAck.status} ${foreignText} / ${noTokAck.status}`);

  // (7) THE PROVENANCE IS DURABLE: after a restart the same occupant still acknowledges a pre-learn row
  await restartSrv({ PATH: codexPath });
  const durableAck = await ackEvent(tok, ids.second);
  check("learned id: the learn provenance survives a restart — the pre-learn row is still the occupant's to acknowledge",
    durableAck.status === 200 && (await evRow(ids.second))?.status === "acknowledged",
    `${durableAck.status} ${await durableAck.text()}`);

  // (8) LEGACY STATE WITHOUT PROVENANCE: the same slot, its id known, its learn record absent (a row
  // persisted before the field existed). Unknown provenance is refused, never reconstructed.
  await stopSrv();
  const legacy = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
    { slots: Record<string, Record<string, unknown>>; events?: Record<string, unknown>[] };
  const hadLearn = legacy.slots[String(slot)]?.sessionIdLearned !== undefined;
  if (legacy.slots[String(slot)]) delete legacy.slots[String(slot)].sessionIdLearned;
  legacy.events = [...(legacy.events ?? []), deployRow(ids.legacy, {})];
  writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(legacy, null, 2), { mode: 0o600 });
  await restartSrv({ PATH: codexPath });
  const legacyAck = await ackEvent(tok, ids.legacy);
  const legacyText = await legacyAck.text();
  check("learned id: a persisted binding WITHOUT learn provenance refuses the null row (unknown, not guessed)",
    hadLearn && legacyAck.status === 409 && legacyText.includes("event belongs to a replaced session")
      // the server writes the absent record back as null on its next save — absent and null are one fact
      && (persisted().slots?.[String(slot)]?.sessionIdLearned ?? null) === null,
    `hadLearn=${hadLearn} ${legacyAck.status} ${legacyText}`);

  // (9) A REAL REPLACEMENT on the same slot number: the recycle clears the learn, and neither the
  // new occupant nor its credential reaches the old occupation's rows. The rollout goes FIRST: left
  // in place it sits inside the new pane's discovery window and the new occupant would learn the
  // same id (measured on the first run of this block)
  rmSync(rollout, { force: true });
  await post(`/api/slots/${slot}/kill`, {});
  const reopen = await post(`/api/slots/${slot}/open`, { cwd: codexCwd, harness: "codex" });
  const next = persisted().slots?.[String(slot)];
  const nextAck = await ackEvent(next?.selfToken ?? "", ids.after);
  const nextText = await nextAck.text();
  check("learned id: a recycled occupant (new openedAt, id unknown again) cannot acknowledge the prior occupation's row",
    reopen.ok && (next?.openedAt ?? 0) > openedAt && next?.sessionId === null && (next.sessionIdLearned ?? null) === null
      && nextAck.status === 409 && nextText.includes("replaced session"),
    `${reopen.status} ${JSON.stringify({ openedAt: next?.openedAt, sessionId: next?.sessionId, learned: next?.sessionIdLearned })} ${nextAck.status} ${nextText}`);

  await post(`/api/slots/${slot}/kill`, {});
  await restartSrv();
}

export async function run(): Promise<void> {
  // A real process kill cannot reliably land in the sub-millisecond gap between a local tmux
  // call and its return. Pin the ordering that creates that observable crash state, then exercise
  // its persisted image below: marker -> awaited state write -> send, and pending is the sole
  // transport input. Moving any one of those four facts makes this check red.
  const serverSource = readFileSync(`${ROOT}/server.ts`, "utf8");
  const tickStart = serverSource.indexOf("async function tickWatches()");
  const tickSource = tickStart < 0 ? "" : serverSource.slice(tickStart,
    serverSource.indexOf("// The one-line receiver text", tickStart));
  const uncertainAt = tickSource.indexOf('event.status = "send-uncertain";');
  const persistedAt = tickSource.indexOf("await saveStateNow();", uncertainAt);
  const sendAt = tickSource.indexOf("await sendText(s, text, true, { rollbackOwnPayload: true })", persistedAt);
  check("watch transport persists send-uncertain before sendText and retries pending only",
    tickSource.includes('if (event.status !== "pending") continue;')
    && uncertainAt >= 0 && persistedAt > uncertainAt && sendAt > persistedAt,
    `${uncertainAt}:${persistedAt}:${sendAt}`);

  // --- ACP-25: ACCEPTANCE IS OBSERVED, NOT ECHOED. `delivered` used to mean "tmux accepted
  // paste+Enter"; ACP-21 measured the Enter being lost after a collapsed paste (2/7) and the live
  // 2026-08-22 codex case left a whole event in the composer while the row said delivered. The
  // transport now reads the composer after Enter (server.ts sendText, composer.ts). The pure
  // reader is pinned here against the frames MEASURED on the real binaries on 2026-08-22 — byte
  // shapes from `capture-pane -p -e`, including the dim placeholder that separates "empty" from
  // "owner draft". The stand-in harness of this suite declares no composer, so the live half
  // below proves the not-applicable answer and the delivered-only-after-observation rail.
  {
    const E = "\x1b";
    const claude = { kind: "glyph" as const, re: /^❯/ };
    const codex = { kind: "glyph" as const, re: /^›/ };
    const pi = { kind: "rules" as const };
    const rule = "─".repeat(120);
    const footer = `${rule}\n  ctx [----------] --%  |  Opus 5 (1M context)\n  ⏵⏵ bypass permissions on`;
    // claude 2.1.240: idle composer with the dim placeholder (fresh pane, --prompt-suggestions false)
    const claudeIdle = `${rule}\n${E}[39m❯  ${E}[2mTry "fix lint errors"${E}[0m\n${footer}`;
    check("acceptance reader: claude's dim placeholder reads as an EMPTY composer",
      composerResidue(claude, claudeIdle) === "", JSON.stringify(composerResidue(claude, claudeIdle)));
    // the ACP-21 loss signature: the paste collapsed, Enter gone, 15 s later unchanged
    const claudeLost = `⏺ earlier turn\n${rule}\n${E}[39m❯  [Pasted text #1 +202 lines]\n${footer}`;
    check("acceptance reader: the ACP-21 loss signature is RESIDUE, not acceptance",
      composerResidue(claude, claudeLost) === "[Pasted text #1 +202 lines]",
      JSON.stringify(composerResidue(claude, claudeLost)));
    // the hint Claude paints while a queued message waits: dim, then a second SGR, then text —
    // the form that broke a span-based strip (measured on the real-TUI probe, 2026-08-22)
    const claudeQueued = `${E}[37m${E}[100m❯ ${E}[97mreply OK${E}[39m\n${rule}\n❯  ${E}[2m${E}[39mPress up to edit queued messages${E}[0m\n${footer}`;
    check("acceptance reader: claude's queued-messages hint (dim, then another SGR) reads as EMPTY",
      composerResidue(claude, claudeQueued) === "", JSON.stringify(composerResidue(claude, claudeQueued)));
    // a typed owner draft carries no dim span — that is what makes it distinguishable at all
    const claudeDraft = `${rule}\n${E}[39m❯  owner draft${E}[7m ${E}[0m\n${footer}`;
    check("acceptance reader: a typed claude draft is residue (occupied composer)",
      composerResidue(claude, claudeDraft) === "owner draft", JSON.stringify(composerResidue(claude, claudeDraft)));
    // codex-cli 0.147.0 after a submitted turn: the transcript ECHO uses the same `›` glyph above,
    // the composer below shows its dim rotating placeholder. Only the LAST `›` line is the composer.
    const codexAfter = [`${E}[1;2m› ${E}[0mACP25 probe one-liner, reply with the single word OK.`, "",
      "• Working (1s • esc to interrupt)", "", `${E}[1m›${E}[0m ${E}[2mSummarize recent commits${E}[0m`, "",
      "  gpt-5.6-sol high · /tmp/x"].join("\n");
    check("acceptance reader: codex's transcript echo above a placeholder composer reads EMPTY (last-glyph rule)",
      composerResidue(codex, codexAfter) === "", JSON.stringify(composerResidue(codex, codexAfter)));
    const codexHeld = [`${E}[1;2m› ${E}[0mearlier turn`, "", `${E}[1m›${E}[0m lane-ready event text still here`, ""].join("\n");
    check("acceptance reader: the 2026-08-22 codex symptom (event text in the composer) is residue",
      composerResidue(codex, codexHeld) === "lane-ready event text still here",
      JSON.stringify(composerResidue(codex, codexHeld)));
    // pi 0.84.0: no glyph; the composer is the region between the last two rules
    const piFrame = (body: string) => [" ACP25 echo", " ⠇ Working...", rule, body, rule, "/tmp/x", "$0.000 (sub)"].join("\n");
    check("acceptance reader: pi's empty rule-bounded composer reads EMPTY",
      composerResidue(pi, piFrame("")) === "", JSON.stringify(composerResidue(pi, piFrame(""))));
    check("acceptance reader: a typed pi draft between the rules is residue",
      composerResidue(pi, piFrame(`${E}[39mowner draft${E}[7m ${E}[0m`)) === "owner draft",
      JSON.stringify(composerResidue(pi, piFrame("owner draft"))));
    check("acceptance reader: a frame without the composer (dialog, stand-in binary) is null, never empty",
      composerResidue(claude, "Do you trust the files in this folder?\n  1. Yes\n  2. No") === null
      && composerResidue(pi, "just text\nno rules") === null, "null expected for both");

    // 1e1dcd50, H1 measured 2026-09-14 (docs/messungen/2026-09-14-inbox-nudge-composer-h1-diskriminator.md):
    // the painted codex composer IS the input buffer, and the live "composer still holds 129 chars"
    // was a 193-char buffer whose glyph row wraps at 129. This frame is the measured post-Enter
    // composer region (codex-cli 0.153.4, 133 columns, `$`-mention overlay open below it). The
    // acceptance read must count the BUFFER; the glyph-row reader is kept beside it as the witness
    // of the defect, so reverting readComposer's reader turns the source half red and a
    // first-row-only composerBuffer turns the frame half red.
    const incidentPayload = "[fleet inbox] 5 ungelesene Eintraege in der Inbox deines Programs f9dc8e101bcc10c5e90b0eed"
      + " — GET /api/self/inbox, dann POST /api/self/inbox/<id>/read (x-fleet-self-token aus $FLEET_SELF_TOKEN).";
    const codexIncident = ["", "", `${E}[1m›${E}[0m ${incidentPayload.slice(0, 129)}`, `  ${incidentPayload.slice(129)}`, "",
      `  ${E}[2;3mno matches${E}[0m`, "", `  Press ${E}[2menter${E}[0m to insert or ${E}[2mesc${E}[0m to close`].join("\n");
    const readComposerBody = serverSource.slice(serverSource.indexOf("async function readComposer("),
      serverSource.indexOf("type ExactComposerRead"));
    check("acceptance reader counts the whole buffer: the measured 1e1dcd50 codex frame reads 193 chars (the glyph row alone is 129), and readComposer uses that reader",
      composerResidue(codex, codexIncident)?.length === 129
        && composerBuffer(codex, codexIncident) === incidentPayload
        && composerHoldsExactly(composerRows(codex, codexIncident) ?? [], incidentPayload)
        && readComposerBody.includes("composerBuffer(form, cap.out)") && !readComposerBody.includes("composerResidue("),
      JSON.stringify({ residue: composerResidue(codex, codexIncident)?.length,
        buffer: composerBuffer(codex, codexIncident)?.length, usesBuffer: readComposerBody.includes("composerBuffer(") }));
    // …a buffer whose glyph row is empty is not an empty composer (an owner draft that starts with a
    // newline), and every single-row frame measured above keeps exactly its old answer.
    const codexBlankFirst = ["", `${E}[1m›${E}[0m `, "  owner draft on the second row", "", "  gpt-6-astra low · ~/x"].join("\n");
    const singleRow = [[claude, claudeIdle], [claude, claudeLost], [claude, claudeQueued], [claude, claudeDraft],
      [codex, codexAfter], [codex, codexHeld], [pi, piFrame("")], [pi, piFrame("owner draft")],
      [claude, "Do you trust the files in this folder?\n  1. Yes\n  2. No"], [pi, "just text\nno rules"]] as const;
    const drift = singleRow.filter(([form, frame]) => composerBuffer(form, frame) !== composerResidue(form, frame));
    check("acceptance buffer reader: an empty glyph row above a draft row is OCCUPIED, and all ten single-row frames read exactly as the glyph-row reader did",
      composerResidue(codex, codexBlankFirst) === "" && composerBuffer(codex, codexBlankFirst) === "owner draft on the second row"
        && drift.length === 0,
      JSON.stringify({ blankFirst: composerBuffer(codex, codexBlankFirst), drift: drift.length }));

    // ACP-26: rollback compares the complete freshly rendered region with Fleet's own payload.
    // These are the TWO observed production post-land event shapes, copied without credentials:
    // explicit pane delivery / 60 s (f426…, one attempt) and legacy absent delivery / 15 s
    // (df8…, attempts accumulated while the occupied composer correctly refused another paste).
    const auditFixtures = ACP26_AUDIT_FIXTURES;
    const wrapPayload = (text: string, width = 106): string[] => {
      const rows: string[] = [];
      let rest = text;
      while (rest.length > width) {
        const at = rest.lastIndexOf(" ", width);
        if (at <= 0) throw new Error("rollback fixture has no wrap boundary");
        rows.push(rest.slice(0, at));
        rest = rest.slice(at + 1); // the measured visual wrap omits this one payload space
      }
      rows.push(rest);
      return rows;
    };
    const claudeWrapped = (rows: readonly string[]) => `${rule}\n${E}[39m❯\u00a0${rows[0]}\n`
      + `${rows.slice(1).map((r) => `  ${r}`).join("\n")}\n${footer}`;
    const codexWrapped = (rows: readonly string[]) => [`${E}[1;2m› ${E}[0mearlier turn`, "",
      `${E}[1m›${E}[0m ${rows[0]}`, ...rows.slice(1).map((r) => `  ${r}`), "",
      `  ${E}[2;3mno matches${E}[0m`, "", `  Press ${E}[2menter${E}[0m to insert or ${E}[2mesc${E}[0m to close`].join("\n");
    const piWrapped = (rows: readonly string[]) => piFrame(rows.join("\n"));
    const exact = (form: typeof claude | typeof pi, frame: string, payload: string): boolean => {
      const rows = composerRows(form, frame);
      return rows !== null && composerHoldsExactly(rows, payload);
    };
    for (const [i, fixture] of auditFixtures.entries()) {
      const payload = auditWatchMessage(fixture.repo, fixture.mainAfter, fixture.event);
      const rows = wrapPayload(payload);
      check(`rollback reader: observed post-land event shape ${i + 1} reconstructs exactly on Claude, Codex and Pi`,
        exact(claude, claudeWrapped(rows), payload) && exact(codex, codexWrapped(rows), payload)
          && exact(pi, piWrapped(rows), payload),
        JSON.stringify({ bytes: Buffer.byteLength(payload), rows: rows.length }));
    }
    const exactPayload = auditWatchMessage(auditFixtures[0].repo, auditFixtures[0].mainAfter,
      auditFixtures[0].event);
    const exactRows = wrapPayload(exactPayload);
    const ownerAppend = [...exactRows.slice(0, -1), `${exactRows.at(-1)} owner append`];
    const ownerPrepend = [`owner prepend ${exactRows[0]}`, ...exactRows.slice(1)];
    const ownerEdit = [...exactRows];
    ownerEdit[1] = ownerEdit[1].replace("reached", "REACHED");
    const boundaryEdit = [...exactRows];
    boundaryEdit[1] = boundaryEdit[1].slice(1);
    const hiddenAfterBlank = [`${E}[1m›${E}[0m ${exactRows[0]}`,
      ...exactRows.slice(1).map((r) => `  ${r}`), "", "  owner text after an input blank", "",
      "  gpt-5.6-sol high · ~/x"].join("\n");
    check("rollback falsifier: append, prepend, edit, wrap-boundary edit and text below a blank all survive as differences",
      !exact(codex, codexWrapped(ownerAppend), exactPayload)
      && !exact(claude, claudeWrapped(ownerPrepend), exactPayload)
      && !exact(pi, piWrapped(ownerEdit), exactPayload)
      && !exact(codex, codexWrapped(boundaryEdit), exactPayload)
      && composerRows(codex, hiddenAfterBlank) === null,
      "all five comparisons must be false/null");
    check("rollback falsifier: placeholder, unobservable composer and empty region never equal Fleet's payload",
      !composerHoldsExactly(composerRows(claude, claudeLost) ?? [], exactPayload)
      && composerRows(claude, "Do you trust the files in this folder?") === null
      && !composerHoldsExactly([""], exactPayload), "false / null / false expected");
    check("rollback reader: exact rows preserve owner whitespace and NBSP instead of normalizing or trimming it",
      composerRows(pi, piFrame(` ${exactPayload} `))?.[0] === ` ${exactPayload} `
      && !exact(pi, piFrame(` ${exactPayload} `), exactPayload)
      && !exact(pi, piFrame(exactPayload.replace(" ", "\u00a0")), exactPayload),
      JSON.stringify(composerRows(pi, piFrame(` ${exactPayload} `))?.[0]?.slice(0, 20)));

    // ACP-27, the pure half: the PRE-SUBMIT reader, which answers a different question than the two
    // above — not "is this exactly ours" (rollback, which erases and must be exact) but "has all of
    // it arrived". Only a proper PREFIX of Fleet's own payload may block a submit; a collapsed
    // paste or an owner byte leaves completeness unprovable and must keep the old path.
    const arrivalRows = (form: typeof claude | typeof pi, frame: string): string[] =>
      composerRows(form, frame) ?? [];
    const arrivalCases: [string, ComposerArrival, ComposerArrival][] = [
      ["one pi row holds the whole payload",
        composerArrival(arrivalRows(pi, piFrame(exactPayload)), exactPayload), "complete"],
      ["wrapped across rows with the measured omitted separators",
        composerArrival(exactRows, exactPayload), "complete"],
      ["a trailing space capture-pane trims is not a missing byte",
        composerArrival([exactPayload], `${exactPayload} `), "complete"],
      ["the claude glyph frame, fully arrived",
        composerArrival(arrivalRows(claude, claudeWrapped(exactRows)), exactPayload), "complete"],
      ["an EMPTY composer is not an arrival",
        composerArrival([""], exactPayload), "partial"],
      ["the measured truncation: everything but the last 20 chars",
        composerArrival([exactPayload.slice(0, -20)], exactPayload), "partial"],
      ["one byte in", composerArrival([exactPayload.slice(0, 1)], exactPayload), "partial"],
      ["a half-arrived claude glyph frame",
        composerArrival(arrivalRows(claude, `${rule}\n${E}[39m❯\u00a0${exactRows[0]}\n${footer}`),
          exactPayload), "partial"],
      ["the collapsed-paste placeholder stays UNPROVABLE, never disproven",
        composerArrival(["[Pasted text #1 +202 lines]"], exactPayload), "differs"],
      ["an owner append", composerArrival(ownerAppend, exactPayload), "differs"],
      ["an owner prepend", composerArrival(ownerPrepend, exactPayload), "differs"],
      ["an edited byte", composerArrival(ownerEdit, exactPayload), "differs"],
      ["no composer rows at all", composerArrival([], exactPayload), "differs"],
    ];
    const arrivalBad = arrivalCases.filter(([, got, want]) => got !== want);
    check("arrival reader: 13 measured composer shapes classify complete / partial / differs",
      arrivalBad.length === 0,
      JSON.stringify(arrivalBad.map(([name, got, want]) => `${name}: ${got} != ${want}`)));

    // Source-order falsifiers pin the destructive boundary: only the event caller opts in; identity
    // and the fresh exact read precede BSpace; no broad clear or second Enter exists in rollback;
    // event truth reaches deliveredAt only after observed acceptance.
    const rollbackSource = serverSource.slice(serverSource.indexOf("async function rollbackOwnComposerPayload("),
      serverSource.indexOf("async function awaitComposer("));
    const eventSendAt = tickSource.indexOf("rollbackOwnPayload: true");
    const eventCatchAt = tickSource.indexOf("fleet_event_send_uncertain", eventSendAt);
    const eventDeliveredAt = tickSource.indexOf('event.status = "delivered";', eventCatchAt);
    const eraseAt = rollbackSource.indexOf('"BSpace"');
    const beforeErase = rollbackSource.slice(0, eraseAt);
    check("rollback boundary: event-only opt-in, fresh read + repeated exact identity checks precede exact-count BSpace",
      eventSendAt >= 0 && rollbackSource.includes("readExactComposer(s, bound)") && eraseAt > 0
      && beforeErase.indexOf("readExactComposer(s, bound)") < beforeErase.lastIndexOf("sameBoundPane(s, bound)")
      && (beforeErase.match(/sameBoundPane\(s, bound\)/g)?.length ?? 0) >= 3
      && beforeErase.includes('read.kind === "failed"') && beforeErase.includes('read.kind === "unobservable"')
      && serverSource.indexOf('if (after === null) return { acceptance: "unobservable" as const };')
        < serverSource.indexOf("rollbackOwnComposerPayload(s, bound, text)"),
      `${eventSendAt}:${rollbackSource.length}`);
    check("rollback boundary: no Ctrl-C/Ctrl-U/broad clear/second Enter, and uncertain events cannot acquire deliveredAt",
      !rollbackSource.includes("C-c") && !rollbackSource.includes("C-u") && !rollbackSource.includes("Enter")
      && rollbackSource.match(/send-keys/g)?.length === 1
      && eventCatchAt > eventSendAt && eventDeliveredAt > eventCatchAt
      && tickSource.slice(eventCatchAt, eventDeliveredAt).includes("continue;"),
      `${eventCatchAt}:${eventDeliveredAt}`);
    // the live contract on this suite's stand-in harness: not-applicable, never observed or submitted
    const naOpen = await post("/api/slots/12/open", { cwd: ROOT });
    check("acceptance live: a slot opens for the receipt-anatomy probe", naOpen.ok, String(naOpen.status));
    if (naOpen.ok) {
      const res = await post("/send", { slot: 12, text: "acp25 receipt anatomy probe", submit: true });
      const body = await res.json() as { ok?: boolean; receipt?: Record<string, unknown> };
      check("acceptance live: /send on a composer-less harness answers submitRequested:true + acceptance:not-applicable and no `submitted`",
        res.ok && body.ok === true && body.receipt?.submitRequested === true
        && body.receipt?.acceptance === "not-applicable" && !("submitted" in (body.receipt ?? {})),
        JSON.stringify(body).slice(0, 200));
      await post("/api/slots/12/kill", {});
    }
    // the transport rail, pinned at source: `delivered` is written only after the acceptance
    // read, and an unobservable send keeps the persisted send-uncertain marker.
    const acceptAt = tickSource.indexOf("({ acceptance } = await sendText(s, text, true, { rollbackOwnPayload: true }))");
    const unobsAt = tickSource.indexOf('acceptance === "unobservable"', acceptAt);
    const deliveredAt = tickSource.indexOf('event.status = "delivered";', unobsAt);
    check("watch transport: FleetEvent turns delivered only after the acceptance read, and unobservable stays send-uncertain",
      acceptAt >= 0 && sendAt > acceptAt && unobsAt > acceptAt && deliveredAt > unobsAt
      && tickSource.slice(unobsAt, deliveredAt).includes("continue;"),
      `${acceptAt}:${unobsAt}:${deliveredAt}`);
  }

  // --- THE HOST-COMMIT SIBLING. The isolated server deliberately runs with foreign-harness
  // automation OFF (a policy family later proves that refusal). The pure selector below isolates
  // the TARGET's fenced-host-commit completion shape; the runtime blocks below separately prove
  // delivery, including tickWatches' narrow receiver-policy waiver for a live pi-unfenced slot.
  {
    const h: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 1, ahead: 0 }, gitOp: false,
      merge: null, observed: true, awaiting: null, hostCommits: true };
    const signal = laneWatchSignal(h, 1500);
    check("watch selector accepts the host-committed dirty+zero-ahead completion shape",
      signal === "host-commit-looking", String(signal));
    if (signal) {
      const text = laneWatchMessage(7, "host-branch", {
        id: "typedfixture", kind: laneWatchEventKind(signal), payload: laneWatchPayload(h),
      }, null);
      check("host-commit watch text names the weaker fact and exact host action",
        text.includes("LOOKS ready for a host commit")
        && text.includes("The work is UNCOMMITTED, 0 ahead is expected for this harness, and the next step is a host commit via POST /api/slots/7/commit.")
        && text.includes("server's weaker predicate") && text.includes("NOT a report from that lane")
        && text.includes("[event typedfixture]")
        && text.includes("POST /api/self/events/typedfixture/ack"), text);
    }
  }

  // --- the original subject: a lane that commits and goes quiet (idle + clean + ahead>0) ---
  const tgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  await Bun.write(`${tgt.cwd}/watch-target.txt`, "the work the watcher is waiting for\n");
  spawnSync("git", ["-C", tgt.cwd, "add", "watch-target.txt"]);
  spawnSync("git", ["-C", tgt.cwd, "commit", "-qm", "watch target lane work"]);

  // --- THE MEASURED RETURN-CHANNEL DEFECT. The wrapper's initial server alone has a scratch
  // executable named `pi` on PATH, while FLEET_HARNESS_AUTOMATION=0 stays closed. That makes a
  // pi-unfenced main slot mechanically alive without a provider call. This must be a runtime
  // counterprobe, not a selector unit check: tickWatches is the sole caller allowed to waive the
  // harness WORK-prompt policy for an explicit subscription's fixed completion notification.
  // It must run before this module's restartSrv() below, which deliberately restores normal PATH.
  {
    // Own target identity: the later owner-route check deliberately reuses `tgt` and may recycle
    // this receiver slot. Sharing both would make its exact-once log count include this fixture's
    // earlier delivery. A separate lane gives this probe a disjoint message prefix and is killed
    // with it, so neither family's evidence can satisfy or poison the other.
    const uTgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    await Bun.write(`${uTgt.cwd}/watch-pi-unfenced-target.txt`, "isolated watch target\n");
    spawnSync("git", ["-C", uTgt.cwd, "add", "watch-pi-unfenced-target.txt"]);
    spawnSync("git", ["-C", uTgt.cwd, "commit", "-qm", "pi-unfenced watch target"]);
    check("watch pi-unfenced fixture: its controlled target is a distinct committed lane",
      uTgt.slot > 0 && uTgt.slot !== tgt.slot, JSON.stringify(uTgt));

    const uId = await freeSlot();
    const openU = uId ? await post(`/api/slots/${uId}/open`, { cwd: REPO, harness: "pi-unfenced" }) : null;
    check("watch pi-unfenced fixture: a plain main-only receiver opens on the scratch Pi stand-in",
      !!openU?.ok, `${uId} ${openU?.status}`);

    let uAgent: string | null | undefined;
    for (let i = 0; i < 80 && uAgent !== "alive"; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; agent: string | null }[] }).slots;
      uAgent = rows.find((x) => x.id === uId)?.agent;
      if (uAgent !== "alive") await Bun.sleep(250);
    }
    check("watch pi-unfenced fixture: the stand-in is genuinely live (agent=alive), not merely a pane",
      uAgent === "alive", String(uAgent));

    const uTok = await paneEnv(`s${uId}`, "FLEET_SELF_TOKEN") ?? "";
    check("watch pi-unfenced fixture: the live receiver answers with its pane-exported Self token",
      /^[0-9a-f]{32}$/.test(uTok), `[${uTok}]`);

    // ACP-26 LIVE: real FleetEvent transport, not a direct /send surrogate. The stand-in swallows
    // Enter under a suite-owned mode, keeps its internal input bytes in a side file, and implements
    // exact BSpace. The first two rows carry the production payload values above and cover both the
    // explicit delivery:"pane" and legacy absent-delivery forms. A successful rollback still
    // leaves send-uncertain + deliveredAt:null and is never retried.
    const composerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
    const composerState = process.env.FLEET_E2E_COMPOSER_STATE ?? "";
    const auditFile = `${ROOT}/post-land-audits.jsonl`;
    const auditFileExisted = existsSync(auditFile);
    const auditFileBefore = auditFileExisted ? readFileSync(auditFile, "utf8") : "";
    check("rollback live fixture: suite-owned mode/state paths and the raw-mode stand-in are observable",
      composerMode.length > 0 && composerState.length > 0 && existsSync(composerMode) && existsSync(composerState),
      JSON.stringify({ modePath: !!composerMode, statePath: !!composerState }));
    const stateBuffer = (): { phase: string; text: string } => {
      const raw = readFileSync(composerState, "utf8");
      const nl = raw.indexOf("\n");
      return { phase: nl < 0 ? raw : raw.slice(0, nl), text: nl < 0 ? "" : raw.slice(nl + 1) };
    };
    const waitComposerState = async (eventId: string,
      accepts: (s: { phase: string; text: string }) => boolean): Promise<{ phase: string; text: string }> => {
      let state = stateBuffer();
      for (let i = 0; i < 160 && !(state.phase.endsWith(`:${eventId}`) && accepts(state)); i++) {
        await Bun.sleep(50);
        state = stateBuffer();
      }
      return state;
    };
    const setComposerMode = (mode: string) => writeFileSync(composerMode, `${mode}\n`);

    // --- THE PRECONDITION EVERY DELIVERY READ BELOW STANDS ON, MEASURED INSTEAD OF ASSUMED.
    // docs/verify-tiering.md §11.2j: this receiver's checks fail non-deterministically as if the
    // transport were broken, and the one fact none of them ever established is that they are still
    // talking to the pane they opened on. Two independent authorities answer that: tmux's own
    // `pane_id`, which changes the moment server.ts#ensureSlot rebuilds a session whose pane died,
    // and the server's occupant stamp (`openedAt` + `agent`). A rebuilt pane also brings
    // a FRESH stand-in — phase "ready", empty buffer — which silently converts "the owner draft
    // held the notification" into "the composer was clear", and the next tick then delivers what
    // the fixture wanted held. Reading that as a delivery defect accuses server.ts of a regress it
    // never committed, so the window reads fail as THEMSELVES and say what actually happened.
    // `sessionId` is deliberately NOT part of this: /api/sessions carries it only inside
    // `codexRecovery`, so reading it here would compare null with null and look like a conjunct.
    // `openedAt` IS the server's occupant identity and it is on every row.
    interface ReceiverId { paneId: string; openedAt: number; agent: string | null }
    const receiverId = async (): Promise<ReceiverId> => {
      const pane = (await tmuxOut("display-message", "-p", "-t", `s${uId}`, "#{pane_id}")).out.trim();
      const row = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; openedAt: number; agent: string | null }[] })
        .slots.find((x) => x.id === uId);
      return { paneId: pane, openedAt: row?.openedAt ?? 0, agent: row?.agent ?? null };
    };
    // `agent` is read with the ids on purpose: a stand-in that exited but whose session tmux has
    // not rebuilt yet still answers with the OLD pane id, and only liveness separates that from a
    // healthy pane. `wantComposer` is optional because only some windows own the composer's
    // contents; where they do, "ready" in the phase is the fresh-process fingerprint.
    const windowIntact = async (window: string, before: ReceiverId,
      wantComposer?: string): Promise<boolean> => {
      // POLLED, not sampled once. `agent` comes off the 10 s tickGit's ps/pgrep probe, and a single
      // miss there is the §11.2c pane-observation race — a fixture that failed on the first read
      // would be a new flake of exactly the kind this repair exists to remove. Nothing here can be
      // masked by waiting: a recreated pane keeps its NEW id forever, and no line re-types a draft
      // that is gone, so a retry only absorbs transient misreads.
      let after = await receiverId();
      let state = stateBuffer();
      let samePane = false;
      let sameComposer = false;
      for (let i = 0; i < 12; i++) {
        samePane = before.paneId !== "" && after.paneId === before.paneId
          && after.openedAt === before.openedAt && after.agent === "alive";
        sameComposer = wantComposer === undefined || state.text === wantComposer;
        if (samePane && sameComposer) break;
        await Bun.sleep(250);
        after = await receiverId();
        state = stateBuffer();
      }
      check(`receiver precondition (${window}): the same live pi-unfenced pane, still holding what the fixture put in it`,
        samePane && sameComposer,
        samePane && sameComposer
          ? JSON.stringify({ pane: after.paneId, openedAt: after.openedAt, phase: state.phase,
            composerBytes: state.text.length })
          : !samePane
          ? `the receiver pane was REPLACED under this window — tmux session recreated (server.ts#ensureSlot self-heal) or the slot recycled — so every delivery fact read here is about a pane that no longer exists: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
          : `the pane held, but its composer no longer holds what the fixture left there — a restarted stand-in (phase "ready" = fresh process, empty buffer) or a foreign write: phase=${state.phase} got=${state.text.length}B want=${(wantComposer ?? "").length}B pane=${JSON.stringify(after)}`);
      return samePane && sameComposer;
    };
    // --- `send-uncertain` IS A TRANSIENT ON THE REFUSAL PATH, NOT A FACT ABOUT DELIVERY, and it is
    // §11.2j's actual mechanism. `server.ts#tickWatches` writes `send-uncertain` AND `attempts++`
    // and persists them BEFORE it touches tmux; only after `sendText` throws `SendRefused` (the
    // pre-paste "composer occupied" refusal) does it roll BOTH back to `pending`/`attemptsBefore`.
    // Between those two writes sits a whole tmux round-trip — and this fixture holds a draft
    // through 100+ refusals while polling the row every 250 ms, so sampling one mid-flight is not
    // unlikely, and gets likelier the slower tmux answers. That is the loadavg correlation §11.2j
    // recorded as "a hint". MEASURED 2026-09-01 on a run where the receiver pane was PROVEN
    // unchanged (`%76`, same `openedAt`) and the internal buffer held all 45 draft bytes, while
    // `living` still read `send-uncertain` — a pane replacement cannot explain that, and does not
    // have to. So a read of a HELD row settles first, bounded. Nothing is hidden: a row that never
    // settles is still returned as `send-uncertain` and still fails its check.
    let settleWaits = 0;
    const settleEvent = async (row: FleetEventRow | undefined): Promise<FleetEventRow | undefined> => {
      let cur = row;
      for (let i = 0; i < 40 && cur?.status === "send-uncertain"; i++) {
        if (i === 0) settleWaits++;
        await Bun.sleep(250);
        const id = cur.id;
        cur = (await eventRows()).find((e) => e.id === id) ?? cur;
      }
      return cur;
    };
    // Clear the receiver's composer and WAIT OUT a window of CONFIRMED emptiness. A single read
    // taken the instant a turn goes terminal can see an empty buffer while held bytes are still on
    // their way, and clearing "what is there now" then clears nothing. Returns the bytes removed.
    const drainComposer = async (quietTicks: number): Promise<number> => {
      let removed = 0;
      for (let quiet = 0; quiet < quietTicks;) {
        const now = stateBuffer().text;
        if (now.length === 0) { quiet++; await Bun.sleep(50); continue; }
        await tmuxOut("send-keys", "-t", `s${uId}`, "-N", String([...now].length), "BSpace");
        removed += now.length;
        quiet = 0;
        await Bun.sleep(50);
      }
      return removed;
    };
    const appendAudit = (mainAfter: string, mainSha: string, checks: { ran: number; failed: number }) => {
      const at = Date.now() + Number.parseInt(mainAfter.slice(0, 4), 16);
      appendFileSync(auditFile, `${JSON.stringify({ at, startedAt: at - 1, ms: 1, repo: REPO, main: "main",
        mainSha, result: "green", cmd: "acp26-fixture", exitCode: 0, out: "ALL PASS", checks,
        covers: [{ branch: `fleet/acp26-${mainAfter.slice(0, 8)}`, mainAfter, at: at - 2 }] })}\n`);
    };
    interface LiveAuditEvent {
      id: string; watchId: string; receiverSlot: number; receiverOpenedAt: number;
      receiverSessionId: string | null; receiverIdleSec: number; kind: "post-land-audit";
      subjectRepo: string; subjectMainAfter: string; payload: AuditWatchEventPayload;
      createdAt: number; status: FleetEventStatus; attempts: number; deliveredAt: number | null;
      acknowledgedAt: number | null; delivery?: "pane" | "inbox";
    }
    const waitAuditEvent = async (watchId: string): Promise<LiveAuditEvent | undefined> => {
      let event: LiveAuditEvent | undefined;
      for (let i = 0; i < 120 && event?.status !== "send-uncertain"; i++) {
        event = ((await eventRows()) as unknown as LiveAuditEvent[]).find((e) => e.watchId === watchId);
        if (event?.status !== "send-uncertain") await Bun.sleep(100);
      }
      return event;
    };
    const fireAudit = async (fixture: typeof ACP26_AUDIT_FIXTURES[number], delivery: "pane" | undefined,
      mode: string): Promise<{ event?: LiveAuditEvent; expected: string; watchStatus: number }> => {
      setComposerMode(mode);
      appendAudit(fixture.mainAfter, fixture.event.payload.mainSha, fixture.event.payload.checks!);
      const response = await post(`/api/slots/${uId}/watch`, {
        kind: "audit", repo: REPO, mainAfter: fixture.mainAfter, idleSec: 0,
        ...(delivery ? { delivery } : {}),
      });
      const body = await response.json() as { watch?: { id: string } };
      const event = body.watch?.id ? await waitAuditEvent(body.watch.id) : undefined;
      const expected = event ? auditWatchMessage(event.subjectRepo, event.subjectMainAfter, event) : "";
      return { event, expected, watchStatus: response.status };
    };

    for (const [i, fixture] of ACP26_AUDIT_FIXTURES.entries()) {
      const live = await fireAudit(fixture, i === 0 ? "pane" : undefined, "hold");
      const internal = live.event
        ? await waitComposerState(live.event.id, (s) => s.phase.startsWith("backspace:") && s.text === "")
        : stateBuffer();
      const frame = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
      check(`rollback live: observed audit shape ${i + 1} cannot strand exact Fleet text`,
        live.watchStatus === 200 && live.event?.status === "send-uncertain"
        && live.event.attempts === 1 && live.event.deliveredAt === null
        && internal.text === "" && composerResidue({ kind: "rules" }, frame) === "",
        JSON.stringify({ status: live.watchStatus, event: live.event?.status, attempts: live.event?.attempts,
          deliveredAt: live.event?.deliveredAt, state: internal.phase, bytes: internal.text.length }));
      if (live.event) await fetch(`${BASE}/api/self/events/${live.event.id}/ack`, {
        method: "POST", headers: { "x-fleet-self-token": uTok },
      });
    }

    const ownerCases = [
      { mode: "append", suffix: " owner append" },
      { mode: "edit", suffix: null },
      { mode: "placeholder", suffix: null },
    ] as const;
    for (const [i, ownerCase] of ownerCases.entries()) {
      const mainAfter = `${(0xa110 + i).toString(16).padStart(4, "0")}${"0".repeat(36)}`;
      const fixture = { repo: REPO, mainAfter, event: { id: "0".repeat(24), kind: "post-land-audit" as const,
        payload: { result: "green" as const, mainSha: mainAfter,
          covers: [{ branch: `fleet/acp26-owner-${i}`, mainAfter }], checks: { ran: 1, failed: 0 } } } };
      const live = await fireAudit(fixture, undefined, ownerCase.mode);
      const internal = live.event
        ? await waitComposerState(live.event.id, (s) => s.phase.startsWith("entered:")) : stateBuffer();
      const expectedInternal = ownerCase.mode === "append" ? `${live.expected}${ownerCase.suffix}`
        : ownerCase.mode === "edit" ? `${live.expected[0]}${live.expected[1] === "f" ? "F" : "X"}${live.expected.slice(2)}`
        : live.expected;
      check(`rollback live falsifier: ${ownerCase.mode} leaves the complete internal composer byte-for-byte`,
        live.event?.status === "send-uncertain" && live.event.deliveredAt === null
        && internal.text === expectedInternal,
        JSON.stringify({ status: live.event?.status, deliveredAt: live.event?.deliveredAt,
          phase: internal.phase, gotBytes: internal.text.length, expectedBytes: expectedInternal.length }));
      if (live.event) await fetch(`${BASE}/api/self/events/${live.event.id}/ack`, {
        method: "POST", headers: { "x-fleet-self-token": uTok },
      });
      // The probe, acting as the owner, clears only its synthetic fixture between cases. Product
      // rollback never reaches this line and never uses a broad clear.
      await tmuxOut("send-keys", "-t", `s${uId}`, "-N", String([...internal.text].length), "BSpace");
      if (live.event) await waitComposerState(live.event.id, (s) => s.text === "");
      setComposerMode("hold");
    }
    // === ACP-27 · THE TWO WAYS A NOTIFICATION LIED, MEASURED 2026-08-30 ON EVENT
    // e1ff06ac9911f854e752d71a. It was minted for a lane on slot 2 / fleet/260830005056-09e6, held
    // 2005 times against an owner draft (attempts climbed to 2006 with it), and then typed itself
    // into a MAIN composer hours after that lane had landed, been torn down and its slot recycled —
    // cut off after "x-fleet-self-token from", because the pre-Enter wait asked only whether the
    // composer was NON-EMPTY. Three facts are proven here on the live transport, not at source:
    // a submit waits for the WHOLE payload, a refusal is not an attempt, and a notification about a
    // lane that no longer exists turns terminal instead of waiting for a composer to clear.
    {
      const turnsFile = `${composerState}.turns`;
      const turnsRaw = (): string => existsSync(turnsFile) ? readFileSync(turnsFile, "utf8") : "";
      // every turn the stand-in SUBMITTED since a byte offset — the only place a truncated turn is
      // visible as itself rather than as a shorter residue
      const turnsSince = (offset: number): string[] =>
        turnsRaw().slice(offset).split(/\n===TURN \d+===\n/).slice(1);
      const openDebts = async (): Promise<LiveAuditEvent[]> =>
        ((await eventRows()) as unknown as LiveAuditEvent[]).filter((e) => e.receiverSlot === uId
          && !["acknowledged", "receiver-gone", "subject-gone"].includes(e.status));
      const eventById = async (id: string): Promise<FleetEventRow | undefined> =>
        (await eventRows()).find((e) => e.id === id);
      const holdRowsFor = (id: string): AuditRow[] =>
        auditRows().filter((r) => r.event === "fleet_event_held" && (r.detail ?? "").startsWith(id));
      // the PROBES: entry + repeat are the rows a refused send-attempt writes; `end` is the row
      // that closes a hold and is never an attempt.
      const holdProbes = (id: string): AuditRow[] =>
        holdRowsFor(id).filter((r) => r.phase === "entry" || r.phase === "repeat");
      const heldRows = (id: string): number => holdProbes(id).length;
      // The schedule server.ts#holdBackoffMs promises, recomputed here from the SUITE's own tick so
      // the assertion is a contract comparison and not a copy of the number the server printed.
      const holdWaitMs = (holds: number): number =>
        Math.min(AUTOS_TICK_MS * 2 * 2 ** Math.max(0, holds - 1), AUTOS_TICK_MS * 12);
      const HOLD_BACKOFF_MAX_MS = AUTOS_TICK_MS * 12;
      // What the watch DOOR actually counts when it says "max 5 active watches per slot", read at
      // the instant the door is knocked on. A `freed:400` says only "refused"; this says what the
      // receiver still owed, so the next occurrence names its own cause instead of leaving the
      // reader to guess (§11.2j, the seventh member's unexplained 400).
      const receiverBudget = async (): Promise<{ armed: string[]; open: string[] }> => {
        const sess = (await (await get("/api/sessions")).json()) as
          { watches: { id: string; slot: number; armed: boolean }[] };
        return { armed: sess.watches.filter((w) => w.slot === uId && w.armed).map((w) => w.id),
          open: (await openDebts()).map((e) => `${e.id}:${e.status}`) };
      };
      // A row id must resolve to exactly ONE row. Two rows carrying it (a restore beside a live
      // one) would let two reads of "the same event" answer differently — which is precisely the
      // contradiction §11.2j records and nobody has yet ruled out.
      const rowsWithId = async (id: string): Promise<number> =>
        (await eventRows()).filter((e) => e.id === id).length;

      // --- (1) THE SLOW PASTE. The stand-in renders the first 24 bytes at once and the rest a
      // quarter second later, so "still arriving" is a state the probe controls rather than races.
      // Before the fix Enter lands on the prefix: the truncated turn is submitted and the tail is
      // left in the composer. After it, exactly one turn, byte-equal to the payload, nothing left.
      const prefixMainAfter = `ac270001${"0".repeat(32)}`;
      const turnsOffset = turnsRaw().length;
      setComposerMode("prefix");
      // FIXTURE HYGIENE, not product behaviour: the stand-in repaints only when a key arrives, so
      // the frame left by the `placeholder` case above still shows "[Pasted text …]" while its
      // internal buffer is already empty — and a pre-paste read would refuse that as an owner
      // draft. One BSpace on an empty buffer forces the repaint (the same key, for the same
      // reason, that this section sends when it restores `normal` mode). Measured on the base
      // tree: without it the slow-paste probe never gets to paste at all — 79 refusals, 0 turns.
      await tmuxOut("send-keys", "-t", `s${uId}`, "BSpace");
      let prefixFrameClear = "?";
      for (let i = 0; i < 40 && prefixFrameClear !== ""; i++) {
        prefixFrameClear = composerResidue({ kind: "rules" },
          (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out) ?? "?";
        if (prefixFrameClear !== "") await Bun.sleep(50);
      }
      check("arrival fixture: the stand-in's RENDERED composer is empty before the slow paste starts",
        prefixFrameClear === "" && stateBuffer().text === "",
        JSON.stringify({ frame: prefixFrameClear.slice(0, 40), internal: stateBuffer().text.length }));
      appendAudit(prefixMainAfter, prefixMainAfter, { ran: 3, failed: 0 });
      const prefixWatch = await post(`/api/slots/${uId}/watch`, {
        kind: "audit", repo: REPO, mainAfter: prefixMainAfter, idleSec: 0,
      });
      const prefixWatchId = ((await prefixWatch.json()) as { watch?: { id: string } }).watch?.id;
      let prefixEvent: LiveAuditEvent | undefined;
      for (let i = 0; i < 200 && prefixEvent?.status !== "delivered"; i++) {
        prefixEvent = ((await eventRows()) as unknown as LiveAuditEvent[])
          .find((e) => e.watchId === prefixWatchId);
        if (prefixEvent?.status !== "delivered") await Bun.sleep(100);
      }
      const prefixExpected = prefixEvent
        ? auditWatchMessage(prefixEvent.subjectRepo, prefixEvent.subjectMainAfter, prefixEvent) : "";
      const prefixTurns = turnsSince(turnsOffset);
      const prefixResidue = stateBuffer();
      const prefixFrame = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
      check("arrival: a payload still arriving is never submitted — exactly ONE complete turn, no residue",
        prefixWatch.ok && prefixEvent?.status === "delivered" && prefixEvent.attempts === 1
        && prefixEvent.deliveredAt !== null
        && prefixTurns.length === 1 && prefixTurns[0] === prefixExpected
        && prefixResidue.text === "" && composerResidue({ kind: "rules" }, prefixFrame) === "",
        JSON.stringify({ status: prefixEvent?.status, attempts: prefixEvent?.attempts,
          turns: prefixTurns.length, turnBytes: prefixTurns.map((t) => t.length),
          payloadBytes: prefixExpected.length, residueBytes: prefixResidue.text.length,
          firstTurnIsPrefix: prefixTurns.length === 1 && prefixExpected.startsWith(prefixTurns[0])
            && prefixTurns[0] !== prefixExpected }));
      if (prefixEvent) await ackEvent(uTok, prefixEvent.id);
      setComposerMode("normal");
      // The probe, acting as the owner, hands the next fixture a clean composer whatever the case
      // above left in it — but it must WAIT for the stand-in to settle first: the held tail lands a
      // beat AFTER the turn was submitted, so a read taken the moment the event went terminal sees
      // an empty buffer and clears nothing. Measured on the base tree exactly that way: the 501
      // stranded bytes then sat under the next fixture's draft (546 where 45 was expected).
      // Product code never clears a composer it did not prove is its own.
      // The tail can only land inside the stand-in's hold window, and it lands AFTER the turn was
      // submitted — so a single read taken when the event went terminal sees an empty buffer and
      // clears nothing. Wait out a full window of CONFIRMED emptiness instead, clearing exactly
      // what shows up and restarting the window after each clear.
      const cleared = await drainComposer(60);
      const preDraftFrame = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
      check("arrival fixture: nothing of the slow paste is left behind, in the buffer or on screen",
        stateBuffer().text === "" && composerResidue({ kind: "rules" }, preDraftFrame) === "",
        JSON.stringify({ clearedBytes: cleared, internal: stateBuffer().text.length,
          frame: (composerResidue({ kind: "rules" }, preDraftFrame) ?? "?").slice(0, 40) }));

      // --- (2) AN OWNER DRAFT HOLDS, AND HOLDING IS NOT ATTEMPTING. Two committed lanes, one of
      // which is about to be torn down, both watched by the same receiver whose composer is
      // occupied. Every tick refuses BEFORE the paste; the measured row counted each of those as a
      // delivery attempt.
      const draft = "owner draft that must survive every held tick";
      // Everything the no-inheritance check below reads is a row written from HERE on, so an event
      // whose hold began before this point cannot be mistaken for one that started mid-schedule.
      const holdAuditStart = auditRows().length;
      // The whole point of the next three fixtures is that the composer is OCCUPIED while events
      // are minted and held. That is a state of a specific pane, so the pane is stamped here and
      // re-read where the events are read (§11.2j).
      const holdWindow = await receiverId();
      await tmuxOut("send-keys", "-t", `s${uId}`, "-l", draft);
      let drafted = stateBuffer();
      for (let i = 0; i < 100 && drafted.text !== draft; i++) {
        await Bun.sleep(50);
        drafted = stateBuffer();
      }
      check("hold fixture: the receiver's composer holds an owner draft, byte for byte",
        drafted.text === draft, JSON.stringify({ got: drafted.text.length, want: draft.length }));

      const subjectLanes: { slot: number; cwd: string; branch: string }[] = [];
      for (const name of ["doomed", "living"]) {
        const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as
          { slot: number; cwd: string; branch: string };
        await Bun.write(`${lane.cwd}/acp27-${name}.txt`, `${name} subject lane\n`);
        spawnSync("git", ["-C", lane.cwd, "add", `acp27-${name}.txt`]);
        spawnSync("git", ["-C", lane.cwd, "commit", "-qm", `acp27 ${name} subject`]);
        subjectLanes.push(lane);
      }
      const [doomed, living] = subjectLanes;
      let subjectsReady = false;
      for (let i = 0; i < 90 && !subjectsReady; i++) {
        const rows = ((await (await get("/api/sessions")).json()) as
          { slots: { id: number; git: { ahead?: number; dirty?: number } | null }[] }).slots;
        subjectsReady = subjectLanes.every((lane) => {
          const row = rows.find((x) => x.id === lane.slot);
          return row?.git?.ahead === 1 && row.git.dirty === 0;
        });
        if (!subjectsReady) await Bun.sleep(500);
      }
      check("subject fixture: two distinct committed+clean lanes exist for the same receiver",
        subjectsReady && doomed.slot !== living.slot && doomed.branch !== living.branch,
        JSON.stringify(subjectLanes.map((l) => `${l.slot}:${l.branch}`)));

      const subjectWatches = new Map<string, string>();
      const subjectSubs: { name: string; status: number; body: string }[] = [];
      for (const [name, lane] of [["doomed", doomed], ["living", living]] as const) {
        const r = await post(`/api/slots/${uId}/watch`, { target: lane.slot, idleSec: 0 });
        const raw = await r.text();
        subjectSubs.push({ name, status: r.status, body: raw.slice(0, 60) });
        let id = "";
        try { id = (JSON.parse(raw) as { watch?: WatchRow }).watch?.id ?? ""; } catch { id = ""; }
        subjectWatches.set(name, id);
      }
      // THE PRECONDITION EVERY CHECK BELOW SPENDS, AND IT WAS NEVER ASSERTED. The two POSTs above
      // went unread: a REFUSED subscription (`max 5 active watches per slot`, when an upstream
      // block left this receiver an undelivered debt) left the watch id `""`, `eventForWatch("")`
      // then found nothing, and 50 s later the fixture reported "the completion minted no event" —
      // accusing the MINTING contract for a subscription that never happened, and dragging the
      // held/budget/subject-gone/counterprobe blocks down with it. Measured that way twice on
      // 2026-09-02 (trees 2d4eb921, d63bb91f: `livingId: null` under a healthy pane and a 45-byte
      // draft in BOTH composer readings). It fails as ITSELF from here, with the door's own words
      // and the receiver's budget at that instant, so the reason is on the line that owns it.
      const subjectBudget = await receiverBudget();
      const subjectsSubscribed = subjectSubs.every((sub) => sub.status === 200)
        && [...subjectWatches.values()].every((id) => /^[0-9a-f]{8}$/.test(id));
      check("subject fixture: BOTH subject subscriptions were accepted by the receiver's watch door",
        subjectsSubscribed,
        JSON.stringify({ subs: subjectSubs, ids: Object.fromEntries(subjectWatches),
          budgetAtSubscribe: subjectBudget }));
      const waitEventFor = async (name: string): Promise<FleetEventRow | undefined> => {
        let row: FleetEventRow | undefined;
        for (let i = 0; i < 200 && !row; i++) {
          row = await eventForWatch(subjectWatches.get(name) ?? "");
          if (!row) await Bun.sleep(250);
        }
        return row;
      };
      const doomedEvent = await settleEvent(await waitEventFor("doomed"));
      const livingEvent = await settleEvent(await waitEventFor("living"));
      // "pending" is the right answer here ONLY because the composer stayed occupied throughout.
      // Without this line a restarted stand-in (empty buffer) lets the very next tick deliver, and
      // the check below reports a minting defect that never happened — the measured §11.2j shape,
      // where `event ...: delivered lane-ready to slot 7` sits in the server log one line under
      // the mint it was supposed to be held against.
      const holdIntact = await windowIntact("owner-draft hold", holdWindow, draft);
      if (holdIntact && subjectsSubscribed)
        check("subject fixture: both lane completions minted one pending event each on the busy receiver",
          doomedEvent?.status === "pending" && livingEvent?.status === "pending"
          && doomedEvent.subjectSlot === doomed.slot && livingEvent.subjectSlot === living.slot,
          JSON.stringify({ doomed: doomedEvent?.status, living: livingEvent?.status,
            doomedId: doomedEvent?.id ?? null, livingId: livingEvent?.id ?? null,
            settleWaits }));

      // THE BOUNDED HOLD, measured on the server's own rows rather than on elapsed time (K1).
      // Until 2026-09-11 this fixture waited for 100+ refusals, because that is what an occupied
      // composer bought: one probe and one trail row per tick, forever (14 579 such rows in the
      // three days to 2026-09-11). The contract now is a BACKOFF — same row, same occupant, a
      // doubling wait capped at HOLD_BACKOFF_MAX_MS — so the measurable target is a handful of
      // probes spread over many ticks, and the thing to prove is that the spread is the server's
      // OWN announced schedule and not a coincidence of timing.
      const heldTarget = 5;
      const holdStart = Date.now();
      for (let i = 0; i < 480 && heldRows(livingEvent?.id ?? "x") < heldTarget; i++) await Bun.sleep(250);
      const holdElapsed = Date.now() - holdStart;
      const heldCount = heldRows(livingEvent?.id ?? "x");
      const heldDoomed = await settleEvent(await eventById(doomedEvent?.id ?? "x"));
      const heldLiving = await settleEvent(await eventById(livingEvent?.id ?? "x"));
      const heldDraft = stateBuffer();
      // §11.2j's EIGHTH member is this check, and its recorded detail
      // (`doomedAttempts:1` WITH `draftBytes:45`) is not explained by a replaced pane: nothing in
      // this fixture re-types the draft, so a fresh occupant would have shown 0 bytes here, not 45.
      // What remains is that the two readings of "the composer is occupied" disagreed — transport
      // reads the RENDERED FRAME, this fixture reads the stand-in's INTERNAL buffer, and only a
      // frame that did not show the draft at that instant lets `sendText` past its pre-paste
      // refusal and raises `attempts`. So the frame is now read here beside the buffer: on the
      // healthy path both carry the draft, and a future occurrence prints which one did not.
      const heldFrameRaw = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
      const heldFrame = composerResidue({ kind: "rules" }, heldFrameRaw);
      const heldIntact = await windowIntact("held refusals", holdWindow, draft);
      if (heldIntact && subjectsSubscribed)
        check("held: pre-paste refusals change neither `attempts` nor the owner's composer",
          heldCount >= heldTarget && heldDoomed?.status === "pending" && heldDoomed.attempts === 0
          && heldLiving?.status === "pending" && heldLiving.attempts === 0
          && heldDraft.text === draft,
          JSON.stringify({ held: heldCount, doomedAttempts: heldDoomed?.attempts,
            livingAttempts: heldLiving?.attempts, draftBytes: heldDraft.text.length,
            frameBytes: (heldFrame ?? "").length, frameIsDraft: heldFrame === draft,
            elapsedMs: holdElapsed, settleWaits }));

      // --- (2b) THE BACKOFF ITSELF, read off the rows the server wrote about its own intentions.
      // Three separable statements, and the fixture states them separately because they fail for
      // different reasons: the PHASES are distinguishable (entry once, repeats after it, no `end`
      // while the composer is still occupied); the announced wait follows the documented schedule
      // and never exceeds the ceiling; and the NEXT probe really did wait that long. The last one
      // is differenced on `heldMs`, not on two `ts` values — both come from the single clock read
      // inside the writer, so `heldMs[k+1] - heldMs[k] >= nextProbeInMs[k]` is exact and needs no
      // tolerance. A pure rate observation ("fewer rows per second") proves none of this.
      const livingHolds = holdRowsFor(livingEvent?.id ?? "x");
      const livingProbes = livingHolds.filter((r) => r.phase === "entry" || r.phase === "repeat");
      const phasesOk = livingProbes.length >= heldTarget
        && livingProbes[0]?.phase === "entry" && livingProbes[0]?.holds === 1
        && livingProbes.slice(1).every((r, i) => r.phase === "repeat" && r.holds === i + 2)
        && !livingHolds.some((r) => r.phase === "end");
      const scheduleOk = livingProbes.every((r) => r.nextProbeInMs === holdWaitMs(r.holds ?? 0)
        && (r.nextProbeInMs ?? 0) <= HOLD_BACKOFF_MAX_MS);
      const spacingOk = livingProbes.slice(1).every((r, i) => {
        const prev = livingProbes[i];
        return (r.heldMs ?? 0) - (prev?.heldMs ?? 0) >= (prev?.nextProbeInMs ?? 0);
      });
      if (heldIntact && subjectsSubscribed)
        check("held backoff: entry/repeat are distinguishable, the announced wait follows the capped schedule, and the next probe honours it",
          phasesOk && scheduleOk && spacingOk,
          JSON.stringify({ probes: livingProbes.map((r) => [r.phase, r.holds, r.nextProbeInMs, r.heldMs]),
            phasesOk, scheduleOk, spacingOk, capMs: HOLD_BACKOFF_MAX_MS, tickMs: AUTOS_TICK_MS }));

      // …and the COST, in the unit the measurement was taken in: a composer occupied across many
      // ticks must cost at most half as many send probes (and half as many trail rows, which are
      // one per probe) as there were ticks. Measured inside the window the rows themselves span,
      // so nothing before the first probe is counted against it.
      const probeSpanMs = (livingProbes.at(-1)?.ts ?? 0) - (livingProbes[0]?.ts ?? 0);
      const ticksInSpan = Math.floor(probeSpanMs / AUTOS_TICK_MS);
      if (heldIntact && subjectsSubscribed)
        check("held backoff: an occupied composer costs at most half as many send probes and hold rows as there were ticks",
          livingProbes.length >= heldTarget && ticksInSpan > 0
          && livingProbes.length * 2 <= ticksInSpan
          && holdRowsFor(livingEvent?.id ?? "x").length * 2 <= ticksInSpan,
          JSON.stringify({ probes: livingProbes.length, rows: livingHolds.length,
            spanMs: probeSpanMs, ticks: ticksInSpan, tickMs: AUTOS_TICK_MS }));

      // TWO INDEPENDENT EVENTS ON ONE OCCUPIED PANE keep separate schedules: the doomed row's
      // holds are its own, and neither row's count is the other's. A single per-PANE backoff would
      // show one of them starved at hold 1 while the other counted up.
      const doomedProbes = holdProbes(doomedEvent?.id ?? "x");
      if (heldIntact && subjectsSubscribed)
        check("held backoff: two independent events on the same occupied receiver each count their own holds",
          doomedProbes.length >= 2 && doomedProbes[0]?.holds === 1
          && doomedProbes.every((r, i) => r.holds === i + 1)
          && doomedProbes.every((r) => r.nextProbeInMs === holdWaitMs(r.holds ?? 0)),
          JSON.stringify({ doomed: doomedProbes.map((r) => [r.phase, r.holds, r.nextProbeInMs]),
            living: livingProbes.length }));

      // --- (3) THE BUDGET, READ THROUGH THE DOOR THAT SPENDS IT — and read RELATIVELY, never as an
      // absolute count. What has to be proven is one difference: the same subscription is refused
      // while the doomed row is open and accepted once it is terminal. Filling until the door says
      // no makes that difference independent of whatever else this receiver already owes.
      const fillMainAfter = (i: number) => `ac2702${i}0${"0".repeat(33)}`;
      const filled: number[] = [];
      let cappedRes: Response | null = null;
      for (let i = 0; i < 6 && !cappedRes; i++) {
        appendAudit(fillMainAfter(i), fillMainAfter(i), { ran: 1, failed: 0 });
        const r = await post(`/api/slots/${uId}/watch`, {
          kind: "audit", repo: REPO, mainAfter: fillMainAfter(i), idleSec: 0,
        });
        if (r.ok) filled.push(i);
        else cappedRes = r;
      }
      const cappedText = cappedRes ? await cappedRes.text() : "";
      const cappedFill = cappedRes ? filled.length : -1;
      if (subjectsSubscribed)
        check("budget fixture: the receiver reaches its cap, with the two pending lane rows counted in it",
          cappedRes?.status === 400 && cappedText.includes("max 5 active watches per slot"),
          JSON.stringify({ accepted: filled.length, capped: cappedRes?.status, body: cappedText.slice(0, 80) }));

      // --- (4) THE SUBJECT DIES. Its undelivered notification becomes terminal AS ITSELF: not
      // acknowledged (nobody read it), not receiver-gone (the receiver is alive and still holds a
      // draft), and it frees the budget it was reserving.
      await post(`/api/slots/${doomed.slot}/kill`, {});
      let goneRow: FleetEventRow | undefined;
      for (let i = 0; i < 80 && goneRow?.status !== "subject-gone"; i++) {
        goneRow = await eventById(doomedEvent?.id ?? "x");
        if (goneRow?.status !== "subject-gone") await Bun.sleep(250);
      }
      const stillPending = await settleEvent(await eventById(livingEvent?.id ?? "x"));
      const goneAck = doomedEvent ? await ackEvent(uTok, doomedEvent.id) : new Response(null, { status: 599 });
      const goneAckBody = await goneAck.text();
      const budgetBeforeFree = await receiverBudget();
      // the SAME request the door just refused, now that one row is terminal
      const freedRes = await post(`/api/slots/${uId}/watch`, {
        kind: "audit", repo: REPO, mainAfter: fillMainAfter(cappedFill), idleSec: 0,
      });
      const freedBody = await freedRes.text();
      // The living row is expected to be STILL PENDING here, which is a fact about a composer that
      // is still occupied on a pane that is still the same one. Both are this fixture's to hold.
      const goneIntact = await windowIntact("subject teardown", holdWindow, draft);
      if (goneIntact && subjectsSubscribed)
        check("subject-gone: the torn-down lane's undelivered event is terminal as itself, unackable, and frees its budget",
          goneRow?.status === "subject-gone" && goneRow.deliveredAt === null
          && goneRow.acknowledgedAt === null && goneRow.attempts === 0
          && goneAck.status === 409 && goneAckBody.includes("subject-gone")
          && stillPending?.status === "pending" && freedRes.ok,
          JSON.stringify({ gone: goneRow?.status, deliveredAt: goneRow?.deliveredAt,
            attempts: goneRow?.attempts, ack: goneAck.status, living: stillPending?.status,
            freed: freedRes.status,
            // the two ids this block resolved, so the counterprobe's reads can be compared to
            // THESE and not to an assumption about which row each of them found
            doomedId: doomedEvent?.id ?? null, goneRowId: goneRow?.id ?? null,
            livingId: livingEvent?.id ?? null, livingRowId: stillPending?.id ?? null,
            doomedRows: await rowsWithId(doomedEvent?.id ?? "x"),
            budgetAtFree: budgetBeforeFree, freedBody: freedBody.slice(0, 80) }));

      // …and the HOLD the dead row was carrying ends as itself. Teardown while a hold stands is
      // the case the process-local map must not survive: the row is terminal, nothing will ever
      // probe it again, and the trail has to say so ONCE (with the totals the repeats were
      // aggregating) instead of leaving a reader to infer an ending from silence. The sweep in
      // server.ts#tickWatches owns this, which is why no probe row may follow the end row.
      let doomedEnd: AuditRow | undefined;
      for (let i = 0; i < 40 && !doomedEnd; i++) {
        doomedEnd = holdRowsFor(doomedEvent?.id ?? "x").find((r) => r.phase === "end");
        if (!doomedEnd) await Bun.sleep(250);
      }
      const doomedHoldRows = holdRowsFor(doomedEvent?.id ?? "x");
      if (subjectsSubscribed)
        check("held backoff: a hold whose row went terminal under it ends once, with its totals, and is never probed again",
          !!doomedEnd && doomedEnd.holds === doomedHoldRows.filter((r) => r.phase !== "end").length
          && (doomedEnd.holds ?? 0) >= doomedProbes.length
          && (doomedEnd.detail ?? "").includes("subject-gone")
          && doomedHoldRows.filter((r) => r.phase === "end").length === 1
          && doomedHoldRows.at(-1)?.phase === "end",
          JSON.stringify({ end: doomedEnd ? [doomedEnd.phase, doomedEnd.holds, doomedEnd.heldMs] : null,
            probesAtKill: doomedProbes.length, rows: doomedHoldRows.map((r) => [r.phase, r.holds]) }));

      // --- (5) THE COUNTERPROBE. The draft goes away; the LIVING subject's event is delivered on
      // its first real attempt, and nothing about the dead lane is ever typed into that pane.
      const releaseAt = Date.now();
      await tmuxOut("send-keys", "-t", `s${uId}`, "-N", String([...draft].length), "BSpace");
      let deliveredLiving: FleetEventRow | undefined;
      for (let i = 0; i < 160 && deliveredLiving?.status !== "delivered"; i++) {
        deliveredLiving = await eventById(livingEvent?.id ?? "x");
        if (deliveredLiving?.status !== "delivered") await Bun.sleep(250);
      }
      const deliveredAfterReleaseMs = Date.now() - releaseAt;
      const finalGone = await settleEvent(await eventById(doomedEvent?.id ?? "x"));
      const plog = await plogRead();
      // The composer is deliberately empty from here on, so only the PANE is this window's
      // precondition. It matters: a delivery counted "on its FIRST attempt" is a statement about
      // one occupant, and a replaced pane makes both halves of the sentence unmeasurable.
      const counterIntact = await windowIntact("counterprobe", holdWindow);
      if (counterIntact && subjectsSubscribed)
        check("counterprobe: the live subject's held event is delivered on its FIRST attempt; the dead one is never typed",
          deliveredLiving?.status === "delivered" && deliveredLiving.attempts === 1
          && plog.filter((e) => e.slot === uId
            && e.text.startsWith(`[fleet] slot ${living.slot} (${living.branch})`)).length === 1
          && !plog.some((e) => e.slot === uId
            && e.text.startsWith(`[fleet] slot ${doomed.slot} (${doomed.branch})`))
          && finalGone?.status === "subject-gone",
          JSON.stringify({ living: deliveredLiving?.status, attempts: deliveredLiving?.attempts,
            doomed: finalGone?.status,
            // §11.2j recorded this block reading `pending` for a row the block above had just read
            // as `subject-gone`. Whichever way that resolves, it resolves HERE: the id each read
            // asked for, the id of the row it got back, the status the block above saw, and how
            // many rows currently carry that id.
            doomedId: doomedEvent?.id ?? null, doomedRowId: finalGone?.id ?? null,
            goneSawEarlier: goneRow?.status ?? null,
            flippedBack: goneRow?.status === "subject-gone" && finalGone?.status !== "subject-gone",
            doomedRows: await rowsWithId(doomedEvent?.id ?? "x"),
            livingId: livingEvent?.id ?? null, livingRowId: deliveredLiving?.id ?? null }));

      // THE CEILING IS THE PROMISE: a composer that clears is probed again within
      // HOLD_BACKOFF_MAX_MS, so the row above is delivered EXACTLY ONCE inside that window and the
      // hold closes with one `end` row carrying the totals. The measured bound is generous by one
      // BSpace round-trip and one poll interval — what it must exclude is a backoff that grew past
      // its cap, which is the one way a bounded retry turns into permanent silence.
      const livingHoldRows = holdRowsFor(livingEvent?.id ?? "x");
      const livingEnd = livingHoldRows.filter((r) => r.phase === "end");
      if (counterIntact && subjectsSubscribed)
        check("held backoff: the cleared composer is probed again within the documented ceiling and the hold ends exactly once",
          deliveredLiving?.status === "delivered"
          && deliveredAfterReleaseMs <= HOLD_BACKOFF_MAX_MS + AUTOS_TICK_MS * 4 + 2000
          && livingEnd.length === 1
          && livingEnd[0]?.holds === livingHoldRows.filter((r) => r.phase !== "end").length
          && (livingEnd[0]?.holds ?? 0) >= heldCount
          && livingHoldRows.at(-1)?.phase === "end"
          && (livingEnd[0]?.detail ?? "").includes("typed into it"),
          JSON.stringify({ afterReleaseMs: deliveredAfterReleaseMs, ceilingMs: HOLD_BACKOFF_MAX_MS,
            probesAtRelease: heldCount, end: livingEnd.map((r) => [r.holds, r.heldMs]),
            rows: livingHoldRows.map((r) => [r.phase, r.holds]) }));

      // NOTHING INHERITS A RETRY, asserted across EVERY event this fixture held rather than on the
      // two it names. The hold is keyed by the pair (event, receiver occupant), so a hold can only
      // ever begin at `entry`/`holds:1` and count up by one — a row that opened its life on a
      // `repeat`, or skipped a number, would be a schedule carried over from another row or
      // another occupant. The second guarantee behind it is older and is proven by the
      // receiver-gone family: an event does not outlive the occupant it is bound to, so a recycled
      // receiver has no old row to inherit anything into. Ids already seen before this fixture are
      // excluded — their first row lies outside the window and a rotation could truncate it.
      const holdSliceRows = auditRows().slice(holdAuditStart)
        .filter((r) => r.event === "fleet_event_held");
      const idsBefore = new Set(auditRows().slice(0, holdAuditStart)
        .filter((r) => r.event === "fleet_event_held")
        .map((r) => (r.detail ?? "").slice(0, 24)));
      const holdGroups = new Map<string, AuditRow[]>();
      for (const row of holdSliceRows) {
        const id = (row.detail ?? "").slice(0, 24);
        if (idsBefore.has(id)) continue;
        holdGroups.set(id, [...(holdGroups.get(id) ?? []), row]);
      }
      const inheritance = [...holdGroups.entries()].filter(([, rows]) => {
        const probes = rows.filter((r) => r.phase !== "end");
        return rows[0]?.phase !== "entry" || rows[0]?.holds !== 1
          || probes.some((r, i) => r.holds !== i + 1);
      });
      check("held backoff: every hold in this family starts at entry/holds:1 and counts up — no row inherits another's retry",
        holdGroups.size >= 2 && inheritance.length === 0,
        JSON.stringify({ groups: holdGroups.size,
          shapes: [...holdGroups.entries()].map(([id, rows]) =>
            `${id.slice(0, 8)}:${rows.map((r) => `${r.phase}${r.holds}`).join(",")}`).slice(0, 6),
          offenders: inheritance.map(([id]) => id.slice(0, 8)) }));

      // Hand the receiver back empty — later families read this slot's budget and its pane, and on
      // a tree WITHOUT the fix the dead lane's row is still pending and still deliverable, so this
      // has to drain rather than assume. Two levers, both the owner's: keep the composer clear so
      // transport can run at all, and acknowledge whatever reaches a closable state.
      for (let i = 0; i < 200; i++) {
        const open = await openDebts();
        if (!open.length) break;
        const held = stateBuffer().text;
        if (held.length > 0)
          await tmuxOut("send-keys", "-t", `s${uId}`, "-N", String([...held].length), "BSpace");
        for (const e of open) {
          if (e.status === "delivered" || e.status === "send-uncertain") await ackEvent(uTok, e.id);
        }
        await Bun.sleep(250);
      }
      check("acp-27 teardown: the receiver carries no open delivery debt into the next family",
        (await openDebts()).length === 0,
        JSON.stringify((await openDebts()).map((e) => `${e.kind}:${e.status}`)));
      await post(`/api/slots/${living.slot}/kill`, {});

      // --- (6) §11.2j's ROOT, MEASURED AS ITSELF RATHER THAN THROUGH THE FIXTURE ABOVE.
      // Everything up to here reads the tick from the OUTSIDE and can only report the damage:
      // a row the block above read as `subject-gone` reading `pending` again (`flippedBack`),
      // beside a budget door that refuses because that resurrected row is still spending it
      // (`freed:400`) — 12 of 12 red runs since b20e7e4 carry the first, 11 of them both.
      // The mechanism is one lost update inside server.ts#tickWatches: the loop validates a row
      // (`status === "pending"`, subject present), then AWAITS `canDeliver`, which shells out to
      // ps/pgrep. An owner kill of the subject lane runs to completion inside that await and
      // `markFleetEventsSubjectGone` writes the terminal state on the very row the loop is
      // holding — after which the loop wrote its `send-uncertain` marker over it.
      // This probe drives that window directly: the tick is PARKED in it by a server-side latch,
      // the subject is killed while it stands there, and what the tick writes on release is read.
      // It needs no draft and no refusal — with a free composer the unrepaired tick DELIVERS a
      // torn-down lane's notification into the pane, which is the product harm the terminal state
      // exists to prevent, and it is asserted here as a prompt-log fact.
      {
        const tickLatch = process.env.FLEET_TEST_WATCH_TICK_LATCH ?? "";
        const clearTickLatch = (): void => {
          for (const suffix of ["", ".reached", ".release"]) rmSync(`${tickLatch}${suffix}`, { force: true });
        };
        // 60 s, because the WATCH still has to fire first and the completion predicate it fires on
        // is recomputed on the 10 s tickGit — the same bound the doomed/living mint above uses.
        const latchReached = async (): Promise<string> => {
          for (let i = 0; i < 600 && !existsSync(`${tickLatch}.reached`); i++) await Bun.sleep(100);
          return existsSync(`${tickLatch}.reached`) ? readFileSync(`${tickLatch}.reached`, "utf8") : "";
        };
        // The probe cannot run without the knob, and a probe that cannot run must fail as ITSELF —
        // never as the contract it was going to measure (CLAUDE.md, and §11.2j's own lesson).
        const latchArmable = tickLatch.length > 0 && !existsSync(tickLatch);
        check("tick-window fixture: the suite states the server-side tick latch and it is disarmed",
          latchArmable, JSON.stringify({ path: tickLatch.length > 0, alreadyArmed: existsSync(tickLatch) }));

        // A free composer, in BOTH readings transport uses: the unrepaired tick must be able to
        // reach the pane, otherwise "nothing was typed" would be true for the wrong reason.
        setComposerMode("normal");
        const tickDrained = await drainComposer(40);
        await tmuxOut("send-keys", "-t", `s${uId}`, "BSpace");
        await Bun.sleep(100);
        const tickFrame = composerResidue({ kind: "rules" },
          (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out);
        const tickWindow = await receiverId();
        check("tick-window fixture: the receiver enters the window live, with an empty composer in both readings",
          stateBuffer().text === "" && tickFrame === ""
          && tickWindow.paneId !== "" && tickWindow.agent === "alive",
          JSON.stringify({ drained: tickDrained, internal: stateBuffer().text.length,
            frame: (tickFrame ?? "?").slice(0, 40), pane: tickWindow.paneId, agent: tickWindow.agent }));

        const doomedLane = (await (await post("/api/lanes", { repo: REPO })).json()) as
          { slot: number; cwd: string; branch: string };
        await Bun.write(`${doomedLane.cwd}/acp27-tick-window.txt`, "tick window subject\n");
        spawnSync("git", ["-C", doomedLane.cwd, "add", "acp27-tick-window.txt"]);
        spawnSync("git", ["-C", doomedLane.cwd, "commit", "-qm", "acp27 tick window subject"]);
        let tickSubjectReady = false;
        for (let i = 0; i < 90 && !tickSubjectReady; i++) {
          const row = ((await (await get("/api/sessions")).json()) as
            { slots: { id: number; git: { ahead?: number; dirty?: number } | null }[] }).slots
            .find((x) => x.id === doomedLane.slot);
          tickSubjectReady = row?.git?.ahead === 1 && row.git.dirty === 0;
          if (!tickSubjectReady) await Bun.sleep(500);
        }
        check("tick-window fixture: the subject lane is committed and clean, so its completion mints one event",
          tickSubjectReady, JSON.stringify({ slot: doomedLane.slot, branch: doomedLane.branch }));

        // Arm on THIS branch: the latch fires for one row and cannot park a neighbouring family's.
        clearTickLatch();
        if (latchArmable) writeFileSync(tickLatch, `${doomedLane.branch}\n`, { mode: 0o600 });
        const tickWatchRes = await post(`/api/slots/${uId}/watch`, { target: doomedLane.slot, idleSec: 0 });
        const tickWatchId = ((await tickWatchRes.json()) as { watch?: WatchRow }).watch?.id ?? "";
        const parkedRaw = latchArmable ? await latchReached() : "";
        const parked = parkedRaw ? JSON.parse(parkedRaw) as
          { eventId: string; status: string; attempts: number } : null;
        check("tick-window fixture: the tick is parked inside its own delivery window, on a pending row it has not marked yet",
          tickWatchRes.ok && /^[0-9a-f]{8}$/.test(tickWatchId)
          && parked?.status === "pending" && parked.attempts === 0,
          JSON.stringify({ watch: tickWatchRes.status, watchId: tickWatchId, parked }));

        // The world moves while the tick stands in it — the only thing this probe injects.
        await post(`/api/slots/${doomedLane.slot}/kill`, {});
        let killedRow: FleetEventRow | undefined;
        for (let i = 0; i < 60 && killedRow?.status !== "subject-gone"; i++) {
          killedRow = await eventById(parked?.eventId ?? "x");
          if (killedRow?.status !== "subject-gone") await Bun.sleep(100);
        }
        check("tick-window fixture: the subject dies while the tick is parked and the row goes terminal underneath it",
          killedRow?.status === "subject-gone" && killedRow.attempts === 0
          && killedRow.deliveredAt === null,
          JSON.stringify({ status: killedRow?.status, attempts: killedRow?.attempts,
            deliveredAt: killedRow?.deliveredAt ?? null }));

        if (latchArmable) writeFileSync(`${tickLatch}.release`, "ok\n", { mode: 0o600 });
        // Give the released tick its full round plus two more: the damage this measures is written
        // by the release itself, and any later tick would only sweep the row a second time.
        await Bun.sleep(AUTOS_TICK_MS * 8 + 1500);
        const afterRelease = await eventById(parked?.eventId ?? "x");
        const typedAfter = (await plogRead()).filter((e) => e.slot === uId
          && e.text.startsWith(`[fleet] slot ${doomedLane.slot} (${doomedLane.branch})`));
        const budgetAfter = await receiverBudget();
        const tickIntact = await windowIntact("tick window", tickWindow, "");
        if (tickIntact)
          check("tick window: a row that went terminal while the tick was parked is never remarked, never typed, and stops spending its receiver's budget",
            afterRelease?.status === "subject-gone" && afterRelease.attempts === 0
            && afterRelease.deliveredAt === null && typedAfter.length === 0
            && !budgetAfter.open.some((row) => row.startsWith(`${parked?.eventId}:`)),
            JSON.stringify({ status: afterRelease?.status, attempts: afterRelease?.attempts,
              deliveredAt: afterRelease?.deliveredAt ?? null, typed: typedAfter.length,
              typedHead: typedAfter.map((t) => t.text.slice(0, 60)),
              open: budgetAfter.open, eventId: parked?.eventId ?? null }));
        clearTickLatch();
        setComposerMode("hold");
      }
    }

    // Later modules own the post-land ledger's zero-row and exact-count fixtures. Restore the byte
    // snapshot rather than making them measure ACP-26's synthetic transport rows.
    if (auditFileExisted) writeFileSync(auditFile, auditFileBefore);
    else rmSync(auditFile, { force: true });
    setComposerMode("normal");
    // AN EMPTY COMPOSER IS THE KILL-SWITCH FAMILY'S PRECONDITION, NOT ITS SUBJECT. Residue makes
    // sendText refuse BEFORE the paste, and a refusal is not an attempt: server.ts puts the event
    // back to `pending` and rolls `attempts` to 0 (the SendRefused arm of tickWatches) — which the
    // three checks below then read as "the release never delivered". One BSpace and a 100 ms sleep
    // asserted this; a drain to a window of CONFIRMED emptiness establishes it, and it is read in
    // BOTH places transport looks: the stand-in's internal buffer and the rendered frame.
    const killSwitchDrained = await drainComposer(40);
    await tmuxOut("send-keys", "-t", `s${uId}`, "BSpace"); // repaint the now-empty normal composer
    await Bun.sleep(100);
    const killSwitchFrame = (await tmuxOut("capture-pane", "-p", "-e", "-t", `s${uId}`)).out;
    const killSwitchWindow = await receiverId();
    check("kill-switch fixture: the receiver opens the window with a composer empty in BOTH readings transport uses",
      stateBuffer().text === "" && composerResidue({ kind: "rules" }, killSwitchFrame) === ""
      && killSwitchWindow.paneId !== "" && killSwitchWindow.agent === "alive",
      JSON.stringify({ drainedBytes: killSwitchDrained, internal: stateBuffer().text.length,
        frame: (composerResidue({ kind: "rules" }, killSwitchFrame) ?? "?").slice(0, 40),
        pane: killSwitchWindow.paneId, agent: killSwitchWindow.agent }));
    const catalog = (await (await get("/api/harnesses")).json()) as
      { harnesses: { id: string; automatable: boolean; allowsLanes: boolean; singleton: boolean }[] };
    const uHarness = catalog.harnesses.find((h) => h.id === "pi-unfenced");
    check("pi-unfenced's static adapter policy stays false/main-only/singleton; the Watch exception belongs to the subscribed act",
      uHarness?.automatable === false && uHarness.allowsLanes === false && uHarness.singleton === true,
      JSON.stringify(uHarness));

    check("watch pi-unfenced kill-switch fixture: owner pauses automation before subscribing",
      (await post("/api/autos/switch", { on: false })).ok);
    const subscribed = await selfWatch(uTok, { target: uTgt.slot, idleSec: 0 });
    const subscribedJ = (await subscribed.json()) as { watch?: WatchRow; error?: string };
    check("live pi-unfenced Self route explicitly subscribes to its controlled committed lane",
      subscribed.ok && subscribedJ.watch?.armed === true && subscribedJ.watch.target === uTgt.slot,
      `${subscribed.status} ${JSON.stringify(subscribedJ)}`);

    // Only structural prerequisites exposed by this poll: committed+clean target facts and the
    // armed subscription. `lastOutput>0` is not required by idleSec:0 and was a false fixture gate.
    let targetReady = false;
    for (let i = 0; i < 60 && !targetReady; i++) {
      const rows = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; git: { ahead?: number; dirty?: number } | null }[] }).slots;
      const row = rows.find((x) => x.id === uTgt.slot);
      targetReady = row?.git?.ahead === 1 && row.git.dirty === 0;
      if (!targetReady) await Bun.sleep(500);
    }
    check("watch pi-unfenced kill-switch fixture: target is measurably committed+clean",
      targetReady, String(targetReady));
    await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
    const paused = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
    const pausedEvent = await settleEvent(
      subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined);
    check("signal capture spends the pi-unfenced Watch and persists exactly one event even while transport is paused",
      paused?.armed === false && pausedEvent?.status === "pending"
      && (await eventRows()).filter((e) => e.watchId === subscribedJ.watch?.id).length === 1
      && !(await plogRead()).some((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)),
      JSON.stringify({ watch: paused, event: pausedEvent }));
    check("watch pi-unfenced kill-switch fixture: owner releases automation",
      (await post("/api/autos/switch", { on: true })).ok);

    let delivered: FleetEventRow | undefined;
    for (let i = 0; i < 45 && delivered?.status !== "delivered"; i++) {
      await Bun.sleep(1000);
      delivered = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
    }
    const oldPolicySkip = "skipped — harness pi-unfenced is not automatable";
    // All three reads below are about ONE delivery into ONE pane: the event reached it once, the
    // prompt log carries exactly one row for it, and no later tick adds a second. Every one of
    // those sentences is false-by-construction if the pane was replaced mid-window — the prompt log
    // is keyed on the slot, not the occupant, so a successor's row would be counted here as a
    // duplicate delivery. Establish the occupant, then read (§11.2j).
    const killIntact = await windowIntact("kill-switch release", killSwitchWindow);
    if (killIntact) {
      check("after kill-switch release the pending event reaches live pi-unfenced once as delivered, never acked by tmux",
        delivered?.status === "delivered" && delivered.attempts === 1
        && delivered.acknowledgedAt === null, JSON.stringify(delivered));
      const uMessages = (await plogRead()).filter((e) => e.slot === uId
        && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`));
      check("the fixed completion notification has exactly one matching prompt-log row on pi-unfenced",
        uMessages.length === 1, `${uMessages.length}: ${uMessages.map((m) => m.text.slice(0, 80)).join(" | ")}`);
      await Bun.sleep(AUTOS_TICK_MS * 4 + 1500);
      const uAfter = subscribedJ.watch?.id ? await watchRow(subscribedJ.watch.id) : undefined;
      const uEventAfter = subscribedJ.watch?.id ? await eventForWatch(subscribedJ.watch.id) : undefined;
      // the later ticks are part of THIS check's window too — it is the one that says "and no
      // second row ever appeared", which a fresh occupant would satisfy or break by accident
      if (await windowIntact("one-shot across later ticks", killSwitchWindow))
        check("the pi-unfenced event remains one-shot across later ticks and never records the old skip",
          uAfter?.armed === false && uAfter.lastResult === "sent" && uEventAfter?.status === "delivered"
          && (await plogRead()).filter((e) => e.slot === uId
            && e.text.startsWith(`[fleet] slot ${uTgt.slot} (${uTgt.branch})`)).length === 1
          && !(await watchRows()).some((w) => w.slot === uId && (w.lastResult ?? "").includes(oldPolicySkip)),
          JSON.stringify({ watch: uAfter, event: uEventAfter }));
    }

    // Identity falsifier: recycle the numeric slot while an exact held payload is inside the
    // failure window, then type an owner draft into the successor. rollbackOwnComposerPayload must
    // compare the snapshotted slot+openedAt+sessionId before BSpace and leave the successor bytes.
    const identityMainAfter = `ac260000${"0".repeat(32)}`;
    setComposerMode("hold");
    appendAudit(identityMainAfter, identityMainAfter, { ran: 1, failed: 0 });
    const identityWatchRes = await post(`/api/slots/${uId}/watch`, {
      kind: "audit", repo: REPO, mainAfter: identityMainAfter, idleSec: 0,
    });
    const identityWatch = await identityWatchRes.json() as { watch?: { id: string } };
    const identityEvent = identityWatch.watch?.id ? await waitAuditEvent(identityWatch.watch.id) : undefined;
    const heldIdentity = identityEvent
      ? await waitComposerState(identityEvent.id, (s) => s.phase.startsWith("entered:") && s.text.includes(identityEvent.id))
      : stateBuffer();
    const oldOpenedAt = identityEvent?.receiverOpenedAt;
    // The falsifier can only falsify something that is actually there. Without this line an event
    // that never reached the hold (waitAuditEvent timing out, a watch the door refused) leaves
    // `oldOpenedAt` undefined — and `successorOpenedAt !== oldOpenedAt` is then trivially TRUE,
    // i.e. the identity conjunct passes without ever having compared two identities. Named here so
    // the fixture's own failure cannot be read as a rollback defect, and cannot pass by accident.
    const identityIntact = identityWatchRes.ok && !!identityEvent
      && typeof oldOpenedAt === "number" && oldOpenedAt > 0
      && heldIdentity.text.includes(identityEvent.id);
    check("rollback identity fixture: the exact payload is HELD in the pre-kill composer of a known occupant",
      identityIntact, JSON.stringify({ watch: identityWatchRes.status, event: identityEvent?.status ?? null,
        eventId: identityEvent?.id ?? null, oldOpenedAt: oldOpenedAt ?? null,
        phase: heldIdentity.phase, heldBytes: heldIdentity.text.length,
        carriesEventId: heldIdentity.text.includes(identityEvent?.id ?? "not-an-event") }));
    await post(`/api/slots/${uId}/kill`, {});
    setComposerMode("normal");
    const successorOpen = await post(`/api/slots/${uId}/open`, { cwd: REPO, harness: "pi-unfenced" });
    let successorOpenedAt = 0;
    let successorAgent: string | null = null;
    for (let i = 0; i < 80 && successorAgent !== "alive"; i++) {
      const row = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; openedAt: number; agent: string | null }[] }).slots.find((s) => s.id === uId);
      successorOpenedAt = row?.openedAt ?? 0;
      successorAgent = row?.agent ?? null;
      if (successorAgent !== "alive") await Bun.sleep(50);
    }
    // Let the old inputChain settle through its identity refusal before composing on the successor.
    await Bun.sleep(Number(process.env.FLEET_ACCEPT_WAIT_MS ?? 800) + 200);
    const successorDraft = "owner successor draft survives slot reuse";
    const successorSend = await post("/send", { slot: uId, text: successorDraft, submit: false });
    let successorState = stateBuffer();
    for (let i = 0; i < 80 && successorState.text !== successorDraft; i++) {
      await Bun.sleep(50);
      successorState = stateBuffer();
    }
    if (identityIntact)
      check("rollback live falsifier: recycled slot identity leaves the successor owner's draft byte-for-byte",
        identityWatchRes.ok && heldIdentity.text.includes(identityEvent?.id ?? "not-an-event")
        && successorOpen.ok && successorAgent === "alive" && successorOpenedAt !== oldOpenedAt
        && successorSend.ok && successorState.text === successorDraft,
        JSON.stringify({ watch: identityWatchRes.status, heldBytes: heldIdentity.text.length,
          open: successorOpen.status, agent: successorAgent, identityChanged: successorOpenedAt !== oldOpenedAt,
          send: successorSend.status, draftBytes: successorState.text.length }));
    if (auditFileExisted) writeFileSync(auditFile, auditFileBefore);
    else rmSync(auditFile, { force: true });
    await post(`/api/slots/${uTgt.slot}/kill`, {});
    await post(`/api/slots/${uId}/kill`, {});
  }

  // === CLARIFICATION-CHANNEL-V1 ================================================================
  // All receiver identities below are established as server facts first. The only direct state
  // mutation is the persisted Program/task provenance fixture and one deliberately legacy Watch;
  // the request route then has no caller-supplied identity it could accidentally trust.
  {
    const main1 = await freeSlot();
    const main1Open = main1 ? await post(`/api/slots/${main1}/open`, { cwd: REPO, label: "clarification-main" }) : null;
    const main2 = await freeSlot();
    const main2Open = main2 ? await post(`/api/slots/${main2}/open`, { cwd: REPO, label: "clarification-other-main" }) : null;
    const makeLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const prog = await makeLane();
    const watched = await makeLane();
    const agreed = await makeLane();
    const conflicted = await makeLane();
    const multi = await makeLane();
    const none = await makeLane();
    const legacy = await makeLane();
    const replacedMainWorker = await makeLane();
    const legacyOwner = await makeLane();
    check("clarification fixtures: two MAIN occupants and nine distinct worker lanes exist",
      !!main1Open?.ok && !!main2Open?.ok
        && new Set([prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker, legacyOwner]
          .map((x) => x.slot)).size === 9,
      JSON.stringify({ main1, main2, lanes: [prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker, legacyOwner].map((x) => x.slot) }));

    const main1Tok = await paneEnv(`s${main1}`, "FLEET_SELF_TOKEN") ?? "";
    const main2Tok = await paneEnv(`s${main2}`, "FLEET_SELF_TOKEN") ?? "";
    const laneTokens = new Map<number, string>();
    for (const lane of [prog, watched, agreed, conflicted, multi, none, legacy, replacedMainWorker])
      laneTokens.set(lane.slot, await paneEnv(`s${lane.slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("clarification fixtures: every participant has an exact, distinct scoped credential",
      [main1Tok, main2Tok, ...laneTokens.values()].every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([main1Tok, main2Tok, ...laneTokens.values()]).size === 10);

    const subscribe = async (receiver: number, worker: { slot: number }) => {
      const r = await post(`/api/slots/${receiver}/watch`, { target: worker.slot, idleSec: 3600 });
      return { response: r, body: await r.json() as { watch?: WatchRow } };
    };
    const watchedSub = await subscribe(main1, watched);
    const agreedSub = await subscribe(main1, agreed);
    const conflictSub = await subscribe(main2, conflicted);
    // `conflicted` is program-bound to main1 AND carries two distinct watch occupants (main1+main2).
    // Before the receiver reorder that combination was the WORST case a bound lane could be in: the
    // multi-watcher refusal fires before any program branch is reached, so the lane with the most
    // evidence about who coordinates it was the one that could not file at all.
    const conflictSub2 = await subscribe(main1, conflicted);
    const multiSub1 = await subscribe(main1, multi);
    const multiSub2 = await subscribe(main2, multi);
    const replacedMainSub = await subscribe(main2, replacedMainWorker);
    check("clarification lane-watch fixtures: fresh receiver-occupant Watches are persisted before derivation",
      [watchedSub, agreedSub, conflictSub, conflictSub2, multiSub1, multiSub2, replacedMainSub]
        .every((x) => x.response.ok && (x.body.watch?.slotOpenedAt ?? 0) > 0));

    await stopSrv();
    const clarificationStatePath = `${ROOT}/fleet.json`;
    const planted = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      watches?: Record<string, unknown>[]; clarifications?: unknown[];
    };
    const programId = "c".repeat(24);
    const mainRow = planted.slots[String(main1)];
    delete planted.clarifications; // legacy-state counterprobe: the field did not exist before v1
    planted.slots[String(legacyOwner.slot)].awaiting = "owner";
    planted.programs = [...(planted.programs ?? []), {
      id: programId, title: "Clarification fixture", intent: "Route exact worker questions",
      successCriterion: "The bound MAIN replies once", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: main1, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId, boundAt: Date.now() - 700 },
    }];
    for (const lane of [prog, agreed, conflicted]) planted.slots[String(lane.slot)].programId = programId;
    planted.slots[String(prog.slot)].taskId = "task-server-stamp";
    planted.slots[String(prog.slot)].originId = "origin-server-stamp";
    for (const watch of planted.watches ?? []) {
      if ([watched.slot, agreed.slot, conflicted.slot, multi.slot, replacedMainWorker.slot].includes(Number(watch.target))) {
        watch.armed = false;
        watch.firedAt = Date.now();
        watch.lastResult = "spent fixture still names coordinating occupant";
      }
    }
    planted.watches = [...(planted.watches ?? []), {
      id: "legacyclarificationwatch", slot: main1, idleSec: 0, armed: false,
      created: Date.now(), firedAt: Date.now(), lastResult: "sent", kind: "lane",
      target: legacy.slot, targetCwd: legacy.cwd, targetBranch: legacy.branch,
    }];
    writeFileSync(clarificationStatePath, JSON.stringify(planted, null, 2), { mode: 0o600 });
    await restartSrv();
    const legacyLoaded = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      clarifications?: unknown[]; slots?: Record<string, { awaiting?: string }>;
    };
    check("clarification legacy state: absent clarifications loads as [] while awaiting:'owner' stays valid",
      Array.isArray(legacyLoaded.clarifications) && legacyLoaded.clarifications.length === 0
        && legacyLoaded.slots?.[String(legacyOwner.slot)]?.awaiting === "owner",
      JSON.stringify({ clarifications: legacyLoaded.clarifications, awaiting: legacyLoaded.slots?.[String(legacyOwner.slot)]?.awaiting }));

    // EDGE B counter-probe. An "owner" wait waits for exactly the person now typing, so the owner's
    // own /send still clears it — the wait exists to hold AUTOMATION back, never its addressee.
    // BREAKS IF: /send stops clearing awaiting at all (the over-correction of only preserving
    // "main"), leaving a clarify lane parked against the owner who just answered it.
    const legacyOwnerTok = await paneEnv(`s${legacyOwner.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const ownerWaitBefore = ((await (await selfGet(legacyOwnerTok)).json()) as { awaiting?: string | null }).awaiting;
    await post("/send", { slot: legacyOwner.slot, text: "owner answers the clarify wait", submit: false });
    const ownerWaitAfter = ((await (await selfGet(legacyOwnerTok)).json()) as { awaiting?: string | null }).awaiting;
    check("owner /send still clears an 'owner' wait — the person it waits for has spoken",
      ownerWaitBefore === "owner" && (ownerWaitAfter ?? null) === null,
      `${ownerWaitBefore} -> ${ownerWaitAfter}`);
    await post(`/api/slots/${legacyOwner.slot}/kill`, {});

    const progTok = laneTokens.get(prog.slot) ?? "";
    const watchedTok = laneTokens.get(watched.slot) ?? "";
    const agreedTok = laneTokens.get(agreed.slot) ?? "";
    const beforeRejectEvents = (await clarificationEventRows()).length;
    const noEvidence = await selfClarify(laneTokens.get(none.slot) ?? "", { question: "Who coordinates me?" });
    const legacyOnly = await selfClarify(laneTokens.get(legacy.slot) ?? "", { question: "Who owns this legacy watch?" });
    const multiple = await selfClarify(laneTokens.get(multi.slot) ?? "", { question: "Which watcher?" });
    const [noEvidenceText, legacyOnlyText, multipleText] = await Promise.all([
      noEvidence.text(), legacyOnly.text(), multiple.text(),
    ]);
    const rejectedState = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      clarifications?: unknown[]; slots?: Record<string, { awaiting?: string | null }>;
    };
    check("clarification rejection: no exact evidence is a named 409 with no request/event/wait mutation",
      noEvidence.status === 409 && noEvidenceText.includes("no exact clarification receiver evidence")
        && (rejectedState.slots?.[String(none.slot)]?.awaiting ?? null) === null);
    check("clarification rejection: legacy Watch without slotOpenedAt has its own named 409",
      legacyOnly.status === 409 && legacyOnlyText.includes("only legacy lane-watch evidence exists without slotOpenedAt")
        && (rejectedState.slots?.[String(legacy.slot)]?.awaiting ?? null) === null);
    check("clarification rejection: two Watch occupants are a distinct 409 without request or event",
      multiple.status === 409 && multipleText.includes("lane-watch evidence names multiple receiver occupants")
        && (await clarificationEventRows()).length === beforeRejectEvents
        && (rejectedState.clarifications?.length ?? 0) === 0);

    const ownerAsSelf = await fetch(`${BASE}/api/self/clarifications`, {
      method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": TOKEN },
      body: JSON.stringify({ question: "owner cannot substitute" }),
    });
    const plainRequest = await selfClarify(main1Tok, { question: "plain cannot ask" });
    const missingRequest = await selfClarify(null, { question: "missing cannot ask" });
    check("clarification request scope: plain non-lane is 409; owner/missing credentials are 401",
      plainRequest.status === 409 && ownerAsSelf.status === 401 && missingRequest.status === 401,
      `${plainRequest.status}/${ownerAsSelf.status}/${missingRequest.status}`);

    const invalids = await Promise.all([
      selfClarify(progTok, { question: "" }),
      selfClarify(progTok, { question: "x".repeat(2001) }),
      selfClarify(progTok, { question: 7 }),
      selfClarify(progTok, {}, "{not-json"),
      selfClarify(progTok, {}, JSON.stringify({ question: "wrong media" }), "text/plain"),
    ]);
    check("clarification validation: empty, oversized, non-string, malformed JSON and wrong media fail closed 400",
      invalids.every((r) => r.status === 400), invalids.map((r) => r.status).join("/"));

    const spoof = await selfClarify(progTok, {
      question: "  Need the exact scope decision.  ", worker: { slot: 999 }, receiver: { slot: 999 },
      taskId: "spoof-task", originId: "spoof-origin", programId: "spoof-program", basis: "lane-watch",
      eventId: "f".repeat(24), askedAt: 1, status: "answered",
    });
    const spoofBody = await spoof.json() as { request?: ClarificationRow; existing?: boolean };
    const progRequest = spoofBody.request;
    const progEvent = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    check("clarification program-main: exactly the active bound MAIN gets one server-stamped event",
      spoof.ok && progRequest?.basis === "program-main" && progRequest.receiver.slot === main1
        && progEvent?.receiverSlot === main1 && progEvent.watchId === null
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === progRequest?.id).length === 1,
      JSON.stringify({ request: progRequest, event: progEvent }));
    check("clarification body spoofing cannot overwrite worker/receiver/task/origin/program provenance",
      progRequest?.worker.slot === prog.slot && progRequest.worker.cwd === prog.cwd && progRequest.worker.branch === prog.branch
        && progRequest.provenance.taskId === "task-server-stamp"
        && progRequest.provenance.originId === "origin-server-stamp"
        && progRequest.provenance.programId === programId && progRequest.question === "Need the exact scope decision."
        && !JSON.stringify(progRequest).includes("spoof-"), JSON.stringify(progRequest));
    const laneReplyAttempt = progRequest
      ? await replyClarification(laneTokens.get(none.slot) ?? "", progRequest.id, "lane cannot answer")
      : new Response(null, { status: 599 });
    check("clarification reply scope: a lane credential is recognized but refused 409 before receiver binding",
      laneReplyAttempt.status === 409 && (await laneReplyAttempt.text()).includes("a lane may not reply"));

    const watchOpen = await selfClarify(watchedTok, { question: "Watch-routed question" });
    const watchRequest = (await watchOpen.json() as { request?: ClarificationRow }).request;
    const watchEvent = (await clarificationEventRows()).find((e) => e.id === watchRequest?.eventId);
    check("clarification lane-watch: a non-program lane routes to its fresh exact Watch subscriber",
      watchOpen.ok && watchRequest?.basis === "lane-watch" && watchRequest.receiver.slot === main1
        && watchEvent?.receiverSlot === main1 && watchEvent.payload.basis === "lane-watch");

    const agreeOpen = await selfClarify(agreedTok, { question: "Both facts agree" });
    const agreeRequest = (await agreeOpen.json() as { request?: ClarificationRow }).request;
    check("clarification matching Program+Watch evidence resolves once to one occupant and one event",
      agreeOpen.ok && agreeRequest?.basis === "program-main" && agreeRequest.receiver.slot === main1
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === agreeRequest.id).length === 1);

    // --- receiver: program binding first ---------------------------------------------------
    // clarificationReceiverFor answers "who coordinates this lane" for BOTH self-routes (the
    // clarification above and the fleet-report below it in server.ts), so the two directions are
    // one rule and are checked as a pair. Losing either is a distinct, opposite defect:
    //   (a) consulting watch evidence first refuses a BOUND lane for something it cannot fix —
    //       a stranger's stale subscription, invisible from inside the pane, and the worker's
    //       result then has nowhere to go at exactly the moment it has something to say;
    //   (b) dropping the program-LESS refusal would silently pick one of two watchers, which is
    //       a coin toss dressed as a routing decision.
    // BREAKS IF: the `basis: "program-main"` return moves back below `const watchReceivers`.
    const eventsBeforeDirections = (await clarificationEventRows()).length;
    const boundOpen = await selfClarify(laneTokens.get(conflicted.slot) ?? "", { question: "Which MAIN?" });
    const boundRequest = (await boundOpen.json() as { request?: ClarificationRow }).request;
    const boundEvent = (await clarificationEventRows()).find((e) => e.id === boundRequest?.eventId);
    check("receiver direction (a): a program-bound lane reaches its bound MAIN past two watchers naming different occupants",
      boundOpen.ok && boundRequest?.basis === "program-main" && boundRequest.receiver.slot === main1
        && boundRequest.provenance.programId === programId
        && boundEvent?.receiverSlot === main1 && boundEvent.watchId === null
        && boundEvent.payload.basis === "program-main",
      JSON.stringify({ status: boundOpen.status, basis: boundRequest?.basis,
        receiver: boundRequest?.receiver, event: boundEvent?.receiverSlot }));
    // …and the opposite direction, re-asked on the same fixture that was refused above: the
    // sentence is the contract, so it is matched verbatim rather than by status alone.
    const unboundAgain = await selfClarify(laneTokens.get(multi.slot) ?? "", { question: "Still which watcher?" });
    const unboundText = await unboundAgain.text();
    check("receiver direction (b): a program-LESS lane with two watchers keeps the exact refusal and mints nothing",
      unboundAgain.status === 409
        && unboundText.includes("lane-watch evidence names multiple receiver occupants")
        && (await clarificationEventRows()).length === eventsBeforeDirections + 1,
      `${unboundAgain.status} ${unboundText}`);
    const [workerScope, mainScope, foreignScope] = await Promise.all([
      selfClarifications(progTok), selfClarifications(main1Tok), selfClarifications(main2Tok),
    ]);
    check("clarification GET scope: worker sees only its occupant rows; MAIN sees only exact receiver rows",
      workerScope.requests.length === 1 && workerScope.requests[0]?.id === progRequest?.id
        && mainScope.requests.length === 4
        && mainScope.requests.every((c) => c.receiver.slot === main1)
        && foreignScope.requests.length === 0,
      JSON.stringify({ worker: workerScope.requests.map((c) => c.id), main: mainScope.requests.map((c) => c.id), foreign: foreignScope.requests }));

    const idem = await selfClarify(progTok, { question: "A different retry body cannot mint a twin" });
    const idemBody = await idem.json() as { existing?: boolean; request?: ClarificationRow };
    check("clarification open request is occupant-idempotent with no second request/event/prompt",
      idem.ok && idemBody.existing === true && idemBody.request?.id === progRequest?.id
        && (await clarificationEventRows()).filter((e) => e.payload.requestId === progRequest?.id).length === 1
        && (await plogRead()).filter((p) => p.text.includes(`request ${progRequest?.id}`)).length === 0);

    const pendingSelf = await selfClarifications(progTok);
    await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
    const stillPending = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    check("clarification transport: busy MAIN keeps the durable event pending while worker visibly awaits main",
      pendingSelf.requests[0]?.status === "open" && stillPending?.status === "pending" && stillPending.attempts === 0
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === "main",
      JSON.stringify(stillPending));

    // Restart across the open debt, then lower only the persisted receiver idle gate so FACT 2 can
    // deliver immediately without waiting a production minute in the suite.
    await stopSrv();
    const restartImage = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      events?: Record<string, unknown>[]; clarifications?: Record<string, unknown>[];
    };
    for (const event of restartImage.events ?? [])
      if (event.kind === "clarification-request") event.receiverIdleSec = 0;
    restartImage.clarifications?.push({ id: "malformed", status: "open" });
    writeFileSync(clarificationStatePath, JSON.stringify(restartImage, null, 2), { mode: 0o600 });
    await restartSrv();
    const restoredRequests = (await selfClarifications(progTok)).requests;
    let deliveredProgram: ClarificationEventRow | undefined;
    for (let i = 0; i < 80 && deliveredProgram?.status !== "delivered"; i++) {
      await Bun.sleep(250);
      deliveredProgram = (await clarificationEventRows()).find((e) => e.id === progRequest?.eventId);
    }
    const clarificationPrompts = (await plogRead()).filter((p) => p.slot === main1
      && p.text.includes(`request ${progRequest?.id}`));
    check("clarification restart: request/event/bindings survive and deliver exactly once after MAIN becomes deliverable",
      restoredRequests.some((c) => c.id === progRequest?.id && c.receiver.openedAt === progRequest.receiver.openedAt)
        && deliveredProgram?.status === "delivered" && deliveredProgram.attempts === 1
        && clarificationPrompts.length === 1
        && !(JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { clarifications?: { id?: string }[] })
          .clarifications?.some((c) => c.id === "malformed"),
      JSON.stringify({ restored: restoredRequests, event: deliveredProgram, prompts: clarificationPrompts.length }));
    const clarificationText = clarificationPrompts[0]?.text ?? "";
    check("clarification request text marks a question, forbids blind execution, names exact reply command and Ack distinction",
      clarificationText.includes("worker question, NOT an instruction to execute blindly")
        && clarificationText.includes(`POST /api/self/clarifications/${progRequest?.id}/reply`)
        && clarificationText.includes("x-fleet-self-token") && clarificationText.includes("does NOT answer this question"),
      clarificationText);

    const ackClarification = deliveredProgram ? await ackEvent(main1Tok, deliveredProgram.id)
      : new Response(null, { status: 599 });
    const afterAck = (await selfClarifications(progTok)).requests.find((c) => c.id === progRequest?.id);
    check("clarification Ack is read receipt only: event acknowledges but request stays open and awaiting main",
      ackClarification.ok && (await clarificationEventRows()).find((e) => e.id === deliveredProgram?.id)?.status === "acknowledged"
        && afterAck?.status === "open"
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === "main");

    // EDGE B. The owner typing into a worker's pane is NOT Program-MAIN's answer to that worker's
    // open clarification, so the "main" wait must survive it. Clearing it here would re-open the
    // steward nudge path past an unanswered question — the 409 checked a few lines below.
    // BREAKS IF: /send goes back to the unconditional `s.awaiting = null`.
    await post("/send", { slot: prog.slot, text: "owner speaks while MAIN has not answered", submit: false });
    const waitAfterOwnerSend = ((await (await selfGet(progTok)).json()) as { awaiting?: string | null }).awaiting;
    const clarificationAfterOwnerSend = (await selfClarifications(progTok)).requests
      .find((c) => c.id === progRequest?.id);
    check("owner /send into a worker pane preserves its awaiting:'main' clarification wait",
      waitAfterOwnerSend === "main" && clarificationAfterOwnerSend?.status === "open",
      `${waitAfterOwnerSend} ${clarificationAfterOwnerSend?.status}`);

    const waitingFacts: LaneSignalView = { alive: true, idleMs: 999_999, git: { dirty: 2, ahead: 0 },
      gitOp: false, merge: null, observed: true, awaiting: "main", hostCommits: true };
    check("awaiting:'main' lane is neither host-commit-looking nor stalled",
      !laneHostCommitLooking(waitingFacts, 1) && !laneStalled(waitingFacts, 1));
    const stewardToken = ((await (await get("/api/steward/token")).json()) as { token?: string }).token ?? "";
    const stewardBlocked = await fetch(`${BASE}/api/steward/send`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${stewardToken}` },
      body: JSON.stringify({ slot: prog.slot, kind: "continue_nudge", ref: "continue" }),
    });
    const stewardBlockedText = await stewardBlocked.text();
    check("handleStewardSend gives awaiting:'main' its new 409 while the pinned owner wording remains in source",
      stewardBlocked.status === 409 && stewardBlockedText.includes("waiting on Program-MAIN")
        && serverSource.includes("slot is waiting on the owner (clarify lane) — escalate, never nudge past it"),
      `${stewardBlocked.status} ${stewardBlockedText}`);

    const foreignReply = watchRequest ? await replyClarification(main2Tok, watchRequest.id, "foreign answer")
      : new Response(null, { status: 599 });
    check("clarification reply binding: foreign MAIN is 409 and leaves the request open",
      foreignReply.status === 409
        && (await selfClarifications(watchedTok)).requests.find((c) => c.id === watchRequest?.id)?.status === "open");

    const reply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Keep the implementation inside the named files.")
      : new Response(null, { status: 599 });
    const replyBody = await reply.json() as { request?: ClarificationRow; existing?: boolean };
    // POLLED, not sampled once: the route answers when it has SENT, and the keystrokes still have
    // to reach the pane and be rendered before capture-pane can see them. A single capture read
    // that race as "the answer was never delivered" (measured red 2026-08-30 on the Linux
    // second-host, where every other conjunct of this row held).
    const answerMark = `CLARIFICATION ANSWER [request ${progRequest?.id}]`;
    let workerPane = { out: "", code: -1 };
    for (let i = 0; i < 60; i++) {
      workerPane = await tmuxOut("capture-pane", "-t", `s${prog.slot}`, "-p", "-J");
      if (workerPane.out.includes(answerMark)) break;
      await Bun.sleep(100);
    }
    check("clarification successful reply sends once before answered and only then clears awaiting",
      reply.ok && replyBody.request?.status === "answered" && replyBody.request.answer?.text.includes("named files") === true
        && workerPane.out.includes(answerMark)
        && ((await (await selfGet(progTok)).json()) as { awaiting?: string }).awaiting === null,
      `${reply.status} ${JSON.stringify(replyBody)}`);
    const sameReply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Keep the implementation inside the named files.")
      : new Response(null, { status: 599 });
    const sameReplyBody = await sameReply.json() as { existing?: boolean };
    const differentReply = progRequest ? await replyClarification(main1Tok, progRequest.id, "Different answer")
      : new Response(null, { status: 599 });
    check("clarification duplicate reply is idempotent only for identical text; different text is 409 unchanged",
      sameReply.ok && sameReplyBody.existing === true && differentReply.status === 409
        && (await selfClarifications(progTok)).requests.find((c) => c.id === progRequest?.id)?.answer?.text
          === "Keep the implementation inside the named files.");

    // A pane death without occupant replacement must not become success. On the isolated default
    // adapter the process probe is intentionally waived; sendText itself therefore supplies the
    // deterministic paste failure, and the failure is now a PERSISTED transport state rather than a
    // request that silently stayed open. Read from the state file, never from /api/sessions: that
    // payload carries no `awaiting`, and casting it onto the poll response is the exact mistake two
    // earlier probes died of (8e2b3e5).
    // BREAKS IF: replyClarification assigns send-uncertain after sendText (nothing persisted on a
    // crash), or drops the pre-send saveStateNow, or clears the worker's wait before an answer.
    await tmuxOut("kill-session", "-t", `s${watched.slot}`);
    const deadReply = watchRequest ? await replyClarification(main1Tok, watchRequest.id, "answer to dead pane")
      : new Response(null, { status: 599 });
    const deadReplyText = await deadReply.text();
    const readClarification = (id: string | undefined) =>
      (JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { clarifications?: ClarificationRow[] })
        .clarifications?.find((c) => c.id === id);
    const readAwaiting = (slot: number): string | null =>
      (JSON.parse(readFileSync(clarificationStatePath, "utf8")) as
        { slots?: Record<string, { awaiting?: string | null }> }).slots?.[String(slot)]?.awaiting ?? null;
    const uncertainRow = readClarification(watchRequest?.id);
    check("clarification unresolved send persists send-uncertain with the pending answer and keeps awaiting main",
      deadReply.status === 409 && /worker reply send failed and stays send-uncertain/.test(deadReplyText)
        && uncertainRow?.status === "send-uncertain" && uncertainRow.answer?.text === "answer to dead pane"
        && uncertainRow.closedAt === null && uncertainRow.refusedReason === null
        && readAwaiting(watched.slot) === "main"
        && (await selfClarifications(watchedTok)).requests.find((c) => c.id === watchRequest?.id)?.status === "send-uncertain",
      `${deadReply.status} ${deadReplyText} ${JSON.stringify(uncertainRow)} awaiting=${readAwaiting(watched.slot)}`);

    // The retry contract has two halves and both are load-bearing: identical text may be
    // re-attempted, different text may not — the pending text may already sit in the pane, so a
    // second, different answer would be half of a contradiction nobody could observe.
    // BREAKS IF: the send-uncertain branch stops comparing the pending text, or a different-text
    // retry is allowed to overwrite `answer` before its 409.
    const differentRetry = watchRequest
      ? await replyClarification(main1Tok, watchRequest.id, "a different answer entirely")
      : new Response(null, { status: 599 });
    const differentRetryText = await differentRetry.text();
    const afterDifferent = readClarification(watchRequest?.id);
    check("clarification send-uncertain retry with different text is 409 and never replaces the pending answer",
      differentRetry.status === 409 && differentRetryText.includes("different pending text")
        && afterDifferent?.status === "send-uncertain" && afterDifferent.answer?.text === "answer to dead pane",
      `${differentRetry.status} ${differentRetryText}`);

    // The identical retry is principal-driven and re-runs the real gates: once the self-heal has
    // put the pane back (same occupant — the stand-in harness pins no session id, so openedAt and
    // sessionId are untouched), the send is attempted again and only its success answers.
    // BREAKS IF: a send-uncertain request is treated as terminal/closed, or the retry short-circuits
    // to answered without re-running sendText (the pane text below would then be missing).
    let healed = 1;
    for (let i = 0; i < 60 && healed !== 0; i++) {
      await Bun.sleep(250);
      healed = (await tmuxOut("has-session", "-t", `s${watched.slot}`)).code;
    }
    const sameRetry = watchRequest ? await replyClarification(main1Tok, watchRequest.id, "answer to dead pane")
      : new Response(null, { status: 599 });
    const sameRetryBody = await sameRetry.json() as { request?: ClarificationRow };
    // POLLED and joined, for the reason the successful-reply row above names: the route answers
    // when it has SENT, and the freshly healed shell still has to render the paste. Red twice on
    // the Linux second-host (audits 1789375381366, 1789377403640) with every conjunct the old detail
    // printed holding — so the detail now names each conjunct on its own.
    const healedMark = `CLARIFICATION ANSWER [request ${watchRequest?.id}]`;
    let healedPane = "";
    for (let i = 0; i < 50; i++) {
      healedPane = (await tmuxOut("capture-pane", "-t", `s${watched.slot}`, "-p", "-J")).out;
      if (healedPane.includes(healedMark)) break;
      await Bun.sleep(100);
    }
    const retryRow = readClarification(watchRequest?.id);
    const retryAwaiting = readAwaiting(watched.slot);
    const retryOk = {
      healed: healed === 0,
      http: sameRetry.ok,
      bodyAnswered: sameRetryBody.request?.status === "answered",
      bodyClosed: sameRetryBody.request?.closedAt !== null,
      paneMark: healedPane.includes(healedMark),
      fileAnswered: retryRow?.status === "answered",
      awaitingCleared: retryAwaiting === null,
    };
    check("clarification identical retry re-attempts the send and only a successful one answers and clears the wait",
      Object.values(retryOk).every(Boolean),
      `${JSON.stringify(retryOk)} healed=${healed} ${sameRetry.status} fileStatus=${retryRow?.status} `
        + `awaiting=${retryAwaiting} paneTail=${JSON.stringify(healedPane.trimEnd().slice(-400))} ${JSON.stringify(sameRetryBody.request)}`);
    const replySource = serverSource.slice(serverSource.indexOf("async function replyClarification("),
      serverSource.indexOf("async function acknowledgeFleetEvent("));
    check("clarification send-error branch returns 409 while answered assignment remains after sendText",
      replySource.includes("worker reply send failed")
        && replySource.indexOf('request.status = "answered";') > replySource.indexOf("await sendText(worker, text, true);"));

    // Worker replacement is terminal and must never address its numeric successor.
    const agreeSlot = agreed.slot;
    await post(`/api/slots/${agreeSlot}/kill`, {});
    const refusedAgree = (await selfClarifications(main1Tok)).requests.find((c) => c.id === agreeRequest?.id);
    const reopenAgree = await post(`/api/slots/${agreeSlot}/open`, { cwd: REPO, label: "clarification-successor" });
    const successorPaneBefore = (await tmuxOut("capture-pane", "-t", `s${agreeSlot}`, "-p")).out;
    const successorReply = agreeRequest ? await replyClarification(main1Tok, agreeRequest.id, "must not reach successor")
      : new Response(null, { status: 599 });
    const successorPaneAfter = (await tmuxOut("capture-pane", "-t", `s${agreeSlot}`, "-p")).out;
    check("clarification replaced worker is visibly refused and no reply reaches successor occupant",
      refusedAgree?.status === "refused" && refusedAgree.refusedReason?.includes("worker occupant") === true
        && reopenAgree.ok && successorReply.status === 409 && successorPaneAfter === successorPaneBefore
        && !successorPaneAfter.includes("must not reach successor"), JSON.stringify(refusedAgree));

    const replacedOpen = await selfClarify(laneTokens.get(replacedMainWorker.slot) ?? "", { question: "Receiver replacement" });
    const replacedRequest = (await replacedOpen.json() as { request?: ClarificationRow }).request;
    await post(`/api/slots/${main2}/kill`, {});
    const reopenMain2 = await post(`/api/slots/${main2}/open`, { cwd: REPO, label: "replacement-main" });
    const replacementMainTok = await paneEnv(`s${main2}`, "FLEET_SELF_TOKEN") ?? "";
    const replacedMainReply = replacedRequest
      ? await replyClarification(replacementMainTok, replacedRequest.id, "replacement must not answer")
      : new Response(null, { status: 599 });
    const refusedReceiver = (await selfClarifications(laneTokens.get(replacedMainWorker.slot) ?? ""))
      .requests.find((c) => c.id === replacedRequest?.id);
    check("clarification replaced MAIN is refused, replacement is binding-rejected, and no mutation reopens it",
      replacedOpen.ok && reopenMain2.ok && replacementMainTok !== main2Tok && replacedMainReply.status === 409
        && refusedReceiver?.status === "refused" && refusedReceiver.refusedReason?.includes("receiver occupant") === true,
      JSON.stringify(refusedReceiver));

    const execution = await fetch(`${BASE}/api/self/program-execution`, {
      headers: { "x-fleet-self-token": main1Tok },
    });
    const executionBody = await execution.json() as { programs?: { program: { id: string }; operations: {
      events: { rows: { id: string; kind: string; watchId: string | null }[]; openDebts: number } } }[] };
    const executionProgram = executionBody.programs?.find((p) => p.program.id === programId);
    check("ProgramExecutionView exposes clarification through existing event rows/watchId:null and openDebts facts",
      execution.ok && executionProgram?.operations.events.rows.some((e) => e.id === progRequest?.eventId
        && e.kind === "clarification-request" && e.watchId === null) === true
        && typeof executionProgram.operations.events.openDebts === "number",
      JSON.stringify(executionProgram?.operations.events));

    check("clarification regression: existing Watch kinds/Acks/retention stay present and clarification adds no Watch row",
      ["lane-ready", "host-commit-ready", "merge-terminal", "post-land-audit", "deploy-terminal"]
        .every((kind) => serverSource.includes(kind))
        && !((JSON.parse(readFileSync(clarificationStatePath, "utf8")) as { watches?: { id?: string }[] }).watches ?? [])
          .some((w) => w.id === progRequest?.id));

    // EDGE C. Scope follows ROLE, not worktree-ness: a receiver that happens to run in a worktree
    // (the ⚙ steward is exactly that shape) used to fall into the worker branch of clarificationsFor
    // and therefore saw nothing it was the receiver OF. Both bindings are exact and server-derived.
    // BREAKS IF: clarificationsFor reintroduces an `s.worktree` branch — this receiver HAS a
    // worktree, so the old predicate returned its own (empty) worker rows instead of the row below.
    // The nine fixture lanes above have finished their checks; free them FIRST so this pair is not
    // competing for the last of MAX_SLOTS (a /api/lanes that finds no free slot returns no `slot`,
    // and the probe would then fail as itself rather than as the scope predicate it measures).
    for (const lane of [prog, watched, conflicted, multi, none, legacy, replacedMainWorker])
      await post(`/api/slots/${lane.slot}/kill`, {});
    const receiverLane = await makeLane();
    const receiverWorker = await makeLane();
    const receiverLaneTok = await paneEnv(`s${receiverLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const receiverWorkerTok = await paneEnv(`s${receiverWorker.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const worktreeSub = await subscribe(receiverLane.slot, receiverWorker);
    const worktreeOpen = await selfClarify(receiverWorkerTok, { question: "Who answers a receiver that lives in a worktree?" });
    const worktreeRequest = (await worktreeOpen.json() as { request?: ClarificationRow }).request;
    const worktreeScope = await selfClarifications(receiverLaneTok);
    // The fixture gets its own check: a pair that could not be built must fail AS a fixture, never
    // as the scope predicate below (a probe that never ran must not read as the thing it measured).
    check("clarification worktree-receiver fixture: two fresh lanes, distinct tokens and a fresh Watch exist",
      !!receiverLane.slot && !!receiverWorker.slot && /^[0-9a-f]{32}$/.test(receiverLaneTok)
        && /^[0-9a-f]{32}$/.test(receiverWorkerTok) && receiverLaneTok !== receiverWorkerTok
        && worktreeSub.response.ok && (worktreeSub.body.watch?.slotOpenedAt ?? 0) > 0,
      JSON.stringify({ receiver: receiverLane.slot, worker: receiverWorker.slot,
        sub: worktreeSub.response.status, watch: worktreeSub.body.watch }));
    check("clarification GET scope follows role: a receiver WITH a worktree sees the rows it receives",
      worktreeOpen.ok && worktreeRequest?.receiver.slot === receiverLane.slot
        && worktreeScope.requests.length === 1 && worktreeScope.requests[0]?.id === worktreeRequest.id
        && (await selfClarifications(receiverWorkerTok)).requests.some((c) => c.id === worktreeRequest.id),
      JSON.stringify({ open: worktreeOpen.status, receiver: worktreeRequest?.receiver,
        seen: worktreeScope.requests.map((c) => c.id) }));

    for (const lane of [receiverLane, receiverWorker])
      await post(`/api/slots/${lane.slot}/kill`, {});
    await post(`/api/slots/${agreeSlot}/kill`, {});
    await post(`/api/slots/${main1}/kill`, {});
    await post(`/api/slots/${main2}/kill`, {});
    // These rows have already proved load, retention, delivery, Ack and terminal semantics. Remove
    // only this section's synthetic population while the server is stopped, so the later global
    // /api/sessions payload-budget check measures the product's bounded steady state rather than
    // test pollution from nine throwaway occupants.
    await stopSrv();
    const cleaned = JSON.parse(readFileSync(clarificationStatePath, "utf8")) as {
      events?: { kind?: string }[]; clarifications?: unknown[]; programs?: { id?: string }[];
    };
    cleaned.events = (cleaned.events ?? []).filter((e) => e.kind !== "clarification-request");
    cleaned.clarifications = [];
    cleaned.programs = (cleaned.programs ?? []).filter((p) => p.id !== programId);
    writeFileSync(clarificationStatePath, JSON.stringify(cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL B-D ========================================================================
  // The report is an immutable sibling on the Clarification FleetEvent transport. Program binding
  // is planted as the one server fact used by clarificationReceiverFor; no report body below can
  // name a receiver, task, program, slot or branch.
  {
    const main = await freeSlot();
    const mainOpen = main ? await post(`/api/slots/${main}/open`, { cwd: REPO,
      label: "report-main", harness: "pi-unfenced" }) : null;
    const foreignMain = await freeSlot();
    const foreignOpen = foreignMain
      ? await post(`/api/slots/${foreignMain}/open`, { cwd: REPO, label: "report-foreign-main" }) : null;
    const makeLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const completeLane = await makeLane();
    const needsLane = await makeLane();
    const failedLane = await makeLane();
    const noReceiverLane = await makeLane();
    const stewardLane = await makeLane();
    check("fleet-report fixtures: two MAIN occupants and five distinct lanes exist",
      !!mainOpen?.ok && !!foreignOpen?.ok
        && new Set([main, foreignMain, completeLane.slot, needsLane.slot, failedLane.slot,
          noReceiverLane.slot, stewardLane.slot]).size === 7,
      JSON.stringify({ main, foreignMain, lanes: [completeLane.slot, needsLane.slot, failedLane.slot,
        noReceiverLane.slot, stewardLane.slot] }));

    const mainTok = await paneEnv(`s${main}`, "FLEET_SELF_TOKEN") ?? "";
    const foreignTok = await paneEnv(`s${foreignMain}`, "FLEET_SELF_TOKEN") ?? "";
    const completeTok = await paneEnv(`s${completeLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const needsTok = await paneEnv(`s${needsLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const failedTok = await paneEnv(`s${failedLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const noReceiverTok = await paneEnv(`s${noReceiverLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const stewardTok = await paneEnv(`s${stewardLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const reportComposerMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
    const setReportComposerMode = (mode: string) => writeFileSync(reportComposerMode, `${mode}\n`);
    check("fleet-report fixtures: every participant has an exact, distinct scoped credential",
      [mainTok, foreignTok, completeTok, needsTok, failedTok, noReceiverTok, stewardTok]
        .every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([mainTok, foreignTok, completeTok, needsTok, failedTok, noReceiverTok, stewardTok]).size === 7
        && reportComposerMode.length > 0 && existsSync(reportComposerMode));

    await stopSrv();
    const reportStatePath = `${ROOT}/fleet.json`;
    const planted = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      fleetReports?: unknown[]; watches?: Record<string, unknown>[];
    };
    const programId = "f".repeat(24);
    const mainRow = planted.slots[String(main)];
    delete planted.fleetReports;
    planted.programs = [...(planted.programs ?? []), {
      id: programId, title: "Result rail fixture", intent: "Receive typed worker results",
      successCriterion: "All three statuses survive transport", nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: main, openedAt: mainRow.openedAt, sessionId: mainRow.sessionId, boundAt: Date.now() - 700 },
    }];
    // Q4-Q6 exercise the legacy FleetEvent transport. Spent lane watches keep exact receiver
    // evidence without reserving budget, so these rows stay intentionally program-less.
    planted.watches = [...(planted.watches ?? []), ...[completeLane, needsLane, failedLane].map((lane, index) => ({
      id: `reporttransport${index}`, slot: main, slotOpenedAt: mainRow.openedAt,
      idleSec: 0, armed: false, created: Date.now(), firedAt: Date.now(),
      lastResult: "transport fixture still names coordinating occupant", kind: "lane",
      target: lane.slot, targetCwd: lane.cwd, targetBranch: lane.branch,
    }))];
    planted.slots[String(completeLane.slot)].taskId = "task-server-report";
    planted.slots[String(completeLane.slot)].originId = "origin-server-report";
    planted.slots[String(stewardLane.slot)].label = "⚙ steward";
    writeFileSync(reportStatePath, JSON.stringify(planted, null, 2), { mode: 0o600 });
    await restartSrv();
    const legacyLoaded = JSON.parse(readFileSync(reportStatePath, "utf8")) as { fleetReports?: unknown[] };
    check("fleet-report legacy state: an absent fleetReports member loads as [] in the shared state document",
      Array.isArray(legacyLoaded.fleetReports) && legacyLoaded.fleetReports.length === 0,
      JSON.stringify(legacyLoaded.fleetReports));
    const reportAuditStart = auditRows().length;
    check("fleet-report audit fixture: the rotation-aware audit ledger is readable before baselining",
      auditReadError === "", auditReadError);

    const nonLane = await selfFleetReport(mainTok, { status: "complete", text: "MAIN cannot report" });
    const nonLaneText = await nonLane.text();
    const steward = await selfFleetReport(stewardTok, { status: "complete", text: "steward cannot report" });
    const stewardText = await steward.text();
    check("Q1 fleet-report lane-only: MAIN and steward receive named 409 refusals",
      nonLane.status === 409 && nonLaneText.includes("not a worker lane")
        && steward.status === 409 && stewardText.includes("steward cannot file"),
      `${nonLane.status} ${nonLaneText} / ${steward.status} ${stewardText}`);

    const noReceiver = await selfFleetReport(noReceiverTok, { status: "needs-main", text: "Who receives this?" });
    const noReceiverText = await noReceiver.text();
    check("Q2 fleet-report receiver: a lane without exact evidence is honestly refused by name",
      noReceiver.status === 409 && noReceiverText.includes("no exact clarification receiver evidence")
        && (await fleetReportEventRows()).length === 0,
      `${noReceiver.status} ${noReceiverText}`);

    const invalids = await Promise.all([
      selfFleetReport(completeTok, {}),
      selfFleetReport(completeTok, { status: "unknown", text: "not closed" }),
      selfFleetReport(completeTok, { status: "complete", text: " " }),
      selfFleetReport(completeTok, { status: "complete", text: "x".repeat(4001) }),
      selfFleetReport(completeTok, { status: "complete", text: "spoof", receiver: { slot: foreignMain } }),
    ]);
    check("fleet-report validation: the exported four-value status is closed and the body is exactly status+text",
      JSON.stringify(FLEET_REPORT_STATUSES) === JSON.stringify(["complete", "needs-main", "failed", "handoff"])
        && invalids.every((r) => r.status === 400) && (await fleetReportEventRows()).length === 0,
      invalids.map((r) => r.status).join("/"));

    const completeRes = await selfFleetReport(completeTok,
      { status: "complete", text: "All requested B-D checks are green." });
    const completeReport = (await completeRes.json() as { report?: FleetReportRow }).report;
    const needsRes = await selfFleetReport(needsTok,
      { status: "needs-main", text: "MAIN must decide the promotion boundary." });
    const needsReport = (await needsRes.json() as { report?: FleetReportRow }).report;
    const failedRes = await selfFleetReport(failedTok,
      { status: "failed", text: "The named verification failed." });
    const failedReport = (await failedRes.json() as { report?: FleetReportRow }).report;
    const completeEvent = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    check("fleet-report rows and FleetEvents derive receiver and provenance only from the lane and binding",
      completeRes.ok && needsRes.ok && failedRes.ok
        && completeReport?.worker.slot === completeLane.slot && completeReport.worker.branch === completeLane.branch
        && completeReport.provenance.taskId === "task-server-report"
        && completeReport.provenance.originId === "origin-server-report"
        && completeReport.provenance.programId === null && completeReport.receiver?.slot === main
        && completeEvent?.watchId === null && completeEvent.receiverSlot === main
        && completeEvent.payload.reportId === completeReport.id,
      JSON.stringify({ completeReport, completeEvent }));
    // ...and WHICH FLEET took it (dual-host Schnitt 2). Stamped on the ROW only: the FleetEvent
    // payload is the transport copy that rides the 2 s poll, and a per-event copy of a constant is
    // the multiplication the payload budget exists to refuse.
    check("fleet-report provenance names the instance the lane ran on, and the event payload does not carry a copy",
      completeReport?.provenance.instance === INSTANCE_NAME
        && needsReport?.provenance.instance === INSTANCE_NAME
        && failedReport?.provenance.instance === INSTANCE_NAME
        && !("instance" in (completeEvent?.payload ?? {})),
      JSON.stringify({ row: completeReport?.provenance, payload: completeEvent?.payload }));
    await Bun.sleep(300);
    const openAudits = auditRows().slice(reportAuditStart).filter((row) => row.event === "fleet_report_open");
    const expectedOpenAudits = [
      { id: completeReport?.id, slot: completeLane.slot },
      { id: needsReport?.id, slot: needsLane.slot },
      { id: failedReport?.id, slot: failedLane.slot },
    ].filter((entry): entry is { id: string; slot: number } => !!entry.id);
    check("fleet-report audit: every accepted open records its id and slot without copying report text",
      openAudits.length === 3 && expectedOpenAudits.every(({ id, slot }) => openAudits.some((row) =>
        row.slot === slot && row.detail?.startsWith(`${id} receiver=${main} status=`)))
        && openAudits.every((row) => !row.detail?.includes("All requested B-D checks are green.")
          && !row.detail?.includes("MAIN must decide the promotion boundary.")
          && !row.detail?.includes("The named verification failed.")),
      JSON.stringify(openAudits));

    const [workerScope, mainScope, foreignScope, mainInbox, foreignInbox] = await Promise.all([
      selfFleetReports(completeTok), selfFleetReports(mainTok), selfFleetReports(foreignTok),
      selfGet(mainTok).then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>),
      selfGet(foreignTok).then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>),
    ]);
    check("Q3 fleet-report scope: the bound MAIN inbox gets all events, the worker gets its row, and a foreign MAIN gets neither",
      workerScope.reports.length === 1 && workerScope.reports[0]?.id === completeReport?.id
        && mainScope.reports.length === 3 && mainScope.reports.every((r) => r.receiver?.slot === main)
        && foreignScope.reports.length === 0
        && (mainInbox.events ?? []).filter((e) => e.kind === "fleet-report").length === 3
        && !(foreignInbox.events ?? []).some((e) => e.kind === "fleet-report"),
      JSON.stringify({ worker: workerScope.reports.map((r) => r.id), main: mainScope.reports.map((r) => r.id),
        foreign: foreignScope.reports, mainEvents: (mainInbox.events ?? []).map((e) => e.id),
        foreignEvents: (foreignInbox.events ?? []).map((e) => e.id) }));

    // Restart from an image where one report delivery is immediately eligible. This proves the row
    // and all three status values survive independently of transport, then drives the eligible event
    // through the measured composer-held/rollback-cleared recovery seam before Ack closes it.
    await stopSrv();
    const restartImage = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      events?: { id?: string; kind?: string; receiverIdleSec?: number }[]; fleetReports?: unknown[];
    };
    for (const event of restartImage.events ?? [])
      if (event.id === completeReport?.eventId) event.receiverIdleSec = 0;
    restartImage.fleetReports?.push({ id: "malformed", status: "complete" });
    // Two more plants for the instance field, one per direction. A row written before the field
    // existed loses the key entirely and must hydrate UNCHANGED — repairing it into this server's
    // own name is precisely the lie a dual-host provenance field must never tell. A row carrying a
    // malformed name is discarded whole, like every other shape this loader refuses.
    const legacyRow = (restartImage.fleetReports as { id?: string;
      provenance?: { instance?: string | null } }[] | undefined)
      ?.find((r) => r.id === needsReport?.id);
    if (legacyRow?.provenance) delete legacyRow.provenance.instance;
    const badInstanceRow = JSON.parse(JSON.stringify(
      (restartImage.fleetReports as { id?: string }[] | undefined)
        ?.find((r) => r.id === failedReport?.id) ?? {})) as
      { id: string; eventId: string; provenance: { instance: string } };
    badInstanceRow.id = "0".repeat(24);
    badInstanceRow.provenance.instance = "not a name!";
    restartImage.fleetReports?.push(badInstanceRow);
    writeFileSync(reportStatePath, JSON.stringify(restartImage, null, 2), { mode: 0o600 });
    const recoveryLatch = `${ROOT}/fleet-report-recovery.latch`;
    rmSync(recoveryLatch, { force: true });
    rmSync(`${recoveryLatch}.reached`, { force: true });
    rmSync(`${recoveryLatch}.release`, { force: true });
    writeFileSync(recoveryLatch, completeReport?.eventId ?? "", { mode: 0o600 });
    setReportComposerMode("hold");
    const recoveryAuditStart = auditRows().length;
    await restartSrv({ FLEET_TEST_FLEET_REPORT_RECOVERY_LATCH: recoveryLatch });
    const afterRestart = (await selfFleetReports(mainTok)).reports;
    check("Q4 fleet-report durability: complete, needs-main and failed remain distinct after server restart",
      afterRestart.find((r) => r.id === completeReport?.id)?.status === "complete"
        && afterRestart.find((r) => r.id === needsReport?.id)?.status === "needs-main"
        && afterRestart.find((r) => r.id === failedReport?.id)?.status === "failed"
        && !(JSON.parse(readFileSync(reportStatePath, "utf8")) as { fleetReports?: { id?: string }[] })
        .fleetReports?.some((r) => r.id === "malformed"),
      JSON.stringify(afterRestart.map((r) => [r.id, r.status])));
    check("Q4 fleet-report instance provenance: a stamped row keeps its name, a pre-field row stays nameless, a malformed name is discarded",
      afterRestart.find((r) => r.id === completeReport?.id)?.provenance.instance === INSTANCE_NAME
        && !("instance" in (afterRestart.find((r) => r.id === needsReport?.id)?.provenance ?? {}))
        && !afterRestart.some((r) => r.id === badInstanceRow.id)
        && !(JSON.parse(readFileSync(reportStatePath, "utf8")) as { fleetReports?: { id?: string }[] })
        .fleetReports?.some((r) => r.id === badInstanceRow.id),
      JSON.stringify(afterRestart.map((r) => [r.id, r.provenance.instance ?? "(absent)"])));

    for (let i = 0; i < 160 && !existsSync(`${recoveryLatch}.reached`); i++) await Bun.sleep(50);
    const recovering = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    const recoveringReports = (await selfFleetReports(mainTok)).reports;
    check("Q5 fleet-report recovery: composer-held rollback leaves the same event/report retryable without Ack or land",
      existsSync(`${recoveryLatch}.reached`)
        && recovering?.status === "send-uncertain" && recovering.attempts === 1
        && recovering.deliveredAt === null && recovering.acknowledgedAt === null
        && recovering.recovery?.state === "retryable"
        && recovering.recovery.nextAction.includes("same live receiver")
        && recoveringReports.length === 3
        && recoveringReports.find((r) => r.id === completeReport?.id)?.eventId === completeReport?.eventId
        && !auditRows().slice(recoveryAuditStart).some((row) => row.event === "self_land_start"),
      JSON.stringify({ event: recovering, reports: recoveringReports.map((r) => [r.id, r.eventId]) }));
    setReportComposerMode("normal");
    writeFileSync(`${recoveryLatch}.release`, "ok\n", { mode: 0o600 });
    let delivered: FleetReportEventRow | undefined;
    for (let i = 0; i < 160 && delivered?.status !== "delivered"; i++) {
      await Bun.sleep(250);
      delivered = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    }
    const reportPrompts = (await plogRead()).filter((p) => p.slot === main
      && p.text.includes(`report ${completeReport?.id}`));
    const beforeAckReports = (await selfFleetReports(mainTok)).reports;
    check("Q5 fleet-report recovery: the same event/report reaches the exact live receiver once, still unacked",
      delivered?.id === completeReport?.eventId && delivered?.status === "delivered"
        && delivered?.attempts === 2 && delivered?.acknowledgedAt === null
        && delivered?.recovery?.state === "terminal"
        && delivered?.recovery?.effect.includes("no auto-ACK") === true
        && reportPrompts.length === 1
        && beforeAckReports.length === 3
        && beforeAckReports.find((r) => r.id === completeReport?.id)?.eventId === delivered?.id
        && !auditRows().slice(recoveryAuditStart).some((row) => row.event === "self_land_start"),
      JSON.stringify({ delivered, prompts: reportPrompts.length,
        reports: beforeAckReports.map((r) => [r.id, r.eventId]) }));
    const ack = delivered ? await ackEvent(mainTok, delivered.id) : new Response(null, { status: 599 });
    const acknowledged = (await fleetReportEventRows()).find((e) => e.id === delivered?.id);
    check("Q3 fleet-report transport and Ack: recovery does not auto-Ack, and existing self Ack alone acknowledges it",
      delivered?.status === "delivered" && delivered.attempts === 2 && reportPrompts.length === 1
        && ack.ok && acknowledged?.status === "acknowledged" && acknowledged.acknowledgedAt !== null,
      JSON.stringify({ delivered, prompts: reportPrompts.length, ack: ack.status, acknowledged }));

    // === Q6 · THE RECOVERY CAP AND THE INBOX IT STARVED. Measured on FleetEvent
    // 8ca8c38e7af3433051ac78e5 (FleetReport ad4b19f375d44e075ee3f5cf, receiver slot 7): every
    // rollback-cleared non-acceptance re-armed `retryable`, the row reached attempts=1549 over ~28 h,
    // and every paste refreshed the receiver's lastOutput — so lane-ready a6462f2b and merge-terminal
    // 6b03f283 for the same pane stayed at attempts 0 the whole time. Two falsifiers, on the live
    // transport and on the transport's OWN row (the `failed` report filed above, still pending):
    // (1) the sixth rollback-cleared non-acceptance under FLEET_REPORT_RECOVERY_MAX_ATTEMPTS=6
    // moves the SAME row to recovery `blocked` and it is never pasted again; (2) while the report is
    // still below the cap, the OTHER pending event for the same receiver clears its idle gate and is
    // delivered on its first accepted attempt. The recovery latch parks each report attempt and the
    // before-paste latch parks the other event after its gate cleared, so the two are separated by
    // server facts, not by timing. The composer stand-in holds report pastes ("hold") and accepts
    // the other event ("normal") only because the fixture flips the mode between the two latches.
    // No rows are planted: pruneFleetEvents keeps five terminal rows per receiver, and a fixture that
    // added its own would push the needs-main row below out at the recycle teardown (measured on the
    // first run of this section).
    {
      const auditLedger = `${ROOT}/post-land-audits.jsonl`;
      const ledgerExisted = existsSync(auditLedger);
      const ledgerBefore = ledgerExisted ? readFileSync(auditLedger, "utf8") : "";
      const beforePasteLatch = `${ROOT}/fleet-report-starvation.before-paste.latch`;
      const clearLatch = (path: string): void => {
        for (const suffix of ["", ".reached", ".release"]) rmSync(`${path}${suffix}`, { force: true });
      };
      const rowId = failedReport?.eventId ?? "";
      const reachedLatch = async (path: string): Promise<boolean> => {
        for (let i = 0; i < 200 && !existsSync(`${path}.reached`); i++) await Bun.sleep(50);
        return existsSync(`${path}.reached`);
      };
      const reportRow = async (id: string): Promise<FleetReportEventRow | undefined> =>
        (await fleetReportEventRows()).find((e) => e.id === id);
      // Detail projection for the trail (deckel: TRAIL_DETAIL_MAX=2000, e2e/trail-emit.ts): the
      // asserted fields only, reason tail-first because "attempt N of M" sits at its end.
      const rowBrief = (row: { status: FleetEventStatus; attempts: number; deliveredAt: number | null;
        recovery?: { state: "retryable" | "blocked" | "terminal"; reason: string } } | undefined): unknown => {
        if (row === undefined) return null;
        const reason = row.recovery?.reason ?? "";
        return { status: row.status, attempts: row.attempts, deliveredAt: row.deliveredAt,
          state: row.recovery?.state ?? null,
          reason: reason.length > 200 ? `…${reason.slice(-199)}` : reason };
      };
      const waitReportRow = async (id: string,
        accepts: (row: FleetReportEventRow) => boolean): Promise<FleetReportEventRow | undefined> => {
        let row: FleetReportEventRow | undefined;
        for (let i = 0; i < 200; i++) {
          row = await reportRow(id);
          if (row && accepts(row)) return row;
          await Bun.sleep(50);
        }
        return row;
      };
      const waitWatchEvent = async (watchId: string,
        accepts: (row: FleetEventRow) => boolean): Promise<FleetEventRow | undefined> => {
        let row: FleetEventRow | undefined;
        for (let i = 0; i < 200; i++) {
          row = (await eventRows()).find((e) => e.watchId === watchId);
          if (row && accepts(row)) return row;
          await Bun.sleep(50);
        }
        return row;
      };
      const executionRow = async (eventId: string): Promise<{ row: unknown; openDebts: number | null }> => {
        const view = await (await fetch(`${BASE}/api/self/program-execution`,
          { headers: { "x-fleet-self-token": mainTok } })).json() as {
            programs?: { operations: { events: { rows: { id: string }[]; openDebts: number } } }[] };
        const ops = view.programs?.[0]?.operations.events;
        return { row: ops?.rows.find((r) => r.id === eventId) ?? null, openDebts: ops?.openDebts ?? null };
      };
      // Restart from the persisted image with the `failed` report's row immediately eligible, the
      // composer holding, the recovery latch on that row and the knob set to `value`.
      const restartWithKnob = async (value: string, extra: Record<string, string> = {}): Promise<void> => {
        await stopSrv();
        const image = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
          events?: { id?: string; receiverIdleSec?: number }[];
        };
        for (const event of image.events ?? []) if (event.id === rowId) event.receiverIdleSec = 0;
        writeFileSync(reportStatePath, JSON.stringify(image, null, 2), { mode: 0o600 });
        clearLatch(recoveryLatch);
        writeFileSync(recoveryLatch, rowId, { mode: 0o600 });
        setReportComposerMode("hold");
        await restartSrv({ FLEET_TEST_FLEET_REPORT_RECOVERY_LATCH: recoveryLatch,
          FLEET_REPORT_RECOVERY_MAX_ATTEMPTS: value, ...extra });
      };

      // The knob's fallback, measured on the live parser: zero, negative and non-numeric values
      // leave the default of 5 in force, read off the reason each attempt records. The first round
      // also drives the FIRST transport attempt (tickWatches, not recovery) through the same
      // recorder; the acknowledged `complete` row rides all three restarts and is never re-counted.
      const knobRounds: { value: string; attempts: number; latchReached?: boolean;
        row?: FleetReportEventRow }[] = [
        { value: "0", attempts: 2 }, { value: "-2", attempts: 3 }, { value: "abc", attempts: 4 },
      ];
      let firstTransport: FleetReportEventRow | undefined;
      let knobLatchOk = true;
      for (const round of knobRounds) {
        await restartWithKnob(round.value);
        round.latchReached = await reachedLatch(recoveryLatch);
        // A missed precondition aborts the dependent probe HERE: no release (the parked attempt
        // stays parked), no further restarts, no downstream verdicts — the named precondition
        // check below is the only red. The success path measures every contract unchanged.
        if (!round.latchReached) { knobLatchOk = false; break; }
        if (round.value === "0") firstTransport = await reportRow(rowId);
        writeFileSync(`${recoveryLatch}.release`, "ok\n", { mode: 0o600 });
        // The counter is monotonic; the observation ends at the FIRST decisive rest: the round's
        // count reached at rest (retryable, prose naming the observed count — never equality,
        // which two attempts inside one poll window lose forever, §11.2q), OR the row leaving
        // the retryable world entirely (blocked/terminal) — a jump to the cap ends the wait now,
        // not at its timeout. Exact count/status/prose stay with the contract check below.
        round.row = await waitReportRow(rowId, (row) => {
          if (row.recovery !== undefined && row.recovery.state !== "retryable") return true;
          return row.attempts >= round.attempts && row.recovery !== undefined
            && row.recovery.reason.includes(`attempt ${row.attempts} of`);
        });
      }
      check("Q6 fixture precondition: the recovery latch is reached on every knob round",
        rowId !== "" && knobRounds.every((round) => round.latchReached === true),
        JSON.stringify({ rowIdPresent: rowId !== "",
          rounds: knobRounds.map((r) => [r.value, r.latchReached ?? null]),
          onMiss: "no release, no further restarts — dependent transport/cap/ack contracts and the cap-6 ladder stay unclaimed" }));
      let starvedDelivered: FleetEventRow | undefined;
      // Everything below CONSUMES the knob precondition: on a miss the probe is aborted
      // above, this whole chain is skipped, and no contract verdict is claimed at all.
      if (knobLatchOk) {
        const completeAfterKnobs = await reportRow(completeReport?.eventId ?? "");
        // One claim per check (§11.2q cut 3): precondition, transport, cap and ack each carry their
        // own name and observed/expected detail, so a red line names the conjunct that fell.
        check("Q6 fleet-report transport: the first send rides the transport path, not recovery, and records attempt 1 of the default cap of 5",
          firstTransport?.status === "send-uncertain" && firstTransport.attempts === 1
            && firstTransport.recovery?.state === "retryable"
            && firstTransport.recovery.reason.startsWith("transport send was not accepted")
            && firstTransport.recovery.reason.includes("attempt 1 of 5"),
          JSON.stringify({ latch0: knobRounds[0]?.latchReached ?? null, first: rowBrief(firstTransport),
            expected: { status: "send-uncertain", attempts: 1, state: "retryable",
              reason: "transport send was not accepted … attempt 1 of 5" } }));
        check("Q6 fleet-report cap: zero, negative and non-numeric FLEET_REPORT_RECOVERY_MAX_ATTEMPTS fall back to the default of 5 on the recovery path, at the exact attempt count",
          knobRounds.every((round) => round.row?.status === "send-uncertain"
            && round.row.attempts === round.attempts && round.row.recovery?.state === "retryable"
            && round.row.recovery.reason.includes(`attempt ${round.attempts} of 5`)),
          JSON.stringify({ rounds: knobRounds.map((r) => ({ value: r.value, latch: r.latchReached ?? null,
            observed: rowBrief(r.row), expected: { status: "send-uncertain", attempts: r.attempts,
              state: "retryable", reason: `attempt ${r.attempts} of 5` } })) }));
        check("Q6 fleet-report ack: an acknowledged row is never re-counted across the knob restarts",
          completeAfterKnobs?.status === "acknowledged" && completeAfterKnobs.attempts === 2,
          JSON.stringify({ observed: rowBrief(completeAfterKnobs),
            expected: { status: "acknowledged", attempts: 2 } }));

        let starvedOfferedOk = false;
        let parked6Ok = false;
        // Cap 6 from here: attempt 5 is the starvation window, attempt 6 the cap.
        clearLatch(beforePasteLatch);
        writeFileSync(beforePasteLatch, "post-land audit [event", { mode: 0o600 });
        const capAuditStart = auditRows().length;
        await restartWithKnob("6", { FLEET_TEST_SEND_BEFORE_PASTE_LATCH: beforePasteLatch });
        const parked5 = await reachedLatch(recoveryLatch);
        const rowAtPark5 = await reportRow(rowId);
        check("Q6 fixture precondition: the recovery latch is reached with the report's fifth attempt parked under cap 6",
          parked5, JSON.stringify({ parked5, observed: rowBrief(rowAtPark5) }));
        if (parked5) {
          check("Q6 fixture: the report row carries four counted attempts while its fifth parks at the recovery latch under cap 6",
            parked5 && rowAtPark5?.attempts === 4,
            JSON.stringify({ parked5, observed: rowBrief(rowAtPark5), expected: { attempts: 4 } }));

          // While attempt 5 is parked, the same receiver gets a second pending event of another kind
          // with a real idle gate. Minted by the audit watch on the tick that resumes, i.e. AFTER the
          // report's paste and rollback in that same tick — the exact ordering that starved the inbox.
          const starvedMainAfter = `5a4e0001${"0".repeat(32)}`;
          const ledgerAt = Date.now();
          appendFileSync(auditLedger, `${JSON.stringify({ at: ledgerAt, startedAt: ledgerAt - 1, ms: 1, repo: REPO,
            main: "main", mainSha: starvedMainAfter, result: "green", cmd: "q6-fixture", exitCode: 0, out: "ALL PASS",
            checks: { ran: 1, failed: 0 }, covers: [{ branch: "fleet/q6-starved", mainAfter: starvedMainAfter, at: ledgerAt - 2 }] })}\n`);
          const starvedWatch = await post(`/api/slots/${main}/watch`,
            { kind: "audit", repo: REPO, mainAfter: starvedMainAfter, idleSec: 1 });
          const starvedWatchId = ((await starvedWatch.json()) as { watch?: { id: string } }).watch?.id ?? "";
          // the receiver's lastOutput is its boot stamp; let the other event's 1 s idle gate be
          // satisfiable on its own terms before the report's paste is allowed to happen
          await Bun.sleep(1200);
          writeFileSync(`${recoveryLatch}.release`, "ok\n", { mode: 0o600 });
          const starvedOffered = await reachedLatch(beforePasteLatch);
          const rowAt5 = await reportRow(rowId);
          const starvedHeld = (await eventRows()).find((e) => e.watchId === starvedWatchId);
          check("Q6 fixture precondition: the before-paste latch holds the report's paste while the other event is offered to the same receiver",
            starvedOffered, JSON.stringify({ offered: starvedOffered, report: rowBrief(rowAt5) }));
          starvedOfferedOk = starvedOffered === true;
          if (starvedOffered) {
            check("Q6 fleet-report starvation: the other pending event for the same receiver clears its idle gate while the held report is still below the cap",
              starvedWatch.ok && starvedOffered
                && rowAt5?.status === "send-uncertain" && rowAt5.attempts === 5
                && rowAt5.recovery?.state === "retryable" && rowAt5.recovery.reason.includes("attempt 5 of 6")
                && starvedHeld?.status === "send-uncertain" && starvedHeld.attempts === 1 && starvedHeld.deliveredAt === null,
              JSON.stringify({ watch: starvedWatch.status, offered: starvedOffered,
                report: rowBrief(rowAt5), other: rowBrief(starvedHeld) }));

            // attempt 6 must park again; the other event is released into an accepting composer
            rmSync(`${recoveryLatch}.reached`, { force: true });
            rmSync(`${recoveryLatch}.release`, { force: true });
            setReportComposerMode("normal");
            writeFileSync(`${beforePasteLatch}.release`, "ok\n", { mode: 0o600 });
            starvedDelivered = await waitWatchEvent(starvedWatchId, (row) => row.status === "delivered");
            const parked6 = await reachedLatch(recoveryLatch);
            const rowBefore6 = await reportRow(rowId);
            check("Q6 fixture precondition: the recovery latch is reached again for the report's sixth attempt after the other event is released",
              parked6, JSON.stringify({ parked6, observed: rowBrief(rowBefore6) }));
            parked6Ok = parked6 === true;
            if (parked6) {
              check("Q6 fleet-report starvation: the other event is delivered on its first accepted attempt while the report row still waits below the cap",
                starvedDelivered?.status === "delivered" && starvedDelivered.attempts === 1
                  && starvedDelivered.deliveredAt !== null && parked6
                  && rowBefore6?.attempts === 5 && rowBefore6.recovery?.state === "retryable",
                JSON.stringify({ other: rowBrief(starvedDelivered), parked6, report: rowBrief(rowBefore6) }));

              setReportComposerMode("hold");
              writeFileSync(`${recoveryLatch}.release`, "ok\n", { mode: 0o600 });
              const blocked = await waitReportRow(rowId, (row) => row.recovery?.state === "blocked");
              rmSync(`${recoveryLatch}.reached`, { force: true });
              await Bun.sleep(AUTOS_TICK_MS * 6);
              const blockedStill = await reportRow(rowId);
              const pastedAgain = existsSync(`${recoveryLatch}.reached`);
              const cappedPrompts = (await plogRead()).filter((p) => p.slot === main
                && p.text.includes(`report ${failedReport?.id}`)).length;
              check("Q6 fleet-report cap: the sixth rollback-cleared non-acceptance blocks the same row at FLEET_REPORT_RECOVERY_MAX_ATTEMPTS and it is never pasted again",
                blocked?.id === rowId && blocked?.status === "send-uncertain" && blocked.attempts === 6
                  && blocked.recovery?.state === "blocked"
                  && blocked.recovery.reason.includes("attempt 6 reached the cap of 6")
                  && blocked.recovery.nextAction === "manual receiver acknowledgement if the pane text was read, or MAIN/owner intervention"
                  && blocked.recovery.effect.includes("never pasted again")
                  && blocked.deliveredAt === null && blocked.acknowledgedAt === null
                  && !pastedAgain && blockedStill?.attempts === 6 && blockedStill.recovery?.state === "blocked"
                  && cappedPrompts === 0
                  && !auditRows().slice(capAuditStart).some((row) => row.event === "self_land_start"
                    || (row.event === "fleet_event_delivered" && (row.detail ?? "").startsWith(rowId))),
                JSON.stringify({ blocked: rowBrief(blocked), pastedAgain, still: rowBrief(blockedStill),
                  prompts: cappedPrompts }));
              const execution = await executionRow(rowId);
              const executionRecovery = (execution.row as { status?: string; recovery?: { state?: string; nextAction?: string } } | null);
              check("Q6 fleet-report cap: the blocked row is visible on GET /api/self/program-execution operations.events with its recovery and counts as an open debt",
                executionRecovery?.status === "send-uncertain" && executionRecovery.recovery?.state === "blocked"
                  && executionRecovery.recovery.nextAction?.includes("MAIN/owner intervention") === true
                  && (execution.openDebts ?? 0) >= 1,
                JSON.stringify(execution));
              const blockedAck = await ackEvent(mainTok, rowId);
              const blockedAcked = await reportRow(rowId);
              check("Q6 fleet-report cap: the existing self ACK alone closes a blocked row, with its attempt count untouched",
                blockedAck.ok && blockedAcked?.status === "acknowledged" && blockedAcked.attempts === 6
                  && blockedAcked.acknowledgedAt !== null && blockedAcked.deliveredAt === null,
                JSON.stringify({ ack: blockedAck.status, row: rowBrief(blockedAcked) }));
            } // parked6
          } // starvedOffered
        } // parked5
        if (!parked5 || !starvedOfferedOk || !parked6Ok) {
          if (rowId !== "") await ackEvent(mainTok, rowId); // aborted ladder: close the open row; the tail restores composer/latch/ledger
        }
      } else {
        if (rowId !== "") await ackEvent(mainTok, rowId); // aborted probe: close the open row; the tail restores composer/latch/ledger
      }
      if (starvedDelivered) await ackEvent(mainTok, starvedDelivered.id);
      clearLatch(beforePasteLatch);
      // Later modules own the post-land ledger's zero-row fixtures (same restore as ACP-26 above).
      if (ledgerExisted) writeFileSync(auditLedger, ledgerBefore);
      else rmSync(auditLedger, { force: true });
      setReportComposerMode("normal");
      clearLatch(recoveryLatch);
    }

    await stopSrv();
    const recycleImage = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      events?: { id?: string; kind?: string; receiverIdleSec?: number }[];
    };
    for (const event of recycleImage.events ?? [])
      if (event.id === needsReport?.eventId) event.receiverIdleSec = 0;
    writeFileSync(reportStatePath, JSON.stringify(recycleImage, null, 2), { mode: 0o600 });
    rmSync(recoveryLatch, { force: true });
    rmSync(`${recoveryLatch}.reached`, { force: true });
    rmSync(`${recoveryLatch}.release`, { force: true });
    writeFileSync(recoveryLatch, needsReport?.eventId ?? "", { mode: 0o600 });
    setReportComposerMode("hold");
    await restartSrv({ FLEET_TEST_FLEET_REPORT_RECOVERY_LATCH: recoveryLatch });
    for (let i = 0; i < 160 && !existsSync(`${recoveryLatch}.reached`); i++) await Bun.sleep(50);
    const recycleHeld = (await fleetReportEventRows()).find((e) => e.id === needsReport?.eventId);
    const oldReceiverOpenedAt = recycleHeld?.receiverOpenedAt;
    await post(`/api/slots/${main}/kill`, {});
    setReportComposerMode("normal");
    const successorOpen = await post(`/api/slots/${main}/open`, { cwd: REPO,
      label: "report-main-successor", harness: "pi-unfenced" });
    let successorOpenedAt = 0;
    let successorAgent: string | null = null;
    for (let i = 0; i < 80 && successorAgent !== "alive"; i++) {
      const row = ((await (await get("/api/sessions")).json()) as
        { slots: { id: number; openedAt: number; agent: string | null }[] }).slots.find((s) => s.id === main);
      successorOpenedAt = row?.openedAt ?? 0;
      successorAgent = row?.agent ?? null;
      if (successorAgent !== "alive") await Bun.sleep(50);
    }
    const successorPromptsBefore = (await plogRead()).filter((p) => p.slot === main).length;
    writeFileSync(`${recoveryLatch}.release`, "ok\n", { mode: 0o600 });
    let recycledTerminal: FleetReportEventRow | undefined;
    for (let i = 0; i < 120 && recycledTerminal?.status !== "receiver-gone"; i++) {
      await Bun.sleep(100);
      recycledTerminal = (await fleetReportEventRows()).find((e) => e.id === needsReport?.eventId);
    }
    const successorPromptsAfter = (await plogRead()).filter((p) => p.slot === main);
    const reportsAfterRecycle = (await selfFleetReports(needsTok)).reports;
    const acknowledgedStill = (await fleetReportEventRows()).find((e) => e.id === completeReport?.eventId);
    check("Q5 fleet-report recovery: recycled numeric receiver gets nothing and the same event ends receiver-gone",
      existsSync(`${recoveryLatch}.reached`)
        && recycleHeld?.status === "send-uncertain" && recycleHeld.recovery?.state === "retryable"
        && successorOpen.ok && successorAgent === "alive" && successorOpenedAt !== oldReceiverOpenedAt
        && recycledTerminal?.id === needsReport?.eventId && recycledTerminal?.status === "receiver-gone"
        && recycledTerminal?.acknowledgedAt === null && recycledTerminal?.deliveredAt === null
        && recycledTerminal?.recovery?.state === "terminal"
        && recycledTerminal?.recovery?.effect.includes("no replacement occupant received it") === true
        && successorPromptsAfter.length === successorPromptsBefore
        && reportsAfterRecycle.length === 1 && reportsAfterRecycle[0]?.id === needsReport?.id
        && reportsAfterRecycle[0]?.eventId === needsReport?.eventId,
      JSON.stringify({ held: recycleHeld, terminal: recycledTerminal, successorOpen: successorOpen.status,
        successorAgent, identityChanged: successorOpenedAt !== oldReceiverOpenedAt,
        promptsBefore: successorPromptsBefore, promptsAfter: successorPromptsAfter.length,
        reports: reportsAfterRecycle.map((r) => [r.id, r.eventId]) }));
    check("Q5 fleet-report recovery: an already-acknowledged recovered event stays terminal and is not retried",
      acknowledgedStill?.status === "acknowledged" && acknowledgedStill.attempts === 2
        && acknowledgedStill.recovery?.state === "terminal"
        && (await plogRead()).filter((p) => p.slot === main && p.text.includes(`report ${completeReport?.id}`)).length === 1,
      JSON.stringify(acknowledgedStill));
    await post(`/api/slots/${main}/kill`, {});
    rmSync(recoveryLatch, { force: true });
    rmSync(`${recoveryLatch}.reached`, { force: true });
    rmSync(`${recoveryLatch}.release`, { force: true });

    // Cross the report retention threshold with valid old rows whose events are already absent.
    // This is deliberately a separate fixture check: if the planted rows cannot hydrate, the
    // audit assertion below must not masquerade as a missing-prune defect.
    await stopSrv();
    const pruneImage = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      fleetReports?: FleetReportRow[]; slots?: Record<string, { taskId?: string }>;
    };
    if (pruneImage.slots?.[String(noReceiverLane.slot)])
      pruneImage.slots[String(noReceiverLane.slot)].taskId = "task-report-prune-owner-inbox";
    // DECIDED, and that is not decoration. Since the owner door exists, an UNDECIDED row whose
    // receiver occupant is gone is held OUT of this tail by construction (pruneFleetReports): it is
    // the one object that door can act on, and dropping it would put the absence back where the
    // finding of 2026-09-07 found it. These clones inherit a receiver that was killed two lines up,
    // so without a verdict every one of them would be held and this pass would have nothing to do —
    // measured exactly that way. The retention under test is the SETTLED tail; the HOLD is D3's.
    const oldReports: FleetReportRow[] = completeReport ? Array.from({ length: 21 }, (_, index) => ({
      ...completeReport,
      id: (0xa000 + index).toString(16).padStart(24, "0"),
      eventId: (0xb000 + index).toString(16).padStart(24, "0"),
      reportedAt: Math.max(1, completeReport.reportedAt - 100_000 + index),
      text: `old terminal report ${index}`,
      decision: { disposition: "accepted" as const, at: Math.max(1, completeReport.reportedAt - 50_000),
        by: "owner" as const, reason: null },
    })) : [];
    pruneImage.fleetReports?.push(...oldReports);
    writeFileSync(reportStatePath, JSON.stringify(pruneImage, null, 2), { mode: 0o600 });
    const pruneAuditStart = auditRows().length;
    await restartSrv();
    const hydratedOld = (await selfFleetReports(completeTok)).reports.filter((r) =>
      oldReports.some((old) => old.id === r.id));
    check("fleet-report prune audit fixture: 21 valid terminal rows hydrate before pruning",
      oldReports.length === 21 && hydratedOld.length === 21,
      `${oldReports.length}/${hydratedOld.length}`);
    const pruneTrigger = await selfFleetReport(noReceiverTok,
      { status: "complete", text: "Trigger the bounded report retention pass." });
    await Bun.sleep(300);
    const pruneAudits = auditRows().slice(pruneAuditStart).filter((row) => row.event === "fleet_report_prune");
    const afterPruneIds = (await selfFleetReports(completeTok)).reports.map((r) => r.id);
    // PROPERTIES, not a fixed count: how many rows this pass may drop depends on how many OTHER
    // settled rows the section left behind, and a hard 3 would break every time an unrelated check
    // above files or judges one more report. What must hold is what the audit word exists for —
    // 21 planted rows against a ceiling of 20 means at least one MUST go, every id that went is on
    // the trail AND out of state, and the drop set is a PREFIX of the planted order (oldest first),
    // never an arbitrary subset.
    const droppedClones = oldReports.filter((old) => !afterPruneIds.includes(old.id));
    check("fleet-report audit: retention records every removed report id and keeps those ids out of state",
      pruneTrigger.ok && oldReports.length === 21 && droppedClones.length >= 1
        && droppedClones.every((old) => pruneAudits.some((row) => row.detail === old.id))
        && droppedClones.every((old, i) => old.id === oldReports[i]?.id),
      JSON.stringify({ trigger: pruneTrigger.status,
        dropped: droppedClones.map((r) => r.id), audits: pruneAudits.map((r) => r.detail) }));

    for (const slot of [completeLane.slot, needsLane.slot, failedLane.slot, noReceiverLane.slot,
      stewardLane.slot, main, foreignMain]) await post(`/api/slots/${slot}/kill`, {});
    await stopSrv();
    const cleaned = JSON.parse(readFileSync(reportStatePath, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    cleaned.events = (cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    cleaned.fleetReports = [];
    cleaned.programs = (cleaned.programs ?? []).filter((p) => p.id !== programId);
    writeFileSync(reportStatePath, JSON.stringify(cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL B4 · THE OWNER-INBOX FALLBACK ==============================================
  // A report is a TERMINAL fact and needs somewhere to LAND; a clarification is a question and
  // needs someone to ANSWER. The two doors shared one receiver rule, so an owner-dispatched task
  // lane with no Program binding and no exact lane watch could not file the report its own
  // founding brief obliges it to file — measured twice live (slot 7 / probe task 3e744cb3, slot 3
  // / task 2b2e380f). This block proves the fallback and, just as importantly, its four edges:
  // the report lands in the OWNER's operations inbox and nowhere else, the same lane's
  // clarification still gets the identical 409, contradictory evidence is still refused, and the
  // row survives the death of the worker that filed it.
  {
    const inboxMain = await freeSlot();
    const inboxMainOpen = inboxMain ? await post(`/api/slots/${inboxMain}/open`, { cwd: REPO, label: "inbox-main" }) : null;
    const inboxMain2 = await freeSlot();
    const inboxMain2Open = inboxMain2 ? await post(`/api/slots/${inboxMain2}/open`, { cwd: REPO, label: "inbox-main2" }) : null;
    const newLane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const taskLane = await newLane();       // owner-dispatched: taskId, no program, no watch
    const noTaskLane = await newLane();     // nothing dispatched it — the boundary that stays 409
    const twoWatchLane = await newLane();   // a task AND two contradictory watchers
    const legacyLane = await newLane();     // a task AND legacy-only watch evidence
    const capLane = await newLane();        // drives the owner inbox ceiling
    check("B4 fixtures: two MAIN occupants and five distinct lanes exist",
      !!inboxMainOpen?.ok && !!inboxMain2Open?.ok
        && new Set([inboxMain, inboxMain2, taskLane.slot, noTaskLane.slot, twoWatchLane.slot,
          legacyLane.slot, capLane.slot]).size === 7,
      JSON.stringify({ inboxMain, inboxMain2, lanes: [taskLane.slot, noTaskLane.slot,
        twoWatchLane.slot, legacyLane.slot, capLane.slot] }));

    const b4Tok = new Map<number, string>();
    for (const slot of [taskLane.slot, noTaskLane.slot, twoWatchLane.slot, legacyLane.slot, capLane.slot])
      b4Tok.set(slot, await paneEnv(`s${slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("B4 fixtures: every lane has an exact, distinct scoped credential",
      [...b4Tok.values()].every((t) => /^[0-9a-f]{32}$/.test(t)) && new Set(b4Tok.values()).size === 5,
      `${b4Tok.size} credentials`);

    const w1 = await post(`/api/slots/${inboxMain}/watch`, { target: twoWatchLane.slot, idleSec: 3600 });
    const w2 = await post(`/api/slots/${inboxMain2}/watch`, { target: twoWatchLane.slot, idleSec: 3600 });
    check("B4 fixtures: two distinct receiver occupants watch the same lane", w1.ok && w2.ok,
      `${w1.status}/${w2.status}`);

    await stopSrv();
    const b4Path = `${ROOT}/fleet.json`;
    const b4Planted = JSON.parse(readFileSync(b4Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; watches?: Record<string, unknown>[];
    };
    // A dispatched task stamps taskId/originId on the SLOT (server.ts, the dispatcher). Planting
    // exactly those two fields is the whole difference between "the owner sent this lane out" and
    // "someone opened a lane by hand" — the fallback reads no other signal.
    for (const lane of [taskLane, twoWatchLane, legacyLane, capLane]) {
      b4Planted.slots[String(lane.slot)].taskId = `task-${lane.slot}`;
      b4Planted.slots[String(lane.slot)].originId = `origin-${lane.slot}`;
    }
    b4Planted.watches = [...(b4Planted.watches ?? []), {
      id: "b4legacywatch", slot: inboxMain, idleSec: 0, armed: false,
      created: Date.now(), firedAt: Date.now(), lastResult: "sent", kind: "lane",
      target: legacyLane.slot, targetCwd: legacyLane.cwd, targetBranch: legacyLane.branch,
    }];
    writeFileSync(b4Path, JSON.stringify(b4Planted, null, 2), { mode: 0o600 });
    await restartSrv();

    const b4AuditStart = auditRows().length;
    const plogBefore = (await plogRead()).length;
    const eventsBefore = (await fleetReportEventRows()).length;

    // --- the fallback itself -----------------------------------------------------------------
    const inboxText = "Owner-inbox slice complete; ALL PASS quoted in the commit body.";
    const inboxRes = await selfFleetReport(b4Tok.get(taskLane.slot) ?? "",
      { status: "complete", text: inboxText });
    const inboxReport = (await inboxRes.json() as { report?: FleetReportRow }).report;
    const inboxRows = (await fleetReportEventRows()).filter((e) => e.subjectSlot === taskLane.slot);
    const inboxEvent = inboxRows[0];
    check("B4 owner-inbox: a dispatched task lane with no program and no watch files exactly one inbox row",
      inboxRes.ok && inboxRows.length === 1 && inboxReport?.basis === "owner-inbox"
        && inboxReport.receiver === null
        && inboxReport.provenance.taskId === `task-${taskLane.slot}`
        && inboxReport.provenance.programId === null
        && inboxEvent?.receiverSlot === null && inboxEvent.receiverOpenedAt === null
        && inboxEvent.receiverSessionId === null && inboxEvent.watchId === null
        && inboxEvent.status === "inbox" && inboxEvent.delivery === "inbox"
        && inboxEvent.payload.basis === "owner-inbox" && inboxEvent.payload.text === inboxText,
      JSON.stringify({ status: inboxRes.status, report: inboxReport, event: inboxEvent }));

    // The owner's sight of it is the full trail, GET /api/events, which is where
    // fleetReportEventRows() just read it from (the panel itself loads report bodies from
    // GET /api/fleet-report and counts them off the poll's `reportsAwaitingOwner`). What must
    // also hold is that no SESSION sees it: fleetReportsFor binds worker OR receiver, and an
    // owner row has no receiver at all.
    const inboxScope = await selfFleetReports(b4Tok.get(taskLane.slot) ?? "");
    const strangerScope = await selfFleetReports(b4Tok.get(noTaskLane.slot) ?? "");
    const mainInboxScope = await selfGet(await paneEnv(`s${inboxMain}`, "FLEET_SELF_TOKEN") ?? "")
      .then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>);
    check("B4 owner-inbox scope: the filing lane reads its own row back, and no other session sees it",
      inboxScope.reports.length === 1 && inboxScope.reports[0]?.id === inboxReport?.id
        && strangerScope.reports.length === 0
        && !(mainInboxScope.events ?? []).some((e) => e.id === inboxEvent?.id),
      JSON.stringify({ worker: inboxScope.reports.map((r) => r.id),
        stranger: strangerScope.reports.length, main: (mainInboxScope.events ?? []).map((e) => e.id) }));

    // --- it is filed, never typed ------------------------------------------------------------
    // `inbox` is not a pending state, so FACT 2 never selects the row. That is a property of the
    // state machine and is asserted as one: no transport clock, no attempt, and neither the audit
    // trail nor the prompt journal records a send for this event id.
    await Bun.sleep(Math.max(600, AUTOS_TICK_MS * 3));
    const stillFiled = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    const sendAudits = auditRows().slice(b4AuditStart).filter((row) =>
      row.detail?.includes(inboxEvent?.id ?? "no-event")
      && ["fleet_event_delivered", "fleet_event_send_uncertain", "fleet_event_held",
        "fleet_event_receiver_gone"].includes(row.event ?? ""));
    const plogAfter = await plogRead();
    check("B4 owner-inbox: an inbox row is filed, never typed — no attempt, no clock, no journal entry",
      stillFiled?.status === "inbox" && stillFiled.attempts === 0 && stillFiled.deliveredAt === null
        && stillFiled.acknowledgedAt === null && sendAudits.length === 0
        && plogAfter.length === plogBefore
        && !plogAfter.some((entry) => JSON.stringify(entry).includes(inboxEvent?.id ?? "no-event")),
      JSON.stringify({ status: stillFiled?.status, attempts: stillFiled?.attempts,
        audits: sendAudits.map((r) => r.event), plog: `${plogBefore}->${plogAfter.length}` }));

    const openAudit = auditRows().slice(b4AuditStart).filter((row) => row.event === "fleet_report_open");
    check("B4 audit: the accepted open names the owner inbox as receiver and copies no report text",
      openAudit.length === 1 && openAudit[0]?.slot === taskLane.slot
        && openAudit[0]?.detail === `${inboxReport?.id} receiver=owner-inbox status=complete basis=owner-inbox`,
      JSON.stringify(openAudit));

    // --- the same lane's QUESTION is still refused -------------------------------------------
    // The divergence is the whole abstraction judgment: an inbox cannot answer, so routing a
    // clarification here would replace a visible 409 with an invisible forever-wait.
    const sameLaneQuestion = await selfClarify(b4Tok.get(taskLane.slot) ?? "",
      { question: "Same lane, same absent receiver — who answers?" });
    const sameLaneText = await sameLaneQuestion.text();
    check("B4 divergence: the lane that just filed a report keeps the identical clarification 409",
      sameLaneQuestion.status === 409
        && sameLaneText.includes("no exact clarification receiver evidence")
        && (await clarificationEventRows()).filter((e) => e.subjectSlot === taskLane.slot).length === 0,
      `${sameLaneQuestion.status} ${sameLaneText}`);

    // --- the three refusals that must NOT have been widened ----------------------------------
    const noTask = await selfFleetReport(b4Tok.get(noTaskLane.slot) ?? "",
      { status: "complete", text: "nothing dispatched me" });
    const noTaskText = await noTask.text();
    const twoWatch = await selfFleetReport(b4Tok.get(twoWatchLane.slot) ?? "",
      { status: "complete", text: "two watchers name two occupants" });
    const twoWatchText = await twoWatch.text();
    const legacyOnly = await selfFleetReport(b4Tok.get(legacyLane.slot) ?? "",
      { status: "complete", text: "legacy evidence only" });
    const legacyOnlyText = await legacyOnly.text();
    check("B4 boundary: no task, contradictory watchers and legacy-only evidence all keep their exact 409",
      noTask.status === 409 && noTaskText.includes("no exact clarification receiver evidence")
        && twoWatch.status === 409 && twoWatchText.includes("lane-watch evidence names multiple receiver occupants")
        && legacyOnly.status === 409 && legacyOnlyText.includes("only legacy lane-watch evidence exists without slotOpenedAt")
        && (await fleetReportEventRows()).length === eventsBefore + 1,
      `${noTask.status}:${noTaskText} / ${twoWatch.status}:${twoWatchText} / ${legacyOnly.status}:${legacyOnlyText}`);

    // --- acknowledgement belongs to exactly one principal -------------------------------------
    const selfAck = await ackEvent(b4Tok.get(taskLane.slot) ?? "", inboxEvent?.id ?? "x");
    const selfAckText = await selfAck.text();
    const strangerAck = await ackEvent(b4Tok.get(noTaskLane.slot) ?? "", inboxEvent?.id ?? "x");
    const strangerAckText = await strangerAck.text();
    check("B4 ack split: neither the filing lane nor a stranger can self-ack an inbox row, and both hear why",
      selfAck.status === 409 && selfAckText.includes("acknowledgement belongs to the owner")
        && strangerAck.status === 409 && strangerAckText.includes("acknowledgement belongs to the owner")
        && (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id)?.status === "inbox",
      `${selfAck.status}:${selfAckText} / ${strangerAck.status}:${strangerAckText}`);

    // --- the row outlives the worker that filed it --------------------------------------------
    // THE POINT OF A NULL RECEIVER, stated as a test. Had the row been bound to the worker's own
    // slot, dropWatchesFor -> markFleetEventReceiverGone would turn it terminal the moment the
    // lane is killed or recycled — and the owner's unread result would read as "receiver-gone"
    // while nobody had read anything. BREAKS IF the mint stamps `?? s.id` instead of `?? null`.
    await post(`/api/slots/${taskLane.slot}/kill`, {});
    await Bun.sleep(500);
    const afterKill = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    await restartSrv();
    const afterRestart = (await fleetReportEventRows()).find((e) => e.id === inboxEvent?.id);
    const reportAfterRestart = (JSON.parse(readFileSync(b4Path, "utf8")) as
      { fleetReports?: FleetReportRow[] }).fleetReports?.find((r) => r.id === inboxReport?.id);
    check("B4 survival: killing the worker occupant and restarting leaves the inbox row untouched",
      afterKill?.status === "inbox" && afterKill.receiverSlot === null
        && afterRestart?.status === "inbox" && afterRestart.delivery === "inbox"
        && afterRestart.receiverSlot === null && afterRestart.receiverOpenedAt === null
        && reportAfterRestart?.basis === "owner-inbox" && reportAfterRestart.receiver === null
        && reportAfterRestart.text === inboxText,
      JSON.stringify({ afterKill: afterKill?.status, afterRestart: afterRestart?.status,
        report: reportAfterRestart?.basis }));

    const ownerAck = await post(`/api/events/${inboxEvent?.id}/ack`, {});
    const ownerAckBody = await ownerAck.json() as { ok?: boolean; existing?: boolean;
      event?: { status?: string; acknowledgedAt?: number | null } };
    const ownerReAck = await post(`/api/events/${inboxEvent?.id}/ack`, {});
    const ownerReAckBody = await ownerReAck.json() as { existing?: boolean };
    const ackAudit = auditRows().filter((row) => row.event === "fleet_event_owner_ack"
      && row.detail === inboxEvent?.id);
    check("B4 owner ack: the owner closes the row he was filed to, idempotently, and it is his receipt alone",
      ownerAck.ok && ownerAckBody.event?.status === "acknowledged"
        && (ownerAckBody.event?.acknowledgedAt ?? 0) > 0 && ownerAckBody.existing === false
        && ownerReAck.ok && ownerReAckBody.existing === true
        && ackAudit.length === 1 && ackAudit[0]?.slot === undefined,
      JSON.stringify({ ack: ownerAck.status, body: ownerAckBody, reAck: ownerReAckBody, audit: ackAudit }));

    // --- the ceiling is hard, and refuses loudly ---------------------------------------------
    // The owner inbox has no session death to turn its rows terminal — only his own ack. Without
    // a ceiling this array is the unbounded fleet.json the whole delivery budget exists to stop.
    await stopSrv();
    const capState = JSON.parse(readFileSync(b4Path, "utf8")) as { events?: Record<string, unknown>[] };
    const filler = Array.from({ length: 25 }, (_, i) => ({
      id: `b4cap${String(i).padStart(8, "0")}`, watchId: null,
      receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
      subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
      payload: { reportId: `${"a".repeat(16)}${String(i).padStart(8, "0")}`, status: "complete",
        text: `filler ${i}`, taskId: null, originId: null, programId: null, basis: "owner-inbox" },
      createdAt: Date.now() - 1000 + i, status: "inbox", delivery: "inbox",
      attempts: 0, deliveredAt: null, acknowledgedAt: null,
    }));
    // ADVERSARIAL ROWS, planted in the SAME restart as the legitimate filler so one hydration
    // proves both directions at once: the loader must accept exactly the 25 real owner rows and
    // drop all three of these. A probe that only planted valid rows could not tell "fail-closed"
    // from "accepts anything", and a probe that only planted invalid ones could not tell it from
    // "drops everything".
    const adversarial = [
      // (a) THE OWNER PRINCIPAL BELONGS TO ONE KIND. A Watch completion with a null triple names
      // nobody: undeliverable, un-gone-able, un-ackable by its own subscriber — yet it would
      // count as an owner debt and squat a place at the ceiling forever.
      { id: "b4advforeignkind", watchId: "b4advwatch",
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "lane-ready",
        payload: { ahead: 1, dirty: 0, idleMs: 1000, observed: true, gitOp: false,
          awaiting: null, hostCommits: false },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (b) an owner receiver without inbox transport — a report addressed to a pane that does
      // not exist. FACT 2 would select it the moment it were `pending`.
      { id: "b4advownerpane", watchId: null,
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
        payload: { reportId: `${"b".repeat(16)}00000001`, status: "complete", text: "owner without inbox",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (c) the opposite half: inbox transport bound to a SESSION — a row filed at the owner that
      // a slot recycle could turn `receiver-gone` under him while it was still unread.
      { id: "b4advslotinbox", watchId: null,
        receiverSlot: capLane.slot, receiverOpenedAt: Date.now() - 1000, receiverSessionId: null,
        receiverIdleSec: 0, subjectSlot: capLane.slot, subjectBranch: capLane.branch,
        kind: "fleet-report",
        payload: { reportId: `${"c".repeat(16)}00000001`, status: "complete", text: "inbox at a session",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (d) and (e) mutate the THIRD carrier — the event payload's own `basis`, which is what the
      // board and the Supervisor projection read. Both rows are consistent in `delivery` and in
      // the receiver triple, so only the payload↔receiver equivalence can catch them.
      // (d) filed to NOBODY while claiming a bound Program-MAIN: the owner would read a report
      // addressed to a MAIN that was never told it existed.
      { id: "b4advbasisprogram", watchId: null,
        receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, receiverIdleSec: 0,
        subjectSlot: capLane.slot, subjectBranch: capLane.branch, kind: "fleet-report",
        payload: { reportId: `${"d".repeat(16)}00000001`, status: "complete", text: "null receiver, program basis",
          taskId: null, originId: null, programId: null, basis: "program-main" },
        createdAt: Date.now(), status: "inbox", delivery: "inbox",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (e) the reverse: a pane row at a real session that claims it was filed to the owner.
      { id: "b4advbasisowner", watchId: null,
        receiverSlot: capLane.slot, receiverOpenedAt: Date.now() - 1000, receiverSessionId: null,
        receiverIdleSec: 60, subjectSlot: capLane.slot, subjectBranch: capLane.branch,
        kind: "fleet-report",
        payload: { reportId: `${"e".repeat(16)}00000001`, status: "complete", text: "session receiver, owner basis",
          taskId: null, originId: null, programId: null, basis: "owner-inbox" },
        createdAt: Date.now(), status: "pending",
        attempts: 0, deliveredAt: null, acknowledgedAt: null },
      // (f) malformed recovery metadata is not advisory text: the Operations panel would render it
      // as the current state and next action, so the loader must fail closed instead of guessing.
      { id: "b4advbadrecovery", watchId: null,
        receiverSlot: capLane.slot, receiverOpenedAt: Date.now() - 1000, receiverSessionId: null,
        receiverIdleSec: 60, subjectSlot: capLane.slot, subjectBranch: capLane.branch,
        kind: "fleet-report",
        payload: { reportId: `${"f".repeat(16)}00000001`, status: "complete", text: "bad recovery",
          taskId: null, originId: null, programId: null, basis: "program-main" },
        createdAt: Date.now(), status: "send-uncertain",
        attempts: 1, deliveredAt: null, acknowledgedAt: null,
        recovery: { state: "retryable", reason: "", nextAction: "retry", effect: "unknown", updatedAt: Date.now() } },
    ];
    capState.events = [...(capState.events ?? []), ...filler, ...adversarial];
    writeFileSync(b4Path, JSON.stringify(capState, null, 2), { mode: 0o600 });
    await restartSrv();
    const allAfterHydration = ((await (await get("/api/events")).json()) as
      { events: { id: string }[] }).events;
    const survivedAdversarial = adversarial.filter((row) =>
      allAfterHydration.some((e) => e.id === row.id)).map((row) => row.id);
    const loadedFiller = (await fleetReportEventRows()).filter((e) => e.id.startsWith("b4cap"));
    // STATUS, not merely presence. Hydrating a row and then turning it terminal on the same boot
    // is indistinguishable from "it survived" if the probe only counts ids — and that is exactly
    // how the boot reconciliation loop slipped past this check once: 25 rows loaded, all 25 were
    // flipped to `receiver-gone`, ownerInboxDebts() read 0, and the ceiling silently opened.
    const openFiller = loadedFiller.filter((e) => e.status === "inbox");
    check("B4 reverse-state is fail-closed: foreign kind, pane-owner, session-inbox, payload-basis lies and malformed recovery are refused",
      survivedAdversarial.length === 0 && loadedFiller.length === 25 && openFiller.length === 25,
      `survived=[${survivedAdversarial.join(",")}] legitimateFiller=${loadedFiller.length}`
        + ` stillOpen=${openFiller.length} statuses=${[...new Set(loadedFiller.map((e) => e.status))].join("/")}`);
    const capRefused = await selfFleetReport(b4Tok.get(capLane.slot) ?? "",
      { status: "complete", text: "the inbox is full" });
    const capRefusedText = await capRefused.text();
    check("B4 ceiling: 25 unacknowledged owner rows survive reverse-state and refuse the 26th by name",
      loadedFiller.length === 25 && capRefused.status === 409
        && capRefusedText.includes("owner operations inbox has no FleetEvent delivery budget")
        && (await fleetReportEventRows()).filter((e) => e.subjectSlot === capLane.slot
          && !e.id.startsWith("b4cap")).length === 0,
      `${loadedFiller.length} filler / ${capRefused.status} ${capRefusedText}`);

    // …and the ceiling is a BUDGET, not a wall: one owner ack returns exactly one place.
    const freed = await post(`/api/events/${filler[0]?.id}/ack`, {});
    const capAccepted = await selfFleetReport(b4Tok.get(capLane.slot) ?? "",
      { status: "needs-main", text: "one place came back" });
    check("B4 ceiling: acknowledging one row returns exactly one place to the next report",
      freed.ok && capAccepted.ok
        && (await fleetReportEventRows()).filter((e) => e.subjectSlot === capLane.slot
          && !e.id.startsWith("b4cap")).length === 1,
      `${freed.status}/${capAccepted.status}`);

    for (const slot of [noTaskLane.slot, twoWatchLane.slot, legacyLane.slot, capLane.slot,
      inboxMain, inboxMain2]) await post(`/api/slots/${slot}/kill`, {});
    await stopSrv();
    const b4Cleaned = JSON.parse(readFileSync(b4Path, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[];
    };
    b4Cleaned.events = (b4Cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    b4Cleaned.fleetReports = [];
    writeFileSync(b4Path, JSON.stringify(b4Cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL D1 · THE TYPED REPORT ACCEPTANCE DOOR =====================================
  // The event ACK is a TRANSPORT receipt by contract ("I received bytes"), so nothing persisted
  // whether the receiving MAIN read the diff and TOOK the work. This block proves the judgement
  // door beside it: who may open it, that it is opened exactly once, that it settles the transport
  // through the ack route's own writer without touching an already-terminal row, that it actuates
  // nothing else, and that the verdict survives a restart as the row's own persisted fact.
  {
    const d1Main = await freeSlot();
    const d1MainOpen = d1Main ? await post(`/api/slots/${d1Main}/open`, { cwd: REPO, label: "d1-report-main" }) : null;
    const d1Other = await freeSlot();
    const d1OtherOpen = d1Other ? await post(`/api/slots/${d1Other}/open`, { cwd: REPO, label: "d1-other-main" }) : null;
    const d1Lane = async () => (await (await post("/api/lanes", { repo: REPO })).json()) as
      { slot: number; cwd: string; branch: string };
    const acceptLane = await d1Lane();
    const rejectLane = await d1Lane();
    const terminalLane = await d1Lane();
    const inboxLane = await d1Lane();
    const programlessLane = await d1Lane();
    check("D1 fixtures: two MAIN occupants and five distinct lanes exist",
      !!d1MainOpen?.ok && !!d1OtherOpen?.ok
        && new Set([d1Main, d1Other, acceptLane.slot, rejectLane.slot, terminalLane.slot,
          inboxLane.slot, programlessLane.slot]).size === 7,
      JSON.stringify({ d1Main, d1Other, lanes: [acceptLane.slot, rejectLane.slot, terminalLane.slot,
        inboxLane.slot, programlessLane.slot] }));
    const d1MainTok = await paneEnv(`s${d1Main}`, "FLEET_SELF_TOKEN") ?? "";
    const d1OtherTok = await paneEnv(`s${d1Other}`, "FLEET_SELF_TOKEN") ?? "";
    const acceptTok = await paneEnv(`s${acceptLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const rejectTok = await paneEnv(`s${rejectLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const terminalTok = await paneEnv(`s${terminalLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const inboxTok = await paneEnv(`s${inboxLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const programlessTok = await paneEnv(`s${programlessLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    check("D1 fixtures: every participant carries its own exact scoped credential",
      [d1MainTok, d1OtherTok, acceptTok, rejectTok, terminalTok, inboxTok, programlessTok]
        .every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([d1MainTok, d1OtherTok, acceptTok, rejectTok, terminalTok, inboxTok,
          programlessTok]).size === 7,
      `lengths=${[d1MainTok, d1OtherTok, acceptTok, rejectTok, terminalTok, inboxTok,
        programlessTok].map((t) => t.length).join("/")}`);

    // A REAL queue row, not a string: criterion (d) says the decision never moves Task.status, and
    // a fabricated id could not falsify that. The lane carries it the way a dispatched lane does.
    const d1Task = (await (await post("/api/tasks",
      { text: "D1 acceptance-door fixture row", queue: false, kind: "notiz" })).json()) as { task?: { id: string; status: string } };
    const d1TaskId = d1Task.task?.id ?? "";
    const d1TaskStatusBefore = d1Task.task?.status ?? "";
    const d1Path = `${ROOT}/fleet.json`;
    const d1ProgramId = "e".repeat(24);
    await stopSrv();
    const d1Plant = JSON.parse(readFileSync(d1Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
    };
    const d1MainRow = d1Plant.slots[String(d1Main)];
    d1Plant.programs = [...(d1Plant.programs ?? []), {
      id: d1ProgramId, title: "Acceptance door fixture", intent: "Judge typed worker results",
      successCriterion: "A terminal report is expressly accepted or rejected", nonGoals: [],
      decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: d1Main, openedAt: d1MainRow.openedAt, sessionId: d1MainRow.sessionId, boundAt: Date.now() - 700 },
      lineage: { v: 1, entries: [{ slot: d1Main, openedAt: d1MainRow.openedAt,
        sessionId: d1MainRow.sessionId, boundAt: Date.now() - 700, via: "bootstrap",
        endedAt: null, endedBy: null }], dropped: 0 },
    }];
    for (const lane of [acceptLane, rejectLane, terminalLane])
      d1Plant.slots[String(lane.slot)].programId = d1ProgramId;
    d1Plant.slots[String(acceptLane.slot)].taskId = d1TaskId;
    // the inbox lane is the B4 shape on purpose: a task dispatched it, nothing bound it
    d1Plant.slots[String(inboxLane.slot)].taskId = "task-d1-owner-inbox";
    writeFileSync(d1Path, JSON.stringify(d1Plant, null, 2), { mode: 0o600 });
    await restartSrv();

    const mainLaneWatchOpen = await post(`/api/slots/${d1Main}/watch`,
      { target: acceptLane.slot, idleSec: 3600 });
    const foreignLaneWatchOpen = await post(`/api/slots/${d1Other}/watch`,
      { target: acceptLane.slot, idleSec: 3600 });
    const programlessLaneWatchOpen = await post(`/api/slots/${d1Other}/watch`,
      { target: programlessLane.slot, idleSec: 3600 });
    const mainLaneWatch = (await mainLaneWatchOpen.json() as { watch?: WatchRow }).watch;
    const foreignLaneWatch = (await foreignLaneWatchOpen.json() as { watch?: WatchRow }).watch;
    const programlessLaneWatch = (await programlessLaneWatchOpen.json() as { watch?: WatchRow }).watch;
    check("S3d fixtures: MAIN, foreign occupant and programless receiver arm exact lane watches",
      mainLaneWatchOpen.ok && foreignLaneWatchOpen.ok && programlessLaneWatchOpen.ok
        && mainLaneWatch?.armed === true && foreignLaneWatch?.armed === true
        && programlessLaneWatch?.armed === true,
      JSON.stringify({ mainLaneWatch, foreignLaneWatch, programlessLaneWatch }));

    // Plant only shapes the public watch route cannot create directly: one merge control, two
    // recycled same-slot lane watches, and five old spent rows that make pruneSpentWatches
    // observable when the report spends the sixth.
    await stopSrv();
    const d3dPlant = JSON.parse(readFileSync(d1Path, "utf8")) as { watches?: WatchRow[] };
    const persistedMainWatch = d3dPlant.watches?.find((w) => w.id === mainLaneWatch?.id);
    const persistedProgramlessWatch = d3dPlant.watches?.find((w) => w.id === programlessLaneWatch?.id);
    const d3dMergeWatchId = "d3d00001";
    const d3dStaleWatchId = "d3d00002";
    const d3dOwnerStaleWatchId = "d3d00003";
    const oldSpent = persistedMainWatch ? Array.from({ length: 5 }, (_, index): WatchRow => ({
      ...persistedMainWatch,
      id: (0xd3e00000 + index).toString(16),
      armed: false,
      firedAt: null,
      lastResult: `old spent watch ${index}`,
      created: Number(persistedMainWatch.created ?? Date.now()) - 10_000 + index,
    })) : [];
    const mergeControl: WatchRow | null = persistedMainWatch ? { ...persistedMainWatch,
      id: d3dMergeWatchId, kind: "merge" as const } : null;
    const staleControl: WatchRow | null = persistedMainWatch ? { ...persistedMainWatch,
      id: d3dStaleWatchId, slotOpenedAt: Number(persistedMainWatch.slotOpenedAt) + 1 } : null;
    const ownerStaleControl: WatchRow | null = persistedProgramlessWatch ? { ...persistedProgramlessWatch,
      id: d3dOwnerStaleWatchId, target: inboxLane.slot, targetCwd: inboxLane.cwd,
      targetBranch: inboxLane.branch,
      slotOpenedAt: Number(persistedProgramlessWatch.slotOpenedAt) + 1 } : null;
    const plantedControls: WatchRow[] = [];
    if (mergeControl) plantedControls.push(mergeControl);
    if (staleControl) plantedControls.push(staleControl);
    if (ownerStaleControl) plantedControls.push(ownerStaleControl);
    d3dPlant.watches = [...oldSpent, ...(d3dPlant.watches ?? []),
      ...plantedControls];
    writeFileSync(d1Path, JSON.stringify(d3dPlant, null, 2), { mode: 0o600 });
    await restartSrv();

    const d1BudgetBefore = await programBudget(d1ProgramId);
    const d1EventsBefore = (await fleetReportEventRows()).filter((e) => e.receiverSlot === d1Main).length;
    const d1ArmedBefore = (await watchRows()).filter((w) => w.slot === d1Main && w.armed).length;
    const filed = await Promise.all([
      selfFleetReport(acceptTok, { status: "complete", text: "D1: the slice is done and verified." }),
      selfFleetReport(rejectTok, { status: "needs-main", text: "D1: a decision is owed here." }),
      selfFleetReport(terminalTok, { status: "failed", text: "D1: this one did not work." }),
      selfFleetReport(inboxTok, { status: "complete", text: "D1: filed to the owner inbox." }),
    ]);
    const [acceptReport, rejectReport, terminalReport, inboxReport] = await Promise.all(
      filed.map(async (r) => (await r.json() as { report?: FleetReportRow }).report));
    const d1Inbox = await (await fetch(`${BASE}/api/self/inbox`,
      { headers: { "x-fleet-self-token": d1MainTok } })).json() as
      { unread?: number; entries?: { kind?: string; ref?: string; readBy?: unknown }[] };
    const d1Self = await selfGet(d1MainTok).then((r) => r.json() as Promise<{ events?: FleetReportEventRow[] }>);
    const d1BudgetAfter = await programBudget(d1ProgramId);
    check("Q3 fleet-report scope: the bound MAIN reads all three program rows, its inbox holds three unread pointers, no FleetEvent exists, the worker sees its row, and a foreign MAIN sees neither",
      filed.every((r) => r.ok)
        && [acceptReport, rejectReport, terminalReport].every((r) => r?.receiver === null
          && r?.basis === "program" && r.eventId === null && (r?.decision ?? null) === null)
        && inboxReport?.receiver === null && inboxReport.basis === "owner-inbox"
        && (inboxReport.decision ?? null) === null
        && (await selfFleetReports(d1MainTok)).reports.filter((r) => r.basis === "program").length === 3
        && (await selfFleetReports(d1OtherTok)).reports.length === 0
        && d1Inbox.unread === 3
        && d1Inbox.entries?.filter((e) => e.kind === "fleet-report" && e.readBy === null
          && [acceptReport?.id, rejectReport?.id, terminalReport?.id].includes(e.ref)).length === 3
        && !(d1Self.events ?? []).some((e) => e.kind === "fleet-report")
        && (await selfFleetReports(acceptTok)).reports.some((r) => r.id === acceptReport?.id),
      JSON.stringify({ filed: filed.map((r) => r.status),
        rows: [acceptReport, rejectReport, terminalReport, inboxReport]
          .map((r) => [r?.id, r?.basis, r?.decision ?? null]), inbox: d1Inbox }));
    const otherAfterOwnerReport = await selfGet(d1OtherTok).then((r) => r.json() as Promise<{
      watches?: WatchRow[];
    }>);
    const programlessFiled = await selfFleetReport(programlessTok,
      { status: "complete", text: "S3d: the programless lane reports to its watch receiver." });
    const programlessReport = (await programlessFiled.json() as { report?: FleetReportRow }).report;
    const mainAfterReports = await selfGet(d1MainTok).then((r) => r.json() as Promise<{
      watches?: WatchRow[]; events?: FleetEventRow[];
    }>);
    const otherAfterReports = await selfGet(d1OtherTok).then((r) => r.json() as Promise<{
      watches?: WatchRow[]; events?: FleetEventRow[];
    }>);
    const exactSpent = mainAfterReports.watches?.find((w) => w.id === mainLaneWatch?.id);
    const programlessSpent = otherAfterReports.watches?.find((w) => w.id === programlessLaneWatch?.id);

    // BREAKS IF: the report dedupe is absent, or it stamps firedAt as though the predicate fired.
    check("dedupe: the MAIN's exact lane watch is disarmed with the program report id before any done-looking tick",
      exactSpent?.armed === false && exactSpent.firedAt === null
        && exactSpent.lastResult?.includes(acceptReport?.id ?? "missing-report") === true
        && !(mainAfterReports.events ?? []).some((e) => e.kind === "lane-ready"
          && e.subjectSlot === acceptLane.slot),
      JSON.stringify({ watch: exactSpent, events: mainAfterReports.events }));
    // BREAKS IF: the kind guard, holder comparison, or openedAt comparison is removed.
    check("dedupe control: the MAIN's merge watch, a foreign lane watch and a recycled same-slot watch stay armed",
      mainAfterReports.watches?.find((w) => w.id === d3dMergeWatchId)?.armed === true
        && mainAfterReports.watches?.find((w) => w.id === d3dStaleWatchId)?.armed === true
        && otherAfterReports.watches?.find((w) => w.id === foreignLaneWatch?.id)?.armed === true,
      JSON.stringify({ main: mainAfterReports.watches, other: otherAfterReports.watches }));
    // BREAKS IF: only the Program branch invokes the dedupe helper.
    check("dedupe programless lane: the lane-watch receiver's own watch is disarmed with its report id",
      programlessFiled.ok && programlessReport?.basis === "lane-watch"
        && programlessSpent?.armed === false && programlessSpent.firedAt === null
        && programlessSpent.lastResult?.includes(programlessReport.id) === true,
      JSON.stringify({ response: programlessFiled.status, report: programlessReport, watch: programlessSpent }));
    // BREAKS IF: owner-inbox is assigned a synthetic holder and spends an unattributed same-lane watch.
    check("dedupe control: an owner-inbox report disarms nothing",
      inboxReport?.basis === "owner-inbox"
        && otherAfterOwnerReport.watches?.find((w) => w.id === foreignLaneWatch?.id)?.armed === true
        && otherAfterOwnerReport.watches?.find((w) => w.id === programlessLaneWatch?.id)?.armed === true
        && otherAfterOwnerReport.watches?.find((w) => w.id === d3dOwnerStaleWatchId)?.armed === true,
      JSON.stringify({ report: inboxReport, watches: otherAfterOwnerReport.watches }));
    // BREAKS IF: the dedupe misses the exact watch or omits pruneSpentWatches after spending it.
    check("dedupe budget: one reservation is released, delivery debt is unchanged, and the spent tail stays capped",
      d1BudgetBefore?.deliveryBudget?.armedReservations === 3
        && d1BudgetAfter?.deliveryBudget?.armedReservations === 2
        && d1BudgetAfter.deliveryBudget.deliveryDebts === d1BudgetBefore.deliveryBudget.deliveryDebts
        && mainAfterReports.watches?.filter((w) => !w.armed).length === 5
        && mainAfterReports.watches.some((w) => w.id === mainLaneWatch?.id)
        && (await fleetReportEventRows()).filter((e) => e.receiverSlot === d1Main).length === d1EventsBefore
        && (await watchRows()).filter((w) => w.slot === d1Main && w.armed).length === d1ArmedBefore - 1,
      JSON.stringify({ before: d1BudgetBefore?.deliveryBudget, after: d1BudgetAfter?.deliveryBudget,
        events: [d1EventsBefore, (await fleetReportEventRows()).filter((e) => e.receiverSlot === d1Main).length],
        armed: [d1ArmedBefore, (await watchRows()).filter((w) => w.slot === d1Main && w.armed).length],
        spent: mainAfterReports.watches?.filter((w) => !w.armed).map((w) => w.id) }));

    // Remove only the deliberately recycled watch before the lane becomes done-looking: it proved
    // the writer-side occupant guard above, but belongs to no live receiver and is not part of the
    // no-twin assertion. The valid foreign watch remains and may notify its own receiver.
    await stopSrv();
    const beforeDone = JSON.parse(readFileSync(d1Path, "utf8")) as {
      watches?: WatchRow[]; fleetReports?: FleetReportRow[]; events?: FleetEventRow[];
    };
    beforeDone.watches = (beforeDone.watches ?? []).filter((w) => w.id !== d3dStaleWatchId);
    beforeDone.fleetReports = (beforeDone.fleetReports ?? []).filter((r) => r.id !== programlessReport?.id);
    beforeDone.events = (beforeDone.events ?? []).filter((e) => e.id !== programlessReport?.eventId);
    writeFileSync(d1Path, JSON.stringify(beforeDone, null, 2), { mode: 0o600 });
    await Bun.write(`${acceptLane.cwd}/s3d-program-done.txt`, "program lane became done-looking after its report\n");
    const programAdd = spawnSync("git", ["-C", acceptLane.cwd, "add", "s3d-program-done.txt"]);
    const programCommit = spawnSync("git", ["-C", acceptLane.cwd, "commit", "-qm", "test: s3d program lane done"]);
    await Bun.write(`${programlessLane.cwd}/s3d-programless-done.txt`, "programless lane became done-looking after its report\n");
    const programlessAdd = spawnSync("git", ["-C", programlessLane.cwd, "add", "s3d-programless-done.txt"]);
    const programlessCommit = spawnSync("git", ["-C", programlessLane.cwd, "commit", "-qm", "test: s3d programless lane done"]);
    await restartSrv();
    const d3dStewardToken = (JSON.parse(readFileSync(d1Path, "utf8")) as { stewardToken?: string }).stewardToken ?? "";
    check("S3d done-looking fixture: the isolated steward projection has its own scoped credential",
      /^[0-9a-f]{32}$/.test(d3dStewardToken), `length=${d3dStewardToken.length}`);
    let doneRows: { id: number; doneLooking?: boolean }[] = [];
    for (let i = 0; i < 60; i++) {
      doneRows = ((await (await fetch(`${BASE}/api/steward/sessions`, {
        headers: { authorization: `Bearer ${d3dStewardToken}` },
      })).json()) as
        { slots: { id: number; doneLooking?: boolean }[] }).slots;
      if ([acceptLane.slot, programlessLane.slot]
        .every((slot) => doneRows.find((row) => row.id === slot)?.doneLooking === true)) break;
      await Bun.sleep(250);
    }
    const mainAfterDone = await selfGet(d1MainTok).then((r) => r.json() as Promise<{ events?: FleetEventRow[] }>);
    const otherAfterDone = await selfGet(d1OtherTok).then((r) => r.json() as Promise<{ events?: FleetEventRow[] }>);
    // BREAKS IF: the report leaves its exact lane watch armed, allowing the later predicate to mint
    // the redundant lane-ready twin to the report's own receiver.
    check("dedupe: both reported lanes later become done-looking without a lane-ready twin to their report receiver",
      programAdd.status === 0 && programCommit.status === 0
        && programlessAdd.status === 0 && programlessCommit.status === 0
        && [acceptLane.slot, programlessLane.slot]
          .every((slot) => doneRows.find((row) => row.id === slot)?.doneLooking === true)
        && !(mainAfterDone.events ?? []).some((e) => e.kind === "lane-ready"
          && e.subjectSlot === acceptLane.slot)
        && !(otherAfterDone.events ?? []).some((e) => e.kind === "lane-ready"
          && e.subjectSlot === programlessLane.slot),
      JSON.stringify({ git: [programAdd.status, programCommit.status, programlessAdd.status,
        programlessCommit.status], doneRows: doneRows.filter((row) => [acceptLane.slot,
        programlessLane.slot].includes(row.id)), mainEvents: mainAfterDone.events,
        otherEvents: otherAfterDone.events }));

    // --- who may NOT open the door. Each refusal names its own reason: a lane is refused as a
    // lane (route level, before any row is looked at), a foreign MAIN as a foreign occupant, an
    // owner-inbox row as the owner's, and an unknown id as unknown.
    const laneJudge = await decideReport(acceptTok, acceptReport?.id ?? "", "accept");
    const laneJudgeText = await laneJudge.text();
    check("D1 lane exclusion: a worker lane may not judge a report, and is told which edge that is",
      laneJudge.status === 409
        && laneJudgeText.includes("a lane may not judge a fleet report — a lane files its own result, it does not accept the results its own MAIN is owed"),
      `${laneJudge.status} ${laneJudgeText}`);
    const wrongOccupant = await decideReport(d1OtherTok, acceptReport?.id ?? "", "accept");
    const wrongOccupantText = await wrongOccupant.text();
    check("fleet-report decision on a program row: a foreign MAIN is refused by the Program binding",
      wrongOccupant.status === 409
        && wrongOccupantText.includes("not the current bound MAIN of an active program"),
      `${wrongOccupant.status} ${wrongOccupantText}`);
    // Same numeric slot, different occupation: boundProgramForMain must compare openedAt too.
    await stopSrv();
    const recycledPlant = JSON.parse(readFileSync(d1Path, "utf8")) as
      { programs?: { id?: string; main?: { openedAt?: number } }[] };
    const recycledProgram = recycledPlant.programs?.find((p) => p.id === d1ProgramId);
    if (recycledProgram?.main) recycledProgram.main.openedAt = Number(d1MainRow.openedAt) + 1;
    writeFileSync(d1Path, JSON.stringify(recycledPlant, null, 2), { mode: 0o600 });
    await restartSrv();
    const recycledSameSlot = await decideReport(d1MainTok, acceptReport?.id ?? "", "accept");
    const recycledSameSlotText = await recycledSameSlot.text();
    check("fleet-report decision on a program row: the recycled same numeric MAIN slot is refused by openedAt",
      recycledSameSlot.status === 409
        && recycledSameSlotText.includes("not the current bound MAIN of an active program"),
      `${recycledSameSlot.status} ${recycledSameSlotText}`);
    await stopSrv();
    const restoredBinding = JSON.parse(readFileSync(d1Path, "utf8")) as
      { programs?: { id?: string; main?: { openedAt?: number } }[] };
    const restoredProgram = restoredBinding.programs?.find((p) => p.id === d1ProgramId);
    if (restoredProgram?.main) restoredProgram.main.openedAt = Number(d1MainRow.openedAt);
    writeFileSync(d1Path, JSON.stringify(restoredBinding, null, 2), { mode: 0o600 });
    await restartSrv();
    const inboxJudge = await decideReport(d1MainTok, inboxReport?.id ?? "", "accept");
    const inboxJudgeText = await inboxJudge.text();
    check("D1 owner-inbox: a report filed to the owner principal is refused with its own sentence, never silently accepted",
      inboxJudge.status === 409
        && inboxJudgeText.includes("owner-inbox report — accepting or rejecting it belongs to the owner, who has no session to bind a decision to")
        && !inboxJudgeText.includes("belongs to another")
        && ((await selfFleetReports(inboxTok)).reports.find((r) => r.id === inboxReport?.id)?.decision ?? null) === null,
      `${inboxJudge.status} ${inboxJudgeText}`);
    const unknownJudge = await decideReport(d1MainTok, "0".repeat(24), "accept");
    const unknownJudgeText = await unknownJudge.text();
    check("D1 unknown id: an id that names no row is 404, not a 409 about somebody else's row",
      unknownJudge.status === 404 && unknownJudgeText.includes("unknown fleet report"),
      `${unknownJudge.status} ${unknownJudgeText}`);
    const badBodies = await Promise.all([
      decideReport(d1MainTok, acceptReport?.id ?? "", "accept", { reason: "ok", disposition: "accepted" }),
      decideReport(d1MainTok, acceptReport?.id ?? "", "accept", { verdict: "accepted" }),
      decideReport(d1MainTok, acceptReport?.id ?? "", "accept", { reason: 5 }),
      decideReport(d1MainTok, acceptReport?.id ?? "", "accept", { reason: "x".repeat(501) }),
    ]);
    const badBodyTexts = await Promise.all(badBodies.map((r) => r.text()));
    check("D1 body shape: the body is absent/empty or exactly {reason}, in fleet-report's own discipline",
      badBodies.every((r) => r.status === 400)
        && badBodyTexts[0]?.includes("body must contain only reason") === true
        && badBodyTexts[1]?.includes("body must contain only reason") === true
        && badBodyTexts[2]?.includes("reason must be a string") === true
        && badBodyTexts[3]?.includes("reason must be at most 500 chars") === true
        && ((await selfFleetReports(d1MainTok)).reports.find((r) => r.id === acceptReport?.id)?.decision ?? null) === null,
      JSON.stringify({ statuses: badBodies.map((r) => r.status), texts: badBodyTexts }));

    // --- the door itself, both verdicts, and the absence of an occupant transport beside it.
    const plogBeforeDecision = (await plogRead()).length;
    const eventsBeforeDecision = await fleetReportEventRows();
    const reportsBeforeDecision = (await selfFleetReports(d1MainTok)).reports.length;
    const acceptRes = await decideReport(d1MainTok, acceptReport?.id ?? "", "accept",
      { reason: "Diff read, verify quoted, slice taken." });
    const acceptBody = await acceptRes.json() as { ok?: boolean; report?: FleetReportRow };
    const d1MainRowAfter = (JSON.parse(readFileSync(d1Path, "utf8")) as
      { slots?: Record<string, { openedAt?: number; sessionId?: string | null }> }).slots?.[String(d1Main)];
    check("D1 accept: the verdict, its time, its deciding occupant and its reason land on the report row",
      acceptRes.ok && acceptBody.ok === true
        && acceptBody.report?.decision?.disposition === "accepted"
        && typeof acceptBody.report.decision.at === "number" && acceptBody.report.decision.at > 0
        && decisionOccupant(acceptBody.report.decision)?.slot === d1Main
        && decisionOccupant(acceptBody.report.decision)?.openedAt === d1MainRowAfter?.openedAt
        && decisionOccupant(acceptBody.report.decision)?.sessionId === (d1MainRowAfter?.sessionId ?? null)
        && acceptBody.report.decision.reason === "Diff read, verify quoted, slice taken.",
      JSON.stringify(acceptBody.report?.decision ?? null));
    check("D1 program decision mints and settles no FleetEvent: judgement stays on the report row",
      eventsBeforeDecision.length === (await fleetReportEventRows()).length
        && !eventsBeforeDecision.some((e) => [acceptReport?.id, rejectReport?.id, terminalReport?.id]
          .includes(e.payload.reportId)),
      JSON.stringify({ before: eventsBeforeDecision.length, after: (await fleetReportEventRows()).length }));
    const rejectRes = await decideReport(d1MainTok, rejectReport?.id ?? "", "reject");
    const rejectBody = await rejectRes.json() as { ok?: boolean; report?: FleetReportRow };
    check("D1 reject: the opposite verdict is recorded the same way, and an omitted reason is null rather than empty prose",
      rejectRes.ok && rejectBody.report?.decision?.disposition === "rejected"
        && rejectBody.report.decision.reason === null
        && decisionOccupant(rejectBody.report.decision)?.slot === d1Main,
      JSON.stringify(rejectBody.report?.decision ?? null));

    // The measured succession window is the decisive counterexample: the row belongs to the
    // Program, so a successor may judge it while the predecessor slot is still live in grace.
    const reboundAt = Date.now();
    await stopSrv();
    const d1Rebound = JSON.parse(readFileSync(d1Path, "utf8")) as {
      programs?: { id?: string; main?: Record<string, unknown>;
        lineage?: { entries?: Record<string, unknown>[] } }[];
      slots?: Record<string, Record<string, unknown>>;
    };
    const reboundProgram = d1Rebound.programs?.find((p) => p.id === d1ProgramId);
    const reboundMain = d1Rebound.slots?.[String(d1Other)] ?? {};
    const oldHolding = reboundProgram?.lineage?.entries?.at(-1);
    if (oldHolding) { oldHolding.endedAt = reboundAt; oldHolding.endedBy = "succeed"; }
    if (reboundProgram) {
      reboundProgram.main = { slot: d1Other, openedAt: reboundMain.openedAt,
        sessionId: reboundMain.sessionId, boundAt: reboundAt };
      reboundProgram.lineage?.entries?.push({ slot: d1Other, openedAt: reboundMain.openedAt,
        sessionId: reboundMain.sessionId, boundAt: reboundAt, via: "succeed",
        endedAt: null, endedBy: null });
    }
    writeFileSync(d1Path, JSON.stringify(d1Rebound, null, 2), { mode: 0o600 });
    await restartSrv();
    const terminalRes = await decideReport(d1OtherTok, terminalReport?.id ?? "", "accept");
    const terminalBody = await terminalRes.json() as { ok?: boolean; report?: FleetReportRow };
    const terminalEvent = (await fleetReportEventRows()).find((e) => e.id === terminalReport?.eventId);
    check("fleet-report decision on a program row: the live successor accepts while the predecessor slot still lives, and no event exists",
      terminalRes.ok && terminalBody.report?.decision?.disposition === "accepted"
        && decisionOccupant(terminalBody.report.decision)?.slot === d1Other
        && terminalEvent === undefined,
      JSON.stringify({ predecessorLive: !!d1MainRowAfter, decision: terminalBody.report?.decision,
        event: terminalEvent ?? null }));
    const secondAccept = await decideReport(d1OtherTok, acceptReport?.id ?? "", "accept",
      { reason: "a second, later opinion" });
    const secondAcceptText = await secondAccept.text();
    const secondReject = await decideReport(d1OtherTok, acceptReport?.id ?? "", "reject");
    const secondRejectText = await secondReject.text();
    const afterSecond = (await selfFleetReports(d1OtherTok)).reports.find((r) => r.id === acceptReport?.id);
    check("D1 first decision wins: a second call — same verdict or the opposite — is 409 and the row is unchanged",
      secondAccept.status === 409 && secondAcceptText.includes("fleet report was already accepted")
        && secondReject.status === 409 && secondRejectText.includes("fleet report was already accepted")
        && JSON.stringify(afterSecond?.decision) === JSON.stringify(acceptBody.report?.decision),
      JSON.stringify({ second: secondAccept.status, opposite: secondReject.status,
        standing: afterSecond?.decision ?? null }));

    // --- criterion (d), measured rather than asserted in prose: the door judges and actuates
    // nothing — no Task.status, no lane teardown, no retention pass. The queue row is a REAL one,
    // the lanes are alive, and the report tail is exactly as long as it was: an accepted row is
    // kept the way a terminal row is.
    //
    // THE ONE THING THE DOOR NOW DOES WRITE, and this clause replaced "no text reached any pane"
    // on 2026-09-12: the verdict is CARRIED to the lane that filed the report
    // (server.ts#deliverFleetReportDecision). Until then a rejected lane learned its verdict only
    // if a human or the Controller forwarded it — measured 2026-09-06 on slot 11, reports 097cd80b
    // and b8188322 — and the reject loop could not close without a third party. The old assertion
    // `laneWritesAfter === 0` was the old contract, not a safety property, and it is REPLACED here
    // rather than dropped: a carry is exactly one line per decision, into the reporting lane's own
    // pane, and nothing else moves. Stated per lane and by CONTENT, so "the door started writing
    // other things into panes" and "one lane got two copies" both still fail.
    const d1TaskAfter = ((await (await get("/api/tasks")).json()) as { tasks?: { id: string; status: string }[] })
      .tasks?.find((t) => t.id === d1TaskId);
    const laneStillOpen = ((await (await get("/api/sessions")).json()) as
      { slots: { id: number; cwd: string | null }[] }).slots
      .filter((x) => [acceptLane.slot, rejectLane.slot, terminalLane.slot].includes(x.id) && x.cwd).length;
    const plogAfterDecision = await plogRead();
    const decidedLanes = [acceptLane.slot, rejectLane.slot, terminalLane.slot];
    const laneWrites = plogAfterDecision.slice(plogBeforeDecision)
      .filter((entry) => decidedLanes.includes(entry.slot));
    const carriesPerLane = decidedLanes.map((slot) => laneWrites.filter((e) => e.slot === slot).length);
    check("D1 the decision actuates nothing BUT the carry: Task.status, the lanes and report retention are untouched, and each decided lane gets exactly ONE verdict line",
      d1TaskId !== "" && d1TaskAfter?.status === d1TaskStatusBefore
        && laneStillOpen === 3
        && carriesPerLane.every((n) => n === 1)
        && laneWrites.every((e) => e.text.startsWith("[fleet] YOUR REPORT WAS"))
        && (await selfFleetReports(d1OtherTok)).reports.length === reportsBeforeDecision,
      JSON.stringify({ task: [d1TaskStatusBefore, d1TaskAfter?.status], lanes: laneStillOpen,
        carriesPerLane, texts: laneWrites.map((e) => e.text.slice(0, 40)), reports: reportsBeforeDecision }));

    // --- and it is the ROW's fact, not this process's memory. The malformed plants ride the same
    // restart: a Program row that invents either transport half, and an incomplete decision, must
    // be DISCARDED whole rather than repaired into a different principal or judgement.
    await stopSrv();
    const d1Hydrate = JSON.parse(readFileSync(d1Path, "utf8")) as { fleetReports?: FleetReportRow[] };
    const forgedBase = d1Hydrate.fleetReports?.find((r) => r.id === rejectReport?.id);
    const forged: FleetReportRow[] = forgedBase ? [
      { ...forgedBase, id: "d1".padEnd(24, "0"), eventId: "d2".padEnd(24, "0") } as FleetReportRow,
      { ...forgedBase, id: "d3".padEnd(24, "0"),
        receiver: { slot: d1Other, openedAt: Number(reboundMain.openedAt), sessionId: null } },
      { ...forgedBase, id: "d5".padEnd(24, "0"),
        decision: { at: Date.now(), reason: null,
          by: forgedBase.receiver } as unknown as FleetReportRow["decision"] },
    ] : [];
    d1Hydrate.fleetReports?.push(...forged);
    writeFileSync(d1Path, JSON.stringify(d1Hydrate, null, 2), { mode: 0o600 });
    await restartSrv();
    const hydrated = (await selfFleetReports(d1OtherTok)).reports;
    check("fleet-report durability: program rows reconstruct field-for-field, while a receiver, eventId or incomplete decision discards the row",
      forged.length === 3
        && JSON.stringify(hydrated.find((r) => r.id === acceptReport?.id)?.decision)
          === JSON.stringify(acceptBody.report?.decision)
        && JSON.stringify(hydrated.find((r) => r.id === rejectReport?.id)?.decision)
          === JSON.stringify(rejectBody.report?.decision)
        && !hydrated.some((r) => forged.some((f) => f.id === r.id)),
      JSON.stringify({ accepted: hydrated.find((r) => r.id === acceptReport?.id)?.decision ?? null,
        rejected: hydrated.find((r) => r.id === rejectReport?.id)?.decision ?? null,
        forgedSurvivors: hydrated.filter((r) => forged.some((f) => f.id === r.id)).map((r) => r.id) }));
    // …and the WORKER can read back what was done with its own result: fleetReportsFor binds both
    // endpoints, so the decision is visible through the same route that returned the row.
    const workerView = (await selfFleetReports(acceptTok)).reports.find((r) => r.id === acceptReport?.id);
    check("D1 visibility: the deciding MAIN and the reporting worker both read the verdict off GET /api/self/fleet-report",
      workerView?.decision?.disposition === "accepted"
        && decisionOccupant(workerView.decision)?.slot === d1Main
        && hydrated.find((r) => r.id === acceptReport?.id)?.decision?.disposition === "accepted",
      JSON.stringify(workerView?.decision ?? null));

    // BREAKS IF: pruneFleetReports treats an eventless Program row as terminal before it has a
    // decision. Twenty-one decided clones cross the cap; the older undecided counterexample must
    // survive while decided rows are eligible for the bounded tail.
    await stopSrv();
    const d1Retention = JSON.parse(readFileSync(d1Path, "utf8")) as { fleetReports?: FleetReportRow[] };
    const retentionBase = d1Retention.fleetReports?.find((r) => r.id === acceptReport?.id);
    const heldId = "e0".padEnd(24, "0");
    // `decisionDelivery: null` on BOTH plants, and it is not decoration: these rows are built by
    // SPREADING a real decided row, so without it the undecided plant would carry the carry record
    // of the row it was copied from — a verdict nobody gave, delivered. fleetReportFrom refuses
    // exactly that pair (a delivery requires a decision) and DISCARDS the row at hydration, which
    // is the parser working: the plant would vanish and this check would read `held: false` while
    // reporting nothing about retention at all. Measured on 2026-09-12, the run that introduced the
    // field. An undecided row has no carry by construction, so saying so is what the plant means.
    const heldProgramRow = retentionBase ? { ...retentionBase, id: heldId,
      reportedAt: Math.max(1, retentionBase.reportedAt - 200_000),
      decision: null, decisionDelivery: null } : null;
    const decidedProgramRows = retentionBase ? Array.from({ length: 21 }, (_, index) => ({
      ...retentionBase, id: (0xe100 + index).toString(16).padStart(24, "0"),
      reportedAt: Math.max(1, retentionBase.reportedAt - 100_000 + index),
      decision: { disposition: "accepted" as const, at: retentionBase.reportedAt - 50_000,
        by: { slot: d1Main, openedAt: Number(d1MainRow.openedAt), sessionId: null }, reason: null },
      decisionDelivery: null,
    })) : [];
    if (heldProgramRow) d1Retention.fleetReports?.push(heldProgramRow, ...decidedProgramRows);
    writeFileSync(d1Path, JSON.stringify(d1Retention, null, 2), { mode: 0o600 });
    await restartSrv();
    const retentionTrigger = await selfFleetReport(terminalTok,
      { status: "complete", text: "D1 retention trigger stays undecided." });
    const retained = (await selfFleetReports(d1OtherTok)).reports;
    check("fleet-report retention: an undecided program row survives the cap while decided program rows are terminal",
      retentionTrigger.ok && !!heldProgramRow && retained.some((r) => r.id === heldId)
        && decidedProgramRows.some((r) => !retained.some((standing) => standing.id === r.id))
        && decidedProgramRows.some((r) => retained.some((standing) => standing.id === r.id)),
      JSON.stringify({ held: retained.some((r) => r.id === heldId), decidedStanding: decidedProgramRows
        .filter((r) => retained.some((standing) => standing.id === r.id)).length }));

    // BREAKS IF: openFleetReport branches on programId presence rather than ACTIVE status.
    await stopSrv();
    const d1Inactive = JSON.parse(readFileSync(d1Path, "utf8")) as
      { programs?: { id?: string; status?: string }[] };
    const inactiveProgram = d1Inactive.programs?.find((p) => p.id === d1ProgramId);
    if (inactiveProgram) inactiveProgram.status = "complete";
    writeFileSync(d1Path, JSON.stringify(d1Inactive, null, 2), { mode: 0o600 });
    await restartSrv();
    const inactiveReport = await selfFleetReport(terminalTok,
      { status: "complete", text: "A complete Program does not own this new row." });
    const inactiveText = await inactiveReport.text();
    check("fleet-report inactive program: a lane whose Program is complete falls back to exact receiver evidence or the named 409",
      inactiveReport.status === 409 && inactiveText.includes("no exact clarification receiver evidence"),
      `${inactiveReport.status} ${inactiveText}`);

    for (const slot of [acceptLane.slot, rejectLane.slot, terminalLane.slot, inboxLane.slot,
      programlessLane.slot,
      d1Main, d1Other]) await post(`/api/slots/${slot}/kill`, {});
    if (d1TaskId) await post(`/api/tasks/${d1TaskId}/delete`, {});
    await stopSrv();
    const d1Cleaned = JSON.parse(readFileSync(d1Path, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    d1Cleaned.events = (d1Cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    d1Cleaned.fleetReports = [];
    d1Cleaned.programs = (d1Cleaned.programs ?? []).filter((p) => p.id !== d1ProgramId);
    writeFileSync(d1Path, JSON.stringify(d1Cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL D2 · THE AUTOMATIC CLOSE OF A SPENT LANE ===================================
  // D1 above gave a MAIN a way to say "I read this work and took it". This block proves the one
  // thing that verdict makes safe: closing a worker lane that is FINISHED, CLEAN, has nothing ahead
  // of main and produced no landable candidate — the lane that otherwise sits open forever holding
  // a dispatcher slot until the owner presses kill by hand.
  //
  // Everything here is a REFUSAL except two lanes. That asymmetry is the design: the git/pane half
  // (`spent-looking`) cannot tell a lane that gave up from one that finished a read-only slice, so
  // the close is gated on a persisted human-read judgement AND on a fresh commit count, and every
  // fixture below differs from the closing one in exactly ONE fact.
  {
    // --- the predicate half, direct, and this is the falsifier for the ahead clause. Every
    // integration fixture below refuses through TWO independent guards (the predicate and the
    // killed-empty assertion), so no behavioural check can isolate one of them; this one can.
    // Dropping `git.ahead===0` from SPENT_RULES turns exactly this check red.
    const spentShape: LaneSignalView = { alive: true, idleMs: 5000, git: { dirty: 0, ahead: 0 },
      gitOp: false, merge: null, observed: true, awaiting: null, hostCommits: false };
    check("D2 predicate: spent-looking is the stalled shape plus a clean tree — ahead>0 and dirty>0 each refuse it",
      laneSpentLooking(spentShape, 1500) === true
      && laneSpentLooking({ ...spentShape, git: { dirty: 0, ahead: 1 } }, 1500) === false
      && laneSpentLooking({ ...spentShape, git: { dirty: 1, ahead: 0 } }, 1500) === false,
      JSON.stringify({ spent: laneSpentLooking(spentShape, 1500),
        ahead: laneSpentLooking({ ...spentShape, git: { dirty: 0, ahead: 1 } }, 1500),
        dirty: laneSpentLooking({ ...spentShape, git: { dirty: 1, ahead: 0 } }, 1500) }));
    // …and every OTHER unknown-or-parked fact refuses too, in the positive direction the clause
    // list argues for: an unknown git, an unobserved pane, a lane parked on the owner and a lane
    // with something to show are four different sentences and none of them is permission.
    check("D2 predicate: an unknown, unobserved, parked or ahead lane is never spent-looking",
      laneSpentLooking({ ...spentShape, git: null }, 1500) === false
      && laneSpentLooking({ ...spentShape, observed: false }, 1500) === false
      && laneSpentLooking({ ...spentShape, awaiting: "owner" }, 1500) === false
      && laneSpentLooking({ ...spentShape, alive: null }, 1500) === false
      && laneSpentLooking({ ...spentShape, idleMs: 100 }, 1500) === false,
      "positive clauses over facts that must be known");
    // the composition itself, so the live probe below is not a tautology: `stalled` is served on
    // the steward view and `dirty` beside it, and spent-looking is exactly their conjunction.
    check("D2 predicate: spent-looking === served `stalled` AND a clean tree, so the served facts can stand in for it",
      SPENT_RULES.length === STALLED_RULES.length + 1
      && SPENT_RULES.slice(0, STALLED_RULES.length).every((r, i) => r === STALLED_RULES[i])
      && SPENT_RULES[SPENT_RULES.length - 1]?.prose === "clean tree"
      && laneStalled(spentShape, 1500) === true,
      `${SPENT_RULES.length} clauses, last=${SPENT_RULES[SPENT_RULES.length - 1]?.prose}`);

    const d2Main = await freeSlot();
    const d2MainOpen = d2Main ? await post(`/api/slots/${d2Main}/open`, { cwd: REPO, label: "d2-autoclose-main" }) : null;
    const d2NewLane = async (): Promise<{ ok?: boolean; slot: number; cwd: string; branch: string }> =>
      (await (await post("/api/lanes", { repo: REPO })).json()) as
        { ok?: boolean; slot: number; cwd: string; branch: string };
    const acceptedLane = await d2NewLane();
    const rejectedLane = await d2NewLane();
    const dirtyLane = await d2NewLane();
    const aheadLane = await d2NewLane();
    const rejectedAheadLane = await d2NewLane();
    const undecidedLane = await d2NewLane();
    const reportlessLane = await d2NewLane();
    const outsideLineageLane = await d2NewLane();
    const clarifyLane = await d2NewLane();
    const d2Lanes = [acceptedLane, rejectedLane, dirtyLane, aheadLane, rejectedAheadLane,
      undecidedLane, reportlessLane, outsideLineageLane, clarifyLane];
    const d2Refusers = [dirtyLane, aheadLane, rejectedAheadLane, undecidedLane, reportlessLane,
      outsideLineageLane];
    check("D2 fixtures: one MAIN occupant and nine distinct lanes exist",
      !!d2MainOpen?.ok && d2Lanes.every((l) => typeof l.slot === "number" && !!l.cwd && !!l.branch)
        && new Set([d2Main, ...d2Lanes.map((l) => l.slot)]).size === 10,
      JSON.stringify({ d2Main, lanes: d2Lanes.map((l) => l.slot) }));
    const d2MainTok = await paneEnv(`s${d2Main}`, "FLEET_SELF_TOKEN") ?? "";
    const d2Tok = new Map<number, string>();
    for (const l of d2Lanes) d2Tok.set(l.slot, await paneEnv(`s${l.slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("D2 fixtures: every participant carries its own exact scoped credential",
      /^[0-9a-f]{32}$/.test(d2MainTok) && [...d2Tok.values()].every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([d2MainTok, ...d2Tok.values()]).size === 10,
      `lengths=${[d2MainTok, ...d2Tok.values()].map((t) => t.length).join("/")}`);

    // The Program binding and the per-lane queue identity, planted with srv down — the technique
    // every binding fixture in this file uses. The task ids are ids and nothing more for eight
    // lanes: the close JOINS them (lane row ↔ report provenance) and reads a task row only for its
    // criterion. The CLARIFY lane is the one that needs a REAL row — sent, on its slot — because
    // its criterion is proposed through the lane's own /api/self/criterion door, which attaches to
    // exactly that row.
    const d2Path = `${ROOT}/fleet.json`;
    const d2ProgramId = "b".repeat(24);
    const d2TaskId = (slot: number): string => `d2task${String(slot).padStart(6, "0")}`;
    const d2ClarifyTask = (await (await post("/api/tasks",
      { text: "D2 clarify-lane fixture row", queue: false, kind: "notiz" })).json()) as { task?: { id: string } };
    const d2ClarifyTaskId = d2ClarifyTask.task?.id ?? "";
    await stopSrv();
    const d2Plant = JSON.parse(readFileSync(d2Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      tasks?: Record<string, unknown>[];
    };
    const d2MainRow = d2Plant.slots[String(d2Main)] ?? {};
    d2Plant.programs = [...(d2Plant.programs ?? []), {
      id: d2ProgramId, title: "Automatic lane close fixture",
      intent: "Close a spent lane whose result a MAIN judged",
      successCriterion: "A spent, judged lane is closed without the owner", nonGoals: [],
      decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: d2Main, openedAt: d2MainRow.openedAt, sessionId: d2MainRow.sessionId,
        boundAt: Date.now() - 700 },
      lineage: { v: 1, entries: [{ slot: d2Main, openedAt: d2MainRow.openedAt,
        sessionId: d2MainRow.sessionId, boundAt: Date.now() - 700, via: "bootstrap",
        endedAt: null, endedBy: null }], dropped: 0 },
    }];
    for (const l of d2Lanes) {
      d2Plant.slots[String(l.slot)].programId = d2ProgramId;
      d2Plant.slots[String(l.slot)].taskId = d2TaskId(l.slot);
    }
    d2Plant.slots[String(clarifyLane.slot)].taskId = d2ClarifyTaskId;
    d2Plant.tasks = (d2Plant.tasks ?? []).map((t) => t.id === d2ClarifyTaskId
      ? { ...t, status: "sent", slot: clarifyLane.slot } : t);
    writeFileSync(d2Path, JSON.stringify(d2Plant, null, 2), { mode: 0o600 });
    await restartSrv();

    // the two git shapes that must refuse, made from real trees rather than planted numbers: an
    // uncommitted file, and a lane that actually has a commit its base does not.
    await Bun.write(`${dirtyLane.cwd}/d2-uncommitted.txt`, "a lane with work nobody recorded\n");
    for (const l of [aheadLane, rejectedAheadLane]) {
      await Bun.write(`${l.cwd}/d2-candidate.txt`, "a lane with something to show for itself\n");
      spawnSync("git", ["-C", l.cwd, "add", "d2-candidate.txt"]);
      spawnSync("git", ["-C", l.cwd, "commit", "-qm", "D2 fixture: this lane produced a candidate"]);
    }

    // Filed and judged ONE AT A TIME on purpose: a decision settles its FleetEvent, so the receiver's
    // delivery budget (5 open rows per slot) is returned before the next report needs it. The
    // undecided row is filed LAST and left open — it is the one debt this MAIN carries.
    const d2Report = new Map<number, FleetReportRow>();
    const d2Decide: [{ slot: number }, "accept" | "reject"][] = [
      [acceptedLane, "accept"], [rejectedLane, "reject"], [dirtyLane, "accept"],
      [aheadLane, "accept"], [rejectedAheadLane, "reject"], [clarifyLane, "accept"],
    ];
    // the clarify lane's criterion, proposed by the lane itself BEFORE its report is judged — the
    // measured order of task b28b9d89 (criterion filed, needs-main report accepted, then closed).
    // Its slot is NOT awaiting the owner (a /api/lanes lane never is, and an owner /send clears it
    // on a dispatched one), so the unconfirmed criterion is the ONE fact that tells it apart.
    const d2Proposed = await fetch(`${BASE}/api/self/criterion`, { method: "POST",
      headers: { "content-type": "application/json", "x-fleet-self-token": d2Tok.get(clarifyLane.slot) ?? "" },
      body: JSON.stringify({ text: "D2 fixture: the owner has not confirmed this criterion" }) });
    const d2ProposedBody = await d2Proposed.json() as { ok?: boolean; proposedAt?: number };
    const d2Verdicts: number[] = [];
    for (const [lane, verdict] of d2Decide) {
      const filed = await selfFleetReport(d2Tok.get(lane.slot) ?? "",
        { status: "complete", text: `D2 fixture: slot ${lane.slot} finished and produced no candidate.` });
      const row = (await filed.json() as { report?: FleetReportRow }).report;
      if (!row) continue;
      d2Report.set(lane.slot, row);
      const decided = await decideReport(d2MainTok, row.id, verdict, { reason: `D2: ${verdict}ed` });
      const after = (await decided.json() as { report?: FleetReportRow }).report;
      if (after?.decision) { d2Report.set(lane.slot, after); d2Verdicts.push(lane.slot); }
    }
    const undecidedFiled = await selfFleetReport(d2Tok.get(undecidedLane.slot) ?? "",
      { status: "needs-main", text: "D2 fixture: a decision is owed on this one and never given." });
    const undecidedRow = (await undecidedFiled.json() as { report?: FleetReportRow }).report;
    if (undecidedRow) d2Report.set(undecidedLane.slot, undecidedRow);
    const outsideFiled = await selfFleetReport(d2Tok.get(outsideLineageLane.slot) ?? "",
      { status: "complete", text: "D2 fixture: this planted verdict names no lineage holder." });
    const outsideRow = (await outsideFiled.json() as { report?: FleetReportRow }).report;
    if (outsideRow) {
      await stopSrv();
      const outsidePlant = JSON.parse(readFileSync(d2Path, "utf8")) as {
        fleetReports?: FleetReportRow[]; slots?: Record<string, { openedAt?: number; sessionId?: string | null }>;
      };
      const row = outsidePlant.fleetReports?.find((r) => r.id === outsideRow.id);
      const nonHolder = outsidePlant.slots?.[String(acceptedLane.slot)];
      if (row && nonHolder?.openedAt) row.decision = { disposition: "accepted", at: Date.now(),
        by: { slot: acceptedLane.slot, openedAt: nonHolder.openedAt,
          sessionId: nonHolder.sessionId ?? null }, reason: "not a Program authority" };
      writeFileSync(d2Path, JSON.stringify(outsidePlant, null, 2), { mode: 0o600 });
      await restartSrv();
      const plantedOutside = (await selfFleetReports(d2MainTok)).reports.find((r) => r.id === outsideRow.id);
      if (plantedOutside) d2Report.set(outsideLineageLane.slot, plantedOutside);
    }
    const d2CriterionOf = async (): Promise<{ proposedAt: number; confirmedAt: number | null } | null> =>
      ((await (await get("/api/tasks")).json()) as { tasks: { id: string; criterion?: { proposedAt: number;
        confirmedAt: number | null } }[] }).tasks.find((t) => t.id === d2ClarifyTaskId)?.criterion ?? null;
    const d2CriterionBefore = await d2CriterionOf();
    check("D2 fixtures: the clarify lane proposed its criterion through its own door, and it is served unconfirmed",
      d2Proposed.status === 200 && d2ProposedBody.ok === true && d2ClarifyTaskId !== ""
        && d2CriterionBefore?.proposedAt === d2ProposedBody.proposedAt && d2CriterionBefore?.confirmedAt === null,
      JSON.stringify({ status: d2Proposed.status, body: d2ProposedBody, task: d2ClarifyTaskId, criterion: d2CriterionBefore }));
    check("D2 fixtures: six reports carry a verdict by the exact lineage holder, one names a non-holder, one is undecided, and one lane filed nothing",
      d2Verdicts.length === 6
        && d2Report.get(acceptedLane.slot)?.decision?.disposition === "accepted"
        && d2Report.get(rejectedLane.slot)?.decision?.disposition === "rejected"
        && d2Report.get(rejectedAheadLane.slot)?.decision?.disposition === "rejected"
        && decisionOccupant(d2Report.get(acceptedLane.slot)?.decision)?.slot === d2Main
        && decisionOccupant(d2Report.get(outsideLineageLane.slot)?.decision)?.slot === acceptedLane.slot
        && (undecidedRow?.decision ?? null) === null
        && (await selfFleetReports(d2Tok.get(reportlessLane.slot) ?? "")).reports.length === 0,
      JSON.stringify({ decided: d2Verdicts, undecided: undecidedRow?.id ?? null,
        dispositions: [...d2Report.entries()].map(([s, r]) => [s, r.decision?.disposition ?? null]) }));

    // --- the live precondition, read off the SERVER's own served facts rather than re-derived
    // here: `stalled` plus a clean tree IS spent-looking (pinned as a composition three checks
    // above), so a lane that does not reach this shape fails as a SETUP problem instead of making
    // the close look broken. The isolated harness shrinks FLEET_STALLED_IDLE_MS to 3 s.
    //
    // EVERY fact this precondition asserts is WAITED FOR, and that is the whole of the repair
    // (measured 2026-09-06). The served `git` numbers are the ~10 s tickGit DISPLAY cache, not a
    // fresh read, so the five REFUSING lanes only carry the fixture's writes once a tick has walked
    // them AFTERWARDS. The old loop waited on the two CLOSING lanes alone — the two whose facts the
    // writes never touch — so it returned the moment the 3 s idle clock passed (`msSincePrev` was
    // 3110-3195 ms in all 40 local sightings) and then read the refusers out of that same snapshot,
    // up to 10 s before it could be true. Whether it happened to be true is a race between the boot
    // tick's pass length and the fixture writes, and the pass length is exactly what differs by
    // HOST: 0 red in 40 local (macOS) runs against 9 red in 11 second-host (Linux) runs, whose faster
    // tick is finished before the writes land. Two of those nine caught the sequence MID-WRITE and
    // name the mechanism outright — the dirty lane still clean while both ahead lanes read
    // `dirty:1 ahead:0`, i.e. one tick that passed the first lane before its file and the other two
    // between their file and their commit. Waiting costs at most one further tick, and it weakens
    // nothing: the clause list below IS the assertion, evaluated on the snapshot that satisfied it.
    const d2SvTok = ((await (await get("/api/steward/token")).json()) as { token: string }).token;
    type D2Sv = { id: number; stalled: boolean; observed: boolean;
      git: { dirty: number; ahead: number } | null };
    const d2Sv = async (): Promise<D2Sv[]> =>
      ((await (await fetch(BASE + "/api/steward/sessions",
        { headers: { authorization: `Bearer ${d2SvTok}` } })).json()) as { slots: D2Sv[] }).slots;
    const d2SpentNow = async (slot: number): Promise<boolean> => {
      const v = (await d2Sv()).find((x) => x.id === slot);
      return v?.stalled === true && v.git?.dirty === 0;
    };
    // the whole shape as a NAMED clause per lane, and one snapshot per round rather than a fetch
    // per lane: a per-lane sentence is what lets a timeout say WHICH fact never arrived instead of
    // handing the reader the contract it was meant to enable, and a single snapshot cannot be torn
    // across a tick that lands between two of its own reads.
    const d2Spent = (v: D2Sv | undefined): boolean => v?.stalled === true && v.git?.dirty === 0;
    const d2Want: { slot: number; want: string; holds: (v: D2Sv | undefined) => boolean }[] = [
      { slot: acceptedLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
      { slot: rejectedLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
      { slot: dirtyLane.slot, want: "dirty=1 (the uncommitted file is served)", holds: (v) => v?.git?.dirty === 1 },
      { slot: aheadLane.slot, want: "ahead=1 (the candidate commit is served)", holds: (v) => v?.git?.ahead === 1 },
      { slot: rejectedAheadLane.slot, want: "ahead=1 (the candidate commit is served)", holds: (v) => v?.git?.ahead === 1 },
      { slot: undecidedLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
      { slot: reportlessLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
      { slot: outsideLineageLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
      { slot: clarifyLane.slot, want: "spent (stalled + dirty=0)", holds: d2Spent },
    ];
    const d2Unmet = (snap: D2Sv[]): string[] => d2Want
      .filter((w) => !w.holds(snap.find((x) => x.id === w.slot)))
      .map((w) => `${w.slot}: ${w.want}`);
    let d2SvBefore = await d2Sv();
    let d2Missing = d2Unmet(d2SvBefore);
    for (let i = 0; i < 60 && d2Missing.length > 0; i++) {
      await Bun.sleep(1000);
      d2SvBefore = await d2Sv();
      d2Missing = d2Unmet(d2SvBefore);
    }
    check("D2 setup: both closing lanes reached the spent shape, and every refusing lane differs from them in exactly one fact",
      d2Missing.length === 0,
      JSON.stringify({ unmet: d2Missing,
        slots: d2SvBefore.filter((x) => d2Lanes.some((l) => l.slot === x.id))
          .map((x) => [x.id, x.stalled, x.git]) }));

    // --- (b) THE FLAG'S ABSENCE MEANS DO NOTHING, and this is where it is worth measuring: every
    // fact the close needs is now true for two lanes, and the server was booted without the flag.
    const outcomesOf = async (branch: string): Promise<Record<string, unknown>[]> =>
      ((await (await get("/api/lane-outcomes?limit=1000")).json()) as
        { outcomes: Record<string, unknown>[] }).outcomes.filter((o) => o.branch === branch);
    const liveSlots = async (): Promise<{ id: number; cwd: string | null }[]> =>
      ((await (await get("/api/sessions")).json()) as { slots: { id: number; cwd: string | null }[] }).slots;
    // …and the FLAG'S OWN STATE, measured on the server instead of assumed from its absence. A
    // knob no wrapper names is inherited from whatever shell started the suite, and this is the
    // one knob the deployed fleet ARMS (watchdog.sh, since 566cbae) — server.ts#runVerify hands
    // the land gate's chain the live server's env unfiltered, so the inheritance is a real path
    // and not a hypothetical. e2e-isolated.sh states 0 in SRV_ENV and e2e-stage.sh exports the
    // same 0 for every wrapper; this reads both ends back. It fails as ITSELF — an inherited `1`
    // must read as a wrong PREMISE here, never as a broken close two lines below.
    const d2Flag = await srvEnv("FLEET_LANE_AUTOCLOSE");
    check("D2 setup: the suite server states FLEET_LANE_AUTOCLOSE=0 in its own environment — the off-state below is pinned, not inherited",
      d2Flag.readable && d2Flag.value === "0" && (process.env.FLEET_LANE_AUTOCLOSE ?? null) === "0",
      JSON.stringify({ srvReadable: d2Flag.readable, srv: d2Flag.value,
        runner: process.env.FLEET_LANE_AUTOCLOSE ?? null }));
    await Bun.sleep(Math.max(3000, AUTOS_TICK_MS * 8));
    const unarmedSlots = await liveSlots();
    const unarmedRows = await Promise.all(d2Lanes.map((l) => outcomesOf(l.branch)));
    check("D2 flag off: with FLEET_LANE_AUTOCLOSE stated 0 the ready lanes are untouched and no outcome row is written",
      d2Lanes.every((l) => (unarmedSlots.find((x) => x.id === l.slot)?.cwd ?? null) !== null)
        && unarmedRows.every((rows) => rows.length === 0),
      JSON.stringify({ open: d2Lanes.map((l) => unarmedSlots.find((x) => x.id === l.slot)?.cwd !== null),
        rows: unarmedRows.map((r) => r.length) }));

    // --- ARM IT. The flag rides one restart: `extra` wins only for the restart it is passed to,
    // and the next plain restartSrv falls back to the stated 0 this process's env carries (see
    // restartSrv's own note, and the SRV_ENV paragraph in e2e-isolated.sh for why it is stated).
    const d2MainShaBefore = spawnSync("git", ["-C", REPO, "rev-parse", "main"], { encoding: "utf8" }).stdout.trim();
    const d2OpenBefore = (await liveSlots()).filter((x) => x.cwd !== null).map((x) => x.id);
    const d2PlogBefore = (await plogRead()).length;
    await restartSrv({ FLEET_LANE_AUTOCLOSE: "1" });
    let closedBoth = false;
    for (let i = 0; i < 120 && !closedBoth; i++) {
      const live = await liveSlots();
      closedBoth = (live.find((x) => x.id === acceptedLane.slot)?.cwd ?? null) === null
        && (live.find((x) => x.id === rejectedLane.slot)?.cwd ?? null) === null;
      if (!closedBoth) await Bun.sleep(1000);
    }
    const d2LiveAfter = await liveSlots();
    const acceptedRows = await outcomesOf(acceptedLane.branch);
    const rejectedRows = await outcomesOf(rejectedLane.branch);
    const acceptedRow = acceptedRows[0] as { disposition?: string; commitCount?: number;
      repo?: string; taskId?: string; programId?: string;
      autoClose?: { reportId?: string; disposition?: string; decidedAt?: number; decidedBySlot?: number } } | undefined;
    const rejectedRow = rejectedRows[0] as { disposition?: string;
      autoClose?: { reportId?: string; disposition?: string } } | undefined;
    check("D2 close: a spent lane whose report was ACCEPTED by its exact receiver is torn down without the owner",
      closedBoth && (d2LiveAfter.find((x) => x.id === acceptedLane.slot)?.cwd ?? null) === null,
      JSON.stringify({ closedBoth, cwd: d2LiveAfter.find((x) => x.id === acceptedLane.slot)?.cwd ?? null }));
    check("D2 close: a REJECTED verdict closes the lane the same way — the door is 'judged', not 'approved'",
      (d2LiveAfter.find((x) => x.id === rejectedLane.slot)?.cwd ?? null) === null
        && rejectedRow?.disposition === "killed-empty"
        && rejectedRow.autoClose?.disposition === "rejected"
        && rejectedRow.autoClose.reportId === d2Report.get(rejectedLane.slot)?.id,
      JSON.stringify({ row: rejectedRow ?? null }));
    // --- (c) the trail a hand close writes, plus the one field that says no hand was involved.
    // Reconstructible WITHOUT a pane: the disposition, the lane's own provenance, and the id of the
    // report whose verdict authorised it are all on the row.
    check("D2 trail: exactly one killed-empty row per closed lane, carrying the authorising report id, its verdict and the deciding occupant",
      acceptedRows.length === 1 && rejectedRows.length === 1
        && acceptedRow?.disposition === "killed-empty" && acceptedRow.commitCount === 0
        && acceptedRow.autoClose?.disposition === "accepted"
        && !!d2Report.get(acceptedLane.slot)?.id
        && acceptedRow.autoClose.reportId === d2Report.get(acceptedLane.slot)?.id
        && acceptedRow.autoClose.decidedBySlot === d2Main
        && acceptedRow.autoClose.decidedAt === d2Report.get(acceptedLane.slot)?.decision?.at
        && acceptedRow.taskId === d2TaskId(acceptedLane.slot) && acceptedRow.programId === d2ProgramId,
      JSON.stringify({ rows: acceptedRows.length, row: acceptedRow ?? null }));
    // …and the worktree survives the close exactly as it survives a hand kill: killSlot never
    // removes a tree, so nothing this tick does can destroy work it decided not to look at.
    check("D2 trail: the closed lane's worktree is still on disk, as after any hand kill",
      existsSync(acceptedLane.cwd) && existsSync(rejectedLane.cwd),
      `${acceptedLane.cwd} ${rejectedLane.cwd}`);

    // --- (a) EVERY refusal, each isolated to one fact, measured on the same armed server.
    const refusalRows = await Promise.all(d2Refusers.map((l) => outcomesOf(l.branch)));
    const stillOpen = d2Refusers.map((l) => (d2LiveAfter.find((x) => x.id === l.slot)?.cwd ?? null) !== null);
    check("D2 refusal: a dirty tree is never closed, however decided its report",
      stillOpen[0] === true && refusalRows[0]?.length === 0,
      JSON.stringify({ open: stillOpen[0], rows: refusalRows[0]?.length }));
    check("D2 refusal: ahead>0 is never closed — a lane with a candidate is somebody's to look at",
      stillOpen[1] === true && refusalRows[1]?.length === 0,
      JSON.stringify({ open: stillOpen[1], rows: refusalRows[1]?.length }));
    check("D2 refusal: a REJECTED report does not license closing a lane that is still ahead",
      stillOpen[2] === true && refusalRows[2]?.length === 0,
      JSON.stringify({ open: stillOpen[2], rows: refusalRows[2]?.length }));
    // the row is FOUND and undecided — a `?.decision === undefined` on a row that is simply gone
    // would pass for the trivial reason that there is nothing to read, which is the shape this
    // check must not be able to have.
    const undecidedStanding = (await selfFleetReports(d2MainTok)).reports
      .find((r) => r.id === undecidedRow?.id);
    check("D2 refusal: a filed but UNDECIDED report never closes a lane, however spent it looks",
      stillOpen[3] === true && refusalRows[3]?.length === 0
        && !!undecidedStanding && (undecidedStanding.decision ?? null) === null,
      JSON.stringify({ open: stillOpen[3], rows: refusalRows[3]?.length,
        standing: !!undecidedStanding, decision: undecidedStanding?.decision ?? null }));
    check("D2 refusal: a lane that filed NO report is never closed — absent evidence is not a verdict",
      stillOpen[4] === true && refusalRows[4]?.length === 0,
      JSON.stringify({ open: stillOpen[4], rows: refusalRows[4]?.length }));
    // BREAKS IF: the Program-lineage membership test is removed or compares slot without openedAt.
    check("D2 autoclose program row: a verdict by an occupant this Program's lineage never held is refused",
      stillOpen[5] === true && refusalRows[5]?.length === 0
        && decisionOccupant(d2Report.get(outsideLineageLane.slot)?.decision)?.slot === acceptedLane.slot,
      JSON.stringify({ open: stillOpen[5], rows: refusalRows[5]?.length,
        decision: d2Report.get(outsideLineageLane.slot)?.decision ?? null }));
    // BREAKS IF: the unconfirmed-criterion clause in server.ts#laneAutoCloseRefusal is removed —
    // everything else about this lane matches the accepted lane that closed above.
    // a fresh read after a settle window, not d2LiveAfter: the tick walks slots one at a time with
    // an awaited git read per closing lane, so `closedBoth` can turn true before it reaches this one.
    await Bun.sleep(Math.max(3000, AUTOS_TICK_MS * 8));
    const clarifyOpenArmed = ((await liveSlots()).find((x) => x.id === clarifyLane.slot)?.cwd ?? null) !== null;
    const clarifyRowsArmed = await outcomesOf(clarifyLane.branch);
    const clarifyCriterionArmed = await d2CriterionOf();
    check("D2 refusal: a clarify lane whose criterion the owner has not confirmed is never closed, however accepted its report (refused: \"the lane's proposed criterion is unconfirmed — the owner has not confirmed it\")",
      clarifyOpenArmed && clarifyRowsArmed.length === 0
        && d2Report.get(clarifyLane.slot)?.decision?.disposition === "accepted"
        && clarifyCriterionArmed !== null && clarifyCriterionArmed.confirmedAt === null,
      JSON.stringify({ open: clarifyOpenArmed, rows: clarifyRowsArmed.length, decision: d2Report.get(clarifyLane.slot)?.decision?.disposition ?? null,
        criterion: clarifyCriterionArmed }));

    // --- (d) what the close must never do, measured rather than asserted in prose: it moves no
    // integration branch, it types nothing into any lane, and it takes no slot it was not entitled
    // to — including every lane other modules left open on this server.
    const d2MainShaAfter = spawnSync("git", ["-C", REPO, "rev-parse", "main"], { encoding: "utf8" }).stdout.trim();
    const d2PlogAfter = await plogRead();
    const laneWrites = d2PlogAfter.slice(d2PlogBefore)
      .filter((entry) => d2Lanes.some((l) => l.slot === entry.slot)).length;
    const foreignClosed = d2OpenBefore.filter((id) => !d2Lanes.some((l) => l.slot === id)
      && (d2LiveAfter.find((x) => x.id === id)?.cwd ?? null) === null);
    check("D2 invariants: the close lands nothing, types nothing into a lane, and closes no slot outside its own fixtures",
      d2MainShaBefore !== "" && d2MainShaAfter === d2MainShaBefore
        && laneWrites === 0 && foreignClosed.length === 0,
      JSON.stringify({ main: [d2MainShaBefore.slice(0, 8), d2MainShaAfter.slice(0, 8)],
        laneWrites, foreignClosed }));

    // --- the COUNTER-PROBE on the same lane: the owner confirms the criterion, and the close that
    // refused it a moment ago now takes it exactly as it took the accepted lane — same row shape.
    const d2Confirm = await post(`/api/tasks/${d2ClarifyTaskId}/criterion-confirm`, {});
    let clarifyClosed = false;
    for (let i = 0; i < 60 && !clarifyClosed; i++) {
      clarifyClosed = ((await liveSlots()).find((x) => x.id === clarifyLane.slot)?.cwd ?? null) === null;
      if (!clarifyClosed) await Bun.sleep(1000);
    }
    const clarifyRows = await outcomesOf(clarifyLane.branch);
    const clarifyRow = clarifyRows[0] as { disposition?: string;
      autoClose?: { reportId?: string; disposition?: string } } | undefined;
    check("D2 close: the same clarify lane, once the owner confirmed its criterion, is closed killed-empty on its accepted report",
      d2Confirm.ok && clarifyClosed && clarifyRows.length === 1
        && clarifyRow?.disposition === "killed-empty" && clarifyRow.autoClose?.disposition === "accepted"
        && clarifyRow.autoClose.reportId === d2Report.get(clarifyLane.slot)?.id,
      JSON.stringify({ confirm: d2Confirm.status, closed: clarifyClosed, rows: clarifyRows.length, row: clarifyRow ?? null }));

    // --- and the FLAG rode exactly one restart. Proven rather than trusted to the harness note:
    // the dirty lane's ONE refusing fact is removed, so on an armed server it would now close —
    // same Program, same accepted verdict, same spent shape as the two lanes that did. It stays
    // open across the plain restart, which is also what every module after this one depends on.
    rmSync(`${dirtyLane.cwd}/d2-uncommitted.txt`, { force: true });
    await restartSrv(); // plain: the stated FLEET_LANE_AUTOCLOSE=0 rides along, so the flag is off again
    let disarmedSpent = false;
    for (let i = 0; i < 60 && !disarmedSpent; i++) {
      disarmedSpent = await d2SpentNow(dirtyLane.slot);
      if (!disarmedSpent) await Bun.sleep(1000);
    }
    await Bun.sleep(Math.max(3000, AUTOS_TICK_MS * 8));
    const disarmedLive = await liveSlots();
    check("D2 teardown: the flag rode exactly one restart — the now-spent, accepted lane stays open on the plain restart",
      disarmedSpent && (disarmedLive.find((x) => x.id === dirtyLane.slot)?.cwd ?? null) !== null
        && (await outcomesOf(dirtyLane.branch)).length === 0,
      JSON.stringify({ spent: disarmedSpent,
        cwd: disarmedLive.find((x) => x.id === dirtyLane.slot)?.cwd ?? null }));

    for (const l of d2Refusers) await post(`/api/slots/${l.slot}/kill`, {});
    if (!clarifyClosed) await post(`/api/slots/${clarifyLane.slot}/kill`, {});
    if (d2Main) await post(`/api/slots/${d2Main}/kill`, {});
    await stopSrv();
    const d2Cleaned = JSON.parse(readFileSync(d2Path, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
      tasks?: { id?: string }[];
    };
    // the sent row would otherwise sit on a recycled slot, where foundingRowOf's slot fallback hands
    // it to the next lane that proposes a criterion there
    d2Cleaned.tasks = (d2Cleaned.tasks ?? []).filter((t) => t.id !== d2ClarifyTaskId);
    d2Cleaned.events = (d2Cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    d2Cleaned.fleetReports = [];
    d2Cleaned.programs = (d2Cleaned.programs ?? []).filter((p) => p.id !== d2ProgramId);
    writeFileSync(d2Path, JSON.stringify(d2Cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === RESULT-RAIL D3 · THE OWNER DOOR FOR A REPORT NO SESSION CAN JUDGE =======================
  // D1 gave a bound MAIN the verdict. This block proves the exit that was missing beside it, and
  // the finding is measured rather than argued: on 2026-09-07 six panes were read and NONE was
  // closable; three of them for this one mechanism. A Program-MAIN with a filed-but-unjudged report
  // is nailed to its chair — clarificationReceiverFor resolves the receiver from the LIVING
  // occupant, decideFleetReport compares against it, and the only route is SELF-only. Retiring that
  // MAIN did not make the acceptance hard, it made it PERMANENTLY IMPOSSIBLE. That is why the fleet
  // accumulated panes.
  //
  // Four facts are under test, and each fails silently in its own direction: the door must refuse
  // while the MAIN lives (or it is a way around a binding that is RIGHT), it must open when the
  // MAIN is gone, it must stamp the OWNER and not the dead session, and the row must be VISIBLE —
  // an orphan whose event went terminal on teardown lights nothing in either inbox class.
  {
    // DELTAS off a baseline, never absolutes: this suite has written report rows and trail lines
    // long before this block, and both ledgers are append-only across the whole run.
    const d3AuditEvents = (): string[] => {
      try {
        return readFileSync(`${ROOT}/audit.jsonl`, "utf8").split("\n").filter(Boolean)
          .map((l) => { try { return String((JSON.parse(l) as { event?: string }).event ?? ""); } catch { return ""; } });
      } catch { return []; }
    };
    const d3AwaitingCount = async (): Promise<number> =>
      ((await (await get("/api/sessions")).json()) as { reportsAwaitingOwner?: number })
        .reportsAwaitingOwner ?? 0;

    const d3Main = await freeSlot();
    const d3MainOpen = d3Main ? await post(`/api/slots/${d3Main}/open`, { cwd: REPO, label: "d3-owner-door-main" }) : null;
    const d3SessMain = await freeSlot();
    const d3SessOpen = d3SessMain ? await post(`/api/slots/${d3SessMain}/open`, { cwd: REPO, label: "d3-sessionid-main" }) : null;
    const d3NewLane = async (): Promise<{ slot: number; cwd: string; branch: string }> =>
      (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    const orphanLane = await d3NewLane();     // its report outlives its MAIN — the owner's to judge
    const judgedLane = await d3NewLane();     // judged by the MAIN first, THEN orphaned
    const sessionLane = await d3NewLane();    // the sessionId-divergence arm (criterion 4)
    const inboxLane = await d3NewLane();      // no Program, no watch — the owner-inbox fallback
    check("D3 fixtures: two MAIN occupants and four distinct lanes exist",
      !!d3MainOpen?.ok && !!d3SessOpen?.ok
        && new Set([d3Main, d3SessMain, orphanLane.slot, judgedLane.slot, sessionLane.slot,
          inboxLane.slot]).size === 6,
      JSON.stringify({ d3Main, d3SessMain,
        lanes: [orphanLane.slot, judgedLane.slot, sessionLane.slot, inboxLane.slot] }));
    const d3MainTok = await paneEnv(`s${d3Main}`, "FLEET_SELF_TOKEN") ?? "";
    const d3SessTok = await paneEnv(`s${d3SessMain}`, "FLEET_SELF_TOKEN") ?? "";
    const orphanTok = await paneEnv(`s${orphanLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const judgedTok = await paneEnv(`s${judgedLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const sessionTok = await paneEnv(`s${sessionLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const inboxTok3 = await paneEnv(`s${inboxLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    const d3Toks = [d3MainTok, d3SessTok, orphanTok, judgedTok, sessionTok, inboxTok3];
    check("D3 fixtures: every participant carries its own exact scoped credential",
      d3Toks.every((t) => /^[0-9a-f]{32}$/.test(t)) && new Set(d3Toks).size === 6,
      `lengths=${d3Toks.map((t) => t.length).join("/")}`);

    // Two Programs, planted with srv down like every binding fixture in this file. The second one
    // exists only so the sessionId arm has a MAIN of its OWN: killing the first one is the act
    // under test, and a shared MAIN would make one arm the teardown of the other.
    const d3Path = `${ROOT}/fleet.json`;
    const d3ProgramId = "c".repeat(24);
    const d3SessProgramId = "d".repeat(24);
    await stopSrv();
    const d3Plant = JSON.parse(readFileSync(d3Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
      watches?: Record<string, unknown>[];
    };
    const d3MainRow = d3Plant.slots[String(d3Main)] ?? {};
    const d3SessRow = d3Plant.slots[String(d3SessMain)] ?? {};
    const programShell = (id: string, slot: number, row: Record<string, unknown>) => ({
      id, title: "Owner acceptance door fixture",
      intent: "Judge a typed worker result whose MAIN may be gone",
      successCriterion: "A report always has exactly one principal that may judge it", nonGoals: [],
      decisions: [], evidence: [], openQuestions: [], status: "active",
      createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot, openedAt: row.openedAt, sessionId: row.sessionId, boundAt: Date.now() - 700 },
    });
    d3Plant.programs = [...(d3Plant.programs ?? []),
      programShell(d3ProgramId, d3Main, d3MainRow),
      programShell(d3SessProgramId, d3SessMain, d3SessRow)];
    for (const lane of [orphanLane, judgedLane])
      d3Plant.slots[String(lane.slot)].taskId = `d3task${String(lane.slot).padStart(6, "0")}`;
    d3Plant.slots[String(sessionLane.slot)].taskId = "d3task-sessionid";
    // D3 continues to prove the legacy occupant-bound owner door. Program lanes now use the new
    // Program principal, so spent exact Watches supply the old transport evidence without taking
    // delivery budget or changing the D3 subject.
    d3Plant.watches = [...(d3Plant.watches ?? []), ...[
      { lane: orphanLane, slot: d3Main, row: d3MainRow },
      { lane: judgedLane, slot: d3Main, row: d3MainRow },
      { lane: sessionLane, slot: d3SessMain, row: d3SessRow },
    ].map(({ lane, slot, row }, index) => ({
      id: `d3legacyreport${index}`, slot, slotOpenedAt: row.openedAt,
      idleSec: 0, armed: false, created: Date.now(), firedAt: Date.now(),
      lastResult: "legacy occupant-bound report fixture", kind: "lane",
      target: lane.slot, targetCwd: lane.cwd, targetBranch: lane.branch,
    }))];
    // the B4 shape: a task dispatched it, nothing bound it — the owner-inbox fallback
    d3Plant.slots[String(inboxLane.slot)].taskId = "d3task-owner-inbox";
    writeFileSync(d3Path, JSON.stringify(d3Plant, null, 2), { mode: 0o600 });
    await restartSrv();

    const d3Filed = await Promise.all([
      selfFleetReport(orphanTok, { status: "complete", text: "D3: the slice is done; my MAIN is about to end." }),
      selfFleetReport(judgedTok, { status: "complete", text: "D3: judged before the MAIN ended." }),
      selfFleetReport(sessionTok, { status: "needs-main", text: "D3: filed while the pane carried no session id." }),
      selfFleetReport(inboxTok3, { status: "failed", text: "D3: filed to the owner inbox, nobody bound me." }),
    ]);
    const [orphanReport, judgedReport, sessionReport, inboxReport3] = await Promise.all(
      d3Filed.map(async (r) => (await r.json() as { report?: FleetReportRow }).report));
    check("D3 fixtures: three bound reports and one owner-inbox report exist, all undecided",
      d3Filed.every((r) => r.ok)
        && orphanReport?.receiver?.slot === d3Main && judgedReport?.receiver?.slot === d3Main
        && sessionReport?.receiver?.slot === d3SessMain
        && [orphanReport, judgedReport, sessionReport].every((r) => r?.basis === "lane-watch"
          && (r?.decision ?? null) === null)
        && inboxReport3?.receiver === null && inboxReport3.basis === "owner-inbox",
      JSON.stringify([orphanReport, judgedReport, sessionReport, inboxReport3]
        .map((r) => [r?.id, r?.basis, r?.receiver?.slot ?? null])));

    // --- (a) THE BOUNDARY. While the MAIN lives the verdict is ITS OWN, and the owner door says so
    // with the address of the door that is open. The binding was never the defect.
    const liveRefusal = await ownerDecideReport(orphanReport?.id ?? "", "accept");
    const liveRefusalText = await liveRefusal.text();
    check("D3 live receiver: the owner door refuses a report whose MAIN is alive, and names the door that is open",
      liveRefusal.status === 409
        && liveRefusalText.includes(`fleet report receiver slot ${d3Main} is live`)
        && liveRefusalText.includes(`POST /api/self/fleet-report/${orphanReport?.id}/accept|reject`)
        && ((await selfFleetReports(d3MainTok)).reports.find((r) => r.id === orphanReport?.id)?.decision ?? null) === null,
      `${liveRefusal.status} ${liveRefusalText}`);
    // …and the owner door is not a BACK DOOR for the principal the self door excludes. A lane's
    // scoped credential is not an owner credential at the token gate at all, so this is a 401 and
    // not a 409: the lane never reaches the row, which is stronger than being refused at it.
    const laneAtOwnerDoor = await fetch(`${BASE}/api/fleet-report/${orphanReport?.id}/accept`, {
      method: "POST", headers: { "content-type": "application/json", "x-fleet-self-token": orphanTok },
      body: "{}",
    });
    const laneAtOwnerDoorText = await laneAtOwnerDoor.text();
    check("D3 lane exclusion: a worker's scoped credential is not an owner credential — the owner door is unreachable from a lane",
      laneAtOwnerDoor.status === 401
        && ((await ownerReports()).find((r) => r.id === orphanReport?.id)?.decision ?? null) === null,
      `${laneAtOwnerDoor.status} ${laneAtOwnerDoorText}`);
    const unknownOwner = await ownerDecideReport("0".repeat(24), "accept");
    const unknownOwnerText = await unknownOwner.text();
    check("D3 unknown id: an id that names no row is 404, not a 409 about a liveness it cannot read",
      unknownOwner.status === 404 && unknownOwnerText.includes("unknown fleet report"),
      `${unknownOwner.status} ${unknownOwnerText}`);
    // …on the OWNER-INBOX row, not the orphan-to-be: the liveness guard runs first by design, so a
    // bad body aimed at a live receiver would be answered 409 and this arm would measure that guard
    // a second time instead of the validators behind it.
    const d3BadBodies = await Promise.all([
      ownerDecideReport(inboxReport3?.id ?? "", "accept", { reason: "ok", disposition: "accepted" }),
      ownerDecideReport(inboxReport3?.id ?? "", "accept", { reason: 5 }),
      ownerDecideReport(inboxReport3?.id ?? "", "accept", { reason: "x".repeat(501) }),
    ]);
    const d3BadTexts = await Promise.all(d3BadBodies.map((r) => r.text()));
    check("D3 body shape: the owner door takes {reason} or nothing, in the self door's own discipline",
      d3BadBodies.every((r) => r.status === 400)
        && d3BadTexts[0]?.includes("body must contain only reason") === true
        && d3BadTexts[1]?.includes("reason must be a string") === true
        && d3BadTexts[2]?.includes("reason must be at most 500 chars") === true
        && ((await ownerReports()).find((r) => r.id === inboxReport3?.id)?.decision ?? null) === null,
      JSON.stringify({ statuses: d3BadBodies.map((r) => r.status), texts: d3BadTexts }));

    // --- (c) THE sessionId DIVERGENCE, the second defect the same measurement found. Slot 12 held a
    // Program.main with sessionId null while its live pane had since bound one: the MAIN RECEIVED
    // the report (clarificationReceiverFor never gates sessionId) and could never judge it (this
    // door compared all three), and the owner door could not help because the occupant was ALIVE —
    // a report with no principal at all. Planted from BOTH sides so the arm does not depend on how
    // this harness happens to assign session ids.
    await stopSrv();
    const sessPlant = JSON.parse(readFileSync(d3Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>;
      fleetReports?: { id?: string; receiver?: { sessionId?: string | null } }[];
    };
    sessPlant.slots[String(d3SessMain)].sessionId = "d3-live-session";
    for (const r of sessPlant.fleetReports ?? [])
      if (r.id === sessionReport?.id && r.receiver) r.receiver.sessionId = null;
    writeFileSync(d3Path, JSON.stringify(sessPlant, null, 2), { mode: 0o600 });
    await restartSrv();
    // read from the PERSISTED row, D1's own technique: /api/sessions carries `sessionId` only for a
    // codex-harness slot, and this suite runs FLEET_CMD=true — a probe through the poll would be
    // measuring the projection's harness branch instead of the fact it is here for.
    const sessSlotAfter = (JSON.parse(readFileSync(d3Path, "utf8")) as
      { slots?: Record<string, { sessionId?: string | null }> }).slots?.[String(d3SessMain)];
    const sessRowAfter = (await selfFleetReports(d3SessTok)).reports.find((r) => r.id === sessionReport?.id);
    const sessDecide = await decideReport(d3SessTok, sessionReport?.id ?? "", "accept",
      { reason: "The pane that received this is the pane judging it." });
    const sessBody = await sessDecide.json() as { ok?: boolean; report?: FleetReportRow };
    const sessDecidedBy = sessBody.report?.decision?.by;
    check("D3 sessionId divergence: the receiving OCCUPATION judges its own report even after its session id moved",
      // `?? ` must not appear on this leg: null IS the fact under test, and a nullish default here
      // turned the arm's own subject into its failure (measured on the first run of this section).
      sessSlotAfter?.sessionId === "d3-live-session"
        && !!sessRowAfter?.receiver && sessRowAfter.receiver.sessionId === null
        && sessDecide.ok && sessBody.report?.decision?.disposition === "accepted"
        && sessDecidedBy !== "owner" && sessDecidedBy?.slot === d3SessMain
        && sessDecidedBy?.sessionId === "d3-live-session",
      JSON.stringify({ liveSession: sessSlotAfter?.sessionId,
        rowFound: !!sessRowAfter, rowReceiver: sessRowAfter?.receiver ?? "ABSENT",
        status: sessDecide.status, decision: sessBody.report?.decision ?? null }));
    // …and the owner door stays SHUT on it: that occupant is alive, and the verdict was its own.
    const sessOwnerRefusal = await ownerDecideReport(sessionReport?.id ?? "", "reject");
    check("D3 sessionId divergence: the owner door never opens for a live occupant, whatever its session id says",
      sessOwnerRefusal.status === 409,
      `${sessOwnerRefusal.status} ${await sessOwnerRefusal.text()}`);
    // the verdict SURVIVES a restart — a parser that still demanded the receiver's exact triple
    // would discard this row whole at the next boot, silently, one judgement at a time.
    await restartSrv();
    const sessAfterBoot = (await selfFleetReports(d3SessTok)).reports.find((r) => r.id === sessionReport?.id);
    check("D3 sessionId divergence: the judged row hydrates, verdict intact, instead of being discarded at boot",
      sessAfterBoot?.decision?.disposition === "accepted"
        && sessAfterBoot.decision.by !== "owner" && sessAfterBoot.decision.by?.slot === d3SessMain,
      JSON.stringify(sessAfterBoot?.decision ?? null));

    // --- the MAIN judges ONE of its two reports and is then torn down. That is the live shape the
    // finding describes: the owner arrives at a rail carrying one settled row and one orphan.
    const preKillJudge = await decideReport(d3MainTok, judgedReport?.id ?? "", "accept",
      { reason: "Read it while I was still here." });
    check("D3 pre-kill: the MAIN judges one of its own reports through the door that is properly its",
      preKillJudge.ok, `${preKillJudge.status} ${await preKillJudge.text()}`);
    const auditBefore = d3AuditEvents();
    const awaitingBefore = await d3AwaitingCount();
    await post(`/api/slots/${d3Main}/kill`, {});
    await Bun.sleep(1000);

    // --- (3) VISIBILITY. The orphan's FleetEvent went `receiver-gone` at teardown — terminal, and
    // therefore in NEITHER class the operations inbox renders. Before this cut the row simply lay
    // there and an absence read exactly like "nobody has looked at it yet".
    const orphanEvent = (await fleetReportEventRows()).find((e) => e.id === orphanReport?.eventId);
    const viewAfterKill = await ownerReports();
    const orphanSeen = viewAfterKill.find((r) => r.id === orphanReport?.id);
    const judgedSeen = viewAfterKill.find((r) => r.id === judgedReport?.id);
    const awaitingAfter = await d3AwaitingCount();
    check("D3 visibility: the orphaned row is served to the owner as `gone`, sorted ahead of the judged one, and counted on the poll",
      orphanEvent?.status === "receiver-gone"
        && orphanSeen?.liveness === "gone" && (orphanSeen.decision ?? null) === null
        && judgedSeen?.liveness === "gone" && judgedSeen.decision?.disposition === "accepted"
        && viewAfterKill.findIndex((r) => r.id === orphanReport?.id)
          < viewAfterKill.findIndex((r) => r.id === judgedReport?.id)
        && awaitingAfter > awaitingBefore,
      JSON.stringify({ event: orphanEvent?.status, orphan: orphanSeen?.liveness,
        judged: judgedSeen?.liveness, awaiting: `${awaitingBefore}→${awaitingAfter}` }));

    // --- (1)+(2) THE DOOR ITSELF, and the stamp. `by` is the literal "owner": a principal, never
    // the triple of a session that had already ended.
    const ownerAccept = await ownerDecideReport(orphanReport?.id ?? "", "accept",
      { reason: "The MAIN is gone; I read the branch and took the work." });
    const ownerAcceptBody = await ownerAccept.json() as { ok?: boolean; report?: FleetReportRow };
    const orphanEventAfter = (await fleetReportEventRows()).find((e) => e.id === orphanReport?.eventId);
    check("D3 owner accept: the verdict lands stamped `owner`, with its time and reason, on a row no session could judge",
      ownerAccept.ok && ownerAcceptBody.ok === true
        && ownerAcceptBody.report?.decision?.disposition === "accepted"
        && ownerAcceptBody.report.decision.by === "owner"
        && typeof ownerAcceptBody.report.decision.at === "number" && ownerAcceptBody.report.decision.at > 0
        && ownerAcceptBody.report.decision.reason === "The MAIN is gone; I read the branch and took the work.",
      JSON.stringify(ownerAcceptBody.report?.decision ?? null));
    check("D3 owner accept: an already-terminal event is left byte-for-byte as it was — receiver-gone is loss evidence, not an open debt",
      orphanEventAfter?.status === "receiver-gone"
        && orphanEventAfter.acknowledgedAt === orphanEvent?.acknowledgedAt,
      JSON.stringify({ before: orphanEvent?.status, after: orphanEventAfter?.status }));
    const auditAfter = d3AuditEvents();
    check("D3 owner accept: the trail carries its OWN word, so an owner verdict is distinguishable from a MAIN's",
      auditAfter.filter((e) => e === "fleet_report_owner_decision").length
        === auditBefore.filter((e) => e === "fleet_report_owner_decision").length + 1,
      `before=${auditBefore.filter((e) => e === "fleet_report_owner_decision").length}`
        + ` after=${auditAfter.filter((e) => e === "fleet_report_owner_decision").length}`);
    const ownerSecond = await ownerDecideReport(orphanReport?.id ?? "", "reject");
    const ownerSecondText = await ownerSecond.text();
    check("D3 first decision wins across BOTH doors: a second owner call is 409 and the row is unchanged",
      ownerSecond.status === 409 && ownerSecondText.includes("fleet report was already accepted")
        && JSON.stringify((await ownerReports()).find((r) => r.id === orphanReport?.id)?.decision)
          === JSON.stringify(ownerAcceptBody.report?.decision),
      `${ownerSecond.status} ${ownerSecondText}`);
    const ownerOverJudged = await ownerDecideReport(judgedReport?.id ?? "", "reject");
    const ownerOverJudgedText = await ownerOverJudged.text();
    check("D3 the owner never overwrites a MAIN: a row judged before its MAIN ended reads back as that MAIN's verdict",
      ownerOverJudged.status === 409 && ownerOverJudgedText.includes("fleet report was already accepted")
        && (await ownerReports()).find((r) => r.id === judgedReport?.id)?.decision?.by !== "owner",
      `${ownerOverJudged.status} ${ownerOverJudgedText}`);

    // --- (4b) THE OWNER-INBOX ROW, whose refusal on the self door has always said the verdict
    // "belongs to the owner". Until this cut that sentence pointed at a door that did not exist.
    const inboxSelfRefusal = await decideReport(d3SessTok, inboxReport3?.id ?? "", "accept");
    const inboxSelfText = await inboxSelfRefusal.text();
    const inboxEventBefore = (await fleetReportEventRows()).find((e) => e.id === inboxReport3?.eventId);
    const inboxOwner = await ownerDecideReport(inboxReport3?.id ?? "", "reject", { reason: "Not the work I asked for." });
    const inboxOwnerBody = await inboxOwner.json() as { ok?: boolean; report?: FleetReportRow };
    const inboxEventAfter = (await fleetReportEventRows()).find((e) => e.id === inboxReport3?.eventId);
    check("D3 owner-inbox: the sentence the self door has always spoken now points at a door that exists",
      inboxSelfRefusal.status === 409
        && inboxSelfText.includes("belongs to the owner, who has no session to bind a decision to")
        && inboxOwner.ok && inboxOwnerBody.report?.decision?.disposition === "rejected"
        && inboxOwnerBody.report.decision.by === "owner"
        && inboxOwnerBody.report.decision.reason === "Not the work I asked for.",
      JSON.stringify({ self: inboxSelfRefusal.status, owner: inboxOwner.status,
        decision: inboxOwnerBody.report?.decision ?? null }));
    check("D3 owner-inbox: the still-open inbox event settles through the ack writer, so a paid debt leaves the inbox",
      inboxEventBefore?.status === "inbox" && inboxEventAfter?.status === "acknowledged"
        && typeof inboxEventAfter.acknowledgedAt === "number" && (inboxEventAfter.acknowledgedAt ?? 0) > 0,
      JSON.stringify({ before: inboxEventBefore?.status, after: inboxEventAfter?.status }));

    // --- (3b) RETENTION. The door is decorative if the row it acts on can vanish first: an orphan's
    // event is terminal, so pruneFleetReports would have dropped it off the tail like any settled
    // row. Planted past the ceiling with srv down, then a fresh report is filed — that is the ONLY
    // caller of the prune — and the awaiting row must still be there afterwards.
    const holdLane = await d3NewLane();
    const holdTok = await paneEnv(`s${holdLane.slot}`, "FLEET_SELF_TOKEN") ?? "";
    await stopSrv();
    const keepPlant = JSON.parse(readFileSync(d3Path, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; fleetReports?: Record<string, unknown>[];
    };
    // the filing lane needs a queue identity: without a taskId the owner-inbox fallback refuses,
    // and a 409 here would leave the prune unrun and the check measuring nothing.
    keepPlant.slots[String(holdLane.slot)].taskId = "d3task-hold";
    // an orphan with NO receiver occupant left in the slots map at all: the shape the owner door
    // exists for, and the one the tail would otherwise eat first (it is the oldest row here).
    const heldId = "9".repeat(24);
    const filler = Array.from({ length: 30 }, (_unused, i) => ({
      id: `${(i + 10).toString(16).padStart(2, "0")}`.repeat(12), reportedAt: Date.now() - 500_000 + i,
      status: "complete", text: `D3 filler ${i}`,
      worker: { slot: 1, openedAt: 1, sessionId: null, cwd: REPO, branch: `d3-filler-${i}` },
      provenance: { taskId: null, originId: null, programId: null, instance: null },
      receiver: null, basis: "owner-inbox", eventId: "0".repeat(24),
      // decided, and by the one principal an owner-inbox row can carry a verdict from
      decision: { disposition: "accepted", at: Date.now() - 400_000, by: "owner", reason: null },
    }));
    keepPlant.fleetReports = [
      { id: heldId, reportedAt: Date.now() - 900_000, status: "needs-main",
        text: "D3: an orphan older than the whole retention tail.",
        worker: { slot: 1, openedAt: 1, sessionId: null, cwd: REPO, branch: "d3-held-orphan" },
        provenance: { taskId: null, originId: null, programId: null, instance: null },
        // a slot id no occupant carries in this fixture, with an openedAt no live row can match:
        // reportReceiverLiveness must answer `gone` on both legs, not on a coincidence of one
        receiver: { slot: 1, openedAt: 4242, sessionId: null }, basis: "program-main",
        eventId: "1".repeat(24) },
      ...filler,
      ...(keepPlant.fleetReports ?? []),
    ];
    writeFileSync(d3Path, JSON.stringify(keepPlant, null, 2), { mode: 0o600 });
    await restartSrv();
    const beforePrune = await ownerReports();
    const pruneTrigger = await selfFleetReport(holdTok, { status: "complete", text: "D3: the file that runs the prune." });
    const afterPrune = await ownerReports();
    check("D3 retention: the prune drops settled rows past the ceiling and HOLDS the one the owner still owes a verdict",
      pruneTrigger.ok
        && beforePrune.some((r) => r.id === heldId)
        && afterPrune.some((r) => r.id === heldId)
        && afterPrune.find((r) => r.id === heldId)?.liveness === "gone"
        && afterPrune.filter((r) => filler.some((f) => f.id === r.id)).length
          < filler.filter((f) => beforePrune.some((r) => r.id === f.id)).length,
      JSON.stringify({ trigger: pruneTrigger.status, heldBefore: beforePrune.some((r) => r.id === heldId),
        heldAfter: afterPrune.some((r) => r.id === heldId),
        fillerBefore: filler.filter((f) => beforePrune.some((r) => r.id === f.id)).length,
        fillerAfter: afterPrune.filter((r) => filler.some((f) => f.id === r.id)).length }));

    for (const l of [orphanLane, judgedLane, sessionLane, inboxLane, holdLane])
      await post(`/api/slots/${l.slot}/kill`, {});
    if (d3SessMain) await post(`/api/slots/${d3SessMain}/kill`, {});
    await stopSrv();
    const d3Cleaned = JSON.parse(readFileSync(d3Path, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    d3Cleaned.events = (d3Cleaned.events ?? []).filter((e) => e.kind !== "fleet-report");
    d3Cleaned.fleetReports = [];
    d3Cleaned.programs = (d3Cleaned.programs ?? [])
      .filter((p) => p.id !== d3ProgramId && p.id !== d3SessProgramId);
    writeFileSync(d3Path, JSON.stringify(d3Cleaned, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // === V1b · THE RETURN PATH, DRIVEN ==========================================================
  // The projection GET /api/programs and the Supervisor senses show is only worth something if its
  // numbers are the ones the DOORS spend. So this block builds the exact shape the slice was cut
  // for — four armed watches plus one delivery debt on one bound MAIN — and then walks a lane into
  // it. What must come back is the refusal that already existed and was invisible from outside:
  // `fleet-report receiver has no FleetEvent delivery budget`, measured five times on 2026-08-25.
  //
  // Reservations and debts are counted by the SAME sum (slotDeliveryBudget), which is why both are
  // present here: a cut that read only one of them would still pass a probe built from the other.
  {
    const bMain = await freeSlot();
    const bOpen = bMain ? await post(`/api/slots/${bMain}/open`, { cwd: REPO, label: "return-path-main" }) : null;
    const budgetLanes: { slot: number; cwd: string; branch: string }[] = [];
    for (let i = 0; i < 5; i++)
      budgetLanes.push((await (await post("/api/lanes", { repo: REPO })).json()) as
        { slot: number; cwd: string; branch: string });
    check("V1b fixture: one plain MAIN occupant and five distinct lanes exist",
      !!bOpen?.ok && new Set([bMain, ...budgetLanes.map((l) => l.slot)]).size === 6,
      JSON.stringify({ bMain, lanes: budgetLanes.map((l) => l.slot) }));
    const bMainTok = await paneEnv(`s${bMain}`, "FLEET_SELF_TOKEN") ?? "";
    const laneToks: string[] = [];
    for (const l of budgetLanes) laneToks.push(await paneEnv(`s${l.slot}`, "FLEET_SELF_TOKEN") ?? "");
    check("V1b fixture: every participant carries its own exact scoped credential",
      [bMainTok, ...laneToks].every((t) => /^[0-9a-f]{32}$/.test(t))
        && new Set([bMainTok, ...laneToks]).size === 6,
      `lengths=${[bMainTok, ...laneToks].map((t) => t.length).join("/")}`);

    // The Program binding exists only so the projection can expose this MAIN's budget. The lanes
    // deliberately remain program-less after S3b: the four Watches below are both reservations and
    // exact legacy receiver evidence, so these older doors still exercise their FleetEvent cap.
    await stopSrv();
    const budgetStatePath = `${ROOT}/fleet.json`;
    const budgetPlant = JSON.parse(readFileSync(budgetStatePath, "utf8")) as {
      slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[];
    };
    const budgetProgramId = "e".repeat(24);
    const bMainRow = budgetPlant.slots[String(bMain)];
    budgetPlant.programs = [...(budgetPlant.programs ?? []), {
      id: budgetProgramId, title: "Return path fixture",
      intent: "Receive the typed results of its own lanes",
      successCriterion: "The budget the doors spend is the budget the sights show",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: Date.now() - 1000, proposedBy: { kind: "owner" },
      confirmedAt: Date.now() - 900, activatedAt: Date.now() - 800,
      main: { slot: bMain, openedAt: bMainRow.openedAt, sessionId: bMainRow.sessionId,
        boundAt: Date.now() - 700 },
    }];
    writeFileSync(budgetStatePath, JSON.stringify(budgetPlant, null, 2), { mode: 0o600 });
    await restartSrv();

    const openBudget = await programBudget(budgetProgramId);
    check("V1b: a fresh live binding projects the FULL return path — five of five places, and the sentence says open",
      openBudget?.deliveryBudget?.state === "known" && openBudget.deliveryBudget.cap === 5
        && openBudget.deliveryBudget.deliveryDebts === 0
        && openBudget.deliveryBudget.armedReservations === 0
        && openBudget.deliveryBudget.free === 5
        && (openBudget.deliveryBudgetNote ?? "").startsWith(`return path open at slot ${bMain}: 5 of 5`),
      JSON.stringify({ budget: openBudget?.deliveryBudget, note: openBudget?.deliveryBudgetNote }));

    // FOUR RESERVATIONS. Every target is a fresh lane with no commits, so the done-looking
    // predicate never classifies it and none of these can fire — a fire would DISARM, quietly
    // turning the four the doors count into three with no check noticing.
    // the check is named by ORDINAL, not by slot id: the id is an allocation artifact that shifts
    // with whatever the suite opened before this section (a `--shard` run allocates differently),
    // and a check name that carries it stops being one name across runs. The id rides in the detail.
    for (const [i, l] of budgetLanes.slice(0, 4).entries()) {
      const armed = await post(`/api/slots/${bMain}/watch`, { target: l.slot, idleSec: 3600 });
      check(`V1b: the MAIN subscribes to lane #${i + 1} — one armed reservation`,
        armed.ok, `slot=${l.slot} ${armed.status} ${await armed.text()}`);
    }
    // …AND ONE DEBT. An accepted report is exactly the act the fifth place pays for, so this call
    // must still succeed: four reservations leave one.
    const firstReport = await selfFleetReport(laneToks[0],
      { status: "complete", text: "the fifth delivery place is now spent" });
    check("V1b: with four reservations one place is left, and a report spends it",
      firstReport.ok, `${firstReport.status} ${await firstReport.text()}`);
    const replacementReservation = await post(`/api/slots/${bMain}/watch`,
      { target: budgetLanes[4]!.slot, idleSec: 3600 });
    check("V1b: after the report supersedes its own watch, a fifth lane can reserve the released place",
      replacementReservation.ok, `${replacementReservation.status} ${await replacementReservation.text()}`);
    const closedBudget = await programBudget(budgetProgramId);
    check("V1b: four armed watches plus one delivery debt read as a CLOSED return path — before any lane hits it",
      closedBudget?.deliveryBudget?.state === "known"
        && closedBudget.deliveryBudget.deliveryDebts === 1
        && closedBudget.deliveryBudget.armedReservations === 4
        && closedBudget.deliveryBudget.cap === 5 && closedBudget.deliveryBudget.free === 0
        && (closedBudget.deliveryBudgetNote ?? "").includes(`return path CLOSED at slot ${bMain}`),
      JSON.stringify({ budget: closedBudget?.deliveryBudget, note: closedBudget?.deliveryBudgetNote }));

    // THE COUNTERPROBE ITSELF: the same 4+1 the sight just described is what the doors refuse on,
    // each in its own words. Two doors, one sum — a later cut that gave either door its own
    // arithmetic would pass one of these and fail the other.
    const refusedReport = await selfFleetReport(laneToks[1],
      { status: "complete", text: "there is no place left for me" });
    const refusedReportText = await refusedReport.text();
    const refusedClarify = await selfClarify(laneToks[1], { question: "and no place for a question either?" });
    const refusedClarifyText = await refusedClarify.text();
    check("V1b counterprobe: at zero free places BOTH minting doors refuse, in the words the sight quoted",
      refusedReport.status === 409
        && refusedReportText.includes("fleet-report receiver has no FleetEvent delivery budget")
        && refusedClarify.status === 409
        && refusedClarifyText.includes("clarification receiver has no FleetEvent delivery budget"),
      `${refusedReport.status} ${refusedReportText} / ${refusedClarify.status} ${refusedClarifyText}`);
    const afterRefusal = (await fleetReportEventRows()).filter((e) => e.receiverSlot === bMain);
    const armedAfterRefusal = (await watchRows()).filter((w) => w.slot === bMain && w.armed).length;
    check("V1b: the refusals minted nothing, and reading the sight again acknowledges nothing and disarms nothing",
      afterRefusal.length === 1 && afterRefusal.every((e) => e.status !== "acknowledged")
        && armedAfterRefusal === 4
        && JSON.stringify((await programBudget(budgetProgramId))?.deliveryBudget)
          === JSON.stringify(closedBudget?.deliveryBudget),
      JSON.stringify({ events: afterRefusal.map((e) => [e.id, e.status]), armedAfterRefusal }));

    // A RELEASED PLACE IS A PLACE. `free` has to track both directions, or it is a counter that
    // only grows and every closed return path would look permanent: killing one watched lane
    // disarms its reservation, and the next report goes through on the place that came back.
    await post(`/api/slots/${budgetLanes[3].slot}/kill`, {});
    const releasedBudget = await programBudget(budgetProgramId);
    const secondReport = await selfFleetReport(laneToks[2],
      { status: "needs-main", text: "the place a disarmed watch gave back" });
    check("V1b: a disarmed reservation gives its place back — the sight sees it and the door honours it",
      releasedBudget?.deliveryBudget?.state === "known"
        && releasedBudget.deliveryBudget.armedReservations === 3
        && releasedBudget.deliveryBudget.free === 1
        && (releasedBudget.deliveryBudgetNote ?? "").startsWith(`return path open at slot ${bMain}: 1 of 5`)
        && secondReport.ok,
      JSON.stringify({ budget: releasedBudget?.deliveryBudget, second: secondReport.status }));

    for (const slot of [bMain, ...budgetLanes.map((l) => l.slot)])
      await post(`/api/slots/${slot}/kill`, {});
    await stopSrv();
    const budgetCleanup = JSON.parse(readFileSync(budgetStatePath, "utf8")) as {
      events?: { kind?: string }[]; fleetReports?: unknown[]; programs?: { id?: string }[];
    };
    budgetCleanup.events = (budgetCleanup.events ?? []).filter((e) => e.kind !== "fleet-report");
    budgetCleanup.fleetReports = [];
    budgetCleanup.programs = (budgetCleanup.programs ?? []).filter((p) => p.id !== budgetProgramId);
    writeFileSync(budgetStatePath, JSON.stringify(budgetCleanup, null, 2), { mode: 0o600 });
    await restartSrv();
  }

  // --- the receivers, both PLAIN slots: the session this feature exists for is a driving main
  // checkout, and that is also the shape the SELF route below is scoped to. Everything down to the
  // teardown drives the OWNER route; the self twin gets its own block, on its own slot, so neither
  // principal's pins can be satisfied by the other's. `rcvA` is left quiet and gets idleSec:0;
  // `rcvB` is deliberately kept busy. ---
  const aId = await freeSlot();
  const openA = aId ? await post(`/api/slots/${aId}/open`, { cwd: REPO }) : null;
  check("watch setup: a plain receiver slot is open", !!openA?.ok, `${aId} ${openA?.status}`);
  const bId = await freeSlot();
  const openB = bId ? await post(`/api/slots/${bId}/open`, { cwd: REPO }) : null;
  check("watch setup: a second plain receiver slot is open", !!openB?.ok, `${bId} ${openB?.status}`);
  // Read both credentials before any Watch can inject into either pane. paneEnv is itself a
  // pane exchange; racing it with the transport under test can consume its unique marker.
  const aTok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const bTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  check("event ack setup: both receiver panes carry distinct scoped tokens before subscription",
    /^[0-9a-f]{32}$/.test(aTok) && /^[0-9a-f]{32}$/.test(bTok) && aTok !== bTok,
    `${aTok}:${bTok}`);
  // Slots are recyclable, while the prompt ledger is append-only. Count only rows written after
  // these two receiver identities were opened; an earlier occupant's Watch is not this fixture's.
  const ownerWatchLogStart = (await plogRead()).length;
  const ownerWatchMessages = async (slot: number) => (await plogRead()).slice(ownerWatchLogStart)
    .filter((e) => e.slot === slot && e.text.startsWith("[fleet] slot "));

  // --- REJECTIONS. Every one answers the same question — can this watch ever fire? A watch that
  // cannot is worse than none, because it is a silent forever-wait, which is the failure the whole
  // surface removes. So a target the predicate never classifies is refused at CREATE time. ---
  const rNonLane = await post(`/api/slots/${aId}/watch`, { target: bId });
  check("watch on a NON-LANE slot is refused (done-looking only classifies lanes)",
    rNonLane.status === 409, `${rNonLane.status} ${await rNonLane.text()}`);
  const rSelf = await post(`/api/slots/${aId}/watch`, { target: aId });
  check("a session cannot watch itself", rSelf.status === 400, String(rSelf.status));
  const rIdle = await post(`/api/slots/${aId}/watch`, { target: await freeSlot() });
  check("watch on an INACTIVE slot is refused", rIdle.status === 400, String(rIdle.status));
  const rBogus = await post(`/api/slots/${aId}/watch`, { target: 999 });
  check("watch on a nonexistent slot is refused", rBogus.status === 400, String(rBogus.status));
  {
    // the ⚙ steward is a lane by every mechanical test and is still excluded by name — a planning
    // pane's diff is not lane work, so the predicate never fires for it and neither may a watch
    const st = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number };
    await post(`/api/slots/${st.slot}/rename`, { label: "⚙ steward" });
    const rStew = await post(`/api/slots/${aId}/watch`, { target: st.slot });
    check("watch on the ⚙ steward is refused even though it is a worktree lane",
      rStew.status === 409, `${rStew.status} ${await rStew.text()}`);
    await post(`/api/slots/${st.slot}/kill`, {});
  }

  // --- a lane on a harness the automation policy declines can NEVER be classified done-looking:
  // aliveInfo folds harnessAutomatable into `alive`, and both looking predicates require
  // alive === true. Measured live 2026-08-29 on pi-zai (adapter declines); this suite fleet runs
  // FLEET_HARNESS_AUTOMATION=0, so here the FLAG half of harnessAutomatableFor refuses `pi` —
  // adapter-side automatable:true — through the same never-fires physics. `naTgt` stays open for
  // the self-path row in the twin below and is killed there. ---
  const naTgt = (await (await post("/api/lanes", { repo: REPO, harness: "pi" })).json()) as
    { slot: number; cwd: string; branch: string };
  check("watch non-automatable fixture: a pi-harness lane exists as a target",
    naTgt.slot > 0, JSON.stringify(naTgt));
  const rNa = await post(`/api/slots/${aId}/watch`, { target: naTgt.slot });
  const rNaText = await rNa.text();
  check("watch on a lane whose harness the policy declines is refused 409 — it could never fire",
    rNa.status === 409 && rNaText.includes("harness pi is not automatable")
      && rNaText.includes("its slot never reads as alive to the done-looking predicate, so this watch could never fire")
      && rNaText.includes("FLEET_HARNESS_AUTOMATION is off; no named harness is automatable without it"),
    `${rNa.status} ${rNaText}`);
  // the merge twin on the SAME target must be refused for the MERGE reason only — the tick reads
  // the merge terminal factor for merge, not laneSignalView, and such a lane demonstrably fires a
  // merge watch. A harness 409 here would forbid a watch that works.
  const rNaMerge = await post(`/api/slots/${aId}/watch`, { kind: "merge", target: naTgt.slot });
  const rNaMergeText = await rNaMerge.text();
  check("the same target as {kind:\"merge\"} is refused for the merge reason only — the harness clause is lane-scoped",
    rNaMerge.status === 409 && rNaMergeText.includes("no running or persisted terminal merge exists")
      && !rNaMergeText.includes("not automatable"),
    `${rNaMerge.status} ${rNaMergeText}`);
  // GEGENPROBE: same receiver, same shape, DEFAULT adapter — accepted and armed. Without it the
  // 409s above could be any regression that broke the route. Watch deleted and lane killed right
  // after, so neither can answer a later duplicate subscription with existing:true.
  const okTgt = (await (await post("/api/lanes", { repo: REPO })).json()) as
    { slot: number; cwd: string; branch: string };
  const rOk = await post(`/api/slots/${aId}/watch`, { target: okTgt.slot, idleSec: 3600 });
  const rOkJ = (await rOk.json()) as { ok?: boolean; watch?: WatchRow };
  check("GEGENPROBE: the same watch on a default-adapter lane is accepted and armed",
    rOk.status === 200 && rOkJ.ok === true && rOkJ.watch?.armed === true
      && rOkJ.watch?.target === okTgt.slot,
    `${rOk.status} ${JSON.stringify(rOkJ.watch ?? null)}`);
  if (rOkJ.watch?.id) await post(`/api/watches/${rOkJ.watch.id}/delete`, {});
  await post(`/api/slots/${okTgt.slot}/kill`, {});

  // === THE SELF TWIN: POST /api/self/watch =====================================================
  // Same mint (createWatchForSlot), different principal: `s` comes from the token instead of the
  // URL. The delivery machinery is therefore already proven by the owner half above and is not
  // re-run here — what is NOT shared, and is the whole subject of this block, is the auth binding
  // and the refusals. Its subscriber rule runs the OPPOSITE way to the four lane-only self routes
  // (drift/gate/criterion/verify-intent refuse a plain session 409; this one refuses a LANE 409),
  // and that asymmetry is exactly the kind of thing a later reader "simplifies" into a copy.
  {
    const cId = await freeSlot();
    const openC = cId ? await post(`/api/slots/${cId}/open`, { cwd: REPO }) : null;
    check("self-watch setup: a third plain slot is open to subscribe from", !!openC?.ok, `${cId} ${openC?.status}`);
    // The credential is read out of the PANE, not out of fleet.json, because "a session that was
    // actually handed the token" is the thing being tested — a state read would pass even if the
    // export never reached the pane. paneEnv is the deterministic probe (unique marker, anchored
    // match, send-keys retried); a hand-rolled send-keys + sleep + capture-pane is the flake shape
    // that harness function exists to have removed. null means the pane never answered, which is a
    // harness failure and fails here rather than being mistaken for an absent variable.
    const cTok = await paneEnv(`s${cId}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the plain subscriber's pane carries FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(cTok), `[${cTok}]`);
    const laneTok = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
    check("self-watch setup: the target lane's pane carries its own, different FLEET_SELF_TOKEN",
      /^[0-9a-f]{32}$/.test(laneTok) && laneTok !== cTok, `[${laneTok}]`);
    // peer lanes: peers[0] is a VALID target, so the LANE refusal below can only be about the
    // SUBSCRIBER — aimed at a non-lane it would 409 for the other reason and prove nothing. All
    // five together are what fills WATCH_MAX_PER_SLOT at the end of this block.
    const peers: { slot: number; branch: string }[] = [];
    for (let i = 0; i < 5; i++)
      peers.push((await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; branch: string });
    check("self-watch setup: five peer lanes exist (a valid target, and the cap's population)",
      peers.every((p) => p.slot > 0) && new Set(peers.map((p) => p.slot)).size === 5,
      JSON.stringify(peers.map((p) => p.slot)));

    // --- auth: the same three refusals every route in the self family carries. 401 and not 403,
    // because none of these is a recognized credential in the wrong scope — they are not this
    // route's credential at all. ---
    check("self-watch: the owner token does not substitute for a selfToken",
      (await fetch(`${BASE}/api/self/watch`, {
        method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ target: peers[0].slot }),
      })).status === 401);
    check("self-watch: an unknown selfToken is rejected",
      (await selfWatch("0".repeat(32), { target: peers[0].slot })).status === 401);
    check("self-watch: a missing selfToken header is rejected",
      (await selfWatch(null, { target: peers[0].slot })).status === 401);

    // --- THE NEW RIEGEL, and the reason this block exists. A lane's credential is RECOGNIZED and
    // the target is valid: the only thing that can refuse it is the subscriber rule. 409, never
    // 401 — same convention as the four routes that refuse in the other direction, because a 401
    // would send a session hunting for a token it already holds. ---
    const swLane = await selfWatch(laneTok, { target: peers[0].slot });
    const swLaneText = await swLane.text();
    check("a LANE calling /api/self/watch is refused 409 with its own reason — the mirror of the four lane-only routes",
      swLane.status === 409 && swLaneText.includes("a lane may not subscribe"),
      `${swLane.status} ${swLaneText}`);

    // --- the target refusals, re-asserted THROUGH the self path with their exact wording. Sharing
    // createWatchForSlot is what makes them identical today; pinning the strings is what stops a
    // future self-path-only branch from quietly answering something else. ---
    const idle = await freeSlot();
    check("self-watch setup: a genuinely inactive slot is available as a target", idle > 0, String(idle));
    // the ⚙ steward case borrows peers[4] rather than minting a seventh lane: the label is what the
    // check is about, and it is renamed back before the cap block uses that lane as a real target.
    check("self-watch setup: peers[4] is temporarily labelled ⚙ steward",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "⚙ steward" })).ok);
    const targetRejects: [string, unknown, number, string][] = [
      ["a nonexistent slot", { target: 999 }, 400, "bad target"],
      ["itself", { target: cId }, 400, "a session cannot watch itself"],
      ["an inactive slot", { target: idle }, 400, "target slot not active"],
      ["a non-lane slot", { target: aId }, 409, "target is not a lane — done-looking only classifies lanes"],
      ["a lane on a non-automatable harness", { target: naTgt.slot }, 409, "is not automatable"],
      ["the ⚙ steward", { target: peers[4].slot }, 409, "the ⚙ steward is never classified done-looking"],
    ];
    for (const [what, body, status, reason] of targetRejects) {
      const r = await selfWatch(cTok, body);
      const text = await r.text();
      check(`self-watch on ${what}: refused ${status} with the owner path's wording, verbatim`,
        r.status === status && text.includes(reason), `${r.status} ${text}`);
    }
    check("self-watch setup: peers[4]'s label is restored, so the cap block targets a real lane",
      (await post(`/api/slots/${peers[4].slot}/rename`, { label: "watch-peer" })).ok);
    await post(`/api/slots/${naTgt.slot}/kill`, {});

    // --- the binding, and the reason a pane-typing route can be handed to a session at all: the
    // RECEIVER is the token's slot. A `slot` field naming a different one is not validated and
    // rejected, it is structurally never read — createWatchForSlot takes `s` and never the body.
    //
    // EVERY subscription in this block points at a PEER lane, never at `tgt`, and that is not
    // arbitrary: `tgt` carries a commit, so it is on its way to done-looking and a watch on it
    // fires by itself within a tick or two. Firing disarms — which would silently turn the armed
    // count the cap checks below into 4, and the cap's refusal into a pass for the wrong reason.
    // The peers have no commits (ahead 0), so the predicate never classifies them and an armed
    // watch on one stays armed for as long as this block needs it to. ---
    const sw = await selfWatch(cTok, { target: peers[0].slot, idleSec: 3600, slot: aId });
    const swJ = (await sw.json()) as { ok?: boolean; watch?: WatchRow; existing?: boolean };
    check("POST /api/self/watch: a plain session subscribes with its OWN pane-exported token",
      sw.ok && swJ.watch?.armed === true && swJ.watch.target === peers[0].slot
      && swJ.watch.targetBranch === peers[0].branch, `${sw.status} ${JSON.stringify(swJ)}`);
    check("new Self-route Watches persist the receiver occupant openedAt at the shared creation seam",
      swJ.watch?.slotOpenedAt === persistedOpenedAt(cId) && (swJ.watch?.slotOpenedAt ?? 0) > 0,
      `${swJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(cId)}`);
    check("a spoofed `slot` field is ignored — the watch lands on the TOKEN's slot, not the named one",
      swJ.watch?.slot === cId, `landed on ${swJ.watch?.slot}; token slot ${cId}, spoofed ${aId}`);
    const swDup = (await (await selfWatch(cTok, { target: peers[0].slot })).json()) as
      { watch?: WatchRow; existing?: boolean };
    check("self-watch is idempotent too — re-subscribing returns the SAME watch, not a second",
      swDup.existing === true && swDup.watch?.id === swJ.watch?.id
      && (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 1,
      `${swDup.watch?.id} vs ${swJ.watch?.id}`);

    // --- GET /api/self names them next to the autos: the read half of the same credential. Spent
    // rows are served too, and that is load-bearing — a watch disarmed because its target died
    // delivers NOTHING into the pane, so armed-only would make "still waiting" and "will never
    // come" indistinguishable from inside the session, the one belief this surface exists to make
    // impossible. Proven at the end of this block, after the peers are killed. ---
    const selfRow = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { slot: number; watches?: WatchRow[]; autos?: unknown[]; events?: FleetEventRow[] };
    check("GET /api/self serves the session its OWN watches and typed events beside its autos",
      Array.isArray(selfRow.watches) && Array.isArray(selfRow.autos) && Array.isArray(selfRow.events)
      && selfRow.watches.some((w) => w.id === swJ.watch?.id)
      && selfRow.watches.every((w) => w.slot === cId)
      && selfRow.events.every((e) => e.receiverSlot === cId),
      JSON.stringify(selfRow.watches?.map((w) => `${w.slot}:${w.id}`)));

    // --- the cap. WATCH_MAX_PER_SLOT is shared, not re-implemented per principal, and this is what
    // proves the self path did not route around it: peers[0] is already armed, peers[1..4] fill it
    // to five, and a SIXTH distinct valid target — `tgt`, a real lane — is refused. The cap is the
    // LAST check createWatchForSlot makes, so every earlier reason has to be excluded for the
    // refusal to mean anything; that is why these are five live lanes and not five cheap bad ids. ---
    // named by ordinal for the same reason as V1b above: the slot id is not the check's identity
    for (const [i, p] of peers.slice(1).entries()) {
      const r = await selfWatch(cTok, { target: p.slot, idleSec: 3600 });
      check(`self-watch fills the cap: subscribing to peer lane #${i + 1}`, r.ok, `slot=${p.slot} ${r.status} ${await r.text()}`);
    }
    const capped = await selfWatch(cTok, { target: tgt.slot, idleSec: 3600 });
    const cappedText = await capped.text();
    check("WATCH_MAX_PER_SLOT applies on the self path exactly as on the owner's — the sixth is refused",
      capped.status === 400 && cappedText.includes("max 5 active watches per slot"),
      `${capped.status} ${cappedText}`);
    check("the cap counted armed watches, and the refusal minted nothing",
      (await watchRows()).filter((w) => w.slot === cId && w.armed).length === 5,
      JSON.stringify((await watchRows()).filter((w) => w.slot === cId).map((w) => `${w.target}:${w.armed}`)));

    // the peers go away while all five watches are armed: each disarms WITH its reason, and the
    // self row is where the subscribing session can still read that — the check the comment above
    // promised. Nothing was typed into its pane about any of them.
    for (const p of peers) await post(`/api/slots/${p.slot}/kill`, {});
    const after = await (await fetch(`${BASE}/api/self`, { headers: { "x-fleet-self-token": cTok } })).json() as
      { watches?: WatchRow[] };
    const dead = (after.watches ?? []).filter((w) => !w.armed);
    check("a session reads its own DISARMED watches too — 'will never come' is legible, not a silent gap",
      dead.length === 5 && dead.every((w) => (w.lastResult ?? "").includes("target session ended")),
      JSON.stringify(dead.map((w) => `${w.target}:${w.lastResult}`)));
    check("and nothing was ever typed into the subscriber's pane — no watch here ever fired",
      !(await plogRead()).some((e) => e.slot === cId && e.text.startsWith("[fleet] slot ")));
    await post(`/api/slots/${cId}/kill`, {});
  }

  // --- the subscription itself ---
  const wA = await post(`/api/slots/${aId}/watch`, { target: tgt.slot, idleSec: 0 });
  const wAJ = (await wA.json()) as { watch: WatchRow };
  check("subscribe: a plain slot may watch a lane", wA.ok && !!wAJ.watch?.id && wAJ.watch.armed === true,
    JSON.stringify(wAJ).slice(0, 160));
  check("new owner-route Watches persist the receiver occupant openedAt at the shared creation seam",
    wAJ.watch?.slotOpenedAt === persistedOpenedAt(aId) && (wAJ.watch?.slotOpenedAt ?? 0) > 0,
    `${wAJ.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  check("the watch pins the target's BRANCH, not just its recycled slot id",
    wAJ.watch?.targetBranch === tgt.branch, `${wAJ.watch?.targetBranch} vs ${tgt.branch}`);
  // a second subscribe is the same subscription, not a second one: two watches would deliver the
  // same news twice into one pane. THREE claims, three checks, each printing what it read — as one
  // conjunction with an id-pair detail, half its sightings were red with two EQUAL ids and said
  // nothing (docs/verify-tiering.md §11.2r). The row count is scoped to THIS receiver occupant and
  // THIS target, armed or spent: `tgt` carries a commit, so the tick may legitimately spend wA
  // between these calls (that is the race §11.2r names), and an armed-only count over the whole
  // slot read that fire as a missing watch while a spent TWIN would have slipped past it.
  const wDup = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot })).json()) as
    { watch: WatchRow; existing?: boolean };
  const dupRows = (await watchRows()).filter((w) => w.slot === aId && w.target === tgt.slot
    && w.targetBranch === tgt.branch && w.slotOpenedAt === wAJ.watch.slotOpenedAt);
  check("re-subscribing to the same target returns the SAME watch, never a second: answered existing:true",
    wDup.existing === true, `existing=${wDup.existing} armed=${wDup.watch?.armed} firedAt=${wDup.watch?.firedAt}`);
  check("re-subscribing to the same target returns the SAME watch, never a second: the same id",
    wDup.watch?.id === wAJ.watch.id, `${wDup.watch?.id} vs ${wAJ.watch.id}`);
  check("re-subscribing to the same target returns the SAME watch, never a second: one row for this receiver and target",
    dupRows.length === 1, JSON.stringify(dupRows.map((w) => `${w.id}:armed=${w.armed}:firedAt=${w.firedAt}`)));

  // the busy receiver: same target, but its pane is loud and the gate is two seconds. The wait for
  // lastOutput>0 is what makes this a test of the BUSY gate rather than a race with it: until
  // poll() has seen a first byte the field is 0, and `now - 0` is ~1.79e12 ms — the arithmetic
  // that made this very check fail on the first run by handing the message to a pane that had
  // produced nothing yet (server.ts, THE UNOBSERVED-PANE HOLE).
  let observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    // the probe is RE-FIRED each round, not merely re-read, and that is the load-bearing half.
    // The `open` above restarted this pane's pipe, and ensureSlot sets quietUntil = now + 1500
    // when it does; poll() streams anything inside that window WITHOUT stamping lastOutput. One
    // send therefore renders on the pane and still leaves the field at 0 — after which a
    // read-only loop spins for its full 15 s against a pane that never prints again. Measured
    // that way twice on the same tree, deterministically, not as a flake: this slot is recycled
    // out of the stalled block just above, so the send always lands inside a fresh window.
    // Same mechanism as docs/verify-tiering.md §11.2c, which is where the family is recorded.
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-busy-marker", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("watch setup: the busy receiver's pane has actually been observed (lastOutput>0)",
    observed > 0, String(observed));
  const wB = (await (await post(`/api/slots/${bId}/watch`, { target: tgt.slot, idleSec: 2 })).json()) as
    { watch: WatchRow };
  check("subscribe: a busy receiver may also watch the same lane", !!wB.watch?.id, JSON.stringify(wB).slice(0, 120));

  // --- signal -> event. Keep B loud until BOTH events exist. Event creation is independent of
  // receiver availability, so A may be delivered while B must remain pending. ---
  let eventA: FleetEventRow | undefined;
  let eventB: FleetEventRow | undefined;
  for (let i = 0; i < 180 && !(eventA?.status === "delivered" && eventB?.status === "pending"); i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-still-busy", "Enter");
    await Bun.sleep(250);
    eventA = await eventForWatch(wAJ.watch.id);
    eventB = await eventForWatch(wB.watch.id);
  }
  // --- AND KEEP IT LOUD. The loop above ends at the FIRST sighting of `pending`, but eventB carries
  // receiverIdleSec 2 and the transport tick hands it over after any two quiet seconds — so from
  // here to the restart boundary ~350 lines below the precondition "B is busy" was inherited from
  // however long the unrelated work in between happened to take, never controlled. Measured
  // (docs/verify-tiering.md §11.2l): red on 13 distinct trees, every red at a stretch >= 3.5 s, and
  // `1748417` pushed the median across the gate by inserting the job-watch block into that stretch.
  // The fixture now produces the busy-ness it asserts, on the SAME send-keys cadence as the loop
  // above, and stops only after the restart checks have read the pending row — the block at "The
  // pending event survived" then re-opens the gate deliberately and proves the later delivery. ---
  let busyKeeperOn = true;
  const busyKeeper = (async (): Promise<void> => {
    while (busyKeeperOn) {
      try { await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-still-busy", "Enter"); } catch { /* pane may be mid-restart */ }
      await Bun.sleep(250);
    }
  })();
  check("one signal creates exactly one durable event even for a busy receiver",
    eventB?.status === "pending" && eventB.attempts === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));
  const fired = await watchRow(wAJ.watch.id);
  const busySpent = await watchRow(wB.watch.id);
  check("signal capture spends both Watches before transport; the free receiver's event is delivered, not acked",
    fired?.armed === false && busySpent?.armed === false
    && eventA?.status === "delivered" && eventA.attempts === 1 && eventA.acknowledgedAt === null,
    JSON.stringify({ fired, busySpent, eventA }));
  check("owner visibility exposes the typed event array independently of the Watch rows",
    (await eventRows()).some((e) => e.id === eventA?.id)
    && (await eventRows()).some((e) => e.id === eventB?.id));

  // --- WHAT IT SAID. Asserted against the prompt log, which stores the text verbatim, not against
  // capture-pane (a ~450-char line wraps at the pane width and would make the assertion a test of
  // tmux's reflow). The pane itself is checked separately, on a substring that starts a line. ---
  const msgs = await ownerWatchMessages(aId);
  check("the notification reached the pane exactly once", msgs.length === 1,
    `${msgs.length}: ${msgs.map((m) => m.text.slice(0, 40)).join(" | ")}`);
  const msg = msgs[0]?.text ?? "";
  check("the message names the target slot AND its branch",
    msg.includes(`slot ${tgt.slot} (${tgt.branch})`), msg.slice(0, 120));
  check("the message carries the facts the predicate fired on (ahead/dirty)",
    msg.includes("1 ahead / 0 dirty"), msg.slice(0, 200));
  check("the message says LOOKS done, and says why that is not 'is done'",
    msg.includes("LOOKS done") && !/\bis done\b/.test(msg)
    && msg.includes("NOT a report from that lane") && msg.includes("never land on this message alone")
    && msg.includes(`[event ${eventA?.id}]`)
    && msg.includes(`POST /api/self/events/${eventA?.id}/ack`),
    msg.slice(0, 260));
  const capA = await tmuxOut("capture-pane", "-t", `s${aId}`, "-p");
  check("the notification is really in the receiving pane, not just the log",
    capA.out.includes("[fleet] slot "), capA.out.slice(-200));

  // --- THE §11.2r RACE, PROVOKED INSTEAD OF WAITED FOR. The re-subscribe above races the tick that
  // spends wA; here wA has fired for certain (eventA exists) and `tgt` has not printed since, so
  // this is the losing side of that race, every run. Before the fix the armed-only dedup minted a
  // second watch that fired at once and typed the same lane end into this pane again. ---
  const tgtLastOutput = async (): Promise<number> =>
    ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === tgt.slot)?.lastOutput ?? 0;
  const spentA = await watchRow(wAJ.watch.id);
  const quietSince = await tgtLastOutput();
  const openEventA = await eventForWatch(wAJ.watch.id);
  // unacknowledged is part of the condition: an Ack closes the news, and a subscription after it is
  // a new question the lane-word block below re-asks on purpose
  check("replay setup: wA is spent, its event unacknowledged, and the target has printed nothing since it fired",
    spentA?.armed === false && spentA.firedAt !== null && quietSince > 0 && quietSince <= spentA.firedAt
    && !!openEventA && openEventA.acknowledgedAt === null,
    `armed=${spentA?.armed} firedAt=${spentA?.firedAt} lastOutput=${quietSince} event=${openEventA?.status}`);
  const wReplay = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot })).json()) as
    { watch?: WatchRow; existing?: boolean };
  const replayRows = (await watchRows()).filter((w) => w.slot === aId && w.target === tgt.slot
    && w.targetBranch === tgt.branch && w.slotOpenedAt === wAJ.watch.slotOpenedAt);
  check("a re-subscribe after the fire, same lane end, returns the SPENT watch as existing — no second watch",
    wReplay.existing === true && wReplay.watch?.id === wAJ.watch.id && wReplay.watch?.armed === false
    && replayRows.length === 1,
    `existing=${wReplay.existing} ${wReplay.watch?.id} vs ${wAJ.watch.id} rows=${JSON.stringify(replayRows.map((w) => `${w.id}:${w.armed}`))}`);
  // GEGENPROBE: the dedup must not swallow a NEW question. Once `tgt` prints after the fire, that
  // lane end is over; kept loud, it cannot look done again, so a subscribe mints a fresh watch that
  // cannot fire, and deleting it leaves no spent row to shift this receiver's retention.
  let tgtKeeperOn = true;
  const tgtKeeper = (async (): Promise<void> => {
    while (tgtKeeperOn) {
      try { await tmuxOut("send-keys", "-t", `s${tgt.slot}`, "echo watch-new-work", "Enter"); } catch { /* best effort */ }
      await Bun.sleep(250);
    }
  })();
  let newWork = 0;
  for (let i = 0; i < 60 && !(newWork > (spentA?.firedAt ?? Infinity)); i++) {
    await Bun.sleep(250);
    newWork = await tgtLastOutput();
  }
  const wNew = (await (await post(`/api/slots/${aId}/watch`, { target: tgt.slot, idleSec: 3600 })).json()) as
    { watch?: WatchRow; existing?: boolean };
  const delNew = wNew.watch?.id && wNew.watch.id !== wAJ.watch.id
    ? await post(`/api/watches/${wNew.watch.id}/delete`, {}) : null;
  tgtKeeperOn = false;
  await tgtKeeper;
  check("replay setup: the target printed after the fire",
    newWork > (spentA?.firedAt ?? Infinity), `lastOutput=${newWork} firedAt=${spentA?.firedAt}`);
  check("GEGENPROBE: after new output the same subscribe is a NEW watch, not the spent one",
    wNew.existing !== true && !!wNew.watch?.id && wNew.watch.id !== wAJ.watch.id && wNew.watch.armed === true
    && delNew?.ok === true,
    `existing=${wNew.existing} ${wNew.watch?.id} vs ${wAJ.watch.id} armed=${wNew.watch?.armed} delete=${delNew?.status}`);

  check("busy transport owes the already-created event without typing or minting another",
    eventB?.status === "pending" && (await ownerWatchMessages(bId)).length === 0
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(eventB));

  // --- Ack is a session-bound act. Foreign slot and unknown id fail before the right principal
  // acknowledges; the identical second Ack returns the same terminal fact. ---
  const foreignAck = eventA ? await ackEvent(bTok, eventA.id) : new Response(null, { status: 599 });
  check("a foreign Self principal cannot acknowledge another slot's event",
    foreignAck.status === 409 && (await eventForWatch(wAJ.watch.id))?.status === "delivered",
    `${foreignAck.status} ${await foreignAck.text()}`);
  const falseAck = await ackEvent(aTok, "doesnotexist");
  check("an unknown event id is 4xx and changes no real event", falseAck.status === 404
    && (await eventForWatch(wAJ.watch.id))?.status === "delivered", String(falseAck.status));
  const ackA = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackAJ = await ackA.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  const ackA2 = eventA ? await ackEvent(aTok, eventA.id) : new Response(null, { status: 599 });
  const ackA2J = await ackA2.json() as { ok?: boolean; existing?: boolean; event?: FleetEventRow };
  check("the bound Self principal acknowledges delivered -> acknowledged, idempotently",
    ackA.ok && ackAJ.existing === false && ackAJ.event?.status === "acknowledged"
    && ackA2.ok && ackA2J.existing === true && ackA2J.event?.acknowledgedAt === ackAJ.event.acknowledgedAt,
    JSON.stringify({ ackAJ, ackA2J }));

  // --- THE LANE'S OWN WORD, both directions on ONE lane. Measured 2026-09-12 (Program-MAIN slot 6):
  // three of four lane-ready deliveries reached a lane still waiting on background verification, and
  // only the honest one had filed its fleet-report. First fire: committed, no report → the text must
  // say PREMATURE. The lane then files its report (receiver evidence = the spent watch) and a second
  // subscription fires on the unchanged predicate → the text must name that report. Same lane, same
  // git facts: only the word moved, so only the word can have moved the text. ---
  {
    const rcv = await freeSlot();
    const rcvOpen = rcv ? await post(`/api/slots/${rcv}/open`, { cwd: REPO }) : null;
    const rcvTok = rcv ? await paneEnv(`s${rcv}`, "FLEET_SELF_TOKEN") ?? "" : "";
    const wl = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string; branch: string };
    await Bun.write(`${wl.cwd}/watch-word.txt`, "the work whose report the watcher cannot see\n");
    spawnSync("git", ["-C", wl.cwd, "add", "watch-word.txt"]);
    spawnSync("git", ["-C", wl.cwd, "commit", "-qm", "watch word lane work"]);
    const wlTok = await paneEnv(`s${wl.slot}`, "FLEET_SELF_TOKEN") ?? "";
    // fails as ITSELF: without a live receiver, a committed lane and both credentials neither
    // direction below measured anything
    check("lane-word fixture: a receiver, a committed lane and both scoped credentials exist",
      !!rcvOpen?.ok && wl.slot > 0 && wl.slot !== rcv && /^[0-9a-f]{32}$/.test(rcvTok)
        && /^[0-9a-f]{32}$/.test(wlTok) && rcvTok !== wlTok,
      JSON.stringify({ rcv, open: rcvOpen?.status, lane: wl.slot }));
    const wordLogStart = (await plogRead()).length;
    const wordMessages = async () => (await plogRead()).slice(wordLogStart)
      .filter((e) => e.slot === rcv && e.text.startsWith(`[fleet] slot ${wl.slot} `));
    const deliveredFor = async (watchId: string): Promise<FleetEventRow | undefined> => {
      let ev: FleetEventRow | undefined;
      for (let i = 0; i < 180 && ev?.status !== "delivered"; i++) {
        await Bun.sleep(250);
        ev = await eventForWatch(watchId);
      }
      return ev;
    };

    const w1 = (await (await post(`/api/slots/${rcv}/watch`, { target: wl.slot, idleSec: 0 })).json()) as
      { watch?: WatchRow };
    const ev1 = w1.watch ? await deliveredFor(w1.watch.id) : undefined;
    const msg1 = (await wordMessages())[0]?.text ?? "";
    check("lane-word: a committed lane WITHOUT a terminal report is delivered as PREMATURE",
      ev1?.kind === "lane-ready" && ev1.status === "delivered"
        && msg1.includes("Terminal report from that lane: NONE on file") && msg1.includes("PREMATURE")
        && msg1.includes("never land on this message alone"),
      `${ev1?.status} ${msg1.slice(0, 600)}`);
    if (ev1) await ackEvent(rcvTok, ev1.id);

    const filed = await selfFleetReport(wlTok, { status: "complete", text: "lane-word probe: done and verified" });
    const filedJ = (await filed.json()) as { report?: FleetReportRow };
    check("lane-word fixture: the lane files its terminal report to the watching receiver",
      filed.ok && !!filedJ.report?.id && filedJ.report.receiver?.slot === rcv,
      `${filed.status} ${JSON.stringify(filedJ).slice(0, 200)}`);

    const w2 = (await (await post(`/api/slots/${rcv}/watch`, { target: wl.slot, idleSec: 0 })).json()) as
      { watch?: WatchRow; existing?: boolean };
    const ev2 = w2.watch && w2.watch.id !== w1.watch?.id ? await deliveredFor(w2.watch.id) : undefined;
    const msg2 = (await wordMessages())[1]?.text ?? "";
    check("lane-word: the SAME lane WITH its terminal report is delivered naming that report, not as premature",
      ev2?.kind === "lane-ready" && ev2.status === "delivered"
        && msg2.includes(`Terminal report from that lane: ${filedJ.report?.id} (status=complete) is on file`)
        && !msg2.includes("PREMATURE") && !msg2.includes("NONE on file")
        && msg2.includes("never land on this message alone"),
      `${ev2?.status} ${msg2.slice(0, 600)}`);
    if (ev2) await ackEvent(rcvTok, ev2.id);
    await post(`/api/slots/${wl.slot}/kill`, {});
    await post(`/api/slots/${rcv}/kill`, {});
  }

  // --- DEPLOY OUTCOME: same subscription/event/transport/ack rail, joined only by deploy id. ---
  const deployLedger = `${ROOT}/deploys.jsonl`;
  const appendDeploy = (row: Record<string, unknown>): void =>
    appendFileSync(deployLedger, `${JSON.stringify(row)}\n`, { mode: 0o600 });
  const deployRow = (id: string, ok: boolean | null, stage: "build" | "restart" | "boot",
    extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    at: Date.now(), id, by: "owner", stage, ok,
    target: "1".repeat(40), bootHead: ok === null ? null : "1".repeat(40), head: "1".repeat(40),
    hitTarget: ok === null ? null : ok, bundleStale: ok === null ? null : !ok, ...extra,
  });
  const malformedDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "NOT-HEX" });
  check("deploy watch: malformed deployId is refused 400 with a named field error",
    malformedDeployId.status === 400 && (await malformedDeployId.text()).includes("deployId must be exactly 8"));
  const unknownDeployId = await selfWatch(aTok, { kind: "deploy", deployId: "deadbeef" });
  const unknownDeployText = await unknownDeployId.text();
  check("deploy watch: an unknown id is refused loudly because it could never fire",
    unknownDeployId.status === 409
      && unknownDeployText.includes("no in-flight or persisted deploy exists with that id — this watch could never fire"),
    `${unknownDeployId.status} ${unknownDeployText}`);

  const successId = "d0000001";
  appendDeploy(deployRow(successId, true, "boot", { hitTarget: true, bundleStale: false }));
  const successSubR = await selfWatch(aTok, { kind: "deploy", deployId: successId, idleSec: 0 });
  const successSub = await successSubR.json() as { watch?: DeployWatchRow };
  const successEvent = successSub.watch ? await waitDeployEvent(successSub.watch.id) : undefined;
  check("deploy watch: subscribing after a green row fires in the subscribe call with typed hitTarget",
    successSubR.ok && successSub.watch?.armed === false && successEvent?.payload.ok === true
      && successEvent.payload.hitTarget === true && successEvent.subjectDeployId === successId,
    JSON.stringify({ successSub, successEvent }));
  check("new non-lane-kind Watches also inherit slotOpenedAt from the one common creation seam",
    successSub.watch?.kind === "deploy" && successSub.watch.slotOpenedAt === persistedOpenedAt(aId)
      && (successSub.watch.slotOpenedAt ?? 0) > 0,
    `${successSub.watch?.slotOpenedAt} vs ${persistedOpenedAt(aId)}`);
  const successText = (await plogRead()).find((p) => p.slot === aId
    && p.text.includes(`[event ${successEvent?.id}]`))?.text ?? "";
  check("deploy watch: success rendering says ok=YES and names notification versus verdict",
    successText.includes("ok=YES") && successText.includes("not a claim that the deploy succeeded"), successText);
  const deployForeignAck = successEvent ? await ackEvent(bTok, successEvent.id) : new Response(null, { status: 599 });
  check("deploy event: a foreign receiver slot cannot acknowledge it",
    deployForeignAck.status === 409, `${deployForeignAck.status} ${await deployForeignAck.text()}`);
  const deployAck1 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2 = successEvent ? await ackEvent(aTok, successEvent.id) : new Response(null, { status: 599 });
  const deployAck2J = await deployAck2.json() as { existing?: boolean };
  check("deploy event: acknowledgement is idempotent in the bound receiver session",
    deployAck1.ok && deployAck2.ok && deployAck2J.existing === true,
    `${deployAck1.status}/${deployAck2.status} ${JSON.stringify(deployAck2J)}`);

  const failureId = "d0000002";
  appendDeploy(deployRow(failureId, false, "build", {
    bootHead: "0".repeat(40), hitTarget: false, bundleStale: true, reason: "build failed deterministically",
  }));
  const failureSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: failureId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const failureEvent = failureSub.watch ? await waitDeployEvent(failureSub.watch.id) : undefined;
  const failureText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${failureEvent?.id}]`))?.text ?? "";
  check("deploy watch: failed row stays ok=false with bounded reason and never renders as success",
    failureEvent?.payload.ok === false && failureEvent.payload.reason === "build failed deterministically"
      && failureText.includes("ok=NO") && failureText.includes("Reason: build failed deterministically")
      && !failureText.includes("ok=YES"), JSON.stringify({ event: failureEvent, text: failureText }));
  if (failureEvent) await ackEvent(bTok, failureEvent.id);

  const unknownId = "d0000003";
  appendDeploy(deployRow(unknownId, null, "boot", { reason: "the boot head could not be measured" }));
  const unknownSub = await (await selfWatch(bTok,
    { kind: "deploy", deployId: unknownId, idleSec: 0 })).json() as { watch?: DeployWatchRow };
  const unknownEvent = unknownSub.watch ? await waitDeployEvent(unknownSub.watch.id) : undefined;
  const unknownText = (await plogRead()).find((p) => p.slot === bId
    && p.text.includes(`[event ${unknownEvent?.id}]`))?.text ?? "";
  check("deploy watch: unmeasured row stays ok=null and renders UNVERIFIED, never pass",
    unknownEvent?.payload.ok === null && unknownText.includes("ok=UNVERIFIED")
      && !unknownText.includes("ok=YES"), JSON.stringify({ event: unknownEvent, text: unknownText }));
  if (unknownEvent) await ackEvent(bTok, unknownEvent.id);

  const inflightId = "d0000004";
  writeFileSync(`${ROOT}/deploy-inflight.json`, JSON.stringify({
    id: inflightId, at: Date.now(), by: "owner", target: "2".repeat(40), bootHeadBefore: "1".repeat(40),
    buildMs: 1, buildCmd: "true", restartCmd: "true",
  }), { mode: 0o600 });
  const inflightSubR = await selfWatch(aTok, { kind: "deploy", deployId: inflightId, idleSec: 0 });
  const inflightSub = await inflightSubR.json() as { watch?: DeployWatchRow };
  const inflightDup = await (await selfWatch(aTok,
    { kind: "deploy", deployId: inflightId, idleSec: 0 })).json() as { watch?: DeployWatchRow; existing?: boolean };
  check("deploy watch: an in-flight marker admits one armed subscription and duplicate returns existing",
    inflightSubR.ok && inflightSub.watch?.armed === true && inflightDup.existing === true
      && inflightDup.watch?.id === inflightSub.watch?.id
      && (await deployWatchRows()).filter((w) => w.slot === aId && w.deployId === inflightId).length === 1,
    JSON.stringify({ inflightSub, inflightDup }));
  appendDeploy(deployRow(inflightId, false, "restart", {
    bootHead: "1".repeat(40), hitTarget: false, bundleStale: false, reason: "restart failed",
  }));
  rmSync(`${ROOT}/deploy-inflight.json`, { force: true });
  const inflightEvent = inflightSub.watch ? await waitDeployEvent(inflightSub.watch.id) : undefined;
  check("deploy watch: a row appearing after subscribe is level-minted exactly once by the tick",
    inflightEvent?.payload.ok === false && inflightEvent.payload.stage === "restart"
      && (await deployEventRows()).filter((e) => e.watchId === inflightSub.watch?.id).length === 1,
    JSON.stringify(inflightEvent));
  if (inflightEvent) await ackEvent(aTok, inflightEvent.id);

  const laneDeployToken = await paneEnv(`s${tgt.slot}`, "FLEET_SELF_TOKEN") ?? "";
  const laneDeployWatch = await selfWatch(laneDeployToken, { kind: "deploy", deployId: successId });
  check("deploy watch: a lane remains refused 409 on the existing self-watch route",
    laneDeployWatch.status === 409 && (await laneDeployWatch.text()).includes("a lane may not subscribe"));

  // --- THE COMMAND JOB WATCH. Same subscription/event/transport/ack rail as the two kinds above,
  // joined by a JOB id rather than a slot or a deploy id — and driven here through the helper's own
  // HTTP routes rather than through the daemon, because what is under test is the WATCH, not the
  // other machine (the daemon's half is e2e/helper-daemon.ts). The device heartbeat carries a
  // `daemonSha` on purpose: without it the server does not offer a command job at all, which would
  // make every check below measure the handshake instead of the subscription. ---
  {
    const helperTok = ((await (await get("/api/helper/token")).json()) as { token?: string }).token ?? "";
    const HH = { "x-fleet-helper-token": helperTok, "content-type": "application/json" };
    const hpost = (path: string, body: unknown): Promise<Response> =>
      fetch(`${BASE}${path}`, { method: "POST", headers: HH, body: JSON.stringify(body) });
    const CMDDEV = "watchcmdbox01";
    // A REAL sha, and it has to be: the claim does not merely count `daemonSha`, it measures the
    // vintage it names (server.ts#daemonKnowsCommandKind) against FLEET_HELPER_CMD_FLOOR_SHA in the
    // daemon-update repo. This instance's floor IS this instance's own checkout HEAD
    // (e2e-isolated.sh), so HEAD is the sha that passes — a made-up 40-hex one is refused as
    // unmeasurable, and every check below would then be reading the handshake instead of the watch.
    const instanceHead = spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"]).stdout.toString().trim();
    const beat = await hpost("/api/helper/device",
      { deviceId: CMDDEV, name: "cmd box (e2e)", daemonSha: instanceHead });
    check("job watch setup: a device that names its own daemonSha — a real one, at this instance's vintage floor — is enrolled",
      beat.ok && /^[0-9a-f]{40}$/.test(instanceHead), `${beat.status} sha=${instanceHead.slice(0, 8)}`);
    const selfPost = (tok: string, path: string, body: unknown): Promise<Response> =>
      fetch(`${BASE}${path}`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": tok }, body: JSON.stringify(body) });

    const badKind = await selfWatch(aTok, { kind: "job", target: "NOTHEX" });
    check("job watch: a target that is not a 12-hex job id is refused 400 with a named field error",
      badKind.status === 400 && (await badKind.text()).includes("target must be a 12-character command job id"),
      `${badKind.status}`);
    const unknownJob = await selfWatch(aTok, { kind: "job", target: "ffffffffffff" });
    const unknownJobText = await unknownJob.text();
    check("job watch: an id this fleet never offered is refused 409 because it could never fire",
      unknownJob.status === 409 && unknownJobText.includes("no such command job"),
      `${unknownJob.status} ${unknownJobText}`);

    const badCmd = await selfPost(aTok, "/api/self/jobs", { cmd: "codex exec" });
    // The refusal binds the COMMAND STRING and nothing further: an allowlisted `bun run build`
    // still runs the submitted bundle's own `package.json` script. This check measures the string
    // door, which is the only thing it can measure.
    check("job door: a cmd naming an agent harness is refused 400 before the allowlist is consulted",
      badCmd.status === 400 && (await badCmd.text()).includes("codex"), `${badCmd.status}`);
    const madeR = await selfPost(aTok, "/api/self/jobs",
      { cmd: "bun run build", artifacts: ["dist/*.js"] });
    const made = (await madeR.json()) as { jobId?: string; job?: { state?: string; argv?: string[] } };
    const jobId = made.jobId ?? "";
    check("job door: a plain session hands over its own tree with an allowlisted cmd and gets a job id",
      madeR.ok && /^[0-9a-f]{12}$/.test(jobId) && made.job?.state === "open"
        && JSON.stringify(made.job.argv) === '["bun","run","build"]',
      `${madeR.status} ${JSON.stringify(made)}`);

    const subR = await selfWatch(aTok, { kind: "job", target: jobId, idleSec: 0 });
    const sub = await subR.json() as { watch?: { id: string; kind?: string; armed: boolean } };
    check("job watch: subscribing to an OPEN job is accepted and stays armed — there is no verdict yet",
      subR.ok && sub.watch?.kind === "job" && sub.watch.armed === true, JSON.stringify(sub));
    const dupR = await selfWatch(aTok, { kind: "job", target: jobId, idleSec: 0 });
    const dup = await dupR.json() as { watch?: { id: string }; existing?: boolean };
    check("job watch: a second subscription to the same job returns the first, never a rival",
      dupR.ok && dup.existing === true && dup.watch?.id === sub.watch?.id, JSON.stringify(dup));

    // THE HANDSHAKE REFUSAL, MEASURED ON AN UNCLAIMED JOB AND ON ITS OWN TERMS. Asking after the
    // claim below would have been answered by the already-claimed 409 instead — the same status for
    // a different reason, which is a green that measures nothing. So it gets its own job, and the
    // assertion reads the REASON, not the number.
    const noShaJobR = await selfPost(aTok, "/api/self/jobs", { cmd: "bun test" });
    const noShaJobId = ((await noShaJobR.json()) as { jobId?: string }).jobId ?? "";
    const noSha = await hpost("/api/helper/claim", { jobId: noShaJobId, deviceId: "watchnoshabox1" });
    const noShaText = await noSha.text();
    check("job claim: a device that never named a daemonSha is refused 409 ON THAT GROUND even with an unclaimed id in hand",
      noSha.status === 409 && noShaText.includes("daemonSha"), `${noSha.status} ${noShaText}`);

    const claimed = await hpost("/api/helper/claim", { jobId, deviceId: CMDDEV });
    const claimBody = (await claimed.json()) as { job?: { kind?: string; cmd?: string; argv?: string[];
      timeoutMs?: number; artifacts?: string[]; branch?: string } };
    check("job claim: the claim carries cmd, argv, timeoutMs and the artefact globs — the daemon needs no parser",
      claimed.ok && claimBody.job?.kind === "command" && claimBody.job.cmd === "bun run build"
        && JSON.stringify(claimBody.job.argv) === '["bun","run","build"]'
        && typeof claimBody.job.timeoutMs === "number"
        && JSON.stringify(claimBody.job.artifacts) === '["dist/*.js"]'
        && (claimBody.job.branch ?? "").startsWith("fleet-suite/"),
      `${claimed.status} ${JSON.stringify(claimBody)}`);
    const badArt = await hpost("/api/helper/result",
      { jobId, exitCode: 0, tail: "x", artifacts: [{ path: "../escape", sha256: "b".repeat(64), bytes: 1 }] });
    check("job result: an artefact path that climbs out of the clone is refused 400, and the claim survives it",
      badArt.status === 400 && (await badArt.text()).includes("relative path"), `${badArt.status}`);
    const reported = await hpost("/api/helper/result", { jobId, exitCode: 0, tail: "built ok",
      clonedSha: "c".repeat(40),
      artifacts: [{ path: "dist/app.js", sha256: "d".repeat(64), bytes: 42 }] });
    check("job result: the same claim then accepts a well-formed receipt and classifies exit 0 as green",
      reported.ok && ((await reported.json()) as { result?: string }).result === "green", `${reported.status}`);

    const waitJobEvent = async (watchId: string): Promise<Record<string, unknown> | undefined> => {
      for (let i = 0; i < 80; i++) {
        const rows = ((await (await get("/api/events")).json()) as
          { events: Record<string, unknown>[] }).events.filter((e) => e.watchId === watchId);
        if (rows.length) return rows[0];
        await Bun.sleep(250);
      }
      return undefined;
    };
    const ev = sub.watch ? await waitJobEvent(sub.watch.id) : undefined;
    const evPayload = (ev?.payload ?? {}) as { result?: string; cmd?: string; exitCode?: number | null;
      artifacts?: { path: string; sha256: string; bytes: number }[] };
    const evCount = ((await (await get("/api/events")).json()) as
      { events: Record<string, unknown>[] }).events.filter((e) => e.watchId === sub.watch?.id).length;
    check("job watch: the verdict fires EXACTLY ONCE, with the command, the exit code and the artefact rows",
      !!ev && ev.kind === "command-job" && ev.subjectJobId === jobId && evCount === 1
        && evPayload.result === "green" && evPayload.cmd === "bun run build" && evPayload.exitCode === 0
        && evPayload.artifacts?.[0]?.path === "dist/app.js" && evPayload.artifacts[0].bytes === 42,
      `${evCount} event(s) ${JSON.stringify(ev)}`);
    // POLLED, not read once: minting and DELIVERY are two ticks, and the event above is asserted
    // while it is still `pending`. Reading the journal in the same breath measured the transport's
    // latency, not the message — the probe failed as the property it was aiming at (2026-09-02).
    const waitPaneText = async (eventId: string): Promise<string> => {
      for (let i = 0; i < 120; i++) {
        const hit = (await plogRead()).find((p) => p.slot === aId && p.text.includes(`[event ${eventId}]`));
        if (hit) return hit.text;
        await Bun.sleep(250);
      }
      return "";
    };
    const evText = ev ? await waitPaneText(ev.id as string) : "";
    check("job watch: the pane text names the artefacts and says they were NOT uploaded",
      evText.includes("dist/app.js") && evText.includes("NOT uploaded")
        && evText.includes("result=green"), evText.slice(0, 260) || "(no pane text within 30s)");
    if (ev) await ackEvent(aTok, ev.id as string);

    // LEVEL-TRIGGERED, the property that separates this from an edge: a subscription made after the
    // verdict must fire from the persisted fact rather than wait for a second one that never comes.
    const lateR = await selfWatch(aTok, { kind: "job", target: jobId, idleSec: 0 });
    const late = await lateR.json() as { watch?: { id: string; armed: boolean } };
    const lateEvent = late.watch ? await waitJobEvent(late.watch.id) : undefined;
    check("job watch: subscribing AFTER the verdict fires inside the subscribe call itself",
      lateR.ok && late.watch?.armed === false && lateEvent?.kind === "command-job"
        && late.watch.id !== sub.watch?.id,
      `${JSON.stringify(late)} ${lateEvent?.id as string ?? "(no event)"}`);
    // ACKED FROM `delivered`, AND ASSERTED — the old line was `if (lateEvent) await ackEvent(...)`
    // with the response thrown away. `waitJobEvent` returns the row the moment it EXISTS, which for
    // a freshly minted event is `pending`, and an ack on a pending row is refused 409
    // (server.ts#acknowledgeFleetEvent). Whether this receiver ended the section with FIVE or SIX
    // terminal events was therefore decided by a transport tick, and the six-event outcome evicted
    // its oldest row under the per-receiver retention ceiling — the two durability checks ~350
    // lines below were red on exactly those runs (5/367 and 6/367,
    // docs/messungen/2026-09-08-watch-event-retention-51565db4.md).
    const lateId = (lateEvent?.id as string | undefined) ?? "";
    let lateRow: FleetEventRow | undefined;
    for (let i = 0; i < 120; i++) {
      lateRow = lateId ? (await eventRows()).find((e) => e.id === lateId) : undefined;
      if (lateRow?.status === "delivered") break;
      await Bun.sleep(250);
    }
    const lateAck = lateId ? await ackEvent(aTok, lateId) : new Response(null, { status: 599 });
    check("job watch: the late verdict's event is acknowledged FROM delivered, never silently refused while pending",
      lateRow?.status === "delivered" && lateAck.ok
        && (await eventRows()).find((e) => e.id === lateId)?.status === "acknowledged",
      `${lateRow?.status} -> ${lateAck.status} ${await lateAck.text()}`);

    const readBack = await fetch(`${BASE}/api/self/jobs/${jobId}`, { headers: { "x-fleet-self-token": aTok } });
    const readBody = (await readBack.json()) as { job?: { state?: string; result?: { result?: string } } };
    const foreign = await fetch(`${BASE}/api/self/jobs/${jobId}`, { headers: { "x-fleet-self-token": bTok } });
    check("job read: the offering session reads its own receipt; another session's token gets 404, not somebody else's work",
      readBack.ok && readBody.job?.state === "reported" && readBody.job.result?.result === "green"
        && foreign.status === 404,
      `${readBack.status}/${foreign.status} ${JSON.stringify(readBody.job?.result?.result)}`);
    const laneJobWatch = await selfWatch(laneDeployToken, { kind: "job", target: jobId });
    check("job watch: a lane stays refused 409 on the self-watch route — this slice added a kind, not a principal",
      laneJobWatch.status === 409 && (await laneJobWatch.text()).includes("a lane may not subscribe"),
      `${laneJobWatch.status}`);
  }

  // --- Restart boundary. Stop before editing state: a live save chain may replace fleet.json.
  // Plant the exact durable image a crash after the pre-send marker leaves, plus a legacy spent
  // Watch and malicious extra payload keys. Load must preserve uncertainty, invent no legacy event,
  // and rebuild the payload whitelist rather than retaining free text. ---
  await stopSrv();
  const statePath = `${ROOT}/fleet.json`;
  type EventState = { events?: unknown[]; watches?: unknown[] };
  let eventState: EventState | null = null;
  let eventStateError = "";
  try { eventState = JSON.parse(readFileSync(statePath, "utf8")) as EventState; }
  catch (e) { eventStateError = e instanceof Error ? e.message : String(e); }
  check("event restart fixture: fleet state is readable only after srv stopped", eventState !== null, eventStateError);
  const crashId = "crashboundaryfixture";
  const crashWatchId = "crashboundarywatch";
  const legacyWatchId = "legacywatchfixture";
  const malformedOpenedAtWatchId = "malformedopenedatwatch";
  const malformedMergeId = "malformedmergefixture";
  const malformedDeployEventId = "malformeddeployfixture";
  const crashRaw = eventA ? {
    ...eventA, id: crashId, watchId: crashWatchId, status: "send-uncertain", attempts: 1,
    deliveredAt: null, acknowledgedAt: null,
    payload: { ...eventA.payload, text: "$(touch /tmp/must-not-run)", command: "echo unsafe" },
  } : null;
  eventState?.events?.push(crashRaw);
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedMergeId, watchId: "malformedmergewatch", kind: "merge-terminal",
    subjectCwd: tgt.cwd, payload: {
      status: "resolved", landed: false, branch: tgt.branch, at: Date.now(), verify: null,
    },
  });
  if (eventA) eventState?.events?.push({
    ...eventA, id: malformedDeployEventId, watchId: "malformeddeploywatch", kind: "deploy-terminal",
    subjectDeployId: successId, payload: {
      ok: null, stage: "boot", target: null, bootHead: null, hitTarget: null, bundleStale: null,
      at: Date.now(), reason: "x".repeat(201),
    },
  });
  eventState?.watches?.push({
    id: legacyWatchId, slot: aId, target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "sent",
  });
  eventState?.watches?.push({
    id: malformedOpenedAtWatchId, slot: aId, slotOpenedAt: "nope", target: tgt.slot, targetCwd: tgt.cwd,
    targetBranch: tgt.branch, idleSec: 0, armed: false, created: Date.now(),
    firedAt: Date.now(), lastResult: "malformed",
  });
  if (eventState) writeFileSync(statePath, JSON.stringify(eventState, null, 2), { mode: 0o600 });
  await restartSrv();

  const afterRestartEvents = await eventRows();
  const restartedA = afterRestartEvents.find((e) => e.id === eventA?.id);
  const restartedB = afterRestartEvents.find((e) => e.id === eventB?.id);
  const uncertain = afterRestartEvents.find((e) => e.id === crashId);
  check("restart keeps an acknowledged event terminal and never re-injects it",
    restartedA?.status === "acknowledged" && (await ownerWatchMessages(aId)).length === 1,
    JSON.stringify(restartedA));
  check("restart keeps the busy pending event with the same id and no invented attempt",
    restartedB?.status === "pending" && restartedB.id === eventB?.id && restartedB.attempts === 0
    && (await ownerWatchMessages(bId)).length === 0, JSON.stringify(restartedB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  const uncertainAfterTicks = (await eventRows()).find((e) => e.id === crashId);
  check("the send/crash boundary stays visibly uncertain across restart and is never replayed or called acked",
    uncertainAfterTicks?.status === "send-uncertain" && uncertainAfterTicks.attempts === 1
    && uncertainAfterTicks.deliveredAt === null && uncertainAfterTicks.acknowledgedAt === null
    && (await ownerWatchMessages(aId)).length === 1, JSON.stringify(uncertainAfterTicks));
  // the legacy half of the transport split: every row written before `delivery` existed — watch and
  // event alike — loads with the field ABSENT and keeps the exact pane path the checks above prove.
  // The inbox half is asserted across its own restart further down, once such a row exists.
  check("legacy round trip: rows written before the split load with delivery absent, not coerced to a default",
    (await watchRows()).some((w) => w.id === legacyWatchId && w.delivery === undefined)
      && afterRestartEvents.some((e) => e.id === eventA?.id && e.delivery === undefined)
      && uncertain?.delivery === undefined,
    JSON.stringify({ legacyWatch: (await watchRows()).find((w) => w.id === legacyWatchId)?.delivery,
      legacyEvent: restartedA?.delivery, crash: uncertain?.delivery }));
  check("legacy spent Watch loads unchanged without an invented FleetEvent",
    (await watchRows()).some((w) => w.id === legacyWatchId && w.lastResult === "sent"
      && w.slotOpenedAt === undefined)
    && !(await eventRows()).some((e) => e.watchId === legacyWatchId));
  check("Watch reload keeps missing slotOpenedAt as legacy but rejects a present malformed value fail-closed",
    !(await watchRows()).some((w) => w.id === malformedOpenedAtWatchId)
      && (await watchRows()).some((w) => w.id === legacyWatchId && w.slotOpenedAt === undefined),
    JSON.stringify((await watchRows()).filter((w) => w.id === legacyWatchId || w.id === malformedOpenedAtWatchId)));
  check("per-kind event loading rejects a malformed merge payload without breaking legacy event restore",
    !afterRestartEvents.some((e) => e.id === malformedMergeId) && restartedA?.id === eventA?.id,
    JSON.stringify(afterRestartEvents.filter((e) => e.id === malformedMergeId || e.id === eventA?.id)));
  check("per-kind event loading rejects a malformed deploy-terminal payload",
    !(await deployEventRows()).some((e) => e.id === malformedDeployEventId));
  const payloadKeys = Object.keys(uncertainAfterTicks?.payload ?? {}).sort();
  check("persisted FleetEvent payload is a closed typed fact set and cannot carry free shell/text content",
    JSON.stringify(payloadKeys) === JSON.stringify([
      "ahead", "awaiting", "dirty", "gitOp", "hostCommits", "idleMs", "observed",
    ]) && !JSON.stringify(uncertainAfterTicks?.payload).includes("must-not-run")
      && !JSON.stringify(uncertainAfterTicks?.payload).includes("command"), JSON.stringify(uncertainAfterTicks?.payload));
  const selfA = await (await selfGet(aTok)).json() as { events?: FleetEventRow[] };
  check("GET /api/self exposes only this exact receiver session's events, including uncertainty",
    selfA.events?.some((e) => e.id === crashId) === true
    && selfA.events.every((e) => e.receiverSlot === aId && e.receiverOpenedAt === uncertain?.receiverOpenedAt),
    JSON.stringify(selfA.events?.map((e) => `${e.id}:${e.status}`)));
  const resolveUncertain = await ackEvent(aTok, crashId);
  check("the bound session may explicitly resolve a possibly-seen send-uncertain event",
    resolveUncertain.ok && (await eventRows()).find((e) => e.id === crashId)?.status === "acknowledged",
    `${resolveUncertain.status} ${await resolveUncertain.text()}`);

  // THE RETENTION CEILING IS REAL, AND THIS FIXTURE SPENDS IT. Receiver aId has now been driven
  // through SIX terminal events — lane-ready eventA, two deploy-terminal rows, two command-job
  // rows, and the crash boundary the ack above just resolved — against a ceiling of five
  // (server.ts, FLEET_EVENT_KEEP_TERMINAL = WATCH_KEEP_SPENT). So that ack did two things: it
  // settled the sixth row AND, inside server.ts#settleFleetEventAcknowledged -> pruneFleetEvents,
  // evicted the OLDEST terminal row of this receiver, which is eventA. Measured directly on
  // 2026-09-08: `{"event":"fleet_event_ack",...}` and `{"event":"fleet_event_prune",...}` land in
  // audit.jsonl in the same millisecond for the same slot.
  //
  // It is pinned here rather than raced against, because until 2026-09-08 the two durability checks
  // below asserted eventA's SURVIVAL and passed only when the late job verdict's ack had been
  // silently refused — five terminal rows instead of six. Retention is per RECEIVER SLOT NUMBER,
  // not per occupant, and it drops by acknowledgedAt: the oldest goes, whatever it was proving.
  const EVENT_KEEP_TERMINAL = 5; // server.ts, FLEET_EVENT_KEEP_TERMINAL — a red here names the drift
  const terminalForA = (await eventRows()).filter((e) => e.receiverSlot === aId
    && FLEET_EVENT_TERMINAL.includes(e.status));
  check("per-receiver retention keeps exactly the newest five terminal events and evicts the oldest",
    terminalForA.length === EVENT_KEEP_TERMINAL && !terminalForA.some((e) => e.id === eventA?.id)
      && terminalForA.some((e) => e.id === crashId)
      && terminalForA.some((e) => e.id === successEvent?.id),
    JSON.stringify(terminalForA.map((e) => `${e.id}:${e.status}`)));

  // the engineered busy-ness ends HERE, and not one check earlier: everything above this line reads
  // the event while it must still be pending. What follows deliberately lets the pane fall quiet.
  busyKeeperOn = false;
  await busyKeeper;

  // --- The pending event survived. Re-observe B after restart, then let its two-second idle gate
  // elapse. The same event is delivered once; repeated ticks neither mint nor inject a twin. ---
  observed = 0;
  for (let i = 0; i < 60 && !observed; i++) {
    await tmuxOut("send-keys", "-t", `s${bId}`, "echo watch-after-restart", "Enter");
    await Bun.sleep(250);
    observed = ((await (await get("/api/sessions")).json()) as { slots: { id: number; lastOutput: number }[] })
      .slots.find((x) => x.id === bId)?.lastOutput ?? 0;
  }
  check("pending restart fixture: receiver output is observed before its idle gate is tested", observed > 0, String(observed));
  let deliveredB: FleetEventRow | undefined;
  for (let i = 0; i < 40 && deliveredB?.status !== "delivered"; i++) {
    await Bun.sleep(250);
    deliveredB = await eventForWatch(wB.watch.id);
  }
  check("busy -> later idle delivers the SAME pending event exactly once",
    deliveredB?.status === "delivered" && deliveredB.id === eventB?.id && deliveredB.attempts === 1
    && (await ownerWatchMessages(bId)).length === 1
    && (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1,
    JSON.stringify(deliveredB));
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  check("repeated ticks produce no duplicate event and no second pane injection",
    (await eventRows()).filter((e) => e.watchId === wB.watch.id).length === 1
    && (await ownerWatchMessages(bId)).length === 1);

  // A dead/replaced receiver makes the unacked event terminal for the owner. Neither the old
  // credential nor the replacement occupant can acknowledge it, and the replacement's /self
  // view cannot inherit it merely because the numeric slot was reused.
  await post(`/api/slots/${bId}/kill`, {});
  const gone = await eventForWatch(wB.watch.id);
  check("a dead receiver leaves its event inspectable as receiver-gone in the owner view",
    gone?.status === "receiver-gone" && gone.deliveredAt !== null && gone.acknowledgedAt === null,
    JSON.stringify(gone));
  check("the replaced session's old token is rejected and cannot Ack the gone event",
    (await ackEvent(bTok, gone?.id ?? "missing")).status === 401);
  const reopenB = await post(`/api/slots/${bId}/open`, { cwd: REPO });
  const newBTok = await paneEnv(`s${bId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacementAck = await ackEvent(newBTok, gone?.id ?? "missing");
  const replacementSelf = await (await selfGet(newBTok)).json() as { events?: FleetEventRow[] };
  check("a replacement occupant is session-bound away from the old event",
    reopenB.ok && newBTok !== bTok && replacementAck.status === 409
    && !replacementSelf.events?.some((e) => e.id === gone?.id),
    `${replacementAck.status} ${await replacementAck.text()}`);

  // Watch deletion and subject teardown do not erase the durable completion object. Both claims are
  // asserted on rows the ceiling above RETAINS: the spent deploy Watch and ITS acknowledged event,
  // and — for the teardown — the resolved crash-boundary row, whose subjectSlot is the very lane
  // killed below. Until 2026-09-08 both pointed at eventA, i.e. at the one row this receiver's
  // retention is guaranteed to have dropped; that made them assert a survival guarantee the server
  // legitimately does not give, and they went red whenever the count actually reached six. Two
  // Watches are deleted, not one, so the claim still covers the lane-transport kind it was written
  // for as well as the deploy kind it is now read on.
  const delLaneWatch = await post(`/api/watches/${wAJ.watch.id}/delete`, {});
  const delDeployWatch = await post(`/api/watches/${successSub.watch?.id ?? "missing"}/delete`, {});
  check("delete the spent transport Watch", delLaneWatch.ok && delDeployWatch.ok,
    `${delLaneWatch.status}/${delDeployWatch.status}`);
  check("deleting a Watch does not delete its acknowledged event",
    !(await watchRow(wAJ.watch.id)) && !(await watchRow(successSub.watch?.id ?? "missing"))
      && (await eventRows()).some((e) => e.id === successEvent?.id && e.status === "acknowledged"),
    JSON.stringify((await eventRows()).filter((e) => e.receiverSlot === aId).map((e) => `${e.id}:${e.status}`)));
  const crashBoundaryRow = (await eventRows()).find((e) => e.id === crashId);
  await post(`/api/slots/${tgt.slot}/kill`, {});
  check("subject teardown after event creation leaves the event trail intact",
    crashBoundaryRow?.subjectSlot === tgt.slot
      && (await eventRows()).some((e) => e.id === crashId && e.status === "acknowledged"),
    JSON.stringify((await eventRows()).find((e) => e.id === crashId) ?? null));
  await post(`/api/slots/${bId}/kill`, {});
  await post(`/api/slots/${aId}/kill`, {});
  const reopenA = await post(`/api/slots/${aId}/open`, { cwd: REPO });
  const replacementATok = await paneEnv(`s${aId}`, "FLEET_SELF_TOKEN") ?? "";
  const replacedDeployAck = successEvent ? await ackEvent(replacementATok, successEvent.id)
    : new Response(null, { status: 599 });
  check("deploy event: a replacement receiver session cannot acknowledge the prior session's event",
    reopenA.ok && replacementATok !== aTok && replacedDeployAck.status === 409,
    `${replacedDeployAck.status} ${await replacedDeployAck.text()}`);

  // --- SUPERVISOR OPERATIONS INBOX: the transport split. `delivery` is a SUBSCRIPTION fact, named
  // by the subscriber and validated at CREATE time. An inbox event is minted straight to the status
  // word "inbox", which the transport loop never selects — so what is proven below is not "no
  // message arrived this time" but "no transport step exists": no pane bytes, no history row, no
  // prompt-journal row, deliveredAt null forever. Visibility and consumption stay separate facts —
  // the receiver session may SEE such a row and may never acknowledge it, and the owner may close
  // only those. Every pane-delivery check above is the untouched baseline for the legacy path.
  //
  // It runs HERE, LAST, on purpose: the pane fixtures above depend on a receiver pane
  // staying busy for a bounded window and on their own retained rows, and work inserted earlier
  // spends both. This family therefore reuses the slot the fixture has just recycled.
  const inboxBadDelivery = await selfWatch(replacementATok, { kind: "deploy", deployId: successId, delivery: "garbage" });
  const inboxBadDeliveryText = await inboxBadDelivery.text();
  check("inbox: an unknown delivery word is refused 400 by name, never defaulted to a transport",
    inboxBadDelivery.status === 400 && inboxBadDeliveryText.includes("delivery must be 'pane' or 'inbox'"),
    `${inboxBadDelivery.status} ${inboxBadDeliveryText}`);

  const paneRowBefore = JSON.stringify((await eventRows()).find((e) => e.id === successEvent?.id) ?? null);
  const paneOwnerAck = successEvent ? await post(`/api/events/${successEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const paneOwnerAckText = await paneOwnerAck.text();
  check("inbox: the owner route refuses a PANE-delivered event — the split cuts both ways",
    paneOwnerAck.status === 409 && paneOwnerAckText.includes("acknowledgement belongs to the receiver session"),
    `${paneOwnerAck.status} ${paneOwnerAckText}`);
  // …and the refusal is INERT. The owner's new visibility into unacknowledged pane transport
  // (src/client.ts opsUnacked) shows him exactly these rows, so the one thing that must not happen
  // is looking at one becoming closing one — the refused call may not move a single field.
  check("owner ack on a pane row leaves it byte-identical — seeing is not consuming",
    paneRowBefore !== "null"
      && JSON.stringify((await eventRows()).find((e) => e.id === successEvent?.id) ?? null) === paneRowBefore,
    paneRowBefore.slice(0, 200));
  const unknownOwnerAck = await post("/api/events/deadbeefdeadbeefdeadbeef/ack", {});
  check("inbox: the owner route 404s an unknown event id", unknownOwnerAck.status === 404,
    `${unknownOwnerAck.status} ${await unknownOwnerAck.text()}`);

  const inboxId = "d0000005";
  appendDeploy(deployRow(inboxId, true, "boot", { hitTarget: true, bundleStale: false }));
  const paneBefore = await tmuxOut("capture-pane", "-p", "-t", `s${aId}`);
  const plogBefore = (await plogRead()).length;
  const historyOf = async (slot: number): Promise<{ text: string }[]> =>
    ((await (await get(`/api/slots/${slot}/history`)).json()) as { history?: { text: string }[] }).history ?? [];
  const historyBefore = (await historyOf(aId)).length;
  const inboxSubR = await selfWatch(replacementATok, { kind: "deploy", deployId: inboxId, idleSec: 0, delivery: "inbox" });
  const inboxSub = await inboxSubR.json() as { watch?: DeployWatchRow };
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500); // give every tick its chance to deliver it, and prove it cannot
  const inboxEvent = (await deployEventRows()).find((e) => e.watchId === inboxSub.watch?.id);
  check("inbox: a delivery:'inbox' subscription rides back on the watch and mints status inbox, never pending",
    inboxSubR.ok && inboxSub.watch?.delivery === "inbox" && inboxSub.watch.armed === false
      && inboxEvent?.status === "inbox" && inboxEvent.delivery === "inbox"
      && inboxEvent.deliveredAt === null && inboxEvent.attempts === 0,
    JSON.stringify({ watch: inboxSub.watch, event: inboxEvent }));
  const paneAfter = await tmuxOut("capture-pane", "-p", "-t", `s${aId}`);
  const plogAfterRows = (await plogRead()).slice(plogBefore);
  const historyAfter = await historyOf(aId);
  check("inbox: the receiver pane is byte-unchanged and no history or prompt-journal row was written",
    paneAfter.out === paneBefore.out && historyAfter.length === historyBefore
      && !plogAfterRows.some((p) => p.slot === aId && p.text.includes(`[event ${inboxEvent?.id}]`))
      && !historyAfter.some((h) => h.text.includes(`[event ${inboxEvent?.id}]`)),
    JSON.stringify({ paneChanged: paneAfter.out !== paneBefore.out, historyBefore,
      historyAfter: historyAfter.length, newPlog: plogAfterRows.length }));

  // hand the spent transport Watch back at once. A Watch is retained per slot and the fixtures
  // around this family own theirs; the event is durable independently of it, which the checks
  // further down assert in their own right.
  if (inboxSub.watch) await post(`/api/watches/${inboxSub.watch.id}/delete`, {});
  const inboxSelfAck = inboxEvent ? await ackEvent(replacementATok, inboxEvent.id) : new Response(null, { status: 599 });
  const inboxSelfAckText = await inboxSelfAck.text();
  check("inbox: the bound receiver session cannot self-acknowledge — it was never offered the row",
    inboxSelfAck.status === 409 && inboxSelfAckText.includes("acknowledgement belongs to the owner"),
    `${inboxSelfAck.status} ${inboxSelfAckText}`);

  // a SECOND row for the happy path, so the first one stays open across the restart below — an
  // already-acknowledged row would prove nothing about loading the new status word.
  const inboxAckId = "d0000006";
  appendDeploy(deployRow(inboxAckId, false, "build", { hitTarget: false, bundleStale: true, reason: "build failed" }));
  const inboxAckSub = await (await selfWatch(replacementATok,
    { kind: "deploy", deployId: inboxAckId, idleSec: 0, delivery: "inbox" })).json() as { watch?: DeployWatchRow };
  const inboxAckEvent = (await deployEventRows()).find((e) => e.watchId === inboxAckSub.watch?.id);
  if (inboxAckSub.watch) await post(`/api/watches/${inboxAckSub.watch.id}/delete`, {});
  const ownerAck1 = inboxAckEvent ? await post(`/api/events/${inboxAckEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const ownerAck1J = await ownerAck1.json() as
    { existing?: boolean; event?: { status?: string; deliveredAt?: number | null; acknowledgedAt?: number | null } };
  const ownerAck2 = inboxAckEvent ? await post(`/api/events/${inboxAckEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  const ownerAck2J = await ownerAck2.json() as { existing?: boolean; event?: { acknowledgedAt?: number | null } };
  check("inbox: the owner acknowledges an inbox event once, idempotently, and it stays never-delivered",
    ownerAck1.ok && ownerAck1J.existing === false && ownerAck1J.event?.status === "acknowledged"
      && ownerAck1J.event.deliveredAt === null
      && ownerAck2.ok && ownerAck2J.existing === true
      && ownerAck2J.event?.acknowledgedAt === ownerAck1J.event.acknowledgedAt,
    JSON.stringify({ ownerAck1J, ownerAck2J }));
  check("inbox: an unacknowledged inbox row is open delivery debt, exactly like an undelivered pane row",
    (await eventRows()).filter((e) => e.receiverSlot === aId
      && !["acknowledged", "receiver-gone"].includes(e.status)).some((e) => e.id === inboxEvent?.id),
    JSON.stringify((await eventRows()).filter((e) => e.receiverSlot === aId).map((e) => `${e.id}:${e.status}`)));

  // durability: the new status word must survive fleetEventFrom, and must still be undeliverable
  // on the other side of a restart — a fresh process re-arms every tick this row must not attract.
  await restartSrv();
  await Bun.sleep(AUTOS_TICK_MS * 4 + 500);
  const inboxAfterRestart = (await deployEventRows()).find((e) => e.id === inboxEvent?.id);
  check("inbox: a persisted inbox row survives restart as inbox/never-delivered and is still typed nowhere",
    inboxAfterRestart?.status === "inbox" && inboxAfterRestart.delivery === "inbox"
      && inboxAfterRestart.deliveredAt === null && inboxAfterRestart.attempts === 0
      && !(await plogRead()).some((p) => p.text.includes(`[event ${inboxEvent?.id}]`)),
    JSON.stringify(inboxAfterRestart));
  const closeInbox = inboxEvent ? await post(`/api/events/${inboxEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  check("inbox: the owner closes the restored row through the same route, from the loaded status",
    closeInbox.ok && (await deployEventRows()).find((e) => e.id === inboxEvent?.id)?.status === "acknowledged",
    `${closeInbox.status} ${await closeInbox.text()}`);

  // fail closed on IDENTITY, on the teardown this fixture performs anyway: an inbox row is not
  // exempt from the recycled-receiver rule. It turns terminal with its receiver's occupant and is
  // never re-targeted at whoever moves into the slot number next.
  const goneInboxId = "d0000007";
  appendDeploy(deployRow(goneInboxId, true, "boot", { hitTarget: true, bundleStale: false }));
  const goneInboxSub = await (await selfWatch(replacementATok,
    { kind: "deploy", deployId: goneInboxId, idleSec: 0, delivery: "inbox" })).json() as { watch?: DeployWatchRow };
  const goneInboxEvent = (await deployEventRows()).find((e) => e.watchId === goneInboxSub.watch?.id);
  if (goneInboxSub.watch) await post(`/api/watches/${goneInboxSub.watch.id}/delete`, {});
  check("inbox receiver-gone setup: the receiver holds one open inbox row before its teardown",
    goneInboxEvent?.status === "inbox" && goneInboxEvent.receiverSlot === aId,
    JSON.stringify(goneInboxEvent));
  await post(`/api/slots/${aId}/kill`, {});
  const goneInboxAfter = (await deployEventRows()).find((e) => e.id === goneInboxEvent?.id);
  const goneInboxOwnerAck = goneInboxEvent ? await post(`/api/events/${goneInboxEvent.id}/ack`, {})
    : new Response(null, { status: 599 });
  check("inbox: teardown makes an inbox row terminal, and the owner ack is then refused, never re-targeted",
    goneInboxAfter?.status === "receiver-gone" && goneInboxAfter.acknowledgedAt === null
      && goneInboxOwnerAck.status === 409,
    `${JSON.stringify(goneInboxAfter)} ${goneInboxOwnerAck.status} ${await goneInboxOwnerAck.text()}`);

  // --- STN-1 · THE TRANSITION WATCH, registration side. A Controller registers a question in its
  // own words; ONLY the bound Supervisor can answer it (e2e/supervisor.ts proves that door); the
  // answer rides the same transport every other Watch kind rides. Proved here: the refusals at
  // registration (lane, closed body, bounds, no Supervisor, the Supervisor itself), that the cap is
  // the SHARED one, that the parser is fail-closed for the new kind, that a deadline disarms with
  // no pane text, and that a receiver gone during transport ends the event as receiver-gone. ---
  {
    interface TransitionWatchRow {
      id: string; kind: string; slot: number; slotOpenedAt?: number; idleSec: number; armed: boolean;
      created: number; firedAt: number | null; lastResult: string | null; awaiting: string; deadlineAt: number;
    }
    interface TransitionEventRow {
      id: string; watchId: string | null; kind: string; status: string; receiverSlot: number; attempts: number;
    }
    const stateToken = (slot: number): string => (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
      { slots?: Record<string, { selfToken?: string; openedAt?: number; sessionId?: string | null }> })
      .slots?.[String(slot)]?.selfToken ?? "";
    const stateSlot = (slot: number): { openedAt: number; sessionId: string | null } => {
      const row = (JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as
        { slots?: Record<string, { openedAt?: number; sessionId?: string | null }> }).slots?.[String(slot)];
      return { openedAt: row?.openedAt ?? 0, sessionId: row?.sessionId ?? null };
    };
    const allWatches = async (): Promise<TransitionWatchRow[]> =>
      ((await (await get("/api/sessions")).json()) as { watches: TransitionWatchRow[] }).watches;
    const allEvents = async (): Promise<TransitionEventRow[]> =>
      ((await (await get("/api/events")).json()) as { events: TransitionEventRow[] }).events;
    const transitionTexts = async (slot: number): Promise<number> =>
      (await plogRead()).filter((e) => e.slot === slot && e.text.startsWith("[fleet Supervisor transition ")).length;
    const complete = (tok: string, id: string, text: string): Promise<Response> =>
      fetch(`${BASE}/api/self/supervisor-watch/${id}/complete`, { method: "POST",
        headers: { "content-type": "application/json", "x-fleet-self-token": tok }, body: JSON.stringify({ text }) });

    const ctl = await freeSlot();
    const ctlOpen = await post(`/api/slots/${ctl}/open`, { cwd: REPO, label: "stn1-controller" });
    const sv = await freeSlot();
    const svOpen = await post(`/api/slots/${sv}/open`, { cwd: REPO, label: "stn1-supervisor-fixture" });
    const ctlTok = stateToken(ctl);
    const svTok = stateToken(sv);
    const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; branch: string };
    const laneTok = stateToken(lane.slot);
    check("stn1 registration fixtures: a Controller, a Supervisor-to-be and a lane, each with a distinct credential",
      ctlOpen.ok && svOpen.ok && lane.slot > 0 && new Set([ctlTok, svTok, laneTok]).size === 3
        && [ctlTok, svTok, laneTok].every((t) => /^[0-9a-f]{32}$/.test(t)),
      `${ctl}/${sv}/${lane.slot}`);

    const body = (over: Record<string, unknown> = {}): Record<string, unknown> =>
      ({ kind: "transition", idleSec: 3600, deadlineSec: 600, awaiting: "the portfolio moves", ...over });
    const noSv = await selfWatch(ctlTok, body());
    const noSvText = await noSv.text();
    check("stn1 registration: with no bound Supervisor the watch is refused 409 — it could never be completed",
      noSv.status === 409 && noSvText.includes("no bound Supervisor"), `${noSv.status} ${noSvText}`);

    // the binding, installed the way every occupant fixture in this suite is: through the state
    // file, because a real bootstrap would prove the bootstrap (e2e/supervisor.ts does) and
    // nothing about registration. The supervisor module's baseline asserts a null binding, so
    // this block removes it again on its way out.
    const bindSupervisor = async (binding: Record<string, unknown> | null): Promise<void> => {
      await stopSrv();
      const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as Record<string, unknown>;
      st.supervisor = binding;
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
      await restartSrv();
    };
    const svOccupant = stateSlot(sv);
    await bindSupervisor({ slot: sv, openedAt: svOccupant.openedAt, sessionId: svOccupant.sessionId, boundAt: Date.now() });

    const watchesBefore = (await allWatches()).length;
    const [rLane, rTarget, rSlot, rProgram, rDelivery, rNoAwait, rEmptyAwait, rLongAwait, rLowDl, rHighDl, rStrDl, rSelf]
      = await Promise.all([
        selfWatch(laneTok, body()),
        selfWatch(ctlTok, body({ target: lane.slot })),
        selfWatch(ctlTok, body({ slot: sv })),
        selfWatch(ctlTok, body({ programId: "p".repeat(24) })),
        selfWatch(ctlTok, body({ delivery: "inbox" })),
        selfWatch(ctlTok, { kind: "transition", idleSec: 0 }),
        selfWatch(ctlTok, body({ awaiting: "   " })),
        selfWatch(ctlTok, body({ awaiting: "x".repeat(501) })),
        selfWatch(ctlTok, body({ deadlineSec: 59 })),
        selfWatch(ctlTok, body({ deadlineSec: 86_401 })),
        selfWatch(ctlTok, body({ deadlineSec: "600" })),
        selfWatch(svTok, body()),
      ]);
    const rTexts = await Promise.all([rLane, rTarget, rSlot, rProgram, rDelivery, rNoAwait, rEmptyAwait, rLongAwait,
      rLowDl, rHighDl, rStrDl, rSelf].map((r) => r.text()));
    check("stn1 registration: a lane may not register a transition watch — the route's 409, unchanged",
      rLane.status === 409 && rTexts[0]!.includes("a lane may not subscribe"), `${rLane.status} ${rTexts[0]}`);
    // STN-2: the owner door feeds the same createWatchForSlot — without this refusal the owner
    // could register a transition watch on a LANE and the self route's 409 above would be moot.
    const rOwnerLane = await post(`/api/slots/${lane.slot}/watch`, body());
    const rOwnerCtl = await post(`/api/slots/${ctl}/watch`, body());
    const [rOwnerLaneText, rOwnerCtlText] = await Promise.all([rOwnerLane.text(), rOwnerCtl.text()]);
    check("stn1 registration: the owner route refuses kind transition by name (409) — for a lane and a plain session alike; only the receiving session registers its own question",
      rOwnerLane.status === 409 && rOwnerLaneText.includes("registered by the receiving session itself")
        && rOwnerCtl.status === 409 && rOwnerCtlText.includes("registered by the receiving session itself"),
      `${rOwnerLane.status} ${rOwnerLaneText} / ${rOwnerCtl.status}`);
    check("stn1 registration: the body is a CLOSED set — target, slot, programId and delivery are refused BY NAME (400)",
      rTarget.status === 400 && rTexts[1]!.includes("[target] is not read")
        && rSlot.status === 400 && rTexts[2]!.includes("[slot] is not read")
        && rProgram.status === 400 && rTexts[3]!.includes("[programId] is not read")
        && rDelivery.status === 400 && rTexts[4]!.includes("[delivery] is not read") && rTexts[4]!.includes("pane-only"),
      `${rTarget.status}:${rTexts[1]} | ${rSlot.status} | ${rProgram.status} | ${rDelivery.status}:${rTexts[4]}`);
    check("stn1 registration: awaiting is required, non-blank and at most 500 chars (400 each)",
      rNoAwait.status === 400 && rTexts[5]!.includes("awaiting must be")
        && rEmptyAwait.status === 400 && rLongAwait.status === 400 && rTexts[7]!.includes("at most 500"),
      `${rNoAwait.status}:${rTexts[5]} ${rEmptyAwait.status} ${rLongAwait.status}:${rTexts[7]}`);
    check("stn1 registration: deadlineSec is structurally bounded to [60, 86400] and must be a number (400 each)",
      rLowDl.status === 400 && rTexts[8]!.includes("[60, 86400]") && rHighDl.status === 400 && rStrDl.status === 400,
      `${rLowDl.status}:${rTexts[8]} ${rHighDl.status} ${rStrDl.status}`);
    check("stn1 registration: the bound Supervisor cannot register one on itself — it is the completer (409)",
      rSelf.status === 409 && rTexts[11]!.includes("cannot register a transition watch on itself"),
      `${rSelf.status} ${rTexts[11]}`);
    check("stn1 registration: not one refusal persisted a watch",
      (await allWatches()).length === watchesBefore, `${watchesBefore} -> ${(await allWatches()).length}`);

    // --- the cap is the SHARED one. Five armed transition watches fill it, and the SIXTH of a
    // DIFFERENT kind (a lane watch on a real lane) is refused with the one shared number. ---
    const minted: TransitionWatchRow[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await (await selfWatch(ctlTok, body({ awaiting: `question ${i}` }))).json() as
        { watch?: TransitionWatchRow; existing?: boolean };
      if (r.watch) minted.push(r.watch);
    }
    const first = minted[0];
    check("stn1 registration: five distinct questions mint five armed watches with default-free explicit deadlines",
      minted.length === 5 && minted.every((w) => w.kind === "transition" && w.armed && w.slot === ctl
        && w.slotOpenedAt === stateSlot(ctl).openedAt && w.deadlineAt === w.created + 600_000)
        && new Set(minted.map((w) => w.id)).size === 5,
      JSON.stringify(minted.map((w) => [w.id, w.awaiting, w.armed])));
    const dup = await (await selfWatch(ctlTok, body({ awaiting: "question 0" }))).json() as
      { watch?: TransitionWatchRow; existing?: boolean };
    check("stn1 registration: the same armed question is returned as existing, never minted twice",
      dup.existing === true && dup.watch?.id === first?.id, JSON.stringify(dup));
    const sixthLane = await post(`/api/slots/${ctl}/watch`, { target: lane.slot, idleSec: 3600 });
    const sixthText = await sixthLane.text();
    const sixthTransition = await selfWatch(ctlTok, body({ awaiting: "question 5" }));
    check("stn1 cap: the shared per-slot budget refuses the sixth watch of ANY kind with the one shared number",
      sixthLane.status === 400 && sixthText.includes("max 5 active watches per slot") && sixthTransition.status === 400
        && (await allWatches()).filter((w) => w.slot === ctl && w.armed).length === 5,
      `${sixthLane.status} ${sixthText} | ${sixthTransition.status}`);

    // --- expiry and the fail-closed parser, across one restart. The first watch's deadline is
    // moved into the past; two malformed transition rows (an inbox one, an awaiting-less one) are
    // planted beside it and must not load. ---
    await stopSrv();
    {
      const st = JSON.parse(readFileSync(`${ROOT}/fleet.json`, "utf8")) as { watches?: Record<string, unknown>[] };
      const row = (st.watches ?? []).find((w) => w.id === first?.id);
      if (row) row.deadlineAt = Date.now() - 1;
      st.watches?.push({ ...(row ?? {}), id: "stn1inboxfixture", awaiting: "planted", delivery: "inbox",
        deadlineAt: Date.now() + 600_000 });
      st.watches?.push({ ...(row ?? {}), id: "stn1noawaitfixture", awaiting: undefined, deadlineAt: Date.now() + 600_000 });
      writeFileSync(`${ROOT}/fleet.json`, JSON.stringify(st, null, 2), { mode: 0o600 });
    }
    await restartSrv();
    let expired: TransitionWatchRow | undefined;
    for (let i = 0; i < 40 && expired?.armed !== false; i++) {
      expired = (await allWatches()).find((w) => w.id === first?.id);
      if (expired?.armed !== false) await Bun.sleep(250);
    }
    check("stn1 expiry: the tick disarms a watch past its deadline with lastResult 'expired' and no event",
      expired?.armed === false && (expired.lastResult ?? "").startsWith("expired")
        && !(await allEvents()).some((e) => e.watchId === first?.id),
      JSON.stringify(expired ?? null));
    check("stn1 expiry: no pane text accompanies an expiry — the rail carries transitions, not a second stream",
      (await transitionTexts(ctl)) === 0, String(await transitionTexts(ctl)));
    const lateComplete = await complete(svTok, first?.id ?? "x", "too late");
    const lateText = await lateComplete.text();
    check("stn1 expiry: completing an expired watch is 409 'no longer armed' and mints nothing",
      lateComplete.status === 409 && lateText.includes("no longer armed") && lateText.includes("expired")
        && !(await allEvents()).some((e) => e.watchId === first?.id),
      `${lateComplete.status} ${lateText}`);
    check("stn1 parser: a persisted transition row claiming inbox delivery or lacking awaiting is dropped fail-closed",
      !(await allWatches()).some((w) => w.id === "stn1inboxfixture" || w.id === "stn1noawaitfixture")
        && (await allWatches()).filter((w) => w.slot === ctl && w.kind === "transition").length === 5,
      JSON.stringify((await allWatches()).filter((w) => w.slot === ctl).map((w) => [w.id, w.armed])));
    const expiredAudit = ((await (await get("/api/audit")).json()) as { rows?: { event: string; detail?: string }[];
      events?: { event: string; detail?: string }[] });
    const auditRows = expiredAudit.rows ?? expiredAudit.events ?? [];
    check("stn1 expiry: the audit trail carries one watch_expire row naming the watch",
      auditRows.some((r) => r.event === "watch_expire" && (r.detail ?? "").includes(first?.id ?? "?")),
      JSON.stringify(auditRows.filter((r) => r.event === "watch_expire").slice(-2)));

    // --- the transport end: a completed watch whose receiver dies while the event is still
    // pending. idleSec 3600 keeps the Controller's event pending (it is never that idle), so the
    // teardown is what ends it — as receiver-gone, never as delivered, with no pane text. ---
    const second = minted[1];
    const doneRes = await complete(svTok, second?.id ?? "x", "the portfolio moved");
    const done = await doneRes.json() as { ok?: boolean; event?: TransitionEventRow };
    check("stn1 transport: completion mints one pending event for a not-yet-idle receiver",
      doneRes.ok && done.event?.status === "pending" && done.event.receiverSlot === ctl && done.event.attempts === 0,
      `${doneRes.status} ${JSON.stringify(done)}`);
    await Bun.sleep(AUTOS_TICK_MS * 3 + 200);
    const stillPending = (await allEvents()).find((e) => e.id === done.event?.id);
    await post(`/api/slots/${ctl}/kill`, {});
    const gone = (await allEvents()).find((e) => e.id === done.event?.id);
    check("stn1 transport: teardown of the registrant turns the pending event receiver-gone and types nothing",
      stillPending?.status === "pending" && gone?.status === "receiver-gone" && (await transitionTexts(ctl)) === 0,
      JSON.stringify({ stillPending, gone }));
    check("stn1 transport: the dead registrant's remaining armed watches are dropped with it — nothing to complete",
      !(await allWatches()).some((w) => w.slot === ctl),
      JSON.stringify((await allWatches()).filter((w) => w.slot === ctl).map((w) => w.id)));
    const ghost = await complete(svTok, minted[2]?.id ?? "x", "to nobody");
    check("stn1 transport: completing a dropped watch is 409 'unknown watch'",
      ghost.status === 409 && (await ghost.text()).includes("unknown watch"), String(ghost.status));

    // the transport honesty for this kind is the SAME code path, pinned at source: the new
    // message branch sits between the persisted send-uncertain marker and the sendText call of
    // the one FACT 2 loop, so every ACP-25 rule proved above for lane events binds it too.
    const transitionBranchAt = tickSource.indexOf('event.kind === "supervisor-transition"');
    check("stn1 transport: the supervisor-transition message is composed inside FACT 2 after send-uncertain is persisted and before sendText",
      transitionBranchAt > persistedAt && transitionBranchAt < sendAt, `${persistedAt}:${transitionBranchAt}:${sendAt}`);

    await bindSupervisor(null);
    check("stn1 cleanup: the fixture binding is gone again and the Supervisor module's null baseline holds",
      ((await (await get("/api/programs")).json()) as { supervisor: unknown }).supervisor === null);
    await post(`/api/slots/${sv}/kill`, {});
    await post(`/api/slots/${lane.slot}/kill`, {});
  }

  // --- PANE TRANSPORT WITHOUT A SESSION ACKNOWLEDGEMENT, CLIENT HALF. `delivered` means tmux
  // accepted paste+Enter and nothing else; the conversation on the other side never said it read
  // the text. Measured gap: delivered +3s, acknowledged +368s, and only because the owner happened
  // to see the text sitting in the composer. The server writes `delivered` once and otherwise reads
  // it only as the receiver-ack precondition, so an unacknowledged row is invisible debt.
  //
  // The classification rules ARE the feature, so the real `opsOpen`/`opsUnacked` are imported
  // from src/opsevents.ts and RUN — the same method as e2e/outcomes.ts (9h). What stays unproved
  // and is named: the rendering around them (this suite has no DOM harness), asserted by regex
  // right after. Nothing here mutates anything; the derivation is read-only by construction.
  {
    let cliSrc: string | null = null;
    let cliSrcError = "";
    try {
      cliSrc = readFileSync(`${dirname(realpathSync(`${ROOT}/node_modules`))}/src/client.ts`, "utf8");
    } catch (e) { cliSrcError = e instanceof Error ? e.message : String(e); }
    check("precondition: node_modules exposes src/client.ts for the pane-ack visibility checks",
      cliSrc !== null, cliSrcError);
    if (cliSrc !== null) {
      // what is asserted about client.ts is that it SHIPS the module under test — classes
      // re-inlined there would leave every check below measuring code the bundle never runs
      check("client: the ops panel takes both event classes from src/opsevents.ts, the module under test",
        /import \{[^}]*\bopsUnacked\b[^}]*\} from "\.\/opsevents"/.test(cliSrc)
          && /import \{[^}]*\bopsOpen\b[^}]*\} from "\.\/opsevents"/.test(cliSrc)
          && /import \{[^}]*\bopsSubject\b[^}]*\} from "\.\/opsevents"/.test(cliSrc)
          && /import \{[^}]*\bopsSummary\b[^}]*\} from "\.\/opsevents"/.test(cliSrc)
          && !/\nfunction ops(Subject|Summary)\b/.test(cliSrc),
        "the opsevents import in src/client.ts");
      // the rows below are shaped by hand, so the imports are widened to the loose signatures the
      // fixtures were written against — the functions themselves are the module's own
      const ops = { opsOpen, opsUnacked, PANE_ACK_STALE_MS } as unknown as {
          opsOpen: (rows: unknown[]) => unknown[];
          opsUnacked: (rows: unknown[], now: number) => { id: string }[];
          PANE_ACK_STALE_MS: number;
        };
      const NOW = 1_000_000_000;
      const STALE = ops.PANE_ACK_STALE_MS;
      const evt = (o: Record<string, unknown>): Record<string, unknown> =>
        ({ id: "x", receiverSlot: 1, createdAt: NOW - STALE - 1000, kind: "lane-ready",
          status: "delivered", deliveredAt: NOW - STALE - 1000, acknowledgedAt: null, ...o });
      const ids = (rows: { id: string }[]): string => rows.map((r) => r.id).sort().join(",");
      check("client: a named threshold, small and in seconds — not a timeout and not a retry budget",
        STALE >= 30_000 && STALE <= 600_000, String(STALE));

      // (1) the row this cut exists for becomes visible, and the boundary is the threshold itself
      const justUnder = evt({ id: "fresh", deliveredAt: NOW - STALE + 1000 });
      const justOver = evt({ id: "stale", deliveredAt: NOW - STALE - 1 });
      check("client: a pane row delivered but unacknowledged past the threshold becomes visible",
        ids(ops.opsUnacked([justOver], NOW)) === "stale", JSON.stringify(ops.opsUnacked([justOver], NOW)));
      check("client: a pane row still inside the threshold is NOT surfaced — a fresh send is not debt",
        ops.opsUnacked([justUnder], NOW).length === 0, JSON.stringify(ops.opsUnacked([justUnder], NOW)));

      // (2) every state that must NOT appear, each for its own reason: an ack arrived (promptly or
      // at all), the receiver is gone so no ack can ever come, or transport never even ran.
      const excluded = [
        evt({ id: "acked", status: "acknowledged", acknowledgedAt: NOW - STALE - 500 }),
        evt({ id: "prompt-acked", status: "acknowledged", deliveredAt: NOW - 3000,
          createdAt: NOW - 4000, acknowledgedAt: NOW - 2000 }),
        evt({ id: "gone", status: "receiver-gone" }),
        evt({ id: "never-sent", status: "pending", deliveredAt: null }),
        evt({ id: "filed", status: "inbox", delivery: "inbox", deliveredAt: null }),
      ];
      check("client: acknowledged, receiver-gone, never-attempted and filed rows are all absent",
        ops.opsUnacked(excluded, NOW).length === 0, ids(ops.opsUnacked(excluded, NOW)));

      // (3) send-uncertain is the one status with no delivery clock at all (it is persisted BEFORE
      // tmux is touched), so it must age from createdAt rather than fall out of the class entirely.
      check("client: send-uncertain ages from createdAt — a missing delivery clock is not a missing row",
        ids(ops.opsUnacked([evt({ id: "unc", status: "send-uncertain", deliveredAt: null })], NOW)) === "unc"
          && ops.opsUnacked([evt({ id: "unc-fresh", status: "send-uncertain", deliveredAt: null,
            createdAt: NOW - 1000 })], NOW).length === 0);

      // (4) THE TWO COUNTS ARE NEVER THE SAME NUMBER OVER THE SAME ROW. Filed operations want the
      // owner to close them; unacknowledged pane transport wants nobody. A row in both classes, or
      // one count computed as a sum, would make one badge mean two different things.
      const mixed = [...excluded, justOver, justUnder,
        evt({ id: "filed2", status: "inbox", delivery: "inbox", deliveredAt: null })];
      const filed = ops.opsOpen(mixed) as { id: string }[];
      const unacked = ops.opsUnacked(mixed, NOW);
      check("client: the filed-operations and unacknowledged-pane classes are disjoint over one ledger",
        ids(filed) === "filed,filed2" && ids(unacked) === "stale"
          && !filed.some((f) => unacked.some((u) => u.id === f.id)),
        `filed=[${ids(filed)}] unacked=[${ids(unacked)}]`);

      // (4b) THE OWNER POLL'S PROJECTION LOSES NOTHING THE PANEL PRINTS. /api/sessions carries
      // opsPollRow(e) for the rows opsPollVisible admits, never the stored row. The expected strings
      // are written from each fixture's FACTS, not computed from the full row: a key dropped from
      // OPS_POLL_PAYLOAD_KEYS (or a subject/recovery field dropped from the row) prints `undefined`
      // or `?` where a fact stood, and the line below names the kind it happened to.
      const base = (o: Record<string, unknown>): OpsPollSource => ({ id: "p", watchId: "w1",
        receiverSlot: 4, receiverOpenedAt: NOW - 9000, receiverSessionId: "sess", receiverIdleSec: 0,
        createdAt: NOW - STALE - 1000, status: "delivered", delivery: "pane", attempts: 1,
        deliveredAt: NOW - STALE - 1000, acknowledgedAt: null, subjectCwd: "/probe/cwd", ...o }) as unknown as OpsPollSource;
      const kinds: [OpsPollSource, string, string][] = [
        [base({ id: "k1", kind: "lane-ready", subjectSlot: 7, subjectBranch: "fleet/probe-ready",
          payload: { ahead: 3, dirty: 1, idleMs: 5, observed: true, gitOp: false, awaiting: null, hostCommits: false } }),
          "slot 7 · fleet/probe-ready", "3 ahead / 1 dirty"],
        [base({ id: "k2", kind: "host-commit-ready", subjectSlot: 8, subjectBranch: "main",
          payload: { ahead: 4, dirty: 2, idleMs: 5, observed: true, gitOp: null, awaiting: "main", hostCommits: true } }),
          "slot 8 · main", "4 ahead / 2 dirty"],
        [base({ id: "k3", kind: "merge-terminal", subjectSlot: 3, subjectBranch: "fleet/probe-merge",
          payload: { status: "blocked", landed: false, branch: "fleet/probe-merge", at: NOW,
            verify: { ok: false, timedOut: true }, conflicted: ["code.txt"] } }),
          "slot 3 · fleet/probe-merge", "blocked · landed=NO · verify=FAILED"],
        [base({ id: "k4", kind: "post-land-audit", subjectRepo: "probe-repo", subjectMainAfter: "abcdef1234567890",
          payload: { result: "red", mainSha: "f".repeat(40), covers: [{ branch: "b", mainAfter: "c" }],
            checks: { ran: 9, failed: 1 } } }),
          "probe-repo @ abcdef12", "result=red"],
        [base({ id: "k5", kind: "deploy-terminal", subjectDeployId: "0a1b2c3d",
          payload: { ok: false, stage: "restart", target: "t", bootHead: null, hitTarget: null, bundleStale: null, at: NOW } }),
          "deploy 0a1b2c3d", "ok=NO · stage=restart"],
        [base({ id: "k6", kind: "command-job", subjectJobId: "0123456789ab",
          payload: { result: "green", cmd: "bun run build", exitCode: 0,
            artifacts: [{ path: "dist/a.js", sha256: "d".repeat(64), bytes: 1 },
              { path: "dist/b.js", sha256: "e".repeat(64), bytes: 2 }] } }),
          "command job 0123456789ab", "result=green · bun run build · 2 artefact(s)"],
        [base({ id: "k7", kind: "lane-suite", subjectJobId: "ba9876543210", receiverSlot: null,
          receiverOpenedAt: null, receiverSessionId: null, watchId: null, status: "inbox", delivery: "inbox",
          deliveredAt: null, payload: { result: "red", branch: "fleet/probe-suite", exitCode: 1,
            fails: ["a", "b", "c"], failCount: 12, tail: "t".repeat(200) } }),
          "preview suite ba9876543210", "result=red · fleet/probe-suite · 12 failure(s)"],
        [base({ id: "k8", kind: "fleet-report", subjectSlot: 5, subjectBranch: "fleet/probe-report", watchId: null,
          payload: { reportId: "0".repeat(24), status: "needs-main", text: "the whole report",
            taskId: "deadbeefcafe", originId: null, programId: null, basis: "lane-watch" } }),
          "slot 5 · fleet/probe-report", "needs-main · task deadbeef"],
        [base({ id: "k9", kind: "harness-block", subjectSlot: 6, subjectBranch: "fleet/probe-hook", subjectOpenedAt: NOW - 5000,
          receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, watchId: null, status: "inbox",
          delivery: "inbox", deliveredAt: null, payload: { signal: "denied", tool: "Bash", detail: "d".repeat(300),
            key: "0123456789abcdef", count: 3, escalated: true } }),
          "slot 6 · fleet/probe-hook", "dialog DENIED · Bash · 3× · ESCALATED"],
        [base({ id: "k10", kind: "lane-review", subjectSlot: 9, subjectBranch: "fleet/probe-review", subjectOpenedAt: NOW - 7000,
          receiverSlot: null, receiverOpenedAt: null, receiverSessionId: null, watchId: null, status: "inbox",
          delivery: "inbox", deliveredAt: null, payload: { taskId: "cafebabe1234", programId: null,
            diffSha: "e".repeat(40), head: "9".repeat(40), model: "claude-opus-5[1m]", describedThisDiff: false,
            raw: false, findingCount: 2, notes: "n".repeat(250),
            findings: [{ title: "a finding title", file: "server.ts", line: 3, impact: "high" }] } }),
          "slot 9 · fleet/probe-review", "③ 2 finding(s) · task cafebabe · this diff: NO"],
      ];
      const labelMiss = kinds.map(([full, subject, summary]) => {
        const p = opsPollRow(full);
        return opsSubject(p) === subject && opsSummary(p) === summary ? ""
          : `${full.kind}: subject=${JSON.stringify(opsSubject(p))} summary=${JSON.stringify(opsSummary(p))}`;
      }).filter(Boolean);
      check("owner poll projection: every kind's projected row prints the same subject and summary facts as its full row",
        labelMiss.length === 0, labelMiss.join(" | ") || `${kinds.length} kinds`);

      // …and the fields the panel reads OUTSIDE the two labels: the class it falls in, who it is
      // for, the clock it ages on and the four recovery lines of an uncertain row.
      const recovered = base({ id: "rec", kind: "fleet-report", subjectSlot: 5, subjectBranch: "b", watchId: null,
        status: "send-uncertain", deliveredAt: null, payload: { status: "failed" },
        recovery: { state: "blocked", reason: "probe reason", nextAction: "probe next", effect: "probe effect", updatedAt: NOW } });
      const classRows = [...kinds.map(([f]) => f), recovered,
        ...[...excluded, justOver, justUnder].map((r) => base({ ...r, kind: "lane-ready" }))];
      const fieldMiss = classRows.filter((f) => {
        const p = opsPollRow(f);
        return opsOpen([p]).length !== opsOpen([f]).length || opsUnacked([p], NOW).length !== opsUnacked([f], NOW).length
          || p.receiverSlot !== f.receiverSlot || p.createdAt !== f.createdAt || p.deliveredAt !== f.deliveredAt
          || JSON.stringify(p.recovery ?? null) !== JSON.stringify(f.recovery
            ? { state: f.recovery.state, reason: f.recovery.reason, nextAction: f.recovery.nextAction, effect: f.recovery.effect }
            : null);
      }).map((f) => f.id);
      check("owner poll projection: class, receiver, clock and recovery lines survive the projection unchanged",
        fieldMiss.length === 0, `differ=[${fieldMiss}]`);

      // THE CUT: what the panel lists (filed, not a report) plus every pane row that can age into
      // opsUnacked — at ANY age, because the board judges the age on its own clock between polls.
      const cutLedger = [...classRows,
        base({ id: "ack-inbox", kind: "lane-suite", receiverSlot: null, status: "acknowledged", delivery: "inbox",
          acknowledgedAt: NOW, payload: {} }),
        base({ id: "subj-gone", kind: "lane-ready", status: "subject-gone" })];
      const cut = cutLedger.filter(opsPollVisible).map((e) => e.id).sort().join(",");
      check("owner poll cut: filed non-report rows and unacknowledged pane rows at any age — nothing terminal, no inbox report",
        cut === "k1,k2,k3,k4,k5,k6,k7,k8,k9,k10,rec,filed,fresh,stale".split(",").sort().join(","), cut);

      // …and what it must NOT carry: the payload bodies no label prints and the binding fields no
      // panel line reads. These are the bytes the poll was paying for nobody.
      const projected = JSON.stringify(kinds.map(([f]) => opsPollRow(f)).concat(opsPollRow(recovered)));
      const leaked = ["whole report", "t".repeat(200), "sha256", "dist/a.js", "conflicted", "timedOut", "mainSha",
        "covers", "watchId", "receiverOpenedAt", "receiverSessionId", "receiverIdleSec", "attempts", "subjectCwd",
        "updatedAt", '"fails"', "idleMs", "hostCommits", "bootHead", "d".repeat(300), "0123456789abcdef",
        "n".repeat(250), "a finding title", "e".repeat(40)].filter((k) => projected.includes(k));
      check("owner poll projection: no payload body and no binding field the panel never prints rides along",
        leaked.length === 0, `leaked=[${leaked}]`);

      // (5) the rendering, by regex over the source and weaker than a render test on purpose. Two
      // things must hold: the words are the ones the data supports, and the row offers NO ack — the
      // owner is not the principal who could have read the pane, and the server refuses him (above).
      // COMMENT LINES ARE STRIPPED FIRST: these are checks about the words the OWNER reads. A
      // comment is free to name the phrasing it forbids — the row's own does — and a probe that
      // counted those mentions would fail on its own documentation.
      // ANCHORED AT A LINE START, and that is not tidiness. `indexOf("function opsUnackedRow")`
      // matches the first occurrence ANYWHERE — including inside a COMMENT that names the function,
      // which is what a comment explaining this very slice did: the window collapsed to two lines of
      // prose and every assertion below passed vacuously in the negative direction (no ack, no post,
      // no `failed` — because there was no code in it at all). A `\nfunction ` anchor cannot match a
      // `//` line, so the probe now fails LOUDLY if either anchor moves instead of measuring prose.
      const sliceAt = (name: string): number => cliSrc!.indexOf(`\nfunction ${name}`);
      check("client: both source anchors of the pane-transport slice resolve to a real definition, not to prose about one",
        sliceAt("opsUnackedRow") > 0 && sliceAt("renderOpsDlg") > sliceAt("opsUnackedRow"),
        `opsUnackedRow@${sliceAt("opsUnackedRow")} renderOpsDlg@${sliceAt("renderOpsDlg")}`);
      const unackedRow = cliSrc.slice(sliceAt("opsUnackedRow"), sliceAt("renderOpsDlg"))
        .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      check("client: the unacknowledged-pane row says transport reported sent, no session acknowledgement",
        /transport reported sent; no session acknowledgement/.test(unackedRow)
          && /transport outcome uncertain; recovery/.test(unackedRow)
          && /state: \$\{e\.recovery\.state\}/.test(unackedRow)
          && /effect: \$\{e\.recovery\.effect\}/.test(unackedRow),
        unackedRow.slice(0, 80));
      check("client: it never calls the send undelivered or failed, and every 'accept' is about tmux only",
        !/undelivered|failed/i.test(unackedRow)
          && [...unackedRow.matchAll(/accept\w*/gi)]
            .every((m) => /tmux/.test(unackedRow.slice(Math.max(0, (m.index ?? 0) - 40), m.index))),
        unackedRow.slice(0, 200));
      // THE ONE FALSE STATEMENT THIS ROW COULD MAKE. `send-uncertain` is persisted BEFORE tmux is
      // touched, so "tmux took the keystrokes" is unknowable on it — and that phrase sat in a SHARED
      // detail line until review caught it. Both lines must branch, the phrase may exist exactly
      // once, and it must live in the ELSE arm (the uncertain arm of `cond ? a : b` comes first).
      const took = (unackedRow.match(/tmux took the keystrokes/g) ?? []).length;
      const uncertainArmAt = unackedRow.indexOf("before Fleet could prove whether tmux accepted anything");
      check("client: BOTH lines branch on status — a send-uncertain row never claims tmux took the keystrokes",
        (unackedRow.match(/\buncertain\s*\?/g) ?? []).length === 2 && took === 1
          // a NEGATED condition would keep both counts and swap what each state is told, so the
          // positive form is part of the rule rather than a coincidence of how it is written
          && !/!\s*uncertain/.test(unackedRow)
          && uncertainArmAt > 0 && unackedRow.indexOf("tmux took the keystrokes") > uncertainArmAt
          && /may or may not be in the pane/.test(unackedRow)
          && /no session acknowledgement has arrived either way/.test(unackedRow),
        `branches=${(unackedRow.match(/\buncertain\s*\?/g) ?? []).length} took=${took} uncertainArmAt=${uncertainArmAt}`);
      check("client: the row carries no acknowledge affordance and posts nothing at all",
        !/\/ack\b/.test(unackedRow) && !/\bpost\(/.test(unackedRow) && !/onclick/.test(unackedRow),
        unackedRow.slice(0, 200));
      const btn = cliSrc.slice(sliceAt("renderOpsBtn"), sliceAt("setOpsEvents"));
      check("client: the badge prints the two counts side by side and never adds them",
        /opsUnacked\(opsRows, Date\.now\(\)\)\.length/.test(btn) && !/n \+ m|m \+ n/.test(btn),
        btn.slice(0, 200));
      // …and the THIRD carrier joins the FILED count, never the pane-transport one. Both halves of
      // `n` are rows that want the owner to close them, which is why adding them keeps one meaning;
      // adding a report to `m` would make the ⚠ badge claim a transport fact about a row that has
      // no live transport at all. The non-report filter is what stops an owner-inbox report — which
      // is BOTH an inbox event and an unjudged row — from being counted and shown twice.
      // The `m` EXPRESSION is what may not carry it — the title beside it names the number in prose
      // on purpose, so the owner can read what the badge is counting, and a probe over the whole
      // function body failed on exactly that sentence.
      const mExpr = btn.slice(btn.indexOf("const m ="), btn.indexOf(";", btn.indexOf("const m =")));
      check("client: a worker report awaiting the owner counts as FILED and is never mixed into the pane-transport count",
        /opsOpenNonReport\(opsRows\)\.length \+ reportsAwaitingOwner/.test(btn)
          && mExpr !== "" && !/reportsAwaitingOwner/.test(mExpr)
          && /e\.kind !== "fleet-report"/.test(cliSrc),
        `mExpr=${mExpr}`);
    }
  }

  // === MAIN-SESSION EXIT: tickMigrate ==========================================================
  // The isolated wrapper explicitly arms the otherwise-default-off tick at 44%. FLEET_CMD=true
  // pins no session id, so this fixture plants identities exactly as the restart/context tests do;
  // that is what makes three above-threshold controls distinguishable from ctx:null.
  {
    const openPlain = async (label?: string): Promise<number> => {
      const id = await freeSlot();
      if (!id) return 0;
      const r = await post(`/api/slots/${id}/open`, { cwd: REPO, ...(label ? { label } : {}) });
      return r.ok ? id : 0;
    };
    const mainId = await openPlain("migrate-main");
    const lane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const stewardId = await openPlain("⚙ steward");
    const unknownId = await openPlain("migrate-unknown");
    // TWO MORE CONTROLS, 2026-09-13. `boundId` is a claude MAIN the planted Program below binds, so
    // the main rail has an unbound AND a bound reader of the same 50%. `piId` is a FOREIGN harness
    // at the same fill: the stand-in `pi` makes it probe `alive`, and the restart below arms
    // FLEET_HARNESS_AUTOMATION, so canDeliver would admit it — only the tick's claude filter keeps it
    // silent. Without both of those the "no prompt" row would measure the harness gate instead.
    const boundId = await openPlain("migrate-bound-main");
    const piId = await freeSlot();
    const piOpen = piId
      ? await post(`/api/slots/${piId}/open`, { cwd: REPO, label: "migrate-pi", harness: "pi", model: "openai-codex/gpt-5.6-sol" })
      : null;
    check("migration tick setup: main, lane, steward, ctx-unknown, bound-main and pi controls are all active",
      mainId > 0 && lane.slot > 0 && stewardId > 0 && unknownId > 0 && boundId > 0 && piId > 0 && !!piOpen?.ok,
      JSON.stringify({ mainId, lane: lane.slot, stewardId, unknownId, boundId, piId, piStatus: piOpen?.status }));

    // Stop before editing fleet.json: a live saveState chain is allowed to replace the file, so an
    // edit made while srv runs would be a probe racing its subject. restartSrv starts it again with
    // the same FLEET_* env after the identities and usage files are in place.
    await stopSrv();
    const statePath = `${ROOT}/fleet.json`;
    type MigrateState = { slots?: Record<string, { cwd?: string; sessionId?: string; model?: string; openedAt?: number }>;
      programs?: Record<string, unknown>[] };
    let state: MigrateState | null = null;
    let stateError = "";
    try { state = JSON.parse(readFileSync(statePath, "utf8")) as MigrateState; }
    catch (e) { stateError = e instanceof Error ? e.message : String(e); }
    check("migration tick setup precondition: fleet state is readable before context mutation",
      state !== null, stateError);
    const ids = new Map<number, string>([
      [mainId, "e2e0feed-0000-4000-8000-000000000101"],
      [lane.slot, "e2e0feed-0000-4000-8000-000000000102"],
      [stewardId, "e2e0feed-0000-4000-8000-000000000103"],
      [boundId, "e2e0feed-0000-4000-8000-000000000104"],
    ]);
    const piSid = "e2e0feed-0000-4000-8000-000000000105";
    for (const [id, sid] of [...ids, [piId, piSid] as const])
      if (state?.slots?.[String(id)]) state.slots[String(id)]!.sessionId = sid;
    // Planted, not driven, for the hold block's reason further down: the tick reads only an ACTIVE
    // Program whose main names this living occupant (boundProgramForMain), and minting one through
    // the founding routes would measure those routes.
    const migrateProgramId = "e2e0feed".repeat(3);
    const migrateAt = Date.now() - 5000;
    if (state) state.programs = [...(state.programs ?? []), {
      id: migrateProgramId, title: "Migrate rail fixture", intent: "Tell a bound MAIN its own succession gate",
      successCriterion: "The bound MAIN is nudged without a HANDOFF commit", nonGoals: [], decisions: [],
      evidence: [], openQuestions: [], status: "active", createdAt: migrateAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: migrateAt - 900, activatedAt: migrateAt - 800,
      main: { slot: boundId, openedAt: state.slots?.[String(boundId)]?.openedAt,
        sessionId: ids.get(boundId), boundAt: migrateAt - 700 },
    }];
    if (state) writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });

    const usageFiles: string[] = [];
    if (state) for (const [id, sid] of ids) {
      const cwd = state.slots?.[String(id)]?.cwd ?? "";
      const dir = `${process.env.HOME}/.claude/projects/${cwd.replace(/[^a-zA-Z0-9]/g, "-")}`;
      mkdirSync(dir, { recursive: true });
      const file = `${dir}/${sid}.jsonl`;
      writeFileSync(file, `${JSON.stringify({ message: { usage: {
        input_tokens: 100_000, cache_creation_input_tokens: 100_000,
        cache_read_input_tokens: 300_000, output_tokens: 9_000_000,
      } } })}\n`);
      usageFiles.push(file);
    }
    // Pi's own usage format (piContextFile): the header proves cwd + UUID, the newest assistant
    // usage row is input+cacheRead+cacheWrite. 129 200 of the GPT window 258 400 is the same 50%.
    if (state) {
      const piReal = realpathSync(state.slots?.[String(piId)]?.cwd ?? REPO);
      const piDir = `${process.env.HOME}/.pi/agent/sessions/--${piReal.replace(/^\/+/, "").replaceAll("/", "-")}--`;
      mkdirSync(piDir, { recursive: true });
      const file = `${piDir}/2026-09-13T00-00-00.000Z_${piSid}.jsonl`;
      writeFileSync(file, `${JSON.stringify({ type: "session", version: 3, id: piSid,
        timestamp: "2026-09-13T00:00:00.000Z", cwd: piReal })}\n${JSON.stringify({ type: "message",
        message: { role: "assistant", usage: { input: 29_200, output: 9_000_000, cacheRead: 100_000,
          cacheWrite: 0, reasoning: 0, totalTokens: 9_129_200 } } })}\n`);
      usageFiles.push(file);
    }
    await restartSrv({ FLEET_HARNESS_AUTOMATION: "1" });

    type CtxRow = { id: number; ctx: { pct: number; windowTokens: number } | null };
    const ctxRows = ((await (await get("/api/sessions")).json()) as { slots: CtxRow[] }).slots;
    const ctxOf = (id: number) => ctxRows.find((x) => x.id === id)?.ctx;
    check("migration tick setup: main/lane/steward are measurably above 44%, while the unpinned control is ctx:null",
      ctxOf(mainId)?.pct === 50 && ctxOf(lane.slot)?.pct === 50 && ctxOf(stewardId)?.pct === 50
        && ctxOf(unknownId) === null,
      JSON.stringify({ main: ctxOf(mainId), lane: ctxOf(lane.slot), steward: ctxOf(stewardId), unknown: ctxOf(unknownId) }));
    // The two new controls must be DELIVERABLE subjects, or their rows below measure nothing: the
    // bound MAIN is 50% and bound live; the pi slot is 50% on its own window AND probes alive.
    let piAgent: string | null = null;
    for (let i = 0; i < 60 && piAgent !== "alive"; i++) {
      piAgent = ((await (await get("/api/sessions")).json()) as { slots: { id: number; agent: string | null }[] })
        .slots.find((x) => x.id === piId)?.agent ?? null;
      if (piAgent !== "alive") await Bun.sleep(200);
    }
    const migrateProgramLive = ((await (await get("/api/programs")).json()) as
      { programs?: { id: string; status: string; health?: { occupancy?: string } }[] })
      .programs?.find((p) => p.id === migrateProgramId) ?? null;
    check("migration tick setup: the bound MAIN is 50% and its planted Program is ACTIVE and bound live; the pi slot is 50% of 258400 and probes alive",
      ctxOf(boundId)?.pct === 50 && migrateProgramLive?.status === "active"
        && migrateProgramLive.health?.occupancy === "live"
        && ctxOf(piId)?.pct === 50 && ctxOf(piId)?.windowTokens === 258_400 && piAgent === "alive",
      JSON.stringify({ bound: ctxOf(boundId), program: migrateProgramLive, pi: ctxOf(piId), piAgent }));

    const migratePrompts = async (slot: number) => (await plogRead())
      .filter((e) => e.slot === slot && e.text.startsWith("[fleet] Dein Kontext ist bei "));
    let nudges = await migratePrompts(mainId);
    for (let i = 0; i < 80 && nudges.length === 0; i++) {
      await Bun.sleep(100);
      nudges = await migratePrompts(mainId);
    }
    check("tickMigrate sends exactly one prompt to an above-threshold NON-LANE main session",
      nudges.length === 1, `${nudges.length} prompt(s)`);
    const nudge = nudges[0]?.text ?? "";
    // since e3e5084a the unbound rail hands over a role-lineage record, not a HANDOFF commit
    check("the migration prompt names measured pct+window, says server predicate, then the line record (intent OR pointer) with self/succeed",
      nudge.includes("50%") && nudge.includes("1000000 Tokens im Fenster")
        && nudge.includes("Server-Prädikat, keine Meldung von dir")
        && nudge.indexOf("Linien-Record") >= 0 && nudge.indexOf("Linien-Record") < nudge.indexOf("POST /api/self/succeed")
        && nudge.includes("`intent`") && nudge.includes("`pointer`") && nudge.includes("nie beides")
        && !nudge.includes("HANDOFF.md schreiben")
        && nudge.includes("x-fleet-self-token aus der Umgebungsvariablen FLEET_SELF_TOKEN"), nudge);
    // THE LANE RAIL, 2026-09-12. Until this cut the check here asserted that a lane received
    // NOTHING — its only exit was to land, which is precisely what a lane too full to work well is
    // least able to do well. It now gets its OWN text on its OWN threshold
    // (FLEET_LANE_MIGRATE_PCT, armed by the wrapper beside FLEET_MIGRATE_PCT). The steward and the
    // ctx:null control still get nothing, which is the half of the old contract that never moved.
    let laneNudges = await migratePrompts(lane.slot);
    for (let i = 0; i < 80 && laneNudges.length === 0; i++) {
      await Bun.sleep(100);
      laneNudges = await migratePrompts(lane.slot);
    }
    const laneNudge = laneNudges[0]?.text ?? "";
    check("tickMigrate nudges an above-threshold LANE exactly once — same measured opening, the lane's own three acts",
      laneNudges.length === 1 && laneNudge.includes("50%")
        && laneNudge.includes("1000000 Tokens im Fenster")
        && laneNudge.includes("Server-Prädikat, keine Meldung von dir")
        && laneNudge.includes("DIESEM Worktree")
        && laneNudge.indexOf("committe") < laneNudge.indexOf("status `handoff`")
        && laneNudge.indexOf("status `handoff`") < laneNudge.indexOf("POST /api/self/succeed"),
      `${laneNudges.length}: ${laneNudge}`);
    check("…and the two texts are not one: a lane is never told to write and commit HANDOFF.md",
      !laneNudge.includes("HANDOFF.md") && !nudge.includes("handoff`"), `${nudge.slice(0, 80)} | ${laneNudge.slice(0, 80)}`);
    // THE ROLE, read off the binding (2026-09-13). The unbound main above is told the line record
    // (e3e5084a); the bound Standard Program-MAIN beside it must not be, because its handover is the
    // Program record. BREAKS IF: migrateMessage loses its rail argument (both mains get the same text)
    // or migrateRailOf stops consulting boundProgramForMain.
    let boundNudges = await migratePrompts(boundId);
    for (let i = 0; i < 80 && boundNudges.length === 0; i++) {
      await Bun.sleep(100);
      boundNudges = await migratePrompts(boundId);
    }
    const boundNudge = boundNudges[0]?.text ?? "";
    check("a bound Standard Program-MAIN is nudged once WITHOUT HANDOFF.md — offene Pflichten, then self/succeed with optional carry",
      boundNudges.length === 1 && !boundNudge.includes("HANDOFF.md")
        && boundNudge.includes("50%") && boundNudge.includes("Server-Prädikat, keine Meldung von dir")
        && boundNudge.indexOf("offene Pflichten") >= 0
        && boundNudge.indexOf("offene Pflichten") < boundNudge.indexOf("POST /api/self/succeed")
        && boundNudge.includes("carry") && !boundNudge.includes("Linien-Record") && nudge.includes("Linien-Record"),
      `${boundNudges.length}: ${boundNudge}`);
    check("tickMigrate never nudges the ⚙ steward or a ctx:null slot",
      (await migratePrompts(stewardId)).length === 0
        && (await migratePrompts(unknownId)).length === 0,
      JSON.stringify({ steward: (await migratePrompts(stewardId)).length,
        unknown: (await migratePrompts(unknownId)).length }));

    const tickMs = Number(process.env.FLEET_MIGRATE_TICK_MS ?? 60_000) | 0;
    await Bun.sleep(tickMs * 4 + 500);
    check("a second migration tick inside MIGRATE_COOLDOWN_MS sends no second prompt, on either rail",
      (await migratePrompts(mainId)).length === 1 && (await migratePrompts(lane.slot)).length === 1,
      `main=${(await migratePrompts(mainId)).length} lane=${(await migratePrompts(lane.slot)).length}`);
    // Read AFTER the main, lane and bound prompts arrived plus four more ticks, so the pi slot sat
    // in every one of those `due` scans at 50%, alive, with harness automation on. BREAKS IF: the
    // claude filter in tickMigrate is removed — the stand-in accepts the paste and this counts 1.
    check("tickMigrate never nudges a NON-claude harness slot above the threshold, while the claude slots beside it were nudged",
      (await migratePrompts(piId)).length === 0 && (await migratePrompts(mainId)).length === 1
        && (await migratePrompts(boundId)).length === 1,
      `pi=${(await migratePrompts(piId)).length} main=${(await migratePrompts(mainId)).length} bound=${(await migratePrompts(boundId)).length}`);

    // TWO THRESHOLDS, NOT ONE KNOB WITH TWO READERS. The restart resets the process-local marker,
    // so both 50% slots are eligible again; zeroing only the LANE threshold must therefore move
    // exactly one of the two counts. A shared knob (or a lane rail reading MIGRATE_PCT) would
    // either freeze both or move both, and both readings fail here.
    await restartSrv({ FLEET_LANE_MIGRATE_PCT: "0" });
    await Bun.sleep(tickMs * 4 + 500);
    check("FLEET_LANE_MIGRATE_PCT=0 silences the LANE rail alone — the main rail, re-armed by the restart, sends again",
      (await migratePrompts(mainId)).length === 2 && (await migratePrompts(lane.slot)).length === 1,
      `main=${(await migratePrompts(mainId)).length} lane=${(await migratePrompts(lane.slot)).length}`);

    // Restart resets the process-local marker. With the threshold still armed this same 50% slot
    // would be nudged again; overriding it to zero proves the stronger default-off contract: no
    // timer is registered, rather than a timer that merely decides not to send. The lane count is
    // read with it because MIGRATE_PCT is the MASTER switch: with no timer registered, the lane
    // rail cannot fire either, whatever its own (still non-zero) threshold says.
    // The planted Program leaves with this restart (the srv is down while the file is edited, same
    // reason as the plant above); the slot it bound is killed below with the rest.
    await stopSrv();
    const migrateCleaned = JSON.parse(readFileSync(statePath, "utf8")) as { programs?: { id?: string }[] };
    migrateCleaned.programs = (migrateCleaned.programs ?? []).filter((p) => p.id !== migrateProgramId);
    writeFileSync(statePath, JSON.stringify(migrateCleaned, null, 2), { mode: 0o600 });
    await restartSrv({ FLEET_MIGRATE_PCT: "0" });
    await Bun.sleep(tickMs * 4 + 500);
    check("FLEET_MIGRATE_PCT=0 registers no migration tick — neither rail sends, whatever the lane threshold is",
      (await migratePrompts(mainId)).length === 2 && (await migratePrompts(lane.slot)).length === 1,
      `main=${(await migratePrompts(mainId)).length} lane=${(await migratePrompts(lane.slot)).length}`);

    for (const id of [mainId, lane.slot, stewardId, unknownId, boundId, piId]) if (id) await post(`/api/slots/${id}/kill`, {});
    for (const file of usageFiles) rmSync(file, { force: true });
  }

  // === AN UNATTENDED SEND THAT IS NOT ACCEPTED ================================================
  // The five unattended senders (tickAuditPing, tickInboxNudge, tickBacklogNudge, tickMigrate,
  // deliverMergeVerdict) pasted without `rollbackOwnPayload` and threw the acceptance value away.
  // Measured live 2026-09-09/10: one unaccepted paste ("prompt not accepted — still holds 49
  // chars") left Fleet's OWN text in the composer, and the next eight attempts over thirteen
  // minutes were refused by it ("composer occupied (49 chars)") — the channel was blocked by the
  // sender's own residue. Two further halves rode with it: `s.quietUntil` is set only under the
  // flag, so the failed paste counted as OCCUPANT output in the very idle measurement the retry
  // consults; and tickInboxNudge stamped its tried-map only after SUCCESS, so the next tick walked
  // straight back into that composer with no cooldown at all.
  //
  // e2e/pins.ts holds the five callers at SOURCE, by name. This block measures the behaviour on
  // ONE of them, end to end: a real stand-in composer that refuses to consume its buffer (fake-pi
  // mode "hold" — no branch of its Enter handler matches, so the payload stays), driven by the tick
  // rather than by a route. Three facts, each falsified by removing exactly one half of the cut:
  // drop the flag and the composer keeps the payload; drop the tried-map stamp and the 250 ms tick
  // pastes again and again; drop the delivery word and prompts.jsonl says nothing about either.
  {
    const holdSlot = await freeSlot();
    // `pi`, not `pi-unfenced`: this send goes through canDeliver's foreign-harness WORK-PROMPT gate
    // (tickInboxNudge waives nothing), and pi-unfenced is `automatable: false` FOREVER — the gate
    // would refuse before sendText and the block would measure the gate instead of the composer.
    const holdOpen = holdSlot
      ? await post(`/api/slots/${holdSlot}/open`, { cwd: REPO, label: "inbox-hold-main", harness: "pi" }) : null;
    const holdRow = (await (await get("/api/sessions")).json() as
      { slots: { id: number; openedAt: number; sessionId: string | null; harness?: string }[] })
      .slots.find((s) => s.id === holdSlot);
    check("unattended-send fixture: a `pi` MAIN with a real stand-in composer is open",
      !!holdOpen?.ok && holdSlot > 0 && holdRow?.harness === "pi" && (holdRow?.openedAt ?? 0) > 0,
      JSON.stringify({ slot: holdSlot, status: holdOpen?.status, row: holdRow ?? null }));

    // The Program is planted, not driven: the inbox nudge asks only for an ACTIVE program whose
    // main binding names this living occupant and whose inbox has unread entries. Minting those
    // through their real producers (attention, fleet-report, audit ledger) would measure those
    // paths, which other blocks already do.
    await stopSrv();
    const holdStatePath = `${ROOT}/fleet.json`;
    const holdProgramId = "c0ffee".repeat(4);
    const holdImage = JSON.parse(readFileSync(holdStatePath, "utf8")) as
      { slots: Record<string, Record<string, unknown>>; programs?: Record<string, unknown>[] };
    const holdSlotRow = holdImage.slots[String(holdSlot)] ?? {};
    const holdAt = Date.now() - 5000;
    holdImage.programs = [...(holdImage.programs ?? []), {
      id: holdProgramId, title: "Unattended send rollback fixture",
      intent: "Prove a refused paste blocks nothing and is journalled",
      successCriterion: "The composer is empty, the attempt is stamped, the journal carries delivery",
      nonGoals: [], decisions: [], evidence: [], openQuestions: [],
      status: "active", createdAt: holdAt - 1000, proposedBy: { kind: "owner" },
      confirmedAt: holdAt - 900, activatedAt: holdAt - 800,
      main: { slot: holdSlot, openedAt: holdSlotRow.openedAt, sessionId: holdSlotRow.sessionId ?? null,
        boundAt: holdAt - 700 },
      inbox: { v: 1, dropped: 0, entries: [
        { id: "a".repeat(24), kind: "audit-red", at: holdAt - 600, ref: String(holdAt - 600), readBy: null, readAt: null },
        { id: "b".repeat(24), kind: "attention-answer", at: holdAt - 500, ref: "att-hold-fixture", readBy: null, readAt: null },
      ] },
    }];
    writeFileSync(holdStatePath, JSON.stringify(holdImage, null, 2), { mode: 0o600 });
    // FLEET_HARNESS_AUTOMATION=1 for exactly this restart (the wrapper runs the suite with 0, and
    // the plain restartSrv at the end of the block puts it back); the idle gate is shrunk because
    // its default is five minutes, and the tick is shrunk from its 60 s default so the block can
    // observe more than one round of it.
    await restartSrv({ FLEET_HARNESS_AUTOMATION: "1", FLEET_INBOX_NUDGE_MS: "250",
      FLEET_BACKLOG_NUDGE_IDLE_MS: "300" });
    const holdProgramLive = ((await (await get("/api/programs")).json()) as
      { programs?: { id: string; status: string; health?: { occupancy?: string };
        executionStatus?: { inbox?: { unread?: number } } }[] })
      .programs?.find((p) => p.id === holdProgramId) ?? null;
    check("unattended-send fixture: the planted program loaded ACTIVE, bound live to that occupant, with two unread inbox entries",
      holdProgramLive?.status === "active" && holdProgramLive.health?.occupancy === "live"
        && holdProgramLive.executionStatus?.inbox?.unread === 2,
      JSON.stringify(holdProgramLive));

    const holdMode = process.env.FLEET_E2E_COMPOSER_MODE ?? "";
    const holdState = process.env.FLEET_E2E_COMPOSER_STATE ?? "";
    // "hold" matches no branch of the stand-in's Enter handler, so its buffer survives the submit —
    // the deterministic form of the live "composer still holds N chars" non-acceptance.
    writeFileSync(holdMode, "hold\n");
    // The pane must have been OBSERVED (lastOutput !== 0 is a hard guard in tickInboxNudge, and
    // absence is never idleness), and then be idle past the shrunk gate. One Enter into an EMPTY
    // composer redraws it and types nothing.
    await tmuxOut("send-keys", "-t", `s${holdSlot}`, "Enter");
    await Bun.sleep(1200);
    const holdPrompts = async () => (await plogRead())
      .filter((e) => e.slot === holdSlot && e.text.startsWith("[fleet inbox] "));
    let holdLines = await holdPrompts();
    for (let i = 0; i < 100 && holdLines.length === 0; i++) {
      await Bun.sleep(100);
      holdLines = await holdPrompts();
    }
    const holdStateAfter = holdState && existsSync(holdState) ? readFileSync(holdState, "utf8") : "";
    const holdComposerBuf = holdStateAfter.slice(holdStateAfter.indexOf("\n") + 1);
    const holdPhase = holdStateAfter.split("\n")[0] ?? "";
    check("an unattended send whose payload is NOT accepted rolls its own payload back out of the composer",
      holdLines.length >= 1 && holdPhase.startsWith("backspace:") && holdComposerBuf === "",
      JSON.stringify({ lines: holdLines.length, phase: holdPhase, residue: holdComposerBuf.slice(0, 120) }));
    check("…and the prompt journal carries the DELIVERY state of that attempt, named by its failure class",
      holdLines.length >= 1 && holdLines[0]?.delivery === "SendNotAccepted"
        && holdLines[0]?.source === "auto",
      JSON.stringify(holdLines.map((l) => ({ delivery: l.delivery ?? null, source: l.source }))));
    // …and the FAILED attempt spends the cooldown. Ten ticks of the shrunk timer: without the stamp
    // every one of them pastes again, because neither the dedupe key nor lastAt had moved.
    await Bun.sleep(250 * 10 + 500);
    const holdAfterTicks = await holdPrompts();
    check("…and the failed attempt is STAMPED: ten further inbox-nudge ticks paste nothing more into the same composer",
      holdAfterTicks.length === 1,
      `${holdAfterTicks.length} attempt(s): ${JSON.stringify(holdAfterTicks.map((l) => l.delivery ?? null))}`);

    writeFileSync(holdMode, "normal\n");
    if (holdSlot) await post(`/api/slots/${holdSlot}/kill`, {});
    await stopSrv();
    const holdCleaned = JSON.parse(readFileSync(holdStatePath, "utf8")) as { programs?: { id?: string }[] };
    holdCleaned.programs = (holdCleaned.programs ?? []).filter((p) => p.id !== holdProgramId);
    writeFileSync(holdStatePath, JSON.stringify(holdCleaned, null, 2), { mode: 0o600 });
    await restartSrv(); // back to the wrapper's FLEET_HARNESS_AUTOMATION=0 and the default gates
  }

  // === ACCEPTED-BY-LAND (server.ts#acceptByLandReading) ========================================
  // Owner 2026-09-13, §D of docs/messungen/2026-09-13-task-aggregation-a-e-fable.md: 29 of 38
  // undecided reports were `complete` behind a land with a green or unknown audit. Planted with srv
  // down (reports, a Program, one `sent` task on a LIVE lane) plus ledger rows, because the rule
  // reads exactly the three durable facts a land leaves. One positive per audit colour, the four
  // named refusals, and the tick that closes a row whose audit arrives after boot.
  {
    const ablLane = (await (await post("/api/lanes", { repo: REPO })).json()) as { slot: number; cwd: string };
    const ablStatePath = `${ROOT}/fleet.json`;
    const outcomeFile = `${ROOT}/lane-outcomes.jsonl`;
    const auditFile = `${ROOT}/post-land-audits.jsonl`;
    const adjudicationFile = `${ROOT}/audit-adjudications.jsonl`;
    await stopSrv();
    // A REAL git repo for the descendant half (2026-09-15): the coverage probe asks git
    // `merge-base --is-ancestor`, so the two ancestry cases need commits that actually stand in
    // the relation — a synthetic sha answers 128 and proves only that git could not look. Built
    // beside the wrapper's throwaway repos, never inside the instance, and owned by this block.
    const ablGit = `${dirname(REPO)}/abl-ancestry`;
    rmSync(ablGit, { recursive: true, force: true });
    mkdirSync(ablGit, { recursive: true });
    const ablGitRun = (...args: string[]): string =>
      (spawnSync("git", ["-C", ablGit, ...args], { encoding: "utf8" }).stdout ?? "").trim();
    ablGitRun("init", "-q", "-b", "main");
    for (const cfg of [["user.email", "t@t"], ["user.name", "t"], ["commit.gpgsign", "false"]])
      ablGitRun("config", cfg[0]!, cfg[1]!);
    ablGitRun("commit", "-q", "--allow-empty", "-m", "A");
    const shaA = ablGitRun("rev-parse", "HEAD");     // the land
    ablGitRun("commit", "-q", "--allow-empty", "-m", "B");
    const shaB = ablGitRun("rev-parse", "HEAD");     // a later tip that CONTAINS the land
    ablGitRun("checkout", "-q", "--orphan", "side");  // an orphan root: shaB contains nothing of it
    ablGitRun("commit", "-q", "--allow-empty", "-m", "C");
    const shaC = ablGitRun("rev-parse", "HEAD");
    const ablState = JSON.parse(readFileSync(ablStatePath, "utf8")) as {
      slots: Record<string, { openedAt?: number; cwd?: string | null }>; programs?: Record<string, unknown>[];
      fleetReports?: Record<string, unknown>[]; tasks?: Record<string, unknown>[];
    };
    const ablProgram = "a".repeat(23) + "b";
    // fleet.json persists OCCUPIED slots only, so an empty slot is a number the map does not carry
    const emptySlot = Array.from({ length: 16 }, (_, i) => i + 1).find((id) => !ablState.slots[String(id)]?.cwd) ?? 0;
    const now = Date.now();
    const sha = (n: number): string => n.toString(16).padStart(40, "c");
    // one report per case: its status, whether its land is newer than the report, its audit colour,
    // and — since 2026-09-15 — the adjudication on that red and the repo/tip its ancestry is read in
    interface AblCase {
      status: string; land: "after" | "before"; audit: "green" | "red" | "unknown" | null;
      sent?: true; verdict?: "real" | "flake" | "stale-test" | "unknowable";
      repo?: string; mainAfter?: string;
    }
    const cases: Record<string, AblCase> = {
      green: { status: "complete", land: "after", audit: "green" },
      unknown: { status: "complete", land: "after", audit: "unknown" },
      red: { status: "complete", land: "after", audit: "red" },
      needsMain: { status: "needs-main", land: "after", audit: "green" },
      sent: { status: "complete", land: "after", audit: "green", sent: true },
      staleLand: { status: "complete", land: "before", audit: "green" },
      pending: { status: "complete", land: "after", audit: null },
      redFlake: { status: "complete", land: "after", audit: "red", verdict: "flake" },
      redStaleTest: { status: "complete", land: "after", audit: "red", verdict: "stale-test" },
      redUnknowable: { status: "complete", land: "after", audit: "red", verdict: "unknowable" },
      redReal: { status: "complete", land: "after", audit: "red", verdict: "real" },
      // both ancestry cases carry an UNJUDGED red, so what separates them is the git relation alone
      redDescendant: { status: "complete", land: "after", audit: "red", repo: ablGit, mainAfter: shaA },
      redNoDescendant: { status: "complete", land: "after", audit: "red", repo: ablGit, mainAfter: shaC },
    };
    const ids: Record<string, string> = {};
    const tips: Record<string, string> = {};
    let n = 0;
    for (const [name, c] of Object.entries(cases)) {
      n++;
      const id = (0xab000 + n).toString(16).padStart(24, "0");
      ids[name] = id;
      const branch = `fleet/abl-${name}`;
      const sent = c.sent === true;
      const worker = sent
        ? { slot: ablLane.slot, openedAt: ablState.slots[String(ablLane.slot)]?.openedAt ?? 1, sessionId: null, cwd: ablLane.cwd, branch }
        : { slot: emptySlot, openedAt: 1, sessionId: null, cwd: `/tmp/abl-${name}`, branch };
      const taskId = `abltask${name}`;
      ablState.tasks = [...(ablState.tasks ?? []), { id: taskId, originId: null, programId: ablProgram,
        text: `accepted-by-land fixture ${name}`, source: "owner", from: null, kind: "auftrag", repo: REPO,
        status: sent ? "sent" : "done", releasedBy: "owner", created: now - 90_000,
        slot: sent ? ablLane.slot : null, note: null }];
      ablState.fleetReports = [...(ablState.fleetReports ?? []), { id, reportedAt: now - 60_000,
        status: c.status, text: `accepted-by-land fixture ${name}`, worker,
        provenance: { taskId, originId: null, programId: ablProgram, instance: null },
        receiver: null, basis: "program", eventId: null }];
      const ts = c.land === "after" ? now - 30_000 : now - 120_000;
      const caseRepo = c.repo ?? REPO;
      const mainAfter = c.mainAfter ?? sha(n);
      tips[name] = mainAfter;
      const auditAt = now - 20_000 + n;
      appendFileSync(outcomeFile, `${JSON.stringify({ ts, branch, disposition: "landed", repo: caseRepo,
        mainAfter, programId: ablProgram })}\n`);
      if (c.audit) appendFileSync(auditFile, `${JSON.stringify({ at: auditAt, startedAt: now - 25_000,
        ms: 1, repo: caseRepo, main: "main", mainSha: mainAfter, result: c.audit, cmd: "abl", exitCode: c.audit === "green" ? 0 : 1,
        out: "", checks: null, covers: [{ branch, mainAfter, at: ts }] })}\n`);
      // the side rail, written exactly as the owner door writes it (server.ts#writeAuditAdjudication)
      if (c.verdict) appendFileSync(adjudicationFile, `${JSON.stringify({ at: now - 10_000, auditAt,
        verdict: c.verdict, by: "owner", note: "abl fixture" })}\n`);
    }
    // ONE later FULL green, on a tip that contains shaA and shares nothing with shaC. It covers no
    // branch at all, so it is never a covering row — only the ancestry probe can find it.
    appendFileSync(auditFile, `${JSON.stringify({ at: now - 5_000, startedAt: now - 6_000, ms: 1,
      repo: ablGit, main: "main", mainSha: shaB, result: "green", cmd: "abl-later-green", exitCode: 0,
      out: "ALL PASS", checks: { ran: 1, failed: 0 }, covers: [] })}\n`);
    ablState.programs = [...(ablState.programs ?? []), {
      id: ablProgram, title: "accepted-by-land fixture", intent: "Close landed reports by rule",
      successCriterion: "Rule closes exactly the landed complete rows", nonGoals: [], decisions: [], evidence: [],
      openQuestions: [], status: "active", createdAt: now - 1000, proposedBy: { kind: "owner" },
      confirmedAt: now - 900, activatedAt: now - 800 }];
    writeFileSync(ablStatePath, JSON.stringify(ablState, null, 2), { mode: 0o600 });
    await restartSrv({ FLEET_ACCEPT_BY_LAND_MS: "300" });
    type AblReport = { id: string; decision?: { disposition?: string; by?: unknown; mainAfter?: string; reason?: string } | null;
      decisionDelivery?: { state?: string } | null };
    const ablReports = async (): Promise<AblReport[]> =>
      ((await (await get("/api/fleet-report")).json()) as { reports?: AblReport[] }).reports ?? [];
    // WAIT FOR THE WHOLE PASS, not for the first row of it. The rule decides report by report and
    // AWAITS a git ancestry probe in between (server.ts#auditTipContains), so `green` — which needs
    // no probe — is decided milliseconds in while the rows behind it are still being read. Polling
    // on `green` alone measured the first tenth of one pass and reported the other twelve rows as
    // refusals: three checks below were red on a rule that was answering every one of them
    // correctly (measured on the preview of 8224aaa22704). The predicate is now every row this
    // block expects the rule to CLOSE; a settle that never happens shows up in the setup check.
    const ablExpected = ["green", "unknown", "redFlake", "redStaleTest", "redUnknowable", "redDescendant"];
    const ablSettled = (rs: AblReport[]): boolean =>
      ablExpected.every((k) => rs.find((r) => r.id === ids[k])?.decision);
    let rows = await ablReports();
    const ablWaitStart = Date.now();
    for (let i = 0; i < 150 && !ablSettled(rows); i++) {
      await Bun.sleep(200);
      rows = await ablReports();
    }
    const ablWaitedMs = Date.now() - ablWaitStart;
    const row = (name: string): AblReport | undefined => rows.find((r) => r.id === ids[name]);
    // the probe fails as ITSELF when a plant did not hydrate: every check below would otherwise read
    // an absent row as "undecided" and the refusals would pass on nothing (measured on the first run:
    // emptySlot 0 made fleetReportFrom discard all seven rows)
    check("accepted-by-land setup: all thirteen planted reports hydrated, the rule's pass settled, and the ancestry repo stands in the relation it claims",
      emptySlot > 0 && rows.filter((r) => Object.values(ids).includes(r.id)).length === Object.keys(cases).length
        && ablSettled(rows)
        && spawnSync("git", ["-C", ablGit, "merge-base", "--is-ancestor", shaA, shaB]).status === 0
        && spawnSync("git", ["-C", ablGit, "merge-base", "--is-ancestor", shaC, shaB]).status !== 0,
      JSON.stringify({ emptySlot, planted: Object.keys(cases).length,
        seen: rows.filter((r) => Object.values(ids).includes(r.id)).length, settled: ablSettled(rows),
        waitedMs: ablWaitedMs, undecided: ablExpected.filter((k) => !rows.find((r) => r.id === ids[k])?.decision),
        shaA, shaB, shaC }));
    // BREAKS IF: the rule is removed, or it stops stamping the rule principal and the land it read.
    check("accepted-by-land: a complete report whose lane landed behind a GREEN audit is accepted by rule, names mainAfter, and its verdict was carried",
      row("green")?.decision?.disposition === "accepted"
        && JSON.stringify(row("green")?.decision?.by) === JSON.stringify({ rule: "accepted-by-land" })
        && row("green")?.decision?.mainAfter === sha(1)
        && row("green")?.decisionDelivery?.state === "worker-gone",
      JSON.stringify(row("green")));
    // …and the rule's verdict reaches the report ledger like a door's, with the land it read. A
    // planted row has no OPEN line (it was never filed through the door), so only the decision is asked.
    const ablLedger = existsSync(`${ROOT}/fleet-reports.jsonl`)
      ? readFileSync(`${ROOT}/fleet-reports.jsonl`, "utf8").split("\n").filter(Boolean).flatMap((line) => {
        try { return [JSON.parse(line) as Record<string, unknown>]; } catch { return []; }
      }) : [];
    const ablGreenDecisions = ablLedger.filter((r) => r.id === ids.green && r.kind === "decision");
    check("fleet-report ledger: the accepted-by-land rule writes one DECISION row naming the rule and mainAfter",
      ablGreenDecisions.length === 1 && ablGreenDecisions[0]?.disposition === "accepted"
        && JSON.stringify(ablGreenDecisions[0]?.by) === JSON.stringify({ rule: "accepted-by-land" })
        && ablGreenDecisions[0]?.mainAfter === sha(1),
      JSON.stringify(ablGreenDecisions));
    check("accepted-by-land: an UNKNOWN audit on the land is accepted too, and the reason says unknown",
      row("unknown")?.decision?.disposition === "accepted" && (row("unknown")?.decision?.reason ?? "").includes("unknown"),
      JSON.stringify(row("unknown")?.decision));
    // BREAKS IF: the rule ignores the audit colour (the mutation §D names), the status, the task, or the land's age.
    check("accepted-by-land refusals: an UNJUDGED red, a needs-main report, a still-sent task and a land older than the report all stay undecided",
      !!row("red") && !row("red")?.decision && !!row("needsMain") && !row("needsMain")?.decision
        && !!row("sent") && !row("sent")?.decision && !!row("staleLand") && !row("staleLand")?.decision,
      JSON.stringify(Object.keys(cases).map((k) => [k, row(k)?.decision?.disposition ?? null])));
    // --- the two facts that may arrive AFTER a red (2026-09-15). Until then every red shut the
    // report forever, and a land tip is audited exactly once, so nothing was ever going to reopen it.
    // BREAKS IF: the adjudication join is dropped — the mutation the brief names makes this one red.
    check("accepted-by-land: a covering RED adjudicated flake, stale-test or unknowable no longer blocks, and the reason names the verdict it read",
      row("redFlake")?.decision?.disposition === "accepted"
        && row("redStaleTest")?.decision?.disposition === "accepted"
        && row("redUnknowable")?.decision?.disposition === "accepted"
        && (row("redUnknowable")?.decision?.reason ?? "").includes("adjudicated unknowable"),
      JSON.stringify(["redFlake", "redStaleTest", "redUnknowable"].map((k) => row(k)?.decision?.reason ?? null)));
    // BREAKS IF: `real` joins the cleared list — a human's "this land broke something" would auto-accept.
    check("accepted-by-land: a RED adjudicated real still blocks, and a later green that does NOT contain the land is not coverage",
      !!row("redReal") && !row("redReal")?.decision
        && !!row("redNoDescendant") && !row("redNoDescendant")?.decision,
      JSON.stringify({ redReal: row("redReal")?.decision ?? null, redNoDescendant: row("redNoDescendant")?.decision ?? null }));
    // BREAKS IF: the descendant probe is dropped, or it stops asking git and answers from the trail
    // alone — redNoDescendant above sees the SAME green row and must not be accepted by it.
    check("accepted-by-land: a later FULL green on a tip that CONTAINS the land supersedes the unjudged red, and the verdict names that tip",
      row("redDescendant")?.decision?.disposition === "accepted"
        && row("redDescendant")?.decision?.mainAfter === shaA
        && (row("redDescendant")?.decision?.reason ?? "").includes("post-land audit green")
        && (row("redDescendant")?.decision?.reason ?? "").includes(shaB.slice(0, 12)),
      JSON.stringify(row("redDescendant")?.decision));
    const ruleLines = auditRows().filter((a) => a.event === "fleet_report_rule_decision");
    check("accepted-by-land writes exactly one audit line per rule decision, naming report, land and origin",
      ruleLines.filter((a) => (a.detail ?? "").includes(ids.green!) && a.detail!.includes("via=boot")).length === 1
        && ruleLines.filter((a) => (a.detail ?? "").includes(ids.unknown!)).length === 1
        && ruleLines.filter((a) => (a.detail ?? "").includes(ids.redDescendant!)).length === 1
        && !ruleLines.some((a) => [ids.red, ids.needsMain, ids.sent, ids.staleLand, ids.redReal,
          ids.redNoDescendant].some((id) => (a.detail ?? "").includes(id!))),
      JSON.stringify(ruleLines.map((a) => a.detail)));
    check("accepted-by-land: a land with NO audit yet is pending at boot, never accepted",
      !!row("pending") && !row("pending")?.decision, JSON.stringify(row("pending")));
    appendFileSync(auditFile, `${JSON.stringify({ at: Date.now(), startedAt: Date.now() - 5, ms: 1, repo: REPO,
      main: "main", mainSha: tips.pending, result: "green", cmd: "abl", exitCode: 0, out: "", checks: null,
      covers: [{ branch: "fleet/abl-pending", mainAfter: tips.pending, at: now - 30_000 }] })}\n`);
    for (let i = 0; i < 40 && !row("pending")?.decision; i++) {
      await Bun.sleep(150);
      rows = await ablReports();
    }
    check("accepted-by-land: the TICK closes the pending row once its green audit is on the trail",
      row("pending")?.decision?.disposition === "accepted"
        && auditRows().some((a) => a.event === "fleet_report_rule_decision" && (a.detail ?? "").includes(ids.pending!)
          && a.detail!.includes("via=tick")),
      JSON.stringify(row("pending")?.decision));

    // cleanup: this block's plants leave the state and both ledgers exactly as later modules expect
    await post(`/api/slots/${ablLane.slot}/kill`, {});
    await stopSrv();
    const ablClean = JSON.parse(readFileSync(ablStatePath, "utf8")) as {
      programs?: { id?: string }[]; fleetReports?: { id?: string }[]; tasks?: { id?: string }[] };
    ablClean.programs = (ablClean.programs ?? []).filter((p) => p.id !== ablProgram);
    ablClean.fleetReports = (ablClean.fleetReports ?? []).filter((r) => !Object.values(ids).includes(r.id ?? ""));
    ablClean.tasks = (ablClean.tasks ?? []).filter((t) => !(t.id ?? "").startsWith("abltask"));
    writeFileSync(ablStatePath, JSON.stringify(ablClean, null, 2), { mode: 0o600 });
    // …and the three ledgers this block wrote into, each by the marker its own rows carry: the
    // branch name, the later-green's cmd, and the adjudication note. A row left behind would be read
    // by every later module as a real land, a real audit or a real owner verdict.
    for (const file of [outcomeFile, auditFile, adjudicationFile]) {
      if (!existsSync(file)) continue;
      writeFileSync(file, readFileSync(file, "utf8").split("\n")
        .filter((l) => l && !l.includes("fleet/abl-") && !l.includes("abl-later-green") && !l.includes("abl fixture"))
        .map((l) => `${l}\n`).join(""));
    }
    rmSync(ablGit, { recursive: true, force: true });
    await restartSrv();
  }

  // the receiver-identity family's late-learned-id case, run LAST: it restarts the server four times
  // and recycles one slot, and the pane fixtures above spend a bounded busy window it must not share
  await runLearnedSessionAck();
}

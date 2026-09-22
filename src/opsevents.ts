// the operations-inbox row shape, its two event classes, the two label functions the panel prints
// and the owner poll's projection of the trail — kept out of client.ts so they can be unit-tested
// without a DOM (e2e/watch.ts calls them directly) and so server.ts cuts the poll with the SAME
// predicate the board classifies with.

export interface FleetEventRow {
  id: string; watchId: string | null;
  // null on all three is the OWNER PRINCIPAL as receiver — a row filed here because no session
  // could receive it. It is not a missing value: there is no occupant to name.
  receiverSlot: number | null; receiverOpenedAt: number | null; receiverSessionId: string | null;
  createdAt: number;
  // the SERVER's union, copied whole. A local interface is a claim about a foreign surface, so an
  // omitted word here would silently make its rows unmatched rather than mis-typed.
  status: "pending" | "send-uncertain" | "delivered" | "acknowledged" | "receiver-gone"
    | "subject-gone" | "inbox";
  delivery?: "pane" | "inbox";
  kind: "lane-ready" | "host-commit-ready" | "merge-terminal" | "post-land-audit"
    | "deploy-terminal" | "command-job" | "lane-suite" | "clarification-request" | "fleet-report"
    | "supervisor-transition" | "harness-block" | "lane-review" | "succession-debt";
  subjectSlot?: number; subjectBranch?: string; subjectCwd?: string;
  subjectRepo?: string; subjectMainAfter?: string; subjectDeployId?: string; subjectJobId?: string;
  payload?: Record<string, unknown>;
  // the two transport clocks, carried for the derivation below. They already ride /api/sessions on
  // every event; nothing was added to the payload to read them.
  deliveredAt?: number | null;
  acknowledgedAt?: number | null;
  recovery?: {
    state: "retryable" | "blocked" | "terminal";
    reason: string;
    nextAction: string;
    effect: string;
    updatedAt: number;
  };
}

// the fields the two classes below decide on — nothing else, so a projected row classifies exactly
// like the full row it was cut from
type OpsClassFields = Pick<FleetEventRow, "delivery" | "status" | "createdAt" | "deliveredAt" | "acknowledgedAt">;

export const opsOpen = <T extends OpsClassFields>(rows: T[]): T[] =>
  rows.filter((e) => e.delivery === "inbox" && e.status === "inbox");

// PANE TRANSPORT WITHOUT A SESSION ACKNOWLEDGEMENT — a SECOND class, derived here and shown apart.
//
// `delivered` records one fact only: tmux accepted paste+Enter. Nothing in the conversation on the
// other side has said it read the text. The gap is measured: one event was delivered 3s after fire
// and acknowledged 368s later, when the owner noticed it sitting unsent in the composer. Until then
// the row was invisible debt — `delivered` is written once and otherwise read only as the receiver
// ack precondition, so nothing surfaced it and nothing ever will on its own.
//
// This is a LOOKING GLASS, not a mechanism: no retry, no replay, no timeout, no state change. It
// says exactly what is known — transport reported sent, no session acknowledgement — and never
// "undelivered", "failed" or "accepted", none of which this data can support. The owner cannot
// acknowledge these rows: seeing is not consuming, and the server's receiver-ack route is the only
// thing that may close them (its owner twin 409s a pane row by construction).
export const PANE_ACK_STALE_MS = 120_000;
const opsPaneUnackedAtAnyAge = (e: OpsClassFields): boolean => e.delivery !== "inbox"
  && (e.status === "delivered" || e.status === "send-uncertain")
  && !e.acknowledgedAt;
export const opsUnacked = <T extends OpsClassFields>(rows: T[], now: number): T[] =>
  rows.filter((e) => opsPaneUnackedAtAnyAge(e)
    // send-uncertain is persisted BEFORE tmux is touched, so it has no delivery clock at all;
    // createdAt is then the only honest origin, and it is never later than a delivery would be
    && now - (e.deliveredAt ?? e.createdAt) >= PANE_ACK_STALE_MS);

// --- THE OWNER POLL'S SHARE OF THE TRAIL. /api/sessions is polled every 2 s by every open tab and
// carried `events: fleetEvents` whole until 2026-09-13: every row of every receiver, every
// terminal row, every payload — measured on the live fleet that day, 117 rows and 182 857 B, of
// which the board rendered NONE (97 acknowledged, 18 inbox fleet-reports whose bodies the panel
// reads from GET /api/fleet-report, 2 receiver-gone/subject-gone). A byte budget over such a
// payload measures the activity of the whole fleet, not the poll.
//
// THE CUT is exactly what the panel can show: a filed row it lists (opsOpen, minus fleet-report,
// which has its own rail) and a pane row that can age into opsUnacked. The age itself is NOT
// applied here — the board judges it on its own clock between polls, so the server sends the row
// at any age. Rows outside the cut are not lost: GET /api/events serves the full trail.
//
// THE PROJECTION is exactly what the panel prints: the class fields above, the receiver, the
// subject that opsSubject names, the recovery lines opsUnackedRow prints, and per kind only the
// payload facts opsSummary reads. A field that leaves this list while a label still reads it is
// caught by e2e/watch.ts, which renders a full fixture of every kind through both.
export const opsPollVisible = (e: OpsClassFields & Pick<FleetEventRow, "kind">): boolean =>
  (opsOpen([e]).length === 1 && e.kind !== "fleet-report") || opsPaneUnackedAtAnyAge(e);

export type OpsPollRecovery = Omit<NonNullable<FleetEventRow["recovery"]>, "updatedAt">;
export type OpsPollRow = Pick<FleetEventRow, "id" | "kind" | "status" | "delivery" | "receiverSlot"
  | "createdAt" | "deliveredAt" | "acknowledgedAt" | "subjectSlot" | "subjectBranch" | "subjectRepo"
  | "subjectMainAfter" | "subjectDeployId" | "subjectJobId" | "payload"> & { recovery?: OpsPollRecovery };

// the source side is structural so server.ts can hand in its own FleetEvent union unchanged
export interface OpsPollSource extends OpsClassFields {
  id: string; kind: FleetEventRow["kind"]; receiverSlot: number | null;
  subjectSlot?: number; subjectBranch?: string; subjectRepo?: string; subjectMainAfter?: string;
  subjectDeployId?: string; subjectJobId?: string;
  recovery?: FleetEventRow["recovery"];
  payload?: object;
}

// per kind, the payload keys opsSummary reads — and nothing for the kinds that can never reach
// opsRow (a clarification and a supervisor transition are never inbox rows)
export const OPS_POLL_PAYLOAD_KEYS: Readonly<Record<FleetEventRow["kind"], readonly string[]>> = {
  "lane-ready": ["ahead", "dirty"],
  "host-commit-ready": ["ahead", "dirty"],
  "merge-terminal": ["status", "landed"],
  "post-land-audit": ["result"],
  "deploy-terminal": ["ok", "stage"],
  "command-job": ["result", "cmd"],
  "lane-suite": ["result", "branch", "failCount"],
  "clarification-request": [],
  "fleet-report": ["status", "taskId"],
  "supervisor-transition": [],
  "harness-block": ["signal", "tool", "count", "escalated"],
  "lane-review": ["taskId", "findingCount", "describedThisDiff", "raw"],
  "succession-debt": ["debtId", "rail", "respawned"],
};

export function opsPollRow(e: OpsPollSource): OpsPollRow {
  const full: Record<string, unknown> = { ...(e.payload ?? {}) };
  const payload: Record<string, unknown> = {};
  for (const k of OPS_POLL_PAYLOAD_KEYS[e.kind]) if (full[k] !== undefined) payload[k] = full[k];
  // the two derived facts: the verdict of a merge's verify, never its flags, and how many artefacts
  // a command job returned, never their paths and hashes
  const verify = full.verify;
  if (e.kind === "merge-terminal" && verify && typeof verify === "object")
    payload.verify = { ok: (verify as { ok?: unknown }).ok };
  if (e.kind === "command-job") payload.artifactCount = Array.isArray(full.artifacts) ? full.artifacts.length : 0;
  return {
    id: e.id, kind: e.kind, status: e.status, delivery: e.delivery, receiverSlot: e.receiverSlot,
    createdAt: e.createdAt, deliveredAt: e.deliveredAt, acknowledgedAt: e.acknowledgedAt,
    subjectSlot: e.subjectSlot, subjectBranch: e.subjectBranch, subjectRepo: e.subjectRepo,
    subjectMainAfter: e.subjectMainAfter, subjectDeployId: e.subjectDeployId, subjectJobId: e.subjectJobId,
    ...(e.recovery ? { recovery: { state: e.recovery.state, reason: e.recovery.reason,
      nextAction: e.recovery.nextAction, effect: e.recovery.effect } } : {}),
    payload,
  };
}

// what this row is ABOUT — the join key the owner would otherwise have to reconstruct by hand
export function opsSubject(e: OpsPollRow): string {
  if (e.kind === "post-land-audit") return `${e.subjectRepo ?? "?"} @ ${(e.subjectMainAfter ?? "").slice(0, 8)}`;
  if (e.kind === "deploy-terminal") return `deploy ${e.subjectDeployId ?? "?"}`;
  if (e.kind === "command-job") return `command job ${e.subjectJobId ?? "?"}`;
  if (e.kind === "lane-suite") return `preview suite ${e.subjectJobId ?? "?"}`;
  if (e.kind === "succession-debt") return `slot ${e.subjectSlot ?? "?"} · succession`;
  return `slot ${e.subjectSlot ?? "?"} · ${e.subjectBranch ?? "?"}`;
}

// terse and per kind, never the whole payload: the point is whether the owner must look further.
export function opsSummary(e: OpsPollRow): string {
  const p = e.payload ?? {};
  const verify = p.verify as { ok?: boolean | null } | undefined;
  if (e.kind === "merge-terminal")
    return `${String(p.status)} · landed=${p.landed === true ? "YES" : "NO"}`
      + (verify ? ` · verify=${verify.ok === true ? "ok" : verify.ok === false ? "FAILED" : "unverified"}` : "");
  if (e.kind === "post-land-audit") return `result=${String(p.result)}`;
  if (e.kind === "fleet-report")
    return `${String(p.status)} · task ${typeof p.taskId === "string" ? p.taskId.slice(0, 8) : "—"}`;
  if (e.kind === "deploy-terminal")
    return `ok=${p.ok === true ? "YES" : p.ok === false ? "NO" : "UNVERIFIED"} · stage=${String(p.stage)}`;
  if (e.kind === "command-job")
    return `result=${String(p.result)} · ${String(p.cmd)} · ${typeof p.artifactCount === "number" ? p.artifactCount : 0} artefact(s)`;
  // the branch rides along because a preview row names no slot the owner could look the tree up by:
  // the lane that offered it is usually gone by the time he reads this.
  // the TRUE count, not the length of the sample the row carries (it is capped at three)
  if (e.kind === "lane-review")
    return `③ ${p.raw === true ? "off-contract answer" : `${typeof p.findingCount === "number" ? p.findingCount : 0} finding(s)`}`
      + ` · task ${String(p.taskId).slice(0, 8)}`
      + ` · this diff: ${p.describedThisDiff === true ? "yes" : p.describedThisDiff === false ? "NO" : "unknown"}`;
  if (e.kind === "harness-block")
    return `${p.signal === "denied" ? "dialog DENIED" : "WAITING for a person"}`
      + ` · ${typeof p.tool === "string" ? p.tool : "—"} · ${typeof p.count === "number" ? p.count : 1}×`
      + (p.escalated === true ? " · ESCALATED" : "");
  if (e.kind === "succession-debt")
    return `${p.respawned === true ? "successor WITHOUT its brief" : "NO successor opened"} · ${String(p.rail)}`
      + ` · debt ${typeof p.debtId === "string" ? p.debtId.slice(0, 8) : "?"}`;
  if (e.kind === "lane-suite")
    return `result=${String(p.result)} · ${String(p.branch)}`
      + ` · ${typeof p.failCount === "number" ? p.failCount : 0} failure(s)`;
  return `${p.ahead ?? "?"} ahead / ${p.dirty ?? "?"} dirty`;
}

// the operations-inbox row shape and its two event classes, kept out of client.ts so they can
// be unit-tested without a DOM (e2e/watch.ts calls opsOpen/opsUnacked directly).

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
    | "supervisor-transition";
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

export const opsOpen = (rows: FleetEventRow[]): FleetEventRow[] =>
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
export const opsUnacked = (rows: FleetEventRow[], now: number): FleetEventRow[] =>
  rows.filter((e) => e.delivery !== "inbox"
    && (e.status === "delivered" || e.status === "send-uncertain")
    && !e.acknowledgedAt
    // send-uncertain is persisted BEFORE tmux is touched, so it has no delivery clock at all;
    // createdAt is then the only honest origin, and it is never later than a delivery would be
    && now - (e.deliveredAt ?? e.createdAt) >= PANE_ACK_STALE_MS);

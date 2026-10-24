// THE CEILING OF A HELD EVENT, read from the server's own rows (e2e/watch.ts, held backoff). The
// promise (server.ts#holdBackoffMs) is that a cleared composer is probed again within
// HOLD_BACKOFF_MAX_MS. The check used to measure it as wall clock from the release to the observed
// `delivered`. That also counted Fleet TYPING something else into the same pane first: the
// fixture's own slot kill fires audit watches at the same receiver, their holds can fall due
// before this one, and their bundle took ~4.5 s to type (merge checks 1024042626-67bb3141 and
// 1024100528-bb69cdaf: 6974 and 6644 ms over a 6000 ms bound). Typing into the pane is not silence
// toward it. So the bound starts at whichever comes later: this hold's own due time, or the end of
// the last other delivery typed into that pane before this one.
export interface HoldRow { event?: string; slot?: number; detail?: string; ts?: number; phase?: string;
  nextProbeInMs?: number }

export interface HoldCeiling {
  ok: boolean; why: string; dueAt: number | null; anchorAt: number | null; endAt: number | null;
  typedBefore: number[];
}

const typedOther = (r: HoldRow): boolean => r.event === "fleet_event_delivered" || r.event === "fleet_event_send_uncertain"
  || (r.event === "fleet_event_held" && r.phase === "end" && (r.detail ?? "").includes("typed into it"));

export function holdCeiling(o: { rows: HoldRow[]; eventId: string; receiverSlot: number; releaseAt: number;
  capMs: number; slackMs: number }): HoldCeiling {
  const held = o.rows.filter((r) => r.event === "fleet_event_held" && (r.detail ?? "").startsWith(o.eventId));
  const probes = held.filter((r) => r.phase === "entry" || r.phase === "repeat");
  const last = probes.at(-1);
  const endAt = held.find((r) => r.phase === "end")?.ts ?? null;
  const dueAt = last?.ts !== undefined && last.nextProbeInMs !== undefined ? last.ts + last.nextProbeInMs : null;
  // what Fleet typed into the same pane before this event (what came before the release lies before
  // the due time and moves nothing): a row that names
  // ANOTHER event and says it was typed. Not the `send` row: it names no event, and this event's
  // own send lands a millisecond before its end (1024042626-67bb3141), which would excuse anything.
  const typedBefore = endAt === null ? [] : o.rows
    .filter((r) => r.slot === o.receiverSlot && !(r.detail ?? "").includes(o.eventId)
      && (r.ts ?? 0) <= endAt && typedOther(r))
    .map((r) => r.ts!);
  const anchorAt = dueAt === null ? null : Math.max(dueAt, ...typedBefore);
  const verdict = (ok: boolean, why: string): HoldCeiling => ({ ok, why, dueAt, anchorAt, endAt, typedBefore });
  if (!last || dueAt === null) return verdict(false, "no probe row for the event");
  if ((last.ts ?? 0) > o.releaseAt) return verdict(false, "the cleared composer was refused again");
  if (dueAt - o.releaseAt > o.capMs) return verdict(false, "the promised probe lies past the ceiling");
  if (endAt === null) return verdict(false, "the hold never ended");
  if (endAt - anchorAt! > o.slackMs) return verdict(false, "the probe came late");
  return verdict(true, "probed within the ceiling");
}

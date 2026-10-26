// THE WAIT REGISTER — every row of the start plan that does not start now, with WHY it waits and
// WHO can end the wait (queue row 84888f35, which replaced the stall sensor of 80f61ed8).
//
// On 2026-09-15 claude-fleet stood ~3.5 h with 17 released waves, 0 startable, a cap of 3 and 1–2
// lanes, and no mechanism said so. Every blocker was a wait with nobody addressed: an unconfirmed
// criterion, an `after` on a row that was gone, collisions behind a lane that itself waited. The plan
// already knew each row's `next`; what it did not say was whose move it is. This file says that.
//
// PURE: it reads the plan server.ts#startPlanNow projected plus the facts handed in (rows, lanes,
// bound MAINs) and returns the rows. No state, no clock, no I/O — the table is
// derived on every read. The server separately retains observations as blocker sections.
//
// THE ADDRESSEE (`adressat`) is one of four words:
//   owner          the owner acts (a release, a criterion to confirm, a decision on a missing row)
//   main:<program> the program's bound MAIN acts (its hold, its release, its row's card)
//   slot:<n>       a lane works on it — the wait ends when that lane lands or closes
//   tick           nobody has to act: a lane cap, which the tick resolves as lanes free up
// A chain (row → row → lane) is followed to its head: the addressee is the HEAD's, and `kette`
// names every link on the way, so a row three deep behind a lane parked on the owner says „[Zitat entfernt]“.
import type { StartPlan, StartPlanNext, StartPlanReleaseVerdict } from "./start-plan";

export type BlockerArt = "hold" | "release" | "after" | "wave" | "unchecked" | "collision" | "cap" | "tick" | "unknown";
export interface BlockerSection { art: BlockerArt; adressat: string; wurzel: string; von: number; bis: number | null }
export interface BlockerHistory {
  freigabe: number | null;
  dispatch: number | null;
  abschnitte: BlockerSection[];
}
export interface BlockerTotals { freigabe: number | null; dispatch: number | null; ms: Partial<Record<BlockerArt, number>>; unknown: boolean }

// `seenUntil`: the row's last observation before the restart (server.ts#blockerObservedAt, written
// with every state save). An OPEN section is closed there — it was observed that long — and only the
// stretch from there to the next observation stays `unknown`. Without it (an older state file, a
// value before the section began) the open section closes at its own start, as before. Measured
// 2026-10-11 (Red Team 2, B): closing at the start booked 61 % of that day's wait hours `unknown`.
export function loadBlockerHistory(value: unknown, seenUntil?: unknown): BlockerHistory | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const r = value as Record<string, unknown>;
  const timestamp = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!(r.freigabe === null || timestamp(r.freigabe)) || !(r.dispatch === null || timestamp(r.dispatch))
    || !Array.isArray(r.abschnitte)) return undefined;
  const arts: readonly string[] = ["hold", "release", "after", "wave", "unchecked", "collision", "cap", "tick", "unknown"];
  const abschnitte: BlockerSection[] = [];
  for (const [index, raw] of r.abschnitte.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const section = raw as Record<string, unknown>;
    if (typeof section.art !== "string" || !arts.includes(section.art) || typeof section.adressat !== "string"
      || typeof section.wurzel !== "string" || !timestamp(section.von)
      || !(section.bis === null || (timestamp(section.bis) && section.bis >= section.von))) return undefined;
    if (section.bis === null && index !== r.abschnitte.length - 1) return undefined;
    const previous = abschnitte.at(-1);
    if (previous && (previous.bis === null || previous.bis !== section.von)) return undefined;
    const closeAt = timestamp(seenUntil) && seenUntil >= section.von ? seenUntil : section.von;
    abschnitte.push({ art: section.art as BlockerArt, adressat: section.adressat, wurzel: section.wurzel,
      von: section.von, bis: section.bis === null ? closeAt : section.bis });
  }
  return { freigabe: r.freigabe, dispatch: r.dispatch, abschnitte };
}

export function observeBlocker(history: BlockerHistory, wait: WaitRow | undefined, now: number): BlockerHistory {
  const reason = wait ? { art: wait.art, adressat: wait.adressat, wurzel: wait.wurzel }
    : { art: "unknown" as const, adressat: "unknown", wurzel: "startbereit; kein Wartegrund im Register, Dispatch noch nicht beobachtet" };
  const current = history.abschnitte.at(-1);
  if (current?.bis === null && current.art === reason.art && current.adressat === reason.adressat
    && current.wurzel === reason.wurzel) return history;
  const abschnitte = history.abschnitte.map((s) => ({ ...s }));
  const last = abschnitte.at(-1);
  const from = last?.bis ?? history.freigabe;
  if ((!last || last.bis !== null) && from !== null && from !== undefined && from < now)
    abschnitte.push({ art: "unknown", adressat: "unknown", wurzel: "keine Beobachtung", von: from, bis: now });
  if (!last || last.bis !== null || last.art !== reason.art || last.adressat !== reason.adressat || last.wurzel !== reason.wurzel) {
    if (last?.bis === null) last.bis = now;
    abschnitte.push({ ...reason, von: now, bis: null });
  }
  return { ...history, dispatch: null, abschnitte };
}

export function finishBlockers(history: BlockerHistory, now: number): BlockerHistory {
  const abschnitte = history.abschnitte.map((s) => ({ ...s }));
  const last = abschnitte.at(-1);
  if (last?.bis === null) last.bis = now;
  else if ((last?.bis ?? history.freigabe) !== null && (last?.bis ?? history.freigabe)! < now)
    abschnitte.push({ art: "unknown", adressat: "unknown", wurzel: "keine Beobachtung",
      von: (last?.bis ?? history.freigabe)!, bis: now });
  return { ...history, dispatch: now, abschnitte };
}

export function blockerTotals(history: BlockerHistory): BlockerTotals {
  const ms: BlockerTotals["ms"] = {};
  for (const section of history.abschnitte) {
    if (section.bis === null) continue;
    const end = section.bis;
    ms[section.art] = (ms[section.art] ?? 0) + Math.max(0, end - section.von);
  }
  return { freigabe: history.freigabe, dispatch: history.dispatch, ms,
    unknown: history.freigabe === null || history.dispatch === null || (ms.unknown ?? 0) > 0 };
}

export interface WaitRowFacts {
  status: string;
  programId: string | null;
  // the slot a `sent` row runs on; null otherwise
  slot: number | null;
  hold: { slot: number; grund: string | null; at: number; until?: { kind: string; task?: string } } | null;
}
export interface WaitLaneFacts {
  programId: string | null;
  // a lane parked on someone: an unconfirmed criterion or `awaiting` owner → „[Zitat entfernt]“; awaiting main → „[Zitat entfernt]“
  parked: "owner" | "main" | null;
  // since when it is parked, when a fact says so (criterion.proposedAt); null = not known
  since: number | null;
}
export interface WaitFacts {
  plan: StartPlan;
  // EVERY queue row by id — an `after` target that left the plan is still read here
  rows: Readonly<Record<string, WaitRowFacts>>;
  lanes: Readonly<Record<number, WaitLaneFacts>>;
  // programId → the slot of its LIVE bound MAIN, absent/null = none
  mains: Readonly<Record<string, number | null>>;
}

export interface WaitRow {
  repo: string;
  id: string;
  art: BlockerArt;
  intentionalHold: boolean;
  // the row's OWN reason, in one sentence
  grund: string;
  // who ends the wait — the head of the chain (see the header)
  adressat: string;
  // the links from this row to the head, e.g. ["row 1a2b3c4d", "lane 3"]; [] = the row is the head
  kette: string[];
  // the head's own reason — what the addressee is asked to act on
  wurzel: string;
  // since when, from a stored fact (hold.at, criterion.proposedAt); null = no fact, never the clock
  seit: number | null;
  // the row itself is released (a start plan verdict) — only released rows can form a stall
  freigegeben: boolean;
}

interface Head { adressat: string; wurzel: string; seit: number | null; intentionalHold?: boolean }
type Edge = { head: Head } | { row: string; label: string } | { lane: number; label: string };

const programAddressee = (programId: string | null, mains: WaitFacts["mains"]): string =>
  programId && typeof mains[programId] === "number" ? `main:${programId}` : "owner";

/** Every waiting row of the plan with its reason and its addressee — see the file header. */
export function deriveWaits(facts: WaitFacts): WaitRow[] {
  const { plan, rows, lanes, mains } = facts;
  // the row's wave and its release verdict, for every row the plan carries
  const inPlan = new Map<string, { repo: string; next: StartPlanNext; release: StartPlanReleaseVerdict | null }>();
  for (const repo of plan.repos) for (const wave of repo.waves) for (const row of wave.rows)
    inPlan.set(row.id, { repo: repo.repo, next: wave.next, release: row.release });

  const laneHead = (slot: number, why: string): Head => {
    const lane = lanes[slot];
    if (lane?.parked === "owner")
      return { adressat: "owner", wurzel: `lane ${slot} waits on the owner (criterion or question) — ${why}`, seit: lane.since };
    if (lane?.parked === "main")
      return { adressat: programAddressee(lane.programId, mains), wurzel: `lane ${slot} waits on its MAIN — ${why}`, seit: lane.since };
    return { adressat: `slot:${slot}`, wurzel: `lane ${slot} is working — ${why}`, seit: null };
  };

  // The ONE edge a row's wait follows, or its head when the row itself is the end of the chain.
  const edgeOf = (id: string): Edge => {
    const at = inPlan.get(id);
    const row = rows[id];
    const programId = row?.programId ?? null;
    // 1. a row that is not released waits on a release, whatever its wave says after that
    if (at?.release && !at.release.released) {
      if (row?.hold) return { head: { adressat: programAddressee(programId, mains),
        wurzel: `${id} held by the MAIN (slot ${row.hold.slot}) — ${row.hold.grund === null ? "no reason given" : `reason: ${row.hold.grund}`}`,
        seit: row.hold.at || null, intentionalHold: !!row.hold.grund?.trim() || (row.hold.until?.kind === "land"
          && !!row.hold.until.task && ["queued", "sent"].includes(rows[row.hold.until.task]?.status)) } };
      return { head: { adressat: programAddressee(programId, mains),
        wurzel: `${id} not released${at.release.why ? ` — ${at.release.why}` : ""}`, seit: null } };
    }
    const next = at?.next;
    if (!next || next === "now") return { head: { adressat: "tick", wurzel: `${id} starts`, seit: null } };
    if ("after" in next) {
      if (next.missing) return { head: { adressat: programAddressee(programId, mains),
        wurzel: `after ${next.after} is no longer a queue row — the edge never clears on its own`, seit: null } };
      const target = rows[next.after];
      if (inPlan.has(next.after)) return { row: next.after, label: `row ${next.after} (after)` };
      if (target?.status === "sent" && target.slot !== null)
        return { lane: target.slot, label: `row ${next.after} (after) on lane ${target.slot}` };
      // a target outside the plan that is neither running nor done lands on its own never
      return { head: { adressat: programAddressee(programId, mains),
        wurzel: `after ${next.after} is ${target?.status ?? "unknown"} and will not land`, seit: null } };
    }
    if ("unreleased" in next) {
      const partner = next.unreleased.find((p) => p !== id) ?? next.unreleased[0];
      return { row: partner, label: `row ${partner} (wave partner)` };
    }
    if ("unchecked" in next) return { head: { adressat: "owner",
      wurzel: `${next.unchecked.join(", ")} has no plan row — the plan cannot check the wave`, seit: null } };
    if ("collides" in next) {
      const { slot, row: other, file, symbol } = next.collides;
      const on = `${file}${symbol ? `#${symbol}` : ""}`;
      if (slot !== undefined) return { lane: slot, label: `lane ${slot} on ${on}` };
      return { row: other ?? "", label: `row ${other} on ${on}` };
    }
    return { head: { adressat: "tick", wurzel: next.cap, seit: null } };
  };

  const ownArt = (id: string): BlockerArt => {
    const at = inPlan.get(id);
    if (at?.release && !at.release.released) return rows[id]?.hold ? "hold" : "release";
    const next = at?.next;
    if (!next || next === "now") return "tick";
    if ("after" in next) return "after";
    if ("unreleased" in next) return "wave";
    if ("unchecked" in next) return "unchecked";
    if ("collides" in next) return "collision";
    return "cap";
  };

  const ownReason = (id: string): string => {
    const at = inPlan.get(id);
    const row = rows[id];
    if (at?.release && !at.release.released) return row?.hold
      ? `held by the MAIN (slot ${row.hold.slot})${row.hold.grund === null ? ", no reason given" : `: ${row.hold.grund}`}`
      : `not released${at.release.why ? ` — ${at.release.why}` : ""}`;
    const next = at?.next;
    if (!next || next === "now") return "starts";
    if ("after" in next) return next.missing ? `after ${next.after} is no longer a queue row` : `waiting on ${next.after} (after, not landed)`;
    if ("unreleased" in next) return `wave partner ${next.unreleased.join(", ")} not released`;
    if ("unchecked" in next) return `${next.unchecked.join(", ")} not checked`;
    if ("collides" in next) {
      const { slot, row: other, file, symbol } = next.collides;
      return `collides with ${slot !== undefined ? `lane ${slot}` : `row ${other} ahead`} on ${file}${symbol ? `#${symbol}` : ""}`;
    }
    return next.cap;
  };

  // Follow the edges to the head. A cycle (two rows each waiting on the other) is its own head:
  // nobody's move ends it but a decision, so it goes to the owner and names itself.
  const resolve = (id: string): { head: Head; kette: string[] } => {
    const kette: string[] = [];
    const seen = new Set<string>([id]);
    let current = id;
    for (;;) {
      const edge = edgeOf(current);
      if ("head" in edge) return { head: edge.head, kette };
      kette.push(edge.label);
      if ("lane" in edge) return { head: laneHead(edge.lane, edge.label), kette };
      if (seen.has(edge.row)) return { head: { adressat: "owner", wurzel: `cycle: ${[...seen].join(" → ")} → ${edge.row}`, seit: null }, kette };
      seen.add(edge.row);
      current = edge.row;
    }
  };

  const out: WaitRow[] = [];
  for (const repo of plan.repos) for (const wave of repo.waves) {
    if (wave.next === "now") continue;
    for (const row of wave.rows) {
      const { head, kette } = resolve(row.id);
      out.push({ repo: repo.repo, id: row.id, art: ownArt(row.id), intentionalHold: head.intentionalHold === true, grund: ownReason(row.id), adressat: head.adressat, kette,
        wurzel: head.wurzel, seit: head.seit, freigegeben: row.release?.released === true });
    }
  }
  return out;
}

/**
 * THE STALL READING of one repo: released work waits, none of it starts now, the repo has a free
 * lane — and at least one released row's wait is somebody's move, not the tick's. A wait on a lane
 * cap is capacity, never a stall (the cap is full or the tick fills it). Pure; the clock that makes a
 * reading a STALL (it must hold STALL_MS) lives in server.ts, because a clock is state.
 */
export interface StallReading { repo: string; stuck: boolean; lanes: number; cap: number | null; waits: WaitRow[] }
export function stallReadings(plan: StartPlan, waits: readonly WaitRow[]): StallReading[] {
  const workingLane = (w: WaitRow): boolean => w.adressat.startsWith("slot:");
  return plan.repos.map((repo) => {
    const now = repo.waves.some((w) => w.next === "now");
    const stuckRows = waits.filter((w) => w.repo === repo.repo && w.freigegeben && w.adressat !== "tick" && !w.intentionalHold
      && !workingLane(w));
    const free = repo.cap !== null && repo.lanes < repo.cap.max;
    return { repo: repo.repo, stuck: !now && free && stuckRows.length > 0, lanes: repo.lanes,
      cap: repo.cap?.max ?? null, waits: stuckRows };
  });
}

// THE HEADS a stall attention names, one line per distinct (addressee, root), the rows behind each.
export function stallHeads(waits: readonly WaitRow[]): { adressat: string; wurzel: string; seit: number | null; ids: string[] }[] {
  const heads: { adressat: string; wurzel: string; seit: number | null; ids: string[] }[] = [];
  for (const w of waits) {
    const hit = heads.find((h) => h.adressat === w.adressat && h.wurzel === w.wurzel);
    if (hit) hit.ids.push(w.id);
    else heads.push({ adressat: w.adressat, wurzel: w.wurzel, seit: w.seit, ids: [w.id] });
  }
  return heads;
}

// A text that names an order — `NACH: 1a2b3c4d` as a filing header, or inline "nach 1a2b3c4d",
// "after 1a2b3c4d", "wartet auf 1a2b3c4d", "folgt auf 1a2b3c4d" — names ids a card must carry as
// `after` (4ae22c7a: K3 started 13 min after filing because its NACH stood only in the prose).
// A header line counts every 8-hex token on it; inline, only the token right after the word. The
// caller decides which of these are queue rows — a commit sha in prose is not an order.
const NACH_HEADER = /^\s*NACH\s*:(.*)$/gim;
const NACH_INLINE = /\b(?:nach|after|wartet auf|folgt auf)\s*:?\s+`?([0-9a-f]{8})\b/gi;
export function namedAfterIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(NACH_HEADER)) for (const id of m[1].match(/\b[0-9a-f]{8}\b/g) ?? []) ids.add(id);
  for (const m of text.matchAll(NACH_INLINE)) ids.add(m[1].toLowerCase());
  return [...ids];
}

// THE ONE SENTENCE all three release doors speak for an order the text names and the card does not
// carry — the MAIN release door (server.ts#releaseCardRefusal), the owner's ▸ queue door and
// start-plan.ts#releaseVerdict under card-valid. Shared verbatim so a row is refused in the same
// words wherever the card is trusted (Schnitt 1, docs/messungen/2026-09-21-dispatch-flaechen-buendeln.md §c).
export function afterOrderRefusal(missing: readonly string[], carried?: readonly string[]): string {
  return `the text orders it after ${missing.join(", ")} but card.after carries ${(carried ?? []).join(", ") || "nothing"} — `
    + "the plan reads the order from the card alone; put the ids on a NACH: header line so the card sweep reads them";
}

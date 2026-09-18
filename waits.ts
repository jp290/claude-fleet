// THE WAIT REGISTER — every row of the start plan that does not start now, with WHY it waits and
// WHO can end the wait (queue row 84888f35, which replaced the stall sensor of 80f61ed8).
//
// On 2026-09-15 claude-fleet stood ~3.5 h with 17 released waves, 0 startable, a cap of 3 and 1–2
// lanes, and no mechanism said so. Every blocker was a wait with nobody addressed: an unconfirmed
// criterion, an `after` on a row that was gone, collisions behind a lane that itself waited. The plan
// already knew each row's `next`; what it did not say was whose move it is. This file says that.
//
// PURE: it reads the plan server.ts#startPlanNow projected plus the facts handed in (rows, lanes,
// bound MAINs) and returns the rows. No state, no clock, no I/O, never persisted — the table is
// derived on every read, so it cannot drift from the plan it explains.
//
// THE ADDRESSEE (`adressat`) is one of four words:
//   owner          the owner acts (a release, a criterion to confirm, a decision on a missing row)
//   main:<program> the program's bound MAIN acts (its hold, its release, its row's card)
//   slot:<n>       a lane works on it — the wait ends when that lane lands or closes
//   tick           nobody has to act: a lane cap, which the tick resolves as lanes free up
// A chain (row → row → lane) is followed to its head: the addressee is the HEAD's, and `kette`
// names every link on the way, so a row three deep behind a lane parked on the owner says "owner".
import type { StartPlan, StartPlanNext, StartPlanReleaseVerdict } from "./start-plan";

export interface WaitRowFacts {
  status: string;
  programId: string | null;
  // the slot a `sent` row runs on; null otherwise
  slot: number | null;
  hold: { slot: number; grund: string | null; at: number } | null;
}
export interface WaitLaneFacts {
  programId: string | null;
  // a lane parked on someone: an unconfirmed criterion or `awaiting` owner → "owner"; awaiting main → "main"
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

interface Head { adressat: string; wurzel: string; seit: number | null }
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
      return { adressat: "owner", wurzel: `lane ${slot} wartet auf den Owner (Kriterium oder Rueckfrage) — ${why}`, seit: lane.since };
    if (lane?.parked === "main")
      return { adressat: programAddressee(lane.programId, mains), wurzel: `lane ${slot} wartet auf ihre MAIN — ${why}`, seit: lane.since };
    return { adressat: `slot:${slot}`, wurzel: `lane ${slot} arbeitet — ${why}`, seit: null };
  };

  // The ONE edge a row's wait follows, or its head when the row itself is the end of the chain.
  const edgeOf = (id: string): Edge => {
    const at = inPlan.get(id);
    const row = rows[id];
    const programId = row?.programId ?? null;
    // 1. a row that is not released waits on a release, whatever its wave says after that
    if (at?.release && !at.release.released) {
      if (row?.hold) return { head: { adressat: programAddressee(programId, mains),
        wurzel: `${id} gehalten von der MAIN (Slot ${row.hold.slot}) — ${row.hold.grund === null ? "ohne Grund" : `Grund: ${row.hold.grund}`}`,
        seit: row.hold.at || null } };
      return { head: { adressat: programAddressee(programId, mains),
        wurzel: `${id} nicht freigegeben${at.release.why ? ` — ${at.release.why}` : ""}`, seit: null } };
    }
    const next = at?.next;
    if (!next || next === "now") return { head: { adressat: "tick", wurzel: `${id} startet`, seit: null } };
    if ("after" in next) {
      if (next.missing) return { head: { adressat: programAddressee(programId, mains),
        wurzel: `after ${next.after} ist keine Queue-Zeile mehr — die Kante wird nie von selbst frei`, seit: null } };
      const target = rows[next.after];
      if (inPlan.has(next.after)) return { row: next.after, label: `row ${next.after} (after)` };
      if (target?.status === "sent" && target.slot !== null)
        return { lane: target.slot, label: `row ${next.after} (after) auf lane ${target.slot}` };
      // a target outside the plan that is neither running nor done lands on its own never
      return { head: { adressat: programAddressee(programId, mains),
        wurzel: `after ${next.after} steht auf ${target?.status ?? "unbekannt"} und wird nicht gelandet`, seit: null } };
    }
    if ("unreleased" in next) {
      const partner = next.unreleased.find((p) => p !== id) ?? next.unreleased[0];
      return { row: partner, label: `row ${partner} (Wellenpartner)` };
    }
    if ("unchecked" in next) return { head: { adressat: "owner",
      wurzel: `${next.unchecked.join(", ")} hat keine Plan-Zeile — der Plan kann die Welle nicht pruefen`, seit: null } };
    if ("collides" in next) {
      const { slot, row: other, file, symbol } = next.collides;
      const on = `${file}${symbol ? `#${symbol}` : ""}`;
      if (slot !== undefined) return { lane: slot, label: `lane ${slot} auf ${on}` };
      return { row: other ?? "", label: `row ${other} auf ${on}` };
    }
    return { head: { adressat: "tick", wurzel: next.cap, seit: null } };
  };

  const ownReason = (id: string): string => {
    const at = inPlan.get(id);
    const row = rows[id];
    if (at?.release && !at.release.released) return row?.hold
      ? `gehalten von der MAIN (Slot ${row.hold.slot})${row.hold.grund === null ? " ohne Grund" : `: ${row.hold.grund}`}`
      : `nicht freigegeben${at.release.why ? ` — ${at.release.why}` : ""}`;
    const next = at?.next;
    if (!next || next === "now") return "startet";
    if ("after" in next) return next.missing ? `after ${next.after} ist keine Queue-Zeile mehr` : `wartet auf ${next.after} (after, nicht gelandet)`;
    if ("unreleased" in next) return `Wellenpartner ${next.unreleased.join(", ")} nicht freigegeben`;
    if ("unchecked" in next) return `${next.unchecked.join(", ")} ungeprueft`;
    if ("collides" in next) {
      const { slot, row: other, file, symbol } = next.collides;
      return `kollidiert mit ${slot !== undefined ? `lane ${slot}` : `row ${other} weiter vorn`} auf ${file}${symbol ? `#${symbol}` : ""}`;
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
      if (seen.has(edge.row)) return { head: { adressat: "owner", wurzel: `Kreis: ${[...seen].join(" → ")} → ${edge.row}`, seit: null }, kette };
      seen.add(edge.row);
      current = edge.row;
    }
  };

  const out: WaitRow[] = [];
  for (const repo of plan.repos) for (const wave of repo.waves) {
    if (wave.next === "now") continue;
    for (const row of wave.rows) {
      const { head, kette } = resolve(row.id);
      out.push({ repo: repo.repo, id: row.id, grund: ownReason(row.id), adressat: head.adressat, kette,
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
  return plan.repos.map((repo) => {
    const now = repo.waves.some((w) => w.next === "now");
    const stuckRows = waits.filter((w) => w.repo === repo.repo && w.freigegeben && w.adressat !== "tick");
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
// "after 1a2b3c4d", "wartet auf 1a2b3c4d" — names ids a card must carry as `after` (4ae22c7a:
// K3 started 13 min after filing because its NACH stood only in the prose). A header line counts
// every 8-hex token on it; inline, only the token right after the word. The caller decides which
// of these are queue rows — a commit sha in prose is not an order.
const NACH_HEADER = /^\s*NACH\s*:(.*)$/gim;
const NACH_INLINE = /\b(?:nach|after|wartet auf)\s*:?\s+`?([0-9a-f]{8})\b/gi;
export function namedAfterIds(text: string): string[] {
  const ids = new Set<string>();
  for (const m of text.matchAll(NACH_HEADER)) for (const id of m[1].match(/\b[0-9a-f]{8}\b/g) ?? []) ids.add(id);
  for (const m of text.matchAll(NACH_INLINE)) ids.add(m[1].toLowerCase());
  return [...ids];
}

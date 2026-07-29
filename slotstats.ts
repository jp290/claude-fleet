// The slot fact — whether a slot is the thing it claims to be.
//
// A slot's whole promise is "a durable conversation with a place to live": a pinned sessionId, and
// a self-heal that RESUMES that conversation rather than starting a blank one (docs/steward.md,
// "What it is"). Nothing ever checked that promise. The events needed to check it have been written
// all along — slot_open, slot_kill, self_heal_recreate — and are only ever read as a raw trail.
//
// It is a READER. Nothing here collects, schedules, gates or alarms. Same stance as continuity.ts,
// and the same shape: every input is an argument, so a synthetic sequence yields a predictable
// summary.
//
// FOUR QUESTIONS, and no field that does not answer one of them:
//   1. Does a slot keep its identity across a crash?     → resumed / heals
//   2. Does a particular slot keep falling over?         → heals, per slot
//   3. How long does a session live, and how does it end? → lifetimes + endings
//   4. Is this slot in use at all?                        → lastEventAt
//
// DIRECTION DISCIPLINE (the rule this file exists to hold, inherited from continuity.ts): an
// unknowable value is EXCLUDED and counted, never folded in as zero or as a category.
//   - A session still running at the window's end has no lifetime. It is "at least this old", and
//     counting it as a completed span would drag the median toward zero exactly where the fleet is
//     busiest.
//   - audit.jsonl rotates (one generation, oldest overwritten), so a kill whose open fell off the
//     front has an UNKNOWN start. Not a short life — an unmeasurable one.
//   - `resumeRate` is null when nothing healed. A rate with no denominator is unknown, not 0.
//   - Rows written before the reasons existed carry no reason. They are `unknown`, never silently
//     bucketed into whichever category happens to be first.

export const SLOTSTATS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SLOTSTATS_MAX_SLOTS = 20; // payload cap; the omitted count is reported, never silently dropped

/** why a session ended — the detail slot_kill carries. `unknown`: pre-reason row, or an unrecognized value. */
export type SlotEnding = "landed" | "reopen" | "shelved" | "owner" | "unknown";
export const SLOT_ENDINGS: readonly SlotEnding[] = ["landed", "reopen", "shelved", "owner", "unknown"];

/** why self-heal could not resume — the detail self_heal_recreate carries after "created:". */
export type HealOutcome = "resumed" | "no-session" | "no-transcript" | "unknown";

/** a raw audit.jsonl line: every field `unknown`, because this file has held shapes the current writer never produced */
export interface SlotEventRecord { ts?: unknown; event?: unknown; slot?: unknown; detail?: unknown }

export interface Span { n: number; medianMs: number | null; maxMs: number | null }

export interface SlotHealth {
  slot: number;
  /** last cwd this slot was opened with — the only human handle on "which slot is this" */
  cwd: string | null;
  /** sessions started in the window */
  opens: number;
  /** self-heals: the pane died and the loop rebuilt it */
  heals: number;
  /** heals that kept the conversation. The promise, measured. */
  resumed: number;
  /** why the other heals could not resume — nonzero entries only */
  healReasons: Record<string, number>;
  /** completed open→kill spans only; a still-running session is excluded, never counted as short */
  lifetimes: Span;
  /** how those sessions ended — nonzero entries only */
  endings: Record<string, number>;
  lastEventAt: number | null;
}

export interface SlotStatsSummary {
  now: number;
  /** window start; an event older than this still ANCHORS a lifetime, it is just never measured */
  from: number;
  windowMs: number;
  overall: {
    opens: number;
    heals: number;
    resumed: number;
    /** resumed/heals — null when nothing healed, because a rate with no denominator is unknown */
    resumeRate: number | null;
    lifetimes: Span;
    endings: Record<string, number>;
  };
  slots: SlotHealth[];
  /** slots with events that did not fit the payload cap */
  slotsOmitted: number;
  /** spans that COULD have been measured and deliberately were not */
  excluded: { openAtEnd: number; killWithoutOpen: number };
  /** rows the window never admitted, or could not read — scope and damage, kept apart */
  outOfScope: { beforeWindow: number; otherEvent: number; malformed: number };
}

function span(values: number[]): Span {
  if (!values.length) return { n: 0, medianMs: null, maxMs: null };
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return {
    n: s.length,
    medianMs: s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2),
    maxMs: s[s.length - 1]!,
  };
}

function bump(into: Record<string, number>, key: string): void {
  into[key] = (into[key] ?? 0) + 1;
}

/** the reason a kill carried, normalized. An unrecognized or absent detail is `unknown`, never guessed. */
function ending(detail: unknown): SlotEnding {
  return typeof detail === "string" && (SLOT_ENDINGS as readonly string[]).includes(detail)
    ? (detail as SlotEnding) : "unknown";
}

/** "resumed" | "created:no-session" | "created:no-transcript" → the outcome; anything else is unknown */
function healOutcome(detail: unknown): HealOutcome {
  if (detail === "resumed") return "resumed";
  if (detail === "created:no-session") return "no-session";
  if (detail === "created:no-transcript") return "no-transcript";
  return "unknown"; // includes the bare "created" written before the reasons existed
}

/**
 * Per-slot health over a bounded window, derived from the audit trail alone.
 *
 * PURE: `now` and the window are arguments, and the malformed count the caller's parser already
 * had is passed in rather than re-derived.
 */
export function slotStats(records: SlotEventRecord[], opts: {
  now: number;
  windowMs?: number;
  /** torn mid-append lines the caller could not parse; holes it cannot attribute to a slot */
  malformed?: number;
  maxSlots?: number;
}): SlotStatsSummary {
  const windowMs = opts.windowMs ?? SLOTSTATS_WINDOW_MS;
  const maxSlots = opts.maxSlots ?? SLOTSTATS_MAX_SLOTS;
  const from = opts.now - windowMs;

  const excluded = { openAtEnd: 0, killWithoutOpen: 0 };
  const outOfScope = { beforeWindow: 0, otherEvent: 0, malformed: opts.malformed ?? 0 };

  type Row = { ts: number; event: string; detail: unknown };
  const bySlot = new Map<number, Row[]>();
  for (const r of records) {
    // SCOPE BEFORE VALIDITY, and the order is the whole point. The trail is mostly NOT lifecycle
    // (owner_auth_fail alone carries no `slot` at all, 435 rows of it), and validating fields first
    // books every one of those as damage: measured 468 "malformed" on a file with zero torn lines.
    // A row that was never ours cannot be broken for us — it is out of scope, and scope is not damage.
    const event = typeof r.event === "string" ? r.event : null;
    if (event !== "slot_open" && event !== "slot_kill" && event !== "self_heal_recreate") {
      outOfScope.otherEvent++; continue;
    }
    const ts = typeof r.ts === "number" && Number.isFinite(r.ts) ? r.ts : null;
    const slot = typeof r.slot === "number" && Number.isInteger(r.slot) ? r.slot : null;
    if (ts === null || slot === null) { outOfScope.malformed++; continue; } // OUR row, unreadable
    const list = bySlot.get(slot);
    if (list) list.push({ ts, event, detail: r.detail });
    else bySlot.set(slot, [{ ts, event, detail: r.detail }]);
  }

  const allLifetimes: number[] = [];
  const allEndings: Record<string, number> = {};
  let opensTotal = 0, healsTotal = 0, resumedTotal = 0;
  const rows: SlotHealth[] = [];

  for (const [slot, evs] of bySlot) {
    evs.sort((a, b) => a.ts - b.ts);
    const lifetimes: number[] = [];
    const endings: Record<string, number> = {};
    const healReasons: Record<string, number> = {};
    let cwd: string | null = null;
    let opens = 0, heals = 0, resumed = 0;
    let lastEventAt: number | null = null;
    // the currently-open session's start, or null between sessions. An open that PRE-dates the
    // window still anchors — dropping it would turn a long life into a missing one.
    let start: number | null = null;

    for (const e of evs) {
      const inWindow = e.ts >= from;
      if (e.ts < from) outOfScope.beforeWindow++;
      if (inWindow) lastEventAt = e.ts;

      if (e.event === "slot_open") {
        if (typeof e.detail === "string") cwd = e.detail;
        if (inWindow) opens++;
        start = e.ts;
      } else if (e.event === "self_heal_recreate") {
        // a heal re-spawns the pane; the SESSION's span continues, so `start` is untouched
        if (!inWindow) continue;
        heals++;
        const outcome = healOutcome(e.detail);
        if (outcome === "resumed") resumed++; else bump(healReasons, outcome);
      } else { // slot_kill
        if (!inWindow) { start = null; continue; }
        bump(endings, ending(e.detail));
        if (start === null) excluded.killWithoutOpen++; // rotated-away open: unmeasurable, not short
        else lifetimes.push(Math.max(0, e.ts - start));
        start = null;
      }
    }
    if (start !== null) excluded.openAtEnd++; // still running: "at least this old" is not a lifetime

    opensTotal += opens; healsTotal += heals; resumedTotal += resumed;
    allLifetimes.push(...lifetimes);
    for (const [k, v] of Object.entries(endings)) allEndings[k] = (allEndings[k] ?? 0) + v;
    // a slot with no in-window activity at all is not a row — it is an empty slot, not a finding
    if (opens || heals || lifetimes.length || Object.keys(endings).length)
      rows.push({ slot, cwd, opens, heals, resumed, healReasons, lifetimes: span(lifetimes), endings, lastEventAt });
  }

  // noisiest first: the slot that healed most is the one worth looking at
  rows.sort((a, b) => b.heals - a.heals || b.opens - a.opens || a.slot - b.slot);

  return {
    now: opts.now, from, windowMs,
    overall: {
      opens: opensTotal, heals: healsTotal, resumed: resumedTotal,
      resumeRate: healsTotal ? resumedTotal / healsTotal : null,
      lifetimes: span(allLifetimes),
      endings: allEndings,
    },
    slots: rows.slice(0, maxSlots),
    slotsOmitted: Math.max(0, rows.length - maxSlots),
    excluded, outOfScope,
  };
}

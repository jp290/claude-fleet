// The continuity fact — the metric autonomy is actually about.
//
// Every other criterion in this repo scores a judge's hit-rate on an EVENT (did ② call it right,
// did the verify gate hold). None of them notice the failure mode autonomy actually dies of: a
// session finishes and nothing picks up the next thing. This derives that, from data that is
// already durable: for every prompt in the append-only journal, how long that slot had been
// sitting since the last thing that happened on it, and WHICH surface ended the wait.
//
// It is a READER. Nothing here collects, schedules, gates or alarms — the numbers are a display
// rung and have no consumer.
//
// DIRECTION DISCIPLINE (the one rule this file exists to hold): an unknowable gap is EXCLUDED and
// counted, never counted as zero. A slot whose previous activity is missing (first record, journal
// hole, a predecessor that fell out of scope) has an UNKNOWN wait, and unknown ≠ instant. Folding
// those in as 0 would make the fleet look maximally continuous exactly where the record is thinnest.

export type ContinuitySource = "owner" | "share" | "auto" | "terminal" | "steward";
// logPrompt's own union — the sources a LIVE record can carry. Anything else in the file (notably
// `backfill`) is a different regime, not a resolution, and never anchors a gap either.
export const CONTINUITY_SOURCES: readonly ContinuitySource[] = ["owner", "share", "auto", "terminal", "steward"];

// 2026-07-19, local midnight. The journal AND the terminal harvester both landed that day
// (3f70922, ec1ad26), so ~1573 of the file's records are a retroactive reconstruction written by
// a script that is not in this repo, tagged with a `backfill` source logPrompt's type union does
// not contain — and its reconstructed `owner` records are indistinguishable from native ones
// (docs/steward-nudge.md §8). Everything before this instant is therefore hard-excluded by TIME,
// not just by source: trusting the tag alone would silently admit the mislabelled ones.
export const CONTINUITY_REGIME_START = new Date(2026, 6, 19).getTime();
export const CONTINUITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CONTINUITY_MAX_SLOTS = 20; // payload cap; the omitted count is reported, never silently dropped

// a raw prompts.jsonl line — every field `unknown`, because this is parsed from a file that has
// held at least one shape the current writer never produced
export interface ContinuityRecord { ts?: unknown; slot?: unknown; source?: unknown; label?: unknown }

export interface GapStats { n: number; medianMs: number | null; maxMs: number | null }
export interface ContinuitySlotStats extends GapStats {
  slot: number;
  label: string | null;
  /** resolutions by the surface that ended the wait — nonzero entries only */
  bySource: Record<string, number>;
}
export interface ContinuitySummary {
  now: number;
  /** window start; records older than this still ANCHOR a gap, they are just never measured */
  from: number;
  windowMs: number;
  regimeStart: number;
  overall: GapStats;
  bySource: Record<ContinuitySource, GapStats>;
  slots: ContinuitySlotStats[];
  /** slots with measured gaps that did not fit the payload cap */
  slotsOmitted: number;
  /** in-window records that COULD have been measured and deliberately were not */
  excluded: { total: number; noPrior: number; quietHours: number };
  /** records the window/regime never admitted in the first place — scope, not data loss */
  outOfScope: { preRegime: number; nonLiveSource: number; beforeWindow: number; malformed: number };
}

function stats(values: number[]): GapStats {
  if (!values.length) return { n: 0, medianMs: null, maxMs: null };
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return {
    n: s.length,
    medianMs: s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2),
    maxMs: s[s.length - 1],
  };
}

/**
 * Per-slot time-to-next-action over a bounded window, bucketed by the source that resolved it.
 *
 * PURE: every input is an argument (`now`, the quiet-hours predicate, the malformed-line count the
 * caller's parser already had), so a synthetic sequence yields an exactly predictable summary.
 */
export function continuitySummary(records: ContinuityRecord[], opts: {
  now: number;
  windowMs?: number;
  regimeStart?: number;
  /** the server's own quiet-hours policy, injected — a gap that spans a window where movement is
   *  deliberately suppressed measures the policy, not the fleet, so it is excluded rather than
   *  counted as a slow response */
  inQuietHours?: (ts: number) => boolean;
  /** torn mid-append lines the caller could not parse; they are holes it cannot attribute to a slot */
  malformed?: number;
  maxSlots?: number;
}): ContinuitySummary {
  const windowMs = opts.windowMs ?? CONTINUITY_WINDOW_MS;
  const regimeStart = opts.regimeStart ?? CONTINUITY_REGIME_START;
  const quiet = opts.inQuietHours ?? (() => false);
  const maxSlots = opts.maxSlots ?? CONTINUITY_MAX_SLOTS;
  const from = opts.now - windowMs;

  const excluded = { total: 0, noPrior: 0, quietHours: 0 };
  const outOfScope = { preRegime: 0, nonLiveSource: 0, beforeWindow: 0, malformed: opts.malformed ?? 0 };

  type Row = { ts: number; source: string; label: string | null; live: boolean };
  const bySlot = new Map<number, Row[]>();
  for (const r of records) {
    const ts = typeof r.ts === "number" && Number.isFinite(r.ts) ? r.ts : null;
    const slot = typeof r.slot === "number" && Number.isInteger(r.slot) ? r.slot : null;
    if (ts === null || slot === null) { outOfScope.malformed++; continue; }
    const source = typeof r.source === "string" ? r.source : "";
    // a live record: inside the current regime AND written by a surface logPrompt still emits
    const live = ts >= regimeStart && (CONTINUITY_SOURCES as readonly string[]).includes(source);
    // pre-regime first: a backfilled record is BOTH, and counting it twice would overstate the loss
    if (!live) ts < regimeStart ? outOfScope.preRegime++ : outOfScope.nonLiveSource++;
    const list = bySlot.get(slot);
    if (list) list.push({ ts, source, label: typeof r.label === "string" ? r.label : null, live });
    else bySlot.set(slot, [{ ts, source, label: typeof r.label === "string" ? r.label : null, live }]);
  }

  const all: number[] = [];
  const sourceGaps = new Map<ContinuitySource, number[]>();
  const slotRows: ContinuitySlotStats[] = [];
  for (const [slot, rows] of bySlot) {
    // file order stopped meaning time order once backfill entries landed — sort, never assume
    rows.sort((a, b) => a.ts - b.ts);
    const gaps: number[] = [];
    const slotBySource: Record<string, number> = {};
    let label: string | null = null;
    let prev: number | null = null; // last LIVE activity on this slot
    let hole = false;               // a non-live record sat between prev and here → gap unknowable
    for (const row of rows) {
      if (!row.live) { hole = true; continue; }
      if (row.ts < from) {
        outOfScope.beforeWindow++; // not measured, but it still anchors the first in-window gap
      } else if (prev === null || hole) {
        excluded.noPrior++; // unknown ≠ zero
      } else if (quiet(row.ts) || quiet(prev)) {
        excluded.quietHours++;
      } else {
        const gap = Math.max(0, row.ts - prev);
        gaps.push(gap);
        all.push(gap);
        const src = row.source as ContinuitySource;
        const bucket = sourceGaps.get(src);
        if (bucket) bucket.push(gap); else sourceGaps.set(src, [gap]);
        slotBySource[src] = (slotBySource[src] ?? 0) + 1;
        label = row.label ?? label;
      }
      prev = row.ts;
      hole = false;
    }
    if (gaps.length) slotRows.push({ slot, label, bySource: slotBySource, ...stats(gaps) });
  }
  excluded.total = excluded.noPrior + excluded.quietHours;

  slotRows.sort((a, b) => b.n - a.n || a.slot - b.slot);
  const bySource = {} as Record<ContinuitySource, GapStats>;
  // every live source is listed, including the ones that resolved nothing: n:0 here is a real
  // count of resolutions, not an unknown standing in as a zero
  for (const s of CONTINUITY_SOURCES) bySource[s] = stats(sourceGaps.get(s) ?? []);

  return {
    now: opts.now, from, windowMs, regimeStart,
    overall: stats(all),
    bySource,
    slots: slotRows.slice(0, maxSlots),
    slotsOmitted: Math.max(0, slotRows.length - maxSlots),
    excluded, outOfScope,
  };
}

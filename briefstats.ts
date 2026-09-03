// The brief question — is a compiled brief worth more than the draft it replaced?
//
// The two numbers that answer it (docs/attic/brief-kompilierung-verbesserung-2026-08-18.md §4) have been
// forward-computable since the receipt learned briefHash + briefSource (735aa45), and nothing read
// them: a grep for `briefHash|ownerPrompts|disposition` across state.sh, register.sh, slotstats.ts
// and trailstats.ts finds one hit, and it counts dispositions. This module is that reader.
//
//   bun briefstats.ts                                   # the live ledgers in the cwd
//   bun briefstats.ts <lane-outcomes.jsonl> <context-receipts.jsonl> [--json]
//
// It is a READER. Nothing here collects, schedules, gates or alarms — same stance as slotstats.ts,
// trailstats.ts and continuity.ts, and the same shape: every input is an argument, so a synthetic
// pair of ledgers yields a predictable summary and no test needs a filesystem or a server. The
// ledger PATHS are the CLI half's business; the function names none.
//
// TWO QUESTIONS, and no field that does not answer one of them:
//   1. How often does a brief of THIS origin produce a lane that commits nothing? → emptyRate
//   2. How often does a landed lane of THIS origin cost the owner no prompt at all? → zeroPromptRate
//
// THE DENOMINATOR IS THE WHOLE POINT, and it is state.sh's rule copied rather than re-derived
// ("a land-success rate over lands only is a rate over survivors", state.sh:132): the empty rate
// runs over ALL joined lanes, never over the ones that made it.
//
// DIRECTION DISCIPLINE (inherited from slotstats.ts): an unknowable value is EXCLUDED and COUNTED,
// never folded in as zero or as a category. Every outcome row lands in exactly one bucket and the
// buckets sum back to the row count — a lane this reader cannot classify is visible as a lane it
// cannot classify, never as a raw brief that went badly.
//   - A row written before 735aa45 has a receipt with no briefSource. It is `preP2`, never `raw` —
//     the two are byte-identical on the wire, which is the exact reason briefSource was added.
//   - A lane with no `taskId` (hand-opened, or pre-field) cannot name the delivery that founded it.
//     Excluded and counted; §4's own instruction, and the funnel it comes from put most of the
//     empty dead on hand-opened slots.
//   - `founding` receipts (Program-MAIN and Supervisor, bootstrap and succession) carry `taskId:
//     null` and describe no lane at all. They can join nothing by construction — but the count is
//     reported anyway, because a structural impossibility that nobody prints is indistinguishable
//     from a bug that eats rows.
//   - `clarify` is its own source and never folded into `raw`. A clarify lane is briefed to settle
//     a criterion and NOT to commit (clarify-prompt.ts: "Then STOP and wait"), so buildLaneOutcome
//     books a contract-conformant one as `killed-empty` (server.ts, the killed→empty branch). Its
//     empty rate is expected to be ~1 and means the opposite of what it means anywhere else, hence
//     `emptyIsContract` on the row and `excludingClarify` beside the headline.
//   - `origin:"main-direct"` rows share the outcome file and are not lanes (they have no
//     disposition and no branch). SCOPE BEFORE VALIDITY, slotstats.ts's rule: a row that was never
//     ours cannot be broken for us, so it is out of scope and never booked as damage.
//   - A rate with no denominator is null, not 0.
//
// KNOWN LIMIT, deliberately not solved: `ownerPrompts` is best-effort at the source —
// laneOwnerPrompts returns zeros when the prompt journal cannot be read (server.ts, its catch), so
// a 0 here can mean "cost no attention" or "the journal was unreadable at terminal time". No reader
// of these two ledgers can separate them; inventing a third state would only hide that.

import { existsSync } from "node:fs";

/** where the delivered text came from — server.ts's BriefSource, the five values a receipt carries */
export const BRIEF_SOURCES = ["compiled", "owner", "raw", "clarify", "founding"] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];
/** the four a LANE can be founded by. `founding` describes a Program-MAIN/Supervisor, never a lane. */
export type LaneBriefSource = Exclude<BriefSource, "founding">;

/** the five terminal shapes of a lane — LaneOutcome.disposition, NOT DispositionVerdict */
export const LANE_DISPOSITIONS = ["landed", "reverted", "shelved", "killed-dirty", "killed-empty"] as const;
export type LaneDisposition = (typeof LANE_DISPOSITIONS)[number];

/** a lane-outcomes.jsonl line as it comes off disk — every field unknown, because this file has
 * held two row shapes (lane outcomes and main-direct provenance) and torn lines are possible */
export interface OutcomeRecord {
  ts?: unknown; origin?: unknown; branch?: unknown; disposition?: unknown;
  taskId?: unknown; briefHash?: unknown; ownerPrompts?: unknown;
}

/** a context-receipts.jsonl line, same stance. `briefSource`/`briefHash` are absent before 735aa45. */
export interface ReceiptRecord {
  at?: unknown; branch?: unknown; taskId?: unknown; briefHash?: unknown; briefSource?: unknown;
  /** the delivered ContextPlan selections, `{id, sourceHash?}` rows; absent on a row from before the plan rail */
  selected?: unknown;
}

export interface SourceStats {
  source: LaneBriefSource;
  /** ALL joined lanes of this origin — the empty rate's denominator, survivors included */
  lanes: number;
  killedEmpty: number;
  /** killedEmpty/lanes; null when nothing joined, because a rate with no denominator is unknown */
  emptyRate: number | null;
  /** true only for `clarify`, where an empty lane is the contract being kept and not a failure */
  emptyIsContract: boolean;
  /** joined lanes whose terminal disposition is `landed` — the zero-prompt rate's denominator */
  landed: number;
  zeroPrompt: number;
  zeroPromptRate: number | null;
  /** landed lanes whose ownerPrompts was not a readable number: excluded from both, counted here */
  promptsUnreadable: number;
  /** every terminal shape seen, so no lane is invisible behind the two headline numbers */
  dispositions: Record<string, number>;
}

/**
 * The same two rates per delivered PACK × SOURCE VERSION — the unit a pack-quality question is
 * asked in ("did version N+1 of verify-e2e land more zero-prompt lanes than N?"). One lane books
 * each pack it was delivered once; a receipt that names no packs is counted beside these rows.
 */
export interface PackStats {
  id: string;
  /** the OBSERVED hash of the pack's sources at delivery; null = delivered without one (unversioned) */
  sourceHash: string | null;
  lanes: number;
  killedEmpty: number;
  emptyRate: number | null;
  landed: number;
  zeroPrompt: number;
  zeroPromptRate: number | null;
  promptsUnreadable: number;
  dispositions: Record<string, number>;
}

export interface BriefStatsSummary {
  sources: SourceStats[];
  /** pack × version rows, lanes descending; the join is the same lane join as `sources` */
  packs: PackStats[];
  overall: {
    lanes: number; killedEmpty: number; emptyRate: number | null;
    /** the same rate without the population whose emptiness is its contract (see the header) */
    excludingClarify: { lanes: number; killedEmpty: number; emptyRate: number | null };
    landed: number; zeroPrompt: number; zeroPromptRate: number | null; promptsUnreadable: number;
  };
  /** lane rows this reader refused to classify. Each is a REASON, never a shrug. */
  excluded: {
    /** no taskId: a hand-opened lane, or a row from before the field. Names no delivery. */
    noTaskId: number;
    /** taskId but no usable branch — half a join key is not a join key */
    noBranch: number;
    /** an older row for a lane that has a newer one (landed→reverted). Folded, never counted twice. */
    supersededOutcomeRows: number;
    /** no receipt for this taskId+branch: the lane predates the receipt rail, or it was hand-sent */
    noReceipt: number;
    /** several receipts for one key and briefHash could not pick one — a guess would be a finding */
    ambiguous: number;
    /** the receipt predates 735aa45 and carries no origin. NOT `raw`. */
    preP2: number;
    /** a briefSource literal this reader does not know: a sixth value shipped, and it says so */
    unknownSource: number;
    /** joined a `founding` receipt. Structurally unreachable today; counted so it cannot go silent. */
    founding: number;
  };
  /** rows the file held that were never lane outcomes, and the holes in it — scope and damage apart */
  outOfScope: { mainDirect: number; malformed: number };
  receipts: {
    total: number;
    bySource: Record<string, number>;
    /** rows from before 735aa45 — no briefSource at all */
    preP2: number;
    unknownSource: number;
    /** taskId null (a founding/Supervisor delivery) or no branch: indexable by nothing */
    noLaneKey: number;
    /** `selected` is not an array: a delivery that names no packs (a row from before the plan rail) */
    noSelected: number;
    malformed: number;
  };
  /** how each join was actually decided, and what the two briefHashes said about it */
  join: {
    byTaskBranch: number;
    disambiguatedByHash: number;
    hashConfirmed: number;
    hashMismatch: number;
    hashUnavailable: number;
  };
  /** every joined lane lands in exactly one of the two: its receipt named its packs, or it did not */
  packJoin: { lanes: number; lanesWithoutSelected: number };
}

// the lane key's separator. A branch name cannot contain a control byte (git refuses it), so this
// is the one joiner neither half of the key can produce and silently merge two lanes with.
const KEY_SEP = "\x1f";

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function bump(into: Record<string, number>, key: string): void {
  into[key] = (into[key] ?? 0) + 1;
}

interface PackKey { id: string; sourceHash: string | null }
interface Receipt {
  taskId: string; branch: string; briefHash: string | null; source: BriefSource | null | "unknown";
  /** null = the row names no packs at all ("not stated"), which is not the same as an empty list */
  packs: readonly PackKey[] | null;
}
/** the delivered selections of a receipt row; an entry without a readable id is skipped, never invented */
const packsOf = (v: unknown): PackKey[] | null => {
  if (!Array.isArray(v)) return null;
  const out: PackKey[] = [];
  for (const sel of v) {
    if (typeof sel !== "object" || sel === null) continue;
    const id = str((sel as Record<string, unknown>).id);
    if (!id) continue;
    out.push({ id, sourceHash: str((sel as Record<string, unknown>).sourceHash) });
  }
  return out;
};

/**
 * The two brief-quality rates, derived from the two ledgers alone.
 *
 * PURE: the records and the malformed counts the caller's parser already had are arguments. No
 * clock, no filesystem, no path — and deliberately no window either: the population is already
 * bounded to the rows written since 735aa45 (an older lane is excluded as `preP2` or `noReceipt` by
 * construction), so a second denominator story would only obscure the one that is the point.
 */
export function briefStats(
  outcomes: readonly OutcomeRecord[],
  receipts: readonly ReceiptRecord[],
  opts: { outcomesMalformed?: number; receiptsMalformed?: number } = {},
): BriefStatsSummary {
  // --- the receipt side, indexed by the key the C-doc says carries (§3: briefHash alone joins
  // nothing on a modern lane, taskId is the join that works — taskId+branch identifies the lane).
  const byKey = new Map<string, Receipt[]>();
  const receiptStats = {
    total: receipts.length, bySource: {} as Record<string, number>,
    preP2: 0, unknownSource: 0, noLaneKey: 0, noSelected: 0, malformed: opts.receiptsMalformed ?? 0,
  };
  for (const r of receipts) {
    const rawSource = r.briefSource;
    const source: BriefSource | null | "unknown" = rawSource === undefined || rawSource === null
      ? null
      : (typeof rawSource === "string" && (BRIEF_SOURCES as readonly string[]).includes(rawSource)
        ? rawSource as BriefSource : "unknown");
    if (source === null) receiptStats.preP2++;
    else if (source === "unknown") receiptStats.unknownSource++;
    else bump(receiptStats.bySource, source);
    const packs = packsOf(r.selected);
    if (packs === null) receiptStats.noSelected++;

    const taskId = str(r.taskId);
    const branch = str(r.branch);
    // a founding receipt names no task, so it is indexable by nothing — that is its shape, not a
    // defect, and it is why `founding` can never reach a lane rate
    if (!taskId || !branch) { receiptStats.noLaneKey++; continue; }
    const rec: Receipt = { taskId, branch, briefHash: str(r.briefHash), source, packs };
    const key = `${taskId}${KEY_SEP}${branch}`;
    const list = byKey.get(key);
    if (list) list.push(rec); else byKey.set(key, [rec]);
  }

  // --- the outcome side. SCOPE BEFORE VALIDITY (slotstats.ts): main-direct rows share this file
  // and have neither disposition nor branch. Validating first books every one of them as a hole.
  const excluded = { noTaskId: 0, noBranch: 0, supersededOutcomeRows: 0, noReceipt: 0,
    ambiguous: 0, preP2: 0, unknownSource: 0, founding: 0 };
  const outOfScope = { mainDirect: 0, malformed: opts.outcomesMalformed ?? 0 };

  interface Lane { ts: number; disposition: LaneDisposition; briefHash: string | null; ownerPrompts: number | null }
  const byLane = new Map<string, Lane[]>();
  for (const o of outcomes) {
    if (o.origin === "main-direct") { outOfScope.mainDirect++; continue; } // never ours
    const ts = typeof o.ts === "number" && Number.isFinite(o.ts) ? o.ts : null;
    const disposition = typeof o.disposition === "string"
      && (LANE_DISPOSITIONS as readonly string[]).includes(o.disposition)
      ? o.disposition as LaneDisposition : null;
    if (ts === null || disposition === null) { outOfScope.malformed++; continue; } // OUR row, unreadable
    const taskId = str(o.taskId);
    if (!taskId) { excluded.noTaskId++; continue; }
    const branch = str(o.branch);
    if (!branch) { excluded.noBranch++; continue; }
    // ownerPrompts is a required field, so an unreadable one is a hole in THIS lane's attention
    // measurement — carried as null and excluded at the point of use, never floored to 0.
    const ownerPrompts = typeof o.ownerPrompts === "number" && Number.isFinite(o.ownerPrompts)
      ? o.ownerPrompts : null;
    const lane: Lane = { ts, disposition, briefHash: str(o.briefHash), ownerPrompts };
    const key = `${taskId}${KEY_SEP}${branch}`;
    const list = byLane.get(key);
    if (list) list.push(lane); else byLane.set(key, [lane]);
  }

  const join = { byTaskBranch: 0, disambiguatedByHash: 0, hashConfirmed: 0, hashMismatch: 0, hashUnavailable: 0 };
  const bySource = new Map<LaneBriefSource, SourceStats>();
  const statsFor = (source: LaneBriefSource): SourceStats => {
    const existing = bySource.get(source);
    if (existing) return existing;
    const fresh: SourceStats = { source, lanes: 0, killedEmpty: 0, emptyRate: null,
      emptyIsContract: source === "clarify", landed: 0, zeroPrompt: 0, zeroPromptRate: null,
      promptsUnreadable: 0, dispositions: {} };
    bySource.set(source, fresh);
    return fresh;
  };
  // ONE booking rule for both tables: a lane counts the same way under its brief origin and under
  // each pack it was delivered, so the two tables can never disagree about what a lane did.
  interface Booked { lanes: number; killedEmpty: number; landed: number; zeroPrompt: number; promptsUnreadable: number; dispositions: Record<string, number> }
  const book = (b: Booked, lane: Lane): void => {
    b.lanes++;
    bump(b.dispositions, lane.disposition);
    if (lane.disposition === "killed-empty") b.killedEmpty++;
    if (lane.disposition === "landed") {
      if (lane.ownerPrompts === null) b.promptsUnreadable++;
      else {
        b.landed++;
        if (lane.ownerPrompts === 0) b.zeroPrompt++;
      }
    }
  };
  const packJoin = { lanes: 0, lanesWithoutSelected: 0 };
  const byPack = new Map<string, PackStats>();
  const packStatsFor = (key: string, pack: PackKey): PackStats => {
    const existing = byPack.get(key);
    if (existing) return existing;
    const fresh: PackStats = { id: pack.id, sourceHash: pack.sourceHash, lanes: 0, killedEmpty: 0, emptyRate: null,
      landed: 0, zeroPrompt: 0, zeroPromptRate: null, promptsUnreadable: 0, dispositions: {} };
    byPack.set(key, fresh);
    return fresh;
  };

  for (const [key, lanes] of byLane) {
    // ONE LANE, ONE OUTCOME. A reverted lane has a `landed` row and a `reverted` row (the second
    // joins back to the first BY BRANCH, server.ts's own note), and counting both would put one
    // lane in the denominator twice. The newest wins; the rest are folded and counted, never
    // dropped — the count is what makes the fold visible.
    let lane = lanes[0]!;
    for (const candidate of lanes) if (candidate.ts > lane.ts) lane = candidate;
    excluded.supersededOutcomeRows += lanes.length - 1;

    const cands = byKey.get(key) ?? [];
    if (cands.length === 0) { excluded.noReceipt++; continue; }
    let picked: Receipt;
    let disambiguated = false;
    if (cands.length === 1) picked = cands[0]!;
    else {
      // the key repeated: same task re-dispatched onto the same branch name. briefHash is the exact
      // second key here — the receipt hashes the delivered bytes and the outcome hashes the lane's
      // first logged prompt through the SAME function over the SAME bytes (735aa45).
      const exact = lane.briefHash ? cands.filter((c) => c.briefHash === lane.briefHash) : [];
      if (exact.length !== 1) { excluded.ambiguous++; continue; } // a guess here would be a finding
      picked = exact[0]!;
      disambiguated = true;
    }
    if (picked.source === null) { excluded.preP2++; continue; }
    if (picked.source === "unknown") { excluded.unknownSource++; continue; }
    if (picked.source === "founding") { excluded.founding++; continue; }

    if (disambiguated) join.disambiguatedByHash++; else join.byTaskBranch++;
    if (lane.briefHash === null || picked.briefHash === null) join.hashUnavailable++;
    else if (lane.briefHash === picked.briefHash) join.hashConfirmed++;
    else join.hashMismatch++; // joined on the key that carries; the disagreement is reported, not hidden

    book(statsFor(picked.source), lane);
    // the SAME lane, booked once per delivered pack × version. A receipt that names no packs is
    // counted beside the rows: folding it into an "unversioned" bucket would make "not stated"
    // look like "delivered without a hash", and those are different facts.
    if (picked.packs === null) packJoin.lanesWithoutSelected++;
    else {
      packJoin.lanes++;
      const seenPack = new Set<string>();
      for (const pack of picked.packs) {
        const packKey = `${pack.id}${KEY_SEP}${pack.sourceHash ?? ""}`;
        if (seenPack.has(packKey)) continue; // one lane, one booking per pack, however often the row repeats it
        seenPack.add(packKey);
        book(packStatsFor(packKey, pack), lane);
      }
    }
  }

  const rate = (num: number, den: number): number | null => (den ? num / den : null);
  const rows = [...bySource.values()];
  for (const s of rows) {
    s.emptyRate = rate(s.killedEmpty, s.lanes);
    s.zeroPromptRate = rate(s.zeroPrompt, s.landed);
  }
  rows.sort((a, b) => b.lanes - a.lanes || a.source.localeCompare(b.source));
  const packRows = [...byPack.values()];
  for (const p of packRows) {
    p.emptyRate = rate(p.killedEmpty, p.lanes);
    p.zeroPromptRate = rate(p.zeroPrompt, p.landed);
  }
  packRows.sort((a, b) => b.lanes - a.lanes || a.id.localeCompare(b.id)
    || (a.sourceHash ?? "").localeCompare(b.sourceHash ?? ""));

  const sum = (pick: (s: SourceStats) => number, only?: (s: SourceStats) => boolean): number =>
    rows.filter((s) => (only ? only(s) : true)).reduce((n, s) => n + pick(s), 0);
  const work = (s: SourceStats): boolean => s.source !== "clarify";
  const lanes = sum((s) => s.lanes), killedEmpty = sum((s) => s.killedEmpty);
  const workLanes = sum((s) => s.lanes, work), workEmpty = sum((s) => s.killedEmpty, work);
  const landed = sum((s) => s.landed), zeroPrompt = sum((s) => s.zeroPrompt);

  return {
    sources: rows,
    packs: packRows,
    overall: {
      lanes, killedEmpty, emptyRate: rate(killedEmpty, lanes),
      excludingClarify: { lanes: workLanes, killedEmpty: workEmpty, emptyRate: rate(workEmpty, workLanes) },
      landed, zeroPrompt, zeroPromptRate: rate(zeroPrompt, landed),
      promptsUnreadable: sum((s) => s.promptsUnreadable),
    },
    excluded, outOfScope, receipts: receiptStats, join, packJoin,
  };
}

// --- the CLI half: the only part of this file that knows a path exists.

/**
 * appendEvent's read counterpart, rotation-aware — server.ts's readLedger, copied because this CLI
 * must not import the server. At AUDIT_ROTATE_BYTES the whole history becomes `x.jsonl.1` and
 * `x.jsonl` restarts empty: a single-file reader answers from a near-empty ledger with NO error,
 * so the file looks young rather than truncated. `.1` first — that order is chronological.
 */
export async function readJsonl<T>(file: string): Promise<{ rows: T[]; malformed: number }> {
  const rows: T[] = [];
  let malformed = 0;
  for (const f of [`${file}.1`, file]) {
    if (!existsSync(f)) continue;
    for (const line of (await Bun.file(f).text()).split("\n")) {
      if (!line) continue;
      try { rows.push(JSON.parse(line) as T); } catch { malformed++; } // a torn line is a hole, reported as one
    }
  }
  return { rows, malformed };
}

const pct = (r: number | null): string => (r === null ? "n/a" : `${Math.round(r * 100)}%`);
const frac = (num: number, den: number, r: number | null): string => `${num}/${den} = ${pct(r)}`;

export function renderBriefStats(s: BriefStatsSummary): string {
  const out: string[] = [];
  const pad = (v: string | number, n: number): string => String(v).padEnd(n);
  out.push(`  ${pad("brief origin", 18)}${pad("lanes", 6)} ${pad("killed-empty", 21)}${pad("landed", 8)}0-owner-prompt`);
  for (const r of s.sources) {
    out.push(`  ${pad(r.source + (r.emptyIsContract ? " †" : ""), 18)}${pad(r.lanes, 6)} `
      + `${pad(frac(r.killedEmpty, r.lanes, r.emptyRate), 21)}${pad(r.landed, 8)}`
      + `${frac(r.zeroPrompt, r.landed, r.zeroPromptRate)}`
      + (r.promptsUnreadable ? `  (+${r.promptsUnreadable} landed w/o a readable ownerPrompts)` : ""));
  }
  if (!s.sources.length) out.push("  (no lane joined a receipt that names its brief origin)");
  out.push(`  ${pad("ALL", 18)}${pad(s.overall.lanes, 6)} `
    + `${pad(frac(s.overall.killedEmpty, s.overall.lanes, s.overall.emptyRate), 21)}`
    + `${pad(s.overall.landed, 8)}${frac(s.overall.zeroPrompt, s.overall.landed, s.overall.zeroPromptRate)}`);
  const x = s.overall.excludingClarify;
  out.push(`  ${pad("ALL less clarify", 18)}${pad(x.lanes, 6)} ${frac(x.killedEmpty, x.lanes, x.emptyRate)}`);
  if (s.sources.some((r) => r.emptyIsContract))
    out.push("  † a clarify lane is briefed NOT to commit — its killed-empty is the contract kept, not a failure");

  out.push(`  ${pad("pack @ source version", 48)}${pad("lanes", 6)} ${pad("killed-empty", 21)}${pad("landed", 8)}0-owner-prompt`);
  for (const p of s.packs) {
    out.push(`  ${pad(`${p.id} @${p.sourceHash ? p.sourceHash.slice(0, 12) : "unversioned"}`, 48)}${pad(p.lanes, 6)} `
      + `${pad(frac(p.killedEmpty, p.lanes, p.emptyRate), 21)}${pad(p.landed, 8)}`
      + `${frac(p.zeroPrompt, p.landed, p.zeroPromptRate)}`
      + (p.promptsUnreadable ? `  (+${p.promptsUnreadable} landed w/o a readable ownerPrompts)` : ""));
  }
  if (!s.packs.length) out.push("  (no joined lane's receipt named its packs)");
  out.push(`  one booking per lane per delivered pack · ${s.packJoin.lanes} joined lane(s) named packs`
    + ` · ${s.packJoin.lanesWithoutSelected} did not`);

  const ex = s.excluded;
  out.push("excluded (each lane row lands in exactly one bucket):");
  out.push(`  no taskId ${ex.noTaskId} · no branch ${ex.noBranch} · superseded rows ${ex.supersededOutcomeRows}`
    + ` · no receipt ${ex.noReceipt} · ambiguous ${ex.ambiguous}`);
  out.push(`  pre-P2 (receipt has no briefSource) ${ex.preP2} · unknown source ${ex.unknownSource}`
    + ` · founding ${ex.founding}`);
  out.push(`out of scope: main-direct ${s.outOfScope.mainDirect} · malformed ${s.outOfScope.malformed}`);
  const rc = s.receipts;
  const bySource = Object.entries(rc.bySource).sort().map(([k, v]) => `${k} ${v}`).join(" · ") || "none";
  out.push(`receipts ${rc.total}: ${bySource} · pre-P2 ${rc.preP2} · unknown ${rc.unknownSource}`
    + ` · no lane key ${rc.noLaneKey} · no selected ${rc.noSelected} · malformed ${rc.malformed}`);
  out.push(`joins: by taskId+branch ${s.join.byTaskBranch} · disambiguated by briefHash ${s.join.disambiguatedByHash}`
    + ` · hash confirmed ${s.join.hashConfirmed} · hash mismatch ${s.join.hashMismatch}`
    + ` · hash unavailable ${s.join.hashUnavailable}`);
  return out.join("\n");
}

async function main(argv: string[]): Promise<number> {
  const files = argv.filter((a) => !a.startsWith("--"));
  const outcomesFile = files[0] ?? `${process.cwd()}/lane-outcomes.jsonl`;
  const receiptsFile = files[1] ?? `${process.cwd()}/context-receipts.jsonl`;
  // An absent ledger is UNKNOWN, not empty — state.sh's rule ("absent, not the same as none"). A
  // zero-lane table read off a path that does not exist is the exact shape of a wrong all-clear.
  for (const f of [outcomesFile, receiptsFile]) {
    if (!existsSync(f) && !existsSync(`${f}.1`)) {
      console.error(`briefstats: ${f} does not exist — that is UNKNOWN, not an empty ledger`);
      return 2;
    }
  }
  const o = await readJsonl<OutcomeRecord>(outcomesFile);
  const r = await readJsonl<ReceiptRecord>(receiptsFile);
  const summary = briefStats(o.rows, r.rows, { outcomesMalformed: o.malformed, receiptsMalformed: r.malformed });
  console.log(argv.includes("--json") ? JSON.stringify(summary, null, 2) : renderBriefStats(summary));
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));

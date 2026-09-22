// Read-only score of the R4 collision rule against what landed lanes really collided on.
//
// `task-land-waves.ts#rangesCollide` (R4) PREDICTS: two pieces of work collide on a file when their
// ranges there lie within LAND_WAVE_RANGE_GAP = 40 lines, and — without a range — whenever they
// share the file. Parallel bundles are only as safe as that prediction, and until the outcome row
// carried `forkSha` nothing could check it: `base` is the post-rebase point, so what main did while
// the lane lived was gone (docs/queue-wellen-2026-09-06.md §R4).
//
// For every landed row that carries `forkSha` and `mainAfter`, all in BASE coordinates:
//   · lane side  = `git diff base..headSha`, OLD-side hunks. Never `forkSha...headSha`: after a
//     rebase-land headSha sits on top of base, the merge-base with forkSha is forkSha itself, and
//     that diff would count main's own intervening commits into the lane.
//   · main side  = `git diff forkSha..base`, NEW-side hunks — what main did while the lane lived.
//   · prediction = R4 fed those hunks as ranges (`range`), and R4's file fallback (`file`).
//   · reality    = a hunk pair touching (≤ 1 line apart, or a binary file changed on both sides)
//     OR `resolvedConflict` on the row.
// The unit is ONE ROW: predicted if any shared file collides, real if any shared file touches or the
// land needed the resolver.
//
// WHAT THE NUMBER CAN AND CANNOT SAY. The prediction here gets the lane's REAL ranges, so it is the
// best R4 could ever do — a card surface gets symbol ranges from a lagging graph, and those rows are
// pruned from fleet.json long before anyone asks (36 of 452 landed task ids survived on 2026-09-13).
// Two consequences, stated rather than hidden: `range` recall against hunk overlap is 1 by
// construction (touching ⊂ within 40), so a `range` miss can only come from `resolvedConflict` on a
// row whose hunks did not touch; and precision is the informative half — how many 40-line edges and
// how many file edges were real. The main side is the WHOLE interval forkSha..base, not one partner
// lane: this scores lane-vs-main, which is what a bundle landing second faces.
//
//   bun land-collision-stats.ts [--ledger lane-outcomes.jsonl] [--repo DIR] [--last N]
//                               [--forked-only] [--table]
import { realpathSync } from "node:fs";
import { LAND_WAVE_RANGE_GAP, rangesCollide } from "./task-land-waves";
import type { TaskWaveRange } from "./task-waves";

// closed interval of lines; a pure insertion/deletion (`,0`) is the point it sits at
export interface Hunk { start: number; end: number }
// a file with `[]` changed without line hunks (binary, mode) — "where" is unknown, never "nowhere"
export type FileHunks = Map<string, Hunk[]>;

// git merges treat changes on ADJACENT lines as a conflict, so "touching" is one line, not zero
export const REAL_TOUCH_GAP = 1;

export function parseDiffHunks(diff: string, side: "old" | "new"): FileHunks {
  const files: FileHunks = new Map();
  let current: string | null = null;
  for (const line of diff.split("\n")) {
    const head = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
    if (head) {
      current = head[2];
      files.set(current, []);
      continue;
    }
    if (current === null) continue;
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk) continue;
    const start = Number(side === "old" ? hunk[1] : hunk[3]);
    const len = Number((side === "old" ? hunk[2] : hunk[4]) ?? "1");
    files.get(current)!.push({ start, end: len === 0 ? start : start + len - 1 });
  }
  return files;
}

const within = (a: Hunk, b: Hunk, gap: number): boolean => a.start <= b.end + gap && b.start <= a.end + gap;
const asRanges = (file: string, hunks: readonly Hunk[]): TaskWaveRange[] =>
  hunks.map((h) => ({ file, symbol: "hunk", startLine: h.start, endLine: h.end }));

// A RUNNING lane's real change since its fork, for the start plan (start-plan.ts#StartPlanLane.hunks):
// `git diff <anchorSha>` against the WORKTREE, so uncommitted edits count, NEW-side hunks as R4 ranges.
// A file with `[]` changed without line hunks; a file not in the record is not changed yet.
//
// THE ANCHOR IS THE LIVE MERGE-BASE OF THE INTEGRATION BRANCH AND THE LANE'S HEAD, never the
// spawn-time `worktree.baseSha` (2026-09-22). baseSha is the fork as it stood when the lane was
// opened and is never carried forward; once the lane (or the resolver) rebases onto a newer
// integration tip, every file main changed in between sits between baseSha and the lane's HEAD and
// is read here as the LANE's hunk — a phantom the start plan then turns into a collision edge
// (start-plan.ts#collision). Measured on lane fleet/260922003850-a399: `main...branch` held 2 docs
// files, this reading held three lines of e2e/slots.ts nobody in that lane had touched. The
// merge-base moves with the rebase and the two-dot diff from it is exactly the lane's own work,
// which is the only thing a collision edge may be built from. Callers resolve it the way
// server.ts#laneForkSha does; a caller that cannot resolve one falls back to baseSha, because that
// is then the only fork it honestly has.
export const laneHunkDiffArgs = (anchorSha: string): string[] =>
  ["-c", "core.quotepath=off", "diff", "--no-color", "--no-ext-diff", "--no-renames", "-U0", anchorSha];
export function laneHunkRanges(diff: string): Record<string, TaskWaveRange[]> {
  return Object.fromEntries([...parseDiffHunks(diff, "new")].map(([file, hunks]) => [file, asRanges(file, hunks)]));
}

export interface SharedFile { file: string; range: boolean; touch: boolean }
export interface Judged { shared: SharedFile[]; predicted: { range: boolean; file: boolean }; real: boolean }

export function judge(lane: FileHunks, main: FileHunks, resolvedConflict: boolean): Judged {
  const shared: SharedFile[] = [];
  for (const [file, lh] of lane) {
    const mh = main.get(file);
    if (!mh) continue;
    shared.push({ file, range: rangesCollide(asRanges(file, lh), asRanges(file, mh)),
      // no hunks on either side is a binary/mode change on both — git conflicts on that too
      touch: !lh.length || !mh.length || lh.some((x) => mh.some((y) => within(x, y, REAL_TOUCH_GAP))) });
  }
  return { shared, predicted: { range: shared.some((s) => s.range), file: shared.length > 0 },
    real: resolvedConflict || shared.some((s) => s.touch) };
}

export interface Confusion { tp: number; fp: number; fn: number; tn: number; precision: number | null; recall: number | null }
function confusion(pairs: readonly { predicted: boolean; real: boolean }[]): Confusion {
  const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const p of pairs) c[p.predicted ? (p.real ? "tp" : "fp") : (p.real ? "fn" : "tn")]++;
  // null, not 0 or 1, when nothing was predicted / nothing was real: an empty ratio is no measurement
  return { ...c, precision: c.tp + c.fp ? c.tp / (c.tp + c.fp) : null, recall: c.tp + c.fn ? c.tp / (c.tp + c.fn) : null };
}

interface LedgerRow {
  disposition?: unknown; branch?: unknown; repo?: unknown; base?: unknown; headSha?: unknown;
  forkSha?: unknown; mainAfter?: unknown; resolvedConflict?: unknown; origin?: unknown;
}

export type RowResult =
  | { status: "measured"; branch: string | null; repo: string; mainAfter: string; forkSha: string;
      mainMoved: boolean; laneFiles: number; mainFiles: number; resolvedConflict: boolean } & Judged
  | { status: "lane-only"; branch: string | null; repo: string; mainAfter: string; laneFiles: number; laneHunks: number }
  | { status: "unreadable"; branch: string | null; repo: string | null; mainAfter: string; reason: string };

const str = (v: unknown): string | null => typeof v === "string" && v ? v : null;

function git(repo: string, ...args: string[]): { ok: boolean; out: string; err: string } {
  const r = Bun.spawnSync(["git", "-C", repo, "-c", "core.quotepath=off", ...args],
    { stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } });
  return { ok: r.success, out: r.stdout.toString(), err: r.stderr.toString().trim() };
}
const diffArgs = (a: string, b: string) => ["diff", "--no-color", "--no-ext-diff", "--no-renames", "-U0", `${a}..${b}`];

export function measureRow(row: LedgerRow): RowResult {
  const branch = str(row.branch), repo = str(row.repo), mainAfter = str(row.mainAfter)!;
  const base = str(row.base), head = str(row.headSha), fork = str(row.forkSha);
  if (!repo || !base || !head) return { status: "unreadable", branch, repo, mainAfter,
    reason: `row lacks ${[!repo && "repo", !base && "base", !head && "headSha"].filter(Boolean).join("+")}` };
  const laneDiff = git(repo, ...diffArgs(base, head));
  if (!laneDiff.ok) return { status: "unreadable", branch, repo, mainAfter, reason: `lane diff: ${laneDiff.err.slice(0, 160)}` };
  const lane = parseDiffHunks(laneDiff.out, "old");
  if (!fork) return { status: "lane-only", branch, repo, mainAfter, laneFiles: lane.size,
    laneHunks: [...lane.values()].reduce((n, h) => n + h.length, 0) };
  if (!git(repo, "merge-base", "--is-ancestor", fork, base).ok)
    return { status: "unreadable", branch, repo, mainAfter, reason: "forkSha is not an ancestor of base" };
  const resolvedConflict = row.resolvedConflict === true;
  let main: FileHunks = new Map();
  if (fork !== base) {
    const mainDiff = git(repo, ...diffArgs(fork, base));
    if (!mainDiff.ok) return { status: "unreadable", branch, repo, mainAfter, reason: `main diff: ${mainDiff.err.slice(0, 160)}` };
    main = parseDiffHunks(mainDiff.out, "new");
  }
  return { status: "measured", branch, repo, mainAfter, forkSha: fork, mainMoved: fork !== base,
    laneFiles: lane.size, mainFiles: main.size, resolvedConflict, ...judge(lane, main, resolvedConflict) };
}

export interface CollisionStats {
  version: 1; gap: number; touchGap: number;
  total: { rows: number; measured: number; laneOnly: number; unreadable: number; mainMoved: number;
    real: number; resolvedConflict: number; range: Confusion; file: Confusion };
  missing: string | null;
  rows: RowResult[];
}

export function collisionStats(ledger: readonly LedgerRow[], opts: { repo?: string; last?: number; forkedOnly?: boolean } = {}): CollisionStats {
  const canon = (p: string): string => { try { return realpathSync(p); } catch { return p; } };
  const wanted = opts.repo ? canon(opts.repo) : null;
  let landed = ledger.filter((r) => r.origin !== "main-direct" && r.disposition === "landed" && str(r.mainAfter)
    && (!wanted || (str(r.repo) && canon(r.repo as string) === wanted)));
  if (opts.last && opts.last > 0) landed = landed.slice(-opts.last);
  if (opts.forkedOnly) landed = landed.filter((r) => str(r.forkSha));
  const rows = landed.map(measureRow);
  const measured = rows.filter((r): r is Extract<RowResult, { status: "measured" }> => r.status === "measured");
  const laneOnly = rows.filter((r) => r.status === "lane-only").length;
  return {
    version: 1, gap: LAND_WAVE_RANGE_GAP, touchGap: REAL_TOUCH_GAP,
    total: {
      rows: rows.length, measured: measured.length, laneOnly,
      unreadable: rows.filter((r) => r.status === "unreadable").length,
      mainMoved: measured.filter((r) => r.mainMoved).length,
      real: measured.filter((r) => r.real).length,
      resolvedConflict: measured.filter((r) => r.resolvedConflict).length,
      range: confusion(measured.map((r) => ({ predicted: r.predicted.range, real: r.real }))),
      file: confusion(measured.map((r) => ({ predicted: r.predicted.file, real: r.real }))),
    },
    missing: laneOnly ? `${laneOnly} landed row${laneOnly === 1 ? "" : "s"} without forkSha: only the lane half `
      + "(base..headSha) is measured — what main did while those lanes lived is on no row, so they score nothing" : null,
    rows,
  };
}

const ratio = (v: number | null): string => v === null ? "–" : v.toFixed(2);
const conf = (name: string, c: Confusion): string =>
  `${name} P ${ratio(c.precision)} R ${ratio(c.recall)} (tp ${c.tp} fp ${c.fp} fn ${c.fn} tn ${c.tn})`;
export function tableLine(s: CollisionStats): string {
  const t = s.total;
  return `measured ${t.measured}/${t.rows} · lane-only ${t.laneOnly} · unreadable ${t.unreadable} · main moved ${t.mainMoved}`
    + ` · real ${t.real} (resolver ${t.resolvedConflict}) · ${conf(`R4-range±${s.gap}`, t.range)} · ${conf("file", t.file)}`;
}

const argAfter = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  return at >= 0 && typeof process.argv[at + 1] === "string" ? process.argv[at + 1] : null;
};

if (import.meta.main) {
  const path = argAfter("--ledger") ?? "lane-outcomes.jsonl";
  const file = Bun.file(path);
  if (!(await file.exists())) {
    // absence is not an empty ledger — the caller must not read "0 measured" off a file it never saw
    console.error(`land-collision-stats: ledger UNKNOWN — ${path} does not exist`);
    process.exit(2);
  }
  const ledger: LedgerRow[] = [];
  for (const line of (await file.text()).split("\n")) {
    if (!line.trim()) continue;
    try { ledger.push(JSON.parse(line) as LedgerRow); } catch { /* torn mid-append line — skip */ }
  }
  const last = Number(argAfter("--last"));
  const stats = collisionStats(ledger, { ...(argAfter("--repo") ? { repo: argAfter("--repo")! } : {}),
    ...(Number.isFinite(last) && last > 0 ? { last } : {}), forkedOnly: process.argv.includes("--forked-only") });
  process.stdout.write(`${process.argv.includes("--table") ? tableLine(stats) : JSON.stringify(stats)}\n`);
}

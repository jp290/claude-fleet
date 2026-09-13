// Deterministic, read-only LAND wave projection — the other fold of the same collision data.
//
// `task-waves.ts` asks which rows may run at the SAME TIME in separate lanes: independent sets over
// shared files. This module asks the opposite, which rows may LAND TOGETHER in one lane: connected
// components over shared files INSIDE ONE PROGRAM, cut by the three rules of
// docs/queue-wellen-2026-09-06.md §2 (R1 class purity · R2 a gate changer lands alone · R3 only a
// CONFIRMED surface may be bundled). A sensor, not a motor: nothing here dispatches, lands or writes.
//
// The program is the SECOND criterion beside the surface, and it is what keeps the fold from
// collapsing: over the 31 open auftrag rows measured for docs/queue-wellen-2026-09-06.md §2 R3,
// server.ts stood in 27 surfaces and file overlap alone folded 30 of the 31 into ONE component.
// Files are a necessary bundling criterion, not a sufficient one — a confirmed but COARSE surface
// produces the same clump a derived one does.
//
// Browser-safe like its sibling, and deliberately so — src/client.ts imports it. The CLI at the
// bottom reaches the filesystem and the metadata derivation through Bun globals inside
// `import.meta.main`, never through a top-level node import, so the client bundle stays clean.
import { verificationProportionFor } from "./verify-proportion";
import { isTaskCardSize, type TaskCardSize, type TaskWaveInput, type TaskWaveRange } from "./task-waves";

export type LandWaveClass = "docs" | "code";
// Every reason a row is alone in its wave. `null` is the fourth case and means the opposite of a
// verdict: the row IS bundlable and found no partner (or the budget cut it off) — not "reason unknown".
export type LandWaveReasonAgainst =
  "gate-aenderer" | "flaeche-nur-abgeleitet" | "kein-program" | "keine-flaeche";

export interface LandWaveCosts {
  fullGateSec: number; docsGateSec: number; fullAuditSec: number; docsAuditSec: number;
}

export interface ProjectLandWavesInput {
  tasks: readonly TaskWaveInput[];
  dispatchRepo?: string;
  budget?: number;
  costs: LandWaveCosts;
}

export interface LandWave {
  ids: string[];
  klasse: LandWaveClass;
  // Files carried by at least TWO rows of this wave — the evidence FOR bundling them. A wave of
  // one has none by construction: "shared" needs a second row, and printing its own surface here
  // would read like an overlap it does not have.
  sharedFiles: string[];
  // the wave's summed size units (LAND_WAVE_SIZE_UNITS) — what the budget cut measured
  units: number;
  savingsSec: number;
  reasonAgainst: LandWaveReasonAgainst | null;
}

export interface LandWaveRepo { repo: string; waves: LandWave[] }
export interface LandWaveUnresolved { id: string; created: number; reason: "unknown-repo" }
export interface LandWaveProjection {
  budget: number;
  repos: LandWaveRepo[];
  unresolved: LandWaveUnresolved[];
}

// THE WAVE IS CUT BY A BUDGET, NOT BY A ROW COUNT (S7, 2026-09-12). Until then the bound was the
// constant 3, justified as the reader's bisect budget for a red post-land audit. That bisect is
// bought back by the brief's one-commit-per-row rule (wave-brief.ts), so the number had no
// measurement behind it (docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md §4). The
// limit that does exist is the LANE'S CONTEXT: one lane builds every row of its wave in one
// session, single lanes ran at 140–190k tokens, and three small rows cost that lane less than two
// large ones. So each row weighs its card's size class and a wave takes rows while the sum stays
// within the budget: five small, or two medium plus one small, or one large plus two small.
//
// A ROW WITHOUT A SIZE WEIGHS MEDIUM. Absence is not smallness, and the one direction this sensor
// must not fall is packing unmeasured rows tighter than measured ones.
//
// THE ROW BOUND STAYS, AS A HARD CEILING. Six small rows fit a budget of 6, but a seventh commit,
// a seventh brief section and a seventh row to hand back on a split do not get cheaper because
// each row is small. It also caps what FLEET_LAND_WAVE_BUDGET can widen.
//
// IT IS NOT COUPLED TO UNDO_STACK_MAX. The undo stack counts LANDS, and a wave of n rows is ONE
// land with ONE undo record — so a wave of five costs the undo stack exactly what a wave of one
// costs it, and raising either bound says nothing about the other. The default is pinned in
// e2e/pins.ts so a change to it is deliberate rather than a silent widening.
export const LAND_WAVE_BUDGET_DEFAULT = 5;
export const LAND_WAVE_ROWS_MAX = 6;
export const LAND_WAVE_SIZE_UNITS: Readonly<Record<TaskCardSize, number>> = { klein: 1, mittel: 2, gross: 3 };

/** A row's weight against the wave budget; no size (no card, or a card that did not state one) is medium. */
export function landWaveUnits(size: TaskCardSize | null | undefined): number {
  return LAND_WAVE_SIZE_UNITS[size ?? "mittel"];
}

// R2 ASKS A DIFFERENT QUESTION THAN THE PROOF RECOMMENDATION, and until 2026-09-12 it borrowed the
// answer to the wrong one. `verify-proportion.ts#verificationProportionFor(...).isolatedPreview`
// says "this change should be PREVIEWED in isolation" — a recommendation about how much proof to
// buy, and it is true for every path under `e2e/`, because a new check module deserves a Tier-2
// preview. R2 says "whoever changes the GATE lands alone" — a statement about the measuring
// apparatus itself, so that a red audit stays separable into "the change is wrong" and "the change
// moved the instrument" (docs/queue-wellen-2026-09-06.md §2 R2, the same cut
// docs/verify-tiering.md §11.7 demands of a flake proof).
//
// The two coincided nowhere useful. Measured over the 42 open auftrag rows of the real fleet.json
// (tree edbc153a): 18 surfaces name `e2e/pins.ts` and 17 name `e2e-isolated.sh` — and every
// well-formed code row adds a check under `e2e/<family>.ts`, so borrowing the preview flag made R2
// hold back exactly the rows that BRING TESTS and leave only testless ones bundlable. A check
// module is not the gate; it is a passenger the gate carries.
//
// Hence this list, and hence it is a RULE and not a snapshot: the two globs cover every wrapper and
// every runner in the tree, present and future, so adding `e2e-foo.sh` needs no edit here. Only the
// named singletons are spelled out, and `e2e/pins.ts` pins BOTH directions of that (a wrapper on
// disk the predicate misses, and a named file that no longer exists).
//
// `verify-proportion.ts` stays untouched on purpose — its recommendation was never wrong. And
// `clarify-prompt.ts`, its neighbour in the E2E rule there, is deliberately absent here (owner,
// 2026-09-12): it builds a clarify lane's founding brief and belongs to no step of the verify
// chain, while `merge-prompt.ts` sits in the merge/land path and is type-checked by the gate itself.
export const GATE_MACHINERY_FILES: readonly string[] = [
  "e2e/harness.ts", "e2e/ctx.ts", "e2e/pins.ts",
  "merge-prompt.ts", "verify-proportion.ts", "watchdog.sh",
];

/** R2's own predicate: does this path change the apparatus that would verify the wave? */
export function isGateMachinery(path: string): boolean {
  return GATE_MACHINERY_FILES.includes(path)
    || /^e2e-.*\.sh$/.test(path)
    || /^fleet-e2e.*\.ts$/.test(path);
}

// Mediane 2026-09, docs/messungen/2026-09-06-merge-prozess-robust.md §1.
// ONE definition on purpose: the board prices a wave with exactly the numbers
// `bun task-land-waves.ts --state fleet.json` prices it with, or the CLI check run after a land
// would not measure what the board showed.
export const LAND_WAVE_COSTS_2026_09: LandWaveCosts = {
  fullGateSec: 107, docsGateSec: 1, fullAuditSec: 1608, docsAuditSec: 2,
};

interface ClassifiedRow {
  id: string; created: number; files: string[]; programId: string | null; units: number; after: string[];
  ranges: readonly TaskWaveRange[] | null;
  klasse: LandWaveClass; reasonAgainst: LandWaveReasonAgainst | null;
}

// --- THE COLLISION MEASURE IS A RANGE, NOT A FILE (S2, 2026-09-12)
//
// `server.ts` stands in 33 of the 41 open surfaces, and until this change that ONE fact connected
// almost every code row to almost every other. It should not have: of 294 landed lanes that
// touched server.ts, 7 needed the merge resolver (2.4 %); of 350 that did not, 6 did (1.7 %).
// A shared file is not evidence of a collision — it is evidence of a shared file
// (docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md §2, Befund 1).
//
// So two rows are connected on a file only when they work in the same NEIGHBOURHOOD of it. The
// window is deliberately generous: the ranges come from a graph snapshot whose line numbers lag the
// tree between rebuilds, and the cost of the two errors is not symmetric. Connecting two rows that
// would not have collided costs a wave one size smaller than it could have been; separating two
// that WOULD have collided costs a merge conflict in a lane that was told it was alone.
export const LAND_WAVE_RANGE_GAP = 40;

const rangesIn = (row: ClassifiedRow, file: string): readonly TaskWaveRange[] =>
  (row.ranges ?? []).filter((range) => range.file === file);

const near = (a: TaskWaveRange, b: TaskWaveRange): boolean =>
  a.startLine <= b.endLine + LAND_WAVE_RANGE_GAP && b.startLine <= a.endLine + LAND_WAVE_RANGE_GAP;

/**
 * Do these two rows collide ON THIS FILE? The fallback is the OLD answer and it is reached by three
 * different absences that mean the same thing: no graph in this checkout (`ranges: null`), a graph
 * that resolved nothing (`[]`), and a graph that resolved somewhere else in the tree but not in this
 * file. All three are "where in this file is not known", and not-known must never read as
 * not-colliding — the whole point of keeping `null` distinct from `[]` one module over.
 *
 * Same-symbol needs no separate arm: two rows naming the same `datei#symbol` resolve through one
 * index to one range, and a range always overlaps itself.
 */
function collidesOn(a: ClassifiedRow, b: ClassifiedRow, file: string): boolean {
  return rangesCollide(rangesIn(a, file), rangesIn(b, file));
}

/** R4 on two range lists of ONE file — the rule land-collision-stats.ts scores against real hunks. */
export function rangesCollide(ra: readonly TaskWaveRange[], rb: readonly TaskWaveRange[]): boolean {
  if (!ra.length || !rb.length) return true;
  return ra.some((x) => rb.some((y) => near(x, y)));
}

const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const rowOrder = (a: { created: number; id: string }, b: { created: number; id: string }): number =>
  a.created - b.created || textOrder(a.id, b.id);

function classify(task: TaskWaveInput): ClassifiedRow {
  const files = [...new Set(task.files ?? [])].sort(textOrder);
  const programId = task.programId?.trim() || null;
  const proportion = verificationProportionFor(files);
  // An unknown surface is priced as CODE, not as docs: `verificationProportionFor([])` reports
  // `proportional:false` for exactly that reason, and the wave must never buy the short chain on
  // an absence.
  const klasse: LandWaveClass = proportion.proportional ? "docs" : "code";
  // R3 BEFORE R2, decided by the owner (MAIN slot 4) after the first CLI run over the real
  // fleet.json named 28 of 31 rows "gate-aenderer": a reason must stand on a fact one HAS, and
  // calling a DERIVED surface a gate changer is a statement about the row's prose, not about the
  // gate. "keine-flaeche" stays first — no surface at all outranks both.
  // "kein-program" (2026-09-07) slots in beneath it and leaves the order of the three older reasons
  // untouched: it is the second ABSENCE, and a row without a program cannot be bundled at all — so
  // "its surface is only derived" would answer a question that no longer decides anything.
  // R2 reads `isGateMachinery` above and NOT `proportion.isolatedPreview` (2026-09-12) — the two
  // answer different questions, and the block above that predicate says which.
  const reasonAgainst: LandWaveReasonAgainst | null =
    !files.length ? "keine-flaeche"
      : !programId ? "kein-program"
        : task.filesOrigin !== "confirmed" ? "flaeche-nur-abgeleitet"
          : files.some(isGateMachinery) ? "gate-aenderer"
            : null;
  return { id: task.id, created: task.created, files, programId, units: landWaveUnits(task.size),
    after: [...new Set(task.after ?? [])].filter((id) => id !== task.id),
    // absent and null are ONE fact here: not measured. Only an array reaches the collision rule.
    ranges: task.ranges ?? null, klasse, reasonAgainst };
}

/**
 * Connected components over COLLIDING shared files within one bucket, in first-appearance
 * (created, id) order.
 *
 * The union used to be per file and first-seen — one representative per file, everyone else joined
 * to it — which is right when the edge is the file itself. It cannot express a range rule: three
 * rows in server.ts at lines 100, 180 and 5000 must leave the third alone, and that is a property
 * of PAIRS. So the file's members are compared pairwise. The groups are a single (class, program)
 * bucket of a queue, tens of rows at most, and the loop is bounded by that rather than by the queue.
 */
function componentsOf(rows: readonly ClassifiedRow[]): ClassifiedRow[][] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) { const next = parent[i]; parent[i] = root; i = next; }
    return root;
  };
  const byFile = new Map<string, number[]>();
  rows.forEach((row, i) => {
    for (const file of row.files) {
      const seen = byFile.get(file) ?? [];
      seen.push(i);
      byFile.set(file, seen);
    }
  });
  for (const [file, members] of byFile)
    for (let x = 0; x < members.length; x++) for (let y = x + 1; y < members.length; y++) {
      if (!collidesOn(rows[members[x]], rows[members[y]], file)) continue;
      const a = find(members[x]), b = find(members[y]);
      if (a !== b) parent[a] = b;
    }
  // A Map keeps insertion order, and a group is inserted at its first member: the components come
  // out in the order of `rows`, which is the AFTER order wavesFor hands in, not a re-sort by date.
  const groups = new Map<number, ClassifiedRow[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(row);
    groups.set(root, group);
  });
  return [...groups.values()];
}

function waveOf(members: readonly ClassifiedRow[], costs: LandWaveCosts): LandWave {
  const counts = new Map<string, number>();
  for (const member of members) for (const file of member.files)
    counts.set(file, (counts.get(file) ?? 0) + 1);
  const klasse = members[0].klasse;
  const perLandSec = klasse === "docs"
    ? costs.docsGateSec + costs.docsAuditSec
    : costs.fullGateSec + costs.fullAuditSec;
  return {
    ids: members.map((member) => member.id),
    klasse,
    sharedFiles: [...counts.entries()].filter(([, n]) => n > 1).map(([file]) => file).sort(textOrder),
    units: members.reduce((sum, member) => sum + member.units, 0),
    savingsSec: (members.length - 1) * perLandSec,
    // A wave cut out of a bundlable component carries no reason AGAINST bundling — the budget did it.
    reasonAgainst: members.length === 1 ? members[0].reasonAgainst : null,
  };
}

/**
 * Cut one component into waves in its (created, id) order: a row joins the open wave while the
 * summed units stay within `budget` and the wave has fewer than LAND_WAVE_ROWS_MAX rows, otherwise
 * it opens the next one. Greedy and order-preserving on purpose — a best-fit packing would reorder
 * the rows a lane commits in, and the same queue must always project the same waves. A row that
 * alone outweighs the budget still forms a wave of one; the budget never drops a row.
 */
function cutByBudget(component: readonly ClassifiedRow[], budget: number): ClassifiedRow[][] {
  const out: ClassifiedRow[][] = [];
  let open: ClassifiedRow[] = [];
  let units = 0;
  for (const row of component) {
    if (open.length && (units + row.units > budget || open.length >= LAND_WAVE_ROWS_MAX)) {
      out.push(open);
      open = [];
      units = 0;
    }
    open.push(row);
    units += row.units;
  }
  if (open.length) out.push(open);
  return out;
}

// --- `NACH:` — A ROW NEVER LANDS IN A WAVE BEFORE THE ROW IT WAITS ON (card `after`).
//
// Two orders, both stable against (created, id). The ROW order puts every row behind its open
// `after` rows, so a component, its budget cut and a wave's own commit order all inherit it. The
// WAVE order is needed as well, because a wave is keyed by its first row: rows X < A < R with X and
// R sharing a file and R waiting on A make the wave {X, R} start before {A} in row order. Waves are
// therefore placed only once every row they wait on is placed. Waves can still wait on each other
// crosswise ({X, R} on {A}, {A, Y} on {X}); then the earliest stuck wave of several rows is
// dissolved into waves of one — rows of one never wait crosswise, since the row order honours every
// edge it can. A cycle among the rows themselves (A after R, R after A) has no honourable order:
// it is broken only once no other row is ready — then its older row goes first and that one edge is
// dropped, rather than one bad card stopping every bundle of the repo.
function afterOrder(rows: readonly ClassifiedRow[]): ClassifiedRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const placed = new Set<string>();
  const rest = [...rows];
  const out: ClassifiedRow[] = [];
  while (rest.length) {
    const ready = rest.findIndex((row) => row.after.every((id) => !byId.has(id) || placed.has(id)));
    const [row] = rest.splice(ready < 0 ? 0 : ready, 1);
    placed.add(row.id);
    out.push(row);
  }
  return out;
}

function placeByAfter(entries: { members: ClassifiedRow[]; wave: LandWave }[],
  rank: ReadonlyMap<string, number>, costs: LandWaveCosts): LandWave[] {
  const rankOf = (entry: { members: ClassifiedRow[] }): number => rank.get(entry.members[0].id) ?? 0;
  const pending = [...entries].sort((a, b) => rankOf(a) - rankOf(b));
  const placed = new Set<string>();
  const out: LandWave[] = [];
  // only an edge the row order honours binds a wave (see the block above)
  const waitsOn = (row: ClassifiedRow, id: string): boolean =>
    (rank.get(id) ?? Infinity) < (rank.get(row.id) ?? 0);
  while (pending.length) {
    const ready = pending.findIndex((entry) => entry.members.every((row) => row.after.every((id) =>
      !waitsOn(row, id) || placed.has(id) || entry.members.some((member) => member.id === id))));
    if (ready >= 0) {
      const [entry] = pending.splice(ready, 1);
      for (const row of entry.members) placed.add(row.id);
      out.push(entry.wave);
      continue;
    }
    const split = pending.findIndex((entry) => entry.members.length > 1);
    if (split < 0) { out.push(...pending.map((entry) => entry.wave)); break; }
    const [entry] = pending.splice(split, 1);
    pending.push(...entry.members.map((row) => ({ members: [row], wave: waveOf([row], costs) })));
    pending.sort((a, b) => rankOf(a) - rankOf(b));
  }
  return out;
}

function wavesFor(inputRows: readonly ClassifiedRow[], budget: number, costs: LandWaveCosts): LandWave[] {
  const rows = afterOrder(inputRows);
  const rank = new Map(rows.map((row, i) => [row.id, i]));
  const built: { members: ClassifiedRow[]; wave: LandWave }[] = [];
  for (const row of rows) if (row.reasonAgainst !== null) built.push({ members: [row], wave: waveOf([row], costs) });
  // R1 and the program boundary are both enforced by CONSTRUCTION, not by a later filter:
  // components are computed inside a single (class, program) bucket, so neither a docs row and a
  // code row nor two rows of different programs can end up in one wave however far their files
  // overlap.
  for (const klasse of ["docs", "code"] as const) {
    const byProgram = new Map<string, ClassifiedRow[]>();
    for (const row of rows) {
      if (row.reasonAgainst !== null || row.klasse !== klasse) continue;
      // A null program is already spoken for by "kein-program" above; this reads the field rather
      // than asserting it, so the bucket key can never become an empty stand-in.
      const program = row.programId;
      if (program === null) continue;
      const group = byProgram.get(program) ?? [];
      group.push(row);
      byProgram.set(program, group);
    }
    for (const bundlable of byProgram.values()) for (const component of componentsOf(bundlable))
      for (const members of cutByBudget(component, budget))
        built.push({ members, wave: waveOf(members, costs) });
  }
  return placeByAfter(built, rank, costs);
}

/** Project open auftrag rows into advisory LAND waves without mutating the supplied facts. */
export function projectLandWaves(input: ProjectLandWavesInput): LandWaveProjection {
  const budget = typeof input.budget === "number" && Number.isFinite(input.budget)
    ? Math.max(1, Math.floor(input.budget)) : LAND_WAVE_BUDGET_DEFAULT;
  const dispatchRepo = input.dispatchRepo?.trim() || undefined;
  // Both open shapes: `queued` is released work, `pending` is a draft the owner has not released —
  // and today every open auftrag row is pending, so a queued-only sensor would project nothing.
  const candidates = input.tasks
    .filter((task) => task.kind === "auftrag" && (task.status === "queued" || task.status === "pending"))
    .slice()
    .sort(rowOrder);

  const unresolved: LandWaveUnresolved[] = [];
  const byRepo = new Map<string, ClassifiedRow[]>();
  for (const task of candidates) {
    const repo = task.repo?.trim() || dispatchRepo;
    if (!repo) {
      unresolved.push({ id: task.id, created: task.created, reason: "unknown-repo" });
      continue;
    }
    const group = byRepo.get(repo) ?? [];
    group.push(classify(task));
    byRepo.set(repo, group);
  }

  const repos: LandWaveRepo[] = [...byRepo.entries()]
    .sort(([a], [b]) => textOrder(a, b))
    .map(([repo, rows]) => ({ repo, waves: wavesFor(rows, budget, input.costs) }));
  unresolved.sort(rowOrder);
  return { budget, repos, unresolved };
}

// --- CLI: the same projector for shell/read-only consumers. The MAIN runs it in the main checkout
// (a lane has no fleet.json) to check the done sentence after a land:
//   bun task-land-waves.ts --state fleet.json [--default-repo REPO] [--budget N]
const argAfter = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  return typeof value === "string" ? value : null;
};

interface StateTask {
  id?: unknown; kind?: unknown; status?: unknown; created?: unknown; repo?: unknown; programId?: unknown;
  card?: { valid?: unknown; size?: unknown; surfaceValid?: unknown; after?: unknown; surface?: { creates?: unknown } };
}

async function cli(): Promise<void> {
  const statePath = argAfter("--state");
  if (!statePath)
    throw new Error("usage: bun task-land-waves.ts --state FILE [--default-repo REPO] [--budget N]");
  const defaultRepo = argAfter("--default-repo");
  const budgetArg = argAfter("--budget");
  const state = await Bun.file(statePath).json() as { tasks?: unknown };
  const tasks = Array.isArray(state.tasks) ? state.tasks as StateTask[] : [];

  // The surface is REUSED, not re-derived: task-metadata.ts's own --state CLI already turns a state
  // file into files/filesOrigin against the tracked tree, and it is spawned rather than imported so
  // this module stays free of node imports for the browser bundle above.
  const args = ["bun", `${import.meta.dir}/task-metadata.ts`, "--state", statePath,
    ...(defaultRepo ? ["--default-repo", defaultRepo] : [])];
  const run = Bun.spawnSync(args, { stdout: "pipe", stderr: "pipe" });
  if (!run.success)
    throw new Error(`task-metadata failed: ${run.stderr.toString().trim() || `exit ${run.exitCode}`}`);
  const meta = JSON.parse(run.stdout.toString()) as {
    tasks?: Record<string, { files?: string[]; filesOrigin?: "confirmed" | "derived";
      ranges?: TaskWaveRange[] | null }>;
  };

  const rows: TaskWaveInput[] = [];
  const strings = (v: unknown): string[] => Array.isArray(v) ? v.filter((e): e is string => typeof e === "string") : [];
  for (const task of tasks) {
    if (typeof task.id !== "string") continue;
    const derived = meta.tasks?.[task.id];
    // the same two card readings server.ts#landWaveProjectionNow makes: creates off a surfaceValid
    // card join the files, after off any card
    const files = [...(derived?.files ?? []), ...(task.card?.surfaceValid === true ? strings(task.card.surface?.creates) : [])];
    const after = strings(task.card?.after);
    rows.push({
      id: task.id,
      kind: typeof task.kind === "string" ? task.kind : undefined,
      status: typeof task.status === "string" ? task.status : "",
      created: typeof task.created === "number" ? task.created : 0,
      ...(typeof task.repo === "string" && task.repo ? { repo: task.repo } : {}),
      ...(typeof task.programId === "string" && task.programId ? { programId: task.programId } : {}),
      // the same reading server.ts#landWaveProjectionNow makes: a VALID card's size, else none (= medium)
      ...(task.card?.valid === true && isTaskCardSize(task.card.size) ? { size: task.card.size } : {}),
      ...(files.length ? { files } : {}),
      ...(after.length ? { after } : {}),
      ...(derived?.filesOrigin ? { filesOrigin: derived.filesOrigin } : {}),
      // null when the checkout carries no graphify-out/, which is the honest answer for a lane and
      // the one that sends collidesOn back to the file level.
      ranges: derived?.ranges ?? null,
    });
  }

  const projection = projectLandWaves({
    tasks: rows,
    ...(defaultRepo ? { dispatchRepo: defaultRepo } : {}),
    ...(budgetArg && Number.isFinite(Number(budgetArg)) ? { budget: Number(budgetArg) } : {}),
    costs: LAND_WAVE_COSTS_2026_09,
  });
  process.stdout.write(`${JSON.stringify({ version: 1, costs: LAND_WAVE_COSTS_2026_09, ...projection })}\n`);
}

if (import.meta.main) {
  cli().catch((error: unknown) => {
    console.error(`task-land-waves: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  });
}

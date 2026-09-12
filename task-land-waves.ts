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
import type { TaskWaveInput } from "./task-waves";

export type LandWaveClass = "docs" | "code";
// Every reason a row is alone in its wave. `null` is the fourth case and means the opposite of a
// verdict: the row IS bundlable and found no partner (or the cap cut it off) — not "reason unknown".
export type LandWaveReasonAgainst =
  "gate-aenderer" | "flaeche-nur-abgeleitet" | "kein-program" | "keine-flaeche";

export interface LandWaveCosts {
  fullGateSec: number; docsGateSec: number; fullAuditSec: number; docsAuditSec: number;
}

export interface ProjectLandWavesInput {
  tasks: readonly TaskWaveInput[];
  dispatchRepo?: string;
  maxWave?: number;
  costs: LandWaveCosts;
}

export interface LandWave {
  ids: string[];
  klasse: LandWaveClass;
  // Files carried by at least TWO rows of this wave — the evidence FOR bundling them. A wave of
  // one has none by construction: "shared" needs a second row, and printing its own surface here
  // would read like an overlap it does not have.
  sharedFiles: string[];
  savingsSec: number;
  reasonAgainst: LandWaveReasonAgainst | null;
}

export interface LandWaveRepo { repo: string; waves: LandWave[] }
export interface LandWaveUnresolved { id: string; created: number; reason: "unknown-repo" }
export interface LandWaveProjection {
  maxWave: number;
  repos: LandWaveRepo[];
  unresolved: LandWaveUnresolved[];
}

// The owner's own bound in docs/queue-wellen-2026-09-06.md §5 S3: a wave must stay small enough for
// one person to attribute a red post-land audit across its rows BY HAND, because the wave buys its
// saving by giving up the per-row bisect that n separate lands would have handed the reader for
// free. That is the whole reason for the number, and it is a reader's budget, not a stack depth.
//
// IT IS NOT COUPLED TO UNDO_STACK_MAX, and the two agreeing on 3 is a coincidence this line exists
// to disarm (owner ask, W3 2026-09-07). The undo stack counts LANDS, and a wave of n rows is ONE
// land with ONE undo record — so a wave of 3 costs the undo stack exactly what a wave of 1 costs
// it, and raising either bound says nothing about the other. Pinned in e2e/pins.ts so a future
// change to this number is a deliberate one rather than a silent widening of the bisect a red
// audit leaves behind.
export const LAND_WAVE_MAX_DEFAULT = 3;

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
  id: string; created: number; files: string[]; programId: string | null;
  klasse: LandWaveClass; reasonAgainst: LandWaveReasonAgainst | null;
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
  return { id: task.id, created: task.created, files, programId, klasse, reasonAgainst };
}

/** Connected components over shared files within one bucket, in first-appearance (created, id) order. */
function componentsOf(rows: readonly ClassifiedRow[]): ClassifiedRow[][] {
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    while (parent[i] !== root) { const next = parent[i]; parent[i] = root; i = next; }
    return root;
  };
  const byFile = new Map<string, number>();
  rows.forEach((row, i) => {
    for (const file of row.files) {
      const seen = byFile.get(file);
      if (seen === undefined) byFile.set(file, i);
      else { const a = find(seen), b = find(i); if (a !== b) parent[a] = b; }
    }
  });
  const groups = new Map<number, ClassifiedRow[]>();
  rows.forEach((row, i) => {
    const root = find(i);
    const group = groups.get(root) ?? [];
    group.push(row);
    groups.set(root, group);
  });
  return [...groups.values()].sort((a, b) => rowOrder(a[0], b[0]));
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
    savingsSec: (members.length - 1) * perLandSec,
    // A wave cut out of a bundlable component carries no reason AGAINST bundling — the cap did it.
    reasonAgainst: members.length === 1 ? members[0].reasonAgainst : null,
  };
}

function wavesFor(rows: readonly ClassifiedRow[], maxWave: number, costs: LandWaveCosts): LandWave[] {
  const built: { key: ClassifiedRow; wave: LandWave }[] = [];
  for (const row of rows) if (row.reasonAgainst !== null) built.push({ key: row, wave: waveOf([row], costs) });
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
      for (let at = 0; at < component.length; at += maxWave) {
        const members = component.slice(at, at + maxWave);
        built.push({ key: members[0], wave: waveOf(members, costs) });
      }
  }
  return built.sort((a, b) => rowOrder(a.key, b.key)).map((entry) => entry.wave);
}

/** Project open auftrag rows into advisory LAND waves without mutating the supplied facts. */
export function projectLandWaves(input: ProjectLandWavesInput): LandWaveProjection {
  const maxWave = typeof input.maxWave === "number" && Number.isFinite(input.maxWave)
    ? Math.max(1, Math.floor(input.maxWave)) : LAND_WAVE_MAX_DEFAULT;
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
    .map(([repo, rows]) => ({ repo, waves: wavesFor(rows, maxWave, input.costs) }));
  unresolved.sort(rowOrder);
  return { maxWave, repos, unresolved };
}

// --- CLI: the same projector for shell/read-only consumers. The MAIN runs it in the main checkout
// (a lane has no fleet.json) to check the done sentence after a land:
//   bun task-land-waves.ts --state fleet.json [--default-repo REPO] [--max-wave N]
const argAfter = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  const value = at >= 0 ? process.argv[at + 1] : undefined;
  return typeof value === "string" ? value : null;
};

interface StateTask {
  id?: unknown; kind?: unknown; status?: unknown; created?: unknown; repo?: unknown; programId?: unknown;
}

async function cli(): Promise<void> {
  const statePath = argAfter("--state");
  if (!statePath)
    throw new Error("usage: bun task-land-waves.ts --state FILE [--default-repo REPO] [--max-wave N]");
  const defaultRepo = argAfter("--default-repo");
  const maxWaveArg = argAfter("--max-wave");
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
    tasks?: Record<string, { files?: string[]; filesOrigin?: "confirmed" | "derived" }>;
  };

  const rows: TaskWaveInput[] = [];
  for (const task of tasks) {
    if (typeof task.id !== "string") continue;
    const derived = meta.tasks?.[task.id];
    rows.push({
      id: task.id,
      kind: typeof task.kind === "string" ? task.kind : undefined,
      status: typeof task.status === "string" ? task.status : "",
      created: typeof task.created === "number" ? task.created : 0,
      ...(typeof task.repo === "string" && task.repo ? { repo: task.repo } : {}),
      ...(typeof task.programId === "string" && task.programId ? { programId: task.programId } : {}),
      ...(derived?.files ? { files: derived.files } : {}),
      ...(derived?.filesOrigin ? { filesOrigin: derived.filesOrigin } : {}),
    });
  }

  const projection = projectLandWaves({
    tasks: rows,
    ...(defaultRepo ? { dispatchRepo: defaultRepo } : {}),
    ...(maxWaveArg && Number.isFinite(Number(maxWaveArg)) ? { maxWave: Number(maxWaveArg) } : {}),
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

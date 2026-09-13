// Deterministic, read-only queue wave projection.
//
// This module is deliberately browser-safe: facts enter through ProjectTaskWavesInput and the
// result describes a view only. It has no DOM, Node, persistence, or dispatch dependency.

export type TaskWaveFilesOrigin = "confirmed" | "card" | "derived";

// EVERY EDGE HERE IS DETERMINISTIC. Until 2026-09-10 a second kind rode beside the file surface:
// the queue analyst's `collides`, admitted only on a fresh verdict while the analyst was on
// ("model edges", four trust states, plus the running-work block those edges alone produced). The
// analyst is retired, so a projection carrying a trust state nothing can ever fill would report
// "unknown" about a reader that does not exist — which is the one reading the trust vocabulary was
// built to prevent. What remains is the surface: two rows collide when they name the same file.

// WHERE in a file a row works. Structurally the same record `task-metadata.ts#SymbolRange` produces,
// declared HERE so the two wave projectors stay browser-safe — task-metadata.ts reaches the
// filesystem, and src/client.ts imports the land fold.
//
// `symbol` is "" for a literal `datei:zeile` reference, which names no symbol. That is a different
// fact from a resolved one and is kept as one, even though the collision rule below reads only the
// lines: a same-symbol pair is already the identical-range case, so nothing needs to compare names.
export interface TaskWaveRange {
  file: string;
  symbol: string;
  startLine: number;
  endLine: number;
}

// A row's SIZE CLASS, as its card states it (card-extract.ts#validateCard). Declared here and not
// in card-extract.ts for the reason TaskWaveRange is: that module reaches the filesystem through
// task-metadata.ts, and src/client.ts bundles the land fold that weighs rows by this.
export const TASK_CARD_SIZES = ["klein", "mittel", "gross"] as const;
export type TaskCardSize = typeof TASK_CARD_SIZES[number];
export const isTaskCardSize = (value: unknown): value is TaskCardSize =>
  typeof value === "string" && (TASK_CARD_SIZES as readonly string[]).includes(value);

export interface TaskWaveInput {
  id: string;
  repo?: string;
  kind?: string;
  status: string;
  created: number;
  files?: readonly string[];
  filesOrigin?: TaskWaveFilesOrigin;
  // Read by the LAND fold only, where it is what turns a file-level collision into a range-level
  // one. `null` and absent both mean NOT MEASURED (no symbol graph in this checkout), and so does
  // an entry list that carries nothing for the file being compared — all three fall back to the
  // file. The parallel projection below ignores ranges entirely: two rows that may not RUN at once
  // are decided by the file, because a lane edits a whole working tree and not a line span.
  ranges?: readonly TaskWaveRange[] | null;
  // Read by the LAND fold only (task-land-waves.ts), where it is the second bundling criterion
  // beside the file surface. The parallel projection below ignores it: two rows of different
  // programs that touch the same file still collide.
  programId?: string;
  // Read by the LAND fold only: the row's weight against the wave budget. Absent = medium there
  // (task-land-waves.ts#landWaveUnits); the parallel projection below ignores it.
  size?: TaskCardSize;
  // Read by the LAND fold only: queue ids this row waits on (its card's `after`). The fold never
  // places the row in a wave before theirs; the parallel projection below ignores it.
  after?: readonly string[];
}

export interface ProjectTaskWavesInput {
  tasks: readonly TaskWaveInput[];
  dispatchRepo?: string;
  maxLanes: number;
}

export interface ProjectedWaveTask {
  id: string;
  repo: string;
  created: number;
  files: string[];
  filesOrigin: TaskWaveFilesOrigin | "unknown";
}

export interface TaskWave {
  index: number;
  claim: "no-known-collision";
  tasks: ProjectedWaveTask[];
}

export interface TaskWaveRepo {
  repo: string;
  waves: TaskWave[];
}

export interface TaskWaveUnresolved {
  id: string;
  repo?: string;
  created: number;
  filesOrigin: TaskWaveFilesOrigin | "unknown";
  reason: "unknown-files" | "unknown-repo" | "no-capacity";
}

// `blockedByRunning` stood here beside `unresolved` until 2026-09-10. It reported rows held out of
// every wave because a TRUSTED model edge named work that is running right now — and a trusted edge
// was the only thing that could fill it. With the analyst retired the list would have been
// permanently empty, which on a board reads as "nothing collides with running work" rather than as
// "nobody is looking". A row a running lane conflicts with is now simply a row the file surface
// does not separate, and the dispatcher's own caps decide what starts.
export interface TaskWaveProjection {
  capacity: number;
  repos: TaskWaveRepo[];
  unresolved: TaskWaveUnresolved[];
}

const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const taskOrder = (a: TaskWaveInput, b: TaskWaveInput): number =>
  a.created - b.created || textOrder(a.id, b.id);
const projectedOrder = (a: { created: number; id: string }, b: { created: number; id: string }): number =>
  a.created - b.created || textOrder(a.id, b.id);

function projectedTask(task: TaskWaveInput, repo: string): ProjectedWaveTask {
  return {
    id: task.id,
    repo,
    created: task.created,
    files: [...(task.files ?? [])],
    filesOrigin: task.filesOrigin ?? "unknown",
  };
}

function pairConflicts(a: TaskWaveInput, b: TaskWaveInput): boolean {
  const bFiles = new Set(b.files ?? []);
  return (a.files ?? []).some((file) => bFiles.has(file));
}

/** Project queued auftrag rows into advisory waves without mutating the supplied facts. */
export function projectTaskWaves(input: ProjectTaskWavesInput): TaskWaveProjection {
  const capacity = Number.isFinite(input.maxLanes) ? Math.max(0, Math.floor(input.maxLanes)) : 0;
  const dispatchRepo = input.dispatchRepo?.trim() || undefined;
  const candidates = input.tasks
    .filter((task) => task.kind === "auftrag" && task.status === "queued")
    .slice()
    .sort(taskOrder);

  const unresolved: TaskWaveUnresolved[] = [];
  const byRepo = new Map<string, TaskWaveInput[]>();

  for (const task of candidates) {
    const repo = task.repo?.trim() || dispatchRepo;
    const filesOrigin = task.filesOrigin ?? "unknown";
    if (!repo) {
      unresolved.push({ id: task.id, created: task.created, filesOrigin, reason: "unknown-repo" });
      continue;
    }
    if (!task.files?.length) {
      unresolved.push({ id: task.id, repo, created: task.created, filesOrigin, reason: "unknown-files" });
      continue;
    }
    if (capacity === 0) {
      unresolved.push({ id: task.id, repo, created: task.created, filesOrigin, reason: "no-capacity" });
      continue;
    }
    const group = byRepo.get(repo) ?? [];
    group.push(task);
    byRepo.set(repo, group);
  }

  const repos: TaskWaveRepo[] = [...byRepo.entries()]
    .sort(([a], [b]) => textOrder(a, b))
    .map(([repo, tasks]) => {
      const rawWaves: TaskWaveInput[][] = [];
      for (const task of tasks) {
        const wave = rawWaves.find((placed) =>
          placed.length < capacity && placed.every((other) => !pairConflicts(task, other)));
        if (wave) wave.push(task);
        else rawWaves.push([task]);
      }
      return {
        repo,
        waves: rawWaves.map((tasksInWave, index) => ({
          index: index + 1,
          claim: "no-known-collision" as const,
          tasks: tasksInWave.map((task) => projectedTask(task, repo)),
        })),
      };
    });

  unresolved.sort(projectedOrder);
  return { capacity, repos, unresolved };
}

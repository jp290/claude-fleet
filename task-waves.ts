// Deterministic, read-only queue wave projection.
//
// This module is deliberately browser-safe: facts enter through ProjectTaskWavesInput and the
// result describes a view only. It has no DOM, Node, persistence, or dispatch dependency.

export type TaskWaveFilesOrigin = "confirmed" | "derived";
export type TaskWaveAnalysisTrust = "trusted" | "unknown";
export type TaskWaveModelEdges = "trusted" | "off" | "stale" | "unknown";

export interface TaskWaveAnalysisInput {
  collides: readonly string[];
  stale: boolean;
  trust: TaskWaveAnalysisTrust;
}

export interface TaskWaveAnalysisDigestInput {
  at: number;
  stale: boolean;
  trust: TaskWaveAnalysisTrust;
}

export interface TaskWaveAnalysisFullInput {
  at: number;
  collides: readonly string[];
}

// The poll digest can arrive before GET /api/tasks refreshes the full cache. Never combine those
// two generations: old edges paired with a new fresh digest would turn stale evidence current.
export function matchTaskWaveAnalysis(
  digest: TaskWaveAnalysisDigestInput | undefined,
  full: TaskWaveAnalysisFullInput | undefined,
): TaskWaveAnalysisInput | undefined {
  if (!digest || !full || full.at !== digest.at) return undefined;
  return { collides: [...full.collides], stale: digest.stale, trust: digest.trust };
}

export interface TaskWaveInput {
  id: string;
  repo?: string;
  kind?: string;
  status: string;
  created: number;
  files?: readonly string[];
  filesOrigin?: TaskWaveFilesOrigin;
  analysis?: TaskWaveAnalysisInput;
}

export interface ProjectTaskWavesInput {
  tasks: readonly TaskWaveInput[];
  dispatchRepo?: string;
  maxLanes: number;
  runningTaskIds: readonly string[];
  runningBranches: readonly string[];
  // Only literal true enables model edges. Missing is intentionally OFF until the server exposes
  // the analyst runtime fact; a configured-looking verdict is not proof that the analyst is on.
  analysisOn?: boolean;
}

export interface ProjectedWaveTask {
  id: string;
  repo: string;
  created: number;
  files: string[];
  filesOrigin: TaskWaveFilesOrigin | "unknown";
  modelEdges: TaskWaveModelEdges;
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

export interface TaskWaveRunningBlock {
  id: string;
  repo?: string;
  created: number;
  files: string[];
  filesOrigin: TaskWaveFilesOrigin | "unknown";
  modelEdges: TaskWaveModelEdges;
  running: string[];
}

export interface TaskWaveUnresolved {
  id: string;
  repo?: string;
  created: number;
  filesOrigin: TaskWaveFilesOrigin | "unknown";
  modelEdges: TaskWaveModelEdges;
  reason: "unknown-files" | "unknown-repo" | "no-capacity";
}

export interface TaskWaveProjection {
  capacity: number;
  analysisMode: "on" | "off";
  repos: TaskWaveRepo[];
  blockedByRunning: TaskWaveRunningBlock[];
  unresolved: TaskWaveUnresolved[];
}

const textOrder = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const taskOrder = (a: TaskWaveInput, b: TaskWaveInput): number =>
  a.created - b.created || textOrder(a.id, b.id);
const projectedOrder = (a: { created: number; id: string }, b: { created: number; id: string }): number =>
  a.created - b.created || textOrder(a.id, b.id);

function modelEdgesFor(task: TaskWaveInput, analysisOn: boolean): TaskWaveModelEdges {
  if (!analysisOn) return "off";
  if (!task.analysis) return "unknown";
  if (task.analysis.stale) return "stale";
  return task.analysis.trust === "trusted" ? "trusted" : "unknown";
}

function trustedCollides(task: TaskWaveInput, analysisOn: boolean): readonly string[] {
  return modelEdgesFor(task, analysisOn) === "trusted" ? (task.analysis?.collides ?? []) : [];
}

function projectedTask(task: TaskWaveInput, repo: string, analysisOn: boolean): ProjectedWaveTask {
  return {
    id: task.id,
    repo,
    created: task.created,
    files: [...(task.files ?? [])],
    filesOrigin: task.filesOrigin ?? "unknown",
    modelEdges: modelEdgesFor(task, analysisOn),
  };
}

function pairConflicts(a: TaskWaveInput, b: TaskWaveInput, analysisOn: boolean): boolean {
  const bFiles = new Set(b.files ?? []);
  if ((a.files ?? []).some((file) => bFiles.has(file))) return true;
  // A one-sided model edge is still an undirected pair conflict. Each reference is admitted only
  // on the trust of the row that produced it; the other row need not repeat the edge.
  return trustedCollides(a, analysisOn).includes(b.id)
    || trustedCollides(b, analysisOn).includes(a.id);
}

/** Project queued auftrag rows into advisory waves without mutating the supplied facts. */
export function projectTaskWaves(input: ProjectTaskWavesInput): TaskWaveProjection {
  const analysisOn = input.analysisOn === true;
  const capacity = Number.isFinite(input.maxLanes) ? Math.max(0, Math.floor(input.maxLanes)) : 0;
  const dispatchRepo = input.dispatchRepo?.trim() || undefined;
  const running = new Set([...input.runningTaskIds, ...input.runningBranches].filter(Boolean));
  const candidates = input.tasks
    .filter((task) => task.kind === "auftrag" && task.status === "queued")
    .slice()
    .sort(taskOrder);

  const blockedByRunning: TaskWaveRunningBlock[] = [];
  const unresolved: TaskWaveUnresolved[] = [];
  const byRepo = new Map<string, TaskWaveInput[]>();

  for (const task of candidates) {
    const repo = task.repo?.trim() || dispatchRepo;
    const modelEdges = modelEdgesFor(task, analysisOn);
    const filesOrigin = task.filesOrigin ?? "unknown";
    const runningRefs = [...new Set(trustedCollides(task, analysisOn).filter((ref) => running.has(ref)))]
      .sort(textOrder);

    // A trusted running-work block is stronger than an unknown file surface or repo: either way
    // this row stays outside waves, and naming the active blocker is the useful honest explanation.
    if (runningRefs.length) {
      blockedByRunning.push({
        id: task.id, ...(repo ? { repo } : {}), created: task.created,
        files: [...(task.files ?? [])], filesOrigin, modelEdges, running: runningRefs,
      });
      continue;
    }
    if (!repo) {
      unresolved.push({ id: task.id, created: task.created, filesOrigin, modelEdges, reason: "unknown-repo" });
      continue;
    }
    if (!task.files?.length) {
      unresolved.push({ id: task.id, repo, created: task.created, filesOrigin, modelEdges, reason: "unknown-files" });
      continue;
    }
    if (capacity === 0) {
      unresolved.push({ id: task.id, repo, created: task.created, filesOrigin, modelEdges, reason: "no-capacity" });
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
          placed.length < capacity && placed.every((other) => !pairConflicts(task, other, analysisOn)));
        if (wave) wave.push(task);
        else rawWaves.push([task]);
      }
      return {
        repo,
        waves: rawWaves.map((tasksInWave, index) => ({
          index: index + 1,
          claim: "no-known-collision" as const,
          tasks: tasksInWave.map((task) => projectedTask(task, repo, analysisOn)),
        })),
      };
    });

  blockedByRunning.sort(projectedOrder);
  unresolved.sort(projectedOrder);
  return { capacity, analysisMode: analysisOn ? "on" : "off", repos, blockedByRunning, unresolved };
}

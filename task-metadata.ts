// Deterministic, read-only task surface projection.
//
// The pure half (`deriveTaskMetadata`) turns exact path tokens into queue metadata only when the
// token names a tracked file. The CLI is the same projector for shell/read-only consumers:
//   bun task-metadata.ts --state fleet.json --default-repo /path/to/repo
// It prints suggestions as JSON and never writes the state file.
import { realpathSync, readFileSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const TASK_PROCESSES = [
  "server", "client-ui", "e2e-gates", "docs", "harness-adapter", "betrieb", "cross-cutting",
] as const;
export type TaskProcess = (typeof TASK_PROCESSES)[number];
export type TaskFilesOrigin = "confirmed" | "derived";
export interface TaskCluster {
  projekt: string;
  prozess: TaskProcess;
  unterprozess?: string;
}
export interface TaskMetadata {
  files?: string[];
  filesOrigin?: TaskFilesOrigin;
  cluster?: TaskCluster;
}
export interface TaskMetadataInput {
  text?: string | null;
  brief?: string | null;
  // This is the promoted refine-confirm field, not a proposal and not a model reading.
  confirmedFiles?: readonly string[] | null;
}
export interface TaskMetadataContext {
  trackedPaths: ReadonlySet<string>;
  project: string | null;
  repoRoot?: string | null;
}
export interface TrackedSnapshot {
  repo: string;
  project: string;
  paths: Set<string>;
  indexPath: string | null;
  indexStamp: string | null;
}

const PATH_TOKEN = /(?:\.{0,2}\/|\/)?[A-Za-z0-9_@.][A-Za-z0-9_@.+/-]*/g;

const uniqueNonempty = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (value && !seen.has(value)) { seen.add(value); out.push(value); }
  }
  return out;
};

function relativeCandidate(token: string, repoRoot?: string | null): string {
  let value = token;
  if (repoRoot) {
    const prefix = repoRoot.endsWith("/") ? repoRoot : `${repoRoot}/`;
    if (value.startsWith(prefix)) value = value.slice(prefix.length);
  }
  if (value.startsWith("./")) value = value.slice(2);
  return value;
}

export function exactTrackedPaths(
  texts: readonly (string | null | undefined)[],
  trackedPaths: ReadonlySet<string>,
  repoRoot?: string | null,
): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(PATH_TOKEN)) {
      let candidate = relativeCandidate(match[0], repoRoot);
      // A sentence-ending full stop is prose punctuation, not part of `server.ts`. Prefer an exact
      // tracked token first (dotfiles stay intact), then try only this unambiguous punctuation trim.
      if (!trackedPaths.has(candidate) && candidate.endsWith(".")) candidate = candidate.replace(/\.+$/, "");
      if (trackedPaths.has(candidate)) found.add(candidate);
    }
  }
  return [...found].sort();
}

// A path can span more than one leaf subsystem (`src/protocol.ts` is deliberately shared). The
// union, not the first match, decides whether a task is genuinely cross-cutting.
function processesForPath(path: string): Exclude<TaskProcess, "cross-cutting">[] | null {
  if (path === "src/protocol.ts") return ["client-ui", "server"];
  if (path.startsWith("e2e/") || path.startsWith("drills/")
    || /^fleet-e2e(?:-|\.)/.test(path) || /^e2e-(?:.*\.)?sh$/.test(path)
    || path === "e2e-stage.sh" || path === "docker-verify.sh") return ["e2e-gates"];
  if (path.startsWith("docs/") || path.startsWith("briefs/") || path.endsWith(".md")
    || path === "LICENSE") return ["docs"];
  if (path === "Dockerfile" || path === ".dockerignore" || path === "container-firewall.sh"
    || path === "docker-entrypoint.sh" || path === "worker-deepseek.py"
    || path.startsWith(".claude/")) return ["harness-adapter"];
  if (path.startsWith("public/") || path.startsWith("src/")) return ["client-ui"];
  if (path === "watchdog.sh" || path === "register.sh" || path === "state.sh"
    || path === "atlas.sh" || path === "steward-arena.sh" || path.endsWith(".plist")
    || path === "package.json" || path === "bun.lock" || path === ".gitignore"
    || path === "HANDOFF.md" || path === "INTAKE.md" || path === "SHARING.md") return ["betrieb"];
  if (path === "server.ts" || path === "task-metadata.ts" || path.endsWith("-prompt.ts")
    || path === "continuity.ts" || path === "lane-signals.ts" || path === "slotstats.ts"
    || path === "trailstats.ts") return ["server"];
  return null;
}

export function clusterForFiles(files: readonly string[], project: string | null): TaskCluster | undefined {
  if (!project || !files.length) return undefined;
  const leaves = new Set<Exclude<TaskProcess, "cross-cutting">>();
  for (const path of files) {
    const processes = processesForPath(path);
    // A known file with no deterministic subsystem map leaves the cluster unknown. Silently
    // dropping it would claim that a multi-surface task belongs wholly to the paths we understood.
    if (!processes) return undefined;
    for (const process of processes) leaves.add(process);
  }
  const sorted = [...leaves].sort();
  if (sorted.length === 1) return { projekt: project, prozess: sorted[0] };
  return { projekt: project, prozess: "cross-cutting", unterprozess: sorted.join("+") };
}

export function deriveTaskMetadata(input: TaskMetadataInput, context: TaskMetadataContext): TaskMetadata {
  const confirmed = input.confirmedFiles?.length ? uniqueNonempty(input.confirmedFiles) : [];
  const files = confirmed.length
    ? confirmed
    : exactTrackedPaths([input.text, input.brief], context.trackedPaths, context.repoRoot);
  if (!files.length) return {}; // UNKNOWN is absence, never an invented empty list.
  const filesOrigin: TaskFilesOrigin = confirmed.length ? "confirmed" : "derived";
  const cluster = clusterForFiles(files, context.project);
  return { files, filesOrigin, ...(cluster ? { cluster } : {}) };
}

export function projectLabel(repo: string): string {
  const name = basename(repo).replace(/\.git$/, "");
  return name || repo;
}

export function trackedIndexStamp(indexPath: string | null): string | null {
  if (!indexPath) return null;
  try {
    const st = statSync(indexPath);
    return `${st.mtimeMs}:${st.size}`;
  } catch {
    return null;
  }
}

const gitText = (repo: string, args: string[]): string => {
  const run = spawnSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  if (run.status !== 0)
    throw new Error((run.stderr || `git ${args.join(" ")} failed`).trim());
  return run.stdout;
};

export function readTrackedSnapshot(repoRaw: string): TrackedSnapshot {
  const repo = realpathSync(resolve(repoRaw));
  const paths = new Set(gitText(repo, ["ls-files", "-z"]).split("\0").filter(Boolean));
  const rawIndex = gitText(repo, ["rev-parse", "--git-path", "index"]).trim();
  const indexPath = rawIndex ? resolve(repo, rawIndex) : null;
  return { repo, project: projectLabel(repo), paths, indexPath, indexStamp: trackedIndexStamp(indexPath) };
}

interface StateTask {
  id?: unknown;
  text?: unknown;
  repo?: unknown;
  files?: unknown;
  filesOrigin?: unknown;
  brief?: { text?: unknown } | null;
}

const argAfter = (name: string): string | null => {
  const at = process.argv.indexOf(name);
  return at >= 0 && typeof process.argv[at + 1] === "string" ? process.argv[at + 1] : null;
};

function cli(): void {
  const statePath = argAfter("--state");
  if (!statePath) throw new Error("usage: bun task-metadata.ts --state FILE [--default-repo REPO]");
  const defaultRepo = argAfter("--default-repo");
  const state = JSON.parse(readFileSync(statePath, "utf8")) as { tasks?: unknown };
  const tasks = Array.isArray(state.tasks) ? state.tasks as StateTask[] : [];
  const snapshots = new Map<string, TrackedSnapshot | null>();
  const errors: Record<string, string> = {};
  const output: Record<string, TaskMetadata> = {};
  for (const task of tasks) {
    if (typeof task.id !== "string") continue;
    const repoRaw = typeof task.repo === "string" && task.repo ? task.repo : defaultRepo;
    let snapshot: TrackedSnapshot | null = null;
    if (repoRaw) {
      const key = resolve(repoRaw);
      if (!snapshots.has(key)) {
        try { snapshots.set(key, readTrackedSnapshot(key)); }
        catch (error) {
          snapshots.set(key, null);
          errors[key] = error instanceof Error ? error.message : String(error);
        }
      }
      snapshot = snapshots.get(key) ?? null;
    }
    const rawFiles = Array.isArray(task.files)
      ? task.files.filter((value): value is string => typeof value === "string" && !!value.trim()) : [];
    // Derived metadata is never meant to be persisted. If a hand-edited state does so anyway,
    // re-derive it instead of promoting the weaker source to confirmed on reload.
    const confirmedFiles = task.filesOrigin === "derived" ? [] : rawFiles;
    output[task.id] = deriveTaskMetadata({
      text: typeof task.text === "string" ? task.text : null,
      brief: typeof task.brief?.text === "string" ? task.brief.text : null,
      confirmedFiles,
    }, {
      trackedPaths: snapshot?.paths ?? new Set<string>(),
      project: snapshot?.project ?? (repoRaw ? projectLabel(repoRaw) : null),
      repoRoot: snapshot?.repo ?? repoRaw,
    });
  }
  process.stdout.write(`${JSON.stringify({ version: 1, tasks: output, ...(Object.keys(errors).length ? { errors } : {}) })}\n`);
}

if (import.meta.main) {
  try { cli(); }
  catch (error) {
    console.error(`task-metadata: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}

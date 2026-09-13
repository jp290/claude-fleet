// Deterministic, read-only task surface projection.
//
// The pure half (`deriveTaskMetadata`) turns exact path tokens into queue metadata only when the
// token names a tracked file. The CLI is the same projector for shell/read-only consumers:
//   bun task-metadata.ts --state fleet.json --default-repo /path/to/repo
// It prints suggestions as JSON and never writes the state file.
import { realpathSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const TASK_PROCESSES = [
  "server", "client-ui", "e2e-gates", "docs", "harness-adapter", "betrieb", "cross-cutting",
] as const;
export type TaskProcess = (typeof TASK_PROCESSES)[number];
// "card" (2026-09-13): the surface a surfaceValid card names, lifted onto a Program row by the card
// tick without a confirming act (server.ts#liftCardSurface). Stronger than "derived" — it passed the
// quote rule, the tracked tree and the symbol declaration — but not the owner's act, so the land
// fold bundles it only on range evidence (task-land-waves.ts#collidesOn), never on a shared file.
export type TaskFilesOrigin = "confirmed" | "card" | "derived";
export interface TaskCluster {
  projekt: string;
  prozess: TaskProcess;
  unterprozess?: string;
}
export interface TaskMetadata {
  files?: string[];
  filesOrigin?: TaskFilesOrigin;
  cluster?: TaskCluster;
  // The range half of the surface. `null` is NOT "no ranges" — it is "no symbol index was
  // available here", which is the honest shape in a lane, where graphify-out/ does not exist. An
  // empty ARRAY is the other fact: the index was read and the row names no resolvable range.
  ranges?: SymbolRange[] | null;
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
  // Absent or null = this checkout carries no graph, so the range half stays UNKNOWN.
  symbolIndex?: SymbolIndex | null;
}
export interface TrackedSnapshot {
  repo: string;
  project: string;
  paths: Set<string>;
  indexPath: string | null;
  indexStamp: string | null;
}

const PATH_TOKEN = /(?:\.{0,2}\/|\/)?[A-Za-z0-9_@.][A-Za-z0-9_@.+/-]*/g;
// A `datei#symbol` or `datei:zeile` reference in one token. Neither `#` nor `:` is in PATH_TOKEN's
// character class, so the plain scan above already yields the FILE half of both — this pattern
// exists for the other half, the range.
const SYMBOL_REF = /(?:\.{0,2}\/|\/)?[A-Za-z0-9_@.][A-Za-z0-9_@.+/-]*#[.A-Za-z_$][A-Za-z0-9_$]*/g;
const LINE_REF = /(?:\.{0,2}\/|\/)?[A-Za-z0-9_@.][A-Za-z0-9_@.+/-]*:(\d+)(?:\s*[-\u2013]\s*(\d+))?/g;

// --- QUOTE IS NOT INTENT (docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md §2, Befund 3)
//
// A path named in a VERIFY line or inside a quoted command is a statement about how the work will
// be PROVEN, not about what it changes. Until 2026-09-12 the scan could not tell the two apart, and
// the cost was measured rather than suspected: over the 37 open auftrag rows, 18 fell to R2
// `gate-aenderer` in the what-if projection because their surface had collected `e2e-isolated.sh`
// or `e2e/pins.ts` out of a quoted verify chain. R2 is right to hold a gate changer back; the rows
// simply were not gate changers.
//
// The four leads are the owner's own list (DONE (1) of the S1 line): `./`, `bun `, `bunx `, `curl `.
// A lead inside a backtick span masks THAT SPAN — not the rest of the prose, so
// "gemessen mit `bun task-land-waves.ts --state fleet.json`, geaendert wird task-land-waves.ts"
// keeps its real surface. A lead in unquoted prose masks to end of line, because an unquoted
// command has no closing mark and its arguments run to the line's end.
const VERIFY_LINE = /^[\s>*+\-\u2013\u2014\u2022\d.)\][]*\**\s*(?:verify|verifikation)\b/i;
const COMMAND_LEAD = /(?:^|[\s(\[])(\.\/|bun\s|bunx\s|curl\s)/;
const FENCE_LINE = /^\s*```/;

/** Character spans of the inline `...` runs in one line, as [start, endExclusive] pairs. */
function backtickSpans(line: string): [number, number][] {
  const spans: [number, number][] = [];
  let open = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "`") continue;
    if (open < 0) open = i;
    else { spans.push([open, i + 1]); open = -1; }
  }
  return spans; // an unclosed backtick opens no span: half a quote is not a quotation
}

// Blank out the command text of one line, keeping its length so every other offset still holds.
// `inQuote` says the line sits inside a ``` fence, where the whole line is quoted text.
function maskCommands(line: string, inQuote: boolean): string {
  const chars = line.split(""); // UTF-16 units, so every offset below stays exact
  const blank = (from: number, to: number): void => {
    for (let i = Math.max(0, from); i < Math.min(chars.length, to); i++) chars[i] = " ";
  };
  if (inQuote) {
    // inside a fence the whole line is quoted text; it is a command iff it reads as one
    if (COMMAND_LEAD.test(line)) return " ".repeat(line.length);
    return line;
  }
  const spans = backtickSpans(line);
  for (const [from, to] of spans) {
    const inner = line.slice(from + 1, to - 1);
    if (COMMAND_LEAD.test(inner) || /^\s*(?:\.\/|bun\s|bunx\s|curl\s)/.test(inner)) blank(from, to);
  }
  // An unquoted lead OUTSIDE every span runs to end of line.
  const inSpan = (at: number): boolean => spans.some(([from, to]) => at >= from && at < to);
  let at = 0;
  while (at < chars.length) {
    const rest = line.slice(at);
    const hit = COMMAND_LEAD.exec(rest);
    if (!hit) break;
    const cut = at + hit.index + hit[0].length - hit[1].length;
    if (!inSpan(cut)) { blank(cut, chars.length); break; }
    at = cut + hit[1].length;
  }
  return chars.join("");
}

/**
 * The scannable text of a task: every line with its verify citations and quoted commands blanked
 * out. Length-preserving, so a caller may still read offsets against the original.
 */
export function intentText(text: string): string {
  let inFence = false;
  return text.split("\n").map((line) => {
    if (FENCE_LINE.test(line)) { inFence = !inFence; return " ".repeat(line.length); }
    if (!inFence && VERIFY_LINE.test(line)) return " ".repeat(line.length);
    return maskCommands(line, inFence);
  }).join("\n");
}

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
    // The CHANGE TARGETS only: a path quoted inside a command or standing in a verify line names
    // the proof, not the work (see intentText above).
    for (const match of intentText(text).matchAll(PATH_TOKEN)) {
      let candidate = relativeCandidate(match[0], repoRoot);
      // A sentence-ending full stop is prose punctuation, not part of `server.ts`. Prefer an exact
      // tracked token first (dotfiles stay intact), then try only this unambiguous punctuation trim.
      if (!trackedPaths.has(candidate) && candidate.endsWith(".")) candidate = candidate.replace(/\.+$/, "");
      if (trackedPaths.has(candidate)) found.add(candidate);
    }
  }
  return [...found].sort();
}

// --- THE RANGE HALF OF A SURFACE
//
// A file is not a collision measure: 33 of the 41 open rows name `server.ts`, and of 294 landed
// server.ts lanes 7 needed the merge resolver against 6 of 350 lanes that did not touch it
// (docs/messungen/2026-09-12-spezifizierung-buendelung-befund.md §2, Befund 1). What separates two
// rows is WHERE in the file they work, so a surface carries ranges beside its files.
//
// The index comes from graphify's `graphify-out/graph.json`, which records one START line per code
// symbol and no end. The end is therefore DERIVED: the next symbol's start minus one, and for the
// last symbol of a file its line count. That is an approximation, and it is the honest one
// available — it never claims a symbol is smaller than it is, and the 40-line neighbourhood the
// land-wave collision rule adds on top absorbs the rest.
export interface SymbolRange { file: string; symbol: string; startLine: number; endLine: number }
export type SymbolIndex = ReadonlyMap<string, readonly SymbolRange[]>;
export interface SymbolIndexSnapshot { index: SymbolIndex; path: string; stamp: string }

/** `deriveTaskMetadata()` → `deriveTaskMetadata`, `.spawnCmd()` → `spawnCmd`. */
const symbolKey = (label: string): string => label.replace(/\(\)$/, "").replace(/^\.+/, "");

export function buildSymbolIndex(
  nodes: readonly { label?: unknown; file_type?: unknown; source_file?: unknown; source_location?: unknown }[],
  lineCountOf: (file: string) => number | null,
): SymbolIndex {
  const byFile = new Map<string, SymbolRange[]>();
  for (const node of nodes) {
    if (node.file_type !== "code") continue;
    const file = typeof node.source_file === "string" ? node.source_file : "";
    const label = typeof node.label === "string" ? node.label : "";
    const at = /^L(\d+)$/.exec(typeof node.source_location === "string" ? node.source_location : "");
    if (!file || !label || !at) continue;
    // The graph carries one node for the FILE itself, labelled with its path. It is not a symbol,
    // and admitting it would give every file a bogus range from line 1 to its first declaration.
    if (label === file || label === file.split("/").pop()) continue;
    const list = byFile.get(file) ?? [];
    list.push({ file, symbol: symbolKey(label), startLine: Number(at[1]), endLine: 0 });
    byFile.set(file, list);
  }
  for (const [file, list] of byFile) {
    list.sort((a, b) => a.startLine - b.startLine || (a.symbol < b.symbol ? -1 : 1));
    const lines = lineCountOf(file);
    for (let i = 0; i < list.length; i++) {
      const next = list[i + 1]?.startLine;
      // The last symbol reaches the end of the file when the file can be read, and otherwise stops
      // at its own line — a guessed end would be a wider claim than the measurement supports.
      list[i] = { ...list[i], endLine: next !== undefined ? Math.max(list[i].startLine, next - 1)
        : Math.max(list[i].startLine, lines ?? list[i].startLine) };
    }
  }
  return byFile;
}

function lookupSymbol(index: SymbolIndex, file: string, symbol: string): SymbolRange | null {
  const wanted = symbolKey(symbol);
  return index.get(file)?.find((entry) => entry.symbol === wanted) ?? null;
}

/**
 * The ranges a task's own references name. `datei#symbol` resolves through the graph index;
 * `datei:zeile` and `datei:von-bis` carry their own lines and need no index. Both are read from
 * the INTENT text, so a line cited in a verify command contributes no range either.
 */
export function rangesFromText(
  texts: readonly (string | null | undefined)[],
  files: readonly string[],
  index: SymbolIndex,
  repoRoot?: string | null,
): SymbolRange[] {
  const known = new Set(files);
  const out = new Map<string, SymbolRange>();
  const add = (range: SymbolRange): void => {
    const key = `${range.file}#${range.symbol}:${range.startLine}-${range.endLine}`;
    if (!out.has(key)) out.set(key, range);
  };
  for (const text of texts) {
    if (!text) continue;
    const intent = intentText(text);
    for (const match of intent.matchAll(SYMBOL_REF)) {
      const [raw, symbol] = match[0].split("#");
      const file = relativeCandidate(raw, repoRoot);
      if (!known.has(file) || !symbol) continue;
      const hit = lookupSymbol(index, file, symbol);
      if (hit) add(hit);
    }
    for (const match of intent.matchAll(LINE_REF)) {
      const file = relativeCandidate(match[0].split(":")[0], repoRoot);
      if (!known.has(file)) continue;
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : start;
      if (!Number.isFinite(start) || start < 1) continue;
      // A literal line reference names no symbol, and saying so is the point: the two are different
      // evidence and the collision rule may treat them differently.
      add({ file, symbol: "", startLine: start, endLine: Math.max(start, end) });
    }
  }
  return [...out.values()].sort((a, b) =>
    (a.file < b.file ? -1 : a.file > b.file ? 1 : 0) || a.startLine - b.startLine || a.endLine - b.endLine);
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
    || path === "docker-entrypoint.sh" || path === "attic/worker-deepseek.py"
    || path.startsWith(".claude/")) return ["harness-adapter"];
  if (path.startsWith("public/") || path.startsWith("src/")) return ["client-ui"];
  if (path === "watchdog.sh" || path === "register.sh" || path === "state.sh"
    || path === "attic/atlas.sh" || path === "attic/steward-arena.sh" || path.endsWith(".plist")
    || path === "package.json" || path === "bun.lock" || path === ".gitignore"
    || path === "HANDOFF.md" || path === "INTAKE.md" || path === "SHARING.md") return ["betrieb"];
  // `server/` is the split's destination for server modules (plan-2026-08-31 §Randbedingung 2).
  // The prefix is listed BEFORE the first module moves: an unlisted path returns null, and null
  // leaves the whole cluster undefined — a task naming one new module would lose its cluster
  // entirely, not just that one path. The `.md` block above still wins for a future `server/*.md`.
  if (path === "server.ts" || path.startsWith("server/") || path === "task-metadata.ts"
    || path.endsWith("-prompt.ts")
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
  // The ranges are read from the row's own prose even when the FILES came from a refine-confirm:
  // the owner confirmed which files, not which lines, so the two halves have different origins and
  // the narrower one is derived either way.
  const ranges = context.symbolIndex
    ? rangesFromText([input.text, input.brief], files, context.symbolIndex, context.repoRoot)
    : null;
  return { files, filesOrigin, ...(cluster ? { cluster } : {}), ranges };
}

// --- THE PERSISTED SURFACE
//
// Until 2026-09-12 the surface was a POLL-TIME fact: every 2 s poll re-ran the regex over every
// row's text and brief, and the state file kept nothing (a persisted `derived` value is discarded
// at load, deliberately, so the weaker origin can never be promoted). That was affordable while the
// derivation was one regex; the range half reads a 10 000-node graph, and it is not.
//
// So the surface is computed once and stored — and the price of storing a projection is that it can
// go stale. `sha` is what pays it: it hashes EVERY input the derivation reads, the row's text and
// brief AND the two tree stamps (the git index, the graph file). A reader recomputes exactly when
// one of them moved, so a stored surface can never disagree with the tree it describes, and the
// 2-s poll pays one hash instead of one derivation.
export interface TaskSurface {
  files: string[];
  ranges: SymbolRange[] | null;
  origin: TaskFilesOrigin;
  at: number;
  sha: string;
}
export interface SurfaceInputs {
  text?: string | null;
  brief?: string | null;
  confirmedFiles?: readonly string[] | null;
  indexStamp?: string | null;
  graphStamp?: string | null;
}
export function surfaceSha(inputs: SurfaceInputs): string {
  const h = createHash("sha256");
  for (const part of [inputs.text ?? "", inputs.brief ?? "", (inputs.confirmedFiles ?? []).join("\u0000"),
    inputs.indexStamp ?? "", inputs.graphStamp ?? ""]) h.update(`${part}\u0001`);
  return h.digest("hex").slice(0, 32);
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

// --- THE GRAPH READER, the one impure half of the range resolution.
//
// graphify-out/ is gitignored and exists only in the MAIN checkout, so this returns null in a lane
// — which is the whole reason `ranges: null` is a first-class answer rather than an empty list.
export const SYMBOL_GRAPH_PATH = "graphify-out/graph.json";

export function readSymbolIndexSnapshot(repoRoot: string): SymbolIndexSnapshot | null {
  const path = resolve(repoRoot, SYMBOL_GRAPH_PATH);
  let stamp: string;
  try {
    const st = statSync(path);
    stamp = `${st.mtimeMs}:${st.size}`;
  } catch { return null; }
  let nodes: unknown;
  try { nodes = (JSON.parse(readFileSync(path, "utf8")) as { nodes?: unknown }).nodes; }
  catch { return null; }
  if (!Array.isArray(nodes)) return null;
  // One read per FILE the graph mentions, not one per symbol — and a file that has since been
  // deleted reports null, which buildSymbolIndex reads as "the last symbol stops at its own line".
  const lines = new Map<string, number | null>();
  const lineCountOf = (file: string): number | null => {
    if (!lines.has(file)) {
      try { lines.set(file, readFileSync(resolve(repoRoot, file), "utf8").split("\n").length); }
      catch { lines.set(file, null); }
    }
    return lines.get(file) ?? null;
  };
  return { index: buildSymbolIndex(nodes as Parameters<typeof buildSymbolIndex>[0], lineCountOf), path, stamp };
}

export function symbolGraphStamp(repoRoot: string): string | null {
  try {
    const st = statSync(resolve(repoRoot, SYMBOL_GRAPH_PATH));
    return `${st.mtimeMs}:${st.size}`;
  } catch { return null; }
}

interface StateTask {
  id?: unknown;
  text?: unknown;
  repo?: unknown;
  files?: unknown;
  filesOrigin?: unknown;
  brief?: { text?: unknown } | null;
  card?: { gaps?: unknown; surface?: { ranges?: unknown } } | null;
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
  // One graph read per REPO, like the tracked snapshot beside it. Without this the CLI would answer
  // `ranges: null` for every row even when run against a checkout that HAS a graph — and the owner
  // checking a projection after a land would be measuring the absence of a file rather than the
  // waves.
  const indexes = new Map<string, SymbolIndexSnapshot | null>();
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
      if (!indexes.has(key)) indexes.set(key, readSymbolIndexSnapshot(snapshot?.repo ?? key));
    }
    const rawFiles = Array.isArray(task.files)
      ? task.files.filter((value): value is string => typeof value === "string" && !!value.trim()) : [];
    // Derived metadata is never meant to be persisted. If a hand-edited state does so anyway,
    // re-derive it instead of promoting the weaker source to confirmed on reload.
    // A card lift is not confirmed either, and it is never promoted here. It is reported as what the
    // server projects (server.ts#taskSurfaceOf): the lifted files with the card's own ranges — but
    // only while the card beside it still has no surface gap (card-extract.ts#cardSurfaceValid, the
    // predicate the loader derives, spelled out because that module imports this one).
    const cardGaps = Array.isArray(task.card?.gaps) ? task.card.gaps : null;
    if (task.filesOrigin === "card" && rawFiles.length && cardGaps
      && !cardGaps.some((g) => typeof g === "string" && g.startsWith("surface."))) {
      const cardRanges = task.card?.surface?.ranges;
      const cluster = clusterForFiles(rawFiles, snapshot?.project ?? (repoRaw ? projectLabel(repoRaw) : null));
      output[task.id] = { files: rawFiles, filesOrigin: "card", ...(cluster ? { cluster } : {}),
        ranges: Array.isArray(cardRanges) ? cardRanges as SymbolRange[] : null };
      continue;
    }
    const confirmedFiles = task.filesOrigin === "derived" || task.filesOrigin === "card" ? [] : rawFiles;
    output[task.id] = deriveTaskMetadata({
      text: typeof task.text === "string" ? task.text : null,
      brief: typeof task.brief?.text === "string" ? task.brief.text : null,
      confirmedFiles,
    }, {
      trackedPaths: snapshot?.paths ?? new Set<string>(),
      project: snapshot?.project ?? (repoRaw ? projectLabel(repoRaw) : null),
      repoRoot: snapshot?.repo ?? repoRaw,
      symbolIndex: (repoRaw ? indexes.get(resolve(repoRaw)) : null)?.index ?? null,
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

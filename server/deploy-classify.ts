// WHICH PATHS PUT THE RUNNING SERVER BEHIND — derived from consumption, not from a hand list.
//
// deployGap() asks one question of the range bootHead..HEAD: would restarting srv change what is
// running? Until 2026-09-07 the answer came from a DEFAULT-DENY predicate over two hand-kept
// allowlists (CLIENT_ONLY_FILES, HARNESS_ONLY_FILES): a path was server code unless it was `*.md`,
// under public/ or e2e/, or written down by name. The fail-safe direction was right — an
// unrecognized path must flag a gap, never hide one — but the MAINTENANCE FORM was the defect, and
// it was paid four times:
//   · src/helper.ts and src/backoff.ts were missing until 2026-09-01; each cost the same way round,
//     a land whose whole diff was one of them reading codeBehind:true for work that had already
//     shipped through `bun run build`.
//   · task-land-waves.ts (measured 2026-09-06): a top-level module imported only by src/client.ts,
//     `grep -c task-land-waves server.ts` = 0, classified as server code.
//   · fleet-e2e-harness.ts: the SIXTH single-file runner, booted by e2e-claude-gate.sh phases 2
//     and 3, never added to the five-name list.
// A list that must be extended by hand every time a file is born is not extended.
//
// So the roles are READ OFF THE IMPORT GRAPH of the checkout being measured:
//   · server      — reachable from server.ts. This is the only role that means "restart srv".
//   · non-server  — reachable from a bundle entry (package.json#scripts.build) or from a top-level
//                   fleet-e2e*.ts runner, or under public/ or e2e/, or `*.md`.
//   · unknown     — reachable from nothing we can name. NOT an all-clear: the caller must treat it
//                   the way the old default-deny treated it, as a possible gap. The third value
//                   exists so the caller can SAY it is unproven instead of asserting server code.
// Server reachability is tested FIRST and wins over every prefix rule: if server.ts ever imported
// something under e2e/, that is a real gap and no prefix may hide it.
//
// Two roles stay deliberate, because no import graph can answer them:
//   · every `*.sh` is server. Carried over unchanged from the predicate this replaces: watchdog.sh
//     is not redeployed by an srv restart at all, so no shell file has one honest answer here, and
//     the expensive direction is the false all-clear.
//   · the runtime manifests (package.json, the lockfile, tsconfig.json) are server. A dependency
//     bump changes what the process runs while appearing in nobody's import graph; leaving them
//     `unknown` would fill the unknown list with the routine case and teach it as noise.
import { existsSync, readFileSync, readdirSync } from "node:fs";

export type PathRole = "server" | "non-server" | "unknown";
export interface RepoGraph { server: Set<string>; nonServer: Set<string> }

// The four forms that carry a relative specifier: a `from` clause, a bare side-effect import, a
// dynamic import call and a require call. Relative only — a bare specifier is a package, and no
// package is a path in this repo. The forms are described rather than SPELLED here: e2e-stage.sh
// scans every staged file for exactly this shape and refuses, fatally, to boot an instance where
// one resolves to nothing — an illustration in a comment would be indistinguishable from a real
// broken import, and it would be the scanner that was right.
const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["'](\.[^"'\n]*)["']/g;
// a walk that runs away (a symlink loop, a repo that is not this one) must stop rather than sit in
// the git tick; the real graph is ~140 files, so this bound is never reached by honest input.
const MAX_WALK = 4000;
const RUNTIME_MANIFESTS = new Set(["package.json", "bun.lock", "bun.lockb", "tsconfig.json"]);

// repo-relative resolution of ONE relative specifier, with the extension forms bun actually
// resolves. Returns null when nothing on disk answers it — a specifier pointing at a file that
// does not exist yet contributes no edge, which is the honest reading.
function resolveSpec(from: string, spec: string, repoDir: string): string | null {
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const out: string[] = [];
  for (const part of (dir ? dir.split("/") : []).concat(spec.split("/"))) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  const base = out.join("/");
  if (base === "" || base.startsWith("..")) return null;
  const stem = base.endsWith(".js") ? base.slice(0, -3) : base;
  for (const cand of [base, `${stem}.ts`, `${stem}.tsx`, `${base}/index.ts`]) {
    if (!cand.endsWith(".ts") && !cand.endsWith(".tsx")) continue;
    if (existsSync(`${repoDir}/${cand}`)) return cand;
  }
  return null;
}

function walk(repoDir: string, entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = entries.slice();
  while (queue.length > 0 && seen.size < MAX_WALK) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    let src: string;
    try { src = readFileSync(`${repoDir}/${file}`, "utf8"); } catch { continue; }
    seen.add(file);
    for (const m of src.matchAll(SPEC_RE)) {
      const next = resolveSpec(file, m[1] as string, repoDir);
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

// the bundle entries, read off the build script rather than copied next to it: `bun run build` is
// the single fact about which sources become public/*.js, so a FOURTH bundle needs no edit here.
function bundleEntries(repoDir: string): string[] {
  try {
    const pkg = JSON.parse(readFileSync(`${repoDir}/package.json`, "utf8")) as
      { scripts?: Record<string, string> };
    const build = pkg.scripts?.build ?? "";
    return [...build.matchAll(/\bbun\s+build\s+(\S+)/g)].map((m) => m[1] as string);
  } catch { return []; }
}

// every top-level fleet-e2e*.ts, not five names: the wrappers boot these, this process never does.
// Anything here that server.ts DOES import is caught by the server walk, which is consulted first.
function harnessEntries(repoDir: string): string[] {
  try {
    return readdirSync(repoDir).filter((f) => f.startsWith("fleet-e2e") && f.endsWith(".ts"));
  } catch { return []; }
}

// null means the graph could not be built at all (no readable server.ts). Every path is then
// `unknown`, which the caller must read as "cannot tell" — the same direction the old predicate
// failed in, never as an all-clear.
export function buildRepoGraph(repoDir: string): RepoGraph | null {
  if (!existsSync(`${repoDir}/server.ts`)) return null;
  const server = walk(repoDir, ["server.ts"]);
  const nonServer = new Set<string>();
  for (const f of walk(repoDir, [...bundleEntries(repoDir), ...harnessEntries(repoDir)])) {
    if (!server.has(f)) nonServer.add(f);
  }
  return { server, nonServer };
}

// one-entry memo: the caller keys it on the commit whose tree it describes, so the ~140 file reads
// happen once per land instead of once per git tick.
let memo: { key: string; graph: RepoGraph | null } | null = null;
export function repoGraph(repoDir: string, key: string): RepoGraph | null {
  const cacheKey = `${repoDir} ${key}`;
  if (memo !== null && memo.key === cacheKey) return memo.graph;
  let graph: RepoGraph | null = null;
  try { graph = buildRepoGraph(repoDir); } catch { graph = null; }
  memo = { key: cacheKey, graph };
  return graph;
}

// ORDER IS THE CONTRACT. Server reachability first, so no prefix can hide a real import. The three
// prefix rules next, BEFORE the shell rule: that is the predicate this replaced, where `e2e/` won
// over "every shell script is code" — a wrapper under e2e/ is loaded by nothing, and reordering it
// would quietly widen the warning while claiming to narrow it.
export function roleOf(path: string, graph: RepoGraph | null): PathRole {
  if (graph === null) return "unknown";
  if (graph.server.has(path)) return "server";
  if (path.endsWith(".md")) return "non-server";
  if (path.startsWith("public/") || path.startsWith("e2e/")) return "non-server";
  if (path.endsWith(".sh") || RUNTIME_MANIFESTS.has(path)) return "server";
  if (graph.nonServer.has(path)) return "non-server";
  return "unknown";
}

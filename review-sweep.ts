// review-sweep.ts — the deterministic half of the review layer (docs/attic/plan-review-layer-2026-08-16.md
// WP3/WP3′). Four checks over a git working tree, no model call, seconds. It is a SENSOR: it never
// gates, never fixes, never writes into the tree it measures.
//
//   bun review-sweep.ts                          # JSON lines on stdout, exit 0
//   bun review-sweep.ts --root /path/to/repo      # any git repo, not just this one
//   bun review-sweep.ts --queue --api http://host:port --token …   # mint a notiz per NEW finding
//
// PORTABILITY IS A CONTRACT HERE, not a nicety (WP3′): no Fleet path, host, port or credential is
// hard-coded, and every check family is a language-wide property. A run in a repo that has none of
// the shapes terminates green with zero findings — which is why the directory names the checks look
// at are defaults with flags behind them (`--cast-dirs`, `--doc-dir`) rather than constants.
//
// WHY EACH CHECK IS NARROWED THE WAY IT IS. A sensor whose output nobody reads is worse than no
// sensor, so each family was measured against this tree first and cut to the population that names
// a defect rather than an idiom (measurements from 2026-08-17, this repo):
//   - casts: `$A as $B` over a fetch/.json() operand is 917 sites — it is THE idiom of this e2e
//     suite. Asserting a NAMED local type is 73 sites in 22 files, and that is the measured incident
//     shape (`awaiting` on /api/sessions, `TaskInfo.kind` in the client): a declaration at a
//     distance from the call keeps compiling while the payload moves under it. One finding per file.
//   - dead exports: 65 exported names in top-level modules have no import site, but 55 of them are
//     `type`/`interface` exports living next to their consumers, which is idiomatic. Restricted to
//     VALUE exports (function/const/let/class/enum) → 10, each one dead weight.
//   - doc anchors: `docs/*.md` only, never `docs/attic/**` — the attic is a graveyard by design and
//     citing a retired path there is correct. Git-IGNORED paths are alive by definition: their
//     absence in a worktree says nothing (the rule e2e/pins.ts applies to CLAUDE.md).
//   - size: the threshold is fixed at 800 lines (owner decision 2026-08-17). Not configurable — a
//     tunable threshold is a threshold that gets tuned until it reports nothing.
//
// TYPE COVERAGE comes through e2e/sweep.ts, which imports this module and is reached by the gate's
// `fleet-e2e.ts` entry — this file is deliberately NOT a separate entry in watchdog.sh's tsc list,
// because that list and AGENTS.md's verify block are one ordered chain a pin holds together, and a
// sensor is not worth moving a gate for.
//
// FINGERPRINTS carry no line number and no content hash: a finding survives pure line movement and
// is minted at most once. That is what makes `--queue` idempotent, and it is checked in e2e/sweep.ts.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const SIZE_LIMIT_LINES = 800;
const SWEEP_CHECKS = ["size", "cast", "doc-anchor", "dead-export"] as const;
export type SweepCheck = (typeof SWEEP_CHECKS)[number];

export interface Finding {
  kind: "finding";
  check: SweepCheck;
  file: string;
  // the stable identity WITHIN a file: a symbol, a cited token, or "" when the file itself is the
  // finding. Together with check+file this is everything the fingerprint is made of.
  key: string;
  detail: string;
  // where to look, for a human. Deliberately outside the fingerprint.
  line: number | null;
  fingerprint: string;
}

// A check that could not RUN must fail as itself, never as "found nothing" (CLAUDE.md: a probe that
// could not run reads like an all-clear otherwise). These make the run exit 2.
export interface SweepError { kind: "error"; check: SweepCheck | "tree"; message: string }

export interface SweepResult { findings: Finding[]; errors: SweepError[] }

const fingerprintOf = (check: string, file: string, key: string): string =>
  createHash("sha256").update(`${check}\x00${file}\x00${key}`).digest("hex").slice(0, 12);

const finding = (check: SweepCheck, file: string, key: string, detail: string, line: number | null): Finding =>
  ({ kind: "finding", check, file, key, detail, line, fingerprint: fingerprintOf(check, file, key) });

// A MISSING binary is an exception, not an exit code (Bun.spawn throws ENOENT), and an uncaught one
// here would end the run with a stack trace — i.e. the sensor's loudest possible way of saying
// nothing. Caught, it becomes exit code -1 and the check that asked for it reports itself as
// unable to run.
async function sh(root: string, cmd: string[]): Promise<{ out: string; code: number; err: string }> {
  try {
    const p = Bun.spawn(cmd, { cwd: root, stdout: "pipe", stderr: "pipe" });
    const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
    return { out, err, code: await p.exited };
  } catch (e) {
    return { out: "", err: `${cmd[0]} could not be run: ${String(e)}`, code: -1 };
  }
}

// the tracked set is the sweep's universe — an untracked file is scratch, and a build artifact is
// not the repo's code. `null` when this is no git repository at all, which is an error, not "empty".
async function trackedFiles(root: string): Promise<string[] | null> {
  const ls = await sh(root, ["git", "ls-files", "-z"]);
  return ls.code === 0 ? ls.out.split("\0").filter(Boolean) : null;
}

const readOr = (path: string): string => {
  try { return readFileSync(path, "utf8"); } catch { return ""; }
};

// ================================================================================================
// the checks
// ================================================================================================

// 1. File size against the fixed 800-line limit, with the delta to the last recorded measurement
// when a baseline was handed in. No baseline → `delta` is absent rather than 0: "not compared" and
// "did not move" are different facts and a report must not merge them.
function checkSize(root: string, tracked: string[], baseline: Record<string, number> | null): Finding[] {
  const out: Finding[] = [];
  for (const f of tracked.filter((p) => /\.(ts|sh)$/.test(p))) {
    const text = readOr(`${root}/${f}`);
    if (!text) continue;
    const lines = text.split("\n").length;
    if (lines <= SIZE_LIMIT_LINES) continue;
    const was = baseline?.[f];
    const delta = was === undefined ? "delta unknown (no baseline)"
      : `${was} at last measurement (${lines - was >= 0 ? "+" : ""}${lines - was})`;
    out.push(finding("size", f, "", `${lines} lines > ${SIZE_LIMIT_LINES}; ${delta}`, null));
  }
  return out;
}

// current line counts for the files this check would measure — the shape `--write-baseline` stores.
function sizeCensus(root: string, tracked: string[]): Record<string, number> {
  const census: Record<string, number> = {};
  for (const f of tracked.filter((p) => /\.(ts|sh)$/.test(p))) {
    const text = readOr(`${root}/${f}`);
    if (text) census[f] = text.split("\n").length;
  }
  return census;
}

// 2. `x as T` over a fetch/.json() result, asserted to a NAMED type (see header). ast-grep does the
// structural half — a regex cannot tell a cast operand from a string containing " as " — and the
// operand text does the narrowing. One finding per file, keyed on the file, so the report survives
// both line movement and a changing set of type names inside it.
interface AstGrepMatch {
  file: string;
  range: { start: { line: number } };
  metaVariables?: { single?: Record<string, { text: string }> };
}
async function checkCasts(root: string, tracked: string[], dirs: string[]): Promise<{ findings: Finding[]; errors: SweepError[] }> {
  const scan = dirs.filter((d) => tracked.some((p) => p.startsWith(`${d}/`) && /\.tsx?$/.test(p)));
  if (scan.length === 0) return { findings: [], errors: [] };
  const probe = await sh(root, ["ast-grep", "--pattern", "$A as $B", "--lang", "ts", "--json=compact", ...scan]);
  // exit 1 with `[]` is ast-grep's ANSWER for "no match", not a failure — reading it as one turned a
  // clean tree into a check that could not run (this check's own first red). Only a code above 1, or
  // no output at all, means the tool did not answer.
  if (probe.code < 0 || probe.code > 1 || !probe.out.trim())
    return { findings: [], errors: [{ kind: "error", check: "cast",
      message: `ast-grep did not answer over [${scan.join(" ")}] (exit ${probe.code}): ${(probe.err || probe.out).trim().slice(0, 200)}` }] };
  let matches: AstGrepMatch[];
  try { matches = JSON.parse(probe.out) as AstGrepMatch[]; }
  catch (e) { return { findings: [], errors: [{ kind: "error", check: "cast", message: `unparsable ast-grep output: ${String(e)}` }] }; }

  const perFile = new Map<string, { names: Set<string>; count: number; line: number }>();
  for (const m of matches) {
    const operand = m.metaVariables?.single?.A?.text ?? "";
    const asserted = (m.metaVariables?.single?.B?.text ?? "").trim();
    if (!operand.includes(".json()") && !operand.includes("fetch(")) continue;
    if (!/^[A-Za-z_$][\w$]*(\[\])?$/.test(asserted)) continue; // an inline literal is visible at the call site
    const at = perFile.get(m.file) ?? { names: new Set<string>(), count: 0, line: m.range.start.line + 1 };
    at.names.add(asserted);
    at.count++;
    perFile.set(m.file, at);
  }
  const findings = [...perFile.entries()].map(([file, at]) =>
    finding("cast", file, "", `${at.count} cast(s) of a fetch/json result to a named type: ${[...at.names].sort().join(", ")}`, at.line));
  return { findings, errors: [] };
}

// 3. Doc-anchor drift: a backticked path or symbol in the live docs that no longer exists in the
// tree. Existence only, never meaning — a cited symbol that moved to a different file is alive here
// on purpose (that judgement belongs to a reader, and this check must not invent it).
async function checkDocAnchors(root: string, tracked: string[], docDir: string): Promise<Finding[]> {
  // the directory name is an ARGUMENT, so it is escaped before it becomes a pattern
  const docRe = new RegExp(`^${docDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/[^/]+\\.md$`);
  const docs = tracked.filter((p) => docRe.test(p));
  if (docs.length === 0) return [];
  const trackedSet = new Set(tracked);
  // every tracked non-doc text file is where a symbol may live. Docs are excluded so that two docs
  // citing each other's vocabulary cannot keep a retired symbol "alive".
  const haystack = tracked.filter((p) => /\.(ts|tsx|sh|json|py|html|css)$/.test(p))
    .map((p) => readOr(`${root}/${p}`)).join("\n");

  const PATH_RE = /^\.?\/?[A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:md|ts|tsx|sh|json|py|html|css)$/;
  const SYM_RE = /^[A-Za-z_$][A-Za-z0-9_$]{4,}$/;
  const candidates: { doc: string; token: string; line: number; sort: "path" | "symbol" }[] = [];
  for (const doc of docs) {
    // fenced blocks first: a ```sh fence is made of backticks, so a naive span scan mis-pairs every
    // backtick after it (the trap e2e/pins.ts documents at RULE_ANCHORS).
    const prose = readOr(`${root}/${doc}`).replace(/```[\s\S]*?```/g, "\n");
    const seen = new Set<string>();
    prose.split("\n").forEach((text, i) => {
      for (const m of text.matchAll(/`([^`\n]+)`/g)) {
        const token = m[1]!.trim();
        if (seen.has(token)) continue;
        if (PATH_RE.test(token)) { seen.add(token); candidates.push({ doc, token, line: i + 1, sort: "path" }); }
        // a symbol worth citing looks like code: UPPER_SNAKE or camelCase. A lowercase word is prose.
        else if (SYM_RE.test(token) && ((token.includes("_") && token === token.toUpperCase()) || /[a-z][A-Z]/.test(token))) {
          seen.add(token);
          candidates.push({ doc, token, line: i + 1, sort: "symbol" });
        }
      }
    });
  }

  const deadPaths: typeof candidates = [];
  const out: Finding[] = [];
  for (const c of candidates) {
    if (c.sort === "symbol") {
      if (!new RegExp(`\\b${c.token.replace(/\$/g, "\\$")}\\b`).test(haystack))
        out.push(finding("doc-anchor", c.doc, c.token, `cited symbol appears in no tracked source file`, c.line));
      continue;
    }
    const rel = c.token.replace(/^\.\//, "");
    // resolved against the citing doc's own directory as well as the repo root: a sibling filename
    // in docs/README.md is the normal way one doc points at the next.
    if (trackedSet.has(rel) || existsSync(`${root}/${rel}`) || existsSync(`${root}/${dirname(c.doc)}/${rel}`)) continue;
    deadPaths.push(c);
  }
  // git-ignored paths are alive: `fleet.json` is absent from every worktree and present in the
  // checkout, so its absence measures the worktree, not the doc. One batched call, because
  // check-ignore over N candidates one at a time is N process spawns.
  if (deadPaths.length) {
    const p = Bun.spawn(["git", "check-ignore", "--stdin"], { cwd: root, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    p.stdin.write(deadPaths.map((c) => c.token.replace(/^\.\//, "")).join("\n") + "\n");
    await p.stdin.end();
    const ignored = new Set((await new Response(p.stdout).text()).split("\n").map((l) => l.trim()).filter(Boolean));
    await p.exited; // exit 1 simply means "none of them are ignored" — not an error
    for (const c of deadPaths) {
      if (ignored.has(c.token.replace(/^\.\//, ""))) continue;
      out.push(finding("doc-anchor", c.doc, c.token, `cited path resolves to no file in this tree`, c.line));
    }
  }
  return out;
}

// 4. A VALUE export in a top-level module with no import site anywhere in the tree. rg/ast-grep are
// not needed for this one: the export forms are line-anchored and the search space is the tracked
// .ts files we have already read.
function checkDeadExports(root: string, tracked: string[]): Finding[] {
  const tops = tracked.filter((p) => /^[^/]+\.ts$/.test(p));
  const allTs = tracked.filter((p) => /\.tsx?$/.test(p));
  const text = new Map(allTs.map((p) => [p, readOr(`${root}/${p}`)]));
  const out: Finding[] = [];
  for (const f of tops) {
    const src = text.get(f) ?? "";
    const others = allTs.filter((p) => p !== f).map((p) => text.get(p) ?? "").join("\n");
    src.split("\n").forEach((lineText, i) => {
      const m = /^export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|enum)\s+([A-Za-z_$][\w$]*)/.exec(lineText);
      if (!m) return;
      const name = m[1]!;
      if (new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\b`).test(others)) return;
      out.push(finding("dead-export", f, name, `exported value with no import site in any tracked .ts`, i + 1));
    });
  }
  return out;
}

// ================================================================================================
// the run
// ================================================================================================

export interface SweepOptions {
  root: string;
  castDirs?: string[];
  docDir?: string;
  baseline?: Record<string, number> | null;
  only?: SweepCheck[];
}

export async function sweep(opts: SweepOptions): Promise<SweepResult> {
  const root = resolve(opts.root);
  const castDirs = opts.castDirs ?? ["src", "e2e"];
  const docDir = opts.docDir ?? "docs";
  const wanted = (c: SweepCheck): boolean => !opts.only || opts.only.includes(c);

  const ls = await trackedFiles(root);
  if (ls === null)
    return { findings: [], errors: [{ kind: "error", check: "tree", message: `git ls-files failed in ${root} — not a git repository?` }] };
  const tracked = ls;

  const findings: Finding[] = [];
  const errors: SweepError[] = [];
  if (wanted("size")) findings.push(...checkSize(root, tracked, opts.baseline ?? null));
  if (wanted("cast")) {
    const r = await checkCasts(root, tracked, castDirs);
    findings.push(...r.findings);
    errors.push(...r.errors);
  }
  if (wanted("doc-anchor")) findings.push(...await checkDocAnchors(root, tracked, docDir));
  if (wanted("dead-export")) findings.push(...checkDeadExports(root, tracked));

  // one total order, so two runs over the same tree emit byte-identical output
  findings.sort((a, b) => a.check.localeCompare(b.check) || a.file.localeCompare(b.file) || a.key.localeCompare(b.key));
  return { findings, errors };
}

// ================================================================================================
// --queue: the owner's task API, reused. Never fleet.json, never a second persistence system.
// ================================================================================================
// The endpoint and the credential are ARGUMENTS. There is no default host, no token read out of a
// state file, no fallback: a sweep that cannot name where it is minting refuses to mint (owner
// decision 2026-08-17). A finding becomes a `notiz` — advisory, never `queue:true`, never an
// auftrag; the 409 at the release door is right and this path must not go near it.
export const SWEEP_MARK = "review-sweep";
const markerFor = (fp: string): string => `[${SWEEP_MARK} ${fp}]`;

const noteTextFor = (f: Finding): string =>
  `${markerFor(f.fingerprint)} ${f.check}: ${f.file}${f.key ? ` — ${f.key}` : ""}${f.line ? ` (line ${f.line})` : ""}\n`
  + `${f.detail}\n`
  + `Deterministic sweep finding (review-sweep.ts). Sensor output, not a work brief: convert it with the kind route if it should become work.`;

interface TaskRow { id: string; text?: string; status?: string; kind?: string }

export interface QueueOutcome {
  minted: { fingerprint: string; taskId: string }[];
  skipped: string[];
  errors: string[];
}

// `open` = a row the owner can still act on. A finding whose note was closed/dropped may be minted
// again — that is a deliberate re-report, not a duplicate: the finding is still in the tree.
const OPEN_STATES = new Set(["pending", "queued", "sent", "running"]);

async function queueFindings(
  findings: Finding[], api: string, token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<QueueOutcome> {
  const out: QueueOutcome = { minted: [], skipped: [], errors: [] };
  const H = { "content-type": "application/json", authorization: `Bearer ${token}` };
  // an unreachable endpoint is a normal operator error (wrong port, server down) and must read as
  // one line, not as a thrown stack out of the middle of a report
  let listed: Response;
  try { listed = await fetchImpl(`${api}/api/tasks`, { headers: H }); }
  catch (e) {
    out.errors.push(`GET ${api}/api/tasks did not answer: ${String(e)}`);
    return out;
  }
  if (!listed.ok) {
    out.errors.push(`GET /api/tasks answered ${listed.status} — refusing to mint blind (a sweep that cannot read the queue cannot dedup against it)`);
    return out;
  }
  const rows = ((await listed.json()) as { tasks?: TaskRow[] }).tasks ?? [];
  const known = new Set<string>();
  for (const r of rows) {
    if (!OPEN_STATES.has(r.status ?? "")) continue;
    for (const m of (r.text ?? "").matchAll(new RegExp(`\\[${SWEEP_MARK} ([0-9a-f]{6,})\\]`, "g"))) known.add(m[1]!);
  }
  for (const f of findings) {
    if (known.has(f.fingerprint)) { out.skipped.push(f.fingerprint); continue; }
    let res: Response;
    try {
      res = await fetchImpl(`${api}/api/tasks`, {
        method: "POST", headers: H,
        body: JSON.stringify({ text: noteTextFor(f), kind: "notiz" }),
      });
    } catch (e) { out.errors.push(`POST /api/tasks for ${f.fingerprint} did not answer: ${String(e)}`); continue; }
    if (!res.ok) { out.errors.push(`POST /api/tasks for ${f.fingerprint} answered ${res.status}`); continue; }
    const body = (await res.json()) as { task?: { id?: string } };
    out.minted.push({ fingerprint: f.fingerprint, taskId: body.task?.id ?? "" });
    // a second finding with the same fingerprint in one run (impossible today, cheap to hold)
    known.add(f.fingerprint);
  }
  return out;
}

// ================================================================================================
// CLI
// ================================================================================================

function flag(argv: string[], name: string): string | null {
  const at = argv.indexOf(`--${name}`);
  return at >= 0 && argv[at + 1] !== undefined && !argv[at + 1]!.startsWith("--") ? argv[at + 1]! : null;
}

async function main(argv: string[]): Promise<number> {
  const has = (name: string): boolean => argv.includes(`--${name}`);
  const root = flag(argv, "root") ?? process.cwd();
  const baselinePath = flag(argv, "baseline");
  const castDirs = flag(argv, "cast-dirs")?.split(",").map((s) => s.trim()).filter(Boolean);
  const docDir = flag(argv, "doc-dir") ?? undefined;
  const only = flag(argv, "only")?.split(",").map((s) => s.trim())
    .filter((s): s is SweepCheck => (SWEEP_CHECKS as readonly string[]).includes(s));

  let baseline: Record<string, number> | null = null;
  if (baselinePath && existsSync(baselinePath)) {
    try { baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Record<string, number>; }
    catch (e) {
      console.error(`review-sweep: unreadable baseline ${baselinePath}: ${String(e)}`);
      return 2;
    }
  }

  const { findings, errors } = await sweep({ root, castDirs, docDir, baseline, only });
  for (const f of findings) console.log(JSON.stringify(f));
  for (const e of errors) console.log(JSON.stringify(e));

  let queued: QueueOutcome | null = null;
  if (has("queue")) {
    const api = (flag(argv, "api") ?? "").replace(/\/$/, "");
    const token = flag(argv, "token") ?? process.env.FLEET_SWEEP_TOKEN ?? "";
    // Loud refusal, not a guess. Both halves are named separately so the operator learns which one
    // is missing rather than which flag exists.
    if (!api) { console.error("review-sweep: --queue needs --api <base-url> — there is no default endpoint, on purpose"); return 2; }
    if (!token) { console.error("review-sweep: --queue needs --token <token> or FLEET_SWEEP_TOKEN — there is no credential fallback, on purpose"); return 2; }
    if (errors.length) { console.error(`review-sweep: refusing to mint — ${errors.length} check(s) could not run, so "new finding" is not decidable`); return 2; }
    queued = await queueFindings(findings, api, token);
    for (const m of queued.minted) console.log(JSON.stringify({ kind: "minted", ...m }));
    for (const e of queued.errors) console.error(`review-sweep: ${e}`);
  }

  if (has("write-baseline")) {
    if (!baselinePath) { console.error("review-sweep: --write-baseline needs --baseline <file>"); return 2; }
    const tracked = await trackedFiles(resolve(root));
    if (tracked === null) { console.error(`review-sweep: cannot record a baseline for ${root} — not a git repository`); return 2; }
    await Bun.write(baselinePath, JSON.stringify(sizeCensus(resolve(root), tracked), null, 2) + "\n");
  }

  const byCheck: Record<string, number> = {};
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
  console.log(JSON.stringify({
    kind: "summary", root: resolve(root), findings: findings.length, byCheck,
    checksThatCouldNotRun: errors.map((e) => e.check),
    ...(queued ? { minted: queued.minted.length, skipped: queued.skipped.length, queueErrors: queued.errors.length } : {}),
  }));
  // findings are never a failure — this is a sensor. Exit 2 means a check did not run, or minting
  // was asked for and could not be done honestly.
  return errors.length || (queued && queued.errors.length) ? 2 : 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));

// The delayed truth about a land — were the lines it inserted rewritten by main within days?
//
// No exit step compares a result with its goal (docs/messungen/2026-09-14-queue-intelligenz-schichten.md
// §3): the gate proves the tree compiles, the audit proves the tip is green, and neither says whether
// the land held. The one mechanical, delayed signal already in the data is LINE REWORK: the lines a
// land inserted, overwritten by a later main commit within 3 / 7 days (`git blame` of every later
// hunk's old side, attributed back to the land's own commits base..mainAfter). File overlap does not
// separate lands (72/83 Opus lands touch server.ts or e2e/*); the line level does.
//
//   bun land-quality.ts [--since 14d] [--json] [--at <rev>] [--out <file>] [--root <checkout>]
//   bun land-quality.ts --summary [--since 14d]   # three lines off the written ledger, no git (state.sh)
//
// It is a READER of lane-outcomes.jsonl, post-land-audits.jsonl, audit-adjudications.jsonl,
// fleet.json and git (read-only, GIT_OPTIONAL_LOCKS=0). Its one write is land-quality.jsonl, a
// DERIVED view rewritten whole on every run: one row per landed lane in the window. No judgement,
// no gate, no alarm.
//
// DETERMINISM: "now" is the commit time of the observation horizon (`--at`, default main), never
// the wall clock. Two runs against the same main and the same ledgers are byte-identical.
//
// DIRECTION DISCIPLINE (slotstats.ts's rule): an unknowable value is null, never 0.
//   - reworkLines3d / reworkLines7d / reworkByFixSubject are null while the window is still open
//     at the horizon, and null for a land whose history git could not resolve or whose blame failed.
//   - auditRed is null until an audit that actually measured (green or red) covers branch+mainAfter.
//     A red counts unless its NEWEST adjudication is `flake` — `real`, `stale-test`, `unknowable` and
//     "not adjudicated yet" all count. auditVerdict carries that adjudication so a reader can re-cut.
//   - rates run over the rows whose field is known; a rate with no denominator prints as "—".
//
// KNOWN LIMITS, deliberately not solved: no move/copy detection (a moved line reads as rework);
// reworkByFixSubject trusts the subject prefix `fix`, so a correction named otherwise is missed;
// codeLand and the fix test use the probe's doc rule (docs/ or *.md), everything else is code.

import { existsSync, realpathSync } from "node:fs";
import { dirname } from "node:path";

const DAY = 86_400_000;
const CONCURRENCY = 8;
const SUMMARY_GROUPS = 5; // state.sh's model line; the full table has them all

export interface LandRow {
  branch: string; taskId: string | null; model: string | null; harness: string | null;
  effort: string | null; size: string | null; landedAt: number; mainAfter: string; codeLand: boolean | null;
  insertedLines: number | null; reworkLines3d: number | null; reworkLines7d: number | null;
  reworkByFixSubject: boolean | null; auditRed: boolean | null; auditVerdict: string | null;
  ownerPrompts: number | null; disposition: string; asOf: string; asOfAt: number;
}

export const isDocPath = (p: string): boolean => p.startsWith("docs/") || p.endsWith(".md");
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function parseSince(s: string): number | null {
  const m = /^(\d+)([dh])$/.exec(s);
  return m ? Number(m[1]) * (m[2] === "d" ? DAY : DAY / 24) : null;
}

/** harness/model with the claude- prefix and [1m] suffix dropped — a label, not a judgement */
export function modelKey(r: Pick<LandRow, "model" | "harness">): string {
  const m = r.model ? r.model.replace(/^claude-/, "").replace(/\[1m\]$/, "") : "?";
  return `${r.harness ?? "claude"}/${m}`;
}

interface Ratio { k: number; d: number }
export interface Group { key: string; n: number; code: number; rework3d: Ratio; fix3dCode: Ratio; auditRed: Ratio }

export function aggregate(rows: LandRow[], keyOf: (r: LandRow) => string): Group[] {
  const by = new Map<string, Group>();
  for (const r of rows) {
    const key = keyOf(r);
    const g = by.get(key) ?? { key, n: 0, code: 0, rework3d: { k: 0, d: 0 }, fix3dCode: { k: 0, d: 0 }, auditRed: { k: 0, d: 0 } };
    g.n++;
    if (r.codeLand) g.code++;
    if (r.reworkLines3d !== null) { g.rework3d.d++; if (r.reworkLines3d > 0) g.rework3d.k++; }
    if (r.codeLand && r.reworkByFixSubject !== null) { g.fix3dCode.d++; if (r.reworkByFixSubject) g.fix3dCode.k++; }
    if (r.auditRed !== null) { g.auditRed.d++; if (r.auditRed) g.auditRed.k++; }
    by.set(key, g);
  }
  return [...by.values()].sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

const pct = (x: Ratio): string => (x.d ? `${x.k}/${x.d} ${Math.round((100 * x.k) / x.d)}%` : "—");
const pad = (s: string | number, n: number): string => String(s).padEnd(n);

function table(title: string, groups: Group[]): string[] {
  const out = [`${pad(title, 26)}${pad("n", 5)}${pad("code", 6)}${pad("rework3d", 14)}${pad("fix3d(code)", 14)}auditRed`];
  for (const g of groups)
    out.push(`  ${pad(g.key, 24)}${pad(g.n, 5)}${pad(g.code, 6)}${pad(pct(g.rework3d), 14)}${pad(pct(g.fix3dCode), 14)}${pct(g.auditRed)}`);
  return out;
}

export function renderFull(rows: LandRow[], head: string, excluded: Record<string, number>): string {
  const out = [head,
    "rework3d = inserted lines rewritten by ANY later main commit ≤3 d (over closed windows) · fix3d(code) = a `fix…` commit rewrote inserted CODE lines ≤3 d, over code lands · auditRed over audits that measured"];
  out.push(...table("ALL", aggregate(rows, () => "all")));
  out.push(...table("harness/model", aggregate(rows, modelKey)));
  out.push(...table("harness", aggregate(rows, (r) => r.harness ?? "claude")));
  out.push(...table("size (card)", aggregate(rows, (r) => r.size ?? "null")));
  out.push("excluded: " + Object.entries(excluded).map(([k, v]) => `${k} ${v}`).join(" · "));
  return out.join("\n");
}

const brief = (g: Group): string =>
  `${g.key} ${g.n}/${g.code}c rw ${pct(g.rework3d)} fix ${pct(g.fix3dCode)} red ${pct(g.auditRed)}`;

export function renderSummary(rows: LandRow[], label: string): string {
  const asOf = rows[0]?.asOf.slice(0, 8) ?? "?";
  const all = aggregate(rows, () => "all")[0];
  const models = aggregate(rows, modelKey);
  return [
    `  land-quality ${label} @${asOf}: ${all ? brief(all) : "0 lands"}  (n/code · rework3d · fix3d code · auditRed)`,
    `    model: ${models.slice(0, SUMMARY_GROUPS).map(brief).join(" · ") || "—"}`
      + (models.length > SUMMARY_GROUPS ? ` · +${models.length - SUMMARY_GROUPS} more (bun land-quality.ts)` : ""),
    `    size:  ${aggregate(rows, (r) => r.size ?? "null").map(brief).join(" · ") || "—"}`,
  ].join("\n");
}

async function readJsonl(file: string): Promise<{ rows: Record<string, unknown>[]; malformed: number }> {
  const rows: Record<string, unknown>[] = [];
  let malformed = 0;
  for (const f of [`${file}.1`, file]) {
    if (!existsSync(f)) continue;
    for (const line of (await Bun.file(f).text()).split("\n")) {
      if (!line.trim()) continue;
      try {
        const v = JSON.parse(line);
        if (v && typeof v === "object") rows.push(v); else malformed++;
      } catch { malformed++; }
    }
  }
  return { rows, malformed };
}

async function git(root: string, args: string[]): Promise<{ code: number; out: string }> {
  const p = Bun.spawn(["git", "-C", root, ...args], {
    stdout: "pipe", stderr: "ignore", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  const out = await new Response(p.stdout).text();
  return { code: await p.exited, out };
}

async function pool<T>(items: T[], fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

interface Land {
  row: LandRow; base: string; commits: Set<string> | null; files: Set<string>;
  r3: number; r7: number; fix: boolean; blameFailed: boolean;
}
interface HunkGroup { sha: string; ct: number; subject: string; path: string; ranges: string[] }

/** one `git log -p -U0` pass → the old-side ranges of every later hunk, grouped per commit x file */
export function parseLog(out: string): HunkGroup[] {
  const groups = new Map<string, HunkGroup>();
  let sha = "", ct = 0, subject = "", oldPath: string | null = null, remOld = 0, remNew = 0;
  for (const line of out.split("\n")) {
    if (remOld > 0 || remNew > 0) {
      if (line.startsWith("-")) remOld--; else if (line.startsWith("+")) remNew--;
      continue;
    }
    if (line.startsWith("\x1e")) {
      const m = /^\x1e([0-9a-f]{40}) (\d+) ?(.*)$/.exec(line);
      if (m) { sha = m[1]; ct = Number(m[2]); subject = m[3]; oldPath = null; }
    } else if (line.startsWith("diff --git ")) oldPath = null;
    else if (line.startsWith("--- ")) oldPath = line.startsWith("--- a/") ? line.slice(6).replace(/\t$/, "") : null;
    else if (line.startsWith("@@ ")) {
      const m = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(line);
      if (!m) continue;
      remOld = m[2] === undefined ? 1 : Number(m[2]);
      remNew = m[3] === undefined ? 1 : Number(m[3]);
      if (remOld === 0 || !oldPath || !sha) continue;
      const key = `${sha}\0${oldPath}`;
      const g = groups.get(key) ?? { sha, ct, subject, path: oldPath, ranges: [] };
      g.ranges.push(`${m[1]},+${remOld}`);
      groups.set(key, g);
    }
  }
  return [...groups.values()];
}

function mainCheckout(): string {
  const p = Bun.spawnSync(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], { stderr: "ignore" });
  const common = p.stdout.toString().trim();
  return common ? realpathSync(dirname(common)) : process.cwd();
}

async function main(argv: string[]): Promise<number> {
  const flag = (name: string): string | null => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };
  const sinceArg = flag("--since");
  const sinceMs = sinceArg === null ? null : parseSince(sinceArg);
  if (sinceArg !== null && sinceMs === null) {
    console.error(`land-quality: --since wants <N>d or <N>h, got "${sinceArg}"`);
    return 2;
  }
  const root = realpathSync(flag("--root") ?? mainCheckout());
  const outFile = flag("--out") ?? `${root}/land-quality.jsonl`;

  if (argv.includes("--summary")) {
    if (!existsSync(outFile)) {
      console.error(`land-quality: ${outFile} does not exist — that is UNKNOWN, not zero lands`);
      return 2;
    }
    const rows = (await readJsonl(outFile)).rows as unknown as LandRow[];
    const inWindow = sinceMs === null ? rows : rows.filter((r) => r.landedAt >= r.asOfAt - sinceMs);
    console.log(renderSummary(inWindow, sinceArg ?? "all"));
    return 0;
  }

  const t0 = Date.now();
  const at = flag("--at") ?? "main";
  const tip = await git(root, ["show", "-s", "--format=%H %ct", `${at}^{commit}`]);
  const [asOf, tipCt] = tip.out.trim().split(" ");
  if (tip.code !== 0 || !asOf) {
    console.error(`land-quality: cannot resolve ${at} in ${root}`);
    return 2;
  }
  const horizonMs = Number(tipCt) * 1000;
  const cutoff = sinceMs === null ? null : horizonMs - sinceMs;

  const outcomesFile = `${root}/lane-outcomes.jsonl`;
  if (!existsSync(outcomesFile) && !existsSync(`${outcomesFile}.1`)) {
    console.error(`land-quality: ${outcomesFile} does not exist — that is UNKNOWN, not an empty ledger`);
    return 2;
  }
  const outcomes = await readJsonl(outcomesFile);
  const audits = (await readJsonl(`${root}/post-land-audits.jsonl`)).rows;
  const adjudications = (await readJsonl(`${root}/audit-adjudications.jsonl`)).rows;
  const state = existsSync(`${root}/fleet.json`) ? await Bun.file(`${root}/fleet.json`).json() : {};
  const sizeOf = new Map<string, string>();
  for (const t of Array.isArray(state.tasks) ? state.tasks : [])
    if (typeof t?.id === "string" && typeof t.card?.size === "string") sizeOf.set(t.id, t.card.size);

  // main's history as of the horizon, with commit times: the ancestry test and the land clock at once
  const hist = await git(root, ["log", "--format=%H %ct", asOf,
    ...(cutoff === null ? [] : [`--since=${new Date(cutoff - DAY).toISOString()}`])]);
  const ctOf = new Map(hist.out.trim().split("\n").filter(Boolean).map((l) => {
    const [h, c] = l.split(" ");
    return [h, Number(c) * 1000] as const;
  }));

  const excluded = { malformed: outcomes.malformed, otherRepo: 0, noMainAfter: 0, notOnHorizon: 0, beforeSince: 0, unresolvedHistory: 0, blameFailed: 0 };
  const lands: Land[] = [];
  for (const o of outcomes.rows) {
    if (o.disposition !== "landed") continue;
    if (o.repo !== root) { excluded.otherRepo++; continue; }
    const branch = str(o.branch), base = str(o.base), mainAfter = str(o.mainAfter);
    if (!branch || !base || !mainAfter) { excluded.noMainAfter++; continue; }
    const landedAt = ctOf.get(mainAfter);
    if (landedAt === undefined) {
      if (cutoff !== null && typeof o.ts === "number" && o.ts < cutoff) excluded.beforeSince++; else excluded.notOnHorizon++;
      continue;
    }
    if (cutoff !== null && landedAt < cutoff) { excluded.beforeSince++; continue; }
    const taskId = str(o.taskId), originId = str(o.originId);
    lands.push({
      base, commits: null, files: new Set(), r3: 0, r7: 0, fix: false, blameFailed: false,
      row: {
        branch, taskId, model: str(o.model), harness: str(o.harness), effort: str(o.effort),
        size: (taskId ? sizeOf.get(taskId) : undefined) ?? (originId ? sizeOf.get(originId) : undefined) ?? null,
        landedAt, mainAfter, codeLand: null, insertedLines: null, reworkLines3d: null, reworkLines7d: null,
        reworkByFixSubject: null, auditRed: null, auditVerdict: null,
        ownerPrompts: typeof o.ownerPrompts === "number" ? o.ownerPrompts : null, disposition: "landed", asOf, asOfAt: horizonMs,
      },
    });
  }

  const landOf = new Map<string, Land>();
  await pool(lands, async (l) => {
    const [revs, stat] = await Promise.all([
      git(root, ["rev-list", `${l.base}..${l.row.mainAfter}`]),
      git(root, ["diff", "--numstat", "--no-renames", l.base, l.row.mainAfter]),
    ]);
    if (revs.code !== 0 || stat.code !== 0) return;
    l.commits = new Set(revs.out.split("\n").filter(Boolean));
    let inserted = 0;
    for (const line of stat.out.split("\n")) {
      const [add, , path] = line.split("\t");
      if (!path) continue;
      l.files.add(path);
      if (/^\d+$/.test(add)) inserted += Number(add);
    }
    l.row.insertedLines = inserted;
    l.row.codeLand = [...l.files].some((f) => !isDocPath(f));
    for (const c of l.commits) landOf.set(c, l);
  });

  let groups: HunkGroup[] = [];
  let blames = 0;
  if (lands.length) {
    const first = Math.min(...lands.map((l) => l.row.landedAt));
    const log = await git(root, ["log", asOf, "--no-merges", "--no-renames", "-p", "-U0", "--no-color",
      "--format=%x1e%H %ct %s", `--since=${new Date(first - 3_600_000).toISOString()}`]);
    if (log.code !== 0) { console.error("land-quality: git log failed"); return 2; }
    groups = parseLog(log.out);
  }
  const jobs = groups.map((g) => {
    const t = g.ct * 1000;
    const cands = lands.filter((l) => l.commits && l.files.has(g.path) && !l.commits.has(g.sha)
      && t >= l.row.landedAt - 3_600_000 && t <= l.row.landedAt + 7 * DAY);
    return { g, cands };
  }).filter((j) => j.cands.length);
  await pool(jobs, async ({ g, cands }) => {
    const boundary = cands.reduce((a, b) => (a.row.landedAt <= b.row.landedAt ? a : b)).base;
    const args = ["blame", "--porcelain", ...g.ranges.flatMap((r) => ["-L", r]), `${boundary}..${g.sha}^`, "--", g.path];
    blames++;
    const b = await git(root, args);
    if (b.code !== 0) { for (const l of cands) l.blameFailed = true; return; }
    const set = new Set(cands);
    const code = !isDocPath(g.path), fixSubject = g.subject.startsWith("fix");
    for (const line of b.out.split("\n")) {
      const m = /^([0-9a-f]{40}) \d+ \d+/.exec(line);
      const l = m && landOf.get(m[1]);
      if (!l || !set.has(l)) continue;
      const dt = g.ct * 1000 - l.row.landedAt;
      l.r7++;
      if (dt <= 3 * DAY) { l.r3++; if (code && fixSubject) l.fix = true; }
    }
  });

  // newest adjudication per audit row wins — server.ts#adjudicationsByAudit's reading
  const verdictOf = new Map<number, { at: number; verdict: string }>();
  for (const a of adjudications) {
    if (typeof a.auditAt !== "number" || typeof a.verdict !== "string") continue;
    const at = typeof a.at === "number" ? a.at : 0;
    const prev = verdictOf.get(a.auditAt);
    if (!prev || at >= prev.at) verdictOf.set(a.auditAt, { at, verdict: a.verdict });
  }
  const auditsOf = new Map<string, { result: string; verdict: string | null }[]>();
  for (const a of audits) {
    if (a.repo !== root || !Array.isArray(a.covers) || typeof a.at !== "number") continue;
    for (const c of a.covers as { branch?: unknown; mainAfter?: unknown }[]) {
      const key = `${c.branch}\0${c.mainAfter}`;
      const list = auditsOf.get(key) ?? [];
      list.push({ result: String(a.result), verdict: verdictOf.get(a.at)?.verdict ?? null });
      auditsOf.set(key, list);
    }
  }

  for (const l of lands) {
    const r = l.row;
    if (!l.commits) excluded.unresolvedHistory++;
    else if (l.blameFailed) excluded.blameFailed++;
    else {
      if (horizonMs >= r.landedAt + 3 * DAY) { r.reworkLines3d = l.r3; r.reworkByFixSubject = l.fix; }
      if (horizonMs >= r.landedAt + 7 * DAY) r.reworkLines7d = l.r7;
    }
    const measured = (auditsOf.get(`${r.branch}\0${r.mainAfter}`) ?? []).filter((a) => a.result === "red" || a.result === "green");
    const red = measured.find((a) => a.result === "red" && a.verdict !== "flake");
    if (red) { r.auditRed = true; r.auditVerdict = red.verdict; }
    else if (measured.length) { r.auditRed = false; r.auditVerdict = measured.find((a) => a.result === "red")?.verdict ?? null; }
  }

  const rows = lands.map((l) => l.row)
    .sort((a, b) => a.landedAt - b.landedAt || (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0));
  await Bun.write(outFile, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""));
  const head = `land-quality ${sinceArg ?? "all"} @${asOf.slice(0, 8)} (${new Date(horizonMs).toISOString()}): ${rows.length} lands → ${outFile}`;
  console.log(argv.includes("--json")
    ? JSON.stringify({ asOf, horizonAt: horizonMs, since: sinceArg, excluded,
      groups: { all: aggregate(rows, () => "all"), model: aggregate(rows, modelKey), size: aggregate(rows, (r) => r.size ?? "null") },
      rows }, null, 2)
    : renderFull(rows, head, excluded));
  console.error(`land-quality: ${groups.length} hunk groups, ${blames} blame calls, ${Math.round((Date.now() - t0) / 1000)} s`);
  return 0;
}

if (import.meta.main) process.exit(await main(Bun.argv.slice(2)));

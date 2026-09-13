// graph-coverage.ts — share of server function declarations missing from the graphify graph.
//
// Counts top-level `function` declarations of server.ts + server/*.ts that the graph does NOT carry
// as a node label. Above 10 % the graph is not usable for symbol resolution; use rg/ast-grep
// (docs/messungen/2026-09-13-worktrail-iv-agents-ctxpacks-fable.md §3.5).
//
//   bun graph-coverage.ts --graph <path/to/graph.json>
//
// exit 0 = at most 10 % missing · exit 1 = more than 10 % missing · exit 2 = the probe itself could
// not run (no --graph, file missing or unparsable, no declarations found) — never read as coverage.
import { readdirSync } from "node:fs";

const MAX_MISSING_PCT = 10;
const LIST_MAX = 20;
const DECL = /^(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm;

function fail(msg: string): never {
  process.stderr.write(`graph-coverage: ${msg}\n`);
  process.exit(2);
}

export function declaredFunctions(src: string): string[] {
  return [...src.matchAll(DECL)].map((m) => m[1]!);
}

export function normalizeLabel(label: string): string {
  return label.replace(/^\./, "").replace(/\(\)$/, "");
}

export function graphLabels(raw: string): Set<string> {
  const g = JSON.parse(raw) as { nodes?: unknown };
  if (!Array.isArray(g.nodes)) throw new Error("no nodes array");
  return new Set(g.nodes.flatMap((n) =>
    typeof n === "object" && n !== null && typeof (n as { label?: unknown }).label === "string"
      ? [normalizeLabel((n as { label: string }).label)] : []));
}

async function main(): Promise<void> {
  const i = process.argv.indexOf("--graph");
  const graphPath = i >= 0 ? process.argv[i + 1] : undefined;
  if (!graphPath) fail("usage: bun graph-coverage.ts --graph <graph.json>");
  const file = Bun.file(graphPath);
  if (!(await file.exists())) fail(`graph file missing: ${graphPath}`);
  let labels: Set<string>;
  try { labels = graphLabels(await file.text()); } catch (e) { fail(`graph file does not parse: ${graphPath} (${(e as Error).message})`); }

  const root = import.meta.dir;
  const sources = ["server.ts", ...readdirSync(`${root}/server`).filter((f) => f.endsWith(".ts")).sort().map((f) => `server/${f}`)];
  const declared: { file: string; name: string }[] = [];
  for (const rel of sources) {
    for (const name of declaredFunctions(await Bun.file(`${root}/${rel}`).text())) declared.push({ file: rel, name });
  }
  if (declared.length === 0) fail("no function declarations found — nothing was measured");

  const missing = declared.filter((d) => !labels.has(d.name));
  const pct = (missing.length / declared.length) * 100;
  console.log(`graph-coverage: ${missing.length} / ${declared.length} function declarations missing (${pct.toFixed(1)} %) in ${graphPath}`);
  for (const d of missing.slice(0, LIST_MAX)) console.log(`  ${d.file}#${d.name}`);
  if (missing.length > LIST_MAX) console.log(`  … ${missing.length - LIST_MAX} more`);
  process.exit(pct > MAX_MISSING_PCT ? 1 : 0);
}

if (import.meta.main) await main();

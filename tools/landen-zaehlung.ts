#!/usr/bin/env bun
// Zählt, wie Arbeit auf main landet: welche Wege benutzt werden und was ein Land kostet.
// Liest nur: die Ledgers im Haupt-Checkout, merge-checks.jsonl im git-common-dir, `git log` von main
// und optional eine gespeicherte Antwort von `./ctl.sh get /api/branches` (Board-Branches mit lands[]).
// Schreibt nichts. Für docs/messungen/2026-10-24-zielbild-landen.md.
//
//   bun tools/landen-zaehlung.ts [--repo ~/claude-fleet] [--branches <datei.json>] [--seit 2026-10-12]

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const repo = arg("--repo") ?? join(process.env.HOME ?? "", "claude-fleet");
const seit = Date.parse((arg("--seit") ?? "2026-10-12") + "T00:00:00");
const branchesFile = arg("--branches");

const rows = (file: string): any[] => existsSync(file)
  ? readFileSync(file, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
  : [];
const git = (...a: string[]) => Bun.spawnSync(["git", "-C", repo, ...a]).stdout.toString().trim();
const count = <T>(xs: T[], key: (x: T) => string) => xs.reduce((m, x) => (m[key(x)] = (m[key(x)] ?? 0) + 1, m), {} as Record<string, number>);
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const min = (ms: number | null) => ms == null ? "–" : `${Math.round(ms / 60000)} min`;
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const kind = (b: string) => b.startsWith("fleet/") ? "lane" : b.startsWith("bau/") ? "bau" : b.startsWith("branch/") ? "branch" : "andere";
const out: Record<string, unknown> = {};

// main seit dem Stichtag, erste Eltern
const main = git("log", "main", "--first-parent", `--since=${new Date(seit).toISOString()}`, "--format=%H %T %ct %P")
  .split("\n").filter(Boolean).map((l) => { const [sha, tree, ct, ...parents] = l.split(" "); return { sha, tree, at: +ct * 1000, parents }; });
const mainBySha = new Map(main.map((c) => [c.sha, c]));
const mainByTree = new Map(main.map((c) => [c.tree, c]));

// Wer hat welchen main-Commit gelandet?
const lanes = rows(join(repo, "lane-outcomes.jsonl"));
const ends = rows(join(repo, "branch-ends.jsonl"));
const live = branchesFile ? JSON.parse(readFileSync(branchesFile, "utf8")).repos.flatMap((r: any) => r.branches.map((b: any) => ({ ...b, repo: r.repo }))) : [];
const boardLands = [...ends.map((e) => ({ branch: e.branch, repo: e.repo, lands: e.record?.lands ?? [] })), ...live]
  .flatMap((b: any) => (b.lands ?? []).map((l: any) => ({ ...l, branch: b.branch, repo: b.repo })));
// Die Land-Tür schreibt diese Fußzeile in jeden Squash-Commit (server/branches.ts#chargeMessage); die Branch-Datensätze
// selbst gibt es erst seit branch-ends.jsonl (22.10.) über das Enden hinaus.
const doorFooter = new Set(git("log", "main", "--first-parent", `--since=${new Date(seit).toISOString()}`, "--grep=^Owner hat diesen Stand", "--format=%H").split("\n").filter(Boolean));
const boardShas = new Set([...boardLands.map((l) => l.sha), ...doorFooter]);
const laneShas = new Set(lanes.filter((l) => l.disposition === "landed" && l.mainAfter).map((l) => l.mainAfter));
const checks = rows(join(git("rev-parse", "--path-format=absolute", "--git-common-dir"), "merge-checks.jsonl"));
const greenTrees = new Set(checks.filter((c) => c.verdict === "green" && c.tree).map((c) => c.tree));
// main steht neu nach alt; ein Commit, dessen Nachfolger in derselben Minute committet wurde und selbst zu einer
// geprüften Kette gehört, ist ein innerer Commit einer mehrteiligen Charge (nur der Baum des letzten ist geprüft).
const chainEnd = new Map<string, string>();
for (let i = 0; i < main.length; i++) {
  const c = main[i], newer = main[i - 1];
  chainEnd.set(c.sha, newer && newer.at - c.at <= 60_000 && chainEnd.has(newer.sha) ? chainEnd.get(newer.sha)! : c.sha);
}
const direct = (c: typeof main[number]) => boardShas.has(c.sha) ? "board_tuer" : laneShas.has(c.sha) ? "lane"
  : greenTrees.has(c.tree) ? "gepruefter_baum_ohne_tuer" : null;
const weg = (c: typeof main[number]) => direct(c) ?? (chainEnd.get(c.sha) !== c.sha && direct(mainBySha.get(chainEnd.get(c.sha)!)!)
  ? `kette_${direct(mainBySha.get(chainEnd.get(c.sha)!)!)}` : "ohne_check");
out.main = {
  wege: count(main, weg),
  lands: new Set(main.map((c) => chainEnd.get(c.sha))).size,
  ohne_check_betreffe: main.filter((c) => weg(c) === "ohne_check").slice(0, 40).map((c) => git("log", "-1", "--format=%h %cd %s", "--date=format:%d.%m.%H:%M", c.sha).slice(0, 110)),
  commits: main.length,
  tage: Math.round((Date.now() - seit) / 864e5),
  merge_commits_auf_main: main.filter((c) => c.parents.length > 1).length,
};
out.board_lands = { gesamt: boardLands.length, formen: count(boardLands, (l) => l.form ?? "?"), branches: new Set(boardLands.map((l) => l.branch)).size, erstes: boardLands.length ? day(Math.min(...boardLands.map((l) => l.at))) : null };

// Merge-Checks
const green = checks.filter((c) => c.verdict === "green");
const used = green.filter((c) => c.tree && mainByTree.has(c.tree));
const unused = green.filter((c) => !(c.tree && mainByTree.has(c.tree)));
// Ein grüner, ungenutzter Check, nach dem main sich bewegte, bevor derselbe Branch erneut geprüft oder gelandet wurde
const movedAfter = unused.filter((c) => main.some((m) => m.at > c.at && m.at < (checks.find((d) => d.branch === c.branch && d.at > c.at)?.at ?? Infinity)));
const perBranch: any[][] = Object.values(checks.reduce((m, c) => ((m[c.branch] ??= []).push(c), m), {} as Record<string, any[]>));
out.checks = {
  gesamt: checks.length,
  von: checks.length ? day(checks[0].at) : null,
  urteile: count(checks, (c) => c.verdict ?? "?"),
  nach_art: count(checks, (c) => `${kind(c.branch ?? "")}:${c.verdict}`),
  median_dauer_gruen: min(median(green.map((c) => c.ms))),
  median_helfer_wartezeit: min(median(green.filter((c) => c.helperWaitMs != null).map((c) => c.helperWaitMs))),
  gruen_gelandet: used.length,
  main_commits_aus_gruenem_check: new Set(used.map((c) => c.tree)).size,
  gruen_nicht_gelandet: unused.length,
  davon_main_bewegt_vor_naechstem_check: movedAfter.length,
  stunden_in_ungenutzten_gruenen_checks: Math.round(unused.reduce((s, c) => s + (c.ms ?? 0), 0) / 36e5),
  checks_je_branch_median: median(perBranch.map((p) => p.length)),
  checks_je_branch_max: Math.max(...perBranch.map((p) => p.length)),
  konflikt_beim_aufsetzen: checks.filter((c) => c.verdict === "conflict" && /lässt sich nicht auf main setzen/.test(c.why ?? "")).length,
  kandidat_mit_bereits_auf_main: checks.filter((c) => (c.alreadyOnMain?.length ?? 0) > 0).length,
  commits_je_charge_median: median(checks.filter((c) => c.commits).map((c) => c.commits.length)),
};
// Zeit von grünem Check bis Land, für die genutzten
out.check_bis_land_median = min(median(used.map((c) => mainByTree.get(c.tree)!.at - c.at)));

// Lanes
out.lanes = {
  gesamt: lanes.length,
  von: lanes.length ? day(lanes[0].ts) : null,
  bis: lanes.length ? day(lanes.at(-1).ts) : null,
  ausgang: count(lanes, (l) => String(l.disposition)),
  seit_stichtag: count(lanes.filter((l) => l.ts >= seit), (l) => String(l.disposition)),
  gelandet_je_monat: count(lanes.filter((l) => l.disposition === "landed"), (l) => day(l.ts).slice(0, 7)),
  commits_je_land_median: median(lanes.filter((l) => l.disposition === "landed" && l.commitCount != null).map((l) => l.commitCount)),
  konflikt_geloest: lanes.filter((l) => l.resolvedConflict).length,
};

// Post-Land-Audits
const audits = rows(join(repo, "post-land-audits.jsonl"));
const auditsSeit = audits.filter((a) => a.at >= seit);
out.audits = {
  gesamt: audits.length,
  seit_stichtag: auditsSeit.length,
  ergebnis_seit: count(auditsSeit, (a) => a.result ?? "?"),
  ausloeser_seit: count(auditsSeit, (a) => a.trigger ?? "ohne Feld"),
  median_dauer_seit: min(median(auditsSeit.filter((a) => a.result === "green" || a.result === "red").map((a) => a.ms))),
  main_commits_mit_audit: main.filter((m) => audits.some((a) => a.mainSha === m.sha)).length,
};

// Deploys
const deploys = rows(join(repo, "deploys.jsonl"));
const deploysSeit = deploys.filter((d) => d.at >= seit);
out.deploys = {
  gesamt: deploys.length,
  seit_stichtag: deploysSeit.length,
  von: count(deploysSeit, (d) => d.by ?? "?"),
  ok: count(deploysSeit, (d) => String(d.ok)),
  audit_dabei: count(deploysSeit, (d) => d.audit ? `audit ${d.audit.result}` : d.unaudited ? "ohne audit" : "kein feld"),
  ziel_getroffen: count(deploysSeit, (d) => String(d.hitTarget)),
};

// Branch-Enden
out.branch_enden = {
  gesamt: ends.length,
  lands_je_branch: count(ends, (e) => String(e.record?.lands?.length ?? 0)),
  live_board_branches: live.length,
  live_ohne_land: live.filter((b: any) => !(b.lands?.length)).length,
  live_mit_check: count(live, (b: any) => b.check?.state ?? "?"),
};

console.log(JSON.stringify(out, null, 2));

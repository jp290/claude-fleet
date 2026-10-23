#!/usr/bin/env bun
// Merge-Check (docs/neuaufbau/plan.md K2): ein Urteil VOR dem Merge, am Branch sichtbar, in
// ~5 min ohne große Units, ~20 min mit allen vier Audit-Shards. Geprüft wird der Baum, den main nach dem Merge hätte: main plus die Commits <base>..<branch>,
// ohne Checkout per `git merge-tree` nachgebaut (so wie die Bauleitung per Rebase/Cherry-Pick merged).
// Die Suiten laufen parallel auf dem Helfer (ci/merge-check-run.sh), mit den Audit-Shards, die die großen
// Units tragen, die der Kandidat schuldet (ci/big-units.ts); das Urteil nennt sie und warum. Solange main bekannt rot ist,
// meldet er nie „mergebar“.
//
//   bun ci/merge-check.ts <branch> [--base <ref>] [--repair]
//
// --base     wovon der Branch abzweigt, Default main (bau/*-Branches: --base bau/neuaufbau)
// --repair   der Branch repariert ein rotes main: mergebar trotz rotem main, und die Zeile sagt es
// Exit: 0 mergebar · 1 rot · 2 grün, aber main ist rot · 3 nicht prüfbar (Konflikt, Helfer, Eingabe)
// Ergebnis: eine Zeile in <git-common-dir>/merge-checks.jsonl und eine Note auf der Branch-Spitze
// (refs/notes/merge-check): `git log --notes=merge-check <branch>` zeigt das Urteil am Branch.
// Helfer: MERGE_CHECK_HOST=user@host, sonst Nutzer und Host des git-Remotes `hub`.
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { ADJUDICATION_CLEARS_RED } from "../server/adjudication";
import { BIG_UNITS, bigUnitsFor, bigUnitsLine, type BigUnitSelection } from "./big-units";

const RUNNER = join(import.meta.dir, "merge-check-run.sh");
const REPO_DIR = join(import.meta.dir, "..");
const HELPER_REPO = "~/ci/repo.git";

interface Job { name: string; rc: number; ms: number }
interface MainState { red: boolean; why: string }

function git(args: string[], input?: string, dir = REPO_DIR): { ok: boolean; out: string; err: string } {
  const r = Bun.spawnSync(["git", "-C", dir, ...args], { stdin: input === undefined ? "ignore" : Buffer.from(input) });
  return { ok: r.exitCode === 0, out: r.stdout.toString().trim(), err: r.stderr.toString().trim() };
}
function mustGit(args: string[], input?: string, dir = REPO_DIR): string {
  const r = git(args, input, dir);
  if (!r.ok) throw new Error(`git ${args.join(" ")}: ${r.err || r.out}`);
  return r.out;
}

// main plus <base>..<branch>, Commit für Commit wie ein Cherry-Pick; Merge-Commits fallen weg (ein
// hereingemergtes bau/neuaufbau soll nicht mit nach main). Ein Commit, dessen Patch schon auf main
// liegt (die Bauleitung merged per Cherry-Pick, der Branch behält das Original), wird übersprungen:
// noch einmal angewendet gäbe er Konflikte mit späteren Änderungen derselben Datei. Verglichen wird
// die Patch-ID mit den letzten MAIN_WINDOW Commits von main, nicht per `git cherry`: das sieht nur
// main-Commits, die dem Branch fehlen, und hat ein Branch die main-Kopien per merge hereingeholt,
// blieben die Originale stehen.
const MAIN_WINDOW = 300;
export function candidateOf(main: string, base: string, branch: string, dir = REPO_DIR):
  { sha: string; commits: string[]; onMain: string[] } | { conflict: string } {
  const onMainIds = new Set(patchIds(["-n", String(MAIN_WINDOW), main], dir).values());
  const ids = patchIds([`${base}..${branch}`], dir);
  const all = mustGit(["rev-list", "--reverse", "--topo-order", "--no-merges", `${base}..${branch}`], undefined, dir)
    .split("\n").filter(Boolean);
  const onMain = all.filter((c) => onMainIds.has(ids.get(c) ?? ""));
  const commits = all.filter((c) => !onMain.includes(c));
  let cur = main;
  for (const c of commits) {
    const t = git(["merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c], undefined, dir);
    if (!t.ok) return { conflict: `${c.slice(0, 8)} lässt sich nicht auf main setzen:\n${t.out.split("\n").slice(1).join("\n")}` };
    cur = mustGit(["commit-tree", t.out.split("\n")[0]!, "-p", cur, "-F", "-"], mustGit(["log", "-1", "--format=%B", c], undefined, dir), dir);
  }
  return { sha: cur, commits, onMain };
}
// Commit → Patch-ID (`git patch-id --stable`) für die Commits ohne Merges in `git log <args>`; ein
// leerer Commit hat keine. Die Ausgabe von git log geht ungekürzt hinein, sonst ändert sich die ID.
function patchIds(args: string[], dir: string): Map<string, string> {
  const log = Bun.spawnSync(["git", "-C", dir, "log", "-p", "--no-color", "--no-ext-diff", "--no-merges", ...args]);
  if (log.exitCode !== 0) throw new Error(`git log ${args.join(" ")}: ${log.stderr.toString().trim()}`);
  const pid = Bun.spawnSync(["git", "-C", dir, "patch-id", "--stable"], { stdin: log.stdout });
  if (pid.exitCode !== 0) throw new Error(`git patch-id: ${pid.stderr.toString().trim()}`);
  const ids = new Map<string, string>();
  for (const l of pid.stdout.toString().split("\n").filter(Boolean)) {
    const [id, c] = l.split(" ");
    ids.set(c!, id!);
  }
  return ids;
}

// Zwei gleichzeitige Checks desselben Kandidaten schieben denselben Ref, und einer wird abgewiesen;
// dann genügt es, dass der Kandidat drüben liegt (wie ci/band-run.sh)
export function pushCandidate(host: string, sha: string): boolean {
  if (Bun.spawnSync(["ssh", host, `test -d ${HELPER_REPO} || git init -q --bare ${HELPER_REPO}`]).exitCode !== 0) return false;
  return git(["push", "-q", `ssh://${host}/${HELPER_REPO}`, `${sha}:refs/mc/${sha}`]).ok
    || Bun.spawnSync(["ssh", host, `git --git-dir ${HELPER_REPO} cat-file -e ${sha}^{commit}`]).exitCode === 0;
}

function helperHost(): string {
  if (process.env.MERGE_CHECK_HOST) return process.env.MERGE_CHECK_HOST;
  const m = /^ssh:\/\/([^/]+)\//.exec(mustGit(["remote", "get-url", "hub"]));
  if (!m) throw new Error("kein Helfer: MERGE_CHECK_HOST fehlt, und das Remote `hub` ist keine ssh://-URL");
  return m[1]!;
}

// Bekannt rot heißt: die jüngste gemessene Audit-Zeile (grün oder rot) auf einem Stand von main ist
// rot, und kein Urteil hebt sie auf — dieselben Urteile wie im Server (server/adjudication.ts: flake,
// stale-test, unknowable). Nicht lesbar heißt nicht grün.
function mainState(main: string): MainState {
  const r = Bun.spawnSync(["./ctl.sh", "get", "/api/post-land-audits?limit=50", "--json"], { cwd: REPO_DIR });
  let audits: Record<string, unknown>[];
  try {
    const body: unknown = JSON.parse(r.stdout.toString());
    const rows = (body as { audits?: unknown }).audits;
    if (!Array.isArray(rows)) throw new Error("keine audits");
    audits = rows as Record<string, unknown>[];
  } catch {
    return { red: true, why: "Audit-Stand von main nicht lesbar (./ctl.sh get /api/post-land-audits)" };
  }
  return mainVerdict(audits, (sha) => git(["merge-base", "--is-ancestor", sha, main]).ok);
}
export function mainVerdict(audits: readonly Record<string, unknown>[], onMain: (sha: string) => boolean): MainState {
  const measured = audits
    .filter((a) => (a.result === "green" || a.result === "red") && typeof a.mainSha === "string" && onMain(a.mainSha))
    .sort((a, b) => Number(b.at) - Number(a.at));
  const last = measured[0];
  if (!last) return { red: true, why: "kein gemessener Audit auf einem Stand von main unter den letzten 50" };
  const adj = last.adjudication as { verdict?: string } | string | null | undefined;
  const verdict = typeof adj === "string" ? adj : adj?.verdict;
  const at = new Date(Number(last.at)).toISOString();
  const sha = String(last.mainSha).slice(0, 8);
  if (last.result === "red" && !(ADJUDICATION_CLEARS_RED as readonly (string | undefined)[]).includes(verdict))
    return { red: true, why: `main ist rot: Audit ${sha} vom ${at}${verdict ? ` (Urteil ${verdict})` : ""}` };
  return { red: false, why: `main grün: Audit ${sha} vom ${at}${verdict ? ` (rot, Urteil ${verdict})` : ""}` };
}

// die großen Units, die der Kandidat schuldet: der Diff main..Kandidat gegen den Kandidaten-Baum. Die
// .ts- und .sh-Dateien kommen in einem `cat-file --batch` (ein git je Datei kostete am vollen Mac 20 s)
export function bigUnitsOf(main: string, cand: string, dir = REPO_DIR): BigUnitSelection {
  const paths = mustGit(["diff", "--name-only", "--no-renames", main, cand], undefined, dir).split("\n").filter(Boolean);
  const blobs = new Map<string, string>();
  for (const l of mustGit(["ls-tree", "-r", "--full-tree", cand], undefined, dir).split("\n")) {
    const m = /^\d+ blob (\w+)\t(.+)$/.exec(l);
    if (m) blobs.set(m[2]!, m[1]!);
  }
  const want = [...blobs].filter(([p]) => /\.(?:ts|tsx|sh)$/.test(p));
  const out = Bun.spawnSync(["git", "-C", dir, "cat-file", "--batch"],
    { stdin: Buffer.from(want.map(([, sha]) => sha).join("\n") + "\n") }).stdout;
  const text = new Map<string, string>();
  let at = 0;
  for (const [p] of want) {
    const nl = out.indexOf(10, at);
    const size = Number(out.subarray(at, nl).toString().split(" ")[2]);
    text.set(p, out.subarray(nl + 1, nl + 1 + size).toString());
    at = nl + 1 + size + 1;
  }
  return bigUnitsFor(paths, (p) => {
    if (text.has(p)) return text.get(p)!;
    if (!blobs.has(p)) return null;
    const r = Bun.spawnSync(["git", "-C", dir, "cat-file", "blob", blobs.get(p)!], { stderr: "ignore" });
    return r.exitCode === 0 ? r.stdout.toString() : null;
  });
}

// `unit,…` für den Helfer, der daraus die Audit-Shards wählt, die sie tragen (merge-check-run.sh#SHARDS)
export function bigUnitsArg(big: readonly string[]): string {
  return big.join(",") || "-";
}

// was der Helfer statt der Units fuhr: die Audit-Shards (`audit-shard <k>/<n> <units>`), mit den großen
// Units darin, auch denen, die nur mitfahren, weil sie den Shard mit einer geschuldeten teilen
export function auditShardsLine(out: string, big: readonly string[]): string | null {
  const shards = [...out.matchAll(/^audit-shard (\d+)\/(\d+) (\S+)$/gm)]
    .map((m) => ({ k: m[1]!, n: Number(m[2]), units: m[3]!.split(",").filter((u) => BIG_UNITS.some((b) => b === u)) }));
  if (!shards.length) return null;
  const along = shards.flatMap((s) => s.units.filter((u) => !big.includes(u)).map((u) => `${u} fährt mit (teilt ${s.k}/${s.n})`));
  return `gefahren als Audit-Shards ${shards.map((s) => `${s.k}/${s.n} (${s.units.join(", ")})`).join(", ")}`
    + (along.length ? `; ${along.join("; ")}` : "")
    + (shards.length === shards[0]!.n ? "; sie tragen jede kleine Unit, s1–s3 entfallen" : "");
}

async function runOnHelper(host: string, sha: string, big: readonly string[]): Promise<{ exit: number; out: string }> {
  const p = Bun.spawn(["ssh", host, "sh", "-s", "--", sha, bigUnitsArg(big)], { stdin: Bun.file(RUNNER), stdout: "pipe", stderr: "inherit" });
  let out = "";
  const dec = new TextDecoder();
  for await (const chunk of p.stdout) {
    const s = dec.decode(chunk);
    out += s;
    process.stdout.write(s);
  }
  return { exit: await p.exited, out };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const branch = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--base");
  const bi = argv.indexOf("--base");
  const base = bi >= 0 ? argv[bi + 1] : "main";
  const repair = argv.includes("--repair");
  if (!branch || !base) { console.error("bun ci/merge-check.ts <branch> [--base <ref>] [--repair]"); return 3; }
  const t0 = Date.now();
  const mainSha = mustGit(["rev-parse", "main"]);
  const tip = mustGit(["rev-parse", branch]);
  const row: Record<string, unknown> = { at: t0, branch, base, tip, main: mainSha, repair };
  const finish = (verdict: string, mergeable: boolean, why: string, code: number): number => {
    Object.assign(row, { verdict, mergeable, why, ms: Date.now() - t0 });
    appendFileSync(join(mustGit(["rev-parse", "--path-format=absolute", "--git-common-dir"]), "merge-checks.jsonl"), `${JSON.stringify(row)}\n`);
    git(["notes", "--ref=merge-check", "add", "-f", "-m",
      `merge-check ${verdict} · ${mergeable ? "mergebar" : "nicht mergebar"} · ${Math.round((Date.now() - t0) / 1000)} s · ${new Date(t0).toISOString()}\n`
      + `Baum ${String(row.tree ?? "-")} = main ${mainSha.slice(0, 8)} + ${base}..${branch}\n${why}`
      + (Array.isArray(row.notApplicable) && row.notApplicable.length ? `\nnicht anwendbar: ${row.notApplicable.join("; ")}` : "")
      + (Array.isArray(row.alreadyOnMain) ? `\nschon auf main, übersprungen: ${row.alreadyOnMain.length} Commit(s)` : "")
      + (typeof row.bigUnitsLine === "string" ? `\n${row.bigUnitsLine}` : ""), tip]);
    console.log(`\nmerge-check ${verdict} ${branch} in ${Math.round((Date.now() - t0) / 1000)} s — ${mergeable ? "mergebar" : "nicht mergebar"}: ${why}`
      + (typeof row.bigUnitsLine === "string" ? `\n${row.bigUnitsLine}` : ""));
    return code;
  };

  const cand = candidateOf(mainSha, base, branch);
  if ("conflict" in cand) return finish("conflict", false, cand.conflict, 3);
  Object.assign(row, { candidate: cand.sha, tree: mustGit(["rev-parse", `${cand.sha}^{tree}`]), commits: cand.commits,
    ...(cand.onMain.length ? { alreadyOnMain: cand.onMain } : {}) });
  const host = helperHost();
  if (!pushCandidate(host, cand.sha)) return finish("error", false, `Kandidat ließ sich nicht zum Helfer ${host} schieben`, 3);
  const state = mainState(mainSha);
  row.mainState = state.why;
  const big = bigUnitsOf(mainSha, cand.sha);
  Object.assign(row, { bigUnits: big.run, bigUnitsWhy: big.why, bigUnitsLine: bigUnitsLine(big) });

  const run = await runOnHelper(host, cand.sha, big.run);
  const jobs: Job[] = [...run.out.matchAll(/^job (\S+) rc=(\d+) ms=(\d+)$/gm)].map((m) => ({ name: m[1]!, rc: Number(m[2]), ms: Number(m[3]) }));
  const modules: Record<string, number> = {};
  for (const m of run.out.matchAll(/^[sa]\d module (\S+) (\d+) ms$/gm)) modules[m[1]!] = Number(m[2]);
  const units: Record<string, number> = {};
  for (const m of run.out.matchAll(/^[sa]\d shard-unit (\S+) (\d+) ms$/gm)) units[m[1]!] = Number(m[2]);
  const shards = auditShardsLine(run.out, big.run);
  if (shards) row.bigUnitsLine = `${String(row.bigUnitsLine)} · ${shards}`;
  // die Handlauf-Bänder 5/6 nimmt der Helfer nur, wenn sie frei sind; fehlten sie, sagt die Zeile, warum es länger dauerte
  const bands = /^bands ([\d ]+) busy=(\S+)$/m.exec(run.out);
  if (bands) {
    const got = bands[1]!.trim().split(" ").map(Number);
    row.bands = got;
    if (bands[2] !== "-")
      row.bigUnitsLine = `${String(row.bigUnitsLine)} · Handlauf-Band ${bands[2]} belegt: die Audit-Shards liefen auf ${got.length} Bändern, darum länger`;
  }
  const runLine = /^merge-check (green|red) (\d+)(?: — (.*))?$/m.exec(run.out);
  const notApplicable = [...run.out.matchAll(/^na (\S+) — (.*)$/gm)].map((m) => `${m[1]}: ${m[2]}`);
  Object.assign(row, { jobs, modules, units, notApplicable, helperMs: runLine ? Number(runLine[2]) : null,
    run: /^run (\S+)/m.exec(run.out)?.[1] ?? null, helperWaitMs: Number(/^run \S+ wait=(\d+)/m.exec(run.out)?.[1] ?? 0) });
  if (!runLine) return finish("error", false, `der Helfer lieferte kein Urteil (ssh exit ${run.exit})`, 3);
  const verdict = runLine[1] === "green" ? "green" : "red";
  const d = decide(verdict, state, repair);
  return finish(verdict, d.mergeable,
    verdict === "red" ? `rot: ${runLine[3] ?? jobs.filter((j) => j.rc !== 0).map((j) => j.name).join(", ")}` : d.why, d.code);
}
// Rot ist nie mergebar; grün bei rotem main nur mit --repair
export function decide(run: "green" | "red", main: MainState, repair: boolean): { mergeable: boolean; code: number; why: string } {
  if (run === "red") return { mergeable: false, code: 1, why: "rot" };
  if (main.red && !repair) return { mergeable: false, code: 2, why: main.why };
  return { mergeable: true, code: 0, why: main.red ? `${main.why}; --repair: der Branch repariert es` : main.why };
}

if (import.meta.main) process.exit(await main());

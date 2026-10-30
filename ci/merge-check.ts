#!/usr/bin/env bun
// Merge-Check (docs/neuaufbau/plan.md K2): ein Urteil VOR dem Merge, am Branch sichtbar, in
// ~5 min ohne große Units, ~20 min mit allen vier Audit-Shards. Geprüft wird der Baum, den main nach dem Merge hätte: main plus die Commits <base>..<branch>,
// ohne Checkout per `git merge-tree` nachgebaut, als Kette Commit für Commit und als ein Drei-Wege-Merge (candidateOf).
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
// Helfer: MERGE_CHECK_HOST=user@host, sonst Nutzer und Host des git-Remotes `hub`. Ist `hub` ein lokaler Pfad, ist
// der Helfer diese Maschine: dasselbe bare Repo unter $CI_HOME/repo.git und derselbe Runner durch `sh`, ohne ssh
// auf sich selbst. Jeder Abbruch vor dem Urteil schreibt `exit: 3` und den Grund in die Zeile, damit am Board
// „nicht prüfbar: <Grund>“ steht (der Server verwirft stdout und stderr dieses Prozesses).
import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ADJUDICATION_CLEARS_RED } from "../server/adjudication";
import { BIG_UNITS, bigUnitsFor, bigUnitsLine, type BigUnitSelection } from "./big-units";
import { repairProofOf, type RepairProof } from "./repair-proof";
import { maschinenName, plattformHier, pushSiegel, schreibeSiegel } from "../server/pruef-siegel";

const RUNNER = join(import.meta.dir, "merge-check-run.sh");
const REPO_DIR = join(import.meta.dir, "..");
const HELPER_REPO = "~/ci/repo.git";

interface Job { name: string; rc: number; ms: number }
interface MainState { red: boolean; why: string }

// EIN ROTER CHECK NENNT SEINE ROTEN PRÜFUNGEN: der Runner gibt je rotem Teil die Prüfzeilen seines Logs als
// `fail <name> <zeile>` aus (ci/merge-check-run.sh, aus `(fail) <name>` von `bun test` und `FAIL  <check>
// (<detail>)` des e2e-Runners). Hier werden daraus `row.fails` und die erste Prüfung in der `why`-Zeile:
// `rot: a1 — FAIL  chat: …`, bei mehreren `(+2 weitere)`. Reiner Text hinein, Text und Array heraus — keine
// Datei, kein Prozess, damit es prüfbar ist (ci/merge-check.test.ts). Ohne `fail`-Zeilen bleibt alles wie heute.
export function redOf(out: string): { fails: string[]; why: string } {
  const found = [...out.matchAll(/^fail (\S+) ([^\n]*)$/gm)]
    .slice(0, 10).map((m) => ({ job: m[1]!, check: m[2]!.trim() }));
  const fails = found.map((f) => `${f.job}: ${f.check}`);
  const runLine = /^merge-check (green|red) (\d+)(?: — (.*))?$/m.exec(out);
  const jobsFallback = [...out.matchAll(/^job (\S+) rc=(\d+) ms=\d+$/gm)]
    .filter((m) => m[2] !== "0").map((m) => m[1]!).join(", ");
  const base = (runLine?.[3] ?? jobsFallback).trim();
  if (!found.length) return { fails, why: `rot: ${base}` };
  return { fails, why: `rot: ${base} — ${found[0]!.check}` + (found.length > 1 ? ` (+${found.length - 1} weitere)` : "") };
}

function git(args: string[], input?: string, dir = REPO_DIR): { ok: boolean; out: string; err: string } {
  const r = Bun.spawnSync(["git", "-C", dir, ...args], { stdin: input === undefined ? "ignore" : Buffer.from(input) });
  return { ok: r.exitCode === 0, out: r.stdout.toString().trim(), err: r.stderr.toString().trim() };
}
function mustGit(args: string[], input?: string, dir = REPO_DIR): string {
  const r = git(args, input, dir);
  if (!r.ok) throw new Error(`git ${args.join(" ")}: ${r.err || r.out}`);
  return r.out;
}

// main plus <base>..<branch>, auf zwei Wegen gerechnet. DIE KETTE: Commit für Commit wie ein Cherry-Pick;
// Merge-Commits fallen weg (ein hereingemergtes bau/neuaufbau soll nicht mit nach main). Ein Commit, dessen
// Patch schon auf main liegt (die Bauleitung merged per Cherry-Pick, der Branch behält das Original), wird
// übersprungen: noch einmal angewendet gäbe er Konflikte mit späteren Änderungen derselben Datei. Verglichen
// wird die Patch-ID mit den letzten MAIN_WINDOW Commits von main, nicht per `git cherry`: das sieht nur
// main-Commits, die dem Branch fehlen, und hat ein Branch die main-Kopien per merge hereingeholt, blieben
// die Originale stehen.
// DER EINE SCHRITT (Zielbild Landen 24.10., Schritt 1): ein Drei-Wege-Merge der Spitze mit main über die Basis
// aus mergeBaseOf, wie `git merge` ihn sähe. Die Kette verliert, was ein Merge-Commit trägt: hat der Branch
// main hereingeholt und dabei einen Konflikt gelöst, kommt der Konflikt beim Nachspielen wieder (Board-Zeile
// 497828bd), und stellt ein Commit eine Änderung wieder her, die ein früherer desselben Branches zurücknahm,
// fällt er als „schon auf main“ weg und der Kandidat trägt den Rückbau (Mangel 124, 3f754690a).
// Gilt: Ergeben beide denselben Baum, bleibt die Kette der Kandidat, wie bisher (die Form „alle Commits“ landet
// sie Commit für Commit). Scheitert die Kette oder ergibt sie einen anderen Baum, ist der Kandidat ein Commit mit
// dem Baum des einen Schritts. Scheitert der eine Schritt, gilt die Kette: Originale, die als Squash auf main
// liegen und die main danach weiter änderte, sieht nur ihr Patch-ID-Filter.
const MAIN_WINDOW = 300;
export type Candidate = { sha: string; commits: string[]; onMain: string[]; form: "kette" | "ein-schritt";
  mergeBase: string | null; ketteTree?: string; ketteConflict?: string };
export function candidateOf(main: string, base: string, branch: string, dir = REPO_DIR): Candidate | { conflict: string } {
  const onMainIds = new Set(patchIds(["-n", String(MAIN_WINDOW), main], dir).values());
  const ids = patchIds([`${base}..${branch}`], dir);
  const all = mustGit(["rev-list", "--reverse", "--topo-order", "--no-merges", `${base}..${branch}`], undefined, dir)
    .split("\n").filter(Boolean);
  const onMain = all.filter((c) => onMainIds.has(ids.get(c) ?? ""));
  const commits = all.filter((c) => !onMain.includes(c));
  const kette = chainOf(main, commits, dir);
  const mergeBase = mergeBaseOf(main, base, branch, dir);
  const one = mergeBase ? git(["merge-tree", "--write-tree", "--merge-base", mergeBase, main, branch], undefined, dir) : null;
  if (!one?.ok) return "conflict" in kette ? { conflict: kette.conflict } : { ...kette, commits, onMain, form: "kette", mergeBase };
  const tree = one.out.split("\n")[0]!;
  if (!("conflict" in kette) && kette.tree === tree) return { ...kette, commits, onMain, form: "kette", mergeBase };
  // der eine Schritt trägt, was die Kette nicht trägt: ein Commit mit seinem Baum. Die Liste nennt alle Commits
  // der Charge, denn hier irrte der Patch-ID-Filter oder die Kette kam nicht durch (Mangel 124: der Übersprungene
  // war der, der die Änderung wiederherstellte)
  const msg = `${branch}: ${all.length} Commit(s) in einem Schritt auf main\n\n`
    + (all.length ? mustGit(["log", "--no-walk=unsorted", "--format=- %h %s", ...all], undefined, dir) : "");
  const sha = mustGit(["commit-tree", tree, "-p", main, "-F", "-"], `${msg}\n`, dir);
  return { sha, commits: all, onMain: [], form: "ein-schritt", mergeBase,
    ...("conflict" in kette ? { ketteConflict: kette.conflict } : { ketteTree: kette.tree }) };
}

// die Kette: jeder Commit auf den vorigen gesetzt, mit seiner eigenen Nachricht
function chainOf(main: string, commits: readonly string[], dir: string): { sha: string; tree: string } | { conflict: string } {
  let cur = main;
  for (const c of commits) {
    const t = git(["merge-tree", "--write-tree", "--merge-base", `${c}^`, cur, c], undefined, dir);
    if (!t.ok) return { conflict: `${c.slice(0, 8)} lässt sich nicht auf main setzen:\n${t.out.split("\n").slice(1).join("\n")}` };
    cur = mustGit(["commit-tree", t.out.split("\n")[0]!, "-p", cur, "-F", "-"], mustGit(["log", "-1", "--format=%B", c], undefined, dir), dir);
  }
  return { sha: cur, tree: mustGit(["rev-parse", `${cur}^{tree}`], undefined, dir) };
}

// Die Basis des einen Schritts: der Stand, den Branch und main zuletzt teilten, ohne die Basis des Branches.
// Liegt die Basis (ein Basis-Branch wie bau/neuaufbau, oder nach einem Land dessen Spitze) unter der Spitze und
// ist sie jünger als der Merge-Base von git, ist sie es: ihr Inhalt geht nicht mit nach main, und eine
// gelandete Spitze trägt den Baum ihres Squash-Commits. Liegt der Merge-Base von git darüber, ist er der jüngere.
// Liegen beide nebeneinander, gilt der Merge-Base nur, wenn er schon trägt, was die Basis trägt: so steht es, wenn
// der Branch nach einem Squash-Land main hereinholte (der Squash ist kein Nachfahre der Spitze, trägt aber ihren
// Baum). Sonst (ein Basis-Branch, den main nie bekam) gibt es keine eine Basis: null, dann gilt die Kette.
export function mergeBaseOf(main: string, base: string, branch: string, dir = REPO_DIR): string | null {
  const mb = git(["merge-base", main, branch], undefined, dir);
  if (!mb.ok) return null;
  const b = git(["rev-parse", "--verify", "-q", `${base}^{commit}`], undefined, dir);
  const below = (a: string, c: string): boolean => git(["merge-base", "--is-ancestor", a, c], undefined, dir).ok;
  if (!b.ok || !below(b.out, branch)) return mb.out;
  if (below(mb.out, b.out)) return b.out;
  if (below(b.out, mb.out)) return mb.out;
  const both = git(["merge-tree", "--write-tree", mb.out, b.out], undefined, dir);
  return both.ok && both.out.split("\n")[0] === mustGit(["rev-parse", `${mb.out}^{tree}`], undefined, dir) ? mb.out : null;
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
export function pushCandidate(helper: Helper, sha: string, dir = REPO_DIR): boolean {
  if (helper.kind === "local") {
    try { mkdirSync(dirname(helper.repo), { recursive: true }); } catch { return false; }
    if (Bun.spawnSync(["git", "init", "-q", "--bare", helper.repo]).exitCode !== 0) return false;
    return git(["push", "-q", helper.repo, `${sha}:refs/mc/${sha}`], undefined, dir).ok
      || git(["cat-file", "-e", `${sha}^{commit}`], undefined, helper.repo).ok;
  }
  if (Bun.spawnSync(["ssh", helper.host, `test -d ${helper.repo} || git init -q --bare ${helper.repo}`]).exitCode !== 0) return false;
  return git(["push", "-q", `ssh://${helper.host}/${helper.repo}`, `${sha}:refs/mc/${sha}`], undefined, dir).ok
    || Bun.spawnSync(["ssh", helper.host, `git --git-dir ${helper.repo} cat-file -e ${sha}^{commit}`]).exitCode === 0;
}

// WO DER CHECK LÄUFT. Auf dem Mac ist `hub` ssh://…: der Helfer ist eine andere Maschine, der Kandidat geht per
// push über ssh hinüber und der Runner per ssh zurück. Am Workhorse ist `hub` ein lokaler Pfad — der Helfer IST
// diese Maschine: dasselbe bare Repo unter $CI_HOME/repo.git (wie merge-check-run.sh#CI_HOME) und derselbe Runner
// durch `sh`. ssh auf sich selbst bräuchte einen Host-Key für den eigenen Namen und geht darum nicht.
export type Helper = { kind: "ssh"; host: string; repo: string } | { kind: "local"; repo: string };

export function helperOf(hubUrl: string | null | undefined, env: Record<string, string | undefined> = process.env,
  home = homedir()): Helper {
  const host = env.MERGE_CHECK_HOST?.trim();
  if (host) return { kind: "ssh", host, repo: HELPER_REPO };
  if (!hubUrl) throw new Error("kein Helfer: MERGE_CHECK_HOST fehlt, und dieses Repo hat kein Remote `hub`");
  const ssh = /^ssh:\/\/([^/]+)\//.exec(hubUrl);
  if (ssh) return { kind: "ssh", host: ssh[1]!, repo: HELPER_REPO };
  // alles mit einem Doppelpunkt vor dem ersten Schrägstrich ist ein Remote (https, git, scp-Gestalt user@host:pfad) — kein Pfad
  if (/^[^/]*:/.test(hubUrl))
    throw new Error(`kein Helfer: MERGE_CHECK_HOST fehlt, und das Remote \`hub\` (${hubUrl}) ist weder ssh:// noch ein lokaler Pfad`);
  return { kind: "local", repo: join(resolve(env.CI_HOME ?? join(home, "ci")), "repo.git") };
}

// Bekannt rot heißt: die jüngste gemessene Audit-Zeile (grün oder rot) auf einem Stand von main ist
// rot, und kein Urteil hebt sie auf — dieselben Urteile wie im Server (server/adjudication.ts: flake,
// stale-test, unknowable). Nicht lesbar heißt nicht grün.
// `row` ist die Zeile, die main rot HÄLT (null, wenn main nicht rot ist): sie trägt die `fails`, aus
// denen die Reparatur-Tür den Beleg liest (ci/repair-proof.ts).
type MainReading = MainState & { row: Record<string, unknown> | null };
function mainState(main: string, dir = REPO_DIR): MainReading {
  // ein Repo ohne ctl.sh (ein Testbaum) ist „nicht lesbar“, nicht „grün“ — und darf den Lauf nicht werfen
  let r: ReturnType<typeof Bun.spawnSync> | null = null;
  try { r = Bun.spawnSync(["./ctl.sh", "get", "/api/post-land-audits?limit=50", "--json"], { cwd: dir }); } catch { r = null; }
  let audits: Record<string, unknown>[];
  try {
    if (!r) throw new Error("ctl.sh nicht startbar");
    const body: unknown = JSON.parse(r.stdout?.toString() ?? "");
    const rows = (body as { audits?: unknown }).audits;
    if (!Array.isArray(rows)) throw new Error("keine audits");
    audits = rows as Record<string, unknown>[];
  } catch {
    return { red: true, row: null, why: "Audit-Stand von main nicht lesbar (./ctl.sh get /api/post-land-audits)" };
  }
  return mainAuditOf(audits, (sha) => git(["merge-base", "--is-ancestor", sha, main], undefined, dir).ok);
}
export function mainAuditOf(audits: readonly Record<string, unknown>[], onMain: (sha: string) => boolean): MainReading {
  const measured = audits
    .filter((a) => (a.result === "green" || a.result === "red") && typeof a.mainSha === "string" && onMain(a.mainSha))
    .sort((a, b) => Number(b.at) - Number(a.at));
  const last = measured[0];
  if (!last) return { red: true, row: null, why: "kein gemessener Audit auf einem Stand von main unter den letzten 50" };
  const adj = last.adjudication as { verdict?: string } | string | null | undefined;
  const verdict = typeof adj === "string" ? adj : adj?.verdict;
  const at = new Date(Number(last.at)).toISOString();
  const sha = String(last.mainSha).slice(0, 8);
  if (last.result === "red" && !(ADJUDICATION_CLEARS_RED as readonly (string | undefined)[]).includes(verdict))
    return { red: true, row: last, why: `main ist rot: Audit ${sha} vom ${at}${verdict ? ` (Urteil ${verdict})` : ""}` };
  return { red: false, row: null, why: `main grün: Audit ${sha} vom ${at}${verdict ? ` (rot, Urteil ${verdict})` : ""}` };
}
export function mainVerdict(audits: readonly Record<string, unknown>[], onMain: (sha: string) => boolean): MainState {
  const { red, why } = mainAuditOf(audits, onMain);
  return { red, why };
}

// DIE DATEIEN, DIE EINE PRÜFUNG NENNT — der Beleg der Reparatur-Tür. `git grep -F` im Kandidatenbaum,
// über den QUELLTEXT: eine Messnotiz, die den Satz einer Prüfung zitiert, belegt keine Reparatur.
const REPAIR_SCOPE = ["*.ts", "*.tsx", "*.js", "*.mjs", "*.css", "*.html"] as const;
// Die Form, in der ein Satz als Quelltext-String steht: `\` zuerst, dann `"`. Ein Satz der Prüfung
// trägt oft selbst Anführungszeichen ("stufe: "lesen""); im Quelltext ist jedes davon escaped.
export function sourceEscapedOf(needle: string): string {
  return needle.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
export function namesInTree(sha: string, needle: string, dir = REPO_DIR): string[] {
  // BEIDE FORMEN, vereinigt (branch/rechte-block, d3a0af04): eine Nadel mit `"` oder `\` findet im
  // Quelltext nur ihre Escape-Form. Ohne diese beiden Zeichen sind die Formen gleich — dann ein Lauf.
  const escaped = sourceEscapedOf(needle);
  const found = new Set<string>();
  for (const form of escaped === needle ? [needle] : [needle, escaped]) {
    const r = Bun.spawnSync(["git", "-C", dir, "grep", "-l", "-F", "-z", "-e", form, sha, "--", ...REPAIR_SCOPE]);
    // 1 = kein Treffer, alles andere = nicht lesbar. Beides heißt: diese Form nennt keine Datei.
    if (r.exitCode !== 0) continue;
    // `-z`: Einträge sind NUL-getrennt und tragen den Rev vor dem Pfad
    for (const l of r.stdout.toString().split("\0")) if (l) found.add(l.replace(/^[^:]*:/, ""));
  }
  return [...found];
}
// was der Branch gegen main ändert — dieselbe Sicht, aus der bigUnitsOf seine Units ableitet
export function diffPaths(from: string, to: string, dir = REPO_DIR): string[] {
  const r = git(["diff", "--name-only", "--no-renames", from, to], undefined, dir);
  return r.ok ? r.out.split("\n").filter(Boolean) : [];
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

// DIE UMGEBUNG DES RUNNERS. Über ssh bekommt er eine frische Login-Umgebung; lokal würde er die des Aufrufers erben —
// und deren FLEET_* (FLEET_HOST/FLEET_PORT beim Server, FLEET_SELF_URL/TOKEN in einer Pane) lässt die e2e-Suiten eine
// andere Fleet lesen (start-plan.ts liest FLEET_HOST/FLEET_PORT/FLEET_CTL_URL). Darum lokal dieselbe saubere Lage:
// jedes FLEET_* fällt weg, alles andere (HOME, PATH, MERGE_CHECK_*, CI_HOME) bleibt.
export function helperEnv(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(env))
    if (typeof value === "string" && !name.startsWith("FLEET_")) out[name] = value;
  return out;
}

// der eine Aufruf des Runners, rein: über ssh der ferne Login (keine env-Angabe), lokal `sh` mit der gefilterten Umgebung.
// LOKAL OHNE TERMINAL: der Server läuft in einer tmux-Pane, hat also eins. `ci/merge-check-run.sh#run` legt jeden Job
// per `timeout` in eine Hintergrund-Prozessgruppe; fasst darin etwas das Terminal an, hält der Kernel den Job an
// (Zustand T), bis das Limit ihn tötet — höhere Limits helfen darum nicht (28.10. gemessen: `bun test
// server/agenten-tuer.test.ts` in einer tmux-Pane unter `timeout` steht nach 1 s auf T, ohne Terminal in 7 s grün).
// `setsid -w` gibt dem Lauf eine eigene Sitzung ohne kontrollierendes Terminal und wartet selbst auf sein Ende;
// ohne `-w` käme der Aufruf sofort zurück und das Urteil fehlte. Auf darwin gibt es kein setsid und es braucht dort
// keins, die Läufe kommen dort ohne Terminal. Der Runner-Text geht weiter über stdin, die Umgebung bleibt, `--` und
// die Argumente dahinter bleiben, wo sie waren; die Plattform ist ein Parameter, damit die Prüfung nicht an die
// Maschine gebunden ist, auf der sie läuft.
export function helperRun(helper: Helper, sha: string, big: readonly string[],
  env: Record<string, string | undefined> = process.env,
  platform: string = process.platform): { argv: string[]; env?: Record<string, string> } {
  if (helper.kind === "ssh") return { argv: ["ssh", helper.host, "sh", "-s", "--", sha, bigUnitsArg(big)] };
  const sh = ["sh", "-s", "--", sha, bigUnitsArg(big)];
  return { argv: platform === "linux" ? ["setsid", "-w", ...sh] : sh, env: helperEnv(env) };
}

export async function runOnHelper(helper: Helper, sha: string, big: readonly string[],
  runner = RUNNER, cwd = REPO_DIR, platform = process.platform): Promise<{ exit: number; out: string }> {
  const call = helperRun(helper, sha, big, process.env, platform);
  const p = Bun.spawn(call.argv, { stdin: Bun.file(runner), stdout: "pipe", stderr: "inherit", cwd,
    ...(call.env ? { env: call.env } : {}) });
  let out = "";
  const dec = new TextDecoder();
  for await (const chunk of p.stdout) {
    const s = dec.decode(chunk);
    out += s;
    process.stdout.write(s);
  }
  return { exit: await p.exited, out };
}

// DAS URTEIL, EINMAL. Jeder Weg endet in `finish` — auch jeder Abbruch VOR dem Urteil (kein Helfer, der Kandidat
// kommt nicht hinüber, der Runner stirbt): er schreibt `exit: 3` mit dem Grund in die Zeile, damit am Board
// „nicht prüfbar: <Grund>“ steht statt nichts. Ein Wurf ohne Zeile war der Fehler, den der Workhorse am 27.10.
// hatte: der Server startet diesen Prozess mit stdout und stderr auf „ignore“, der Grund war nirgends.
export interface CheckAsk {
  branch: string; base: string; repair?: boolean;
  // der Baum, dessen ci/merge-check.ts urteilt (Default: dieser Checkout); Tests geben einen eigenen
  repo?: string;
  env?: Record<string, string | undefined>; home?: string;
  // der Runner statt ci/merge-check-run.sh — nur für Tests (ein Runner, der vor dem Urteil stirbt)
  runner?: string;
}

function noteText(row: Record<string, unknown>): string {
  const main = String(row.main ?? "-"), base = String(row.base ?? "-"), branch = String(row.branch ?? "-");
  return `merge-check ${String(row.verdict)} · ${row.mergeable === true ? "mergebar" : "nicht mergebar"} · ${Math.round(Number(row.ms ?? 0) / 1000)} s · ${new Date(Number(row.at)).toISOString()}\n`
    + `Baum ${String(row.tree ?? "-")} = main ${main.slice(0, 8)} + ${base}..${branch}`
    + (row.candidateForm === "ein-schritt" ? ` in einem Schritt (Basis ${String(row.mergeBase).slice(0, 8)})` : "") + `\n${String(row.why ?? "")}`
    + (Array.isArray(row.notApplicable) && row.notApplicable.length ? `\nnicht anwendbar: ${row.notApplicable.join("; ")}` : "")
    + (Array.isArray(row.alreadyOnMain) ? `\nschon auf main, übersprungen: ${row.alreadyOnMain.length} Commit(s)` : "")
    + (typeof row.bigUnitsLine === "string" ? `\n${row.bigUnitsLine}` : "")
    // repariert ein Branch ein rotes main, steht es an der Spitze — und woran es belegt ist; ein
    // verlangtes, aber nicht belegtes repair steht mit seinem Grund da, damit niemand es für vergessen hält
    + (row.repair === true ? `\nrepair: ${String(row.repairWhy ?? "")}` : row.repairAsked === true ? `\nkein repair: ${String(row.repairWhy ?? "")}` : "");
}

export async function mergeCheck(a: CheckAsk): Promise<{ code: number; row: Record<string, unknown> }> {
  const repo = a.repo ?? REPO_DIR;
  const env = a.env ?? process.env;
  const t0 = Date.now();
  const row: Record<string, unknown> = { at: t0, branch: a.branch, base: a.base, repair: false, ...(a.repair === true ? { repairAsked: true } : {}) };
  const finish = (verdict: string, mergeable: boolean, why: string, code: number): { code: number; row: Record<string, unknown> } => {
    Object.assign(row, { verdict, mergeable, why, exit: code, ms: Date.now() - t0 });
    try {
      appendFileSync(join(mustGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], undefined, repo), "merge-checks.jsonl"), `${JSON.stringify(row)}\n`);
    } catch (e) {
      console.error(`merge-check: keine Zeile in merge-checks.jsonl: ${e instanceof Error ? e.message : String(e)}`);
    }
    // die Note auf der Spitze braucht eine Spitze; ein Abbruch vor ihr steht nur in der Zeile
    if (typeof row.tip === "string" && row.tip)
      git(["notes", "--ref=merge-check", "add", "-f", "-m", noteText(row), row.tip], undefined, repo);
    console.log(`\nmerge-check ${verdict} ${a.branch} in ${Math.round((Date.now() - t0) / 1000)} s — ${mergeable ? "mergebar" : "nicht mergebar"}: ${why}`
      + (typeof row.bigUnitsLine === "string" ? `\n${row.bigUnitsLine}` : ""));
    return { code, row };
  };
  try {
    const mainSha = mustGit(["rev-parse", "main"], undefined, repo);
    const tip = mustGit(["rev-parse", a.branch], undefined, repo);
    Object.assign(row, { tip, main: mainSha });
    const cand = candidateOf(mainSha, a.base, a.branch, repo);
    if ("conflict" in cand) return finish("conflict", false, cand.conflict, 3);
    Object.assign(row, { candidate: cand.sha, tree: mustGit(["rev-parse", `${cand.sha}^{tree}`], undefined, repo), commits: cand.commits,
      candidateForm: cand.form, mergeBase: cand.mergeBase,
      ...(cand.ketteTree ? { ketteTree: cand.ketteTree } : {}), ...(cand.ketteConflict ? { ketteConflict: cand.ketteConflict } : {}),
      ...(cand.onMain.length ? { alreadyOnMain: cand.onMain } : {}) });
    const hidden = hiddenLayerOf(cand.sha, repo);
    if (hidden.length) return finish("red", false, `verweigert, ein verstecktes Regelbuch: ${hidden.join("; ")}`, 1);
    // WO DER HELFER IST: MERGE_CHECK_HOST zuerst, sonst das Remote `hub`; ein lokaler Pfad heißt: hier
    const helper = helperOf(git(["remote", "get-url", "hub"], undefined, repo).out || null, env, a.home ?? homedir());
    const where = helper.kind === "ssh" ? `Helfer ${helper.host}` : `lokalen Helfer ${helper.repo}`;
    if (!pushCandidate(helper, cand.sha, repo)) return finish("error", false, `Kandidat ließ sich nicht zum ${where} schieben`, 3);
    const state = mainState(mainSha, repo);
    row.mainState = state.why;
    // DIE REPARATUR EINES ROTEN main (Karte cb1edfe3, 27.10.): die Owner-Tür bittet darum (--repair), und der
    // Check BELEGT sie selbst — aus den `fails` der roten Audit-Zeile und den Dateien, die diese Prüfungen im
    // Kandidatenbaum wörtlich nennen (ci/repair-proof.ts). Ohne Beleg läuft der Check ohne repair, und die
    // Zeile sagt, woran es fehlt; was der Aufrufer behauptet, zählt dabei nicht.
    let proof: RepairProof | null = null;
    if (a.repair === true) {
      const seen = new Map<string, string[]>();
      proof = repairProofOf({ row: state.red ? state.row : null, diff: diffPaths(mainSha, cand.sha, repo),
        namesIn: (needle) => { const hit = seen.get(needle) ?? namesInTree(cand.sha, needle, repo); seen.set(needle, hit); return hit; } });
      Object.assign(row, { repair: proof.ok, repairWhy: proof.why, ...(proof.checks.length ? { repairProof: {
        red: proof.red, files: proof.files,
        needles: [...new Map(proof.checks.map((c) => [c.needle, c])).values()].map((c) => ({ text: c.needle.slice(0, 160), files: c.files, touched: c.touched })) } } : {}) });
    }
    const big = bigUnitsOf(mainSha, cand.sha, repo);
    Object.assign(row, { bigUnits: big.run, bigUnitsWhy: big.why, bigUnitsLine: bigUnitsLine(big) });

    const run = await runOnHelper(helper, cand.sha, big.run, a.runner ?? RUNNER, repo);
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
    const red = redOf(run.out);
    const notApplicable = [...run.out.matchAll(/^na (\S+) — (.*)$/gm)].map((m) => `${m[1]}: ${m[2]}`);
    Object.assign(row, { jobs, modules, units, notApplicable, helperMs: runLine ? Number(runLine[2]) : null,
      ...(red.fails.length ? { fails: red.fails } : {}),
      run: /^run (\S+)/m.exec(run.out)?.[1] ?? null, helperWaitMs: Number(/^run \S+ wait=(\d+)/m.exec(run.out)?.[1] ?? 0) });
    if (!runLine) return finish("error", false, `der Helfer lieferte kein Urteil (${helper.kind === "ssh" ? "ssh" : "sh"} exit ${run.exit})`, 3);
    const verdict = runLine[1] === "green" ? "green" : "red";
    // PRÜF-GEDÄCHTNIS (server/pruef-siegel.ts): was dieser Check auf genau diesem Baum fuhr, bleibt als Siegel stehen und reist über den Hub.
    // Der Audit nach dem Land fährt dann nur die Lücke (dom und was der Check ausließ). Ein Rot wird mitgeschrieben und deckt nichts.
    await siegelDesChecks(repo, row, verdict, units, helper, env);
    const d = decide(verdict, state, proof?.ok === true, proof ? proof.why : undefined);
    return finish(verdict, d.mergeable, verdict === "red" ? red.why : d.why, d.code);
  } catch (e) {
    return finish("error", false, e instanceof Error ? e.message : String(e), 3);
  }
}

// Die Units stammen aus den `shard-unit`-Zeilen der Audit-Shards (units); Maschine und Plattform sind die des Helfers: lokal diese, über ssh
// der Host und `unbekannt` (die Plattform eines fremden Helfers kennt dieser Prozess nicht, und raten wäre schlimmer als das).
async function siegelDesChecks(repo: string, row: Record<string, unknown>, verdict: string, units: Record<string, number>, helper: Helper,
  env: Record<string, string | undefined>): Promise<void> {
  try {
    const tree = String(row.tree ?? "");
    const ran = Object.keys(units);
    if (!/^[0-9a-f]{40}$/.test(tree) || !ran.length) return;
    const lokal = helper.kind === "local";
    const maschine = lokal ? maschinenName(env) : maschinenName({ FLEET_MACHINE: helper.host.split("@").pop()!.split(".")[0]! });
    const lauf = String(row.run ?? "").split("/").filter(Boolean).pop() ?? `check-${String(row.at)}`;
    const ok = await schreibeSiegel(repo, { v: 1, tree, units: ran, tiefe: "check", ergebnis: verdict === "green" ? "green" : "red", maschine,
      plattform: lokal ? plattformHier() : { os: "unbekannt", arch: "-", bun: "-" }, lauf, at: Date.now() }, maschinenName(env));
    if (ok && git(["remote", "get-url", "hub"], undefined, repo).ok) await pushSiegel(repo, "hub", maschinenName(env));
  } catch (e) {
    console.error(`merge-check: kein Siegel: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const branch = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--base");
  const bi = argv.indexOf("--base");
  const base = bi >= 0 ? argv[bi + 1] : "main";
  const repair = argv.includes("--repair");
  if (!branch || !base) { console.error("bun ci/merge-check.ts <branch> [--base <ref>] [--repair]"); return 3; }
  return (await mergeCheck({ branch, base, repair })).code;
}
// KEIN VERSTECKTES REGELBUCH (E9, Owner 23.10.: „[Zitat entfernt]“
// ): was ein Sitz liest, steht in AGENTS.md, Verträgen und Packs. Der Kandidat trägt kein
// CLAUDE.md, und keine Pack-Quelle — Manifest oder Saat in context-packs.ts — zeigt auf eines.
const CLAUDE_MD = /(^|\/)CLAUDE\.md$/;
export function hiddenLayerOf(sha: string, dir = REPO_DIR): string[] {
  const found = mustGit(["ls-tree", "-r", "--name-only", sha], undefined, dir).split("\n")
    .filter((path) => CLAUDE_MD.test(path)).map((path) => `getracktes ${path}`);
  const manifest = git(["show", `${sha}:.fleet/context-packs.json`], undefined, dir);
  if (manifest.ok) {
    let packs: unknown;
    try { packs = JSON.parse(manifest.out); } catch { packs = []; }
    for (const pack of Array.isArray(packs) ? packs as { id?: unknown; sources?: { path?: unknown }[] }[] : [])
      for (const source of Array.isArray(pack.sources) ? pack.sources : [])
        if (typeof source.path === "string" && CLAUDE_MD.test(source.path))
          found.push(`Pack ${String(pack.id)} liest ${source.path} (.fleet/context-packs.json)`);
  }
  const seeds = git(["show", `${sha}:context-packs.ts`], undefined, dir);
  if (seeds.ok) for (const m of seeds.out.matchAll(/\bpath:\s*"([^"]*CLAUDE\.md)"/g))
    found.push(`eine Saat liest ${m[1]} (context-packs.ts)`);
  return found;
}

// Rot ist nie mergebar; grün bei rotem main nur mit belegtem repair
// `repairNote` ist der Beleg-Satz der Reparatur-Tür (ci/repair-proof.ts) — bei „nein“ sagt er, woran es
// fehlt, bei „ja“, was der Branch behebt. Fehlt er, bleibt der Text wie vor dem 27.10.
export function decide(run: "green" | "red", main: MainState, repair: boolean, repairNote?: string): { mergeable: boolean; code: number; why: string } {
  if (run === "red") return { mergeable: false, code: 1, why: "rot" };
  if (main.red && !repair) return { mergeable: false, code: 2, why: repairNote ? `${main.why}; ${repairNote}` : main.why };
  return { mergeable: true, code: 0, why: main.red ? `${main.why}; --repair: ${repairNote ?? "der Branch repariert es"}` : main.why };
}

if (import.meta.main) process.exit(await main());

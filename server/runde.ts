// DIE RUNDE — eine Testinstanz für die Branches einer Runde (Owner 22.10.: eine Instanz je Runde, „[Zitat entfernt]“; und: eine
// Instanz endet mit ihrem Branch, nicht mit ihrer TTL). Anlass: um 12:5x trieben sieben Instanzen, je Branch eine,
// den Mac auf Last 80, und der Owner sah eine Runde über mehrere Links.
//
// Eine Runde ist ein Wegwerf-Worktree ohne Branch (`<repo>.worktrees/runde-<name>`, detached): das main von jetzt,
// darauf die Branches der Runde in ihrer Reihenfolge zusammengeführt, je ein Merge-Commit, den nie ein Branch trägt.
// Ein Branch, der dabei kollidiert, bleibt draußen, und die Instanz nennt ihn mit Grund im Band. Gelandet wird
// weiter Branch für Branch über die Land-Tür; die Runde ist nur das Bild. Ihre Instanz ist die gewöhnliche
// Testinstanz dieses Worktrees (testinstanz.sh, Port aus dem Pfad), das Board zeigt sie unter dem Worktree.
//
// Der Takt (tickRounds, server.ts ruft ihn): bewegt sich main oder ein Branch der Runde, baut er sie neu
// (`testinstanz.sh refresh`: Port und Token bleiben, der Link hält). Ist jeder Branch fertig — gelandet bis zu
// seiner Spitze (das Branch-Buch sagt es), beendet oder beiseitegelegt —, endet die Instanz durch ihre Tür
// (`stop`: nicht, solange jemand schaut oder in den letzten zehn Minuten schaute, server/instanz-blick.ts), dann
// Worktree und Runde — aber nie ein Worktree, in dem eine Session sitzt oder der Änderungen trägt. Ein git-Fehler
// ist nie „Branch weg“: in einem solchen Takt endet und baut nichts.
//
// Fremdes fasst eine Runde nie an: Eine Runden-Datei gilt nur, wenn sie an ihrem eigenen Pfad liegt
// (roundPath, realpath), zum Repo des Takts gehört und ihr Worktree detached ist (validRound).
//
// Die Runde steht in `fleet-runde.json` im Git-Verzeichnis ihres Worktrees: kein Datei-Rest im Baum, und
// testinstanz.sh#ti_measure liest sie von dort für das Band.
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { GitResult } from "./branch-land";
import { findBranch, type BranchBook } from "./branches";

export const ROUND_FILE = "fleet-runde.json";
export const ROUND_MAIN = "main";
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export interface RoundIn { branch: string; head: string }
export interface RoundOut { branch: string; head: string | null; why: string }
export interface RoundBuild { main: string; commit: string; in: RoundIn[]; out: RoundOut[]; at: number }
export interface Round {
  name: string; repo: string; path: string; mode: "mixed" | "snapshot";
  branches: string[]; // in dieser Reihenfolge zusammengeführt
  built: RoundBuild | null; // was die Instanz zeigt
  failed: { key: string; at: number; why: string } | null; // ein Neubau, der rot war: erst ein neuer Stand versucht es wieder
  createdAt: number;
}

export type Git = (dir: string, ...args: string[]) => Promise<GitResult>;
export interface RoundDeps {
  git: Git;
  // <worktree>/testinstanz.sh mit diesen Argumenten (up, refresh, status)
  ti(worktree: string, args: string[]): Promise<{ code: number; out: string }>;
  // die Instanz durch ihre Tür beenden, mit Schonfrist (server/instanz-blick.ts); null = beendet, sonst warum sie steht
  stop(worktree: string): Promise<string | null>;
  install(worktree: string): Promise<{ code: number; out: string }>; // bun install --frozen-lockfile
  // was nur der Server weiß; null = unbekannt (tools/runde.ts ohne Server), und Unbekanntes beendet nichts
  landed(repo: string, branch: string, head: string): boolean | null; // Branch-Buch: letztes Land mit tip === head
  parked(repo: string, branch: string): Promise<boolean | null>; // beiseitegelegt (server.ts#shelved)
  held(worktree: string): boolean | null; // eine Session sitzt darin oder kommt gerade hinein (branch-ende.ts#heldBy)
  scaffold: readonly string[]; // ignorierte Pfade, die kein Werk sind (node_modules/, …)
  now(): number;
}

export function roundName(raw: string): string | null {
  return NAME_RE.test(raw) ? raw : null;
}
export const roundPath = (repo: string, name: string): string => `${repo}.worktrees/runde-${name}`;

const ok = (r: GitResult): string | null => (r.code === 0 ? r.out.trim() : null);
const realOf = (p: string): string => { try { return realpathSync(p); } catch { return resolve(p); } };
// DIE SPITZE EINES BRANCHES, und „es gibt ihn nicht“ getrennt von „git antwortet nicht“: show-ref endet mit 1, wenn
// kein Ref passt; alles andere (128, ein Abbruch unter Last) ist ein Fehler, nie „weg“
export type Head = string | "fehlt" | "fehler";
export async function headOf(git: Git, repo: string, branch: string): Promise<Head> {
  const ref = `refs/heads/${branch}`;
  const r = await git(repo, "show-ref", "--", ref);
  if (r.code === 1 && !r.out.trim()) return "fehlt";
  if (r.code !== 0) return "fehler";
  const sha = r.out.split("\n").map((l) => l.trim().split(" ")).find(([, name]) => name === ref)?.[0];
  return sha && SHA_RE.test(sha) ? sha : "fehlt";
}
const sha = (h: Head): string | null => (h === "fehlt" || h === "fehler" ? null : h);

// DAS ZUSAMMENFÜHREN, ohne Arbeitsbaum: `git merge-tree --write-tree` je Branch auf den bisherigen Stand, ein
// Merge-Commit mit beiden Eltern. Kollidiert ein Branch, bleibt er draußen; mit wem, sagen die Dateien: die
// Konfliktdateien gegen das, was jeder Branch davor seit main geändert hat. Liegt keiner davor, ist es main.
export async function buildRound(git: Git, repo: string, name: string, branches: readonly string[], at: number): Promise<RoundBuild | { error: string }> {
  const main = sha(await headOf(git, repo, ROUND_MAIN));
  if (!main) return { error: `${ROUND_MAIN} nicht lesbar` };
  let cur = main;
  const ins: RoundIn[] = [], outs: RoundOut[] = [];
  const touched = new Map<string, Set<string>>();
  for (const branch of branches) {
    const h = await headOf(git, repo, branch);
    if (h === "fehler") return { error: `${branch} nicht lesbar` };
    const head = sha(h);
    if (!head) { outs.push({ branch, head: null, why: "kein Branch dieses Namens" }); continue; }
    const m = await git(repo, "merge-tree", "--write-tree", "--name-only", "--no-messages", cur, head);
    const lines = m.out.split("\n").map((l) => l.trim()).filter(Boolean);
    if (m.code === 1) {
      // erst gegen main allein: kollidiert er schon dort, ist es main, auch wenn ein Branch davor dieselbe Datei ändert
      const alone = cur === main ? m : await git(repo, "merge-tree", "--write-tree", "--name-only", "--no-messages", main, head);
      const onMain = alone.code === 1;
      const files = (onMain ? alone.out : m.out).split("\n").map((l) => l.trim()).filter(Boolean).slice(1);
      const with_ = onMain ? [] : ins.filter((i) => files.some((f) => touched.get(i.branch)?.has(f))).map((i) => i.branch);
      const who = onMain ? ROUND_MAIN : with_.length ? with_.join(", ") : "den Branches davor";
      outs.push({ branch, head, why: `kollidiert mit ${who} in ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` und ${files.length - 3} weiteren` : ""}` });
      continue;
    }
    const tree = m.code === 0 ? lines[0] : undefined;
    if (!tree || !SHA_RE.test(tree)) return { error: `merge-tree für ${branch}: ${(m.err || m.out).slice(0, 200)}` };
    const commit = ok(await git(repo, "commit-tree", tree, "-p", cur, "-p", head, "-m", `Runde ${name}: ${branch} dazu`));
    if (!commit || !SHA_RE.test(commit)) return { error: `commit-tree für ${branch} ging nicht` };
    const diff = ok(await git(repo, "diff", "--name-only", `${main}...${head}`));
    touched.set(branch, new Set((diff ?? "").split("\n").filter(Boolean)));
    ins.push({ branch, head });
    cur = commit;
  }
  return { main, commit: cur, in: ins, out: outs, at };
}

// WAS SICH SEIT DEM BILD BEWEGT HAT: main oder die Spitze eines Branches der Runde, drin oder draußen
export function stateKey(main: string | null, heads: ReadonlyMap<string, string | null>, branches: readonly string[]): string {
  return [main ?? "-", ...branches.map((b) => `${b}=${heads.get(b) ?? "-"}`)].join(" ");
}
export function builtKey(r: Round): string | null {
  if (!r.built) return null;
  const heads = new Map<string, string | null>([...r.built.in.map((i) => [i.branch, i.head] as const), ...r.built.out.map((o) => [o.branch, o.head] as const)]);
  return stateKey(r.built.main, heads, r.branches);
}

// FERTIG ist ein Branch, wenn ihn niemand mehr zeigen muss: er ist weg (ein gelandeter Branch endet von selbst,
// server/branch-ende.ts), er ist beiseitegelegt, oder das Branch-Buch sagt, dass sein letztes Land genau seine
// Spitze war — in jeder Land-Form; eine Commit-Nachricht zählt nicht. Dass seine Spitze schon in main liegt,
// zählt auch nicht: ein frisch geöffneter Branch ohne Commit stünde sonst als gelandet da.
export function landedIn(book: BranchBook, repo: string, branch: string, head: string): boolean {
  return findBranch(book, repo, branch)?.lands.at(-1)?.tip === head;
}
export async function memberDone(d: RoundDeps, repo: string, branch: string, head: string | null): Promise<string | null> {
  if (!head) return "nicht mehr da";
  if (await d.parked(repo, branch)) return "beiseitegelegt";
  return d.landed(repo, branch, head) ? "gelandet" : null;
}

function gitDirOf(path: string): string | null {
  try {
    const dotgit = readFileSync(join(path, ".git"), "utf8"); // ein Worktree trägt eine Datei „gitdir: …“
    const m = /^gitdir: (.+)$/m.exec(dotgit);
    return m ? m[1].trim() : null;
  } catch { return null; }
}
export function readRound(path: string): Round | null {
  const gd = gitDirOf(path);
  if (!gd) return null;
  try {
    const v: unknown = JSON.parse(readFileSync(join(gd, ROUND_FILE), "utf8"));
    return v && typeof v === "object" && !Array.isArray(v) && typeof (v as Round).name === "string" ? v as Round : null;
  } catch { return null; }
}
export function writeRound(r: Round): void {
  const gd = gitDirOf(r.path);
  if (!gd) throw new Error(`${r.path} ist kein Worktree`);
  writeFileSync(join(gd, `${ROUND_FILE}.new`), JSON.stringify(r, null, 1));
  renameSync(join(gd, `${ROUND_FILE}.new`), join(gd, ROUND_FILE));
}
// EINER ZUR ZEIT je Runde: der Takt des Servers und ein `tools/runde.ts up` von Hand bauen sonst gleichzeitig in
// denselben Worktree. mkdir ist atomar; eine Sperre, deren Prozess nicht mehr lebt, wird übernommen.
export function lockRound(path: string): (() => void) | null {
  const gd = gitDirOf(path);
  if (!gd) return null;
  const dir = join(gd, `${ROUND_FILE}.lock`);
  const take = (): boolean => {
    try { mkdirSync(dir); writeFileSync(join(dir, "pid"), String(process.pid)); return true; } catch { return false; }
  };
  if (!take()) {
    let pid = NaN;
    try { pid = Number(readFileSync(join(dir, "pid"), "utf8")); } catch { /* noch ohne pid: gleich wie tot */ }
    let alive = Number.isInteger(pid) && pid > 1;
    if (alive) try { process.kill(pid, 0); } catch (e) { alive = e instanceof Error && "code" in e && e.code === "EPERM"; }
    if (alive) return null;
    rmSync(dir, { recursive: true, force: true });
    if (!take()) return null;
  }
  return () => rmSync(dir, { recursive: true, force: true });
}
// GILT DIESE RUNDEN-DATEI? Nur an ihrem eigenen Pfad, im Repo des Takts, in einem detached Worktree, mit lesbaren
// Feldern. Sonst ist sie veraltet oder fremd, und ein Takt darf dort weder auschecken noch etwas beenden.
export async function validRound(git: Git, repo: string, at: string, r: Round): Promise<string | null> {
  if (!roundName(String(r.name))) return "Name ungültig";
  if (!Array.isArray(r.branches) || !r.branches.every((b) => typeof b === "string")) return "Branches unlesbar";
  if (r.mode !== "mixed" && r.mode !== "snapshot") return "Modus unlesbar";
  if (typeof r.repo !== "string" || realOf(r.repo) !== realOf(repo)) return `gehört zu ${String(r.repo)}, nicht zu ${repo}`;
  const own = roundPath(repo, r.name);
  if (typeof r.path !== "string" || realOf(r.path) !== realOf(own) || realOf(at) !== realOf(own)) return `liegt nicht an ${own}`;
  const head = await git(at, "symbolic-ref", "-q", "HEAD");
  if (head.code === 0) return `der Worktree steht auf ${head.out.trim()}, nicht detached`;
  if (head.code !== 1) return "HEAD des Worktrees nicht lesbar";
  return null;
}
// jede gültige Runde des Repos: die Worktrees, deren Git-Verzeichnis eine Runde trägt; ungültige mit Grund
export async function listRounds(git: Git, repo: string): Promise<{ rounds: Round[]; skipped: string[] }> {
  const rounds: Round[] = [], skipped: string[] = [];
  const common = ok(await git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir"));
  if (!common) return { rounds, skipped };
  let names: string[];
  try { names = readdirSync(join(common, "worktrees")); } catch { return { rounds, skipped }; }
  for (const n of names) {
    const gd = join(common, "worktrees", n);
    if (!existsSync(join(gd, ROUND_FILE))) continue;
    let path: string;
    try { path = dirname(readFileSync(join(gd, "gitdir"), "utf8").trim()); } // gitdir zeigt auf <worktree>/.git
    catch { continue; } // ein verwaister Eintrag: git worktree prune räumt ihn
    const r = readRound(path);
    const bad = r ? await validRound(git, repo, path, r) : "Runden-Datei unlesbar";
    if (bad || !r) skipped.push(`${path}: übersprungen, ${bad}`);
    else rounds.push(r);
  }
  return { rounds, skipped };
}

export async function instanceAlive(d: RoundDeps, path: string): Promise<boolean> {
  return /"procStatus":"alive"/.test((await d.ti(path, ["status", "--json"])).out);
}
// Die TTL ist für eine Runde die längste, die testinstanz.sh kennt: sie endet mit ihren Branches (tickRounds).
const ROUND_TTL_MIN = "1440";
async function startOrRefresh(d: RoundDeps, r: Round): Promise<{ code: number; how: string }> {
  if (await instanceAlive(d, r.path)) return { code: (await d.ti(r.path, ["refresh"])).code, how: "refresh" };
  return { code: (await d.ti(r.path, ["up", ...(r.mode === "snapshot" ? ["snapshot"] : []), "--ttl", ROUND_TTL_MIN])).code, how: "up" };
}

// DAS BILD NEU: zusammenführen, den Worktree auf den neuen Stand, die Runde schreiben, dann die Instanz.
// Läuft sie, `refresh` (Port und Token bleiben); läuft sie nicht, `up`. Ein roter Bau lässt die alte Instanz
// stehen und die Runde auf ihrem alten Bild; `failed` hält fest, welcher Stand rot war.
export async function rebuild(d: RoundDeps, r: Round): Promise<{ round: Round; did: string }> {
  const b = await buildRound(d.git, r.repo, r.name, r.branches, d.now());
  if ("error" in b) return { round: r, did: `nicht gebaut: ${b.error}` };
  const key = stateKey(b.main, new Map([...b.in.map((i) => [i.branch, i.head] as const), ...b.out.map((o) => [o.branch, o.head] as const)]), r.branches);
  // ein Stand, der nicht ging, wird erst mit einem neuen wieder versucht (`failed`): sonst jede Minute dieselbe Zeile
  const mark = (why: string, word: string): { round: Round; did: string } => {
    const round = { ...r, failed: { key, at: d.now(), why } };
    writeRound(round);
    return { round, did: `${word}: ${why}` };
  };
  const dirty = await d.git(r.path, "status", "--porcelain");
  if (dirty.code !== 0 || dirty.out.trim()) return mark("der Runden-Worktree hat Änderungen", "nicht gebaut");
  const prev = ok(await d.git(r.path, "rev-parse", "HEAD"));
  const co = await d.git(r.path, "checkout", "-q", "--detach", b.commit);
  if (co.code !== 0) return mark(`checkout ${co.err.slice(0, 200)}`, "nicht gebaut");
  const fail = async (why: string): Promise<{ round: Round; did: string }> => {
    if (prev) await d.git(r.path, "checkout", "-q", "--detach", prev);
    return mark(why, "rot");
  };
  const inst = await d.install(r.path);
  if (inst.code !== 0) return fail(`bun install exit ${inst.code}`);
  const next: Round = { ...r, built: b, failed: null };
  writeRound(next); // vor dem Bau: ti_measure liest daraus das Band
  const run = await startOrRefresh(d, r);
  if (run.code !== 0) return fail(`testinstanz.sh ${run.how} exit ${run.code}`);
  return { round: next, did: `gebaut: ${b.in.map((i) => i.branch).join(", ") || "nur main"}${b.out.length ? ` · draußen ${b.out.map((o) => o.branch).join(", ")}` : ""}` };
}

// DAS ENDE einer Runde, mit denselben Halten wie branch-ende.ts: keine Session darin, keine Änderung, keine
// ignorierte Datei außer dem Gerüst. Dann die Instanz durch ihre Tür, dann Worktree und Runde. `manual` (tools/runde.ts
// down) darf ohne Server enden, wo keiner sagen kann, ob eine Session darin sitzt; `force` beendet die Instanz auch,
// wenn jemand schaut — Änderungen im Worktree hält beides nicht weg.
export async function endRound(d: RoundDeps, r: Round, o: { manual?: boolean; force?: boolean } = {}): Promise<string | null> {
  const held = d.held(r.path);
  if (held) return "eine Session sitzt im Runden-Worktree";
  if (held === null && !o.manual) return "ob eine Session im Runden-Worktree sitzt, weiß nur der Server";
  const st = await d.git(r.path, "status", "--porcelain", "--ignored");
  if (st.code !== 0) return "Stand des Runden-Worktrees nicht lesbar";
  const lines = st.out.split("\n").filter(Boolean);
  if (lines.some((l) => !l.startsWith("!! "))) return "Änderungen im Runden-Worktree";
  const stray = lines.map((l) => l.slice(3)).filter((x) => !d.scaffold.includes(x));
  if (stray.length) return `ignorierte Dateien im Runden-Worktree: ${stray.slice(0, 5).join(", ")}`;
  if (existsSync(join(r.path, "testinstanz.sh"))) {
    if (o.force) {
      const down = await d.ti(r.path, ["down", "--force"]);
      if (down.code !== 0) return `testinstanz.sh down --force exit ${down.code}`;
    } else {
      const stays = await d.stop(r.path);
      if (stays) return stays;
    }
  }
  // ohne --force: was git noch für ungesichert hält, lässt den Worktree stehen (das Gerüst ist ignoriert und geht mit)
  const rm = await d.git(r.repo, "worktree", "remove", r.path);
  return rm.code === 0 ? null : `Worktree blieb: ${(rm.err || rm.out).slice(0, 200)}`;
}

// EIN TAKT über die Runden eines Repos. Je Runde eine Zeile, was geschah.
export async function tickRounds(d: RoundDeps, repo: string): Promise<string[]> {
  const { rounds, skipped } = await listRounds(d.git, repo);
  const lines: string[] = [...skipped];
  for (const r of rounds) {
    const unlock = lockRound(r.path);
    if (!unlock) { lines.push(`${r.name}: wird gerade gebaut`); continue; }
    try { lines.push(await tickOne(d, repo, r)); } finally { unlock(); }
  }
  return lines;
}
async function tickOne(d: RoundDeps, repo: string, r: Round): Promise<string> {
  const main = await headOf(d.git, repo, ROUND_MAIN);
  const raw = new Map<string, Head>();
  for (const b of r.branches) raw.set(b, await headOf(d.git, repo, b));
  // git antwortet nicht: das ist nie „Branch weg“, und in diesem Takt endet und baut nichts
  if (main === "fehler" || main === "fehlt" || [...raw.values()].includes("fehler")) return `${r.name}: git nicht lesbar, dieser Takt tut nichts`;
  const heads = new Map<string, string | null>([...raw].map(([b, h]) => [b, sha(h)]));
  const done: string[] = [];
  for (const b of r.branches) {
    const why = await memberDone(d, repo, b, heads.get(b) ?? null);
    if (why) done.push(`${b} ${why}`);
  }
  if (r.branches.length && done.length === r.branches.length) {
    const kept = await endRound(d, r);
    return kept ? `${r.name}: fertig (${done.join(", ")}), bleibt: ${kept}` : `${r.name}: beendet (${done.join(", ")})`;
  }
  const key = stateKey(main, heads, r.branches);
  if (key === builtKey(r)) {
    // ihre Instanz ging (TTL, Neustart des Rechners), die Runde nicht: sie kommt mit demselben Bild wieder — einmal je Stand
    if (await instanceAlive(d, r.path)) return `${r.name}: unverändert`;
    if (r.failed?.key === key) return `${r.name}: Instanz ließ sich mit diesem Stand nicht aufstellen (${r.failed.why}), wartet auf einen neuen`;
    const run = await startOrRefresh(d, r);
    if (run.code === 0) return `${r.name}: Instanz wieder aufgestellt`;
    writeRound({ ...r, failed: { key, at: d.now(), why: `testinstanz.sh ${run.how} exit ${run.code}` } });
    return `${r.name}: Instanz ließ sich nicht aufstellen (exit ${run.code})`;
  }
  if (r.failed?.key === key) return `${r.name}: dieser Stand ging nicht (${r.failed.why}), wartet auf einen neuen`;
  return `${r.name}: ${(await rebuild(d, r)).did}`;
}

// EINE RUNDE AUFSTELLEN oder ihre Branches neu setzen: der Worktree entsteht detached auf main, dann ein Bau.
export async function upRound(d: RoundDeps, o: { repo: string; name: string; branches: readonly string[]; mode: Round["mode"] }): Promise<{ round: Round; did: string } | { error: string }> {
  const name = roundName(o.name);
  if (!name) return { error: "Name: Kleinbuchstaben, Ziffern und -, höchstens 40 Zeichen" };
  if (!o.branches.length) return { error: "eine Runde braucht mindestens einen Branch" };
  if (new Set(o.branches).size !== o.branches.length) return { error: "ein Branch steht doppelt in der Runde" };
  const path = roundPath(o.repo, name);
  const have = readRound(path);
  if (!have && existsSync(path)) return { error: `${path} gibt es schon und ist keine Runde` };
  const bad = have ? await validRound(d.git, o.repo, path, have) : null;
  if (bad) return { error: `${path}: ${bad}` };
  if (!have) {
    const main = sha(await headOf(d.git, o.repo, ROUND_MAIN));
    if (!main) return { error: `${ROUND_MAIN} nicht lesbar` };
    const add = await d.git(o.repo, "worktree", "add", "-q", "--detach", path, main);
    if (add.code !== 0) return { error: `worktree add: ${add.err.slice(0, 200)}` };
  }
  const unlock = lockRound(path);
  if (!unlock) return { error: "die Runde wird gerade gebaut" };
  try {
    const round: Round = { name, repo: o.repo, path, mode: o.mode, branches: [...o.branches],
      built: have?.built ?? null, failed: null, createdAt: have?.createdAt ?? d.now() };
    writeRound(round);
    return await rebuild(d, round);
  } finally { unlock(); }
}

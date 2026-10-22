// Eine Instanz je Runde (Owner 22.10.): die Branches einer Runde gemeinsam auf dem main von jetzt, neu gebaut,
// wenn sich einer bewegt; ein kollidierender bleibt draußen und die Runde sagt warum; sie endet, wenn jeder
// Branch fertig ist, außer jemand schaut. Echtes git in einem Temp-Repo; testinstanz.sh und bun install sind
// eingereicht, weil sie eine ganze Fleet-Instanz bauen.
import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitResult } from "./branch-land";
import type { BranchRecord } from "./branches";
import { buildRound, endRound, headOf, landedIn, listRounds, lockRound, readRound, tickRounds, upRound, writeRound, type RoundDeps } from "./runde";

// echtes git, viele Aufrufe je Test: unter Last (Mac bei 20–30) reichen die 5 s von bun nicht
setDefaultTimeout(60_000);
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-runde-")));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
function run(dir: string, args: string[]): GitResult {
  const r = Bun.spawnSync(["git", "-C", dir, ...args], { env: ENV });
  return { out: r.stdout.toString().trim(), err: r.stderr.toString().trim(), code: r.exitCode };
}
const sh = (dir: string, ...args: string[]): string => {
  const r = run(dir, args);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err}`);
  return r.out;
};
// ein Commit auf `branch` (angelegt ab main, wenn es ihn noch nicht gibt), ohne Worktree: über einen Wegwerf-Index
function commitOn(repo: string, branch: string, file: string, text: string): string {
  const exists = run(repo, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).code === 0;
  const parent = sh(repo, "rev-parse", exists ? branch : "main");
  const idx = join(TMP, `idx-${Math.random().toString(36).slice(2)}`);
  const env = { ...ENV, GIT_INDEX_FILE: idx };
  const g = (...a: string[]): string => {
    const r = Bun.spawnSync(["git", "-C", repo, ...a], { env, stdin: "ignore" });
    if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr}`);
    return r.stdout.toString().trim();
  };
  g("read-tree", parent);
  const blob = Bun.spawnSync(["git", "-C", repo, "hash-object", "-w", "--stdin"], { env, stdin: new TextEncoder().encode(text) }).stdout.toString().trim();
  g("update-index", "--add", "--cacheinfo", `100644,${blob},${file}`);
  const tree = g("write-tree");
  const c = g("commit-tree", tree, "-p", parent, "-m", `${branch}: ${file}`);
  sh(repo, "update-ref", `refs/heads/${branch}`, c);
  rmSync(idx, { force: true });
  return c;
}

let n = 0;
function world(o: { tiCode?: (args: string[]) => number; looking?: boolean; parked?: string[]; landed?: Record<string, string>;
  held?: boolean | null; gitFails?: (args: string[]) => boolean } = {}) {
  const repo = join(TMP, `r${++n}`);
  Bun.spawnSync(["mkdir", "-p", repo]);
  sh(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "README"), "eins\nzwei\ndrei\n");
  writeFileSync(join(repo, "testinstanz.sh"), "#!/bin/sh\n");
  sh(repo, "add", "README", "testinstanz.sh");
  sh(repo, "commit", "-q", "-m", "start");
  const calls: string[] = [];
  let alive = false;
  const d: RoundDeps = {
    git: async (dir, ...args) => (o.gitFails?.(args) ? { out: "", err: "fatal: unter Last", code: 128 } : run(dir, args)),
    ti: async (_wt, args) => {
      calls.push(args.join(" "));
      if (args[0] === "status") return { code: 0, out: `{"procStatus":"${alive ? "alive" : "unknown"}"}` };
      const code = o.tiCode?.(args) ?? 0;
      if (code === 0 && args[0] === "up") alive = true;
      if (code === 0 && args[0] === "down") alive = false;
      return { code, out: "" };
    },
    stop: async () => {
      calls.push("stop");
      if (o.looking) return "jemand schaut in die Testinstanz";
      alive = false;
      return null;
    },
    install: async () => ({ code: 0, out: "" }),
    landed: (_r, b, head) => o.landed?.[b] === head,
    parked: async (_r, b) => (o.parked ?? []).includes(b),
    held: () => (o.held === undefined ? false : o.held),
    scaffold: ["node_modules/"],
    now: () => 1000,
  };
  return { repo, d, calls, kill: () => { alive = false; } };
}
const files = (repo: string, commit: string): string => sh(repo, "ls-tree", "-r", "--name-only", commit);

describe("buildRound: die Branches einer Runde auf dem main von jetzt", () => {
  test("zwei Branches, die sich nicht berühren: beide drin, der Stand trägt die Dateien beider und main", async () => {
    const w = world();
    const a = commitOn(w.repo, "branch/a", "a.txt", "a\n"), b = commitOn(w.repo, "branch/b", "b.txt", "b\n");
    const r = await buildRound(w.d.git, w.repo, "x", ["branch/a", "branch/b"], 1);
    if ("error" in r) throw new Error(r.error);
    expect(r.in).toEqual([{ branch: "branch/a", head: a }, { branch: "branch/b", head: b }]);
    expect(r.out).toEqual([]);
    expect(files(w.repo, r.commit).split("\n")).toEqual(["README", "a.txt", "b.txt", "testinstanz.sh"]);
    expect(r.main).toBe(sh(w.repo, "rev-parse", "main"));
    // kein Branch trägt den Runden-Stand, und keiner hat sich bewegt
    expect([sh(w.repo, "rev-parse", "branch/a"), sh(w.repo, "rev-parse", "branch/b")]).toEqual([a, b]);
  });
  test("ein Branch, der mit einem davor kollidiert, bleibt draußen, mit dem anderen und der Datei als Grund", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "README", "A\nzwei\ndrei\n");
    const c = commitOn(w.repo, "branch/c", "README", "C\nzwei\ndrei\n");
    commitOn(w.repo, "branch/b", "b.txt", "b\n");
    const r = await buildRound(w.d.git, w.repo, "x", ["branch/a", "branch/c", "branch/b"], 1);
    if ("error" in r) throw new Error(r.error);
    expect(r.in.map((i) => i.branch)).toEqual(["branch/a", "branch/b"]);
    expect(r.out).toEqual([{ branch: "branch/c", head: c, why: "kollidiert mit branch/a in README" }]);
  });
  test("ein Branch, der mit main kollidiert, sagt main; ein fehlender sagt, dass es ihn nicht gibt", async () => {
    const w = world();
    commitOn(w.repo, "branch/c", "README", "C\nzwei\ndrei\n");
    commitOn(w.repo, "main", "README", "M\nzwei\ndrei\n");
    const r = await buildRound(w.d.git, w.repo, "x", ["branch/c", "branch/weg"], 1);
    if ("error" in r) throw new Error(r.error);
    expect(r.out.map((o) => o.why)).toEqual(["kollidiert mit main in README", "kein Branch dieses Namens"]);
    expect(r.commit).toBe(sh(w.repo, "rev-parse", "main"));
  });
  test("kollidiert er schon mit main, heißt es main, auch wenn ein Branch davor dieselbe Datei ändert", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "README", "eins\nzwei\nA\n");
    commitOn(w.repo, "branch/c", "README", "C\nzwei\ndrei\n");
    commitOn(w.repo, "main", "README", "M\nzwei\ndrei\n");
    const r = await buildRound(w.d.git, w.repo, "x", ["branch/a", "branch/c"], 1);
    if ("error" in r) throw new Error(r.error);
    expect(r.in.map((i) => i.branch)).toEqual(["branch/a"]);
    expect(r.out.map((o) => o.why)).toEqual(["kollidiert mit main in README"]);
  });
});

describe("upRound und tickRounds: eine Instanz, die mit ihrer Runde lebt", () => {
  test("up: ein detached Worktree neben dem Repo, auf dem Runden-Stand, die Runde im Git-Verzeichnis, eine Instanz mit langer TTL", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    commitOn(w.repo, "branch/b", "b.txt", "b\n");
    const up = await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a", "branch/b"], mode: "mixed" });
    if ("error" in up) throw new Error(up.error);
    const path = `${w.repo}.worktrees/runde-probe`;
    expect(up.round.path).toBe(path);
    expect(sh(path, "rev-parse", "HEAD")).toBe(up.round.built?.commit ?? "");
    expect(run(path, ["symbolic-ref", "-q", "HEAD"]).code).toBe(1); // detached: kein Branch
    expect(sh(path, "status", "--porcelain")).toBe(""); // die Runde liegt nicht im Baum
    expect(readRound(path)?.built?.in.map((i) => i.branch)).toEqual(["branch/a", "branch/b"]);
    expect(w.calls.filter((c) => !c.startsWith("status"))).toEqual(["up --ttl 1440"]);
    expect((await listRounds(w.d.git, w.repo)).rounds.map((r) => r.name)).toEqual(["probe"]);
  });
  test("ein Commit auf einem Branch: der nächste Takt baut neu (refresh, der Link hält); ohne Bewegung baut er nichts", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    w.calls.length = 0;
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: unverändert"]);
    const a2 = commitOn(w.repo, "branch/a", "a2.txt", "a2\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: gebaut: branch/a"]);
    expect(w.calls.filter((c) => !c.startsWith("status"))).toEqual(["refresh"]);
    const path = `${w.repo}.worktrees/runde-probe`;
    expect(readRound(path)?.built?.in).toEqual([{ branch: "branch/a", head: a2 }]);
    expect(files(w.repo, sh(path, "rev-parse", "HEAD"))).toContain("a2.txt");
  });
  test("main bewegt sich: der Takt baut neu, auf dem neuen main", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    const m = commitOn(w.repo, "main", "m.txt", "m\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: gebaut: branch/a"]);
    expect(readRound(`${w.repo}.worktrees/runde-probe`)?.built?.main).toBe(m);
  });
  test("ein roter Bau lässt die Instanz und ihr Bild stehen und versucht denselben Stand nicht jede Minute wieder", async () => {
    let red = false;
    const w = world({ tiCode: (a) => (red && a[0] === "refresh" ? 1 : 0) });
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    const up = await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    if ("error" in up) throw new Error(up.error);
    const path = `${w.repo}.worktrees/runde-probe`;
    red = true;
    commitOn(w.repo, "branch/a", "kaputt.txt", "x\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: rot: testinstanz.sh refresh exit 1"]);
    expect(readRound(path)?.built).toEqual(up.round.built);
    expect(sh(path, "rev-parse", "HEAD")).toBe(up.round.built?.commit ?? "");
    expect((await tickRounds(w.d, w.repo))[0]).toStartWith("probe: dieser Stand ging nicht");
    red = false;
    commitOn(w.repo, "branch/a", "heil.txt", "y\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: gebaut: branch/a"]);
  });
  test("ein schmutziger Runden-Worktree: einmal gemeldet, dann wartet er auf einen neuen Stand statt jede Minute dasselbe zu sagen", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    const up = await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    if ("error" in up) throw new Error(up.error);
    writeFileSync(join(up.round.path, "README"), "von Hand\n");
    commitOn(w.repo, "branch/a", "a2.txt", "a\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: nicht gebaut: der Runden-Worktree hat Änderungen"]);
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: dieser Stand ging nicht (der Runden-Worktree hat Änderungen), wartet auf einen neuen"]);
  });
  test("ließ sich die Instanz nicht wieder aufstellen, versucht der Takt denselben Stand nicht jede Minute wieder", async () => {
    let broken = false;
    const w = world({ tiCode: (a) => (broken && a[0] === "up" ? 1 : 0) });
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    w.kill();
    broken = true;
    w.calls.length = 0;
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: Instanz ließ sich nicht aufstellen (exit 1)"]);
    expect((await tickRounds(w.d, w.repo))[0]).toStartWith("probe: Instanz ließ sich mit diesem Stand nicht aufstellen");
    expect(w.calls.filter((c) => c.startsWith("up"))).toEqual(["up --ttl 1440"]);
  });
  test("ging die Instanz (TTL), die Runde aber nicht: der Takt stellt sie mit demselben Bild wieder auf", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    w.kill();
    w.calls.length = 0;
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: Instanz wieder aufgestellt"]);
    expect(w.calls.filter((c) => !c.startsWith("status"))).toEqual(["up --ttl 1440"]);
  });
  test("jeder Branch gelandet (das Branch-Buch: letztes Land mit tip = Spitze) oder beiseitegelegt: Instanz durch ihre Tür, Worktree und Runde weg", async () => {
    const landed: Record<string, string> = {};
    const w = world({ landed, parked: ["branch/b"] });
    landed["branch/a"] = commitOn(w.repo, "branch/a", "a.txt", "a\n");
    commitOn(w.repo, "branch/b", "b.txt", "b\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a", "branch/b"], mode: "mixed" });
    w.calls.length = 0;
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: beendet (branch/a gelandet, branch/b beiseitegelegt)"]);
    expect(w.calls).toEqual(["stop"]);
    expect(existsSync(`${w.repo}.worktrees/runde-probe`)).toBe(false);
    expect((await listRounds(w.d.git, w.repo)).rounds).toEqual([]);
  });
  test("bleibt: jemand schaut in die Instanz — down verweigert, Worktree und Runde stehen", async () => {
    const w = world({ looking: true });
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    sh(w.repo, "branch", "-D", "branch/a"); // beendet nach seinem Land
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: fertig (branch/a nicht mehr da), bleibt: jemand schaut in die Testinstanz"]);
    expect(existsSync(`${w.repo}.worktrees/runde-probe`)).toBe(true);
  });
  test("bleibt: ein Branch ohne Commit (seine Spitze liegt in main) ist nicht gelandet, ein Commit nach dem Land auch nicht", async () => {
    const landed: Record<string, string> = {};
    const w = world({ landed });
    sh(w.repo, "branch", "branch/leer", "main");
    const a = commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/leer"], mode: "mixed" });
    await upRound(w.d, { repo: w.repo, name: "zwei", branches: ["branch/a"], mode: "mixed" });
    landed["branch/a"] = a; // gelandet bis a …
    commitOn(w.repo, "branch/a", "mehr.txt", "m\n"); // … und dann weitergebaut
    const lines = await tickRounds(w.d, w.repo);
    expect(lines.sort()).toEqual(["probe: unverändert", "zwei: gebaut: branch/a"]);
    expect(w.calls).not.toContain("stop");
  });
  test("verweigert: ein Name mit Großbuchstaben, keine Branches, ein Branch doppelt, ein fremder Ordner am Runden-Pfad", async () => {
    const w = world();
    const up = (name: string, branches: string[]) => upRound(w.d, { repo: w.repo, name, branches, mode: "mixed" });
    expect(await up("Probe", ["main"])).toEqual({ error: "Name: Kleinbuchstaben, Ziffern und -, höchstens 40 Zeichen" });
    expect(await up("p", [])).toEqual({ error: "eine Runde braucht mindestens einen Branch" });
    expect(await up("p", ["branch/a", "branch/a"])).toEqual({ error: "ein Branch steht doppelt in der Runde" });
    Bun.spawnSync(["mkdir", "-p", `${w.repo}.worktrees/runde-fremd`]);
    expect(await up("fremd", ["main"])).toEqual({ error: `${w.repo}.worktrees/runde-fremd gibt es schon und ist keine Runde` });
  });
  test("eine Runde baut nur einer: hält jemand die Sperre, sagt der Takt es und lässt sie stehen", async () => {
    const w = world();
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    const unlock = lockRound(`${w.repo}.worktrees/runde-probe`);
    commitOn(w.repo, "branch/a", "a2.txt", "a\n");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: wird gerade gebaut"]);
    unlock?.();
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: gebaut: branch/a"]);
  });
});

// Abnahme 22.10. (Pflichten 2a, 2b, 3, 4): fremde Arbeit wird nie gelöscht, „gelandet“ sagt das Branch-Buch,
// und ein git-Fehler ist nie „Branch weg“
describe("das Ende fasst nichts Fremdes an", () => {
  async function ready(o: Parameters<typeof world>[0] = {}) {
    const w = world(o);
    commitOn(w.repo, "branch/a", "a.txt", "a\n");
    const up = await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" });
    if ("error" in up) throw new Error(up.error);
    w.calls.length = 0;
    return { ...w, round: up.round, path: up.round.path };
  }
  const stays = async (w: Awaited<ReturnType<typeof ready>>, why: string) => {
    expect(await endRound(w.d, w.round)).toBe(why);
    expect(existsSync(w.path)).toBe(true);
    expect(w.calls).not.toContain("stop");
  };
  test("eine Session sitzt im Runden-Worktree: er bleibt, die Instanz auch", async () => {
    await stays(await ready({ held: true }), "eine Session sitzt im Runden-Worktree");
  });
  test("ohne Server weiß keiner, ob eine Session darin sitzt: der Takt beendet nichts, `down` von Hand schon", async () => {
    const w = await ready({ held: null });
    await stays(w, "ob eine Session im Runden-Worktree sitzt, weiß nur der Server");
    expect(await endRound(w.d, w.round, { manual: true })).toBeNull();
    expect(existsSync(w.path)).toBe(false);
  });
  test("eine geänderte Datei, eine neue Datei, eine ignorierte außer dem Gerüst: er bleibt; node_modules/ hält ihn nicht", async () => {
    const w = await ready();
    writeFileSync(join(w.path, "README"), "geändert\n");
    await stays(w, "Änderungen im Runden-Worktree");
    sh(w.path, "checkout", "--", "README");
    writeFileSync(join(w.path, "neu.txt"), "n\n");
    await stays(w, "Änderungen im Runden-Worktree");
    rmSync(join(w.path, "neu.txt"));
    writeFileSync(join(TMP, `ex${n}`), "node_modules/\ndrops/\n");
    sh(w.repo, "config", "core.excludesFile", join(TMP, `ex${n}`));
    Bun.spawnSync(["mkdir", "-p", join(w.path, "node_modules"), join(w.path, "drops")]);
    writeFileSync(join(w.path, "node_modules", "m.js"), "");
    writeFileSync(join(w.path, "drops", "bild.png"), "png");
    await stays(w, "ignorierte Dateien im Runden-Worktree: drops/");
    rmSync(join(w.path, "drops"), { recursive: true });
    expect(await endRound(w.d, w.round)).toBeNull();
    expect(existsSync(w.path)).toBe(false);
  });
  test("eine Runden-Datei im Worktree einer Lane: übersprungen und gemeldet, dort wird weder beendet noch ausgecheckt", async () => {
    const w = await ready();
    const lane = `${w.repo}.worktrees/lane`;
    sh(w.repo, "worktree", "add", "-q", "-b", "branch/lane", lane);
    const head = sh(lane, "rev-parse", "HEAD");
    sh(w.repo, "branch", "-D", "branch/a"); // die echte Runde wäre damit fertig — sie bleibt dafür unberührt
    writeRound({ ...w.round, path: lane, branches: ["branch/weg"] }); // eine veraltete Datei: schreibt in die Lane
    const lines = await tickRounds({ ...w.d, held: () => true }, w.repo);
    expect(lines.filter((l) => l.includes("übersprungen"))).toEqual([`${lane}: übersprungen, liegt nicht an ${w.repo}.worktrees/runde-probe`]);
    expect([existsSync(lane), sh(lane, "rev-parse", "HEAD"), w.calls.includes("stop")]).toEqual([true, head, false]);
  });
  test("eine Runden-Datei am eigenen Pfad, aber der Worktree steht auf einem Branch, oder sie nennt ein anderes Repo: übersprungen", async () => {
    const w = await ready();
    sh(w.path, "checkout", "-q", "-b", "branch/jemand");
    expect((await listRounds(w.d.git, w.repo)).skipped).toEqual([`${w.path}: übersprungen, der Worktree steht auf refs/heads/branch/jemand, nicht detached`]);
    sh(w.path, "checkout", "-q", "--detach");
    writeRound({ ...w.round, repo: "/anderes/repo" });
    expect((await listRounds(w.d.git, w.repo)).skipped).toEqual([`${w.path}: übersprungen, gehört zu /anderes/repo, nicht zu ${w.repo}`]);
    expect(await upRound(w.d, { repo: w.repo, name: "probe", branches: ["branch/a"], mode: "mixed" }))
      .toEqual({ error: `${w.path}: gehört zu /anderes/repo, nicht zu ${w.repo}` });
  });
  test("git antwortet nicht (exit 128 unter Last): nie „Branch weg“, dieser Takt beendet und baut nichts", async () => {
    let failing = false;
    const w = await ready({ gitFails: (a) => failing && a[0] === "show-ref" && a.at(-1) === "refs/heads/branch/a" });
    failing = true;
    expect(await headOf(w.d.git, w.repo, "branch/a")).toBe("fehler");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: git nicht lesbar, dieser Takt tut nichts"]);
    expect([existsSync(w.path), w.calls]).toEqual([true, []]);
    failing = false;
    sh(w.repo, "branch", "-D", "branch/a");
    expect(await headOf(w.d.git, w.repo, "branch/a")).toBe("fehlt");
    expect(await tickRounds(w.d, w.repo)).toEqual(["probe: beendet (branch/a nicht mehr da)"]);
  });
});

describe("landedIn: gelandet heißt, das letzte Land im Branch-Buch war genau diese Spitze", () => {
  const TIP = "a".repeat(40), LATER = "b".repeat(40);
  const rec = (lands: BranchRecord["lands"]): BranchRecord => ({ repo: "/r", branch: "branch/x", name: "X", base: null, text: "", rev: 0,
    seen: null, lands, createdAt: 0, updatedAt: 0 });
  // form commits: main sprang auf den Kandidaten des Merge-Checks, `sha` ist dessen Spitze, keine Charge-Nachricht
  const commits = { sha: "c".repeat(40), at: 1, tip: TIP, base: "main", subject: "x", points: [], passt: true, checked: true, form: "commits" as const };
  test("Land-Form commits, tip = Spitze: gelandet", () => {
    expect(landedIn([rec([commits])], "/r", "branch/x", TIP)).toBe(true);
  });
  test("ein Commit nach dem Land, ein anderes Repo, ein Branch ohne Land, ein Branch ohne Datensatz: nicht gelandet", () => {
    expect(landedIn([rec([commits])], "/r", "branch/x", LATER)).toBe(false);
    expect(landedIn([rec([commits])], "/s", "branch/x", TIP)).toBe(false);
    expect(landedIn([rec([])], "/r", "branch/x", TIP)).toBe(false);
    expect(landedIn([], "/r", "branch/x", TIP)).toBe(false);
  });
  test("es zählt das letzte Land, nicht ein früheres mit derselben Spitze", () => {
    expect(landedIn([rec([commits, { ...commits, tip: LATER }])], "/r", "branch/x", TIP)).toBe(false);
  });
});

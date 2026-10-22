// Ein gelandeter Branch endet von selbst (Owner 22.10.: „[Zitat entfernt]“
// ),
// aber nur, wenn seit dem Land nichts dazukam, keine Session in seinem Worktree sitzt und keine Testinstanz
// daraus läuft. Hier die Regel und der Durchgang mit echtem git in einem Temp-Repo, Slots und Log eingereicht;
// server/branches-ende.test.ts fährt beides im Server.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { endLandedBranches, endVerdict, heldBy, type EndDeps, type EndFacts, type EndHolds } from "./branch-ende";
import type { GitResult } from "./branch-land";
import type { BranchLand, BranchRecord } from "./branches";

const TIP = "a".repeat(40), LATER = "b".repeat(40);
const land: BranchLand = { sha: "c".repeat(40), at: 1, tip: TIP, base: "main", subject: "x", points: [], passt: true, checked: true };
const record = (lands: BranchLand[]): BranchRecord => ({ repo: "/r", branch: "branch/x", name: "X", base: null, text: "", rev: 0,
  seen: null, lands, createdAt: 0, updatedAt: 0 });
const quiet: EndFacts = { head: TIP, place: { path: "/r.worktrees/x", primary: false }, dirty: false, stray: [], held: false,
  instance: false, baseOf: null };

describe("endVerdict: wann ein Branch von selbst endet", () => {
  test("gelandet, Spitze = gelandeter Tip, Worktree sauber, niemand drin: endet, mit dem Land", () => {
    expect(endVerdict(record([land]), quiet)).toEqual({ end: true, land });
  });
  test("ohne Worktree endet er genauso", () => {
    expect(endVerdict(record([land]), { ...quiet, place: null, dirty: null })).toEqual({ end: true, land });
  });
  test("es zählt das letzte Land", () => {
    const later = { ...land, tip: LATER, sha: "d".repeat(40) };
    expect(endVerdict(record([land, later]), { ...quiet, head: LATER })).toEqual({ end: true, land: later });
    expect(endVerdict(record([land, later]), quiet).end).toBe(false);
  });
  const keeps: [string, BranchRecord, EndFacts][] = [
    ["nie gelandet", record([]), quiet],
    ["Commits nach dem Land", record([land]), { ...quiet, head: LATER }],
    ["Spitze nicht lesbar", record([land]), { ...quiet, head: null }],
    ["ungesicherte Arbeit im Worktree", record([land]), { ...quiet, dirty: true }],
    ["Worktree-Stand nicht lesbar", record([land]), { ...quiet, dirty: null }],
    ["eine Session sitzt im Worktree", record([land]), { ...quiet, held: true }],
    ["eine Testinstanz läuft daraus", record([land]), { ...quiet, instance: true }],
    ["im Haupt-Checkout ausgecheckt", record([land]), { ...quiet, place: { path: "/r", primary: true } }],
    ["ein anderer Branch zweigt von ihm ab", record([land]), { ...quiet, baseOf: "branch/y" }],
    ["eine ignorierte Datei im Worktree (ein Upload in drops/)", record([land]), { ...quiet, stray: ["drops/"] }],
    ["ein offener Punkt im Notizblock", { ...record([land]), text: "- [x] gebaut\n- [ ] dem Owner zeigen" }, quiet],
  ];
  for (const [why, r, f] of keeps)
    test(`bleibt: ${why}`, () => {
      const v = endVerdict(r, f);
      expect(v.end).toBe(false);
      expect(v.end ? "" : v.why).not.toBe("");
    });
});

describe("heldBy: was einen Worktree hält", () => {
  const holds = (o: Partial<EndHolds> = {}): EndHolds => ({ busy: new Set(), transit: () => [], cwds: () => [], real: (p) => p, ...o });
  test("eine Session in einem Unterordner hält ihn, eine im Nachbarordner mit gleichem Anfang nicht", () => {
    expect(heldBy(holds({ cwds: () => ["/w/x/src"] }), "/w/x")).toBe(true);
    expect(heldBy(holds({ cwds: () => ["/w/x-zwei"] }), "/w/x")).toBe(false);
  });
  test("ein Öffnen im Flug (attachBusy) hält ihn, außer das Ende hat den Pfad selbst genommen", () => {
    const h = holds({ busy: new Set(["/w/x"]) });
    expect([heldBy(h, "/w/x"), heldBy(h, "/w/x", true)]).toEqual([true, false]);
  });
  test("eine Nachfolge zwischen Kill und Öffnen hält ihn, auch unter anderem Namen desselben Ordners", () => {
    expect(heldBy(holds({ transit: () => ["/link/x"], real: (p) => p.replace("/link", "/w") }), "/w/x")).toBe(true);
  });
});

// DER DURCHGANG: ein Temp-Repo mit Branch branch/x in einem eigenen Worktree, gelandet auf seiner Spitze
const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-branch-ende-")));
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
let n = 0;
function world(o: { git?: (dir: string, args: string[]) => GitResult | null; log?: () => Promise<void>; holds?: Partial<EndHolds>;
  landing?: string[]; worktrees?: () => Promise<{ path: string; branch: string; primary: boolean }[]> } = {}) {
  const repo = join(TMP, `r${++n}`), wt = join(TMP, `r${n}-x`);
  Bun.spawnSync(["mkdir", "-p", repo]);
  sh(repo, "init", "-q", "-b", "main");
  writeFileSync(join(repo, "README"), "x\n");
  sh(repo, "add", "README");
  sh(repo, "commit", "-q", "-m", "start");
  sh(repo, "worktree", "add", "-q", "-b", "branch/x", wt);
  writeFileSync(join(wt, "a.txt"), "a\n");
  sh(wt, "add", "a.txt");
  sh(wt, "commit", "-q", "-m", "Arbeit");
  const tip = sh(repo, "rev-parse", "branch/x");
  let book: BranchRecord[] = [{ ...record([{ ...land, tip }]), repo }];
  const logged: string[] = [];
  const busy = new Set<string>();
  const d: EndDeps = {
    gitRead: async (dir, ...args) => run(dir, args),
    git: async (dir, ...args) => o.git?.(dir, args) ?? run(dir, args),
    worktrees: o.worktrees ?? (async () => [{ path: repo, branch: "main", primary: true }, { path: wt, branch: "branch/x", primary: false }]),
    holds: { busy, transit: () => [], cwds: () => [], real: (p) => p, ...o.holds },
    instance: () => false, scaffold: ["node_modules/"],
    book: () => book, setBook: (b) => { book = [...b]; }, saveStateNow: async () => {},
    log: async (e, r) => { await o.log?.(); logged.push(`${e.branch} ${e.head} ${r.text}`); },
    ended: () => {}, landing: new Set(o.landing ?? []),
  };
  return { repo, wt, tip, d, logged, busy, book: () => book, branchAt: () => run(repo, ["rev-parse", "--verify", "--quiet", "refs/heads/branch/x"]) };
}
const fail = (out = ""): GitResult => ({ out, err: "verweigert", code: 1 });
const is = (args: string[], ...want: string[]): boolean => want.every((w, i) => args[i] === w);

describe("endLandedBranches: ein Durchgang mit echtem git", () => {
  test("alles still: Worktree und Branch weg, Datensatz weg, Spitze unter refs/fleet/ended/, Log mit Notizblock, Pfad wieder frei", async () => {
    const w = world();
    w.d.setBook(w.book().map((r) => ({ ...r, text: "- [x] gebaut" })));
    const r = await endLandedBranches(w.d);
    expect(r.ended.map((e) => [e.branch, e.head, e.path])).toEqual([["branch/x", w.tip, w.wt]]);
    expect([existsSync(w.wt), w.branchAt().code, w.book().length]).toEqual([false, 1, 0]);
    expect(sh(w.repo, "rev-parse", "refs/fleet/ended/branch/x")).toBe(w.tip);
    expect(w.logged).toEqual([`branch/x ${w.tip} - [x] gebaut`]);
    expect(w.busy.size).toBe(0);
  });
  test("node_modules/ (ignoriert, Gerüst) hält ihn nicht; eine andere ignorierte Datei schon", async () => {
    const w = world();
    sh(w.repo, "config", "core.excludesFile", join(TMP, `ignore${n}`));
    writeFileSync(join(TMP, `ignore${n}`), "node_modules/\ndrops/\n");
    Bun.spawnSync(["mkdir", "-p", join(w.wt, "node_modules"), join(w.wt, "drops")]);
    writeFileSync(join(w.wt, "node_modules", "m.js"), "");
    writeFileSync(join(w.wt, "drops", "x.png"), "png");
    expect((await endLandedBranches(w.d)).kept.map((k) => k.why)).toEqual(["ignorierte Dateien im Worktree: drops/"]);
    rmSync(join(w.wt, "drops"), { recursive: true });
    expect((await endLandedBranches(w.d)).ended.length).toBe(1);
  });
  const stays: [string, Parameters<typeof world>[0], string][] = [
    ["eine Charge im Flug im Repo", { landing: [] }, "eine Charge ist im Flug"],
    ["die Worktree-Liste nicht lesbar", { worktrees: async () => { throw new Error("worktree-list-unreadable"); } }, "Worktrees des Repos nicht lesbar"],
    ["die Spitze lässt sich nicht sichern", { git: (_d, a) => (is(a, "update-ref", "refs/fleet/ended/branch/x") ? fail() : null) }, "Spitze nicht gesichert: verweigert"],
    ["das Log lässt sich nicht schreiben", { log: async () => { throw new Error("Platte voll"); } }, "Log nicht geschrieben: Platte voll"],
    ["git verweigert das Entfernen des Worktrees", { git: (_d, a) => (is(a, "worktree", "remove") ? fail() : null) }, "Worktree blieb: verweigert"],
  ];
  for (const [what, o, why] of stays)
    test(`bleibt: ${what}`, async () => {
      const w = world(o);
      if (what.startsWith("eine Charge")) (w.d.landing as Set<string>).add(w.repo);
      const r = await endLandedBranches(w.d);
      expect([r.ended, r.kept.map((k) => k.why)]).toEqual([[], [why]]);
      expect(w.branchAt().out).toBe(w.tip);
      expect(w.book().length).toBe(1);
      expect(w.busy.size).toBe(0);
    });
  test("bleibt: eine Session kommt zwischen Sichern und Entfernen dazu (eine Nachfolge, die attachBusy nicht fragt)", async () => {
    const transit: string[] = [];
    const w = world({ log: async () => { transit.push(w.wt); }, holds: { transit: () => transit } });
    const r = await endLandedBranches(w.d);
    expect(r.kept.map((k) => k.why)).toEqual(["eine Session kam dazu"]);
    expect([existsSync(w.wt), w.branchAt().out]).toEqual([true, w.tip]);
  });
  test("ein Öffnen, das während des Endes kommt, sieht den Pfad besetzt", async () => {
    let seen = false;
    const w = world({ log: async () => { seen = w.busy.has(w.wt); } });
    await endLandedBranches(w.d);
    expect(seen).toBe(true);
  });
  test("bleibt: ein Commit kommt zwischen Prüfung und Löschen auf den Branch", async () => {
    const w = world({ git: (dir, a) => {
      if (is(a, "worktree", "remove")) {
        writeFileSync(join(w.wt, "spaet.txt"), "spät\n");
        sh(w.wt, "add", "spaet.txt");
        sh(w.wt, "commit", "-q", "-m", "spät");
        late = sh(w.wt, "rev-parse", "HEAD");
        return run(dir, [...a, "--force"]); // der Worktree geht, der Commit steht auf dem Branch
      }
      return null;
    } });
    let late = "";
    const r = await endLandedBranches(w.d);
    expect(r.kept.map((k) => k.why.split(":")[0])).toEqual(["Branch blieb"]);
    expect(w.branchAt().out).toBe(late);
    expect(w.book().length).toBe(1);
  });
});

// Owner 12.10.: „[Zitat entfernt]“ — der Merge-Check meldet bei rotem main nie
// „[Zitat entfernt]“, außer ein Branch repariert es ausdrücklich (--repair). Und er urteilt über den Baum,
// den main nach dem Merge hätte (Bauleitung 12.10.: Branch-Arbeit per Rebase/Cherry-Pick auf main,
// ohne bau/neuaufbau).
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { auditShardsLine, bigUnitsArg, bigUnitsOf, candidateOf, decide, hiddenLayerOf, mainVerdict, mergeBaseOf } from "./merge-check";

const onMain = (sha: string): boolean => sha.startsWith("m");
const row = (at: number, result: string, mainSha: string, adjudication?: unknown) =>
  ({ at, result, mainSha, ...(adjudication === undefined ? {} : { adjudication }) });

describe("mainVerdict: ist main bekannt rot?", () => {
  test("jüngste gemessene Zeile auf main rot → rot", () => {
    expect(mainVerdict([row(1, "green", "m1"), row(2, "red", "m2")], onMain).red).toBe(true);
  });
  test("ein späteres Grün auf main hebt ein älteres Rot auf, egal in welcher Reihenfolge die Zeilen kommen", () => {
    expect(mainVerdict([row(3, "green", "m3"), row(2, "red", "m2")], onMain).red).toBe(false);
  });
  // dieselben Urteile wie der Server (server.ts#acceptByLandReading): flake, stale-test und unknowable
  // sagen „jemand hat hingesehen, keine Regression“ — Mangel 129: der Merge-Check ließ nur flake gelten
  for (const verdict of ["flake", "stale-test", "unknowable"]) {
    test(`ein Rot, das als ${verdict} beurteilt ist, hält main nicht rot (Objekt- und Textform)`, () => {
      const obj = mainVerdict([row(1, "green", "m1"), row(2, "red", "m2", { verdict, at: 3, by: "owner" })], onMain);
      expect(obj).toEqual({ red: false, why: `main grün: Audit m2 vom ${new Date(2).toISOString()} (rot, Urteil ${verdict})` });
      expect(mainVerdict([row(2, "red", "m2", verdict)], onMain).red).toBe(false);
    });
  }
  test("ein Rot, das als real beurteilt ist, bleibt rot (Objekt- und Textform), und der Grund nennt das Urteil", () => {
    const obj = mainVerdict([row(2, "red", "m2", { verdict: "real", at: 3, by: "owner" })], onMain);
    expect(obj).toEqual({ red: true, why: `main ist rot: Audit m2 vom ${new Date(2).toISOString()} (Urteil real)` });
    expect(mainVerdict([row(2, "red", "m2", "real")], onMain).red).toBe(true);
  });
  test("ein unbeurteiltes Rot und ein Urteil, das keins ist, bleiben rot", () => {
    expect(mainVerdict([row(2, "red", "m2")], onMain).red).toBe(true);
    expect(mainVerdict([row(2, "red", "m2", null)], onMain).red).toBe(true);
    expect(mainVerdict([row(2, "red", "m2", { at: 3, by: "owner" })], onMain).red).toBe(true);
    expect(mainVerdict([row(2, "red", "m2", "Flake")], onMain).red).toBe(true);
    expect(mainVerdict([row(2, "red", "m2", { verdict: "passt", at: 3 })], onMain).red).toBe(true);
  });
  test("ein beurteiltes älteres Rot hebt ein jüngeres unbeurteiltes nicht auf", () => {
    expect(mainVerdict([row(1, "red", "m1", "stale-test"), row(2, "red", "m2")], onMain).red).toBe(true);
  });
  test("unknown ist keine Messung: zählt wird die letzte grüne oder rote Zeile davor", () => {
    expect(mainVerdict([row(1, "red", "m1"), row(2, "unknown", "m2")], onMain).red).toBe(true);
    expect(mainVerdict([row(1, "green", "m1"), row(2, "unknown", "m2")], onMain).red).toBe(false);
  });
  test("ein Rot auf einem Stand, der nicht auf main liegt, zählt nicht", () => {
    expect(mainVerdict([row(1, "green", "m1"), row(2, "red", "x2")], onMain).red).toBe(false);
  });
  test("ohne gemessene Zeile ist main nicht grün", () => {
    expect(mainVerdict([], onMain).red).toBe(true);
    expect(mainVerdict([row(1, "unknown", "m1"), row(2, "green", "x2")], onMain).red).toBe(true);
    expect(mainVerdict([{ at: 1, result: "green" }], onMain).red).toBe(true);
  });
});

describe("decide: mergebar?", () => {
  const green = { red: false, why: "main grün" };
  const red = { red: true, why: "main ist rot" };
  test("grün auf grünem main → mergebar, exit 0", () => {
    expect(decide("green", green, false)).toMatchObject({ mergeable: true, code: 0 });
  });
  test("rot ist nie mergebar, auch nicht mit --repair, exit 1", () => {
    expect(decide("red", green, false)).toMatchObject({ mergeable: false, code: 1 });
    expect(decide("red", red, true)).toMatchObject({ mergeable: false, code: 1 });
  });
  test("grün auf rotem main → verweigert, exit 2, und der Grund nennt das rote main", () => {
    expect(decide("green", red, false)).toEqual({ mergeable: false, code: 2, why: "main ist rot" });
  });
  test("grün auf rotem main mit --repair → mergebar, und die Zeile sagt es", () => {
    const d = decide("green", red, true);
    expect(d.mergeable).toBe(true);
    expect(d.code).toBe(0);
    expect(d.why).toContain("--repair");
  });
});

describe("candidateOf: der Baum nach dem Merge", () => {
  // ein Wegwerf-Repo im Fluss der Bauleitung: main, bau/neu (Regeldatei, geht nie nach main), ein
  // Strang darauf; die Bauleitung pickt Strang-Commits nach main, der Strang behält die Originale
  const repo = (): { dir: string; g: (...a: string[]) => string; commit: (file: string, text: string) => string } => {
    const dir = mkdtempSync(`${tmpdir()}/mc-test-`);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    const commit = (file: string, text: string): string => {
      writeFileSync(`${dir}/${file}`, text);
      g("add", file);
      g("commit", "-q", "-m", `${file}: ${text}`);
      return g("rev-parse", "HEAD");
    };
    g("init", "-q", "-b", "main");
    commit("a.txt", "1\n");
    g("checkout", "-q", "-b", "neu");
    commit("regel.txt", "nur auf bau/*\n");
    g("checkout", "-q", "-b", "strang");
    return { dir, g, commit };
  };
  const filesOf = (g: (...a: string[]) => string, sha: string): string[] => g("ls-tree", "--name-only", sha).split("\n");

  test("main + Strang-Commits, ohne die Commits der Basis", () => {
    const { dir, g, commit } = repo();
    commit("x.txt", "neu\n");
    const c = candidateOf(g("rev-parse", "main"), "neu", "strang", dir);
    const files = "conflict" in c ? [] : filesOf(g, c.sha);
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(c.commits.length).toBe(1);
    expect(files.sort()).toEqual(["a.txt", "x.txt"]);
  });

  test("schon nach main gepickte Commits werden übersprungen, auch wenn ein späterer dieselbe Datei änderte", () => {
    const { dir, g, commit } = repo();
    const c1 = commit("ci.txt", "v1\n");
    const c2 = commit("ci.txt", "v2\n");
    g("checkout", "-q", "main");
    g("cherry-pick", c1, c2);
    g("checkout", "-q", "strang");
    commit("y.txt", "danach\n");
    const c = candidateOf(g("rev-parse", "main"), "neu", "strang", dir);
    const tree = "conflict" in c ? "" : g("show", `${c.sha}:ci.txt`);
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(c.onMain).toEqual([c1, c2]);
    expect(c.commits.length).toBe(1);
    expect(tree).toBe("v2");
  });

  test("gepickte Commits werden auch übersprungen, wenn der Strang die main-Kopien per merge hereinholte", () => {
    const { dir, g, commit } = repo();
    const c1 = commit("ci.txt", "v1\n");
    const c2 = commit("ci.txt", "v2\n");
    g("checkout", "-q", "main");
    g("cherry-pick", c1, c2);
    g("checkout", "-q", "neu");
    g("merge", "-q", "--no-edit", "main");
    g("checkout", "-q", "strang");
    g("merge", "-q", "--no-edit", "neu");
    commit("y.txt", "danach\n");
    const c = candidateOf(g("rev-parse", "main"), "neu", "strang", dir);
    const tree = "conflict" in c ? [] : filesOf(g, c.sha);
    const ci = "conflict" in c ? "" : g("show", `${c.sha}:ci.txt`);
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(c.onMain).toEqual([c1, c2]);
    expect(c.commits.length).toBe(1);
    expect(tree.sort()).toEqual(["a.txt", "ci.txt", "y.txt"]);
    expect(ci).toBe("v2");
  });

  test("ein echter Konflikt mit main wird gemeldet, nicht überdeckt", () => {
    const { dir, g, commit } = repo();
    commit("a.txt", "strang\n");
    g("checkout", "-q", "main");
    commit("a.txt", "main\n");
    const c = candidateOf(g("rev-parse", "main"), "neu", "strang", dir);
    rmSync(dir, { recursive: true, force: true });
    expect("conflict" in c).toBe(true);
  });

  // DER EINE SCHRITT (Zielbild Landen 24.10., Schritt 1): ein Board-Branch zweigt von main ab und zählt ab main
  const zweig = () => {
    const r = repo();
    r.g("checkout", "-q", "-b", "zweig", "main");
    return r;
  };
  const show = (g: (...a: string[]) => string, sha: string, file: string): string => g("show", `${sha}:${file}`);

  test("ein Branch, der main mit gelöstem Konflikt hereinholte, besteht: der Kandidat ist der Baum, den git merge ergibt (Board-Zeile 497828bd)", () => {
    const { dir, g, commit } = zweig();
    commit("a.txt", "zweig\n");
    g("checkout", "-q", "main");
    commit("a.txt", "main\n");
    g("checkout", "-q", "zweig");
    Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", "merge", "-q", "--no-edit", "main"]);
    writeFileSync(`${dir}/a.txt`, "beides\n");
    g("add", "a.txt");
    g("commit", "-q", "--no-edit");
    g("checkout", "-q", "main");
    commit("b.txt", "main danach\n");
    g("checkout", "-q", "-b", "probe", "main");
    g("merge", "-q", "--no-edit", "zweig");
    const merged = g("rev-parse", "probe^{tree}");
    const c = candidateOf(g("rev-parse", "main"), "main", "zweig", dir);
    const tree = "conflict" in c ? "" : g("rev-parse", `${c.sha}^{tree}`);
    const a = "conflict" in c ? "" : show(g, c.sha, "a.txt");
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(c.form).toBe("ein-schritt");
    expect(tree).toBe(merged);
    expect(a).toBe("beides");
    expect(c.commits.length).toBe(1);
  });

  test("ein Commit, der eine zurückgenommene, schon gelandete Änderung wiederherstellt, bleibt im Kandidaten (Mangel 124)", () => {
    const { dir, g, commit } = zweig();
    g("checkout", "-q", "main");
    commit("f.txt", "v1\n");
    commit("f.txt", "v2\n");
    g("checkout", "-q", "zweig");
    g("reset", "-q", "--hard", "main");
    writeFileSync(`${dir}/x.txt`, "neu\n");
    writeFileSync(`${dir}/f.txt`, "v1\n");
    g("add", "x.txt", "f.txt");
    g("commit", "-q", "-m", "x.txt neu, f.txt versehentlich zurück");
    const restore = commit("f.txt", "v2\n");
    const c = candidateOf(g("rev-parse", "main"), "main", "zweig", dir);
    const f = "conflict" in c ? "" : show(g, c.sha, "f.txt");
    const x = "conflict" in c ? "" : show(g, c.sha, "x.txt");
    const tipTree = g("rev-parse", "zweig^{tree}");
    const tree = "conflict" in c ? "" : g("rev-parse", `${c.sha}^{tree}`);
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(f).toBe("v2");
    expect(x).toBe("neu");
    expect(tree).toBe(tipTree);
    expect(c.form).toBe("ein-schritt");
    expect(c.commits).toContain(restore);
  });

  test("ein bestehender Branch, dessen frühere Commits als Squash auf main liegen, trägt nur seine eigene Änderung (Mangel 68)", () => {
    const { dir, g, commit } = zweig();
    commit("f.txt", "1\n");
    commit("f.txt", "2\n");
    g("checkout", "-q", "main");
    commit("f.txt", "2\n");
    g("checkout", "-q", "zweig");
    commit("g.txt", "neu\n");
    const c = candidateOf(g("rev-parse", "main"), "main", "zweig", dir);
    const files = "conflict" in c ? [] : filesOf(g, c.sha);
    const f = "conflict" in c ? "" : show(g, c.sha, "f.txt");
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(files.sort()).toEqual(["a.txt", "f.txt", "g.txt"]);
    expect(f).toBe("2");
  });

  test("nach einem Land zählt die Charge ab der gelandeten Spitze, und eine Charge aus mehreren Commits bleibt die Kette", () => {
    const { dir, g, commit } = zweig();
    const landed = commit("f.txt", "1\n");
    g("checkout", "-q", "main");
    g("reset", "-q", "--hard", g("commit-tree", `${landed}^{tree}`, "-p", "main", "-m", "Squash-Land"));
    commit("f.txt", "1\nmain\n");
    g("checkout", "-q", "zweig");
    const c2 = commit("g.txt", "a\n");
    const c3 = commit("g.txt", "b\n");
    const main = g("rev-parse", "main");
    const c = candidateOf(main, landed, "zweig", dir);
    const parent = "conflict" in c ? "" : g("rev-parse", `${c.sha}~2`);
    const f = "conflict" in c ? "" : show(g, c.sha, "f.txt");
    const gt = "conflict" in c ? "" : show(g, c.sha, "g.txt");
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(c.form).toBe("kette");
    expect(c.commits).toEqual([c2, c3]);
    expect(parent).toBe(main);
    expect(f).toBe("1\nmain");
    expect(gt).toBe("b");
  });

  test("die Basis des einen Schritts: die gelandete Spitze, bis der Branch main samt Squash hereinholt", () => {
    const { dir, g, commit } = zweig();
    const landed = commit("f.txt", "1\n");
    g("checkout", "-q", "main");
    g("reset", "-q", "--hard", g("commit-tree", `${landed}^{tree}`, "-p", "main", "-m", "Squash-Land"));
    commit("m.txt", "1\n");
    g("checkout", "-q", "zweig");
    const afterLand = mergeBaseOf(g("rev-parse", "main"), landed, "zweig", dir);
    g("merge", "-q", "--no-edit", "main");
    commit("g.txt", "danach\n");
    const mainNow = g("rev-parse", "main");
    const afterMerge = mergeBaseOf(mainNow, landed, "zweig", dir);
    rmSync(dir, { recursive: true, force: true });
    expect(afterLand).toBe(landed);
    expect(afterMerge).toBe(mainNow);
  });

  test("ein Basis-Branch, den main nie bekam, und ein hereingeholtes main geben keine eine Basis: es gilt die Kette", () => {
    const { dir, g, commit } = repo();
    commit("x.txt", "strang\n");
    g("checkout", "-q", "main");
    commit("m.txt", "1\n");
    g("checkout", "-q", "strang");
    g("merge", "-q", "--no-edit", "main");
    const main = g("rev-parse", "main");
    const base = mergeBaseOf(main, "neu", "strang", dir);
    const c = candidateOf(main, "neu", "strang", dir);
    const files = "conflict" in c ? [] : filesOf(g, c.sha);
    rmSync(dir, { recursive: true, force: true });
    if ("conflict" in c) throw new Error(c.conflict);
    expect(base).toBeNull();
    expect(c.form).toBe("kette");
    expect(files.sort()).toEqual(["a.txt", "m.txt", "x.txt"]);
  });

  // der gemessene Fall: die Spitze liegt nur im Repo, in dem sie gebaut wurde (nicht auf main, nicht auf dem Helfer)
  const has = (sha: string): boolean => Bun.spawnSync(["git", "cat-file", "-e", `${sha}^{commit}`], { cwd: import.meta.dir }).exitCode === 0;
  test.skipIf(!has("3f754690a"))("3f754690a auf a1f9b3299 ergibt den Baum 99b319d2 des späteren richtigen Checks, nicht 7ad323fd (Mangel 124)", () => {
    const c = candidateOf("a1f9b32990455bc7f90fad81a7106fb654f0c1ea", "a1f9b32990455bc7f90fad81a7106fb654f0c1ea", "3f754690af1d69795faf399ce9a2f57a4bb1149d");
    if ("conflict" in c) throw new Error(c.conflict);
    const tree = Bun.spawnSync(["git", "rev-parse", `${c.sha}^{tree}`], { cwd: import.meta.dir }).stdout.toString().trim();
    expect(tree).toBe("99b319d24a61d7aaaeab5685f0b71834a9071b00");
    expect(c.ketteTree?.startsWith("7ad323fd")).toBe(true);
  });
});

// Owner 22.10.: 993b4e90 bestand seinen Merge-Check und machte main erst im Audit rot (e2e/programs.ts);
// was der Merge-Check daraus liest, prüfen wir an Commits, die dieser Test selbst baut — die Geschichte
// dieses Repos wird im veröffentlichten Klon neu geschrieben, ihre Commits gibt es dort nicht.
describe("bigUnitsOf: die großen Units eines Kandidaten aus git", () => {
  const ROOT = join(import.meta.dir, "..");
  const dirs: string[] = [];
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
  // Der Kandidatenbaum braucht die Dateien, die e2e-isolated.sh staged, damit der Fußabdruck ableitbar ist.
  // Kopiert wird der getrackte Arbeitsbaum (keine Geschichte); die Commits, um die es geht, entstehen hier.
  const repo = (): { dir: string; g: (...a: string[]) => string; commit: (msg: string, change: () => void) => string } => {
    const dir = mkdtempSync(`${tmpdir()}/mc-big-units-`);
    dirs.push(dir);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    g("init", "-q", "-b", "main");
    const listed = Bun.spawnSync(["git", "-C", ROOT, "ls-files", "-z"]);
    if (listed.exitCode !== 0) throw new Error(`git ls-files: ${listed.stderr.toString()}`);
    for (const path of listed.stdout.toString().split("\0").filter(Boolean)) {
      const dst = join(dir, path);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(join(ROOT, path)));
    }
    g("add", "-A");
    g("commit", "-q", "-m", "base");
    const commit = (msg: string, change: () => void): string => {
      change();
      g("add", "-A");
      g("commit", "-q", "-m", msg);
      return g("rev-parse", "HEAD");
    };
    return { dir, g, commit };
  };
  const append = (dir: string, path: string): void => {
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, (existsSync(file) ? readFileSync(file, "utf8") : "") + "\n");
  };
  test("ein Commit aus dem Fußabdruck von programs schuldet programs, aber nie dom", () => {
    const { dir, g, commit } = repo();
    const base = g("rev-parse", "HEAD");
    const cand = commit("der gemessene Program-Commit, nachgebaut", () => {
      for (const path of [".fleet/context-packs.json", "docs/packs/making-a-pack.md", "docs/packs/setting-up-agents.md",
        "docs/packs/who-it-is-for.md", "docs/start/orchestrator.md", "server.ts", "server/fassung.test.ts",
        "server/orchestrator-start.ts", "session-blocks.ts"]) append(dir, path);
    });
    const s = bigUnitsOf(base, cand, dir);
    expect(s.run).toEqual(["core", "core-tasks", "programs", "lanes", "watch"]);
    expect(s.why.programs).toContain("docs/packs/who-it-is-for.md");
    expect(s.run).not.toContain("dom");
  });
  test("ein reiner Doku-Commit unter docs/messungen schuldet keine", () => {
    const { dir, g, commit } = repo();
    const base = g("rev-parse", "HEAD");
    const cand = commit("docs(messungen): eine Notiz", () => {
      const file = join(dir, "docs/messungen/notiz.md");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "# Notiz\n");
    });
    expect(bigUnitsOf(base, cand, dir).run).toEqual([]);
  });
  test("der Helfer bekommt die Units als Liste, „-“ für keine", () => {
    expect(bigUnitsArg([])).toBe("-");
    expect(bigUnitsArg(["programs", "watch"])).toBe("programs,watch");
  });
});

// Layout 3 (23.10.): der Helfer fährt die Audit-Shards, die eine geschuldete Unit tragen; das Urteil sagt welche
describe("auditShardsLine: was das Urteil über die gefahrenen Audit-Shards sagt", () => {
  const out = (...l: string[]): string => ["run x wait=0", ...l, "merge-check green 1"].join("\n");
  test("eine große Unit, die nur mitfährt, wird genannt, mit dem Shard, den sie teilt", () => {
    expect(auditShardsLine(out("audit-shard 4/4 lanes,watch"), ["lanes"]))
      .toBe("gefahren als Audit-Shards 4/4 (lanes, watch); watch fährt mit (teilt 4/4)");
  });
  test("kleine Units erscheinen nicht; alle vier Shards heißt ohne s1–s3", () => {
    const l = auditShardsLine(out("audit-shard 1/4 core,attention", "audit-shard 2/4 pure,core-tasks",
      "audit-shard 3/4 bytes,programs", "audit-shard 4/4 lanes,watch"), ["core", "core-tasks", "programs", "lanes", "watch"]);
    expect(l).toBe("gefahren als Audit-Shards 1/4 (core), 2/4 (core-tasks), 3/4 (programs), 4/4 (lanes, watch); "
      + "sie tragen jede kleine Unit, s1–s3 entfallen");
  });
  test("ohne audit-shard-Zeile (Doku-Änderung) keine Zeile", () => {
    expect(auditShardsLine(out(), [])).toBeNull();
  });
});

// E9 (Owner 23.10.): Fleet rendert kein CLAUDE.md mehr, und der Merge-Check verhindert, dass es zurückkommt
describe("hiddenLayerOf: kein verstecktes Regelbuch im Kandidaten", () => {
  const tree = (files: Record<string, string>): { sha: string; dir: string } => {
    const dir = mkdtempSync(`${tmpdir()}/mc-hidden-`);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    g("init", "-q", "-b", "main");
    for (const [path, text] of Object.entries({ "AGENTS.md": "# Regeln\n", ...files })) {
      mkdirSync(`${dir}/${path}`.replace(/\/[^/]+$/, ""), { recursive: true });
      writeFileSync(`${dir}/${path}`, text);
    }
    g("add", "-A");
    g("commit", "-q", "-m", "baum");
    return { sha: g("rev-parse", "HEAD"), dir };
  };
  const pack = (path: string): string => JSON.stringify([{ id: "p1", sources: [{ path, anchor: "# x" }] }]);
  test("ein Baum mit AGENTS.md, Packs auf Docs und ohne CLAUDE.md geht durch", () => {
    const t = tree({ ".fleet/context-packs.json": pack("docs/packs/x.md"), "context-packs.ts": 'sources: [{ path: "docs/a.md" }]\n' });
    try { expect(hiddenLayerOf(t.sha, t.dir)).toEqual([]); } finally { rmSync(t.dir, { recursive: true, force: true }); }
  });
  test("ein getracktes CLAUDE.md wird verweigert, auch tief im Baum und unter .claude/", () => {
    const t = tree({ "CLAUDE.md": "x\n", "docs/CLAUDE.md": "x\n", ".claude/CLAUDE.md": "x\n", "docs/NOT-CLAUDE.md.txt": "x\n" });
    try {
      expect(hiddenLayerOf(t.sha, t.dir)).toEqual(["getracktes .claude/CLAUDE.md", "getracktes CLAUDE.md", "getracktes docs/CLAUDE.md"]);
    } finally { rmSync(t.dir, { recursive: true, force: true }); }
  });
  test("eine Pack-Quelle auf CLAUDE.md wird verweigert, im Manifest und in der Saat", () => {
    const t = tree({ ".fleet/context-packs.json": pack("CLAUDE.md"), "context-packs.ts": 'sources: [{ path: "rulebook/CLAUDE.md" }]\n' });
    try {
      expect(hiddenLayerOf(t.sha, t.dir)).toEqual(["Pack p1 liest CLAUDE.md (.fleet/context-packs.json)",
        "eine Saat liest rulebook/CLAUDE.md (context-packs.ts)"]);
    } finally { rmSync(t.dir, { recursive: true, force: true }); }
  });
  test("Fleets eigener Baum trägt keins", () => {
    expect(hiddenLayerOf("HEAD")).toEqual([]);
  });
});

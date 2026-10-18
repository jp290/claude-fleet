// Owner 12.10.: „[Zitat entfernt]“ — der Merge-Check meldet bei rotem main nie
// „[Zitat entfernt]“, außer ein Branch repariert es ausdrücklich (--repair). Und er urteilt über den Baum,
// den main nach dem Merge hätte (Bauleitung 12.10.: Branch-Arbeit per Rebase/Cherry-Pick auf main,
// ohne bau/neuaufbau).
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { candidateOf, decide, mainVerdict } from "./merge-check";

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
});

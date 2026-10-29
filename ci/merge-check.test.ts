// Owner 12.10.: „[Zitat entfernt]“ — der Merge-Check meldet bei rotem main nie
// „[Zitat entfernt]“, außer ein Branch repariert es ausdrücklich (--repair). Und er urteilt über den Baum,
// den main nach dem Merge hätte (Bauleitung 12.10.: Branch-Arbeit per Rebase/Cherry-Pick auf main,
// ohne bau/neuaufbau).
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { auditShardsLine, bigUnitsArg, bigUnitsOf, candidateOf, decide, diffPaths, helperEnv, helperOf, helperRun, hiddenLayerOf,
  mainAuditOf, mainVerdict, mergeBaseOf, mergeCheck, namesInTree, pushCandidate, runOnHelper } from "./merge-check";
import { repairProofOf } from "./repair-proof";

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
  // Karte cb1edfe3 (27.10.): die Flagge allein genügt nicht — ohne Beleg bleibt es beim Nein, und der
  // Satz sagt, woran es fehlt. Mit Beleg nennt die Zeile, was der Branch behebt.
  test("ohne Beleg bleibt grün auf rotem main verweigert, und der Grund nennt den fehlenden Beleg", () => {
    expect(decide("green", red, false, "nicht als Reparatur belegt: kein Quelltext nennt diese Prüfung"))
      .toEqual({ mergeable: false, code: 2, why: "main ist rot; nicht als Reparatur belegt: kein Quelltext nennt diese Prüfung" });
  });
  test("mit Beleg trägt der Grund den Beleg statt des alten Satzes", () => {
    const d = decide("green", red, true, "der Branch behebt den roten Audit mmmmmmmm: 1 rote Prüfung");
    expect(d.mergeable).toBe(true);
    expect(d.why).toContain("behebt den roten Audit mmmmmmmm");
    expect(d.why).toContain("--repair");
  });
});

describe("mainAuditOf: welche Zeile hält main rot, und was nennt sie?", () => {
  test("die jüngste gemessene rote Zeile kommt mit — sie trägt die `fails`, aus denen sich die Reparatur belegt", () => {
    const got = mainAuditOf([row(1, "green", "m1"), { ...row(2, "red", "m2"), fails: ["a: b"] }], onMain);
    expect(got.red).toBe(true);
    expect(got.row).toMatchObject({ result: "red", mainSha: "m2", fails: ["a: b"] });
  });
  test("grün, beurteilt oder gar nicht gemessen: keine rote Zeile", () => {
    expect(mainAuditOf([row(1, "green", "m1")], onMain).row).toBeNull();
    expect(mainAuditOf([row(2, "red", "m2", "stale-test")], onMain).row).toBeNull();
    expect(mainAuditOf([], onMain).row).toBeNull();
  });
});

// DER BELEG SELBST, an einem Wegwerf-Repo: gesucht wird der Satz einer Prüfung, gefunden wird die
// Datei, die ihn ausgibt; ein Satz, den niemand trägt, findet nichts. Und der Diff ist der, den der
// Branch gegen main macht.
describe("namesInTree und diffPaths: der Beleg der Reparatur-Tür", () => {
  const repo = (): { dir: string; g: (...a: string[]) => string } => {
    const dir = mkdtempSync(`${tmpdir()}/mc-repair-`);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    g("init", "-q", "-b", "main");
    mkdirSync(`${dir}/e2e`);
    mkdirSync(`${dir}/docs`);
    writeFileSync(`${dir}/e2e/slots.ts`, `claims["the words are as large as Info's — the drawing is not scaled"] = true;\n`);
    writeFileSync(`${dir}/docs/notiz.md`, `zitiert: the words are as large as Info's — the drawing is not scaled\n`);
    g("add", "-A");
    g("commit", "-q", "-m", "baum");
    return { dir, g };
  };
  test("die Datei, die den Satz ausgibt, wird gefunden — die Doku, die ihn zitiert, nicht", () => {
    const { dir, g } = repo();
    try {
      expect(namesInTree(g("rev-parse", "HEAD"), "the words are as large as Info's", dir)).toEqual(["e2e/slots.ts"]);
      expect(namesInTree(g("rev-parse", "HEAD"), "ein Satz, den kein Quelltext trägt", dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  // DER FALL, AN DEM DIE TÜR BLIND WAR (branch/rechte-block, d3a0af04): die Nadel selbst trägt
  // Anführungszeichen. Im Quelltext steht der Satz als TS-String, dort ist jedes `"` escaped — die
  // wörtliche Suche fand ihn nicht. Gesucht wird darum beides: die Nadel und ihre Quelltext-Escape-Form.
  describe("eine Nadel mit Anführungszeichen oder Backslash: wörtlich und escaped", () => {
    const CLAIM = 'die Vorschau trägt rechte { stufe: "lesen", an: [], aus: [] } als gewählte Stufe';
    const NAME = `rechte DOM 1440x900 lane: ${CLAIM}`;
    const dirs: string[] = [];
    afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
    const repo = (file: string, text: string): { dir: string; sha: string } => {
      const dir = mkdtempSync(`${tmpdir()}/mc-repair-escape-`);
      dirs.push(dir);
      const g = (...a: string[]): string => {
        const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
        if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
        return r.stdout.toString().trim();
      };
      g("init", "-q", "-b", "main");
      mkdirSync(join(dir, "e2e"));
      writeFileSync(join(dir, file), text);
      g("add", "-A");
      g("commit", "-q", "-m", "baum");
      return { dir, sha: g("rev-parse", "HEAD") };
    };
    const red = (name: string) => ({ at: 1793110000000, result: "red", mainSha: "m".repeat(40), fails: [name] });

    test("die Quelle nennt sie escaped: der Beleg nennt die Datei", () => {
      // der Satz steht im Quelltext als TS-String: jedes `"` escaped, die wörtliche Nadel trifft nicht
      const source = 'verdicts.rechte = satz === "die Vorschau trägt rechte { stufe: \\"lesen\\", an: [], aus: [] } als gewählte Stufe";\n';
      expect(source).not.toContain(CLAIM);
      const { dir, sha } = repo("e2e/start-dom.ts", source);
      const p = repairProofOf({ row: red(NAME), diff: ["e2e/start-dom.ts"], namesIn: (n) => namesInTree(sha, n, dir) });
      expect(p.ok).toBe(true);
      expect(p.files).toEqual(["e2e/start-dom.ts"]);
      expect(p.why).toContain("behebt den roten Audit");
    });

    test("eine Nadel, die niemand nennt, bleibt unbelegt", () => {
      const { dir, sha } = repo("e2e/start-dom.ts", 'const satz = "etwas ganz anderes";\n');
      const p = repairProofOf({ row: red(NAME), diff: ["e2e/start-dom.ts"], namesIn: (n) => namesInTree(sha, n, dir) });
      expect(p.ok).toBe(false);
      expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
    });

    test("ein Backslash in der Nadel: die doppelt escapte Quelle belegt sie", () => {
      const pfad = 'der Pfad C:\\x steht so in der Vorschau der Prüfung';
      const source = 'const satz = "der Pfad C:\\\\x steht so in der Vorschau der Prüfung";\n';
      expect(source).not.toContain(pfad);
      const { dir, sha } = repo("e2e/start-dom.ts", source);
      const p = repairProofOf({ row: red(`pfad DOM lane: ${pfad}`), diff: ["e2e/start-dom.ts"], namesIn: (n) => namesInTree(sha, n, dir) });
      expect(p.ok).toBe(true);
      expect(p.files).toEqual(["e2e/start-dom.ts"]);
    });
  });

  test("diffPaths nennt die Dateien, die der Branch gegen main ändert", () => {
    const { dir, g } = repo();
    try {
      const main = g("rev-parse", "HEAD");
      g("checkout", "-q", "-b", "arbeit");
      writeFileSync(`${dir}/e2e/slots.ts`, `claims["the words are as large as Info's — the drawing is not scaled"] = false;\n`);
      g("add", "-A");
      g("commit", "-q", "-m", "reparatur");
      expect(diffPaths(main, "arbeit", dir)).toEqual(["e2e/slots.ts"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
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

// Der Workhorse hat `hub` als lokalen Pfad: der Helfer ist er selbst, ohne ssh auf sich selbst. Der Mac behält ssh.
describe("Helfer: ssh wie bisher, ein lokaler Pfad heißt dieser Rechner", () => {
  const home = "/home/someone";
  test("MERGE_CHECK_HOST gewinnt; ein ssh://-Remote bleibt ssh", () => {
    expect(helperOf("ssh://someone@10.0.0.2/srv/repo.git", { MERGE_CHECK_HOST: "user@helper" }, home))
      .toEqual({ kind: "ssh", host: "user@helper", repo: "~/ci/repo.git" });
    expect(helperOf("ssh://someone@10.0.0.2/srv/repo.git", {}, home))
      .toEqual({ kind: "ssh", host: "someone@10.0.0.2", repo: "~/ci/repo.git" });
  });
  test("ein lokaler Pfad läuft hier: dasselbe bare Repo wie merge-check-run.sh#CI_HOME, kein ssh", () => {
    expect(helperOf("/home/helper-user/git/claude-fleet.git", {}, home))
      .toEqual({ kind: "local", repo: "/home/someone/ci/repo.git" });
    expect(helperOf("../claude-fleet.git", { CI_HOME: "/var/tmp/ci" }, home))
      .toEqual({ kind: "local", repo: "/var/tmp/ci/repo.git" });
  });
  test("kein Remote, kein ssh, kein Pfad: ein Grund statt eines stillen Abbruchs", () => {
    expect(() => helperOf(null, {}, home)).toThrow(/kein Helfer/);
    expect(() => helperOf("https://example.com/fleet.git", {}, home)).toThrow(/weder ssh:\/\/ noch ein lokaler Pfad/);
  });
});

describe("lokal schieben und fahren: derselbe Kandidat, derselbe Runner, ohne ssh", () => {
  const dirs: string[] = [];
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
  const tmp = (name: string): string => { const d = mkdtempSync(join(tmpdir(), name)); dirs.push(d); return d; };
  const gitIn = (dir: string, ...a: string[]): string => {
    const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
    if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
    return r.stdout.toString().trim();
  };
  test("der Kandidat liegt als refs/mc/<sha> im lokalen Helfer-Repo, ein zweiter Push stört nicht", () => {
    const dir = tmp("mc-local-");
    gitIn(dir, "init", "-q", "-b", "main");
    writeFileSync(join(dir, "a.txt"), "1\n");
    gitIn(dir, "add", "-A");
    gitIn(dir, "commit", "-q", "-m", "x");
    const sha = gitIn(dir, "rev-parse", "HEAD");
    const bare = join(dir, "ci", "repo.git");
    expect(pushCandidate({ kind: "local", repo: bare }, sha, dir)).toBe(true);
    expect(gitIn(bare, "rev-parse", `refs/mc/${sha}`)).toBe(sha);
    expect(pushCandidate({ kind: "local", repo: bare }, sha, dir)).toBe(true);
  });
  test("der Runner läuft lokal durch sh und bekommt Commit und große Units als Argumente", async () => {
    const dir = tmp("mc-runner-");
    const runner = join(dir, "runner.sh");
    writeFileSync(runner, "echo \"ran $1 $2\"\nexit 0\n");
    const r = await runOnHelper({ kind: "local", repo: join(dir, "repo.git") }, "abc123", ["core", "lanes"], runner, dir);
    expect(r).toEqual({ exit: 0, out: "ran abc123 core,lanes\n" });
  });
  // Das eigentliche Maß: kein kontrollierendes Terminal. `: < /dev/tty` öffnet es — in einer tmux-Pane gelingt das,
  // unter `setsid -w` nicht (eine neue Sitzung hat keins). Der Runner-Text kommt dabei über stdin: er IST das Skript,
  // das `sh -s` liest, und die Argumente stehen hinter `--`. Ohne den Fix steht dieser Lauf in der Pane auf T.
  test.skipIf(process.platform !== "linux" || !Bun.which("setsid"))(
    "lokal auf linux läuft der Runner ohne kontrollierendes Terminal, sein Text über stdin, Args hinter --", async () => {
      const dir = tmp("mc-setsid-");
      const runner = join(dir, "runner.sh");
      writeFileSync(runner, 'if ( : < /dev/tty ) 2>/dev/null; then echo "mit-terminal"; else echo "ohne-terminal"; fi\n'
        + 'echo "ran $1 $2"\n');
      const r = await runOnHelper({ kind: "local", repo: join(dir, "repo.git") }, "abc123", ["core"], runner, dir, "linux");
      expect(r).toEqual({ exit: 0, out: "ohne-terminal\nran abc123 core\n" });
    });
  // Über ssh bekommt der Runner eine frische Login-Umgebung; lokal erbte er die des Aufrufers — und deren FLEET_*
  // (FLEET_HOST/PORT beim Server, FLEET_SELF_* in einer Pane) ließ die e2e-Suiten eine andere Fleet lesen
  // (start-plan.ts liest FLEET_HOST/FLEET_PORT/FLEET_CTL_URL). Lokal gilt darum dieselbe saubere Lage.
  test("der lokale Runner erbt keine FLEET_*; HOME, PATH, MERGE_CHECK_* und CI_HOME bleiben", () => {
    const env = helperEnv({ PATH: "/usr/bin:/bin", HOME: "/home/someone", CI_HOME: "/var/tmp/ci",
      MERGE_CHECK_SCRATCH: "/tmp/mc", MERGE_CHECK_HOST: "user@helper",
      FLEET_HOST: "127.0.0.1", FLEET_PORT: "8927", FLEET_SELF_URL: "http://127.0.0.1:1", FLEET_SELF_TOKEN: "t",
      FLEET_SELF_SLOT: "5", FLEET_LIBRARY_REPO: "/r", FLEET_E2E_BAND: "7", FLEET_CMD: "true", LEER: undefined });
    expect(env).toEqual({ PATH: "/usr/bin:/bin", HOME: "/home/someone", CI_HOME: "/var/tmp/ci",
      MERGE_CHECK_SCRATCH: "/tmp/mc", MERGE_CHECK_HOST: "user@helper" });
    expect(Object.keys(env).filter((name) => name.startsWith("FLEET_"))).toEqual([]);
    expect(helperEnv(process.env)).not.toHaveProperty("FLEET_SELF_TOKEN");
  });
  test("über ssh bleibt der Aufruf ohne env-Angabe (ferner Login), lokal nimmt er die gefilterte Umgebung", () => {
    const ssh = helperRun({ kind: "ssh", host: "someone@10.0.0.2", repo: "~/ci/repo.git" }, "abc", ["core"],
      { FLEET_HOST: "x", PATH: "/bin" });
    expect(ssh).toEqual({ argv: ["ssh", "someone@10.0.0.2", "sh", "-s", "--", "abc", "core"] });
    // darwin ausdrücklich: die Umgebung hängt nicht an der Plattform, das Kommando schon (nächster Test)
    const local = helperRun({ kind: "local", repo: "/var/tmp/ci/repo.git" }, "abc", [],
      { FLEET_HOST: "x", PATH: "/bin", HOME: "/h" }, "darwin");
    expect(local).toEqual({ argv: ["sh", "-s", "--", "abc", "-"], env: { PATH: "/bin", HOME: "/h" } });
  });
  // Der Server läuft in einer tmux-Pane, hat also ein Terminal. `ci/merge-check-run.sh#run` legt jeden Job per
  // `timeout` in eine Hintergrund-Prozessgruppe; fasst darin etwas das Terminal an, hält der Kernel den Job an
  // (Zustand T), bis das Limit ihn tötet — höhere Limits helfen darum nicht. `setsid -w` gibt dem lokalen Lauf eine
  // eigene Sitzung ohne kontrollierendes Terminal und wartet selbst auf sein Ende; darwin hat kein setsid und
  // braucht es nicht (die Läufe dort kommen ohne Terminal). Die Plattform kommt als Seam herein, damit die Prüfung
  // nicht davon abhängt, auf welcher Maschine sie läuft.
  test("lokal auf linux startet der Runner über setsid -w, Commit und Units unverändert hinter --", () => {
    const call = helperRun({ kind: "local", repo: "/var/tmp/ci/repo.git" }, "abc", ["core", "lanes"],
      { FLEET_HOST: "x", PATH: "/bin" }, "linux");
    expect(call.argv).toEqual(["setsid", "-w", "sh", "-s", "--", "abc", "core,lanes"]);
    expect(call.env).toEqual({ PATH: "/bin" });
  });
  test("lokal auf darwin bleibt es beim Aufruf von heute, ohne setsid", () => {
    const call = helperRun({ kind: "local", repo: "/var/tmp/ci/repo.git" }, "abc", ["core"],
      { PATH: "/bin" }, "darwin");
    expect(call.argv).toEqual(["sh", "-s", "--", "abc", "core"]);
    expect(call.argv).not.toContain("setsid");
  });
});

// Kein Urteil ist ein Grund, den man sehen muss: der Server startet den Check mit stdout und stderr auf „ignore“,
// darum steht jeder Abbruch in der Zeile, mit exit 3, und der Land-Tür fehlt damit nicht mehr das Warum.
describe("jeder Abbruch vor dem Urteil steht in merge-checks.jsonl", () => {
  const dirs: string[] = [];
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
  const probe = (hub: string | null): { dir: string; g: (...a: string[]) => string; rows: () => Record<string, unknown>[] } => {
    const dir = mkdtempSync(join(tmpdir(), "mc-abort-"));
    dirs.push(dir);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    g("init", "-q", "-b", "main");
    writeFileSync(join(dir, "a.txt"), "1\n");
    g("add", "-A");
    g("commit", "-q", "-m", "main");
    g("checkout", "-q", "-b", "bau/x");
    writeFileSync(join(dir, "x.txt"), "x\n");
    g("add", "-A");
    g("commit", "-q", "-m", "x");
    g("checkout", "-q", "main");
    if (hub) g("remote", "add", "hub", hub);
    const rows = (): Record<string, unknown>[] => readFileSync(join(dir, ".git", "merge-checks.jsonl"), "utf8").split("\n")
      .filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    return { dir, g, rows };
  };
  test("kein Helfer: exit 3 und der Grund, an der Spitze des Branches", async () => {
    const p = probe("https://example.com/fleet.git");
    const r = await mergeCheck({ repo: p.dir, branch: "bau/x", base: "main", env: {} });
    expect(r.code).toBe(3);
    expect(p.rows()).toHaveLength(1);
    expect(p.rows()[0]).toMatchObject({ branch: "bau/x", base: "main", tip: p.g("rev-parse", "bau/x"),
      verdict: "error", mergeable: false, exit: 3 });
    expect(String(p.rows()[0]!.why)).toContain("kein Helfer");
  });
  test("der Kandidat kommt nicht hinüber: exit 3, die Zeile nennt den lokalen Helfer", async () => {
    const p = probe("/pfad/zum/claude-fleet.git");
    const blocker = join(p.dir, "kein-verzeichnis");
    writeFileSync(blocker, "x\n"); // CI_HOME liegt unter einer Datei: kein lokales Repo, kein Push
    const r = await mergeCheck({ repo: p.dir, branch: "bau/x", base: "main", env: { CI_HOME: join(blocker, "ci") } });
    expect(r.code).toBe(3);
    expect(p.rows().at(-1)).toMatchObject({ verdict: "error", mergeable: false, exit: 3 });
    expect(String(p.rows().at(-1)!.why)).toContain("schieben");
  });
  test("der Runner stirbt vor dem Urteil: exit 3 mit Transport und Exit", async () => {
    const p = probe("/pfad/zum/claude-fleet.git");
    const runner = join(p.dir, "stirbt.sh");
    writeFileSync(runner, "#!/bin/sh\nexit 7\n");
    const r = await mergeCheck({ repo: p.dir, branch: "bau/x", base: "main", runner, env: { CI_HOME: join(p.dir, "ci") } });
    expect(r.code).toBe(3);
    const row = p.rows().at(-1)!;
    expect(row).toMatchObject({ verdict: "error", mergeable: false, exit: 3 });
    expect(String(row.why)).toContain("kein Urteil");
    expect(String(row.why)).toContain("sh exit 7");
    expect(existsSync(join(p.dir, "ci", "repo.git"))).toBe(true);
  });
});

// DIE REPARATUR EINES ROTEN main, am ganzen Check (Karte cb1edfe3, 27.10.): --repair verlangt, der Check
// belegt. Das Audit kommt hier aus einem `ctl.sh`, das der Test in den Arbeitsbaum legt (der echte liest
// `/api/post-land-audits`), der Runner ist eine Attrappe, die „green“ sagt, und die rote Prüfung nennt
// einen Satz, den eine Datei des Baums wörtlich trägt.
describe("die Reparatur eines roten main: belegt oder nicht", () => {
  const CLAIM = "the words in the structure's rectangles have Info's size — the drawing is not scaled";
  const NAME = `arbeitsorte DOM 1200x900 lane: ${CLAIM}`;
  const dirs: string[] = [];
  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
  function repo(): { dir: string; g: (...a: string[]) => string; rows: () => Record<string, unknown>[]; audit: (rows: unknown[]) => void;
    runner: string } {
    const dir = mkdtempSync(join(tmpdir(), "mc-repair-e2e-"));
    dirs.push(dir);
    const g = (...a: string[]): string => {
      const r = Bun.spawnSync(["git", "-C", dir, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
      if (r.exitCode !== 0) throw new Error(`git ${a.join(" ")}: ${r.stderr.toString()}`);
      return r.stdout.toString().trim();
    };
    g("init", "-q", "-b", "main");
    mkdirSync(join(dir, "e2e"));
    writeFileSync(join(dir, "e2e/probe.ts"), `claims["${CLAIM}"] = true;\n`);
    writeFileSync(join(dir, "a.txt"), "1\n");
    g("add", "-A");
    g("commit", "-q", "-m", "main");
    g("checkout", "-q", "-b", "bau/repariert");
    writeFileSync(join(dir, "e2e/probe.ts"), `claims["${CLAIM}"] = false;\n`);
    g("add", "-A");
    g("commit", "-q", "-m", "reparatur");
    g("checkout", "-q", "main");
    g("checkout", "-q", "-b", "bau/normal");
    writeFileSync(join(dir, "other.txt"), "x\n");
    g("add", "-A");
    g("commit", "-q", "-m", "andere datei");
    g("checkout", "-q", "main");
    g("remote", "add", "hub", join(dir, "helfer.git"));
    // ERST NACH den Commits: der Audit-Stand kommt aus einem ./ctl.sh im Arbeitsbaum (der echte liest
    // /api/post-land-audits), und der Runner ist eine Attrappe. Beide bleiben ungetrackt, sonst nähme sie
    // ein Branch-Commit mit und der Rücksprung auf main ließe sie verschwinden.
    writeFileSync(join(dir, "ctl.sh"), "#!/bin/sh\ncat \"$(dirname \"$0\")/audits.json\"\n");
    chmodSync(join(dir, "ctl.sh"), 0o755);
    const audit = (rows: unknown[]): void => { writeFileSync(join(dir, "audits.json"), JSON.stringify({ audits: rows })); };
    audit([{ at: 1793110000000, result: "red", mainSha: g("rev-parse", "main"), fails: [NAME] }]);
    const runner = join(dir, "green.sh");
    writeFileSync(runner, "#!/bin/sh\necho 'merge-check green 12'\n");
    const rows = (): Record<string, unknown>[] => readFileSync(join(dir, ".git", "merge-checks.jsonl"), "utf8").split("\n")
      .filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    return { dir, g, rows, audit, runner };
  }

  test("der Branch ändert die Datei, die die rote Prüfung nennt: mergebar, und die Zeile trägt den Beleg", async () => {
    const p = repo();
    const r = await mergeCheck({ repo: p.dir, branch: "bau/repariert", base: "main", repair: true, runner: p.runner, env: { CI_HOME: join(p.dir, "ci") } });
    expect(r.code).toBe(0);
    expect(r.row).toMatchObject({ verdict: "green", mergeable: true, repair: true, repairAsked: true });
    expect(String(r.row.why)).toContain("behebt den roten Audit");
    expect(String(r.row.why)).toContain("e2e/probe.ts");
    expect(r.row.repairProof).toMatchObject({ red: 1, files: ["e2e/probe.ts"],
      needles: [{ files: ["e2e/probe.ts"], touched: true }] });
    // die Notiz an der Spitze sagt es auch
    const note = p.g("notes", "--ref=merge-check", "show", "bau/repariert");
    expect(note).toContain("repair:");
  }, 60_000);

  test("der Branch ändert woanders: nicht mergebar, und die Zeile sagt, woran der Beleg fehlt", async () => {
    const p = repo();
    const r = await mergeCheck({ repo: p.dir, branch: "bau/normal", base: "main", repair: true, runner: p.runner, env: { CI_HOME: join(p.dir, "ci") } });
    expect(r.code).toBe(2);
    expect(r.row).toMatchObject({ verdict: "green", mergeable: false, repair: false, repairAsked: true });
    expect(String(r.row.why)).toContain("nicht als Reparatur belegt");
    expect(String(r.row.why)).toContain("berührt keine dieser Dateien (e2e/probe.ts)");
    expect(r.row.repairProof).toMatchObject({ red: 1, needles: [{ touched: false }] });
  }, 60_000);

  test("ohne --repair bleibt es beim alten Nein, auch für den Branch, der die Datei ändert", async () => {
    const p = repo();
    const r = await mergeCheck({ repo: p.dir, branch: "bau/repariert", base: "main", runner: p.runner, env: { CI_HOME: join(p.dir, "ci") } });
    expect(r.code).toBe(2);
    expect(r.row).toMatchObject({ verdict: "green", mergeable: false, repair: false });
    expect(r.row.repairAsked).toBeUndefined();
    expect(r.row.repairProof).toBeUndefined();
    expect(String(r.row.why)).toBe("main ist rot: Audit " + String(p.g("rev-parse", "main")).slice(0, 8) + " vom " + new Date(1793110000000).toISOString());
  }, 60_000);

  test("ein grünes main braucht keine Reparatur: die Flagge wird nicht zum Beleg", async () => {
    const p = repo();
    p.audit([{ at: 1793110000000, result: "green", mainSha: p.g("rev-parse", "main") }]);
    const r = await mergeCheck({ repo: p.dir, branch: "bau/repariert", base: "main", repair: true, runner: p.runner, env: { CI_HOME: join(p.dir, "ci") } });
    expect(r.code).toBe(0);
    expect(r.row).toMatchObject({ verdict: "green", mergeable: true, repair: false, repairAsked: true });
    expect(String(r.row.repairWhy)).toContain("nicht bekannt rot");
    expect(r.row.repairProof).toBeUndefined();
  }, 60_000);
});

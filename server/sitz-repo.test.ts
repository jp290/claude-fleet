// Das Repo der Sitze kennt die früheren Läufe der Datei nicht (server/sitz-repo.ts; Schritt 5, Lauf 2: der Prover las die Befunde von Lauf 1,
// der Finder sah dessen Commit-Text). Ein Fixture-Repo mit Geschichte, einer Aufgaben-Datei samt Lauf und dessen Beweis-Skript.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sh } from "./branches-testkit";
import { beweisOrte, sitzRepo } from "./sitz-repo";

const TMP = mkdtempSync(join(tmpdir(), "sitz-repo-"));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const AUFGABE = "docs/aufgaben/pruefung.fleet.json";
const LAUF_TEXT = "F1 bestätigt: der Riegel fehlt in server.ts:42";
function quelle(): string {
  const q = join(TMP, "quelle");
  mkdirSync(join(q, "docs", "aufgaben"), { recursive: true });
  mkdirSync(join(q, "beweise"));
  sh(TMP, "init", "-q", "-b", "main", q);
  writeFileSync(join(q, "server.ts"), "export const riegel = false;\n");
  writeFileSync(join(q, "beweise", "alt.sh"), "echo ein Beweis einer anderen Aufgabe\n");
  // eine Datei, die git archive (export-ignore) und git add (.gitignore) ausließen; sie ist im Baum und muss es bleiben
  writeFileSync(join(q, ".gitignore"), "*.log\n");
  writeFileSync(join(q, ".gitattributes"), "spur.log export-ignore\n");
  writeFileSync(join(q, "spur.log"), "getrackt trotz .gitignore\n");
  writeFileSync(join(q, AUFGABE), JSON.stringify({ fleet: "konstellation", name: "Prüfung", positionen: [{ id: "beweiser",
    eigeneDatei: { titel: "b.md", abschnitte: [{ titel: "# Beweise", text: "Ein Beweis ist ein Skript beweise/<n>.sh auf deinem Branch." }] } }] }, null, 2));
  sh(q, "add", "-A");
  sh(q, "add", "-f", "spur.log");
  sh(q, "commit", "-q", "-m", "die Aufgabe");
  // Lauf 1: sein Beweis-Skript und der Lauf in der Datei, mit einem Commit-Text, der den Befund nennt
  writeFileSync(join(q, "beweise", "f1.sh"), "curl … # zeigt F1\n");
  const o = JSON.parse(readFileSync(join(q, AUFGABE), "utf8"));
  writeFileSync(join(q, AUFGABE), JSON.stringify({ ...o, laeufe: [{ befunde: [{ titel: LAUF_TEXT, beleg: "beweise/f1.sh an einer frischen Instanz" }] }] }, null, 2));
  sh(q, "add", "-A");
  sh(q, "commit", "-q", "-m", `Lauf 1: ${LAUF_TEXT}`);
  return q;
}

describe("ein Repo für die Sitze ohne frühere Läufe", () => {
  const q = quelle();
  const ziel = join(TMP, "sitze");
  const r = sitzRepo(q, "HEAD", ziel, AUFGABE);
  test("ein einziger Commit ohne Geschichte: weder git log --all noch ein Ref kennt den Text von Lauf 1", () => {
    if (typeof r === "string") throw new Error(r);
    expect(sh(ziel, "rev-list", "--all", "--count")).toBe("1");
    expect(sh(ziel, "log", "--all", "--format=%B")).not.toContain(LAUF_TEXT);
    expect(sh(ziel, "for-each-ref", "--format=%(refname)")).toBe("refs/heads/main");
  });
  test("die Datei ohne ihre Läufe, ihr Beweis weg; was der Lauf nur als Ursache nennt (server.ts) und ein fremder Beweis bleiben", () => {
    if (typeof r === "string") throw new Error(r);
    const datei = readFileSync(join(ziel, AUFGABE), "utf8");
    expect([datei.includes(LAUF_TEXT), "laeufe" in JSON.parse(datei), JSON.parse(datei).name]).toEqual([false, false, "Prüfung"]);
    expect([existsSync(join(ziel, "beweise", "f1.sh")), existsSync(join(ziel, "server.ts")), existsSync(join(ziel, "beweise", "alt.sh"))]).toEqual([false, true, true]);
    expect([r.laeufe, r.entfernt]).toEqual([1, ["beweise/f1.sh"]]);
    expect(sh(ziel, "status", "--porcelain")).toBe("");
    expect(sh(ziel, "ls-tree", "-r", "--name-only", "HEAD").split("\n")).toContain("spur.log");
  });
  test("lehnt ab: ein volles Ziel, eine Datei, die nicht im Baum steht", () => {
    expect(sitzRepo(q, "HEAD", ziel, AUFGABE)).toBe(`${ziel} ist nicht leer`);
    expect(sitzRepo(q, "HEAD", join(TMP, "leer"), "docs/fehlt.json")).toEqual(expect.stringContaining("steht nicht im Baum"));
  });
  // Mängel 118: ein Worktree eines blinden Haupt-Repos statt eines frischen Repos, damit ein echter claude nicht nach Vertrauen fragt
  test("mit Haupt-Repo: ein Worktree auf einem Sitz-Branch; ein zweiter Stand kommt dazu; git log --all kennt nur Sitz-Commits ohne Vorfahren", () => {
    const haupt = join(TMP, "blind");
    const a = sitzRepo(q, "HEAD", join(TMP, "w1"), AUFGABE, haupt);
    const b = sitzRepo(q, "HEAD~1", join(TMP, "w2"), AUFGABE, haupt);
    if (typeof a === "string") throw new Error(a);
    if (typeof b === "string") throw new Error(b);
    expect(sh(haupt, "for-each-ref", "--format=%(refname)").split("\n").every((r) => r.startsWith("refs/heads/sitz/") || r === "refs/heads/main")).toBe(true);
    // main zeigt auf den jüngsten Stand: die Basis eines Board-Branches, den ein Sitz dort anlegt (sonst scheiterte der Finder an einem leeren main)
    expect(sh(haupt, "rev-parse", "main")).toBe(b.commit);
    const alle = sh(join(TMP, "w1"), "log", "--all", "--format=%H %P|%s").split("\n");
    expect(alle.map((x) => x.split("|")[1])).toEqual(expect.arrayContaining([expect.stringMatching(/^Stand /)]));
    expect([alle.length, alle.every((x) => /^[0-9a-f]{40} \|Stand [0-9a-f]{9}$/.test(x)), alle.join("\n").includes(LAUF_TEXT)]).toEqual([2, true, false]);
    expect(sh(join(TMP, "w1"), "rev-parse", "--path-format=absolute", "--git-common-dir")).toBe(join(realpathSync(haupt), ".git"));
    expect(existsSync(join(TMP, "w1", "beweise", "f1.sh"))).toBe(false);
  });
  test("was die Sitze eines Laufs ins Haupt-Repo committen, sieht die nächste Instanz nicht: abgelehnt, bis es abgeräumt ist", () => {
    const haupt = join(TMP, "blind2"), w = join(TMP, "lauf-w");
    const a = sitzRepo(q, "HEAD", w, AUFGABE, haupt);
    if (typeof a === "string") throw new Error(a);
    // der Prover committet auf seinen Sitz-Branch, der Finder auf einen Board-Branch
    writeFileSync(join(w, "beweise", "r3f1.sh"), "echo Befund von Lauf 3\n");
    sh(w, "add", "-A");
    sh(w, "commit", "-q", "-m", "Lauf 3: F1 bestätigt");
    const befund = sh(w, "rev-parse", "HEAD");
    sh(w, "branch", "branch/finder");
    expect(sitzRepo(q, "HEAD", join(TMP, "naechste"), AUFGABE, haupt)).toEqual(expect.stringContaining("nimmt --alte-zweige-weg sie weg"));
    // solange die Instanz des Laufs steht, bleibt ihr Branch
    expect(sitzRepo(q, "HEAD", join(TMP, "naechste"), AUFGABE, haupt, true)).toEqual(expect.stringContaining("noch in einem Worktree ausgecheckt"));
    rmSync(w, { recursive: true, force: true });
    const n = sitzRepo(q, "HEAD", join(TMP, "naechste"), AUFGABE, haupt, true);
    if (typeof n === "string") throw new Error(n);
    const alles = sh(join(TMP, "naechste"), "log", "--all", "--format=%s");
    expect([alles, sh(haupt, "for-each-ref", "--format=%(refname)").split("\n").length]).toEqual([expect.stringMatching(/^Stand [0-9a-f]{9}$/), 2]);
    // ...auch nicht im Objektspeicher (git fsck fände ihn sonst)
    expect(Bun.spawnSync(["git", "-C", haupt, "cat-file", "-e", befund]).exitCode).not.toBe(0);
  });
  test("lehnt ein Haupt-Repo mit fremder Geschichte ab: einen Klon mit Remote, einen Branch, der kein Sitz-Branch ist", () => {
    const klon = join(TMP, "klon");
    sh(TMP, "clone", "-q", q, klon);
    expect(sitzRepo(q, "HEAD", join(TMP, "w3"), AUFGABE, klon)).toEqual(expect.stringContaining("hat einen Remote"));
    sh(klon, "remote", "remove", "origin");
    expect(sitzRepo(q, "HEAD", join(TMP, "w3"), AUFGABE, klon)).toEqual(expect.stringContaining("kennt refs/heads/main"));
    expect(existsSync(join(TMP, "w3"))).toBe(false);
  });
  test("ein Platzhalter steht für einen Namen ohne Schrägstrich", () => {
    const [re] = beweisOrte("Ein Skript beweise/<n>.sh auf deinem Branch");
    expect([re?.test("beweise/r2f1.sh"), re?.test("beweise/a/b.sh"), re?.test("beweise/r2f1.ts")]).toEqual([true, false, false]);
  });
});

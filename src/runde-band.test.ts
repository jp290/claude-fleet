// Die Instanz einer Runde sagt, was sie zeigt: welche Branches drin sind und welcher mit welchem Grund draußen
// blieb (Owner 22.10.: „[Zitat entfernt]“). Hier die ganze Kette ohne
// Browser: eine echte Runde in einem Temp-Repo, `testinstanz.sh source` misst sie wie `up` und `refresh`, und
// dieselben Funktionen wie das Board (src/protocol.ts) machen die Worte des Bands daraus.
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { upRound, type RoundDeps } from "../server/runde";
import { instanceBandText, instanceSourceFrom } from "./protocol";

const TMP = realpathSync(mkdtempSync(join(tmpdir(), "fleet-runde-band-")));
afterAll(() => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const git = (dir: string, ...args: string[]) => {
  const r = Bun.spawnSync(["git", "-C", dir, ...args], { env: ENV });
  return { out: r.stdout.toString().trim(), err: r.stderr.toString().trim(), code: r.exitCode };
};
const sh = (dir: string, ...args: string[]): string => {
  const r = git(dir, ...args);
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.err}`);
  return r.out;
};
const clock = () => "13:30";

describe("das Band einer Runde", () => {
  test("eine echte Runde, gemessen von testinstanz.sh: Name, main, die Branches drin, der kollidierende mit Grund", async () => {
    const repo = join(TMP, "repo");
    Bun.spawnSync(["mkdir", "-p", repo]);
    sh(repo, "init", "-q", "-b", "main");
    copyFileSync(join(import.meta.dir, "..", "testinstanz.sh"), join(repo, "testinstanz.sh"));
    writeFileSync(join(repo, "README"), "eins\n");
    sh(repo, "add", "."); sh(repo, "commit", "-q", "-m", "start");
    for (const [b, file, text] of [["branch/a", "README", "A\n"], ["branch/b", "b.txt", "b\n"], ["branch/c", "README", "C\n"]]) {
      sh(repo, "checkout", "-q", "-b", b, "main");
      writeFileSync(join(repo, file), text);
      sh(repo, "add", file);
      sh(repo, "commit", "-q", "-m", b);
    }
    sh(repo, "checkout", "-q", "main");
    const d: RoundDeps = { git: async (dir, ...a) => git(dir, ...a), ti: async () => ({ code: 0, out: "" }), stop: async () => null,
      install: async () => ({ code: 0, out: "" }), landed: () => false, parked: async () => false, held: () => false,
      scaffold: ["node_modules/"], now: () => 1 };
    const up = await upRound(d, { repo, name: "probe", branches: ["branch/a", "branch/b", "branch/c"], mode: "mixed" });
    if ("error" in up) throw new Error(up.error);
    const measured = Bun.spawnSync(["sh", join(up.round.path, "testinstanz.sh"), "source"], { env: { ...ENV, FLEET_TI_ROOT: TMP } });
    const src = instanceSourceFrom(measured.stdout.toString().trim());
    if (!src) throw new Error(`keine Messung: ${measured.stderr}`);
    const main = sh(repo, "rev-parse", "main").slice(0, 7);
    const band = instanceBandText(src, clock);
    expect(band.text).toBe(`Round probe · main ${main} · with branch/a, branch/b · without branch/c: kollidiert mit branch/a in README`);
    expect(band.title).toContain("Landing still goes branch by branch.");
  });
  test("ohne Runde bleibt das Band, wie es war", () => {
    const src = instanceSourceFrom(JSON.stringify({ head: "a".repeat(40), branch: "branch/x", dirty: 0, measuredAt: 1, target: { branch: "main", head: "b".repeat(40), ahead: 0 } }));
    expect(src && instanceBandText(src, clock).text).toBe("Branch branch/x · Head at start aaaaaaa · all already on main");
  });
  test("eine unlesbare Runde fällt weg, ein Mitglied ohne gültigen Namen auch, ein Grund wird gekürzt und ohne Steuerzeichen", () => {
    const base = { head: "a".repeat(40), branch: null, dirty: 0, measuredAt: 1, target: null };
    expect(instanceSourceFrom(JSON.stringify({ ...base, round: { name: "Probe" } }))?.round).toBeUndefined();
    expect(instanceSourceFrom(JSON.stringify({ ...base, round: [1] }))?.round).toBeUndefined();
    const r = instanceSourceFrom(JSON.stringify({ ...base, round: { name: "p", main: "x", in: [{ branch: "a b" }, { branch: "ok" }],
      out: [{ branch: "c", why: `zeile\nzwei${"x".repeat(300)}` }, { branch: "d" }] } }))?.round;
    expect(r?.main).toBeNull();
    expect(r?.in).toEqual([{ branch: "ok", head: null }]);
    expect(r?.out.map((o) => o.why.length)).toEqual([200, "Grund unbekannt".length]);
    expect(r?.out[0].why.startsWith("zeile zwei")).toBe(true);
    expect(instanceBandText({ ...base, measuredAt: 1, round: { name: "p", main: null, in: [], out: [] } } as never, clock).text)
      .toBe("Round p · main unknown · no branch in it");
  });
});

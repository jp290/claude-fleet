// Prüf-Gedächtnis am Merge-Check: was der Check auf dem Kandidatenbaum fuhr, steht danach als Siegel an diesem Baum — mit den Units aus den
// `shard-unit`-Zeilen der Audit-Shards, dem Run-Ordner als Lauf und der Tiefe „check“. Der Runner ist eine Attrappe (kein Helfer, keine Suite).
import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeCheck } from "./merge-check";
import { deckung, geforderteUnits, leseSiegel } from "../server/pruef-siegel";

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

function repo(runnerOut: string): { dir: string; runner: string; g: (...a: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "mc-siegel-"));
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
  writeFileSync(join(dir, "b.txt"), "2\n");
  g("add", "-A");
  g("commit", "-q", "-m", "arbeit");
  g("checkout", "-q", "main");
  g("remote", "add", "hub", join(dir, "helfer.git"));
  writeFileSync(join(dir, "ctl.sh"), "#!/bin/sh\ncat \"$(dirname \"$0\")/audits.json\"\n");
  chmodSync(join(dir, "ctl.sh"), 0o755);
  writeFileSync(join(dir, "audits.json"), JSON.stringify({ audits: [{ at: 1, result: "green", mainSha: g("rev-parse", "main") }] }));
  const runner = join(dir, "runner.sh");
  writeFileSync(runner, `#!/bin/sh\ncat <<'EOT'\nrun 1029-feedbeef wait=0\n${runnerOut}\nEOT\n`);
  return { dir, runner, g };
}
const UNITS = "a1 shard-unit core 1000 ms\na1 shard-unit lanes 2000 ms\na2 shard-unit watch 3000 ms";

test("ein grüner Check schreibt sein Siegel an den Kandidatenbaum: Units, Tiefe check, Run-Ordner als Lauf", async () => {
  const p = repo(`${UNITS}\nmerge-check green 12`);
  const r = await mergeCheck({ repo: p.dir, branch: "bau/x", base: "main", runner: p.runner, env: { CI_HOME: join(p.dir, "ci"), FLEET_MACHINE: "mac" } });
  expect(r.row).toMatchObject({ verdict: "green", units: { core: 1000, lanes: 2000, watch: 3000 } });
  const siegel = await leseSiegel(p.dir, String(r.row.tree));
  expect(siegel).toHaveLength(1);
  expect(siegel[0]).toMatchObject({ tiefe: "check", ergebnis: "green", maschine: "mac", lauf: "1029-feedbeef" });
  expect(siegel[0]!.units.sort()).toEqual(["core", "lanes", "watch"]);
  // der Check deckt nur, was er fuhr: der Rest ist die Lücke, die der Audit nach dem Land fährt
  const d = deckung(siegel, geforderteUnits());
  expect(d.gedeckt.sort()).toEqual(["core", "lanes", "watch"]);
  expect(d.luecke).toContain("dom");
});

test("ein roter Check wird mitgeschrieben und deckt nichts", async () => {
  const p = repo(`${UNITS}\nmerge-check red 12 — core`);
  const r = await mergeCheck({ repo: p.dir, branch: "bau/x", base: "main", runner: p.runner, env: { CI_HOME: join(p.dir, "ci"), FLEET_MACHINE: "mac" } });
  expect(r.row).toMatchObject({ verdict: "red" });
  const siegel = await leseSiegel(p.dir, String(r.row.tree));
  expect(siegel.map((s) => s.ergebnis)).toEqual(["red"]);
  expect(deckung(siegel, geforderteUnits()).gedeckt).toEqual([]);
});

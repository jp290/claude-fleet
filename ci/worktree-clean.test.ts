// Kein Test und kein Werkzeug lässt fleet.json im Worktree liegen. Zwei gelandete Branches blieben am
// 24.10. stehen, weil darin ein leeres fleet.json („{}“) lag (server/branch-ende.ts#endVerdict). Ein Sitz
// hatte es von Hand angelegt, weil e2e/harness.ts ohne die Datei beim Import abbrach. Geprüft wird
// zweierlei: Die Harness lädt aus einem Baum ohne fleet.json und legt keines an. Und der Wächter
// ci/worktree-clean.ts macht einen Unit-Lauf rot, der eine Datei in sein cwd schreibt, aber nicht
// einen, der ins Temp-Verzeichnis schreibt. Beides läuft in einem eigenen Temp-Baum.
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "..");
const dirs: string[] = [];
const scratch = (name: string): string => { const d = mkdtempSync(join(tmpdir(), `${name}-`)); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

// ein Unit-Lauf in einem eigenen git-Baum, mit dem Wächter wie im Repo; der Test schreibt sein Byte nach `target`
function unitRun(target: "cwd" | "tmp"): { code: number; out: string; dir: string } {
  const dir = scratch("worktree-clean");
  mkdirSync(join(dir, "ci"));
  cpSync(join(REPO, "ci", "worktree-clean.ts"), join(dir, "ci", "worktree-clean.ts"));
  cpSync(join(REPO, "bunfig.toml"), join(dir, "bunfig.toml"));
  writeFileSync(join(dir, ".gitignore"), "fleet.json\n");
  writeFileSync(join(dir, "ci", "writer.test.ts"), `import { test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("schreibt Zustand", () => {
  const where = ${JSON.stringify(target)} === "cwd" ? process.cwd() : mkdtempSync(join(tmpdir(), "wc-"));
  writeFileSync(join(where, "fleet.json"), "{}");
});
`);
  Bun.spawnSync(["git", "init", "-q", dir]);
  const r = Bun.spawnSync([process.execPath, "test", "./ci"], { cwd: dir, env: { ...process.env } });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString(), dir };
}

describe("der Wächter nach der Unit-Suite", () => {
  test("ein Test, der fleet.json in sein cwd schreibt, macht den Lauf rot und wird benannt", () => {
    const r = unitRun("cwd");
    expect(existsSync(join(r.dir, "fleet.json"))).toBe(true);
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("left new files in the worktree");
    expect(r.out).toContain("fleet.json");
  }, 30_000);

  test("ein Test, der ins Temp-Verzeichnis schreibt, lässt ihn grün", () => {
    const r = unitRun("tmp");
    expect(existsSync(join(r.dir, "fleet.json"))).toBe(false);
    expect({ code: r.code, out: r.out }).toEqual({ code: 0, out: expect.not.stringContaining("left new files") });
  }, 30_000);
});

describe("e2e/harness.ts in einem Baum ohne fleet.json", () => {
  test("lädt, nimmt den Token aus FLEET_TOKEN und legt keine fleet.json an", () => {
    const dir = scratch("harness-ohne-zustand");
    cpSync(join(REPO, "e2e"), join(dir, "e2e"), { recursive: true });
    const r = Bun.spawnSync([process.execPath, "-e",
      `const h = await import(${JSON.stringify(join(dir, "e2e", "harness.ts"))}); console.log("TOKEN=" + (h.TOKEN === "probe" ? "env" : "other"));`],
      { cwd: dir, env: { ...process.env, FLEET_SOCK: "wc-nobody", FLEET_PORT: "1", FLEET_TOKEN: "probe", FLEET_E2E_TRAIL_DIR: "" } });
    expect({ code: r.exitCode, err: r.exitCode === 0 ? "" : r.stderr.toString().slice(0, 600) }).toEqual({ code: 0, err: "" });
    expect(r.stdout.toString()).toContain("TOKEN=env");
    expect(existsSync(join(dir, "fleet.json"))).toBe(false);
  }, 30_000);
});

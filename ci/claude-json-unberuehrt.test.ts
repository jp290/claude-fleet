// Der Wächter ci/claude-json-unberuehrt.ts macht einen Unit-Lauf rot, der einen Vertrauenseintrag für einen Temp-Ordner in der
// ~/.claude.json des Aufrufers hinterlässt, und lässt einen Lauf grün, der nur in ein eigenes HOME schreibt. Beides läuft in einem eigenen
// Temp-Baum, mit einem falschen HOME als „Aufrufer“: die echte Datei des Owners wird nie gelesen oder geschrieben.
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { testSpuren } from "./claude-json-unberuehrt";

const REPO = resolve(import.meta.dir, "..");
const dirs: string[] = [];
const scratch = (name: string): string => { const d = realpathSync(mkdtempSync(join(tmpdir(), `${name}-`))); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

// ein Unit-Lauf mit dem Wächter wie im Repo; der Test schreibt den Eintrag eines Fixture-Ordners nach `ziel` und räumt den Ordner weg
function unitRun(ziel: "aufrufer" | "eigenes"): { code: number; out: string; datei: string } {
  const dir = scratch("claude-json-waechter");
  mkdirSync(join(dir, "ci")); mkdirSync(join(dir, "server"));
  cpSync(join(REPO, "ci", "claude-json-unberuehrt.ts"), join(dir, "ci", "claude-json-unberuehrt.ts"));
  cpSync(join(REPO, "server", "claude-vertrauen.ts"), join(dir, "server", "claude-vertrauen.ts"));
  writeFileSync(join(dir, "bunfig.toml"), '[test]\npreload = ["./ci/claude-json-unberuehrt.ts"]\n');
  const home = join(dir, "aufrufer-home"); mkdirSync(home);
  const datei = join(home, ".claude.json");
  writeFileSync(datei, JSON.stringify({ projects: { "/Users/o/projekt": { hasTrustDialogAccepted: true } } }, null, 2));
  writeFileSync(join(dir, "ci", "server-im-test.test.ts"), `import { test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("ein Server öffnet einen Sitz in einer Fixture", () => {
  const fixture = mkdtempSync(join(tmpdir(), "fleet-branches-"));
  const datei = ${JSON.stringify(ziel)} === "aufrufer" ? join(process.env.HOME!, ".claude.json") : join(fixture, ".claude.json");
  let o: { projects: Record<string, unknown> } = { projects: {} };
  try { o = JSON.parse(readFileSync(datei, "utf8")); } catch {}
  o.projects[join(fixture, "repo")] = { hasTrustDialogAccepted: true };
  writeFileSync(datei, JSON.stringify(o));
  rmSync(fixture, { recursive: true, force: true });
});
`);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && k !== "CLAUDE_CONFIG_DIR") env[k] = v;
  const r = Bun.spawnSync([process.execPath, "test", "./ci"], { cwd: dir, env: { ...env, HOME: home } });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString(), datei };
}

describe("der Wächter über die ~/.claude.json des Aufrufers", () => {
  test("ein Test, der den Eintrag einer Fixture in die Datei des Aufrufers schreibt, macht den Lauf rot und wird benannt", () => {
    const r = unitRun("aufrufer");
    expect(r.code).not.toBe(0);
    expect(r.out).toContain("the unit suite left 1 trust entry in");
    expect(r.out).toContain("fleet-branches-");
    // der Eintrag des Owners steht noch, der Wächter räumt nichts
    expect(Object.keys(JSON.parse(readFileSync(r.datei, "utf8")).projects)).toContain("/Users/o/projekt");
  }, 30_000);
  test("ein Test, der nur in ein eigenes HOME schreibt, bleibt grün", () => {
    const r = unitRun("eigenes");
    expect({ code: r.code, out: r.code === 0 ? "" : r.out.slice(-1500) }).toEqual({ code: 0, out: "" });
  }, 30_000);
  test("was eine laufende Sitzung des Owners schreibt, ist keine Spur: ein stehender Ordner, ein Ordner außerhalb von Temp, ein alter Eintrag", () => {
    const weg = (p: string) => p !== "/tmp/steht";
    expect(testSpuren(["/tmp/alt"], ["/tmp/alt", "/tmp/steht", "/Users/o/neu", "/tmp/fleet-x/repo"], ["/tmp"], (p) => !weg(p)))
      .toEqual(["/tmp/fleet-x/repo"]);
  });
});

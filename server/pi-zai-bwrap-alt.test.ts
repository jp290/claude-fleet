// Mangel 175: der Zaun braucht ein bwrap mit Overlay (`--overlay-src`/`--tmp-overlay`). Ein älteres bwrap lehnt die Option ab; dann muss die
// Zeile das sagen und pi NICHT starten, nie auf eine schreibbare Bindung ausweichen. Der Test erzeugt die echte Zeile von PI_ZAI_HARNESS
// (in einem Kindprozess, wie server/load.test.ts den Import beweist), setzt ein Stub-bwrap ein, das die Option ablehnt, und führt die Zeile aus.
import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = realpathSync(mkdtempSync(join(tmpdir(), "fleet-bwrap-alt-")));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const ROOT = join(import.meta.dir, "..");

function stub(dir: string, name: string, body: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

// die Zeile eines pi-zai-Sitzes mit dem genannten bwrap, gebaut in einem Kindprozess mit eigener Isolation
async function zeileMit(bwrap: string, work: string): Promise<string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith("FLEET_")) env[k] = v;
  Object.assign(env, {
    FLEET_HOST: "127.0.0.1", FLEET_PORT: String(40_000 + (process.pid % 20_000)), FLEET_SOCK: `bwrapalt${process.pid}`,
    FLEET_STATE_DIR: join(root, "state"), FLEET_PI_ZAI_DENY_ROOTS: join(root, "deny"), FLEET_PI_ZAI_AGENT_DIR: join(root, "agent"),
    FLEET_PI_ZAI_KEY_FILE: join(root, "key"), SHELL: "/bin/sh",
    // PATH_EXPORT der Zeile friert diesen PATH ein: der Stub-pi steht vorn, ein echtes pi wird nie gefunden, bevor er es ist
    PATH: `${join(root, "bin")}:${process.env.PATH}`,
  });
  const script = `const m = await import(${JSON.stringify(join(ROOT, "server.ts"))});
    console.log(m.PI_ZAI_HARNESS.spawnCmd({ sessionId: "s1", resume: false, model: null, effort: null, container: "", containerContext: "",
      cwd: ${JSON.stringify(work)}, browserMcp: false, context: null, permissions: null, fleetCheckout: false, remoteName: null, fenceBwrap: ${JSON.stringify(bwrap)} }));`;
  const proc = Bun.spawn([process.execPath, "--no-env-file", "-e", script], { cwd: ROOT, env, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  return out.trim();
}

describe("ein bwrap ohne Overlay-Unterstützung: das Banner, kein pi", () => {
  test("die erzeugte Zeile zeigt das bwrap-Banner und startet pi nicht; ein bwrap mit Overlay lässt pi starten", async () => {
    for (const d of ["state", "deny", "agent", "work", "bin"]) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, "key"), "platzhalter");
    const marker = join(root, "pi-started");
    // ein pi, das nur seinen Start vermerkt; PATH_EXPORT der Zeile setzt den PATH des Kindprozesses, also steht der Stub dort vorn
    const piDir = join(root, "bin");
    stub(piDir, "pi", `echo started > '${marker}'`);
    const alt = stub(join(root, "alt"), "bwrap", `for a in "$@"; do case "$a" in --overlay-src|--tmp-overlay) echo "bwrap: Unknown option $a" >&2; exit 1;; esac; done\nexit 0`);
    const line = await zeileMit(alt, join(root, "work"));
    expect(line).toContain("fleet_pz");
    const run = (l: string) => Bun.spawnSync(["/bin/sh", "-c", l], { env: { ...process.env, PATH: `${piDir}:${process.env.PATH}` }, stdin: "ignore", timeout: 30_000 });

    const r = run(line);
    const out = `${r.stdout}${r.stderr}`;
    expect(out).toContain("bwrap: Unknown option --overlay-src");
    // das Banner nennt den Zaun der Plattform (bwrap), nicht sandbox-exec
    expect(out).toContain("pi was NOT started - its read fence (bwrap) failed its self-test");
    expect(out).not.toContain("sandbox-exec");
    expect(existsSync(marker)).toBe(false);

    // Gegenprobe: dasselbe Stub-bwrap, das die Option annimmt (und nach den Optionen das Kommando ausführt), lässt pi starten, es ist also der Overlay-Fehler, der es hält
    const ok = stub(join(root, "neu"), "bwrap", `while [ $# -gt 0 ] && [ "$1" != pi ] && [ "$1" != /usr/bin/true ]; do shift; done\nexec "$@"`);
    expect(existsSync(marker)).toBe(false);
    const line2 = await zeileMit(ok, join(root, "work"));
    run(line2);
    expect(existsSync(marker)).toBe(true);
  }, 60_000);
});

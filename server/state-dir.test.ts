// FLEET_STATE_DIR wirkt nur, wenn er gesetzt ist. Ungesetzt liegt der Zustand wie bisher neben server.ts:
// jeder Zustands- und Ledger-Pfad in server.ts und server/audit-log.ts ist `${STATE_DIR}/…`, also
// zeichengleich mit dem alten `${import.meta.dir}/…`, solange STATE_DIR das Verzeichnis von server.ts ist.
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

const ROOT = join(import.meta.dir, "..");
const MODULE = join(import.meta.dir, "state-dir.ts");

// der Wert wird beim Import gelesen, also je Fall ein eigener Prozess
function stateDirWith(value: string | undefined): string {
  const env: Record<string, string> = {};
  for (const [key, v] of Object.entries(process.env))
    if (v !== undefined && key !== "FLEET_STATE_DIR") env[key] = v;
  if (value !== undefined) env.FLEET_STATE_DIR = value;
  const run = Bun.spawnSync([process.execPath, "-e",
    `const { STATE_DIR } = await import(${JSON.stringify(MODULE)}); process.stdout.write(STATE_DIR);`], { cwd: ROOT, env });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
  return run.stdout.toString();
}

describe("FLEET_STATE_DIR", () => {
  test("ungesetzt: das Verzeichnis von server.ts, Zeichen für Zeichen", () => {
    expect(stateDirWith(undefined)).toBe(ROOT);
  });
  test("leer zählt als ungesetzt", () => {
    expect(stateDirWith("")).toBe(ROOT);
  });
  test("gesetzt: genau dieses Verzeichnis", () => {
    expect(stateDirWith("/tmp/fleet-zustand-probe")).toBe("/tmp/fleet-zustand-probe");
  });
  test("relativ: gegen das Arbeitsverzeichnis des Servers aufgelöst", () => {
    expect(stateDirWith("zustand")).toBe(resolve(ROOT, "zustand"));
  });
});

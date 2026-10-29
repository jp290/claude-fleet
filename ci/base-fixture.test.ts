// Die Basis-Fixture eines gefilterten Laufs nennt ein REPOSITORY, keinen Namen aus dem Home
// (e2e/base-fixture.ts). Solange sie `~/claude-fleet` war — der Haupt-Checkout des Owners —, lief sie
// nur auf dem Host: hinter Fleets Zaun ist HOME das Temp-Home des Sitzes, dort gibt es kein
// `claude-fleet`, und `POST /api/slots/1/open` antwortete 400. Der Lauf starb Sekunden später an
// seiner eigenen Fixture, und das sah aus wie ein Ergebnis. Geprüft wird am Verhalten: im Home liegt
// ein gleichnamiger Ordner, und trotzdem nennt die Fixture ein frisches Repository, das der Server
// öffnen kann (mit Seed-Commit, wie der Slot 1, den slots.ts selbst anlegt).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { baseFixtureRepo } from "../e2e/base-fixture";

const dirs: string[] = [];
const scratch = (name: string): string => { const d = mkdtempSync(join(tmpdir(), `${name}-`)); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

const git = (dir: string, ...args: string[]): number => Bun.spawnSync(["git", ...args], { cwd: dir }).exitCode;

describe("Basis-Fixture: Slot 1 bekommt ein Repository, keinen Namen aus dem Home", () => {
  test("ein Home mit gleichnamigem Ordner entscheidet die Fixture nicht", () => {
    const home = scratch("fleet-base-home");
    const before = process.env.HOME;
    try {
      // das alte Home des Owners trug ~/claude-fleet — ein gezäunter Sitz trägt ein Temp-Home ohne ihn
      mkdirSync(join(home, "claude-fleet"));
      process.env.HOME = home;
      const repo = baseFixtureRepo(scratch("fleet-base-scratch"));
      expect(repo.startsWith(`${home}/`)).toBe(false);
    } finally {
      if (before === undefined) delete process.env.HOME; else process.env.HOME = before;
    }
  });

  test("was sie nennt, ist ein Git-Repository mit Seed-Commit — der Server kann es öffnen", () => {
    const repo = baseFixtureRepo(scratch("fleet-base-scratch"));
    expect(git(repo, "rev-parse", "--git-dir")).toBe(0);
    expect(git(repo, "rev-parse", "HEAD")).toBe(0);
  });
});

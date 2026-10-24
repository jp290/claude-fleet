// Der Schnitt der Suite in Shards, wie der Nachtlauf ihn fährt (Mangel 147): Die Mutanten der dom-Unit
// liegen nicht mehr als eine Unit auf einem Shard, der jede Nacht am 60-min-Claim verfiel, sondern
// als Scheiben auf allen. Jeder andere Lauf schneidet wie vorher.
import { describe, expect, test } from "bun:test";
import { DOM_MUTANT_SLICES, mutantSlice, SHARD_UNITS, shardPlan, unitsOfRun } from "../e2e/ctx";

const slices = SHARD_UNITS.filter((u) => u.mutantsOf === "dom").map((u) => u.unit);
const weight = new Map(SHARD_UNITS.map((u) => [u.unit, u.seconds]));
// die Units, die der Merge-Check in s1–s3 auslässt (ci/merge-check-run.sh BIG_UNITS)
const BIG = new Set(["core", "core-tasks", "programs", "lanes", "watch", "dom"]);

describe("der Nachtlauf verteilt die dom-Mutanten", () => {
  test("die Mutanten stehen als Scheiben im Plan des Mutanten-Modus", () => {
    expect(DOM_MUTANT_SLICES).toBeGreaterThan(1);
    for (const n of [3, 4, 5]) {
      const plan = shardPlan(n, undefined, true);
      for (const s of slices) expect(plan.has(s)).toBe(true);
    }
  });

  test("kein Shard trägt mehr als die Hälfte von dom samt Mutanten", () => {
    const family = ["dom", ...slices];
    const total = family.reduce((a, u) => a + weight.get(u)!, 0);
    for (const n of [3, 4, 5]) {
      const plan = shardPlan(n, undefined, true);
      const perShard = new Map<number, number>();
      for (const u of family) perShard.set(plan.get(u)!, (perShard.get(plan.get(u)!) ?? 0) + weight.get(u)!);
      expect(Math.max(...perShard.values())).toBeLessThanOrEqual(total / 2);
    }
  });
});

describe("jeder andere Lauf schneidet wie vorher", () => {
  test("ohne Mutanten-Modus hält kein Plan eine Scheibe, und er ist der Plan ohne sie", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      for (const skip of [undefined, new Set(["dom"]), BIG]) {
        const plan = shardPlan(n, skip, false);
        for (const s of slices) expect(plan.has(s)).toBe(false);
        expect(plan).toEqual(shardPlan(n, new Set([...(skip ?? []), ...slices]), true));
      }
    }
  });

  test("ein Lauf mit Skip allein fährt die Scheiben nur im Mutanten-Modus", () => {
    const skip = new Set(["core"]);
    expect(unitsOfRun(true, skip).map((u) => u.unit)).toEqual(expect.arrayContaining(slices));
    expect(unitsOfRun(false, skip).some((u) => u.mutantsOf)).toBe(false);
  });
});

describe("jeder Mutant läuft in genau einer Scheibe", () => {
  test("die Scheiben einer Familie sind disjunkt, decken sie ganz und sind gleich groß bis auf einen", () => {
    for (const size of [0, 1, 3, 4, 7, 13, 38]) {
      const family = Array.from({ length: size }, (_, i) => `m${i}`);
      const parts = Array.from({ length: DOM_MUTANT_SLICES }, (_, i) => mutantSlice(family, i + 1, DOM_MUTANT_SLICES));
      expect(parts.flat().sort()).toEqual([...family].sort());
      const sizes = parts.map((p) => p.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });
});

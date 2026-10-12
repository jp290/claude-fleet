// Owner 12.10.: „[Zitat entfernt]“ — der Merge-Check meldet bei rotem main nie
// „[Zitat entfernt]“, außer ein Branch repariert es ausdrücklich (--repair).
import { describe, expect, test } from "bun:test";
import { decide, mainVerdict } from "./merge-check";

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
  test("ein Rot, das als flake beurteilt ist, hält main nicht rot", () => {
    expect(mainVerdict([row(2, "red", "m2", { verdict: "flake", at: 3, by: "owner" })], onMain).red).toBe(false);
  });
  test("ein Rot, das als real oder stale-test beurteilt ist, bleibt rot (Objekt- und Textform)", () => {
    expect(mainVerdict([row(2, "red", "m2", { verdict: "real", at: 3, by: "owner" })], onMain).red).toBe(true);
    expect(mainVerdict([row(2, "red", "m2", "stale-test")], onMain).red).toBe(true);
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
});

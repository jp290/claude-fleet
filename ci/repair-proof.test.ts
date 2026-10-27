// Die Reparatur-Tür belegt, statt zu glauben (Karte cb1edfe3, 27.10.): Aus den `fails` der roten
// Audit-Zeile und den Dateien, die diese Prüfungen WÖRTLICH nennen, entscheidet sich, ob ein Branch ein
// rotes main behebt. Hier steht der Entscheid allein — ohne git, ohne Server: `namesIn` ist eine Karte,
// `diff` eine Liste.
import { describe, expect, test } from "bun:test";
import { REPAIR_FILES_MAX, repairNeedleOf, repairProofOf } from "./repair-proof";

const MAIN = "m".repeat(40);
const CLAIM = "the words in the structure's rectangles have Info's size — the drawing is not scaled";
const NAME = `arbeitsorte DOM 1200x900 lane: ${CLAIM}`;
const OTHER = "settings DOM 390x844: the section's values are Context · Delivery · Belongs to";
const red = (fails: unknown, extra: Record<string, unknown> = {}) =>
  ({ at: 1793110000000, result: "red", mainSha: MAIN, fails, ...extra });
const names = (m: Record<string, readonly string[]>) => (needle: string) => m[needle] ?? [];

describe("repairNeedleOf: wonach im Quelltext gesucht wird", () => {
  test("der Satz der Prüfung, nicht ihre Familie", () => {
    expect(repairNeedleOf(NAME)).toBe(CLAIM);
  });
  test("ein Name ohne Satz bleibt er selbst", () => {
    expect(repairNeedleOf("arbeitsorte DOM 1200x900 lane")).toBe("arbeitsorte DOM 1200x900 lane");
  });
  test("ein zu kurzer Satz fällt auf den ganzen Namen zurück", () => {
    expect(repairNeedleOf("x: kurz")).toBe("x: kurz");
  });
});

describe("repairProofOf: behebt dieser Branch das rote main?", () => {
  const audit = names({ [CLAIM]: ["e2e/slots.ts"] });

  test("die Prüfung nennt eine Datei, und der Diff ändert sie: belegt", () => {
    const p = repairProofOf({ row: red([NAME]), diff: ["e2e/slots.ts", "e2e/zoom.ts"], namesIn: audit });
    expect(p.ok).toBe(true);
    expect(p.red).toBe(1);
    expect(p.files).toEqual(["e2e/slots.ts"]);
    expect(p.why).toContain("behebt den roten Audit mmmmmmmm");
    expect(p.why).toContain("e2e/slots.ts");
  });

  test("ein normaler Branch, der woanders ändert, behebt nichts — und der Grund nennt die Datei, die es bräuchte", () => {
    const p = repairProofOf({ row: red([NAME]), diff: ["README.md"], namesIn: audit });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("nicht als Reparatur belegt");
    expect(p.why).toContain("berührt keine dieser Dateien (e2e/slots.ts)");
  });

  test("ein Branch, der sich als Reparatur ausgibt und andere Dateien ändert, bekommt kein repair", () => {
    const p = repairProofOf({ row: red([NAME]), diff: ["docs/messungen/notiz.md"], namesIn: audit });
    expect(p.ok).toBe(false);
  });

  test("mehrere rote Prüfungen: eine ohne Beleg hält die ganze Reparatur auf", () => {
    const p = repairProofOf({ row: red([NAME, OTHER]), diff: ["e2e/slots.ts"], namesIn: names({ [CLAIM]: ["e2e/slots.ts"], [OTHER.slice(OTHER.indexOf(": ") + 2)]: ["e2e/slots.ts"] }) });
    // beide Sätze stehen in derselben Datei: belegt
    expect(p.ok).toBe(true);
    const p2 = repairProofOf({ row: red([NAME, OTHER]), diff: ["e2e/slots.ts"], namesIn: names({ [CLAIM]: ["e2e/slots.ts"] }) });
    expect(p2.ok).toBe(false);
    expect(p2.why).toContain("kein Quelltext nennt diese Prüfung");
    expect(p2.why).toContain("1 von 2 roten Prüfungen ohne Beleg");
  });

  test("main ist nicht rot: nichts zu reparieren", () => {
    const p = repairProofOf({ row: null, diff: ["e2e/slots.ts"], namesIn: audit });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("nicht bekannt rot");
  });

  test("eine rote Zeile ohne benannte Prüfungen belegt nichts", () => {
    for (const fails of [undefined, [], [""], [7, null]])
      expect(repairProofOf({ row: red(fails), diff: ["e2e/slots.ts"], namesIn: audit }).ok).toBe(false);
  });

  test("ein Name, den keine Datei nennt, ist keine Zuordnung", () => {
    const p = repairProofOf({ row: red([NAME]), diff: ["e2e/slots.ts"], namesIn: names({}) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
  });

  test("ein Name, den zu viele Dateien nennen, bindet die Prüfung an keine", () => {
    const many = Array.from({ length: REPAIR_FILES_MAX + 1 }, (_, i) => `e2e/f${i}.ts`);
    const p = repairProofOf({ row: red([NAME]), diff: many, namesIn: names({ [CLAIM]: many }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("keine Zuordnung");
  });

  test("ein Name, der zu kurz für eine Suche ist, belegt nichts", () => {
    const p = repairProofOf({ row: red(["x: kurz"]), diff: ["e2e/slots.ts"], namesIn: names({ "x: kurz": ["e2e/slots.ts"] }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("zu kurz");
  });

  test("doppelte Namen zählen einmal, und die Dateien stehen einmal", () => {
    const p = repairProofOf({ row: red([NAME, NAME]), diff: ["e2e/slots.ts"], namesIn: names({ [CLAIM]: ["e2e/slots.ts", "e2e/slots.ts"] }) });
    expect(p.ok).toBe(true);
    expect(p.red).toBe(1);
    expect(p.files).toEqual(["e2e/slots.ts"]);
  });
});

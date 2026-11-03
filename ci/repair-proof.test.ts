// Die Reparatur-Tür belegt, statt zu glauben (Karte cb1edfe3, 27.10.): Aus den `fails` der roten
// Audit-Zeile und den Dateien, die diese Prüfungen WÖRTLICH nennen, entscheidet sich, ob ein Branch ein
// rotes main behebt. Hier steht der Entscheid allein — ohne git, ohne Server: `namesIn` ist eine Karte,
// `diff` eine Liste.
import { describe, expect, test } from "bun:test";
import { REPAIR_FILES_MAX, REPAIR_NEEDLE_MIN, repairNeedleOf, repairNeedleOhneLauf, repairProofOf } from "./repair-proof";

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

// Auftrag 11 und 13. Die sieben Namen des Audits at=1793670592359, aus Stücken gebaut: die Tür sucht in *.ts, und
// stünde ein Satz wörtlich in dieser Datei, belegte sie sich selbst, weil sie im Diff liegt.
const satz = (...stuecke: string[]): string => stuecke.join(" ");
const ST_MUTANT = satz("the start window stays open", "after a start");
const ST_SATZ = satz("after a successful start", "from the start window the window cl");
const CHROMIUM = satz("Chromium starts and loads", "the client bundle for every mutant of this slice");
const ZIEL = satz("on the phone every target", "below the Arbeitsorte is at least 40 px high (a link 32)");
const BLOCK = satz("the block stays inside Info,", "the values on one line, nothing runs over sideways, the Context switch is not cut");
const AGENT = satz("a saved agent unchanged", "reads its preview with agent=<id>");
const NADELN = satz("every mutant's needle", "still stands in its source file");
const ALS_MUTANT = (n: string): string => `name: "${n}"`;
const ALS_ZAEHLUNG = (n: string): string => `${n} (\${`;
const SIEBEN = [
  `k15 start DOM mutant: ${ST_MUTANT} turns red: ${ST_SATZ}`,
  `dom mutants 2/4 — PROBE: ${CHROMIUM}`,
  `arbeitsorte DOM 390x844 info main: ${ZIEL}`,
  `uebergabe DOM 390x844: ${BLOCK}`,
  `k15 start DOM 1200x900: ${AGENT}`,
  `dom mutants — PROBE: ${NADELN} (271 needles, no browser)`,
  `dom mutants 3/4 — PROBE: ${CHROMIUM}`,
];
// wo sie im Baum des Kandidaten stehen
const BAUM: Record<string, readonly string[]> = {
  [ALS_MUTANT(ST_MUTANT)]: ["e2e/k15-start-dom.ts"], [CHROMIUM]: ["e2e/dom.ts"], [ZIEL]: ["e2e/slots.ts"], [BLOCK]: ["e2e/uebergabe.ts"],
  [AGENT]: ["e2e/k15-start-dom.ts"], [ALS_ZAEHLUNG(NADELN)]: ["e2e/dom.ts"],
};
const ALLE_DATEIEN = ["e2e/dom.ts", "e2e/k15-start-dom.ts", "e2e/slots.ts", "e2e/uebergabe.ts"];
const siebenGegen = (diff: readonly string[]) => repairProofOf({ row: red(SIEBEN), diff, namesIn: names(BAUM) });

describe("was der Testlauf baut, steht in keinem Baum, und die Tür bleibt trotzdem streng", () => {
  test("die sieben roten Namen gegen den Kandidaten: belegt, in den vier Dateien, die der Diff ändert", () => {
    const p = siebenGegen([...ALLE_DATEIEN, "public/index.html"]);
    expect(p.why).toContain("behebt den roten Audit");
    expect(p.ok).toBe(true);
    expect(p.red).toBe(7);
    expect(p.files).toEqual(ALLE_DATEIEN);
  });

  test("ein Branch, der keine der nennenden Dateien berührt: verweigert", () => {
    const p = siebenGegen(["README.md", "public/index.html"]);
    expect(p.ok).toBe(false);
    expect(p.why).toContain("7 von 7 roten Prüfungen ohne Beleg");
  });

  test("ein Branch, der einige berührt, aber nicht alle: verweigert, und die Antwort nennt jede offene", () => {
    const p = siebenGegen(["e2e/slots.ts", "e2e/uebergabe.ts", "e2e/k15-start-dom.ts"]);
    expect(p.ok).toBe(false);
    expect(p.why).toContain("3 von 7 roten Prüfungen ohne Beleg");
    expect(p.why).toContain(CHROMIUM);
    expect(p.why).toContain(NADELN);
    expect(p.why).toContain("e2e/dom.ts");
    expect(p.why).not.toContain(ZIEL);
    expect(p.checks.filter((c) => !c.touched).map((c) => c.needle)).toEqual([CHROMIUM, ALS_ZAEHLUNG(NADELN), CHROMIUM]);
  });

  test("bleibt ohne das Gebaute zu wenig übrig: verweigert, und nach so wenig wird nie gesucht", () => {
    for (const [name, rest] of [
      ["k15 start DOM mutant: mac turns red: after a successful start from the start window", "mac"],
      ['arbeitsorte DOM MUTATION — Fremd: "a claim long enough to search for…" turns red', "Fremd"],
      ["dom — PROBE: every file (271 needles, no browser)", "every file"],
    ] as const) {
      const gesucht: string[] = [];
      const ueberall = (needle: string) => { gesucht.push(needle); return [rest, ALS_MUTANT(rest), ALS_ZAEHLUNG(rest)].includes(needle) ? ["e2e/dom.ts"] : []; };
      const p = repairProofOf({ row: red([name]), diff: ["e2e/dom.ts"], namesIn: ueberall });
      expect(rest.length).toBeLessThan(REPAIR_NEEDLE_MIN);
      expect(p.ok).toBe(false);
      expect(p.why).toContain("zu kurz");
      expect(gesucht.filter((n) => n !== repairNeedleOf(name))).toEqual([]);
    }
  });

  test("bleibt genug übrig, nennen es aber zu viele Dateien: keine Zuordnung, auch wenn die meisten außerhalb von e2e/ liegen", () => {
    const many = [...Array.from({ length: REPAIR_FILES_MAX }, (_, i) => `src/f${i}.ts`), "e2e/f.ts"];
    const p = repairProofOf({ row: red([`dom mutants — PROBE: ${NADELN} (271 needles, no browser)`]), diff: many, namesIn: names({ [ALS_ZAEHLUNG(NADELN)]: many }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("keine Zuordnung");
  });

  test("der Schnitt zählt nur Dateien unter e2e/: eine echte Zählung auf einer Produktdatei ist verweigert", () => {
    const name = "net: the server answered in time (3 of 5)";
    const wie = "the server answered in time";
    const p = repairProofOf({ row: red([name]), diff: ["src/util.ts"], namesIn: names({ [ALS_ZAEHLUNG(wie)]: ["src/util.ts"] }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
    // eine nennende Datei unter e2e/ belegt nur, wenn der Diff genau sie berührt: die Produktdatei daneben zählt nicht
    const beide = repairProofOf({ row: red([name]), diff: ["src/util.ts"], namesIn: names({ [ALS_ZAEHLUNG(wie)]: ["src/util.ts", "e2e/net.ts"] }) });
    expect(beide.ok).toBe(false);
    expect(beide.why).toContain("berührt keine dieser Dateien (e2e/net.ts)");
    expect(repairProofOf({ row: red([name]), diff: ["e2e/net.ts"], namesIn: names({ [ALS_ZAEHLUNG(wie)]: ["src/util.ts", "e2e/net.ts"] }) }).ok).toBe(true);
  });

  test("eine Klammer, die keine Zählung ist: der Satz steht ohne Template da, also verweigert, auch unter e2e/", () => {
    const wie = "the board shows the card";
    const p = repairProofOf({ row: red([`ui: ${wie} (2 cards at 390x844, one cut)`]), diff: ["e2e/board.ts"], namesIn: names({ [wie]: ["e2e/board.ts"] }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
    expect(repairNeedleOhneLauf(`x: ${NADELN} (no count here)`)).toBeNull();
    expect(repairNeedleOhneLauf(`x: ${NADELN} (a link 32)`)).toBeNull();
  });

  test("das Wort mutant: in einem gewöhnlichen Namen: der Satz steht in keiner Mutanten-Liste, also verweigert, auch unter e2e/", () => {
    const wie = "a plain sentence in a test file";
    const p = repairProofOf({ row: red([`dom mutant: ${wie} turns red: a real long sentence nobody wrote down`]), diff: ["e2e/x.ts"], namesIn: names({ [wie]: ["e2e/x.ts"] }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
    // dasselbe für die Phrase eines echten Mutanten, die nur in Produktcode steht
    const code = repairProofOf({ row: red([`k15 start DOM mutant: ${ST_MUTANT} turns red: ${ST_SATZ}`]), diff: ["src/x.ts"], namesIn: names({ [ST_MUTANT]: ["src/x.ts"] }) });
    expect(code.ok).toBe(false);
    // und ein Eintrag der Mutanten-Liste außerhalb von e2e/ belegt keinen Mutanten
    const liste = repairProofOf({ row: red([`k15 start DOM mutant: ${ST_MUTANT} turns red: ${ST_SATZ}`]), diff: ["src/x.ts"], namesIn: names({ [ALS_MUTANT(ST_MUTANT)]: ["src/x.ts"] }) });
    expect(liste.ok).toBe(false);
  });

  test("ein Satz, der nur noch in main steht, ist kein Beleg: der Beweis kennt nur den Baum des Kandidaten", () => {
    const p = repairProofOf({ row: red([`k15 start DOM 1200x900: ${AGENT}`]), diff: ["e2e/k15-start-dom.ts"], namesIn: names({}) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
  });

  test("was wörtlich steht, bleibt der Beleg, auch außerhalb von e2e/: der Schnitt kommt nur, wenn der ganze Satz nirgends steht", () => {
    const wie = "the sentence stands as it is written";
    const ganz = `${wie} (2 of 3)`;
    const p = repairProofOf({ row: red([`ui: ${ganz}`]), diff: ["src/a.ts"],
      namesIn: names({ [ganz]: ["src/a.ts"], [ALS_ZAEHLUNG(wie)]: ["e2e/andere.ts"] }) });
    expect(p.ok).toBe(true);
    expect(p.checks[0]!.needle).toBe(ganz);
    expect(p.files).toEqual(["src/a.ts"]);
  });

  test("unter e2e/ heißt: der Pfad beginnt dort, nicht: er enthält es irgendwo", () => {
    const p = repairProofOf({ row: red([`dom mutants — PROBE: ${NADELN} (271 needles, no browser)`]), diff: ["src/e2e/a.ts"], namesIn: names({ [ALS_ZAEHLUNG(NADELN)]: ["src/e2e/a.ts"] }) });
    expect(p.ok).toBe(false);
    expect(p.why).toContain("kein Quelltext nennt diese Prüfung");
  });

  test("repairNeedleOhneLauf kennt die Mutanten-Zeilen der Familie und die Zählung, sonst nichts", () => {
    const mutant = { rest: ST_MUTANT, suche: ALS_MUTANT(ST_MUTANT) };
    expect(repairNeedleOhneLauf(`k15 start DOM mutant: ${ST_MUTANT} turns red: ${ST_SATZ}`)).toEqual(mutant);
    expect(repairNeedleOhneLauf(`arbeitsorte DOM MUTATION — ${ST_MUTANT}: "a…" · "b…" turns red`)).toEqual(mutant);
    expect(repairNeedleOhneLauf(`strip DOM MUTATION — ${ST_MUTANT}: "a…" and "b…" turn red`)).toEqual(mutant);
    expect(repairNeedleOhneLauf(`dom mutants — PROBE: ${NADELN} (271 needles, no browser)`)).toEqual({ rest: NADELN, suche: ALS_ZAEHLUNG(NADELN) });
    expect(repairNeedleOhneLauf(NAME)).toBeNull();
  });
});

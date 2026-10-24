// Wer einen roten Lauf liest, findet den Grund im Log (Board-Zeile a628b113): Eine FAIL-Zeile trägt
// ihr Detail ganz oder nennt die Datei, in der es ganz steht. PASS-Zeilen bleiben kurz, und die Zeile
// behält die Form, aus der Server und Daemon den Namen lesen.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DETAIL_INLINE_MAX, lineDetail, spillTo } from "../e2e/fail-detail";
import { TRAIL_DETAIL_MAX } from "../e2e/trail-emit";

const root = mkdtempSync(join(tmpdir(), "fail-detail-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

// das entscheidende Wort steht hinter der Grenze, an der die Zeile früher endete
const snapshot = `{"rows":${JSON.stringify("x".repeat(DETAIL_INLINE_MAX + 200))},"word":"Postfach"}`;
const wholeIn = (shown: string): string => readFileSync(/\[whole detail: (.+)\]$/.exec(shown)![1]!, "utf8");
// wie server.ts#localFailNames den Namen aus einer FAIL-Zeile liest
const nameOf = (line: string): string => line.slice(6, line.indexOf("  (") >= 0 ? line.indexOf("  (") : undefined);

describe("eine rote Prüfung", () => {
  test("nennt die Datei, in der ihr ganzes Detail steht", () => {
    const shown = lineDetail(false, snapshot, spillTo(join(root, "a.detail")));
    expect(shown.startsWith(snapshot.slice(0, DETAIL_INLINE_MAX))).toBe(true);
    expect(wholeIn(shown)).toBe(snapshot);
    expect(wholeIn(shown)).toContain('"word":"Postfach"');
  });

  test("und der Trail, der bei TRAIL_DETAIL_MAX kappt, behält den Dateinamen", () => {
    const shown = lineDetail(false, snapshot, spillTo(join(root, "b", "isolated-20261024T000000Z-123456.detail")));
    expect(shown.length).toBeLessThanOrEqual(TRAIL_DETAIL_MAX);
  });

  test("jede rote Prüfung bekommt ihre eigene Datei", () => {
    const spill = spillTo(join(root, "c.detail"));
    const one = lineDetail(false, `${snapshot}1`, spill);
    const two = lineDetail(false, `${snapshot}2`, spill);
    expect(wholeIn(one)).toBe(`${snapshot}1`);
    expect(wholeIn(two)).toBe(`${snapshot}2`);
  });

  test("ein kurzes Detail steht ganz in der Zeile, ohne Datei", () => {
    let spilled = 0;
    expect(lineDetail(false, "keys=Context,Belongs to", () => (spilled++, "nie"))).toBe("keys=Context,Belongs to");
    expect(spilled).toBe(0);
  });

  test("ohne Trail-Verzeichnis ist die Zeile gekürzt und sagt es, und der Lauf geht weiter", () => {
    const shown = lineDetail(false, snapshot, spillTo(null));
    expect(shown).toBe(`${snapshot.slice(0, DETAIL_INLINE_MAX)}…`);
  });

  test("die Zeile behält die Form, aus der der Server den Namen liest", () => {
    const name = "arbeitsorte DOM 1200x900 idle: Info speaks English";
    const line = `FAIL  ${name}  (${lineDetail(false, snapshot, spillTo(join(root, "d.detail")))})`;
    expect(nameOf(line)).toBe(name);
  });
});

describe("eine grüne Prüfung", () => {
  test("bleibt kurz und schreibt keine Datei", () => {
    let spilled = 0;
    const shown = lineDetail(true, snapshot, () => (spilled++, "nie"));
    expect(shown).toBe(`${snapshot.slice(0, DETAIL_INLINE_MAX)}…`);
    expect(spilled).toBe(0);
  });
});

// EIGENE PACKS (server/eigene-packs.ts): was die Tür annimmt, wie die Datei liegt, und dass ein eigener Pack keinen aus dem Register schattet
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eigenePacksDir, eigenerPackDerTuer, liesEigenePacks, PRIVATER_OWNER_PACK_ID, schreibEigenenPack } from "./eigene-packs";

const dir = mkdtempSync(join(tmpdir(), "eigene-packs-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const REGISTER = new Set(["made-with-love"]);
const gut = { id: "mein-agent", useWhen: "Wenn du an einer Rezeptsammlung arbeitest.", text: "# Mein Agent\n\nText." };

describe("die Tür", () => {
  test("nimmt genau id, useWhen und text; eine Register-Id, eine zweite Zeile im useWhen oder ein Text ohne Titel nicht", () => {
    expect(eigenerPackDerTuer(gut, REGISTER)).toEqual({ ok: true, pack: gut });
    for (const schlecht of [{ ...gut, id: "made-with-love" }, { ...gut, useWhen: "a\nb" }, { ...gut, useWhen: "x".repeat(121) },
      { ...gut, text: "kein Titel" }, { ...gut, id: "Gross" }, { ...gut, mcp: { name: "x" } }, { ...gut, text: `# T\n${"x".repeat(64_001)}` }])
      expect(eigenerPackDerTuer(schlecht, REGISTER).ok).toBe(false);
  });
  test("den privaten Pack des Owners schreibt nur die Orchestratorin, denn er steht in ihrem Start", () => {
    const privat = { ...gut, id: PRIVATER_OWNER_PACK_ID };
    expect(eigenerPackDerTuer(privat, REGISTER).ok).toBe(false);
    expect(eigenerPackDerTuer(privat, REGISTER, true)).toEqual({ ok: true, pack: privat });
  });
});

describe("die Datei", () => {
  test("geschrieben und gelesen ist derselbe Pack; ein zweites Schreiben ersetzt; eine kaputte Datei wird übersprungen", () => {
    const erst = schreibEigenenPack(dir, gut, "Slot 8", 123);
    expect(erst.ersetzt).toBe(false);
    expect(erst.pack).toMatchObject({ id: "mein-agent", titel: "Mein Agent", text: gut.text, useWhen: gut.useWhen, von: "Slot 8", am: 123 });
    expect(schreibEigenenPack(dir, { ...gut, text: "# Mein Agent\n\nNeu." }, "Slot 8").ersetzt).toBe(true);
    writeFileSync(join(eigenePacksDir(dir), "kaputt.md"), "kein Kopf");
    expect(liesEigenePacks(dir).map((p) => [p.id, p.text])).toEqual([["mein-agent", "# Mein Agent\n\nNeu."]]);
  });
});

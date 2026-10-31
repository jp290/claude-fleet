// Jeder kommt rein: die Liste der Orte im Startfenster führt jeden gepinnten Ordner, auch einen ohne Git. Vorher fiel ein gepinnter Ordner, den
// /api/dirinfo nicht als Git-Repo kannte, aus der Liste, sobald ein anderer Ort gewählt war: er war gepinnt und nirgends zu finden.
import { describe, expect, test } from "bun:test";

// src/k15-haupt.ts nimmt, was das Board ihm gibt (globalThis.k15Haupt); hier ein Board ohne laufende Session
(globalThis as unknown as { k15Haupt: unknown }).k15Haupt = { flotte: () => [], baseName: (p: string) => p.split("/").pop() ?? p };
const { repoZeilen } = await import("./k15-zustand");

const stand = (o: { repo: string | null; pins: string[]; infos: [string, unknown][] }) =>
  ({ repo: o.repo, pins: o.pins, infos: new Map(o.infos) }) as unknown as Parameters<typeof repoZeilen>[0];

describe("die Orte des Startfensters", () => {
  test("ein gepinnter Ordner ohne Git steht in der Liste, auch wenn ein anderer Ort gewählt ist", () => {
    const s = stand({ repo: "/h/projekt", pins: ["/h/projekt", "/h/notizen"], infos: [["/h/projekt", { exists: true, git: true }], ["/h/notizen", { exists: true, git: false }]] });
    expect(repoZeilen(s).map((z) => z.repo)).toEqual(["/h/projekt", "/h/notizen"]);
  });
});

// ZWEI NOTIZEN, DIE EINMAL NUR EINEM SITZ GEHÖRTEN (Owner 28.10.: „[Zitat entfernt]“): `gezaeunter-sitz` und `proaktiv-arbeiten` lagen als
// private Packs in `~/claude-fleet/eigene-packs/` und stehen jetzt als Datei in `docs/packs/` mit einem Eintrag in
// `.fleet/context-packs.json`. Dieser Test läuft den Weg, den ein Sitz geht, am echten Register ab: die Trigger eines
// Sitzes ohne stehende Rolle (`seatContextFacts`), die Abschnitte an ihren Ankern (`sectionAt`) und die Auswahl, aus der
// sein Startfenster je Pack einen Schalter macht (`seatKatalog`) — beide Ids müssen darin stehen, ohne dass jemand sie wählt.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sectionAt } from "../context-sections";
import { bibliothekGewaehlt, packAuswahlFehlt, seatContextFacts, seatKatalog, type SeatKnowledge } from "./sitz-wissen";

const ROOT = join(import.meta.dir, "..");
const NEU = ["gezaeunter-sitz", "proaktiv-arbeiten"] as const;

interface RegisterPack {
  readonly id: string; readonly useWhen: string; readonly triggers: string[];
  readonly sources: readonly { readonly path: string; readonly anchor: string }[];
}
const register = JSON.parse(readFileSync(join(ROOT, ".fleet", "context-packs.json"), "utf8")) as RegisterPack[];
const pack = (id: string): RegisterPack => {
  const found = register.find((p) => p.id === id);
  if (!found) throw new Error(`${id} steht nicht im Register`);
  return found;
};
const sectionOf = (source: { readonly path: string; readonly anchor: string }): string | null =>
  sectionAt(readFileSync(join(ROOT, source.path), "utf8"), source.path, source.anchor);

// DAS WISSEN EINES SITZES, wie der Server es aus dem Register baut (server.ts#bibliothekLaden): die Packs, deren Trigger
// dieser Sitz trägt, mit den Abschnitten an ihren Ankern, gelesen aus dem Baum dieses Checkouts
const wissenFuer = (tree: "fleet" | "foreign"): SeatKnowledge => {
  const facts = seatContextFacts(tree, "claude");
  const packs = register.filter((p) => p.triggers.some((t) => facts.triggers.includes(t))).flatMap((p) => {
    const sections = p.sources.map(sectionOf);
    return [{ id: p.id, useWhen: p.useWhen, sources: p.sources.map((s) => ({ path: s.path, anchor: s.anchor })),
      text: sections.some((s) => s === null) ? null : sections.join("\n") }];
  });
  return { tree, repoRoot: ROOT, head: "0".repeat(40), packs };
};

describe("die zwei Notizen aus dem privaten Ordner stehen jetzt in Fleets Bibliothek", () => {
  test("ihr Eintrag zeigt auf die getrackte Datei und den Anker, der dort steht", () => {
    for (const id of NEU) {
      const p = pack(id);
      expect(p.sources.length).toBe(1);
      const source = p.sources[0]!;
      expect(source.path).toBe(`docs/packs/${id}.md`);
      // die Titelzeile, die context-sections.ts#sectionSpan verlangt: genau diese Zeile, einmal
      expect(readFileSync(join(ROOT, source.path), "utf8").split("\n").filter((z) => z === source.anchor).length).toBe(1);
      // der Text ist lesbar (der Anker liefert einen Abschnitt), und sein Moment ist ein Satz, keine Zeile darüber
      expect(sectionOf(source)).toBeTruthy();
      expect(p.useWhen.length).toBeLessThanOrEqual(120);
    }
  });

  test("ein Sitz ohne stehende Rolle sieht beide in seiner Auswahl, als Skill, mit ihrem Moment — ohne sie zu wählen", () => {
    for (const tree of ["foreign", "fleet"] as const) {
      const k = wissenFuer(tree);
      const katalog = seatKatalog(k);
      for (const id of NEU) {
        const eintrag = katalog.find((p) => p.id === id);
        expect(eintrag).toMatchObject({ id, weg: "skill", useWhen: pack(id).useWhen });
        expect(eintrag!.bytes).toBeGreaterThan(0);
        // ...und er kommt von selbst: die Bibliothek an und keine Wahl lässt ihn stehen
        expect(bibliothekGewaehlt(k, null).packs.map((p) => p.id)).toContain(id);
        // die Startfenster-Wahl nimmt die Id an: sie fehlt nicht
        expect(packAuswahlFehlt([id], k)).toEqual([]);
      }
    }
  });
});

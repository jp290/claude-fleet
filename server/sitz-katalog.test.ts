// Der Katalog, aus dem das Startfenster je Pack einen Schalter macht (server/sitz-wissen.ts#seatKatalog; Owner 25.10.: „[Zitat entfernt]“
// ): was die Bibliothek diesem Sitz geben kann, mit Titel, Moment, Größe und Weg.
import { describe, expect, test } from "bun:test";
import { seatKatalog, type SeatKnowledge } from "./sitz-wissen";

const quelle = (path: string) => [{ path, anchor: "# x" }];
const k: SeatKnowledge = { tree: "fleet", repoRoot: "/fleet", head: "a".repeat(40), packs: [
  { id: "who-it-is-for", useWhen: "Before you build work someone uses.", sources: quelle("docs/packs/who-it-is-for.md"), text: "# Who it is for\n\nRead this when …" },
  { id: "system-concept", useWhen: "When you need to know what Fleet is.", sources: quelle("docs/start/system-concept.md"), text: "Intro.\n\n# The system concept\n\n…" },
  { id: "made-with-love", useWhen: "While you build something visible.", sources: quelle("docs/packs/made-with-love.md"), text: "Kein Titel hier." },
  { id: "sharpen3", useWhen: "Prompt compiler.", sources: quelle("docs/skills/sharpen3.md"), text: "# sharpen3\n\nYou are a prompt compiler." },
  { id: "nicht-lesbar", useWhen: "Never.", sources: quelle("docs/packs/x.md"), text: null },
  { id: "ohne-moment", useWhen: null, sources: quelle("docs/packs/y.md"), text: "# Ohne Moment" },
  { id: "mein-pack", useWhen: "Mine.", sources: quelle("/state/eigene-packs/mein-pack.md"), text: "# Mein Pack", privat: true },
] };

describe("der Katalog der Bibliothek fürs Startfenster", () => {
  const kat = seatKatalog(k);
  test("jeder Pack, den der Sitz bekommen kann: wörtlich im Start zuerst, dann die Skills; kein eigener, keiner ohne Text oder Moment", () => {
    expect(kat.map((p) => [p.id, p.weg])).toEqual([["who-it-is-for", "start"], ["system-concept", "skill"], ["made-with-love", "skill"], ["sharpen3", "skill"]]);
  });
  test("sein Titel ist die erste Überschrift seines Texts, sonst die Id; ein Konzept ist, was unter docs/start/ liegt", () => {
    expect(kat.map((p) => [p.titel, p.konzept])).toEqual([["Who it is for", false], ["The system concept", true], ["made-with-love", false], ["sharpen3", false]]);
  });
  test("ein Werkzeug ist, was unter docs/skills/ liegt: die Session führt es auf Bitte aus, es ist kein Wissen (Owner 25.10.: sharpen3 ist kein Context pack)", () => {
    expect(kat.filter((p) => p.werkzeug).map((p) => p.id)).toEqual(["sharpen3"]);
  });
  test("seine Größe ist die seines Texts in Bytes, sein Moment die useWhen-Zeile", () => {
    expect(kat[0]).toMatchObject({ bytes: new TextEncoder().encode("# Who it is for\n\nRead this when …").length, useWhen: "Before you build work someone uses." });
  });
  test("sein Satz ist der erste kurze Absatz unter dem Titel, in den Worten des Packs; ohne einen solchen keiner", () => {
    expect(kat.map((p) => p.satz)).toEqual(["Read this when …", "…", null, "You are a prompt compiler."]);
  });
});

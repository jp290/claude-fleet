// K15 · die Form von „Systemprompt und Werkzeuge“ aufgeschlüsselt (src/k15-anatomie.ts): das Fenster nimmt genau, was der Server baut,
// und lehnt jede schiefe Form ab, statt Teile zu raten
import { describe, expect, test } from "bun:test";
import { anatomieVon, gruppenBytes, zaehltMit, type CcAnatomie } from "./k15-anatomie";

const GUT: CcAnatomie = {
  quelle: { slot: 5, rolle: "Session ohne Rolle", ort: "bau-x", claude: "2.1.301", modell: "claude-opus-5-5", seit: 1, tokens: 100, bytesJeToken: 2.6 },
  grund: null,
  gruppen: [
    { id: "werkzeuge", wort: "Werkzeuge", satz: "s", teile: [
      { name: "Bash", bytes: 100, stand: "an", weg: "--tools", satz: "a", text: "Führt aus." },
      { name: "Monitor", bytes: 7, stand: "abruf", weg: "--tools", satz: "b" },
      { name: "Workflow", bytes: 900, stand: "aus", weg: "--tools", satz: "c" },
      { name: "Edit", bytes: null, stand: "an", weg: "--tools", satz: "d" }] },
    { id: "plugins", wort: "Plugins", satz: "p", teile: [{ name: "figma", bytes: null, stand: "an", weg: "Plugin figma", satz: "bringt …" }] },
  ],
};

describe("anatomieVon", () => {
  test("nimmt die Form des Servers unverändert, auch durch JSON", () => {
    expect(anatomieVon(JSON.parse(JSON.stringify({ rolle: "lane", anatomie: GUT })))).toEqual(GUT);
    expect(anatomieVon({ anatomie: { quelle: null, grund: "noch nicht gemessen", gruppen: [] } })).toEqual({ quelle: null, grund: "noch nicht gemessen", gruppen: [] });
  });
  test("ein älterer Server ohne Aufschlüsselung: null", () => {
    expect(anatomieVon({ rolle: "lane", zeilen: [] })).toBeNull();
    expect(anatomieVon(null)).toBeNull();
    expect(anatomieVon(undefined)).toBeNull();
  });
  test("lehnt jede schiefe Form ab, statt einen Teil zu raten", () => {
    const mit = (f: (g: Record<string, unknown>) => void) => { const k = JSON.parse(JSON.stringify(GUT)); f(k); return anatomieVon({ anatomie: k }); };
    expect(mit((k) => { (k.gruppen as { teile: { stand: string }[] }[])[0]!.teile[0]!.stand = "halb"; })).toBeNull();
    expect(mit((k) => { (k.gruppen as { teile: { bytes: number }[] }[])[0]!.teile[0]!.bytes = -1; })).toBeNull();
    expect(mit((k) => { (k.gruppen as { id: string }[])[0]!.id = "sonstiges"; })).toBeNull();
    expect(mit((k) => { (k.gruppen as { teile: { text: unknown }[] }[])[0]!.teile[0]!.text = 3; })).toBeNull();
    expect(mit((k) => { (k.quelle as { slot: unknown }).slot = "5"; })).toBeNull();
    expect(mit((k) => { delete k.grund; })).toBeNull();
    expect(mit((k) => { k.gruppen = {}; })).toBeNull();
  });
});

describe("gruppenBytes und zaehltMit", () => {
  test("zählt, was mit Text ankommt (an, abruf, name), nie was aus ist; ungemessene Teile stehen als Zahl daneben", () => {
    expect(gruppenBytes(GUT.gruppen[0]!)).toEqual({ bytes: 107, offen: 1 });
  });
  test("die Plugins sind eine Zuordnung und zählen nicht mit", () => {
    expect(GUT.gruppen.map(zaehltMit)).toEqual([true, false]);
  });
});

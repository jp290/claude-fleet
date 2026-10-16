// K15 · ein Kontextpack als Entwurf, aus dem Owner-Urteil vom 16.10. (Auftrag k15-urteil-16-10.md auf bau/neuaufbau): „[Zitat entfernt]“
// ; Lesart der Bauleitung: „[Zitat entfernt]“
// 
import { describe, expect, test } from "bun:test";
import type { Answer, Baustein } from "./founding";
import { neuerPack, packBytes, packFehler, packLandung, packsExport, packsImport, type PackEntwurf } from "./k15-kontextpack";

const baustein = (id: string, o: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: ["orientierung"], grenze: { art: "frei" }, schicht: "",
  zustand: "an", quelle: "default", rollenDefault: "an", harness: { gueltig: true, grund: null }, schaltbar: { ja: true }, bytes: "unknown", ersatzKandidaten: [], ...o });
function plan(lesehinweise: "an" | "aus" | "leer", weg: string): Answer {
  return { selected: [], omitted: [],
    plan: { planHash: "h", planSatz: "", rolle: "lane", harness: "claude", modell: null, effort: null, ort: { art: "repo", pfad: "/r", branch: "main", head: "x" },
      bytesVorAuftrag: { bytes: 0, unknown: [], auftrag: [] }, bausteine: [baustein("context-anchors", { zustand: lesehinweise === "aus" ? "aus" : "an" })] },
    rollen: [], start: { tuer: "open", startbar: true, refusals: [] },
    lieferung: { tuer: "lane", geliefert: lesehinweise === "an" ? [{ id: "context-anchors", weg }] : [],
      ausgelassen: lesehinweise === "leer" ? [{ id: "context-anchors", grund: "kein Pack ist an" }] : [] } };
}
const pk = (o: Partial<PackEntwurf> = {}): PackEntwurf => ({ id: "pk1", name: "Commits", text: "Betreff im Präsens.", orte: { lane: "text", main: "abruf", orchestratorin: "nicht" },
  v: 1, am: 1, autor: "du", ...o });

describe("ein neuer Pack geht an die Rolle der gewählten Session", () => {
  test("bei einer Lane als Text an die Lane, an keine andere Rolle", () => {
    expect(neuerPack("lane", "du", 5).orte).toEqual({ lane: "text", main: "nicht", orchestratorin: "nicht" });
    expect(neuerPack("orchestratorin", "du", 5).orte).toEqual({ lane: "nicht", main: "nicht", orchestratorin: "text" });
  });
  test("eine Session ohne Rolle hat keine Lesehinweise: der Pack geht an niemanden und ist so nicht sicherbar", () => {
    const p = { ...neuerPack("nur-ordner", "du", 5), name: "x", text: "y" };
    expect(p.orte).toEqual({ lane: "nicht", main: "nicht", orchestratorin: "nicht" });
    expect(packFehler(p)).toBe("Wähl mindestens eine Rolle, die ihn bekommt.");
  });
});

describe("wo er landet, sagt der Plan der Rolle", () => {
  test("bei der Lane in der Session-Datei, bei der MAIN in der ersten Nachricht, jeweils in den Lesehinweisen", () => {
    expect(packLandung(pk(), "lane", plan("an", "Session-Datei"))).toEqual({ art: "mit", ort: "text", weg: "Session-Datei" });
    expect(packLandung(pk(), "main", plan("an", "Prompt"))).toEqual({ art: "mit", ort: "abruf", weg: "Prompt" });
  });
  // server.ts#planDoorRow: Bei MAIN und Orchestratorin fehlen die Lesehinweise, solange kein Pack an ist; mit einem Pack gehen sie in
  // die erste Nachricht. Sie sind dann an, nur leer, nicht aus.
  test("Lesehinweise an, aber leer, weil kein Pack an ist: mit dem Pack kämen sie, bei der MAIN in der ersten Nachricht", () => {
    expect(packLandung(pk(), "main", plan("leer", ""))).toEqual({ art: "mit", ort: "abruf", weg: "Prompt" });
    expect(packLandung(pk({ orte: { lane: "nicht", main: "nicht", orchestratorin: "text" } }), "orchestratorin", plan("leer", ""))).toEqual({ art: "mit", ort: "text", weg: "Prompt" });
  });
  test("nicht gewählt, Lesehinweise aus, keine Rolle, Plan fehlt: jeweils kein Weg, mit Grund", () => {
    expect(packLandung(pk(), "orchestratorin", plan("an", "Prompt"))).toEqual({ art: "nicht", grund: "Für diese Rolle nicht gewählt." });
    expect(packLandung(pk(), "lane", plan("aus", "Session-Datei"))).toEqual({ art: "nicht", grund: "Die Lesehinweise sind bei dieser Session aus; ein Pack käme nur mit ihnen." });
    expect(packLandung(pk(), "nur-ordner", plan("an", "Prompt")).art).toBe("nicht");
    expect(packLandung(pk(), "lane", null)).toEqual({ art: "nicht", grund: "Der Plan dieser Session wird gelesen." });
  });
  test("als Text bringt er seinen Text mit, auf Abruf nur eine Zeile", () => {
    const lang = pk({ text: "x".repeat(2000) });
    expect(packBytes(lang, "text")).toBeGreaterThan(2000);
    expect(packBytes(lang, "abruf")).toBeLessThan(60);
  });
});

describe("sichern, exportieren, importieren", () => {
  test("ohne Name, ohne Text oder ohne Rolle lässt er sich nicht sichern", () => {
    expect(packFehler(pk({ name: "  " }))).toBe("Gib dem Pack einen Namen.");
    expect(packFehler(pk({ text: "\n" }))).toBe("Schreib, was im Pack stehen soll.");
    expect(packFehler(pk({ orte: { lane: "nicht", main: "nicht", orchestratorin: "nicht" } }))).toBe("Wähl mindestens eine Rolle, die ihn bekommt.");
    expect(packFehler(pk())).toBeNull();
  });
  test("Rundlauf: Name, Text, Orte und Version kommen gleich zurück", () => {
    const r = packsImport(JSON.parse(JSON.stringify(packsExport([pk({ v: 3 })]))), 9);
    expect(r).toEqual({ packs: [pk({ v: 3, am: 9 })], verworfen: 0 });
  });
  test("kaputte Einträge fallen einzeln heraus; ein unbekannter Ort heißt „nicht“", () => {
    const r = packsImport([{ name: "ohne Text", orte: { lane: "text" } }, { name: "x", text: "y", orte: { lane: "überall" } }, 42, null,
      { id: "ok", name: "gut", text: "t", orte: { lane: "abruf", main: "text" }, version: 2 }], 9);
    expect(r.packs.map((x) => [x.id, x.orte, x.v])).toEqual([["ok", { lane: "abruf", main: "text", orchestratorin: "nicht" }, 2]]);
    expect(r.verworfen).toBe(4);
    expect(packsImport({ kein: "Array" }, 9)).toEqual({ packs: [], verworfen: 0 });
  });
});

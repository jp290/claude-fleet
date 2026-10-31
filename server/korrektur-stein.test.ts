// Die Korrekturen des Owners als Stein (server/korrektur-stein.ts) und die weitere Geltung als Nachfolger (konzept-ledger.ts#checkKorrekturHeft):
// ein Sitz liest seine Korrekturen als + Zeile mit dem Owner als Autor, je Eintrag eine Zeile mit Id (die ganze Aussage oder Modus und Thema); und eine Fassung darf einen Eintrag
// durch einen mit weiterer Geltung ersetzen, nie durch einen mit engerer.
import { describe, expect, test } from "bun:test";
import { checkKorrekturHeft, type KorrekturEintrag, type KorrekturGeltung } from "../konzept-ledger";
import { korrekturFaltung, korrekturStein } from "./korrektur-stein";

const TUER = "http://127.0.0.1:1/api/self/konzepte/k-owner-korrekturen/leseansicht";

describe("der Stein der Owner-Korrekturen", () => {
  test("eine + Zeile mit dem Owner als Autor, je Eintrag eine Zeile mit Id — die ganze Aussage, wo sie in jeder Arbeit gilt —, Auslöser mit ihrem Modus, der ganze Text hinter der Id", () => {
    const stein = korrekturStein({ konzept: "k-owner-korrekturen", version: 4, sha256: "abcdef0123456789", geltendeEintraege: [
      { id: "karten-bleiben-stehen", aussage: "Karten, Queue, Dispatcher und Lanes bleiben stehen; ihren Abbau nie vorschlagen.", geltung: { modi: "*" } },
      { id: "karten-bleiben", aussage: "Karten bleiben und werden verfeinert. Ihren Abbau nie vorschlagen.", geltung: { modi: "*" } },
      { id: "plan-an-vorgabe-abschneiden", aussage: "Pläne an der Owner-Vorgabe abschneiden und die billigste ausreichende Variante zeigen, immer.", geltung: { modi: ["planung"] } },
      { id: "lang", aussage: "Eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn fünfzehn; Rest.", geltung: { modi: ["a", "b"] } },
    ] }, TUER);
    const zeilen = stein.split("\n");
    expect(zeilen[0]).toBe("+ corrections k-owner-korrekturen v4 (author: owner)");
    expect(zeilen[1]).toContain(`GET ${TUER}/<id>`);
    expect(zeilen[1]).toContain("name its id");
    expect(zeilen.slice(2)).toEqual([
      "- Karten, Queue, Dispatcher und Lanes bleiben stehen; ihren Abbau nie vorschlagen. [karten-bleiben-stehen]",
      "- Karten bleiben und werden verfeinert. Ihren Abbau nie vorschlagen. [karten-bleiben]",
      "In one kind of work only — when your work is that kind, read the entry whole first:",
      "- planung: Pläne an der Owner-Vorgabe abschneiden und die billigste ausreichende Variante zeigen, immer [plan-an-vorgabe-abschneiden]",
      "- a / b: Eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn … [lang]",
    ]);
  });
  test("ohne Eintrag sagt der Stein das, statt leer zu stehen", () => {
    const stein = korrekturStein({ konzept: "k-owner-korrekturen", version: 3, sha256: "0".repeat(64), geltendeEintraege: [] }, TUER);
    expect(stein.split("\n")[2]).toBe("- (no entry of v3 applies to this seat)");
  });
  test("die Tür und der Brief einer Lane lesen dieselbe Teilung: ganz, was in jeder Arbeit gilt, sonst ein Auslöser mit neun Wörtern Thema", () => {
    const lang = { id: "lang", aussage: "Eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf; Rest.", geltung: { modi: ["a", "b"] } };
    const immer = { id: "immer", aussage: "Gilt immer.", geltung: { modi: "*" as const } };
    const f = korrekturFaltung({ konzept: "k-owner-korrekturen", version: 4, sha256: "0".repeat(64), geltendeEintraege: [immer, lang] }, "/tuer");
    expect(f.geltendeEintraege).toEqual([immer]);
    expect(f.ausloeser).toEqual([{ id: "lang", modi: ["a", "b"], wann: "Bei a oder b: Eins zwei drei vier fünf sechs sieben acht …" }]);
    expect(f.volllesen).toBe("GET /tuer/<id>");
  });
});

const ALLE: KorrekturGeltung = { projekte: "*", rollen: "*", harnesses: "*", modi: "*" };
const eintrag = (id: string, geltung: KorrekturGeltung, ersetzt: string[] = []): KorrekturEintrag =>
  ({ id, aussage: `Aussage ${id}`, quelle: "fixture", geltung, ersetzt });
const ALT = eintrag("karten-bleiben", { projekte: ["p1"], rollen: ["orchestrator", "program-main"], harnesses: "*", modi: ["karten"] });
const vorher = { eintraege: [ALT], zurueckgezogen: [] };

describe("ein Nachfolger mit weiterer Geltung", () => {
  test("jeder Sitz statt Orchestratorin und MAIN ersetzt den Eintrag: das ist eine weitere Geltung, kein zweiter Eintrag", () => {
    const weiter = eintrag("karten-bleiben-stehen", { ...ALT.geltung, rollen: "*", modi: "*" }, ["karten-bleiben"]);
    expect(checkKorrekturHeft({ eintraege: [ALT, weiter], zurueckgezogen: [] }, vorher)).toBeNull();
    // eine Liste, die die alte enthält, ist auch weiter
    const mehr = eintrag("karten-mehr", { ...ALT.geltung, rollen: ["lane", "orchestrator", "program-main"] }, ["karten-bleiben"]);
    expect(checkKorrekturHeft({ eintraege: [ALT, mehr], zurueckgezogen: [] }, vorher)).toBeNull();
  });
  test("eine engere Geltung auf irgendeiner Achse bleibt abgewiesen, mit der Achse im Satz", () => {
    const enger = eintrag("nur-orchestratorin", { ...ALT.geltung, rollen: ["orchestrator"] }, ["karten-bleiben"]);
    expect(checkKorrekturHeft({ eintraege: [ALT, enger], zurueckgezogen: [] }, vorher)).toContain("narrower geltung on rollen");
    const nurCodex = eintrag("nur-codex", { ...ALLE, projekte: ["p1"], rollen: "*", modi: "*", harnesses: ["codex"] }, ["karten-bleiben"]);
    expect(checkKorrekturHeft({ eintraege: [ALT, nurCodex], zurueckgezogen: [] }, vorher)).toContain("narrower geltung on harnesses");
  });
});

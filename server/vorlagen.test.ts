// DIE VORLAGE ALS DATEI (server/vorlagen.ts): aus der Bibliothek gebaut, geht sie durch dieselbe Prüfung wie jede Setup-Datei; die Kanten sind
// reports-to zur Leitung, jede Rolle liest ihren Pack mit dessen heutigem Hash, und ein fehlender Pack ist ein Satz statt einer halben Vorlage.
import { describe, expect, test } from "bun:test";
import { hashText, pruefeSetupDatei, type SetupDatei } from "./setup-datei";
import type { SeatKnowledge } from "./sitz-wissen";
import { LEAD_WITH_BUILDERS, LEITUNG_ERBITTET, VORLAGEN, vorlageDatei } from "./vorlagen";

const pack = (id: string, text: string) => ({ id, useWhen: `When ${id}.`, sources: [{ path: `docs/packs/${id}.md`, anchor: `# ${id}` }], text, weg: "start" as const, zurWahl: true as const });
const bibliothek = (ids: readonly string[]): SeatKnowledge => ({ tree: "fleet", repoRoot: "/fleet", head: "a".repeat(40),
  packs: ids.map((id) => pack(id, `# ${id}\n\nText of ${id}.\n`)) });
const ALLE = ["leiten", "bauen", "clean-and-effective-code"];

describe("vorlageDatei", () => {
  test("lead-with-builders: drei Sitze, zwei reports-to-Kanten zur Leitung, jede Rolle liest ihren Pack mit seinem Hash, und die Datei besteht die Prüfung", () => {
    const d = vorlageDatei(LEAD_WITH_BUILDERS, bibliothek(ALLE)) as SetupDatei;
    expect(typeof d).toBe("object");
    expect(pruefeSetupDatei(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(d.seats.map((s) => [s.id, s.start.role, s.worksWith.reportsTo ?? null])).toEqual([["lead", "leitung", null], ["builder", "bauer", "lead"], ["checker", "pruefer", "lead"]]);
    expect(d.edges).toEqual([{ from: "builder", to: "lead", kind: "reports-to" }, { from: "checker", to: "lead", kind: "reports-to" }]);
    expect(d.roles.map((r) => [r.id, r.packs.map((p) => [p.id, p.hash])])).toEqual([
      ["leitung", [["leiten", hashText("# leiten\n\nText of leiten.\n")]]], ["bauer", [["bauen", hashText("# bauen\n\nText of bauen.\n")]]],
      ["pruefer", [["clean-and-effective-code", hashText("# clean-and-effective-code\n\nText of clean-and-effective-code.\n")]]]]);
    // keine Rolle trägt ein Bundel; die Leitung erbittet die Rechte, die nur je Sitz vergeben werden — erbeten, nicht gewährt (der Import deckelt sie)
    expect(d.roles.every((r) => r.rights.length === 0)).toBe(true);
    expect((d.seats[0]!.may.rechte as { recht: string[] }).recht).toEqual([...LEITUNG_ERBITTET]);
    expect(d.seats.slice(1).every((s) => s.may.rechte === null)).toBe(true);
    // jeder Ordner ist ein leerer Platz: wer die Vorlage startet, wählt ihn
    expect(d.seats.every((s) => s.start.folder?.personal === true && s.start.folder.hint === null)).toBe(true);
  });
  test("ein Pack, den die Bibliothek nicht hat, und eine unbekannte Vorlage sind ein Satz", () => {
    expect(vorlageDatei(LEAD_WITH_BUILDERS, bibliothek(["leiten", "clean-and-effective-code"]))).toContain("needs the pack „bauen“");
    expect(vorlageDatei("keine", bibliothek(ALLE))).toContain(`Fleet's templates: ${VORLAGEN.map((v) => v.id).join(", ")}`);
  });
});

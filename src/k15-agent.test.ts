// K15 · der Agent einer Position (src/k15-agent.ts; Runde 4, Owner Z62 und Auftrag Punkt 2: „[Zitat entfernt]“
// ; „[Zitat entfernt]“)
import { describe, expect, test } from "bun:test";
import { agentOptionen, agentWort, effortVon, katalogAus, modelleVon, passtEffort, passtModell, standardAgent } from "./k15-agent";

// die Form von GET /api/harnesses (server.ts), gekürzt auf die Felder, die das Fenster liest; die Modellnamen sind erfunden, echte IDs stehen
// nur im Register (e2e/pins.ts „model register“)
const h = (id: string, o: Record<string, unknown> = {}) => ({ id, role: "agent", default: false, allowsLanes: true, hier: true, grund: null,
  availability: { status: "available" }, supports: { model: true, effort: true }, models: [], effortLevels: ["low", "high"], ...o });
const ANTWORT = {
  harnesses: [
    h("claude", { default: true, models: ["c-gross", "c-gross-alt", "c-mittel"], effortLevels: ["low", "medium", "high", "xhigh", "max"] }),
    h("pi", { models: [] }),
    h("pi-zai", { models: ["z-eins"], hier: false, grund: "auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)" }),
    h("pi-ox", { models: ["o-frei"], supports: { model: true, effort: false }, effortLevels: [] }),
    h("pi-unfenced", { allowsLanes: false }),
    h("container", { role: "place" }),
    h("codex", { models: ["x-eins", "x-eins-alt", "x-zwei"], effortLevels: ["low", "medium", "high", "xhigh", "max", "ultra"] }),
    h("fern", { availability: { status: "unavailable", since: "2026-10-08", reason: "pausiert bis zum Kontingent-Reset" } }),
  ],
  defaultModel: "c-gross",
  modelRegistry: [
    { harness: "claude", id: "c-gross-alt", status: "superseded", supersededBy: "c-gross" },
    { harness: "claude", id: "c-gross", status: "current" },
    { harness: "codex", id: "x-eins-alt", status: "superseded", supersededBy: "x-eins" },
  ],
};
const K = katalogAus(ANTWORT);
if (!K) throw new Error("Fixture: katalogAus lehnt die Server-Form ab");

describe("katalogAus liest GET /api/harnesses", () => {
  test("die Agenten des Servers, ohne den Ort container; der Standard-Agent und sein Modell", () => {
    expect(K.agenten.map((a) => a.id)).toEqual(["claude", "pi", "pi-zai", "pi-ox", "pi-unfenced", "codex", "fern"]);
    expect(standardAgent(K)).toBe("claude");
    expect(K.standardModell).toBe("c-gross");
  });
  test("was dieser Rechner nicht startet, heißt „nur auf einem anderen Rechner“ mit dem Grund des Servers; ein pausierter Agent „pausiert“", () => {
    expect(K.agenten.find((a) => a.id === "pi-zai")?.aus).toEqual({ wort: "nur auf einem anderen Rechner", grund: "auf diesem Rechner abgeschaltet (FLEET_HARNESSES_OFF)" });
    expect(K.agenten.find((a) => a.id === "fern")?.aus).toEqual({ wort: "pausiert", grund: "pausiert bis zum Kontingent-Reset" });
    expect(K.agenten.find((a) => a.id === "codex")?.aus).toBeNull();
  });
  test("lehnt ab, was nicht die Form des Katalogs hat; ein Eintrag ohne ID fällt einzeln heraus", () => {
    expect(katalogAus(null)).toBeNull();
    expect(katalogAus({ harnesses: "claude" })).toBeNull();
    expect(katalogAus([])).toBeNull();
    expect(katalogAus({ harnesses: [{ role: "agent" }, h("codex"), 7] })?.agenten.map((a) => a.id)).toEqual(["codex"]);
  });
});

describe("die Modell-Liste folgt dem Agenten", () => {
  test("je Agent seine Modelle aus dem Katalog, ohne die abgelösten", () => {
    expect(modelleVon(K, "codex")).toEqual(["x-eins", "x-zwei"]);
    expect(modelleVon(K, "claude")).toEqual(["c-gross", "c-mittel"]);
    expect(modelleVon(K, "pi-zai")).toEqual(["z-eins"]);
  });
  test("ein Agent ohne Liste, ein unbekannter und einer ohne Modell bieten nichts an", () => {
    expect(modelleVon(K, "pi")).toEqual([]);
    expect(modelleVon(K, "gibt-es-nicht")).toEqual([]);
    const ohne = katalogAus({ harnesses: [h("x", { supports: { model: false, effort: false }, models: ["m1"] })] });
    expect(ohne && modelleVon(ohne, "x")).toEqual([]);
  });
  test("Effort-Stufen je Agent; pi-ox kennt keinen Effort", () => {
    expect(effortVon(K, "codex")).toEqual(["low", "medium", "high", "xhigh", "max", "ultra"]);
    expect(effortVon(K, "pi-ox")).toEqual([]);
  });
  test("ein Modell des einen Agenten passt nicht zum anderen; ein Agent ohne Liste nimmt jeden Namen; ohne Katalog gilt der Wert", () => {
    expect(passtModell(K, "codex", "c-gross")).toBe(false);
    expect(passtModell(K, "claude", "c-gross")).toBe(true);
    expect(passtModell(K, "claude", "c-gross-alt")).toBe(true);
    expect(passtModell(K, "pi", "irgendein/modell")).toBe(true);
    expect(passtModell(K, "gibt-es-nicht", "m")).toBe(false);
    expect(passtModell(null, "codex", "c-gross")).toBe(true);
    expect(passtEffort(K, "codex", "ultra")).toBe(true);
    expect(passtEffort(K, "claude", "ultra")).toBe(false);
    expect(passtEffort(K, "pi-ox", "high")).toBe(false);
  });
});

describe("die Agenten zur Wahl", () => {
  test("alle Agenten stehen darin; was hier nicht startet, ist nicht wählbar und sagt warum", () => {
    const o = agentOptionen(K, false);
    expect(o.map((x) => x.wort)).toEqual(["Claude Code", "Pi", "Pi-zai", "Pi-ox", "Pi-unfenced", "Codex", "Fern"]);
    expect(o.filter((x) => x.aus).map((x) => [x.wert, x.aus])).toEqual([["pi-zai", "nur auf einem anderen Rechner"], ["fern", "pausiert"]]);
  });
  test("für eine Lane ist ein Agent ohne Lanes nicht wählbar, für eine MAIN schon", () => {
    expect(agentOptionen(K, true).find((x) => x.wert === "pi-unfenced")?.aus).toBe("keine Lanes");
    expect(agentOptionen(K, false).find((x) => x.wert === "pi-unfenced")?.aus).toBeUndefined();
  });
  test("Claude Code heißt so, die übrigen wie im Startfenster", () => {
    expect([agentWort("claude"), agentWort("codex"), agentWort("pi-zai"), agentWort("")]).toEqual(["Claude Code", "Codex", "Pi-zai", ""]);
  });
});

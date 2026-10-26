// Owner 2026-10-26: die offene GLM-Sitz ist eine eigene, wählbare Harness. Der Kontextstart darf sie
// deshalb nicht als Claude planen: `resolveContextHarness` fällt für jede ID außerhalb der geschlossenen
// Liste auf „claude" zurück, und genau dieser Rückfall wäre hier still falsch.
import { describe, expect, test } from "bun:test";
import { CONTEXT_PACK_HARNESSES, CONTEXT_PACK_MCP_ANSCHLUSS } from "../context-packs";
import { planContext, resolveContextHarness } from "../context-plan";

const facts = {
  sourceTree: "fleet" as const,
  mode: "mutating" as const,
  triggers: ["always", "verification", "landing", "harness-selection"] as const,
  capabilities: ["tracked-source-read", "pure-validator-run", "e2e-run", "git-inspect",
    "harness-adapter-read", "private-overlay-read", "task-queue-read", "deploy-observe"] as const,
};

describe("pi-zai-unfenced im Kontextplan", () => {
  test("die ID steht in der geschlossenen Liste und löst auf sich selbst auf, nicht auf claude", () => {
    expect(CONTEXT_PACK_HARNESSES).toContain("pi-zai-unfenced");
    expect(resolveContextHarness("pi-zai-unfenced")).toBe("pi-zai-unfenced");
    expect(resolveContextHarness("pi-zai-unfenced")).not.toBe("claude");
  });

  test("ihr Start plant dieselben Packs wie pi-zai, nicht den Claude-Plan", () => {
    const plan = (harness: string) => planContext({ ...facts, harness });
    const glm = plan("pi-zai");
    const open = plan("pi-zai-unfenced");
    expect(open.selected.map((pack) => pack.id)).toEqual(glm.selected.map((pack) => pack.id));
    expect(open.omitted.map((pack) => [pack.id, pack.why])).toEqual(glm.omitted.map((pack) => [pack.id, pack.why]));
    expect(open.selected.map((pack) => pack.id)).not.toEqual(plan("claude").selected.map((pack) => pack.id));
  });

  test("ihre MCP-Antwort ist so belegt wie die von pi-zai, nicht bloß still", () => {
    const open = CONTEXT_PACK_MCP_ANSCHLUSS["pi-zai-unfenced"];
    const fenced = CONTEXT_PACK_MCP_ANSCHLUSS["pi-zai"];
    expect(open?.zustand).toBe(fenced?.zustand);
    expect(open?.beleg.startsWith("pi mcp --help (pi 1.0.2):")).toBe(true);
  });
});

// Owner 2026-10-26, Stufe 2: der DeepSeek-Sitz ist eine eigene, waehlbare Harness hinter pi-zai's Zaun.
// Der Kontextstart darf ihn deshalb nicht als Claude planen: `resolveContextHarness` faellt fuer jede ID
// ausserhalb der geschlossenen Liste auf „claude" zurueck, und dieser Rueckfall waere hier still falsch.
describe("pi-deepseek im Kontextplan", () => {
  test("die ID steht in der geschlossenen Liste und loest auf sich selbst auf, nicht auf claude", () => {
    expect(CONTEXT_PACK_HARNESSES).toContain("pi-deepseek");
    expect(resolveContextHarness("pi-deepseek")).toBe("pi-deepseek");
    expect(resolveContextHarness("pi-deepseek")).not.toBe("claude");
  });

  test("sein Start plant dieselben Packs wie pi-zai, nicht den Claude-Plan", () => {
    const plan = (harness: string) => planContext({ ...facts, harness });
    const glm = plan("pi-zai");
    const deepseek = plan("pi-deepseek");
    expect(deepseek.selected.map((pack) => pack.id)).toEqual(glm.selected.map((pack) => pack.id));
    expect(deepseek.omitted.map((pack) => [pack.id, pack.why])).toEqual(glm.omitted.map((pack) => [pack.id, pack.why]));
    expect(deepseek.selected.map((pack) => pack.id)).not.toEqual(plan("claude").selected.map((pack) => pack.id));
  });

  test("seine MCP-Antwort ist so belegt wie die von pi-zai, nicht bloss still", () => {
    const deepseek = CONTEXT_PACK_MCP_ANSCHLUSS["pi-deepseek"];
    const fenced = CONTEXT_PACK_MCP_ANSCHLUSS["pi-zai"];
    expect(deepseek?.zustand).toBe(fenced?.zustand);
    expect(deepseek?.beleg.startsWith("pi mcp --help (pi 1.0.2):")).toBe(true);
  });
});

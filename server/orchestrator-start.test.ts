// THE OWNER'S PRIVATE PACK (owner 26.10.): docs/packs/working-with-the-owner.md keeps what holds for any person; the personal part
// lives in a private pack in Fleet's state dir, which the Orchestratorin writes herself through POST /api/self/packs. Her start
// carries both, and a start without the private pack is complete and says nothing is missing.
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PRIVATER_OWNER_PACK_ID, schreibEigenenPack } from "./eigene-packs";
import { readOrchestratorStart, readOrchestratorStartParts, renderOrchestratorStartParts } from "./orchestrator-start";

const ROOT = join(import.meta.dir, "..");
const GENERAL_PACK = join(ROOT, "docs/packs/working-with-the-owner.md");
const GENERAL = ["Read the whole conversation, not only the last message.", "Stay with their core.", "Lead with what you did or found",
  "Ask only the question that is due now", "Decide what you can, and report it."];
// A TEST'S OWN PRIVATE TEXT, never the owner's: no sentence of his stands in the tree. The id is what makes it the private pack.
const PRIVAT = "# A private pack this test writes\n\nOnly this test's private sentence: read me before you talk with the owner.";

const mitZustand = (fn: (dir: string) => void): void => {
  const dir = mkdtempSync(join(tmpdir(), "owner-pack-"));
  try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

describe("the general owner pack", () => {
  test("keeps the sentences that hold for any person, and only those", () => {
    const text = readFileSync(GENERAL_PACK, "utf8");
    for (const satz of GENERAL) expect(text).toContain(satz);
    // the private part's own title marks what left; it never comes back into the general pack
    expect(text).not.toContain("# A private pack this test writes");
  });
});

describe("the Orchestratorin's start", () => {
  test("carries the general pack from the repo and the private pack when it exists", () => mitZustand((dir) => {
    const ohne = readOrchestratorStartParts(ROOT, dir);
    expect(ohne.fehlt).toEqual([]);
    expect(readOrchestratorStart(ROOT, dir).ok).toBe(true);
    const ohneText = renderOrchestratorStartParts(ohne);
    expect(ohneText).toContain("Read the whole conversation, not only the last message.");
    expect(ohneText).not.toContain(PRIVAT);
    // a start without the private pack works and says nothing is missing
    expect(ohneText).not.toContain("MISSING");

    schreibEigenenPack(dir, { id: PRIVATER_OWNER_PACK_ID, useWhen: "Read this when you talk with this owner.",
      text: PRIVAT }, "test");
    const mit = readOrchestratorStartParts(ROOT, dir);
    expect(mit.fehlt).toEqual([]);
    expect(readOrchestratorStart(ROOT, dir).ok).toBe(true);
    expect(mit.packs.length).toBe(ohne.packs.length + 1);
    const mitText = renderOrchestratorStartParts(mit);
    expect(mitText).toContain("Read the whole conversation, not only the last message.");
    expect(mitText).toContain(PRIVAT);
  }));
});

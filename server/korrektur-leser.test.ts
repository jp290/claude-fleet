// Ein Sitz ohne Rolle in Fleets Repo liest die Owner-Korrekturen (Orchestratorin 24.10.): Bau-Sitze auf einem Board-Branch und freie
// Sitze im Checkout bauen Fleet, und das Heft gilt für sie mit der Geltung einer Lane (server.ts#korrekturLeserFor). Ein Sitz in einem
// fremden Repo bleibt bei 409, denn das Heft ist persönlich und reist nicht. Der Server dieses Tests läuft aus diesem Checkout, einem
// Worktree von Fleets Repo: ein Sitz dort steht wie ein Bau-Sitz auf einem Board-Branch.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Answer, branchTestkit, get, persisted, post } from "./branches-testkit";

const { TMP, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const FLEET_REPO = join(import.meta.dir, "..");
const DOOR = "/api/self/konzepte/k-owner-korrekturen/leseansicht";

const ALLE = { projekte: "*", harnesses: "*", modi: "*" } as const;
const eintrag = (id: string, rollen: string[]) => ({ id, aussage: `Aussage ${id}`, quelle: "fixture", geltung: { ...ALLE, rollen }, ersetzt: [] });
const HEFT = { eintraege: [eintrag("fuer-bauer", ["lane", "orchestrator", "program-main"]), eintrag("nur-orchestratorin", ["orchestrator"]),
  eintrag("nur-main", ["orchestrator", "program-main"])], zurueckgezogen: [] };

function konzeptWurzel(): string {
  const root = join(TMP, `konzepte-${Date.now()}`);
  mkdirSync(join(root, "k-owner-korrekturen"), { recursive: true });
  return root;
}
const ids = (a: Answer | undefined): string[] => ((a?.body.geltendeEintraege ?? []) as { id: string }[]).map((e) => e.id);

describe("die Owner-Korrekturen für einen Sitz ohne Rolle", () => {
  test("in Fleets Repo liest er die Einträge einer Lane mit 200, im fremden Repo bekommt er 409 ohne einen Eintrag", async () => {
    const f = fixture();
    const root = konzeptWurzel();
    const text = `# Owner-Korrekturen\n\n\`\`\`owner-korrekturen\n${JSON.stringify(HEFT, null, 2)}\n\`\`\`\n`;
    writeFileSync(join(root, "k-owner-korrekturen", "v1.md"), text);
    const env = { FLEET_KONZEPT_ROOT: root };
    const [veroeffentlicht, bau, fremd] = await life(f, [
      post("/api/konzepte/k-owner-korrekturen/versionen", { sha256: createHash("sha256").update(text).digest("hex"),
        anlass: "Test", geltung: "Test", erwartet: null }),
      post("/api/slots/8/open", { cwd: FLEET_REPO }), post("/api/slots/7/open", { cwd: f.repo }), "save"], env);
    expect([veroeffentlicht?.status, bau?.status, fremd?.status]).toEqual([200, 200, 200]);
    const tok = (n: number) => String((persisted(f).slots as Record<string, { selfToken?: string }>)[String(n)]?.selfToken);
    const [liest, voll, fremdes, fremdVoll, fassung, fremdFassung] = await life(f, [
      { ...get(DOOR), token: null, self: tok(8) }, { ...get(`${DOOR}/nur-orchestratorin`), token: null, self: tok(8) },
      { ...get(DOOR), token: null, self: tok(7) }, { ...get(`${DOOR}/fuer-bauer`), token: null, self: tok(7) },
      get("/api/slots/8/fassung?anlass=laufend"), get("/api/slots/7/fassung?anlass=laufend")], env);
    expect([liest?.status, ids(liest), (liest?.body.bindung as { rolle?: string } | undefined)?.rolle]).toEqual([200, ["fuer-bauer"], "lane"]);
    expect(voll?.status).toBe(404);
    expect([fremdes?.status, fremdes?.body.geltendeEintraege, String(fremdes?.body.error)])
      .toEqual([409, undefined, expect.stringContaining("does not travel")]);
    expect(fremdVoll?.status).toBe(409);
    // seine Fassung nennt das Heft unter „Liest“ als Zeiger auf die Tür; die Fassung des Sitzes im fremden Repo nennt es nicht
    const korrekturen = (a: Answer | undefined) => ((a?.body.teile ?? []) as { id: string; abschnitte: { id: string; text: string | null }[] }[])
      .find((t) => t.id === "liest")?.abschnitte.filter((x) => x.id === "korrekturen").map((x) => x.text) ?? null;
    expect(korrekturen(fassung)).toEqual([expect.stringContaining(DOOR)]);
    expect(korrekturen(fremdFassung)).toEqual([]);
  }, 90_000);
});

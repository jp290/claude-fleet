// EIN LAUFENDER PI-SITZ WECHSELT DAS MODELL NUR INNERHALB SEINES ANBIETERS. Das Live-Menü im Composer tippt `/model <id>` in die laufende
// pi; der Anbieterwechsel (DeepSeek <-> GLM) braucht aber einen anderen Schlüssel und ein anderes Agent-Verzeichnis (server.ts#piSeatSpawnCmd),
// und derselbe --session-id fängt in einem anderen Verzeichnis neu an: die Unterhaltung wäre weg, und das Board stünde schon auf dem neuen Modell.
// Hier: die Regel rein (ihre Anbieter-Tabelle gegen die Startzeile steht in server/load.test.ts) und die Tür selbst an einem echten Server.
import { afterAll, describe, expect, test } from "bun:test";
import { type Answer, branchTestkit, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";
import { piLiveSwitchRefusal } from "../model-register";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

describe("piLiveSwitchRefusal: nur ein Wechsel innerhalb des Anbieters", () => {
  test("DeepSeek <-> DeepSeek und GLM <-> GLM gehen, jeder Wechsel über die Grenze nennt den neuen Sitz", () => {
    for (const h of ["pi", "pi-unfenced"]) {
      expect(piLiveSwitchRefusal(h, "deepseek-flash", "deepseek-v4-pro")).toBeNull();
      expect(piLiveSwitchRefusal(h, "glm-5.3", "glm-5.3-flash")).toBeNull();
      for (const [von, nach] of [["deepseek-flash", "glm-5.3"], ["glm-5.3-flash", "deepseek-v4-pro"], [null, "glm-5.3"], ["deepseek-flash", null]] as const) {
        const satz = piLiveSwitchRefusal(h, von, nach);
        expect([h, von, nach, satz?.includes("open a new seat")]).toEqual([h, von, nach, true]);
      }
    }
  });
  test("zwei Namen, die der Sitz nicht führt (die eigene pi des Owners), und jeder andere Harness bleiben frei", () => {
    expect(piLiveSwitchRefusal("pi", null, "some-local-tag")).toBeNull();
    expect(piLiveSwitchRefusal("pi", "some-local-tag", null)).toBeNull();
    expect(piLiveSwitchRefusal("pi-zai", "glm-5.3", "glm-5.3-flash")).toBeNull();
    expect(piLiveSwitchRefusal("claude", "claude-opus-5-5", "claude-sonnet-5-5")).toBeNull();
  });
});

const ok = (a: Answer | undefined): Record<string, any> => {
  if (!a || a.status >= 300) throw new Error(`erwartet 2xx: ${JSON.stringify(a)}`);
  return a.body as Record<string, any>;
};

describe("die Tür /api/slots/:id/model", () => {
  test("ein DeepSeek-Sitz wechselt zu deepseek-v4-pro, aber nicht zu glm-5.3: 409, der Slot behält sein Modell", async () => {
    const f = fixture();
    const [offen, innerhalb, ueber, zurueck] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, harness: "pi", model: "deepseek-flash" }),
      post("/api/slots/1/model", { model: "deepseek-v4-pro" }),
      post("/api/slots/1/model", { model: "glm-5.3" }),
      post("/api/slots/1/model", { model: "deepseek-flash" }),
    ]);
    ok(offen);
    expect(ok(innerhalb).model).toBe("deepseek-v4-pro");
    expect(ueber?.status).toBe(409);
    expect(String((ueber?.body as Record<string, unknown>).error)).toContain("open a new seat");
    expect(ok(zurueck).model).toBe("deepseek-flash");
    expect((persisted(f).slots as Record<string, { model?: string }>)["1"]?.model).toBe("deepseek-flash");
  }, LIFE_DEADLINE_MS * 2);
});

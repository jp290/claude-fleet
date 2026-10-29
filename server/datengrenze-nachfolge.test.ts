// DIE DATENGRENZE IM NACHFOLGE-BRIEF (server/datengrenze.ts, Tür 14): ein Harness ohne Fleets Systemprompt bekommt die Steine seiner Vorgängerin
// im Übergabebrief (server.ts#nachfolgeSteineFuer). Ein persönlicher Pack unter ihnen darf dort nicht als Text stehen, wenn die Nachfolgerin
// kein Anthropic-Sitz ist; er steht als Zeile „− pack <id>: personal, not delivered to …“, der unmarkierte Pack daneben bleibt Text.
// Aufbau wie server/selbst-einrichten-tuer.test.ts (ein pi-Sitz übergibt an seine Nachfolgerin).
import { afterAll, describe, expect, test } from "bun:test";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";
import { weggelassenZeile } from "./datengrenze";
import { schreibEigenenPack } from "./eigene-packs";

const { BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const kurz = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };

describe("Nachfolge-Brief: ein persönlicher Stein der Vorgängerin bleibt für einen Sitz, der nicht Anthropic ist, eine Zeile", () => {
  test("ein pi-Sitz übergibt an einen pi-Sitz: der persönliche Pack fehlt als Text und steht als Zeile, der offene Pack steht als Text", async () => {
    const f = fixture();
    symlinkSync("/bin/bash", join(BIN, "pi-bash"));
    writeFileSync(join(BIN, "pi"), `#!${join(BIN, "pi-bash")}\nwhile :; do sleep 1; done\n`, { mode: 0o755 });
    schreibEigenenPack(f.state, { id: "privat-probe", useWhen: "Wenn die Probe läuft.", text: "# Privat\n\nDas Konto des Owners endet auf 4711.", personal: true }, "test");
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi" })]);
    expect(opened?.status).toBe(200);
    const token = (persisted(f).slots as Record<string, { selfToken?: string }>)["1"]!.selfToken!;
    const als = (step: ReturnType<typeof post> | ReturnType<typeof get>) => ({ ...step, token: null, self: token });
    const [gesetzt] = await life(f, [als(post("/api/self/einrichten", { packs: ["privat-probe", "fleet-doors"] }))]);
    expect(gesetzt?.status).toBe(200);
    const [nachfolge, hist] = await life(f, [als(post("/api/self/succeed", {})), get("/api/slots/1/history")], kurz);
    expect(nachfolge?.status).toBeLessThan(300);
    const brief = (hist?.body.history as { text: string }[] | undefined)?.at(-1)?.text ?? "";
    expect(brief).toContain("YOUR PREDECESSOR'S STONES");
    expect(brief).toContain("# Fleet's doors");
    expect(brief).toContain(weggelassenZeile("pack privat-probe", "pi", null));
    expect(brief).not.toContain("endet auf 4711");
  }, LIFE_DEADLINE_MS * 4);
});

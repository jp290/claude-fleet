// WER EINE NACHFOLGE-SCHULD ÜBERNIMMT (W3 Auftrag 8, Befund W7-1; server.ts#adoptSuccessionDebt): scheitert die Nachfolge einer Leitung nach dem Kill,
// bleibt ihre Linie als Schuld liegen. Übernehmen darf sie nur (a) die Öffnung des Owners, (b) ein Sitz, den die Orchestratorin öffnet (sie repariert
// gescheiterte Nachfolgen) — nur die Schuld eines Sitzes ohne Öffnerin (Auftrag 12) —, (c) ein Sitz, den die Öffnerin (nach Linie) öffnet. Ein anderer Sitz, der durch die Self-Tür in Ordner und Label der
// Leitung öffnet und dabei ihren Platz bekommt, öffnet einen gewöhnlichen neuen Sitz mit eigener Linie — er kommt nicht an die passt- und die
// Testinstanz-Tür ihrer Kinder, und die Schuld bleibt für den Richtigen liegen. Jede Probe geht durch einen Server in eigenem Prozess (branches-testkit).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, commitIn, type Fixture, LIFE_DEADLINE_MS, persisted, post, sh } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`kein Self-Token für Slot ${slot}`);
  return t;
};
const als = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const sitz = (f: Fixture, slot: number): { cwd?: string; linie?: string; openedAt?: number } | undefined =>
  (persisted(f).slots as Record<string, { cwd?: string; linie?: string; openedAt?: number }>)[String(slot)];
const OPEN = "/api/self/seats/open", LABEL = "Leitung A";
const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
const schuldZeilen = (f: Fixture): string[] => readFileSync(join(f.state, "audit.jsonl"), "utf8").split("\n").filter(Boolean)
  .map((l) => JSON.parse(l) as { event?: string }).filter((r) => r.event === "succession_debt").map((r) => JSON.stringify(r));
const adoptiert = (f: Fixture): string[] => schuldZeilen(f).filter((r) => r.includes("adopted by") && !r.includes("not adopted by"));
const abgelehnt = (f: Fixture): string[] => schuldZeilen(f).filter((r) => r.includes("not adopted by"));
// die Nachfolge der Leitung scheitert zwischen Kill und Neuöffnen (Test-Riegel): ihr Platz ist leer, ihre Linie liegt als Schuld
async function nachfolgeScheitert(f: Fixture, slot: number, env: Record<string, string>): Promise<string> {
  const linie = String(sitz(f, slot)?.linie);
  expect(linie).toMatch(/^[0-9a-f]{24}$/);
  const latch = join(dirname(f.repo), `respawn-faellt-${slot}`);
  writeFileSync(latch, "x");
  const [nachfolge] = await life(f, [als(tokenOf(f, slot), post("/api/self/succeed", {}))], { ...env, ...QUICK, FLEET_TEST_SUCCESSION_RESPAWN_FAIL_LATCH: latch });
  expect(nachfolge?.status).toBeGreaterThanOrEqual(400);
  expect(sitz(f, slot)?.cwd ?? null).toBeNull();
  return linie;
}

describe("W7-1 · wer die Schuld einer gescheiterten Nachfolge übernimmt", () => {
  test("ein fremder Sitz, der in Ordner und Label der Leitung öffnet, bekommt ihre Linie nicht (409 an passt- und Testinstanz-Tür); der Owner übernimmt sie danach", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kind" }), post("/api/slots/1/open", { cwd: f.repo, label: LABEL })], env);
    const branch = String(made?.body.branch), path = String(made?.body.path);
    await life(f, [post("/api/slots/1/rechte", { grant: ["branch.passt", "text.handover", "seat.open"] })], env);
    const [kindAuf] = await life(f, [als(tokenOf(f, 1), post("/api/self/branches/open", { branch, goal: "Build." }))], env);
    const kind = Number(kindAuf?.body.slot);
    expect(kindAuf?.status).toBe(200);
    commitIn(path, "a.txt", "erste Arbeit");
    // X: ein eigener Sitz in Platz 3, vom Owner geöffnet, mit seat.open und branch.passt
    await life(f, [post("/api/slots/3/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/3/rechte", { grant: ["seat.open", "branch.passt"] })], env);
    const linie = await nachfolgeScheitert(f, 1, env);
    const [neu] = await life(f, [als(tokenOf(f, 3), post(OPEN, { cwd: f.repo, label: LABEL, rechte: { recht: ["branch.passt"] } }))], env);
    expect(neu?.status).toBe(200);
    const n = Number(neu?.body.slot);
    expect(n).toBe(1); // der niedrigste freie Platz ist der der Leitung
    expect(sitz(f, 1)?.linie).not.toBe(linie);
    expect(adoptiert(f)).toEqual([]);
    const [passt, instanz] = await life(f, [als(tokenOf(f, 1), post(`/api/self/seats/${kind}/passt`, { head: sh(f.repo, "rev-parse", branch) })),
      als(tokenOf(f, 1), post("/api/self/testinstanz", { action: "down", slot: kind }))], env);
    expect(passt?.status).toBe(409);
    expect(String(passt?.body.error)).toContain("did not open");
    expect(instanz?.status).toBe(409);
    expect(String(instanz?.body.error)).toContain("neither you");
    // (a) die Schuld lag für den Richtigen: der Owner beendet den Sitz von X und öffnet Platz und Ordner der Leitung neu — die Linie kommt zurück
    await life(f, [post("/api/slots/1/kill", {})], env);
    const [owner] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, label: LABEL })], env);
    expect(owner?.status).toBe(200);
    expect(sitz(f, 1)?.linie).toBe(linie);
    expect(adoptiert(f).length).toBe(1);
    expect(adoptiert(f)[0]).toContain("the owner open");
  }, LIFE_DEADLINE_MS * 16);

  test("(b) ein Sitz, den die Orchestratorin öffnet, übernimmt die Schuld; die Audit-Zeile nennt sie", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" }), post("/api/slots/1/open", { cwd: f.repo, label: LABEL })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] }), post("/api/slots/1/rechte", { grant: ["text.handover"] })], env);
    const linie = await nachfolgeScheitert(f, 1, env);
    const [neu] = await life(f, [als(tokenOf(f, 9), post(OPEN, { cwd: f.repo, label: LABEL }))], env);
    expect(neu?.status).toBe(200);
    expect(Number(neu?.body.slot)).toBe(1);
    expect(sitz(f, 1)?.linie).toBe(linie);
    expect(adoptiert(f).length).toBe(1);
    expect(adoptiert(f)[0]).toContain("Orchestratorin");
  }, LIFE_DEADLINE_MS * 10);

  // H1-b (W3 Auftrag 10): hing die Vorgängerin unter niemandem (der Owner öffnete die Leitung), hängt auch die Nachfolgerin unter niemandem — nicht unter
  // der Orchestratorin, die die Schuld übernahm
  test("H1-b · übernimmt die Orchestratorin die Schuld einer Leitung, die der Owner öffnete, hängt die Nachfolgerin unter niemandem", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    await life(f, [post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" }), post("/api/slots/1/open", { cwd: f.repo, label: LABEL })], env);
    await life(f, [post("/api/slots/9/rechte", { grant: ["seat.open"] }), post("/api/slots/1/rechte", { grant: ["text.handover"] })], env);
    const linie = await nachfolgeScheitert(f, 1, env);
    const [neu] = await life(f, [als(tokenOf(f, 9), post(OPEN, { cwd: f.repo, label: LABEL }))], env);
    expect(neu?.status).toBe(200);
    expect(Number(neu?.body.slot)).toBe(1);
    expect(sitz(f, 1)?.linie).toBe(linie);
    expect((persisted(f).slots as Record<string, { openedBy?: unknown }>)["1"]?.openedBy ?? null).toBeNull();
    expect(adoptiert(f)[0]).toContain("Orchestratorin");
    // die Historie sagt dasselbe: die Belegung hat keine Öffnerin
    const [hist, ende] = await life(f, [{ method: "GET", path: "/api/k15/historie?max=20" }, als(tokenOf(f, 9), post("/api/self/seats/1/end", {}))], env);
    const zeile = (hist?.body.starts as { slot: number; openedAt: number; openedBy: unknown }[]).find((z) => z.slot === 1 && z.openedAt === sitz(f, 1)?.openedAt);
    expect(zeile?.openedBy ?? null).toBeNull();
    expect(ende?.status).toBe(409); // die Orchestratorin ist nicht ihre Öffnerin
  }, LIFE_DEADLINE_MS * 10);

  // H1-a (W3 Auftrag 12, Prüfung Runde 4): die Schuld eines Kindes gehört seiner Öffnerin. Die Orchestratorin übernimmt sie nicht — mit einem Recht über
  // der Leitung, im Modus bypass, ohne Angabe von Rechten, und auch nicht, wenn die Linie der Leitung tot ist; ihr Sitz bleibt ein gewöhnlicher neuer Sitz
  // unter ihr, die Audit-Zeile sagt warum, und die Schuld wartet auf den Owner (a) oder die Öffnerin (c). Je Fall eine eigene Schuld.
  const FAELLE: [string, Record<string, unknown>, boolean][] = [["edge.grant", { rechte: { recht: ["edge.grant"] } }, false],
    ["bypass", { permissionMode: "bypassPermissions" }, false], ["ohne Rechte", {}, false], ["tote Linie der Öffnerin", {}, true]];
  for (const [was, body, linieTot] of FAELLE)
    test(`H1-a · die Orchestratorin übernimmt die Schuld eines Kindes nicht (${was}); die Schuld wartet, der Owner übernimmt sie`, async () => {
      const f = fixture();
      const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
      const [made] = await life(f, [post("/api/branches", { repo: f.repo, name: "Kind" }), post("/api/slots/1/open", { cwd: f.repo, label: LABEL }),
        post("/api/slots/9/open", { cwd: f.repo, label: "🎛 Orchestratorin" })], env);
      const branch = String(made?.body.branch), path = String(made?.body.path);
      await life(f, [post("/api/slots/1/rechte", { grant: ["branch.passt", "seat.open"] }), post("/api/slots/9/rechte", { grant: ["seat.open"] })], env);
      const [kindAuf] = await life(f, [als(tokenOf(f, 1), post("/api/self/branches/open", { branch, goal: "Build." }))], env);
      expect(kindAuf?.status).toBe(200);
      const kind = Number(kindAuf?.body.slot);
      const kindLabel = (persisted(f).slots as Record<string, { label?: string }>)[String(kind)]?.label;
      const leitung = (persisted(f).slots as Record<string, { openedBy?: { slot: number } }>)[String(kind)]?.openedBy;
      expect(leitung?.slot).toBe(1);
      await life(f, [post(`/api/slots/${kind}/rechte`, { grant: ["text.handover"] })], env);
      const linie = await nachfolgeScheitert(f, kind, env);
      // die Linie der Leitung endet; Platz 1 belegt danach eine frische Session des Owners (eigene Linie), damit der Sitz der Orchestratorin wieder in den
      // Platz des Kindes kommt (die Self-Tür nimmt den niedrigsten freien)
      if (linieTot) {
        const anders = join(dirname(f.repo), "anders");
        mkdirSync(anders, { recursive: true });
        await life(f, [post("/api/slots/1/kill", {})], env);
        await life(f, [post("/api/slots/1/open", { cwd: anders })], env);
        expect(sitz(f, 1)?.linie).not.toBe((leitung as { linie?: string }).linie);
      }
      const wo = { cwd: path, ...(kindLabel ? { label: kindLabel } : {}) };
      const [neu] = await life(f, [als(tokenOf(f, 9), post(OPEN, { ...wo, ...body }))], env);
      expect(neu?.status).toBe(200);
      expect(Number(neu?.body.slot)).toBe(kind);
      expect(sitz(f, kind)?.linie).not.toBe(linie);
      expect((persisted(f).slots as Record<string, { openedBy?: { slot: number } }>)[String(kind)]?.openedBy?.slot).toBe(9);
      expect(adoptiert(f)).toEqual([]);
      expect(abgelehnt(f).length).toBe(1);
      expect(abgelehnt(f)[0]).toContain("the debt belongs to its opener");
      // die Schuld hat gewartet: der Owner gibt den Platz frei, öffnet Platz und Ordner neu und übernimmt sie; die Nachfolgerin hängt, wo die Vorgängerin hing
      await life(f, [post(`/api/slots/${kind}/kill`, {})], env);
      const [owner] = await life(f, [post(`/api/slots/${kind}/open`, wo)], env);
      expect(owner?.status).toBe(200);
      expect(sitz(f, kind)?.linie).toBe(linie);
      expect((persisted(f).slots as Record<string, { openedBy?: { slot: number } }>)[String(kind)]?.openedBy).toEqual(leitung);
      expect(adoptiert(f).length).toBe(1);
      expect(adoptiert(f)[0]).toContain("the owner open");
    }, LIFE_DEADLINE_MS * 12);

  test("(c) ein Sitz, den die Öffnerin der Leitung öffnet, übernimmt die Schuld", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: dirname(f.repo) };
    const ort = join(dirname(f.repo), "leitung");
    mkdirSync(ort, { recursive: true });
    await life(f, [post("/api/slots/1/open", { cwd: f.repo })], env);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const [lead] = await life(f, [als(tokenOf(f, 1), post(OPEN, { cwd: ort, label: LABEL, goal: "Leite." }))], env);
    expect(lead?.status).toBe(200);
    const L = Number(lead?.body.slot);
    await life(f, [post(`/api/slots/${L}/rechte`, { grant: ["text.handover"] })], env);
    const linie = await nachfolgeScheitert(f, L, env);
    const [neu] = await life(f, [als(tokenOf(f, 1), post(OPEN, { cwd: ort, label: LABEL, goal: "Leite weiter." }))], env);
    expect(neu?.status).toBe(200);
    expect(Number(neu?.body.slot)).toBe(L);
    expect(sitz(f, L)?.linie).toBe(linie);
    expect(adoptiert(f).length).toBe(1);
    expect(adoptiert(f)[0]).toContain("its opener");
  }, LIFE_DEADLINE_MS * 10);
});

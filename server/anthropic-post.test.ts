// DER ZAUN IST WEG (Owner 30.10.: „[Zitat entfernt]“): zwei Anthropic-Sitze ohne stehende Rolle schreiben sich
// über Fleets Postfach direkt, ohne Kante und ohne Ablauf; die Orchestratorin schreibt jedem solchen Sitz. Was bleibt: ein pi- oder
// Codex-Sitz am einen Ende hält die alte Regel (Gegenüber, Kante, Paar eines Ordner-Sitzes), und die Datengrenze am Text
// (server/datengrenze.ts) gilt weiter. Die Türen sind die echten (ein Server je `life`, branches-testkit).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const seat = (f: ReturnType<typeof fixture>, slot: number): string => {
  const s = (persisted(f).slots as Record<string, { selfToken: string }> | undefined)?.[String(slot)];
  if (!s?.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s.selfToken;
};
const as = (f: ReturnType<typeof fixture>, slot: number, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self: seat(f, slot) });
const schreib = (f: ReturnType<typeof fixture>, from: number, to: number, key: string, text: string, personal?: boolean) => as(f, from,
  post("/api/self/messages", { to: { kind: "session", slot: to }, payload: { kind: "text", text }, idempotencyKey: key,
    ...(personal === undefined ? {} : { personal }) }));
const texte = (a: Answer | undefined): string[] => ((a?.body.entries as { payload: { text: string } }[] | undefined) ?? []).map((m) => m.payload.text);

describe("zwei Claude-Sitze schreiben sich ohne Kante", () => {
  test("zwei freie Claude-Sitze in zwei Ordnern: 200 in beide Richtungen; die Orchestratorin schreibt jedem; ein pi-Sitz am Ende bleibt 409", async () => {
    const ORCH = 1, A = 2, B = 3, P = 4;
    const f = fixture();
    for (const d of ["a", "b", "p"]) mkdirSync(join(f.repo, d));
    const opened = await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Claude A" }),
      post(`/api/slots/${B}/open`, { cwd: join(f.repo, "b"), label: "Claude B" }),
      post(`/api/slots/${P}/open`, { cwd: join(f.repo, "p"), label: "pi P", harness: "pi" }), "save"]);
    expect(opened.slice(0, 4).map((o) => o.status)).toEqual([200, 200, 200, 200]);
    const [ab, ba, orchAnA, aAnPi, piAnA, orchAnPi, bPost, aPost, piPost] = await life(f, [
      schreib(f, A, B, "k1", "Von A an B, ohne Kante."),
      schreib(f, B, A, "k2", "Von B an A, ohne Kante."),
      as(f, ORCH, post("/api/self/messages", { to: { kind: "session", slot: A }, payload: { kind: "text", text: "Von der Orchestratorin, ohne Antwort." }, idempotencyKey: "o1" })),
      schreib(f, A, P, "k3", "An den pi-Sitz."),
      schreib(f, P, A, "k4", "Vom pi-Sitz."),
      as(f, ORCH, post("/api/self/messages", { to: { kind: "session", slot: P }, payload: { kind: "text", text: "An den pi-Sitz." }, idempotencyKey: "o2" })),
      as(f, B, get("/api/self/messages?unread=1")), as(f, A, get("/api/self/messages?unread=1")), as(f, P, get("/api/self/messages?unread=1"))]);
    expect([ab?.status, (ab?.body.holder as { slot: number } | null)?.slot]).toEqual([200, B]);
    expect([ba?.status, (ba?.body.holder as { slot: number } | null)?.slot]).toEqual([200, A]);
    expect([orchAnA?.status, (orchAnA?.body.holder as { slot: number } | null)?.slot]).toEqual([200, A]);
    expect(texte(bPost)).toContain("Von A an B, ohne Kante.");
    expect(texte(aPost)).toEqual(expect.arrayContaining(["Von B an A, ohne Kante.", "Von der Orchestratorin, ohne Antwort."]));
    // wo ein pi-Sitz am Ende steht, gilt die alte Regel, in beide Richtungen und für die Orchestratorin
    for (const a of [aAnPi, piAnA, orchAnPi]) {
      expect(a?.status).toBe(409);
      expect(String(a?.body.error)).toContain("an unbound session may address only the Orchestrator");
    }
    expect(texte(piPost)).toEqual([]);
  }, LIFE_DEADLINE_MS * 4);

  // Prüfung W1, Lücke 2a: „Arbeitet mit“ nennt „slot 1: the Orchestrator“, und `ctl.sh send --seat 1` schreibt {kind:"session",slot:1}.
  // Diese eine Adressform muss sie erreichen — von einem Claude-Sitz wie von einem pi-Sitz, wie es ihre Rolle-Adresse tut.
  test("die Adresse aus „Arbeitet mit“ erreicht die Orchestratorin: {kind:session, slot:<ihr Slot>} ist 200 und landet bei ihr", async () => {
    const ORCH = 1, A = 2, P = 3;
    const f = fixture();
    for (const d of ["a", "p"]) mkdirSync(join(f.repo, d));
    await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Claude A" }),
      post(`/api/slots/${P}/open`, { cwd: join(f.repo, "p"), label: "pi P", harness: "pi" }), "save"]);
    const [vonA, vonP, post1] = await life(f, [schreib(f, A, ORCH, "s1", "Von A an Slot 1."), schreib(f, P, ORCH, "s2", "Vom pi-Sitz an Slot 1."),
      as(f, ORCH, get("/api/self/messages?unread=1"))]);
    for (const a of [vonA, vonP]) expect([a?.status, (a?.body.holder as { slot: number } | null)?.slot]).toEqual([200, ORCH]);
    expect(texte(post1)).toEqual(expect.arrayContaining(["Von A an Slot 1.", "Vom pi-Sitz an Slot 1."]));
  }, LIFE_DEADLINE_MS * 2);

  // Prüfung W1, Runde 2: die Orchestratorin selbst an ihren eigenen Slot bleibt die 409 von vorher, keine Nachricht an sich selbst
  test("die Orchestratorin an ihren eigenen Slot: 409, und in ihrem Postfach liegt nichts", async () => {
    const ORCH = 1;
    const f = fixture();
    await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }), "save"]);
    const [selbst, post1] = await life(f, [schreib(f, ORCH, ORCH, "self", "An mich selbst."), as(f, ORCH, get("/api/self/messages?unread=1"))]);
    expect(selbst?.status).toBe(409);
    expect(texte(post1)).toEqual([]);
  }, LIFE_DEADLINE_MS * 2);

  test("eine persönliche Nachricht an einen pi-Sitz bleibt 409, auch wo eine Kante die beiden verbindet", async () => {
    const ORCH = 1, A = 2, P = 3;
    const f = fixture();
    for (const d of ["a", "p"]) mkdirSync(join(f.repo, d));
    await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
      post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Claude A" }),
      post(`/api/slots/${P}/open`, { cwd: join(f.repo, "p"), label: "pi P", harness: "pi" }), "save"]);
    const [kante] = await life(f, [as(f, ORCH, post("/api/self/kanten", { between: [A, P], why: "Probe", minutes: 30 }))]);
    expect(kante?.status).toBe(201);
    const [persoenlich, offen] = await life(f, [schreib(f, A, P, "d1", "Die Steuernummer.", true), schreib(f, A, P, "d2", "Der Stand des Builds.")]);
    expect(persoenlich?.status).toBe(409);
    expect(offen?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 3);
});

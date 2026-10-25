// Kanten (server/kanten.ts, server.ts#kantenTuer): die Orchestratorin lässt zwei Sessions eine Zeit lang direkt schreiben.
// Ohne Kante weist die Postfach-Tür ab; mit ihr kommt die Nachricht an, in beide Richtungen, beide Enden erfahren es in einem
// Satz, die Orchestratorin liest mit, und das Board zeigt sie. Nach ihrem Ende weist die Tür wieder ab und sagt, seit wann.
// Eine Session gibt sich nie selbst eine Kante.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { kanteGeben, kantenGeladen, kantenWunsch, lebendeKante, beendeteKante } from "./kanten";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const ORCH = 1, A = 2, B = 3;
const seat = (f: Fixture, slot: number): { openedAt: number; selfToken: string } => {
  const s = (persisted(f).slots as Record<string, { openedAt: number; selfToken: string }> | undefined)?.[String(slot)];
  if (!s?.selfToken) throw new Error(`Slot ${slot} ist in fleet.json nicht besetzt`);
  return s;
};
const as = (f: Fixture, slot: number, step: { method: string; path: string; body?: unknown }) =>
  ({ ...step, token: null, self: seat(f, slot).selfToken });
const schreib = (f: Fixture, from: number, to: number, key: string, text: string) => as(f, from,
  post("/api/self/messages", { to: { kind: "session", slot: to }, payload: { kind: "text", text }, idempotencyKey: key }));
const texte = (a: Answer | undefined): string[] =>
  ((a?.body.entries as { payload: { text: string } }[] | undefined) ?? []).map((m) => m.payload.text);

async function dreiSessions(): Promise<Fixture> {
  const f = fixture();
  for (const d of ["a", "b"]) mkdirSync(join(f.repo, d));
  const opened = await life(f, [post(`/api/slots/${ORCH}/open`, { cwd: f.repo, label: "🎛 Orchestratorin" }),
    post(`/api/slots/${A}/open`, { cwd: join(f.repo, "a"), label: "Startfenster" }),
    post(`/api/slots/${B}/open`, { cwd: join(f.repo, "b"), label: "Wicht" })]);
  expect(opened.map((o) => o.status)).toEqual([200, 200, 200]);
  return f;
}

describe("Kanten: zwei Sessions schreiben sich direkt, auf Zeit, mit Freigabe der Orchestratorin", () => {
  test("ohne Kante abgewiesen, mit ihr zugestellt und mitgelesen, nach ihrem Ende wieder abgewiesen", async () => {
    const f = await dreiSessions();
    const [ohne, selbst, frei, ab, ba, sieht, board, inboxA] = await life(f, [
      schreib(f, A, B, "1", "vor der Kante"),
      as(f, A, post("/api/self/kanten", { between: [A, B], why: "ich gebe sie mir selbst" })),
      as(f, ORCH, post("/api/self/kanten", { between: [A, B], why: "beide bauen die Chat-Ansicht", minutes: 0.08 })),
      schreib(f, A, B, "2", "Startfenster an Wicht"),
      schreib(f, B, A, "3", "Wicht an Startfenster"),
      as(f, ORCH, get("/api/self/kanten")),
      get("/api/sessions"),
      as(f, A, get("/api/self/messages?unread=1")),
    ]);
    expect(ohne?.status).toBe(409);
    expect(selbst?.status).toBe(403);
    expect(frei?.status).toBe(201);
    expect((frei?.body.told as string[]).length).toBe(2);
    expect([ab?.status, (ab?.body.holder as { slot: number } | null)?.slot]).toEqual([200, B]);
    expect([ba?.status, (ba?.body.holder as { slot: number } | null)?.slot]).toEqual([200, A]);
    // die Orchestratorin sieht jede Nachricht, die nur die Kante durchließ
    const [k] = sieht?.body.kanten as { between: number[]; live: boolean; messages: { from: number; to: number; text: string }[] }[];
    expect(k?.live).toBe(true);
    expect(k?.messages.map((m) => [m.from, m.to, m.text])).toEqual([[A, B, "Startfenster an Wicht"], [B, A, "Wicht an Startfenster"]]);
    // das Board: beide Zeilen tragen die Kante zur jeweils anderen
    const rows = (board?.body.slots as { id: number; kanten?: { slot: number }[] }[]);
    expect(rows.find((r) => r.id === A)?.kanten?.map((x) => x.slot)).toEqual([B]);
    expect(rows.find((r) => r.id === B)?.kanten?.map((x) => x.slot)).toEqual([A]);
    expect(rows.find((r) => r.id === ORCH)?.kanten).toBeUndefined();
    // ein Satz an jedes Ende
    expect(texte(inboxA).some((t) => t.startsWith(`Du kannst Slot ${B} bis `) && t.includes("Chat-Ansicht"))).toBe(true);

    await Bun.sleep(5_200); // 0,08 Minuten sind 4,8 s
    const [danach, boardDanach] = await life(f, [schreib(f, A, B, "4", "nach dem Ende"), get("/api/sessions")]);
    expect(danach?.status).toBe(409);
    expect(String(danach?.body.error)).toContain(`your edge to slot ${B} ended at`);
    expect((boardDanach?.body.slots as { id: number; kanten?: unknown }[]).find((r) => r.id === A)?.kanten).toBeUndefined();
  }, LIFE_DEADLINE_MS * 4);

  test("die Orchestratorin schließt eine Kante vor ihrem Ende; eine Kante verbindet nie eine Session mit ihr selbst", async () => {
    const f = await dreiSessions();
    const [frei, mitIhr] = await life(f, [as(f, ORCH, post("/api/self/kanten", { between: [A, B], why: "kurz abstimmen" })),
      as(f, ORCH, post("/api/self/kanten", { between: [A, ORCH], why: "mit mir" }))]);
    expect([frei?.status, mitIhr?.status]).toEqual([201, 409]);
    const id = (frei?.body.kante as { id: string }).id;
    const [zu, danach, inboxB] = await life(f, [{ ...as(f, ORCH, { method: "DELETE", path: `/api/self/kanten/${id}` }) },
      schreib(f, B, A, "1", "nach dem Schließen"), as(f, B, get("/api/self/messages?unread=1"))]);
    expect(zu?.status).toBe(200);
    expect(danach?.status).toBe(409);
    expect(texte(inboxB).some((t) => t.startsWith(`Deine Kante zu Slot ${A} ist seit `))).toBe(true);
  }, LIFE_DEADLINE_MS * 3);
});

describe("das Buch der Kanten", () => {
  const a = { slot: 2, cwd: "/r/a" }, b = { slot: 3, cwd: "/r/b" };
  test("ohne Angabe gilt eine Stunde; ein Slot in einem anderen Ordner ist nicht mehr das Ende", () => {
    const w = kantenWunsch({ between: [2, 3], why: "x" });
    expect(w.ok && w.minutes).toBe(60);
    const { book } = kanteGeben([], a, b, "x", 60, 1_000, "k1");
    expect(lebendeKante(book, b, a, 1_000 + 59 * 60_000)?.id).toBe("k1");
    expect(lebendeKante(book, a, b, 1_000 + 60 * 60_000)).toBeNull();
    expect(beendeteKante(book, a, b, 1_000 + 60 * 60_000)?.id).toBe("k1");
    expect(lebendeKante(book, { slot: 2, cwd: "/r/anders" }, b, 2_000)).toBeNull();
  });
  test("die Tür liest nur between, why und minutes", () => {
    expect(kantenWunsch({ between: [2, 3], why: "x", rights: ["land"] }).ok).toBe(false);
    expect(kantenWunsch({ between: [2, 2], why: "x" }).ok).toBe(false);
    expect(kantenWunsch({ between: [2, 3], why: "x", minutes: 0 }).ok).toBe(false);
  });
  test("neu freigeben ersetzt die lebende Kante des Paars, und ein Neustart behält das Buch", () => {
    const one = kanteGeben([], a, b, "x", 60, 1_000, "k1").book;
    const two = kanteGeben(one, b, a, "y", 30, 2_000, "k2").book;
    expect(lebendeKante(two, a, b, 3_000)?.id).toBe("k2");
    expect(kantenGeladen(JSON.parse(JSON.stringify(two)), 3_000).map((k) => k.id)).toEqual(["k1", "k2"]);
  });
});

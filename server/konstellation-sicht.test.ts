// EIN SITZ SIEHT DIE KONSTELLATION, IN DER ER STEHT, NICHT SICH SELBST (F6, ~/local-notes/fable-blick/f6-auftrag.md; Owner 29.10.: Agenten sollen „[Zitat entfernt]“): GET /api/self/constellation zeigt die Sitze, denen er schreiben darf — die Öffnerin, die Kinder, ihre Geschwister — und die Positionen seiner gespeicherten
// Konstellation, je mit Platz, Name, Ordner, Rolle, Zweck-Titel, Harness, Modell, Effort, Zustand und der Adresse, an die er schreibt. Nichts von seinen eigenen Steinen: kein Darf,
// keine Packs, kein Hash. Jede Probe geht mit der Self-Token einer Session durch einen Server in eigenem Prozess (server/branches-testkit.ts).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { importiereSetup, roleHash, schreibShelf, type SetupRole } from "./setup-datei";
import { setupAusSitzen, type SitzBild } from "./konstellation-aus-sitzen";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const slotRow = (f: Fixture, slot: number): Record<string, any> => (persisted(f).slots as Record<string, Record<string, any>>)[String(slot)]!;
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const SICHT = "/api/self/constellation", ROLES = "/api/self/roles", OPEN = "/api/self/seats/open";
const QUICK = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
type Sitz = { slot: number | null; position: string | null; name: string; relations: string[]; folder: { path: string | null; hint: string | null };
  role: { id: string; name: string } | null; purpose: string | null; harness: string | null; model: string | null; effort: string | null;
  state: "live" | "ended" | "not-started"; address: { kind: string; slot?: number; role?: string } | null; roleAddress?: { kind: string; role: string } };
const seats = (a: Answer | undefined): Sitz[] => (a?.body.seats as Sitz[] | undefined) ?? [];
const von = (a: Answer | undefined, slot: number): Sitz | undefined => seats(a).find((x) => x.slot === slot);
const PRUEFER = { name: "Prüfer", text: "Du prüfst, was gebaut wurde.", rights: ["text.pack"] };

/** Eine Leiterin (Slot 1) mit zwei Kindern: Bauer (Slot 2, ohne Rolle) und Prüfer (Slot 3, in der gebildeten Rolle). */
async function leiterin(f: Fixture, env: Record<string, string>) {
  await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
  const lead = tokenOf(f, 1);
  await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack"] })], env);
  const [rolle, baut, prueft] = await life(f, [as(lead, post(ROLES, PRUEFER)),
    as(lead, post(OPEN, { cwd: ordner(f, "bau"), goal: "Baue die Funktion.", label: "Bauer", purpose: "Du baust.", model: "claude-haiku-5-5" })),
    as(lead, post(OPEN, { cwd: ordner(f, "pruef"), goal: "Prüfe, was der Bauer baut.", label: "Prüfer", role: "prufer" }))], env);
  expect([rolle?.status, baut?.status, prueft?.status]).toEqual([201, 200, 200]);
  return { lead, bauer: Number(baut?.body.slot), pruefer: Number(prueft?.body.slot) };
}

describe("die Leiterin sieht ihre Kinder", () => {
  test("beide mit Platz, Name, Ordner, Rolle, Zweck-Titel, Harness, Modell, Effort und der Adresse, an die sie schreibt — die Rolle auch unter ihrer Adresse; nichts von ihren eigenen Steinen", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const { lead, bauer, pruefer } = await leiterin(f, env);
    const [sicht] = await life(f, [as(lead, get(SICHT))], env);
    expect(sicht?.status).toBe(200);
    expect(sicht?.body.me).toMatchObject({ slot: 1, role: null, reportsTo: null, position: null });
    expect(seats(sicht).map((x) => x.slot)).toEqual([bauer, pruefer]);
    const b = von(sicht, bauer)!, p = von(sicht, pruefer)!;
    expect(b).toMatchObject({ name: "Bauer", relations: ["child"], role: null, state: "live", address: { kind: "session", slot: bauer },
      harness: slotRow(f, bauer).harness, model: "claude-haiku-5-5", effort: slotRow(f, bauer).effort ?? null,
      folder: { path: join(wurzel(f), "bau"), hint: "bau" }, purpose: slotRow(f, bauer).agentMd.titel });
    expect(b.roleAddress).toBeUndefined();
    expect(p).toMatchObject({ name: "Prüfer", relations: ["child"], role: { id: "prufer", name: "Prüfer" }, state: "live", address: { kind: "session", slot: pruefer },
      roleAddress: { kind: "role", role: "prufer" }, folder: { path: join(wurzel(f), "pruef"), hint: "pruef" } });
    // DIE FALLE: nichts vom eigenen Start der Leiterin und nichts von den Rechten, Packs, Hashes oder Tokens der Sitze
    const roh = JSON.stringify(sicht?.body);
    for (const wort of ["rechte", "darf", "liest", "sha256", "setupHash", "selfToken", "bibliothek", "Du baust.", "Du prüfst, was gebaut wurde."]) expect(roh).not.toContain(wort);
    expect(Object.keys(sicht?.body ?? {}).sort()).toEqual(["me", "seats"]);
  }, LIFE_DEADLINE_MS * 8);
});

describe("ein Kind sieht seine Öffnerin und sein Geschwister", () => {
  test("der Prüfer liest die Leiterin und den Bauer mit ihren Adressen und weiß, wem er meldet; der Bauer sieht den Prüfer unter der Adresse der Rolle", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const { bauer, pruefer } = await leiterin(f, env);
    const [sicht, vomBauer] = await life(f, [as(tokenOf(f, pruefer), get(SICHT)), as(tokenOf(f, bauer), get(SICHT))], env);
    expect(sicht?.body.me).toMatchObject({ slot: pruefer, role: { id: "prufer", name: "Prüfer" }, reportsTo: { slot: 1, state: "live" } });
    expect(seats(sicht).map((x) => [x.slot, x.relations])).toEqual([[1, ["opener"]], [bauer, ["sibling"]]]);
    expect(von(sicht, 1)?.address).toEqual({ kind: "session", slot: 1 });
    expect(von(sicht, bauer)?.address).toEqual({ kind: "session", slot: bauer });
    expect(von(vomBauer, pruefer)?.roleAddress).toEqual({ kind: "role", role: "prufer" });
    expect(seats(sicht).some((x) => x.slot === pruefer)).toBe(false); // sich selbst listet er nicht
  }, LIFE_DEADLINE_MS * 8);
});

describe("ein Fremder sieht nichts", () => {
  test("ein Sitz außerhalb der Konstellation bekommt eine leere Liste, nicht die Daten der anderen", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    await leiterin(f, env);
    await life(f, [post("/api/slots/4/open", { cwd: f.repo })], env);
    const [sicht] = await life(f, [as(tokenOf(f, 4), get(SICHT))], env);
    expect(sicht?.status).toBe(200);
    expect(sicht?.body).toMatchObject({ me: { slot: 4, role: null, reportsTo: null }, seats: [] });
    // ohne Self-Token gibt es die Tür nicht
    const [ohne] = await life(f, [{ ...get(SICHT), token: null }], env);
    expect([401, 403]).toContain(ohne?.status);
  }, LIFE_DEADLINE_MS * 8);
});

describe("die Nachfolge ändert die Sicht nicht", () => {
  test("nach der Nachfolge des Kindes liest die Leiterin es weiter; nach ihrer eigenen liest die Nachfolgerin dieselben Kinder; ein beendetes Kind steht als beendet, ohne Adresse", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const { lead, bauer, pruefer } = await leiterin(f, env);
    const vorher = slotRow(f, bauer).openedAt;
    // die Nachfolge schreibt eine Übergabe: das Recht dazu vergibt der Owner je Sitz
    await life(f, [post(`/api/slots/${bauer}/rechte`, { grant: ["text.handover"] }), post("/api/slots/1/rechte", { grant: ["text.handover"] })], env);
    const [nachfolgeKind] = await life(f, [as(tokenOf(f, bauer), post("/api/self/succeed", {}))], { ...env, ...QUICK });
    // die Nachfolge steht, auch wenn der Ersatz-claude den Brief nicht annimmt und succeed als Schuld endet (wie in jeder Testpane)
    expect(nachfolgeKind?.status).toBeLessThan(600);
    expect(nachfolgeKind?.body.missingRight).toBeUndefined();
    expect(slotRow(f, bauer).openedAt).not.toBe(vorher);
    const [nachKind] = await life(f, [as(lead, get(SICHT))], env);
    expect(seats(nachKind).map((x) => [x.slot, x.state, x.name])).toEqual([[bauer, "live", "Bauer"], [pruefer, "live", "Prüfer"]]);
    expect(von(nachKind, bauer)?.address).toEqual({ kind: "session", slot: bauer });
    // …und die Geschwister sehen es auch weiter
    const [vomPruefer] = await life(f, [as(tokenOf(f, pruefer), get(SICHT))], env);
    expect(von(vomPruefer, bauer)?.state).toBe("live");

    const [nachfolgeLead] = await life(f, [as(lead, post("/api/self/succeed", {}))], { ...env, ...QUICK });
    expect(nachfolgeLead?.status).toBeLessThan(600);
    expect(nachfolgeLead?.body.missingRight).toBeUndefined();
    const [nachLead] = await life(f, [as(tokenOf(f, 1), get(SICHT))], env);
    expect(seats(nachLead).map((x) => [x.slot, x.state])).toEqual([[bauer, "live"], [pruefer, "live"]]);

    // ein Kind, das endet: es bleibt in der Sicht, als beendet und ohne Adresse
    await life(f, [post(`/api/slots/${bauer}/kill`, {})], env);
    const [nachKill] = await life(f, [as(tokenOf(f, 1), get(SICHT))], env);
    expect(von(nachKill, bauer)).toMatchObject({ name: "Bauer", state: "ended", address: null, relations: ["child"] });
    expect(von(nachKill, pruefer)?.state).toBe("live");
  }, LIFE_DEADLINE_MS * 14);
});

// DIE POSITIONEN DER GESPEICHERTEN KONSTELLATION: ein Sitz, der aus einer Position startete, sieht auch die anderen Positionen — gestartet oder noch nicht
describe("die Positionen der gespeicherten Konstellation", () => {
  test("die anderen Positionen stehen als nicht gestartet, mit Hinweis, Rolle und Zweck-Titel; startet die Leiterin eine, wird sie lebendig und ist ansprechbar", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const wurzelA = wurzel(f);
    const start = { titel: "Prüfer", text: "Du prüfst." };
    const rolle: SetupRole = { id: "prufer", name: "Prüfer", hash: roleHash({ id: "prufer", name: "Prüfer", start, rights: [], packs: [] }), start, rights: [], packs: [] };
    const A = join(wurzelA, "regal-a");
    mkdirSync(A, { recursive: true });
    schreibShelf(A, { version: 1, packs: [], concepts: [], roles: [rolle] });
    const bild = (o: Partial<SitzBild> & { slot: number; cwd: string }): SitzBild => ({ openedAt: 1000 + o.slot, label: null, harness: "claude", model: "claude-sonnet-5-5",
      effort: null, permissionMode: null, rechte: null, agentMd: null, bibliothek: [], rolleStein: null, openedBy: null, ...o });
    const lead = bild({ slot: 1, cwd: f.repo, label: "Leitung", agentMd: { titel: "Leitung.md", text: "Du leitest." } });
    const von1 = { slot: 1, openedAt: lead.openedAt, cwd: f.repo };
    const kinder = [bild({ slot: 2, cwd: join(wurzelA, "bau"), label: "Bauer", openedBy: von1 }),
      bild({ slot: 3, cwd: join(wurzelA, "pruef"), label: "Prüfer", openedBy: von1, rolleStein: { id: "prufer", name: "Prüfer", hash: rolle.hash } })];
    for (const k of kinder) mkdirSync(k.cwd, { recursive: true });
    const d = setupAusSitzen({ name: "Bau und Prüfung", oeffnerin: lead, kinder, root: wurzelA, dir: A, wissen: null, historie: [] });
    if (typeof d === "string") throw new Error(d);
    const imp = await importiereSetup(JSON.parse(JSON.stringify(d.datei)), { dir: f.state }, { schreiben: true });
    expect(imp.status).toBe(201);
    const konst = (imp.body.konstellation as { id: string }).id;
    const [leadId, bauerId, prueferId] = d.datei.seats.map((s) => s.id);

    const [offen] = await life(f, [post("/api/slots/1/open", { sitz: `${konst}/${leadId}`, cwd: f.repo })], env);
    expect(offen?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const [vorher] = await life(f, [as(tokenOf(f, 1), get(SICHT))], env);
    expect(vorher?.body.me).toMatchObject({ slot: 1, position: { konst, pos: leadId, name: "Leitung" } });
    expect(seats(vorher).map((x) => [x.position, x.name, x.state, x.slot, x.address, x.relations])).toEqual([
      [bauerId, "Bauer", "not-started", null, null, ["position"]], [prueferId, "Prüfer", "not-started", null, null, ["position"]]]);
    expect(seats(vorher)[1]).toMatchObject({ role: { id: "prufer", name: "Prüfer" }, folder: { path: null, hint: "pruef" }, purpose: null, harness: "claude" });

    const [startet] = await life(f, [as(tokenOf(f, 1), post(OPEN, { sitz: prueferId, cwd: ordner(f, "pruef") }))], env);
    expect(startet?.status).toBe(200);
    const kind = Number(startet?.body.slot);
    const [nachher, vomKind] = await life(f, [as(tokenOf(f, 1), get(SICHT)), as(tokenOf(f, kind), get(SICHT))], env);
    const lebendig = seats(nachher).find((x) => x.position === prueferId)!;
    expect(lebendig).toMatchObject({ slot: kind, state: "live", address: { kind: "session", slot: kind }, relations: ["child", "position"] });
    // das Kind sieht seine Öffnerin, die zugleich die Position über ihm ist, und die noch nicht gestartete Geschwister-Position
    expect(vomKind?.body.me).toMatchObject({ slot: kind, position: { pos: prueferId }, reportsTo: { slot: 1, state: "live" } });
    expect(seats(vomKind).map((x) => [x.slot ?? x.position, x.state, x.relations])).toEqual([[1, "live", ["opener", "position"]], [bauerId, "not-started", ["position"]]]);
  }, LIFE_DEADLINE_MS * 14);
});

// WAS REIST, STARTET, WO ES LANDET — die Türen (F1 Runde 2): die Konstellation, die Sitze auf Fleet A bauten, wird auf Fleet B importiert; dort startet eine Position
// mit dem Ziel der Datei und in dem Ordner, den die Person für den leeren Platz wählt — an der Slot-Tür des Owners, an der Ordner-Tür des Sitzes und, mit ihrem Branch,
// an der Branch-Tür. Der Text der ersten Nachricht steht in position-start.test.ts (die Pane des Tests liest nichts); hier: die Antworten der Türen, die Fassung und
// GET /api/self des gestarteten Sitzes.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { hashText, importiereSetup, pruefeSetupDatei, schreibShelf, type SetupDatei } from "./setup-datei";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const OPEN = "/api/self/seats/open", ROLES = "/api/self/roles", SAVE = "/api/self/konstellationen";
const REGELN = "# Bau-Regeln\n\nPrüfe zuerst die Tests.";
const aufgabeVon = (a: Answer | undefined): { quelle: string | null; text: string | null } | undefined =>
  ((a?.body.teile as { id: string; abschnitte: { quelle: string | null; text: string | null }[] }[] | undefined) ?? []).find((t) => t.id === "aufgabe")?.abschnitte[0];

/** Fleet A: ein Sitz bildet die Rolle „Prüfer“, öffnet Bauer und Prüfer mit je einem Ziel und speichert; die Datei, die sie exportiert, ist, was B bekommt. */
async function dateiVonA(): Promise<SetupDatei> {
  const f = fixture();
  const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
  const bau = ordner(f, "bau"), pruef = ordner(f, "pruef");
  schreibShelf(f.state, { version: 1, concepts: [], packs: [{ kind: "pack", id: "bau-regeln", hash: hashText(REGELN), text: REGELN, useWhen: "Read this when you check a build.", sources: [] }] });
  await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { stufe: "landen", an: [], aus: [], buendel: "none" }, bibliothek: [] })], env);
  const self = tokenOf(f, 1);
  await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack", "setup.save", "setup.export"] })], env);
  const [rolle, baut, prueft] = await life(f, [
    as(self, post(ROLES, { name: "Prüfer", text: "Du prüfst, was gebaut wurde.", rights: ["text.pack"], packs: ["bau-regeln"] })),
    as(self, post(OPEN, { cwd: bau, goal: "Baue die Funktion.", label: "Bauer", bibliothek: [], rechte: { buendel: "none" } })),
    as(self, post(OPEN, { cwd: pruef, goal: "Prüfe, was der Bauer baut.", label: "Prüfer", role: "prufer", bibliothek: [], rechte: { buendel: "none" } }))], env);
  expect([rolle?.status, baut?.status, prueft?.status]).toEqual([201, 200, 200]);
  const [gespeichert] = await life(f, [as(self, post(SAVE, { name: "Bau und Prüfung" }))], env);
  const id = (gespeichert?.body.konstellation as { id: string }).id;
  const [datei] = await life(f, [as(self, get(`/api/self/setups/${id}/datei`))], env);
  const d = pruefeSetupDatei(JSON.parse(JSON.stringify((datei?.body as { datei: SetupDatei }).datei)));
  if (typeof d === "string") throw new Error(d);
  return d;
}

describe("eine Position startet mit dem Ziel der Datei und in ihrem Ordner", () => {
  test("auf Fleet B: ohne cwd fragt die Slot-Tür nach dem Ordner, mit ihm startet der Sitz; er öffnet den Prüfer mit dem Ziel der Datei, Fassung und GET /api/self nennen beide", async () => {
    const datei = await dateiVonA();
    const [lead, bauer, pruefer] = datei.seats;
    const b = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(b) };
    const imp = await importiereSetup(JSON.parse(JSON.stringify(datei)), { dir: b.state }, { schreiben: true });
    expect(imp.status).toBe(201);
    const konst = (imp.body.konstellation as { id: string }).id;
    // der Leiter sitzt im Repo der Fixture (die Branch-Tür öffnet Branches des eigenen Repos); „pruef“ liegt daneben
    const leadB = b.repo, pruefB = ordner(b, "pruef");

    // SLOT-TÜR DES OWNERS: der leere Platz verlangt ein cwd und nennt den Hinweis des Absenders
    const [ohne, mit] = await life(b, [post("/api/slots/1/open", { sitz: `${konst}/${lead!.id}` }), post("/api/slots/1/open", { sitz: `${konst}/${lead!.id}`, cwd: leadB })], env);
    expect(ohne?.status).toBe(400);
    expect(String(ohne?.body.error)).toBe(`folder for seat "${lead!.id}": a folder, the sender used "${lead!.start.folder!.hint}"`);
    expect(mit?.status).toBe(200);
    expect(mit?.body.cwd).toBe(leadB);
    await life(b, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const leadTok = tokenOf(b, 1);

    // ORDNER-TÜR DES SITZES: der Bauer ohne cwd, und sein Ordner „bau“ gibt es hier nicht → die Tür fragt; der Prüfer ohne cwd: „pruef“ liegt neben dem Ordner des Leiters
    const [bauerOhne, prueferVorschlag] = await life(b, [
      as(leadTok, post(OPEN, { sitz: bauer!.id })), as(leadTok, post(OPEN, { sitz: pruefer!.id }))], env);
    expect(bauerOhne?.status).toBe(400);
    expect(String(bauerOhne?.body.error)).toBe(`folder for seat "${bauer!.id}": a folder under your seat root, the sender used "bau"`);
    expect(prueferVorschlag?.status).toBe(200);
    expect(prueferVorschlag?.body.cwd).toBe(pruefB);
    expect(prueferVorschlag?.body.goal).toBe("follows");
    expect(prueferVorschlag?.body.goalFromFile).toBe("used");
    const slot = Number(prueferVorschlag?.body.slot);

    // DER BRIEF: die Fassung nennt das Ziel „zuerst gesagt, aus der Datei“, GET /api/self das Ziel und den gefüllten Platz mit dem Hinweis
    const [fassung, selbst] = await life(b, [get(`/api/slots/${slot}/fassung?anlass=laufend`), as(tokenOf(b, slot), get("/api/self"))], env);
    expect(aufgabeVon(fassung)?.text).toBe("Prüfe, was der Bauer baut.");
    expect(aufgabeVon(fassung)?.quelle).toContain("told first (from the file)");
    expect(aufgabeVon(fassung)?.quelle).toContain("Bau und Prüfung");
    expect(selbst?.body.sitz).toEqual({ konst, pos: pruefer!.id, name: "Bau und Prüfung",
      goal: { text: "Prüfe, was der Bauer baut.", from: "file", replaced: false }, folder: { filled: pruefB, hint: "pruef" } });
    // BRANCH-TÜR: der Ort ist der Worktree des Branches (er füllt den Platz von selbst), das Ziel der Datei gilt auch hier
    const [zweig] = await life(b, [as(leadTok, post("/api/self/branches", { name: "Zweig des Prüfers" }))], env);
    expect(zweig?.status).toBe(201);
    const [amZweig] = await life(b, [as(leadTok, post("/api/self/branches/open", { branch: String(zweig?.body.branch), sitz: pruefer!.id }))], env);
    expect([amZweig?.status, amZweig?.body.goal, amZweig?.body.goalFromFile]).toEqual([200, "follows", "used"]);
    // …und er bleibt so über einen Neustart des Servers
    const [nachNeustart] = await life(b, [as(tokenOf(b, slot), get("/api/self"))], env);
    expect((nachNeustart?.body.sitz as { goal: { text: string } }).goal.text).toBe("Prüfe, was der Bauer baut.");
  }, LIFE_DEADLINE_MS * 20);

  test("ein goal an der Tür gilt vor dem der Datei, und die Antwort sagt, dass das der Datei ersetzt wurde; die Fassung nennt es", async () => {
    const datei = await dateiVonA();
    const [lead, , pruefer] = datei.seats;
    const b = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(b) };
    const imp = await importiereSetup(JSON.parse(JSON.stringify(datei)), { dir: b.state }, { schreiben: true });
    const konst = (imp.body.konstellation as { id: string }).id;
    const [mit] = await life(b, [post("/api/slots/1/open", { sitz: `${konst}/${lead!.id}`, cwd: ordner(b, "lead") })], env);
    expect(mit?.status).toBe(200);
    await life(b, [post("/api/slots/1/rechte", { grant: ["seat.open"] })], env);
    const leadTok = tokenOf(b, 1);
    const [ersetzt] = await life(b, [as(leadTok, post(OPEN, { sitz: pruefer!.id, cwd: ordner(b, "pruef"), goal: "Prüfe nur die Tests." }))], env);
    expect(ersetzt?.status).toBe(200);
    expect([ersetzt?.body.goal, ersetzt?.body.goalFromFile]).toEqual(["follows", "replaced"]);
    const [fassung, selbst] = await life(b, [get(`/api/slots/${Number(ersetzt?.body.slot)}/fassung?anlass=laufend`), as(tokenOf(b, Number(ersetzt?.body.slot)), get("/api/self"))], env);
    expect(aufgabeVon(fassung)?.quelle).toContain("replaced by the goal given at the door");
    expect((selbst?.body.sitz as { goal: { replaced: boolean } }).goal.replaced).toBe(true);
  }, LIFE_DEADLINE_MS * 12);
});

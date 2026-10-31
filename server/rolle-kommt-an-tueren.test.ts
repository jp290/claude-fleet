// EINE ROLLE, DIE MITREIST, KOMMT DORT ZU LEBEN, WO SIE LANDET (F2) — die ganze Geschichte an zwei Zustandsverzeichnissen, A und B, jedes mit
// seinem Server: auf A bildet ein Sitz eine Rolle, die ein Pack der Bibliothek liest, und exportiert sie; auf B nimmt der Owner die Datei an, die
// Selbst-Tür öffnet die Rolle erst nach seiner Freigabe, ein Sitz mit seat.open öffnet einen Prüfer in ihr, und die Adresse der Rolle erreicht ihn.
// Die Schicht ohne Server steht in server/rolle-kommt-an.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { liesShelf } from "./setup-datei";

const { BIN, fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const slotRow = (f: Fixture, slot: number): Record<string, any> => (persisted(f).slots as Record<string, Record<string, any>>)[String(slot)]!;
const teil = (a: Answer | undefined, teilId: string, abschnittId: string): string | null =>
  ((a?.body.teile as { id: string; abschnitte: { id: string; text: string | null }[] }[] | undefined) ?? [])
    .find((t) => t.id === teilId)?.abschnitte.find((x) => x.id === abschnittId)?.text ?? null;
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const ROLES = "/api/self/roles", OPEN = "/api/self/seats/open";
const PRUEFER = { name: "Prüfer", text: "Du prüfst, was gebaut wurde, unabhängig von seinem Bauer. Du baust nichts um.", rights: ["text.pack"],
  packs: ["building-an-agent"] };

/** Ein Ersatz-pi, der als „pi“ gelesen wird (siehe server/selbst-einrichten-tuer.test.ts); je Kit einmal. */
function piErsatz(): void {
  if (existsSync(join(BIN, "pi"))) return;
  symlinkSync("/bin/bash", join(BIN, "pi-bash"));
  writeFileSync(join(BIN, "pi"), `#!${join(BIN, "pi-bash")}\nwhile :; do sleep 1; done\n`, { mode: 0o755 });
}

/** Auf A bildet Slot 1 die Rolle und exportiert sie; die Datei geht als JSON über die Grenze, wie sie auf der Platte läge. */
async function dateiVonA(): Promise<unknown> {
  const a = fixture();
  const env = { FLEET_SELF_SEAT_ROOT: wurzel(a) };
  const [opened] = await life(a, [post("/api/slots/1/open", { cwd: a.repo, rechte: { buendel: "none" } })], env);
  expect(opened?.status).toBe(200);
  await life(a, [post("/api/slots/1/rechte", { grant: ["role.form", "setup.export", "text.pack"] })], env);
  const self = tokenOf(a, 1);
  const [gebildet, datei] = await life(a, [as(self, post(ROLES, PRUEFER)), as(self, get(`${ROLES}/prufer/datei`))], env);
  expect([gebildet?.status, datei?.status]).toEqual([201, 200]);
  return JSON.parse(JSON.stringify(datei?.body));
}

describe("die Rolle kommt beim Empfänger an", () => {
  test("die ganze Geschichte: Datei von A, Import auf B, Regal, Selbst-Tür zu, Freigabe des Owners, Prüf-Sitz in der Rolle, Nachricht an die Adresse", async () => {
    const datei = await dateiVonA();
    const b = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(b) };
    const bau = ordner(b, "bau"), pruef = ordner(b, "pruef");

    // B: der Owner nimmt die Datei an; die Bibliothek von B hat den Pack schon (source local), die Rolle bleibt trotzdem auf dem Regal
    const [vorschau, importiert] = await life(b, [post("/api/setups/import", { datei }), post("/api/setups/import", { datei, schreiben: true })], env);
    expect([vorschau?.status, importiert?.status]).toEqual([200, 201]);
    expect((importiert?.body.vorschau as { packs: { id: string; source: string }[] }).packs).toEqual([expect.objectContaining({ id: "building-an-agent", source: "local" })]);
    expect(liesShelf(b.state).roles?.map((r) => r.id)).toEqual(["prufer"]);
    const konst = String((importiert?.body.konstellation as { id: string }).id);

    // ein Sitz auf B mit seat.open (und dem Recht, das die Rolle gibt) öffnet die Rolle noch nicht: ihre Rechte warten auf den Owner
    const [opened] = await life(b, [post("/api/slots/1/open", { cwd: b.repo, rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    await life(b, [post("/api/slots/1/rechte", { grant: ["seat.open", "text.pack"] })], env);
    const self = tokenOf(b, 1);
    const [zu, gerufen] = await life(b, [as(self, post(OPEN, { cwd: pruef, role: "prufer", goal: "Prüfe, was der Bauer baut.", label: "Prüfer" })),
      as(self, post("/api/self/messages", { to: { kind: "role", role: "prufer" }, payload: { kind: "text", text: "x" }, idempotencyKey: "v0" }))], env);
    expect(zu?.status).toBe(409);
    expect(String(zu?.body.error)).toContain("its rights wait for the owner's confirmation");
    expect(gerufen?.status).toBe(409);

    // der Owner bestätigt die Rechte der Rolle einmal; danach öffnet dieselbe Tür den Prüfer, mit dem Bundel als Zusage
    const [frei] = await life(b, [post("/api/k15/freigabe", { konst, pos: "prufer" })], env);
    expect(frei?.status).toBe(200);
    const [baut, prueft] = await life(b, [as(self, post(OPEN, { cwd: bau, goal: "Baue die Funktion.", label: "Bauer" })),
      as(self, post(OPEN, { cwd: pruef, role: "prufer", goal: "Prüfe, was der Bauer baut.", label: "Prüfer" }))], env);
    expect([baut?.status, prueft?.status]).toEqual([200, 200]);
    const bauer = Number(baut?.body.slot), pruefer = Number(prueft?.body.slot);
    expect(prueft?.body.rolle).toEqual({ id: "prufer", name: "Prüfer", address: { kind: "role", role: "prufer" } });
    expect([slotRow(b, pruefer).rolleStein?.id, slotRow(b, pruefer).rechte?.recht]).toEqual(["prufer", ["text.pack"]]);
    expect(slotRow(b, pruefer).rolleStein.von).toContain("confirmed by the owner");
    const [fassung] = await life(b, [get(`/api/slots/${pruefer}/fassung?anlass=laufend`)], env);
    expect(teil(fassung, "liest", "rolle")).toContain("FLEET ROLE (prufer, author: an imported setup, confirmed by the owner) — Prüfer");

    // die Post: der Bauer schreibt an die Adresse der Rolle, und der Prüfer liest es in seinem Postfach
    const bauerTok = tokenOf(b, bauer), prueferTok = tokenOf(b, pruefer);
    const [post1] = await life(b, [as(bauerTok, post("/api/self/messages", { to: { kind: "role", role: "prufer" },
      payload: { kind: "text", text: "Bitte prüfen." }, idempotencyKey: "m1" }))], env);
    expect(post1?.status).toBe(200);
    expect(post1?.body.holder).toEqual({ slot: pruefer, openedAt: Number(prueft?.body.openedAt) });
    const [box] = await life(b, [as(prueferTok, get("/api/self/messages"))], env);
    expect(((box?.body.entries as { payload: { text: string } }[]) ?? []).map((e) => e.payload.text)).toEqual(["Bitte prüfen."]);
  }, LIFE_DEADLINE_MS * 14);

  test("ein Sitz aus der importierten Position (Owner-Tür und Branch-Tür) und ein Sitz mit `role` an der Owner-Tür tragen die Rolle, sobald der Owner sie bestätigt hat", async () => {
    const datei = await dateiVonA();
    const b = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(b) };
    const [importiert] = await life(b, [post("/api/setups/import", { datei, schreiben: true })], env);
    expect(importiert?.status).toBe(201);
    const konst = String((importiert?.body.konstellation as { id: string }).id), sitz = `${konst}/prufer`;
    // vor der Freigabe startet die Position, wie sie heute startet: ohne Rollenstein; `role` an der Owner-Tür ist abgewiesen
    const [roh, abgewiesen] = await life(b, [post("/api/slots/1/open", { cwd: ordner(b, "roh"), sitz }),
      post("/api/slots/2/open", { cwd: ordner(b, "zu"), role: "prufer" })], env);
    expect([roh?.status, abgewiesen?.status]).toEqual([200, 409]);
    expect(slotRow(b, 1).rolleStein ?? null).toBeNull();

    const [frei] = await life(b, [post("/api/k15/freigabe", { konst, pos: "prufer" })], env);
    expect(frei?.status).toBe(200);
    const [position, rolle, zweig] = await life(b, [post("/api/slots/3/open", { cwd: ordner(b, "pos"), sitz }),
      post("/api/slots/4/open", { cwd: ordner(b, "rol"), role: "prufer" }), post("/api/branches", { repo: b.repo, name: "Prüfen" })], env);
    expect([position?.status, rolle?.status, zweig?.status]).toEqual([200, 200, 201]);
    const [branch] = await life(b, [post("/api/branches/open", { repo: b.repo, branch: String(zweig?.body.branch ?? "branch/prufen"), sitz })], env);
    expect(branch?.status).toBe(200);
    const bs = Number(branch?.body.slot);
    // alle drei tragen die Rolle: Stein am Slot, das Bundel als Zusage, der Starttext in der Fassung
    for (const slot of [3, 4, bs]) {
      expect([slot, slotRow(b, slot).rolleStein?.id, slotRow(b, slot).rechte?.recht]).toEqual([slot, "prufer", ["text.pack"]]);
    }
    // die Vorschau des Startfensters (anlass=neu) rechnet die Rolle der Position mit: ihre Rolle steht in der Fassung, wie im Start des Sitzes
    const [vorschauNeu] = await life(b, [get(`/api/founding-plan?repo=${encodeURIComponent(b.repo)}&role=nur-ordner&anlass=neu&sitz=${encodeURIComponent(sitz)}`)], env);
    expect([vorschauNeu?.status, vorschauNeu?.body.error]).toEqual([200, undefined]);
    expect(teil({ status: 200, body: vorschauNeu?.body.fassung as Record<string, unknown> }, "liest", "rolle")).toContain("FLEET ROLE (prufer, author: an imported setup, confirmed by the owner) — Prüfer");
    const [fassung, vier, branchBox] = await life(b, [get("/api/slots/3/fassung?anlass=laufend"), as(tokenOf(b, 4), get("/api/self/messages")),
      as(tokenOf(b, bs), get("/api/self/messages"))], env);
    expect(teil(fassung, "liest", "rolle")).toContain("FLEET ROLE (prufer, author: an imported setup, confirmed by the owner) — Prüfer");
    // der Starttext der Rolle steht EINMAL im Start der Position: im Rollenstein, nicht noch einmal als Purpose des Profils; vor der Freigabe stand er nur als Purpose
    const vorkommen = (a: Answer | undefined): number => ((a?.body.teile as { abschnitte: { text: string | null }[] }[]) ?? [])
      .flatMap((t) => t.abschnitte).filter((x) => (x.text ?? "").includes("Du prüfst, was gebaut wurde")).length;
    const [rohFassung] = await life(b, [get("/api/slots/1/fassung?anlass=laufend")], env);
    expect([vorkommen(rohFassung), vorkommen(fassung), teil(fassung, "liest", "eigenes") ?? ""]).toEqual([1, 1, expect.not.stringContaining("Du prüfst, was gebaut wurde")]);
    // drei Inhaber, eine Adresse: sie gehört dem jüngsten lebenden (der Branch-Sitz), die anderen hören sie nicht
    const arten = (a: Answer | undefined): string[] => (a?.body.addresses as { kind: string }[]).map((x) => x.kind);
    expect([arten(vier), arten(branchBox)]).toEqual([["session"], ["session", "role"]]);
  }, LIFE_DEADLINE_MS * 12);
});

describe("die Rolle bleibt bei der Nachfolge, auf jedem Harness", () => {
  test("ein pi-Sitz in einer gebildeten Rolle übergibt: die Nachfolgerin trägt die Rolle noch, und ihr Brief nennt den Starttext der Rolle", async () => {
    const f = fixture();
    // der Ersatz-pi wird auf beiden Plattformen als „pi“ gelesen (siehe server/selbst-einrichten-tuer.test.ts)
    piErsatz();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
    const pruef = ordner(f, "pi-pruef");
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, harness: "pi", rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack"] })], env);
    const self = tokenOf(f, 1);
    const [gebildet, kind] = await life(f, [as(self, post(ROLES, { ...PRUEFER, packs: [] })),
      as(self, post(OPEN, { cwd: pruef, role: "prufer", label: "Prüfer" }))], env);
    expect([gebildet?.status, kind?.status]).toEqual([201, 200]);
    const slot = Number(kind?.body.slot);
    expect(slotRow(f, slot).rolleStein?.id).toBe("prufer");
    await life(f, [post(`/api/slots/${slot}/rechte`, { grant: ["text.handover"] })], env);
    const [nachfolge, hist, fassung] = await life(f, [as(tokenOf(f, slot), post("/api/self/succeed", {})), get(`/api/slots/${slot}/history`),
      get(`/api/slots/${slot}/fassung?anlass=laufend`)], env);
    expect([nachfolge?.status, nachfolge?.body.error]).toEqual([expect.any(Number), undefined]);
    expect(nachfolge?.status).toBeLessThan(300);
    const brief = (hist?.body.history as { text: string }[] | undefined)?.at(-1)?.text ?? "";
    expect(brief).toContain("YOUR ROLE");
    expect(brief).toContain("FLEET ROLE (prufer, author: the session in slot 1) — Prüfer");
    expect(brief).toContain("Du prüfst, was gebaut wurde");
    // …und die Rolle steht noch am Platz: die Fassung der Nachfolgerin trägt sie
    expect(teil(fassung, "liest", "rolle")).toContain("FLEET ROLE (prufer, author: the session in slot 1) — Prüfer");
  }, LIFE_DEADLINE_MS * 8);

  test("eine Session auf einem Board-Branch übergibt: ihr Branch bleibt am Platz der Nachfolgerin", async () => {
    const f = fixture();
    piErsatz();
    const env = { FLEET_FOUNDING_BOOT_GRACE_MS: "250", FLEET_READY_WAIT_MS: "500" };
    const [made, opened] = await life(f, [post("/api/branches", { repo: f.repo, name: "Nachfolge Pi" }),
      post("/api/branches/open", { repo: f.repo, branch: "branch/nachfolge-pi", harness: "pi" }), "save"], env);
    expect([made?.status, opened?.status]).toEqual([201, 200]);
    const branch = String(made?.body.branch), slot = Number(opened?.body.slot);
    const [nachfolge] = await life(f, [as(tokenOf(f, slot), post("/api/self/succeed", {})), "save"], env);
    expect([nachfolge?.status, nachfolge?.body.error]).toEqual([expect.any(Number), undefined]);
    expect(slotRow(f, slot).boardBranch).toEqual({ repo: f.repo, branch });
  }, LIFE_DEADLINE_MS * 6);
});

describe("F4 · ein unveränderter Rundlauf behält seinen Hash", () => {
  test("Rolle: Datei von A, Import auf B, Export von B ist dieselbe Datei (setupHash gleich, derivedFrom null)", async () => {
    const datei = await dateiVonA() as { setupHash: string; seats: unknown[] };
    const b = fixture();
    const [importiert] = await life(b, [post("/api/setups/import", { datei, schreiben: true })]);
    expect(importiert?.status).toBe(201);
    const konst = String((importiert?.body.konstellation as { id: string }).id);
    const [wieder] = await life(b, [get(`/api/setups/${konst}/datei`)]);
    expect(wieder?.status).toBe(200);
    const d2 = (wieder?.body.datei ?? wieder?.body) as { setupHash: string; derivedFrom: string | null; seats: unknown[] };
    const unterschied = (x: unknown, y: unknown, pfad = ""): string[] => {
      if (JSON.stringify(x) === JSON.stringify(y)) return [];
      if (x && y && typeof x === "object" && typeof y === "object") {
        return [...new Set([...Object.keys(x), ...Object.keys(y)])].flatMap((k) => unterschied((x as Record<string, unknown>)[k], (y as Record<string, unknown>)[k], `${pfad}.${k}`));
      }
      return [`${pfad}: ${JSON.stringify(x)} ≠ ${JSON.stringify(y)}`];
    };
    expect(unterschied(datei.seats, d2.seats, "seats")).toEqual([]);
    expect([d2.setupHash, d2.derivedFrom]).toEqual([datei.setupHash, null]);
  }, LIFE_DEADLINE_MS * 4);
});


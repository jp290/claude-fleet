// DIE TÜR DER KONSTELLATION AUS SITZEN (POST /api/self/konstellationen, Recht setup.save; docs/konstellation/aus-sitzen-entwurf.md): ohne das Recht 409 mit
// missingRight, mit ihm speichert sie die Öffnerin und ihre lebenden Kinder; die Probe am Ende geht die ganze Geschichte — Rolle bilden, Bauer und Prüfer
// mit je einem Ziel öffnen, speichern, als eine Datei exportieren, in ein zweites leeres Zustandsverzeichnis importieren: dieselbe Vorschau, derselbe Hash.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";
import { hashText, importiereSetup, liesShelf, pruefeSetupDatei, schreibShelf, setupRoute, type SetupDatei, type SetupServer } from "./setup-datei";
import { dateiFuer } from "./sitz-reise";

const { fixture, life, cleanup } = branchTestkit();
const frisch: string[] = [];
afterAll(() => { cleanup(); for (const o of frisch) rmSync(o, { recursive: true, force: true }); });

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const missing = (a: Answer | undefined, id: string): void => {
  expect({ status: a?.status, missing: a?.body.missingRight, door: typeof a?.body.door }).toEqual({ status: 409, missing: id, door: "string" });
};
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const SAVE = "/api/self/konstellationen", ROLES = "/api/self/roles", OPEN = "/api/self/seats/open";
const REGELN = "# Bau-Regeln\n\nPrüfe zuerst die Tests.";

describe("die Tür nennt ihr Recht", () => {
  test("ohne setup.save 409 mit missingRight; mit ihm, aber ohne lebendes Kind, 409 mit dem Weg zum Öffnen; fremde Felder und ein leerer Name 400", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })]);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    const [ohne] = await life(f, [as(self, post(SAVE, { name: "X" }))]);
    missing(ohne, "setup.save");
    await life(f, [post("/api/slots/1/rechte", { grant: ["setup.save"] })]);
    const [keinKind, fremd, leer] = await life(f, [as(self, post(SAVE, { name: "X" })), as(self, post(SAVE, { name: "X", seats: [2] })), as(self, post(SAVE, { name: "  " }))]);
    expect(keinKind?.status).toBe(409);
    expect(String(keinKind?.body.error)).toContain("POST /api/self/seats/open");
    expect([fremd?.status, leer?.status]).toEqual([400, 400]);
  }, LIFE_DEADLINE_MS * 4);
});

describe("die ganze Geschichte", () => {
  test("Rolle bilden, Bauer und Prüfer mit je einem Ziel öffnen, speichern, exportieren; in ein zweites leeres Verzeichnis importiert: dieselbe Vorschau, derselbe Hash", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const bau = ordner(f, "bau"), pruef = ordner(f, "pruef");
    // ein Pack auf dem Regal, den die Rolle liest
    schreibShelf(f.state, { version: 1, concepts: [], packs: [{ kind: "pack", id: "bau-regeln", hash: hashText(REGELN), text: REGELN, useWhen: "Read this when you check a build.", sources: [] }] });
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { stufe: "landen", an: [], aus: [], buendel: "none" }, bibliothek: [] })], env);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack", "setup.save", "setup.export"] })], env);
    const [rolle, baut, prueft] = await life(f, [
      as(self, post(ROLES, { name: "Prüfer", text: "Du prüfst, was gebaut wurde, unabhängig von seinem Bauer.", rights: ["text.pack"], packs: ["bau-regeln"] })),
      as(self, post(OPEN, { cwd: bau, goal: "Baue die Funktion.", label: "Bauer", bibliothek: [], rechte: { stufe: "landen", an: [], aus: [], buendel: "none" } })),
      as(self, post(OPEN, { cwd: pruef, goal: "Prüfe, was der Bauer baut.", label: "Prüfer", role: "prufer", bibliothek: [] }))], env);
    expect([rolle?.status, baut?.status, prueft?.status]).toEqual([201, 200, 200]);

    // SPEICHERN
    const [gespeichert] = await life(f, [as(self, post(SAVE, { name: "Bau und Prüfung" }))], env);
    expect(gespeichert?.status).toBe(201);
    const id = (gespeichert?.body.konstellation as { id: string }).id;
    expect(gespeichert?.body.konstellation).toMatchObject({ name: "Bau und Prüfung", seats: 3 });
    expect(gespeichert?.body.datei).toBe(`GET /api/self/setups/${id}/datei`);

    // EXPORT: die eine Datei
    const [export_] = await life(f, [as(self, get(`/api/self/setups/${id}/datei`))], env);
    expect(export_?.status).toBe(200);
    const roh = (export_?.body as { datei: SetupDatei }).datei;
    const datei = pruefeSetupDatei(JSON.parse(JSON.stringify(roh)));
    if (typeof datei === "string") throw new Error(datei);
    expect(datei.seats.slice(1).map((s) => s.name)).toEqual(["Bauer", "Prüfer"]);
    expect(datei.roles.map((r) => [r.id, r.start.text, r.rights])).toEqual([["prufer", "Du prüfst, was gebaut wurde, unabhängig von seinem Bauer.", ["text.pack"]]]);
    expect(datei.packs.map((p) => [p.id, p.text])).toEqual([["bau-regeln", REGELN]]);
    const [lead, bauer, pruefer] = datei.seats;
    expect(datei.edges).toEqual([{ from: bauer!.id, to: lead!.id, kind: "reports-to" }, { from: pruefer!.id, to: lead!.id, kind: "reports-to" }]);
    expect([bauer!.start.goal, pruefer!.start.goal]).toEqual(["Baue die Funktion.", "Prüfe, was der Bauer baut."]);
    expect([bauer!.start.folder, pruefer!.start.folder]).toEqual([{ text: null, personal: true, hint: "bau" }, { text: null, personal: true, hint: "pruef" }]);
    expect(pruefer!.start.role).toBe("prufer");
    expect(bauer!.may.rechte).toMatchObject({ stufe: "bauen" }); // landen war über dem Deckel
    expect(JSON.stringify(datei)).not.toContain(wurzel(f));

    // IMPORT in ein zweites leeres Zustandsverzeichnis: dieselbe Vorschau, Rolle und Konstellation liegen danach dort
    const zwei = mkdtempSync(join(tmpdir(), "konst-zwei-"));
    frisch.push(zwei);
    const vorschau = await importiereSetup(JSON.parse(JSON.stringify(roh)), { dir: zwei });
    expect(vorschau.status).toBe(200);
    const v = vorschau.body.vorschau as Record<string, any>;
    expect(v.seatList.map((s: any) => [s.name, s.role, s.goal])).toEqual([[lead!.name, null, null], ["Bauer", null, "Baue die Funktion."], ["Prüfer", "prufer", "Prüfe, was der Bauer baut."]]);
    expect(v.requestedRoles).toEqual([{ id: "prufer", name: "Prüfer", rights: ["text.pack"] }]);
    expect(v.edges).toEqual(datei.edges);
    expect(v.emptyPlaces).toEqual(expect.arrayContaining(datei.seats.map((s) => `folder:${s.id}`)));
    expect((await importiereSetup(JSON.parse(JSON.stringify(roh)), { dir: zwei }, { schreiben: true })).status).toBe(201);
    expect(liesShelf(zwei).roles?.map((r) => r.id)).toEqual(["prufer"]);
    // …und was dort liegt, exportiert denselben Körper: derselbe Hash
    const speicher = JSON.parse(readFileSync(join(zwei, SPEICHER_DATEI), "utf8")).konstellationen as Record<string, unknown>[];
    expect(speicher).toHaveLength(1);
    const q: SetupServer = { dir: zwei, agenten: async () => [], konstellation: async () => speicher[0]!,
      konstellationDatei: () => dateiFuer(speicher[0]!, { laeufe: [], modus: String(lead!.may.permissionMode ?? "auto"), eigenesSetup: true,
        bibliothek: async () => { throw new Error("keine Bibliothek"); }, notizbuch: async () => null }) };
    const zweiter = await setupRoute(new Request("http://x/api/setups/x/datei"), new URL("http://x/api/setups/x/datei"), q);
    expect(zweiter.status).toBe(200);
    const zweitDatei = ((await zweiter.json()) as { datei: SetupDatei }).datei;
    expect(zweitDatei.setupHash).toBe(roh.setupHash);
  }, LIFE_DEADLINE_MS * 12);
});

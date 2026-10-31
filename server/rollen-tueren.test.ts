// EINE SESSION BILDET EINE ROLLE (POST /api/self/roles, Recht role.form; Richtung Schritt 5, Owner 30.10.): ein Name, eine Adresse
// {kind:"role"}, ein Bundel von Rechten nie weiter als die der Bildnerin und ein Starttext — als SetupRole auf dem Regal, kein zweites
// Format. Ein Sitz, der in der Rolle startet, bekommt das Bundel und den Text und liest die Post an ihre Adresse. Die Probe am Ende geht die ganze
// Geschichte: Rolle bilden, Bau-Sitz im Ordner, Prüf-Sitz in der Rolle, eine Nachricht an die Adresse der Rolle erreicht den Prüfer.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { branchTestkit, get, LIFE_DEADLINE_MS, persisted, post, type Answer, type Fixture } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
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
const missing = (a: Answer | undefined, id: string): void => {
  expect({ status: a?.status, missing: a?.body.missingRight, door: typeof a?.body.door }).toEqual({ status: 409, missing: id, door: "string" });
  expect(String(a?.body.error)).toContain(`missing right \`${id}\``);
};
const wurzel = (f: Fixture): string => dirname(f.repo);
const ordner = (f: Fixture, name: string): string => { const d = join(wurzel(f), name); mkdirSync(d, { recursive: true }); return d; };
const ROLES = "/api/self/roles", OPEN = "/api/self/seats/open";
const PRUEFER_OHNE_RECHTE = { name: "Prüfer", text: "Du prüfst, was gebaut wurde, unabhängig von seinem Bauer.", rights: [] };
const PRUEFER = { name: "Prüfer", text: "Du prüfst, was gebaut wurde, unabhängig von seinem Bauer. Du baust nichts um.", rights: ["text.pack"] };

describe("jede Tür der Rollen nennt ihr Recht", () => {
  test("ohne role.form und setup.export 409 mit missingRight; mit den Zusagen bildet, liest und exportiert dieselbe Session", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    const [bilden, liste, datei] = await life(f, [as(self, post(ROLES, PRUEFER)), as(self, get(ROLES)), as(self, get(`${ROLES}/prufer/datei`))], env);
    missing(bilden, "role.form");
    // die Liste liest, wer in einer Rolle öffnen kann: sie hängt an seat.open, das Bilden bleibt bei role.form
    missing(liste, "seat.open");
    missing(datei, "setup.export");

    const [grant] = await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "setup.export", "text.pack"] })], env);
    expect(grant?.status).toBe(200);
    const [neu, leer, nachher, export_, fehlt] = await life(f, [as(self, post(ROLES, PRUEFER)), as(self, get(ROLES)), as(self, get(ROLES)),
      as(self, get(`${ROLES}/prufer/datei`)), as(self, get(`${ROLES}/gibt-es-nicht/datei`))], env);
    expect(neu?.status).toBe(201);
    expect(neu?.body.role).toMatchObject({ id: "prufer", name: "Prüfer", rights: ["text.pack"], address: { kind: "role", role: "prufer" },
      von: "the session in slot 1" });
    expect(leer?.status).toBe(200);
    expect((nachher?.body.roles as { id: string }[]).map((r) => r.id)).toEqual(["prufer"]);
    // die Rolle reist als Setup (Schritt 4): eine Datei mit dem Rollenblock, den der Import beim neuen Owner zur Freigabe erbittet
    expect(export_?.status).toBe(200);
    expect(export_?.body).toMatchObject({ format: "fleet-setup/1", roles: [{ id: "prufer", rights: ["text.pack"] }], seats: [{ start: { role: "prufer" } }] });
    expect(fehlt?.status).toBe(404);
  }, LIFE_DEADLINE_MS * 5);

  test("wer nur seat.open hat, liest die Rollen (und findet eine, in der er ein Kind öffnet); bilden kann er sie nicht", async () => {
    const f = fixture();
    const [bilder, opener] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { recht: ["role.form"], buendel: "none" } }),
      post("/api/slots/2/open", { cwd: f.repo, rechte: { recht: ["seat.open"], buendel: "none" } }), "save"]);
    expect([bilder?.status, opener?.status]).toEqual([200, 200]);
    const [neu, liste, bilden, listeBilder] = await life(f, [as(tokenOf(f, 1), post(ROLES, PRUEFER_OHNE_RECHTE)), as(tokenOf(f, 2), get(ROLES)),
      as(tokenOf(f, 2), post(ROLES, PRUEFER_OHNE_RECHTE)), as(tokenOf(f, 1), get(ROLES))]);
    expect(neu?.status).toBe(201);
    expect(liste?.status).toBe(200);
    expect((liste?.body.roles as { id: string }[]).map((r) => r.id)).toEqual(["prufer"]);
    missing(bilden, "role.form");
    // wer nur role.form hat, bildet, aber liest nicht: die Liste ist die der Öffnenden
    missing(listeBilder, "seat.open");
  }, LIFE_DEADLINE_MS * 4);

  test("eine Rolle weiter als ihre Bildnerin wird abgewiesen und nennt das Recht; Fleets Rollen und ihre Labels sind keine Namen für eine gebildete", async () => {
    const f = fixture();
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { recht: ["role.form"], buendel: "none" } })]);
    expect(opened?.status).toBe(200);
    const self = tokenOf(f, 1);
    const [weiter, viel, steward, orch, lane, inLabel, gut] = await life(f, [
      as(self, post(ROLES, { ...PRUEFER, rights: ["text.pack"] })),
      as(self, post(ROLES, { ...PRUEFER, name: "Zu viel", rights: ["fleet.deploy", "edge.grant"] })),
      as(self, post(ROLES, { name: "Steward", text: "x" })), as(self, post(ROLES, { name: "Orchestratorin", text: "x" })),
      as(self, post(ROLES, { name: "lane", text: "x" })), as(self, post(ROLES, { name: "🎛 Prüfer", text: "x" })),
      as(self, post(ROLES, { name: "Beobachter", text: "Du siehst zu.", rights: [] }))]);
    // die Bildnerin trägt kein text.pack (Bundel none): auch das schmale Bundel ist weiter als sie
    expect(weiter?.status).toBe(409);
    expect(weiter?.body.missingRight).toBe("text.pack");
    expect(viel?.status).toBe(409);
    expect(viel?.body.missingRight).toBe("edge.grant");
    expect(String(viel?.body.error)).toContain("edge.grant, fleet.deploy");
    for (const a of [steward, orch, lane, inLabel]) expect(a?.status).toBe(409);
    expect(String(steward?.body.error)).toContain("Fleet's own role");
    expect(String(inLabel?.body.error)).toContain("role labels");
    expect(gut?.status).toBe(201);
    expect((gut?.body.role as { rights: string[] }).rights).toEqual([]);
  }, LIFE_DEADLINE_MS * 3);
});

describe("ein Sitz in der gebildeten Rolle", () => {
  test("die ganze Geschichte: Rolle bilden, Bau-Sitz im Ordner, Prüf-Sitz in der Rolle; eine Nachricht an die Adresse der Rolle erreicht den Prüfer", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const bau = ordner(f, "bau"), pruef = ordner(f, "pruef");
    // Bildnerin: eine Session ohne Bundel, der der Owner nur das gibt, was die Geschichte braucht
    const [opened, fremd] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } }), post("/api/slots/4/open", { cwd: f.repo })], env);
    expect([opened?.status, fremd?.status]).toEqual([200, 200]);
    const self = tokenOf(f, 1), fremdTok = tokenOf(f, 4);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack"] })], env);

    const [rolle, baut, prueft] = await life(f, [as(self, post(ROLES, PRUEFER)),
      as(self, post(OPEN, { cwd: bau, goal: "Baue die Funktion.", label: "Bauer" })),
      as(self, post(OPEN, { cwd: pruef, goal: "Prüfe, was der Bauer baut.", label: "Prüfer", role: "prufer" }))], env);
    expect([rolle?.status, baut?.status, prueft?.status]).toEqual([201, 200, 200]);
    const bauer = Number(baut?.body.slot), pruefer = Number(prueft?.body.slot);
    expect(prueft?.body.rolle).toEqual({ id: "prufer", name: "Prüfer", address: { kind: "role", role: "prufer" } });
    // der Sitz trägt die Rolle (auch über einen Neustart des Servers), das Bundel als Zusage und seinen Starttext in der Fassung
    const row = slotRow(f, pruefer);
    expect([row.cwd, row.rolleStein?.id, row.rechte?.recht, row.openedBy?.slot]).toEqual([pruef, "prufer", ["text.pack"], 1]);
    expect(slotRow(f, bauer).rolleStein ?? null).toBeNull();
    const [fassungP, fassungB] = await life(f, [get(`/api/slots/${pruefer}/fassung?anlass=laufend`), get(`/api/slots/${bauer}/fassung?anlass=laufend`)], env);
    const text = teil(fassungP, "liest", "rolle") ?? "";
    expect(text).toContain("FLEET ROLE (prufer, author: the session in slot 1)");
    expect(text).toContain("Du prüfst, was gebaut wurde");
    expect(text).toContain("ROLE RIGHTS (step 2 bundle, granted to this seat): text.pack");
    expect(teil(fassungB, "liest", "rolle") ?? "").not.toContain("FLEET ROLE");

    // die Post: der Bauer schreibt an die Adresse der Rolle (Geschwister), die Bildnerin auch; ein Fremder nicht
    const bauerTok = tokenOf(f, bauer), prueferTok = tokenOf(f, pruefer);
    const an = (tok: string, key: string) => as(tok, post("/api/self/messages", { to: { kind: "role", role: "prufer" },
      payload: { kind: "text", text: `Bitte prüfen (${key}).` }, idempotencyKey: key }));
    const [vomBauer, vonDerBildnerin, vomFremden, unbekannt] = await life(f, [an(bauerTok, "m1"), an(self, "m2"), an(fremdTok, "m3"),
      as(bauerTok, post("/api/self/messages", { to: { kind: "role", role: "niemand" }, payload: { kind: "text", text: "x" }, idempotencyKey: "m4" }))], env);
    expect([vomBauer?.status, vonDerBildnerin?.status, vomFremden?.status, unbekannt?.status]).toEqual([200, 200, 409, 409]);
    expect(vomBauer?.body.holder).toEqual({ slot: pruefer, openedAt: Number(prueft?.body.openedAt) });
    expect(String(vomFremden?.body.error)).toContain("POST /api/self/seats/open");
    // der Prüfer liest sie in seinem Postfach, mit dem Absender; der Bauer hört die Adresse der Rolle nicht
    const [prueferBox, bauerBox] = await life(f, [as(prueferTok, get("/api/self/messages")), as(bauerTok, get("/api/self/messages"))], env);
    const texte = (a: Answer | undefined): string[] => ((a?.body.entries as { payload: { text: string } }[] | undefined) ?? []).map((e) => e.payload.text).sort();
    expect(texte(prueferBox)).toEqual(["Bitte prüfen (m1).", "Bitte prüfen (m2)."]);
    expect([prueferBox?.body.unread, bauerBox?.body.unread]).toEqual([2, 0]);
    expect((prueferBox?.body.addresses as { kind: string }[]).map((x) => x.kind)).toEqual(["session", "role"]);
    expect((bauerBox?.body.addresses as { kind: string }[]).map((x) => x.kind)).toEqual(["session"]);
    // …und er antwortet dem Bauer, der Bauer ihm: die beiden schreiben einander, und der Prüfer auch der Bildnerin
    const [zurueck, anBauer] = await life(f, [
      as(prueferTok, post("/api/self/messages", { to: { kind: "session", slot: bauer }, payload: { kind: "text", text: "Gefunden: zwei Fehler." }, idempotencyKey: "a1" })),
      as(prueferTok, post("/api/self/messages", { to: { kind: "session", slot: 1 }, payload: { kind: "text", text: "Fertig." }, idempotencyKey: "a2" }))], env);
    expect([zurueck?.status, anBauer?.status]).toEqual([200, 200]);
  }, LIFE_DEADLINE_MS * 10);

  test("eine Rolle, die schon jemand trägt, bildet nur ihre Bildnerin neu — ein anderer Sitz mit role.form bekommt 409", async () => {
    const f = fixture();
    const [a, b] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: f.repo })]);
    expect([a?.status, b?.status]).toEqual([200, 200]);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form"] }), post("/api/slots/2/rechte", { grant: ["role.form"] })]);
    const eins = tokenOf(f, 1), zwei = tokenOf(f, 2);
    const [erst, fremd, nochmal, danach] = await life(f, [as(eins, post(ROLES, PRUEFER)),
      as(zwei, post(ROLES, { ...PRUEFER, text: "Ein fremder Text.", rights: [] })), as(eins, post(ROLES, { ...PRUEFER, text: "Mein neuer Text." })),
      as(eins, get(ROLES))]);
    expect([erst?.status, fremd?.status, nochmal?.status]).toEqual([201, 409, 201]);
    expect(String(fremd?.body.error)).toContain("only the seat that formed it");
    expect((danach?.body.roles as { von: string }[]).map((r) => r.von)).toEqual(["the session in slot 1"]);
  }, LIFE_DEADLINE_MS * 3);

  test("ein Sitz in der Rolle bekommt nie mehr, als seine Öffnerin hat; eine Rolle, die nicht hier gebildet wurde, öffnet die Tür nicht", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const ort = ordner(f, "ort");
    const [bildnerin, andere] = await life(f, [post("/api/slots/1/open", { cwd: f.repo }), post("/api/slots/2/open", { cwd: f.repo })], env);
    expect([bildnerin?.status, andere?.status]).toEqual([200, 200]);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "edge.grant"] })], env);
    const bild = tokenOf(f, 1), anderT = tokenOf(f, 2);
    const [gebildet] = await life(f, [as(bild, post(ROLES, { name: "Kantenwart", text: "Du schaltest Kanten.", rights: ["edge.grant"] }))], env);
    expect(gebildet?.status).toBe(201);
    const [zuWeit, unbekannt, flotte, ohneId] = await life(f, [
      as(anderT, post(OPEN, { cwd: ort, role: "kantenwart" })), as(bild, post(OPEN, { cwd: ort, role: "gibt-es-nicht" })),
      as(bild, post(OPEN, { cwd: ort, role: "lane" })), as(bild, post(OPEN, { cwd: ort, role: 7 }))], env);
    expect(zuWeit?.status).toBe(409);
    expect(String(zuWeit?.body.error)).toContain("rechte give edge.grant more than yours");
    expect(unbekannt?.status).toBe(404);
    expect(flotte?.status).toBe(409);
    expect(String(flotte?.body.error)).toContain("Fleet's own roles");
    expect(ohneId?.status).toBe(400);
    // die Bildnerin selbst darf sie öffnen — sie trägt edge.grant
    const [ok] = await life(f, [as(bild, post(OPEN, { cwd: ort, role: "kantenwart" }))], env);
    expect(ok?.status).toBe(200);
    expect(slotRow(f, Number(ok?.body.slot)).rechte?.recht).toEqual(["edge.grant"]);
  }, LIFE_DEADLINE_MS * 5);
});

describe("Runde 2 · die Türen sagen, was sie nicht kennen, und wer eine Rolle bildete", () => {
  test("ein Schlüssel, den die Selbst-Tür nicht liest, ist 400 mit den gelesenen; die Rolle entsteht nicht, der Sitz öffnet nicht", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack"] })], env);
    const self = tokenOf(f, 1);
    const [bundle, liste, ort, ok] = await life(f, [as(self, post(ROLES, { name: "Prüfer", text: "Du prüfst.", bundle: ["text.pack"] })), as(self, get(ROLES)),
      as(self, post(OPEN, { cwd: ordner(f, "ort"), bogus: true })), as(self, post(ROLES, PRUEFER))], env);
    expect([bundle?.status, bundle?.body.error]).toEqual([400, 'unknown key "bundle" — this door reads name, text, rights, packs']);
    expect(liste?.body.roles).toEqual([]);
    expect(ort?.status).toBe(400);
    expect(String(ort?.body.error)).toContain('unknown key "bogus" — this door reads cwd, label, harness');
    expect(ok?.status).toBe(201);
  }, LIFE_DEADLINE_MS * 4);

  test("der Starttext einer Rolle nennt, wer sie bildete; der Name der Rolle bleibt in der Kopfzeile", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f) };
    const [opened] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
    expect(opened?.status).toBe(200);
    await life(f, [post("/api/slots/1/rechte", { grant: ["role.form", "seat.open", "text.pack"] })], env);
    const self = tokenOf(f, 1);
    const [, kind] = await life(f, [as(self, post(ROLES, PRUEFER)), as(self, post(OPEN, { cwd: ordner(f, "ort"), role: "prufer" }))], env);
    const [fassung] = await life(f, [get(`/api/slots/${Number(kind?.body.slot)}/fassung?anlass=laufend`)], env);
    const kopf = (teil(fassung, "liest", "rolle") ?? "").split("\n")[0];
    expect(kopf).toBe("FLEET ROLE (prufer, author: the session in slot 1) — Prüfer");
  }, LIFE_DEADLINE_MS * 4);
});

describe("Runde 2 · eine Öffnerin beendet ein Kind, das sie öffnete", () => {
  test("die Öffnerin beendet ihr Kind (Ordner-Tür und Branch-Tür) und der Platz zählt nicht mehr gegen den Deckel; das Kind die Öffnerin, ein Geschwister und ein Fremder nicht", async () => {
    const f = fixture();
    const env = { FLEET_SELF_SEAT_ROOT: wurzel(f), FLEET_SELF_SEAT_CAP: "2" };
    const [a, fremd] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } }), post("/api/slots/4/open", { cwd: f.repo, rechte: { buendel: "none" } })], env);
    expect([a?.status, fremd?.status]).toEqual([200, 200]);
    await life(f, [post("/api/slots/1/rechte", { grant: ["seat.open"] }), post("/api/slots/4/rechte", { grant: ["seat.open"] })], env);
    const self = tokenOf(f, 1), fremdTok = tokenOf(f, 4);
    const ende = (tok: string, slot: number, body: unknown = {}) => as(tok, post(`/api/self/seats/${slot}/end`, body));
    const [eins, zwei, dritt] = await life(f, [as(self, post(OPEN, { cwd: ordner(f, "eins") })), as(self, post(OPEN, { cwd: ordner(f, "zwei") })),
      as(self, post(OPEN, { cwd: ordner(f, "drei") }))], env);
    expect([eins?.status, zwei?.status, dritt?.status]).toEqual([200, 200, 409]);
    const k1 = Number(eins?.body.slot), k2 = Number(zwei?.body.slot);
    await life(f, [post(`/api/slots/${k1}/rechte`, { grant: ["seat.open"] })], env);
    const [vomKind, vomGeschwister, vomFremden, ohneRecht, ende1] = await life(f, [ende(tokenOf(f, k1), 1), ende(tokenOf(f, k2), k1), ende(fremdTok, k1),
      ende(tokenOf(f, k2), k1), ende(self, k1, { openedAt: Number(eins?.body.openedAt) })], env);
    expect([vomKind?.status, vomGeschwister?.status, vomFremden?.status]).toEqual([409, 409, 409]);
    expect(String(vomKind?.body.error)).toContain("opened you");
    expect(String(vomFremden?.body.error)).toContain("did not open");
    expect(ohneRecht?.status).toBe(409);
    expect([ende1?.status, ende1?.body.ok]).toEqual([200, true]);
    // der Platz ist frei und zählt nicht mehr: dieselbe Öffnerin öffnet wieder
    expect((persisted(f).slots as Record<string, unknown>)[String(k1)]).toBeUndefined();
    const [nochmal, alterBesetzer, gibtEsNicht] = await life(f, [as(self, post(OPEN, { cwd: ordner(f, "drei") })),
      ende(self, k1, { openedAt: Number(eins?.body.openedAt) }), ende(self, 9)], env);
    expect(nochmal?.status).toBe(200);
    expect([alterBesetzer?.status, gibtEsNicht?.status]).toEqual([409, 409]);
    expect(String(alterBesetzer?.body.error)).toContain("another occupant");
    // ein Kind durch die Branch-Tür: auch dieses beendet die Öffnerin
    const [zweig] = await life(f, [as(self, post("/api/self/branches", { repo: f.repo, name: "Ende" }))], { ...env, FLEET_SELF_SEAT_CAP: "5" });
    expect(zweig?.status).toBe(201);
    const [weg] = await life(f, [ende(self, k2)], { ...env, FLEET_SELF_SEAT_CAP: "5" });
    expect(weg?.status).toBe(200);
    const [branchKind] = await life(f, [as(self, post("/api/self/branches/open", { repo: f.repo, branch: String(zweig?.body.branch) }))], { ...env, FLEET_SELF_SEAT_CAP: "5" });
    expect(branchKind?.status).toBe(200);
    const [branchEnde] = await life(f, [ende(self, Number(branchKind?.body.slot))], env);
    expect(branchEnde?.status).toBe(200);
  }, LIFE_DEADLINE_MS * 16);

  test("ohne seat.open verweigert die Tür mit dem Recht", async () => {
    const f = fixture();
    const [a] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } })]);
    expect(a?.status).toBe(200);
    const [r] = await life(f, [as(tokenOf(f, 1), post("/api/self/seats/2/end", {}))]);
    missing(r, "seat.open");
  }, LIFE_DEADLINE_MS * 2);
});

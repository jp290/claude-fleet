// EINE ROLLE, DIE MITREIST, KOMMT DORT ZU LEBEN, WO SIE LANDET (F2): ein Setup trägt eine gebildete Rolle über zwei Fleets; beim Empfänger liest
// das Regal sie noch (auch wenn die Bibliothek des Empfängers ihren Pack schon hat), der Owner gibt ihre Rechte frei, und dann öffnet die
// Selbst-Tür sie. Die Schicht ohne Server; die Türen und die ganze Geschichte stehen in server/rolle-kommt-an-tueren.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SeatKnowledge } from "./sitz-wissen";
import { importiereSetup, liesShelf, roleHash, roleStein, schreibShelf, setupAusRolle } from "./setup-datei";
import { rolleAnDerOwnerTuer, rolleDerPosition, rolleFormen, rolleSteinDerTuer } from "./selbst-sitze";
import { k15Freigabe } from "./k15-speicher";
import type { RechtId } from "../session-rechte";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = realpathSync(mkdtempSync(join(tmpdir(), "rolle-kommt-an-"))); ordner.push(o); return o; };
const BIB: SeatKnowledge = { tree: "fleet", repoRoot: "/r", head: "h", packs: [
  { id: "building-an-agent", useWhen: "Read this when you talk.", sources: [{ path: "docs/packs/building-an-agent.md", anchor: "# Working" }],
    text: "# Working\n\nAnswer short." }] };
const VON = { text: "the session in slot 1", slot: 1, cwd: "/w/1" };
const WIRKSAM = new Set<RechtId>(["seat.open", "text.pack", "role.form"]);
const nie = (): boolean => false;

/** Auf A bildet ein Sitz eine Rolle, die einen Bibliotheks-Pack liest, und exportiert sie als Datei (GET /api/self/roles/<id>/datei). */
function dateiVonA() {
  const a = frisch();
  const gebildet = rolleFormen({ name: "Prüfer", text: "Du prüfst.", rights: ["text.pack"], packs: ["building-an-agent"] }, WIRKSAM, a, nie, VON, BIB);
  if (!gebildet.ok) throw new Error(gebildet.error);
  const stein = roleStein("prufer", a);
  if (!stein) throw new Error("keine Rolle auf A");
  return JSON.parse(JSON.stringify(setupAusRolle(stein)));
}

describe("Ziel 1: eine Rolle, die einen Bibliotheks-Pack liest, bleibt nach dem Import auf dem Regal", () => {
  test("der Empfänger hat den Pack in seiner Bibliothek (source local): die Rolle steht auf dem Regal, mit ihrem Pack", async () => {
    const datei = dateiVonA();
    const b = frisch();
    const r = await importiereSetup(datei, { dir: b, bibliothek: () => BIB }, { schreiben: true, jetzt: 1 });
    expect(r.status).toBe(201);
    expect((r.body.vorschau as { packs: { id: string; source: string }[] }).packs.map((p) => [p.id, p.source])).toEqual([["building-an-agent", "local"]]);
    expect(liesShelf(b).roles?.map((x) => x.id)).toEqual(["prufer"]);
    expect(roleStein("prufer", b)?.packs.map((p) => p.id)).toEqual(["building-an-agent"]);
  });
  test("ein Pack, den weder die Datei noch die Bibliothek trägt, lässt die Datei weiter scheitern, mit dem Satz von heute", async () => {
    const datei = dateiVonA();
    datei.packs = [];
    const r = await importiereSetup(datei, { dir: frisch(), bibliothek: () => BIB }, { schreiben: true });
    expect(r.status).toBe(400);
    expect(String((r.body as { error: string }).error)).toContain("reads pack „building-an-agent“, which the file does not carry");
  });
});

const freigabe = (dir: string, konst: string, pos: string) => k15Freigabe(new Request("http://x/api/k15/freigabe", { method: "POST",
  headers: { "content-type": "application/json" }, body: JSON.stringify({ konst, pos }) }), dir);
const importiert = async (datei: unknown, dir: string): Promise<string> => {
  const r = await importiereSetup(datei, { dir, bibliothek: () => BIB }, { schreiben: true, jetzt: 1 });
  expect(r.status).toBe(201);
  return String((r.body as Record<string, any>).konstellation.id);
};

describe("Ziel 2: eine bestätigte importierte Rolle öffnet die Selbst-Tür", () => {
  test("vor der Freigabe des Owners der Satz von heute, nach ihr öffnet die Tür die Rolle mit ihrem Bundel", async () => {
    const b = frisch();
    const kid = await importiert(dateiVonA(), b);
    const vorher = rolleSteinDerTuer("prufer", b);
    expect(vorher).toMatchObject({ ok: false, status: 409 });
    expect(vorher.ok ? "" : vorher.error).toContain("its rights wait for the owner's confirmation");
    expect((await freigabe(b, kid, "prufer")).status).toBe(200);
    const nachher = rolleSteinDerTuer("prufer", b);
    expect(nachher.ok && [nachher.stein.role.id, nachher.stein.role.rights, nachher.stein.packs.map((p) => p.id)]).toEqual(["prufer", ["text.pack"], ["building-an-agent"]]);
  });
  test("die Freigabe gilt den Rechten, die sie bestätigte: eine Rolle gleicher Kennung mit weiteren Rechten ist wieder unbestätigt", async () => {
    const b = frisch();
    const kid = await importiert(dateiVonA(), b);
    await freigabe(b, kid, "prufer");
    // ein zweiter Import derselben Kennung mit mehr Rechten ersetzt die Rolle auf dem Regal; die Position behält das, was bestätigt wurde
    const weiter = roleStein("prufer", b)!.role;
    const rights: RechtId[] = ["text.pack", "edge.grant"];
    const breit = { ...weiter, rights, hash: roleHash({ ...weiter, rights }) };
    schreibShelf(b, { ...liesShelf(b), roles: [breit] });
    const a = rolleSteinDerTuer("prufer", b);
    expect(a).toMatchObject({ ok: false, status: 409 });
  });
  test("eine Rolle ohne Rechte hat nichts zu bestätigen; eine, die nirgends steht, bleibt 404; Fleets eigene bleiben dem Owner", async () => {
    const a = frisch();
    const gebildet = rolleFormen({ name: "Beobachter", text: "Du siehst zu.", rights: [] }, WIRKSAM, a, nie, VON, BIB);
    if (!gebildet.ok) throw new Error(gebildet.error);
    const datei = JSON.parse(JSON.stringify(setupAusRolle(roleStein("beobachter", a)!)));
    const b = frisch();
    await importiert(datei, b);
    // nichts zu bestätigen heißt nicht „bestätigt“: die Herkunft sagt, was wahr ist
    expect(rolleSteinDerTuer("beobachter", b)).toMatchObject({ ok: true, von: "an imported setup (no rights to confirm)" });
    expect(rolleSteinDerTuer("gibt-es-nicht", b)).toMatchObject({ ok: false, status: 404 });
    expect(rolleSteinDerTuer("lane", b)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("Ziel 3: ein Sitz in einer importierten Rolle trägt sie", () => {
  test("die Rolle einer Position ist erst nach der Freigabe ein Stein des Sitzes: mit Name, Hash und Herkunft; Fleets eigene und unbekannte nie", async () => {
    const b = frisch();
    const kid = await importiert(dateiVonA(), b);
    expect(rolleDerPosition("prufer", b)).toBeNull();
    await freigabe(b, kid, "prufer");
    const stein = roleStein("prufer", b)!;
    expect(rolleDerPosition("prufer", b)).toEqual({ id: "prufer", name: "Prüfer", hash: stein.role.hash, von: "an imported setup, confirmed by the owner" });
    for (const nie of [undefined, "lane", "orchestratorin", "gibt-es-nicht"]) expect(rolleDerPosition(nie, b)).toBeNull();
  });
  test("der Owner nennt `role` im Body: eine bestätigte oder hier gebildete Rolle faltet ihr Bundel in die Rechte, `role` verschwindet aus dem Body; sonst ein Satz", async () => {
    const b = frisch();
    const kid = await importiert(dateiVonA(), b);
    const vorher = rolleAnDerOwnerTuer({ cwd: "/x", role: "prufer" }, b);
    expect(vorher).toMatchObject({ ok: false, status: 409 });
    await freigabe(b, kid, "prufer");
    const nachher = rolleAnDerOwnerTuer({ cwd: "/x", role: "prufer", goal: "g" }, b);
    if (!nachher.ok) throw new Error(nachher.error);
    expect(nachher.body).toMatchObject({ cwd: "/x", goal: "g", rechte: { recht: ["text.pack"] } });
    expect("role" in nachher.body).toBe(false);
    expect(nachher.rolle?.id).toBe("prufer");
    // ohne `role` bleibt alles, wie es war
    const ohne = rolleAnDerOwnerTuer({ cwd: "/x" }, b);
    expect(ohne).toEqual({ ok: true, body: { cwd: "/x" }, rolle: null });
    expect(rolleAnDerOwnerTuer({ role: "lane" }, b)).toMatchObject({ ok: false, status: 409 });
  });
});

// DER SITZ ÖFFNET SITZE UND BILDET ROLLEN — die Schicht ohne Server (server/selbst-sitze.ts): Ordner-Regel, Deckel, Gegenseite im
// Postfach, die Rolle als Daten, ihre Reise als Setup-Datei. Die Türen selbst prüfen server/selbst-sitze-tueren.test.ts und
// server/rollen-tueren.test.ts gegen einen laufenden Server.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import type { RechtId } from "../session-rechte";
import type { SeatKnowledge } from "./sitz-wissen";
import { kindNieWeiter, type Oeffnerin } from "./kind-weite";
import { k15Freigabe } from "./k15-speicher";
import { importiereSetup, liesShelf, pruefeSetupDatei, roleHash, roleStein, schreibShelf, setupAusRolle } from "./setup-datei";
import { ROLLE_SCHLUESSEL, SITZ_SCHLUESSEL, geoeffnetVonZeile, geoeffneteKinder, gebildeteAufRegal, kindBeenden, unbekannteSchluessel, mitRolleRechten, neuesterInhaber, ordnerDerTuer, rolleAusName, rolleFormen, rolleSteinDerTuer,
  seatCap, seatRoot, sitzGegenseite, type SitzTatsache } from "./selbst-sitze";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = realpathSync(mkdtempSync(join(tmpdir(), "selbst-sitze-"))); ordner.push(o); return o; };
const sitz = (slot: number, extra: Partial<SitzTatsache> = {}): SitzTatsache =>
  ({ slot, openedAt: 100 + slot, cwd: `/w/${slot}`, openedBy: null, rolleStein: null, ...extra });
const von = (o: SitzTatsache) => ({ slot: o.slot, openedAt: o.openedAt, cwd: o.cwd! });
const nie = (): boolean => false;
const VON = { text: "s", slot: 1, cwd: "/w/1" };
const WIRKSAM = new Set<RechtId>(["seat.open", "text.pack", "role.form"]);
const BIB: SeatKnowledge = { tree: "fleet", repoRoot: "/r", head: "h", packs: [
  { id: "building-an-agent", useWhen: "Read this when you talk.", sources: [{ path: "docs/packs/building-an-agent.md", anchor: "# Working" }],
    text: "# Working\n\nAnswer short." },
  { id: "privat-pack", useWhen: "x", sources: [{ path: "p.md", anchor: "# P" }], text: "# P\n\nnur für mich", personal: true }] };

describe("die Ordner-Regel", () => {
  test("ohne FLEET_SELF_SEAT_ROOT ist die Wurzel das Home des Nutzers, mit ihr der gesetzte Ordner", () => {
    const wurzel = frisch();
    expect(seatRoot({})).toBe(realpathSync(homedir()));
    expect(seatRoot({ FLEET_SELF_SEAT_ROOT: wurzel })).toBe(wurzel);
    expect(seatRoot({ FLEET_SELF_SEAT_ROOT: "  " })).toBe(realpathSync(homedir()));
  });
  test("ein Ordner unter der Wurzel geht, die Wurzel selbst auch; ein Ordner daneben, darüber oder über einen Symlink hinaus nicht", () => {
    const aussen = frisch(), wurzel = frisch(), drin = join(wurzel, "projekt");
    mkdirSync(drin);
    symlinkSync(aussen, join(wurzel, "ausgang"));
    expect(ordnerDerTuer(drin, wurzel)).toMatchObject({ ok: true });
    expect(ordnerDerTuer(wurzel, wurzel)).toMatchObject({ ok: true });
    for (const draussen of [aussen, join(wurzel, ".."), join(wurzel, "ausgang")]) {
      const a = ordnerDerTuer(draussen, wurzel);
      expect(a).toMatchObject({ ok: false, status: 409 });
      expect(a.ok ? "" : a.error).toContain("outside the root");
    }
    // ein Name, der nur mit dem Namen der Wurzel BEGINNT, liegt nicht darunter
    const nachbar = `${wurzel}-nachbar`;
    mkdirSync(nachbar);
    ordner.push(nachbar);
    expect(ordnerDerTuer(nachbar, wurzel)).toMatchObject({ ok: false, status: 409 });
    expect(ordnerDerTuer(join(wurzel, "fehlt"), wurzel)).toMatchObject({ ok: false, status: 400 });
  });
  test("die Tür gibt den echten Pfad zurück, nicht den, der hereinkam: ein Symlink unter der Wurzel, der auf einen Ordner darunter zeigt, wird aufgelöst", () => {
    const wurzel = frisch(), echt = join(wurzel, "projekt");
    mkdirSync(echt);
    symlinkSync(echt, join(wurzel, "kurz"));
    expect(ordnerDerTuer(join(wurzel, "kurz"), wurzel)).toEqual({ ok: true, ordner: echt });
    expect(ordnerDerTuer(echt, wurzel)).toEqual({ ok: true, ordner: echt });
  });
  test("der Deckel ist 3, FLEET_SELF_SEAT_CAP ändert ihn, Unsinn lässt es bei 3", () => {
    expect(seatCap({})).toBe(3);
    expect(seatCap({ FLEET_SELF_SEAT_CAP: "5" })).toBe(5);
    expect(seatCap({ FLEET_SELF_SEAT_CAP: "0" })).toBe(0);
    for (const v of ["-1", "x", "", "2.5"]) expect(seatCap({ FLEET_SELF_SEAT_CAP: v })).toBe(3);
  });
  test("gezählt werden die lebenden Sitze, die diese Öffnerin an diesem Ort öffnete — ein recycelter Platz und ein fremdes Kind fallen heraus", () => {
    const o = sitz(1);
    const seats = [o, sitz(2, { openedBy: von(o) }), sitz(3, { openedBy: von(o) }), sitz(4, { openedBy: von(o), cwd: null }),
      sitz(5, { openedBy: { ...von(o), cwd: "/anderer/ort" } }), sitz(6, { openedBy: von(sitz(9)) })];
    expect(geoeffneteKinder(seats, { slot: 1, cwd: "/w/1" }).map((x) => x.slot)).toEqual([2, 3]);
  });
});

describe("die Gegenseite im Postfach", () => {
  test("Öffnerin und Kind sind einander Gegenüber, Geschwister der Öffnerin auch; ein Fremder nicht, ein recycelter Platz nicht", () => {
    const o = sitz(1), a = sitz(2, { openedBy: von(o) }), b = sitz(3, { openedBy: von(o) }), fremd = sitz(4), anderes = sitz(5, { openedBy: von(fremd) });
    expect([sitzGegenseite(o, a), sitzGegenseite(a, o), sitzGegenseite(a, b), sitzGegenseite(b, a)]).toEqual([true, true, true, true]);
    expect([sitzGegenseite(a, fremd), sitzGegenseite(a, anderes), sitzGegenseite(o, anderes), sitzGegenseite(a, a)]).toEqual([false, false, false, false]);
    expect(sitzGegenseite(a, { ...o, cwd: "/w/anderswo" })).toBe(false);
    expect(sitzGegenseite(a, { ...b, cwd: null })).toBe(false);
  });
  test("die Adresse einer Rolle geht an den jüngsten lebenden Inhaber; ohne lebenden Inhaber an keinen", () => {
    const r = { id: "pruefer" };
    const seats = [sitz(2, { rolleStein: r, openedAt: 50 }), sitz(3, { rolleStein: r, openedAt: 90 }), sitz(4, { rolleStein: r, openedAt: 90 }),
      sitz(5, { rolleStein: { id: "anderer" }, openedAt: 999 }), sitz(6, { rolleStein: r, openedAt: 5000, cwd: null })];
    expect(neuesterInhaber(seats, "pruefer")?.slot).toBe(4);
    expect(neuesterInhaber(seats, "niemand")).toBeNull();
  });
});

describe("eine Rolle ist ein Datensatz auf dem Regal", () => {
  test("der Name wird zur Kennung der Adresse; Umlaute fallen auf ihren Grundbuchstaben", () => {
    expect(rolleAusName("Prüfer")).toBe("prufer");
    expect(rolleAusName("  Unabhängige  Prüfung! ")).toBe("unabhangige-prufung");
    expect(rolleAusName("!!!")).toBeNull();
    expect(rolleAusName("9 Uhr")).toBeNull();
  });
  test("eine Rolle weiter als ihre Bildnerin wird abgewiesen, mit dem ersten Recht im Satz und im Feld missingRight", () => {
    const dir = frisch();
    const a = rolleFormen({ name: "Zu weit", text: "Du darfst alles.", rights: ["text.pack", "fleet.deploy", "edge.grant"] }, WIRKSAM, dir, nie, VON);
    expect(a).toMatchObject({ ok: false, status: 409, missingRight: "edge.grant" });
    expect(a.ok ? "" : a.error).toContain("edge.grant, fleet.deploy");
    expect(gebildeteAufRegal(dir)).toEqual([]);
  });
  test("eine gebildete Rolle trägt kein Setup-Recht und nicht role.form, auch wenn die Bildnerin sie selbst hat: 409 mit dem Recht", () => {
    const dir = frisch();
    const alle = new Set<RechtId>([...WIRKSAM, "setup.save", "setup.export", "setup.import", "role.form"]);
    for (const recht of ["setup.save", "setup.export", "setup.import", "role.form"] as RechtId[]) {
      const a = rolleFormen({ name: "Bildet weiter", text: "Du bildest Rollen.", rights: ["text.pack", recht] }, alle, dir, nie, VON);
      expect(a).toMatchObject({ ok: false, status: 409, missingRight: recht });
      expect(a.ok ? "" : a.error).toContain(`\`${recht}\``);
    }
    expect(gebildeteAufRegal(dir)).toEqual([]);
    expect(rolleFormen({ name: "Liest nur", text: "Du liest.", rights: ["text.pack"] }, alle, dir, nie, VON).ok).toBe(true);
  });
  test("Fleets eigene Rollen und jeder Name, den Fleet als Rolle liest, sind verboten", () => {
    const dir = frisch();
    const label = (n: string): boolean => /orchestrator|steward/i.test(n);
    for (const name of ["Steward", "orchestratorin", "Lane", "program-main", "Main", "Owner", "Controller", "Orchestrator (Prüfer)", "Orchestrator-Gehilfe"]) {
      const a = rolleFormen({ name, text: "x" }, WIRKSAM, dir, label, VON);
      expect(a, name).toMatchObject({ ok: false, status: 409 });
    }
    expect(gebildeteAufRegal(dir)).toEqual([]);
  });
  test("eine gebildete Rolle trägt Name, Adresse, Bundel und Starttext und steht als SetupRole im Regal; ein Pack der Bibliothek reist mit", () => {
    const dir = frisch();
    const a = rolleFormen({ name: "Prüfer", text: "Du prüfst unabhängig.", rights: ["text.pack"], packs: ["building-an-agent"] }, WIRKSAM, dir, nie, { ...VON, text: "the session in slot 1" }, BIB, 7);
    if (!a.ok) throw new Error(a.error);
    expect(a.rolle).toMatchObject({ id: "prufer", name: "Prüfer", rights: ["text.pack"], packs: ["building-an-agent"],
      address: { kind: "role", role: "prufer" }, von: "the session in slot 1" });
    const stein = roleStein("prufer", dir);
    expect(stein?.role).toMatchObject({ id: "prufer", name: "Prüfer", rights: ["text.pack"], start: { text: "Du prüfst unabhängig." } });
    expect(stein?.packs.map((p) => p.id)).toEqual(["building-an-agent"]);
    expect(gebildeteAufRegal(dir).map((g) => [g.role.id, g.von, g.at])).toEqual([["prufer", "the session in slot 1", 7]]);
    expect(rolleSteinDerTuer("prufer", dir)).toMatchObject({ ok: true, von: "the session in slot 1" });
    // ein Pack, den es nicht gibt, und ein persönlicher bleiben draußen
    for (const pack of ["gibt-es-nicht", "privat-pack"])
      expect(rolleFormen({ name: "Leer", text: "x", packs: [pack] }, WIRKSAM, dir, nie, VON, BIB)).toMatchObject({ ok: false, status: 400 });
  });
  test("eine schon gebildete Rolle bildet nur ihre Bildnerin neu (Platz und Ordner); jeder andere bekommt 409 mit Grund, und die Rolle bleibt, wie sie war", () => {
    const dir = frisch();
    const erst = rolleFormen({ name: "Prüfer", text: "Erster Text.", rights: ["text.pack"] }, WIRKSAM, dir, nie, VON);
    expect(erst.ok).toBe(true);
    for (const fremd of [{ ...VON, slot: 2 }, { ...VON, cwd: "/w/anderswo" }]) {
      const a = rolleFormen({ name: "Prüfer", text: "Übernommener Text.", rights: [] }, WIRKSAM, dir, nie, fremd);
      expect(a).toMatchObject({ ok: false, status: 409 });
      expect(a.ok ? "" : a.error).toContain("only the seat that formed it");
    }
    expect(roleStein("prufer", dir)?.role).toMatchObject({ start: { text: "Erster Text." }, rights: ["text.pack"] });
    // die Bildnerin selbst (dieselbe Linie, auch eine Nachfolge) ändert sie
    const neu = rolleFormen({ name: "Prüfer", text: "Zweiter Text.", rights: [] }, WIRKSAM, dir, nie, VON);
    expect(neu.ok).toBe(true);
    expect(roleStein("prufer", dir)?.role.start.text).toBe("Zweiter Text.");
  });
  test("die Tür öffnet nur Rollen, die hier gebildet wurden: Fleets Rollen, unbekannte und importierte nicht", async () => {
    const dir = frisch();
    expect(rolleSteinDerTuer("lane", dir)).toMatchObject({ ok: false, status: 409 });
    expect(rolleSteinDerTuer("orchestratorin", dir)).toMatchObject({ ok: false, status: 409 });
    expect(rolleSteinDerTuer("gibt-es-nicht", dir)).toMatchObject({ ok: false, status: 404 });
    expect(rolleSteinDerTuer("Kein Id", dir)).toMatchObject({ ok: false, status: 400 });
    const a = rolleFormen({ name: "Prüfer", text: "Du prüfst.", rights: ["text.pack"] }, WIRKSAM, dir, nie, VON);
    if (!a.ok) throw new Error(a.error);
    expect(rolleSteinDerTuer("prufer", dir)).toMatchObject({ ok: true });
    // dieselbe Kennung mit anderem Inhalt (etwa durch einen Import über das Regal) ist nicht „hier gebildet“
    const shelf = liesShelf(dir), alt = shelf.roles![0]!;
    const start = { titel: alt.name, text: "Ganz andere Rolle." };
    schreibShelf(dir, { ...shelf, roles: [{ ...alt, start, rights: ["seat.open"], hash: roleHash({ ...alt, start, rights: ["seat.open"] }) }] });
    expect(rolleSteinDerTuer("prufer", dir)).toMatchObject({ ok: false, status: 409 });
  });
  test("das Bundel einer Rolle faltet sich als Zusagen in die Rechte des Kindes; die Zusagen der Öffnerin gehen nur mit, wenn der Body sie nennt", () => {
    const o = { stufe: "lesen" as const, an: [], aus: [], recht: ["seat.open" as const, "role.form" as const] };
    expect(mitRolleRechten({ cwd: "/x" }, ["text.pack"], o).rechte).toEqual({ stufe: "lesen", an: [], aus: [], recht: ["text.pack"] });
    expect(mitRolleRechten({ cwd: "/x" }, ["text.pack"], null).rechte).toEqual({ stufe: "bauen", an: [], aus: [], recht: ["text.pack"] });
    // eine Öffnerin ohne Rollenbundel gibt dem Kind kein Bundel, das sie selbst nicht trägt
    expect(mitRolleRechten({}, ["text.pack"], { ...o, buendel: "none" }).rechte).toEqual({ stufe: "lesen", an: [], aus: [], recht: ["text.pack"], buendel: "none" });
    expect(mitRolleRechten({ rechte: { recht: ["seat.open"] } }, ["text.pack"], o).rechte)
      .toEqual({ stufe: "bauen", an: [], aus: [], recht: ["seat.open", "text.pack"] });
    // unlesbare Rechte im Body lässt die Tür mit ihrem eigenen Satz ablehnen
    expect(mitRolleRechten({ rechte: { recht: ["gibt-es-nicht"] } }, ["text.pack"], o).rechte).toEqual({ recht: ["gibt-es-nicht"] });
  });
});

describe("eine gebildete Rolle reist als Setup", () => {
  test("die Datei besteht die Prüfung des Formats; der Import legt die Rolle ab, ihre Rechte warten auf die Freigabe, und die Selbst-Tür öffnet sie dort nicht", async () => {
    const dir = frisch();
    const a = rolleFormen({ name: "Prüfer", text: "Du prüfst unabhängig.", rights: ["text.pack"], packs: ["building-an-agent"] }, WIRKSAM, dir, nie, VON, BIB);
    if (!a.ok) throw new Error(a.error);
    const datei = setupAusRolle(roleStein("prufer", dir)!);
    expect(pruefeSetupDatei(datei)).toEqual(datei);
    expect(datei.seats[0]).toMatchObject({ id: "prufer", start: { role: "prufer", direction: { text: null, personal: true } } });
    expect(datei.roles[0]!.rights).toEqual(["text.pack"]);

    const neu = frisch();
    const r = await importiereSetup(JSON.parse(JSON.stringify(datei)), { dir: neu, bibliothek: () => ({ ...BIB, packs: [] }) },
      { schreiben: true, jetzt: 9 });
    expect(r.status).toBe(201);
    const body = r.body as Record<string, any>;
    expect(body.vorschau.requestedRoles[0].rights).toEqual(["text.pack"]);
    const state = JSON.parse(await Bun.file(join(neu, SPEICHER_DATEI)).text());
    const pos = state.konstellationen[0].positionen[0];
    expect([pos.sitz.darf.rolle, pos.sitz.darf.bestaetigt]).toEqual([["text.pack"], undefined]);
    // beim neuen Owner steht die Rolle auf dem Regal, gebildet wurde sie dort nicht: die Selbst-Tür öffnet sie nicht
    expect(roleStein("prufer", neu)?.role.rights).toEqual(["text.pack"]);
    const abgewiesen = rolleSteinDerTuer("prufer", neu);
    expect(abgewiesen).toMatchObject({ ok: false, status: 409 });
    expect(abgewiesen.ok ? "" : abgewiesen.error).toContain("owner's confirmation");
    // die Freigabe des Owners gibt dem Rollensitz der Konstellation seine Rechte, wie bei jeder importierten Rolle
    const frei = await k15Freigabe(new Request("http://x/api/k15/freigabe", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ konst: String(body.konstellation.id), pos: "prufer" }) }), neu);
    expect(frei.status).toBe(200);
  });
});

describe("das Kind ist nie weiter als seine Öffnerin (dieselbe Deckelung wie an der Branch-Tür)", () => {
  const claude: Oeffnerin = { harness: "claude", modus: "auto", permissions: null, rechte: null, rollen: ["generic"] };
  test("ein anderer Harness, ein Recht, das die Öffnerin nicht hat, und die Rolle als Bundel: abgewiesen mit dem Grund", () => {
    const harness = kindNieWeiter(claude, { harness: "codex" });
    expect(harness.ok ? "offen" : harness.error).toContain("harness codex is not yours");
    const recht = kindNieWeiter(claude, mitRolleRechten({}, ["fleet.deploy"], null));
    expect(recht.ok ? "offen" : recht.error).toContain("rechte give fleet.deploy more than yours");
    expect(kindNieWeiter(claude, mitRolleRechten({}, ["text.pack"], null)).ok).toBe(true);
    // eine gezäunte Öffnerin öffnet kein ungezäuntes Kind: ihr Harness ist der einzige, den sie weitergibt
    const gezaeunt: Oeffnerin = { harness: "pi-zai", modus: null, permissions: null, rechte: null, rollen: ["generic"] };
    for (const h of ["claude", "pi-zai-unfenced", "codex"]) {
      const a = kindNieWeiter(gezaeunt, { harness: h });
      expect(a.ok ? "offen" : a.error, h).toContain("is not yours");
    }
  });
});

describe("Runde 2 · die Türen kennen ihre Schlüssel", () => {
  test("ein Schlüssel, den die Tür nicht liest, wird mit den gelesenen genannt; ein bekannter geht durch", () => {
    expect(unbekannteSchluessel({ name: "x", text: "y", bundle: [] }, ROLLE_SCHLUESSEL)).toBe('unknown key "bundle" — this door reads name, text, rights, packs');
    expect(unbekannteSchluessel({ name: "x", a: 1, b: 2 }, ROLLE_SCHLUESSEL)).toBe('unknown keys "a", "b" — this door reads name, text, rights, packs');
    expect(unbekannteSchluessel({ name: "x", text: "y", rights: [], packs: [] }, ROLLE_SCHLUESSEL)).toBeNull();
    expect(unbekannteSchluessel({ cwd: "/x", role: "r", goal: "g" }, SITZ_SCHLUESSEL)).toBeNull();
  });
  test("eine Rolle mit einem Schlüssel, den die Tür nicht liest, wird nicht gebildet (400) und liegt nicht auf dem Regal", () => {
    const dir = frisch();
    const a = rolleFormen({ name: "Prüfer", text: "Du prüfst.", bundle: ["text.pack"] }, WIRKSAM, dir, nie, VON, BIB);
    expect(a).toMatchObject({ ok: false, status: 400, error: 'unknown key "bundle" — this door reads name, text, rights, packs' });
    expect(liesShelf(dir).roles ?? []).toEqual([]);
  });
});

describe("Runde 2 · eine Öffnerin beendet ein Kind, das sie öffnete", () => {
  const oeffnerin = sitz(1), kind = sitz(2, { openedBy: von(sitz(1)) }), geschwister = sitz(3, { openedBy: von(sitz(1)) }), fremd = sitz(4);
  test("das eigene Kind darf beendet werden; die Öffnerin, ein Geschwister, ein Fremder und ein Platz ohne Sitz nicht — jedes mit seinem Grund", () => {
    expect(kindBeenden(oeffnerin, kind, false, undefined)).toEqual({ ok: true });
    expect(kindBeenden(kind, oeffnerin, false, undefined)).toMatchObject({ ok: false, status: 409 });
    expect(kindBeenden(geschwister, kind, false, undefined)).toMatchObject({ ok: false, status: 409 });
    expect(kindBeenden(fremd, kind, false, undefined)).toMatchObject({ ok: false, status: 409 });
    const grund = (z: SitzTatsache | undefined) => { const r = kindBeenden(oeffnerin, z, false, undefined); return r.ok ? "" : r.error; };
    expect(grund(kind)).toBe("");
    expect(kindBeenden(kind, oeffnerin, false, undefined)).toMatchObject({ error: expect.stringContaining("opened you") });
    expect(kindBeenden(fremd, kind, false, undefined)).toMatchObject({ error: expect.stringContaining("did not open") });
    expect(grund(undefined)).toContain("no live seat");
    expect(grund(sitz(2, { cwd: null }))).toContain("no live seat");
  });
  test("ein Sitz in einer Rolle von Fleet (Lane, Steward, Orchestratorin) und ein anderer Besetzer desselben Platzes werden nicht beendet", () => {
    const r = kindBeenden(oeffnerin, kind, true, undefined);
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(r.ok ? "" : r.error).toContain("Fleet's own role");
    const anders = kindBeenden(oeffnerin, kind, false, kind.openedAt + 1);
    expect(anders.ok ? "" : anders.error).toContain("another occupant");
    expect(kindBeenden(oeffnerin, kind, false, kind.openedAt)).toEqual({ ok: true });
  });
});

describe("Runde 2 · wer die Sitze öffnete, steht im ersten Satz", () => {
  test("der erste Satz nennt die Tür und die Öffnerin, auf Englisch, und nennt kein Owner-Tor", () => {
    expect(geoeffnetVonZeile(14, "POST /api/self/seats/open")).toBe(
      "[opened by the session in slot 14 through POST /api/self/seats/open — it is your counterpart in the mailbox]");
  });
});

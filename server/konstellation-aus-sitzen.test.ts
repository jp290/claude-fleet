// DIE KONSTELLATION, DIE EIN SITZ GEBAUT HAT, WIRD EINE DATEI (F1, docs/konstellation/aus-sitzen-entwurf.md): aus der Öffnerin und den Sitzen, die sie
// geöffnet hat, wird ein Setup (ein Sitz je Platz, eine Kante je Kind, die gebildete Rolle als Block, das Ziel je Sitz, der Ordner als leerer Platz),
// das durch den Schreibweg des Imports als gespeicherte Konstellation landet. Die Marke des Sitzes gilt wie bei einem gespeicherten Agenten:
// Rechte gedeckelt, nie bypass, keine Fleet-Rolle. Die ganze Geschichte über die Tür steht in konstellation-aus-sitzen-tuer.test.ts.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { sitzRechte } from "../src/sitz";
import { importiereSetup, pruefeSetupDatei, roleHash, schreibShelf, type SetupRole } from "./setup-datei";
import { setupAusSitzen, speichereKonstellation, zielVon, type SitzBild } from "./konstellation-aus-sitzen";
import type { StartEintrag } from "./start-historie";
import type { SeatKnowledge } from "./sitz-wissen";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = mkdtempSync(join(tmpdir(), "konst-aus-sitzen-")); ordner.push(o); return o; };

const WISSEN: SeatKnowledge = { tree: "fleet", repoRoot: "/r", head: "c0ffee", packs: [
  { id: "shared-pack", useWhen: "Read this when you build.", sources: [{ path: "docs/packs/shared-pack.md", anchor: "# Shared pack" }],
    text: "# Shared pack\n\nUse this when you build." }] };
const PRUEFER: SetupRole = (() => {
  const start = { titel: "Prüfer", text: "Du prüfst, was gebaut wurde." };
  return { id: "prufer", name: "Prüfer", hash: roleHash({ id: "prufer", name: "Prüfer", start, rights: ["text.pack"], packs: [] }), start, rights: ["text.pack"], packs: [] };
})();

/** Eine Welt: Wurzel mit zwei Ordnern, ein Zustandsverzeichnis mit der gebildeten Rolle auf dem Regal, eine Öffnerin und zwei Kinder. */
function welt() {
  const wurzel = frisch(), dir = frisch();
  const lead = join(wurzel, "lead"), bau = join(wurzel, "bau"), pruef = join(wurzel, "pruef");
  for (const o of [lead, bau, pruef]) mkdirSync(o, { recursive: true });
  schreibShelf(dir, { version: 1, packs: [], concepts: [], roles: [PRUEFER] });
  const bild = (o: Partial<SitzBild> & { slot: number; cwd: string }): SitzBild => ({ openedAt: 1000 + o.slot, label: null, harness: "claude",
    model: "claude-sonnet-5-5", effort: null, permissionMode: null, rechte: null, agentMd: null, bibliothek: ["shared-pack"], rolleStein: null, openedBy: null, ...o });
  const oeffnerin = bild({ slot: 1, cwd: lead, label: "Leitung", agentMd: { titel: "Leitung.md", text: "Du leitest." } });
  const von = { slot: 1, openedAt: oeffnerin.openedAt, cwd: lead };
  const bauer = bild({ slot: 2, cwd: bau, label: "Bauer", openedBy: von, rechte: { stufe: "deployen", an: ["landen"], aus: [], recht: ["seat.open"] }, permissionMode: "bypassPermissions" });
  const pruefer = bild({ slot: 3, cwd: pruef, label: "Prüfer", openedBy: von, rolleStein: { id: "prufer", name: "Prüfer", hash: PRUEFER.hash } });
  const start = (s: SitzBild, goal: string | null, aufgabe = null): StartEintrag => ({ slot: s.slot, openedAt: s.openedAt, at: s.openedAt, cwd: s.cwd, label: s.label,
    harness: "claude", model: null, effort: null, branch: null, repo: null, goal, aufgabe, lauf: null, rechte: null, profil: null, openedBy: s.openedBy, agent: null });
  const historie = [start(bauer, "Baue die Funktion."), start(pruefer, "Prüfe, was der Bauer baut.")];
  return { wurzel, dir, oeffnerin, bauer, pruefer, historie, start,
    eingang: { name: "Bau und Prüfung", oeffnerin, kinder: [bauer, pruefer], root: wurzel, dir, wissen: WISSEN, historie } };
}

describe("das Ziel, mit dem ein Sitz geöffnet wurde", () => {
  test("es steht in der Historie unter Platz und Belegung; nach einer Nachfolge des Kindes gilt das Ziel seiner Linie; ein fremdes oder fehlendes gibt null", () => {
    const w = welt();
    expect(zielVon(w.historie, w.bauer)).toBe("Baue die Funktion.");
    // die Nachfolge: neue Belegung desselben Platzes, openedBy weitergereicht, in der Historie nur der Start ohne Ziel
    const nachfolger: SitzBild = { ...w.bauer, openedAt: w.bauer.openedAt + 500 };
    const mitNachfolger = [...w.historie, { ...w.start(nachfolger, null), openedBy: null }];
    expect(zielVon(mitNachfolger, nachfolger)).toBe("Baue die Funktion.");
    // dieselbe Linie gilt nur bei gleicher Öffnerin und gleichem Ordner: ein Platz, den eine andere Öffnerin belegte, erbt es nicht
    const fremd: SitzBild = { ...nachfolger, openedBy: { slot: 9, openedAt: 1, cwd: w.bauer.cwd } };
    expect(zielVon(mitNachfolger, fremd)).toBeNull();
    expect(zielVon([], w.bauer)).toBeNull();
    // die Aufgabe als Objekt steht im Ziel als ihr Text (die Tür schrieb aufgabeAlsText)
    expect(zielVon([w.start(w.bauer, "Goal: Baue.\nDone when: grün")], w.bauer)).toBe("Goal: Baue.\nDone when: grün");
  });
});

describe("setupAusSitzen", () => {
  test("drei Sitze, eine Rolle, zwei Kanten Kind → Öffnerin, je Kind sein Ziel und sein Ordner als leerer Platz; die Datei prüft sich selbst", () => {
    const w = welt();
    const d = setupAusSitzen(w.eingang);
    if (typeof d === "string") throw new Error(d);
    const datei = pruefeSetupDatei(JSON.parse(JSON.stringify(d.datei)));
    if (typeof datei === "string") throw new Error(datei);
    expect(datei.seats.map((s) => s.name)).toEqual(["Leitung", "Bauer", "Prüfer"]);
    expect(datei.roles.map((r) => [r.id, r.start.text, r.rights])).toEqual([["prufer", "Du prüfst, was gebaut wurde.", ["text.pack"]]]);
    const [lead, bauer, pruefer] = datei.seats;
    expect(datei.edges).toEqual([{ from: bauer!.id, to: lead!.id, kind: "reports-to" }, { from: pruefer!.id, to: lead!.id, kind: "reports-to" }]);
    expect([lead!.start.goal, bauer!.start.goal, pruefer!.start.goal]).toEqual([undefined, "Baue die Funktion.", "Prüfe, was der Bauer baut."]);
    expect(pruefer!.start.role).toBe("prufer");
    expect(bauer!.start.role).toBeUndefined();
    expect(lead!.start.purpose?.text).toBe("Du leitest.");
    expect([lead!.start.folder, bauer!.start.folder, pruefer!.start.folder]).toEqual([
      { text: null, personal: true, hint: "lead" }, { text: null, personal: true, hint: "bau" }, { text: null, personal: true, hint: "pruef" }]);
    expect(datei.packs.map((p) => p.id)).toEqual(["shared-pack"]);
    // kein echter Pfad dieser Maschine steht in der Datei
    expect(JSON.stringify(datei)).not.toContain(w.wurzel);
  });

  test("der Ordner außerhalb der Wurzel reist ohne Hinweis; ein Ziel und ein Ordner gehören zum Hash, der leere Platz selbst hat keinen Text", () => {
    const w = welt();
    const draussen = setupAusSitzen({ ...w.eingang, kinder: [{ ...w.bauer, cwd: frisch() }, w.pruefer] });
    const normal = setupAusSitzen(w.eingang);
    const andersZiel = setupAusSitzen({ ...w.eingang, historie: [w.start(w.bauer, "Baue etwas anderes."), w.historie[1]!] });
    if (typeof draussen === "string" || typeof normal === "string" || typeof andersZiel === "string") throw new Error("kein Setup");
    expect(draussen.datei.seats[1]!.start.folder).toEqual({ text: null, personal: true, hint: null });
    expect(new Set([normal.datei.setupHash, draussen.datei.setupHash, andersZiel.datei.setupHash]).size).toBe(3);
    // ein absoluter Hinweis wird nicht gelesen: der Prüfer lehnt die Datei ab
    const roh = JSON.parse(JSON.stringify(normal.datei));
    roh.seats[1].start.folder.hint = "/Users/jemand/bau";
    expect(pruefeSetupDatei(roh)).toContain("relative");
    roh.seats[1].start.folder.hint = "../aus";
    expect(pruefeSetupDatei(roh)).toContain("relative");
  });

  test("die Marke des Sitzes: Rechte gedeckelt, bypass fällt weg, keine Fleet-Rolle — und eine Rolle, die nicht mehr auf dem Regal steht, bleibt draußen mit einem Hinweis", () => {
    const w = welt();
    const d = setupAusSitzen(w.eingang);
    if (typeof d === "string") throw new Error(d);
    const bauer = d.datei.seats[1]!;
    expect(bauer.may.rechte).toEqual({ stufe: "bauen", an: [], aus: [] });
    expect(bauer.may.permissionMode).toBeNull();
    expect(JSON.stringify(d.datei)).not.toContain("bypassPermissions");
    expect(d.datei.roles.map((r) => r.id)).toEqual(["prufer"]);
    const weg = setupAusSitzen({ ...w.eingang, dir: frisch() });
    if (typeof weg === "string") throw new Error(weg);
    expect(weg.datei.roles).toEqual([]);
    expect(weg.datei.seats[2]!.start.role).toBeUndefined();
    expect(weg.hinweise.join("\n")).toContain("prufer");
  });

  test("die Zusagen, die die Speichernde selbst wirksam hat, bleiben in der Datei — wie bei einem gespeicherten Agenten; die übrigen fallen", () => {
    const w = welt();
    const d = setupAusSitzen({ ...w.eingang, behalten: new Set(["seat.open"]) });
    if (typeof d === "string") throw new Error(d);
    expect(d.datei.seats[1]!.may.rechte).toEqual({ stufe: "bauen", an: [], aus: [], recht: ["seat.open"] });
    const keine = setupAusSitzen({ ...w.eingang, behalten: new Set(["text.pack"]) });
    if (typeof keine === "string") throw new Error(keine);
    expect(keine.datei.seats[1]!.may.rechte).toEqual({ stufe: "bauen", an: [], aus: [] });
  });

  test("ohne Kinder gibt es nichts zu speichern", () => {
    const w = welt();
    expect(setupAusSitzen({ ...w.eingang, kinder: [] })).toContain("opened no seat");
  });
});

describe("gespeichert als Konstellation des Speichers", () => {
  test("die Position trägt Ziel, Ordnerplatz und Rolle; Rechte gedeckelt und nie bestätigt; das Profil hat keine Fleet-Rolle; die Marke steht im Autor", async () => {
    const w = welt();
    const d = setupAusSitzen(w.eingang);
    if (typeof d === "string") throw new Error(d);
    const k = await speichereKonstellation(d.datei, w.dir, 5000, 1);
    expect(k).toMatchObject({ name: "Bau und Prüfung", seats: 3 });
    const gespeichert = JSON.parse(readFileSync(join(w.dir, SPEICHER_DATEI), "utf8")).konstellationen[0];
    expect(gespeichert.autor).toBe("the session in slot 1");
    const [lead, bauer, pruefer] = gespeichert.positionen;
    expect([bauer.ziel, pruefer.ziel, lead.ziel]).toEqual(["Baue die Funktion.", "Prüfe, was der Bauer baut.", undefined]);
    expect(bauer.ordner).toEqual({ hint: "bau" });
    expect([lead.meldetAn, bauer.meldetAn, pruefer.meldetAn]).toEqual([undefined, lead.id, lead.id]);
    expect(pruefer.sitz.rolle).toBe("prufer");
    // DIE MARKE: die Rechte stehen gedeckelt im Sitz-Block, bestaetigt gibt es nur nach der Freigabe des Owners; der Start liest sie durch sitzRechte
    expect(bauer.sitz.darf.rechte).toEqual({ stufe: "bauen", an: [], aus: [] });
    expect(bauer.sitz.darf.bestaetigt).toBeUndefined();
    expect(sitzRechte(bauer.sitz.darf)?.stufe).toBe("bauen");
    expect(pruefer.sitz.darf.rolle).toEqual(["text.pack"]);
    expect(sitzRechte(pruefer.sitz.darf)?.recht).toBeUndefined(); // das Bundel der Rolle wartet auf die Freigabe
    expect(bauer.sitz.darf.modus).not.toBe("bypassPermissions");
    for (const p of [lead, bauer, pruefer]) expect(p.profil.rolle).toBe("nur-ordner");
  });

  test("in ein leeres Zustandsverzeichnis importiert nennt die Vorschau Sitze, Rolle mit Rechten, Kanten, Ziele und die leeren Ordnerplätze; schreiben legt Rolle und Konstellation ab", async () => {
    const w = welt();
    const d = setupAusSitzen(w.eingang);
    if (typeof d === "string") throw new Error(d);
    const leer = frisch();
    const roh = JSON.parse(JSON.stringify(d.datei));
    const vorschau = await importiereSetup(roh, { dir: leer });
    expect(vorschau.status).toBe(200);
    const v = vorschau.body.vorschau as Record<string, any>;
    expect(v.seats).toBe(3);
    expect(v.seatList.map((s: any) => [s.name, s.role, s.goal])).toEqual([["Leitung", null, null], ["Bauer", null, "Baue die Funktion."], ["Prüfer", "prufer", "Prüfe, was der Bauer baut."]]);
    expect(v.requestedRoles).toEqual([{ id: "prufer", name: "Prüfer", rights: ["text.pack"] }]);
    expect(v.edges).toEqual(d.datei.edges);
    expect(v.emptyPlaces).toEqual(expect.arrayContaining(d.datei.seats.map((s) => `folder:${s.id}`)));
    const geschrieben = await importiereSetup(roh, { dir: leer }, { schreiben: true, jetzt: 7000 });
    expect(geschrieben.status).toBe(201);
    const konst = JSON.parse(readFileSync(join(leer, SPEICHER_DATEI), "utf8")).konstellationen[0];
    expect(konst.positionen.map((p: any) => p.ziel)).toEqual([undefined, "Baue die Funktion.", "Prüfe, was der Bauer baut."]);
    expect(konst.positionen[2].sitz.rolle).toBe("prufer");
  });
});

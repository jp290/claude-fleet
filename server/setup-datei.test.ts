// EIN SETUP, EINE DATEI (Runde 2): Format, Export, Import mit Vorschau, Regal, persönliche Marke, alte Dateien,
// Kette beim Speichern. Die Tests halten die Sätze fest, die der Prüfer als Bedingungen genannt hat.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFILE0, exportObjekt, pos, type Konst, type Profil } from "../src/k15-entwurf-modell";
import { SPEICHER_DATEI } from "../src/k15-speicher";
import { eigenerAgent, eigeneAnsicht, herkunftAusDatei, ketteFuerExport, liesAgenten, schreibAgenten } from "./agenten";
import { hashText, importiereSetup, liesKonzept, liesShelf, loeseBausteine, pruefeSetupDatei, RICHTUNG_PLATZ, roleHash, roleStein,
  setupAusAgent, setupAusDatei, setupAusKonstellation, setupHashVon, setupRoute, schreibShelf, SETUP_FORMAT, startBlockAusSteinen,
  steineFuerAgentWahl, type SetupDatei, type SetupServer } from "./setup-datei";
import { liesEigenePacks, schreibEigenenPack } from "./eigene-packs";
import { fassungsHash } from "./konst-fassungen";
import { k15Freigabe, k15Speicher } from "./k15-speicher";
import { dateiFuer, sitzDerTuer, sitzWissen } from "./sitz-reise";
import { renderSeatStart, type SeatKnowledge } from "./sitz-wissen";

const ordner: string[] = [];
afterAll(() => { for (const o of ordner) rmSync(o, { recursive: true, force: true }); });
const frisch = (): string => { const o = mkdtempSync(join(tmpdir(), "setup-datei-")); ordner.push(o); return o; };
const SENTINEL = "A private sentence that must never stand in a shared setup file, because the owner wrote it for one person only.";
const SEAT: SeatKnowledge = { tree: "fleet", repoRoot: "/r", head: "c0ffee", packs: [
  { id: "shared-pack", useWhen: "Read this when you build.", sources: [{ path: "docs/packs/shared-pack.md", anchor: "# Shared pack" }],
    text: "# Shared pack\n\nUse this when you build." },
  { id: "private-pack", useWhen: "Read this when you talk.", sources: [{ path: "docs/packs/private-pack.md", anchor: "# Private pack" }],
    text: `# Private pack\n\n${SENTINEL}`, personal: true },
] };
const gut = () => null;
const agent = (wahlen: Record<string, unknown> = {}) => {
  const a = eigenerAgent({ name: "Prüfer", wahlen: { model: "claude-sonnet-5-5", bibliothek: ["shared-pack", "private-pack"], ...wahlen },
    agentMd: { titel: "Prüfer.md", text: "Du prüfst." } }, gut, []);
  if (typeof a === "string") throw new Error(a);
  return a;
};
const exportiere = async (a = agent(), q: Record<string, unknown> = {}) => {
  const d = await setupAusAgent(a, { bibliothek: () => SEAT, ...q });
  if (typeof d === "string") throw new Error(d);
  return d;
};

describe("das Format trägt den Sitz mit Text und Hash", () => {
  test("fleet-setup/1: ein Agent ist ein Sitz, sein Pack reist als Text mit seinem sha256, ein persönlicher Pack als leerer Platz", async () => {
    const { datei } = await exportiere();
    expect(datei.format).toBe(SETUP_FORMAT);
    expect(datei.seats).toHaveLength(1);
    expect(datei.seats[0]!.start.purpose).toEqual({ titel: "Prüfer.md", text: "Du prüfst." });
    const shared = datei.packs.find((p) => p.id === "shared-pack")!;
    expect([shared.text, shared.hash]).toEqual(["# Shared pack\n\nUse this when you build.", hashText("# Shared pack\n\nUse this when you build.")]);
    const personal = datei.packs.find((p) => p.id === "private-pack")!;
    expect([personal.text, personal.hash, personal.personal]).toEqual([null, null, true]);
    expect(datei.seats[0]!.reads.map((r) => [r.id, r.hash])).toEqual([["shared-pack", shared.hash], ["private-pack", null]]);
    expect(JSON.stringify(datei).includes(SENTINEL)).toBe(false);
    expect(setupHashVon(datei)).toBe(datei.setupHash);
    expect(pruefeSetupDatei(datei)).toEqual(datei);
  });
  test("eine geänderte Pack-Zeile bei gleichem Hash wird abgelehnt", async () => {
    const { datei } = await exportiere();
    const kaputt = { ...datei, packs: datei.packs.map((p) => p.id === "shared-pack" ? { ...p, text: "anderer Text" } : p) };
    expect(pruefeSetupDatei(kaputt)).toContain("hash does not match");
  });
  test("ein persönlicher Block mit Text wird abgelehnt — privater Text reist nie", async () => {
    const { datei } = await exportiere();
    const kaputt = { ...datei, packs: datei.packs.map((p) => p.id === "private-pack" ? { ...p, text: "geheim" } : p) };
    expect(pruefeSetupDatei(kaputt)).toContain("private text never travels");
  });
});

describe("die persönliche Marke steht am Wissen, nicht in einer Liste", () => {
  test("die Marke wird dort gelesen, wo das Wissen liegt: im Pack-Kopf und im Konzept-Frontmatter", () => {
    const packDir = frisch();
    schreibEigenenPack(packDir, { id: "eigener-privater", useWhen: "x", text: "# Eigen\n\nText", personal: true }, "Test");
    expect(liesEigenePacks(packDir)[0]?.personal).toBe(true);
    const root = join(frisch(), "konzepte");
    mkdirSync(join(root, "k-privat"), { recursive: true });
    const text = `---\npersonal: true\n---\n# Privat\n\n${SENTINEL}`;
    writeFileSync(join(root, "k-privat", "versionen.jsonl"), JSON.stringify({ konzept: "k-privat", version: 1, sha256: hashText(text) }) + "\n");
    writeFileSync(join(root, "k-privat", "v1.md"), text);
    expect(liesKonzept(root, "k-privat")?.personal).toBe(true);
  });
  test("Pack, Konzept und Notiz tragen personal: true; der Export macht daraus drei leere Plätze", async () => {
    const dir = frisch();
    const root = join(dir, "konzepte");
    mkdirSync(join(root, "k-privat"), { recursive: true });
    const konzeptText = `---\npersonal: true\n---\n# Privat\n\n${SENTINEL}`;
    writeFileSync(join(root, "k-privat", "versionen.jsonl"), JSON.stringify({ konzept: "k-privat", version: 1, sha256: hashText(konzeptText), anlass: "private" }) + "\n");
    writeFileSync(join(root, "k-privat", "v1.md"), konzeptText);
    const notiz = `---\npersonal: true\n---\n# Owner\n\n${SENTINEL}`;
    const a = agent({ konzepte: ["k-privat"] });
    const d = await setupAusAgent(a, { bibliothek: () => SEAT, konzept: () => ({ id: "k-privat", version: 1, hash: hashText(konzeptText),
      text: konzeptText, personal: true, purpose: "private" }), notizbuch: () => ({ index: "- [Owner](owner.md)", dateien: [{ datei: "owner.md", text: notiz }] }) });
    if (typeof d === "string") throw new Error(d);
    expect(d.datei.concepts[0]).toMatchObject({ id: "k-privat", text: null, hash: null, personal: true });
    expect(d.datei.seats[0]!.notebook?.notes[0]).toMatchObject({ id: "owner.md", text: null, hash: null, personal: true });
    expect(JSON.stringify(d.datei).includes(SENTINEL)).toBe(false);
  });
  test("die Probe verweigert eine Datei, in der ein persönlicher Text trotzdem steht", async () => {
    const a = agent();
    const d = await setupAusAgent(a, { bibliothek: () => SEAT, privateTexte: ["# Shared pack\n\nUse this when you build."] });
    expect(typeof d === "string" && d.startsWith("die Datei enthielte persönlichen Text")).toBe(true);
  });
  test("ein alter Bestand ohne Marke bleibt über den Leseschim persönlich", async () => {
    const { notizbuchZumTeilen } = await import("../src/sitz");
    const nb = notizbuchZumTeilen("- [Owner](owner.md)", [{ datei: "owner.md", text: "---\nmetadata:\n  type: user\n---\nEr liest jeden Satz." }]);
    expect([nb.notizen.length, nb.daheim]).toEqual([0, 1]);
  });
});

describe("alte Dateien werden durch dieselbe Tür gelesen", () => {
  test("fleet-agent/1 wird ein Ein-Sitz-Setup, mit abgeleitetVon als derivedFrom", async () => {
    const alt = { format: "fleet-agent/1", name: "Alt", wahlen: { model: "claude-sonnet-5-5", bibliothek: ["shared-pack"] },
      agentMd: { titel: "Alt.md", text: "Du bist alt." }, abgeleitetVon: "a".repeat(64) };
    const d = await setupAusDatei(alt, { bibliothek: () => SEAT });
    if (typeof d === "string") throw new Error(d);
    expect([d.legacy, d.datei.seats.length, d.datei.derivedFrom, d.datei.packs.map((p) => p.id)]).toEqual([true, 1, "a".repeat(64), ["shared-pack"]]);
  });
  test("fleet: \"konstellation\" wird ein Mehr-Sitz-Setup mit Kante, Sitz-Block und Konzept", async () => {
    const konzeptText = "# Shared concept\n\nText";
    const alt = { fleet: "konstellation", format: 1, name: "Alt K", abgeleitetVon: "b".repeat(64), positionen: [
      { id: "bauer", name: "Bauer", profil: { id: "p1", rolle: "nur-ordner", datei: { titel: "b.md", abschnitte: [{ titel: "", text: "Du baust." }] } },
        sitz: { liest: [{ id: "shared-pack", weg: "start", quellen: [], wofuer: "bauen", text: "# Shared\n\nText" }], persoenlich: [], darf: { rechte: null, modus: "auto" },
          notizbuch: { index: "- [Lauf](lauf.md)", notizen: [{ datei: "lauf.md", text: "---\nmetadata:\n  type: project\n---\nEin Lauf." }], daheim: 1 },
          persoenlicheNotizen: ["owner.md"],
          konzepte: [{ id: "k-shared", version: 1, hash: hashText(konzeptText), text: konzeptText }, { id: "k-private", version: 2, hash: null, text: null, personal: true }] } },
      { id: "pruefer", name: "Prüfer", profil: { id: "p2", rolle: "nur-ordner" }, meldetAn: "bauer" },
    ] };
    const d = await setupAusDatei(alt);
    if (typeof d === "string") throw new Error(d);
    expect([d.legacy, d.datei.seats.length, d.datei.edges[0]?.from, d.datei.derivedFrom]).toEqual([true, 2, "pruefer", "b".repeat(64)]);
    expect(d.datei.packs[0]).toMatchObject({ id: "shared-pack", text: "# Shared\n\nText" });
    expect(d.datei.seats[0]!.notebook?.notes.map((n) => [n.id, n.text, n.personal ?? false]))
      .toEqual([["lauf.md", "---\nmetadata:\n  type: project\n---\nEin Lauf.", false], ["owner.md", null, true]]);
    expect(d.datei.concepts.map((c) => [c.id, c.text, c.personal ?? false])).toEqual([["k-shared", konzeptText, false], ["k-private", null, true]]);
  });
  test("ein Konzept, das der Sitz unter liest trägt, wird beim Export nicht zusätzlich ein Pack", () => {
    const konzeptText = "# Shared concept\n\nText";
    const fakePack = { id: "k-shared", weg: "start", quellen: [], wofuer: "lesen", text: konzeptText };
    const form = { fleet: "konstellation", format: 1, name: "Konzept", positionen: [{
      id: "bauer", name: "Bauer", profil: { id: "p1", rolle: "nur-ordner" },
      sitz: { liest: [fakePack], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null,
        konzepte: [{ id: "k-shared", version: 1, hash: hashText(konzeptText), text: konzeptText }] } }] };
    const d = setupAusKonstellation(form, form);
    if (typeof d === "string") throw new Error(d);
    expect([d.datei.packs.map((p) => p.id), d.datei.concepts.map((c) => c.id),
      d.datei.seats[0]!.reads.map((r) => [r.kind, r.id])]).toEqual([[], ["k-shared"], [["concept", "k-shared"]]]);
  });
});

describe("der Importtisch", () => {
  const setupMit = async (id: string, text = "# Fremd\n\nText", hash?: string): Promise<SetupDatei> => {
    const d = await setupAusAgent(agent({ bibliothek: [id] }), { bibliothek: () => ({ ...SEAT, packs: [{ id, useWhen: "x", sources: [], text }] }) });
    if (typeof d === "string") throw new Error(d);
    return d.datei;
  };
  test("gleicher Hash: die lokale Kopie bleibt, mitgereister Text wird nicht gespeichert", async () => {
    const dir = frisch();
    const text = "# Shared pack\n\nUse this when you build.";
    const { datei } = await exportiere();
    schreibShelf(dir, { version: 1, packs: [{ ...datei.packs[0]!, id: "shared-pack", text, hash: hashText(text) }], concepts: [] });
    const l = await loeseBausteine(datei, { bibliothek: () => SEAT }, dir);
    if (typeof l === "string") throw new Error(l);
    expect(l.vorschau.packs.find((p) => p.id === "shared-pack")?.source).toBe("local");
    expect(l.zuSpeichern.packs).toEqual([]);
  });
  test("neue Id: der mitgereiste Text landet im Regal", async () => {
    const dir = frisch();
    const d = await setupMit("fremd-pack");
    const l = await loeseBausteine(d, { bibliothek: () => ({ ...SEAT, packs: [] }) }, dir);
    if (typeof l === "string") throw new Error(l);
    expect(l.vorschau.packs[0]).toMatchObject({ id: "fremd-pack", source: "carried" });
    expect(l.zuSpeichern.packs.map((p) => p.id)).toEqual(["fremd-pack"]);
  });
  test("gleiche Id, anderer Hash: lokal bleibt, mitgereist landet unter id@hash8", async () => {
    const dir = frisch();
    const alt = "# Alt\n\nAnderer Text";
    schreibShelf(dir, { version: 1, packs: [{ kind: "pack", id: "fremd-pack", hash: hashText(alt), text: alt, useWhen: "x", sources: [] }], concepts: [] });
    const d = await setupMit("fremd-pack", "# Neu\n\nNeuer Text");
    const l = await loeseBausteine(d, { bibliothek: () => ({ ...SEAT, packs: [] }) }, dir);
    if (typeof l === "string") throw new Error(l);
    const kollision = l.vorschau.collisions[0]!;
    expect([kollision.id, kollision.neu]).toEqual(["fremd-pack", `fremd-pack@${hashText("# Neu\n\nNeuer Text").slice(0, 8)}`]);
    expect(l.datei.packs.find((p) => p.id === kollision.neu)?.text).toBe("# Neu\n\nNeuer Text");
    expect(liesShelf(dir).packs[0]!.text).toBe(alt);
  });
  test("ein leerer persönlicher Platz wird genannt, nicht mit fremdem Text gefüllt", async () => {
    const dir = frisch();
    const { datei } = await exportiere();
    const l = await loeseBausteine(datei, { bibliothek: () => SEAT }, dir);
    if (typeof l === "string") throw new Error(l);
    expect(l.vorschau.personalPlaces).toContain("pack:private-pack");
    expect(l.vorschau.emptyPlaces).toContain("pack:private-pack");
    // the empty place itself must survive the import table: without its block sitzAusSetup could not keep it at the seat
    expect(l.datei.packs.find((p) => p.id === "private-pack")).toMatchObject({ text: null, hash: null, personal: true });
    expect(JSON.stringify(l.datei).includes(SENTINEL)).toBe(false);
  });
  test("ein mitgereistes Konzept behält seinen Autor im Regal und in beiden Startwegen", async () => {
    const dir = frisch();
    const conceptText = "# Shared concept\n\nA concept that keeps its author.";
    const form = { fleet: "konstellation", format: 1, name: "Autor", positionen: [{
      id: "bauer", name: "Bauer", profil: { id: "p1", rolle: "nur-ordner", datei: { titel: "b.md", abschnitte: [{ titel: "", text: "Du baust." }] } },
      sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null,
        konzepte: [{ id: "k-shared", version: 1, hash: hashText(conceptText), text: conceptText, author: "owner" }] } },
      { id: "pruefer", name: "Prüfer", profil: { id: "p2", rolle: "nur-ordner" }, meldetAn: "bauer" }] };
    const made = setupAusKonstellation(form, form);
    if (typeof made === "string") throw new Error(made);
    expect(made.datei.concepts[0]?.author).toBe("owner");
    const r = await importiereSetup(made.datei, { dir, bibliothek: () => SEAT }, { schreiben: true, jetzt: 7 });
    expect(r.status).toBe(201);
    expect(liesShelf(dir).concepts.find((c) => c.id === "k-shared")?.author).toBe("owner");
    const kid = String((r.body as Record<string, any>).konstellation.id);
    const t = await sitzDerTuer({ sitz: `${kid}/bauer` }, "claude", dir, null, () => false);
    if (!t.ok || !t.sitz) throw new Error(t.ok ? "kein Sitz" : t.error);
    expect(t.sitz.konzepte?.[0]?.author).toBe("owner");
    expect(renderSeatStart(sitzWissen(t.sitz, null))).toContain("author: owner");
    expect(steineFuerAgentWahl({ konzepte: ["k-shared"] }, dir).block).toContain("+ concept k-shared (author: owner)");
  });
  test("ein persönliches Konzept bleibt beim Import ein leerer Platz in der Weitergabe", async () => {
    const dir = frisch();
    const konzeptText = `---\npersonal: true\n---\n# Privat\n\n${SENTINEL}`;
    const d = await setupAusAgent(agent({ konzepte: ["k-privat"] }), { bibliothek: () => SEAT,
      konzept: () => ({ id: "k-privat", version: 1, hash: hashText(konzeptText), text: konzeptText, personal: true }) });
    if (typeof d === "string") throw new Error(d);
    const l = await loeseBausteine(d.datei, { bibliothek: () => SEAT }, dir);
    if (typeof l === "string") throw new Error(l);
    expect(l.datei.concepts.find((c) => c.id === "k-privat")).toMatchObject({ text: null, hash: null, personal: true });
    expect(JSON.stringify(l.datei).includes(SENTINEL)).toBe(false);
  });
  test("bypass und Rollen ohne Block werden abgelehnt", async () => {
    const { datei } = await exportiere();
    const bypass = { ...datei, seats: datei.seats.map((s) => ({ ...s, may: { ...s.may, permissionMode: "bypassPermissions" } })) };
    expect(pruefeSetupDatei(bypass)).toContain("never starts in bypass");
    const rollen = { ...datei, roles: [{ id: "orchestrator" }] };
    expect(pruefeSetupDatei(rollen)).toContain("role orchestrator");
    const ohneBlock = { ...datei, seats: datei.seats.map((s) => ({ ...s, start: { ...s.start, role: "orchestratorin" } })) };
    expect(pruefeSetupDatei(ohneBlock)).toContain("is not in the file");
  });
});

describe("die Tür: Vorschau schreibt nichts, Schreiben legt einen Agenten an, der in GET /api/agenten steht", () => {
  const q = (dir: string, agenten: () => ReturnType<typeof eigeneAnsicht>[] = () => []): SetupServer => ({
    dir, bibliothek: () => SEAT, eigenePacks: () => [], notizbuch: () => null,
    agenten: async () => agenten(), konstellation: async () => null, konstellationDatei: async () => "keine gespeicherte Konstellation",
  });
  test("POST /api/setups/import ohne schreiben ist nur die Vorschau", async () => {
    const dir = frisch();
    const { datei } = await exportiere();
    const r = await setupRoute(new Request("http://x/api/setups/import", { method: "POST", body: JSON.stringify({ datei }) }),
      new URL("http://x/api/setups/import"), q(dir));
    expect(r.status).toBe(200);
    const body = await r.json() as Record<string, any>;
    expect([body.geschrieben, body.vorschau.seats]).toEqual([false, 1]);
    expect(liesAgenten(dir)).toEqual([]);
  });
  test("mit schreiben: true entsteht ein importierter Agent, sichtbar wie jeder eigene", async () => {
    const dir = frisch();
    const { datei } = await exportiere();
    const r = await setupRoute(new Request("http://x/api/setups/import", { method: "POST", body: JSON.stringify({ datei, schreiben: true }) }),
      new URL("http://x/api/setups/import"), q(dir));
    expect(r.status).toBe(201);
    const body = await r.json() as Record<string, any>;
    const a = liesAgenten(dir)[0]!;
    expect([a.importiert, a.setupHash, a.abgeleitetVon ?? null, a.wahlen.bibliothek]).toEqual([true, datei.setupHash, null, ["shared-pack", "private-pack"]]);
    expect(body.agent.name).toBe("Prüfer");
  });
  test("ein Mehr-Sitz-Setup wird als gespeicherte Konstellation geschrieben", async () => {
    const dir = frisch();
    const alt = { fleet: "konstellation", format: 1, name: "Zwei", positionen: [
      { id: "bauer", name: "Bauer", profil: { id: "p1", rolle: "nur-ordner", datei: { titel: "b.md", abschnitte: [{ titel: "", text: "Du baust." }] } },
        sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null } },
      { id: "pruefer", name: "Prüfer", profil: { id: "p2", rolle: "nur-ordner" }, meldetAn: "bauer" },
    ] };
    const gel = await setupAusDatei(alt);
    if (typeof gel === "string") throw new Error(gel);
    const r = await importiereSetup(gel.datei, { dir, bibliothek: () => SEAT }, { schreiben: true });
    expect(r.status).toBe(201);
    const state = JSON.parse(await Bun.file(join(dir, SPEICHER_DATEI)).text());
    expect([state.konstellationen.length, state.konstellationen[0].positionen.length, state.konstellationen[0].positionen[1].meldetAn])
      .toEqual([1, 2, "bauer"]);
  });
  test("GET /api/setups/:id/datei exportiert diesen Agenten als dieselbe Datei", async () => {
    const dir = frisch();
    const importiert = agent();
    const view = eigeneAnsicht(importiert);
    const r = await setupRoute(new Request(`http://x/api/setups/${view.id}/datei`), new URL(`http://x/api/setups/${view.id}/datei`),
      q(dir, () => [view]));
    expect(r.status).toBe(200);
    const body = await r.json() as { datei: SetupDatei };
    expect([body.datei.format, body.datei.seats[0]!.id]).toEqual([SETUP_FORMAT, view.id]);
  });
});

describe("die Kette ist rein: Import legt den Ursprung ab, Export rechnet sie", () => {
  const kette = (origin: { setupHash?: string; abgeleitetVon?: string; derivedFromLine?: string[] } | null, current: string) =>
    ketteFuerExport(origin, current);
  test("A → B → C: der geänderte Stand nennt seinen Ursprung, die Linie bleibt lesbar", async () => {
    const A = await exportiere();
    // A is the first hand-built setup: no origin, so the export says derivedFrom null
    expect([A.datei.derivedFrom, A.datei.derivedFromLine]).toEqual([null, []]);
    // import A stores A's setup hash as origin; a changed body B then names it
    const dirA = frisch();
    const impA = await importiereSetup(A.datei, { dir: dirA, bibliothek: () => SEAT }, { schreiben: true, jetzt: 1 });
    expect(impA.status).toBe(201);
    const a = liesAgenten(dirA)[0]!;
    const bMd = { titel: "B.md", text: "Du prüfst anders.", profil: a.agentMd!.profil };
    const B = await setupAusAgent({ ...a, agentMd: bMd }, { bibliothek: () => SEAT });
    if (typeof B === "string") throw new Error(B);
    expect([B.datei.derivedFrom, B.datei.derivedFromLine]).toEqual([A.datei.setupHash, []]);
    // import B: the file's setupHash is the origin, its derivedFrom the head of the line
    const dirB = frisch();
    const impB = await importiereSetup(B.datei, { dir: dirB, bibliothek: () => SEAT }, { schreiben: true, jetzt: 2 });
    expect(impB.status).toBe(201);
    const b = liesAgenten(dirB)[0]!;
    expect([b.setupHash, b.abgeleitetVon, b.derivedFromLine]).toEqual([B.datei.setupHash, A.datei.setupHash, [A.datei.setupHash]]);
    // C differs again: derivedFrom = B, line = [A] (B's own derivedFrom, then B's line)
    const C = await setupAusAgent({ ...b, agentMd: { titel: "C.md", text: "Du prüfst noch anders.", profil: b.agentMd!.profil } }, { bibliothek: () => SEAT });
    if (typeof C === "string") throw new Error(C);
    expect([C.datei.derivedFrom, C.datei.derivedFromLine]).toEqual([B.datei.setupHash, [A.datei.setupHash]]);
    // same body again = same setup: its own origin, not a new link
    const D = await setupAusAgent({ ...b, agentMd: bMd }, { bibliothek: () => SEAT });
    if (typeof D === "string") throw new Error(D);
    expect([D.datei.derivedFrom, D.datei.derivedFromLine]).toEqual([A.datei.setupHash, [A.datei.setupHash]]);
    // a setup with no origin never invents one
    expect(kette(null, A.datei.setupHash)).toEqual({ derivedFrom: null, derivedFromLine: [] });
  });
  test("dreimal speichern fügt keinen Vorfahren hinzu; der Export eines eigenen Setups sagt derivedFrom: null", async () => {
    const dir = frisch();
    const a = agent();
    for (let i = 0; i < 3; i++) schreibAgenten(dir, [a]);
    const gespeichert = liesAgenten(dir)[0]!;
    expect([gespeichert.setupHash, gespeichert.abgeleitetVon, gespeichert.derivedFromLine]).toEqual([undefined, undefined, undefined]);
    const d = await setupAusAgent(gespeichert, { bibliothek: () => SEAT });
    if (typeof d === "string") throw new Error(d);
    expect([d.datei.derivedFrom, d.datei.derivedFromLine]).toEqual([null, []]);
  });
  test("der PUT des K15-Speichers verliert eine abgelegte Herkunft nicht, wenn der Client die neuen Felder nicht kennt", async () => {
    const dir = frisch();
    const V1 = { id: "c1", format: 1, fleet: "konstellation", name: "Zwei", version: 1, positionen: [{ id: "a", name: "A" }],
      setupHash: "a".repeat(64), abgeleitetVon: "b".repeat(64), derivedFromLine: ["c".repeat(64)] };
    const put = (k: object) => k15Speicher(new Request("http://x/api/k15/eigenes", { method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ fassungen: [], packs: [], profile: [], konstellationen: [k] }) }), dir);
    await put(V1);
    const V2 = { id: "c1", format: 1, fleet: "konstellation", name: "Zwei neu", version: 2, positionen: [{ id: "a", name: "A" }] };
    await put(V2);
    const state = JSON.parse(await Bun.file(join(dir, SPEICHER_DATEI)).text());
    expect([state.konstellationen[0].setupHash, state.konstellationen[0].abgeleitetVon, state.konstellationen[0].derivedFromLine])
      .toEqual(["a".repeat(64), "b".repeat(64), ["c".repeat(64)]]);
  });
});

describe("Rollen sind Steine", () => {
  test("ein Rollensitz exportiert seinen Block: Starttext, Rechtebundel, Packs und Hash; die Richtung ist ein leerer Platz", async () => {
    const roleText = "# Orchestrator\n\n**You take Fleet where it is going.**";
    const form = { id: "k-role", name: "Rolle", abgeleitetVon: "b".repeat(64), positionen: [{
      id: "orch", name: "Orchestrator", profil: { id: "p1", rolle: "orchestratorin", schiene: "session",
        datei: { titel: "orchestrator.md", v: 1, pfad: "docs/start/orchestrator.md", abschnitte: [{ titel: "", text: roleText }] } },
      sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null } }] };
    const d = setupAusKonstellation(form, form);
    if (typeof d === "string") throw new Error(d);
    const role = d.datei.roles[0]!;
    expect([role.id, role.start.text.includes("You take Fleet where it is going"), role.rights]).toEqual(
      ["orchestratorin", true, expect.arrayContaining(["seat.open", "edge.grant", "text.handover"])]);
    expect(role.hash).toBe(roleHash(role));
    expect(role.packs.map((p) => p.id)).toEqual(expect.arrayContaining(["system-concept", "setting-up-agents", "working-with-the-owner"]));
    expect(d.datei.seats[0]!.start.role).toBe("orchestratorin");
    expect(d.datei.seats[0]!.start.direction).toEqual({ text: null, personal: true });
    expect(pruefeSetupDatei(d.datei)).toEqual(d.datei);
  });
  test("ein Rollenimport erbittet die Rechte, zeigt den Starttext und gibt das Bundel erst nach der Freigabe", async () => {
    const form = { id: "k-role", name: "Rolle", positionen: [{
      id: "orch", name: "Orchestrator", profil: { id: "p1", rolle: "orchestratorin", schiene: "session",
        datei: { titel: "orchestrator.md", v: 1, pfad: "docs/start/orchestrator.md", abschnitte: [{ titel: "", text: "# Orchestrator\n\nDu gehst." }] } },
      sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null } }] };
    const made = setupAusKonstellation(form, form);
    if (typeof made === "string") throw new Error(made);
    const dir = frisch();
    const r = await importiereSetup(made.datei, { dir, bibliothek: () => SEAT }, { schreiben: true, jetzt: 7 });
    expect(r.status).toBe(201);
    const body = r.body as Record<string, any>;
    expect(body.vorschau.requestedRoles[0].rights).toEqual(expect.arrayContaining(["seat.open", "edge.grant"]));
    const kid = String(body.konstellation.id);
    const state = JSON.parse(await Bun.file(join(dir, SPEICHER_DATEI)).text());
    const pos = state.konstellationen[0].positionen[0];
    // the carried role is a block, not Fleet's built-in role name on the profile; no agent at all is written
    expect([pos.profil.rolle, pos.profil.schiene, pos.sitz.darf.rolle, pos.sitz.darf.bestaetigt])
      .toEqual(["nur-ordner", "session", expect.arrayContaining(["seat.open", "edge.grant"]), undefined]);
    expect(liesAgenten(dir)).toEqual([]);
    const vorher = await sitzDerTuer({ sitz: `${kid}/orch` }, "claude", dir, null, () => false);
    expect(vorher.ok && vorher.rechte === null).toBe(true);
    expect(vorher.ok && vorher.agentMd?.text.includes(made.datei.roles[0]!.start.text.trim())).toBe(true);
    const frei = await k15Freigabe(new Request("http://x/api/k15/freigabe", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ konst: kid, pos: "orch" }) }), dir);
    expect(frei.status).toBe(200);
    const nachher = await sitzDerTuer({ sitz: `${kid}/orch` }, "claude", dir, null, () => false);
    expect(nachher.ok && nachher.rechte?.recht).toEqual(expect.arrayContaining(["seat.open", "edge.grant", "text.handover"]));
    // the file's own mode is never bypass, and a file asking for it is refused before it is written
    const bypass = { ...made.datei, seats: made.datei.seats.map((s) => ({ ...s, may: { ...s.may, permissionMode: "bypassPermissions" } })) };
    expect(pruefeSetupDatei(bypass)).toContain("never starts in bypass");
  });
  test.each(["orchestrator", "session", "lane", "bau", "program-main"])(
    "ein Profil mit rolle orchestratorin auf der Schiene %s kommt ohne Rollennamen an; sein Rollenstein erbittet die Rechte", async (schiene) => {
      const dir = frisch();
      const form = { fleet: "konstellation", format: 1, name: "Alt-Rolle", positionen: [{
        id: "orch", name: "Orchestrator", profil: { id: "p1", rolle: "orchestratorin", schiene,
          datei: { titel: "orch.md", abschnitte: [{ titel: "", text: "# Orchestrator\n\nDu gehst." }] } },
        sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null } }] };
      const r = await importiereSetup(form, { dir, bibliothek: () => SEAT }, { schreiben: true, jetzt: 7 });
      expect(r.status).toBe(201);
      const state = JSON.parse(await Bun.file(join(dir, SPEICHER_DATEI)).text());
      const pos = state.konstellationen[0].positionen[0];
      expect([pos.profil.rolle, pos.profil.schiene]).toEqual(["nur-ordner", "session"]);
      expect(pos.sitz.darf.rolle).toEqual(expect.arrayContaining(["seat.open", "edge.grant", "text.handover"]));
      expect(pos.sitz.darf.bestaetigt).toBeUndefined();
      expect(liesAgenten(dir)).toEqual([]);
    });
  test("ein importierter Rollensitz trägt seine Rollenkennung und exportiert denselben Rollenstein wieder", async () => {
    const form = { id: "k-role", name: "Rolle", positionen: [{
      id: "orch", name: "Orchestrator", profil: { id: "p1", rolle: "orchestratorin", schiene: "session",
        datei: { titel: "orchestrator.md", v: 1, pfad: "docs/start/orchestrator.md", abschnitte: [{ titel: "", text: "# Orchestrator\n\nDu gehst." }] } },
      sitz: { liest: [], persoenlich: [], darf: { rechte: null, modus: "auto" }, notizbuch: null } }] };
    const made = setupAusKonstellation(form, form);
    if (typeof made === "string") throw new Error(made);
    const dir = frisch();
    const r = await importiereSetup(made.datei, { dir, bibliothek: () => SEAT }, { schreiben: true, jetzt: 7 });
    expect(r.status).toBe(201);
    const state = JSON.parse(await Bun.file(join(dir, SPEICHER_DATEI)).text());
    const pos = state.konstellationen[0].positionen[0];
    expect([pos.sitz.rolle, pos.profil.rolle]).toEqual(["orchestratorin", "nur-ordner"]);
    const wieder = setupAusKonstellation(state.konstellationen[0], state.konstellationen[0], [], { dir });
    if (typeof wieder === "string") throw new Error(wieder);
    expect(wieder.datei.seats[0]?.start.role).toBe("orchestratorin");
    expect(wieder.datei.roles.find((x) => x.id === "orchestratorin")?.hash)
      .toBe(made.datei.roles.find((x) => x.id === "orchestratorin")?.hash);
  });
  test("ein alter Agent mit wahlen.rolle orchestratorin wird am neuen Tor abgelehnt und nicht geschrieben", async () => {
    const dir = frisch();
    const alt = { format: "fleet-agent/1", name: "Alt-Rolle", wahlen: { rolle: "orchestratorin" },
      agentMd: { titel: "alt.md", text: "Du gehst." }, abgeleitetVon: "a".repeat(64) };
    const r = await importiereSetup(alt, { dir, bibliothek: () => SEAT }, { schreiben: true });
    expect([r.status, String((r.body as Record<string, unknown>).error)]).toEqual([400, expect.stringContaining("never starts in a role")]);
    expect(liesAgenten(dir)).toEqual([]);
  });
  test("Rolle und Konzept eines eigenen Agenten kommen aus dem Regal in denselben Startblock", () => {
    const dir = frisch();
    const concept = { kind: "concept" as const, id: "k-bau", version: 1, hash: hashText("# Bauen\n\nSo baust du."),
      text: "# Bauen\n\nSo baust du.", author: "owner" };
    const role = roleStein("orchestratorin", null);
    if (!role) throw new Error("role stone missing");
    schreibShelf(dir, { version: 1, packs: role.packs, concepts: [concept], roles: [role.role] });
    const steine = steineFuerAgentWahl({ rolle: "orchestratorin", konzepte: ["k-bau"] }, dir);
    expect(steine.role?.id).toBe("orchestratorin");
    expect(steine.concepts.map((c) => c.id)).toEqual(["k-bau"]);
    expect(steine.block).toContain("+ concept k-bau (author: owner)");
    expect(steine.block).toContain("ROLE RIGHTS");
  });
  test("ein eigener Agent außerhalb von Fleets Repo startet mit Rollentext, Konzept als + Stein und Rechten; die Richtung bleibt leer", () => {
    const stein = roleStein("orchestratorin", null);
    if (!stein) throw new Error("role stone missing");
    const concept = { kind: "concept" as const, id: "k-bau", version: 1, hash: "a".repeat(64), text: "# Bauen\n\nSo baust du.",
      author: "owner" };
    const block = startBlockAusSteinen(stein.role, [concept]);
    expect(block).toContain(stein.role.start.text);
    expect(block).toContain("+ concept k-bau (author: owner)");
    expect(block).toContain("So baust du.");
    expect(block).toContain("seat.open — open a seat");
    expect(block).toContain("edge.grant — grant or close an edge");
    expect(RICHTUNG_PLATZ).toContain("empty place");
  });
});

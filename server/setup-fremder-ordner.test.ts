// EIN SITZ AUS EINER IMPORTIERTEN DATEI ÖFFNET IN JEDEM ORDNER (docs/start/direction.md Schritt 3, Prüfung zu Schritt 4, Aufgabe 0ab57311):
// die Packs, die die Datei trägt, liest er aus ihrem mitgereisten Text mit demselben Hash — auch die, die Fleets Register nur im eigenen Repo
// gibt. Ein Pack, für den die Datei keinen Text hat, steht in der Antwort beim Namen als weggelassen. Ein mitgereister Text steht nie unter
// einem anderen Hash an der Stelle eines Packs aus Fleets Register.
import { afterAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eigenerAgent, liesAgenten, schreibAgenten } from "./agenten";
import { hashText, importiereSetup, liesShelf, mitSetupHash, pruefeSetupDatei, schreibShelf, setupAusAgent, tuerPackId, type SetupDatei, type SetupPack } from "./setup-datei";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { type Answer, branchTestkit, get, LIFE_DEADLINE_MS, post } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);
const ok = (a: Answer | undefined): Record<string, any> => {
  if (!a || a.status >= 300) throw new Error(`erwartet 2xx: ${JSON.stringify(a)}`);
  return a.body as Record<string, any>;
};
// gelten im Register nur im Fleet-Repo (seat-start), nicht in einem fremden Ordner
const NUR_FLEET = ["testinstanz-abnahme", "how-fleet-remembers"];
const regal = (state: string): { packs: { id: string; hash: string; text: string }[] } =>
  JSON.parse(readFileSync(join(state, "setup-bausteine.json"), "utf8"));
const wissenText = (fassung: Record<string, any>): string => JSON.stringify(fassung.teile.find((t: { id: string }) => t.id === "liest")?.abschnitte ?? fassung);

describe("ein importierter Sitz öffnet im fremden Ordner", () => {
  test("Packs, die nur im Fleet-Repo gelten: Export, Import, Öffnen im anderen Ordner — der Text der Datei, derselbe Hash", async () => {
    const f = fixture();
    const [vorlage, datei, importiert, offen, fassung] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { model: "claude-haiku-5-5", bibliothek: NUR_FLEET } }),
      get("/api/setups/vorlage/datei"),
      post("/api/setups/import", { datei: "$1.datei", schreiben: true }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "$2.agent.id" }),
      get("/api/slots/1/fassung?anlass=laufend"),
    ]);
    expect(vorlage?.status).toBe(201);
    const packs = ok(datei).datei.packs as { id: string; hash: string; text: string }[];
    expect(packs.map((p) => p.id).sort()).toEqual([...NUR_FLEET].sort());
    expect(importiert?.status).toBe(201);
    expect({ status: offen?.status, error: offen?.body.error }).toEqual({ status: 200, error: undefined });
    // das Regal trägt den Text der Datei mit dem Hash, den sie trug
    expect(regal(f.state).packs.map((p) => [p.id, p.hash]).sort()).toEqual(packs.map((p) => [p.id, p.hash]).sort());
    // ...und der Sitz liest diesen Text
    const text = wissenText(ok(fassung));
    for (const p of packs) expect(text).toContain(JSON.stringify(p.text.slice(0, 80)).slice(1, -1));
  }, LIFE_DEADLINE_MS * 3);

  test("ein Pack mit der Kennung eines Packs aus Fleets Register und anderem Hash tritt nicht an dessen Stelle", async () => {
    const f = fixture();
    const [vorlage, datei] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { bibliothek: ["testinstanz-abnahme"] } }),
      get("/api/setups/vorlage/datei"),
    ]);
    expect(vorlage?.status).toBe(201);
    const echt = ok(datei).datei as SetupDatei;
    const fremderText = "# Testinstanz-Abnahme\n\nDas ist ein anderer Text unter derselben Kennung.\n";
    const fremd = mitSetupHash({ ...echt, packs: echt.packs.map((p) => ({ ...p, text: fremderText, hash: hashText(fremderText) })),
      seats: echt.seats.map((s) => ({ ...s, reads: s.reads.map((r) => ({ ...r, hash: hashText(fremderText) })) })) });
    expect(typeof pruefeSetupDatei(JSON.parse(JSON.stringify(fremd)))).toBe("object");
    const [vorschau, importiert, offen, fassung] = await life(f, [
      post("/api/setups/import", { datei: fremd }),
      post("/api/setups/import", { datei: fremd, schreiben: true }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "$1.agent.id" }),
      get("/api/slots/1/fassung?anlass=laufend"),
    ]);
    const neu = `testinstanz-abnahme@${hashText(fremderText).slice(0, 8)}`;
    expect(ok(vorschau).vorschau.collisions).toEqual([{ kind: "pack", id: "testinstanz-abnahme", neu }]);
    expect(ok(importiert).agent.wahlen.bibliothek).toEqual([tuerPackId(neu)]);
    // das Regal hält den fremden Text nur unter der neuen Kennung, nie unter der des Registers
    expect(regal(f.state).packs.map((p) => p.id)).toEqual([neu]);
    expect(offen?.status).toBe(200);
    const text = wissenText(ok(fassung));
    expect(text).toContain("anderer Text unter derselben Kennung");
    // ...und die Kennung des Registers bleibt die des Registers: im fremden Ordner gibt es sie nicht (der fremde Text steht nicht an ihrer Stelle),
    // im Fleet-Repo wählt sie den Pack des Registers
    const [imFremden, imRepo] = await life(f, [
      post("/api/slots/2/open", { cwd: f.repo, bibliothek: ["testinstanz-abnahme"] }),
      post("/api/slots/3/open", { cwd: join(import.meta.dir, ".."), bibliothek: ["testinstanz-abnahme"] }),
    ]);
    expect([imFremden?.status, imRepo?.status]).toEqual([400, 200]);
    expect(String(imFremden?.body.error)).toContain("has no pack testinstanz-abnahme");
  }, LIFE_DEADLINE_MS * 3);

  test("ein persönlicher Platz ohne Text bei der Person: der Sitz öffnet, Antwort und Start nennen den Pack beim Namen als weggelassen", async () => {
    const f = fixture();
    const [vorlage, datei] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { bibliothek: ["who-it-is-for"] } }),
      get("/api/setups/vorlage/datei"),
    ]);
    expect(vorlage?.status).toBe(201);
    const echt = ok(datei).datei as SetupDatei;
    const mitLeer = mitSetupHash({ ...echt,
      packs: [...echt.packs, { kind: "pack", id: "mein-notizpack", hash: null, text: null, personal: true, useWhen: null, sources: [] }],
      seats: echt.seats.map((s) => ({ ...s, reads: [...s.reads, { kind: "pack" as const, id: "mein-notizpack", hash: null }] })) });
    const [importiert, offen, fassung, vertippt] = await life(f, [
      post("/api/setups/import", { datei: mitLeer, schreiben: true }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "$0.agent.id" }),
      get("/api/slots/1/fassung?anlass=laufend"),
      // die Tür bleibt streng: eine Kennung, die niemand als leeren Platz mitbrachte, wird abgelehnt
      post("/api/slots/2/open", { cwd: f.repo, bibliothek: ["gibt-es-nicht"] }),
    ]);
    const b = ok(importiert);
    expect(b.weggelassen).toEqual(["mein-notizpack"]);
    expect(b.agent.wahlen.bibliothek).toEqual(["who-it-is-for", "mein-notizpack"]);
    expect({ status: offen?.status, error: offen?.body.error }).toEqual({ status: 200, error: undefined });
    expect(JSON.stringify(ok(fassung))).toContain("pack mein-notizpack: the file brought no text for it");
    expect(vertippt?.status).toBe(400);
  }, LIFE_DEADLINE_MS * 3);

  test("die alte Agent-Datei und eine Datei mit bypass gehen durch dieselbe Tür: die alte kommt an, bypass wird abgelehnt", async () => {
    const f = fixture();
    const [vorlage, alt, importiert, offen, bypass] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { model: "claude-haiku-5-5", bibliothek: NUR_FLEET } }),
      get("/api/agenten/vorlage/datei"),
      post("/api/setups/import", { datei: "$1.datei", schreiben: true }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "$2.agent.id" }),
      post("/api/setups/import", { datei: { format: "fleet-agent/1", name: "X", wahlen: { permissionMode: "bypassPermissions" }, abgeleitetVon: "b".repeat(64) }, schreiben: true }),
    ]);
    expect([vorlage?.status, ok(alt).datei.format, importiert?.status, offen?.status]).toEqual([201, "fleet-agent/1", 201, 200]);
    expect(ok(importiert).agent.importiert).toBe(true);
    expect(bypass?.status).toBe(400);
    expect(String(bypass?.body.error)).toContain("bypass");
  }, LIFE_DEADLINE_MS * 3);

  test("eine Datei mit zwei Sitzen: jeder Sitz öffnet im fremden Ordner mit den Packs der Datei", async () => {
    const f = fixture();
    const [vorlage, datei] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { bibliothek: NUR_FLEET } }),
      get("/api/setups/vorlage/datei"),
    ]);
    expect(vorlage?.status).toBe(201);
    const eins = ok(datei).datei as SetupDatei;
    const zwei = mitSetupHash({ ...eins, name: "Zwei Sitze", seats: [eins.seats[0]!, { ...eins.seats[0]!, id: "zweiter", name: "Zweiter" }] });
    const [importiert] = await life(f, [post("/api/setups/import", { datei: zwei, schreiben: true })]);
    const konst = ok(importiert).konstellation as { id: string; seats: number };
    expect(konst.seats).toBe(2);
    const [a, b] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, sitz: `${konst.id}/${eins.seats[0]!.id}` }),
      post("/api/slots/2/open", { cwd: f.repo, sitz: `${konst.id}/zweiter` }),
    ]);
    expect({ a: a?.status, b: b?.status, ea: a?.body.error, eb: b?.body.error }).toEqual({ a: 200, b: 200, ea: undefined, eb: undefined });
  }, LIFE_DEADLINE_MS * 3);
});

// DER AGENT BEHÄLT JE PACK KENNUNG UND HASH, SEIN START LIEST DEN TEXT MIT DIESEM HASH (Agent.packHashes, server.ts#packsNachHash)
describe("ein Pack wird nach seinem Hash gelesen, nicht nach dem, was die Kennung heute heißt", () => {
  const ID = "testinstanz-abnahme";
  const ALT = "# Testinstanz-Abnahme\n\nDer Text, den der Absender hatte, bevor Fleets Register weiterging.\n";
  const alsPack = (text: string): SetupPack => ({ kind: "pack", id: ID, hash: hashText(text), text, useWhen: "x", sources: [{ path: "docs/packs/testinstanz-abnahme.md", anchor: "# Testinstanz-Abnahme" }] });
  const agentMit = (id: string, hash: string | null) => {
    const a = eigenerAgent({ id, name: id, wahlen: { bibliothek: [ID] } }, () => null, [], 1, hash ? { importiert: true, packHashes: { [ID]: hash } } : { importiert: true });
    if (typeof a === "string") throw new Error(a);
    return a;
  };

  test("der Import behält je Pack den Hash der Datei am Agenten", async () => {
    const f = fixture();
    const [vorlage, datei, importiert] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { bibliothek: NUR_FLEET } }),
      get("/api/setups/vorlage/datei"),
      post("/api/setups/import", { datei: "$1.datei", schreiben: true }),
    ]);
    expect(vorlage?.status).toBe(201);
    const packs = ok(datei).datei.packs as { id: string; hash: string }[];
    expect(ok(importiert).agent.packHashes).toEqual(Object.fromEntries(packs.map((p) => [p.id, p.hash])));
  }, LIFE_DEADLINE_MS * 2);

  test("Fleet-Repo, Register weitergegangen: der Text der Datei vom Regal, der Start nennt den Unterschied; passt der Hash, liest der Sitz das Register wie vorher", async () => {
    const f = fixture();
    const [vorlage, datei] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { bibliothek: [ID] } }),
      get("/api/setups/vorlage/datei"),
    ]);
    expect(vorlage?.status).toBe(201);
    const aktuell = (ok(datei).datei.packs as { hash: string }[])[0]!.hash;
    // der Stand der anderen Fleet: das Regal trägt den alten Text unter seinem Hash; drei Agenten verweisen auf drei Hashes
    schreibShelf(f.state, { version: 1, packs: [alsPack(ALT)], concepts: [], roles: [] });
    schreibAgenten(f.state, [...liesAgenten(f.state), agentMit("alt", hashText(ALT)), agentMit("ohne-text", "e".repeat(64)), agentMit("gleich", aktuell)]);
    const wurzel = join(import.meta.dir, "..");
    const [alt, ohne, gleich] = await life(f, [
      post("/api/slots/1/open", { cwd: wurzel, agent: "alt" }),
      post("/api/slots/2/open", { cwd: wurzel, agent: "ohne-text" }),
      post("/api/slots/3/open", { cwd: wurzel, agent: "gleich" }),
    ]);
    expect([alt?.status, ohne?.status, gleich?.status]).toEqual([200, 200, 200]);
    const [fAlt, fOhne, fGleich] = await life(f, [get("/api/slots/1/fassung?anlass=laufend"), get("/api/slots/2/fassung?anlass=laufend"), get("/api/slots/3/fassung?anlass=laufend")]);
    const text = (a: Answer | undefined) => JSON.stringify(ok(a));
    // 1: der Text der Datei (Hash am Agenten) steht im Start, Fleets heutiger nicht; die Zeile nennt beide Hashes
    expect(text(fAlt)).toContain("Der Text, den der Absender hatte");
    expect(text(fAlt)).toContain(`~ pack ${ID}: read from the file's text (${hashText(ALT).slice(0, 12)}); this folder's library has ${aktuell.slice(0, 12)} now`);
    // 2: kein Text mit dem Hash zu haben: der heutige wird gelesen und der Unterschied genannt, nicht still getauscht
    expect(text(fOhne)).toContain(`the file names ${"e".repeat(12)}, no text with that hash is here`);
    expect(text(fOhne)).not.toContain("Der Text, den der Absender hatte");
    // 3: gleicher Hash: das Register, keine Zeile
    expect(text(fGleich)).not.toContain(`~ pack ${ID}`);
    expect(text(fGleich)).not.toContain("Der Text, den der Absender hatte");
  }, LIFE_DEADLINE_MS * 5);

  test("das Regal hält je Kennung und Hash einen Text: ein zweiter Import mit demselben Pack in neuer Fassung ersetzt den ersten nicht", async () => {
    const dir = mkdtempSync(join(tmpdir(), "regal-"));
    const NEU = "# Testinstanz-Abnahme\n\nDer heutige Text.\n";
    schreibShelf(dir, { version: 1, packs: [alsPack(ALT)], concepts: [], roles: [] });
    const a = eigenerAgent({ id: "x", name: "X", wahlen: { bibliothek: [ID] } }, () => null, []);
    if (typeof a === "string") throw new Error(a);
    const bib = { tree: "fleet" as const, repoRoot: "", head: "", packs: [{ id: ID, useWhen: "x", sources: [{ path: "docs/packs/testinstanz-abnahme.md", anchor: "# Testinstanz-Abnahme" }], text: NEU }] };
    const d = await setupAusAgent(a, { bibliothek: () => bib });
    if (typeof d === "string") throw new Error(d);
    const r = await importiereSetup(JSON.parse(JSON.stringify(d.datei)), { dir, bibliothek: () => bib }, { schreiben: true });
    expect(r.status).toBe(201);
    expect(liesShelf(dir).packs.map((p) => [p.id, p.hash]).sort()).toEqual([[ID, hashText(ALT)], [ID, hashText(NEU)]].sort());
  });

  test("ein gewähltes Konzept, das es hier nicht gibt, steht im Start beim Namen", async () => {
    const f = fixture();
    const [vorlage, offen, fassung] = await life(f, [
      post("/api/agenten", { id: "mit-konzept", name: "Mit Konzept", wahlen: { konzepte: ["k-gibt-es-nicht"] } }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "mit-konzept" }),
      get("/api/slots/1/fassung?anlass=laufend"),
    ]);
    expect([vorlage?.status, offen?.status]).toEqual([201, 200]);
    expect(JSON.stringify(ok(fassung))).toContain("− concept k-gibt-es-nicht: not found here");
  }, LIFE_DEADLINE_MS * 2);

  test("die Vorschau vor dem Start zeigt dieselben Wissens-Zeilen wie der laufende Sitz, und der gezeigte Hash gilt beim Start", async () => {
    const f = fixture();
    const WHO = "who-it-is-for";
    const ALTWHO = "# Who it is for\n\nDer Text der anderen Fleet, vor ihrem Register-Stand.\n";
    schreibShelf(f.state, { version: 1, packs: [{ ...alsPack(ALTWHO), id: WHO }], concepts: [], roles: [] });
    const a = eigenerAgent({ id: "alt", name: "Alt", wahlen: { bibliothek: [WHO], konzepte: ["k-gibt-es-nicht"] } }, () => null, [], 1,
      { importiert: true, packHashes: { [WHO]: hashText(ALTWHO) } });
    if (typeof a === "string") throw new Error(a);
    schreibAgenten(f.state, [a]);
    const [vorschau] = await life(f, [get(`/api/founding-plan?repo=${encodeURIComponent(f.repo)}&role=nur-ordner&anlass=neu&agent=alt`)]);
    const gezeigt = ok(vorschau).fassung as { hash: string; liest?: unknown; teile?: unknown } & Record<string, any>;
    const [offen] = await life(f, [post("/api/slots/1/open", { cwd: f.repo, agent: "alt", fassung: gezeigt.hash })]);
    expect({ status: offen?.status, error: offen?.body.error }).toEqual({ status: 200, error: undefined });
    const [laufend] = await life(f, [get("/api/slots/1/fassung?anlass=laufend")]);
    // die Wissens-Zeilen: alles, was mit „~ pack“ oder „− concept“ anfängt, und der Text der Datei
    const zeilen = (x: unknown): string[] => [...JSON.stringify(x).matchAll(/(?:~ pack|− concept)[^"\\]*/g)].map((m) => m[0]).sort();
    const vor = zeilen(gezeigt), lauf = zeilen(ok(laufend));
    expect(vor.some((z) => z.startsWith(`~ pack ${WHO}: read from the file's text`))).toBe(true);
    expect(vor.some((z) => z.startsWith("− concept k-gibt-es-nicht: not found here"))).toBe(true);
    expect(vor).toEqual(lauf);
    expect(JSON.stringify(gezeigt)).toContain("Der Text der anderen Fleet");
    expect(JSON.stringify(ok(laufend))).toContain("Der Text der anderen Fleet");
    // derselbe Start-Hash, wo der Code ihn verspricht: die Tür hat den gezeigten Hash angenommen (sonst 409), und der laufende Sitz trägt ihn
    expect(ok(laufend).hash).toBe(gezeigt.hash);
  }, LIFE_DEADLINE_MS * 4);
});

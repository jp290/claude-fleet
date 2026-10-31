// DIE SETUP-TÜREN (Richtung Schritt 4, docs/start/direction.md „setups in an agent's hands“; server/setup-tueren.ts):
// Speichern, Export und Import mit dem eigenen Self-Token, je hinter dem Recht setup.save, setup.export und
// setup.import — keins trägt ein Rollenbundel, der Owner vergibt es je Sitz (POST /api/slots/<n>/rechte). Ohne Recht
// antwortet jede Tür den 409, der das Recht nennt; mit der Zusage geht dieselbe Sitzung durch. Der Rundgang zeigt die
// Kette: eine Kopie speichern, die Datei exportieren, sie importieren — und die Datei des importierten Agenten nennt
// ihre Herkunft, während der Start des daraus geöffneten Sitzes den Setup-Hash der Datei trägt (Schritt 4: zwei Hashes).
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type RechtId } from "../session-rechte";
import { type Answer, branchTestkit, type Fixture, get, LIFE_DEADLINE_MS, persisted, post } from "./branches-testkit";

const { fixture, life, cleanup } = branchTestkit();
afterAll(cleanup);

const tokenOf = (f: Fixture, slot: number): string => {
  const t = (persisted(f).slots as Record<string, { selfToken?: string }> | undefined)?.[String(slot)]?.selfToken;
  if (!t) throw new Error(`no self token for slot ${slot}`);
  return t;
};
const as = (self: string, step: { method: string; path: string; body?: unknown }) => ({ ...step, token: null, self });
const missing = (a: Answer | undefined, id: RechtId): void => {
  expect({ status: a?.status, missing: a?.body.missingRight, role: typeof a?.body.role, door: typeof a?.body.door })
    .toEqual({ status: 409, missing: id, role: "string", door: "string" });
  expect(String(a?.body.error)).toContain(`missing right \`${id}\``);
};
const ok = (a: Answer | undefined): Record<string, any> => {
  if (!a || a.status >= 300) throw new Error(`erwartet 2xx: ${JSON.stringify(a)}`);
  return a.body as Record<string, any>;
};
// die Fassung, die der Start dieser Belegung festhielt (server/start-fassung.ts), aus ihrer Datei gelesen
const gehalteneFassung = (f: { state: string }, slot: number): Record<string, any> => {
  const datei = readdirSync(join(f.state, "start-fassungen")).filter((n) => n.startsWith(`${slot}-`) && n.endsWith(".json"));
  if (datei.length !== 1) throw new Error(`erwartete eine gehaltene Fassung für Slot ${slot}, fand ${datei.length}`);
  return (JSON.parse(readFileSync(join(f.state, "start-fassungen", datei[0]!), "utf8")) as { fassung: Record<string, any> }).fassung;
};

describe("die Setup-Türen nennen ihr Recht; mit der Zusage des Owners geht dieselbe Sitzung durch", () => {
  test("ohne Recht 409 an allen vier Wegen, mit den drei Rechten gespeichert, exportiert, importiert", async () => {
    const f = fixture();
    const [original, offen] = await life(f, [
      post("/api/agenten", { id: "pruefer", name: "Prüfer", wahlen: { model: "claude-haiku-5-5", permissionMode: "plan", bibliothek: false },
        agentMd: { titel: "pruefer.md", text: "Du prüfst jeden Diff." } }),
      post("/api/slots/1/open", { cwd: f.repo, model: "claude-haiku-5-5", rechte: { buendel: "none" } }),
    ]);
    expect([original?.status, offen?.status]).toEqual([201, 200]);
    const self = tokenOf(f, 1);
    const ohne = await life(f, [
      as(self, post("/api/self/agenten", { id: "eigener", name: "Eigener", wahlen: { model: "claude-haiku-5-5", bibliothek: false } })),
      as(self, post("/api/self/agenten/pruefer/kopie", { wahlen: { model: "claude-sonnet-5-5" } })),
      as(self, get("/api/self/setups/pruefer/datei")),
      as(self, post("/api/self/setups/import", { datei: { format: "fleet-setup/1" } })),
    ]);
    missing(ohne[0], "setup.save");
    missing(ohne[1], "setup.save");
    missing(ohne[2], "setup.export");
    missing(ohne[3], "setup.import");
    // der Owner vergibt die drei Rechte je Sitz; die Tür des Owners bleibt daneben unverändert
    const [grant, ownerExport] = await life(f, [
      post("/api/slots/1/rechte", { grant: ["setup.save", "setup.export", "setup.import"] }),
      get("/api/setups/pruefer/datei"),
    ]);
    expect(grant?.status).toBe(200);
    expect((grant?.body.effective as string[])).toEqual(expect.arrayContaining(["setup.save", "setup.export", "setup.import"]));
    expect(ownerExport?.status).toBe(200);
    const mit = await life(f, [
      as(self, post("/api/self/agenten", { id: "eigener", name: "Eigener", wahlen: { model: "claude-haiku-5-5", bibliothek: false } })),
      as(self, post("/api/self/agenten/pruefer/kopie", { wahlen: { model: "claude-sonnet-5-5" } })),
      as(self, post("/api/self/agenten", { id: "sitz-eins", name: "Sitz eins", vonSlot: 1 })),
      as(self, post("/api/self/agenten", { id: "fremder-sitz", name: "Fremder Sitz", vonSlot: 2 })),
    ]);
    expect(mit.map((x) => x?.status)).toEqual([201, 201, 201, 400]);
    // an der Self-Tür nennt vonSlot nur den eigenen Platz — das Setup eines fremden Sitzes speichert der Owner
    expect(String(mit[3]?.body.error)).toContain("your own slot");
    // der gespeicherte Sitz trägt die Wahlen, mit denen sein Slot startete
    expect(ok(mit[2]).agent.wahlen.model).toBe("claude-haiku-5-5");
    // Export, Vorschau und Schreiben mit demselben Token; die Vorschau schreibt nichts
    const [exp, vorschau, schrieb] = await life(f, [
      as(self, get("/api/self/setups/eigener/datei")),
      as(self, post("/api/self/setups/import", { datei: "$0.datei" })),
      as(self, post("/api/self/setups/import", { datei: "$0.datei", schreiben: true })),
    ]);
    expect(exp?.status).toBe(200);
    expect([vorschau?.status, vorschau?.body.geschrieben]).toEqual([200, false]);
    expect(schrieb?.status).toBe(201);
    expect(ok(schrieb).agent.importiert).toBe(true);
  }, LIFE_DEADLINE_MS * 3);
});

describe("der Rundgang: speichern, exportieren, importieren", () => {
  test("eine Kopie speichern, ihre Datei exportieren, importieren — die Datei des Importierten nennt die Herkunft, der Start den Setup-Hash", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "zwei"), { recursive: true });
    mkdirSync(join(f.repo, "drei"), { recursive: true });
    const [original, offen, grant] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { model: "claude-haiku-5-5", permissionMode: "plan", bibliothek: false },
        agentMd: { titel: "vorlage.md", text: "Du baust." } }),
      post("/api/slots/1/open", { cwd: f.repo, rechte: { buendel: "none" } }),
      post("/api/slots/1/rechte", { grant: ["setup.save", "setup.export", "setup.import"] }),
    ]);
    expect([original?.status, offen?.status, grant?.status]).toEqual([201, 200, 200]);
    const vorlage = ok(original).agent as { id: string; hash: string };
    const self = tokenOf(f, 1);
    // SPEICHERN: eine Kopie der Vorlage mit anderem Modell — sie trägt „copy of“ mit dem Agent-Hash; „derived from“ ist immer ein
    // Setup-Hash, und die Vorlage hat keinen (keine Datei trägt je einen Agent-Hash)
    const [kopieAntwort] = await life(f, [as(self, post("/api/self/agenten/vorlage/kopie", { wahlen: { model: "claude-sonnet-5-5" } }))]);
    const kopie = ok(kopieAntwort).agent as { id: string; hash: string; kopieVon: { hash: string }; setupHash?: string };
    expect(kopie.kopieVon.hash).toBe(vorlage.hash);
    expect(kopie.setupHash).toBeUndefined();
    // EXPORT: dieselbe Datei, die die Tür des Owners schriebe
    const [exportiert] = await life(f, [as(self, get(`/api/self/setups/${kopie.id}/datei`))]);
    const datei = ok(exportiert).datei as { setupHash: string; derivedFrom: string | null; derivedFromLine: string[] };
    expect(datei.derivedFrom).toBeNull();
    // IMPORT: schreiben mit demselben Recht wie die Vorschau; der Importierte trägt die Marke und den Setup-Hash der Datei
    const [importiertAntwort] = await life(f, [as(self, post("/api/self/setups/import", { datei, schreiben: true }))]);
    const importiert = ok(importiertAntwort).agent as { id: string; importiert?: true; setupHash?: string; wahlen: { model: string; permissionMode: string } };
    expect(importiert.importiert).toBe(true);
    expect(importiert.setupHash).toBe(datei.setupHash);
    expect(importiert.wahlen.permissionMode).toBe("plan");
    // die Datei des Importierten nennt in derivedFrom die Datei, aus der er kam; die Linie bleibt leer, solange keine Datei davor stand
    const [exportiert2] = await life(f, [as(self, get(`/api/self/setups/${importiert.id}/datei`))]);
    const datei2 = ok(exportiert2).datei as { derivedFrom: string | null; derivedFromLine: string[] };
    expect(datei2.derivedFrom).toBe(datei.setupHash);
    expect(datei2.derivedFromLine).toEqual([]);
    // DER START NENNT SEIN SETUP (Schritt 4): die gehaltene Fassung des aus dem Import geöffneten Sitzes trägt den
    // Setup-Hash der Datei, neben dem Start-Hash; ein Sitz ohne gespeichertes Setup nennt keinen
    const [ausDatei, ohneSetup, fassungAusDatei, fassungOhne] = await life(f, [
      post("/api/slots/2/open", { cwd: join(f.repo, "zwei"), agent: importiert.id }),
      post("/api/slots/3/open", { cwd: join(f.repo, "drei") }),
      get("/api/slots/2/fassung?anlass=laufend"),
      get("/api/slots/3/fassung?anlass=laufend"),
    ]);
    expect([ausDatei?.status, ohneSetup?.status]).toEqual([200, 200]);
    const fa = ok(fassungAusDatei);
    expect(fa.setupHash).toBe(datei.setupHash);
    expect(fa.agent.setupHash).toBe(datei.setupHash);
    expect(String(fa.agent.satz)).toContain(`setup ${datei.setupHash.slice(0, 12)}`);
    // es ist der GEHALTENE Start (server/start-fassung.ts), nicht eine Neurechnung von jetzt
    expect(fa.festgehalten).toMatchObject({ wie: "laufend" });
    expect(gehalteneFassung(f, 2).setupHash).toBe(datei.setupHash);
    expect(ok(fassungOhne).setupHash).toBeUndefined();
    expect(ok(fassungOhne).agent).toBeUndefined();
  }, LIFE_DEADLINE_MS * 4);
});

describe("der Start eines Sitzes aus einer Kopie nennt nur einen echten Setup-Hash", () => {
  test("die Kopie einer Vorlage ohne Setup-Hash nennt in Fassung und gehaltener Datei keinen (der Agent-Hash ist keiner); ohne Agent ebenso", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "zwei"), { recursive: true });
    const [vorlageAntwort, kopieAntwort, mitKopie, ohne, fassungMit, fassungOhne] = await life(f, [
      post("/api/agenten", { id: "vorlage", name: "Vorlage", wahlen: { model: "claude-haiku-5-5" } }),
      post("/api/agenten/vorlage/kopie", { wahlen: { model: "claude-sonnet-5-5" } }),
      post("/api/slots/1/open", { cwd: f.repo, agent: "$1.agent.id" }),
      post("/api/slots/2/open", { cwd: join(f.repo, "zwei") }),
      get("/api/slots/1/fassung?anlass=laufend"),
      get("/api/slots/2/fassung?anlass=laufend"),
    ]);
    const vorlage = ok(vorlageAntwort).agent as { hash: string };
    const kopie = ok(kopieAntwort).agent as { id: string; setupHash?: string };
    expect(kopie.setupHash).toBeUndefined();
    expect([mitKopie?.status, ohne?.status]).toEqual([200, 200]);
    const fa = ok(fassungMit);
    expect(fa.setupHash).toBeUndefined();
    expect(fa.agent.setupHash).toBeUndefined();
    expect(fa.agent.kopieVon?.hash).toBe(vorlage.hash);
    expect(gehalteneFassung(f, 1).setupHash).toBeUndefined();
    expect(ok(fassungOhne).setupHash).toBeUndefined();
  }, LIFE_DEADLINE_MS * 2);
});

// DIE MARKE DER SELF-TÜR (Runde 3, Urteil zu faee8c0d): ein Agent, den eine Session speichert oder kopiert, ist nicht
// der des Owners — die Marke vonSitz trägt an jeder Tür, die einen Agenten öffnet, dieselbe Wirkung wie importiert:
// nie bypass, nie eine Rolle, die Rechte gedeckelt wie bei einem Import (src/sitz.ts#rechteGedeckelt). Die Liste sagt
// dem Owner, wer speicherte; erst seine Änderung nimmt die Marke — dann öffnet seine Hand, was die der Session nicht gab.
describe("was eine Session speichert, ist nicht die Hand des Owners", () => {
  test("die Self-Tür markiert Gespeichertes und Kopiertes: die Öffnen-Tür des Owners verweigert bypass; nach seiner Änderung ist die Marke weg", async () => {
    const f = fixture();
    mkdirSync(join(f.repo, "zwei"), { recursive: true });
    // ein Sitz in bypass mit breiten Rechten, wie ihn nur der Owner öffnet — mit einer Zusage, die nicht mitreist
    const [offen, grant] = await life(f, [
      post("/api/slots/1/open", { cwd: f.repo, model: "claude-haiku-5-5", permissionMode: "bypassPermissions",
        rechte: { stufe: "deployen", recht: ["fleet.deploy"] } }),
      post("/api/slots/1/rechte", { grant: ["setup.save"] }),
    ]);
    expect([offen?.status, grant?.status]).toEqual([200, 200]);
    const self = tokenOf(f, 1);
    // die Session speichert ihr eigenes Setup (vonSlot): bypass, deployen und die Zusage, wie ihr Platz läuft
    const [gespeichert] = await life(f, [as(self, post("/api/self/agenten", { id: "aus-der-hand", name: "Aus der Hand", vonSlot: 1 }))]);
    const ges = ok(gespeichert);
    expect(ges.agent.vonSitz).toBe(1);
    expect(ges.agent.wahlen.permissionMode).toBe("bypassPermissions"); // gespeichert, wie gefragt
    // der Deckel: Stufe bis „bauen“ wie bei einem Import; die Zusagen, die diese Session selbst trägt, bleiben (sie gibt weiter, was sie darf)
    expect(ges.agent.wahlen.rechte).toEqual({ stufe: "bauen", an: [], aus: [], recht: ["fleet.deploy", "setup.save"] });
    expect(ges.gedeckelt).toEqual(["landen", "deploy", "verwerfen"]);
    expect(String(ges.agent.quelle)).toContain("Slot 1");
    // die Liste sagt es dem Owner, bevor er öffnet
    const [liste] = await life(f, [get("/api/agenten")]);
    const zeile = ok(liste).agenten.find((a: Record<string, unknown>) => a.id === "aus-der-hand");
    expect(String(zeile?.quelle)).toContain("Slot 1");
    // DIE ÖFFNEN-TÜR DES OWNERS VERWEIGERT BYPASS (der Code lehnt ab, er startet nicht gedeckelt — wie bei einem Importierten)
    const [verweigert] = await life(f, [post("/api/slots/2/open", { cwd: join(f.repo, "zwei"), agent: "aus-der-hand" })]);
    expect(verweigert?.status).toBe(400);
    expect(String(verweigert?.body.error)).toContain("never starts in bypass");
    expect(String(verweigert?.body.error)).toContain("slot 1");
    // das Owner-Tor selbst bleibt, wie es war: keine Marke, kein Deckel — erst die Kopie aus der Hand der Session trägt beides
    const [vorlage] = await life(f, [post("/api/agenten", { id: "vorlage-bypass", name: "Vorlage",
      wahlen: { permissionMode: "bypassPermissions", rechte: { stufe: "deployen", recht: ["land.program", "fleet.deploy"] } } })]);
    expect(vorlage?.status).toBe(201);
    expect(ok(vorlage).agent.vonSitz).toBeUndefined();
    expect(ok(vorlage).agent.wahlen.rechte.stufe).toBe("deployen");
    const [kopieAntwort] = await life(f, [as(self, post("/api/self/agenten/vorlage-bypass/kopie", {}))]);
    const k = ok(kopieAntwort);
    expect(k.agent.vonSitz).toBe(1);
    expect(k.agent.kopieVon?.id).toBe("vorlage-bypass");
    expect(k.agent.wahlen.rechte.stufe).toBe("bauen");
    // die Kopie behält die Zusage, die diese Session trägt (fleet.deploy), und verliert die, die sie nicht trägt (land.program), mit ihrer Kennung
    expect(k.agent.wahlen.rechte.recht).toEqual(["fleet.deploy"]);
    expect(k.gedeckelt).toEqual(["landen", "deploy", "verwerfen", "land.program"]);
    expect(String(k.agent.quelle)).toContain("Slot 1");
    const [verweigertKopie] = await life(f, [post("/api/slots/2/open", { cwd: join(f.repo, "zwei"), agent: "copy-of-vorlage" })]);
    expect(verweigertKopie?.status).toBe(400);
    expect(String(verweigertKopie?.body.error)).toContain("never starts in bypass");
    // NACH DER ÄNDERUNG DES OWNERS ist die Marke weg — jetzt öffnet dieselbe Tür, was er änderte
    const [geaendert, wieder] = await life(f, [
      { method: "PUT" as const, path: "/api/agenten/aus-der-hand", body: { wahlen: { permissionMode: "bypassPermissions", rechte: { stufe: "deployen" } } } },
      post("/api/slots/2/open", { cwd: join(f.repo, "zwei"), agent: "aus-der-hand" }),
    ]);
    expect(geaendert?.status).toBe(200);
    expect(ok(geaendert).agent.vonSitz).toBeUndefined();
    expect(String(ok(geaendert).agent.quelle)).not.toContain("Slot 1");
    expect(wieder?.status).toBe(200); // die Hand des Owners gibt, was die der Session nicht gab
    const slot2 = (persisted(f).slots as Record<string, Record<string, unknown>>)["2"];
    expect(slot2?.permissionMode).toBe("bypassPermissions");
    expect((slot2?.rechte as { stufe: string }).stufe).toBe("deployen");
  }, LIFE_DEADLINE_MS * 4);
});

// EIN SITZ, DER ALLEIN REIST, FRAGT SEINE RECHTE WIE EINE KONSTELLATION (F4): was die Datei an Zusagen (recht) und Stufe über „bauen“ erbittet, steht in der
// Vorschau und im Hinweis des Imports, kommt gedeckelt an und gilt erst, wenn der Owner den Agenten selbst setzt (PUT /api/agenten/<id> nimmt die Marke
// „[Zitat entfernt]“): die Tür dafür gibt es schon, und die Freigabe einer Position (POST /api/k15/freigabe) gehört einer Konstellation, nicht einem Agenten.
describe("ein Ein-Sitz-Import erbittet seine Rechte beim Owner", () => {
  test("Vorschau und Hinweis nennen die Zusagen; der Agent kommt ohne sie an; der PUT des Owners setzt sie", async () => {
    const a = fixture(), b = fixture();
    const [angelegt, exportiert] = await life(a, [
      post("/api/agenten", { id: "mit-rechten", name: "Mit Rechten", wahlen: { model: "claude-haiku-5-5", bibliothek: false,
        rechte: { stufe: "deployen", recht: ["seat.open", "text.pack"] } }, agentMd: { titel: "r.md", text: "Du baust." } }),
      get("/api/setups/mit-rechten/datei")]);
    expect(angelegt?.status).toBe(201);
    const datei = ok(exportiert).datei;
    const [vorschau, geschrieben] = await life(b, [post("/api/setups/import", { datei }), post("/api/setups/import", { datei, schreiben: true })]);
    expect((vorschau?.body.vorschau as { requestedRights: { recht?: string[] }[] }).requestedRights.map((r) => r.recht)).toEqual([["seat.open", "text.pack"]]);
    const g = ok(geschrieben);
    expect(g.agent.importiert).toBe(true);
    expect(g.agent.wahlen.rechte.recht).toBeUndefined();
    expect(g.agent.wahlen.rechte.stufe).toBe("bauen");
    expect(g.erbetenRechte).toEqual({ agent: g.agent.id, stufe: "deployen", recht: ["seat.open", "text.pack"], door: `PUT /api/agenten/${g.agent.id}` });
    expect((g.vorschau.hinweise as string[]).join(" ")).toContain("seat.open, text.pack");
    // der Owner setzt den Agenten selbst: die Marke geht, die Zusagen gelten
    const [put, geoeffnet] = await life(b, [
      { method: "PUT" as const, path: `/api/agenten/${g.agent.id}`, body: { wahlen: { ...g.agent.wahlen, rechte: { stufe: "bauen", recht: ["seat.open", "text.pack"] } } } },
      post("/api/slots/1/open", { cwd: b.repo, agent: g.agent.id })]);
    expect(ok(put).agent.importiert).toBeUndefined();
    expect(geoeffnet?.status).toBe(200);
    expect((persisted(b).slots as Record<string, { rechte?: { recht?: string[] } }>)["1"]?.rechte?.recht).toEqual(["seat.open", "text.pack"]);
  }, LIFE_DEADLINE_MS * 5);
});


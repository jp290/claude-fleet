// K15 · der Wortlaut je Abschnitt und die eigenen Fassungen, aus dem Owner-Urteil vom 16.10. (Auftrag k15-urteil-16-10.md auf
// bau/neuaufbau): „[Zitat entfernt]“
// . Die Adresse eines Themas ist der Abschnitt, den es schon gibt.
import { describe, expect, test } from "bun:test";
import type { Answer, Baustein } from "./founding";
import type { FoundingPlanPart } from "./protocol";
import { bloeckeVon, fassungenExport, fassungenImport, schluessel, textBasis, veraltet, type Block, type TextFassung } from "./k15-wortlaut";
import { reglerVon, stufenSchalter, traegerVon } from "./k15-entwurf-modell";

const bytes = (t: string): number => new TextEncoder().encode(t).length;
const baustein = (id: string, o: Partial<Baustein> = {}): Baustein => ({ id, wort: id, satz: "", funktion: ["vertrag"], grenze: { art: "frei" }, schicht: "",
  zustand: "an", quelle: "default", rollenDefault: "an", harness: { gueltig: true, grund: null }, schaltbar: { ja: true }, bytes: "unknown", ersatzKandidaten: [], ...o });
const teil = (id: string, content: string | null, o: Partial<FoundingPlanPart> = {}): FoundingPlanPart => ({ id, packId: null, path: "server.ts", anchor: id,
  sorte: "anleitung", ort: content === null ? "ausleihe" : "box", sha256: `sha-${id}`, bytes: content === null ? null : bytes(content), content, refusal: null, ...o });
function plan(parts: FoundingPlanPart[], bs: Baustein[], zwischen = "\n\n## Zwischen\n\n"): Answer {
  const text = parts.filter((p) => p.content).map((p) => p.content).join(zwischen);
  return { selected: [], omitted: [], sessionAgents: { text, bytes: bytes(text), parts },
    plan: { planHash: "h", planSatz: "", rolle: "lane", harness: "claude", modell: null, effort: null, ort: { art: "repo", pfad: "/r", branch: "main", head: "x" },
      bytesVorAuftrag: { bytes: 0, unknown: [], auftrag: [] }, bausteine: bs },
    rollen: [], start: { tuer: "open", startbar: true, refusals: [] }, lieferung: { tuer: "lane", geliefert: [], ausgelassen: [] } };
}
const textBlock = (bl: Block[], key: string) => {
  const b = bl.find((x) => x.art === "text" && x.key === key);
  if (!b || b.art !== "text") throw new Error(`kein Block ${key}`);
  return b;
};
// welcher Baustein die Stelle trägt, an der `was` in Fleets Text steht
const tragend = (b: ReturnType<typeof textBlock>, was: string): string | undefined => {
  const i = b.fleet.indexOf(was);
  return b.spannen.find((s) => i >= s.von && i < s.bis)?.baustein;
};

// der Fuß der Lane: Owner-Heft (mit Umlauten, damit Bytes und Zeichen auseinandergehen), Rückweg mit der Commit-Regel, Gedächtnis
const OH = "OWNER-KORREKTUREN — gelten für dich: Größe zählt, nicht Länge.";
const LF = "--- ENDE ---\n1. COMMIT. A lane that stops with uncommitted work cannot be landed.\n2. REPORT.";
const MP = "YOUR MEMORY: GET /api/self/memory";
const FUSS = `${OH}\n\n${LF}\n\n${MP}`;
const VERTRAG = "## Portable operating contract\n\n**commit** records it; a commit names its tree.";
const FUSS_BS = [baustein("owner-heft", { bytes: bytes(OH) + 2 }), baustein("lane-footer", { bytes: bytes(LF) + 2 }), baustein("memory-pointer", { bytes: bytes(MP) + 2 })];
const lane = plan([teil("role", "--- ROLLE --- Lane.", { anchor: "LANE_ROLE_CARD" }),
  teil("portable-core.contract", VERTRAG, { packId: "portable-core", path: "AGENTS.md", anchor: "## Portable operating contract" }),
  teil("verify-e2e.more", null, { packId: "verify-e2e", path: "AGENTS.md", anchor: "### More" }), teil("footer", FUSS, { anchor: "laneExitFooter" })],
  [baustein("role-card"), ...FUSS_BS, baustein("context-anchors"), baustein("pack:portable-core", { enthaltenIn: "context-anchors" }),
    baustein("portable-contract", { enthaltenIn: "pack:portable-core" })]);
const bloecke = (a: Answer, f: ReadonlyMap<string, TextFassung> = new Map(), wem = "lane") => bloeckeVon(a, "lane", (id) => id, f, wem);

describe("jeder Abschnitt nennt den Baustein, aus dem er kommt", () => {
  test("im Fuß der Lane trägt der Rückweg die Commit-Regel, das Owner-Heft den Anfang, der Gedächtnis-Hinweis den Schluss", () => {
    const b = textBlock(bloecke(lane), "teil:footer");
    expect([tragend(b, "1. COMMIT."), tragend(b, "Größe zählt"), tragend(b, "YOUR MEMORY")]).toEqual(["lane-footer", "owner-heft", "memory-pointer"]);
    expect(b.abschnitt).toBe("server.ts#laneExitFooter");
    expect(b.titel).toBe("owner-heft · lane-footer · memory-pointer");
  });
  test("der Vertrag ist der box-Teil seines Packs: Baustein Vertrag, Adresse mit Pfad und Anker, Überschrift als Titel", () => {
    const b = textBlock(bloecke(lane), "teil:portable-core.contract");
    expect([b.spannen.map((s) => s.baustein), b.abschnitt, b.titel, b.fassung]).toEqual([["portable-contract"], "AGENTS.md### Portable operating contract", "Portable operating contract", "sha-portable-core.contract"]);
  });
  test("passen die Bytes des Fußes nicht auf, trägt der ganze Teil den Baustein seines Ankers", () => {
    const schief = plan([teil("footer", FUSS, { anchor: "laneExitFooter" })], [baustein("owner-heft", { bytes: 7 }), baustein("lane-footer", { bytes: 9 }), baustein("memory-pointer", { bytes: 3 })]);
    expect(textBlock(bloecke(schief), "teil:footer").spannen).toEqual([{ baustein: "lane-footer", von: 0, bis: FUSS.length }]);
  });
  test("ein Teil, der nur auf Abruf steht, hat keinen Text-Block; was Fleet dazwischen schreibt, ist ein eigener Abschnitt", () => {
    const bl = bloecke(lane);
    expect(bl.some((b) => b.art === "text" && b.teil === "verify-e2e.more")).toBe(false);
    expect(bl.filter((b) => b.art === "zwischen").map((b) => b.art === "zwischen" && b.titel)).toEqual(["Zwischen", "Zwischen"]);
  });
  test("ohne Session-Datei gibt es keine Blöcke", () => {
    expect(bloeckeVon({ ...lane, sessionAgents: undefined }, "lane", (id) => id, new Map(), "lane")).toEqual([]);
  });
});

describe("eine eigene Fassung ändert den Abschnitt, Fleets Text bleibt", () => {
  const f = (abschnitt: string, text: string): TextFassung => ({ abschnitt, teil: null, v: 2, text, basis: null, am: 1, autor: "du" });
  test("ein Teil des Plans zeigt die eigene Fassung, `fleet` behält Fleets Text", () => {
    const k = schluessel("lane", "server.ts#laneExitFooter");
    const b = textBlock(bloecke(lane, new Map([[k, f(k, "neu")]])), "teil:footer");
    expect([b.text, b.fleet, b.eigen?.v]).toEqual(["neu", FUSS, 2]);
  });
  test("auch was Fleet selbst zusammensetzt (Session-Datei#Überschrift) zeigt seine eigene Fassung", () => {
    const mitText = plan([teil("role", "--- ROLLE --- Lane.")], [baustein("role-card")]);
    const roh = { ...mitText, sessionAgents: mitText.sessionAgents && { ...mitText.sessionAgents, text: `${mitText.sessionAgents.text}\n\n## Packs auf Abruf\n\n- verify-e2e` } };
    const k = schluessel("lane", "Session-Datei#Packs auf Abruf");
    const b = textBlock(bloeckeVon(roh, "lane", (id) => id, new Map([[k, f(k, "- nichts")]]), "lane"), "fleet:Packs auf Abruf");
    expect([b.text, b.fleet, b.eigen?.v]).toEqual(["- nichts", "- verify-e2e", 2]);
  });
  // Prüfung der Bauleitung 16.10., Punkt 5: „Eigene Fassungen gelten global und veralten unbemerkt“
  test("die Fassung eines Profils gilt nicht für ein anderes Profil mit demselben Abschnitt", () => {
    const k = schluessel("md1", "server.ts#laneExitFooter");
    const m = new Map([[k, f(k, "nur für Review")]]);
    expect(textBlock(bloecke(lane, m, "md1"), "teil:footer").text).toBe("nur für Review");
    expect(textBlock(bloecke(lane, m, "lane"), "teil:footer").text).toBe(FUSS);
  });
  test("eine Fassung auf altem Stand von Fleets Text sagt das; auf demselben Stand nicht", () => {
    const k = schluessel("lane", "server.ts#laneExitFooter");
    const auf = (basis: string | null) => textBlock(bloecke(lane, new Map([[k, { ...f(k, "neu"), basis }]])), "teil:footer");
    expect([veraltet(auf("sha-footer")), veraltet(auf("sha-alt")), veraltet(auf(null))]).toEqual([false, true, false]);
    expect(textBlock(bloecke(lane), "teil:footer").basis).toBe("sha-footer");
  });
  test("ohne sha256 vom Plan kennzeichnet textBasis den Text: gleich bei gleichem Text, anders bei anderem", () => {
    expect([textBasis("a b"), textBasis("a b") === textBasis("a c")]).toEqual(["t:" + textBasis("a b").slice(2), false]);
    expect(textBasis("a b")).toMatch(/^t:[0-9a-f]{8}$/);
  });
  test("Rundlauf durch Export und Import; kaputte Einträge fallen einzeln heraus", () => {
    const x: TextFassung = { abschnitt: "server.ts#laneExitFooter", teil: "footer", v: 3, text: "neu", basis: "sha-footer", am: 1, autor: "du" };
    const r = fassungenImport(JSON.parse(JSON.stringify([...fassungenExport([x]), { text: "ohne Abschnitt" }, 42, null, { abschnitt: "a", text: 7 }])), 9);
    expect(r.fassungen).toEqual([{ ...x, am: 9 }]);
    expect(r.verworfen).toBe(4);
    expect(fassungenImport("kein Array", 9)).toEqual({ fassungen: [], verworfen: 0 });
  });
});

describe("„Nur Pflicht“ nimmt nie, was eine Pflicht trägt", () => {
  const vertrag = baustein("portable-contract", { enthaltenIn: "pack:portable-core", grenze: { art: "noetig", grund: "Vertrag", gesperrt: true }, funktion: ["vertrag"] });
  const wissen = (o: Partial<Baustein> = {}) => ({ funktion: ["orientierung"], ...o });
  const a = plan([], [vertrag, baustein("context-anchors", wissen()), baustein("pack:portable-core", wissen({ enthaltenIn: "context-anchors" })),
    baustein("pack:verify-e2e", wissen({ enthaltenIn: "context-anchors" })), baustein("lane-notes", wissen())]);
  test("Lesehinweise und Pack Portable Core tragen den gesperrten Vertrag", () => {
    expect([...traegerVon(a.plan.bausteine)].map(([id, b]) => [id, b.id])).toEqual([["pack:portable-core", "portable-contract"], ["context-anchors", "portable-contract"]]);
  });
  test("der Regler zählt sie zur Pflicht; „Nur Pflicht“ schaltet nur Freies ohne Pflicht darin aus", () => {
    const r = reglerVon(a, "wissen");
    expect(r.pflicht.map((b) => b.id).sort()).toEqual(["context-anchors", "pack:portable-core"]);
    expect(stufenSchalter("pflicht", r)).toEqual({ "pack:verify-e2e": "aus", "lane-notes": "aus" });
  });
  test("eine abgeschaltete Pflicht oder ein freier Baustein trägt nichts", () => {
    expect(traegerVon([{ ...vertrag, zustand: "aus" }, baustein("pack:portable-core")]).size).toBe(0);
    expect(traegerVon([baustein("memory-pointer", { enthaltenIn: "main-rail" }), baustein("main-rail")]).size).toBe(0);
  });
});
